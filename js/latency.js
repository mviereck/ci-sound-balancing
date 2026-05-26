// ====================================================================
// latency.js — Latenz-Messung (Inter-Ohr-Zeitversatz)
// --------------------------------------------------------------------
// Exportierte Globals:
//   latencyResult           {valueMs, clickType, intervalMs} | null
//   plApplyLatency          bool — im Player anwenden?
//   latSliderMs             aktuell vom UI gesetzter Wert (Live-Test)
//   latActive               Test läuft gerade?
//   latClickType            "click" | "burst500" | "burst1500" | "burst4000"
//   latIntervalMs           Klick-Intervall in ms (manuell wählbar)
//
//   pLatSplitter, pLatDelayL, pLatDelayR, pLatMerger
//                           — Audio-Nodes, werden in player.js
//                             eingehängt (siehe Schritt 3 unten)
//
// Exportierte Funktionen:
//   latBuildClickBuffer(ctx)
//   latBuildBurstBuffer(ctx, freqHz, durMs)
//   latBuildLoopedTestBuffer(ctx, clickType, intervalMs)
//   latStartTest()
//   latStopTest()
//   latSetSliderMs(ms)
//   latApplyToPlayer()
//   latInitGraph(ctx)
// ====================================================================

let latencyResult = null;      // {valueMs, clickType, intervalMs}
let plApplyLatency = true;     // analog plApplyBalance

let latSliderMs = 0;           // aktueller Schieber-Wert (Test-Live)
let latActive = false;
let latClickType = "click";
let latIntervalMs = 1000;

let latTestSource = null;      // BufferSource für Test-Klicks
let latTestBuf = null;         // aktuell verwendeter Loop-Buffer
let latBalSplitter = null;
let latBalGainL    = null;
let latBalGainR    = null;
let latBalMerger   = null;

let pLatSplitter = null;
let pLatDelayL = null;
let pLatDelayR = null;
let pLatMerger = null;

// --- Buffer-Generatoren ----------------------------------------------

// 1-ms-Klick, breitbandig, Hann-gefenstert um Knack-Artefakte zu
// vermeiden. Stereo (L=R), damit er gleichmäßig durch die Delays
// geht.
function latBuildClickBuffer(ctx) {
  const sr = ctx.sampleRate;
  const samples = Math.max(2, Math.round(sr * 0.001));  // 1 ms
  const buf = ctx.createBuffer(2, samples, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < samples; i++) {
    // Hann-Fenster auf weißes Rauschen
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples - 1)));
    const v = (Math.random() * 2 - 1) * w;
    L[i] = v;
    R[i] = v;
  }
  return buf;
}

// Tone-Burst mit Hann-Fenster, n Perioden, mindestens 3.
function latBuildBurstBuffer(ctx, freqHz, durMs) {
  const sr = ctx.sampleRate;
  const samples = Math.max(8, Math.round(sr * durMs / 1000));
  const buf = ctx.createBuffer(2, samples, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const omega = 2 * Math.PI * freqHz / sr;
  for (let i = 0; i < samples; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples - 1)));
    const v = Math.sin(omega * i) * w * 0.9;
    L[i] = v;
    R[i] = v;
  }
  return buf;
}

// Komplettes Loop-Buffer: ein Klick pro Intervall, fertig zum Schleifen.
function latBuildLoopedTestBuffer(ctx, clickType, intervalMs) {
  const sr = ctx.sampleRate;

  let click;
  switch (clickType) {
    case "burst500":  click = latBuildBurstBuffer(ctx, 500,  6); break;
    case "burst1500": click = latBuildBurstBuffer(ctx, 1500, 4); break;
    case "burst4000": click = latBuildBurstBuffer(ctx, 4000, 3); break;
    case "click":
    default:          click = latBuildClickBuffer(ctx);
  }
  const cL = click.getChannelData(0);
  const cN = click.length;

  const intSamp = Math.max(cN + 1, Math.round(sr * intervalMs / 1000));
  const out = ctx.createBuffer(2, intSamp, sr);
  const oL = out.getChannelData(0);
  const oR = out.getChannelData(1);
  for (let i = 0; i < cN && i < intSamp; i++) {
    oL[i] = cL[i];
    oR[i] = cL[i];
  }
  return out;
}

// --- Audio-Graph einrichten ------------------------------------------

// Wird einmalig aus player.js aufgerufen, sobald pGain existiert.
// Hängt die Latenz-Delays zwischen pGain und c.destination ein.
function latInitGraph(ctx) {
  if (pLatSplitter) return; // schon initialisiert

  pLatSplitter = ctx.createChannelSplitter(2);
  pLatMerger   = ctx.createChannelMerger(2);
  pLatDelayL   = ctx.createDelay(0.25); // 250 ms Puffer für ±200 ms Schieberbereich
  pLatDelayR   = ctx.createDelay(0.25);
  pLatDelayL.delayTime.value = 0;
  pLatDelayR.delayTime.value = 0;

  pLatSplitter.connect(pLatDelayL, 0);
  pLatSplitter.connect(pLatDelayR, 1);
  pLatDelayL.connect(pLatMerger, 0, 0);
  pLatDelayR.connect(pLatMerger, 0, 1);
  pLatMerger.connect(ctx.destination);

  // Wenn schon ein Wert gemessen wurde, anwenden.
  latApplyToPlayer();
}

// --- Test-Klicks Start/Stop ------------------------------------------

function latStartTest() {
  if (latActive) latStopTest();
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) return;
  if (!pLatSplitter) latInitGraph(ctx);
  // Falls Musik/Sätze laufen: stoppen, damit der Test nicht überlagert
  if (typeof pPlaying !== "undefined" && pPlaying && typeof pPause === "function") {
    pPause();
  }
  if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") {
    sStop();
  }
  latTestBuf = latBuildLoopedTestBuffer(ctx, latClickType, latIntervalMs);
  latTestSource = ctx.createBufferSource();
  latTestSource.buffer = latTestBuf;
  latTestSource.loop = true;

  // Stereo-Balance-Gains (vor pGain). Splitter + L/R-Gains + Merger
  // entstehen pro Test und werden beim Stop wieder verworfen.
  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  latBalSplitter = ctx.createChannelSplitter(2);
  latBalMerger   = ctx.createChannelMerger(2);
  latBalGainL    = ctx.createGain();
  latBalGainR    = ctx.createGain();
  latBalGainL.gain.value = dB2G(balG.left);
  latBalGainR.gain.value = dB2G(balG.right);
  latTestSource.connect(latBalSplitter);
  latBalSplitter.connect(latBalGainL, 0);
  latBalSplitter.connect(latBalGainR, 1);
  latBalGainL.connect(latBalMerger, 0, 0);
  latBalGainR.connect(latBalMerger, 0, 1);

  if (typeof pGain !== "undefined" && pGain) {
    latBalMerger.connect(pGain);
  } else if (pLatSplitter) {
    latBalMerger.connect(pLatSplitter);
  } else {
    latBalMerger.connect(ctx.destination);
  }
  latTestSource.start();
  latActive = true;
}

function latStopTest() {
  if (latTestSource) {
    try { latTestSource.stop(); } catch (e) {}
    try { latTestSource.disconnect(); } catch (e) {}
    latTestSource = null;
  }
  if (latBalSplitter) { try { latBalSplitter.disconnect(); } catch (e) {} latBalSplitter = null; }
  if (latBalGainL)    { try { latBalGainL.disconnect();    } catch (e) {} latBalGainL = null; }
  if (latBalGainR)    { try { latBalGainR.disconnect();    } catch (e) {} latBalGainR = null; }
  if (latBalMerger)   { try { latBalMerger.disconnect();   } catch (e) {} latBalMerger = null; }
  latTestBuf = null;
  latActive = false;
}

// Wird bei laufendem Test aufgerufen, wenn der User Klick-Typ,
// Intervall oder Abwechseln-Modus ändert. Buffer neu bauen und
// Wiedergabe neu starten.
function latRestartIfActive() {
  if (latActive) {
    latStopTest();
    latStartTest();
  }
}

// --- Live-Slider-Wert in Delays ---------------------------------------

function latSetSliderMs(ms) {
  latSliderMs = ms;
  if (!pLatDelayL || !pLatDelayR) return;
  const sec = Math.abs(ms) / 1000;
  if (ms >= 0) {
    pLatDelayL.delayTime.value = sec;
    pLatDelayR.delayTime.value = 0;
  } else {
    pLatDelayL.delayTime.value = 0;
    pLatDelayR.delayTime.value = sec;
  }
}

// --- Anwendung auf Player (kein Test aktiv) --------------------------

// Setzt die Delays auf den gespeicherten latencyResult-Wert, falls
// plApplyLatency aktiv ist. Wird vom Test-Start/Stop und vom
// plApplyLatency-Toggle aufgerufen.
function latApplyToPlayer() {
  if (latActive) return; // während Test übernimmt latSetSliderMs
  if (!pLatDelayL || !pLatDelayR) return;
  if (plApplyLatency && latencyResult && isFinite(latencyResult.valueMs)) {
    latSetSliderMs(latencyResult.valueMs);
  } else {
    pLatDelayL.delayTime.value = 0;
    pLatDelayR.delayTime.value = 0;
  }
  if (typeof updLatApplyBtn === "function") updLatApplyBtn();
}

// =====================================================================
// UI-Bindings (Bauanleitung 26)
// =====================================================================

let latEls = null;  // wird in DOMContentLoaded befüllt

function latUpdateValueText() {
  if (!latEls || !latEls.valueText) return;
  const v = latSliderMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  let txt;
  if (Math.abs(v) < 0.05) {
    txt = `0,0 ms — ${t("latResNoOffset").replace(".", "")}`;
  } else if (v > 0) {
    txt = `+${a} ms — ${t("latResLeftFaster").replace("{ms}", a)}`;
  } else {
    txt = `−${a} ms — ${t("latResRightFaster").replace("{ms}", a)}`;
  }
  latEls.valueText.textContent = txt;
}

function latUpdateIntervalHint() {
  if (!latEls || !latEls.intervalHint) return;
  const unique = latIntervalMs / 2;
  let s = `${t("latUniqueRange")} ±${unique} ms`;
  if (unique < 200) s += ` ${t("latUniqueRangeAmbig")}`;
  latEls.intervalHint.textContent = s;
}

function latUpdateButtonStates() {
  if (!latEls) return;
  for (const b of latEls.intervalBtns) {
    b.classList.toggle("active", parseInt(b.dataset.ms, 10) === latIntervalMs);
  }
  for (const b of latEls.clickBtns) {
    b.classList.toggle("active", b.dataset.type === latClickType);
  }
  if (latEls.startBtn) latEls.startBtn.disabled = latActive;
  if (latEls.stopBtn)  latEls.stopBtn.disabled  = !latActive;
  if (latEls.slider)   latEls.slider.disabled   = !latActive;
  if (latEls.testBox)  latEls.testBox.hidden     = !latActive;
  if (latEls.lockedHint) latEls.lockedHint.hidden = !latActive;
}

function latSliderInput(newMs) {
  // Wert auf step-Genauigkeit clampen
  let v = parseFloat(newMs);
  if (!isFinite(v)) v = 0;
  if (v < -200) v = -200;
  if (v >  200) v =  200;
  // auf 0.1 runden
  v = Math.round(v * 10) / 10;
  if (latEls && latEls.slider) latEls.slider.value = String(v);
  latSetSliderMs(v);
  latUpdateValueText();
}

function latKeyHandler(ev) {
  if (!latEls) return;
  let step = 1;
  if (ev.shiftKey) step = 0.1;
  if (ev.ctrlKey || ev.metaKey) step = 10;
  let delta = 0;
  if (ev.key === "ArrowLeft"  || ev.key === "ArrowDown") delta = -step;
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp")   delta =  step;
  if (delta === 0) return;
  ev.preventDefault();
  latSliderInput(latSliderMs + delta);
}

function latStartTestUI() {
  const startMs = (latencyResult && isFinite(latencyResult.valueMs))
    ? latencyResult.valueMs : 0;
  latSliderInput(startMs);
  latStartTest();
  latUpdateButtonStates();
  if (typeof updateTabLockState === "function") updateTabLockState();
  if (latEls && latEls.slider) safeFocus(latEls.slider);
}

function latStopTestUI() {
  latStopTest();
  latApplyAsResult();
  latUpdateButtonStates();
  if (typeof updateTabLockState === "function") updateTabLockState();
}

function latApplyAsResult() {
  latencyResult = {
    valueMs: latSliderMs,
    clickType: latClickType,
    intervalMs: latIntervalMs,
    timestamp: Date.now(),
  };
  latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
}

document.addEventListener("DOMContentLoaded", function () {
  latEls = {
    slider:        document.getElementById("latSlider"),
    valueText:     document.getElementById("latValueText"),
    intervalHint:  document.getElementById("latIntervalHint"),
    intervalBtns:  Array.from(document.querySelectorAll(".lat-interval-btn")),
    clickBtns:     Array.from(document.querySelectorAll(".lat-click-btn")),
    startBtn:      document.getElementById("latStartBtn"),
    stopBtn:       document.getElementById("latStopBtn"),
    testBox:       document.getElementById("latTestBox"),
    lockedHint:    document.getElementById("latLockedHint"),
  };
  if (!latEls.slider) return; // HTML noch nicht da

  latEls.slider.addEventListener("input", function (e) {
    latSliderInput(e.target.value);
  });
  buildSliderTouchCtrl(latEls.slider, {
    step: 1,
    fineStep: 0.1
  });
  // Tastatur (Pfeile mit Modifiern). Wir überschreiben das Default-
  // Verhalten von <input type=range>, damit Schrittgrößen exakt
  // 1 / 0,1 / 10 ms sind.
  latEls.slider.addEventListener("keydown", latKeyHandler);

  for (const b of latEls.intervalBtns) {
    b.addEventListener("click", function () {
      latIntervalMs = parseInt(b.dataset.ms, 10);
      latUpdateButtonStates();
      latUpdateIntervalHint();
      latRestartIfActive();
      safeFocus(latEls.slider);
    });
  }
  for (const b of latEls.clickBtns) {
    b.addEventListener("click", function () {
      latClickType = b.dataset.type;
      latUpdateButtonStates();
      latRestartIfActive();
      safeFocus(latEls.slider);
    });
  }
  if (latEls.startBtn) latEls.startBtn.addEventListener("click", latStartTestUI);
  if (latEls.stopBtn)  latEls.stopBtn.addEventListener("click",  latStopTestUI);

  // ENTER beendet den laufenden Latenztest (Äquivalent zum Stop-Button).
  // Nur greifen, wenn der Test wirklich aktiv ist und der Fokus nicht
  // in einem Eingabe-Element liegt (sonst würde ENTER in normalen
  // Formularen abgefangen).
  document.addEventListener("keydown", function (ev) {
    if (!latActive) return;
    if (ev.key !== "Enter") return;
    const tgt = ev.target;
    if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT")) {
      // Ausnahme: der Latenz-Slider ist zwar ein input[type=range], aber
      // ENTER soll dort dennoch stoppen — Range-Inputs erzeugen mit ENTER
      // ohnehin keine sinnvolle Default-Aktion.
      const isLatSlider = (latEls && latEls.slider && tgt === latEls.slider);
      if (!isLatSlider) return;
    }
    ev.preventDefault();
    latStopTestUI();
  });

  // Initial-Update
  latSliderInput(0);
  latUpdateButtonStates();
  latUpdateIntervalHint();

  const latClearBtn = document.getElementById("latClearBtn");
  if (latClearBtn) {
    latClearBtn.addEventListener("click", function() {
      if (!confirm(t("latClearConfirm") || "Latenz-Meßergebnis löschen?")) return;
      latencyResult = null;
      latRenderResults();
    });
  }
});

// =====================================================================
// Ergebnis-Tab (Bauanleitung 27)
// =====================================================================

let latResEls = null;

function latRenderResults() {
  if (!latResEls) {
    latResEls = {
      none:      document.getElementById("latResNone"),
      content:   document.getElementById("latResContent"),
      valueBig:  document.getElementById("latResValueBig"),
      text:      document.getElementById("latResText"),
      context:   document.getElementById("latResContext"),
    };
  }
  if (!latResEls.none || !latResEls.content) return;

  if (!latencyResult || !isFinite(latencyResult.valueMs)) {
    latResEls.none.hidden = false;
    latResEls.content.hidden = true;
    return;
  }
  latResEls.none.hidden = true;
  latResEls.content.hidden = false;

  const v = latencyResult.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  if (Math.abs(v) < 0.05) {
    latResEls.valueBig.textContent = "0,0 ms";
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResNoOffset") : "Kein Versatz.";
  } else if (v > 0) {
    latResEls.valueBig.textContent = `+${a} ms`;
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResLeftFaster").replace("{ms}", a)
      : `Linke Seite war ${a} ms schneller.`;
  } else {
    latResEls.valueBig.textContent = `−${a} ms`;
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResRightFaster").replace("{ms}", a)
      : `Rechte Seite war ${a} ms schneller.`;
  }

  const typeKey = {
    "click":     "latTypeClick",
    "burst500":  "latTypeBurst500",
    "burst1500": "latTypeBurst1500",
    "burst4000": "latTypeBurst4000",
  }[latencyResult.clickType];
  const typeLabel = (typeof t === "function" && typeKey)
    ? t(typeKey) : (latencyResult.clickType || "");
  latResEls.context.textContent =
    `${t("latResMeasuredWith")}: ${typeLabel}, ${t("latResInterval")} ${latencyResult.intervalMs} ms`;
}

