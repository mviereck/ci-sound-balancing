document.addEventListener("DOMContentLoaded", () => {
  try {
    const sl = localStorage.getItem("ci-lb-lang");
    if (sl && L[sl]) {
      document.getElementById("langSelect").value = sl;
      lang = sl;
    }
  } catch (e) {}
  applyLang();
  updSideButtons();
  updFClearBtn();
  updPlSrcButtons();
  buildImplantCard();
  document.getElementById("langSelect").addEventListener("change", () => window.applyLang());
  // Tonart-Dropdown
  document.getElementById("toneTypeSel").addEventListener("change", (e) => {
    globalToneType = e.target.value;
  });
  // toneHint-Texte setzen (wird auch von applyLang erneut gesetzt)
  function updToneHint() {
    const h = t("toneHint");
    const b1 = document.getElementById("toneHintBox");
    const b2 = document.getElementById("lrToneHintBox");
    if (b1) b1.textContent = h;
    if (b2) b2.textContent = h;
    // Dropdown-Option-Labels
    const sel = document.getElementById("toneTypeSel");
    if (sel) {
      sel.options[0].text = t("toneSine");
      sel.options[1].text = t("toneComplex");
      sel.options[2].text = t("toneNoise");
    }
    const lbl = document.getElementById("toneTypeLabel");
    if (lbl) lbl.textContent = t("toneTypeLabel");
  }
  // applyLang patchen, damit toneHint bei Sprachwechsel aktualisiert wird
  const _origApplyLang = applyLang;
  window.applyLang = function() {
    _origApplyLang();
    updToneHint();
  };
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
  // ciSideSelect hidden; side switching via sideLeftBtn/sideRightBtn onclick
  // Player: Beide-Seiten Checkbox
  document
    .getElementById("plBothSides")
    .addEventListener("change", function () {
      const row = document.getElementById("plMonoEQRow");
      if (row) row.style.display = this.checked ? "" : "none";
      if (!this.checked) {
        const mono = document.getElementById("plMonoEQ");
        if (mono) mono.checked = false;
      }
      updatePlayerForSideChange();
    });
  document.getElementById("plMonoEQ").addEventListener("change", function () {
    updatePlayerForSideChange();
  });
  // Volume sync between setup and test (textboxes)
  document.getElementById("vol1").addEventListener("change", (e) => {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
    e.target.value = v;
    document.getElementById("vol2").value = v;
  });
  document.getElementById("vol2").addEventListener("change", (e) => {
    const v = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
    e.target.value = v;
    document.getElementById("vol1").value = v;
  });
  document.getElementById("pairType").addEventListener("change", (e) => {
    document
      .getElementById("manualSel")
      .classList.toggle("hidden", e.target.value !== "manual");
    updateRunExplain();
  });
  document.getElementById("refEl").addEventListener("change", (e) => {
    refEl = +e.target.value;
  });
  document.getElementById("startBtn").addEventListener("click", startTest);
  document.getElementById("stopTBtn").addEventListener("click", () => {
    endTest();
    renderResults();
  });
  document.getElementById("repBtn").addEventListener("click", playCur);
  document.getElementById("undoBtn").addEventListener("click", undoL);
  document.getElementById("manPlayBtn").addEventListener("click", playManPair);
  document.getElementById("exclBtn").addEventListener("click", showExclDlg);
  document.getElementById("exclCanc").addEventListener("click", () => {
    document.getElementById("exclDlg").classList.add("hidden");
    playCur();
  });
  document.getElementById("swapBtn").addEventListener("click", () => {
    if (!testAct || testIdx >= testPairs.length) return;
    stopAll();
    const slVal = parseFloat(document.getElementById("balSl").value);
    const totOff = curBase + slVal;
    [curA, curB] = [curB, curA];
    testPairs[testIdx] = [curA, curB];
    curBase = 0;
    rstSlR();
    const newSlVal = -totOff;
    const s = document.getElementById("balSl");
    s.min = Math.min(parseFloat(s.min), Math.floor(newSlVal) - 1).toString();
    s.max = Math.max(parseFloat(s.max), Math.ceil(newSlVal) + 1).toString();
    s.value = newSlVal;
    document.getElementById("balV").textContent = newSlVal.toFixed(1) + " dB";
    updBalAbs(newSlVal);
    document.getElementById("tAL").innerHTML =
      `<span class="aba-label">A (Ref)</span>E${dEN(curA)}`;
    document.getElementById("tBL").innerHTML =
      `<span class="aba-label">B (Slider)</span>E${dEN(curB)}`;
    document.getElementById("pairF").textContent =
      `${Math.round(effFreq(curA))} Hz vs. ${Math.round(effFreq(curB))} Hz`;
    playCur();
  });
  const jH = (r) => () => {
    if (document.getElementById("pairType").value === "manual") {
      recJdg(r);
      afterManRes();
    } else recJdg(r);
  };
  document.getElementById("bAL").addEventListener("click", jH("a"));
  document.getElementById("bEq").addEventListener("click", jH("equal"));
  document.getElementById("bBL").addEventListener("click", jH("b"));
  document.getElementById("balSl").addEventListener("input", (e) => {
    const v = parseFloat(e.target.value);
    document.getElementById("balV").textContent = v.toFixed(1) + " dB";
    updBalAbs(v);
  });
  document
    .getElementById("balSl")
    .addEventListener("change", (e) => e.target.blur());
  document
    .getElementById("balSl")
    .addEventListener("mouseup", (e) => e.target.blur());
  document
    .getElementById("balSl")
    .addEventListener("touchend", (e) => e.target.blur());
  document.getElementById("extBtn").addEventListener("click", extSlR);
  document.getElementById("confBtn").addEventListener("click", () => {
    if (document.getElementById("pairType").value === "manual") {
      recBal();
      afterManRes();
    } else recBal();
  });
  // File
  document
    .getElementById("fLoadBtn")
    .addEventListener("click", () => document.getElementById("fInput").click());
  document.getElementById("fInput").addEventListener("change", (e) => {
    if (e.target.files[0]) loadJson(e.target.files[0]);
  });
  document.getElementById("fSaveBtn").addEventListener("click", saveJson);
  document.getElementById("fPrintBtn").addEventListener("click", async () => {
    // Hilfsfunktionen
    const getStatusText = (i, excl, st) => {
      if (excl) return "ausgeschlossen";
      if (!st) return "";
      const map = {
        noisyHeavy: "Starkes Rauschen",
        noisyMore: "Rauschen mit etwas Ton",
        noisyLess: "Ton mit Rauschen",
        almostMute: "fast stumm",
        mute: "stumm",
      };
      return map[st] || "";
    };

    const getResiduum = (i, srcFlag, bResLocal, elResLocal) => {
      if (srcFlag === "levels") return "";
      const hasMeas = bResLocal.some((r) => r.a === i || r.b === i);
      if (!hasMeas) return "";
      const r = elResLocal[i];
      return r !== undefined && r > 0 ? r.toFixed(1) + " dB" : "";
    };

    // Formatierung für Preset-Parameter
    const formatPresetParams = (pr, mfrLocal, nElLocal, dENfn) => {
      const params = [];
      if (pr.center !== undefined) {
        const centerVal = pr.center;
        if (Number.isInteger(centerVal)) {
          params.push(`Center: E${dENfn(centerVal)}`);
        } else {
          const lower = Math.floor(centerVal);
          const upper = lower + 1;
          params.push(`Center: E${dENfn(lower)}–E${dENfn(upper)}`);
        }
      }
      if (pr.width !== undefined) params.push(`Breite: ${pr.width}`);
      if (pr.cutoff !== undefined) params.push(`Cutoff: E${dENfn(pr.cutoff)}`);
      return params.length ? ` (${params.join(", ")})` : "";
    };

    // EQ-Graphen für eine Seite zeichnen (auf einem separaten Canvas)
    const drawEqImageForSide = (side) => {
      return withSide(side, () => {
        // Temporäres Canvas erstellen
        const canvas = document.createElement("canvas");
        const width = 800,
          height = 300;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        // Gains für diese Seite holen
        const gains = computeGains();
        const allE = allEl();
        const act = new Set(actEl());
        const str = parseInt(document.getElementById("plStr").value) / 100;
        const nhSim = document.getElementById("plNHSim").checked;
        const plEqOnLocal = plEqOn;

        // Maximaler Gain für Skalierung
        let maxAbs = 1;
        for (const i of allE) {
          if (!act.has(i)) continue;
          const g = Math.abs(gains[i]) * str;
          if (g > maxAbs) maxAbs = g;
        }
        maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;

        const pad = { left: 40, right: 14, top: 14, bottom: 26 };
        const pW = width - pad.left - pad.right;
        const pH = height - pad.top - pad.bottom;
        const zY = pad.top + pH / 2;
        const gW = pW / allE.length;

        // Hintergrund
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = "#ddd";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);

        // Horizontale Hilfslinien
        const steps = Math.min(4, Math.floor(maxAbs / 2));
        for (let s = 1; s <= steps; s++) {
          const dB = s * (maxAbs / steps);
          const yO = (dB / maxAbs) * (pH / 2);
          ctx.beginPath();
          ctx.moveTo(pad.left, zY - yO);
          ctx.lineTo(width - pad.right, zY - yO);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(pad.left, zY + yO);
          ctx.lineTo(width - pad.right, zY + yO);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#999";
          ctx.font = "9px Consolas,monospace";
          ctx.textAlign = "right";
          ctx.fillText("+" + dB.toFixed(0), pad.left - 4, zY - yO + 3);
          ctx.fillText("-" + dB.toFixed(0), pad.left - 4, zY + yO + 3);
          ctx.setLineDash([2, 4]);
        }
        ctx.setLineDash([]);
        ctx.fillStyle = "#999";
        ctx.fillText("0", pad.left - 4, zY + 3);

        // Null-Linie
        ctx.strokeStyle = "#aaa";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pad.left, zY);
        ctx.lineTo(width - pad.right, zY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Balken zeichnen
        for (let j = 0; j < allE.length; j++) {
          const i = allE[j];
          const x = pad.left + j * gW;
          const bW = Math.max(5, gW * 0.6);
          const isExcluded = elExDur[i] !== null;
          const isActive = act.has(i) && !isExcluded;
          let ag = 0;
          if (isActive && plEqOnLocal) {
            ag = nhSim ? gains[i] * str : -gains[i] * str;
          }
          const bH = (Math.abs(ag) / maxAbs) * (pH / 2);
          const y = ag >= 0 ? zY - bH : zY;

          if (!isActive || isExcluded) {
            ctx.fillStyle = "#d1d5db";
            ctx.fillRect(x + (gW - bW) / 2, zY - 0.5, bW, 1);
          } else {
            ctx.fillStyle = ag === 0 ? "#ccc" : ag > 0 ? "#16a34a" : "#dc2626";
            if (bH > 0.5) {
              ctx.fillRect(x + (gW - bW) / 2, y, bW, bH);
            } else {
              ctx.fillStyle = "#ccc";
              ctx.fillRect(x + (gW - bW) / 2, zY - 0.5, bW, 1);
            }
          }

          // Beschriftung
          ctx.fillStyle = isActive ? "#666" : "#bbb";
          ctx.font = "8px Segoe UI,sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            "E" + dEN(i),
            pad.left + j * gW + gW / 2,
            height - pad.bottom + 10,
          );
          ctx.font = "7px Consolas,monospace";
          ctx.fillStyle = "#999";
          const ef_ii = effFreq(i);
          ctx.fillText(
            ef_ii >= 1000 ? (ef_ii / 1000).toFixed(1) + "k" : ef_ii,
            pad.left + j * gW + gW / 2,
            height - pad.bottom + 20,
          );
        }

        return canvas.toDataURL("image/png");
      });
    };

    // Aktuelle globale Einstellungen
    const src =
      plSrcMeas && plSrcLevels
        ? "both"
        : plSrcMeas
          ? "measured"
          : plSrcLevels
            ? "levels"
            : "measured";
    const srcLabel =
      {
        measured: "Gemessen",
        levels: "Levels",
        both: "Beide (addiert)",
        none: "Keine",
      }[src] || src;
    const strPercent = parseInt(document.getElementById("plStr").value) || 100;
    const hersteller = MFR[mfr].name;
    const ref = `E${dEN(refEl)}`;

    // Daten für eine Seite sammeln
    const collectSideData = (side) => {
      return withSide(side, () => {
        const gains = computeGains();
        const { levels, elRes } = compWLS();
        const activePresets = presets.filter((p) => p.on && p.strength !== 0);
        const activeManualLevels = [];
        const ml = manualLevels || [];
        for (let i = 0; i < nEl; i++) {
          const v = ml[i];
          if (v != null && v !== 0) {
            activeManualLevels.push({ electrode: i, value: v });
          }
        }
        const implant = sideData[side].implant || {};
        return {
          sideLabel: side === "left" ? "LINKS" : "RECHTS",
          nEl,
          freqs: Array.from({ length: nEl }, (_, i) => effFreq(i)),
          gains,
          levels,
          elRes,
          bResLocal: [...bRes],
          elStLocal: [...elSt],
          elExDurLocal: [...elExDur],
          activePresets,
          activeManualLevels,
          dEN: (i) => dEN(i),
          manufacturer: mfr,
          implant: {
            model: implant.model || "",
            processor: implant.processor || "",
            cValue: implant.cValue,
            idr: implant.idr,
            iidr: implant.iidr,
            generation: implant.generation,
            mcl: implant.mcl || [],
            thr: implant.thr || [],
            upperLevel: implant.upperLevel || [],
          },
        };
      });
    };

    // HTML für eine Seite generieren
    const generatePage = (data, eqImage) => {
      const isLevelsOnly = src === "levels";
      // Per-electrode unit conversion
      const im = data.implant || {};
      const isMedel = data.manufacturer === "medel";
      const isAB = data.manufacturer === "ab";
      const isCoch = data.manufacturer === "cochlear";
      const NA = t("implPrintNA");
      const fmtVal = (v) =>
        v === null || v === undefined || isNaN(v) ? NA : v.toFixed(1);
      const fmtInt = (v) =>
        v === null || v === undefined || isNaN(v)
          ? NA
          : Math.round(v).toString();

      // AB: track if IDR was assumed
      let abIDRAssumed = false;
      // Track missing electrodes (those with N/A unit results despite having dB correction)
      const missingEls = [];
      // Track large corrections
      let hasLarge = false;

      let rows = "";
      for (let i = 0; i < data.nEl; i++) {
        const gainVal = data.gains[i];
        const corrVal = -gainVal; // Vorzeichen umkehren: gainVal ist EQ-Gain (Kompensation), corrVal ist die gewünschte Änderung an der Elektrode selbst
        const gainStr =
          corrVal === 0
            ? "0.0"
            : corrVal > 0
              ? "+" + corrVal.toFixed(1)
              : corrVal.toFixed(1);
        const residuum = getResiduum(
          i,
          isLevelsOnly,
          data.bResLocal,
          data.elRes,
        );
        const status = getStatusText(
          i,
          data.elExDurLocal[i] !== null,
          data.elStLocal[i],
        );
        const isExcluded = data.elExDurLocal[i] !== null;
        const rowStyle = isExcluded ? "opacity: 0.5; background: #f9f9f9;" : "";
        if (Math.abs(corrVal) > 5) hasLarge = true;

        // Unit calculation
        let currentStr = NA,
          deltaUnitStr = NA,
          newValStr = NA;
        let extraCol = ""; // for AB: T-Level column

        if (isMedel) {
          const mclOld = im.mcl ? im.mcl[i] : null;
          const r = calcMedel(corrVal, mclOld);
          currentStr = fmtInt(mclOld);
          if (r.delta !== null) {
            deltaUnitStr =
              (r.delta >= 0 ? "+" : "") + r.delta.toFixed(1) + " qu";
            newValStr = r.absolute.toFixed(1) + " qu";
          } else if (corrVal !== 0) missingEls.push("E" + data.dEN(i) + " MCL");
        } else if (isCoch) {
          const gen = im.generation || null;
          const cOld = im.upperLevel ? im.upperLevel[i] : null;
          const r = calcCochlear(corrVal, cOld, gen);
          currentStr = fmtInt(cOld);
          if (r.delta !== null) {
            deltaUnitStr =
              (r.delta >= 0 ? "+" : "") + Math.round(r.delta) + " CL";
            newValStr =
              r.absolute !== null ? Math.round(r.absolute) + " CL" : NA;
          } else if (corrVal !== 0 && !gen)
            missingEls.push("E" + data.dEN(i) + " C");
        } else if (isAB) {
          const mOld = im.upperLevel ? im.upperLevel[i] : null;
          const tOld = im.thr ? im.thr[i] : null;
          const r = calcAB(corrVal, mOld, tOld, im.idr);
          if (r.assumedIDR) abIDRAssumed = true;
          currentStr = fmtInt(mOld);
          extraCol = `<td style="padding:5px 6px;">${fmtInt(tOld)}</td>`;
          if (r.delta !== null) {
            deltaUnitStr =
              (r.delta >= 0 ? "+" : "") + Math.round(r.delta) + " CU";
            newValStr = Math.round(r.absolute) + " CU";
          } else if (corrVal !== 0) missingEls.push("E" + data.dEN(i) + " M");
        }

        rows += `
        <tr style="border-bottom: 1px solid #ddd; ${rowStyle}">
          <td style="padding:5px 6px; font-weight:600;">E${data.dEN(i)}</td>
          <td style="padding:5px 6px;">${Math.round(data.freqs[i])}</td>
          <td style="padding:5px 6px; color:${corrVal > 0 ? "#16a34a" : corrVal < 0 ? "#dc2626" : "#666"}; font-family:monospace;">${gainStr} dB</td>
          ${extraCol}
          <td style="padding:5px 6px; font-family:monospace;">${currentStr}</td>
          <td style="padding:5px 6px; font-family:monospace; color:${deltaUnitStr !== NA ? (corrVal > 0 ? "#16a34a" : corrVal < 0 ? "#dc2626" : "#666") : "#aaa"};">${deltaUnitStr}</td>
          <td style="padding:5px 6px; font-family:monospace;">${newValStr}</td>
          <td style="padding:5px 6px; font-size:0.8em; color:#888;">${residuum ? residuum : ""}${status ? (residuum ? " · " : "") + status : ""}</td>
        </tr>
      `;
      }

      // Column headers
      const thStyle =
        "padding:7px 6px; text-align:left; background:#f0f0f0; border-bottom:2px solid #ccc; font-size:0.82em; white-space:nowrap;";
      const colEl = `<th style="${thStyle}">El.</th>`;
      const colHz = `<th style="${thStyle}">Hz</th>`;
      const colDelta = `<th style="${thStyle}">${t("implPrintColDelta")}</th>`;
      const colCurrent = `<th style="${thStyle}">${isMedel ? "MCL (qu)" : isCoch ? "C-Level (CL)" : "M-Level (CU)"}</th>`;
      const colT = isAB ? `<th style="${thStyle}">T-Level (CU)</th>` : "";
      const colDeltaUnit = `<th style="${thStyle}">${t("implPrintColDeltaUnit")}</th>`;
      const colNew = `<th style="${thStyle}">${t("implPrintColNew")}</th>`;
      const colStatus = `<th style="${thStyle}">${t("implPrintColStatus")}</th>`;
      const thHtml =
        colEl +
        colHz +
        colDelta +
        colT +
        colCurrent +
        colDeltaUnit +
        colNew +
        colStatus;

      // Implant header block
      const mfrName = MFR[data.manufacturer].name;
      const modelStr =
        im.model && im.model !== "unknown"
          ? im.model
          : im.model === "unknown"
            ? t("implUnknown")
            : "—";
      const procStr =
        im.processor && im.processor !== "unknown"
          ? im.processor
          : im.processor === "unknown"
            ? t("implUnknown")
            : "—";
      let globalParamsHtml = "";
      if (isMedel && im.cValue !== null && im.cValue !== undefined)
        globalParamsHtml = `<span style="margin-left:16px">${t("implPrintCVal")}: ${im.cValue}</span>`;
      if (isAB && im.idr !== null && im.idr !== undefined)
        globalParamsHtml = `<span style="margin-left:16px">${t("implPrintIDR")}: ${im.idr} dB</span>`;
      if (isCoch) {
        if (im.iidr !== null && im.iidr !== undefined)
          globalParamsHtml += `<span style="margin-left:16px">${t("implPrintIIDR")}: ${im.iidr} dB</span>`;
        if (im.generation)
          globalParamsHtml += `<span style="margin-left:16px">${t("implPrintGen")}: ${im.generation === "A" ? t("implGenA") : t("implGenB")}</span>`;
      }
      const implHeaderHtml = `
      <div style="background:#f8f8f8;border:1px solid #ddd;border-radius:4px;padding:10px 14px;margin-bottom:16px;font-size:0.88em;">
        <strong>${mfrName}</strong> &nbsp;·&nbsp;
        ${t("implPrintHeader")}: <strong>${modelStr}</strong> &nbsp;·&nbsp;
        ${t("implPrintProcessor")}: <strong>${procStr}</strong>
        ${globalParamsHtml}
      </div>`;

      // Cochlear model missing warning
      const cochGenMissing = isCoch && !im.generation && im.model !== "unknown";
      const cochMissingHtml = cochGenMissing
        ? `<p style="color:#d97706;font-size:0.82em;margin-bottom:8px;">⚠ ${t("implPrintModelMissing")}</p>`
        : "";

      // Aktive Presets mit allen Parametern
      let presetsHtml = "";
      if (data.activePresets.length > 0) {
        presetsHtml = `<p><strong>Aktive Presets:</strong> `;
        presetsHtml += data.activePresets
          .map((p) => {
            const name = t(PR_NAMES[p.type]);
            const params = formatPresetParams(
              p,
              data.manufacturer,
              data.nEl,
              data.dEN,
            );
            return `${name}: ${p.strength > 0 ? "+" : ""}${p.strength.toFixed(1)} dB${params}`;
          })
          .join(" · ");
        presetsHtml += `</p>`;
      }

      // Manuelle Levels (nur ≠ 0)
      let manualHtml = "";
      if (data.activeManualLevels.length > 0) {
        manualHtml = `<p><strong>Manuelle Levels (≠0):</strong> `;
        manualHtml += data.activeManualLevels
          .map(
            (m) =>
              `E${data.dEN(m.electrode)}: ${(m.value || 0) > 0 ? "+" : ""}${(m.value || 0).toFixed(1)} dB`,
          )
          .join(" · ");
        manualHtml += `</p>`;
      }

      const eqImgTag = eqImage
        ? `<img src="${eqImage}" style="max-width: 100%; height: auto; border: 1px solid #ccc;" />`
        : '<p style="color: #999;">EQ-Graph konnte nicht geladen werden.</p>';

      // Audiologen-Hinweistext
      const noteStyle = "margin-bottom:6px;";
      let notesHtml = `<div style="margin-top:28px;border-top:2px solid #333;padding-top:12px;font-size:0.82em;color:#333;">
      <strong style="font-size:1.05em;">${t("implPrintNotesTitle")}</strong>
      <ol style="margin:8px 0 0 16px;padding:0;">
        <li style="${noteStyle}">${t("implPrintNote1")}</li>
        <li style="${noteStyle}">${t("implPrintNote2")}</li>
        <li style="${noteStyle}">${t("implPrintNote2b")}</li>`;
      const dedupMissing = [...new Set(missingEls)];
      if (dedupMissing.length > 0) {
        notesHtml += `<li style="${noteStyle}">${t("implPrintNote3Missing").replace("{list}", dedupMissing.join(", "))}</li>`;
      }
      if (abIDRAssumed) {
        notesHtml += `<li style="${noteStyle}">${t("implPrintNote4IDR")}</li>`;
      }
      if (hasLarge) {
        notesHtml += `<li style="${noteStyle}">${t("implPrintNote5Large")}</li>`;
      }
      notesHtml += `</ol></div>`;

      return `
      <div style="page-break-after: always; margin-bottom: 20px; font-family: sans-serif;">
        <h1 style="font-size: 1.8em; margin-bottom: 8px;">CI Sound Balancing – ${data.sideLabel}</h1>
        <p style="color: #666; margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px;">
          Ausgedruckt: ${new Date().toLocaleString()} &nbsp;·&nbsp; Tool: CI Sound Balancing v2.6
        </p>

        ${implHeaderHtml}

        <h3 style="margin-top: 20px; margin-bottom:8px;">Equalizer-Kurve (angewandt)</h3>
        <div style="margin: 0 0 16px 0;">
          ${eqImgTag}
          <p style="font-size: 0.8em; color: #666; margin-top: 5px;">Grün = Anhebung, Rot = Absenkung, Grau = ausgeschlossen/keine Änderung</p>
        </div>

        <h3 style="margin-bottom:6px;">Elektroden-Korrekturwerte</h3>
        ${cochMissingHtml}
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85em; margin-bottom: 16px;">
          <thead>
            <tr>${thHtml}</tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <div style="margin-top: 16px; font-size: 0.78em; color: #555; border-top: 1px solid #ccc; padding-top: 10px;">
          <p><strong>Einstellungen:</strong> EQ-Quelle: ${srcLabel} | EQ-Stärke: ${strPercent}% | CI-Hersteller: ${hersteller} | Referenz: ${ref}</p>
          ${presetsHtml}
          ${manualHtml}
        </div>

        ${notesHtml}
      </div>
    `;
    };

    // Daten und EQ-Bilder für beide Seiten sammeln
    const leftData = collectSideData("left");
    const rightData = collectSideData("right");
    const leftImage = drawEqImageForSide("left");
    const rightImage = drawEqImageForSide("right");

    // Druck-HTML zusammenbauen
    const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>CI Sound Balancing - Bericht</title>
      <style>
        body { margin: 0; padding: 20px; font-family: sans-serif; }
        @media print {
          body { margin: 0; padding: 0; }
          .page-break { page-break-after: always; }
        }
      </style>
    </head>
    <body>
      ${generatePage(leftData, leftImage)}
      ${generatePage(rightData, rightImage)}
    </body>
    </html>
  `;

    // Druckfenster öffnen
    const printWindow = window.open("", "_blank");
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  });
  document.getElementById("fCopyBtn").addEventListener("click", copyRes);
  document.getElementById("fResetBtn").addEventListener("click", resetAll);
  document.getElementById("fClearBtn").addEventListener("click", clearRes);
  document
    .getElementById("eeExportBtn")
    .addEventListener("click", exportEasyEffects);
  // Levels tab
  document.getElementById("lvResetBtn").addEventListener("click", function () {
    manualLevels.splice(0, manualLevels.length, ...new Array(nEl).fill(0));
    buildLvGrid();
    lvOnChange();
  });
  ["lvChkMeas", "lvChkMan", "lvChkPre"].forEach((id) =>
    document.getElementById(id).addEventListener("change", drawLvChart),
  );
  // Player EQ toggle
  document.getElementById("plEqToggle").addEventListener("click", function () {
    plEqOn = !plEqOn;
    updEqToggleBtn();
    pUpdEQ();
  });
  document
    .getElementById("plBalApplyBtn")
    .addEventListener("click", function () {
      plApplyBalance = !plApplyBalance;
      updBalApplyBtn();
      pUpdEQ();
    });
  updEqToggleBtn();
  updBalApplyBtn();
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
  document.getElementById("plMapOn").addEventListener("change", function () {
    document
      .getElementById("plMapInfo")
      .classList.toggle("hidden", !this.checked);
    if (pBuf) {
      pBuildEQ();
      if (pPlaying) {
        pPause();
        pPlay();
      }
    }
  });
  document.getElementById("plMaplaw").addEventListener("change", function () {
    if (pBuf && document.getElementById("plMapOn").checked) {
      pBuildMapNode();
      if (pPlaying) {
        pPause();
        pPlay();
      }
    }
  });
  // Player volume textbox
  document.getElementById("plVol").addEventListener("change", function () {
    const v = Math.max(0, Math.min(100, parseInt(this.value) || 0));
    this.value = v;
    if (pGain) pGain.gain.value = v / 100;
  });
  // Levels keyboard nav
  document.addEventListener("keydown", function (e) {
    const lvPanel = document.getElementById("panel-levels");
    if (!lvPanel.classList.contains("active")) return;
    if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const act = actEl();
      if (!act.length) return;
      let ci = act.indexOf(lvFocus);
      if (ci < 0) ci = 0;
      if (e.key === "ArrowUp") ci = Math.max(0, ci - 1);
      else ci = Math.min(act.length - 1, ci + 1);
      lvFocus = act[ci];
      updLvFocus();
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const st = e.shiftKey ? 0.1 : 0.5;
      const mn = -20,
        mx = 20;
      if (e.key === "ArrowRight")
        manualLevels[lvFocus] = Math.min(
          mx,
          +(manualLevels[lvFocus] + st).toFixed(1),
        );
      if (e.key === "ArrowLeft")
        manualLevels[lvFocus] = Math.max(
          mn,
          +(manualLevels[lvFocus] - st).toFixed(1),
        );
      buildLvGrid();
      drawLvChart();
    }
  });
  // Test keyboard
  document.addEventListener("keydown", (e) => {
    if (
      !testAct ||
      e.target.tagName === "INPUT" ||
      e.target.tagName === "SELECT"
    )
      return;
    if (e.code === "Space") {
      e.preventDefault();
      playCur();
    }
    if (e.key === "z" || e.key === "Z") {
      e.preventDefault();
      undoL();
    }
    if (e.key === "x" || e.key === "X") {
      e.preventDefault();
      showExclDlg();
    }
    if (testMode === "judgment") {
      if (e.key === "1") {
        e.preventDefault();
        document.getElementById("bAL").click();
      }
      if (e.key === "2") {
        e.preventDefault();
        document.getElementById("bEq").click();
      }
      if (e.key === "3") {
        e.preventDefault();
        document.getElementById("bBL").click();
      }
    }
    if (testMode === "balance" && e.key === "Enter") {
      e.preventDefault();
      document.getElementById("confBtn").click();
    }
    if (
      testMode === "balance" &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      e.preventDefault();
      const s = document.getElementById("balSl"),
        st = e.shiftKey ? 0.1 : 0.5;
      let v = parseFloat(s.value);
      if (e.key === "ArrowLeft")
        v = Math.max(parseFloat(s.min), +(v - st).toFixed(1));
      if (e.key === "ArrowRight")
        v = Math.min(parseFloat(s.max), +(v + st).toFixed(1));
      s.value = v;
      document.getElementById("balV").textContent = v.toFixed(1) + " dB";
      updBalAbs(v);
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
        activeSide = SIDES.includes(d.currentSide) ? d.currentSide : "left";
        bindActiveSide();
        document.getElementById("ciSideSelect").value = activeSide;
        document.getElementById("mfrSelect").value = mfr;
      } else {
        loadSideData("left", d);
        activeSide = "left";
        bindActiveSide();
        document.getElementById("ciSideSelect").value = "left";
        document.getElementById("mfrSelect").value = mfr;
      }
      if (d.playerSource) {
        plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
        plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
        updPlSrcButtons();
      }
      if (d.eqOn !== undefined) {
        plEqOn = d.eqOn;
        updEqToggleBtn();
      }
      if (d.eqStrength !== undefined)
        document.getElementById("plStr").value = d.eqStrength;
      if (d.lrResults && typeof lrResults !== "undefined") {
        Object.assign(lrResults, d.lrResults);
        if (typeof lrRenderResults === "function") lrRenderResults();
      }
      if (d.globalToneType) {
        globalToneType = d.globalToneType;
        const ttSel = document.getElementById("toneTypeSel");
        if (ttSel) ttSel.value = globalToneType;
      }
      buildFreqTable();
      updSideButtons();
    }
  } catch (e) {}
  setInterval(() => {
    try {
      localStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({
          sides: {
            left: {
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
            },
            right: {
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
            },
          },
          currentSide: activeSide,
          lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
          playerSource:
            plSrcMeas && plSrcLevels
              ? "both"
              : plSrcMeas
                ? "measured"
                : plSrcLevels
                  ? "levels"
                  : "none",
          eqOn: plEqOn,
          eqStrength: parseInt(document.getElementById("plStr").value),
          globalToneType: globalToneType,
        }),
      );
    } catch (e) {}
  }, 5000);
});
