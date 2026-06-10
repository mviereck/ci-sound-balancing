# Bauanleitung 250 — Elektrodenlautstärke: Lautstärke / Tondauer / Tonpause in Tonart-Modalbox

## Ziel

Im Elektrodenlautstärke-Test (Sub-Tab unter „Messungen") wandern die
drei Eingabefelder **Lautstärke**, **Tondauer**, **Tonpause** aus der
Voreinstellungs-Zeile in die Tonart-Modalbox. Das Tonart-Popup hat seit
BA 209 bereits einen Block für diese drei Felder (`tone-popup.js`
Z. 327–347, Hooks `getVolumePercent`/`setVolumePercent` usw.) — heute
nutzt ihn nur der Elektrodenlautstärke-Test nicht; freqmatch macht es
seit BA 240 schon so.

Verhalten nach BA 250:

- Voreinstellungs-Zeile zeigt: Tonart-Button, Sequenz, Sliderziel,
  Elektroden-Auswahl, Start-/Stop-Button. **Keine** Lautstärke/Tondauer/
  Tonpause mehr im Header.
- Klick auf den Tonart-Button öffnet das Popup. Darin: Tonart-Auswahl
  (wie heute) **und** die drei Eingabefelder Lautstärke (%), Tondauer
  (ms), Tonpause (ms).
- Die Werte überleben Reload (persistiert via `file.js`-Save/Load),
  analog `toneType_test`.
- Die anderen drei Sub-Reiter (Stereo-Balance, Frequenzabgleich,
  Latenz) bleiben **unverändert** — sie behalten ihr aktuelles
  Header-Layout.

## Voraussetzungen

- BA 248 und BA 249 sind gebaut und abgenommen
- aktuelle Version vor dem Bau: `3.2.249-beta`
- i18n: nur Deutsch. Die drei Modalbox-Keys `tonePopupVolume`,
  `tonePopupDuration`, `tonePopupPause` existieren bereits seit BA 209
  in `i18n/de.js` (Z. 1128–1130) und werden nur referenziert, nicht
  neu geschrieben.

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.249-beta";

// nachher
const APP_VERSION = "3.2.250-beta";
```

## Schritt 2 — State: `volume_test`/`duration_test`/`pause_test`

`js/state-side.js`. Die freqmatch-Defaults sitzen bereits in
Z. 705–707 (BA 240). Analog für den Test ergänzen.

**Suche**:

```js
// BA 240: Vol/Dur/Pau leben jetzt als State-Variablen statt im testUI-Header.
// Vol als int 0..100 (UI-Wert); fmGVol macht die quadratische Audio-Konversion.
let volume_freqmatch   = 75;
let duration_freqmatch = 750;
let pause_freqmatch    = 400;
```

**Direkt danach einfügen**:

```js
// BA 250: Vol/Dur/Pau fuer Elektrodenlautstaerke. Analog zu freqmatch
// als State-Variablen statt im testUI-Header. Vol als int 0..100;
// tGVol macht die quadratische Audio-Konversion.
let volume_test   = 75;
let duration_test = 750;
let pause_test    = 300;
```

## Schritt 3 — Persistenz: `js/file.js`

### 3a — Reset auf Defaults

`js/file.js`, im Reset-Block (etwa Z. 58–64, dort wo
`toneType_test = "richCiHF"` steht).

**Suche**:

```js
  // BA 246
  if (typeof toneType_test !== "undefined") toneType_test = "richCiHF";
```

**Direkt danach einfügen**:

```js
  // BA 250
  if (typeof volume_test   !== "undefined") volume_test   = 75;
  if (typeof duration_test !== "undefined") duration_test = 750;
  if (typeof pause_test    !== "undefined") pause_test    = 300;
```

### 3b — Save-Objekt

`js/file.js`, im Save-Objekt (etwa Z. 285–290, direkt nach
`toneType_test`).

**Suche**:

```js
    // BA 246
    toneType_test: (typeof toneType_test !== "undefined")
      ? toneType_test : "richCiHF",
```

**Direkt danach einfügen**:

```js
    // BA 250
    volume_test:   (typeof volume_test   !== "undefined") ? volume_test   : 75,
    duration_test: (typeof duration_test !== "undefined") ? duration_test : 750,
    pause_test:    (typeof pause_test    !== "undefined") ? pause_test    : 300,
```

### 3c — Load-Block

`js/file.js`, direkt nach dem `toneType_test`-Load-Block.

**Suche**:

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

**Direkt danach einfügen**:

```js
  // BA 250
  if (typeof volume_test !== "undefined") {
    var _v = parseInt(d.volume_test, 10);
    volume_test = (isFinite(_v) && _v >= 0 && _v <= 100) ? _v : 75;
  }
  if (typeof duration_test !== "undefined") {
    var _du = parseInt(d.duration_test, 10);
    duration_test = (isFinite(_du) && _du >= 100 && _du <= 3000) ? _du : 750;
  }
  if (typeof pause_test !== "undefined") {
    var _pa = parseInt(d.pause_test, 10);
    pause_test = (isFinite(_pa) && _pa >= 50 && _pa <= 2000) ? _pa : 300;
  }
```

## Schritt 4 — Helfer in `js/test.js`

`js/test.js`, direkt nach den `LS_HINT_*`-Konstanten (etwa Z. 666–667).

**Suche**:

```js
// LS-Hint Parameter (Bauanleitung 61)
const LS_HINT_BASIS_DB = 2.5;
const LS_HINT_K = 3;
```

**Direkt danach einfügen**:

```js
// BA 250: Helfer analog fmGVol/fmGDur/fmGPau in freqmatch.js.
// Lesen direkt aus den State-Variablen; macht die quadratische
// Audio-Konversion fuer die Lautstaerke.
function tGVol() { return Math.pow((volume_test || 0) / 100, 2); }
function tGDur() { return duration_test || 750; }
function tGPau() { return pause_test    || 300; }
```

## Schritt 5 — `js/test.js`: Header-Felder raus, Popup-Hooks rein

`js/test.js`, im DOMContentLoaded-Block (etwa Z. 1130–1180), Abschnitt
`header.common`.

### 5a — `volume`/`duration`/`pause` aus dem Header nehmen

**Suche**:

```js
      common: {
        refSelect: false,
        volume:    { show: true },
        duration:  { show: true },
        pause:     { show: true },
        toneType:  false,
```

**Ersetze durch**:

```js
      common: {
        refSelect: false,
        // BA 250: Lautstaerke/Tondauer/Tonpause sitzen in der Tonart-Modalbox,
        // nicht mehr im Header (analog freqmatch nach BA 240).
        volume:    false,
        duration:  false,
        pause:     false,
        toneType:  false,
```

### 5b — `tonePopupButton`-Hooks für Vol/Dur/Pau ergänzen und `getVolume`/`getPreviewSequence` auf `tG*` umstellen

**Suche** (gesamter `tonePopupButton`-Block):

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          getVolume:   function()   { return gVol(); },
          getPreviewSequence: function() {
            var hz = 1000;
            var dur = gDur();
            var pau = gPau();
            return [
              { hz: hz, durationMs: dur },
              { pauseMs: pau },
              { hz: hz, durationMs: dur }
            ];
          }
        },
```

**Ersetze durch**:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          // BA 250: Lautstaerke/Tondauer/Tonpause als Modalbox-Felder.
          // tone-popup.js Z. 327-347 rendert sie, wenn showVolume/Duration/Pause
          // gesetzt sind und die get/set-Hooks existieren.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_test; },
          setVolumePercent: function(v) { volume_test = v; },
          getDurationMs:    function()  { return duration_test; },
          setDurationMs:    function(v) { duration_test = v; },
          getPauseMs:       function()  { return pause_test; },
          setPauseMs:       function(v) { pause_test = v; },
          // Probehoeren und Sequenz aus den neuen State-Werten.
          getVolume:   function() { return tGVol(); },
          getPreviewSequence: function() {
            var hz = 1000;
            var dur = tGDur();
            var pau = tGPau();
            return [
              { hz: hz, durationMs: dur },
              { pauseMs: pau },
              { hz: hz, durationMs: dur }
            ];
          }
        },
```

### 5c — `_testPlaySimul` auf `tG*` umstellen

`js/test.js`, Funktion `_testPlaySimul` (etwa Z. 1211–1230).

**Suche**:

```js
  var tot = _testSliderVal();
  var vol = gVol();
  var dur = gDur();
  var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot)  : 1), 1), 0);
  var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
  var p1 = playTone(effFreq(curA), vA, dur);
  var p2 = playTone(effFreq(curB), vB, dur);
```

**Ersetze durch**:

```js
  var tot = _testSliderVal();
  // BA 250: Vol/Dur aus dem Test-State, nicht aus dem (entfallenen)
  // Header-Feld.
  var vol = tGVol();
  var dur = tGDur();
  var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot)  : 1), 1), 0);
  var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
  var p1 = playTone(effFreq(curA), vA, dur);
  var p2 = playTone(effFreq(curB), vB, dur);
```

## Schritt 6 — `js/audio.js`: `_activeTestInput`-Test-Zweig raus, `gVol`/`gDur`/`gPau` testAct-aware

Nach BA 249 las `_activeTestInput` für den `testAct`-Zweig aus
`testEls.header.volInput`. Nach BA 250 gibt es dort keinen Input mehr
— stattdessen muß für `testAct` direkt aus dem State gelesen werden.

### 6a — `_activeTestInput`-Test-Zweig entfernen

`js/audio.js`, etwa Z. 10–32 (Stand nach BA 249).

**Suche**:

```js
function _activeTestInput(type) {
  // BA 249: nach der testUI-Migration liegen volInput/durInput/pauseInput
  // unter els.header.*, nicht direkt auf els. Den alten Pfad gibt es nicht
  // mehr; die DOM-Fallback-IDs 'vol1'/'dur1'/'pau1' wurden mit der alten
  // API entfernt und existieren nicht mehr.
  if (testAct && typeof testEls !== 'undefined' && testEls && testEls.header) {
    if (type === 'vol') return testEls.header.volInput;
    if (type === 'dur') return testEls.header.durInput;
    if (type === 'pau') return testEls.header.pauseInput;
  }
  if (typeof lrRunning !== 'undefined' && lrRunning
      && typeof lrEls !== 'undefined' && lrEls && lrEls.header) {
    if (type === 'vol') return lrEls.header.volInput;
    if (type === 'dur') return lrEls.header.durInput;
    if (type === 'pau') return lrEls.header.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning
      && typeof fmEls !== 'undefined' && fmEls && fmEls.header) {
    if (type === 'vol') return fmEls.header.volInput;
    if (type === 'dur') return fmEls.header.durInput;
    if (type === 'pau') return fmEls.header.pauseInput;
  }
  return null;
}
```

**Ersetze durch**:

```js
function _activeTestInput(type) {
  // BA 250: Elektrodenlautstaerke-Test hat keine Header-Felder mehr —
  // Vol/Dur/Pau leben dort als State-Variablen (volume_test/duration_test/
  // pause_test). gVol/gDur/gPau lesen das direkt; _activeTestInput
  // braucht nur noch lr-balance und freqmatch (rein vorgehalten — beide
  // haben eigene Helfer).
  if (typeof lrRunning !== 'undefined' && lrRunning
      && typeof lrEls !== 'undefined' && lrEls && lrEls.header) {
    if (type === 'vol') return lrEls.header.volInput;
    if (type === 'dur') return lrEls.header.durInput;
    if (type === 'pau') return lrEls.header.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning
      && typeof fmEls !== 'undefined' && fmEls && fmEls.header) {
    if (type === 'vol') return fmEls.header.volInput;
    if (type === 'dur') return fmEls.header.durInput;
    if (type === 'pau') return fmEls.header.pauseInput;
  }
  return null;
}
```

### 6b — `gVol`/`gDur`/`gPau` für `testAct` aus dem State lesen

`js/audio.js`, Funktionen `gVol`/`gDur`/`gPau` (etwa Z. 28–39).

**Suche**:

```js
function gVol() {
  const el = _activeTestInput('vol');
  return el ? Math.pow(parseInt(el.value) / 100, 2) : 0.25;
}
function gDur() {
  const el = _activeTestInput('dur');
  return parseInt(el && el.value) || 1000;
}
function gPau() {
  const el = _activeTestInput('pau');
  return parseInt(el && el.value) || 500;
}
```

**Ersetze durch**:

```js
function gVol() {
  // BA 250: Elektrodenlautstaerke-Test liest aus dem State-Slot
  // volume_test (in Tonart-Modalbox eingestellt).
  if (testAct && typeof volume_test !== 'undefined') {
    return Math.pow((volume_test || 0) / 100, 2);
  }
  const el = _activeTestInput('vol');
  return el ? Math.pow(parseInt(el.value) / 100, 2) : 0.25;
}
function gDur() {
  // BA 250
  if (testAct && typeof duration_test !== 'undefined') {
    return duration_test || 750;
  }
  const el = _activeTestInput('dur');
  return parseInt(el && el.value) || 1000;
}
function gPau() {
  // BA 250
  if (testAct && typeof pause_test !== 'undefined') {
    return pause_test || 300;
  }
  const el = _activeTestInput('pau');
  return parseInt(el && el.value) || 500;
}
```

## Schritt 7 — `js/results.js`: `vol`-Anzeige auf State umstellen

`js/results.js` Z. 43–47 (Stand nach BA 249).

**Suche**:

```js
  // BA 249: testEls.volInput existiert in der neuen API nicht mehr;
  // der Wert sitzt unter testEls.header.volInput. Fallback auf
  // numerische Voreinstellung 75 (analog Default in der testUI).
  const vol = (typeof testEls !== 'undefined' && testEls
               && testEls.header && testEls.header.volInput)
    ? testEls.header.volInput.value
    : 75;
```

**Ersetze durch**:

```js
  // BA 250: Elektrodenlautstaerke-Test hat kein Header-Volume-Feld
  // mehr — der Wert sitzt im State volume_test (in der Tonart-Modalbox
  // eingestellt). Fallback 75 wie bisher.
  const vol = (typeof volume_test !== 'undefined') ? volume_test : 75;
```

## Schritt 8 — `js/print-md.js`: `_collectGlobalTest` auf State umstellen

`_collectGlobalTest` liest Vol/Dur/Pau heute aus den DOM-IDs
`vol1`/`dur1`/`pau1` — diese existieren seit der testUI-Migration nicht
mehr im DOM und haben in der bisherigen Druckausgabe daher konstant
`null` geliefert. Nach BA 250 sind die Werte ohnehin im State
(`volume_test`/`duration_test`/`pause_test`) und werden dort gelesen.

`js/print-md.js`, Funktion `_collectGlobalTest` (etwa Z. 125–138).

**Suche**:

```js
function _collectGlobalTest() {
  const dur = document.getElementById("dur1");
  const pau = document.getElementById("pau1");
  const vol = document.getElementById("vol1");
  return {
    toneType: globalToneType,
    sequence: globalSequence,
    duration: dur ? parseInt(dur.value) : null,
    pause:    pau ? parseInt(pau.value) : null,
    volume:   vol ? vol.value : null,
    slTargetTest:    (typeof slTarget_test    !== "undefined") ? slTarget_test    : null,
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null,
  };
}
```

**Ersetze durch**:

```js
function _collectGlobalTest() {
  // BA 250: Vol/Dur/Pau fuer den Elektrodenlautstaerke-Test leben jetzt
  // als State-Variablen (volume_test/duration_test/pause_test). Die
  // alten DOM-IDs vol1/dur1/pau1 existieren seit der testUI-Migration
  // nicht mehr.
  return {
    toneType: globalToneType,
    sequence: globalSequence,
    duration: (typeof duration_test !== "undefined") ? duration_test : null,
    pause:    (typeof pause_test    !== "undefined") ? pause_test    : null,
    volume:   (typeof volume_test   !== "undefined") ? volume_test   : null,
    slTargetTest:    (typeof slTarget_test    !== "undefined") ? slTarget_test    : null,
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null,
  };
}
```

## Schritt 9 — Akzeptanztest

1. **Browser-Cache leeren, Anwendung neu laden**
   Erwartet: kein JS-Fehler. `3.2.250-beta` sichtbar.

2. **Sub-Tab Elektrodenlautstärke öffnen**
   Voreinstellungs-Zeile zeigt nicht mehr Lautstärke/Tondauer/Tonpause
   als Felder. Sichtbar: Tonart-Button, Sequenz (AB/ABA), Sliderziel
   (a/b/balance), Elektroden-Auswahl, Start-Button.

3. **Tonart-Button öffnet Modalbox mit Lautstärke/Tondauer/Tonpause**
   Klick auf Tonart. Im Popup: Tonart-Liste **und** ein Block mit drei
   Zahleneingaben „Lautstärke %", „Tondauer ms", „Tonpause ms".
   Defaults nach Reset: 75 / 750 / 300.

4. **Werte werden im State gehalten**
   Im Popup Lautstärke auf 60, Tondauer auf 500, Tonpause auf 200
   setzen. Popup mit OK schließen. Popup erneut öffnen: die drei
   Werte sind 60 / 500 / 200.

5. **Probehören klingt nach den Modalbox-Werten**
   Im Popup auf eine Tonart klicken — der Probehör-Ton verwendet
   die im Popup eingestellten 60 % Lautstärke (deutlich leiser als
   75 %) und die kürzeren 500 ms.

6. **Test starten — Tonpaare folgen den Modalbox-Werten**
   Round-Robin-Test starten. Erwartet: Töne in den drei Modalbox-
   Werten (Lautstärke 60 %, Tondauer 500 ms, Tonpause 200 ms). Der
   Slider und die übrigen Bedien-Schritte (Bestätigen, Swap, Zurück,
   Replay, Simul) funktionieren wie nach BA 247.4.

7. **Datei speichern und neu laden**
   Während der Lautstärke noch auf 60 / 500 / 200 steht: Datei
   speichern, dann Datei neu laden. Erwartet: die drei Werte stehen
   nach dem Load wieder auf 60 / 500 / 200 in der Tonart-Modalbox.

8. **Reset-Button auf Defaults**
   Datei verwerfen / „Neuer Start". Erwartet: Lautstärke 75,
   Tondauer 750, Tonpause 300.

9. **Andere Sub-Reiter unverändert**
   - Stereo-Balance: Header hat weiterhin Lautstärke/Tondauer/Tonpause
     als Felder. Test läuft wie vorher.
   - Frequenzabgleich: Header hat die Felder seit BA 240 schon nicht
     mehr — unverändert.
   - Latenz: Header hat Lautstärke (eigene Mechanik) — unverändert.

10. **Meta-Zeile im Ergebnisreiter**
    Tab „Meßergebnisse" öffnen. In der Meta-Zeile steht der aktuelle
    `volume_test`-Wert (z.B. „60 %"), nicht der Default.

11. **Druckausgabe enthält die Modalbox-Werte**
    Werte im Popup auf 60 / 500 / 200 stellen. Druck aufrufen, in der
    Markdown-Ausgabe (Vorschau oder Datei) nach den globalen
    Test-Parametern suchen — `volume` zeigt 60, `duration` 500, `pause`
    200. Vor BA 250 stand dort `null` (die alten DOM-IDs
    `vol1`/`dur1`/`pau1` waren seit der testUI-Migration nicht mehr im
    DOM).

## Schritt 10 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–11
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Sechs Pflicht-Checks vor Build-Abschluß:

- **Header-Felder im Test wirklich weg**:
  ```
  grep -n "volume:\s*{" js/test.js
  grep -n "duration:\s*{" js/test.js
  grep -n "pause:\s*{" js/test.js
  ```
  Erwartet: keine `{ show: true }`-Belegungen für volume/duration/pause
  mehr im `header.common`-Block.

- **Popup-Hooks gesetzt**:
  ```
  grep -n "showVolume:\|getVolumePercent:\|getDurationMs:\|getPauseMs:" js/test.js
  ```
  Erwartet: je ein Treffer im `tonePopupButton`-Block.

- **State-Variablen sauber deklariert**:
  ```
  grep -n "volume_test\|duration_test\|pause_test" js/state-side.js js/file.js
  ```
  Erwartet: je eine Deklaration in `state-side.js`, je ein Eintrag in
  Reset, Save, Load von `file.js`.

- **`audio.js`-Test-Zweig in `_activeTestInput` entfernt**:
  ```
  grep -n "testAct &&" js/audio.js
  ```
  Erwartet: zwei Treffer in `gVol`/`gDur`/`gPau` (Z. 28–39, neuer
  State-Pfad), keiner mehr in `_activeTestInput`.

- **Tote DOM-IDs `vol1`/`dur1`/`pau1` nirgendwo mehr gelesen**:
  ```
  grep -rn "getElementById(\"vol1\"\|getElementById(\"dur1\"\|getElementById(\"pau1\"\|getElementById('vol1'\|getElementById('dur1'\|getElementById('pau1'" js/
  ```
  Erwartet: keine Treffer (`print-md.js` ist nach Schritt 8 umgestellt;
  `audio.js`-Fallback ist mit BA 249 entfernt).

- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.250-beta`.

## Folge-BAs

- **BA 251** — `jRes` (Judgment-Ergebnisse) komplett aus dem Code
  entfernen. Save schreibt nicht mehr, Load ignoriert.
