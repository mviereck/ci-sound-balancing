# Bauanleitung 61 — Paar-Vergleich: Schätzungs-Marke statt Vorkorrektur-Checkbox

## Ziel

Im Test 1 (Elektrodenlautstärke ausgleichen) den **Vorkorrektur-
Schalter „Feinjustierung"** ersatzlos entfernen und durch eine
**transparente Anzeige** des LS-Schätzwerts ersetzen:

- **Dreieck-Marke** unter dem Slider an der Position der aktuellen
  LS-Schätzung, mit dB-Angabe darunter.
- **Farbiger Band-Bereich** um die Marke, dessen Breite die
  Unsicherheit der Schätzung visualisiert (Residuum kombiniert mit
  Stichproben-Aufschlag).
- **Slider-Startwert**:
  - Paar bereits gemessen → Slider so platziert, daß der gespeicherte
    Wert exakt mittig steht (also `slider = 0`, `curBase = prevOff` —
    wie bisher *ohne* Häkchen).
  - Paar noch nicht gemessen → Slider auf die LS-Schätzung gestellt
    (also `slider = 0`, `curBase = preCorr`). Bei vollständig leerem
    Datensatz keine Schätzung möglich, dann `curBase = 0`.

Der Mechanismus gilt **gleichermaßen** in Modus „Vollständig" und
„Konvergenz". Im manuellen Modus dito.

Wichtige Klarstellung: Es werden **keine Schieber-Werte** im
Schieber-Tab überschrieben. Es geht ausschließlich um den Slider im
Paar-Vergleich und um die `bRes`-Einträge.

---

## 1. Versionsnummer hochzählen

In `js/version.js` die Konstante:

```js
const APP_VERSION = "2.61-beta";
```

---

## 2. Checkbox aus der UI entfernen

### 2a. `js/test-ui.js` — preCorrect-Render-Block streichen

**Ersetzen** (Zeile 129–144, der ganze `if (rf.preCorrect) {…}`-Block samt
umgebender `rowFine`-Logik soweit sie *nur* preCorrect trägt):

**Vorher:**
```js
// Zeile 2: Feineinstellung (preCorrect + refSelect)
var preCorrectCb = null, refSelect = null;
if (cfg.presets.rowFine && cfg.presets.rowFine.show) {
  var rf = cfg.presets.rowFine;
  var rowFine = _mkEl('div', 'controls-row');
  rowFine.dataset.row = 'fine';
  if (rf.preCorrect) {
    var lbl = _mkEl('label', 'control-group');
    lbl.style.cssText = 'font-size:0.85em;color:var(--text-muted);display:flex;align-items:center;gap:6px;cursor:pointer';
    preCorrectCb = _mkEl('input');
    preCorrectCb.type = 'checkbox';
    preCorrectCb.id = 'preCorrect';
    var span = _mkEl('span'); span.dataset.t = 'preCorrectLabel';
    lbl.append(preCorrectCb, span);
    rowFine.appendChild(lbl);
  }
  if (rf.refSelect) {
    // … refSelect-Block bleibt unverändert
  }
  if (rowFine.children.length) presetsBox.appendChild(rowFine);
}
```

**Nachher:**
```js
// Zeile 2: refSelect (preCorrect entfernt — Bauanleitung 61)
var refSelect = null;
if (cfg.presets.rowFine && cfg.presets.rowFine.show) {
  var rf = cfg.presets.rowFine;
  var rowFine = _mkEl('div', 'controls-row');
  rowFine.dataset.row = 'fine';
  if (rf.refSelect) {
    // … refSelect-Block bleibt unverändert
  }
  if (rowFine.children.length) presetsBox.appendChild(rowFine);
}
```

### 2b. `js/test-ui.js` — Export-Objekt anpassen

Zeile ~557, `return {…}`-Statement: `preCorrectCb: preCorrectCb,`
entfernen.

### 2c. `js/test-ui.js` — neues UI-Element direkt nach `sliderValue`

Direkt nach dem Block, der `sliderValue` an `testBox` anhängt (Zeile
~434), folgendes einfügen:

```js
// LS-Hint: Dreieck-Marke + Bandbereich für die LS-Schätzung
// (Bauanleitung 61). Position relativ zum Slider-Track.
var lsHint = _mkEl('div', 'ls-hint');
lsHint.style.display = 'none';
var lsHintBand = _mkEl('div', 'ls-hint-band');
var lsHintMark = _mkEl('div', 'ls-hint-mark');
var lsHintLabel = _mkEl('div', 'ls-hint-label');
lsHint.append(lsHintBand, lsHintMark, lsHintLabel);
testBox.appendChild(lsHint);
```

Im Export-Objekt unten ergänzen:
```js
lsHint: lsHint, lsHintBand: lsHintBand,
lsHintMark: lsHintMark, lsHintLabel: lsHintLabel,
```

---

## 3. Logik in `js/test.js`

### 3a. Konstanten ganz oben einfügen (direkt unter `TEST_SLIDER_RANGES`)

```js
// LS-Hint Parameter (Bauanleitung 61):
// basis = Anfangs-Unsicherheit ohne Daten (dB),
// k = wie schnell der Prior mit N abklingt.
const LS_HINT_BASIS_DB = 2.5;
const LS_HINT_K = 3;
```

### 3b. `getPreCorrOffset` umbenennen/erweitern

**Komplett ersetzen** (test.js Zeile 644–653) durch zwei Funktionen:

```js
// ============================================================
// LS-HINT: Schätzung und Unsicherheit für Paar (a, b)
// ============================================================
function getLsEstimate(a, b) {
  // Liefert {estimate, halfWidth, hasData}.
  // estimate = LS-Schätzung des Offsets a→b (Skala wie tot/curBase).
  // halfWidth = halbe Breite des Unsicherheits-Bandes in dB.
  // hasData = true nur wenn LS-Lösung für dieses Paar belastbar ist
  // (beide Elektroden in mindestens einer Messung enthalten).
  if (bRes.length === 0) return { estimate: 0, halfWidth: 0, hasData: false };
  const { levels, elRes } = compWLS();
  const wA = gWt(a), wB = gWt(b);
  if (wA <= 0 || wB <= 0) return { estimate: 0, halfWidth: 0, hasData: false };
  // N = Anzahl Messungen der schwächer belegten Elektrode
  const nA = bRes.filter(r => r.a === a || r.b === a).length;
  const nB = bRes.filter(r => r.a === b || r.b === b).length;
  const N = Math.min(nA, nB);
  const resTerm = Math.max(elRes[a] || 0, elRes[b] || 0);
  const prior = LS_HINT_BASIS_DB * LS_HINT_K / (LS_HINT_K + N);
  const halfWidth = Math.sqrt(resTerm * resTerm + prior * prior);
  return { estimate: levels[a] - levels[b], halfWidth, hasData: true };
}
```

Die alte Funktion `getPreCorrOffset` wird **ersatzlos gestrichen**.

### 3c. `showCurPair` — Slider-Setzlogik neu

In `showCurPair` (test.js ~Zeile 866–883) den `if (testMode === "balance")`-
Block **vollständig ersetzen**:

**Vorher:**
```js
if (testMode === "balance") {
  const ex = bRes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const prevOff = ex ? (ex.a === a ? ex.offset : -ex.offset) : 0;
  const preCorr = getPreCorrOffset(a, b);
  const pcCb = testEls.preCorrectCb;
  if (pcCb && pcCb.checked && bRes.length > 0) {
    curBase = preCorr;
    _testRstSlR();
    testEls.slider.value = "0";
    if (testEls.sliderValue) testEls.sliderValue.textContent = "0.0 dB";
  } else {
    curBase = prevOff;
    _testRstSlR();
    testEls.slider.value = "0";
    if (testEls.sliderValue) testEls.sliderValue.textContent = "0.0 dB";
  }
  _testUpdCumulative(0);
}
```

**Nachher:**
```js
if (testMode === "balance") {
  const ex = bRes.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  const lsEst = getLsEstimate(a, b);
  if (ex) {
    // Paar bereits gemessen → bei gespeichertem Wert starten
    curBase = ex.a === a ? ex.offset : -ex.offset;
  } else if (lsEst.hasData) {
    // Paar leer, aber LS-Schätzung möglich → bei Schätzung starten
    curBase = lsEst.estimate;
  } else {
    curBase = 0;
  }
  _testRstSlR();
  testEls.slider.value = "0";
  if (testEls.sliderValue) testEls.sliderValue.textContent = "0.0 dB";
  _testUpdCumulative(0);
  _testUpdLsHint();
}
```

### 3d. Neue Funktion `_testUpdLsHint` (an passender Stelle, z.B.
direkt nach `_testUpdCumulative`):

```js
function _testUpdLsHint() {
  if (!testEls || !testEls.lsHint) return;
  if (testMode !== "balance" || !testAct || testIdx >= testPairs.length) {
    testEls.lsHint.style.display = "none";
    return;
  }
  const lsEst = getLsEstimate(curA, curB);
  if (!lsEst.hasData) {
    testEls.lsHint.style.display = "none";
    return;
  }
  // Slider-Position der Marke: X = estimate - curBase
  const xLs = lsEst.estimate - curBase;
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  // Marken-Position in %: (X + r) / (2r) * 100
  const markPct = ((xLs + r) / (2 * r)) * 100;
  if (markPct < 0 || markPct > 100) {
    // Marke außerhalb sichtbaren Bereichs → Hint ausblenden
    testEls.lsHint.style.display = "none";
    return;
  }
  testEls.lsHint.style.display = "";
  testEls.lsHintMark.style.left = markPct + "%";
  testEls.lsHintLabel.style.left = markPct + "%";
  testEls.lsHintLabel.textContent =
    (xLs >= 0 ? "+" : "") + xLs.toFixed(1) + " dB";
  // Bandbereich
  const hw = lsEst.halfWidth;
  const bandLeft = Math.max(-r, xLs - hw);
  const bandRight = Math.min(r, xLs + hw);
  const bandLeftPct = ((bandLeft + r) / (2 * r)) * 100;
  const bandWidthPct = ((bandRight - bandLeft) / (2 * r)) * 100;
  testEls.lsHintBand.style.left = bandLeftPct + "%";
  testEls.lsHintBand.style.width = bandWidthPct + "%";
}
```

### 3e. Aufruf bei Slider-Extend ergänzen

In `_testExtSlider` am Ende, vor dem `}`-Schluss:
```js
_testUpdLsHint();
```

---

## 4. CSS für die neue Anzeige

Eigenen Stil-Block in `style.css` ans Ende einfügen:

```css
/* LS-Hint Marke + Bandbereich unter dem Test-Slider (Bauanleitung 61) */
.ls-hint {
  position: relative;
  width: 100%;
  height: 28px;
  margin-top: 4px;
  pointer-events: none;
}
.ls-hint-band {
  position: absolute;
  top: 0;
  height: 8px;
  background: linear-gradient(
    to right,
    rgba(70,130,180,0) 0%,
    rgba(70,130,180,0.45) 30%,
    rgba(70,130,180,0.45) 70%,
    rgba(70,130,180,0) 100%
  );
  border-radius: 4px;
}
.ls-hint-mark {
  position: absolute;
  top: 0;
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 8px solid #4682b4;
  transform: translateX(-50%);
}
.ls-hint-label {
  position: absolute;
  top: 10px;
  font-size: 0.8em;
  color: #4682b4;
  font-family: var(--mono);
  transform: translateX(-50%);
  white-space: nowrap;
}
```

Hinweis: Der `.slider-wrap` und der eingefügte `.ls-hint` müssen
**dieselbe Breite** wie der Slider haben, damit die Prozent-Positionen
visuell mit dem Slider-Track übereinstimmen. Falls `slider-wrap`
Padding/Margin hat, dem `.ls-hint` denselben Padding-Raum geben
(`padding-left` / `padding-right` analog). Bei der Selbstprüfung
visuell verifizieren, daß Slider-0 und Marke bei `xLs = 0` auf
derselben Vertikalen liegen.

---

## 5. i18n-Strings entfernen (nur Deutsch)

In `i18n/de.js`:

- **Entfernen**: `preCorrectLabel: "Feinjustierung mit vorkorrigierten Werten",`
- **Entfernen**: `printPreCorrect: "Feinjustierung mit Vorkorrektur: aktiv",`
- **Anpassen**: in `testExplain` und `testExplainRecommend` die Sätze
  zur „Feinjustierung" streichen, ersetzen durch knappen Hinweis:
  „Eine Marke unter dem Slider zeigt den aus allen bisherigen Messungen
  errechneten Wert; der farbige Bereich zeigt die Unsicherheit dieser
  Schätzung."

Die englischen, französischen und spanischen Strings bleiben in dieser
Bauanleitung **unangetastet** — fehlende Keys fallen auf die deutschen
Defaults zurück.

**Falls** `printPreCorrect` an anderer Stelle (z.B. tab-print.js)
verwendet wird: dort die Print-Zeile zusammen mit dem Key entfernen.
Grep vor dem Streichen:
```
grep -rn "printPreCorrect" js/
```

---

## 6. Konfiguration in den drei Test-Buildern

In `js/test.js` ~Zeile 1149 und in `js/lr-balance.js` / `js/freqmatch.js`
prüfen, ob in der `cfg.presets.rowFine`-Konfiguration `preCorrect: true`
gesetzt ist. Den Schlüssel entfernen:

```
grep -rn "preCorrect:" js/
```

In `js/test.js`:1149 — `preCorrect: true,` → Zeile löschen.
In `js/freqmatch.js`:497 — `preCorrect: false` ist bereits false, kann
aber sauberhalber auch raus.

---

## 7. Spec-Update — `docs/spec/02-messung.md`

Die Zeile **„Vorkorrektur-Schalter (preCorrect)"** (im Sub-Tab 1-Block,
Zeile 92) **entfernen** und stattdessen einsetzen:

```markdown
- **LS-Hint-Anzeige**: Unter dem Slider erscheint ein Dreieck mit
  dB-Wert an der Position der LS-Schätzung des aktuellen Paares,
  umgeben von einem semitransparenten Farbbereich, dessen halbe Breite
  sich aus dem mittleren Residuum (`elRes` aus `compWLS`) und einem
  Stichproben-Aufschlag (`basis · k/(k+N)`, basis = 2.5 dB, k = 3,
  N = min. Mess-Anzahl der beiden Elektroden) als
  `√(elRes² + prior²)` ergibt. Sichtbar nur, wenn beide Elektroden in
  mindestens einer Messung vorkommen und die Marke innerhalb des
  aktuellen Slider-Bereichs liegt.
- **Slider-Startwert**: Bei bereits gemessenem Paar startet der
  Slider so, daß der gespeicherte Wert exakt mittig sitzt
  (`curBase = gespeicherter Offset`, `slider = 0`). Bei noch nicht
  gemessenem Paar startet der Slider auf der LS-Schätzung
  (`curBase = Schätzung`, `slider = 0`). Bei leerem Datensatz
  `curBase = 0`.
```

---

## 8. Akzeptanztest (durchklicken)

1. **Frischer Datensatz, Test 1 starten, Modus „Vollständig"**:
   Erstes Paar erscheint. Erwartet: kein LS-Hint sichtbar (Datensatz
   leer). Slider liegt auf 0.
2. **Erstes Paar bestätigen mit Slider 0**. Zweites Paar erscheint.
   Erwartet: kein LS-Hint (nur eine Elektrode hat Daten). Slider auf 0.
3. **Mehrere Paare durchlaufen, bis 6–8 Paare bestätigt**. Erwartet:
   LS-Hint erscheint bei Paaren, deren beide Elektroden Daten haben.
   Dreieck und dB-Label gut lesbar.
4. **Test stoppen, neu starten, Modus „Konvergenz"**. Erwartet: LS-Hint
   sichtbar von Anfang an, Slider startet bei vorhandenen Paaren auf
   dem gespeicherten Wert (Slider liegt auf 0, Marke kann links/rechts
   davon sitzen).
5. **Im laufenden Test einen Slider mit Pfeil ↑/↓ verstellen**.
   Erwartet: Marke und Bandbereich bewegen sich **nicht** (sie hängen
   an der LS-Schätzung, nicht am Slider). Slider-Wert-Label oben
   ändert sich.
6. **Extend-Button klicken (Slider ±40 dB)**. Erwartet: Marke bleibt
   an derselben dB-Position, Pixel-Position wird neu berechnet (sieht
   visuell verschoben aus, weil Skala anders).
7. **Vorkorrektur-Checkbox**: nicht mehr vorhanden. Im Voreinstellungs-
   Block keine Spur davon.
8. **Test 2 (Stereo-Balance) und Test 3 (Frequenzabgleich)**:
   unverändert, kein LS-Hint, keine Checkbox.

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt aus Abschnitt 8 einzeln durchgehen
und mit **erfüllt / nicht erfüllt / unklar** beantworten, mit Datei-
und Zeilenangabe der relevanten Code-Stelle. Zusätzlich verifizieren:

- `grep -rn "preCorrect" js/` liefert keine Treffer mehr.
- `grep -rn "preCorrectCb" js/` liefert keine Treffer mehr.
- `grep -n "APP_VERSION" js/version.js` zeigt `"2.61-beta"`.
- Die LS-Hint-Berechnung in `getLsEstimate` ist symmetrisch:
  `getLsEstimate(a,b).estimate === -getLsEstimate(b,a).estimate`.

---

## 10. Folgeanleitung

Wenn die deutsche Version steht und visuell paßt: eine Mini-
Anleitung „Übersetzungen für LS-Hint" für die Anpassungen in
`i18n/en.js`, `fr.js`, `es.js` (Entfernen von `preCorrectLabel`,
`printPreCorrect`, und Anpassen der Sätze in `testExplain` /
`testExplainRecommend` analog zum Deutschen). Diese Folgeanleitung
ist optional — die App funktioniert ohne, weil fehlende Keys auf das
Deutsche zurückfallen.
