# BA 252 — Klavier: beidseitige Disabled-Logik in Frequenzabgleich, Klavier neu in Elektrodenlautstärke

Status: ENTWURF (noch nicht im Bau).

## Ziel

Zwei Korrekturen am Klavier in der Tonauswahl-Modalbox:

1. **Frequenzabgleich**: Das Klavier filtert abgewählte/ausgeschlossene
   Elektroden heute komplett aus der Anzeige. Korrekt ist (analog
   Implantat-Tab): die Tasten anzeigen, aber per X durchkreuzt und
   ausgegraut darstellen. Zusätzlich neu: die Disabled-Logik
   berücksichtigt **beide** Seiten (var und ref) — eine Taste ist
   schon disabled, wenn die Elektrode auf einer der beiden Seiten
   abgewählt oder ausgeschlossen ist.

2. **Elektrodenlautstärke**: Das Klavier fehlt in der Tonauswahl-
   Modalbox komplett. Anbau mit denselben Helfern wie im Implantat-
   Tab (eine Seite — die aktive — alle Elektroden zeigen, abgewählte
   und ausgeschlossene per X durchkreuzt).

Die zentrale Klavier-Darstellung in `js/sampler-keyboard.js`
(BA 241) — X-Overlay über weißen Tasten, Sonderlogik für schwarze
Tasten mit Verbindungs-Balken bei deaktivierten Nachbarn —
greift automatisch, sobald die richtige Disabled-Liste geliefert
wird. **Kein Eingriff in `sampler-keyboard.js` nötig.**

## Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.2.252-beta";
```

## Änderungen

### 1) `js/freqmatch.js` — Klavier-Helfer auf beidseitige Logik umstellen

Heutiger Stand (Z. ca. 1133–1167 im `tonePopupButton`-Block):

```js
          keyboardMode: true,
          getElectrodeFreqs: function() {
            var side = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var freqs = [];
            withSide(side, function() {
              for (var i = 0; i < elActive.length; i++) {
                if (elActive[i] === false) continue;
                freqs.push(effFreq(i));
              }
            });
            return freqs;
          },
          getElectrodeLabels: function() {
            var side = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var labels = [];
            withSide(side, function() {
              var prefix = dENPrefix();
              for (var i = 0; i < elActive.length; i++) {
                if (elActive[i] === false) continue;
                labels.push(prefix + dEN(i));
              }
            });
            return labels;
          },
          getHighlightMs: function() { return fmGDur() * 2 + fmGPau(); },
```

Diesen Block durch folgendes ersetzen (Disabled-Filter raus,
neuer `getDisabledElectrodes`-Callback, Tasten bis Min(varN, refN)):

```js
          keyboardMode: true,
          getElectrodeFreqs: function() {
            // Anzahl Tasten = Minimum aus var- und ref-Seite.
            // Frequenzen kommen von der var-Seite (CI-Seite im
            // Frequenzabgleich-Kontext). Kein Filter auf
            // elActive/elExDur — das macht getDisabledElectrodes.
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var freqs = [];
            withSide(vSide, function() {
              for (var i = 0; i < n; i++) freqs.push(effFreq(i));
            });
            return freqs;
          },
          getElectrodeLabels: function() {
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var vN = sideData[vSide] ? sideData[vSide].nEl : 0;
            var rN = sideData[rSide] ? sideData[rSide].nEl : 0;
            var n  = Math.min(vN, rN);
            if (n <= 0) return [];
            var labels = [];
            withSide(vSide, function() {
              var prefix = dENPrefix();
              for (var i = 0; i < n; i++) labels.push(prefix + dEN(i));
            });
            return labels;
          },
          getDisabledElectrodes: function() {
            // Disabled = auf var- ODER ref-Seite abgewählt
            // (elActive === false) oder ausgeschlossen (elExDur !== null).
            // Kein 'mute'-Check — siehe Implantat-Helfer
            // _implTpDisabledElectrodes als Vorbild.
            var vSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var rSide = (typeof fmRefSide === 'string' && fmRefSide)
              ? fmRefSide : (vSide === 'left' ? 'right' : 'left');
            var sdV = sideData[vSide], sdR = sideData[rSide];
            if (!sdV || !sdR) return [];
            var n = Math.min(sdV.nEl || 0, sdR.nEl || 0);
            var dis = [];
            for (var i = 0; i < n; i++) {
              var off = (sdV.elActive && sdV.elActive[i] === false)
                     || (sdV.elExDur  && sdV.elExDur[i]  != null)
                     || (sdR.elActive && sdR.elActive[i] === false)
                     || (sdR.elExDur  && sdR.elExDur[i]  != null);
              if (off) dis.push(i);
            }
            return dis;
          },
          getHighlightMs: function() { return fmGDur() * 2 + fmGPau(); },
```

`onPress` (Z. ca. 1168–1192) bleibt **unverändert** — Var-Burst,
Pause, Ref-Burst. Die Frequenz `hz` wird vom Klavier bereits aus
`getElectrodeFreqs` der var-Seite gefüttert; die Wiedergabe auf
ref-Seite nutzt dieselbe Hz (Frequenzabgleich-Prinzip: gleiche
Hz, getrennt nach Seite).

### 2) `js/test.js` — Tonauswahl-Modalbox um Klavier ergänzen

Heute hat der `tonePopupButton`-Block in `test.js` (Z. ca. 1108–1135)
**keinen** `keyboardMode` und keine Klavier-Helfer. Ergänzen, analog
Implantat-Tab (`_implTpElectrodeFreqs` / `_implTpElectrodeLabels` /
`_implTpDisabledElectrodes`) — eine Seite (die aktive), alle
Elektroden, abgewählte/ausgeschlossene als disabled.

**Schritt 2a — neue Helfer am Modul-Kopf** (oberhalb der
DOMContentLoaded-Registrierung von `test.js`, in dem Bereich, wo
auch `tGVol`/`tGDur`/`tGPau` definiert sind):

```js
// BA 252: Klavier-Helfer für die Tonauswahl-Modalbox des
// Elektrodenlautstärke-Tests. Eine Seite (aktive Seite), alle
// Elektroden anzeigen, abgewählte/ausgeschlossene als disabled
// (X-Durchkreuzung übernimmt sampler-keyboard.js automatisch).
// Analog _implTp*-Helfer in ui-implant.js (BA 228/241).
function _testTpElectrodeFreqs() {
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(effFreq(i));
  return arr;
}
function _testTpElectrodeLabels() {
  var prefix = (typeof dENPrefix === 'function') ? dENPrefix() : 'E';
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    arr.push(prefix + ((typeof dEN === 'function') ? dEN(i) : (i + 1)));
  }
  return arr;
}
function _testTpDisabledElectrodes() {
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    if (elActive[i] === false) { arr.push(i); continue; }
    if (typeof elExDur !== 'undefined' && elExDur[i] != null) { arr.push(i); continue; }
  }
  return arr;
}

// BA 252: Korrektur-Toggle-Callback (analog ui-implant.js).
// Wird im Modal über onTogglesReady geliefert; merken, um beim
// Klavier-Anschlag die Lautstärke zu korrigieren.
var _testTpCorrectVol = null;
var _testTpModalTone  = null;
```

**Schritt 2b — `tonePopupButton`-Block erweitern.** Heute steht im
`buildTestPanel`-cfg unter `header.common.tonePopupButton` (Z. ca.
1108–1135) folgender Block:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_test; },
          setVolumePercent: function(v) { volume_test = v; },
          getDurationMs:    function()  { return duration_test; },
          setDurationMs:    function(v) { duration_test = v; },
          getPauseMs:       function()  { return pause_test; },
          setPauseMs:       function(v) { pause_test = v; },
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

Diesen Block ersetzen durch folgenden erweiterten Block — alte
Felder bleiben unverändert, neue Felder (`onToneSelected`,
`onModalClose`, `onTogglesReady`, `keyboardMode`,
`getElectrodeFreqs`, `getElectrodeLabels`,
`getDisabledElectrodes`, `getHighlightMs`, `onPress`, `onRelease`)
kommen dazu:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          // BA 252: Klavier-Anschlag liest den im Modal angeklickten
          // Tonart-Wert (fallback auf toneType_test), analog freqmatch.
          onToneSelected: function(tt) { _testTpModalTone = tt; },
          onModalClose:   function()   { _testTpModalTone = null; _testTpCorrectVol = null; },
          onTogglesReady: function(fn) { _testTpCorrectVol = fn; },
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_test; },
          setVolumePercent: function(v) { volume_test = v; },
          getDurationMs:    function()  { return duration_test; },
          setDurationMs:    function(v) { duration_test = v; },
          getPauseMs:       function()  { return pause_test; },
          setPauseMs:       function(v) { pause_test = v; },
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
          },
          // BA 252: Klavier-Widget in der Modalbox aktivieren —
          // aktive Seite (CI-Seite des Tests), Implantat-Logik.
          keyboardMode:          true,
          getElectrodeFreqs:     _testTpElectrodeFreqs,
          getElectrodeLabels:    _testTpElectrodeLabels,
          getDisabledElectrodes: _testTpDisabledElectrodes,
          getHighlightMs: function() { return tGDur(); },
          onPress: function(electrodeIdx, hz) {
            // Vorhör-Burst auf der aktiven Seite (Pan ±1).
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var pan = (activeSide === 'left') ? -1 : 1;
            var tt  = (_testTpModalTone !== null) ? _testTpModalTone : toneType_test;
            var vol = tGVol();
            if (typeof _testTpCorrectVol === 'function') {
              vol = _testTpCorrectVol(vol, hz, pan);
            }
            try {
              playToneTyped(c, hz, vol, tGDur(), pan, tt);
            } catch (e) { /* swallow */ }
          }
        },
```

**Achtung:** `playToneTyped` ist im globalen Scope (siehe
`js/audio.js`). Kein zusätzlicher Import nötig.

## Nicht ändern

- `js/sampler-keyboard.js` — die Disabled-Darstellung (X-Overlay,
  Sonderlogik schwarze Tasten + Verbindungs-Balken) liegt zentral
  hier und greift automatisch.
- `js/ui-implant.js` — Implantat-Tab bleibt unverändert.
- `js/tone-popup.js` — die `cfg.getDisabledElectrodes`-Weiterleitung
  und alle anderen Hooks sind seit BA 241 vorhanden.

## i18n

Keine neuen i18n-Keys. `en.js`/`fr.js`/`es.js` bleiben unverändert.

## Akzeptanztest

**Frequenzabgleich:**

1. Reiter Messungen → Sub-Reiter Frequenzabgleich.
2. Implantat-Reiter öffnen, mindestens eine Elektrode auf der
   CI-Seite abwählen (Häkchen entfernen). Zurück zum Frequenzabgleich.
3. Tonart-Button in der Test-Kopfzeile klicken → Modalbox öffnet sich.
4. **Erwartet:** Das Klavier zeigt **alle** Tasten bis zur kleineren
   Elektrodenzahl beider Seiten. Die im Implantat abgewählte
   Elektrode hat ein ausgegrautes, mit zwei diagonalen Linien
   durchkreuztes Tastenfeld. Schwarze Nachbartasten zeigen die in
   BA 241 etablierte Sonderdarstellung (Verbindungs-Balken bei
   gemeinsamer Anker-Gruppe oder eigenes X bei fehlendem Anker).
5. Aktive (nicht-deaktivierte) weiße Taste anklicken → Klavier
   spielt var-Burst, Pause, ref-Burst.
6. Deaktivierte weiße Taste anklicken → keine Wiedergabe, Cursor
   "nicht erlaubt".

**Elektrodenlautstärke:**

7. Reiter Messungen → Sub-Reiter Elektrodenlautstärke.
8. Tonart-Button in der Test-Kopfzeile klicken → Modalbox öffnet sich.
9. **Erwartet:** Über der Tonart-Liste ist jetzt das Klavier sichtbar
   mit einer Taste pro Elektrode der aktiven Seite. Im Implantat
   abgewählte Elektroden sind durchkreuzt und ausgegraut.
10. Aktive Taste anklicken → kurzer Vorhör-Ton auf der aktiven Seite
    (Pan links bzw. rechts gemäß aktive-Seite-Schalter).
11. Lautstärke-/Tondauer-/Tonpause-Felder in der Modalbox ändern →
    Vorhör reagiert auf neue Werte.

**Implantat (Regression):**

12. Reiter Implantat → Tonart-Modalbox öffnen → Klavier wie bisher,
    keine Änderung.

## Selbstprüfung an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie 1.–12. einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

Zusätzlich vor Versand prüfen:

- In `js/freqmatch.js`: kein verbleibender `if (elActive[i] === false) continue;`-
  Filter im neuen `getElectrodeFreqs`/`getElectrodeLabels`-Block.
  `getDisabledElectrodes` ist als neuer Schlüssel im
  `tonePopupButton`-cfg vorhanden.
- In `js/test.js`: die drei Helfer `_testTpElectrodeFreqs`,
  `_testTpElectrodeLabels`, `_testTpDisabledElectrodes` existieren
  im Modul-Scope. Im `tonePopupButton`-cfg-Block sind
  `keyboardMode: true` und alle vier zugehörigen Callbacks gesetzt.
- `js/version.js` zeigt `"3.2.252-beta"`.
- ASCII-Quotes in allen geänderten Code-Stellen.

## Hinweis am Ende

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen,
wenn der Nutzer dazu auffordert.
