// ============================================================
// LEVELS – Preset-Berechnung und Levels-Tab
// ============================================================

// BA429: Frequenz-Position einer Elektrode im Kurven-Reiter.
// Ersetzt _kurvenFreq: bezieht die Frequenz aus der zentralen Wertquelle
// FRQ_werte (Form "gehoert") statt aus dem alten buildWarpPoints-Pfad, der
// die falsche Vorzeichen-Richtung lieferte (E1: 138 statt 104 Hz).
//
// Verhalten (Nutzer-Vorgabe):
//   - Frequenz der AKTIVEN Seite (activeSide).
//   - folgt der Player-Warp-Einstellung: pWarpOn (an/aus) + pWarpMode (Seite).
//   - Warp aus  -> nominelle Frequenz; Warp an -> gehoerte Frequenz;
//     ungemessen (gehoertHz == null) -> nominell (Rueckfall).
//   - NH-Sim wird IGNORIERT (nhSim fest false) -- der Kurven-Reiter zeigt
//     immer die echte gehoerte Position, keine ~141-Spiegelung. Bewusster
//     Unterschied zum Player-Graph.
//
// typeof-Guard fuer FRQ_werte (core.js) zur Ladezeit; pWarpOn aus freq-warp.js.
// Modus: FRQ_distribution (global, BA491). nhSim fest false (Kurven-Reiter).
let _kurvenFrqCache = null;

function _kurvenFrqRefresh() {
  // Einmal je Zeichen-/Berechnungslauf die Wertquelle ziehen und nach
  // elIdx indizieren. Aufrufer rufen _kurvenFreq(i); der Cache wird zu
  // Beginn jedes Laufs neu aufgebaut (siehe kurvenELLBerechnen /
  // kurvenELLChartZeichnen).
  if (typeof FRQ_werte !== "function") { _kurvenFrqCache = null; return; }
  const werte = FRQ_werte("gehoert", FRQ_distribution, false);   // nhSim fest false
  const byIdx = {};
  for (const w of werte) byIdx[w.elIdx] = w;
  _kurvenFrqCache = byIdx;
}

function _kurvenFreq(i) {
  // Nominelle Frequenz der aktiven Seite als Basis/Rueckfall.
  const nom = FRQ_implantatEffektiv(i);
  const warpAn = (typeof pWarpOn !== "undefined") && pWarpOn;
  if (!warpAn || !_kurvenFrqCache) return nom;
  const w = _kurvenFrqCache[i];
  if (!w) return nom;                       // Elektrode ausserhalb der Menge
  const s = w[activeSide];
  if (!s) return nom;
  return (s.gehoertHzGlatt != null) ? s.gehoertHzGlatt : nom;   // BA482: geglaettet
}

function kurvenELLBerechnen(pr) {
  _kurvenFrqRefresh();               // BA429: Wertquelle einmal je Lauf ziehen
  const act = allEl(),
    n = nEl,
    c = new Array(n).fill(0);
  if (act.length < 2) return c;
  const mn = act[0], mx = act[act.length - 1];
  // Mittelpunkt in Hz (Default 1000 Hz)
  const ctrHz = pr.center != null ? pr.center : CENT_REF_HZ;
  const ctrC = hzToCent(ctrHz);
  // Span in Cent über die aktiven Elektroden
  const fMin = _kurvenFreq(act[0]);
  const fMax = _kurvenFreq(act[act.length - 1]);
  const cMin = hzToCent(fMin);
  const cMax = hzToCent(fMax);
  const halfSpanC = Math.max(1, (cMax - cMin) / 2);

  if (pr.type === "tilt") {
    for (const i of act) {
      const xC = hzToCent(_kurvenFreq(i)) - ctrC;
      c[i] = xC / halfSpanC;
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "scurve") {
    for (const i of act) {
      const x = (hzToCent(_kurvenFreq(i)) - ctrC) / halfSpanC;
      c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "pivot") {
    for (const i of act) {
      const d = Math.abs(hzToCent(_kurvenFreq(i)) - ctrC) / halfSpanC;
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
      const dC = hzToCent(_kurvenFreq(i)) - ctrC;
      c[i] = Math.exp(-0.5 * Math.pow(dC / sigC, 2));
    }
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (const i of act) c[i] /= mx2;
    return c;
  }
  if (pr.type === "speech") {
    const effF = Array.from({ length: n }, (_, i) => _kurvenFreq(i));
    const w = siiWeightsForFreqs(effF);
    const mean = w.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) c[i] = w[i] - mean;
    const mx2 = Math.max(...c.map(Math.abs)) || 1;
    for (let i = 0; i < n; i++) c[i] /= mx2;
    return c;
  }
  if (pr.type === "iso226") {
    const LN = pr.phon != null ? pr.phon : 70;
    const effF = Array.from({ length: n }, (_, i) => _kurvenFreq(i));
    const w = iso226WeightsForFreqs(effF, LN);
    // w ist bereits relativ zu 1000 Hz in echten dB; keine weitere
    // Normierung. Stärke-Faktor wird in kurvenELLSumme angewandt.
    // Vorzeichen invertiert: positive Eingabe senkt Bass/Höhen ab
    // (entspricht der Praxis-Beobachtung, daß die Absenkung den
    // „alles gleich laut"-Überschuß der Messung korrigiert).
    for (let i = 0; i < n; i++) c[i] = -w[i];
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
function kurvenELLSumme() {
  const c = new Array(nEl).fill(0);
  for (const pr of kurvenELL) {
    if (!pr.on || pr.strength === 0) continue;
    const pc = kurvenELLBerechnen(pr);
    for (let i = 0; i < nEl; i++) c[i] += pc[i] * pr.strength;
  }
  return c;
}
function ell_effektiv() {
  const pc = kurvenELLSumme();
  return schieberELL.map((m, i) => m + pc[i]);
}

function kurvenELLOnChange() {
  kurvenELLChartZeichnen();
  if (typeof schieberELLDraw === "function") schieberELLDraw();
  if (pEqF.length > 0) pUpdEQ();
}
// Touch-Ctrl-Instanzen je Kurvenzeile (pi -> buildValueTouchCtrl-Rueckgabe).
// Wird bei jedem Tabellenbau neu gefuellt; die Tastatur (init.js) liest hier
// den Fein-Zustand der aktiven Zeile ab, damit der Fein-Toggle auch fuer
// Tastatureingaben (+/-, Pfeile) wirkt.
var kurvenELLCtrls = {};

// Fein-Zustand der aktiven Zeile (fuer bindKeyAdjust in init.js).
function kurvenELLActiveIsFine() {
  var c = kurvenELLCtrls[kurvenELLActivePi];
  return !!(c && c.isFine && c.isFine());
}

// Wert-Adapter einer Kurvenzeile fuer die Bedien-Engine (BA 545).
// Kapselt Clamp (+-20) und Folgewirkung (andere Seite + Redraw).
function _kurvenELLAdapter(pi) {
  return {
    get: function () { return kurvenELL[pi] ? kurvenELL[pi].strength : 0; },
    set: function (raw) {
      if (!kurvenELL[pi]) return;
      var newVal = Math.max(-20, Math.min(20, +(+raw).toFixed(1)));
      kurvenELL[pi].strength = newVal;
      // Feldanzeige der Zeile nachziehen, falls im DOM.
      var inp = document.querySelector('.kurven-ell-str[data-pi="' + pi + '"]');
      if (inp) inp.value = newVal.toFixed(1);
      kurvenELLOnChange();
    },
    step: 0.5,
    fineStep: 0.1
  };
}

// Aktive Kurvenzeile setzen + Markierung auffrischen.
function kurvenELLSetActive(pi) {
  kurvenELLActivePi = pi;
  _kurvenELLMarkActive();
}

// Markierung (Zeilen-Hintergrund) an der aktiven Zeile setzen.
function _kurvenELLMarkActive() {
  var tbl = document.getElementById('kurvenELLTbl');
  if (!tbl) return;
  tbl.querySelectorAll('tr.kurven-ell-row-active').forEach(function (tr) {
    tr.classList.remove('kurven-ell-row-active');
  });
  if (kurvenELLActivePi < 0) return;
  var cb = tbl.querySelector('.kurven-ell-on[data-pi="' + kurvenELLActivePi + '"]');
  if (cb) {
    var tr = cb.closest('tr');
    if (tr) tr.classList.add('kurven-ell-row-active');
  }
}

function kurvenELLTabelleBauen() {
  const tbl = document.getElementById("kurvenELLTbl");
  tbl.innerHTML = "";
  kurvenELLCtrls = {};   // Ctrl-Instanzen des vorigen Aufbaus verwerfen
  const act = allEl();
  // Mittelpunkt: Number-Input in Hz (50–20000, Schritt 50).
  // Breite (Gauß): Number-Input in Cent (50–4800, Schritt 50).
  for (let pi = 0; pi < kurvenELL.length; pi++) {
    const pr = kurvenELL[pi];
    const tr = document.createElement("tr");
    tr.className = pr.on ? "" : "kurven-ell-row-off";
    let params = '<div class="kurven-ell-param">';
    params += `<label>${t("kurvenELLStrLabel")}</label><input type="number" class="kurven-ell-str no-spin" data-pi="${pi}" value="${pr.strength.toFixed(1)}" min="-20" max="20" step="0.5">`;
    if (KURVEN_ELL_HAS_CENTER[pr.type])
      params += ` <label>${t("kurvenELLCenter")}</label><input type="number" class="kurven-ell-ctr" data-pi="${pi}" min="50" max="20000" step="any" style="width:80px"> ${t("kurvenELLUnitHz")}`;
    if (KURVEN_ELL_HAS_WIDTH[pr.type])
      params += ` <label>${t("kurvenELLWidth")}</label><input type="number" class="kurven-ell-wid" data-pi="${pi}" min="50" max="4800" step="any" style="width:80px"> ${t("kurvenELLUnitCent")}`;
    if (pr.type === "iso226") {
      const phonOpts = [20, 40, 60, 70, 80]
        .map((p) => `<option value="${p}">${p}</option>`)
        .join("");
      params += ` <label>${t("kurvenELLPhon")}</label><select class="kurven-ell-phon" data-pi="${pi}">${phonOpts}</select> ${t("kurvenELLUnitPhon")}`;
    }
    params += "</div>";
    tr.innerHTML = `<td><input type="checkbox" class="kurven-ell-on" data-pi="${pi}" ${pr.on ? "checked" : ""}></td><td class="kurven-ell-name">${t(KURVEN_ELL_NAMES[pr.type])}</td><td>${params}</td>`;
    tbl.appendChild(tr);
    const ctrInp = tr.querySelector(".kurven-ell-ctr");
    if (ctrInp)
      ctrInp.value = (pr.center !== undefined ? pr.center : CENT_REF_HZ);
    const widInp = tr.querySelector(".kurven-ell-wid");
    if (widInp) widInp.value = (pr.width != null ? pr.width : 1200);
    const phonSel = tr.querySelector(".kurven-ell-phon");
    if (phonSel) phonSel.value = pr.phon != null ? pr.phon : 70;
    const tr2 = document.createElement("tr");
    tr2.className = pr.on ? "" : "kurven-ell-row-off";
    tr2.innerHTML = `<td></td><td colspan="2" style="font-size:.78em;color:var(--text-muted);padding-top:0">${t(KURVEN_ELL_EXPL[pr.type])}</td>`;
    tbl.appendChild(tr2);
  }
  tbl.querySelectorAll(".kurven-ell-on").forEach(function (cb) {
    cb.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      kurvenELL[pi].on = this.checked;
      // Anhaken -> Zeile aktiv. Maus-Abhaken -> Auswahl entfernen.
      if (this.checked) kurvenELLActivePi = pi;
      else if (kurvenELLActivePi === pi) kurvenELLActivePi = -1;
      kurvenELLTabelleBauen();   // baut neu; _kurvenELLMarkActive laeuft am Ende
      kurvenELLOnChange();
    });
  });
  tbl.querySelectorAll(".kurven-ell-str").forEach((inp) => {
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      _kurvenELLAdapter(pi).set(parseNum(this.value) || 0);
    });
    // −/Fein/+ ueber die zentrale Engine (BA 545).
    var _pi = +inp.dataset.pi;
    var _ctrl = buildValueTouchCtrl(_kurvenELLAdapter(_pi), {
      labelFine: t("kurvenELLFineLabel")
    });
    _ctrl.box.classList.add('kurven-ell-str-touch');
    // Gehoerrichtig (ISO 226): Fein per Default an (abschaltbar).
    if (kurvenELL[_pi] && kurvenELL[_pi].type === "iso226") _ctrl.setFine(true);
    // Instanz merken, damit die Tastatur (init.js) den Fein-Zustand liest.
    kurvenELLCtrls[_pi] = _ctrl;
    if (inp.parentNode) {
      if (inp.nextSibling) inp.parentNode.insertBefore(_ctrl.box, inp.nextSibling);
      else inp.parentNode.appendChild(_ctrl.box);
    }
  });
  tbl.querySelectorAll(".kurven-ell-ctr").forEach((inp) =>
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      let v = parseNum(this.value);
      if (!isFinite(v) || v < 50) v = 50;
      if (v > 20000) v = 20000;
      kurvenELL[pi].center = v;
      this.value = v;
      kurvenELLOnChange();
    }),
  );
  tbl.querySelectorAll(".kurven-ell-wid").forEach((inp) =>
    inp.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      let v = parseNum(this.value);
      if (!isFinite(v) || v < 50) v = 50;
      if (v > 4800) v = 4800;
      kurvenELL[pi].width = v;
      this.value = v;
      kurvenELLOnChange();
    }),
  );
  tbl.querySelectorAll(".kurven-ell-phon").forEach((sel) =>
    sel.addEventListener("change", function () {
      const pi = +this.dataset.pi;
      kurvenELL[pi].phon = +this.value;
      kurvenELLOnChange();
    }),
  );
  // Klick in eine Parameter-Zeile macht sie aktiv.
  tbl.querySelectorAll('.kurven-ell-on').forEach(function (cb) {
    var tr = cb.closest('tr');
    if (!tr) return;
    tr.addEventListener('click', function (ev) {
      // Klick auf die Checkbox selbst wird vom change-Handler behandelt.
      if (ev.target && ev.target.classList.contains('kurven-ell-on')) return;
      kurvenELLSetActive(+cb.dataset.pi);
    });
  });
  // Markierung nach jedem Neuaufbau wiederherstellen.
  _kurvenELLMarkActive();
  applyMobileReadonly(tbl);
}
function kurvenELLChartZeichnen() {
  const cv = document.getElementById("kurvenELLChartCv");
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
  const showMeas = document.getElementById("kurvenELLChkMeas").checked;
  const showMan = document.getElementById("kurvenELLChkMan").checked;
  const showPre = document.getElementById("kurvenELLChkPre").checked;
  const act = allEl();
  if (!act.length) return;
  _kurvenFrqRefresh();               // BA429: Wertquelle einmal je Zeichenlauf
  const corr = ELL_testData({ ctx: ELL_ctx("global") }).correction;
  const pc = kurvenELLSumme();
  const measV = act.map((i) => corr[i]);
  const manV = act.map((i) => schieberELL[i]);
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
    return _kurvenFreq(i);
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
    ctx.fillStyle = act[j] === ELL_refEl ? "#2563eb" : "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const yE = H - pad.bottom + 12,
          yHz = H - pad.bottom + 22,
          yCent = H - pad.bottom + 32;
    const lbl = dENPrefix() + dEN(act[j]);
    ctx.fillText(lbl, tX(j), yE);
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    const elsF = axis.hzArr[j];
    ctx.fillText(
      fmtNum(elsF, "hz"),
      tX(j),
      yHz,
    );
    if (j % axis.step === 0 || j === 0 || j === act.length - 1) {
      const c = fmtNum(axis.centArr[j], "cent");
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
