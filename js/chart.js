// Zeichnet eine deaktivierte/gemute Elektrode als hellgrauen
// Vollbalken mit dunkler X-Diagonale. Wird von chart.js
// (ELL_drawChart) und stereobalance-balance.js (STB_drawChart) genutzt. NICHT für
// drawFRQChart geeignet (dort log-Hz-Achse).
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
// Cent-x-Achse — Hilfsfunktionen (gemeinsam für ELL_drawChart und
// kurvenELLChartZeichnen). Elektroden werden nach ihrer Cent-Position
// (re 1000 Hz) auf der x-Achse plaziert; mindestens zwei
// Elektroden, sonst lineare Notlösung.
// ============================================================

// Gleichmäßige x-Verteilung der Elektroden über die Plot-Breite
// (elektrodennummern-basiert). Verwendet von ELL_drawChart (Meßergebnisse
// Loudness) und STB_drawChart (Stereo-Balance) seit Bauanleitung 67.
// Liefert zusätzlich hzArr (per FRQ_implantatEffektiv oder optionalem hzGetter) für
// die Hz-Beschriftung unter der x-Achse.
function buildLinearAxis(electrodes, padLeft, plotW, hzGetter) {
  const getHz = hzGetter || FRQ_implantatEffektiv;
  const hzArr = electrodes.map(function (i) { return getHz(i); });
  const n = electrodes.length;
  if (n === 0) return { tX: function () { return padLeft; }, minDx: 0, hzArr: hzArr };
  if (n === 1) return {
    tX: function () { return padLeft + plotW / 2; },
    minDx: plotW, hzArr: hzArr,
  };
  const dx = plotW / n;
  const tX = function (j) { return padLeft + dx * (j + 0.5); };
  return { tX: tX, minDx: dx, hzArr: hzArr };
}

function buildCentAxis(electrodes, padLeft, plotW, hzGetter) {
  const getHz = hzGetter || FRQ_implantatEffektiv;
  const hzArr = electrodes.map(function (i) { return getHz(i); });
  const centArr = hzArr.map(hzToCent);
  let cMin = Math.min.apply(null, centArr),
      cMax = Math.max.apply(null, centArr);
  if (!isFinite(cMin) || !isFinite(cMax) || cMin === cMax) {
    cMin = (cMin || 0) - 600;
    cMax = (cMax || 0) + 600;
  }
  const span = cMax - cMin || 1;
  const tX = function (j) {
    return padLeft + ((centArr[j] - cMin) / span) * plotW;
  };
  let minDx = Infinity;
  for (let j = 1; j < electrodes.length; j++) {
    minDx = Math.min(minDx, tX(j) - tX(j - 1));
  }
  if (!isFinite(minDx)) minDx = plotW;
  const step = minDx < 14 ? 3 : minDx < 22 ? 2 : 1;
  return { tX: tX, centArr: centArr, hzArr: hzArr, minDx: minDx, step: step };
}

// Tooltip-Anbindung für die x-Achse. Hitboxes werden vom Caller
// pro Draw in cv._axisHits gesetzt (Array von
// { x0,x1,y0,y1, label, hz, cent }). Der Handler wird pro Canvas
// nur einmal registriert.
function _attachAxisTooltip(cv) {
  if (cv._axisHoverInit) return;
  cv._axisHoverInit = true;
  cv.addEventListener("mousemove", function (e) { _axisTooltipHandler(cv, e); });
  cv.addEventListener("mouseleave", function () {
    const tip = document.getElementById("axisTooltip");
    if (tip) tip.style.display = "none";
  });
}

function _axisTooltipHandler(cv, e) {
  if (!cv._axisHits || !cv._axisHits.length) return;
  const rect = cv.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  const scaleX = (cv.width / dpr) / rect.width;
  const scaleY = (cv.height / dpr) / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  let tip = document.getElementById("axisTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "axisTooltip";
    tip.style.cssText =
      "position:fixed;background:#1e293b;color:#f8fafc;padding:6px 10px;" +
      "border-radius:6px;font-size:0.82em;pointer-events:none;display:none;" +
      "z-index:1000;line-height:1.5;white-space:nowrap;";
    document.body.appendChild(tip);
  }
  const hit = cv._axisHits.find(function (h) {
    return mx >= h.x0 && mx <= h.x1 && my >= h.y0 && my <= h.y1;
  });
  if (hit) {
    const elLbl = (typeof t === "function" ? t("schieberELLElLabel") : "Elektrode");
    let html = "<b>" + elLbl + " " + hit.label + "</b>";
    if (hit.hz != null && isFinite(hit.hz)) {
      const hzTxt = hit.hzDec ? hit.hz.toFixed(hit.hzDec) : Math.round(hit.hz);
      html += "<br>" + hzTxt + " Hz";
    }
    if (hit.db != null && isFinite(hit.db)) {
      html += "<br>" + (hit.db >= 0 ? "+" : "") + hit.db.toFixed(1) + " dB";
    } else if (hit.cent != null && isFinite(hit.cent)) {
      html += "<br>" + (hit.cent >= 0 ? "+" : "") + Math.round(hit.cent) + " ¢";
    }
    tip.innerHTML = html;
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
}

// ============================================================
// CHART
// ============================================================
function ELL_drawChart(cv, vals, res, isOff, ell_color, ctx) {
  ctx = ctx || {};
  var _nEl      = (ctx.nEl       != null) ? ctx.nEl       : nEl;
  var _elSt     = (ctx.elSt      != null) ? ctx.elSt      : elSt;
  var _elExDur  = (ctx.elExDur   != null) ? ctx.elExDur   : elExDur;
  var _refEl    = (ctx.ELL_refEl != null) ? ctx.ELL_refEl : (typeof ELL_refEl !== "undefined" ? ELL_refEl : null);
  var _hzGetter = ctx.hzGetter || null;
  var _dEN       = ctx.dEN       || dEN;
  var _dENPrefix = ctx.dENPrefix || dENPrefix;

  var allE = [];
  for (var _i = 0; _i < _nEl; _i++) allE.push(_i);
  var act = allE.filter(function (i) {
    return _elExDur[i] === null && _elSt[i] !== "mute";
  });

  const ctx2d = cv.getContext("2d"),
    dpr = window.devicePixelRatio || 1,
    w = cv.parentElement.clientWidth - 32,
    h = 320;
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  ctx2d.scale(dpr, dpr);
  const pad = { top: 30, right: 20, bottom: 57, left: 55 },
    pW = w - pad.left - pad.right,
    pH = h - pad.top - pad.bottom;
  ctx2d.clearRect(0, 0, w, h);
  const aV = act.map((i) => vals[i]),
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
  const axis = buildLinearAxis(allE, pad.left, pW, _hzGetter),
    tX = axis.tX,
    xS = axis.minDx,
    tY = (v) => pad.top + (yMx - v) * (pH / (yMx - yMn || 1));
  ctx2d.strokeStyle = "#e5e5e5";
  ctx2d.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const v = yMn + ((yMx - yMn) * i) / 5,
      y = tY(v);
    ctx2d.beginPath();
    ctx2d.moveTo(pad.left, y);
    ctx2d.lineTo(w - pad.right, y);
    ctx2d.stroke();
    ctx2d.fillStyle = "#999";
    ctx2d.font = "10px Consolas,monospace";
    ctx2d.textAlign = "right";
    ctx2d.fillText(v.toFixed(1), pad.left - 8, y + 4);
  }
  if (yMn < 0 && yMx > 0) {
    ctx2d.strokeStyle = "#aaa";
    ctx2d.lineWidth = 1.5;
    ctx2d.setLineDash([4, 3]);
    ctx2d.beginPath();
    ctx2d.moveTo(pad.left, tY(0));
    ctx2d.lineTo(w - pad.right, tY(0));
    ctx2d.stroke();
    ctx2d.setLineDash([]);
  }
  const bW = Math.min(xS * 0.6, 34);
  const colorMap = {
    green: "#16a34a",
    yellow: "#d97706",
    red: "#dc2626",
    grey: "#9ca3af",
  };
  if (_refEl !== null) {
    const jRef = allE.indexOf(_refEl);
    if (jRef >= 0) {
      _drawRefElLabel(ctx2d, tX(jRef), pad.top - 4);
    }
  }
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j],
      v = vals[i] || 0,
      x = tX(j) - bW / 2,
      yZ = tY(0),
      yV = tY(v);

    const isDisabled = _elExDur[i] !== null || _elSt[i] === "mute";

    if (isDisabled) {
      drawDisabledBar(ctx2d, x, pad.top, pad.top + pH, bW);
    } else {
      const col = ell_color
        ? colorMap[ell_color(i) || "grey"]
        : v > 0.05
          ? "#2563eb"
          : v < -0.05
            ? "#dc2626"
            : "#9ca3af";
      ctx2d.fillStyle = col;
      ctx2d.fillRect(x, Math.min(yZ, yV), bW, Math.abs(yV - yZ) || 2);
      if (res && res[i] > 0 && act.includes(i)) {
        const r = res[i],
          yt = tY(v + r),
          yb = tY(v - r);
        ctx2d.strokeStyle = "#00000044";
        ctx2d.lineWidth = 1.5;
        ctx2d.beginPath();
        ctx2d.moveTo(tX(j), yt);
        ctx2d.lineTo(tX(j), yb);
        ctx2d.stroke();
        ctx2d.beginPath();
        ctx2d.moveTo(tX(j) - 4, yt);
        ctx2d.lineTo(tX(j) + 4, yt);
        ctx2d.stroke();
        ctx2d.beginPath();
        ctx2d.moveTo(tX(j) - 4, yb);
        ctx2d.lineTo(tX(j) + 4, yb);
        ctx2d.stroke();
      }
    }

    ctx2d.fillStyle = i === _refEl ? "#2563eb" : "#555";
    ctx2d.font = (i === _refEl ? "bold " : "") + "10px Segoe UI,sans-serif";
    ctx2d.textAlign = "center";
    const yE = h - pad.bottom + 14,
          yHz = h - pad.bottom + 25,
          yAB = h - pad.bottom + 38;
    ctx2d.fillText(_dENPrefix() + _dEN(i), tX(j), yE);
    ctx2d.font = "8px Consolas,monospace";
    ctx2d.fillStyle = "#999";
    ctx2d.fillText(Math.round(axis.hzArr[j]), tX(j), yHz);
    if (j === 0) {
      ctx2d.font = "8px Segoe UI,sans-serif";
      ctx2d.fillText(t("apikal"), tX(j), yAB);
    }
    if (j === allE.length - 1) {
      ctx2d.font = "8px Segoe UI,sans-serif";
      ctx2d.fillText(t("basal"), tX(j), yAB);
    }
  }
  cv._axisHits = [];
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    const cx = tX(j);
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: cx - halfDx, x1: cx + halfDx,
      y0: h - pad.bottom + 2, y1: h - pad.bottom + 34,
      label: _dENPrefix() + _dEN(i),
      hz: axis.hzArr[j],
      // cent fehlt absichtlich — Tooltip zeigt seit BA 67 nur noch Hz
    });
  }
  _attachAxisTooltip(cv);
  ctx2d.strokeStyle = "#2563eb44";
  ctx2d.lineWidth = 2;
  ctx2d.beginPath();
  let first = true;
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    if (!act.includes(i)) continue;
    if (first) {
      ctx2d.moveTo(tX(j), tY(vals[i]));
      first = false;
    } else ctx2d.lineTo(tX(j), tY(vals[i]));
  }
  ctx2d.stroke();
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    if (!act.includes(i)) continue;
    ctx2d.beginPath();
    ctx2d.arc(tX(j), tY(vals[i]), 3.5, 0, Math.PI * 2);
    ctx2d.fillStyle = "#2563eb";
    ctx2d.fill();
    ctx2d.strokeStyle = "#fff";
    ctx2d.lineWidth = 2;
    ctx2d.stroke();
  }
  ctx2d.save();
  ctx2d.translate(12, pad.top + pH / 2);
  ctx2d.rotate(-Math.PI / 2);
  ctx2d.fillStyle = "#666";
  ctx2d.font = "10px Segoe UI,sans-serif";
  ctx2d.textAlign = "center";
  ctx2d.fillText("dB", 0, 0);
  ctx2d.restore();
}


// Pfeil mit gefüllter Spitze; headAtEnd=false → Spitze in der Mitte, true → Spitze am Ende
function drawArrow(ctx, x1, y1, x2, y2, color, headAtEnd = false, lineWidth = 1.5) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLen = 8;
  if (headAtEnd) {
    // Schaft bis kurz vor Spitze
    const xEnd = x2 - (headLen * 0.6) * Math.cos(angle);
    const yEnd = y2 - (headLen * 0.6) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 5), y2 - headLen * Math.sin(angle - Math.PI / 5));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 5), y2 - headLen * Math.sin(angle + Math.PI / 5));
  } else {
    // Schaft (durchgehend), Spitze in der Mitte
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx - headLen * Math.cos(angle - Math.PI / 5), my - headLen * Math.sin(angle - Math.PI / 5));
    ctx.lineTo(mx - headLen * Math.cos(angle + Math.PI / 5), my - headLen * Math.sin(angle + Math.PI / 5));
  }
  ctx.closePath();
  ctx.fill();
}

// Kleines gelb-oranges Warndreieck mit Ausrufezeichen (Klavier-Sonderfaelle
// piano-crossed/-wide). (cx,cy) = obere Spitze des Dreiecks.
function drawWarnTriangle(ctx, cx, cy) {
  const w = 9, hgt = 8;
  ctx.save();
  ctx.fillStyle = "#f59e0b";
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - w / 2, cy + hgt);
  ctx.lineTo(cx + w / 2, cy + hgt);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ausrufezeichen
  ctx.fillStyle = "#3b2600";
  ctx.font = "bold 6px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", cx, cy + hgt * 0.62);
  ctx.restore();
}


// ============================================================
// FREQ GRAPH ENGINE (BA456, Architektur 00-frequenzgraph-engine)
// Eine Zeichenfunktion fuer Ergebnis- UND Bandgraph. Kennt KEINEN
// Graph-Typ: zeichnet je Zeile, was die Zeile traegt; Abweichungen
// kommen aus cfg. rows/cfg-Vertrag: siehe Architektur-Kapitel Sec. 4/5.
// ============================================================
function drawFRQGraph(cv, rows, cfg) {
  cfg = cfg || {};
  rows = (rows || []).filter(function (r) { return r && r.sichtbar; });
  const ctx = cv.getContext("2d");

  // --- Groesse: fixedSize (Druck) oder Bildschirm (h=420) ---
  const fixed = cfg.fixedSize || null;
  let w, h, dpr;
  if (fixed) {
    dpr = fixed.dpr || 2; w = fixed.w; h = fixed.h;
  } else {
    dpr = window.devicePixelRatio || 1;
    w = cv.parentElement.clientWidth - 32;
    h = 420;
  }
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + "px"; cv.style.height = h + "px";
  ctx.setTransform(1, 0, 0, 1, 0, 0);   // Reset vor scale (mehrfach-Aufruf sicher)
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 80, right: 30, bottom: 54, left: 70 };
  const pW = w - pad.left - pad.right;
  const pH = h - pad.top - pad.bottom;

  cv._frqg_rows = rows;
  cv._frqg_cfg  = cfg;
  if (rows.length === 0) return;

  // Eine hzToCt-Definition (Architektur: zentral, nicht dupliziert).
  const REF_HZ = 1000;
  const hzToCt = (hz) => 1200 * Math.log2(hz / REF_HZ);

  // Cent-Werte je Zeile vorrechnen.
  rows.forEach(function (r) {
    r._cL = hzToCt(r.xLinksHz);
    r._cR = hzToCt(r.xRechtsHz);
    r._cLo = (r.bandLoHz != null) ? hzToCt(r.bandLoHz) : null;
    r._cHi = (r.bandHiHz != null) ? hzToCt(r.bandHiHz) : null;
  });

  // --- X-Achse: feste Wand (Hersteller-Spanne) oder aus rows gespannt ---
  let cMin, cMax;
  if (cfg.xWandHz && cfg.xWandHz.length === 2) {
    cMin = hzToCt(cfg.xWandHz[0]); cMax = hzToCt(cfg.xWandHz[1]);
  } else {
    cMin = Infinity; cMax = -Infinity;
    rows.forEach(function (r) {
      [r._cL, r._cR, r._cLo, r._cHi].forEach(function (c) {
        if (c == null) return;
        if (c < cMin) cMin = c; if (c > cMax) cMax = c;
      });
    });
    const pad0 = Math.max(100, (cMax - cMin) * 0.08);
    cMin -= pad0; cMax += pad0;
  }
  const cRange = (cMax - cMin) || 1;
  const tX = (c) => pad.left + ((c - cMin) / cRange) * pW;

  // --- Y-Achse: symmetrisch um 0. yMaxFest (Koordinator) oder selbst. ---
  let absC;
  if (typeof cfg.yMaxFest === "number") {
    absC = cfg.yMaxFest;
  } else {
    const ext = [];
    rows.forEach(function (r) {
      if (r.yCent == null) return;
      ext.push(Math.abs(r.yCent) + (r.residuumCent > 0 ? r.residuumCent : 0));
    });
    absC = Math.max(Math.ceil(Math.max.apply(null, ext.concat([50])) / 50) * 50, 50);
  }
  const yMin = -absC, yMax = absC;
  const tY = (c) => pad.top + ((yMax - c) / (yMax - yMin)) * pH;

  // Farbe kommt jetzt vom Aufrufer als benannte Stufe (row.stufe):
  // "gruen"/"amber"/"rot". Die Engine mappt nur, sie bewertet nicht.
  // Fehlt die Stufe -> Neutralgrau (unbewertet, taeuscht keine Bewertung vor).
  const STUFE_FARBE = { gruen: "#16a34a", amber: "#d97706", rot: "#dc2626" };
  const farbeFuer = function (r) {
    return STUFE_FARBE[r && r.stufe] || "#9ca3af";
  };

  // ============================================================
  // (1) BANDFLAECHEN — nur Zeilen mit Bandgrenzen. Hintergrund, dezent,
  //     abwechselnd getoent, volle Hoehe. Palette aus dem Provisorium.
  // ============================================================
  const palette = ["#dbeafe", "#bfdbfe", "#c7d2fe", "#a5b4fc"];
  const bandRows = rows.filter(function (r) { return r._cLo != null && r._cHi != null; })
                       .sort(function (a, b) { return a._cLo - b._cLo; });
  bandRows.forEach(function (r, i) {
    const xL = tX(r._cLo), xR = tX(r._cHi);
    ctx.fillStyle = palette[i % palette.length];
    ctx.globalAlpha = 0.5;   // dezent: Striche/Punkt liegen klar darueber
    ctx.fillRect(xL, pad.top, xR - xL, pH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
    ctx.strokeRect(xL, pad.top, xR - xL, pH);
  });

  // ============================================================
  // (2) AMBERBAND — schmales SENKRECHTES Band, Breite = Residuum in
  //     X-Richtung (Cent, die X-Achse ist Cent-linear via tX), an der
  //     Punkt-X-Position (_cR), volle Hoehe. NUR wenn cfg.amberband
  //     (Ergebnisgraph). Vor dem Grid, hinter Strichen/Punkten. Der
  //     T-Balken selbst kommt in Abschnitt (4).
  // ============================================================
  const anker = (cfg.residuumAnker === "nulllinie") ? "nulllinie" : "punkt";
  if (cfg.amberband) {
    rows.forEach(function (r) {
      if (!(r.residuumCent > 0)) return;
      const xa = tX(r._cR - r.residuumCent);
      const xb = tX(r._cR + r.residuumCent);
      ctx.fillStyle = "rgba(245, 158, 11, 0.18)";
      ctx.fillRect(xa, pad.top, xb - xa, pH);
    });
  }

  // --- Y-Grid + Beschriftung ---
  ctx.font = "10px Consolas,monospace"; ctx.textAlign = "right";
  const yLabels = [0];
  for (let c = 100; c <= absC; c += 100) yLabels.push(c, -c);
  yLabels.forEach(function (c) {
    const y = tY(c);
    if (c !== 0) {
      ctx.strokeStyle = "#e5e5e5"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + pW, y); ctx.stroke();
    }
    ctx.fillStyle = "#000";
    ctx.fillText(c === 0 ? "0" : ((c > 0 ? "+" : "") + c), pad.left - 6, y + 3);
  });

  // ============================================================
  // (3) SENKRECHTE STRICHE — links + rechts je Zeile. Kein festes
  //     links/rechts: beide gleichwertig gezeichnet.
  // ============================================================
  rows.forEach(function (r) {
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(tX(r._cL), pad.top); ctx.lineTo(tX(r._cL), pad.top + pH); ctx.stroke();
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.75;
    ctx.beginPath(); ctx.moveTo(tX(r._cR), pad.top); ctx.lineTo(tX(r._cR), pad.top + pH); ctx.stroke();
  });

  // --- Nullinie ---
  ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(pad.left, tY(0)); ctx.lineTo(pad.left + pW, tY(0)); ctx.stroke();

  // ============================================================
  // (9) VERBINDUNGSLINIE (blau) durch die Punkte — wenn cfg.verbindung.
  // ============================================================
  if (cfg.verbindung) {
    const pts = rows.filter(function (r) { return r.yCent != null; })
                    .sort(function (a, b) { return a._cR - b._cR; });
    if (pts.length > 1) {
      ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tX(pts[0]._cR), tY(pts[0].yCent));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(tX(pts[i]._cR), tY(pts[i].yCent));
      ctx.stroke();
    }
  }

  // ============================================================
  // (9a) KONSISTENZ-LINIE: gestrichelt, violett, durch alle Zeilen mit
  //      konsistenzCent (Architektur-Engine §4 Punkt 9a). Entfaellt, wenn
  //      keine Zeile das Feld traegt. Kein cfg-Flag -- Datenanwesenheit.
  // ============================================================
  var konsPts = rows.filter(function (r) { return r.konsistenzCent != null; })
                    .sort(function (a, b) { return a._cL - b._cL; });
  if (konsPts.length > 1) {
    ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(tX(konsPts[0]._cL), tY(konsPts[0].konsistenzCent));
    for (var kp = 1; kp < konsPts.length; kp++) {
      ctx.lineTo(tX(konsPts[kp]._cL), tY(konsPts[kp].konsistenzCent));
    }
    ctx.stroke();
    ctx.setLineDash([]);   // Dash zuruecksetzen fuer nachfolgende Zeichnung
  }

  // ============================================================
  // (4)+(6) PUNKT (gruen/rot) + Residuum-T-Balken (nur Anker=punkt).
  //         Hitboxen fuer Mouseover.
  // ============================================================
  const hitboxes = [];
  rows.forEach(function (r) {
    if (r.yCent == null) {
      // Leer-Marker auf der Nullinie an der xLinks-Position (Ist).
      if (r.marker) {
        const xm = tX(r._cL), ym = tY(0);
        if (r.marker === "ausgeschlossen") {
          ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1.75;
          const s = 5;
          ctx.beginPath();
          ctx.moveTo(xm - s, ym - s); ctx.lineTo(xm + s, ym + s);
          ctx.moveTo(xm + s, ym - s); ctx.lineTo(xm - s, ym + s);
          ctx.stroke();
        } else { // "offen"
          ctx.strokeStyle = "#9ca3af"; ctx.fillStyle = "#fff"; ctx.lineWidth = 1.25;
          ctx.beginPath(); ctx.arc(xm, ym, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        hitboxes.push({ x: xm, y: ym, r: r });
      }
      return;
    }
    const xs = tX(r._cR), ys = tY(r.yCent);
    const farbe = farbeFuer(r);
    ctx.beginPath(); ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = farbe; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    hitboxes.push({ x: xs, y: ys, r: r });
    if (r.residuumCent > 0) {
      const halfH = Math.abs(tY(0) - tY(r.residuumCent));
      const yc = (anker === "nulllinie") ? tY(0) : ys;   // Anker-Mitte
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(xs, yc - halfH); ctx.lineTo(xs, yc + halfH);
      ctx.moveTo(xs - 4, yc - halfH); ctx.lineTo(xs + 4, yc - halfH);
      ctx.moveTo(xs - 4, yc + halfH); ctx.lineTo(xs + 4, yc + halfH);
      ctx.stroke();
    }
  });

  // ============================================================
  // (4a) KONSISTENZ-RAUTE: kleine offene Raute an X=_cL, Y=konsistenzCent,
  //      violett (Architektur-Engine §4 Punkt 4a). Zeigt Messung <->
  //      Nachbar-Kurve. Kein cfg-Flag -- Datenanwesenheit.
  // ============================================================
  rows.forEach(function (r) {
    if (r.konsistenzCent == null) return;
    var xr = tX(r._cL), yr = tY(r.konsistenzCent);
    var s = 4;   // halbe Kantenlaenge (~4 px Raute)
    ctx.strokeStyle = "#8b5cf6"; ctx.lineWidth = 1.25; ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(xr, yr - s);
    ctx.lineTo(xr + s, yr);
    ctx.lineTo(xr, yr + s);
    ctx.lineTo(xr - s, yr);
    ctx.closePath();
    ctx.stroke();   // offen (nur Kontur, kein fill)
  });

  // ============================================================
  // (5) PFEIL OBEN — links->rechts. Farbe = Punktfarbe. Laenge 0:
  //     gruener Punkt statt Pfeil. Gestapelte Lanes bei Kollision.
  // ============================================================
  const arrowRows = rows.filter(function (r) { return r.yCent != null; })
    .map(function (r) { return { x1: tX(r._cL), x2: tX(r._cR), r: r }; });
  const laneH = 12, yBase = pad.top - 6;
  const sorted = arrowRows.map(function (a, idx) {
    return { a: a, idx: idx, left: Math.min(a.x1, a.x2), right: Math.max(a.x1, a.x2) };
  }).sort(function (p, q) { return p.left - q.left; });
  const laneRight = []; const laneOf = new Array(arrowRows.length);
  sorted.forEach(function (s) {
    let lane = laneRight.findIndex(function (rr) { return rr < s.left - 2; });
    if (lane === -1) { lane = laneRight.length; laneRight.push(0); }
    laneRight[lane] = s.right; laneOf[s.idx] = lane;
  });
  const arrowLaneCount = Math.max(1, laneRight.length);
  cv._frqg_arrowPos = {};
  arrowRows.forEach(function (a, i) {
    const y = yBase - laneOf[i] * laneH;
    const c = farbeFuer(a.r);
    cv._frqg_arrowPos[a.r.elNum] = { x1: a.x1, x2: a.x2, y: y, color: c };
    if (Math.abs(a.x2 - a.x1) < 1.5) {
      ctx.beginPath(); ctx.arc(a.x1, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#16a34a"; ctx.fill();
    } else {
      ctx.strokeStyle = c; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(a.x1, y - 5); ctx.lineTo(a.x1, y + 5); ctx.stroke();
      drawArrow(ctx, a.x1, y, a.x2, y, c, true);
    }
  });

  // ============================================================
  // (7) ZWEI NUMMERN-LABELS je Zeile (links + rechts), gestapelt.
  //     Warndreieck am rechten Label, wenn r.warn.
  // ============================================================
  const lineH = 11, laneGap = 2;
  const yLblBottom = yBase - arrowLaneCount * laneH - 4;
  const lblItems = [];
  rows.forEach(function (r) {
    lblItems.push({ x: tX(r._cL), text: "E" + r.elNum, color: "#6b7280", r: r, warn: false });
    lblItems.push({ x: tX(r._cR), text: "E" + r.elNum, color: "#000",    r: r, warn: !!r.warn });
  });
  const byX = lblItems.map(function (lbl, idx) {
    const hw = lbl.text.length * 3.5 + 2;
    return { lbl: lbl, idx: idx, left: lbl.x - hw, right: lbl.x + hw };
  }).sort(function (p, q) { return p.left - q.left; });
  const lblLaneRight = []; const lblLaneOf = new Array(lblItems.length);
  byX.forEach(function (o) {
    let lane = lblLaneRight.findIndex(function (rr) { return rr < o.left - 2; });
    if (lane === -1) { lane = lblLaneRight.length; lblLaneRight.push(0); }
    lblLaneRight[lane] = o.right; lblLaneOf[o.idx] = lane;
  });
  cv._frqg_labelPos = {};
  ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center";
  lblItems.forEach(function (lbl, i) {
    const y = yLblBottom - lblLaneOf[i] * (lineH + laneGap);
    (cv._frqg_labelPos[lbl.r.elNum] = cv._frqg_labelPos[lbl.r.elNum] || []).push({ x: lbl.x, y: y, text: lbl.text });
    ctx.fillStyle = lbl.color; ctx.fillText(lbl.text, lbl.x, y);
    if (lbl.warn) drawWarnTriangle(ctx, lbl.x - lbl.text.length * 3.5 - 6, y - 4);
  });

  // ============================================================
  // (10) X-Skala: Hz + Cent Ticks (wie drawFRQChart).
  // ============================================================
  const yScaleTop = pad.top + pH + 2;
  const hzBase = [125, 250, 500, 1000, 2000, 4000, 8000];
  let tks = hzBase.map(function (hz) { return { hz: hz, c: hzToCt(hz) }; })
    .filter(function (tk) { return tk.c > cMin && tk.c < cMax; });
  const shown = [];
  tks.forEach(function (tk) {
    if (!shown.length || tX(tk.c) - tX(shown[shown.length - 1].c) >= 44) shown.push(tk);
  });
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad.left, yScaleTop); ctx.lineTo(pad.left + pW, yScaleTop); ctx.stroke();
  ctx.textAlign = "center";
  shown.forEach(function (tk) {
    const x = tX(tk.c);
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, yScaleTop); ctx.lineTo(x, yScaleTop + 4); ctx.stroke();
    ctx.font = "9px Segoe UI,sans-serif"; ctx.fillStyle = "#000";
    ctx.fillText(tk.hz + " Hz", x, yScaleTop + 14);
    ctx.fillText((tk.c >= 0 ? "+" : "") + Math.round(tk.c) + " ct", x, yScaleTop + 25);
  });

  // --- Achsentitel (Y) ---
  ctx.fillStyle = "#000"; ctx.font = "10px Segoe UI,sans-serif"; ctx.textAlign = "center";
  ctx.save();
  ctx.translate(13, pad.top + pH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(cfg.yLabel || "", 0, 0);
  ctx.restore();

  cv._frqg_hitboxes = hitboxes;
  cv._frqg_state = { ctx: ctx, tX: tX, tY: tY, pad: pad, pH: pH, rows: rows };
}

// Highlight aller Elemente einer Zeile (BA456).
function _frqg_drawHighlight(cv, r) {
  const s = cv._frqg_state; if (!s || !r) return;
  const ctx = s.ctx, tX = s.tX, tY = s.tY, pad = s.pad, pH = s.pH;
  const HL = "#22c55e", GLOW = "rgba(34,197,94,0.35)";
  ctx.setLineDash([]);
  [tX(r._cL), tX(r._cR)].forEach(function (cx) {
    ctx.strokeStyle = GLOW; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(cx, pad.top); ctx.lineTo(cx, pad.top + pH); ctx.stroke();
  });
  if (r.yCent != null) {
    ctx.strokeStyle = HL; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(tX(r._cR), tY(r.yCent), 9, 0, Math.PI * 2); ctx.stroke();
  }
  const ap = cv._frqg_arrowPos && cv._frqg_arrowPos[r.elNum];
  if (ap) {
    ctx.strokeStyle = ap.color; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ap.x1, ap.y - 6); ctx.lineTo(ap.x1, ap.y + 6); ctx.stroke();
    if (Math.abs(ap.x2 - ap.x1) >= 1.5) drawArrow(ctx, ap.x1, ap.y, ap.x2, ap.y, ap.color, true, 2.5);
  }
  const lp = cv._frqg_labelPos && cv._frqg_labelPos[r.elNum];
  if (lp) {
    ctx.font = "bold 10px Segoe UI,sans-serif"; ctx.textAlign = "center";
    lp.forEach(function (lbl) {
      ctx.fillStyle = GLOW; ctx.fillRect(lbl.x - 13, lbl.y - 9, 26, 12);
      ctx.fillStyle = HL; ctx.fillText(lbl.text, lbl.x, lbl.y);
    });
  }
}

// Tooltip-Handler (BA456). Nutzt r.tooltip (vorformatierte Zeilen).
function _frqg_tooltipHandler(cv, e) {
  if (!cv._frqg_hitboxes) return;
  const rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1,
    scaleX = (cv.width / dpr) / rect.width, scaleY = (cv.height / dpr) / rect.height,
    mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
  let tip = document.getElementById("frqg_tooltip");
  if (!tip) {
    tip = document.createElement("div"); tip.id = "frqg_tooltip";
    tip.style.cssText = "position:fixed;background:#1e293b;color:#f8fafc;padding:6px 10px;" +
      "border-radius:6px;font-size:0.82em;pointer-events:none;display:none;z-index:1000;" +
      "line-height:1.6;white-space:nowrap;";
    document.body.appendChild(tip);
  }
  const hit = cv._frqg_hitboxes.find(function (hb) { return Math.hypot(hb.x - mx, hb.y - my) <= 12; });
  const newR = hit ? hit.r : null;
  if (newR !== cv._frqg_highR) {
    cv._frqg_highR = newR;
    drawFRQGraph(cv, cv._frqg_rows, cv._frqg_cfg);
    if (newR) _frqg_drawHighlight(cv, newR);
  }
  if (hit) {
    tip.innerHTML = (hit.r.tooltip || []).join("<br>");
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
}
