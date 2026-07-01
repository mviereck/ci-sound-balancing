// ============================================================
// freqmatch.js — Frequenzabgleich (Klavier-Verfahren)
// ============================================================

// --- State ---
let frq_modalTone = null;   // BA 230: live-Tonart waehrend des Tonauswahl-Modals; null = kein Modal offen
let frq_keyboardCorrectVolume = null; // BA 239: Korrektorfunktion(vol,hz,pan) aus Modal-Toggles; null = kein Modal offen
let _frq_keyboardT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
let FRQ_running = false;
let FRQ_els = null;
let frq_verfahren = 'piano';   // 'slider' | 'adaptive' | 'piano' — realer Default (Klavier-only-Betrieb, BA363)
let frq_sequence = [];
let frq_sequenceIdx = 0;
let frq_currentEl = null;
let frq_centOffset = 0;
let frq_isPlaying = false;
let frq_playTimeout = null;

let frq_pianoActive      = false;   // true waehrend eines laufenden Klaviertests

// Debug-Simulation
let _frq_simActive  = false;
let _frq_simOffsets = {};   // electrodeIdx → simulierter Wahrnehmungs-Offset (Cent, pos oder neg)
let _frq_parentEl = null;   // gesetzt im DOMContentLoaded

// BA 207: Selektion der zu testenden Elektroden.
// null  = Default (= alle aktiven Elektroden testen).
// []    = Nutzer hat explizit nichts ausgewählt (Test startet nicht).
// [...] = explizite Auswahl. Filter greift in frq_buildSequenceBoth.
// Die Auswahl gilt für beide Seiten gleichzeitig, weil FreqMatch
// links↔rechts vergleicht.
let freqmatchTestSelection = null;

// Live-Log-Brücke ins Debug-Panel — schreibt nur wenn dbg.flag('adaptiv.live') true ist.
function _frq_debug(msg) {
  if (typeof dbg !== 'undefined' && dbg.flag && dbg.flag('adaptiv.live')) {
    dbg.log(msg, 'info');
  }
}

function _frq_shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// --- Hilfsfunktionen ---
function frq_cents(refHz, hz) {
  return 1200 * Math.log2(hz / refHz);
}
function frq_freqFromCents(refHz, c) {
  return refHz * Math.pow(2, c / 1200);
}

// BA417: Der EINE referenzmodus = welche Seite verschiebbar ist.
// Waehrend eines Tests die eingefrorene Session-Einstellung, sonst die
// aktuelle Dropdown-Wahl. Werte: 'left' | 'right' | 'symmetric'.
function frq_referenzmodus() {
  if (FRQ_pianoSession && FRQ_pianoSession.frqRefMode) return FRQ_pianoSession.frqRefMode;
  var v = FRQ_els && FRQ_els.header && FRQ_els.header.refSelect
    ? FRQ_els.header.refSelect.value : 'right';
  return (v === 'left' || v === 'right' || v === 'symmetric') ? v : 'right';
}

// BA417: Verteilung des rohen Offsets auf die beiden Seiten beim MESSEN.
// referenzmodus = verschiebbare Seite. Rueckgabe { csL, csR } = Cent-Shift
// links/rechts auf die je eigene Start-Mittenfrequenz.
// (Eigene kleine Mess-Verteilung -- NICHT FRQ_seitenWerte, das ist die
//  Player-Verteilung des fertigen kanonischen cent, eine andere Achse.)
function frq_verschiebung(off, referenzmodus) {
  var o = (typeof off === "number" && isFinite(off)) ? off : 0;
  if (referenzmodus === "symmetric") return { csL: -o / 2, csR: +o / 2 };
  if (referenzmodus === "left")      return { csL: +o,     csR: 0    };
  return { csL: 0, csR: +o };   // 'right'
}

// BA417: Tonfolge je referenzmodus. [ersteSeite, zweiteSeite].
function frq_tonfolge(referenzmodus) {
  if (referenzmodus === "left")  return ["right", "left"];
  if (referenzmodus === "right") return ["left",  "right"];
  return ["right", "left"];   // 'symmetric'
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
function _frq_pianoPairIndicator() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.pairIndicator;
}
// Referenzen des Klavier-Bausteins (refs.piano im Verfahren 'piano').
function _frq_pianoRefs() {
  return FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.piano;
}
// Ton-Boxen des aktiven Verfahrens (fuer setPlaying-Aufleuchten).
function _frq_activePairIndicator() {
  return _frq_pianoPairIndicator();
}
function frq_isAbaSequence() {
  return sequence_freqmatch === "aba";
}

function FRQ_correctionGain(side, hz) {
  // BA 303: dedupliziert -- die Interpolations-Logik liegt jetzt zentral
  // in ELL_measGain (test.js). FRQ_correctionGain bleibt als benannter Aufrufer fuer
  // die Frequenzabgleich-Sequenzen erhalten.
  return (typeof ELL_measGain === "function") ? ELL_measGain(side, hz) : 1;
}

// BA 207: Schneidet eine Elektroden-Sequenz auf die User-Auswahl.
// freqmatchTestSelection === null → keine Einschränkung (alle aktiven).
// freqmatchTestSelection !== null → Schnittmenge mit gewählten.
function _frq_filterSequenceBySelection(seq) {
  if (freqmatchTestSelection == null) return seq;
  var selSet = new Set(freqmatchTestSelection);
  return seq.filter(function(i) { return selSet.has(i); });
}

// BA417: Status je Elektrode ueber BEIDE Seiten. Testbar nur, wenn auf
// BEIDEN Seiten aktiv und nicht ausgeschlossen. Vorrang 'excluded' vor 'muted'.
function frq_electrodeStatusBoth(i) {
  var exclL = withSide('left',  function () { return elExDur[i] != null; });
  var exclR = withSide('right', function () { return elExDur[i] != null; });
  if (exclL || exclR) return 'excluded';
  var mutedL = withSide('left',  function () { return elActive[i] === false; });
  var mutedR = withSide('right', function () { return elActive[i] === false; });
  if (mutedL || mutedR) return 'muted';
  return 'testable';
}

// BA417: Testreihe = beidseitige Schnittmenge, sortiert nach gemittelter
// Mittenfrequenz. EINE Logik fuer ALLE Modi. Danach User-Auswahl-Filter.
function frq_buildSequenceBoth() {
  var nL = sideData.left  ? sideData.left.nEl  : 0;
  var nR = sideData.right ? sideData.right.nEl : 0;
  var n  = Math.min(nL, nR);
  var seq = [];
  for (var i = 0; i < n; i++) {
    if (frq_electrodeStatusBoth(i) !== 'testable') continue;
    var idx = i;
    var fl = withSide('left',  function () { return FRQ_implantatEffektiv(idx); });
    var fr = withSide('right', function () { return FRQ_implantatEffektiv(idx); });
    seq.push({ idx: idx, hz: (fl + fr) / 2 });
  }
  seq.sort(function (a, b) { return a.hz - b.hz; });
  return _frq_filterSequenceBySelection(seq.map(function (x) { return x.idx; }));
}

// BA 207: Wird vom Auswahl-Dialog nach Confirm aufgerufen.
function _frq_onSelectionChanged() {
  // Header-Summary nach-rendern
  if (FRQ_els && FRQ_els.header && typeof FRQ_els.header.electrodeSelectionUpdate === 'function') {
    FRQ_els.header.electrodeSelectionUpdate();
  }

  // Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist
  // UND ein Test läuft: sauber beenden.
  if (FRQ_running) {
    var freshSeq = frq_buildSequenceBoth();
    if (!Array.isArray(freshSeq) || freshSeq.length === 0) {
      var msg = (typeof t === 'function' && t('electrodeSelectionEmptyEnd'))
        || 'Test beendet: Keine ausgewählte Elektrode mehr verfügbar.';
      alert(msg);
      if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();
    }
  }
}

// BA417: Seitenlos. Jede Seite startet bei IHRER eingetragenen
// Mittenfrequenz; der rohe Offset wird je referenzmodus verteilt
// (frq_verschiebung). Reihenfolge + Aufleuchten folgen frq_tonfolge.
function frq_makeSequence(opts) {
  opts = opts || {};
  var mode = frq_referenzmodus();

  var startL = withSide('left',  function () { return FRQ_implantatEffektiv(frq_currentEl); });
  var startR = withSide('right', function () { return FRQ_implantatEffektiv(frq_currentEl); });
  var cs  = frq_verschiebung(frq_centOffset, mode);
  var hzL = startL * Math.pow(2, cs.csL / 1200);
  var hzR = startR * Math.pow(2, cs.csR / 1200);

  var vol = FRQ_getVolume();
  var dur = FRQ_getDuration();
  var pau = FRQ_getPause();
  var balG = (typeof STB_rawGains === "function")
    ? STB_rawGains() : { left: 0, right: 0 };
  function tok(side) {
    var hz    = (side === "left") ? hzL : hzR;
    var pan   = (side === "left") ? -1 : 1;
    var corr  = FRQ_correctionGain(side, hz);
    var balDb = (side === "left") ? balG.left : balG.right;
    var v     = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return { hz: hz, pan: pan, vol: v, durationMs: dur, side: side };
  }

  var order  = frq_tonfolge(mode);   // [ersteSeite, zweiteSeite]
  var first  = tok(order[0]);
  var second = tok(order[1]);
  var seq = [ first, { pauseMs: pau }, second ];
  if (opts.aba) {
    seq.push({ pauseMs: pau });
    seq.push(first);
  }
  return seq;
}

// --- Tonwiedergabe ---
async function frq_playCurrent() {
  if (frq_currentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _frq_activePairIndicator();
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
  if (frq_currentEl === null) return;
  if (isPlay) {
    if (typeof testUI !== 'undefined' && testUI.tonePlayer) testUI.tonePlayer.stop();
    isPlay = false;
    await new Promise((r) => setTimeout(r, 60));
  }
  var _spi = _frq_activePairIndicator();
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

let _frq_timerInterval = null;
let _frq_timerStartTs  = 0;

function _frq_startTimer() {
  _frq_timerStartTs = Date.now();
  _frq_stopTimer();
  _frq_timerInterval = setInterval(_frq_tickTimer, 1000);
  _frq_tickTimer();
}
function _frq_stopTimer() {
  if (_frq_timerInterval) {
    clearInterval(_frq_timerInterval);
    _frq_timerInterval = null;
  }
}
function _frq_activeProgress() {
  return null;
}
function _frq_tickTimer() {
  const secs = Math.floor((Date.now() - _frq_timerStartTs) / 1000);
  const mm   = Math.floor(secs / 60);
  const ss   = secs % 60;
  const txt  = mm + ':' + (ss < 10 ? '0' : '') + ss;
  const _prog = _frq_activeProgress();
  if (_prog && _prog.timer) _prog.timer.textContent = txt;
}

// Nach 5 Min Inaktivität die Seitenabfrage erneut auslösen (statt den Test
// kommentarlos zu stoppen). Bei Erfolg wird der Idle-Watch neu gestartet,
// damit der Mechanismus nach jeder Bestätigung wieder aktiv ist; bei Abbruch
// durch den Nutzer wird der Test gestoppt.
function _frq_startIdleSideCheck() {
  testUI.sideCheck.startIdleWatch(_frq_parentEl, 5 * 60 * 1000, function() {
    if (!FRQ_running) return;
    testUI.sideCheck.run(
      { sides: 'both' },
      function() { _frq_startIdleSideCheck(); },
      function() { if (FRQ_els) FRQ_els._stopTest(); }
    );
  });
}

function frq_abort() {
  testUI.sideCheck.stopIdleWatch();
  _frq_simActive = false;
  frq_pianoActive = false;
  frq_isPlaying = false;
  if (frq_playTimeout) { clearTimeout(frq_playTimeout); frq_playTimeout = null; }
  _frq_stopTimer();
  FRQ_running   = false;
  frq_currentEl = null;
}

// --- Klavier-Verfahren (A1: nur erste Elektrode, Tonwiedergabe) ---
function frq_startPiano() {
  if (!FRQ_els) return;
  frq_sequence = frq_buildSequenceBoth();
  if (!frq_sequence.length) {
    alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden.');
    FRQ_els._stopTest(); return;
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _frq_doStartPiano,
    function() { if (FRQ_els) FRQ_els._stopTest(); }
  );
}

// ===== Klavier-Verfahren — Mess-Engine (A2a) =====
var FM_PIANO_STEPS = [250, 100, 50, 25, 10, 5];
var FM_PIANO_MAX_SPAN = 1200;   // ct: groessere Spanne -> verdaechtig, ausgeschlossen

// BA416: seitenloser Zugriff auf die globale Klaviertest-Session.
function _frq_pianoData() {
  if (!FRQ_pianoSession) {
    FRQ_pianoSession = { frqRefMode: null, run: null, perElectrode: {} };
  }
  return FRQ_pianoSession;
}

function _frq_randBorderOrder() {
  return (Math.random() < 0.5) ? ['lower', 'upper'] : ['upper', 'lower'];
}

// Bestaetigten Grenzwert lesen (cent) oder null.
function _frq_pianoBorderVal(elIdx, round, border) {
  var fp = _frq_pianoData();
  var pe = fp && fp.perElectrode && fp.perElectrode[elIdx];
  var r  = pe && pe.rounds && pe.rounds[round];
  return (r && typeof r[border] === 'number') ? r[border] : null;
}

// Bezugswert fuer den Runden-Start: Vorrunden-Wert derselben Grenze.
function _frq_pianoPrevBorder(elIdx, round, border) {
  if (round <= 1) return 0;
  var v = _frq_pianoBorderVal(elIdx, round - 1, border);
  return (v == null) ? 0 : v;
}

// Grenze speichern.
function _frq_pianoSetBorder(elIdx, round, border, cent) {
  var fp = _frq_pianoData();
  if (!fp.perElectrode[elIdx]) fp.perElectrode[elIdx] = { rounds: {} };
  if (!fp.perElectrode[elIdx].rounds[round]) fp.perElectrode[elIdx].rounds[round] = { lower: null, upper: null };
  fp.perElectrode[elIdx].rounds[round][border] = cent;
}

// Lauf anlegen oder fortsetzen (Pause/Resume innerhalb der Sitzung).
function _frq_pianoEnsureRun() {
  var fp = _frq_pianoData();
  var elList = frq_sequence.slice();
  // Resume: existiert ein Lauf -> unveraendert fortsetzen (kein Seiten-/
  // Konfig-Check mehr; BA416 Architektur 6a.3, Alt-Verwerf-Bug entfernt).
  if (fp.run) return;
  // BA417: referenzmodus direkt einfrieren (welche Seite beweglich ist).
  fp.frqRefMode = frq_referenzmodus();
  fp.run = {
    runId:        new Date().toISOString(),
    startedAt:    Date.now(),
    lastUpdate:   Date.now(),
    electrodeList: elList,
    currentRound: 1,
    roundOrder:   _frq_shuffle(elList),
    posInRound:   0,
    borderOrder:  _frq_randBorderOrder(),
    posInBorder:  0
  };
  fp.perElectrode = {};
}

function _frq_doStartPiano() {
  _frq_pianoEnsureRun();
  frq_pianoActive = true;
  FRQ_running   = true;
  _frq_pianoLoadStep();
  _frq_startIdleSideCheck();
}

// Aktuelle (Elektrode, Grenze) laden: Tastatur stellen, Box-Rolle setzen.
function _frq_pianoLoadStep() {
  var run = _frq_pianoData().run;
  if (!run) return;
  if (run.posInRound >= run.roundOrder.length) { _frq_pianoRoundTransition(); return; }

  var elIdx  = run.roundOrder[run.posInRound];
  var border = run.borderOrder[run.posInBorder];   // 'lower' | 'upper'
  var step   = FM_PIANO_STEPS[run.currentRound - 1];
  var center = _frq_pianoPrevBorder(elIdx, run.currentRound, border);

  frq_currentEl  = elIdx;
  frq_centOffset = center;

  var pr = _frq_pianoRefs();
  if (pr && typeof testUI !== 'undefined' && testUI.piano) {
    testUI.piano.setRound(pr, { stepCent: step, centerCent: center });
    // Bei Wiederholung (Zurueck) den zuvor bestaetigten Wert dieser Runde markieren.
    var prevThisRound = _frq_pianoBorderVal(elIdx, run.currentRound, border);
    if (prevThisRound != null) {
      _frq_pianoMarkCent(pr, prevThisRound);
      frq_centOffset = prevThisRound;
    }
  }
  // Zurueck-Knopf aktivieren, wenn in der Runde etwas zurueckliegt (BA356-fix).
  var _ub = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano
    && FRQ_els.verfahren.piano.actions && FRQ_els.verfahren.piano.actions.undo;
  if (_ub) _ub.disabled = !(run.posInRound > 0 || run.posInBorder > 0);

  _frq_pianoUpdateBoxes(border);
  _frq_pianoUpdateProgress();
}

// Eine Taste markieren, die dem Cent-Wert entspricht (falls im Fenster).
function _frq_pianoMarkCent(pr, cent) {
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
  var run = _frq_pianoData().run;
  if (!run) return;
  var pr = _frq_pianoRefs();
  if (!pr || pr.markedAbsCent == null) return;   // noch keine Taste gespielt

  var elIdx  = run.roundOrder[run.posInRound];
  var border = run.borderOrder[run.posInBorder];
  _frq_pianoSetBorder(elIdx, run.currentRound, border, pr.markedAbsCent);
  run.lastUpdate = Date.now();

  if (typeof FRQ_setActiveMethod === "function") FRQ_setActiveMethod("piano");
  _frq_pianoWriteResults();
  if (typeof FRQ_renderResults === "function") {
    try { FRQ_renderResults(); } catch (e) {}
  }

  run.posInBorder++;
  if (run.posInBorder >= 2) {
    run.posInBorder = 0;
    run.borderOrder = _frq_randBorderOrder();
    run.posInRound++;
  }
  if (run.posInRound >= run.roundOrder.length) _frq_pianoRoundTransition();
  else                                          _frq_pianoLoadStep();
}

// Zurueck: in der laufenden Runde eine Elektrode zurueck (bzw. aktuelle
// Elektrode neu beginnen). Eine abgeschlossene Runde wird nicht aufgerollt.
function frq_pianoBack() {
  if (!FRQ_running) return;
  var run = _frq_pianoData().run;
  if (!run) return;
  if (run.posInBorder > 0) {
    run.posInBorder = 0;
    run.borderOrder = _frq_randBorderOrder();
  } else if (run.posInRound > 0) {
    run.posInRound--;
    run.posInBorder = 0;
    run.borderOrder = _frq_randBorderOrder();
  } else {
    return; // Rundenanfang: nichts
  }
  _frq_pianoLoadStep();
}

// Runden-Uebergang: Modal (Runden 1..5) oder direkter Abschluss (nach Runde 6).
function _frq_pianoRoundTransition() {
  var run = _frq_pianoData().run;
  if (!run) return;
  if (run.currentRound >= FM_PIANO_STEPS.length) { _frq_pianoFinish(); return; }
  var curStep  = FM_PIANO_STEPS[run.currentRound - 1];
  var nextStep = FM_PIANO_STEPS[run.currentRound];
  _frq_pianoShowRoundModal(run.currentRound, FM_PIANO_STEPS.length, curStep, nextStep,
    function onNext() {
      run.currentRound++;
      run.roundOrder  = _frq_shuffle(run.electrodeList);
      run.posInRound  = 0;
      run.borderOrder = _frq_randBorderOrder();
      run.posInBorder = 0;
      _frq_pianoLoadStep();
    },
    function onFinish() { _frq_pianoFinish(); }
  );
}

function _frq_pianoFinish() {
  FRQ_running = false;
  _frq_pianoWriteResults();
  if (FRQ_els && typeof FRQ_els._stopTest === 'function') FRQ_els._stopTest();
}

// B1: Klavier-Ergebnisse aus dem Roh-Speicher nach FRQ_resultsArray (live).
// Ergebnis je Elektrode = Mittelwert der feinsten Runde mit BEIDEN Grenzen.
// (Plausibilitaets-Ausschluss kommt in B2.)
function _frq_pianoWriteResults() {
  if (typeof FRQ_resultsArray === "undefined") return;
  for (var i = FRQ_resultsArray.length - 1; i >= 0; i--) {
    if (FRQ_resultsArray[i] && frq_entryMethod(FRQ_resultsArray[i]) === "piano") FRQ_resultsArray.splice(i, 1);
  }
  var fp = _frq_pianoData();
  var run = fp && fp.run;
  if (!run || !fp.perElectrode) return;
  var frqRefMode = fp.frqRefMode;   // bei Testbeginn eingefroren (BA416)

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

    var entry = {
      elIdx:      elIdx,
      cent:       Math.round((frqRefMode === 'left') ? -pse : pse),
      frqRefMode: frqRefMode,
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
    FRQ_resultsArray.push(entry);
  });
}

function _frq_pianoUpdateBoxes(border) {
  var pi = _frq_pianoPairIndicator();
  if (!pi) return;
  var mode   = frq_referenzmodus();
  var roleUp = (border === 'lower') ? t('FRQ_pianoBoxLower') : t('FRQ_pianoBoxHigher');
  // Die vom User gesteuerte (anspielbare) Seite traegt die Rolle-Zeile.
  // asym: die im Dropdown gewaehlte Seite; symmetrisch: rechts (Festlegung).
  var hinweisSide = (mode === 'left') ? 'left' : 'right';

  function lines(side) {
    var ls = [ sideLetter(side), dENPrefix(side) + dEN(frq_currentEl, side) ];
    if (side === hinweisSide) ls.push(roleUp);
    return ls;
  }
  testUI.pairIndicator.setLabels(pi, { leftLines: lines('left'), rightLines: lines('right') });

  var instr = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano && FRQ_els.verfahren.piano.instruction;
  if (instr) {
    instr.innerHTML = t('FRQ_pianoInstruction').replace('{role}', roleUp.toLowerCase());
  }
}

// Zahl der bisher bestaetigten Grenzen (ueber alle Runden/Elektroden).
function _frq_pianoCountConfirmed() {
  var fp = _frq_pianoData();
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
function _frq_pianoUpdateProgress() {
  var els = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.piano
    && FRQ_els.verfahren.piano.progress;
  if (!els) return;
  var fp = _frq_pianoData();
  var run = fp && fp.run;
  if (!run) return;
  var m = run.roundOrder.length;
  var n = Math.min(run.posInRound + 1, m);
  var total = FM_PIANO_STEPS.length * run.electrodeList.length * 2;
  var done  = _frq_pianoCountConfirmed();
  var frac  = total > 0 ? done / total : 0;
  var txt = t('FRQ_pianoProgress')
    .replace('{n}', n).replace('{m}', m)
    .replace('{r}', run.currentRound).replace('{y}', FM_PIANO_STEPS.length);
  testUI.progress.set(els, { fraction: frac, text: txt });
}

// Runden-Uebergangs-Modal.
function _frq_pianoShowRoundModal(round, total, curStep, nextStep, onNext, onFinish) {
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
  _frq_stopTimer();
  FRQ_running   = false;
  frq_currentEl = null;
  if (FRQ_els && FRQ_els._stopTest) FRQ_els._stopTest();
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
}

// --- Elektroden-Ausschluss ---
function _frq_requestExclude() {
  if (!FRQ_running || frq_currentEl === null || !FRQ_els) return;
  setTestExclConfirm(FRQ_els.exclOverlay, dEN(frq_currentEl), function() {
    withSide('left',  function(){ elExDur[frq_currentEl] = true; });
    withSide('right', function(){ elExDur[frq_currentEl] = true; });
    frq_sequenceIdx++;
    _frq_pianoLoadStep();
  });
}

// --- i18n-Aktualisierung ---
function FRQ_applyLang() {
  if (!FRQ_els) return;
  _frq_refreshHighGainWarningVisibility();
  _frq_renderPrereqHints();
}

function _frq_evalTestEligibility() {
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

function _frq_autoSetRefMode() {
  if (!FRQ_els || !FRQ_els.header || !FRQ_els.header.refSelect) return;
  // Schutz: solange Daten vorliegen, refSelect nicht implizit umstellen —
  // ein manueller Wechsel ist durch depLock gesperrt (Popup mit Begründung).
  if (FRQ_resultsArray.length > 0) return;
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

function _frq_refreshHighGainWarningVisibility() {
  if (!FRQ_els) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen, wenn Test nicht ohnehin geblockt ist.
  const blocked = _frq_evalTestEligibility().blocked;
  const visible = hasHG && !blocked;
  testUI.explain.setVisible(FRQ_els, 'FRQ_highGainWarnPara', visible);
}


// BA 251: jRes entfaellt; Lautstaerke-Daten = ELL_results.
function _frq_hasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.ELL_results && s.ELL_results.length > 0);
}

function _frq_renderPrereqHints() {
  const elsLeftEl  = document.getElementById('FRQ_prereqLvLeftPara');
  const elsRightEl = document.getElementById('FRQ_prereqLvRightPara');
  const sbEl      = document.getElementById('FRQ_prereqSbHintPara');
  if (elsLeftEl)  elsLeftEl.style.display  = _frq_hasLvData('left')  ? 'none' : '';
  if (elsRightEl) elsRightEl.style.display = _frq_hasLvData('right') ? 'none' : '';
  if (sbEl) {
    const hasSb = typeof STB_results !== 'undefined'
               && STB_results
               && Object.keys(STB_results).length > 0;
    sbEl.style.display = hasSb ? 'none' : '';
  }
}

function _FRQ_refreshTabState() {
  if (!FRQ_els) return;
  if (!FRQ_running) {
    _frq_autoSetRefMode();
  }
  _frq_refreshHighGainWarningVisibility();
  _frq_renderPrereqHints();
}

// BA353: Aktives Frequenzabgleich-Verfahren.
// Bestimmt, welches Verfahren Ergebnisgraph, Player (Warp) und Druck speist.
// null = noch nicht gesetzt -> Default wird aus den Daten abgeleitet.
let FRQ_activeMethodValue = null;

// Method-Kennung eines Eintrags. Konvention: nur "slider" ist Schieber,
// alles andere (inkl. fehlend) zaehlt als "adaptive" (Altstaende ohne Feld).
function frq_entryMethod(r) {
  if (r && r.method === "piano")  return "piano";
  if (r && r.method === "slider") return "slider";
  return "adaptive";
}

// Hat ein Verfahren ueberhaupt Daten? (fuer Default-Ableitung, aktuell ungenutzt)
function frq_methodHasData(method) {
  if (method !== "piano") return false;
  if (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) {
    for (let i = 0; i < FRQ_resultsArray.length; i++) {
      if (FRQ_resultsArray[i] && frq_entryMethod(FRQ_resultsArray[i]) === "piano") return true;
    }
  }
  if (FRQ_pianoSession && FRQ_pianoSession.perElectrode
      && Object.keys(FRQ_pianoSession.perElectrode).length > 0) return true;
  return false;
}

// Aktiv geltendes Verfahren. Klavier-only-Betrieb (BA363): immer "piano".
// Der gespeicherte FRQ_activeMethodValue bleibt unangetastet (Reaktivierung von
// Adaptiv/Slider ist ein reiner Sichtbarkeits-Schritt). Architektur 10.1.
function frq_getActiveMethod() {
  return "piano";
}

// EINZIGE Schreibstelle fuer den Aktiv-Zustand. "Letzte Aktion gewinnt":
// jede Bestaetigung (Trigger) und jeder Button-Klick ruft das hier.
// Refresh (Graph + Player-Warp) nur bei echtem Wechsel.
function FRQ_setActiveMethod(m) {
  if (m !== "piano") return;
  const changed = (FRQ_activeMethodValue !== m);
  FRQ_activeMethodValue = m;
  if (typeof frq_updateActiveMethodButtons === "function") frq_updateActiveMethodButtons();
  if (!changed) return;
  if (typeof FRQ_renderResults === "function") {
    try { FRQ_renderResults(); } catch (e) {}
  }
  if (typeof pWarpTrigger === "function") {
    try { pWarpTrigger(); } catch (e) {}
  }
}

// Hervorhebung der zwei Umschalt-Buttons (Vorbild: updPlSrcButtons).
function frq_updateActiveMethodButtons() {
  const method = frq_getActiveMethod();
  const map = [
    { id: "FRQ_activeMethodPianoBtn", m: "piano" }
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

// --- DOMContentLoaded ---
document.addEventListener("DOMContentLoaded", () => {
  const parentEl = document.getElementById("subpanel-messungen-freqmatch");
  if (!parentEl) return;
  _frq_parentEl = parentEl;

  const frq_cfg = {
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
        { key: 'FRQ_highGainWarn',               kind: 'warn',    id: 'FRQ_highGainWarnPara',
                                         hidden: true },

        // Voraussetzungen — bleiben bedingt sichtbar (durch _frq_renderPrereqHints).
        { key: 'FRQ_prereqLvLeft',         kind: 'warn',    id: 'FRQ_prereqLvLeftPara'    },
        { key: 'FRQ_prereqLvRight',        kind: 'warn',    id: 'FRQ_prereqLvRightPara'   },
        { key: 'FRQ_prereqSb',             kind: 'warn',    id: 'FRQ_prereqSbHintPara'    },

        // Gruppe 1: beidseitiges CI.
        { key: 'FRQ_groupBothCi',          kind: 'heading' },
        { key: 'FRQ_hintMethodBothCI',     kind: 'plain' },
        { key: 'FRQ_hintWarnBothCI',       kind: 'caution' },

        // Gruppe 2: CI + akustische Gegenseite.
        { key: 'FRQ_groupCiAcoustic',      kind: 'heading' },
        { key: 'FRQ_hintMethodCiNatural',  kind: 'plain' },
        { key: 'FRQ_hintWarn',             kind: 'caution' },

        // BA364: Vor-Schaetzung/Adaptiv-Workflow im Klavier-only-Betrieb aus.
        { key: 'FRQ_hintWorkflow',         kind: 'plain', id: 'FRQ_hintWorkflowPara',
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
            if (FRQ_running && frq_currentEl != null) {
              return frq_makeSequence({ aba: frq_isAbaSequence() });
            }
            // BA 301: jede Seite mit zentraler Korrektur (Elektrodenlautstaerke
            // + Balance); taube Seite stumm (isDeaf) wie beim Klavier.
            var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
            var vol = FRQ_getVolume();
            var dur = FRQ_getDuration();
            var pau = FRQ_getPause();
            var aktivSide = activeSide;
            var gegenSide = (activeSide === 'left') ? 'right' : 'left';
            var aktivPan  = (aktivSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an);
            // taube Seite stumm (isDeaf) wie beim Klavier. pan kodiert die Seite.
            var _frq_correctVolume = function (side, pan) {
              if (typeof isDeaf === 'function' && isDeaf(side)) return 0;
              return (typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hz, pan) : vol;
            };
            return [
              { hz: hz, pan: aktivPan,  vol: _frq_correctVolume(aktivSide, aktivPan),  durationMs: dur },
              { pauseMs: pau },
              { hz: hz, pan: -aktivPan, vol: _frq_correctVolume(gegenSide, -aktivPan), durationMs: dur }
            ];
          },
          // BA 228/229: Klavier-Widget in der Modalbox aktivieren.
          // BA 252: beidseitige Disabled-Logik, kein elActive-Filter hier.
          keyboardMode: true,
          getElectrodeFreqs: function() {
            // Anzahl Tasten = Minimum aus aktiver und Gegenseite.
            // Frequenzen kommen von der aktiven Seite. Kein Filter auf
            // elActive/elExDur -- das macht getDisabledElectrodes.
            var aktivSide = activeSide;
            var gegenSide = (activeSide === 'left') ? 'right' : 'left';
            var nAktiv = sideData[aktivSide] ? sideData[aktivSide].nEl : 0;
            var nGegen = sideData[gegenSide] ? sideData[gegenSide].nEl : 0;
            var n  = Math.min(nAktiv, nGegen);
            if (n <= 0) return [];
            var freqs = [];
            withSide(aktivSide, function() {
              for (var i = 0; i < n; i++) freqs.push(FRQ_implantatEffektiv(i));
            });
            return freqs;
          },
          getElectrodeLabels: function() {
            var aktivSide = activeSide;
            var gegenSide = (activeSide === 'left') ? 'right' : 'left';
            var nAktiv = sideData[aktivSide] ? sideData[aktivSide].nEl : 0;
            var nGegen = sideData[gegenSide] ? sideData[gegenSide].nEl : 0;
            var n  = Math.min(nAktiv, nGegen);
            if (n <= 0) return [];
            var labels = [];
            withSide(aktivSide, function() {
              var prefix = dENPrefix();
              for (var i = 0; i < n; i++) labels.push(prefix + dEN(i));
            });
            return labels;
          },
          getDisabledElectrodes: function() {
            // Disabled = auf aktiver ODER Gegenseite abgewaehlt
            // (elActive === false) oder ausgeschlossen (elExDur !== null).
            var aktivSide = activeSide;
            var gegenSide = (activeSide === 'left') ? 'right' : 'left';
            var sdAktiv = sideData[aktivSide], sdGegen = sideData[gegenSide];
            if (!sdAktiv || !sdGegen) return [];
            var n = Math.min(sdAktiv.nEl || 0, sdGegen.nEl || 0);
            var dis = [];
            for (var i = 0; i < n; i++) {
              var off = (sdAktiv.elActive && sdAktiv.elActive[i] === false)
                     || (sdAktiv.elExDur  && sdAktiv.elExDur[i]  != null)
                     || (sdGegen.elActive && sdGegen.elActive[i] === false)
                     || (sdGegen.elExDur  && sdGegen.elExDur[i]  != null);
              if (off) dis.push(i);
            }
            return dis;
          },
          // BA 229: Aufleucht-Dauer = volle Sequenz (erster Burst + Pause +
          // zweiter Burst), passt zur Anschlag-Logik in onPress.
          getHighlightMs: function() { return FRQ_getDuration() * 2 + FRQ_getPause(); },
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _frq_keyboardT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt      = (frq_modalTone !== null) ? frq_modalTone : toneType_freqmatch;
            var vol     = FRQ_getVolume();
            var aktivSide = activeSide;
            var aktivPan  = (aktivSide === 'left') ? -1 : 1;
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volAktiv  = isDeaf(aktivSide) ? 0
              : ((typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hz, aktivPan) : vol);
            try {
              playToneTyped(c, hz, volAktiv, 60000, aktivPan, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (typeof stopAll === 'function') stopAll();
            if (!c) return;
            var t1   = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var held = Math.max(0, t1 - _frq_keyboardT0);
            if (held <= 0) return;
            var tt      = (frq_modalTone !== null) ? frq_modalTone : toneType_freqmatch;
            var vol     = FRQ_getVolume();
            var aktivSide = activeSide;
            var gegenSide = (activeSide === 'left') ? 'right' : 'left';
            var gegenPan  = (aktivSide === 'left') ? 1 : -1;
            // Eingestellte Frequenz der Elektrode auf der Gegenseite (kann
            // sich von der aktiven Seite unterscheiden).
            var hzGegen;
            if (electrodeIdx >= 0) {
              var nGegen = sideData[gegenSide] ? sideData[gegenSide].nEl : 0;
              var idxGegen = electrodeIdx < nGegen ? electrodeIdx : nGegen - 1;
              hzGegen = withSide(gegenSide, function () { return FRQ_implantatEffektiv(idxGegen); });
            } else {
              hzGegen = hz;
            }
            // BA 304: ueber die schalter-abhaengige Korrektor-fn (Default an).
            var volGegen = isDeaf(gegenSide) ? 0
              : ((typeof frq_keyboardCorrectVolume === 'function') ? frq_keyboardCorrectVolume(vol, hzGegen, gegenPan) : vol);
            try {
              playToneTyped(c, hzGegen, volGegen, held, gegenPan, tt);
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
            _frq_onSelectionChanged();
          },
          getElectrodeStatus: function() {
            var testable = [], muted = [], excluded = [];
            var nL = sideData.left  ? sideData.left.nEl  : 0;
            var nR = sideData.right ? sideData.right.nEl : 0;
            var n  = Math.min(nL, nR);
            for (var i = 0; i < n; i++) {
              var st = frq_electrodeStatusBoth(i);
              if (st === 'excluded')   excluded.push(i);
              else if (st === 'muted') muted.push(i);
              else                     testable.push(i);
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
    ]
  };

  FRQ_els = buildTestPanel(parentEl, frq_cfg);

  // Texte initial setzen
  FRQ_applyLang();

  if (!FRQ_running) _frq_autoSetRefMode();
  _frq_refreshHighGainWarningVisibility();
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
