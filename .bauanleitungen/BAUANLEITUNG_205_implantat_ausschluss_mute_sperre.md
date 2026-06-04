# BA 205 — Implantat: Ausschluss-Checkbox und „Mute"-Status sperren bei adaptiven FreqMatch-Trials

## Voraussetzung

BA 204 ist abgeschlossen, Version `3.2.204-beta` ist live.

## Hintergrund

Ein abgebrochener oder abgeschlossener adaptiver Frequenzabgleich-Lauf kann durch eine Implantat-Änderung still beschädigt werden: wird zwischen Stop und „Test fortsetzen" eine Elektrode ausgeschlossen, deaktiviert oder stummgeschaltet, schlägt `_fmTryRestore` wegen Elektroden-Diff fehl, und `_fmPersist` (Else-Zweig in `js/freqmatch.js`) überschreibt den alten Lauf-Eintrag mit frischen, leeren Tracks. Trial-Daten gehen verloren, der Lauf-Eintrag wird in sich inkonsistent.

Drei UI-Pfade können `elActive`/`elExDur` umlegen:

| Pfad | Was tut er | Sperre vorher |
|---|---|---|
| `.ec-active` (Aktiv-Checkbox) | `elActive[i] = false` | **ja** (BA 164, Sperrgrund `depReasonFreqMatchAdaptive` u. a.) |
| `.ec` (Ausschluss-Checkbox) | `elExDur[i] = Date.now()` | **nein** ← Lücke |
| `.ss` Status-Dropdown auf „mute" | `elExDur[i] = Date.now()` als Seiteneffekt | **nein** ← Lücke |

Diese BA schließt die beiden Lücken **eng auf adaptive FreqMatch-Trials** (kein Loudness- oder Slider-Bezug — bewußte Asymmetrie zur Aktiv-Checkbox-Regel).

## Ziel

1. Sobald `_fmHasAdaptiveData() === true` (also mindestens ein adaptiver Lauf existiert, dessen Tracks `trialCount > 0` haben — gilt auch für abgeschlossene Läufe):
   - **Ausschluss-Checkbox `.ec`** ist per `dependency-lock.js` gesperrt; Klick zeigt das übliche `#depLockPopup` mit Feldname „Ausschluß einer Elektrode" und Grund „Frequenzabgleich – Adaptiv-Test".
   - **Status-Dropdown `.ss`**: andere Optionen bleiben frei wählbar; nur der Wechsel auf den Wert `"mute"` wird abgefangen. Der Dropdown-Wert springt auf den vorherigen Stand zurück, und dasselbe Popup erscheint mit Feldname „Stummschaltung einer Elektrode" und identischem Grund.
2. Aufheben der Sperre ist **nur** durch Löschen aller adaptiven Mess-Ergebnisse möglich (oder weitergehende Aktionen, die das einschließen — bestehender Reset-Pfad reicht).
3. Übersetzungen für en/fr/es werden in dieser BA mit angelegt.

Der Code-Pfad ist klein: eine neue Regel in `dependency-lock.js`, ein neuer Helper für Transient-Popups, ein Block in einem bestehenden Event-Handler in `freq-table.js`, zwei neue i18n-Keys in vier Sprachen.

---

## Schritt 1 — Version bumpen

Datei `js/version.js`:

```js
const APP_VERSION = "3.2.205-beta";
```

(vorher: `"3.2.204-beta"`)

---

## Schritt 2 — i18n: neue Keys in allen vier Sprachen

Genau zwei neue Keys: `depFieldExclude`, `depFieldMute`. Einfügen jeweils direkt nach `depFieldActive`.

### 2.1 `i18n/de.js` (~ Z. 720, nach `depFieldActive`)

```js
    depFieldExclude:  "Ausschluß einer Elektrode",
    depFieldMute:     "Stummschaltung einer Elektrode",
```

### 2.2 `i18n/en.js` (~ Z. 671, nach `depFieldActive`)

```js
    depFieldExclude:  "Electrode exclusion",
    depFieldMute:     "Electrode mute",
```

### 2.3 `i18n/fr.js` (~ Z. 672, nach `depFieldActive`)

```js
    depFieldExclude:  "Exclusion d'une électrode",
    depFieldMute:     "Mise en sourdine d'une électrode",
```

### 2.4 `i18n/es.js` (~ Z. 672, nach `depFieldActive`)

```js
    depFieldExclude:  "Exclusión de un electrodo",
    depFieldMute:     "Silenciar un electrodo",
```

Bestehende Reason-Schlüssel `depReasonFreqMatchAdaptive` wird wiederverwendet (alle vier Sprachen schon vorhanden).

---

## Schritt 3 — `js/dependency-lock.js`: neue `.ec`-Regel und Transient-Popup-Helper

### 3.1 Neue Regel ans Ende von `DEP_LOCK_RULES` anhängen

Die letzte Regel im Array ist die `.ec-active`-Regel (BA 164). Direkt nach ihrem schließenden `}` und vor dem `]` von `DEP_LOCK_RULES` einfügen — also als neuer Eintrag im Array, durch Komma getrennt:

```js
  ,
  // BA 205: Ausschluss-Checkbox — gesperrt, wenn adaptive FreqMatch-Trials vorliegen.
  // Bewußt eng nur auf _fmHasAdaptiveData(); Loudness- und Slider-Bezug bleibt außen vor.
  {
    selectorAll: '.ec',
    fieldLabelKey: 'depFieldExclude',
    getReasonKeys: function() {
      var reasons = [];
      try {
        if (typeof _fmHasAdaptiveData === 'function' && _fmHasAdaptiveData())
          reasons.push('depReasonFreqMatchAdaptive');
      } catch(ex) { /* freqmatch noch nicht initialisiert */ }
      return reasons;
    }
  }
```

### 3.2 Neuer Helper `depLockShowTransientPopup`

Direkt nach `depLockHidePopup` (~ Z. 276), vor dem `// ---- Globale Event-Handler ----`-Block einfügen:

```js
// BA 205: Transient-Popup für selektive Sperren (z.B. einzelner Dropdown-Wert),
// bei denen das Element selbst NICHT dauerhaft .dep-locked tragen soll.
// Setzt dataset-Attribute kurzzeitig, ruft depLockShowPopup, räumt auf.
function depLockShowTransientPopup(el, fieldLabelKey, reasonKeys) {
  if (!el) return;
  var prevField   = el.dataset.depFieldLabel;
  var prevReasons = el.dataset.depReasons;
  var prevSimple  = el.dataset.depSimple;
  el.dataset.depFieldLabel = fieldLabelKey;
  el.dataset.depReasons    = (reasonKeys || []).join(',');
  el.dataset.depSimple     = '1';   // kompakte Popup-Variante ohne Boilerplate
  depLockShowPopup(el);
  if (prevField   === undefined) delete el.dataset.depFieldLabel; else el.dataset.depFieldLabel = prevField;
  if (prevReasons === undefined) delete el.dataset.depReasons;    else el.dataset.depReasons    = prevReasons;
  if (prevSimple  === undefined) delete el.dataset.depSimple;     else el.dataset.depSimple     = prevSimple;
}
```

Hinweis: `depLockShowPopup` liest beim Aufruf, das Aufräumen danach beeinflußt nicht mehr, was sichtbar ist.

---

## Schritt 4 — `js/freq-table.js`: Mute-Wechsel im `.ss`-Dropdown abfangen

Im bestehenden `.ss`-Change-Handler (~ Z. 229–243):

**Vorher:**
```js
  tb.querySelectorAll(".ss").forEach((s) =>
    s.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i,
        val = e.target.value || null;
      elSt[idx] = val;
      // BA 164: „deactivated" als Status-Option entfernt — nur noch „mute"
      if (val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
      buildFreqTable();
      updRef();
      // BA 152
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
```

**Nachher:**
```js
  tb.querySelectorAll(".ss").forEach((s) =>
    s.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i,
        val = e.target.value || null;
      // BA 205: Wechsel auf "mute" sperren, wenn adaptive FreqMatch-Trials vorliegen.
      // Anderes Dropdown-Verhalten bleibt frei. Wert auf alten Stand zurücksetzen,
      // Transient-Popup mit derselben Begründung wie .ec/.ec-active zeigen.
      if (val === "mute"
          && typeof _fmHasAdaptiveData === 'function'
          && _fmHasAdaptiveData()) {
        e.target.value = elSt[idx] || '';
        if (typeof depLockShowTransientPopup === 'function') {
          depLockShowTransientPopup(e.target, 'depFieldMute', ['depReasonFreqMatchAdaptive']);
        }
        return;
      }
      elSt[idx] = val;
      // BA 164: „deactivated" als Status-Option entfernt — nur noch „mute"
      if (val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
      buildFreqTable();
      updRef();
      // BA 152
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
```

Wichtig: das `return` vor `elSt[idx] = val` ist Pflicht — sonst würde der gesperrte Wert doch durchgehen.

---

## Schritt 5 — `docs/spec/03-implantat.md` aktualisieren

Im Implantat-Tab-Abschnitt, im Bullet-Block der Elektroden-Tabelle (~ Z. 96–107):

**Vorher (Status-Dropdown- und Ausschluss-Bullets):**
```md
  - Status-Dropdown: ok, leicht/mittel/stark verrauscht, fast stumm,
    stumm (6 Optionen — **kein „im CI deaktiviert"** mehr seit BA 164).
  - Ausschluss-Checkbox: „stumm" → automatisch gesetzt (BA 153), manuell
    wieder abhakbar. Andere Status: frei bedienbar.
```

**Nachher:**
```md
  - Status-Dropdown: ok, leicht/mittel/stark verrauscht, fast stumm,
    stumm (6 Optionen — **kein „im CI deaktiviert"** mehr seit BA 164).
    **Mute-Sperre (BA 205):** Wechsel auf „stumm" ist gesperrt, wenn
    adaptive FreqMatch-Trials vorliegen (`_fmHasAdaptiveData() === true`,
    Feldname `depFieldMute`); andere Werte bleiben wählbar. Dropdown-Wert
    springt zurück, Transient-Popup mit Begründung
    `depReasonFreqMatchAdaptive`.
  - Ausschluss-Checkbox: „stumm" → automatisch gesetzt (BA 153), manuell
    wieder abhakbar. Andere Status: frei bedienbar.
    **Sperre (BA 205):** Bei adaptiven FreqMatch-Trials per
    `dependency-lock.js` gesperrt (`.ec`-Klasse, Feldname `depFieldExclude`,
    Sperrgrund `depReasonFreqMatchAdaptive`). Eng nur auf adaptive Daten —
    Loudness- und Slider-Daten lösen die Sperre **nicht** aus (bewußte
    Asymmetrie zur Aktiv-Checkbox-Regel).
```

---

## Schritt 6 — `docs/CODESTRUKTUR.md` aktualisieren

Im Abschnitt zu `dependency-lock.js` (~ Z. 136) den Satz mit der Regel-Aufzählung erweitern. Aktuell steht dort:

> Vier Regeln (BA 149/151): `#mfrSelect` (Hersteller), `#cfgSelect` (Hörtechnik), `.fo` (Hz-eigen, Multi-Selektor), `#refEl_freqmatch` (Referenzseite FreqMatch).

Ersetzen durch:

> Sechs Regeln (BA 149/151/164/205): `#mfrSelect` (Hersteller), `#cfgSelect` (Hörtechnik), `.fo` (Hz-eigen, Multi-Selektor), `#refEl_freqmatch` (Referenzseite FreqMatch), `.ec-active` (Aktiv-Häkchen pro Elektrode, BA 164), `.ec` (Ausschluss-Checkbox, BA 205, eng nur auf adaptive FreqMatch-Trials). Zusätzlich BA 205: Transient-Popup-Helper `depLockShowTransientPopup(el, fieldKey, reasonKeys)` für selektive Sperren auf einzelnen Werten (z.B. `.ss="mute"`), bei denen das Element nicht dauerhaft gesperrt werden soll — temporäres Setzen der dataset-Attribute, `depLockShowPopup`-Aufruf, anschließendes Aufräumen.

---

## Akzeptanztest

Browser-Cache leeren (Strg+F5), dann:

1. **Sperre wirkt nach erstem Trial.**
   - Implantat-Tab → CI-Seite konfigurieren, Hörtechnik wählen.
   - Reiter Messungen → Frequenzabgleich → adaptiv → Test starten. Höher- oder Tiefer-Button **einmal** klicken. Stop drücken.
   - Reiter Implantat öffnen.
   - Erwartet: Ausschluss-Checkbox einer beliebigen Elektrode klicken → Popup erscheint mit „Ausschluß einer Elektrode kann gerade nicht geändert werden" + Begründung „Frequenzabgleich – Adaptiv-Test".
   - Status-Dropdown derselben Elektrode auf „stumm" stellen → Wert springt zurück auf den vorherigen, dasselbe Popup erscheint (Feldname jetzt „Stummschaltung einer Elektrode").
   - Status-Dropdown auf einen anderen Wert (z.B. „leicht verrauscht") → Wechsel klappt normal.

2. **Sperre wirkt nach abgeschlossenem Lauf.**
   - Adaptiven Test komplett durchlaufen lassen (bis `fmFinishAdaptive` greift).
   - Sperren beider Bedienungen wie unter 1.

3. **Aufhebung nur durch Löschen.**
   - Adaptive Messungen über den Reset-Pfad löschen (Sub-Tab „Messungen löschen" oder Reset-Funktion).
   - Erwartet: Ausschluss-Checkbox und Mute-Wahl wieder frei bedienbar; kein Popup mehr.

4. **Asymmetrie zur Aktiv-Checkbox bestätigen.**
   - Frische Daten. Nur Lautstärke-Test (Sub-Tab 1) durchführen — keine FreqMatch-Trials.
   - Erwartet: Aktiv-Checkbox `.ec-active` **gesperrt** (alte BA-164-Regel, Sperrgrund `depReasonLoudness`). Ausschluss-Checkbox `.ec` **frei**. Mute-Wahl im Dropdown **frei**.
   - Anschließend nur Slider-Schätzungen (kein adaptiver Lauf) anlegen → Verhalten identisch: `.ec` und Mute bleiben frei.

5. **Übersetzungen.**
   - Sprache auf Englisch wechseln (Sprach-Auswahl, sofern verfügbar) und Schritt 1 wiederholen. Popup zeigt „Electrode exclusion …" bzw. „Electrode mute …".
   - Stichprobe für Französisch und Spanisch genügt.

6. **Keine Regression in der Konsole.**
   - `Uncaught SyntaxError`, `Uncaught ReferenceError` oder `Uncaught TypeError` während der Test-Schritte → Bug, melden.

---

## Selbstprüfungs-Auftrag

Vor Abgabe:

- `js/dependency-lock.js`: die neue Regel ist syntaktisch korrekt ans Array angehängt (Komma vor neuem `{`), `_fmHasAdaptiveData` ist in einem `try`-Block geschützt (TDZ-Schutz wie in den bestehenden Regeln).
- `depLockShowTransientPopup`: dataset-Attribute werden vor und nach dem Popup-Aufruf korrekt geschrieben/wiederhergestellt; `dataset.depSimple` triggert die kompakte Popup-Variante (Z. 251 in `dependency-lock.js`).
- `js/freq-table.js`: das `return` im neuen `if`-Block fehlt nicht; `e.target.value = elSt[idx] || ''` setzt korrekt zurück (leerstring statt `null`, weil ein `<select>` keinen `null` als Value aufnimmt).
- `i18n/de.js`, `en.js`, `fr.js`, `es.js`: jeweils zwei neue Zeilen direkt nach `depFieldActive`, Komma am Ende, kein doppelter Eintrag.
- `js/version.js`: exakt `"3.2.205-beta"`.
- `docs/spec/03-implantat.md` und `docs/CODESTRUKTUR.md`: Edits durchgezogen.
- Keine typographischen Quotes in den Code-Snippets — nur ASCII `"`, `'`, ` ` ` (Konsole `grep -n "[„"'']" js/dependency-lock.js js/freq-table.js i18n/*.js` sollte für die geänderten Stellen keinen Treffer in JS-Code liefern).
- Browser-Test: Schritte 1 und 2 des Akzeptanztests durchlaufen.

## Bekannte Lücke (bewußt offen)

Die strukturelle Schwäche im Resume-Pfad (`fmAbort` markiert den Lauf nicht als abgeschlossen; `_fmPersist` überschreibt im Else-Zweig den alten Run-Eintrag bei Elektroden-Diff) ist mit BA 205 nicht behoben — nur die UI-Pfade dorthin sind versperrt. Verbleibende Pfade (roter Ausschluss-Button **während** laufendem Adaptiv-Test, JSON-Load mit alter Elektroden-Konfiguration, DevTools-State-Manipulation) bleiben theoretisch erreichbar. Dokumentiert in `docs/IDEEN.md` als „Frequenzabgleich-Adaptiv — Resume-Pfad bei veränderter Elektroden-Konfiguration", inkl. zweier Lösungsskizzen.
