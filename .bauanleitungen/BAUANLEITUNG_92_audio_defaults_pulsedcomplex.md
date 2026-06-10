# BA 92 — Audio-Defaults + neue Tonart `pulsedComplex`

## Ziel

Drei zusammengehörende Audio-Änderungen für den Frequenzabgleich-Test
(motiviert durch die methodische Diskussion in `docs/spec/02b-freqmatch-adaptiv.md`):

1. **Default-Stimulus** von `sine` auf `complex` umstellen.
   Begründung: harmonischer Komplexton hat starke Pitch-Wahrnehmung
   (residue pitch) und reichhaltigeres Timbre, ist klanglich näher an
   CI-Stimulation als reiner Sinus.

2. **Trial-Defaults im adaptiven Modus** von 400 ms / 400 ms auf
   200 ms / 200 ms (Tondauer / Pause). Begründung: kürzere Töne erzwingen
   Bauch-Antworten und mindern Timbre-Analyse durch den User.

3. **Neue Tonart `pulsedComplex`** ergänzen: harmonischer Komplexton mit
   einer zusätzlichen 100 Hz AM-Hüllkurve. Simuliert grob die
   Pulsraten-Hüllkurve, die alle CI-Sprachstrategien dem Hörnerv
   aufprägen (FSP/FS4/HiRes/ACE/…), und ist herstellerunabhängig.

## Akzeptanztest

1. Tab Messungen → Sub-Tab **Frequenzabgleich**. Erwartet: Tonart-Dropdown
   steht bei einem frischen Aufruf (ohne gespeicherte Werte) auf
   „**Komplexton**".
2. Tab Messungen → Sub-Tab **Stereo-Balance** und Sub-Tab **Töne**.
   Erwartet: Tonart-Dropdown dort ebenfalls auf „Komplexton" (globale
   Variable, alle drei Dropdowns synchron).
3. Tonart-Dropdown öffnen — erwartet: neue Option „**Komplexton gepulst
   (100 Hz)**" zwischen den bestehenden Komplexton- und
   Schmalbandrauschen-Einträgen sichtbar.
4. „Komplexton gepulst (100 Hz)" auswählen → einen Ton abspielen (z.B.
   im Sub-Tab Töne über einen Hold-Button) — erwartet: hörbar moduliertes
   „Brummen" mit Grundton, nicht reiner Komplexton.
5. Frequenzabgleich-Mode auf „adaptiv" stellen — erwartet: Tondauer-Feld
   zeigt **200**, Pause-Feld zeigt **200** (sofern die Seite noch keine
   gespeicherten Adaptive-Werte hat).
6. Frequenzabgleich-Mode auf „Schieber" zurückstellen — erwartet:
   die Slider-Modus-Defaults (1000 / 500) bleiben unverändert.
7. Bestehende gespeicherte Frequenzabgleich-Werte (`fmAdaptiveDur`,
   `fmAdaptivePau`) eines bereits genutzten Datensatzes werden NICHT
   überschrieben (Backwards-Compatibility).
8. JSON-Export/Import: ein Export mit `globalToneType: "pulsedComplex"`
   lädt sich ohne Fehler zurück, Dropdown steht nach Import auf der
   neuen Option.

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.92-beta";
```

## Schritt 2 — Default-Stimulus auf `complex`

In `js/state-side.js`, Z. 471. **Ersetzen**:

```js
// vorher
let globalToneType = "sine"; // "sine" | "complex" | "noise" | ...
// nachher
let globalToneType = "complex"; // "sine" | "complex" | "pulsedComplex" | "noise" | ...
```

In `js/file.js`, Z. 441–444. **Ersetzen**:

```js
// vorher
const VALID_TONE_TYPES = ["sine", "complex", "noise",
  "noiseAdaptive", "amSine", "warbleSine", "burstSine", "wobbleSweep"];
globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
  ? d.globalToneType : "sine";
// nachher
const VALID_TONE_TYPES = ["sine", "complex", "pulsedComplex", "noise",
  "noiseAdaptive", "amSine", "warbleSine", "burstSine", "wobbleSweep"];
globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
  ? d.globalToneType : "complex";
```

Damit:
- Neue User starten mit `complex`.
- Alte gespeicherte Datensätze mit `globalToneType: "sine"` bleiben unverändert
  (die Liste enthält `sine` weiterhin).
- Neue Option `pulsedComplex` wird als valider Wert anerkannt.

## Schritt 3 — Trial-Defaults im adaptiven Modus 400 → 200

Acht Stellen, alle mit demselben Pattern. **Replace-all** im jeweiligen File
ist nicht sicher (es könnten andere `400`-Konstanten existieren), daher
gezielt:

In `js/state-side.js`, Z. 102–103:
```js
// vorher
  s.fmAdaptiveDur = 400;
  s.fmAdaptivePau = 400;
// nachher
  s.fmAdaptiveDur = 200;
  s.fmAdaptivePau = 200;
```

In `js/state-side.js`, Z. 219–220:
```js
// vorher
  s.fmAdaptiveDur = (d.fmAdaptiveDur != null) ? d.fmAdaptiveDur : 400;
  s.fmAdaptivePau = (d.fmAdaptivePau != null) ? d.fmAdaptivePau : 400;
// nachher
  s.fmAdaptiveDur = (d.fmAdaptiveDur != null) ? d.fmAdaptiveDur : 200;
  s.fmAdaptivePau = (d.fmAdaptivePau != null) ? d.fmAdaptivePau : 200;
```

In `js/file.js`, Z. 108–109 und 129–130:
```js
// vorher (beide Stellen)
        fmAdaptiveDur: sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 400,
        fmAdaptivePau: sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 400,
// nachher
        fmAdaptiveDur: sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 200,
        fmAdaptivePau: sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 200,
```
(Z. 129–130 analog mit `sideData.right`.)

In `js/freqmatch.js`, Z. 1332–1333:
```js
// vorher
      varSd.fmAdaptiveDur = parseInt(fmEls.durInput.value)   || 400;
      varSd.fmAdaptivePau = parseInt(fmEls.pauseInput.value) || 400;
// nachher
      varSd.fmAdaptiveDur = parseInt(fmEls.durInput.value)   || 200;
      varSd.fmAdaptivePau = parseInt(fmEls.pauseInput.value) || 200;
```

In `js/freqmatch.js`, Z. 1347–1348:
```js
// vorher
      fmEls.durInput.value   = (varSd.fmAdaptiveDur != null) ? varSd.fmAdaptiveDur : 400;
      fmEls.pauseInput.value = (varSd.fmAdaptivePau != null) ? varSd.fmAdaptivePau : 400;
// nachher
      fmEls.durInput.value   = (varSd.fmAdaptiveDur != null) ? varSd.fmAdaptiveDur : 200;
      fmEls.pauseInput.value = (varSd.fmAdaptivePau != null) ? varSd.fmAdaptivePau : 200;
```

**Wichtig:** Bestehende User-Datensätze, die `fmAdaptiveDur: 400`
gespeichert haben, behalten die 400 ms (`!= null`-Check greift). Nur ganz
frische Datensätze starten mit 200.

## Schritt 4 — Neue Tonart `pulsedComplex` in `audio.js`

In `js/audio.js`, **nach** der Funktion `playComplexTone` (endet Z. 163) und
**vor** `playNoiseTone` (beginnt Z. 165), folgende neue Funktion einfügen:

```js
function playPulsedComplexTone(c, hz, vol, ms, pan, ramp = 20) {
  // Harmonischer Komplexton (wie playComplexTone) zusätzlich AM-moduliert
  // mit 100 Hz. Simuliert die Pulsraten-Hüllkurve aller CI-Strategien,
  // ohne die Pitch-Wahrnehmung zu zerstören.
  return new Promise((r) => {
    const PULSE_RATE = 100;           // Hz
    const MOD_DEPTH  = 0.7;           // 0 = keine Modulation, 1 = volle Tiefe
    const oscs = [],
      g = c.createGain(),
      p = c.createStereoPanner();
    const partials = [
      { mult: 1, amp: 1.0 },
      { mult: 2, amp: 0.5 },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;

    // Carrier-Mischer: alle Harmonischen laufen in einen gemeinsamen Gain,
    // der dann vom LFO moduliert wird.
    const carrierMix = c.createGain();
    carrierMix.gain.value = 1 - MOD_DEPTH / 2;   // Ruhewert (DC-Anteil)

    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }

    // AM-LFO: 100 Hz Sinus, dessen Gain-Output zur Tiefen-Modulation auf
    // carrierMix.gain addiert wird. Resultiert in voller Modulationstiefe
    // MOD_DEPTH zwischen 0 und (1 - MOD_DEPTH/2) + MOD_DEPTH/2 = 1.
    const lfo     = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type            = "sine";
    lfo.frequency.value = PULSE_RATE;
    lfoGain.gain.value  = MOD_DEPTH / 2;
    lfo.connect(lfoGain);
    lfoGain.connect(carrierMix.gain);
    lfo.start();
    lfo.stop(c.currentTime + ms / 1000 + 0.01);

    carrierMix.connect(g);

    p.pan.value = pan;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + ramp / 1000);
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    g.connect(p);
    p.connect(c.destination);
    curOsc = oscs[0] || null;
    if (oscs.length > 0) {
      oscs[0].onended = () => { curOsc = null; r(); };
    } else {
      r();
    }
  });
}
```

In `js/audio.js`, Z. 338–347 (Dispatcher `playToneTyped`). **Ersetzen**:

```js
// vorher
function playToneTyped(c, hz, vol, ms, pan, toneType, ramp = 20) {
  if (toneType === "complex")       return playComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noise")         return playNoiseTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noiseAdaptive") return playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "amSine")        return playAmSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "warbleSine")    return playWarbleSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "burstSine")     return playBurstSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "wobbleSweep")   return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}
// nachher
function playToneTyped(c, hz, vol, ms, pan, toneType, ramp = 20) {
  if (toneType === "complex")        return playComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "pulsedComplex")  return playPulsedComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noise")          return playNoiseTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noiseAdaptive")  return playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "amSine")         return playAmSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "warbleSine")     return playWarbleSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "burstSine")      return playBurstSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "wobbleSweep")    return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}
```

In `js/audio.js`, Funktion `playHold` (ab Z. 355). Den `complex`-Zweig
(ab Z. 366) durch eine erweiterte Variante ersetzen, die auch
`pulsedComplex` abdeckt:

```js
// vorher (Z. 366–390)
  if (globalToneType === "complex") {
    const partials = [
      { mult: 1, amp: 1.0 }, { mult: 2, amp: 0.5 }, { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 }, { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;
    const oscs = [];
    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        o.connect(og);
        og.connect(g);
        o.start();
        oscs.push(o);
      }
    }
    curOsc = {
      stop: () => { oscs.forEach(o => { try { o.stop(); } catch(e) {} }); }
    };
  } else if (globalToneType === "noise") {
```

```js
// nachher
  if (globalToneType === "complex" || globalToneType === "pulsedComplex") {
    const partials = [
      { mult: 1, amp: 1.0 }, { mult: 2, amp: 0.5 }, { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 }, { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;
    const oscs = [];
    let carrierMix = g;
    let lfo = null;
    if (globalToneType === "pulsedComplex") {
      // Mit Modulation: alle Harmonischen in carrierMix, der vom LFO moduliert
      // und dann in den Ramp-Gain g geführt wird.
      const PULSE_RATE = 100;
      const MOD_DEPTH  = 0.7;
      carrierMix = c.createGain();
      carrierMix.gain.value = 1 - MOD_DEPTH / 2;
      lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.type            = "sine";
      lfo.frequency.value = PULSE_RATE;
      lfoGain.gain.value  = MOD_DEPTH / 2;
      lfo.connect(lfoGain);
      lfoGain.connect(carrierMix.gain);
      carrierMix.connect(g);
      lfo.start();
    }
    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        oscs.push(o);
      }
    }
    curOsc = {
      stop: () => {
        oscs.forEach(o => { try { o.stop(); } catch(e) {} });
        if (lfo) { try { lfo.stop(); } catch(e) {} }
      }
    };
  } else if (globalToneType === "noise") {
```

## Schritt 5 — Dropdown-Option in `test-ui.js`

In `js/test-ui.js`, Z. 212–217 (Optionen-Array für den Tonart-Dropdown).
Neuen Eintrag direkt nach `complex` einfügen:

```js
// vorher
      [
        ['sine','toneSine'],['complex','toneComplex'],['noise','toneNoise'],
        ['noiseAdaptive','toneNoiseAdaptive'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
      ].forEach(function(pair) {
// nachher
      [
        ['sine','toneSine'],['complex','toneComplex'],
        ['pulsedComplex','tonePulsedComplex'],['noise','toneNoise'],
        ['noiseAdaptive','toneNoiseAdaptive'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
      ].forEach(function(pair) {
```

## Schritt 6 — i18n-Key in `i18n/de.js`

In `i18n/de.js`, Z. 148 (direkt nach `toneComplex`). **Einfügen**:

```js
    toneComplex: "Komplexton",
    tonePulsedComplex: "Komplexton gepulst (100 Hz)",
    toneNoise: "Schmalbandrauschen",
```

Englisch / Französisch / Spanisch werden in einer separaten Mini-Anleitung
nachgezogen (Konvention nach `docs/BAUANLEITUNGEN_LEITLINIEN.md`). Bis
dahin greift der i18n-Fallback auf den deutschen String.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus der Liste oben einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich gegenchecken:
- Alle acht `400`-Vorkommen für `fmAdaptiveDur`/`fmAdaptivePau` sind auf
  `200` umgestellt. `grep -n "fmAdaptive\(Dur\|Pau\).*400" js/ ` muß leer
  ausgeben.
- `playPulsedComplexTone` ist in `audio.js` definiert UND im
  `playToneTyped`-Dispatcher referenziert.
- `pulsedComplex` taucht auf: in `state-side.js`-Kommentar, in
  `file.js`-`VALID_TONE_TYPES`, in `test-ui.js`-Dropdown, in
  `i18n/de.js`-`tonePulsedComplex`, in `audio.js` an drei Stellen
  (`playToneTyped`, `playHold`-Branch, Funktionsdefinition).
- `playHold`-Erweiterung: bei Auswahl `pulsedComplex` und Hold-Button
  wird hörbar AM-moduliert. Bei `complex` weiterhin unmoduliert.
- Bei Lade-Test einer alten JSON-Datei (mit `globalToneType: "sine"`):
  Tonart bleibt `sine`, kein Fallback auf `complex`.

## Hinweis

i18n en/fr/es bleibt für eine spätere Mini-Anleitung.
Hinweis am Ende der BA-Serie: „Übersetzungen für `tonePulsedComplex`,
neue Status-Kategorien und neue runs[]-Labels nachziehen".
