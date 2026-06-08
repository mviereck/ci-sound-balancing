// unterstuetzung-graph.js – Spenden-Verlauf-Graph für den
// Unterstützung-Tab. Pure Canvas-Zeichnung. Stacked Bars pro Monat
// (Dauerspenden + aus Puffer gedeckt + Lücke), horizontale Linien
// für aktuelle Kosten und Vollausbau, vertikaler "Heute"-Marker.

function _ugMonatPlus(m, n) {
  for (var i = 0; i < n; i++) m = finMonatNext(m);
  return m;
}

function _ugMonatLabel(m) {
  // "2026-05" → "05/26"
  var p = m.split("-");
  return p[1] + "/" + p[0].slice(2);
}

function _ugT(key, fallback) {
  if (typeof t === "function") {
    var s = t(key);
    if (s && s !== key) return s;
  }
  return fallback;
}

function _ugRenderGraph() {
  var canvas = document.getElementById("untGraphCanvas");
  if (!canvas) return;
  if (typeof finBerechneZeitreihe !== "function") return;
  if (typeof FINANZEN_BEGIN !== "string") return;

  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.clientWidth  || 720;
  var cssH = canvas.clientHeight || 280;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  var heute = finMonatHeute();
  var bis   = _ugMonatPlus(heute, 24);
  var reihe = finBerechneZeitreihe(FINANZEN_BEGIN, bis);
  if (!reihe.length) return;

  // Layout
  var padL = 110, padR = 18, padT = 16, padB = 38;
  var plotW = cssW - padL - padR;
  var plotH = cssH - padT - padB;

  // Y-Skala: max ≈ Vollausbau × 1.1, geordnet auf 10er/50er Schritte
  var kostenFull    = reihe[0].kostenFull;
  var kostenCurrent = reihe[0].kostenCurrent;
  var maxY = Math.max(kostenFull * 1.1, 1);
  var step = 20;
  while (maxY / step > 8) step += step < 50 ? 10 : 50;
  var maxYRounded = Math.ceil(maxY / step) * step;

  // Koordinaten
  var n = reihe.length;
  var gap = 2;
  var barW = Math.max(2, Math.floor((plotW - gap * (n + 1)) / n));
  function xMonat(i) { return padL + gap + i * (barW + gap); }
  function yEuro(v)  { return padT + plotH - (v / maxYRounded) * plotH; }

  // Y-Gitter + Labels
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth   = 1;
  ctx.fillStyle   = "#555";
  ctx.font        = "11px Segoe UI, sans-serif";
  ctx.textAlign   = "right";
  ctx.textBaseline = "middle";
  for (var v = 0; v <= maxYRounded; v += step) {
    var y = yEuro(v);
    ctx.beginPath();
    ctx.moveTo(padL,         y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(v + " €", padL - 6, y);
  }

  // Stacked Bars
  for (var i = 0; i < n; i++) {
    var r = reihe[i];
    var x = xMonat(i);
    var yBase      = yEuro(0);
    var yDauerTop  = yEuro(r.dauer);
    var yPufferTop = yEuro(r.dauer + r.pufferEingesetzt);
    var yLueckeTop = yEuro(r.dauer + r.pufferEingesetzt + r.luecke);

    if (r.dauer > 0) {
      ctx.fillStyle = "#4a9d4a";
      ctx.fillRect(x, yDauerTop, barW, yBase - yDauerTop);
    }
    if (r.pufferEingesetzt > 0) {
      ctx.fillStyle = "#a8d5a8";
      ctx.fillRect(x, yPufferTop, barW, yDauerTop - yPufferTop);
    }
    if (r.luecke > 0) {
      ctx.fillStyle = "#d94a4a";
      ctx.fillRect(x, yLueckeTop, barW, yPufferTop - yLueckeTop);
    }
  }

  // Differenz-Fläche zwischen aktuellen Kosten und Erweiterung —
  // bündig mit dem Bar-Bereich (linke Kante des ersten Bars bis
  // rechte Kante des letzten Bars), nicht über den ganzen Plot.
  if (kostenFull > kostenCurrent) {
    var flaecheLinks  = xMonat(0);
    var flaecheRechts = xMonat(n - 1) + barW;
    ctx.fillStyle = "rgba(217, 74, 74, 0.18)";
    ctx.fillRect(flaecheLinks,
                 yEuro(kostenFull),
                 flaecheRechts - flaecheLinks,
                 yEuro(kostenCurrent) - yEuro(kostenFull));
  }

  // Linie "aktuelle Kosten" — horizontale Bezugslinie, gestrichelt
  ctx.strokeStyle = "#777";
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenCurrent));
  ctx.lineTo(padL + plotW, yEuro(kostenCurrent));
  ctx.stroke();
  ctx.setLineDash([]);
  // Markierungsstrich + Label links außerhalb des Plots
  ctx.beginPath();
  ctx.moveTo(padL - 28, yEuro(kostenCurrent));
  ctx.lineTo(padL,      yEuro(kostenCurrent));
  ctx.stroke();
  ctx.fillStyle    = "#555";
  ctx.font         = "10.5px Segoe UI, sans-serif";
  ctx.textAlign    = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(_ugT("supportGraphCostCurrent", "aktuelle Kosten"),
               padL - 32, yEuro(kostenCurrent));

  // Linie "Erweiterung" — horizontale Bezugslinie, gepunktet
  ctx.strokeStyle = "#777";
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([1.5, 3]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenFull));
  ctx.lineTo(padL + plotW, yEuro(kostenFull));
  ctx.stroke();
  ctx.setLineDash([]);
  // Markierungsstrich + Label links außerhalb des Plots
  ctx.beginPath();
  ctx.moveTo(padL - 28, yEuro(kostenFull));
  ctx.lineTo(padL,      yEuro(kostenFull));
  ctx.stroke();
  ctx.fillText(_ugT("supportGraphCostFull", "Erweiterung"),
               padL - 32, yEuro(kostenFull));

  // "Heute"-Marker
  var heuteIdx = -1;
  for (var hi = 0; hi < n; hi++) {
    if (reihe[hi].monat === heute) { heuteIdx = hi; break; }
  }
  if (heuteIdx >= 0) {
    var xH = xMonat(heuteIdx) + barW / 2;
    ctx.strokeStyle = "#1e6cd6";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xH, padT);
    ctx.lineTo(xH, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle    = "#1e6cd6";
    ctx.font         = "bold 10.5px Segoe UI, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(_ugT("supportGraphToday", "heute"), xH, padT - 1);
  }

  // X-Achsen-Labels: jeden N-ten Monat
  var labelEvery = n <= 12 ? 1 : (n <= 24 ? 3 : 6);
  ctx.fillStyle    = "#555";
  ctx.font         = "10.5px Segoe UI, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  for (var li = 0; li < n; li++) {
    if (li % labelEvery !== 0 && li !== n - 1) continue;
    var xL = xMonat(li) + barW / 2;
    ctx.fillText(_ugMonatLabel(reihe[li].monat), xL, padT + plotH + 4);
  }

  // Plot-Rahmen
  ctx.strokeStyle = "#999";
  ctx.lineWidth   = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);
}

document.addEventListener("DOMContentLoaded", function () {
  _ugRenderGraph();
});

// Bei Sprachumschaltung Graph neu zeichnen (Linien-Beschriftungen).
document.addEventListener("languagechange-applied", function () {
  _ugRenderGraph();
});

// Bei Fenstergröße neu zeichnen (debounced).
var _ugResizeTimer = null;
window.addEventListener("resize", function () {
  if (_ugResizeTimer) clearTimeout(_ugResizeTimer);
  _ugResizeTimer = setTimeout(_ugRenderGraph, 150);
});
