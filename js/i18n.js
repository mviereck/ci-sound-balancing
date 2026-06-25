// ============================================================
// I18N — CORE
// Sprachdaten liegen in i18n/de.js, i18n/en.js, i18n/fr.js, i18n/es.js
// und werden dort per Object.assign(L.<lang>, { … }) befüllt.
// ============================================================
const L = { de: {}, en: {}, fr: {}, es: {} };
let lang = "de";

function t(k) {
  return (L[lang] && L[lang][k]) || L.de[k] || k;
}
function updateMfrSelectLabels() {
  const labels = {
    de: "Elektroden",
    en: "electrodes",
    fr: "électrodes",
    es: "electrodos",
  };
  const lbl = labels[lang] || "electrodes";
  // BA 154: opts[0] ist „Keine Angabe" (unknown), MED-EL/AB/Cochlear bei 1/2/3
  const opts = document.getElementById("mfrSelect").options;
  if (opts[1]) opts[1].text = "MED-EL (12 " + lbl + ")";
  if (opts[2]) opts[2].text = "Advanced Bionics (16 " + lbl + ")";
  if (opts[3]) opts[3].text = "Cochlear (22 " + lbl + ")";
}
const README_URLS = {
  de: "https://github.com/mviereck/ci-sound-balancing/blob/main/README_de.md",
  en: "https://github.com/mviereck/ci-sound-balancing/blob/main/README_en.md",
  fr: "https://github.com/mviereck/ci-sound-balancing/blob/main/README_fr.md",
  es: "https://github.com/mviereck/ci-sound-balancing/blob/main/README_es.md",
};

function applyLang() {
  lang = document.getElementById("langSelect").value;
  document.querySelectorAll("[data-t]").forEach((el) => {
    const v = t(el.dataset.t);
    if (v.includes("<")) el.innerHTML = v;
    else el.textContent = v;
  });
  document.querySelectorAll("[data-t-opt]").forEach((el) => {
    el.textContent = t(el.dataset.tOpt);
  });
  document.querySelectorAll('[data-t-placeholder]').forEach((el) => {
    const k = el.getAttribute('data-t-placeholder');
    if (k && t(k)) el.setAttribute('placeholder', t(k));
  });
  document.querySelectorAll('[data-t-title]').forEach((el) => {
    const k = el.getAttribute('data-t-title');
    if (k && t(k)) el.setAttribute('title', t(k));
  });
  const manualLink = document.getElementById("introManualLink");
  if (manualLink) {
    manualLink.textContent = t("introManualLink");
    manualLink.href = README_URLS[lang] || README_URLS.en;
  }
  const s = (id, k) => {
    const e = document.getElementById(id);
    if (e) e.textContent = t(k);
  };
  updateMfrSelectLabels();
  const vl = document.getElementById("versionLabel");
  if (vl) vl.textContent = "v" + APP_VERSION;
  s("tabIntro", "tabIntro");
  s("tabSetup", "tabFreq");
  // tabTest und tabResults haben feste mehrsprachige Texte unten
  s("tabKurven", "tabKurven");
  s("tabSchieber", "tabSchieber");
  s("tabPlayer", "tabPlayer");
  // tabBalance entfernt – kein eigener Tab mehr
  s("tabFile", "tabFile");
  // Neue Tab-Texte für Messungen / Meßergebnisse
  const tabMessungen = document.getElementById("tabTest");
  const tabErgebnisse = document.getElementById("tabResults");
  if (tabMessungen) tabMessungen.textContent = t("tabMessungen");
  if (tabErgebnisse) tabErgebnisse.textContent = t("tabErgebnisse");
  const gEl2 = (id) => document.getElementById(id);
  if (gEl2("glossLSEl")) gEl2("glossLSEl").innerHTML = t("glossLS");
  s("freqTitle", "freqTitle");
  s("lblMfr", "lblMfr");

  const abfEl = document.getElementById("freqAbfHintEl");
  if (abfEl) abfEl.innerHTML = t("freqAbfHint");
  const exclEl = document.getElementById("freqExclHintEl");
  if (exclEl) exclEl.innerHTML = t("freqExclHint");
  s("sweepBtn", "sweep");
  s("stopBtn", "stop");
  s("lblVol", "lblVol");
  s("lblDur", "lblDur");
  s("lblPau", "lblPau");
  s("testTitle", "testTitle");
  s("lblRef", "lblRef");
  s("lblVol2", "lblVol2");
  s("lblDur2", "lblDur2");
  s("lblPau2", "lblPau2");
  s("balLabel", "balLabel");
  s("startBtn", "startTest");
  s("stopTBtn", "stopTest");
  s("resTitle", "resTitle");
  updSideButtons();
  buildFreqTable();
  if (typeof buildImplantCard === "function") buildImplantCard();
  const _pib = document.getElementById("printImplantBtn");
  if (_pib) _pib.title = t("printBtn");
  const _peb = document.getElementById("printErgebnisseBtn");
  if (_peb) _peb.title = t("printBtn");
  if (document.getElementById("resC").style.display !== "none") renderResults();
  if (typeof stereobalanceRenderResults === "function") stereobalanceRenderResults();
  if (typeof sUpdateUI === "function") sUpdateUI();
  if (typeof _implValidateApplyLang === 'function') _implValidateApplyLang();
  // BA 172: Tab-Sperre L1 — Klassen-Toggle + Modal-Texte ggf. neu aufgrund Sprachwechsel
  if (typeof tabLockApply === 'function') tabLockApply();
  // BA389: Player-UI zentral spiegeln (ersetzt die Einzel-Refresher in
  // applyLang; deckt auch die in 2a entfernten Box-Updates ab).
  if (typeof plSyncUI === "function") plSyncUI();
  try {
    localStorage.setItem("ci-lb-lang", lang);
  } catch (e) {}
}
