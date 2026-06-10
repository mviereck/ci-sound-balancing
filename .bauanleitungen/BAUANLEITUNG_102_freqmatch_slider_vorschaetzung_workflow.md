# BAUANLEITUNG 102 — Slider-Vor-Schätzung: Workflow & Storage

**Ziel:** Den vorhandenen, aber im UI deaktivierten Slider-Modus des
Frequenzabgleichs als **optionale Vor-Schätzung** vor dem adaptiven Test
reaktivieren. Slider-Werte werden in einem **eigenen Speicherfeld**
abgelegt (nicht in `fRes`) und dienen später dem adaptiven Track als
Startwert. Die Anzeige in Tabelle, Player und Druck folgt in BA 103.

**Reihenfolge in der Serie:**
102 (dies — Workflow + Storage) → 103 (Lese-Pfade) → 104 (Adaptiver
Start aus Schätzung + Folgelauf-Bracketing) → 105 (Catch-up-Priorisierung).

**Volumen:** ein Sonnet-Chat. Nicht mit den Folge-Anleitungen vermischen.

---

## 1. Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.0.102-beta";
```

(Vorher: `3.0.101-beta`.)

---

## 2. Slider-Modus im Mode-Dropdown wieder enablen

In `js/freqmatch.js`, im `DOMContentLoaded`-Handler (suchen nach
`fmEls.modeSelect.options.forEach`, ca. Z. 1715–1722).

**Vorher:**
```js
if (fmEls.modeSelect) {
  Array.from(fmEls.modeSelect.options).forEach(function(opt) {
    if (opt.value === 'slider') opt.disabled = true;
  });
  fmEls.modeSelect.addEventListener('change', function() {
    fmSetMode(fmEls.modeSelect.value);
  });
}
```

**Nachher:**
```js
if (fmEls.modeSelect) {
  // 'slider'-Option wird dynamisch in fmUpdateSliderModeAvail() gesperrt,
  // sobald für die aktuelle Seite ein adaptiver Lauf existiert.
  fmEls.modeSelect.addEventListener('change', function() {
    fmSetMode(fmEls.modeSelect.value);
  });
}
```

---

## 3. Neue Sperr-Logik für die 'slider'-Option

Neue Funktion in `js/freqmatch.js` (direkt unterhalb von `fmApplyMode`,
ca. Z. 1602):

```js
// Sperrt die 'slider'-Option im Mode-Dropdown, sobald für die aktuell
// gewählte var-Seite mindestens ein adaptiver Lauf existiert. Die
// Slider-Vor-Schätzung ist nur sinnvoll, BEVOR der adaptive Test
// gestartet wurde.
function fmUpdateSliderModeAvail() {
  if (!fmEls || !fmEls.modeSelect) return;
  const sd = sideData[fmVarSide] || {};
  const fa = sd.freqmatchAdaptive;
  const hasRuns = !!(fa && Array.isArray(fa.runs) && fa.runs.length > 0);
  Array.from(fmEls.modeSelect.options).forEach(function(opt) {
    if (opt.value === 'slider') opt.disabled = hasRuns;
  });
  // Falls der User aktuell im Slider-Modus war, beim Sperren auf adaptiv
  // zurückfallen.
  if (hasRuns && fmMode === 'slider' && !fmRunning) {
    fmSetMode('adaptive', { force: true });
  }
}
```

Diese Funktion an folgenden Stellen aufrufen:
- **Am Ende von `fmApplyMode`** (Z. 1602): `fmUpdateSliderModeAvail();`
- **Am Ende von `fmLoadModeFromSide`** (Z. 1652, nach `fmRefreshResumeHint();`): `fmUpdateSliderModeAvail();`
- **Am Ende von `_fmMarkCompleted`** (in `freqmatch.js`, suchen): `fmUpdateSliderModeAvail();`
- **Am Ende von `fmFinishAdaptive`** (Z. 1066–1103, vor dem Schluß-Block): `fmUpdateSliderModeAvail();`
- **Im `refSelect`-Change-Handler** (siehe Z. 1735ff im DOMContentLoaded, dort wo `fmLoadModeFromSide` aufgerufen wird): nach dem Aufruf von `fmLoadModeFromSide` zusätzlich `fmUpdateSliderModeAvail();` (falls noch nicht durch fmLoadModeFromSide selbst gerufen — Sonnet, bitte prüfen).

---

## 4. Auto-Umschaltung von slider → adaptive entfernen

In `js/freqmatch.js`, Funktion `fmLoadModeFromSide` (Z. 1643–1653).

**Vorher:**
```js
function fmLoadModeFromSide() {
  const varSide = (fmEls && fmEls.refSelect)
    ? (fmEls.refSelect.value === 'left' ? 'right' : 'left')
    : 'right';
  const sd = sideData[varSide] || {};
  const saved = (sd.fmMode === 'slider' || sd.fmMode === 'adaptive')
    ? sd.fmMode : 'adaptive';
  const wanted = saved === 'slider' ? 'adaptive' : saved;
  fmSetMode(wanted, { force: true });
  fmRefreshResumeHint();
}
```

**Nachher:**
```js
function fmLoadModeFromSide() {
  const varSide = (fmEls && fmEls.refSelect)
    ? (fmEls.refSelect.value === 'left' ? 'right' : 'left')
    : 'right';
  const sd = sideData[varSide] || {};
  const saved = (sd.fmMode === 'slider' || sd.fmMode === 'adaptive')
    ? sd.fmMode : 'adaptive';
  // Wenn 'slider' gespeichert war, aber bereits ein adaptiver Lauf
  // existiert, fällt fmUpdateSliderModeAvail später auf adaptive zurück.
  fmSetMode(saved, { force: true });
  fmRefreshResumeHint();
  fmUpdateSliderModeAvail();
}
```

---

## 5. Neuer Speicher: `sliderEstimates`

### 5.1 In `js/state-side.js`: Default-Wert ergänzen

In `js/state-side.js` ist `freqmatchAdaptive` als Sub-Objekt pro Seite
mit Default `null` deklariert. Initialisierung passiert beim ersten
Schreibzugriff aus `freqmatch.js`.

Neue Konvention: das `freqmatchAdaptive`-Objekt erhält ein **zusätzliches
Feld `sliderEstimates`** vom Typ Objekt mit String-Keys (Elektroden-Index
als String) und Werten `{ cent: number, varSide: string, refSide: string, varFreq: number, timestamp: number }`.

Beispiel-Struktur:
```js
freqmatchAdaptive = {
  runs: [],
  currentRunIdx: null,
  sliderEstimates: {
    "5":  { cent: -180, varSide: "right", refSide: "left", varFreq: 1500, timestamp: 1716900000000 },
    "11": { cent: +250, varSide: "right", refSide: "left", varFreq: 4900, timestamp: 1716900060000 }
  }
}
```

`sliderEstimates` wird in der bestehenden Migrations-Funktion
`_fmMigrateAdaptive(fa)` (in `js/state-side.js`) **wie folgt behandelt**:

- Wenn das einkommende `fa`-Objekt kein `sliderEstimates`-Feld hat,
  Default `{}` setzen.
- Wenn vorhanden, unverändert übernehmen (keine Filter, keine
  Migration).
- Wird auch in der `runs`-Schema-Verwurf-Pfad mitgesichert: wenn das
  alte `runs[]`-Schema verworfen wird, das `sliderEstimates`-Feld
  bleibt erhalten.

Sonnet, bitte in `_fmMigrateAdaptive` an der passenden Stelle ergänzen:
```js
fa.sliderEstimates = (fa && typeof fa.sliderEstimates === 'object' && fa.sliderEstimates)
  ? fa.sliderEstimates : {};
```

### 5.2 Default beim ersten Anlegen

Suchen, wo `sideData[side].freqmatchAdaptive` erstmals als Objekt mit
`{runs:[], currentRunIdx:null}` initialisiert wird (in `freqmatch.js`
in `_fmPersist`, in `fmStartAdaptive` oder ähnlich). An jeder solchen
Stelle das Feld `sliderEstimates: {}` mitanlegen.

Hilfsfunktion zur Konsistenz, neu in `freqmatch.js` direkt unterhalb
von `fmTrackKey`/`fmParseTrackKey` (ca. Z. 90):

```js
// Stellt sicher, daß sideData[side].freqmatchAdaptive existiert und
// ein gültiges sliderEstimates-Feld hat. Wird vor jedem Lese- oder
// Schreibzugriff auf sliderEstimates aufgerufen.
function _fmEnsureSliderStore(side) {
  const sd = sideData[side];
  if (!sd) return null;
  if (!sd.freqmatchAdaptive) {
    sd.freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} };
  }
  if (!sd.freqmatchAdaptive.sliderEstimates ||
      typeof sd.freqmatchAdaptive.sliderEstimates !== 'object') {
    sd.freqmatchAdaptive.sliderEstimates = {};
  }
  return sd.freqmatchAdaptive.sliderEstimates;
}
```

---

## 6. Slider-Confirm schreibt jetzt in `sliderEstimates`, nicht in `fRes`

In `js/freqmatch.js`, Funktion `fmConfirm` (Z. 1316–1338).

**Vorher:**
```js
function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const existingIdx = fRes.findIndex(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === fmCurrentEl
  );
  const entry = {
    varSide: fmVarSide,
    refSide: fmRefSide,
    elIdx: fmCurrentEl,
    varFreq: varHz,
    refFreq: refHz,
    timestamp: Date.now(),
  };
  if (existingIdx >= 0) {
    fRes[existingIdx] = entry;
  } else {
    fRes.push(entry);
  }
  fmSeqIdx++;
  fmLoadElectrode();
}
```

**Nachher:**
```js
function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const store = _fmEnsureSliderStore(fmVarSide);
  if (store) {
    store[String(fmCurrentEl)] = {
      cent:    Math.round(fmCentOffset),
      varSide: fmVarSide,
      refSide: fmRefSide,
      varFreq: varHz,
      timestamp: Date.now(),
    };
  }
  fmSeqIdx++;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
```

---

## 7. `fmPrevCent` liest auch aus `sliderEstimates`

In `js/freqmatch.js`, Funktion `fmPrevCent` (Z. 193–199).

**Vorher:**
```js
function fmPrevCent(elIdx) {
  const existing = fRes.find(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx
  );
  if (!existing) return 0;
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}
```

**Nachher:**
```js
function fmPrevCent(elIdx) {
  // 1) Vorhandene Slider-Vor-Schätzung hat höchste Priorität als
  //    "Vorgängerwert" im Slider-Modus.
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store && store[String(elIdx)] != null) {
    const c = store[String(elIdx)].cent;
    if (typeof c === 'number' && isFinite(c)) return Math.round(c);
  }
  // 2) Sonst fRes-Eintrag (alter Slider-Modus oder adaptiver Match).
  const existing = fRes.find(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx
  );
  if (!existing) return 0;
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}
```

---

## 8. Slider-Undo entfernt jetzt aus `sliderEstimates`

In `js/freqmatch.js`, Funktion `fmUndo` (Z. 1366–1376).

**Vorher:**
```js
function fmUndo() {
  if (fmAdaptiveActive) { fmUndoAdaptive(); return; }
  if (!fmRunning || fmSeqIdx === 0) return;
  fmSeqIdx--;
  const prevEl = fmSeq[fmSeqIdx];
  const idx = fRes.findIndex(
    (r) => r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === prevEl
  );
  if (idx >= 0) fRes.splice(idx, 1);
  fmLoadElectrode();
}
```

**Nachher:**
```js
function fmUndo() {
  if (fmAdaptiveActive) { fmUndoAdaptive(); return; }
  if (!fmRunning || fmSeqIdx === 0) return;
  fmSeqIdx--;
  const prevEl = fmSeq[fmSeqIdx];
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (store) delete store[String(prevEl)];
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
```

---

## 9. Empfehlungs-Dialog vor dem ersten adaptiven Start

### 9.1 Dialog-Markup im DOMContentLoaded-Handler aufbauen

In `js/freqmatch.js`, im `DOMContentLoaded`-Handler, **vor** dem
existierenden Referenzwechsel-Dialog (Z. 1730ff, `const fmRCDlg = ...`),
zusätzlich einen neuen Dialog anlegen:

```js
// --- Slider-Empfehlungs-Dialog (BA 102) ---
const fmSEDlg = _mkEl('div', 'modal-overlay');
fmSEDlg.hidden = true;
const fmSECard = _mkEl('div', 'card');
const fmSETitle = _mkEl('h3');
fmSETitle.dataset.t = 'fmSliderEstimateTitle';
const fmSEMsg = _mkEl('p');
fmSEMsg.dataset.t = 'fmSliderEstimateMsg';
const fmSEBtnRow = _mkEl('div', 'controls-row');
const fmSEBtnSlider = _mkEl('button', 'btn btn-primary');
fmSEBtnSlider.dataset.t = 'fmSliderEstimateBtnSlider';
const fmSEBtnSkip = _mkEl('button', 'btn');
fmSEBtnSkip.dataset.t = 'fmSliderEstimateBtnSkip';
const fmSEBtnCancel = _mkEl('button', 'btn');
fmSEBtnCancel.dataset.t = 'fmSliderEstimateBtnCancel';
fmSEBtnRow.append(fmSEBtnSlider, fmSEBtnSkip, fmSEBtnCancel);
fmSECard.append(fmSETitle, fmSEMsg, fmSEBtnRow);
fmSEDlg.appendChild(fmSECard);
document.body.appendChild(fmSEDlg);

fmSEBtnSlider.addEventListener('click', function() {
  fmSEDlg.hidden = true;
  fmSetMode('slider');
});
fmSEBtnSkip.addEventListener('click', function() {
  fmSEDlg.hidden = true;
  _fmShowHpCheck(fmStartAdaptive);
});
fmSEBtnCancel.addEventListener('click', function() {
  fmSEDlg.hidden = true;
});

// In das fmEls-Returnobjekt eintragen, damit applyLang sie erreicht:
fmEls.sliderEstimateDlg = fmSEDlg;
```

### 9.2 Bedingungen, wann der Dialog erscheint

Neue Funktion direkt unterhalb des bestehenden `_fmShowHpCheck`
(ca. Z. 63):

```js
// Liefert true, wenn der Empfehlungs-Dialog vor dem adaptiven Start
// gezeigt werden soll: (a) noch kein Lauf für diese Seite,
// (b) keine sliderEstimates für aktive Elektroden vorhanden.
function _fmShouldOfferSliderEstimate() {
  const sd = sideData[fmVarSide];
  if (!sd) return false;
  const fa = sd.freqmatchAdaptive;
  if (fa && Array.isArray(fa.runs) && fa.runs.length > 0) return false;
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return false;
  const seq = fmBuildSeq();
  for (var i = 0; i < seq.length; i++) {
    if (store[String(seq[i])] != null) return false;  // mind. eine Schätzung da
  }
  return seq.length > 0;
}
```

### 9.3 Dialog-Aufruf in `fmStart` einbauen

In `js/freqmatch.js`, Funktion `fmStart` (Z. 1265–1270).

**Vorher:**
```js
function fmStart() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === "left" ? "right" : "left";
  _fmShowHpCheck(_fmDoStart);
}
```

**Nachher:**
```js
function fmStart() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === "left" ? "right" : "left";

  // Empfehlungs-Dialog nur vor adaptivem Erststart, nicht im Slider-Modus.
  if (fmMode === 'adaptive' && _fmShouldOfferSliderEstimate()) {
    if (fmEls.sliderEstimateDlg) {
      fmEls.sliderEstimateDlg.hidden = false;
      return;
    }
  }
  _fmShowHpCheck(_fmDoStart);
}
```

(Der Kopfhörer-Check läuft im Slider-Modus bisher nicht. Sonnet,
bitte prüfen: `_fmDoStart` rufte im Slider-Pfad direkt `fmLoadElectrode`
auf — das bleibt unverändert. Im Slider-Estimate-Workflow ruft der
Dialog `fmSetMode('slider')` auf, die nächsten Klicks des Users
gehen über den normalen Slider-Test-Button.)

---

## 10. Edge-Case: Wechsel der Referenzseite (`refSelect`)

Im `DOMContentLoaded`-Handler von `freqmatch.js` gibt es einen
Listener für `fmEls.refSelect`. Beim Wechsel der Referenzseite wird
der bisher pausierte adaptive Lauf verworfen (`_fmClearPersist`).
Slider-Estimates folgen einer **eigenen Logik**: sie sind an
`sideData[varSide]` gebunden, der Wechsel der Referenzseite kippt die
varSide um. Estimates der vorherigen varSide bleiben erhalten (gehören
zu der Seite, die jetzt ref ist und nicht mehr getestet wird) und
werden bei Rückwechsel wieder verfügbar.

Sonnet: bitte im refSelect-Change-Handler **nicht** sliderEstimates der
alten varSide löschen. Nur `_fmClearPersist` für den alten Lauf (wie
bisher), `fmLoadModeFromSide()` (wie bisher), `fmUpdateSliderModeAvail()`
(neu, hinzufügen).

---

## 11. i18n-Strings — nur Deutsch

In `i18n/de.js` die folgenden Keys ändern bzw. ergänzen.

**Ändern (existiert bereits):**
- `fmModeSlider: "Klassisch (Slider)"`
  → `fmModeSlider: "Vor-Schätzung (Slider)"`

**Neu hinzufügen** (alphabetisch in den Frequenzabgleich-Block am
besten in der Nähe von `fmModeSlider`):

```js
fmSliderEstimateTitle:    "Erst Vor-Schätzung machen?",
fmSliderEstimateMsg:      "Sie können den Frequenzabgleich beschleunigen, indem Sie zuerst pro Elektrode eine ungefähre Schieber-Einstellung treffen. Der adaptive Test startet dann nahe an Ihrer Schätzung statt aus ±100 Cent. Empfohlen vor allem, wenn Sie größere Frequenzabweichungen vermuten.",
fmSliderEstimateBtnSlider:"Erst Slider-Schätzung",
fmSliderEstimateBtnSkip:  "Direkt adaptiv starten",
fmSliderEstimateBtnCancel:"Abbrechen",
```

Sonnet: keine ASCII-`"` innerhalb der Strings benutzen; Zeilenenden mit
Komma; vor Versand jeden Anführungszeichen-Wert per Auge auf gerade
Paar-Anzahl der `"` durchsehen.

**Keine Änderungen** in `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`. Fehlende
Keys fallen automatisch auf `de.js` zurück (Hinweis am Schluß der
Anleitung).

---

## 12. SPEC und CODESTRUKTUR mitführen

### 12.1 `docs/spec/02b-freqmatch-adaptiv.md`

**Im Abschnitt „Verfahren im Überblick"** (oder einem neuen Abschnitt
„Optionale Vor-Schätzung (Slider)" davor) ergänzen:

> **Optionale Vor-Schätzung (Slider).** Vor dem ersten adaptiven Lauf
> einer Seite kann der Nutzer pro Elektrode eine grobe Schieber-Einstellung
> als Vor-Schätzung vornehmen. Diese Werte werden separat von `fRes` in
> `sideData[side].freqmatchAdaptive.sliderEstimates[elIdx]` gespeichert
> und dienen dem adaptiven Track als Startwert (siehe BA 104). Anzeige
> und Nutzung in Meßergebnis-Tabelle, Player und Druck siehe BA 103.
> Sobald `runs.length >= 1` für die Seite, ist der Slider-Modus für
> diese Seite gesperrt; bestehende Schätzungen bleiben gespeichert.

Außerdem den Spec-Satz **„der Slider-Modus ist im Dropdown deaktiviert
(Option `disabled`)"** entfernen oder zu **„der Slider-Modus dient als
Vor-Schätzung; im Dropdown verfügbar, solange noch kein adaptiver Lauf
existiert"** umformulieren. Den Satz **„Slider-fRes-Einträge (kein
`fmStatus`-Feld) werden beim Laden stillschweigend herausgefiltert"**
unverändert lassen — das betrifft nur Altdaten.

### 12.2 `docs/CODESTRUKTUR.md`

Im `state-side.js`-Eintrag das neue `sliderEstimates`-Feld in der
`freqmatchAdaptive`-Beschreibung ergänzen.

Im `freqmatch.js`-Eintrag (Zeile 143) am Ende die neuen Funktionen
`fmUpdateSliderModeAvail`, `_fmEnsureSliderStore`,
`_fmShouldOfferSliderEstimate` mit kurzer Beschreibung anführen, plus
den Hinweis: „Seit BA 102: Slider-Modus reaktiviert als Vor-Schätzung;
`fmConfirm` schreibt in `freqmatchAdaptive.sliderEstimates`, nicht in
`fRes`. Empfehlungs-Dialog `fmSliderEstimateDlg` vor adaptivem Erststart."

---

## 13. Akzeptanztest-Checkliste (manuell, nach dem Bau)

Vor dem Test: localStorage leeren oder zumindest beide
`sideData.*.freqmatchAdaptive` auf `null` setzen (Konsole:
`sideData.left.freqmatchAdaptive = null; sideData.right.freqmatchAdaptive = null; location.reload();`).

1. **Tab Messungen → Sub-Tab Frequenzabgleich öffnen.** Erwartet:
   Mode-Dropdown zeigt „Adaptiv (2I-2AFC)" und „Vor-Schätzung (Slider)",
   **beide auswählbar** (keine grau).
2. **Auf „Vor-Schätzung (Slider)" wechseln.** Erwartet: Slider, Slider-
   Wert, „Offset bestätigen"-Button werden sichtbar; Höher/Tiefer-Buttons
   und das Status-Grid verschwinden.
3. **Auf „Test starten" klicken.** Erwartet: Test-Block sichtbar,
   erste Elektrode geladen, Slider auf 0.
4. **Slider auf z. B. +60 cent schieben, „Offset bestätigen".** Erwartet:
   nächste Elektrode wird geladen, kein Eintrag in `fRes` (Konsole
   prüfen: `fRes.filter(r => r.varSide === sideData.activeSide && r.fmStatus == null).length` bleibt unverändert).
   In `sideData[varSide].freqmatchAdaptive.sliderEstimates` ist ein
   Eintrag mit dem Elektroden-Index als Key vorhanden.
5. **„Test abbrechen", auf Mode-Dropdown „Adaptiv" wechseln.** Erwartet:
   beide Optionen weiterhin aktiv (kein Lauf vorhanden).
6. **„Test starten" im adaptiv-Modus.** Erwartet: **kein** Empfehlungs-
   Dialog, weil schon eine Slider-Schätzung vorhanden ist; Kopfhörer-Check
   erscheint direkt.
7. **Kopfhörer-Check abbrechen, Tabletest-Daten löschen
   (`sideData[varSide].freqmatchAdaptive.sliderEstimates = {}`).** Auf
   „Test starten" klicken. Erwartet: Empfehlungs-Dialog erscheint mit
   den drei Buttons.
8. **„Erst Slider-Schätzung" klicken.** Erwartet: Dropdown schaltet auf
   „Vor-Schätzung (Slider)", Test-Block zeigt Slider-UI, keine
   automatische Test-Start-Aktion.
9. **„Direkt adaptiv starten" im Dialog.** Erwartet: Dialog schließt,
   Kopfhörer-Check erscheint, dann adaptiver Test wie gewohnt.
10. **Adaptiven Test einmal abschließen (oder simulieren mit dem Debug-
    Knopf, falls verfügbar).** Erwartet danach: Mode-Dropdown,
    „Vor-Schätzung (Slider)"-Option ist **grau (`disabled`)**.
    `runs.length >= 1` in der Konsole prüfen.
11. **Auf „Messungen löschen" im Frequenzabgleich-Ergebnis-Reiter
    klicken.** Erwartet: `runs[]` leer, Slider-Option im Dropdown wieder
    auswählbar.

---

## 14. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede der 11 Akzeptanz-Kriterien einzeln
durchgehen und für jede die folgende Selbsteinschätzung abgeben:
**erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilen-Angabe des
relevanten Code-Pfads.

Zusätzlich prüfen:
- **State-Mutation:** `_fmEnsureSliderStore` mutiert `sideData[side].freqmatchAdaptive` in-place; Aufrufer sehen die Änderungen sofort. Keine Reassignment-Falle.
- **Edge-Case Resume:** Wenn ein pausierter adaptiver Lauf vorliegt und der User wechselt auf Slider-Modus — geht das überhaupt? Lt. `fmSetMode` (`if (fmRunning) return`) ist Mode-Wechsel während Test gesperrt. Pausiert ist `fmRunning === false`, also Wechsel möglich. `fmUpdateSliderModeAvail` sperrt jedoch slider, sobald `runs.length >= 1`. Konsistent? Bitte prüfen.
- **i18n-Anführungszeichen:** Jeder neue String in `i18n/de.js` hat gerade Anzahl `"`. Keine inneren ungeschnürten ASCII-`"`.
- **Schwellen-Konstanten:** in dieser Anleitung gibt es nur eine Schwelle (`runs.length >= 1` für die Sperre). Keine zweite Schwelle versehentlich übergangen.

---

## 15. Hinweis: Übersetzungen

Englisch, Französisch und Spanisch werden in einer **eigenen späteren
Mini-Anleitung** ergänzt, sobald die deutschen UI-Texte stabil sind.
In dieser Bauanleitung **nicht** mitführen.

---

## 16. Verweis auf die nächste Bauanleitung

Nach BA 102 ist der Slider-Modus als Vor-Schätzung aktiv, schreibt seine
Werte in `sliderEstimates`. **Aber die Werte tauchen noch nicht in
Meßergebnis-Tabelle, Player und Druck auf** — das ist BA 103. Bis BA 103
gebaut ist, sieht der Nutzer die Schätzungen nur im Debug-Pfad
(Konsole, oder im laufenden Slider-Test als Slider-Stand). Das ist
beabsichtigt. Erst nach BA 103 ist die Vor-Schätzung in der UI sichtbar.

Bevor mit BA 103 angefangen wird: BA 102 vom Nutzer abnehmen lassen.
