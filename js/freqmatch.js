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
let frq_modalTone = null;   // BA 230: live-Tonart waehrend des Tonauswahl-Modals; null = kein Modal offen
let frq_keyboardCorrectVolume = null; // BA 239: Korrektorfunktion(vol,hz,pan) aus Modal-Toggles; null = kein Modal offen
let _fmKbT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
let FRQ_running = false;
let FRQ_els = null;
let FRQ_refSide = "left";
let frq_varSide = "right";
let frq_symmetric = false;   // true wenn refSelect.value === 'symmetric'
let frq_verfahren = 'piano';   // 'slider' | 'adaptive' | 'piano' — realer Default (Klavier-only-Betrieb, BA363)
let frq_sequence = [];
let frq_sequenceIdx = 0;
let frq_currentEl = null;
let frq_centOffset = 0;
let frq_firstSide = "ref";
let frq_isPlaying = false;
let frq_playTimeout = null;

// Adaptiver Modus (Bauanleitung 02b/4)
let frq_adaptiveActive   = false;
let frq_pianoActive      = false;   // true waehrend eines laufenden Klaviertests (BA356-fix)
let frq_awaitingResponse = false;
let frq_tracks           = {};
let frq_roundQueue       = [];   // geshuffelter Round-Robin-State
let frq_currentTrackId       = null;
let frq_lastPickedTrackId = null;   // Wiederholungs-Sperre für Anker-Randomisierung
let frq_currentFirstSide     = 'ref';
let frq_trialStartTs     = 0;
// Gepaartes Bracketing-State für den aktuell startenden/laufenden Lauf
// (wird in frq_startAdaptive berechnet und in _fmPersist in den Lauf geschrieben).
let frq_currentPairedToPrevious = false;
// Catch-Trial-Info des aktuellen Trials (Bauanleitung 02b/6)
let frq_currentCatchInfo = null;   // null | { direction: +500|-500, expectedResponse: 'var-higher'|'var-lower' }

// Undo-Support für adaptiven Modus
let _fmUndoSnapshot = null;  // Track-State-Snapshot vor letzter Antwort
let _fmNextTrialTO  = null;  // Timeout-Handle für frq_nextAdaptiveTrial (canceln bei Undo)

// Debug-Simulation
let _fmSimActive  = false;
let _fmSimOffsets = {};   // electrodeIdx → simulierter Wahrnehmungs-Offset (Cent, pos oder neg)
let _fmParentEl = null;   // gesetzt im DOMContentLoaded

// BA 207: Selektion der zu testenden Elektroden.
// null  = Default (= alle aktiven Elektroden testen).
// []    = Nutzer hat explizit nichts ausgewählt (Test startet nicht).
// [...] = explizite Auswahl. Filter greift in frq_buildSequence / frq_buildSequenceSymmetric.
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
  const sd = sideData[frq_varSide];
  if (!sd) return false;
  const fa = sd.freqmatchAdaptive;
  if (fa && Array.isArray(fa.runs) && fa.runs.length > 0) return false;
  const store = _fmEnsureSliderStore(frq_varSide);
  if (!store) return false;
  const seq = frq_buildSequence();
  for (var i = 0; i < seq.length; i++) {
    if (store[String(seq[i])] != null) return false;
  }
  return seq.length > 0;
}

// --- Track-Key-Schema: Key = String(electrodeIdx). Pro Lauf eine
// Staircase je Elektrode (Bracketing über Läufe statt parallel).
function FRQ_trackKey(electrodeIdx) {
  return String(electrodeIdx);
}
function frq_parseTrackKey(key) {
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

function _fmShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// BA 362: Letzter/aktueller Slider-Wert dieser Elektrode (= Startwert).
function _fmLastRoundCent(elIdx) {
  const store = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive)
    ? sideData[frq_varSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return null;
  const e = store[String(elIdx)];
  if (!e || typeof e.cent !== 'number' || !isFinite(e.cent)) return null;
  return e.cent;
}

// --- Hilfsfunktionen ---
function frq_cents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function frq_freqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

function _fmShouldShowCochlearFatHint() {
  if (typeof FRQ_resultsArray === 'undefined' || !Array.isArray(FRQ_resultsArray)) return false;
  if (typeof sideData === 'undefined') return false;
  if (typeof COCHLEAR_FAT_CORRECTION_DATE !== 'number') return false;
  for (let i = 0; i < FRQ_resultsArray.length; i++) {
    const e = FRQ_resultsArray[i];
    if (!e || typeof e.timestamp !== 'number') continue;
    if (e.timestamp >= COCHLEAR_FAT_CORRECTION_DATE) continue;
    const sd = sideData[e.varSide];
    if (sd && sd.manufacturer === 'cochlear') return true;
  }
  return false;
}

function _fmRefreshCochlearFatHintVisibility() {
  if (!FRQ_els) return;
  const visible = _fmShouldShowCochlearFatHint();
  testUI.explain.setVisible(FRQ_els, 'fmCochlearFatHintPara', visible);
  // Datum in den Text einsetzen (jedes Mal frisch, falls Sprache wechselt).
  if (visible) {
    const el = FRQ_els.explainBox && FRQ_els.explainBox.querySelector('#fmCochlearFatHintPara');
    if (el) {
      const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
      const dateStr = d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
      const txt = (typeof t === 'function') ? t('FRQ_cochlearFatCorrectionInfo')
        : 'Cochlear-FAT wurde korrigiert.';
      el.textContent = txt.replace('{date}', dateStr);
    }
  }
}

function FRQ_getVolume() {
  return Math.pow(volume_global / 100, 2);
}
function FRQ_getDuration() {
  return duration_freqmatch || 750;
}
function FRQ_getPause() {
  return pause_freqmatch || 400;
}

// Helfer: Verfahren-Refs
function _fmAdaptPI() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.adaptive && FRQ_els.verfahren.adaptive.pairIndicator;
}
function _fmSliderPI() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.slider && FRQ_els.verfahren.slider.pairIndicator;
}
function _fmPianoPI() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.pairIndicator;
}
// Referenzen des Klavier-Bausteins (refs.piano im Verfahren 'piano').
function _fmPianoRefs() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.piano;
}
// Ton-Boxen des aktiven Verfahrens (fuer setPlaying-Aufleuchten).
function _fmActivePI() {
  if (frq_adaptiveActive) return _fmAdaptPI();
  if (frq_pianoActive) return _fmPianoPI();
  return _fmSliderPI();
}
function _fmAdaptUndo() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.adaptive && FRQ_els.verfahren.adaptive.actions && FRQ_els.verfahren.adaptive.actions.undo;
}
function _fmSliderUndo() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.slider && FRQ_els.verfahren.slider.actions && FRQ_els.verfahren.slider.actions.undo;
}
function frq_isAbaSequence() {
  return sequence_freqmatch === "aba";
}

function FRQ_correctionGain(side, hz) {
  // BA 303: dedupliziert -- die Interpolations-Logik liegt jetzt zentral
  // in measGain (test.js). FRQ_correctionGain bleibt als benannter Aufrufer fuer
  // die Frequenzabgleich-Sequenzen erhalten.
  return (typeof measGain === "function") ? measGain(side, hz) : 1;
}

// Frequenz der variablen Seite (CI) für Elektrode elIdx
function frq_varHz(elIdx) {
  return withSide(frq_varSide, () => effFreq(elIdx));
}
// Anzeigenummer der Elektrode
function frq_varSideElectrodeLabel(elIdx) {
  return withSide(frq_varSide, () => dEN(elIdx));
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

function frq_buildSequence() {
  const elList = withSide(frq_varSide, () => {
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
function frq_buildSequenceSymmetric() {
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
  if (frq_adaptiveActive && typeof _fmApplySelectionToTracks === 'function') {
    _fmApplySelectionToTracks();
    // Statusgrid neu zeichnen, falls existiert.
    if (typeof frq_renderStatusGrid === 'function') frq_renderStatusGrid();
  }
  if (FRQ_running && !frq_adaptiveActive && typeof _fmApplySelectionToSliderRun === 'function') {
    _fmApplySelectionToSliderRun();
    if (typeof frq_updateSliderProgress === 'function') frq_updateSliderProgress();
  }

  // Header-Summary nach-rendern
  if (FRQ_els && FRQ_els.header && typeof FRQ_els.header.electrodeSelectionUpdate === 'function') {
    FRQ_els.header.electrodeSelectionUpdate();
  }

  // Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist
  // UND ein Test läuft: sauber beenden.
  if (FRQ_running) {
    var freshSeq = frq_symmetric ? frq_buildSequenceSymmetric() : frq_buildSequence();
    if (!Array.isArray(freshSeq) || freshSeq.length === 0) {
      var msg = (typeof t === 'function' && t('electrodeSelectionEmptyEnd'))
        || 'Test beendet: Keine ausgewählte Elektrode mehr verfügbar.';
      alert(msg);
      if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();
    }
  }
}

// BA 206: Startwert für eine Elektrode = letzter Wert aus rounds[].
function frq_prevCent(elIdx) {
  const last = _fmLastRoundCent(elIdx);
  if (last != null) return Math.round(last);

  const existing = FRQ_resultsArray.find((r) => frq_symmetric
    ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
    : (r.varSide === frq_varSide && r.refSide === FRQ_refSide && r.elIdx === elIdx)
  );
  if (!existing) return 0;
  if (frq_symmetric && typeof existing.cent === 'number' && isFinite(existing.cent)) {
    return Math.round(existing.cent);
  }
  return Math.round(frq_cents(existing.varFreq, existing.refFreq));
}

// Gemeinsame Initialisierung zu Beginn jedes Verfahren-Starts
function _fmInitSides() {
  const val = FRQ_els.header.refSelect.value;
  frq_symmetric = (val === 'symmetric');
  if (frq_symmetric) {
    frq_varSide = 'left';
    FRQ_refSide = 'right';
  } else {
    FRQ_refSide = val;
    frq_varSide = (FRQ_refSide === 'left') ? 'right' : 'left';
  }
}

// BA 291: Token-Liste fuer den Slider-Modus des Frequenzabgleichs.
// Liefert fertige Token { hz, pan, vol, durationMs, side } (hz mit
// cent-Offset; vol = vol * Korrektur * Stereo-Balance, taube Seite 0)
// und Pausen { pauseMs }. 'side' ('left'|'right') dient dem Aufleuchten.
// Reihenfolge folgt frq_firstSide ('ref' zuerst oder 'var' zuerst).
//   opts.aba === true -> erster Ton am Ende wiederholt.
function frq_makeSequence(opts) {
  opts = opts || {};
  var varHz, refHz;
  if (frq_symmetric) {
    var varBase = withSide('left',  function () { return effFreq(frq_currentEl); });
    var refBase = withSide('right', function () { return effFreq(frq_currentEl); });
    varHz = varBase * Math.pow(2, -frq_centOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +frq_centOffset / 2 / 1200);
  } else {
    varHz = frq_varHz(frq_currentEl);
    refHz = frq_freqFromCents(varHz, frq_centOffset);
  }
  var vol = FRQ_getVolume();
  var dur = FRQ_getDuration();
  var pau = FRQ_getPause();
  var balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  function tok(side, hz) {
    var pan   = side === "left" ? -1 : 1;
    var corr  = FRQ_correctionGain(side, hz);
    var balDb = side === "left" ? balG.left : balG.right;
    var v     = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return { hz: hz, pan: pan, vol: v, durationMs: dur, side: side };
  }
  var refTok = tok(FRQ_refSide, refHz);
  var varTok = tok(frq_varSide, varHz);
  var first  = (frq_firstSide === "ref") ? refTok : varTok;
  var second = (frq_firstSide === "ref") ? varTok : refTok;
  var seq = [ first, { pauseMs: pau }, second ];
  if (opts.aba) {
    seq.push({ pauseMs: pau });
    seq.push(first);
  }
  return seq;
}

// --- Tonwiedergabe ---
async function frq_playCurrent() {
  // --- Adaptive-Modus: Replay des aktuellen Trials über frq_playAdaptiveTrial ---
  if (frq_adaptiveActive) {
    if (frq_currentTrackId === null || !frq_tracks || !frq_tracks[frq_currentTrackId]) return;
    const track = frq_tracks[frq_currentTrackId];
    // frq_playAdaptiveTrial mutiert KEINEN Track-State — pure Wiedergabe-Routine.
    // frq_awaitingResponse bleibt true, Antwort-Buttons bleiben aktiv.
    await frq_playAdaptiveTrial(track, frq_currentFirstSide, frq_currentCatchInfo);
    return;
  }

  // --- Slider-Modus: auf die Token-Maschine (BA 291) ---
  if (frq_currentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _fmActivePI();
  isPlay = true;
  testUI.tonePlayer.playSequential(
    frq_makeSequence({ aba: frq_isAbaSequence() }),
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

async function frq_playSimultaneous() {
  // --- Adaptive-Modus: Ref- und Var-Ton gleichzeitig mit aktuellem Track-Offset ---
  if (frq_adaptiveActive) {
    if (frq_currentTrackId === null || !frq_tracks || !frq_tracks[frq_currentTrackId]) return;
    if (isPlay) {
      isPlay = false;
      if (frq_playTimeout) { clearTimeout(frq_playTimeout); frq_playTimeout = null; }
      await new Promise((r) => setTimeout(r, 60));
    }
    const track  = frq_tracks[frq_currentTrackId];
    let refHz, varHz;
    if (frq_symmetric) {
      const varBase = withSide('left',  function() { return effFreq(track.electrodeIdx); });
      const refBase = withSide('right', function() { return effFreq(track.electrodeIdx); });
      const halfOff = track.currentOffset / 2;
      if (frq_currentCatchInfo) {
        const halfCatch = frq_currentCatchInfo.direction / 2;
        varHz = varBase * Math.pow(2, (-halfOff - halfCatch) / 1200);
        refHz = refBase * Math.pow(2, (+halfOff + halfCatch) / 1200);
      } else {
        varHz = varBase * Math.pow(2, -halfOff / 1200);
        refHz = refBase * Math.pow(2, +halfOff / 1200);
      }
    } else {
      const elFreq = withSide(frq_varSide, function() { return effFreq(track.electrodeIdx); });
      refHz = elFreq * Math.pow(2, track.currentOffset / 1200);
      varHz = frq_currentCatchInfo
        ? refHz * Math.pow(2, frq_currentCatchInfo.direction / 1200)
        : elFreq;
    }
    const vol    = FRQ_getVolume();
    const ms     = FRQ_getDuration();
    const refPan = FRQ_refSide === "left" ? -1 : 1;
    const varPan = frq_varSide === "left" ? -1 : 1;

    const balG = (typeof getRawBalanceGains === "function")
      ? getRawBalanceGains() : { left: 0, right: 0 };
    const refCorr  = FRQ_correctionGain(FRQ_refSide, refHz);
    const varCorr  = FRQ_correctionGain(frq_varSide, varHz);
    const refBalDb = FRQ_refSide === "left" ? balG.left : balG.right;
    const varBalDb = frq_varSide === "left" ? balG.left : balG.right;
    const refVol   = isDeaf(FRQ_refSide) ? 0 : vol * refCorr * dB2G(refBalDb);
    const varVol   = isDeaf(frq_varSide) ? 0 : vol * varCorr * dB2G(varBalDb);

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
  if (frq_currentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _fmActivePI();
  isPlay = true;
  testUI.pairIndicator.setPlaying(_spi, 'both');
  testUI.tonePlayer.playSimultaneous(
    frq_makeSequence({ aba: false }),
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
  if (!frq_varSide || !sideData[frq_varSide]) return;
  let fa = sideData[frq_varSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs)) {
    const prevEst = (fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates) ? fa.sliderEstimates : {};
    fa = { runs: [], currentRunIdx: null, sliderEstimates: prevEst };
    sideData[frq_varSide].freqmatchAdaptive = fa;
  }
  if (!fa.sliderEstimates || typeof fa.sliderEstimates !== 'object') {
    fa.sliderEstimates = {};
  }

  let run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run || run.completedAt != null) {
    // Kein aktiver Lauf → neuen Lauf anlegen.
    // startSigns/pairedToPrevious werden in frq_startAdaptive vorher berechnet
    // und in fmCurStartSigns/frq_currentPairedToPrevious zwischengespeichert.
    const elList = Array.from(new Set(
      Object.keys(frq_tracks).map(function(k) {
        return frq_parseTrackKey(k).electrodeIdx;
      })
    )).sort(function(a, b) {
      const fa_ = withSide(frq_varSide, function() { return effFreq(a); });
      const fb_ = withSide(frq_varSide, function() { return effFreq(b); });
      return fa_ - fb_;
    });
    // startSigns aus den Track-Objekten extrahieren (single source of truth)
    const ssg = {};
    Object.keys(frq_tracks).forEach(function(k) {
      ssg[frq_tracks[k].electrodeIdx] = frq_tracks[k].startSign || +1;
    });
    run = {
      runId:             new Date().toISOString(),
      startedAt:         Date.now(),
      completedAt:       null,
      varSide:           frq_varSide,
      refSide:           FRQ_refSide,
      electrodeIdxList:  elList,
      startSigns:        ssg,
      pairedToPrevious:  !!frq_currentPairedToPrevious,
      tracks:            frq_tracks,
      roundQueue:        frq_roundQueue.slice()
    };
    fa.runs.push(run);
    fa.currentRunIdx = fa.runs.length - 1;
  } else {
    // Bestehenden Lauf aktualisieren (Pause/Resume-Fall)
    run.tracks     = frq_tracks;
    run.roundQueue = frq_roundQueue.slice();
  }

  _fmDbg('persist: run#' + fa.currentRunIdx + ', tracks=' + Object.keys(frq_tracks).length);
}

function _fmMarkCompleted() {
  if (!frq_varSide || !sideData[frq_varSide]) return;
  const fa = sideData[frq_varSide].freqmatchAdaptive;
  if (!fa || fa.currentRunIdx == null) return;
  const run = fa.runs[fa.currentRunIdx];
  if (run) run.completedAt = Date.now();
}

function _fmClearPersist(side) {
  side = side || frq_varSide;
  if (side && sideData[side]) sideData[side].freqmatchAdaptive = null;
}

function _fmTryRestore(currentElIdxList) {
  if (!sideData[frq_varSide]) return false;
  const fa = sideData[frq_varSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) return false;

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run) return false;
  if (run.completedAt != null) return false;            // letzter Lauf war fertig
  if (run.varSide !== frq_varSide || run.refSide !== FRQ_refSide) return false;
  if (!run.tracks) return false;

  const saved = (run.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
  const now   = currentElIdxList.slice().sort(function(a, b) { return a - b; });
  if (saved.length !== now.length) return false;
  for (let i = 0; i < saved.length; i++) if (saved[i] !== now[i]) return false;

  const hasActive = Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });
  if (!hasActive) return false;

  frq_tracks     = run.tracks;
  frq_roundQueue = Array.isArray(run.roundQueue) ? run.roundQueue.slice() : [];
  _fmDbg('restore: run#' + fa.currentRunIdx + ', ' + Object.keys(frq_tracks).length + ' tracks');
  return true;
}

function FRQ_refreshResumeHint() {
  if (!FRQ_els) return;
  const startBtn = FRQ_els.header && FRQ_els.header.startBtn;
  if (!startBtn) return;
  const fa = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive) || null;

  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) {
    startBtn.textContent = (typeof t === 'function' && t('FRQ_lblStart')) || 'Test starten';
    return;
  }

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  const hasActive = run && run.tracks && Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });

  if (hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('FRQ_lblResume')) || 'Test fortsetzen';
  } else {
    startBtn.textContent = (typeof t === 'function' && t('FRQ_lblNewRun')) || 'Weiteren Lauf starten';
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
  if (!FRQ_els || !FRQ_els.verfahren) return null;
  if (frq_adaptiveActive && FRQ_els.verfahren.adaptive)
    return FRQ_els.verfahren.adaptive.progress;
  if (FRQ_running && FRQ_els.verfahren.slider)
    return FRQ_els.verfahren.slider.progress;
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

function frq_undo() {
  if (frq_adaptiveActive) { frq_undoAdaptive(); return; }
  if (!FRQ_running || frq_sequenceIdx === 0) return;
  frq_sequenceIdx--;
  const prevEl = frq_sequence[frq_sequenceIdx];
  const store = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive)
    ? sideData[frq_varSide].freqmatchAdaptive.sliderEstimates : null;
  if (store) delete store[String(prevEl)];

  // Elektrode wieder in pass.remaining aufnehmen, an der korrekten Position
  // gemäß pass.order (Frequenz-Reihenfolge).
  const fa = sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive;
  const pass = fa && fa.sliderPass;
  if (pass && !pass.remaining.includes(prevEl)) {
    pass.remaining.push(prevEl);
    // Reihenfolge gemäß pass.order wiederherstellen.
    pass.remaining.sort(function(a, b) {
      return pass.order.indexOf(a) - pass.order.indexOf(b);
    });
  }

  frq_updateSliderProgress();
  frq_loadElectrode();
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
    if (!FRQ_running) return;
    testUI.sideCheck.run(
      { sides: 'both' },
      function() { _fmStartIdleSideCheck(); },
      function() { if (FRQ_els) FRQ_els._stopTest(); }
    );
  });
}

function frq_abort() {
  testUI.sideCheck.stopIdleWatch();
  _fmSimActive = false;
  frq_pianoActive = false;
  if (frq_adaptiveActive) {
    _fmPersist();
    frq_adaptiveActive   = false;
    frq_awaitingResponse = false;
    frq_isPlaying           = false;
    if (frq_playTimeout) { clearTimeout(frq_playTimeout); frq_playTimeout = null; }
    FRQ_running          = false;
    frq_currentTrackId       = null;
    _fmStopTimer();
    FRQ_refreshResumeHint();
    return;
  }
  frq_isPlaying = false;
  if (frq_playTimeout) { clearTimeout(frq_playTimeout); frq_playTimeout = null; }
  _fmStopTimer();
  FRQ_running   = false;
  frq_currentEl = null;
  FRQ_refreshResumeHint();
}

// --- Klavier-Verfahren (A1: nur erste Elektrode, Tonwiedergabe) ---
function frq_startPiano() {
  if (!FRQ_els) return;
  _fmInitSides();
  if (frq_symmetric) {
    frq_sequence = frq_buildSequenceSymmetric();
    if (frq_sequence === null) {
      alert((typeof t === 'function' && t('FRQ_symmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten muessen dieselben aktiven Elektroden haben.');
      FRQ_els._stopTest(); return;
    }
    if (!frq_sequence.length) {
      alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden.');
      FRQ_els._stopTest(); return;
    }
  } else {
    frq_sequence = frq_buildSequence();
    if (!frq_sequence.length) {
      alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
      FRQ_els._stopTest(); return;
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartPiano,
    function() { if (FRQ_els) FRQ_els._stopTest(); }
  );
}

// ===== Klavier-Verfahren — Mess-Engine (A2a) =====
var FM_PIANO_STEPS = [250, 100, 50, 25, 10, 5];
var FM_PIANO_MAX_SPAN = 1200;   // ct: groessere Spanne -> verdaechtig, ausgeschlossen

// Roh-Speicher der var-Seite holen/anlegen.
function _fmPianoData() {
  var sd = sideData[frq_varSide];
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
  var elList = frq_sequence.slice();
  var run = fp.run;
  if (!run || run.varSide !== frq_varSide || run.refSide !== FRQ_refSide
      || run.symmetric !== frq_symmetric) {
    run = {
      runId:        new Date().toISOString(),
      startedAt:    Date.now(),
      lastUpdate:   Date.now(),
      varSide:      frq_varSide,
      refSide:      FRQ_refSide,
      symmetric:    frq_symmetric,
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
  frq_pianoActive = true;
  FRQ_running   = true;
  frq_firstSide = 'var';     // Kandidat zuerst, dann Vergleich
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

  frq_currentEl  = elIdx;
  frq_centOffset = center;

  var pr = _fmPianoRefs();
  if (pr && typeof testUI !== 'undefined' && testUI.piano) {
    testUI.piano.setRound(pr, { stepCent: step, centerCent: center, baseFreq: frq_varHz(elIdx) });
    // Bei Wiederholung (Zurueck) den zuvor bestaetigten Wert dieser Runde markieren.
    var prevThisRound = _fmPianoBorderVal(elIdx, run.currentRound, border);
    if (prevThisRound != null) {
      _fmPianoMarkCent(pr, prevThisRound);
      frq_centOffset = prevThisRound;
    }
  }
  // Zurueck-Knopf aktivieren, wenn in der Runde etwas zurueckliegt (BA356-fix).
  var _ub = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano
    && FRQ_els.verfahren.piano.actions && FRQ_els.verfahren.piano.actions.undo;
  if (_ub) _ub.disabled = !(run.posInRound > 0 || run.posInBorder > 0);

  _fmPianoUpdateBoxes(border);
  _fmPianoUpdateProgress();
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
function frq_pianoOnPlay(evt) {
  if (!FRQ_running || frq_currentEl === null) return;
  frq_centOffset = (evt && typeof evt.cent === 'number') ? evt.cent : 0;
  frq_playCurrent();
}

// Grenze bestaetigen: zuletzt gespielten Tasten-Offset speichern, weiter.
function frq_pianoConfirm() {
  if (!FRQ_running || frq_currentEl === null) return;
  var run = _fmPianoData().run;
  if (!run) return;
  var pr = _fmPianoRefs();
  if (!pr || pr.markedAbsCent == null) return;   // noch keine Taste gespielt

  var elIdx  = run.roundOrder[run.posInRound];
  var border = run.borderOrder[run.posInBorder];
  _fmPianoSetBorder(elIdx, run.currentRound, border, pr.markedAbsCent);
  run.lastUpdate = Date.now();

  if (typeof FRQ_setActiveMethod === "function") FRQ_setActiveMethod("piano");
  _fmPianoWriteResults();
  if (typeof renderFreqMatchResults === "function") {
    try { renderFreqMatchResults(); } catch (e) {}
  }

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
function frq_pianoBack() {
  if (!FRQ_running) return;
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
  FRQ_running = false;
  _fmPianoWriteResults();
  if (FRQ_els && typeof FRQ_els._stopTest === 'function') FRQ_els._stopTest();
}

// B1: Klavier-Ergebnisse aus dem Roh-Speicher nach FRQ_resultsArray (live).
// Ergebnis je Elektrode = Mittelwert der feinsten Runde mit BEIDEN Grenzen.
// (Plausibilitaets-Ausschluss kommt in B2.)
function _fmPianoWriteResults() {
  if (typeof FRQ_resultsArray === "undefined") return;
  for (var i = FRQ_resultsArray.length - 1; i >= 0; i--) {
    if (FRQ_resultsArray[i] && FRQ_entryMethod(FRQ_resultsArray[i]) === "piano") FRQ_resultsArray.splice(i, 1);
  }
  var fp = _fmPianoData();
  var run = fp && fp.run;
  if (!run || !fp.perElectrode) return;
  var sym = run.symmetric;

  Object.keys(fp.perElectrode).forEach(function (elKey) {
    var elIdx  = parseInt(elKey, 10);
    var rounds = fp.perElectrode[elKey].rounds || {};
    var best = 0, lo = null, hi = null;
    Object.keys(rounds).forEach(function (rk) {
      var rn = parseInt(rk, 10), rr = rounds[rk];
      if (rr && typeof rr.lower === "number" && typeof rr.upper === "number" && rn > best) {
        best = rn; lo = rr.lower; hi = rr.upper;
      }
    });
    if (best === 0) return;
    var pse  = (lo + hi) / 2;
    var span = Math.abs(hi - lo);

    var crossed = (lo > hi);
    var wide    = (span > FM_PIANO_MAX_SPAN);
    var pStatus = crossed ? "piano-crossed" : (wide ? "piano-wide" : "piano");
    var pExcl   = (crossed || wide);

    var varHz, refHz, refSideOut;
    if (sym) {
      varHz = withSide("left",  function () { return effFreq(elIdx); });
      refHz = withSide("right", function () { return effFreq(elIdx); });
      refSideOut = "symmetric";
    } else {
      varHz = withSide(run.varSide, function () { return effFreq(elIdx); });
      refHz = frq_freqFromCents(varHz, pse);
      refSideOut = run.refSide;
    }

    var entry = {
      varSide:   run.varSide,
      refSide:   refSideOut,
      elIdx:     elIdx,
      varFreq:   varHz,
      refFreq:   refHz,
      timestamp: Date.now(),
      method:    "piano",
      fmStatus:  pStatus,
      fmExcluded:            pExcl,
      fmResidual:            null,
      fmCombinedUncertainty: null,
      fmDelta:               null,
      fmConv:                null,
      fmRunSpread:           null,
      fmResiduum:            span / 2,
      fmRunsCount:           0,
      fmStatusLast:          null
    };
    if (sym) entry.cent = Math.round(pse);
    FRQ_resultsArray.push(entry);
  });
}

// BA365: Quell-Wert einer Elektrode fuer die Klavier-Uebernahme.
// Adaptiv hat Vorrang vor Slider. Liefert { cent, refSide, symmetric } oder null.
function _fmMigrAltForEl(side, elIdx) {
  // 1) Adaptiv aus FRQ_resultsArray
  if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
    for (var i = 0; i < FRQ_resultsArray.length; i++) {
      var r = FRQ_resultsArray[i];
      if (!r || r.elIdx !== elIdx) continue;
      if (FRQ_entryMethod(r) !== "adaptive") continue;
      var symA = (r.refSide === "symmetric");
      if (r.varSide !== side && !symA) continue;
      var centA = null;
      if (typeof r.cent === "number" && isFinite(r.cent)) {
        centA = r.cent;
      } else if (typeof r.varFreq === "number" && typeof r.refFreq === "number"
          && r.varFreq > 0 && r.refFreq > 0) {
        centA = 1200 * Math.log2(r.refFreq / r.varFreq);
      }
      if (centA == null) continue;
      return {
        cent:      centA,
        refSide:   symA ? "symmetric" : (r.refSide || (side === "left" ? "right" : "left")),
        symmetric: symA
      };
    }
  }
  // 2) Slider aus sliderEstimates
  var fa = sideData[side] && sideData[side].freqmatchAdaptive;
  var est = fa && fa.sliderEstimates && fa.sliderEstimates[elIdx];
  if (est && typeof est.cent === "number" && isFinite(est.cent)) {
    var symS = (est.refSide === "symmetric");
    return {
      cent:      est.cent,
      refSide:   est.refSide || (side === "left" ? "right" : "left"),
      symmetric: symS
    };
  }
  return null;
}

// BA365: true, wenn die Elektrode bereits einen Klavierwert hat
// (Roh-Behaelter ODER FRQ_resultsArray-piano-Eintrag) -> keine Uebernahme.
function _fmMigrHasPiano(side, elIdx) {
  var fp = sideData[side] && sideData[side].freqmatchPiano;
  if (fp && fp.perElectrode && fp.perElectrode[elIdx]
      && fp.perElectrode[elIdx].rounds
      && Object.keys(fp.perElectrode[elIdx].rounds).length > 0) {
    return true;
  }
  if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
    for (var i = 0; i < FRQ_resultsArray.length; i++) {
      var r = FRQ_resultsArray[i];
      if (r && r.elIdx === elIdx && FRQ_entryMethod(r) === "piano"
          && (r.varSide === side || r.refSide === "symmetric")) {
        return true;
      }
    }
  }
  return false;
}

// BA365: Beim Laden Altwerte (Adaptiv/Slider) ins Klavier uebernehmen.
// Nur fuer Elektroden ohne vorhandenen Klavierwert. Eine Abfrage je Datei.
function _fmMigrateAltToPiano() {
  if (typeof sideData === "undefined") return;

  // 1) Quell-Seite bestimmen: die EINE Seite mit Altdaten (Adaptiv/Slider).
  //    Frequenzabgleich liefert ein interaurales Ergebnis -> nur eine Seite
  //    traegt Rohdaten (Architektur 4.1).
  function _sideHasAlt(side) {
    var sd = sideData[side];
    if (!sd) return false;
    var fa = sd.freqmatchAdaptive;
    if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0) return true;
    if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
      for (var i = 0; i < FRQ_resultsArray.length; i++) {
        var r = FRQ_resultsArray[i];
        if (r && FRQ_entryMethod(r) === "adaptive"
            && (r.varSide === side || r.refSide === "symmetric")) return true;
      }
    }
    return false;
  }
  var varSide = _sideHasAlt("left") ? "left"
              : _sideHasAlt("right") ? "right" : null;
  if (!varSide) return;
  // (Falls wider Erwarten BEIDE Seiten Altdaten tragen -> nur die erste wird behandelt.)

  // 2) Uebernehmbare Elektroden sammeln (kein vorhandener Klavierwert).
  var todo = [];   // {elIdx, cent, refSide, symmetric}
  var sd = sideData[varSide];
  var elSet = {};
  var fa = sd.freqmatchAdaptive;
  if (fa && fa.sliderEstimates) {
    Object.keys(fa.sliderEstimates).forEach(function (k) { elSet[k] = true; });
  }
  if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
    FRQ_resultsArray.forEach(function (r) {
      if (r && FRQ_entryMethod(r) === "adaptive"
          && (r.varSide === varSide || r.refSide === "symmetric")) {
        elSet[r.elIdx] = true;
      }
    });
  }
  Object.keys(elSet).forEach(function (k) {
    var elIdx = parseInt(k, 10);
    if (!isFinite(elIdx)) return;
    if (_fmMigrHasPiano(varSide, elIdx)) return;          // Klavier hat Vorrang
    var alt = _fmMigrAltForEl(varSide, elIdx);
    if (!alt || alt.cent == null || !isFinite(alt.cent)) return;
    todo.push({ elIdx: elIdx, cent: alt.cent,
                refSide: alt.refSide, symmetric: alt.symmetric });
  });

  if (todo.length === 0) return;

  if (!confirm(t("FRQ_migratePianoConfirm")
      || "Vorhandene Messwerte ins Klavier-Verfahren uebernehmen?")) {
    return;
  }

  var band = (typeof FM_PIANO_STEPS !== "undefined" && FM_PIANO_STEPS.length)
    ? FM_PIANO_STEPS[0] : 250;

  // 3) Kuenstlichen Klavier-Lauf + Runden in den Roh-Behaelter der EINEN
  //    Seite schreiben, dann _fmPianoWriteResults() EINMAL aufrufen.
  if (!sd.freqmatchPiano) sd.freqmatchPiano = { run: null, perElectrode: {} };
  var fp = sd.freqmatchPiano;
  if (!fp.perElectrode) fp.perElectrode = {};

  var sample = todo[0];   // refSide/symmetric ist fuer alle einheitlich
  fp.run = {
    runId:        "migrated:" + new Date().toISOString(),
    startedAt:    Date.now(),
    lastUpdate:   Date.now(),
    varSide:      varSide,
    refSide:      sample.refSide,
    symmetric:    !!sample.symmetric,
    electrodeList: todo.map(function (it) { return it.elIdx; }),
    currentRound: 1,
    roundOrder:   todo.map(function (it) { return it.elIdx; }),
    posInRound:   0,
    borderOrder:  ["lower", "upper"],
    posInBorder:  0
  };
  // Kuenstliche Runde 1 je Elektrode: Mitte = cent, Band = +-band.
  // _fmPianoWriteResults nimmt pse = (lower+upper)/2 = cent,
  // fmResiduum = span/2 = band.
  todo.forEach(function (it) {
    fp.perElectrode[it.elIdx] = {
      rounds: { 1: { lower: it.cent - band, upper: it.cent + band } }
    };
  });

  // _fmPianoWriteResults liest sideData[frq_varSide] ueber _fmPianoData().
  // frq_varSide auf die Quell-Seite lenken; mit try/finally restaurieren.
  var _prevVarSide = frq_varSide;
  try {
    frq_varSide = varSide;
    _fmPianoWriteResults();
  } finally {
    frq_varSide = _prevVarSide;
  }
}

// Boxen: Kandidat (var) zeigt Elektrode + Rolle; Referenz zeigt Vergleichston.
function _fmPianoUpdateBoxes(border) {
  var pi = _fmPianoPI();
  var elLabel = withSide(frq_varSide, function() { return dENPrefix() + dEN(frq_currentEl); });
  var roleUp  = (border === 'lower') ? t('FRQ_pianoBoxLower') : t('FRQ_pianoBoxHigher');
  if (pi) {
    pi.left.textContent  = elLabel + ' — ' + roleUp;
    pi.right.textContent = t('FRQ_pianoRefBox');
  }
  var instr = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.instruction;
  if (instr) {
    instr.innerHTML = t('FRQ_pianoInstruction').replace('{role}', roleUp.toLowerCase());
  }
}

// Zahl der bisher bestaetigten Grenzen (ueber alle Runden/Elektroden).
function _fmPianoCountConfirmed() {
  var fp = _fmPianoData();
  if (!fp || !fp.perElectrode) return 0;
  var c = 0;
  Object.keys(fp.perElectrode).forEach(function(el) {
    var rounds = fp.perElectrode[el].rounds || {};
    Object.keys(rounds).forEach(function(rk) {
      var r = rounds[rk];
      if (r && typeof r.lower === 'number') c++;
      if (r && typeof r.upper === 'number') c++;
    });
  });
  return c;
}

// Fortschrittsanzeige: Text + Gesamtbalken (alle 6 Runden).
function _fmPianoUpdateProgress() {
  var els = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano
    && FRQ_els.verfahren.piano.progress;
  if (!els) return;
  var fp = _fmPianoData();
  var run = fp && fp.run;
  if (!run) return;
  var m = run.roundOrder.length;
  var n = Math.min(run.posInRound + 1, m);
  var total = FM_PIANO_STEPS.length * run.electrodeList.length * 2;
  var done  = _fmPianoCountConfirmed();
  var frac  = total > 0 ? done / total : 0;
  var txt = t('FRQ_pianoProgress')
    .replace('{n}', n).replace('{m}', m)
    .replace('{r}', run.currentRound).replace('{y}', FM_PIANO_STEPS.length);
  testUI.progress.set(els, { fraction: frac, text: txt });
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
  h.textContent = t('FRQ_pianoRoundDoneTitle').replace('{x}', round).replace('{y}', total);
  var p = document.createElement('p');
  p.style.cssText = 'margin:0 0 16px;line-height:1.5;';
  p.textContent = t('FRQ_pianoRoundDoneMsg').replace('{n}', curStep).replace('{m}', nextStep);
  var row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  var bFin = document.createElement('button');
  bFin.className = 'btn btn-sm';
  bFin.textContent = t('FRQ_pianoRoundFinish');
  var bNext = document.createElement('button');
  bNext.className = 'btn btn-sm btn-primary';
  bNext.textContent = t('FRQ_pianoRoundNext');
  function close() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
  bFin.addEventListener('click', function() { close(); onFinish(); });
  bNext.addEventListener('click', function() { close(); onNext(); });
  row.append(bFin, bNext);
  box.append(h, p, row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function frq_finish() {
  frq_isPlaying    = false;
  _fmStopTimer();
  FRQ_running   = false;
  frq_currentEl = null;
  if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
}

// --- Elektroden-Ausschluss ---
function _fmRequestExcl() {
  if (!FRQ_running || frq_currentEl === null || !FRQ_els) return;
  setTestExclConfirm(FRQ_els.exclOverlay, frq_varSideElectrodeLabel(frq_currentEl), function() {
    withSide(frq_varSide, () => { elExDur[frq_currentEl] = true; });
    // Ausschluss: aktuelle Elektrode aus dem Durchgang nehmen, weiter.
    const _fa = sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive;
    if (_fa && _fa.sliderPass) {
      const _i = _fa.sliderPass.remaining.indexOf(frq_currentEl);
      if (_i >= 0) _fa.sliderPass.remaining.splice(_i, 1);
    }
    frq_sequenceIdx++;
    frq_loadElectrode();
  });
}

// --- Slider-Handler ---
function frq_handleSlider(val) {
  frq_centOffset = parseFloat(val);
  frq_updateSliderDisplay();
}

// --- i18n-Aktualisierung ---
function FRQ_applyLang() {
  if (!FRQ_els) return;
  if (FRQ_els.header && FRQ_els.header.startBtn) {
    FRQ_refreshResumeHint();
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
  if (!FRQ_els || !FRQ_els.header || !FRQ_els.header.refSelect) return;
  // Schutz: solange Daten vorliegen, refSelect nicht implizit umstellen —
  // ein manueller Wechsel ist durch depLock gesperrt (Popup mit Begründung).
  if (FRQ_resultsArray.length > 0) return;
  if (_fmHasAdaptiveData()) return;
  if (_fmHasSliderEstimates()) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const leftIsCI  = (leftCfg  === 'ci');
  const rightIsCI = (rightCfg === 'ci');
  if (leftIsCI && !rightIsCI) {
    FRQ_els.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    FRQ_els.header.refSelect.value = 'left';
  } else if (leftIsCI && rightIsCI) {
    // Beide CI: 'symmetric' setzen, sofern die Dropdown-Option existiert.
    const hasSym = Array.from(FRQ_els.header.refSelect.options).some(function(o) {
      return o.value === 'symmetric';
    });
    if (hasSym) FRQ_els.header.refSelect.value = 'symmetric';
  }
  // beide akustisch: kein Override (Sperre wird durch L1-Tab-Sperre BA 172 behandelt).
}

function _fmRefreshHGWarningVisibility() {
  if (!FRQ_els) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen, wenn Test nicht ohnehin geblockt ist.
  const blocked = _fmEvalTestEligibility().blocked;
  const visible = hasHG && !blocked;
  testUI.explain.setVisible(FRQ_els, 'fmHGWarnPara', visible);
}


// BA 251: jRes entfaellt; Lautstaerke-Daten = elektrodenlautstaerkeResults.
function _fmHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.elektrodenlautstaerkeResults && s.elektrodenlautstaerkeResults.length > 0);
}

function _fmRenderPrereqHints() {
  const elsLeftEl  = document.getElementById('fmPrereqLvLeftPara');
  const elsRightEl = document.getElementById('fmPrereqLvRightPara');
  const sbEl      = document.getElementById('fmPrereqSbHintPara');
  if (elsLeftEl)  elsLeftEl.style.display  = _fmHasLvData('left')  ? 'none' : '';
  if (elsRightEl) elsRightEl.style.display = _fmHasLvData('right') ? 'none' : '';
  if (sbEl) {
    const hasSb = typeof stereobalanceResults !== 'undefined'
               && stereobalanceResults
               && Object.keys(stereobalanceResults).length > 0;
    sbEl.style.display = hasSb ? 'none' : '';
  }
}

function _fmRefreshTabState() {
  if (!FRQ_els) return;
  if (!FRQ_running) {
    _fmAutoSetRefMode();
    frq_loadVerfahrenFromSide();
  }
  if (typeof FRQ_refreshResumeHint === 'function') FRQ_refreshResumeHint();
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
let FRQ_activeMethodValue = null;

// Method-Kennung eines Eintrags. Konvention: nur "slider" ist Schieber,
// alles andere (inkl. fehlend) zaehlt als "adaptive" (Altstaende ohne Feld).
function FRQ_entryMethod(r) {
  if (r && r.method === "piano")  return "piano";
  if (r && r.method === "slider") return "slider";
  return "adaptive";
}

// Hat ein Verfahren ueberhaupt Daten? (fuer Default-Ableitung)
// BA363: aktuell ungenutzt (FRQ_getActiveMethod gibt hart "piano"), fuer Reaktivierung erhalten.
function frq_methodHasData(method) {
  if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
    for (let i = 0; i < FRQ_resultsArray.length; i++) {
      if (FRQ_resultsArray[i] && FRQ_entryMethod(FRQ_resultsArray[i]) === method) return true;
    }
  }
  const sides = ["left", "right"];
  for (let s = 0; s < sides.length; s++) {
    const fa = sideData[sides[s]] && sideData[sides[s]].freqmatchAdaptive;
    if (!fa) continue;
    if (method === "piano") {
      var fpp = sideData[sides[s]] && sideData[sides[s]].freqmatchPiano;
      if (fpp && fpp.perElectrode && Object.keys(fpp.perElectrode).length > 0) return true;
    } else if (method === "slider") {
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

// Aktiv geltendes Verfahren. Klavier-only-Betrieb (BA363): immer "piano".
// Der gespeicherte FRQ_activeMethodValue bleibt unangetastet (Reaktivierung von
// Adaptiv/Slider ist ein reiner Sichtbarkeits-Schritt). Architektur 10.1.
function FRQ_getActiveMethod() {
  return "piano";
}

// EINZIGE Schreibstelle fuer den Aktiv-Zustand. "Letzte Aktion gewinnt":
// jede Bestaetigung (Trigger) und jeder Button-Klick ruft das hier.
// Refresh (Graph + Player-Warp) nur bei echtem Wechsel.
function FRQ_setActiveMethod(m) {
  if (m !== "adaptive" && m !== "slider" && m !== "piano") return;
  const changed = (FRQ_activeMethodValue !== m);
  FRQ_activeMethodValue = m;
  if (typeof FRQ_updateActiveMethodButtons === "function") FRQ_updateActiveMethodButtons();
  if (!changed) return;
  if (typeof renderFreqMatchResults === "function") {
    try { renderFreqMatchResults(); } catch (e) {}
  }
  if (typeof pWarpTrigger === "function") {
    try { pWarpTrigger(); } catch (e) {}
  }
}

// Hervorhebung der zwei Umschalt-Buttons (Vorbild: updPlSrcButtons).
function FRQ_updateActiveMethodButtons() {
  const method = FRQ_getActiveMethod();
  const map = [
    { id: "FRQ_activeMethodAdaptiveBtn", m: "adaptive" },
    { id: "FRQ_activeMethodSliderBtn",   m: "slider" },
    { id: "FRQ_activeMethodPianoBtn",    m: "piano" }
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

function frq_setVerfahren(newVerfahren, opts) {
  opts = opts || {};
  if (newVerfahren !== 'slider' && newVerfahren !== 'adaptive' && newVerfahren !== 'piano') return;
  if (newVerfahren === frq_verfahren && !opts.force) return;

  const oldVerfahren = frq_verfahren;
  frq_verfahren = newVerfahren;

  if (!FRQ_els || !FRQ_els.header) return;

  // BA 240: Dur/Pau-Stash arbeitet jetzt auf State-Variablen statt DOM-Inputs.
  if (oldVerfahren === 'slider') {
    _fmDurStash_slider = duration_freqmatch || 400;
    _fmPauStash_slider = pause_freqmatch    || 400;
  }
  if (newVerfahren === 'slider') {
    duration_freqmatch = _fmDurStash_slider;
    pause_freqmatch    = _fmPauStash_slider;
  }

  testUI.verfahren.select(FRQ_els, newVerfahren);
  FRQ_refreshResumeHint();
}

function frq_loadVerfahrenFromSide() {
  if (!FRQ_els) return;
  const _refVal = FRQ_els.header.refSelect.value;
  frq_symmetric = (_refVal === 'symmetric');
  if (frq_symmetric) {
    frq_varSide = 'left';
    FRQ_refSide = 'right';
  } else {
    FRQ_refSide = _refVal;
    frq_varSide = (FRQ_refSide === 'left') ? 'right' : 'left';
  }

  const fa = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive) || null;
  const hasAdaptive = !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
    return r.tracks && Object.keys(r.tracks).some(function(k) {
      return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
    });
  }));

  if (hasAdaptive) {
    frq_setVerfahren('adaptive', { force: true });
  }

  FRQ_refreshResumeHint();
}

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const parentEl = document.getElementById("subpanel-messungen-freqmatch");
  if (!parentEl) return;
  _fmParentEl = parentEl;

  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'FRQ_title',
      // BA 220: preserveOrder, damit Gruppen-Headings, Methodentext und
      // zugehoerige Warnung visuell zusammenstehen statt durch die
      // Schwere-Sortierung gemischt zu werden.
      preserveOrder: true,
      paragraphs: [
        { key: 'FRQ_maturityHint',         kind: 'caution' },

        // Warn-Absaetze, deren Sichtbarkeit dynamisch umgeschaltet wird
        // (Initial hidden=true; testUI.explain.setVisible blendet bei Bedarf ein).
        { key: 'FRQ_highGainWarn',               kind: 'warn',    id: 'fmHGWarnPara',
                                         hidden: true },
        { key: 'FRQ_cochlearFatCorrectionInfo', kind: 'warn', id: 'fmCochlearFatHintPara',
                                         hidden: true },

        // Voraussetzungen — bleiben bedingt sichtbar (durch _fmRenderPrereqHints).
        { key: 'FRQ_prereqLvLeft',         kind: 'warn',    id: 'fmPrereqLvLeftPara'    },
        { key: 'FRQ_prereqLvRight',        kind: 'warn',    id: 'fmPrereqLvRightPara'   },
        { key: 'FRQ_prereqSb',             kind: 'warn',    id: 'fmPrereqSbHintPara'    },

        // Gruppe 1: beidseitiges CI.
        { key: 'FRQ_groupBothCi',          kind: 'heading' },
        { key: 'FRQ_hintMethodBothCI',     kind: 'plain' },
        { key: 'FRQ_hintWarnBothCI',       kind: 'caution' },

        // Gruppe 2: CI + akustische Gegenseite.
        { key: 'FRQ_groupCiAcoustic',      kind: 'heading' },
        { key: 'FRQ_hintMethodCiNatural',  kind: 'plain' },
        { key: 'FRQ_hintWarn',             kind: 'caution' },

        // BA364: Vor-Schaetzung/Adaptiv-Workflow im Klavier-only-Betrieb aus.
        { key: 'FRQ_hintWorkflow',         kind: 'plain', id: 'fmHintWorkflowPara',
                                         hidden: true }
      ]
    },
    header: {
      common: {
        refSelect:    { type: 'side', key: 'FRQ_lblRef', includeSymmetric: true },
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
          // Tonart mit; onPress liest frq_modalTone mit Fallback auf toneType_freqmatch.
          onToneSelected:  function(tt) { frq_modalTone = tt; },
          onModalClose:    function()   { frq_modalTone = null; frq_keyboardCorrectVolume = null; },
          onTogglesReady:  function(fn) { frq_keyboardCorrectVolume = fn; },
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
          getVolume:   function() { return FRQ_getVolume(); },
          getPreviewSequence: function (lastHz) {
            // Slider-Modus laeuft -> echte Sequenz. Sonst (inkl. Adaptiv-Modus)
            // gemerkter Ton, beide Seiten nacheinander (Vergleichs- dann
            // Referenz-Seite).
            if (FRQ_running && frq_currentEl != null && !frq_adaptiveActive) {
              return frq_makeSequence({ aba: frq_isAbaSequence() });
            }
            // BA 301: jede Seite mit zentraler Korrektur (Elektrodenlautstaerke
            // + Balance); taube Seite stumm (isDeaf) wie beim Klavier.
            var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
            var vol = FRQ_getVolume();
            var dur = FRQ_getDuration();
            var pau = FRQ_getPause();
            var varSide = (typeof frq_varSide === 'string' && frq_varSide) ? frq_varSide : activeSide;
            var refSide = (varSide === 'left') ? 'right' : 'left';
            var varPan  = (varSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an);
            // taube Seite stumm (isDeaf) wie beim Klavier. pan kodiert die Seite.
            var _fmCv = function (side, pan) {
              if (typeof isDeaf === 'function' && isDeaf(side)) return 0;
              return (typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hz, pan) : vol;
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
            var vSide = (typeof frq_varSide === 'string' && frq_varSide)
              ? frq_varSide : activeSide;
            var rSide = (typeof FRQ_refSide === 'string' && FRQ_refSide)
              ? FRQ_refSide : (vSide === 'left' ? 'right' : 'left');
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
            var vSide = (typeof frq_varSide === 'string' && frq_varSide)
              ? frq_varSide : activeSide;
            var rSide = (typeof FRQ_refSide === 'string' && FRQ_refSide)
              ? FRQ_refSide : (vSide === 'left' ? 'right' : 'left');
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
            var vSide = (typeof frq_varSide === 'string' && frq_varSide)
              ? frq_varSide : activeSide;
            var rSide = (typeof FRQ_refSide === 'string' && FRQ_refSide)
              ? FRQ_refSide : (vSide === 'left' ? 'right' : 'left');
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
          getHighlightMs: function() { return FRQ_getDuration() * 2 + FRQ_getPause(); },
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _fmKbT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt      = (frq_modalTone !== null) ? frq_modalTone : toneType_freqmatch;
            var vol     = FRQ_getVolume();
            var varSide = (typeof frq_varSide === 'string' && frq_varSide) ? frq_varSide : activeSide;
            var varPan  = (varSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volVar  = isDeaf(varSide) ? 0
              : ((typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hz, varPan) : vol);
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
            var tt      = (frq_modalTone !== null) ? frq_modalTone : toneType_freqmatch;
            var vol     = FRQ_getVolume();
            var varSide = (typeof frq_varSide === 'string' && frq_varSide) ? frq_varSide : activeSide;
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
              : ((typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hzRef, refPan) : vol);
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
      startStop: { startKey: 'FRQ_lblStart', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [
      {
        id: 'piano',
        labelKey:   'FRQ_modePiano',
        explainKey: 'FRQ_explainPiano',
        body: {
          progress:      { format: 'simple' },
          pairIndicator: { variant: 'token', leftKey: 'FRQ_tone1', rightKey: 'FRQ_tone2' },
          instruction:   { key: 'FRQ_pianoInstruction' },
          piano:         {},
          confirmButton: { key: 'FRQ_pianoConfirmMsg' },
          actions:       ['undo', 'replay', 'simul']
        },
        hooks: {
          onStart:     frq_startPiano,
          onStop:      frq_abort,
          onPianoPlay: frq_pianoOnPlay,
          onConfirm:   frq_pianoConfirm,
          onUndo:      frq_pianoBack,
          onReplay:    frq_playCurrent,
          onSimul:     frq_playSimultaneous
        }
      }
      /* BA363 Klavier-only: Adaptiv und Slider aus der UI verborgen.
         Logik (frq_startAdaptive, frq_startSlider, Roh-Behaelter) bleibt im
         Code. Zum Reaktivieren diesen Block-Kommentar entfernen und die
         beiden Eintraege wieder als Array-Elemente einfuegen (mit fuehrendem
         Komma nach dem piano-Eintrag). Architektur 10.

      , {
        id: 'adaptive',
        labelKey:   'FRQ_modeAdaptive',
        explainKey: 'FRQ_explainAdaptive',
        body: {
          pairIndicator:   { variant: 'token', leftKey: 'FRQ_tone1', rightKey: 'FRQ_tone2' },
          progress:        { format: 'simple' },
          instruction:     { key: 'hjPrompt' },
          decisionButtons: { variant: 'updown' },
          statusGrid:      { show: true },
          actions:         ['undo','replay','simul'],
          background: {
            bodyKey:    'FRQ_explainAdaptiveScience',
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
            titleKey:   'FRQ_sliderEstimateTitle',
            messageKey: 'FRQ_sliderEstimateMsg',
            actions: [
              {
                labelKey: 'FRQ_sliderEstimateBtnSlider',
                kind:     'custom',
                run:      function() { frq_setVerfahren('slider'); }
              },
              {
                labelKey: 'FRQ_sliderEstimateBtnSkip',
                kind:     'continue'
              },
              {
                labelKey: 'FRQ_sliderEstimateBtnCancel',
                kind:     'abort'
              }
            ]
          }
        ],
        hooks: {
          onStart:    frq_startAdaptive,
          onStop:     frq_abort,
          onDecision: frq_handleHeight,
          onReplay:   frq_playCurrent,
          onUndo:     frq_undoAdaptive,
          onSimul:    frq_playSimultaneous,
          onDebugRun: frq_runDebugSimulation
        }
      },
      {
        id: 'slider',
        labelKey:   'FRQ_modeSlider',
        explainKey: 'FRQ_explainSlider',
        body: {
          pairIndicator: { variant: 'token', leftKey: 'FRQ_tone1', rightKey: 'FRQ_tone2' },
          progress:      { format: 'simple' },
          instruction:   { key: 'FRQ_sliderInstruction' },
          keyHint:       { unitKey: 'sliderHintCent' },
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1, rangeHint: true },
          sliderValue:   { show: true },
          confirmButton: { key: 'btnConfirmOffset' },
          actions:       ['undo', 'replay', 'simul', 'pause'],
          background: {
            bodyKey:    'FRQ_explainSliderScience',
            bodyAsHtml: true
          }
        },
        hooks: {
          onStart:    frq_startSlider,
          onStop:     frq_abort,
          onPause:    frq_pauseSlider,
          onSlide:    frq_handleSlider,
          onConfirm:  frq_confirm,
          onReplay:   frq_playCurrent,
          onUndo:     frq_undo,
          onSimul:    frq_playSimultaneous
        }
      }
      */
    ]
  };

  FRQ_els = buildTestPanel(parentEl, fmCfg);

  // Events: Referenzseiten-Wechsel (BA 151: Sperre statt Custom-Dialog)
  FRQ_els.header.refSelect.addEventListener('change', function() {
    setTimeout(frq_loadVerfahrenFromSide, 0);
  });

  // Texte initial setzen
  FRQ_applyLang();

  if (!FRQ_running) _fmAutoSetRefMode();
  frq_loadVerfahrenFromSide();
  FRQ_refreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
});

function FRQ_refreshElectrodeSelectionSummary() {
  if (FRQ_els && FRQ_els.header && typeof FRQ_els.header.electrodeSelectionUpdate === 'function') {
    FRQ_els.header.electrodeSelectionUpdate();
  }
}

// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function FRQ_refreshToneTypeLabel() {
  if (FRQ_els && FRQ_els.header && typeof FRQ_els.header.tonePopupUpdate === 'function') {
    FRQ_els.header.tonePopupUpdate();
  }
}
