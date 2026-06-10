# Bauanleitung 40: Archiv-Box — gemeinsamer Datensammler + Markdown-Renderer

Setzt Bauanleitungen 38 (Archiv-Box) und 39 (Audiologen-Box) voraus.
Die Audiologen-Box (`buildAudiologMarkdown`, `audiologPrint`) bleibt
in dieser Anleitung **unangetastet** — wir bauen ausschließlich an
Modus A (Archiv).

## Hintergrund

Heute laufen die zwei Archiv-Aktionen über zwei völlig getrennte
Codepfade mit verschiedenen Inhalten:

- **„Markdown Text exportieren"** ruft `buildArchivMarkdown` in
  `print-md.js`. Knapper Bericht, läßt z.B. THR/MCL pro Elektrode,
  den Sweep-Resume-Stand, die lokalen Sammlungen und die
  Levels-Tab-Anzeige-Einstellungen weg.
- **„Bericht drucken"** ruft den großen `fPrintBtn`-Inline-Handler in
  `init.js` (Z. 169–680, ca. 500 Zeilen). DOM-basierte HTML-
  Erzeugung mit EQ-Graph-Canvas pro Seite, Implantat-Tabelle,
  Korrektur-Tabelle, aber **ohne** Schieber-, Kurven-, Stereo-
  Balance- oder Frequenzabgleich-Grafiken.

Ziel ab dieser Anleitung: **ein** gemeinsamer Datensammler
`collectArchivData()` liefert ein strukturiertes Objekt. Daraus
rendert `renderArchivMarkdown(data)` reinen Markdown-Text;
`renderArchivPrintHtml(data)` (in Bauanleitung 41) rendert
Markdown→HTML plus eingebettete PNG-Grafiken. Beide Ausgaben sind
inhaltlich deckungsgleich.

In **dieser** Anleitung wird der Datensammler gebaut und der
Markdown-Renderer ausgetauscht. Der Druck-Knopf `fPrintBtn` bleibt
**vorerst** auf dem alten DOM-Handler — er wird in Bauanleitung 41
ersetzt.

## Sichtbares Verhalten nach dieser Anleitung

- Klick „Markdown Text exportieren" liefert eine Datei
  `ci-sound-balancing-archiv-<datum>-<zeit>.md` mit folgenden
  Sektionen (Reihenfolge fest, leere Bereiche werden weggelassen):
  1. Kopf
  2. Konfiguration pro Seite
  3. Implantat-Tabelle pro Seite (NEU)
  4. Globale Test-Einstellungen
  5. Pro Seite: Messungen Elektrodenlautstärke (mit Sweep-Resume-
     Stand, NEU)
  6. Pro Seite: Schieber
  7. Pro Seite: Kurven
  8. Pro Seite: Frequenzabgleich
  9. Stereo-Balance (bilateral)
  10. Latenz (bilateral)
  11. Player (vollständig, NEU mit Warp-Methode, Quellen-Toggles)
  12. Sonstiges (Default-Hersteller, Levels-Tab-Modus + Variante,
      Lokale Sammlungen — NEU)
- Klick „Bericht drucken" verhält sich wie bisher (alter Handler).

Berührt: `print-md.js`, `init.js` (eine Zeile), `i18n.js` (neue
Keys in 4 Sprachen), `CODESTRUKTUR.md`, `SPEC.md`.

---

## Schritt 1 — Datensammler in `print-md.js` einbauen

Im **oberen** Teil von `print-md.js`, **vor** der bisherigen
Sektion `// --- Sektion: Header ---` (also nach den `_md…`-
Helfern), die folgende Funktion einfügen. Sie liest alle benötigten
globalen State-Variablen und liefert ein flaches Datenobjekt.

```js
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
      const hasNonZero = levels.some((v) => isFinite(v) && Math.abs(v) > 0);
      // nur wenn mind. ein Wert != 0 vorhanden ist, hat die Sektion Gewicht;
      // measHas bleibt aber true, weil Roh-Paare existieren — wir merken die
      // Schwelle gesondert in measHasNonZero und entscheiden im Renderer.
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

    // Frequenzabgleich (FM gehört eigentlich global, aber Werte sind
    // varSide-spezifisch — wir hängen die Rows pro Seite an)
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
      manufacturerLabel: (MFR[mfr] && MFR[mfr].label) || mfr,
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

  // Player-EQ-Gains pro Seite (negierte computeGains * Stärke). Wir
  // erfassen pro Seite, weil im Stereo-Modus die beiden Ketten
  // unterschiedliche Gains haben können (eigene Seitendaten).
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
```

---

## Schritt 2 — Markdown-Renderer

Die bestehenden Funktionen `buildArchivMarkdown`, `_mdArchivHeader`,
`_mdConfigBlock`, `_mdTestSettings`, `_mdMeasTable`,
`_mdSchieberTable`, `_mdKurvenList`, `_mdFreqMatchTable`,
`_mdSideSection`, `_mdBilateralBlock`, `_mdPlayerBlock` in
`print-md.js` werden **ersetzt** durch eine einzige Renderer-
Funktion `renderArchivMarkdown(data)` plus pro Sektion einen
Sub-Renderer.

Wichtig: **Die Audiologen-Funktionen** (`buildAudiologMarkdown`,
`audiologPrint`, `_audiologSideTable`, `_audiologMaplawBlock`,
`_audiologFreqBlock`, `_audiologBalanceBlock`, `_audiologLatencyBlock`,
`_audiologNoteBlock`, `_audiologEqOffBlock`, `_audiologChartImg`,
`_audiologMainSides`, `_audiologIsTwoEar`, `_audiologDbForSide`,
`_audiologAbsDelta`, `_audiologDbCol`, `_audiologAbsCol`,
`_mdToHtmlBasic`) bleiben **alle erhalten**. Nur die Modus-A-
Funktionen werden ausgetauscht.

In `print-md.js` die Sektion „Sektion: Header" bis „Haupt-Generator:
Modus A" (also alles bis vor `// ====== MODUS B …`) durch folgenden
Block ersetzen:

```js
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
    const cfgLabel = t("cfgOpt_" + sd.config) || sd.config;
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
    out.push(`| ${t("thEl")} | ${t("archivImplHzStd")} | ${t("archivImplHzOwn")} | ${t("archivImplThr")} (${unit}) | ${t("archivImplUpper")} (${unit}) | ${t("archivImplStatus")} | ${t("archivImplNote")} |`);
    out.push("|---|---|---|---|---|---|---|");
    for (const e of sd.implant.electrodes) {
      const hzStd  = _mdFmtHz(e.hzStandard);
      const hzOwn  = (e.hzOwn != null) ? _mdFmtHz(e.hzOwn) : "—";
      const thrTxt = (e.thr   != null) ? e.thr   : "—";
      const upTxt  = (e.upper != null) ? e.upper : "—";
      const stTxt  = e.excluded
        ? t("statExcluded") || "ausgeschlossen"
        : (e.status ? (t("stat_" + e.status) || e.status) : "");
      const note = _mdEsc(e.note || "");
      out.push(`| ${e.label} | ${hzStd} | ${hzOwn} | ${thrTxt} | ${upTxt} | ${stTxt} | ${note} |`);
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
    const stTxt  = r.status ? (t("stat_" + r.status) || r.status) : "";
    const noteTxt = r.note ? ` (${_mdEsc(r.note)})` : "";
    out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} |`);
  }
  return out.join("\n") + "\n";
}

function _archivMdSchieber(sd) {
  const out = [];
  const modeLabel = (sd.schieber.mode === "abs") ? t("lvTabMdAbs") : t("lvTabMdRel");
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
    const name = t("PR_" + p.typeKey) || p.typeKey;
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
      // Label entsprechend aktiver Seite — Stereo-Balance ist
      // pro-Elektrode-Index unabhängig, der Label-Style folgt der
      // aktiven Seite. Wir verwenden bewußt das Standard-Label.
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
  out.push(`- ${t("archivCfgDefMfr")}: ${(MFR[data.defaultMfr] && MFR[data.defaultMfr].label) || data.defaultMfr}`);
  out.push(`- ${t("archivMiscLvMode")}: ${data.lvTab.mode === "abs" ? t("lvTabMdAbs") : t("lvTabMdRel")}`);
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
```

Anschließend in `print-md.js` die alte Funktion `buildArchivMarkdown`
**komplett entfernen** (sie wurde durch `renderArchivMarkdown`
ersetzt). Auch die alten Sektion-Helfer (`_mdArchivHeader`,
`_mdConfigBlock`, `_mdTestSettings`, `_mdMeasTable`,
`_mdSchieberTable`, `_mdKurvenList`, `_mdFreqMatchTable`,
`_mdSideSection`, `_mdBilateralBlock`, `_mdPlayerBlock`) entfernen
— sie sind tot.

**Behalten** dagegen alle generischen Helfer (`_mdEsc`, `_mdFmtDb`,
`_mdFmtHz`, `_mdBilateralLabel`, `mdDateStampFile`, `mdArchivFilename`,
`mdCopyToClipboard`, `_mdCopyFallback`, `mdDownload`) — die Audiologen-
Seite benutzt sie weiter.

---

## Schritt 3 — Aufruf in `init.js` anpassen

In `init.js`, Z. 681–683 (der `fArchivMdBtn`-Listener):

Vorher:
```js
  document.getElementById("fArchivMdBtn").addEventListener("click", () => {
    mdDownload(buildArchivMarkdown(), mdArchivFilename());
  });
```

Nachher:
```js
  document.getElementById("fArchivMdBtn").addEventListener("click", () => {
    mdDownload(renderArchivMarkdown(collectArchivData()), mdArchivFilename());
  });
```

Der `fPrintBtn`-Listener (ab Z. 169) bleibt in dieser Anleitung
**unverändert** — er wird in Bauanleitung 41 ersetzt.

---

## Schritt 4 — Neue i18n-Keys (alle vier Sprachen)

In `i18n.js` müssen folgende Keys in **allen vier Sprachblöcken**
ergänzt werden. Anker zum schnellen Finden: `archivTitle:` —
deutsch Z. 269, englisch Z. 912, französisch Z. 1536, spanisch
Z. 2165. Die neuen Keys direkt **unter** `archivTitle:` und in
der Nähe der vorhandenen `archiv*`-Keys einsortieren.

### Deutsch (im Block Z. 269 …)

```js
archivHeaderActive: "Aktive Seite",
archivSecImplant: "Implantat-Tabelle",
archivSecMisc: "Sonstiges",
archivImplHzStd: "Hz Standard",
archivImplHzOwn: "Hz eigen",
archivImplThr: "THR",
archivImplUpper: "MCL / Upper",
archivImplStatus: "Status",
archivImplNote: "Notiz",
archivMeasRef: "Referenz",
archivMeasSweepNote: "Vollständig-Sweep angefangen: Runde {round}, bestätigte Paare {done} von {total}.",
archivCfgIdr: "IDR",
archivCfgIidr: "IIDR",
archivCfgGeneration: "Generation",
archivMiscLvMode: "Schieber-Tab: Modus",
archivMiscLvVariant: "Schieber-Tab: Variante",
archivMiscLvShowMeas: "Schieber-Tab: Messung einblenden",
archivMiscLvShowCurves: "Schieber-Tab: Kurven einblenden",
archivMiscSaetze: "Lokale Satz-Sammlungen",
archivMiscSaetzeFiles: "Dateien",
archivMiscSaetzeStub: "nicht geladen",
```

### Englisch (im Block Z. 912 …)

```js
archivHeaderActive: "Active side",
archivSecImplant: "Implant table",
archivSecMisc: "Miscellaneous",
archivImplHzStd: "Hz default",
archivImplHzOwn: "Hz custom",
archivImplThr: "THR",
archivImplUpper: "MCL / Upper",
archivImplStatus: "Status",
archivImplNote: "Note",
archivMeasRef: "Reference",
archivMeasSweepNote: "Full sweep started: round {round}, confirmed pairs {done} of {total}.",
archivCfgIdr: "IDR",
archivCfgIidr: "IIDR",
archivCfgGeneration: "Generation",
archivMiscLvMode: "Sliders tab: mode",
archivMiscLvVariant: "Sliders tab: variant",
archivMiscLvShowMeas: "Sliders tab: show measurement",
archivMiscLvShowCurves: "Sliders tab: show curves",
archivMiscSaetze: "Local sentence collections",
archivMiscSaetzeFiles: "files",
archivMiscSaetzeStub: "not loaded",
```

### Französisch (im Block Z. 1536 …)

```js
archivHeaderActive: "Côté actif",
archivSecImplant: "Tableau d'implant",
archivSecMisc: "Divers",
archivImplHzStd: "Hz standard",
archivImplHzOwn: "Hz personnalisé",
archivImplThr: "THR",
archivImplUpper: "MCL / Upper",
archivImplStatus: "État",
archivImplNote: "Note",
archivMeasRef: "Référence",
archivMeasSweepNote: "Balayage complet entamé : tour {round}, paires confirmées {done} sur {total}.",
archivCfgIdr: "IDR",
archivCfgIidr: "IIDR",
archivCfgGeneration: "Génération",
archivMiscLvMode: "Onglet curseurs : mode",
archivMiscLvVariant: "Onglet curseurs : variante",
archivMiscLvShowMeas: "Onglet curseurs : afficher la mesure",
archivMiscLvShowCurves: "Onglet curseurs : afficher les courbes",
archivMiscSaetze: "Collections locales de phrases",
archivMiscSaetzeFiles: "fichiers",
archivMiscSaetzeStub: "non chargé",
```

### Spanisch (im Block Z. 2165 …)

```js
archivHeaderActive: "Lado activo",
archivSecImplant: "Tabla de implante",
archivSecMisc: "Otros",
archivImplHzStd: "Hz estándar",
archivImplHzOwn: "Hz propio",
archivImplThr: "THR",
archivImplUpper: "MCL / Upper",
archivImplStatus: "Estado",
archivImplNote: "Nota",
archivMeasRef: "Referencia",
archivMeasSweepNote: "Barrido completo iniciado: ronda {round}, pares confirmados {done} de {total}.",
archivCfgIdr: "IDR",
archivCfgIidr: "IIDR",
archivCfgGeneration: "Generación",
archivMiscLvMode: "Pestaña deslizadores: modo",
archivMiscLvVariant: "Pestaña deslizadores: variante",
archivMiscLvShowMeas: "Pestaña deslizadores: mostrar medición",
archivMiscLvShowCurves: "Pestaña deslizadores: mostrar curvas",
archivMiscSaetze: "Colecciones locales de frases",
archivMiscSaetzeFiles: "archivos",
archivMiscSaetzeStub: "no cargada",
```

**Verifikation**: nach dem Einfügen jeweils `grep -c
"archivHeaderActive" i18n.js` ausführen — muß `4` ergeben (vier
Sprachblöcke).

Schon vorhandene `t("statExcluded")`, `t("lvTabMdAbs")`,
`t("lvTabMdRel")`, `t("pwMethodSinmodel")`, `t("pwMethodVocoder")`,
`t("pwMethodBandshift")`, `t("pwMethodOffline")` müssen ebenfalls
in allen vier Blöcken existieren. Falls einer fehlt: ergänzen.
Andernfalls liefert `t()` den Key statt eines Texts, was im Markdown
zwar unschön, aber nicht funktionsbrechend ist.

---

## Schritt 5 — Referenzdateien aktualisieren

### CODESTRUKTUR.md

In der Tabelle „Module im Ladeverlauf", Zeile zu `12d | print-md.js`:

Vorher (Auszug):
> Markdown-Generatoren für Archiv-Box (Modus A) und Audiologen-Box
> (Modus B). Modus A: `buildArchivMarkdown` + diverse `_md*`-
> Sektion-Helfer. […]

Nachher:
> Markdown-Generatoren für Archiv-Box (Modus A) und Audiologen-Box
> (Modus B). Modus A: Datensammler `collectArchivData` plus
> Renderer `renderArchivMarkdown` und Sektion-Helfer `_archivMd*`.
> Modus B: `buildAudiologMarkdown`, `audiologPrint`,
> `mdAudiologFilename`, ein interner Mini-MD→HTML-Konverter
> `_mdToHtmlBasic` und ein Korrektur-Chart-Helfer
> `_audiologChartImg`. Gemeinsame Helfer: `mdCopyToClipboard`,
> `mdDownload`, `mdArchivFilename`, `mdDateStampFile`, `_mdEsc`,
> `_mdFmtDb`, `_mdFmtHz`, `_mdBilateralLabel`. […]

Im Abschnitt „Datenfluss" den Absatz „Markdown-Export (Archiv-Box)"
ersetzen durch:

> **Markdown-Export (Archiv-Box):** `collectArchivData` in
> `print-md.js` liest einmal alle relevanten State-Variablen ein
> (`sideData`, `lrResults`, `latencyResult`, `fRes`, alle
> `plApply*`/`plBalanceMode`/`pMaplaw*`/`pWarp*`-Werte sowie
> globale Test-/Levels-Tab-Werte) und liefert ein strukturiertes
> Objekt. `renderArchivMarkdown(data)` rendert daraus den
> Markdown-Bericht. Pro Seite wird `withSide(side, fn)` benutzt,
> um die seiten-spezifische Live-View korrekt zu binden. Die
> Aktionen „Markdown Text exportieren" und „Bericht drucken"
> sitzen in der Archiv-Karte (`#cardArchiv`). Bauanleitung 41
> hängt den Druck-Pfad ebenfalls an `collectArchivData` an.

### SPEC.md

Im Abschnitt „Archiv-Box im Tab Laden/Speichern" den Absatz zum
Markdown-Bericht ersetzen durch:

> Markdown-Bericht: vollständige Tool-Sicht in einer festen
> Markdown-Struktur. Reihenfolge: Kopf, Konfiguration pro Seite,
> Implantat-Tabelle pro Seite (THR, MCL/Upper, Hz-eigen, Status,
> Notiz), globale Test-Einstellungen, pro Seite Messungen
> (mit Sweep-Resume-Stand falls vorhanden) / Schieber / Kurven /
> Frequenzabgleich, Bilateral (Stereo-Balance, Latenz), Player
> (vollständig), Sonstiges (Default-Hersteller, Schieber-Tab-
> Anzeige, lokale Satz-Sammlungen). Pro Seite werden Sektionen
> ohne Inhalt weggelassen. Der Bericht ist sprach-aktuell — der
> Sprachwechsel im Tool wechselt auch die Markdown-Sprache.

---

## Akzeptanztest-Checkliste

Diese Schritte führst du als Nutzer durch, ohne Code zu lesen.
Erwartetes Verhalten in Klammern.

1. Tool öffnen, **Reset** klicken („Alles zurücksetzen") und
   eingangs nichts justieren. Im Tab Laden/Speichern auf
   „**Markdown Text exportieren**" klicken.
   → Datei `ci-sound-balancing-archiv-…md` wird heruntergeladen.
2. Datei im Texteditor öffnen.
   → Folgende Sektionen sind vorhanden, in dieser Reihenfolge:
     `# CI Sound Balancing — Archiv …`, `## Konfiguration`,
     `## Implantat-Tabelle`, `## Test-Einstellungen`,
     `## Player`, `## Sonstiges`. Keine Mess-/Schieber-/Kurven-/
     Frequenzabgleich-/Bilateral-Sektion, weil keine Daten da
     sind.
3. In der Implantat-Tabelle stehen **alle Elektroden** beider
   Seiten als Zeilen, mit Spalten Nr · Hz Standard · Hz eigen ·
   THR · MCL/Upper · Status · Notiz. Die Werte sind plausibel
   (THR/MCL leer = „—").
4. Im Implantat-Tab rechts MCL=200 bei E1 eintragen, THR=50.
   Wieder Markdown exportieren.
   → In der Implantat-Tabelle der Seite **Rechts** zeigt E1
     jetzt THR=50, MCL/Upper=200.
5. Im Tab Messungen einen Test 1 mit zwei Paaren ausführen,
   bestätigen, stoppen. Wieder exportieren.
   → Sektion `## Rechts` enthält `### Messungen (Referenz: E…)`
     mit Tabelle. Falls Modus „Vollständig" begonnen: zusätzlich
     der Resume-Hinweis „Vollständig-Sweep angefangen: Runde X
     …" als kursiver Hinweis.
6. Im Schieber-Tab eine Elektrode um +3 dB anheben. Exportieren.
   → Sektion `### Schieber (relativ)` mit allen Elektroden, die
     bewegte mit `+3.0 dB`, andere mit `+0.0 dB`.
7. In Kurven-Tab „Lautstärke" aktivieren mit Stärke +5 dB.
   Exportieren.
   → `### Kurven` Sektion mit `- **Lautstärke** — Stärke: +5 dB`.
8. Im Frequenzabgleich-Test einen Wert bestätigen. Exportieren.
   → `### Frequenzabgleich` Sektion mit varFreq, refFreq, Cent.
9. Im Stereo-Balance-Test einen Wert für E1 bestätigen.
   Exportieren.
   → `## Bilateral` Sektion mit `### Stereo-Balance` und
     Mittelwert.
10. Im Player Warp aktivieren, Methode Sinusoidal Modeling,
    Modus Variable Seite, Stärke 80 %. Exportieren.
    → `## Player` Sektion enthält
      `- Frequenz-Warping: an (Sinusoidal Modeling, …, 80%)`.
11. Sprache umschalten auf English, exportieren.
    → Sektionstitel und Spaltenüberschriften englisch
      (Implant table, Configuration, Player, etc.). Die Inhalts-
      Werte ebenfalls (z.B. `Reference: E…`, `on/off`).
12. Sprache auf Deutsch zurück, **„Bericht drucken"** klicken.
    → Druckvorschau erscheint wie vor dieser Anleitung (alter
      DOM-Handler) — keine Regression. Die Druck-Umstellung
      kommt in Bauanleitung 41.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede Akzeptanz-Kriterie 1–12 einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe. Insbesondere:

- Schritt 2 — sind alle alten `_md…`-Helfer (Modus A) entfernt
  und nur die generischen Helfer (`_mdEsc`, `_mdFmtDb`,
  `_mdFmtHz`, `_mdBilateralLabel`) sowie die Audiologen-Helfer
  geblieben? Welche Funktionen sind in welcher Zeile?
- Schritt 3 — exakte Zeile in init.js für die geänderte
  Listener-Verdrahtung?
- Schritt 4 — `grep -c "archivHeaderActive" i18n.js` Ergebnis?
  (muß 4 sein)
- Schritt 5 — wurden die genannten Absätze in CODESTRUKTUR.md
  und SPEC.md angepaßt?

Falls etwas unklar ist: nicht annehmen, sondern zurückfragen.
