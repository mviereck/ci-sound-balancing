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

// EINE Wahrheit fuer fmStatus -> {key, cls}. key = i18n-Schluessel des
// Statustexts, cls = Badge-CSS-Klasse (nur Reiter). Reiter (Badge-HTML) und
// Audiologen-Ausdruck (Klartext, BA424-Umkehr 435.1) gehen beide hier durch,
// damit Reiter und Ausdruck denselben Statustext zeigen.
// "not-perceivable" entfernt (vom Klaviertest nicht mehr erzeugt, 435.1).
const _FRQ_STATUS_MAP = {
  "converged":       { key: "FRQ_resultsStatusOk",       cls: "frq-badge-ok" },
  "converged-fair":  { key: "FRQ_resultsStatusFair",     cls: "frq-badge-fair" },
  "converged-wide":  { key: "FRQ_resultsStatusWide",     cls: "frq-badge-wide" },
  "unstable":        { key: "FRQ_resultsStatusUnstable", cls: "frq-badge-unstable" },
  "aborted":         { key: "FRQ_resultsStatusAborted",  cls: "frq-badge-aborted" },
  "piano":           { key: "FRQ_resultsStatusPiano",        cls: "frq-badge-ok" },
  "piano-crossed":   { key: "FRQ_resultsStatusPianoCrossed", cls: "frq-badge-err" },
  "piano-wide":      { key: "FRQ_resultsStatusPianoWide",    cls: "frq-badge-wide" },
};

// Reiner Statustext (Klartext) fuer einen fmStatus. Genutzt vom Ausdruck.
function _FRQ_statusText(fmStatus) {
  const m = _FRQ_STATUS_MAP[fmStatus];
  return m ? t(m.key) : "—";
}

// Status-Badge-HTML fuer die Reiter-Tabelle.
function _FRQ_statusBadgeHtml(fmStatus) {
  const m = _FRQ_STATUS_MAP[fmStatus];
  if (!m) return '<span class="muted">—</span>';
  return '<span class="frq-badge ' + m.cls + '" data-t="' + m.key + '">'
    + t(m.key) + "</span>";
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
      // Nachbesserung 435.1: Deaktivierte Elektrode erscheint MIT nomineller
      // Standardfrequenz (ausgegraut), Status "deaktiviert". Nominalwert aus
      // der Wertquelle dieser Seite (FRQ_implantatEffektiv mit srcData=Seite).
      const nomDeact = (typeof FRQ_implantatEffektiv === "function")
        ? FRQ_implantatEffektiv(i, sideData[side]) : null;
      rows.push({ elIdx: i, elLabel, kind: "notActive",
        nominellHz: (nomDeact != null ? nomDeact : null),
        gehoertHz: null, diffHz: null, diffCent: null,
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

// Nachbesserung 435.1: HTML der Graph-Legende. Einleitungssatz + dreispaltige
// Tabelle. Jede Zeile FRQ_chartLegendRowN = "Begriff|Wert|Erklaerung".
// Die zwei "="-Zeichen entstehen als eigene schmale Spalten, wodurch sie
// untereinander stehen (Ausrichtung durch die Tabellenstruktur).
function _FRQ_chartLegendHtml() {
  const intro = t("FRQ_chartLegendIntro");
  const eqCell = "<td style=\"padding:0 6px;color:#374151\">=</td>";
  let rows = "";
  for (let n = 1; n <= 7; n++) {
    const raw = t("FRQ_chartLegendRow" + n);
    if (!raw || raw === "FRQ_chartLegendRow" + n) continue;
    const parts = raw.split("|");
    const begriff = parts[0] || "";
    const wert    = parts[1] || "";
    const erkl    = parts[2] || "";
    rows +=
      "<tr>" +
      "<td style=\"padding:1px 0;white-space:nowrap;font-weight:600\">" + begriff + "</td>" +
      eqCell +
      "<td style=\"padding:1px 0;white-space:nowrap\">" + wert + "</td>" +
      eqCell +
      "<td style=\"padding:1px 0\">" + erkl + "</td>" +
      "</tr>";
  }
  return "<p style=\"margin:0 0 6px\">" + intro + "</p>" +
    "<table style=\"border-collapse:collapse;font-size:1em\"><tbody>" + rows + "</tbody></table>";
}

// BA459: Zeilen-Modell fuer den Ergebnis-Frequenzgraphen (gehoerte
// Verschiebung). EINE Quelle fuer Reiter UND Ausdruck -> kein
// doppelter Modell-Bau. side = Anzeigeseite; opts.modus/opts.nhSim
// erlauben dem Ausdruck, Player-warpMode + NH-Sim vorzugeben.
// Rueckgabe: rows[] fuer drawFRQGraph.
function FRQ_ergebnisRows(side, opts) {
  opts = opts || {};
  var fResData = (typeof FRQ_activeResults === "function") ? FRQ_activeResults() : [];
  var measuredByIdx = {};
  for (var m = 0; m < fResData.length; m++) measuredByIdx[fResData[m].elIdx] = fResData[m];

  var modus = (typeof opts.modus === "string") ? opts.modus
    : FRQ_modusVonReferenzmodus(frq_referenzmodus());
  var werte = FRQ_werte("gehoert", modus, !!opts.nhSim);

  var tipT = function (k, fb) {
    if (typeof t !== "function") return fb;
    var v = t(k); return (v && v !== k) ? v : fb;
  };
  var NB = " ";  // schmales geschuetztes Leerzeichen

  var rows = [];
  for (var j = 0; j < werte.length; j++) {
    var wr = werte[j];
    var seite = wr[side];
    var r = measuredByIdx[wr.elIdx];
    var elNum = dEN(wr.elIdx, side);
    var hzIst = seite.nominellHz;
    var hzSoll = seite.gehoertHz;         // null wenn ungemessen
    var dc = seite.shiftCent;             // null wenn ungemessen
    var resid = (seite.residuum != null) ? seite.residuum : 0;
    var isMeasured = !!r;
    var fmStatus = r ? (r.fmStatus || "converged") : null;
    var warn = (fmStatus === "piano-crossed" || fmStatus === "piano-wide");

    // Sichtbarkeit: elActive===false -> unsichtbar (wie Bandgraph/Sec.9.5).
    var sichtbar = !(sideData[side].elActive && sideData[side].elActive[wr.elIdx] === false);

    var tooltip;
    var marker = null;
    if (!isMeasured) {
      // ungemessen: Marker "ausgeschlossen" (nicht testbar) oder "offen".
      marker = wr.deaktiviert ? "ausgeschlossen" : "offen";
      tooltip = ["<b>E" + elNum + "</b>",
                 Math.round(hzIst) + " Hz",
                 tipT("notMeasured", "nicht gemessen")];
    } else {
      var istC = 1200 * Math.log2(hzIst / 1000);
      var sollC = 1200 * Math.log2(hzSoll / 1000);
      var cIstTxt = (istC >= 0 ? "+" : "") + Math.round(istC) + NB + "ct";
      var cSollTxt = (sollC >= 0 ? "+" : "") + Math.round(sollC) + NB + "ct";
      tooltip = ["<b>E" + elNum + "</b>",
                 Math.round(hzIst) + NB + "Hz → " + Math.round(hzSoll) + NB + "Hz",
                 cIstTxt + " → " + cSollTxt];
      if (resid > 0) {
        tooltip.push(tipT("FRQ_resultsTipResidual", "Restunsicherheit") + " ±"
          + Math.round(resid) + NB + "ct");
      }
      if (fmStatus === "piano-crossed") {
        tooltip.push("⚠️ " + tipT("FRQ_resultsTipPianoCrossed",
          "Grenzen vertauscht – Wert unsicher"));
      } else if (fmStatus === "piano-wide") {
        tooltip.push("⚠️ " + tipT("FRQ_resultsTipPianoWide",
          "Unsicherheit sehr groß"));
      }
    }

    rows.push({
      elNum: elNum,
      xLinksHz: hzIst,
      xRechtsHz: (hzSoll != null) ? hzSoll : hzIst,   // ungemessen: Fallback Ist
      yCent: (isMeasured && dc != null) ? dc : null,
      residuumCent: resid,
      bandLoHz: null, bandHiHz: null,     // Ergebnisgraph hat keine Baender
      sichtbar: sichtbar,
      warn: warn,
      stufe: warn ? "rot" : "gruen",   // Ergebnisgraph: gruen, rot nur bei Warnung
      marker: marker,                     // nur bei ungemessen gesetzt
      tooltip: tooltip
    });
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
      // Nachbesserung 435.1: Nominalfrequenz ausgegraut anzeigen, alle
      // anderen Spalten "—", Status "deaktiviert". (Zeile nicht mehr
      // pauschal transparent — nur die Nominal-Zelle ist grau.)
      const nomCell = (z.nominellHz != null)
        ? "<span style=\"" + grey + "\">" + z.nominellHz.toFixed(2) + "</span>"
        : "—";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
        "<td>" + nomCell + "</td>" +
        "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>" +
        "<td style=\"font-size:.82em\">" + t("FRQ_resultsStatusNotActive") + "</td>";
      tb.appendChild(tr);
      continue;
    }
    if (z.kind === "notMeasured") {
      // Nachbesserung 435.1: "nicht gemessen" in schwarzer Schrift.
      const note = '<span style="font-size:.82em">' + t("notMeasured") + "</span>";
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
      // Nachbesserung 435.1: Diff-Spalten schwarz, keine +/-Farbunterscheidung
      // mehr. Vorzeichen bleibt erhalten (schwarze Tabellenschrift).
      nomHzCell  = z.nominellHz.toFixed(2);
      percHzCell = z.gehoertHz.toFixed(2);
      diffHzCell = (z.diffHz >= 0 ? "+" : "") + z.diffHz.toFixed(2);
      diffCtCell = (z.diffCent >= 0 ? "+" : "") + fmtNum(z.diffCent, "cent");
    }
    let residuumCell;
    if (z.residuum == null) {
      residuumCell = dash;
    } else {
      const re = Math.round(z.residuum);
      // Nachbesserung 435.1: 0..25 ct grün, 25..100 ct orange, >100 ct rot.
      const reColor = re <= 25 ? "#16a34a" : re <= 100 ? "#d97706" : "#dc2626";
      residuumCell = '<span style="color:' + reColor + ';font-weight:600">±' + re + ' ct</span>';
    }
    tr.innerHTML =
      "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
      "<td>" + nomHzCell + "</td>" +
      "<td>" + percHzCell + "</td>" +
      "<td>" + diffHzCell + "</td>" +
      "<td>" + diffCtCell + "</td>" +
      "<td>" + residuumCell + "</td>" +
      "<td>" + (z.fmStatus
        ? _FRQ_statusBadgeHtml(z.fmStatus)
        : '<span style="font-size:.82em">' + t("notMeasured") + "</span>")
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
    const _rows = FRQ_ergebnisRows(aktivSide, {});
    const _wand = (typeof mfr === "string" && MFR[mfr] && MFR[mfr].defaultRange
      && MFR[mfr].defaultRange.length === 2) ? MFR[mfr].defaultRange : null;
    drawFRQGraph(cv, _rows, {
      residuumAnker: "punkt",
      amberband: true,
      xWandHz: _wand,
      yLabel: t("FRQ_resultsChartYLabel"),
      verbindung: true
      // KEIN schwelleCent -> zweistufig gruen/rot (Ergebnisgraph)
    });
    if (!cv._frqg_listener) {
      cv.addEventListener("mousemove", (e) => _frqg_tooltipHandler(cv, e));
      cv.addEventListener("mouseleave", () => {
        const tip = document.getElementById("frqg_tooltip");
        if (tip) tip.style.display = "none";
      });
      cv._frqg_listener = true;
    }
  }

  // Chart-Legende (Nachbesserung 435.1): Einleitungssatz + dreispaltige
  // Tabelle (Begriff = Wert = Erklaerung, je zwei "="), an den "="-Spalten
  // ausgerichtet. Jede Zeile aus einem i18n-Key mit "|"-getrennten Teilen.
  const hintEl = document.getElementById("FRQ_resultsChartHint");
  if (hintEl) {
    hintEl.innerHTML = _FRQ_chartLegendHtml();
  }

  _FRQ_renderBandEmpf(aktivSide);
}

// BA445: Bandgrenzen-Empfehlungs-Tabelle (Architektur Sec. 12.3/12.5).
// Reiner Konsument von FRQ_werte -- Verfahren + Topologie = global gewaehlt
// (Defaults in FRQ_werte). Zeilen = aktive Elektroden der angezeigten Seite.
// Bei lueckig/ueberlappend ist die Center-Abweichung konstruktionsbedingt 0
// (Center == gehoerte Frequenz) -> Bewertung dort immer "im Rauschen" (Sec.
// 12.5, Variante 4a: Spalten konsistent, nicht topologie-abhaengig anders).
var FRQ_bandEmpfSchwelleCent = 30;   // leicht<->deutlich (Startwert, Sec. 12.5)

// BA452: EINZIGE Empfehlungs-Wertquelle fuer Tabelle UND Graph.
// Leitet die Band-Achsen-Wahl an EINER Stelle ab (vorher doppelt in
// results.js + chart.js -> BA451-Divergenz). Verfahren/Topologie zieht
// FRQ_werte selbst aus den globalen Wahlen (core.js:931-934); Optimieren/
// Ziel/Randausgleich liest FRQ_werte NICHT selbst (core.js:938) -> hier
// ableiten und explizit uebergeben.
//   nhSim         bool -- Normalhoerenden-Simulation (Tabelle: false,
//                 Graph: !!opts.nhSim). PFLICHT-Parameter, kein Default.
//   modusOverride optional -- der Graph reicht opts.modus durch; fehlt es,
//                 wird der Modus wie in der Tabelle aus dem Referenzmodus
//                 abgeleitet.
// Rueckgabe: das FRQ_werte-Array (leer, wenn FRQ_werte fehlt).
function FRQ_empfWerte(nhSim, modusOverride) {
  var modus = (typeof modusOverride === "string")
    ? modusOverride
    : FRQ_modusVonReferenzmodus(frq_referenzmodus());
  var _opt = (typeof FRQ_bandOptimierenWahl !== "undefined")
    && FRQ_bandOptimierenWahl === "optimiert";
  var _ziel = (typeof FRQ_bandZielWahl !== "undefined") ? FRQ_bandZielWahl : "minimax";
  var _rand = (typeof FRQ_bandRandausgleichWahl !== "undefined")
    ? FRQ_bandRandausgleichWahl : "mit";
  return (typeof FRQ_werte === "function")
    ? FRQ_werte("gehoert", modus, !!nhSim, undefined, undefined, _opt, _ziel, _rand !== "ohne")
    : [];
}

function _FRQ_renderBandEmpf(side) {
  var head = document.getElementById("FRQ_bandEmpfTableHead");
  var body = document.getElementById("FRQ_bandEmpfTableBody");
  var note = document.getElementById("FRQ_bandEmpfOverlapNote");
  if (!head || !body) return;

  // BA458: Empfehlungs-Graph gegen die gemeinsame Engine drawFRQGraph.
  // rows aus derselben Wertquelle wie die Tabelle unten (FRQ_empfWerte),
  // damit Graph und Tabelle nie divergieren (vgl. BA452).
  var _bcv = document.getElementById("FRQ_bandEmpfChart");
  if (_bcv && typeof drawFRQGraph === "function") {
    var _werte = FRQ_empfWerte(false);
    var _rows = [];
    var _nCi = sideData[side].nEl;
    for (var _i = 0; _i < _nCi; _i++) {
      // elActive===false: komplett abgeschaltet -> unsichtbar (Sec. 9.5).
      if (sideData[side].elActive && sideData[side].elActive[_i] === false) continue;
      var _w = null;
      for (var _k = 0; _k < _werte.length; _k++) {
        if (_werte[_k].elIdx === _i) { _w = _werte[_k]; break; }
      }
      var _ws = _w ? _w[side] : null;
      if (!_ws) continue;
      // Nur El. mit vollstaendigem Band erscheinen (Ueberlauf/kein Band raus).
      if (_ws.bandLoHz == null || _ws.bandHiHz == null || _ws.bandCenterHz == null) continue;
      var _target = (_ws.gehoertHz != null) ? _ws.gehoertHz : _ws.nominellHz;
      if (_target == null) continue;
      var _center = _ws.bandCenterHz;
      var _resid = (_ws.residuum != null) ? _ws.residuum : 0;
      // Abweichung erreicht-gehoert in Cent (wie Tabelle results.js:668-669).
      var _dev = 1200 * Math.log2(_center / _target);
      var _elNum = dEN(_i, side);
      // Bewertungsstufe zentral (core.js); Text + Graph-Farbe aus derselben Stufe.
      var _stufe = FRQ_bewertungsStufe(_dev, _resid);
      var _bew = (_stufe === "gruen") ? t("FRQ_bandEmpfRatingNoise")
               : (_stufe === "amber") ? t("FRQ_bandEmpfRatingSlight")
               : t("FRQ_bandEmpfRatingClear");
      var _devTxt = (_dev >= 0 ? "+" : "") + fmtNum(_dev, "cent") + " ct";
      _rows.push({
        elNum: _elNum,
        xLinksHz: _target,        // gehoerte (gewollte) Frequenz
        xRechtsHz: _center,       // erreichte Bandmitte (Punkt sitzt hier)
        yCent: _dev,              // Abweichung erreicht-gehoert
        residuumCent: _resid,
        bandLoHz: _ws.bandLoHz,
        bandHiHz: _ws.bandHiHz,
        sichtbar: true,
        warn: false,              // Bandgraph: vorerst kein Warndreieck
        stufe: _stufe,            // Farbe aus zentraler Bewertungsstufe
        tooltip: [
          "<b>E" + _elNum + "</b>",
          t("FRQ_bandTipHeard") + ": " + fmtNum(_target, "hz") + " Hz",
          t("FRQ_bandTipReached") + ": " + fmtNum(_center, "hz") + " Hz",
          t("FRQ_bandTipShift") + ": " + _devTxt + " · " + _bew,
          t("FRQ_bandTipBand") + ": " + fmtNum(_ws.bandLoHz, "hz") + " – "
            + fmtNum(_ws.bandHiHz, "hz") + " Hz"
        ]
      });
    }
    var _wand = (typeof mfr === "string" && MFR[mfr] && MFR[mfr].defaultRange
      && MFR[mfr].defaultRange.length === 2) ? MFR[mfr].defaultRange : null;
    var _skala = (typeof FRQ_bandSkalaWahl === "string") ? FRQ_bandSkalaWahl : "300";
    var _yMaxFest = (_skala === "auto") ? undefined : Number(_skala);
    drawFRQGraph(_bcv, _rows, {
      residuumAnker: "nulllinie",
      xWandHz: _wand,
      yLabel: t("FRQ_resultsChartYLabel"),
      verbindung: true,
      amberband: false,
      yMaxFest: _yMaxFest
    });
    if (!_bcv._frqg_listener) {
      _bcv.addEventListener("mousemove", function (e) { _frqg_tooltipHandler(_bcv, e); });
      _bcv.addEventListener("mouseleave", function () {
        var _t = document.getElementById("frqg_tooltip"); if (_t) _t.style.display = "none";
      });
      _bcv._frqg_listener = true;
    }
  }

  head.innerHTML =
    "<th>" + t("FRQ_resultsColEl") + "</th>" +
    "<th>" + t("FRQ_bandEmpfColTarget") + "</th>" +
    "<th>" + t("FRQ_bandEmpfColRange") + "</th>" +
    "<th>" + t("FRQ_bandEmpfColCenter") + "</th>" +
    "<th>" + t("FRQ_bandEmpfColDev") + "</th>" +
    "<th>" + t("FRQ_bandEmpfColRating") + "</th>";

  // BA452: EINE gemeinsame Empfehlungs-Wertquelle (vorher doppelt mit dem
  // Graphen). Tabelle: nhSim fest false, Modus aus dem Referenzmodus.
  var werte = FRQ_empfWerte(false);

  var dash = "<span style=\"color:var(--text-muted)\">&#8212;</span>";
  var rows = "";
  var overlapSeen = false;
  var abfTooSmall = false;

  var nCi = sideData[side].nEl;
  for (var i = 0; i < nCi; i++) {
    // Nicht aktive (elActive===false) ueberspringen -- kein Band (Sec. 9.5).
    if (sideData[side].elActive && sideData[side].elActive[i] === false) continue;

    var w = null;
    for (var k = 0; k < werte.length; k++) { if (werte[k].elIdx === i) { w = werte[k]; break; } }
    var ws = w ? w[side] : null;
    var elLabel = dENPrefix(side) + dEN(i, side);

    if (ws && ws.bandOverlap) {
      overlapSeen = true;
      if (ws.bandError === "abfTonoZuKlein") abfTooSmall = true;
    }

    var target = ws ? (ws.gehoertHz != null ? ws.gehoertHz : ws.nominellHz) : null;
    var lo = ws ? ws.bandLoHz : null;
    var hi = ws ? ws.bandHiHz : null;
    var center = ws ? ws.bandCenterHz : null;
    var resid = ws ? ws.residuum : null;

    var targetCell = (target != null) ? fmtNum(target, "hz") + " Hz" : dash;
    var rangeCell = (lo != null && hi != null)
      ? fmtNum(lo, "hz") + " &#8211; " + fmtNum(hi, "hz") + " Hz" : dash;
    var centerCell = (center != null) ? fmtNum(center, "hz") + " Hz" : dash;

    var devCent = null;
    if (center != null && target != null && center > 0 && target > 0) {
      devCent = 1200 * Math.log2(center / target);
    }
    var devCell = (devCent != null)
      ? (devCent >= 0 ? "+" : "") + fmtNum(devCent, "cent") + " ct" : dash;

    var ratingCell = dash;
    if (devCent != null && resid != null) {
      var ueber = Math.abs(devCent) - resid;
      var _bStufe = FRQ_bewertungsStufe(devCent, resid);
      var stufe = (_bStufe === "gruen") ? t("FRQ_bandEmpfRatingNoise")
                : (_bStufe === "amber") ? t("FRQ_bandEmpfRatingSlight")
                : t("FRQ_bandEmpfRatingClear");
      var farbe = (_bStufe === "gruen") ? "#16a34a"
                : (_bStufe === "amber") ? "#d97706" : "#dc2626";
      var ueberTxt = (ueber >= 0 ? "+" : "") + fmtNum(ueber, "cent") + " ct";
      ratingCell = "<span style=\"color:" + farbe + ";font-weight:600\">" + stufe + "</span>"
                 + " <span style=\"color:var(--text-muted)\">(" + ueberTxt + ")</span>";
    } else if (ws && ws.bandCenterVorschlagHz != null && ws.nominellHz != null) {
      // BA448 (Sec. 14.5): ungemessene El. -> Verschiebungs-Vorschlag
      // (Frequenz + Cent gegen nominell). Nutzer-Beschluss 2026-07-06.
      var vHz = ws.bandCenterVorschlagHz;
      var vCent = 1200 * Math.log2(vHz / ws.nominellHz);
      var vCentTxt = (vCent >= 0 ? "+" : "") + fmtNum(vCent, "cent") + " ct";
      ratingCell = "<span style=\"color:var(--text-muted);font-style:italic\">"
        + t("FRQ_bandEmpfVorschlag") + ": " + fmtNum(vHz, "hz") + " Hz (" + vCentTxt + ")</span>";
    }

    rows += "<tr>"
      + "<td style=\"font-weight:600\">" + elLabel + "</td>"
      + "<td>" + targetCell + "</td>"
      + "<td>" + rangeCell + "</td>"
      + "<td>" + centerCell + "</td>"
      + "<td>" + devCell + "</td>"
      + "<td>" + ratingCell + "</td>"
      + "</tr>";
  }
  body.innerHTML = rows;

  if (note) {
    if (abfTooSmall) {
      note.style.display = ""; note.textContent = t("FRQ_bandEmpfAbfTooSmall");
    } else if (overlapSeen) {
      note.style.display = ""; note.textContent = t("FRQ_bandEmpfOverlapNote");
    } else {
      note.style.display = "none"; note.textContent = "";
    }
  }
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
