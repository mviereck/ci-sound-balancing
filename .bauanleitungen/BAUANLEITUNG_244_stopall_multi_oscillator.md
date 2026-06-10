# BA 244: stopAll() stoppt alle laufenden Oszillatoren, nicht nur einen

## Ziel

Bugfix für das Implantat-Modal: Klaviertasten-Loslassen beendet bei
Multi-Partial-Tonarten (CI-Test harmonisch, Komplex, Rich-Profile,
AM-Sinus etc.) den Ton nicht vollständig — nur ein Oszillator wird
gestoppt, die übrigen Partials + LFOs laufen bis zu ihrer geplanten
Stopp-Zeit weiter (bei BA 243 = 60 s Hold-Reserve).

Ursache: `stopAll()` in `js/audio.js:48–63` ruft `curOsc.stop()` —
eine globale Single-Slot-Variable in `js/state-side.js:674`. Jede
Multi-Quellen-Profil-Funktion (`playRichToneProfile`, `playComplexTone`,
`playPulsedComplexTone`, `playRichTone`, `playAmSineTone`,
`playWarbleSineTone` etc.) erzeugt mehrere Oszillatoren / LFOs / Buffer-
Sources, registriert aber nur den ersten in `curOsc`. Die restlichen
laufen ungestoppt weiter.

Reparatur: `curOsc` (Single-Slot) wird durch `runningSources`
(Array) ersetzt. Jede Synthese-Funktion in `audio.js` registriert
**alle** erzeugten Oszillatoren / Buffer-Sources / LFOs darin.
`stopAll()` iteriert über das Array und stoppt jeden Eintrag, dann
leert es das Array. `lr-balance.js:lrStopPlay` wird mit umgestellt.

Verhalten gegenüber heute:
- **Single-Slot-Bug behoben**: alle Partials + LFOs werden gestoppt.
- **Mehrfach-Stop ist idempotent**: bereits beendete Sources werfen
  `InvalidStateError`, der vom `try/catch` gefangen wird.
- **Memory-Verhalten**: das Array kann zwischen Stop-Aufrufen
  tote Refs ansammeln (nach `onended` werden Sources nicht einzeln
  ausgeräumt) — `stopAll` leert das Array komplett. Das ist
  vernachlässigbar: pro Ton ~5–7 Refs, in der Praxis maximal
  einige Dutzend zwischen Stops.

i18n: keine Änderungen.

## Codestand (zur Orientierung)

- `js/state-side.js:673–677`: globale Audio-Variablen-Deklaration.
  `curOsc = null` wird zu `runningSources = []`.
- `js/audio.js:48–63`: `stopAll()`. Iteriert künftig über `runningSources`.
- `js/audio.js`: 12 Synthese-Funktionen mit `curOsc = …`-Zuweisungen:
  - `playSineTone` (Z. 109), `playComplexTone` (Z. 128),
    `playPulsedComplexTone` (Z. 170), `playRichTone` (Z. 234),
    `playRichToneProfile` (Z. 316), `playNoiseTone` (Z. 404),
    `playNoiseAdaptiveTone` (Z. 431), `playIRNTone` (Z. 459),
    `playAmSineTone` (Z. 510), `playWarbleSineTone` (Z. 541),
    `playBurstSineTone` (Z. 569), `playWobbleSweepTone` (Z. 601).
- `js/lr-balance.js:218–221`: greift auf `curOsc` zu.

## Schritte

### 1. Version bumpen — `js/version.js`

```js
const APP_VERSION = "3.2.244-beta";
```

### 2. State-Variable umstellen — `js/state-side.js`

Z. 673–677:

```js
let audioCtx = null,
  curOsc = null,
  playTO = null,
  isPlay = false,
  holdIdx = -1;
```

ersetzen durch:

```js
let audioCtx = null,
  runningSources = [],
  playTO = null,
  isPlay = false,
  holdIdx = -1;
```

(`curOsc` ist damit komplett weg; sämtliche Aufrufer werden in den
folgenden Schritten umgestellt.)

### 3. `stopAll()` umstellen — `js/audio.js`

Z. 48–63 ersetzen:

```js
function stopAll() {
  if (curOsc) {
    try {
      curOsc.stop();
    } catch (e) {}
    curOsc = null;
  }
  if (playTO) {
    clearTimeout(playTO);
    playTO = null;
  }
  sweepAct = false;
  isPlay = false;
  holdIdx = -1;
  updInd(-1);
}
```

durch:

```js
function stopAll() {
  // BA 244: Alle laufenden Oszillatoren / Buffer-Sources / LFOs stoppen,
  // nicht nur einen. Bereits beendete Sources werfen InvalidStateError,
  // der hier gefangen wird.
  if (runningSources && runningSources.length) {
    for (let k = 0; k < runningSources.length; k++) {
      try { runningSources[k].stop(); } catch (e) {}
    }
    runningSources = [];
  }
  if (playTO) {
    clearTimeout(playTO);
    playTO = null;
  }
  isPlay = false;
  holdIdx = -1;
  updInd(-1);
}
```

(`sweepAct = false;` ist bereits in BA 242 entfernt; falls in der
aktuellen Datei noch vorhanden, mit-streichen.)

### 4. Synthese-Funktionen einzeln umstellen — `js/audio.js`

Mechanisches Muster pro Funktion:

- **Vor** der Promise-Resolve-Zuordnung (heute `oscs[0].onended = …`
  bzw. `o.onended = …` / `src.onended = …`) alle erzeugten Sources
  (Oszillatoren, LFOs, BufferSources) per `runningSources.push(…)`
  registrieren.
- Das `onended`-Callback **nicht mehr** `curOsc = null;` setzen, sondern
  nur noch `r()` aufrufen. (Aufräumen passiert beim nächsten `stopAll`.)
- Die Zeile `curOsc = … ;` ersatzlos streichen.

Konkret pro Funktion:

#### 4a) `playSineTone` (Z. 109)

Vor `curOsc = o;` (Z. 121) einfügen, und die Zeile danach ersetzen:

```js
    runningSources.push(o);
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
```

(Die Zeilen `curOsc = o;` und `o.onended = () => { curOsc = null; r(); };`
werden durch die neuen ersetzt.)

#### 4b) `playComplexTone` (Z. 128)

Vor dem Block `curOsc = oscs[0] || null;` (Z. 161) ergänzen:

```js
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
```

Die alten Zeilen `curOsc = oscs[0] || null;` plus
`oscs[0].onended = () => { curOsc = null; r(); };` ersetzen.

#### 4c) `playPulsedComplexTone` (Z. 170)

Wie 4b, **zusätzlich** den LFO (Z. 209, `const lfo = c.createOscillator();`)
registrieren. Direkt nach `lfo.start();` (Z. 216) ergänzen:

```js
    runningSources.push(lfo);
```

Dann genauso umstellen wie 4b (alle Partials in `runningSources.push`,
`onended` ohne `curOsc`).

#### 4d) `playRichTone` (Z. 234)

Drei Source-Typen: `vibLfo` (Z. 265), Partials in `oscs[]` (Z. 272 ff.),
`amLfo` (Z. 289). Alle drei registrieren. Vor dem `curOsc = oscs[0] || null;`-
Block (Z. 307) ergänzen:

```js
    runningSources.push(vibLfo);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    runningSources.push(amLfo);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
```

Alte `curOsc`-Zeilen streichen.

**Wichtig:** In `playRichTone` sind `vibLfo` und `amLfo` bedingt
deklariert? Sonnet prüft, ob sie immer existieren oder nur bei
gesetzten Profil-Werten. Falls bedingt: `if (vibLfo) runningSources.push(vibLfo);`
analog für `amLfo`.

#### 4e) `playRichToneProfile` (Z. 316)

Hier sind `vibLfo` und `amLfo` explizit bedingt (Z. 344–349 für vibLfo,
Z. 373–383 für amLfo). Vor `curOsc = oscs[0] || null;` (Z. 395)
ergänzen:

```js
    if (vibLfo) runningSources.push(vibLfo);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    // amLfo wird in der oberen if-Verzweigung erzeugt; falls vorhanden
    // hat er den Namen 'amLfo' im inneren Scope und ist hier nicht
    // sichtbar. Sonnet prueft: ist amLfo im Funktions-Scope, oder im
    // inneren Block? Wenn Block-lokal: dort registrieren, nicht hier.
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
```

**Konkret zu `amLfo` in `playRichToneProfile`:** der Block Z. 373–383
deklariert `const amLfo = c.createOscillator();` **im inneren `if`-Body**.
Außerhalb des Blocks ist `amLfo` nicht zugreifbar. Lösung: am Ende des
inneren `if`-Bodys (nach `amLfo.stop(…)` Z. 382) ergänzen:

```js
      runningSources.push(amLfo);
```

Analog der innere `if (vibFactor > 0)`-Block (Z. 345–349) für `vibLfo`:
am Ende des Body ergänzen `runningSources.push(vibLfo);` — falls in
diesem Scope sichtbar.

Sonnet prüft pro Scope: deklariert mit `let`/`const`/`var`, wo ist die
Variable sichtbar, an welcher Stelle ist `runningSources.push` legal.
Im Zweifel `runningSources.push` direkt nach dem `start()`-Aufruf
einfügen — dort ist die Variable garantiert im Scope.

Alte `curOsc`-Zeilen am Ende streichen.

#### 4f) `playNoiseTone` (Z. 404), `playNoiseAdaptiveTone` (Z. 431), `playIRNTone` (Z. 459)

Jeweils nur **ein** `src` (BufferSource). Muster:

```js
    runningSources.push(src);
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { r(); };
```

Alte `curOsc = src;` und `src.onended = () => { curOsc = null; r(); };`
ersetzen.

#### 4g) `playAmSineTone` (Z. 510), `playWarbleSineTone` (Z. 541)

Beide haben `o` + `lfo`. Vor `curOsc = o;` (Z. 532 bzw. Z. 560)
ergänzen:

```js
    runningSources.push(o);
    runningSources.push(lfo);
    o.start();
    lfo.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
```

Alte `curOsc`-Zeilen ersetzen.

#### 4h) `playBurstSineTone` (Z. 569), `playWobbleSweepTone` (Z. 601)

Beide haben nur `o`. Muster wie 4a:

```js
    runningSources.push(o);
    o.start();
    o.stop(c.currentTime + …);  // konkrete Zeit pro Funktion uebernehmen
    o.onended = () => { r(); };
```

Alte `curOsc`-Zeilen ersetzen.

### 5. `lr-balance.js:lrStopPlay()` mit umstellen

Z. 218–221:

```js
  if (curOsc) {
    try { curOsc.stop(); } catch (e) {}
    curOsc = null;
  }
```

ersetzen durch:

```js
  // BA 244: stopAll-aequivalente Logik fuer LR-Test-Stop.
  if (runningSources && runningSources.length) {
    for (let k = 0; k < runningSources.length; k++) {
      try { runningSources[k].stop(); } catch (e) {}
    }
    runningSources = [];
  }
```

### 6. Grep-Selbstcheck

Nach allen Edits darf in keiner `js/*.js`-Datei mehr eine Referenz auf
`curOsc` stehen. Sonnet führt einen `grep -rn "curOsc" js/` aus; wenn
Treffer auftauchen, sind sie zu beheben, bevor die BA als fertig gilt.

## Akzeptanztest

Frische Session, MED-EL eine Seite.

1. **Hard-Reload**, Version `3.2.244-beta`.
2. **Implantat-Tab → „Elektroden über Töne anspielen"** öffnen.
3. **Sinus** ist Default — eine Klaviertaste kurz drücken: Ton spielt,
   Loslassen stoppt sofort. (Sollte schon vor BA 244 funktioniert haben.)
4. **Tonart wechseln auf „CI-Test harmonisch"** (`richCiH`). OK
   schließen. Modal erneut öffnen. Klaviertaste **drücken und
   loslassen**: Ton hört **sofort beim Loslassen** auf — keine
   Nachklingen, kein Weiterlaufen.
5. **Andere Multi-Partial-Tonarten** stichprobenartig prüfen:
   `richTone`, `complex`, `pulsedComplex`, `amSine`, `richCiB`,
   `richCiHF` — jeweils Taste drücken + loslassen: sofort still.
6. **Rauschen** (`noise`, `noiseAdaptive`, `irn`): drücken + loslassen
   → sofort still.
7. **Sweep starten**: spielt Elektroden sequentiell. Während des Sweep
   eine Klaviertaste drücken → Überlagerung (zwei parallele Töne).
   Klaviertaste loslassen → der gerade laufende Sweep-Ton **wird mit
   gestoppt** (bekanntes Verhalten von `stopAll`, bewußt unverändert).
   Nächster Sweep-Step nach Pause spielt wieder.
8. **Sweep läuft durch und endet automatisch** — Knopf wechselt zurück
   auf nicht-aktiv.
9. **Frequenzabgleich-Test** (Slider und adaptiv): Töne spielen wie
   bisher, Stop am Ende des Tests beendet alles sauber.
10. **Test Elektrodenlautstärke**: ABA-Sequenz spielt, Stop-Knopf
    beendet sofort, keine Nachklang-Reste bei Multi-Partial-Tönen.
11. **Stereo-Balance-Test**: gleiches Bild. Insbesondere
    `lrStopPlay()` (Z. 217) stoppt alles korrekt.
12. **Konsole**: keine `ReferenceError` zu `curOsc`. Keine
    Uncaught-Fehler beim Drücken/Loslassen.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

- Akzeptanzpunkte 1–12 einzeln durchgehen, je Punkt erfüllt /
  nicht erfüllt / unklar mit Datei/Zeilen-Verweis.
- **`grep -rn "curOsc" js/`** — Ergebnis muß leer sein. Falls nicht,
  betroffene Datei + Zeile melden und korrigieren.
- Pro Synthese-Funktion in `audio.js` prüfen:
  - Mindestens ein `runningSources.push(...)` pro erzeugter
    `c.createOscillator()` / `c.createBufferSource()`.
  - `onended` ruft nur noch `r()`, keine `curOsc = null;`-Zuweisung.
- Konsolen-Fehler-Check nach jedem manuellen Test-Schritt.
- Insbesondere für `playRichToneProfile`: prüfen, daß `amLfo`
  und `vibLfo` jeweils im richtigen Scope registriert werden
  (nicht außerhalb ihres `if`-Blocks). Falls Sonnet unsicher ist:
  Rückfrage statt Annahme.

## Hinweise

- Keine i18n-Änderungen.
- Keine UI-Texte berührt. Reiner Audio-Stack-Fix.
- Nach BA 244 ist der Implantat-Modal-Hold für **alle** Tonarten
  korrekt: Loslassen = Stille.
