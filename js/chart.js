// Zeichnet eine deaktivierte/gemute Elektrode als hellgrauen
// Vollbalken mit dunkler X-Diagonale. Wird von chart.js
// (drawChart) und lr-balance.js (lrDrawChart) genutzt. NICHT für
// drawFreqMatchChart geeignet (dort log-Hz-Achse).
function drawDisabledBar(ctx, x, yTop, yBot, bW) {
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x, yTop, bW, yBot - yTop);
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x + bW, yBot);
  ctx.moveTo(x + bW, yTop);
  ctx.lineTo(x, yBot);
  ctx.stroke();
}

function _drawRefElLabel(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.font = "bold " + (size || 11) + "px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Ref.-El.", x, y);
  ctx.restore();
}

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
  if (typeof refEl !== "undefined" && refEl !== null) {
    const jRef = allE.indexOf(refEl);
    if (jRef >= 0) {
      _drawRefElLabel(ctx, tX(jRef), pad.top - 4);
    }
  }
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j],
      v = vals[i] || 0,
      x = tX(j) - bW / 2,
      yZ = tY(0),
      yV = tY(v);

    const isDisabled = (typeof elExDur !== 'undefined' && elExDur[i] !== null)
                    || (typeof elSt    !== 'undefined' && elSt[i] === 'mute');

    if (isDisabled) {
      drawDisabledBar(ctx, x, pad.top, pad.top + pH, bW);
    } else {
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

  // X-Achse: log-Hz über die CI-Frequenzen (varFreq)
  const xMinHz = Math.min(...fResData.map((r) => r.varFreq));
  const xMaxHz = Math.max(...fResData.map((r) => r.varFreq));
  const logMin = Math.log2(xMinHz) - 0.15,
        logMax = Math.log2(xMaxHz) + 0.15,
        logRange = logMax - logMin || 1;
  const tX = (hz) => pad.left + ((Math.log2(hz) - logMin) / logRange) * pW;

  // Y-Achse: lineare Cent-Abweichung, symmetrisch um 0
  const cents = fResData.map((r) => 1200 * Math.log2(r.refFreq / r.varFreq));
  const absC  = Math.max(Math.ceil(Math.max(...cents.map(Math.abs), 50) / 50) * 50, 50);
  const yMin = -absC, yMax = absC;
  const tY = (c) => pad.top + ((yMax - c) / (yMax - yMin)) * pH;

  // X-Grid: Hz-Linien
  const gridFreqs = [100, 200, 300, 500, 700, 1000, 1500, 2000, 3000, 4000, 6000, 8000, 10000];
  const visibleGrid = gridFreqs.filter(
    (f) => Math.log2(f) >= logMin - 0.05 && Math.log2(f) <= logMax + 0.05,
  );
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  for (const f of visibleGrid) {
    const x = tX(f);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + pH);
    ctx.stroke();
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "center";
    const label = f >= 1000 ? (f / 1000) + "k" : String(f);
    ctx.fillText(label, x, pad.top + pH + 14);
  }

  // Y-Grid: Cent-Linien (Schritte je nach absC)
  const step = absC <= 100 ? 25 : absC <= 300 ? 50 : absC <= 600 ? 100 : 200;
  for (let c = -absC; c <= absC; c += step) {
    const y = tY(c);
    ctx.strokeStyle = (c === 0) ? "#888" : "#e5e5e5";
    ctx.lineWidth   = (c === 0) ? 1.5   : 1;
    if (c === 0) ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.left,        y);
    ctx.lineTo(pad.left + pW,   y);
    ctx.stroke();
    if (c === 0) ctx.setLineDash([]);
    ctx.fillStyle = "#999";
    ctx.font = "9px Consolas,monospace";
    ctx.textAlign = "right";
    ctx.fillText((c >= 0 ? "+" : "") + c, pad.left - 6, y + 3);
  }

  // Verbindungslinie zwischen Messpunkten (sortiert nach varFreq)
  const sorted = [...fResData].sort((a, b) => a.varFreq - b.varFreq);
  ctx.strokeStyle = "#2563eb44";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let first = true;
  for (const r of sorted) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    const x = tX(r.varFreq), y = tY(cent);
    if (first) { ctx.moveTo(x, y); first = false; }
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Messpunkte + Hitboxen
  const hitboxes = [];
  for (const r of sorted) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    const x = tX(r.varFreq), y = tY(cent);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#2563eb";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
    hitboxes.push({ x, y, r });
  }

  // Aktiv-ungemessene und deaktivierte Elektroden der CI-Seite einzeichnen
  if (fResData.length > 0) {
    const ciSide = fResData[fResData.length - 1].varSide;
    const nCi    = sideData[ciSide].nEl;
    const measuredIdx = new Set(fResData.map((r) => r.elIdx));
    for (let i = 0; i < nCi; i++) {
      if (measuredIdx.has(i)) continue;
      const exCI = sideData[ciSide].elExDur[i] !== null || sideData[ciSide].elSt[i] === 'mute';
      const hzCi = withSide(ciSide, () => effFreq(i));
      if (hzCi < Math.pow(2, logMin) || hzCi > Math.pow(2, logMax)) continue;
      const x = tX(hzCi);
      if (exCI) {
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, pad.top);
        ctx.lineTo(x, pad.top + pH);
        ctx.stroke();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 1.5;
        const ySize = 5;
        ctx.beginPath();
        ctx.moveTo(x - ySize, tY(0) - ySize);
        ctx.lineTo(x + ySize, tY(0) + ySize);
        ctx.moveTo(x + ySize, tY(0) - ySize);
        ctx.lineTo(x - ySize, tY(0) + ySize);
        ctx.stroke();
      } else {
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x, tY(0), 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
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
