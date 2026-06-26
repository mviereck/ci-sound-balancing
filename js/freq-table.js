// ============================================================
// FREQUENCY TABLE
// ============================================================
// Bug 0.4.279.3: Aktiv-/Ausschluss-Aenderung im Implantat-Reiter sofort
// in die "x von y Elektroden gewaehlt"-Anzeige der Mess-Verfahren
// durchreichen (sonst erst beim naechsten Seitenwechsel/Laden aktuell).
function _frq_implantatTableRefreshMeasSummaries() {
  if (typeof ELL_refreshElectrodeSelectionSummary === "function") ELL_refreshElectrodeSelectionSummary();
  if (typeof STB_refreshElectrodeSelectionSummary === "function") STB_refreshElectrodeSelectionSummary();
  if (typeof FRQ_refreshElectrodeSelectionSummary === "function") FRQ_refreshElectrodeSelectionSummary();
}
function FRQ_implantatTableBuild() {
  const im = sideData[activeSide].implant || {};
  const cfg = sideData[activeSide].config || "ci";
  const isAcoustic = ["hg", "normal", "shoh"].includes(cfg);  // BA 153
  const elPfx = cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
  const elLbl = cfg === "ci" ? t("cfgLblElCI") : t("cfgLblElAcoustic");
  // BA 154: bei „Keine Angabe" Tabelle leeren und früh aussteigen
  const isUnknownCfg = cfg === "unknown";
  const isUnknownMfr = !isAcoustic && cfg === "ci"
    && (sideData[activeSide].manufacturer === "unknown" || !sideData[activeSide].manufacturer);
  const _hideTableArea = () => {
    document.getElementById("FRQ_implantatTableHead").innerHTML = "";
    document.getElementById("FRQ_implantatTableBody").innerHTML = "";
    const ids = ["FRQ_implantatDeactHintEl","FRQ_implantatAbfHintEl","FRQ_implantatExclHintEl","implTonePopupRow"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = "none"; });
  };
  if (isUnknownCfg || isUnknownMfr) { _hideTableArea(); return; }
  // BA 155: beide Seiten akustisch — Tabelle leeren
  const leftCfg2  = sideData.left.config  || "unknown";
  const rightCfg2 = sideData.right.config || "unknown";
  const _isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
  if (_isAc(leftCfg2) && _isAc(rightCfg2)) { _hideTableArea(); return; }
  const isMedel = mfr === "medel",
    isAB = mfr === "ab",
    isCoch = mfr === "cochlear";
  const upperHdr = isMedel
    ? t("implMclHdr")
    : isCoch
      ? t("implCLvlHdr")
      : t("implMLvlHdr");
  if (isAcoustic) {
    // BA 153: 8 Spalten ohne Hz-eigen, THR, Upper
    document.getElementById("FRQ_implantatTableHead").innerHTML =
      `<th>${elLbl}</th>` +
      `<th>${t("thHzCi")}</th>` +
      `<th>${t("thSt")}</th>` +
      `<th style="white-space:nowrap">${t("thExclCb")}</th>` +
      `<th>${t("thNote")}</th>`;
  } else {
    // BA 164: neue Spalte „Aktiv" vor Status
    document.getElementById("FRQ_implantatTableHead").innerHTML =
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th style="white-space:nowrap">${t("thActive")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
  }
  const tb = document.getElementById("FRQ_implantatTableBody");
  tb.innerHTML = "";
  const inpStyle =
    "width:60px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em";
  for (let i = 0; i < nEl; i++) {
    const tr = document.createElement("tr");
    // BA 153: akustischer Branch
    if (isAcoustic) {
      let ex = "";
      if (i === 0) ex = ` <span class="el-extra">(${t("apikal")})</span>`;
      if (i === nEl - 1) ex = ` <span class="el-extra">(${t("basal")})</span>`;
      // CI-Frequenz pro Elektrode aus der Gegenseite zur Anzeige
      const ciSide = activeSide === "left" ? "right" : "left";
      const ciEffHz = Math.round(withSide(ciSide, () => FRQ_implantatEffektiv(i)));
      const ownExcl = elExDur[i] != null;
      if (ownExcl) tr.style.opacity = "0.55";
      // Status-Optionen ohne „im CI deaktiviert", mit akustischer Wortwahl
      const so_ac =
        `<option value="">${t("acStOk")}</option>` +
        `<option value="noisyLess">${t("acStMildImpaired")}</option>` +
        `<option value="noisyMore">${t("acStMediumImpaired")}</option>` +
        `<option value="noisyHeavy">${t("acStStrongImpaired")}</option>` +
        `<option value="almostMute">${t("acStAlmostMute")}</option>` +
        `<option value="mute">${t("acStMute")}</option>`;
      tr.innerHTML =
        `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
        `<td style="font-family:var(--mono);font-size:.86em;padding:4px 6px">${ciEffHz}</td>` +
        `<td><select class="ss" data-i="${i}">${so_ac}</select></td>` +
        `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${ownExcl ? " checked" : ""}></td>` +
        `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
      tb.appendChild(tr);
      tr.querySelector(".ss").value = elSt[i] || "";
      continue;
    }
    // === Ende akustischer Branch — ab hier CI-Logik ===
    let ex = "";
    if (i === 0) ex = ` <span class="el-extra">(${t("apikal")})</span>`;
    if (i === nEl - 1) ex = ` <span class="el-extra">(${t("basal")})</span>`;
    const isExcl  = elExDur[i] !== null;
    // BA 164: Aktivitäts-Status aus globaler elActive
    const isDeact = (elActive && elActive[i] === false);
    const stdHz   = Math.round(FRQ_implantat[i]);
    const ownVal  = FRQ_implantatOwn[i] != null ? Math.round(FRQ_implantatOwn[i]) : "";
    const thrVal  =
      im.thr && im.thr[i] !== null && im.thr[i] !== undefined ? im.thr[i] : "";
    const upperVal = isMedel
      ? im.mcl && im.mcl[i] !== null && im.mcl[i] !== undefined
        ? im.mcl[i] : ""
      : im.upperLevel &&
          im.upperLevel[i] !== null &&
          im.upperLevel[i] !== undefined
        ? im.upperLevel[i] : "";
    if (isDeact || isExcl) tr.style.opacity = "0.55";

    // BA 164: Status-Dropdown ohne „deactivated"-Option (6 statt 7)
    const so_i =
      `<option value="">ok</option>` +
      `<option value="noisyLess">${t("stNoisyLess")}</option>` +
      `<option value="noisyMore">${t("stNoisyMore")}</option>` +
      `<option value="noisyHeavy">${t("stNoisyHeavy")}</option>` +
      `<option value="almostMute">${t("stAlmMute")}</option>` +
      `<option value="mute">${t("stMute")}</option>`;

    // BA 164: Aktiv-Checkbox „nackt" — depLockApply() klebt
    // .dep-locked automatisch drauf, wenn Meßdaten vorliegen.
    const _activeChecked = isDeact ? "" : " checked";
    const _activeCbHtml =
      `<input type="checkbox" class="ec-active" data-i="${i}"${_activeChecked}>`;

    tr.innerHTML =
      `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
      `<td style="font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
      `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><input type="number" class="iu" data-i="${i}" value="${upperVal}" min="0" max="1000" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td style="text-align:center">${_activeCbHtml}</td>` +
      `<td><select class="ss" data-i="${i}">${so_i}</select></td>` +
      `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${isExcl ? " checked" : ""}></td>` +
      `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
    tb.appendChild(tr);
    tr.querySelector(".ss").value = elSt[i] || "";
  }
  // Hz own inputs — BA 169: kein FRQ_implantatTableBuild() mehr, damit Tab-Fokus erhalten bleibt
  tb.querySelectorAll(".fo").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const i = +e.target.dataset.i,
        v = parseFloat(e.target.value);
      if (e.target.value === "" || isNaN(v)) {
        FRQ_implantatOwn[i] = null;
        e.target.value = "";
      } else if (v >= 20 && v <= 20000) {
        FRQ_implantatOwn[i] = v;
      } else {
        e.target.value = FRQ_implantatOwn[i] != null ? Math.round(FRQ_implantatOwn[i]) : "";
        return; // ungültiger Wert: keine Updates
      }
      // BA 169: schmale Hinweise-Aktualisierung statt voller Rebuild.
      // depLockApply wird intern in frq_implantatTableUpdateHints aufgerufen.
      frq_implantatTableUpdateHints();
      // Plausibilitätsprüfung neu laufen lassen (wie bei THR/Upper).
      // Ging beim BA-169-Umbau vom vollen FRQ_implantatTableBuild() verloren.
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    }),
  );
  // Vertikale Tab-Navigation: .fo → .it → .iu (Shift+Tab rückwärts)
  [
    { cls: ".fo", next: ".it", prev: null },
    { cls: ".it", next: ".iu", prev: ".fo" },
    { cls: ".iu", next: null,  prev: ".it" },
  ].forEach(({ cls, next, prev }) => {
    const inputs = Array.from(tb.querySelectorAll(cls));
    inputs.forEach((inp, idx) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key !== "Tab") return;
        if (!e.shiftKey) {
          if (idx < inputs.length - 1) {
            e.preventDefault();
            inputs[idx + 1].focus();
          } else if (next) {
            const firstNext = tb.querySelector(next);
            if (firstNext) { e.preventDefault(); firstNext.focus(); }
          }
          // letzte .iu + Tab: Browser-Standard
        } else {
          if (idx > 0) {
            e.preventDefault();
            inputs[idx - 1].focus();
          } else if (prev) {
            const prevInputs = Array.from(tb.querySelectorAll(prev));
            const lastPrev = prevInputs[prevInputs.length - 1];
            if (lastPrev) { e.preventDefault(); lastPrev.focus(); }
          }
          // erste .fo + Shift+Tab: Browser-Standard
        }
      });
    });
  });
  // THR inputs
  tb.querySelectorAll(".it").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i;
      const v = e.target.value !== "" ? parseFloat(e.target.value) : null;
      if (!sideData[activeSide].implant) return;
      sideData[activeSide].implant.thr[idx] = v;
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    }),
  );
  // Upper (MCL/C/M) inputs
  tb.querySelectorAll(".iu").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i;
      const v = e.target.value !== "" ? parseFloat(e.target.value) : null;
      const im2 = sideData[activeSide].implant;
      if (!im2) return;
      if (mfr === "medel") im2.mcl[idx] = v;
      else im2.upperLevel[idx] = v;
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    }),
  );
  tb.querySelectorAll(".ss").forEach((s) =>
    s.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i,
        val = e.target.value || null;
      // BA 205: Wechsel auf "mute" sperren, wenn adaptive FreqMatch-Trials vorliegen.
      // Anderes Dropdown-Verhalten bleibt frei. Wert auf alten Stand zurücksetzen,
      // Transient-Popup mit derselben Begründung wie .ec/.ec-active zeigen.
      if (val === "mute"
          && typeof _FRQ_hasAdaptiveData === 'function'
          && _FRQ_hasAdaptiveData()) {
        e.target.value = elSt[idx] || '';
        if (typeof depLockShowTransientPopup === 'function') {
          depLockShowTransientPopup(e.target, 'depFieldMute', ['depReasonFRQAdaptive']);
        }
        return;
      }
      elSt[idx] = val;
      // BA 164: „deactivated" als Status-Option entfernt — nur noch „mute"
      if (val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
      FRQ_implantatTableBuild();
      updRef();
      // BA 152
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
  tb.querySelectorAll(".ec").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i;
      elExDur[idx] = e.target.checked ? elExDur[idx] || Date.now() : null;
      FRQ_implantatTableBuild();
      updRef();
      _frq_implantatTableRefreshMeasSummaries();
    }),
  );
  // BA 164: Aktiv-Checkbox
  tb.querySelectorAll(".ec-active").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      // BA 164: Sicherheitsnetz — falls preventDefault aus dem globalen
      // mousedown-Handler in dependency-lock.js auf einer Plattform
      // durchrutscht, Toggle rückgängig machen.
      if (e.target.classList.contains('dep-locked')) {
        e.target.checked = !e.target.checked;
        return;
      }
      const idx  = +e.target.dataset.i;
      const want = e.target.checked;
      const arr  = sideData[activeSide].elActive;
      if (!arr) return;
      arr[idx] = want;
      // elActive global neu binden, damit nachfolgende Render-
      // Funktionen den neuen Stand sehen.
      elActive = arr;
      // BA 164: KEINE Auto-Verknüpfung zur Ausschluss-Checkbox.
      FRQ_implantatTableBuild();
      updRef();
      if (typeof depLockApply === 'function') depLockApply();
      _frq_implantatTableRefreshMeasSummaries();
    }),
  );
  tb.querySelectorAll(".ni").forEach((n) =>
    n.addEventListener("change", (e) => {
      elNt[+e.target.dataset.i] = e.target.value;
    }),
  );
  // BA 164/165: Hinweis & Warnung aus elActive[] + Sichtbarkeit nach „eigene Hz vollständig"
  const hintEl = document.getElementById("FRQ_implantatDeactHintEl");
  const hasDeact = (elActive || []).some((a) => a === false);
  // BA 165: „vollständig eigene Hz" = jede aktive Elektrode hat FRQ_implantatOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => FRQ_implantatOwn[i] != null);
  if (hintEl) {
    hintEl.innerHTML = t("FRQ_implantatDeactHint");
    // isAcoustic: Hinweise gelten nur für CI-Tabelle mit Aktiv-Spalte
    hintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const abfHintEl = document.getElementById("FRQ_implantatAbfHintEl");
  if (abfHintEl) {
    abfHintEl.innerHTML = t("FRQ_implantatAbfHint");
    abfHintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const exclHintEl = document.getElementById("FRQ_implantatExclHintEl");
  if (exclHintEl) {
    exclHintEl.innerHTML = t("FRQ_implantatExclHint");
    exclHintEl.style.display = isAcoustic ? "none" : "";
  }
  if (typeof _implTonePopupUpdLabel === "function") _implTonePopupUpdLabel();
  const implTpRow = document.getElementById("implTonePopupRow");
  if (implTpRow) implTpRow.style.display = "";
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => FRQ_implantatOwn[i] == null);
  if (hasDeact && activeHasDefault) {
    if (!wb) {
      wb = document.createElement("div");
      wb.id = "deactWarnBar";
      wb.className = "warning-bar";
      wb.style.cssText =
        "background:#fee2e2;color:#dc2626;border-left:3px solid #dc2626;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:.88em;line-height:1.5";
      const frq_implantatCard = document.getElementById("FRQ_implantatTable").closest(".card");
      frq_implantatCard.insertBefore(
        wb,
        document.getElementById("FRQ_implantatTable").parentElement,
      );
    }
    wb.innerHTML = t("warnDeactivated");
  } else if (wb) {
    wb.remove();
  }
  updRef();
  updManSel();
  applyMobileReadonly(tb);
  if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
  // BA 164: Aktiv-Checkbox-Sperren live anwenden
  if (typeof depLockApply === 'function') depLockApply();
}
// BA 169: Aktualisiert nur die Hz-abhängigen Hinweise und den Warnbalken,
// ohne die Tabelle neu zu rendern. Wird vom .fo-change-Handler aufgerufen,
// damit Tab-Fokus zwischen Eingabefeldern erhalten bleibt.
function frq_implantatTableUpdateHints() {
  const cfg = sideData[activeSide].config || "ci";
  const isAcoustic = ["hg", "normal", "shoh"].includes(cfg);
  const isUnknownCfg = cfg === "unknown";
  const isUnknownMfr = !isAcoustic && cfg === "ci"
    && (sideData[activeSide].manufacturer === "unknown" || !sideData[activeSide].manufacturer);
  // Beide Seiten akustisch
  const leftCfg2  = sideData.left.config  || "unknown";
  const rightCfg2 = sideData.right.config || "unknown";
  const _isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
  const bothAcoustic = _isAc(leftCfg2) && _isAc(rightCfg2);
  // Wenn die Tabelle gar nicht gerendert würde: Hinweise und Warnbalken aus.
  // (Sollte beim .fo-change normalerweise nicht eintreten — Sicherheitsnetz.)
  if (isUnknownCfg || isUnknownMfr || bothAcoustic) {
    ["FRQ_implantatDeactHintEl","FRQ_implantatAbfHintEl"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const wbOff = document.getElementById("deactWarnBar");
    if (wbOff) wbOff.remove();
    return;
  }
  // „vollständig eigene Hz" = jede aktive Elektrode hat FRQ_implantatOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => FRQ_implantatOwn[i] != null);
  const hintEl = document.getElementById("FRQ_implantatDeactHintEl");
  if (hintEl) {
    hintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const abfHintEl = document.getElementById("FRQ_implantatAbfHintEl");
  if (abfHintEl) {
    abfHintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  const hasDeact = (elActive || []).some((a) => a === false);
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => FRQ_implantatOwn[i] == null);
  let wb = document.getElementById("deactWarnBar");
  if (hasDeact && activeHasDefault) {
    if (!wb) {
      wb = document.createElement("div");
      wb.id = "deactWarnBar";
      wb.className = "warning-bar";
      wb.style.cssText =
        "background:#fee2e2;color:#dc2626;border-left:3px solid #dc2626;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:.88em;line-height:1.5";
      const frq_implantatCard = document.getElementById("FRQ_implantatTable").closest(".card");
      frq_implantatCard.insertBefore(
        wb,
        document.getElementById("FRQ_implantatTable").parentElement,
      );
    }
    wb.innerHTML = t("warnDeactivated");
  } else if (wb) {
    wb.remove();
  }
  // Sperren ggf. live nachziehen (z.B. dep-Lock-Felder neu bewerten)
  if (typeof depLockApply === 'function') depLockApply();
}
function updRef() {
  const sel = document.getElementById("ELL_refEl");
  if (!sel) return;
  const prevRef = ELL_refEl;
  const pfx = dENPrefix();
  sel.innerHTML = "";
  for (let i = 0; i < nEl; i++) {
    if (elExDur[i] !== null || elSt[i] === "mute") continue;
    sel.innerHTML += `<option value="${i}">${pfx}${dEN(i)}</option>`;
  }
  // Seitenspezifischer Wert ist die Wahrheit: behalten, solange er noch
  // eine waehlbare (aktive) Elektrode trifft; sonst seitenspezifischer
  // Default (Mitte, deaktivierte uebersprungen).
  const stored = sideData[activeSide] ? sideData[activeSide].ELL_refEl : ELL_refEl;
  let want = stored;
  if (want == null || !sel.querySelector(`option[value="${want}"]`)) {
    want = pickDefaultRefEl(activeSide);
  }
  sel.value = String(want);
  ELL_refEl = want;
  if (sideData[activeSide]) sideData[activeSide].ELL_refEl = want;
  if (want !== prevRef) {
    if (typeof ELL_renderResults === 'function') ELL_renderResults();
    if (typeof kurvenELLChartZeichnen    === 'function') kurvenELLChartZeichnen();
    if (typeof pUpdEQ         === 'function') pUpdEQ();
  }
}
function updManSel() {
  const pfx = dENPrefix();
  ["manA", "manB"].forEach((id) => {
    const s = document.getElementById(id);
    if (!s) return;
    s.innerHTML = "";
    for (let i = 0; i < nEl; i++) {
      if (elExDur[i] !== null || elSt[i] === "mute") continue;
      s.innerHTML += `<option value="${i}">${pfx}${dEN(i)}</option>`;
    }
  });
  const b = document.getElementById("manB");
  if (b && b.options.length > 1) b.selectedIndex = 1;
}
function switchMfr(m) {
  const s = sideData[activeSide];
  const oldMfr = s.manufacturer;
  if (m === oldMfr) return;
  // BA 149: Datenschutz erfolgt jetzt über die Sperre in dependency-lock.js
  // (Sperrt das Dropdown bereits, wenn relevante Meßergebnisse vorliegen).
  // Erreicht der Code diesen Punkt, ist das Feld nicht gesperrt — Wechsel frei.
  s.manufacturer = m;
  s.nEl = MFR[m].n;
  s.FRQ_implantat = [...MFR[m].FRQ_implantat];
  s.FRQ_implantatOwn = new Array(s.nEl).fill(null);
  s.elSt = new Array(s.nEl).fill(null);
  s.elNt = new Array(s.nEl).fill("");
  s.elExDur = new Array(s.nEl).fill(null);
  s.elektrodenlautstaerkeSchieber = new Array(s.nEl).fill(0);
  s.ELL_refEl = Math.floor(s.nEl / 2);
  s.ELL_results = [];
  // Reset implant arrays to new electrode count, preserve global params
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      generation: null,
      mcl: [],
      thr: [],
      upperLevel: [],
    };
  s.implant.model = "";
  s.implant.processor = "";
  s.implant.generation = null;
  s.implant.mcl = new Array(s.nEl).fill(null);
  s.implant.thr = new Array(s.nEl).fill(null);
  s.implant.upperLevel = new Array(s.nEl).fill(null);
  bindActiveSide();
  initElektrodenlautstaerkeKurven();
  s.kurvenELL = kurvenELL;
  ELL_results.splice(0, ELL_results.length);
  ELL_refEl = Math.floor(nEl / 2);
  // Sync akustische Seite wenn nötig
  FRQ_implantatSyncToAcoustic();
  FRQ_implantatTableBuild();
  buildImplantCard();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 172: Tab-Sperre L1 neu bewerten
  if (typeof tabLockApply === 'function') tabLockApply();
}
function frq_implantatReset() {
  FRQ_implantat = [...MFR[mfr].FRQ_implantat];
  FRQ_implantatOwn.fill(null);
  FRQ_implantatTableBuild();
}

// ============================================================
