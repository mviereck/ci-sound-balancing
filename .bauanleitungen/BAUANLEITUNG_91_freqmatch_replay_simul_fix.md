# BA 91 — Bugfix: Replay/Simul-Buttons im Adaptive-Modus

## Problem

Im adaptiven Frequenzabgleich-Modus reagieren die Buttons „Nochmal"
(Replay) und „Gleichzeitig" (Simul) nicht — kein Ton wird ausgelöst.

**Ursache:** `fmPlayCurrent` (Z. 214) und `fmPlaySimul` (Z. 294) in
`js/freqmatch.js` brechen sofort ab mit `if (fmCurrentEl === null) return;`.
Die Variablen `fmCurrentEl` und `fmCentOffset` werden nur im Slider-Modus
gesetzt. Im adaptiven Modus liegt die aktuelle Elektrode in
`fmTracks[fmCurTrackId].electrodeIdx` und der Ref/Var-Offset in
`fmTracks[fmCurTrackId].currentOffset` — die alten Funktionen sehen davon
nichts.

## Ziel

Beide Funktionen erkennen, ob der adaptive Modus aktiv ist, und nutzen
in diesem Fall die Track-State-Daten anstatt der Slider-Modus-Variablen.

- **Replay** spielt das aktuelle Trial-Paar erneut, ohne den Track-State
  zu mutieren und ohne die Antwort-Erwartung (`fmAwaitingResponse`)
  zurückzusetzen.
- **Simul** spielt Ref- und Var-Ton gleichzeitig (stereo gespreizt),
  ebenfalls ohne Track-Mutation.

## Akzeptanztest

1. Tab Messungen → Sub-Tab Frequenzabgleich.
2. Mode-Select auf „adaptiv" (sollte Default sein).
3. „Test starten" klicken. Warten, bis das erste Trial abspielt
   und der Status „bitte antworten" erscheint.
4. **Replay-Button („Nochmal") klicken** — erwartet: dasselbe Trial-Paar
   spielt erneut, in derselben Reihenfolge wie zuvor. Antwort-Buttons
   bleiben aktiv (User kann weiter antworten). Track-State unverändert.
5. **Leertaste drücken** — erwartet: dasselbe Verhalten wie Replay-Button.
6. **Simul-Button („Gleichzeitig") klicken** — erwartet: Ref- und Var-Ton
   spielen gleichzeitig (kurze parallele Wiedergabe).
   Antwort-Buttons bleiben aktiv. Track-State unverändert.
7. Höher-Button drücken → nächstes Trial startet, Logik wie gewohnt.
8. Im Slider-Modus (Mode-Select umschalten, ggf. neuen Test starten):
   Replay und Simul funktionieren weiterhin wie bisher (Regressions-Test).

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
// vorher
const APP_VERSION = "3.0.89-beta";
// nachher
const APP_VERSION = "3.0.91-beta";
```

(BA 90 war ein Lauf, der die Version offenbar nicht hochgezählt hat —
deswegen springen wir auf 91.)

## Schritt 2 — `fmPlayCurrent` um Adaptive-Branch erweitern

In `js/freqmatch.js`, Funktion `fmPlayCurrent` (ab Z. 214). **Komplett ersetzen**:

```js
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

  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const pau = fmGPau();
  const aba = fmGAba();

  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };

  const c = gAC();
  function playOne(side, hz) {
    const pan = side === "left" ? -1 : 1;
    const corr = fmCorrGain(side, hz);
    const balDb = side === "left" ? balG.left : balG.right;
    const effectiveVol = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType);
  }
  function indRef() {
    const isLeft = fmRefSide === "left";
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.toggle('playing', isLeft);
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', !isLeft);
  }
  function indVar() {
    const isLeft = fmVarSide === "left";
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.toggle('playing', isLeft);
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', !isLeft);
  }
  function indOff() {
    if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.remove('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
  }

  isPlay = true;
  if (fmFirstSide === "ref") {
    indRef();
    await playOne(fmRefSide, refHz);
    if (!isPlay) { indOff(); return; }
    indOff();
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    indVar();
    await playOne(fmVarSide, varHz);
    if (!isPlay) { indOff(); return; }
    if (aba && isPlay) {
      indOff();
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      indRef();
      await playOne(fmRefSide, refHz);
    }
  } else {
    indVar();
    await playOne(fmVarSide, varHz);
    if (!isPlay) { indOff(); return; }
    indOff();
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    indRef();
    await playOne(fmRefSide, refHz);
    if (!isPlay) { indOff(); return; }
    if (aba && isPlay) {
      indOff();
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      indVar();
      await playOne(fmVarSide, varHz);
    }
  }
  indOff();
  isPlay = false;
}
```

Der einzige neue Block ist der `if (fmAdaptiveActive)`-Branch ganz am
Anfang. Der Slider-Modus-Code dahinter ist 1:1 unverändert.

## Schritt 3 — `fmPlaySimul` um Adaptive-Branch erweitern

In `js/freqmatch.js`, Funktion `fmPlaySimul` (ab Z. 294). **Komplett ersetzen**:

```js
async function fmPlaySimul() {
  // --- Adaptive-Modus: Ref- und Var-Ton gleichzeitig mit aktuellem Track-Offset ---
  if (fmAdaptiveActive) {
    if (fmCurTrackId === null || !fmTracks || !fmTracks[fmCurTrackId]) return;
    if (fmIsPlay) {
      fmIsPlay = false;
      if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
      await new Promise((r) => setTimeout(r, 60));
    }
    const track  = fmTracks[fmCurTrackId];
    const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
    const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
    const varHz  = fmCurCatchInfo
      ? refHz * Math.pow(2, fmCurCatchInfo.direction / 1200)
      : elFreq;
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
    if (fmEls && fmEls.pairLeft)  fmEls.pairLeft.classList.add('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
    await Promise.all([
      playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
      playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
    ]);
    if (fmEls && fmEls.pairLeft)  fmEls.pairLeft.classList.remove('playing');
    if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
    isPlay = false;
    return;
  }

  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const c = gAC();
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const refPan = fmRefSide === "left" ? -1 : 1;
  const varPan = fmVarSide === "left" ? -1 : 1;

  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  const refCorr = fmCorrGain(fmRefSide, refHz);
  const varCorr = fmCorrGain(fmVarSide, varHz);
  const refBalDb = fmRefSide === "left" ? balG.left : balG.right;
  const varBalDb = fmVarSide === "left" ? balG.left : balG.right;
  const refVol = isDeaf(fmRefSide) ? 0 : vol * refCorr * dB2G(refBalDb);
  const varVol = isDeaf(fmVarSide) ? 0 : vol * varCorr * dB2G(varBalDb);

  isPlay = true;
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.add('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
  await Promise.all([
    playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
  ]);
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.remove('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.remove('playing');
  isPlay = false;
}
```

Auch hier ist nur der `if (fmAdaptiveActive)`-Branch neu, der Rest ist
das alte Slider-Modus-Verhalten unverändert.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus der Liste oben
einzeln durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich gegenchecken:
- Im neuen Code wird `fmTracks[fmCurTrackId]` nirgendwo mutiert (rein
  lesender Zugriff). Wenn doch — Bug.
- `fmAwaitingResponse` wird im neuen Code nicht angefasst.
- `fmAdaptiveActive`-Check steht VOR `fmCurrentEl`-Check (sonst greift
  der frühe Rückkehr-Path).
- Slider-Modus-Pfad ist textuell identisch zum vorherigen Stand (Diff
  außerhalb des neuen Adaptive-Branches sollte leer sein).

## Hinweis

Keine i18n-Änderungen. Keine SPEC-Änderung nötig (war ein reiner Bug,
nicht im Konzept dokumentiert).
