// ============================================================
// freqmatch-adaptive.js — Frequenzabgleich: Adaptives Verfahren
// ============================================================
// Abhängigkeit: freqmatch.js (shared State, Hilfsfunktionen, Persistenz)

// --- Verfahren-Schaltflächen ---

function frq_enableHeightButtons() {
  const vr = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.adaptive;
  if (vr && vr.decisionButtons) {
    vr.decisionButtons.up.disabled   = false;
    vr.decisionButtons.down.disabled = false;
  }
}
function frq_disableHeightButtons() {
  const pi = _fmAdaptPI();
  if (pi) { pi.left.classList.remove('playing'); pi.right.classList.remove('playing'); }
  const vr = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.adaptive;
  if (vr && vr.decisionButtons) {
    vr.decisionButtons.up.disabled   = true;
    vr.decisionButtons.down.disabled = true;
  }
}

// --- Testablauf ---

// BA 207: Synchronisiert Track-Status mit der aktuellen
// freqmatchTestSelection. Wird nach Auswahl-Änderungen aufgerufen.
// Regeln:
//   - status 'active'      + Elektrode abgewählt → 'deselected'
//   - status 'deselected'  + Elektrode wieder gewählt → 'active'
//   - alle anderen Status (converged*, unstable, not-perceivable, aborted)
//     bleiben unverändert. Konvergierte Ergebnisse gehen NICHT verloren.
function _fmApplySelectionToTracks() {
  if (!frq_tracks) return;
  var sel = freqmatchTestSelection;
  var hasSel = (sel != null);
  var selSet = hasSel ? new Set(sel) : null;
  Object.keys(frq_tracks).forEach(function(k) {
    var tr = frq_tracks[k];
    if (!tr) return;
    var idx = frq_parseTrackKey(k).electrodeIdx;
    var wanted = !hasSel || selSet.has(idx);
    if (wanted && tr.status === 'deselected') tr.status = 'active';
    else if (!wanted && tr.status === 'active') tr.status = 'deselected';
  });
  // Wenn der aktuell vorgemerkte Track jetzt 'deselected' ist:
  // RoundQueue stumpf leeren, beim nächsten frq_pickNextTrack wird neu gepickt.
  if (frq_currentTrackId != null && frq_tracks[frq_currentTrackId]
      && frq_tracks[frq_currentTrackId].status === 'deselected') {
    frq_roundQueue = [];
  }
}

function frq_startAdaptive() {
  if (!FRQ_els) return;
  _fmInitSides();

  if (frq_symmetric) {
    const _symSeq = frq_buildSequenceSymmetric();
    if (_symSeq === null) {
      alert((typeof t === 'function' && t('FRQ_symmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      FRQ_els._stopTest();
      return;
    }
    if (_symSeq.length === 0) {
      alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden.');
      FRQ_els._stopTest();
      return;
    }
  }

  if ((sideData.left  && sideData.left.config)  === 'ci' &&
      (sideData.right && sideData.right.config) === 'ci' &&
      frq_buildSequenceSymmetric() === null) {
    alert((typeof t === 'function' && t('FRQ_elMismatch'))
      || 'Frequenzabgleich nicht möglich: Auf beiden Seiten müssen dieselben Elektroden aktiv sein.');
    FRQ_els._stopTest();
    return;
  }

  // Warnung wenn Slider-Test nur teilweise abgeschlossen
  const _slEst = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive)
    ? sideData[frq_varSide].freqmatchAdaptive.sliderEstimates : null;
  if (_slEst) {
    const _seq = frq_buildSequence();
    const _estCount = _seq.filter(function(e) { return _slEst[String(e)] !== undefined; }).length;
    if (_estCount > 0 && _estCount < _seq.length) {
      const msg = 'Der Slider-Test wurde nur teilweise abgeschlossen ('
        + _estCount + ' von ' + _seq.length + ' Elektroden).\n'
        + 'Empfehlung: erst den Slider-Test beenden, dann adaptiv starten.\n\n'
        + 'Trotzdem adaptiv starten?';
      if (!window.confirm(msg)) { FRQ_els._stopTest(); return; }
    }
  }

  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartAdaptive,
    function() { if (FRQ_els) FRQ_els._stopTest(); }
  );
}

// Eigentliche Adaptiv-Start-Logik (nach Dialog-Bestätigung).
function _fmDoStartAdaptive() {
  if (!FRQ_els) return;

  // Anti-Überschreib-Check (BA 93): bei 2+ abgeschlossenen Läufen Bestätigungsdialog.
  const _refVal  = FRQ_els.header.refSelect.value;
  const _varSide = _refVal === 'left' ? 'right' : 'left';
  const _fa = (sideData[_varSide] && sideData[_varSide].freqmatchAdaptive) || null;
  if (_fa && Array.isArray(_fa.runs) && _fa.runs.length >= 1) {
    const lastRun  = _fa.runs[_fa.runs.length - 1];
    const lastDone = lastRun && lastRun.completedAt != null;
    if (lastDone) {
      const daysOld = Math.floor((Date.now() - lastRun.completedAt) / (1000 * 60 * 60 * 24));
      const baseMsg = (typeof t === 'function' && t('FRQ_antiOverwriteMsg'))
        || 'Sie haben bereits {N} Läufe gespeichert. Ein weiterer Lauf wird zum Datensatz '
         + 'hinzugefügt und in die kombinierte Auswertung einbezogen. Wenn Sie ganz neu '
         + 'beginnen wollen, drücken Sie „Messungen löschen".';
      let msg = baseMsg.replace('{N}', String(_fa.runs.length));
      if (daysOld >= 7) {
        const ageMsg = (typeof t === 'function' && t('FRQ_ageWarnMsg'))
          || 'Ihre letzte Messung ist {D} Tage alt. Pitch-Wahrnehmung kann sich durch '
           + 'Plastizität verschoben haben.';
        msg += '\n\n' + ageMsg.replace('{D}', String(daysOld));
      }
      if (!window.confirm(msg)) { FRQ_els._stopTest(); return; }
    }
  }

  _fmInitSides();

  const elIdxList = frq_buildSequence();
  if (elIdxList.length === 0) {
    alert((typeof t === 'function' && t('FRQ_noActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    FRQ_els._stopTest();
    return;
  }

  if (_fmTryRestore(elIdxList)) {
    console.log('[freqmatch] Adaptiver Lauf fortgesetzt:', Object.keys(frq_tracks).length, 'Tracks');
  } else {
    // Gepaartes Bracketing über Läufe bestimmen:
    // - kein vorhandener Lauf, oder letzter Lauf ist selbst schon "gepaart"
    //   (= zweiter eines Paares) → neuer Lauf startet eigenes Paar,
    //   startSigns pro Elektrode zufällig.
    // - letzter abgeschlossener Lauf ist "ungepaart" → dieser Lauf
    //   invertiert dessen startSigns (pro Elektrode); für Elektroden, die
    //   im Vorgänger nicht vorkamen, zufällig.
    const _faNow = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive) || null;
    const _runs  = (_faNow && Array.isArray(_faNow.runs)) ? _faNow.runs : [];
    let prevRun = null;
    for (let i = _runs.length - 1; i >= 0; i--) {
      if (_runs[i] && _runs[i].completedAt != null) { prevRun = _runs[i]; break; }
    }
    const prevPaired = !!(prevRun && prevRun.pairedToPrevious);
    frq_currentPairedToPrevious = !!(prevRun && !prevPaired);

    frq_tracks = {};
    frq_roundQueue = [];

    // Slider-Estimate-Quelle für Lauf 1 (kein vorheriger Lauf).
    const _slStore = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive
                      && sideData[frq_varSide].freqmatchAdaptive.sliderEstimates) || {};

    elIdxList.forEach(function(idx) {
      // --- 1) Bracketing-Vorzeichen wie bisher ---
      let sign;
      if (frq_currentPairedToPrevious && prevRun && prevRun.startSigns
          && prevRun.startSigns[idx] != null) {
        sign = (prevRun.startSigns[idx] === -1) ? +1 : -1;
      } else {
        sign = (Math.random() < 0.5) ? +1 : -1;
      }

      // --- 2) Startoffset bestimmen ---
      // Priorität (hoch → niedrig):
      //   (a) Folgelauf mit vorhandenem Vorlauf-Match für diese Elektrode:
      //       startOffset = prevMatch + sign · FM_FOLLOWUP_BRACKET_OFFSET
      //   (b) Lauf 1 ohne Vorlauf, mit Slider-Vor-Schätzung:
      //       startOffset = sliderEstimate.cent + sign · FM_INITIAL_START_OFFSET
      //       (250 cent Abstand von der Schätzung, sign für Lauf-2-Bracketing)
      //   (c) Sonst: startOffset = sign · FM_INITIAL_START_OFFSET (250 cent)
      let startOffset;
      let prevMatchForIdx = null;
      if (prevRun && prevRun.perElectrode && prevRun.perElectrode[idx]
          && typeof prevRun.perElectrode[idx].match === 'number'
          && isFinite(prevRun.perElectrode[idx].match)) {
        prevMatchForIdx = prevRun.perElectrode[idx].match;
      }
      if (prevMatchForIdx != null) {
        // (a) Folgelauf-Bracketing um Vorlauf-Match.
        startOffset = prevMatchForIdx + sign * FM_FOLLOWUP_BRACKET_OFFSET;
      } else if (_slStore[String(idx)] != null
                 && typeof _slStore[String(idx)].cent === 'number'
                 && isFinite(_slStore[String(idx)].cent)) {
        // (b) Slider-Vor-Schätzung als Mittelpunkt, 250 cent Abstand.
        startOffset = _slStore[String(idx)].cent + sign * FM_INITIAL_START_OFFSET;
      } else {
        // (c) Default-Fallback: 250 cent Abstand.
        startOffset = sign * FM_INITIAL_START_OFFSET;
      }

      frq_tracks[FRQ_trackKey(idx)] = frq_createTrack(idx, sign, startOffset);
    });
    _fmPersist();
  }

  FRQ_running           = true;
  frq_adaptiveActive    = true;
  frq_awaitingResponse  = false;
  frq_currentTrackId        = null;
  frq_lastPickedTrackId = null;
  _fmUndoSnapshot     = null;
  const _adaptUndo = _fmAdaptUndo();
  if (_adaptUndo) _adaptUndo.disabled = true;

  frq_renderStatusGrid();
  _fmStartTimer();
  _fmDbg('start: ref=' + FRQ_refSide + ' var=' + frq_varSide
       + ', tracks=' + Object.keys(frq_tracks).length);
  frq_nextAdaptiveTrial();
  _fmStartIdleSideCheck();
}

function frq_nextAdaptiveTrial() {
  if (!frq_adaptiveActive) return;
  const _au0 = _fmAdaptUndo();
  if (_au0) _au0.disabled = true;

  const _rrState = { tracks: frq_tracks, roundQueue: frq_roundQueue };
  frq_currentTrackId = frq_pickNextTrack(_rrState, undefined, frq_lastPickedTrackId);
  if (frq_currentTrackId !== null) frq_lastPickedTrackId = frq_currentTrackId;
  frq_roundQueue = _rrState.roundQueue;
  if (frq_currentTrackId === null) {
    frq_finishAdaptive();
    return;
  }

  frq_currentFirstSide     = (Math.random() < 0.5) ? 'ref' : 'var';
  frq_awaitingResponse = false;

  // --- Catch-Entscheidung: deterministisch pro Track ---
  // Verteilung (BA 182): Trial 4, 8, 14, 22, 30, … — siehe
  // _fmIsCatchTrial in freqmatch-staircase.js.
  if (_fmIsCatchTrial(frq_tracks[frq_currentTrackId].trialCount)) {
    // Adaptive Spreizung: bei großem lokalem Residuum wird ±500 ct nicht
    // mehr eindeutig hörbar. Spreizung wächst mit dem aktuellen Residuum
    // (halbe Spanne der letzten 6 Umkehrungen via frq_computeResidual);
    // vor 6 Umkehrungen greift die Untergrenze FM_CATCH_MAGNITUDE.
    const _t = frq_tracks[frq_currentTrackId];
    const _resForCatch = (typeof frq_computeResidual === 'function')
      ? (frq_computeResidual(_t) || 0)
      : 0;
    const _mag = Math.max(FM_CATCH_MAGNITUDE, 2 * _resForCatch);
    const dir = (Math.random() < 0.5) ? +_mag : -_mag;
    frq_currentCatchInfo = {
      direction:        dir,
      expectedResponse: (dir > 0) ? 'var-higher' : 'var-lower'
    };
  } else {
    frq_currentCatchInfo = null;
  }

  const _api = _fmAdaptPI();
  if (_api) {
    testUI.pairIndicator.setLabels(_api, {
      leftText:  (typeof t === 'function' && t('FRQ_tone1')) || 'Ton 1',
      rightText: (typeof t === 'function' && t('FRQ_tone2')) || 'Ton 2'
    });
  }

  frq_updateAdaptiveProgress();
  frq_disableHeightButtons();

  const track = frq_tracks[frq_currentTrackId];
  const _dbgVarHz = (typeof withSide === 'function' && typeof effFreq === 'function')
    ? withSide(frq_varSide, function() { return effFreq(track.electrodeIdx); }) : 0;
  _fmDbg('trial #' + (track.trialCount + 1)
       + ' track=' + frq_currentTrackId
       + ' varHz=' + Math.round(_dbgVarHz)
       + ' offset=' + Math.round(track.currentOffset) + 'ct'
       + (frq_currentCatchInfo ? ' [CATCH dir=' + frq_currentCatchInfo.direction + ']' : ''));
  frq_playAdaptiveTrial(track, frq_currentFirstSide, frq_currentCatchInfo).then(function() {
    if (!frq_adaptiveActive) return;
    frq_awaitingResponse = true;
    frq_enableHeightButtons();
    const _au = _fmAdaptUndo();
    if (_au) _au.disabled = !_fmUndoSnapshot;
    frq_trialStartTs = Date.now();
  });
}

async function frq_playAdaptiveTrial(track, firstSide, catchInfo) {
  if (_fmSimActive) { frq_isPlaying = false; isPlay = false; return; }
  if (frq_isPlaying) {
    frq_isPlaying = false;
    if (frq_playTimeout) { clearTimeout(frq_playTimeout); frq_playTimeout = null; }
    await new Promise(function(r) { setTimeout(r, 60); });
  }

  let refHz, varHz;
  if (frq_symmetric) {
    const varBase = withSide('left',  function() { return effFreq(track.electrodeIdx); });
    const refBase = withSide('right', function() { return effFreq(track.electrodeIdx); });
    const halfOff = track.currentOffset / 2;
    if (catchInfo) {
      // Catch im symmetric: die Catch-Spreizung wird halbiert auf beide
      // Seiten verteilt, sodass die Differenz var↔ref = direction Cent ist.
      // direction folgt der var-relativ-zu-ref-Konvention (dir>0 = var
      // klingt höher), die der currentOffset-Konvention (off>0 = ref höher)
      // ENTGEGENGESETZT ist — daher +halfCatch auf var, -halfCatch auf ref.
      // Der reguläre Offset entfällt im Catch (wie im nicht-symmetrischen
      // Fall, wo die Differenz exakt = direction ist), damit die Spreizung
      // unabhängig vom Tracking-Stand eindeutig in der richtigen Richtung
      // liegt (sonst kann ein großer currentOffset die Spreizung aufheben).
      const halfCatch = catchInfo.direction / 2;
      varHz = varBase * Math.pow(2, +halfCatch / 1200);
      refHz = refBase * Math.pow(2, -halfCatch / 1200);
    } else {
      varHz = varBase * Math.pow(2, -halfOff / 1200);
      refHz = refBase * Math.pow(2, +halfOff / 1200);
    }
  } else {
    const elFreq = withSide(frq_varSide, function() { return effFreq(track.electrodeIdx); });
    if (catchInfo) {
      // Catch-Trial: die CI-Seite (var) bleibt auf der Soll-Frequenz
      // effFreq(i) — eine Verschiebung würde Nachbarelektroden anregen.
      // Stattdessen wird die Referenz um die volle Catch-Spreizung
      // verschoben. direction>0 = var soll höher klingen → ref tiefer
      // (refHz = elFreq · 2^(-direction/1200)); Differenz var↔ref = direction.
      varHz = elFreq;
      refHz = elFreq * Math.pow(2, -catchInfo.direction / 1200);
    } else {
      // normaler Trial: varHz = elFreq (CI-Elektrode statisch),
      // ref wird per Staircase um currentOffset verschoben.
      refHz = elFreq * Math.pow(2, track.currentOffset / 1200);
      varHz = elFreq;
    }
  }

  const vol = FRQ_getVolume();
  const ms  = FRQ_getDuration();
  const pau = FRQ_getPause();

  const balG = (typeof getRawBalanceGains === 'function')
    ? getRawBalanceGains() : { left: 0, right: 0 };

  const c = gAC();

  function playOne(side, hz) {
    const pan    = (side === 'left') ? -1 : 1;
    const corr   = FRQ_correctionGain(side, hz);
    const balDb  = (side === 'left') ? balG.left : balG.right;
    const effVol = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effVol, ms, pan, toneType_freqmatch);
  }

  const _adaptPI = _fmAdaptPI();
  frq_isPlaying = true;
  isPlay   = true;

  if (firstSide === 'ref') {
    testUI.pairIndicator.setPlaying(_adaptPI, 'left');
    await playOne(FRQ_refSide, refHz);
    testUI.pairIndicator.setPlaying(_adaptPI, null);
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    await new Promise(function(r) { frq_playTimeout = setTimeout(r, pau); });
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    testUI.pairIndicator.setPlaying(_adaptPI, 'right');
    await playOne(frq_varSide, varHz);
    testUI.pairIndicator.setPlaying(_adaptPI, null);
  } else {
    testUI.pairIndicator.setPlaying(_adaptPI, 'left');
    await playOne(frq_varSide, varHz);
    testUI.pairIndicator.setPlaying(_adaptPI, null);
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    await new Promise(function(r) { frq_playTimeout = setTimeout(r, pau); });
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    testUI.pairIndicator.setPlaying(_adaptPI, 'right');
    await playOne(FRQ_refSide, refHz);
    testUI.pairIndicator.setPlaying(_adaptPI, null);
  }

  // ABA: dritten Ton (Wiederholung des ersten) abspielen
  if (frq_isAbaSequence()) {
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    await new Promise(function(r) { frq_playTimeout = setTimeout(r, pau); });
    if (!frq_adaptiveActive) { frq_isPlaying = false; isPlay = false; return; }
    testUI.pairIndicator.setPlaying(_adaptPI, 'left');
    if (firstSide === 'ref') {
      await playOne(FRQ_refSide, refHz);
    } else {
      await playOne(frq_varSide, varHz);
    }
    testUI.pairIndicator.setPlaying(_adaptPI, null);
  }

  frq_isPlaying = false;
  isPlay   = false;
}

// userChoice: 'up' | 'down' — was der User über höher/tiefer-Buttons
//             oder ↑/↓-Tasten gewählt hat (bezogen auf den zweiten Ton)
function frq_handleHeight(userChoice) {
  if (!frq_adaptiveActive || !frq_awaitingResponse) return;
  // BA353: erste/jede adaptive Entscheidung -> Adaptiv wird aktiv.
  if (typeof FRQ_setActiveMethod === "function") FRQ_setActiveMethod("adaptive");
  frq_awaitingResponse = false;
  frq_disableHeightButtons();

  const response = _fmConvertHeight(userChoice, frq_currentFirstSide);
  const track    = frq_tracks[frq_currentTrackId];

  const isCatch      = !!frq_currentCatchInfo;
  const catchCorrect = isCatch && (response === frq_currentCatchInfo.expectedResponse);
  const _prevStatus  = track.status;

  // Snapshot vor Staircase-Mutation — ermöglicht Undo bei Fehleingabe
  _fmUndoSnapshot = {
    trackId:    frq_currentTrackId,
    trackState: {
      currentOffset:   track.currentOffset,
      stepSize:        track.stepSize,
      pendingResponse: track.pendingResponse,
      lastMoveDir:     track.lastMoveDir,
      trialCount:      track.trialCount,
      catchTotal:      track.catchTotal,
      catchErrors:     track.catchErrors,
      status:          track.status,
      match:           track.match,
      residual:        track.residual
    },
    reversals:    track.reversals.slice(),
    trialHistory: track.trialHistory.slice(),
    firstSide:    frq_currentFirstSide,
    catchInfo:    frq_currentCatchInfo
  };

  frq_applyResponse(track, response, isCatch, catchCorrect, frq_currentFirstSide);

  // Hook C: Response-Log
  _fmDbg('response: ' + response
       + (isCatch ? ' catch=' + (catchCorrect ? 'ok' : 'miss') : '')
       + ' step=' + track.stepSize + ' reversals=' + (track.reversals || []).length);
  // Hook D: Status-Wechsel-Log
  if (track.status !== _prevStatus) {
    _fmDbg('status: track=' + frq_currentTrackId + ' ' + _prevStatus + '→' + track.status
         + (track.status === 'not-perceivable'
              ? ' (catchErrors=' + (track.catchErrors || 0) + '/' + (track.catchTotal || 0) + ')'
              : ''));
  }

  // Catch-Info aufräumen (vor nächstem Trial)
  frq_currentCatchInfo = null;

  if (track.status === 'converged' || track.status === 'converged-fair'
      || track.status === 'converged-wide' || track.status === 'unstable') {
    _fmWriteResult(track);
  } else if (track.status === 'not-perceivable') {
    _fmRemoveResult(track.electrodeIdx);
  }

  _fmPersist();
  frq_renderStatusGrid();
  const _au2 = _fmAdaptUndo();
  if (_au2) _au2.disabled = false;

  _fmNextTrialTO = setTimeout(function() {
    _fmNextTrialTO = null;
    if (frq_adaptiveActive) frq_nextAdaptiveTrial();
  }, _fmSimActive ? 30 : 200);
}

// firstSide='ref': Ton2=var. 'up'→var-higher, 'down'→var-lower
// firstSide='var': Ton2=ref. 'up'→var-lower,  'down'→var-higher
function _fmConvertHeight(userChoice, firstSide) {
  if (firstSide === 'ref') {
    return (userChoice === 'up') ? 'var-higher' : 'var-lower';
  } else {
    return (userChoice === 'up') ? 'var-lower' : 'var-higher';
  }
}

// Aggregiert pro-Elektrode-Matches über alle Läufe einer Seite.
// 1 Staircase je Elektrode je Lauf. Gepaartes Bracketing über Läufe
// liefert die Bias-Kompensation (statt zwei paralleler Tracks pro Lauf).
//
// Rückgabe:
//   cent          — Konvergenz-Punkt (Median ab 3 Läufen, Mittel bei 2, direkt bei 1)
//   fmConv        — σ_konv = Mittel der Track-Residuen (Konvergenz-Unschärfe)
//   fmRunSpread   — SD der Lauf-Matches (Streuung zwischen Läufen)
//   fmResiduum    — sqrt(σ_konv² + σ_runSpread²) (Gesamtunsicherheit)
//   runsCount     — Zahl der Läufe mit Match
//   status        — Match-priorisiert (siehe unten)
//   fmStatusLast  — Status des letzten Laufs (für UI/Debug)
function _fmAggregateRunsForElectrode(side, electrodeIdx) {
  const fa = (sideData[side] && sideData[side].freqmatchAdaptive) || null;
  const empty = {
    cent: null, runsCount: 0, status: null,
    fmConv: null, fmRunSpread: 0, fmResiduum: null,
    fmStatusLast: null,
    // Übergangsfelder, damit ältere Aufrufer (z. B. results.js für
    // In-Progress) nichts undefined dereferenzieren.
    meanResidual: null, combinedUncertainty: 0
  };
  if (!fa || !Array.isArray(fa.runs)) return empty;

  const key = FRQ_trackKey(electrodeIdx);
  const RANK = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                 'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };

  const matches   = [];   // pro Lauf: track.match (nur wenn vorhanden)
  const residuals = [];   // pro Lauf: track.residual (nur wenn vorhanden)
  const allStatuses     = [];
  const matchStatuses   = [];   // Status nur jener Läufe, die Match geliefert haben
  let lastStatus = null;

  fa.runs.forEach(function(run) {
    const tr = run && run.tracks && run.tracks[key];
    if (!tr) return;
    // Abgewählte Spuren neutral überspringen: eine in einem Lauf abgewählte
    // Elektrode war dort schlicht nicht im Test — sie darf das kombinierte
    // Ergebnis weder verbessern noch verschlechtern (BA 207: 'deselected'
    // ist kein Qualitätsmerkmal). So, als wäre sie in diesem Lauf nicht
    // dabei gewesen.
    if (tr.status === 'deselected') return;
    lastStatus = tr.status || null;
    allStatuses.push(tr.status || 'aborted');
    if (tr.match != null) {
      matches.push(tr.match);
      matchStatuses.push(tr.status || null);
      if (tr.residual != null) residuals.push(tr.residual);
    }
  });

  if (matches.length === 0) {
    // Kein Lauf hat ein Match geliefert. Status: schlechtester aller Läufe.
    let worst = null;
    allStatuses.forEach(function(s) {
      if (s == null) return;
      if (worst == null || (RANK[s] || 0) > (RANK[worst] || 0)) worst = s;
    });
    return Object.assign({}, empty, {
      status:       worst,
      fmStatusLast: lastStatus
    });
  }

  // cent — Median (≥3), Mittel (2), direkt (1)
  let cent;
  if (matches.length === 1) {
    cent = matches[0];
  } else if (matches.length === 2) {
    cent = (matches[0] + matches[1]) / 2;
  } else {
    const sorted = matches.slice().sort(function(a, b) { return a - b; });
    const mid = sorted.length >> 1;
    cent = (sorted.length & 1) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // σ_konv: Mittel der Track-Residuen
  let sigmaKonv = null;
  if (residuals.length > 0) {
    let s = 0;
    for (let i = 0; i < residuals.length; i++) s += residuals[i];
    sigmaKonv = s / residuals.length;
  }

  // σ_runSpread: Stichproben-SD der Lauf-Matches
  let runSpread = 0;
  if (matches.length >= 2) {
    let sum = 0;
    for (let i = 0; i < matches.length; i++) sum += matches[i];
    const mean = sum / matches.length;
    let sqSum = 0;
    for (let i = 0; i < matches.length; i++) {
      const d = matches[i] - mean;
      sqSum += d * d;
    }
    runSpread = Math.sqrt(sqSum / (matches.length - 1));
  }

  // fmResiduum: quadratische Kombination — unabhängige Fehlerquellen
  let residuum = null;
  if (sigmaKonv != null) {
    residuum = Math.sqrt(sigmaKonv * sigmaKonv + runSpread * runSpread);
  }

  // Status match-priorisierend:
  //   Wenn es Match-liefernde Läufe gibt, ist deren schlechtester Status der
  //   Endstatus. So bleibt fmStatus konsistent zu cent (kein 'not-perceivable'
  //   bei vorhandenem Match).
  let stage = null;
  matchStatuses.forEach(function(s) {
    if (s == null) return;
    if (stage == null || (RANK[s] || 0) > (RANK[stage] || 0)) stage = s;
  });
  if (stage == null) stage = 'converged';

  return {
    cent:                cent,
    runsCount:           matches.length,
    status:              stage,
    fmConv:              sigmaKonv,
    fmRunSpread:         runSpread,
    fmResiduum:          residuum,
    fmStatusLast:        lastStatus,
    // Übergangsfelder
    meanResidual:        sigmaKonv,
    combinedUncertainty: (residuum != null) ? residuum : 0
  };
}

function _fmRemoveResult(elIdx) {
  // Andere Läufe könnten noch ein Ergebnis liefern → Aggregat prüfen.
  const agg = _fmAggregateRunsForElectrode(frq_varSide, elIdx);
  if (agg.cent != null) {
    let varHz, refHz, _refSideOut, existingIdx;
    if (frq_symmetric) {
      varHz = withSide('left',  function() { return effFreq(elIdx); });
      refHz = withSide('right', function() { return effFreq(elIdx); });
      _refSideOut = 'symmetric';
      existingIdx = FRQ_resultsArray.findIndex(function(r) {
        return r.refSide === 'symmetric' && r.elIdx === elIdx;
      });
    } else {
      varHz = withSide(frq_varSide, function() { return effFreq(elIdx); });
      refHz = varHz * Math.pow(2, agg.cent / 1200);
      _refSideOut = FRQ_refSide;
      existingIdx = FRQ_resultsArray.findIndex(function(r) {
        return r.varSide === frq_varSide && r.refSide === FRQ_refSide && r.elIdx === elIdx;
      });
    }
    const entry = {
      varSide:               frq_varSide,
      refSide:               _refSideOut,
      elIdx:                 elIdx,
      varFreq:               varHz,
      refFreq:               refHz,
      timestamp:             Date.now(),
      method:                "adaptive",
      fmStatus:              agg.status || 'converged',
      fmResidual:            agg.meanResidual,
      fmCombinedUncertainty: agg.combinedUncertainty,
      fmDelta:               null,
      fmConv:                agg.fmConv,
      fmRunSpread:           agg.fmRunSpread,
      fmResiduum:            agg.fmResiduum,
      fmRunsCount:           agg.runsCount,
      fmStatusLast:          agg.fmStatusLast
    };
    if (frq_symmetric) entry.cent = Math.round(agg.cent);
    if (existingIdx >= 0) FRQ_resultsArray[existingIdx] = entry;
    else                  FRQ_resultsArray.push(entry);
    if (typeof pApplyWarpModeDefaultFromFm === "function") {
      pApplyWarpModeDefaultFromFm();
    }
    // BA 151
    if (typeof depLockApply === 'function') depLockApply();
    _fmDbg('FRQ_resultsArray keep via agg: side=' + frq_varSide + ' el=' + elIdx
         + (frq_symmetric ? ' [SYM]' : '')
         + ' (not-perceivable im aktuellen Lauf, andere Läufe haben Daten)');
    return;
  }
  const idx = FRQ_resultsArray.findIndex(function(r) {
    return frq_symmetric
      ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
      : (r.varSide === frq_varSide && r.refSide === FRQ_refSide && r.elIdx === elIdx);
  });
  if (idx >= 0) FRQ_resultsArray.splice(idx, 1);
  // BA 151
  if (typeof depLockApply === 'function') depLockApply();
  _fmDbg('FRQ_resultsArray remove: side=' + frq_varSide + ' el=' + elIdx
       + (frq_symmetric ? ' [SYM]' : '')
       + ' (not-perceivable)');
}

function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const agg   = _fmAggregateRunsForElectrode(frq_varSide, elIdx);

  let varHz, refHz, _refSideOut, existingIdx;
  if (frq_symmetric) {
    varHz = withSide('left',  function() { return effFreq(elIdx); });
    refHz = withSide('right', function() { return effFreq(elIdx); });
    _refSideOut = 'symmetric';
    existingIdx = FRQ_resultsArray.findIndex(function(r) {
      return r.refSide === 'symmetric' && r.elIdx === elIdx;
    });
  } else {
    varHz = withSide(frq_varSide, function() { return effFreq(elIdx); });
    refHz = (agg.cent != null)
      ? varHz * Math.pow(2, agg.cent / 1200)
      : null;
    _refSideOut = FRQ_refSide;
    existingIdx = FRQ_resultsArray.findIndex(function(r) {
      return r.varSide === frq_varSide && r.refSide === FRQ_refSide && r.elIdx === elIdx;
    });
  }

  const entry = {
    varSide:               frq_varSide,
    refSide:               _refSideOut,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
    method:                "adaptive",
    fmStatus:              agg.status || track.status,
    fmResidual:            agg.meanResidual,
    fmCombinedUncertainty: agg.combinedUncertainty,
    fmDelta:               null,
    fmConv:                agg.fmConv,
    fmRunSpread:           agg.fmRunSpread,
    fmResiduum:            agg.fmResiduum,
    fmRunsCount:           agg.runsCount,
    fmStatusLast:          agg.fmStatusLast
  };
  if (frq_symmetric) {
    entry.cent = (agg.cent != null) ? Math.round(agg.cent) : null;
  }
  if (existingIdx >= 0) FRQ_resultsArray[existingIdx] = entry;
  else                  FRQ_resultsArray.push(entry);
  if (typeof pApplyWarpModeDefaultFromFm === "function") {
    pApplyWarpModeDefaultFromFm();
  }
  // BA 151
  if (typeof depLockApply === 'function') depLockApply();
  _fmDbg('FRQ_resultsArray write: side=' + frq_varSide + ' el=' + elIdx
       + (frq_symmetric ? ' [SYM]' : '')
       + ' cent=' + (agg.cent != null ? agg.cent.toFixed(1) : 'null')
       + ' resid=' + (agg.fmResiduum != null ? agg.fmResiduum.toFixed(1) : 'null')
       + ' runs=' + agg.runsCount);
}

function frq_finishAdaptive() {
  let _cv = 0, _fa2 = 0, _wide = 0, _un = 0, _np = 0;
  Object.keys(frq_tracks).forEach(function(k) {
    const st = frq_tracks[k].status;
    if (st === 'converged')            _cv++;
    else if (st === 'converged-fair')  _fa2++;
    else if (st === 'converged-wide')  _wide++;
    else if (st === 'unstable')        _un++;
    else if (st === 'not-perceivable') _np++;
  });
  const _faStore = (sideData[frq_varSide] && sideData[frq_varSide].freqmatchAdaptive) || {};
  const _runNum = Array.isArray(_faStore.runs) ? _faStore.runs.length : '?';
  _fmDbg('finish run#' + _runNum + ': ' + _cv + ' conv, ' + _fa2 + ' fair, '
       + _wide + ' wide, ' + _un + ' unstable, ' + _np + ' not-perceivable');

  frq_adaptiveActive   = false;
  frq_awaitingResponse = false;
  frq_isPlaying           = false;
  FRQ_running          = false;
  frq_currentTrackId       = null;
  _fmStopTimer();
  testUI.pairIndicator.setPlaying(_fmAdaptPI(), null);

  _fmPersist();       // finale Tracks in runs[currentRunIdx] sichern
  _fmMarkCompleted(); // completedAt setzen
  frq_tracks     = {};
  frq_roundQueue = [];

  if (FRQ_els) FRQ_els._stopTest();
  FRQ_refreshResumeHint();
  if (typeof renderFreqMatchResults === 'function') renderFreqMatchResults();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 279: Abschluss-Box. frq_finishAdaptive wird nur erreicht, wenn keine
  // Tracks mehr offen sind (frq_pickNextTrack === null in frq_nextAdaptiveTrial)
  // — natuerliches Ende. Pause/Abbruch laeuft ueber frq_finish: KEINE Box.
  if (typeof testUI !== 'undefined' && testUI.completion) {
    testUI.completion.show({
      nameKey:   'compNameFmAdaptive',
      subtabKey: 'subTabFreqMatch',
      bodyKey:   'FRQ_doneExtra'
    });
  }
}

function frq_renderStatusGrid() {
  const _sgEl = FRQ_els && FRQ_els.verfahren && FRQ_els.verfahren.adaptive && FRQ_els.verfahren.adaptive.statusGrid;
  if (!_sgEl) return;
  const grid = _sgEl;
  grid.innerHTML = '';

  const head = _mkEl('div', 'frq-status-row frq-status-head');
  ['FRQ_gridEl', 'FRQ_gridStatus', 'FRQ_gridMatch', 'FRQ_gridResidual', 'FRQ_gridTrials', 'FRQ_gridCatch']
    .forEach(function(key) {
      const c = _mkEl('div', 'frq-status-cell');
      c.dataset.t = key;
      head.appendChild(c);
    });
  grid.appendChild(head);

  const ids = Array.from(new Set(
    Object.keys(frq_tracks).map(function(k) { return frq_parseTrackKey(k).electrodeIdx; })
  ));
  ids.sort(function(a, b) {
    const fa = withSide(frq_varSide, function() { return effFreq(a); });
    const fb = withSide(frq_varSide, function() { return effFreq(b); });
    return fa - fb;
  });

  ids.forEach(function(idx) {
    const tr = frq_tracks[FRQ_trackKey(idx)];
    const trStatus = (tr && tr.status) || 'active';

    // CSS-Klasse: bestehende Klassen weiterverwenden
    const cssClass = (trStatus === 'active') ? 'active'
      : (trStatus === 'converged' || trStatus === 'converged-fair') ? 'converged'
      : (trStatus === 'converged-wide' || trStatus === 'unstable') ? 'converged-noisy'
      : 'not-perceivable';
    const row = _mkEl('div', 'frq-status-row frq-status-' + cssClass);
    if (frq_currentTrackId != null && frq_parseTrackKey(frq_currentTrackId).electrodeIdx === idx) {
      row.classList.add('frq-status-current');
    }

    const elName = withSide(frq_varSide, function() { return dENPrefix() + dEN(idx); });
    row.appendChild(_mkCell(elName));

    const iconMap = {
      'converged':       '✓ konvergiert',
      'converged-fair':  '◐ leichte Streuung',
      'converged-wide':  '◐ breite Streuung',
      'unstable':        '⚠ unstabil',
      'aborted':         '∅ abgebrochen',
      'not-perceivable': '✗ nicht wahrnehmbar'
    };
    let statusTxt;
    if (trStatus === 'active') {
      statusTxt = '⏳ läuft';
    } else {
      statusTxt = iconMap[trStatus] || '?';
    }
    row.appendChild(_mkCell(statusTxt));

    // Match: aus Track, sonst vorläufig bei aktivem Track
    let matchTxt = '—', matchProv = false;
    if (tr && tr.match != null) {
      matchTxt = (tr.match >= 0 ? '+' : '') + Math.round(tr.match) + ' ct';
    } else if (tr && tr.status === 'active' && typeof FRQ_computeProvisional === 'function') {
      const prov = FRQ_computeProvisional(tr);
      if (prov.match != null) {
        matchTxt = (prov.match >= 0 ? '+' : '') + Math.round(prov.match) + ' ct';
        matchProv = true;
      }
    }
    const matchCell = _mkCell(matchTxt);
    if (matchProv) matchCell.classList.add('frq-status-provisional');
    row.appendChild(matchCell);

    // Residuum: aus Track, sonst vorläufig
    let residTxt = '—', residProv = false;
    if (tr && tr.residual != null) {
      residTxt = '±' + Math.round(tr.residual) + ' ct';
    } else if (tr && tr.status === 'active' && typeof FRQ_computeProvisional === 'function') {
      const prov = FRQ_computeProvisional(tr);
      if (prov.residual != null) {
        residTxt = '±' + Math.round(prov.residual) + ' ct';
        residProv = true;
      }
    }
    const residCell = _mkCell(residTxt);
    if (residProv) residCell.classList.add('frq-status-provisional');
    row.appendChild(residCell);

    const totalTrials   = tr ? (tr.trialCount  || 0) : 0;
    const totalCatchErr = tr ? (tr.catchErrors || 0) : 0;
    const totalCatchAll = tr ? (tr.catchTotal  || 0) : 0;
    row.appendChild(_mkCell(String(totalTrials)));
    row.appendChild(_mkCell(totalCatchErr + '/' + totalCatchAll));

    grid.appendChild(row);
  });

  // i18n manuell anwenden (applyLang hat keinen root-Parameter)
  if (typeof t === 'function') {
    grid.querySelectorAll('[data-t]').forEach(function(el) {
      const v = t(el.dataset.t);
      if (v && v !== el.dataset.t) el.textContent = v;
    });
  }
}

function _mkCell(text) {
  const c = _mkEl('div', 'frq-status-cell');
  c.textContent = text;
  return c;
}

function frq_updateAdaptiveProgress() {
  if (!FRQ_els) return;
  const _aprog = FRQ_els.verfahren && FRQ_els.verfahren.adaptive && FRQ_els.verfahren.adaptive.progress;
  if (!_aprog) return;
  const ids = Object.keys(frq_tracks);

  if (ids.length > 0) {
    const stats    = FRQ_computeProgressStats(frq_tracks);
    const curTrial = (stats.totalTrials || 0) + (frq_awaitingResponse ? 1 : 0);
    const estTotal = ids.length * FM_TRIALS_PER_ELECTRODE_ESTIMATE;
    const txt = 'Trial ' + curTrial + ' von ca. ' + estTotal;
    testUI.progress.set(_aprog, {
      fraction: stats.percent / 100,
      text:     txt
    });
  } else {
    testUI.progress.set(_aprog, {
      fraction: 0,
      text:     'Trial 0 von ca. 0'
    });
  }
}

// Wiederverwendbare Fortschritts-Statistik. Auch genutzt von
// renderFreqMatchResults für den Ergebnis-Reiter-Balken.
//
// Pro Track (1 Track je Elektrode je Lauf):
//   - Endzustand    → Beitrag 1.0
//   - aktiv         → Beitrag min(reversals.length / FM_REVERSALS_REQ, 0.95)
function FRQ_computeProgressStats(tracks) {
  const allKeys = Object.keys(tracks);
  let total = 0, done = 0, totalTrials = 0, contrib = 0;
  allKeys.forEach(function(k) {
    const tr = tracks[k];
    // Bereits absolvierte Vergleiche bleiben gezählt (kein Rücksprung der
    // Trial-Anzeige), auch wenn die Spur danach abgewählt wurde.
    totalTrials += tr.trialCount || 0;
    // Abgewählte Spuren neutral aus der Fortschritts-Quote nehmen — weder
    // als fertig noch als offen werten (raus aus Zähler UND Nenner), damit
    // der Balken sich auf die verbliebenen Elektroden bezieht und beim
    // Rausnehmen nicht hochspringt (BA 207: 'deselected' ist kein Endzustand).
    if (tr.status === 'deselected') return;
    total++;
    if (tr.status !== 'active') {
      done++;
      contrib += 1.0;
    } else {
      const rev = (tr.reversals && tr.reversals.length) || 0;
      contrib += Math.min(rev / FM_REVERSALS_REQ, 0.95);
    }
  });
  return {
    total:       total,
    done:        done,
    totalTrials: totalTrials,
    percent:     total > 0 ? (contrib / total) * 100 : 0
  };
}

// --- Undo ---

function frq_undoAdaptive() {
  if (!_fmUndoSnapshot) return;
  if (_fmNextTrialTO) { clearTimeout(_fmNextTrialTO); _fmNextTrialTO = null; }

  const snap      = _fmUndoSnapshot;
  _fmUndoSnapshot = null;

  const track = frq_tracks[snap.trackId];
  Object.assign(track, snap.trackState);
  track.reversals    = snap.reversals.slice();
  track.trialHistory = snap.trialHistory.slice();

  frq_currentTrackId   = snap.trackId;
  frq_currentFirstSide = snap.firstSide;
  frq_currentCatchInfo = snap.catchInfo;

  const _au3 = _fmAdaptUndo();
  if (_au3) _au3.disabled = true;
  frq_disableHeightButtons();
  frq_awaitingResponse = false;
  frq_playAdaptiveTrial(track, frq_currentFirstSide, frq_currentCatchInfo).then(function() {
    if (!frq_adaptiveActive) return;
    frq_awaitingResponse = true;
    frq_enableHeightButtons();
  });
}

// --- Debug-Simulation ---

function frq_runDebugSimulation() {
  if (_fmSimActive) return;
  if (frq_verfahren !== 'adaptive') return;
  _fmSimActive  = true;
  _fmSimOffsets = {};
  _fmSimStep();
}

function _fmSimStep() {
  if (!_fmSimActive || !frq_adaptiveActive) { _fmSimActive = false; return; }
  if (!frq_awaitingResponse) { setTimeout(_fmSimStep, 80); return; }

  const track = frq_tracks[frq_currentTrackId];
  if (!track) { _fmSimActive = false; return; }

  if (_fmSimOffsets[track.electrodeIdx] === undefined) {
    const mag  = 20 + Math.random() * 130;
    _fmSimOffsets[track.electrodeIdx] = (Math.random() < 0.5 ? 1 : -1) * mag;
  }

  let choiceUD;
  if (frq_currentCatchInfo) {
    const exp = frq_currentCatchInfo.expectedResponse;
    choiceUD = (frq_currentFirstSide === 'ref')
      ? (exp === 'var-higher' ? 'up' : 'down')
      : (exp === 'var-higher' ? 'down' : 'up');
  } else {
    const simOff = _fmSimOffsets[track.electrodeIdx];
    const gap    = track.currentOffset - simOff;
    const absGap = Math.abs(gap);
    let errProb;
    if (track.electrodeIdx === 0)      errProb = 0.50;   // E1: immer zufällig
    else if (track.electrodeIdx === 5) errProb = 0.25;   // E6: 75 % richtig
    else errProb = absGap < 30 ? 0.40 : absGap < 60 ? 0.20 : 0.02;
    let varResp = gap > 0 ? 'var-lower' : 'var-higher';
    if (Math.random() < errProb) varResp = varResp === 'var-higher' ? 'var-lower' : 'var-higher';
    choiceUD = (frq_currentFirstSide === 'ref')
      ? (varResp === 'var-higher' ? 'up' : 'down')
      : (varResp === 'var-higher' ? 'down' : 'up');
  }

  setTimeout(function() {
    if (!_fmSimActive || !frq_adaptiveActive) { _fmSimActive = false; return; }
    frq_handleHeight(choiceUD);
    setTimeout(_fmSimStep, 50);
  }, 60 + Math.random() * 60);
}
