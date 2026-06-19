// ============================================================
// freqmatch.js — Frequenzabgleich: gemeinsame Basis
// ============================================================
// Architektur: Pro Testverfahren eine eigene Datei.
//   freqmatch.js          — shared State, Hilfsfunktionen, Persistenz, Audio
//   freqmatch-adaptive.js — Adaptives Verfahren (Staircase/Bracketing)
//   freqmatch-slider.js   — Slider-Verfahren (manuelle Schätzung)
// Ladereihenfolge: freqmatch.js zuerst, dann die Verfahren-Dateien.
// Diese Konvention gilt für alle Messungen-Sub-Tabs: jedes Testverfahren
// bekommt seine eigene Datei; gemeinsame Infrastruktur bleibt in der
// Basis-Datei des jeweiligen Sub-Tabs.

// --- State ---
let fmModalTone = null;   // BA 230: live-Tonart waehrend des Tonauswahl-Modals; null = kein Modal offen
let fmKbdCorrectVol = null; // BA 239: Korrektorfunktion(vol,hz,pan) aus Modal-Toggles; null = kein Modal offen
let _fmKbT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
let fmRunning = false;
let fmEls = null;
let fmRefSide = "left";
let fmVarSide = "right";
let fmSymmetric = false;   // true wenn refSelect.value === 'symmetric'
let fmVerfahren = 'adaptive';   // 'slider' | 'adaptive' | 'piano'
let fmSeq = [];
let fmSeqIdx = 0;
let fmCurrentEl = null;
let fmCentOffset = 0;
let fmFirstSide = "ref";
let fmIsPlay = false;
let fmPlayTO = null;

// Adaptiver Modus (Bauanleitung 02b/4)
let fmAdaptiveActive   = false;
let fmPianoActive      = false;   // true waehrend eines laufenden Klaviertests (BA356-fix)
let fmAwaitingResponse = false;
let fmTracks           = {};
let fmRoundQueue       = [];   // geshuffelter Round-Robin-State
let fmCurTrackId       = null;
let fmLastPickedTrackId = null;   // Wiederholungs-Sperre für Anker-Randomisierung
let fmCurFirstSide     = 'ref';
let fmTrialStartTs     = 0;
// Gepaartes Bracketing-State für den aktuell startenden/laufenden Lauf
// (wird in fmStartAdaptive berechnet und in _fmPersist in den Lauf geschrieben).
let fmCurPairedToPrevious = false;
// Catch-Trial-Info des aktuellen Trials (Bauanleitung 02b/6)
let fmCurCatchInfo = null;   // null | { direction: +500|-500, expectedResponse: 'var-higher'|'var-lower' }

// Undo-Support für adaptiven Modus
let _fmUndoSnapshot = null;  // Track-State-Snapshot vor letzter Antwort
let _fmNextTrialTO  = null;  // Timeout-Handle für fmNextAdaptiveTrial (canceln bei Undo)

// Debug-Simulation
let _fmSimActive  = false;
let _fmSimOffsets = {};   // electrodeIdx → simulierter Wahrnehmungs-Offset (Cent, pos oder neg)
let _fmParentEl = null;   // gesetzt im DOMContentLoaded

// BA 207: Selektion der zu testenden Elektroden.
// null  = Default (= alle aktiven Elektroden testen).
// []    = Nutzer hat explizit nichts ausgewählt (Test startet nicht).
// [...] = explizite Auswahl. Filter greift in fmBuildSeq / fmBuildSeqSymmetric.
// Die Auswahl gilt für beide Seiten gleichzeitig, weil FreqMatch
// links↔rechts vergleicht.
let freqmatchTestSelection = null;

// Live-Log-Brücke ins Debug-Panel — schreibt nur wenn dbg.flag('adaptiv.live') true ist.
function _fmDbg(msg) {
  if (typeof dbg !== 'undefined' && dbg.flag && dbg.flag('adaptiv.live')) {
    dbg.log(msg, 'info');
  }
}

// Liefert true, wenn der Empfehlungs-Dialog vor dem adaptiven Start
// gezeigt werden soll: noch kein Lauf, keine sliderEstimates vorhanden.
function _fmShouldOfferSliderEstimate() {
  const sd = sideData[fmVarSide];
  if (!sd) return false;
  const fa = sd.freqmatchAdaptive;
  if (fa && Array.isArray(fa.runs) && fa.runs.length > 0) return false;
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return false;
  const seq = fmBuildSeq();
  for (var i = 0; i < seq.length; i++) {
    if (store[String(seq[i])] != null) return false;
  }
  return seq.length > 0;
}

// --- Track-Key-Schema: Key = String(electrodeIdx). Pro Lauf eine
// Staircase je Elektrode (Bracketing über Läufe statt parallel).
function fmTrackKey(electrodeIdx) {
  return String(electrodeIdx);
}
function fmParseTrackKey(key) {
  return { electrodeIdx: parseInt(String(key), 10) };
}

// Stellt sicher, daß sideData[side].freqmatchAdaptive existiert und
// ein gültiges sliderEstimates-Feld hat.
function _fmEnsureSliderStore(side) {
  const sd = sideData[side];
  if (!sd) return null;
  if (!sd.freqmatchAdaptive) {
    sd.freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} };
  }
  if (!sd.freqmatchAdaptive.sliderEstimates ||
      typeof sd.freqmatchAdaptive.sliderEstimates !== 'object') {
    sd.freqmatchAdaptive.sliderEstimates = {};
  }
  return sd.freqmatchAdaptive.sliderEstimates;
}

// BA 206: Aggregat-Wert aus rounds[]-Historie berechnen.
// Regel: ≥3 Werte → Median, =2 → Mittelwert, =1 → der Wert selbst, 0 → null.
function _fmAggregateCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return (vals[0] + vals[1]) / 2;
  const sorted = vals.slice().sort(function(a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// BA 206: Min/Max aus rounds[]-Historie. Rückgabe {min, max} oder null.
function _fmRangeCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  let mn = vals[0], mx = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < mn) mn = vals[i];
    if (vals[i] > mx) mx = vals[i];
  }
  return { min: mn, max: mx };
}

// BA 206: Letzter Messwert dieser Elektrode (= Startwert für nächste Runde).
function _fmLastRoundCent(elIdx) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return null;
  const e = store[String(elIdx)];
  if (!e || !Array.isArray(e.rounds) || e.rounds.length === 0) return null;
  const last = e.rounds[e.rounds.length - 1];
  return (last && typeof last.cent === 'number') ? last.cent : null;
}

// --- Hilfsfunktionen ---
function fmCents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function fmFreqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

function _fmShouldShowCochlearFatHint() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return false;
  if (typeof sideData === 'undefined') return false;
  if (typeof COCHLEAR_FAT_CORRECTION_DATE !== 'number') return false;
  for (let i = 0; i < fRes.length; i++) {
    const e = fRes[i];
    if (!e || typeof e.timestamp !== 'number') continue;
    if (e.timestamp >= COCHLEAR_FAT_CORRECTION_DATE) continue;
    const sd = sideData[e.varSide];
    if (sd && sd.manufacturer === 'cochlear') return true;
  }
  return false;
}

function _fmRefreshCochlearFatHintVisibility() {
  if (!fmEls) return;
  const visible = _fmShouldShowCochlearFatHint();
  testUI.explain.setVisible(fmEls, 'fmCochlearFatHintPara', visible);
  // Datum in den Text einsetzen (jedes Mal frisch, falls Sprache wechselt).
  if (visible) {
    const el = fmEls.explainBox && fmEls.explainBox.querySelector('#fmCochlearFatHintPara');
    if (el) {
      const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
      const dateStr = d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
      const txt = (typeof t === 'function') ? t('fmCochlearFatCorrectionInfo')
        : 'Cochlear-FAT wurde korrigiert.';
      el.textContent = txt.replace('{date}', dateStr);
    }
  }
}

function fmGVol() {
  return Math.pow(volume_global / 100, 2);
}
function fmGDur() {
  return duration_freqmatch || 750;
}
function fmGPau() {
  return pause_freqmatch || 400;
}

// Helfer: Verfahren-Refs
function _fmAdaptPI() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.adaptive && fmEls.verfahren.adaptive.pairIndicator;
}
function _fmSliderPI() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.pairIndicator;
}
function _fmPianoPI() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.piano && fmEls.verfahren.piano.pairIndicator;
}
// Referenzen des Klavier-Bausteins (refs.piano im Verfahren 'piano').
function _fmPianoRefs() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.piano && fmEls.verfahren.piano.piano;
}
// Ton-Boxen des aktiven Verfahrens (fuer setPlaying-Aufleuchten).
function _fmActivePI() {
  if (fmAdaptiveActive) return _fmAdaptPI();
  if (fmPianoActive) return _fmPianoPI();
  return _fmSliderPI();
}
function _fmAdaptUndo() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.adaptive && fmEls.verfahren.adaptive.actions && fmEls.verfahren.adaptive.actions.undo;
}
function _fmSliderUndo() {
  return fmEls && fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.actions && fmEls.verfahren.slider.actions.undo;
}
function fmGAba() {
  return sequence_freqmatch === "aba";
}

function fmCorrGain(side, hz) {
  // BA 303: dedupliziert -- die Interpolations-Logik liegt jetzt zentral
  // in measGain (test.js). fmCorrGain bleibt als benannter Aufrufer fuer
  // die Frequenzabgleich-Sequenzen erhalten.
  return (typeof measGain === "function") ? measGain(side, hz) : 1;
}

// Frequenz der variablen Seite (CI) für Elektrode elIdx
function fmVarHz(elIdx) {
  return withSide(fmVarSide, () => effFreq(elIdx));
}
// Anzeigenummer der Elektrode
function fmDEN(elIdx) {
  return withSide(fmVarSide, () => dEN(elIdx));
}
// Alle aktiven Elektroden der variablen Seite (aufsteigend nach Frequenz)
// BA 207: Schneidet eine Elektroden-Sequenz auf die User-Auswahl.
// freqmatchTestSelection === null → keine Einschränkung (alle aktiven).
// freqmatchTestSelection !== null → Schnittmenge mit gewählten.
function _fmFilterSeqBySelection(seq) {
  if (freqmatchTestSelection == null) return seq;
  var selSet = new Set(freqmatchTestSelection);
  return seq.filter(function(i) { return selSet.has(i); });
}

function fmBuildSeq() {
  const elList = withSide(fmVarSide, () => {
    const result = [];
    for (let i = 0; i < nEl; i++) {
      // BA 164
      if (elActive[i] === false) continue;
      if (elExDur[i]) continue;
      result.push({ idx: i, hz: effFreq(i) });
    }
    return result;
  });
  elList.sort((a, b) => a.hz - b.hz);
  return _fmFilterSeqBySelection(elList.map((x) => x.idx));
}

// Symmetrische Sequenz: nur wenn beide Seiten dieselbe Menge aktiver
// Elektroden haben (selbe Indices). Rückgabe sonst null.
// Sortiert nach Durchschnitts-Mittenfrequenz (links/rechts gemittelt).
function fmBuildSeqSymmetric() {
  function activeList(side) {
    return withSide(side, function() {
      const r = [];
      for (let i = 0; i < nEl; i++) {
        // BA 164
        if (elActive[i] === false) continue;
        if (elExDur[i]) continue;
        r.push(i);
      }
      return r;
    });
  }
  const leftList  = activeList('left');
  const rightList = activeList('right');
  if (leftList.length !== rightList.length) return null;
  for (let j = 0; j < leftList.length; j++) {
    if (leftList[j] !== rightList[j]) return null;
  }
  const seq = leftList.map(function(idx) {
    const fl = withSide('left',  function() { return effFreq(idx); });
    const fr = withSide('right', function() { return effFreq(idx); });
    return { idx: idx, hz: (fl + fr) / 2 };
  });
  seq.sort(function(a, b) { return a.hz - b.hz; });
  return _fmFilterSeqBySelection(seq.map(function(x) { return x.idx; }));
}

// BA 207: Wird vom Auswahl-Dialog nach Confirm aufgerufen.
// Aufgaben:
//   - Adaptive: laufende Tracks mit neuer Auswahl synchronisieren
//   - Slider: laufenden Slider-Round-State synchronisieren
//   - Header-Zusammenfassung neu rendern
//   - Wenn nach Filter keine Elektrode mehr übrig: laufenden Test sauber beenden
function _fmOnSelectionChanged() {
  if (fmAdaptiveActive && typeof _fmApplySelectionToTracks === 'function') {
    _fmApplySelectionToTracks();
    // Statusgrid neu zeichnen, falls existiert.
    if (typeof fmRenderStatusGrid === 'function') fmRenderStatusGrid();
  }
  if (fmRunning && !fmAdaptiveActive && typeof _fmApplySelectionToSliderRun === 'function') {
    _fmApplySelectionToSliderRun();
    if (typeof fmRenderSliderStatusGrid === 'function') fmRenderSliderStatusGrid();
    if (typeof fmUpdateSliderProgress === 'function') fmUpdateSliderProgress();
  }

  // Header-Summary nach-rendern
  if (fmEls && fmEls.header && typeof fmEls.header.electrodeSelectionUpdate === 'function') {
    fmEls.header.electrodeSelectionUpdate();
  }

  // Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist
  // UND ein Test läuft: sauber beenden.
  if (fmRunning) {
    var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
    if (!Array.isArray(freshSeq) || freshSeq.length === 0) {
      var msg = (typeof t === 'function' && t('electrodeSelectionEmptyEnd'))
        || 'Test beendet: Keine ausgewählte Elektrode mehr verfügbar.';
      alert(msg);
      if (fmEls && fmEls._stopTest) fmEls._stopTest();
    }
  }
}

// BA 206: Startwert für eine Elektrode = letzter Wert aus rounds[].
function fmPrevCent(elIdx) {
  const last = _fmLastRoundCent(elIdx);
  if (last != null) return Math.round(last);

  const existing = fRes.find((r) => fmSymmetric
    ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
    : (r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx)
  );
  if (!existing) return 0;
  if (fmSymmetric && typeof existing.cent === 'number' && isFinite(existing.cent)) {
    return Math.round(existing.cent);
  }
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}

// Gemeinsame Initialisierung zu Beginn jedes Verfahren-Starts
function _fmInitSides() {
  const val = fmEls.header.refSelect.value;
  fmSymmetric = (val === 'symmetric');
  if (fmSymmetric) {
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = val;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }
}

// BA 291: Token-Liste fuer den Slider-Modus des Frequenzabgleichs.
// Liefert fertige Token { hz, pan, vol, durationMs, side } (hz mit
// cent-Offset; vol = vol * Korrektur * Stereo-Balance, taube Seite 0)
// und Pausen { pauseMs }. 'side' ('left'|'right') dient dem Aufleuchten.
// Reihenfolge folgt fmFirstSide ('ref' zuerst oder 'var' zuerst).
//   opts.aba === true -> erster Ton am Ende wiederholt.
function fmSequence(opts) {
  opts = opts || {};
  var varHz, refHz;
  if (fmSymmetric) {
    var varBase = withSide('left',  function () { return effFreq(fmCurrentEl); });
    var refBase = withSide('right', function () { return effFreq(fmCurrentEl); });
    varHz = varBase * Math.pow(2, -fmCentOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +fmCentOffset / 2 / 1200);
  } else {
    varHz = fmVarHz(fmCurrentEl);
    refHz = fmFreqFromCents(varHz, fmCentOffset);
  }
  var vol = fmGVol();
  var dur = fmGDur();
  var pau = fmGPau();
  var balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  function tok(side, hz) {
    var pan   = side === "left" ? -1 : 1;
    var corr  = fmCorrGain(side, hz);
    var balDb = side === "left" ? balG.left : balG.right;
    var v     = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return { hz: hz, pan: pan, vol: v, durationMs: dur, side: side };
  }
  var refTok = tok(fmRefSide, refHz);
  var varTok = tok(fmVarSide, varHz);
  var first  = (fmFirstSide === "ref") ? refTok : varTok;
  var second = (fmFirstSide === "ref") ? varTok : refTok;
  var seq = [ first, { pauseMs: pau }, second ];
  if (opts.aba) {
    seq.push({ pauseMs: pau });
    seq.push(first);
  }
  return seq;
}

// --- Tonwiedergabe ---
async function fmPlayCurrent() {
  // --- Adaptive-Modus: Replay des aktuellen Trials über fmPlayAdaptiveTrial ---
  if (fmAdaptiveActive) {
    if (fmCurTrackId === null || !fmTracks || !fmTracks[fmCurTrackId]) return;
    const track = fmTracks[fmCurTrackId];
    // fmPlayAdaptiveTrial mutiert KEINEN Track-State — pure Wiedergabe-Routine.
    // fmAwaitingResponse bleibt true, Antwort-Buttons bleiben aktiv.
    await fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo);
    return;
  }

  // --- Slider-Modus: auf die Token-Maschine (BA 291) ---
  if (fmCurrentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _fmActivePI();
  isPlay = true;
  testUI.tonePlayer.playSequential(
    fmSequence({ aba: fmGAba() }),
    {
      toneType: toneType_freqmatch,
      onStepStart: function (index, token) {
        testUI.pairIndicator.setPlaying(_spi, (token && token.side) ? token.side : null);
      },
      onDone: function () {
        isPlay = false;
        testUI.pairIndicator.setPlaying(_spi, null);
      }
    }
  );
}

async function fmPlaySimultaneous() {
  // --- Adaptive-Modus: Ref- und Var-Ton gleichzeitig mit aktuellem Track-Offset ---
  if (fmAdaptiveActive) {
    if (fmCurTrackId === null || !fmTracks || !fmTracks[fmCurTrackId]) return;
    if (isPlay) {
      isPlay = false;
      if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
      await new Promise((r) => setTimeout(r, 60));
    }
    const track  = fmTracks[fmCurTrackId];
    let refHz, varHz;
    if (fmSymmetric) {
      const varBase = withSide('left',  function() { return effFreq(track.electrodeIdx); });
      const refBase = withSide('right', function() { return effFreq(track.electrodeIdx); });
      const halfOff = track.currentOffset / 2;
      if (fmCurCatchInfo) {
        const halfCatch = fmCurCatchInfo.direction / 2;
        varHz = varBase * Math.pow(2, (-halfOff - halfCatch) / 1200);
        refHz = refBase * Math.pow(2, (+halfOff + halfCatch) / 1200);
      } else {
        varHz = varBase * Math.pow(2, -halfOff / 1200);
        refHz = refBase * Math.pow(2, +halfOff / 1200);
      }
    } else {
      const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
      refHz = elFreq * Math.pow(2, track.currentOffset / 1200);
      varHz = fmCurCatchInfo
        ? refHz * Math.pow(2, fmCurCatchInfo.direction / 1200)
        : elFreq;
    }
    const vol    = fmGVol();
    const ms     = fmGDur();
    const refPan = fmRefSide === "left" ? -1 : 1;
    const varPan = fmVarSide === "left" ? -1 : 1;

    const balG = (typeof getRawBalanceGains === "function")
      ? getRawBalanceGains() : { left: 0, right: 0 };
    const refCorr  = fmCorrGain(fmRefSide, refHz);
    const varCorr  = fmCorrGain(fmVarSide, varHz);
    const refBalDb = fmRefSide === "left" ? balG.left : balG.right;
    const varBalDb = fmVarSide === "left" ? balG.left : balG.right;
    const refVol   = isDeaf(fmRefSide) ? 0 : vol * refCorr * dB2G(refBalDb);
    const varVol   = isDeaf(fmVarSide) ? 0 : vol * varCorr * dB2G(varBalDb);

    const c = gAC();
    isPlay = true;
    testUI.pairIndicator.setPlaying(_fmAdaptPI(), 'both');
    await Promise.all([
      playToneTyped(c, refHz, refVol, ms, refPan, toneType_freqmatch),
      playToneTyped(c, varHz, varVol, ms, varPan, toneType_freqmatch)
    ]);
    testUI.pairIndicator.setPlaying(_fmAdaptPI(), null);
    isPlay = false;
    return;
  }

  // --- Slider-Modus: auf die Token-Maschine (BA 291) ---
  if (fmCurrentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _fmActivePI();
  isPlay = true;
  testUI.pairIndicator.setPlaying(_spi, 'both');
  testUI.tonePlayer.playSimultaneous(
    fmSequence({ aba: false }),
    {
      toneType: toneType_freqmatch,
      onDone: function () {
        isPlay = false;
        testUI.pairIndicator.setPlaying(_spi, null);
      }
    }
  );
}

// --- Persistenz (Bauanleitung 02b/5) ---

function _fmPersist() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  let fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs)) {
    const prevEst = (fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates) ? fa.sliderEstimates : {};
    fa = { runs: [], currentRunIdx: null, sliderEstimates: prevEst };
    sideData[fmVarSide].freqmatchAdaptive = fa;
  }
  if (!fa.sliderEstimates || typeof fa.sliderEstimates !== 'object') {
    fa.sliderEstimates = {};
  }

  let run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run || run.completedAt != null) {
    // Kein aktiver Lauf → neuen Lauf anlegen.
    // startSigns/pairedToPrevious werden in fmStartAdaptive vorher berechnet
    // und in fmCurStartSigns/fmCurPairedToPrevious zwischengespeichert.
    const elList = Array.from(new Set(
      Object.keys(fmTracks).map(function(k) {
        return fmParseTrackKey(k).electrodeIdx;
      })
    )).sort(function(a, b) {
      const fa_ = withSide(fmVarSide, function() { return effFreq(a); });
      const fb_ = withSide(fmVarSide, function() { return effFreq(b); });
      return fa_ - fb_;
    });
    // startSigns aus den Track-Objekten extrahieren (single source of truth)
    const ssg = {};
    Object.keys(fmTracks).forEach(function(k) {
      ssg[fmTracks[k].electrodeIdx] = fmTracks[k].startSign || +1;
    });
    run = {
      runId:             new Date().toISOString(),
      startedAt:         Date.now(),
      completedAt:       null,
      varSide:           fmVarSide,
      refSide:           fmRefSide,
      electrodeIdxList:  elList,
      startSigns:        ssg,
      pairedToPrevious:  !!fmCurPairedToPrevious,
      tracks:            fmTracks,
      roundQueue:        fmRoundQueue.slice()
    };
    fa.runs.push(run);
    fa.currentRunIdx = fa.runs.length - 1;
  } else {
    // Bestehenden Lauf aktualisieren (Pause/Resume-Fall)
    run.tracks     = fmTracks;
    run.roundQueue = fmRoundQueue.slice();
  }

  _fmDbg('persist: run#' + fa.currentRunIdx + ', tracks=' + Object.keys(fmTracks).length);
}

function _fmMarkCompleted() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || fa.currentRunIdx == null) return;
  const run = fa.runs[fa.currentRunIdx];
  if (run) run.completedAt = Date.now();
}

function _fmClearPersist(side) {
  side = side || fmVarSide;
  if (side && sideData[side]) sideData[side].freqmatchAdaptive = null;
}

function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) return false;

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run) return false;
  if (run.completedAt != null) return false;            // letzter Lauf war fertig
  if (run.varSide !== fmVarSide || run.refSide !== fmRefSide) return false;
  if (!run.tracks) return false;

  const saved = (run.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
  const now   = currentElIdxList.slice().sort(function(a, b) { return a - b; });
  if (saved.length !== now.length) return false;
  for (let i = 0; i < saved.length; i++) if (saved[i] !== now[i]) return false;

  const hasActive = Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });
  if (!hasActive) return false;

  fmTracks     = run.tracks;
  fmRoundQueue = Array.isArray(run.roundQueue) ? run.roundQueue.slice() : [];
  _fmDbg('restore: run#' + fa.currentRunIdx + ', ' + Object.keys(fmTracks).length + ' tracks');
  return true;
}

function fmRefreshResumeHint() {
  if (!fmEls) return;
  const startBtn = fmEls.header && fmEls.header.startBtn;
  if (!startBtn) return;
  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;

  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
    return;
  }

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  const hasActive = run && run.tracks && Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });

  if (hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblResume')) || 'Test fortsetzen';
  } else {
    startBtn.textContent = (typeof t === 'function' && t('fmLblNewRun')) || 'Weiteren Lauf starten';
  }
}

// onStart-Hook für adaptive verfahren — ruft nach Dialog-Check _fmDoStartAdaptive.
let _fmTimerInterval = null;
let _fmTimerStartTs  = 0;

function _fmStartTimer() {
  _fmTimerStartTs = Date.now();
  _fmStopTimer();
  _fmTimerInterval = setInterval(_fmTickTimer, 1000);
  _fmTickTimer();
}
function _fmStopTimer() {
  if (_fmTimerInterval) {
    clearInterval(_fmTimerInterval);
    _fmTimerInterval = null;
  }
}
function _fmActiveProgress() {
  if (!fmEls || !fmEls.verfahren) return null;
  if (fmAdaptiveActive && fmEls.verfahren.adaptive)
    return fmEls.verfahren.adaptive.progress;
  if (fmRunning && fmEls.verfahren.slider)
    return fmEls.verfahren.slider.progress;
  return null;
}
function _fmTickTimer() {
  const secs = Math.floor((Date.now() - _fmTimerStartTs) / 1000);
  const mm   = Math.floor(secs / 60);
  const ss   = secs % 60;
  const txt  = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const _prog = _fmActiveProgress();
  if (_prog && _prog.timer) _prog.timer.textContent = txt;
}

// --- Shared Dispatchers ---

function fmUndo() {
  if (fmAdaptiveActive) { fmUndoAdaptive(); return; }
  if (!fmRunning || fmSeqIdx === 0) return;
  fmSeqIdx--;
  const prevEl = fmSeq[fmSeqIdx];
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store) delete store[String(prevEl)];
  fmRenderSliderStatusGrid();
  fmUpdateSliderProgress();
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}

// Nach 5 Min Inaktivität die Seitenabfrage erneut auslösen (statt den Test
// kommentarlos zu stoppen). Bei Erfolg wird der Idle-Watch neu gestartet,
// damit der Mechanismus nach jeder Bestätigung wieder aktiv ist; bei Abbruch
// durch den Nutzer wird der Test gestoppt.
function _fmStartIdleSideCheck() {
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (!fmRunning) return;
    testUI.sideCheck.run(
      { sides: 'both' },
      function() { _fmStartIdleSideCheck(); },
      function() { if (fmEls) fmEls._stopTest(); }
    );
  });
}

function fmAbort() {
  testUI.sideCheck.stopIdleWatch();
  _fmSimActive = false;
  fmPianoActive = false;
  if (fmAdaptiveActive) {
    _fmPersist();
    fmAdaptiveActive   = false;
    fmAwaitingResponse = false;
    fmIsPlay           = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    fmRunning          = false;
    fmCurTrackId       = null;
    _fmStopTimer();
    fmRefreshResumeHint();
    return;
  }
  fmIsPlay = false;
  if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
  _fmStopTimer();
  fmRunning   = false;
  fmCurrentEl = null;
  fmRefreshResumeHint();
}

// --- Klavier-Verfahren (A1: nur erste Elektrode, Tonwiedergabe) ---
function fmStartPiano() {
  if (!fmEls) return;
  _fmInitSides();
  if (fmSymmetric) {
    fmSeq = fmBuildSeqSymmetric();
    if (fmSeq === null) {
      alert((typeof t === 'function' && t('fmSymmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten muessen dieselben aktiven Elektroden haben.');
      fmEls._stopTest(); return;
    }
    if (!fmSeq.length) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden.');
      fmEls._stopTest(); return;
    }
  } else {
    fmSeq = fmBuildSeq();
    if (!fmSeq.length) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
      fmEls._stopTest(); return;
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartPiano,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}

// ===== Klavier-Verfahren — Mess-Engine (A2a) =====
var FM_PIANO_STEPS = [250, 100, 50, 25, 10, 5];

// Roh-Speicher der var-Seite holen/anlegen.
function _fmPianoData() {
  var sd = sideData[fmVarSide];
  if (!sd) return null;
  if (!sd.freqmatchPiano) sd.freqmatchPiano = { run: null, perElectrode: {} };
  return sd.freqmatchPiano;
}

function _fmRandBorderOrder() {
  return (Math.random() < 0.5) ? ['lower', 'upper'] : ['upper', 'lower'];
}

// Bestaetigten Grenzwert lesen (cent) oder null.
function _fmPianoBorderVal(elIdx, round, border) {
  var fp = _fmPianoData();
  var pe = fp && fp.perElectrode && fp.perElectrode[elIdx];
  var r  = pe && pe.rounds && pe.rounds[round];
  return (r && typeof r[border] === 'number') ? r[border] : null;
}

// Bezugswert fuer den Runden-Start: Vorrunden-Wert derselben Grenze.
function _fmPianoPrevBorder(elIdx, round, border) {
  if (round <= 1) return 0;
  var v = _fmPianoBorderVal(elIdx, round - 1, border);
  return (v == null) ? 0 : v;
}

// Grenze speichern.
function _fmPianoSetBorder(elIdx, round, border, cent) {
  var fp = _fmPianoData();
  if (!fp.perElectrode[elIdx]) fp.perElectrode[elIdx] = { rounds: {} };
  if (!fp.perElectrode[elIdx].rounds[round]) fp.perElectrode[elIdx].rounds[round] = { lower: null, upper: null };
  fp.perElectrode[elIdx].rounds[round][border] = cent;
}

// Lauf anlegen oder fortsetzen (Pause/Resume innerhalb der Sitzung).
function _fmPianoEnsureRun() {
  var fp = _fmPianoData();
  var elList = fmSeq.slice();
  var run = fp.run;
  if (!run || run.varSide !== fmVarSide || run.refSide !== fmRefSide
      || run.symmetric !== fmSymmetric) {
    run = {
      runId:        new Date().toISOString(),
      startedAt:    Date.now(),
      lastUpdate:   Date.now(),
      varSide:      fmVarSide,
      refSide:      fmRefSide,
      symmetric:    fmSymmetric,
      electrodeList: elList,
      currentRound: 1,
      roundOrder:   _fmShuffle(elList),
      posInRound:   0,
      borderOrder:  _fmRandBorderOrder(),
      posInBorder:  0
    };
    fp.run = run;
    fp.perElectrode = {};
  }
  // (Resume: bestehenden run unveraendert weiterlaufen lassen.)
}

function _fmDoStartPiano() {
  _fmPianoEnsureRun();
  fmPianoActive = true;
  fmRunning   = true;
  fmFirstSide = 'var';     // Kandidat zuerst, dann Vergleich
  _fmPianoLoadStep();
  _fmStartIdleSideCheck();
}

// Aktuelle (Elektrode, Grenze) laden: Tastatur stellen, Box-Rolle setzen.
function _fmPianoLoadStep() {
  var run = _fmPianoData().run;
  if (!run) return;
  if (run.posInRound >= run.roundOrder.length) { _fmPianoRoundTransition(); return; }

  var elIdx  = run.roundOrder[run.posInRound];
  var border = run.borderOrder[run.posInBorder];   // 'lower' | 'upper'
  var step   = FM_PIANO_STEPS[run.currentRound - 1];
  var center = _fmPianoPrevBorder(elIdx, run.currentRound, border);

  fmCurrentEl  = elIdx;
  fmCentOffset = center;

  var pr = _fmPianoRefs();
  if (pr && typeof testUI !== 'undefined' && testUI.piano) {
    testUI.piano.setRound(pr, { stepCent: step, centerCent: center, baseFreq: fmVarHz(elIdx) });
    // Bei Wiederholung (Zurueck) den zuvor bestaetigten Wert dieser Runde markieren.
    var prevThisRound = _fmPianoBorderVal(elIdx, run.currentRound, border);
    if (prevThisRound != null) {
      _fmPianoMarkCent(pr, prevThisRound);
      fmCentOffset = prevThisRound;
    }
  }
  // Zurueck-Knopf aktivieren, wenn in der Runde etwas zurueckliegt (BA356-fix).
  var _ub = fmEls && fmEls.verfahren && fmEls.verfahren.piano
    && fmEls.verfahren.piano.actions && fmEls.verfahren.piano.actions.undo;
  if (_ub) _ub.disabled = !(run.posInRound > 0 || run.posInBorder > 0);

  _fmPianoUpdateBoxes(border);
}

// Eine Taste markieren, die dem Cent-Wert entspricht (falls im Fenster).
function _fmPianoMarkCent(pr, cent) {
  var rel = (cent - pr.originCent) / pr.stepCent;
  var w = Math.round(rel);
  if (Math.abs(rel - w) < 0.01 && w >= 0 && w <= 8) {
    testUI.piano.markSlot(pr, w, false); return;
  }
  var b = Math.floor(rel);
  if (Math.abs(rel - (b + 0.5)) < 0.01 && b >= 0 && b <= 7) {
    testUI.piano.markSlot(pr, b, true);
  }
}

// Anschlag aus dem Baustein.
function fmPianoOnPlay(evt) {
  if (!fmRunning || fmCurrentEl === null) return;
  fmCentOffset = (evt && typeof evt.cent === 'number') ? evt.cent : 0;
  fmPlayCurrent();
}

// Grenze bestaetigen: zuletzt gespielten Tasten-Offset speichern, weiter.
function fmPianoConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  var run = _fmPianoData().run;
  if (!run) return;
  var pr = _fmPianoRefs();
  if (!pr || pr.markedAbsCent == null) return;   // noch keine Taste gespielt

  var elIdx  = run.roundOrder[run.posInRound];
  var border = run.borderOrder[run.posInBorder];
  _fmPianoSetBorder(elIdx, run.currentRound, border, pr.markedAbsCent);
  run.lastUpdate = Date.now();

  run.posInBorder++;
  if (run.posInBorder >= 2) {
    run.posInBorder = 0;
    run.borderOrder = _fmRandBorderOrder();
    run.posInRound++;
  }
  if (run.posInRound >= run.roundOrder.length) _fmPianoRoundTransition();
  else                                          _fmPianoLoadStep();
}

// Zurueck: in der laufenden Runde eine Elektrode zurueck (bzw. aktuelle
// Elektrode neu beginnen). Eine abgeschlossene Runde wird nicht aufgerollt.
function fmPianoBack() {
  if (!fmRunning) return;
  var run = _fmPianoData().run;
  if (!run) return;
  if (run.posInBorder > 0) {
    run.posInBorder = 0;
    run.borderOrder = _fmRandBorderOrder();
  } else if (run.posInRound > 0) {
    run.posInRound--;
    run.posInBorder = 0;
    run.borderOrder = _fmRandBorderOrder();
  } else {
    return; // Rundenanfang: nichts
  }
  _fmPianoLoadStep();
}

// Runden-Uebergang: Modal (Runden 1..5) oder direkter Abschluss (nach Runde 6).
function _fmPianoRoundTransition() {
  var run = _fmPianoData().run;
  if (!run) return;
  if (run.currentRound >= FM_PIANO_STEPS.length) { _fmPianoFinish(); return; }
  var curStep  = FM_PIANO_STEPS[run.currentRound - 1];
  var nextStep = FM_PIANO_STEPS[run.currentRound];
  _fmPianoShowRoundModal(run.currentRound, FM_PIANO_STEPS.length, curStep, nextStep,
    function onNext() {
      run.currentRound++;
      run.roundOrder  = _fmShuffle(run.electrodeList);
      run.posInRound  = 0;
      run.borderOrder = _fmRandBorderOrder();
      run.posInBorder = 0;
      _fmPianoLoadStep();
    },
    function onFinish() { _fmPianoFinish(); }
  );
}

function _fmPianoFinish() {
  fmRunning = false;
  // A2a: nur beenden. Ergebnis (Mittelwert -> fRes) + Abschluss-Box kommen in B.
  if (fmEls && typeof fmEls._stopTest === 'function') fmEls._stopTest();
}

// Boxen: Kandidat (var) zeigt Elektrode + Rolle; Referenz zeigt Vergleichston.
function _fmPianoUpdateBoxes(border) {
  var pi = _fmPianoPI();
  var elLabel = withSide(fmVarSide, function() { return dENPrefix() + dEN(fmCurrentEl); });
  var roleUp  = (border === 'lower') ? t('fmPianoBoxLower') : t('fmPianoBoxHigher');
  if (pi) {
    pi.left.textContent  = elLabel + ' — ' + roleUp;
    pi.right.textContent = t('fmPianoRefBox');
  }
  var instr = fmEls && fmEls.verfahren && fmEls.verfahren.piano && fmEls.verfahren.piano.instruction;
  if (instr) {
    instr.textContent = t('fmPianoInstruction').replace('{role}', roleUp.toLowerCase());
  }
}

// Runden-Uebergangs-Modal.
function _fmPianoShowRoundModal(round, total, curStep, nextStep, onNext, onFinish) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);'
    + 'display:flex;align-items:center;justify-content:center;z-index:9999;';
  var box = document.createElement('div');
  box.className = 'modal-box';
  box.style.cssText = 'background:#fff;color:var(--text);padding:18px 22px;border-radius:8px;'
    + 'min-width:300px;max-width:90vw;box-shadow:0 10px 30px rgba(0,0,0,.3);';
  var h = document.createElement('h3');
  h.style.cssText = 'margin:0 0 8px;font-size:1.05em;';
  h.textContent = t('fmPianoRoundDoneTitle').replace('{x}', round).replace('{y}', total);
  var p = document.createElement('p');
  p.style.cssText = 'margin:0 0 16px;line-height:1.5;';
  p.textContent = t('fmPianoRoundDoneMsg').replace('{n}', curStep).replace('{m}', nextStep);
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  var bFin = document.createElement('button');
  bFin.className = 'btn btn-sm';
  bFin.textContent = t('fmPianoRoundFinish');
  var bNext = document.createElement('button');
  bNext.className = 'btn btn-sm btn-primary';
  bNext.textContent = t('fmPianoRoundNext');
  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  bFin.addEventListener('click', function() { close(); onFinish(); });
  bNext.addEventListener('click', function() { close(); onNext(); });
  row.append(bFin, bNext);
  box.append(h, p, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function fmFinish() {
  fmIsPlay    = false;
  _fmStopTimer();
  fmRunning   = false;
  fmCurrentEl = null;
  if (fmEls && fmEls._stopTest) fmEls._stopTest();
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
}

// --- Elektroden-Ausschluss ---
function _fmRequestExcl() {
  if (!fmRunning || fmCurrentEl === null || !fmEls) return;
  setTestExclConfirm(fmEls.exclOverlay, fmDEN(fmCurrentEl), function() {
    withSide(fmVarSide, () => { elExDur[fmCurrentEl] = true; });
    fmSkip();
  });
}

// --- Slider-Handler ---
function fmHandleSlider(val) {
  fmCentOffset = parseFloat(val);
  fmUpdateSliderDisplay();
  fmRenderSliderStatusGrid();
}

// --- i18n-Aktualisierung ---
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}

function _fmEvalTestEligibility() {
  // BA 155: „Keine Angabe" / Hersteller-fehlend
  if (typeof isSideUsable === 'function') {
    if (!isSideUsable('left') || !isSideUsable('right')) {
      return { blocked: true, reason: 'sideUnknown' };
    }
  }
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  if (leftCfg === 'deaf' || rightCfg === 'deaf') {
    return { blocked: true, reason: 'sideDeaf' };
  }
  function isAcoustic(c) { return c === 'normal' || c === 'shoh' || c === 'hg'; }
  if (isAcoustic(leftCfg) && isAcoustic(rightCfg)) {
    return { blocked: true, reason: 'bothAcoustic' };
  }
  return { blocked: false, reason: null };
}

function _fmAutoSetRefMode() {
  if (!fmEls || !fmEls.header || !fmEls.header.refSelect) return;
  // Schutz: solange Daten vorliegen, refSelect nicht implizit umstellen —
  // ein manueller Wechsel ist durch depLock gesperrt (Popup mit Begründung).
  if (fRes.length > 0) return;
  if (_fmHasAdaptiveData()) return;
  if (_fmHasSliderEstimates()) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const leftIsCI  = (leftCfg  === 'ci');
  const rightIsCI = (rightCfg === 'ci');
  if (leftIsCI && !rightIsCI) {
    fmEls.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    fmEls.header.refSelect.value = 'left';
  } else if (leftIsCI && rightIsCI) {
    // Beide CI: 'symmetric' setzen, sofern die Dropdown-Option existiert.
    const hasSym = Array.from(fmEls.header.refSelect.options).some(function(o) {
      return o.value === 'symmetric';
    });
    if (hasSym) fmEls.header.refSelect.value = 'symmetric';
  }
  // beide akustisch: kein Override (Sperre wird durch L1-Tab-Sperre BA 172 behandelt).
}

function _fmRefreshHGWarningVisibility() {
  if (!fmEls) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen, wenn Test nicht ohnehin geblockt ist.
  const blocked = _fmEvalTestEligibility().blocked;
  const visible = hasHG && !blocked;
  testUI.explain.setVisible(fmEls, 'fmHGWarnPara', visible);
}


// BA 251: jRes entfaellt; Lautstaerke-Daten = bRes.
function _fmHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0);
}

function _fmRenderPrereqHints() {
  const lvLeftEl  = document.getElementById('fmPrereqLvLeftPara');
  const lvRightEl = document.getElementById('fmPrereqLvRightPara');
  const sbEl      = document.getElementById('fmPrereqSbHintPara');
  if (lvLeftEl)  lvLeftEl.style.display  = _fmHasLvData('left')  ? 'none' : '';
  if (lvRightEl) lvRightEl.style.display = _fmHasLvData('right') ? 'none' : '';
  if (sbEl) {
    const hasSb = typeof lrResults !== 'undefined'
               && lrResults
               && Object.keys(lrResults).length > 0;
    sbEl.style.display = hasSb ? 'none' : '';
  }
}

function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}

function _fmHasSliderEstimates() {
  return ['left', 'right'].some(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    const est = fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates;
    return !!(est && Object.keys(est).length > 0);
  });
}

function _fmHasAdaptiveData() {
  return ['left', 'right'].some(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    return !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
      return r.tracks && Object.keys(r.tracks).some(function(k) {
        return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
      });
    }));
  });
}

// BA353: Aktives Frequenzabgleich-Verfahren.
// Bestimmt, welches Verfahren Ergebnisgraph, Player (Warp) und Druck speist.
// null = noch nicht gesetzt -> Default wird aus den Daten abgeleitet.
let fmActiveMethodVal = null;

// Method-Kennung eines Eintrags. Konvention: nur "slider" ist Schieber,
// alles andere (inkl. fehlend) zaehlt als "adaptive" (Altstaende ohne Feld).
function fmEntryMethod(r) {
  return (r && r.method === "slider") ? "slider" : "adaptive";
}

// Hat ein Verfahren ueberhaupt Daten? (fuer Default-Ableitung)
function fmMethodHasData(method) {
  if (typeof fRes !== "undefined" && Array.isArray(fRes)) {
    for (let i = 0; i < fRes.length; i++) {
      if (fRes[i] && fmEntryMethod(fRes[i]) === method) return true;
    }
  }
  const sides = ["left", "right"];
  for (let s = 0; s < sides.length; s++) {
    const fa = sideData[sides[s]] && sideData[sides[s]].freqmatchAdaptive;
    if (!fa) continue;
    if (method === "slider") {
      if (fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0) return true;
    } else {
      if (Array.isArray(fa.runs) && fa.runs.some(function (r) {
        return r && r.tracks && Object.keys(r.tracks).some(function (k) {
          return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
        });
      })) return true;
    }
  }
  return false;
}

// Aktiv geltendes Verfahren. Default (alte/ungesetzte Staende):
// Adaptiv, falls es Werte hat; sonst Schieber, falls dieser Werte hat;
// sonst Adaptiv (rein kosmetisch, da ohne Daten keine Anzeige).
function fmGetActiveMethod() {
  if (fmActiveMethodVal === "adaptive" || fmActiveMethodVal === "slider") {
    return fmActiveMethodVal;
  }
  if (fmMethodHasData("adaptive")) return "adaptive";
  if (fmMethodHasData("slider"))   return "slider";
  return "adaptive";
}

// EINZIGE Schreibstelle fuer den Aktiv-Zustand. "Letzte Aktion gewinnt":
// jede Bestaetigung (Trigger) und jeder Button-Klick ruft das hier.
// Refresh (Graph + Player-Warp) nur bei echtem Wechsel.
function fmSetActiveMethod(m) {
  if (m !== "adaptive" && m !== "slider") return;
  const changed = (fmActiveMethodVal !== m);
  fmActiveMethodVal = m;
  if (typeof fmUpdActiveMethodButtons === "function") fmUpdActiveMethodButtons();
  if (!changed) return;
  if (typeof renderFreqMatchResults === "function") {
    try { renderFreqMatchResults(); } catch (e) {}
  }
  if (typeof pWarpTrigger === "function") {
    try { pWarpTrigger(); } catch (e) {}
  }
}

// Hervorhebung der zwei Umschalt-Buttons (Vorbild: updPlSrcButtons).
function fmUpdActiveMethodButtons() {
  const method = fmGetActiveMethod();
  const map = [
    { id: "fmActiveMethodAdaptiveBtn", m: "adaptive" },
    { id: "fmActiveMethodSliderBtn",   m: "slider" }
  ];
  for (let i = 0; i < map.length; i++) {
    const btn = document.getElementById(map[i].id);
    if (!btn) continue;
    if (map[i].m === method) {
      btn.style.background  = "var(--success)";
      btn.style.color       = "#fff";
      btn.style.borderColor = "var(--success)";
    } else {
      btn.style.background  = "#e5e7eb";
      btn.style.color       = "var(--text)";
      btn.style.borderColor = "var(--border)";
    }
  }
}

let _fmDurStash_slider  = 400;
let _fmPauStash_slider  = 400;

function fmSetVerfahren(newVerfahren, opts) {
  opts = opts || {};
  if (newVerfahren !== 'slider' && newVerfahren !== 'adaptive' && newVerfahren !== 'piano') return;
  if (newVerfahren === fmVerfahren && !opts.force) return;

  const oldVerfahren = fmVerfahren;
  fmVerfahren = newVerfahren;

  if (!fmEls || !fmEls.header) return;

  // BA 240: Dur/Pau-Stash arbeitet jetzt auf State-Variablen statt DOM-Inputs.
  if (oldVerfahren === 'slider') {
    _fmDurStash_slider = duration_freqmatch || 400;
    _fmPauStash_slider = pause_freqmatch    || 400;
  }
  if (newVerfahren === 'slider') {
    duration_freqmatch = _fmDurStash_slider;
    pause_freqmatch    = _fmPauStash_slider;
  }

  testUI.verfahren.select(fmEls, newVerfahren);
  fmRefreshResumeHint();
}

function fmLoadVerfahrenFromSide() {
  if (!fmEls) return;
  const _refVal = fmEls.header.refSelect.value;
  fmSymmetric = (_refVal === 'symmetric');
  if (fmSymmetric) {
    fmVarSide = 'left';
    fmRefSide = 'right';
  } else {
    fmRefSide = _refVal;
    fmVarSide = (fmRefSide === 'left') ? 'right' : 'left';
  }

  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;
  const hasAdaptive = !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
    return r.tracks && Object.keys(r.tracks).some(function(k) {
      return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
    });
  }));

  if (hasAdaptive) {
    fmSetVerfahren('adaptive', { force: true });
  }

  fmRefreshResumeHint();
}

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const parentEl = document.getElementById("subpanel-messungen-freqmatch");
  if (!parentEl) return;
  _fmParentEl = parentEl;

  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'fmTitle',
      // BA 220: preserveOrder, damit Gruppen-Headings, Methodentext und
      // zugehoerige Warnung visuell zusammenstehen statt durch die
      // Schwere-Sortierung gemischt zu werden.
      preserveOrder: true,
      paragraphs: [
        { key: 'fmMaturityHint',         kind: 'caution' },

        // Warn-Absaetze, deren Sichtbarkeit dynamisch umgeschaltet wird
        // (Initial hidden=true; testUI.explain.setVisible blendet bei Bedarf ein).
        { key: 'fmHGWarn',               kind: 'warn',    id: 'fmHGWarnPara',
                                         hidden: true },
        { key: 'fmCochlearFatCorrectionInfo', kind: 'warn', id: 'fmCochlearFatHintPara',
                                         hidden: true },

        // Voraussetzungen — bleiben bedingt sichtbar (durch _fmRenderPrereqHints).
        { key: 'fmPrereqLvLeft',         kind: 'warn',    id: 'fmPrereqLvLeftPara'    },
        { key: 'fmPrereqLvRight',        kind: 'warn',    id: 'fmPrereqLvRightPara'   },
        { key: 'fmPrereqSb',             kind: 'warn',    id: 'fmPrereqSbHintPara'    },

        // Gruppe 1: beidseitiges CI.
        { key: 'fmGroupBothCi',          kind: 'heading' },
        { key: 'fmHintMethodBothCI',     kind: 'plain' },
        { key: 'fmHintWarnBothCI',       kind: 'caution' },

        // Gruppe 2: CI + akustische Gegenseite.
        { key: 'fmGroupCiAcoustic',      kind: 'heading' },
        { key: 'fmHintMethodCiNatural',  kind: 'plain' },
        { key: 'fmHintWarn',             kind: 'caution' },

        { key: 'fmHintWorkflow',         kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect:    { type: 'side', key: 'fmLblRef', includeSymmetric: true },
        // BA 240: Vol/Dur/Pau leben jetzt im Tonauswahl-Modal, nicht mehr im Header.
        volume:       false,
        duration:     false,
        pause:        false,
        // BA 209: Tonart-Dropdown durch tonePopupButton ersetzt.
        toneType:     false,
        tonePopupButton: {
          getToneType: function() { return toneType_freqmatch; },
          setToneType: function(tt) { toneType_freqmatch = tt; },
          // BA 230: Klavier-Bug-Fix — Modal teilt die aktuell angeklickte
          // Tonart mit; onPress liest fmModalTone mit Fallback auf toneType_freqmatch.
          onToneSelected:  function(tt) { fmModalTone = tt; },
          onModalClose:    function()   { fmModalTone = null; fmKbdCorrectVol = null; },
          onTogglesReady:  function(fn) { fmKbdCorrectVol = fn; },
          // BA 304: Korrektur-Schalter auch im Frequenzabgleich zeigen.
          showToggles:  true,
          // BA 240: Vol/Dur/Pau-Felder in der Modal aktivieren.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function() { return volume_global; },
          setVolumePercent: function(v) { volume_global = v; },
          getDurationMs:    function() { return duration_freqmatch; },
          setDurationMs:    function(v) { duration_freqmatch = v; },
          getPauseMs:       function() { return pause_freqmatch; },
          setPauseMs:       function(v) { pause_freqmatch = v; },
          // BA 240: Hint-Text fuer Test-Verfahren.
          hintKey: 'tonePopupHint',
          getVolume:   function() { return fmGVol(); },
          getPreviewSequence: function (lastHz) {
            // Slider-Modus laeuft -> echte Sequenz. Sonst (inkl. Adaptiv-Modus)
            // gemerkter Ton, beide Seiten nacheinander (Vergleichs- dann
            // Referenz-Seite).
            if (fmRunning && fmCurrentEl != null && !fmAdaptiveActive) {
              return fmSequence({ aba: fmGAba() });
            }
            // BA 301: jede Seite mit zentraler Korrektur (Elektrodenlautstaerke
            // + Balance); taube Seite stumm (isDeaf) wie beim Klavier.
            var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
            var vol = fmGVol();
            var dur = fmGDur();
            var pau = fmGPau();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide) ? fmVarSide : activeSide;
            var refSide = (varSide === 'left') ? 'right' : 'left';
            var varPan  = (varSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an);
            // taube Seite stumm (isDeaf) wie beim Klavier. pan kodiert die Seite.
            var _fmCv = function (side, pan) {
              if (typeof isDeaf === 'function' && isDeaf(side)) return 0;
              return (typeof fmKbdCorrectVol === 'function') ? fmKbdCorrectVol(vol, hz, pan) : vol;
            };
            return [
              { hz: hz, pan: varPan,  vol: _fmCv(varSide, varPan),  durationMs: dur },
              { pauseMs: pau },
              { hz: hz, pan: -varPan, vol: _fmCv(refSide, -varPan), durationMs: dur }
            ];
          },
          // BA 228/229: Klavier-Widget in der Modalbox aktivieren.
          // BA 252: beidseitige Disabled-Logik, kein elActive-Filter hier.
          keyboardMode: true,
          getElectrodeFreqs: function() {
            // Anzahl Tasten = Minimum aus var- und ref-Seite.
            // Frequenzen kommen von der var-Seite (CI-Seite im
            // Frequenzabgleich-Kontext). Kein Filter auf
            // elActive/elExDur -- das macht getDisabledElectrodes.
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var freqs = [];
            withSide(vSide, function() {
              for (var i = 0; i < n; i++) freqs.push(effFreq(i));
            });
            return freqs;
          },
          getElectrodeLabels: function() {
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var labels = [];
            withSide(vSide, function() {
              var prefix = dENPrefix();
              for (var i = 0; i < n; i++) labels.push(prefix + dEN(i));
            });
            return labels;
          },
          getDisabledElectrodes: function() {
            // Disabled = auf var- ODER ref-Seite abgewaehlt
            // (elActive === false) oder ausgeschlossen (elExDur !== null).
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var sdV = sideData[vSide], sdR = sideData[rSide];
            if (!sdV || !sdR) return [];
            var n = Math.min(sdV.nEl || 0, sdR.nEl || 0);
            var dis = [];
            for (var i = 0; i < n; i++) {
              var off = (sdV.elActive && sdV.elActive[i] === false)
                     || (sdV.elExDur  && sdV.elExDur[i]  != null)
                     || (sdR.elActive && sdR.elActive[i] === false)
                     || (sdR.elExDur  && sdR.elExDur[i]  != null);
              if (off) dis.push(i);
            }
            return dis;
          },
          // BA 229: Aufleucht-Dauer = volle Sequenz (Var-Burst + Pause +
          // Ref-Burst), passt zur Anschlag-Logik in onPress.
          getHighlightMs: function() { return fmGDur() * 2 + fmGPau(); },
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _fmKbT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt      = (fmModalTone !== null) ? fmModalTone : toneType_freqmatch;
            var vol     = fmGVol();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide) ? fmVarSide : activeSide;
            var varPan  = (varSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volVar  = isDeaf(varSide) ? 0
              : ((typeof fmKbdCorrectVol === 'function') ? fmKbdCorrectVol(vol, hz, varPan) : vol);
            try {
              playToneTyped(c, hz, volVar, 60000, varPan, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (typeof stopAll === 'function') stopAll();
            if (!c) return;
            var t1   = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var held = Math.max(0, t1 - _fmKbT0);
            if (held <= 0) return;
            var tt      = (fmModalTone !== null) ? fmModalTone : toneType_freqmatch;
            var vol     = fmGVol();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide) ? fmVarSide : activeSide;
            var refSide = (varSide === 'left') ? 'right' : 'left';
            var refPan  = (varSide === 'left') ? 1 : -1;
            // Eingestellte Frequenz der Elektrode auf der Ref-Seite (kann
            // sich von der Var-Seite unterscheiden).
            var hzRef;
            if (electrodeIdx >= 0) {
              var rN = sideData[refSide] ? sideData[refSide].nEl : 0;
              var rIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzRef = withSide(refSide, function () { return effFreq(rIdx); });
            } else {
              hzRef = hz;
            }
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volRef = isDeaf(refSide) ? 0
              : ((typeof fmKbdCorrectVol === 'function') ? fmKbdCorrectVol(vol, hzRef, refPan) : vol);
            try {
              playToneTyped(c, hzRef, volRef, held, refPan, tt);
            } catch (e) { /* swallow */ }
          }
        },
        sequence:     { show: true, source: 'global' },
        sliderTarget: false,
        // BA 207: Auswahl-Komponente. FreqMatch braucht >= 1 Elektrode.
        electrodeSelection: {
          minSelected: 1,
          getSelection: function() { return freqmatchTestSelection; },
          setSelection: function(sel) {
            freqmatchTestSelection = sel.slice();
            _fmOnSelectionChanged();
          },
          getElectrodeStatus: function() {
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < nEl; i++) {
              if (elExDur[i] != null)         excluded.push(i);
              else if (elActive[i] === false) muted.push(i);
              else                            testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            return dENPrefix() + dEN(i);
          }
        }
      },
      startStop: { startKey: 'fmLblStart', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [
      {
        id: 'slider',
        labelKey:   'fmModeSlider',
        explainKey: 'fmExplainSlider',
        body: {
          pairIndicator: { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:      { format: 'simple' },
          instruction:   { key: 'fmSliderInstruction' },
          keyHint:       { unitKey: 'sliderHintCent' },
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1, rangeHint: true },
          sliderValue:   { show: true },
          confirmButton: { key: 'btnConfirmOffset' },
          actions:       ['undo', 'replay', 'simul', 'pause'],
          statusGrid:    { show: true },
          background: {
            bodyKey:    'fmExplainSliderScience',
            bodyAsHtml: true
          },
          debugRun:      { key: 'btnDebugRun' }
        },
        hooks: {
          onStart:    fmStartSlider,
          onStop:     fmAbort,
          onPause:    fmPauseSlider,
          onSlide:    fmHandleSlider,
          onConfirm:  fmConfirm,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndo,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunSliderDebugSim
        }
      },
      {
        id: 'adaptive',
        labelKey:   'fmModeAdaptive',
        explainKey: 'fmExplainAdaptive',
        body: {
          pairIndicator:   { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          progress:        { format: 'simple' },
          instruction:     { key: 'hjPrompt' },
          decisionButtons: { variant: 'updown' },
          statusGrid:      { show: true },
          actions:         ['undo','replay','simul'],
          background: {
            bodyKey:    'fmExplainAdaptiveScience',
            bodyAsHtml: true
          },
          debugRun: { key: 'btnDebugRun' }
        },
        // BA 222: Vortest-Empfehlung. Verletzt, wenn fuer keine einzige
        // testbare Elektrode eine Slider-Schaetzung vorliegt. TestUI
        // oeffnet vor onStart ein Modal mit drei Optionen.
        prerequisites: [
          {
            checkFn:    function() { return !_fmShouldOfferSliderEstimate(); },
            titleKey:   'fmSliderEstimateTitle',
            messageKey: 'fmSliderEstimateMsg',
            actions: [
              {
                labelKey: 'fmSliderEstimateBtnSlider',
                kind:     'custom',
                run:      function() { fmSetVerfahren('slider'); }
              },
              {
                labelKey: 'fmSliderEstimateBtnSkip',
                kind:     'continue'
              },
              {
                labelKey: 'fmSliderEstimateBtnCancel',
                kind:     'abort'
              }
            ]
          }
        ],
        hooks: {
          onStart:    fmStartAdaptive,
          onStop:     fmAbort,
          onDecision: fmHandleHeight,
          onReplay:   fmPlayCurrent,
          onUndo:     fmUndoAdaptive,
          onSimul:    fmPlaySimultaneous,
          onDebugRun: fmRunDebugSim
        }
      }
      ,{
        id: 'piano',
        labelKey:   'fmModePiano',
        explainKey: 'fmExplainPiano',
        body: {
          pairIndicator: { variant: 'token', leftKey: 'fmTone1', rightKey: 'fmTone2' },
          instruction:   { key: 'fmPianoInstruction' },
          piano:         {},
          confirmButton: { key: 'fmPianoConfirm' },
          actions:       ['undo', 'replay', 'simul']
        },
        hooks: {
          onStart:     fmStartPiano,
          onStop:      fmAbort,
          onPianoPlay: fmPianoOnPlay,
          onConfirm:   fmPianoConfirm,
          onUndo:      fmPianoBack,
          onReplay:    fmPlayCurrent,
          onSimul:     fmPlaySimultaneous
        }
      }
    ]
  };

  fmEls = buildTestPanel(parentEl, fmCfg);

  // Events: Referenzseiten-Wechsel (BA 151: Sperre statt Custom-Dialog)
  fmEls.header.refSelect.addEventListener('change', function() {
    setTimeout(fmLoadVerfahrenFromSide, 0);
  });

  // Texte initial setzen
  fmApplyLang();

  if (!fmRunning) _fmAutoSetRefMode();
  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
});

function fmRefreshElectrodeSelectionSummary() {
  if (fmEls && fmEls.header && typeof fmEls.header.electrodeSelectionUpdate === 'function') {
    fmEls.header.electrodeSelectionUpdate();
  }
}

// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function fmRefreshToneTypeLabel() {
  if (fmEls && fmEls.header && typeof fmEls.header.tonePopupUpdate === 'function') {
    fmEls.header.tonePopupUpdate();
  }
}
