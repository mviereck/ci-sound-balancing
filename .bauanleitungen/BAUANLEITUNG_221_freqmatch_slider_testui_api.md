# BAUANLEITUNG 221 — freqmatch: Slider-Display, PairIndicator, Range-Marker über TestUI-API (inkl. Marker-Bug-Fix)

## Voraussetzung

- **BA 219 und BA 220 sind gebaut.** `js/version.js` zeigt mindestens
  `"3.2.220-beta"` (ggf. `3.2.220.x-beta`).
- Wenn `version.js` noch auf einer 218er/219er-Version steht: **diese
  Anleitung nicht ausführen**, nachfragen.

## Ziel

Vier Migrationen in freqmatch und ein Bugfix:

1. `fmUpdateSliderDisplay` (`freqmatch-slider.js:9–38`) — direkter
   `slRefs.sliderValue.textContent`-Zugriff → `testUI.slider.setValueDisplay`.
2. PairIndicator-Labels in `freqmatch-slider.js` (drei Stellen) und
   `freqmatch-adaptive.js:275` — direktes `.textContent` → bestehende
   `testUI.pairIndicator.setLabels`.
3. `_fmUpdateSliderRangeMarker` (`freqmatch-slider.js:75–113`) —
   direkte `style.left/width/display`-Manipulation → `testUI.slider.setRangeHint`.
4. **Bugfix Range-Marker:** Der Marker erscheint heute meist nicht,
   weil `testUI.slider.setValue` den Slider-Range jedes Mal auf den
   Cent-Wert neu kalibriert. Lag der Marker (Median bisheriger Runden)
   außerhalb dieses Bereichs, wurde er ausgeblendet. Behoben durch
   einen neuen optionalen Parameter `opts.minAbs` an `testUI.slider.setValue`
   und Übergabe des Marker/Range-Maximums beim Wechsel der Elektrode.

Status-Grids (`fmRenderSliderStatusGrid`, `fmRenderStatusGrid`) bleiben
**unverändert** — Migration kommt erst mit lr-balance/test.js, wenn ein
strukturierter Setter sinnvoll ist.

---

## Schritt 1 — `testUI.slider.setValue`: optionaler `opts.minAbs`-Parameter

**Datei:** `js/test-ui.js`

**Hintergrund:** Heute setzt `setValue` `slRef.input.min/max` immer auf
genau die Schritte, die für `|value|` nötig sind. Damit der Range-Hint
(Min/Max-Band + Marker) auch dann sichtbar bleibt, wenn er außerhalb
des Cent-Werts liegt, muss der Range mindestens so groß sein wie das
Maximum aus `|value|`, `|marker|` und `|min|/|max|` des Hints.

**Vorher** (`js/test-ui.js`, Zeilen 1916–1939 — die `setValue`-Methode
innerhalb des `testUI.slider`-Blocks):

```js
    /**
     * Slider-Wert setzen und Range auf Minimum zurücksetzen.
     * Expandiert den Bereich, falls abs(value) > initialRange.
     * slRef: refs.slider aus _buildTestPanelNew
     * value: neuer numerischer Wert
     */
    setValue: function(slRef, value) {
      if (!slRef || !slRef.input || !slRef.initialRange) return;
      var absVal = Math.abs(value);
      var needed = slRef.initialRange;
      var stepIdx = 0;
      while (absVal > needed && needed < slRef.maxRange) {
        needed = Math.min(needed + slRef.initialRange, slRef.maxRange);
        stepIdx++;
      }
      slRef.rangeIdx = stepIdx;
      slRef.input.min = String(-needed);
      slRef.input.max = String(needed);
      slRef.input.value = String(Math.max(-needed, Math.min(needed, value)));
      slRef.input.style.setProperty('--sl-range-step', stepIdx);
    },
```

**Nachher** (komplette Methode ersetzen):

```js
    /**
     * Slider-Wert setzen und Range auf das fuer Wert und ggf. opts.minAbs
     * noetige Minimum kalibrieren. Expandiert den Bereich, bis
     * max(|value|, opts.minAbs|0) hineinpasst, hoechstens bis maxRange.
     *
     * slRef: refs.slider aus _buildTestPanelNew
     * value: neuer numerischer Wert
     * opts:  optional { minAbs: number } — Mindest-Absolutbereich
     *        (z.B. Marker-Position aus setRangeHint).
     */
    setValue: function(slRef, value, opts) {
      if (!slRef || !slRef.input || !slRef.initialRange) return;
      var minAbs = (opts && isFinite(opts.minAbs)) ? Math.abs(opts.minAbs) : 0;
      var absVal = Math.max(Math.abs(value), minAbs);
      var needed = slRef.initialRange;
      var stepIdx = 0;
      while (absVal > needed && needed < slRef.maxRange) {
        needed = Math.min(needed + slRef.initialRange, slRef.maxRange);
        stepIdx++;
      }
      slRef.rangeIdx = stepIdx;
      slRef.input.min = String(-needed);
      slRef.input.max = String(needed);
      slRef.input.value = String(Math.max(-needed, Math.min(needed, value)));
      slRef.input.style.setProperty('--sl-range-step', stepIdx);
    },
```

---

## Schritt 2 — `fmUpdateSliderDisplay`: setValueDisplay + setLabels

**Datei:** `js/freqmatch-slider.js`

**Vorher** (Zeilen 9–38):

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

**Nachher** (komplette Funktion ersetzen):

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
    if (slRefs && slRefs.slider) {
      testUI.slider.setValueDisplay(
        slRefs.slider,
        centStr + " " + centUnit
          + " (L: " + playL.toFixed(0) + " Hz / R: " + playR.toFixed(0) + " Hz)"
      );
    }
    return;
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const hzStr = refHz.toFixed(2);
  if (slRefs && slRefs.slider) {
    testUI.slider.setValueDisplay(
      slRefs.slider,
      centStr + " " + centUnit + " (" + hzStr + " Hz)"
    );
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") {
      testUI.pairIndicator.setLabels(pi, { leftText: refText });
    } else {
      testUI.pairIndicator.setLabels(pi, { rightText: refText });
    }
  }
}
```

---

## Schritt 3 — `fmShowElectrode`: setLabels + Bugfix für Marker

**Datei:** `js/freqmatch-slider.js`

**Vorher** (Zeilen 40–71):

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
  _fmUpdateSliderRangeMarker();
  fmUpdateSliderProgress();
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}
```

**Nachher** (komplette Funktion ersetzen):

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
      testUI.pairIndicator.setLabels(pi, {
        leftText:  leftLabel  + ", " + leftHz.toFixed(2)  + " Hz (" + t("sideLeft")  + ")",
        rightText: rightLabel + ", " + rightHz.toFixed(2) + " Hz (" + t("sideRight") + ")"
      });
    }
  } else {
    const varHz = fmVarHz(fmCurrentEl);
    const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
    const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
      varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
    if (pi) {
      if (fmVarSide === "left") {
        testUI.pairIndicator.setLabels(pi, { leftText: varText });
      } else {
        testUI.pairIndicator.setLabels(pi, { rightText: varText });
      }
    }
  }
  if (slRefs && slRefs.slider) {
    // BA 221: Slider-Range so erweitern, dass Marker und Min/Max des
    // Range-Hints reinpassen. Sonst blendet setRangeHint sie aus.
    var _markerAbs = _fmSliderMarkerMaxAbs(fmCurrentEl);
    testUI.slider.setValue(slRefs.slider, fmCentOffset, { minAbs: _markerAbs });
  }
  fmUpdateSliderDisplay();
  _fmUpdateSliderRangeMarker();
  fmUpdateSliderProgress();
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}

// BA 221: Maximaler Absolutbetrag aus bisherigen Slider-Runden fuer
// diese Elektrode — fuer minAbs in testUI.slider.setValue.
// Liefert 0, wenn keine Daten oder keine endlichen Werte vorliegen.
function _fmSliderMarkerMaxAbs(elIdx) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return 0;
  const e = store[String(elIdx)];
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  if (!rounds || rounds.length === 0) return 0;
  const agg = _fmAggregateCent(rounds);
  const range = _fmRangeCent(rounds);
  let m = 0;
  if (agg != null && isFinite(agg)) m = Math.max(m, Math.abs(agg));
  if (range) {
    if (isFinite(range.min)) m = Math.max(m, Math.abs(range.min));
    if (isFinite(range.max)) m = Math.max(m, Math.abs(range.max));
  }
  return m;
}
```

---

## Schritt 4 — `_fmUpdateSliderRangeMarker` auf setRangeHint umstellen

**Datei:** `js/freqmatch-slider.js`

**Vorher** (Zeilen 73–113):

```js
// BA 206: Balken (Min..Max der bisherigen Werte) + Dreieck (Median/Mean/Single)
// unter dem Slider. Sichtbar ab dem ersten gespeicherten Wert; Balken erst ab 2.
function _fmUpdateSliderRangeMarker() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  if (!slRefs) return;
  const hint = slRefs.rangeHint, band = slRefs.rangeHintBand,
        mark = slRefs.rangeHintMark, label = slRefs.rangeHintLabel;
  if (!hint || !band || !mark || !label) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  const e = store ? store[String(fmCurrentEl)] : null;
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  const agg = _fmAggregateCent(rounds);
  if (agg == null) { hint.style.display = "none"; return; }

  const slider = slRefs.slider;
  if (!slider) { hint.style.display = "none"; return; }
  const minV = parseFloat(slider.min), maxV = parseFloat(slider.max);
  if (!isFinite(minV) || !isFinite(maxV) || maxV <= minV) { hint.style.display = "none"; return; }
  const span = maxV - minV;

  if (agg < minV || agg > maxV) { hint.style.display = "none"; return; }
  hint.style.display = "";
  const markPct = ((agg - minV) / span) * 100;
  mark.style.left  = markPct + "%";
  label.style.left = markPct + "%";
  label.textContent = (agg >= 0 ? "+" : "") + (Math.round(agg * 10) / 10) + " ct";

  const range = _fmRangeCent(rounds);
  if (!range || range.min === range.max) {
    band.style.display = "none";
    return;
  }
  band.style.display = "";
  const bandLeft  = Math.max(minV, range.min);
  const bandRight = Math.min(maxV, range.max);
  band.style.left  = (((bandLeft  - minV) / span) * 100) + "%";
  band.style.width = (((bandRight - bandLeft) / span) * 100) + "%";
}
```

**Nachher** (komplette Funktion ersetzen):

```js
// BA 206/221: Min/Max-Band + Median-Dreieck unter dem Slider.
// Sichtbar ab dem ersten gespeicherten Wert; Band erst ab 2 unterschiedlichen Werten.
// Daten werden an testUI.slider.setRangeHint uebergeben — dort steckt die DOM-Logik.
function _fmUpdateSliderRangeMarker() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  if (!slRefs || !slRefs.slider) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  const e = store ? store[String(fmCurrentEl)] : null;
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  const agg = _fmAggregateCent(rounds);
  if (agg == null) {
    testUI.slider.setRangeHint(slRefs.slider, null);
    return;
  }
  const range = _fmRangeCent(rounds);
  const labelText = (agg >= 0 ? "+" : "") + (Math.round(agg * 10) / 10) + " ct";
  testUI.slider.setRangeHint(slRefs.slider, {
    marker: agg,
    label:  labelText,
    min:    (range && range.min !== range.max) ? range.min : null,
    max:    (range && range.min !== range.max) ? range.max : null
  });
}
```

---

## Schritt 5 — `freqmatch-adaptive.js`: PairIndicator-Labels via setLabels

**Datei:** `js/freqmatch-adaptive.js`

**Vorher** (Zeilen 274–276 — Auszug aus dem umgebenden Block):

```js
    _api.left.textContent  = (typeof t === 'function' && t('fmTone1')) || 'Ton 1';
    _api.right.textContent = (typeof t === 'function' && t('fmTone2')) || 'Ton 2';
```

**Nachher:**

```js
    testUI.pairIndicator.setLabels(_api, {
      leftText:  (typeof t === 'function' && t('fmTone1')) || 'Ton 1',
      rightText: (typeof t === 'function' && t('fmTone2')) || 'Ton 2'
    });
```

---

## Schritt 6 — `js/version.js` Versionsbump

**Vorher:**

```js
const APP_VERSION = "3.2.220-beta";
```

(oder `3.2.220.x-beta`)

**Nachher:**

```js
const APP_VERSION = "3.2.221-beta";
```

---

## i18n

Keine neuen Strings. en/fr/es bleiben unverändert.

---

## Akzeptanztest (manuell, Klick-für-Klick)

Voraussetzung: BA 221 gebaut, Cache leer.

**Migration ohne Verhaltensänderung**
1. Tab „Messungen" → Sub-Tab „Frequenzabgleich", Verfahren „Slider Round".
   Test starten.
   **Erwartet:** Pair-Indicator zeigt Elektroden-Label + Hz, Slider zeigt
   `+0 Cent (… Hz)`, beim Schieben aktualisieren sich Slider-Wert-Anzeige
   und PairIndicator-Text wie gehabt.
2. Verfahren „Adaptive" wählen, Test starten.
   **Erwartet:** PairIndicator zeigt links „Ton 1", rechts „Ton 2".

**Range-Marker erscheint (Bugfix)**
3. Slider-Verfahren: für mindestens eine Elektrode eine Slider-Runde
   bestätigen (z.B. Wert `+30`, dann Bestätigen). Test beenden.
4. Test erneut starten — beim Wechsel auf diese Elektrode:
   **Erwartet:** Unter dem Slider erscheint ein Dreieck-Marker mit Label
   `+30.0 ct` an der zugehörigen Position.
5. Für dieselbe Elektrode eine zweite Runde bestätigen, z.B. `-20`,
   wieder Test beenden + neu starten.
   **Erwartet:** Marker zeigt `+5.0 ct` (Mittel), darunter ein Band von
   `-20` bis `+30`.
6. Eine Elektrode mit einem Wert weit außerhalb des initialRange testen
   (z.B. `+200` Cent — initialRange ist 100). Test beenden + neu starten.
   **Erwartet:** Marker erscheint **auch hier sichtbar**; der Slider-
   Range expandiert automatisch so weit, dass der Marker reinpasst
   (das ist der Bugfix). Falls der Marker weiterhin fehlt: Bug ist nicht
   behoben — Selbstprüfungs-Auftrag Punkt 1 nochmal prüfen.

**Adaptive ohne Slider-Daten**
7. Verfahren „Adaptive" für eine Elektrode ohne vorherige Slider-Runden
   starten.
   **Erwartet:** Adaptive-Lauf läuft normal; PairIndicator-Aufleuchten
   (`testUI.pairIndicator.setPlaying`) funktioniert.

**Regression**
8. Stereo-Balance und Test: keine Änderungen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Kriterie einzeln durchgehen
(erfüllt / nicht erfüllt / unklar, mit Datei + Zeile):

1. `js/test-ui.js`: `testUI.slider.setValue` akzeptiert dritten
   Parameter `opts` und wertet `opts.minAbs` aus (siehe ersetzte
   Methode in der `testUI.slider`-Familie).
2. `js/freqmatch-slider.js`: `fmUpdateSliderDisplay` enthält **keinen**
   direkten `slRefs.sliderValue.textContent`-Zugriff mehr; statt dessen
   `testUI.slider.setValueDisplay(slRefs.slider, ...)`.
3. `js/freqmatch-slider.js`: `fmShowElectrode` setzt PairIndicator-Texte
   ausschließlich über `testUI.pairIndicator.setLabels(pi, { … })` —
   kein `pi.left.textContent = ...` oder `pi.right.textContent = ...`
   mehr.
4. `js/freqmatch-slider.js`: `fmShowElectrode` ruft
   `testUI.slider.setValue(slRefs.slider, fmCentOffset, { minAbs: _markerAbs })`
   mit `_markerAbs = _fmSliderMarkerMaxAbs(fmCurrentEl)`.
5. `js/freqmatch-slider.js`: Funktion `_fmSliderMarkerMaxAbs(elIdx)`
   existiert und liefert das Maximum aus `|agg|`, `|range.min|`,
   `|range.max|` (0 wenn keine Daten).
6. `js/freqmatch-slider.js`: `_fmUpdateSliderRangeMarker` enthält
   **keinen** direkten `hint.style.*`, `band.style.*`, `mark.style.*`,
   `label.style.*`-Zugriff mehr; nur noch ein `testUI.slider.setRangeHint`-
   Aufruf (oder `setRangeHint(slRef, null)` zum Verstecken).
7. `js/freqmatch-adaptive.js`: Zeile ~275 — `_api.left.textContent =`
   und `_api.right.textContent =` durch ein
   `testUI.pairIndicator.setLabels(_api, { leftText, rightText })`
   ersetzt.
8. `js/version.js` zeigt `"3.2.221-beta"`.
9. `grep -n "\\.textContent\\s*=" js/freqmatch-slider.js` liefert
   **keinen** Treffer mehr auf `pi.left`, `pi.right` oder
   `slRefs.sliderValue` (Status-Grid-Code mit `grid.innerHTML` bleibt
   erlaubt — wird erst später migriert).
10. `grep -n "hint\\.style\\|band\\.style\\|mark\\.style\\|label\\.style" js/freqmatch-slider.js`
    liefert keinen Treffer mehr (alle Range-Marker-DOM-Manipulationen
    leben in `testUI.slider.setRangeHint`).
11. Keine weiteren Dateien als `js/test-ui.js`, `js/freqmatch-slider.js`,
    `js/freqmatch-adaptive.js` und `js/version.js` verändert.

Bei „unklar": nachfragen, **nicht** still annehmen.

---

## Hinweis zum Range-Marker-Bug

Falls der Akzeptanztest Punkt 6 (Marker außerhalb des initialRange) fehl-
schlägt, sind die wahrscheinlichen Ursachen in dieser Reihenfolge zu
prüfen:

1. `_fmSliderMarkerMaxAbs` liefert tatsächlich den erwarteten Wert
   (Konsole: `_fmSliderMarkerMaxAbs(<elIdx>)` direkt aufrufen, während
   der Test läuft).
2. `testUI.slider.setValue(slRef, value, { minAbs })` wird tatsächlich
   mit dem dritten Parameter aufgerufen — temporärer
   `console.log('minAbs', _markerAbs, 'value', fmCentOffset)` in
   `fmShowElectrode` einbauen.
3. `setRangeHint` blendet erneut aus (Konsole: in `setRangeHint` einen
   `console.log('agg', opts.marker, 'minV', slRef.input.min, 'maxV', slRef.input.max)`
   einbauen).

In jedem Fall: vor der Fertig-Meldung den Bugfix-Akzeptanztest tatsächlich
in der Browser-Konsole nachvollziehen, nicht bloß als „sollte funktionieren"
melden.

---

## Folge-BA

- BA 222: freqmatch Vortest-Empfehlung auf `cfg.prerequisites` umstellen,
  `fmSEDlg` und `fmEls.sliderEstimateDlg` entfernen.
