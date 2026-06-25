// ====================================================================
// latency.js — Latenz-Messung (Inter-Ohr-Zeitversatz)
// --------------------------------------------------------------------
// Exportierte Globals:
//   latenzResult           {valueMs, clickType, intervalMs} | null
//   plApplyLatency          bool — im Player anwenden?
//   latenzSliderMs             aktuell vom UI gesetzter Wert (Live-Test)
//   latenzActive               Test läuft gerade?
//   latenzClickType            "click" | "burst500" | "burst1500" | "burst4000"
//   latenzIntervalMs           Klick-Intervall in ms (manuell wählbar)
//
//   pLatSplitter, pLatDelayL, pLatDelayR, pLatMerger
//                           — Audio-Nodes, werden in player.js
//                             eingehängt (siehe Schritt 3 unten)
//
// Exportierte Funktionen:
//   latenzBuildClickBuffer(ctx)
//   latenzBuildBurstBuffer(ctx, freqHz, durMs)
//   latenzBuildLoopedTestBuffer(ctx, clickType, intervalMs)
//   latenzStartTest()
//   latenzStopTest()
//   latenzSetSliderMs(ms)
//   latenzApplyToPlayer()
//   latenzInitGraph(ctx)
// ====================================================================

let latenzResult = null;      // {valueMs, clickType, intervalMs}
let plApplyLatency = true;     // analog plApplyBalance

let latenzSliderMs = 0;           // aktueller Schieber-Wert (Test-Live)
let latenzActive = false;
let latenzClickType = "click";
let latenzIntervalMs = 1000;

let latenzTestSource = null;      // BufferSource für Test-Klicks
let latenzTestBuf = null;         // aktuell verwendeter Loop-Buffer
let latenzBalSplitter = null;
let latenzBalGainL    = null;
let latenzBalGainR    = null;
let latenzBalMerger   = null;
let latenzClickMuteGain = null;   // BA391: Klick-Mute (1=hoerbar, 0=stumm)

let latenzClicksAudible = true;   // BA392: Schalter "Klicktoene hoerbar"
let latenzPlayerAudible = true;   // BA392: Schalter "Player hoerbar"

// BA392: Zentrale Definition der zwei Hoerbarkeits-Schalter. Eine Stelle;
// Erzeugung UND Optik-Refresh iterieren hierueber. Neuer Schalter = neuer
// Eintrag. getFlag/setFlag kapseln das Flag, getMuteNode liefert den
// Ziel-Gain ZUM KLICKZEITPUNKT (latenzClickMuteGain wechselt pro Test).
const LAT_AUD_TOGGLES = [
  {
    id: 'latenzToggleClicks',
    tKey: 'latenzToggleClicks',
    getFlag: function() { return latenzClicksAudible; },
    setFlag: function(v) { latenzClicksAudible = v; },
    getMuteNode: function() { return latenzClickMuteGain; }
  },
  {
    id: 'latenzTogglePlayer',
    tKey: 'latenzTogglePlayer',
    getFlag: function() { return latenzPlayerAudible; },
    setFlag: function(v) { latenzPlayerAudible = v; },
    getMuteNode: function() {
      return (typeof pPlayerMuteGain !== "undefined") ? pPlayerMuteGain : null;
    }
  }
];

let pLatSplitter = null;
let pLatDelayL = null;
let pLatDelayR = null;
let pLatMerger = null;

// BA391: Setzt einen Gain mit kurzer linearer Rampe (20 ms) auf 0 (stumm)
// oder 1 (hoerbar). Gemeinsame Mute-Mechanik fuer Player- und Klick-Mute.
const LAT_MUTE_RAMP_S = 0.02; // 20 ms
function latenzRampGain(gainNode, audible) {
  if (!gainNode) return;
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) { gainNode.gain.value = audible ? 1 : 0; return; }
  const now = ctx.currentTime;
  const target = audible ? 1 : 0;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + LAT_MUTE_RAMP_S);
}

// --- Buffer-Generatoren ----------------------------------------------

// 1-ms-Klick, breitbandig, Hann-gefenstert um Knack-Artefakte zu
// vermeiden. Stereo (L=R), damit er gleichmäßig durch die Delays
// geht.
function latenzBuildClickBuffer(ctx) {
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
function latenzBuildBurstBuffer(ctx, freqHz, durMs) {
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
function latenzBuildLoopedTestBuffer(ctx, clickType, intervalMs) {
  const sr = ctx.sampleRate;

  let click;
  switch (clickType) {
    case "burst500":  click = latenzBuildBurstBuffer(ctx, 500,  6); break;
    case "burst1500": click = latenzBuildBurstBuffer(ctx, 1500, 4); break;
    case "burst4000": click = latenzBuildBurstBuffer(ctx, 4000, 3); break;
    case "click":
    default:          click = latenzBuildClickBuffer(ctx);
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
function latenzInitGraph(ctx) {
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
  latenzApplyToPlayer();
}

// --- Test-Klicks Start/Stop ------------------------------------------

function latenzStartTest() {
  if (latenzActive) latenzStopTest();
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) return;
  if (!pLatSplitter) latenzInitGraph(ctx);
  // SW (BA382): Andere Tabs (auch der Latenz-Test) stoppen die Player-
  // Wiedergabe NICHT mehr (Nutzer-Regel 2026-06-22) -- weder Musik (pPause)
  // noch Saetze (sStop). Beide laufen weiter. (Der frueher hier verhinderte
  // Ueberlagerungs-Fall ist bewusst akzeptiert.)
  latenzTestBuf = latenzBuildLoopedTestBuffer(ctx, latenzClickType, latenzIntervalMs);
  latenzTestSource = ctx.createBufferSource();
  latenzTestSource.buffer = latenzTestBuf;
  latenzTestSource.loop = true;

  // Stereo-Balance-Gains (vor pGain). Splitter + L/R-Gains + Merger
  // entstehen pro Test und werden beim Stop wieder verworfen.
  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  const volFactor = _latGetVolumeFactor();   // 0..1, Default 0.5 (=50%)
  latenzBalSplitter = ctx.createChannelSplitter(2);
  latenzBalMerger   = ctx.createChannelMerger(2);
  latenzBalGainL    = ctx.createGain();
  latenzBalGainR    = ctx.createGain();
  latenzBalGainL.gain.value = dB2G(balG.left)  * volFactor;
  latenzBalGainR.gain.value = dB2G(balG.right) * volFactor;
  latenzTestSource.connect(latenzBalSplitter);
  latenzBalSplitter.connect(latenzBalGainL, 0);
  latenzBalSplitter.connect(latenzBalGainR, 1);
  latenzBalGainL.connect(latenzBalMerger, 0, 0);
  latenzBalGainR.connect(latenzBalMerger, 0, 1);

  latenzClickMuteGain = ctx.createGain();
  latenzClickMuteGain.gain.value = 1; // Default hoerbar; Toggle-Steuerung in BA392
  latenzBalMerger.connect(latenzClickMuteGain);
  if (pLatSplitter) {
    latenzClickMuteGain.connect(pLatSplitter);
  } else {
    // Fallback: keine Latenz-Kette vorhanden (sollte nach BA390-Warmlauf
    // nicht vorkommen) -> direkt zum Ausgang, ohne Latenz.
    latenzClickMuteGain.connect(ctx.destination);
  }
  latenzTestSource.start();
  latenzActive = true;
}

function latenzStopTest() {
  if (latenzTestSource) {
    try { latenzTestSource.stop(); } catch (e) {}
    try { latenzTestSource.disconnect(); } catch (e) {}
    latenzTestSource = null;
  }
  if (latenzBalSplitter) { try { latenzBalSplitter.disconnect(); } catch (e) {} latenzBalSplitter = null; }
  if (latenzBalGainL)    { try { latenzBalGainL.disconnect();    } catch (e) {} latenzBalGainL = null; }
  if (latenzBalGainR)    { try { latenzBalGainR.disconnect();    } catch (e) {} latenzBalGainR = null; }
  if (latenzBalMerger)   { try { latenzBalMerger.disconnect();   } catch (e) {} latenzBalMerger = null; }
  if (latenzClickMuteGain) { try { latenzClickMuteGain.disconnect(); } catch (e) {} latenzClickMuteGain = null; }
  latenzTestBuf = null;
  latenzActive = false;
  // BA392: Player-Mute hoerbar zuruecksetzen -- Test-Audio ist beendet,
  // der Player soll wieder normal laufen. Einzige Stelle dafuer (beide
  // Test-Enden laufen durch latenzStopTest).
  if (typeof pPlayerMuteGain !== "undefined" && pPlayerMuteGain) {
    latenzRampGain(pPlayerMuteGain, true);
  }
}

// Wird bei laufendem Test aufgerufen, wenn der User Klick-Typ,
// Intervall oder Abwechseln-Modus ändert. Buffer neu bauen und
// Wiedergabe neu starten.
function latenzRestartIfActive() {
  if (latenzActive) {
    latenzStopTest();
    latenzStartTest();
  }
}

// --- Live-Slider-Wert in Delays ---------------------------------------

function latenzSetSliderMs(ms) {
  latenzSliderMs = ms;
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

// BA 313: Zentrale Quelle fuer die anzuwendende Latenz (ms).
// EQ-Schalter-Gate (Weg A) + nhSim-Spiegelung. Klang (latenzApplyToPlayer)
// und ab BA 314 der System-EQ-Export lesen NUR hier.
function getPlayerLatencyMs() {
  if (typeof plEqOn !== "undefined" && !plEqOn) return 0;
  if (!plApplyLatency) return 0;
  if (!latenzResult || !isFinite(latenzResult.valueMs)) return 0;
  const nh = document.getElementById("plNHSim");
  const nhSim = nh ? nh.checked : false;
  return nhSim ? -latenzResult.valueMs : latenzResult.valueMs;
}

// Setzt die Delays auf den gespeicherten latenzResult-Wert, falls
// plApplyLatency aktiv ist. Wird vom Test-Start/Stop und vom
// plApplyLatency-Toggle aufgerufen.
function latenzApplyToPlayer() {
  if (latenzActive) return; // während Test übernimmt latenzSetSliderMs
  if (!pLatDelayL || !pLatDelayR) return;
  // getPlayerLatencyMs liefert 0, wenn EQ aus / Latenz aus / kein Wert;
  // latenzSetSliderMs(0) setzt beide Delays auf 0.
  latenzSetSliderMs(getPlayerLatencyMs());
  if (typeof updLatApplyBtn === "function") updLatApplyBtn();
}

// =====================================================================
// =====================================================================
// Test-UI Migration (BA 223)
// =====================================================================

let latenzEls = null;          // panel-refs aus buildTestPanel
let latenzVolume = 75;         // 0..100, eigener Lautstärkewert (Test-lokal)

function _latGetVolumeFactor() {
  // 0..1, fallback 0.5
  const v = (latenzEls && latenzEls.header && latenzEls.header.volInput)
    ? parseFloat(latenzEls.header.volInput.value) : latenzVolume;
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(100, v)) / 100;
}

function _latBuildExtraFragment() {
  // Zwei Button-Reihen: Klick-Intervall und Klangtyp.
  const frag = document.createElement('div');
  frag.className = 'latenz-extra';

  // Klick-Intervall
  const intvWrap = document.createElement('div');
  intvWrap.style.margin = '12px 0';
  const intvLbl = document.createElement('div');
  intvLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  intvLbl.dataset.t = 'latenzIntervalLabel';
  const intvRow = document.createElement('div');
  intvRow.className = 'btn-row';
  intvRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [100, 200, 500, 1000, 2000].forEach(function(ms) {
    const b = document.createElement('button');
    b.className = 'btn latenz-interval-btn' + (ms === latenzIntervalMs ? ' active' : '');
    b.dataset.ms = String(ms);
    b.textContent = ms + ' ms';
    b.addEventListener('click', function() {
      latenzIntervalMs = ms;
      _latRefreshExtraActives();
      _latUpdateIntervalHint();
      latenzRestartIfActive();
    });
    intvRow.appendChild(b);
  });
  const intvHint = document.createElement('div');
  intvHint.id = 'latenzIntervalHint';
  intvHint.style.cssText = 'font-size:0.85em;color:var(--text-muted);margin-top:4px;';
  intvWrap.append(intvLbl, intvRow, intvHint);

  // Klangtyp
  const typeWrap = document.createElement('div');
  typeWrap.style.margin = '12px 0';
  const typeLbl = document.createElement('div');
  typeLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  typeLbl.dataset.t = 'latenzTypeLabel';
  const typeRow = document.createElement('div');
  typeRow.className = 'btn-row';
  typeRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [
    ['click',     'latenzTypeClick'],
    ['burst500',  'latenzTypeBurst500'],
    ['burst1500', 'latenzTypeBurst1500'],
    ['burst4000', 'latenzTypeBurst4000']
  ].forEach(function(pair) {
    const b = document.createElement('button');
    b.className = 'btn latenz-click-btn' + (pair[0] === latenzClickType ? ' active' : '');
    b.dataset.type = pair[0];
    b.dataset.t = pair[1];
    b.addEventListener('click', function() {
      latenzClickType = pair[0];
      _latRefreshExtraActives();
      latenzRestartIfActive();
    });
    typeRow.appendChild(b);
  });
  typeWrap.append(typeLbl, typeRow);

  // BA392: Hoerbarkeits-Schalter (eigener Bereich unter Klangtyp)
  const audWrap = document.createElement('div');
  audWrap.style.margin = '12px 0';
  const audLbl = document.createElement('div');
  audLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  audLbl.dataset.t = 'latenzAudibleLabel';
  const audRow = document.createElement('div');
  audRow.className = 'btn-row';
  audRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  LAT_AUD_TOGGLES.forEach(function(tg) {
    const b = document.createElement('button');
    b.className = 'btn latenz-aud-btn' + (tg.getFlag() ? ' active' : '');
    b.id = tg.id;
    b.dataset.t = tg.tKey;
    b.addEventListener('click', function() {
      const next = !tg.getFlag();
      tg.setFlag(next);
      b.classList.toggle('active', next);
      if (latenzActive) latenzRampGain(tg.getMuteNode(), next);
    });
    audRow.appendChild(b);
  });

  audWrap.append(audLbl, audRow);

  frag.append(intvWrap, typeWrap, audWrap);
  return frag;
}

function _latRefreshExtraActives() {
  if (!latenzEls || !latenzEls.header || !latenzEls.header.extraFragment) return;
  const frag = latenzEls.header.extraFragment;
  frag.querySelectorAll('.latenz-interval-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === latenzIntervalMs);
  });
  frag.querySelectorAll('.latenz-click-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === latenzClickType);
  });
}

function _latRefreshAudibleBtns() {
  LAT_AUD_TOGGLES.forEach(function(tg) {
    const b = document.getElementById(tg.id);
    if (b) b.classList.toggle('active', tg.getFlag());
  });
}

function _latUpdateIntervalHint() {
  if (!latenzEls || !latenzEls.header || !latenzEls.header.extraFragment) return;
  const hint = latenzEls.header.extraFragment.querySelector('#latenzIntervalHint');
  if (!hint) return;
  const unique = latenzIntervalMs / 2;
  let s = (t("latenzUniqueRange") || "Eindeutiger Bereich:") + " ±" + unique + " ms";
  if (unique < 200) s += " " + (t("latenzUniqueRangeAmbig") || "");
  hint.textContent = s;
}

function _latHasBalance() {
  // Pragmatische Detektion: mindestens ein gemessener Balance-Wert
  // existiert in lrResults ODER in sideData[*].elektrodenlautstaerkeResults.
  if (typeof lrResults === 'object' && lrResults
      && Object.values(lrResults).some(function(v) { return isFinite(v); })) return true;
  if (typeof sideData === 'object' && sideData) {
    for (const side of ['left', 'right']) {
      const sd = sideData[side];
      if (sd && Array.isArray(sd.elektrodenlautstaerkeResults) && sd.elektrodenlautstaerkeResults.length > 0) return true;
    }
  }
  return false;
}

function _latRefreshPrereqHints() {
  if (!latenzEls) return;
  testUI.explain.setVisible(latenzEls, 'latenzVortestBalanceMissing', !_latHasBalance());
}

// --- Hook-Implementierungen ---

function latenzHookOnStart() {
  // Seitenhörtest vor Start (analog freqmatch slider).
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      // Startwert: vorhandenes Ergebnis oder 0
      const startMs = (latenzResult && isFinite(latenzResult.valueMs))
        ? latenzResult.valueMs : 0;
      const slRef = latenzEls.verfahren.latenz.slider;
      if (slRef) {
        testUI.slider.setValue(slRef, startMs);
        // setValue setzt nur Range/Wert, nicht die Anzeige -> sonst zeigt
        // der Slider beim Neustart den zuletzt geschobenen Text, bis man
        // erneut schiebt. Anzeige analog lr-balance.js explizit setzen.
        testUI.slider.setValueDisplay(slRef, startMs.toFixed(1) + " ms");
      }
      latenzSetSliderMs(startMs);
      _latUpdateIntervalHint();
      // BA392: Hoerbarkeit bei jedem Start auf "beide hoerbar" zuruecksetzen
      latenzClicksAudible = true;
      latenzPlayerAudible = true;
      _latRefreshAudibleBtns();
      latenzStartTest();
      if (typeof pPlayerMuteGain !== "undefined" && pPlayerMuteGain) {
        latenzRampGain(pPlayerMuteGain, true);
      }
    },
    function() {
      // Abbruch im sideCheck -> testUI stoppt; wir raeumen nur unsere Resourcen.
      if (latenzEls && latenzEls._stopTest) latenzEls._stopTest();
    }
  );
}

function latenzHookOnStop() {
  // = "Test abbrechen": Audio-Loop stoppen, KEIN Speichern.
  latenzStopTest();
  latenzApplyToPlayer();   // setzt Delays auf gespeicherten Wert (falls vorhanden)
}

function latenzHookOnSlide(ms) {
  latenzSetSliderMs(ms);
}

function latenzHookOnApply() {
  // = "Offset bestaetigen": aktuellen Schieberwert speichern + Test beenden.
  latenzResult = {
    valueMs:    latenzSliderMs,
    clickType:  latenzClickType,
    intervalMs: latenzIntervalMs,
    timestamp:  Date.now(),
    implantSnapshot: (typeof implantSnapshot === 'function') ? implantSnapshot() : null
  };
  latenzApplyToPlayer();
  if (typeof latenzRenderResults === 'function') latenzRenderResults();
  if (typeof depLockApply === 'function') depLockApply();
  // Test sauber beenden
  if (latenzEls && latenzEls._stopTest) latenzEls._stopTest();
}

// --- DOMContentLoaded: testUI-Panel bauen ---

document.addEventListener("DOMContentLoaded", function() {
  const parentEl = document.getElementById("subpanel-messungen-latenz");
  if (!parentEl) return;

  const cfg = {
    id: 'latenz',
    explain: {
      titleKey: 'latenzMeasTitle',
      preserveOrder: false,
      paragraphs: [
        { key: 'latenzMaturityHint',           kind: 'info'    },
        { key: 'latenzBTWarning',              kind: 'caution' },
        { key: 'latenzVortestBalanceMissing',  kind: 'warn',  id: 'latenzVortestBalanceMissing',  hidden: true },
        { key: 'latenzPrereqHint',             kind: 'warn'    },
        { key: 'latenzMeasIntro2',             kind: 'plain'   },
        { key: 'latenzMeasIntro',              kind: 'plain'   },
        { key: 'latenzLocHint',                kind: 'plain'   }
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
      startStop:{ startKey: 'latenzStartBtn', stopKey: 'btnCancelTest', resumable: false }
    },
    verfahren: [{
      id: 'latenz',
      labelKey:   'latenzVerfahrenLabel',
      explainKey: null,
      body: {
        instruction:  { key: 'latenzInstruction' },
        keyHint:      { unitKey: 'sliderHintMs' },
        slider:       { unit: 'ms', initialRange: 50, maxRange: 2000, touchStep: 5, touchFineStep: 1 },
        sliderValue:  { show: true },
        applyButton:  { key: 'btnConfirmOffset' }
      },
      hooks: {
        onStart:  latenzHookOnStart,
        onStop:   latenzHookOnStop,
        onSlide:  latenzHookOnSlide,
        onApply:  latenzHookOnApply
      }
    }]
  };

  latenzEls = buildTestPanel(parentEl, cfg);

  // Volume-Default setzen
  if (latenzEls.header && latenzEls.header.volInput) {
    latenzEls.header.volInput.value = String(latenzVolume);
    latenzEls.header.volInput.addEventListener('change', function() {
      latenzVolume = parseFloat(latenzEls.header.volInput.value) || 50;
      // Wenn der Test läuft: Gains live nachziehen
      if (latenzActive && latenzBalGainL && latenzBalGainR) {
        const balG = (typeof getRawBalanceGains === "function")
          ? getRawBalanceGains() : { left: 0, right: 0 };
        const f = _latGetVolumeFactor();
        latenzBalGainL.gain.value = dB2G(balG.left)  * f;
        latenzBalGainR.gain.value = dB2G(balG.right) * f;
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
  const tabBtn = document.getElementById('latenzSubtabBtn');
  if (tabBtn) {
    tabBtn.addEventListener('click', function() { setTimeout(_latRefreshPrereqHints, 0); });
  }

  // Sprachwechsel: Intervall-Hint neu rendern
  document.addEventListener('lang-changed', _latUpdateIntervalHint);
});

// =====================================================================
// Ergebnis-Tab (Bauanleitung 27)
// =====================================================================

let latenzResEls = null;

function latenzRenderResults() {
  if (!latenzResEls) {
    latenzResEls = {
      none:      document.getElementById("latenzResNone"),
      content:   document.getElementById("latenzResContent"),
      valueBig:  document.getElementById("latenzResValueBig"),
      text:      document.getElementById("latenzResText"),
      context:   document.getElementById("latenzResContext"),
    };
  }
  if (!latenzResEls.none || !latenzResEls.content) return;

  if (!latenzResult || !isFinite(latenzResult.valueMs)) {
    latenzResEls.none.hidden = false;
    latenzResEls.content.hidden = true;
    return;
  }
  latenzResEls.none.hidden = true;
  latenzResEls.content.hidden = false;

  const v = latenzResult.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  if (Math.abs(v) < 0.05) {
    latenzResEls.valueBig.textContent = "0,0 ms";
    latenzResEls.text.textContent = (typeof t === "function")
      ? t("latenzResNoOffset") : "Kein Versatz.";
  } else if (v > 0) {
    latenzResEls.valueBig.textContent = `+${a} ms`;
    latenzResEls.text.textContent = (typeof t === "function")
      ? t("latenzResLeftFaster").replace("{ms}", a)
      : `Linke Seite war ${a} ms schneller.`;
  } else {
    latenzResEls.valueBig.textContent = `−${a} ms`;
    latenzResEls.text.textContent = (typeof t === "function")
      ? t("latenzResRightFaster").replace("{ms}", a)
      : `Rechte Seite war ${a} ms schneller.`;
  }

  const typeKey = {
    "click":     "latenzTypeClick",
    "burst500":  "latenzTypeBurst500",
    "burst1500": "latenzTypeBurst1500",
    "burst4000": "latenzTypeBurst4000",
  }[latenzResult.clickType];
  const typeLabel = (typeof t === "function" && typeKey)
    ? t(typeKey) : (latenzResult.clickType || "");
  latenzResEls.context.textContent =
    `${t("latenzResMeasuredWith")}: ${typeLabel}, ${t("latenzResInterval")} ${latenzResult.intervalMs} ms`;
  // BA 156
  if (typeof renderSnapshotHint === 'function' && latenzEls && latenzEls.snapHintBox) {
    renderSnapshotHint('latenz', latenzEls.snapHintBox);
  }
}

