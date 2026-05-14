// ============================================================
// CHART
// ============================================================
function drawChart(cv, vals, res, isOff, elColor) {
  const ctx = cv.getContext("2d"),
    dpr = window.devicePixelRatio || 1,
    w = cv.parentElement.clientWidth - 32,
    h = 320;
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  ctx.scale(dpr, dpr);
  const pad = { top: 30, right: 20, bottom: 55, left: 55 },
    pW = w - pad.left - pad.right,
    pH = h - pad.top - pad.bottom;
  ctx.clearRect(0, 0, w, h);
  const act = actEl(),
    allE = allEl(),
    aV = act.map((i) => vals[i]),
    aR = res ? act.map((i) => res[i]) : null;
  let yMn, yMx;
  if (isOff) {
    let am = Math.max(Math.ceil(Math.max(...aV.map(Math.abs), 1)), 5);
    if (aR)
      am = Math.max(
        am,
        Math.ceil(Math.max(...act.map((i) => Math.abs(vals[i]) + res[i]))),
      );
    yMn = -am;
    yMx = am;
  } else {
    yMn = Math.min(0, ...aV);
    yMx = Math.max(0, ...aV);
    const r = yMx - yMn || 1;
    yMn -= r * 0.1;
    yMx += r * 0.1;
  }
  const xS = pW / (allE.length - 1 || 1),
    tX = (i) => pad.left + i * xS,
    tY = (v) => pad.top + (yMx - v) * (pH / (yMx - yMn || 1));
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const v = yMn + ((yMx - yMn) * i) / 5,
      y = tY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "10px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText(v.toFixed(1), pad.left - 8, y + 4);
  }
  if (yMn < 0 && yMx > 0) {
    ctx.strokeStyle = "#aaa";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, tY(0));
    ctx.lineTo(w - pad.right, tY(0));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const bW = Math.min(xS * 0.6, 34);
  const colorMap = {
    green: "#16a34a",
    yellow: "#d97706",
    red: "#dc2626",
    grey: "#9ca3af",
  };
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j],
      v = vals[i] || 0,
      x = tX(j) - bW / 2,
      yZ = tY(0),
      yV = tY(v);
    const col = elColor
      ? colorMap[elColor(i) || "grey"]
      : v > 0.05
        ? "#2563eb"
        : v < -0.05
          ? "#dc2626"
          : "#9ca3af";
    ctx.fillStyle = col;
    ctx.fillRect(x, Math.min(yZ, yV), bW, Math.abs(yV - yZ) || 2);
    if (res && res[i] > 0 && act.includes(i)) {
      const r = res[i],
        yt = tY(v + r),
        yb = tY(v - r);
      ctx.strokeStyle = "#00000044";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tX(j), yt);
      ctx.lineTo(tX(j), yb);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tX(j) - 4, yt);
      ctx.lineTo(tX(j) + 4, yt);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tX(j) - 4, yb);
      ctx.lineTo(tX(j) + 4, yb);
      ctx.stroke();
    }
    ctx.fillStyle = i === refEl ? "#2563eb" : "#555";
    ctx.font = (i === refEl ? "bold " : "") + "10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(dENPrefix() + dEN(i), tX(j), h - pad.bottom + 14);
    ctx.font = "8px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(effFreq(i)), tX(j), h - pad.bottom + 25);
    if (j === 0) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("apikal"), tX(j), h - pad.bottom + 36);
    }
    if (j === allE.length - 1) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("basal"), tX(j), h - pad.bottom + 36);
    }
  }
  ctx.strokeStyle = "#2563eb44";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let first = true;
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    if (!act.includes(i)) continue;
    if (first) {
      ctx.moveTo(tX(j), tY(vals[i]));
      first = false;
    } else ctx.lineTo(tX(j), tY(vals[i]));
  }
  ctx.stroke();
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    if (!act.includes(i)) continue;
    ctx.beginPath();
    ctx.arc(tX(j), tY(vals[i]), 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(12, pad.top + pH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "#666";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("dB", 0, 0);
  ctx.restore();
}


// ============================================================
// FREQ MATCH CHART
// ============================================================
function drawFreqMatchChart(cv, fResData) {
  const ctx = cv.getContext("2d"),
    dpr = window.devicePixelRatio || 1,
    w = cv.parentElement.clientWidth - 32,
    h = 360;
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  ctx.scale(dpr, dpr);

  const pad = { top: 30, right: 30, bottom: 60, left: 70 },
    pW = w - pad.left - pad.right,
    pH = h - pad.top - pad.bottom;
  ctx.clearRect(0, 0, w, h);

  if (!fResData || fResData.length === 0) return;

  const allFreqs = fResData.flatMap((r) => [r.varFreq, r.refFreq]);
  const rawMin = Math.min(...allFreqs),
    rawMax = Math.max(...allFreqs);
  const logMin = Math.log2(rawMin) - 0.15,
    logMax = Math.log2(rawMax) + 0.15;
  const logRange = logMax - logMin || 1;

  const tX = (hz) => pad.left + ((Math.log2(hz) - logMin) / logRange) * pW;
  const tY = (hz) => pad.top + ((logMax - Math.log2(hz)) / logRange) * pH;

  const gridFreqs = [100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000];
  const visibleGrid = gridFreqs.filter(
    (f) => Math.log2(f) >= logMin - 0.05 && Math.log2(f) <= logMax + 0.05,
  );

  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (const f of visibleGrid) {
    const x = tX(f), y = tY(f);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + pH);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + pW, y);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "center";
    const label = f >= 1000 ? (f / 1000) + "k" : String(f);
    ctx.fillText(label, x, pad.top + pH + 14);
    ctx.textAlign = "right";
    ctx.fillText(label, pad.left - 6, y + 4);
  }

  // Diagonale: refFreq = varFreq
  const dMin = Math.pow(2, logMin), dMax = Math.pow(2, logMax);
  ctx.strokeStyle = "#aaaaaa";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(tX(dMin), tY(dMin));
  ctx.lineTo(tX(dMax), tY(dMax));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#aaa";
  ctx.font = "9px Segoe UI,sans-serif";
  ctx.textAlign = "left";
  const diagLabelX = Math.min(tX(dMax) - 70, pad.left + pW - 80);
  ctx.fillText(t("fmrChartDiagonal"), diagLabelX, tY(dMax) - 6);

  // Verbindungslinie
  const sorted = [...fResData].sort((a, b) => a.elIdx - b.elIdx);
  ctx.strokeStyle = "#2563eb44";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let first = true;
  for (const r of sorted) {
    const x = tX(r.varFreq), y = tY(r.refFreq);
    if (first) { ctx.moveTo(x, y); first = false; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Messpunkte + Hitboxen
  const hitboxes = [];
  for (const r of sorted) {
    const x = tX(r.varFreq), y = tY(r.refFreq);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    hitboxes.push({ x, y, r });
  }

  // Achsenbeschriftungen
  ctx.fillStyle = "#666";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t("fmrChartXLabel"), pad.left + pW / 2, h - pad.bottom + 36);
  ctx.save();
  ctx.translate(13, pad.top + pH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(t("fmrChartYLabel"), 0, 0);
  ctx.restore();

  cv._fmcHitboxes = hitboxes;
}

function _fmcTooltipHandler(cv, e) {
  if (!cv._fmcHitboxes) return;
  const rect = cv.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1,
    scaleX = (cv.width / dpr) / rect.width,
    scaleY = (cv.height / dpr) / rect.height,
    mx = (e.clientX - rect.left) * scaleX,
    my = (e.clientY - rect.top) * scaleY;
  let tip = document.getElementById("fmcTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "fmcTooltip";
    tip.style.cssText =
      "position:fixed;background:#1e293b;color:#f8fafc;padding:6px 10px;" +
      "border-radius:6px;font-size:0.82em;pointer-events:none;display:none;" +
      "z-index:1000;line-height:1.6;white-space:nowrap;";
    document.body.appendChild(tip);
  }
  const hit = cv._fmcHitboxes.find((h) => Math.hypot(h.x - mx, h.y - my) <= 10);
  if (hit) {
    const r = hit.r;
    const elNum = withSide(r.varSide, () => dEN(r.elIdx));
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    const varLabel = r.varSide === "left" ? t("sideLeft") : t("sideRight");
    const refLabel = r.refSide === "left" ? t("sideLeft") : t("sideRight");
    tip.innerHTML =
      "<b>E" + elNum + "</b> (" + varLabel + ")<br>" +
      "CI: " + Math.round(r.varFreq) + " Hz<br>" +
      "Subj.: " + Math.round(r.refFreq) + " Hz (" + refLabel + ")<br>" +
      "Diff: " + (cent >= 0 ? "+" : "") + Math.round(cent) + "\u202f" + t("fmCentUnit");
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
}
