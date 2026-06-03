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
let pWarpMode = "right";        // "left" | "right" | "symmetric" — Default synchron mit HTML
let pWarpStrength = 100;        // 0–150
let pWarpBusy = false;
let pWarpMethod = "rubberband";   // "rubberband" | "offline" | "bandshift" | "vocoder" | "sinmodel"
let pWarpWorkletReady = false;
let pWarpAffected = { warpsLeft: false, warpsRight: false };
let _pWarpFResVersion = 0;

// Quelle der Warp-Punkte: fRes (final) + laufende Tracks (vorläufig), exakt
// dieselbe Vereinigung wie die Meßergebnis-Tabelle in results.js. So sieht
// das Warping immer das, was der Nutzer in der Tabelle sieht — keine
// abweichende Logik. fmStatus 'in-progress' und 'in-progress-early'
// (Platzhalter cent=0) werden mitgenommen; final hat Vorrang pro
// (varSide, elIdx).
function _warpFResSource() {
  const out = (typeof fRes !== "undefined" && Array.isArray(fRes))
    ? fRes.slice() : [];
  const sides = ["left", "right"];

  // Stufe 2: in-progress-Pseudo-Einträge aus aktiven Tracks.
  // Vorrang: nur einreihen, wenn kein finaler fRes-Eintrag pro (side, elIdx).
  if (typeof _fmrBuildInProgressEntries === "function") {
    for (const side of sides) {
      let prov;
      try { prov = _fmrBuildInProgressEntries(side) || []; }
      catch (e) { prov = []; }
      if (!prov.length) continue;
      const finalsBySide = new Set();
      for (const r of out) {
        if (r && r.varSide === side) finalsBySide.add(r.elIdx);
      }
      for (const p of prov) {
        if (!finalsBySide.has(p.elIdx)) out.push(p);
      }
    }
  }

  // Stufe 3: Slider-Vor-Schätzungen.
  // Vorrang: nur einreihen, wenn weder finaler fRes-Eintrag noch
  // in-progress-Eintrag pro (side, elIdx) vorhanden.
  if (typeof _fmrBuildSliderEntries === "function") {
    for (const side of sides) {
      let ests;
      try { ests = _fmrBuildSliderEntries(side) || []; }
      catch (e) { ests = []; }
      if (!ests.length) continue;
      const covered = new Set();
      for (const r of out) {
        if (r && r.varSide === side) covered.add(r.elIdx);
      }
      for (const e of ests) {
        if (!covered.has(e.elIdx)) out.push(e);
      }
    }
  }

  return out;
}

// Zählt die Quelle für UI-Anzeige.
function _warpFResStats() {
  const all = _warpFResSource();
  let finals = 0, provisional = 0, sliderEst = 0;
  for (const r of all) {
    if (!r) continue;
    if (r._sliderEstimate)   sliderEst++;
    else if (r._provisional) provisional++;
    else                     finals++;
  }
  return { total: all.length, finals, provisional, sliderEst };
}

// ---- Warp-Kurve aufbauen --------------------------------

function buildWarpPoints(fResData, warpMode, invert = false) {
  // fResData: Array { varSide, refSide, elIdx, varFreq, refFreq }
  // Gibt sortiertes Array { varFreq, csL, csR } zurück.
  //
  // Vorzeichen-Konvention der zurückgegebenen cs-Werte:
  // - Ohne invert (Default): cs = 1200 * log2(refFreq / varFreq), also die
  //   Wahrnehmungs-/Simulations-Richtung — wie die Cochlea die Wahrnehmung
  //   gegenüber der nominellen Elektroden-Mittenfrequenz verschiebt.
  //   `effFreqDisplay` nutzt das so, um die wahrgenommene Frequenz für die
  //   Anzeige zu berechnen.
  // - Mit invert=true: Vorzeichen gespiegelt; ergibt die Korrektur-/Vorhalt-
  //   Richtung — das Audio wird so vorverarbeitet, daß nach der Cochlea-
  //   Verzerrung beim CI-Träger die richtige Frequenz ankommt.
  //
  // Aufrufkonvention der Audio-Pipeline: `buildWarpPoints(..., !nhSim)`.
  //   NH-Sim aus (Korrektur-Modus) → invert=true → Vorhalt für CI-Wiedergabe.
  //   NH-Sim an (Simulation für Normalhörende) → invert=false → Verzerrung
  //   wird direkt aufs Audio gelegt.
  const pts = [];
  for (const r of fResData) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    let csL = 0, csR = 0;
    if (warpMode === "left") {
      if (r.refSide === "symmetric") {
        // sym-Eintrag ohne klare Ref-/Var-Seite: gleichmäßig verteilen
        csL = cent / 2;
        csR = cent / 2;
      } else if (r.varSide === "left") {
        csL = cent;
      } else if (r.refSide === "left") {
        csL = -cent;
      }
    } else if (warpMode === "right") {
      if (r.refSide === "symmetric") {
        csL = cent / 2;
        csR = cent / 2;
      } else if (r.varSide === "right") {
        csR = cent;
      } else if (r.refSide === "right") {
        csR = -cent;
      }
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

// ---- Migrations-Helfer für Alt-Werte ref_side/var_side ----
// Übersetzt Alt-Werte in absolute Seiten anhand der Referenzseite,
// die in den gespeicherten fRes-Einträgen steht. Wenn keine
// fRes-Daten vorhanden sind, fallback auf Default-Seite.
function _migrateLegacyWarpMode(savedMode, savedFRes) {
  if (savedMode !== "ref_side" && savedMode !== "var_side") {
    return savedMode;
  }
  let refSide = "left";
  if (Array.isArray(savedFRes) && savedFRes.length > 0) {
    const first = savedFRes[0];
    if (first && typeof first.refSide === "string") {
      refSide = first.refSide;
    }
  }
  if (refSide === "symmetric") return "symmetric";
  if (savedMode === "ref_side") {
    return refSide === "left" ? "left" : "right";
  }
  // var_side
  return refSide === "left" ? "right" : "left";
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
  // fResData wird ignoriert — Warp-Quelle ist immer _warpFResSource(),
  // damit fRes + laufende Tracks 1:1 wie in der Meßergebnis-Tabelle einfließen.
  const src = _warpFResSource();
  if (warpMode === "off" || src.length === 0 || strength === 0) {
    return srcBuf;
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(src, warpMode, !nhSim);
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

// ---- Variante E: Rubberband-WASM Offline-Vorberechnung -----
//
// Bandweise echter Pitch-Shift via Rubberband-WASM. FIR-Bandpaesse
// (linearphasig, Blackman-Harris-Fenster) mit Grenzen am geometrischen
// Mittel der Nachbarmittenfrequenzen, pro Band ein Rubberband-Lauf in
// EngineFiner-Qualitaet, danach Summe und Pegelausgleich. Mono-
// Optimierung: pro Lauf nur die effektiv hoerbaren und tatsaechlich
// gewarpten Kanaele verarbeiten (siehe _rbDecideAffectedSides).
//
// Aufrufkonvention identisch zu pComputeWarpedBuffer.

const _RB_FIR_ORDER = 4096; // FIR-Ordnung der Bandpaesse (linearphasig)

// Rubberband-Options-Bitmaske (siehe vendors/rubberband-wasm/src/index.ts).
// Werte hartcodiert, damit die BA nicht vom UMD-Export der Enums abhaengt;
// im UMD-Namespace heisst die Sammlung `rubberband.RubberBandOption`,
// die Konstanten haben dieselben Werte.
const _RB_OPTIONS_OFFLINE_HIGHQ =
    0x00000000  // ProcessOffline
  | 0x20000000  // EngineFiner
  | 0x02000000  // PitchHighQuality
  | 0x01000000  // FormantPreserved
  | 0x00000010  // StretchPrecise
  | 0x00000000  // WindowStandard
  | 0x00010000  // ThreadingNever
  | 0x00000000; // ChannelsApart

// Entscheidet, welche Kanaele tatsaechlich Rubberband durchlaufen
// muessen — abhaengig von Player-Seite (was wird hoerbar?) und
// warpAffected-Sides (wo gibt es ueberhaupt Cent-Werte != 0?).
// Liefert { needL, needR }.
function _rbDecideAffectedSides(points, playerSide) {
  const aff = _warpAffectedSides(points);

  let audibleL = false, audibleR = false;
  if (playerSide === "left") audibleL = true;
  else if (playerSide === "right") audibleR = true;
  else { audibleL = true; audibleR = true; } // "both" oder "mono"

  return {
    needL: audibleL && aff.warpsLeft,
    needR: audibleR && aff.warpsRight,
  };
}

// Geometrische Bandgrenzen aus Stuetzpunkt-Frequenzen.
// Gibt Array von [low, high] Tupeln zurueck, gleiche Anzahl wie points.
// Bei einem einzigen Stuetzpunkt: ein Vollband (0 .. ~Nyquist).
function _rbBuildBandEdges(points, nyquist) {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [[0, nyquist * 0.999]];
  }
  const edges = [0];
  for (let i = 0; i < points.length - 1; i++) {
    edges.push(Math.sqrt(points[i].varFreq * points[i + 1].varFreq));
  }
  edges.push(nyquist * 0.999);

  const bands = [];
  for (let i = 0; i < points.length; i++) {
    bands.push([edges[i], edges[i + 1]]);
  }
  return bands;
}

// FIR-Bandpass-Koeffizienten (linearphasig, Blackman-Harris-Fenster).
// lowN, highN: normalisierte Frequenzen (0..1, 1 = Nyquist).
// Aequivalent zu scipy.signal.firwin(order+1, [low, high], pass_zero=False,
// window="blackmanharris") aus scripts/freqshift_filterbank.py.
function _rbDesignBandpassFIR(lowN, highN, order) {
  const n = order + 1;
  const h = new Float32Array(n);
  const M = order;
  // Sinc-basierter Bandpass = Sinc(high) - Sinc(low).
  for (let i = 0; i < n; i++) {
    const k = i - M / 2;
    let v;
    if (k === 0) {
      v = highN - lowN;
    } else {
      v = (Math.sin(Math.PI * highN * k) - Math.sin(Math.PI * lowN * k))
        / (Math.PI * k);
    }
    // Blackman-Harris-Fenster (4-Term)
    const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
    const w = a0
            - a1 * Math.cos((2 * Math.PI * i) / M)
            + a2 * Math.cos((4 * Math.PI * i) / M)
            - a3 * Math.cos((6 * Math.PI * i) / M);
    h[i] = v * w;
  }
  return h;
}

// Convolution: signal (Float32Array) * fir (Float32Array) -> Float32Array
// gleicher Laenge ("same"-Mode, FIR-Verzoegerung order/2 heraus-
// gerechnet). Linear, ohne FFT — bei order=4096 wuerde JS O(N*M) zu
// langsam. Stattdessen FFT-Convolution via OfflineAudioContext +
// ConvolverNode.
async function _rbConvolveViaWebAudio(signal, fir, sampleRate) {
  const outLen = signal.length + fir.length - 1;
  const oc = new OfflineAudioContext(1, outLen, sampleRate);

  const irBuf = oc.createBuffer(1, fir.length, sampleRate);
  irBuf.getChannelData(0).set(fir);

  const conv = oc.createConvolver();
  conv.normalize = false;
  conv.buffer = irBuf;

  const srcBuf = oc.createBuffer(1, signal.length, sampleRate);
  srcBuf.getChannelData(0).set(signal);
  const src = oc.createBufferSource();
  src.buffer = srcBuf;
  src.connect(conv);
  conv.connect(oc.destination);
  src.start(0);

  const rendered = await oc.startRendering();
  // FIR-Verzoegerung ist (fir.length - 1) / 2; wir trimmen den Anfang
  // weg und bringen die Ausgabe auf signal.length.
  const delay = Math.floor((fir.length - 1) / 2);
  const out = new Float32Array(signal.length);
  const src0 = rendered.getChannelData(0);
  out.set(src0.subarray(delay, delay + signal.length));
  return out;
}

// Pitch-Shift via Rubberband. cents > 0: hoeher, cents < 0: tiefer.
// Liefert Float32Array gleicher Laenge wie signal (Anfangs-Latenz von
// Rubberband wird abgeschnitten, Tail-Padding mit Stille).
async function _rbPitchShift(rb, signal, sampleRate, cents) {
  if (Math.abs(cents) < 0.5) {
    // Vernachlaessigbar — direkt zurueck (defensive Kopie nicht noetig,
    // weil Aufrufer signal nicht weiterverwendet).
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_new(
    sampleRate, 1, _RB_OPTIONS_OFFLINE_HIGHQ, 1.0, pitchScale
  );

  // Pointer-auf-Pointer-Setup fuer Rubberband-API (channels=1).
  const inPtrPtr  = rb.malloc(4);
  const outPtrPtr = rb.malloc(4);
  const CHUNK = 4096;
  const inBufPtr  = rb.malloc(CHUNK * 4);
  const outBufPtr = rb.malloc(CHUNK * 4);
  rb.memWritePtr(inPtrPtr,  inBufPtr);
  rb.memWritePtr(outPtrPtr, outBufPtr);

  try {
    rb.rubberband_set_expected_input_duration(state, signal.length);

    const startPad = rb.rubberband_get_preferred_start_pad(state);
    const tmp = new Float32Array(CHUNK);

    // 1) Study-Phase: Eingabe einmal komplett scannen.
    {
      let pos = -startPad;
      while (pos < signal.length) {
        const want = Math.min(CHUNK, signal.length - Math.max(pos, 0));
        if (want <= 0) break;
        for (let i = 0; i < want; i++) {
          const srcIdx = pos + i;
          tmp[i] = (srcIdx >= 0 && srcIdx < signal.length)
            ? signal[srcIdx] : 0;
        }
        rb.memWrite(inBufPtr, tmp.subarray(0, want));
        const isFinal = (pos + want) >= signal.length ? 1 : 0;
        rb.rubberband_study(state, inPtrPtr, want, isFinal);
        pos += want;
      }
    }

    // 2) Process-Phase: Eingabe erneut, parallel Output abholen.
    const outChunks = [];
    let outTotal = 0;
    {
      let pos = -startPad;
      while (pos < signal.length) {
        const want = Math.min(CHUNK, signal.length - Math.max(pos, 0));
        if (want <= 0) break;
        for (let i = 0; i < want; i++) {
          const srcIdx = pos + i;
          tmp[i] = (srcIdx >= 0 && srcIdx < signal.length)
            ? signal[srcIdx] : 0;
        }
        rb.memWrite(inBufPtr, tmp.subarray(0, want));
        const isFinal = (pos + want) >= signal.length ? 1 : 0;
        rb.rubberband_process(state, inPtrPtr, want, isFinal);

        let avail = rb.rubberband_available(state);
        while (avail > 0) {
          const take = Math.min(avail, CHUNK);
          rb.rubberband_retrieve(state, outPtrPtr, take);
          const chunk = rb.memReadF32(outBufPtr, take);
          const copy = new Float32Array(take);
          copy.set(chunk);
          outChunks.push(copy);
          outTotal += take;
          avail = rb.rubberband_available(state);
        }
        pos += want;
      }
    }

    // 3) Drain: restliches Output abholen, bis Rubberband meldet, daß
    //    nichts mehr da ist (avail <= 0).
    while (true) {
      const avail = rb.rubberband_available(state);
      if (avail <= 0) break;
      const take = Math.min(avail, CHUNK);
      rb.rubberband_retrieve(state, outPtrPtr, take);
      const chunk = rb.memReadF32(outBufPtr, take);
      const copy = new Float32Array(take);
      copy.set(chunk);
      outChunks.push(copy);
      outTotal += take;
    }

    // Output zusammenfuegen.
    const merged = new Float32Array(outTotal);
    let off = 0;
    for (const c of outChunks) {
      merged.set(c, off);
      off += c.length;
    }

    // Anfangs-Latenz von Rubberband abschneiden.
    const startDelay = rb.rubberband_get_start_delay(state);
    const result = new Float32Array(signal.length);
    const usable = Math.max(0, merged.length - startDelay);
    const copyLen = Math.min(signal.length, usable);
    if (copyLen > 0) {
      result.set(merged.subarray(startDelay, startDelay + copyLen));
    }
    return result;
  } finally {
    rb.free(inPtrPtr);
    rb.free(outPtrPtr);
    rb.free(inBufPtr);
    rb.free(outBufPtr);
    rb.rubberband_delete(state);
  }
}

// Eine Mono-Seite durch alle Baender schicken und summieren, mit
// Pegelausgleich.
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bands.length; i++) {
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i]);
    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
  }
  // Pegelausgleich: Peak des Inputs als Ziel.
  let peakIn = 0, peakOut = 0;
  for (let n = 0; n < srcMono.length; n++) {
    const ai = Math.abs(srcMono[n]); if (ai > peakIn)  peakIn  = ai;
    const ao = Math.abs(out[n]);     if (ao > peakOut) peakOut = ao;
  }
  if (peakOut > 0 && peakIn > 0) {
    const scale = peakIn / peakOut;
    for (let n = 0; n < out.length; n++) out[n] *= scale;
  }
  return out;
}

async function pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) {
  const src = _warpFResSource();
  if (warpMode === "off" || src.length === 0 || strength === 0) {
    return srcBuf;
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(src, warpMode, !nhSim);
  pWarpAffected = _warpAffectedSides(points);
  const str = strength / 100;

  const playerSide = (typeof getPlayerSide === "function")
    ? getPlayerSide() : "both";
  const decided = _rbDecideAffectedSides(points, playerSide);

  const sampleRate = srcBuf.sampleRate;
  const nyquist = sampleRate / 2;
  const bands = _rbBuildBandEdges(points, nyquist);

  const csL = points.map(p => p.csL * str);
  const csR = points.map(p => p.csR * str);

  // Rubberband-Interface lazy laden (kann mit sprechender Fehlermeldung
  // werfen — der pWarpTrigger-catch-Block reicht sie nach
  // rubberbandLastError durch).
  const rb = await rubberbandLoad();

  // Quell-Kanaele extrahieren (defensive Kopie — Rubberband schreibt in
  // eigenen WASM-Heap, aber wir vermeiden Aliasing-Risiken).
  const srcL = new Float32Array(srcBuf.getChannelData(0));
  const srcR = srcBuf.numberOfChannels > 1
    ? new Float32Array(srcBuf.getChannelData(1))
    : srcL;

  // Ergebnis-Kanaele initial mit Original-Inhalt (= Bypass, falls nicht
  // gewarpt wird).
  let outL = srcL;
  let outR = srcR;

  if (decided.needL) {
    outL = await _rbProcessMonoSide(rb, srcL, sampleRate, bands, csL);
  }
  if (decided.needR) {
    // Optimierung: wenn L und R identische Quelle und identische cs-Werte
    // haben (z.B. Mono-Datei mit symmetrischem Warp), ein einziger Lauf.
    const sameAsL = decided.needL
                 && srcL === srcR
                 && csL.length === csR.length
                 && csL.every((v, i) => v === csR[i]);
    if (sameAsL) {
      outR = outL;
    } else {
      outR = await _rbProcessMonoSide(rb, srcR, sampleRate, bands, csR);
    }
  }

  // Resultat-Buffer im Live-Context aufbauen.
  const c = gPC();
  const out = c.createBuffer(2, srcBuf.length, sampleRate);
  out.getChannelData(0).set(outL.subarray(0, srcBuf.length));
  out.getChannelData(1).set(outR.subarray(0, srcBuf.length));
  return out;
}

// ---- Variante B: Live Bandweise Pitch-Shift -------------

function pBuildWarpedGraph(audioCtx, srcBuf, destNode, warpMode, strength, fResData, startTime, offsetSec) {
  // fResData wird ignoriert — Quelle ist immer _warpFResSource() (siehe pComputeWarpedBuffer).
  const fSrc = _warpFResSource();
  if (warpMode === "off" || fSrc.length === 0 || strength === 0) {
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fSrc, warpMode, !nhSim);
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

  // fResData wird ignoriert — Quelle ist immer _warpFResSource() (siehe pComputeWarpedBuffer).
  const fSrc = _warpFResSource();
  if (warpMode === "off" || fSrc.length === 0 || strength === 0) {
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fSrc, warpMode, !nhSim);
  const str = strength / 100;
  const adjPoints = points.map(p => ({
    varFreq: p.varFreq,
    csL: p.csL * str,
    csR: p.csR * str,
  }));

  const src = audioCtx.createBufferSource();
  src.buffer = srcBuf;

  // channelCount:2 + channelCountMode:'explicit' zwingt Web Audio, Mono-Input
  // vor dem Worklet auf 2 Kanäle aufzuteilen (L=R=mono), analog MAPLAW.
  // Ohne diese Einstellung würde ein mono Satz-MP3 nur Kanal 0 füllen;
  // bei mode='right' käme das Signal dann auf dem stillen Kanal 1 an → Stille.
  const workletNode = new AudioWorkletNode(audioCtx, "freq-warp-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
    channelCount: 2,
    channelCountMode: "explicit",
    channelInterpretation: "speakers",
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
  const fSrc = _warpFResSource();
  if (fSrc.length === 0) return;
  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(fSrc, pWarpMode, !nhSim);
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
  const methodSel = document.getElementById("plWarpMethod");

  if (!cbEl) return;

  if (pWarpOn) {
    cbEl.textContent = t("pwEnableOn");
    cbEl.style.background = "var(--success)";
    cbEl.style.color = "#fff";
    cbEl.style.borderColor = "var(--success)";
  } else {
    cbEl.textContent = t("pwEnableOff");
    cbEl.style.background = "#e5e7eb";
    cbEl.style.color = "var(--text)";
    cbEl.style.borderColor = "var(--border)";
  }
  const settingsBox = document.getElementById("plWarpSettingsBox");
  if (settingsBox) settingsBox.style.display = pWarpOn ? "" : "none";

  const method = methodSel ? methodSel.value : "offline";
  pWarpMethod = method;

  // "noch nicht verfügbar"-Hinweis entfernt – alle Verfahren implementiert
  const notAvailEl = document.getElementById("plWarpNotAvail");
  if (notAvailEl) notAvailEl.style.display = "none";

  const stats = _warpFResStats();
  const noData = stats.total === 0;
  const n = stats.total;

  // Status
  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    statusText = t("pwStatusBusy");
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (method === "rubberband") {
    if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
      statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
    } else if (pWarpBusy) {
      statusText = t("pwStatusRubberbandLoading");
    } else {
      statusText = pWarpedBuf
        ? t("pwStatusActiveRubberband").replace("{n}", n)
        : t("pwStatusReady");
    }
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
  // Provisorische und Vor-Schätzungs-Anteile hinten anhängen.
  if (statusText && (stats.provisional > 0 || stats.sliderEst > 0)) {
    const parts = [];
    if (stats.provisional > 0) {
      parts.push(t("pwStatusProvisional")
        .replace("{prov}", stats.provisional)
        .replace("{fin}", stats.finals));
    }
    if (stats.sliderEst > 0) {
      parts.push(t("pwStatusSliderEst")
        .replace("{est}", stats.sliderEst));
    }
    statusText += " " + parts.join(" · ");
  }
  if (statusEl) statusEl.textContent = statusText;

  // Hinweis bei fehlenden Daten (weder final noch laufend)
  if (hintEl) {
    if (pWarpOn && noData) {
      hintEl.textContent = t("pwHintNoFRes");
      hintEl.style.display = "";
    } else {
      hintEl.style.display = "none";
    }
  }

  // Play-Button bei laufender Vorberechnung sperren (Offline + Rubberband)
  const playBtn = document.getElementById("plPlay");
  if (playBtn) playBtn.disabled = pWarpBusy && (method === "offline" || method === "rubberband");

}

async function pWarpTrigger() {
  pWarpedBuf = null;

  if (!pWarpOn) {
    pWarpUpdUI();
    return;
  }
  if (_warpFResSource().length === 0) {
    pWarpUpdUI();
    return;
  }
  if (!pSourceBuf) {
    pWarpUpdUI();
    return;
  }

  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "rubberband";
  pWarpMethod = method;

  // Live-Verfahren (vocoder, sinmodel, bandshift) brauchen keine
  // Vorberechnung — UI aktualisieren, fertig.
  if (method !== "offline" && method !== "rubberband") {
    pWarpUpdUI();
    return;
  }

  // Offline-Verfahren (offline, rubberband): Vorberechnung mit
  // Pause-Resume um den Lauf herum.
  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpUpdUI();

  try {
    if (method === "rubberband") {
      pWarpedBuf = await pComputeRubberbandWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength
      );
    } else {
      pWarpedBuf = await pComputeWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength,
        null
      );
    }
  } catch (err) {
    console.error("Warp-Fehler:", err);
    pWarpedBuf = null;
    if (method === "rubberband" && typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
      rubberbandLastError = err && err.message ? err.message : String(err);
    }
  }

  pWarpBusy = false;
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying) pPlay();
}

// ---- Default-Anwendung beim ersten Frequenzabgleich-Resultat ----
// Wird einmal pro Session beim Übergang "0 → 1+ Messungen"
// aufgerufen. Setzt pWarpMode auf die Zielseite (= nicht die
// Referenzseite). Wenn der Default in dieser Session bereits
// angewendet wurde, ist die Funktion idempotent (kein Override).
// Beim Laden eines Saves mit vorhandenen Messungen muß
// pMarkPlayerWarpDefaultAsApplied() einmal aufgerufen werden,
// damit der gespeicherte pWarpMode nicht beim nächsten Insert
// überschrieben wird.
let _pPlayerWarpDefaultApplied = false;

function pApplyWarpModeDefaultFromFm() {
  if (_pPlayerWarpDefaultApplied) return;
  _pPlayerWarpDefaultApplied = true;
  let mode = "right";
  if (typeof fmRefSide === "string") {
    if (fmRefSide === "left")            mode = "right";
    else if (fmRefSide === "right")      mode = "left";
    else if (fmRefSide === "symmetric")  mode = "symmetric";
  }
  pWarpMode = mode;
  const sel = document.getElementById("plWarpModeSelect");
  if (sel) sel.value = pWarpMode;
}

function pMarkPlayerWarpDefaultAsApplied() {
  _pPlayerWarpDefaultApplied = true;
}
