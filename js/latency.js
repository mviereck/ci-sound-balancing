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
  pLatDelayL   = ctx.createDelay(2.0); // 2 s Puffer für Schieberbereich bis ±2000 ms
  pLatDelayR   = ctx.createDelay(2.0);
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
  const volFactor = _latGetVolumeFactor();   // 0..1, Default 0.5 (=50%)
  latBalSplitter = ctx.createChannelSplitter(2);
  latBalMerger   = ctx.createChannelMerger(2);
  latBalGainL    = ctx.createGain();
  latBalGainR    = ctx.createGain();
  latBalGainL.gain.value = dB2G(balG.left)  * volFactor;
  latBalGainR.gain.value = dB2G(balG.right) * volFactor;
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
// =====================================================================
// Test-UI Migration (BA 223)
// =====================================================================

let latEls = null;          // panel-refs aus buildTestPanel
let latVolume = 50;         // 0..100, eigener Lautstärkewert (Test-lokal)

function _latGetVolumeFactor() {
  // 0..1, fallback 0.5
  const v = (latEls && latEls.header && latEls.header.volInput)
    ? parseFloat(latEls.header.volInput.value) : latVolume;
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(100, v)) / 100;
}

function _latBuildExtraFragment() {
  // Zwei Button-Reihen: Klick-Intervall und Klangtyp.
  const frag = document.createElement('div');
  frag.className = 'lat-extra';

  // Klick-Intervall
  const intvWrap = document.createElement('div');
  intvWrap.style.margin = '12px 0';
  const intvLbl = document.createElement('div');
  intvLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  intvLbl.dataset.t = 'latIntervalLabel';
  const intvRow = document.createElement('div');
  intvRow.className = 'btn-row';
  intvRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [100, 200, 500, 1000, 2000].forEach(function(ms) {
    const b = document.createElement('button');
    b.className = 'btn lat-interval-btn' + (ms === latIntervalMs ? ' active' : '');
    b.dataset.ms = String(ms);
    b.textContent = ms + ' ms';
    b.addEventListener('click', function() {
      latIntervalMs = ms;
      _latRefreshExtraActives();
      _latUpdateIntervalHint();
      latRestartIfActive();
    });
    intvRow.appendChild(b);
  });
  const intvHint = document.createElement('div');
  intvHint.id = 'latIntervalHint';
  intvHint.style.cssText = 'font-size:0.85em;color:var(--text-muted);margin-top:4px;';
  intvWrap.append(intvLbl, intvRow, intvHint);

  // Klangtyp
  const typeWrap = document.createElement('div');
  typeWrap.style.margin = '12px 0';
  const typeLbl = document.createElement('div');
  typeLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  typeLbl.dataset.t = 'latTypeLabel';
  const typeRow = document.createElement('div');
  typeRow.className = 'btn-row';
  typeRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [
    ['click',     'latTypeClick'],
    ['burst500',  'latTypeBurst500'],
    ['burst1500', 'latTypeBurst1500'],
    ['burst4000', 'latTypeBurst4000']
  ].forEach(function(pair) {
    const b = document.createElement('button');
    b.className = 'btn lat-click-btn' + (pair[0] === latClickType ? ' active' : '');
    b.dataset.type = pair[0];
    b.dataset.t = pair[1];
    b.addEventListener('click', function() {
      latClickType = pair[0];
      _latRefreshExtraActives();
      latRestartIfActive();
    });
    typeRow.appendChild(b);
  });
  typeWrap.append(typeLbl, typeRow);

  frag.append(intvWrap, typeWrap);
  return frag;
}

function _latRefreshExtraActives() {
  if (!latEls || !latEls.header || !latEls.header.extraFragment) return;
  const frag = latEls.header.extraFragment;
  frag.querySelectorAll('.lat-interval-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === latIntervalMs);
  });
  frag.querySelectorAll('.lat-click-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === latClickType);
  });
}

function _latUpdateIntervalHint() {
  if (!latEls || !latEls.header || !latEls.header.extraFragment) return;
  const hint = latEls.header.extraFragment.querySelector('#latIntervalHint');
  if (!hint) return;
  const unique = latIntervalMs / 2;
  let s = (t("latUniqueRange") || "Eindeutiger Bereich:") + " ±" + unique + " ms";
  if (unique < 200) s += " " + (t("latUniqueRangeAmbig") || "");
  hint.textContent = s;
}

function _latHasBalance() {
  // Pragmatische Detektion: mindestens ein gemessener Balance-Wert
  // existiert in lrResults ODER in sideData[*].bRes.
  if (typeof lrResults === 'object' && lrResults
      && Object.values(lrResults).some(function(v) { return isFinite(v); })) return true;
  if (typeof sideData === 'object' && sideData) {
    for (const side of ['left', 'right']) {
      const sd = sideData[side];
      if (sd && Array.isArray(sd.bRes) && sd.bRes.length > 0) return true;
    }
  }
  return false;
}

function _latHasLoudness() {
  // Pragmatische Detektion: mindestens eine Seite hat von Default
  // abweichende manualLevels ODER nicht-leere jRes.
  if (typeof sideData !== 'object' || !sideData) return false;
  for (const side of ['left', 'right']) {
    const sd = sideData[side];
    if (!sd) continue;
    if (Array.isArray(sd.manualLevels) && sd.manualLevels.some(function(v) { return isFinite(v) && v !== 0; })) return true;
    if (Array.isArray(sd.jRes) && sd.jRes.length > 0) return true;
  }
  return false;
}

function _latRefreshPrereqHints() {
  if (!latEls) return;
  testUI.explain.setVisible(latEls, 'latVortestBalanceMissing',  !_latHasBalance());
  testUI.explain.setVisible(latEls, 'latVortestLoudnessMissing', !_latHasLoudness());
}

// --- Hook-Implementierungen ---

function latHookOnStart() {
  // Seitenhörtest vor Start (analog freqmatch slider).
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      // Startwert: vorhandenes Ergebnis oder 0
      const startMs = (latencyResult && isFinite(latencyResult.valueMs))
        ? latencyResult.valueMs : 0;
      const slRef = latEls.verfahren.lat.slider;
      if (slRef) testUI.slider.setValue(slRef, startMs);
      latSetSliderMs(startMs);
      _latUpdateIntervalHint();
      latStartTest();
    },
    function() {
      // Abbruch im sideCheck -> testUI stoppt; wir raeumen nur unsere Resourcen.
      if (latEls && latEls._stopTest) latEls._stopTest();
    }
  );
}

function latHookOnStop() {
  // = "Test abbrechen": Audio-Loop stoppen, KEIN Speichern.
  latStopTest();
  latApplyToPlayer();   // setzt Delays auf gespeicherten Wert (falls vorhanden)
}

function latHookOnSlide(ms) {
  latSetSliderMs(ms);
}

function latHookOnApply() {
  // = "Offset bestaetigen": aktuellen Schieberwert speichern + Test beenden.
  latencyResult = {
    valueMs:    latSliderMs,
    clickType:  latClickType,
    intervalMs: latIntervalMs,
    timestamp:  Date.now(),
    implantSnapshot: (typeof implantSnapshot === 'function') ? implantSnapshot() : null
  };
  latApplyToPlayer();
  if (typeof latRenderResults === 'function') latRenderResults();
  if (typeof depLockApply === 'function') depLockApply();
  // Test sauber beenden
  if (latEls && latEls._stopTest) latEls._stopTest();
}

// --- DOMContentLoaded: testUI-Panel bauen ---

document.addEventListener("DOMContentLoaded", function() {
  const parentEl = document.getElementById("subpanel-messungen-latenz");
  if (!parentEl) return;

  const cfg = {
    id: 'latenz',
    explain: {
      titleKey: 'latMeasTitle',
      preserveOrder: false,
      paragraphs: [
        { key: 'latMaturityHint',           kind: 'info'    },
        { key: 'latBTWarning',              kind: 'caution' },
        { key: 'latVortestBalanceMissing',  kind: 'warn',  id: 'latVortestBalanceMissing',  hidden: true },
        { key: 'latVortestLoudnessMissing', kind: 'warn',  id: 'latVortestLoudnessMissing', hidden: true },
        { key: 'latPrereqHint',             kind: 'warn'    },
        { key: 'latMeasIntro2',             kind: 'plain'   },
        { key: 'latMeasIntro',              kind: 'plain'   },
        { key: 'latLocHint',                kind: 'plain'   }
      ]
    },
    header: {
      common: {
        refSelect:    false,
        volume:       { show: true },
        duration:     false,
        pause:        false,
        toneType:     false,
        sequence:     false,
        sliderTarget: false
      },
      extra:    { fragment: _latBuildExtraFragment() },
      startStop:{ startKey: 'latStartBtn', stopKey: 'btnCancelTest', resumable: false }
    },
    verfahren: [{
      id: 'lat',
      labelKey:   'latVerfahrenLabel',
      explainKey: null,
      body: {
        instruction:  { key: 'latInstruction' },
        keyHint:      { unitKey: 'sliderHintMs' },
        slider:       { unit: 'ms', initialRange: 50, maxRange: 2000, touchStep: 5, touchFineStep: 1 },
        sliderValue:  { show: true },
        applyButton:  { key: 'btnConfirmOffset' }
      },
      hooks: {
        onStart:  latHookOnStart,
        onStop:   latHookOnStop,
        onSlide:  latHookOnSlide,
        onApply:  latHookOnApply
      }
    }]
  };

  latEls = buildTestPanel(parentEl, cfg);

  // Volume-Default setzen
  if (latEls.header && latEls.header.volInput) {
    latEls.header.volInput.value = String(latVolume);
    latEls.header.volInput.addEventListener('change', function() {
      latVolume = parseFloat(latEls.header.volInput.value) || 50;
      // Wenn der Test läuft: Gains live nachziehen
      if (latActive && latBalGainL && latBalGainR) {
        const balG = (typeof getRawBalanceGains === "function")
          ? getRawBalanceGains() : { left: 0, right: 0 };
        const f = _latGetVolumeFactor();
        latBalGainL.gain.value = dB2G(balG.left)  * f;
        latBalGainR.gain.value = dB2G(balG.right) * f;
      }
    });
  }

  // Initial-Setup
  _latUpdateIntervalHint();
  _latRefreshPrereqHints();

  // Vortest-Hinweise jedes Mal beim Öffnen des Sub-Tabs aktualisieren
  document.addEventListener('subtab-shown', function(e) {
    if (e && e.detail && e.detail.subtab === 'latenz'
        && e.detail.parent === 'messungen') {
      _latRefreshPrereqHints();
    }
  });

  // Falls kein subtab-shown-Event existiert: Tab-Button-Klick als Fallback
  const tabBtn = document.getElementById('latSubtabBtn');
  if (tabBtn) {
    tabBtn.addEventListener('click', function() { setTimeout(_latRefreshPrereqHints, 0); });
  }

  // Sprachwechsel: Intervall-Hint neu rendern
  document.addEventListener('lang-changed', _latUpdateIntervalHint);
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
  // BA 156
  if (typeof renderSnapshotHint === 'function' && latEls && latEls.snapHintBox) {
    renderSnapshotHint('lat', latEls.snapHintBox);
  }
}

