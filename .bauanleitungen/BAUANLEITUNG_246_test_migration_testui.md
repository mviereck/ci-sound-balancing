# Bauanleitung 246 — testUI-API-Vorbereitung für Elektrodenlautstärke-Migration

## Ziel

Vor der eigentlichen Migration von `js/test.js` auf die neue testUI-API
(BA 247) werden hier die kleinen, mechanischen Voraussetzungen
geschaffen:

1. testUI-API: `swap`-Action akzeptiert optional einen `labelKey`,
   damit Elektrodenlautstärke „A↔B" rendern kann (Stereo-Balance
   nutzt weiterhin den Default „L↔R")
2. testUI-API: der historische `lsHint`-Block aus `_buildTestPanelNew`
   wird entfernt — er ist tot (kein Aufrufer der neuen API nutzt ihn)
   und würde nach der Migration als zweiter, unsichtbarer Hinweis-Container
   neben dem `rangeHint` im Test-Reiter Elektrodenlautstärke entstehen
3. State + Persistenz: neue Variable `toneType_test` in
   `js/state-side.js` und ihr Save/Load-Pfad in `js/file.js`

**Es gibt keine sichtbare Verhaltensänderung.** Alle vier Sub-Reiter
(Elektrodenlautstärke, Stereo-Balance, Frequenzabgleich, Latenz)
funktionieren wie heute. Der Akzeptanztest am Ende verifiziert genau
das.

## Voraussetzungen

- aktuelle Version vor dem Bau: `3.2.245.3-beta`
  (`js/version.js`)
- i18n: nur Deutsch

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.245.3-beta";

// nachher
const APP_VERSION = "3.2.246-beta";
```

## Schritt 2 — testUI-API: swap-Action mit optionalem labelKey

`actions`-Eintrag `'swap'` rendert heute den Button hart mit
`btnSwapLR` (Stereo-Balance). Für Elektrodenlautstärke (kommt in
BA 247) wird `btnSwapAB` gebraucht. Lösung: ein Eintrag im
`actions`-Array darf entweder ein String (Default-Beschriftung) oder
ein Objekt `{ kind, labelKey }` sein.

`js/test-ui.js` — im Abschnitt, der die Actions im Verfahren-Body
auflöst (Stelle: Schleife über `body.actions`, etwa Z. 1438–1481).

**Suche**:

```js
      body.actions.forEach(function(act) {
        var btn = _mkEl('button', 'btn btn-sm');
        btn.type = 'button';
        btn.dataset.action = act;
        if (act === 'undo') {
```

**Ersetze durch**:

```js
      body.actions.forEach(function(actSpec) {
        // BA 246: Eintrag darf String oder { kind, labelKey } sein.
        var act      = (typeof actSpec === 'string') ? actSpec : actSpec.kind;
        var labelKey = (typeof actSpec === 'string') ? null    : actSpec.labelKey;
        var btn = _mkEl('button', 'btn btn-sm');
        btn.type = 'button';
        btn.dataset.action = act;
        if (act === 'undo') {
```

Im `swap`-Zweig (etwa Z. 1473–1478) den hartkodierten Key durch
einen Fallback auf `labelKey` ersetzen.

**Suche**:

```js
        } else if (act === 'swap') {
          btn.innerHTML = '&#x21C4; <span data-t="btnSwapLR"></span> <span class="kbd">S</span>';
          actRefs.swap = btn;
          if (vCfg.hooks && vCfg.hooks.onSwap) {
            btn.addEventListener('click', function() { vCfg.hooks.onSwap(); });
          }
        }
```

**Ersetze durch**:

```js
        } else if (act === 'swap') {
          // BA 246: labelKey ueberschreibt Default btnSwapLR.
          var swapKey = labelKey || 'btnSwapLR';
          btn.innerHTML = '&#x21C4; <span data-t="' + swapKey + '"></span> <span class="kbd">S</span>';
          actRefs.swap = btn;
          if (vCfg.hooks && vCfg.hooks.onSwap) {
            btn.addEventListener('click', function() { vCfg.hooks.onSwap(); });
          }
        }
```

Kein anderer `actions`-Eintrag braucht den `labelKey` heute; sie
fallen durch den Fallback (`labelKey = null`) wie bisher auf ihre
Default-Beschriftungen zurück.

## Schritt 3 — testUI-API: lsHint-Block aus _buildTestPanelNew entfernen

Im Slider-Baustein der neuen API entstehen heute für `unit: 'dB'`
parallel zwei Hinweis-Container: der historische `lsHint`-Block
(BA 61) und der generische `rangeHint` (BA 219). Kein Aufrufer der
neuen API nutzt den `lsHint`-Block; auch nach BA 247 nutzt ihn
niemand mehr. Er wird ersatzlos entfernt.

`js/test-ui.js` — im Slider-Baustein-Block von `_buildTestPanelNew`.

**Suche** (etwa Z. 1309–1319):

```js
      // LS-Hint nur bei dB-Slider (cent-Slider braucht ihn nicht)
      var lsHint = null, lsHintBand = null, lsHintMark = null, lsHintLabel2 = null;
      if (slUnit === 'dB') {
        lsHint = _mkEl('div', 'ls-hint');
        lsHint.style.display = 'none';
        lsHintBand = _mkEl('div', 'ls-hint-band');
        lsHintMark = _mkEl('div', 'ls-hint-mark');
        lsHintLabel2 = _mkEl('div', 'ls-hint-label');
        lsHint.append(lsHintBand, lsHintMark, lsHintLabel2);
        slWrap.appendChild(lsHint);
      }
```

**Ersatzlos löschen** (kompletten Block).

Im `refs.slider`-Objekt etwas weiter unten (etwa Z. 1340–1349) die
zugehörigen Felder entfernen.

**Suche**:

```js
      refs.slider = {
        input: slInput,
        lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel2,
        rangeHint: rangeHint, rangeHintBand: rangeHintBand,
        rangeHintMark: rangeHintMark, rangeHintLabel: rangeHintLabel,
        unit: slUnit,
        initialRange: slInitialRange,
        maxRange: slMaxRange,
        rangeIdx: 0
      };
```

**Ersetze durch**:

```js
      refs.slider = {
        input: slInput,
        rangeHint: rangeHint, rangeHintBand: rangeHintBand,
        rangeHintMark: rangeHintMark, rangeHintLabel: rangeHintLabel,
        unit: slUnit,
        initialRange: slInitialRange,
        maxRange: slMaxRange,
        rangeIdx: 0
      };
```

Vor dem Commit verifizieren, daß in der **neuen** API kein Aufrufer
auf `refs.slider.lsHint*` zugreift:

```
grep -n "\.lsHint" js/test-ui.js js/freqmatch.js js/lr-balance.js js/latency.js
```

Erwartung: Treffer ausschließlich innerhalb von `_buildTestPanelOld`
(alte API, Z. 504–510, 656). Wenn doch ein Treffer in den neuen
API-Modulen auftaucht: nicht löschen, melden.

## Schritt 4 — State: toneType_test in state-side.js

`js/state-side.js`, in der Nähe von `toneType_freqmatch`
(etwa Z. 697):

**Suche**:

```js
let toneType_freqmatch = "richCiHF";
```

**Direkt danach einfügen**:

```js
// BA 246: Tonart speziell fuer Elektrodenlautstaerke. Eigene Persistenz
// statt globalToneType, damit Tonart-Popup-Dialog (analog freqmatch)
// pro Test funktioniert. Wird in BA 247 erstmals aus dem testUI-Header
// gelesen/geschrieben.
let toneType_test = "richCiHF";
```

## Schritt 5 — Persistenz: toneType_test in file.js

`js/file.js`, im Reset-Block (etwa Z. 58–62):

**Suche**:

```js
  slTarget_test = "balance";
  slTarget_balance = "both";
```

**Ersetze durch**:

```js
  slTarget_test = "balance";
  slTarget_balance = "both";
  // BA 246
  if (typeof toneType_test !== "undefined") toneType_test = "richCiHF";
```

Im Save-Objekt (etwa Z. 285–286), direkt nach `toneType_freqmatch`:

**Suche**:

```js
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : "richCiHF",
```

**Direkt danach einfügen**:

```js
    // BA 246
    toneType_test: (typeof toneType_test !== "undefined")
      ? toneType_test : "richCiHF",
```

Im Load-Block, direkt nach dem `toneType_freqmatch`-Load (etwa
Z. 605–612):

**Suche**:

```js
  if (typeof toneType_freqmatch !== "undefined") {
    if (isValidToneType(d.toneType_freqmatch)) {
      toneType_freqmatch = d.toneType_freqmatch;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_freqmatch = d.globalToneType;
    } else {
      toneType_freqmatch = "richCiHF";
    }
  }
```

**Direkt danach einfügen**:

```js
  // BA 246
  if (typeof toneType_test !== "undefined") {
    if (isValidToneType(d.toneType_test)) {
      toneType_test = d.toneType_test;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_test = d.globalToneType;
    } else {
      toneType_test = "richCiHF";
    }
  }
```

## Schritt 6 — Akzeptanztest

Diese BA macht keine sichtbaren Verhaltensänderungen. Der Akzeptanz-
test besteht im Wesentlichen aus „nichts darf brechen".

1. **Anwendung lädt ohne Konsolen-Fehler**
   Browser-Cache leeren, Anwendung neu laden. Erwartet: kein
   `Uncaught …` in der Browser-Konsole, alle Tabs sichtbar.

2. **Alle vier Sub-Reiter unter „Messungen" öffnen**
   Elektrodenlautstärke, Stereo-Balance, Frequenzabgleich, Latenz
   einzeln öffnen. Jeder Reiter zeigt seine bisherigen Voreinstellungen
   und Erklär-Texte ohne Layoutbruch.

3. **Stereo-Balance: Swap-Button-Beschriftung unverändert**
   Sub-Tab Stereo-Balance öffnen, Test starten. Der Swap-Button im
   Body trägt weiterhin „L↔R" (Default-Beschriftung). Klick auf S
   bzw. den Button funktioniert wie bisher.

4. **Elektrodenlautstärke: Test läuft wie heute**
   Sub-Tab Elektrodenlautstärke öffnen, Test starten (Modus
   „Round Robin"). Ein Paar bestätigen, dann pausieren. Erwartet:
   Verhalten unverändert, weil `test.js` in dieser BA noch nicht
   migriert ist.

5. **`lsHint`-DOM nicht mehr im Slider-Wrap der neuen API**
   Browser-DevTools öffnen, Sub-Tab Stereo-Balance (nutzt neue API,
   `unit: 'dB'`). Test starten. Im Slider-Bereich nach
   `<div class="ls-hint">` suchen — Erwartet: **nicht vorhanden**.
   `<div class="fm-range-hint">` (rangeHint) ist weiterhin da, ist
   aber im Stereo-Balance-Test ohnehin nicht aktiviert
   (`rangeHint: true` wird dort nicht gesetzt).
   Gegenprüfung Sub-Tab Elektrodenlautstärke (nutzt noch alte API):
   dort ist `<div class="ls-hint">` weiterhin im DOM, weil
   `_buildTestPanelOld` unverändert bleibt.

6. **State + Persistenz: `toneType_test` wird in Datei geschrieben**
   Anwendung neu laden (frischer State). Datei speichern. Die
   geschriebene JSON-Datei in einem Editor öffnen und nach
   `toneType_test` suchen. Erwartet: ein Eintrag `"toneType_test":
   "richCiHF"` (oder der aktuelle Default). Datei neu laden:
   keine JS-Fehler.

7. **Versions-Anzeige**
   Im Setup-Reiter (oder wo immer die Version im UI sichtbar ist)
   steht `3.2.246-beta`.

## Schritt 7 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–7
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Zwei zusätzliche Pflicht-Checks vor Build-Abschluß:

- **Kein Aufrufer von `refs.slider.lsHint*` in neuer API**: per
  ```
  grep -rn "\.lsHint" js/
  ```
  Treffer ausschließlich innerhalb `_buildTestPanelOld` in
  `js/test-ui.js` (alte API). Wenn ein Treffer in `freqmatch.js`,
  `lr-balance.js`, `latency.js` oder `_buildTestPanelNew` auftaucht:
  melden, nicht löschen.
- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.246-beta`.

## Folge-BAs

- **BA 247** baut auf dieser BA auf und migriert `js/test.js`
  vollständig auf die neue testUI-API
- **BA 248** entfernt anschließend `_buildTestPanelOld` und räumt
  tote i18n-Keys und Doku-Reste auf
