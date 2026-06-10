# BA 228 — Klavier-Widget in der Tonauswahl-Modalbox

## Ziel

Oberhalb der Tonart-Liste in der Modalbox erscheint ein Klavier-
Widget. Tastenzahl = Anzahl aktiver Elektroden der aktiven Seite,
beschriftet mit Elektrodennummer; zwischen je zwei weissen Tasten
eine schwarze Zier-Taste auf geometrischem Mittel der Nachbar-
frequenzen. Anschlag = Burst mit aktueller Tondauer der getroffenen
Frequenz mit dem gerade gewaehlten Tonart-Klang.

Im Frequenzabgleich (BA 228-Aufrufer): Burst auf var-Seite, kurze
Pause, Burst auf ref-Seite — implementiert vom Aufrufer
(`freqmatch.js`) in `cfg.onKeyPress`. Die Modalbox selbst kennt nur
das abstrakte Klavier; sie ruft `cfg.onKeyPress(electrodeIdx, hz,
durationMs)` auf und der Aufrufer entscheidet, wie der Ton genau
gespielt wird. So bleibt das Widget fuer kuenftige Aufrufer
(Implantat-Reiter, BA 230) wiederverwendbar.

Bei smplr-Tonart die noch nicht geladen ist: Tasten klingen
stumm, ueber dem Klavier erscheint "Laedt ..."-Hinweis, Lade-
Trigger laeuft im Hintergrund. Sobald geladen, klingen kuenftige
Anschlaege.

Voraussetzung: BA 227 abgenommen. Aktuelle Version 3.2.227-beta.

Versionsbump: 3.2.228-beta.

## Was diese BA NICHT macht

- KEINE Note-On/Note-Off-Logik (Tasten halten = klingt solange).
  Nur Burst. Hold-Modus kommt als optionale BA 231.
- KEINE Verschiebung von Lautstaerke/Tondauer/Pause aus dem
  Test-Header in die Modalbox (BA 229).
- KEINE Implantat-Reiter-Integration (BA 230).
- KEIN sweepMode (BA 230).

## Schritt 1 — Neue Datei `js/sampler-keyboard.js`

Datei neu anlegen. Vollstaendiger Inhalt:

```js
// ============================================================
// SAMPLER-KEYBOARD — Klavier-Widget fuer die Tonart-Modalbox
// ============================================================
// Rendert ein einfaches Klavier mit Tastenanzahl = Anzahl der
// uebergebenen Elektroden-Frequenzen. Jede weisse Taste ist mit
// einer Elektroden-Beschriftung (z. B. Nummer) versehen und spielt
// beim Anschlag die ihr zugeordnete Frequenz. Zwischen je zwei
// weissen Tasten sitzt eine schwarze Zier-Taste auf dem
// geometrischen Mittel der Nachbarfrequenzen — sie spielt diese
// Mittelfrequenz, ist aber keiner Elektrode zugeordnet.
//
// Anschlag-Verhalten: Burst (nicht Hold). Beim mousedown / touchstart
// wird `opts.onKeyPress(electrodeIdx, hz, durationMs)` aufgerufen.
// Der Aufrufer entscheidet, wie der Ton genau gespielt wird (welche
// Seite, mit welcher Tonart, welche Pause zwischen Var/Ref).
// Schwarze Zier-Tasten rufen mit `electrodeIdx = -1` auf.
//
// Bei smplr-Tonart die noch nicht geladen ist: Tasten klingen stumm,
// Hinweistext "Laedt ..." wird eingeblendet, Lade-Trigger laeuft im
// Hintergrund. Sobald geladen: Hinweis verschwindet, kuenftige
// Anschlaege klingen.
//
// Exportiert ins globale Scope:
//   renderSamplerKeyboard(container, opts)

function renderSamplerKeyboard(container, opts) {
  if (!container || !opts) return;
  var freqs  = (typeof opts.getElectrodeFreqs  === 'function') ? opts.getElectrodeFreqs()  : [];
  var labels = (typeof opts.getElectrodeLabels === 'function') ? opts.getElectrodeLabels() : [];
  if (!Array.isArray(freqs) || freqs.length === 0) return;

  // Aussen-Wrap
  var wrap = document.createElement('div');
  wrap.className = 'sampler-keyboard';
  wrap.style.cssText = 'margin:6px 0 12px 0;';

  // Lade-Hinweis ueber dem Klavier
  var loadHint = document.createElement('div');
  loadHint.className = 'sampler-keyboard-loadhint';
  loadHint.dataset.t = 'samplerKeyboardLoading';
  loadHint.style.cssText = 'display:none;text-align:center;font-size:.9em;'
    + 'color:#d8a200;padding:2px 0 4px 0;font-style:italic;';
  loadHint.textContent = 'Laedt ...';   // wird durch applyLang ueberschrieben
  wrap.appendChild(loadHint);

  // Klavier-Reihe (relative, damit schwarze Tasten absolut positioniert werden koennen)
  var row = document.createElement('div');
  row.style.cssText = 'position:relative;display:flex;height:80px;'
    + 'border:1px solid #444;border-radius:4px;overflow:hidden;'
    + 'user-select:none;-webkit-user-select:none;touch-action:none;';

  // Weisse Tasten
  freqs.forEach(function(hz, i) {
    var key = document.createElement('div');
    key.className = 'kb-key kb-white';
    key.style.cssText = 'flex:1;border-right:1px solid #888;background:#fff;'
      + 'cursor:pointer;position:relative;display:flex;align-items:flex-end;'
      + 'justify-content:center;padding-bottom:4px;font-size:.78em;color:#333;';
    key.textContent = labels[i] != null ? String(labels[i]) : String(i + 1);
    key.dataset.electrodeIdx = String(i);
    key.dataset.hz = String(hz);
    _bindKey(key, i, hz);
    row.appendChild(key);
  });

  // Schwarze Zier-Tasten (n-1 Stueck, eine zwischen jedem weissen Paar)
  // Position: zentriert auf der Grenze zwischen weissen Taste i und i+1.
  var whiteWidthPct = 100 / freqs.length;
  for (var i = 0; i < freqs.length - 1; i++) {
    var hzBlack = Math.sqrt(freqs[i] * freqs[i + 1]);
    var leftPct = (i + 1) * whiteWidthPct - whiteWidthPct / 4;  // 1/4 nach links
    var widthPct = whiteWidthPct / 2;
    var black = document.createElement('div');
    black.className = 'kb-key kb-black';
    black.style.cssText = 'position:absolute;top:0;'
      + 'left:' + leftPct.toFixed(3) + '%;'
      + 'width:' + widthPct.toFixed(3) + '%;'
      + 'height:60%;background:#222;border:1px solid #000;'
      + 'border-radius:0 0 3px 3px;cursor:pointer;';
    black.dataset.electrodeIdx = '-1';
    black.dataset.hz = String(hzBlack);
    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  wrap.appendChild(row);
  container.appendChild(wrap);

  function _bindKey(el, idx, hz) {
    function press(ev) {
      ev.preventDefault();
      _highlight(el);
      _onPress(idx, hz);
    }
    el.addEventListener('mousedown', press);
    el.addEventListener('touchstart', press, { passive: false });
  }

  function _highlight(el) {
    var orig = el.style.background;
    el.style.background = (el.classList.contains('kb-black')) ? '#666' : '#ffe98b';
    setTimeout(function () { el.style.background = orig; }, 120);
  }

  function _onPress(idx, hz) {
    var toneType = (typeof opts.getCurrentToneType === 'function')
      ? opts.getCurrentToneType() : '';
    // smplr-Tonart die noch nicht geladen ist: stumm + Lade-Trigger + Hinweis
    if (typeof toneType === 'string'
        && toneType.indexOf('smplr:') === 0
        && typeof smplrSamplerIsReady === 'function'
        && !smplrSamplerIsReady(toneType)) {
      loadHint.style.display = 'block';
      if (typeof loadSamplerByToken === 'function') {
        var c = (typeof gAC === 'function') ? gAC() : null;
        if (c) {
          loadSamplerByToken(c, toneType).then(function () {
            loadHint.style.display = 'none';
          }).catch(function () {
            loadHint.style.display = 'none';
          });
        }
      }
      return;
    }
    // Normal: an Aufrufer delegieren
    var dur = (typeof opts.getDuration === 'function') ? opts.getDuration() : 1000;
    if (typeof opts.onKeyPress === 'function') {
      try { opts.onKeyPress(idx, hz, dur); } catch (e) { /* swallow */ }
    }
  }
}
```

## Schritt 2 — `js/tone-popup.js` Klavier-Einbettung

In `js/tone-popup.js` in `openToneSelectionDialog`, direkt **nach**
dem Hinweistext-Element (`hint`) und **vor** der `GROUPS.forEach(...)`-
Render-Schleife, eine optionale Klavier-Einbettung einfuegen.

Aktuelle Stelle ist die `hint`-Erstellung gefolgt von
`GROUPS.forEach(...)`. Vor `GROUPS.forEach(...)` einfuegen:

```js
  // BA 228: Optionales Klavier-Widget oberhalb der Tonart-Liste.
  // Wird nur gerendert, wenn cfg.keyboardMode aktiv und alle
  // benoetigten Helfer existieren. Aufrufer (z. B. freqmatch.js) liefert
  // Elektroden-Frequenzen, -Labels und Anschlag-Logik selbst.
  if (cfg.keyboardMode
      && typeof renderSamplerKeyboard === 'function'
      && typeof cfg.getElectrodeFreqs === 'function') {
    var kbWrap = document.createElement('div');
    dlg.appendChild(kbWrap);
    try {
      renderSamplerKeyboard(kbWrap, {
        getElectrodeFreqs:   cfg.getElectrodeFreqs,
        getElectrodeLabels:  cfg.getElectrodeLabels,
        getCurrentToneType:  cfg.getToneType,
        onKeyPress:          cfg.onKeyPress,
        getDuration:         cfg.getDuration
      });
    } catch (e) { /* swallow — Klavier-Render-Fehler darf das Modal nicht killen */ }
  }
```

Wichtig: die bestehenden `GROUPS.forEach(...)` und alle anderen
Elemente bleiben unveraendert. Das Klavier sitzt zwischen `hint`
und der ersten Gruppe.

## Schritt 3 — `index.html` Lade-Reihenfolge

In `index.html` (etwa Z. 141) `sampler-keyboard.js` direkt **nach**
`tone-popup.js` einfuegen — Klavier-Modul muss zur Render-Zeit der
Modalbox erreichbar sein.

**Vorher** (Z. 141, nach BA 227):
```js
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/tone-popup.js', 'js/test-ui.js', 'js/test.js', ...
```

**Nachher**:
```js
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/tone-popup.js', 'js/sampler-keyboard.js', 'js/test-ui.js', 'js/test.js', ...
```

## Schritt 4 — `js/freqmatch.js` cfg-Provider erweitern

In `js/freqmatch.js` die `tonePopupButton`-cfg (aktuell Z. 1070-...,
das Objekt mit `getToneType`/`setToneType`/`getVolume`/`getPreviewSequence`)
um vier neue Felder erweitern.

Direkt nach `getPreviewSequence` einfuegen (oder am Ende des
Objekt-Literals — Reihenfolge egal):

```js
          // BA 228: Klavier-Widget in der Modalbox aktivieren.
          keyboardMode: true,
          getElectrodeFreqs: function() {
            // Aktive Elektroden der var-Seite (CI-Seite im Freqmatch-Kontext).
            // Wenn fmVarSide nicht gesetzt ist (vor erstem Test), Fallback
            // auf activeSide.
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
              for (var i = 0; i < elActive.length; i++) {
                if (elActive[i] === false) continue;
                labels.push(String(i + 1));
              }
            });
            return labels;
          },
          getDuration: function() { return fmGDur(); },
          onKeyPress: function(electrodeIdx, hz, durMs) {
            // Frequenzabgleich-Burst-Sequenz: Var-Seite-Burst,
            // kurze Pause, dann Ref-Seite-Burst (gleiche Frequenz).
            // Schwarze Zier-Tasten (electrodeIdx === -1) spielen
            // ihre Mittelfrequenz auch nach diesem Schema.
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var vol = fmGVol();
            var pauMs = fmGPau();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide)
              ? fmVarSide : activeSide;
            var varPan = (varSide === 'left') ? -1 : 1;
            var refPan = -varPan;
            var tt = toneType_freqmatch;
            try {
              playToneTyped(c, hz, vol, durMs, varPan, tt);
              setTimeout(function() {
                playToneTyped(c, hz, vol, durMs, refPan, tt);
              }, durMs + pauMs);
            } catch (e) { /* swallow */ }
          },
```

Die uebrigen Felder (`getToneType`, `setToneType`, `getVolume`,
`getPreviewSequence`) bleiben unveraendert. Das Modal entscheidet
selbst, ob es das Klavier rendert (cfg.keyboardMode-Check in
tone-popup.js).

## Schritt 5 — i18n (alle 4 Sprachen, 1 Key)

Ein einzelner Key — gleich in alle vier Sprachen, ist trivial.

In `i18n/de.js` an thematisch passender Stelle (in der Naehe der
`toneGroupMellotron`-Keys oder bei den `tonePopup*`-Keys):

```js
  samplerKeyboardLoading: "Laedt ...",
```

In `i18n/en.js`:

```js
  samplerKeyboardLoading: "Loading ...",
```

In `i18n/fr.js`:

```js
  samplerKeyboardLoading: "Chargement ...",
```

In `i18n/es.js`:

```js
  samplerKeyboardLoading: "Cargando ...",
```

## Schritt 6 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.228-beta";
```

## Schritt 7 — `docs/CODESTRUKTUR.md`

Neuen Eintrag fuer `sampler-keyboard.js` in der `js/`-Tabelle.
Vorschlag direkt nach `tone-popup.js` (z. B. als Eintrag `7b`):

```
| 7b | sampler-keyboard.js | Klavier-Widget fuer die Tonart-Modalbox: `renderSamplerKeyboard(container, opts)`. Tasten pro aktiver Elektrode (Beschriftung mit Elektrodennummer); zwischen je zwei weissen Tasten eine schwarze Zier-Taste auf dem geometrischen Mittel der Nachbarfrequenzen. Anschlag = Burst (mousedown/touchstart) ruft `opts.onKeyPress(electrodeIdx, hz, durationMs)` auf — Aufrufer implementiert die konkrete Tonwiedergabe (Var/Ref-Seitenwahl, Pause). Schwarze Tasten rufen mit `electrodeIdx === -1`. Bei smplr-Tonart die noch nicht geladen ist: Lade-Hinweis "Laedt ..." (i18n `samplerKeyboardLoading`) ueber dem Klavier, stumm bis Sampler ready. (BA 228) |
```

Im `tone-popup.js`-Eintrag (`7a`, aus BA 227) am Ende ergaenzen:

```
**Seit BA 228**: optionaler Klavier-Block oberhalb der GROUPS-Liste, gerendert wenn `cfg.keyboardMode` gesetzt. Modalbox kennt das Klavier nur abstrakt — `renderSamplerKeyboard` aus `js/sampler-keyboard.js` uebernimmt die Render-Logik, Aufrufer-Logik (Frequenzabgleich-Sequenz) sitzt in `cfg.onKeyPress`.
```

## Schritt 8 — `docs/spec/02-messung.md`

Im Abschnitt zur Tonauswahl-Modalbox kurz erwaehnen:

```
Seit BA 228 enthaelt die Modalbox optional ein Klavier-Widget
oberhalb der Tonart-Liste (cfg.keyboardMode = true im Frequenz-
abgleich). Tastenzahl = aktive Elektroden der var-Seite,
beschriftet mit Elektrodennummer; zwischen je zwei weissen Tasten
eine schwarze Zier-Taste auf dem geometrischen Mittel der Nachbar-
frequenzen. Anschlag spielt im Frequenzabgleich-Kontext Burst auf
var-Seite, kurze Pause, Burst auf ref-Seite — beide mit aktueller
Tondauer und Pause aus dem Test-Header (fmGDur, fmGPau). Bei smplr-
Tonart die noch nicht geladen ist: Lade-Hinweis "Laedt ..." ueber
dem Klavier, stumm bis Sampler ready.
```

## Akzeptanztest (Nutzer)

Setup: Tool hart neu laden (Strg+Shift+R).

1. Versionslabel zeigt `3.2.228-beta`.
2. Tab Messungen -> Frequenzabgleich -> Tonart-Button -> Modalbox
   oeffnet. Oberhalb der Tonart-Gruppen ist jetzt ein Klavier
   sichtbar. Anzahl weisser Tasten = Anzahl aktiver Elektroden der
   var-Seite (typisch 11-12 bei MED-EL). Tasten sind durchnummeriert.
3. Zwischen weissen Tasten gibt es schmalere schwarze Zier-Tasten
   (n-1 Stueck).
4. **Sinus-Test**: Tonart "Sinus" auswaehlen. Klick auf weisse
   Taste #1 -> Burst auf var-Seite, kurze Pause, Burst auf ref-
   Seite (beide auf der Elektroden-Frequenz). Optisches Aufleuchten
   der Taste beim Anschlag.
5. Klick auf eine schwarze Zier-Taste zwischen zwei weissen ->
   gleiches Schema, aber Frequenz liegt zwischen den Nachbarn.
6. Klick auf andere weisse Taste #5 -> hoehere Frequenz hoerbar.
7. **Mellotron-Test (nicht geladen)**: Tonart "TRON FLUTE"
   auswaehlen (falls noch nicht geladen: Sanduhr am Vorspiel-Knopf
   erscheint, BA 226-Hintergrund-Lade laeuft). Schon waehrend
   Lade ohne abzuwarten Klick auf Klavier-Taste:
   - Klang stumm.
   - "Laedt ..."-Hinweis (gold-gelb) ueber dem Klavier sichtbar.
   - Nach Lade-Fertigstellung: Hinweis verschwindet.
8. Erneut Klick auf Klavier-Taste -> Floetenklang hoerbar.
9. **Andere Verfahren** (Latenz, Stereo-Balance, LR-Balance,
   Frequenzabgleich Vortest): Modalbox oeffnet ohne Klavier
   (cfg.keyboardMode dort nicht gesetzt) — exakt wie 3.2.227-beta.
   Regression.
10. **Touch-Test (mobile/Tablet)**: Tippen auf weisse Taste
    funktioniert genauso wie Maus-Klick. Kein Scroll-Konflikt.
11. **Test-laufender Frequenzabgleich**: waehrend ein Frequenz-
    abgleich-Test laeuft (Slider-Modus mit aktivem Trial), Tonart-
    Button anklicken -> Modalbox oeffnet, Klavier zeigt die aktive
    var-Seite. Klick auf Klavier-Taste spielt parallel zum
    laufenden Test (kein Konflikt).
12. **Beidseitig CI**: Wenn beide Seiten als CI markiert sind, ist
    das Klavier auf der var-Seite — Klick spielt Var-Burst auf
    var-Seite, dann Ref-Burst auf ref-Seite mit der gleichen
    Frequenz (keine Cent-Verschiebung — das Klavier dient zum
    Klang-Antesten, nicht zum Frequenz-Matching).

## Selbstprueffungs-Auftrag an Sonnet

VOR der Fertig-Meldung jede Akzeptanz-Kriterie 1-12 einzeln:
erfuellt / nicht erfuellt / unklar (mit Datei- und Zeilenangabe).

Zusatz-Pruefungen:
- `js/version.js` enthaelt `"3.2.228-beta"`. Zeile nennen.
- `js/sampler-keyboard.js` existiert, exportiert `renderSamplerKeyboard`
  als top-level function. Datei-Groesse erwartet ~120-150 Zeilen.
- `js/tone-popup.js` enthaelt im Aufbau-Block zwischen `hint` und
  `GROUPS.forEach` den neuen `cfg.keyboardMode`-Branch mit
  `renderSamplerKeyboard`-Aufruf. Zeile nennen.
- `js/freqmatch.js` `tonePopupButton`-cfg enthaelt die vier neuen
  Felder: `keyboardMode`, `getElectrodeFreqs`, `getElectrodeLabels`,
  `getDuration`, `onKeyPress`. Zeilen nennen.
- `index.html` Z. ~141 enthaelt `'js/sampler-keyboard.js',`
  zwischen `'js/tone-popup.js',` und `'js/test-ui.js',`. Zeile nennen.
- i18n: jedes der vier Sprachfiles enthaelt
  `samplerKeyboardLoading:`. Stichprobe pro Datei.
- `docs/CODESTRUKTUR.md` enthaelt den neuen `7b`-Eintrag und die
  Ergaenzung am Ende von `7a`. Beide Zeilen nennen.
- `docs/spec/02-messung.md` enthaelt den neuen Klavier-Abschnitt.

Bei "unklar" oder "nicht erfuellt": STOP und beim Nutzer
rueckfragen.

## Nach Abschluss manuell pruefen (Zwischenpruefung)

- Versionslabel `3.2.228-beta`.
- Klavier sichtbar in der Modalbox des Frequenzabgleich.
- Anschlag macht hoerbare Toene fuer alle bisherigen Tonarten
  (Sinus, Komplex, Rich-Profile, Noise) und fuer Mellotron-Varianten
  nach erstem Lade-Vorlauf.
- Modalbox in anderen Verfahren unveraendert (kein Klavier).
- Anschliessend kann BA 229 (Lautstaerke/Tondauer/Pause in der
  Modalbox) starten.
