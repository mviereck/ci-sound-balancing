// ============================================================
// AUDIO
// ============================================================
function gAC() {
  if (!audioCtx || audioCtx.state === "closed")
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function _activeTestInput(type) {
  if (testAct && typeof testEls !== 'undefined' && testEls) {
    if (type === 'vol') return testEls.volInput;
    if (type === 'dur') return testEls.durInput;
    if (type === 'pau') return testEls.pauseInput;
  }
  if (typeof lrRunning !== 'undefined' && lrRunning && typeof lrEls !== 'undefined' && lrEls) {
    if (type === 'vol') return lrEls.volInput;
    if (type === 'dur') return lrEls.durInput;
    if (type === 'pau') return lrEls.pauseInput;
  }
  if (typeof fmRunning !== 'undefined' && fmRunning && typeof fmEls !== 'undefined' && fmEls) {
    if (type === 'vol') return fmEls.volInput;
    if (type === 'dur') return fmEls.durInput;
    if (type === 'pau') return fmEls.pauseInput;
  }
  return document.getElementById(type === 'vol' ? 'vol1' : type === 'dur' ? 'dur1' : 'pau1');
}
function gVol() {
  const el = _activeTestInput('vol');
  return el ? Math.pow(parseInt(el.value) / 100, 2) : 0.25;
}
function gDur() {
  const el = _activeTestInput('dur');
  return parseInt(el && el.value) || 1000;
}
function gPau() {
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
  if (curOsc) {
    try {
      curOsc.stop();
    } catch (e) {}
    curOsc = null;
  }
  if (playTO) {
    clearTimeout(playTO);
    playTO = null;
  }
  sweepAct = false;
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

function applyCosRamp(gainNode, vol, c, ms, ramp) {
  gainNode.gain.setValueAtTime(0, c.currentTime);
  gainNode.gain.linearRampToValueAtTime(
    Math.max(0, vol), c.currentTime + ramp / 1000);
  gainNode.gain.setValueAtTime(
    Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
  gainNode.gain.linearRampToValueAtTime(
    0, c.currentTime + ms / 1000);
}

function playSineTone(c, hz, vol, ms, pan, ramp = 20) {
  return new Promise((r) => {
    const o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    p.pan.value = pan;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + ramp / 1000);
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    curOsc = o;
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { curOsc = null; r(); };
  });
}

function playComplexTone(c, hz, vol, ms, pan, ramp = 20) {
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
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + ramp / 1000);
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    g.connect(p);
    p.connect(c.destination);
    curOsc = oscs[0] || null;
    if (oscs.length > 0) {
      oscs[0].onended = () => { curOsc = null; r(); };
    } else {
      r();
    }
  });
}

function playNoiseTone(c, hz, vol, ms, pan, ramp = 20) {
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
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + ramp / 1000);
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    src.connect(bp);
    bp.connect(g);
    g.connect(p);
    p.connect(c.destination);
    curOsc = src;
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { curOsc = null; r(); };
  });
}

function playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp = 20) {
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
    curOsc = src;
    src.start();
    src.stop(c.currentTime + ms / 1000 + 0.01);
    src.onended = () => { curOsc = null; r(); };
  });
}

function playAmSineTone(c, hz, vol, ms, pan, ramp = 20) {
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
    curOsc = o;
    o.start();
    lfo.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { curOsc = null; r(); };
  });
}

function playWarbleSineTone(c, hz, vol, ms, pan, ramp = 20) {
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
    curOsc = o;
    o.start();
    lfo.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    lfo.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { curOsc = null; r(); };
  });
}

function playBurstSineTone(c, hz, vol, ms, pan, ramp = 20) {
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
    curOsc = o;
    o.start();
    o.stop(c.currentTime + (total + 50) / 1000);
    o.onended = () => { curOsc = null; r(); };
  });
}

function playWobbleSweepTone(c, hz, vol, ms, pan, ramp = 20) {
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
    curOsc = o;
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => { curOsc = null; r(); };
  });
}

function playToneTyped(c, hz, vol, ms, pan, toneType, ramp = 20) {
  if (toneType === "complex")       return playComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noise")         return playNoiseTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noiseAdaptive") return playNoiseAdaptiveTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "amSine")        return playAmSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "warbleSine")    return playWarbleSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "burstSine")     return playBurstSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "wobbleSweep")   return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}

function playTone(hz, vol, ms, ramp = 20) {
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  const effectiveVol = isDeaf(activeSide) ? 0 : vol;
  return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType, ramp);
}
function playHold(hz, vol) {
  stopAll();
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  const g = c.createGain();
  const p = c.createStereoPanner();
  p.pan.value = pan;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + 0.02);
  g.connect(p);
  p.connect(c.destination);
  if (globalToneType === "complex") {
    const partials = [
      { mult: 1, amp: 1.0 }, { mult: 2, amp: 0.5 }, { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 }, { mult: 5, amp: 0.2 },
    ];
    const total = partials.reduce((s, x) => s + x.amp, 0);
    const nyquist = c.sampleRate / 2 - 100;
    const oscs = [];
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
        oscs.push(o);
      }
    }
    curOsc = {
      stop: () => { oscs.forEach(o => { try { o.stop(); } catch(e) {} }); }
    };
  } else if (globalToneType === "noise") {
    const bufLen = Math.ceil(c.sampleRate * 2);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = 4.3;
    src.connect(bp);
    bp.connect(g);
    src.start();
    curOsc = src;
  } else if (globalToneType === "noiseAdaptive") {
    const bufLen = Math.ceil(c.sampleRate * 2);
    const buf = c.createBuffer(1, bufLen, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bw = getElectrodeBandwidth(hz);
    const bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = Math.max(0.5, hz / bw);
    src.connect(bp);
    bp.connect(g);
    src.start();
    curOsc = src;
  } else if (globalToneType === "amSine") {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const carrierGain = c.createGain();
    o.type = "sine";
    o.frequency.value = hz;
    lfo.type = "sine";
    lfo.frequency.value = 4;
    lfoGain.gain.value = 0.5;
    carrierGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(carrierGain.gain);
    o.connect(carrierGain);
    carrierGain.connect(g);
    o.start();
    lfo.start();
    curOsc = {
      stop: () => { try{o.stop();}catch(e){} try{lfo.stop();}catch(e){} }
    };
  } else if (globalToneType === "warbleSine") {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    o.type = "sine";
    o.frequency.value = hz;
    lfo.type = "sine";
    lfo.frequency.value = 5;
    lfoGain.gain.value = hz * 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(g);
    o.start();
    lfo.start();
    curOsc = {
      stop: () => { try{o.stop();}catch(e){} try{lfo.stop();}catch(e){} }
    };
  } else if (globalToneType === "wobbleSweep") {
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    o.type = "sine";
    o.frequency.value = hz;
    lfo.type = "sine";
    lfo.frequency.value = 1;
    lfoGain.gain.value = hz * 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);
    o.connect(g);
    o.start();
    lfo.start();
    curOsc = {
      stop: () => { try{o.stop();}catch(e){} try{lfo.stop();}catch(e){} }
    };
  } else if (globalToneType === "burstSine") {
    // burstSine im Hold-Modus nicht sinnvoll, Fallback Sinus
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = hz;
    o.connect(g);
    o.start();
    curOsc = o;
  } else {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.value = hz;
    o.connect(g);
    o.start();
    curOsc = o;
  }
}
function corrG(i) {
  if (!document.getElementById("corrToggle").checked || bRes.length === 0)
    return 1;
  const { levels } = compWLS();
  return dB2G(-levels[i]);
}
async function playSingle(i) {
  if (isPlay && holdIdx === -1) {
    stopAll();
    return;
  }
  stopAll();
  isPlay = true;
  updInd(i);
  await playTone(effFreq(i), gVol() * corrG(i), gDur());
  isPlay = false;
  updInd(-1);
}
function toggleHold(i) {
  if (holdIdx === i) {
    stopAll();
    return;
  }
  stopAll();
  holdIdx = i;
  updInd(i);
  playHold(effFreq(i), gVol() * corrG(i));
}
async function playSweep() {
  stopAll();
  sweepAct = true;
  isPlay = true;
  for (let i = 0; i < nEl; i++) {
    if (!sweepAct) break;
    updInd(i);
    await playTone(effFreq(i), gVol() * corrG(i), gDur());
    if (!sweepAct) break;
    await new Promise((r) => (playTO = setTimeout(r, 50 + gPau())));
  }
  isPlay = false;
  sweepAct = false;
  updInd(-1);
}
async function playSeq(eA, eB, off) {
  const v = gVol(),
    d = gDur(),
    p = gPau();
  // Symmetrische Verschiebung: off/2 zu B, -off/2 zu A
  const halfOff = off / 2;
  const vA = Math.max(Math.min(v * dB2G(-halfOff), 1), 0);
  const vB = Math.max(Math.min(v * dB2G(halfOff), 1), 0);
  updInd(eA, "a");
  await playTone(effFreq(eA), vA, d);
  if (!isPlay) return;
  updInd(-1);
  await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
  if (!isPlay) return;
  updInd(eB, "b");
  await playTone(effFreq(eB), vB, d);
  if (!isPlay) return;
  if (globalSequence === "aba") {
    updInd(-1);
    await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
    if (!isPlay) return;
    updInd(eA, "a");
    await playTone(effFreq(eA), vA, d);
  }
  isPlay = false;
  updInd(-1);
}
async function playFreqPair(refSide, refHz, varSide, varHz, vol, ms, pau, aba, firstSide) {
  const c = gAC();
  async function playOne(side, hz) {
    const pan = side === "left" ? -1 : 1;
    const effectiveVol = isDeaf(side) ? 0 : vol;
    return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType);
  }
  isPlay = true;
  if (firstSide === "ref") {
    await playOne(refSide, refHz);
    if (!isPlay) return;
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    await playOne(varSide, varHz);
    if (aba && isPlay) {
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      await playOne(refSide, refHz);
    }
  } else {
    await playOne(varSide, varHz);
    if (!isPlay) return;
    await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
    if (!isPlay) return;
    await playOne(refSide, refHz);
    if (aba && isPlay) {
      await new Promise((r) => { playTO = setTimeout(r, 50 + pau); });
      if (!isPlay) return;
      await playOne(varSide, varHz);
    }
  }
  isPlay = false;
}
function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  // Pair-Anzeige über testEls (falls verfügbar)
  const pL = (typeof testEls !== 'undefined' && testEls) ? testEls.pairLeft : document.getElementById("tAL");
  const pR = (typeof testEls !== 'undefined' && testEls) ? testEls.pairRight : document.getElementById("tBL");
  if (pL) pL.classList.toggle("playing", w === "a");
  if (pR) pR.classList.toggle("playing", w === "b");
}
