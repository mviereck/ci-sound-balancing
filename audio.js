// ============================================================
// AUDIO
// ============================================================
function gAC() {
  if (!audioCtx || audioCtx.state === "closed")
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function gVol() {
  return Math.pow(
    parseInt(
      testAct
        ? document.getElementById("vol2").value
        : document.getElementById("vol1").value,
    ) / 100,
    2,
  );
}
function gDur() {
  return (
    parseInt(
      (testAct
        ? document.getElementById("dur2")
        : document.getElementById("dur1")
      ).value,
    ) || 1000
  );
}
function gPau() {
  return (
    parseInt(
      (testAct
        ? document.getElementById("pau2")
        : document.getElementById("pau1")
      ).value,
    ) || 500
  );
}
function dB2G(d) {
  return Math.pow(10, d / 20);
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

function playToneTyped(c, hz, vol, ms, pan, toneType, ramp = 20) {
  if (toneType === "complex") return playComplexTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "noise")   return playNoiseTone(c, hz, vol, ms, pan, ramp);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}

function playTone(hz, vol, ms, ramp = 20) {
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  return playToneTyped(c, hz, vol, ms, pan, globalToneType, ramp);
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
    p = gPau(),
    vB = Math.max(Math.min(v * dB2G(off), 1), 0);
  updInd(eA, "a");
  await playTone(effFreq(eA), v, d);
  if (!isPlay) return;
  updInd(-1);
  await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
  if (!isPlay) return;
  updInd(eB, "b");
  await playTone(effFreq(eB), vB, d);
  if (!isPlay) return;
  if (document.getElementById("paraI").value === "aba") {
    updInd(-1);
    await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
    if (!isPlay) return;
    updInd(eA, "a");
    await playTone(effFreq(eA), v, d);
  }
  isPlay = false;
  updInd(-1);
}
function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  const a = document.getElementById("tAL"),
    b = document.getElementById("tBL");
  if (a) a.classList.toggle("playing", w === "a");
  if (b) b.classList.toggle("playing", w === "b");
}
