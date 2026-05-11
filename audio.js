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
function playTone(hz, vol, ms, ramp = 20) {
  return new Promise((r) => {
    const c = gAC(),
      o = c.createOscillator(),
      g = c.createGain(),
      p = c.createStereoPanner();
    o.type = "sine";
    o.frequency.value = hz;
    const pan = activeSide === "left" ? -1 : 1;
    p.pan.value = pan;
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(
      Math.max(0, vol),
      c.currentTime + ramp / 1000,
    );
    g.gain.setValueAtTime(Math.max(0, vol), c.currentTime + (ms - ramp) / 1000);
    g.gain.linearRampToValueAtTime(0, c.currentTime + ms / 1000);
    o.connect(g);
    g.connect(p);
    p.connect(c.destination);
    curOsc = o;
    o.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = () => {
      curOsc = null;
      r();
    };
  });
}
function playHold(hz, vol) {
  stopAll();
  const c = gAC(),
    o = c.createOscillator(),
    g = c.createGain();
  o.type = "sine";
  o.frequency.value = hz;
  g.gain.setValueAtTime(0, c.currentTime);
  g.gain.linearRampToValueAtTime(Math.max(0, vol), c.currentTime + 0.02);
  o.connect(g);
  g.connect(c.destination);
  curOsc = o;
  o.start();
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
