// ============================================================
// TAB-SPEZIFISCHE DRUCK-FUNKTIONEN
// ============================================================
//
// Jede Funktion baut für ihren Tab einen HTML-String mit dem
// Druckinhalt zusammen und ruft openPrintWindow() aus print.js
// auf. Die globalen Helper buildPrintHeader und canvasToImg sind
// in print.js definiert.

function _tpEsc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Mappt den internen cfg-Wert auf den korrekten i18n-Key.
function _cfgI18nKey(cfg) {
  return (
    { ci: "cfgCI", hg: "cfgHG", normal: "cfgNormal", shoh: "cfgSchwerh", deaf: "cfgTaub" }[cfg] ||
    cfg
  );
}

// Mappt den internen elSt-Wert auf den korrekten i18n-Key.
function _stI18nKey(stKey) {
  // BA 164: „deactivated" nicht mehr als Status — jetzt eigene Spalte
  return (
    {
      noisyHeavy: "stNoisyHeavy",
      noisyMore:  "stNoisyMore",
      noisyLess:  "stNoisyLess",
      almostMute: "stAlmMute",
      mute:       "stMute",
    }[stKey] || stKey
  );
}

// --- Implantat-Tab ---
function printImplantTab() {
  const s = sideData[activeSide];
  if (!s) return;
  const im = s.implant || {};
  const cfg = s.config || "ci";
  const isCi = cfg === "ci";
  const m = s.manufacturer || "medel";

  // Implantat-Parameter-Block
  const paramRows = [];
  paramRows.push([t("cfgLabel"), t(_cfgI18nKey(cfg))]);
  if (isCi) {
    paramRows.push([t("lblMfr"), (MFR[m] && MFR[m].name) || m]);
    if (im.model)     paramRows.push([t("lblImplModel"), im.model]);
    if (im.processor) paramRows.push([t("lblImplProc"),  im.processor]);
    if (im.cValue != null && m === "medel")
      paramRows.push([t("lblImplC"), String(im.cValue)]);
    if (im.idr != null && m === "ab")
      paramRows.push([t("lblImplIDR"), im.idr + " dB"]);
    if (im.generation && m === "cochlear")
      paramRows.push([t("lblImplGen"), im.generation]);
  }
  const paramTable = `
    <table style="border-collapse:collapse;font-size:0.9em;margin-bottom:16px;">
      ${paramRows
        .map(
          ([k, v]) =>
            `<tr>
               <td style="padding:2px 12px 2px 0;color:#555;">${_tpEsc(k)}:</td>
               <td style="padding:2px 0;font-weight:600;">${_tpEsc(v)}</td>
             </tr>`,
        )
        .join("")}
    </table>
  `;

  // Frequenz-/Elektrodentabelle
  const headers = [
    "Nr.",
    "Hz",
    "Hz*",
    t("implThHdr"),
    _upperHdr(m),
    t("thActive"), // BA 164
    "Status",
    "Notiz",
  ];
  const rows = [];
  for (let i = 0; i < s.nEl; i++) {
    const elNum = dEN(i);
    const apexBasal =
      i === 0 ? " (apikal)" : i === s.nEl - 1 ? " (basal)" : "";
    const hzStd = s.freqs[i] != null ? Math.round(s.freqs[i]) : "—";
    const hzOwn = s.elFreqOwn[i] != null ? Math.round(s.elFreqOwn[i]) : "";
    const thr = im.thr && im.thr[i] != null ? im.thr[i] : "";
    const upper = isCi
      ? (m === "medel"
          ? im.mcl && im.mcl[i] != null ? im.mcl[i] : ""
          : im.upperLevel && im.upperLevel[i] != null ? im.upperLevel[i] : "")
      : "";
    const stKey = s.elSt[i];
    const stText = stKey ? t(_stI18nKey(stKey)) : "";
    const note = s.elNt[i] || "";
    // BA 164: Aktiv-Zelle
    const isActive = (s.elActive && s.elActive[i] !== false);
    const activeStr = isActive ? "✓" : "—";
    rows.push(
      `<tr>
        <td style="border:1px solid #ccc;padding:3px 6px;">E${elNum}${_tpEsc(apexBasal)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzStd)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzOwn)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(thr)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(upper)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${activeStr}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(stText)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(note)}</td>
      </tr>`,
    );
  }
  const elTable = `
    <table style="border-collapse:collapse;width:100%;font-size:0.85em;">
      <thead>
        <tr>${headers.map(h => `<th style="border:1px solid #888;padding:3px 6px;background:#eee;text-align:left;">${_tpEsc(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  const body = paramTable + elTable;
  openPrintWindow(t("tabFreq") || "Implantat", body);
}

function _upperHdr(m) {
  if (m === "medel")    return t("implMclHdr");
  if (m === "cochlear") return t("implCLvlHdr");
  if (m === "ab")       return t("implMLvlHdr");
  return "";
}

// --- Meßergebnisse-Sub-Tab Dispatcher ---
function printErgebnisseTab() {
  const sub = document.querySelector(
    '#panel-ergebnisse .subpanel.active',
  );
  if (!sub) return;
  const id = sub.id;
  if (id === "subpanel-ergebnisse-results")  return _printResLoudness();
  if (id === "subpanel-ergebnisse-stereobalance") return _printResLR();
  if (id === "subpanel-ergebnisse-freqmatch") return _printResFreqmatch();
  if (id === "subpanel-ergebnisse-latenz")    return _printResLatency();
}

function _printCloneSafe(rootSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) return "";
  const clone = root.cloneNode(true);

  // Inputs/Selects: aktuellen Wert als Text-Span einsetzen, dann
  // entfernen. So bleibt die gedruckte Tabelle vollständig.
  const origInputs = root.querySelectorAll("input, select");
  const cloneInputs = clone.querySelectorAll("input, select");
  for (let i = 0; i < origInputs.length && i < cloneInputs.length; i++) {
    const ci = cloneInputs[i];
    const oi = origInputs[i];
    let val = "";
    if (oi.type === "checkbox" || oi.type === "radio") {
      val = oi.checked ? "✓" : "—";
    } else if (oi.tagName === "SELECT") {
      const opt = oi.options[oi.selectedIndex];
      val = opt ? opt.textContent.trim() : "";
    } else {
      val = oi.value || "";
    }
    const span = document.createElement("span");
    span.textContent = val;
    span.style.fontFamily = "inherit";
    if (ci.parentNode) ci.parentNode.replaceChild(span, ci);
  }

  // Buttons und sonstige Bedienelemente weiterhin entfernen
  clone.querySelectorAll("button, .btn").forEach(el => el.remove());

  // Canvas durch <img> ersetzen (wie zuvor)
  const origCanvases = root.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  for (let i = 0; i < origCanvases.length && i < cloneCanvases.length; i++) {
    const imgHtml = canvasToImg(origCanvases[i], 800);
    const tmp = document.createElement("div");
    tmp.innerHTML = imgHtml;
    const img = tmp.firstElementChild;
    if (img && cloneCanvases[i].parentNode) {
      cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
    }
  }
  return clone.innerHTML;
}

function _printResLoudness() {
  const body = _printCloneSafe('#subpanel-ergebnisse-results .card');
  openPrintWindow(t("subTabLoudness") || "Elektrodenlautstärke-Balance", body);
}

function _printResLR() {
  const card   = document.querySelector('#stereobalanceResultsCard');
  const target = (card && card.style.display !== 'none')
    ? '#stereobalanceResultsCard'
    : '#stereobalanceNoResults';
  const body = _printCloneSafe(target);
  openPrintWindow(t("tabBalance") || "Stereo-Balance", body);
}

function _printResFreqmatch() {
  const noData = document.querySelector('#fmrNoData');
  const card   = document.querySelector('#fmrCard');
  const target = (card && card.style.display !== 'none')
    ? '#fmrCard'
    : '#fmrNoData';
  const body = _printCloneSafe(target);
  openPrintWindow(t("subTabFreqMatch") || "Frequenzabgleich", body);
}

function _printResLatency() {
  if (!latenzResult || !isFinite(latenzResult.valueMs)) {
    return openPrintWindow(t("latenzResTitle"),
      `<div class="print-card"><h2>${t("latenzResTitle")}</h2>` +
      `<p>${t("latenzResNoneText")}</p></div>`);
  }
  const v = latenzResult.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  let mainTxt;
  if (Math.abs(v) < 0.05) {
    mainTxt = t("latenzResNoOffset");
  } else if (v > 0) {
    mainTxt = t("latenzResLeftFaster").replace("{ms}", a);
  } else {
    mainTxt = t("latenzResRightFaster").replace("{ms}", a);
  }
  const typeKey = {
    "click":     "latenzTypeClick",
    "burst500":  "latenzTypeBurst500",
    "burst1500": "latenzTypeBurst1500",
    "burst4000": "latenzTypeBurst4000",
  }[latenzResult.clickType];
  const typeLabel = typeKey ? t(typeKey) : (latenzResult.clickType || "");
  const sign = v >= 0 ? "+" : "−";
  const body = `
    <div class="print-card">
      <h2>${t("latenzResTitle")}</h2>
      <p style="font-size:1.4em;font-weight:600;">${sign}${a} ms</p>
      <p>${mainTxt}</p>
      <p style="font-size:0.9em;">
        ${t("latenzResMeasuredWith")}: ${typeLabel},
        ${t("latenzResInterval")} ${latenzResult.intervalMs} ms
      </p>
      <p style="font-size:0.9em;">
        ${t("latenzResApplied")}: ${plApplyLatency ? t("yes") : t("no")}
      </p>
    </div>`;
  openPrintWindow(t("latenzResTitle"), body);
}

// --- Kurven-Tab ---
function printKurvenTab() {
  const chartCard  = _printCloneSafe('#panel-levels .card:nth-of-type(2)');
  const presetHtml = _buildPresetCardPrint();
  const body = chartCard + '<div style="margin-top:16px;"></div>' + presetHtml;
  openPrintWindow(t("tabLevels") || "Kurven", body);
}

// --- Schieber-Tab ---
function printSchieberTab() {
  const s = sideData[activeSide];
  if (!s) return;
  const m = s.manufacturer || "medel";
  const isAbs = lvTabMode === "abs";

  const modeLabel  = isAbs ? (t("lvTabModeAbsolute") || "absolut")
                           : (t("lvTabModeRelative") || "relativ");
  const variantLbl =
    lvTabVariant === "sum"   ? (t("lvTabVarSum")   || "nur Summe")
    : lvTabVariant === "lines" ? (t("lvTabVarLines") || "Vergleichslinien")
    : (t("lvTabVarStack") || "gestapelt");

  const cv = document.getElementById("lvTabCv");
  const canvasImg = cv ? canvasToImg(cv, 800) : "";

  const ml = s.elektrodenlautstaerkeSchieber || [];
  const im = s.implant || {};
  const headers = ["Nr.", "dB-Wert"];
  if (isAbs) headers.push(_upperHdr(m) + " (neu)");

  const rows = [];
  for (let i = 0; i < s.nEl; i++) {
    const elNum = dEN(i);
    const ap = i === 0 ? " (apikal)" : i === s.nEl - 1 ? " (basal)" : "";
    const db = ml[i] != null ? ml[i].toFixed(1) : "0.0";
    let unitVal = "";
    if (isAbs) {
      const upper = m === "medel"
        ? (im.mcl ? im.mcl[i] : null)
        : (im.upperLevel ? im.upperLevel[i] : null);
      if (upper != null) {
        const dbVal = ml[i] != null ? ml[i] : 0;
        let res = null;
        if (m === "medel" && typeof calcMedel === "function") {
          res = calcMedel(dbVal, upper);
        } else if (m === "cochlear" && typeof calcCochlear === "function") {
          res = calcCochlear(dbVal, upper, im.generation || "B");
        } else if (m === "ab" && typeof calcAB === "function") {
          const tOld = im.thr && im.thr[i] != null ? im.thr[i] : null;
          res = calcAB(dbVal, upper, tOld, im.idr || 60);
        }
        if (res && res.absolute != null) unitVal = Math.round(res.absolute);
      }
    }
    const tds = [`E${elNum}${ap}`, db + " dB"];
    if (isAbs) tds.push(unitVal === "" ? "—" : String(unitVal));
    rows.push(
      "<tr>" +
        tds.map(v => `<td style="border:1px solid #ccc;padding:3px 8px;">${_tpEsc(v)}</td>`).join("") +
        "</tr>",
    );
  }
  const table = `
    <table style="border-collapse:collapse;font-size:0.85em;width:100%;">
      <thead>
        <tr>${headers.map(h => `<th style="border:1px solid #888;padding:3px 8px;background:#eee;text-align:left;">${_tpEsc(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  const info = `
    <p style="font-size:0.9em;margin:8px 0 12px 0;color:#444;">
      <strong>${_tpEsc(t("lvTabModeLabel") || "Modus")}:</strong> ${_tpEsc(modeLabel)}
      &nbsp;·&nbsp;
      <strong>${_tpEsc(t("lvTabVariantLabel") || "Variante")}:</strong> ${_tpEsc(variantLbl)}
    </p>
  `;

  const body = info + canvasImg + '<div style="height:12px;"></div>' + table;
  openPrintWindow(t("lvTabTitle") || "Schieber", body);
}

function _buildPresetCardPrint() {
  const active = elektrodenlautstaerkeKurven.filter(pr => pr.on);
  let rows = "";
  for (const pr of active) {
    let params = `${t("lvPrStr")}: <b>${pr.strength.toFixed(1)} dB</b>`;
    if (PR_HAS_CENTER[pr.type])
      params += ` &nbsp; ${t("lvPrCenter")}: ${Math.round(pr.center != null ? pr.center : CENT_REF_HZ)} ${t("lvPrUnitHz")}`;
    if (PR_HAS_WIDTH[pr.type])
      params += ` &nbsp; ${t("lvPrWidth")}: ${Math.round(pr.width != null ? pr.width : 1200)} ${t("lvPrUnitCent")}`;
    if (PR_HAS_CUTOFF[pr.type])
      params += ` &nbsp; ${t("lvPrCutoff")}: ${pfx}${dEN(pr.cutoff)}`;
    rows += `<tr>
      <td class="pr-name" style="font-weight:bold;padding-right:12px;vertical-align:top">${t(PR_NAMES[pr.type])}</td>
      <td style="font-size:.9em;vertical-align:top">${params}</td>
    </tr><tr>
      <td colspan="2" style="font-size:.78em;padding-top:0;padding-bottom:6px">${t(PR_EXPL[pr.type])}</td>
    </tr>`;
  }
  if (!rows) rows = `<tr><td style="font-style:italic">(${t("lvPresetTitle")} — ${t("tabLevels")} keine aktiv)</td></tr>`;
  return `<div><h2 style="margin-bottom:8px">${t("lvPresetTitle") || "Kurvenfunktionen"}</h2>
    <table style="border-collapse:collapse;width:100%">${rows}</table></div>`;
}
