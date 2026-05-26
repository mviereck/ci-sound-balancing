document.addEventListener("DOMContentLoaded", () => {
  try {
    const sl = localStorage.getItem("ci-lb-lang");
    if (sl && L[sl]) {
      document.getElementById("langSelect").value = sl;
      lang = sl;
    }
  } catch (e) {}
  applyLang();
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  updSideButtons();
  updFClearBtn();
  updPlSrcButtons();
  buildImplantCard();
  // Sub-Tab-Beschriftungen (werden auch von applyLang-Patch aktualisiert)
  const _btnL = document.getElementById("subTabLoudnessBtn");
  if (_btnL) _btnL.textContent = t("subTabLoudness");
  const _btnF = document.getElementById("subTabFreqMatchBtn");
  if (_btnF) _btnF.textContent = t("subTabFreqMatch");
  const _nd = document.getElementById("fmrNoDataText");
  if (_nd) _nd.textContent = t("fmrNoData");
  document.getElementById("langSelect").addEventListener("change", () => window.applyLang());
  // Tonart-Dropdown: global, keine feste DOM-ID mehr — syncAllGlobalDropdowns() übernimmt
  // toneHint-Texte: keine separaten Boxen mehr — in buildTestPanel-Erklärungsblock
  function updToneHint() {
    // Platzhalter — keine eigenständigen toneHintBoxen mehr
  }
  // applyLang patchen, damit toneHint bei Sprachwechsel aktualisiert wird
  const _origApplyLang = applyLang;
  window.applyLang = function() {
    _origApplyLang();
    updToneHint();
    if (typeof fmApplyLang === "function") fmApplyLang();
    // Sub-Tab-Beschriftungen
    const btnL = document.getElementById("subTabLoudnessBtn");
    if (btnL) btnL.textContent = t("subTabLoudness");
    const btnF = document.getElementById("subTabFreqMatchBtn");
    if (btnF) btnF.textContent = t("subTabFreqMatch");
    // fmrNoData-Text
    const nd = document.getElementById("fmrNoDataText");
    if (nd) nd.textContent = t("fmrNoData");
    // Wenn Frequenzabgleich-Tab aktiv: neu rendern
    const activeSubtab = document.querySelector('.subtab[data-parent="ergebnisse"].active');
    if (activeSubtab && activeSubtab.dataset.subtab === "freqmatch") {
      renderFreqMatchResults();
    }
    // Latenz-UI-Texte
    if (typeof latRenderResults === "function") latRenderResults();
    if (typeof latUpdateValueText === "function") latUpdateValueText();
    if (typeof latUpdateIntervalHint === "function") latUpdateIntervalHint();
    // Warp-UI-Texte
    _pWarpApplyLangTexts();
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    // Druck-Knöpfe Kurven- und Schieber-Tab
    const _pkb = document.getElementById("printKurvenBtn");
    if (_pkb) _pkb.title = t("printBtn");
    const _psb = document.getElementById("printSchieberBtn");
    if (_psb) _psb.title = t("printBtn");
  };

  // ---- Warp i18n Hilfsfunktionen ----
  function _pWarpApplyMethodLabels() {
    const sel = document.getElementById("plWarpMethod");
    if (!sel) return;
    const keys = ["pwMethodOffline", "pwMethodVocoder", "pwMethodSinModel", "pwMethodBandShift"];
    for (let i = 0; i < sel.options.length; i++) {
      if (keys[i]) sel.options[i].text = t(keys[i]);
    }
    const modeSel = document.getElementById("plWarpModeSelect");
    if (!modeSel) return;
    const modeKeys = ["pwModeRef", "pwModeVar", "pwModeSym"];
    for (let i = 0; i < modeSel.options.length; i++) {
      if (modeKeys[i]) modeSel.options[i].text = t(modeKeys[i]);
    }
  }
  window._pWarpApplyMethodLabels = _pWarpApplyMethodLabels;

  function _pWarpApplyLangTexts() {
    // data-t-Elemente werden von applyLang() automatisch aktualisiert.
    // Hier nur Dropdown-Optionen (haben kein data-t).
    _pWarpApplyMethodLabels();
  }
  window._pWarpApplyLangTexts = _pWarpApplyLangTexts;

  updToneHint();
  document
    .querySelectorAll(".tab")
    .forEach((t) =>
      t.addEventListener("click", () => switchTab(t.dataset.tab)),
    );
  document
    .querySelectorAll(".subtab")
    .forEach((t) =>
      t.addEventListener("click", () => switchSubtab(t.dataset.parent, t.dataset.subtab)),
    );

  document.getElementById("sweepBtn").addEventListener("click", playSweep);
  document.getElementById("stopBtn").addEventListener("click", stopAll);
  document
    .getElementById("mfrSelect")
    .addEventListener("change", (e) => switchMfr(e.target.value));
  // Konfiguration pro Seite
  document.getElementById("cfgSelect").addEventListener("change", (e) => {
    setSideConfig(activeSide, e.target.value);
    buildFreqTable();
    buildImplantCard();
    buildPrTbl();
    drawLvChart();
    renderResults();
    if (typeof lrCheckData === "function") lrCheckData();
    if (typeof fmApplyLang === "function") fmApplyLang();
    plCheck();
  });
  // Default-Frequenzraster (nur wenn keine Seite CI)
  document.getElementById("defaultMfrSelect").addEventListener("change", (e) => {
    defaultMfr = e.target.value;
    syncFreqsToAcoustic();
    buildFreqTable();
    buildImplantCard();
    buildPrTbl();
    drawLvChart();
    renderResults();
  });
  // ciSideSelect hidden; side switching via sideLeftBtn/sideRightBtn onclick
  // Player: Beide-Seiten Checkbox
  document
    .getElementById("plBothSides")
    .addEventListener("change", function () {
      updatePlayerForSideChange();
      updBalApplyBtn();
      updLatApplyBtn();
      try {
        const _sv = localStorage.getItem("ci-lb-v4");
        if (_sv) {
          const _d = JSON.parse(_sv);
          _d.plBothSides = this.checked;
          localStorage.setItem("ci-lb-v4", JSON.stringify(_d));
        }
      } catch (_e) {}
    });
  // Volume sync between setup and test (textboxes)
  // vol1/dur1/pau1: Setup-Tab Inputs
  document.getElementById("vol1").addEventListener("change", (e) => {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
    e.target.value = v;
  });
  // Test-Tab Event-Listener werden jetzt in test.js DOMContentLoaded verdrahtet
  // File
  document
    .getElementById("fLoadBtn")
    .addEventListener("click", () => document.getElementById("fInput").click());
  document.getElementById("fInput").addEventListener("change", (e) => {
    if (e.target.files[0]) loadJson(e.target.files[0]);
  });
  document.getElementById("fSaveBtn").addEventListener("click", saveJson);
  const printImplantBtn = document.getElementById("printImplantBtn");
  if (printImplantBtn) {
    printImplantBtn.title = t("printBtn");
    printImplantBtn.addEventListener("click", printImplantTab);
  }
  const printErgebnisseBtn = document.getElementById("printErgebnisseBtn");
  if (printErgebnisseBtn) {
    printErgebnisseBtn.title = t("printBtn");
    printErgebnisseBtn.addEventListener("click", printErgebnisseTab);
  }
  const printKurvenBtn = document.getElementById("printKurvenBtn");
  if (printKurvenBtn) {
    printKurvenBtn.title = t("printBtn");
    printKurvenBtn.addEventListener("click", printKurvenTab);
  }
  const printSchieberBtn = document.getElementById("printSchieberBtn");
  if (printSchieberBtn) {
    printSchieberBtn.title = t("printBtn");
    printSchieberBtn.addEventListener("click", printSchieberTab);
  }
  document.getElementById("fPrintBtn").addEventListener("click", () => {
    const data = collectArchivData();
    const html = renderArchivPrintHtml(data);
    const w = window.open("", "_blank");
    if (!w) { alert("Popup blockiert"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  });
  document.getElementById("fArchivMdBtn").addEventListener("click", () => {
    mdDownload(renderArchivMarkdown(collectArchivData()), mdArchivFilename());
  });
  document.getElementById("fAudiologPrintBtn").addEventListener("click", audiologPrint);
  document.getElementById("fAudiologMdBtn").addEventListener("click", () => {
    mdDownload(buildAudiologMarkdown(), mdAudiologFilename());
  });
  const audiologNoteEl = document.getElementById("audiologNoteInput");
  if (audiologNoteEl) {
    audiologNoteEl.addEventListener("input", function () {
      audiologUserNote = this.value;
    });
  }
  document.getElementById("fResetBtn").addEventListener("click", resetAll);
  document.getElementById("fClearBtn").addEventListener("click", clearRes);
  document
    .getElementById("eeExportBtn")
    .addEventListener("click", exportEasyEffects);
  ["lvChkMeas", "lvChkMan", "lvChkPre"].forEach((id) =>
    document.getElementById(id).addEventListener("change", drawLvChart),
  );
  // Player EQ toggle — wirkt als Master-Bypass auch für Frequenz-Warping.
  // Wenn pWarpOn=true und Wiedergabe läuft, muss der Audio-Graph gewechselt
  // werden (Vocoder/Bandshift rein/raus), nicht nur EQ-Gains aktualisiert.
  document.getElementById("plEqToggle").addEventListener("click", function () {
    plEqOn = !plEqOn;
    updEqToggleBtn();
    pUpdEQ();
    if (pWarpOn) {
      const method = document.getElementById("plWarpMethod").value;
      if (method === "vocoder" || method === "bandshift") {
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        pWarpUpdUI();
        if (wasPlaying) pPlay();
      } else if (method === "offline") {
        // Offline: getPlaybackBuffer entscheidet anhand plEqOn neu beim nächsten Play.
        // Bei laufender Wiedergabe Pfad an aktueller Position wechseln.
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        if (wasPlaying) pPlay();
      }
    }
    if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  });
  document
    .getElementById("plBalApplyBtn")
    .addEventListener("click", function () {
      plApplyBalance = !plApplyBalance;
      updBalApplyBtn();
      pUpdEQ();
    });
  document
    .getElementById("plBalModeSelect")
    .addEventListener("change", function () {
      plBalanceMode = this.value;
      pUpdEQ();
    });
  document
    .getElementById("plLatApplyBtn")
    .addEventListener("click", function () {
      plApplyLatency = !plApplyLatency;
      latApplyToPlayer();
      updLatApplyBtn();
    });
  updEqToggleBtn();
  updBalApplyBtn();
  updLatApplyBtn();
  // EQ source toggle buttons
  document
    .getElementById("plSrcMeasBtn")
    .addEventListener("click", function () {
      plSrcMeas = !plSrcMeas;
      updPlSrcButtons();
      if (pEqF.length > 0) pUpdEQ();
      else plCheck();
    });
  document
    .getElementById("plSrcLevelsBtn")
    .addEventListener("click", function () {
      plSrcLevels = !plSrcLevels;
      updPlSrcButtons();
      if (pEqF.length > 0) pUpdEQ();
      else plCheck();
    });
  document
    .getElementById("plSrcCurvesBtn")
    .addEventListener("click", function () {
      plSrcCurves = !plSrcCurves;
      updPlSrcButtons();
      if (pEqF.length > 0) pUpdEQ();
      else plCheck();
    });
  // Player EQ strength textbox
  document.getElementById("plStr").addEventListener("change", function () {
    let v = Math.max(0, Math.min(300, parseInt(this.value) || 0));
    this.value = v;
    pUpdEQ();
  });
  document.getElementById("plStr").addEventListener("keydown", function (e) {
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.preventDefault();
      const st = e.shiftKey ? 5 : 1;
      let v = parseInt(this.value) || 100;
      if (e.key === "ArrowRight" || e.key === "ArrowUp")
        v = Math.min(300, v + st);
      if (e.key === "ArrowLeft" || e.key === "ArrowDown")
        v = Math.max(0, v - st);
      this.value = v;
      pUpdEQ();
    }
  });
  document.querySelectorAll(".plStrBtn").forEach((b) =>
    b.addEventListener("click", function () {
      const v = this.dataset.v;
      document.getElementById("plStr").value = v;
      pUpdEQ();
    }),
  );
  document.getElementById("plNHSim").addEventListener("change", function () {
    document
      .getElementById("plNHInfo")
      .classList.toggle("hidden", !this.checked);
    pUpdEQ();
  });
  // balBalance wurde entfernt – kein Event-Listener nötig
  // document.getElementById("balBalance").addEventListener(...);

  // ========== Globale Dateinamen-Ergänzung ==========
  const userFileSuffixEl   = document.getElementById("userFileSuffix");
  const userFileSuffixBtn  = document.getElementById("userFileSuffixBtn");
  const userFileSuffixDrop = document.getElementById("userFileSuffixDrop");

  if (userFileSuffixEl) {
    userFileSuffixEl.addEventListener("input", function () {
      userFileSuffix = String(this.value || "");
      try { localStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
    });
  }
  if (userFileSuffixBtn && userFileSuffixDrop) {
    userFileSuffixBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      const open = userFileSuffixDrop.style.display !== "none";
      userFileSuffixDrop.style.display = open ? "none" : "block";
    });
    userFileSuffixDrop.addEventListener("click", function (e) {
      const opt = e.target.closest("[data-suf]");
      if (!opt) return;
      userFileSuffixEl.value = opt.dataset.suf;
      userFileSuffix = opt.dataset.suf;
      try { localStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
      userFileSuffixDrop.style.display = "none";
      userFileSuffixEl.focus();
    });
    userFileSuffixDrop.addEventListener("mouseover", function (e) {
      const opt = e.target.closest("[data-suf]");
      if (opt) opt.style.background = "rgba(0,0,0,0.08)";
    });
    userFileSuffixDrop.addEventListener("mouseout", function (e) {
      const opt = e.target.closest("[data-suf]");
      if (opt) opt.style.background = "";
    });
    document.addEventListener("click", function () {
      userFileSuffixDrop.style.display = "none";
    });
  }
  try {
    const _sufSaved = localStorage.getItem("ci-lb-userFileSuffix");
    if (_sufSaved !== null) {
      userFileSuffix = String(_sufSaved);
      if (userFileSuffixEl) userFileSuffixEl.value = userFileSuffix;
    }
  } catch (e) {}

  // ========== MAPLAW-UI ==========
  const plMaplawOnEl   = document.getElementById("plMaplawOn");
  const plMaplawSollEl = document.getElementById("plMaplawSollInput");

  if (plMaplawOnEl) {
    plMaplawOnEl.addEventListener("click", function () {
      pMaplawOn = !pMaplawOn;
      if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
      pMaplawTrigger();
      if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
    });
  }

  document.querySelectorAll('[data-maplaw-quick]').forEach((btn) => {
    btn.addEventListener("click", function () {
      const v = parseInt(this.getAttribute("data-maplaw-quick"));
      if (isFinite(v) && v >= 0) {
        pMaplawSollC = v;
        if (plMaplawSollEl) plMaplawSollEl.value = String(v);
        if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
        pMaplawTrigger();
      }
    });
  });

  if (plMaplawSollEl) {
    plMaplawSollEl.addEventListener("change", function () {
      const v = parseInt(this.value);
      if (isFinite(v) && v >= 0 && v <= 8000) {
        pMaplawSollC = v;
        if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
        pMaplawTrigger();
      } else {
        this.value = String(pMaplawSollC);
      }
    });
  }

  // ========== Experimentelle Optionen Toggle ==========
  const plShowExpEl = document.getElementById("plShowExperimental");
  if (plShowExpEl) {
    plShowExpEl.addEventListener("change", function () {
      plShowExperimental = this.checked;
      if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
    });
  }

  // ---- Frequenz-Warping Listener ----
  // Warp-Checkbox
  document.getElementById("plWarpOn").addEventListener("click", function () {
    pWarpOn = !pWarpOn;
    pWarpUpdUI();
    const method = document.getElementById("plWarpMethod").value;
    // Offline-Einschalten: pWarpTrigger regelt Vorberechnung + pause/resume selbst
    if (pWarpOn && method === "offline") {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    // Sonst (Vocoder/Bandshift ein oder beliebig aus): Pfadwechsel an aktueller
    // Position. Symmetrisch in beide Toggle-Richtungen, damit Einschalten genauso
    // wirkt wie Ausschalten.
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    if (!pWarpOn) pWarpedBuf = null;
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
    else if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
  // Verfahren-Dropdown
  document.getElementById("plWarpMethod").addEventListener("change", function () {
    // Methoden-Labels neu setzen (data-t-opt)
    _pWarpApplyMethodLabels();
    pWarpUpdUI();
    // Vocoder vorab laden, damit das await im pPlay nach dem ersten Mal nicht
    // mehr blockt — entkrampft den Toggle-Pfad.
    if ((this.value === "vocoder" || this.value === "sinmodel") &&
        typeof pInitWarpWorklet === "function") {
      try { pInitWarpWorklet(gPC()); } catch (e) {}
    }
    if (!pWarpOn) return;
    if (this.value === "offline") {
      pWarpTrigger();
      return;
    }
    // Methodenwechsel bei aktivem Warp: laufende Wiedergabe auf neuen Pfad bringen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  });
  // Gemeinsamer Reaktor auf Parameteränderungen (Modus, Stärke):
  // - Offline: Vorberechnung neu anstoßen (pWarpTrigger regelt pause/resume)
  // - Vocoder: knackfreier postMessage-Update an laufenden Worklet
  // - Bandshift: Graph-Rebuild via pause/resume (kurze Unterbrechung)
  function _pWarpParamsChanged() {
    if (!pWarpOn) return;
    const method = document.getElementById("plWarpMethod").value;
    if (method === "offline") {
      pWarpTrigger();
      return;
    }
    if (method === "vocoder" && typeof pWarpLiveUpdate === "function") {
      pWarpLiveUpdate();
      return;
    }
    // bandshift: kein Worklet → Graph neu aufbauen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  }
  // Korrektur-Modus-Dropdown
  document.getElementById("plWarpModeSelect").addEventListener("change", function () {
    pWarpMode = this.value;
    _pWarpParamsChanged();
    if (!pPlaying && typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
  // Stärke-Eingabe
  document.getElementById("plWarpStr").addEventListener("change", function () {
    let v = Math.max(0, Math.min(150, parseInt(this.value) || 0));
    this.value = v;
    pWarpStrength = v;
    _pWarpParamsChanged();
    if (!pPlaying && typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
  // Stärke-Buttons
  document.querySelectorAll(".plWarpStrBtn").forEach((b) =>
    b.addEventListener("click", function () {
      const v = parseInt(this.dataset.v);
      document.getElementById("plWarpStr").value = v;
      pWarpStrength = v;
      _pWarpParamsChanged();
      if (!pPlaying && typeof pBuildEQ === "function") pBuildEQ();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
    })
  );
  // Neu-berechnen-Button
  const _plWarpRecalcEl = document.getElementById("plWarpRecalc");
  if (_plWarpRecalcEl) {
    _plWarpRecalcEl.addEventListener("click", function () {
      if (pWarpOn) pWarpTrigger();
    });
  }
  // Warp-UI initialisieren
  _pWarpApplyMethodLabels();
  if (typeof pWarpUpdUI === "function") pWarpUpdUI();

  // Player volume textbox
  document.getElementById("plVol").addEventListener("change", function () {
    const v = Math.max(0, Math.min(100, parseInt(this.value) || 0));
    this.value = v;
    if (pGain) pGain.gain.value = v / 100;
  });
  // Schieber-Tab keyboard nav — wirkt nur, wenn das Canvas selbst
  // den Fokus hat. Im Absolutmodus überspringen ←/→ Elektroden ohne MCL.
  document.addEventListener("keydown", function (e) {
    const pan = document.getElementById("panel-schieber");
    if (!pan || !pan.classList.contains("active")) return;
    const cv = document.getElementById("lvTabCv");
    if (!cv || document.activeElement !== cv) return;
    const nav = (typeof lvTabNavigableEl === "function") ? lvTabNavigableEl() : actEl();
    if (!nav.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      let ci = nav.indexOf(lvTabFocus);
      if (ci < 0) ci = 0;
      if (e.key === "ArrowLeft") ci = Math.max(0, ci - 1);
      else ci = Math.min(nav.length - 1, ci + 1);
      lvTabFocus = nav[ci];
      lvTabDraw();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      if (lvTabMode === "abs") {
        lvTabStepAbsolute(lvTabFocus, dir, e.shiftKey);
      } else {
        const st = e.shiftKey ? 0.1 : 0.5;
        const cur = manualLevels[lvTabFocus] || 0;
        lvTabOnSchieberChange(lvTabFocus, cur + dir * st);
      }
    }
  });
  // Test keyboard — über testEls
  document.addEventListener("keydown", (e) => {
    if (!testAct || !testEls) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
    if (e.code === "Space") {
      e.preventDefault();
      playCur();
    }
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      undoL();
    }
    if (e.key === "b" || e.key === "B") {
      e.preventDefault();
      if (testEls.simulBtn) testEls.simulBtn.click();
    }
    // X-Shortcut für Ausschluss entfällt (§6.6)
    if (testMode === "judgment") {
      if (e.key === "1") { e.preventDefault(); if (testEls.jdgA) testEls.jdgA.click(); }
      if (e.key === "2") { e.preventDefault(); if (testEls.jdgEq) testEls.jdgEq.click(); }
      if (e.key === "3") { e.preventDefault(); if (testEls.jdgB) testEls.jdgB.click(); }
    }
    if (testMode === "balance" && e.key === "Enter") {
      e.preventDefault();
      if (testEls.confirmBtn) testEls.confirmBtn.click();
    }
    if (testMode === "balance" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const s = testEls.slider;
      if (!s) return;
      const st = e.shiftKey ? 0.1 : 0.5;
      let v = parseFloat(s.value);
      if (e.key === "ArrowLeft") v = Math.max(parseFloat(s.min), +(v - st).toFixed(1));
      if (e.key === "ArrowRight") v = Math.min(parseFloat(s.max), +(v + st).toFixed(1));
      s.value = v;
      if (testEls.sliderValue) testEls.sliderValue.textContent = v.toFixed(1) + " dB";
      _testUpdCumulative(v);
    }
  });
  // Load from localStorage
  try {
    const sv = localStorage.getItem("ci-lb-v4");
    if (sv) {
      const d = JSON.parse(sv);
      if (d.sides) {
        if (d.sides.left) loadSideData("left", d.sides.left);
        if (d.sides.right) loadSideData("right", d.sides.right);
        if (d.defaultMfr && MFR[d.defaultMfr]) defaultMfr = d.defaultMfr;
        activeSide = SIDES.includes(d.currentSide) ? d.currentSide : "left";
        bindActiveSide();
        document.getElementById("ciSideSelect").value = activeSide;
        document.getElementById("mfrSelect").value = mfr;
        const cfgSel = document.getElementById("cfgSelect");
        if (cfgSel) cfgSel.value = sideData[activeSide].config || "ci";
        const dfSel = document.getElementById("defaultMfrSelect");
        if (dfSel) dfSel.value = defaultMfr;
      } else {
        loadSideData("left", d);
        activeSide = "left";
        bindActiveSide();
        document.getElementById("ciSideSelect").value = "left";
        document.getElementById("mfrSelect").value = mfr;
      }
      if (typeof d.playerSourceMeas === "boolean") {
        plSrcMeas = d.playerSourceMeas;
        plSrcLevels = !!d.playerSourceLevels;
        plSrcCurves = !!d.playerSourceCurves;
        updPlSrcButtons();
      } else if (typeof d.playerSource === "string") {
        plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
        plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
        plSrcCurves = d.playerSource === "levels" || d.playerSource === "both";
        updPlSrcButtons();
      }
      if (d.eqOn !== undefined) {
        plEqOn = d.eqOn;
        updEqToggleBtn();
      }
      if (d.eqStrength !== undefined)
        document.getElementById("plStr").value = d.eqStrength;
      if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
      if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
      if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
      if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
      if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
      if (typeof pMaplawTrigger === "function") pMaplawTrigger();
      // Warp-Zustand wiederherstellen
      if (typeof pWarpOn !== "undefined") {
        if (typeof d.pWarpOn === "boolean") pWarpOn = d.pWarpOn;
        if (typeof d.pWarpMethod === "string") {
          pWarpMethod = d.pWarpMethod;
          const sel = document.getElementById("plWarpMethod");
          if (sel) sel.value = pWarpMethod;
        }
        if (typeof d.pWarpMode === "string") {
          pWarpMode = d.pWarpMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
        if (typeof d.pWarpStrength === "number") {
          pWarpStrength = d.pWarpStrength;
          const ws = document.getElementById("plWarpStr");
          if (ws) ws.value = pWarpStrength;
        }
        if (typeof pWarpUpdUI === "function") pWarpUpdUI();
      }
      if (d.lrResults && typeof lrResults !== "undefined") {
        Object.assign(lrResults, d.lrResults);
        if (typeof lrRenderResults === "function") lrRenderResults();
      }
      if (typeof latencyResult !== "undefined") {
        latencyResult = (d && d.latencyResult) ? d.latencyResult : null;
      }
      if (typeof plApplyLatency !== "undefined") {
        plApplyLatency = (d && typeof d.plApplyLatency === "boolean")
          ? d.plApplyLatency : true;
      }
      if (typeof plApplyBalance !== "undefined") {
        plApplyBalance = (d && typeof d.plApplyBalance === "boolean")
          ? d.plApplyBalance : true;
      }
      if (typeof plBalanceMode !== "undefined") {
        plBalanceMode = (d && typeof d.plBalanceMode === "string"
                         && ["sym", "left", "right"].includes(d.plBalanceMode))
          ? d.plBalanceMode : "sym";
      }
      if (typeof latApplyToPlayer === "function") latApplyToPlayer();
      if (typeof latRenderResults === "function") latRenderResults();
      if (Array.isArray(d.fRes) && typeof fRes !== "undefined") {
        fRes.splice(0, fRes.length, ...d.fRes);
      }
      if (d.globalToneType) globalToneType = d.globalToneType;
      if (typeof d.userFileSuffix === "string") {
        userFileSuffix = d.userFileSuffix;
        const _el = document.getElementById("userFileSuffix");
        if (_el) _el.value = userFileSuffix;
      }
      if (d.globalSequence) globalSequence = d.globalSequence;
      if (d.slTarget_test) slTarget_test = d.slTarget_test;
      if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
      if (typeof d.levelsTabMode === "string") lvTabMode = d.levelsTabMode;
      if (typeof d.levelsTabVariant === "string") lvTabVariant = d.levelsTabVariant;
      if (typeof d.plBothSides === "boolean") {
        const bsEl = document.getElementById("plBothSides");
        if (bsEl) {
          bsEl.checked = d.plBothSides;
          if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
          if (typeof updBalApplyBtn === "function") updBalApplyBtn();
          if (typeof updLatApplyBtn === "function") updLatApplyBtn();
        }
      }
      buildFreqTable();
      buildImplantCard();
      updSideButtons();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pBuildEQ === "function") pBuildEQ();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
    }
  } catch (e) {}
  // Referenzelektroden-Dropdown im Ergebnis-Reiter
  const _refSel = document.getElementById('refEl');
  if (_refSel) {
    _refSel.addEventListener('change', function() {
      refEl = +this.value;
      if (typeof renderResults === 'function') renderResults();
      if (typeof drawLvChart    === 'function') drawLvChart();
      if (typeof pUpdEQ         === 'function') pUpdEQ();
    });
  }

  // Modus-Toggle relativ/absolut
  document.querySelectorAll('input[name="lvTabMode"]').forEach((r) => {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      const newMode = this.value;
      if (newMode === "abs" && !lvTabAbsoluteAvailable()) {
        this.checked = false;
        const relBtn = document.getElementById("lvTabModeRel");
        if (relBtn) relBtn.checked = true;
        alert(t("lvTabAbsNotAvailable"));
        return;
      }
      lvTabMode = newMode;
      // lvTabVariant wird hier NICHT überschrieben — die vom Nutzer
      // gewählte Anzeige-Variante (gestapelt / nur Summe) bleibt
      // beim Modus-Wechsel erhalten.
      // Fokus für den neuen Modus revalidieren (Absolutmodus überspringt
      // Elektroden ohne MCL).
      lvTabRebuild();
    });
  });
  // Variante-Toggle
  document.querySelectorAll('input[name="lvTabVariant"]').forEach((r) => {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      lvTabVariant = this.value;
      lvTabDraw();
    });
  });

  setInterval(() => {
    try {
      localStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({
          sides: {
            left: {
              config: sideData.left.config || "ci",
              manufacturer: sideData.left.manufacturer,
              frequencies: sideData.left.freqs,
              electrodeFreqOwn: sideData.left.elFreqOwn,
              electrodeStatus: sideData.left.elSt,
              electrodeNotes: sideData.left.elNt,
              electrodeExcludedDuring: sideData.left.elExDur,
              referenceElectrode: sideData.left.refEl,
              judgmentResults: sideData.left.jRes,
              balanceResults: sideData.left.bRes,
              manualLevels: sideData.left.manualLevels,
              presets: sideData.left.presets,
              fullSweepRound: sideData.left.fullSweepRound,
              fullSweepDonePairs: sideData.left.fullSweepDonePairs,
              implant: sideData.left.implant,
              freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
            },
            right: {
              config: sideData.right.config || "ci",
              manufacturer: sideData.right.manufacturer,
              frequencies: sideData.right.freqs,
              electrodeFreqOwn: sideData.right.elFreqOwn,
              electrodeStatus: sideData.right.elSt,
              electrodeNotes: sideData.right.elNt,
              electrodeExcludedDuring: sideData.right.elExDur,
              referenceElectrode: sideData.right.refEl,
              judgmentResults: sideData.right.jRes,
              balanceResults: sideData.right.bRes,
              manualLevels: sideData.right.manualLevels,
              presets: sideData.right.presets,
              fullSweepRound: sideData.right.fullSweepRound,
              fullSweepDonePairs: sideData.right.fullSweepDonePairs,
              implant: sideData.right.implant,
              freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
            },
          },
          defaultMfr: defaultMfr,
          currentSide: activeSide,
          lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
          latencyResult: (typeof latencyResult !== "undefined") ? latencyResult : null,
          plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
          plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
          plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
          fRes: (typeof fRes !== "undefined") ? fRes : [],
          playerSourceMeas: plSrcMeas,
          playerSourceLevels: plSrcLevels,
          playerSourceCurves: plSrcCurves,
          eqOn: plEqOn,
          eqStrength: parseInt(document.getElementById("plStr").value),
          plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
          plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
          playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
          pWarpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,
          pWarpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "sinmodel",
          pWarpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "var_side",
          pWarpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
          userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
          globalToneType: globalToneType,
          globalSequence: globalSequence,
          slTarget_test: slTarget_test,
          slTarget_balance: slTarget_balance,
          levelsTabMode: lvTabMode,
          levelsTabVariant: lvTabVariant,
          levelsTabShowMeas: lvTabShowMeas,
          levelsTabShowCurves: lvTabShowCurves,
          plBothSides: document.getElementById("plBothSides").checked,
        }),
      );
    } catch (e) {}
  }, 5000);

  // Tab/Subtab nach Reload wiederherstellen — URL-Hash hat Vorrang vor localStorage.
  try {
    _suppressHashPush = true;
    const hashMatch = location.hash.slice(1).match(/^([^:]+)(?::(.+))?$/);
    if (hashMatch) {
      const [, hashTab, hashSub] = hashMatch;
      const tabBtn = document.querySelector('.tab[data-tab="' + hashTab + '"]');
      if (tabBtn && typeof switchTab === "function") switchTab(hashTab);
      if (hashSub) {
        const subBtn = document.querySelector('.subtab[data-parent="' + hashTab + '"][data-subtab="' + hashSub + '"]');
        if (subBtn && typeof switchSubtab === "function") switchSubtab(hashTab, hashSub);
      }
    } else {
      const savedTab = localStorage.getItem("ci-lb-activeTab");
      if (savedTab) {
        const tabBtn = document.querySelector('.tab[data-tab="' + savedTab + '"]');
        if (tabBtn && typeof switchTab === "function") {
          switchTab(savedTab);
        }
      }
      // Subtab pro Parent
      const subtabParents = ["messungen", "ergebnisse"];
      for (const parent of subtabParents) {
        const savedSub = localStorage.getItem("ci-lb-subtab-" + parent);
        if (!savedSub) continue;
        const subBtn = document.querySelector('.subtab[data-parent="' + parent + '"][data-subtab="' + savedSub + '"]');
        if (subBtn && typeof switchSubtab === "function") {
          switchSubtab(parent, savedSub);
        }
      }
    }
    // Hash auf aktuell aktiven Tab setzen (replaceState — kein History-Eintrag)
    const activeTabBtn = document.querySelector(".tab.active");
    if (activeTabBtn) {
      const at = activeTabBtn.dataset.tab;
      const asb = document.querySelector('.subtab[data-parent="' + at + '"].active');
      history.replaceState(null, "", "#" + (asb ? at + ":" + asb.dataset.subtab : at));
    }
  } catch (e) {
    // localStorage nicht verfügbar oder gespeicherter Tab existiert nicht
    // mehr — still durchfallen, Default-Tab bleibt aktiv.
  } finally {
    _suppressHashPush = false;
  }
  if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
});
