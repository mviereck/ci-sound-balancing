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

let pWarpedBuf = null;
let pWarpOn = false;
let pWarpMode = "ref_side";   // "ref_side" | "var_side" | "symmetric"
let pWarpStrength = 100;      // 0–150
let pWarpBusy = false;
let _pWarpFResVersion = 0;    // erhöht sich bei jeder Berechnung

// ---- Warp-Kurve aufbauen --------------------------------

function buildWarpPoints(fResData, warpMode) {
  // fResData: Array { varSide, refSide, elIdx, varFreq, refFreq }
  // Gibt sortiertes Array { varFreq, csL, csR } zurück
  const pts = [];
  for (const r of fResData) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    let csL = 0, csR = 0;
    // Vorzeichen-Konvention: positiver cent = refFreq > varFreq
    // Für ref_side: ref bekommt negative Korrektur (nach unten zum varFreq hin)
    // Für var_side: var bekommt positive Korrektur (nach oben zum refFreq hin)
    // Für symmetric: beide halb
    if (warpMode === "ref_side") {
      // Welche Seite ist die Referenzseite?
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
    pts.push({ varFreq: r.varFreq, csL, csR });
  }
  pts.sort((a, b) => a.varFreq - b.varFreq);
  return pts;
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

  const points = buildWarpPoints(fResData, warpMode);
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

// ---- UI-Aktionen ----------------------------------------

function pWarpUpdUI() {
  const cbEl      = document.getElementById("plWarpOn");
  const statusEl  = document.getElementById("plWarpStatus");
  const hintEl    = document.getElementById("plWarpHint");
  const modeRow   = document.getElementById("plWarpModeRow");
  const strRow    = document.getElementById("plWarpStrRow");
  const recalcBtn = document.getElementById("plWarpRecalc");
  const methodSel = document.getElementById("plWarpMethod");

  if (!cbEl) return;

  // Verfahren-Hinweis: wenn nicht Offline, "nicht verfügbar"
  const method = methodSel ? methodSel.value : "offline";
  const notAvailEl = document.getElementById("plWarpNotAvail");
  if (notAvailEl) {
    notAvailEl.style.display = (method !== "offline") ? "" : "none";
    if (method !== "offline") {
      notAvailEl.textContent = t("pwMethodNotImpl");
    }
  }

  // Nur wenn Offline-Verfahren
  const isOffline = method === "offline";

  // Status
  const noFRes = !fRes || fRes.length === 0;
  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    statusText = t("pwStatusBusy");
  } else if (pWarpedBuf) {
    statusText = t("pwStatusActive").replace("{n}", fRes ? fRes.length : 0);
  } else {
    statusText = t("pwStatusReady");
  }
  if (statusEl) statusEl.textContent = statusText;

  // Hinweis
  if (hintEl) {
    if (pWarpOn && noFRes) {
      hintEl.textContent = t("pwHintNoFRes");
      hintEl.style.display = "";
    } else {
      hintEl.style.display = "none";
    }
  }

  // Recalc-Button: nur wenn Warp aktiv, nicht busy, fRes vorhanden
  if (recalcBtn) {
    recalcBtn.style.display = (pWarpOn && !noFRes) ? "" : "none";
    recalcBtn.disabled = pWarpBusy;
    recalcBtn.textContent = t("pwBtnRecompute");
  }

  // Play-Button sperren während Berechnung
  const playBtn = document.getElementById("plPlay");
  if (playBtn) playBtn.disabled = pWarpBusy;

  // Mode/Strength-Row zeigen wenn Warp an
  if (modeRow) modeRow.style.display = pWarpOn ? "" : "none";
  if (strRow)  strRow.style.display  = pWarpOn ? "" : "none";
}

async function pWarpTrigger() {
  if (!pWarpOn) {
    pWarpedBuf = null;
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
  // Verfahren prüfen
  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "offline";
  if (method !== "offline") {
    pWarpUpdUI();
    return;
  }

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
  // pBuf muss neu gesetzt werden (getPlaybackBuffer beachtet pWarpedBuf)
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying) pPlay();
}
