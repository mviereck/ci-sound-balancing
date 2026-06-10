# BAUANLEITUNG 133 — Plausibilitäts-Grundgerüst + Monotonie-Prüfung

## Ziel

Infrastruktur für eine Plausibilitätsprüfung der User-Eingaben im
Implantat-Reiter aufbauen. In dieser Anleitung:

- neue Modul-Datei `js/implant-validate.js` mit dem
  Klassifikator-Schema, Render-Funktion und der ersten konkreten
  Prüfung (Hz-Monotonie).
- CSS-Klassen für drei Feldrahmen-Warnstufen (gelb, orange, rot).
- Warnbox-UI unter der Sweep/Stop-Zeile, einklappbar, per Default
  offen.
- Hook in `buildFreqTable`, damit nach jedem Re-Render geprüft
  wird.
- erste deutsche i18n-Keys.

Diese Anleitung ist die Basis für BA 134 ff., die weitere
Prüfungen (Hz-Hersteller-Differenzierung, THR/Upper Level,
FAT-Sonderprüfung, globale Parameter) auf demselben Schema
aufsetzen.

## Begründung

Konzept aus Konzeptphase: Plausibilitätsprüfung in drei
Auffälligkeits-Ebenen (rot = logisch falsch, orange =
Tippfehler-Verdacht, gelb = Auffälligkeit). Jede Ebene markiert
die betroffenen Felder farblich und listet die Warnung in einer
Box unter der Tabelle. Architektur muss generisch sein, weil
viele verschiedene Prüfungen darauf aufsetzen werden.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.132-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.133-beta";
```

---

## Neue Datei `js/implant-validate.js`

Lege diese Datei komplett neu an. Inhalt:

```js
// ============================================================
// IMPLANT VALIDATE — Plausibilitätsprüfung User-Eingaben
// ============================================================
// Architektur:
//   validateImplantTable(side) wird nach jedem Re-Render von
//   buildFreqTable() in freq-table.js aufgerufen. Sie sammelt
//   Warnungen aus einzelnen Prüfungs-Funktionen (_check…),
//   trägt die strengste Warnung pro Feld als CSS-Klassen-Rand
//   an die Eingabefelder und rendert eine Liste in der
//   Warnbox unter der Tabelle.
//
// Warn-Schema (ein Objekt pro Warnung):
//   {
//     level:        1 (rot) | 2 (orange) | 3 (gelb),
//     electrodeIdx: 0..n-1  (optional, bei zeilenbezogen),
//     field:        'hz' | 'thr' | 'upper'  (optional),
//     globalEl:    'c' | 'idr' | 'iidr' (optional, bei globalen Feldern),
//     messageKey:   i18n-Key,
//     messageParams: {…}  (Platzhalter für den i18n-Text)
//   }
// ============================================================

const IMPL_VAL_LEVEL_RED = 1;
const IMPL_VAL_LEVEL_ORANGE = 2;
const IMPL_VAL_LEVEL_YELLOW = 3;

// --- Helfer -------------------------------------------------

function _implEffFreqOf(s, i) {
  if (!s) return 0;
  if (s.elFreqOwn && s.elFreqOwn[i] != null) return s.elFreqOwn[i];
  return s.freqs ? s.freqs[i] : 0;
}

function _implMsg(w) {
  let msg = (typeof t === 'function') ? t(w.messageKey) : w.messageKey;
  if (!msg) msg = w.messageKey;
  if (w.messageParams) {
    msg = msg.replace(/\{(\w+)\}/g, function (_, k) {
      return w.messageParams[k] != null ? w.messageParams[k] : '{' + k + '}';
    });
  }
  return msg;
}

function _implFieldSelector(idx, field) {
  // Klassen wie in freq-table.js: .fo = Hz eigen, .it = THR, .iu = Upper
  const cls = field === 'hz' ? 'fo' : field === 'thr' ? 'it' : field === 'upper' ? 'iu' : null;
  if (!cls) return null;
  return '.' + cls + '[data-i="' + idx + '"]';
}

function _implClearMarkers() {
  document.querySelectorAll(
    '.impl-warn-red, .impl-warn-orange, .impl-warn-yellow'
  ).forEach(function (el) {
    el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
    el.removeAttribute('title');
  });
}

function _implApplyFieldLevel(w) {
  if (w.electrodeIdx == null || !w.field) return;
  const sel = _implFieldSelector(w.electrodeIdx, w.field);
  if (!sel) return;
  const el = document.querySelector(sel);
  if (!el) return;

  // Strengste Stufe (kleinste level-Nr) gewinnt.
  const currentLevel =
    el.classList.contains('impl-warn-red') ? 1 :
    el.classList.contains('impl-warn-orange') ? 2 :
    el.classList.contains('impl-warn-yellow') ? 3 : 99;
  if (w.level >= currentLevel) return;

  el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
  const newClass =
    w.level === 1 ? 'impl-warn-red' :
    w.level === 2 ? 'impl-warn-orange' : 'impl-warn-yellow';
  el.classList.add(newClass);
  el.title = _implMsg(w);
}

// --- Render Warnbox ----------------------------------------

function _implRenderBox(warnings) {
  const list = document.getElementById('implValidateList');
  if (!list) return;
  list.innerHTML = '';

  if (!warnings || warnings.length === 0) {
    const li = document.createElement('li');
    li.className = 'impl-val-empty';
    li.textContent = (typeof t === 'function')
      ? t('implValidateEmpty') : 'Keine Auffälligkeiten';
    list.appendChild(li);
    return;
  }

  // Sortierung: rote zuerst, dann orange, dann gelb.
  const sorted = warnings.slice().sort(function (a, b) {
    return a.level - b.level;
  });

  sorted.forEach(function (w) {
    const li = document.createElement('li');
    li.className = 'impl-val-entry impl-val-entry-l' + w.level;
    const dot = document.createElement('span');
    dot.className = 'impl-val-dot impl-val-dot-l' + w.level;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(_implMsg(w)));
    list.appendChild(li);
  });
}

// --- Prüfungen ---------------------------------------------

function _implCheckHzMonotonie(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const n = s.nEl;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < n - 1; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (s.elSt && s.elSt[i + 1] === 'deactivated') continue;

    const hzI = _implEffFreqOf(s, i);
    const hzJ = _implEffFreqOf(s, i + 1);
    if (hzJ <= hzI) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i + 1,
        field: 'hz',
        messageKey: 'implValidateHzMonotonie',
        messageParams: {
          eI: dENFn(i),
          eJ: dENFn(i + 1),
          hzI: Math.round(hzI),
          hzJ: Math.round(hzJ)
        }
      });
    }
  }
  return warnings;
}

// --- Hauptfunktion -----------------------------------------

function validateImplantTable(side) {
  if (typeof sideData === 'undefined') return;
  const s = sideData[side];
  if (!s) return;

  const warnings = [];
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  // Weitere Prüfungen werden hier in folgenden BAs angefügt.

  _implClearMarkers();
  warnings.forEach(_implApplyFieldLevel);
  _implRenderBox(warnings);
}

// --- Box-Header-Sprachsetzer (i18n) ------------------------

function _implValidateApplyLang() {
  const title = document.getElementById('implValidateTitle');
  if (title && typeof t === 'function') {
    title.textContent = t('implValidateTitle');
  }
  // Box neu rendern, damit "Keine Auffälligkeiten"-Text aktualisiert wird.
  if (typeof activeSide !== 'undefined') {
    validateImplantTable(activeSide);
  }
}
```

---

## CSS-Ergänzung in `style.css`

Folgenden Block ans Ende der Datei anfügen:

```css
/* ============================================================
   Implantat-Plausibilitätsprüfung (BA 133)
   ============================================================ */
.impl-warn-red    { outline: 2px solid #dc2626; outline-offset: -2px; }
.impl-warn-orange { outline: 2px solid #f97316; outline-offset: -2px; }
.impl-warn-yellow { outline: 2px solid #eab308; outline-offset: -2px; }

#implValidateBox {
  margin-top: 14px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg);
  padding: 0;
}
#implValidateBox > summary {
  cursor: pointer;
  padding: 8px 12px;
  font-weight: 600;
  font-size: 0.92em;
  list-style: none;
  user-select: none;
}
#implValidateBox > summary::-webkit-details-marker { display: none; }
#implValidateBox > summary::before {
  content: "▾ ";
  display: inline-block;
  width: 1em;
}
#implValidateBox:not([open]) > summary::before { content: "▸ "; }

#implValidateList {
  list-style: none;
  margin: 0;
  padding: 4px 12px 10px 12px;
  max-height: 240px;
  overflow-y: auto;
  font-size: 0.9em;
}
#implValidateList .impl-val-empty {
  color: var(--text-muted);
  font-style: italic;
  padding: 4px 0;
}
#implValidateList .impl-val-entry {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  line-height: 1.4;
}
.impl-val-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}
.impl-val-dot-l1 { background: #dc2626; }
.impl-val-dot-l2 { background: #f97316; }
.impl-val-dot-l3 { background: #eab308; }
```

---

## HTML — Warnbox in `index.html`

Direkt nach dem in BA 130 erweiterten Sweep/Stop-Block (Ende
auf `</div>` der Flex-Zeile) folgenden Block einfügen, **vor**
dem schließenden `</div>` des Implantat-Tabs:

```html
<details id="implValidateBox" open>
  <summary id="implValidateTitle"></summary>
  <ul id="implValidateList"></ul>
</details>
```

Der Titel-Text wird durch `_implValidateApplyLang()` gesetzt;
das `<summary>` startet leer.

---

## Script-Tag in `index.html` ergänzen

Im `scripts`-Array (Z. 135–145) die Zeile mit `'js/freq-table.js'`
um `'js/implant-validate.js'` ergänzen — direkt **nach**
`freq-table.js`. Vorher:

```js
'js/ui-implant.js', 'js/freq-table.js', 'js/test-ui.js', …
```

Nachher:

```js
'js/ui-implant.js', 'js/freq-table.js', 'js/implant-validate.js', 'js/test-ui.js', …
```

---

## Hook in `js/freq-table.js`

In der Funktion `buildFreqTable` ganz am Ende, direkt **nach**
`applyMobileReadonly(tb);` (aktuell letzte Zeile vor dem
schließenden `}` der Funktion) folgende Zeile einfügen:

```js
  if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
```

Damit läuft die Prüfung nach jedem Re-Render der Frequenztabelle —
also nach jeder User-Eingabe, jedem Side-Wechsel und jeder
Hersteller-Umstellung.

---

## Sprach-Aufruf in `js/i18n.js`

In der `applyLang()`-Funktion (gleiche Funktion, in der die
`s(…)`-Aufrufe stehen) am **Ende** folgende Zeile einfügen,
nach dem letzten `s(…)`-Aufruf:

```js
  if (typeof _implValidateApplyLang === 'function') _implValidateApplyLang();
```

Damit wird die Warnbox bei jedem Sprachwechsel mitübersetzt.

---

## i18n-Keys in `i18n/de.js`

Im deutschen Sprach-Objekt folgende drei Keys ergänzen (Position
egal, sinnvollerweise am Ende der Implantat-bezogenen
Key-Gruppe — also nach `freqDeactHint` oder ähnlich):

```js
    implValidateTitle: "Plausibilitätsprüfung",
    implValidateEmpty: "Keine Auffälligkeiten",
    implValidateHzMonotonie: "E{eJ} ({hzJ} Hz) liegt unter E{eI} ({hzI} Hz) — Hz-Reihe sollte aufsteigend sein",
```

**Nur Deutsch.** `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` werden
in dieser Anleitung **nicht** angefasst. Fehlende Keys fallen
laut `js/i18n.js`-Verhalten auf die deutschen Defaults zurück.
Eine Mini-Anleitung „Übersetzungen für Implantat-Plausibilität"
folgt am Ende der BA-Reihe.

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Neue Datei `js/implant-validate.js` in der Modul-Liste eintragen.
Vorschlag-Position: zwischen `freq-table.js` und `test-ui.js`,
weil sie nach der Tabelle geladen wird und an deren Re-Render
hängt. Vorschlag-Beschreibung:

```
| <neue Nr.> | implant-validate.js | Plausibilitätsprüfung User-Eingaben Implantat-Reiter. Aufruf-Schema: `validateImplantTable(side)` wird am Ende von `buildFreqTable` (freq-table.js) aufgerufen. Sammelt Warnungen aus internen `_implCheck…`-Funktionen (Schema `{level: 1|2|3, electrodeIdx?, field?: 'hz'|'thr'|'upper', globalEl?: 'c'|'idr'|'iidr', messageKey, messageParams}`), markiert Eingabefelder per CSS-Klassen `impl-warn-red/orange/yellow` (strengste Stufe gewinnt) und rendert die Liste in `#implValidateList`. Sprachsetzer `_implValidateApplyLang()` wird aus `i18n.js` aufgerufen. BA 133: nur Hz-Monotonie als erste Prüfung implementiert. |
```

(Numerische Position in der bestehenden Tabelle einreihen — Sonnet
zählt die anderen Einträge entsprechend hoch oder fügt einen
neuen Sub-Eintrag ein, je nach Tabellenstruktur.)

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Am Ende der Datei (nach Punkt zur Berechnungsgrundlage) folgenden
neuen Abschnitt anfügen:

```markdown
## Plausibilitätsprüfung der User-Eingaben

Modul `js/implant-validate.js`. Aufruf nach jedem Re-Render der
Frequenztabelle (Hook am Ende von `buildFreqTable`). Drei
Auffälligkeits-Stufen:

- **Rot** (Level 1): logisch falsch, eindeutig fehlerhaft.
- **Orange** (Level 2): Tippfehler-Verdacht
  (Größenordnungs-Abweichung).
- **Gelb** (Level 3): Auffälligkeit, kann real sein.

Warnungen werden in der Box „Plausibilitätsprüfung" unter dem
Sweep/Stop-Block aufgelistet (einklappbar, per Default offen,
scrollbar bei vielen Einträgen). Zusätzlich bekommt das betroffene
Eingabefeld einen farbigen Rahmen in der Stufe der strengsten
aktiven Warnung; Tooltip am Feld zeigt den Begründungstext. Reine
Warnungen, keine harten Sperren.

Persistenz: keine — bei jedem Re-Render wird neu geprüft. Eine
einmal gesehene Warnung erscheint in der nächsten Session wieder,
wenn die Eingabe unverändert ist.

BA 133: Grundgerüst und erste Prüfung (Hz-Monotonie zwischen
benachbarten Elektroden). Weitere Prüfungen werden in BA 134 ff.
ergänzt.
```

---

## Akzeptanztest

Im Browser durchgehen — alle Schritte müssen erfüllt sein:

1. **Implantat-Reiter aufrufen.** Unterhalb der Sweep/Stop-Zeile
   sitzt eine Box mit Titel „Plausibilitätsprüfung". Sie ist
   per Default geöffnet. Klick auf den Titel klappt sie zu, ein
   weiterer Klick öffnet sie wieder.
2. **Leerzustand**: solange keine User-Eingaben in der
   Hz-eigen-Spalte stehen und die Default-Hz-Werte aufsteigend
   sind (Normalfall), zeigt die Box eine gedimmte Zeile „Keine
   Auffälligkeiten".
3. **Monotonie-Verletzung erzeugen**: in der Hz-eigen-Spalte bei
   E2 einen Wert eintragen, der unter dem Hz-Standard-Wert von
   E1 liegt (z. B. bei MED-EL E1 Default = 235 Hz → E2-eigen auf
   100 setzen). Erwartung:
   - Das Hz-eigen-Eingabefeld von E2 bekommt einen **roten Rahmen**.
   - Tooltip beim Hovern über das Feld zeigt etwa: „E2 (100 Hz)
     liegt unter E1 (235 Hz) — Hz-Reihe sollte aufsteigend sein".
   - In der Warnbox erscheint eine Zeile mit rotem Punkt und
     genau dieser Begründung.
4. **Wert wieder löschen** (Feld leeren): Warnung verschwindet,
   roter Rahmen weg, Box zeigt wieder „Keine Auffälligkeiten".
5. **Mehrere Verletzungen**: zwei Hz-eigen-Werte unmonoton
   eintragen (z. B. E3=50, E5=80). Erwartung: zwei rote Einträge
   in der Box, beide betroffenen Felder rot umrandet.
6. **Status-Test**: eine zwischen den beiden unmonotonen
   Elektroden liegende Elektrode auf Status „im CI deaktiviert"
   stellen — die Prüfung soll die deaktivierte Elektrode
   übergehen, also wenn E3 und E5 beide aktiv sind und E4
   deaktiviert, prüft sie E3↔E5 nicht direkt, sondern jeweils
   gegen den Nachbarn unter Auslassen von E4 (in dieser Anleitung
   noch nicht implementiert — daher: deaktivierte Nachbarn werden
   schlicht aus der Monotonie-Prüfung ausgenommen, sodass keine
   Warnung an einem deaktivierten Wert hängt).
7. **Side-Wechsel**: links/rechts umschalten — die Box passt sich
   an die neue Seite an, alte Markierungen werden geleert.
8. **Hersteller-Wechsel**: MED-EL → Cochlear → AB. Bei jedem
   Wechsel hat die Tabelle wieder Default-Werte → Box ist leer.
9. **Sprachwechsel**: Sprache auf Englisch, dann zurück auf
   Deutsch. Box-Titel und „Keine Auffälligkeiten" wechseln
   passend; Warnungstexte sind in Deutsch (en/fr/es zeigen noch
   den deutschen Default-Text, das ist gewollt und Teil der
   späteren Übersetzungs-Anleitung).
10. **Konsole**: keine neuen Fehler oder Warnungen beim Laden
    oder bei den oben getesteten Aktionen.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der zehn Akzeptanzpunkte
einzeln durchgehen und für jeden melden:

- erfüllt / nicht erfüllt / unklar
- mit Datei- und Zeilenangabe der relevanten Stelle.

Bei „unklar" Rückfrage stellen, nicht still annehmen.

Zusätzliche konkrete Sub-Prüfungen per `grep`:

- `grep -n "validateImplantTable" js/freq-table.js` → genau ein
  Treffer am Ende von `buildFreqTable`.
- `grep -n "validateImplantTable" js/implant-validate.js` → genau
  ein Treffer (die Definition).
- `grep -n "_implValidateApplyLang" js/i18n.js` → genau ein
  Treffer am Ende von `applyLang`.
- `grep -n "implValidateBox" index.html` → genau ein Treffer
  (die `<details>`-Wurzel).
- `grep -n "implant-validate.js" index.html` → genau ein Treffer
  im `scripts`-Array.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.133-beta"`.
- `grep -n "implValidateHzMonotonie" i18n/de.js` → genau ein
  Treffer.

---

## Hinweise

- Diese Anleitung ist die Basis für die nächsten fünf
  Anleitungen (BA 134 Hz-Hersteller-Differenzierung, BA 135
  THR/Upper Level, BA 136 FAT-Sonderprüfung bei Deaktivierung,
  BA 137 globale Parameter, BA 138 i18n en/fr/es). Sie schreiben
  jeweils nur eine weitere `_implCheck…`-Funktion und tragen den
  Aufruf in `validateImplantTable` ein — Architektur, CSS,
  Warnbox und i18n-Mechanik bleiben unverändert.
- **Kein Bau-Diagnose-Test nötig.** Das Verhalten ist visuell
  direkt prüfbar (Rahmen + Box-Text), eine programmatische
  Bestätigung würde nichts ergänzen, was die Augen-Prüfung nicht
  schon liefert.
- **Hinweis auf spätere Übersetzungs-Anleitung**: am Ende der
  BA-Reihe (BA 138) werden die neuen i18n-Keys
  `implValidateTitle`, `implValidateEmpty`,
  `implValidateHzMonotonie` und alle weiteren aus BA 134–137 in
  `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` nachgezogen.
