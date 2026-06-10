# BAUANLEITUNG 149 — Sperr-Modul-Grundlage + Hersteller-Sperre + Smartphone-Popup

**Zieldateien:** `js/dependency-lock.js` (neu), `js/freq-table.js`, `js/file.js`, `js/state-side.js`, `js/test.js`, `js/lr-balance.js`, `js/init.js`, `index.html`, `style.css`, `i18n/de.js`, `js/version.js`

**Version:** 3.0.148-beta → **3.0.149-beta**

---

## Kontext

Konzept-Beschluß aus der Vorbesprechung: bisherige `confirm()`-Dialoge,
die vor dem Verlust von Meßdaten warnen, werden durch sichtbare Sperren
der jeweiligen UI-Felder ersetzt. Diese erste Anleitung legt die zentrale
Infrastruktur an und wendet sie als ersten konkreten Fall auf das
Hersteller-Auswahlfeld an.

**Drei Sperr-Arten im Tool** (sauber im Code getrennt halten):

- (a) **Test läuft gerade** → `lockTestTabs()` in `js/test-ui.js` (existiert).
- (b) **Testdaten liegen vor** → **diese Anleitung**: neues Modul `js/dependency-lock.js`.
- (c) **Voraussetzungen für Testbeginn fehlen** → jeweils im Test-Modul, z.B. `_fmRenderBlockedWarning` (existiert).

Schichten treffen sich nur am DOM (CSS-Klasse `.dep-locked`,
`aria-disabled`-Attribut). Keine Vermischung der Logiken untereinander.

In nachfolgenden Bauanleitungen (BA 150ff.) kommen weitere Sperr-Regeln
zur selben Tabelle dazu: Hörtechnik-Auswahl, Hz-eigen, Status
„im CI deaktiviert", Referenzseite im Frequenzabgleich.

---

## Schritt 1 — Version bumpen

Datei `js/version.js`:

**Vorher:**
```js
const APP_VERSION = "3.0.148-beta";
```

**Nachher:**
```js
const APP_VERSION = "3.0.149-beta";
```

---

## Schritt 2 — Neue Datei `js/dependency-lock.js`

Komplett neu anlegen, Inhalt 1:1:

```js
// ============================================================
// DEPENDENCY-LOCK (BA 149)
// ------------------------------------------------------------
// Sperrt UI-Eingaben, wenn vorhandene Meßergebnisse durch eine
// Änderung ungültig würden. Sperr-Schicht (b) Daten-vorhanden.
// Schicht (a) Test-läuft liegt in test-ui.js (lockTestTabs),
// Schicht (c) Voraussetzungen-fehlen jeweils im Test-Modul.
//
// Kein IIFE, kein Modul-System. Globaler Scope wie restliches Tool.
// ============================================================

// ---- Sperr-Tabelle ----
// Pro Eintrag:
//   selector       — CSS-Selektor des Feldes
//   fieldLabelKey  — i18n-Key für den menschenlesbaren Feldnamen
//   getReasonKeys  — Funktion ohne Argumente, liefert Liste i18n-Keys
//                    mit menschenlesbaren Bezeichnungen der betroffenen
//                    Tests. Leere Liste = nicht gesperrt.
const DEP_LOCK_RULES = [
  // Hersteller-Auswahl (BA 149)
  {
    selector: '#mfrSelect',
    fieldLabelKey: 'depFieldMfr',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      // Eigene Lautstärke-Daten der aktiven Seite
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0) ||
        (s.manualLevels && s.manualLevels.some(function(v) { return v !== 0; }));
      if (ownHasLoud) reasons.push('depReasonLoudness');
      // Andere Seite akustisch → Hersteller-Wechsel zieht Frequenzraster mit
      const other = activeSide === 'left' ? 'right' : 'left';
      const otherSync = (sideData[other].config || 'ci') !== 'ci';
      const otherHasLoud = otherSync && (
        (sideData[other].bRes && sideData[other].bRes.length > 0) ||
        (sideData[other].jRes && sideData[other].jRes.length > 0)
      );
      if (otherHasLoud) reasons.push('depReasonLoudnessOtherSide');
      // Frequenzabgleich-Daten (global in fRes)
      if (typeof fRes !== 'undefined' && Array.isArray(fRes) && fRes.length > 0) {
        var hasSlider = false, hasAdaptive = false;
        for (var i = 0; i < fRes.length; i++) {
          var e = fRes[i];
          if (!e) continue;
          if (e.method === 'slider') hasSlider = true;
          if (e.method === 'adaptive') hasAdaptive = true;
        }
        if (hasSlider) reasons.push('depReasonFreqMatchSlider');
        if (hasAdaptive) reasons.push('depReasonFreqMatchAdaptive');
      }
      return reasons;
    }
  }
  // Weitere Regeln folgen in BA 150ff.
];

// ---- Anwenden ----
function depLockApply() {
  if (typeof DEP_LOCK_RULES === 'undefined') return;
  DEP_LOCK_RULES.forEach(function(rule) {
    var el = document.querySelector(rule.selector);
    if (!el) return;
    var reasons = rule.getReasonKeys();
    if (reasons.length === 0) {
      _depLockUnlock(el);
    } else {
      _depLockLock(el, rule.fieldLabelKey, reasons);
    }
  });
}

function _depLockLock(el, fieldLabelKey, reasonKeys) {
  el.classList.add('dep-locked');
  el.setAttribute('aria-disabled', 'true');
  el.dataset.depFieldLabel = fieldLabelKey;
  el.dataset.depReasons = reasonKeys.join(',');
}

function _depLockUnlock(el) {
  el.classList.remove('dep-locked');
  el.removeAttribute('aria-disabled');
  delete el.dataset.depFieldLabel;
  delete el.dataset.depReasons;
}

// ---- Popup ----
function depLockShowPopup(el) {
  var popup = document.getElementById('depLockPopup');
  if (!popup) return;
  var fieldLabel = (typeof t === 'function')
    ? t(el.dataset.depFieldLabel || 'depFieldGeneric')
    : (el.dataset.depFieldLabel || 'Dieses Feld');
  var reasonList = (el.dataset.depReasons || '').split(',').filter(function(x) { return !!x; });
  var reasonHtml = reasonList.map(function(k) {
    var label = (typeof t === 'function') ? t(k) : k;
    return '<li>' + label + '</li>';
  }).join('');
  var titleSuffix = (typeof t === 'function') ? t('depLockedTitle') : 'kann gerade nicht geändert werden';
  var bodyText    = (typeof t === 'function') ? t('depLockedBody')  : 'Die Änderung würde folgende Meßergebnisse ungültig machen:';
  var footerText  = (typeof t === 'function') ? t('depLockedFooter') : 'Erst diese Ergebnisse löschen oder das Tool zurücksetzen.';
  popup.innerHTML =
    '<div class="dep-popup-title">' + fieldLabel + ' ' + titleSuffix + '</div>' +
    '<div class="dep-popup-body">' +
      '<div>' + bodyText + '</div>' +
      '<ul>' + reasonHtml + '</ul>' +
      '<div>' + footerText + '</div>' +
    '</div>';
  // Positionierung: unter dem gesperrten Element
  var rect = el.getBoundingClientRect();
  popup.style.left = (rect.left + window.scrollX) + 'px';
  popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  popup.hidden = false;
}

function depLockHidePopup() {
  var popup = document.getElementById('depLockPopup');
  if (popup) popup.hidden = true;
}

// ---- Globale Event-Handler ----
// mousedown statt click, damit das Öffnen der Select-Dropdown-Liste
// noch vor dem Browser-Default abgefangen wird.
document.addEventListener('mousedown', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
    return;
  }
  // Klick außerhalb des Popups schließt es
  if (!e.target.closest('#depLockPopup')) depLockHidePopup();
}, true);

// Touch-Variante: touchstart entsprechend abfangen
document.addEventListener('touchstart', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
  }
}, { capture: true, passive: false });

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') depLockHidePopup();
  var active = document.activeElement;
  if (active && active.classList && active.classList.contains('dep-locked')) {
    e.preventDefault();
  }
});
```

---

## Schritt 3 — CSS in `style.css`

Am Ende von `style.css` anhängen:

```css
/* ============================================================
   DEPENDENCY-LOCK (BA 149)
   ============================================================ */
.dep-locked {
  background-color: #f3f4f6 !important;
  color: #6b7280 !important;
  cursor: not-allowed !important;
  opacity: 0.7;
  border-color: #d1d5db !important;
}

#depLockPopup {
  position: absolute;
  z-index: 10000;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 10px 14px;
  max-width: 320px;
  font-size: 0.88em;
  line-height: 1.4;
  color: #111827;
}

#depLockPopup[hidden] {
  display: none !important;
}

#depLockPopup .dep-popup-title {
  font-weight: 600;
  margin-bottom: 6px;
  color: #b91c1c;
}

#depLockPopup .dep-popup-body ul {
  margin: 6px 0;
  padding-left: 20px;
}
```

---

## Schritt 4 — HTML in `index.html`

**4a)** **Direkt vor dem schließenden `</body>`** den Popup-Container einfügen:

```html
<div id="depLockPopup" hidden></div>
```

**4b)** Skript-Einbindung: Per `grep -n "i18n.js" index.html` die i18n-Zeile finden,
das neue Skript **direkt danach** einfügen — vor `init.js`. Cache-Buster-Schema
wie bei den anderen Skripten übernehmen (typisch `?t=N` oder analoger Suffix).
Wenn die anderen Scripte keinen Buster haben, dann auch hier weglassen.

Beispiel-Snippet:
```html
<script src="js/dependency-lock.js"></script>
```

---

## Schritt 5 — i18n-Keys in `i18n/de.js`

Per `grep -n "cfgWarnMfrSwitch" i18n/de.js` die Stelle der bisherigen
Confirm-Nachricht finden und **darunter** folgende Keys einfügen.
Anführungszeichen-Hinweis: Nur die geraden `"…"` als JS-Stringdelimiter
verwenden, innen keine `"` mischen (typographische „…" sind im Text OK).

```js
  // Dependency-Lock (BA 149)
  depFieldMfr: "Hersteller",
  depFieldGeneric: "Dieses Feld",
  depLockedTitle: "kann gerade nicht geändert werden",
  depLockedBody: "Die Änderung würde folgende Meßergebnisse ungültig machen:",
  depLockedFooter: "Erst die genannten Ergebnisse löschen oder das Tool zurücksetzen, um diese Einstellung zu ändern.",
  depReasonLoudness: "Lautstärke-Test",
  depReasonLoudnessOtherSide: "Lautstärke-Test der anderen Seite (wird mit übernommen)",
  depReasonFreqMatchSlider: "Frequenzabgleich – Vor-Schätzung mit Schiebern",
  depReasonFreqMatchAdaptive: "Frequenzabgleich – Adaptiv-Test",
```

Den bestehenden Key `cfgWarnMfrSwitch` **stehen lassen** — er wird nach
dem Umbau in Schritt 6 nicht mehr aufgerufen, aber sicherheitshalber
nicht entfernt für den Fall, daß ein Aufruf in einer anderen Datei
übersehen wurde. Sonnet soll am Ende per `grep -rn "cfgWarnMfrSwitch" js/`
und `grep -rn "cfgWarnMfrSwitch" i18n/` prüfen und im Bericht angeben,
ob der Key noch irgendwo referenziert wird. Falls nein: in einem
Folgeschritt entfernbar (gehört aber nicht in diese Anleitung).

---

## Schritt 6 — `confirm()`-Dialog aus `switchMfr` entfernen

Datei `js/freq-table.js`, Funktion `switchMfr` ab Zeile 206.

**Vorher (Z. 206–225):**
```js
function switchMfr(m) {
  const s = sideData[activeSide];
  const oldMfr = s.manufacturer;
  if (m === oldMfr) return;
  // Prüfen ob Daten verloren gehen (eigene oder andere nicht-CI Seite)
  const ownHasData = (s.bRes && s.bRes.length > 0)
    || (s.jRes && s.jRes.length > 0)
    || (s.manualLevels && s.manualLevels.some(v => v !== 0));
  const other = activeSide === "left" ? "right" : "left";
  const otherSync = (sideData[other].config || "ci") !== "ci";
  const otherHasData = otherSync && (
    (sideData[other].bRes && sideData[other].bRes.length > 0)
    || (sideData[other].jRes && sideData[other].jRes.length > 0)
  );
  if (ownHasData || otherHasData) {
    if (!confirm(t("cfgWarnMfrSwitch"))) {
      document.getElementById("mfrSelect").value = oldMfr;
      return;
    }
  }
  s.manufacturer = m;
```

**Nachher:**
```js
function switchMfr(m) {
  const s = sideData[activeSide];
  const oldMfr = s.manufacturer;
  if (m === oldMfr) return;
  // BA 149: Datenschutz erfolgt jetzt über die Sperre in dependency-lock.js
  // (Sperrt das Dropdown bereits, wenn relevante Meßergebnisse vorliegen).
  // Erreicht der Code diesen Punkt, ist das Feld nicht gesperrt — Wechsel frei.
  s.manufacturer = m;
```

Die 12 Zeilen zwischen `if (m === oldMfr) return;` und `s.manufacturer = m;`
werden komplett gestrichen (alte Daten-Check-Block plus `confirm`).

---

## Schritt 7 — Aufruf-Stellen für `depLockApply()`

`depLockApply()` muß überall dort aufgerufen werden, wo sich der
Sperr-Zustand ändern kann. Folgende sieben Stellen ergänzen.
Falls eine Stelle gegen Erwarten nicht existiert (Funktion umbenannt
o.ä.): in Selbstprüfung melden, nicht stillschweigend überspringen.

**7a) `js/state-side.js`** — am Ende von `bindActiveSide()` (definiert ab Z. 72):
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7b) `js/state-side.js`** — am Ende von `setSideConfig(side, cfg)` (definiert ab Z. 549):
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7c) `js/freq-table.js`** — am Ende von `switchMfr`, nach `buildImplantCard()`:
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7d) `js/file.js`** — am Ende von `resetAll()` (ab Z. 20), nach `alert(t("resetDone"))`:
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7e) `js/file.js`** — am Ende von `loadJson(file)` (ab Z. 321), nach allen
sync-Aufrufen (typisch nach `buildImplantCard()` oder `renderResults()`,
je nachdem was zuletzt steht):
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7f) `js/test.js`** — direkt nach jedem `lockTestTabs(false, null);`
(Z. 864 und Z. 1149):
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

**7g) `js/lr-balance.js`** — direkt nach jedem `lockTestTabs(false, null);`
(Z. 424 und Z. 437):
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

Hinweis: `js/latency.js` und `js/freqmatch.js` brauchen für diese
Bauanleitung **noch keinen** Aufruf — die Lautstärke- und FreqMatch-
Daten ändern sich an anderen Stellen ihrerseits durch Test-Abschluß
oder Lösch-Aktion, die in nachfolgenden Bauanleitungen mit
`depLockApply()` versehen werden. Initial-Stand reicht für BA 149.

**7h) `js/init.js`** — am Ende des `DOMContentLoaded`-Handlers, nach
allen Init-Aufrufen:
```js
// BA 149
if (typeof depLockApply === 'function') depLockApply();
```

---

## Schritt 8 — Hinweis auf künftige Übersetzungen

Diese Bauanleitung legt nur die deutschen Strings an. Englisch,
Französisch, Spanisch werden in einer eigenen kleinen Anleitung
nachgezogen, sobald die deutsche GUI-Vorlage abgenommen ist
(siehe `docs/BAUANLEITUNGEN_LEITLINIEN.md`).

---

## Akzeptanztest

Klick für Klick, mit erwartetem Verhalten.

1. **Tool im Browser frisch laden** (Strg+F5 oder Cache leeren). Die
   Versionsanzeige zeigt **3.0.149-beta**.
2. **Reiter „Implantat" öffnen.** Hersteller-Dropdown ist normal bedienbar
   (kein grauer Hintergrund, kein „nicht erlaubt"-Cursor).
3. **Reiter „Messungen" → „Lautstärke" öffnen.** Wenn dort manuelle
   Schieber sichtbar sind: einen Schieber auf einen Wert ungleich Null
   stellen. Falls statt Schiebern ein Test mit Start-Knopf läuft: einen
   Test-Durchlauf starten und nach mindestens einem aufgenommenen Wert
   beenden.
4. **Zurück zum Reiter „Implantat".** Das Hersteller-Dropdown ist visuell
   gesperrt (grauer Hintergrund, „nicht erlaubt"-Cursor beim Drüberfahren).
5. **Klick auf das gesperrte Dropdown.** Ein kleines Popup erscheint unter
   dem Feld mit der Aufschrift „Hersteller kann gerade nicht geändert
   werden", einer Aufzählung „Lautstärke-Test" und dem Hinweis, daß man
   die Ergebnisse erst löschen oder das Tool zurücksetzen muß. Die
   Dropdown-Liste klappt **nicht** auf.
6. **Klick irgendwo außerhalb des Popups.** Popup schließt sich.
7. **ESC-Taste.** Popup ist zu (falls noch offen).
8. **Browser-Devtools öffnen, Touch-Modus aktivieren** (z.B. Mobilgerät
   simulieren). Erneut auf das gesperrte Dropdown tippen. Popup öffnet
   sich genauso wie auf Desktop.
9. **Lautstärke-Daten löschen** (Reset-Knopf im Lautstärke-Sub-Reiter,
   falls vorhanden, sonst Tool-Reset über den globalen Reset-Knopf).
   Zurück zum Reiter „Implantat".
10. **Erwartet:** Hersteller-Dropdown wieder normal bedienbar. Klick öffnet
    die Dropdown-Liste wie gewohnt.
11. **Reiter „Frequenzabgleich" öffnen, Test-Durchlauf machen, mindestens
    einen Match speichern** (Schieber-Modus oder Adaptiv-Modus).
12. **Zurück zum Reiter „Implantat".** Hersteller-Dropdown gesperrt,
    Popup-Text nennt jetzt „Frequenzabgleich – Vor-Schätzung mit Schiebern"
    (oder „Adaptiv-Test", je nachdem was gemessen wurde).

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertigmeldung** jeden der 12 Akzeptanz-Schritte einzeln durchgehen
und für jeden melden:
- **erfüllt** / **nicht erfüllt** / **unklar**
- bei „erfüllt": die Datei- und Zeilenangabe der relevanten Stelle
- bei „nicht erfüllt" oder „unklar": kurze Begründung

Zusätzlich prüfen und melden:
- Ist `confirm(t("cfgWarnMfrSwitch"))` aus `switchMfr` entfernt? Datei/Zeile.
- Wird `depLockApply()` an allen sieben aufgeführten Stellen aufgerufen?
  Pro Stelle Datei/Zeile zurückgeben.
- Ist `js/dependency-lock.js` als `<script>`-Tag in `index.html` zwischen
  i18n.js und init.js eingebunden? Zeile angeben.
- Existiert `<div id="depLockPopup" hidden>` in `index.html`? Zeile angeben.
- Steht `js/version.js` auf `3.0.149-beta`?
- Wird `cfgWarnMfrSwitch` noch irgendwo aufgerufen?
  `grep -rn "cfgWarnMfrSwitch" js/ i18n/` ausführen und Ergebnis melden.

Bei jedem Punkt, der als „unklar" markiert ist, **rückfragen statt
weiterzumachen** — die Unsicherheit ist das Signal, daß die Anleitung
oder der Code von der Erwartung abweicht.

---

## Übersicht der geänderten Dateien

- `js/dependency-lock.js` — **neu**
- `js/version.js` — Versions-Bump
- `js/freq-table.js` — `switchMfr` umgebaut, `depLockApply()`-Aufruf
- `js/file.js` — `depLockApply()`-Aufrufe in `resetAll` und `loadJson`
- `js/state-side.js` — `depLockApply()`-Aufrufe in `bindActiveSide` und `setSideConfig`
- `js/test.js` — zwei `depLockApply()`-Aufrufe nach Test-Abschluß
- `js/lr-balance.js` — zwei `depLockApply()`-Aufrufe nach Test-Abschluß
- `js/init.js` — `depLockApply()`-Aufruf am Ende von DOMContentLoaded
- `index.html` — Popup-Container, Skript-Tag
- `style.css` — Lock-Klasse, Popup-CSS
- `i18n/de.js` — neue Lock-Keys

---

## Nicht in dieser Bauanleitung enthalten

Folgende Punkte aus dem Konzept sind separaten Anleitungen vorbehalten:

- **BA 150** — Tabelle für akustische Seite (Mirror der CI-Hz, eigener Status).
- **BA 151** — Hörtechnik-Auswahl „Keine Angabe" als neuer Default,
  UI-Verstecken-Logik.
- **BA 152** — weitere Sperr-Regeln (Hörtechnik, Hz-eigen, Status
  „im CI deaktiviert", Referenzseite im Frequenzabgleich).
- **BA 153** — Stand-Schnappschuß und Hinweis-Banner bei Stereo-Balance
  und Latenz.
- **BA 154** — differenzierte Lösch-Knöpfe im Frequenzabgleich-Ergebnis.
- Übersetzungen en/fr/es — eigene Mini-Anleitung.
