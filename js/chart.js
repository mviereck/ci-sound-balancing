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


// ============================================================
// FREQ MATCH CHART
// ============================================================
function drawFRQChart(cv, fResData, opts) {
  opts = opts || {};
  const ctx = cv.getContext("2d");
  const fixed = opts.fixedSize || null;
  let w, h, dpr;
  if (fixed) {
    // Feste Druckgroesse (z.B. Audiologen-Ausdruck): kein parentElement,
    // definierte Aufloesung ueber dpr fuer scharfe PNGs.
    dpr = fixed.dpr || 2;
    w = fixed.w;
    h = fixed.h;
  } else {
    // Bildschirm: an den umgebenden Kasten anpassen (unveraendert).
    dpr = window.devicePixelRatio || 1;
    w = cv.parentElement.clientWidth - 32;
    h = 420;
  }
  cv.width = w * dpr;
  cv.height = h * dpr;
  cv.style.width = w + "px";
  cv.style.height = h + "px";
  ctx.scale(dpr, dpr);

  // pad.bottom hat Platz für: Y-Titel-Padding (10) + 6 Label-Zeilen × ~11px (66) + Achsentitel (14) = ~90
  const pad = { top: 80, right: 30, bottom: 54, left: 70 },
    pW = w - pad.left - pad.right,
    pH = h - pad.top - pad.bottom;
  ctx.clearRect(0, 0, w, h);

  cv._frq_chartResultsData = fResData;
  cv._frq_chartOpts = opts;
  if (!fResData || fResData.length === 0) return;
  const frq_chartArrowPos = {}, frq_chartLabelPos = {};

  // i18n mit Fallback (andere Sprachen reichen "Ist"/"Soll" als Key zurück, bis übersetzt)
  const tt = (k, fb) => {
    if (typeof t !== 'function') return fb;
    const v = t(k);
    return (v && v !== k) ? v : fb;
  };
  const lblIst  = tt('FRQ_resultsLblIst',  'Ist');
  const lblSoll = tt('FRQ_resultsLblSoll', 'Soll');

  // Cent gegenüber 1 kHz
  const REF_HZ = 1000;
  const hzToCt = (hz) => 1200 * Math.log2(hz / REF_HZ);

  // Anzeige-Seite (X-Achsenbezug) = aktive (angezeigte) Seite -- der
  // LINKS/RECHTS-Umschalter. Die VERTEILUNG der Verschiebung kommt dagegen
  // aus dem Referenzmodus (im Test bewegte Seite), NICHT aus dem Umschalter;
  // dazu wird er in den "korrigierte Seite"-Modus fuer FRQ_werte uebersetzt.
  const aktivSide = (typeof opts.side === "string") ? opts.side
    : ((typeof activeSide === "string") ? activeSide : "right");
  const measuredByIdx = {};
  for (const r of fResData) measuredByIdx[r.elIdx] = r;

  // EINE Wertquelle (BA419): FRQ_werte liefert je Elektrode fuer beide Seiten
  // die gehoerte Situation (nominell/gehoert/Verschiebung) + Residuum + das
  // "nicht Teil der Messung"-Flag. Der Graph rechnet daraus nur noch seine
  // Achsen-/Pixel-Positionen, keine Frequenz-Ableitung mehr selbst.
  // Mess-Reiter kennt kein NH-Sim -> nhSim=false (gehoerte/Korrektur-Richtung).
  // Default = Mess-Reiter: Verteilung aus dem Referenzmodus, kein NH-Sim.
  // opts.modus / opts.nhSim erlauben Anwendungs-Konsumenten (Ausdruck),
  // stattdessen den Player-warpMode + NH-Sim vorzugeben.
  const modus = (typeof opts.modus === "string") ? opts.modus
    : FRQ_modusVonReferenzmodus(frq_referenzmodus());
  const werte = FRQ_werte("gehoert", modus, !!opts.nhSim);

  // Liste aller Elektroden (alle bekommen mindestens einen Ist-Strich).
  // Iteration ueber die Wertquelle; der Status ("hat Eintrag", fmStatus)
  // kommt weiter aus dem gespeicherten Ergebnis (measuredByIdx).
  const allEls = [];
  for (const wr of werte) {
    const i = wr.elIdx;
    const seite = wr[aktivSide];          // angezeigte Seite
    const r = measuredByIdx[i];           // Ergebnis-Eintrag = Status-Ebene
    const hzIst  = seite.nominellHz;
    const hzSoll = seite.gehoertHz;       // null wenn ungemessen
    const dc     = seite.shiftCent;       // gehoerte Verschiebung, null wenn ungemessen
    allEls.push({
      elIdx: i,
      elNum: dEN(i, aktivSide),
      hzIst: hzIst,
      cIst:  hzToCt(hzIst),
      hzSoll: hzSoll,
      cSoll:  hzSoll != null ? hzToCt(hzSoll) : null,
      dCent:  dc,
      isMeasured: !!r,
      isExcluded: wr.deaktiviert,         // seitenlos: auf mind. einer Seite nicht testbar
      isNotPerceivable: !!(r && r.fmStatus === "not-perceivable"),
      fmStatus:   r ? (r.fmStatus || "converged") : null,
      fmResidual: seite.residuum != null ? seite.residuum : 0,
      r: r,
    });
  }

  // X-Range: Cent-Werte aller Ist- und Soll-Positionen, plus Puffer
  const allCents = [];
  for (const el of allEls) {
    allCents.push(el.cIst);
    if (el.cSoll !== null) allCents.push(el.cSoll);
  }
  const cMinRaw = Math.min(...allCents);
  const cMaxRaw = Math.max(...allCents);
  const cPad = Math.max(100, (cMaxRaw - cMinRaw) * 0.08);
  const cMin = cMinRaw - cPad, cMax = cMaxRaw + cPad;
  const cRange = cMax - cMin || 1;
  const tX = (ct) => pad.left + ((ct - cMin) / cRange) * pW;

  // Residuum (Restunsicherheit der Frequenzbestimmung, in Cent) wird für jede
  // gemessene Elektrode mit fmResidual > 0 angezeigt — gilt einheitlich für
  // alle Verfahren (Klavier wie adaptiv) und für in-progress.
  const hasResidual = (el) =>
    el.isMeasured
    && el.fmStatus !== 'in-progress-early'
    && el.fmResidual > 0;

  // Y-Range: ΔCent, symmetrisch um 0. Der senkrechte T-Balken reicht um
  // ±Residuum über den Punkt hinaus — diese Spitzen einbeziehen, damit der
  // Balken nicht über den Rand läuft.
  const yExtents = [];
  for (const e of allEls) {
    if (e.dCent === null) continue;
    const r = hasResidual(e) ? e.fmResidual : 0;
    yExtents.push(Math.abs(e.dCent) + r);
  }
  const absC = Math.max(Math.ceil(Math.max(...yExtents, 50) / 50) * 50, 50);
  const yMin = -absC, yMax = absC;
  const tY = (c) => pad.top + ((yMax - c) / (yMax - yMin)) * pH;

  // --- Waagerechte Unsicherheit: amberfarbener vertikaler Streifen auf ganzer
  //     Graph-Höhe an der X-Position der Elektrode, ±Residuum breit.
  //     Vor dem Grid, damit er hinter Strichen und Punkten liegt. ---
  for (const el of allEls) {
    if (!hasResidual(el)) continue;
    const xL = tX(el.cSoll - el.fmResidual);
    const xR = tX(el.cSoll + el.fmResidual);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
    ctx.fillRect(xL, pad.top, xR - xL, pH);
  }

  // --- Y-Grid (Cent-Linien, ohne Nullinie hier) ---
  const step = 100;
  const yLabels = [0];
  for (let c = step; c <= absC; c += step) yLabels.push(c, -c);
  ctx.font = "10px Consolas,monospace";
  ctx.textAlign = "right";
  for (const c of yLabels) {
    const y = tY(c);
    if (c !== 0) {
      ctx.strokeStyle = "#e5e5e5";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + pW, y);
      ctx.stroke();
    }
    ctx.fillStyle = (c === 0) ? "#000" : "#999";
    const lbl = c === 0 ? "0" : ((c > 0 ? "+" : "") + c);
    ctx.fillText(lbl, pad.left - 6, y + 3);
  }

  // --- Ist-Striche für ALLE Elektroden (grau) ---
  for (const el of allEls) {
    const x = tX(el.cIst);
    if (el.isMeasured) {
      // Gemessen: durchgezogen
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
    } else {
      // Ungemessen/ausgeschlossen: durchgezogen, etwas heller
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + pH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- Soll-Striche für gemessene Elektroden (schwarz, kräftig) ---
  for (const el of allEls) {
    if (!el.isMeasured) continue;
    const x = tX(el.cSoll);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.75;
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + pH);
    ctx.stroke();
  }

  // --- Nullinie (schwarz, kräftig, oberhalb der Striche) ---
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pad.left, tY(0));
  ctx.lineTo(pad.left + pW, tY(0));
  ctx.stroke();


  // --- Verbindungslinie durch Soll-Punkte (blau) ---
  // in-progress-early hat noch keinen Match → ausschließen
  // in-progress hat einen vorläufigen Match → gestrichelt einschließen
  const measSorted = allEls
    .filter(e => e.isMeasured && e.fmStatus !== 'in-progress-early')
    .sort((a, b) => a.cSoll - b.cSoll);
  if (measSorted.length > 1) {
    const hasProv = measSorted.some(e => e.fmStatus === 'in-progress');
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1.5;
    ctx.setLineDash(hasProv ? [5, 4] : []);
    ctx.beginPath();
    ctx.moveTo(tX(measSorted[0].cSoll), tY(measSorted[0].dCent));
    for (let i = 1; i < measSorted.length; i++)
      ctx.lineTo(tX(measSorted[i].cSoll), tY(measSorted[i].dCent));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- Punkte und Marker ---
  const hitboxes = [];
  for (const el of allEls) {
    if (el.isMeasured) {
      // Ist-Punkt (klein, grau) bei (cIst, 0)
      const xi = tX(el.cIst), yi = tY(0);
      ctx.beginPath();
      ctx.arc(xi, yi, 3, 0, Math.PI * 2);
      ctx.fillStyle = "#6b7280";
      ctx.fill();

      if (el.fmStatus === 'in-progress-early') {
        // <4 Umkehrungen: hohler blauer Kreis am Ist-Strich mit "?"
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth   = 1.5;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.arc(xi, yi, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('?', xi + 8, yi + 4);
        hitboxes.push({ x: xi, y: yi, el: el });
        continue;
      }

      // Soll-Punkt = Messpunkt bei (cSoll, ΔC)
      const xs = tX(el.cSoll), ys = tY(el.dCent);

      // Waagerechte Unsicherheit wird als vertikaler Streifen vor dem Grid
      // gezeichnet (s.o.); hier nur noch der senkrechte T-Balken am Punkt.
      const showResidual = hasResidual(el);

      // Punkt — blau (konvergiert: gefüllt; in-progress: hohl)
      if (el.fmStatus === 'in-progress') {
        ctx.beginPath();
        ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#2563eb';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      hitboxes.push({ x: xs, y: ys, el: el });

      // Senkrechte Unsicherheit: T-Balken über/unter dem Punkt (±Residuum in ΔCent).
      if (showResidual) {
        const halfH = Math.abs(tY(0) - tY(el.fmResidual));
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([]);
        // Senkrechter Stamm mit waagerechten Endkappen oben und unten.
        ctx.beginPath();
        ctx.moveTo(xs, ys - halfH); ctx.lineTo(xs, ys + halfH);
        ctx.moveTo(xs - 4, ys - halfH); ctx.lineTo(xs + 4, ys - halfH);
        ctx.moveTo(xs - 4, ys + halfH); ctx.lineTo(xs + 4, ys + halfH);
        ctx.stroke();
      }
    } else if (el.isNotPerceivable) {
      // Hohles rotes Quadrat mit ✕ auf y=0-Linie am Ist-Strich
      const x = tX(el.cIst), y = tY(0);
      const size = 12;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth   = 1.5;
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);
      ctx.beginPath();
      ctx.moveTo(x - size / 2, y - size / 2);
      ctx.lineTo(x + size / 2, y + size / 2);
      ctx.moveTo(x + size / 2, y - size / 2);
      ctx.lineTo(x - size / 2, y + size / 2);
      ctx.stroke();
      hitboxes.push({ x, y, el });
    } else {
      // Ungemessen/ausgeschlossen: nur Marker bei (cIst, 0)
      const x = tX(el.cIst), y = tY(0);
      if (el.isExcluded) {
        // ✕ (grau)
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 1.75;
        const s = 5;
        ctx.beginPath();
        ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
        ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
        ctx.stroke();
      } else {
        // kleiner Kreis (offen)
        ctx.strokeStyle = "#9ca3af";
        ctx.fillStyle = "#fff";
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // --- X-Skala: Hz und Cent ---
  const yScaleTop = pad.top + pH + 2;
  {
    const hzBase = [125, 250, 500, 1000, 2000, 4000, 8000];
    let tks = hzBase.map(hz => ({ hz, c: hzToCt(hz) })).filter(tk => tk.c > cMin && tk.c < cMax);
    if (tks.length < 2) {
      [188, 375, 750, 1500, 3000, 6000].forEach(hz => {
        const c = hzToCt(hz);
        if (c > cMin && c < cMax) tks.push({ hz, c });
      });
      tks.sort((a, b) => a.c - b.c);
    }
    const shown = [];
    for (const tk of tks)
      if (!shown.length || tX(tk.c) - tX(shown[shown.length - 1].c) >= 44) shown.push(tk);

    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yScaleTop); ctx.lineTo(pad.left + pW, yScaleTop);
    ctx.stroke();

    ctx.textAlign = "center";
    for (const tk of shown) {
      const x = tX(tk.c);
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yScaleTop); ctx.lineTo(x, yScaleTop + 4); ctx.stroke();
      ctx.font = "9px Segoe UI,sans-serif";
      ctx.fillStyle = "#374151";
      ctx.fillText(tk.hz + " Hz", x, yScaleTop + 14);
      const ctLbl = (tk.c >= 0 ? "+" : "") + Math.round(tk.c) + " ct";
      ctx.fillText(ctLbl, x, yScaleTop + 25);
    }
  }

  // --- Achsentitel ---
  ctx.fillStyle = "#666";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(t("FRQ_resultsChartXLabel"), pad.left + pW / 2, h - 6);
  ctx.save();
  ctx.translate(13, pad.top + pH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(t("FRQ_resultsChartYLabel"), 0, 0);
  ctx.restore();

  // --- Horizontale Pfeile oben: Ist → Soll ---
  let arrowLaneCount = 0;
  const crossingEls = new Set();
  {
    const laneH = 12, yBase = pad.top - 6;

    const hArrows = allEls
      .filter(e => e.isMeasured && Math.abs(tX(e.cSoll) - tX(e.cIst)) >= 6)
      .map(e => ({ x1: tX(e.cIst), x2: tX(e.cSoll), el: e }));

    const crossSet = new Set();
    for (let i = 0; i < hArrows.length; i++)
      for (let j = i + 1; j < hArrows.length; j++)
        if ((hArrows[i].x1 - hArrows[j].x1) * (hArrows[i].x2 - hArrows[j].x2) < 0)
          { crossSet.add(i); crossSet.add(j); }
    for (const i of crossSet) crossingEls.add(hArrows[i].el.elIdx);

    const sorted = hArrows
      .map((a, idx) => ({ ...a, idx, left: Math.min(a.x1, a.x2), right: Math.max(a.x1, a.x2) }))
      .sort((a, b) => a.left - b.left);
    const laneRight = [];
    const laneOf = new Array(hArrows.length);
    for (const a of sorted) {
      let lane = laneRight.findIndex(r => r < a.left - 2);
      if (lane === -1) { lane = laneRight.length; laneRight.push(0); }
      laneRight[lane] = a.right;
      laneOf[a.idx] = lane;
    }
    arrowLaneCount = Math.max(1, laneRight.length);

    for (let i = 0; i < hArrows.length; i++) {
      const { x1, x2 } = hArrows[i];
      const y = yBase - laneOf[i] * laneH;
      const color = crossSet.has(i) ? "#ef4444" : "#22c55e";
      frq_chartArrowPos[hArrows[i].el.elIdx] = { x1, x2, y, color };
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5);
      ctx.stroke();
      drawArrow(ctx, x1, y, x2, y, color, true);
    }
  }

  // --- Elektrodennummern oben: über den Pfeilen, gestapelt bei Kollision ---
  {
    const lineH = 11, laneH = 12, laneGap = 2;
    const yBase = pad.top - 6;                          // unterste Pfeil-Lane
    const yLblBottom = yBase - arrowLaneCount * laneH - 4; // unterste Label-Lane

    // Alle Labels (Ist grau + Soll schwarz) in einem Pool. Klavier-Sonderfaelle
    // (piano-crossed/-wide) bekommen am Soll-Label ein gelb-oranges Warndreieck.
    const lblItems = [];
    for (const el of allEls) {
      const cross = crossingEls.has(el.elIdx);
      const warn  = (el.fmStatus === 'piano-crossed' || el.fmStatus === 'piano-wide');
      lblItems.push({ x: tX(el.cIst), text: "E" + el.elNum, color: cross ? "#ef4444" : "#6b7280", el });
      if (el.isMeasured && !el.isExcluded)
        lblItems.push({ x: tX(el.cSoll), text: "E" + el.elNum, color: cross ? "#ef4444" : "#000", el, warn });
    }

    // Greedy Lane-Zuweisung nach x sortiert (Breite ≈ 7px/Zeichen)
    const byX = lblItems.map((lbl, idx) => {
      const hw = lbl.text.length * 3.5 + 2;
      return { ...lbl, idx, left: lbl.x - hw, right: lbl.x + hw };
    }).sort((a, b) => a.left - b.left);
    const laneRight = [];
    const laneOf = new Array(lblItems.length);
    for (const lbl of byX) {
      let lane = laneRight.findIndex(r => r < lbl.left - 2);
      if (lane === -1) { lane = laneRight.length; laneRight.push(0); }
      laneRight[lane] = lbl.right;
      laneOf[lbl.idx] = lane;
    }

    ctx.font = "10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < lblItems.length; i++) {
      const { x, text, color, el, warn } = lblItems[i];
      const y = yLblBottom - laneOf[i] * (lineH + laneGap);
      (frq_chartLabelPos[el.elIdx] = frq_chartLabelPos[el.elIdx] || []).push({ x, y, text });
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
      if (warn) drawWarnTriangle(ctx, x - text.length * 3.5 - 6, y - 4);
      if (el.isMeasured)
        hitboxes.push({ x, y, el });
    }
  }

  // --- Mini-Legende oben rechts ---
  const legX = pad.left + pW - 80, legY = pad.top + 4;
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "left";
  // Ist (grau)
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(legX, legY + 6); ctx.lineTo(legX + 14, legY + 6);
  ctx.stroke();
  ctx.fillStyle = "#6b7280";
  ctx.fillText(lblIst, legX + 18, legY + 9);
  // Soll (schwarz)
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.moveTo(legX, legY + 20); ctx.lineTo(legX + 14, legY + 20);
  ctx.stroke();
  ctx.fillStyle = "#000";
  ctx.fillText(lblSoll, legX + 18, legY + 23);

  cv._frq_chartHitboxes = hitboxes;
  cv._frq_chartState = { ctx, tX, tY, pad, pH, allEls, arrowPos: frq_chartArrowPos, labelPos: frq_chartLabelPos };
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

function _frq_chartDrawHighlight(cv, el) {
  const s = cv._frq_chartState;
  if (!s || !el || !el.isMeasured) return;
  const { ctx, tX, tY, pad, pH, arrowPos, labelPos } = s;
  const HL = "#22c55e";
  const GLOW = "rgba(34,197,94,0.35)";

  // Senkrechte Striche: Glow-Hintergrund
  ctx.setLineDash([]);
  for (const cx of [tX(el.cIst), tX(el.cSoll)]) {
    ctx.strokeStyle = GLOW;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx, pad.top); ctx.lineTo(cx, pad.top + pH);
    ctx.stroke();
  }

  // Ringe um Ist- und Soll-Punkt
  ctx.strokeStyle = HL;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(tX(el.cIst),  tY(0),        9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(tX(el.cSoll), tY(el.dCent), 9, 0, Math.PI * 2); ctx.stroke();

  // Horizontaler Pfeil: dicker neu zeichnen
  const ap = arrowPos[el.elIdx];
  if (ap) {
    const c = ap.color === "#ef4444" ? "#ef4444" : "#22c55e";
    ctx.strokeStyle = c; ctx.lineWidth = 2.5; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(ap.x1, ap.y - 6); ctx.lineTo(ap.x1, ap.y + 6); ctx.stroke();
    drawArrow(ctx, ap.x1, ap.y, ap.x2, ap.y, c, true, 2.5);
  }

  // Elektrodennummern: hinterlegte Highlight-Labels
  const lp = labelPos[el.elIdx];
  if (lp) {
    ctx.font = "bold 10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    for (const lbl of lp) {
      ctx.fillStyle = GLOW;
      ctx.fillRect(lbl.x - 13, lbl.y - 9, 26, 12);
      ctx.fillStyle = HL;
      ctx.fillText(lbl.text, lbl.x, lbl.y);
    }
  }
}

function _frq_chartTooltipHandler(cv, e) {
  if (!cv._frq_chartHitboxes) return;
  const rect = cv.getBoundingClientRect(),
    dpr = window.devicePixelRatio || 1,
    scaleX = (cv.width / dpr) / rect.width,
    scaleY = (cv.height / dpr) / rect.height,
    mx = (e.clientX - rect.left) * scaleX,
    my = (e.clientY - rect.top) * scaleY;
  let tip = document.getElementById("frq_chartTooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "frq_chartTooltip";
    tip.style.cssText =
      "position:fixed;background:#1e293b;color:#f8fafc;padding:6px 10px;" +
      "border-radius:6px;font-size:0.82em;pointer-events:none;display:none;" +
      "z-index:1000;line-height:1.6;white-space:nowrap;";
    document.body.appendChild(tip);
  }
  const hit = cv._frq_chartHitboxes.find((h) => Math.hypot(h.x - mx, h.y - my) <= 12);
  const newEl = hit ? hit.el : null;
  if (newEl !== cv._frq_chartHighEl) {
    cv._frq_chartHighEl = newEl;
    drawFRQChart(cv, cv._frq_chartResultsData, cv._frq_chartOpts || {});
    if (newEl) _frq_chartDrawHighlight(cv, newEl);
  }
  if (hit) {
    const el = hit.el;
    const tipT = (k, fb) => {
      if (typeof t !== 'function') return fb;
      const v = t(k);
      return (v && v !== k) ? v : fb;
    };
    let tipHtml;
    if (el.isNotPerceivable) {
      tipHtml = "<b>E" + el.elNum + "</b><br>" + tipT('FRQ_resultsTipNotPerceivable', 'nicht wahrnehmbar');
    } else {
      const hzIst  = Math.round(el.hzIst);
      const hzSoll = Math.round(el.hzSoll);
      const cIst   = (el.cIst  >= 0 ? "+" : "") + Math.round(el.cIst)  + "\u202fct";
      const cSoll  = (el.cSoll >= 0 ? "+" : "") + Math.round(el.cSoll) + "\u202fct";
      tipHtml = "<b>E" + el.elNum + "</b><br>" +
        hzIst + "\u202fHz \u2192 " + hzSoll + "\u202fHz<br>" +
        cIst + " \u2192 " + cSoll;
      // Restunsicherheit nennen, wenn der Graph daf\u00fcr ein Residuum zeichnet
      // (einheitlich f\u00fcr alle Verfahren; vgl. hasResidual in drawFRQChart).
      const _hasResidual = el.fmStatus !== 'in-progress-early'
                        && el.fmResidual > 0;
      if (_hasResidual) {
        tipHtml += "<br>" + tipT('FRQ_resultsTipResidual', 'Restunsicherheit') +
          " \u00b1" + Math.round(el.fmResidual) + "\u202fct";
      }
      // Warnhinweis bei Klavier-Sonderfaellen (piano-crossed/-wide): Wert wird
      // verwendet, ist aber als unplausibel markiert.
      if (el.fmStatus === 'piano-crossed') {
        tipHtml += "<br>\u26a0\ufe0f " + tipT('FRQ_resultsTipPianoCrossed',
          'Grenzen vertauscht \u2013 Wert unsicher');
      } else if (el.fmStatus === 'piano-wide') {
        tipHtml += "<br>\u26a0\ufe0f " + tipT('FRQ_resultsTipPianoWide',
          'Unsicherheit sehr gro\u00df');
      }
    }
    tip.innerHTML = tipHtml;
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top  = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
}
