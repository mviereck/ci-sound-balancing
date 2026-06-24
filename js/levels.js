// ============================================================
// LEVELS – Preset-Berechnung und Levels-Tab
// ============================================================

function calcPresetCurve(pr) {
  const act = allEl(),
    n = nEl,
    c = new Array(n).fill(0);
  if (act.length < 2) return c;
  const mn = act[0], mx = act[act.length - 1];
  // Mittelpunkt in Hz (Default 1000 Hz)
  const ctrHz = pr.center != null ? pr.center : CENT_REF_HZ;
  const ctrC = hzToCent(ctrHz);
  // Span in Cent über die aktiven Elektroden
  const fMin = effFreqDisplay(act[0]);
  const fMax = effFreqDisplay(act[act.length - 1]);
  const cMin = hzToCent(fMin);
  const cMax = hzToCent(fMax);
  const halfSpanC = Math.max(1, (cMax - cMin) / 2);

  if (pr.type === "tilt") {
    for (const i of act) {
      const xC = hzToCent(effFreqDisplay(i)) - ctrC;
      c[i] = xC / halfSpanC;
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "scurve") {
    for (const i of act) {
      const x = (hzToCent(effFreqDisplay(i)) - ctrC) / halfSpanC;
      c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "pivot") {
    for (const i of act) {
      const d = Math.abs(hzToCent(effFreqDisplay(i)) - ctrC) / halfSpanC;
      c[i] = -(d * d * 2 - 1);
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "gauss") {
    // Breite in Cent (Default 1200 ¢ = 1 Oktave)
    const sigC = Math.max(50, pr.width || 1200);
    for (const i of act) {
      const dC = hzToCent(effFreqDisplay(i)) - ctrC;
      c[i] = Math.exp(-0.5 * Math.pow(dC / sigC, 2));
    }
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
    const effF = Array.from({ length: n }, (_, i) => effFreqDisplay(i));
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
  return elektrodenlautstaerkeSchieber.map((m, i) => m + pc[i]);
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
function _prStrTouchCtrl(inp, pi) {
  if (!inp) return null;
  var box = document.createElement('div');
  box.className = 'touch-ctrl prStr-touch';
  box.style.cssText = 'display:inline-flex;gap:4px;margin-left:6px;vertical-align:middle;';

  var fineMode = false;

  function step(dir) {
    var st = fineMode ? 0.1 : 0.5;
    var oldVal = presets[pi].strength;
    var newVal = Math.max(-20, Math.min(20, +(oldVal + dir * st).toFixed(1)));
    presets[pi].strength = newVal;
    inp.value = newVal.toFixed(1);
    applyPresetDeltaOtherSide(pi, newVal - oldVal, presets[pi]);
    lvOnChange();
  }

  function mkBtn(label, cls) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'touch-btn touch-btn-sm' + (cls ? ' ' + cls : '');
    b.innerHTML = label;
    return b;
  }

  var bMin  = mkBtn('−');
  var bFine = mkBtn('Fein');
  var bPlus = mkBtn('+');

  attachLongPress(bMin,  function () { step(-1); });
  attachLongPress(bPlus, function () { step(+1); });
  bFine.addEventListener('click', function () {
    fineMode = !fineMode;
    bFine.classList.toggle('fine-active', fineMode);
  });

  box.append(bMin, bFine, bPlus);

  if (inp.parentNode) {
    if (inp.nextSibling) inp.parentNode.insertBefore(box, inp.nextSibling);
    else inp.parentNode.appendChild(box);
  }
  return box;
}
function buildPrTbl() {
  const tbl = document.getElementById("prTbl");
  tbl.innerHTML = "";
  const act = allEl();
  const pfx = dENPrefix();
  const elOpts = act
    .map((i) => `<option value="${i}">${pfx}${dEN(i)}</option>`)
    .join("");
  // Mittelpunkt: Number-Input in Hz (50–20000, Schritt 50).
  // Breite (Gauß): Number-Input in Cent (50–4800, Schritt 50).
  for (let pi = 0; pi < presets.length; pi++) {
    const pr = presets[pi];
    const tr = document.createElement("tr");
    tr.className = pr.on ? "" : "pr-row-off";
    let params = '<div class="pr-param">';
    params += `<label>${t("lvPrStr")}</label><input type="number" class="prStr" data-pi="${pi}" value="${pr.strength.toFixed(1)}" min="-20" max="20" step="0.5">`;
    if (PR_HAS_CENTER[pr.type])
      params += ` <label>${t("lvPrCenter")}</label><input type="number" class="prCtr" data-pi="${pi}" min="50" max="20000" step="50" style="width:80px"> ${t("lvPrUnitHz")}`;
    if (PR_HAS_WIDTH[pr.type])
      params += ` <label>${t("lvPrWidth")}</label><input type="number" class="prWid" data-pi="${pi}" min="50" max="4800" step="50" style="width:80px"> ${t("lvPrUnitCent")}`;
    if (PR_HAS_CUTOFF[pr.type])
      params += ` <label>${t("lvPrCutoff")}</label><select class="prCut" data-pi="${pi}">${elOpts}</select>`;
    params += "</div>";
    tr.innerHTML = `<td><input type="checkbox" class="prOn" data-pi="${pi}" ${pr.on ? "checked" : ""}></td><td class="pr-name">${t(PR_NAMES[pr.type])}</td><td>${params}</td>`;
    tbl.appendChild(tr);
    const ctrInp = tr.querySelector(".prCtr");
    if (ctrInp)
      ctrInp.value = Math.round(
        pr.center !== undefined ? pr.center : CENT_REF_HZ,
      );
    const widInp = tr.querySelector(".prWid");
    if (widInp) widInp.value = Math.round(pr.width != null ? pr.width : 1200);
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
        if (strInp) safeFocus(strInp);
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
    _prStrTouchCtrl(inp, +inp.dataset.pi);
  });
  tbl.querySelectorAll(".prCtr").forEach((inp) =>
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      let v = parseFloat(this.value);
      if (!isFinite(v) || v < 50) v = 50;
      if (v > 20000) v = 20000;
      presets[pi].center = v;
      this.value = Math.round(v);
      if (document.getElementById("prBothSides")?.checked) {
        const otherSide = activeSide === "left" ? "right" : "left";
        const op = sideData[otherSide].presets;
        if (op && op[pi] && op[pi].type === presets[pi].type) {
          op[pi].center = v;
        }
      }
      lvOnChange();
    }),
  );
  tbl.querySelectorAll(".prWid").forEach((inp) =>
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      let v = parseFloat(this.value);
      if (!isFinite(v) || v < 50) v = 50;
      if (v > 4800) v = 4800;
      presets[pi].width = v;
      this.value = Math.round(v);
      if (document.getElementById("prBothSides")?.checked) {
        const otherSide = activeSide === "left" ? "right" : "left";
        const op = sideData[otherSide].presets;
        if (op && op[pi] && op[pi].type === presets[pi].type) {
          op[pi].width = v;
        }
      }
      lvOnChange();
    }),
  );
  tbl.querySelectorAll(".prCut").forEach((sel) =>
    sel.addEventListener("change", function () {
      presets[+this.dataset.pi].cutoff = +this.value;
      lvOnChange();
    }),
  );
  applyMobileReadonly(tbl);
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
  const corr = elTestData().correction;
  const pc = getTotalPresetCurve();
  const measV = act.map((i) => corr[i]);
  const manV = act.map((i) => elektrodenlautstaerkeSchieber[i]);
  const preV = act.map((i) => pc[i]);
  const sumV = act.map(
    (_, j) =>
      (showMeas ? measV[j] : 0) +
      (showMan ? manV[j] : 0) +
      (showPre ? preV[j] : 0),
  );
  const yMx = 20;
  const pad = { left: 42, right: 16, top: 16, bottom: 44 },
    pW = W - pad.left - pad.right,
    pH = H - pad.top - pad.bottom;
  const zY = pad.top + pH / 2;
  const axis = buildCentAxis(act, pad.left, pW, function (i) {
    return effFreqDisplay(i);
  });
  const tX = axis.tX;
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
  cv._axisHits = [];
  for (let j = 0; j < act.length; j++) {
    ctx.fillStyle = act[j] === refEl ? "#2563eb" : "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const yE = H - pad.bottom + 12,
          yHz = H - pad.bottom + 22,
          yCent = H - pad.bottom + 32;
    const lbl = dENPrefix() + dEN(act[j]);
    ctx.fillText(lbl, tX(j), yE);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    const lvF = axis.hzArr[j];
    ctx.fillText(
      lvF >= 1000 ? (lvF / 1000).toFixed(1) + "k" : Math.round(lvF),
      tX(j),
      yHz,
    );
    if (j % axis.step === 0 || j === 0 || j === act.length - 1) {
      const c = Math.round(axis.centArr[j]);
      ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", tX(j), yCent);
    }
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: tX(j) - halfDx, x1: tX(j) + halfDx,
      y0: H - pad.bottom + 2, y1: H - pad.bottom + 40,
      label: lbl,
      hz: axis.hzArr[j],
      cent: axis.centArr[j],
    });
  }
  _attachAxisTooltip(cv);
}
