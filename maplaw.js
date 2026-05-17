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

// Maximale Kanalzahl mit eigenem Filterbank-State. Für L/R reicht 2.
// Mehr Kanäle (z.B. 5.1) werden auf die ersten beiden Slots gemappt.
const MAX_CH = 2;

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
    // Hüllkurven-IIR (1-pole-Tiefpaß) und Max-Abklingrate
    const dt = 1 / this._fs;
    const rcEnv = 1 / (2 * Math.PI * ENV_LP_FREQ);
    this._envAlpha = dt / (rcEnv + dt);
    this._maxDecay = Math.exp(-1 / (this._fs * MAX_DECAY_TAU_SEC));
    // Per-Channel-State: Biquad-State (x[-1], x[-2], y[-1], y[-2]),
    // Hüllkurve, lokales Maximum. Jeweils ein Float32Array(N_BANDS)
    // pro Kanal. So bleibt die Filterbank-History zwischen L und R
    // sauber getrennt.
    this._bp1 = [];
    this._bp2 = [];
    this._by1 = [];
    this._by2 = [];
    this._env = [];
    this._max = [];
    for (let ch = 0; ch < MAX_CH; ch++) {
      this._bp1.push(new Float32Array(N_BANDS));
      this._bp2.push(new Float32Array(N_BANDS));
      this._by1.push(new Float32Array(N_BANDS));
      this._by2.push(new Float32Array(N_BANDS));
      this._env.push(new Float32Array(N_BANDS));
      this._max.push(new Float32Array(N_BANDS).fill(EPS));
    }
    this.port.onmessage = (e) => this._onMessage(e.data);
  }

  _onMessage(d) {
    if (!d || typeof d !== "object") return;
    if (typeof d.istC === "number")  this._istC  = Math.max(0, d.istC);
    if (typeof d.sollC === "number") this._sollC = Math.max(0, d.sollC);
    if (typeof d.active !== "undefined") this._active = d.active ? 1 : 0;
  }

  _processChannel(inCh, outCh, ch) {
    const len = inCh.length;
    const istC = this._istC;
    const sollC = this._sollC;
    const decay = this._maxDecay;
    const aEnv = this._envAlpha;
    const coeffs = this._coeffs;
    const bp1 = this._bp1[ch];
    const bp2 = this._bp2[ch];
    const by1 = this._by1[ch];
    const by2 = this._by2[ch];
    const env_ = this._env[ch];
    const max_ = this._max[ch];

    for (let n = 0; n < len; n++) {
      const x = inCh[n];
      let sumOut = 0;
      for (let b = 0; b < N_BANDS; b++) {
        const c = coeffs[b];
        // Biquad: y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2] - a1*y[n-1] - a2*y[n-2]
        const y = c.b0 * x + c.b1 * bp1[b] + c.b2 * bp2[b]
                - c.a1 * by1[b] - c.a2 * by2[b];
        bp2[b] = bp1[b];
        bp1[b] = x;
        by2[b] = by1[b];
        by1[b] = y;

        const rect = Math.abs(y);
        env_[b] = env_[b] + aEnv * (rect - env_[b]);
        const envb = env_[b];

        let mx = max_[b] * decay;
        if (envb > mx) mx = envb;
        max_[b] = mx;

        const envNorm = mx > EPS ? Math.min(1, envb / mx) : 0;
        if (envNorm < EPS) continue;

        const mapped = maplaw(envNorm, sollC);
        const envCorrNorm = maplawInv(mapped, istC);
        const gain = envCorrNorm / envNorm;

        // Additive Korrektur: nur die Modifikation aufsummieren (gain-1),
        // nicht die ganze Filterbank-Summe. Sonst klingt selbst der Fall
        // gain≈1 verfärbt, weil Σ y_b ≠ x (12 Q=4-Bandpässe sind keine
        // perfekte Rekonstruktion). Mit diesem Ansatz bleibt das Original
        // x das Klanggerüst und MAPLAW addiert nur eine bandgefilterte
        // Korrektur-Spur — bei istC≈sollC ist die Korrektur 0 und das
        // Original durchläuft unverfärbt.
        sumOut += y * (gain - 1);
      }
      outCh[n] = x + sumOut;
    }
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0) return true;
    if (!output || output.length === 0) return true;

    const numIn  = input.length;
    const numOut = output.length;

    // Passthrough wenn inaktiv oder c-Werte gleich (Identity).
    // Pro Output-Kanal jeweils den korrespondierenden Input-Kanal kopieren;
    // wenn weniger Input-Kanäle als Output-Kanäle, letzten wiederverwenden.
    if (!this._active || Math.abs(this._istC - this._sollC) < 0.5) {
      for (let k = 0; k < numOut; k++) {
        const inCh  = input[Math.min(k, numIn - 1)];
        const outCh = output[k];
        if (inCh && outCh) outCh.set(inCh);
      }
      return true;
    }

    // Aktiv: pro Kanal eigene Filterbank-Verarbeitung mit eigenem State.
    // Channel-State-Index auf MAX_CH-1 begrenzen, falls mehr Kanäle als
    // State-Slots vorhanden sind (sollte im Player-Setup nicht passieren).
    for (let k = 0; k < numOut; k++) {
      const inCh  = input[Math.min(k, numIn - 1)];
      const outCh = output[k];
      if (!inCh || !outCh) continue;
      this._processChannel(inCh, outCh, Math.min(k, MAX_CH - 1));
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
  // Stereo-Pipeline durch den Worklet: 2 Kanäle in, 2 Kanäle raus.
  // `channelCountMode: 'explicit'` mit `channelCount: 2` zwingt Web Audio,
  // Mono-Input vor dem Worklet auf 2 Kanäle aufzuteilen (L=R=mono) und
  // Stereo-Input ohne Downmix durchzureichen. Andernfalls würde der
  // Worklet bei mode='right' (pRightOnlyBuf, L=0/R=Signal) nur den
  // stillen linken Kanal sehen und Stille ausgeben.
  const node = new AudioWorkletNode(audioCtx, "maplaw-processor", {
    numberOfInputs:  1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
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
