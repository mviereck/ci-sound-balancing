# BAUANLEITUNG 219 — TestUI-API: neue Helfer und prerequisites-Mechanik

## Ziel

Vier Erweiterungen der TestUI-API in `js/test-ui.js`, damit Verfahren-Module
(freqmatch, später lr-balance und test) auf einheitliche Helfer-Aufrufe
umgestellt werden können — **statt** direkt DOM-Knoten zu manipulieren.

1. `testUI.slider.setValueDisplay(slRef, text)` — schreibt den Anzeigetext
   für den Slider-Wert (z.B. „+50 Cent (1234 Hz)").
2. `testUI.slider.setRangeHint(slRef, opts)` — Min/Max-Band + Marker-Dreieck
   unter dem Slider (heute nur ad-hoc für freqmatch genutzt).
3. `testUI.explain.setVisible(panelEls, id, visible)` — schaltet einen
   Erklär-Absatz im Erklärblock per `id` sichtbar/unsichtbar.
4. `cfg.verfahren[].prerequisites` — Liste von Voraussetzungen, die VOR
   `onStart` geprüft werden. Bei Verletzung baut TestUI automatisch einen
   Modal-Dialog mit den vom Verfahren definierten Aktionen.

**Diese Bauanleitung berührt nur `js/test-ui.js`.** Verwender (freqmatch
etc.) werden in BA 220–222 umgestellt. Nach BA 219 gibt es keinen
sichtbaren Verhaltensunterschied; nur die API steht bereit.

## Vorbedingung

- Aktuelle Version `3.2.218.5-beta`.
- Bestehende Helfer im `testUI`-Namespace bleiben unverändert
  (siehe `js/test-ui.js:1772`).

---

## Schritt 1 — `refs.slider.valueDisplay` zusätzlich befüllen

**Datei:** `js/test-ui.js`

**Hintergrund:** Heute landet das DOM-Element des Slider-Werts in
`refs.sliderValue` (Verfahren-Refs-Ebene). Damit der neue Helfer
`testUI.slider.setValueDisplay(slRef, …)` über die Slider-Refs erreichbar
ist, **zusätzlich** auch nach `refs.slider.valueDisplay` verlinken.
`refs.sliderValue` bleibt für Rückwärtskompatibilität bestehen.

**Vorher** (`js/test-ui.js`, Zeilen ca. 1299–1315):

```js
    // --- sliderValue ---
    if (body.sliderValue && (body.sliderValue === true || body.sliderValue.show !== false)) {
      var svEl = _mkEl('div', 'slider-value-large');
      var svUnit = (body.slider && body.slider.unit) || 'dB';
      svEl.textContent = (svUnit === 'cent') ? '0 Cent' : (svUnit === 'ms') ? '0 ms' : '0.0 dB';
      vWrap.appendChild(svEl);
      refs.sliderValue = svEl;
      // Auto-Update nur wenn kein onSlide-Hook vorhanden (der Hook setzt detailliertere Anzeige)
      if (refs.slider && !(vCfg.hooks && vCfg.hooks.onSlide)) {
        refs.slider.input.addEventListener('input', function() {
          var v = parseFloat(refs.slider.input.value);
          if (svUnit === 'cent') svEl.textContent = v.toFixed(0) + ' Cent';
          else if (svUnit === 'ms') svEl.textContent = v.toFixed(1) + ' ms';
          else svEl.textContent = v.toFixed(1) + ' dB';
        });
      }
    }
```

**Nachher:**

```js
    // --- sliderValue ---
    if (body.sliderValue && (body.sliderValue === true || body.sliderValue.show !== false)) {
      var svEl = _mkEl('div', 'slider-value-large');
      var svUnit = (body.slider && body.slider.unit) || 'dB';
      svEl.textContent = (svUnit === 'cent') ? '0 Cent' : (svUnit === 'ms') ? '0 ms' : '0.0 dB';
      vWrap.appendChild(svEl);
      refs.sliderValue = svEl;
      // BA 219: Verlinkung in refs.slider, damit testUI.slider.setValueDisplay(slRef, ...)
      // ueber die Slider-Refs greifen kann.
      if (refs.slider) refs.slider.valueDisplay = svEl;
      // Auto-Update nur wenn kein onSlide-Hook vorhanden (der Hook setzt detailliertere Anzeige)
      if (refs.slider && !(vCfg.hooks && vCfg.hooks.onSlide)) {
        refs.slider.input.addEventListener('input', function() {
          var v = parseFloat(refs.slider.input.value);
          if (svUnit === 'cent') svEl.textContent = v.toFixed(0) + ' Cent';
          else if (svUnit === 'ms') svEl.textContent = v.toFixed(1) + ' ms';
          else svEl.textContent = v.toFixed(1) + ' dB';
        });
      }
    }
```

---

## Schritt 2 — Helfer `testUI.slider.setValueDisplay` und
## `testUI.slider.setRangeHint` ergänzen

**Datei:** `js/test-ui.js`

**Hintergrund:** Die bestehende `testUI.slider`-Familie hat heute nur
`setValue` (Zeile 1924). Wir fügen zwei Methoden hinzu.

**Vorher** (`js/test-ui.js`, Zeilen 1916–1939):

```js
  // ---- slider ----
  slider: {
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
    }
  },
```

**Nachher** (komplette `slider`-Familie durch diesen Block ersetzen):

```js
  // ---- slider ----
  slider: {
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

    /**
     * BA 219: Anzeigetext fuer den Slider-Wert setzen.
     * Inhalt wird vom Verfahren bestimmt (z.B. "+50 Cent (1234.56 Hz)",
     * "-3.2 dB", "200 ms"). No-op wenn sliderValue nicht im Body konfiguriert.
     *
     * slRef: refs.slider
     * text:  beliebiger String
     */
    setValueDisplay: function(slRef, text) {
      if (!slRef || !slRef.valueDisplay) return;
      slRef.valueDisplay.textContent = text;
    },

    /**
     * BA 219: Range-Hint unter dem Slider (Min/Max-Band + Marker-Dreieck).
     * Generischer Ersatz fuer die alte _fmUpdateSliderRangeMarker-Logik
     * (freqmatch) und perspektivisch fuer ls-hint (lr-balance, alte API).
     * No-op wenn rangeHint nicht konfiguriert.
     *
     * slRef: refs.slider
     * opts:  null oder {} blendet aus.
     *        Sonst:
     *          marker: Zahl im Slider-Bereich (Position des Dreiecks). Pflicht.
     *          label:  String fuer das Dreieck-Label. Optional, default leer.
     *          min:    Zahl, Untergrenze des Bandes. Optional.
     *          max:    Zahl, Obergrenze des Bandes. Optional.
     *                  Band wird nur gezeigt, wenn min und max gesetzt und min < max.
     */
    setRangeHint: function(slRef, opts) {
      if (!slRef || !slRef.rangeHint) return;
      var hint = slRef.rangeHint;
      var band = slRef.rangeHintBand;
      var mark = slRef.rangeHintMark;
      var label = slRef.rangeHintLabel;
      // Aus / leer => verstecken.
      if (!opts || opts.marker == null || !isFinite(opts.marker)) {
        hint.style.display = 'none';
        return;
      }
      var input = slRef.input;
      if (!input) { hint.style.display = 'none'; return; }
      var minV = parseFloat(input.min), maxV = parseFloat(input.max);
      if (!isFinite(minV) || !isFinite(maxV) || maxV <= minV) {
        hint.style.display = 'none'; return;
      }
      var marker = opts.marker;
      if (marker < minV || marker > maxV) {
        hint.style.display = 'none'; return;
      }
      hint.style.display = '';
      var span = maxV - minV;
      var markPct = ((marker - minV) / span) * 100;
      if (mark)  mark.style.left  = markPct + '%';
      if (label) {
        label.style.left = markPct + '%';
        label.textContent = opts.label || '';
      }
      // Band nur wenn min/max sinnvoll.
      if (band) {
        if (opts.min == null || opts.max == null
            || !isFinite(opts.min) || !isFinite(opts.max)
            || opts.min === opts.max) {
          band.style.display = 'none';
        } else {
          band.style.display = '';
          var bandLeft  = Math.max(minV, Math.min(opts.min, opts.max));
          var bandRight = Math.min(maxV, Math.max(opts.min, opts.max));
          band.style.left  = (((bandLeft  - minV) / span) * 100) + '%';
          band.style.width = (((bandRight - bandLeft) / span) * 100) + '%';
        }
      }
    }
  },
```

---

## Schritt 3 — Neuer Namespace `testUI.explain`

**Datei:** `js/test-ui.js`

**Hintergrund:** Erklär-Absätze (mit `id`-Feld in `cfg.explain.paragraphs`)
sollen extern sichtbar/unsichtbar geschaltet werden können — ohne dass
das Verfahren-Modul `document.getElementById(...)` selbst aufruft.

**Position:** Innerhalb des `testUI = { … }`-Objekts (Zeile 1772), als
neuer Eintrag **direkt nach `verfahren`** (also vor der schließenden
`};` in Zeile 1960).

**Vorher** (Zeilen 1940–1960):

```js
  // ---- verfahren ----
  verfahren: {
    /**
     * Programmatisch das aktive Verfahren wechseln.
     * els:    Ergebnis von buildTestPanel
     * vId:    Ziel-Verfahren-Id (z.B. 'slider' | 'adaptive')
     * Setzt den Wert des verfahrenSelect und feuert das change-Event,
     * damit der einheitliche Wechsel-Handler (Panels, Explain,
     * runningTitle, _activeVerfahren) ausgefuehrt wird.
     */
    select: function(els, vId) {
      var sel = els && els.header && els.header.verfahrenSelect;
      if (!sel) return;
      if (sel.value === vId) return;
      sel.value = vId;
      sel.dispatchEvent(new Event('change'));
    }
  }

};
```

**Nachher** (Komma hinter `verfahren`-Block, dann `explain`-Block ergänzen):

```js
  // ---- verfahren ----
  verfahren: {
    /**
     * Programmatisch das aktive Verfahren wechseln.
     * els:    Ergebnis von buildTestPanel
     * vId:    Ziel-Verfahren-Id (z.B. 'slider' | 'adaptive')
     * Setzt den Wert des verfahrenSelect und feuert das change-Event,
     * damit der einheitliche Wechsel-Handler (Panels, Explain,
     * runningTitle, _activeVerfahren) ausgefuehrt wird.
     */
    select: function(els, vId) {
      var sel = els && els.header && els.header.verfahrenSelect;
      if (!sel) return;
      if (sel.value === vId) return;
      sel.value = vId;
      sel.dispatchEvent(new Event('change'));
    }
  },

  // ---- explain (BA 219) ----
  explain: {
    /**
     * Sichtbarkeit eines Erklaer-Absatzes umschalten.
     * Sucht den Absatz mit der gegebenen id im Erklaerblock und setzt
     * sein hidden-Attribut.
     *
     * panelEls: Rueckgabewert von buildTestPanel (panelEls.explainBox).
     * id:       String, entspricht der id, die in
     *           cfg.explain.paragraphs[].id vergeben wurde.
     * visible:  bool. true => sichtbar, false => versteckt.
     *
     * No-op, wenn der Absatz nicht existiert.
     */
    setVisible: function(panelEls, id, visible) {
      if (!panelEls || !panelEls.explainBox || !id) return;
      var el = panelEls.explainBox.querySelector('#' + CSS.escape(id));
      if (!el) return;
      el.hidden = !visible;
    }
  }

};
```

---

## Schritt 4 — `cfg.verfahren[].prerequisites` mit Auto-Dialog

**Datei:** `js/test-ui.js`

**Hintergrund:** Heute prüft jedes Verfahren-Modul Voraussetzungen selbst
(z.B. freqmatch-adaptive baut den Slider-Empfehlungs-Dialog hart in den
Start-Hook). Wir heben den Mechanismus in TestUI: Pro Verfahren kann eine
Liste von Voraussetzungen angegeben werden; verletzt eine, baut TestUI
automatisch einen Modal-Dialog mit den im cfg deklarierten Aktionen.

**Konfigurationsformat** (rein dokumentarisch, nicht im Snippet ergänzen):

```js
// In cfg.verfahren[i]:
prerequisites: [
  {
    // Pflicht: Pruef-Funktion. true = erfuellt, false = verletzt.
    checkFn:    function() { return _fmHasAnySliderEstimates(); },

    // Pflicht: i18n-Key fuer den Dialog-Text.
    messageKey: 'fmSliderEstimateMsg',

    // Optional: i18n-Key fuer die Dialog-Ueberschrift.
    titleKey:   'fmSliderEstimateTitle',

    // Pflicht: mind. eine Aktion. Erste verletzte Voraussetzung
    // bestimmt den Dialog; weitere werden in dieser Runde ignoriert.
    actions: [
      // kind 'custom' : run() wird aufgerufen, Dialog schliesst.
      //                 Verfahren entscheidet selbst, was passiert
      //                 (z.B. Verfahren wechseln, eigenen Start triggern).
      { labelKey: 'fmSliderEstimateBtnSlider', kind: 'custom',
        run: function() { ... } },

      // kind 'continue' : Dialog schliesst, onStart wird normal
      //                   aufgerufen (Voraussetzungs-Pruefung wird
      //                   uebersprungen).
      { labelKey: 'fmSliderEstimateBtnSkip',   kind: 'continue' },

      // kind 'abort' : Dialog schliesst, Test startet NICHT.
      { labelKey: 'fmSliderEstimateBtnCancel', kind: 'abort' }
    ]
  }
]
```

### Schritt 4a — Modal-DOM zusätzlich zum Ausschluss-Modal bauen

**Position:** Innerhalb `_buildTestPanelNew`, direkt nach dem bestehenden
Ausschluss-Modal-Block (`js/test-ui.js` Zeilen 1469–1485). **Vor** dem
Zusammenbau in Zeile 1487 (`// ===== Alles zusammenbauen =====`).

**Snippet einfügen** (kompletter neuer Block):

```js
  // ===== Prerequisites-Modal (BA 219) =====
  var prereqOverlay = _mkEl('div', 'modal-overlay prereq-overlay');
  prereqOverlay.hidden = true;
  var prereqCard = _mkEl('div', 'card');
  var prereqTitle = _mkEl('h3');
  var prereqBody  = _mkEl('p');
  prereqBody.style.whiteSpace = 'pre-line';
  var prereqBtnGroup = _mkEl('div', 'btn-group');
  prereqCard.append(prereqTitle, prereqBody, prereqBtnGroup);
  prereqOverlay.appendChild(prereqCard);

  // Hilfsfunktion: Dialog mit gegebenem prereq-Eintrag oeffnen.
  // onContinue() wird aufgerufen, wenn der User 'continue' waehlt
  // (oder 'custom' nach run() implizit weiterlaufen will - dazu muss
  // run() selbst entscheiden).
  function _openPrereqDialog(prereq, onContinue) {
    // Titel
    prereqTitle.textContent = '';
    if (prereq.titleKey) {
      _tEl(prereqTitle, prereq.titleKey);
    }
    // Body
    prereqBody.textContent = '';
    if (prereq.messageKey) {
      _tEl(prereqBody, prereq.messageKey);
    }
    // Buttons (jedes Mal neu, da Aktionen pro prereq variieren)
    prereqBtnGroup.innerHTML = '';
    (prereq.actions || []).forEach(function(act) {
      var btn = _mkEl('button', 'btn');
      if (act.kind === 'abort')    btn.classList.add('btn-secondary');
      if (act.kind === 'continue') btn.classList.add('btn-primary');
      if (act.kind === 'custom')   btn.classList.add('btn-primary');
      if (act.labelKey) _tEl(btn, act.labelKey);
      btn.addEventListener('click', function() {
        prereqOverlay.hidden = true;
        if (act.kind === 'custom' && typeof act.run === 'function') {
          act.run();
        } else if (act.kind === 'continue') {
          onContinue();
        }
        // abort: nichts.
      });
      prereqBtnGroup.appendChild(btn);
    });
    _applyLangSubtree(prereqOverlay);
    prereqOverlay.hidden = false;
  }
```

### Schritt 4b — Prereq-Overlay in den DOM hängen

**Vorher** (`js/test-ui.js`, Zeilen 1487–1493):

```js
  // ===== Alles zusammenbauen =====
  parentEl.append(explainBox, headerBox, testBox);
  cfg.verfahren.forEach(function(v) {
    var vr = _verfahrenRefs[v.id];
    if (vr && vr.background && vr.background.box) parentEl.appendChild(vr.background.box);
  });
  parentEl.appendChild(exclOverlay);
```

**Nachher:**

```js
  // ===== Alles zusammenbauen =====
  parentEl.append(explainBox, headerBox, testBox);
  cfg.verfahren.forEach(function(v) {
    var vr = _verfahrenRefs[v.id];
    if (vr && vr.background && vr.background.box) parentEl.appendChild(vr.background.box);
  });
  parentEl.appendChild(exclOverlay);
  parentEl.appendChild(prereqOverlay); // BA 219
```

### Schritt 4c — Start-Button-Handler vor `onStart` durch Prereqs ziehen

**Vorher** (`js/test-ui.js`, Zeilen 1554–1583):

```js
  // Start-Button
  startBtn.addEventListener('click', function() {
    if (_testRunning) return;
    var vCfg2 = _getActiveVerfahrenCfg();
    if (!vCfg2) return;

    _testRunning = true;
    document.body.classList.add('test-running'); // BA 183
    // Tab-Sperre
    lockTestTabs(true, id);
    // Verfahren-Dropdown sperren
    if (verfahrenSelect) verfahrenSelect.disabled = true;
    if (refSelect) refSelect.disabled = true;
    // Start-/Stop-Button-Zustand
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // Locked-Hint zeigen
    lockedHint.hidden = false;
    // testBox zeigen
    testBox.hidden = false;
    // Pfeiltasten-Listener installieren
    _installKeyListener(vCfg2);
    // runningTitle einblenden
    var _activeVRefs = _verfahrenRefs[_activeVerfahren];
    if (_activeVRefs && _activeVRefs.runningTitle) _activeVRefs.runningTitle.hidden = false;
    // Hook aufrufen
    if (vCfg2.hooks && vCfg2.hooks.onStart) {
      vCfg2.hooks.onStart();
    }
  });
```

**Nachher** (gesamter Block ersetzen):

```js
  // BA 219: Eigentliche Start-Sequenz aus dem Handler herausgezogen,
  // damit prerequisites davorgeschaltet werden koennen.
  function _doStartAfterPrereqs(vCfg2) {
    _testRunning = true;
    document.body.classList.add('test-running'); // BA 183
    // Tab-Sperre
    lockTestTabs(true, id);
    // Verfahren-Dropdown sperren
    if (verfahrenSelect) verfahrenSelect.disabled = true;
    if (refSelect) refSelect.disabled = true;
    // Start-/Stop-Button-Zustand
    startBtn.disabled = true;
    stopBtn.disabled = false;
    // Locked-Hint zeigen
    lockedHint.hidden = false;
    // testBox zeigen
    testBox.hidden = false;
    // Pfeiltasten-Listener installieren
    _installKeyListener(vCfg2);
    // runningTitle einblenden
    var _activeVRefs = _verfahrenRefs[_activeVerfahren];
    if (_activeVRefs && _activeVRefs.runningTitle) _activeVRefs.runningTitle.hidden = false;
    // Hook aufrufen
    if (vCfg2.hooks && vCfg2.hooks.onStart) {
      vCfg2.hooks.onStart();
    }
  }

  // Start-Button
  startBtn.addEventListener('click', function() {
    if (_testRunning) return;
    var vCfg2 = _getActiveVerfahrenCfg();
    if (!vCfg2) return;

    // BA 219: prerequisites vor onStart durchlaufen.
    // Erste verletzte Voraussetzung oeffnet den Dialog; alle weiteren
    // in dieser Runde werden ignoriert. Bei 'continue' laeuft die
    // Start-Sequenz; bei 'abort' oder 'custom' bleibt _testRunning false.
    var prereqs = vCfg2.prerequisites || [];
    for (var pi = 0; pi < prereqs.length; pi++) {
      var pr = prereqs[pi];
      var ok = true;
      try { ok = pr.checkFn ? !!pr.checkFn() : true; }
      catch (e) { ok = true; }
      if (!ok) {
        _openPrereqDialog(pr, function() {
          _doStartAfterPrereqs(vCfg2);
        });
        return;
      }
    }
    _doStartAfterPrereqs(vCfg2);
  });
```

---

## Schritt 5 — `js/version.js` Versionsbump

**Datei:** `js/version.js`

**Vorher:**

```js
const APP_VERSION = "3.2.218.5-beta";
```

**Nachher:**

```js
const APP_VERSION = "3.2.219-beta";
```

---

## i18n

Diese BA bringt **keine** neuen Strings mit — alle Dialog-Texte
(Titel, Body, Button-Labels) werden vom Verfahren über `messageKey`
/ `titleKey` / `actions[].labelKey` geliefert. en/fr/es bleiben
unverändert.

---

## Akzeptanztest (manuell, Klick-für-Klick)

Voraussetzung: BA 219 gebaut, `version.js` zeigt `3.2.219-beta`,
Browser-Cache leer (Shift+F5).

1. Tool öffnen, Tab „Messungen" → Sub-Tab „Frequenzabgleich" wählen.
   **Erwartet:** Erklärblock, Voreinstellungen, Start-/Stop-Buttons
   wie gehabt — keine sichtbare Änderung gegenüber 3.2.218.5.
2. Tab „Messungen" → Sub-Tab „Stereo-Balance" wählen, „Test starten"
   klicken, ggf. Seitenhörtest-Dialog bestätigen.
   **Erwartet:** Test startet normal. Slider, Wert-Anzeige, Actions
   funktionieren wie gehabt.
3. Test mit „Stop" beenden, dann das gleiche im Sub-Tab „Test" wiederholen.
   **Erwartet:** Test startet normal.
4. Browser-Konsole öffnen, `typeof testUI.slider.setValueDisplay` eingeben.
   **Erwartet:** `"function"`.
5. `typeof testUI.slider.setRangeHint` → **Erwartet:** `"function"`.
6. `typeof testUI.explain.setVisible` → **Erwartet:** `"function"`.
7. Auf der Frequenzabgleich-Seite mit dem ersten Eintrag aus
   `cfg.explain.paragraphs` (id `fmHintMethodPara`):
   `testUI.explain.setVisible({ explainBox: document.querySelector('#tab-freqmatch .explain-box') }, 'fmHintMethodPara', false)`
   **Erwartet:** Der Absatz verschwindet. Mit `true` wieder einblenden.

Es darf zu **keiner** Regression in Frequenzabgleich, Stereo-Balance
und Test kommen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der folgenden Kriterien einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar, jeweils mit Datei und
Zeilenangabe.

1. In `js/test-ui.js` ist im sliderValue-Block (~Z. 1300–1315) die Zeile
   `if (refs.slider) refs.slider.valueDisplay = svEl;` ergänzt.
2. In `js/test-ui.js` enthält die `testUI.slider`-Familie die Methoden
   `setValue`, `setValueDisplay`, `setRangeHint` (in dieser Reihenfolge).
3. In `js/test-ui.js` ist nach `testUI.verfahren` der neue Namespace
   `testUI.explain` mit Methode `setVisible(panelEls, id, visible)`.
4. Direkt nach dem Ausschluss-Modal-Block (~Z. 1486) folgt der neue
   Prereq-Modal-Block mit `_openPrereqDialog(prereq, onContinue)`.
5. Im Zusammenbau-Block (~Z. 1493) wird `prereqOverlay` ans `parentEl`
   angehängt.
6. Der Start-Button-Handler ist in zwei Teile zerlegt:
   `_doStartAfterPrereqs(vCfg2)` (die alte Sequenz) und der eigentliche
   Click-Handler, der zuerst `vCfg2.prerequisites` iteriert.
7. `js/version.js` zeigt `"3.2.219-beta"`.
8. Keine Datei außer `js/test-ui.js` und `js/version.js` wurde
   verändert.

Falls eine Kriterie als „unklar" markiert wird: nachfragen, **nicht**
still annehmen.

---

## Folge-BAs

- BA 220: freqmatch Erklärblock — beide Gruppen statisch mit
  Überschriften, HG- und Cochlear-FAT-Warnung als reguläre
  `kind:'warn'`-Absätze mit Visibility-Toggle.
- BA 221: freqmatch Slider-Display + Range-Marker auf
  `testUI.slider.setValueDisplay` / `setRangeHint` umstellen,
  Range-Marker-Bug reparieren.
- BA 222: freqmatch Vortest-Empfehlung (Slider-Estimate-Dialog) auf
  `cfg.verfahren[].prerequisites` umstellen, `fmSEDlg` entfernen.
