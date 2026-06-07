# BA 226 — Sanduhr-Visualisierung beim Sampler-Laden

## Ziel

UX-Beobachtung aus BA 225: Beim Klick auf "Vorspielen" einer noch
nicht geladenen Sampler-Tonart (Mellotron, Soundfont2) werden alle
Vorspiel-Buttons grau, springen nach kurzer Zeit zurueck, der Nutzer
hoert aber nichts und weiss nicht warum.

Ab dieser BA: bei smplr-Tonarten, die noch nicht geladen sind, wird
vor dem Klick-betroffenen Button eine kleine Sanduhr (⧖) eingeblendet
und der Button bleibt waehrend des Lade-Vorgangs grau. Sobald der
Sampler geladen ist, verschwindet die Sanduhr und die normale
Vorspiel-Sequenz startet automatisch. Bei Lade-Fehler verschwinden
Sanduhr und Grau ebenfalls, ohne Klang.

Zusatz: Bereits beim **Auswaehlen** des Radio-Buttons einer Sampler-
Tonart (also vor dem Vorspiel-Klick) wird der Sampler im Hintergrund
geladen. Die Sanduhr erscheint sofort am dazugehoerigen Vorspiel-
Button, der Vorspiel-Button bleibt aber klickbar. Klickt der User
dann waehrend des Hintergrund-Ladens auf Vorspiel, greift die
Sanduhr-/Auto-Replay-Mechanik aus dem Vorspiel-Branch nahtlos. So
ist der spaetere Vorspiel-Klick oft schon ohne Wartezeit hoerbar
(weil der User typisch erst auswaehlt, kurz nachdenkt und erst dann
Vorspielen klickt). Hintergrund: die smplr-Library selbst ist klein
(0,3 MB) und schon beim Tool-Start geladen, aber die eigentlichen
Samples (Mellotron 1-5 MB pro Variante, SF2 10-30 MB pro Datei) sind
zusammengerechnet ueber 150 MB und werden deshalb nicht vorgeladen,
sondern erst beim ersten konkreten Interesse einer Tonart.

Voraussetzung: BA 224 und BA 225 sind gebaut. Aktuelle Version
3.2.225.x-beta.

Versionsbump: nach dieser BA auf 3.2.226-beta.

## Was diese BA NICHT macht

- Keine Klaviatur (das ist BA 227).
- Keine Aenderung der Vorspiel-Sequenz-Logik (Quelle bleibt
  `cfg.getPreviewSequence()`). Der Vorhoer-Umbau auf "letzte Frequenz/
  Dauer" kommt erst in BA 228.
- Keine i18n-Strings (⧖ ist sprachneutral).
- Keine Aenderungen an `audio.js`, `_playSmplrTone`, `smplr-loader.js`.

Geaendert wird ausschliesslich `js/test-ui.js` (die `_openToneTypeDialog`-
Funktion) und `js/version.js`.

## Schritt 1 — Button-Struktur erweitern

In `js/test-ui.js` in `_openToneTypeDialog` die Stelle finden, an der
der Vorspiel-Button gebaut wird (aktuell etwa Z. 2446-2452):

**Vorher**:
```js
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn-small';
      play.dataset.t = 'tonePopupPlay';
      play.dataset.toneKey = key;
      play.style.cssText = 'min-width:90px;';
```

**Nachher**:
```js
      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn-small';
      play.dataset.toneKey = key;
      play.style.cssText = 'min-width:90px;';
      // BA 226: Sanduhr-Span (default versteckt) + Label-Span fuer i18n.
      // data-t wandert vom Button auf den Label-Span, damit applyLang
      // den Sanduhr-Span nicht ueberschreibt.
      var playHg = document.createElement('span');
      playHg.className = 'btn-hourglass';
      playHg.style.cssText = 'display:none;margin-right:4px;';
      playHg.textContent = '⧖';
      play.appendChild(playHg);
      var playLbl = document.createElement('span');
      playLbl.dataset.t = 'tonePopupPlay';
      play.appendChild(playLbl);
```

Wichtig: `play.dataset.t` (Z. "play.dataset.t = 'tonePopupPlay';")
wird **entfernt**, denn `applyLang` setzt sonst den ganzen
Button-Inhalt neu und ueberschreibt den Hourglass-Span. Stattdessen
trägt der `playLbl`-Span den `data-t`-Schluessel.

## Schritt 2 — Hourglass-Helfer und Lade-Branch in `_playPreview`

In `js/test-ui.js` weiter in `_openToneTypeDialog`. Der aktuelle
`_playPreview` (Z. 2468-2500) wird leicht umgebaut.

**Vor `_playPreview`** einen neuen Helfer einfuegen:

```js
  // BA 226: Sanduhr ein-/ausblenden fuer den Button eines konkreten
  // toneType (Strings koennen Doppelpunkte und Leerzeichen enthalten,
  // deshalb ueber alle Buttons iterieren statt CSS-Selector).
  function _setHourglassFor(toneType, show) {
    var btns = dlg.querySelectorAll('button[data-tone-key]');
    btns.forEach(function (btn) {
      if (btn.dataset.toneKey !== toneType) return;
      var hg = btn.querySelector('.btn-hourglass');
      if (hg) hg.style.display = show ? 'inline-block' : 'none';
    });
  }
```

Anschliessend `_playPreview` aendern. Aktuelle Implementierung
(ca. Z. 2468-2500) bleibt am Ende der Funktion erhalten; vor dem
playing/Sequence-Block kommt ein neuer Lade-Branch.

**Vorher** (Z. 2468-2476 ungefaehr):
```js
  function _playPreview(toneType) {
    var seq = cfg.getPreviewSequence();
    if (!Array.isArray(seq) || seq.length === 0) return;
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;
    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setPlayButtonsDisabled(true);

    var idx = 0;
```

**Nachher**:
```js
  function _playPreview(toneType) {
    var seq = cfg.getPreviewSequence();
    if (!Array.isArray(seq) || seq.length === 0) return;
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;

    // BA 226: Bei smplr-Tonart, die noch nicht geladen ist, erst Sampler
    // laden (mit Sanduhr-Visualisierung), dann _playPreview rekursiv
    // erneut aufrufen. Buttons bleiben waehrend des Ladens disabled,
    // playing-Flag bleibt true, damit kein paralleler Klick durchkommt.
    if (typeof toneType === 'string'
        && toneType.indexOf('smplr:') === 0
        && typeof smplrSamplerIsReady === 'function'
        && !smplrSamplerIsReady(toneType)) {
      if (typeof loadSamplerByToken !== 'function') return;
      playing = true;
      _setPlayButtonsDisabled(true);
      _setHourglassFor(toneType, true);
      loadSamplerByToken(c, toneType).then(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setPlayButtonsDisabled(false);
        // Sampler geladen -> Vorspielen jetzt regulaer.
        // Nur wenn der Sampler nach dem Load tatsaechlich ready ist
        // (sonst war es ein stiller Lade-Fehler -> keine Endlos-Schleife).
        if (smplrSamplerIsReady(toneType)) {
          _playPreview(toneType);
        }
      }).catch(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setPlayButtonsDisabled(false);
        // Lade-Fehler: keine Wiederholung, keine Tonwiedergabe.
        // (smplrLastError ist gesetzt; Banner-Anzeige spaeter, nicht in BA 226.)
      });
      return;
    }

    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setPlayButtonsDisabled(true);

    var idx = 0;
```

Der Rest von `_playPreview` (Sequence-Schleife `nextStep()` und die
`_setPlayButtonsDisabled(false)`-Zeile am Ende) bleibt unveraendert.

## Schritt 3 — Radio-Klick-Lade-Trigger fuer smplr-Tonarten

In `js/test-ui.js` weiterhin in `_openToneTypeDialog`. Der bestehende
Radio-Change-Listener (aktuell Z. 2509-2511) wird erweitert.

**Vorher** (Z. 2509-2511):
```js
      rb.addEventListener('change', function() {
        if (rb.checked) selected = key;
      });
```

**Nachher**:
```js
      rb.addEventListener('change', function() {
        if (!rb.checked) return;
        selected = key;
        // BA 226: Bei smplr-Tonart Lade-Trigger im Hintergrund anstossen,
        // damit ein spaeterer Vorspiel-Klick weniger oder kein Warten erzeugt.
        // Vorspiel-Button bleibt klickbar (kein _setPlayButtonsDisabled),
        // aber die Sanduhr zeigt den Lade-Vorgang an. Wenn der User
        // dazwischen Vorspielen klickt, greift der Lade-Branch in
        // _playPreview nahtlos (gleicher Promise-Cache im Loader).
        if (typeof key !== 'string' || key.indexOf('smplr:') !== 0) return;
        if (typeof smplrSamplerIsReady !== 'function' || smplrSamplerIsReady(key)) return;
        if (typeof loadSamplerByToken !== 'function') return;
        var c = (typeof gAC === 'function') ? gAC() : null;
        if (!c) return;
        _setHourglassFor(key, true);
        loadSamplerByToken(c, key).then(function () {
          _setHourglassFor(key, false);
        }).catch(function () {
          _setHourglassFor(key, false);
        });
      });
```

Wichtig: `_setPlayButtonsDisabled(true)` wird hier **nicht** aufgerufen.
Der User soll trotz Hintergrund-Lade weiterhin andere Tonarten antesten
koennen. Nur die Sanduhr am betreffenden Vorspiel-Button signalisiert
"laedt im Hintergrund".

Wenn der User waehrend des Hintergrund-Ladens auf Vorspielen klickt,
wird `_playPreview` aufgerufen, der smplr-Branch sieht
`!smplrSamplerIsReady(toneType)` -> ruft `loadSamplerByToken` erneut.
Der Loader (BA 224) hat `_samplerLoading`-Map und liefert das bereits
laufende Promise. Sanduhr ist schon sichtbar (vom Radio-Trigger). Wenn
das gemeinsame Promise auflöst, wird Sanduhr per `finally` ausgeblendet
und Auto-Replay startet. Kein Doppel-Download, keine Race-Condition.

## Schritt 4 — Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.226-beta";
```

(Wenn die aktuelle Version 3.2.225.1-beta oder 3.2.225.2-beta ist:
trotzdem auf glatt `3.2.226-beta` setzen, das Fix-Suffix entfaellt
bei einer neuen BA.)

## Schritt 5 — Kein CODESTRUKTUR-Update

Diese BA aendert nur Verhalten innerhalb einer bestehenden Funktion
und einer bereits dokumentierten Datei. Kein neuer Eintrag noetig.

Optional in der `test-ui.js`-Beschreibung (falls dort der Tonart-
Dialog erwaehnt wird) am Ende einen kurzen Halbsatz: "BA 226:
Sanduhr-Visualisierung bei smplr-Tonarten, die beim Anklick noch
nicht geladen sind; Lade-Trigger bereits beim Radio-Auswahl-Klick,
damit der spaetere Vorspiel-Klick oft ohne Wartezeit hoerbar ist."

## Akzeptanztest (Nutzer)

Setup: Tool frisch laden (Browser-Refresh hart per Strg+Shift+R,
damit kein Sampler-Cache aus vorherigen Sitzungen wirkt). Falls
moeglich, im Network-Tab "Throttling: Slow 3G" aktivieren, damit
das Sample-Laden lange genug dauert, um die Sanduhr zu sehen.

1. Versionslabel zeigt `3.2.226-beta`.
2. Tab Messungen -> Frequenzabgleich -> Tonart-Button klicken (Modalbox).
3. Vorspiel-Button neben "TRON FLUTE" (oder einer beliebigen Mellotron-
   Variante, die NICHT in dieser Sitzung schon vorgehoert wurde) klicken.
4. Erwartet sofort:
   - Sanduhr ⧖ erscheint vor dem Button-Text dieses Buttons.
   - ALLE Vorspiel-Buttons werden grau (disabled).
5. Erwartet nach 2-30 s (je nach Netzwerk):
   - Sanduhr verschwindet.
   - Alle Buttons sind wieder normal/aktiv.
   - Die Default-Vorspiel-Sequenz wird hoerbar mit Floetenklang.
6. Beim ZWEITEN Klick auf "TRON FLUTE" (Sampler ist jetzt im Cache):
   - Keine Sanduhr.
   - Sofort hoerbar.
7. Vorspiel "Galaxy E-Pianos" (SF2, noch nicht geladen) klicken:
   - Sanduhr erscheint, dauert oft 5-15 s.
   - Danach hoerbar.
8. **Regression**: Vorspiel "Sinus" oder "Komplex" (keine smplr-Tonart):
   - Keine Sanduhr (laeuft sofort).
   - Hoerbar wie vor BA 226.
9. **Radio-Klick-Lade-Trigger**: Tool hart neu laden. Modalbox oeffnen.
   Radio-Button (das runde Auswahl-Element) neben "CHMB ALTOSAX"
   (oder einer anderen noch-nicht-geladenen Mellotron-Variante) anklicken.
   - Sanduhr erscheint sofort am Vorspiel-Button von "CHMB ALTOSAX".
   - Alle anderen Vorspiel-Buttons bleiben aktiv (nicht grau).
   - User wartet 3-5 s, Sanduhr verschwindet (Lade fertig).
   - Klick auf Vorspiel von "CHMB ALTOSAX" -> sofort hoerbar, keine
     Wartezeit, keine zweite Sanduhr.
10. **Radio-Klick + sofortiger Vorspiel-Klick** (waehrend Lade laeuft):
    Tool hart neu laden. Modalbox oeffnen. Radio "Galaxy E-Pianos"
    anklicken (Sanduhr erscheint, SF2-Lade dauert lange). SOFORT
    danach Vorspiel "Galaxy E-Pianos" klicken.
    - Sanduhr bleibt sichtbar (kein Flackern).
    - Alle Vorspiel-Buttons werden grau (Vorspiel-Pfad uebernimmt).
    - Nach 5-30 s: Sanduhr weg, Buttons aktiv, Klang spielt.
    - Keine doppelte HTTP-Request im Network-Tab (nur ein Download).
11. **Lade-Fehler simulieren** (optional): Network-Tab auf "Offline"
   schalten, Vorspiel einer noch-nicht-geladenen Sampler-Tonart klicken:
   - Sanduhr erscheint.
   - Nach kurzer Zeit (Timeout des Browsers) verschwindet die Sanduhr,
     Buttons werden wieder normal.
   - Kein Klang.
   - `console.log(smplrLastError)` sollte einen Lade-Fehler-Text zeigen.
12. **Sprachwechsel waehrend Lade-Vorgang** (optional): Vorspiel klicken,
    waehrend Sanduhr sichtbar ist, oben rechts Sprache von Deutsch auf
    Englisch umstellen:
    - Sanduhr bleibt sichtbar (`applyLang` ueberschreibt nur den
      `data-t`-Span "Vorspielen", nicht den Sanduhr-Span).
    - Button-Text wird zu "Play" oder aehnlich, mit Sanduhr davor.

## Selbstprueffungs-Auftrag an Sonnet

VOR der Fertig-Meldung jede Akzeptanz-Kriterie 1-10 (11 und 12 sind
optional, koennen mit "nicht geprueft" gemeldet werden) einzeln:

- Erfuellt / nicht erfuellt / unklar mit Datei- und Zeilenangabe.
- Zusatz: `js/version.js` enthaelt `"3.2.226-beta"`.
- Zusatz: In `js/test-ui.js` im Builder-Block fuer den play-Button
  steht KEIN `play.dataset.t = 'tonePopupPlay';` mehr; statt dessen
  zwei innere Spans (Hourglass + Label). Zeilen nennen.
- Zusatz: `_setHourglassFor(toneType, show)` ist vor `_playPreview`
  definiert. Zeile nennen.
- Zusatz: `_playPreview` enthaelt am Beginn den smplr-Branch mit
  `loadSamplerByToken` + `_setHourglassFor`. Zeilen nennen.
- Zusatz: Der bestehende Sequence-Block (`nextStep`-Schleife) ist
  unveraendert. Bestaetigen mit Zeilenbereich.
- Zusatz: Im Radio-Change-Listener (ehemals Z. 2509-2511) ist der
  smplr-Lade-Trigger eingefuegt; KEIN `_setPlayButtonsDisabled(true)`
  dort (nur `_setHourglassFor`). Zeile nennen.

Bei "unklar" oder "nicht erfuellt": STOP und beim Nutzer rueckfragen.

## Nach Abschluss manuell pruefen (Zwischenpruefung)

- Versionslabel `3.2.226-beta`.
- Erste Anspielung einer noch-nicht-geladenen smplr-Tonart zeigt
  Sanduhr und Klang nach kurzer Wartezeit.
- Cache-Treffer (zweite Anspielung) spielt sofort, ohne Sanduhr.
- Nicht-smplr-Tonarten unveraendert.
- Anschliessend kann BA 227 (Klaviatur) starten.
