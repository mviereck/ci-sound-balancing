# Bauanleitung 34: Kurven-Tab Touch-Buttons + Schieber-Leiste sichtbar machen

Zwei kleine Nachträge zu den Anleitungen 31–33:

1. **Bugfix**: Die in Anleitung 33 Schritt 3f gebaute Touch-Leiste im
   Schieber-Tab ist auf dem Bildschirm nicht sichtbar — sie landet
   innerhalb eines `overflow:hidden`-Containers und wird abgeschnitten.
2. **Neue Touch-Leisten im Kurven-Tab** für die Preset-Stärke-Inputs
   (`prStr`). Sind durch Anleitung 32 auf Mobile readonly und ohne
   Buttons nicht mehr bedienbar.

Beide Punkte sind klein und unabhängig, aber thematisch verwandt und
deshalb in einer Anleitung.

## Teil 1 — Schieber-Tab: Leiste sichtbar machen

### Ursache

In `levels-tab.js` Z. 645–647 (Anleitung 33/3f) steht:

```javascript
var cv = document.getElementById('lvTabCv');
if (!cv) return;
var host = cv.parentNode;
```

`cv.parentNode` ist laut `index.html` Z. 820 der `<div
style="position:relative;width:100%;height:620px;...;overflow:hidden">`-
Container um das Canvas. Die Leiste wird per `host.appendChild` in
diesen Container gehängt — und vom `overflow:hidden` + fester Höhe
abgeschnitten.

### Fix

In `levels-tab.js`, im Touch-Bedienleisten-IIFE (Z. 644 ff.), die Zeile

**Vorher**:
```javascript
    var host = cv.parentNode;
    if (!host) return;
```

**Nachher**:
```javascript
    var canvasWrap = cv.parentNode;
    var host = canvasWrap ? canvasWrap.parentNode : null; // die <div class="card">
    if (!host || !canvasWrap) return;
```

Und am Ende des IIFE die Zeile

**Vorher**:
```javascript
    host.appendChild(ctrlRow);
```

**Nachher**:
```javascript
    // Direkt unter dem Canvas-Wrapper einfügen, vor dem lvTabKeyHint-<p>.
    host.insertBefore(ctrlRow, canvasWrap.nextSibling);
```

Wirkung: Die Leiste landet in der Schieber-Card, direkt unter dem
Canvas-Wrapper (und damit oberhalb des kleinen i18n-Hinweistexts
`lvTabKeyHint`). Sie ist auf Desktop wie Mobile vollständig sichtbar.

### Optional: visuelle Hervorhebung

Falls die Leiste auf dem ersten Blick noch nicht prominent genug
wirkt, kann der `ctrlRow` einen leichten Rahmen bekommen. **Nur
einbauen, wenn die Sichtbarkeit auch nach dem Fix subjektiv schwach
bleibt**.

In derselben Datei, an der Stelle der `ctrlRow.style.cssText`-
Zuweisung (Z. 652):

**Vorher**:
```javascript
ctrlRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:10px;';
```

**Nachher** (optional):
```javascript
ctrlRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:14px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;';
```

Diese Variante setzt einen leichten Kasten um die Leiste — macht sie
visuell sofort als Bedienblock erkennbar. Falls Sonnet sie nicht
einbaut: Selbstcheck als „bewußt nicht eingebaut" markieren, dann
bewertet der User später, ob er es nachreichen möchte.

## Teil 2 — Kurven-Tab: Touch-Buttons für `prStr`

### Stelle

In `levels.js`:

- `buildPrTbl()`-Schleife ab Z. ca. 151 erzeugt pro Preset eine
  `<tr>`. Z. 155 baut `<input type="number" class="prStr" data-pi="…"
  value="…" min="-20" max="20" step="0.5">`.
- Listener-Bindings ab Z. 200 (`tbl.querySelectorAll(".prStr")`):
  `change` setzt `presets[pi].strength`, `keydown` macht Pfeiltasten
  ±0,1 dB.
- Am Funktionsende Z. 257: `applyMobileReadonly(tbl)`.

### Lösungsansatz

Pro Preset-Zeile direkt neben dem `prStr`-Input drei kleine
Touch-Buttons (`−` / `Fein` / `+`) einfügen. Klick auf `−`/`+`
ändert die Stärke um 0,5 dB (Grobschritt — der `step="0.5"` paßt
dazu); im Fein-Modus 0,1 dB.

Wir können `buildSliderTouchCtrl` nicht direkt verwenden (erwartet
einen `<input type="range">` mit `input`-Event). Deshalb eine eigene
kleine Funktion `_prStrTouchCtrl(inp, pi)` analog zur Player-
Stärke-Lösung aus Anleitung 33 Schritt 3e.

### Schritt 2a — Helper-Funktion in `levels.js`

In `levels.js` **außerhalb** von `buildPrTbl`, am Dateiende oder direkt
vor `buildPrTbl`, eine neue Funktion einfügen:

```javascript
function _prStrTouchCtrl(inp, pi) {
  if (!inp) return null;
  var box = document.createElement('div');
  box.className = 'touch-ctrl prStr-touch';
  box.style.cssText = 'display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle;';

  var fineMode = false;

  function step(dir) {
    var st = fineMode ? 0.1 : 0.5;
    var oldVal = presets[pi].strength;
    var newVal = Math.max(-20, Math.min(20, +(oldVal + dir * st).toFixed(1)));
    presets[pi].strength = newVal;
    inp.value = newVal.toFixed(1);
    applyPresetDeltaOtherSide(pi, newVal - oldVal, presets[pi]);
    lvOnChange();
  }

  function mkBtn(label, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'touch-btn touch-btn-sm' + (cls ? ' ' + cls : '');
    b.innerHTML = label;
    return b;
  }

  var bMin  = mkBtn('−');
  var bFine = mkBtn('Fein');
  var bPlus = mkBtn('+');

  attachLongPress(bMin,  function () { step(-1); });
  attachLongPress(bPlus, function () { step(+1); });
  bFine.addEventListener('click', function () {
    fineMode = !fineMode;
    bFine.classList.toggle('fine-active', fineMode);
  });

  box.append(bMin, bFine, bPlus);

  // Direkt nach dem prStr-Input einfügen
  if (inp.parentNode) {
    if (inp.nextSibling) inp.parentNode.insertBefore(box, inp.nextSibling);
    else inp.parentNode.appendChild(box);
  }
  return box;
}
```

Hinweise:
- `attachLongPress` stammt aus `touch-ctrl.js` (Anleitung 33
  Schritt 1) und ist global verfügbar.
- Die existierende `change`-Listener-Logik (Z. 201 ff.) verändert
  ebenfalls `presets[pi].strength` und ruft `applyPresetDeltaOtherSide`
  + `lvOnChange`; unsere Touch-Funktion macht das gleiche. Es gibt
  damit zwei Wege, die Stärke zu ändern (Tippen + Touch). Beide
  konsistent.
- `applyPresetDeltaOtherSide` ist die existierende Funktion aus
  levels.js (Z. 195 referenziert). Falls die Signatur in der Datei
  anders ist, übernehmen — wir verwenden das gleiche Aufruf-Schema
  wie der existierende `change`-Listener.

### Schritt 2b — Aufruf in `buildPrTbl`

In `levels.js`, in der `tbl.querySelectorAll(".prStr").forEach`-
Schleife (Z. 200), **am Ende** des Callbacks (nach dem `keydown`-
Listener Z. 234), eine Zeile ergänzen:

**Vorher** (Z. 200–235, vereinfacht):
```javascript
tbl.querySelectorAll(".prStr").forEach((inp) => {
  inp.addEventListener("change", function () { ... });
  inp.addEventListener("keydown", function (e) { ... });
});
```

**Nachher**:
```javascript
tbl.querySelectorAll(".prStr").forEach((inp) => {
  inp.addEventListener("change", function () { ... });
  inp.addEventListener("keydown", function (e) { ... });
  _prStrTouchCtrl(inp, +inp.dataset.pi);
});
```

Damit wird pro Zeile eine kleine 3-Button-Leiste rechts neben dem
Stärke-Eingabefeld erzeugt.

### Schritt 2c — CSS-Variante `.touch-btn-sm` in `style.css`

Die in Anleitung 33 Schritt 2 angelegten `.touch-btn`-Regeln sind für
44×44 px ausgelegt — in einer Tabellenzeile zu groß. Wir ergänzen
eine kompaktere Variante. In `style.css`, im selben Block wie die
`.touch-btn`-Regeln:

```css
.touch-btn-sm {
  min-width: 32px;
  min-height: 32px;
  padding: 2px 8px;
  font-size: 0.95em;
}
.prStr-touch {
  margin-left: 6px;
}
```

Auf Touch-Geräten sind 32 px noch ausreichend für eine kleine
Bedienleiste innerhalb einer Tabellenzeile; die Hauptaktion bleibt
das Tap-Ziel des Stärke-Inputs selbst. Falls 32 px in der Praxis zu
klein wirkt, kann die Mobile-Media-Query (siehe nächster Schritt)
sie auf 38 px hochnehmen.

### Schritt 2d — Mobile-Vergrößerung im Media-Query

Im bestehenden `@media (max-width: 768px)`-Block in `style.css`
(ab Z. 693), folgende Regel ergänzen:

```css
  .touch-btn-sm {
    min-width: 38px;
    min-height: 38px;
    padding: 4px 10px;
    font-size: 1em;
  }
```

Damit sind die Buttons auf Mobile etwas größer, ohne auf Desktop die
Tabellenzeile aufzublasen.

## Schritt 3 — `CODESTRUKTUR.md` minimal anpassen

In CODESTRUKTUR.md, im Datenfluss-Abschnitt „**Touch-Bedienleisten:**"
(eingefügt durch Anleitung 33), den Schieber-Tab-Hinweis ergänzen und
den Kurven-Tab nennen:

**Vorher** (Beispieltext, kann leicht abweichen):
```
**Touch-Bedienleisten:** Pro Slider eine `.touch-ctrl`-Box ... Player-
Stärke (`plStr`) und Schieber-Tab (Canvas) haben Sonder-
Implementierungen ...
```

**Nachher**:
```
**Touch-Bedienleisten:** Pro Slider eine `.touch-ctrl`-Box ... Player-
Stärke (`plStr`), Kurven-Tab (`prStr` pro Preset-Zeile via
`_prStrTouchCtrl` in levels.js) und Schieber-Tab (Canvas) haben
Sonder-Implementierungen. Die Schieber-Tab-Leiste wird in der
Schieber-Card unterhalb des Canvas-Wrappers eingefügt — nicht im
Canvas-Container selbst, weil dieser `overflow:hidden` und feste Höhe
hat.
```

## Schritt 4 — `SPEC.md` Kurven-Tab knapp ergänzen

Im Kurven-Tab-Abschnitt, im Punkt zur Preset-Tabelle:

```
- Jede Kurvenfunktion: Checkbox an/aus, Stärke (±20 dB) mit Touch-
  Bedienleiste − / Fein / + neben dem Eingabefeld (auch auf Desktop
  sichtbar), Mittelpunkt …
```

## Akzeptanztest-Checkliste

### Schieber-Tab

1. Desktop: Schieber-Tab öffnen.
   - Unter dem Schieber-Canvas, **vor** dem kleinen Hinweistext
     (`lvTabKeyHint`), erscheint die Touch-Leiste mit
     `Elektrode: ◀ ▶` und `Wert: ▼ ▲ Fein`.
   - Leiste ist **vollständig sichtbar**, nicht abgeschnitten.
2. Klick `▶` (Elektrode): Fokus springt zur nächsten Elektrode
   (Umrahmung im Canvas wandert).
3. Klick `▲` (Wert) im Relativmodus: `manualLevels[lvTabFocus]`
   steigt um 0,5 dB. Mit Fein aktiv: 0,1 dB.
4. Long-Press auf `▲` für 1 Sek: Auto-Repeat.
5. Absolutmodus (falls MCL gepflegt): `▲` ändert über
   `lvTabStepAbsolute` um 1 qu/CL/CU. Fein aktiv: 5er-Schritt
   (vorhandenes Verhalten von `lvTabStepAbsolute(…, true)`).
6. Mobile-Emulation (iPhone 12 Pro): Leiste sichtbar und tappbar.

### Kurven-Tab

7. Desktop: Kurven-Tab öffnen, Preset-Tabelle ansehen.
   - Pro Zeile direkt rechts neben dem Stärke-Eingabefeld eine
     kompakte Leiste `− Fein +`.
8. Klick `+` an einer aktiven Preset-Zeile (z.B. Bass Boost):
   Stärke steigt um 0,5 dB, Chart-Linie ändert sich, Player-EQ
   aktualisiert sich live (über `lvOnChange()`).
9. Klick `Fein`, dann `+`: Stärke +0,1 dB.
10. Long-Press auf `+`: Auto-Repeat.
11. Stärke ≥ 19,5 dB: Klick `+` clampt auf 20,0 dB.
12. Bidirektionale Spiegelung (`prBothSides`-Checkbox aktiv):
    Touch-Änderung wirkt auf beide Seiten — wenn ja, klappt das,
    weil `applyPresetDeltaOtherSide` wie beim regulären
    `change`-Listener aufgerufen wird.
13. Mobile-Emulation: Buttons groß genug zum Antappen (im
    Media-Query auf 38 px hochgezogen).
14. Mobile: Tap auf das Stärke-Eingabefeld selbst → **keine**
    Tastatur (durch Anleitung 32 readonly).

### Regression

15. Pfeiltasten-Steuerung (Desktop) im Eingabefeld weiterhin
    funktional: ↑/↓ ±0,1 dB.
16. Existierender `change`-Listener: Wenn User manuell tippt (auf
    Desktop) → wirkt wie bisher.
17. Side-Wechsel rebuildet die Tabelle (`buildPrTbl` wird neu
    aufgerufen). Touch-Buttons werden **mit** neu aufgebaut, keine
    doppelten Leisten.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede Akzeptanz-Kriterie einzeln durchgehen
und **erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Bei „unklar" stoppen und nachfragen.

Zusätzlich kritisch prüfen:

- **Schieber-Leiste tatsächlich sichtbar?** Im DOM mit DevTools
  prüfen: `.lv-tab-touch-row` ist Kindknoten der `.card`, nicht des
  620-px-Canvas-Containers. Falls Sonnet zusätzlich noch das
  optionale Hervorhebungs-CSS aus „Teil 1 / Optional" eingebaut hat,
  kurz im Selbstcheck dokumentieren.
- **`_prStrTouchCtrl` Doppel-Anfügung?** Bei `buildPrTbl` wird die
  ganze Tabelle vor der `forEach`-Schleife neu aufgebaut
  (`tbl.innerHTML` oder `tbl.appendChild` Erkennung erforderlich) —
  damit sind alte `.prStr-touch`-Leisten automatisch weg. Falls in
  einer modifizierten Variante die Inputs persistent bleiben würden,
  müßte vor `_prStrTouchCtrl(inp, …)` geprüft werden, ob direkt
  hinter `inp` bereits eine `.prStr-touch` existiert.
- **`step` an `prStr`-Input ist 0,5**: das matcht den Grob-Schritt
  unserer Touch-Buttons. Native Browser-Spinner (Pfeil-Klick im
  Input selbst) macht ebenfalls ±0,5 — konsistent.
- **CODESTRUKTUR.md und SPEC.md**: knappe Updates im selben
  Arbeitsschritt eingefügt.
- **Keine doppelten Listener**: `attachLongPress` registriert 4
  pointer-Events pro Button × 2 Buttons × 8 Presets = 64 Listener.
  Bei jedem Tabellen-Rebuild werden alte DOM-Knoten verworfen, neue
  bekommen frische Listener. Akzeptabel; kein Memory-Leak, weil die
  alten Listener mit den alten DOM-Knoten gemüllt werden.
