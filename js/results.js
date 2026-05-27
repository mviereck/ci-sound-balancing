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
function _fmrCollectNotPerceivable() {
  const result = {};
  ['left', 'right'].forEach(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    if (!fa || !Array.isArray(fa.runs) || fa.currentRunIdx == null) return;
    const run = fa.runs[fa.currentRunIdx];
    if (!run || !run.tracks) return;

    // Eindeutige Elektroden-Indizes (parseInt stoppt bei ':', "3:up" → 3)
    const elIdxSet = new Set();
    Object.keys(run.tracks).forEach(function(k) { elIdxSet.add(parseInt(k, 10)); });

    elIdxSet.forEach(function(elIdx) {
      const tu = run.tracks[fmTrackKey(elIdx, 'up')];
      const td = run.tracks[fmTrackKey(elIdx, 'down')];
      let isNotPerc = false;
      if (tu || td) {
        // Neues 2-Track-Schema
        const combo = _fmCombineTwoTracks(tu || null, td || null);
        isNotPerc = (combo.status === 'not-perceivable');
      } else {
        // Altes Einzel-Track-Schema
        const tr = run.tracks[String(elIdx)];
        if (tr && tr.status === 'not-perceivable') isNotPerc = true;
      }
      if (isNotPerc) result[side + ':' + elIdx] = true;
    });
  });
  return result;
}

// Liefert Pseudo-fRes-Einträge für aktive Tracks (Bauanleitung 84).
// Wird nicht in das globale fRes geschrieben — nur temporär für Anzeige.
//
// Status-Konvention:
//   'in-progress'        : ≥4 Umkehrungen, Match aus Mittelwert,
//                          Residuum aus halber Spanne der bisherigen Umkehrungen
//   'in-progress-early'  : <2 Umkehrungen, kein Match, refFreq = varFreq (Platzhalter)
// Schwellen kommen aus fmComputeProvisional in freqmatch-staircase.js.

function _fmrBuildInProgressEntries(side) {
  const out = [];
  const sd = sideData[side];
  if (!sd) return out;
  const fa = sd.freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs) || fa.currentRunIdx == null) return out;
  const run = fa.runs[fa.currentRunIdx];
  if (!run || !run.tracks) return out;
  const refSide = run.refSide || (side === 'left' ? 'right' : 'left');

  // Eindeutige Elektroden-Indizes (parseInt stoppt bei ':', "3:up" → 3)
  const elIdxSet = new Set();
  Object.keys(run.tracks).forEach(function(k) { elIdxSet.add(parseInt(k, 10)); });

  elIdxSet.forEach(function(elIdx) {
    const tu = run.tracks[fmTrackKey(elIdx, 'up')];
    const td = run.tracks[fmTrackKey(elIdx, 'down')];

    // Aktive Tracks für diese Elektrode bestimmen
    let activeTracks;
    if (tu || td) {
      // Neues 2-Track-Schema
      activeTracks = [tu, td].filter(function(tr) { return tr && tr.status === 'active'; });
    } else {
      // Altes Einzel-Track-Schema
      const tr = run.tracks[String(elIdx)];
      if (!tr || tr.status !== 'active') return;
      activeTracks = [tr];
    }
    if (activeTracks.length === 0) return;

    const varHz = withSide(side, function() { return effFreq(elIdx); });

    // Vorläufige Werte über aktive Tracks mitteln
    let sumMatch = 0, matchCount = 0;
    let sumResid = 0, residCount = 0;
    let totalTrials = 0, maxReversals = 0;
    activeTracks.forEach(function(tr) {
      const prov = fmComputeProvisional(tr);
      if (prov.match != null)   { sumMatch += prov.match;   matchCount++; }
      if (prov.residual != null) { sumResid += prov.residual; residCount++; }
      totalTrials  += tr.trialCount || 0;
      maxReversals  = Math.max(maxReversals, (tr.reversals && tr.reversals.length) || 0);
    });

    if (matchCount > 0) {
      const provMatch = sumMatch / matchCount;
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz * Math.pow(2, provMatch / 1200),
        timestamp: Date.now(),
        fmStatus: 'in-progress',
        fmResidual: residCount > 0 ? sumResid / residCount : null,
        fmCombinedUncertainty: null,
        fmConvUp:     null,
        fmConvDown:   null,
        fmTrackDiff:  null,
        fmRunSpread:  null,
        fmResiduum:   null,
        fmRunsCount:  0,
        fmStatusUpLast:   null,
        fmStatusDownLast: null,
        fmTrialCount: totalTrials,
        fmReversals: maxReversals,
        _provisional: true
      });
    } else {
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz,
        timestamp: Date.now(),
        fmStatus: 'in-progress-early',
        fmResidual: null,
        fmCombinedUncertainty: null,
        fmConvUp:     null,
        fmConvDown:   null,
        fmTrackDiff:  null,
        fmRunSpread:  null,
        fmResiduum:   null,
        fmRunsCount:  0,
        fmStatusUpLast:   null,
        fmStatusDownLast: null,
        fmTrialCount: totalTrials,
        fmReversals: maxReversals,
        _provisional: true
      });
    }
  });
  return out;
}

function renderFreqMatchResults() {
  const noData = document.getElementById("fmrNoData");
  const card = document.getElementById("fmrCard");
  if (!noData || !card) return;

  // CI-Seite bestimmen: fRes hat Vorrang, dann runs[]-varSide, dann Config-Fallback
  function _fmrVarSide(fa) {
    if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) return null;
    const r = fa.runs[fa.currentRunIdx != null ? fa.currentRunIdx : fa.runs.length - 1];
    return r ? r.varSide : null;
  }
  const ciSide = (fRes.length > 0)
    ? fRes[fRes.length - 1].varSide
    : (_fmrVarSide(sideData.left.freqmatchAdaptive)
        || _fmrVarSide(sideData.right.freqmatchAdaptive)
        || (sideData.left.config === 'ci' ? 'left' : 'right'));

  // Aktive Tracks → Zwischenstand-Einträge
  const provisional = _fmrBuildInProgressEntries(ciSide);

  if ((typeof fRes === "undefined" || fRes.length === 0) && provisional.length === 0) {
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
    const finalCount = fRes.length;
    const provCount  = provisional.length;
    let metaText = '';
    if (finalCount > 0) {
      const last = fRes[fRes.length - 1];
      const d = new Date(last.timestamp);
      const dateStr = d.toLocaleString(
        lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US"
      );
      const refLabelMeta = last.refSide === "left" ? t("sideLeft") : t("sideRight");
      metaText = dateStr + " · " + finalCount + " Messpunkte · Ref: " + refLabelMeta;
    }
    if (provCount > 0) {
      const provStr = t('fmrProvisionalCount').replace('{n}', provCount);
      metaText += (metaText ? ' · ' : '') + provStr;
    }
    metaEl.textContent = metaText;
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
    "<th>" + t("fmrThDiffCent") + "</th>" +
    "<th title=\"" + t("fmrThConvUdTip") + "\">" + t("fmrThConvUd") + "</th>" +
    "<th title=\"" + t("fmrThTrackDiffTip") + "\">" + t("fmrThTrackDiff") + "</th>" +
    "<th title=\"" + t("fmrThResiduumTip") + "\">" + t("fmrThResiduum") + "</th>" +
    "<th>" + t("fmrThStatus") + "</th>";

  // Vereinigte Anzeige-Daten (fRes hat Vorrang, dann provisorisch)
  const displayData = fRes.slice();
  const haveFinal = {};
  for (const r of fRes) {
    if (r.varSide === ciSide) haveFinal[r.elIdx] = true;
  }
  for (const p of provisional) {
    if (!haveFinal[p.elIdx]) displayData.push(p);
  }

  // Tabellen-Body: alle Elektroden der CI-Seite
  const nCi = sideData[ciSide].nEl;
  const byIdx = {};
  for (const r of displayData) byIdx[r.elIdx] = r;

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
        "<td>—</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>";
    } else if (!r) {
      const fa = sideData[ciSide] && sideData[ciSide].freqmatchAdaptive;
      const _faRun = fa && Array.isArray(fa.runs) && fa.currentRunIdx != null ? fa.runs[fa.currentRunIdx] : null;
      const notPercTrack = _faRun && _faRun.tracks && _faRun.tracks[i] && _faRun.tracks[i].status === 'not-perceivable';
      const note = notPercTrack
        ? '<span class="fm-badge fm-badge-err" data-t="fmrStatusNotPerc">✗ nicht wahrnehmbar</span>'
        : '<span style="font-size:.82em;color:#9ca3af">' + t('notMeasured') + '</span>';
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + refLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + note + "</td>";
    } else {
      const isProvEarly = (r.fmStatus === 'in-progress-early');
      const isProvLate  = (r.fmStatus === 'in-progress');
      const isProv      = isProvEarly || isProvLate;

      let varHzCell, refHzCell, diffHzCell, diffCtCell;
      if (isProvEarly) {
        varHzCell  = r.varFreq.toFixed(2);
        refHzCell  = "<span style=\"color:#9ca3af\">—</span>";
        diffHzCell = "<span style=\"color:#9ca3af\">—</span>";
        diffCtCell = "<span style=\"color:#9ca3af\">—</span>";
      } else if (r.refFreq == null) {
        varHzCell  = r.varFreq.toFixed(2);
        refHzCell  = "<span style=\"color:#9ca3af\">—</span>";
        diffHzCell = "<span style=\"color:#9ca3af\">—</span>";
        diffCtCell = "<span style=\"color:#9ca3af\">—</span>";
      } else {
        const diffHzRaw = r.refFreq - r.varFreq;
        const cent      = 1200 * Math.log2(r.refFreq / r.varFreq);
        const centRound = Math.round(cent);
        const diffColor = isProv ? "#6b7280"
                        : Math.abs(diffHzRaw) < 20 ? "#666"
                        : diffHzRaw > 0 ? "#2563eb" : "#dc2626";
        varHzCell  = r.varFreq.toFixed(2);
        refHzCell  = r.refFreq.toFixed(2);
        diffHzCell = "<span style=\"color:" + diffColor + "\">"
                   + (diffHzRaw >= 0 ? "+" : "") + diffHzRaw.toFixed(2) + "</span>";
        diffCtCell = "<span style=\"color:" + diffColor + "\">"
                   + (centRound >= 0 ? "+" : "") + centRound + "</span>";
      }

      // BA 99: drei Spalten — Konvergenz u/d, Track-Differenz, Residuum
      const isNotPerc = (r.fmStatus === 'not-perceivable');
      const statusUpLast   = r.fmStatusUpLast   || null;
      const statusDownLast = r.fmStatusDownLast || null;

      function _fmCellRoh(v, statusLast) {
        if (statusLast === 'not-perceivable') return '<span style="color:#9ca3af">✗</span>';
        if (statusLast === 'aborted')         return '<span style="color:#9ca3af">—</span>';
        if (v == null)                        return '<span style="color:#9ca3af">—</span>';
        return '<span style="color:#374151">±' + Math.round(v) + '</span>';
      }

      let convUdCell;
      if (isProv || (statusUpLast == null && statusDownLast == null
                     && r.fmConvUp == null && r.fmConvDown == null)) {
        convUdCell = '<span style="color:#9ca3af">—</span>';
      } else {
        convUdCell = _fmCellRoh(r.fmConvUp, statusUpLast)
                   + ' / '
                   + _fmCellRoh(r.fmConvDown, statusDownLast);
      }

      let trackDiffCell;
      if (isProv || r.fmTrackDiff == null
          || statusUpLast === 'not-perceivable' || statusDownLast === 'not-perceivable'
          || statusUpLast === 'aborted'         || statusDownLast === 'aborted') {
        trackDiffCell = '<span style="color:#9ca3af">—</span>';
      } else {
        trackDiffCell = '<span style="color:#374151">' + Math.round(r.fmTrackDiff) + '</span>';
      }

      let residuumCell;
      if (isProv || r.fmResiduum == null || isNotPerc) {
        residuumCell = '<span style="color:#9ca3af">—</span>';
      } else {
        const re      = Math.round(r.fmResiduum);
        const reColor = re <= 10 ? '#16a34a'
                      : re <= 25 ? '#d97706'
                      :            '#dc2626';
        const tipParts = [];
        if (r.fmConvUp != null || r.fmConvDown != null) {
          const ku = r.fmConvUp   != null ? Math.round(r.fmConvUp)   : '?';
          const kd = r.fmConvDown != null ? Math.round(r.fmConvDown) : '?';
          tipParts.push('Konvergenz ±' + ku + ' / ±' + kd + ' ct');
        }
        if (r.fmTrackDiff != null) {
          tipParts.push('Track-Differenz ' + Math.round(r.fmTrackDiff) + ' ct');
        }
        if (r.fmRunSpread != null) {
          tipParts.push('Run-Spannweite ' + Math.round(r.fmRunSpread) + ' ct');
        }
        const runsLabel = (r.fmRunsCount === 1) ? '1 Lauf'
                        : (r.fmRunsCount != null && r.fmRunsCount > 1) ? r.fmRunsCount + ' Läufe'
                        : '';
        if (runsLabel) tipParts.push('(' + runsLabel + ')');
        const tipText = tipParts.join(' · ');
        residuumCell = '<span style="color:' + reColor + ';font-weight:600" title="'
                     + tipText + '">±' + re + ' ct</span>';
      }

      let statusBadge;
      if (isProvEarly) {
        statusBadge = '<span class="fm-badge fm-badge-prov">'
                    + t('fmrStatusProvEarly').replace('{n}', r.fmTrialCount || 0)
                    + '</span>';
      } else if (isProvLate) {
        statusBadge = '<span class="fm-badge fm-badge-prov">'
                    + t('fmrStatusProvLate').replace('{n}', r.fmReversals || 0)
                    + '</span>';
      } else if (r.fmStatus === 'converged') {
        statusBadge = '<span class="fm-badge fm-badge-ok" data-t="fmrStatusOk">'
                    + t('fmrStatusOk') + '</span>';
      } else if (r.fmStatus === 'converged-fair') {
        statusBadge = '<span class="fm-badge fm-badge-fair" data-t="fmrStatusFair">'
                    + t('fmrStatusFair') + '</span>';
      } else if (r.fmStatus === 'converged-wide') {
        statusBadge = '<span class="fm-badge fm-badge-wide" data-t="fmrStatusWide">'
                    + t('fmrStatusWide') + '</span>';
      } else if (r.fmStatus === 'unstable') {
        statusBadge = '<span class="fm-badge fm-badge-unstable" data-t="fmrStatusUnstable">'
                    + t('fmrStatusUnstable') + '</span>';
      } else if (r.fmStatus === 'aborted') {
        statusBadge = '<span class="fm-badge fm-badge-aborted" data-t="fmrStatusAborted">'
                    + t('fmrStatusAborted') + '</span>';
      } else if (r.fmStatus === 'converged-noisy') {
        // Backwards-Compat: alte Status-Werte als converged-fair anzeigen
        statusBadge = '<span class="fm-badge fm-badge-fair" data-t="fmrStatusFair">'
                    + t('fmrStatusFair') + '</span>';
      } else if (r.fmStatus === 'not-perceivable') {
        statusBadge = '<span class="fm-badge fm-badge-err" data-t="fmrStatusNotPerc">'
                    + t('fmrStatusNotPerc') + '</span>';
      } else {
        statusBadge = '<span class="muted">—</span>';
      }

      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td>" + varHzCell + "</td>" +
        "<td>" + refLabel + "</td>" +
        "<td>" + refHzCell + "</td>" +
        "<td>" + diffHzCell + "</td>" +
        "<td>" + diffCtCell + "</td>" +
        "<td>" + convUdCell + "</td>" +
        "<td>" + trackDiffCell + "</td>" +
        "<td>" + residuumCell + "</td>" +
        "<td>" + statusBadge + "</td>";
      if (isProv) tr.style.fontStyle = 'italic';
    }
    tb.appendChild(tr);
  }

  // Fortschrittsbalken: nur sichtbar bei laufendem adaptivem Track
  const faActive = sideData[ciSide] && sideData[ciSide].freqmatchAdaptive;
  const pBox  = document.getElementById('fmrProgressBox');
  const pText = document.getElementById('fmrProgressText');
  const pFill = document.getElementById('fmrProgressFill');
  if (pBox) {
    const _faActiveRun = faActive && Array.isArray(faActive.runs) && faActive.currentRunIdx != null
      ? faActive.runs[faActive.currentRunIdx] : null;
    const _activeTracks = (_faActiveRun && _faActiveRun.tracks) ? _faActiveRun.tracks : {};
    const hasActive = Object.keys(_activeTracks).some(function(k) { return _activeTracks[k].status === 'active'; });
    if (hasActive && typeof fmComputeProgressStats === 'function') {
      const stats = fmComputeProgressStats(_activeTracks);
      pBox.style.display = '';
      if (pText) pText.textContent =
        stats.done + ' / ' + stats.total + ' · ' + Math.round(stats.percent) + ' %';
      if (pFill) pFill.style.width = stats.percent + '%';
    } else {
      pBox.style.display = 'none';
    }
  }

  // Qualitätstext
  const qEl = document.getElementById('fmrQualityText');
  if (qEl) {
    const finalEntries = fRes.filter(function(r) { return r.varSide === ciSide; });
    const provEntries  = provisional;
    const nElTotal = sideData[ciSide].nEl;
    const nExcluded = sideData[ciSide].elExDur.filter(function(v) { return v !== null; }).length
                    + sideData[ciSide].elSt.filter(function(s) { return s === 'mute'; }).length;
    const totalActive = nElTotal - nExcluded;

    let txt = '';
    if (finalEntries.length === 0 && provEntries.length === 0) {
      txt = '';
    } else if (finalEntries.length === 0) {
      txt = t('fmrQualEarly')
        .replace('{n}', provEntries.length)
        .replace('{t}', totalActive);
    } else if (finalEntries.length < totalActive) {
      const resVals = finalEntries
        .filter(function(r) { return r.fmResidual != null; })
        .map(function(r) { return r.fmResidual; });
      const meanRes = resVals.length > 0
        ? resVals.reduce(function(s, v) { return s + v; }, 0) / resVals.length
        : 0;
      txt = t('fmrQualPartial')
        .replace('{done}', finalEntries.length)
        .replace('{total}', totalActive)
        .replace('{res}', meanRes.toFixed(1));
    } else {
      const noisy = finalEntries.filter(function(r) {
        return r.fmStatus === 'converged-fair' || r.fmStatus === 'converged-wide'
            || r.fmStatus === 'unstable' || r.fmStatus === 'converged-noisy';
      });
      const resVals = finalEntries
        .filter(function(r) { return r.fmResidual != null; })
        .map(function(r) { return r.fmResidual; });
      const meanRes = resVals.length > 0
        ? resVals.reduce(function(s, v) { return s + v; }, 0) / resVals.length
        : 0;
      if (noisy.length > 0) {
        const names = noisy.map(function(r) {
          return withSide(ciSide, function() { return dENPrefix() + dEN(r.elIdx); });
        }).join(', ');
        txt = t('fmrQualOkWithNoisy')
          .replace('{res}', meanRes.toFixed(1))
          .replace('{names}', names);
      } else {
        txt = t('fmrQualOk').replace('{res}', meanRes.toFixed(1));
      }
    }
    qEl.textContent = txt;
    qEl.style.display = txt ? '' : 'none';
  }

  // Chart
  const cv = document.getElementById("fmrChart");
  if (cv) {
    const notPerc = _fmrCollectNotPerceivable();
    drawFreqMatchChart(cv, displayData, { notPerceivable: notPerc });
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
  if (hintEl) {
    const hintAdaptive = t("fmrChartHintAdaptive");
    hintEl.textContent = (hintAdaptive && hintAdaptive !== "fmrChartHintAdaptive")
      ? hintAdaptive
      : t("fmrChartHint");
  }
}

document.addEventListener("DOMContentLoaded", function() {
  const fmrClearBtn = document.getElementById("fmrClearBtn");
  if (fmrClearBtn) {
    fmrClearBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearConfirm") || "Alle Frequenzabgleich-Ergebnisse löschen?")) return;
      fRes.splice(0, fRes.length);
      if (typeof sideData !== "undefined") {
        if (sideData.left)  sideData.left.freqmatchAdaptive  = null;
        if (sideData.right) sideData.right.freqmatchAdaptive = null;
      }
      renderFreqMatchResults();
    });
  }
});
