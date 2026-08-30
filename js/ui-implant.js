// ============================================================
// UI IMPLANT CARD
// ============================================================
// FSP-Kodierung (nur MED-EL): Zahl der apikalen Feinstruktur-Elektroden
// je Strategie. "unknown"/"hdcis" ohne Feinstruktur -> 0 (keine Spalte).
const IMPL_CODING_STRATS = ["unknown", "hdcis", "fsp", "fs4", "fs4p"];
const IMPL_CODING_FSP_MAX = { unknown: 0, hdcis: 0, fsp: 3, fs4: 4, fs4p: 4 };
function implCodingFspMax(coding) {
  return IMPL_CODING_FSP_MAX[coding] || 0;
}
function implCodingHasFsp(coding) {
  return implCodingFspMax(coding) > 0;
}

function buildImplantCard() {
  const s = sideData[activeSide];
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      generation: null,
      coding: "unknown",
      fspEl: new Array(s.nEl).fill(false),
      mcl: new Array(s.nEl).fill(null),
      thr: new Array(s.nEl).fill(null),
      upperLevel: new Array(s.nEl).fill(null),
    };
  // Alt-Objekte ohne die neuen Felder nachrüsten (verlustfrei).
  if (s.implant.coding === undefined) s.implant.coding = "unknown";
  if (!Array.isArray(s.implant.fspEl))
    s.implant.fspEl = new Array(s.nEl).fill(false);
  const im = s.implant;
  const m = s.manufacturer;
  const cfg = s.config || "ci";
  const isCiCfg = cfg === "ci";

  // i18n
  const implTitleEl = document.getElementById("implTitle");
  if (implTitleEl) implTitleEl.textContent = t("implTitle");
  // BA 165: Sichtbarkeit nach Konzept — sichtbar solange ≥1 Seite „Keine Angabe"
  const bilatEl = document.getElementById("implBilateralHintEl");
  if (bilatEl) {
    const leftUnknown  = (sideData.left.config  || "unknown") === "unknown";
    const rightUnknown = (sideData.right.config || "unknown") === "unknown";
    const showBilat = leftUnknown || rightUnknown;
    bilatEl.innerHTML = t("implBilateralHint");
    bilatEl.style.display = showBilat ? "block" : "none";
  }
  document.getElementById("lblImplModel").textContent = t("lblImplModel");
  document.getElementById("lblImplProc").textContent = t("lblImplProc");
  document.getElementById("lblImplC").textContent = t("lblImplC");
  document.getElementById("lblImplIDR").textContent = t("lblImplIDR");
  const genLbl = document.getElementById("lblImplGen");
  if (genLbl) genLbl.textContent = t("lblImplGen");

  // Konfiguration-Dropdown setzen und beschriften
  const cfgSel = document.getElementById("cfgSelect");
  if (cfgSel) {
    cfgSel.value = cfg;
    const lbl = document.getElementById("lblCfg");
    if (lbl) {
      const sideLbl = activeSide === "left" ? t("sideLeft") : t("sideRight");
      lbl.textContent = t("cfgLabel") + " " + sideLbl + ":";
    }
    const opts = {
      cfgOptUnknown: "cfgUnknown", cfgOptCI: "cfgCI", cfgOptHG: "cfgHG",
      cfgOptNormal: "cfgNormal", cfgOptSchwerh: "cfgSchwerh",
      cfgOptTaub: "cfgTaub",
    };
    Object.entries(opts).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = t(key);
    });
    // BA 154: Hersteller-Option „Keine Angabe"
    const mfrOptUnknown = document.getElementById("mfrOptUnknown");
    if (mfrOptUnknown) mfrOptUnknown.textContent = t("mfrUnknown");
  }

  // BA 154: Cascade
  const isUnknownCfg = cfg === "unknown";
  const isUnknownMfr = isCiCfg && (s.manufacturer === "unknown" || !s.manufacturer);

  const mfrBlock = document.getElementById("implMfrBlock");
  if (mfrBlock) mfrBlock.style.display = isCiCfg ? "" : "none";
  // BA 165: Dropdown-Wert hart auf State sync (Bug A1: Anzeige blieb sonst hängen)
  const mfrSelEl = document.getElementById("mfrSelect");
  if (mfrSelEl) mfrSelEl.value = s.manufacturer || "unknown";

  // BA 165: Tabellen-Intro — nur sichtbar, wenn die Tabelle gerendert wird
  const showTable = isCiCfg && !isUnknownMfr;
  const tableIntroEl = document.getElementById("implTableIntroEl");
  if (tableIntroEl) {
    tableIntroEl.innerHTML = t("implTableIntro");
    tableIntroEl.style.display = showTable ? "block" : "none";
  }
  // Gelbe Hinweisbox zu den Defaultwerten — Sichtbarkeit wie das Intro
  const defaultsHintEl = document.getElementById("implTableDefaultsHintEl");
  if (defaultsHintEl) {
    defaultsHintEl.innerHTML = t("implTableDefaultsHint");
    defaultsHintEl.style.display = showTable ? "" : "none";
  }

  // Hörtechnik-Hinweis
  const hintCfgUn = document.getElementById("cfgHintUnknownEl");
  if (hintCfgUn) {
    hintCfgUn.style.display = isUnknownCfg ? "" : "none";
    if (isUnknownCfg) hintCfgUn.textContent = t("cfgHintUnknown");
  }
  // Hersteller-Hinweis
  const hintMfrUn = document.getElementById("mfrHintUnknownEl");
  if (hintMfrUn) {
    hintMfrUn.style.display = (isCiCfg && isUnknownMfr) ? "" : "none";
    if (isCiCfg && isUnknownMfr) hintMfrUn.textContent = t("mfrHintUnknown");
  }

  // Hinweise
  const hintAc = document.getElementById("cfgHintAcousticEl");
  const hintDeaf = document.getElementById("cfgHintDeafEl");
  if (hintAc) {
    const isAcoustic = ["hg","normal","shoh"].includes(cfg);
    const src = FRQ_implantatGetSource();
    // BA 165: Hinweis nur sinnvoll, wenn andere Seite tatsächlich CI ist.
    // Sonst greift cfgHintBothAcoustic (an anderer Stelle gerendert).
    const showAc = isAcoustic && !!src;
    hintAc.style.display = showAc ? "" : "none";
    if (showAc) {
      const srcLabel = src === "left" ? t("sideLeft") : t("sideRight");
      hintAc.textContent = t("cfgHintAcoustic").replace("{otherSide}", srcLabel);
    }
  }
  if (hintDeaf) {
    hintDeaf.style.display = cfg === "deaf" ? "" : "none";
    if (cfg === "deaf") hintDeaf.textContent = t("cfgHintDeaf");
  }

  // BA 155: beide Seiten akustisch
  const hintBothAc = document.getElementById("cfgHintBothAcousticEl");
  if (hintBothAc) {
    const leftCfg  = sideData.left.config  || "unknown";
    const rightCfg = sideData.right.config || "unknown";
    const isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
    const bothAcoustic = isAc(leftCfg) && isAc(rightCfg);
    hintBothAc.style.display = bothAcoustic ? "" : "none";
    if (bothAcoustic) hintBothAc.innerHTML = t("cfgHintBothAcoustic");
  }

  // Deaf-Hinweis im Test-Bereich
  const deafTestHint = document.getElementById("cfgDeafTestHintEl");
  if (deafTestHint) {
    const hasDeaf = (sideData.left.config || "ci") === "deaf"
                 || (sideData.right.config || "ci") === "deaf";
    deafTestHint.style.display = hasDeaf ? "" : "none";
    if (hasDeaf) deafTestHint.textContent = t("cfgHintDeafTest");
  }

  if (!isCiCfg) {
    // Kein Hersteller-spezifischer Block nötig – früh zurück
    return;
  }

  // BA 154: Sub-Blöcke bei unknown Hersteller verstecken und früh zurück
  if (isUnknownMfr) {
    ["implMedelParams","implAbParams"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const gg = document.getElementById("implGenGroup");
    if (gg) gg.style.display = "none";
    const prRow = document.getElementById("implProcRow");
    if (prRow) prRow.style.display = "none";
    const mdRow = document.getElementById("implModelRow");
    if (mdRow) mdRow.style.display = "none";
    return;
  }
  // 2026-08-30: Audioprozessor-, Implantat-Modell- und Kodierungsstrategie-
  // Auswahl dauerhaft ausgeblendet (aus dem UI genommen). Die Dropdowns und
  // ihre Datenfelder (processor/model/coding/generation) bleiben im Code
  // erhalten, werden nur nicht mehr angezeigt.
  const prRow = document.getElementById("implProcRow");
  if (prRow) prRow.style.display = "none";
  const mdRow = document.getElementById("implModelRow");
  if (mdRow) mdRow.style.display = "none";

  // Show/hide manufacturer-specific params
  // 2026-08-30: implMedelParams (Kodierungsstrategie + ausgeblendeter c-Wert)
  // und implGenGroup (Cochlear-Generation) dauerhaft ausgeblendet — beide
  // enthalten nur noch UI-verborgene Felder. AB-IDR (implAbParams) bleibt.
  document.getElementById("implMedelParams").style.display = "none";
  document.getElementById("implAbParams").style.display =
    (IMPL_HERSTELLERWERTE && m === "ab") ? "" : "none";
  const genGrp = document.getElementById("implGenGroup");
  if (genGrp) genGrp.style.display = "none";

  // Fill model dropdown
  const mdSel = document.getElementById("implModelSelect");
  const prevModel = im.model;
  mdSel.innerHTML = "";
  const optPls = document.createElement("option");
  optPls.value = "";
  optPls.textContent = t("implSelectPleaseHdr");
  mdSel.appendChild(optPls);
  const optUnk = document.createElement("option");
  optUnk.value = "unknown";
  optUnk.textContent = t("implUnknown");
  mdSel.appendChild(optUnk);
  (IMPLANTS[m] || []).forEach((entry) => {
    const o = document.createElement("option");
    o.value = entry.model;
    o.textContent = entry.model + (entry.year ? " (" + entry.year + ")" : "");
    mdSel.appendChild(o);
  });
  mdSel.value = prevModel || "";
  if (!mdSel.value && prevModel) mdSel.value = "";

  // Fill processor dropdown
  const prSel = document.getElementById("implProcSelect");
  const prevProc = im.processor;
  prSel.innerHTML = "";
  const optPls2 = document.createElement("option");
  optPls2.value = "";
  optPls2.textContent = t("implSelectPleaseHdr");
  prSel.appendChild(optPls2);
  const optUnk2 = document.createElement("option");
  optUnk2.value = "unknown";
  optUnk2.textContent = t("implUnknown");
  prSel.appendChild(optUnk2);
  (PROCESSORS[m] || []).forEach((entry) => {
    const o = document.createElement("option");
    o.value = entry.model;
    o.textContent = entry.model + (entry.year ? " (" + entry.year + ")" : "");
    prSel.appendChild(o);
  });
  prSel.value = prevProc || "";

  // Global params
  if (m === "medel") {
    const ci = document.getElementById("implC");
    if (ci) ci.value = im.cValue !== null ? im.cValue : "";
    // FSP-Kodierungs-Dropdown
    const lblCod = document.getElementById("lblImplCoding");
    if (lblCod) lblCod.textContent = t("lblImplCoding");
    const codSel = document.getElementById("implCodingSelect");
    if (codSel) {
      if (IMPL_CODING_STRATS.indexOf(im.coding) === -1) im.coding = "unknown";
      codSel.value = im.coding;
    }
  }
  if (m === "ab") {
    const ii = document.getElementById("implIDR");
    if (ii) ii.value = im.idr !== null ? im.idr : "";
  }
  if (m === "cochlear") {
    updCochlearGen();
  }

  // Attach dropdown change events
  mdSel.onchange = function () {
    sideData[activeSide].implant.model = this.value;
    if (sideData[activeSide].manufacturer === "cochlear") updCochlearGen();
  };
  prSel.onchange = function () {
    sideData[activeSide].implant.processor = this.value;
  };
  const ci = document.getElementById("implC");
  if (ci)
    ci.onchange = function () {
      sideData[activeSide].implant.cValue =
        this.value !== "" ? parseNum(this.value) : null;
      if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
      if (typeof pMaplawTrigger === "function" && pMaplawOn) pMaplawTrigger();
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    };
  const codSel = document.getElementById("implCodingSelect");
  if (codSel)
    codSel.onchange = function () {
      const imp = sideData[activeSide].implant;
      const prev = imp.coding;
      const next = this.value;
      imp.coding = next;
      if (!Array.isArray(imp.fspEl)) imp.fspEl = new Array(sideData[activeSide].nEl).fill(false);
      const wasFsp = implCodingHasFsp(prev);
      const nowFsp = implCodingHasFsp(next);
      // Erster Wechsel auf eine FS-Strategie: E1 als Vorbelegung markieren
      // (danach frei änderbar; nicht erzwungen).
      if (!wasFsp && nowFsp && !imp.fspEl.some((v) => v === true)) {
        imp.fspEl[0] = true;
      }
      // Markierungen jenseits des neuen Limits löschen (z. B. FS4->FSP: E4 raus).
      const max = implCodingFspMax(next);
      for (let i = max; i < imp.fspEl.length; i++) imp.fspEl[i] = false;
      // BA476: Randausschluss der Glaettung an die (evtl. gerade geaenderte)
      // FSP-Anzahl koppeln. Deckt E1-Vorbelegung, Limit-Loeschung und Wechsel
      // auf eine Kodierung ohne FSP (-> 0) ab.
      FRQ_randausschlussAusFsp(activeSide);
      FRQ_implantatTableBuild();
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    };
  const ii = document.getElementById("implIDR");
  if (ii)
    ii.onchange = function () {
      sideData[activeSide].implant.idr =
        this.value !== "" ? parseNum(this.value) : null;
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    };
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
}

function updCochlearGen() {
  const s = sideData[activeSide];
  const model = s.implant ? s.implant.model : "";
  const gen = detectCochlearGen(model);
  s.implant.generation = gen;
  const disp = document.getElementById("implGenDisplay");
  if (!disp) return;
  if (gen === "A") disp.textContent = t("implGenA");
  else if (gen === "B") disp.textContent = t("implGenB");
  else disp.textContent = t("implGenUnknown");
}

// ============================================================
// BA 242: Implantat-Tab Tonauswahl-Modal
// ============================================================

function _implTonePopupUpdLabel() {
  var btn = document.getElementById("implTonePopupBtn");
  if (!btn) return;
  var prefix = (typeof t === "function") ? t("implTonePopupBtn") : "Elektroden über Töne anspielen";
  var ttKey  = (typeof window.toneTypeI18nKey === "function")
    ? window.toneTypeI18nKey(toneType_implant) : null;
  var ttLbl  = (ttKey && typeof t === "function") ? t(ttKey) : toneType_implant;
  btn.textContent = prefix + " — " + ttLbl;
}

function _implTpElectrodeFreqs() {
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(FRQ_implantatEffektiv(i));
  return arr;
}

function _implTpElectrodeLabels() {
  var prefix = (typeof dENPrefix === "function") ? dENPrefix() : "E";
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(prefix + ((typeof dEN === "function") ? dEN(i) : (i + 1)));
  return arr;
}

function _implTpDisabledElectrodes() {
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    if (elActive[i] === false) { arr.push(i); continue; }
    if (typeof elExDur !== "undefined" && elExDur[i] != null) { arr.push(i); continue; }
  }
  return arr;
}

var _implTpCorrectVol = null;
var _implTpModalTone  = null;

function openImplantTonePopup() {
  if (typeof openToneSelectionDialog !== "function") return;
  var activePan = (activeSide === "left") ? -1 : 1;
  // BA 296: Vol/Dur/Pau-Zeile nur im Debug-Modus zeigen.
  var _implDbgOn = !!(window.dbg && typeof window.dbg.isActive === 'function'
                      && window.dbg.isActive());

  openToneSelectionDialog({
    getToneType:    function ()   { return toneType_implant; },
    setToneType:    function (tt) { toneType_implant = tt; _implTonePopupUpdLabel(); },
    onToneSelected: function (tt) { _implTpModalTone = tt; },
    onModalClose:   function ()   { _implTpModalTone = null; _implTpCorrectVol = null; },

    titleKey:     "tonePopupTitleImplant",
    hintKey:      "tonePopupHint",
    extraHintKey: "tonePopupHintImplant",
    persistentHintKey: "tonePopupHintImplantNoise",   // BA 298: Rausch-Hinweis, dauerhaft sichtbar

    // Tondauer + Tonpause dauerhaft sichtbar (wirken auf den Sweep);
    // Lautstaerke bleibt nur im Debug-Modus.
    showVolume:       _implDbgOn,
    showDuration:     true,
    showPause:        true,
    getVolumePercent: function ()  { return volume_global; },
    setVolumePercent: function (v) { volume_global = v; },
    getDurationMs:    function ()  { return duration_implant; },
    setDurationMs:    function (v) { duration_implant = v; },
    getPauseMs:       function ()  { return pause_implant; },
    setPauseMs:       function (v) { pause_implant = v; },

    getVolume: function () {
      return Math.pow(volume_global / 100, 2);
    },

    getPreviewSequence: function (lastHz) {
      var hz  = (typeof lastHz === 'number' && lastHz > 0) ? lastHz : 1000;
      var vol = Math.pow(volume_global / 100, 2);
      if (typeof _implTpCorrectVol === 'function') vol = _implTpCorrectVol(vol, hz, activePan);
      return [{ hz: hz, pan: activePan, vol: vol, durationMs: duration_implant }];
    },

    onTogglesReady: function (fn) { _implTpCorrectVol = fn; },

    keyboardMode:          true,
    getElectrodeFreqs:     _implTpElectrodeFreqs,
    getElectrodeLabels:    _implTpElectrodeLabels,
    getDisabledElectrodes: _implTpDisabledElectrodes,
    onPress: function (electrodeIdx, hz) {
      var c = (typeof gAC === "function") ? gAC() : null;
      if (!c) return;
      var tt  = (_implTpModalTone !== null) ? _implTpModalTone : toneType_implant;
      var vol = Math.pow(volume_global / 100, 2);
      if (typeof _implTpCorrectVol === "function") vol = _implTpCorrectVol(vol, hz, activePan);
      try {
        playToneTyped(c, hz, vol, 60000, activePan, tt);
      } catch (e) { /* swallow */ }
    },
    onRelease: function () {
      if (typeof stopAll === "function") stopAll();
    },

    sweepMode: true,
    getSweepPan: function () { return activePan; },

  }, _implTonePopupUpdLabel);
}

