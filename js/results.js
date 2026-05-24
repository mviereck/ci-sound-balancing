// ============================================================
// RESULTS
// ============================================================
function renderResults() {
  const hJ = jRes.length > 0,
    hB = bRes.length > 0;
  if (!hJ && !hB) {
    const nr = document.getElementById("noRes");
    const rc = document.getElementById("resC");
    if (nr) nr.style.display = "";
    if (rc) rc.style.display = "none";
    return;
  }
  const noResEl = document.getElementById("noRes");
  if (noResEl) noResEl.style.display = "none";
  const resCEl = document.getElementById("resC");
  if (resCEl) resCEl.style.display = "";

  // Hinweis "Testreihe noch nicht abgeschlossen" — nur für Modus full
  const ndBox    = document.getElementById('resNotDoneBox');
  const ndTitle  = document.getElementById('resNotDoneTitle');
  const ndDetail = document.getElementById('resNotDoneDetail');
  if (ndBox && ndTitle && ndDetail) {
    const s = sideData[activeSide];
    const rrTable = (typeof ROUND_ROBIN !== 'undefined') ? ROUND_ROBIN[nEl] : null;
    const inFullSweep = rrTable && s && s.fullSweepRound !== null && s.fullSweepRound !== undefined;
    if (inFullSweep) {
      const maxRounds = rrTable.length;
      const pairsPerRound = rrTable[s.fullSweepRound - 1].length;
      const done = (s.fullSweepDonePairs || []).length;
      ndTitle.textContent  = t('resNotDoneTitle');
      ndDetail.textContent = t('resNotDoneDetail')
        .replace('{round}',     s.fullSweepRound)
        .replace('{maxRounds}', maxRounds)
        .replace('{done}',      done)
        .replace('{total}',     pairsPerRound);
      ndBox.style.display = '';
    } else {
      ndBox.style.display = 'none';
    }
  }

  const vol = (typeof testEls !== 'undefined' && testEls && testEls.volInput)
    ? testEls.volInput.value
    : (document.getElementById("vol1") ? document.getElementById("vol1").value : 50);
  let meta = `${new Date().toLocaleString(lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US")}`;
  if (hB) meta += ` · ${bRes.length} bal.`;
  if (hJ) meta += ` · ${jRes.length} jdg.`;
  meta += ` · ${t("lblVol")} ${vol}% · ${MFR[mfr].name}`;
  const rMeta = document.getElementById("resMeta");
  if (rMeta) rMeta.innerHTML = meta;
  const th = document.getElementById("resTH"),
    tb = document.getElementById("resTB");
  th.innerHTML = "";
  tb.innerHTML = "";
  // Glossar befüllen
  const gEl = (id) => document.getElementById(id);
  if (gEl("glossTitleEl")) gEl("glossTitleEl").textContent = t("glossTitle");
  [
    "glossResiduum",
    "glossErrBar",
    "glossAnpassung",
    "glossFarbe",
    "glossRef",
    "glossLS",
  ].forEach((k) => {
    const el = gEl(k + "El");
    if (el) el.innerHTML = t(k);
  });
  if (hB) {
    const { levels, elRes, elWt } = compWLS();
    const pc = new Array(nEl).fill(0);
    const valid = bRes.filter(
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
    function elColor(i) {
      if (!pc[i]) return "grey";
      const res = elRes[i] || 0.001;
      if (res <= 1.0) return "green";
      if (res < 3.0) return "yellow";
      return "red";
    }
    // Fließtext
    const avgMeas =
      act.length > 0 ? pc.reduce((s, v) => s + v, 0) / act.length : 0;
    const rtEl = document.getElementById("reliabilityText");
    if (rtEl && rtEl.parentElement) {
      const rmsLv = Math.sqrt(
        act.reduce((s, i) => s + levels[i] ** 2, 0) / (act.length || 1),
      );
      const meanRes = act.reduce((s, i) => s + elRes[i], 0) / (act.length || 1);
      const globalSNR = meanRes > 0 ? rmsLv / meanRes : 0;
      const redEls = act.filter((i) => elColor(i) === "red");
      const yellEls = act.filter((i) => elColor(i) === "yellow");
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
      tr.innerHTML = `<td style="font-weight:600">${dENPrefix()}${dEN(i)}</td><td>${Math.round(effFreq(i))}</td><td style="color:${ex ? "#999" : v > 0.05 ? "#2563eb" : v < -0.05 ? "#dc2626" : "#666"}">${ex ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1)}</td><td>${pc[i] || "—"}</td><td style="color:${ex ? "#999" : elColor(i) === "green" ? "#16a34a" : elColor(i) === "yellow" ? "#d97706" : elColor(i) === "red" ? "#dc2626" : "#999"}">${elRes[i] > 0 ? elRes[i].toFixed(1) : "—"}</td><td>${ex ? "—" : elWt[i].toFixed(1)}</td><td style="font-size:.78em">${st}</td><td style="text-align:center;font-weight:700">${i === refEl ? "X" : ""}</td>`;
      tb.appendChild(tr);
    }
    drawChart(
      document.getElementById("resChart"),
      levels,
      elRes,
      true,
      elColor,
    );
    const chE = document.getElementById("chartExpl");
    if (chE) chE.textContent = t("chartExplB");
  } else if (hJ) {
    const sc = new Array(nEl).fill(0),
      cc = new Array(nEl).fill(0);
    for (const r of jRes) {
      cc[r.a]++;
      cc[r.b]++;
      if (r.result === "a") {
        sc[r.a]++;
        sc[r.b]--;
      } else if (r.result === "b") {
        sc[r.b]++;
        sc[r.a]--;
      }
    }
    th.innerHTML = `<th>${t("thEl")}</th><th>${t("thHzStd")}</th><th>${t("thSc")}</th><th>${t("thComp")}</th>`;
    for (let i = 0; i < nEl; i++) {
      const tr = document.createElement("tr"),
        s = sc[i];
      tr.innerHTML = `<td style="font-weight:600">${dEN(i)}</td><td>${Math.round(effFreq(i))}</td><td style="color:${s > 0 ? "#2563eb" : s < 0 ? "#dc2626" : "#666"}">${s > 0 ? "+" : ""}${s}</td><td>${cc[i] || "—"}</td>`;
      tb.appendChild(tr);
    }
    drawChart(document.getElementById("resChart"), sc, null, false);
    const chEj = document.getElementById("chartExpl");
    if (chEj) chEj.textContent = t("chartExplJ");
  }
  const reExp = document.getElementById("resExplain");
  if (reExp) reExp.textContent = t("resExplain");
  if (typeof updFClearBtn === "function") updFClearBtn();
}


// ============================================================
// FREQ MATCH RESULTS
// ============================================================
function renderFreqMatchResults() {
  const noData = document.getElementById("fmrNoData");
  const card = document.getElementById("fmrCard");
  if (!noData || !card) return;

  if (typeof fRes === "undefined" || fRes.length === 0) {
    noData.style.display = "";
    card.style.display = "none";
    return;
  }
  noData.style.display = "none";
  card.style.display = "";

  // Titel
  const titleEl = document.getElementById("fmrTitle");
  if (titleEl) titleEl.textContent = t("fmrTitle");

  // Methoden-Hinweis
  const noteEl = document.getElementById("fmrMethodNote");
  if (noteEl) noteEl.textContent = t("fmrMethodNote");

  // Meta-Zeile
  const metaEl = document.getElementById("fmrMeta");
  if (metaEl) {
    const last = fRes[fRes.length - 1];
    const d = new Date(last.timestamp);
    const dateStr = d.toLocaleString(
      lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US"
    );
    const refLabel = last.refSide === "left" ? t("sideLeft") : t("sideRight");
    metaEl.textContent = dateStr + " · " + fRes.length + " Messpunkte · Ref: " + refLabel;
  }

  // Tabellen-Header
  const th = document.getElementById("fmrTH");
  const tb = document.getElementById("fmrTB");
  if (!th || !tb) return;
  th.innerHTML =
    "<th>" + t("fmrThEl") + "</th>" +
    "<th>" + t("fmrThVarSide") + "</th>" +
    "<th>" + t("fmrThVarHz") + "</th>" +
    "<th>" + t("fmrThRefSide") + "</th>" +
    "<th>" + t("fmrThRefHz") + "</th>" +
    "<th>" + t("fmrThDiffHz") + "</th>" +
    "<th>" + t("fmrThDiffCent") + "</th>";

  // Tabellen-Body: alle Elektroden der CI-Seite
  // Welche Seite ist die CI-Seite? Aus dem letzten fRes-Eintrag, sonst aus state
  const ciSide = fRes.length > 0
    ? fRes[fRes.length - 1].varSide
    : (sideData.left.config === 'ci' ? 'left' : 'right');
  const nCi = sideData[ciSide].nEl;
  const byIdx = {};
  for (const r of fRes) byIdx[r.elIdx] = r;

  const varLabel = ciSide === 'left' ? t('sideLeft')  : t('sideRight');
  const refLabel = ciSide === 'left' ? t('sideRight') : t('sideLeft');

  tb.innerHTML = "";
  for (let i = 0; i < nCi; i++) {
    const exCI = sideData[ciSide].elExDur[i] !== null || sideData[ciSide].elSt[i] === 'mute';
    const r = byIdx[i];
    const tr = document.createElement("tr");
    const elLabel = withSide(ciSide, () => dENPrefix() + dEN(i));

    if (exCI) {
      tr.style.opacity = "0.4";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td>—</td>" +
        "<td>" + refLabel + "</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>";
    } else if (!r) {
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + refLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"font-size:.82em;color:#9ca3af\">" + t('notMeasured') + "</td>";
    } else {
      const diffHzRaw = r.refFreq - r.varFreq;
      const diffHz    = diffHzRaw.toFixed(2);
      const cent      = 1200 * Math.log2(r.refFreq / r.varFreq);
      const centRound = Math.round(cent);
      const diffColor = Math.abs(diffHzRaw) < 20 ? "#666" : diffHzRaw > 0 ? "#2563eb" : "#dc2626";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td>" + r.varFreq.toFixed(2) + "</td>" +
        "<td>" + refLabel + "</td>" +
        "<td>" + r.refFreq.toFixed(2) + "</td>" +
        "<td style=\"color:" + diffColor + "\">" + (diffHzRaw >= 0 ? "+" : "") + diffHz + "</td>" +
        "<td style=\"color:" + diffColor + "\">" + (centRound >= 0 ? "+" : "") + centRound + "</td>";
    }
    tb.appendChild(tr);
  }

  // Chart
  const cv = document.getElementById("fmrChart");
  if (cv) {
    drawFreqMatchChart(cv, fRes);
    // Tooltip-Listener einmalig anhängen
    if (!cv._fmcListenerAttached) {
      cv.addEventListener("mousemove", (e) => _fmcTooltipHandler(cv, e));
      cv.addEventListener("mouseleave", () => {
        const tip = document.getElementById("fmcTooltip");
        if (tip) tip.style.display = "none";
      });
      cv._fmcListenerAttached = true;
    }
  }

  // Chart-Hinweis
  const hintEl = document.getElementById("fmrChartHint");
  if (hintEl) hintEl.textContent = t("fmrChartHint");
}
