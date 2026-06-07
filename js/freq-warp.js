// ============================================================
// FREQ-WARP – Offline-Frequenz-Warping auf Basis von fRes
// ============================================================
// Geladen zwischen player.js (#14) und lr-balance.js (#15).
// Exportiert ins globale Scope:
//   buildWarpPoints(fResData, warpMode) → points[]
//   centShift(f, side, points) → number
//   pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) → Promise<AudioBuffer>
//   pWarpedBuf, pWarpMode, pWarpOn, pWarpStrength, pWarpBusy  (State)
//   pWarpTrigger()   – UI → Vorberechnung auslösen
//   pWarpUpdUI()     – Status-Anzeige aktualisieren

let pWarpedBuf = null;
let pWarpedBufNHSim = null;
let pWarpOn = false;
let pWarpSettingsOpen = false;
let pWarpMode = "right";        // "left" | "right" | "symmetric" — Default synchron mit HTML
let pWarpStrength = 100;        // 0–150
let pWarpBusy = false;
let pWarpCancel = false;     // wird vom Stop-Button gesetzt, von _rbProcessMonoSide gelesen
let pWarpProgress = 0;        // 0..1, nur bei Rubberband gefüttert
let pWarpAffected = { warpsLeft: false, warpsRight: false };

// BA 191: Rubberband-Optionen. Wird per UI gesetzt, in localStorage
// und JSON-Save persistiert. `realtime` ist Platzhalter fuer den
// spaeter geplanten Live-Modus (BA folgt) und bleibt hier immer false.
let pRubberbandOptions = {
  engine:   "r3",        // "r3" | "r2"
  material: "standard",  // "standard" | "speech" | "percussive"
  formant:  true,        // FormantPreserved an
  fast:     false,       // R3: PitchHighSpeed; R2: WindowShort
};

// Liefert die Rubberband-Bit-Maske aus dem Options-Objekt.
// Aufrufer aus dieser BA setzt realtime=false (Default). Die spaetere
// Live-BA ruft mit realtime=true auf — alle anderen Bits bleiben
// kombinierbar.
function _rbBuildOptionBits(opts) {
  const realtime = !!opts.realtime;
  const engine   = opts.engine === "r2" ? "r2" : "r3";
  const material = (opts.material === "speech" || opts.material === "percussive")
    ? opts.material : "standard";
  const formant  = opts.formant !== false; // Default an
  const fast     = !!opts.fast;

  let bits = 0;

  // Process-Mode: Offline (0x0) oder RealTime (0x1).
  bits |= realtime ? 0x00000001 : 0x00000000;

  // Engine: EngineFaster (R2, 0x0) oder EngineFiner (R3).
  bits |= (engine === "r3") ? 0x20000000 : 0x00000000;

  // Stretch: offline = Precise (0x10), live = Elastic (0x0).
  bits |= realtime ? 0x00000000 : 0x00000010;

  // Threading: Never (Pipeline ruft pro Band auf, kein internes Threading).
  bits |= 0x00010000;

  // Formant: Preserved (0x01000000) oder Shifted (0x0).
  bits |= formant ? 0x01000000 : 0x00000000;

  if (engine === "r3") {
    // PitchHighQuality (0x02000000) oder PitchHighSpeed (0x0).
    bits |= fast ? 0x00000000 : 0x02000000;
    // Material wirkt in R3 nur ueber die Fenstergroesse.
    if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    } else if (material === "percussive") {
      bits |= 0x00100000; // WindowShort
    }
    // Standard => WindowStandard (0x0).
  } else {
    // R2: Detector + Transients aus Material.
    if (material === "speech") {
      bits |= 0x00000800; // DetectorSoft
      bits |= 0x00000200; // TransientsSmooth
    } else if (material === "percussive") {
      bits |= 0x00000400; // DetectorPercussive
      // TransientsCrisp ist Default (0x0).
    }
    // Window: Schnell hat Vorrang vor Material-Window-Wahl.
    if (fast) {
      bits |= 0x00100000; // WindowShort
    } else if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    }
  }

  return bits;
}
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

// ---- Variante E: Rubberband-WASM Offline-Vorberechnung -----
//
// Bandweise echter Pitch-Shift via Rubberband-WASM. FIR-Bandpaesse
// (linearphasig, Blackman-Harris-Fenster) mit Grenzen am geometrischen
// Mittel der Nachbarmittenfrequenzen, pro Band ein Rubberband-Lauf in
// EngineFiner-Qualitaet, danach Summe und Pegelausgleich. Mono-
// Optimierung: pro Lauf nur die effektiv hoerbaren und tatsaechlich
// gewarpten Kanaele verarbeiten (siehe _rbDecideAffectedSides).


const _RB_FIR_ORDER = 4096; // FIR-Ordnung der Bandpaesse (linearphasig)


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
async function _rbPitchShift(rb, signal, sampleRate, cents, optionBits) {
  if (Math.abs(cents) < 0.5) {
    // Vernachlaessigbar — direkt zurueck (defensive Kopie nicht noetig,
    // weil Aufrufer signal nicht weiterverwendet).
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_new(
    sampleRate, 1, optionBits, 1.0, pitchScale
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
    // Alle ~16 Chunks an den Event-Loop yielden + pWarpCancel prüfen, damit
    // der Stop-Button anklickbar bleibt und der Abbruch zeitnah wirkt
    // (sonst blockiert die WASM-Schleife den Main-Thread bei großen Buffern).
    {
      let pos = -startPad;
      let yieldCounter = 0;
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
        if ((++yieldCounter & 15) === 0) {
          if (pWarpCancel) throw new Error("__warp_cancelled__");
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
    }

    // 2) Process-Phase: Eingabe erneut, parallel Output abholen.
    const outChunks = [];
    let outTotal = 0;
    {
      let pos = -startPad;
      let yieldCounter = 0;
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
        if ((++yieldCounter & 15) === 0) {
          if (pWarpCancel) throw new Error("__warp_cancelled__");
          await new Promise(function (r) { setTimeout(r, 0); });
        }
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
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone, optionBits) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bands.length; i++) {
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i], optionBits);
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
    if (typeof onBandDone === "function") onBandDone();
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

  // Schritt-Zähler vorab bestimmen, damit der Prozentwert stimmt.
  const sameAsLAnticipated = decided.needL && decided.needR
    && srcL === srcR
    && csL.length === csR.length
    && csL.every((v, i) => v === csR[i]);
  const totalBands = bands.length * (
    (decided.needL ? 1 : 0)
    + (decided.needR && !sameAsLAnticipated ? 1 : 0)
  );
  let doneBands = 0;
  const onBand = () => {
    if (totalBands > 0) {
      doneBands++;
      pWarpProgress = Math.min(1, doneBands / totalBands);
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    }
  };

  const optionBits = _rbBuildOptionBits({
    engine:   pRubberbandOptions.engine,
    material: pRubberbandOptions.material,
    formant:  pRubberbandOptions.formant,
    fast:     pRubberbandOptions.fast,
    realtime: false,
  });

  if (decided.needL) {
    outL = await _rbProcessMonoSide(rb, srcL, sampleRate, bands, csL, onBand, optionBits);
  }
  if (decided.needR) {
    if (sameAsLAnticipated) {
      outR = outL;
    } else {
      if (pWarpCancel) throw new Error("__warp_cancelled__");
      outR = await _rbProcessMonoSide(rb, srcR, sampleRate, bands, csR, onBand, optionBits);
    }
  }

  // Resultat-Buffer im Live-Context aufbauen.
  const c = gPC();
  const out = c.createBuffer(2, srcBuf.length, sampleRate);
  out.getChannelData(0).set(outL.subarray(0, srcBuf.length));
  out.getChannelData(1).set(outR.subarray(0, srcBuf.length));
  return out;
}

// ---- UI-Aktionen ----------------------------------------

function pWarpUpdUI() {
  const cbEl     = document.getElementById("plWarpOn");
  const statusEl = document.getElementById("plWarpStatus");
  const hintEl   = document.getElementById("plWarpHint");

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
  if (settingsBox) settingsBox.style.display = pWarpSettingsOpen ? "" : "none";
  const warpChevron = document.getElementById("plWarpSettingsToggle");
  if (warpChevron) warpChevron.textContent = pWarpSettingsOpen ? "▼" : "▶";

  const stats = _warpFResStats();
  const noData = stats.total === 0;
  const n = stats.total;

  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    if (pWarpProgress > 0) {
      const pct = Math.round(pWarpProgress * 100);
      statusText = t("pwStatusBusyProgress").replace("{pct}", pct);
    } else if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
      statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
    } else if (typeof rubberbandIsLoaded === "function" && !rubberbandIsLoaded()) {
      // WASM noch nicht geladen — der eigentliche „wird geladen"-Fall.
      statusText = t("pwStatusRubberbandLoading");
    } else {
      // Bereits geladen, Berechnung läuft, aber noch kein Band fertig.
      statusText = t("pwStatusBusy");
    }
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
    statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
  } else {
    statusText = pWarpedBuf
      ? t("pwStatusActiveRubberband").replace("{n}", n)
      : t("pwStatusReady");
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
  if (pWarpBusy && statusText) {
    statusText = "⏳ " + statusText;
  }
  if (statusEl) statusEl.textContent = statusText;

  if (hintEl) {
    if (pWarpOn && noData) {
      hintEl.textContent = t("pwHintNoFRes");
      hintEl.style.display = "";
    } else {
      hintEl.style.display = "none";
    }
  }

  const playBtn = document.getElementById("plPlay");
  const playLocked = pWarpBusy;
  if (playBtn) {
    playBtn.disabled = playLocked;
    playBtn.style.pointerEvents = playLocked ? "none" : "";
  }

  const busyIcon = document.getElementById("plPlayBusyIcon");
  if (busyIcon) busyIcon.style.display = playLocked ? "" : "none";

  const busyTip = document.getElementById("plPlayBusyTip");
  if (busyTip) {
    let tipText = t("plWarpBusyTooltip");
    if (pWarpProgress > 0) {
      tipText += " " + Math.round(pWarpProgress * 100) + " %";
    }
    busyTip.textContent = tipText;
    if (!playLocked) busyTip.style.display = "none";
  }

  const stopBtn = document.getElementById("plWarpStopBtn");
  if (stopBtn) {
    stopBtn.style.display = pWarpBusy ? "" : "none";
  }

  // Fortschrittsbalken im Transport-Bereich
  const progressRow = document.getElementById("plWarpProgressRow");
  const progressBar = document.getElementById("plWarpProgressBar");
  const progressPct = document.getElementById("plWarpProgressPct");
  if (progressRow) {
    if (pWarpBusy && pWarpProgress > 0) {
      progressRow.style.display = "flex";
      const pct = Math.round(pWarpProgress * 100);
      if (progressBar) progressBar.style.width = pct + "%";
      if (progressPct) progressPct.textContent = pct + " %";
    } else {
      progressRow.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      if (progressPct) progressPct.textContent = "";
    }
  }
}

let pWarpGen = 0;  // Generation-Zähler — neuer Aufruf überholt ältere Runs.

async function pWarpTrigger() {
  const myGen = ++pWarpGen;
  pWarpedBuf = null;

  if (!pWarpOn) { pWarpUpdUI(); return; }
  if (_warpFResSource().length === 0) { pWarpUpdUI(); return; }
  if (!pSourceBuf) { pWarpUpdUI(); return; }

  // Falls eine vorherige Berechnung noch läuft (anderer Buffer): abbrechen
  // und auf deren Beendigung warten. Damit laufen zwei
  // pComputeRubberbandWarpedBuffer-Aufrufe nicht parallel, und der
  // überholte Run räumt sich selbst still auf (siehe myGen-Check unten —
  // kein UI-Toggle, pWarpOn bleibt unverändert, da es kein User-Cancel war).
  if (pWarpBusy) {
    pWarpCancel = true;
    while (pWarpBusy) {
      await new Promise(function (r) { setTimeout(r, 20); });
      if (myGen !== pWarpGen) return;
    }
  }

  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpCancel = false;
  pWarpProgress = 0;
  pWarpUpdUI();

  let cancelled = false;
  try {
    pWarpedBuf = await pComputeRubberbandWarpedBuffer(
      pSourceBuf, pWarpMode, pWarpStrength
    );
  } catch (err) {
    if (err && err.message === "__warp_cancelled__") {
      cancelled = true;
      pWarpedBuf = null;
    } else {
      console.error("Warp-Fehler:", err);
      pWarpedBuf = null;
      if (typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
        rubberbandLastError = err && err.message ? err.message : String(err);
      }
    }
  }

  // pWarpBusy zurücksetzen, damit ein wartender Trigger weiterlaufen kann.
  pWarpBusy = false;
  pWarpProgress = 0;

  // Überholt von neuerem Trigger: still aufräumen, kein UI-Toggle, kein pPlay,
  // pWarpOn bleibt unverändert (Cancel war kein User-Wille).
  if (myGen !== pWarpGen) return;

  pWarpCancel = false;

  if (cancelled) {
    // Interner Cancel (neuer Trigger) wird nie hierher kommen —
    // myGen !== pWarpGen hat schon returniert.
    // Hier ist es also immer ein User-Cancel: pWarpOn ist bereits false
    // (vom Click-Handler gesetzt). Nur DOM-Sync noetig.
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();  // ungewarpt weiterspielen
    return;
  }

  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying && pWarpOn) pPlay();
}

function pWarpCancelCompute() {
  if (!pWarpBusy) return;
  pWarpCancel = true;
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

// --- Tooltip auf gesperrtem Play-Button -------------------------
// Hover / Klick / Tap auf den gesperrten Play-Button zeigt
// "Frequenz-Warping wird noch berechnet …". Der Wrapper
// (#plPlayWrap) fängt die Events, weil disabled-Buttons selbst
// keine Maus-Events feuern; pWarpUpdUI setzt pointer-events:none
// auf dem Button, damit Klicks auf den Wrapper durchfallen.
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("plPlayWrap");
  const tip = document.getElementById("plPlayBusyTip");
  const btn = document.getElementById("plPlay");
  if (!wrap || !tip || !btn) return;

  const show = () => {
    if (!btn.disabled) return;
    tip.style.display = "";
  };
  const hide = () => { tip.style.display = "none"; };

  wrap.addEventListener("mouseenter", show);
  wrap.addEventListener("mouseleave", hide);
  wrap.addEventListener("click", show);
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
});
