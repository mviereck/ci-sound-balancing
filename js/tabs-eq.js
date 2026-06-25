// Unterdrückt history.pushState während Initialisierung und popstate-Restaurierung
let _suppressHashPush = false;

// ============================================================
// SUBTABS
// ============================================================
function switchSubtab(parent, subtab) {
  // BA 173: Sperr-Guard L2 — taube Seite blockiert Vergleichstests
  const deaf = evalDeafState();
  const subs = LOCKED_SUBTABS_L2[parent] || [];
  if (deaf.hasDeaf && subs.indexOf(subtab) !== -1) {
    if (typeof tabLockShowModal === "function") tabLockShowModal("sideDeaf");
    return;
  }
  _switchSubtabInternal(parent, subtab);
}

function _switchSubtabInternal(parent, subtab) {
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
  if (parent === "ergebnisse" && subtab === "elektrodenlautstaerke") renderResults();
  if (parent === "ergebnisse" && subtab === "stereobalance") {
    stereobalanceCheckData();
    stereobalanceDrawChart();
  }
  if (parent === "ergebnisse" && subtab === "freqmatch") {
    renderFreqMatchResults();
  }
  if (parent === "ergebnisse" && subtab === "latenz") {
    if (typeof latenzRenderResults === "function") latenzRenderResults();
  }
  if (parent === "messungen" && subtab === "stereobalance") {
    stereobalanceCheckData();
  }
  if (parent === "messungen" && subtab === "latenz") {
    if (typeof renderSnapshotHint === 'function') {
      renderSnapshotHint('latenz', document.getElementById('snapHint_latenz'));
    }
  }
  if (parent === "messungen" && subtab === "freqmatch") {
    if (typeof FRQ_applyLang === "function") FRQ_applyLang();
    if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
  }
  // Sub-Tab-Wechsel weg vom Latenz-Tab: Test stoppen
  if (parent === "messungen" && subtab !== "latenz") {
    if (typeof latenzActive !== "undefined" && latenzActive
        && typeof latenzStopTest === "function") {
      latenzStopTest();
      if (typeof latenzUpdateButtonStates === "function") latenzUpdateButtonStates();
      if (typeof updateTabLockState === "function") updateTabLockState();
    }
  }
  // BA 163: pro Browser-Tab
  try { sessionStorage.setItem("ci-lb-subtab-" + parent, subtab); } catch (e) {}
  if (!_suppressHashPush) history.pushState(null, "", "#" + parent + ":" + subtab);
}

// ============================================================
// BA 172: TAB-SPERRE L1
// ------------------------------------------------------------
// Sperrt Haupt-Reiter, wenn die Implantat-Angaben unzureichend
// sind. Sperr-Schwelle und Tab-Liste sind hier zentral.
// ============================================================
const LOCKED_TABS_L1 = ["messungen", "ergebnisse", "kurven", "schieber"];

// Liefert den aktuellen Sperr-Zustand:
//   { locked: false, reason: null }                 — frei
//   { locked: true,  reason: "unconfigured" }       — fehlende Angaben
//   { locked: true,  reason: "bothAcoustic" }       — beide Seiten akustisch
function evalTabLockState() {
  const lC = (sideData.left  && sideData.left.config)  || "unknown";
  const rC = (sideData.right && sideData.right.config) || "unknown";
  const isAc = (c) => c === "hg" || c === "normal" || c === "shoh";
  if (isAc(lC) && isAc(rC)) return { locked: true, reason: "bothAcoustic" };
  if (lC === "unknown" || rC === "unknown") return { locked: true, reason: "unconfigured" };
  const lMfr = sideData.left  && sideData.left.manufacturer;
  const rMfr = sideData.right && sideData.right.manufacturer;
  const validMfr = (m) => !!m && m !== "unknown";
  // Jede CI-Seite muss einen Hersteller haben — sonst Sperre,
  // auch wenn die andere Seite vollständig konfiguriert ist.
  if (lC === "ci" && !validMfr(lMfr)) return { locked: true, reason: "unconfigured" };
  if (rC === "ci" && !validMfr(rMfr)) return { locked: true, reason: "unconfigured" };
  const lCI = lC === "ci" && validMfr(lMfr);
  const rCI = rC === "ci" && validMfr(rMfr);
  if (!lCI && !rCI) return { locked: true, reason: "unconfigured" };
  return { locked: false, reason: null };
}

// Visuelle Sperre setzen und ggf. den aktuellen Tab zurückwechseln,
// falls er nun gesperrt wäre.
function tabLockApply() {
  const state = evalTabLockState();
  window._tabLockState = state;
  LOCKED_TABS_L1.forEach((name) => {
    const btn = document.querySelector('.tab[data-tab="' + name + '"]');
    if (btn) btn.classList.toggle("tab-locked", state.locked);
  });
  if (state.locked) {
    // Wenn der User aktuell auf einem nun gesperrten Tab steht, sanft auf
    // den Implantat-Reiter zurückwechseln, damit kein inkonsistenter
    // Inhalt sichtbar bleibt. KEIN Modal in diesem Fall — der User
    // ändert ja gerade die Implantat-Angaben.
    const activeTabEl = document.querySelector(".tab.active");
    const activeName  = activeTabEl ? activeTabEl.dataset.tab : null;
    if (activeName && LOCKED_TABS_L1.indexOf(activeName) !== -1) {
      _switchTabInternal("setup");
    }
  }
  // BA 173: Sub-Tab- und Player-Bereich-Sperre L2/L3 mit nachziehen
  if (typeof subtabLockApply === "function") subtabLockApply();
  // BA387: playerLockApply entfaellt -> die drei Button-Sperren direkt rufen.
  if (typeof plUpdBalLock  === "function") plUpdBalLock();
  if (typeof plUpdLatLock  === "function") plUpdLatLock();
  if (typeof plUpdWarpLock === "function") plUpdWarpLock();
}

// Zeigt das Sperr-Modal mit der zur Reason passenden Variante.
function tabLockShowModal(reason) {
  const modal = document.getElementById("tabLockModal");
  if (!modal) return;
  const titleEl = modal.querySelector(".tab-lock-title");
  const bodyEl  = modal.querySelector(".tab-lock-body");
  if (reason === "bothAcoustic") {
    if (titleEl) titleEl.textContent = t("tabLockTitleBothAc");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyBothAc");
  } else if (reason === "sideDeaf") {
    if (titleEl) titleEl.textContent = t("tabLockTitleSideDeaf");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodySideDeaf");
  } else {
    if (titleEl) titleEl.textContent = t("tabLockTitleStd");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyStd");
  }
  modal.classList.add("active");
}

function tabLockHideModal() {
  const modal = document.getElementById("tabLockModal");
  if (modal) modal.classList.remove("active");
}

// BA 172: Close-Handler für Tab-Sperr-Modal
document.addEventListener("DOMContentLoaded", function () {
  const closeBtn = document.getElementById("tabLockCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", tabLockHideModal);
});

// ============================================================
// BA 173: SUB-TAB-SPERRE L2 — eine Seite taub
// ------------------------------------------------------------
// Sperrt Sub-Reiter in „Messungen", wenn mindestens eine Seite
// auf „Taub" steht (config === "deaf"). Die betroffenen Tests
// vergleichen beide Seiten und sind dann nicht sinnvoll.
// ============================================================
const LOCKED_SUBTABS_L2 = {
  messungen: ["stereobalance", "latenz", "freqmatch"],
};

// Liefert {hasDeaf, deafSide}. deafSide ist die zuerst gefundene
// taube Seite (left vor right) und wird aktuell nicht weiter genutzt;
// das Feld bleibt für mögliche Wortlaut-Erweiterungen reserviert.
function evalDeafState() {
  const lC = (sideData.left  && sideData.left.config)  || "unknown";
  const rC = (sideData.right && sideData.right.config) || "unknown";
  if (lC === "deaf") return { hasDeaf: true, deafSide: "left" };
  if (rC === "deaf") return { hasDeaf: true, deafSide: "right" };
  return { hasDeaf: false, deafSide: null };
}

function subtabLockApply() {
  const deaf = evalDeafState();
  Object.keys(LOCKED_SUBTABS_L2).forEach(function (parent) {
    const subs = LOCKED_SUBTABS_L2[parent];
    subs.forEach(function (sub) {
      const btn = document.querySelector(
        '.subtab[data-parent="' + parent + '"][data-subtab="' + sub + '"]'
      );
      if (btn) btn.classList.toggle("tab-locked", deaf.hasDeaf);
    });
    if (deaf.hasDeaf) {
      const activeSubBtn = document.querySelector(
        '.subtab.active[data-parent="' + parent + '"]'
      );
      const activeSub = activeSubBtn ? activeSubBtn.dataset.subtab : null;
      if (activeSub && subs.indexOf(activeSub) !== -1) {
        // Auto-Rückwechsel auf den ersten freien Sub-Reiter „test"
        // (Elektrodenlautstärke). Kein Modal — der User ändert
        // gerade die Implantat-Angaben.
        if (typeof _switchSubtabInternal === "function") {
          _switchSubtabInternal(parent, "test");
        }
      }
    }
  });
}

// ============================================================
// TABS
// ============================================================
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof stereobalanceRunning !== "undefined" && stereobalanceRunning)
    || (typeof FRQ_running !== "undefined" && FRQ_running)
    || (typeof latenzActive !== "undefined" && latenzActive);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
  // BA 172: Sperr-Guard L1 — bei gesperrtem Tab Modal zeigen statt zu wechseln
  const lockState = window._tabLockState;
  if (lockState && lockState.locked && LOCKED_TABS_L1.indexOf(n) !== -1) {
    tabLockShowModal(lockState.reason);
    return;
  }
  _switchTabInternal(n);
}

// BA 172: interner Tab-Wechsel ohne Sperr-Check. Wird von switchTab und von
// tabLockApply (Rückwechsel auf Implantat-Tab) genutzt.
function _switchTabInternal(n) {
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
    const hasBal = typeof elektrodenlautstaerkeResults !== "undefined" && elektrodenlautstaerkeResults.length > 0;
    const hasFR = typeof FRQ_resultsArray !== "undefined" && FRQ_resultsArray.length > 0;
    const hasLR = typeof stereobalanceResults !== "undefined" && Object.keys(stereobalanceResults).length > 0;
    if (!currentName || currentName === "elektrodenlautstaerke") {
      // Default-Auswahl: Tab mit Daten bevorzugen
      // BA 251: hasJdg entfaellt; reine Bal/FR-Logik bleibt.
      if (!hasBal && hasFR) {
        switchSubtab("ergebnisse", "freqmatch");
        return;
      }
    }
    renderResults();
    if (currentName === "freqmatch") renderFreqMatchResults();
  }
  if (n === "player") {
    plCheck();
  }
  if (n === "kurven") {
    elektrodenlautstaerkeKurvenTabelleBauen();
    elektrodenlautstaerkeKurvenChartZeichnen();
  }
  if (n === "schieber") {
    if (typeof elektrodenlautstaerkeSchieberRebuild === "function") elektrodenlautstaerkeSchieberRebuild();
  }
  if (n === "file") {
    if (typeof _audiologUpdWarn === "function") _audiologUpdWarn();
  }
  // BA 163: pro Browser-Tab
  try { sessionStorage.setItem("ci-lb-activeTab", n); } catch (e) {}
  if (!_suppressHashPush) history.pushState(null, "", "#" + n);
}

// Funktion zum Sperren/Entsperren der Tabs und Side-Select während Test
// Delegiert an lockTestTabs (test-ui.js) für einheitliche Handhabung
function updateTabLockState() {
  const locked = testAct || (typeof stereobalanceRunning !== "undefined" && stereobalanceRunning)
                          || (typeof FRQ_running !== "undefined" && FRQ_running)
                          || (typeof latenzActive !== "undefined" && latenzActive);
  var activeTestId = null;
  if (testAct) activeTestId = 'elektrodenlautstaerke';
  else if (typeof stereobalanceRunning !== "undefined" && stereobalanceRunning) activeTestId = 'stereobalance';
  else if (typeof FRQ_running !== "undefined" && FRQ_running) activeTestId = 'freqmatch';
  else if (typeof latenzActive !== "undefined" && latenzActive) activeTestId = 'latenz';
  lockTestTabs(locked, activeTestId);
  // BA 249: lockedHint liegt in der neuen API unter els.header.lockedHint,
  // nicht direkt auf els. _buildTestPanelNew setzt das DOM-Flag beim
  // Start/Stop selbst (test-ui.js: Start = hidden=false, Stop = hidden=true);
  // diese Schleife synchronisiert nur den Querzustand (z.B. nach Tab-Wechsel).
  if (typeof testEls !== "undefined" && testEls
      && testEls.header && testEls.header.lockedHint) {
    testEls.header.lockedHint.hidden = !testAct;
  }
  if (typeof stereobalanceEls !== "undefined" && stereobalanceEls
      && stereobalanceEls.header && stereobalanceEls.header.lockedHint) {
    stereobalanceEls.header.lockedHint.hidden = !(typeof stereobalanceRunning !== "undefined" && stereobalanceRunning);
  }
  if (typeof FRQ_els !== "undefined" && FRQ_els
      && FRQ_els.header && FRQ_els.header.lockedHint) {
    FRQ_els.header.lockedHint.hidden = !(typeof FRQ_running !== "undefined" && FRQ_running);
  }
  if (typeof latenzEls !== "undefined" && latenzEls
      && latenzEls.header && latenzEls.header.lockedHint) {
    latenzEls.header.lockedHint.hidden = !(typeof latenzActive !== "undefined" && latenzActive);
  }
  // ciSideSelect auch sperren
  const sideSelect = document.getElementById("ciSideSelect");
  if (sideSelect) sideSelect.disabled = locked;
}

// ============================================================
// EQ TOGGLE BUTTON
// ============================================================

// BA385: Einheitlicher Toggle-Button-Stil fuer die Player-Einstellungen-Box.
// Erzeugt dynamisch "checkmark Name AN" (aktiv, gruen) bzw. "Name AUS"
// (inaktiv, grau) aus EINEM Name-Key. Keine doppelten i18n-Keys mehr pro Toggle.
function styleToggleBtn(btnId, active, nameKey) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const name = t(nameKey);
  if (active) {
    btn.textContent = "✓ " + name + " " + t("toggleOn");
    btn.style.background  = "var(--success)";
    btn.style.color       = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = name + " " + t("toggleOff");
    btn.style.background  = "#e5e7eb";
    btn.style.color       = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}

function updPlSrcButtons() {
  styleToggleBtn("plSrcMeasBtn",   plSrcMeas,   "plSrcMeas");
  styleToggleBtn("plSrcLevelsBtn", plSrcLevels, "plSrcLevels");
  styleToggleBtn("plSrcCurvesBtn", plSrcCurves, "plSrcCurves");
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
  styleToggleBtn("plEqToggle", plEqOn, "plEqName");
  // BA385: Sichtbarkeit aller vom Master gesteuerten Box-Zeilen mitschalten.
  if (typeof plUpdMasterVisibility === "function") plUpdMasterVisibility();
}

function updBalApplyBtn() {
  const btn = document.getElementById("plBalApplyBtn");
  if (!btn) return;
  // Grund-Beschriftung (AN/AUS). Sperr-Zustand (Taub ODER seitenweise
  // Absenkung), Ausgrauen, Hinweistext und Dropdown-Sichtbarkeit liegen
  // ausschliesslich in plUpdBalLock (player.js) — eine Schreibstelle.
  styleToggleBtn("plBalApplyBtn", plApplyBalance, "plBalName");
  const sel = document.getElementById("plBalModeSelect");
  if (sel) sel.value = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  if (typeof plUpdBalLock === "function") plUpdBalLock();
}

function updLatApplyBtn() {
  const btn = document.getElementById("plLatApplyBtn");
  if (!btn) return;
  // Beschriftung; Sperre/opacity/cursor liegen ausschliesslich in
  // plUpdLatLock (player.js) — eine Schreibstelle.
  if (typeof plApplyLatency === "undefined") return;
  styleToggleBtn("plLatApplyBtn", plApplyLatency, "plLatName");
  if (typeof plUpdLatLock === "function") plUpdLatLock();
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


