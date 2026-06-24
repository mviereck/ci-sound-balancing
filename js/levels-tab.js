// ============================================================
// LEVELS-TAB (Schieber)
// ============================================================
// Senkrechte Balken pro Elektrode, eigener State elektrodenlautstaerkeSchieber (Seite
// gebunden), diverging stacked bar mit drei Quellen.
// Pfeiltasten-Navigation, "Alles auf 0"-Button.
// Zwei Anzeigemodi: relativ (±dB) und absolut (qu/CL/CU).
// Drei Varianten: gestapelt / nur Summe / Summe + Vergleichslinien.

// Fokus-Index der aktuell ausgewählten Elektrode (für Pfeiltasten).
let lvTabFocus = 0;
// Hat das Canvas gerade Tastatur-/UI-Fokus? Steuert, ob die Umrahmung
// um die aktive Elektrode gezeichnet wird.
let lvTabHasFocus = false;

const LV_TAB_RANGE = 60; // ±60 dB Anzeigebereich (nur Relativmodus)

// Hat die Elektrode i einen MCL-Wert eingetragen?
function lvTabElHasMcl(i) {
  const im = sideData[activeSide].implant || {};
  const mcl = mfr === "medel" ? im.mcl?.[i] : im.upperLevel?.[i];
  return mcl != null && mcl > 0;
}

// Aktive Elektroden, die in der aktuellen Modus-Konfiguration anwählbar
// sind. Im Absolutmodus werden Elektroden ohne MCL übersprungen.
function lvTabNavigableEl() {
  const base = actEl();
  if (lvTabMode === "abs") return base.filter(lvTabElHasMcl);
  return base;
}

function lvTabUpdateWarpHint() {
  const el = document.getElementById("lvTabWarpHint");
  if (!el) return;
  const warpActive = (typeof pWarpOn !== "undefined") && pWarpOn === true;
  const curvesShown = (typeof lvTabShowCurves !== "undefined")
    && lvTabShowCurves === true;
  el.style.display = (warpActive && curvesShown) ? "" : "none";
}

function lvTabRebuild() {
  lvTabUpdateModeAvailability();
  const meas = document.getElementById("lvTabChkMeas");
  const cur = document.getElementById("lvTabChkCurves");
  if (meas) meas.checked = lvTabShowMeas;
  if (cur) cur.checked = lvTabShowCurves;
  const nav = lvTabNavigableEl();
  if (nav.length && !nav.includes(lvTabFocus)) lvTabFocus = nav[0];
  lvTabDraw();
  lvTabUpdateWarpHint();
}

function lvTabDraw() {
  const cv = document.getElementById("lvTabCv");
  if (!cv) return;
  const wp = cv.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wp.clientWidth, H = wp.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  if (lvTabMode === "abs") {
    lvTabDrawAbsolute(ctx, W, H);
  } else {
    lvTabDrawRelative(ctx, W, H);
  }
}

// Gleichmäßige x-Verteilung der Elektroden über die Plot-Breite
// (elektrodennummern-basiert). Ersetzt buildCentAxis im Schieber-Tab:
// hier soll die x-Achse keinerlei Frequenzbezug haben, weil der
// Schieber nur dB-Korrekturen pro Elektrode verändert.
function _lvTabBuildAxis(electrodes, padLeft, plotW) {
  const n = electrodes.length;
  if (n === 0) return { tX: () => padLeft, minDx: 0 };
  if (n === 1) return { tX: () => padLeft + plotW / 2, minDx: plotW };
  const dx = plotW / n;
  const tX = (j) => padLeft + dx * (j + 0.5);
  return { tX: tX, minDx: dx };
}

// ---------- Modus A: relativ (±dB) ----------

function lvTabDrawRelative(ctx, W, H) {
  const all = allEl();
  if (!all.length) return;
  const isExcluded = (i) =>
    // BA 164
    elActive[i] === false || elSt[i] === "mute" || elExDur[i] !== null;

  const measArr = elTestData().correction;
  const preArr = getTotalPresetCurve();
  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const sch = elektrodenlautstaerkeSchieber[i] || 0;
    const mes = lvTabShowMeas ? measArr[i] : 0;
    const cur = lvTabShowCurves ? preArr[i] : 0;
    return { i, excluded: false, sch, mes, cur, sum: sch + mes + cur };
  });

  const padTop = 56;
  const padBot = 36;
  const padL = 28, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const zeroY = padTop + plotH / 2;
  const axis = _lvTabBuildAxis(all, padL, plotW);
  cols.forEach((c, idx) => { c.xMid = axis.tX(idx); c._axisIdx = idx; });
  const barW = Math.max(8, Math.min(40, (axis.minDx || 24) * 0.6));
  const yPerDb = plotH / (2 * LV_TAB_RANGE);

  // Skala
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#999";
  ctx.font = "9px Consolas,monospace";
  ctx.textAlign = "right";
  for (let v = -60; v <= 60; v += 10) {
    const y = zeroY - v * yPerDb;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText((v >= 0 ? "+" : "") + v, padL - 4, y + 3);
  }
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padL, zeroY);
  ctx.lineTo(W - padR, zeroY);
  ctx.stroke();

  cols.forEach((col) => {
    const xMid = col.xMid;
    if (col.excluded) {
      lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    if (lvTabVariant === "stack") {
      lvTabDrawStackRelative(ctx, xMid, barW, zeroY, yPerDb, col);
    } else {
      lvTabDrawSumBarRelative(ctx, xMid, barW, zeroY, yPerDb, col);
    }
    lvTabDrawFocusAndSum(ctx, xMid, barW, padTop, plotH, zeroY, yPerDb, col);
    lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col);
  });

  if (lvTabVariant === "lines") {
    lvTabDrawCompareLinesRelative(ctx, zeroY, yPerDb, cols);
  }
}

// ---------- Modus B: absolut (qu/CL/CU) ----------

function lvTabDrawAbsolute(ctx, W, H) {
  const all = allEl();
  if (!all.length) return;
  const isExcluded = (i) =>
    // BA 164
    elActive[i] === false || elSt[i] === "mute" || elExDur[i] !== null;

  const im = sideData[activeSide].implant || {};
  const isMedel = mfr === "medel";
  const isCoch = mfr === "cochlear";
  const isAB = mfr === "ab";
  const yMax = lvAxisMaxFor(mfr);
  const unitLbl = lvUnitLabelFor(mfr);

  const measArr = elTestData().correction;
  const preArr = getTotalPresetCurve();

  const toAbs = (dB, mclAudi, thrAudi) => {
    if (isMedel) return calcMedel(dB, mclAudi).absolute;
    if (isCoch) return calcCochlear(dB, mclAudi, detectCochlearGen(im.model)).absolute;
    if (isAB) return calcAB(dB, mclAudi, thrAudi, im.idr).absolute;
    return null;
  };

  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const mclAudi = isMedel ? im.mcl?.[i] : im.upperLevel?.[i];
    const thrAudi = im.thr?.[i];
    if (mclAudi == null) return { i, excluded: false, noMcl: true };

    const schDb = elektrodenlautstaerkeSchieber[i] || 0;
    const mesDb = lvTabShowMeas ? measArr[i] : 0;
    const curDb = lvTabShowCurves ? preArr[i] : 0;
    const sumDb = schDb + mesDb + curDb;

    return {
      i, excluded: false, noMcl: false,
      mclAudi, thrAudi,
      schDb, mesDb, curDb, sumDb,
      mclNew: toAbs(sumDb, mclAudi, thrAudi),
      mclSch: toAbs(schDb, mclAudi, thrAudi),
      mesMclAbs: toAbs(mesDb, mclAudi, thrAudi),
      curMclAbs: toAbs(curDb, mclAudi, thrAudi),
    };
  });

  const padTop = 56;
  const padBot = 36;
  const padL = 36, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const axis = _lvTabBuildAxis(all, padL, plotW);
  cols.forEach((c, idx) => { c.xMid = axis.tX(idx); c._axisIdx = idx; });
  const barW = Math.max(8, Math.min(40, (axis.minDx || 24) * 0.6));
  const yPerUnit = plotH / yMax;
  const baseY = padTop + plotH;

  // Skala
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#999";
  ctx.font = "9px Consolas,monospace";
  ctx.textAlign = "right";
  const stepY = yMax > 400 ? 100 : yMax > 200 ? 50 : 25;
  for (let v = 0; v <= yMax; v += stepY) {
    const y = baseY - v * yPerUnit;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(v + " " + unitLbl, padL - 4, y + 3);
  }

  cols.forEach((col) => {
    const xMid = col.xMid;
    if (col.excluded) {
      lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    if (col.noMcl) {
      lvTabDrawNoMclColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    if (lvTabVariant === "stack") {
      lvTabDrawStackAbsolute(ctx, xMid, barW, baseY, padTop, yPerUnit, col, toAbs);
    } else {
      lvTabDrawSumBarAbsolute(ctx, xMid, barW, baseY, yPerUnit, col);
    }
    // THR-Zone — wenn der Schieberwert unter THR liegt, die rote Zone
    // auf den Bereich zwischen THR-Linie und Schieber verkleinern,
    // damit der Balken sichtbar bleibt. THR-Linie und THR-Wert
    // bleiben unverändert.
    if (col.thrAudi != null) {
      const thrY = baseY - col.thrAudi * yPerUnit;
      let zoneBottomY = baseY;
      if (col.mclNew != null && col.mclNew > 0 && col.mclNew < col.thrAudi) {
        zoneBottomY = baseY - col.mclNew * yPerUnit;
      }
      ctx.fillStyle = "rgba(220, 38, 38, 0.18)";
      ctx.fillRect(xMid - barW / 2, thrY, barW, zoneBottomY - thrY);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(xMid - barW / 2, thrY);
      ctx.lineTo(xMid + barW / 2, thrY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // MCL-Audiologe als gestrichelter Strich
    const mclAudiY = baseY - col.mclAudi * yPerUnit;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(xMid - barW / 2 - 3, mclAudiY);
    ctx.lineTo(xMid + barW / 2 + 3, mclAudiY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Summen-Quermarker: schwarzer dicker Strich am Nettowert,
    // einheitlich in beiden Absolutmodus-Varianten (gestapelt + nur
    // Summe) — analog zum Relativmodus, wo der Marker ebenfalls in
    // allen Varianten gezeichnet wird.
    if (col.mclNew != null && col.mclNew > 0) {
      const sumY = baseY - Math.max(0, Math.min(yMax, col.mclNew)) * yPerUnit;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xMid - barW / 2 - 4, sumY);
      ctx.lineTo(xMid + barW / 2 + 4, sumY);
      ctx.stroke();
    }
    // Fokus (nur wenn das Canvas auch wirklich Fokus hat)
    if (col.i === lvTabFocus && lvTabHasFocus) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.strokeRect(xMid - barW / 2 - 2, padTop, barW + 4, plotH);
    }
    // Beschriftung oben
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 12px Consolas,monospace";
    const valTxt = col.mclNew != null ? Math.round(col.mclNew) + " " + unitLbl : "—";
    ctx.fillText(valTxt, xMid, padTop - 26);
    ctx.font = "10px Consolas,monospace";
    ctx.fillStyle = "#555";
    const dbTxt = "(" + (col.sumDb >= 0 ? "+" : "") + col.sumDb.toFixed(1) + " dB)";
    ctx.fillText(dbTxt, xMid, padTop - 12);
    // Beschriftung unten
    lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col);
  });

  if (lvTabVariant === "lines") {
    lvTabDrawCompareLinesAbsolute(ctx, baseY, yPerUnit, cols);
  }
}

// ---------- Helper-Zeichenfunktionen ----------

function lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, i) {
  const x0 = xMid - barW / 2, x1 = xMid + barW / 2;
  const y0 = padTop, y1 = padTop + plotH;
  ctx.fillStyle = "#e5e7eb";
  ctx.fillRect(x0, y0, barW, plotH);
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
  ctx.moveTo(x1, y0); ctx.lineTo(x0, y1);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
}

function lvTabDrawNoMclColumn(ctx, xMid, barW, padTop, plotH, H, padBot, i) {
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(xMid - barW / 2, padTop, barW, plotH);
  ctx.setLineDash([]);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("—", xMid, padTop + plotH / 2);
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
}

function lvTabDrawStackRelative(ctx, xMid, barW, zeroY, yPerDb, col) {
  const cSch = "#16a34a", cMes = "#2563eb", cCur = "#d97706";
  function drawSeg(fromY, value, color) {
    if (Math.abs(value) < 0.001) return fromY;
    const dy = -value * yPerDb;
    const toY = fromY + dy;
    ctx.fillStyle = color;
    const y0 = Math.min(fromY, toY), y1 = Math.max(fromY, toY);
    ctx.fillRect(xMid - barW / 2, y0, barW, y1 - y0);
    return toY;
  }
  let yUp = zeroY;
  if (col.sch > 0) yUp = drawSeg(yUp, col.sch, cSch);
  if (col.mes > 0) yUp = drawSeg(yUp, col.mes, cMes);
  if (col.cur > 0) yUp = drawSeg(yUp, col.cur, cCur);
  let yDn = zeroY;
  if (col.sch < 0) yDn = drawSeg(yDn, col.sch, cSch);
  if (col.mes < 0) yDn = drawSeg(yDn, col.mes, cMes);
  if (col.cur < 0) yDn = drawSeg(yDn, col.cur, cCur);
}

function lvTabDrawSumBarRelative(ctx, xMid, barW, zeroY, yPerDb, col) {
  if (Math.abs(col.sum) < 0.001) return;
  const dy = -col.sum * yPerDb;
  const y0 = Math.min(zeroY, zeroY + dy);
  const y1 = Math.max(zeroY, zeroY + dy);
  ctx.fillStyle = col.sum >= 0 ? "#16a34a" : "#dc2626";
  ctx.fillRect(xMid - barW / 2, y0, barW, y1 - y0);
}

function lvTabDrawStackAbsolute(ctx, xMid, barW, baseY, padTop, yPerUnit, col, toAbs) {
  if (col.mclAudi == null || col.mclAudi <= 0) return;
  const yAudi = baseY - col.mclAudi * yPerUnit;
  // Grauer Basis-Block: 0 bis Audiologen-MCL
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(xMid - barW / 2, yAudi, barW, baseY - yAudi);

  // Drei Quellen-Segmente analog zum Relativmodus stapeln: Schieber
  // (grün), Messung (blau), Kurven (orange). Positive Anteile von
  // der Audi-MCL-Linie nach oben, negative nach unten. Konvertierung
  // muss kumulativ in dB erfolgen, sonst stimmt die Segmenthöhe bei
  // MED-EL (logarithmische Skala) nicht.
  const cSch = "#16a34a", cMes = "#2563eb", cCur = "#d97706";
  const m = col.mclAudi, th = col.thrAudi;
  const minY = padTop, maxY = baseY;

  const drawSeg = (cumDbStart, dbAdd, color) => {
    if (Math.abs(dbAdd) < 0.001) return cumDbStart;
    const cumDbEnd = cumDbStart + dbAdd;
    const absStart = toAbs(cumDbStart, m, th);
    const absEnd = toAbs(cumDbEnd, m, th);
    if (absStart == null || absEnd == null) return cumDbEnd;
    let yStart = baseY - Math.max(0, absStart) * yPerUnit;
    let yEnd = baseY - Math.max(0, absEnd) * yPerUnit;
    yStart = Math.max(minY, Math.min(maxY, yStart));
    yEnd = Math.max(minY, Math.min(maxY, yEnd));
    ctx.fillStyle = color;
    ctx.fillRect(xMid - barW / 2, Math.min(yStart, yEnd), barW, Math.abs(yEnd - yStart));
    return cumDbEnd;
  };

  // Positive Anteile nach oben — Reihenfolge wie im Relativmodus
  let cum = 0;
  cum = drawSeg(cum, Math.max(0, col.schDb), cSch);
  cum = drawSeg(cum, Math.max(0, col.mesDb), cMes);
  cum = drawSeg(cum, Math.max(0, col.curDb), cCur);
  // Negative Anteile nach unten
  cum = 0;
  cum = drawSeg(cum, Math.min(0, col.schDb), cSch);
  cum = drawSeg(cum, Math.min(0, col.mesDb), cMes);
  cum = drawSeg(cum, Math.min(0, col.curDb), cCur);
}

function lvTabDrawSumBarAbsolute(ctx, xMid, barW, baseY, yPerUnit, col) {
  if (col.mclNew == null || col.mclNew <= 0) return;
  const yNew = baseY - col.mclNew * yPerUnit;
  // Schieber-Balken einheitlich grün.
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(xMid - barW / 2, yNew, barW, baseY - yNew);
}

function lvTabDrawFocusAndSum(ctx, xMid, barW, padTop, plotH, zeroY, yPerDb, col) {
  if (col.i === lvTabFocus && lvTabHasFocus) {
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.strokeRect(xMid - barW / 2 - 2, padTop, barW + 4, plotH);
  }
  const sumY = zeroY - col.sum * yPerDb;
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(xMid - barW / 2 - 4, sumY);
  ctx.lineTo(xMid + barW / 2 + 4, sumY);
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "bold 12px Consolas,monospace";
  const schTxt = (col.sch >= 0 ? "+" : "") + col.sch.toFixed(1);
  ctx.fillText(schTxt, xMid, padTop - 26);
  if (lvTabShowMeas || lvTabShowCurves) {
    ctx.font = "10px Consolas,monospace";
    ctx.fillStyle = "#555";
    const sTxt = "(S: " + (col.sum >= 0 ? "+" : "") + col.sum.toFixed(1) + ")";
    ctx.fillText(sTxt, xMid, padTop - 12);
  }
}

function lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col) {
  ctx.fillStyle = "#333";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dENPrefix() + dEN(col.i), xMid, H - padBot + 14);
}

function lvTabDrawCompareLinesRelative(ctx, zeroY, yPerDb, cols) {
  const drawSrc = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let first = true;
    cols.forEach((col) => {
      if (col.excluded) return;
      const v = col[key] || 0;
      const y = zeroY - v * yPerDb;
      if (first) { ctx.moveTo(col.xMid, y); first = false; }
      else ctx.lineTo(col.xMid, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawSrc("sch", "#16a34a");
  if (lvTabShowMeas) drawSrc("mes", "#2563eb");
  if (lvTabShowCurves) drawSrc("cur", "#d97706");
}

function lvTabDrawCompareLinesAbsolute(ctx, baseY, yPerUnit, cols) {
  const drawLine = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let first = true;
    cols.forEach((col) => {
      if (col.excluded || col.noMcl) return;
      const absVal = col[key];
      if (absVal == null) return;
      const y = baseY - absVal * yPerUnit;
      if (first) { ctx.moveTo(col.xMid, y); first = false; }
      else ctx.lineTo(col.xMid, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  drawLine("mclSch", "#16a34a");
  if (lvTabShowMeas) drawLine("mesMclAbs", "#2563eb");
  if (lvTabShowCurves) drawLine("curMclAbs", "#d97706");
}

// ---------- Verfügbarkeit Absolutmodus ----------

function lvTabAbsoluteAvailable() {
  const im = sideData[activeSide].implant || {};
  const act = actEl();
  const isMedel = mfr === "medel";
  for (const i of act) {
    const mcl = isMedel ? im.mcl?.[i] : im.upperLevel?.[i];
    if (mcl != null && mcl > 0) return true;
  }
  return false;
}

function lvTabUpdateModeAvailability() {
  const btn = document.getElementById("lvTabModeAbs");
  if (!btn) return;
  const ok = lvTabAbsoluteAvailable();
  btn.disabled = !ok;
  const lbl = btn.parentElement;
  if (lbl) {
    lbl.style.opacity = ok ? "1" : "0.5";
    lbl.title = ok ? "" : t("lvTabAbsNotAvailable");
  }
  if (lvTabMode === "abs" && !ok) {
    lvTabMode = "rel";
    const relBtn = document.getElementById("lvTabModeRel");
    if (relBtn) relBtn.checked = true;
    // lvTabVariant wird hier NICHT überschrieben — die vom Nutzer
    // gewählte Variante bleibt auch beim Fallback erhalten.
  }
}

// ---------- Pfeiltasten: Schritt im Absolutmodus ----------

function lvTabStepAbsolute(i, dir, shift) {
  const im = sideData[activeSide].implant || {};
  const isMedel = mfr === "medel";
  const isCoch = mfr === "cochlear";
  const isAB = mfr === "ab";
  const mclAudi = isMedel ? im.mcl?.[i] : im.upperLevel?.[i];
  if (mclAudi == null) return;

  const step = shift ? 5 : 1;
  const curDb = elektrodenlautstaerkeSchieber[i] || 0;
  let curAbs;
  if (isMedel) curAbs = calcMedel(curDb, mclAudi).absolute;
  else if (isCoch) curAbs = calcCochlear(curDb, mclAudi, detectCochlearGen(im.model)).absolute;
  else if (isAB) curAbs = calcAB(curDb, mclAudi, im.thr?.[i], im.idr).absolute;
  if (curAbs == null) return;

  // Schieberwert in Hersteller-Einheit auf [0, lvAxisMaxFor(mfr)] klammern.
  // Konvertierungen mit 0 sind für MED-EL (log) und AB (Span 0) undefiniert,
  // deshalb auf eine harte Mindestgrenze leicht über 0 setzen.
  const yMax = lvAxisMaxFor(mfr);
  const absMin = isMedel ? 1 : isAB ? 0 : 0;
  let nextAbs = curAbs + dir * step;
  nextAbs = Math.max(absMin, Math.min(yMax, nextAbs));

  let nextDb;
  if (isMedel) nextDb = dbFromMedel(nextAbs, mclAudi);
  else if (isCoch) nextDb = dbFromCochlear(nextAbs, mclAudi, detectCochlearGen(im.model));
  else if (isAB) nextDb = dbFromAB(nextAbs, mclAudi, im.thr?.[i], im.idr);
  if (nextDb == null) return;

  lvTabOnSchieberChange(i, nextDb);
}

// ---------- Datenpfad ----------

function lvTabOnSchieberChange(i, newVal) {
  let val;
  if (lvTabMode === "abs") {
    // Absolutmodus: volle Float-Präzision halten. Bei hohem MCL ist
    // ein einzelner qu/CL/CU-Schritt eine sehr kleine dB-Änderung
    // (bei MCL 200 qu MED-EL: +1 qu ≈ 0.022 dB). Rundung auf 0.1 dB
    // würde solche Schritte komplett schlucken und den Schieber
    // blockieren. Anzeige-Rundung passiert separat im Draw-Pfad.
    val = +newVal;
  } else {
    // Relativmodus: 0.1 dB Granularität, ±60 dB Klammer
    val = +newVal.toFixed(1);
    val = Math.max(-LV_TAB_RANGE, Math.min(LV_TAB_RANGE, val));
  }
  elektrodenlautstaerkeSchieber[i] = val;
  if (typeof buildPrTbl === "function") buildPrTbl();
  if (typeof drawLvChart === "function") drawLvChart();
  if (typeof pEqF !== "undefined" && pEqF.length > 0) pUpdEQ();
  lvTabDraw();
}

function lvTabResetAll() {
  for (let i = 0; i < nEl; i++) elektrodenlautstaerkeSchieber[i] = 0;
  if (typeof buildPrTbl === "function") buildPrTbl();
  if (typeof drawLvChart === "function") drawLvChart();
  if (typeof pEqF !== "undefined" && pEqF.length > 0) pUpdEQ();
  lvTabDraw();
}

// ---------- DOM-Listener (Klick, Toggle, Resize) ----------

document.addEventListener("DOMContentLoaded", () => {
  const cv = document.getElementById("lvTabCv");
  if (!cv) return;
  // Fokus-Tracking: nur wenn das Canvas wirklich fokussiert ist,
  // wird die Umrahmung um die aktive Elektrode gezeichnet.
  cv.addEventListener("focus", () => {
    lvTabHasFocus = true;
    lvTabDraw();
  });
  cv.addEventListener("blur", () => {
    lvTabHasFocus = false;
    lvTabDraw();
  });
  cv.addEventListener("click", (e) => {
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const all = allEl();
    if (!all.length) return;
    const padL = lvTabMode === "abs" ? 36 : 28;
    const padR = 14;
    const plotW = rect.width - padL - padR;
    const slotW = plotW / all.length;
    const idx = Math.max(0, Math.min(all.length - 1, Math.floor((x - padL) / slotW)));
    const i = all[idx];
    // BA 164
    if (elActive[i] === false || elSt[i] === "mute" || elExDur[i] !== null) return;
    // Im Absolutmodus dürfen nur Elektroden mit MCL den Fokus erhalten,
    // weil Pfeiltasten dort sonst keine Wirkung haben.
    if (lvTabMode === "abs" && !lvTabElHasMcl(i)) return;
    lvTabFocus = i;
    lvTabDraw();
  });
  document.getElementById("lvTabChkMeas")?.addEventListener("change", function () {
    lvTabShowMeas = this.checked;
    lvTabDraw();
  });
  document.getElementById("lvTabChkCurves")?.addEventListener("change", function () {
    lvTabShowCurves = this.checked;
    lvTabDraw();
    lvTabUpdateWarpHint();
  });
  document.getElementById("lvTabResetBtn")?.addEventListener("click", lvTabResetAll);
  window.addEventListener("resize", () => {
    if (document.getElementById("panel-schieber")?.classList.contains("active")) {
      lvTabDraw();
    }
  });

  // Touch-Bedienleisten: Elektrode wechseln + dB ändern
  (function () {
    var cv = document.getElementById('lvTabCv');
    if (!cv) return;
    var canvasWrap = cv.parentNode;
    var host = canvasWrap ? canvasWrap.parentNode : null; // die <div class="card">
    if (!host || !canvasWrap) return;

    var ctrlRow = document.createElement('div');
    ctrlRow.className = 'lv-tab-touch-row';
    ctrlRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:10px;';

    var lblE = document.createElement('span');
    lblE.textContent = (typeof t === 'function' ? t('lvTabElLabel') : 'Elektrode') + ':';
    lblE.style.cssText = 'align-self:center;font-weight:600;';

    var stepE = buildStepperPair({
      labelDec: '◀',
      labelInc: '▶',
      onDec: function () { _lvTabTouchEl(-1); },
      onInc: function () { _lvTabTouchEl(+1); }
    });

    var lblV = document.createElement('span');
    lblV.textContent = (typeof t === 'function' ? t('lvTabVlLabel') : 'Wert') + ':';
    lblV.style.cssText = 'align-self:center;font-weight:600;';

    var fineMode = false;
    var bFine = document.createElement('button');
    bFine.type = 'button';
    bFine.className = 'touch-btn';
    bFine.innerHTML = 'Fein';
    bFine.addEventListener('click', function () {
      fineMode = !fineMode;
      bFine.classList.toggle('fine-active', fineMode);
    });

    var stepV = buildStepperPair({
      labelDec: '▼',
      labelInc: '▲',
      onDec: function () { _lvTabTouchVal(-1, fineMode); },
      onInc: function () { _lvTabTouchVal(+1, fineMode); }
    });

    var groupE = document.createElement('div');
    groupE.style.cssText = 'display:flex;gap:6px;align-items:center;';
    groupE.append(lblE, stepE.box);

    var groupV = document.createElement('div');
    groupV.style.cssText = 'display:flex;gap:6px;align-items:center;';
    groupV.append(lblV, stepV.box, bFine);

    ctrlRow.append(groupE, groupV);
    // Direkt unter dem Canvas-Wrapper einfügen, vor dem lvTabKeyHint-<p>.
    host.insertBefore(ctrlRow, canvasWrap.nextSibling);
  })();

  function _lvTabTouchEl(dir) {
    var nav = (typeof lvTabNavigableEl === 'function') ? lvTabNavigableEl() : actEl();
    if (!nav.length) return;
    var ci = nav.indexOf(lvTabFocus);
    if (ci < 0) ci = 0;
    if (dir < 0) ci = Math.max(0, ci - 1);
    else ci = Math.min(nav.length - 1, ci + 1);
    lvTabFocus = nav[ci];
    lvTabDraw();
  }

  function _lvTabTouchVal(dir, fine) {
    if (lvTabMode === 'abs') {
      lvTabStepAbsolute(lvTabFocus, dir, fine);
    } else {
      var st = fine ? 0.1 : 0.5;
      var cur = elektrodenlautstaerkeSchieber[lvTabFocus] || 0;
      lvTabOnSchieberChange(lvTabFocus, cur + dir * st);
    }
  }
});
