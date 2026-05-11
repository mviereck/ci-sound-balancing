// ============================================================
// UI IMPLANT CARD
// ============================================================
function buildImplantCard() {
  const s = sideData[activeSide];
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      iidr: null,
      generation: null,
      mcl: new Array(s.nEl).fill(null),
      thr: new Array(s.nEl).fill(null),
      upperLevel: new Array(s.nEl).fill(null),
    };
  const im = s.implant;
  const m = s.manufacturer;

  // i18n
  const implTitleEl = document.getElementById("implTitle");
  if (implTitleEl) implTitleEl.textContent = t("implTitle");
  document.getElementById("implIntro").textContent = t("implIntro");
  document.getElementById("implBilateralHintEl").innerHTML =
    t("implBilateralHint");
  document.getElementById("implBilateralHintEl").style.display = "block";
  document.getElementById("lblImplModel").textContent = t("lblImplModel");
  document.getElementById("lblImplProc").textContent = t("lblImplProc");
  document.getElementById("lblImplC").textContent = t("lblImplC");
  document.getElementById("lblImplIDR").textContent = t("lblImplIDR");
  document.getElementById("lblImplIIDR").textContent = t("lblImplIIDR");
  const genLbl = document.getElementById("lblImplGen");
  if (genLbl) genLbl.textContent = t("lblImplGen");

  // Show/hide manufacturer-specific params
  document.getElementById("implMedelParams").style.display =
    m === "medel" ? "" : "none";
  document.getElementById("implAbParams").style.display =
    m === "ab" ? "" : "none";
  document.getElementById("implCochParams").style.display =
    m === "cochlear" ? "" : "none";
  const genGrp = document.getElementById("implGenGroup");
  if (genGrp) genGrp.style.display = m === "cochlear" ? "" : "none";

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
  }
  if (m === "ab") {
    const ii = document.getElementById("implIDR");
    if (ii) ii.value = im.idr !== null ? im.idr : "";
  }
  if (m === "cochlear") {
    const ii = document.getElementById("implIIDR");
    if (ii) ii.value = im.iidr !== null ? im.iidr : "";
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
        this.value !== "" ? parseFloat(this.value) : null;
    };
  const ii = document.getElementById("implIDR");
  if (ii)
    ii.onchange = function () {
      sideData[activeSide].implant.idr =
        this.value !== "" ? parseFloat(this.value) : null;
    };
  const iii = document.getElementById("implIIDR");
  if (iii)
    iii.onchange = function () {
      sideData[activeSide].implant.iidr =
        this.value !== "" ? parseFloat(this.value) : null;
    };
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

