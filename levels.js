// ============================================================
// LEVELS – Preset-Berechnung und Levels-Tab
// ============================================================

function calcPresetCurve(pr) {
  const act = allEl(),
    n = nEl,
    c = new Array(n).fill(0);
  if (act.length < 2) return c;
  // center can be fractional (half positions like 5.5)
  const ctr =
    pr.center != null
      ? pr.center
      : Math.floor((act[0] + act[act.length - 1]) / 2);
  const mn = act[0],
    mx = act[act.length - 1],
    span = mx - mn || 1;
  if (pr.type === "tilt") {
    for (const i of act) c[i] = (i - ctr) / (span / 2);
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "scurve") {
    for (const i of act) {
      const x = (i - ctr) / (span / 2);
      c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "pivot") {
    for (const i of act) {
      const d = Math.abs(i - ctr) / (span / 2);
      c[i] = -(d * d * 2 - 1);
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "gauss") {
    const sig = Math.max(0.5, pr.width || 2);
    for (const i of act) c[i] = Math.exp(-0.5 * Math.pow((i - ctr) / sig, 2));
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "bassboost") {
    const cut = pr.cutoff != null ? pr.cutoff : Math.floor(nEl / 3);
    for (const i of act) {
      if (i <= cut) c[i] = 1;
      else {
        const d = (i - cut) / (mx - cut || 1);
        c[i] = Math.max(0, 1 - d * 2);
      }
    }
    return c;
  }
  if (pr.type === "highboost") {
    const cut = pr.cutoff != null ? pr.cutoff : Math.floor((nEl * 2) / 3);
    for (const i of act) {
      if (i >= cut) c[i] = 1;
      else {
        const d = (cut - i) / (cut - mn || 1);
        c[i] = Math.max(0, 1 - d * 2);
      }
    }
    return c;
  }
  if (pr.type === "speech") {
    const effF = Array.from({ length: n }, (_, i) => effFreq(i));
    const w = siiWeightsForFreqs(effF);
    const mean = w.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) c[i] = w[i] - mean;
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (let i = 0; i < n; i++) c[i] /= mx2;
    return c;
  }
  if (pr.type === "volume") {
    // Gleichmäßige Anhebung/Absenkung aller aktiven Elektroden.
    // Inaktive (deaktiviert / mute / während Test ausgeschlossen)
    // bleiben auf 0, damit die Stärke nicht stillschweigend auf
    // ausgeblendete Kanäle wirkt.
    for (const i of act) c[i] = 1;
    return c;
  }
  return c;
}
function getTotalPresetCurve() {
  const c = new Array(nEl).fill(0);
  for (const pr of presets) {
    if (!pr.on || pr.strength === 0) continue;
    const pc = calcPresetCurve(pr);
    for (let i = 0; i < nEl; i++) c[i] += pc[i] * pr.strength;
  }
  return c;
}
function getEffectiveLevels() {
  const pc = getTotalPresetCurve();
  return manualLevels.map((m, i) => m + pc[i]);
}

function lvOnChange() {
  drawLvChart();
  if (typeof lvTabDraw === "function") lvTabDraw();
  if (pEqF.length > 0) pUpdEQ();
}
function applyPresetDeltaOtherSide(pi, delta, currentPr) {
  if (!document.getElementById("prBothSides")?.checked) return;
  if (Math.abs(delta) < 0.001) return;
  const otherSide = activeSide === "left" ? "right" : "left";
  const op = sideData[otherSide].presets;
  if (!op || !op[pi]) return;
  op[pi].strength = Math.max(
    -20,
    Math.min(20, +(op[pi].strength + delta).toFixed(1)),
  );
  // Mirror shape params too if same type
  if (op[pi].type === currentPr.type) {
    if (currentPr.center !== undefined) op[pi].center = currentPr.center;
    if (currentPr.width !== undefined) op[pi].width = currentPr.width;
    if (currentPr.cutoff !== undefined) op[pi].cutoff = currentPr.cutoff;
  }
}
function buildPrTbl() {
  const tbl = document.getElementById("prTbl");
  tbl.innerHTML = "";
  const act = allEl();
  // Build center options with half positions
  const pfx = dENPrefix();
  let ctrOpts = "";
  for (let i = 0; i < nEl; i++) {
    ctrOpts += `<option value="${i}">${pfx}${dEN(i)}</option>`;
    if (i < nEl - 1) {
      const halfVal = i + 0.5;
      const lbl = `${pfx}${dEN(i)}–${pfx}${dEN(i + 1)}`;
      ctrOpts += `<option value="${halfVal}">${lbl}</option>`;
    }
  }
  const elOpts = act
    .map((i) => `<option value="${i}">${pfx}${dEN(i)}</option>`)
    .join("");
  const widthOpts = Array.from(
    { length: nEl },
    (_, i) => `<option value="${i + 1}">${i + 1}</option>`,
  ).join("");
  const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
  const defaultCenter = centerMap[mfr] || Math.floor(nEl / 2);
  for (let pi = 0; pi < presets.length; pi++) {
    const pr = presets[pi];
    const tr = document.createElement("tr");
    tr.className = pr.on ? "" : "pr-row-off";
    let params = '<div class="pr-param">';
    params += `<label>${t("lvPrStr")}</label><input type="number" class="prStr" data-pi="${pi}" value="${pr.strength.toFixed(1)}" min="-20" max="20" step="0.5">`;
    if (PR_HAS_CENTER[pr.type])
      params += ` <label>${t("lvPrCenter")}</label><select class="prCtr" data-pi="${pi}">${ctrOpts}</select>`;
    if (PR_HAS_WIDTH[pr.type])
      params += ` <label>${t("lvPrWidth")}</label><select class="prWid" data-pi="${pi}">${widthOpts}</select>`;
    if (PR_HAS_CUTOFF[pr.type])
      params += ` <label>${t("lvPrCutoff")}</label><select class="prCut" data-pi="${pi}">${elOpts}</select>`;
    params += "</div>";
    tr.innerHTML = `<td><input type="checkbox" class="prOn" data-pi="${pi}" ${pr.on ? "checked" : ""}></td><td class="pr-name">${t(PR_NAMES[pr.type])}</td><td>${params}</td>`;
    tbl.appendChild(tr);
    const ctrSel = tr.querySelector(".prCtr");
    if (ctrSel)
      ctrSel.value = pr.center !== undefined ? pr.center : defaultCenter;
    const widSel = tr.querySelector(".prWid");
    if (widSel) widSel.value = pr.width;
    const cutSel = tr.querySelector(".prCut");
    if (cutSel) cutSel.value = pr.cutoff;
    const tr2 = document.createElement("tr");
    tr2.className = pr.on ? "" : "pr-row-off";
    tr2.innerHTML = `<td></td><td colspan="2" style="font-size:.78em;color:var(--text-muted);padding-top:0">${t(PR_EXPL[pr.type])}</td>`;
    tbl.appendChild(tr2);
  }
  tbl.querySelectorAll(".prOn").forEach((cb) =>
    cb.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      const wasOn = presets[pi].on;
      presets[pi].on = this.checked;
      // Mirror on/off to other side if checkbox active
      if (document.getElementById("prBothSides")?.checked) {
        const otherSide = activeSide === "left" ? "right" : "left";
        const op = sideData[otherSide].presets;
        if (op && op[pi]) {
          op[pi].on = this.checked;
        }
      }
      buildPrTbl();
      lvOnChange();
      if (this.checked) {
        const strInp = tbl.querySelector(
          `.prStr[data-pi="${this.dataset.pi}"]`,
        );
        if (strInp) strInp.focus();
      }
    }),
  );
  tbl.querySelectorAll(".prStr").forEach((inp) => {
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      const oldVal = presets[pi].strength;
      const newVal = Math.max(-20, Math.min(20, parseFloat(this.value) || 0));
      const delta = newVal - oldVal;
      presets[pi].strength = newVal;
      this.value = newVal.toFixed(1);
      applyPresetDeltaOtherSide(pi, delta, presets[pi]);
      lvOnChange();
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        const pi = +this.dataset.pi,
          st = 0.1;
        const oldVal = presets[pi].strength;
        if (e.key === "ArrowUp")
          presets[pi].strength = Math.min(
            20,
            +(presets[pi].strength + st).toFixed(1),
          );
        if (e.key === "ArrowDown")
          presets[pi].strength = Math.max(
            -20,
            +(presets[pi].strength - st).toFixed(1),
          );
        const delta = presets[pi].strength - oldVal;
        this.value = presets[pi].strength.toFixed(1);
        applyPresetDeltaOtherSide(pi, delta, presets[pi]);
        lvOnChange();
      }
    });
  });
  tbl.querySelectorAll(".prCtr").forEach((sel) =>
    sel.addEventListener("change", function () {
      presets[+this.dataset.pi].center = parseFloat(this.value);
      lvOnChange();
    }),
  );
  tbl.querySelectorAll(".prWid").forEach((sel) =>
    sel.addEventListener("change", function () {
      presets[+this.dataset.pi].width = +this.value;
      lvOnChange();
    }),
  );
  tbl.querySelectorAll(".prCut").forEach((sel) =>
    sel.addEventListener("change", function () {
      presets[+this.dataset.pi].cutoff = +this.value;
      lvOnChange();
    }),
  );
}
function drawLvChart() {
  const cv = document.getElementById("lvChartCv");
  if (!cv) return;
  const wp = cv.parentElement,
    dpr = window.devicePixelRatio || 1,
    W = wp.clientWidth,
    H = wp.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const showMeas = document.getElementById("lvChkMeas").checked;
  const showMan = document.getElementById("lvChkMan").checked;
  const showPre = document.getElementById("lvChkPre").checked;
  const act = allEl();
  if (!act.length) return;
  const { levels } = compWLS();
  const pc = getTotalPresetCurve();
  const measV = act.map((i) => {
    const hd = bRes.some((r) => r.a === i || r.b === i);
    return hd ? levels[i] : 0;
  });
  const manV = act.map((i) => manualLevels[i]);
  const preV = act.map((i) => pc[i]);
  const sumV = act.map(
    (_, j) =>
      (showMeas ? measV[j] : 0) +
      (showMan ? manV[j] : 0) +
      (showPre ? preV[j] : 0),
  );
  const yMx = 20;
  const pad = { left: 42, right: 16, top: 16, bottom: 32 },
    pW = W - pad.left - pad.right,
    pH = H - pad.top - pad.bottom;
  const zY = pad.top + pH / 2;
  const xS = pW / (act.length - 1 || 1);
  const tX = (j) => pad.left + j * xS;
  const tY = (v) => pad.top + (yMx - v) * (pH / (2 * yMx));
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (let s = -4; s <= 4; s++) {
    const v = s * 5,
      y = tY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText((v >= 0 ? "+" : "") + v, pad.left - 4, y + 3);
  }
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.left, zY);
  ctx.lineTo(W - pad.right, zY);
  ctx.stroke();
  ctx.setLineDash([]);
  function drawLine(vals, color, width, dash) {
    if (!vals.some((v) => v !== 0) && width < 2.5) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    for (let j = 0; j < act.length; j++) {
      if (j === 0) ctx.moveTo(tX(j), tY(vals[j]));
      else ctx.lineTo(tX(j), tY(vals[j]));
    }
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
    for (let j = 0; j < act.length; j++) {
      ctx.beginPath();
      ctx.arc(tX(j), tY(vals[j]), width < 2.5 ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
  if (showMeas) drawLine(measV, "#2563eb", 1.5, [4, 3]);
  if (showMan) drawLine(manV, "#16a34a", 1.5, [4, 3]);
  if (showPre) drawLine(preV, "#d97706", 1.5, [4, 3]);
  drawLine(sumV, "#1a1a1a", 2.5, null);
  for (let j = 0; j < act.length; j++) {
    ctx.fillStyle = act[j] === refEl ? "#2563eb" : "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dENPrefix() + dEN(act[j]), tX(j), H - pad.bottom + 12);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    const lvF = effFreq(act[j]);
    ctx.fillText(
      lvF >= 1000 ? (lvF / 1000).toFixed(1) + "k" : lvF,
      tX(j),
      H - pad.bottom + 22,
    );
  }
}
