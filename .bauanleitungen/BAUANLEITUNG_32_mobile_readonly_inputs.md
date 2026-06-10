# Bauanleitung 32: Mobile-Tauglichkeit — readonly-Inputs

Zweite von drei Bauanleitungen zur Smartphone-Tauglichkeit. Unabhängig
von 31 und 33 baubar.

## Problem

Auf Smartphones erscheint beim Tap auf ein `<input type="number">` die
System-Tastatur und verdeckt das halbe Bild. Besonders ärgerlich in der
Preset-Tabelle (Kurven-Tab) und der Frequenz-/Elektrodentabelle
(Implantat-Tab). Manche Stellen fokussieren ein Input zudem
**automatisch** (`levels.js` Z. 196 nach Preset-Aktivierung) — der
Tastatur-Aufruf passiert dann ohne User-Tap.

## Ziel

- Auf reinen Touch-Geräten (kein Hover, grober Pointer) bekommen alle
  `<input type="number">` das Attribut `readonly`. Damit erscheint
  keine System-Tastatur beim Tap.
- Auf Desktop-/Surface-/iPad-mit-Tastatur-Geräten bleibt alles wie
  bisher (Tastatur-Eingabe möglich).
- Die Bedienung der jetzt-readonly-Inputs erfolgt über die in
  **Bauanleitung 33** gebauten Touch-Buttons. Diese Anleitung 32 macht
  nur die Inputs readonly; sie hängt nicht davon ab, daß 33 fertig
  ist — der User kann die Werte temporär nur lesen, nicht ändern.
  Empfohlen ist deshalb, 33 zeitnah danach zu bauen.
- Automatischer Fokus (`element.focus()`) wird auf Touch-Geräten
  unterdrückt.

## Touch-Erkennung

Wir nutzen `matchMedia('(hover: none) and (pointer: coarse)').matches`.
Trifft genau Smartphones und reine Touch-Tablets; iPad mit angeklemmter
Tastatur und Surface bleiben „false".

## Schritt 1 — Neues Modul `mobile.js`

Neue Datei `mobile.js` im Repo-Root anlegen:

```javascript
// mobile.js – Touch-Geräte-Erkennung und kleine Helfer.
// Lädt sehr früh; keine Abhängigkeiten außer dem Browser.

var IS_TOUCH_ONLY = (function () {
  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch (e) {
    return false;
  }
})();

function safeFocus(el) {
  if (!el) return;
  if (IS_TOUCH_ONLY) return;
  try { el.focus(); } catch (e) {}
}

function applyMobileReadonly(root) {
  if (!IS_TOUCH_ONLY) return;
  var scope = root || document;
  var list = scope.querySelectorAll('input[type="number"]');
  for (var i = 0; i < list.length; i++) {
    list[i].setAttribute('readonly', 'readonly');
    list[i].setAttribute('inputmode', 'numeric');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  applyMobileReadonly(document);
});
```

Hinweise:
- `inputmode="numeric"` wird zusätzlich gesetzt — falls ein anderer
  Code später `readonly` entfernt, erscheint dann immerhin nur der
  Ziffernblock statt voller Tastatur.
- `IS_TOUCH_ONLY` ist eine globale Variable (wie alles andere in
  diesem Projekt — siehe CODESTRUKTUR.md „Strukturelle Eigenschaften").

## Schritt 2 — `mobile.js` im Loader registrieren

In `index.html` Z. 25–30, im Array `scripts`, `'mobile.js'` direkt
nach `'version.js'` und vor `'i18n.js'` einfügen.

**Vorher**:
```javascript
var scripts = [
  'version.js', 'i18n.js', 'core.js', 'state-side.js', 'audio.js',
  ...
];
```

**Nachher**:
```javascript
var scripts = [
  'version.js', 'mobile.js', 'i18n.js', 'core.js', 'state-side.js', 'audio.js',
  ...
];
```

Begründung der Position: `mobile.js` hat keine Abhängigkeiten und
liefert Helfer, die von vielen Modulen genutzt werden. Wie bei
`version.js` ist die frühe Position sinnvoll, damit `IS_TOUCH_ONLY`
und `safeFocus` ab dem ersten Modul verfügbar sind.

## Schritt 3 — Dynamisch erzeugte Inputs nachträglich readonly machen

Die `DOMContentLoaded`-Pauschal-Anwendung aus Schritt 1 trifft nur die
zum Lade-Zeitpunkt vorhandenen Inputs. Dynamisch nachgebaute Inputs
(Preset-Tabelle, Frequenztabelle, Test-UI) müssen nach jedem Rebuild
einmal aktualisiert werden.

### 3a. `freq-table.js` — am Ende von `buildFreqTable`

Suche das Ende der Funktion `buildFreqTable` (definiert in
freq-table.js; sie schreibt die `<tr>`-Zeilen mit den drei
number-Inputs `fo`/`it`/`iu` ins DOM und endet typischerweise mit
einem Block, der Event-Listener registriert). Direkt **nach** dem
Aufbau der `<tbody>`-Zeilen (und vor `return` falls vorhanden), eine
Zeile ergänzen:

```javascript
applyMobileReadonly(tbl);  // tbl ist das <table>-Element, das in buildFreqTable mit den Zeilen befüllt wurde
```

Variablen-Name in `buildFreqTable` prüfen — die Funktion verwendet
intern eine Tabellen-Referenz (z.B. `tbl` oder `tbody`). `document`
als Fallback ist auch ok, ist aber etwas teurer.

### 3b. `levels.js` — am Ende von `buildPrTbl`

`buildPrTbl` baut die Preset-Tabelle mit dem `.prStr`-Number-Input pro
Zeile. Am **Ende** der Funktion, **nach** dem Anhängen aller `<tr>`
und nach den `querySelectorAll`-Listener-Bindings:

```javascript
applyMobileReadonly(tbl);
```

Außerdem in derselben Datei Z. 196 ersetzen:

**Vorher**:
```javascript
if (strInp) strInp.focus();
```

**Nachher**:
```javascript
if (strInp) safeFocus(strInp);
```

Damit das automatische Fokussieren nach Preset-Aktivierung auf Mobile
keine Tastatur mehr aufruft.

### 3c. `test-ui.js` — am Ende von `buildTestPanel`

`buildTestPanel` erzeugt über die `makeNumInput`-Hilfsfunktion mehrere
number-Inputs (Volume, Duration, Pause). Am **Ende** der Funktion,
bevor `return` (die Funktion gibt ein Element-Lookup-Objekt zurück):

```javascript
applyMobileReadonly(parentEl);  // parentEl ist das übergebene Container-Element
```

### 3d. `latency.js` — `latEls.slider.focus()` ersetzen

In `latency.js` drei Stellen mit `latEls.slider.focus()`:

**Vorher** (Z. 292, 341, 349):
```javascript
if (latEls && latEls.slider) latEls.slider.focus();
```
und
```javascript
latEls.slider.focus();
```

**Nachher**:
```javascript
if (latEls && latEls.slider) safeFocus(latEls.slider);
```
und
```javascript
safeFocus(latEls.slider);
```

Der Latenz-Slider ist ein `type="range"` — `readonly` greift dort
nicht (range ignoriert das Attribut), und das soll auch so bleiben:
der Range-Slider ist auf Mobile per Touch direkt bedienbar. Nur den
**Autofokus** wollen wir auf Touch-Geräten unterbinden, weil ein
fokussierter Slider in manchen Browsern eine Lupe oder Akzent-Leiste
einblendet.

## Schritt 4 — `index.html` statische Number-Inputs prüfen

Die statischen Inputs in `index.html` (ca. 11 Stück, u.a. cValue,
IDR, iIDR, plMaplawSollInput, …) werden vom `DOMContentLoaded`-
Handler in `mobile.js` automatisch erwischt. **Keine zusätzliche
Änderung an index.html nötig**.

## Schritt 5 — `CODESTRUKTUR.md` aktualisieren

In CODESTRUKTUR.md die Modul-Tabelle erweitern. Neue Zeile **vor**
i18n.js (Position 0b oder direkt unter Position 0 / version.js):

```
| 0b | mobile.js | `IS_TOUCH_ONLY` (Touch-Erkennung per `matchMedia('(hover: none) and (pointer: coarse)')`), `safeFocus(el)` (focus-Aufruf nur auf Nicht-Touch-Geräten), `applyMobileReadonly(root)` (setzt `readonly` und `inputmode="numeric"` auf allen `input[type="number"]` im übergebenen Wurzelelement, no-op auf Desktop). Eigener DOMContentLoaded-Handler, der `applyMobileReadonly(document)` einmalig nach Page-Load aufruft. Wird von freq-table.js, levels.js, test-ui.js nach dynamischen Rebuilds erneut aufgerufen. |
```

Außerdem im Abschnitt „Datenfluss (nicht aus Namen ablesbar)" einen
neuen Absatz einfügen:

```
**Mobile-Eingabe-Sperre:** Auf reinen Touch-Geräten (Smartphone)
werden alle Number-Inputs read-only, damit die System-Tastatur nicht
das Bild verdeckt. Eingabe läuft dort über die Touch-Buttons
(Bauanleitung 33). Erkennung über `IS_TOUCH_ONLY` aus `mobile.js`.
`applyMobileReadonly` wird nach jedem Rebuild dynamischer Tabellen
(`buildFreqTable`, `buildPrTbl`, `buildTestPanel`) erneut aufgerufen,
sonst greift das Flag nur auf den statischen HTML-Bestand.
`safeFocus` ersetzt direkte `.focus()`-Aufrufe an Stellen, wo der
Autofokus auf Touch-Geräten stören würde.
```

## Schritt 6 — `SPEC.md` knapper Hinweis

In SPEC.md unter „Eckdaten" einen neuen Bullet-Punkt einfügen:

```
- **Mobile-Verhalten**: auf reinen Touch-Geräten sind alle
  Number-Inputs read-only — Werte werden ausschließlich über die
  sichtbaren Touch-Buttons (− / + / Fein) geändert. Auf Desktop und
  Tablet-mit-Tastatur unverändert tippbar.
```

## Akzeptanztest-Checkliste

**Vorbereitung**: Browser-DevTools öffnen, Responsive-Mode an, ein
mobiles Profil wählen (z.B. iPhone 12 Pro). Wichtig: Chrome/Firefox
emulieren `hover: none` und `pointer: coarse` korrekt im
Responsive-Mode — am echten Smartphone gegenchecken, falls möglich.

1. **Desktop-Fall, Maus angeschlossen**
   - Implantat-Tab öffnen, ins THR-Feld klicken → kursor erscheint im
     Feld, Eingabe möglich. **Keine** Änderung gegenüber vorher.
2. **Mobile-Fall, iPhone-Emulation**
   - Implantat-Tab öffnen, auf ein THR-Feld tappen.
   - Erwartet: **keine** System-Tastatur erscheint. Das Feld ist
     ausgegraut/readonly markiert (Browser-Default-Darstellung).
3. **Preset-Aktivierung auf Mobile**
   - Kurven-Tab öffnen, einen Preset per Checkbox aktivieren.
   - Erwartet: Das Preset-Stärke-Feld wird **nicht** fokussiert,
     **keine** Tastatur erscheint.
4. **Frequenz-Tabelle auf Mobile**
   - Implantat-Tab, Felder Hz-eigen / THR / Upper-Level: alle
     readonly, keine Tastatur beim Tap.
5. **Test-UI auf Mobile**
   - Messungen-Tab, Test 1: Volume/Duration/Pause-Felder sind
     readonly. Tap öffnet keine Tastatur.
6. **Latenz-Slider auf Mobile**
   - Messungen → Latenz, Test starten.
   - Erwartet: Schieber per Touch verschiebbar (range-Slider
     funktioniert wie immer). Kein Fokus-Highlight oder Lupe.
7. **Side-Wechsel und Rebuild**
   - LINKS/RECHTS klicken — Frequenztabelle, Preset-Tabelle werden
     neu aufgebaut. Inputs bleiben readonly (Schritt 3-Aufrufe
     greifen nach dem Rebuild).
8. **Externe Bluetooth-Tastatur auf Tablet (falls testbar)**
   - matchMedia liefert ggf. weiterhin `hover: none` →
     `IS_TOUCH_ONLY = true`. Das ist ein bekannter Edge-Case und für
     diesen Build akzeptiert (keine Sonder-Erkennung nötig).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede Akzeptanz-Kriterie einzeln durchgehen
und **erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Bei „unklar" stoppen und nachfragen.

Zusätzlich prüfen:

- Wurde `applyMobileReadonly` an **allen vier** dynamischen
  Bau-Stellen aufgerufen (`buildFreqTable`, `buildPrTbl`,
  `buildTestPanel`)? Wenn eine Stelle fehlt, sind die jeweiligen
  Inputs auf Mobile zwar zum Lade-Zeitpunkt readonly, nach einem
  Side-Wechsel / Sprachwechsel / Rebuild aber wieder editierbar.
- `safeFocus` ersetzt **alle drei** `focus()`-Aufrufe in latency.js
  (Z. 292, 341, 349) und den einen in levels.js (Z. 196). Nicht
  ersetzen: `printWindow.focus()` (init.js Z. 685) und
  `w.focus()` (print.js Z. 100) — die betreffen Druck-Fenster, kein
  Eingabe-Element.
- `mobile.js` steht im Loader-Array **vor** `i18n.js`. Falsche
  Reihenfolge führt dazu, daß ein i18n-Modul-Top-Level-Code nicht
  auf `IS_TOUCH_ONLY` zugreifen könnte — aktuell tut i18n das nicht,
  aber die Konvention bleibt sauber.
- CODESTRUKTUR.md neue Zeile + neuer Datenfluss-Absatz vorhanden.
- SPEC.md neuer Eckdaten-Bullet vorhanden.
