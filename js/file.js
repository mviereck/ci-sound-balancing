// ============================================================
// FILE OPERATIONS
// ============================================================

// ---------- BA 268: zentrale Dateiname-Helfer ----------
//
// Schema:
//   CImbel_<Nachname-Vorname>_<Zusatz>_<Typ?>_<Extra?>_<JJ-MM-TT_HH-MM>.<ext>
//
// Leere Blöcke werden komplett weggelassen (keine doppelten Unterstriche).
// Umlaute werden im Dateinamen transliteriert (ä->ae usw.); übrig
// bleibende Akzente per Unicode-Zerlegung entfernt.

function _fnTransliterate(s) {
  const map = {
    "ä": "ae", "ö": "oe", "ü": "ue",
    "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
    "ß": "ss"
  };
  let out = String(s || "").replace(/[äöüÄÖÜß]/g,
                                    function (ch) { return map[ch]; });
  // NFKD-Zerlegung: Akzente trennen, dann Combining-Marks entfernen.
  out = out.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return out;
}

function _fnSafeFileChars(s) {
  // Pfad-/Wildcard-/Steuerzeichen durch "_".
  return String(s || "").replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

function _fnSafeNamePart(s) {
  return _fnSafeFileChars(_fnTransliterate(String(s || "").trim()));
}

function _safeUserFileSuffix() {
  if (typeof userFileSuffix !== "string") return "";
  const s = userFileSuffix.trim();
  if (!s) return "";
  return s.replace(/[\s\/\\:*?"<>|\x00-\x1F]/g, "_");
}

function _fnBuildNameBlock() {
  const ln = _fnSafeNamePart(typeof userLastName  === "string" ? userLastName  : "");
  const fn = _fnSafeNamePart(typeof userFirstName === "string" ? userFirstName : "");
  if (ln && fn) return ln + "-" + fn;
  if (ln) return ln;
  if (fn) return fn;
  return "";
}

function _fnDateStampShort() {
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  return yy + "-" + mm + "-" + dd + "_" + hh + "-" + mi;
}

// typeTag, extraTag: jeweils optional (null/"" = weglassen).
// ext: ".json" oder ".md" inkl. Punkt.
function buildCImbelFilename(typeTag, extraTag, ext) {
  const parts = ["CImbel"];
  const nameBlock = _fnBuildNameBlock();
  if (nameBlock) parts.push(nameBlock);
  const suf = _safeUserFileSuffix();
  if (suf) parts.push(suf);
  if (typeTag)  parts.push(typeTag);
  if (extraTag) parts.push(extraTag);
  parts.push(_fnDateStampShort());
  return parts.join("_") + ext;
}

// ---------- BA 268.1: Druck-Seitentitel (kompakt für PDF-Dateinamen) ----------
//
// Format: "<Basis> Nachname Vorname Zusatz JJ-MM-TT HH-MM"
// Trenner: einfaches Leerzeichen, damit das vom Browser als PDF-Dateiname
// vorgeschlagene Ergebnis kurz und ohne Sonderzeichen bleibt. Doppelpunkt
// wird durch Bindestrich ersetzt (sonst macht der Browser daraus "_").
// Leere Blöcke fallen weg. Original-Schreibweise (Umlaute) bleibt erhalten.

function buildCImbelPrintTitle(baseTitle) {
  const parts = [String(baseTitle || "")];
  const ln = (typeof userLastName  === "string" ? userLastName  : "").trim();
  const fn = (typeof userFirstName === "string" ? userFirstName : "").trim();
  let nameBlock = "";
  if (ln && fn) nameBlock = ln + " " + fn;
  else if (ln) nameBlock = ln;
  else if (fn) nameBlock = fn;
  if (nameBlock) parts.push(nameBlock);
  const suf = (typeof userFileSuffix === "string" ? userFileSuffix : "").trim();
  if (suf) parts.push(suf);
  const now = new Date();
  const yy = String(now.getFullYear() % 100).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  parts.push(yy + "-" + mm + "-" + dd + " " + hh + "-" + mi);
  return parts.join(" ");
}

function resetAll() {
  const ch = confirm(t("resetConfirm"));
  if (!ch) return;
  // --- Mess-/Patientendaten pro Seite zurück ---
  for (const s of SIDES) {
    sideData[s].config = "unknown";
    sideData[s].manufacturer = "unknown";
    sideData[s].nEl = MFR["unknown"].n;
    sideData[s].FRQ_implantatBaenderDefault = implantDefaultBaender("unknown");
    sideData[s].FRQ_implantatBaenderOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].schieberELL = new Array(sideData[s].nEl).fill(0);
    sideData[s].ELL_refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].ELL_results = [];
    sideData[s].kurvenELL = [];
    initSideData(s, "unknown");
  }
  defaultMfr = "unknown";
  // --- Notiz an Audiologen ---
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = "";
  }
  // --- Aktive Seite + Hersteller-Dropdowns ---
  activeSide = "left";
  bindActiveSide();
  document.getElementById("ciSideSelect").value = "left";
  document.getElementById("mfrSelect").value = "unknown";
  const cfgSelR = document.getElementById("cfgSelect");
  if (cfgSelR) cfgSelR.value = "unknown";
  const dfSelR = document.getElementById("defaultMfrSelect");
  if (dfSelR) dfSelR.value = "unknown";
  // --- Globale Test-Parameter ---
  // BA 254: Tonfolge pro Test
  if (typeof sequence_freqmatch !== "undefined") sequence_freqmatch = TEST_DEFAULTS.freqmatch.sequence;
  if (typeof FRQ_activeMethodValue !== "undefined") FRQ_activeMethodValue = null;
  if (typeof sequence_elektrodenlautstaerke      !== "undefined") sequence_elektrodenlautstaerke      = TEST_DEFAULTS.elektrodenlautstaerke.sequence;
  if (typeof sequence_stereobalance   !== "undefined") sequence_stereobalance   = TEST_DEFAULTS.stereobalance.sequence;
  // BA 246
  if (typeof toneType_elektrodenlautstaerke !== "undefined") toneType_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.toneType;
  if (typeof volume_global !== "undefined") volume_global = TEST_DEFAULTS.commonVolume;
  if (typeof duration_elektrodenlautstaerke !== "undefined") duration_elektrodenlautstaerke = TEST_DEFAULTS.elektrodenlautstaerke.duration;
  if (typeof pause_elektrodenlautstaerke    !== "undefined") pause_elektrodenlautstaerke    = TEST_DEFAULTS.elektrodenlautstaerke.pause;
  if (typeof toneType_stereobalance !== "undefined") toneType_stereobalance = TEST_DEFAULTS.stereobalance.toneType;
  if (typeof duration_stereobalance !== "undefined") duration_stereobalance = TEST_DEFAULTS.stereobalance.duration;
  if (typeof pause_stereobalance    !== "undefined") pause_stereobalance    = TEST_DEFAULTS.stereobalance.pause;
  if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = TEST_DEFAULTS.freqmatch.toneType;
  if (typeof duration_freqmatch !== "undefined") duration_freqmatch = TEST_DEFAULTS.freqmatch.duration;
  if (typeof pause_freqmatch    !== "undefined") pause_freqmatch    = TEST_DEFAULTS.freqmatch.pause;
  if (typeof toneType_implant !== "undefined") toneType_implant = TEST_DEFAULTS.implant.toneType;
  if (typeof duration_implant !== "undefined") duration_implant = TEST_DEFAULTS.implant.duration;
  if (typeof pause_implant    !== "undefined") pause_implant    = TEST_DEFAULTS.implant.pause;
  // --- Latenz ---
  if (typeof LTZ_result !== "undefined") LTZ_result = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof LTZ_applyToPlayer === "function") LTZ_applyToPlayer();
  if (typeof LTZ_renderResults === "function") LTZ_renderResults();
  if (typeof LTZ_sliderInput === "function") LTZ_sliderInput(0);
  // --- LR-Balance ---
  if (typeof STB_results !== "undefined") {
    Object.keys(STB_results).forEach(k => delete STB_results[k]);
    if (typeof STB_resetSequence === "function") STB_resetSequence();
    if (typeof STB_snapshot !== "undefined") STB_snapshot = null;
    if (typeof STB_renderResults === "function") STB_renderResults();
    if (typeof STB_renderMean === "function") STB_renderMean();
  }
  if (typeof plApplyBalance !== "undefined") plApplyBalance = true;
  if (typeof plBalanceMode !== "undefined") plBalanceMode = "sym";
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  // --- Frequenzabgleich-Ergebnisse ---
  if (typeof FRQ_resultsArray !== "undefined") FRQ_resultsArray.splice(0, FRQ_resultsArray.length);
  if (typeof freqmatchTestSelection !== "undefined") freqmatchTestSelection = null;
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
  // BA 161: FreqMatch-Tab-UI nach Reset auffrischen
  if (typeof FRQ_refreshResumeHint === "function") FRQ_refreshResumeHint();
  if (typeof _FRQ_refreshTabState === "function") _FRQ_refreshTabState();
  if (typeof FRQ_applyLang === "function") FRQ_applyLang();
  // --- Player-Quellen-Knöpfe ---
  if (typeof plSrcMeas !== "undefined") {
    plSrcMeas = true; plSrcLevels = true; plSrcCurves = true;
  }
  if (typeof updPlSrcButtons === "function") updPlSrcButtons();
  // --- Player „beide Seiten" + Mono-EQ ---
  const _plBoth = document.getElementById("plBothSides");
  if (_plBoth) _plBoth.checked = false;
  const _plMono = document.getElementById("plMonoEQ");
  if (_plMono) _plMono.checked = false;
  if (typeof plUpdMonoBox === "function") plUpdMonoBox();
  // --- EQ-Knopf + Stärke ---
  if (typeof plEqOn !== "undefined") plEqOn = false;
  if (typeof updEqToggleBtn === "function") updEqToggleBtn();
  if (typeof plEqHeadroom !== "undefined") plEqHeadroom = true;
  if (typeof plEqHeadroomBoth !== "undefined") plEqHeadroomBoth = true;
  if (typeof plUpdHeadroomBox === "function") plUpdHeadroomBox();
  // --- Warp-Block ---
  if (typeof pWarpOn !== "undefined") {
    pWarpOn = false;
    FRQ_distribution = "right";
    if (typeof _pPlayerWarpDefaultApplied !== "undefined") {
      _pPlayerWarpDefaultApplied = false;
    }
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  // BA463: seitenweise Band-Wahlen werden durch initSideData/switchMfr
  // zurueckgesetzt (im switchMfr-Pfad, der beim Neu-Laden gerufen wird).
  // Kein globaler Reset mehr noetig.
  // --- MAPLAW-Knopf ---
  if (typeof pMaplawOn !== "undefined") pMaplawOn = false;
  if (typeof pMaplawSollC !== "undefined") pMaplawSollC = 1000;
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  // --- Player-Experimental ---
  if (typeof plShowExperimental !== "undefined") plShowExperimental = false;
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  // BA323: Player-Box ist zustandslos — keine Reset-Zuweisungen mehr nötig.
  // --- Sprecher-Auswahl im Player ---
  const _spk = document.getElementById("plSentSpeaker");
  if (_spk) _spk.value = "";
  // --- Schieber-Tab-Modus und -Variante ---
  if (typeof schieberELLMode !== "undefined") schieberELLMode = "rel";
  if (typeof schieberELLVariant !== "undefined") schieberELLVariant = "stack";
  if (typeof schieberELLShowMeas !== "undefined") schieberELLShowMeas = false;
  if (typeof schieberELLShowCurves !== "undefined") schieberELLShowCurves = false;
  const _lvModeRel = document.getElementById("schieberELLModeRel");
  if (_lvModeRel) _lvModeRel.checked = true;
  const _lvVarStack = document.getElementById("schieberELLVarStack");
  if (_lvVarStack) _lvVarStack.checked = true;
  const _lvChkMeas = document.getElementById("schieberELLChkMeas");
  if (_lvChkMeas) _lvChkMeas.checked = false;
  const _lvChkCurves = document.getElementById("schieberELLChkCurves");
  if (_lvChkCurves) _lvChkCurves.checked = false;
  if (typeof schieberELLUpdateModeAvailability === "function") schieberELLUpdateModeAvailability();
  // --- „Schieber für beide Seiten gleich"-Checkbox ---
  const _prBoth = document.getElementById("kurvenELLBothSides");
  if (_prBoth) _prBoth.checked = true;
  // --- UI-Refresh ---
  FRQ_implantatTableBuild();
  kurvenELLTabelleBauen();
  kurvenELLChartZeichnen();
  ELL_renderResults();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (typeof schieberELLRebuild === "function") schieberELLRebuild();
  if (typeof updSideButtons === "function") updSideButtons();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 161: Direkt persistieren, damit ein F5 sofort danach NICHT
  // den alten Stand zurückbringt. Nicht auf den 5-s-Tick warten.
  if (typeof window._autoSaveState === "function") window._autoSaveState();
  alert(t("resetDone"));
}

async function saveJson() {
  const d = buildState();
  const blob = new Blob([JSON.stringify(d, null, 2)], {
    type: "application/json",
  });
  const fn = buildCImbelFilename(null, null, ".cimbel");
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({
        suggestedName: fn,
        types: [
          {
            description: "CImbel",
            accept: { "application/json": [".cimbel"] },
          },
        ],
      });
      const w = await h.createWritable();
      await w.write(blob);
      await w.close();
      return;
    } catch (e) {
      if (e.name === "AbortError") return;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fn;
  a.click();
}


// BA 352: Erkennt einen gueltigen CImbel-Speicherstand. Neue Dateien
// tragen das Kennzeichen app:"CImbel"; bestehende .json-Staende haben
// (noch) keins, werden aber am Zweiseiten-Block erkannt.
function _isCimbelSave(d) {
  if (!d || typeof d !== "object") return false;
  if (d.app === "CImbel") return true;
  if (d.sides && d.sides.left && d.sides.right) return true;
  return false;
}

// BA 352: grobe Heuristik fuer EasyEffects-Konfigurationsdateien
// (oberste Ebene output/input als Objekt, keine CImbel-Merkmale).
function _looksLikeEasyEffects(d) {
  if (!d || typeof d !== "object") return false;
  return (
    (d.output && typeof d.output === "object") ||
    (d.input && typeof d.input === "object")
  );
}

// Grundlagen-Bruch bei 0.6: ab dieser Version wird mit anderen
// Messfrequenzen gemessen, alte Messdaten sind unverwertbar und lassen
// sich nicht migrieren. Die 0.5.x-Altversion (v0.5-Backup) und die
// 0.6+-Version lehnen einander Speicherstaende ab: jede laedt nur, was
// auf ihrer Seite der 0.6-Grenze liegt.
const CIMBEL_BREAK_MINOR = 6; // Major.Minor-Bruchstelle (0.6)

// Major.Minor eines version-Strings ("0.5.534-beta") als Zahl in
// Zehntel-Aufloesung: 0.5 -> 5, 0.6 -> 6, 1.0 -> 10. null, wenn nicht
// bestimmbar (fehlendes/kaputtes Feld) -> Aufrufer behandelt als "alt".
function _cimbelVersionMinor(ver) {
  if (typeof ver !== "string") return null;
  const m = ver.match(/^(\d+)\.(\d+)/);
  if (!m) return null;
  return parseInt(m[1], 10) * 10 + parseInt(m[2], 10);
}

// true, wenn die geladene Datei d wegen des 0.6-Grundlagen-Bruchs
// inkompatibel zur laufenden Version ist. Feste Grenze 0.6, in beide
// Richtungen: 0.5-Version lehnt >=0.6 ab, 0.6-Version lehnt <0.6 ab.
// Fehlt d.version (sehr alte Datei), gilt sie als <0.6 (Variante a).
function _cimbelVersionIncompatible(d) {
  const own = _cimbelVersionMinor(APP_VERSION);
  if (own === null) return false; // eigene Version unlesbar -> nicht sperren
  const file = _cimbelVersionMinor(d && d.version);
  const fileMinor = file === null ? CIMBEL_BREAK_MINOR - 1 : file; // fehlend = alt
  const ownPre = own < CIMBEL_BREAK_MINOR;
  const filePre = fileMinor < CIMBEL_BREAK_MINOR;
  return ownPre !== filePre; // verschiedene Seiten der Grenze -> inkompatibel
}

function loadJson(file) {
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const d = JSON.parse(e.target.result);

      if (_isCimbelSave(d) && _cimbelVersionIncompatible(d)) {
        // Grundlagen-Bruch bei 0.6 (andere Messfrequenzen): Datei der
        // jeweils anderen Aera laesst sich nicht sinnvoll laden.
        alert(t("loadVersionIncompatible"));
        document.getElementById("fInput").value = "";
      } else if (_isCimbelSave(d)) {
        applyData(d);
      } else {
        // BA 352: keine gueltige CImbel-Datei -> abweisen, nicht laden.
        let msg = t("loadNotCimbel");
        if (_looksLikeEasyEffects(d)) {
          msg += " " + t("loadEasyeffectsHint");
        }
        alert(msg);
        document.getElementById("fInput").value = "";
      }
    } catch (err) {
      console.error("Fehler:", err);
      alert("Fehler beim Laden: " + err.message);
    }
  };
  r.readAsText(file);
}

function ELL_clearRes() {
  const ch = confirm(t("delConfirmMeas"));
  if (!ch) return;
  sideData[activeSide].ELL_results.splice(0, sideData[activeSide].ELL_results.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  ELL_results = sideData[activeSide].ELL_results;
  fullSweepRound = null;
  fullSweepDonePairs = [];
  ELL_renderResults();
  pUpdEQ();
}

// Sammelt die format-unabhaengige Korrektur fuer die System-Equalizer-
// Exporte (EasyEffects, Equalizer APO). Liest ausschliesslich aus den
// zentralen Funktionen (getPlayerCorrection, getPlayerLTZMs) — spiegelt
// damit exakt den Player (inkl. EQ-Schalter-Gate und nhSim).
//   bands[i] = { freq, q, gainL, gainR }   (gainL===gainR wenn nicht split)
//   splitChannels: true  -> echte Stereo-Kurven (Modus "both"/"mono")
//   hasLat/LTZ_ms:  Latenz (ms>=0 verzoegert links, ms<0 rechts)
//   hasBal/balL/balR: Stereo-Balance dB-Pegel pro Ohr in allen Side-Modi
//                     (Balance pro Ohr, spiegelt den Player)
//   anyData: false -> nichts zu exportieren
function collectSysEqCorrection() {
  const mode = getPlayerSide();

  // BA 314: Werte ausschliesslich aus der zentralen Quelle
  // (getPlayerCorrection, player.js). eq[] ist fertig: EQ-Schalter-Gate
  // + nhSim-Spiegelung, natuerliche Konvention (= was der Player-Filter
  // setzt). balance = flacher dB-Pegel pro Ohr. So spiegelt der Export
  // exakt den Player (inkl. nhSim), ohne eigene Rechnung.
  let leftArr, rightArr, splitChannels, balL, balR;
  if (mode === "both" || mode === "mono") {
    const corrL = getPlayerCorrection("left");
    const corrR = getPlayerCorrection("right");
    leftArr = corrL.eq;
    rightArr = corrR.eq;
    balL = corrL.balance;
    balR = corrR.balance;
    splitChannels = true;
  } else {
    const corr = getPlayerCorrection(mode);   // mode === "left" oder "right"
    leftArr = corr.eq;
    rightArr = corr.eq;
    balL = (mode === "left")  ? corr.balance : 0;
    balR = (mode === "right") ? corr.balance : 0;
    splitChannels = false;
  }

  // Stereo->Mono-Mischung wie im Player (unveraendert; NICHT am
  // EQ-Schalter, da der Mono-Downmix ueber den Buffer laeuft).
  // "left"/"right": Monosumme auf das aktive Ohr, Gegenseite stumm.
  // "mono":         Monosumme auf beide Ohren (EQ bleibt pro Ohr getrennt).
  const monoSum = (mode === "left" || mode === "right" || mode === "mono");
  const muteCh = mode === "left" ? "R" : mode === "right" ? "L" : null;

  const LTZ_ms = (typeof getPlayerLTZMs === "function")
    ? getPlayerLTZMs() : 0;
  const hasLat = LTZ_ms !== 0;
  const hasBal = balL !== 0 || balR !== 0;

  const hasGain = (arr) => arr.some((v) => v !== 0);
  const anyData =
    hasGain(leftArr) || hasGain(rightArr) || plEqOn || hasLat || hasBal
    || monoSum;

  const bands = [];
  for (let i = 0; i < nEl; i++) {
    bands.push({
      freq: FRQ_implantatEffektiv(i),
      q: pCompQ(i),
      gainL: leftArr[i] || 0,
      gainR: rightArr[i] || 0,
    });
  }

  return {
    bands,
    splitChannels,
    monoSum,
    muteCh,
    hasLat,
    LTZ_ms,
    hasBal,
    balL,
    balR,
    anyData,
  };
}

function exportEasyEffects() {
  const corr = collectSysEqCorrection();
  if (!corr.anyData) {
    alert(t("plNoData"));
    return;
  }
  const makeBand = (freq, gainVal, q) => ({
    frequency: freq,
    gain: parseFloat(gainVal.toFixed(1)),
    mode: "APO (DR)",
    mute: false,
    q: parseFloat(q.toFixed(2)),
    slope: "x1",
    solo: false,
    type: "Bell",
    width: 4.0,
  });
  const left = {},
    right = {};
  corr.bands.forEach((b, i) => {
    left["band" + i] = makeBand(b.freq, b.gainL, b.q);
    right["band" + i] = makeBand(b.freq, b.gainR, b.q);
  });
  const preset = {
    output: {
      blocklist: [],
      "equalizer#0": {
        balance: 0.0,
        bypass: false,
        "input-gain": 0.0,
        left: left,
        "output-gain": 0.0,
        right: right,
        "split-channels": corr.splitChannels,
        "num-bands": corr.bands.length,
      },
    },
  };
  // BA 307: Stereo->Mono-Mischung als stereo_tools VOR dem Equalizer.
  // "LR > L+R (Mono Sum L+R)" mittelt zu (L+R)/2 (Nutzer-getestet, kein
  // Gain-Ausgleich noetig). Bei Einseiten-Modus die Gegenseite stummschalten.
  if (corr.monoSum) {
    preset.output["stereo_tools#0"] = {
      "balance-in": 0.0,
      "balance-out": 0.0,
      bypass: false,
      delay: 0.0,
      "input-gain": 0.0,
      "middle-level": 0.0,
      "middle-panorama": 0.0,
      mode: "LR > L+R (Mono Sum L+R)",
      mutel: corr.muteCh === "L",
      muter: corr.muteCh === "R",
      "output-gain": 0.0,
      phasel: false,
      phaser: false,
      "sc-level": 1.0,
      "side-balance": 0.0,
      "side-level": 0.0,
      softclip: false,
      "stereo-base": 0.0,
      "stereo-phase": 0.0,
    };
  }
  if (corr.hasLat || corr.hasBal) {
    const ms = corr.hasLat ? corr.LTZ_ms : 0;
    const tL = ms >= 0 ? Math.abs(ms) : 0;
    const tR = ms < 0 ? Math.abs(ms) : 0;
    preset.output["delay#0"] = {
      bypass: false,
      "dry-l": -100.0,
      "dry-r": -100.0,
      "input-gain": 0.0,
      "invert-phase-l": false,
      "invert-phase-r": false,
      "output-gain": 0.0,
      "time-l": parseFloat(tL.toFixed(1)),
      "time-r": parseFloat(tR.toFixed(1)),
      "wet-l": parseFloat(corr.balL.toFixed(1)),
      "wet-r": parseFloat(corr.balR.toFixed(1)),
    };
  }
  // BA 307: Reihenfolge zentral. Mono-Mischung zuerst, dann EQ, dann
  // Verzoegerung/Balance.
  const order = [];
  if (corr.monoSum) order.push("stereo_tools#0");
  order.push("equalizer#0");
  if (corr.hasLat || corr.hasBal) order.push("delay#0");
  preset.output.plugins_order = order;
  const blob = new Blob([JSON.stringify(preset, null, 4)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = buildCImbelFilename("easyeffects", null, ".json");
  a.click();
}

// Equalizer APO (Windows): Textformat config.txt. PK-Filter (= Bell),
// Channel-gebundene Delay/Preamp-Zeilen. Reihenfolge egal (alles linear),
// daher: EQ, dann Balance (Preamp pro Kanal), dann Latenz (Delay).
function exportEqualizerAPO() {
  const corr = collectSysEqCorrection();
  if (!corr.anyData) {
    alert(t("plNoData"));
    return;
  }
  const fname = buildCImbelFilename("equalizerapo", null, ".txt");
  const fc = (n) => n.toFixed(1);
  const g = (n) => n.toFixed(1);
  const q = (n) => n.toFixed(2);

  const L = [];
  L.push("# CImbel");
  L.push("# " + t("apoFileHint"));
  L.push("#   Include: " + fname);
  L.push("");

  // BA 307: Stereo->Mono-Mischung VOR den Filtern (analog Player und
  // EasyEffects stereo_tools). Alle Zuweisungen in EINER Copy-Zeile
  // (parallele Auswertung in Equalizer APO). 0.5/0.5 = (L+R)/2.
  if (corr.monoSum) {
    L.push("# " + t("apoMonoHint"));
    if (corr.muteCh === "R") {
      L.push("Copy: L=0.5*L+0.5*R R=0");
    } else if (corr.muteCh === "L") {
      L.push("Copy: R=0.5*L+0.5*R L=0");
    } else {
      L.push("Copy: L=0.5*L+0.5*R R=0.5*L+0.5*R");
    }
    L.push("");
  }

  const eqLines = (side, ch) => {
    L.push("Channel: " + ch);
    corr.bands.forEach((b, i) => {
      const gain = side === "R" ? b.gainR : b.gainL;
      L.push(
        "Filter " + (i + 1) + ": ON PK Fc " + fc(b.freq) +
        " Hz Gain " + g(gain) + " dB Q " + q(b.q),
      );
    });
  };

  if (corr.splitChannels) {
    eqLines("L", "L");
    eqLines("R", "R");
  } else {
    // Mono / eine Seite: gleiche Kurve auf beide Ausgangskanaele.
    eqLines("L", "L R");
  }

  // Stereo-Balance (nur Modus "both" -> splitChannels): Pegel pro Ohr
  // als kanalweiser Preamp. Werte direkt uebernommen (analog EasyEffects
  // wet-l/wet-r), damit der PC dieselbe Korrektur wie der Player macht.
  if (corr.hasBal) {
    L.push("");
    L.push("Channel: L");
    L.push("Preamp: " + g(corr.balL) + " dB");
    L.push("Channel: R");
    L.push("Preamp: " + g(corr.balR) + " dB");
  }

  // Latenz: ms>=0 verzoegert links, ms<0 rechts (analog Player/EasyEffects).
  if (corr.hasLat) {
    L.push("");
    if (corr.LTZ_ms >= 0) {
      L.push("Channel: L");
    } else {
      L.push("Channel: R");
    }
    L.push("Delay: " + Math.abs(corr.LTZ_ms).toFixed(1) + " ms");
  }

  const blob = new Blob([L.join("\n") + "\n"], { type: "text/plain" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = fname;
  a.click();
}

