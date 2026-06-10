# BAUANLEITUNG 148 — SYMMETRISCH-Modus: Audio + Anzeige + Datenspeicherung

**Zieldateien:** `js/freqmatch.js`, `js/freqmatch-slider.js`, `js/freqmatch-adaptive.js`, `i18n/de.js`, `js/version.js`
**Voraussetzung:** BA 147 abgeschlossen (`APP_VERSION = "3.0.147-beta"`, `fmSymmetric`, `fmBuildSeqSymmetric`, Dropdown-Option vorhanden)
**Version:** 3.0.147-beta → **3.0.148-beta**

---

## Kontext

BA 147 hat den symmetric-Modus auf-/abgehängt, aber der Test endet beim
Start mit einem Stub-Alert. Diese BA macht ihn voll funktionsfähig:

- **Audio**: in `fmPlayCurrent`/`fmPlaySimultaneous` (Slider) und
  `fmPlayAdaptiveTrial`/`fmPlaySimultaneous` (Adaptiv) wird im symmetric-Fall
  die Hz-Berechnung pro Trial durch die symmetrische Variante ersetzt.
  Der Rest (Pause, ABA, `playOne(side, hz)`, Pair-Indicator) bleibt
  unverändert, weil die BA-147-Konvention `fmVarSide='left'` / `fmRefSide='right'`
  die bestehenden `playOne(fmRefSide, refHz)` / `playOne(fmVarSide, varHz)`-Calls
  automatisch auf die korrekten Seiten lenkt.

- **Slider-Anzeige**: `fmShowElectrode` zeigt im symmetric-Fall auf beiden
  pair-Indikatoren das Elektroden-Label mit der jeweiligen Mittenfrequenz.
  `fmUpdateSliderDisplay` zeigt im symmetric-Fall im `sliderValue` beide
  Wiedergabe-Hz mit Cent-Offset und lässt die pi-Labels unangetastet.

- **Datenspeicherung**: `fmConfirm` (Slider), `_fmWriteResult` und
  `_fmRemoveResult` (Adaptiv) schreiben im symmetric-Fall mit
  `refSide: 'symmetric'`. `fmPrevCent` liest den symmetric-Eintrag korrekt
  über `entry.cent`.

**Formeln (verbindlich):**
- `playL = leftBase × 2^(−fmCentOffset / 2 / 1200)` (Slider) bzw.
  `playL = leftBase × 2^(−track.currentOffset / 2 / 1200)` (Adaptiv)
- `playR = rightBase × 2^(+fmCentOffset / 2 / 1200)` bzw.
  `playR = rightBase × 2^(+track.currentOffset / 2 / 1200)`
- mit `leftBase = effFreq an 'left'`, `rightBase = effFreq an 'right'`
- **Catch-Trial im symmetric**: `catchInfo.direction` wird auf beide Seiten
  je `±catchInfo.direction / 2` verteilt — Gesamtdifferenz zwischen den
  beiden Tönen bleibt `catchInfo.direction` Cent.

---

## Schritt 1 — Stub aus `fmStartSlider` entfernen

Datei: `js/freqmatch-slider.js`

Aus dem `if (fmSymmetric) { … }`-Block in `fmStartSlider` (eingeführt in
BA 147 Schritt 10) entferne die drei Stub-Zeilen:

```js
    // Audio kommt in BA 148. Vorerst Stub-Alert + Stop.
    alert((typeof t === 'function' && t('fmSymmetricNotYet'))
      || 'Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.');
    fmEls._stopTest();
    return;
```

Direkt **darunter** (= am Ende des `if (fmSymmetric)`-Blocks) füge ein:

```js
    testUI.sideCheck.run(
      { sides: 'both' },
      _fmDoStartSlider,
      function() { if (fmEls) fmEls._stopTest(); }
    );
    return;
```

Damit endet der symmetric-Zweig regulär mit `testUI.sideCheck.run`, der
nicht-symmetric-Zweig bleibt darunter unverändert.

---

## Schritt 2 — Stub aus `fmStartAdaptive` entfernen

Datei: `js/freqmatch-adaptive.js`

Aus dem `if (fmSymmetric) { … }`-Block in `fmStartAdaptive` (eingeführt in
BA 147 Schritt 11) entferne die drei Stub-Zeilen:

```js
    // Audio kommt in BA 148. Vorerst Stub-Alert + Stop.
    alert((typeof t === 'function' && t('fmSymmetricNotYet'))
      || 'Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.');
    fmEls._stopTest();
    return;
```

Den Schluss des `if (fmSymmetric)`-Blocks **ersatzlos schließen** — danach
läuft die Funktion normal weiter (Slider-Estimate-Warnung,
Slider-Estimate-Dialog, `testUI.sideCheck.run` etc.). Damit profitiert der
symmetric-Adaptiv-Test automatisch von den bestehenden Vor-Checks.

---

## Schritt 3 — `fmConfirm` (Slider) für symmetric

Datei: `js/freqmatch-slider.js`

Suche im Funktionskörper von `fmConfirm` die Zuweisung an `store[...]`
(typische Zeilen ~104-110):

```js
    store[String(fmCurrentEl)] = {
      cent:    Math.round(fmCentOffset),
      varSide: fmVarSide,
      refSide: fmRefSide,
      varFreq: varHz,
      timestamp: Date.now(),
    };
```

Ersetze die `refSide`-Zeile durch:

```js
      refSide: fmSymmetric ? 'symmetric' : fmRefSide,
```

(Alle anderen Felder bleiben unverändert.)

---

## Schritt 4 — `fmShowElectrode` (Slider) für symmetric

Datei: `js/freqmatch-slider.js`

Aktueller Funktionskörper (Z. ~28-55):

```js
function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const varHz = fmVarHz(fmCurrentEl);
  const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
  const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
    varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
  const pi = _fmSliderPI();
  if (pi) {
    if (fmVarSide === "left") pi.left.textContent = varText;
    else                      pi.right.textContent = varText;
  }
  if (slRefs && slRefs.slider) {
    testUI.slider.setValue(slRefs.slider, fmCentOffset);
  }
  fmUpdateSliderDisplay();
  if (slRefs && slRefs.progress) {
    const pText = slRefs.progress.text;
    const pFill = slRefs.progress.fill;
    if (pText) {
      const tn = pText.firstChild;
      if (tn && tn.nodeType === 3) tn.textContent = ((fmSeqIdx + 1) + " / " + fmSeq.length) + ' ';
    }
    if (pFill) pFill.style.width = (fmSeq.length > 0 ? (fmSeqIdx / fmSeq.length * 100) : 0) + "%";
  }
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}
```

Ersetze ihn durch (NUR der pi-Label-Block wird verzweigt, Rest unverändert):

```js
function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const pi = _fmSliderPI();
  if (fmSymmetric) {
    const leftHz  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightHz = withSide('right', function() { return effFreq(fmCurrentEl); });
    if (pi) {
      const leftLabel  = withSide('left',  function() { return dENPrefix() + dEN(fmCurrentEl); });
      const rightLabel = withSide('right', function() { return dENPrefix() + dEN(fmCurrentEl); });
      pi.left.textContent  = leftLabel  + ", " + leftHz.toFixed(2)  + " Hz (" + t("sideLeft")  + ")";
      pi.right.textContent = rightLabel + ", " + rightHz.toFixed(2) + " Hz (" + t("sideRight") + ")";
    }
  } else {
    const varHz = fmVarHz(fmCurrentEl);
    const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
    const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
      varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
    if (pi) {
      if (fmVarSide === "left") pi.left.textContent = varText;
      else                      pi.right.textContent = varText;
    }
  }
  if (slRefs && slRefs.slider) {
    testUI.slider.setValue(slRefs.slider, fmCentOffset);
  }
  fmUpdateSliderDisplay();
  if (slRefs && slRefs.progress) {
    const pText = slRefs.progress.text;
    const pFill = slRefs.progress.fill;
    if (pText) {
      const tn = pText.firstChild;
      if (tn && tn.nodeType === 3) tn.textContent = ((fmSeqIdx + 1) + " / " + fmSeq.length) + ' ';
    }
    if (pFill) pFill.style.width = (fmSeq.length > 0 ? (fmSeqIdx / fmSeq.length * 100) : 0) + "%";
  }
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}
```

---

## Schritt 5 — `fmUpdateSliderDisplay` (Slider) für symmetric

Datei: `js/freqmatch-slider.js`

Aktueller Funktionskörper (Z. ~8-26):

```js
function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const hzStr = refHz.toFixed(2);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (slRefs && slRefs.sliderValue) {
    slRefs.sliderValue.textContent = centStr + " " + centUnit + " (" + hzStr + " Hz)";
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") pi.left.textContent = refText;
    else                      pi.right.textContent = refText;
  }
}
```

Ersetze ihn durch:

```js
function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (fmSymmetric) {
    const leftBase  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    const playL = leftBase  * Math.pow(2, -fmCentOffset / 2 / 1200);
    const playR = rightBase * Math.pow(2, +fmCentOffset / 2 / 1200);
    if (slRefs && slRefs.sliderValue) {
      slRefs.sliderValue.textContent = centStr + " " + centUnit
        + " (L: " + playL.toFixed(0) + " Hz / R: " + playR.toFixed(0) + " Hz)";
    }
    // pi.left/right werden von fmShowElectrode gesetzt (Elektroden-Labels) und
    // hier nicht überschrieben — der Live-Bewegungs-Feedback steckt im sliderValue.
    return;
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const hzStr = refHz.toFixed(2);
  if (slRefs && slRefs.sliderValue) {
    slRefs.sliderValue.textContent = centStr + " " + centUnit + " (" + hzStr + " Hz)";
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") pi.left.textContent = refText;
    else                      pi.right.textContent = refText;
  }
}
```

---

## Schritt 6 — `fmPlayCurrent` Slider-Pfad für symmetric

Datei: `js/freqmatch.js`

Aktueller Slider-Pfad-Anfang (Z. ~288-296):

```js
  // --- Slider-Modus: unverändertes Altverhalten ---
  if (fmCurrentEl === null) return;
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise((r) => setTimeout(r, 60));
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
```

Ersetze die zwei letzten Zeilen (`const varHz = …` und `const refHz = …`) durch:

```js
  let varHz, refHz;
  if (fmSymmetric) {
    const varBase = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const refBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    varHz = varBase * Math.pow(2, -fmCentOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +fmCentOffset / 2 / 1200);
  } else {
    varHz = fmVarHz(fmCurrentEl);
    refHz = fmFreqFromCents(varHz, fmCentOffset);
  }
```

Der Rest der Funktion (`vol`, `ms`, `pau`, `aba`, `balG`, `playOne`,
`indRef`/`indVar`/`indOff`, die `firstSide`-Verzweigung) bleibt **unverändert**.
Im symmetric-Fall spielt `playOne(fmRefSide, refHz) = playOne('right', refHz)`
und `playOne(fmVarSide, varHz) = playOne('left', varHz)`.

---

## Schritt 7 — `fmPlaySimultaneous` Slider-Pfad für symmetric

Datei: `js/freqmatch.js`

Aktueller Slider-Pfad-Anfang (Z. ~405-414):

```js
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
```

Ersetze die zwei letzten Zeilen (`const varHz = …` und `const refHz = …`) durch:

```js
  let varHz, refHz;
  if (fmSymmetric) {
    const varBase = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const refBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    varHz = varBase * Math.pow(2, -fmCentOffset / 2 / 1200);
    refHz = refBase * Math.pow(2, +fmCentOffset / 2 / 1200);
  } else {
    varHz = fmVarHz(fmCurrentEl);
    refHz = fmFreqFromCents(varHz, fmCentOffset);
  }
```

Der Rest des Slider-Pfades (`vol`, `ms`, `refPan`/`varPan`, `balG`,
`refCorr`/`varCorr`, `Promise.all` mit `playToneTyped`) bleibt **unverändert**.

---

## Schritt 8 — `fmPlayAdaptiveTrial` für symmetric (sequenziell, Catch ±cent/2)

Datei: `js/freqmatch-adaptive.js`

Aktueller Abschnitt (Z. ~259-265):

```js
  const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
  const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
  // normaler Trial: varHz = elFreq (CI-Elektrode statisch)
  // Catch-Trial:    varHz = refHz * 2^(±500/1200) — ±500 cent von ref
  const varHz  = catchInfo
    ? refHz * Math.pow(2, catchInfo.direction / 1200)
    : elFreq;
```

Ersetze diesen kompletten Block (alle sieben Zeilen, von `const elFreq = …`
bis einschließlich `: elFreq;` — inklusive der beiden Kommentar-Zeilen) durch:

```js
  let refHz, varHz;
  if (fmSymmetric) {
    const varBase = withSide('left',  function() { return effFreq(track.electrodeIdx); });
    const refBase = withSide('right', function() { return effFreq(track.electrodeIdx); });
    const halfOff = track.currentOffset / 2;
    if (catchInfo) {
      // Catch im symmetric: catchInfo.direction wird halbiert auf beide Seiten verteilt,
      // sodass die Gesamtdifferenz zwischen den zwei Tönen catchInfo.direction Cent beträgt.
      const halfCatch = catchInfo.direction / 2;
      varHz = varBase * Math.pow(2, (-halfOff - halfCatch) / 1200);
      refHz = refBase * Math.pow(2, (+halfOff + halfCatch) / 1200);
    } else {
      varHz = varBase * Math.pow(2, -halfOff / 1200);
      refHz = refBase * Math.pow(2, +halfOff / 1200);
    }
  } else {
    const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
    refHz = elFreq * Math.pow(2, track.currentOffset / 1200);
    // normaler Trial: varHz = elFreq (CI-Elektrode statisch)
    // Catch-Trial:    varHz = refHz * 2^(±500/1200) — ±500 cent von ref
    varHz = catchInfo ? refHz * Math.pow(2, catchInfo.direction / 1200) : elFreq;
  }
```

Der Rest der Funktion (`playOne`, `firstSide`-Verzweigung mit
sequenziellem Ablauf, ABA-Block) bleibt **unverändert**. Im symmetric-Fall
spielen die bestehenden `playOne(fmRefSide, refHz)` / `playOne(fmVarSide, varHz)`-Calls
automatisch auf 'right' bzw. 'left' (BA 147 Konvention) — mit den oben
berechneten symmetrischen Hz-Werten.

---

## Schritt 9 — `fmPlaySimultaneous` Adaptiv-Pfad für symmetric

Datei: `js/freqmatch.js`

Aktueller Adaptiv-Pfad in `fmPlaySimultaneous` (Z. ~373-378):

```js
    const track  = fmTracks[fmCurTrackId];
    const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
    const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
    const varHz  = fmCurCatchInfo
      ? refHz * Math.pow(2, fmCurCatchInfo.direction / 1200)
      : elFreq;
```

`const track = …` (Z. 373) bleibt **unverändert** stehen. Ersetze nur die
**fünf** Zeilen ab `const elFreq = …` bis zur schließenden Klammer des
`varHz`-Ausdrucks (also Z. 374-378) durch:

```js
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
```

Der Rest des Adaptiv-Pfades (`vol`, `ms`, `refPan`/`varPan`, `balG`,
`refCorr`/`varCorr`, `Promise.all`) bleibt **unverändert**.

---

## Schritt 10 — `_fmWriteResult` für symmetric

Datei: `js/freqmatch-adaptive.js`

Aktueller Funktionskörper (Z. ~571-606):

```js
function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
  const agg   = _fmAggregateRunsForElectrode(fmVarSide, elIdx);

  const refHz = (agg.cent != null)
    ? varHz * Math.pow(2, agg.cent / 1200)
    : null;

  const existingIdx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  const entry = {
    varSide:               fmVarSide,
    refSide:               fmRefSide,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
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
  if (existingIdx >= 0) fRes[existingIdx] = entry;
  else                  fRes.push(entry);
  _fmDbg('fRes write: side=' + fmVarSide + ' el=' + elIdx
       + ' cent=' + (agg.cent != null ? agg.cent.toFixed(1) : 'null')
       + ' resid=' + (agg.fmResiduum != null ? agg.fmResiduum.toFixed(1) : 'null')
       + ' runs=' + agg.runsCount);
}
```

Ersetze den **gesamten Funktionskörper** durch:

```js
function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const agg   = _fmAggregateRunsForElectrode(fmVarSide, elIdx);

  let varHz, refHz, _refSideOut, existingIdx;
  if (fmSymmetric) {
    varHz = withSide('left',  function() { return effFreq(elIdx); });
    refHz = withSide('right', function() { return effFreq(elIdx); });
    _refSideOut = 'symmetric';
    existingIdx = fRes.findIndex(function(r) {
      return r.refSide === 'symmetric' && r.elIdx === elIdx;
    });
  } else {
    varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
    refHz = (agg.cent != null)
      ? varHz * Math.pow(2, agg.cent / 1200)
      : null;
    _refSideOut = fmRefSide;
    existingIdx = fRes.findIndex(function(r) {
      return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
    });
  }

  const entry = {
    varSide:               fmVarSide,
    refSide:               _refSideOut,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
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
  if (fmSymmetric) {
    entry.cent = (agg.cent != null) ? Math.round(agg.cent) : null;
  }
  if (existingIdx >= 0) fRes[existingIdx] = entry;
  else                  fRes.push(entry);
  _fmDbg('fRes write: side=' + fmVarSide + ' el=' + elIdx
       + (fmSymmetric ? ' [SYM]' : '')
       + ' cent=' + (agg.cent != null ? agg.cent.toFixed(1) : 'null')
       + ' resid=' + (agg.fmResiduum != null ? agg.fmResiduum.toFixed(1) : 'null')
       + ' runs=' + agg.runsCount);
}
```

---

## Schritt 11 — `_fmRemoveResult` für symmetric

Datei: `js/freqmatch-adaptive.js`

Aktueller Funktionskörper (Z. ~532-569):

```js
function _fmRemoveResult(elIdx) {
  const agg = _fmAggregateRunsForElectrode(fmVarSide, elIdx);
  if (agg.cent != null) {
    const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
    const refHz = varHz * Math.pow(2, agg.cent / 1200);
    const existingIdx = fRes.findIndex(function(r) {
      return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
    });
    const entry = {
      varSide:               fmVarSide,
      refSide:               fmRefSide,
      elIdx:                 elIdx,
      varFreq:               varHz,
      refFreq:               refHz,
      timestamp:             Date.now(),
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
    if (existingIdx >= 0) fRes[existingIdx] = entry;
    else                  fRes.push(entry);
    _fmDbg('fRes keep via agg: side=' + fmVarSide + ' el=' + elIdx
         + ' (not-perceivable im aktuellen Lauf, andere Läufe haben Daten)');
    return;
  }
  const idx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  if (idx >= 0) fRes.splice(idx, 1);
  _fmDbg('fRes remove: side=' + fmVarSide + ' el=' + elIdx + ' (not-perceivable)');
}
```

Ersetze den **gesamten Funktionskörper** durch:

```js
function _fmRemoveResult(elIdx) {
  const agg = _fmAggregateRunsForElectrode(fmVarSide, elIdx);
  if (agg.cent != null) {
    let varHz, refHz, _refSideOut, existingIdx;
    if (fmSymmetric) {
      varHz = withSide('left',  function() { return effFreq(elIdx); });
      refHz = withSide('right', function() { return effFreq(elIdx); });
      _refSideOut = 'symmetric';
      existingIdx = fRes.findIndex(function(r) {
        return r.refSide === 'symmetric' && r.elIdx === elIdx;
      });
    } else {
      varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
      refHz = varHz * Math.pow(2, agg.cent / 1200);
      _refSideOut = fmRefSide;
      existingIdx = fRes.findIndex(function(r) {
        return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
      });
    }
    const entry = {
      varSide:               fmVarSide,
      refSide:               _refSideOut,
      elIdx:                 elIdx,
      varFreq:               varHz,
      refFreq:               refHz,
      timestamp:             Date.now(),
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
    if (fmSymmetric) entry.cent = Math.round(agg.cent);
    if (existingIdx >= 0) fRes[existingIdx] = entry;
    else                  fRes.push(entry);
    _fmDbg('fRes keep via agg: side=' + fmVarSide + ' el=' + elIdx
         + (fmSymmetric ? ' [SYM]' : '')
         + ' (not-perceivable im aktuellen Lauf, andere Läufe haben Daten)');
    return;
  }
  const idx = fRes.findIndex(function(r) {
    return fmSymmetric
      ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
      : (r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx);
  });
  if (idx >= 0) fRes.splice(idx, 1);
  _fmDbg('fRes remove: side=' + fmVarSide + ' el=' + elIdx
       + (fmSymmetric ? ' [SYM]' : '')
       + ' (not-perceivable)');
}
```

---

## Schritt 12 — `fmPrevCent` für symmetric

Datei: `js/freqmatch.js`

Aktueller Funktionskörper (Z. ~254-268):

```js
function fmPrevCent(elIdx) {
  // 1) Vorhandene Slider-Vor-Schätzung hat höchste Priorität.
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store && store[String(elIdx)] != null) {
    const c = store[String(elIdx)].cent;
    if (typeof c === 'number' && isFinite(c)) return Math.round(c);
  }
  // 2) Sonst fRes-Eintrag.
  const existing = fRes.find(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx
  );
  if (!existing) return 0;
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}
```

Ersetze ihn durch:

```js
function fmPrevCent(elIdx) {
  // 1) Vorhandene Slider-Vor-Schätzung hat höchste Priorität.
  //    sliderEstimates wird im symmetric-Modus in sideData.left.* abgelegt
  //    (BA 147 Konvention fmVarSide='left'); kein zusätzlicher refSide-Filter
  //    nötig, weil Modus-Wechsel die Daten ohnehin löscht (BA 145 fmRCDlg).
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store && store[String(elIdx)] != null) {
    const c = store[String(elIdx)].cent;
    if (typeof c === 'number' && isFinite(c)) return Math.round(c);
  }
  // 2) Sonst fRes-Eintrag.
  const existing = fRes.find((r) => fmSymmetric
    ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
    : (r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx)
  );
  if (!existing) return 0;
  // Im symmetric ist entry.cent der gespeicherte Match-Offset (positiv = rechts höher).
  // varFreq/refFreq sind dort die rohen Mittenfrequenzen — fmCents(varFreq, refFreq)
  // würde die Hz-Differenz der Mittenfrequenzen liefern, nicht den Match-Offset.
  if (fmSymmetric && typeof existing.cent === 'number' && isFinite(existing.cent)) {
    return Math.round(existing.cent);
  }
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}
```

---

## Schritt 13 — `fmSymmetricNotYet`-i18n-Eintrag entfernen

Datei: `i18n/de.js`

Der Stub-String ist nach Schritt 1 + 2 nicht mehr referenziert. Entferne die
Zeile:

```js
    fmSymmetricNotYet:     "Symmetrischer Modus: Audiowiedergabe wird in der nächsten Version aktiviert.",
```

(Die zwei anderen symmetric-Keys `fmSymmetricOption` und `fmSymmetricElMismatch`
bleiben — sie sind weiterhin im Einsatz.)

---

## Schritt 14 — Version hochzählen

Datei: `js/version.js`

```js
const APP_VERSION = "3.0.148-beta";
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Position einzeln prüfen und melden
(erfüllt / nicht erfüllt / unklar, mit Datei+Zeile):

1. `fmStartSlider`: im `if (fmSymmetric)`-Block sind die drei Stub-Zeilen
   entfernt; statt dessen folgt direkt `testUI.sideCheck.run(...)` mit `return;`.
2. `fmStartAdaptive`: im `if (fmSymmetric)`-Block sind die drei Stub-Zeilen
   entfernt; die Funktion läuft danach in die Slider-Estimate-Warnung weiter.
3. `fmConfirm`: Feld `refSide` ist auf
   `fmSymmetric ? 'symmetric' : fmRefSide` umgestellt.
4. `fmShowElectrode`: enthält am Anfang einen `if (fmSymmetric) { … } else { … }`
   für den pi-Label-Block; im symmetric-Fall werden beide pi.left und pi.right
   mit Elektroden-Label + Mittenfrequenz beschriftet.
5. `fmUpdateSliderDisplay`: enthält einen frühen
   `if (fmSymmetric) { … return; }` Block, der `sliderValue.textContent` mit
   "L: <Hz> / R: <Hz>" füllt und die pi-Labels nicht überschreibt.
6. `fmPlayCurrent` Slider-Pfad: `varHz`/`refHz` werden durch eine
   `if (fmSymmetric) / else` Verzweigung berechnet; alle nachfolgenden Calls
   (`playOne(fmRefSide, refHz)` etc.) bleiben unverändert.
7. `fmPlaySimultaneous` Slider-Pfad: dieselbe Verzweigung.
8. `fmPlayAdaptiveTrial`: `refHz`/`varHz` per `if (fmSymmetric) / else`
   verzweigt; im Catch-Fall wird `catchInfo.direction` halbiert auf beide
   Seiten verteilt.
9. `fmPlaySimultaneous` Adaptiv-Pfad: dieselbe Verzweigung für
   `track.currentOffset` und `fmCurCatchInfo`.
10. `_fmWriteResult`: kompletter Funktionskörper ersetzt; symmetric-Pfad
    schreibt `refSide: 'symmetric'`, `varFreq` = linke Mittenfrequenz,
    `refFreq` = rechte Mittenfrequenz, `entry.cent` = Match-Offset.
11. `_fmRemoveResult`: kompletter Funktionskörper ersetzt; **beide**
    `findIndex`-Aufrufe (Aggregat-vorhanden und Entry-entfernen) haben einen
    symmetric-Pfad über `r.refSide === 'symmetric' && r.elIdx === elIdx`.
12. `fmPrevCent`: symmetric-Pfad in `fRes.find`; bei symmetric-Treffer wird
    `existing.cent` zurückgegeben (nicht `fmCents(varFreq, refFreq)`).
13. `i18n/de.js`: `fmSymmetricNotYet` entfernt. `fmSymmetricOption` und
    `fmSymmetricElMismatch` weiterhin vorhanden.
14. `APP_VERSION` in `js/version.js` ist `"3.0.148-beta"`.

---

## Akzeptanztest

1. App laden. Implantat: beide Seiten = CI mit identischer Elektroden-
   Konfiguration. Tab Frequenzabgleich. Dropdown zeigt „Symmetrisch
   (bilateral CI)", Start klicken.
2. **Slider symmetric:** Test läuft, KEIN Stub-Alert mehr. ✓
   - Beide pi.left und pi.right zeigen Elektroden-Label und Mittenfrequenz. ✓
   - `sliderValue` zeigt z.B. `+0 Cent (L: 1000 Hz / R: 1003 Hz)` (oder
     vergleichbare Mittenfrequenzen). ✓
   - Slider bewegen: `sliderValue` zeigt veränderte L/R-Hz; pi-Labels
     bleiben unverändert (Elektroden-Mittenfrequenz). ✓
   - „Wiederholen" (sequenziell): erst eine Seite, dann die andere klingt
     je nach `fmFirstSide`-Random. ✓
   - „Wiederholen simultan": beide Seiten klingen gleichzeitig. ✓
   - „Bestätigen": nächste Elektrode. ✓
   - Browser-Konsole nach 1 Bestätigung:
     `sideData.left.freqmatchAdaptive.sliderEstimates[<elIdx>].refSide === 'symmetric'` → `true`. ✓
3. **Adaptiv symmetric (Debug-Sim):** Browser-Konsole `fmRunDebugSim()`.
   Keine JS-Fehler. Konvergenz-Werte erscheinen im Status-Grid. ✓
   - `fRes.some(r => r.refSide === 'symmetric')` → `true`. ✓
   - Ein `fRes`-Eintrag mit `refSide === 'symmetric'` hat ein Feld `cent`
     mit dem Match-Offset (positiv = rechts höher). ✓
4. **Adaptiv symmetric (manuell):** Mit echtem Hörtest 1-2 Trials laufen
   lassen.
   - Die zwei Töne pro Trial werden sequenziell mit Pause präsentiert
     (analog LEFT/RIGHT). ✓
   - Pair-Indicator zeigt Ton 1 / Ton 2 in der gewohnten Reihenfolge. ✓
   - Bei `fmCurFirstSide === 'ref'`: Ton 1 = rechts (BA 147 Konvention
     fmRefSide='right'). ✓
   - Catch-Trial: deutlich hörbarer Pitch-Sprung zwischen den zwei Tönen,
     beide Seiten sind je ±cent/2 verschoben. ✓
5. **Mismatch-Schutz:** Eine Elektrode auf einer Seite zusätzlich
   deaktivieren, dann Start (Slider oder Adaptiv).
   - Mismatch-Alert „Beide Seiten müssen dieselben aktiven Elektroden haben". ✓
6. **Modus-Wechsel:** Im symmetric-Modus 1-2 Trials machen, dann
   refSelect auf 'left' wechseln.
   - BA-145-Schutzdialog „alle Ergebnisse löschen?" erscheint. ✓
   - Nach OK: fRes leer, sideData.*.freqmatchAdaptive null. ✓

---

*Hinweis: Die Ergebnis-Anzeige (`renderFreqMatchResults` in `results.js`,
Druck-Module in `print.js`/`print-md.js`, Audiologen-Brief) erkennt
`refSide === 'symmetric'` derzeit nicht und wird in BA 149 ergänzt.
Übersetzungen (en, fr, es) der i18n-Keys aus BA 147+148 werden in einer
eigenen Mini-Anleitung nachgezogen.*
