// ============================================================
// FREQUENZABGLEICH – ADAPTIVER STAIRCASE-KERN
// ============================================================
// Pure-Function-Modul ohne DOM-Bezug.
// Methodik nach docs/spec/02b-freqmatch-adaptiv.md
// (Bauanleitung 02b/3 = Bauanleitung 74)
// ============================================================

// --- Konstanten ---
const FM_STEP_SEQUENCE = [50, 25, 12, 6, 3];   // Schrittweiten in cent
const FM_STEP_MIN      = 3;                    // Minimale Schrittweite
const FM_REVERSALS_REQ = 6;                    // Umkehrungen für Match
const FM_RESIDUAL_OK   = 10;                   // Residuum für saubere Konvergenz (cent)
const FM_STABLE_DELTA  = 2;                    // Residuums-Stabilität für noisy (cent)
const FM_TRIAL_CAP     = 80;                   // Hard cap pro Track

// Catch-Trial-Konstanten (Bauanleitung 02b/6)
const FM_CATCH_INTERVAL     = 8;     // Catch-Trial-Abstand pro Track (deterministisch)
const FM_CATCH_PHASE        = 5;     // Track-Trial-Index des ersten Catch (0-basiert: Trial 5, 13, 21 …)
const FM_CATCH_MAGNITUDE    = 500;   // cent — Auslenkung in Catch
const FM_NOT_PERC_MIN_CATCH = 3;     // mind. Catch-Trials vor Konvergenz-Freigabe
const FM_NOT_PERC_ERR_RATE  = 0.5;  // Catch-Fehlerrate für not-perceivable
const FM_PROVISIONAL_MATCH_MIN = 2; // ab so vielen Umkehrungen Schätz-Match
const FM_PROVISIONAL_RESID_MIN = 4; // ab so vielen Umkehrungen Schätz-Residuum

// --- Track-State erzeugen ---
//
// electrodeIdx: Elektroden-Index in nEl der variablen Seite
// prevMatchCent: vorhandener Cent-Offset aus alter Messung, oder null
// rng: optionale Random-Funktion (default Math.random) — für Tests
function fmCreateTrack(electrodeIdx, prevMatchCent, rng) {
  const r = rng || Math.random;
  // Startwert: ±50 cent um alten Match, oder ±100 cent um 0 (Soll)
  const base = (prevMatchCent != null && isFinite(prevMatchCent)) ? prevMatchCent : 0;
  const spread = (prevMatchCent != null && isFinite(prevMatchCent)) ? 50 : 100;
  const startOffset = base + (r() * 2 - 1) * spread;
  return {
    electrodeIdx:     electrodeIdx,
    // currentOffset: cent-Offset der REF-Frequenz relativ zur var-Soll-Frequenz.
    // Positiv = ref liegt höher als var. Var-Seite bleibt statisch auf effFreq(i),
    // damit die CI-Elektrode unverändert angeregt wird.
    currentOffset:    startOffset,
    stepSize:         FM_STEP_SEQUENCE[0],
    pendingResponse:  null,           // 'var-higher' | 'var-lower' | null
    lastMoveDir:      null,           // 'up' | 'down' | null (Richtung der letzten BEWEGUNG)
    reversals:        [],             // cent-Werte an Umkehrpunkten
    trialHistory:     [],             // [{ trial, varOffset, response, isCatch, catchCorrect, firstSide }]
    trialCount:       0,
    catchTotal:       0,
    catchErrors:      0,
    status:           'active',       // 'active' | 'converged' | 'converged-noisy' | 'not-perceivable'
    match:            null,           // cent (nur wenn konvergiert)
    residual:         null            // cent (nur wenn konvergiert)
  };
}

// --- Trial-Reihenfolge: geshuffelter Round-Robin ---
//
// state.roundQueue: aktuell laufende Runde (Restliste an Elektroden-IDs,
//                   die in dieser Runde noch drankommen).
// state.tracks:     wie bisher { [electrodeIdx]: trackState }
// rng:              optionale Random-Funktion (default Math.random)
//
// Ablauf: solange `roundQueue` Einträge hat, wird der erste
// genommen (FIFO). Beim Übergang einer neuen Runde wird die
// Liste aller aktiven Track-IDs gezogen und in zufälliger
// Reihenfolge in `roundQueue` geschrieben. Tracks, die innerhalb
// der laufenden Runde konvergieren, werden beim Pop übersprungen.
//
// returns: electrodeIdx (Number) oder null wenn alle abgeschlossen
function fmPickNextTrack(state, rng) {
  // Rückwärtskompatibilität: alter Aufruf mit tracks-Objekt direkt
  // statt Wrapper-State. In dem Fall wird ein flüchtiger Wrapper
  // benutzt; State des Aufrufers geht verloren.
  if (state && state.electrodeIdx === undefined && state.tracks === undefined) {
    state = { tracks: state, roundQueue: [] };
  }

  const r = rng || Math.random;
  const tracks = state.tracks || {};
  const activeIds = Object.keys(tracks)
    .filter(function(k) { return tracks[k].status === 'active'; })
    .map(function(k) { return parseInt(k, 10); });
  if (activeIds.length === 0) return null;

  // Aus der Restliste die nächste noch aktive ID nehmen.
  while (state.roundQueue && state.roundQueue.length > 0) {
    const cand = state.roundQueue.shift();
    if (tracks[cand] && tracks[cand].status === 'active') {
      return cand;
    }
  }

  // Neue Runde: aktive IDs in zufälliger Reihenfolge in die Queue
  // schreiben. Fisher-Yates-Shuffle.
  const shuffled = activeIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  state.roundQueue = shuffled;
  return state.roundQueue.shift();
}

// --- Antwort verarbeiten (2-down-1-up, transformed) ---
//
// track:    mutable Track-State (wird in-place verändert)
// response: 'var-higher' | 'var-lower'
// isCatch:  true falls dieser Trial ein Catch war (kein Stair-Update)
// catchCorrect: bei isCatch=true: hat der User korrekt geantwortet?
// firstSide:    'ref' | 'var' — welche Seite zuerst gespielt wurde
//
// Rückgabe: aktualisierter status (siehe checkConvergence)
function fmApplyResponse(track, response, isCatch, catchCorrect, firstSide) {
  if (track.status !== 'active') return track.status;

  // Trial in History eintragen
  track.trialHistory.push({
    trial:        track.trialCount + 1,
    varOffset:    track.currentOffset,
    response:     response,
    isCatch:      !!isCatch,
    catchCorrect: !!catchCorrect,
    firstSide:    firstSide || null
  });
  track.trialCount++;

  if (isCatch) {
    // Catch-Trials zählen NICHT für Staircase-Bewegung
    track.catchTotal++;
    if (!catchCorrect) track.catchErrors++;
    // Convergence-Check (für "not-perceivable" relevant, kommt in 02b/6)
    return _fmCheckAndUpdateStatus(track);
  }

  // Antwort-Interpretation (REF-Frequenz wird geschoben, var bleibt fest):
  //   'var-higher' → User hört var höher als ref → ref-Frequenz war zu tief
  //                  → wir wollen ref ANHEBEN (up, positive cent-Bewegung)
  //   'var-lower'  → User hört var tiefer als ref → ref-Frequenz war zu hoch
  //                  → wir wollen ref SENKEN (down, negative cent-Bewegung)
  const adjustDir = (response === 'var-higher') ? 'up' : 'down';

  if (track.pendingResponse === null) {
    // Erste Antwort der Sequenz: nur speichern, nicht bewegen.
    track.pendingResponse = response;
    return _fmCheckAndUpdateStatus(track);
  }

  // Zweite Antwort der Sequenz: bewegen
  // — bei "2 gleiche":   bewege in Antwort-Richtung (= adjustDir)
  // — bei "1 abweichende": bewege in NEUE Antwort-Richtung (= adjustDir)
  // Beide Fälle: Bewegung in adjustDir, Umkehr-Erkennung über lastMoveDir.

  // Umkehrungs-Erkennung: Bewegung wechselt die Richtung
  if (track.lastMoveDir && track.lastMoveDir !== adjustDir) {
    track.reversals.push(track.currentOffset);
    // Schrittweite halbieren bis Minimum
    track.stepSize = _fmHalfStep(track.stepSize);
  }

  // Schritt ausführen
  const sign = (adjustDir === 'up') ? +1 : -1;
  track.currentOffset += sign * track.stepSize;
  track.lastMoveDir = adjustDir;
  track.pendingResponse = null;

  return _fmCheckAndUpdateStatus(track);
}

// --- Schrittweiten-Halbierung gemäß Sequenz 50→25→12→6→3 ---
function _fmHalfStep(currentStep) {
  // FM_STEP_SEQUENCE ist die kanonische Folge. Wir suchen das nächstkleinere
  // Element, gefloort auf das nächste in der Folge.
  const idx = FM_STEP_SEQUENCE.indexOf(currentStep);
  if (idx >= 0 && idx < FM_STEP_SEQUENCE.length - 1) {
    return FM_STEP_SEQUENCE[idx + 1];
  }
  // Falls der aktuelle Wert nicht in der Folge ist (sollte nicht passieren):
  // halbieren, mindestens FM_STEP_MIN
  return Math.max(FM_STEP_MIN, Math.floor(currentStep / 2));
}

// --- Match (Mittel der letzten 6 Umkehrungen) ---
function fmComputeMatch(track) {
  if (track.reversals.length < FM_REVERSALS_REQ) return null;
  const last6 = track.reversals.slice(-FM_REVERSALS_REQ);
  let sum = 0;
  for (let i = 0; i < last6.length; i++) sum += last6[i];
  return sum / last6.length;
}

// --- Residuum (halbe Spanne der letzten 6 Umkehrungen) ---
function fmComputeResidual(track) {
  if (track.reversals.length < FM_REVERSALS_REQ) return null;
  const last6 = track.reversals.slice(-FM_REVERSALS_REQ);
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < last6.length; i++) {
    if (last6[i] > max) max = last6[i];
    if (last6[i] < min) min = last6[i];
  }
  return (max - min) / 2;
}

// --- Konvergenz-/Endzustands-Check ---
//
// Schreibt status / match / residual auf den Track, wenn ein Endzustand
// erreicht ist. Gibt den (ggf. aktualisierten) status zurück.
//
function _fmCheckAndUpdateStatus(track) {
  if (track.status !== 'active') return track.status;

  // Not-perceivable-Check: immer, unabhängig von Umkehr-Zahl und Konvergenz-Status.
  // Verhindert, daß Zufallsantworten trotz hoher Catch-Fehlerrate als Ergebnis
  // durchgehen.
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status = 'not-perceivable';
      return track.status;
    }
  }

  // Konvergenz erst erlauben, wenn mind. FM_NOT_PERC_MIN_CATCH Catch-Trials
  // für diesen Track absolviert wurden. Verhindert Früh-Konvergenz bei
  // Zufallsantworten (die Catch-Statistik muß aussagekräftig sein).
  if (track.catchTotal < FM_NOT_PERC_MIN_CATCH) {
    if (track.trialCount < FM_TRIAL_CAP) return 'active';
    // Hard-Cap erreicht, aber Catch-Daten fehlen → unbrauchbar
    track.status = 'not-perceivable';
    return track.status;
  }

  // Saubere Konvergenz: ≥6 Umkehrungen, Schrittweite am Minimum,
  // Residuum klein.
  if (track.reversals.length >= FM_REVERSALS_REQ && track.stepSize === FM_STEP_MIN) {
    const residual = fmComputeResidual(track);
    if (residual != null && residual <= FM_RESIDUAL_OK) {
      track.status   = 'converged';
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      return track.status;
    }
    if (_fmResidualStable(track)) {
      track.status   = 'converged-noisy';
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      return track.status;
    }
  }

  // Hard cap: ≥80 Trials ohne Konvergenz
  if (track.trialCount >= FM_TRIAL_CAP) {
    if (track.reversals.length >= FM_REVERSALS_REQ) {
      track.status   = 'converged-noisy';
      track.match    = fmComputeMatch(track);
      track.residual = fmComputeResidual(track);
      return track.status;
    }
    track.status   = 'converged-noisy';
    track.match    = (track.reversals.length > 0) ? fmComputeMatch(track) : track.currentOffset;
    track.residual = fmComputeResidual(track);
    return track.status;
  }

  return 'active';
}

// --- Residuums-Stabilität für "converged-noisy" ---
//
// Spec: "letzte 4 Umkehr-Residuen ändern sich um < FM_STABLE_DELTA cent".
// Interpretation: 4 rollende Residuen über je 6 aufeinanderfolgende
// Umkehrungen. Wir brauchen also mindestens 9 Umkehrungen, um 4 rollende
// Fenster zu haben.
function _fmResidualStable(track) {
  const need = FM_REVERSALS_REQ + 3;   // 9 Umkehrungen für 4 rollende Fenster
  if (track.reversals.length < need) return false;
  const rs = [];
  for (let i = track.reversals.length - 4; i < track.reversals.length; i++) {
    const window = track.reversals.slice(i - FM_REVERSALS_REQ + 1, i + 1);
    let max = -Infinity, min = Infinity;
    for (let j = 0; j < window.length; j++) {
      if (window[j] > max) max = window[j];
      if (window[j] < min) min = window[j];
    }
    rs.push((max - min) / 2);
  }
  for (let i = 1; i < rs.length; i++) {
    if (Math.abs(rs[i] - rs[i - 1]) >= FM_STABLE_DELTA) return false;
  }
  return true;
}

// --- Statistik-Helfer für UI/Storage ---
function fmTrackSummary(track) {
  return {
    electrodeIdx: track.electrodeIdx,
    status:       track.status,
    match:        track.match,
    residual:     track.residual,
    trialCount:   track.trialCount,
    catchTotal:   track.catchTotal,
    catchErrors:  track.catchErrors,
    reversalCount: track.reversals.length,
    stepSize:     track.stepSize,
    currentOffset: track.currentOffset
  };
}

// --- Vorläufige Schätzung für laufende Tracks (Bauanleitung 85) ---
function fmComputeProvisional(track) {
  const revCount = (track.reversals && track.reversals.length) || 0;
  const trials   = track.trialCount || 0;
  if (track.status !== 'active') {
    return { status: null, match: null, residual: null, reversals: revCount, trials: trials };
  }
  if (revCount < FM_PROVISIONAL_MATCH_MIN) {
    return { status: 'in-progress-early', match: null, residual: null,
             reversals: revCount, trials: trials };
  }
  let sum = 0;
  for (let i = 0; i < track.reversals.length; i++) sum += track.reversals[i];
  const match = sum / track.reversals.length;
  let residual = null;
  if (revCount >= FM_PROVISIONAL_RESID_MIN) {
    let max = -Infinity, min = Infinity;
    for (let i = 0; i < track.reversals.length; i++) {
      if (track.reversals[i] > max) max = track.reversals[i];
      if (track.reversals[i] < min) min = track.reversals[i];
    }
    residual = (max - min) / 2;
  }
  return { status: 'in-progress', match: match, residual: residual,
           reversals: revCount, trials: trials };
}
