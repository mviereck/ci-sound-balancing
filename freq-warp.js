// ============================================================
// FREQ-WARP – Offline-Frequenz-Warping auf Basis von fRes
// ============================================================
// Geladen zwischen player.js (#14) und lr-balance.js (#15).
// Exportiert ins globale Scope:
//   buildWarpPoints(fResData, warpMode) → points[]
//   centShift(f, side, points) → number
//   pComputeWarpedBuffer(srcBuf, warpMode, strength, fResData) → Promise<AudioBuffer>
//   pWarpedBuf, pWarpMode, pWarpOn, pWarpStrength, pWarpBusy  (State)
//   pWarpTrigger()   – UI → Vorberechnung auslösen
//   pWarpUpdUI()     – Status-Anzeige aktualisieren

// AudioWorklet-Processor-Code als String (wird zur Laufzeit als Blob geladen,
// damit der Vocoder auch unter file:// funktioniert).
const _FREQ_WARP_PROCESSOR_CODE = `
// AudioWorklet-Processor für Phasen-Vocoder Frequenz-Warping (Variante A).
// Läuft im Audio-Thread, kein Zugriff auf window/DOM.

const FFT_SIZE = 2048;
const HOP_SIZE = 512;   // 75 % Overlap
const RING = FFT_SIZE * 2;

class FreqWarpProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return []; }

  constructor(options) {
    super();
    this.warpPoints = [];
    this.strength   = 1.0;
    this.active     = false;

    // Ringpuffer pro Kanal
    this.inBuf  = [new Float32Array(RING), new Float32Array(RING)];
    this.outBuf = [new Float32Array(RING), new Float32Array(RING)];
    // Schreib- und Lesezeiger (getrennt pro Kanal)
    this.inWritePos  = [0, 0];
    this.outWritePos = [FFT_SIZE, FFT_SIZE]; // FFT_SIZE Vorsprung = Latenz
    this.outReadPos  = [0, 0];

    this.samplesSinceHop = 0;

    // Analyse-/Synthese-Fenster (Hann)
    this.window = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FFT_SIZE);
    }

    // Phasenspeicher pro Kanal
    this.lastPhase = [new Float32Array(FFT_SIZE / 2 + 1), new Float32Array(FFT_SIZE / 2 + 1)];
    this.sumPhase  = [new Float32Array(FFT_SIZE / 2 + 1), new Float32Array(FFT_SIZE / 2 + 1)];

    // Sinusoidal Modeling: getrackte Peaks (Frequenz + Phase) pro Kanal.
    this.algorithm = "phase_vocoder"; // "phase_vocoder" | "sinmodel"
    this.smMaxPeaks      = 64;
    this.smPrevPeakCount = [0, 0];
    this.smPrevPeakFreq  = [new Float32Array(64), new Float32Array(64)];
    this.smPrevPeakPhase = [new Float32Array(64), new Float32Array(64)];

    // Scratch-Buffer für _processFrame — einmalig allokiert, jeden Frame
    // wiederverwendet. Sonst entsteht GC-Druck mit ~10 MB/s Allokationen
    // im Audio-Thread und der Worklet kommt nicht hinterher → Underrun.
    const half = FFT_SIZE / 2;
    this.scratchRe          = new Float32Array(FFT_SIZE);
    this.scratchIm          = new Float32Array(FFT_SIZE);
    this.scratchNewRe       = new Float32Array(FFT_SIZE);
    this.scratchNewIm       = new Float32Array(FFT_SIZE);
    this.scratchMags        = new Float32Array(half + 1);
    this.scratchSrcPhases   = new Float32Array(half + 1);
    this.scratchTargetBin   = new Int32Array(half + 1);
    this.scratchNewFreq     = new Float32Array(half + 1);
    this.scratchPeakBins    = new Int32Array(half + 1);
    this.scratchNearestPeak = new Int32Array(half + 1);
    this.scratchPhaseUpd    = new Uint8Array(half + 1);
    this.scratchNewPhaseAt  = new Float32Array(half + 1);

    this.port.onmessage = (e) => {
      if (e.data.type === "params") {
        this.warpPoints = e.data.points || [];
        this.strength   = e.data.strength ?? 1.0;
        this.active     = !!e.data.active;
        if (e.data.algorithm) this.algorithm = e.data.algorithm;
        if (!this.active) {
          // Zustand zurücksetzen, damit bei Reaktivierung kein Phasensprung
          for (let ch = 0; ch < 2; ch++) {
            this.lastPhase[ch].fill(0);
            this.sumPhase[ch].fill(0);
          }
        }
      }
    };
  }

  process(inputs, outputs) {
    const input  = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const blockSize = input[0].length;
    const nChan = Math.min(input.length, 2);

    if (!this.active) {
      // Bypass
      for (let ch = 0; ch < nChan; ch++) {
        const inCh  = input[ch];
        const outCh = output[ch];
        if (inCh && outCh) {
          for (let i = 0; i < blockSize; i++) outCh[i] = inCh[i];
        }
      }
      return true;
    }

    // 1. Eingang in Ringpuffer schreiben
    for (let ch = 0; ch < nChan; ch++) {
      const inCh = input[ch];
      for (let i = 0; i < blockSize; i++) {
        this.inBuf[ch][this.inWritePos[ch]] = inCh ? inCh[i] : 0;
        this.inWritePos[ch] = (this.inWritePos[ch] + 1) % RING;
      }
    }

    // 2. Frames verarbeiten sobald HOP_SIZE Samples gesammelt
    this.samplesSinceHop += blockSize;
    while (this.samplesSinceHop >= HOP_SIZE) {
      this.samplesSinceHop -= HOP_SIZE;
      for (let ch = 0; ch < nChan; ch++) {
        if (this.algorithm === "sinmodel") {
          this._processFrameSinModel(ch);
        } else {
          this._processFrame(ch);
        }
      }
    }

    // 3. Ausgabe aus Output-Ringpuffer lesen
    for (let ch = 0; ch < nChan; ch++) {
      const outCh = output[ch];
      if (!outCh) continue;
      for (let i = 0; i < blockSize; i++) {
        outCh[i] = this.outBuf[ch][this.outReadPos[ch]];
        this.outBuf[ch][this.outReadPos[ch]] = 0; // gelesene Stelle nullen
        this.outReadPos[ch] = (this.outReadPos[ch] + 1) % RING;
      }
    }

    return true;
  }

  _processFrame(ch) {
    const win = this.window;
    const halfFFT = FFT_SIZE / 2;

    // Scratch-Buffer aus dem Konstruktor (keine Allokationen im Audio-Thread).
    const re             = this.scratchRe;
    const im             = this.scratchIm;
    const newRe          = this.scratchNewRe;
    const newIm          = this.scratchNewIm;
    const mags           = this.scratchMags;
    const srcPhases      = this.scratchSrcPhases;
    const targetBinArr   = this.scratchTargetBin;
    const newFreqArr     = this.scratchNewFreq;
    const peakBins       = this.scratchPeakBins;
    const nearestPeakIdx = this.scratchNearestPeak;
    const phaseUpdated   = this.scratchPhaseUpd;
    const newPhaseAt     = this.scratchNewPhaseAt;

    // Vor jedem Frame zurücksetzen, was akkumulierend benutzt wird.
    newRe.fill(0);
    newIm.fill(0);
    phaseUpdated.fill(0);
    // re/im, mags/srcPhases/targetBinArr/newFreqArr/peakBins/nearestPeakIdx/
    // newPhaseAt werden in der Schleife komplett überschrieben — kein fill nötig.
    im.fill(0); // FFT erwartet im=0 für reelles Eingangssignal

    // Frame aus Ringpuffer extrahieren und fenstern
    const startIdx = (this.inWritePos[ch] - FFT_SIZE + RING * 2) % RING;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = this.inBuf[ch][(startIdx + i) % RING] * win[i];
    }

    _fft(re, im);

    // Magnitude, Phase, Warp, Phase-Akkumulation mit Identity Phase Locking
    // (Laroche/Dolson 1999): Peaks im Source-Spektrum tragen ihre Phase
    // eigenständig vorwärts, die Bins dazwischen werden phasen-gelockt zum
    // jeweils nächsten Peak. Hält den harmonischen Verband zusammen und
    // reduziert die typischen Phasen-Vocoder-Artefakte (roboterhafter Klang,
    // tremoloartiges Vibrieren).
    const side  = ch === 0 ? "left" : "right";
    const expectedPhaseDiff = (2 * Math.PI * HOP_SIZE) / FFT_SIZE;

    // Quell-Magnituden und -Phasen einmalig sammeln (werden in beiden Pässen
    // gebraucht). lastPhase im selben Lauf aktualisieren.
    for (let bin = 0; bin <= halfFFT; bin++) {
      mags[bin] = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      const ph  = Math.atan2(im[bin], re[bin]);
      srcPhases[bin] = ph;
      let pdiff = ph - this.lastPhase[ch][bin];
      this.lastPhase[ch][bin] = ph;
      const expectedDiff = bin * expectedPhaseDiff;
      let deviation = pdiff - expectedDiff;
      deviation -= 2 * Math.PI * Math.round(deviation / (2 * Math.PI));
      const binFreq  = bin * sampleRate / FFT_SIZE;
      const instFreq = binFreq + deviation * sampleRate / (2 * Math.PI * HOP_SIZE);
      const cs = _centShiftW(instFreq, side, this.warpPoints) * this.strength;
      const newFreq = instFreq * Math.pow(2, cs / 1200);
      const tb = Math.round(newFreq * FFT_SIZE / sampleRate);
      targetBinArr[bin] = (tb < 0 || tb > halfFFT) ? -1 : tb;
      newFreqArr[bin]   = newFreq;
    }

    // Peak-Detection: lokales Maximum über zwei Bins links/rechts macht die
    // Peaks robuster gegen Rausch-Bumps als nur ein Bin Nachbarschaft.
    let peakCount = 0;
    for (let bin = 2; bin <= halfFFT - 2; bin++) {
      const m = mags[bin];
      if (m > mags[bin-1] && m > mags[bin+1] &&
          m > mags[bin-2] && m > mags[bin+2]) {
        peakBins[peakCount++] = bin;
      }
    }

    // Nächster Peak pro Bin (Index in peakBins-Array). Ohne Peaks fallback
    // auf -1 → Standard-Algorithmus pro Bin.
    if (peakCount === 0) {
      nearestPeakIdx.fill(-1);
    } else {
      let pi = 0;
      for (let bin = 0; bin <= halfFFT; bin++) {
        while (pi < peakCount - 1) {
          const dCurr = bin - peakBins[pi];
          const dNext = bin - peakBins[pi+1];
          const aCurr = dCurr < 0 ? -dCurr : dCurr;
          const aNext = dNext < 0 ? -dNext : dNext;
          if (aNext <= aCurr) pi++;
          else break;
        }
        nearestPeakIdx[bin] = pi;
      }
    }

    // PASS 1 — Peaks: standard Phase-Vorwärts mit der jeweiligen newFreq.
    for (let i = 0; i < peakCount; i++) {
      const bin = peakBins[i];
      const targetBin = targetBinArr[bin];
      if (targetBin < 0) continue;
      if (!phaseUpdated[targetBin]) {
        this.sumPhase[ch][targetBin] += 2 * Math.PI * newFreqArr[bin] * HOP_SIZE / sampleRate;
        phaseUpdated[targetBin] = 1;
      }
      const ph = this.sumPhase[ch][targetBin];
      newPhaseAt[targetBin] = ph;
      newRe[targetBin] += mags[bin] * Math.cos(ph);
      newIm[targetBin] += mags[bin] * Math.sin(ph);
    }

    // PASS 2 — Non-Peaks: Phase relativ zum nächsten Peak. Ohne Peaks im
    // Frame Fallback auf den alten Per-Bin-Algorithmus.
    for (let bin = 0; bin <= halfFFT; bin++) {
      const pi = nearestPeakIdx[bin];
      const targetBin = targetBinArr[bin];
      if (targetBin < 0) continue;
      if (pi < 0) {
        // Frame ohne Peaks (Stille, DC): per-Bin Standard-Akkumulation
        if (!phaseUpdated[targetBin]) {
          this.sumPhase[ch][targetBin] += 2 * Math.PI * newFreqArr[bin] * HOP_SIZE / sampleRate;
          phaseUpdated[targetBin] = 1;
          newPhaseAt[targetBin] = this.sumPhase[ch][targetBin];
        }
        const ph = newPhaseAt[targetBin];
        newRe[targetBin] += mags[bin] * Math.cos(ph);
        newIm[targetBin] += mags[bin] * Math.sin(ph);
        continue;
      }
      const peakBin = peakBins[pi];
      if (bin === peakBin) continue; // Peak schon in Pass 1 verarbeitet
      const peakTarget = targetBinArr[peakBin];
      if (peakTarget < 0) continue;
      const peakNewPhase = newPhaseAt[peakTarget];
      // Relative Phase zum Peak im Quellspektrum auf das neue Spektrum übertragen.
      const lockedPhase = peakNewPhase + (srcPhases[bin] - srcPhases[peakBin]);
      newRe[targetBin] += mags[bin] * Math.cos(lockedPhase);
      newIm[targetBin] += mags[bin] * Math.sin(lockedPhase);
    }

    // Hermite-Symmetrie erst NACH der Schleife setzen. Vorher wurde sie pro
    // Bin überschrieben und konnte deshalb nicht mit dem '+='-akkumulierten
    // positiven Halbspektrum mithalten — Imaginärteil im Zeitsignal, hörbar
    // als Verzerrung.
    for (let bin = 1; bin < halfFFT; bin++) {
      newRe[FFT_SIZE - bin] = newRe[bin];
      newIm[FFT_SIZE - bin] = -newIm[bin];
    }

    _ifft(newRe, newIm);

    // OLA: gefensterter Frame in Output-Ringpuffer addieren.
    // Normierungsfaktor 2/3 für Hann-Fenster bei 75 % Overlap.
    const OLA = 2.0 / 3.0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const pos = (this.outWritePos[ch] + i) % RING;
      this.outBuf[ch][pos] += newRe[i] * win[i] * OLA;
    }
    this.outWritePos[ch] = (this.outWritePos[ch] + HOP_SIZE) % RING;
  }

  _processFrameSinModel(ch) {
    const win = this.window;
    const halfFFT = FFT_SIZE / 2;

    const re        = this.scratchRe;
    const im        = this.scratchIm;
    const newRe     = this.scratchNewRe;
    const newIm     = this.scratchNewIm;
    const mags      = this.scratchMags;
    const srcPhases = this.scratchSrcPhases;
    const peakBins  = this.scratchPeakBins;

    newRe.fill(0);
    newIm.fill(0);
    im.fill(0);

    // 1. Frame aus Ringpuffer + Hann-Fenster
    const startIdx = (this.inWritePos[ch] - FFT_SIZE + RING * 2) % RING;
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = this.inBuf[ch][(startIdx + i) % RING] * win[i];
    }
    _fft(re, im);

    // 2. Magnituden + Phasen sammeln
    for (let bin = 0; bin <= halfFFT; bin++) {
      mags[bin] = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      srcPhases[bin] = Math.atan2(im[bin], re[bin]);
    }

    // 3. Peak-Detection (mind. 2 Bins Nachbarschaft)
    let peakCount = 0;
    for (let bin = 2; bin <= halfFFT - 2 && peakCount < this.smMaxPeaks; bin++) {
      const m = mags[bin];
      if (m > mags[bin-1] && m > mags[bin+1] &&
          m > mags[bin-2] && m > mags[bin+2]) {
        peakBins[peakCount++] = bin;
      }
    }

    const side = ch === 0 ? "left" : "right";
    const prevCount = this.smPrevPeakCount[ch];
    const prevFreq  = this.smPrevPeakFreq[ch];
    const prevPhase = this.smPrevPeakPhase[ch];

    const curFreqArr  = new Float32Array(peakCount);
    const curPhaseArr = new Float32Array(peakCount);

    // 4. Residual: Source-Spektrum übernehmen, Peak-Anteile dämpfen
    for (let bin = 0; bin <= halfFFT; bin++) {
      newRe[bin] = re[bin];
      newIm[bin] = im[bin];
    }
    for (let i = 0; i < peakCount; i++) {
      const pb = peakBins[i];
      newRe[pb] = 0;
      newIm[pb] = 0;
      if (pb > 0)         { newRe[pb-1] *= 0.5; newIm[pb-1] *= 0.5; }
      if (pb < halfFFT)   { newRe[pb+1] *= 0.5; newIm[pb+1] *= 0.5; }
    }

    // 5. Pro Peak: Quadratic Interpolation, Pitch-Shift, Phase-Tracking, Synthese
    const tolerance = 0.5 * sampleRate / FFT_SIZE;
    for (let i = 0; i < peakCount; i++) {
      const pb = peakBins[i];

      // 5a) Quadratic Interpolation
      const m_l = mags[pb-1];
      const m_c = mags[pb];
      const m_r = mags[pb+1];
      const denom = m_l - 2*m_c + m_r;
      const delta = (Math.abs(denom) > 1e-12) ? 0.5 * (m_l - m_r) / denom : 0;
      const subBin   = pb + delta;
      const magInterp = m_c - 0.25 * (m_l - m_r) * delta;
      const peakFreq = subBin * sampleRate / FFT_SIZE;

      // 5b) Cent-Verschiebung aus Warp-Kurve
      const cs = _centShiftW(peakFreq, side, this.warpPoints) * this.strength;
      const newFreq = peakFreq * Math.pow(2, cs / 1200);

      // 5c) Phase-Tracking
      let matchedPhase = NaN;
      let bestDist = Infinity;
      for (let j = 0; j < prevCount; j++) {
        const d = Math.abs(peakFreq - prevFreq[j]);
        if (d < tolerance && d < bestDist) {
          bestDist = d;
          matchedPhase = prevPhase[j];
        }
      }

      let curPhase;
      if (!isNaN(matchedPhase)) {
        curPhase = matchedPhase + 2 * Math.PI * newFreq * HOP_SIZE / sampleRate;
      } else {
        curPhase = srcPhases[pb];
      }
      curPhase = curPhase - 2 * Math.PI * Math.round(curPhase / (2 * Math.PI));

      curFreqArr[i]  = peakFreq;
      curPhaseArr[i] = curPhase;

      // 5d) Spectral Spread auf zwei nächste Integer-Bins
      const newBinFloat = newFreq * FFT_SIZE / sampleRate;
      const newBinLow   = Math.floor(newBinFloat);
      const frac        = newBinFloat - newBinLow;
      const newBinHigh  = newBinLow + 1;

      if (newBinLow >= 0 && newBinLow <= halfFFT) {
        const a = (1 - frac) * magInterp;
        newRe[newBinLow] += a * Math.cos(curPhase);
        newIm[newBinLow] += a * Math.sin(curPhase);
      }
      if (newBinHigh >= 0 && newBinHigh <= halfFFT) {
        const a = frac * magInterp;
        newRe[newBinHigh] += a * Math.cos(curPhase);
        newIm[newBinHigh] += a * Math.sin(curPhase);
      }
    }

    // 6. Tracking-State für nächsten Frame
    for (let i = 0; i < peakCount; i++) {
      prevFreq[i]  = curFreqArr[i];
      prevPhase[i] = curPhaseArr[i];
    }
    this.smPrevPeakCount[ch] = peakCount;

    // 7. Hermite-Symmetrie
    for (let bin = 1; bin < halfFFT; bin++) {
      newRe[FFT_SIZE - bin] = newRe[bin];
      newIm[FFT_SIZE - bin] = -newIm[bin];
    }

    _ifft(newRe, newIm);

    // 8. OLA
    const OLA = 2.0 / 3.0;
    for (let i = 0; i < FFT_SIZE; i++) {
      const pos = (this.outWritePos[ch] + i) % RING;
      this.outBuf[ch][pos] += newRe[i] * win[i] * OLA;
    }
    this.outWritePos[ch] = (this.outWritePos[ch] + HOP_SIZE) % RING;
  }
}

// ---- Hilfsfunktionen (keine Importe im Worklet möglich) ----

function _centShiftW(f, side, points) {
  if (!points || points.length === 0) return 0;
  const key = side === "left" ? "csL" : "csR";
  if (points.length === 1) return points[0][key];
  const logF = Math.log2(f <= 0 ? 1 : f);
  const logFirst = Math.log2(points[0].varFreq);
  const logLast  = Math.log2(points[points.length - 1].varFreq);
  if (logF <= logFirst) return points[0][key];
  if (logF >= logLast)  return points[points.length - 1][key];
  for (let i = 0; i < points.length - 1; i++) {
    const f1 = Math.log2(points[i].varFreq);
    const f2 = Math.log2(points[i + 1].varFreq);
    if (logF >= f1 && logF <= f2) {
      const t = (logF - f1) / (f2 - f1);
      return points[i][key] + t * (points[i + 1][key] - points[i][key]);
    }
  }
  return 0;
}

// Cooley-Tukey FFT in-place
function _fft(re, im) {
  const N = re.length;
  // Bit-Reversal
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
          t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  // Butterflies
  for (let len = 2; len <= N; len <<= 1) {
    const half  = len >> 1;
    const angle = -2 * Math.PI / len;
    const wRe   = Math.cos(angle);
    const wIm   = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < half; k++) {
        const tRe = curRe * re[i + k + half] - curIm * im[i + k + half];
        const tIm = curRe * im[i + k + half] + curIm * re[i + k + half];
        re[i + k + half] = re[i + k] - tRe;
        im[i + k + half] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const nr = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nr;
      }
    }
  }
}

function _ifft(re, im) {
  for (let i = 0; i < re.length; i++) im[i] = -im[i];
  _fft(re, im);
  const N = re.length;
  for (let i = 0; i < N; i++) {
    re[i] /= N;
    im[i] = -im[i] / N;
  }
}

registerProcessor("freq-warp-processor", FreqWarpProcessor);
`;

// Vocoder-Latenz: ein FFT-Fenster Samples (synchron mit dem Wert im Worklet
// oben). Wird gebraucht, um den ungewarpten Original-Pfad bei "Beide Seiten"
// um dieselbe Latenz zu verzögern, sonst sind L/R ~45 ms auseinander.
const _VOCODER_FFT_SIZE = 2048;

let pWarpedBuf = null;
let pWarpOn = false;
let pWarpMode = "var_side";     // "ref_side" | "var_side" | "symmetric" — Default synchron mit HTML
let pWarpStrength = 100;        // 0–150
let pWarpBusy = false;
let pWarpMethod = "sinmodel";   // "offline" | "bandshift" | "vocoder" | "sinmodel"
let pWarpWorkletReady = false;
let pWarpAffected = { warpsLeft: false, warpsRight: false };
let _pWarpFResVersion = 0;

// ---- Warp-Kurve aufbauen --------------------------------

function buildWarpPoints(fResData, warpMode, invert = false) {
  // fResData: Array { varSide, refSide, elIdx, varFreq, refFreq }
  // Gibt sortiertes Array { varFreq, csL, csR } zurück.
  // invert: Cent-Werte umkehren (für NH-Simulation: Frequenzfehler zeigen statt korrigieren)
  const pts = [];
  for (const r of fResData) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    let csL = 0, csR = 0;
    if (warpMode === "ref_side") {
      if (r.refSide === "left")  csL = -cent;
      else                       csR = -cent;
    } else if (warpMode === "var_side") {
      if (r.varSide === "left")  csL = cent;
      else                       csR = cent;
    } else { // symmetric
      if (r.refSide === "left")  csL = -cent / 2;
      else                       csR = -cent / 2;
      if (r.varSide === "left")  csL += cent / 2;
      else                       csR += cent / 2;
    }
    if (invert) { csL = -csL; csR = -csR; }
    pts.push({ varFreq: r.varFreq, csL, csR });
  }
  pts.sort((a, b) => a.varFreq - b.varFreq);
  return pts;
}

// ---- Hilfsfunktion: betroffene Seiten ermitteln ---------

function _warpAffectedSides(points) {
  let l = false, r = false;
  for (const p of points) {
    if (Math.abs(p.csL) > 1e-9) l = true;
    if (Math.abs(p.csR) > 1e-9) r = true;
  }
  return { warpsLeft: l, warpsRight: r };
}

// ---- Interpolation --------------------------------------

function centShift(f, side, points) {
  if (!points || points.length === 0) return 0;
  const key = side === "left" ? "csL" : "csR";
  if (points.length === 1) return points[0][key];
  const logF = Math.log2(f);
  const logFirst = Math.log2(points[0].varFreq);
  const logLast  = Math.log2(points[points.length - 1].varFreq);
  if (logF <= logFirst) return points[0][key];
  if (logF >= logLast)  return points[points.length - 1][key];
  for (let i = 0; i < points.length - 1; i++) {
    const f1 = Math.log2(points[i].varFreq);
    const f2 = Math.log2(points[i + 1].varFreq);
    if (logF >= f1 && logF <= f2) {
      const t = (logF - f1) / (f2 - f1);
      return points[i][key] + t * (points[i + 1][key] - points[i][key]);
    }
  }
  return 0;
}

// ---- Offline-Vorberechnung ------------------------------

async function pComputeWarpedBuffer(srcBuf, warpMode, strength, fResData) {
  if (warpMode === "off" || !fResData || fResData.length === 0 || strength === 0) {
    return srcBuf;
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fResData, warpMode, nhSim);
  pWarpAffected = _warpAffectedSides(points);
  const str = strength / 100;

  // Bänder: ein Band pro Stützpunkt (varFreq als Bandmitte)
  const bands = points.map(p => ({
    freq: p.varFreq,
    csL: p.csL * str,
    csR: p.csR * str,
  }));

  const sampleRate = srcBuf.sampleRate;
  // Reservepuffer: max mögliche Längenänderung bei maximaler Verschiebung
  // Für kleine Shifts (< 300 Cent) ist 1.5x mehr als genug
  const outLen = Math.ceil(srcBuf.length * 1.5);
  const oc = new OfflineAudioContext(2, outLen, sampleRate);

  // Pro Kanal, pro Band: Bandpaß → Pitch-Shift via playbackRate → Gain → Merger
  for (let chan = 0; chan < 2; chan++) {
    const side = chan === 0 ? "left" : "right";

    // Einzel-Kanal-Buffer aus srcBuf extrahieren
    const chanBuf = oc.createBuffer(1, srcBuf.length, sampleRate);
    const src0 = srcBuf.numberOfChannels > chan
      ? srcBuf.getChannelData(chan)
      : srcBuf.getChannelData(0);
    chanBuf.getChannelData(0).set(src0);

    for (const band of bands) {
      const cs = side === "left" ? band.csL : band.csR;
      // playbackRate < 1 → Ton wird tiefer (Länge wächst)
      // playbackRate > 1 → Ton wird höher (Länge schrumpft)
      // Wir wollen Tonhöhe um cs Cent verschieben:
      //   neue Frequenz = alte * 2^(cs/1200)
      //   playbackRate = 2^(cs/1200) bringt Tonhöhenverschiebung um cs Cent
      const rate = Math.pow(2, cs / 1200);

      const src = oc.createBufferSource();
      src.buffer = chanBuf;
      src.playbackRate.value = rate;

      const bp = oc.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = band.freq;
      bp.Q.value = 2.17; // ~halbe Oktave

      // Normalisierungs-Gain: Energie bleibt konstant über alle Bänder
      const g = oc.createGain();
      g.gain.value = 1 / Math.sqrt(bands.length);

      // Kanalweiche: Mono-Signal in Zielkanal schreiben
      const splitter = oc.createChannelSplitter(1);
      const merger = oc.createChannelMerger(2);

      src.connect(bp);
      bp.connect(g);
      g.connect(splitter);
      // splitter hat nur 1 Ausgang (chan 0), in Zielkanal des Mergers
      splitter.connect(merger, 0, chan);
      merger.connect(oc.destination);

      src.start(0);
    }
  }

  const rendered = await oc.startRendering();

  // Auf Originallänge trimmen
  const targetLen = srcBuf.length;
  if (rendered.length > targetLen) {
    // Für Rückgabe AudioBuffer aus dem Live-Context verwenden
    const c = gPC();
    const out = c.createBuffer(2, targetLen, sampleRate);
    out.getChannelData(0).set(rendered.getChannelData(0).subarray(0, targetLen));
    out.getChannelData(1).set(rendered.getChannelData(1).subarray(0, targetLen));
    return out;
  }
  return rendered;
}

// ---- Variante B: Live Bandweise Pitch-Shift -------------

function pBuildWarpedGraph(audioCtx, srcBuf, destNode, warpMode, strength, fResData, startTime, offsetSec) {
  if (warpMode === "off" || !fResData || fResData.length === 0 || strength === 0) {
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fResData, warpMode, nhSim);
  const str = strength / 100;
  const bands = points.map(p => ({
    freq: p.varFreq,
    csL: p.csL * str,
    csR: p.csR * str,
  }));

  const sources = [];
  const gainFactor = 1 / Math.sqrt(bands.length);

  for (let chan = 0; chan < 2; chan++) {
    const side = chan === 0 ? "left" : "right";
    for (const band of bands) {
      const cs   = side === "left" ? band.csL : band.csR;
      const rate = Math.pow(2, cs / 1200);

      const src = audioCtx.createBufferSource();
      src.buffer = srcBuf;
      src.playbackRate.value = rate;

      const splitter = audioCtx.createChannelSplitter(2);
      const bp = audioCtx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = band.freq;
      bp.Q.value = 2.17;

      const g = audioCtx.createGain();
      g.gain.value = gainFactor;

      const merger = audioCtx.createChannelMerger(2);

      src.connect(splitter);
      splitter.connect(bp, chan, 0);
      bp.connect(g);
      g.connect(merger, 0, chan);
      merger.connect(destNode);

      src.start(startTime, offsetSec);
      sources.push(src);
    }
  }

  return {
    sources,
    stop() { for (const s of sources) { try { s.stop(); } catch(e) {} } }
  };
}

// ---- Variante A: Phasen-Vocoder (AudioWorklet) ----------

function _warpSideGains(mode) {
  if (mode === "left")  return { gL: 1, gR: 0 };
  if (mode === "right") return { gL: 0, gR: 1 };
  return { gL: 1, gR: 1 };
}

async function pInitWarpWorklet(audioCtx) {
  if (pWarpWorkletReady) return;
  const blob = new Blob([_FREQ_WARP_PROCESSOR_CODE], {
    type: "application/javascript",
  });
  const url = URL.createObjectURL(blob);
  try {
    await audioCtx.audioWorklet.addModule(url);
    pWarpWorkletReady = true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function pBuildVocoderGraph(audioCtx, srcBuf, destNode, warpMode, strength, fResData, startTime, offsetSec) {
  await pInitWarpWorklet(audioCtx);

  if (warpMode === "off" || !fResData || fResData.length === 0 || strength === 0) {
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fResData, warpMode, nhSim);
  const str = strength / 100;
  const adjPoints = points.map(p => ({
    varFreq: p.varFreq,
    csL: p.csL * str,
    csR: p.csR * str,
  }));

  const src = audioCtx.createBufferSource();
  src.buffer = srcBuf;

  const workletNode = new AudioWorkletNode(audioCtx, "freq-warp-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  const methodEl = (typeof document !== "undefined")
    ? document.getElementById("plWarpMethod") : null;
  const alg = (methodEl && methodEl.value === "sinmodel")
    ? "sinmodel" : "phase_vocoder";
  workletNode.port.postMessage({
    type: "params",
    points: adjPoints,
    strength: 1.0,   // Strength bereits in adjPoints eingerechnet
    active: true,
    algorithm: alg,
  });

  src.connect(workletNode);

  // Side-Routing: gewarpte Kanäle gehen über Gains in einen Merger.
  // Bei "both" + ref_side/var_side: nicht betroffene Seite kommt aus zweiter
  // BufferSource (Original-srcBuf), so daß die nicht gewarpte Seite klanglich
  // unverändert bleibt.
  const mode = getPlayerSide();
  const sg = _warpSideGains(mode);
  const splitter = audioCtx.createChannelSplitter(2);
  const merger   = audioCtx.createChannelMerger(2);
  const gL = audioCtx.createGain(); gL.gain.value = sg.gL;
  const gR = audioCtx.createGain(); gR.gain.value = sg.gR;

  workletNode.connect(splitter);
  splitter.connect(gL, 0); splitter.connect(gR, 1);

  const affected = _warpAffectedSides(points);

  let origSrc = null;
  let origSplitter = null;
  let origGL = null;
  let origGR = null;
  if (mode === "both") {
    if (!affected.warpsLeft || !affected.warpsRight) {
      origSrc = audioCtx.createBufferSource();
      origSrc.buffer = srcBuf;
      origSplitter = audioCtx.createChannelSplitter(2);
      origGL = audioCtx.createGain();
      origGR = audioCtx.createGain();
      origGL.gain.value = affected.warpsLeft  ? 0 : 1;
      origGR.gain.value = affected.warpsRight ? 0 : 1;
      if (!affected.warpsLeft)  gL.gain.value = 0;
      if (!affected.warpsRight) gR.gain.value = 0;
      // Vocoder-Pfad hat FFT-Fenster Latenz; ungewarpten Pfad um denselben
      // Betrag verzögern, damit L/R synchron sind.
      const delaySec = _VOCODER_FFT_SIZE / audioCtx.sampleRate;
      const origDelayL = audioCtx.createDelay(1);
      const origDelayR = audioCtx.createDelay(1);
      origDelayL.delayTime.value = delaySec;
      origDelayR.delayTime.value = delaySec;
      origSrc.connect(origSplitter);
      origSplitter.connect(origGL, 0);
      origSplitter.connect(origGR, 1);
      origGL.connect(origDelayL);
      origGR.connect(origDelayR);
      origDelayL.connect(merger, 0, 0);
      origDelayR.connect(merger, 0, 1);
    }
  }

  gL.connect(merger, 0, 0);
  gR.connect(merger, 0, 1);
  merger.connect(destNode);

  src.start(startTime, offsetSec);
  if (origSrc) origSrc.start(startTime, offsetSec);

  const sources = origSrc ? [src, origSrc] : [src];

  return {
    sources,
    workletNode,
    stop() {
      try { src.stop(); } catch(e) {}
      if (origSrc) { try { origSrc.stop(); } catch(e) {} }
      try { workletNode.disconnect(); } catch(e) {}
    }
  };
}

// ---- Live-Update für laufenden Vocoder ------------------

// Schickt aktuelle Warp-Parameter (Modus, Stärke) ohne Pfadwechsel an den
// schon laufenden Worklet. Wirkt knackfrei, sofort. Für Bandshift gibt es
// kein Live-Update (kein Worklet) — dort regelt der Aufrufer den Rebuild.
function pWarpLiveUpdate() {
  if (typeof pCurrentPlayback === "undefined" || !pCurrentPlayback) return;
  const wn = pCurrentPlayback.workletNode;
  if (!wn) return;
  if (!fRes || fRes.length === 0) return;
  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fRes, pWarpMode, nhSim);
  const str = pWarpStrength / 100;
  const adjPoints = points.map(p => ({
    varFreq: p.varFreq,
    csL: p.csL * str,
    csR: p.csR * str,
  }));
  // active=true; effektives Bypass passiert oben (pWarpOn / EQ-Master)
  const methodEl = document.getElementById("plWarpMethod");
  const alg = (methodEl && methodEl.value === "sinmodel")
    ? "sinmodel" : "phase_vocoder";
  wn.port.postMessage({
    type: "params",
    points: adjPoints,
    strength: 1.0,
    active: !!pWarpOn,
    algorithm: alg,
  });
}

// ---- UI-Aktionen ----------------------------------------

function pWarpUpdUI() {
  const cbEl      = document.getElementById("plWarpOn");
  const statusEl  = document.getElementById("plWarpStatus");
  const hintEl    = document.getElementById("plWarpHint");
  const recalcBtn = document.getElementById("plWarpRecalc");
  const methodSel = document.getElementById("plWarpMethod");

  if (!cbEl) return;

  const method = methodSel ? methodSel.value : "offline";
  pWarpMethod = method;

  // "noch nicht verfügbar"-Hinweis entfernt – alle Verfahren implementiert
  const notAvailEl = document.getElementById("plWarpNotAvail");
  if (notAvailEl) notAvailEl.style.display = "none";

  const noFRes = !fRes || fRes.length === 0;
  const n = fRes ? fRes.length : 0;

  // Status
  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    statusText = t("pwStatusBusy");
  } else if (noFRes) {
    statusText = t("pwStatusReady");
  } else if (method === "offline") {
    statusText = pWarpedBuf
      ? t("pwStatusActiveOffline").replace("{n}", n)
      : t("pwStatusReady");
  } else if (method === "bandshift") {
    statusText = t("pwStatusActiveBandShift").replace("{n}", n);
  } else if (method === "vocoder") {
    statusText = t("pwStatusActiveVocoder").replace("{n}", n);
  } else if (method === "sinmodel") {
    statusText = t("pwStatusActiveSinModel").replace("{n}", n);
  }
  if (statusEl) statusEl.textContent = statusText;

  // Hinweis bei fehlenden fRes-Daten
  if (hintEl) {
    if (pWarpOn && noFRes) {
      hintEl.textContent = t("pwHintNoFRes");
      hintEl.style.display = "";
    } else {
      hintEl.style.display = "none";
    }
  }

  // Recalc-Button nur beim Offline-Verfahren
  if (recalcBtn) {
    const showRecalc = pWarpOn && !noFRes && method === "offline";
    recalcBtn.style.display = showRecalc ? "" : "none";
    recalcBtn.disabled = pWarpBusy;
    recalcBtn.textContent = t("pwBtnRecompute");
  }

  // Play-Button nur bei Offline-Berechnung sperren
  const playBtn = document.getElementById("plPlay");
  if (playBtn) playBtn.disabled = pWarpBusy && method === "offline";

}

async function pWarpTrigger() {
  pWarpedBuf = null;

  if (!pWarpOn) {
    pWarpUpdUI();
    return;
  }
  if (!fRes || fRes.length === 0) {
    pWarpUpdUI();
    return;
  }
  if (!pSourceBuf) {
    pWarpUpdUI();
    return;
  }

  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "offline";
  pWarpMethod = method;

  // Variante B und A brauchen keine Vorberechnung – UI aktualisieren, fertig
  if (method !== "offline") {
    pWarpUpdUI();
    return;
  }

  // Variante C: Offline-Vorberechnung
  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpUpdUI();

  try {
    pWarpedBuf = await pComputeWarpedBuffer(
      pSourceBuf,
      pWarpMode,
      pWarpStrength,
      fRes
    );
  } catch (err) {
    console.error("Warp-Fehler:", err);
    pWarpedBuf = null;
  }

  pWarpBusy = false;
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying) pPlay();
}
