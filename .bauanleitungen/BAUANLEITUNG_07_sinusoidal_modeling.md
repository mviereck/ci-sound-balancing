# Bauanleitung 07 — Sinusoidal Modeling als zusätzliches Pitch-Shift-Verfahren

## Ziel

Eine neue Pitch-Shift-Methode „Sinusoidal Modeling" als vierten Eintrag im
Player-Dropdown `plWarpMethod` einbauen, neben Offline-Vorberechnung, Phasen-
Vocoder und Bandweise Pitch-Shift.

Algorithmus konzeptionell:
- STFT pro Frame (im selben Worklet wie der bestehende Phasen-Vocoder).
- Peaks im Magnituden-Spektrum mit **Quadratic Peak Interpolation** sub-bin-
  genau lokalisieren (Frequenz und Magnitude).
- **Peak-Tracking** über Frames: ein aktueller Peak wird mit einem Peak aus
  dem vorherigen Frame gematcht (Frequenz-Ähnlichkeit). Bei Match: Phase wird
  kontinuierlich fortgeschrieben (echte Oszillator-Phase pro tonalem Teilton).
  Ohne Match: neue Phase startet mit Source-Phase.
- Pitch-Shift pro Peak mit den Cent-Werten aus fRes (gleiche Logik wie heute).
- Synthese: Peak-Beiträge ins neue Spektrum mit **Spectral Spread** auf zwei
  benachbarte Integer-Bins (linear nach Fraktal-Anteil).
- **Residual** (das Restspektrum nach Peak-Subtraktion) bleibt unverschoben.
  → Konsonanten und Rauschen-Anteile (s, t, k, sch) werden nicht pitch-
  shifted; Vokale und tonale Bestandteile schon. Soll Sprachverständlichkeit
  verbessern.
- IFFT + OLA wie im bestehenden Phasen-Vocoder.

Vorgehensweise gegenüber dem bestehenden Phasen-Vocoder mit Identity Phase
Locking:
- Peaks bekommen kontinuierliche Phasen pro Oszillator (Tracking über
  Frames), nicht pro Bin.
- Sub-bin Genauigkeit für Frequenz und Magnitude.
- Magnitude-Spread auf zwei Target-Bins reduziert Comb-Filter-Artefakte.
- Residual unverschoben statt mit Peak-Phase gelockt.

## Vorab lesen

- `freq-warp.js` (komplett, ca. 800 Zeilen — Worklet-String und Main-Code)
- `player.js`, Funktion `pPlay` (ca. Z. 440 ff.)
- `init.js`, Bereich Warp-UI (ca. Z. 47-67 und Z. 795-870)
- `i18n.js`, Anker `pwMethodVocoder` in allen vier Sprachen
- `index.html`, Dropdown `plWarpMethod` (Z. 1030-1034)
- `CODESTRUKTUR.md`, Eintrag freq-warp.js (Z. 73)
- `SPEC.md`, Player-Abschnitt zum Frequenz-Warping

## Schritt 1 — UI-Option im Dropdown

In `index.html`, Z. 1030-1034, einen vierten `<option>`-Eintrag einbauen.
Reihenfolge soll sein: offline, vocoder (Default), sinmodel, bandshift.

**Vorher:**
```html
<select id="plWarpMethod" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
  <option value="offline" data-t-opt="pwMethodOffline"></option>
  <option value="vocoder" data-t-opt="pwMethodVocoder" selected></option>
  <option value="bandshift" data-t-opt="pwMethodBandShift"></option>
</select>
```

**Nachher:**
```html
<select id="plWarpMethod" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
  <option value="offline" data-t-opt="pwMethodOffline"></option>
  <option value="vocoder" data-t-opt="pwMethodVocoder" selected></option>
  <option value="sinmodel" data-t-opt="pwMethodSinModel"></option>
  <option value="bandshift" data-t-opt="pwMethodBandShift"></option>
</select>
```

## Schritt 2 — Übersetzungen und Helfer

### 2.1 i18n.js — Method-Label

Suche in `i18n.js` nach `pwMethodVocoder` und ergänze in **jedem** der vier
Sprachblöcke (de, en, fr, es) einen neuen Schlüssel `pwMethodSinModel` direkt
nach `pwMethodVocoder`:

Deutsch (`pwMethodSinModel: "Sinusoidal Modeling",`)
Englisch (`pwMethodSinModel: "Sinusoidal Modeling",`)
Französisch (`pwMethodSinModel: "Modélisation sinusoïdale",`)
Spanisch (`pwMethodSinModel: "Modelado sinusoidal",`)

### 2.2 i18n.js — Status-Label

Außerdem den Status-Text: suche nach `pwStatusActiveVocoder`. Ergänze in
jedem Sprachblock direkt danach `pwStatusActiveSinModel`:

Deutsch: `pwStatusActiveSinModel: "Sinusoidal aktiv ({n} Stützpunkte)",`
Englisch: `pwStatusActiveSinModel: "Sinusoidal active ({n} points)",`
Französisch: `pwStatusActiveSinModel: "Sinusoïdal actif ({n} points)",`
Spanisch: `pwStatusActiveSinModel: "Sinusoidal activo ({n} puntos)",`

### 2.3 init.js — Method-Label-Helper

In `init.js`, Funktion `_pWarpApplyMethodLabels` (Z. 52-65), das `keys`-Array
um den neuen Schlüssel ergänzen — exakt an der richtigen Position, da dieselbe
Reihenfolge wie im HTML-Dropdown:

**Vorher:**
```js
const keys = ["pwMethodOffline", "pwMethodVocoder", "pwMethodBandShift"];
```

**Nachher:**
```js
const keys = ["pwMethodOffline", "pwMethodVocoder", "pwMethodSinModel", "pwMethodBandShift"];
```

### 2.4 freq-warp.js — Status-Text in pWarpUpdUI

In `freq-warp.js`, Funktion `pWarpUpdUI` (suche nach `function pWarpUpdUI()`),
gibt es einen Block, der je nach `method` den Status-Text setzt:

**Vorher (sinngemäß):**
```js
} else if (method === "offline") {
  statusText = pWarpedBuf
    ? t("pwStatusActiveOffline").replace("{n}", n)
    : t("pwStatusReady");
} else if (method === "bandshift") {
  statusText = t("pwStatusActiveBandShift").replace("{n}", n);
} else if (method === "vocoder") {
  statusText = t("pwStatusActiveVocoder").replace("{n}", n);
}
```

**Nachher**: einen `sinmodel`-Zweig einfügen (z.B. nach dem vocoder-Zweig):
```js
} else if (method === "vocoder") {
  statusText = t("pwStatusActiveVocoder").replace("{n}", n);
} else if (method === "sinmodel") {
  statusText = t("pwStatusActiveSinModel").replace("{n}", n);
}
```

## Schritt 3 — Worklet-Code: neuer Algorithmus

Der Kern. Wir erweitern das Template-String `_FREQ_WARP_PROCESSOR_CODE` in
`freq-warp.js` (Z. 15-269) an mehreren Stellen. Das Template-String hat keine
Backticks und keine `${...}`-Interpolationen im neuen Code, daher kein
Escapen nötig.

### 3.1 Neuer State im Konstruktor

Im FreqWarpProcessor-Konstruktor, nach dem Setzen von `this.lastPhase` und
`this.sumPhase` und vor (oder nach) dem Scratch-Buffer-Block:

```js
// Sinusoidal Modeling: getrackte Peaks (Frequenz + Phase) pro Kanal.
// Wird zwischen Frames durchgereicht, damit jeder tonale Teilton seine
// kontinuierliche Phase behält → kein Roboter-Effekt durch Phasenbrüche.
this.algorithm = "phase_vocoder"; // "phase_vocoder" | "sinmodel"
this.smMaxPeaks      = 64; // Obergrenze (Sprache hat selten mehr Teiltöne)
this.smPrevPeakCount = [0, 0];
this.smPrevPeakFreq  = [new Float32Array(64), new Float32Array(64)];
this.smPrevPeakPhase = [new Float32Array(64), new Float32Array(64)];
```

### 3.2 onmessage erweitern

Im `port.onmessage`-Handler den `algorithm`-Parameter übernehmen, falls er
mitgeschickt wurde:

**Vorher** (im `if (e.data.type === "params")`-Block):
```js
this.warpPoints = e.data.points || [];
this.strength   = e.data.strength ?? 1.0;
this.active     = !!e.data.active;
```

**Nachher** (eine Zeile ergänzen):
```js
this.warpPoints = e.data.points || [];
this.strength   = e.data.strength ?? 1.0;
this.active     = !!e.data.active;
if (e.data.algorithm) this.algorithm = e.data.algorithm;
```

### 3.3 process() dispatcht den Algorithmus

In der bestehenden `process()`-Methode (Z. 68 ff.) gibt es die Stelle, wo
`this._processFrame(ch)` aufgerufen wird (innerhalb der `while (samplesSinceHop >= HOP_SIZE)`-Schleife).

**Vorher:**
```js
for (let ch = 0; ch < nChan; ch++) {
  this._processFrame(ch);
}
```

**Nachher:**
```js
for (let ch = 0; ch < nChan; ch++) {
  if (this.algorithm === "sinmodel") {
    this._processFrameSinModel(ch);
  } else {
    this._processFrame(ch);
  }
}
```

### 3.4 Neue Methode `_processFrameSinModel` einfügen

Direkt **NACH** der schließenden Klammer von `_processFrame(ch)` (also vor
`// ---- Hilfsfunktionen ----`), neue Methode einfügen. Komplett übernehmen:

```js
_processFrameSinModel(ch) {
  const win = this.window;
  const halfFFT = FFT_SIZE / 2;

  // Scratch-Buffer wiederverwenden (kein GC im Audio-Thread).
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

  // 3. Peak-Detection (mind. 2 Bins Nachbarschaft, robuster gegen Rauschen)
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

  // Temporäre Arrays für aktuelle Peaks (klein, OK pro Frame zu allokieren).
  const curFreqArr  = new Float32Array(peakCount);
  const curPhaseArr = new Float32Array(peakCount);

  // 4. Residual: Source-Spektrum ins Target übernehmen, dann Original-Peak-
  //    Anteile dämpfen. Damit bleibt der Rest (Rauschen, Konsonanten)
  //    unverschoben, während die getrackten Peaks weiter unten als Sinusoiden
  //    neu synthetisiert werden.
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
  const tolerance = 0.5 * sampleRate / FFT_SIZE; // ein halber Bin
  for (let i = 0; i < peakCount; i++) {
    const pb = peakBins[i];

    // 5a) Quadratic Interpolation für sub-bin Frequenz & Magnitude
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

    // 5c) Phase-Tracking: passenden Peak im vorherigen Frame finden.
    //     prevFreq[j] enthält die ORIGINAL-Frequenz (vor Shift) — wir
    //     vergleichen also peakFreq mit prevFreq[j] direkt.
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
      // Tracked Peak: kontinuierliche Phase
      curPhase = matchedPhase + 2 * Math.PI * newFreq * HOP_SIZE / sampleRate;
    } else {
      // Neuer Peak: Phase aus Source übernehmen
      curPhase = srcPhases[pb];
    }
    // Auf [-π, π] normieren
    curPhase = curPhase - 2 * Math.PI * Math.round(curPhase / (2 * Math.PI));

    // Aktuellen Peak für nächsten Frame merken
    curFreqArr[i]  = peakFreq;
    curPhaseArr[i] = curPhase;

    // 5d) Synthese: Spectral Spread auf zwei nächste Integer-Bins
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

  // 6. Tracking-State für nächsten Frame zurückschreiben
  for (let i = 0; i < peakCount; i++) {
    prevFreq[i]  = curFreqArr[i];
    prevPhase[i] = curPhaseArr[i];
  }
  this.smPrevPeakCount[ch] = peakCount;

  // 7. Hermite-Symmetrie für reelles Zeitsignal
  for (let bin = 1; bin < halfFFT; bin++) {
    newRe[FFT_SIZE - bin] = newRe[bin];
    newIm[FFT_SIZE - bin] = -newIm[bin];
  }

  _ifft(newRe, newIm);

  // 8. OLA in Output-Ringpuffer
  const OLA = 2.0 / 3.0;
  for (let i = 0; i < FFT_SIZE; i++) {
    const pos = (this.outWritePos[ch] + i) % RING;
    this.outBuf[ch][pos] += newRe[i] * win[i] * OLA;
  }
  this.outWritePos[ch] = (this.outWritePos[ch] + HOP_SIZE) % RING;
}
```

**Wichtig**: die `new Float32Array(peakCount)`-Allokationen pro Frame sind
hier tolerabel, weil peakCount typisch unter 30 liegt. Sonst würde der
Worklet wieder GC-Pressure aufbauen wie vor dem letzten Performance-Fix.

## Schritt 4 — Vocoder-Graph kennt den neuen Algorithmus

In `freq-warp.js`, Funktion `pBuildVocoderGraph` (suche nach
`async function pBuildVocoderGraph`), wird im postMessage an den
Worklet jetzt der Algorithmus mitgegeben.

**Vorher** (in der Funktion, beim `workletNode.port.postMessage`):
```js
workletNode.port.postMessage({
  type: "params",
  points: adjPoints,
  strength: 1.0,
  active: true,
});
```

**Nachher:**
```js
const methodEl = (typeof document !== "undefined")
  ? document.getElementById("plWarpMethod") : null;
const alg = (methodEl && methodEl.value === "sinmodel")
  ? "sinmodel" : "phase_vocoder";
workletNode.port.postMessage({
  type: "params",
  points: adjPoints,
  strength: 1.0,
  active: true,
  algorithm: alg,
});
```

Analog in der Funktion `pWarpLiveUpdate` (Stelle mit `wn.port.postMessage`):
**Vorher:**
```js
wn.port.postMessage({
  type: "params",
  points: adjPoints,
  strength: 1.0,
  active: !!pWarpOn,
});
```

**Nachher:**
```js
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
```

## Schritt 5 — Pfadwahl in pPlay

In `player.js`, `pPlay`-Funktion (suche nach `async function pPlay`), gibt
es im Block für die Pfadwahl zwei `if/else if`-Zweige:

```js
if (pWarpOn && plEqOn && method === "bandshift" && fRes && fRes.length > 0 && pSourceBuf) {
  // Variante B: Live Bandweise Pitch-Shift
  ...
} else if (pWarpOn && plEqOn && method === "vocoder" && fRes && fRes.length > 0 && pSourceBuf) {
  // Variante A: Phasen-Vocoder
  ...
}
```

Den zweiten Zweig auf vocoder **und** sinmodel ausweiten:

**Vorher:**
```js
} else if (pWarpOn && plEqOn && method === "vocoder" && fRes && fRes.length > 0 && pSourceBuf) {
```

**Nachher:**
```js
} else if (pWarpOn && plEqOn && (method === "vocoder" || method === "sinmodel") && fRes && fRes.length > 0 && pSourceBuf) {
```

`pBuildVocoderGraph` bleibt derselbe Pfad — das postMessage-Feld `algorithm`
bestimmt im Worklet, welcher Algorithmus läuft.

## Schritt 6 — Worklet-Preload auch für sinmodel

In `init.js`, im Change-Handler für `plWarpMethod` (ca. Z. 815-835), gibt
es einen Block, der bei vocoder das Worklet vorab lädt:

**Vorher:**
```js
if (this.value === "vocoder" && typeof pInitWarpWorklet === "function") {
  try { pInitWarpWorklet(gPC()); } catch (e) {}
}
```

**Nachher:**
```js
if ((this.value === "vocoder" || this.value === "sinmodel") &&
    typeof pInitWarpWorklet === "function") {
  try { pInitWarpWorklet(gPC()); } catch (e) {}
}
```

## Schritt 7 — Dokumentation

### 7.1 CODESTRUKTUR.md

Im freq-warp.js-Eintrag (Z. 73) die neue Methode und den neuen State
ergänzen. Erweitere die Aufzählung im Eintrag:

- Methoden-Aufzählung: `_processFrameSinModel` zusätzlich nennen.
- State-Block des Worklets: `algorithm`, `smPrevPeakCount`,
  `smPrevPeakFreq`, `smPrevPeakPhase`, `smMaxPeaks` ergänzen — als
  Worklet-State (nicht als Modul-State von freq-warp.js).

### 7.2 SPEC.md

Im Player-Abschnitt (suche nach `Frequenz-Warping mit drei Verfahren`) die
Anzahl auf vier ändern und einen neuen Stichpunkt nach dem Phasen-Vocoder-
Stichpunkt einfügen:

```
- **Sinusoidal Modeling** (Variante D): STFT-basiert wie der Phasen-Vocoder.
  Peaks werden mit Quadratic Peak Interpolation sub-bin-genau lokalisiert
  und über Frames getrackt (kontinuierliche Phase pro Oszillator). Residual-
  Spektrum (nicht-tonale Anteile) bleibt unverschoben → Konsonanten und
  Rauschen klingen natürlicher als beim Phasen-Vocoder. Pitch-Shift mit
  Spectral Spread auf zwei benachbarte Bins. Defaults: Phasen-Vocoder bleibt
  Default; Sinusoidal Modeling wahlweise im Dropdown.
```

## Akzeptanztest (Klick für Klick)

Voraussetzungen:
- **Browser-Tab komplett schließen und neu öffnen** (AudioWorklets bleiben
  pro Tab gecacht; ein normaler Reload reicht oft nicht).
- Eine Audiodatei mit Sprache im Player laden (Podcast, Hörbuch-Snippet).
- `fRes` muss Stützpunkte enthalten (Frequenzabgleich vorher gemessen oder
  via JSON geladen).

### A) Dropdown zeigt vier Einträge
1. Player-Tab öffnen.
2. **Erwartet**: Im Dropdown „Verfahren" sind vier Optionen sichtbar in
   dieser Reihenfolge: Offline-Vorberechnung, Phasen-Vocoder (vorgewählt),
   Sinusoidal Modeling, Bandweise Pitch-Shift.

### B) Sinusoidal Modeling läuft überhaupt
3. Wiedergabe starten, Warp aktivieren, Methode auf „Sinusoidal Modeling"
   stellen.
4. **Erwartet**: hörbare Klang-Veränderung. Keine Stutter, keine Endlos-
   schleife. Konsole sollte keine Fehler werfen.

### C) Wechsel zwischen Verfahren während Wiedergabe
5. Während laufender Wiedergabe Dropdown auf „Phasen-Vocoder" wechseln.
6. **Erwartet**: kurze Unterbrechung, dann anderer Klang-Charakter
   (Phasen-Vocoder).
7. Zurück auf „Sinusoidal Modeling".
8. **Erwartet**: kurze Unterbrechung, dann der erste Klang wieder.

### D) Stärke wirkt live
9. Bei laufendem Sinusoidal Modeling Stärke-Schieber von 100 % auf 50 %
   ziehen.
10. **Erwartet**: Klang wird sofort dezenter, kein Knack.

### E) cs=0 Test (Konsole)
11. In der Konsole bei laufendem Sinusoidal Modeling:
    ```js
    pCurrentPlayback.workletNode.port.postMessage({
      type: "params",
      points: [
        {varFreq: 100,   csL: 0, csR: 0},
        {varFreq: 10000, csL: 0, csR: 0}
      ],
      strength: 1.0,
      active: true,
      algorithm: "sinmodel"
    });
    ```
12. **Erwartet**: Klang ist sehr nahe am Original. Peaks werden nicht
    verschoben (cs=0), nur durch Sinus-Synthese ersetzt; Residual unverändert.

### F) EQ-Master-Bypass auch für Sinusoidal Modeling
13. EQ-Toggle ausschalten.
14. **Erwartet**: Klang sofort wie Original (Sinusoidal Modeling
    deaktiviert sich mit dem EQ-Master).

### G) Sprach-Verhalten
15. Bei laufendem Sinusoidal Modeling auf „s"-Laute und „t"-Konsonanten
    achten.
16. **Erwartet**: Konsonanten klingen näher am Original als beim Phasen-
    Vocoder (Residual unverschoben). Vokale zeigen die Verschiebung. Das
    ist der gewollte Unterschied.

## Selbstprüfungs-Auftrag an Sonnet — VOR der Fertig-Meldung

Gehe jeden Punkt einzeln durch und melde **erfüllt / nicht erfüllt / unklar**,
jeweils mit Datei- und Zeilenangabe:

- **A.1** Vierte `<option>` im Dropdown `plWarpMethod` mit `value="sinmodel"`
  und `data-t-opt="pwMethodSinModel"`, an dritter Position → Datei:Zeile.
- **A.2** `pwMethodSinModel` in allen vier Sprachblöcken von `i18n.js` →
  Datei:Zeile pro Sprache.
- **A.3** `pwStatusActiveSinModel` in allen vier Sprachblöcken von
  `i18n.js` → Datei:Zeile pro Sprache.
- **A.4** `_pWarpApplyMethodLabels.keys` enthält `pwMethodSinModel` an
  dritter Stelle → Datei:Zeile.
- **A.5** `pWarpUpdUI` setzt Status-Text für sinmodel → Datei:Zeile.
- **B.1** Worklet-Konstruktor hat neuen State: `algorithm`,
  `smPrevPeakCount`, `smPrevPeakFreq`, `smPrevPeakPhase`, `smMaxPeaks` →
  Datei:Zeile.
- **B.2** `port.onmessage` übernimmt `e.data.algorithm` → Datei:Zeile.
- **B.3** `process()` dispatcht auf `_processFrameSinModel` wenn
  `this.algorithm === "sinmodel"` → Datei:Zeile.
- **B.4** Methode `_processFrameSinModel` ist vollständig mit allen acht
  Schritten (Frame-Extract, FFT, Magnituden/Phasen, Peak-Detection,
  Residual-Setup, Quadratic Interp + Tracking + Synthese, prev-Update,
  Hermite + IFFT + OLA) → Datei:Zeile.
- **B.5** prev-Buffer werden am Ende von `_processFrameSinModel`
  aktualisiert (Frequenzen + Phasen + Count) → Datei:Zeile.
- **C.1** `pBuildVocoderGraph` sendet `algorithm`-Feld im postMessage
  basierend auf DOM-Zustand → Datei:Zeile.
- **C.2** `pWarpLiveUpdate` sendet `algorithm`-Feld im postMessage →
  Datei:Zeile.
- **D.1** `pPlay` erlaubt sinmodel über den Vocoder-Pfad
  (`method === "vocoder" || method === "sinmodel"`) → Datei:Zeile.
- **E.1** `init.js` Dropdown-Change-Handler lädt Worklet vorab auch für
  sinmodel → Datei:Zeile.
- **F.1** `CODESTRUKTUR.md` erweitert um `_processFrameSinModel` und
  sm-State → Zeile.
- **F.2** `SPEC.md` beschreibt Sinusoidal Modeling als Variante D →
  Zeile.

Bei einem „unklar" oder „nicht erfüllt": **NICHT fertig melden**. Stattdessen
beim User mit konkreter Stelle und Frage zurückkommen. Dieser Build ist DSP-
Code — Fehler sind nicht durch Code-Analyse offensichtlich, sondern erst
beim Hören. Sonnet kann das nicht selbst testen — Genauigkeit beim
Implementieren ist entscheidend.

## Was bewußt NICHT in diesem Build steckt

- **Time-Domain Sinusoidal Synthesis**: kein Oszillator-Bank im Zeitbereich,
  sondern alles im STFT/IFFT-Rahmen. Reicht für den Anwendungsfall und
  bleibt im bestehenden Worklet-Design.
- **Pitch-Shift des Residuals**: Konsonanten bleiben absichtlich unver-
  schoben.
- **Adaptives Peak-Tracking mit Geburten/Tod-Hysterese**: einfaches
  Matching mit fester Toleranz, sonst neuer Oszillator.
- **GC-Optimierung der per-Frame Peak-Arrays**: `curFreqArr` /
  `curPhaseArr` werden pro Frame allokiert, ist tolerabel weil
  `peakCount` klein bleibt (typisch < 30 für Sprache).
