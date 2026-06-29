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
  updSideButtons();
  ELL_updFClearBtn();
  // BA389: Player-UI-Einzelupdates entfernt — der zentrale plSyncUI()
  // weiter unten (BA388, ca. Z. 273) spiegelt die Box. Dazwischen rendert
  // nichts die Player-Box (verifiziert), daher verhaltensgleich.
  buildImplantCard();
  // Sub-Tab-Beschriftungen (werden auch von applyLang-Patch aktualisiert)
  const _btnL = document.getElementById("tabElektrodenlautstaerkeBtn");
  if (_btnL) _btnL.textContent = t("tabElektrodenlautstaerke");
  const _btnF = document.getElementById("subTabFRQBtn");
  if (_btnF) _btnF.textContent = t("subTabFRQ");
  const _nd = document.getElementById("FRQ_resultsNoDataText");
  if (_nd) _nd.textContent = t("FRQ_resultsNoData");
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
    if (typeof FRQ_applyLang === "function") FRQ_applyLang();
    // Sub-Tab-Beschriftungen
    const btnL = document.getElementById("tabElektrodenlautstaerkeBtn");
    if (btnL) btnL.textContent = t("tabElektrodenlautstaerke");
    const btnF = document.getElementById("subTabFRQBtn");
    if (btnF) btnF.textContent = t("subTabFRQ");
    // FRQ_resultsNoData-Text
    const nd = document.getElementById("FRQ_resultsNoDataText");
    if (nd) nd.textContent = t("FRQ_resultsNoData");
    // Wenn Frequenzabgleich-Tab aktiv: neu rendern
    const activeSubtab = document.querySelector('.subtab[data-parent="ergebnisse"].active');
    if (activeSubtab && activeSubtab.dataset.subtab === "freqmatch") {
      FRQ_renderResults();
    }
    // Latenz-UI-Texte
    if (typeof LTZ_renderResults === "function") LTZ_renderResults();
    if (typeof LTZ_updateValueText === "function") LTZ_updateValueText();
    if (typeof LTZ_updateIntervalHint === "function") LTZ_updateIntervalHint();
    // Warp-UI-Texte
    _pWarpApplyLangTexts();
    // Druck-Knöpfe Kurven- und Schieber-Tab
    const _pkb = document.getElementById("printKurvenELLBtn");
    if (_pkb) _pkb.title = t("printBtn");
    const _psb = document.getElementById("printSchieberELLBtn");
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
    FRQ_implantatTableBuild();
    buildImplantCard();
    kurvenELLTabelleBauen();
    kurvenELLChartZeichnen();
    ELL_renderResults();
    if (typeof STB_checkData === "function") STB_checkData();
    if (typeof FRQ_applyLang === "function") FRQ_applyLang();
    if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
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
  const printKurvenELLBtn = document.getElementById("printKurvenELLBtn");
  if (printKurvenELLBtn) {
    printKurvenELLBtn.title = t("printBtn");
    printKurvenELLBtn.addEventListener("click", printKurvenELLTab);
  }
  const printSchieberELLBtn = document.getElementById("printSchieberELLBtn");
  if (printSchieberELLBtn) {
    printSchieberELLBtn.title = t("printBtn");
    printSchieberELLBtn.addEventListener("click", printSchieberELLTab);
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
  document.getElementById("fClearBtn").addEventListener("click", ELL_clearRes);
  document
    .getElementById("eeExportBtn")
    .addEventListener("click", exportEasyEffects);
  document
    .getElementById("apoExportBtn")
    .addEventListener("click", exportEqualizerAPO);
  ["kurvenELLChkMeas", "kurvenELLChkMan", "kurvenELLChkPre"].forEach((id) =>
    document.getElementById(id).addEventListener("change", kurvenELLChartZeichnen),
  );
  // Player EQ toggle — wirkt als Master-Bypass auch für Frequenz-Warping.
  // Wenn pWarpOn=true und Wiedergabe läuft, muss der Audio-Graph gewechselt
  // werden (Vocoder/Bandshift rein/raus), nicht nur EQ-Gains aktualisiert.
  document.getElementById("plEqToggle").addEventListener("click", function () {
    plEqOn = !plEqOn;
    updEqToggleBtn();
    if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
    pUpdEQ();
    if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
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
      // Gesperrt (Taub oder seitenweise Absenkung) -> Klick schlucken.
      // Button ist nur optisch grau, nicht disabled, damit der seitliche
      // Hinweis sichtbar bleibt.
      if (typeof plBalLocked !== "undefined" && plBalLocked) return;
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
      if (typeof plLatLocked !== "undefined" && plLatLocked) return;
      plApplyLatency = !plApplyLatency;
      LTZ_applyToPlayer();
      updLatApplyBtn();
    });
  // BA388: zentraler Player-UI-Sync (ersetzt die einzelnen Box-Updates;
  // weitere Aufrufstellen folgen in BA389/390).
  if (typeof plSyncUI === "function") plSyncUI();
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
    if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
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
    if (typeof plWarpLocked !== "undefined" && plWarpLocked) return;
    pWarpOn = !pWarpOn;
    pWarpUpdUI();

    // EINschalten ohne fertigen Buffer -> Berechnung (an)starten.
    // pWarpTrigger uebernimmt Play-Kopplung (Voll-Pfad: nach Fertigstellung;
    // Streaming: nach Vorlauf). Bei laufendem Play wird in pWarpTrigger
    // pausiert und nach Bereitschaft gewarpt weitergespielt.
    if (pWarpOn && !pWarpedBuf) {
      // SW (BA379): Lief Wiedergabe, soll sie GEWARPT weiterlaufen, sobald
      // berechnet -> Play-Wunsch setzen (Gate uebernimmt: kurz amber warten,
      // dann gewarpt weiter). pWarpTrigger pausiert intern; das Gate startet neu.
      const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
      if (wasPlaying && typeof _pSetPlayWish === "function") _pSetPlayWish(true);
      pWarpTrigger();
      if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
      return;
    }

    // Sonst: zeitsynchron zwischen gewarpt/ungewarpt umschalten.
    // AUSschalten bei laufender Berechnung bricht NICHT ab -- die Berechnung
    // laeuft im Hintergrund weiter; getPlaybackBuffer liefert hier ungewarpt
    // (pWarpOn === false), die Wiedergabe wechselt sofort.
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
    else if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
  });
  // BA374: Stop-Button am Fortschrittsbalken. Bricht die Berechnung ab,
  // schaltet Frequenz-Warping aus und spielt ungewarpt an gleicher
  // Position weiter.
  const _plWarpStopBtn = document.getElementById("plWarpStopBtn");
  if (_plWarpStopBtn) {
    _plWarpStopBtn.addEventListener("click", () => {
      if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
      pWarpOn = false;
      // SW (BA379): ueber Play-Wunsch statt wasPlaying allein.
      const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
      if (wasPlaying) pPause();
      pBuf = getPlaybackBuffer();   // ungewarpt (pWarpOn === false)
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
      if (wasPlaying) { if (typeof _pSetPlayWish === "function") _pSetPlayWish(true); if (typeof pPlay === "function") pPlay(); }
      if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
    });
  }

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
    if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
  });
  // BA375: Berechnungs-Modus (Schnell/Mittel/Beste). Persistent.
  // Quelle fuer engine + Streaming-Pfad. Wechsel bei aktivem Warp ->
  // Buffer verwerfen und neu berechnen (kann Play kurz unterbrechen,
  // bis die Berechnung die aktuelle Position wieder erreicht).
  document.querySelectorAll('input[name="plWarpMode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      const v = this.value;
      pWarpCalcMode = (v === "mid" || v === "best") ? v : "fast";
      if (typeof _autoSaveState === "function") _autoSaveState();
      // SW (BA379): Lief Wiedergabe ODER wartete sie (amber)? Dann Wunsch
      // halten, damit nach Neuberechnung am neuen Gate automatisch gestartet
      // wird (§4a: Moduswechsel behaelt den Play-Wunsch).
      const active = (typeof pPlaying !== "undefined" && pPlaying)
                  || (typeof pPlayWish !== "undefined" && pPlayWish);
      if (active && typeof _pSetPlayWish === "function") _pSetPlayWish(true);
      // Neu berechnen, wenn Warp aktiv ist.
      pWarpedBuf = null;
      if (pWarpOn && typeof pWarpTrigger === "function") pWarpTrigger();
    });
  });

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
    const cv = document.getElementById("schieberELLCv");
    if (!cv || document.activeElement !== cv) return;
    const nav = (typeof schieberELLNavigableEl === "function") ? schieberELLNavigableEl() : actEl();
    if (!nav.length) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      let ci = nav.indexOf(schieberELLFocus);
      if (ci < 0) ci = 0;
      if (e.key === "ArrowLeft") ci = Math.max(0, ci - 1);
      else ci = Math.min(nav.length - 1, ci + 1);
      schieberELLFocus = nav[ci];
      schieberELLDraw();
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      if (schieberELLMode === "abs") {
        schieberELLStepAbsolute(schieberELLFocus, dir, e.shiftKey);
      } else {
        const st = e.shiftKey ? 0.1 : 0.5;
        const cur = schieberELL[schieberELLFocus] || 0;
        schieberELLOnChange(schieberELLFocus, cur + dir * st);
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
      } else if (typeof d.playerSource === "string") {
        plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
        plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
        plSrcCurves = d.playerSource === "levels" || d.playerSource === "both";
      }
      if (d.eqOn !== undefined) {
        plEqOn = d.eqOn;
      }
      if (typeof plEqHeadroom !== "undefined") {
        plEqHeadroom = (typeof d.eqHeadroom === "boolean") ? d.eqHeadroom : true;
      }
      if (typeof plEqHeadroomBoth !== "undefined") {
        plEqHeadroomBoth = (typeof d.eqHeadroomBoth === "boolean") ? d.eqHeadroomBoth : true;
      }
      if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
      if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
      if (typeof d.playerShowExperimental === "boolean") plShowExperimental = d.playerShowExperimental;
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
        // BA375: Berechnungs-Modus. Keine Migration von playerWarpLive
        // (alter Wert wird ignoriert). Fehlt der Wert -> Default "fast".
        pWarpCalcMode = (d.playerWarpMode === "fast" || d.playerWarpMode === "mid" || d.playerWarpMode === "best")
          ? d.playerWarpMode : "fast";
        if (typeof _pWarpCalcModeApply === "function") _pWarpCalcModeApply();
      }
      // BA 177: wenn beim Auto-Restore schon Frequenzabgleich-Messungen
      // vorhanden sind, Default-Anwendungs-Flag setzen.
      try {
        const _hasFm =
          (Array.isArray(FRQ_resultsArray) && FRQ_resultsArray.length > 0)
          || (typeof _FRQ_hasSliderEstimates === "function" && _FRQ_hasSliderEstimates())
          || (typeof _FRQ_hasAdaptiveData === "function" && _FRQ_hasAdaptiveData());
        if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
          pMarkPlayerWarpDefaultAsApplied();
        }
      } catch (e) { /* defensiv */ }
      if (d.lrResults && typeof STB_results !== "undefined") {
        Object.assign(STB_results, d.lrResults);
        if (typeof STB_renderResults === "function") STB_renderResults();
      }
      if (typeof LTZ_result !== "undefined") {
        LTZ_result = (d && d.latencyResult) ? d.latencyResult : null;
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
      if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
      if (typeof LTZ_renderResults === "function") LTZ_renderResults();
      if (Array.isArray(d.fRes) && typeof FRQ_resultsArray !== "undefined") {
        // BA 106: KEIN Filter, dieselbe Migrations-Sequenz wie in file.js.
        FRQ_resultsArray.splice(0, FRQ_resultsArray.length, ...d.fRes);
        if (typeof _FRQ_cleanupLegacyResults === "function") _FRQ_cleanupLegacyResults();
        if (typeof _FRQ_migrateResultsFormat === "function") _FRQ_migrateResultsFormat();
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
      if (typeof toneType_stereobalance !== "undefined") {
        if (isValidToneType(d.toneType_balance)) {
          toneType_stereobalance = d.toneType_balance;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_stereobalance = d.globalToneType;
        }
      }
      // BA 287: gemeinsame Lautstaerke (Auto-Restore). Abwaertskompat:
      // alter Stand ohne volume_global -> volume_test uebernehmen.
      if (typeof volume_global !== "undefined") {
        var _vgR = parseInt(d.volume_global, 10);
        if (!(isFinite(_vgR) && _vgR >= 0 && _vgR <= 100)) _vgR = parseInt(d.volume_test, 10);
        if (isFinite(_vgR) && _vgR >= 0 && _vgR <= 100) volume_global = _vgR;
      }
      if (typeof duration_stereobalance !== "undefined" && isFinite(parseInt(d.duration_balance, 10))) duration_stereobalance = parseInt(d.duration_balance, 10);
      if (typeof pause_stereobalance    !== "undefined" && isFinite(parseInt(d.pause_balance,    10))) pause_stereobalance    = parseInt(d.pause_balance,    10);
      // BA 282: Per-Test-Tonart Elektrodenlautstaerke (Auto-Restore),
      // analog zu toneType_freqmatch/toneType_stereobalance weiter oben.
      if (typeof toneType_elektrodenlautstaerke !== "undefined") {
        if (isValidToneType(d.toneType_test)) {
          toneType_elektrodenlautstaerke = d.toneType_test;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_elektrodenlautstaerke = d.globalToneType;
        }
      }
      if (typeof duration_elektrodenlautstaerke !== "undefined" && isFinite(parseInt(d.duration_test, 10))) duration_elektrodenlautstaerke = parseInt(d.duration_test, 10);
      if (typeof pause_elektrodenlautstaerke    !== "undefined" && isFinite(parseInt(d.pause_test,    10))) pause_elektrodenlautstaerke    = parseInt(d.pause_test,    10);
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
      if (typeof sequence_elektrodenlautstaerke !== "undefined") {
        sequence_elektrodenlautstaerke = _validSeq(d.sequence_test) || _legacySeq;
      }
      if (typeof sequence_stereobalance !== "undefined") {
        sequence_stereobalance = _validSeq(d.sequence_balance) || _legacySeq;
      }
      if (typeof d.levelsTabMode === "string") schieberELLMode = d.levelsTabMode;
      if (typeof d.levelsTabVariant === "string") schieberELLVariant = d.levelsTabVariant;
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
      if (typeof STB_snapshot !== "undefined") {
        // Lese-Migration: Fallback auf Alt-Namen stereobalanceSnapshot / lrSnapshot
        STB_snapshot = (d && (d.STB_snapshot || d.stereobalanceSnapshot || d.lrSnapshot))
          ? (d.STB_snapshot || d.stereobalanceSnapshot || d.lrSnapshot) : null;
      }
      FRQ_implantatTableBuild();
      buildImplantCard();
      updSideButtons();
      if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
      if (typeof pBuildEQ === "function") pBuildEQ();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
      if (typeof FRQ_refreshResumeHint === "function") FRQ_refreshResumeHint();
      if (typeof FRQ_applyLang === "function") FRQ_applyLang();
      if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
      if (typeof STB_refreshElectrodeSelectionSummary === "function") STB_refreshElectrodeSelectionSummary();
      if (typeof FRQ_refreshElectrodeSelectionSummary === "function") FRQ_refreshElectrodeSelectionSummary();
      if (typeof ELL_refreshElectrodeSelectionSummary === "function") ELL_refreshElectrodeSelectionSummary();
      if (typeof STB_refreshToneTypeLabel === "function") STB_refreshToneTypeLabel();
      if (typeof FRQ_refreshToneTypeLabel === "function") FRQ_refreshToneTypeLabel();
      if (typeof ELL_refreshToneTypeLabel === "function") ELL_refreshToneTypeLabel();
      // BA389: Player-UI zentral spiegeln (ersetzt die ueber den Restore
      // verstreuten Einzel-Updates). Laeuft NACH dem Side-Change-Restore
      // (d.plBothSides/d.plMonoEQ) und nach pBuildEQ, damit der gespiegelte
      // Zustand aktuell ist. Kein Flag -> nichts Teures.
      if (typeof plSyncUI === "function") plSyncUI();
    }
  } catch (e) {}
  // Referenzelektroden-Dropdown im Ergebnis-Reiter
  const _refSel = document.getElementById('ELL_refEl');
  if (_refSel) {
    _refSel.addEventListener('change', function() {
      setRefEl(+this.value);
    });
  }

  // BA353: Umschalter aktives Verfahren.
  // BA363 Klavier-only: Listener auskommentiert; zum Reaktivieren entfernen.
  // const _FRQ_adaBtn = document.getElementById("FRQ_activeMethodAdaptiveBtn");
  // const _FRQ_sliBtn = document.getElementById("FRQ_activeMethodSliderBtn");
  // const _FRQ_piaBtn = document.getElementById("FRQ_activeMethodPianoBtn");
  // if (_FRQ_adaBtn) _FRQ_adaBtn.addEventListener("click", function () { FRQ_setActiveMethod("adaptive"); });
  // if (_FRQ_sliBtn) _FRQ_sliBtn.addEventListener("click", function () { FRQ_setActiveMethod("slider"); });
  // if (_FRQ_piaBtn) _FRQ_piaBtn.addEventListener("click", function () { FRQ_setActiveMethod("piano"); });

  // Modus-Toggle relativ/absolut
  document.querySelectorAll('input[name="schieberELLMode"]').forEach((r) => {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      const newMode = this.value;
      if (newMode === "abs" && !schieberELLAbsoluteAvailable()) {
        this.checked = false;
        const relBtn = document.getElementById("schieberELLModeRel");
        if (relBtn) relBtn.checked = true;
        alert(t("schieberELLAbsNotAvailable"));
        return;
      }
      schieberELLMode = newMode;
      // schieberELLVariant wird hier NICHT überschrieben — die vom Nutzer
      // gewählte Anzeige-Variante (gestapelt / nur Summe) bleibt
      // beim Modus-Wechsel erhalten.
      // Fokus für den neuen Modus revalidieren (Absolutmodus überspringt
      // Elektroden ohne MCL).
      schieberELLRebuild();
    });
  });
  // Variante-Toggle
  document.querySelectorAll('input[name="schieberELLVariant"]').forEach((r) => {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      schieberELLVariant = this.value;
      schieberELLDraw();
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
              frequencies: sideData.left.FRQ_implantat,
              electrodeFreqOwn: sideData.left.FRQ_implantatOwn,
              electrodeStatus: sideData.left.elSt,
              // BA 164
              electrodeActive: sideData.left.elActive,
              electrodeNotes: sideData.left.elNt,
              electrodeExcludedDuring: sideData.left.elExDur,
              referenceElectrode: sideData.left.ELL_refEl,
              balanceResults: sideData.left.ELL_results,
              manualLevels: sideData.left.schieberELL,
              presets: sideData.left.kurvenELL,
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
              frequencies: sideData.right.FRQ_implantat,
              electrodeFreqOwn: sideData.right.FRQ_implantatOwn,
              electrodeStatus: sideData.right.elSt,
              // BA 164
              electrodeActive: sideData.right.elActive,
              electrodeNotes: sideData.right.elNt,
              electrodeExcludedDuring: sideData.right.elExDur,
              referenceElectrode: sideData.right.ELL_refEl,
              balanceResults: sideData.right.ELL_results,
              manualLevels: sideData.right.schieberELL,
              presets: sideData.right.kurvenELL,
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
          lrResults: (typeof STB_results !== "undefined") ? STB_results : {},
          // BA 161
          stereobalanceSnapshot: (typeof STB_snapshot !== "undefined") ? STB_snapshot : null,
          latencyResult: (typeof LTZ_result !== "undefined") ? LTZ_result : null,
          plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
          plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
          plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
          fRes: (typeof FRQ_resultsArray !== "undefined") ? FRQ_resultsArray : [],
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
          playerWarpMode: (typeof pWarpCalcMode !== "undefined") ? pWarpCalcMode : "fast",
          version: (typeof APP_VERSION !== "undefined") ? APP_VERSION : "",
          userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
          userLastName:   (typeof userLastName   === "string") ? userLastName   : "",
          userFirstName:  (typeof userFirstName  === "string") ? userFirstName  : "",
          // BA 161: bisher nur in Datei-Save
          audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
          toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
            ? toneType_freqmatch : TEST_DEFAULTS.freqmatch.toneType,
          toneType_balance: (typeof toneType_stereobalance !== "undefined")
            ? toneType_stereobalance : TEST_DEFAULTS.stereobalance.toneType,
          // BA 287: gemeinsame Lautstaerke.
          volume_global: (typeof volume_global !== "undefined") ? volume_global : TEST_DEFAULTS.commonVolume,
          duration_balance: (typeof duration_stereobalance !== "undefined") ? duration_stereobalance : TEST_DEFAULTS.stereobalance.duration,
          pause_balance:    (typeof pause_stereobalance    !== "undefined") ? pause_stereobalance    : TEST_DEFAULTS.stereobalance.pause,
          // BA 282: Tonart/Dur/Pau Elektrodenlautstaerke (wie Datei-Save).
          toneType_test: (typeof toneType_elektrodenlautstaerke !== "undefined")
            ? toneType_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.toneType,
          duration_test: (typeof duration_elektrodenlautstaerke !== "undefined") ? duration_elektrodenlautstaerke : TEST_DEFAULTS.elektrodenlautstaerke.duration,
          pause_test:    (typeof pause_elektrodenlautstaerke    !== "undefined") ? pause_elektrodenlautstaerke    : TEST_DEFAULTS.elektrodenlautstaerke.pause,
          // BA 282: Dur/Pau Frequenzabgleich (wie Datei-Save; Tonart ist oben schon dabei).
          duration_freqmatch: (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : TEST_DEFAULTS.freqmatch.duration,
          pause_freqmatch:    (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : TEST_DEFAULTS.freqmatch.pause,
          sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : TEST_DEFAULTS.freqmatch.sequence,
          sequence_test:      (typeof sequence_elektrodenlautstaerke      !== "undefined") ? sequence_elektrodenlautstaerke      : TEST_DEFAULTS.elektrodenlautstaerke.sequence,
          sequence_balance:   (typeof sequence_stereobalance   !== "undefined") ? sequence_stereobalance   : TEST_DEFAULTS.stereobalance.sequence,
          levelsTabMode: schieberELLMode,
          levelsTabVariant: schieberELLVariant,
          levelsTabShowMeas: schieberELLShowMeas,
          levelsTabShowCurves: schieberELLShowCurves,
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
  if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
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
