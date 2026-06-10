# BAUANLEITUNG 186 — Rubberband-Compute-Funktion (FIR + Mono + Pitch-Shift)

## Zweck und Scope

Dritte von drei Bauanleitungen für das Rubberband-Frequenzwarping.
Diese Anleitung ersetzt die Stub-Funktion `pComputeRubberbandWarpedBuffer`
aus BA 185 durch die **eigentliche Implementierung**:

- bandweise FIR-Bandpässe (linearphasig, Blackman-Harris-Fenster,
  Ordnung 4096) auf geometrischen Bandgrenzen
- pro Band Rubberband-WASM-Pitch-Shift in EngineFiner-Qualität
- Mono-Optimierung: nur die effektiv hörbaren und tatsächlich
  gewarpten Kanäle werden verarbeitet (50 % Rechenaufwand bei
  einseitiger Wiedergabe)
- Pegelausgleich nach Summe der Bänder

Die UI ist bereits in BA 185 vollständig eingebunden. Nach dieser BA
liefert die Wiedergabe mit Verfahren „Rubberband" klanglich neuen
Output, statt die Fehlermeldung aus dem Stub zu zeigen.

### Voraussetzungen

- BA 184 gebaut: Vendor-Files und Loader funktionieren.
- BA 185 gebaut: UI-Integration komplett, Stub-Funktion existiert.

### Vorabprüfung durch Sonnet

Prüfe per `grep -n 'APP_VERSION' js/version.js`, ob die Datei
`"3.2.185-beta"` enthält. Wenn nicht: rückfragen.

Prüfe per
`grep -n 'pComputeRubberbandWarpedBuffer\|Implementierung folgt in BA 186' js/freq-warp.js`,
ob die Stub-Funktion mit dem erwarteten Throw-Text existiert. Wenn
nicht: rückfragen.

---

## Schritt 1 — `js/freq-warp.js`: Stub ersetzen, Helper einfügen

Hauptarbeit dieser Bauanleitung. Wir ersetzen die siebenzeilige Stub-
Funktion durch die volle Implementierung plus sieben Helper-Funktionen.

### Vorher

```javascript
// ---- Variante E: Rubberband-WASM Offline-Vorberechnung -----
// Stub — Implementierung folgt in BA 186.
async function pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) {
  throw new Error("Implementierung folgt in BA 186");
}
```

### Nachher

```javascript
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
```

**Konkret:**

- Den gesamten Stub-Block (Kommentar `// ---- Variante E: ...` + Kommentar
  `// Stub — Implementierung folgt in BA 186.` + die Stub-Funktion mit
  `throw`) durch den oben gezeigten Block ersetzen.
- Die neuen Helper sind in dieser Reihenfolge definiert:
  Konstanten → `_rbDecideAffectedSides` → `_rbBuildBandEdges` →
  `_rbDesignBandpassFIR` → `_rbConvolveViaWebAudio` → `_rbPitchShift` →
  `_rbProcessMonoSide` → `pComputeRubberbandWarpedBuffer`.

### Edge-Case: Mono-Quelldatei

Wenn `srcBuf.numberOfChannels === 1`, dann ist `srcR` per Logik
identisch mit `srcL` (selbe Referenz). Die `sameAsL`-Optimierung in
`pComputeRubberbandWarpedBuffer` greift dann automatisch — wenn beide
Seiten dieselben cs-Werte bekommen (`warpMode === "symmetric"`), läuft
Rubberband nur einmal.

### Edge-Case: Sehr kleine Cent-Werte

`_rbPitchShift` springt bei `|cents| < 0.5` direkt zurück (kein
Rubberband-Lauf für vernachlässigbare Shifts). Bei einer Elektrode mit
gemessenem Cent-Wert nahe 0 spart das einen unnötigen Lauf.

### Edge-Case: Fehlende fRes-Daten

Wird bereits in `pWarpTrigger` (BA 185, Z. 1143-1145) per
`if (_warpFResSource().length === 0)`-Check abgefangen. Die Compute-
Funktion wird in diesem Fall gar nicht erst aufgerufen.

---

## Schritt 2 — `docs/spec/06-player.md` Verfahrens-Bullet ergänzen

In BA 185 wurde nur der Default-Wechsel und der Recalc-Halbsatz
gepflegt. Jetzt kommt der ausführliche Verfahrens-Bullet rein.

### Vorher (sinngemäße Stelle, Z. 118)

```markdown
- Frequenz-Warping mit vier Verfahren (freq-warp.js):
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play
  - **Bandweise Pitch-Shift** (Variante B): Live-Audio-Graph, N Subbänder
    × 2 Kanäle; wirkt sofort beim nächsten Play, keine Vorberechnung
```

### Nachher

```markdown
- Frequenz-Warping mit fünf Verfahren (freq-warp.js):
  - **Rubberband (Variante E, Default):** bandweise Vorberechnung über
    Rubberband-WASM mit FIR-Bandpässen auf geometrischen Bandgrenzen,
    echter zeitkonsistenter Pitch-Shift pro Band (kein `playbackRate`-
    Trick), Mono-Optimierung (nur effektiv hörbare und tatsächlich
    gewarpte Kanäle werden verarbeitet). Optionen-Set hartcodiert auf
    `EngineFiner | PitchHighQuality | FormantPreserved | StretchPrecise
    | WindowStandard | ThreadingNever | ChannelsApart`. Lazy WASM-Load
    via `js/rubberband-loader.js` (Vendor in
    `vendors/rubberband-wasm/dist/`).
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play
  - **Bandweise Pitch-Shift** (Variante B): Live-Audio-Graph, N Subbänder
    × 2 Kanäle; wirkt sofort beim nächsten Play, keine Vorberechnung
```

**Konkret:**

- „vier Verfahren" → „fünf Verfahren".
- Den Rubberband-Bullet **vor** dem Offline-Bullet einfügen, exakt im
  Stil der bestehenden Bullets.

### Zusätzlich: Live-Update-Block (ca. Z. 199-203)

### Vorher

```markdown
  - Live-Änderung von Stärke und Korrektur-Modus während Wiedergabe:
    - Offline → Neuberechnung via `pWarpTrigger` (längere Pause)
    - Vocoder → knackfreier `postMessage` an den laufenden Worklet
      (`pWarpLiveUpdate`), sofort wirksam
    - Bandshift → Graph-Rebuild via pause/resume (kurzer hörbarer Knack)
```

### Nachher

```markdown
  - Live-Änderung von Stärke und Korrektur-Modus während Wiedergabe:
    - Rubberband → Neuberechnung via `pWarpTrigger` (längere Pause; beim
      ersten Lauf zusätzlich WASM-Lade-Zeit)
    - Offline → Neuberechnung via `pWarpTrigger` (kürzere Pause)
    - Vocoder → knackfreier `postMessage` an den laufenden Worklet
      (`pWarpLiveUpdate`), sofort wirksam
    - Bandshift → Graph-Rebuild via pause/resume (kurzer hörbarer Knack)
```

---

## Schritt 3 — `docs/CODESTRUKTUR.md` erweitern

Im Eintrag für `freq-warp.js` (Z. 160) am Ende einen Zusatz für BA 186
ergänzen:

> **Seit BA 186:** Neues Verfahren `rubberband` (Variante E, neuer
> Default seit BA 185). Funktionen `pComputeRubberbandWarpedBuffer`,
> `_rbDecideAffectedSides`, `_rbBuildBandEdges`, `_rbDesignBandpassFIR`,
> `_rbConvolveViaWebAudio`, `_rbPitchShift`, `_rbProcessMonoSide`.
> Konstanten `_RB_FIR_ORDER` (FIR-Ordnung 4096) und
> `_RB_OPTIONS_OFFLINE_HIGHQ` (Rubberband-Options-Bitmaske). Lädt WASM
> lazy via `rubberbandLoad()` aus `js/rubberband-loader.js`.

---

## Schritt 4 — `js/version.js` Versions-Bump

### Vorher

```javascript
const APP_VERSION = "3.2.185-beta";
```

### Nachher

```javascript
const APP_VERSION = "3.2.186-beta";
```

---

## Akzeptanztest

### A — Smoke-Test

1. Tool über lokalen Server öffnen, Browser-Konsole aufmachen.
2. Erwartet: keine roten JS-Fehler, Versions-Tag `3.2.186-beta`.

### B — Rubberband klanglich wirksam

1. Frequenzabgleich-Daten vorhanden (mindestens 3 Stützpunkte, einer
   davon mit deutlichem Cent-Wert, z.B. -300 oder +300).
2. Audio-Datei laden (z.B. ein WAV/MP3 mit klar erkennbarer Tonhöhe —
   Sprache oder Musik mit Gesangsstimme).
3. Frequenz-Warping aktiv, Verfahren „Rubberband", Stärke 100 %,
   Korrektur-Modus „Rechte Seite".
4. Play.
5. Erwartet:
   - Beim ersten Play kurze bis mittlere Pause (Status zeigt
     „Rubberband wird geladen …", Play-Button gesperrt). Länge abhängig
     von Audio-Dauer × Anzahl Stützpunkte × CPU.
   - Danach hörbare Wiedergabe mit Frequenz-Verschiebung auf der
     rechten Seite.
   - Status zeigt: „Aktiv — Rubberband (N Stützpunkte)".
   - **Keine** Fehlermeldung.

### C — Vergleich mit anderen Verfahren

1. Beim laufenden Stück das Verfahren auf „Sinusoidal Modeling"
   wechseln, Play. Erwartet: deutlich anderer Klang (Vergleichsbasis).
2. Zurück auf Rubberband, Play.
3. Erwartet: Rubberband-Wiedergabe klingt **weniger artifakt-belastet**
   als Sinusoidal Modeling und Bandshift — saubere Frequenz-Verschiebung
   pro Band, weniger Modulations- und Phasing-Artefakte. (Subjektiv —
   Nutzer beurteilt.)

### D — Mono-Optimierung Test

1. Korrektur-Modus „Rechte Seite", Checkbox „Beide Seiten" **aus**
   (Player spielt nur linke Seite — Modus `getPlayerSide()` = `"left"`).
2. Play.
3. Erwartet: **schnelle Vorberechnung** (signifikant kürzer als in
   Test B), weil die linke Seite nicht gewarpt wird — Rubberband läuft
   nur über die rechte Seite, aber die wird gar nicht hörbar.
4. Klanglich: linke Seite hörbar (Original), rechte Seite stumm — also
   wie ohne Warp. Das ist korrekt: der Warp-Effekt ist auf der nicht-
   hörbaren Seite, also keine hörbare Veränderung.
5. Checkbox „Beide Seiten" **an**, Korrektur-Modus „Rechte Seite", Play.
6. Erwartet: linke Seite Original, rechte Seite Warp hörbar. Vorberechnung
   ähnlich schnell wie Test 1 (nur eine Seite gewarpt).
7. Korrektur-Modus „Beide Seiten symmetrisch", Play.
8. Erwartet: beide Seiten gewarpt. Vorberechnung dauert länger (zwei
   Rubberband-Läufe statt einem).

### E — Stub-Fehler ist weg

1. Verfahren „Rubberband", Play.
2. Erwartet: **keine** Fehlermeldung „Implementierung folgt in BA 186"
   mehr. Wenn doch: BA 186 ist nicht korrekt gebaut.

### F — Verfahren-Wechsel während Wiedergabe

1. Verfahren „Rubberband", Play läuft.
2. Verfahren auf „Sinusoidal Modeling" wechseln.
3. Erwartet: kurze Pause, Wiedergabe geht weiter mit neuem Verfahren
   (das alte Pause-Resume-Verhalten — die strenge „Pause-ohne-Resume"-
   Regel kommt erst in BA 187).
4. Zurück auf „Rubberband".
5. Erwartet: kurze Pause für Neuberechnung, dann Wiedergabe.

### G — Save/Load

1. Tool-Save in JSON.
2. Tool neu laden.
3. Verfahren bleibt „Rubberband", Stärke und Modus bleiben gleich.
4. Play. Erwartet: läuft wie vor dem Save.

---

## Selbstprüfungs-Auftrag an Sonnet

**Bevor du fertig meldest**, prüfe einzeln:

1. `js/freq-warp.js`: der Stub-Block (Kommentar „Stub — Implementierung
   folgt in BA 186." + Funktion mit `throw new Error("Implementierung
   folgt in BA 186")`) ist **nicht mehr vorhanden**. Statt dessen
   stehen die Konstanten `_RB_FIR_ORDER` und `_RB_OPTIONS_OFFLINE_HIGHQ`
   sowie alle Helper-Funktionen (`_rbDecideAffectedSides`,
   `_rbBuildBandEdges`, `_rbDesignBandpassFIR`, `_rbConvolveViaWebAudio`,
   `_rbPitchShift`, `_rbProcessMonoSide`) und die volle
   `pComputeRubberbandWarpedBuffer` da.
2. `grep -n 'Implementierung folgt in BA 186' js/freq-warp.js` → 0
   Treffer.
3. `grep -n '_rbPitchShift\|_rbProcessMonoSide' js/freq-warp.js` → je
   mindestens 2 Treffer (Definition und Aufruf).
4. `docs/spec/06-player.md`: „fünf Verfahren", Rubberband-Bullet vor dem
   Offline-Bullet eingefügt. Live-Update-Block enthält den Rubberband-
   Eintrag.
5. `docs/CODESTRUKTUR.md`: `freq-warp.js`-Eintrag enthält den BA-186-
   Zusatz mit Funktions-Aufzählung.
6. `js/version.js`: `APP_VERSION = "3.2.186-beta"`.
7. Keine anderen Dateien angefasst (außer `version.js`, `freq-warp.js`,
   `06-player.md`, `CODESTRUKTUR.md`).
8. ASCII-Quotes in allen JS-Snippets. Keine typographischen „".

**Konkrete Run-Time-Prüfung (in der Konsole, vor Fertig-Meldung):**

- Tool über lokalen Server starten.
- `typeof pComputeRubberbandWarpedBuffer` → `"function"`.
- `typeof _rbBuildBandEdges` → `"function"`.
- Bei vorhandenen fRes-Daten und geladener Audio-Datei: Play mit
  Verfahren „Rubberband" → Status zeigt nicht mehr „Implementierung
  folgt".

Bei „unklar" rückfragen.

### Häufige Fallen

- **WASM-Heap-Aliasing.** `rb.memReadF32(outBufPtr, take)` liefert ein
  Float32Array, das ein **View** auf den WASM-Heap ist. Wenn der nächste
  Rubberband-Aufruf den Heap überschreibt, ändert sich auch das vorher
  zurückgegebene Array. Deshalb in `_rbPitchShift` immer eine **Kopie**
  (`new Float32Array(take); copy.set(chunk);`) machen, bevor das
  Ergebnis in `outChunks` gepusht wird. Wenn du eine andere Optimierung
  versuchst (z.B. direkt in einen großen Output-Buffer schreiben): die
  Kopier-Stelle bleibt nötig.
- **Start-Delay vs. Start-Pad.** Beide sind unterschiedliche Konzepte
  in Rubberband. `start_pad` ist die Anzahl Samples, die du als Stille
  **vorne** in study/process einfütterst (Warm-Up). `start_delay` ist
  die Anzahl Samples, um die der erste hörbare Sample im **Output**
  verzögert ist (also was du am Anfang abschneidest). Beide Werte sind
  pro Rubberband-Instanz unterschiedlich. In `_rbPitchShift` werden sie
  beide korrekt verwendet — beim Edit darauf achten, sie nicht zu
  verwechseln.
- **Falscher Konstanten-Wert für ThreadingNever.** In
  `vendors/rubberband-wasm/src/index.ts` steht `ThreadingNever = 0x00010000`.
  Im Snippet oben ist es korrekt; falls du es manuell tippst statt
  Copy-Paste, prüfen.

---

## Nach Abschluß manuell prüfen

- Wiedergabe mit Rubberband-Verfahren klingt deutlich anders als ohne
  Warp; im Vergleich zu Sinusoidal Modeling weniger artifakt-belastet.
- Bei einseitiger Wiedergabe + einseitigem Warp-Korrektur-Modus auf der
  nicht-hörbaren Seite: Vorberechnung ist schnell, Klang ist
  unverändert (Bypass).
- Save/Load funktioniert: Verfahren und Parameter überleben Reload.

Die nachfolgenden Bauanleitungen (BA 187: Pause-ohne-Resume + fRes-
Sperre; BA 188: nahtloser A/B-Vergleich) bauen auf diesem Stand auf.
