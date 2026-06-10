# Anweisung Phase 5: Frequenz-Warping Verfahren A und B

## Kontext

Dies ist ein Bauauftrag für das CI Sound Balancing Tool. Vor dem
Start MUSST du CODESTRUKTUR.md im Projekt lesen, um die
Modulstruktur, Ladereihenfolge und globalen Konventionen zu
verstehen.

Voraussetzung: Phase 4 (Frequenz-Warping Variante C, Offline-
Vorberechnung) ist abgeschlossen. Es gibt in der UI bereits ein
Dropdown "Verfahren" mit drei Einträgen, von denen aktuell nur
"Offline-Vorberechnung" funktioniert. Die Einträge "Live (mit
Latenz)" und "Bandweise Pitch-Shift" zeigen einen "noch nicht
verfügbar"-Hinweis.

Diese Phase implementiert die beiden noch fehlenden Verfahren.

## Was bereits da ist (aus Phase 4)

In `freq-warp.js`:
- `buildWarpPoints(fResData, warpMode)` – Berechnung der
  Stützpunkte mit cs-Werten für L/R je nach Modus
- `centShift(f, side, points)` – lineare Interpolation auf
  log₂(f), clamping außerhalb der Stützpunkte
- `pComputeWarpedBuffer(srcBuf, warpMode, strength, fResData)` –
  Offline-Rendering für Variante C

In `player.js`:
- Globale Variablen `pWarpedBuf`, `pWarpMode`, `pWarpOn`,
  `pWarpStrength`, `pWarpBusy`, `pWarpMethod`
- `getPlaybackBuffer` nutzt `pWarpedBuf` bei aktivem Warping

In `index.html`:
- Player-Sektion "Frequenz-Warping" mit drei Verfahren-Optionen
  im Dropdown, drei Korrektur-Modi, Stärke-Slider, Status,
  Warnhinweis

Die beiden neuen Verfahren erweitern dieses Fundament. UI-Struktur
bleibt unverändert, nur die "noch nicht verfügbar"-Hinweise
entfallen.

## Verfahren B: Bandweise Pitch-Shift (zuerst implementieren)

### Konzept

Variante B ist konzeptionell verwandt mit Variante C, hat aber
einen wichtigen Unterschied: Sie läuft NICHT offline mit
Vorberechnung, sondern als Live-Audio-Graph. Bei jedem Play wird
der Graph aufgebaut, kein vorberechneter Buffer.

Vorteile gegenüber C:
- Keine Vorberechnung beim Aktivieren
- Bei Änderung von Modus oder Stärke: sofortige Wirkung beim
  nächsten Play, kein Re-Render
- Live-Mikrofon-Eingabe wäre theoretisch möglich (aber nicht in
  dieser Phase)

Nachteile:
- Pro abgespieltes Stück wird der Graph neu aufgebaut (kein
  Performance-Problem, aber mehr Audio-Knoten)
- Klangqualität ähnlich wie C (gleicher Algorithmus, nur live
  statt offline)

### Algorithmus

Statt OfflineAudioContext wird der laufende AudioContext (gPC)
verwendet. Die Subband-Pipeline wird im laufenden Audio-Graph
aufgebaut.

Routing pro Kanal und pro Band:
1. AudioBufferSourceNode mit `playbackRate = 2^(cs/1200)` (wie
   in Variante C)
2. ChannelSplitter (2 Kanäle aus Stereo-Quelle)
3. BiquadFilter (bandpass, Q ≈ 2.17)
4. GainNode (Normalisierung: `1/sqrt(N_bands)`)
5. ChannelMerger zurück zu Stereo

Da `playbackRate` für ALLE Bänder unterschiedlich ist, muß PRO
Band eine eigene BufferSourceNode erstellt werden. Das heißt für
N Stützpunkte: 2 Kanäle × N Bänder = 2N BufferSourceNodes pro
Play.

### Implementierung in freq-warp.js

Neue Funktion `pBuildWarpedGraph`:

```javascript
// Baut den Live-Audio-Graph für Variante B auf.
// Rückgabe: Objekt mit { sources, stop() }
// - sources: Array aller BufferSourceNodes (für späteren stop())
// - stop(): stoppt alle Quellen sauber
//
// Parameter:
// - audioCtx: laufender AudioContext (gPC)
// - srcBuf: Quell-AudioBuffer
// - destNode: Ziel-AudioNode (wo der Graph hinverbunden wird,
//   typischerweise der EQ-Eingang oder direkt der Destination)
// - warpMode: "off" | "ref_side" | "var_side" | "symmetric"
// - strength: 0-150 (Prozent)
// - fResData: Array der Frequenzabgleich-Messpunkte
// - startTime: AudioContext-Zeit für source.start()
// - offsetSec: Offset im Buffer (für seek)
function pBuildWarpedGraph(audioCtx, srcBuf, destNode, warpMode, strength, fResData, startTime, offsetSec) {
  if (warpMode === "off" || fResData.length === 0 || strength === 0) {
    // Fallback: ein einziges Source-Node ohne Warping
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return {
      sources: [src],
      stop() { try { src.stop(); } catch(e) {} }
    };
  }

  const points = buildWarpPoints(fResData, warpMode);
  const bands = points.map(p => ({
    freq: p.varFreq,
    csL: p.csL * (strength / 100),
    csR: p.csR * (strength / 100),
  }));

  const sources = [];
  const gainFactor = 1 / Math.sqrt(bands.length);

  for (let chan = 0; chan < 2; chan++) {
    const side = chan === 0 ? "left" : "right";
    for (const band of bands) {
      const cs = side === "left" ? band.csL : band.csR;
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

      // playbackRate ändert die Wiedergabezeit. Bei offsetSec muss
      // der reale Sample-Offset berechnet werden:
      // wirklicher Offset = offsetSec (Web Audio rechnet das selbst um)
      src.start(startTime, offsetSec);
      sources.push(src);
    }
  }

  return {
    sources,
    stop() {
      for (const s of sources) {
        try { s.stop(); } catch(e) {}
      }
    }
  };
}
```

### Integration in player.js

Wenn `pWarpMethod === "bandshift"` und `pWarpOn === true`, soll
`pPlay` (oder die zentrale Wiedergabefunktion) statt eines
einzelnen BufferSourceNodes den Graph aus `pBuildWarpedGraph`
aufbauen.

Wichtig: Die zentrale Wiedergabe-Logik in player.js muß so
gestaltet sein, daß der Stop-Mechanismus für Pause und Stop alle
Sources im Graph erreicht, nicht nur einen.

Vorgeschlagene Struktur:

```javascript
// In player.js, statt einer einzelnen Source-Variable:
let pCurrentPlayback = null;  // {sources: [...], stop()}

function pStop() {
  if (pCurrentPlayback) {
    pCurrentPlayback.stop();
    pCurrentPlayback = null;
  }
  // ... vorhandene Stop-Logik
}

function pPlay() {
  // ... vorhandene Setup-Logik (EQ etc.)
  const ctx = gPC();
  const destNode = /* EQ-Eingang oder direkter Output */;

  if (pWarpOn && pWarpMethod === "bandshift" && fRes.length > 0) {
    pCurrentPlayback = pBuildWarpedGraph(
      ctx, pSourceBuf, destNode,
      pWarpMode, pWarpStrength, fRes,
      ctx.currentTime, pPosSec
    );
  } else if (pWarpOn && pWarpMethod === "offline" && pWarpedBuf) {
    // Wie bisher (Variante C): pWarpedBuf abspielen
    const src = ctx.createBufferSource();
    src.buffer = pWarpedBuf;
    src.connect(destNode);
    src.start(ctx.currentTime, pPosSec);
    pCurrentPlayback = { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  } else {
    // Original ohne Warping
    const src = ctx.createBufferSource();
    src.buffer = pSourceBuf;
    src.connect(destNode);
    src.start(ctx.currentTime, pPosSec);
    pCurrentPlayback = { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }
}
```

Die genauen Aufrufpunkte und Variablen-Namen orientieren sich am
vorhandenen player.js – beim Bauen lesen und übernehmen.

### Bekannte Einschränkungen Variante B (für die UI-Warnung)

Gleiche wie Variante C, weil derselbe Subband-Algorithmus
zugrunde liegt:
- Bei Pitch-Shifts > 500 Cent entstehen hörbare Artefakte
- Approximation, kein echter Phasen-Vocoder
- Zeitliche Drift zwischen Bändern, weil `playbackRate` die
  Bandlängen unterschiedlich macht. Bei kleinen Cent-Werten
  vernachlässigbar.

Zusätzliche Einschränkung:
- Mehr CPU-Last während der Wiedergabe (N Bänder × 2 Kanäle live)
- Wenn der Browser-Tab in den Hintergrund wechselt, kann es zu
  Aussetzern kommen (Browser drosselt Hintergrund-Tabs)

## Verfahren A: Phasen-Vocoder (danach implementieren)

### Konzept

Echter spektraler Phasen-Vocoder mit FFT. Live-Audio-Verarbeitung
im AudioWorklet, nicht im Main-Thread.

Vorteile:
- Mathematisch korrekte Frequenzverschiebung
- Beste Qualität bei größeren Pitch-Shifts (>500 Cent)
- Keine zeitliche Drift zwischen Bändern

Nachteile:
- Inhärente Latenz von einer Frame-Größe (typisch 50 ms bei
  2048 Samples @ 44.1 kHz)
- Komplexität: AudioWorklet, FFT-Implementierung
- Leichte "phasige" Artefakte bei transienten Signalen (Schlagzeug)

### Algorithmus

Phasen-Vocoder Schritte:
1. Eingangssignal in Frames mit Hop-Size 1/4 Frame-Length zerlegen
   (Overlap 75%)
2. Pro Frame: Hann-Fenster anwenden, dann FFT
3. Spektrum: Magnitude und Phase extrahieren
4. Phasen-Differenz zwischen aufeinanderfolgenden Frames berechnen
   (das gibt die instantane Frequenz pro Bin)
5. Frequenz-Mapping: Jeden Bin entsprechend der Warp-Kurve auf
   einen neuen Bin verschieben
6. Phase resynthetisieren (akkumulierte Phase basierend auf
   neuer Frequenz)
7. Inverse FFT, Fenster, Overlap-Add

Für **nicht-uniformes** Frequenz-Warping (verschiedene Cent-Werte
für verschiedene Frequenzen) ist Schritt 5 entscheidend:

```
Für jeden Source-Bin i:
  f_source = i * sample_rate / N      // FFT-Frequenz dieses Bins
  cs = centShift(f_source, side, points) * strength/100
  rate = 2^(cs/1200)
  f_target = f_source * rate
  target_bin = round(f_target * N / sample_rate)
  if target_bin in range:
    new_spectrum[target_bin] += magnitude[i] * exp(i * new_phase[i])
```

### Implementierung in AudioWorklet

Zwei Dateien:
- `freq-warp-processor.js` (AudioWorklet, separat geladen)
- Erweiterung von `freq-warp.js` für AudioWorklet-Initialisierung
  und Parameter-Übertragung

### AudioWorklet Skelett (freq-warp-processor.js)

```javascript
// Wird per audioCtx.audioWorklet.addModule() geladen.
// Läuft in eigenem Audio-Thread.

const FFT_SIZE = 2048;
const HOP_SIZE = 512;  // 75% Overlap

class FreqWarpProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return []; // Parameter über port, nicht über AudioParam
  }

  constructor(options) {
    super();
    // Einstellungen
    this.warpPoints = [];  // {varFreq, csL, csR} sortiert
    this.strength = 1.0;
    this.active = false;

    // Input/Output Buffer pro Kanal (Ringpuffer)
    this.inBuf = [new Float32Array(FFT_SIZE * 2), new Float32Array(FFT_SIZE * 2)];
    this.outBuf = [new Float32Array(FFT_SIZE * 2), new Float32Array(FFT_SIZE * 2)];
    this.inWritePos = 0;
    this.outReadPos = 0;
    this.samplesSinceHop = 0;

    // Hann-Fenster
    this.window = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / FFT_SIZE);
    }

    // Phasen-Akkumulator pro Kanal pro Bin
    this.lastPhase = [new Float32Array(FFT_SIZE / 2 + 1), new Float32Array(FFT_SIZE / 2 + 1)];
    this.sumPhase = [new Float32Array(FFT_SIZE / 2 + 1), new Float32Array(FFT_SIZE / 2 + 1)];

    // Empfangen von Parametern aus dem Main-Thread
    this.port.onmessage = (e) => {
      if (e.data.type === "params") {
        this.warpPoints = e.data.points;
        this.strength = e.data.strength;
        this.active = e.data.active;
      }
    };
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || !input[0]) return true;

    const blockSize = input[0].length;  // typisch 128

    for (let chan = 0; chan < Math.min(input.length, 2); chan++) {
      const inCh = input[chan];
      const outCh = output[chan];

      if (!this.active) {
        // Bypass
        for (let i = 0; i < blockSize; i++) outCh[i] = inCh[i];
        continue;
      }

      // 1. Eingang in Ringpuffer schreiben
      for (let i = 0; i < blockSize; i++) {
        this.inBuf[chan][this.inWritePos] = inCh[i];
        this.inWritePos = (this.inWritePos + 1) % (FFT_SIZE * 2);
      }

      // 2. Wenn HOP_SIZE Samples gesammelt: FFT-Frame verarbeiten
      this.samplesSinceHop += blockSize;
      while (this.samplesSinceHop >= HOP_SIZE) {
        this.samplesSinceHop -= HOP_SIZE;
        this.processFrame(chan);
      }

      // 3. Ausgabe aus Output-Ringpuffer
      for (let i = 0; i < blockSize; i++) {
        outCh[i] = this.outBuf[chan][this.outReadPos];
        this.outBuf[chan][this.outReadPos] = 0; // gelesene Stelle leeren
        this.outReadPos = (this.outReadPos + 1) % (FFT_SIZE * 2);
      }
    }

    return true;
  }

  processFrame(chan) {
    // FFT-Frame aus Ringpuffer extrahieren und fenstern
    const frame = new Float32Array(FFT_SIZE);
    const startPos = (this.inWritePos - FFT_SIZE + FFT_SIZE * 2) % (FFT_SIZE * 2);
    for (let i = 0; i < FFT_SIZE; i++) {
      frame[i] = this.inBuf[chan][(startPos + i) % (FFT_SIZE * 2)] * this.window[i];
    }

    // FFT (siehe FFT-Implementierung unten)
    const re = new Float32Array(FFT_SIZE);
    const im = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) { re[i] = frame[i]; im[i] = 0; }
    fft(re, im);

    // Magnitude und Phase, Frequenzanalyse
    const halfFFT = FFT_SIZE / 2;
    const newRe = new Float32Array(FFT_SIZE);
    const newIm = new Float32Array(FFT_SIZE);

    const side = chan === 0 ? "left" : "right";
    const expectedPhaseDiff = (2 * Math.PI * HOP_SIZE) / FFT_SIZE;

    for (let bin = 0; bin <= halfFFT; bin++) {
      const mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      const phase = Math.atan2(im[bin], re[bin]);

      // Phasen-Differenz zur instantanen Frequenz
      let pdiff = phase - this.lastPhase[chan][bin];
      this.lastPhase[chan][bin] = phase;

      // Erwartete Phasendiff für diesen Bin
      const binFreq = bin * sampleRate / FFT_SIZE;
      const expectedDiff = bin * expectedPhaseDiff;
      let deviation = pdiff - expectedDiff;
      // Auf -PI..PI normieren
      deviation = deviation - 2 * Math.PI * Math.round(deviation / (2 * Math.PI));

      const instFreq = binFreq + deviation * sampleRate / (2 * Math.PI * HOP_SIZE);

      // Warp anwenden
      const cs = centShiftWorklet(instFreq, side, this.warpPoints) * this.strength;
      const newFreq = instFreq * Math.pow(2, cs / 1200);

      // Ziel-Bin
      const targetBin = Math.round(newFreq * FFT_SIZE / sampleRate);
      if (targetBin < 0 || targetBin > halfFFT) continue;

      // Neue Phase akkumulieren
      const newPhase = this.sumPhase[chan][targetBin] + 2 * Math.PI * targetBin * HOP_SIZE / FFT_SIZE;
      this.sumPhase[chan][targetBin] = newPhase;

      // Magnitude akkumulieren (overlapping bins addieren)
      newRe[targetBin] += mag * Math.cos(newPhase);
      newIm[targetBin] += mag * Math.sin(newPhase);
      if (targetBin > 0 && targetBin < halfFFT) {
        // Symmetrie fürs reelle Signal
        newRe[FFT_SIZE - targetBin] = newRe[targetBin];
        newIm[FFT_SIZE - targetBin] = -newIm[targetBin];
      }
    }

    // Inverse FFT
    ifft(newRe, newIm);

    // Fenstern und Overlap-Add in Output-Ringpuffer
    const outStart = (this.outReadPos + 0) % (FFT_SIZE * 2);
    for (let i = 0; i < FFT_SIZE; i++) {
      const pos = (outStart + i) % (FFT_SIZE * 2);
      this.outBuf[chan][pos] += newRe[i] * this.window[i] * (HOP_SIZE / FFT_SIZE);
      // Normalisierung: Overlap-Add mit Hann und 75%-Overlap
      // erfordert Faktor 2/3 ≈ HOP_SIZE/FFT_SIZE * 4
    }
  }
}

// centShift-Implementierung im Worklet (keine Importe möglich)
function centShiftWorklet(f, side, points) {
  if (points.length === 0) return 0;
  const key = side === "left" ? "csL" : "csR";
  if (points.length === 1) return points[0][key];
  const logF = Math.log2(f);
  if (logF <= Math.log2(points[0].varFreq)) return points[0][key];
  if (logF >= Math.log2(points[points.length-1].varFreq)) return points[points.length-1][key];
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

// FFT-Implementierung (Cooley-Tukey, in-place)
function fft(re, im) {
  const N = re.length;
  // Bit-Reversal
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterflies
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = -2 * Math.PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curWRe = 1, curWIm = 0;
      for (let k = 0; k < halfLen; k++) {
        const tRe = curWRe * re[i + k + halfLen] - curWIm * im[i + k + halfLen];
        const tIm = curWRe * im[i + k + halfLen] + curWIm * re[i + k + halfLen];
        re[i + k + halfLen] = re[i + k] - tRe;
        im[i + k + halfLen] = im[i + k] - tIm;
        re[i + k] += tRe;
        im[i + k] += tIm;
        const newWRe = curWRe * wRe - curWIm * wIm;
        const newWIm = curWRe * wIm + curWIm * wRe;
        curWRe = newWRe;
        curWIm = newWIm;
      }
    }
  }
}

function ifft(re, im) {
  // Konjugieren
  for (let i = 0; i < re.length; i++) im[i] = -im[i];
  fft(re, im);
  // Konjugieren und Skalieren
  for (let i = 0; i < re.length; i++) {
    re[i] = re[i] / re.length;
    im[i] = -im[i] / re.length;
  }
}

registerProcessor("freq-warp-processor", FreqWarpProcessor);
```

### Initialisierung in freq-warp.js

```javascript
let pWarpWorkletReady = false;
let pWarpWorkletNode = null;

async function pInitWarpWorklet(audioCtx) {
  if (pWarpWorkletReady) return;
  await audioCtx.audioWorklet.addModule("freq-warp-processor.js");
  pWarpWorkletReady = true;
}

async function pBuildVocoderGraph(audioCtx, srcBuf, destNode, warpMode, strength, fResData, startTime, offsetSec) {
  await pInitWarpWorklet(audioCtx);

  if (warpMode === "off" || fResData.length === 0 || strength === 0) {
    // Bypass
    const src = audioCtx.createBufferSource();
    src.buffer = srcBuf;
    src.connect(destNode);
    src.start(startTime, offsetSec);
    return { sources: [src], stop() { try { src.stop(); } catch(e) {} } };
  }

  const points = buildWarpPoints(fResData, warpMode);
  const adjPoints = points.map(p => ({
    varFreq: p.varFreq,
    csL: p.csL * (strength / 100),
    csR: p.csR * (strength / 100),
  }));

  const src = audioCtx.createBufferSource();
  src.buffer = srcBuf;

  const workletNode = new AudioWorkletNode(audioCtx, "freq-warp-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });

  // Parameter an Worklet senden
  workletNode.port.postMessage({
    type: "params",
    points: adjPoints,
    strength: 1.0,  // Strength bereits in adjPoints eingerechnet
    active: true,
  });

  src.connect(workletNode);
  workletNode.connect(destNode);
  src.start(startTime, offsetSec);

  return {
    sources: [src],
    workletNode,
    stop() {
      try { src.stop(); } catch(e) {}
      try { workletNode.disconnect(); } catch(e) {}
    }
  };
}
```

### Integration in player.js

Erweiterung der `pPlay`-Verzweigung:

```javascript
if (pWarpOn && pWarpMethod === "vocoder" && fRes.length > 0) {
  pCurrentPlayback = await pBuildVocoderGraph(
    ctx, pSourceBuf, destNode,
    pWarpMode, pWarpStrength, fRes,
    ctx.currentTime, pPosSec
  );
}
```

Da `pBuildVocoderGraph` async ist (wegen AudioWorklet-Laden beim
ersten Aufruf), muß `pPlay` async werden oder den Aufruf
entsprechend behandeln.

### Bekannte Einschränkungen Variante A

- Latenz: FFT_SIZE/sample_rate = 2048/44100 ≈ 46 ms. Für Musik-
  Wiedergabe ohne Echtzeit-Anforderung egal, für Live-Sync
  spürbar.
- "Phasing"-Artefakte bei perkussiven Signalen (Schlagzeug,
  Klavier-Anschläge), weil die Frame-basierte Verarbeitung
  Transienten verschmiert
- Höhere CPU-Last als Variante B
- Erste Aktivierung dauert kurz wegen Worklet-Module-Loading

## UI-Anpassungen

In `index.html` und `i18n.js`:
- "noch nicht verfügbar"-Hinweis bei den Dropdown-Einträgen
  entfernen
- Status-Anzeige um den aktuellen Modus erweitern:
  - "Aktiv (Offline-Vorberechnung, N Stützpunkte)"
  - "Aktiv (Bandweise, N Stützpunkte)"
  - "Aktiv (Phasen-Vocoder, N Stützpunkte)"
- Warnhinweis-Text um Methoden-spezifische Hinweise erweitern:

  DE Erweiterung: "Bandweise Pitch-Shift und Phasen-Vocoder
  benötigen keine Vorberechnung – Änderungen wirken beim
  nächsten Play. Bei stark unterschiedlichen Pitch-Shifts pro
  Frequenzbereich liefert der Phasen-Vocoder die beste Qualität,
  bei moderaten Shifts ist Offline-Vorberechnung am natürlichsten.
  Bandweise Pitch-Shift ist der schnellste Modus mit guter
  Qualität bei kleinen Shifts."

  EN/FR/ES analog.

## Modul-Struktur

Geänderte Dateien:
- `freq-warp.js`: zwei neue Funktionen `pBuildWarpedGraph` und
  `pBuildVocoderGraph` + Worklet-Init
- `player.js`: Verzweigung in `pPlay` um zwei neue Methoden
- `index.html`: Hinweise an den Dropdown-Einträgen entfernen
- `i18n.js`: Texte aktualisieren

Neue Datei:
- `freq-warp-processor.js`: AudioWorklet-Processor

Wichtig: `freq-warp-processor.js` wird NICHT als Script-Tag in
index.html geladen, sondern per
`audioCtx.audioWorklet.addModule("freq-warp-processor.js")` zur
Laufzeit. Die Datei muß im gleichen Verzeichnis wie index.html
liegen, damit der relative Pfad funktioniert.

CODESTRUKTUR.md aktualisieren: neue Datei vermerken, Hinweis daß
sie nicht im Script-Tag steht.

## Speichern/Laden

In file.js: `pWarpMethod` ist bereits in saveJson/applyLoadedData
seit Phase 4 enthalten (wenn nicht, ergänzen). Die drei Werte:
- `"offline"` (Variante C)
- `"bandshift"` (Variante B)
- `"vocoder"` (Variante A)

## Druck-Export

In `expText`: Wenn Warping aktiv, das aktive Verfahren mit
exportieren:
- "Frequenz-Warping: Aktiv (Phasen-Vocoder)"
oder entsprechend.

## Akzeptanzkriterien

1. Dropdown-Einträge "Live" und "Bandweise" sind aktiv, ohne
   "noch nicht verfügbar"-Hinweis
2. Bei Auswahl "Bandweise Pitch-Shift": Play funktioniert ohne
   Vorberechnungspause; Audio kommt mit hörbarem Warp-Effekt
3. Bei Auswahl "Phasen-Vocoder": Erste Aktivierung lädt das
   Worklet-Modul (kurz), danach Play funktioniert mit Vocoder-Warp
4. Stop und Pause funktionieren bei allen drei Verfahren sauber
   (keine hängenden Audio-Quellen)
5. Wechsel zwischen Verfahren während des Stops übernimmt das
   neue Verfahren beim nächsten Play
6. Wechsel von Modus oder Stärke wirkt sich aus:
   - Variante C: löst Neuberechnung aus (wie bisher)
   - Varianten A und B: wirkt beim nächsten Play, keine
     Neuberechnung nötig
7. fRes-Änderungen erfordern bei Variante C "Neu berechnen", bei
   A und B nicht (wirken automatisch beim nächsten Play)
8. CPU-Last bei A spürbar höher als bei B und C – akzeptabel
9. Speichern/Laden bewahrt pWarpMethod
10. Druck-Export zeigt aktives Verfahren
11. Alle 4 Sprachen
12. Keine Regressionen bei Variante C

## Was NICHT in dieser Phase

- Echtzeit-Mikrofon-Eingang als Warp-Quelle
- Adaptive FFT-Größe (z.B. größere FFT für tiefe Frequenzen)
- Time-Stretching zur Längenkompensation bei Variante B
- Optimierungen der FFT (Web Assembly, native FFT-Bibliotheken)
- Hilbert-Transformation als alternative Bandshift-Methode

## Vor dem Bauen

1. CODESTRUKTUR.md vollständig lesen
2. Aktuellen Stand von freq-warp.js und player.js durchgehen
3. Phase-4-Code verstehen (Variante C als Referenz, da
   Variante B sehr ähnlich)
4. AudioWorklet API verstehen (siehe MDN AudioWorkletProcessor)
5. Bei Variante B: Schrittweise testen wie in Phase 4 beschrieben
6. Bei Variante A:
   - Erst: Worklet ohne Warp aufsetzen, prüfen daß Bypass
     (active=false) das Audio unverändert durchläßt
   - Dann: konstante Cent-Verschiebung über alle Frequenzen
     (z.B. +200 Cent), prüfen daß alle Töne entsprechend
     verschoben klingen
   - Schließlich: echte Warp-Kurve aus fRes

Bei Unklarheit nachfragen, statt zu raten. Insbesondere die
FFT- und Phasen-Vocoder-Logik ist anspruchsvoll – wenn der
Output bei einfachen Tests nicht plausibel klingt, lieber
zurückmelden statt weiter zu graben.

## Reihenfolge der Implementierung

Empfohlen: Variante B zuerst (einfacher, Subband-Code aus
Variante C wiederverwendbar), Variante A danach.

Wenn nach Bau von Variante B die Token knapp werden, kann
Variante A in einer eigenen Sitzung folgen. Die UI-Anpassungen
(Entfernen der "noch nicht verfügbar"-Hinweise) müssen für jede
Variante einzeln gemacht werden – also bei Bau nur einer
Variante nur deren Hinweis entfernen.
