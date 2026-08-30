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
    const ids = ["implTonePopupRow"];
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
  // FSP-Spalte (nur MED-EL + FS-Strategie): Zahl anwählbarer apikaler El.
  // 2026-08-30: Spalte dauerhaft ausgeblendet (FSP-Steuerung aus dem UI genommen).
  // Daten/Logik (fspEl, Validierung) bleiben erhalten, nur nicht sichtbar.
  const _coding = (sideData[activeSide].implant || {}).coding || "unknown";
  const _fspMax = isMedel && typeof implCodingFspMax === "function"
    ? implCodingFspMax(_coding) : 0;
  const _showFsp = false;
  const _fspHdr = _showFsp
    ? `<th style="white-space:nowrap">${t("thFsp")}</th>` : "";
  if (isAcoustic) {
    // BA 153: 8 Spalten ohne Hz-eigen, THR, Upper
    document.getElementById("FRQ_implantatTableHead").innerHTML =
      `<th>${elLbl}</th>` +
      `<th>${t("thHzCi")}</th>` +
      `<th>${t("thSt")}</th>` +
      `<th style="white-space:nowrap">${t("thExclCb")}</th>`;
  } else {
    // BA 164: neue Spalte „Aktiv" vor Status; FSP-Spalte direkt danach
    const _hwHdr = IMPL_HERSTELLERWERTE
      ? `<th>${t("implThHdr")}</th><th>${upperHdr}</th>`
      : "";
    document.getElementById("FRQ_implantatTableHead").innerHTML =
      `<th>${elLbl}</th><th>${t("thBandLo")}</th><th>${t("thBandHi")}</th><th>${t("thBandMitte")}${infoIconHtml("implBandMitteTip")}</th>${_hwHdr}<th style="white-space:nowrap">${t("thActive")}</th>${_fspHdr}<th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th>`;
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
      const ciEffHz = fmtNum(withSide(ciSide, () => FRQ_implantatEffektiv(i)), "hz");
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
        `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${ownExcl ? " checked" : ""}></td>`;
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
    // Band-Werte der Elektrode i (Architektur §4).
    const _band    = FRQ_implantatBand(i);                 // effektives Band {lo,hi}
    const _defBand = (FRQ_implantatBaenderDefault && FRQ_implantatBaenderDefault[i]) || null;
    // Platzhalter = Default-Grenze (grau). Value = eigene Grenze (schwarz)
    // NUR fuer die tatsaechlich manuell eingegebene Grenze (grenzweise Herkunft).
    const _loPh  = _defBand ? fmtNum(_defBand.lo, "hz") : "";
    const _hiPh  = _defBand ? fmtNum(_defBand.hi, "hz") : "";
    // Anzeige-Value grenzweise: eigener Wert (Zahl formatiert ODER Roh-String),
    // sonst leer (Default-Placeholder grau).
    const _ownObj = (FRQ_implantatBaenderOwn && FRQ_implantatBaenderOwn[i] != null) ? FRQ_implantatBaenderOwn[i] : null;
    const _rawLo  = _ownObj ? _ownObj.lo : null;
    const _rawHi  = _ownObj ? _ownObj.hi : null;
    const _fmtGrenze = (raw) => {
      if (raw == null) return "";
      const n = _bandGrenzeNum(raw);
      return n != null ? fmtNum(n, "hz") : String(raw);   // Roh-String unveraendert
    };
    const _loVal = _fmtGrenze(_rawLo);
    const _hiVal = _fmtGrenze(_rawHi);
    // Mitte "geom (arith)" — reine Anzeige.
    const _geom  = _band ? fmtNum(geomMitte(_band.lo, _band.hi), "hz") : "";
    const _arith = _band ? fmtNum((_band.lo + _band.hi) / 2, "hz") : "";
    const _mitteTxt = _geom ? `${_geom} (${_arith})` : "";
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
    // FSP-Zelle: Checkbox nur für die ersten _fspMax (apikalen) Elektroden.
    let _fspCell = "";
    if (_showFsp) {
      if (i < _fspMax) {
        const _fspChecked = (im.fspEl && im.fspEl[i] === true) ? " checked" : "";
        _fspCell = `<td style="text-align:center"><input type="checkbox" class="ec-fsp" data-i="${i}"${_fspChecked}></td>`;
      } else {
        _fspCell = `<td></td>`;
      }
    }

    tr.innerHTML =
      `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
      `<td><input type="text" inputmode="decimal" autocomplete="off" class="blo" data-i="${i}" value="${_loVal}" placeholder="${_loPh}" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td><input type="text" inputmode="decimal" autocomplete="off" class="bhi" data-i="${i}" value="${_hiVal}" placeholder="${_hiPh}" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td style="font-family:var(--mono);font-size:.86em;padding:4px 6px" title="${t("implBandMitteTip")}">${_mitteTxt}</td>` +
      (IMPL_HERSTELLERWERTE
        ? `<td><input type="text" inputmode="decimal" autocomplete="off" class="it" data-i="${i}" value="${thrVal}" style="${inpStyle}" placeholder="—"></td>` +
          `<td><input type="text" inputmode="decimal" autocomplete="off" class="iu" data-i="${i}" value="${upperVal}" style="${inpStyle}" placeholder="—"></td>`
        : "") +
      `<td style="text-align:center">${_activeCbHtml}</td>` +
      _fspCell +
      `<td><select class="ss" data-i="${i}">${so_i}</select></td>` +
      `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${isExcl ? " checked" : ""}></td>`;
    tb.appendChild(tr);
    tr.querySelector(".ss").value = elSt[i] || "";
  }
  // Band-Eingabe: liest BEIDE Grenz-Felder der Zeile und setzt daraus
  // FRQ_implantatBaenderOwn[i]. Keine Feld-Validierung; Plausibilitaet prueft.
  function _bandInputHandler(e) {
    const i = +e.target.dataset.i;
    const tr = e.target.closest("tr");
    const loRaw = tr.querySelector(".blo").value.trim();
    const hiRaw = tr.querySelector(".bhi").value.trim();
    // Rohwert grenzweise speichern: leer -> null; sonst die Zahl (wenn parsbar)
    // ODER der Roh-String (bleibt fuer Anzeige + Plausibilitaet erhalten).
    const _store = (raw) => {
      if (raw === "") return null;
      const n = _bandGrenzeNum(raw);
      return n != null ? n : raw;          // parsbar -> Zahl, sonst Roh-String
    };
    const lo = _store(loRaw);
    const hi = _store(hiRaw);
    if (lo == null && hi == null) {
      FRQ_implantatBaenderOwn[i] = null;   // beide Default
    } else {
      FRQ_implantatBaenderOwn[i] = { lo: lo, hi: hi };
    }
    // KEINE Feld-Validierung. Kein Zuruecksetzen. Anzeige/Mitte/Warnung schmal
    // aktualisieren (ohne Feld-value zu ueberschreiben -> Fokus bleibt), dann
    // Plausibilitaet laufen lassen (die bewertet die Werte).
    _frqBandRefreshRow(i);
    updRef();
    if (typeof validateImplantTable === "function") validateImplantTable(activeSide);
  }
  tb.querySelectorAll(".blo, .bhi").forEach((inp) =>
    inp.addEventListener("change", _bandInputHandler)
  );
  // Tab/Enter-Navigation der Band-Eingabe: zeilenweise lo -> hi -> naechste
  // Zeile lo. (.it/.iu THR/Upper behalten ihre eigene Navigation unten.)
  const _bandInputs = [];
  tb.querySelectorAll("tr").forEach(function (row) {
    const lo = row.querySelector(".blo");
    const hi = row.querySelector(".bhi");
    if (lo) _bandInputs.push(lo);
    if (hi) _bandInputs.push(hi);
  });
  _bandInputs.forEach(function (inp, idx) {
    inp.addEventListener("keydown", function (e) {
      const fwd  = (e.key === "Tab" && !e.shiftKey) || e.key === "Enter";
      const back = (e.key === "Tab" && e.shiftKey);
      if (fwd) {
        const nxt = _bandInputs[idx + 1];
        if (nxt) { e.preventDefault(); nxt.focus(); }
        else if (e.key === "Enter") { e.preventDefault(); }   // letztes: kein Submit
      } else if (back) {
        const prv = _bandInputs[idx - 1];
        if (prv) { e.preventDefault(); prv.focus(); }
      }
    });
  });
  if (IMPL_HERSTELLERWERTE) {
    // Tab-Navigation THR/Upper: .it -> .iu (vertikal, unabhaengig von Bandfeldern)
    [
      { cls: ".it", next: ".iu", prev: null },
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
          } else {
            if (idx > 0) {
              e.preventDefault();
              inputs[idx - 1].focus();
            } else if (prev) {
              const prevInputs = Array.from(tb.querySelectorAll(prev));
              const lastPrev = prevInputs[prevInputs.length - 1];
              if (lastPrev) { e.preventDefault(); lastPrev.focus(); }
            }
          }
        });
      });
    });
    // THR inputs
    tb.querySelectorAll(".it").forEach((inp) =>
      inp.addEventListener("change", (e) => {
        const idx = +e.target.dataset.i;
        const v = e.target.value !== "" ? parseNum(e.target.value) : null;
        if (!sideData[activeSide].implant) return;
        sideData[activeSide].implant.thr[idx] = v;
        if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
      }),
    );
    // Upper (MCL/C/M) inputs
    tb.querySelectorAll(".iu").forEach((inp) =>
      inp.addEventListener("change", (e) => {
        const idx = +e.target.dataset.i;
        const v = e.target.value !== "" ? parseNum(e.target.value) : null;
        const im2 = sideData[activeSide].implant;
        if (!im2) return;
        if (mfr === "medel") im2.mcl[idx] = v;
        else im2.upperLevel[idx] = v;
        if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
      }),
    );
  }
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
  // FSP-Feinstruktur-Checkbox (nur MED-EL + FS-Strategie)
  tb.querySelectorAll(".ec-fsp").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      const idx = +e.target.dataset.i;
      const imp = sideData[activeSide].implant;
      if (!imp) return;
      if (!Array.isArray(imp.fspEl)) imp.fspEl = new Array(nEl).fill(false);
      // BA476: Praefix-Durchgaengigkeit. Markierung ist immer ein
      // zusammenhaengender Block ab E1 (Index 0). Anhaken von idx markiert
      // 0..idx; Abhaken von idx demarkiert idx..Ende.
      if (e.target.checked) {
        for (let i = 0; i <= idx; i++) imp.fspEl[i] = true;
      } else {
        for (let i = idx; i < imp.fspEl.length; i++) imp.fspEl[i] = false;
      }
      // Tabelle neu bauen, damit die dazwischenliegenden Haekchen sichtbar
      // mitziehen (die DOM-Checkboxen spiegeln imp.fspEl nur beim Build).
      FRQ_implantatTableBuild();
      // BA476: Randausschluss der Glaettung an die FSP-Anzahl koppeln.
      FRQ_randausschlussAusFsp(activeSide);
      if (typeof validateImplantTable === "function") validateImplantTable(activeSide);
    }),
  );
  // BA 164/165: Warnbalken „deaktivierte Elektroden mit Standard-Frequenzen"
  const hasDeact = (elActive || []).some((a) => a === false);
  if (typeof _implTonePopupUpdLabel === "function") _implTonePopupUpdLabel();
  const implTpRow = document.getElementById("implTonePopupRow");
  if (implTpRow) implTpRow.style.display = "";
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => !FRQ_implantatHatOwn(i));
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
// Aktualisiert nur die Optik der Band-Zellen einer Zeile (Value/Placeholder
// grenzweise + Mitte), ohne die Tabelle neu zu bauen -> Fokus/Tab-Navigation
// bleiben erhalten. Der change-Handler hat den State bereits gesetzt.
function _frqBandRefreshRow(i) {
  const tb = document.getElementById("FRQ_implantatTableBody");
  if (!tb) return;
  const loEl = tb.querySelector('.blo[data-i="' + i + '"]');
  const hiEl = tb.querySelector('.bhi[data-i="' + i + '"]');
  const band = FRQ_implantatBand(i);
  // Feld-value NICHT ueberschreiben (Fokus/Tippen bleibt erhalten). Nur Farbe:
  // schwarz wenn eigene Grenze (Zahl ODER Roh-String), sonst geerbt (grau).
  if (loEl) loEl.style.color = FRQ_implantatHatOwnGrenze(i, "lo") ? "var(--text)" : "";
  if (hiEl) hiEl.style.color = FRQ_implantatHatOwnGrenze(i, "hi") ? "var(--text)" : "";
  // Mitten-Zelle (4. Zelle der Zeile: El | lo | hi | Mitte | ...) aktualisieren.
  const tr = loEl ? loEl.closest("tr") : null;
  if (tr && band) {
    const mitteCell = tr.children[3];
    if (mitteCell) {
      const g = fmtNum(geomMitte(band.lo, band.hi), "hz");
      const a = fmtNum((band.lo + band.hi) / 2, "hz");
      mitteCell.textContent = g + " (" + a + ")";
    }
  }
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
  // Wenn die Tabelle gar nicht gerendert würde: Warnbalken aus.
  // (Sollte beim .fo-change normalerweise nicht eintreten — Sicherheitsnetz.)
  if (isUnknownCfg || isUnknownMfr || bothAcoustic) {
    const wbOff = document.getElementById("deactWarnBar");
    if (wbOff) wbOff.remove();
    return;
  }
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  const hasDeact = (elActive || []).some((a) => a === false);
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => !FRQ_implantatHatOwn(i));
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
  s.FRQ_implantatBaenderDefault = implantDefaultBaender(m);
  s.FRQ_implantatBaenderOwn = new Array(s.nEl).fill(null);
  // BA462: Wand-Wahl auf den Default des neuen Herstellers setzen.
  var _bg462 = MFR[m] ? MFR[m].bandGrenzen : null;
  s.bandWandLo = _bg462 ? _bg462.default[0] : null;
  s.bandWandHi = _bg462 ? _bg462.default[1] : null;
  s.elSt = new Array(s.nEl).fill(null);
  s.elExDur = new Array(s.nEl).fill(null);
  s.schieberELL = new Array(s.nEl).fill(0);
  s.elActive = new Array(s.nEl).fill(true);
  s.elFreqChain = new Array(s.nEl).fill(true);
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
  // BA463: seitenweise Band-Wahlen dieser Seite auf Default zuruecksetzen.
  if (typeof FRQ_BAND_WAHLEN !== "undefined") {
    FRQ_BAND_WAHLEN.forEach(function (w) { s[w.key] = w.def; });
  }
  // BA462: Bandgrenzen-Empfehlung inkl. Wand-Radios neu aufbauen.
  if (typeof _frqBandWandBuild === "function") _frqBandWandBuild();
  if (typeof _frqBandSpiegle === "function") _frqBandSpiegle();   // BA463
  if (typeof window._frqGlaettUpdate === "function") window._frqGlaettUpdate();
  if (typeof FRQ_renderResults === "function") FRQ_renderResults();
}
function frq_implantatReset() {
  FRQ_implantatBaenderOwn.fill(null);
  FRQ_implantatTableBuild();
}

// ============================================================
