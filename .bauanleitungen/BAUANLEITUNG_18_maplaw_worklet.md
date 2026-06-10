# Bauanleitung 18: MAPLAW-Worklet — Filterbank, Hüllkurve, MAPLAW-Vorverzerrung, Resynthese

Erste von drei Bauanleitungen (18/19/20) zur MAPLAW-Simulation
Phase 3. Diese Anleitung legt die mathematische Verarbeitungs-
Schicht als AudioWorklet an, **ohne** UI und **ohne** Verdrahtung
im Player-Audio-Graph (das kommt in 19/20).

Vorbild für das Worklet-Pattern: `freq-warp.js`
(`_FREQ_WARP_PROCESSOR_CODE` als String, Blob-URL-Loading via
`audioCtx.audioWorklet.addModule`).

Hintergrund: siehe `.docs/MAPLAW_Konzept.md`, insbesondere
Abschnitt „Architektur-Entscheidungen (festgelegt 2026-05-17)".

## Sichtbares Verhalten nach dieser Anleitung

Keines. Das Worklet ist geladen, kann instanziiert werden, aber
ist nirgendwo im Audio-Graph eingehängt. Verifikation läuft über
Browser-Konsole und einen optionalen kurzen Audio-Test.

## 1. Neue Datei `maplaw.js`

Im Projekt-Root anlegen. Inhalt:

```js
// ============================================================
// MAPLAW-SIMULATION (Phase 3)
// ============================================================
//
// Bandweise Hüllkurven-Vorverzerrung Ist⁻¹∘Soll für MED-EL-CIs.
// Architektur und mathematische Grundlagen: siehe
// .docs/MAPLAW_Konzept.md.
//
// Pipeline pro Audio-Sample:
//   Input
//     → 12 parallele Biquad-Bandpässe (MED-EL-Frequenzen)
//     → pro Band: Hüllkurve (|x| + IIR-Tiefpaß 50 Hz)
//     → pro Band: lokales Max (gleitende Verfolgung, ~1 Sek)
//     → pro Band: env_norm = env / max (Clamp 0..1)
//     → pro Band: env_korr_norm = MAPLAW⁻¹(MAPLAW(env_norm, sollC), istC)
//     → pro Band: gain = env_korr_norm / env_norm (Null-Schutz)
//     → pro Band: out_band = band_signal · gain
//     → Summe der 12 Bänder
//   Output
//
// Bei active = 0: Passthrough (Identity).

// AudioWorklet-Processor-Code als Inline-String (wird zur
// Laufzeit als Blob geladen — funktioniert auch unter file://).
const _MAPLAW_PROCESSOR_CODE = `
// MED-EL Standard-Frequenzraster (12 Elektroden). Bewußt
// hartkodiert, weil im Worklet-Scope keine direkten Zugriffe
// auf state-side.js möglich sind und MAPLAW MED-EL-exklusiv ist.
const MAPLAW_FREQS = [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410];
const N_BANDS = MAPLAW_FREQS.length;
const Q_BANDPASS = 4.0;            // Konstanter Q-Faktor pro Band
const ENV_LP_FREQ = 50;            // Hz, IIR-Tiefpaß für Hüllkurve
const MAX_DECAY_TAU_SEC = 1.0;     // Sek, Zeitkonstante für lokales Maximum
const EPS = 1e-6;

// RBJ-Bandpass-Biquad (constant skirt gain, peak gain = Q)
function rbjBandpassCoeffs(fc, fs, Q) {
  const w0 = 2 * Math.PI * fc / fs;
  const cosW = Math.cos(w0);
  const sinW = Math.sin(w0);
  const alpha = sinW / (2 * Q);
  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW;
  const a2 = 1 - alpha;
  return {
    b0: b0 / a0, b1: b1 / a0, b2: b2 / a0,
    a1: a1 / a0, a2: a2 / a0,
  };
}

// MAPLAW-Kennlinie und Inverse (auf 0..1).
// y = ln(1 + c·x) / ln(1 + c)
// x = (exp(y · ln(1+c)) - 1) / c
function maplaw(x, c) {
  if (c <= 0) return x;
  return Math.log(1 + c * x) / Math.log(1 + c);
}
function maplawInv(y, c) {
  if (c <= 0) return y;
  return (Math.exp(y * Math.log(1 + c)) - 1) / c;
}

class MaplawProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._istC = 1000;
    this._sollC = 1000;
    this._active = 0;
    this._fs = sampleRate;
    this._coeffs = MAPLAW_FREQS.map(fc =>
      rbjBandpassCoeffs(fc, this._fs, Q_BANDPASS),
    );
    // Biquad-State pro Band: x[-1], x[-2], y[-1], y[-2]
    this._bp1 = new Float32Array(N_BANDS); // x[-1]
    this._bp2 = new Float32Array(N_BANDS); // x[-2]
    this._by1 = new Float32Array(N_BANDS); // y[-1]
    this._by2 = new Float32Array(N_BANDS); // y[-2]
    // Hüllkurven-IIR (1-pole-Tiefpaß)
    const dt = 1 / this._fs;
    const rcEnv = 1 / (2 * Math.PI * ENV_LP_FREQ);
    this._envAlpha = dt / (rcEnv + dt);   // Glättungsfaktor
    this._env = new Float32Array(N_BANDS); // aktuelle geglättete Hüllkurve
    // Lokales Maximum pro Band (geometrische Abklingrate)
    this._maxDecay = Math.exp(-1 / (this._fs * MAX_DECAY_TAU_SEC));
    this._max = new Float32Array(N_BANDS).fill(EPS);
    this.port.onmessage = (e) => this._onMessage(e.data);
  }

  _onMessage(d) {
    if (!d || typeof d !== "object") return;
    if (typeof d.istC === "number")  this._istC  = Math.max(0, d.istC);
    if (typeof d.sollC === "number") this._sollC = Math.max(0, d.sollC);
    if (typeof d.active !== "undefined") this._active = d.active ? 1 : 0;
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;

    const inCh  = input[0];
    const outCh = output[0];
    if (!inCh || !outCh) return true;

    const len = inCh.length;

    // Passthrough wenn inaktiv oder c-Werte gleich (Identity)
    if (!this._active || Math.abs(this._istC - this._sollC) < 0.5) {
      outCh.set(inCh);
      // Multikanal-Ausgang: Stereo bedienen, falls vorhanden
      for (let k = 1; k < output.length; k++) {
        const oc = output[k];
        if (oc) oc.set(inCh);
      }
      return true;
    }

    const istC = this._istC;
    const sollC = this._sollC;
    const decay = this._maxDecay;
    const aEnv = this._envAlpha;

    for (let n = 0; n < len; n++) {
      const x = inCh[n];
      let sumOut = 0;

      for (let b = 0; b < N_BANDS; b++) {
        const c = this._coeffs[b];
        // Biquad: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
        const y = c.b0 * x + c.b1 * this._bp1[b] + c.b2 * this._bp2[b]
                - c.a1 * this._by1[b] - c.a2 * this._by2[b];
        this._bp2[b] = this._bp1[b];
        this._bp1[b] = x;
        this._by2[b] = this._by1[b];
        this._by1[b] = y;

        // Hüllkurve: Gleichrichtung + 1-pole-LP
        const rect = Math.abs(y);
        this._env[b] = this._env[b] + aEnv * (rect - this._env[b]);
        const env = this._env[b];

        // Lokales Maximum: exponentieller Abfall plus aktueller Wert
        let mx = this._max[b] * decay;
        if (env > mx) mx = env;
        this._max[b] = mx;

        // Normierte Hüllkurve auf 0..1
        const envNorm = mx > EPS ? Math.min(1, env / mx) : 0;
        if (envNorm < EPS) {
          // Band praktisch stumm — Beitrag null
          continue;
        }

        // MAPLAW-Vorverzerrung: env so vorverzerren, daß nach
        // CI-MAPLAW(ist) das Soll-c-Klangbild rauskommt.
        const mapped = maplaw(envNorm, sollC);
        const envCorrNorm = maplawInv(mapped, istC);
        const gain = envCorrNorm / envNorm;

        sumOut += y * gain;
      }

      outCh[n] = sumOut;
    }

    // Multikanal-Ausgang: gleicher Output auf weitere Kanäle
    for (let k = 1; k < output.length; k++) {
      const oc = output[k];
      if (oc) oc.set(outCh);
    }
    return true;
  }
}

registerProcessor("maplaw-processor", MaplawProcessor);
`;

// State
let _pMaplawWorkletReady = false;

// Lädt das Worklet einmalig in den AudioContext.
async function pInitMaplawWorklet(audioCtx) {
  if (_pMaplawWorkletReady) return;
  const blob = new Blob([_MAPLAW_PROCESSOR_CODE], {
    type: "application/javascript",
  });
  const url = URL.createObjectURL(blob);
  try {
    await audioCtx.audioWorklet.addModule(url);
    _pMaplawWorkletReady = true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Erzeugt einen neuen MAPLAW-Worklet-Node mit initialen Parametern.
// params: { istC: number, sollC: number, active: bool }
// Setzt voraus, daß pInitMaplawWorklet(audioCtx) vorher abgewartet
// wurde.
function pBuildMaplawNode(audioCtx, params) {
  const node = new AudioWorkletNode(audioCtx, "maplaw-processor", {
    numberOfInputs:  1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  pMaplawApplyParams(node, params);
  return node;
}

// Setzt Parameter auf einem bestehenden Worklet-Node (Live-Update).
function pMaplawApplyParams(node, params) {
  if (!node || !params) return;
  node.port.postMessage({
    istC: params.istC,
    sollC: params.sollC,
    active: !!params.active,
  });
}
```

## 2. Loader-Eintrag in `index.html`

Im Loader-Array `"maplaw.js"` einfügen, **direkt nach
`"freq-warp.js"`** und vor `"lr-balance.js"`. So sieht die Stelle
nach dem Edit aus:

```
…
"freq-warp.js",
"maplaw.js",      ← neu
"lr-balance.js",
…
```

Sonnet: prüfe vorher in welchem Stil das Array sonst geschrieben
ist (Strings mit Komma) und passe Stil entsprechend an.

## 3. CODESTRUKTUR.md ergänzen

In der Modul-Tabelle, **direkt nach** dem `freq-warp.js`-Eintrag,
folgende Zeile einfügen (Nummerierung im selben Stil wie die
existierende „12b"):

```
| 16b | maplaw.js | MAPLAW-Simulation Phase 3 (bandweise Hüllkurven-Vorverzerrung Ist⁻¹∘Soll für MED-EL). `_MAPLAW_PROCESSOR_CODE` als Worklet-Inline-String mit Filterbank (12 Biquad-Bandpässe an MED-EL-Frequenzen, Q=4), Hüllkurven-Detektor (Gleichrichtung + IIR-Tiefpaß 50 Hz), lokale Normalisierung (gleitendes Maximum, τ=1 Sek), MAPLAW-Kennlinie + Inverse, Resynthese. `pInitMaplawWorklet`, `pBuildMaplawNode`, `pMaplawApplyParams`. Bei `active=0` oder `istC == sollC`: Passthrough. Worklet wird in Bauanleitung 19 in den Player-Audio-Graph eingehängt; UI kommt in Bauanleitung 20. |
```

## Nicht zu tun

- **Keine** Audio-Graph-Verdrahtung in `player.js` — das kommt in
  Bauanleitung 19.
- **Keine** UI in `index.html` — das kommt in Bauanleitung 20.
- **Keinen** existierenden Code in `player.js` oder `freq-warp.js`
  anfassen.
- **Keinen** bestehenden WaveShaper-Code (`pBuildMapNode`) löschen
  oder ändern. Der bleibt vorerst als toter Code; die alte
  versteckte UI in `index.html` ebenfalls. Wird in Bauanleitung
  20 entfernt.
- Filterbank-Frequenzen nicht aus `state-side.js`/`core.js` holen
  — im Worklet hartkodiert, weil Worklet-Scope keinen Zugriff auf
  globale JS-Variablen hat und MAPLAW MED-EL-exklusiv ist.

## Mathematische Verifikation (zum Verständnis, nicht zu bauen)

Identity bei `sollC == istC`:
```
mapped       = maplaw(env, istC)
envCorrNorm  = maplawInv(mapped, istC) = env
gain         = env / env = 1
→ Band-Output = Band-Input
→ Summe der Bänder ≈ Original (innerhalb Filterbank-Toleranz)
```

Soll-c < Ist-c (z.B. 500 vs. 1000):
```
maplaw(env, 500) < maplaw(env, 1000) für jedes env aus (0,1)
→ envCorrNorm = maplawInv(mapped, 1000) < env
→ gain < 1 für leise/mittlere Pegel, ≈ 1 bei lauten Pegeln (env=1)
→ Effekt: dynamische Pegel-Absenkung bei leisen Anteilen
```

## Akzeptanztest (Sonnet vor Fertig-Meldung; User danach
optional)

1. Tool laden, Browser-Konsole öffnen.

2. Verifizieren, daß die globalen Funktionen verfügbar sind:
   ```js
   typeof pInitMaplawWorklet === 'function' &&
   typeof pBuildMaplawNode === 'function' &&
   typeof pMaplawApplyParams === 'function'
   ```
   Erwartet: `true`.

3. Worklet laden und einen Knoten erzeugen:
   ```js
   await pInitMaplawWorklet(pCtx);
   const m = pBuildMaplawNode(pCtx, { istC: 1000, sollC: 500, active: true });
   m
   ```
   Erwartet: ein `AudioWorkletNode`-Objekt, keine Konsolen-Fehler,
   keine roten Meldungen.

4. **Identity-Test** (optional, Audio-Hörtest): kurz einen
   Test-Tongenerator über den Worklet laufen lassen.
   ```js
   const osc = pCtx.createOscillator();
   osc.frequency.value = 440;
   const m = pBuildMaplawNode(pCtx, { istC: 1000, sollC: 1000, active: true });
   osc.connect(m);
   m.connect(pCtx.destination);
   osc.start();
   // Erwartet: Ton hörbar, kein Knacken, keine Verzerrung.
   // Identity (sollC == istC) → durchgereicht.
   // Nach kurzem Hörtest:
   osc.stop();
   m.disconnect();
   ```
   Erwartet: ein klarer 440-Hz-Sinus, ohne Knack-Artefakte.
   **Hinweis**: bei einem reinen Sinus durchläuft nur ein
   Bandpass (E5/E6 in MED-EL-Raster) wirklich, andere sind nahe
   null. Beim Identity-Test ist das egal — `active=true` mit
   `istC == sollC` macht intern Passthrough.

5. Regression-Tests:
   - Existierender Player-Workflow (Audio laden, Play, EQ-Toggle,
     Frequenz-Warping) funktioniert unverändert.
   - Bestehender (versteckter) WaveShaper-MAPLAW-Code in
     `pBuildMapNode` unverändert.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `maplaw.js` existiert im Projekt-Root | | |
| `_MAPLAW_PROCESSOR_CODE` als String-Konstante, enthält `registerProcessor("maplaw-processor", …)` | | |
| Filterbank: 12 Biquad-Bandpässe mit MED-EL-Frequenzen [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410] | | |
| Hüllkurven-Detektor: `Math.abs(y)` + 1-pole-IIR mit Cutoff 50 Hz | | |
| Lokales Maximum mit τ=1 Sek (exponentieller Abfall, aktualisiert mit aktuellem Wert) | | |
| `maplaw`- und `maplawInv`-Funktionen im Worklet (Identity wenn `c <= 0`) | | |
| Passthrough wenn `active = 0` ODER `|istC − sollC| < 0.5` | | |
| `pInitMaplawWorklet`, `pBuildMaplawNode`, `pMaplawApplyParams` global verfügbar | | |
| Loader-Array in `index.html` enthält `"maplaw.js"` zwischen `"freq-warp.js"` und `"lr-balance.js"` | | |
| CODESTRUKTUR.md hat neuen `maplaw.js`-Eintrag | | |
| `player.js`, `freq-warp.js`, `pBuildMapNode` und alle anderen Module unverändert | | |
| index.html (außer Loader-Eintrag) unverändert | | |
| Identity-Test in der Konsole läuft fehlerfrei | | |

Bei Unklarheiten — z.B. zur Position im Loader-Array oder zur
CODESTRUKTUR-Tabellen-Nummerierung — vor Fertig-Meldung
nachfragen.
