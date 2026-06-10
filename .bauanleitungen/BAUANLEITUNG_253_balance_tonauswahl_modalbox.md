# BA 253 — Stereo-Balance auf Tonauswahl-Modalbox umstellen

Status: ENTWURF (noch nicht im Bau).

Voraussetzung: BA 252 ist gebaut.

## Ziel

Im Test Stereo-Balance leben Tonart, Lautstärke, Tondauer und
Tonpause heute in der Test-Kopfzeile (Header-Felder). Sie wandern
in die Tonauswahl-Modalbox — analog Frequenzabgleich (BA 240) und
Elektrodenlautstärke (BA 250).

Begleitend:

- Eigene Speicher-Werte pro Test (`toneType_balance`,
  `volume_balance`, `duration_balance`, `pause_balance`),
  Persistenz beim Speichern/Laden, Sitzungs-Persistenz.
- Klavier-Widget in der Modalbox mit **beidseitiger** Disabled-
  Logik (Taste disabled, wenn auf links oder rechts abgewählt/
  ausgeschlossen).
- Klavier-Anschlag spielt einen Burst auf der aktiven Seite,
  Pause, dann einen Burst auf der anderen Seite.
- Tonfolge (AB/ABA) bleibt in BA 253 noch als globaler Wert im
  Header sichtbar — die Umstellung auf pro-Test-Wert folgt in
  BA 254.

## Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.2.253-beta";
```

## Änderungen

### 1) `js/state-side.js` — neue State-Variablen

Direkt unter dem bestehenden Block für `toneType_test`/`volume_test`/
`duration_test`/`pause_test` (Z. ca. 694–705):

```js
// BA 253: Tonart, Lautstärke, Tondauer, Tonpause speziell für
// Stereo-Balance. Über die Tonauswahl-Modalbox eingestellt; getrennt
// vom Frequenzabgleich- und Elektrodenlautstärke-Test.
let toneType_balance = "richCiHF";
let volume_balance   = 75;
let duration_balance = 1000;
let pause_balance    = 400;
```

### 2) `js/lr-balance.js` — Header schlanker, Modal-Box mit Klavier

**Schritt 2a — `lrGVol`/`lrGDur`/`lrGPau` auf State-Werte umstellen.**

Heute (Z. 56–70):

```js
function lrGVol() {
  if (lrEls && lrEls.header && lrEls.header.volInput)
    return Math.pow(parseInt(lrEls.header.volInput.value) / 100, 2);
  return Math.pow(50 / 100, 2);
}
function lrGDur() {
  if (lrEls && lrEls.header && lrEls.header.durInput)
    return parseInt(lrEls.header.durInput.value) || 1000;
  return 1000;
}
function lrGPau() {
  if (lrEls && lrEls.header && lrEls.header.pauseInput)
    return parseInt(lrEls.header.pauseInput.value) || 400;
  return 400;
}
```

ersetzen durch:

```js
function lrGVol() { return Math.pow((volume_balance || 0) / 100, 2); }
function lrGDur() { return duration_balance || 1000; }
function lrGPau() { return pause_balance    || 400;  }
```

**Schritt 2b — `lrPlayTone` auf `toneType_balance` umstellen.**

Heute (Z. 51–54):

```js
function lrPlayTone(hz, vol, ms, pan) {
  const c = gAC();
  return playToneTyped(c, hz, vol, ms, pan, globalToneType);
}
```

ersetzen durch:

```js
function lrPlayTone(hz, vol, ms, pan) {
  const c = gAC();
  return playToneTyped(c, hz, vol, ms, pan, toneType_balance);
}
```

**Schritt 2c — `lrPlaySimul` (Z. ca. 188–189) auf `toneType_balance`
umstellen.**

Heute:

```js
var p1 = playToneTyped(ac, hzL, volL, dur, -1, globalToneType);
var p2 = playToneTyped(ac, hzR, volR, dur, 1, globalToneType);
```

ersetzen durch:

```js
var p1 = playToneTyped(ac, hzL, volL, dur, -1, toneType_balance);
var p2 = playToneTyped(ac, hzR, volR, dur, 1, toneType_balance);
```

**Achtung:** `globalSequence` (Z. ca. 149) bleibt in BA 253
unverändert — die Tonfolge-Umstellung kommt in BA 254.

**Schritt 2d — neue Klavier-Helfer und Modal-State im Modul-Scope.**

Oben in `lr-balance.js`, in dem Bereich, wo bisher die anderen
Modul-Helper definiert sind (z.B. direkt vor `lrGVol`):

```js
// BA 253: Klavier-Helfer für die Tonauswahl-Modalbox des
// Stereo-Balance-Tests. Tasten bis Min(leftN, rightN); disabled
// sobald auf einer der beiden Seiten abgewählt (elActive===false)
// oder ausgeschlossen (elExDur!=null). 'mute' zählt nicht als
// disabled. Frequenzen und Labels werden von der aktiven Seite
// genommen (Anzeige-Konvention).
function _lrTpKbdN() {
  var lN = (sideData.left  && sideData.left.nEl)  || 0;
  var rN = (sideData.right && sideData.right.nEl) || 0;
  return Math.min(lN, rN);
}
function _lrTpElectrodeFreqs() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var arr = [];
  for (var i = 0; i < n; i++) arr.push(lrEffFreq(activeSide, i));
  return arr;
}
function _lrTpElectrodeLabels() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var arr = [];
  var prefix = withSide(activeSide, function() { return dENPrefix(); });
  for (var i = 0; i < n; i++) {
    arr.push(prefix + withSide(activeSide, function() { return dEN(i); }));
  }
  return arr;
}
function _lrTpDisabledElectrodes() {
  var n = _lrTpKbdN();
  if (n <= 0) return [];
  var sdL = sideData.left, sdR = sideData.right;
  var dis = [];
  for (var i = 0; i < n; i++) {
    var off = (sdL.elActive && sdL.elActive[i] === false)
           || (sdL.elExDur  && sdL.elExDur[i]  != null)
           || (sdR.elActive && sdR.elActive[i] === false)
           || (sdR.elExDur  && sdR.elExDur[i]  != null);
    if (off) dis.push(i);
  }
  return dis;
}

// BA 253: State für den Modal-Korrektur-Toggle und die aktuell
// im Modal angeklickte Tonart (analog freqmatch/test).
var _lrTpCorrectVol = null;
var _lrTpModalTone  = null;
```

**Schritt 2e — Header-Konfig umbauen.**

Im `buildTestPanel`-cfg-Block (Z. ca. 759–802) den `common`-
Abschnitt umstellen. Heute:

```js
      common: {
        refSelect: false,
        volume:    { show: true },
        duration:  { show: true, default: 1000, min: 100, max: 3000, step: 50 },
        pause:     { show: true, default: 400,  min: 50,  max: 2000, step: 50 },
        toneType:  { show: true, source: 'global' },
        sequence:  { show: true, source: 'global' },
        sliderTarget: {
          options:  ['left','right','both'],
          stateKey: 'slTarget_balance',
          default:  'both'
        },
        electrodeSelection: { /* … unverändert … */ }
      },
```

ersetzen durch:

```js
      common: {
        refSelect: false,
        // BA 253: Lautstärke/Tondauer/Tonpause leben jetzt im
        // Tonauswahl-Modal, nicht mehr im Header.
        volume:    false,
        duration:  false,
        pause:     false,
        // BA 253: Tonart-Dropdown durch tonePopupButton ersetzt.
        toneType:  false,
        tonePopupButton: {
          getToneType: function()   { return toneType_balance; },
          setToneType: function(tt) { toneType_balance = tt; },
          onToneSelected: function(tt) { _lrTpModalTone = tt; },
          onModalClose:   function()   { _lrTpModalTone = null; _lrTpCorrectVol = null; },
          onTogglesReady: function(fn) { _lrTpCorrectVol = fn; },
          // Hint-Text in der Modalbox (analog freqmatch).
          hintKey: 'tonePopupHint',
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_balance; },
          setVolumePercent: function(v) { volume_balance = v; },
          getDurationMs:    function()  { return duration_balance; },
          setDurationMs:    function(v) { duration_balance = v; },
          getPauseMs:       function()  { return pause_balance; },
          setPauseMs:       function(v) { pause_balance = v; },
          getVolume:   function() { return lrGVol(); },
          getPreviewSequence: function() {
            // Probehör im Modal: Burst aktive Seite, Pause, Burst
            // andere Seite. Frequenz mittig (1 kHz) — die Klavier-
            // Tasten liefern die "echten" Frequenzen pro Anschlag.
            var dur = lrGDur();
            var pau = lrGPau();
            var panA = (activeSide === 'left') ? -1 : 1;
            var panB = -panA;
            return [
              { hz: 1000, pan: panA, durationMs: dur },
              { pauseMs: pau },
              { hz: 1000, pan: panB, durationMs: dur }
            ];
          },
          // BA 253: Klavier mit beidseitiger Disabled-Logik.
          keyboardMode:          true,
          getElectrodeFreqs:     _lrTpElectrodeFreqs,
          getElectrodeLabels:    _lrTpElectrodeLabels,
          getDisabledElectrodes: _lrTpDisabledElectrodes,
          getHighlightMs: function() { return lrGDur() * 2 + lrGPau(); },
          onPress: function(electrodeIdx, hz) {
            // Burst-Sequenz: aktive Seite zuerst, Pause, andere Seite.
            // Schwarze Zier-Tasten (electrodeIdx === -1) spielen die
            // vom Klavier gelieferte Mittel-Frequenz nach demselben
            // Schema. Frequenz pro Seite getrennt holen, damit die
            // var-/ref-Drift bei verschiedenen Implantat-Konfigurationen
            // nicht durchschlägt.
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var dur = lrGDur();
            var pau = lrGPau();
            var vol = lrGVol();
            var panA = (activeSide === 'left') ? -1 : 1;
            var panB = -panA;
            var tt   = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_balance;

            // Hz pro Seite: bei weißer Taste (electrodeIdx >= 0) die
            // Hz der aktuellen Seite ablesen; bei schwarzer Taste
            // (electrodeIdx === -1) das vom Klavier gelieferte hz
            // unverändert nehmen (geometrisches Mittel der Anker).
            var hzA, hzB;
            if (electrodeIdx >= 0) {
              hzA = lrEffFreq(activeSide, electrodeIdx);
              var otherSide = (activeSide === 'left') ? 'right' : 'left';
              var rN = sideData[otherSide] ? sideData[otherSide].nEl : 0;
              var otherIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzB = lrEffFreq(otherSide, otherIdx);
            } else {
              hzA = hz;
              hzB = hz;
            }
            var volA = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hzA, panA) : vol;
            var volB = (typeof _lrTpCorrectVol === 'function') ? _lrTpCorrectVol(vol, hzB, panB) : vol;

            try {
              playToneTyped(c, hzA, volA, dur, panA, tt);
              setTimeout(function() {
                playToneTyped(c, hzB, volB, dur, panB, tt);
              }, dur + pau);
            } catch (e) { /* swallow */ }
          }
        },
        sequence:  { show: true, source: 'global' },
        sliderTarget: {
          options:  ['left','right','both'],
          stateKey: 'slTarget_balance',
          default:  'both'
        },
        electrodeSelection: { /* … unverändert übernehmen … */ }
      },
```

**Achtung:** Der `electrodeSelection`-Block (Z. 772–798) bleibt
unverändert. Nur den `common`-Rahmen drumherum austauschen.

### 3) `js/file.js` — Persistenz beim Speichern/Laden

**Schritt 3a — Reset-Defaults (Z. ca. 56–70).**

Im Reset-Block, in dem heute `volume_freqmatch`/`duration_freqmatch`/
`pause_freqmatch` zurückgesetzt werden, folgende Zeilen ergänzen:

```js
  if (typeof toneType_balance !== "undefined") toneType_balance = "richCiHF";
  if (typeof volume_balance   !== "undefined") volume_balance   = 75;
  if (typeof duration_balance !== "undefined") duration_balance = 1000;
  if (typeof pause_balance    !== "undefined") pause_balance    = 400;
```

**Schritt 3b — Export (Z. ca. 285–301).** Im `serializeState()`-
Block, in dem `toneType_freqmatch`/`volume_freqmatch` etc. gespeichert
werden, folgende Felder ergänzen:

```js
    toneType_balance: (typeof toneType_balance !== "undefined")
      ? toneType_balance : "richCiHF",
    volume_balance:   (typeof volume_balance   !== "undefined") ? volume_balance   : 75,
    duration_balance: (typeof duration_balance !== "undefined") ? duration_balance : 1000,
    pause_balance:    (typeof pause_balance    !== "undefined") ? pause_balance    : 400,
```

**Schritt 3c — Import (Z. ca. 616–660).** Im `loadState()`-Block,
analog zu `toneType_freqmatch`/`toneType_test`:

```js
  if (typeof toneType_balance !== "undefined") {
    if (isValidToneType(d.toneType_balance)) {
      toneType_balance = d.toneType_balance;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_balance = d.globalToneType;
    } else {
      toneType_balance = "richCiHF";
    }
  }
  if (typeof volume_balance !== "undefined") {
    var _vB = parseInt(d.volume_balance, 10);
    volume_balance = (isFinite(_vB) && _vB >= 0 && _vB <= 100) ? _vB : 75;
  }
  if (typeof duration_balance !== "undefined") {
    var _dB = parseInt(d.duration_balance, 10);
    duration_balance = (isFinite(_dB) && _dB >= 100 && _dB <= 3000) ? _dB : 1000;
  }
  if (typeof pause_balance !== "undefined") {
    var _pB = parseInt(d.pause_balance, 10);
    pause_balance = (isFinite(_pB) && _pB >= 50 && _pB <= 2000) ? _pB : 400;
  }
```

### 4) `js/init.js` — Sitzungs-Persistenz

**Schritt 4a — Lade-Seite (Z. ca. 730–745).** Analog zu
`toneType_freqmatch` ergänzen:

```js
      if (typeof toneType_balance !== "undefined") {
        if (isValidToneType(d.toneType_balance)) {
          toneType_balance = d.toneType_balance;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_balance = d.globalToneType;
        }
      }
      if (typeof volume_balance   !== "undefined" && isFinite(parseInt(d.volume_balance,   10))) volume_balance   = parseInt(d.volume_balance,   10);
      if (typeof duration_balance !== "undefined" && isFinite(parseInt(d.duration_balance, 10))) duration_balance = parseInt(d.duration_balance, 10);
      if (typeof pause_balance    !== "undefined" && isFinite(parseInt(d.pause_balance,    10))) pause_balance    = parseInt(d.pause_balance,    10);
```

**Schritt 4b — Schreib-Seite (Z. ca. 920–930).** Im
Sitzungs-`saveState`-Aufruf folgende Felder ergänzen:

```js
          toneType_balance: (typeof toneType_balance !== "undefined")
            ? toneType_balance : "richCiHF",
          volume_balance:   (typeof volume_balance   !== "undefined") ? volume_balance   : 75,
          duration_balance: (typeof duration_balance !== "undefined") ? duration_balance : 1000,
          pause_balance:    (typeof pause_balance    !== "undefined") ? pause_balance    : 400,
```

## Nicht ändern

- `js/sampler-keyboard.js`, `js/tone-popup.js` — unverändert.
- `js/test-ui.js` — die `tonePopupButton`-Verdrahtung läuft bereits
  generisch; keine API-Erweiterung nötig.
- Tonfolge-Bereich (sequence) und `globalSequence` — kommen in
  BA 254 dran.

## i18n

Keine neuen Keys. `tonePopupHint` existiert seit BA 240.

## Akzeptanztest

1. Reiter Messungen → Sub-Reiter Stereo-Balance.
2. **Erwartet:** Test-Kopfzeile zeigt **kein** Lautstärke-Feld,
   **kein** Tondauer-Feld, **kein** Tonpause-Feld und **keinen**
   Tonart-Dropdown mehr. Statt dem Dropdown gibt es einen Tonart-
   Knopf (Beschriftung = aktuelle Tonart).
3. Tonart-Knopf klicken → Tonauswahl-Modalbox öffnet sich. Über
   der Tonart-Liste ist das Klavier sichtbar; Eingabefelder
   Lautstärke/Tondauer/Tonpause sind im Modal vorhanden und
   reagieren auf Änderungen (Probehör nutzt die neuen Werte).
4. Im Implantat-Reiter eine Elektrode auf der **linken** Seite
   abwählen, dann zurück zu Stereo-Balance, Modal erneut öffnen.
   **Erwartet:** im Klavier ist diese Elektrode durchkreuzt und
   ausgegraut — obwohl sie auf der rechten Seite noch aktiv ist.
5. Aktive (nicht-deaktivierte) Taste anklicken → Burst auf der
   aktiven Seite (Pan abhängig vom aktive-Seite-Schalter), Pause,
   Burst auf der anderen Seite. Tondauer und Pause stimmen mit
   den Modal-Werten überein.
6. Tonart in der Modalbox umstellen, Modal mit OK schließen,
   Knopf zeigt jetzt die neue Tonart, Test mit „Start" beginnen.
   **Erwartet:** Test-Tonsequenz nutzt die in der Modalbox
   gewählte Tonart.
7. Browser schließen und neu öffnen → Stereo-Balance-Tonart und
   -Lautstärke/-Dauer/-Pause sind erhalten (Sitzungs-Persistenz).
8. Speicher-Datei exportieren, App komplett zurücksetzen,
   Speicher-Datei wieder importieren → dieselben Werte sind da.
9. Reiter Messungen → Sub-Reiter Frequenzabgleich:
   **Erwartet:** unverändert, Tonart-Knopf und Modalbox wie nach
   BA 240/252.
10. Reiter Messungen → Sub-Reiter Elektrodenlautstärke: ebenfalls
    unverändert (Klavier seit BA 252 da, Werte unverändert).

## Selbstprüfung an Sonnet

Vor Fertig-Meldung jede Akzeptanz-Kriterie 1.–10. einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

Zusätzlich vor Versand prüfen:

- `js/state-side.js`: die vier neuen `*_balance`-Variablen sind
  deklariert.
- `js/lr-balance.js`: 
  - `lrGVol`/`lrGDur`/`lrGPau` lesen die State-Variablen, nicht
    mehr `lrEls.header.*Input`.
  - `lrPlayTone` und beide `lrPlaySimul`-`playToneTyped`-Aufrufe
    nutzen `toneType_balance` statt `globalToneType`.
  - Der `tonePopupButton`-Block ist im `common`-Bereich und hat
    `keyboardMode: true`, `getDisabledElectrodes` ist gesetzt.
  - `volume`/`duration`/`pause`/`toneType` im `common`-Bereich
    stehen auf `false`.
  - `electrodeSelection` blieb erhalten.
- `js/file.js` und `js/init.js`: jeweils Reset / Export / Import
  für die vier neuen Variablen ergänzt.
- `js/version.js` zeigt `"3.2.253-beta"`.
- ASCII-Quotes in allen geänderten Code-Stellen.

## Hinweis am Ende

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen,
wenn der Nutzer dazu auffordert.
