document.addEventListener("DOMContentLoaded", () => {
  try {
    const sl = localStorage.getItem("ci-lb-lang");
    if (sl && L[sl]) {
      document.getElementById("langSelect").value = sl;
      lang = sl;
    }
  } catch (e) {}
  // BA336: Inhalts-Sprache — Default = Tool-Sprache, dann ggf. gespeicherten Wert uebernehmen
  if (typeof plContentLang !== "undefined") {
    plContentLang = (typeof lang !== "undefined") ? lang : "de";
    try {
      const cl = localStorage.getItem("ci-lb-content-lang");
      if (cl) plContentLang = cl;
    } catch (e) {}
  }
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

  // ---- Warp i18n Hilfsfunktion (Modus-Dropdown) ----
  function _pWarpApplyLangTexts() {
    const modeSel = document.getElementById("plWarpModeSelect");
    if (!modeSel) return;
    const modeKeys = ["pwModeLeft", "pwModeRight", "pwModeSym"];
    for (let i = 0; i < modeSel.options.length; i++) {
      if (modeKeys[i]) modeSel.options[i].text = t(modeKeys[i]);
    }
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

  // BA 242: Tonauswahl-Modal im Implantat-Tab.
  var implTpBtn = document.getElementById("implTonePopupBtn");
  if (implTpBtn) {
    implTpBtn.addEventListener("click", function () {
      if (typeof openImplantTonePopup === "function") openImplantTonePopup();
    });
  }
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
    if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
    plCheck();
  });
  // ciSideSelect hidden; side switching via sideLeftBtn/sideRightBtn onclick
  // Player: Beide-Seiten Checkbox
  document
    .getElementById("plBothSides")
    .addEventListener("change", function () {
      updatePlayerForSideChange();
      updBalApplyBtn();
      updLatApplyBtn();
      // BA 306: Einseiten-Inhalt ist jetzt Mono -> Warp-Inhalt aendert
      // sich beim Wechsel both <-> einseitig, neu berechnen.
      if (typeof pWarpOn !== "undefined" && pWarpOn && plEqOn
          && typeof pWarpTrigger === "function") {
        pWarpTrigger();
      }
      try {
        // BA 163: pro Browser-Tab
        const _sv = sessionStorage.getItem("ci-lb-v4");
        if (_sv) {
          const _d = JSON.parse(_sv);
          _d.plBothSides = this.checked;
          sessionStorage.setItem("ci-lb-v4", JSON.stringify(_d));
        }
      } catch (_e) {}
    });
  // BA 306: Player — Stereo-zu-Mono-Misch-Checkbox
  document
    .getElementById("plMonoEQ")
    .addEventListener("change", function () {
      updatePlayerForSideChange();
      updBalApplyBtn();
      updLatApplyBtn();
      // Warp-Inhalt haengt von der Mono-Mischung ab -> neu berechnen.
      if (typeof pWarpOn !== "undefined" && pWarpOn && plEqOn
          && typeof pWarpTrigger === "function") {
        pWarpTrigger();
      }
      try {
        const _sv = sessionStorage.getItem("ci-lb-v4");
        if (_sv) {
          const _d = JSON.parse(_sv);
          _d.plMonoEQ = this.checked;
          sessionStorage.setItem("ci-lb-v4", JSON.stringify(_d));
        }
      } catch (_e) {}
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
  document
    .getElementById("apoExportBtn")
    .addEventListener("click", exportEqualizerAPO);
  ["lvChkMeas", "lvChkMan", "lvChkPre"].forEach((id) =>
    document.getElementById(id).addEventListener("change", drawLvChart),
  );
  // Player EQ toggle — wirkt als Master-Bypass auch für Frequenz-Warping.
  // Wenn pWarpOn=true und Wiedergabe läuft, muss der Audio-Graph gewechselt
  // werden (Vocoder/Bandshift rein/raus), nicht nur EQ-Gains aktualisiert.
  document.getElementById("plEqToggle").addEventListener("click", function () {
    plEqOn = !plEqOn;
    updEqToggleBtn();
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
    pUpdEQ();
    if (typeof latApplyToPlayer === "function") latApplyToPlayer();
    if (pWarpOn) {
      // getPlaybackBuffer entscheidet anhand plEqOn neu; bei laufender
      // Wiedergabe Pfad an aktueller Position wechseln.
      const wasPlaying = pPlaying;
      if (wasPlaying) pPause();
      pBuf = getPlaybackBuffer();
      if (wasPlaying) pPlay();
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
  if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
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
  document.getElementById("plNHSim").addEventListener("change", function () {
    document
      .getElementById("plNHInfo")
      .classList.toggle("hidden", !this.checked);
    pUpdEQ();
    if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  });
  document.getElementById("plEqHeadroom").addEventListener("change", function () {
    plEqHeadroom = this.checked;
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
    if (typeof updBalApplyBtn === "function") updBalApplyBtn();
    pUpdEQ();
    if (typeof _autoSaveState === "function") _autoSaveState();
  });
  document.getElementById("plEqHeadroomBoth").addEventListener("change", function () {
    plEqHeadroomBoth = this.checked;
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
    if (typeof updBalApplyBtn === "function") updBalApplyBtn();
    pUpdEQ();
    if (typeof _autoSaveState === "function") _autoSaveState();
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
      // BA 163: pro Browser-Tab
      try { sessionStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
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
      // BA 163: pro Browser-Tab
      try { sessionStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
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
    // BA 163: pro Browser-Tab
    const _sufSaved = sessionStorage.getItem("ci-lb-userFileSuffix");
    if (_sufSaved !== null) {
      userFileSuffix = String(_sufSaved);
      if (userFileSuffixEl) userFileSuffixEl.value = userFileSuffix;
    }
  } catch (e) {}

  // ========== BA 268: Nachname / Vorname ==========
  const userLastNameEl  = document.getElementById("userLastName");
  const userFirstNameEl = document.getElementById("userFirstName");

  if (userLastNameEl) {
    userLastNameEl.addEventListener("input", function () {
      userLastName = String(this.value || "");
      try { sessionStorage.setItem("ci-lb-userLastName", userLastName); } catch (e) {}
    });
  }
  if (userFirstNameEl) {
    userFirstNameEl.addEventListener("input", function () {
      userFirstName = String(this.value || "");
      try { sessionStorage.setItem("ci-lb-userFirstName", userFirstName); } catch (e) {}
    });
  }
  try {
    const _lnSaved = sessionStorage.getItem("ci-lb-userLastName");
    if (_lnSaved !== null) {
      userLastName = String(_lnSaved);
      if (userLastNameEl) userLastNameEl.value = userLastName;
    }
    const _fnSaved = sessionStorage.getItem("ci-lb-userFirstName");
    if (_fnSaved !== null) {
      userFirstName = String(_fnSaved);
      if (userFirstNameEl) userFirstNameEl.value = userFirstName;
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
    // Wenn Warp deaktiviert wird waehrend Berechnung laeuft: abbrechen.
    // pWarpTrigger() uebernimmt danach (pBuf, pPlay, UI-Update).
    if (!pWarpOn && typeof pWarpBusy !== "undefined" && pWarpBusy) {
      if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    pWarpUpdUI();
    if (pWarpOn && !pWarpedBuf) {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
    else if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
  // Dreieck-Button: Warp-Einstellungen auf-/zuklappen
  document.getElementById("plWarpSettingsToggle").addEventListener("click", function () {
    pWarpSettingsOpen = !pWarpSettingsOpen;
    pWarpUpdUI();
  });
  // Gemeinsamer Reaktor auf Parameteränderungen (Modus, Stärke):
  // - Offline: Vorberechnung neu anstoßen (pWarpTrigger regelt pause/resume)
  // - Vocoder: knackfreier postMessage-Update an laufenden Worklet
  // - Bandshift: Graph-Rebuild via pause/resume (kurze Unterbrechung)
  function _pWarpParamsChanged() {
    pWarpedBuf = null;
    if (!pWarpOn) return;
    pWarpTrigger();
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
  // BA 191: Rubberband-Optionen — Engine-/Material-Radios, Toggles.
  // Aenderungen invalidieren den vorberechneten Buffer und triggern
  // (bei aktivem Warp) eine Neuberechnung. Reiner Zustand wird ueber
  // _autoSaveState() persistiert.
  function _pRbOptUpdateR3Hint() {
    const hint = document.getElementById("plWarpMaterialR3Hint");
    if (!hint) return;
    hint.style.display = (pRubberbandOptions.engine === "r3") ? "" : "none";
  }
  window._pRbOptUpdateR3Hint = _pRbOptUpdateR3Hint;

  function _pRbOptOnChange() {
    pWarpedBuf = null;
    _pRbOptUpdateR3Hint();
    if (typeof _autoSaveState === "function") _autoSaveState();
    if (!pWarpOn) return;
    pWarpTrigger();
  }

  document.querySelectorAll('input[name="plWarpEngine"]').forEach(function (r) {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      pRubberbandOptions.engine = (this.value === "r2") ? "r2" : "r3";
      _pRbOptOnChange();
    });
  });

  document.querySelectorAll('input[name="plWarpMaterial"]').forEach(function (r) {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      const v = this.value;
      pRubberbandOptions.material = (v === "speech" || v === "percussive") ? v : "standard";
      _pRbOptOnChange();
    });
  });

  document.getElementById("plWarpFormant").addEventListener("change", function () {
    pRubberbandOptions.formant = !!this.checked;
    _pRbOptOnChange();
  });

  document.getElementById("plWarpFast").addEventListener("change", function () {
    pRubberbandOptions.fast = !!this.checked;
    _pRbOptOnChange();
  });

  // BA367: Realtime-Testschalter. Bewusst NICHT persistent (nicht in
  // _autoSaveState/JSON aufgenommen) — _pRbOptOnChange ruft zwar
  // _autoSaveState auf, aber pRubberbandOptions.realtime wird in den
  // Save-Stellen (file.js/print-md.js/init.js) absichtlich nicht
  // mitserialisiert, faellt also bei Neuladen auf false zurueck.
  document.getElementById("plWarpRealtime").addEventListener("change", function () {
    pRubberbandOptions.realtime = !!this.checked;
    _pRbOptOnChange();
  });

  // BA368: LiveShifter-Testschalter. Wie der Realtime-Schalter bewusst
  // NICHT persistent (nicht in den Save-Stellen serialisiert). Ist er an,
  // laeuft der LiveShifter-Pfad und das realtime-Bit wird ignoriert.
  document.getElementById("plWarpLiveShifter").addEventListener("change", function () {
    pRubberbandOptions.liveShifter = !!this.checked;
    _pRbOptOnChange();
  });

  // Hinweistext-Sichtbarkeit beim ersten Render synchronisieren.
  _pRbOptUpdateR3Hint();
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
  // Stop-Button für Rubberband-Abbruch
  const _plWarpStopBtn = document.getElementById("plWarpStopBtn");
  if (_plWarpStopBtn) {
    _plWarpStopBtn.addEventListener("click", () => {
      if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
    });
  }
  // Warp-UI initialisieren
  _pWarpApplyLangTexts();
  if (typeof pWarpUpdUI === "function") pWarpUpdUI();

  // Player volume textbox
  document.getElementById("plVol").addEventListener("change", function () {
    const v = Math.max(0, Math.min(100, parseInt(this.value) || 0));
    this.value = v;
    if (pGain) pGain.gain.value = v / 100;
    if (typeof plUpdVolBtns === "function") plUpdVolBtns();
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

  // BA 163: Load from sessionStorage (pro Browser-Tab)
  try {
    // BA 163: Pro-Tab-Isolation — Lesen aus sessionStorage
    const sv = sessionStorage.getItem("ci-lb-v4");
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
      if (typeof plEqHeadroom !== "undefined") {
        plEqHeadroom = (typeof d.eqHeadroom === "boolean") ? d.eqHeadroom : true;
        if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
      }
      if (typeof plEqHeadroomBoth !== "undefined") {
        plEqHeadroomBoth = (typeof d.eqHeadroomBoth === "boolean") ? d.eqHeadroomBoth : true;
        if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
        if (typeof updBalApplyBtn === "function") updBalApplyBtn();
      }
      if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
      if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
      if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
      if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
      if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
      if (typeof pMaplawTrigger === "function") pMaplawTrigger();
      // BA323: Player-Box-Felder werden beim Auto-Restore nicht mehr angewendet.
      // BA 161: Warp-Zustand wiederherstellen — neue Schlüsselnamen,
      // Fallback auf alte (pWarpOn etc.) für bestehende localStorage-Stände
      if (typeof pWarpOn !== "undefined") {
        const _wOn       = (typeof d.warpOn       === "boolean") ? d.warpOn
                         : (typeof d.pWarpOn      === "boolean") ? d.pWarpOn      : undefined;

        const _wMode     = (typeof d.warpMode     === "string")  ? d.warpMode
                         : (typeof d.pWarpMode    === "string")  ? d.pWarpMode    : undefined;
        const _wStrength = (typeof d.warpStrength === "number")  ? d.warpStrength
                         : (typeof d.pWarpStrength === "number") ? d.pWarpStrength : undefined;
        if (typeof _wOn === "boolean") pWarpOn = _wOn;
        if (typeof _wMode === "string") {
          pWarpMode = (typeof _migrateLegacyWarpMode === "function")
            ? _migrateLegacyWarpMode(_wMode, d.fRes)
            : _wMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
        if (typeof _wStrength === "number") {
          pWarpStrength = _wStrength;
          const ws = document.getElementById("plWarpStr");
          if (ws) ws.value = pWarpStrength;
        }
        if (typeof pWarpUpdUI === "function") pWarpUpdUI();
        if (typeof pRubberbandOptions !== "undefined"
            && d.warpRbOptions && typeof d.warpRbOptions === "object") {
          if (typeof d.warpRbOptions.engine === "string") {
            pRubberbandOptions.engine = (d.warpRbOptions.engine === "r2") ? "r2" : "r3";
          }
          if (typeof d.warpRbOptions.material === "string") {
            const m = d.warpRbOptions.material;
            pRubberbandOptions.material = (m === "speech" || m === "percussive") ? m : "standard";
          }
          if (typeof d.warpRbOptions.formant === "boolean") {
            // BA369: Staende, die VOR 0.4.369-beta gespeichert wurden, tragen
            // formant:true nur als ungefragten Alt-Default — auf aus zwingen.
            // Ab 0.4.369-beta ist der gespeicherte Wert bewusste Nutzerwahl
            // und wird respektiert. Fehlt d.version (sehr alt), gilt der Stand
            // als alt (_verCmp behandelt undefined als 0.0.0 < 0.4.369).
            const _savedIsPreBA369 = (typeof _verCmp === "function")
              && _verCmp(d.version, "0.4.369-beta") < 0;
            pRubberbandOptions.formant = _savedIsPreBA369
              ? false
              : d.warpRbOptions.formant;
          }
          if (typeof d.warpRbOptions.fast === "boolean") {
            pRubberbandOptions.fast = d.warpRbOptions.fast;
          }
          // UI-Sync
          const rE = document.querySelector('input[name="plWarpEngine"][value="' + pRubberbandOptions.engine + '"]');
          if (rE) rE.checked = true;
          const rM = document.querySelector('input[name="plWarpMaterial"][value="' + pRubberbandOptions.material + '"]');
          if (rM) rM.checked = true;
          const cF = document.getElementById("plWarpFormant");
          if (cF) cF.checked = !!pRubberbandOptions.formant;
          const cS = document.getElementById("plWarpFast");
          if (cS) cS.checked = !!pRubberbandOptions.fast;
          if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
        }
      }
      // BA 177: wenn beim Auto-Restore schon Frequenzabgleich-Messungen
      // vorhanden sind, Default-Anwendungs-Flag setzen.
      try {
        const _hasFm =
          (Array.isArray(fRes) && fRes.length > 0)
          || (typeof _fmHasSliderEstimates === "function" && _fmHasSliderEstimates())
          || (typeof _fmHasAdaptiveData === "function" && _fmHasAdaptiveData());
        if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
          pMarkPlayerWarpDefaultAsApplied();
        }
      } catch (e) { /* defensiv */ }
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
      // BA323: Player-Box-Felder werden beim Auto-Restore nicht mehr angewendet.
      if (typeof latApplyToPlayer === "function") latApplyToPlayer();
      if (typeof latRenderResults === "function") latRenderResults();
      if (Array.isArray(d.fRes) && typeof fRes !== "undefined") {
        // BA 106: KEIN Filter, dieselbe Migrations-Sequenz wie in file.js.
        fRes.splice(0, fRes.length, ...d.fRes);
        if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
        if (typeof _fmMigrateAltSliderFRes === "function") _fmMigrateAltSliderFRes();
      }
      // BA 209 + BA 225: Per-Test-Tonart Frequenzabgleich (Auto-Restore).
      // Migration aus altem globalToneType-Feld (nur lesen, nicht mehr schreiben).
      if (typeof toneType_freqmatch !== "undefined") {
        if (isValidToneType(d.toneType_freqmatch)) {
          toneType_freqmatch = d.toneType_freqmatch;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_freqmatch = d.globalToneType;
        }
      }
      if (typeof toneType_balance !== "undefined") {
        if (isValidToneType(d.toneType_balance)) {
          toneType_balance = d.toneType_balance;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_balance = d.globalToneType;
        }
      }
      // BA 287: gemeinsame Lautstaerke (Auto-Restore). Abwaertskompat:
      // alter Stand ohne volume_global -> volume_test uebernehmen.
      if (typeof volume_global !== "undefined") {
        var _vgR = parseInt(d.volume_global, 10);
        if (!(isFinite(_vgR) && _vgR >= 0 && _vgR <= 100)) _vgR = parseInt(d.volume_test, 10);
        if (isFinite(_vgR) && _vgR >= 0 && _vgR <= 100) volume_global = _vgR;
      }
      if (typeof duration_balance !== "undefined" && isFinite(parseInt(d.duration_balance, 10))) duration_balance = parseInt(d.duration_balance, 10);
      if (typeof pause_balance    !== "undefined" && isFinite(parseInt(d.pause_balance,    10))) pause_balance    = parseInt(d.pause_balance,    10);
      // BA 282: Per-Test-Tonart Elektrodenlautstaerke (Auto-Restore),
      // analog zu toneType_freqmatch/toneType_balance weiter oben.
      if (typeof toneType_test !== "undefined") {
        if (isValidToneType(d.toneType_test)) {
          toneType_test = d.toneType_test;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_test = d.globalToneType;
        }
      }
      if (typeof duration_test !== "undefined" && isFinite(parseInt(d.duration_test, 10))) duration_test = parseInt(d.duration_test, 10);
      if (typeof pause_test    !== "undefined" && isFinite(parseInt(d.pause_test,    10))) pause_test    = parseInt(d.pause_test,    10);
      // BA 282: Dur/Pau Frequenzabgleich (Auto-Restore; Tonart ist oben schon dabei).
      if (typeof duration_freqmatch !== "undefined" && isFinite(parseInt(d.duration_freqmatch, 10))) duration_freqmatch = parseInt(d.duration_freqmatch, 10);
      if (typeof pause_freqmatch    !== "undefined" && isFinite(parseInt(d.pause_freqmatch,    10))) pause_freqmatch    = parseInt(d.pause_freqmatch,    10);
      if (typeof d.userFileSuffix === "string") {
        userFileSuffix = d.userFileSuffix;
        const _el = document.getElementById("userFileSuffix");
        if (_el) _el.value = userFileSuffix;
      }
      if (typeof d.userLastName === "string") {
        userLastName = d.userLastName;
        const _ln = document.getElementById("userLastName");
        if (_ln) _ln.value = userLastName;
        try { sessionStorage.setItem("ci-lb-userLastName", userLastName); } catch (e) {}
      }
      if (typeof d.userFirstName === "string") {
        userFirstName = d.userFirstName;
        const _fn = document.getElementById("userFirstName");
        if (_fn) _fn.value = userFirstName;
        try { sessionStorage.setItem("ci-lb-userFirstName", userFirstName); } catch (e) {}
      }
      // BA 254: Tonfolge pro Test — Migration aus altem globalSequence-Feld.
      function _validSeq(s) { return (s === "aba" || s === "ab") ? s : null; }
      var _legacySeq = _validSeq(d.globalSequence) || "ab";
      if (typeof sequence_freqmatch !== "undefined") {
        sequence_freqmatch = _validSeq(d.sequence_freqmatch) || _legacySeq;
      }
      if (typeof sequence_test !== "undefined") {
        sequence_test = _validSeq(d.sequence_test) || _legacySeq;
      }
      if (typeof sequence_balance !== "undefined") {
        sequence_balance = _validSeq(d.sequence_balance) || _legacySeq;
      }
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
      if (typeof d.plMonoEQ === "boolean") {
        const mmEl = document.getElementById("plMonoEQ");
        if (mmEl) {
          mmEl.checked = d.plMonoEQ;
          if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
          if (typeof plUpdMonoBox === "function") plUpdMonoBox();
        }
      }
      // BA 161: bisher nur in Datei-Load
      if (typeof audiologUserNote !== "undefined") {
        audiologUserNote = (typeof d.audiologUserNote === "string") ? d.audiologUserNote : "";
        const aNoteEl = document.getElementById("audiologNoteInput");
        if (aNoteEl) aNoteEl.value = audiologUserNote;
      }
      if (typeof lrSnapshot !== "undefined") {
        lrSnapshot = (d && d.lrSnapshot) ? d.lrSnapshot : null;
      }
      buildFreqTable();
      buildImplantCard();
      updSideButtons();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pBuildEQ === "function") pBuildEQ();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
      if (typeof fmApplyLang === "function") fmApplyLang();
      if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
      if (typeof lrRefreshElectrodeSelectionSummary === "function") lrRefreshElectrodeSelectionSummary();
      if (typeof fmRefreshElectrodeSelectionSummary === "function") fmRefreshElectrodeSelectionSummary();
      if (typeof testRefreshElectrodeSelectionSummary === "function") testRefreshElectrodeSelectionSummary();
      if (typeof lrRefreshToneTypeLabel === "function") lrRefreshToneTypeLabel();
      if (typeof fmRefreshToneTypeLabel === "function") fmRefreshToneTypeLabel();
      if (typeof testRefreshToneTypeLabel === "function") testRefreshToneTypeLabel();
      if (typeof plUpdSourceUI    === "function") plUpdSourceUI();
      if (typeof plUpdTransportUI === "function") plUpdTransportUI();
      if (typeof plNoiseRefreshUI  === "function") plNoiseRefreshUI();
      if (typeof plSentBgRefreshUI === "function") plSentBgRefreshUI();
      if (typeof plBookRefreshUI   === "function") plBookRefreshUI();
      if (typeof plUpdDisplay      === "function") plUpdDisplay();
      if (typeof plRefreshTooltips === "function") plRefreshTooltips();
    }
  } catch (e) {}
  // Referenzelektroden-Dropdown im Ergebnis-Reiter
  const _refSel = document.getElementById('refEl');
  if (_refSel) {
    _refSel.addEventListener('change', function() {
      setRefEl(+this.value);
    });
  }

  // BA353: Umschalter aktives Verfahren.
  // BA363 Klavier-only: Listener auskommentiert; zum Reaktivieren entfernen.
  // const _fmAdaBtn = document.getElementById("fmActiveMethodAdaptiveBtn");
  // const _fmSliBtn = document.getElementById("fmActiveMethodSliderBtn");
  // const _fmPiaBtn = document.getElementById("fmActiveMethodPianoBtn");
  // if (_fmAdaBtn) _fmAdaBtn.addEventListener("click", function () { fmSetActiveMethod("adaptive"); });
  // if (_fmSliBtn) _fmSliBtn.addEventListener("click", function () { fmSetActiveMethod("slider"); });
  // if (_fmPiaBtn) _fmPiaBtn.addEventListener("click", function () { fmSetActiveMethod("piano"); });

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

  function _autoSaveState() {
    try {
      // BA 163: Auto-Save isoliert pro Browser-Tab
      sessionStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({
          sides: {
            left: {
              config: sideData.left.config || "ci",
              manufacturer: sideData.left.manufacturer,
              frequencies: sideData.left.freqs,
              electrodeFreqOwn: sideData.left.elFreqOwn,
              electrodeStatus: sideData.left.elSt,
              // BA 164
              electrodeActive: sideData.left.elActive,
              electrodeNotes: sideData.left.elNt,
              electrodeExcludedDuring: sideData.left.elExDur,
              referenceElectrode: sideData.left.refEl,
              balanceResults: sideData.left.bRes,
              manualLevels: sideData.left.manualLevels,
              presets: sideData.left.presets,
              fullSweepRound: sideData.left.fullSweepRound,
              fullSweepDonePairs: sideData.left.fullSweepDonePairs,
              implant: sideData.left.implant,
              freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
              freqmatchPiano: sideData.left.freqmatchPiano || null,
              // BA 161: bisher nur in Datei-Save, jetzt auch hier
              fmMode:        sideData.left.fmMode || 'adaptive',
              fmAdaptiveDur: sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 200,
              fmAdaptivePau: sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 200,
            },
            right: {
              config: sideData.right.config || "ci",
              manufacturer: sideData.right.manufacturer,
              frequencies: sideData.right.freqs,
              electrodeFreqOwn: sideData.right.elFreqOwn,
              electrodeStatus: sideData.right.elSt,
              // BA 164
              electrodeActive: sideData.right.elActive,
              electrodeNotes: sideData.right.elNt,
              electrodeExcludedDuring: sideData.right.elExDur,
              referenceElectrode: sideData.right.refEl,
              balanceResults: sideData.right.bRes,
              manualLevels: sideData.right.manualLevels,
              presets: sideData.right.presets,
              fullSweepRound: sideData.right.fullSweepRound,
              fullSweepDonePairs: sideData.right.fullSweepDonePairs,
              implant: sideData.right.implant,
              freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
              freqmatchPiano: sideData.right.freqmatchPiano || null,
              // BA 161
              fmMode:        sideData.right.fmMode || 'adaptive',
              fmAdaptiveDur: sideData.right.fmAdaptiveDur != null ? sideData.right.fmAdaptiveDur : 200,
              fmAdaptivePau: sideData.right.fmAdaptivePau != null ? sideData.right.fmAdaptivePau : 200,
            },
          },
          defaultMfr: defaultMfr,
          currentSide: activeSide,
          lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
          // BA 161
          lrSnapshot: (typeof lrSnapshot !== "undefined") ? lrSnapshot : null,
          latencyResult: (typeof latencyResult !== "undefined") ? latencyResult : null,
          plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
          plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
          plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
          fRes: (typeof fRes !== "undefined") ? fRes : [],
          playerSourceMeas: plSrcMeas,
          playerSourceLevels: plSrcLevels,
          playerSourceCurves: plSrcCurves,
          eqOn: plEqOn,
          eqHeadroom: (typeof plEqHeadroom !== "undefined") ? plEqHeadroom : true,
          eqHeadroomBoth: (typeof plEqHeadroomBoth !== "undefined") ? plEqHeadroomBoth : true,
          plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
          plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
          playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
          // BA323: Player-Box-Felder werden nicht mehr im Auto-Save gespeichert.
          // BA 161: Warp-Feldnamen vereinheitlicht (gleicher Schlüssel wie in Datei-Save)
          warpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,

          warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "right",
          warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
          warpRbOptions: (typeof pRubberbandOptions !== "undefined")
            ? { ...pRubberbandOptions } : null,
          version: (typeof APP_VERSION !== "undefined") ? APP_VERSION : "",
          userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
          userLastName:   (typeof userLastName   === "string") ? userLastName   : "",
          userFirstName:  (typeof userFirstName  === "string") ? userFirstName  : "",
          // BA 161: bisher nur in Datei-Save
          audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
          toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
            ? toneType_freqmatch : TEST_DEFAULTS.freqmatch.toneType,
          toneType_balance: (typeof toneType_balance !== "undefined")
            ? toneType_balance : TEST_DEFAULTS.balance.toneType,
          // BA 287: gemeinsame Lautstaerke.
          volume_global: (typeof volume_global !== "undefined") ? volume_global : TEST_DEFAULTS.commonVolume,
          duration_balance: (typeof duration_balance !== "undefined") ? duration_balance : TEST_DEFAULTS.balance.duration,
          pause_balance:    (typeof pause_balance    !== "undefined") ? pause_balance    : TEST_DEFAULTS.balance.pause,
          // BA 282: Tonart/Dur/Pau Elektrodenlautstaerke (wie Datei-Save).
          toneType_test: (typeof toneType_test !== "undefined")
            ? toneType_test : TEST_DEFAULTS.test.toneType,
          duration_test: (typeof duration_test !== "undefined") ? duration_test : TEST_DEFAULTS.test.duration,
          pause_test:    (typeof pause_test    !== "undefined") ? pause_test    : TEST_DEFAULTS.test.pause,
          // BA 282: Dur/Pau Frequenzabgleich (wie Datei-Save; Tonart ist oben schon dabei).
          duration_freqmatch: (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : TEST_DEFAULTS.freqmatch.duration,
          pause_freqmatch:    (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : TEST_DEFAULTS.freqmatch.pause,
          sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : TEST_DEFAULTS.freqmatch.sequence,
          sequence_test:      (typeof sequence_test      !== "undefined") ? sequence_test      : TEST_DEFAULTS.test.sequence,
          sequence_balance:   (typeof sequence_balance   !== "undefined") ? sequence_balance   : TEST_DEFAULTS.balance.sequence,
          levelsTabMode: lvTabMode,
          levelsTabVariant: lvTabVariant,
          levelsTabShowMeas: lvTabShowMeas,
          levelsTabShowCurves: lvTabShowCurves,
          plBothSides: document.getElementById("plBothSides").checked,
          plMonoEQ: document.getElementById("plMonoEQ")
            ? document.getElementById("plMonoEQ").checked : false,
        }),
      );
    } catch (e) {}
  }
  setInterval(_autoSaveState, 5000);
  // BA 161: global verfügbar machen, damit resetAll() sofort speichern kann
  window._autoSaveState = _autoSaveState;

  // Tab/Subtab nach Reload wiederherstellen — URL-Hash hat Vorrang vor sessionStorage.
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
      // BA 163: pro Browser-Tab
      const savedTab = sessionStorage.getItem("ci-lb-activeTab");
      if (savedTab) {
        const tabBtn = document.querySelector('.tab[data-tab="' + savedTab + '"]');
        if (tabBtn && typeof switchTab === "function") {
          switchTab(savedTab);
        }
      }
      // Subtab pro Parent
      const subtabParents = ["messungen", "ergebnisse"];
      for (const parent of subtabParents) {
        // BA 163: pro Browser-Tab
        const savedSub = sessionStorage.getItem("ci-lb-subtab-" + parent);
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
    // sessionStorage nicht verfügbar oder gespeicherter Tab existiert nicht
    // mehr — still durchfallen, Default-Tab bleibt aktiv.
  } finally {
    _suppressHashPush = false;
  }
  if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 172: Initialer Sperr-Stand
  if (typeof tabLockApply === 'function') tabLockApply();
  // BA 196: Webspace-Manifest-Loader
  if (typeof amWebspaceBootstrap === "function") {
    amWebspaceBootstrap();
  }
  if (typeof _audiologUpdWarn === "function") _audiologUpdWarn();
  // BA337: Flaggen-Modalbox — Knopf-Init + Event-Verdrahtung
  if (typeof plUpdContentLangBtn === "function") plUpdContentLangBtn();
  var _plLangBtn = document.getElementById("plContentLangBtn");
  if (_plLangBtn && typeof plOpenContentLangModal === "function") {
    _plLangBtn.addEventListener("click", function () { plOpenContentLangModal(); });
  }
  var _plLangModal = document.getElementById("plContentLangModal");
  if (_plLangModal) {
    // Klick auf Overlay-Hintergrund schliesst Modal
    _plLangModal.addEventListener("click", function (e) {
      if (e.target === _plLangModal && typeof plCloseContentLangModal === "function") {
        plCloseContentLangModal();
      }
    });
  }
  var _plLangClose = document.getElementById("plContentLangClose");
  if (_plLangClose && typeof plCloseContentLangModal === "function") {
    _plLangClose.addEventListener("click", function () { plCloseContentLangModal(); });
  }
});
