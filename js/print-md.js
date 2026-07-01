// ============================================================
// MARKDOWN PRINT/EXPORT
// ============================================================
//
// Generatoren für die Archiv-Box (Modus A) und später die
// Audiologen-Box (Modus B). Kein DOM-Druck — der bisherige
// fPrintBtn-Handler in init.js bleibt unangetastet und übernimmt
// den Druck mit Grafiken.
//
// Funktionen:
//   buildArchivMarkdown()       — vollständiger Modus-A-Bericht
//   mdArchivFilename()          — "CImbel_…_archiv_….md"
//   mdCopyToClipboard(text)     — Wrapper für navigator.clipboard
//   mdDownload(text, filename)  — File-Download via Blob

// ----------------------------------------------------------------
// Helfer
// ----------------------------------------------------------------

function _mdEsc(s) {
  // Markdown-Special-Zeichen entschärfen für Inline-Text (in
  // Tabellenzellen reicht das Escapen von | und \).
  if (s == null) return "";
  return String(s).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function _mdFmtDb(v, withSign) {
  if (v == null || !isFinite(v)) return "—";
  const sign = withSign && v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} dB`;
}

function _mdFmtHz(v) {
  if (v == null || !isFinite(v)) return "—";
  return `${Math.round(v)} Hz`;
}

function _mdBilateralLabel() {
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (m === "both")  return t("sideBoth")  || "beide Seiten";
  if (m === "mono")  return t("sideMono")  || "beide Seiten (Mono-EQ)";
  if (m === "left")  return t("sideLeft")  || "Links";
  if (m === "right") return t("sideRight") || "Rechts";
  return "";
}

function mdArchivFilename() {
  return buildCImbelFilename("archiv", null, ".md");
}

function mdCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => alert(t("copyDone")))
      .catch(() => _mdCopyFallback(text));
  }
  return _mdCopyFallback(text);
}

function _mdCopyFallback(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  alert(t("copyDone"));
}

function mdDownload(text, filename) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ----------------------------------------------------------------
// DATENSAMMLER — gemeinsame Basis für Markdown- und Druck-Renderer
// ----------------------------------------------------------------

function collectArchivData() {
  const now = new Date();
  const localeFor = (lng) =>
    lng === "de" ? "de-DE" : lng === "fr" ? "fr-FR" : lng === "es" ? "es-ES" : "en-US";
  const data = {
    meta: {
      dateStr: now.toLocaleString(localeFor(lang)),
      version: (typeof APP_VERSION !== "undefined") ? APP_VERSION : "?",
      lang: lang,
      activeSide: activeSide,
    },
    testSettings: _collectTestSettings(),
    defaultMfr: defaultMfr,
    schieberELL: {
      mode: schieberELLMode,
      variant: schieberELLVariant,
      showMeas: schieberELLShowMeas,
      showCurves: schieberELLShowCurves,
    },
    sides: {
      left:  _collectSideData("left"),
      right: _collectSideData("right"),
    },
    bilateral: _collectBilateral(),
    player: _collectPlayer(),
    saetze: _collectSaetze(),
  };
  return data;
}

function _collectTestSettings() {
  function _row(toneType, sequence, duration, pause, volume) {
    return { toneType: toneType, sequence: sequence,
             duration: duration, pause: pause, volume: volume };
  }
  return {
    elektrodenlautstaerke: _row(
      (typeof toneType_elektrodenlautstaerke !== "undefined") ? toneType_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.toneType,
      (typeof sequence_elektrodenlautstaerke !== "undefined") ? sequence_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.sequence,
      (typeof duration_elektrodenlautstaerke !== "undefined") ? duration_elektrodenlautstaerke : null,
      (typeof pause_elektrodenlautstaerke    !== "undefined") ? pause_elektrodenlautstaerke    : null,
      (typeof volume_global !== "undefined") ? volume_global : null
    ),
    stereobalance: _row(
      (typeof toneType_stereobalance !== "undefined") ? toneType_stereobalance : TEST_DEFAULTS.stereobalance.toneType,
      (typeof sequence_stereobalance !== "undefined") ? sequence_stereobalance : TEST_DEFAULTS.stereobalance.sequence,
      (typeof duration_stereobalance !== "undefined") ? duration_stereobalance : null,
      (typeof pause_stereobalance    !== "undefined") ? pause_stereobalance    : null,
      (typeof volume_global    !== "undefined") ? volume_global    : null
    ),
    freqmatch: _row(
      (typeof toneType_freqmatch !== "undefined") ? toneType_freqmatch : TEST_DEFAULTS.freqmatch.toneType,
      (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : TEST_DEFAULTS.freqmatch.sequence,
      (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : null,
      (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : null,
      (typeof volume_global      !== "undefined") ? volume_global      : null
    )
  };
}

function _collectSideData(side) {
  return withSide(side, () => {
    const sd = sideData[side];
    const impl = (sd && sd.implant) || {};
    const unit = (typeof ELL_unitLabelFor === "function") ? ELL_unitLabelFor(mfr) : "";

    // Implantat-Elektroden-Tabelle
    const electrodes = [];
    for (let i = 0; i < nEl; i++) {
      electrodes.push({
        idx: i,
        label: `${dENPrefix()}${dEN(i)}`,
        hzStandard: (sd.FRQ_implantat && sd.FRQ_implantat[i]) || null,
        hzOwn:      (sd.FRQ_implantatOwn && sd.FRQ_implantatOwn[i] != null) ? sd.FRQ_implantatOwn[i] : null,
        thr: (impl.thr && impl.thr[i] != null) ? impl.thr[i] : null,
        upper: _pickUpperLevel(impl, i, mfr),
        unit,
        // BA 164: inaktive Elektrode → "deactivated" für Archiv-Rendering
        status: (elActive && elActive[i] === false) ? "deactivated" : (elSt[i] || null),
        note: elNt[i] || "",
        excluded: elExDur[i] !== null && elExDur[i] !== undefined,
      });
    }

    // Messungen
    const measHas = Array.isArray(ELL_results) && ELL_results.length > 0;
    let measRows = [];
    let measRefEl = null;
    let measSweep = null;
    if (measHas) {
      measRefEl = ELL_refEl;
      const { raw: levels, residual: ELL_res } = ELL_testData({ ctx: ELL_ctx("global") });
      for (let i = 0; i < nEl; i++) {
        const inMeas = ELL_results.some((r) => r.a === i || r.b === i);
        measRows.push({
          idx: i,
          label: `${dENPrefix()}${dEN(i)}`,
          hz: FRQ_implantatEffektiv(i),
          offsetDb:   inMeas ? levels[i] : null,
          residualDb: inMeas ? ELL_res[i]  : null,
          // BA 164: inaktive Elektrode → "deactivated" für Archiv-Rendering
          status: (elActive && elActive[i] === false) ? "deactivated" : (elSt[i] || null),
          note: elNt[i] || "",
        });
      }
      if (sd.fullSweepRound != null) {
        measSweep = {
          round: sd.fullSweepRound,
          doneCount: Array.isArray(sd.fullSweepDonePairs) ? sd.fullSweepDonePairs.length : 0,
          totalPairs: (nEl * (nEl - 1)) / 2,
        };
      }
    }

    // Schieber
    const ml = schieberELL || [];
    const schHasNonZero = ml.some((v) => v != null && v !== 0);
    const schRows = [];
    if (schHasNonZero) {
      const absMode = (schieberELLMode === "abs"
                       && typeof schieberELLAbsoluteAvailable === "function"
                       && schieberELLAbsoluteAvailable());
      for (let i = 0; i < nEl; i++) {
        const v = ml[i] || 0;
        let absDelta = null;
        if (absMode) absDelta = _calcAbsDelta(side, i, v, mfr, impl);
        schRows.push({
          idx: i,
          label: `${dENPrefix()}${dEN(i)}`,
          hz: FRQ_implantatEffektiv(i),
          relDb: v,
          absDelta,
          absUnit: unit,
        });
      }
    }

    // Kurven
    const kurvActive = (kurvenELL || []).filter((p) => p.on && p.strength !== 0);
    const kurvList = kurvActive.map((p) => ({
      typeKey: p.type,
      strength: p.strength,
      center: (p.center !== undefined) ? p.center : null,
      width:  (p.width  !== undefined) ? p.width  : null,
      cutoff: (p.cutoff !== undefined) ? p.cutoff : null,
    }));

    // Frequenzabgleich — Archiv-Format: kanonisches cent, seitenneutral (eine
    // Zeile je Elektrode, kein Seiten-Filter, kein Player-Bezug).
    const frq_rows = [];
    const frq_src = (typeof _warpFResSource === "function")
      ? _warpFResSource()
      : ((typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) ? FRQ_resultsArray : []);
    for (const r of frq_src) {
      frq_rows.push({
        elIdx: r.elIdx,
        elLabel: `${dENPrefix()}${dEN(r.elIdx)}`,
        cent: r.cent,
        provisional: !!r._provisional,
      });
    }

    return {
      side,
      label: side === "left" ? t("sideLeft") : t("sideRight"),
      config: sd.config || "ci",
      manufacturer: mfr,
      manufacturerLabel: (MFR[mfr] && MFR[mfr].name) || mfr,
      nEl,
      implant: {
        model:     impl.model     || null,
        processor: impl.processor || null,
        cValue:    impl.cValue    || null,
        idr:       impl.idr       || null,
        generation: impl.generation || null,
        strategy:  impl.strategy  || null,
        unit,
        electrodes,
      },
      ell: {
        has: measHas,
        hasNonZero: measRows.some((r) => r.offsetDb != null && Math.abs(r.offsetDb) > 0),
        ELL_refEl: measRefEl,
        rows: measRows,
        sweep: measSweep,
      },
      schieberELL: {
        has: schHasNonZero,
        mode: schieberELLMode,
        rows: schRows,
      },
      kurvenELL: {
        has: kurvList.length > 0,
        list: kurvList,
      },
      freqmatch: {
        has: frq_rows.length > 0,
        rows: frq_rows,
      },
    };
  });
}

function _pickUpperLevel(impl, i, mfrLocal) {
  if (mfrLocal === "medel")
    return (impl.mcl && impl.mcl[i] != null) ? impl.mcl[i] : null;
  return (impl.upperLevel && impl.upperLevel[i] != null) ? impl.upperLevel[i] : null;
}

function _calcAbsDelta(side, i, dB, mfrLocal, impl) {
  const mcl = (impl.mcl && impl.mcl[i]) || (impl.upperLevel && impl.upperLevel[i]);
  const thr = impl.thr && impl.thr[i];
  let res = null;
  if (mfrLocal === "medel"    && typeof calcMedel    === "function" && mcl != null) res = calcMedel(dB, mcl);
  else if (mfrLocal === "cochlear" && typeof calcCochlear === "function" && mcl != null) res = calcCochlear(dB, mcl, impl.generation);
  else if (mfrLocal === "ab"  && typeof calcAB       === "function" && mcl != null && thr != null) res = calcAB(dB, mcl, thr, impl.idr);
  return (res && res.delta != null && isFinite(res.delta)) ? res.delta : null;
}

function _collectBilateral() {
  const out = { stereobalance: { has: false, rows: [], mean: null }, latenz: { has: false, value: null } };
  if (typeof STB_results !== "undefined") {
    const keys = Object.keys(STB_results).filter((k) => isFinite(STB_results[k]));
    if (keys.length > 0) {
      out.stereobalance.has = true;
      const sorted = keys.slice().sort((a, b) => (+a) - (+b));
      out.stereobalance.rows = sorted.map((k) => ({ elIdx: +k, value: STB_results[k] }));
      out.stereobalance.mean = sorted.reduce((a, k) => a + STB_results[k], 0) / sorted.length;
    }
  }
  if (typeof LTZ_result !== "undefined" && LTZ_result
      && isFinite(LTZ_result.valueMs) && LTZ_result.valueMs !== 0) {
    out.latenz.has = true;
    out.latenz.value = {
      ms: LTZ_result.valueMs,
      clickType: LTZ_result.clickType || null,
      intervalMs: LTZ_result.intervalMs || null,
    };
  }
  return out;
}

function _collectPlayer() {
  const sideMode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const nhEl  = document.getElementById("plNHSim");
  const eqOn  = (typeof plEqOn !== "undefined") ? plEqOn : true;

  // BA 315: volle Korrektur (EQ + flache Balance) aus der zentralen
  // Quelle, nhSim NICHT angewendet (false). getPlayerCorrection gated
  // bereits den EQ-Schalter (bei aus -> alles 0).
  const eqGains = { left: [], right: [] };
  let hasNonZero = false;
  for (const side of SIDES) {
    const corr = getPlayerCorrection(side, false);
    for (let i = 0; i < corr.eq.length; i++) {
      const v = corr.eq[i] + corr.balance;
      eqGains[side].push(v);
      if (Math.abs(v) > 0.05) hasNonZero = true;
    }
  }

  return {
    sideMode,
    eqOn,
    nhSim: nhEl ? nhEl.checked : false,
    srcMeas:    (typeof plSrcMeas    !== "undefined") ? plSrcMeas    : true,
    srcLevels:  (typeof plSrcLevels  !== "undefined") ? plSrcLevels  : true,
    srcCurves:  (typeof plSrcCurves  !== "undefined") ? plSrcCurves  : true,
    applySTB: (typeof plApplyBalance !== "undefined") ? plApplyBalance : false,
    balanceMode:  (typeof plBalanceMode  !== "undefined") ? plBalanceMode  : "sym",
    applyLTZ: (typeof plApplyLatency !== "undefined") ? plApplyLatency : false,
    warpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,

    warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "right",
    warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
    warpRbOptions: (typeof pRubberbandOptions !== "undefined")
      ? { ...pRubberbandOptions } : null,
    maplawOn:     (typeof pMaplawOn     !== "undefined") ? pMaplawOn     : false,
    maplawSollC:  (typeof pMaplawSollC  !== "undefined") ? pMaplawSollC  : null,
    eqGains,
    eqHasNonZero: hasNonZero,
    eqHeadroomDb: (typeof _eqHeadroomOffset === "function") ? _eqHeadroomOffset() : 0,
    eqHeadroomBoth: (typeof plEqHeadroomBoth !== "undefined") ? plEqHeadroomBoth : true,
    eqHeadroomDbLeft:  (typeof _eqHeadroomOffsetForSides === "function") ? _eqHeadroomOffsetForSides(["left"])  : 0,
    eqHeadroomDbRight: (typeof _eqHeadroomOffsetForSides === "function") ? _eqHeadroomOffsetForSides(["right"]) : 0,
  };
}

function _collectSaetze() {
  if (typeof sLocalCollections === "undefined") return { collections: [] };
  const arr = Array.from(sLocalCollections.values()).map((c) => ({
    id: c.id,
    label: c.label,
    lang: c.lang,
    kind: c.kind,
    folderName: c.folderName,
    fileCount: (c.recordings && c.recordings.length) || 0,
    persistable: !!c.persistable,
    stub: !!c.stub,
  }));
  return { collections: arr };
}

// ----------------------------------------------------------------
// RENDERER MARKDOWN — Archiv (Modus A)
// ----------------------------------------------------------------

function renderArchivMarkdown(data) {
  const parts = [
    _archivMdHeader(data),
    _audiologUserNoteBlock(),
    _archivMdConfig(data),
    _archivMdImplantTables(data),
    _archivMdTestSettings(data),
    _archivMdSidesContent(data),
    _archivMdBilateral(data),
    _archivMdPlayer(data),
    _archivMdMisc(data),
  ];
  return parts.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function _archivMdHeader(data) {
  return `# CImbel — CI sound balancing — ${t("archivTitle")}\n\n`
       + `**${t("archivHeaderDate")}**: ${data.meta.dateStr}\n`
       + `**${t("archivHeaderVersion")}**: v${data.meta.version}\n`
       + `**${t("archivHeaderLang")}**: ${data.meta.lang.toUpperCase()}\n`
       + `**${t("archivHeaderActive")}**: ${data.meta.activeSide === "left" ? t("sideLeft") : t("sideRight")}\n`;
}

function _archivMdConfig(data) {
  const lines = [`\n## ${t("archivSecConfig")}\n`];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    lines.push(`### ${sd.label}`);
    const _CFG_KEY = { ci: "cfgCI", hg: "cfgHG", normal: "cfgNormal", shoh: "cfgSchwerh", deaf: "cfgTaub" };
    const cfgLabel = t(_CFG_KEY[sd.config] || "") || sd.config;
    lines.push(`- ${t("archivCfgConfig")}: ${cfgLabel}`);
    lines.push(`- ${t("archivCfgMfr")}: ${sd.manufacturerLabel}`);
    lines.push(`- ${t("archivCfgN")}: ${sd.nEl}`);
    const im = sd.implant;
    if (im.model)      lines.push(`- ${t("archivCfgModel")}: ${im.model}`);
    if (im.processor)  lines.push(`- ${t("archivCfgProcessor")}: ${im.processor}`);
    if (im.cValue)     lines.push(`- ${t("archivCfgCValue")}: ${im.cValue}`);
    if (im.idr)        lines.push(`- ${t("archivCfgIdr")}: ${im.idr}`);
    if (im.generation) lines.push(`- ${t("archivCfgGeneration")}: ${im.generation}`);
    if (im.strategy)   lines.push(`- ${t("archivCfgStrategy")}: ${im.strategy}`);
    lines.push("");
  }
  return lines.join("\n");
}

function _archivMdImplantTables(data) {
  const out = [`\n## ${t("archivSecImplant")}\n`];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    out.push(`### ${sd.label} (${sd.manufacturerLabel})`);
    out.push("");
    const unit = sd.implant.unit || "qu";
    out.push(`| ${t("thEl")} | ${t("archivImplHzStd")} | ${t("archivImplHzOwn")} | ${t("archivImplThr")} (${unit}) | ${t("archivImplUpper")} (${unit}) | ${t("archivImplStatus")} | ${t("archivImplExcl")} | ${t("archivImplNote")} |`);
    out.push("|---|---|---|---|---|---|---|---|");
    for (const e of sd.implant.electrodes) {
      const hzStd  = _mdFmtHz(e.hzStandard);
      const hzOwn  = (e.hzOwn != null) ? _mdFmtHz(e.hzOwn) : "";
      const thrTxt = (e.thr   != null) ? e.thr   : "";
      const upTxt  = (e.upper != null) ? e.upper : "";
      const _ST_KEY = { noisyLess: "stNoisyLess", noisyMore: "stNoisyMore", noisyHeavy: "stNoisyHeavy", almostMute: "stAlmMute", mute: "stMute", deactivated: "stDeactivated" }; // BA 164: Quelle ist jetzt elActive (via _collectSideData)
      const stTxt  = e.status ? (t(_ST_KEY[e.status] || "") || e.status) : "";
      const exclTxt = e.excluded ? "**X**" : "";
      const note = _mdEsc(e.note || "");
      out.push(`| ${e.label} | ${hzStd} | ${hzOwn} | ${thrTxt} | ${upTxt} | ${stTxt} | ${exclTxt} | ${note} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

function _archivMdTestSettings(data) {
  var TONE_LABEL_KEY = {
    richCiHF: "toneRichCiHF", richCiG:  "toneRichCiG",
    richCiS:  "toneRichCiS",
    richCiH:  "toneRichCiH",
    richCiP:  "toneRichCiP",
    richCiB:  "toneRichCiB",  richCiBF: "toneRichCiBF",
    richCiHA: "toneRichCiHA", richCiHS: "toneRichCiHS",
    richCiGVL: "toneRichCiGVL", richCiGVN: "toneRichCiGVN",
    richCiGVS: "toneRichCiGVS",
    richCiGA1: "toneRichCiGA1", richCiGA2: "toneRichCiGA2",
    richCiGB:  "toneRichCiGB",
    richCiGD1: "toneRichCiGD1", richCiGD2: "toneRichCiGD2",
    sine: "toneSine", complex: "toneComplex",
    pulsedComplex: "tonePulsedComplex", richTone: "toneRichTone",
    richAcc: "toneRichAcc", richASax: "toneRichASax",
    richBTb: "toneRichBTb", richVa:  "toneRichVa",
    richBn:  "toneRichBn",  richClBb: "toneRichClBb",
    richCb:  "toneRichCb",  richOb:   "toneRichOb",
    richTbn: "toneRichTbn", richFl:   "toneRichFl",
    richTpC: "toneRichTpC", richVn:   "toneRichVn",
    richVc:  "toneRichVc",  richHn:   "toneRichHn",
    noise: "toneNoise", noiseAdaptive: "toneNoiseAdaptive",
    irn: "toneIRN", amSine: "toneAmSine",
    warbleSine: "toneWarbleSine", burstSine: "toneBurstSine",
    wobbleSweep: "toneWobbleSweep",
    neighborSine: "toneNeighborSine",
    sineNoiseHalf: "toneSineNoiseHalf", sineNoiseFull: "toneSineNoiseFull",
    clusterHz2x3: "toneClusterHz2x3", clusterHz4x3: "toneClusterHz4x3",
    clusterHz2x8: "toneClusterHz2x8", clusterHz4x8: "toneClusterHz4x8",
    clusterCent2x10: "toneClusterCent2x10", clusterCent4x10: "toneClusterCent4x10",
    clusterCent2x30: "toneClusterCent2x30", clusterCent4x30: "toneClusterCent4x30"
  };
  var ts = data.testSettings;
  var lines = ["\n## " + t("archivSecTest") + "\n"];

  function _renderRow(headerKey, row) {
    lines.push("\n### " + t(headerKey) + "\n");
    lines.push("- " + t("toneTypeLabel") + ": "
      + t(TONE_LABEL_KEY[row.toneType] || "toneSine"));
    lines.push("- " + t("archivTestSeq") + ": "
      + String(row.sequence || "ab").toUpperCase());
    if (row.duration != null) lines.push("- " + t("lblDur") + ": " + row.duration + " ms");
    if (row.pause    != null) lines.push("- " + t("lblPau") + ": " + row.pause    + " ms");
    if (row.volume   != null) lines.push("- " + t("lblVol") + ": " + row.volume   + " %");
  }

  _renderRow("ELL_verfahrenFull",  ts.elektrodenlautstaerke);
  _renderRow("STB_title",            ts.stereobalance);
  _renderRow("FRQ_title",            ts.freqmatch);

  return lines.join("\n") + "\n";
}

function _archivMdSidesContent(data) {
  const out = [];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    const sections = [];
    if (sd.ell.has)      sections.push(_archivMdELL(sd));
    if (sd.schieberELL.has)  sections.push(_archivMdSchieberELL(sd));
    if (sd.kurvenELL.has)    sections.push(_archivMdKurvenELL(sd));
    if (sd.freqmatch.has) sections.push(_archivMdFRQ(sd));
    if (sections.length === 0) continue;
    out.push(`\n## ${sd.label}\n`);
    out.push(sections.join("\n"));
  }
  return out.join("\n");
}

function _archivMdELL(sd) {
  const out = [];
  const refTxt = (sd.ell.ELL_refEl != null)
    ? `${(sd.implant.electrodes[sd.ell.ELL_refEl] || {}).label || ""}`
    : "—";
  out.push(`### ${t("archivSecELL")} (${t("archivElektrodenlautstaerkeRef")}: ${refTxt})`);
  out.push("");
  if (sd.ell.sweep) {
    out.push(`_${t("archivElektrodenlautstaerkeSweepNote")
      .replace("{round}", sd.ell.sweep.round)
      .replace("{done}",  sd.ell.sweep.doneCount)
      .replace("{total}", sd.ell.sweep.totalPairs)}_`);
    out.push("");
  }
  out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("thOff")} | ${t("thRes")} | ${t("thStR")} | ${t("thRefEl")} |`);
  out.push("|---|---|---|---|---|---|");
  for (const r of sd.ell.rows) {
    const offTxt = (r.offsetDb   != null) ? _mdFmtDb(r.offsetDb, true)  : "—";
    const resTxt = (r.residualDb != null) ? _mdFmtDb(r.residualDb, false) : "—";
    const _ST_KEY2 = { noisyLess: "stNoisyLess", noisyMore: "stNoisyMore", noisyHeavy: "stNoisyHeavy", almostMute: "stAlmMute", mute: "stMute", deactivated: "stDeactivated" }; // BA 164: Quelle ist jetzt elActive (via _collectSideData)
    const stTxt  = r.status ? (t(_ST_KEY2[r.status] || "") || r.status) : "";
    const noteTxt = r.note ? ` (${_mdEsc(r.note)})` : "";
    const refMark = (sd.ell.ELL_refEl != null && r.idx === sd.ell.ELL_refEl) ? "**X**" : "";
    out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} | ${refMark} |`);
  }
  return out.join("\n") + "\n";
}

function _archivMdSchieberELL(sd) {
  const out = [];
  const modeLabel = (sd.schieberELL.mode === "abs") ? t("schieberELLModeAbsolute") : t("schieberELLModeRelative");
  out.push(`### ${t("archivSecSchieberELL")} (${modeLabel})`);
  out.push("");
  const showAbs = sd.schieberELL.mode === "abs" && sd.schieberELL.rows.some((r) => r.absDelta != null);
  if (showAbs) {
    const unit = sd.implant.unit || "";
    out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} | ${unit} |`);
    out.push("|---|---|---|---|");
    for (const r of sd.schieberELL.rows) {
      const absTxt = (r.absDelta != null)
        ? `${r.absDelta >= 0 ? "+" : ""}${r.absDelta.toFixed(1)}`
        : "—";
      out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${_mdFmtDb(r.relDb, true)} | ${absTxt} |`);
    }
  } else {
    out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} |`);
    out.push("|---|---|---|");
    for (const r of sd.schieberELL.rows) {
      out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${_mdFmtDb(r.relDb, true)} |`);
    }
  }
  return out.join("\n") + "\n";
}

function _archivMdKurvenELL(sd) {
  const out = [`### ${t("archivSecKurvenELL")}`, ""];
  for (const p of sd.kurvenELL.list) {
    const name = (typeof KURVEN_ELL_NAMES !== "undefined" && KURVEN_ELL_NAMES[p.typeKey]) ? t(KURVEN_ELL_NAMES[p.typeKey]) : p.typeKey;
    const parts = [];
    parts.push(`${t("archivKurvenELLStrength")}: ${(p.strength >= 0 ? "+" : "") + p.strength} dB`);
    if (p.center !== null) parts.push(`${t("archivKurvenELLCenter")}: ${(sd.implant.electrodes[Math.round(p.center)] || {}).label || ("E" + p.center)}`);
    if (p.width  !== null) parts.push(`${t("archivKurvenELLWidth")}: ${p.width}`);
    if (p.cutoff !== null) parts.push(`${t("archivKurvenELLCutoff")}: ${(sd.implant.electrodes[p.cutoff] || {}).label || ("E" + p.cutoff)}`);
    out.push(`- **${name}** — ${parts.join(", ")}`);
  }
  return out.join("\n") + "\n";
}

function _archivMdFRQ(sd) {
  const out = [`### ${t("FRQ_measureTitle")}`, ""];
  out.push(`| ${t("FRQ_resColEl")} | ${t("FRQ_resColCent")} |`);
  out.push("|---|---|");
  let hasProv = false;
  for (const r of sd.freqmatch.rows) {
    const centStr = `${r.cent >= 0 ? "+" : ""}${Math.round(r.cent)} ¢`;
    const lbl = r.provisional ? `${r.elLabel} *` : r.elLabel;
    if (r.provisional) hasProv = true;
    out.push(`| ${lbl} | ${centStr} |`);
  }
  if (hasProv) {
    out.push("");
    out.push(`_${t("archivFmProvNote")}_`);
  }
  return out.join("\n") + "\n";
}

function _archivMdBilateral(data) {
  const bil = data.bilateral;
  if (!bil.stereobalance.has && !bil.latenz.has) return "";
  const out = [`\n## ${t("archivSecBilateral")}\n`];
  if (bil.stereobalance.has) {
    out.push(`### ${t("balTitle")}`);
    out.push("");
    out.push(`| ${t("thEl")} | ${t("archivSTBOffset")} |`);
    out.push("|---|---|");
    for (const r of bil.stereobalance.rows) {
      out.push(`| E${r.elIdx + 1} | ${_mdFmtDb(r.value, true)} |`);
    }
    out.push("");
    out.push(`**${t("archivSTBMean")}**: ${_mdFmtDb(bil.stereobalance.mean, true)}`);
    out.push("");
  }
  if (bil.latenz.has) {
    const v = bil.latenz.value;
    const sideTxt = v.ms >= 0 ? t("sideRight") : t("sideLeft");
    out.push(`### ${t("LTZ_resTitle") || "Inter-Ohr-Latenz"}`);
    out.push(`- ${t("archivLTZValue")}: ${Math.abs(v.ms).toFixed(2)} ms (${sideTxt})`);
    if (v.clickType)  out.push(`- ${t("archivLTZClick")}: ${v.clickType}`);
    if (v.intervalMs) out.push(`- ${t("archivLTZInterval")}: ${v.intervalMs} ms`);
    out.push("");
  }
  return out.join("\n");
}

function _archivMdPlayer(data) {
  const p = data.player;
  const sideLabel = p.sideMode === "both"  ? (t("sideBoth")  || "beide Seiten")
                  : p.sideMode === "mono"  ? (t("sideMono")  || "beide Seiten (Mono-EQ)")
                  : p.sideMode === "left"  ? t("sideLeft")
                  : p.sideMode === "right" ? t("sideRight") : "—";
  const out = [`\n## ${t("archivSecPlayer")}\n`];
  out.push(`- ${t("archivPlSide")}: ${sideLabel}`);
  out.push(`- ${t("archivPlEqOn")}: ${p.eqOn ? t("on") : t("off")}`);
  out.push(`- ${t("archivPlNH")}: ${p.nhSim ? t("on") : t("off")}`);
  if (p.eqOn && p.nhSim) {
    out.push(`> ${t("nhSimNotApplied")}`);
  }
  if (p.eqHeadroomBoth) {
    if (p.eqHeadroomDb && p.eqHeadroomDb > 0) {
      out.push(`> ${t("eqHeadroomNote").replace("{db}", p.eqHeadroomDb.toFixed(1))}`);
    }
  } else if ((p.eqHeadroomDbLeft && p.eqHeadroomDbLeft > 0)
          || (p.eqHeadroomDbRight && p.eqHeadroomDbRight > 0)) {
    out.push(`> ${t("eqHeadroomNoteIndepArchive")
      .replace("{dbL}", (p.eqHeadroomDbLeft || 0).toFixed(1))
      .replace("{dbR}", (p.eqHeadroomDbRight || 0).toFixed(1))}`);
  }
  out.push(`- ${t("archivPlSrc")}: ${t("archivSrcELL")} ${p.srcMeas ? "✓" : "✗"} · ${t("archivSrcLevels")} ${p.srcLevels ? "✓" : "✗"} · ${t("archivSrcCurves")} ${p.srcCurves ? "✓" : "✗"}`);
  const bmTxt = t("plBalMode" + p.balanceMode.charAt(0).toUpperCase() + p.balanceMode.slice(1)) || p.balanceMode;
  out.push(`- ${t("archivPlSTB")}: ${p.applySTB ? t("on") : t("off")}${p.applySTB ? " (" + bmTxt + ")" : ""}`);
  out.push(`- ${t("archivPlLTZ")}: ${p.applyLTZ ? t("on") : t("off")}`);
  out.push(`- ${t("archivPlMaplaw")}: ${p.maplawOn ? t("on") : t("off")}${p.maplawOn ? " (Soll-c=" + p.maplawSollC + ")" : ""}`);
  if (p.warpOn) {
    const modeKey = p.warpMode === "left"  ? "pwModeLeft"
                  : p.warpMode === "right" ? "pwModeRight" : "pwModeSym";
    out.push(`- ${t("archivPlWarp")}: ${t("on")} (${t(modeKey)}, ${p.warpStrength}%)`);
    if (p.warpRbOptions) {
      const o = p.warpRbOptions;
      const engKey = (o.engine === "r2") ? "pwEngineR2" : "pwEngineR3";
      const matKey = (o.material === "speech")     ? "pwMaterialSpeech"
                   : (o.material === "percussive") ? "pwMaterialPercussive"
                   : "pwMaterialStandard";
      const flags = [];
      if (o.formant) flags.push(t("pwOptFormant"));
      if (o.fast)    flags.push(t("pwOptFast"));
      const flagsStr = flags.length ? " · " + flags.join(", ") : "";
      out.push(`  - ${t("pwEngineLabel")}: ${t(engKey)} · ${t("pwMaterialLabel")}: ${t(matKey)}${flagsStr}`);
    }
  } else {
    out.push(`- ${t("archivPlWarp")}: ${t("off")}`);
  }
  return out.join("\n") + "\n";
}

function _archivMdMisc(data) {
  const out = [`\n## ${t("archivSecMisc")}\n`];
  out.push(`- ${t("archivCfgDefMfr")}: ${(MFR[data.defaultMfr] && MFR[data.defaultMfr].name) || data.defaultMfr}`);
  out.push(`- ${t("archivSchieberELLMode")}: ${data.schieberELL.mode === "abs" ? t("schieberELLModeAbsolute") : t("schieberELLModeRelative")}`);
  out.push(`- ${t("archivSchieberELLVariant")}: ${data.schieberELL.variant}`);
  out.push(`- ${t("archivSchieberELLShowMeas")}: ${data.schieberELL.showMeas ? t("on") : t("off")}`);
  out.push(`- ${t("archivSchieberELLShowCurves")}: ${data.schieberELL.showCurves ? t("on") : t("off")}`);
  if (data.saetze.collections.length > 0) {
    out.push("");
    out.push(`### ${t("archivMiscSaetze")}`);
    for (const c of data.saetze.collections) {
      const flag = c.stub ? ` _(${t("archivMiscSaetzeStub")})_` : "";
      out.push(`- **${_mdEsc(c.label)}** (${c.lang}, ${c.kind}) — ${c.fileCount} ${t("archivMiscSaetzeFiles")}${flag}`);
    }
  }
  return out.join("\n");
}

// ============================================================
// MODUS B — AUDIOLOGEN-AUFTRAG
// ============================================================
// Berichts-Aufbau: siehe Bauanleitung 42.
// Hauptgenerator: buildAudiologMarkdown()
// Druck-Variante:  audiologPrint()
// Markdown-Export: mdAudiologFilename() + buildAudiologMarkdown()

// ---------- Side-Modus ----------

function mdAudiologFilename() {
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const sideTag = (side === "left")  ? "L"
                : (side === "right") ? "R"
                : "LR";
  return buildCImbelFilename("audiologe", sideTag, ".md");
}

function _audiologMainSides() {
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (m === "left")  return ["left"];
  if (m === "right") return ["right"];
  return ["left", "right"];
}

function _audiologSideLabel(side) {
  return side === "left" ? t("sideLeft") : t("sideRight");
}

// ---------- Gewinne pro Seite (ΔdB) ----------

function _audiologDbForSide(side) {
  // BA 315: volle Korrektur (EQ + flache Balance) aus der zentralen
  // Quelle, nhSim NICHT angewendet. EQ-Schalter-Gate steckt in
  // getPlayerCorrection (bei aus -> alles 0).
  const corr = getPlayerCorrection(side, false);
  return corr.eq.map(function (v) { return v + corr.balance; });
}

// ---------- Residuum pro Elektrode (für Tabelle + Chart) ----------

function _audiologELLResForSide(side) {
  return withSide(side, () => {
    try {
      const { ELL_res } = ELL_compWLS();
      return Array.from(ELL_res || []);
    } catch (e) {
      return new Array(nEl).fill(0);
    }
  });
}

// ---------- Implantat-Werte: MCL → neuer Wert (qu/CL/CU) ----------

function _audiologAbsDelta(side, i, dB) {
  return withSide(side, () => {
    const impl = sideData[side].implant || {};
    const mcl = impl.mcl && impl.mcl[i];
    const thr = impl.thr && impl.thr[i];
    const unit = ELL_unitLabelFor(mfr);
    let res = null;
    if (mfr === "medel" && mcl != null) {
      res = calcMedel(dB, mcl);
    } else if (mfr === "cochlear" && mcl != null) {
      res = calcCochlear(dB, mcl, impl.generation);
    } else if (mfr === "ab" && mcl != null && thr != null) {
      res = calcAB(dB, mcl, thr, impl.idr);
    }
    if (res && res.delta != null && isFinite(res.delta)) {
      return { mcl: mcl, delta: res.delta, newVal: mcl + res.delta, unit };
    }
    return { mcl: mcl, delta: null, newVal: null, unit };
  });
}

// ---------- Hilfsformatierer ----------

function _audDb(v) {
  if (!isFinite(v) || v == null) return "—";
  if (Math.abs(v) < 0.05) return "0.0 dB";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} dB`;
}
function _audUnit(v, unit) {
  if (!isFinite(v) || v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} ${unit}`;
}
function _audUnitAbs(v, unit) {
  if (!isFinite(v) || v == null) return "—";
  return `${v.toFixed(1)} ${unit}`;
}
function _audCent(varHz, refHz) {
  if (!isFinite(varHz) || !isFinite(refHz) || varHz <= 0 || refHz <= 0) return "—";
  const c = 1200 * Math.log2(refHz / varHz);
  return `${c >= 0 ? "+" : ""}${Math.round(c)} cent`;
}

function _audStatusText(side, i) {
  return withSide(side, () => {
    // BA 164: inaktive Elektrode → vertraute Bezeichnung „Im CI deaktiviert"
    if (elActive && elActive[i] === false) return t("stDeactivated");
    if (elSt[i] === "mute") return t("audStatMute");
    if (elSt[i]) {
      const lb = {
        noisyHeavy: t("stNoisyHeavy"),
        noisyMore:  t("stNoisyMore"),
        noisyLess:  t("stNoisyLess"),
        almostMute: t("stAlmMute"),
      };
      return lb[elSt[i]] || "";
    }
    return "";
  });
}

// ---------- Testprogramm-Heuristik ----------
// Erkennt: keine elektroden-spezifische Klangformung.
// Schieber (kurvenELLSumme) + Kurven (schieberELL) werden mit
// EQ-Stärke skaliert; Mittelwert wird abgezogen (reine Pegelver-
// schiebung ist erlaubt); Standardabweichung über aktive Elektroden
// muß < 0.2 dB sein. Außerdem: EQ aktiv, NH-Sim aus.

function _audiologIsTestProgram(side) {
  const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
  if (!eqOn) return false;
  const nhSim = document.getElementById("plNHSim")?.checked;
  if (nhSim) return false;
  return withSide(side, () => {
    const presetC = (typeof plSrcCurves !== "undefined" && plSrcCurves)
      ? kurvenELLSumme() : new Array(nEl).fill(0);
    const lvls = (typeof plSrcLevels !== "undefined" && plSrcLevels)
      ? schieberELL.slice() : new Array(nEl).fill(0);
    const active = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "mute" || elExDur[i] !== null) continue;
      active.push(i);
    }
    if (active.length === 0) return false;
    const sums = active.map((i) => (presetC[i] + lvls[i]));
    const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
    const variance = sums.reduce((a, b) => a + (b - mean) ** 2, 0) / sums.length;
    const sd = Math.sqrt(variance);
    return sd < 0.2;
  });
}

// ---------- Lautstärken-Tabelle pro Seite ----------

function _audiologELLTable(side) {
  return withSide(side, () => {
    const dBs = _audiologDbForSide(side);
    const resArr = _audiologELLResForSide(side);
    const unit = ELL_unitLabelFor(mfr);
    const lines = [];
    lines.push(`| ${t("thEl")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("archivImplExcl")} | ${t("audColNote")} | ${t("thRefEl")} |`);
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
    for (let i = 0; i < nEl; i++) {
      const dB = dBs[i] || 0;
      const r  = resArr[i] || 0;
      const abs = _audiologAbsDelta(side, i, dB);
      const status = _audStatusText(side, i);
      const excl = (elExDur[i] !== null && elExDur[i] !== undefined) ? "**X**" : "";
      const note = (elNt && elNt[i]) ? elNt[i] : "";
      const refMark = (typeof ELL_refEl !== "undefined" && ELL_refEl != null && i === ELL_refEl) ? "**X**" : "";
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | **${_audDb(dB)}** | ${r > 0 ? r.toFixed(1) + " dB" : ""} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status} | ${excl} | ${note} | ${refMark} |`
      );
    }
    return lines.join("\n");
  });
}

// ---------- Frequenz-Tabelle pro Seite (mit sym-Warp-Zusatzspalten) ----------

// Liefert pro Elektrode auf `side` die effektive Frequenzabgleich-Zeile
// (hzIst=aktuelle Mittenfrequenz, hzWunsch=Wunsch nach Warp,
// cent=tatsächliche Cent-Verschiebung dieser Seite, _provisional).
// Quelle ist `_warpFResSource()` + `buildWarpPoints/centShift` — also
// exakt dieselbe Mathematik, die der Player im Audio-Pfad anwendet.
// Für jede Elektrode wird der kanonische cent über centShift auf DIESE
// Seite umgerechnet; Zeilen ohne Verschiebung entfallen. Im symmetrischen
// Modus tragen beide Seiten je die halbe Verschiebung, daher erscheinen
// Tabelle/Graph auch bei einseitigem Druck mit Daten.
function _audiologFmRowsForSide(side) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return [];
  if (typeof buildWarpPoints !== "function" || typeof centShift !== "function") return [];
  const frq_src = (typeof _warpFResSource === "function")
    ? _warpFResSource()
    : ((typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray)) ? FRQ_resultsArray : []);
  if (frq_src.length === 0) return [];

  const mode = (typeof pWarpMode !== "undefined") ? pWarpMode : "right";
  const points = buildWarpPoints(frq_src, mode);

  const elIdxSet = new Set();
  const provByEl = {};
  const sliderByEl = {};
  for (const r of frq_src) {
    elIdxSet.add(r.elIdx);
    if (r._sliderEstimate)   sliderByEl[r.elIdx] = true;
    else if (r._provisional) provByEl[r.elIdx]   = true;
  }

  const rows = [];
  const elIdxList = Array.from(elIdxSet).sort((a, b) => a - b);
  for (const elIdx of elIdxList) {
    const fSelf = withSide(side, () => FRQ_implantatEffektiv(elIdx));
    if (!isFinite(fSelf) || fSelf <= 0) continue;
    const cs = centShift(fSelf, side, points);
    if (Math.abs(cs) < 1e-9) continue;
    const fWish = fSelf * Math.pow(2, cs / 1200);
    rows.push({
      elIdx,
      hzIst: fSelf,
      hzWunsch: fWish,
      cent: cs,
      _provisional:    !!provByEl[elIdx],
      _sliderEstimate: !!sliderByEl[elIdx],
    });
  }
  return rows;
}

function _audiologFreqTable(side) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const rows = _audiologFmRowsForSide(side);
  if (rows.length === 0) return "";

  return withSide(side, () => {
    const lines = [];
    const sd = sideData[side];
    const defFreqs = (sd && sd.manufacturer && MFR[sd.manufacturer])
      ? MFR[sd.manufacturer].FRQ_implantat
      : FRQ_implantat;
    const ownFreqOwn = (sd && sd.FRQ_implantatOwn) ? sd.FRQ_implantatOwn : null;

    let hasProv = false;
    let hasSliderEst = false;
    lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColDeltaHz")} | ${t("audColHzWish")} |`);
    lines.push("|---|---|---|---|---|---|");
    for (const r of rows) {
      if (r._sliderEstimate)      hasSliderEst = true;
      else if (r._provisional)    hasProv = true;
      let elLabel = `${dENPrefix()}${dEN(r.elIdx)}`;
      if (r._sliderEstimate)      elLabel += " †";
      else if (r._provisional)    elLabel += " *";
      const hzDef = defFreqs[r.elIdx] != null ? _mdFmtHz(defFreqs[r.elIdx]) : "—";
      const hzMan = (ownFreqOwn && ownFreqOwn[r.elIdx] != null) ? _mdFmtHz(ownFreqOwn[r.elIdx]) : "—";
      const dHzV  = r.hzWunsch - r.hzIst;
      const dHz   = isFinite(dHzV) ? `${dHzV >= 0 ? "+" : ""}${Math.round(dHzV)} Hz` : "—";
      lines.push(`| ${elLabel} | ${hzDef} | ${hzMan} | ${_audCent(r.hzIst, r.hzWunsch)} | ${dHz} | **${_mdFmtHz(r.hzWunsch)}** |`);
    }
    if (hasProv) {
      lines.push("");
      lines.push(`_${t("archivFmProvNote")}_`);
    }
    if (hasSliderEst) {
      lines.push("");
      lines.push(`_${t("audFmSliderEstNote")}_`);
    }
    return lines.join("\n") + "\n";
  });
}

// ---------- MAPLAW — eigene H2-Sektion ----------

function _audiologMaplawSection(mainSides, headerLevel) {
  if (typeof pMaplawOn === "undefined" || !pMaplawOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const sollC = (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : null;
  if (sollC == null) return "";
  const rows = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd || sd.manufacturer !== "medel") continue;
    const istC = (sd.implant && sd.implant.cValue) ? sd.implant.cValue : null;
    if (istC == null || istC === sollC) continue;
    const sideName = _audiologSideLabel(side);
    rows.push(`MAPLAW ${sideName} ändern von c=${istC} auf c=**${sollC}**.`);
  }
  if (rows.length === 0) return "";
  const lvl = headerLevel || "##";
  const lines = [`${lvl} ${t("audiologSecMaplaw")}`, "", ...rows, ""];
  return lines.join("\n");
}

// ---------- Stereo-Balance (immer wenn gemessen, auch einseitig) ----------

function _audiologSTBBlock(mainSides) {
  if (typeof STB_results === "undefined") return "";
  const keys = Object.keys(STB_results).filter((k) => isFinite(STB_results[k]));
  if (keys.length === 0) return "";
  const mean = keys.reduce((a, k) => a + STB_results[k], 0) / keys.length;
  if (!isFinite(mean) || mean === 0) return "";

  const balActive = (typeof plApplyBalance !== "undefined") && plApplyBalance
                 && (mainSides.length === 2);
  const louderSide = mean > 0 ? t("sideRight") : t("sideLeft");
  const quieterSide = mean > 0 ? t("sideLeft")  : t("sideRight");

  const lines = [];
  lines.push(`## ${t("audiologSecSTB")}`);
  lines.push("");
  lines.push(`- ${t("audiologBalDiff")}: **${Math.abs(mean).toFixed(1)} dB**`);
  lines.push(`- ${t("audiologBalImpact")
    .replace("{louder}", louderSide)
    .replace("{quieter}", quieterSide)}`);
  lines.push(`- ${balActive ? t("audiologBalIncluded") : t("audiologBalNotIncluded")}`);
  lines.push("");
  return lines.join("\n");
}

// ---------- Latenz (immer wenn gemessen, auch einseitig) ----------

function _audiologLTZBlock(mainSides) {
  if (typeof LTZ_result === "undefined" || !LTZ_result) return "";
  if (!isFinite(LTZ_result.valueMs)) return "";
  const ms = LTZ_result.valueMs;
  if (ms === 0) return "";
  const LTZ_active = (typeof plApplyLatency !== "undefined") && plApplyLatency
                 && (mainSides.length === 2);
  const earlierSide = ms >= 0 ? t("sideLeft")  : t("sideRight");
  const laterSide   = ms >= 0 ? t("sideRight") : t("sideLeft");
  const lines = [];
  lines.push(`## ${t("audiologSecLTZ")}`);
  lines.push("");
  lines.push(`- ${t("audiologLTZValue")}: **${Math.abs(ms).toFixed(2)} ms**`);
  lines.push(`- ${t("audiologLTZImpact")
    .replace("{earlier}", earlierSide)
    .replace("{later}", laterSide)}`);
  lines.push("");
  return lines.join("\n");
}

// ---------- Testprogramm-Hinweis ----------

function _audiologTestProgramHint(mainSides) {
  let anyTP = false;
  for (const s of mainSides) if (_audiologIsTestProgram(s)) anyTP = true;
  if (!anyTP) return "";
  return `\n> ${t("audiologTestProgramHint")}\n\n`;
}

// ---------- Fehlende Implantat-Angaben pro Seite ----------

function _audiologMissingImplantData(mainSides) {
  const out = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    const impl = (sd && sd.implant) || {};
    const sideLbl = _audiologSideLabel(side);
    const missing = [];
    if (!impl.model)     missing.push(t("audMissImplantModel"));
    if (!impl.processor) missing.push(t("audMissProcessor"));
    const mclSet = (impl.mcl || []).some((v) => v != null && isFinite(v));
    if (!mclSet) missing.push(t("audMissMcl"));
    const thrSet = (impl.thr || []).some((v) => v != null && isFinite(v));
    if (!thrSet) missing.push(t("audMissThr"));
    const freqOwnSet = (sd && sd.FRQ_implantatOwn || []).some((v) => v != null && isFinite(v));
    if (!freqOwnSet) missing.push(t("audMissFreqOwn"));
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "ab" && !impl.idr) missing.push(t("audMissIdr"));
    if (missing.length > 0) {
      out.push(`- **${sideLbl}**: ${missing.join(", ")}`);
    }
  }
  if (out.length === 0) return "";
  const lines = [
    `## ${t("audiologSecMissing")}`,
    "",
    `_${t("audiologMissingIntro")}_`,
    "",
    ...out,
    "",
  ];
  return lines.join("\n");
}

// ---------- Hinweise für den Audiologen (4 Bullets) ----------

function _audiologAdvice() {
  const lines = [];
  lines.push(`## ${t("audiologSecAdvice")}`);
  lines.push("");
  lines.push(`- ${t("audiologAdvice1")}`);
  lines.push(`- ${t("audiologAdvice2")}`);
  lines.push(`- ${t("audiologAdvice3")}`);
  lines.push(`- ${t("audiologAdvice4")}`);
  lines.push(`- ${t("audiologAdvice5")}`);
  lines.push("");
  return lines.join("\n");
}

// BA 251: jRes entfaellt; letzte Messung kommt nur noch aus ELL_results.

function _audiologLastELL(side) {
  const sd = sideData[side];
  if (!sd) return null;
  let max = 0;
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e && e.timestamp && e.timestamp > max) max = e.timestamp;
  };
  collect(sd.ELL_results);
  return max > 0 ? new Date(max) : null;
}

function _audiologDateStr(d) {
  if (!d) return "—";
  return d.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
}

// ---------- Konfig-Beschriftung pro Seite ----------

function _audiologConfigLabel(side) {
  const sd = sideData[side];
  const cfg = (sd && sd.config) || "ci";
  const map = {
    ci:     "cfgCI",
    hg:     "cfgHG",
    normal: "cfgNormal",
    shoh:   "cfgSchwerh",
    deaf:   "cfgTaub",
  };
  const key = map[cfg];
  if (!key) return cfg;
  const tr = t(key);
  return (tr && tr !== key) ? tr : cfg;
}

// ---------- Haupt-Generator ----------

function _audiologUserNoteBlock() {
  if (typeof audiologUserNote !== "string") return "";
  const txt = audiologUserNote.trim();
  if (!txt) return "";
  return `## ${t("audiologSecNote")}\n\n${txt}\n`;
}

function buildAudiologMarkdown() {
  const mainSides = _audiologMainSides();
  const sideLabel = _mdBilateralLabel();
  const parts = [];

  // ---- Kopf wird komplett vom gemeinsamen buildPrintHeader gestellt ----
  parts.push("");

  // ---- Persönliche Notiz des Patienten ganz oben ----
  const _note = _audiologUserNoteBlock();
  if (_note) {
    parts.push(_note);
  }

  // ---- EQ aus ----
  if (typeof plEqOn !== "undefined" && !plEqOn) {
    parts.push(`> ${t("audiologEqOff")}\n`);
  }

  // ---- nhSim war aktiv (BA 315) ----
  const _nhEl = document.getElementById("plNHSim");
  if (typeof plEqOn !== "undefined" && plEqOn && _nhEl && _nhEl.checked) {
    parts.push(`> ${t("nhSimNotApplied")}\n`);
  }


  // ===========================================================
  // BILATERAL-BLOCK — vor den Seiten-Blöcken.
  // Reihenfolge: Balance → Latenz → Hinweise → Fehlende Angaben.
  // ===========================================================
  parts.push(_audiologAdvice());
  const miss = _audiologMissingImplantData(mainSides);
  if (miss) parts.push(miss);
  const bal = _audiologSTBBlock(mainSides);
  if (bal) parts.push(bal);
  const lat = _audiologLTZBlock(mainSides);
  if (lat) parts.push(lat);

  // ===========================================================
  // PRO-SEITE-BLÖCKE — LINKS komplett, dann RECHTS komplett.
  // Innerhalb einer Seite: alle Sub-Sektionen als H3.
  // ===========================================================
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd) continue;
    const impl = sd.implant || {};
    const sideLbl = _audiologSideLabel(side);
    const mfrLbl  = (MFR[sd.manufacturer] && MFR[sd.manufacturer].name) || sd.manufacturer;
    const cfgLbl  = _audiologConfigLabel(side);
    parts.push(`## ${sideLbl} — ${cfgLbl}`);
    parts.push("");
    const meta = [];
    meta.push(`${t("audiologMfr")}: ${mfrLbl}`);
    if (impl.processor) meta.push(`${t("audiologProcessor")}: ${impl.processor}`);
    if (impl.model)     meta.push(`${t("audiologImplant")}: ${impl.model}`);
    const lastM = _audiologLastELL(side);
    if (lastM) meta.push(`${t("audiologLastMeas")}: ${_audiologDateStr(lastM)}`);
    parts.push(`_${meta.join(" · ")}_`);
    parts.push("");
    if (_audiologIsTestProgram(side)) parts.push(`> ${t("audiologTestProgramHint")}\n`);

    // H3 Lautstärken-Korrektur
    parts.push(`### ${t("audiologSecLoudness")}`);
    parts.push("");
    parts.push(_audiologELLTable(side));
    parts.push("");
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // BA 320: Absenk-Hinweis fuer DIESE Seite. Drei Faelle:
    //  - Beide-Seiten an, einseitiger Auftrag, durch andere Seite mit-
    //    abgesenkt -> Warnhinweis.
    //  - Beide-Seiten an, sonst -> gemeinsamer Hinweis (eqHeadroomNote).
    //  - Beide-Seiten aus -> seitenweise Variante (eqHeadroomNoteIndep).
    {
      const usedDb = (typeof _eqHeadroomOffset === "function") ? _eqHeadroomOffset(side) : 0;
      if (usedDb > 0) {
        const both = (typeof plEqHeadroomBoth !== "undefined") ? plEqHeadroomBoth : true;
        if (both) {
          const ownDb  = _eqHeadroomOffsetForSides([side]);
          const bothDb = _eqHeadroomOffsetForSides(["left", "right"]);
          if (mainSides.length === 1 && bothDb > ownDb) {
            parts.push(`> ${t("eqHeadroomWarnDoc")}\n`);
          } else {
            parts.push(`> ${t("eqHeadroomNote").replace("{db}", usedDb.toFixed(1))}\n`);
          }
        } else {
          parts.push(`> ${t("eqHeadroomNoteIndep").replace("{db}", usedDb.toFixed(1))}\n`);
        }
      }
    }
    parts.push("");

    // H3 MAPLAW-Änderung — falls relevant für diese Seite
    const mlSide = _audiologMaplawSection([side], "###");
    if (mlSide) parts.push(mlSide);

    // H3 Änderung der Mittenfrequenzen — falls relevant für diese Seite.
    // Quelle ist _warpFResSource() (FRQ_resultsArray + Provisionals aus laufendem Test).
    // Bei sym-Warp + einseitigem Druck: zusätzlich eigene H3-Sektion
    // (Graph + Tabelle) für die andere Seite, da sym auf beide Seiten wirkt.
    if (typeof pWarpOn !== "undefined" && pWarpOn
        && typeof plEqOn !== "undefined" && plEqOn
        && ((typeof _warpFResSource === "function" && _warpFResSource().length > 0)
            || (typeof FRQ_resultsArray !== "undefined" && FRQ_resultsArray.length > 0))) {
      const isSymSingle = (mainSides.length === 1
                          && typeof pWarpMode !== "undefined"
                          && pWarpMode === "symmetric");
      const sideLbl = side === "left" ? t("sideLeft") : t("sideRight");
      const ft = _audiologFreqTable(side);
      if (isSymSingle) {
        parts.push(`_${t("audiologFreqSymHint")}_`);
        parts.push("");
        if (ft) {
          parts.push(`### ${t("audiologSecFreq")} — ${sideLbl}`);
          parts.push("");
          parts.push(ft);
        }
        const otherSide = side === "left" ? "right" : "left";
        const otherLbl  = otherSide === "left" ? t("sideLeft") : t("sideRight");
        const ftOther = _audiologFreqTable(otherSide);
        if (ftOther) {
          parts.push(`### ${t("audiologSecFreq")} — ${otherLbl}`);
          parts.push("");
          parts.push(ftOther);
        }
      } else if (ft) {
        parts.push(`### ${t("audiologSecFreq")}`);
        parts.push("");
        parts.push(ft);
      }
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ============================================================
// MODUS B — DRUCK MIT GRAFIK
// ============================================================

function _mdToHtmlBasic(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${esc(h[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i+1])) {
      const head = line.split("|").slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      let tbl = '<table style="border-collapse:collapse;margin:8px 0;font-size:0.85em;">';
      tbl += "<thead><tr>" + head.map((c) =>
        `<th style="border:1px solid #000;padding:4px 10px;background:#eee;text-align:left;white-space:nowrap;">${esc(c)}</th>`
      ).join("") + "</tr></thead>";
      tbl += "<tbody>" + rows.map((r) =>
        "<tr>" + r.map((c) =>
          `<td style="border:1px solid #000;padding:4px 10px;white-space:nowrap;">${esc(c).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</td>`
        ).join("") + "</tr>"
      ).join("") + "</tbody></table>";
      out.push(tbl);
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) =>
        `<li>${esc(it).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>")}</li>`
      ).join("") + "</ul>");
      continue;
    }
    if (/^\s*>\s+/.test(line)) {
      out.push(`<blockquote style="border-left:3px solid #000;padding-left:8px;">${esc(line.replace(/^\s*>\s+/, ""))}</blockquote>`);
      i++; continue;
    }
    if (line.trim() === "") { i++; continue; }
    const inline = esc(line)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/_([^_]+)_/g, "<i>$1</i>");
    out.push(`<p>${inline}</p>`);
    i++;
  }
  return out.join("\n");
}

// Bar-Chart pro Seite mit Residuum-Fehlerbalken.
// 2× Auflösung, CSS-Width = logische Breite.

function _audiologChartImg(side) {
  const dBs = _audiologDbForSide(side);
  const resArr = _audiologELLResForSide(side);
  return withSide(side, () => {
    const SCALE = 2;
    const Wlog = 700, Hlog = 240;
    const canvas = document.createElement("canvas");
    canvas.width = Wlog * SCALE;
    canvas.height = Hlog * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, Wlog, Hlog);

    let maxAbs = 1;
    for (let i = 0; i < nEl; i++) {
      const v = dBs[i] || 0;
      const r = resArr[i] || 0;
      maxAbs = Math.max(maxAbs, Math.abs(v) + r);
    }
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;

    const pad = { l: 40, r: 14, t: 30, b: 32 };
    const pW = Wlog - pad.l - pad.r, pH = Hlog - pad.t - pad.b;
    const zY = pad.t + pH / 2;
    const gW = pW / nEl;

    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zY); ctx.lineTo(Wlog - pad.r, zY); ctx.stroke();

    ctx.fillStyle = "#444"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("+" + maxAbs, pad.l - 4, pad.t + 8);
    ctx.fillText("0", pad.l - 4, zY + 3);
    ctx.fillText("-" + maxAbs, pad.l - 4, Hlog - pad.b + 4);

    if (typeof ELL_refEl !== "undefined" && ELL_refEl !== null && ELL_refEl >= 0 && ELL_refEl < nEl) {
      _drawRefElLabel(ctx, pad.l + ELL_refEl * gW + gW / 2, pad.t - 4);
    }
    for (let i = 0; i < nEl; i++) {
      const v = dBs[i] || 0;
      const r = resArr[i] || 0;
      const x = pad.l + i * gW + 2;
      const w = Math.max(2, gW - 4);
      const disabled = (elSt[i] === "mute") || (elExDur[i] !== null);
      if (disabled) {
        ctx.fillStyle = "#ccc";
        ctx.fillRect(x, pad.t, w, pH);
        ctx.fillStyle = "#444"; ctx.textAlign = "center";
        ctx.fillText(`${dENPrefix()}${dEN(i)}`, x + w / 2, Hlog - pad.b + 16);
        continue;
      }
      if (Math.abs(v) >= 0.05) {
        const h = (Math.abs(v) / maxAbs) * (pH / 2);
        ctx.fillStyle = v >= 0 ? "#3b82f6" : "#ef4444";
        if (v >= 0) ctx.fillRect(x, zY - h, w, h);
        else        ctx.fillRect(x, zY,    w, h);
      }
      if (r > 0) {
        const yT = zY - ((v + r) / maxAbs) * (pH / 2);
        const yB = zY - ((v - r) / maxAbs) * (pH / 2);
        const xC = x + w / 2;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xC, yT); ctx.lineTo(xC, yB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xC - 4, yT); ctx.lineTo(xC + 4, yT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xC - 4, yB); ctx.lineTo(xC + 4, yB); ctx.stroke();
      }
      ctx.fillStyle = "#444"; ctx.textAlign = "center";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${dENPrefix()}${dEN(i)}`, x + w / 2, Hlog - pad.b + 16);
    }
    ctx.fillStyle = "#000"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    ctx.fillText(`${t("audiologChartTitle")} — ${sideName}`, pad.l, 18);

    return `<img src="${canvas.toDataURL("image/png")}" style="width:${Wlog}px;max-width:100%;height:auto;" />`;
  });
}

// Frequenzabgleich-Graph für Audiologen-Druck. Selbe Datenquelle wie
// _audiologFreqTable: _audiologFmRowsForSide(side) — modus-bewußte
// effektive Cent-Verschiebung pro Seite. Punkte grün/rot je Cent-
// Vorzeichen mit Elektrodenlabel; provisorische Punkte (laufender Test)
// als offener Kreis statt gefüllt, mit Legende `archivFmProvLegend`.
// Rückgabe "" wenn keine Punkte für die Seite vorliegen.
function _audiologFreqChartImg(side) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const rows = _audiologFmRowsForSide(side);
  if (rows.length === 0) return "";

  return withSide(side, () => {
    const SCALE = 2;
    const Wlog = 700, Hlog = 240;
    const canvas = document.createElement("canvas");
    canvas.width = Wlog * SCALE;
    canvas.height = Hlog * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, Wlog, Hlog);

    let maxAbsCent = 50;
    for (const r of rows) maxAbsCent = Math.max(maxAbsCent, Math.abs(r.cent));
    maxAbsCent = Math.ceil(maxAbsCent / 50) * 50;

    const pad = { l: 50, r: 14, t: 30, b: 32 };
    const pW = Wlog - pad.l - pad.r, pH = Hlog - pad.t - pad.b;
    const zY = pad.t + pH / 2;

    const freqs = rows.map((r) => r.hzIst);
    const fMin = Math.min.apply(null, freqs.concat([100]));
    const fMax = Math.max.apply(null, freqs.concat([8000]));
    const xFor = (hz) => pad.l + (Math.log2(hz / fMin) / Math.log2(fMax / fMin)) * pW;

    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zY); ctx.lineTo(Wlog - pad.r, zY); ctx.stroke();

    ctx.fillStyle = "#444"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("+" + maxAbsCent + " ¢", pad.l - 4, pad.t + 8);
    ctx.fillText("0", pad.l - 4, zY + 3);
    ctx.fillText("-" + maxAbsCent + " ¢", pad.l - 4, Hlog - pad.b + 4);

    let hasProv = false;
    let hasSliderEst = false;
    for (const r of rows) {
      const x = xFor(r.hzIst);
      const y = zY - (r.cent / maxAbsCent) * (pH / 2);
      if (r._sliderEstimate) {
        hasSliderEst = true;
        // Hohle graue Raute
        const sz = 5;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#6b7280';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y - sz);
        ctx.lineTo(x + sz, y);
        ctx.lineTo(x, y + sz);
        ctx.lineTo(x - sz, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        const color = r.cent >= 0 ? "#16a34a" : "#dc2626";
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        if (r._provisional) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          hasProv = true;
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
      ctx.fillStyle = "#444";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${dENPrefix()}${dEN(r.elIdx)}`, x, Hlog - pad.b + 16);
    }

    ctx.fillStyle = "#000"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    ctx.fillText(`${t("audiologSecFreq")} — ${sideName}`, pad.l, 18);

    if (hasProv) {
      ctx.fillStyle = "#555"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
      ctx.fillText(t("archivFmProvLegend"), Wlog - pad.r, 18);
    }
    if (hasSliderEst) {
      ctx.fillStyle = "#555"; ctx.font = "9px sans-serif"; ctx.textAlign = "right";
      const legendY = hasProv ? 30 : 18;
      ctx.fillText("◇ " + t("FRQ_resultsStatusSliderEstimate"), Wlog - pad.r, legendY);
    }

    return `<img src="${canvas.toDataURL("image/png")}" style="width:${Wlog}px;max-width:100%;height:auto;" />`;
  });
}

// BA 321: Warnhinweis in der Audiologen-Karte. Sichtbar, wenn
// "Beide Seiten beruecksichtigen" an ist, nur EINE Seite gedruckt wird
// und deren Wert durch die andere Seite mit-abgesenkt wurde.
function _audiologUpdWarn() {
  const el = document.getElementById("audiologEqWarn");
  if (!el) return;
  let show = false;
  if (typeof plEqHeadroom !== "undefined" && plEqHeadroom
      && typeof plEqHeadroomBoth !== "undefined" && plEqHeadroomBoth
      && typeof _eqHeadroomOffsetForSides === "function"
      && typeof _audiologMainSides === "function") {
    const sides = _audiologMainSides();
    if (sides.length === 1) {
      const side = sides[0];
      const ownDb  = _eqHeadroomOffsetForSides([side]);
      const bothDb = _eqHeadroomOffsetForSides(["left", "right"]);
      if (bothDb > ownDb) show = true;
    }
  }
  el.classList.toggle("hidden", !show);
}

function audiologPrint() {
  const mainSides = _audiologMainSides();
  const eqOn = (typeof plEqOn === "undefined") ? true : plEqOn;
  const md = buildAudiologMarkdown();
  const html = _mdToHtmlBasic(md);
  let body = html;
  if (eqOn) {
    let searchFrom = 0;
    for (const s of mainSides) {
      const chart = _audiologChartImg(s);
      const marker = `<h3>${t("audiologSecLoudness")}</h3>`;
      const idx = body.indexOf(marker, searchFrom);
      if (idx >= 0) {
        body = body.slice(0, idx) + chart + body.slice(idx);
        searchFrom = idx + chart.length + marker.length;
      }
    }
  }
  if (eqOn && typeof pWarpOn !== "undefined" && pWarpOn) {
    const isSymSingle = (mainSides.length === 1
                        && typeof pWarpMode !== "undefined"
                        && pWarpMode === "symmetric");
    const injectChart = (sideToDraw, marker, from) => {
      const chart = _audiologFreqChartImg(sideToDraw);
      if (!chart) return from;
      const idx = body.indexOf(marker, from);
      if (idx < 0) return from;
      const insertAt = idx + marker.length;
      body = body.slice(0, insertAt) + chart + body.slice(insertAt);
      return insertAt + chart.length;
    };
    let searchFrom = 0;
    for (const s of mainSides) {
      if (isSymSingle) {
        const sideLbl = s === "left" ? t("sideLeft") : t("sideRight");
        searchFrom = injectChart(s, `<h3>${t("audiologSecFreq")} — ${sideLbl}</h3>`, searchFrom);
        const otherSide = s === "left" ? "right" : "left";
        const otherLbl  = otherSide === "left" ? t("sideLeft") : t("sideRight");
        searchFrom = injectChart(otherSide, `<h3>${t("audiologSecFreq")} — ${otherLbl}</h3>`, searchFrom);
      } else {
        searchFrom = injectChart(s, `<h3>${t("audiologSecFreq")}</h3>`, searchFrom);
      }
    }
  }
  if (typeof openPrintWindow !== "function") {
    alert("openPrintWindow not available — print.js missing?");
    return;
  }
  openPrintWindow(t("audiologTitle"), body, t("audiologTitleShort"));
}

// ----------------------------------------------------------------
// CHART-RENDERER für Archiv-Druck
// Liefern PNG-Data-URLs für die HTML-Druckseite. Alle Renderer
// zeichnen offscreen und greifen nicht auf UI-Canvas zu.
// ----------------------------------------------------------------

const _ARCHIV_CHART_W = 720;
const _ARCHIV_CHART_H = 240;

function _archivMkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w || _ARCHIV_CHART_W;
  c.height = h || _ARCHIV_CHART_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  return { canvas: c, ctx };
}

// Gemeinsame Beschriftung für Archiv-Charts mit Cent-x-Achse:
// E-Label, Hz, Cent (ausgedünnt nach axis.step). Hz wird kompakt
// dargestellt (z.B. "1.0k"), Cent mit Vorzeichen.
function _archivDrawElCentLabel(ctx, elLabel, cx, H, padB, axis, j) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
  const hz = axis.hzArr[j];
  const fTxt = hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz);
  ctx.fillStyle = "#888";
  ctx.font = "8px sans-serif";
  ctx.fillText(fTxt, cx, H - padB + 23);
  if (j % axis.step === 0 || j === 0 || j === axis.hzArr.length - 1) {
    const c = Math.round(axis.centArr[j]);
    ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", cx, H - padB + 34);
  }
}

// Variante für elektrodennummern-basierte Charts mit Hz-Zeile
// (ohne Cent) — verwendet von _archivChartELL und
// _archivChartLR seit Bauanleitung 71.
function _archivDrawElHzLabel(ctx, elLabel, cx, H, padB, axis, j) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
  const hz = axis.hzArr[j];
  const fTxt = hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz);
  ctx.fillStyle = "#888";
  ctx.font = "8px sans-serif";
  ctx.fillText(fTxt, cx, H - padB + 23);
}

// Variante nur mit Elektroden-Label (kein Hz, kein Cent) —
// verwendet von _archivChartSchieberELL seit Bauanleitung 71.
function _archivDrawElLabel(ctx, elLabel, cx, H, padB) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
}

function _archivDrawAxis(ctx, pad, W, H, maxAbs, opts) {
  const pW = W - pad.l - pad.r;
  const pH = H - pad.t - pad.b;
  const zY = pad.t + pH / 2;
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.l, zY);
  ctx.lineTo(W - pad.r, zY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("+" + maxAbs, pad.l - 4, pad.t + 10);
  ctx.fillText("0",          pad.l - 4, zY + 3);
  ctx.fillText("-" + maxAbs, pad.l - 4, H - pad.b + 2);
  if (opts && opts.title) {
    ctx.fillStyle = "#000";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(opts.title, pad.l, 14);
  }
  return { pW, pH, zY };
}

// 1. Loudness-Balance (Meßergebnis-Sub-Tab 1)
function _archivChartELL(sideBlock) {
  if (!sideBlock.ell.hasNonZero) return "";
  return withSide(sideBlock.side, () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 46 };
    const rows = sideBlock.ell.rows;
    let maxAbs = 1;
    for (const r of rows) if (r.offsetDb != null) maxAbs = Math.max(maxAbs, Math.abs(r.offsetDb));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecELL")} — ${sideBlock.label}`,
    });
    const idxArr = rows.map((r) => r.idx);
    const axis = buildLinearAxis(idxArr, pad.l, pW);
    const w = Math.max(2, Math.min((axis.minDx || 12) * 0.6, 30));
    const refIdx = sideBlock.ell.ELL_refEl;
    if (refIdx != null) {
      const jRef = idxArr.indexOf(refIdx);
      if (jRef >= 0) _drawRefElLabel(ctx, axis.tX(jRef), pad.t - 4);
    }
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      const cx = axis.tX(j);
      const x = cx - w / 2;
      if (r.offsetDb == null) {
        ctx.fillStyle = "#d1d5db";
        ctx.fillRect(x, zY - 1, w, 2);
      } else {
        const h = (Math.abs(r.offsetDb) / maxAbs) * (pH / 2);
        ctx.fillStyle = (r.idx === sideBlock.ell.ELL_refEl) ? "#a855f7"
                      : r.offsetDb >= 0 ? "#16a34a" : "#dc2626";
        if (r.offsetDb >= 0) ctx.fillRect(x, zY - h, w, h);
        else                 ctx.fillRect(x, zY,    w, h);
      }
      _archivDrawElHzLabel(ctx, r.label, cx, H, pad.b, axis, j);
    }
    return canvas.toDataURL("image/png");
  });
}

// 2. Schieber (Schieber-Tab, relative dB-Werte)
function _archivChartSchieberELL(sideBlock) {
  if (!sideBlock.schieberELL.has) return "";
  return withSide(sideBlock.side, () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 46 };
    const rows = sideBlock.schieberELL.rows;
    let maxAbs = 1;
    for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.relDb || 0));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecSchieberELL")} — ${sideBlock.label}`,
    });
    const idxArr = rows.map((r) => r.idx != null ? r.idx : 0);
    const axis = buildLinearAxis(idxArr, pad.l, pW);
    const w = Math.max(2, Math.min((axis.minDx || 12) * 0.6, 30));
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      const cx = axis.tX(j);
      const x = cx - w / 2;
      const v = r.relDb || 0;
      if (Math.abs(v) < 0.05) {
        ctx.fillStyle = "#d1d5db";
        ctx.fillRect(x, zY - 1, w, 2);
      } else {
        const h = (Math.abs(v) / maxAbs) * (pH / 2);
        ctx.fillStyle = "#16a34a";
        if (v >= 0) ctx.fillRect(x, zY - h, w, h);
        else        ctx.fillRect(x, zY,    w, h);
      }
      _archivDrawElLabel(ctx, r.label, cx, H, pad.b);
    }
    return canvas.toDataURL("image/png");
  });
}

// 3. Kurven (4-Linien-Chart, vereinfacht — eine Linie pro aktive Kurvenfunktion + Summe)
function _archivChartKurvenELL(sideBlock) {
  if (!sideBlock.kurvenELL.has) return "";
  return withSide(sideBlock.side, () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 46 };
    const n = nEl;
    const total = kurvenELLSumme();
    let maxAbs = 1;
    for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(total[i] || 0));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecKurvenELL")} — ${sideBlock.label}`,
    });
    const idxArr = [];
    for (let i = 0; i < n; i++) idxArr.push(i);
    const axis = buildCentAxis(idxArr, pad.l, pW, function (i) {
      return effFreqDisplay(i);
    });
    const yFor = (v) => zY - (v / maxAbs) * (pH / 2);
    const COLORS = ["#3b82f6", "#f97316", "#a855f7", "#06b6d4", "#84cc16", "#eab308", "#ec4899", "#14b8a6"];
    let ci = 0;
    for (const p of kurvenELL) {
      if (!p.on || p.strength === 0) continue;
      const curve = kurvenELLBerechnen(p, n);
      ctx.strokeStyle = COLORS[ci % COLORS.length];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = axis.tX(i);
        const y = yFor(curve[i] || 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ci++;
    }
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = axis.tX(i);
      const y = yFor(total[i] || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      _archivDrawElCentLabel(ctx, sideBlock.implant.electrodes[i].label,
                             axis.tX(i), H, pad.b, axis, i);
    }
    return canvas.toDataURL("image/png");
  });
}

// 5. Stereo-Balance (bilateral)
function _archivChartLR(bilateral) {
  if (!bilateral.stereobalance.has) return "";
  return withSide("left", () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 46 };
    const rows = bilateral.stereobalance.rows;
    let maxAbs = 1;
    for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.value));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("balTitle")}`,
    });
    const idxArr = rows.map((r) => r.elIdx);
    const axis = buildLinearAxis(idxArr, pad.l, pW);
    const w = Math.max(2, Math.min((axis.minDx || 12) * 0.6, 30));
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      const cx = axis.tX(j);
      const x = cx - w / 2;
      const h = (Math.abs(r.value) / maxAbs) * (pH / 2);
      ctx.fillStyle = r.value >= 0 ? "#3b82f6" : "#dc2626";
      if (r.value >= 0) ctx.fillRect(x, zY - h, w, h);
      else              ctx.fillRect(x, zY,    w, h);
      _archivDrawElHzLabel(ctx, `E${r.elIdx + 1}`, cx, H, pad.b, axis, j);
    }
    return canvas.toDataURL("image/png");
  });
}

// 6. Player-EQ pro Seite (nutzt eqGains aus data.player)
function _archivChartPlayerEq(sideBlock, playerEqArr) {
  if (!playerEqArr || playerEqArr.length === 0) return "";
  if (!playerEqArr.some((v) => Math.abs(v) > 0)) return "";
  return withSide(sideBlock.side, () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 46 };
    let maxAbs = 1;
    for (const v of playerEqArr) maxAbs = Math.max(maxAbs, Math.abs(v));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecPlayer")} EQ — ${sideBlock.label}`,
    });
    const idxArr = [];
    for (let i = 0; i < playerEqArr.length; i++) idxArr.push(i);
    const axis = buildCentAxis(idxArr, pad.l, pW, function (i) {
      return effFreqDisplay(i);
    });
    const w = Math.max(2, Math.min((axis.minDx || 12) * 0.6, 30));
    for (let j = 0; j < playerEqArr.length; j++) {
      const v = playerEqArr[j];
      const cx = axis.tX(j);
      const x = cx - w / 2;
      if (Math.abs(v) < 0.05) {
        ctx.fillStyle = "#d1d5db";
        ctx.fillRect(x, zY - 1, w, 2);
      } else {
        const h = (Math.abs(v) / maxAbs) * (pH / 2);
        ctx.fillStyle = v >= 0 ? "#16a34a" : "#dc2626";
        if (v >= 0) ctx.fillRect(x, zY - h, w, h);
        else        ctx.fillRect(x, zY,    w, h);
      }
      const el = sideBlock.implant.electrodes[j];
      _archivDrawElCentLabel(ctx, el ? el.label : ("E" + (j + 1)),
                             cx, H, pad.b, axis, j);
    }
    return canvas.toDataURL("image/png");
  });
}

// ----------------------------------------------------------------
// DRUCK-HTML — Archiv (Modus A)
// ----------------------------------------------------------------

function renderArchivPrintHtml(data) {
  const md = renderArchivMarkdown(data);
  const html = _mdToHtmlBasic(md);
  const inserts = [];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    if (sd.ell.hasNonZero) {
      inserts.push({
        anchorH3: `${t("archivSecELL")} (`,
        sideOnlyUnder: sd.label,
        img: _archivChartELL(sd),
      });
    }
    if (sd.schieberELL.has) {
      inserts.push({
        anchorH3: `${t("archivSecSchieberELL")} (`,
        sideOnlyUnder: sd.label,
        img: _archivChartSchieberELL(sd),
      });
    }
    if (sd.kurvenELL.has) {
      inserts.push({
        anchorH3: `${t("archivSecKurvenELL")}`,
        sideOnlyUnder: sd.label,
        img: _archivChartKurvenELL(sd),
      });
    }
    // Archiv-FRQ-Graph entfernt (BA 414): kanonischer cent ist seitenneutral
    // und braucht keine Seitenprojektions-Grafik im Archiv-Druck.
  }
  if (data.bilateral.stereobalance.has) {
    inserts.push({
      anchorH3: `${t("balTitle")}`,
      sideOnlyUnder: null,
      img: _archivChartLR(data.bilateral),
    });
  }
  if (data.player.eqHasNonZero) {
    inserts.push({
      anchorH2: `${t("archivSecPlayer")}`,
      isPlayerEq: true,
      data,
    });
  }
  const enrichedHtml = _archivInjectInserts(html, inserts);
  const styles = `
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    h1 { margin-top: 0; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    h3 { margin-top: 14px; }
    table { font-size: 0.85em; }
    img.archiv-chart { display: block; max-width: 100%; margin: 6px 0 10px 0; }
    img.archiv-logo { float: right; height: 150px; width: auto; margin: 0 0 8px 12px; }
    @media print { body { margin: 0; padding: 0; } img.archiv-logo { height: 150px; } }
  `;
  const logoUrl = new URL("assets/images/CImbel_logo.png", window.location.href).href;
  const logoHtml = `<img src="${logoUrl}" alt="CImbel — CI sound balancing" class="archiv-logo" />`;
  const _titleStr = (typeof buildCImbelPrintTitle === "function")
    ? buildCImbelPrintTitle("CImbel " + t("archivTitleShort"))
    : t("archivTitle");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${_titleStr}</title><style>${styles}</style></head><body>${logoHtml}${enrichedHtml}</body></html>`;
}

function _archivInjectInserts(html, inserts) {
  let out = html;
  let currentH2 = null;
  const re = /<h([23])>([^<]+)<\/h\1>/g;
  out = out.replace(re, (full, lvl, text) => {
    if (lvl === "2") {
      currentH2 = text.trim();
      const playerInsert = inserts.find((i) => i.isPlayerEq && i.anchorH2 === currentH2);
      if (playerInsert) {
        return `${full}<!--__PLAYER_EQ_INSERT__-->`;
      }
      return full;
    }
    // lvl === "3"
    for (const ins of inserts) {
      if (ins.isPlayerEq) continue;
      if (ins._used) continue;
      if (ins.sideOnlyUnder && currentH2 !== ins.sideOnlyUnder) continue;
      if (!text.startsWith(ins.anchorH3)) continue;
      ins._used = true;
      if (!ins.img) return full;
      return `${full}<img class="archiv-chart" src="${ins.img}" alt="" />`;
    }
    return full;
  });
  const playerInsert = inserts.find((i) => i.isPlayerEq);
  if (playerInsert) {
    const data = playerInsert.data;
    const playerImgs = [];
    const mode = data.player.sideMode;
    const renderFor = (side) => {
      const img = _archivChartPlayerEq(data.sides[side], data.player.eqGains[side]);
      if (img) playerImgs.push(`<img class="archiv-chart" src="${img}" alt="" />`);
    };
    if (mode === "left")  renderFor("left");
    else if (mode === "right") renderFor("right");
    else { renderFor("left"); renderFor("right"); }
    out = out.replace("<!--__PLAYER_EQ_INSERT__-->", playerImgs.join(""));
  }
  return out;
}
