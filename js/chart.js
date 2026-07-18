// Zeichnet eine deaktivierte/gemute Elektrode als hellgrauen
// Vollbalken mit dunkler X-Diagonale. Wird von drawBarGraph
// und stereobalance-balance.js (STB_drawChart) genutzt. NICHT fuer
// drawFRQGraph geeignet (dort log-Hz-Achse).
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

// Zeichnet eine aktive, aber noch nicht gemessene Elektrode als
// hellgrauen Vollbalken mit einem Fragezeichen. Gegenstueck zu
// drawDisabledBar (deaktiviert = X). Genutzt von der Balkengraph-Engine
// (drawBarGraph) fuer ELL + Stereo.
function drawUnmeasuredBar(ctx, x, yTop, yBot, bW) {
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x, yTop, bW, yBot - yTop);
  ctx.fillStyle = '#6b7280';
  ctx.font = 'bold ' + Math.min(18, Math.max(11, bW * 0.7)) + 'px Segoe UI,sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x + bW / 2, (yTop + yBot) / 2);
  ctx.textBaseline = 'alphabetic';   // Default wiederherstellen
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
// Cent-x-Achse — Hilfsfunktionen (gemeinsam für drawBarGraph und
// kurvenELLChartZeichnen). Elektroden werden nach ihrer Cent-Position
// (re 1000 Hz) auf der x-Achse plaziert; mindestens zwei
// Elektroden, sonst lineare Notlösung.
// ============================================================

// Gleichmäßige x-Verteilung der Elektroden über die Plot-Breite
// (elektrodennummern-basiert). Verwendet von STB_drawChart (Stereo-Balance)
// seit Bauanleitung 67; drawBarGraph nutzt die inline-tX.
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

// Balkengraph-Engine: feste Druckhoehe (Architektur-Kapitel Sec.4.3).
var BARGRAPH_PRINT_H = 300;

// ============================================================
// BALKENGRAPH-ENGINE (Architektur 00-balkengraph-engine).
// Eine Zeichenfunktion fuer ELL-Ergebnisgraph + Stereo-Balance.
// Kennt KEINEN Graph-Typ: zeichnet je Zeile ihren Zustand; alle
// Abweichungen kommen aus cfg. rows/cfg-Vertrag: Kapitel Sec.4/5.
// ============================================================
function drawBarGraph(cv, rows, cfg) {
  cfg = cfg || {};
  rows = rows || [];
  var _ctx = cfg.ctx || {};
  var _dEN       = _ctx.dEN       || dEN;
  var _dENPrefix = _ctx.dENPrefix || dENPrefix;

  var ctx2d = cv.getContext("2d");
  var dpr, w, h;
  if (cfg.druck) {
    dpr = 2; w = cv.parentElement.clientWidth - 32; h = BARGRAPH_PRINT_H;
  } else {
    dpr = window.devicePixelRatio || 1;
    w = cv.parentElement.clientWidth - 32; h = 320;
  }
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + "px"; cv.style.height = h + "px";
  ctx2d.setTransform(1, 0, 0, 1, 0, 0);
  ctx2d.scale(dpr, dpr);
  ctx2d.clearRect(0, 0, w, h);

  var pad = { top: 30, right: 20, bottom: 57, left: 55 };
  var pW = w - pad.left - pad.right;
  var pH = h - pad.top - pad.bottom;
  if (!rows.length) return;

  // --- Y-Bereich ---
  var vals = rows.map(function (r) { return r.wert || 0; });
  var reals = rows.filter(function (r) { return r.zustand === "gemessen"; });
  var yMn, yMx;
  if (cfg.ySymmetrisch !== false) {
    var am = Math.max(Math.ceil(Math.max.apply(null, vals.map(Math.abs).concat([1]))), 5);
    if (cfg.residuum) {
      reals.forEach(function (r) {
        if (r.residuum > 0) am = Math.max(am, Math.ceil(Math.abs(r.wert) + r.residuum));
      });
    }
    yMn = -am; yMx = am;
  } else {
    var av = reals.map(function (r) { return r.wert || 0; });
    yMn = Math.min.apply(null, [0].concat(av));
    yMx = Math.max.apply(null, [0].concat(av));
    var rr = yMx - yMn || 1; yMn -= rr * 0.1; yMx += rr * 0.1;
  }

  // --- X-Achse: lineare Verteilung ueber die Zeilen (index-basiert) ---
  var n = rows.length;
  var tX = function (j) {
    if (n <= 1) return pad.left + pW / 2;
    var dx = pW / n; return pad.left + dx * (j + 0.5);
  };
  var xS = n <= 1 ? pW : pW / n;
  var tY = function (v) { return pad.top + (yMx - v) * (pH / (yMx - yMn || 1)); };
  var bW = Math.min(xS * 0.6, 34);

  // --- Y-Grid ---
  ctx2d.strokeStyle = "#e5e5e5"; ctx2d.lineWidth = 1;
  for (var g = 0; g <= 5; g++) {
    var gv = yMn + ((yMx - yMn) * g) / 5, gy = tY(gv);
    ctx2d.beginPath(); ctx2d.moveTo(pad.left, gy); ctx2d.lineTo(w - pad.right, gy); ctx2d.stroke();
    ctx2d.fillStyle = "#999"; ctx2d.font = "10px Consolas,monospace"; ctx2d.textAlign = "right";
    ctx2d.fillText(gv.toFixed(1), pad.left - 8, gy + 4);
  }
  if (yMn < 0 && yMx > 0) {
    ctx2d.strokeStyle = "#aaa"; ctx2d.lineWidth = 1.5; ctx2d.setLineDash([4, 3]);
    ctx2d.beginPath(); ctx2d.moveTo(pad.left, tY(0)); ctx2d.lineTo(w - pad.right, tY(0)); ctx2d.stroke();
    ctx2d.setLineDash([]);
  }

  // --- Ampel-/Vorzeichenfarbe (Kapitel Sec.5). Eine Wahrheit. ---
  var STUFE = { gruen: "#16a34a", gelb: "#facc15", rot: "#dc2626" };
  var farbPaar = cfg.farbPaar || { pos: "#2563eb", neg: "#dc2626", null: "#9ca3af" };
  var schwelle = (cfg.schwelle != null) ? cfg.schwelle : 0.05;
  var balkenFarbe = function (r) {
    if (cfg.balkenFarbe === "ampel") return STUFE[r.stufe] || "#9ca3af";
    var v = r.wert || 0;
    return v > schwelle ? farbPaar.pos : v < -schwelle ? farbPaar.neg : farbPaar.null;
  };

  // --- Referenz-Label oben (nur cfg.refElLabel) ---
  if (cfg.refElLabel) {
    for (var jr = 0; jr < n; jr++) {
      if (rows[jr].istRef) { _drawRefElLabel(ctx2d, tX(jr), pad.top - 4); break; }
    }
  }

  // --- Balken / Zustands-Rechtecke je Zeile ---
  for (var j = 0; j < n; j++) {
    var r = rows[j], x = tX(j) - bW / 2;
    if (r.zustand === "deaktiviert") {
      drawDisabledBar(ctx2d, x, pad.top, pad.top + pH, bW);
    } else if (r.zustand === "ungemessen") {
      drawUnmeasuredBar(ctx2d, x, pad.top, pad.top + pH, bW);
    } else {
      var v = r.wert || 0, yZ = tY(0), yV = tY(v);
      ctx2d.fillStyle = balkenFarbe(r);
      ctx2d.fillRect(x, Math.min(yZ, yV), bW, Math.abs(yV - yZ) || 2);
      // Residuum-T-Balken (nur cfg.residuum)
      if (cfg.residuum && r.residuum > 0) {
        var yt = tY(v + r.residuum), yb = tY(v - r.residuum), cx = tX(j);
        ctx2d.strokeStyle = "#00000044"; ctx2d.lineWidth = 1.5;
        ctx2d.beginPath(); ctx2d.moveTo(cx, yt); ctx2d.lineTo(cx, yb); ctx2d.stroke();
        ctx2d.beginPath(); ctx2d.moveTo(cx - 4, yt); ctx2d.lineTo(cx + 4, yt); ctx2d.stroke();
        ctx2d.beginPath(); ctx2d.moveTo(cx - 4, yb); ctx2d.lineTo(cx + 4, yb); ctx2d.stroke();
      }
    }
    // X-Beschriftung: Label + Hz + apikal/basal
    ctx2d.fillStyle = r.istRef ? "#2563eb" : "#555";
    ctx2d.font = (r.istRef ? "bold " : "") + "10px Segoe UI,sans-serif";
    ctx2d.textAlign = "center";
    var yE = h - pad.bottom + 14, yHz = h - pad.bottom + 25, yAB = h - pad.bottom + 38;
    ctx2d.fillText(r.label, tX(j), yE);
    ctx2d.font = "8px Consolas,monospace"; ctx2d.fillStyle = "#999";
    if (r.hz != null) ctx2d.fillText(Math.round(r.hz), tX(j), yHz);
    if (r.apikalBasal) {
      ctx2d.font = "8px Segoe UI,sans-serif";
      ctx2d.fillText(t(r.apikalBasal), tX(j), yAB);
    }
  }

  // --- Achsen-Tooltip (Hitboxes ueber ALLE Zeilen) ---
  cv._axisHits = [];
  for (var jh = 0; jh < n; jh++) {
    var cxh = tX(jh), halfDx = Math.max(8, (xS || 12) / 2);
    cv._axisHits.push({
      x0: cxh - halfDx, x1: cxh + halfDx,
      y0: h - pad.bottom + 2, y1: h - pad.bottom + 34,
      label: rows[jh].label, hz: rows[jh].hz
    });
  }
  _attachAxisTooltip(cv);

  // --- Spitzenpunkte (nur cfg.spitzenPunkte) — KEINE Verbindungslinie ---
  if (cfg.spitzenPunkte) {
    for (var jp = 0; jp < n; jp++) {
      if (rows[jp].zustand !== "gemessen") continue;
      ctx2d.beginPath(); ctx2d.arc(tX(jp), tY(rows[jp].wert || 0), 3.5, 0, Math.PI * 2);
      ctx2d.fillStyle = "#2563eb"; ctx2d.fill();
      ctx2d.strokeStyle = "#fff"; ctx2d.lineWidth = 2; ctx2d.stroke();
    }
  }

  // --- Y-Achsentitel ---
  ctx2d.save();
  ctx2d.translate(12, pad.top + pH / 2); ctx2d.rotate(-Math.PI / 2);
  ctx2d.fillStyle = "#666"; ctx2d.font = "10px Segoe UI,sans-serif"; ctx2d.textAlign = "center";
  ctx2d.fillText(cfg.yLabel || "dB", 0, 0);
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

  const titelH = cfg.titel ? 22 : 0;   // reservierter Streifen ganz oben fuer den Titel
  const pad = { top: 80 + titelH, right: 30, bottom: 54, left: 70 };
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
      var _rmax = Math.max(r.residDownCent > 0 ? r.residDownCent : 0,
                           r.residUpCent   > 0 ? r.residUpCent   : 0);
      ext.push(Math.abs(r.yCent) + _rmax);
    });
    absC = Math.max(Math.ceil(Math.max.apply(null, ext.concat([50])) / 50) * 50, 50);
  }
  const yMin = -absC, yMax = absC;
  const tY = (c) => pad.top + ((yMax - c) / (yMax - yMin)) * pH;

  // Farbe kommt jetzt vom Aufrufer als benannte Stufe (row.stufe):
  // "gruen"/"amber"/"rot". Die Engine mappt nur, sie bewertet nicht.
  // Fehlt die Stufe -> Neutralgrau (unbewertet, taeuscht keine Bewertung vor).
  const STUFE_FARBE = { gruen: "#16a34a", amber: "#facc15", rot: "#dc2626" };
  const farbeFuer = function (r) {
    return STUFE_FARBE[r && r.stufe] || "#9ca3af";
  };

  // ============================================================
  // (1) BANDFLAECHEN — nur Zeilen mit Bandgrenzen. Hintergrund, dezent,
  //     volle Hoehe. SEGMENTWEISE nach Band-Deckung gefaerbt:
  //       0 Baender -> weiss (aktiv: Raender + Luecken gleich)
  //       1 Band    -> Blauton, alternierend PRO BAND (ein Band = ein Ton)
  //       >=2       -> hellrot (Ueberlappungszone)
  //     Die ganze Zeichenflaeche (X-Wand, tX-Spanne) wird abgedeckt, damit
  //     bandfreie Bereiche aktiv weiss erscheinen (nicht nur Canvas-Weiss).
  // ============================================================
  const BAND_BLAU = ["#dbeafe", "#bfdbfe"];   // alterniert je Band (nicht je Segment)
  const BAND_ROT  = "#fecaca";                // Ueberlappung >=2 Baender
  const bandRows = rows.filter(function (r) { return r._cLo != null && r._cHi != null; })
                       .sort(function (a, b) { return a._cLo - b._cLo; });
  bandRows.forEach(function (r, i) { r._bandIdx = i; });   // Blau-Alternierung je Band
  // Kanten sammeln: X-Wand-Raender + alle Bandgrenzen -> Segmente.
  const edges = [tX(cMin), tX(cMax)];
  bandRows.forEach(function (r) { edges.push(tX(r._cLo), tX(r._cHi)); });
  edges.sort(function (a, b) { return a - b; });
  ctx.globalAlpha = 0.5;   // dezent: Striche/Punkt liegen klar darueber
  for (let s = 0; s < edges.length - 1; s++) {
    const xA = edges[s], xB = edges[s + 1];
    if (xB - xA < 0.5) continue;   // Duplikat-Kanten uebergehen
    const mid = (xA + xB) / 2;
    // Baender, die dieses Segment ueberdecken (Segmentmitte innerhalb).
    const cover = bandRows.filter(function (r) { return tX(r._cLo) <= mid && mid <= tX(r._cHi); });
    let fill;
    if (cover.length === 0)      fill = "#f2f2f2";   // gedecktes Weiss (neutralgrau, kein Blaustich): hebt Luecke/Rand vom Canvas-Weiss ab
    else if (cover.length >= 2)  fill = BAND_ROT;
    else                         fill = BAND_BLAU[cover[0]._bandIdx % BAND_BLAU.length];
    ctx.fillStyle = fill;
    ctx.fillRect(xA, pad.top, xB - xA, pH);
  }
  ctx.globalAlpha = 1;
  // Bandrahmen: trennt benachbarte Baender sichtbar (wie bisher, pro Band).
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 1;
  bandRows.forEach(function (r) {
    const xL = tX(r._cLo), xR = tX(r._cHi);
    ctx.strokeRect(xL, pad.top, xR - xL, pH);
  });
  // Umlaufender Feldrahmen (alle vier Seiten gleich, wie X-Skalen-Linie:
  // #cbd5e1, Breite 1). Ohne ihn fehlte rechts eine sichtbare Kante.
  ctx.strokeRect(pad.left, pad.top, pW, pH);

  // ============================================================
  // (2) AMBERBAND — schmales SENKRECHTES Band, Breite = Residuum in
  //     X-Richtung (Cent, die X-Achse ist Cent-linear via tX), an der
  //     Punkt-X-Position (_cR), volle Hoehe. NUR wenn cfg.amberband
  //     (Ergebnisgraph). Vor dem Grid, hinter Strichen/Punkten. Der
  //     T-Balken selbst kommt in Abschnitt (4).
  // ============================================================
  const anker = (cfg.residuumAnker === "nulllinie") ? "nulllinie"
              : (cfg.residuumAnker === "rohwert") ? "rohwert"
              : "punkt";
  if (cfg.amberband) {
    rows.forEach(function (r) {
      var d = (r.residDownCent > 0) ? r.residDownCent : 0;
      var u = (r.residUpCent   > 0) ? r.residUpCent   : 0;
      if (!(d > 0) && !(u > 0)) return;
      const xa = tX(r._cR - d);
      const xb = tX(r._cR + u);
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
  // (9) VERBINDUNGSLINIE durch die yCent-Punkte — wenn cfg.verbindung.
  //     Farbe aus cfg.linienfarbe (Default blau); im Glaettungsgraph
  //     traegt yCent die geglaettete Kurve -> gruen. (§4/§9 Engine-Doku)
  // (9b) ZWEITE VERBINDUNGSLINIE durch die yCent2-Marker — wenn Zeilen
  //     yCent2 tragen. Farbe cfg.zweitkurve. So entstehen die zwei
  //     Polygone (blau=gehoert, gruen=geglaettet). Die durchsichtige
  //     Kurve ist zwischen den Graphen gespiegelt (Aufrufer-Sache).
  // ============================================================
  // Kurvenfarben (§8.5): blau = Messergebnis, gruen = Glaettung,
  // schwarz = nominell (BA500). "schwarz" ist ein MITTELGRAU (#6b7280),
  // NICHT reines Schwarz: die Nullinie und die rechten Striche sind
  // bereits #000 -- eine reinschwarze Kurve wuerde damit verschwimmen.
  // Startwert, Feinjustierung nach Sichttest (siehe Akzeptanz).
  const KURVENFARBE = { blau: "#3b82f6", gruen: "#16a34a", schwarz: "#6b7280" };
  const _linieFarbe = KURVENFARBE[cfg.linienfarbe] || "#3b82f6";
  if (cfg.verbindung) {
    const pts = rows.filter(function (r) { return r.yCent != null; })
                    .sort(function (a, b) { return a._cR - b._cR; });
    if (pts.length > 1) {
      ctx.strokeStyle = _linieFarbe; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tX(pts[0]._cR), tY(pts[0].yCent));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(tX(pts[i]._cR), tY(pts[i].yCent));
      ctx.stroke();
    }
  }
  const _zweitFarbe = KURVENFARBE[cfg.zweitkurve] || null;
  const ZWEIT_ALPHA = 0.35;   // Vergleichskurve blass: ermoeglicht Vergleich, dominiert nicht
  if (_zweitFarbe) {
    const pts2 = rows.filter(function (r) { return r.yCent2 != null; })
                     .sort(function (a, b) { return a._cR - b._cR; });
    if (pts2.length > 1) {
      ctx.globalAlpha = ZWEIT_ALPHA;
      ctx.strokeStyle = _zweitFarbe; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tX(pts2[0]._cR), tY(pts2[0].yCent2));
      for (let i = 1; i < pts2.length; i++) ctx.lineTo(tX(pts2[i]._cR), tY(pts2[i].yCent2));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // (9c) DRITTE VERBINDUNGSLINIE durch die yCent3-Marker — wenn Zeilen
  //     yCent3 tragen. Farbe cfg.drittkurve. Identisch zur zweiten Linie,
  //     nur andere Y-/Farbquelle. Nur der dreikurvige Bandgraph (§10)
  //     traegt yCent3; Ergebnis-/Glaettungsgraph setzen es nie.
  const _drittFarbe = KURVENFARBE[cfg.drittkurve] || null;
  if (_drittFarbe) {
    const pts3 = rows.filter(function (r) { return r.yCent3 != null; })
                     .sort(function (a, b) { return a._cR - b._cR; });
    if (pts3.length > 1) {
      ctx.globalAlpha = ZWEIT_ALPHA;
      ctx.strokeStyle = _drittFarbe; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(tX(pts3[0]._cR), tY(pts3[0].yCent3));
      for (let i = 1; i < pts3.length; i++) ctx.lineTo(tX(pts3[i]._cR), tY(pts3[i].yCent3));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ============================================================
  // (9a) KONSISTENZ-LINIE: ausgeblendet (Anzeige entfernt auf Wunsch).
  //      Die Berechnung von konsistenzCent (results.js) bleibt erhalten,
  //      nur die violette gestrichelte Linie wird nicht mehr gezeichnet.
  // ============================================================

  // ============================================================
  // (4)+(6) PUNKT (gruen/rot) + Residuum-T-Balken (nur Anker=punkt).
  //         Hitboxen fuer Mouseover.
  // ============================================================
  rows.forEach(function (r) {
    // Alle sichtbaren Zeilen tragen yCent (ungemessen: grauer Punkt bei 0
    // bzw. Bandmitten-Abweichung, stufe=null). Kein Leer-Marker mehr.
    if (r.yCent == null) return;
    const xs = tX(r._cR), ys = tY(r.yCent);
    const farbe = farbeFuer(r);
    ctx.beginPath(); ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = farbe; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    // Anker-Mitte: nulllinie -> 0; rohwert -> roher cent; sonst Punkt (ys).
    var ycAnker = (anker === "nulllinie") ? tY(0)
                : (anker === "rohwert" && r.residuumMitteCent != null) ? tY(r.residuumMitteCent)
                : ys;
    // Ein T-Balken mit oberem/unterem cent-Abstand (asymmetrisch moeglich).
    // yc = Anker-Pixel, up/down = cent nach oben/unten. Am Feldrand kappen.
    function _tBalken(yc, upCent, downCent, farbe) {
      if (!(upCent > 0) && !(downCent > 0)) return;
      var yFeldTop = pad.top, yFeldBot = pad.top + pH;
      var yTop0 = yc - Math.abs(tY(0) - tY(upCent));    // oben (kleinerer Pixel)
      var yBot0 = yc + Math.abs(tY(0) - tY(downCent));  // unten
      var yTop = Math.max(yTop0, yFeldTop);
      var yBot = Math.min(yBot0, yFeldBot);
      ctx.strokeStyle = farbe; ctx.lineWidth = 1.5; ctx.setLineDash([]);
      ctx.beginPath();
      if (yTop < yBot) {
        ctx.moveTo(xs, yTop); ctx.lineTo(xs, yBot);
        if (yTop0 >= yFeldTop) { ctx.moveTo(xs - 4, yTop); ctx.lineTo(xs + 4, yTop); }
        if (yBot0 <= yFeldBot) { ctx.moveTo(xs - 4, yBot); ctx.lineTo(xs + 4, yBot); }
      }
      ctx.stroke();
    }
    // Restspanne ZUERST (blau, unten), dann Residuum (schwarz, darueber).
    if (r.restspanneCent > 0) _tBalken(ycAnker, r.restspanneCent, r.restspanneCent, "#3b82f6");
    if (r.residUpCent > 0 || r.residDownCent > 0) _tBalken(ycAnker, r.residUpCent, r.residDownCent, "#000");
  });

  // ============================================================
  // (4b) ZWEITKURVEN-MARKER — durchsichtiger Kreis auf _cR in Hoehe
  //      yCent2, Rand in cfg.zweitkurve-Farbe, KEINE Fuellung, KEINE
  //      Hitbox/Tooltip. Nur wenn Zeile yCent2 traegt und cfg.zweitkurve
  //      gesetzt ist. (§4 Punkt 4b Engine-Doku)
  // ============================================================
  if (_zweitFarbe) {
    ctx.globalAlpha = ZWEIT_ALPHA;   // blass wie die Zweitlinie (9b)
    rows.forEach(function (r) {
      if (r.yCent2 == null) return;
      const xs2 = tX(r._cR), ys2 = tY(r.yCent2);
      ctx.beginPath(); ctx.arc(xs2, ys2, 5, 0, Math.PI * 2);
      ctx.strokeStyle = _zweitFarbe; ctx.lineWidth = 1.75; ctx.setLineDash([]);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // (4c) DRITTKURVEN-MARKER — durchsichtiger Kreis auf _cR in Hoehe
  //      yCent3, Rand in cfg.drittkurve-Farbe. Identisch zu 4b. (§4 4c)
  if (_drittFarbe) {
    ctx.globalAlpha = ZWEIT_ALPHA;
    rows.forEach(function (r) {
      if (r.yCent3 == null) return;
      const xs3 = tX(r._cR), ys3 = tY(r.yCent3);
      ctx.beginPath(); ctx.arc(xs3, ys3, 5, 0, Math.PI * 2);
      ctx.strokeStyle = _drittFarbe; ctx.lineWidth = 1.75; ctx.setLineDash([]);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // ============================================================
  // (4a) KONSISTENZ-RAUTE: ausgeblendet (Anzeige entfernt auf Wunsch).
  //      Die Berechnung von konsistenzCent (results.js) bleibt erhalten,
  //      nur die violetten offenen Rauten werden nicht mehr gezeichnet.
  // ============================================================

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

  // --- Titel im Bild (oben, ueber den Nummern-Labels) ---
  if (cfg.titel) {
    var _titelText = (typeof t === "function") ? t(cfg.titel) : cfg.titel;
    if (_titelText) {
      ctx.fillStyle = "#000";
      ctx.font = "bold 13px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(_titelText, pad.left + pW / 2, 16);
    }
  }

  cv._frqg_state = { ctx: ctx, tX: tX, tY: tY, pad: pad, pH: pH, rows: rows };
}

// Legende-Fakten fuer einen Frequenz-Graphen (Architektur §8). Zeichnet
// NICHT -- liefert nur, WELCHE Elemente der Graph hat, ihren Farb-
// Schluessel und ihre Achse. Die Elementauswahl folgt denselben cfg-/
// rows-Bedingungen wie drawFRQGraph (amberband, zweitkurve, Bandgrenzen),
// damit Legende und Bild nie divergieren. Rueckgabe:
//   { elemente: [ { key, farbe, achse } ... ], bewertung: "ampel"|"problem" }
// key   = stabiler Element-Schluessel (§8.5)
// farbe = Farb-Schluessel fuer Legende-Spalte 2 (Anzeige-Wort via i18n)
// achse = "x" | "y" | null  (Spalte-1-Zusatz "(X)"/"(Y)")
function frqLegendData(cfg, rows) {
  cfg = cfg || {};
  rows = rows || [];
  var bewertung = (cfg.bewertung === "problem") ? "problem" : "ampel";
  // Ampel-Farbwort haengt am Paradigma: zweistufig gruen/rot, dreistufig
  // gruen/gelb/rot -- genau die Punkt-/Pfeil-Farbstufen (STUFE_FARBE).
  var ampelWort = (bewertung === "problem") ? "gruenrot" : "gruengelbrot";

  // Hex je Farb-Schluessel fuer die Legende-Farbquadrate -- SELBE Werte
  // wie der Zeichencode (STUFE_FARBE 479, KURVENFARBE 585, BAND_* 493-494,
  // Strichfarben 541/543, Amberband-Grundton 542 voll deckend). Ampel-
  // Schluessel = Array mehrerer Stufen. Eine Wahrheit: aendert sich eine
  // Zeichenfarbe, hier mitziehen (die Legende zeigt genau das Bild).
  var HEX = {
    hellgrau: ["#9ca3af"], schwarz: ["#000000"], orange: ["#f59e0b"],
    blau: ["#3b82f6"], gruen: ["#16a34a"], hellblau: ["#dbeafe"],
    weiss: ["#f2f2f2"], hellrot: ["#fecaca"],
    grau: ["#6b7280"],   // BA500: nominell-Kurve (== KURVENFARBE.schwarz)
    gruenrot: ["#16a34a", "#dc2626"],
    gruengelbrot: ["#16a34a", "#facc15", "#dc2626"]
  };
  var mk = function (key, farbe, achse) {
    return { key: key, farbe: farbe, achse: achse, hex: HEX[farbe] || ["#9ca3af"] };
  };

  var el = [];
  el.push(mk("strichGrau",    "hellgrau", "x"));
  el.push(mk("strichSchwarz", "schwarz",  "x"));
  el.push(mk("pfeil",         ampelWort,  "x"));
  el.push(mk("punkt",         ampelWort,  "y"));
  if (cfg.amberband) el.push(mk("band", "orange", "x"));
  el.push(mk("querbalkBlau", "blau", "y"));
  el.push(mk("querbalken", "schwarz", "y"));

  // Kurven (§8.5): eine kraeftige (cfg.linienfarbe, immer) + bis zu zwei
  // blasse Vergleichskurven (cfg.zweitkurve/cfg.drittkurve, nur wenn die
  // Zeilen yCent2/yCent3 tragen). Jede Farbe hoechstens einmal in der
  // Legende -- faellt eine Vergleichskurve mit einer schon genannten
  // zusammen, keine Doppel-Zeile. mapFarbe: cfg-Wort -> HEX-Schluessel
  // (schwarz -> grau, weil KURVENFARBE.schwarz ein Mittelgrau ist).
  var hatZweit = false, hatDritt = false;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].yCent2 != null) hatZweit = true;
    if (rows[i] && rows[i].yCent3 != null) hatDritt = true;
  }
  var mapKurvenFarbe = function (wort) {
    if (wort === "gruen")   return "gruen";
    if (wort === "schwarz") return "grau";
    return "blau";
  };
  var kurvenFarben = [];
  kurvenFarben.push(mapKurvenFarbe(cfg.linienfarbe));
  if (hatZweit && cfg.zweitkurve) kurvenFarben.push(mapKurvenFarbe(cfg.zweitkurve));
  if (hatDritt && cfg.drittkurve) kurvenFarben.push(mapKurvenFarbe(cfg.drittkurve));
  var kurvenGesehen = {};
  kurvenFarben.forEach(function (f) {
    if (kurvenGesehen[f]) return;
    kurvenGesehen[f] = true;
    el.push(mk("kurve", f, null));
  });

  // Flaechen (§4 Punkt 1): nur wenn Zeilen Bandgrenzen tragen. Weiss +
  // hellrot immer mit-benennen, weil die Engine sie aktiv zeichnet.
  var hatBaender = false;
  for (var j = 0; j < rows.length; j++) {
    if (rows[j] && rows[j].bandLoHz != null && rows[j].bandHiHz != null) { hatBaender = true; break; }
  }
  if (hatBaender) {
    el.push(mk("flaeche", "hellblau", null));
    el.push(mk("flaeche", "weiss",    null));
    el.push(mk("flaeche", "hellrot",  null));
  }

  // Ampel-Stufen fuer den Farb-Erklaerblock (§8.4): je Stufe ein
  // Schluessel (i18n-Erklaertext) + die Kreisfarbe (STUFE_FARBE, wie im
  // Graph-Punkt). "problem" = zweistufig gruen/rot, "ampel" = dreistufig.
  // Grauer Punkt = ungemessene (aber testbare) Elektrode, in ALLEN Graphen
  // (stufe=null -> Neutralgrau #9ca3af, wie farbeFuer). Letzte Zeile.
  var grau = { stufe: "ungemessen", hex: "#9ca3af" };
  var stufen = (bewertung === "problem")
    ? [ { stufe: "gruen", hex: "#16a34a" }, { stufe: "rot", hex: "#dc2626" }, grau ]
    : [ { stufe: "gruen", hex: "#16a34a" }, { stufe: "gelb", hex: "#facc15" }, { stufe: "rot", hex: "#dc2626" }, grau ];

  return { elemente: el, bewertung: bewertung, ampelStufen: stufen };
}

// Legende-Fakten fuer den ELL-Balkengraphen (Architektur
// 00-balkengraph-engine Sec.6). Elemente in der Zeichen-Reihenfolge der
// Engine. Farben = SELBE Werte wie drawBarGraph (STUFE 227, T-Balken
// #000, Zustands-Rechtecke grau). bewertung "ampel" -> dreistufiger
// Erklaerblock (gruen/gelb/rot + grau), wie frqLegendData.
function ellLegendData(rows) {
  var HEX = {
    gruengelbrot: ["#16a34a", "#facc15", "#dc2626"],
    schwarz: ["#000000"], grau: ["#e5e7eb"]
  };
  var mk = function (key, farbe, achse) {
    return { key: key, farbe: farbe, achse: achse, hex: HEX[farbe] || ["#9ca3af"] };
  };
  var el = [];
  el.push(mk("balken",        "gruengelbrot", "y"));   // Ampel-Balken
  el.push(mk("querbalken",    "schwarz",      "y"));   // Streuung/Residuum
  el.push(mk("xRechteck",     "grau",         null));  // deaktiviert
  el.push(mk("frageRechteck", "grau",         null));  // ungemessen
  // Eigene Ampel-Stufen (bewertung "ellampel") -- NICHT die mit den
  // Frequenzgraphen geteilten "ampel"-Texte (die messen Cent, ELL misst
  // dB). KEIN grauer "ungemessen"-Eintrag: im ELL-Graphen kommt kein
  // grauer Balken vor (ungemessen = Fragezeichen-Rechteck).
  // ampelSymbol "eckig": der Graph zeigt Balken, keine Punkte.
  // farbSpalte false: die Farb-Spalte ist bei diesem Graphen nicht
  // aussagekraeftig (eine Ampel-Skala, keine Element-Farb-Kontraste).
  var stufen = [
    { stufe: "gruen", hex: "#16a34a" },
    { stufe: "gelb",  hex: "#facc15" },
    { stufe: "rot",   hex: "#dc2626" }
  ];
  return { elemente: el, bewertung: "ellampel", ampelStufen: stufen,
           ampelSymbol: "eckig", farbSpalte: false };
}

// Legende-Fakten fuer den Stereo-Balance-Balkengraphen. Vorzeichenfarbe
// (rot = rechts lauter, blau = links lauter) -- SELBE Werte wie
// STB_drawChart (farbPaar rot #dc2626 / blau #2563eb). KEIN Ampel-
// Erklaerblock (Stereo hat keine Guete-Bewertung).
function stbLegendData(rows) {
  var HEX = { blau: ["#2563eb"], grau: ["#e5e7eb"], schwarz: ["#111827"] };
  var mk = function (key, farbe, achse) {
    return { key: key, farbe: farbe, achse: achse, hex: HEX[farbe] || ["#9ca3af"] };
  };
  var el = [];
  el.push(mk("balken",        "blau",    null));
  el.push(mk("xRechteck",     "grau",    null));
  el.push(mk("frageRechteck", "grau",    null));
  el.push(mk("meanLinie",     "schwarz", null));
  return { elemente: el, bewertung: "ampel", ampelStufen: [], farbSpalte: false };
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

// Abstand Punkt->Strecke (fuer die senkrechten Striche + den Pfeil).
function _frqg_distSegment(px, py, x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  var len2 = dx * dx + dy * dy;
  var tPar = len2 > 0 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  tPar = Math.max(0, Math.min(1, tPar));
  var cx = x1 + tPar * dx, cy = y1 + tPar * dy;
  return Math.hypot(px - cx, py - cy);
}

// Minimaler Abstand des Mauszeigers zu IRGENDEINEM aufleuchtenden Element
// der Zeile r -- exakt die Elemente, die _frqg_drawHighlight zeichnet
// (beide senkrechten Striche, Punkt/Leer-Marker, Pfeil, Labels). So sind
// "was leuchtet" und "was ausloest" dieselbe Menge (eine Wahrheit).
function _frqg_zeilenDistanz(cv, r) {
  var s = cv._frqg_state; if (!s) return Infinity;
  var tX = s.tX, tY = s.tY, pad = s.pad, pH = s.pH;
  var d = Infinity;
  var yTop = pad.top, yBot = pad.top + pH;
  // Zwei senkrechte Striche (volle Feldhoehe).
  d = Math.min(d, _frqg_distSegment(cv._frqg_mx, cv._frqg_my, tX(r._cL), yTop, tX(r._cL), yBot));
  d = Math.min(d, _frqg_distSegment(cv._frqg_mx, cv._frqg_my, tX(r._cR), yTop, tX(r._cR), yBot));
  // Punkt (alle sichtbaren Zeilen tragen yCent).
  if (r.yCent != null) d = Math.min(d, Math.hypot(tX(r._cR) - cv._frqg_mx, tY(r.yCent) - cv._frqg_my));
  // Pfeil (aus _frqg_arrowPos je elNum).
  var ap = cv._frqg_arrowPos && cv._frqg_arrowPos[r.elNum];
  if (ap) d = Math.min(d, _frqg_distSegment(cv._frqg_mx, cv._frqg_my, ap.x1, ap.y, ap.x2, ap.y));
  // Nummern-Labels (je Position).
  var lp = cv._frqg_labelPos && cv._frqg_labelPos[r.elNum];
  if (lp) lp.forEach(function (l) { d = Math.min(d, Math.hypot(l.x - cv._frqg_mx, l.y - cv._frqg_my)); });
  return d;
}

// Tooltip-Handler (BA456). Nutzt r.tooltip (vorformatierte Zeilen).
function _frqg_tooltipHandler(cv, e) {
  if (!cv._frqg_state || !cv._frqg_state.rows) return;
  const rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1,
    scaleX = (cv.width / dpr) / rect.width, scaleY = (cv.height / dpr) / rect.height,
    mx = (e.clientX - rect.left) * scaleX, my = (e.clientY - rect.top) * scaleY;
  cv._frqg_mx = mx; cv._frqg_my = my;
  let tip = document.getElementById("frqg_tooltip");
  if (!tip) {
    tip = document.createElement("div"); tip.id = "frqg_tooltip";
    tip.style.cssText = "position:fixed;background:#1e293b;color:#f8fafc;padding:6px 10px;" +
      "border-radius:6px;font-size:0.82em;pointer-events:none;display:none;z-index:1000;" +
      "line-height:1.6;white-space:nowrap;";
    document.body.appendChild(tip);
  }
  // Naechstliegende Zeile ueber ALLE aufleuchtenden Elemente (nicht nur
  // den Punkt). Schwelle 12 px wie zuvor.
  var beste = null, besteD = 12;
  cv._frqg_state.rows.forEach(function (r) {
    if (!r || !r.sichtbar) return;
    var dd = _frqg_zeilenDistanz(cv, r);
    if (dd <= besteD) { besteD = dd; beste = r; }
  });
  const hit = beste ? { r: beste } : null;
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
