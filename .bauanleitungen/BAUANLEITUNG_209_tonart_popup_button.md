# Bauanleitung 209 — Tonart-Popup-Button (Frequenzabgleich)

**Version**: nach Bau `3.2.209-beta`
**Vorgänger-Version**: `3.2.208.1-beta`
**Übersetzungen**: en/fr/es werden in derselben Bauanleitung mitgezogen.

## Ziel

Im Reiter Messungen → Frequenzabgleich wird die heutige Tonart-Auswahl
(Dropdown im Header, gebunden an `globalToneType`) durch einen
**Button + Popup-Dialog** ersetzt. Im Popup steht eine Radio-Liste aller
9 Tonarten, rechts neben jeder Zeile ein Play-Button, der die Tonart
mit den **aktuellen Trial-Frequenzen** des Frequenzabgleichs probehören
läßt. Unten OK/Abbruch. Bei Abbruch bleibt die vorherige Wahl erhalten.

Funktional getrennt von der globalen Tonart der anderen Tests:

- Neue State-Variable `toneType_freqmatch` (Default `pulsedComplex`),
  vollständig persistiert in JSON-Datei und localStorage.
- Bestehender `globalToneType` bleibt unverändert und bedient weiterhin
  Elektrodenlautstärke und Stereo-Balance — beide Tests werden später
  mit ihrer testUI-Migration (BA-Plan Schritt 3 + 4) auf eigene Felder
  umgestellt; bis dahin laufen sie unverändert.

Die UI-Komponente wird **generisch in `js/test-ui.js`** angelegt, damit
sie später ohne erneutes Bauen für die anderen Testreiter wiederverwendet
werden kann. Frequenzabgleich liefert per Callback die Probehör-Sequenz
(zwei Tonschritte mit jeweils 500 ms Dauer und einer 300 ms Pause
dazwischen, Pan-Werte −1/+1).

Probehör-Sequenz im Frequenzabgleich:

- **Vor Test (kein laufender Test):** 500 ms 1 kHz Pan −1 → 300 ms
  Pause → 500 ms 1 kHz Pan +1.
- **Während Test (Slider Round oder Adaptiv):** die exakten
  Trial-Frequenzen der aktuellen Iteration auf der linken (Pan −1) und
  rechten (Pan +1) Seite, jeweils 500 ms; Pause 300 ms.

Während laufendem Test bleibt der Button erreichbar (keine Sperre);
Audio-Kollisionen mit kurzen Trial-Tönen sind in Kauf genommen — siehe
Konzept.

## Reihenfolge der Schritte

1. Versionsnummer bumpen (`js/version.js`).
2. Neue State-Variable `toneType_freqmatch` in `js/state-side.js`.
3. Generischer Baustein `tonePopupButton` in `js/test-ui.js`
   (Header-Block + Modal-Dialog).
4. FreqMatch-Config in `js/freqmatch.js` umstellen
   (`toneType: false` und neuer `tonePopupButton`-Block).
5. Audio-Pfad: `globalToneType` durch `toneType_freqmatch` ersetzen
   in `js/freqmatch.js` (3 Stellen) und `js/freqmatch-adaptive.js`
   (1 Stelle).
6. Save/Load + Reset in `js/file.js`.
7. Auto-Save/Auto-Restore in `js/init.js`.
8. Druckpfad in `js/print-md.js` anpassen.
9. Neue i18n-Strings in `i18n/de.js`.
10. Übersetzungen `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`.
11. Spec-Update in `docs/spec/02-messung.md` und
    `docs/spec/00-testui-architektur.md`.
12. Selbstprüfung gegen Akzeptanztest-Checkliste.

## Schritt 1 — Versionsnummer bumpen

`js/version.js` komplett ersetzen durch:

```js
const APP_VERSION = "3.2.209-beta";
```

## Schritt 2 — Neue State-Variable

In `js/state-side.js` direkt NACH der Zeile
`let globalToneType = "complex"; ...` (Zeile 694) einfügen:

```js
// BA 209: Tonart speziell für Frequenzabgleich. Separat von globalToneType,
// das weiterhin für Elektrodenlautstärke und Stereo-Balance gilt.
// Default 'pulsedComplex' (Komplexton gepulst).
let toneType_freqmatch = "pulsedComplex";
```

## Schritt 3 — Generischer Baustein in test-ui.js

### 3a. Header-Block

In `js/test-ui.js` direkt NACH dem `if (showTarget) { ... }`-Block,
also direkt VOR `if (rowSequence.children.length) headerBox.appendChild(rowSequence);`
(etwa Zeile 945) folgenden Block einfügen — der Button kommt in
dieselbe `rowSequence`-Reihe wie die Sequenz-Auswahl, damit das
Layout nicht aufreißt:

```js
// BA 209: Tonart-Popup-Button (generisch, optional pro Verfahren).
var tonePopupBtn = null;
if (hc.tonePopupButton) {
  var tpCfg = hc.tonePopupButton;
  var cgTP = _mkEl('div', 'control-group');
  var lblTP = _mkEl('label'); _tEl(lblTP, 'toneTypeLbl');
  tonePopupBtn = _mkEl('button', 'btn btn-small');
  tonePopupBtn.type = 'button';

  // Beschriftung: nur die aktuelle Tonart, das Label-Prefix sitzt im
  // <label> davor (genau wie bei den Selects: 'Tonart: <Komplexton>').
  function _tpUpdateLabel() {
    var key = _toneTypeKey(tpCfg.getToneType());
    tonePopupBtn.dataset.t = key;
    if (typeof t === 'function') tonePopupBtn.textContent = t(key);
  }
  cgTP.append(lblTP, tonePopupBtn);
  rowSequence.appendChild(cgTP);

  tonePopupBtn.addEventListener('click', function() {
    _openToneTypeDialog(tpCfg, _tpUpdateLabel);
  });

  _tpUpdateLabel();
  headerRefs.tonePopupBtn = tonePopupBtn;
  headerRefs.tonePopupUpdate = _tpUpdateLabel;
}
```

Direkt VOR dem Header-Block oben (vor Zeile 870, in der Nähe der
anderen kleinen Helfer am Dateianfang) eine Hilfsfunktion einfügen,
die einen Tonart-Key auf seinen i18n-Schlüssel mappt:

```js
// BA 209: Mapping Tonart -> i18n-Schlüssel.
function _toneTypeKey(tt) {
  var map = {
    sine: 'toneSine', complex: 'toneComplex',
    pulsedComplex: 'tonePulsedComplex', noise: 'toneNoise',
    noiseAdaptive: 'toneNoiseAdaptive', amSine: 'toneAmSine',
    warbleSine: 'toneWarbleSine', burstSine: 'toneBurstSine',
    wobbleSweep: 'toneWobbleSweep'
  };
  return map[tt] || 'toneComplex';
}
```

### 3b. Modal-Dialog

In `js/test-ui.js` an passender Stelle (z.B. direkt nach
`_openElectrodeSelectionDialog`, suchen mit grep auf
`function _openElectrodeSelectionDialog`) folgende Hilfsfunktion
einfügen:

```js
// BA 209: Modal-Dialog 'Tonart wählen'.
// cfg: {
//   getToneType:        () => string             - aktuelle Tonart
//   setToneType:        (tt: string) => void     - bei OK gespeicherte Tonart setzen
//   getVolume:          () => number             - Lautstärke (linear, 0..1) für Vorschau
//   getPreviewSequence: () => Array<Step>        - Probehör-Sequenz, siehe unten
// }
// Step: { hz: number, pan: number, durationMs: number } | { pauseMs: number }
function _openToneTypeDialog(cfg, onChange) {
  var TONE_TYPES = [
    ['sine',          'toneSine'],
    ['complex',       'toneComplex'],
    ['pulsedComplex', 'tonePulsedComplex'],
    ['noise',         'toneNoise'],
    ['noiseAdaptive', 'toneNoiseAdaptive'],
    ['amSine',        'toneAmSine'],
    ['warbleSine',    'toneWarbleSine'],
    ['burstSine',     'toneBurstSine'],
    ['wobbleSweep',   'toneWobbleSweep']
  ];
  var initial = cfg.getToneType();
  var selected = initial;
  var playing = false;

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  var dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:360px;max-width:90vw;max-height:85vh;' +
    'overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.3);';

  var title = document.createElement('h3');
  title.dataset.t = 'tonePopupTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  var hint = document.createElement('p');
  hint.dataset.t = 'tonePopupHint';
  hint.style.cssText =
    'margin:0 0 14px 0;font-size:.92em;line-height:1.35;' +
    'background:#fff4d6;border-left:3px solid #d8a200;' +
    'padding:8px 10px;border-radius:4px;';
  dlg.appendChild(hint);

  // Liste: pro Zeile ein Radio + Label + Play-Button.
  var list = document.createElement('div');
  list.style.cssText = 'display:grid;grid-template-columns:auto 1fr auto;' +
                      'gap:4px 10px;align-items:center;margin-bottom:14px;';
  var rbRefs = {};
  TONE_TYPES.forEach(function(pair) {
    var key = pair[0], i18nKey = pair[1];
    var rb = document.createElement('input');
    rb.type = 'radio';
    rb.name = 'tonePopupChoice';
    rb.value = key;
    rb.checked = (key === initial);
    rb.id = 'tonePopupRb_' + key;
    rbRefs[key] = rb;

    var lbl = document.createElement('label');
    lbl.htmlFor = rb.id;
    lbl.dataset.t = i18nKey;
    lbl.style.cssText = 'cursor:pointer;font-size:.94em;';

    var play = document.createElement('button');
    play.type = 'button';
    play.className = 'btn btn-small';
    play.dataset.t = 'tonePopupPlay';
    play.dataset.toneKey = key;
    play.style.cssText = 'min-width:90px;';

    rb.addEventListener('change', function() {
      if (rb.checked) selected = key;
    });
    play.addEventListener('click', function() {
      if (playing) return;
      // Bei Klick auf Play wird die Zeile auch automatisch markiert.
      rb.checked = true;
      selected = key;
      _playPreview(key);
    });

    list.append(rb, lbl, play);
  });
  dlg.appendChild(list);

  // Probehör-Logik: spielt die per cfg.getPreviewSequence() gelieferten
  // Steps mit der gewählten Tonart hintereinander ab. Während des
  // Abspielens sind alle Play-Buttons disabled, damit sich nichts
  // überlappt.
  function _playPreview(toneType) {
    var seq = cfg.getPreviewSequence();
    if (!Array.isArray(seq) || seq.length === 0) return;
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;
    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setPlayButtonsDisabled(true);

    var idx = 0;
    function nextStep() {
      if (idx >= seq.length) {
        playing = false;
        _setPlayButtonsDisabled(false);
        return;
      }
      var step = seq[idx++];
      if (step && typeof step.pauseMs === 'number') {
        setTimeout(nextStep, step.pauseMs);
        return;
      }
      if (!step || typeof step.hz !== 'number' || typeof step.durationMs !== 'number') {
        nextStep();
        return;
      }
      var pan = (typeof step.pan === 'number') ? step.pan : 0;
      try {
        playToneTyped(c, step.hz, vol, step.durationMs, pan, toneType);
      } catch (e) { /* swallow, weiter geht's */ }
      setTimeout(nextStep, step.durationMs);
    }
    nextStep();
  }
  function _setPlayButtonsDisabled(flag) {
    var btns = list.querySelectorAll('button[data-tone-key]');
    btns.forEach(function(b) { b.disabled = flag; });
  }

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.dataset.t = 'tonePopupCancel';
  var okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.dataset.t = 'tonePopupOk';
  btnRow.append(cancelBtn, okBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  if (typeof applyLang === 'function') applyLang();

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  cancelBtn.addEventListener('click', close);
  okBtn.addEventListener('click', function() {
    if (selected !== initial) {
      cfg.setToneType(selected);
      if (typeof onChange === 'function') onChange();
    }
    close();
  });
}
```

> **Hinweis für Sonnet:** `playToneTyped` und `gAC` sind globale
> Funktionen aus `js/audio.js` und sollten zur Laufzeit verfügbar
> sein, wenn die test-ui geladen ist. Kein zusätzlicher Import nötig.

## Schritt 4 — FreqMatch-Config umstellen

In `js/freqmatch.js` in `fmCfg.header.common` (Zeile 1081 ff.) den
`toneType`-Eintrag auf `false` setzen und direkt darunter einen neuen
`tonePopupButton`-Block einfügen.

**Vorher** (Zeile 1086):

```js
toneType:     { show: true, source: 'global' },
```

**Nachher**:

```js
// BA 209: Tonart-Dropdown durch tonePopupButton ersetzt.
toneType:     false,
tonePopupButton: {
  getToneType: function() { return toneType_freqmatch; },
  setToneType: function(tt) { toneType_freqmatch = tt; },
  getVolume:   function() { return fmGVol(); },
  getPreviewSequence: function() {
    var hzLeft = 1000, hzRight = 1000;
    if (fmRunning && fmCurrentEl != null) {
      if (fmSymmetric) {
        var baseL = withSide('left',  function() { return effFreq(fmCurrentEl); });
        var baseR = withSide('right', function() { return effFreq(fmCurrentEl); });
        hzLeft  = baseL * Math.pow(2, -fmCentOffset / 2 / 1200);
        hzRight = baseR * Math.pow(2, +fmCentOffset / 2 / 1200);
      } else {
        var varHz = fmVarHz(fmCurrentEl);
        var refHz = fmFreqFromCents(varHz, fmCentOffset);
        if (fmVarSide === 'left') { hzLeft = varHz; hzRight = refHz; }
        else                       { hzLeft = refHz; hzRight = varHz; }
      }
    } else if (fmAdaptiveActive && fmCurTrackId != null
               && fmTracks && fmTracks[fmCurTrackId]) {
      var tr = fmTracks[fmCurTrackId];
      if (fmSymmetric) {
        var bL = withSide('left',  function() { return effFreq(tr.electrodeIdx); });
        var bR = withSide('right', function() { return effFreq(tr.electrodeIdx); });
        var half = tr.currentOffset / 2;
        hzLeft  = bL * Math.pow(2, -half / 1200);
        hzRight = bR * Math.pow(2, +half / 1200);
      } else {
        var elHz = withSide(fmVarSide, function() { return effFreq(tr.electrodeIdx); });
        var refHz2 = elHz * Math.pow(2, tr.currentOffset / 1200);
        if (fmVarSide === 'left') { hzLeft = elHz;   hzRight = refHz2; }
        else                       { hzLeft = refHz2; hzRight = elHz;   }
      }
    }
    return [
      { hz: hzLeft,  pan: -1, durationMs: 500 },
      { pauseMs: 300 },
      { hz: hzRight, pan:  1, durationMs: 500 }
    ];
  }
},
```

> **Edge-Case-Hinweis (für Sonnet):** Der Callback `getPreviewSequence`
> wird auch aufgerufen, wenn weder `fmRunning` noch `fmAdaptiveActive`
> aktiv ist und kein `fmCurrentEl`/`fmCurTrackId` gesetzt ist — dann
> bleiben `hzLeft`/`hzRight` auf 1000 (Default). Kein Fallback weiter
> nötig.

## Schritt 5 — Audio-Pfad umstellen

In `js/freqmatch.js` an den drei Stellen mit `globalToneType` den Wert
durch `toneType_freqmatch` ersetzen:

- Zeile 451:
  ```js
  return playToneTyped(c, hz, effectiveVol, ms, pan, toneType_freqmatch);
  ```
- Zeile 552/553:
  ```js
  playToneTyped(c, refHz, refVol, ms, refPan, toneType_freqmatch),
  playToneTyped(c, varHz, varVol, ms, varPan, toneType_freqmatch)
  ```
- Zeile 595/596:
  ```js
  playToneTyped(c, refHz, refVol, ms, refPan, toneType_freqmatch),
  playToneTyped(c, varHz, varVol, ms, varPan, toneType_freqmatch)
  ```

In `js/freqmatch-adaptive.js` an Zeile 345:

```js
return playToneTyped(c, hz, effVol, ms, pan, toneType_freqmatch);
```

## Schritt 6 — Save/Load + Reset in file.js

### 6a. Reset (resetAll-Funktion)

In `js/file.js` in der Nähe von
`if (typeof globalToneType !== "undefined") globalToneType = "complex";`
(Zeile 63) direkt darunter ergänzen:

```js
if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = "pulsedComplex";
```

### 6b. Save (saveJson, Top-Level-Objekt)

In `js/file.js` im Objekt `d` direkt nach
`globalToneType: globalToneType,` (Zeile 282) ergänzen:

```js
toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
  ? toneType_freqmatch : "pulsedComplex",
```

### 6c. Load (loadJson)

In `js/file.js` direkt nach dem Block

```js
globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
  ? d.globalToneType : "complex";
```

(Zeile 591/592) folgenden Block einfügen:

```js
// BA 209: Per-Test-Tonart Frequenzabgleich.
// Migration: Bei alter Datei ohne dieses Feld den vorhandenen
// globalToneType-Wert übernehmen (User hatte ihn bewußt gewählt);
// nur bei völlig fehlendem Wert auf Default 'pulsedComplex' fallen.
if (typeof toneType_freqmatch !== "undefined") {
  if (VALID_TONE_TYPES.includes(d.toneType_freqmatch)) {
    toneType_freqmatch = d.toneType_freqmatch;
  } else if (VALID_TONE_TYPES.includes(d.globalToneType)) {
    toneType_freqmatch = d.globalToneType;
  } else {
    toneType_freqmatch = "pulsedComplex";
  }
}
```

## Schritt 7 — Auto-Save/Auto-Restore in init.js

### 7a. Auto-Restore

In `js/init.js` direkt nach
`if (d.globalToneType) globalToneType = d.globalToneType;` (Zeile 757)
ergänzen:

```js
// BA 209: Per-Test-Tonart Frequenzabgleich (Auto-Restore).
const _VALID_TT = ["sine", "complex", "pulsedComplex", "noise",
  "noiseAdaptive", "amSine", "warbleSine", "burstSine", "wobbleSweep"];
if (typeof toneType_freqmatch !== "undefined") {
  if (_VALID_TT.includes(d.toneType_freqmatch)) {
    toneType_freqmatch = d.toneType_freqmatch;
  } else if (_VALID_TT.includes(d.globalToneType)) {
    toneType_freqmatch = d.globalToneType;
  }
}
```

### 7b. Auto-Save

In `js/init.js` im Auto-Save-Objekt direkt nach
`globalToneType: globalToneType,` (Zeile 940) ergänzen:

```js
toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
  ? toneType_freqmatch : "pulsedComplex",
```

## Schritt 8 — Druckpfad anpassen

Der Frequenzabgleich-Ausdruck soll die FreqMatch-eigene Tonart zeigen,
nicht den globalen Wert. `_collectGlobalTest()` bleibt für die anderen
Tests unverändert; wir ergänzen nur das FreqMatch-Sammeln.

Suche in `js/print-md.js` per grep nach `_collectFreqmatch` oder
`fmRes`/`freqmatchData`-Sammler. Falls ein dedizierter FreqMatch-
Sammler existiert und ein eigenes `toneType`-Feld ausweist, dort
`globalToneType` durch `toneType_freqmatch` ersetzen. Falls **kein**
eigener FreqMatch-Sammler vorhanden ist (Stand BA 208), ist hier
**kein Edit nötig** — `_collectGlobalTest()` bleibt auf
`globalToneType` und wird im Ausdruck als Tonart von Test 1 und Test 2
ausgewiesen. Frequenzabgleich-Ausdruck bekommt die spezifische Tonart
mit einer Folge-BA, wenn der Druck dort eine eigene Tonart-Zeile
braucht.

> **Selbstprüfung für Sonnet:** Wenn nach grep nicht klar ist, ob ein
> FreqMatch-Druckpfad existiert, im Build-Bericht ausweisen
> ("kein FreqMatch-spezifischer Druckpfad gefunden, kein Edit") —
> nicht stillschweigend annehmen.

## Schritt 9 — i18n de.js

In `i18n/de.js` in den bestehenden Block der Modal-/Popup-Strings
(z.B. unmittelbar nach den `electrodeSelection*`-Strings um Zeile
1040-1045) folgende Keys ergänzen:

```js
tonePopupTitle:  "Tonart wählen",
tonePopupHint:   "Wählen Sie den Ton für das Testverfahren aus. WICHTIG: Der gewählte Ton kann das Ergebnis des Meßverfahrens stark beeinflussen. Wenn Sie sich für einen Ton entschieden haben, bleiben Sie im Test konsequent dabei.",
tonePopupPlay:   "Vorspielen",
tonePopupOk:     "OK",
tonePopupCancel: "Abbrechen",
```

> **Quote-Check (für Sonnet):** Der Hinweistext enthält keine inneren
> ASCII-`"`-Anführungszeichen, sondern nur Worte mit Großbuchstaben.
> Vor Versand jeden String einmal auf reine `"`-Zähl-Konsistenz prüfen
> (siehe BAUANLEITUNGEN_LEITLINIEN „Anführungszeichen in i18n-Strings").

## Schritt 10 — Übersetzungen en/fr/es

Die analogen Einträge in `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`
ergänzen (in der jeweils zur de.js parallelen Sektion).

### `i18n/en.js`

```js
tonePopupTitle:  "Select tone type",
tonePopupHint:   "Select the tone for the test procedure. IMPORTANT: The chosen tone can strongly influence the result of the measurement. Once you have decided on a tone, stay with it consistently throughout the test.",
tonePopupPlay:   "Play",
tonePopupOk:     "OK",
tonePopupCancel: "Cancel",
```

### `i18n/fr.js`

```js
tonePopupTitle:  "Choisir le type de son",
tonePopupHint:   "Choisissez le son pour la procédure de test. IMPORTANT : le son choisi peut influencer fortement le résultat de la mesure. Une fois votre choix fait, conservez le même son pendant tout le test.",
tonePopupPlay:   "Écouter",
tonePopupOk:     "OK",
tonePopupCancel: "Annuler",
```

### `i18n/es.js`

```js
tonePopupTitle:  "Elegir tipo de tono",
tonePopupHint:   "Elija el tono para el procedimiento de prueba. IMPORTANTE: el tono elegido puede influir notablemente en el resultado de la medición. Una vez que se haya decidido por un tono, manténgalo de forma constante durante toda la prueba.",
tonePopupPlay:   "Reproducir",
tonePopupOk:     "Aceptar",
tonePopupCancel: "Cancelar",
```

## Schritt 11 — Spec-Update

### 11a. `docs/spec/02-messung.md`

Im Abschnitt „Globale Test-Einstellungen" (ab Zeile 11) den
Bullet-Eintrag zu Tonart ergänzen:

- Hinweis aufnehmen, daß im Frequenzabgleich seit BA 209 die Tonart
  **per Test** gewählt wird (`toneType_freqmatch`, Default
  `pulsedComplex`), via Button + Popup statt Dropdown. Die globale
  Tonart `globalToneType` (Default `complex`) gilt weiterhin für
  Elektrodenlautstärke und Stereo-Balance, bis diese auf testUI
  migriert sind.
- Auto-Vorschau-Ton (750 ms 1 kHz beim Dropdown-Wechsel) gilt nur
  noch für die alten Dropdowns; im Frequenzabgleich übernimmt das
  Popup-Probehören diese Funktion.

Im Abschnitt „Sub-Tab 3 — Frequenzabgleich (freqmatch.js)" am Anfang
einen neuen Bullet-Eintrag einfügen:

- **Tonart-Auswahl (BA 209):** Button im Header „Tonart: *Aktualwert*"
  öffnet ein Popup mit Radio-Liste aller 9 Tonarten und einer
  Play-Spalte. Probehör-Sequenz: 500 ms Pan −1 → 300 ms Pause →
  500 ms Pan +1, Frequenzen je nach Test-Status: vor Test 1 kHz
  beidseitig, während Slider-Round / Adaptiv die aktuellen
  Trial-Frequenzen (links/rechts). OK übernimmt, Abbruch verwirft.
  Auswahl persistiert in `toneType_freqmatch` (Default
  `pulsedComplex`).

### 11b. `docs/spec/00-testui-architektur.md`

In der Bausteine-Katalog-Tabelle (ab Zeile 221) eine neue Zeile für
`tonePopupButton` ergänzen:

| `tonePopupButton` | Button + Modal-Dialog für Tonart-Auswahl mit Probehör-Spalte | `getToneType`, `setToneType`, `getVolume`, `getPreviewSequence` (Callbacks) | — |

Und einen Hinweis-Abschnitt unter „Header — Aufteilung" (ab Zeile 249)
ergänzen: `tonePopupButton` ist optional in `header.common` und
ersetzt den Dropdown `toneType` (`toneType: false`), wenn pro Test
eigene Tonart-Persistenz gewünscht ist.

## Schritt 12 — Selbstprüfung

Vor Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
für jede melden: erfüllt / nicht erfüllt / unklar, mit Datei- und
Zeilenangabe der relevanten Stelle.

### Akzeptanztest-Checkliste

1. **Versionsanzeige:** Footer zeigt `3.2.209-beta`.
2. **Header-Button vorhanden:** Reiter Messungen → Frequenzabgleich
   zeigt im Header einen Button „Tonart: *Aktualwert*" statt eines
   Dropdowns. Andere Sub-Tabs (Elektrodenlautstärke, Stereo-Balance)
   zeigen weiterhin das alte Dropdown unverändert.
3. **Default beim ersten Start:** Frischer Browser (localStorage
   geleert) → Button zeigt „Tonart: Komplexton gepulst".
   Elektrodenlautstärke und Stereo-Balance: Dropdown zeigt
   „Komplexton" (globaler Default unverändert).
4. **Popup öffnet:** Klick auf den Button öffnet ein Modal mit Titel
   „Tonart wählen", Hinweistext mit gelbem Hintergrund, Radio-Liste
   aller 9 Tonarten, Play-Button pro Zeile, OK + Abbrechen unten.
5. **Probehör vor Test:** Auf eine Tonart-Zeile „Vorspielen" klicken
   → 500 ms Ton links, 300 ms Pause, 500 ms Ton rechts (beide
   1 kHz). Während Wiedergabe sind alle Play-Buttons disabled,
   danach wieder aktiv. Die Zeile wird automatisch markiert.
6. **Abbruch verwirft:** Bei geöffnetem Popup eine andere Tonart
   markieren, eventuell probehören, dann „Abbrechen" → Popup schließt,
   Button-Beschriftung bleibt unverändert, `toneType_freqmatch`
   unverändert.
7. **OK übernimmt:** Andere Tonart markieren → „OK" → Popup schließt,
   Button-Beschriftung zeigt die neue Tonart, `toneType_freqmatch`
   ist gesetzt.
8. **Trial nutzt die neue Tonart:** Test starten → die Trial-Töne
   klingen entsprechend der gewählten Tonart. Insbesondere
   funktioniert der Wechsel von Komplexton zu Sinus hörbar.
9. **Probehör während Test:** Während Slider-Round mit gespeichertem
   Trial-Status → Button öffnen → Probehör spielt Trial-Hz
   (nicht 1 kHz). Bei adaptivem Lauf analog.
10. **Persistenz JSON:** Wahl `pulsedComplex` → Sinus, Speichern,
    Tab schließen, Datei laden → `toneType_freqmatch` ist `sine`.
    Globale Tonart der anderen Tests bleibt vom Wechsel unberührt.
11. **Persistenz localStorage:** Wahl ändern, Browser-Reload ohne
    Datei-Laden → Frequenzabgleich-Button zeigt die zuletzt
    gewählte Tonart.
12. **Migration alter Daten:** Datei aus 3.2.208 laden, in der nur
    `globalToneType: "amSine"` steht → nach dem Laden ist
    `toneType_freqmatch` ebenfalls auf `amSine` (Migration aus
    `globalToneType`).
13. **i18n vier Sprachen:** Sprache auf en/fr/es wechseln → Popup-
    Titel, Hinweistext, Play-Button-Beschriftung, OK, Abbrechen
    sind übersetzt. Button-Beschriftung im Header zeigt die übersetzte
    Tonart.
14. **Spec aktualisiert:** `docs/spec/02-messung.md` und
    `docs/spec/00-testui-architektur.md` enthalten die in Schritt 11
    beschriebenen Ergänzungen.

### Nach-Build-Hinweise

- Keine Folge-BA für Übersetzungen nötig — en/fr/es sind in dieser BA
  enthalten.
- Migration von test.js und lr-balance.js auf eigene Tonart-Felder
  (`toneType_test`, `toneType_balance`) folgt mit deren testUI-
  Migration (BA-Plan Schritt 3 + 4 in
  `docs/spec/00-testui-architektur.md`). Bis dahin bleibt
  `globalToneType` aktiv für diese beiden Tests.
