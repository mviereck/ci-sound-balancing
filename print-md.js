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
//   mdDateStampFile()           — "2026-05-19-1830" für Dateinamen
//   mdArchivFilename()          — "ci-sound-balancing-archiv-…md"
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

function mdDateStampFile() {
  const now = new Date();
  const ds = now.toISOString().slice(0, 10); // 2026-05-19
  const ts = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(":", "");
  return `${ds}-${ts}`;
}

function mdArchivFilename() {
  return _applyUserFileSuffix(`ci-sound-balancing-archiv-${mdDateStampFile()}.md`);
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
    globalTest: _collectGlobalTest(),
    defaultMfr: defaultMfr,
    lvTab: {
      mode: lvTabMode,
      variant: lvTabVariant,
      showMeas: lvTabShowMeas,
      showCurves: lvTabShowCurves,
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

function _collectGlobalTest() {
  const dur = document.getElementById("dur1");
  const pau = document.getElementById("pau1");
  const vol = document.getElementById("vol1");
  return {
    toneType: globalToneType,
    sequence: globalSequence,
    duration: dur ? parseInt(dur.value) : null,
    pause:    pau ? parseInt(pau.value) : null,
    volume:   vol ? vol.value : null,
    slTargetTest:    (typeof slTarget_test    !== "undefined") ? slTarget_test    : null,
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null,
  };
}

function _collectSideData(side) {
  return withSide(side, () => {
    const sd = sideData[side];
    const impl = (sd && sd.implant) || {};
    const unit = (typeof lvUnitLabelFor === "function") ? lvUnitLabelFor(mfr) : "";

    // Implantat-Elektroden-Tabelle
    const electrodes = [];
    for (let i = 0; i < nEl; i++) {
      electrodes.push({
        idx: i,
        label: `${dENPrefix()}${dEN(i)}`,
        hzStandard: (sd.freqs && sd.freqs[i]) || null,
        hzOwn:      (sd.elFreqOwn && sd.elFreqOwn[i] != null) ? sd.elFreqOwn[i] : null,
        thr: (impl.thr && impl.thr[i] != null) ? impl.thr[i] : null,
        upper: _pickUpperLevel(impl, i, mfr),
        unit,
        status: elSt[i] || null,
        note: elNt[i] || "",
        excluded: elExDur[i] !== null && elExDur[i] !== undefined,
      });
    }

    // Messungen
    const measHas = Array.isArray(bRes) && bRes.length > 0;
    let measRows = [];
    let measRefEl = null;
    let measSweep = null;
    if (measHas) {
      measRefEl = refEl;
      const { levels, elRes } = compWLS();
      for (let i = 0; i < nEl; i++) {
        const inMeas = bRes.some((r) => r.a === i || r.b === i);
        measRows.push({
          idx: i,
          label: `${dENPrefix()}${dEN(i)}`,
          hz: effFreq(i),
          offsetDb:   inMeas ? levels[i] : null,
          residualDb: inMeas ? elRes[i]  : null,
          status: elSt[i] || null,
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
    const ml = manualLevels || [];
    const schHasNonZero = ml.some((v) => v != null && v !== 0);
    const schRows = [];
    if (schHasNonZero) {
      const absMode = (lvTabMode === "abs"
                       && typeof lvTabAbsoluteAvailable === "function"
                       && lvTabAbsoluteAvailable());
      for (let i = 0; i < nEl; i++) {
        const v = ml[i] || 0;
        let absDelta = null;
        if (absMode) absDelta = _calcAbsDelta(side, i, v, mfr, impl);
        schRows.push({
          idx: i,
          label: `${dENPrefix()}${dEN(i)}`,
          hz: effFreq(i),
          relDb: v,
          absDelta,
          absUnit: unit,
        });
      }
    }

    // Kurven
    const kurvActive = (presets || []).filter((p) => p.on && p.strength !== 0);
    const kurvList = kurvActive.map((p) => ({
      typeKey: p.type,
      strength: p.strength,
      center: (p.center !== undefined) ? p.center : null,
      width:  (p.width  !== undefined) ? p.width  : null,
      cutoff: (p.cutoff !== undefined) ? p.cutoff : null,
    }));

    // Frequenzabgleich
    const fmRows = [];
    if (typeof fRes !== "undefined" && Array.isArray(fRes)) {
      for (const r of fRes) {
        if (r.varSide !== side) continue;
        const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
        fmRows.push({
          elIdx: r.elIdx,
          elLabel: `${dENPrefix()}${dEN(r.elIdx)}`,
          varFreq: r.varFreq,
          refFreq: r.refFreq,
          cent,
        });
      }
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
        iidr:      impl.iidr      || null,
        generation: impl.generation || null,
        strategy:  impl.strategy  || null,
        unit,
        electrodes,
      },
      meas: {
        has: measHas,
        hasNonZero: measRows.some((r) => r.offsetDb != null && Math.abs(r.offsetDb) > 0),
        refEl: measRefEl,
        rows: measRows,
        sweep: measSweep,
      },
      schieber: {
        has: schHasNonZero,
        mode: lvTabMode,
        rows: schRows,
      },
      kurven: {
        has: kurvList.length > 0,
        list: kurvList,
      },
      freqmatch: {
        has: fmRows.length > 0,
        rows: fmRows,
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
  const out = { lr: { has: false, rows: [], mean: null }, latency: { has: false, value: null } };
  if (typeof lrResults !== "undefined") {
    const keys = Object.keys(lrResults).filter((k) => isFinite(lrResults[k]));
    if (keys.length > 0) {
      out.lr.has = true;
      const sorted = keys.slice().sort((a, b) => (+a) - (+b));
      out.lr.rows = sorted.map((k) => ({ elIdx: +k, value: lrResults[k] }));
      out.lr.mean = sorted.reduce((a, k) => a + lrResults[k], 0) / sorted.length;
    }
  }
  if (typeof latencyResult !== "undefined" && latencyResult
      && isFinite(latencyResult.valueMs) && latencyResult.valueMs !== 0) {
    out.latency.has = true;
    out.latency.value = {
      ms: latencyResult.valueMs,
      clickType: latencyResult.clickType || null,
      intervalMs: latencyResult.intervalMs || null,
    };
  }
  return out;
}

function _collectPlayer() {
  const sideMode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const strEl = document.getElementById("plStr");
  const nhEl  = document.getElementById("plNHSim");
  const str   = strEl ? parseInt(strEl.value) : 100;
  const eqOn  = (typeof plEqOn !== "undefined") ? plEqOn : true;

  const eqGains = { left: [], right: [] };
  let hasNonZero = false;
  if (eqOn) {
    for (const side of SIDES) {
      const gAr = withSide(side, () => computeGains());
      for (let i = 0; i < gAr.length; i++) {
        const v = -gAr[i] * (str / 100);
        eqGains[side].push(v);
        if (Math.abs(v) > 0) hasNonZero = true;
      }
    }
  } else {
    for (const side of SIDES) eqGains[side] = (sideData[side].freqs || []).map(() => 0);
  }

  return {
    sideMode,
    eqOn,
    strength: str,
    nhSim: nhEl ? nhEl.checked : false,
    srcMeas:    (typeof plSrcMeas    !== "undefined") ? plSrcMeas    : true,
    srcLevels:  (typeof plSrcLevels  !== "undefined") ? plSrcLevels  : true,
    srcCurves:  (typeof plSrcCurves  !== "undefined") ? plSrcCurves  : true,
    applyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : false,
    balanceMode:  (typeof plBalanceMode  !== "undefined") ? plBalanceMode  : "sym",
    applyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : false,
    warpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,
    warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "offline",
    warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "ref_side",
    warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
    maplawOn:     (typeof pMaplawOn     !== "undefined") ? pMaplawOn     : false,
    maplawSollC:  (typeof pMaplawSollC  !== "undefined") ? pMaplawSollC  : null,
    eqGains,
    eqHasNonZero: hasNonZero,
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
    _archivMdConfig(data),
    _archivMdImplantTables(data),
    _archivMdGlobalTest(data),
    _archivMdSidesContent(data),
    _archivMdBilateral(data),
    _archivMdPlayer(data),
    _archivMdMisc(data),
  ];
  return parts.filter(Boolean).join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function _archivMdHeader(data) {
  return `# CI Sound Balancing — ${t("archivTitle")}\n\n`
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
    if (im.iidr)       lines.push(`- ${t("archivCfgIidr")}: ${im.iidr}`);
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
      const _ST_KEY = { noisyLess: "stNoisyLess", noisyMore: "stNoisyMore", noisyHeavy: "stNoisyHeavy", almostMute: "stAlmMute", mute: "stMute", deactivated: "stDeactivated" };
      const stTxt  = e.status ? (t(_ST_KEY[e.status] || "") || e.status) : "";
      const exclTxt = e.excluded ? "**X**" : "";
      const note = _mdEsc(e.note || "");
      out.push(`| ${e.label} | ${hzStd} | ${hzOwn} | ${thrTxt} | ${upTxt} | ${stTxt} | ${exclTxt} | ${note} |`);
    }
    out.push("");
  }
  return out.join("\n");
}

function _archivMdGlobalTest(data) {
  const TONE_LABEL_KEY = {
    sine: "toneSine", complex: "toneComplex", noise: "toneNoise",
    noiseAdaptive: "toneNoiseAdaptive", amSine: "toneAmSine",
    warbleSine: "toneWarbleSine", burstSine: "toneBurstSine",
    wobbleSweep: "toneWobbleSweep",
  };
  const g = data.globalTest;
  const lines = [`\n## ${t("archivSecTest")}\n`];
  lines.push(`- ${t("toneTypeLabel")}: ${t(TONE_LABEL_KEY[g.toneType] || "toneSine")}`);
  lines.push(`- ${t("archivTestSeq")}: ${g.sequence.toUpperCase()}`);
  if (g.duration != null) lines.push(`- ${t("lblDur")}: ${g.duration} ms`);
  if (g.pause    != null) lines.push(`- ${t("lblPau")}: ${g.pause} ms`);
  if (g.volume   != null) lines.push(`- ${t("lblVol")}: ${g.volume} %`);
  return lines.join("\n") + "\n";
}

function _archivMdSidesContent(data) {
  const out = [];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    const sections = [];
    if (sd.meas.has)      sections.push(_archivMdMeas(sd));
    if (sd.schieber.has)  sections.push(_archivMdSchieber(sd));
    if (sd.kurven.has)    sections.push(_archivMdKurven(sd));
    if (sd.freqmatch.has) sections.push(_archivMdFreqmatch(sd));
    if (sections.length === 0) continue;
    out.push(`\n## ${sd.label}\n`);
    out.push(sections.join("\n"));
  }
  return out.join("\n");
}

function _archivMdMeas(sd) {
  const out = [];
  const refTxt = (sd.meas.refEl != null)
    ? `${(sd.implant.electrodes[sd.meas.refEl] || {}).label || ""}`
    : "—";
  out.push(`### ${t("archivSecMeas")} (${t("archivMeasRef")}: ${refTxt})`);
  out.push("");
  if (sd.meas.sweep) {
    out.push(`_${t("archivMeasSweepNote")
      .replace("{round}", sd.meas.sweep.round)
      .replace("{done}",  sd.meas.sweep.doneCount)
      .replace("{total}", sd.meas.sweep.totalPairs)}_`);
    out.push("");
  }
  out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("thOff")} | ${t("thRes")} | ${t("thStR")} |`);
  out.push("|---|---|---|---|---|");
  for (const r of sd.meas.rows) {
    const offTxt = (r.offsetDb   != null) ? _mdFmtDb(r.offsetDb, true)  : "—";
    const resTxt = (r.residualDb != null) ? _mdFmtDb(r.residualDb, false) : "—";
    const _ST_KEY2 = { noisyLess: "stNoisyLess", noisyMore: "stNoisyMore", noisyHeavy: "stNoisyHeavy", almostMute: "stAlmMute", mute: "stMute", deactivated: "stDeactivated" };
    const stTxt  = r.status ? (t(_ST_KEY2[r.status] || "") || r.status) : "";
    const noteTxt = r.note ? ` (${_mdEsc(r.note)})` : "";
    out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} |`);
  }
  return out.join("\n") + "\n";
}

function _archivMdSchieber(sd) {
  const out = [];
  const modeLabel = (sd.schieber.mode === "abs") ? t("lvTabModeAbsolute") : t("lvTabModeRelative");
  out.push(`### ${t("archivSecSchieber")} (${modeLabel})`);
  out.push("");
  const showAbs = sd.schieber.mode === "abs" && sd.schieber.rows.some((r) => r.absDelta != null);
  if (showAbs) {
    const unit = sd.implant.unit || "";
    out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} | ${unit} |`);
    out.push("|---|---|---|---|");
    for (const r of sd.schieber.rows) {
      const absTxt = (r.absDelta != null)
        ? `${r.absDelta >= 0 ? "+" : ""}${r.absDelta.toFixed(1)}`
        : "—";
      out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${_mdFmtDb(r.relDb, true)} | ${absTxt} |`);
    }
  } else {
    out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} |`);
    out.push("|---|---|---|");
    for (const r of sd.schieber.rows) {
      out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${_mdFmtDb(r.relDb, true)} |`);
    }
  }
  return out.join("\n") + "\n";
}

function _archivMdKurven(sd) {
  const out = [`### ${t("archivSecKurven")}`, ""];
  for (const p of sd.kurven.list) {
    const name = (typeof PR_NAMES !== "undefined" && PR_NAMES[p.typeKey]) ? t(PR_NAMES[p.typeKey]) : p.typeKey;
    const parts = [];
    parts.push(`${t("archivKurvStrength")}: ${(p.strength >= 0 ? "+" : "") + p.strength} dB`);
    if (p.center !== null) parts.push(`${t("archivKurvCenter")}: ${(sd.implant.electrodes[Math.round(p.center)] || {}).label || ("E" + p.center)}`);
    if (p.width  !== null) parts.push(`${t("archivKurvWidth")}: ${p.width}`);
    if (p.cutoff !== null) parts.push(`${t("archivKurvCutoff")}: ${(sd.implant.electrodes[p.cutoff] || {}).label || ("E" + p.cutoff)}`);
    out.push(`- **${name}** — ${parts.join(", ")}`);
  }
  return out.join("\n") + "\n";
}

function _archivMdFreqmatch(sd) {
  const out = [`### ${t("fmResultsTitle")}`, ""];
  out.push(`| ${t("fmResColEl")} | ${t("fmResColVarFreq")} | ${t("fmResColRefFreq")} | ${t("fmResColCent")} |`);
  out.push("|---|---|---|---|");
  for (const r of sd.freqmatch.rows) {
    const centStr = `${r.cent >= 0 ? "+" : ""}${Math.round(r.cent)} ¢`;
    out.push(`| ${r.elLabel} | ${_mdFmtHz(r.varFreq)} | ${_mdFmtHz(r.refFreq)} | ${centStr} |`);
  }
  return out.join("\n") + "\n";
}

function _archivMdBilateral(data) {
  const bil = data.bilateral;
  if (!bil.lr.has && !bil.latency.has) return "";
  const out = [`\n## ${t("archivSecBilateral")}\n`];
  if (bil.lr.has) {
    out.push(`### ${t("balTitle")}`);
    out.push("");
    out.push(`| ${t("thEl")} | ${t("archivBalOffset")} |`);
    out.push("|---|---|");
    for (const r of bil.lr.rows) {
      out.push(`| E${r.elIdx + 1} | ${_mdFmtDb(r.value, true)} |`);
    }
    out.push("");
    out.push(`**${t("archivBalMean")}**: ${_mdFmtDb(bil.lr.mean, true)}`);
    out.push("");
  }
  if (bil.latency.has) {
    const v = bil.latency.value;
    const sideTxt = v.ms >= 0 ? t("sideRight") : t("sideLeft");
    out.push(`### ${t("latResTitle") || "Inter-Ohr-Latenz"}`);
    out.push(`- ${t("archivLatValue")}: ${Math.abs(v.ms).toFixed(2)} ms (${sideTxt})`);
    if (v.clickType)  out.push(`- ${t("archivLatClick")}: ${v.clickType}`);
    if (v.intervalMs) out.push(`- ${t("archivLatInterval")}: ${v.intervalMs} ms`);
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
  out.push(`- ${t("archivPlStrength")}: ${p.strength} %`);
  out.push(`- ${t("archivPlNH")}: ${p.nhSim ? t("on") : t("off")}`);
  out.push(`- ${t("archivPlSrc")}: ${t("archivSrcMeas")} ${p.srcMeas ? "✓" : "✗"} · ${t("archivSrcLevels")} ${p.srcLevels ? "✓" : "✗"} · ${t("archivSrcCurves")} ${p.srcCurves ? "✓" : "✗"}`);
  const bmTxt = t("plBalMode" + p.balanceMode.charAt(0).toUpperCase() + p.balanceMode.slice(1)) || p.balanceMode;
  out.push(`- ${t("archivPlBalance")}: ${p.applyBalance ? t("on") : t("off")}${p.applyBalance ? " (" + bmTxt + ")" : ""}`);
  out.push(`- ${t("archivPlLatency")}: ${p.applyLatency ? t("on") : t("off")}`);
  out.push(`- ${t("archivPlMaplaw")}: ${p.maplawOn ? t("on") : t("off")}${p.maplawOn ? " (Soll-c=" + p.maplawSollC + ")" : ""}`);
  if (p.warpOn) {
    const modeKey = p.warpMode === "ref_side" ? "pwModeRef"
                  : p.warpMode === "var_side" ? "pwModeVar" : "pwModeSym";
    const methodKey = p.warpMethod === "sinmodel" ? "pwMethodSinmodel"
                    : p.warpMethod === "vocoder"  ? "pwMethodVocoder"
                    : p.warpMethod === "bandshift" ? "pwMethodBandshift"
                    : "pwMethodOffline";
    out.push(`- ${t("archivPlWarp")}: ${t("on")} (${t(methodKey)}, ${t(modeKey)}, ${p.warpStrength}%)`);
  } else {
    out.push(`- ${t("archivPlWarp")}: ${t("off")}`);
  }
  return out.join("\n") + "\n";
}

function _archivMdMisc(data) {
  const out = [`\n## ${t("archivSecMisc")}\n`];
  out.push(`- ${t("archivCfgDefMfr")}: ${(MFR[data.defaultMfr] && MFR[data.defaultMfr].name) || data.defaultMfr}`);
  out.push(`- ${t("archivMiscLvMode")}: ${data.lvTab.mode === "abs" ? t("lvTabModeAbsolute") : t("lvTabModeRelative")}`);
  out.push(`- ${t("archivMiscLvVariant")}: ${data.lvTab.variant}`);
  out.push(`- ${t("archivMiscLvShowMeas")}: ${data.lvTab.showMeas ? t("on") : t("off")}`);
  out.push(`- ${t("archivMiscLvShowCurves")}: ${data.lvTab.showCurves ? t("on") : t("off")}`);
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
  const sideTag = (side === "left")  ? "links"
                : (side === "right") ? "rechts"
                : "beide";
  return _applyUserFileSuffix(`ci-sound-balancing-audiologe-${mdDateStampFile()}-${sideTag}.md`);
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

// ---------- Gewinne pro Seite (ΔdB, EQ-Stärke-skaliert) ----------

function _audiologDbForSide(side) {
  return withSide(side, () => {
    const g = computeGains();
    const str = parseInt(document.getElementById("plStr").value) / 100;
    const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
    if (!eqOn) return g.map(() => 0);
    return g.map((v) => -v * str);
  });
}

// ---------- Residuum pro Elektrode (für Tabelle + Chart) ----------

function _audiologResForSide(side) {
  return withSide(side, () => {
    try {
      const { elRes } = compWLS();
      return Array.from(elRes || []);
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
    const unit = lvUnitLabelFor(mfr);
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
// Schieber (getTotalPresetCurve) + Kurven (manualLevels) werden mit
// EQ-Stärke skaliert; Mittelwert wird abgezogen (reine Pegelver-
// schiebung ist erlaubt); Standardabweichung über aktive Elektroden
// muß < 0.2 dB sein. Außerdem: EQ aktiv, NH-Sim aus.

function _audiologIsTestProgram(side) {
  const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
  if (!eqOn) return false;
  const nhSim = document.getElementById("plNHSim")?.checked;
  if (nhSim) return false;
  return withSide(side, () => {
    const str = parseInt(document.getElementById("plStr").value) / 100;
    const presetC = (typeof plSrcCurves !== "undefined" && plSrcCurves)
      ? getTotalPresetCurve() : new Array(nEl).fill(0);
    const lvls = (typeof plSrcLevels !== "undefined" && plSrcLevels)
      ? manualLevels.slice() : new Array(nEl).fill(0);
    const active = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "mute" || elExDur[i] !== null) continue;
      active.push(i);
    }
    if (active.length === 0) return false;
    const sums = active.map((i) => (presetC[i] + lvls[i]) * str);
    const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
    const variance = sums.reduce((a, b) => a + (b - mean) ** 2, 0) / sums.length;
    const sd = Math.sqrt(variance);
    return sd < 0.2;
  });
}

// ---------- Lautstärken-Tabelle pro Seite ----------

function _audiologLoudnessTable(side) {
  return withSide(side, () => {
    const dBs = _audiologDbForSide(side);
    const resArr = _audiologResForSide(side);
    const unit = lvUnitLabelFor(mfr);
    const lines = [];
    lines.push(`| ${t("thEl")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("archivImplExcl")} | ${t("audColNote")} |`);
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (let i = 0; i < nEl; i++) {
      const dB = dBs[i] || 0;
      const r  = resArr[i] || 0;
      const abs = _audiologAbsDelta(side, i, dB);
      const status = _audStatusText(side, i);
      const excl = (elExDur[i] !== null && elExDur[i] !== undefined) ? "**X**" : "";
      const note = (elNt && elNt[i]) ? elNt[i] : "";
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | **${_audDb(dB)}** | ${r > 0 ? r.toFixed(1) + " dB" : ""} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status} | ${excl} | ${note} |`
      );
    }
    return lines.join("\n");
  });
}

// ---------- Frequenz-Tabelle pro Seite (mit sym-Warp-Zusatzspalten) ----------

function _audiologFreqTable(side, mainSides) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  if (typeof fRes === "undefined" || fRes.length === 0) return "";

  const isSymSingle = (mainSides.length === 1
                      && typeof pWarpMode !== "undefined"
                      && pWarpMode === "sym");
  const own = fRes.filter((r) => r.varSide === side);
  if (own.length === 0 && !isSymSingle) return "";

  const ownByEl = {};
  for (const r of own) ownByEl[r.elIdx] = r;

  let otherByEl = null;
  let otherSide = null;
  if (isSymSingle) {
    otherSide = side === "left" ? "right" : "left";
    const otherRows = fRes.filter((r) => r.varSide === otherSide);
    otherByEl = {};
    for (const r of otherRows) otherByEl[r.elIdx] = r;
  }

  return withSide(side, () => {
    const lines = [];
    const sd = sideData[side];
    const defFreqs = (sd && sd.manufacturer && MFR[sd.manufacturer])
      ? MFR[sd.manufacturer].freqs
      : freqs;
    const ownFreqOwn = (sd && sd.elFreqOwn) ? sd.elFreqOwn : null;

    if (isSymSingle && otherByEl && Object.keys(otherByEl).length > 0) {
      const otherLbl = otherSide === "left" ? t("sideLeft") : t("sideRight");
      lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColDeltaHz")} | ${t("audColHzWish")} || ${t("audColCent")} (${otherLbl}) | ${t("audColDeltaHz")} (${otherLbl}) | ${t("audColHzWish")} (${otherLbl}) |`);
      lines.push("|---|---|---|---|---|---||---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        const o = otherByEl[i];
        if (!r && !o) continue;
        const hzDef = defFreqs[i] != null ? _mdFmtHz(defFreqs[i]) : "—";
        const hzMan = (ownFreqOwn && ownFreqOwn[i] != null) ? _mdFmtHz(ownFreqOwn[i]) : "—";
        const ownCent  = r ? _audCent(r.varFreq, r.refFreq) : "—";
        const ownDHzV  = r && isFinite(r.refFreq) && isFinite(r.varFreq) ? r.refFreq - r.varFreq : null;
        const ownDHz   = ownDHzV != null ? `${ownDHzV >= 0 ? "+" : ""}${Math.round(ownDHzV)} Hz` : "—";
        const ownNew   = r ? `**${_mdFmtHz(r.refFreq)}**` : "—";
        const othCent  = o ? _audCent(o.varFreq, o.refFreq) : "—";
        const othDHzV  = o && isFinite(o.refFreq) && isFinite(o.varFreq) ? o.refFreq - o.varFreq : null;
        const othDHz   = othDHzV != null ? `${othDHzV >= 0 ? "+" : ""}${Math.round(othDHzV)} Hz` : "—";
        const othNew   = o ? `**${_mdFmtHz(o.refFreq)}**` : "—";
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${hzDef} | ${hzMan} | ${ownCent} | ${ownDHz} | ${ownNew} || ${othCent} | ${othDHz} | ${othNew} |`);
      }
    } else {
      lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColDeltaHz")} | ${t("audColHzWish")} |`);
      lines.push("|---|---|---|---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        if (!r) continue;
        const hzDef = defFreqs[i] != null ? _mdFmtHz(defFreqs[i]) : "—";
        const hzMan = (ownFreqOwn && ownFreqOwn[i] != null) ? _mdFmtHz(ownFreqOwn[i]) : "—";
        const dHzV  = isFinite(r.refFreq) && isFinite(r.varFreq) ? r.refFreq - r.varFreq : null;
        const dHz   = dHzV != null ? `${dHzV >= 0 ? "+" : ""}${Math.round(dHzV)} Hz` : "—";
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${hzDef} | ${hzMan} | ${_audCent(r.varFreq, r.refFreq)} | ${dHz} | **${_mdFmtHz(r.refFreq)}** |`);
      }
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

function _audiologBalanceBlock(mainSides) {
  if (typeof lrResults === "undefined") return "";
  const keys = Object.keys(lrResults).filter((k) => isFinite(lrResults[k]));
  if (keys.length === 0) return "";
  const mean = keys.reduce((a, k) => a + lrResults[k], 0) / keys.length;
  if (!isFinite(mean) || mean === 0) return "";

  const balActive = (typeof plApplyBalance !== "undefined") && plApplyBalance
                 && (mainSides.length === 2);
  const louderSide = mean > 0 ? t("sideRight") : t("sideLeft");
  const quieterSide = mean > 0 ? t("sideLeft")  : t("sideRight");

  const lines = [];
  lines.push(`## ${t("audiologSecBalance")}`);
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

function _audiologLatencyBlock(mainSides) {
  if (typeof latencyResult === "undefined" || !latencyResult) return "";
  if (!isFinite(latencyResult.valueMs)) return "";
  const ms = latencyResult.valueMs;
  if (ms === 0) return "";
  const latActive = (typeof plApplyLatency !== "undefined") && plApplyLatency
                 && (mainSides.length === 2);
  const earlierSide = ms >= 0 ? t("sideLeft")  : t("sideRight");
  const laterSide   = ms >= 0 ? t("sideRight") : t("sideLeft");
  const lines = [];
  lines.push(`## ${t("audiologSecLatency")}`);
  lines.push("");
  lines.push(`- ${t("audiologLatValue")}: **${Math.abs(ms).toFixed(2)} ms**`);
  lines.push(`- ${t("audiologLatImpact")
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
    const freqOwnSet = (sd && sd.elFreqOwn || []).some((v) => v != null && isFinite(v));
    if (!freqOwnSet) missing.push(t("audMissFreqOwn"));
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "cochlear" && !impl.iidr) missing.push(t("audMissIidr"));
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

// ---------- Letzte Messung pro Seite (max-Timestamp von jRes+bRes) ----------

function _audiologLastMeas(side) {
  const sd = sideData[side];
  if (!sd) return null;
  let max = 0;
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e && e.timestamp && e.timestamp > max) max = e.timestamp;
  };
  collect(sd.jRes); collect(sd.bRes);
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

function buildAudiologMarkdown() {
  const now = new Date();
  const dateStr = now.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
  const mainSides = _audiologMainSides();
  const sideLabel = _mdBilateralLabel();
  const parts = [];

  // ---- Kopf ----
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}`);
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`_${t("audiologToolVersionLine").replace("{VERSION}", APP_VERSION)}_`);
  }
  parts.push("");

  // ---- EQ aus ----
  if (typeof plEqOn !== "undefined" && !plEqOn) {
    parts.push(`> ${t("audiologEqOff")}\n`);
  }

  // ===========================================================
  // BILATERAL-BLOCK — vor den Seiten-Blöcken.
  // Reihenfolge: Balance → Latenz → Hinweise → Fehlende Angaben.
  // ===========================================================
  parts.push(_audiologAdvice());
  const miss = _audiologMissingImplantData(mainSides);
  if (miss) parts.push(miss);
  const bal = _audiologBalanceBlock(mainSides);
  if (bal) parts.push(bal);
  const lat = _audiologLatencyBlock(mainSides);
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
    const lastM = _audiologLastMeas(side);
    if (lastM) meta.push(`${t("audiologLastMeas")}: ${_audiologDateStr(lastM)}`);
    parts.push(`_${meta.join(" · ")}_`);
    parts.push("");
    if (_audiologIsTestProgram(side)) parts.push(`> ${t("audiologTestProgramHint")}\n`);

    // H3 Lautstärken-Korrektur
    parts.push(`### ${t("audiologSecLoudness")}`);
    parts.push("");
    parts.push(_audiologLoudnessTable(side));
    parts.push("");
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // H3 MAPLAW-Änderung — falls relevant für diese Seite
    const mlSide = _audiologMaplawSection([side], "###");
    if (mlSide) parts.push(mlSide);

    // H3 Änderung der Mittenfrequenzen — falls relevant für diese Seite
    if (typeof pWarpOn !== "undefined" && pWarpOn
        && typeof plEqOn !== "undefined" && plEqOn
        && typeof fRes !== "undefined" && fRes.length > 0) {
      const ft = _audiologFreqTable(side, [side]);
      if (ft) {
        parts.push(`### ${t("audiologSecFreq")}`);
        parts.push("");
        if (typeof pWarpMode !== "undefined" && pWarpMode === "sym") {
          parts.push(`_${t("audiologFreqSymHint")}_`);
          parts.push("");
        }
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
  const resArr = _audiologResForSide(side);
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
  if (typeof openPrintWindow !== "function") {
    alert("openPrintWindow not available — print.js missing?");
    return;
  }
  openPrintWindow(t("audiologTitle"), body);
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
function _archivChartLoudness(sideBlock) {
  if (!sideBlock.meas.hasNonZero) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = sideBlock.meas.rows;
  let maxAbs = 1;
  for (const r of rows) if (r.offsetDb != null) maxAbs = Math.max(maxAbs, Math.abs(r.offsetDb));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecMeas")} — ${sideBlock.label}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    if (r.offsetDb == null) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 1, w, 2);
    } else {
      const h = (Math.abs(r.offsetDb) / maxAbs) * (pH / 2);
      ctx.fillStyle = (r.idx === sideBlock.meas.refEl) ? "#a855f7"
                    : r.offsetDb >= 0 ? "#16a34a" : "#dc2626";
      if (r.offsetDb >= 0) ctx.fillRect(x, zY - h, w, h);
      else                 ctx.fillRect(x, zY,    w, h);
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 2. Schieber (Schieber-Tab, relative dB-Werte)
function _archivChartSchieber(sideBlock) {
  if (!sideBlock.schieber.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = sideBlock.schieber.rows;
  let maxAbs = 1;
  for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.relDb || 0));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecSchieber")} — ${sideBlock.label}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
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
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 3. Kurven (4-Linien-Chart, vereinfacht — eine Linie pro aktive Kurvenfunktion + Summe)
function _archivChartKurven(sideBlock) {
  if (!sideBlock.kurven.has) return "";
  return withSide(sideBlock.side, () => {
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 28 };
    const n = nEl;
    const total = getTotalPresetCurve();
    let maxAbs = 1;
    for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(total[i] || 0));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecKurven")} — ${sideBlock.label}`,
    });
    const gW = pW / Math.max(1, n - 1);
    const yFor = (v) => zY - (v / maxAbs) * (pH / 2);
    const COLORS = ["#3b82f6", "#f97316", "#a855f7", "#06b6d4", "#84cc16", "#eab308", "#ec4899", "#14b8a6"];
    let ci = 0;
    for (const p of presets) {
      if (!p.on || p.strength === 0) continue;
      const curve = calcPresetCurve(p, n);
      ctx.strokeStyle = COLORS[ci % COLORS.length];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad.l + i * gW;
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
      const x = pad.l + i * gW;
      const y = yFor(total[i] || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i++) {
      if (i % 2 !== 0 && n > 8) continue;
      const x = pad.l + i * gW;
      ctx.fillText(sideBlock.implant.electrodes[i].label, x, H - pad.b + 14);
    }
    return canvas.toDataURL("image/png");
  });
}

// 4. Frequenzabgleich (log-Hz x lin-Cent)
function _archivChartFreqmatch(sideBlock) {
  if (!sideBlock.freqmatch.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 40, r: 14, t: 22, b: 28 };
  const rows = sideBlock.freqmatch.rows;
  let maxAbsCent = 50;
  for (const r of rows) maxAbsCent = Math.max(maxAbsCent, Math.abs(r.cent));
  maxAbsCent = Math.ceil(maxAbsCent / 50) * 50;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbsCent + " ¢", {
    title: `${t("fmResultsTitle")} — ${sideBlock.label}`,
  });
  const freqs = rows.map((r) => r.varFreq);
  const fMin = Math.min(...freqs, 100), fMax = Math.max(...freqs, 8000);
  const xFor = (hz) => pad.l + (Math.log2(hz / fMin) / Math.log2(fMax / fMin)) * pW;
  for (const r of rows) {
    const x = xFor(r.varFreq);
    const y = zY - (r.cent / maxAbsCent) * (pH / 2);
    ctx.beginPath();
    ctx.fillStyle = r.cent >= 0 ? "#16a34a" : "#dc2626";
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.elLabel, x, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 5. Stereo-Balance (bilateral)
function _archivChartLR(bilateral) {
  if (!bilateral.lr.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = bilateral.lr.rows;
  let maxAbs = 1;
  for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.value));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("balTitle")}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    const h = (Math.abs(r.value) / maxAbs) * (pH / 2);
    ctx.fillStyle = r.value >= 0 ? "#3b82f6" : "#dc2626";
    if (r.value >= 0) ctx.fillRect(x, zY - h, w, h);
    else              ctx.fillRect(x, zY,    w, h);
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`E${r.elIdx + 1}`, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 6. Player-EQ pro Seite (nutzt eqGains aus data.player)
function _archivChartPlayerEq(sideBlock, playerEqArr) {
  if (!playerEqArr || playerEqArr.length === 0) return "";
  if (!playerEqArr.some((v) => Math.abs(v) > 0)) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  let maxAbs = 1;
  for (const v of playerEqArr) maxAbs = Math.max(maxAbs, Math.abs(v));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecPlayer")} EQ — ${sideBlock.label}`,
  });
  const gW = pW / playerEqArr.length;
  for (let j = 0; j < playerEqArr.length; j++) {
    const v = playerEqArr[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    if (Math.abs(v) < 0.05) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 1, w, 2);
    } else {
      const h = (Math.abs(v) / maxAbs) * (pH / 2);
      ctx.fillStyle = v >= 0 ? "#16a34a" : "#dc2626";
      if (v >= 0) ctx.fillRect(x, zY - h, w, h);
      else        ctx.fillRect(x, zY,    w, h);
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    const el = sideBlock.implant.electrodes[j];
    ctx.fillText(el ? el.label : ("E" + (j + 1)), x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
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
    if (sd.meas.hasNonZero) {
      inserts.push({
        anchorH3: `${t("archivSecMeas")} (`,
        sideOnlyUnder: sd.label,
        img: _archivChartLoudness(sd),
      });
    }
    if (sd.schieber.has) {
      inserts.push({
        anchorH3: `${t("archivSecSchieber")} (`,
        sideOnlyUnder: sd.label,
        img: _archivChartSchieber(sd),
      });
    }
    if (sd.kurven.has) {
      inserts.push({
        anchorH3: `${t("archivSecKurven")}`,
        sideOnlyUnder: sd.label,
        img: _archivChartKurven(sd),
      });
    }
    if (sd.freqmatch.has) {
      inserts.push({
        anchorH3: `${t("fmResultsTitle")}`,
        sideOnlyUnder: sd.label,
        img: _archivChartFreqmatch(sd),
      });
    }
  }
  if (data.bilateral.lr.has) {
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
    @media print { body { margin: 0; padding: 0; } }
  `;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("archivTitle")}</title><style>${styles}</style></head><body>${enrichedHtml}</body></html>`;
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
