// ============================================================
// RESULTS
// ============================================================
function ELL_renderResults() {
  // BA 251: hJ entfaellt (judgment-Verfahren raus); nur noch ELL_results.
  const hB = ELL_results.length > 0;
  if (!hB) {
    const nr = document.getElementById("ELL_noRes");
    const rc = document.getElementById("ELL_resC");
    if (nr) nr.style.display = "";
    if (rc) rc.style.display = "none";
    return;
  }
  const noResEl = document.getElementById("ELL_noRes");
  if (noResEl) noResEl.style.display = "none";
  const ELL_resCEl = document.getElementById("ELL_resC");
  if (ELL_resCEl) ELL_resCEl.style.display = "";

  // Hinweis "Testreihe noch nicht abgeschlossen" — nur für Modus full
  const ndBox    = document.getElementById('ELL_resNotDoneBox');
  const ndTitle  = document.getElementById('ELL_resNotDoneTitle');
  const ndDetail = document.getElementById('ELL_resNotDoneDetail');
  if (ndBox && ndTitle && ndDetail) {
    const s = sideData[activeSide];
    const rrTable = (typeof ROUND_ROBIN !== 'undefined') ? ROUND_ROBIN[nEl] : null;
    const inFullSweep = rrTable && s && s.fullSweepRound !== null && s.fullSweepRound !== undefined;
    if (inFullSweep) {
      const maxRounds = rrTable.length;
      const pairsPerRound = rrTable[s.fullSweepRound - 1].length;
      const done = (s.fullSweepDonePairs || []).length;
      ndTitle.textContent  = t('ELL_resNotDoneTitle');
      ndDetail.textContent = t('ELL_resNotDoneDetail')
        .replace('{round}',     s.fullSweepRound)
        .replace('{maxRounds}', maxRounds)
        .replace('{done}',      done)
        .replace('{total}',     pairsPerRound);
      ndBox.style.display = '';
    } else {
      ndBox.style.display = 'none';
    }
  }

  // BA 250: Elektrodenlautstaerke-Test hat kein Header-Volume-Feld
  // mehr — der Wert sitzt im State volume_test (in der Tonart-Modalbox
  // eingestellt). Fallback 75 wie bisher.
  const vol = (typeof volume_global !== 'undefined') ? volume_global : 75;
  let meta = `${new Date().toLocaleString(lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US")}`;
  if (hB) meta += ` · ${ELL_results.length} bal.`;
  meta += ` · ${t("lblVol")} ${vol}% · ${MFR[mfr].name}`;
  const rMeta = document.getElementById("ELL_resMeta");
  if (rMeta) rMeta.innerHTML = meta;
  const th = document.getElementById("ELL_resTH"),
    tb = document.getElementById("ELL_resTB");
  th.innerHTML = "";
  tb.innerHTML = "";
  // Glossar befüllen
  const gEl = (id) => document.getElementById(id);
  if (gEl("ELL_glossTitleEl")) gEl("ELL_glossTitleEl").textContent = t("ELL_glossTitle");
  [
    "ELL_glossResiduum",
    "ELL_glossErrBar",
    "ELL_glossAnpassung",
    "ELL_glossFarbe",
    "ELL_glossRef",
    "ELL_glossLS",
  ].forEach((k) => {
    const el = gEl(k + "El");
    if (el) el.innerHTML = t(k);
  });
  if (hB) {
    const { raw: levels, residual: ELL_res, weight: ELL_wt } = ELL_testData({ ctx: ELL_ctx("global") });
    const pc = new Array(nEl).fill(0);
    const valid = ELL_results.filter(
      (r) =>
        elExDur[r.a] === null &&
        elSt[r.a] !== "mute" &&
        elExDur[r.b] === null &&
        elSt[r.b] !== "mute",
    );
    for (const r of valid) {
      pc[r.a]++;
      pc[r.b]++;
    }
    // Zuverlässigkeitseinschätzung berechnen
    const act = actEl();
    const maxLv = Math.max(...act.map((i) => Math.abs(levels[i])), 0.001);
    function ell_color(i) {
      if (!pc[i]) return "grey";
      const res = ELL_res[i] || 0.001;
      if (res <= 1.0) return "green";
      if (res < 3.0) return "yellow";
      return "red";
    }
    // Fließtext
    const avgMeas =
      act.length > 0 ? pc.reduce((s, v) => s + v, 0) / act.length : 0;
    const rtEl = document.getElementById("ELL_reliabilityText");
    if (rtEl && rtEl.parentElement) {
      const rmsLv = Math.sqrt(
        act.reduce((s, i) => s + levels[i] ** 2, 0) / (act.length || 1),
      );
      const meanRes = act.reduce((s, i) => s + ELL_res[i], 0) / (act.length || 1);
      const globalSNR = meanRes > 0 ? rmsLv / meanRes : 0;
      const redEls = act.filter((i) => ell_color(i) === "red");
      const yellEls = act.filter((i) => ell_color(i) === "yellow");
      let txt = "";
      if (avgMeas < 2) {
        const msgs = {
          de: "Erste Meßwerte liegen vor. Für eine zuverlässige Einschätzung sind noch mehr Vergleiche nötig. Bitte weitere Testreihen durchführen.",
          en: "First measurements recorded. More comparisons are needed for a reliable assessment. Please run more test series.",
          fr: "Premières mesures enregistrées. Des comparaisons supplémentaires sont nécessaires pour une évaluation fiable.",
          es: "Primeras mediciones registradas. Se necesitan más comparaciones para una evaluación fiable.",
        };
        txt = msgs[lang] || msgs.en;
      } else if (avgMeas < 4) {
        const msgs = {
          de: `Mittlere Datenlage. Mittleres Residuum: ${meanRes.toFixed(1)} dB. Die Anpassungen sind tendenziell verlässlich, aber weitere Messungen verbessern die Genauigkeit.`,
          en: `Moderate data. Mean residual: ${meanRes.toFixed(1)} dB. Adjustments are likely reliable, but more measurements will improve accuracy.`,
          fr: `Données modérées. Résidu moyen: ${meanRes.toFixed(1)} dB. Les corrections sont probablement fiables, mais des mesures supplémentaires améliorent la précision.`,
          es: `Datos moderados. Residuo medio: ${meanRes.toFixed(1)} dB. Los ajustes son probablemente fiables, pero más mediciones mejorarán la precisión.`,
        };
        txt = msgs[lang] || msgs.en;
      } else {
        const msgs = {
          de: `Gute Datenlage. Mittleres Residuum: ${meanRes.toFixed(1)} dB. Mittlere Anpassung: ${rmsLv.toFixed(1)} dB.`,
          en: `Good data. Mean residual: ${meanRes.toFixed(1)} dB. Mean adjustment: ${rmsLv.toFixed(1)} dB.`,
          fr: `Bonnes données. Résidu moyen: ${meanRes.toFixed(1)} dB. Correction moyenne: ${rmsLv.toFixed(1)} dB.`,
          es: `Buenos datos. Residuo medio: ${meanRes.toFixed(1)} dB. Ajuste medio: ${rmsLv.toFixed(1)} dB.`,
        };
        txt = msgs[lang] || msgs.en;
        if (redEls.length) {
          const names = redEls.map((i) => `${dENPrefix()}${dEN(i)}`).join(", ");
          const warn = {
            de: ` Unsichere Messung bei: ${names}. Weitere Testreihen empfohlen.`,
            en: ` Uncertain measurement for: ${names}. Further test runs recommended.`,
            fr: ` Mesure incertaine pour: ${names}. Des séries de tests supplémentaires sont recommandées.`,
            es: ` Medición incierta para: ${names}. Se recomiendan más series de pruebas.`,
          };
          txt += warn[lang] || warn.en;
        } else if (yellEls.length) {
          const names = yellEls.map((i) => `${dENPrefix()}${dEN(i)}`).join(", ");
          const warn = {
            de: ` Grenzwertige Meßqualität bei: ${names}.`,
            en: ` Borderline measurement quality for: ${names}.`,
            fr: ` Qualité de mesure limite pour: ${names}.`,
            es: ` Calidad de medición límite para: ${names}.`,
          };
          txt += warn[lang] || warn.en;
        } else {
          const ok = {
            de: " Alle Elektroden zuverlässig gemessen.",
            en: " All electrodes reliably measured.",
            fr: " Toutes les électrodes mesurées de manière fiable.",
            es: " Todos los electrodos medidos de forma fiable.",
          };
          txt += ok[lang] || ok.en;
        }
      }
      rtEl.textContent = txt;
    }
    th.innerHTML = `<th>${t("thEl")}</th><th>${t("thHz")}</th><th>${t("thOff")}</th><th>${t("thMes")}</th><th title="${t("thResTip")}">${t("thRes")}</th><th>${t("thWgt")}</th><th>${t("thStR")}</th><th>${t("thRefEl")}</th>`;
    for (let i = 0; i < nEl; i++) {
      const tr = document.createElement("tr"),
        v = levels[i],
        ex = elExDur[i] !== null || elSt[i] === "mute";
      let st = "";
      if (ex) {
        st = t("excludedSkipped");
      } else if (elSt[i]) {
        const lb = {
          noisyHeavy: t("stNoisyHeavy"),
          noisyMore: t("stNoisyMore"),
          noisyLess: t("stNoisyLess"),
          almostMute: t("stAlmMute"),
        };
        st = lb[elSt[i]] || "";
      }
      if (elNt[i]) st += (st ? " · " : "") + elNt[i];
      if (ex) {
        tr.style.opacity = "0.4";
      }
      tr.innerHTML = `<td style="font-weight:600">${dENPrefix()}${dEN(i)}</td><td>${Math.round(FRQ_implantatEffektiv(i))}</td><td style="color:${ex ? "#999" : v > 0.05 ? "#2563eb" : v < -0.05 ? "#dc2626" : "#1a1a1a"}">${ex ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1)}</td><td>${pc[i] || "—"}</td><td style="color:${ex ? "#999" : ell_color(i) === "green" ? "#16a34a" : ell_color(i) === "yellow" ? "#d97706" : ell_color(i) === "red" ? "#dc2626" : "#999"}">${ELL_res[i] > 0 ? ELL_res[i].toFixed(1) : "—"}</td><td>${ex ? "—" : ELL_wt[i].toFixed(1)}</td><td style="font-size:.78em">${st}</td><td style="text-align:center;font-weight:700">${i === ELL_refEl ? "X" : ""}</td>`;
      tb.appendChild(tr);
    }
    ELL_drawChart(
      document.getElementById("ELL_resChart"),
      levels,
      ELL_res,
      true,
      ell_color,
      ELL_ctx("global"),
    );
    const chE = document.getElementById("ELL_chartExpl");
    if (chE) chE.textContent = t("ELL_chartExplB");
  }
  const reExp = document.getElementById("ELL_resExplain");
  if (reExp) reExp.textContent = t("ELL_resExplain");
  if (typeof ELL_updFClearBtn === "function") ELL_updFClearBtn();
}


// ============================================================
// FREQ MATCH RESULTS
// ============================================================

// BA353: Zentrale, nach aktivem Verfahren gefilterte Ergebnis-Quelle.
// EINZIGE Stelle, durch die Ergebnisgraph, Player (Warp) und Druck gehen.
// Generisch: vergleicht frq_entryMethod(eintrag) mit dem aktiven Verfahren,
// kennt die Verfahren nicht beim Namen.
function FRQ_activeResults() {
  const method = (typeof frq_getActiveMethod === "function") ? frq_getActiveMethod() : "piano";
  const me = (typeof frq_entryMethod === "function") ? frq_entryMethod : function(r) { return "piano"; };
  return (typeof FRQ_resultsArray !== "undefined" && Array.isArray(FRQ_resultsArray))
    ? FRQ_resultsArray.filter(function(r) { return r && me(r) === method; })
    : [];
}

// Status-Badge-HTML fuer die Reiter-Tabelle. Aus der frueheren Inline-Kaskade
// in FRQ_renderResults ausgelagert (BA423). Nur der Reiter zeigt Status; der
// Audiologen-Ausdruck laesst die Status-Spalte weg (BA424).
function _FRQ_statusBadgeHtml(fmStatus) {
  if (fmStatus === "converged")
    return '<span class="frq-badge frq-badge-ok" data-t="FRQ_resultsStatusOk">' + t("FRQ_resultsStatusOk") + "</span>";
  if (fmStatus === "converged-fair")
    return '<span class="frq-badge frq-badge-fair" data-t="FRQ_resultsStatusFair">' + t("FRQ_resultsStatusFair") + "</span>";
  if (fmStatus === "converged-wide")
    return '<span class="frq-badge frq-badge-wide" data-t="FRQ_resultsStatusWide">' + t("FRQ_resultsStatusWide") + "</span>";
  if (fmStatus === "unstable")
    return '<span class="frq-badge frq-badge-unstable" data-t="FRQ_resultsStatusUnstable">' + t("FRQ_resultsStatusUnstable") + "</span>";
  if (fmStatus === "aborted")
    return '<span class="frq-badge frq-badge-aborted" data-t="FRQ_resultsStatusAborted">' + t("FRQ_resultsStatusAborted") + "</span>";
  if (fmStatus === "not-perceivable")
    return '<span class="frq-badge frq-badge-err" data-t="FRQ_resultsStatusNotPerceivable">' + t("FRQ_resultsStatusNotPerceivable") + "</span>";
  if (fmStatus === "piano")
    return '<span class="frq-badge frq-badge-slider" data-t="FRQ_resultsStatusPiano">' + t("FRQ_resultsStatusPiano") + "</span>";
  if (fmStatus === "piano-crossed")
    return '<span class="frq-badge frq-badge-err" data-t="FRQ_resultsStatusPianoCrossed">' + t("FRQ_resultsStatusPianoCrossed") + "</span>";
  if (fmStatus === "piano-wide")
    return '<span class="frq-badge frq-badge-wide" data-t="FRQ_resultsStatusPianoWide">' + t("FRQ_resultsStatusPianoWide") + "</span>";
  return '<span class="muted">—</span>';
}

// Gemeinsame Zeilen-Quelle der Frequenzabgleich-Tabelle. Liefert je Elektrode
// der ANGEZEIGTEN/gedruckten Seite eine reine Daten-Zeile (keine HTML/MD-
// Formatierung). Genutzt vom Reiter (HTML) und vom Audiologen-Ausdruck/
// Markdown-Export (Markdown, BA424) -- EINE Spalten-/Zahlen-Wahrheit.
//
// opts:
//   side   'left' | 'right'  -- die angezeigte/gedruckte Seite (Pflicht).
//   modus  'left'|'right'|'symmetric' -- Verschiebungs-Verteilung fuer
//          FRQ_werte. Default = Mess-Reiter: FRQ_modusVonReferenzmodus(
//          frq_referenzmodus()). Ausdruck gibt den Player-warpMode.
//   nhSim  bool -- Default false (Mess-Reiter). Ausdruck gibt plNHSim.
//
// Rueckgabe: Array in Elektroden-Reihenfolge der Seite, je Eintrag:
//   { elIdx, elLabel,
//     kind: 'notActive' | 'notMeasured' | 'data',
//     nominellHz|null, gehoertHz|null, diffHz|null, diffCent|null,
//     residuum|null, isNotPerceivable, fmStatus|null,
//     bandLoHz|null, bandHiHz|null, bandOverlap, bandOverlapEls }
// kind='notActive'  -> NICHT aktive Elektrode (elActive===false, vom
//                      Audiologen abgeschaltet). Nicht existent -> kein Band,
//                      Nachbarn ruecken zusammen (BA433-Fix, §9.5).
// kind='notMeasured'-> keine Messung fuer diese Elektrode.
// kind='data'       -> Aktive Elektrode (auch stumm/ausgeschlossen/ungemessen):
//                      Felder gefuellt; einzelne koennen null sein, wenn
//                      ungemessen. Band via nomineller Mitte, wenn ungemessen.
function FRQ_tabellenZeilen(opts) {
  opts = opts || {};
  const side = (opts.side === "left" || opts.side === "right")
    ? opts.side
    : ((typeof activeSide === "string") ? activeSide
       : (sideData.left.config === "ci" ? "left" : "right"));
  const modus = (typeof opts.modus === "string")
    ? opts.modus
    : FRQ_modusVonReferenzmodus(frq_referenzmodus());
  const nhSim = !!opts.nhSim;

  const displayData = (typeof FRQ_activeResults === "function") ? FRQ_activeResults() : [];
  const frqWerte = FRQ_werte("gehoert", modus, nhSim);
  const werteByIdx = {};
  for (const wr of frqWerte) werteByIdx[wr.elIdx] = wr;
  const byIdx = {};
  for (const r of displayData) byIdx[r.elIdx] = r;

  const rows = [];
  const nCi = sideData[side].nEl;
  for (let i = 0; i < nCi; i++) {
    const elLabel = dENPrefix(side) + dEN(i, side);
    const r = byIdx[i];
    // BA433-Fix (§9.5): Nur NICHT AKTIVE Elektroden (elActive===false,
    // vom Audiologen abgeschaltet) fallen aus der Tabelle als "nicht
    // existent" -> kind "notActive", kein Band. Stumme/ausgeschlossene
    // Elektroden sind AKTIV -> normale Datenzeile MIT Band (nominelle
    // Mitte), Wahrnehmung/Diff "—" wenn ungemessen.
    if (sideData[side].elActive && sideData[side].elActive[i] === false) {
      rows.push({ elIdx: i, elLabel, kind: "notActive",
        nominellHz: null, gehoertHz: null, diffHz: null, diffCent: null,
        residuum: null, isNotPerceivable: false, fmStatus: null,
        bandLoHz: null, bandHiHz: null, bandOverlap: false, bandOverlapEls: [] });
      continue;
    }
    // Aktive Elektrode: Werte aus der Wertquelle holen (auch ungemessene
    // bekommen dort ein Band via nomineller Mitte). wr existiert je
    // Elektrode der beidseitigen Menge; r (Messeintrag) kann fehlen.
    const wr    = werteByIdx[i];
    const wSide = wr ? wr[side] : null;
    const isNotPerc = (r && r.fmStatus === "not-perceivable");
    let nominellHz = null, gehoertHz = null, diffHz = null, diffCent = null;
    if (wSide && wSide.nominellHz != null) nominellHz = wSide.nominellHz;
    if (wSide && wSide.gehoertHz != null && wSide.shiftCent != null) {
      gehoertHz = wSide.gehoertHz;
      diffHz    = wSide.shiftHz;
      diffCent  = wSide.shiftCent;
    }
    const residuum = (wSide && wSide.residuum != null && !isNotPerc)
      ? wSide.residuum : null;
    // BA433: Band-Felder aus der Wertquelle durchreichen.
    const bandLoHz  = wSide ? (wSide.bandLoHz != null ? wSide.bandLoHz : null) : null;
    const bandHiHz  = wSide ? (wSide.bandHiHz != null ? wSide.bandHiHz : null) : null;
    const bandOverlap = !!(wSide && wSide.bandOverlap);
    const bandOverlapEls = (wSide && wSide.bandOverlapEls) ? wSide.bandOverlapEls : [];
    rows.push({ elIdx: i, elLabel, kind: "data",
      nominellHz, gehoertHz, diffHz, diffCent, residuum,
      bandLoHz, bandHiHz, bandOverlap, bandOverlapEls,
      isNotPerceivable: isNotPerc, fmStatus: (r && r.fmStatus) || null });
  }
  return rows;
}

function FRQ_renderResults() {
  const noData = document.getElementById("FRQ_resultsNoData");
  const card = document.getElementById("FRQ_resultsCard");
  if (!noData || !card) return;

  // Bezug = aktive (angezeigte) Seite.
  const aktivSide = (typeof activeSide === "string") ? activeSide
    : (sideData.left.config === 'ci' ? 'left' : 'right');

  if (typeof FRQ_resultsArray === "undefined" || FRQ_resultsArray.length === 0) {
    noData.style.display = "";
    card.style.display = "none";
    return;
  }
  noData.style.display = "none";
  card.style.display = "";
  // BA353: Umschalter-Hervorhebung aktualisieren.
  if (typeof frq_updateActiveMethodButtons === "function") frq_updateActiveMethodButtons();

  // BA353: Anzeige-Daten: aktives Verfahren.
  const displayData = (typeof FRQ_activeResults === "function") ? FRQ_activeResults() : [];

  // Titel
  const titleEl = document.getElementById("FRQ_resultsTitle");
  if (titleEl) titleEl.textContent = t("FRQ_resultsTitle");

  // Methoden-Hinweis
  const noteEl = document.getElementById("FRQ_resultsMethodNote");
  if (noteEl) noteEl.textContent = t("FRQ_resultsMethodNote");

  // Meta-Zeile
  const metaEl = document.getElementById("FRQ_resultsMeta");
  if (metaEl) {
    const finalCount = displayData.length;
    const last = finalCount > 0 ? displayData.slice(-1)[0] : null;
    let metaText = '';
    if (last) {
      const d = new Date(last.timestamp);
      const dateStr = d.toLocaleString(
        lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US"
      );
      metaText = dateStr + " · " + finalCount + " Messpunkte";
    }
    metaEl.textContent = metaText;
  }

  const varLabel = aktivSide === 'left' ? t('sideLeft')  : t('sideRight');

  // Tabellen-Header
  const th = document.getElementById("FRQ_resultsTableHead");
  const tb = document.getElementById("FRQ_resultsTableBody");
  if (!th || !tb) return;

  th.innerHTML =
    "<th>" + t("FRQ_resultsColEl") + "</th>" +
    "<th>" + t("FRQ_resultsColNominalHz") + "</th>" +
    "<th>" + t("FRQ_resultsColPerceivedHz") + "</th>" +
    "<th>" + t("FRQ_resultsColBand") + "</th>" +
    "<th>" + t("FRQ_resultsColDiffHz") + "</th>" +
    "<th>" + t("FRQ_resultsColDiffCent") + "</th>" +
    "<th title=\"" + t("FRQ_resultsColResiduumTip") + "\">" + t("FRQ_resultsColResiduum") + "</th>" +
    "<th>" + t("FRQ_resultsColStatus") + "</th>";

  // BA420: Seitenangabe statt Referenz-/Zielseiten-Erklärung. {side} = die
  // angezeigte Seite (LINKS/RECHTS-Umschalter).
  const descEl = document.getElementById("FRQ_resultsSidesDescription");
  if (descEl) {
    const line1 = t("FRQ_resultsSidesDescription1").replace('{side}', varLabel);
    descEl.innerHTML =
      "<p style=\"font-weight:600;margin:0\">" + line1 + "</p>";
  }

  // BA423: Zeilen aus der gemeinsamen Quelle (dieselbe wie Ausdruck/Export).
  // Hier nur noch HTML-Formatierung, keine Werte-Rechnung mehr.
  const zeilen = FRQ_tabellenZeilen({ side: aktivSide });
  const grey = "color:#9ca3af";
  const dash = '<span style="' + grey + '">—</span>';
  tb.innerHTML = "";
  for (const z of zeilen) {
    const tr = document.createElement("tr");
    if (z.kind === "notActive") {
      // BA433-Fix: nur elActive===false. Ausgegraut, kein Band.
      tr.style.opacity = "0.4";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
        "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>" +
        "<td style=\"font-size:.82em\">" + t("FRQ_resultsStatusNotActive") + "</td>";
      tb.appendChild(tr);
      continue;
    }
    if (z.kind === "notMeasured") {
      const note = '<span style="font-size:.82em;color:#9ca3af">' + t("notMeasured") + "</span>";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
        "<td style=\"" + grey + "\">—</td>".repeat(6) +
        "<td>" + note + "</td>";
      tb.appendChild(tr);
      continue;
    }
    // kind === "data"
    let nomHzCell, percHzCell, diffHzCell, diffCtCell;
    if (z.gehoertHz == null || z.diffCent == null) {
      nomHzCell  = (z.nominellHz != null) ? z.nominellHz.toFixed(2) : dash;
      percHzCell = dash; diffHzCell = dash; diffCtCell = dash;
    } else {
      const diffColor = z.diffHz >= 0 ? "#2563eb" : "#dc2626";
      nomHzCell  = z.nominellHz.toFixed(2);
      percHzCell = z.gehoertHz.toFixed(2);
      diffHzCell = "<span style=\"color:" + diffColor + "\">"
                 + (z.diffHz >= 0 ? "+" : "") + z.diffHz.toFixed(2) + "</span>";
      diffCtCell = "<span style=\"color:" + diffColor + "\">"
                 + (z.diffCent >= 0 ? "+" : "") + fmtNum(z.diffCent, "cent") + "</span>";
    }
    // BA433: Bandempfehlung-Zelle. Ueberlauf -> Warndreieck; sonst
    // "lo - hi Hz" (2 NK, fmtNum) oder "—" wenn keine Grenzen.
    let bandCell;
    if (z.bandOverlap) {
      bandCell = "<span title=\"" + t("FRQ_bandOverlapCellTip")
               + "\" style=\"color:#dc2626;font-weight:700\">⚠</span>";
    } else if (z.bandLoHz != null && z.bandHiHz != null) {
      bandCell = fmtNum(z.bandLoHz, "hz") + " - " + fmtNum(z.bandHiHz, "hz") + " Hz";
    } else {
      bandCell = dash;
    }
    let residuumCell;
    if (z.residuum == null) {
      residuumCell = dash;
    } else {
      const re = Math.round(z.residuum);
      const reColor = re <= 10 ? "#16a34a" : re <= 25 ? "#d97706" : "#dc2626";
      residuumCell = '<span style="color:' + reColor + ';font-weight:600">±' + re + ' ct</span>';
    }
    tr.innerHTML =
      "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
      "<td>" + nomHzCell + "</td>" +
      "<td>" + percHzCell + "</td>" +
      "<td>" + bandCell + "</td>" +
      "<td>" + diffHzCell + "</td>" +
      "<td>" + diffCtCell + "</td>" +
      "<td>" + residuumCell + "</td>" +
      "<td>" + (z.fmStatus
        ? _FRQ_statusBadgeHtml(z.fmStatus)
        : '<span style="font-size:.82em;color:#9ca3af">' + t("notMeasured") + "</span>")
        + "</td>";
    tb.appendChild(tr);
  }

  // Qualitätstext
  const qEl = document.getElementById('FRQ_resultsQualityText');
  if (qEl) {
    const finalEntries = (typeof FRQ_activeResults === "function") ? FRQ_activeResults() : [];
    const nElTotal = sideData[aktivSide].nEl;
    const nExcluded = sideData[aktivSide].elExDur.filter(function(v) { return v !== null; }).length
                    + sideData[aktivSide].elSt.filter(function(s) { return s === 'mute'; }).length;
    const totalActive = nElTotal - nExcluded;

    let txt = '';
    if (finalEntries.length === 0) {
      txt = '';
    } else if (finalEntries.length < totalActive) {
      const resVals = finalEntries
        .filter(function(r) { return r.fmResidual != null; })
        .map(function(r) { return r.fmResidual; });
      const meanRes = resVals.length > 0
        ? resVals.reduce(function(s, v) { return s + v; }, 0) / resVals.length
        : 0;
      txt = t('FRQ_resultsQualityPartial')
        .replace('{done}', finalEntries.length)
        .replace('{total}', totalActive)
        .replace('{res}', meanRes.toFixed(1));
    } else {
      var _pianoRun = (FRQ_pianoSession && FRQ_pianoSession.run) || null;
      if (_pianoRun && _pianoRun.currentRound >= 1) {
        var _pTot = (typeof FM_PIANO_STEPS !== "undefined") ? FM_PIANO_STEPS.length : 6;
        var _pRound = _pianoRun.currentRound;
        var _pStep  = (typeof FM_PIANO_STEPS !== "undefined")
          ? FM_PIANO_STEPS[_pRound - 1] : null;
        if (_pStep != null) {
          txt = t('FRQ_resultsQualityPiano')
            .replace('{round}', _pRound)
            .replace('{total}', _pTot)
            .replace('{step}', _pStep);
        }
      }
    }
    qEl.textContent = txt;
    qEl.style.display = txt ? '' : 'none';
  }

  // Chart
  const cv = document.getElementById("FRQ_resultsChart");
  if (cv) {
    drawFRQChart(cv, displayData);
    // Tooltip-Listener einmalig anhängen
    if (!cv._frq_chartListenerAttached) {
      cv.addEventListener("mousemove", (e) => _frq_chartTooltipHandler(cv, e));
      cv.addEventListener("mouseleave", () => {
        const tip = document.getElementById("frq_chartTooltip");
        if (tip) tip.style.display = "none";
      });
      cv._frq_chartListenerAttached = true;
    }
  }

  // Chart-Hinweise
  const hintEl = document.getElementById("FRQ_resultsChartHint");
  if (hintEl) {
    hintEl.textContent = t("FRQ_resultsChartHintPiano");
  }

  // BA433: Textblöcke unter der Tabelle (Reihenfolge §9.8a).
  _FRQ_renderBandNotes(aktivSide, zeilen);
}

// BA433: Bandempfehlung-Texte unter der Tabelle. Reihenfolge:
// 1) Ueberlauf-Warnung (nur wenn Overlap), 2) Erklaertext (immer),
// 3) Rand-Hinweis Block1 (immer) + Block2 (nur MED-EL/Cochlear).
function _FRQ_renderBandNotes(side, zeilen) {
  const box = document.getElementById("FRQ_resultsBandNotes");
  if (!box) return;
  const parts = [];

  // 1) Ueberlauf-Warnung: welche Elektroden ueberkreuzen?
  let overlapEls = [];
  for (const z of zeilen) {
    if (z.bandOverlap && z.bandOverlapEls && z.bandOverlapEls.length) {
      overlapEls = z.bandOverlapEls; break;
    }
  }
  if (overlapEls.length) {
    const labels = overlapEls.map(function (idx) {
      return dENPrefix(side) + dEN(idx, side);
    }).join(", ");
    parts.push(
      "<p style=\"color:#dc2626;font-weight:600;margin:0 0 8px\">⚠ "
      + t("FRQ_bandOverlapNote").replace("{els}", labels) + "</p>");
  }

  // 2) Erklaertext (immer)
  parts.push("<p style=\"margin:0 0 8px\">" + t("FRQ_bandExplain") + "</p>");

  // 3) Rand-Hinweis Block1 (immer) + Block2 (nur mit defaultRange)
  parts.push(_FRQ_randHinweisHtml(side));

  box.innerHTML = parts.join("");
}

// Rand-Hinweis Block1 (Cent-Tabelle MED-EL/Cochlear) + Block2 (apikale
// aktive Elektrode, nur wenn Implantat-Hersteller MED-EL oder Cochlear).
function _FRQ_randHinweisHtml(side) {
  const medel = FRQ_randAbweichungCent("medel");
  const coch  = FRQ_randAbweichungCent("cochlear");
  let html = "<p style=\"margin:0 0 8px\">" + t("FRQ_randHinweisIntro") + "</p>";
  const thS = "text-align:right;padding:3px 10px;border-bottom:1px solid var(--border);font-weight:600";
  const thL = "text-align:left;padding:3px 10px;border-bottom:1px solid var(--border);font-weight:600";
  const tdL = "text-align:left;padding:3px 10px;font-weight:600";
  const tdR = "text-align:right;padding:3px 10px;font-variant-numeric:tabular-nums";
  html += "<table style=\"border-collapse:collapse;margin:0 0 10px;font-size:0.9em\">"
    + "<thead><tr>"
    + "<th style=\"" + thL + "\"></th>"
    + "<th style=\"" + thS + "\">" + t("FRQ_randCol1") + "</th>"
    + "<th style=\"" + thS + "\">" + t("FRQ_randCol2") + "</th>"
    + "</tr></thead><tbody>"
    + "<tr><td style=\"" + tdL + "\">MED-EL</td>"
    + "<td style=\"" + tdR + "\">" + fmtNum(medel.untenCent, "cent") + " cent</td>"
    + "<td style=\"" + tdR + "\">" + fmtNum(medel.obenCent, "cent") + " cent</td></tr>"
    + "<tr><td style=\"" + tdL + "\">Cochlear</td>"
    + "<td style=\"" + tdR + "\">" + fmtNum(coch.untenCent, "cent") + " cent</td>"
    + "<td style=\"" + tdR + "\">" + fmtNum(coch.obenCent, "cent") + " cent</td></tr>"
    + "</tbody></table>";
  html += "<p style=\"margin:0 0 8px\">" + t("FRQ_randHinweisOutro") + "</p>";

  // Block2: nur wenn der Hersteller DIESER Seite bekannte Grenzen hat.
  const mfrKey = sideData[side] ? sideData[side].manufacturer : null;
  const abw = mfrKey ? FRQ_randAbweichungCent(mfrKey) : null;
  if (abw) {
    const z2 = _FRQ_apikalBandKorrigiert(side, abw.untenCent);
    if (z2) {
      html += "<p style=\"margin:8px 0 0\">" + t("FRQ_randBlock2Intro") + "<br>"
        + z2.label + ": " + fmtNum(z2.loHz, "hz") + " Hz - "
        + fmtNum(z2.hiHz, "hz") + " Hz</p>";
    }
  }
  return html;
}

// Ermittelt die apikale AKTIVE Elektrode dieser Seite und liefert ihr
// Band mit nach unten korrigierter Untergrenze (Cent-Abweichung).
// Apikal = tiefste Frequenz. apFirst=true -> niedrigster elIdx;
// apFirst=false -> hoechster elIdx. Deaktivierte (elActive===false)
// werden uebersprungen. Rueckgabe {label, loHz, hiHz} | null.
function _FRQ_apikalBandKorrigiert(side, untenCent) {
  const werte = (typeof FRQ_werte === "function")
    ? FRQ_werte("gehoert", FRQ_modusVonReferenzmodus(frq_referenzmodus()), false) : [];
  const s = sideData[side];
  if (!s) return null;
  const me = MFR[s.manufacturer];
  const apFirst = me ? me.apFirst : true;
  // Reihenfolge apikal->basal: apFirst -> aufsteigender elIdx.
  const order = werte.map(function (w) { return w.elIdx; });
  order.sort(function (a, b) { return apFirst ? a - b : b - a; });
  for (const idx of order) {
    const w = werte.find(function (x) { return x.elIdx === idx; });
    const ws = w ? w[side] : null;
    if (!ws || !ws.aktiv) continue;              // apikalste AKTIVE
    if (ws.bandLoHz == null || ws.bandHiHz == null) return null; // kein Band
    return {
      label: dENPrefix(side) + dEN(idx, side),
      loHz:  ws.bandLoHz * Math.pow(2, untenCent / 1200),   // nach unten korrigiert
      hiHz:  ws.bandHiHz,                                    // obere unveraendert
    };
  }
  return null;
}

document.addEventListener("DOMContentLoaded", function() {
  function _frq_resultsRefreshAfterClear() {
    if (typeof depLockApply === 'function') depLockApply();
    FRQ_renderResults();
  }

  const allBtn = document.getElementById("FRQ_resultsClearAllBtn");
  if (allBtn) {
    allBtn.addEventListener("click", function() {
      if (!confirm(t("FRQ_resultsClearAllConfirm") || "Alle löschen?")) return;
      FRQ_resultsArray.splice(0, FRQ_resultsArray.length);
      _frq_resultsRefreshAfterClear();
    });
  }

  // BA364: Klavier-Loeschbutton — entfernt nur piano-Eintraege aus FRQ_resultsArray.
  const pianoBtn = document.getElementById("FRQ_resultsClearPianoBtn");
  if (pianoBtn) {
    pianoBtn.addEventListener("click", function() {
      if (!confirm(t("FRQ_resultsClearPianoConfirm") || "Klavier-Ergebnisse loeschen?")) return;
      for (let i = FRQ_resultsArray.length - 1; i >= 0; i--) {
        if (FRQ_resultsArray[i] && frq_entryMethod(FRQ_resultsArray[i]) === "piano") FRQ_resultsArray.splice(i, 1);
      }
      FRQ_pianoSession = null;
      _frq_resultsRefreshAfterClear();
    });
  }
});
