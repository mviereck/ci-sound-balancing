# BAUANLEITUNG 161 — Reset und Auto-Save vervollständigen

**Zieldateien:** `js/version.js`, `js/file.js`, `js/init.js`

**Voraussetzung:** Stand `js/version.js` = `3.1.160-beta`.

**Version:** 3.1.160-beta → **3.1.161-beta**

---

## Kontext

Drei zusammenhängende Lücken werden hier geschlossen:

1. **`resetAll()` in `js/file.js`** setzt nur einen Teil der Tool-
   Einstellungen zurück. Schieber-Tab-Modus, Warp-Knopf, MAPLAW-
   Knopf, EQ-Knopf, Sprecher-Auswahl, Player-Quellen-Knöpfe u. a.
   bleiben auf alten Werten. Konzeptbeschluß: „Wirklich alles auf
   Ausgangszustand". Der aktive Reiter bleibt stehen.

2. **Auto-Save in `localStorage('ci-lb-v4')`** in `js/init.js`
   speichert mehrere Felder **nicht**, die das Datei-Format speichert:
   `audiologUserNote`, `lrSnapshot`, `fmMode`/`fmAdaptiveDur`/
   `fmAdaptivePau` pro Seite. Folge: nach F5 sind diese Felder
   weg, obwohl sie in einer geladenen JSON-Datei stehen würden.

3. **Inkonsistente Warp-Feldnamen** zwischen Datei-Save und Auto-Save:
   Datei verwendet `warpOn/warpMode/warpStrength/warpMethod`,
   Auto-Save dagegen `pWarpOn/pWarpMode/pWarpStrength/pWarpMethod`.
   Wird vereinheitlicht auf die kurzen Namen (wie in der Datei).

4. **Sofort-Persistierung nach `resetAll()`**. Aktuell wartet
   `resetAll()` auf den nächsten 5-Sekunden-Tick. Ein F5 direkt nach
   Reset lädt den alten Stand zurück. Die Anleitung führt eine
   gemeinsame Funktion `_autoSaveState()` ein und ruft sie nach dem
   Reset auf.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.1.161-beta";
```

---

## Schritt 2 — Auto-Save-Funktion in `js/init.js` ausgliedern

Aktuell steht der Auto-Save-Block direkt in einem `setInterval`-
Callback (ab Z. 776). Wir ziehen den Inhalt in eine eigene Funktion
`_autoSaveState()`, damit `resetAll()` sie ebenfalls aufrufen kann.

**Vorher (`js/init.js` ab Z. 776):**
```js
  setInterval(() => {
    try {
      localStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({
          sides: {
            left: {
              ...
            },
            ...
          },
          ...
        }),
      );
    } catch (e) {}
  }, 5000);
```

**Nachher:**
```js
  function _autoSaveState() {
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
              // BA 161: bisher nur in Datei-Save, jetzt auch hier
              fmMode:         sideData.left.fmMode || 'adaptive',
              fmAdaptiveDur:  sideData.left.fmAdaptiveDur != null ? sideData.left.fmAdaptiveDur : 200,
              fmAdaptivePau:  sideData.left.fmAdaptivePau != null ? sideData.left.fmAdaptivePau : 200,
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
              // BA 161
              fmMode:         sideData.right.fmMode || 'adaptive',
              fmAdaptiveDur:  sideData.right.fmAdaptiveDur != null ? sideData.right.fmAdaptiveDur : 200,
              fmAdaptivePau:  sideData.right.fmAdaptivePau != null ? sideData.right.fmAdaptivePau : 200,
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
          eqStrength: parseInt(document.getElementById("plStr").value),
          plMaplawOn: (typeof pMaplawOn !== "undefined") ? pMaplawOn : false,
          plMaplawSollC: (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : 1000,
          playerShowExperimental: (typeof plShowExperimental !== "undefined") ? plShowExperimental : false,
          // BA 161: Warp-Feldnamen vereinheitlicht (gleicher Schlüssel wie in Datei-Save)
          warpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,
          warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "sinmodel",
          warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "var_side",
          warpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
          userFileSuffix: (typeof userFileSuffix === "string") ? userFileSuffix : "",
          // BA 161: bisher nur in Datei-Save
          audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
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
  }
  setInterval(_autoSaveState, 5000);
  // BA 161: global verfügbar machen, damit resetAll() sofort speichern kann
  window._autoSaveState = _autoSaveState;
```

Wichtig: `_autoSaveState` ist innerhalb des `DOMContentLoaded`-
Handlers definiert, also nicht global sichtbar. Die Zeile
`window._autoSaveState = _autoSaveState;` macht sie für andere
Module verfügbar.

---

## Schritt 3 — Lade-Routine in `js/init.js` für die neuen Felder

Direkt im bestehenden `Load from localStorage`-Block (ab Z. 608),
nach dem `if (typeof d.plBothSides === "boolean")`-Block, vor
`buildFreqTable();` einfügen:

```js
      // BA 161: bisher nur in Datei-Load
      if (typeof audiologUserNote !== "undefined") {
        audiologUserNote = (typeof d.audiologUserNote === "string") ? d.audiologUserNote : "";
        const aNoteEl = document.getElementById("audiologNoteInput");
        if (aNoteEl) aNoteEl.value = audiologUserNote;
      }
      if (typeof lrSnapshot !== "undefined") {
        lrSnapshot = (d && d.lrSnapshot) ? d.lrSnapshot : null;
      }
```

**Schritt 3b)** Den bestehenden Warp-Lade-Block (ab Z. 656) auf die
neuen Schlüssel umstellen und alte Schlüssel als Fallback akzeptieren:

**Vorher:**
```js
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
```

**Nachher:**
```js
      // BA 161: Warp-Zustand wiederherstellen — neue Schlüsselnamen,
      // Fallback auf alte (pWarpOn etc.) für bestehende localStorage-Stände
      if (typeof pWarpOn !== "undefined") {
        const _wOn       = (typeof d.warpOn       === "boolean") ? d.warpOn
                         : (typeof d.pWarpOn      === "boolean") ? d.pWarpOn      : undefined;
        const _wMethod   = (typeof d.warpMethod   === "string")  ? d.warpMethod
                         : (typeof d.pWarpMethod  === "string")  ? d.pWarpMethod  : undefined;
        const _wMode     = (typeof d.warpMode     === "string")  ? d.warpMode
                         : (typeof d.pWarpMode    === "string")  ? d.pWarpMode    : undefined;
        const _wStrength = (typeof d.warpStrength === "number")  ? d.warpStrength
                         : (typeof d.pWarpStrength === "number") ? d.pWarpStrength : undefined;
        if (typeof _wOn === "boolean") pWarpOn = _wOn;
        if (typeof _wMethod === "string") {
          pWarpMethod = _wMethod;
          const sel = document.getElementById("plWarpMethod");
          if (sel) sel.value = pWarpMethod;
        }
        if (typeof _wMode === "string") {
          pWarpMode = _wMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
        if (typeof _wStrength === "number") {
          pWarpStrength = _wStrength;
          const ws = document.getElementById("plWarpStr");
          if (ws) ws.value = pWarpStrength;
        }
        if (typeof pWarpUpdUI === "function") pWarpUpdUI();
      }
```

---

## Schritt 4 — `resetAll()` in `js/file.js` vervollständigen

Die bestehende Funktion (Z. 20-82) wird ersetzt. Aktiver Reiter
bleibt stehen, aber **alle** Einstellungen werden auf Default
zurückgesetzt.

**Vorher (`js/file.js` Z. 20-82):**
```js
function resetAll() {
  const ch = confirm(t("resetConfirm"));
  if (!ch) return;
  // Reset both sides completely
  for (const s of SIDES) {
    sideData[s].config = "unknown";
    sideData[s].manufacturer = "unknown";
    sideData[s].nEl = MFR["unknown"].n;
    sideData[s].freqs = [...MFR["unknown"].freqs];
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].elFreqOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].manualLevels = new Array(sideData[s].nEl).fill(0);
    sideData[s].refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].jRes = [];
    sideData[s].bRes = [];
    sideData[s].presets = [];
    initSideData(s, "unknown");
  }
  defaultMfr = "unknown";
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = "";
  }
  activeSide = "left";
  bindActiveSide();
  document.getElementById("ciSideSelect").value = "left";
  document.getElementById("mfrSelect").value = "unknown";
  const cfgSelR = document.getElementById("cfgSelect");
  if (cfgSelR) cfgSelR.value = "unknown";
  const dfSelR = document.getElementById("defaultMfrSelect");
  if (dfSelR) dfSelR.value = "unknown";
  document.getElementById("vol1").value = "50";
  document.getElementById("dur1").value = "1000";
  document.getElementById("pau1").value = "500";
  globalSequence = "aba";
  slTarget_test = "balance";
  slTarget_balance = "both";
  if (typeof latencyResult !== "undefined") latencyResult = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  if (typeof latSliderInput === "function") latSliderInput(0);
  if (typeof lrResults !== "undefined") {
    Object.keys(lrResults).forEach(k => delete lrResults[k]);
    if (typeof lrUndoStack !== "undefined") lrUndoStack.splice(0, lrUndoStack.length);
    if (typeof lrSnapshot !== "undefined") lrSnapshot = null;
    if (typeof lrRenderResults === "function") lrRenderResults();
    if (typeof lrApplyMeanToBalance === "function") lrApplyMeanToBalance();
  }
  if (typeof fRes !== "undefined") fRes.splice(0, fRes.length);
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
  buildFreqTable();
  buildPrTbl();
  drawLvChart();
  renderResults();
  if (typeof buildImplantCard === "function") buildImplantCard();
  alert(t("resetDone"));
  if (typeof depLockApply === 'function') depLockApply();
}
```

**Nachher:**
```js
function resetAll() {
  const ch = confirm(t("resetConfirm"));
  if (!ch) return;
  // --- Mess-/Patientendaten pro Seite zurück ---
  for (const s of SIDES) {
    sideData[s].config = "unknown";
    sideData[s].manufacturer = "unknown";
    sideData[s].nEl = MFR["unknown"].n;
    sideData[s].freqs = [...MFR["unknown"].freqs];
    sideData[s].elSt = new Array(sideData[s].nEl).fill(null);
    sideData[s].elNt = new Array(sideData[s].nEl).fill("");
    sideData[s].elExDur = new Array(sideData[s].nEl).fill(null);
    sideData[s].elFreqOwn = new Array(sideData[s].nEl).fill(null);
    sideData[s].manualLevels = new Array(sideData[s].nEl).fill(0);
    sideData[s].refEl = Math.floor(sideData[s].nEl / 2);
    sideData[s].jRes = [];
    sideData[s].bRes = [];
    sideData[s].presets = [];
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
  document.getElementById("vol1").value = "50";
  document.getElementById("dur1").value = "1000";
  document.getElementById("pau1").value = "500";
  globalSequence = "aba";
  slTarget_test = "balance";
  slTarget_balance = "both";
  if (typeof globalToneType !== "undefined") globalToneType = "complex";
  if (typeof syncAllGlobalDropdowns === "function") syncAllGlobalDropdowns();
  // --- Latenz ---
  if (typeof latencyResult !== "undefined") latencyResult = null;
  if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
  if (typeof latSliderInput === "function") latSliderInput(0);
  // --- LR-Balance ---
  if (typeof lrResults !== "undefined") {
    Object.keys(lrResults).forEach(k => delete lrResults[k]);
    if (typeof lrUndoStack !== "undefined") lrUndoStack.splice(0, lrUndoStack.length);
    if (typeof lrSnapshot !== "undefined") lrSnapshot = null;
    if (typeof lrRenderResults === "function") lrRenderResults();
    if (typeof lrApplyMeanToBalance === "function") lrApplyMeanToBalance();
  }
  if (typeof plApplyBalance !== "undefined") plApplyBalance = true;
  if (typeof plBalanceMode !== "undefined") plBalanceMode = "sym";
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
  // --- Frequenzabgleich-Ergebnisse ---
  if (typeof fRes !== "undefined") fRes.splice(0, fRes.length);
  if (typeof renderFreqMatchResults === "function") renderFreqMatchResults();
  // BA 161: FreqMatch-Tab-UI nach Reset auffrischen
  if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
  if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
  if (typeof fmApplyLang === "function") fmApplyLang();
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
  // --- EQ-Knopf + Stärke ---
  if (typeof plEqOn !== "undefined") plEqOn = false;
  if (typeof updEqToggleBtn === "function") updEqToggleBtn();
  const _plStr = document.getElementById("plStr");
  if (_plStr) _plStr.value = "100";
  // --- Warp-Block ---
  if (typeof pWarpOn !== "undefined") {
    pWarpOn = false;
    pWarpMode = "var_side";
    pWarpStrength = 100;
    pWarpMethod = "sinmodel";
    const _ws  = document.getElementById("plWarpStr");
    if (_ws) _ws.value = pWarpStrength;
    const _wm  = document.getElementById("plWarpMethod");
    if (_wm) _wm.value = pWarpMethod;
    const _wmd = document.getElementById("plWarpModeSelect");
    if (_wmd) _wmd.value = pWarpMode;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  // --- MAPLAW-Knopf ---
  if (typeof pMaplawOn !== "undefined") pMaplawOn = false;
  if (typeof pMaplawSollC !== "undefined") pMaplawSollC = 1000;
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
  // --- Player-Experimental ---
  if (typeof plShowExperimental !== "undefined") plShowExperimental = false;
  if (typeof pApplyShowExperimental === "function") pApplyShowExperimental();
  // --- Sprecher-Auswahl im Player ---
  const _spk = document.getElementById("plSentSpeaker");
  if (_spk) _spk.value = "";
  // --- Schieber-Tab-Modus und -Variante ---
  if (typeof lvTabMode !== "undefined") lvTabMode = "rel";
  if (typeof lvTabVariant !== "undefined") lvTabVariant = "stack";
  if (typeof lvTabShowMeas !== "undefined") lvTabShowMeas = false;
  if (typeof lvTabShowCurves !== "undefined") lvTabShowCurves = false;
  const _lvModeRel = document.getElementById("lvTabModeRel");
  if (_lvModeRel) _lvModeRel.checked = true;
  const _lvVarStack = document.getElementById("lvTabVarStack");
  if (_lvVarStack) _lvVarStack.checked = true;
  const _lvChkMeas = document.getElementById("lvTabChkMeas");
  if (_lvChkMeas) _lvChkMeas.checked = false;
  const _lvChkCurves = document.getElementById("lvTabChkCurves");
  if (_lvChkCurves) _lvChkCurves.checked = false;
  if (typeof lvTabUpdateModeAvailability === "function") lvTabUpdateModeAvailability();
  // --- „Schieber für beide Seiten gleich"-Checkbox ---
  const _prBoth = document.getElementById("prBothSides");
  if (_prBoth) _prBoth.checked = true;
  // --- UI-Refresh ---
  buildFreqTable();
  buildPrTbl();
  drawLvChart();
  renderResults();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (typeof lvTabRebuild === "function") lvTabRebuild();
  if (typeof updSideButtons === "function") updSideButtons();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 161: Direkt persistieren, damit ein F5 sofort danach NICHT
  // den alten Stand zurückbringt. Nicht auf den 5-s-Tick warten.
  if (typeof window._autoSaveState === "function") window._autoSaveState();
  alert(t("resetDone"));
}
```

---

## Akzeptanztest

1. **Tool frisch laden.** Version oben rechts: `3.1.161-beta`.
2. **Diverse Einstellungen ändern:**
   - Hersteller links auf MED-EL, rechts auf Cochlear.
   - Volume auf 30 %, Tondauer 500 ms, Pause 300 ms.
   - Reiter „Kurven": Schieber-Tab-Modus „absolut" (falls verfügbar).
   - Reiter „Player": EQ-Knopf ein, Warp-Knopf ein, MAPLAW-Knopf ein.
   - Sprecher-Dropdown im Player auf einen konkreten Sprecher setzen.
   - Reiter „Laden/Speichern": Notiz an Audiologen eingeben
     („Testnotiz Akzeptanz BA 161").
3. **F5 drücken.** Erwartet: Alle obigen Einstellungen
   einschließlich Notiz sind erhalten.
4. **Reiter „Frequenzabgleich" wählen, Verfahren auf „Schieber"
   stellen.** F5. Erwartet: Verfahren bleibt „Schieber", nicht
   „Adaptiv".
5. **Reiter Laden/Speichern → „Alles löschen" → bestätigen.**
   Erwartet:
   - Hersteller-Dropdowns auf „Keine Angabe".
   - Volume = 50, Tondauer = 1000, Pause = 500.
   - Schieber-Tab-Modus zurück auf „relativ".
   - EQ-Knopf aus, Warp-Knopf aus, MAPLAW-Knopf aus.
   - Sprecher-Auswahl im Player auf „—/Alle".
   - Notiz an Audiologen leer.
   - Frequenzabgleich-Verfahren zurück auf „Adaptiv".
6. **Aktiver Reiter nach Reset.** Erwartet: bleibt auf „Laden/Speichern",
   wechselt **nicht** auf „Einführung".
7. **Direkt nach Reset F5.** Erwartet: Tool bleibt im Reset-Zustand.
   Die alten Einstellungen aus Schritt 2 kommen **nicht** zurück.
8. **Notiz an Audiologen eingeben, 1 Sekunde warten, F5.** Erwartet:
   Notiz steht wieder da (Auto-Save innerhalb von ≤ 5 s).
9. **Stereo-Balance-Test mit zwei Wert-Eingaben durchlaufen,
   dann F5.** Erwartet: Balance-Ergebnis und Schnappschuß
   (`lrSnapshot`) erhalten.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 9 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich melden:
- Wurde `_autoSaveState()` als eigene Funktion ausgelagert? Wird sie
  per `window._autoSaveState` global verfügbar gemacht? (Datei/Zeile)
- Enthält `_autoSaveState()` die neuen Felder `audiologUserNote`,
  `lrSnapshot`, `fmMode`/`fmAdaptiveDur`/`fmAdaptivePau`?
- Heißen die Warp-Schlüssel im Auto-Save jetzt
  `warpOn/warpMode/warpStrength/warpMethod`?
- Akzeptiert die Lade-Routine in `js/init.js` sowohl die neuen Namen
  als auch die alten (`pWarpOn` etc.) als Fallback?
- Ruft `resetAll()` am Ende `window._autoSaveState()` auf?
- Setzt `resetAll()` Schieber-Tab-Modus, Warp, MAPLAW, EQ, Sprecher
  und Schieber-Tabelle-Checkbox `prBothSides` auf Default zurück?
- Steht `js/version.js` auf `3.1.161-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/file.js` — `resetAll()` vervollständigt
- `js/init.js` — Auto-Save als Funktion ausgelagert, neue Felder
  ergänzt, Warp-Lade-Fallback

---

## Nicht in dieser Bauanleitung enthalten

- **BA 162** — Notiz an Audiologen erscheint im Audiologen-Bericht.
- **BA 163** — Tab-Isolation per sessionStorage.
- **BA 164** — Checkbox-Spalte „Aktiv" und neues Bool-Array.
- **BA 165** — L↔R-Knöpfe im Reiter Kurven.
