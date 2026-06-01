// ============================================================
// FREQUENCY TABLE
// ============================================================
function buildFreqTable() {
  const im = sideData[activeSide].implant || {};
  const cfg = sideData[activeSide].config || "ci";
  const elPfx = cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
  const elLbl = cfg === "ci" ? t("cfgLblElCI") : t("cfgLblElAcoustic");
  const isMedel = mfr === "medel",
    isAB = mfr === "ab",
    isCoch = mfr === "cochlear";
  const upperHdr = isMedel
    ? t("implMclHdr")
    : isCoch
      ? t("implCLvlHdr")
      : t("implMLvlHdr");
  document.getElementById("freqTH").innerHTML =
    `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
  const tb = document.getElementById("freqTB");
  tb.innerHTML = "";
  const so = `<option value="">ok</option><option value="noisyLess">${t("stNoisyLess")}</option><option value="noisyMore">${t("stNoisyMore")}</option><option value="noisyHeavy">${t("stNoisyHeavy")}</option><option value="almostMute">${t("stAlmMute")}</option><option value="mute">${t("stMute")}</option><option value="deactivated" style="font-weight:700;color:#dc2626;text-transform:uppercase">${t("stDeactivated").toUpperCase()}</option>`;
  const inpStyle =
    "width:60px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em";
  for (let i = 0; i < nEl; i++) {
    const tr = document.createElement("tr");
    let ex = "";
    if (i === 0) ex = ` <span class="el-extra">(${t("apikal")})</span>`;
    if (i === nEl - 1) ex = ` <span class="el-extra">(${t("basal")})</span>`;
    const isExcl = elExDur[i] !== null;
    const isDeact = elSt[i] === "deactivated";
    const stdHz = Math.round(freqs[i]);
    const ownVal = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
    const thrVal =
      im.thr && im.thr[i] !== null && im.thr[i] !== undefined ? im.thr[i] : "";
    const upperVal = isMedel
      ? im.mcl && im.mcl[i] !== null && im.mcl[i] !== undefined
        ? im.mcl[i]
        : ""
      : im.upperLevel &&
          im.upperLevel[i] !== null &&
          im.upperLevel[i] !== undefined
        ? im.upperLevel[i]
        : "";
    const centVal = Math.round(hzToCent(effFreq(i)));
    const centTxt = (centVal > 0 ? "+" : "") + centVal;
    if (isDeact || isExcl) tr.style.opacity = "0.55";
    tr.innerHTML =
      `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
      `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
      `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px;text-align:right">${centTxt}</td>` +
      `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><input type="number" class="iu" data-i="${i}" value="${upperVal}" min="0" max="1000" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
      `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
      `<td><select class="ss" data-i="${i}">${so}</select></td>` +
      `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}" ${isExcl || isDeact ? "checked" : ""} ${isDeact ? 'disabled title="Deaktivierte Elektroden sind automatisch ausgeschlossen"' : ""}></td>` +
      `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
    tb.appendChild(tr);
    tr.querySelector(".ss").value = elSt[i] || "";
  }
  // Hz own inputs
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
        return; // ungültiger Wert: keine Re-Render
      }
      buildFreqTable();
    }),
  );
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
      if (val === "deactivated") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
      // If status changed away from deactivated, do NOT auto-clear elExDur
      buildFreqTable();
      updRef();
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
  tb.querySelectorAll(".ni").forEach((n) =>
    n.addEventListener("change", (e) => {
      elNt[+e.target.dataset.i] = e.target.value;
    }),
  );
  // Hinweistext für deaktivierte Elektroden (immer sichtbar sobald mind. eine deakt.)
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = elSt.some((s) => s === "deactivated");
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
  }
  // ABF hint (always visible)
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.innerHTML = t("freqAbfHint");
  }
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elSt[i] !== "deactivated")
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
