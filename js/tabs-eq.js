// Unterdrückt history.pushState während Initialisierung und popstate-Restaurierung
let _suppressHashPush = false;

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
  if (parent === "ergebnisse" && subtab === "latenz") {
    if (typeof latRenderResults === "function") latRenderResults();
  }
  if (parent === "messungen" && subtab === "balance") {
    lrCheckData();
  }
  if (parent === "messungen" && subtab === "freqmatch") {
    if (typeof fmApplyLang === "function") fmApplyLang();
    if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
  }
  // Sub-Tab-Wechsel weg vom Latenz-Tab: Test stoppen
  if (parent === "messungen" && subtab !== "latenz") {
    if (typeof latActive !== "undefined" && latActive
        && typeof latStopTest === "function") {
      latStopTest();
      if (typeof latUpdateButtonStates === "function") latUpdateButtonStates();
      if (typeof updateTabLockState === "function") updateTabLockState();
    }
  }
  try { localStorage.setItem("ci-lb-subtab-" + parent, subtab); } catch (e) {}
  if (!_suppressHashPush) history.pushState(null, "", "#" + parent + ":" + subtab);
}

// ============================================================
// TABS
// ============================================================
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning)
    || (typeof latActive !== "undefined" && latActive);
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
    buildPrTbl();
    drawLvChart();
  }
  if (n === "schieber") {
    if (typeof lvTabRebuild === "function") lvTabRebuild();
  }
  try { localStorage.setItem("ci-lb-activeTab", n); } catch (e) {}
  if (!_suppressHashPush) history.pushState(null, "", "#" + n);
}

// Funktion zum Sperren/Entsperren der Tabs und Side-Select während Test
// Delegiert an lockTestTabs (test-ui.js) für einheitliche Handhabung
function updateTabLockState() {
  const locked = testAct || (typeof lrRunning !== "undefined" && lrRunning)
                          || (typeof fmRunning !== "undefined" && fmRunning)
                          || (typeof latActive !== "undefined" && latActive);
  var activeTestId = null;
  if (testAct) activeTestId = 'test';
  else if (typeof lrRunning !== "undefined" && lrRunning) activeTestId = 'balance';
  else if (typeof fmRunning !== "undefined" && fmRunning) activeTestId = 'freqmatch';
  else if (typeof latActive !== "undefined" && latActive) activeTestId = 'latenz';
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
  if (typeof latEls !== "undefined" && latEls && latEls.lockedHint) {
    latEls.lockedHint.hidden = !(typeof latActive !== "undefined" && latActive);
  }
  // ciSideSelect auch sperren
  const sideSelect = document.getElementById("ciSideSelect");
  if (sideSelect) sideSelect.disabled = locked;
}

// ============================================================
// EQ TOGGLE BUTTON
// ============================================================
function updPlSrcButtons() {
  const entries = [
    { id: "plSrcMeasBtn",   active: plSrcMeas },
    { id: "plSrcLevelsBtn", active: plSrcLevels },
    { id: "plSrcCurvesBtn", active: plSrcCurves },
  ];
  for (const { id, active } of entries) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    if (active) {
      btn.style.background   = "var(--success)";
      btn.style.color        = "#fff";
      btn.style.borderColor  = "var(--success)";
    } else {
      btn.style.background   = "#e5e7eb";
      btn.style.color        = "var(--text)";
      btn.style.borderColor  = "var(--border)";
    }
  }
  // Sync hidden legacy select (best effort)
  const sel = document.getElementById("plSrc");
  if (sel) {
    if (plSrcMeas && (plSrcLevels || plSrcCurves)) sel.value = "both";
    else if (plSrcMeas) sel.value = "measured";
    else if (plSrcLevels || plSrcCurves) sel.value = "levels";
    else sel.value = "measured";
  }
  updEqToggleBtn();
}
function updEqToggleBtn() {
  const btn = document.getElementById("plEqToggle");
  if (plEqOn) {
    btn.textContent = t("plEqOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
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
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const stereoActive = (mode === "both");
  // Disabled, wenn nicht im echten Stereo-Modus
  btn.disabled = !stereoActive;
  btn.style.opacity = stereoActive ? "" : "0.4";
  btn.style.cursor = stereoActive ? "" : "not-allowed";
  if (plApplyBalance && stereoActive) {
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
  // Dropdown-Sichtbarkeit synchronisieren
  const row = document.getElementById("plBalModeRow");
  if (row) {
    row.style.display = (stereoActive && plApplyBalance) ? "" : "none";
  }
  const sel = document.getElementById("plBalModeSelect");
  if (sel) sel.value = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
}

function updLatApplyBtn() {
  const btn = document.getElementById("plLatApplyBtn");
  if (!btn) return;
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const twoEarsActive = (mode === "both");
  // Disabled, wenn nur eine Seite hörbar
  btn.disabled = !twoEarsActive;
  btn.style.opacity = twoEarsActive ? "" : "0.4";
  btn.style.cursor = twoEarsActive ? "" : "not-allowed";
  if (plApplyLatency && twoEarsActive) {
    btn.textContent = t("plLatApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plLatApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}

// ============================================================
// URL-HASH: BACK/FORWARD-NAVIGATION
// ============================================================
window.addEventListener("popstate", () => {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const [tab, sub] = hash.split(":");
  _suppressHashPush = true;
  if (tab) switchTab(tab);
  if (sub) switchSubtab(tab, sub);
  _suppressHashPush = false;
});


