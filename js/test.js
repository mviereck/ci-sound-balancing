const ROUND_ROBIN = {
  12: [
    [
      [0, 1],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 11],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 10],
      [9, 11],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [1, 2],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 11],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 11],
      [9, 10],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
  ],
  16: [
    [
      [0, 1],
      [2, 15],
      [3, 14],
      [4, 13],
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 15],
      [1, 14],
      [2, 13],
      [3, 12],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
    [
      [0, 14],
      [13, 15],
      [1, 12],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 13],
      [12, 14],
      [11, 15],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 12],
      [11, 13],
      [10, 14],
      [9, 15],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 11],
      [10, 12],
      [9, 13],
      [8, 14],
      [7, 15],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 10],
      [9, 11],
      [8, 12],
      [7, 13],
      [6, 14],
      [5, 15],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [6, 12],
      [5, 13],
      [4, 14],
      [3, 15],
      [1, 2],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [4, 12],
      [3, 13],
      [2, 14],
      [1, 15],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [2, 12],
      [1, 13],
      [14, 15],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
      [12, 15],
      [13, 14],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 15],
      [11, 14],
      [12, 13],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 15],
      [9, 14],
      [10, 13],
      [11, 12],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 15],
      [7, 14],
      [8, 13],
      [9, 12],
      [10, 11],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 15],
      [5, 14],
      [6, 13],
      [7, 12],
      [8, 11],
      [9, 10],
    ],
  ],
  22: [
    [
      [0, 1],
      [2, 21],
      [3, 20],
      [4, 19],
      [5, 18],
      [6, 17],
      [7, 16],
      [8, 15],
      [9, 14],
      [10, 13],
      [11, 12],
    ],
    [
      [0, 21],
      [1, 20],
      [2, 19],
      [3, 18],
      [4, 17],
      [5, 16],
      [6, 15],
      [7, 14],
      [8, 13],
      [9, 12],
      [10, 11],
    ],
    [
      [0, 20],
      [19, 21],
      [1, 18],
      [2, 17],
      [3, 16],
      [4, 15],
      [5, 14],
      [6, 13],
      [7, 12],
      [8, 11],
      [9, 10],
    ],
    [
      [0, 19],
      [18, 20],
      [17, 21],
      [1, 16],
      [2, 15],
      [3, 14],
      [4, 13],
      [5, 12],
      [6, 11],
      [7, 10],
      [8, 9],
    ],
    [
      [0, 18],
      [17, 19],
      [16, 20],
      [15, 21],
      [1, 14],
      [2, 13],
      [3, 12],
      [4, 11],
      [5, 10],
      [6, 9],
      [7, 8],
    ],
    [
      [0, 17],
      [16, 18],
      [15, 19],
      [14, 20],
      [13, 21],
      [1, 12],
      [2, 11],
      [3, 10],
      [4, 9],
      [5, 8],
      [6, 7],
    ],
    [
      [0, 16],
      [15, 17],
      [14, 18],
      [13, 19],
      [12, 20],
      [11, 21],
      [1, 10],
      [2, 9],
      [3, 8],
      [4, 7],
      [5, 6],
    ],
    [
      [0, 15],
      [14, 16],
      [13, 17],
      [12, 18],
      [11, 19],
      [10, 20],
      [9, 21],
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
    [
      [0, 14],
      [13, 15],
      [12, 16],
      [11, 17],
      [10, 18],
      [9, 19],
      [8, 20],
      [7, 21],
      [1, 6],
      [2, 5],
      [3, 4],
    ],
    [
      [0, 13],
      [12, 14],
      [11, 15],
      [10, 16],
      [9, 17],
      [8, 18],
      [7, 19],
      [6, 20],
      [5, 21],
      [1, 4],
      [2, 3],
    ],
    [
      [0, 12],
      [11, 13],
      [10, 14],
      [9, 15],
      [8, 16],
      [7, 17],
      [6, 18],
      [5, 19],
      [4, 20],
      [3, 21],
      [1, 2],
    ],
    [
      [0, 11],
      [10, 12],
      [9, 13],
      [8, 14],
      [7, 15],
      [6, 16],
      [5, 17],
      [4, 18],
      [3, 19],
      [2, 20],
      [1, 21],
    ],
    [
      [0, 10],
      [9, 11],
      [8, 12],
      [7, 13],
      [6, 14],
      [5, 15],
      [4, 16],
      [3, 17],
      [2, 18],
      [1, 19],
      [20, 21],
    ],
    [
      [0, 9],
      [8, 10],
      [7, 11],
      [6, 12],
      [5, 13],
      [4, 14],
      [3, 15],
      [2, 16],
      [1, 17],
      [18, 21],
      [19, 20],
    ],
    [
      [0, 8],
      [7, 9],
      [6, 10],
      [5, 11],
      [4, 12],
      [3, 13],
      [2, 14],
      [1, 15],
      [16, 21],
      [17, 20],
      [18, 19],
    ],
    [
      [0, 7],
      [6, 8],
      [5, 9],
      [4, 10],
      [3, 11],
      [2, 12],
      [1, 13],
      [14, 21],
      [15, 20],
      [16, 19],
      [17, 18],
    ],
    [
      [0, 6],
      [5, 7],
      [4, 8],
      [3, 9],
      [2, 10],
      [1, 11],
      [12, 21],
      [13, 20],
      [14, 19],
      [15, 18],
      [16, 17],
    ],
    [
      [0, 5],
      [4, 6],
      [3, 7],
      [2, 8],
      [1, 9],
      [10, 21],
      [11, 20],
      [12, 19],
      [13, 18],
      [14, 17],
      [15, 16],
    ],
    [
      [0, 4],
      [3, 5],
      [2, 6],
      [1, 7],
      [8, 21],
      [9, 20],
      [10, 19],
      [11, 18],
      [12, 17],
      [13, 16],
      [14, 15],
    ],
    [
      [0, 3],
      [2, 4],
      [1, 5],
      [6, 21],
      [7, 20],
      [8, 19],
      [9, 18],
      [10, 17],
      [11, 16],
      [12, 15],
      [13, 14],
    ],
    [
      [0, 2],
      [1, 3],
      [4, 21],
      [5, 20],
      [6, 19],
      [7, 18],
      [8, 17],
      [9, 16],
      [10, 15],
      [11, 14],
      [12, 13],
    ],
  ],
};

// ============================================================
// PAIRS & WEIGHTED LEAST SQUARES
// ============================================================
function actEl() {
  return [...Array(nEl).keys()].filter(
    (i) => elExDur[i] === null && elSt[i] !== "mute",
  );
}
function allEl() {
  return [...Array(nEl).keys()];
}
function allPairs() {
  const a = actEl(),
    p = [];
  for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++) p.push([a[i], a[j]]);
  return p;
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function randAB(p) {
  return p.map(([x, y]) => (Math.random() < 0.5 ? [x, y] : [y, x]));
}
function ell_gWt(i, elSt_, elExDur_) {
  var _elSt    = elSt_    || elSt;
  var _elExDur = elExDur_ || elExDur;
  const s = _elSt[i];
  if (_elExDur[i] !== null || s === "mute") return 0;
  if (s === "almostMute") return 0.05;
  if (s === "noisyHeavy") return 0.15;
  if (s === "noisyMore")  return 0.4;
  if (s === "noisyLess")  return 0.8;
  return 1;
}
function ELL_compWLS(ctx) {
  ctx = ctx || {};
  var _nEl     = (ctx.nEl        != null) ? ctx.nEl        : nEl;
  var _results = (ctx.ELL_results != null) ? ctx.ELL_results : ELL_results;
  var _elSt    = (ctx.elSt       != null) ? ctx.elSt       : elSt;
  var _elExDur = (ctx.elExDur    != null) ? ctx.elExDur    : elExDur;
  var _refEl   = (ctx.ELL_refEl  != null) ? ctx.ELL_refEl  : ELL_refEl;

  const n = _nEl,
    lv = new Array(n).fill(0);
  const valid = _results.filter(
    (r) =>
      r.a >= 0 &&
      r.a < n &&
      r.b >= 0 &&
      r.b < n &&
      _elExDur[r.a] === null &&
      _elSt[r.a] !== "mute" &&
      _elExDur[r.b] === null &&
      _elSt[r.b] !== "mute",
  );
  if (!valid.length)
    return {
      levels: lv,
      residuals: [],
      ELL_res: new Array(n).fill(0),
      ELL_wt: new Array(n).fill(1),
    };
  for (let it = 0; it < 80; it++) {
    const su = new Array(n).fill(0),
      wt = new Array(n).fill(0);
    for (const r of valid) {
      const w = Math.min(ell_gWt(r.a, _elSt, _elExDur), ell_gWt(r.b, _elSt, _elExDur));
      su[r.b] += (lv[r.a] - r.offset) * w;
      wt[r.b] += w;
      su[r.a] += (lv[r.b] + r.offset) * w;
      wt[r.a] += w;
    }
    for (let i = 0; i < n; i++) {
      if (i === _refEl) {
        lv[i] = 0;
        continue;
      }
      if (wt[i] > 0) lv[i] = su[i] / wt[i];
    }
  }
  const res = valid.map((r) => ({
    ...r,
    residual: Math.abs(r.offset - (lv[r.a] - lv[r.b])),
  }));
  const ea = new Array(n).fill(null).map(() => []);
  for (const r of res) {
    ea[r.a].push(r.residual);
    ea[r.b].push(r.residual);
  }
  const ELL_res = ea.map((a) =>
    a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0,
  );
  return {
    levels: lv,
    residuals: res,
    ELL_res,
    ELL_wt: new Array(n).fill(0).map((_, i) => ell_gWt(i, _elSt, _elExDur)),
  };
}

// ============================================================
// ELL_testData — EINZIGE Schnittstelle zu den Ergebnissen des
// Elektrodenlautstaerke-Tests (ELL_compWLS). Alle Stellen, die diese
// Werte brauchen (Korrektur wie Anzeige), rufen NUR diese Funktion
// auf und drehen das Vorzeichen NICHT mehr selbst.
//
// Ruft ELL_compWLS() genau EINMAL pro Aufruf und liefert ein Objekt:
//   raw[i]            rohe Mess-dB direkt aus ELL_compWLS (ungegatet).
//                     Ist-Zustand: zu leise => negativ. Fuer Anzeige
//                     und Statistik, die ihren eigenen Filter haben.
//   measured[i]       Ist-Zustand, GEGATET: Elektrode ohne gueltige
//                     Messdaten / ausgeschlossen / stumm => 0.
//   correction[i]     KORREKTUR-dB, gegatet: zu leise => POSITIV
//                     (= beim Abspielen anheben). = -measured.
//   correctionGain[i] correction als linearer Faktor dB2G(correction);
//                     ungemessen => 1 (neutral).
//   residual[i]       Streuung/Residuum pro Elektrode (ELL_res).
//   weight[i]         Gewicht pro Elektrode (ELL_wt).
//
// opts.side: optionale Seite ("left"/"right"); sonst aktive Seite.
//
// Das Gate (gueltige Messdaten?) ist hier dieselbe Bedingung wie der
// frueher in player.js/tone-popup.js duplizierte hd-Check.
function ELL_testData(opts) {
  opts = opts || {};
  const _ctx = opts.ctx || {};
  const run = function () {
    var _nEl      = (_ctx.nEl        != null) ? _ctx.nEl        : nEl;
    var _results  = (_ctx.ELL_results != null) ? _ctx.ELL_results : ELL_results;
    var _elSt     = (_ctx.elSt       != null) ? _ctx.elSt       : elSt;
    var _elExDur  = (_ctx.elExDur    != null) ? _ctx.elExDur    : elExDur;
    const n = _nEl;
    const { levels, ELL_res, ELL_wt } = ELL_compWLS(opts.ctx);
    const measured = new Array(n);
    const correction = new Array(n);
    const correctionGain = new Array(n);
    for (let i = 0; i < n; i++) {
      const hd = _results.some(function (r) {
        return (r.a === i || r.b === i)
          && _elExDur[r.a] === null && _elSt[r.a] !== "mute"
          && _elExDur[r.b] === null && _elSt[r.b] !== "mute";
      });
      const m = (hd && isFinite(levels[i])) ? levels[i] : 0;
      measured[i] = m;
      correction[i] = -m;
      correctionGain[i] = dB2G(-m);
    }
    return {
      raw: levels,
      measured: measured,
      correction: correction,
      correctionGain: correctionGain,
      residual: ELL_res,
      weight: ELL_wt,
    };
  };
  return opts.side ? withSide(opts.side, run) : run();
}

// BA 300: Frequenzaufgeloeste Elektrodenlautstaerke-Korrektur (linearer
// Gain) fuer eine Seite. Liest die bereits gegatete, vorzeichenrichtige
// correction-dB pro Elektrode (ELL_testData) und interpoliert log-linear
// ueber die Elektroden-Frequenzen bei hz. Liefert 1 (neutral), wenn keine
// Messdaten/Frequenzen vorliegen. Logik identisch zu FRQ_correctionGain
// (freqmatch.js); zentralisiert, damit alle Korrektur-Aufrufer (Klavier,
// Vorspiel, Sweep) dieselbe Quelle nutzen.
function ELL_measGain(side, hz) {
  return withSide(side, function () {
    // BA 303: defensive Abfragen (aus FRQ_correctionGain uebernommen). Ohne
    // Mess-Paare oder ohne ELL_compWLS neutral zurueck, BEVOR ELL_testData()
    // gerufen wird (nutzt intern ELL_results.some -> wuerde sonst werfen).
    if (typeof ELL_results === "undefined" || !ELL_results || ELL_results.length === 0) return 1;
    if (typeof ELL_compWLS !== "function") return 1;
    var levels = ELL_testData({ ctx: ELL_ctx("global") }).correction;
    if (!levels || !levels.length) return 1;
    var nEff = (typeof nEl === "number" && nEl > 0) ? nEl
             : ((typeof FRQ_implantat !== "undefined" && FRQ_implantat) ? FRQ_implantat.length : 0);
    if (!nEff) return 1;
    var f = [];
    for (var _fi = 0; _fi < nEff; _fi++) f.push(FRQ_implantatEffektiv(_fi));
    if (!f.length) return 1;
    var n = f.length;
    if (n === 1) return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
    var lg = Math.log(hz);
    var lgFirst = Math.log(f[0]);
    var lgLast  = Math.log(f[n - 1]);
    var ascending = lgLast > lgFirst;
    if (ascending) {
      if (lg <= lgFirst) return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      if (lg >= lgLast)  return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
    } else {
      if (lg >= lgFirst) return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      if (lg <= lgLast)  return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
    }
    for (var i = 0; i < n - 1; i++) {
      var lgA = Math.log(f[i]);
      var lgB = Math.log(f[i + 1]);
      var lo = Math.min(lgA, lgB);
      var hi = Math.max(lgA, lgB);
      if (lg >= lo && lg <= hi) {
        var elsA = levels[i];
        var elsB = levels[i + 1];
        if (!isFinite(elsA) && !isFinite(elsB)) return 1;
        if (!isFinite(elsA)) return dB2G(elsB);
        if (!isFinite(elsB)) return dB2G(elsA);
        var tNum = lg - lgA;
        var tDen = lgB - lgA;
        var tt = (tDen === 0) ? 0 : (tNum / tDen);
        var lv = elsA + (elsB - elsA) * tt;
        return dB2G(lv);
      }
    }
    return 1;
  });
}

// BA 300: Kombinierter Pegel-Korrektor. Wendet auf einen Grundpegel die
// Elektrodenlautstaerke- und/oder die Stereo-Balance-Korrektur an.
// side: "left" | "right" (vom Aufrufer aus dem Pan abgeleitet).
// applyELL / applyBal: einzeln schaltbar -- im Implantat-Reiter ueber die
// zwei Box-Schalter, in den Mess-Reitern beide true. Balance kommt aus
// STB_rawGains() (respektiert den Balance-Modus).
function corrVol(vol, side, hz, applyELL, applyBal) {
  var v = vol;
  if (applyELL && typeof ELL_measGain === "function") {
    v *= ELL_measGain(side, hz);
  }
  if (applyBal && typeof STB_rawGains === "function") {
    var bg = STB_rawGains() || { left: 0, right: 0 };
    var bd = (side === "left") ? bg.left : (side === "right") ? bg.right : 0;
    if (bd) v *= dB2G(bd);
  }
  return v;
}

function getConvPairs(fast) {
  if (fast && ELL_results.length > 0) {
    const { residuals } = ELL_compWLS(ELL_ctx("global"));
    const act = new Set(actEl());
    const vr = residuals
      .filter((r) => act.has(r.a) && act.has(r.b))
      .sort((a, b) => b.residual - a.residual);
    const tp = vr
      .slice(0, Math.max(5, Math.ceil(vr.length * 0.2)))
      .map((r) => [r.a, r.b]);
    const ap = allPairs(),
      ex = shuffle(ap).slice(0, Math.min(5, ap.length));
    const seen = new Set(),
      mg = [];
    [...tp, ...ex].forEach((p) => {
      const k = Math.min(p[0], p[1]) + "-" + Math.max(p[0], p[1]);
      if (!seen.has(k)) {
        seen.add(k);
        mg.push(p);
      }
    });
    return mg;
  }
  return allPairs();
}

// ============================================================
// LS-HINT: Schätzung und Unsicherheit für Paar (a, b)
// ============================================================
function ell_getLsEstimate(a, b) {
  if (ELL_results.length === 0) return { estimate: 0, halfWidth: 0, hasData: false };
  const { raw: levels, residual: ELL_res } = ELL_testData({ ctx: ELL_ctx("global") });
  const wA = ell_gWt(a), wB = ell_gWt(b);
  if (wA <= 0 || wB <= 0) return { estimate: 0, halfWidth: 0, hasData: false };
  const nA = ELL_results.filter(r => r.a === a || r.b === a).length;
  const nB = ELL_results.filter(r => r.a === b || r.b === b).length;
  const N = Math.min(nA, nB);
  const resTerm = Math.max(ELL_res[a] || 0, ELL_res[b] || 0);
  const prior = LS_HINT_BASIS_DB * LS_HINT_K / (LS_HINT_K + N);
  const halfWidth = Math.sqrt(resTerm * resTerm + prior * prior);
  return { estimate: levels[a] - levels[b], halfWidth, hasData: true };
}

// ============================================================
// TEST — Element-Lookup via ELL_testEls (gebaut von buildTestPanel)
// ============================================================
let ELL_testEls = null;
// LS-Hint Parameter (Bauanleitung 61)
const LS_HINT_BASIS_DB = 2.5;
const LS_HINT_K = 3;
// BA 250: Helfer analog FRQ_getVolume/FRQ_getDuration/FRQ_getPause in freqmatch.js.
// Lesen direkt aus den State-Variablen; macht die quadratische
// Audio-Konversion fuer die Lautstaerke.
function tGVol() { return Math.pow((volume_global || 0) / 100, 2); }
function tGDur() { return duration_elektrodenlautstaerke || 750; }
function tGPau() { return pause_elektrodenlautstaerke    || 300; }

// BA 252: Klavier-Helfer fuer die Tonauswahl-Modalbox des
// Elektrodenlautstaerke-Tests. Eine Seite (aktive Seite), alle
// Elektroden anzeigen, abgewaehlte/ausgeschlossene als disabled.
function _ell_tpElectrodeFreqs() {
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(FRQ_implantatEffektiv(i));
  return arr;
}
function _ell_tpElectrodeLabels() {
  var prefix = (typeof dENPrefix === 'function') ? dENPrefix() : 'E';
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    arr.push(prefix + ((typeof dEN === 'function') ? dEN(i) : (i + 1)));
  }
  return arr;
}
function _ell_tpDisabledElectrodes() {
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    if (elActive[i] === false) { arr.push(i); continue; }
    if (typeof elExDur !== 'undefined' && elExDur[i] != null) { arr.push(i); continue; }
  }
  return arr;
}

// BA 252: Korrektur-Toggle-Callback und Modal-Ton-Zwischenspeicher.
var _ell_tpCorrectVol = null;
var _ell_tpModalTone  = null;

function _ell_sliderVal() {
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  return (vref && vref.slider && vref.slider.input)
    ? parseFloat(vref.slider.input.value) : 0;
}


// ---- Swap-Helfer ----
function _ell_swap() {
  if (!ELL_testAct || ELL_testIdx >= ELL_testPairs.length || !ELL_testEls) return;
  stopAll();
  var oldVal = _ell_sliderVal();
  var swapped = [ELL_curB, ELL_curA];
  ELL_curA = swapped[0]; ELL_curB = swapped[1];
  ELL_testPairs[ELL_testIdx] = [ELL_curA, ELL_curB];
  var newVal = -oldVal;
  var vref = ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, newVal);
    testUI.slider.setValueDisplay(vref.slider, newVal.toFixed(1) + " dB");
  }
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(ELL_curA),
      rightText: dENPrefix() + dEN(ELL_curB),
      leftHz:    Math.round(FRQ_implantatEffektiv(ELL_curA)),
      rightHz:   Math.round(FRQ_implantatEffektiv(ELL_curB))
    });
  }
  _ell_updateRangeHint();
  ELL_updateClipHint();
}

// BA 247: Round-Robin-Start (frueher 'full' in startTest)
function startTestFull() {
  if (!ELL_testEls) return;
  var s = sideData[activeSide];
  var rrTable = ROUND_ROBIN[nEl];
  var p;
  if (!rrTable) {
    p = allPairs();
  } else {
    if (s.fullSweepRound === null) {
      s.fullSweepRound = 1;
      s.fullSweepDonePairs = [];
    }
    fullSweepRound = s.fullSweepRound;
    fullSweepDonePairs = s.fullSweepDonePairs;
    var roundPairs = rrTable[fullSweepRound - 1];
    var actSet = new Set(actEl());
    var available = roundPairs.filter(function(p) {
      return actSet.has(p[0]) && actSet.has(p[1]);
    });
    var doneSet = new Set(fullSweepDonePairs.map(function(p) {
      return p[0] + "-" + p[1];
    }));
    p = available.filter(function(p) {
      return !doneSet.has(p[0] + "-" + p[1]);
    });
  }
  // BA 247: Elektroden-Auswahl im Header filtert die Sequenz.
  p = _ell_filterByElectrodeSelection(p);
  ELL_testPairs = randAB(shuffle(p));
  ELL_testIdx = 0;
  undoSt = [];
  ELL_testAct = true;
  ELL_curPlayed = false;
  convRnd = 0;
  lockTestTabs(true, 'elektrodenlautstaerke');
  ell_showCurPair();
}

// BA 247: Konvergenz-Start (frueher 'conv_fast' in startTest)
function startTestConv() {
  if (!ELL_testEls) return;
  var p = getConvPairs(true);
  p = _ell_filterByElectrodeSelection(p);
  ELL_testPairs = randAB(shuffle(p));
  ELL_testIdx = 0;
  undoSt = [];
  ELL_testAct = true;
  ELL_curPlayed = false;
  convRnd = 1;
  lockTestTabs(true, 'elektrodenlautstaerke');
  ell_showCurPair();
}

// BA 247: Sequenz auf die im Header gewaehlten Elektroden filtern.
// BA 247fix: UND-Logik statt ODER. Es werden nur Paare gespielt,
// in denen BEIDE Elektroden in der Auswahl stehen. Konsequenz: ein
// Paarvergleich braucht mindestens zwei ausgewaehlte Elektroden
// (vgl. minSelected: 2 im electrodeSelection-Block).
function _ell_filterByElectrodeSelection(pairs) {
  var sel = _ell_selectedEls;
  if (!sel || !sel.length) return pairs;
  var s = new Set(sel);
  return pairs.filter(function(p) {
    return s.has(p[0]) && s.has(p[1]);
  });
}

// Bugfix (0.4.279.1): Aenderung der Elektrodenauswahl WAEHREND eines
// laufenden Tests. _ell_filterByElectrodeSelection greift nur beim Start
// (startTestFull/startTestConv); ohne diesen Helfer blieben abgewaehlte
// Elektroden in der bereits gebauten Sequenz und wurden weiter abgefragt.
// Semantik (im Modal bestaetigt): ein betroffenes aktuelles Paar wird
// sofort uebersprungen; bereits absolvierte Vergleiche bleiben erhalten.
function _ell_applySelectionDuringRun() {
  if (!ELL_testAct || ELL_testIdx >= ELL_testPairs.length) return;
  var sel = _ell_selectedEls;
  if (!sel || !sel.length) return;
  var s = new Set(sel);
  var cur = ELL_testPairs[ELL_testIdx];
  var ell_curAffected = !(s.has(cur[0]) && s.has(cur[1]));
  // Ab der aktuellen Position nur Paare behalten, deren beide Elektroden
  // noch ausgewaehlt sind. Bereits gespielte Vergleiche unangetastet.
  var rem = ELL_testPairs.slice(ELL_testIdx).filter(function(p) {
    return s.has(p[0]) && s.has(p[1]);
  });
  ELL_testPairs = ELL_testPairs.slice(0, ELL_testIdx).concat(rem);
  if (ELL_testIdx >= ELL_testPairs.length) {
    endTest();
    ELL_renderResults();
  } else if (ell_curAffected) {
    // Aktuelles Paar war betroffen -> sofort zum naechsten gueltigen.
    stopAll();
    ell_showCurPair();
  } else {
    // Aktuelles Paar bleibt; nur Restzahl/Fortschritt aktualisieren.
    _ell_updateProgress();
  }
}
function endTest() {
  stopAll();
  ELL_testAct = false;
  ELL_curPlayed = false;
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 278fix: Natuerliches Testende muss die Test-UI zuruecksetzen
  // (testBox ausblenden, Start/Stop-Button-Zustand, Laufzustand beenden).
  // Bisher rief nur der Stop-Button _stopTest() auf; die natuerlichen
  // Endpfade (nextFullRound, nextConvRnd) uebersprangen es, sodass
  // der Test nach dem letzten Vergleich haengen blieb (kein Ton, kein
  // Abschluss). _stopTest hat einen Re-Entry-Schutz (_testRunning), der
  // Aufruf ueber den onStop-Hook (-> endTest) laeuft also nicht in eine
  // Endlosschleife. Vgl. STB_finish in stereobalance-balance.js.
  if (ELL_testEls && ELL_testEls._stopTest) ELL_testEls._stopTest();
}
function ell_showCurPair() {
  if (!ELL_testEls) return;
  if (ELL_testIdx >= ELL_testPairs.length) {
    if (convRnd === 0) return nextFullRound();
    if (convRnd > 0)  return nextConvRnd();
    endTest();
    ELL_renderResults();
    return;
  }
  var pair = ELL_testPairs[ELL_testIdx];
  ELL_curA = pair[0];
  ELL_curB = pair[1];

  _ell_updateProgress();

  var vref = ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(ELL_curA),
      rightText: dENPrefix() + dEN(ELL_curB),
      leftHz:    Math.round(FRQ_implantatEffektiv(ELL_curA)),
      rightHz:   Math.round(FRQ_implantatEffektiv(ELL_curB))
    });
  }

  // BA 247: ELL_curBase ist immer 0. Slider sitzt auf dem gespeicherten
  // Wert (falls vorhanden).
  // Direkt-Edit 280.2: Paar ohne eigenen Messwert startet am zufaellig
  // gewaehlten Rand des Unsicherheitsbandes der Voreinschaetzung
  // (estimate +/- halfWidth), nicht in dessen Mitte. Grund: ein Start
  // exakt auf dem Schaetzwert macht blosses Bestaetigen zu einem
  // Null-Residuum, wodurch die errechnete Unsicherheit kuenstlich gegen
  // 0 schrumpft (Scheinkonvergenz). Das zufaellige Vorzeichen haelt den
  // Mittelwert bias-frei, das volle halfWidth erhaelt die Streuung.
  // Ohne Datenbasis (kein hasData) weiterhin 0 dB. Gilt fuer beide
  // Verfahren (full / conv); im Konvergenz-Normalfall greift fast immer
  // der gespeicherte Wert.
  ELL_curBase = 0;
  var ex = ELL_results.find(function(r) {
    return (r.a === ELL_curA && r.b === ELL_curB) || (r.a === ELL_curB && r.b === ELL_curA);
  });
  var startVal = 0;
  if (ex) {
    startVal = (ex.a === ELL_curA) ? ex.offset : -ex.offset;
  } else {
    var estStart = ell_getLsEstimate(ELL_curA, ELL_curB);
    if (estStart.hasData) {
      var edgeSign = (Math.random() < 0.5) ? -1 : 1;
      startVal = estStart.estimate + edgeSign * estStart.halfWidth;
    }
  }
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, startVal);
    testUI.slider.setValueDisplay(vref.slider, startVal.toFixed(1) + " dB");
  }

  _ell_updateRangeHint();
  ELL_updateClipHint();

  ELL_curPlayed = false;
  ell_updUndo();
  playCur();
}

// BA 247: Helfer fuer ell_showCurPair, ehemals inline.
let _ELL_activeVerfahren = "full";

function _ell_updateProgress() {
  var vref = ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (!vref || !vref.progress) return;
  if (_ELL_activeVerfahren === "full") {
    var s = sideData[activeSide];
    var rrTable = ROUND_ROBIN[nEl];
    if (rrTable) {
      var maxRounds = rrTable.length;
      var pairsPerRound = rrTable[0].length;
      var completedRounds = (s.fullSweepRound || 1) - 1;
      var totalPairs = maxRounds * pairsPerRound;
      var n = completedRounds * pairsPerRound + ELL_testIdx + 1;
      // BA 247fix2: progress.set erwartet ein opts-Objekt, kein String.
      testUI.progress.set(vref.progress, {
        text: t("comp") + " " + n + " " + t("of") + " " + totalPairs +
              ". " + t("round") + " " + (s.fullSweepRound || 1) + " " + t("of") + " " + maxRounds,
        fraction: n / totalPairs
      });
    }
  } else {
    testUI.progress.set(vref.progress, {
      text: t("comp") + " " + (ELL_testIdx + 1) + " " + t("of") + " " + ELL_testPairs.length +
            (convRnd > 0 ? " (" + t("round") + " " + convRnd + ")" : ""),
      fraction: (ELL_testIdx + 1) / Math.max(1, ELL_testPairs.length)
    });
  }
}

// BA 285: Deckelungs-Hinweis aktualisieren. off optional (sonst aktueller
// Slider-Wert). Nutzt pairGains.capped aus audio.js (BA 284).
function ELL_updateClipHint(off) {
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (!vref || !vref.clipHint) return;
  if (off == null) off = _ell_sliderVal();
  var g = pairGains(tGVol(), off);
  if (!g.capped) {
    testUI.clipHint.set(vref.clipHint, null);
    return;
  }
  var prefix = dENPrefix();
  var labelA = prefix + dEN(ELL_curA);
  var labelB = prefix + dEN(ELL_curB);
  var capLabel   = (g.capped === 'a') ? labelA : labelB;
  var otherLabel = (g.capped === 'a') ? labelB : labelA;
  var txt = t('clipHintCapped').replace('{capped}', capLabel).replace('{other}', otherLabel);
  testUI.clipHint.set(vref.clipHint, txt);
}

// BA 285: Slider-Bewegung. Da jetzt ein onSlide-Hook vorhanden ist,
// uebernimmt dieser auch die dB-Anzeige (das Auto-Update in test-ui.js
// laeuft nur OHNE onSlide-Hook).
function _ell_onSlide(off) {
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (vref && vref.slider) {
    testUI.slider.setValueDisplay(vref.slider, off.toFixed(1) + " dB");
  }
  ELL_updateClipHint(off);
}

function _ell_updateRangeHint() {
  var vref = ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (!vref || !vref.slider) return;
  if (!ELL_testAct || ELL_testIdx >= ELL_testPairs.length) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  var est = ell_getLsEstimate(ELL_curA, ELL_curB);
  if (!est.hasData) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  testUI.slider.setRangeHint(vref.slider, {
    marker: est.estimate,
    label:  (est.estimate >= 0 ? "+" : "") + est.estimate.toFixed(1) + " dB",
    min:    est.estimate - est.halfWidth,
    max:    est.estimate + est.halfWidth
  });
}
function playCur() {
  if (ELL_testIdx >= ELL_testPairs.length) return;
  stopAll();
  isPlay = true;
  ELL_curPlayed = true;
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  // setPlaying('both') setzt die Replay-Sperre (confirm, swap). Das
  // praezise Aufleuchten pro Ton macht jetzt der onStepStart-Hook.
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
  testUI.tonePlayer.playSequential(
    _ell_sequence({ aba: sequence_elektrodenlautstaerke === 'aba' }),
    {
      toneType: toneType_elektrodenlautstaerke,
      onStepStart: function (index, token) {
        if (token && typeof token.eIdx === 'number') updInd(token.eIdx, token.which);
        else updInd(-1);
      },
      onDone: function () {
        isPlay = false;
        if (vref && vref.pairIndicator) {
          testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
        }
      }
    }
  );
}
function ell_recBal() {
  if (!ELL_testAct || ELL_testIdx >= ELL_testPairs.length) return;
  // BA 247: ELL_curBase ist immer 0.
  const a = ELL_curA, b = ELL_curB, tot = _ell_sliderVal();
  const ne = { a, b, offset: tot, timestamp: Date.now() };
  const ei = ELL_results.findIndex((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (ei >= 0) {
    undoSt.push({ t: "b", a: "r", e: ne, p: { ...ELL_results[ei] } });
    ELL_results[ei] = ne;
  } else {
    undoSt.push({ t: "b", a: "a", e: ne });
    ELL_results.push(ne);
  }
  // BA 247: Vollstaendig: gemessenes Paar als erledigt markieren.
  if (_ELL_activeVerfahren === "full") {
    const ka = Math.min(a, b), kb = Math.max(a, b);
    const s = sideData[activeSide];
    if (!s.fullSweepDonePairs.some(([x, y]) => x === ka && y === kb)) {
      s.fullSweepDonePairs.push([ka, kb]);
    }
    fullSweepDonePairs = s.fullSweepDonePairs;
  }
  ELL_testIdx++;
  ell_updUndo();
  ell_showCurPair();
}
function ell_undoL() {
  if (!ELL_testAct || !undoSt.length || ELL_testIdx <= 0) return;
  stopAll();
  ELL_testIdx--;
  const u = undoSt.pop();
  // BA 247: nur noch der b-Pfad (balance); j-Pfad entfaellt mit judgment.
  if (u.a === "a") {
    const i = ELL_results.findIndex(function(x) { return x.timestamp === u.e.timestamp; });
    if (i >= 0) ELL_results.splice(i, 1);
  } else {
    const i = ELL_results.findIndex(function(x) { return x.a === u.e.a && x.b === u.e.b; });
    if (i >= 0) ELL_results[i] = u.p;
  }
  // Bug-Fix §6.9: Bei full-Verfahren auch aus fullSweepDonePairs entfernen.
  if (_ELL_activeVerfahren === "full") {
    const ka = Math.min(u.e.a, u.e.b);
    const kb = Math.max(u.e.a, u.e.b);
    const s = sideData[activeSide];
    const idx = s.fullSweepDonePairs.findIndex(function(p) { return p[0] === ka && p[1] === kb; });
    if (idx >= 0) s.fullSweepDonePairs.splice(idx, 1);
    fullSweepDonePairs = s.fullSweepDonePairs;
  }
  ell_updUndo();
  ell_showCurPair();
}
function ell_updUndo() {
  // BA 247fix2: Undo-Button liegt in der neuen API unter
  // ELL_testEls.verfahren[<id>].actions.undo, nicht direkt auf ELL_testEls.
  if (!ELL_testEls || !ELL_testEls.verfahren) return;
  var vref = ELL_testEls.verfahren[_ELL_activeVerfahren];
  var btn = vref && vref.actions && vref.actions.undo;
  if (btn) btn.disabled = ELL_testIdx <= 0 || !undoSt.length;
}
function nextFullRound() {
  const s = sideData[activeSide];
  const rrTable = ROUND_ROBIN[nEl];
  const maxRounds = rrTable ? rrTable.length : 0;
  s.fullSweepRound++;
  s.fullSweepDonePairs = [];
  fullSweepRound = s.fullSweepRound;
  fullSweepDonePairs = [];
  if (s.fullSweepRound > maxRounds) {
    s.fullSweepRound = null;
    s.fullSweepDonePairs = [];
    fullSweepRound = null;
    fullSweepDonePairs = [];
    endTest();
    ELL_renderResults();
    // BA 279: Abschluss-Box NUR beim vollstaendigen Round-Robin-Durchlauf.
    // Konvergenz (nextConvRnd) und Pause/Stop (onStop -> endTest): KEINE Box.
    if (ELL_testEls && typeof testUI !== 'undefined' && testUI.completion) {
      testUI.completion.show({
        nameKey:   'ell_rrName',
        subtabKey: 'compSubLoudness',
        bodyKey:   'rrDoneExtra'
      });
    }
    return;
  }
  const actSet = new Set(actEl());
  const roundPairs = rrTable[s.fullSweepRound - 1].filter(
    ([a, b]) => actSet.has(a) && actSet.has(b),
  );
  // BA 247fix: Elektroden-Auswahl im Header gilt auch ab der zweiten
  // Runde, nicht nur beim Start (startTestFull).
  const filtered = _ell_filterByElectrodeSelection(roundPairs);
  ELL_testPairs = randAB(shuffle(filtered));
  ELL_testIdx = 0;
  undoSt = [];
  ell_showCurPair();
}
function nextConvRnd() {
  const { residuals } = ELL_compWLS(ELL_ctx("global"));
  const act = new Set(actEl());
  const vr = residuals.filter((r) => act.has(r.a) && act.has(r.b));
  const mx = vr.length ? Math.max(...vr.map((r) => r.residual)) : 0;
  if (mx < 1) {
    endTest();
    ELL_renderResults();
    return;
  }
  convRnd++;
  const sr = [...vr].sort((a, b) => b.residual - a.residual);
  const tp = sr
    .slice(0, Math.max(5, Math.ceil(sr.length * 0.2)))
    .map((r) => [r.a, r.b]);
  const ap = allPairs(),
    ex = shuffle(ap).slice(0, Math.min(Math.max(3, Math.floor(ap.length * 0.1)), 8));
  const seen = new Set(), mg = [];
  [...tp, ...ex].forEach((p) => {
    const k = Math.min(p[0], p[1]) + "-" + Math.max(p[0], p[1]);
    if (!seen.has(k)) { seen.add(k); mg.push(p); }
  });
  ELL_testPairs = randAB(shuffle(mg));
  ELL_testIdx = 0;
  undoSt = [];
  // BA 247fix2: progress.set erwartet ein opts-Objekt.
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress, {
      text: t("round") + " " + convRnd + " – " + mg.length + " (max res: " + mx.toFixed(1) + " dB)",
      fraction: 0
    });
  }
  ell_showCurPair();
}

// ============================================================
// BA 247: DOMContentLoaded — buildTestPanel (neue testUI-API)
// ============================================================
// BA 247fix: null = "alle testable ausgewaehlt" (Konvention aus
// test-ui.js Z. 2270 und aus stereobalance-balance). Leeres Array waere im
// Modal als "keine ausgewaehlt" interpretiert.
let _ell_selectedEls = null;

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-elektrodenlautstaerke");
  if (!parentEl) return;

  // Gemeinsamer Body fuer beide Verfahren (Round Robin und Konvergenz
  // unterscheiden sich nur im Start-/Sequenz-Aufbau, nicht in der UI).
  function _ell_body() {
    return {
      pairIndicator:  { variant: 'electrode' },
      progress:       { format: 'rounds' },
      keyHint:        { unitKey: 'sliderHintDb' },
      slider:         {
        unit: 'dB',
        initialRange: 20,
        maxRange: 60,
        rangeHint: true,
        touchStep: 0.5,
        touchFineStep: 0.1
      },
      sliderValue:    { show: true },
      confirmButton:  { key: 'btnConfirmOffset' },
      actions:        [
        'undo',
        'replay',
        'simul',
        { kind: 'swap', labelKey: 'btnSwapAB' }
      ],
      clipHint:       true,
      statusGrid:     { show: true }
    };
  }

  function _ell_hooksCommon() {
    return {
      onStop:    function() { endTest(); ELL_renderResults(); },
      onConfirm: function() { ell_recBal(); },
      onReplay:  function() { playCur(); },
      onUndo:    function() { ell_undoL(); },
      onSimul:   function() { _ell_playSimul(); },
      onSwap:    function() { _ell_swap(); },
      onSlide:   function(off) { _ell_onSlide(off); }
    };
  }

  var cfg = {
    id: 'elektrodenlautstaerke',
    explain: {
      titleKey: 'ell_explainTitle',
      paragraphs: [
        { key: 'ell_maturityHint', kind: 'ok'    },
        { key: 'ell_intro',        kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect: false,
        // BA 250: Lautstaerke/Tondauer/Tonpause sitzen in der Tonart-Modalbox,
        // nicht mehr im Header (analog freqmatch nach BA 240).
        volume:    false,
        duration:  false,
        pause:     false,
        toneType:  false,
        tonePopupButton: {
          getToneType: function()   { return toneType_elektrodenlautstaerke; },
          setToneType: function(tt) { toneType_elektrodenlautstaerke = tt; },
          // BA 252: Tonart-Merker fuer Klavier-Anschlag im Modal.
          onToneSelected: function(tt) { _ell_tpModalTone = tt; },
          onModalClose:   function()   { _ell_tpModalTone = null; _ell_tpCorrectVol = null; },
          onTogglesReady: function(fn) { _ell_tpCorrectVol = fn; },
          // BA 302: Korrektur-Schalter auch im Lautstaerke-Messreiter zeigen.
          showToggles:  true,
          // BA 250: Lautstaerke/Tondauer/Tonpause als Modalbox-Felder.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function()  { return volume_global; },
          setVolumePercent: function(v) { volume_global = v; },
          getDurationMs:    function()  { return duration_elektrodenlautstaerke; },
          setDurationMs:    function(v) { duration_elektrodenlautstaerke = v; },
          getPauseMs:       function()  { return pause_elektrodenlautstaerke; },
          setPauseMs:       function(v) { pause_elektrodenlautstaerke = v; },
          // Probehoeren und Sequenz aus den neuen State-Werten.
          getVolume:   function() { return tGVol(); },
          getPreviewSequence: function (lastHz) {
            // Test laeuft -> echte Sequenz (aktuelles Paar + Schieber);
            // sonst ein Ton mit der zuletzt am Klavier angetippten Frequenz.
            if (ELL_testAct && ELL_testIdx < ELL_testPairs.length && ELL_curA != null && ELL_curB != null) {
              return _ell_sequence({ aba: sequence_elektrodenlautstaerke === 'aba' });
            }
            var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
            var pan = (activeSide === 'left') ? -1 : 1;
            // BA 302: Korrektur ueber die Schalter-fn (Default an, abschaltbar).
            var vol = tGVol();
            if (typeof _ell_tpCorrectVol === 'function') vol = _ell_tpCorrectVol(vol, hz, pan);
            return [{ hz: hz, pan: pan, vol: vol, durationMs: tGDur() }];
          },
          // BA 252: Klavier-Widget in der Modalbox -- aktive Seite,
          // Implantat-Logik (abgewaehlt/ausgeschlossen = X-Overlay).
          keyboardMode:          true,
          getElectrodeFreqs:     _ell_tpElectrodeFreqs,
          getElectrodeLabels:    _ell_tpElectrodeLabels,
          getDisabledElectrodes: _ell_tpDisabledElectrodes,
          getHighlightMs: function() { return tGDur(); },
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var pan = (activeSide === 'left') ? -1 : 1;
            var tt  = (_ell_tpModalTone !== null) ? _ell_tpModalTone : toneType_elektrodenlautstaerke;
            // BA 302: Korrektur ueber die Schalter-fn (Default an, abschaltbar).
            var vol = tGVol();
            if (typeof _ell_tpCorrectVol === 'function') vol = _ell_tpCorrectVol(vol, hz, pan);
            try {
              playToneTyped(c, hz, vol, 60000, pan, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function () {
            if (typeof stopAll === 'function') stopAll();
          }
        },
        sequence:     { show: true, source: 'global' },
        electrodeSelection: {
          // BA 247fix: zwei Elektroden noetig, sonst kein Paar.
          minSelected: 2,
          getSelection:    function()    { return _ell_selectedEls ? _ell_selectedEls.slice() : null; },
          setSelection:    function(sel) {
            _ell_selectedEls = sel.slice();
            // Bugfix (0.4.279.1): bei laufendem Test verbleibende Sequenz
            // sofort neu filtern, sonst werden abgewaehlte Elektroden
            // weiter abgefragt.
            _ell_applySelectionDuringRun();
          },
          getElectrodeStatus: function() {
            // BA 247: Filter NUR auf aktive Seite.
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < nEl; i++) {
              if (elExDur[i] !== null)            excluded.push(i);
              else if (elActive && elActive[i] === false) muted.push(i);
              else if (elSt[i] === 'mute')        muted.push(i);
              else                                testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            return dENPrefix() + dEN(i) + " (" + Math.round(FRQ_implantatEffektiv(i)) + " Hz)";
          }
        }
      },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [
      {
        id: 'full',
        labelKey:   'ELL_verfahrenFull',
        explainKey: null,
        body: _ell_body(),
        hooks: Object.assign({
          onStart: function() {
            // BA 255: Seitenabfrage vor eigentlichem Start.
            testUI.sideCheck.run(
              { sides: 'one', side: activeSide },
              function() {
                _ELL_activeVerfahren = 'full';
                startTestFull();
              },
              function() {
                // Abbruch: testUI stoppt sich selbst, hier nichts weiter zu tun.
                if (ELL_testEls && ELL_testEls._stopTest) ELL_testEls._stopTest();
              }
            );
          }
        }, _ell_hooksCommon())
      },
      {
        id: 'conv',
        labelKey:   'ell_verfahrenConv',
        explainKey: null,
        body: _ell_body(),
        hooks: Object.assign({
          onStart: function() {
            // BA 255: Seitenabfrage vor eigentlichem Start.
            testUI.sideCheck.run(
              { sides: 'one', side: activeSide },
              function() {
                _ELL_activeVerfahren = 'conv';
                startTestConv();
              },
              function() {
                if (ELL_testEls && ELL_testEls._stopTest) ELL_testEls._stopTest();
              }
            );
          }
        }, _ell_hooksCommon())
      }
    ]
  };

  ELL_testEls = buildTestPanel(parentEl, cfg);
});

function ELL_refreshElectrodeSelectionSummary() {
  if (ELL_testEls && ELL_testEls.header && typeof ELL_testEls.header.electrodeSelectionUpdate === 'function') {
    ELL_testEls.header.electrodeSelectionUpdate();
  }
}

// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function ELL_refreshToneTypeLabel() {
  if (ELL_testEls && ELL_testEls.header && typeof ELL_testEls.header.tonePopupUpdate === 'function') {
    ELL_testEls.header.tonePopupUpdate();
  }
}

// BA 288: Token-Liste fuer das aktuelle Paar des Elektrodenlautstaerke-
// Tests. Liefert fertige Token { hz, pan, vol, durationMs, eIdx, which }
// (vol inkl. pairGains-Deckelung und Stummschaltung tauber Seite) sowie
// Pausen-Token { pauseMs }. eIdx/which dienen nur dem Aufleuchten
// (onStepStart-Hook), die Maschine ignoriert sie.
//   opts.aba === true  -> dritter Ton (A wiederholt) angehaengt.
function _ell_sequence(opts) {
  opts = opts || {};
  var off  = _ell_sliderVal();
  var g    = pairGains(tGVol(), off);          // { vA, vB, capped }
  var pan  = (activeSide === 'left') ? -1 : 1;
  var mute = isDeaf(activeSide);
  var dur  = tGDur();
  var pau  = tGPau();
  function tone(eIdx, gain, which) {
    return {
      hz: FRQ_implantatEffektiv(eIdx),
      pan: pan,
      vol: mute ? 0 : gain,
      durationMs: dur,
      eIdx: eIdx,
      which: which
    };
  }
  var seq = [ tone(ELL_curA, g.vA, 'a'), { pauseMs: pau }, tone(ELL_curB, g.vB, 'b') ];
  if (opts.aba) {
    seq.push({ pauseMs: pau });
    seq.push(tone(ELL_curA, g.vA, 'a'));
  }
  return seq;
}

// BA 247/288: "beide Toene gleichzeitig". Nutzt dieselbe Token-Funktion
// wie die Sequenz, aber ohne ABA-Wiederholung; die Maschine spielt die
// Ton-Token parallel (Pausen werden im Gleichzeitig-Modus ignoriert).
function _ell_playSimul() {
  if (!ELL_testAct || ELL_testIdx >= ELL_testPairs.length) return;
  stopAll();
  isPlay = true;
  ELL_curPlayed = true;
  var vref = ELL_testEls && ELL_testEls.verfahren && ELL_testEls.verfahren[_ELL_activeVerfahren];
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
  testUI.tonePlayer.playSimultaneous(
    _ell_sequence({ aba: false }),
    {
      toneType: toneType_elektrodenlautstaerke,
      onDone: function () {
        isPlay = false;
        if (vref && vref.pairIndicator) {
          testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
        }
      }
    }
  );
}

