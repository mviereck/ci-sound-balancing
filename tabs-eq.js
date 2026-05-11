// ============================================================
// SUBTABS
// ============================================================
function switchSubtab(parent, subtab) {
  // Subtab-Buttons
  document.querySelectorAll(`.subtab[data-parent="${parent}"]`).forEach((b) => {
    b.classList.toggle("active", b.dataset.subtab === subtab);
  });
  // Subpanels
  document.querySelectorAll(`[id^="subpanel-${parent}-"]`).forEach((p) => {
    const name = p.id.replace(`subpanel-${parent}-`, "");
    p.classList.toggle("active", name === subtab);
  });
  // Callbacks
  if (parent === "ergebnisse" && subtab === "results") renderResults();
  if (parent === "ergebnisse" && subtab === "lrresults") {
    lrCheckData();
    lrDrawChart();
  }
  if (parent === "messungen" && subtab === "balance") {
    lrCheckData();
  }
}

// ============================================================
// TABS
// ============================================================
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  if (testAct && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === n));
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.toggle("active", p.id === "panel-" + n));
  if (n === "ergebnisse") renderResults();
  if (n === "player") plCheck();
  if (n === "levels") {
    buildLvGrid();
    drawLvChart();
  }
}

// Funktion zum Sperren/Entsperren der Tabs und Side-Select während Test
function updateTabLockState() {
  const tabs = document.querySelectorAll('.tab:not([data-tab="messungen"])');
  const sideSelect = document.getElementById("ciSideSelect");
  const sideLeftBtn = document.getElementById("sideLeftBtn");
  const sideRightBtn = document.getElementById("sideRightBtn");
  tabs.forEach((tab) => (tab.disabled = testAct));
  if (sideSelect) sideSelect.disabled = testAct;
  if (sideLeftBtn) sideLeftBtn.disabled = testAct;
  if (sideRightBtn) sideRightBtn.disabled = testAct;
  // Hinweistext anzeigen/verstecken
  const lockInfo = document.getElementById("testLockedInfo");
  if (lockInfo) lockInfo.style.display = testAct ? "" : "none";
}

// ============================================================
// EQ TOGGLE BUTTON
// ============================================================
function updPlSrcButtons() {
  const mBtn = document.getElementById("plSrcMeasBtn");
  const lBtn = document.getElementById("plSrcLevelsBtn");
  if (!mBtn || !lBtn) return;
  const activeS =
    "background:var(--success);color:#fff;border-color:var(--success)";
  const inactS = "";
  mBtn.style.cssText = plSrcMeas ? activeS : inactS;
  lBtn.style.cssText = plSrcLevels ? activeS : inactS;
  // Sync hidden select
  const sel = document.getElementById("plSrc");
  if (sel) {
    if (plSrcMeas && plSrcLevels) sel.value = "both";
    else if (plSrcMeas) sel.value = "measured";
    else if (plSrcLevels) sel.value = "levels";
    else sel.value = "measured"; // fallback
  }
  updEqToggleBtn();
}
function updEqToggleBtn() {
  const btn = document.getElementById("plEqToggle");
  const bothOff = plEqOn && !plSrcMeas && !plSrcLevels;
  if (plEqOn && !bothOff) {
    btn.textContent = t("plEqOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else if (bothOff) {
    btn.textContent = t("plEqOn");
    btn.style.background = "var(--warning)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--warning)";
  } else {
    btn.textContent = t("plEqOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}

function updBalApplyBtn() {
  const btn = document.getElementById("plBalApplyBtn");
  if (!btn) return;
  if (plApplyBalance) {
    btn.textContent = t("plBalApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plBalApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}

