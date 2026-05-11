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
    ctx.fillText("E" + dEN(i), tX(j), h - pad.bottom + 14);
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

