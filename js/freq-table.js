// ============================================================
// FREQUENCY TABLE
// ============================================================
function buildFreqTable() {
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
    document.getElementById("freqTH").innerHTML = "";
    document.getElementById("freqTB").innerHTML = "";
    const ids = ["freqDeactHintEl","freqAbfHintEl","freqExclHintEl","sweepRow"];
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
    document.getElementById("freqTH").innerHTML =
      `<th>${elLbl}</th>` +
      `<th>${t("thHzCi")}</th>` +
      `<th>${t("thPlay")}</th>` +
      `<th>${t("thHold")}</th>` +
      `<th>${t("thSt")}</th>` +
      `<th style="white-space:nowrap">${t("thExclCb")}</th>` +
      `<th>${t("thNote")}</th>`;
  } else {
    // BA 164: neue Spalte „Aktiv" vor Status
    document.getElementById("freqTH").innerHTML =
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th style="white-space:nowrap">${t("thActive")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
  }
  const tb = document.getElementById("freqTB");
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
      // Spiegel-Ausschluß aus CI-Gegenseite
      const ciSide = activeSide === "left" ? "right" : "left";
      const ciIsActive = (sideData[ciSide].config || "ci") === "ci";
      // BA 164: Quelle für „CI-Spiegel-Ausschluß" ist jetzt elActive
      const ciMirroredExcl = ciIsActive && (
        (sideData[ciSide].elActive && sideData[ciSide].elActive[i] === false) ||
        (sideData[ciSide].elExDur && sideData[ciSide].elExDur[i] != null)
      );
      const ciEffHz = Math.round(withSide(ciSide, () => effFreq(i)));
      const ownExcl = elExDur[i] != null;
      const effExcl = ownExcl || ciMirroredExcl;
      if (effExcl) tr.style.opacity = "0.55";
      // Status-Optionen ohne „im CI deaktiviert", mit akustischer Wortwahl
      const so_ac =
        `<option value="">${t("acStOk")}</option>` +
        `<option value="noisyLess">${t("acStMildImpaired")}</option>` +
        `<option value="noisyMore">${t("acStMediumImpaired")}</option>` +
        `<option value="noisyHeavy">${t("acStStrongImpaired")}</option>` +
        `<option value="almostMute">${t("acStAlmostMute")}</option>` +
        `<option value="mute">${t("acStMute")}</option>`;
      // Checkbox: bei Spiegel-Ausschluß fest + Popup-Daten für Klick/Touch
      const cbAttrs = ciMirroredExcl
        ? ' disabled title="' + t('exclCiMirrored') + '"'
        : '';
      const ecTdAttrs = ciMirroredExcl
        ? ' data-dep-field-label="depFieldExclCiMirrored" data-dep-reasons="exclCiMirrored" data-dep-simple="1"'
        : '';
      tr.innerHTML =
        `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
        `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${ciEffHz}</td>` +
        `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
        `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
        `<td><select class="ss" data-i="${i}">${so_ac}</select></td>` +
        `<td style="text-align:center"${ecTdAttrs}><input type="checkbox" class="ec" data-i="${i}"${effExcl ? " checked" : ""}${cbAttrs}></td>` +
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
    const stdHz   = Math.round(freqs[i]);
    const ownVal  = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
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
      `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
      `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><input type="number" class="iu" data-i="${i}" value="${upperVal}" min="0" max="1000" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
      `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
      `<td style="text-align:center">${_activeCbHtml}</td>` +
      `<td><select class="ss" data-i="${i}">${so_i}</select></td>` +
      `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${isExcl ? " checked" : ""}></td>` +
      `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
    tb.appendChild(tr);
    tr.querySelector(".ss").value = elSt[i] || "";
  }
  // Hz own inputs — BA 169: kein buildFreqTable() mehr, damit Tab-Fokus erhalten bleibt
  tb.querySelectorAll(".fo").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const i = +e.target.dataset.i,
        v = parseFloat(e.target.value);
      if (e.target.value === "" || isNaN(v)) {
        elFreqOwn[i] = null;
        e.target.value = "";
      } else if (v >= 20 && v <= 20000) {
        elFreqOwn[i] = v;
      } else {
        e.target.value = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
        return; // ungültiger Wert: keine Updates
      }
      // BA 169: schmale Hinweise-Aktualisierung statt voller Rebuild.
      // depLockApply wird intern in updateFreqTableHints aufgerufen.
      updateFreqTableHints();
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
  tb.querySelectorAll('.pbtn[data-a="play"]').forEach((b) =>
    b.addEventListener("click", () => playSingle(+b.dataset.i)),
  );
  tb.querySelectorAll('.pbtn[data-a="hold"]').forEach((b) =>
    b.addEventListener("click", () => toggleHold(+b.dataset.i)),
  );
  tb.querySelectorAll(".ss").forEach((s) =>
    s.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i,
        val = e.target.value || null;
      elSt[idx] = val;
      // BA 164: „deactivated" als Status-Option entfernt — nur noch „mute"
      if (val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
      buildFreqTable();
      updRef();
      // BA 152
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
  tb.querySelectorAll(".ec").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i;
      elExDur[idx] = e.target.checked ? elExDur[idx] || Date.now() : null;
      buildFreqTable();
      updRef();
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
      buildFreqTable();
      updRef();
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
  // BA 153: Spiegel-Ausschluß Klick-/Touch-Popup
  tb.querySelectorAll("td[data-dep-simple]").forEach((td) => {
    ["mousedown", "touchstart"].forEach((evt) => {
      td.addEventListener(evt, (e) => {
        if (typeof depLockShowPopup === "function") depLockShowPopup(td);
      }, true);
    });
  });
  tb.querySelectorAll(".ni").forEach((n) =>
    n.addEventListener("change", (e) => {
      elNt[+e.target.dataset.i] = e.target.value;
    }),
  );
  // BA 164/165: Hinweis & Warnung aus elActive[] + Sichtbarkeit nach „eigene Hz vollständig"
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = (elActive || []).some((a) => a === false);
  // BA 165: „vollständig eigene Hz" = jede aktive Elektrode hat elFreqOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => elFreqOwn[i] != null);
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
    // isAcoustic: Hinweise gelten nur für CI-Tabelle mit Aktiv-Spalte
    hintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.innerHTML = t("freqAbfHint");
    abfHintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const exclHintEl = document.getElementById("freqExclHintEl");
  if (exclHintEl) {
    exclHintEl.innerHTML = t("freqExclHint");
    exclHintEl.style.display = isAcoustic ? "none" : "";
  }
  const sweepRowEl = document.getElementById("sweepRow");
  if (sweepRowEl) sweepRowEl.style.display = "flex";
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => elFreqOwn[i] == null);
  if (hasDeact && activeHasDefault) {
    if (!wb) {
      wb = document.createElement("div");
      wb.id = "deactWarnBar";
      wb.className = "warning-bar";
      wb.style.cssText =
        "background:#fee2e2;color:#dc2626;border-left:3px solid #dc2626;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:.88em;line-height:1.5";
      const freqCard = document.getElementById("freqTable").closest(".card");
      freqCard.insertBefore(
        wb,
        document.getElementById("freqTable").parentElement,
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
function updateFreqTableHints() {
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
    ["freqDeactHintEl","freqAbfHintEl"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const wbOff = document.getElementById("deactWarnBar");
    if (wbOff) wbOff.remove();
    return;
  }
  // „vollständig eigene Hz" = jede aktive Elektrode hat elFreqOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => elFreqOwn[i] != null);
  const hintEl = document.getElementById("freqDeactHintEl");
  if (hintEl) {
    hintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  const hasDeact = (elActive || []).some((a) => a === false);
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => elFreqOwn[i] == null);
  let wb = document.getElementById("deactWarnBar");
  if (hasDeact && activeHasDefault) {
    if (!wb) {
      wb = document.createElement("div");
      wb.id = "deactWarnBar";
      wb.className = "warning-bar";
      wb.style.cssText =
        "background:#fee2e2;color:#dc2626;border-left:3px solid #dc2626;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:.88em;line-height:1.5";
      const freqCard = document.getElementById("freqTable").closest(".card");
      freqCard.insertBefore(
        wb,
        document.getElementById("freqTable").parentElement,
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
  const s = document.getElementById("refEl");
  if (!s) return;
  const p = s.value;
  const pfx = dENPrefix();
  s.innerHTML = "";
  for (let i = 0; i < nEl; i++) {
    if (elExDur[i] !== null || elSt[i] === "mute") continue;
    s.innerHTML += `<option value="${i}">${pfx}${dEN(i)}</option>`;
  }
  if (p && s.querySelector(`option[value="${p}"]`)) s.value = p;
  else s.value = String(Math.floor(nEl / 2));
  const newRef = +s.value;
  const changed = (newRef !== refEl);
  refEl = newRef;
  if (changed) {
    if (typeof renderResults === 'function') renderResults();
    if (typeof drawLvChart    === 'function') drawLvChart();
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
  s.freqs = [...MFR[m].freqs];
  s.elFreqOwn = new Array(s.nEl).fill(null);
  s.elSt = new Array(s.nEl).fill(null);
  s.elNt = new Array(s.nEl).fill("");
  s.elExDur = new Array(s.nEl).fill(null);
  s.manualLevels = new Array(s.nEl).fill(0);
  s.refEl = Math.floor(s.nEl / 2);
  s.jRes = [];
  s.bRes = [];
  // Reset implant arrays to new electrode count, preserve global params
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      iidr: null,
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
  initPresets();
  s.presets = presets;
  jRes.splice(0, jRes.length);
  bRes.splice(0, bRes.length);
  refEl = Math.floor(nEl / 2);
  // Sync akustische Seite wenn nötig
  syncFreqsToAcoustic();
  buildFreqTable();
  buildImplantCard();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
function resetFreqs() {
  freqs = [...MFR[mfr].freqs];
  elFreqOwn.fill(null);
  buildFreqTable();
}

// ============================================================
