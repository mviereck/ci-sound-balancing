// ============================================================
// FREQUENZABGLEICH – ADAPTIVER STAIRCASE-KERN
// ============================================================
// Pure-Function-Modul ohne DOM-Bezug.
// Methodik nach docs/spec/02b-freqmatch-adaptiv.md
//
// Verfahren: 2I-2AFC mit adaptiver 1-down-1-up-Regel nach Levitt (1971).
// Konvergiert direkt auf den PSE (50%-Punkt) = Match-Punkt. Eine
// Staircase pro Elektrode pro Lauf; Bracketing über mehrere Läufe
// (gepaarte alternierende Startwerte ±100 ct) — wird im Aufrufer
// (freqmatch.js) verwaltet, nicht hier.
// ============================================================

// --- Konstanten ---
const FM_STEP_SEQUENCE = [50, 25, 12, 6, 3];   // Schrittweiten in cent
const FM_STEP_MIN      = 3;                    // Minimale Schrittweite
const FM_REVERSALS_REQ = 8;                    // Umkehrungen für Match (1-down-1-up: erhöht)
const FM_REVERSALS_WIN = 6;                    // Fenstergröße für Match/Residuum (letzte 6)
const FM_RESIDUAL_OK   = 10;                   // converged-Schwelle (cent)
const FM_RESIDUAL_FAIR = 25;                   // converged-fair-Schwelle (cent)
const FM_RESIDUAL_WIDE = 50;                   // converged-wide-Schwelle (cent)
const FM_TRIAL_CAP     = 80;                   // Hard cap pro Track

// Catch-Trial-Konstanten
const FM_CATCH_INTERVAL     = 8;     // Catch-Trial-Abstand pro Track (deterministisch)
const FM_CATCH_PHASE        = 5;     // Track-Trial-Index des ersten Catch (Trial 5, 13, 21 …)
const FM_CATCH_MAGNITUDE    = 500;   // cent — Untergrenze der Catch-Spreizung
const FM_NOT_PERC_MIN_CATCH = 3;     // mind. Catch-Trials vor Konvergenz-Freigabe
const FM_NOT_PERC_ERR_RATE  = 2/3;   // Catch-Fehlerrate für not-perceivable (≥ 67 %)

// Vorläufige Anzeige
const FM_PROVISIONAL_MATCH_MIN = 2;  // ab so vielen Umkehrungen Schätz-Match
const FM_PROVISIONAL_RESID_MIN = 4;  // ab so vielen Umkehrungen Schätz-Residuum

// Anker-Randomisierung statt Round-Robin, wenn Pool klein
const FM_ANCHOR_SMALL_POOL = 4;

// Catch-up-Priorisierung (BA 105): Tracks mit weniger als
// FM_CATCHUP_REVERSALS_THRESHOLD Umkehrungen werden pro Runde mit einem
// zusätzlichen Bonus-Trial bedacht (falls es andere Tracks gibt, die
// bereits weiter sind). Schwelle 2 entspricht der `in-progress`-Grenze:
// wer noch <2 Umkehrungen hat, liefert noch kein Zwischenergebnis.
const FM_CATCHUP_REVERSALS_THRESHOLD = 2;

// Folgelauf-Bracketing (BA 104): bei Lauf 2+ startet jeder Track aus
// Vorlauf-Match ± FM_FOLLOWUP_BRACKET_OFFSET (cent), Vorzeichen gepaart
// alternierend. Liegt deutlich enger als ±100, weil der Vorlauf-Match
// selbst schon nahe am echten PSE ist.
const FM_FOLLOWUP_BRACKET_OFFSET = 25;

// --- Track-State erzeugen ---
//
// electrodeIdx: Elektroden-Index in nEl der variablen Seite
// startSign:    +1 oder −1 (Bracketing-Vorzeichen pro Lauf).
// startOffset:  optionaler Override des Startoffsets (cent). Wenn
//               angegeben, wird er direkt als startOffset/currentOffset
//               verwendet. Wenn nicht angegeben, ergibt sich startOffset
//               aus startSign · 100 cent (alte Voreinstellung).
//               Verwendung in freqmatch.js fmStartAdaptive:
//                 - Lauf 1 mit Slider-Schätzung: startOffset = schätzung.cent
//                 - Lauf 2+ mit Vorlauf-Match:   startOffset = match ± FM_FOLLOWUP_BRACKET_OFFSET
//                 - Sonst: kein Override, klassisches ±100.
function fmCreateTrack(electrodeIdx, startSign, startOffset) {
  const START_MAG = 100;
  const sign      = (startSign === -1) ? -1 : +1;
  const effOffset = (typeof startOffset === 'number' && isFinite(startOffset))
    ? Math.round(startOffset)
    : sign * START_MAG;
  return {
    electrodeIdx:    electrodeIdx,
    startSign:       sign,
    startOffset:     effOffset,
    currentOffset:   effOffset,
    stepSize:        FM_STEP_SEQUENCE[0],
    lastMoveDir:     null,
    reversals:       [],
    trialHistory:    [],
    trialCount:      0,
    catchTotal:      0,
    catchErrors:     0,
    status:          'active',       // 'active' | 'converged' | 'converged-fair' |
                                     // 'converged-wide' | 'unstable' |
                                     // 'not-perceivable' | 'aborted'
    match:           null,
    residual:        null
  };
}

// --- Trial-Reihenfolge: geshuffelter Round-Robin ---
//
// state.roundQueue: aktuell laufende Runde (Restliste an Track-Keys).
// state.tracks:     { [trackKey]: trackState }
// rng:              optionale Random-Funktion (default Math.random)
// lastPickedKey:    für Wiederholungs-Sperre im kleinen Pool
//
// returns: trackKey (String) oder null wenn alle abgeschlossen
function fmPickNextTrack(state, rng, lastPickedKey) {
  // Rückwärtskompatibilität: alter Aufruf mit tracks-Objekt direkt
  if (state && state.electrodeIdx === undefined && state.tracks === undefined) {
    state = { tracks: state, roundQueue: [] };
  }

  const r = rng || Math.random;
  const tracks = state.tracks || {};
  const activeIds = Object.keys(tracks)
    .filter(function(k) { return tracks[k].status === 'active'; });
  if (activeIds.length === 0) return null;

  // --- Anker-Randomisierung im kleinen Restpool ---
  if (activeIds.length < FM_ANCHOR_SMALL_POOL) {
    state.roundQueue = [];

    let candidates = activeIds;
    if (lastPickedKey != null && activeIds.length > 1) {
      const filtered = activeIds.filter(function(k) { return k !== lastPickedKey; });
      if (filtered.length > 0) candidates = filtered;
    }
    return candidates[Math.floor(r() * candidates.length)];
  }

  // --- Normaler Modus: geshuffelter Round-Robin ---
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

  // --- Catch-up-Priorisierung (BA 105) ---
  // Tracks mit <FM_CATCHUP_REVERSALS_THRESHOLD Umkehrungen sind „lagging"
  // (liefern noch kein Zwischenergebnis). Wenn es solche gibt UND
  // mindestens ein anderer Track schon weiter ist, wird einer der
  // lagging Tracks per Bonus-Trial der Runde vorangestellt.
  //
  // Anti-Wiederholungs-Sperre: der Bonus-Track darf nicht unmittelbar
  // vor seinem regulären Runden-Eintrag liegen. Wenn er nach dem
  // Shuffle zufällig schon an Position 0 steht, tausche ihn mit
  // Position 1, bevor der Bonus vorangestellt wird.
  const lagging = activeIds.filter(function(k) {
    const tr = tracks[k];
    return tr && (tr.reversals.length || 0) < FM_CATCHUP_REVERSALS_THRESHOLD;
  });
  const hasAdvanced = activeIds.some(function(k) {
    const tr = tracks[k];
    return tr && (tr.reversals.length || 0) >= FM_CATCHUP_REVERSALS_THRESHOLD;
  });
  if (lagging.length > 0 && hasAdvanced) {
    const bonusKey = lagging[Math.floor(r() * lagging.length)];
    // Wenn Bonus-Track aktuell an Index 0 der Runde steht: mit Index 1
    // tauschen, damit nach dem Bonus ein anderer Track kommt.
    if (state.roundQueue.length >= 2 && state.roundQueue[0] === bonusKey) {
      const tmp = state.roundQueue[0];
      state.roundQueue[0] = state.roundQueue[1];
      state.roundQueue[1] = tmp;
    }
    // Bonus voranstellen.
    state.roundQueue.unshift(bonusKey);
  }

  return state.roundQueue.shift();
}

// --- Antwort verarbeiten (1-down-1-up) ---
//
// track:    mutable Track-State (wird in-place verändert)
// response: 'var-higher' | 'var-lower'
// isCatch:  true falls dieser Trial ein Catch war (kein Stair-Update)
// catchCorrect: bei isCatch=true: hat der User korrekt geantwortet?
// firstSide:    'ref' | 'var' — welche Seite zuerst gespielt wurde
//
// Bewegt nach jeder Antwort die Referenz-Frequenz in Antwort-Richtung.
// Schrittweite halbiert sich nach jeder Umkehrung der Bewegungsrichtung.
//
// Rückgabe: aktualisierter status
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
    return _fmCheckAndUpdateStatus(track);
  }

  // Antwort-Interpretation (REF-Frequenz wird geschoben, var bleibt fest):
  //   'var-higher' → User hört var höher als ref → ref-Frequenz war zu tief
  //                  → wir wollen ref ANHEBEN (positive cent-Bewegung)
  //   'var-lower'  → User hört var tiefer als ref → ref-Frequenz war zu hoch
  //                  → wir wollen ref SENKEN (negative cent-Bewegung)
  const adjustDir = (response === 'var-higher') ? 'up' : 'down';

  // 1-down-1-up: nach JEDER Antwort Bewegung in Antwort-Richtung.
  // Umkehr-Erkennung über lastMoveDir.
  if (track.lastMoveDir && track.lastMoveDir !== adjustDir) {
    track.reversals.push(track.currentOffset);
    track.stepSize = _fmHalfStep(track.stepSize);
  }

  const sign = (adjustDir === 'up') ? +1 : -1;
  track.currentOffset += sign * track.stepSize;
  track.lastMoveDir = adjustDir;

  return _fmCheckAndUpdateStatus(track);
}

// --- Schrittweiten-Halbierung gemäß Sequenz 50→25→12→6→3 ---
function _fmHalfStep(currentStep) {
  const idx = FM_STEP_SEQUENCE.indexOf(currentStep);
  if (idx >= 0 && idx < FM_STEP_SEQUENCE.length - 1) {
    return FM_STEP_SEQUENCE[idx + 1];
  }
  // Falls aktueller Wert nicht in der Folge (sollte nicht passieren):
  // halbieren, mindestens FM_STEP_MIN.
  return Math.max(FM_STEP_MIN, Math.floor(currentStep / 2));
}

// --- Match (Mittel der letzten 6 Umkehrungen) ---
function fmComputeMatch(track) {
  if (!track.reversals || track.reversals.length < FM_REVERSALS_WIN) return null;
  const tail = track.reversals.slice(-FM_REVERSALS_WIN);
  let sum = 0;
  for (let i = 0; i < tail.length; i++) sum += tail[i];
  return sum / tail.length;
}

// --- Residuum (halbe Spanne der letzten 6 Umkehrungen) ---
function fmComputeResidual(track) {
  if (!track.reversals || track.reversals.length < FM_REVERSALS_WIN) return null;
  const tail = track.reversals.slice(-FM_REVERSALS_WIN);
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < tail.length; i++) {
    if (tail[i] > max) max = tail[i];
    if (tail[i] < min) min = tail[i];
  }
  return (max - min) / 2;
}

// --- Match-Fallback aus beliebig vielen Reversals (für unstable) ---
function _fmMeanReversals(track) {
  if (!track.reversals || track.reversals.length === 0) return null;
  let sum = 0;
  for (let i = 0; i < track.reversals.length; i++) sum += track.reversals[i];
  return sum / track.reversals.length;
}

// --- Halbe Spanne aus beliebig vielen Reversals (für unstable) ---
function _fmHalfSpanReversals(track) {
  if (!track.reversals || track.reversals.length < 2) return null;
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < track.reversals.length; i++) {
    if (track.reversals[i] > max) max = track.reversals[i];
    if (track.reversals[i] < min) min = track.reversals[i];
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

  // Not-perceivable-Check: immer, unabhängig von Umkehr-Zahl.
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status = 'not-perceivable';
      return track.status;
    }
  }

  // Konvergenz erst erlauben, wenn mind. FM_NOT_PERC_MIN_CATCH Catches da sind.
  if (track.catchTotal < FM_NOT_PERC_MIN_CATCH) {
    if (track.trialCount < FM_TRIAL_CAP) return 'active';
    // Hard-Cap ohne genug Catches → unbrauchbar
    track.status = 'not-perceivable';
    return track.status;
  }

  // Saubere Konvergenz: ≥8 Umkehrungen, Schrittweite am Minimum.
  // Match/Residuum werden aus den letzten 6 berechnet (FM_REVERSALS_WIN).
  if (track.reversals.length >= FM_REVERSALS_REQ && track.stepSize === FM_STEP_MIN) {
    const residual = fmComputeResidual(track);
    if (residual != null) {
      if (residual <= FM_RESIDUAL_OK) {
        track.status   = 'converged';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      if (residual <= FM_RESIDUAL_FAIR) {
        track.status   = 'converged-fair';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      if (residual <= FM_RESIDUAL_WIDE) {
        track.status   = 'converged-wide';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      // Residuum > FM_RESIDUAL_WIDE → noch aktiv (bis Hard-Cap)
    }
  }

  // Hard-Cap erreicht ohne Konvergenz: als unstable klassifizieren.
  if (track.trialCount >= FM_TRIAL_CAP) {
    if (track.reversals.length >= FM_REVERSALS_WIN) {
      // Genug für 6er-Fenster: Standard-Match/Residuum
      const residual = fmComputeResidual(track);
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      track.status   = (residual != null && residual <= FM_RESIDUAL_WIDE)
                       ? 'converged-wide'
                       : 'unstable';
      return track.status;
    }
    // Weniger als 6 Reversals: Fallback auf Mittel aller Reversals.
    track.match    = _fmMeanReversals(track);
    if (track.match == null) track.match = track.currentOffset;
    track.residual = _fmHalfSpanReversals(track);
    track.status   = 'unstable';
    return track.status;
  }

  return 'active';
}

// --- Statistik-Helfer für UI/Storage ---
function fmTrackSummary(track) {
  return {
    electrodeIdx:  track.electrodeIdx,
    status:        track.status,
    match:         track.match,
    residual:      track.residual,
    trialCount:    track.trialCount,
    catchTotal:    track.catchTotal,
    catchErrors:   track.catchErrors,
    reversalCount: track.reversals.length,
    stepSize:      track.stepSize,
    currentOffset: track.currentOffset,
    startSign:     track.startSign
  };
}

// --- Vorläufige Schätzung für laufende Tracks ---
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
