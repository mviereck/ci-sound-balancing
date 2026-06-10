# BAUANLEITUNG 151 — Sperr-Regeln für Hörtechnik, Hz-eigen, Referenzseite

**Zieldateien:** `js/dependency-lock.js`, `js/freq-table.js`, `js/freqmatch.js`, `js/freqmatch-adaptive.js`, `js/latency.js`, `js/lr-balance.js`, `js/results.js`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 149 abgeschlossen, inklusive Nachtrag (Schieber-Werte nicht mehr Auslöser für Hersteller-Sperre, `depLockApply()`-Aufrufe in `js/levels-tab.js` wieder entfernt). Stand `js/version.js` = `3.0.150-beta`.

**Version:** 3.0.150-beta → **3.0.151-beta**

---

## Kontext

BA 149 hat das zentrale Sperr-Modul und die erste Anwendung
(Hersteller-Dropdown) eingeführt. Diese Anleitung ergänzt drei weitere
Sperr-Regeln, die jeweils ein ganzes UI-Feld sperren:

1. **Hörtechnik-Auswahl** (Dropdown `#cfgSelect`, in der GUI „Konfiguration"
   genannt; ci/hg/normal/schwerhörig/taub) — sperrt bei vorhandenem
   Lautstärke-Test oder Frequenzabgleich.
2. **Hz-eigen-Spalte** in der Frequenztabelle (Klasse `.fo` pro Zeile) —
   sperrt bei vorhandenem Lautstärke-Test (eigene Seite) oder
   Frequenzabgleich (bilateral wirksam). Wirkt auf alle gerenderten Zeilen.
3. **Referenzseite** im Frequenzabgleich-Reiter — sperrt bei vorhandenen
   Frequenzabgleich-Daten.

Außerdem wird der bestehende Custom-Dialog für den Referenzseiten-Wechsel
(`_fmPrevRefVal`-Rollback und `fmRCDlg`) entfernt — die Sperre macht ihn
überflüssig.

**Nicht in dieser BA enthalten:** Status-Spalte „im CI deaktiviert"
sperrt auf Options-Ebene und ist deshalb in BA 152 separat
angelegt. Sonstige Lösch-Dialoge (`fmrClearConfirm`, `lrClearConfirm`,
`latClearConfirm`, `resetConfirm`) bleiben unverändert — das sind
explizite Action-Confirms zum Löschen, keine Verlust-Warnungen.

---

## Schritt 1 — Version bumpen

`js/version.js`:

**Vorher:**
```js
const APP_VERSION = "3.0.150-beta";
```

**Nachher:**
```js
const APP_VERSION = "3.0.151-beta";
```

---

## Schritt 2 — Sperr-Modul erweitern (Multi-Selektor-Unterstützung)

Im Modul aus BA 149 (`js/dependency-lock.js`) gibt es bislang nur
`rule.selector` (Single-Match). Für die Hz-eigen-Felder, die pro
Elektrode existieren, brauchen wir Multi-Match.

**Funktion `depLockApply()` ersetzen.**

**Vorher (BA-149-Stand):**
```js
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
```

**Nachher:**
```js
function depLockApply() {
  if (typeof DEP_LOCK_RULES === 'undefined') return;
  DEP_LOCK_RULES.forEach(function(rule) {
    if (rule.selectorAll) {
      var nodes = document.querySelectorAll(rule.selectorAll);
      nodes.forEach(function(el) {
        var reasons = rule.getReasonKeys(el);
        if (reasons.length === 0) _depLockUnlock(el);
        else _depLockLock(el, rule.fieldLabelKey, reasons);
      });
    } else if (rule.selector) {
      var el = document.querySelector(rule.selector);
      if (!el) return;
      var reasons = rule.getReasonKeys(el);
      if (reasons.length === 0) _depLockUnlock(el);
      else _depLockLock(el, rule.fieldLabelKey, reasons);
    }
  });
}
```

API-Erweiterung: `getReasonKeys` bekommt optional `el` als Argument.
Die bestehende Hersteller-Regel aus BA 149 verträgt das ohne Anpassung,
weil ungenutzte Argumente in JS ignoriert werden.

---

## Schritt 3 — Drei neue Sperr-Regeln einfügen

In `js/dependency-lock.js`, in der `DEP_LOCK_RULES`-Tabelle, **nach** dem
bestehenden Hersteller-Eintrag (vor dem schließenden `]`) drei neue
Einträge anfügen:

```js
  ,
  // Hörtechnik-Auswahl (BA 151)
  {
    selector: '#cfgSelect',
    fieldLabelKey: 'depFieldCfg',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
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
  },

  // Hz-eigen-Felder pro Elektrode (BA 151) — bilateral wirksam
  {
    selectorAll: '.fo',
    fieldLabelKey: 'depFieldHzEigen',
    getReasonKeys: function(el) {
      const reasons = [];
      const s = sideData[activeSide];
      // Eigene Lautstärke-Daten der aktiven Seite (Hz beeinflußt den Testton)
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      // FreqMatch-Daten (bilateral relevant)
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
  },

  // Referenzseite im Frequenzabgleich (BA 151)
  {
    // Hinweis: das Referenzseiten-Dropdown des FreqMatch-Reiters wird
    // dynamisch in test-ui.js gebaut. Genauen Selektor per grep
    // ermitteln. Aus dem aktuellen Stand:
    //   - js/test-ui.js Z. 741: refSelect.id = 'refEl_' + id;
    //   - Der Test heißt vermutlich 'freqMatch', also ID 'refEl_freqMatch'.
    //   - Falls grep keinen eindeutigen Beleg liefert, im Browser
    //     prüfen mit z.B. document.querySelectorAll('select[id^="refEl"]').
    // Falls eindeutige ID gefunden, hier verwenden:
    selector: '#refEl_freqMatch',
    fieldLabelKey: 'depFieldRefSide',
    getReasonKeys: function() {
      const reasons = [];
      // Frequenzabgleich-Daten in fRes
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
      // Adaptiv-Roh-Daten und Slider-Estimates separat berücksichtigen
      // (analog zur bestehenden Bedingung in js/freqmatch.js Z. 1103):
      if (typeof _fmHasAdaptiveData === 'function' && _fmHasAdaptiveData()) {
        if (reasons.indexOf('depReasonFreqMatchAdaptive') === -1)
          reasons.push('depReasonFreqMatchAdaptive');
      }
      if (typeof _fmHasSliderEstimates === 'function' && _fmHasSliderEstimates()) {
        if (reasons.indexOf('depReasonFreqMatchSlider') === -1)
          reasons.push('depReasonFreqMatchSlider');
      }
      return reasons;
    }
  }
```

**Wichtig zum Selektor `#refEl_freqMatch`:** Sonnet soll vor dem Build
**per grep verifizieren**, welche ID das DOM-Element tatsächlich
bekommt. Suchpfade:
```
grep -n "refSelect.id" js/test-ui.js
grep -n "cfg.id" js/freqmatch.js
```
Wenn die tatsächliche ID anders heißt, den Selektor entsprechend
anpassen. Im Selbstprüf-Bericht melden, welche ID verwendet wurde.

---

## Schritt 4 — Custom-Dialog beim Referenzseiten-Wechsel entfernen

Datei `js/freqmatch.js`, Zeilen 1097-1120.

**Vorher (Z. 1097-1120):**
```js
// Events: Referenzseiten-Wechsel
let _fmPrevRefVal = fmEls.header.refSelect.value;
fmEls.header.refSelect.addEventListener('change', function() {
  setTimeout(fmLoadVerfahrenFromSide, 0);
});
fmEls.header.refSelect.addEventListener('change', function() {
  if (fRes.length > 0 || _fmHasAdaptiveData() || _fmHasSliderEstimates()) {
    fmRCOkBtn.onclick = function() {
      fmRCDlg.classList.remove('active');
      fRes.splice(0, fRes.length);
      _fmClearPersist('left');
      _fmClearPersist('right');
      _fmPrevRefVal = fmEls.header.refSelect.value;
      fmUpdateSliderModeAvail();
    };
    fmRCCancelBtn.onclick = function() {
      fmRCDlg.classList.remove('active');
      fmEls.header.refSelect.value = _fmPrevRefVal;
    };
    fmRCDlg.classList.add('active');
  } else {
    _fmPrevRefVal = fmEls.header.refSelect.value;
  }
});
```

**Nachher:**
```js
// Events: Referenzseiten-Wechsel (BA 151: Sperre statt Custom-Dialog)
fmEls.header.refSelect.addEventListener('change', function() {
  setTimeout(fmLoadVerfahrenFromSide, 0);
});
```

Den `_fmPrevRefVal`-Rollback komplett streichen. Den DOM-Aufbau von
`fmRCDlg`/`fmRCMsg`/`fmRCBtns` weiter oben in der Funktion **nicht**
anrühren — Sonnet soll per `grep -n "fmRCDlg\|fmRCOkBtn\|fmRCCancelBtn"
js/` prüfen, ob die Elemente noch anderswo verwendet werden. Wenn
nicht, gehört der DOM-Aufbau in eine spätere Aufräum-Anleitung; hier
nicht entfernen, um Bruchgefahr zu vermeiden. Befund im
Selbstprüf-Bericht angeben.

---

## Schritt 5 — i18n-Strings ergänzen

In `i18n/de.js`, im BA-149-Block direkt nach `depReasonFreqMatchAdaptive`,
einfügen:

```js
  depFieldCfg: "Hörtechnik",
  depFieldHzEigen: "Hz-eigen",
  depFieldRefSide: "Referenzseite",
```

(Drei neue Keys, sonst keine Änderung an i18n.)

---

## Schritt 6 — `depLockApply()`-Aufrufe an weiteren Stellen

Damit die neuen Sperren rechtzeitig aktualisiert werden, zusätzliche
Aufrufstellen ergänzen. Pro Stelle: **nach** der schreibenden Aktion,
**vor** dem Re-Render (falls vorhanden).

**6a) `js/freq-table.js`** — am Ende des `.fo`-Change-Handlers,
nach `buildFreqTable();` (in der `.forEach(function...)`-Schleife
für Hz-Inputs, derzeit ab Z. 63):
```js
// BA 151
if (typeof depLockApply === 'function') depLockApply();
```

**6b) `js/freqmatch.js`** — nach jedem Schreiben in `fRes`. Per
`grep -n "fRes.push\|fRes.splice\|fRes\[" js/freqmatch.js` die
Mutationsstellen finden, direkt nach jeder Schreib-Operation
einfügen. Bei `fRes.splice(0, fRes.length)` (das ist Löschen)
genauso, weil der gelöschte Zustand auch die Sperre ändert.

**6c) `js/freqmatch-adaptive.js`** — analog zu 6b: per grep
Mutations-Stellen finden, jeweils `depLockApply()`-Aufruf einfügen.

**6d) `js/latency.js`** — direkt nach jedem `lockTestTabs(false, null);`
(per grep finden, analog zu BA 149 Schritt 7f/7g):
```js
// BA 151
if (typeof depLockApply === 'function') depLockApply();
```

**6e) Lösch-Aktionen** — die bestehenden Lösch-Funktionen rufen
`depLockApply()` nach dem Löschen auf. Per grep finden:
- `js/results.js` — Funktion mit `fmrClearConfirm`-Aufruf
- `js/lr-balance.js` — Funktion mit `lrClearConfirm`-Aufruf
- `js/latency.js` — Funktion mit `latClearConfirm`-Aufruf

Im OK-Zweig jeder dieser Funktionen (nach `fRes.splice(...)` /
`lrResults` cleanup / `latencyResult = null`), direkt vor dem
Re-Render:
```js
// BA 151
if (typeof depLockApply === 'function') depLockApply();
```

---

## Schritt 7 — Hinweis auf Übersetzungen

Nur deutsche Strings angelegt. Englisch/Französisch/Spanisch in
einer eigenen Mini-Anleitung, sobald die deutsche GUI durch ist.

---

## Akzeptanztest

1. **Tool frisch laden**, Cache leeren. Versionsanzeige: 3.0.151-beta.
2. **Reiter „Implantat"** öffnen. Hörtechnik-Dropdown und Hz-eigen-Spalte
   beide normal bedienbar (kein grauer Hintergrund).
3. **Reiter „Frequenzabgleich"**, einen Frequenzabgleich-Lauf durchführen
   (Schieber oder Adaptiv), mindestens einen Match speichern.
4. **Zurück zum Reiter „Implantat".** Hörtechnik-Dropdown ist gesperrt
   (grauer Hintergrund). Klick öffnet Popup mit „Hörtechnik kann gerade
   nicht geändert werden", Aufzählung „Frequenzabgleich – Vor-Schätzung
   mit Schiebern" oder „Adaptiv-Test".
5. **Hz-eigen-Spalte** in der Frequenztabelle: jede Zelle ist visuell
   gesperrt. Klick auf eine Zelle öffnet das gleiche Popup wie eben,
   Feldname jetzt „Hz-eigen".
6. **Seite wechseln** (zur anderen CI-Seite, falls beide CI). Auch dort
   ist die Hz-eigen-Spalte gesperrt — bilateral wirksam.
7. **Reiter „Frequenzabgleich" wieder öffnen.** Referenzseite-Dropdown
   ist gesperrt. Klick öffnet Popup mit Feldname „Referenzseite".
   Versuchen, die Auswahl per Tastatur zu ändern (Tab + Pfeiltasten):
   keine Änderung möglich.
8. **Frequenzabgleich-Ergebnisse löschen** (Lösch-Knopf im
   Ergebnis-Bereich des Frequenzabgleich-Reiters). Bestätigungsdialog
   erscheint. Nach Bestätigung sind alle drei Sperren weg —
   Hörtechnik-, Hz-eigen- und Referenzseite-Felder wieder bedienbar.
9. **Lautstärke-Test** durchführen, einen Wert speichern (z.B. über
   Schieber-Test oder Adaptiv-Test im Lautstärke-Sub-Reiter).
10. **Zurück zum Reiter „Implantat".** Hörtechnik-Dropdown gesperrt
    (Begründung jetzt „Lautstärke-Test"), Hz-eigen-Spalte ebenfalls
    gesperrt.
11. **Reiter „Frequenzabgleich".** Referenzseite-Dropdown **nicht**
    gesperrt — der Lautstärke-Test berührt die Referenzseite nicht.
12. **Smartphone-/Touch-Test** (Browser-Devtools Touch-Modus oder echtes
    Gerät): Tippen auf gesperrte Felder öffnet jeweils das Popup wie
    auf Desktop.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 12 Akzeptanz-Schritte einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar, mit Datei und Zeile.

Zusätzlich melden:
- Welche ID hat das Referenzseiten-Dropdown im DOM tatsächlich
  bekommen? (`refEl_<id>` oder anders) — Beleg per grep oder
  Browser-Devtools.
- Wurde der `_fmPrevRefVal`-Block aus `js/freqmatch.js` entfernt?
  Datei/Zeile.
- Wurde der DOM-Aufbau von `fmRCDlg`/`fmRCOkBtn`/`fmRCCancelBtn`
  **nicht** entfernt (sondern stehen gelassen)? Werden diese
  Elemente noch anderswo referenziert? Grep-Ergebnis angeben.
- An welchen `fRes.push`/`fRes.splice`-Stellen wurde `depLockApply()`
  eingefügt? Liste mit Datei/Zeile.
- Steht `js/version.js` auf `3.0.151-beta`?

Bei jedem Punkt mit „unklar" rückfragen, nicht stillschweigend
weitermachen.

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/dependency-lock.js` — `depLockApply()` erweitert (Multi-Selektor),
  drei neue Regeln in `DEP_LOCK_RULES`
- `js/freq-table.js` — `depLockApply()`-Aufruf im Hz-Change-Handler
- `js/freqmatch.js` — `_fmPrevRefVal`-Block entfernt,
  `depLockApply()`-Aufrufe nach `fRes`-Mutationen
- `js/freqmatch-adaptive.js` — `depLockApply()`-Aufrufe nach
  `fRes`-Mutationen
- `js/latency.js` — `depLockApply()`-Aufrufe nach Test-Ende und Löschen
- `js/lr-balance.js` — `depLockApply()`-Aufruf nach LR-Lösch-Aktion
- `js/results.js` — `depLockApply()`-Aufruf nach FreqMatch-Lösch-Aktion
- `i18n/de.js` — drei neue Keys

---

## Nicht in dieser Bauanleitung enthalten

- **BA 152** — Status-Spalte „im CI deaktiviert" auf Options-Ebene
  sperren.
- **BA 153** — Tabelle für akustische Seite (Mirror der CI-Hz).
- **BA 154** — „Keine Angabe"-Default für Hörtechnik- und
  Hersteller-Auswahl.
- **BA 155** — Schnappschuß + Hinweis-Banner für Stereo-Balance und
  Latenz.
- **BA 156** — Differenzierte Lösch-Knöpfe im FreqMatch-Ergebnis.
- Übersetzungen en/fr/es — eigene Mini-Anleitung.
