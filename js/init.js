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
    // Druck-Knöpfe Kurven-, Schieber- und Frequenzbänder-Tab
    const _pkb = document.getElementById("printKurvenELLBtn");
    if (_pkb) _pkb.title = t("printBtn");
    const _psb = document.getElementById("printSchieberELLBtn");
    if (_psb) _psb.title = t("printBtn");
    const _pfb = document.getElementById("printFrequenzbaenderBtn");
    if (_pfb) _pfb.title = t("printBtn");
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

  // BA492: FRQ_distribution ins Dropdown spiegeln + alle Konsumenten neu zeichnen.
  // Aufrufer: Dropdown-change, Datei-Laden (file.js/init.js), Vorbelegung
  // (freq-warp.js pApplyWarpModeDefaultFromFm).
  function _frqDistributionApply() {
    var sel = document.getElementById("FRQ_distributionSelect");
    if (sel && sel.value !== FRQ_distribution) sel.value = FRQ_distribution;
    // Reiter Frequenzbaender (Glaettung + Baender) neu:
    if (typeof FRQ_renderBaenderTab === "function") FRQ_renderBaenderTab();
    if (typeof window._frqGlaettUpdate === "function") window._frqGlaettUpdate();
    // Kurven-Reiter + Player (folgen FRQ_distribution):
    if (typeof kurvenELLChartZeichnen === "function") kurvenELLChartZeichnen();
    if (typeof pBuildEQ === "function" && typeof pPlaying !== "undefined" && !pPlaying) pBuildEQ();
    if (typeof pDrawEQ === "function") pDrawEQ();
    // Warp-Buffer verwerfen, damit naechste Wiedergabe neu warpt:
    if (typeof pWarpedBuf !== "undefined") pWarpedBuf = null;
    if (typeof schieberELLUpdateWarpHint === "function") schieberELLUpdateWarpHint();
  }

  // BA492: globale Korrektur-Seite (FRQ_distribution). EINZIGE Schreibstelle
  // (Architektur §4.3). Setzt den Zustand und zeichnet alle Konsumenten neu.
  var _frqDistSel = document.getElementById("FRQ_distributionSelect");
  if (_frqDistSel) {
    _frqDistSel.addEventListener("change", function () {
      FRQ_distribution = this.value;
      _frqDistributionApply();
    });
  }

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
  const printFrequenzbaenderBtn = document.getElementById("printFrequenzbaenderBtn");
  if (printFrequenzbaenderBtn) {
    printFrequenzbaenderBtn.title = t("printBtn");
    printFrequenzbaenderBtn.addEventListener("click", printFrequenzbaenderTab);
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
    if (typeof _plHideWarpOverlapHint === "function") _plHideWarpOverlapHint();
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
  // BA375: Berechnungs-Modus (Schnell/Mittel/Beste). Persistent.
  // Quelle fuer engine + Streaming-Pfad. Wechsel bei aktivem Warp ->
  // Buffer verwerfen und neu berechnen (kann Play kurz unterbrechen,
  // bis die Berechnung die aktuelle Position wieder erreicht).
  document.querySelectorAll('input[name="plWarpMode"]').forEach(function (r) {
    r.addEventListener("change", function () {
      if (!this.checked) return;
      const v = this.value;
      pWarpCalcMode = (v === "fast" || v === "best") ? v : "mid";
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

  // BA462: Wand-Radios (Untergrenze/Obergrenze) dynamisch aus den
  // herstellerspezifischen bandGrenzen der AKTIVEN Seite aufbauen. Wert pro
  // Seite in sideData[side].bandWandLo/Hi. Einzige Bau-Stelle; aufgerufen
  // initial, bei Herstellerwechsel (switchMfr) und Seitenwechsel
  // (setActiveSide).
  function _frqBandWandBuild() {
    var side = (typeof activeSide === "string") ? activeSide : "right";
    var s = sideData[side];
    if (!s) return;
    var bg = (MFR[s.manufacturer]) ? MFR[s.manufacturer].bandGrenzen : null;
    var loFs = document.getElementById("FRQ_bandWandLoFieldset");
    var hiFs = document.getElementById("FRQ_bandWandHiFieldset");
    var loBox = document.getElementById("FRQ_bandWandLoOptions");
    var hiBox = document.getElementById("FRQ_bandWandHiOptions");
    if (!loFs || !hiFs || !loBox || !hiBox) return;
    // Kein bandGrenzen (unknown) -> beide Fieldsets ausblenden, keine Radios.
    if (!bg) {
      loFs.style.display = "none";
      hiFs.style.display = "none";
      loBox.innerHTML = "";
      hiBox.innerHTML = "";
      return;
    }
    loFs.style.display = "";
    hiFs.style.display = "";
    _frqBandWandGroup(loBox, "FRQ_bandWandLo", bg.lo, s.bandWandLo, function (v) {
      sideData[side].bandWandLo = v;
    });
    _frqBandWandGroup(hiBox, "FRQ_bandWandHi", bg.hi, s.bandWandHi, function (v) {
      sideData[side].bandWandHi = v;
    });
  }

  // BA462: eine Wand-Radio-Gruppe erzeugen (Label = "N Hz", value = Hz-Zahl).
  // box: Container-Element; groupName: input-name; werte: Hz-Array;
  // aktuell: aktuell gewählter Hz-Wert; onPick(v): schreibt den Wert.
  function _frqBandWandGroup(box, groupName, werte, aktuell, onPick) {
    box.innerHTML = "";
    for (var i = 0; i < werte.length; i++) {
      var hz = werte[i];
      var lbl = document.createElement("label");
      lbl.style.display = "block";
      var inp = document.createElement("input");
      inp.type = "radio";
      inp.name = groupName;
      inp.value = String(hz);
      if (hz === aktuell) inp.checked = true;
      (function (val) {
        inp.addEventListener("change", function () {
          if (this.checked) {
            onPick(val);
            if (typeof FRQ_renderResults === "function") FRQ_renderResults();
          }
        });
      })(hz);
      lbl.appendChild(inp);
      lbl.appendChild(document.createTextNode(" " + hz + " Hz"));
      box.appendChild(lbl);
    }
  }

  // BA445: Bandverfahren-/Topologie-Wahl -> globale Zustaende + Ansicht neu.
  // Nur die Ergebnis-Ansicht neu zeichnen (Tabelle + Graph). Audio-Konsumenten
  // ziehen die neue Kombination beim naechsten Playback automatisch
  // (FRQ_werte liest global) -- hier KEIN Player-Interna anfassen.
  function _frqBandWahlInit(groupName, setter) {
    var radios = document.querySelectorAll('input[name="' + groupName + '"]');
    for (var i = 0; i < radios.length; i++) {
      radios[i].addEventListener("change", function () {
        if (this.checked) {
          setter(this.value);
          // Die Band-Radios leben im Top-Reiter "Frequenzbaender" (seit BA474
          // dorthin umgezogen). Zustaendiger Renderer ist FRQ_renderBaenderTab,
          // NICHT FRQ_renderResults (Ergebnis-Reiter) -- sonst wird der
          // Bandgraph bei Radio-Wechsel nie neu gezeichnet (Fix 0.5.474.3).
          if (typeof FRQ_renderBaenderTab === "function") FRQ_renderBaenderTab();
        }
      });
    }
  }
  // BA448 (Sec. 14.6): das Optimierungsziel ist nur bei "optimiert"
  // wirksam -> Fieldset nur dann sichtbar (Nutzer-Beschluss 2026-07-06).
  function _frqBandZielSichtbarkeit() {
    var fs = document.getElementById("FRQ_bandZielFieldset");
    if (fs) fs.style.display = (sideData[activeSide].bandOptimieren === "optimiert") ? "" : "none";
  }
  // BA451/BA523: ABF/CBF/FBF verdraengen die klassischen Achsen. Umgestellt
  // auf show()/matt() (Muster _frqGlaettAchsenSichtbar) fuer das
  // Zwei-Zeilen-Modell (Architektur 00-bandverfahren Paragraph 4).
  // Verhaltensneutral: in dieser BA werden die Fieldsets weiterhin per show()
  // ein-/ausgeblendet wie bisher; matt() ist fuer die Folge-BAs vorbereitet
  // und hier noch nirgends aktiv genutzt (jede aktuelle Achse ist entweder
  // sichtbar oder ausgeblendet, nicht matt).
  function _frqBandAchsenSichtbarkeit() {
    var v = sideData[activeSide].bandVerfahren;
    var istAbf = (v === "abf");
    var istCbf = (v === "cbf");
    var istKlassisch = !(istAbf || istCbf);

    function show(id, on) {
      var el = document.getElementById(id);
      if (el) el.style.display = on ? "" : "none";
    }
    // matt(): ausgegraut, aber bedienbar (kein disabled). In dieser BA noch
    // ungenutzt, aber als Helfer bereitgestellt fuer die Folge-BAs.
    function matt(id, wirksam) {
      var el = document.getElementById(id);
      if (el) el.style.opacity = wirksam ? "" : "0.5";
    }

    // Zeile 2, verfahrensspezifisch (klassische Verfahren): Topologie/
    // Optimieren/Ziel nur bei geometrisch, bei abf/cbf aus.
    ["FRQ_bandTopologieFieldset", "FRQ_bandOptimierenFieldset",
     "FRQ_bandZielFieldset"].forEach(function (id) {
      show(id, istKlassisch);
    });
    // Randverhalten ist gemeinsame Achse (Zeile 1) -- immer sichtbar,
    // aber bei sABF wirkungslos (eigene Rand-Logik) -> matt.
    show("FRQ_bandRandverhaltenFieldset", true);
    matt("FRQ_bandRandverhaltenFieldset", !istAbf);

    // Zeile 2 (verfahrensspezifisch):
    show("FRQ_bandRandausgleichFieldset", istAbf);   // Randausgleich nur ABF
    ["FRQ_bandCbfGewichtFieldset", "FRQ_bandCbfApikalFreiFieldset",
     "FRQ_bandCbfBasalFreiFieldset",
     "FRQ_bandCbfSpracheFieldset"].forEach(function (id) {
      show(id, istCbf);   // CBF-Achsen nur bei CBF
    });

    // BA525: k wirkt nur im Ortsraum (Lage aussen/mitte/innen), nicht bei
    // Lage "geometrisch" -> dort matt.
    var _lage = sideData[activeSide].bandLage;
    var _ortsraum = (_lage === "aussen" || _lage === "mitte" || _lage === "innen");
    show("FRQ_bandKFieldset", true);
    matt("FRQ_bandKFieldset", _ortsraum);

    // Randverhalten "frei": keine feste Wand -> Wand-Auswahl (Unter-/
    // Obergrenze) matt (bedienbar, ohne Wirkung). Bei geometrisch zwingt
    // "frei" den optimierten Modus -> Optimieren-Achse matt.
    var _randVerh = sideData[activeSide].bandRandverhalten;
    var _istFrei = (_randVerh === "frei");
    matt("FRQ_bandWandLoFieldset", !_istFrei);
    matt("FRQ_bandWandHiFieldset", !_istFrei);
    // Optimieren-Achse (nur bei geometrisch/klassisch sichtbar, untere
    // Zeile) bei "frei" matt -- der Wert wird dann zwingend als
    // "optimiert" gerechnet (core.js _optimieren-Ableitung).
    matt("FRQ_bandOptimierenFieldset", !(istKlassisch && _istFrei));

    // Bei den klassischen Verfahren die Optimieren-abhaengige
    // Ziel-Sichtbarkeit anwenden (wie bisher).
    if (istKlassisch) {
      _frqBandZielSichtbarkeit();
    }
  }
  // BA501: Ausgangspunkt-Wahl des Bandgraphen (global, Anzeige-only).
  _frqBandWahlInit("FRQ_bandAusgang", function (v) { FRQ_bandAusgang = v; });
  // Kurvensymbol in der jeweiligen Kurvenfarbe vor jedes Ausgangspunkt-
  // Label (geglaettet=gruen, gemessen=blau, nominell=schwarz). Farbe und
  // Symbol aus den globalen Quellen (core.js / FRQ_elementSymbol) --
  // datengetrieben ueber value, keine feste Zuordnung im Markup.
  (function () {
    var _ar = document.querySelectorAll('input[name="FRQ_bandAusgang"]');
    for (var _i = 0; _i < _ar.length; _i++) {
      var _farbe = FRQ_AUSGANG_FARBE[_ar[_i].value];
      var _hex = _farbe && KURVENFARBE[_farbe];
      if (!_hex) continue;
      var _sym = document.createElement("span");
      _sym.innerHTML = FRQ_elementSymbol("kurve", [_hex]);
      _sym.style.marginRight = "2px";
      _ar[_i].insertAdjacentElement("afterend", _sym);
    }
  })();
  // BA463: Setter schreiben in die AKTIVE Seite (sideData[activeSide]).
  _frqBandWahlInit("FRQ_bandVerfahren", function (v) {
    sideData[activeSide].bandVerfahren = v;
    _frqBandAchsenSichtbarkeit();
  });
  _frqBandWahlInit("FRQ_bandTopologie", function (v) { sideData[activeSide].bandTopologie = v; });
  _frqBandWahlInit("FRQ_bandOptimieren", function (v) {
    sideData[activeSide].bandOptimieren = v;
    _frqBandZielSichtbarkeit();
  });
  _frqBandWahlInit("FRQ_bandZiel", function (v) {
    sideData[activeSide].bandZiel = v;
  });
  _frqBandWahlInit("FRQ_bandRandverhalten", function (v) {
    sideData[activeSide].bandRandverhalten = v;
    // Matt-Zustaende (Wand-Auswahl, Optimieren-Achse) haengen am
    // Randverhalten -> Sichtbarkeit sofort neu berechnen.
    _frqBandAchsenSichtbarkeit();
  });
  _frqBandWahlInit("FRQ_bandMinBreite", function (v) {
    sideData[activeSide].bandMinBreite = v;
  });
  _frqBandWahlInit("FRQ_bandRandausgleich", function (v) { sideData[activeSide].bandRandausgleich = v; });
  _frqBandWahlInit("FRQ_bandCbfGewicht", function (v) { sideData[activeSide].bandCbfGewicht = v; });
  _frqBandWahlInit("FRQ_bandCbfApikalFrei", function (v) { sideData[activeSide].bandCbfApikalFrei = v; });
  _frqBandWahlInit("FRQ_bandCbfBasalFrei",  function (v) { sideData[activeSide].bandCbfBasalFrei  = v; });
  _frqBandWahlInit("FRQ_bandCbfSprache", function (v) { sideData[activeSide].bandCbfSprache = v; });
  _frqBandWahlInit("FRQ_bandLage", function (v) {
    sideData[activeSide].bandLage = v;
    _frqBandAchsenSichtbarkeit();
  });
  // BA525: Greenwood-k-Achse (wirkt nur im Ortsraum).
  _frqBandWahlInit("FRQ_bandK", function (v) {
    sideData[activeSide].bandK = v;
  });
  // BA475: Mess-Glaettung (seitenweise). Bei Aenderung Graph + Sichtbarkeit neu.
  _frqBandWahlInit("FRQ_glaettVerfahren", function (v) {
    sideData[activeSide].bandGlaettVerfahren = v;
    _frqGlaettAchsenSichtbar();
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettGrad", function (v) {
    sideData[activeSide].bandGlaettGrad = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettFitX", function (v) {
    sideData[activeSide].bandGlaettFitX = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettAchse", function (v) {
    sideData[activeSide].bandGlaettAchse = v;
    _frqGlaettAchsenSichtbar();
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettSteife", function (v) {
    sideData[activeSide].bandGlaettSteife = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettRandfrei", function (v) {
    sideData[activeSide].bandGlaettRandfrei = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettK", function (v) {
    sideData[activeSide].bandGlaettK = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettGrundlage", function (v) {
    sideData[activeSide].bandGlaettGrundlage = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettFormel", function (v) {
    sideData[activeSide].bandGlaettFormel = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettBoden", function (v) {
    sideData[activeSide].bandGlaettBoden = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettAnker", function (v) {
    sideData[activeSide].bandGlaettAnker = v;
    _frqGlaettUpdate();
  });
  _frqBandWahlInit("FRQ_glaettLage", function (v) {
    sideData[activeSide].bandGlaettLage = v;
    _frqGlaettUpdate();
  });
  // Zeile 1 (Lage, Randausschluss[nur MED-EL], k) ist IMMER sichtbar. Zeile 2:
  // Verfahren immer; Fit/Rechenraum/Grad/Steife nur bei polynom. (BA503)
  function _frqGlaettAchsenSichtbar() {
    var s = sideData[activeSide];
    // Ortsaffin-Verfahren bei Cochlear sperren: haengt am greenwood-verteilten
    // Default-Frequenzmuster (xdef = greenwoodX(nominal)), das Cochlears
    // Default-Frequenzen NICHT bilden (.docs/Konzept_Greenwood_Glaettungs_Prior.md
    // §6f). ortskurve ist NICHT betroffen (kein xdef) und bleibt waehlbar.
    var _istCochlear = !!(s && s.manufacturer === "cochlear");
    ["ortsaffin"].forEach(function (val) {
      var r = document.querySelector('input[name="FRQ_glaettVerfahren"][value="' + val + '"]');
      if (!r) return;
      r.disabled = _istCochlear;
      if (r.parentElement) r.parentElement.style.opacity = _istCochlear ? "0.45" : "";
    });
    // Fallback: steht bei Cochlear doch ein gesperrtes Verfahren aktiv (z.B.
    // kuenftig aus geladenem Stand), auf "aus" zuruecksetzen, damit nicht ein
    // disabled-Radio weiterrechnet.
    if (_istCochlear && s
        && s.bandGlaettVerfahren === "ortsaffin") {
      s.bandGlaettVerfahren = "aus";
      var _rAus = document.querySelector('input[name="FRQ_glaettVerfahren"][value="aus"]');
      if (_rAus) _rAus.checked = true;
    }
    var v = (s && s.bandGlaettVerfahren) ? s.bandGlaettVerfahren : "aus";
    function show(id, on) {
      var el = document.getElementById(id);
      if (el) el.style.display = on ? "" : "none";
    }
    // 0.5.503.1: matt (ausgegraut, aber weiter BEDIENBAR -- kein disabled) fuer
    // Zeile-1-Achsen, die gerade nichts bewirken (Muster player.js:676:
    // opacity). Der Wert bleibt setzbar und greift, sobald er wieder wirkt.
    function matt(id, wirksam) {
      var el = document.getElementById(id);
      if (el) el.style.opacity = wirksam ? "" : "0.5";
    }
    // Randausschluss-Achse nur bei MED-EL: sie dient dem apikalen FSP-
    // Ausschluss (rate-pitch statt place-pitch, MED-EL-spezifisch). Bei AB
    // macht _frqGlaettAusschluss den Randausschluss der Ortsverfahren fix im
    // Code (E1+E16), bei Cochlear sind die Ortsaffin-Verfahren gesperrt (s.o.).
    var _istMedel = !!(s && s.manufacturer === "medel");
    var _polynom = (v === "polynom");
    var _ortsaffin = (v === "ortsaffin");
    var _aktiv = (v !== "aus");
    // Ortsraum aktiv? bei polynom haengt es an der Rechenraum-Achse, bei
    // ortsaffin ist der Ortsraum immer aktiv. Lage + k wirken NUR im Ortsraum.
    var _ortsraum = _ortsaffin || (_polynom && s && s.bandGlaettAchse === "ortsraum");

    // Zeile 1 (global, IMMER sichtbar -- auch bei "aus"; Martin 2026-07-14).
    // 0.5.503.1: ausgegraut (bedienbar) wenn gerade wirkungslos.
    show("FRQ_glaettGrundlageFieldset", true);
    matt("FRQ_glaettGrundlageFieldset", _aktiv);   // wirkt bei jeder Engine; matt nur bei "aus"
    show("FRQ_glaettFormelFieldset", true);  matt("FRQ_glaettFormelFieldset", _aktiv);
    show("FRQ_glaettBodenFieldset",  true);  matt("FRQ_glaettBodenFieldset",  _aktiv);
    show("FRQ_glaettAnkerFieldset",  true);  matt("FRQ_glaettAnkerFieldset",  _aktiv);
    show("FRQ_glaettLageFieldset",     true);
    matt("FRQ_glaettLageFieldset",     _ortsraum);          // Lage wirkt nur im Ortsraum
    show("FRQ_glaettKFieldset",        true);
    matt("FRQ_glaettKFieldset",        _ortsraum);          // k wirkt nur im Ortsraum
    show("FRQ_glaettRandfreiFieldset", _istMedel);          // nur MED-EL (rate-pitch/FSP-Grund)
    matt("FRQ_glaettRandfreiFieldset", _aktiv);             // wirkt nur wenn geglaettet wird
    // Zeile 2 (Polynom-Regler; nur bei Verfahren "polynom"):
    show("FRQ_glaettFitXFieldset",     _polynom);
    show("FRQ_glaettAchseFieldset",    _polynom);
    show("FRQ_glaettGradFieldset",     _polynom);
    show("FRQ_glaettSteifeFieldset",   _polynom);
    show("FRQ_glaettVorbereitungHinweis", false);
  }
  // BA463: alle seitenweisen Band-Radios auf die aktive Seite spiegeln.
  // Aufgerufen initial, bei Seitenwechsel (setActiveSide) und Hersteller-
  // wechsel (switchMfr). Skala bleibt global -> hier NICHT gespiegelt.
  function _frqBandSpiegle() {
    var s = sideData[activeSide];
    if (!s || typeof FRQ_BAND_WAHLEN === "undefined") return;
    FRQ_BAND_WAHLEN.forEach(function (w) {
      var val = s[w.key];
      var r = document.querySelector('input[name="' + w.group + '"][value="' + val + '"]');
      if (r) r.checked = true;
    });
    // Wand-Radios (Unter-/Obergrenze) bei JEDEM Spiegel-/Render-Pfad neu
    // aufbauen -- sonst bleiben sie verborgen, wenn der Hersteller ueber
    // einen Pfad gesetzt wird, der _frqBandWandBuild nicht separat ruft
    // (z.B. Datei-Restore). Idempotent.
    _frqBandWandBuild();
    _frqBandAchsenSichtbarkeit();
    if (typeof _frqGlaettAchsenSichtbar === "function") _frqGlaettAchsenSichtbar();
  }
  // BA462.2/463-Fix: _frqBandWandBuild und _frqBandSpiegle werden aus anderen
  // Dateien gerufen (state-side.js setActiveSide, freq-table.js switchMfr,
  // file.js Datei-Laden). Als DOMContentLoaded-Closure-lokale Funktionen sind
  // sie dort NICHT sichtbar (typeof === "undefined" -> Aufrufe still
  // uebersprungen: Seiten-/Herstellerwechsel spiegelten nie). Global
  // exponieren, wie window._pWarpApplyLangTexts (init.js:77).
  window._frqBandWandBuild = _frqBandWandBuild;
  window._frqBandSpiegle = _frqBandSpiegle;

  function _frqGlaettUpdate() {
    if (typeof FRQ_renderGlaettGraph === "function") FRQ_renderGlaettGraph();
  }
  window._frqGlaettUpdate = _frqGlaettUpdate;

  // BA480: cfg fuer die Frequenzketten-Auswahl. Anders als der Test-Dialog:
  // STUMME Elektroden sind waehlbar (§5) -> sie zaehlen zu 'testable', nichts
  // ist 'muted'/'excluded' (nichts disabled). Nur elActive===false kommt gar
  // nicht in die Liste. Auswahl-Quelle/-Ziel ist elFreqChain[activeSide].
  function _frqChainSelStatus() {
    var s = sideData[activeSide];
    var n = (s && s.nEl) ? s.nEl : 0;
    var testable = [];
    for (var i = 0; i < n; i++) {
      if (!s.elActive || s.elActive[i] !== false) testable.push(i);
    }
    // muted/excluded leer: im Frequenz-Dialog ist keine aktive El. gesperrt.
    return { testable: testable, muted: [], excluded: [] };
  }

  var _frqChainSelCfg = {
    minSelected: 1,
    getElectrodeStatus: _frqChainSelStatus,
    getSelection: function () {
      // elIdx mit elFreqChain!==false, aber nur unter den waehlbaren.
      var s = sideData[activeSide];
      var stat = _frqChainSelStatus();
      var chain = s ? s.elFreqChain : null;
      return stat.testable.filter(function (i) {
        return !chain || chain[i] !== false;
      });
    },
    setSelection: function (sel) {
      // sel = gewaehlte waehlbare elIdx. elFreqChain neu schreiben:
      // waehlbare in sel -> true, waehlbare NICHT in sel -> false.
      // Nicht-waehlbare (elActive===false) bleiben unveraendert.
      var s = sideData[activeSide];
      if (!s) return;
      if (!Array.isArray(s.elFreqChain)) {
        s.elFreqChain = new Array(s.nEl).fill(true);
      }
      var chosen = {};
      sel.forEach(function (i) { chosen[i] = true; });
      var stat = _frqChainSelStatus();
      stat.testable.forEach(function (i) {
        s.elFreqChain[i] = !!chosen[i];
      });
      // Wirkung sichtbar machen: Glaettungsgraph + Bandtabelle neu,
      // Summary aktualisieren.
      _frqChainSelUpdate();
      if (typeof _frqGlaettUpdate === "function") _frqGlaettUpdate();
      if (typeof FRQ_renderBaenderTab === "function") FRQ_renderBaenderTab();
    },
    electrodeLabel: function (i) {
      // Wie im Test-Dialog: "E3 (590 Hz)", seitenrichtig.
      var hz = withSide(activeSide, function () { return FRQ_implantatEffektiv(i); });
      return dENPrefix(activeSide) + dEN(i, activeSide) + " (" + fmtNum(hz, "hz") + " Hz)";
    }
  };

  // BA480: Zusammenfassung "{m} von {n} ..." ueber die BA478-Sub-API.
  function _frqChainSelUpdate() {
    var span = document.getElementById("FRQ_chainSelSummary");
    if (!span || typeof testUI === "undefined" || !testUI.electrodeSelection) return;
    span.textContent = testUI.electrodeSelection.summaryText(_frqChainSelCfg);
  }
  window._frqChainSelUpdate = _frqChainSelUpdate;

  var _frqChainSelBtn = document.getElementById("FRQ_chainSelBtn");
  if (_frqChainSelBtn) {
    _frqChainSelBtn.addEventListener("click", function () {
      testUI.electrodeSelection.open(_frqChainSelCfg, _frqChainSelUpdate);
    });
  }

  // BA 505: Klavier-Buttons im Frequenzbaender-Reiter.
  var _frqGlaettPianoBtn = document.getElementById("FRQ_glaettPianoBtn");
  if (_frqGlaettPianoBtn) {
    _frqGlaettPianoBtn.addEventListener("click", function () {
      if (typeof FRQ_openGlaettPiano === "function") FRQ_openGlaettPiano();
    });
  }
  var _frqBandPianoBtn = document.getElementById("FRQ_bandPianoBtn");
  if (_frqBandPianoBtn) {
    _frqBandPianoBtn.addEventListener("click", function () {
      if (typeof FRQ_openBandPiano === "function") FRQ_openBandPiano();
    });
  }

  // Anfangswerte spiegeln + Wand-Radios aufbauen.
  _frqBandSpiegle();
  _frqBandWandBuild();   // BA462: Wand-Radios initial aufbauen
  _frqGlaettUpdate();    // BA475: Glaettungs-Graph + Randausschluss-Sichtbarkeit initial
  _frqChainSelUpdate();  // BA480: Ketten-Auswahl-Summary initial setzen

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
    const sv = sessionStorage.getItem("ci-lb-v4");
    if (sv) {
      const d = JSON.parse(sv);
      if (d && d.sides) applyData(d);
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
      sessionStorage.setItem("ci-lb-v4", JSON.stringify(buildState()));
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
  // BA492: global verfuegbar machen (Aufrufer: file.js, freq-warp.js)
  window._frqDistributionApply = _frqDistributionApply;
});
