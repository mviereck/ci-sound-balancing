# BAUANLEITUNG 152 — Status-Sperre auf Options-Ebene („im CI deaktiviert")

**Zieldateien:** `js/freq-table.js`, `js/dependency-lock.js`, `style.css`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 149 + 151 abgeschlossen. Stand `js/version.js` = `3.0.151-beta`.

**Version:** 3.0.151-beta → **3.0.152-beta**

---

## Kontext

Konzeptbeschluß: Ein Statuswechsel auf oder von „im CI deaktiviert"
ändert die effektive Anzahl aktiver Elektroden und invalidiert damit
vorhandene Meßergebnisse. Andere Status-Wechsel (ok ↔ leicht/mittel/
stark verrauscht ↔ fast stumm ↔ stumm) sind frei — sie beeinflussen
nur die Gewichtung von Meßergebnissen, eine spätere Umgewichtung ist
erlaubt.

Anders als bei den Sperren aus BA 149 und 151 wird hier **nicht das
ganze Dropdown gesperrt**, sondern nur die kritische `<option>` selbst.
Konkret in der Status-Spalte jeder Elektrodenzeile:

- Wenn Meßdaten vorliegen und der aktuelle Status **nicht** „im CI
  deaktiviert" ist: nur die Option „im CI deaktiviert" wird gesperrt.
  Alle anderen Status-Werte bleiben wählbar.
- Wenn Meßdaten vorliegen und der aktuelle Status **bereits** „im CI
  deaktiviert" ist: alle anderen Optionen werden gesperrt (nur
  „im CI deaktiviert" wählbar — kein Weg zurück, solange Daten da
  sind).
- Wenn keine Daten vorliegen: alle Optionen frei.

Damit der Nutzer die Begründung sieht, bekommt das Dropdown bei
aktiven Sperren ein kleines Info-Symbol daneben, das beim Klick
das gewohnte Sperr-Popup öffnet.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.152-beta";
```

---

## Schritt 2 — Sperr-Modul: Info-Icon-Mechanik ergänzen

Im Modul aus BA 149/151 (`js/dependency-lock.js`) den Click-Handler
und Touchstart-Handler erweitern, damit ein neues Klassen-Pattern
`.dep-info-icon` ebenfalls das Popup öffnet — aber **ohne** den
Standard-Klick zu blockieren (das Icon ist ein separates Element
neben dem Dropdown, das selbst keine eigene Aktion hat).

**Vorher (Click-Handler ab BA 149):**
```js
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
```

**Nachher:**
```js
document.addEventListener('mousedown', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
    return;
  }
  // BA 152: Info-Icon — Popup zeigen, aber kein Blockieren
  var icon = e.target.closest('.dep-info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(icon);
    return;
  }
  if (!e.target.closest('#depLockPopup')) depLockHidePopup();
}, true);
```

Im Touchstart-Handler **dieselbe** Ergänzung einfügen (für
Smartphone-Bedienung):

**Vorher:**
```js
document.addEventListener('touchstart', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
  }
}, { capture: true, passive: false });
```

**Nachher:**
```js
document.addEventListener('touchstart', function(e) {
  var target = e.target.closest('.dep-locked');
  if (target) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(target);
    return;
  }
  // BA 152: Info-Icon
  var icon = e.target.closest('.dep-info-icon');
  if (icon) {
    e.preventDefault();
    e.stopPropagation();
    depLockShowPopup(icon);
  }
}, { capture: true, passive: false });
```

---

## Schritt 3 — CSS für Info-Icon

Am Ende von `style.css` anhängen:

```css
/* ============================================================
   DEP-INFO-ICON (BA 152) — kleines Begründungs-Symbol
   neben teil-gesperrten Dropdowns
   ============================================================ */
.dep-info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 4px;
  border-radius: 50%;
  background-color: #fde68a;
  color: #92400e;
  font-size: 11px;
  font-weight: 700;
  font-family: serif;
  font-style: italic;
  cursor: pointer;
  vertical-align: middle;
  user-select: none;
  line-height: 1;
}
.dep-info-icon:hover {
  background-color: #fbbf24;
}
```

---

## Schritt 4 — Status-Dropdown dynamisch sperren

Datei `js/freq-table.js`, Funktion `buildFreqTable()`. Aktuell wird
die Konstante `so` (Status-Optionen-HTML) **einmal** außerhalb der
Schleife definiert (Z. 21). Für die neue Sperr-Logik muß sie pro
Zeile generiert werden, weil sie vom aktuellen Status der jeweiligen
Elektrodenzeile abhängt.

**Schritt 4a) Datenstand vor der Schleife berechnen.**

**Vor** der `for (let i = 0; i < nEl; i++) {`-Schleife (also nach Z. 23,
direkt nach der `const inpStyle = ...`-Definition) einfügen:

```js
// BA 152: Prüfung, ob Meßdaten den Status „im CI deaktiviert"-Wechsel sperren
const _depHasData = (function() {
  const s = sideData[activeSide];
  const ownHasLoud = (s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0);
  const fHas = (typeof fRes !== 'undefined' && Array.isArray(fRes) && fRes.length > 0);
  return ownHasLoud || fHas;
})();
function _depStatusReasons() {
  const reasons = [];
  const s = sideData[activeSide];
  if ((s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0)) {
    reasons.push('depReasonLoudness');
  }
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
```

**Schritt 4b) Die Status-Optionen-Konstante `so` (Z. 21) entfernen.**

Diese Zeile komplett streichen:
```js
const so = `<option value="">ok</option>...<option value="deactivated"...>...</option>`;
```

**Schritt 4c) Pro Zeile dynamisch aufbauen.**

Innerhalb der Schleife, **vor** dem `tr.innerHTML = ...`-Zuweisung,
einfügen:

```js
// BA 152: Status-Optionen pro Zeile, mit selektivem disabled
const _curStatus = elSt[i] || "";
const _curIsDeact = _curStatus === "deactivated";
const _lockDeactOption    = _depHasData && !_curIsDeact;
const _lockOtherOptions   = _depHasData &&  _curIsDeact;
function _mkOpt(val, label, isDeactOpt) {
  var disabled = '';
  if (isDeactOpt && _lockDeactOption) disabled = ' disabled';
  else if (!isDeactOpt && _lockOtherOptions) disabled = ' disabled';
  var extraStyle = isDeactOpt
    ? ' style="font-weight:700;color:#dc2626;text-transform:uppercase"'
    : '';
  return '<option value="' + val + '"' + disabled + extraStyle + '>' + label + '</option>';
}
const so_i =
  _mkOpt("", "ok", false) +
  _mkOpt("noisyLess", t("stNoisyLess"), false) +
  _mkOpt("noisyMore", t("stNoisyMore"), false) +
  _mkOpt("noisyHeavy", t("stNoisyHeavy"), false) +
  _mkOpt("almostMute", t("stAlmMute"), false) +
  _mkOpt("mute", t("stMute"), false) +
  _mkOpt("deactivated", t("stDeactivated").toUpperCase(), true);
// Falls eine Sperre aktiv ist: Info-Icon mit Sperr-Begründung
const _depShowInfo = _lockDeactOption || _lockOtherOptions;
const _depReasonsCsv = _depShowInfo ? _depStatusReasons().join(',') : '';
const _depInfoIconHtml = _depShowInfo
  ? '<span class="dep-info-icon" data-dep-field-label="depFieldStatus" data-dep-reasons="'
    + _depReasonsCsv + '" title="' + t('depLockedTitle') + '">i</span>'
  : '';
```

**Schritt 4d) `tr.innerHTML`-Zeile anpassen.**

Aktuelle Stelle (Z. 56):
```js
`<td><select class="ss" data-i="${i}">${so}</select></td>` +
```

ersetzen durch:
```js
`<td><select class="ss" data-i="${i}">${so_i}</select>${_depInfoIconHtml}</td>` +
```

**Schritt 4e) `depLockApply()` nach Status-Wechsel aufrufen.**

Im bestehenden `.ss`-Change-Handler (ab Z. 107) am Ende, nach
`updRef();`, einfügen:

```js
// BA 152
if (typeof depLockApply === 'function') depLockApply();
```

Das ist eine Sicherheitsmaßnahme, falls in späteren Bauanleitungen
weitere Sperren von Statuswechseln abhängen. Für BA 152 selbst hat
dies keine sichtbare Folge, weil `buildFreqTable()` direkt davor
schon neu gerendert wird (mit aktualisierter Status-Sperre pro
Zeile).

---

## Schritt 5 — i18n-Strings ergänzen

In `i18n/de.js`, im Dependency-Lock-Block (nach `depFieldRefSide`
aus BA 151), einfügen:

```js
  depFieldStatus: "Status „im CI deaktiviert"",
```

Achtung Stringliteral: doppelte Anführungszeichen außen, typografische
„…" innen, **kein** ASCII-`"` innen. So wie bei den anderen Keys mit
deutscher Typografie.

(Die Reason-Keys aus BA 149 — `depReasonLoudness`,
`depReasonFreqMatchSlider`, `depReasonFreqMatchAdaptive` — werden
wiederverwendet, keine neuen Reason-Keys nötig.)

---

## Akzeptanztest

1. **Tool frisch laden.** Version 3.0.152-beta.
2. **Reiter „Implantat".** In der Frequenztabelle ein Status-Dropdown
   öffnen. Erwartet: alle Optionen frei wählbar, kein Info-Symbol
   neben dem Dropdown.
3. **Eine Elektrode auf „im CI deaktiviert" setzen.** Erwartet:
   Funktioniert (noch keine Meßdaten), Elektrodenzeile wird halb-
   transparent (das ist Bestandsverhalten).
4. **Status zurück auf „ok" setzen.** Funktioniert.
5. **Lautstärke-Test** durchführen, einen Wert speichern.
6. **Zurück zum Reiter „Implantat".** Bei jeder Elektrode mit Status
   ungleich „im CI deaktiviert" erscheint **neben** dem
   Status-Dropdown ein kleines Info-Symbol (orange-gelbes Kreis-„i").
7. **Status-Dropdown öffnen.** Erwartet: die Option „im CI
   deaktiviert" ist ausgegraut/nicht anwählbar. Andere Optionen
   sind frei.
8. **Versuchen, die ausgegraute Option auszuwählen.** Erwartet:
   wird nicht übernommen, Status bleibt unverändert.
9. **Wechsel zwischen anderen Status-Werten** (z.B. „leicht verrauscht"
   → „mittel verrauscht"). Erwartet: funktioniert ohne Sperre, weil
   die Konzeptregel nur „im CI deaktiviert" betrifft.
10. **Klick auf das Info-Symbol** (Maus). Erwartet: das gewohnte
    Sperr-Popup erscheint mit Feldname „Status ‚im CI deaktiviert'"
    und der Aufzählung „Lautstärke-Test".
11. **Smartphone-/Touch-Test** (Devtools-Touch-Modus): Tap auf das
    Info-Symbol öffnet das Popup wie auf Desktop.
12. **Eine Elektrode (vorher per Tool-Reset oder Daten-Lösch ohne
    Daten) auf „im CI deaktiviert" setzen, dann Lautstärke-Test machen.**
13. **Zurück zum Reiter „Implantat".** Diese Elektrode hat Status
    „im CI deaktiviert". Status-Dropdown öffnen. Erwartet: alle
    Optionen außer „im CI deaktiviert" sind ausgegraut — die
    Elektrode kann nicht reaktiviert werden, solange Daten da sind.
    Info-Symbol erscheint daneben mit derselben Popup-Logik.
14. **Lautstärke-Daten löschen.** Erwartet: Info-Symbole verschwinden,
    Status-Optionen wieder frei.
15. **Frequenzabgleich-Test** machen, ein Match speichern. Zurück zum
    Reiter „Implantat". Erwartet: gleiche Sperrlogik wie bei
    Lautstärke-Daten, Popup zeigt jetzt „Frequenzabgleich –
    Vor-Schätzung mit Schiebern" oder „Adaptiv-Test".

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 15 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit Datei
und Zeile.

Zusätzlich melden:
- Wurde die alte `so`-Konstante in `js/freq-table.js` entfernt?
- Wird `so_i` pro Zeile generiert? Datei/Zeile.
- Wird das Info-Symbol nur dann gerendert, wenn `_depShowInfo` wahr ist?
- Funktioniert das Popup beim Klick auf das Info-Symbol auf
  Touch-Geräten? (Devtools-Touch-Modus reicht zum Beleg.)
- Wurde der `.dep-info-icon`-Handler in `js/dependency-lock.js`
  sowohl für `mousedown` als auch für `touchstart` ergänzt?
- Steht `js/version.js` auf `3.0.152-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/dependency-lock.js` — Click- und Touchstart-Handler um
  `.dep-info-icon` ergänzt
- `js/freq-table.js` — alte `so`-Konstante entfernt, dynamische
  Status-Optionen pro Zeile, Info-Symbol, `depLockApply()` nach
  Status-Wechsel
- `style.css` — `.dep-info-icon`-Stil
- `i18n/de.js` — neuer Key `depFieldStatus`

---

## Nicht in dieser Bauanleitung enthalten

- **BA 153** — Tabelle für akustische Seite (Mirror der CI-Hz,
  eigener Status mit sechs Stufen statt sieben).
- **BA 154** — „Keine Angabe"-Default für Hörtechnik- und
  Hersteller-Auswahl, UI-Cascade-Verstecken.
- **BA 155** — Schnappschuß + Hinweis-Banner für Stereo-Balance und
  Latenz.
- **BA 156** — Differenzierte Lösch-Knöpfe im FreqMatch-Ergebnis.
- Übersetzungen en/fr/es — eigene Mini-Anleitung.
