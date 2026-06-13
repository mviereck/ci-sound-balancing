// ============================================================
// AUDIO
// ============================================================
function gAC() {
  if (!audioCtx || audioCtx.state === "closed")
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

// ============================================================
// BA 270: Globale Ton-Huellkurve (Anstieg + Ausklang)
// ============================================================
// Toolweit global, persistent in localStorage ("ci-lb-toneEnv").
// Gilt fuer ALLE Toene (Sinus, Rauschen, Instrumente, CI-Test-Profile).
// Ersetzt die frueheren profil-eigenen attackMs-Werte und den 50ms-Default.
// Bedient wird das in BA 271 (Tonauswahl-Modal). Hier nur State + Engine.
let gToneEnvAttackForm = TONE_ENV_DEFAULTS.attackForm;  // "hard" | "linear" | "cos2" | "dblin"
let gToneEnvAttackMs   = TONE_ENV_DEFAULTS.attackMs;    // Anschwingzeit in ms (bei "hard" ignoriert)
let gToneEnvDbFloor    = TONE_ENV_DEFAULTS.dbFloor;     // Startpegel in dB, nur fuer "dblin"
let gToneEnvRelease    = TONE_ENV_DEFAULTS.release;     // "short" | "sym" | "hard"
const TONE_ENV_SHORT_MS = 30;     // feste Dauer des kurzen Ausklangs ("short")

// Zentraler Setter. Nimmt ein Patch-Objekt (nur gesetzte Felder wirken),
// schreibt die globalen Variablen und persistiert nach localStorage.
function setToneEnvelope(patch) {
  if (!patch) return;
  if (patch.attackForm !== undefined) gToneEnvAttackForm = patch.attackForm;
  if (patch.attackMs   !== undefined) gToneEnvAttackMs   = patch.attackMs;
  if (patch.dbFloor    !== undefined) gToneEnvDbFloor    = patch.dbFloor;
  if (patch.release    !== undefined) gToneEnvRelease    = patch.release;
  try {
    localStorage.setItem("ci-lb-toneEnv", JSON.stringify({
      attackForm: gToneEnvAttackForm,
      attackMs:   gToneEnvAttackMs,
      dbFloor:    gToneEnvDbFloor,
      release:    gToneEnvRelease
    }));
  } catch (e) { /* localStorage kann fehlen/voll sein — ignorieren */ }
}

// Liest persistierte Werte beim Laden zurueck. Wird einmal als
// Top-Level-Aufruf am Ende dieses Blocks ausgefuehrt (localStorage ist
// beim Script-Load synchron verfuegbar, kein DOM noetig).
function loadToneEnvelope() {
  try {
    var raw = localStorage.getItem("ci-lb-toneEnv");
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || typeof o !== "object") return;
    if (o.attackForm === "hard" || o.attackForm === "linear"
        || o.attackForm === "cos2" || o.attackForm === "dblin") {
      gToneEnvAttackForm = o.attackForm;
    }
    if (typeof o.attackMs === "number" && isFinite(o.attackMs) && o.attackMs >= 0) {
      gToneEnvAttackMs = o.attackMs;
    }
    if (typeof o.dbFloor === "number" && isFinite(o.dbFloor)) {
      gToneEnvDbFloor = o.dbFloor;
    }
    if (o.release === "short" || o.release === "sym" || o.release === "hard") {
      gToneEnvRelease = o.release;
    }
  } catch (e) { /* defekter Stand — Defaults behalten */ }
}
loadToneEnvelope();

function _activeTestInput(type) {
  // BA 250: Elektrodenlautstaerke-Test hat keine Header-Felder mehr —
  // Vol/Dur/Pau leben dort als State-Variablen (volume_test/duration_test/
  // pause_test). gVol/gDur/gPau lesen das direkt; _activeTestInput
  // braucht nur noch lr-balance und freqmatch (rein vorgehalten — beide
  // haben eigene Helfer).
  if (typeof lrRunning !== 'undefined' && lrRunning
      && typeof lrEls !== 'undefined' && lrEls && lrEls.header) {
    if (type === 'vol') return lrEls.header.volInput;
    if (type === 'dur') return lrEls.header.durInput;
    if (type === 'pau') return lrEls.header.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning
      && typeof fmEls !== 'undefined' && fmEls && fmEls.header) {
    if (type === 'vol') return fmEls.header.volInput;
    if (type === 'dur') return fmEls.header.durInput;
    if (type === 'pau') return fmEls.header.pauseInput;
  }
  return null;
}
function gVol() {
  // BA 287: gemeinsame Lautstaerke (frueher volume_test).
  if (testAct && typeof volume_global !== 'undefined') {
    return Math.pow((volume_global || 0) / 100, 2);
  }
  const el = _activeTestInput('vol');
  return el ? Math.pow(parseInt(el.value) / 100, 2) : 0.25;
}
function gDur() {
  // BA 250
  if (testAct && typeof duration_test !== 'undefined') {
    return duration_test || 750;
  }
  const el = _activeTestInput('dur');
  return parseInt(el && el.value) || 1000;
}
function gPau() {
  // BA 250
  if (testAct && typeof pause_test !== 'undefined') {
    return pause_test || 300;
  }
  const el = _activeTestInput('pau');
  return parseInt(el && el.value) || 500;
}
function dB2G(d) {
  return Math.pow(10, d / 20);
}
// Gibt true zurück wenn die gegebene Seite als "taub" konfiguriert ist
function isDeaf(side) {
  const s = side || activeSide;
  return (sideData[s] && (sideData[s].config || "ci") === "deaf");
}
function stopAll() {
  // BA 288: laufende Token-Sequenz der gemeinsamen Maschine abbrechen.
  if (typeof testUI !== 'undefined' && testUI.tonePlayer) {
    testUI.tonePlayer.stop();
  }
  if (runningSources && runningSources.length) {
    for (let k = 0; k < runningSources.length; k++) {
      try { runningSources[k].stop(); } catch (e) {}
    }
    runningSources = [];
  }
  if (playTO) {
    clearTimeout(playTO);
    playTO = null;
  }
  isPlay = false;
  holdIdx = -1;
  updInd(-1);
}
function getElectrodeBandwidth(hz) {
  if (!freqs || freqs.length < 2) {
    return hz * 0.232;
  }
  let idx = 0;
  let minDiff = Math.abs(freqs[0] - hz);
  for (let i = 1; i < freqs.length; i++) {
    const d = Math.abs(freqs[i] - hz);
    if (d < minDiff) { minDiff = d; idx = i; }
  }
  let bwLow, bwHigh;
  if (idx === 0) {
    bwHigh = (freqs[1] - freqs[0]) / 2;
    bwLow = bwHigh;
  } else if (idx === freqs.length - 1) {
    bwLow = (freqs[idx] - freqs[idx-1]) / 2;
    bwHigh = bwLow;
  } else {
    bwLow = (freqs[idx] - freqs[idx-1]) / 2;
    bwHigh = (freqs[idx+1] - freqs[idx]) / 2;
  }
  return bwLow + bwHigh;
}

// BA 270: Globale Ton-Huellkurve.
// Liest gToneEnvAttackForm / gToneEnvAttackMs / gToneEnvDbFloor /
// gToneEnvRelease. Der Parameter `ramp` bleibt nur fuer Signatur-
// Kompatibilitaet erhalten und wird nicht mehr genutzt.
//
// Anstiegsformen:
//   hard   — sofort voller Pegel (kein Anstieg)
//   linear — konstante Amplituden-Steigung
//   cos2   — Hann/Cos2 (tangential an beiden Enden), spektral glatteste Form
//   dblin  — dB-lineare Rampe: gleichmaessig wachsende Lautheit; startet
//            beim Startpegel gToneEnvDbFloor (z.B. -50 dB)
// Ausklang:
//   short  — fester kurzer Cos2-Ausklang (TONE_ENV_SHORT_MS)
//   sym    — gleiche Form und Zeit wie der Anstieg
//   hard   — abruptes Ende (kein Ausklang)
function applyCosRamp(gainNode, vol, c, ms, ramp) {
  const v        = Math.max(0, vol);
  const t0       = c.currentTime;
  const totalSec = Math.max(0.001, ms / 1000);
  const form     = gToneEnvAttackForm;

  // Anstiegsdauer (bei "hard" = 0).
  let atkSec = (form === "hard") ? 0 : Math.max(0, gToneEnvAttackMs) / 1000;

  // Ausklangsdauer je nach Modus.
  let relSec;
  if (gToneEnvRelease === "hard") {
    relSec = 0;
  } else if (gToneEnvRelease === "sym") {
    relSec = (form === "hard") ? 0 : Math.max(0, gToneEnvAttackMs) / 1000;
  } else { // "short"
    relSec = TONE_ENV_SHORT_MS / 1000;
  }

  // In die Tondauer einpassen: Ausklang max. halbe Dauer, Anstieg in den Rest.
  relSec = Math.min(relSec, totalSec / 2);
  atkSec = Math.min(atkSec, totalSec - relSec);

  // --- Anstieg ---
  if (atkSec < 0.001) {
    // harter Einstieg (oder zu kurz fuer eine sinnvolle Rampe)
    gainNode.gain.setValueAtTime(v, t0);
  } else {
    const up = _envCurve(form, v, gToneEnvDbFloor, true);
    gainNode.gain.setValueCurveAtTime(up, t0, atkSec);
  }

  // --- Ausklang ---
  if (relSec >= 0.001) {
    // Bei "sym" die Anstiegsform spiegeln, sonst sanftes Cos2.
    const relForm = (gToneEnvRelease === "sym") ? form : "cos2";
    const dn = _envCurve(relForm, v, gToneEnvDbFloor, false);
    gainNode.gain.setValueCurveAtTime(dn, t0 + (totalSec - relSec), relSec);
  }
}

// BA 270: Erzeugt ein 64-Punkt-Huellkurvenarray fuer eine gegebene Form.
//   rising=true  -> 0..voll (Anstieg)
//   rising=false -> voll..0 (Ausklang)
// floorDb wird nur bei "dblin" gebraucht (negativer Startpegel in dB).
function _envCurve(form, v, floorDb, rising) {
  const N = 64;
  const arr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);            // 0..1 ueber die Rampendauer
    const p = rising ? x : (1 - x);   // Lautstaerke-Fortschritt 0..1
    let g;
    if (form === "linear") {
      g = p;
    } else if (form === "dblin") {
      // dB-linear: bei p=1 voll (0 dB), bei p=0 Startpegel floorDb.
      g = Math.pow(10, (floorDb * (1 - p)) / 20);
    } else { // "cos2" (auch Fallback)
      g = 0.5 - 0.5 * Math.cos(Math.PI * p);
    }
    arr[i] = v * g;
  }
  return arr;
}

function playSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    runningSources.push(o);
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
  });
}

function playComplexTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const oscs = [],
      g = c.createGain(),
      p = c.createStereoPanner();
    const partials = [
      { mult: 1, amp: 1.0 },
      { mult: 2, amp: 0.5 },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;
    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        o.connect(og);
        og.connect(g);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p);
    p.connect(c.destination);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
  });
}

function playPulsedComplexTone(c, hz, vol, ms, pan, ramp = 50) {
  // Harmonischer Komplexton (wie playComplexTone) zusätzlich AM-moduliert
  // mit 100 Hz. Simuliert die Pulsraten-Hüllkurve aller CI-Strategien,
  // ohne die Pitch-Wahrnehmung zu zerstören.
  return new Promise((r) => {
    const PULSE_RATE = 100;           // Hz
    const MOD_DEPTH  = 0.7;           // 0 = keine Modulation, 1 = volle Tiefe
    const oscs = [],
      g = c.createGain(),
      p = c.createStereoPanner();
    const partials = [
      { mult: 1, amp: 1.0 },
      { mult: 2, amp: 0.5 },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;

    const carrierMix = c.createGain();
    carrierMix.gain.value = 1 - MOD_DEPTH / 2;

    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }

    const lfo     = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.type            = "sine";
    lfo.frequency.value = PULSE_RATE;
    lfoGain.gain.value  = MOD_DEPTH / 2;
    lfo.connect(lfoGain);
    lfoGain.connect(carrierMix.gain);
    lfo.start();
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    runningSources.push(lfo);

    carrierMix.connect(g);

    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p);
    p.connect(c.destination);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
  });
}

function playRichTone(c, hz, vol, ms, pan, ramp = 50) {
  // Harmonischer Komplexton mit 8 Harmonischen, leichtem Vibrato
  // (5 Hz, ±10 cent, gleichmäßig über alle Harmonischen) und schwacher
  // Atem-AM (3 Hz, 20%). Soll robustere Pitch-Wahrnehmung über das CI
  // ermöglichen durch zeitliche Modulation und spektrale Reichhaltigkeit,
  // analog zu Pitch-Cues in Sprache und Musik.
  return new Promise((r) => {
    const VIB_HZ      = 5;
    const VIB_CENTS   = 10;
    const AM_HZ       = 3;
    const AM_DEPTH    = 0.2;
    const oscs        = [];
    const g           = c.createGain();
    const p           = c.createStereoPanner();
    const carrierMix  = c.createGain();
    carrierMix.gain.value = 1 - AM_DEPTH / 2;

    const partials = [
      { mult: 1, amp: 1.00 },
      { mult: 2, amp: 0.60 },
      { mult: 3, amp: 0.40 },
      { mult: 4, amp: 0.30 },
      { mult: 5, amp: 0.22 },
      { mult: 6, amp: 0.16 },
      { mult: 7, amp: 0.12 },
      { mult: 8, amp: 0.09 },
    ];
    const total   = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;
    const vibFactor = Math.pow(2, VIB_CENTS / 1200) - 1;

    const vibLfo = c.createOscillator();
    vibLfo.type = "sine";
    vibLfo.frequency.value = VIB_HZ;

    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o  = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        const vibGain = c.createGain();
        vibGain.gain.value = freq * vibFactor;
        vibLfo.connect(vibGain);
        vibGain.connect(o.frequency);
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }

    const amLfo     = c.createOscillator();
    const amLfoGain = c.createGain();
    amLfo.type = "sine";
    amLfo.frequency.value = AM_HZ;
    amLfoGain.gain.value  = AM_DEPTH / 2;
    amLfo.connect(amLfoGain);
    amLfoGain.connect(carrierMix.gain);
    amLfo.start();
    amLfo.stop(c.currentTime + ms / 1000 + 0.01);

    vibLfo.start();
    vibLfo.stop(c.currentTime + ms / 1000 + 0.01);

    carrierMix.connect(g);
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p);
    p.connect(c.destination);
    runningSources.push(vibLfo);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    runningSources.push(amLfo);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
  });
}

function playRichToneProfile(c, hz, vol, ms, pan, profile, ramp = 50) {
  // Generische richTone-Synthese aus einem Profil-Objekt
  // (siehe js/richtone-profiles.js -> RICHTONE_PROFILES.<abbr>).
  // Felder: partials, vibratoHz, vibratoCents, amHz, amDepth, driftHz, driftCents.
  // BA 270: Anschwingen/Ausklang kommen jetzt aus der globalen
  // Huellkurve (applyCosRamp liest gToneEnv*). Kein profil-eigener Attack.
  // 0.4.282.1: driftHz/driftCents = bandbegrenztes Rauschen als
  // aperiodischer Frequenz-Drift. driftHz = Tiefpass-Cutoff fuer die
  // Drift-Rate, driftCents = Tiefe in Cent.
  return new Promise((r) => {
    const VIB_HZ      = profile.vibratoHz    || 0;
    const VIB_CENTS   = profile.vibratoCents || 0;
    const AM_HZ       = profile.amHz         || 0;
    const AM_DEPTH    = profile.amDepth      || 0;
    const DRIFT_HZ    = profile.driftHz      || 0;
    const DRIFT_CENTS = profile.driftCents   || 0;
    const partials    = (profile.partials && profile.partials.length)
                          ? profile.partials
                          : [{ mult: 1, amp: 1.0 }];

    const oscs        = [];
    const g           = c.createGain();
    const p           = c.createStereoPanner();
    const carrierMix  = c.createGain();
    carrierMix.gain.value = 1 - AM_DEPTH / 2;

    const total       = partials.reduce((s, x) => s + x.amp, 0) || 1;
    const nyquist     = c.sampleRate / 2 - 100;
    const vibFactor   = (VIB_HZ > 0 && VIB_CENTS > 0)
                          ? Math.pow(2, VIB_CENTS / 1200) - 1
                          : 0;
    const driftFactor = (DRIFT_HZ > 0 && DRIFT_CENTS > 0)
                          ? Math.pow(2, DRIFT_CENTS / 1200) - 1
                          : 0;

    let vibLfo = null;
    if (vibFactor > 0) {
      vibLfo = c.createOscillator();
      vibLfo.type = "sine";
      vibLfo.frequency.value = VIB_HZ;
    }

    let driftSrc = null;
    let driftLpf = null;
    if (driftFactor > 0) {
      const bufLen = Math.ceil(c.sampleRate * (ms / 1000 + 0.5));
      const buf = c.createBuffer(1, bufLen, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
      driftSrc = c.createBufferSource();
      driftSrc.buffer = buf;
      driftLpf = c.createBiquadFilter();
      driftLpf.type = "lowpass";
      driftLpf.frequency.value = DRIFT_HZ;
      driftLpf.Q.value = 0.7;
      driftSrc.connect(driftLpf);
    }

    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o  = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        if (vibLfo) {
          const vibGain = c.createGain();
          vibGain.gain.value = freq * vibFactor;
          vibLfo.connect(vibGain);
          vibGain.connect(o.frequency);
        }
        if (driftLpf) {
          const driftGain = c.createGain();
          // Tiefpass-Rauschen mit Cutoff << 1 Hz liefert |out| << 1, daher
          // Skalierung x6 als grobe Anpassung an den Cent-Headroom.
          driftGain.gain.value = freq * driftFactor * 6;
          driftLpf.connect(driftGain);
          driftGain.connect(o.frequency);
        }
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }

    if (AM_HZ > 0 && AM_DEPTH > 0) {
      const amLfo     = c.createOscillator();
      const amLfoGain = c.createGain();
      amLfo.type = "sine";
      amLfo.frequency.value = AM_HZ;
      amLfoGain.gain.value  = AM_DEPTH / 2;
      amLfo.connect(amLfoGain);
      amLfoGain.connect(carrierMix.gain);
      amLfo.start();
      amLfo.stop(c.currentTime + ms / 1000 + 0.01);
      runningSources.push(amLfo);
    }

    if (vibLfo) {
      vibLfo.start();
      vibLfo.stop(c.currentTime + ms / 1000 + 0.01);
      runningSources.push(vibLfo);
    }

    carrierMix.connect(g);
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p);
    p.connect(c.destination);
    for (let k = 0; k < oscs.length; k++) runningSources.push(oscs[k]);
    if (oscs.length > 0) {
      oscs[0].onended = () => { r(); };
    } else {
      r();
    }
  });
}

function playNoiseTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const bufLen = Math.ceil(c.sampleRate * (ms / 1000 + 0.05));
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = 4.3;
    const g = c.createGain();
    const p = c.createStereoPanner();
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(c.destination);
    runningSources.push(src);
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { r(); };
  });
}

function playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const bufLen = Math.ceil(c.sampleRate * (ms / 1000 + 0.05));
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bw = getElectrodeBandwidth(hz);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = Math.max(0.5, hz / bw);
    const g = c.createGain();
    const p = c.createStereoPanner();
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(c.destination);
    runningSources.push(src);
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { r(); };
  });
}

function playIRNTone(c, hz, vol, ms, pan, ramp = 50) {
  // Iterated Rippled Noise (Yost 1996, "Add-and-delay"-Cascade): weißes
  // Rauschen wird 16-mal mit sich selbst um 1/hz verzögert summiert, mit
  // Normalisierung pro Iteration. Erzeugt klare Pitch-Wahrnehmung bei f0
  // ohne harmonisches Linienspektrum; soll Pitch über das CI vermitteln,
  // ohne einzelne Elektroden dominant zu treffen.
  return new Promise((r) => {
    const ITERATIONS = 16;
    const FB_GAIN    = 1.0;
    const sampleRate = c.sampleRate;
    const delaySamp  = Math.max(1, Math.round(sampleRate / hz));
    const bufLen     = Math.ceil(sampleRate * (ms / 1000 + 0.05));

    let signal = new Float32Array(bufLen);
    for (let i = 0; i < bufLen; i++) signal[i] = Math.random() * 2 - 1;

    for (let it = 0; it < ITERATIONS; it++) {
      const next = new Float32Array(bufLen);
      let max = 0;
      for (let i = 0; i < bufLen; i++) {
        const d = (i >= delaySamp) ? signal[i - delaySamp] * FB_GAIN : 0;
        const v = signal[i] + d;
        next[i] = v;
        const a = v < 0 ? -v : v;
        if (a > max) max = a;
      }
      if (max > 1e-9) {
        for (let i = 0; i < bufLen; i++) next[i] /= max;
      }
      signal = next;
    }

    const buf = c.createBuffer(1, bufLen, sampleRate);
    buf.getChannelData(0).set(signal);

    const src = c.createBufferSource();
    src.buffer = buf;
    const g = c.createGain();
    const p = c.createStereoPanner();
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, ramp);
    src.connect(g);
    g.connect(p);
    p.connect(c.destination);
    runningSources.push(src);
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { r(); };
  });
}

function playAmSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const carrierGain = c.createGain();
    const envGain = c.createGain();
    const p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    lfo.type = "sine";
    lfo.frequency.value = 4;
    lfoGain.gain.value = 0.5;
    carrierGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(carrierGain.gain);
    o.connect(carrierGain);
    carrierGain.connect(envGain);
    envGain.connect(p);
    p.pan.value = pan;
    p.connect(c.destination);
    applyCosRamp(envGain, vol, c, ms, ramp);
    runningSources.push(o);
    runningSources.push(lfo);
    o.start();
    lfo.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
  });
}

function playWarbleSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const g = c.createGain();
    const p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    lfo.type = "sine";
    lfo.frequency.value = 5;
    lfoGain.gain.value = hz * 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(g);
    g.connect(p);
    p.pan.value = pan;
    p.connect(c.destination);
    applyCosRamp(g, vol, c, ms, ramp);
    runningSources.push(o);
    runningSources.push(lfo);
    o.start();
    lfo.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
  });
}

function playBurstSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const burstMs = 200;
    const pauseMs = 50;
    const burstRamp = 10;
    const nBursts = 4;
    const o = c.createOscillator();
    const g = c.createGain();
    const p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    g.gain.setValueAtTime(0, c.currentTime);
    const v = Math.max(0, vol);
    for (let i = 0; i < nBursts; i++) {
      const tStart = c.currentTime + i * (burstMs + pauseMs) / 1000;
      g.gain.setValueAtTime(0, tStart);
      g.gain.linearRampToValueAtTime(v, tStart + burstRamp / 1000);
      g.gain.setValueAtTime(v, tStart + (burstMs - burstRamp) / 1000);
      g.gain.linearRampToValueAtTime(0, tStart + burstMs / 1000);
    }
    const total = nBursts * burstMs + (nBursts - 1) * pauseMs;
    runningSources.push(o);
    o.start();
    o.stop(c.currentTime + (total + 50) / 1000);
    o.onended = () => { r(); };
  });
}

function playWobbleSweepTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    const o = c.createOscillator();
    const g = c.createGain();
    const p = c.createStereoPanner();
    o.type = "sine";
    const fLo = hz * 0.95;
    const fHi = hz * 1.05;
    const t0 = c.currentTime;
    o.frequency.setValueAtTime(fLo, t0);
    o.frequency.linearRampToValueAtTime(fHi, t0 + (ms/2) / 1000);
    o.frequency.linearRampToValueAtTime(fLo, t0 + ms / 1000);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    applyCosRamp(g, vol, c, ms, ramp);
    runningSources.push(o);
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { r(); };
  });
}

// BA 273: Experimentelle Toene.
// neighborSine — Sinus auf der Zielfrequenz plus die beiden direkt
// benachbarten Elektroden-Mittenfrequenzen auf halbem Pegel. freqs ist
// die global an die aktive Seite gebundene Elektroden-Frequenztabelle
// (siehe getElectrodeBandwidth / state-side.js bindActiveSide). Amplituden
// werden gegen die Summe normalisiert, damit kein Clipping entsteht; das
// Verhaeltnis Hauptton:Nachbar (2:1) bleibt dabei erhalten.
function playNeighborSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    var tones = [{ f: hz, amp: 1.0 }];
    if (typeof freqs !== "undefined" && freqs && freqs.length >= 2) {
      var idx = 0, minDiff = Math.abs(freqs[0] - hz);
      for (var i = 1; i < freqs.length; i++) {
        var d = Math.abs(freqs[i] - hz);
        if (d < minDiff) { minDiff = d; idx = i; }
      }
      if (idx - 1 >= 0)           tones.push({ f: freqs[idx - 1], amp: 0.5 });
      if (idx + 1 < freqs.length) tones.push({ f: freqs[idx + 1], amp: 0.5 });
    }
    var total   = tones.reduce(function (s, t) { return s + t.amp; }, 0) || 1;
    var nyquist = c.sampleRate / 2 - 100;
    var g = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;
    var oscs = [];
    for (var k = 0; k < tones.length; k++) {
      if (tones[k].f <= 0 || tones[k].f >= nyquist) continue;
      var o  = c.createOscillator();
      var og = c.createGain();
      o.type = "sine";
      o.frequency.value = tones[k].f;
      og.gain.value = tones[k].amp / total;
      o.connect(og); og.connect(g);
      o.start();
      o.stop(c.currentTime + ms / 1000 + 0.01);
      oscs.push(o);
    }
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p); p.connect(c.destination);
    for (var j = 0; j < oscs.length; j++) runningSources.push(oscs[j]);
    if (oscs.length > 0) oscs[0].onended = function () { r(); };
    else r();
  });
}

// sineNoiseMix — Sinus + adaptives Schmalbandrauschen. Das Rauschband
// folgt der Frequenz (Bandbreite via getElectrodeBandwidth, identisch zu
// playNoiseAdaptiveTone). sineLevel / noiseLevel sind Pegelfaktoren, die
// vor der gemeinsamen vol-Huellkurve wirken.
function playSineNoiseMixTone(c, hz, vol, ms, pan, sineLevel, noiseLevel, ramp = 50) {
  return new Promise((r) => {
    var envGain = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;

    var o  = c.createOscillator();
    var sg = c.createGain();
    o.type = "sine";
    o.frequency.value = hz;
    sg.gain.value = sineLevel;
    o.connect(sg); sg.connect(envGain);

    var bufLen = Math.ceil(c.sampleRate * (ms / 1000 + 0.05));
    var buf = c.createBuffer(1, bufLen, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var bw = getElectrodeBandwidth(hz);
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = Math.max(0.5, hz / bw);
    var ng = c.createGain();
    ng.gain.value = noiseLevel;
    src.connect(bp); bp.connect(ng); ng.connect(envGain);

    applyCosRamp(envGain, vol, c, ms, ramp);
    envGain.connect(p); p.connect(c.destination);

    runningSources.push(o);
    runningSources.push(src);
    o.start(); src.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    src.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = function () { r(); };
  });
}

// BA 274: Cluster -- Zielfrequenz plus count eng benachbarte
// Nebenfrequenzen, je count/2 ober- und unterhalb. unit "hz": fester
// Hz-Abstand (Schwebung mit gleichem Tempo ueber alle Tonhoehen). unit
// "cent": proportionaler Abstand. Alle Teiltoene gleich laut (gegen die
// Summe normalisiert). Sehr tiefe Nebenfrequenzen werden bei MIN_HZ
// abgefangen, zu hohe (ueber Nyquist) weggelassen.
function playClusterTone(c, hz, vol, ms, pan, count, spacing, unit, ramp = 50) {
  return new Promise((r) => {
    var MIN_HZ  = 20;
    var nyquist = c.sampleRate / 2 - 100;
    var freqList = [hz];
    var half = Math.floor(count / 2);
    for (var k = 1; k <= half; k++) {
      var up, dn;
      if (unit === "cent") {
        up = hz * Math.pow(2,  (k * spacing) / 1200);
        dn = hz * Math.pow(2, -(k * spacing) / 1200);
      } else {
        up = hz + k * spacing;
        dn = hz - k * spacing;
      }
      freqList.push(up);
      freqList.push(dn);
    }
    var g = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;
    var amp = 1 / freqList.length;
    var oscs = [];
    for (var i = 0; i < freqList.length; i++) {
      var f = freqList[i];
      if (f < MIN_HZ || f >= nyquist) continue;
      var o  = c.createOscillator();
      var og = c.createGain();
      o.type = "sine";
      o.frequency.value = f;
      og.gain.value = amp;
      o.connect(og); og.connect(g);
      o.start();
      o.stop(c.currentTime + ms / 1000 + 0.01);
      oscs.push(o);
    }
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p); p.connect(c.destination);
    for (var j = 0; j < oscs.length; j++) runningSources.push(oscs[j]);
    if (oscs.length > 0) oscs[0].onended = function () { r(); };
    else r();
  });
}

// BA 225: zentrale Whitelist-Pruefung fuer toneType-Strings.
// Wird von file.js und init.js statt der lokalen VALID_TONE_TYPES-Arrays
// verwendet.
const _BASE_TONE_TYPES = ["sine", "complex", "pulsedComplex", "richTone",
  "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
  "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
  "richVc", "richHn",
  "richCiH", "richCiHA", "richCiHS", "richCiHF",
  "richCiB", "richCiP", "richCiBF", "richCiG", "richCiS",
  "richCiGVL", "richCiGVN", "richCiGVS",
  "richCiGA1", "richCiGA2", "richCiGB",
  "richCiGD1", "richCiGD2",
  "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
  "wobbleSweep",
  "neighborSine", "sineNoiseHalf", "sineNoiseFull",
  "clusterHz2x3", "clusterHz4x3", "clusterHz2x8", "clusterHz4x8",
  "clusterCent2x10", "clusterCent4x10", "clusterCent2x30", "clusterCent4x30"];

function isValidToneType(tt) {
  if (typeof tt !== "string" || tt.length === 0) return false;
  if (_BASE_TONE_TYPES.includes(tt)) return true;
  if (tt.startsWith("smplr:mellotron:")) {
    return tt.length > "smplr:mellotron:".length;
  }
  return false;
}

// BA 225: Sampler-Wiedergabe via smplr (Mellotron).
// hz -> naechste MIDI-Note + Cent-Detune
// vol (0..1) -> instance.output.volume (0..127)
// pan (-1..+1) -> instance.output.pan vor jedem start()
// ms -> duration (Sekunden)
// Wenn der Sampler noch nicht geladen ist: Lade-Trigger anstossen,
// Promise.resolve() ohne Tonwiedergabe zurueckgeben.
function _playSmplrTone(c, hz, vol, ms, pan, token) {
  if (typeof loadSamplerByToken !== "function" || typeof smplrSamplerIsReady !== "function") {
    return Promise.resolve();
  }
  if (!smplrSamplerIsReady(token)) {
    loadSamplerByToken(c, token).catch(function () { /* swallow */ });
    return Promise.resolve();
  }
  return loadSamplerByToken(c, token).then(function (inst) {
    if (!inst || typeof inst.start !== "function") return;
    try {
      if (inst.output) {
        inst.output.pan = Math.max(-1, Math.min(1, pan || 0));
        inst.output.volume = Math.max(0, Math.min(127, Math.round((vol || 0) * 127)));
      }
    } catch (e) { /* swallow */ }
    const midiFloat = 69 + 12 * Math.log2(Math.max(1, hz) / 440);
    const midiNote = Math.round(midiFloat);
    const detuneCents = Math.round((midiFloat - midiNote) * 100);
    try {
      inst.start({
        note: midiNote,
        velocity: 100,
        detune: detuneCents,
        duration: Math.max(0.05, (ms || 500) / 1000)
      });
    } catch (e) { /* swallow */ }
  });
}

function playToneTyped(c, hz, vol, ms, pan, toneType, ramp = 50) {
  if (toneType === "complex")        return playComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "pulsedComplex")  return playPulsedComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "richTone")       return playRichTone(c, hz, vol, ms, pan, ramp);
  // 14 Instrumenten-Profile aus js/richtone-profiles.js
  if (toneType.length > 4 && toneType.startsWith("rich")) {
    const abbr = toneType.substring(4);
    if (typeof RICHTONE_PROFILES !== "undefined" && RICHTONE_PROFILES[abbr]) {
      return playRichToneProfile(c, hz, vol, ms, pan, RICHTONE_PROFILES[abbr], ramp);
    }
  }
  if (toneType === "noise")          return playNoiseTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noiseAdaptive")  return playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "irn")            return playIRNTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "amSine")         return playAmSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "warbleSine")     return playWarbleSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "burstSine")      return playBurstSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "wobbleSweep")    return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "neighborSine")   return playNeighborSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "sineNoiseHalf")  return playSineNoiseMixTone(c, hz, vol, ms, pan, 0.5, 0.5, ramp);
  if (toneType === "sineNoiseFull")  return playSineNoiseMixTone(c, hz, vol, ms, pan, 1.0, 0.5, ramp);
  if (toneType === "clusterHz2x3")    return playClusterTone(c, hz, vol, ms, pan, 2, 3,  "hz",   ramp);
  if (toneType === "clusterHz4x3")    return playClusterTone(c, hz, vol, ms, pan, 4, 3,  "hz",   ramp);
  if (toneType === "clusterHz2x8")    return playClusterTone(c, hz, vol, ms, pan, 2, 8,  "hz",   ramp);
  if (toneType === "clusterHz4x8")    return playClusterTone(c, hz, vol, ms, pan, 4, 8,  "hz",   ramp);
  if (toneType === "clusterCent2x10") return playClusterTone(c, hz, vol, ms, pan, 2, 10, "cent", ramp);
  if (toneType === "clusterCent4x10") return playClusterTone(c, hz, vol, ms, pan, 4, 10, "cent", ramp);
  if (toneType === "clusterCent2x30") return playClusterTone(c, hz, vol, ms, pan, 2, 30, "cent", ramp);
  if (toneType === "clusterCent4x30") return playClusterTone(c, hz, vol, ms, pan, 4, 30, "cent", ramp);
  if (typeof toneType === "string" && toneType.startsWith("smplr:"))
    return _playSmplrTone(c, hz, vol, ms, pan, toneType);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}

function playTone(hz, vol, ms, ramp = 50, toneType = "sine") {
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  const effectiveVol = isDeaf(activeSide) ? 0 : vol;
  return playToneTyped(c, hz, effectiveVol, ms, pan, toneType, ramp);
}
// BA 284: Zentrale Pegel-Aufteilung fuer ein Tonpaar (Elektrodenlautstaerke).
//   vol = Grundpegel-Amplitude (0..1), off = Slider-Offset in dB.
// Zone 1 (genug Headroom): symmetrisch -off/2 auf A, +off/2 auf B.
// Zone 2 (ein Ton an der Decke): der lautere Ton bleibt bei 1.0, der
//   andere wird um den VOLLEN off abgesenkt -> der Lautstaerkeunterschied
//   entspricht immer exakt dem Slider-Wert.
// Rueckgabe: { vA, vB, capped } mit capped = null | 'a' | 'b'
//   (welcher Ton an der Decke klebt; von BA 285 fuer den Hinweis genutzt).
function pairGains(vol, off) {
  var halfOff = off / 2;
  var aIdeal = vol * dB2G(-halfOff);
  var bIdeal = vol * dB2G(halfOff);
  if (aIdeal <= 1 && bIdeal <= 1) {
    return { vA: aIdeal, vB: bIdeal, capped: null };
  }
  if (bIdeal > 1) {
    // off > 0: B ist der lautere -> Decke; A voll abgesenkt.
    return { vA: dB2G(-off), vB: 1, capped: 'b' };
  }
  // off < 0: A ist der lautere -> Decke; B voll abgesenkt.
  return { vA: 1, vB: dB2G(off), capped: 'a' };
}

function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  // BA 248: Pair-Anzeige nur noch ueber neue testUI-API
  // (testEls.verfahren[...].pairIndicator). Alte API und DOM-Fallback
  // sind mit BA 248 weg.
  let pL = null, pR = null;
  if (typeof testEls !== 'undefined' && testEls
      && testEls.verfahren && typeof _testActiveVerfahren !== 'undefined'
      && testEls.verfahren[_testActiveVerfahren]
      && testEls.verfahren[_testActiveVerfahren].pairIndicator) {
    pL = testEls.verfahren[_testActiveVerfahren].pairIndicator.left;
    pR = testEls.verfahren[_testActiveVerfahren].pairIndicator.right;
  }
  if (pL) pL.classList.toggle("playing", w === "a");
  if (pR) pR.classList.toggle("playing", w === "b");
}
