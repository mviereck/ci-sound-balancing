# Bauanleitung 229 — Klavier-Widget: Burst-/Hold-Modi, Nachbar-Highlight, E-Labels

## Ziel

Das Klavier-Widget in der Tonart-Modalbox (`js/sampler-keyboard.js`,
BA 228) bekommt eine API, mit der der Aufrufer steuert, **wie** ein
Anschlag klingt. Drei künftige Aufrufer mit drei Verhaltensweisen:

- **Frequenzabgleich** (heute): Burst-Pärchen Var-Seite → Pause →
  Ref-Seite, wie im laufenden Test.
- **Elektrodenlautstärke** (später): einseitiger Burst auf der
  angeklickten Elektrode.
- **Implantat-Reiter** (später): Ton spielt, solange die Taste
  gedrückt bleibt (Hold).

Das Widget selbst kennt nur „Burst" oder „Hold" und liefert pro
Anschlag (a) den Trigger an den Aufrufer und (b) das Aufleuchten
der Taste(n). Burst-Modus: Aufleucht-Dauer kommt aus dem Aufrufer
via `getHighlightMs()`. Hold-Modus: leuchtet, solange gedrückt.

Zusätzlich:

- Weiße Tasten werden **„E1, E2, …"** statt nur Zahlen beschriftet
  (Aufrufer liefert die Strings, das Widget rendert sie wörtlich).
- Beim Anschlag einer schwarzen Zier-Taste leuchten zusätzlich die
  beiden weißen Nachbartasten mit.

Keine UI-Texte neu, deshalb keine i18n-Arbeit nötig.

---

## Versionssprung

Diese BA bumpt die Version auf `3.2.229-beta`.

Datei: `js/version.js`

```js
const APP_VERSION = "3.2.229-beta";
```

(Vorher: `3.2.228.1-beta`.)

---

## Schritt 1 — `js/sampler-keyboard.js` neu schreiben

Die Datei kann **komplett ersetzt** werden — die alte API
`onKeyPress(idx, hz, durationMs)` wird durch eine neue ersetzt:

- `opts.onPress(idx, hz)` — bei jedem Anschlag.
- `opts.onRelease(idx, hz)` — **nur Hold-Modus**, beim Loslassen.
- `opts.getHighlightMs()` — **nur Burst-Modus**, liefert die
  Aufleucht-Dauer in ms (= Tondauer, die der Aufrufer selbst kennt).

Der Modus wird **implizit** aus den Callbacks abgeleitet:

- `onRelease` vorhanden → **Hold-Modus**.
- sonst → **Burst-Modus** (auch wenn `getHighlightMs` fehlt; dann
  leuchtet die Taste 0 ms, also gar nicht sichtbar, was als
  Konfigurationsfehler des Aufrufers gilt).

### Datei-Inhalt (komplett ersetzen)

`js/sampler-keyboard.js`:

```js
// ============================================================
// SAMPLER-KEYBOARD — Klavier-Widget fuer die Tonart-Modalbox
// ============================================================
// Rendert ein einfaches Klavier mit einer weissen Taste pro
// uebergebener Elektroden-Frequenz. Jede weisse Taste ist mit
// einer Aufrufer-gelieferten Beschriftung versehen (z. B. "E1").
// Zwischen je zwei weissen Tasten sitzt eine schwarze Zier-Taste
// auf dem geometrischen Mittel der Nachbarfrequenzen.
//
// Zwei Modi, implizit aus den Callbacks abgeleitet:
//
//   Burst-Modus (Default):
//     opts.onPress(idx, hz)       -> Aufrufer spielt selbst
//     opts.getHighlightMs() -> ms -> Aufleucht-Dauer pro Anschlag
//
//   Hold-Modus (wenn onRelease vorhanden):
//     opts.onPress(idx, hz)       -> Pointerdown
//     opts.onRelease(idx, hz)     -> Pointerup/cancel/leave
//
// Schwarze Zier-Tasten rufen mit electrodeIdx = -1 auf und
// leuchten zusammen mit ihren beiden weissen Nachbarn auf,
// solange der Anschlag aktiv ist.
//
// Bei smplr-Tonart die noch nicht geladen ist: Anschlag bleibt
// stumm, Hinweistext "Laedt ..." wird eingeblendet, Lade-Trigger
// laeuft im Hintergrund. Es wird weder onPress noch onRelease
// gerufen.
//
// Exportiert ins globale Scope:
//   renderSamplerKeyboard(container, opts)

function renderSamplerKeyboard(container, opts) {
  if (!container || !opts) return;
  var freqs  = (typeof opts.getElectrodeFreqs  === 'function') ? opts.getElectrodeFreqs()  : [];
  var labels = (typeof opts.getElectrodeLabels === 'function') ? opts.getElectrodeLabels() : [];
  if (!Array.isArray(freqs) || freqs.length === 0) return;

  var isHold = (typeof opts.onRelease === 'function');

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

  // Tasten-Referenzen sammeln, damit das Nachbar-Highlight beim
  // schwarzen Anschlag ohne DOM-Selector auskommt.
  var whiteKeys = [];                                // index = electrodeIdx
  var blackKeys = new Array(freqs.length - 1);       // index = 0..n-2

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
    whiteKeys[i] = key;
    _bindKey(key, i, hz);
    row.appendChild(key);
  });

  // Schwarze Zier-Tasten (n-1 Stueck, eine zwischen jedem weissen Paar)
  var whiteWidthPct = 100 / freqs.length;
  for (var i = 0; i < freqs.length - 1; i++) {
    var hzBlack = Math.sqrt(freqs[i] * freqs[i + 1]);
    var leftPct = (i + 1) * whiteWidthPct - whiteWidthPct / 4;
    var widthPct = whiteWidthPct / 2;
    var black = document.createElement('div');
    black.className = 'kb-key kb-black';
    black.style.cssText = 'position:absolute;top:0;'
      + 'left:' + leftPct.toFixed(3) + '%;'
      + 'width:' + widthPct.toFixed(3) + '%;'
      + 'height:60%;background:#222;border:1px solid #000;'
      + 'border-radius:0 0 3px 3px;cursor:pointer;';
    black.dataset.electrodeIdx = '-1';
    black.dataset.blackIdx     = String(i);
    black.dataset.hz           = String(hzBlack);
    blackKeys[i] = black;
    _bindKey(black, -1, hzBlack);
    row.appendChild(black);
  }

  wrap.appendChild(row);
  container.appendChild(wrap);

  // ---- Hilfsfunktionen ------------------------------------------------

  // Liefert das Tasten-Bundle, das beim Anschlag aufleuchten soll.
  // Schwarze Taste: sich selbst + beide weisse Nachbarn (sofern vorhanden).
  // Weisse Taste: nur sich selbst.
  function _keysToHighlight(el) {
    if (el.classList.contains('kb-white')) return [el];
    var bIdx = parseInt(el.dataset.blackIdx, 10);
    var arr = [el];
    if (whiteKeys[bIdx]     != null) arr.push(whiteKeys[bIdx]);
    if (whiteKeys[bIdx + 1] != null) arr.push(whiteKeys[bIdx + 1]);
    return arr;
  }

  function _highlightOn(els) {
    els.forEach(function(e) {
      if (e._origBg == null) e._origBg = e.style.background || '';
      e.style.background = e.classList.contains('kb-black') ? '#666' : '#ffe98b';
    });
  }
  function _highlightOff(els) {
    els.forEach(function(e) {
      if (e._origBg != null) {
        e.style.background = e._origBg;
        e._origBg = null;
      }
    });
  }

  // Pruefung auf nicht-geladenen smplr-Sampler. Returnwert true =
  // Anschlag bleibt stumm, Aufrufer-Callbacks werden nicht gefeuert.
  function _smplrBlocksPress() {
    var toneType = (typeof opts.getCurrentToneType === 'function')
      ? opts.getCurrentToneType() : '';
    if (typeof toneType !== 'string' || toneType.indexOf('smplr:') !== 0) return false;
    if (typeof smplrSamplerIsReady !== 'function') return false;
    if (smplrSamplerIsReady(toneType)) return false;
    // nicht ready -> Lade-Hinweis + Trigger im Hintergrund
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
    return true;
  }

  // ---- Trigger-Bindung pro Taste -------------------------------------

  function _bindKey(el, idx, hz) {
    var hlEls = _keysToHighlight(el);

    if (isHold) {
      var active = false;
      function down(ev) {
        if (active) return;
        ev.preventDefault();
        if (_smplrBlocksPress()) return;
        active = true;
        if (typeof el.setPointerCapture === 'function' && ev.pointerId != null) {
          try { el.setPointerCapture(ev.pointerId); } catch (e) {}
        }
        _highlightOn(hlEls);
        try { opts.onPress(idx, hz); } catch (e) {}
      }
      function up() {
        if (!active) return;
        active = false;
        _highlightOff(hlEls);
        try { opts.onRelease(idx, hz); } catch (e) {}
      }
      el.addEventListener('pointerdown',   down);
      el.addEventListener('pointerup',     up);
      el.addEventListener('pointercancel', up);
      // pointerleave als Sicherheitsnetz, falls setPointerCapture
      // im Browser nicht greift.
      el.addEventListener('pointerleave',  up);
      return;
    }

    // Burst-Modus
    function press(ev) {
      ev.preventDefault();
      if (_smplrBlocksPress()) return;
      var ms = (typeof opts.getHighlightMs === 'function') ? opts.getHighlightMs() : 0;
      _highlightOn(hlEls);
      if (ms > 0) {
        setTimeout(function () { _highlightOff(hlEls); }, ms);
      } else {
        _highlightOff(hlEls);
      }
      try { opts.onPress(idx, hz); } catch (e) {}
    }
    el.addEventListener('pointerdown', press);
  }
}
```

**Achtung — Nicht ändern:**
- Die Tonart-Lade-Logik (`smplrSamplerIsReady`, `loadSamplerByToken`,
  `loadHint`) bleibt funktional gleich, nur in einen Helfer
  `_smplrBlocksPress` ausgelagert.
- `dataset.electrodeIdx` und `dataset.hz` bleiben für externe
  Diagnose erhalten; `dataset.blackIdx` ist neu.

---

## Schritt 2 — `js/freqmatch.js` Klavier-Aufruf anpassen

Datei: `js/freqmatch.js`, Zeilen ca. 1112–1163 (BA-228-Block
„Klavier-Widget in der Modalbox aktivieren").

### Vorher (Ausgangszustand)

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
          }
        },
```

### Nachher (gewünschter Zustand)

```js
          // BA 228/229: Klavier-Widget in der Modalbox aktivieren.
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
            // BA 229: "E1, E2, ..." statt nackter Zahlen — Praefix und
            // Reihenfolge folgen der CI-Konvention der var-Seite.
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
          // BA 229: Aufleucht-Dauer = volle Sequenz (Var-Burst + Pause +
          // Ref-Burst), passt zur Anschlag-Logik in onPress.
          getHighlightMs: function() { return fmGDur() * 2 + fmGPau(); },
          onPress: function(electrodeIdx, hz) {
            // Frequenzabgleich-Burst-Sequenz: Var-Seite-Burst,
            // kurze Pause, dann Ref-Seite-Burst (gleiche Frequenz).
            // Schwarze Zier-Tasten (electrodeIdx === -1) spielen
            // ihre Mittelfrequenz auch nach diesem Schema.
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var vol   = fmGVol();
            var durMs = fmGDur();
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
          }
        },
```

**Drei Einzelpunkte zum Abgleich:**

1. `getElectrodeLabels`: in der Schleife jetzt `prefix + dEN(i)`
   statt `String(i + 1)`; `prefix` einmal vor der Schleife aus
   `dENPrefix()` lesen.
2. `getDuration`-Feld **entfällt** (alter Vertrag des Widgets).
3. `getHighlightMs`-Feld **neu**.
4. `onKeyPress` → `onPress` umbenannt; **Signatur ohne `durMs`**;
   `durMs` jetzt im Funktionsrumpf via `fmGDur()` ermittelt.

---

## Schritt 3 — `docs/CODESTRUKTUR.md` aktualisieren

In `docs/CODESTRUKTUR.md` die Zeile zu `sampler-keyboard.js`
(Tabellenzeile `| 7b | sampler-keyboard.js | …`) ersetzen. Das
heutige Ende-Datum (BA 228) bleibt als historische Markierung
drin; die API-Beschreibung wird auf BA 229 fortgeschrieben.

### Vorher

```
| 7b | sampler-keyboard.js | Klavier-Widget für die Tonart-Modalbox: `renderSamplerKeyboard(container, opts)`. Tasten pro aktiver Elektrode (Beschriftung mit Elektrodennummer); zwischen je zwei weißen Tasten eine schwarze Zier-Taste auf dem geometrischen Mittel der Nachbarfrequenzen. Anschlag = Burst (mousedown/touchstart) ruft `opts.onKeyPress(electrodeIdx, hz, durationMs)` auf — Aufrufer implementiert die konkrete Tonwiedergabe (Var/Ref-Seitenwahl, Pause). Schwarze Tasten rufen mit `electrodeIdx === -1`. Bei smplr-Tonart die noch nicht geladen ist: Lade-Hinweis „Lädt ..." (i18n `samplerKeyboardLoading`) über dem Klavier, stumm bis Sampler ready. (BA 228) |
```

### Nachher

```
| 7b | sampler-keyboard.js | Klavier-Widget für die Tonart-Modalbox: `renderSamplerKeyboard(container, opts)`. Tasten pro aktiver Elektrode mit Aufrufer-gelieferter Beschriftung (`opts.getElectrodeLabels`); zwischen je zwei weißen Tasten eine schwarze Zier-Taste auf dem geometrischen Mittel der Nachbarfrequenzen. Pointer-Events (pointerdown/up/cancel/leave). **Seit BA 229**: Zwei Modi, implizit aus den Callbacks abgeleitet — **Burst** (`opts.onPress(idx, hz)` + `opts.getHighlightMs() → ms`, Highlight läuft genau diese Dauer und springt dann zurück) und **Hold** (zusätzlich `opts.onRelease(idx, hz)`; Highlight an bei pointerdown, aus bei pointerup/cancel/leave, `setPointerCapture` falls verfügbar). Schwarze Zier-Tasten rufen mit `electrodeIdx === -1` und leuchten zusammen mit ihren beiden weißen Nachbartasten auf (Tasten-Referenzen werden beim Render in `whiteKeys[]`/`blackKeys[]` gesammelt, kein DOM-Selector zur Laufzeit). FreqMatch beschriftet via `dENPrefix() + dEN(i)` (Form „E1", „E2", …). Bei smplr-Tonart die noch nicht geladen ist: Lade-Hinweis „Lädt ..." (i18n `samplerKeyboardLoading`) über dem Klavier, stumm bis Sampler ready, weder `onPress` noch `onRelease` werden gefeuert. (BA 228, API umgestellt in BA 229) |
```

Außerdem die Zeile zu `tone-popup.js` (Tabellenzeile
`| 7a | tone-popup.js | …`) am Ende den BA-228-Klavier-Satz
anpassen — `cfg.onKeyPress` → `cfg.onPress`/`cfg.onRelease`,
`cfg.getDuration` → `cfg.getHighlightMs`:

### Vorher (letzter Satz der Zeile)

```
**Seit BA 228**: optionaler Klavier-Block oberhalb der GROUPS-Liste, gerendert wenn `cfg.keyboardMode` gesetzt. Modalbox kennt das Klavier nur abstrakt — `renderSamplerKeyboard` aus `js/sampler-keyboard.js` übernimmt die Render-Logik, Aufrufer-Logik (Frequenzabgleich-Sequenz) sitzt in `cfg.onKeyPress`. |
```

### Nachher

```
**Seit BA 228**: optionaler Klavier-Block oberhalb der GROUPS-Liste, gerendert wenn `cfg.keyboardMode` gesetzt. Modalbox kennt das Klavier nur abstrakt — `renderSamplerKeyboard` aus `js/sampler-keyboard.js` übernimmt die Render-Logik, Aufrufer-Logik (Anschlag-Verhalten) sitzt in `cfg.onPress`/`cfg.onRelease`/`cfg.getHighlightMs` (API umgestellt in BA 229). |
```

Hinweis an Sonnet: `js/tone-popup.js` selbst muß nicht angefaßt
werden — die Datei reicht die Klavier-Konfiguration einfach an
`renderSamplerKeyboard` durch, ohne ihre Felder zu kennen.

Quer-Prüfung: kein Aufruf von `renderSamplerKeyboard` in einer
**anderen** Datei als `tone-popup.js`. Mit
`grep -rn "renderSamplerKeyboard\|onKeyPress\|getDuration:" js/`
abgleichen — Treffer ausschließlich in den drei in dieser BA
angefaßten Dateien plus der Zeile in `tone-popup.js:166–183`,
die nur die Optionen durchreicht und deshalb keine Anpassung
braucht.

---

## Akzeptanztest (Klick-für-Klick durch den Nutzer)

Voraussetzung: linke Seite akustisch ODER beide Seiten CI; rechte
Seite CI mit einigen aktiven Elektroden (Default-Setup nach
Reset reicht).

1. **Browser hart neu laden** (Strg+Umschalt+R oder Cmd+Shift+R).
   - **Erwartet**: Versions-Anzeige im Header zeigt `3.2.229-beta`.

2. **Reiter „Messungen" → Sub-Tab „Frequenzabgleich"** öffnen,
   ggf. einen Test starten, der das Header-Tonart-Auswahlfenster
   anbietet (Knopf „Tonart").

3. **Klavier oben in der Modalbox**.
   - **Erwartet**: Weiße Tasten sind mit `E1`, `E2`, `E3`, …
     beschriftet (CI-Konvention; bei Cochlear ggf. in umgekehrter
     Reihenfolge — das ist gewollt). Vorher standen dort nackte
     Zahlen `1`, `2`, `3`, ….

4. **Auf eine weiße Taste klicken** (z. B. `E3`).
   - **Erwartet**: Taste leuchtet gelb auf. Hörbar: Burst auf der
     CI/Var-Seite, kurze Pause, dann Burst auf der Ref-Seite.
     Aufleuchten dauert genau die volle Sequenz (ca. doppelte
     Tondauer plus eingestellte Pause) und endet **mit** dem
     letzten Burst, nicht früher.

5. **Auf eine schwarze Zier-Taste klicken** (eine der dunklen
   Tasten zwischen zwei weißen).
   - **Erwartet**: Schwarze Taste leuchtet auf **und** die beiden
     unmittelbar benachbarten weißen Tasten leuchten zusätzlich
     gelb auf, alle drei während der gesamten Burst-Sequenz.
     Hörbar: gleiche Burst-Sequenz wie bei einer weißen Taste,
     aber auf der geometrischen Mittenfrequenz zwischen den
     beiden Nachbar-Elektroden.

6. **Schnell hintereinander auf zwei verschiedene Tasten klicken**.
   - **Erwartet**: Kein dauerhaftes Aufleuchten (Highlight-Timer
     dürfen sich nicht „verheddern"). Beide Anschläge spielen
     getrennt ab.

7. **Wechsel der Tonart auf eine Mellotron-Variante**, die noch
   nicht geladen ist; danach **sofort auf eine Klaviertaste klicken**.
   - **Erwartet**: Kein Ton, kein Highlight, stattdessen erscheint
     der gelbe „Lädt …"-Hinweis über dem Klavier. Sobald der
     Sampler geladen ist, verschwindet der Hinweis; ein erneuter
     Klick auf eine Klaviertaste spielt und leuchtet wie in (4).

8. **„Abbrechen"** im Tonart-Modal klicken.
   - **Erwartet**: Modal schließt, kein Crash, keine Konsolen-Fehler.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor** der Fertig-Meldung jede der folgenden Akzeptanz-Kriterien
einzeln durchgehen und melden „erfüllt / nicht erfüllt / unklar"
mit Datei- und Zeilenangabe:

- (1) `js/version.js` enthält exakt `const APP_VERSION = "3.2.229-beta";`.
- (2) `js/sampler-keyboard.js` exportiert weiterhin nur
  `renderSamplerKeyboard` (keine zusätzlichen Globals).
- (3) `getElectrodeLabels` in `js/freqmatch.js` ruft `dENPrefix()`
  **innerhalb** von `withSide(side, …)` auf (sonst falsche Seite).
- (4) `getDuration`-Feld in der Klavier-Konfig in
  `js/freqmatch.js` ist entfernt; `getHighlightMs` ist hinzugefügt.
- (5) `onKeyPress` umbenannt zu `onPress`; **kein** `durationMs`-
  Parameter in der Signatur.
- (6) Im Widget: schwarze Tasten setzen `dataset.blackIdx`.
- (7) Im Widget: Hold-Modus wird **ausschließlich** über
  `typeof opts.onRelease === 'function'` erkannt.
- (8) Im Widget: kein Aufruf von `onPress` oder `onRelease`,
  wenn `_smplrBlocksPress()` `true` liefert (auch nicht von
  `_highlightOn`/`_highlightOff`).
- (9) Im Widget: Pointer-Events `pointerdown`/`up`/`cancel`/`leave`;
  keine zusätzlichen `mousedown`/`touchstart`-Listener.
- (10) `docs/CODESTRUKTUR.md`: Zeile zu `sampler-keyboard.js` und
  Zeile zu `tone-popup.js` aktualisiert wie in Schritt 3.
- (11) `grep -rn "onKeyPress" js/` liefert **keinen** Treffer mehr
  in `js/sampler-keyboard.js` und `js/freqmatch.js`.
- (12) `grep -rn "getDuration:" js/` liefert **keinen** Treffer
  mehr in `js/freqmatch.js` für den Klavier-Block (BA-228-Block).

Wenn ein Punkt unklar bleibt: Rückfrage an den Nutzer, **nicht**
still annehmen.

---

## Hinweise an Sonnet zur Vorsicht

- **Keine ASCII-Quote-Schlampereien**: das Snippet enthält reine
  ASCII-Zeichen für JS-String-Begrenzer; bitte beim Übernehmen
  keine typographischen Anführungszeichen einschleichen lassen.
- **`tone-popup.js` nicht anfassen** — die Datei reicht die
  Klavier-Konfiguration generisch durch und ist API-agnostisch.
- **Keine i18n-Strings hinzufügen oder ändern** in dieser BA.
  Der Lade-Hinweis `samplerKeyboardLoading` bleibt unverändert.
- **Andere FreqMatch-Pfade nicht anfassen** — nur der BA-228-Block
  innerhalb von `fmCfg.header.common.tonePopupButton` (oder wie er
  in der jeweiligen Datei eingebettet ist) wird verändert. Der
  übrige `getPreviewSequence`-Aufruf darüber bleibt komplett wie er
  ist; er hat mit dem Klavier nichts zu tun.
