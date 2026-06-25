// ====================================================================
// latency.js — Latenz-Messung (Inter-Ohr-Zeitversatz)
// --------------------------------------------------------------------
// Exportierte Globals:
//   LTZ_result           {valueMs, clickType, intervalMs} | null
//   plApplyLatency          bool — im Player anwenden?
//   ltz_sliderMs             aktuell vom UI gesetzter Wert (Live-Test)
//   LTZ_active               Test läuft gerade?
//   ltz_clickType            "click" | "burst500" | "burst1500" | "burst4000"
//   ltz_intervalMs           Klick-Intervall in ms (manuell wählbar)
//
//   pLatSplitter, pLatDelayL, pLatDelayR, pLatMerger
//                           — Audio-Nodes, werden in player.js
//                             eingehängt (siehe Schritt 3 unten)
//
// Exportierte Funktionen:
//   ltz_buildClickBuffer(ctx)
//   LTZ_buildBurstBuffer(ctx, freqHz, durMs)
//   ltz_buildLoopedTestBuffer(ctx, clickType, intervalMs)
//   ltz_startTest()
//   LTZ_stopTest()
//   ltz_setSliderMs(ms)
//   LTZ_applyToPlayer()
//   LTZ_initGraph(ctx)
// ====================================================================

let LTZ_result = null;      // {valueMs, clickType, intervalMs}
let plApplyLatency = true;     // analog plApplyBalance

let ltz_sliderMs = 0;           // aktueller Schieber-Wert (Test-Live)
let LTZ_active = false;
let ltz_clickType = "click";
let ltz_intervalMs = 1000;

let ltz_testSource = null;      // BufferSource für Test-Klicks
let ltz_testBuf = null;         // aktuell verwendeter Loop-Buffer
let ltz_balSplitter = null;
let ltz_balGainL    = null;
let ltz_balGainR    = null;
let ltz_balMerger   = null;
let ltz_clickMuteGain = null;   // BA391: Klick-Mute (1=hoerbar, 0=stumm)

let ltz_clicksAudible = true;   // BA392: Schalter "Klicktoene hoerbar"
let ltz_playerAudible = true;   // BA392: Schalter "Player hoerbar"

// BA392: Zentrale Definition der zwei Hoerbarkeits-Schalter. Eine Stelle;
// Erzeugung UND Optik-Refresh iterieren hierueber. Neuer Schalter = neuer
// Eintrag. getFlag/setFlag kapseln das Flag, getMuteNode liefert den
// Ziel-Gain ZUM KLICKZEITPUNKT (ltz_clickMuteGain wechselt pro Test).
const LTZ_AUD_TOGGLES = [
  {
    id: 'LTZ_toggleClicks',
    tKey: 'LTZ_toggleClicks',
    getFlag: function() { return ltz_clicksAudible; },
    setFlag: function(v) { ltz_clicksAudible = v; },
    getMuteNode: function() { return ltz_clickMuteGain; }
  },
  {
    id: 'LTZ_togglePlayer',
    tKey: 'LTZ_togglePlayer',
    getFlag: function() { return ltz_playerAudible; },
    setFlag: function(v) { ltz_playerAudible = v; },
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
const LTZ_MUTE_RAMP_S = 0.02; // 20 ms
function ltz_rampGain(gainNode, audible) {
  if (!gainNode) return;
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) { gainNode.gain.value = audible ? 1 : 0; return; }
  const now = ctx.currentTime;
  const target = audible ? 1 : 0;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + LTZ_MUTE_RAMP_S);
}

// --- Buffer-Generatoren ----------------------------------------------

// 1-ms-Klick, breitbandig, Hann-gefenstert um Knack-Artefakte zu
// vermeiden. Stereo (L=R), damit er gleichmäßig durch die Delays
// geht.
function ltz_buildClickBuffer(ctx) {
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
function LTZ_buildBurstBuffer(ctx, freqHz, durMs) {
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
function ltz_buildLoopedTestBuffer(ctx, clickType, intervalMs) {
  const sr = ctx.sampleRate;

  let click;
  switch (clickType) {
    case "burst500":  click = LTZ_buildBurstBuffer(ctx, 500,  6); break;
    case "burst1500": click = LTZ_buildBurstBuffer(ctx, 1500, 4); break;
    case "burst4000": click = LTZ_buildBurstBuffer(ctx, 4000, 3); break;
    case "click":
    default:          click = ltz_buildClickBuffer(ctx);
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
function LTZ_initGraph(ctx) {
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
  LTZ_applyToPlayer();
}

// --- Test-Klicks Start/Stop ------------------------------------------

function ltz_startTest() {
  if (LTZ_active) LTZ_stopTest();
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) return;
  if (!pLatSplitter) LTZ_initGraph(ctx);
  // SW (BA382): Andere Tabs (auch der Latenz-Test) stoppen die Player-
  // Wiedergabe NICHT mehr (Nutzer-Regel 2026-06-22) -- weder Musik (pPause)
  // noch Saetze (sStop). Beide laufen weiter. (Der frueher hier verhinderte
  // Ueberlagerungs-Fall ist bewusst akzeptiert.)
  ltz_testBuf = ltz_buildLoopedTestBuffer(ctx, ltz_clickType, ltz_intervalMs);
  ltz_testSource = ctx.createBufferSource();
  ltz_testSource.buffer = ltz_testBuf;
  ltz_testSource.loop = true;

  // Stereo-Balance-Gains (vor pGain). Splitter + L/R-Gains + Merger
  // entstehen pro Test und werden beim Stop wieder verworfen.
  const balG = (typeof STB_rawGains === "function")
    ? STB_rawGains() : { left: 0, right: 0 };
  const volFactor = _ltz_getVolumeFactor();   // 0..1, Default 0.5 (=50%)
  ltz_balSplitter = ctx.createChannelSplitter(2);
  ltz_balMerger   = ctx.createChannelMerger(2);
  ltz_balGainL    = ctx.createGain();
  ltz_balGainR    = ctx.createGain();
  ltz_balGainL.gain.value = dB2G(balG.left)  * volFactor;
  ltz_balGainR.gain.value = dB2G(balG.right) * volFactor;
  ltz_testSource.connect(ltz_balSplitter);
  ltz_balSplitter.connect(ltz_balGainL, 0);
  ltz_balSplitter.connect(ltz_balGainR, 1);
  ltz_balGainL.connect(ltz_balMerger, 0, 0);
  ltz_balGainR.connect(ltz_balMerger, 0, 1);

  ltz_clickMuteGain = ctx.createGain();
  ltz_clickMuteGain.gain.value = 1; // Default hoerbar; Toggle-Steuerung in BA392
  ltz_balMerger.connect(ltz_clickMuteGain);
  if (pLatSplitter) {
    ltz_clickMuteGain.connect(pLatSplitter);
  } else {
    // Fallback: keine Latenz-Kette vorhanden (sollte nach BA390-Warmlauf
    // nicht vorkommen) -> direkt zum Ausgang, ohne Latenz.
    ltz_clickMuteGain.connect(ctx.destination);
  }
  ltz_testSource.start();
  LTZ_active = true;
}

function LTZ_stopTest() {
  if (ltz_testSource) {
    try { ltz_testSource.stop(); } catch (e) {}
    try { ltz_testSource.disconnect(); } catch (e) {}
    ltz_testSource = null;
  }
  if (ltz_balSplitter) { try { ltz_balSplitter.disconnect(); } catch (e) {} ltz_balSplitter = null; }
  if (ltz_balGainL)    { try { ltz_balGainL.disconnect();    } catch (e) {} ltz_balGainL = null; }
  if (ltz_balGainR)    { try { ltz_balGainR.disconnect();    } catch (e) {} ltz_balGainR = null; }
  if (ltz_balMerger)   { try { ltz_balMerger.disconnect();   } catch (e) {} ltz_balMerger = null; }
  if (ltz_clickMuteGain) { try { ltz_clickMuteGain.disconnect(); } catch (e) {} ltz_clickMuteGain = null; }
  ltz_testBuf = null;
  LTZ_active = false;
  // BA392: Player-Mute hoerbar zuruecksetzen -- Test-Audio ist beendet,
  // der Player soll wieder normal laufen. Einzige Stelle dafuer (beide
  // Test-Enden laufen durch LTZ_stopTest).
  if (typeof pPlayerMuteGain !== "undefined" && pPlayerMuteGain) {
    ltz_rampGain(pPlayerMuteGain, true);
  }
}

// Wird bei laufendem Test aufgerufen, wenn der User Klick-Typ,
// Intervall oder Abwechseln-Modus ändert. Buffer neu bauen und
// Wiedergabe neu starten.
function ltz_restartIfActive() {
  if (LTZ_active) {
    LTZ_stopTest();
    ltz_startTest();
  }
}

// --- Live-Slider-Wert in Delays ---------------------------------------

function ltz_setSliderMs(ms) {
  ltz_sliderMs = ms;
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
// EQ-Schalter-Gate (Weg A) + nhSim-Spiegelung. Klang (LTZ_applyToPlayer)
// und ab BA 314 der System-EQ-Export lesen NUR hier.
function getPlayerLTZMs() {
  if (typeof plEqOn !== "undefined" && !plEqOn) return 0;
  if (!plApplyLatency) return 0;
  if (!LTZ_result || !isFinite(LTZ_result.valueMs)) return 0;
  const nh = document.getElementById("plNHSim");
  const nhSim = nh ? nh.checked : false;
  return nhSim ? -LTZ_result.valueMs : LTZ_result.valueMs;
}

// Setzt die Delays auf den gespeicherten LTZ_result-Wert, falls
// plApplyLatency aktiv ist. Wird vom Test-Start/Stop und vom
// plApplyLatency-Toggle aufgerufen.
function LTZ_applyToPlayer() {
  if (LTZ_active) return; // während Test übernimmt ltz_setSliderMs
  if (!pLatDelayL || !pLatDelayR) return;
  // getPlayerLTZMs liefert 0, wenn EQ aus / Latenz aus / kein Wert;
  // ltz_setSliderMs(0) setzt beide Delays auf 0.
  ltz_setSliderMs(getPlayerLTZMs());
  if (typeof updLatApplyBtn === "function") updLatApplyBtn();
}

// =====================================================================
// =====================================================================
// Test-UI Migration (BA 223)
// =====================================================================

let LTZ_els = null;          // panel-refs aus buildTestPanel
let ltz_volume = 75;         // 0..100, eigener Lautstärkewert (Test-lokal)

function _ltz_getVolumeFactor() {
  // 0..1, fallback 0.5
  const v = (LTZ_els && LTZ_els.header && LTZ_els.header.volInput)
    ? parseFloat(LTZ_els.header.volInput.value) : ltz_volume;
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(100, v)) / 100;
}

function _ltz_buildExtraFragment() {
  // Zwei Button-Reihen: Klick-Intervall und Klangtyp.
  const frag = document.createElement('div');
  frag.className = 'ltz-extra';

  // Klick-Intervall
  const intvWrap = document.createElement('div');
  intvWrap.style.margin = '12px 0';
  const intvLbl = document.createElement('div');
  intvLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  intvLbl.dataset.t = 'LTZ_intervalLabel';
  const intvRow = document.createElement('div');
  intvRow.className = 'btn-row';
  intvRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [100, 200, 500, 1000, 2000].forEach(function(ms) {
    const b = document.createElement('button');
    b.className = 'btn ltz-interval-btn' + (ms === ltz_intervalMs ? ' active' : '');
    b.dataset.ms = String(ms);
    b.textContent = ms + ' ms';
    b.addEventListener('click', function() {
      ltz_intervalMs = ms;
      _ltz_refreshExtraActives();
      _ltz_updateIntervalHint();
      ltz_restartIfActive();
    });
    intvRow.appendChild(b);
  });
  const intvHint = document.createElement('div');
  intvHint.id = 'ltz_intervalHint';
  intvHint.style.cssText = 'font-size:0.85em;color:var(--text-muted);margin-top:4px;';
  intvWrap.append(intvLbl, intvRow, intvHint);

  // Klangtyp
  const typeWrap = document.createElement('div');
  typeWrap.style.margin = '12px 0';
  const typeLbl = document.createElement('div');
  typeLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  typeLbl.dataset.t = 'LTZ_typeLabel';
  const typeRow = document.createElement('div');
  typeRow.className = 'btn-row';
  typeRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [
    ['click',     'LTZ_typeClick'],
    ['burst500',  'LTZ_typeBurst500'],
    ['burst1500', 'LTZ_typeBurst1500'],
    ['burst4000', 'LTZ_typeBurst4000']
  ].forEach(function(pair) {
    const b = document.createElement('button');
    b.className = 'btn ltz-click-btn' + (pair[0] === ltz_clickType ? ' active' : '');
    b.dataset.type = pair[0];
    b.dataset.t = pair[1];
    b.addEventListener('click', function() {
      ltz_clickType = pair[0];
      _ltz_refreshExtraActives();
      ltz_restartIfActive();
    });
    typeRow.appendChild(b);
  });
  typeWrap.append(typeLbl, typeRow);

  // BA392: Hoerbarkeits-Schalter (eigener Bereich unter Klangtyp)
  const audWrap = document.createElement('div');
  audWrap.style.margin = '12px 0';
  const audLbl = document.createElement('div');
  audLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  audLbl.dataset.t = 'LTZ_audibleLabel';
  const audRow = document.createElement('div');
  audRow.className = 'btn-row';
  audRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  LTZ_AUD_TOGGLES.forEach(function(tg) {
    const b = document.createElement('button');
    b.className = 'btn ltz-aud-btn' + (tg.getFlag() ? ' active' : '');
    b.id = tg.id;
    b.dataset.t = tg.tKey;
    b.addEventListener('click', function() {
      const next = !tg.getFlag();
      tg.setFlag(next);
      b.classList.toggle('active', next);
      if (LTZ_active) ltz_rampGain(tg.getMuteNode(), next);
    });
    audRow.appendChild(b);
  });

  audWrap.append(audLbl, audRow);

  frag.append(intvWrap, typeWrap, audWrap);
  return frag;
}

function _ltz_refreshExtraActives() {
  if (!LTZ_els || !LTZ_els.header || !LTZ_els.header.extraFragment) return;
  const frag = LTZ_els.header.extraFragment;
  frag.querySelectorAll('.ltz-interval-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === ltz_intervalMs);
  });
  frag.querySelectorAll('.ltz-click-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === ltz_clickType);
  });
}

function _ltz_refreshAudibleBtns() {
  LTZ_AUD_TOGGLES.forEach(function(tg) {
    const b = document.getElementById(tg.id);
    if (b) b.classList.toggle('active', tg.getFlag());
  });
}

function _ltz_updateIntervalHint() {
  if (!LTZ_els || !LTZ_els.header || !LTZ_els.header.extraFragment) return;
  const hint = LTZ_els.header.extraFragment.querySelector('#ltz_intervalHint');
  if (!hint) return;
  const unique = ltz_intervalMs / 2;
  let s = (t("LTZ_uniqueRange") || "Eindeutiger Bereich:") + " ±" + unique + " ms";
  if (unique < 200) s += " " + (t("LTZ_uniqueRangeAmbig") || "");
  hint.textContent = s;
}

function _ltz_hasSTB() {
  // Pragmatische Detektion: mindestens ein gemessener Balance-Wert
  // existiert in STB_results ODER in sideData[*].elektrodenlautstaerkeResults.
  if (typeof STB_results === 'object' && STB_results
      && Object.values(STB_results).some(function(v) { return isFinite(v); })) return true;
  if (typeof sideData === 'object' && sideData) {
    for (const side of ['left', 'right']) {
      const sd = sideData[side];
      if (sd && Array.isArray(sd.elektrodenlautstaerkeResults) && sd.elektrodenlautstaerkeResults.length > 0) return true;
    }
  }
  return false;
}

function _ltz_refreshPrereqHints() {
  if (!LTZ_els) return;
  testUI.explain.setVisible(LTZ_els, 'LTZ_vortestSTBMissing', !_ltz_hasSTB());
}

// --- Hook-Implementierungen ---

function ltz_hookOnStart() {
  // Seitenhörtest vor Start (analog freqmatch slider).
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      // Startwert: vorhandenes Ergebnis oder 0
      const startMs = (LTZ_result && isFinite(LTZ_result.valueMs))
        ? LTZ_result.valueMs : 0;
      const slRef = LTZ_els.verfahren.latenz.slider;
      if (slRef) {
        testUI.slider.setValue(slRef, startMs);
        // setValue setzt nur Range/Wert, nicht die Anzeige -> sonst zeigt
        // der Slider beim Neustart den zuletzt geschobenen Text, bis man
        // erneut schiebt. Anzeige analog stereobalance-balance.js explizit setzen.
        testUI.slider.setValueDisplay(slRef, startMs.toFixed(1) + " ms");
      }
      ltz_setSliderMs(startMs);
      _ltz_updateIntervalHint();
      // BA392: Hoerbarkeit bei jedem Start auf "beide hoerbar" zuruecksetzen
      ltz_clicksAudible = true;
      ltz_playerAudible = true;
      _ltz_refreshAudibleBtns();
      ltz_startTest();
      if (typeof pPlayerMuteGain !== "undefined" && pPlayerMuteGain) {
        ltz_rampGain(pPlayerMuteGain, true);
      }
    },
    function() {
      // Abbruch im sideCheck -> testUI stoppt; wir raeumen nur unsere Resourcen.
      if (LTZ_els && LTZ_els._stopTest) LTZ_els._stopTest();
    }
  );
}

function ltz_hookOnStop() {
  // = "Test abbrechen": Audio-Loop stoppen, KEIN Speichern.
  LTZ_stopTest();
  LTZ_applyToPlayer();   // setzt Delays auf gespeicherten Wert (falls vorhanden)
}

function ltz_hookOnSlide(ms) {
  ltz_setSliderMs(ms);
}

function ltz_hookOnApply() {
  // = "Offset bestaetigen": aktuellen Schieberwert speichern + Test beenden.
  LTZ_result = {
    valueMs:    ltz_sliderMs,
    clickType:  ltz_clickType,
    intervalMs: ltz_intervalMs,
    timestamp:  Date.now(),
    implantSnapshot: (typeof implantSnapshot === 'function') ? implantSnapshot() : null
  };
  LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === 'function') LTZ_renderResults();
  if (typeof depLockApply === 'function') depLockApply();
  // Test sauber beenden
  if (LTZ_els && LTZ_els._stopTest) LTZ_els._stopTest();
}

// --- DOMContentLoaded: testUI-Panel bauen ---

document.addEventListener("DOMContentLoaded", function() {
  const parentEl = document.getElementById("subpanel-messungen-latenz");
  if (!parentEl) return;

  const cfg = {
    id: 'latenz',
    explain: {
      titleKey: 'LTZ_measTitle',
      preserveOrder: false,
      paragraphs: [
        { key: 'LTZ_maturityHint',           kind: 'info'    },
        { key: 'LTZ_BTWarning',              kind: 'caution' },
        { key: 'LTZ_vortestSTBMissing',  kind: 'warn',  id: 'LTZ_vortestSTBMissing',  hidden: true },
        { key: 'LTZ_prereqHint',             kind: 'warn'    },
        { key: 'LTZ_measIntro2',             kind: 'plain'   },
        { key: 'LTZ_measIntro',              kind: 'plain'   },
        { key: 'LTZ_locHint',                kind: 'plain'   }
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
      extra:    { fragment: _ltz_buildExtraFragment() },
      startStop:{ startKey: 'LTZ_startBtn', stopKey: 'btnCancelTest', resumable: false }
    },
    verfahren: [{
      id: 'latenz',
      labelKey:   'LTZ_verfahrenLabel',
      explainKey: null,
      body: {
        instruction:  { key: 'LTZ_instruction' },
        keyHint:      { unitKey: 'sliderHintMs' },
        slider:       { unit: 'ms', initialRange: 50, maxRange: 2000, touchStep: 5, touchFineStep: 1 },
        sliderValue:  { show: true },
        applyButton:  { key: 'btnConfirmOffset' }
      },
      hooks: {
        onStart:  ltz_hookOnStart,
        onStop:   ltz_hookOnStop,
        onSlide:  ltz_hookOnSlide,
        onApply:  ltz_hookOnApply
      }
    }]
  };

  LTZ_els = buildTestPanel(parentEl, cfg);

  // Volume-Default setzen
  if (LTZ_els.header && LTZ_els.header.volInput) {
    LTZ_els.header.volInput.value = String(ltz_volume);
    LTZ_els.header.volInput.addEventListener('change', function() {
      ltz_volume = parseFloat(LTZ_els.header.volInput.value) || 50;
      // Wenn der Test läuft: Gains live nachziehen
      if (LTZ_active && ltz_balGainL && ltz_balGainR) {
        const balG = (typeof STB_rawGains === "function")
          ? STB_rawGains() : { left: 0, right: 0 };
        const f = _ltz_getVolumeFactor();
        ltz_balGainL.gain.value = dB2G(balG.left)  * f;
        ltz_balGainR.gain.value = dB2G(balG.right) * f;
      }
    });
  }

  // Initial-Setup
  _ltz_updateIntervalHint();
  _ltz_refreshPrereqHints();

  // Vortest-Hinweise jedes Mal beim Öffnen des Sub-Tabs aktualisieren
  document.addEventListener('subtab-shown', function(e) {
    if (e && e.detail && e.detail.subtab === 'latenz'
        && e.detail.parent === 'messungen') {
      _ltz_refreshPrereqHints();
    }
  });

  // Falls kein subtab-shown-Event existiert: Tab-Button-Klick als Fallback
  const tabBtn = document.getElementById('LTZ_subtabBtn');
  if (tabBtn) {
    tabBtn.addEventListener('click', function() { setTimeout(_ltz_refreshPrereqHints, 0); });
  }

  // Sprachwechsel: Intervall-Hint neu rendern
  document.addEventListener('lang-changed', _ltz_updateIntervalHint);
});

// =====================================================================
// Ergebnis-Tab (Bauanleitung 27)
// =====================================================================

let ltz_resEls = null;

function LTZ_renderResults() {
  if (!ltz_resEls) {
    ltz_resEls = {
      none:      document.getElementById("LTZ_resNone"),
      content:   document.getElementById("LTZ_resContent"),
      valueBig:  document.getElementById("LTZ_resValueBig"),
      text:      document.getElementById("LTZ_resText"),
      context:   document.getElementById("LTZ_resContext"),
    };
  }
  if (!ltz_resEls.none || !ltz_resEls.content) return;

  if (!LTZ_result || !isFinite(LTZ_result.valueMs)) {
    ltz_resEls.none.hidden = false;
    ltz_resEls.content.hidden = true;
    return;
  }
  ltz_resEls.none.hidden = true;
  ltz_resEls.content.hidden = false;

  const v = LTZ_result.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  if (Math.abs(v) < 0.05) {
    ltz_resEls.valueBig.textContent = "0,0 ms";
    ltz_resEls.text.textContent = (typeof t === "function")
      ? t("LTZ_resNoOffset") : "Kein Versatz.";
  } else if (v > 0) {
    ltz_resEls.valueBig.textContent = `+${a} ms`;
    ltz_resEls.text.textContent = (typeof t === "function")
      ? t("LTZ_resLeftFaster").replace("{ms}", a)
      : `Linke Seite war ${a} ms schneller.`;
  } else {
    ltz_resEls.valueBig.textContent = `−${a} ms`;
    ltz_resEls.text.textContent = (typeof t === "function")
      ? t("LTZ_resRightFaster").replace("{ms}", a)
      : `Rechte Seite war ${a} ms schneller.`;
  }

  const typeKey = {
    "click":     "LTZ_typeClick",
    "burst500":  "LTZ_typeBurst500",
    "burst1500": "LTZ_typeBurst1500",
    "burst4000": "LTZ_typeBurst4000",
  }[LTZ_result.clickType];
  const typeLabel = (typeof t === "function" && typeKey)
    ? t(typeKey) : (LTZ_result.clickType || "");
  ltz_resEls.context.textContent =
    `${t("LTZ_resMeasuredWith")}: ${typeLabel}, ${t("LTZ_resInterval")} ${LTZ_result.intervalMs} ms`;
  // BA 156
  if (typeof renderSnapshotHint === 'function' && LTZ_els && LTZ_els.snapHintBox) {
    renderSnapshotHint('latenz', LTZ_els.snapHintBox);
  }
}

