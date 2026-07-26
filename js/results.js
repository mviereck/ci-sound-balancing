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
    var _ellRows = [];
    for (var _i = 0; _i < nEl; _i++) {
      var _ex = elExDur[_i] !== null || elSt[_i] === "mute";
      var _zustand = _ex ? "deaktiviert" : (!pc[_i] ? "ungemessen" : "gemessen");
      var _st = ell_color(_i);   // "green"|"yellow"|"red"|"grey"
      _ellRows.push({
        elNum: _i,
        label: dENPrefix() + dEN(_i),
        hz: FRQ_implantatEffektiv(_i),
        wert: levels[_i] || 0,
        zustand: _zustand,
        residuum: ELL_res[_i],
        stufe: _st === "green" ? "gruen" : _st === "yellow" ? "gelb" : _st === "red" ? "rot" : null,
        istRef: _i === ELL_refEl,
        apikalBasal: _i === 0 ? "apikal" : (_i === nEl - 1 ? "basal" : null)
      });
    }
    drawBarGraph(document.getElementById("ELL_resChart"), _ellRows, {
      balkenFarbe: "ampel",
      residuum: true,
      spitzenPunkte: true,
      refElLabel: true,
      yLabel: "dB",
      ySymmetrisch: true,
      ctx: ELL_ctx("global")
    });
    var _ellHint = document.getElementById("ELL_resChartHint");
    if (_ellHint) _ellHint.innerHTML = FRQ_legendeHtml("ellbar", ellLegendData(_ellRows));
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
        restspanne: null, residDown: null, residUp: null, isNotPerceivable: false, fmStatus: null,
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
    // BA483 (§15.5): "gemessen" aus dem Flag der Wertquelle, NICHT aus
    // gehoertHz != null -- nach BA482 ist gehoertHz fuer ungemessene aktive
    // Elektroden = nominell (!= null). Nur echt gemessene zeigen gehoert/Diff.
    if (wr && wr.gemessen && wSide) {
      gehoertHz = wSide.gehoertHz;
      diffHz    = wSide.shiftHz;
      diffCent  = wSide.shiftCent;
    }
    var _gm = (wr && wr.gemessen && wSide && !isNotPerc);
    const restspanne = (_gm && wSide.restspanne != null) ? wSide.restspanne : null;
    const residDown  = (_gm && wSide.residDown  != null) ? wSide.residDown  : null;
    const residUp    = (_gm && wSide.residUp    != null) ? wSide.residUp    : null;
    // BA433: Band-Felder aus der Wertquelle durchreichen.
    const bandLoHz  = wSide ? (wSide.bandLoHz != null ? wSide.bandLoHz : null) : null;
    const bandHiHz  = wSide ? (wSide.bandHiHz != null ? wSide.bandHiHz : null) : null;
    const bandOverlap = !!(wSide && wSide.bandOverlap);
    const bandOverlapEls = (wSide && wSide.bandOverlapEls) ? wSide.bandOverlapEls : [];
    rows.push({ elIdx: i, elLabel, kind: "data",
      nominellHz, gehoertHz, diffHz, diffCent, restspanne, residDown, residUp,
      bandLoHz, bandHiHz, bandOverlap, bandOverlapEls,
      isNotPerceivable: isNotPerc, fmStatus: (r && r.fmStatus) || null });
  }
  return rows;
}

// Auf/Zu-Zustand aller Legenden: EIN toolweiter Schalter, persistent in
// localStorage ("ci-lb-legendeZu"). Alle 6 Legenden (Ergebnis, Band,
// Glaettung, ELL, Stereo) teilen diesen Zustand, damit sie nie
// auseinanderlaufen (Sonderfall: zwei Legenden gleichzeitig sichtbar im
// Reiter Frequenzbaender). Default: aufgeklappt.
var _FRQ_legendeZu = false;
try { _FRQ_legendeZu = (localStorage.getItem("ci-lb-legendeZu") === "1"); }
catch (e) { /* localStorage kann fehlen — Default aufgeklappt */ }
function FRQ_legendeZu() { return _FRQ_legendeZu; }
// Alle im DOM vorhandenen Legenden (Kopf-Dreieck + Body) auf den globalen
// Zustand angleichen. Wird bei jedem Klick aufgerufen -> auch die gerade
// nicht angeklickte, aber sichtbare Legende schaltet mit um, ohne
// Neuzeichnen.
function FRQ_legendeAngleichen() {
  var koepfe = document.querySelectorAll("[data-frq-leg-kopf]");
  for (var i = 0; i < koepfe.length; i++) {
    var kopf = koepfe[i];
    var dr = kopf.querySelector("[data-frq-leg-dreieck]");
    if (dr) dr.textContent = _FRQ_legendeZu ? "▸" : "▾";
    // Body ist das naechste Geschwister-Element des Kopfes.
    var body = kopf.nextElementSibling;
    if (body && body.hasAttribute("data-frq-leg-body")) {
      body.style.display = _FRQ_legendeZu ? "none" : "";
    }
  }
}
// Einmalige Klick-Delegation am document: Klick auf einen Legende-Kopf
// (oder das Dreieck darin) schaltet den globalen Zustand um, persistiert
// und gleicht alle Legenden an.
function FRQ_legendeToggleInit() {
  if (document._frqLegToggle) return;
  document._frqLegToggle = true;
  document.addEventListener("click", function (e) {
    var kopf = e.target && e.target.closest
      ? e.target.closest("[data-frq-leg-kopf]") : null;
    if (!kopf) return;
    _FRQ_legendeZu = !_FRQ_legendeZu;
    try { localStorage.setItem("ci-lb-legendeZu", _FRQ_legendeZu ? "1" : "0"); }
    catch (e2) { /* localStorage kann fehlen/voll sein — ignorieren */ }
    FRQ_legendeAngleichen();
  });
}
FRQ_legendeToggleInit();

// Legende eines Frequenz-Graphen (Architektur §8). EIN Bauer fuer alle
// Graphen: Farben/Elemente/Achse kommen aus frqLegendData (chart.js),
// die Bedeutung je Element aus i18n. Spalten: Element = Farbe =
// Bedeutung, an den "="-Zellen ausgerichtet (wie zuvor _FRQ_chartLegendHtml).
// Legende eines Graphen (Architektur 00-balkengraph-engine Sec.6 /
// 00-frequenzgraph-engine Sec.8). EIN Bauer fuer ALLE Graphen: die
// Fakten (data = {elemente, bewertung, ampelStufen}) liefert der
// Aufrufer aus der graph-spezifischen Fakten-Quelle (frqLegendData /
// ellLegendData / stbLegendData); die Bedeutung je Element aus i18n.
// Globale Symbol-Engine (Architektur §8): 14x14-SVG je grafischem
// Element-Schluessel, eingefaerbt nach hexArr[0]. EIN Erzeuger fuer die
// Legende (FRQ_legendeHtml) UND fuer Symbole ausserhalb (Ausgangspunkt-
// Auswahl, spaeter Hilfetexte). Formen/Farblogik = das Bild im Graphen.
var FRQ_SYMBOL_NEUTRAL = "#374151";
// Helle Fuellungen (gedecktes Weiss, hellblau, hellrot) bekommen einen
// grauen Rahmen, sonst kaum sichtbar auf hellem Grund.
function FRQ_symbolHell(hx) {
  var m = /^#([0-9a-f]{6})$/i.exec(hx); if (!m) return false;
  var n = parseInt(m[1], 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 220;   // sehr hell
}
// Symbol des grafischen Elements (Spalte 0 der Legende), 14x14 SVG. Form
// je Element-Schluessel; Farbe: Strich/Band/Flaeche/Kurve tragen ihre
// echte Farbe (informativ), die Ampel-Elemente (Pfeil, Punkt) neutralgrau
// (mehrere Farben -> ein neutrales Symbol; die echten Farben stehen als
// Quadrate in Spalte 2 der Legende).
function FRQ_elementSymbol(key, hexArr) {
  var NEUTRAL = FRQ_SYMBOL_NEUTRAL;
  var c = (hexArr && hexArr.length) ? hexArr[0] : NEUTRAL;
  var rand = FRQ_symbolHell(c) ? "#9ca3af" : c;
  var svg = function (inner) {
    return "<span style=\"display:inline-block;width:14px;height:14px;"
      + "vertical-align:middle;margin-right:2px\">"
      + "<svg width=\"14\" height=\"14\" viewBox=\"0 0 14 14\">" + inner + "</svg></span>";
  };
  switch (key) {
    case "strichGrau":
    case "strichSchwarz":
      return svg("<line x1=\"7\" y1=\"1\" x2=\"7\" y2=\"13\" stroke=\"" + c + "\" stroke-width=\"1.75\"/>");
    case "meanLinie":   // gestrichelter senkrechter Strich (Mittelwert)
      return svg("<line x1=\"7\" y1=\"1\" x2=\"7\" y2=\"13\" stroke=\"" + c + "\" stroke-width=\"1.75\" stroke-dasharray=\"3 2\"/>");
    case "band":   // schmales senkrechtes Band
      return svg("<rect x=\"5\" y=\"1\" width=\"4\" height=\"12\" fill=\"" + c + "\"/>");
    case "querbalken":   // T-Balken (Residuum): senkrecht + zwei Endkappen, immer schwarz
      return svg("<line x1=\"7\" y1=\"2\" x2=\"7\" y2=\"12\" stroke=\"#000000\" stroke-width=\"1.5\"/>"
        + "<line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"2\" stroke=\"#000000\" stroke-width=\"1.5\"/>"
        + "<line x1=\"4\" y1=\"12\" x2=\"10\" y2=\"12\" stroke=\"#000000\" stroke-width=\"1.5\"/>");
    case "querbalkBlau":   // T-Balken (Restspanne): senkrecht + zwei Endkappen, Farbe aus hexArr
      return svg("<line x1=\"7\" y1=\"2\" x2=\"7\" y2=\"12\" stroke=\"" + c + "\" stroke-width=\"1.5\"/>"
        + "<line x1=\"4\" y1=\"2\" x2=\"10\" y2=\"2\" stroke=\"" + c + "\" stroke-width=\"1.5\"/>"
        + "<line x1=\"4\" y1=\"12\" x2=\"10\" y2=\"12\" stroke=\"" + c + "\" stroke-width=\"1.5\"/>");
    case "pfeil":   // waagerechter Pfeil, neutral
      return svg("<line x1=\"1\" y1=\"7\" x2=\"11\" y2=\"7\" stroke=\"" + NEUTRAL + "\" stroke-width=\"1.5\"/>"
        + "<polyline points=\"8,4 12,7 8,10\" fill=\"none\" stroke=\"" + NEUTRAL + "\" stroke-width=\"1.5\"/>");
    case "punkt":   // gefuellter Kreis, neutral
      return svg("<circle cx=\"7\" cy=\"7\" r=\"4\" fill=\"" + NEUTRAL + "\"/>");
    case "kurve":   // Wellenlinie in Kurvenfarbe
      return svg("<path d=\"M1,10 C4,3 6,3 7,7 C8,11 10,11 13,4\" fill=\"none\" stroke=\"" + c + "\" stroke-width=\"1.5\"/>");
    case "flaeche":   // gefuelltes Rechteck in Flaechenfarbe
      return svg("<rect x=\"1\" y=\"3\" width=\"12\" height=\"8\" fill=\"" + c + "\" stroke=\"" + rand + "\" stroke-width=\"1\"/>");
    case "balken":   // senkrechter gefuellter Balken (ELL/Stereo)
      return svg("<rect x=\"4\" y=\"2\" width=\"6\" height=\"11\" fill=\"" + c + "\"/>");
    case "xRechteck":   // deaktiviert: graues Rechteck mit X
      return svg("<rect x=\"1\" y=\"1\" width=\"12\" height=\"12\" fill=\"#e5e7eb\" stroke=\"#9ca3af\"/>"
        + "<line x1=\"2\" y1=\"2\" x2=\"12\" y2=\"12\" stroke=\"#6b7280\" stroke-width=\"1.25\"/>"
        + "<line x1=\"12\" y1=\"2\" x2=\"2\" y2=\"12\" stroke=\"#6b7280\" stroke-width=\"1.25\"/>");
    case "frageRechteck":   // ungemessen: graues Rechteck mit ?
      return svg("<rect x=\"1\" y=\"1\" width=\"12\" height=\"12\" fill=\"#e5e7eb\" stroke=\"#9ca3af\"/>"
        + "<text x=\"7\" y=\"11\" text-anchor=\"middle\" font-size=\"10\" font-weight=\"bold\" fill=\"#6b7280\">?</text>");
    default:
      return svg("");
  }
}
function FRQ_legendeHtml(graphKey, data) {
  data = data || { elemente: [], bewertung: "ampel" };
  var eqCell = "<td style=\"padding:0 6px;color:#374151\">=</td>";
  var T = function (k, fb) {
    var v = (typeof t === "function") ? t(k) : k;
    return (v && v !== k) ? v : (fb != null ? fb : null);
  };

  // Anzeige-Wort fuer den Farb-Schluessel (Spalte 2), i18n-faehig.
  var farbWort = function (key) { return T("FRQ_legFarbe_" + key, key); };
  // Farb-Quadrat(e) vor dem Wort zur Orientierung. hex = Array (Ampel hat
  // mehrere). Helle Fuellungen bekommen einen grauen Rahmen (FRQ_symbolHell).
  var farbQuadrate = function (hexArr) {
    if (!hexArr || !hexArr.length) return "";
    var out = "";
    hexArr.forEach(function (hx) {
      var rand = FRQ_symbolHell(hx) ? "#9ca3af" : hx;
      out += "<span style=\"display:inline-block;width:10px;height:10px;"
        + "background:" + hx + ";border:1px solid " + rand + ";"
        + "border-radius:2px;vertical-align:middle;margin-right:2px\"></span>";
    });
    return out + " ";
  };
  // Symbol des grafischen Elements ganz vorne (Spalte 0): globale Engine.
  var elementSymbol = FRQ_elementSymbol;
  // Element-Name (Spalte 1) + automatische Achsen-Angabe.
  var elementName = function (key, achse) {
    var name = T("FRQ_legElement_" + key, key);
    if (achse === "x") name += " (X)";
    else if (achse === "y") name += " (Y)";
    return name;
  };
  // Bedeutung (Spalte 3). Kurve/Flaeche: am Farb-Schluessel; sonst am
  // Element allein. Fehlt -> null -> Zeile weglassen.
  var bedeutung = function (elKey, farbeKey) {
    var suffix = (elKey === "kurve" || elKey === "flaeche")
      ? (elKey + "_" + farbeKey) : elKey;
    return T("FRQ_leg_" + graphKey + "_" + suffix, null);
  };

  // Farb-Spalte (Symbol=Farbwort=Bedeutung) nur, wenn der Graph
  // Element-Farb-Kontraste hat (Frequenzgraphen). Balkengraphen setzen
  // data.farbSpalte=false -> schlanke Tabelle Symbol/Name/Bedeutung.
  var mitFarbSpalte = (data.farbSpalte !== false);
  var zeilen = "";
  data.elemente.forEach(function (e) {
    var bed = bedeutung(e.key, e.farbe);
    if (bed == null) return;   // Element ohne Bedeutung in diesem Graphen -> nicht zeigen
    zeilen +=
      "<tr>" +
      "<td style=\"padding:1px 4px 1px 0;white-space:nowrap\">" + elementSymbol(e.key, e.hex) + "</td>" +
      "<td style=\"padding:1px 0;white-space:nowrap;font-weight:600\">" + elementName(e.key, e.achse) + "</td>" +
      (mitFarbSpalte
        ? eqCell
          + "<td style=\"padding:1px 0;white-space:nowrap\">" + farbQuadrate(e.hex) + farbWort(e.farbe) + "</td>"
        : "") +
      eqCell +
      "<td style=\"padding:1px 0\">" + bed + "</td>" +
      "</tr>";
  });

  var intro = T("FRQ_legIntro_" + graphKey, "") || "";
  var legendWort = T("FRQ_legLegende", "Legende:");
  // Auf/Zu-Zustand: EIN toolweiter Schalter (FRQ_legendeZu), gemerkt in
  // localStorage. Kopf (Wort + Dreieck) klickbar; Klick-Delegation +
  // Gleichschaltung aller Legenden in FRQ_legendeToggleInit.
  var _zu = FRQ_legendeZu();
  var _dreieck = _zu ? "▸" : "▾";   // ▸ zu / ▾ auf

  // Farb-Erklaerblock (§8.4) als Tabelle: je Stufe ein farbiger Kreis
  // (wie der Graph-Punkt) + Erklaertext. Stufen + Kreisfarbe aus
  // frqLegendData.ampelStufen; Text aus FRQ_legStufe_<bewertung>_<stufe>.
  // Symbolform des Erklaerblocks: rund (Default, Frequenzgraphen zeigen
  // Punkte) oder eckig (Balkengraphen zeigen Balken -> data.ampelSymbol).
  var ampelRund = (data.ampelSymbol !== "eckig");
  var ampelZeilen = "";
  (data.ampelStufen || []).forEach(function (s) {
    var txt = T("FRQ_legStufe_" + data.bewertung + "_" + s.stufe, null);
    if (txt == null) return;
    var kreis = "<span style=\"display:inline-block;width:11px;height:11px;"
      + "background:" + s.hex + ";border-radius:" + (ampelRund ? "50%" : "2px") + ";vertical-align:middle;"
      + "margin-right:2px\"></span>";
    ampelZeilen +=
      "<tr>" +
      "<td style=\"padding:1px 6px 1px 0;white-space:nowrap\">" + kreis + "</td>" +
      "<td style=\"padding:1px 0\">" + txt + "</td>" +
      "</tr>";
  });

  // Kopf: Dreieck + Wort, zusammen eine klickbare Zeile (data-frq-leg-kopf).
  // Body (data-frq-leg-body): Intro + Tabellen; per display gesteuert.
  var kopf = "<p data-frq-leg-kopf=\"1\" style=\"margin:0 0 2px;font-weight:600;"
    + "cursor:pointer;user-select:none\">"
    + legendWort
    + "<span data-frq-leg-dreieck=\"1\" style=\"display:inline-block;"
    + "margin-left:0.4em;font-size:1.3em;line-height:1;vertical-align:-0.1em\">"
    + _dreieck + "</span></p>";
  var body = "<div data-frq-leg-body=\"1\"" + (_zu ? " style=\"display:none\"" : "") + ">" +
    (intro ? "<p style=\"margin:0 0 6px\">" + intro + "</p>" : "") +
    "<table style=\"border-collapse:collapse;font-size:1em\"><tbody>" + zeilen + "</tbody></table>" +
    (ampelZeilen ? "<table style=\"border-collapse:collapse;font-size:1em;margin:6px 0 0\">"
      + "<tbody>" + ampelZeilen + "</tbody></table>" : "") +
    "</div>";
  return kopf + body;
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
    // BA483 (§15.5): "gemessen" aus dem Wertquelle-Flag. Nach BA482 sind
    // gehoertHz/shiftCent fuer ungemessene aktive Elektroden nicht mehr null;
    // die "ungemessen"-Marker-Logik (Z. ~437) darf sich nicht darauf stuetzen.
    var isMeasured = !!wr.gemessen;
    var hzSoll = isMeasured ? seite.gehoertHz : null;   // null wenn ungemessen
    var dc     = isMeasured ? seite.shiftCent : null;   // null wenn ungemessen
    var _rD = (isMeasured && seite.residDown  != null) ? seite.residDown  : 0;
    var _rU = (isMeasured && seite.residUp    != null) ? seite.residUp    : 0;
    var _rS = (isMeasured && seite.restspanne != null) ? seite.restspanne : 0;
    var fmStatus = r ? (r.fmStatus || "converged") : null;
    var warn = (fmStatus === "piano-crossed" || fmStatus === "piano-wide");

    // Sichtbarkeit: elActive===false -> unsichtbar (wie Bandgraph/Sec.9.5).
    var sichtbar = !(sideData[side].elActive && sideData[side].elActive[wr.elIdx] === false);

    var tooltip;
    if (!isMeasured) {
      // ungemessen (aber testbar): grauer Punkt in der Kurve wie Graph 2/3
      // (yCent=0 -> Nulllinie, stufe=null -> grau). Deaktivierte sind
      // unsichtbar (sichtbar=false), tauchen also gar nicht auf.
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
      if (_rS > 0) {
        tooltip.push(tipT("FRQ_resultsTipRestspanne", "Restspanne") + " &#177;"
          + Math.round(_rS) + NB + "ct");
      }
      if (_rD > 0 || _rU > 0) {
        tooltip.push(tipT("FRQ_resultsTipResiduum", "Residuum") + " &#8722;"
          + Math.round(_rD) + NB + "&#8230; +" + Math.round(_rU) + NB + "ct");
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
      yCent: (isMeasured && dc != null) ? dc : 0,   // ungemessen: 0 (Nulllinie), grauer Punkt
      residDownCent: _rD, residUpCent: _rU, restspanneCent: _rS,
      bandLoHz: null, bandHiHz: null,     // Ergebnisgraph hat keine Baender
      sichtbar: sichtbar,
      warn: warn,
      // gemessen: gruen, rot nur bei Warnung. Ungemessen: null -> grauer Punkt.
      stufe: !isMeasured ? null : (warn ? "rot" : "gruen"),
      tooltip: tooltip
    });
  }
  return rows;
}

// BA475: Row-Quelle fuer den Glaettungs-Graphen. Grau = gehoerte (rohe)
// Frequenz, schwarz = geglaettete Frequenz. Farbe = FRQ_bewertungsStufe
// (Verschiebung roh->geglaettet, Residuum). T-Balken um den ROHEN Wert
// (residuumMitteCent). Nutzt drawFRQGraph (KEINE eigene Zeichenlogik).
//
// BA483 (§15.6): reiner Konsument von FRQ_werte('gehoert'). Beide Reihen
// kommen direkt aus der Wertquelle -- gehoertHz (roh), gehoertHzGlatt,
// shiftCent (roh), shiftCentGlatt, residuum, gemessen -- KEINE eigene
// cent->Hz-Ableitung mehr (frueher _hzAusCent/_shiftAusCent, entfernt,
// da FRQ_werte seit BA482 roh UND geglaettet nebeneinander liefert).
function FRQ_glaettRows(side, opts) {
  opts = opts || {};
  var nhSim = !!opts.nhSim;
  // BA491: Achse 2 -> globaler FRQ_distribution (nicht Referenzmodus).
  var modus = (typeof opts.modus === "string") ? opts.modus
    : ((typeof FRQ_distribution === "string") ? FRQ_distribution : "right");

  // BA483 (§15.6): reiner Konsument der Wertquelle -- KEINE eigene cent->Hz-
  // Ableitung mehr. gehoertHz (roh, grau), gehoertHzGlatt (schwarz),
  // shiftCent (roh, T-Balken-Mitte), shiftCentGlatt (Punkt), residuum,
  // gemessen kommen alle aus FRQ_werte("gehoert").
  var werte = (typeof FRQ_werte === "function")
    ? FRQ_werte("gehoert", modus, nhSim) : [];
  var byIdx = {};
  for (var wi = 0; wi < werte.length; wi++) byIdx[werte[wi].elIdx] = werte[wi];

  var rows = [];
  // Alle AKTIVEN Elektroden der Seite (§9.5.1), nicht nur gemessene.
  _frqAktiveElIdx(side).forEach(function (elIdx) {
    var wr = byIdx[elIdx];
    var s  = wr ? wr[side] : null;
    if (!s) return;
    var elNum = dEN(elIdx, side);
    var nom = withSide(side, function () { return FRQ_implantatEffektiv(elIdx); });

    if (!wr.gemessen) {
      // Nicht-gemessene aktive Elektrode: grauer Strich = roh (nominell),
      // schwarzer Strich = geglaettet (bei Grad "aus" == nominell), Punkt =
      // geglaettete Verschiebung, kein Farb-/Residuumsurteil (keine Messung).
      var _glHz0 = (s.gehoertHzGlatt != null) ? s.gehoertHzGlatt : nom;
      var _glShift0 = (s.shiftCentGlatt != null) ? s.shiftCentGlatt : 0;
      rows.push({
        elNum: elNum,
        xLinksHz: (s.gehoertHz != null) ? s.gehoertHz : nom,   // roh
        xRechtsHz: _glHz0,                                     // geglaettet
        yCent: _glShift0,
        yCent2: (s.shiftCent != null) ? s.shiftCent : 0,   // blaue Zweitkurve = roh
        residDownCent: 0, residUpCent: 0, restspanneCent: 0,
        residuumMitteCent: 0,       // T-Balken-Mitte = 0 (roher Wert)
        bandLoHz: null, bandHiHz: null,
        sichtbar: true,
        warn: false,
        stufe: null,                // ungemessen: grauer Punkt (kein Farb-Urteil)
        tooltip: ["<b>E" + elNum + "</b>", t("notMeasured")]
      });
      return;
    }

    var rohHz   = s.gehoertHz;                                  // grau
    var glattHz = (s.gehoertHzGlatt != null) ? s.gehoertHzGlatt : rohHz;  // schwarz
    var rohShift   = (s.shiftCent != null) ? s.shiftCent : 0;   // T-Balken-Mitte (roh)
    var glattShift = (s.shiftCentGlatt != null) ? s.shiftCentGlatt : rohShift; // Punkt
    var resid = (s.restspanne != null) ? s.restspanne : 0;
    var residDown = (s.residDown != null) ? s.residDown : 0;
    var residUp   = (s.residUp   != null) ? s.residUp   : 0;
    // Verschiebung roh->geglaettet in cent (Farb-Urteil der Glaettung).
    var dev = 1200 * Math.log2(rohHz / glattHz);
    var stufe = FRQ_bewertungsStufe(dev, residDown, residUp);
    rows.push({
      elNum: elNum,
      xLinksHz: rohHz,                 // grauer Strich (roh)
      xRechtsHz: glattHz,              // schwarzer Strich (geglaettet)
      yCent: glattShift,               // Punkt = geglaettete Verschiebung (gruen, bewertet)
      yCent2: rohShift,                // blaue Zweitkurve = rohe Verschiebung
      residDownCent: residDown, residUpCent: residUp, restspanneCent: resid,
      residuumMitteCent: rohShift,     // T-Balken-Mitte = rohe Verschiebung
      bandLoHz: null, bandHiHz: null,
      sichtbar: true,
      warn: false,
      stufe: stufe,
      tooltip: [
        "<b>E" + elNum + "</b>",
        Math.round(rohHz) + " Hz → " + Math.round(glattHz) + " Hz",
        (dev >= 0 ? "+" : "") + Math.round(dev) + " ct · &#177;" + Math.round(resid) + " ct"
      ]
    });
  });
  return rows;
}

// BA475: Glaettungs-Graph rendern (aktive Seite). Nutzt drawFRQGraph.
function FRQ_renderGlaettGraph() {
  var cv = document.getElementById("FRQ_glaettChart");
  if (!cv) return;
  var side = (typeof activeSide === "string") ? activeSide
    : (sideData.left.config === "ci" ? "left" : "right");
  var rows = FRQ_glaettRows(side, {});
  drawFRQGraph(cv, rows, {
    residuumAnker: "rohwert",   // BA475: T-Balken um residuumMitteCent (roher Wert)
    yLabel: t("FRQ_resultsChartYLabel"),
    verbindung: true,           // Punkt-zu-Punkt-Linie durch die geglaetteten (gruenen) Punkte
    linienfarbe: "gruen",       // BA484: yCent traegt hier die geglaettete Kurve
    zweitkurve: "blau",         // BA484: blaue Marker-Kurve = rohe Verschiebung
    amberband: false,
    restspanne: false,          // Frequenzbaender-Reiter: keine Restspanne (nur Residuum)
    titel: "FRQ_titel_glaett",
    bewertung: "ampel",
    yMaxFest: FRQ_yMaxCent()    // BA485: gemeinsame Skala aus Rohdaten
  });
  var _glHint = document.getElementById("FRQ_glaettChartHint");
  if (_glHint) {
    _glHint.innerHTML = FRQ_legendeHtml("glaett",
      frqLegendData({ linienfarbe: "gruen", zweitkurve: "blau", amberband: false, restspanne: false, bewertung: "ampel" }, rows));
  }
  if (!cv._frqg_listener) {
    cv.addEventListener("mousemove", function (e) { _frqg_tooltipHandler(cv, e); });
    cv.addEventListener("mouseleave", function () {
      var tp = document.getElementById("frqg_tooltip"); if (tp) tp.style.display = "none";
    });
    cv._frqg_listener = true;
  }
}

// BA506: Sichtbarkeit der Frequenzbaender-Karten nach CI-Konfiguration.
// - aktive Seite kein CI  -> alle Karten aus, nur Hinweis (Punkt 3).
// - Korrektur-Seite-Karte -> nur bei 2 CI (Punkt 2).
// Rueckgabe: true = aktive Seite ist CI (Reiter normal), false = leer.
function _frqApplyCiVisibility() {
  var aktiv = (typeof activeSide === "string") ? activeSide : "right";
  var aktivIstCi = ((sideData[aktiv] && sideData[aktiv].config) || "ci") === "ci";
  var lCI = ((sideData.left  && sideData.left.config)  || "ci") === "ci";
  var rCI = ((sideData.right && sideData.right.config) || "ci") === "ci";

  var panel = document.getElementById("panel-frequenzbaender");
  var hint  = document.getElementById("FRQ_noCiHint");
  if (!panel) return aktivIstCi;

  // Alle DIREKTEN Karten des Panels ausser dem Hinweis.
  var cards = panel.querySelectorAll(":scope > .card");
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    if (c.id === "FRQ_noCiHint") continue;
    c.style.display = aktivIstCi ? "" : "none";
  }

  if (hint) {
    if (!aktivIstCi) {
      var sideLabel = (aktiv === "left") ? t("sideLeft") : t("sideRight");
      var p = hint.querySelector("p");
      if (p) p.textContent = t("FRQ_noCiHint").replace("{side}", sideLabel);
      hint.style.display = "";
    } else {
      hint.style.display = "none";
    }
  }

  // Korrektur-Seite-Karte: nur bei 2 CI (nur wenn Reiter ueberhaupt sichtbar).
  var distCard = document.getElementById("FRQ_distributionCard");
  if (distCard && aktivIstCi) {
    distCard.style.display = (lCI && rCI) ? "" : "none";
  }

  return aktivIstCi;
}

function FRQ_renderResults() {
  const noData = document.getElementById("FRQ_resultsNoData");
  const card = document.getElementById("FRQ_resultsCard");
  if (!noData || !card) return;

  // BA506: CI-abhaengige Karten-Sichtbarkeit (Punkte 2/3).
  const _aktivIstCi = _frqApplyCiVisibility();
  if (!_aktivIstCi) return;   // aktive Seite kein CI -> Reiter leer, fertig.

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
    "<th title=\"" + t("FRQ_resultsColRestspanneTip") + "\">" + t("FRQ_resultsColRestspanne") + "</th>" +
    "<th title=\"" + t("FRQ_resultsColResiduumTip") + "\">" + t("FRQ_resultsColResiduum") + "</th>" +
    "<th title=\"" + t("FRQ_resultsColVorherTip") + "\">" + t("FRQ_resultsColVorher") + "</th>" +
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
        "<td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td>" +
        "<td style=\"font-size:.82em\">" + t("FRQ_resultsStatusNotActive") + "</td>";
      tb.appendChild(tr);
      continue;
    }
    if (z.kind === "notMeasured") {
      // Nachbesserung 435.1: "nicht gemessen" in schwarzer Schrift.
      const note = '<span style="font-size:.82em">' + t("notMeasured") + "</span>";
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
        "<td style=\"" + grey + "\">—</td>".repeat(7) +
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
    // Restspanne: symmetrisch, +/-X ct (frueheres Residuum).
    let restspanneCell;
    if (z.restspanne == null) {
      restspanneCell = dash;
    } else {
      const rs = Math.round(z.restspanne);
      const rsColor = rs <= 25 ? "#16a34a" : rs <= 100 ? "#d97706" : "#dc2626";
      restspanneCell = '<span style="color:' + rsColor + ';font-weight:600">&#177;' + rs + ' ct</span>';
    }
    // Residuum-Band: asymmetrischer Bereich -A .. +B ct.
    let residuumCell;
    if (z.residDown == null || z.residUp == null) {
      residuumCell = dash;
    } else {
      const rd = Math.round(z.residDown), ru = Math.round(z.residUp);
      const breite = rd + ru;
      const reColor = breite <= 25 ? "#16a34a" : breite <= 100 ? "#d97706" : "#dc2626";
      residuumCell = '<span style="color:' + reColor + ';font-weight:600">&#8722;'
        + rd + ' &#8230; +' + ru + ' ct</span>';
    }
    // BA521: Sitzungs-Vergleich (vorige Sitzung / Differenz), kanonische cent.
    let vorherCell = dash;
    const vgl = (typeof _frq_pianoVergleich === "function")
      ? _frq_pianoVergleich(z.elIdx) : null;
    if (vgl) {
      const vc = Math.round(vgl.vorherCent);
      const dc = Math.round(vgl.deltaCent);
      vorherCell = (vc >= 0 ? "+" : "") + vc + " ct / Δ "
        + (dc >= 0 ? "+" : "") + dc + " ct";
    }
    tr.innerHTML =
      "<td style=\"font-weight:600\">" + z.elLabel + "</td>" +
      "<td>" + nomHzCell + "</td>" +
      "<td>" + percHzCell + "</td>" +
      "<td>" + diffHzCell + "</td>" +
      "<td>" + diffCtCell + "</td>" +
      "<td>" + restspanneCell + "</td>" +
      "<td>" + residuumCell + "</td>" +
      "<td style=\"font-size:.9em\">" + vorherCell + "</td>" +
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
      if (_pianoRun && _pianoRun.durchlauf >= 1) {
        txt = t('FRQ_resultsQualityPiano')
          .replace('{round}', _pianoRun.durchlauf);
      }
    }
    qEl.textContent = txt;
    qEl.style.display = txt ? '' : 'none';
  }

  // Chart
  const cv = document.getElementById("FRQ_resultsChart");
  if (cv) {
    const _rows = FRQ_ergebnisRows(aktivSide, {});
    const _wand = _FRQ_bandWandFuerGraph(aktivSide);
    drawFRQGraph(cv, _rows, {
      residuumAnker: "punkt",
      amberband: true,
      xWandHz: _wand,
      yLabel: t("FRQ_resultsChartYLabel"),
      titel: "FRQ_titel_ergebnis",
      bewertung: "problem",
      verbindung: true
      // BA491: kein yMaxFest -> Auto-Skala aus Rohdaten (drawFRQGraph chart.js:462-470)
    });
    if (!cv._frqg_listener) {
      cv.addEventListener("mousemove", (e) => _frqg_tooltipHandler(cv, e));
      cv.addEventListener("mouseleave", () => {
        const tip = document.getElementById("frqg_tooltip");
        if (tip) tip.style.display = "none";
      });
      cv._frqg_listener = true;
    }
    const hintEl = document.getElementById("FRQ_resultsChartHint");
    if (hintEl) {
      hintEl.innerHTML = FRQ_legendeHtml("ergebnis",
        frqLegendData({ amberband: true, bewertung: "problem" }, _rows));
    }
  }
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
  // BA491: Achse 2 -> globaler FRQ_distribution (nicht Referenzmodus).
  var modus = (typeof modusOverride === "string")
    ? modusOverride
    : ((typeof FRQ_distribution === "string") ? FRQ_distribution : "right");
  // BA463: Verfahren/Topologie/Optimieren/Ziel/Randausgleich liegen jetzt
  // pro Seite in sideData -> FRQ_werte zieht sie SEITENRICHTIG selbst
  // (undefined = kein Override). Nur modus/nhSim bleiben Aufrufer-Sache.
  return (typeof FRQ_werte === "function")
    ? FRQ_werte("gehoert", modus, !!nhSim)
    : [];
}

// BA462: gewählte Bandgrenzen-Wand [loHz, hiHz] einer Seite als xWandHz-
// Array für die Graph-Engine. Fallback defaultRange (wie Berechnung 7a).
// null, wenn keine Wand bekannt.
function _FRQ_bandWandFuerGraph(side) {
  var s = sideData[side];
  if (!s) return null;
  if (typeof s.bandWandLo === "number" && typeof s.bandWandHi === "number")
    return [s.bandWandLo, s.bandWandHi];
  var dr = (MFR[s.manufacturer]) ? MFR[s.manufacturer].defaultRange : null;
  return (dr && dr.length === 2) ? [dr[0], dr[1]] : null;
}

// BA474: Render-Einstieg des Top-Reiters "Frequenzbaender". Ruft den
// Bandgrenzen-Renderer UNABHAENGIG von FRQ_resultsArray (der Reiter zeigt auch
// ohne Frequenzabgleich-Messung die Baender aus den Nominalfrequenzen --
// FRQ_werte liefert nominellHz immer, core.js:1708). Ausserhalb der
// DOMContentLoaded-Closure deklariert, weil switchTab (tabs-eq.js) sie
// cross-file ruft (Leitlinien: Closure-Falle).
function FRQ_renderBaenderTab() {
  // BA492: Dropdown der Korrektur-Seite auf den globalen Zustand spiegeln.
  var _ds = document.getElementById("FRQ_distributionSelect");
  if (_ds && typeof FRQ_distribution === "string" && _ds.value !== FRQ_distribution) {
    _ds.value = FRQ_distribution;
  }
  var aktivSide = (typeof activeSide === "string") ? activeSide
    : (sideData.left.config === "ci" ? "left" : "right");
  // Ketten-Auswahl-Summary bei jedem Reiter-Eintritt neu berechnen. Der
  // Init-Aufruf (init.js) lief evtl. vor befuelltem sideData -> stand sonst
  // dauerhaft auf "0 von 0", bis der Auswahl-Dialog bestaetigt wurde.
  if (typeof _frqChainSelUpdate === "function") _frqChainSelUpdate();
  _FRQ_renderBandEmpf(aktivSide);
}

// BA501: effektiver Ausgangspunkt-Wert einer Elektrodenseite fuer den
// Bandgraphen. Loest die globale Wahl FRQ_bandAusgang + die seiten-
// globalen Zusammenfall-Regeln (§10.3) auf EINEN Hz-Wert auf:
//   nominell  -> nominellHz (faellt nie zurueck)
//   gemessen  -> gehoertHz, sonst nominellHz (ungemessen)
//   geglaettet-> gehoertHzGlatt, sonst gehoertHz, sonst nominellHz
// ws = seite aus FRQ_empfWerte (das side-Objekt einer Elektrode).
function _FRQ_bandAusgangHz(ws, wahl) {
  if (!ws) return null;
  if (wahl === "nominell") return ws.nominellHz;
  if (wahl === "gemessen") return (ws.gehoertHz != null) ? ws.gehoertHz : ws.nominellHz;
  // geglaettet (Default)
  if (ws.gehoertHzGlatt != null) return ws.gehoertHzGlatt;
  return (ws.gehoertHz != null) ? ws.gehoertHz : ws.nominellHz;
}

function _FRQ_renderBandEmpf(side) {
  var head = document.getElementById("FRQ_bandEmpfTableHead");
  var body = document.getElementById("FRQ_bandEmpfTableBody");
  var note = document.getElementById("FRQ_bandEmpfOverlapNote");
  if (!head || !body) return;

  // BA501: Radios auf den globalen Ausgangspunkt spiegeln.
  var _ar = document.querySelectorAll('input[name="FRQ_bandAusgang"]');
  for (var _ri = 0; _ri < _ar.length; _ri++) {
    _ar[_ri].checked = (_ar[_ri].value === FRQ_bandAusgang);
  }
  // Zusammenfall-Hinweise (§10.3), seiten-global. "gemessen" gilt als
  // eigenstaendig, sobald mind. eine Elektrode gemessen ist.
  var _hinw = document.getElementById("FRQ_bandAusgangHinweis");
  var _hinwRow = document.getElementById("FRQ_bandAusgangHinweisRow");
  if (_hinw && _hinwRow) {
    var _glattAus = (sideData[side].bandGlaettVerfahren === "aus");
    var _wDbg = FRQ_empfWerte(false);
    var _keineMessung = true;
    for (var _wi = 0; _wi < _wDbg.length; _wi++) {
      if (_wDbg[_wi] && _wDbg[_wi].gemessen) { _keineMessung = false; break; }
    }
    var _zeilen = [];
    if (_glattAus)     _zeilen.push(t("FRQ_bandAusgangFallGlatt"));
    if (_keineMessung) _zeilen.push(t("FRQ_bandAusgangFallGem"));
    if (_zeilen.length) {
      _hinwRow.style.display = "";
      _hinw.innerHTML = _zeilen.join("<br>");
    } else {
      _hinwRow.style.display = "none";
      _hinw.innerHTML = "";
    }
  }

  // BA458: Empfehlungs-Graph gegen die gemeinsame Engine drawFRQGraph.
  // rows aus derselben Wertquelle wie die Tabelle unten (FRQ_empfWerte),
  // damit Graph und Tabelle nie divergieren (vgl. BA452).
  var _bcv = document.getElementById("FRQ_bandEmpfChart");
  if (_bcv && typeof drawFRQGraph === "function") {
    var _werte = FRQ_empfWerte(false);
    var _rows = [];
    var _nCi = sideData[side].nEl;
    // Farben der zwei blassen Vergleichskurven (dieselbe Reihenfolge wie
    // _blass im Schleifenkoerper): die zwei NICHT gewaehlten Ausgangspunkte.
    var _blassFarben = [];
    if (FRQ_bandAusgang !== "gemessen")   _blassFarben.push("blau");
    if (FRQ_bandAusgang !== "geglaettet") _blassFarben.push("gruen");
    if (FRQ_bandAusgang !== "nominell")   _blassFarben.push("schwarz");
    // Farbe der kraeftigen (gewaehlten) Kurve:
    var _kraeftigFarbe = (FRQ_bandAusgang === "gemessen") ? "blau"
                       : (FRQ_bandAusgang === "nominell") ? "schwarz" : "gruen";
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
      var _center = _ws.bandCenterHz;
      var _resid = (_ws.restspanne != null) ? _ws.restspanne : 0;
      var _residDown = (_ws.residDown != null) ? _ws.residDown : 0;
      var _residUp   = (_ws.residUp   != null) ? _ws.residUp   : 0;
      // Drei Ausgangspunkt-Hz je Kurve (§10). Fehlende Werte -> null-Kurve.
      var _hzNom  = _ws.nominellHz;
      var _hzGem  = (_ws.gehoertHz != null) ? _ws.gehoertHz : _ws.nominellHz;
      var _hzGlat = (_ws.gehoertHzGlatt != null && _ws.gehoertHzGlatt > 0)
        ? _ws.gehoertHzGlatt
        : _hzGem;
      // Abweichung Bandmitte gegen einen Ausgangspunkt in Cent.
      var _devVon = function (hz) {
        return (hz != null && hz > 0) ? 1200 * Math.log2(_center / hz) : null;
      };
      var _devNom  = _devVon(_hzNom);
      var _devGem  = _devVon(_hzGem);
      var _devGlat = _devVon(_hzGlat);
      // Der GEWAEHLTE Ausgangspunkt ist die kraeftige Kurve (_target/_dev,
      // Ampelpunkt); die anderen zwei sind blass (yCent2/yCent3).
      var _target = _FRQ_bandAusgangHz(_ws, FRQ_bandAusgang);
      if (_target == null) continue;
      var _dev = _devVon(_target);
      // Zwei blasse Kurven = die zwei NICHT gewaehlten Ausgangspunkte,
      // in fester Farbzuordnung (blau=gemessen, gruen=geglaettet,
      // schwarz=nominell). yCent2/yCent3-Farbe kommt aus cfg (unten).
      var _blass = [];
      if (FRQ_bandAusgang !== "gemessen")   _blass.push({ dev: _devGem,  farbe: "blau" });
      if (FRQ_bandAusgang !== "geglaettet") _blass.push({ dev: _devGlat, farbe: "gruen" });
      if (FRQ_bandAusgang !== "nominell")   _blass.push({ dev: _devNom,  farbe: "schwarz" });
      var _elNum = dEN(_i, side);
      // FBF: Punkt zeigt Messkonsistenz (Messung <-> Nachbar-Kurve),
      // Striche gehoert->Kurve. Sonst: Mitten-Abweichung wie bisher (§5.1).
      var _gemessen = !!(_w && _w.gemessen);   // BA483 (§15.5)
      var _yCent   = _dev;
      var _xLinks  = _target;                            // gewaehlter Ausgangspunkt
      var _xRechts = _center;                            // Bandmitte
      var _stufe = !_gemessen ? null
        : FRQ_bewertungsStufe(_dev, _residDown, _residUp);
      var _bew = (_stufe === "gruen") ? t("FRQ_bandEmpfRatingNoise")
               : (_stufe === "amber") ? t("FRQ_bandEmpfRatingSlight")
               : t("FRQ_bandEmpfRatingClear");
      var _devTxt = (_dev != null ? (_dev >= 0 ? "+" : "") + fmtNum(_dev, "cent") + " ct" : "-");
      _rows.push({
        elNum: _elNum,
        xLinksHz: _xLinks,
        xRechtsHz: _xRechts,
        yCent: _yCent,             // kraeftige Kurve = gewaehlter Ausgangspunkt, bewertet
        yCent2: (_blass[0] ? _blass[0].dev : null),   // erste blasse Vergleichskurve
        yCent3: (_blass[1] ? _blass[1].dev : null),   // zweite blasse Vergleichskurve
        residDownCent: _residDown, residUpCent: _residUp, restspanneCent: _resid,
        bandLoHz: _ws.bandLoHz,
        bandHiHz: _ws.bandHiHz,
        sichtbar: true,
        warn: false,   // Bandgraph: keine Konsistenz-Warnung mehr
        stufe: _stufe,
        tooltip: [
          "<b>E" + _elNum + "</b>",
          t("FRQ_bandAusgang_" + FRQ_bandAusgang) + ": " + fmtNum(_target, "hz") + " Hz",
          t("FRQ_bandTipReached") + ": " + fmtNum(_center, "hz") + " Hz",
          t("FRQ_bandTipShift") + ": " + _devTxt + " · " + _bew,
          t("FRQ_bandTipBand") + ": " + fmtNum(_ws.bandLoHz, "hz") + " – "
            + fmtNum(_ws.bandHiHz, "hz") + " Hz"
        ]
      });
    }
    var _wand = _FRQ_bandWandFuerGraph(side);
    drawFRQGraph(_bcv, _rows, {
      residuumAnker: "nulllinie",
      xWandHz: _wand,
      yLabel: t("FRQ_resultsChartYLabel"),
      verbindung: true,
      linienfarbe: _kraeftigFarbe,          // BA501: gewaehlter Ausgangspunkt = kraeftig
      zweitkurve: _blassFarben[0] || null,  // erste blasse Vergleichskurve
      drittkurve: _blassFarben[1] || null,  // zweite blasse Vergleichskurve
      amberband: false,
      restspanne: false,          // Frequenzbaender-Reiter: keine Restspanne (nur Residuum)
      titel: "FRQ_titel_band",
      bewertung: "ampel",
      yMaxFest: FRQ_yMaxCent()    // BA485: gemeinsame Skala aus Rohdaten
    });
    var _bHint = document.getElementById("FRQ_bandEmpfChartHint");
    if (_bHint) {
      _bHint.innerHTML = FRQ_legendeHtml("band",
        frqLegendData({ linienfarbe: _kraeftigFarbe, zweitkurve: _blassFarben[0] || null,
          drittkurve: _blassFarben[1] || null, amberband: false, restspanne: false, bewertung: "ampel" }, _rows));
    }
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
    "<th>" + t("FRQ_bandEmpfColTarget") + " (" + t("FRQ_bandAusgang_" + FRQ_bandAusgang) + ")</th>" +
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
  var _sd = sideData[side];
  for (var i = 0; i < nCi; i++) {
    var elLabel = dENPrefix(side) + dEN(i, side);

    // BA481 (§3): zwei sichtbare Deaktivierungs-Zustaende statt Ueberspringen.
    // "bereits deaktiviert" (elActive===false) hat Vorrang vor "vorgemerkt".
    var _bereitsDeakt = !!(_sd.elActive && _sd.elActive[i] === false);
    var _vorgemerkt   = !_bereitsDeakt
      && !!(_sd.elFreqChain && _sd.elFreqChain[i] === false);
    if (_bereitsDeakt || _vorgemerkt) {
      var _statusTxt = _bereitsDeakt
        ? t("FRQ_bandEmpfAlreadyDeact")
        : t("FRQ_bandEmpfMarkedForDeact");
      rows += "<tr>"
        + "<td style=\"font-weight:600\">" + elLabel + "</td>"
        + "<td>" + dash + "</td>"
        + "<td>" + dash + "</td>"
        + "<td>" + dash + "</td>"
        + "<td>" + dash + "</td>"
        + "<td><span style=\"color:var(--text-muted);font-style:italic\">"
          + _statusTxt + "</span></td>"
        + "</tr>";
      continue;
    }

    var w = null;
    for (var k = 0; k < werte.length; k++) { if (werte[k].elIdx === i) { w = werte[k]; break; } }
    var ws = w ? w[side] : null;

    if (ws && ws.bandOverlap) {
      overlapSeen = true;
      if (ws.bandError === "abfTonoZuKlein") abfTooSmall = true;
    }

    var target = _FRQ_bandAusgangHz(ws, FRQ_bandAusgang);
    var lo = ws ? ws.bandLoHz : null;
    var hi = ws ? ws.bandHiHz : null;
    var center = ws ? ws.bandCenterHz : null;
    var residDown = (ws && ws.residDown != null) ? ws.residDown : null;
    var residUp   = (ws && ws.residUp   != null) ? ws.residUp   : null;

    var targetCell = (target != null) ? fmtNum(target, "hz") + " Hz" : dash;
    var rangeCell = (lo != null && hi != null)
      ? fmtNum(lo, "hz") + " &#8211; " + fmtNum(hi, "hz") + " Hz" : dash;
    var centerCell = (center != null) ? fmtNum(center, "hz") + " Hz" : dash;

    var devCent = null;
    if (center != null && target != null && center > 0 && target > 0) {
      devCent = 1200 * Math.log2(center / target);
    }
    var devConsist = devCent;
    var devCell = (devConsist != null)
      ? (devConsist >= 0 ? "+" : "") + fmtNum(devConsist, "cent") + " ct" : dash;

    var ratingCell = dash;
    // BA483 (§15.5): Bewertung nur fuer echt gemessene Elektroden. Nach BA482
    // hat eine ungemessene aktive Elektrode resid=1200 (!= null) und ein
    // berechenbares devConsist -> ohne diese Bedingung wuerde sie faelschlich
    // bewertet statt in den Vorschlags-Zweig (else if) zu fallen.
    if (w && w.gemessen && devConsist != null && (residDown != null || residUp != null)) {
      var _rDown = (residDown != null) ? residDown : 0;
      var _rUp   = (residUp   != null) ? residUp   : 0;
      var kante  = (devConsist >= 0) ? _rUp : _rDown;
      var ueber  = Math.abs(devConsist) - kante;
      var _bStufe = FRQ_bewertungsStufe(devConsist, _rDown, _rUp);
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

    // BA528: Stumme Elektrode -> Hinweis in der Rating-Spalte anhaengen.
    if (_sd.elSt && _sd.elSt[i] === "mute") {
      var _stummHinweis = "<span style=\"color:var(--text-muted);font-style:italic;display:block\">"
        + t("FRQ_bandStumm") + "</span>";
      ratingCell = (ratingCell !== dash ? ratingCell : "") + _stummHinweis;
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

// BA 505: Zwei Klaviere im Frequenzbaender-Reiter. Beide spielen je
// Elektrode die aktive und die inaktive Seite als A-B-A-B (2 Durchlaeufe).
// Sie unterscheiden sich NUR im Frequenz-Extraktor (gehoertHzGlatt vs.
// bandCenterHz). EIN gemeinsamer Bauer + EIN Oeffner, parametrisiert.

// Geteilter State-Satz fuer beide Klaviere (Nutzer: gemeinsam).
var FRQ_pianoVolume   = 25;     // Prozent
var FRQ_pianoDuration = 500;    // ms je Ton
var FRQ_pianoPause    = 250;    // ms zwischen Toenen
// Box-Korrektor-fn (aus onTogglesReady); null bis die Box erstmals geoeffnet wird.
var _frqPianoCorrFn   = null;

// Werte-Zugriff: das FRQ_werte-Array nach elIdx, aktueller Modus.
// BA507: form waehlbar (klavierGlatt|klavierBand); liefert left.hz/right.hz.
function _frqPianoWerteByIdx(form) {
  var modus = (typeof FRQ_distribution === "string") ? FRQ_distribution : "right";
  var werte = (typeof FRQ_werte === "function")
    ? FRQ_werte(form, modus, false) : [];
  var byIdx = {};
  for (var i = 0; i < werte.length; i++) byIdx[werte[i].elIdx] = werte[i];
  return byIdx;
}

// Grundlautstaerke (quadratische Kennlinie, vgl. ui-implant.js:381).
function _frqPianoBaseVol() {
  return Math.pow(FRQ_pianoVolume / 100, 2);
}

// Ein Ton-Token fuer eine Seite. hz kann null sein -> null (Ton auslassen).
// Lautstaerke ueber die Box-Korrektor-fn (Elektrodenlautstaerke + Balance);
// taube Seite stumm.
function _frqPianoToken(hz, side) {
  if (hz == null || !(hz > 0)) return null;
  var pan = (side === "left") ? -1 : 1;
  var vol = _frqPianoBaseVol();
  if (typeof isDeaf === "function" && isDeaf(side)) {
    vol = 0;
  } else if (typeof _frqPianoCorrFn === "function") {
    vol = _frqPianoCorrFn(vol, hz, pan);
  } else if (typeof corrVol === "function") {
    vol = corrVol(vol, side, hz, true, true);
  }
  return { hz: hz, pan: pan, vol: vol, durationMs: FRQ_pianoDuration };
}

// A-B-A-B-Token-Array fuer eine Elektrode. BA507: form statt extract;
// die Frequenzen kommen fertig als wr[side].hz aus der Klavier-Form.
function _frqPianoSequence(elIdx, form) {
  var byIdx = _frqPianoWerteByIdx(form);
  var wr = byIdx[elIdx];
  if (!wr) return [];
  var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  var gegenSide = (aktivSide === "left") ? "right" : "left";
  var hzA = wr[aktivSide] ? wr[aktivSide].hz : null;
  var hzB = wr[gegenSide] ? wr[gegenSide].hz : null;
  var tokA = _frqPianoToken(hzA, aktivSide);
  var tokB = _frqPianoToken(hzB, gegenSide);
  if (!tokA) return [];
  function durchlauf(seq) {
    seq.push(tokA);
    if (tokB) { seq.push({ pauseMs: FRQ_pianoPause }); seq.push(tokB); }
  }
  var seq = [];
  durchlauf(seq);
  seq.push({ pauseMs: FRQ_pianoPause });
  durchlauf(seq);
  return seq;
}

// Ausgegraute Elektroden: aktive Seite hat keine Frequenz (s.hz == null).
// BA507: form statt extract; liest wr[aktivSide].hz aus der Klavier-Form.
function _frqPianoDisabled(form) {
  var byIdx = _frqPianoWerteByIdx(form);
  var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  var s = sideData[aktivSide];
  var n = (s && s.nEl) ? s.nEl : 0;
  var dis = [];
  for (var i = 0; i < n; i++) {
    if (s.elActive && s.elActive[i] === false) { dis.push(i); continue; }
    var wr = byIdx[i];
    var hz = (wr && wr[aktivSide]) ? wr[aktivSide].hz : null;
    if (hz == null || !(hz > 0)) dis.push(i);
  }
  return dis;
}

// Tasten-Frequenzen der aktiven Seite (Anzeige).
function _frqPianoFreqs() {
  var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  var s = sideData[aktivSide];
  var n = (s && s.nEl) ? s.nEl : 0;
  var arr = [];
  withSide(aktivSide, function () {
    for (var i = 0; i < n; i++) arr.push(FRQ_implantatEffektiv(i));
  });
  return arr;
}

// Tasten-Labels der aktiven Seite.
function _frqPianoLabels() {
  var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  var s = sideData[aktivSide];
  var n = (s && s.nEl) ? s.nEl : 0;
  var arr = [];
  withSide(aktivSide, function () {
    var prefix = (typeof dENPrefix === "function") ? dENPrefix() : "E";
    for (var i = 0; i < n; i++) arr.push(prefix + ((typeof dEN === "function") ? dEN(i) : (i + 1)));
  });
  return arr;
}

// Tonart-Merker pro Modal-Instanz.
var _frqPianoModalTone = null;

// Der EINE Oeffner. titleKey = Modal-Titel, form = Klavier-Form (BA507).
function _frqOpenPiano(titleKey, form) {
  if (typeof openToneSelectionDialog !== "function") return;
  openToneSelectionDialog({
    getToneType:    function ()   { return _frqPianoModalTone || "sine"; },
    setToneType:    function (tt) { _frqPianoModalTone = tt; },
    onToneSelected: function (tt) { _frqPianoModalTone = tt; },
    onModalClose:   function ()   { _frqPianoModalTone = null; },

    titleKey: titleKey,

    showVolume:   true,
    showDuration: true,
    showPause:    true,
    getVolumePercent: function ()  { return FRQ_pianoVolume; },
    setVolumePercent: function (v) { FRQ_pianoVolume = v; },
    getDurationMs:    function ()  { return FRQ_pianoDuration; },
    setDurationMs:    function (v) { FRQ_pianoDuration = v; },
    getPauseMs:       function ()  { return FRQ_pianoPause; },
    setPauseMs:       function (v) { FRQ_pianoPause = v; },
    getVolume:        function ()  { return _frqPianoBaseVol(); },

    // Korrektur-Toggles (Elektrodenlautstaerke + Balance).
    // Die Box-Korrektor-fn wird in _frqPianoToken verwendet; so greifen
    // die Box-Schalter automatisch ohne eigene Merker-Variablen.
    showToggles: true,
    onTogglesReady: function (fn) { _frqPianoCorrFn = fn; },

    getPreviewSequence: function (lastHz) {
      var hz = (typeof lastHz === "number" && lastHz > 0) ? lastHz : 1000;
      var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
      var tok = _frqPianoToken(hz, aktivSide);
      return tok ? [tok] : [];
    },

    keyboardMode:          true,
    getElectrodeFreqs:     _frqPianoFreqs,
    getElectrodeLabels:    _frqPianoLabels,
    getDisabledElectrodes: function () { return _frqPianoDisabled(form); },

    getPressSequence: function (electrodeIdx, hz) {
      if (electrodeIdx < 0) {
        var aktivSide = (typeof activeSide === "string") ? activeSide : "right";
        var tok = _frqPianoToken(hz, aktivSide);
        return tok ? [tok] : [];
      }
      return _frqPianoSequence(electrodeIdx, form);
    }
  });
}

// Die zwei konkreten Oeffner (nur die form ist fall-spezifisch).
function FRQ_openGlaettPiano() {
  _frqOpenPiano("FRQ_glaettPianoTitle", "klavierGlatt");
}
function FRQ_openBandPiano() {
  _frqOpenPiano("FRQ_bandPianoTitle", "klavierBand");
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
