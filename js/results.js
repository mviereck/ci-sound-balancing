// ============================================================
// RESULTS
// ============================================================
function renderResults() {
  // BA 251: hJ entfaellt (judgment-Verfahren raus); nur noch elektrodenlautstaerkeResults.
  const hB = elektrodenlautstaerkeResults.length > 0;
  if (!hB) {
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

  // BA 250: Elektrodenlautstaerke-Test hat kein Header-Volume-Feld
  // mehr — der Wert sitzt im State volume_test (in der Tonart-Modalbox
  // eingestellt). Fallback 75 wie bisher.
  const vol = (typeof volume_global !== 'undefined') ? volume_global : 75;
  let meta = `${new Date().toLocaleString(lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US")}`;
  if (hB) meta += ` · ${elektrodenlautstaerkeResults.length} bal.`;
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
    const { raw: levels, residual: elRes, weight: elWt } = elTestData();
    const pc = new Array(nEl).fill(0);
    const valid = elektrodenlautstaerkeResults.filter(
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
      tr.innerHTML = `<td style="font-weight:600">${dENPrefix()}${dEN(i)}</td><td>${Math.round(effFreq(i))}</td><td style="color:${ex ? "#999" : v > 0.05 ? "#2563eb" : v < -0.05 ? "#dc2626" : "#1a1a1a"}">${ex ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1)}</td><td>${pc[i] || "—"}</td><td style="color:${ex ? "#999" : elColor(i) === "green" ? "#16a34a" : elColor(i) === "yellow" ? "#d97706" : elColor(i) === "red" ? "#dc2626" : "#999"}">${elRes[i] > 0 ? elRes[i].toFixed(1) : "—"}</td><td>${ex ? "—" : elWt[i].toFixed(1)}</td><td style="font-size:.78em">${st}</td><td style="text-align:center;font-weight:700">${i === refEl ? "X" : ""}</td>`;
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

    const elIdxSet = new Set();
    Object.keys(run.tracks).forEach(function(k) { elIdxSet.add(parseInt(k, 10)); });

    elIdxSet.forEach(function(elIdx) {
      const tr = run.tracks[fmTrackKey(elIdx)];
      if (tr && tr.status === 'not-perceivable') {
        result[side + ':' + elIdx] = true;
      }
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

  const elIdxSet = new Set();
  Object.keys(run.tracks).forEach(function(k) { elIdxSet.add(parseInt(k, 10)); });

  elIdxSet.forEach(function(elIdx) {
    const tr = run.tracks[fmTrackKey(elIdx)];
    if (!tr || tr.status !== 'active') return;

    const varHz = withSide(side, function() { return effFreq(elIdx); });
    const prov  = fmComputeProvisional(tr);
    const totalTrials  = tr.trialCount || 0;
    const maxReversals = (tr.reversals && tr.reversals.length) || 0;

    if (prov.match != null) {
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz * Math.pow(2, prov.match / 1200),
        timestamp: Date.now(),
        method:       "adaptive",
        fmStatus:     'in-progress',
        fmResidual:   prov.residual,
        fmCombinedUncertainty: null,
        fmConv:       null,
        fmRunSpread:  null,
        fmResiduum:   null,
        fmRunsCount:  0,
        fmStatusLast: null,
        fmTrialCount: totalTrials,
        fmReversals:  maxReversals,
        _provisional: true
      });
    } else {
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz,
        timestamp: Date.now(),
        method:       "adaptive",
        fmStatus:     'in-progress-early',
        fmResidual:   null,
        fmCombinedUncertainty: null,
        fmConv:       null,
        fmRunSpread:  null,
        fmResiduum:   null,
        fmRunsCount:  0,
        fmStatusLast: null,
        fmTrialCount: totalTrials,
        fmReversals:  maxReversals,
        _provisional: true
      });
    }
  });
  return out;
}

// Pseudo-fRes-Einträge aus sliderEstimates (Bauanleitung 103).
//
// Slider-Vor-Schätzungen leben in
// sideData[side].freqmatchAdaptive.sliderEstimates[elIdx] und werden
// nicht ins globale fRes geschrieben (siehe BA 102). Diese Funktion
// macht sie für Anzeige und Warp verfügbar — als dritte Datenquelle
// unter fRes (final) und unter den 'in-progress'-Pseudo-Einträgen
// aus aktiven Tracks.
function _fmrBuildSliderEntries(side) {
  const out = [];
  const sd = sideData[side];
  if (!sd) return out;
  const fa = sd.freqmatchAdaptive;
  if (!fa || !fa.sliderEstimates || typeof fa.sliderEstimates !== 'object') return out;
  const ests = fa.sliderEstimates;
  const keys = Object.keys(ests);
  for (var i = 0; i < keys.length; i++) {
    const elIdx = parseInt(keys[i], 10);
    if (!isFinite(elIdx)) continue;
    const est = ests[keys[i]];
    if (!est || typeof est.cent !== 'number') continue;
    // varFreq aus der gespeicherten Schätzung; falls fehlend, aktuell rechnen.
    const varHz = (typeof est.varFreq === 'number' && est.varFreq > 0)
      ? est.varFreq
      : withSide(side, function() { return effFreq(elIdx); });
    if (!isFinite(varHz) || varHz <= 0) continue;
    const refSide = est.refSide || (side === 'left' ? 'right' : 'left');
    const refHz   = varHz * Math.pow(2, est.cent / 1200);
    out.push({
      varSide:      side,
      refSide:      refSide,
      elIdx:        elIdx,
      varFreq:      varHz,
      refFreq:      refHz,
      timestamp:    est.timestamp || Date.now(),
      method:       "slider",
      fmStatus:     'slider-estimate',
      fmResidual:   null,
      fmCombinedUncertainty: null,
      fmConv:       null,
      fmRunSpread:  null,
      fmResiduum:   null,
      fmRunsCount:  0,
      fmStatusLast: null,
      fmTrialCount: 0,
      fmReversals:  0,
      _provisional:    true,
      _sliderEstimate: true
    });
  }
  return out;
}

// BA353: Zentrale, nach aktivem Verfahren gefilterte Ergebnis-Quelle.
// EINZIGE Stelle, durch die Ergebnisgraph, Player (Warp) und Druck gehen.
// Generisch: vergleicht fmEntryMethod(eintrag) mit dem aktiven Verfahren,
// kennt die Verfahren nicht beim Namen. Vorrang final > provisorisch je
// (varSide, elIdx) -- aber nur INNERHALB des aktiven Verfahrens.
function fmActiveResults() {
  const method = (typeof fmGetActiveMethod === "function") ? fmGetActiveMethod() : "adaptive";
  const me = (typeof fmEntryMethod === "function")
    ? fmEntryMethod
    : function (r) { return (r && r.method === "slider") ? "slider" : "adaptive"; };

  // Finale Eintraege des aktiven Verfahrens.
  let finals = (typeof fRes !== "undefined" && Array.isArray(fRes))
    ? fRes.filter(function (r) { return r && me(r) === method; })
    : [];

  // Provisorische Eintraege (beide Arten sammeln, dann nach method filtern).
  let prov = [];
  const sides = ["left", "right"];
  for (let s = 0; s < sides.length; s++) {
    try { prov = prov.concat(_fmrBuildInProgressEntries(sides[s]) || []); } catch (e) {}
    try { prov = prov.concat(_fmrBuildSliderEntries(sides[s]) || []); } catch (e) {}
  }
  prov = prov.filter(function (r) { return r && me(r) === method; });

  // Vorrang final > provisorisch je (varSide, elIdx).
  const out = finals.slice();
  const covered = {};
  for (let i = 0; i < finals.length; i++) {
    const r = finals[i];
    if (r && r.varSide != null) covered[r.varSide + ":" + r.elIdx] = true;
  }
  for (let j = 0; j < prov.length; j++) {
    const p = prov[j];
    const k = p.varSide + ":" + p.elIdx;
    if (!covered[k]) { out.push(p); covered[k] = true; }
  }
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
  const sliderEsts  = _fmrBuildSliderEntries(ciSide);

  if ((typeof fRes === "undefined" || fRes.length === 0)
      && provisional.length === 0
      && sliderEsts.length === 0) {
    noData.style.display = "";
    card.style.display = "none";
    return;
  }
  noData.style.display = "none";
  card.style.display = "";
  // BA353: Umschalter-Hervorhebung aktualisieren.
  if (typeof fmUpdActiveMethodButtons === "function") fmUpdActiveMethodButtons();

  // BA353: Anzeige-Daten: nur das aktive Verfahren, ciSide-gefiltert.
  const displayData = ((typeof fmActiveResults === "function") ? fmActiveResults() : [])
    .filter(function (r) { return r && r.varSide === ciSide; });

  // Titel
  const titleEl = document.getElementById("fmrTitle");
  if (titleEl) titleEl.textContent = t("fmrTitle");

  // Methoden-Hinweis
  const noteEl = document.getElementById("fmrMethodNote");
  if (noteEl) noteEl.textContent = t("fmrMethodNote");

  // Meta-Zeile
  const metaEl = document.getElementById("fmrMeta");
  if (metaEl) {
    const finalCount  = displayData.filter(function (r) { return !r._provisional; }).length;
    const provCount   = displayData.filter(function (r) { return r._provisional && !r._sliderEstimate; }).length;
    const sliderCount = displayData.filter(function (r) { return r._sliderEstimate; }).length;
    const last = finalCount > 0
      ? displayData.filter(function (r) { return !r._provisional; }).slice(-1)[0]
      : null;
    let metaText = '';
    if (last) {
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
    if (sliderCount > 0) {
      const sliderStr = t('fmrSliderEstimateCount').replace('{n}', sliderCount);
      metaText += (metaText ? ' · ' : '') + sliderStr;
    }
    metaEl.textContent = metaText;
  }

  const varLabel = ciSide === 'left' ? t('sideLeft')  : t('sideRight');
  const refLabel = ciSide === 'left' ? t('sideRight') : t('sideLeft');

  // Tabellen-Header
  const th = document.getElementById("fmrTH");
  const tb = document.getElementById("fmrTB");
  if (!th || !tb) return;

  // BA364: Konvergenz/Laufstreuung nur bei aktivem Adaptiv (Architektur 10.3).
  var isAdaptiveActive = (typeof fmGetActiveMethod === "function")
    && fmGetActiveMethod() === "adaptive";
  var advCols = isAdaptiveActive
    ? ("<th title=\"" + t("fmrThConvTip") + "\">" + t("fmrThConv") + "</th>"
     + "<th title=\"" + t("fmrThRunSpreadTip") + "\">" + t("fmrThRunSpread") + "</th>")
    : "";

  th.innerHTML =
    "<th>" + t("fmrThEl") + "</th>" +
    "<th>" + t("fmrThVarHz").replace('{side}', varLabel) + "</th>" +
    "<th>" + t("fmrThRefHz").replace('{side}', varLabel) + "</th>" +
    "<th>" + t("fmrThDiffHz") + "</th>" +
    "<th>" + t("fmrThDiffCent") + "</th>" +
    advCols +
    "<th title=\"" + t("fmrThResiduumTip") + "\">" + t("fmrThResiduum") + "</th>" +
    "<th>" + t("fmrThStatus") + "</th>";

  // Beschreibungstext über der Tabelle
  const descEl = document.getElementById("fmrSidesDesc");
  if (descEl) {
    const line1 = t("fmrSidesDesc1").replace('{ref}', refLabel).replace('{var}', varLabel);
    const line2 = t("fmrSidesDesc2").replace('{ref}', refLabel).replace('{var}', varLabel);
    descEl.innerHTML =
      "<p style=\"font-weight:600;margin:0 0 6px\">" + line1 + "</p>" +
      "<p style=\"margin:0\">" + line2 + "</p>";
  }

  // Tabellen-Body: alle Elektroden der CI-Seite
  const nCi = sideData[ciSide].nEl;
  const byIdx = {};
  for (const r of displayData) byIdx[r.elIdx] = r;

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
        "<td>—</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        (isAdaptiveActive ? "<td>—</td><td>—</td>" : "") +
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
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        (isAdaptiveActive ? "<td style=\"color:#9ca3af\">—</td><td style=\"color:#9ca3af\">—</td>" : "") +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + note + "</td>";
    } else {
      const isProvEarly  = (r.fmStatus === 'in-progress-early');
      const isProvLate   = (r.fmStatus === 'in-progress');
      const isSliderEst  = (r.fmStatus === 'slider-estimate');
      const isProv       = isProvEarly || isProvLate || isSliderEst;

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

      // Drei Spalten: Konvergenz σ_konv, Lauf-Streuung σ_run, Residuum
      const isNotPerc = (r.fmStatus === 'not-perceivable');
      const runs      = r.fmRunsCount || 0;

      let convCell;
      if (isNotPerc) {
        convCell = '<span style="color:#9ca3af">—</span>';
      } else if (isProv) {
        const provKW = r.fmResidual != null ? Math.round(r.fmResidual) : null;
        convCell = provKW != null
          ? '<span style="color:#9ca3af">±' + provKW + '</span>'
          : '<span style="color:#9ca3af">—</span>';
      } else if (r.fmConv == null) {
        convCell = '<span style="color:#9ca3af">—</span>';
      } else {
        convCell = '<span style="color:#374151">±' + Math.round(r.fmConv) + '</span>';
      }

      let runSpreadCell;
      if (isProv || isNotPerc || (r.fmStatus && r.fmStatus.indexOf('piano') === 0)) {
        runSpreadCell = '<span style="color:#9ca3af">—</span>';
      } else if (runs < 2) {
        runSpreadCell = '<span style="color:#9ca3af" title="erst ab 2 Läufen">— (1. Lauf)</span>';
      } else if (r.fmRunSpread == null) {
        runSpreadCell = '<span style="color:#9ca3af">—</span>';
      } else {
        runSpreadCell = '<span style="color:#374151">±' + Math.round(r.fmRunSpread) + '</span>';
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
        if (r.fmConv != null) {
          tipParts.push('Konvergenzweite ±' + Math.round(r.fmConv) + ' ct');
        }
        if (runs >= 2 && r.fmRunSpread != null) {
          tipParts.push('Lauf-Streuung ±' + Math.round(r.fmRunSpread) + ' ct');
        }
        const runsLabel = (runs === 1) ? '1 Lauf'
                        : (runs > 1)   ? runs + ' Läufe'
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
      } else if (r.fmStatus === 'not-perceivable') {
        statusBadge = '<span class="fm-badge fm-badge-err" data-t="fmrStatusNotPerc">'
                    + t('fmrStatusNotPerc') + '</span>';
      } else if (r.fmStatus === 'slider-estimate') {
        statusBadge = '<span class="fm-badge fm-badge-slider" data-t="fmrStatusSliderEst">'
                    + t('fmrStatusSliderEst') + '</span>';
      } else if (r.fmStatus === 'piano') {
        statusBadge = '<span class="fm-badge fm-badge-slider" data-t="fmrStatusPiano">'
                    + t('fmrStatusPiano') + '</span>';
      } else if (r.fmStatus === 'piano-crossed') {
        statusBadge = '<span class="fm-badge fm-badge-err" data-t="fmrStatusPianoCrossed">'
                    + t('fmrStatusPianoCrossed') + '</span>';
      } else if (r.fmStatus === 'piano-wide') {
        statusBadge = '<span class="fm-badge fm-badge-wide" data-t="fmrStatusPianoWide">'
                    + t('fmrStatusPianoWide') + '</span>';
      } else {
        statusBadge = '<span class="muted">—</span>';
      }

      // BA364: advCells nur bei aktivem Adaptiv (gleiche Bedingung wie Header).
      var advCells = isAdaptiveActive
        ? ("<td>" + convCell + "</td>" + "<td>" + runSpreadCell + "</td>")
        : "";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varHzCell + "</td>" +
        "<td>" + refHzCell + "</td>" +
        "<td>" + diffHzCell + "</td>" +
        "<td>" + diffCtCell + "</td>" +
        advCells +
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
      // BA364: aktiver Klavier-Lauf der angezeigten Seite (oder null).
      var _pianoRun = (sideData[ciSide] && sideData[ciSide].freqmatchPiano
                       && sideData[ciSide].freqmatchPiano.run) || null;
      if (isAdaptiveActive) {
        // --- bisheriger Adaptiv-Zweig, unveraendert ---
        const noisy = finalEntries.filter(function(r) {
          return r.fmStatus === 'converged-fair' || r.fmStatus === 'converged-wide'
              || r.fmStatus === 'unstable';
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
      } else if (_pianoRun && _pianoRun.currentRound >= 1) {
        // --- BA364 Klavier-Zweig ---
        var _pTot = (typeof FM_PIANO_STEPS !== "undefined") ? FM_PIANO_STEPS.length : 6;
        var _pRound = _pianoRun.currentRound;
        var _pStep  = (typeof FM_PIANO_STEPS !== "undefined")
          ? FM_PIANO_STEPS[_pRound - 1] : null;
        if (_pStep != null) {
          txt = t('fmrQualPiano')
            .replace('{round}', _pRound)
            .replace('{total}', _pTot)
            .replace('{step}', _pStep);
        } else {
          txt = '';
        }
      } else {
        txt = '';
      }
    }
    qEl.textContent = txt;
    qEl.style.display = txt ? '' : 'none';
  }

  // Hinweis: Residuum erst ab 2 Läufen zuverlässig
  const runHintEl = document.getElementById('fmrRunHint');
  if (runHintEl) {
    const finalEntries = fRes.filter(function(r) { return r.varSide === ciSide; });
    const hasData = finalEntries.length > 0 || provisional.length > 0;
    const allComplete2 = provisional.length === 0
      && finalEntries.length > 0
      && finalEntries.every(function(r) { return (r.fmRunsCount || 0) >= 2; });
    // BA364: nur bei aktivem Adaptiv.
    const show = isAdaptiveActive && hasData && !allComplete2;
    runHintEl.textContent = show ? t('fmrRunHint') : '';
    runHintEl.style.display = show ? '' : 'none';
  }

  // Chart
  const cv = document.getElementById("fmrChart");
  if (cv) {
    const notPerc = _fmrCollectNotPerceivable();
    drawFreqMatchChart(
      cv,
      displayData.filter(function (r) { return !(r && r.fmExcluded); }),
      { notPerceivable: notPerc }
    );
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
    // BA364: Klavier-Legende, solange Adaptiv nicht aktiv ist.
    if (isAdaptiveActive) {
      const hintAdaptive = t("fmrChartHintAdaptive");
      hintEl.textContent = (hintAdaptive && hintAdaptive !== "fmrChartHintAdaptive")
        ? hintAdaptive
        : t("fmrChartHint");
    } else {
      hintEl.textContent = t("fmrChartHintPiano");
    }
  }
}

document.addEventListener("DOMContentLoaded", function() {
  // BA 157: drei Knöpfe statt einem
  function _fmrRefreshAfterClear() {
    if (typeof depLockApply === 'function') depLockApply();
    renderFreqMatchResults();
    if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
  }

  const allBtn = document.getElementById("fmrClearAllBtn");
  if (allBtn) {
    allBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearAllConfirm") || "Alle löschen?")) return;
      fRes.splice(0, fRes.length);
      if (typeof sideData !== "undefined") {
        if (sideData.left)  sideData.left.freqmatchAdaptive  = null;
        if (sideData.right) sideData.right.freqmatchAdaptive = null;
      }
      _fmrRefreshAfterClear();
    });
  }

  const sliderBtn = document.getElementById("fmrClearSliderBtn");
  if (sliderBtn) {
    sliderBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearSliderConfirm") || "Slider-Schätzungen löschen?")) return;
      for (let i = fRes.length - 1; i >= 0; i--) {
        if (fRes[i] && fmEntryMethod(fRes[i]) === "slider") fRes.splice(i, 1);
      }
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (!fa) return;
          if (fa.sliderEstimates) fa.sliderEstimates = {};
          fa.sliderPass = null;
        });
      }
      _fmrRefreshAfterClear();
    });
  }

  const adaptiveBtn = document.getElementById("fmrClearAdaptiveBtn");
  if (adaptiveBtn) {
    adaptiveBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearAdaptiveConfirm") || "Adaptiv-Ergebnisse löschen?")) return;
      for (let i = fRes.length - 1; i >= 0; i--) {
        if (fRes[i] && fmEntryMethod(fRes[i]) === "adaptive") fRes.splice(i, 1);
      }
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa) {
            fa.runs = [];
            fa.currentRunIdx = null;
          }
        });
      }
      _fmrRefreshAfterClear();
    });
  }

  // BA364: Klavier-Loeschbutton — entfernt nur piano-Eintraege aus fRes.
  const pianoBtn = document.getElementById("fmrClearPianoBtn");
  if (pianoBtn) {
    pianoBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearPianoConfirm") || "Klavier-Ergebnisse loeschen?")) return;
      for (let i = fRes.length - 1; i >= 0; i--) {
        if (fRes[i] && fmEntryMethod(fRes[i]) === "piano") fRes.splice(i, 1);
      }
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          if (sideData[side]) {
            sideData[side].freqmatchPiano = { run: null, perElectrode: {} };
          }
        });
      }
      _fmrRefreshAfterClear();
    });
  }
});
