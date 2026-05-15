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
  if (parent === "ergebnisse" && subtab === "freqmatch") {
    renderFreqMatchResults();
  }
  if (parent === "messungen" && subtab === "balance") {
    lrCheckData();
  }
  if (parent === "messungen" && subtab === "freqmatch") {
    if (typeof fmApplyLang === "function") fmApplyLang();
  }
}

// ============================================================
// TABS
// ============================================================
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === n));
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.toggle("active", p.id === "panel-" + n));
  if (n === "ergebnisse") {
    // Aktiven Sub-Tab prüfen; falls keiner aktiv oder aktiver leer, sinnvollen wählen
    const activeSubtab = document.querySelector('.subtab[data-parent="ergebnisse"].active');
    const currentName = activeSubtab ? activeSubtab.dataset.subtab : null;
    const hasBal = typeof bRes !== "undefined" && bRes.length > 0;
    const hasJdg = typeof jRes !== "undefined" && jRes.length > 0;
    const hasFR = typeof fRes !== "undefined" && fRes.length > 0;
    const hasLR = typeof lrResults !== "undefined" && Object.keys(lrResults).length > 0;
    if (!currentName || currentName === "results") {
      // Default-Auswahl: Tab mit Daten bevorzugen
      if (!hasBal && !hasJdg && hasFR) {
        switchSubtab("ergebnisse", "freqmatch");
        return;
      }
    }
    renderResults();
    if (currentName === "freqmatch") renderFreqMatchResults();
  }
  if (n === "player") plCheck();
  if (n === "levels") {
    buildLvGrid();
    drawLvChart();
  }
}

// Funktion zum Sperren/Entsperren der Tabs und Side-Select während Test
// Delegiert an lockTestTabs (test-ui.js) für einheitliche Handhabung
function updateTabLockState() {
  const locked = testAct || (typeof lrRunning !== "undefined" && lrRunning)
                          || (typeof fmRunning !== "undefined" && fmRunning);
  var activeTestId = null;
  if (testAct) activeTestId = 'test';
  else if (typeof lrRunning !== "undefined" && lrRunning) activeTestId = 'balance';
  else if (typeof fmRunning !== "undefined" && fmRunning) activeTestId = 'freqmatch';
  lockTestTabs(locked, activeTestId);
  // lockedHint im jeweiligen testEls-Objekt ein-/ausblenden
  if (typeof testEls !== "undefined" && testEls && testEls.lockedHint) {
    testEls.lockedHint.hidden = !testAct;
  }
  if (typeof lrEls !== "undefined" && lrEls && lrEls.lockedHint) {
    lrEls.lockedHint.hidden = !(typeof lrRunning !== "undefined" && lrRunning);
  }
  if (typeof fmEls !== "undefined" && fmEls && fmEls.lockedHint) {
    fmEls.lockedHint.hidden = !(typeof fmRunning !== "undefined" && fmRunning);
  }
  // ciSideSelect auch sperren
  const sideSelect = document.getElementById("ciSideSelect");
  if (sideSelect) sideSelect.disabled = locked;
}

// ============================================================
// EQ TOGGLE BUTTON
// ============================================================
function updPlSrcButtons() {
  const mBtn = document.getElementById("plSrcMeasBtn");
  const lBtn = document.getElementById("plSrcLevelsBtn");
  if (!mBtn || !lBtn) return;
  mBtn.style.background   = plSrcMeas   ? "var(--success)" : "";
  mBtn.style.color        = plSrcMeas   ? "#fff"           : "";
  mBtn.style.borderColor  = plSrcMeas   ? "var(--success)" : "";
  lBtn.style.background   = plSrcLevels ? "var(--success)" : "";
  lBtn.style.color        = plSrcLevels ? "#fff"           : "";
  lBtn.style.borderColor  = plSrcLevels ? "var(--success)" : "";
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

