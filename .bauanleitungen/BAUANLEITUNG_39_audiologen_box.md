# Bauanleitung 39: Tab Laden/Speichern — Audiologen-Box (Modus B)

Setzt Bauanleitungen 37 (Player-Fix) und 38 (Archiv-Box, neue
Datei `print-md.js`, Dateinamen-Schema) voraus. Diese Anleitung
ergänzt die noch leere Platzhalter-Karte `#cardAudiolog` (in
Bauanleitung 38 vorbereitet) und baut den **Audiologen-Auftrag**
(Modus B) komplett aus.

**Sichtbares Verhalten nach dieser Anleitung**:

- Im Tab Laden/Speichern erscheint zwischen Archiv-Karte und
  EasyEffects-Karte eine neue Karte „Einstellungswünsche an den
  Audiologen". Drei Aktionen: Drucken (mit Korrektur-Chart),
  Markdown kopieren, Markdown herunterladen.
- Erklär-Text und drei Hinweis-Zeilen direkt in der Karte.
- Der Markdown-Inhalt spiegelt den Player-Zustand wider und
  übersetzt ihn in CI-Einheiten (qu/CL/CU) plus dB.

Berührt: `index.html`, `i18n.js`, `init.js`, `print-md.js`,
`CODESTRUKTUR.md`, `SPEC.md`.

---

## Schritt 1 — HTML der Audiologen-Karte

In `index.html`, im `panel-file`-Block, den in Bauanleitung 38
gesetzten Platzhalter
```html
<div class="card" id="cardAudiolog" style="display:none"></div>
```
**komplett ersetzen** durch:

```html
        <div class="card" id="cardAudiolog">
          <h2 data-t="audiologTitle"></h2>
          <p
            style="
              font-size: 0.84em;
              color: var(--text-muted);
              margin-bottom: 8px;
            "
            data-t="audiologDesc"
          ></p>
          <ul
            style="
              font-size: 0.82em;
              color: var(--text-muted);
              margin: 0 0 14px 18px;
              padding: 0;
            "
          >
            <li data-t="audiologHintSide"></li>
            <li data-t="audiologHintWarp"></li>
            <li data-t="audiologHintNote"></li>
          </ul>
          <div class="btn-group">
            <button class="btn" id="fAudiologPrintBtn">
              &#128424; <span data-t="audiologPrint"></span>
            </button>
            <button class="btn" id="fAudiologCopyBtn">
              &#128203; <span data-t="audiologCopyMd"></span>
            </button>
            <button class="btn" id="fAudiologMdBtn">
              &#11015; <span data-t="audiologDownloadMd"></span>
            </button>
          </div>
        </div>
```

---

## Schritt 2 — Generator und Druck-Funktionen in `print-md.js`

In `print-md.js` (aus Bauanleitung 38), **am Ende der Datei**,
folgenden Block anhängen:

```js
// ============================================================
// MODUS B — AUDIOLOGEN-AUFTRAG
// ============================================================

function mdAudiologFilename() {
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const sideTag = (side === "left")  ? "links"
                : (side === "right") ? "rechts"
                : "beide";
  return `ci-sound-balancing-audiologe-${mdDateStampFile()}-${sideTag}.md`;
}

// Welche Seiten kommen in den Hauptteil?
function _audiologMainSides() {
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (m === "left")  return ["left"];
  if (m === "right") return ["right"];
  return ["left", "right"]; // both, mono
}

function _audiologIsTwoEar() {
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  return (m === "both" || m === "mono");
}

// ΔdB-Korrektur pro Elektrode für eine Seite, mit plStr-Skalierung.
// Vorzeichen: der Player setzt EQ = -g * str (siehe pBuildEQ); für den
// Audiologen-Auftrag ist die Anweisung "MCL um diesen Betrag verändern",
// also dieselbe Polarität wie der EQ-Gain. NH-Sim wird ignoriert.
function _audiologDbForSide(side) {
  return withSide(side, () => {
    const g = computeGains();
    const str = parseInt(document.getElementById("plStr").value) / 100;
    const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
    if (!eqOn) return g.map(() => 0);
    return g.map((v) => -v * str);
  });
}

// Hersteller-Einheit-Δ aus ΔdB + MCL berechnen.
// Liefert { value: Number|null, unit: "qu"|"CL"|"CU"|"" }.
function _audiologAbsDelta(side, i, dB) {
  return withSide(side, () => {
    const impl = sideData[side].implant || {};
    const mcl = impl.mcl && impl.mcl[i];
    const thr = impl.thr && impl.thr[i];
    const unit = lvUnitLabelFor(mfr);
    let res = null;
    if (mfr === "medel" && mcl != null) {
      res = calcMedel(dB, mcl);
    } else if (mfr === "cochlear" && mcl != null) {
      res = calcCochlear(dB, mcl, impl.generation);
    } else if (mfr === "ab" && mcl != null && thr != null) {
      res = calcAB(dB, mcl, thr, impl.idr);
    }
    if (res && res.delta != null && isFinite(res.delta)) {
      return { value: res.delta, unit };
    }
    return { value: null, unit };
  });
}

function _audiologDbCol(dB) {
  if (!isFinite(dB)) return "—";
  return `${dB >= 0 ? "+" : ""}${dB.toFixed(1)} dB`;
}

function _audiologAbsCol(absRes) {
  if (absRes.value == null || !isFinite(absRes.value)) return "—";
  return `${absRes.value >= 0 ? "+" : ""}${absRes.value.toFixed(1)} ${absRes.unit}`;
}

// Pro-Seite-EQ-Tabelle
function _audiologSideTable(side) {
  return withSide(side, () => {
    const dBs = _audiologDbForSide(side);
    // Nur Zeilen mit aktivem Elektrodenstatus und mit ≠ 0 dB
    const rows = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "mute" || elSt[i] === "excluded") continue;
      const dB = dBs[i] || 0;
      if (Math.abs(dB) < 0.05) continue; // Rundungsschmutz
      const abs = _audiologAbsDelta(side, i, dB);
      rows.push({
        el: `${dENPrefix()}${dEN(i)}`,
        hz: _mdFmtHz(effFreq(i)),
        dB: _audiologDbCol(dB),
        abs: _audiologAbsCol(abs),
        unit: abs.unit,
      });
    }
    if (rows.length === 0) return "";
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    const mfrLabel = (MFR[mfr] && MFR[mfr].label) || mfr;
    const unit = rows[0].unit || "qu/CL/CU";
    const lines = [];
    lines.push(`### ${sideName} (${mfrLabel})`);
    lines.push("");
    lines.push(`| ${t("thEl")} | ${t("thHz")} | ${t("audiologColDb")} | ${t("audiologColAbs")} (${unit}) |`);
    lines.push("|---|---|---|---|");
    for (const r of rows) lines.push(`| ${r.el} | ${r.hz} | ${r.dB} | ${r.abs} |`);
    return lines.join("\n") + "\n";
  });
}

// MAPLAW-Block (nur MED-EL, nur wenn aktiv für betroffene Seite)
function _audiologMaplawBlock(mainSides) {
  if (typeof pMaplawOn === "undefined" || !pMaplawOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const sollC = (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : null;
  const rows = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd || sd.manufacturer !== "medel") continue;
    const istC = (sd.implant && sd.implant.cValue) ? sd.implant.cValue : null;
    if (istC == null || sollC == null || istC === sollC) continue;
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    rows.push(`- ${sideName}: MAPLAW c **${istC} → ${sollC}**`);
  }
  if (rows.length === 0) return "";
  const lines = [`### ${t("audiologSecMaplaw")}`, "", ...rows, ""];
  return lines.join("\n");
}

// Frequenzempfehlungen pro Seite (nur bei aktivem Warp).
// Liefert die fRes-Daten als "neue Mittenfrequenzen".
function _audiologFreqBlock(side) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  if (typeof fRes === "undefined" || fRes.length === 0) return "";
  const own = fRes.filter((r) => r.varSide === side);
  if (own.length === 0) return "";
  const sideName = side === "left" ? t("sideLeft") : t("sideRight");
  const lines = [];
  lines.push(`#### ${sideName}`);
  lines.push("");
  lines.push(`| ${t("thEl")} | ${t("audiologColFreqOld")} | ${t("audiologColFreqNew")} |`);
  lines.push("|---|---|---|");
  for (const r of own) {
    const elTxt = withSide(side, () => `${dENPrefix()}${dEN(r.elIdx)}`);
    lines.push(`| ${elTxt} | ${_mdFmtHz(r.varFreq)} | ${_mdFmtHz(r.refFreq)} |`);
  }
  return lines.join("\n") + "\n";
}

// Stereo-Balance-Block: globaler L↔R-Offset, mit Hinweis daß er bereits
// in obige ΔMCL eingerechnet sein kann.
function _audiologBalanceBlock() {
  if (typeof plApplyBalance === "undefined" || !plApplyBalance) return "";
  if (!_audiologIsTwoEar()) return "";
  if (typeof getPlayerBalance !== "function") return "";
  const b = getPlayerBalance();
  if (!isFinite(b) || b === 0) return "";
  // b > 0 = links anheben / rechts dämpfen (siehe player.js)
  const mode = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  const modeTxt = t("plBalMode" + mode.charAt(0).toUpperCase() + mode.slice(1)) || mode;
  const lines = [];
  lines.push(`### ${t("audiologSecBalance")}`);
  lines.push("");
  lines.push(`- ${t("audiologBalValue")}: **${b > 0 ? "+" : ""}${b.toFixed(1)} dB** (${t("audiologBalDir")})`);
  lines.push(`- ${t("audiologBalMode")}: ${modeTxt}`);
  lines.push("");
  lines.push(`_${t("audiologBalHint")}_`);
  lines.push("");
  return lines.join("\n");
}

// Latenz-Block
function _audiologLatencyBlock() {
  if (typeof plApplyLatency === "undefined" || !plApplyLatency) return "";
  if (!_audiologIsTwoEar()) return "";
  if (typeof latencyResult === "undefined" || !latencyResult
      || !isFinite(latencyResult.valueMs)) return "";
  const ms = latencyResult.valueMs;
  const sideTxt = ms >= 0 ? t("sideRight") : t("sideLeft");
  const lines = [];
  lines.push(`### ${t("audiologSecLatency")}`);
  lines.push("");
  lines.push(`- ${t("audiologLatValue")}: **${Math.abs(ms).toFixed(2)} ms** (${sideTxt})`);
  lines.push(`- _${t("audiologLatHint")}_`);
  lines.push("");
  return lines.join("\n");
}

// Vermerk-Block: alles, was im Hauptteil nicht eingeflossen ist,
// aber gemessen wurde — wenn einseitig gedruckt wird oder
// sym-Warp + einseitig.
function _audiologNoteBlock(mainSides) {
  const out = [];
  const isSingleSide = (mainSides.length === 1);
  // Balance-Messung vorhanden, aber nicht eingerechnet?
  const balActive = (typeof plApplyBalance !== "undefined") && plApplyBalance
                 && _audiologIsTwoEar();
  if (!balActive && typeof lrResults !== "undefined"
      && Object.keys(lrResults).filter((k) => isFinite(lrResults[k])).length > 0) {
    const keys = Object.keys(lrResults).filter((k) => isFinite(lrResults[k]));
    const mean = keys.reduce((a, k) => a + lrResults[k], 0) / keys.length;
    out.push(`- ${t("audiologNoteBal")}: ${mean >= 0 ? "+" : ""}${mean.toFixed(1)} dB. ${t("audiologNoteBalReason")}`);
  }
  // Latenz-Messung vorhanden, aber nicht eingerechnet?
  const latActive = (typeof plApplyLatency !== "undefined") && plApplyLatency
                 && _audiologIsTwoEar();
  if (!latActive && typeof latencyResult !== "undefined" && latencyResult
      && isFinite(latencyResult.valueMs) && latencyResult.valueMs !== 0) {
    const ms = latencyResult.valueMs;
    const sideTxt = ms >= 0 ? t("sideRight") : t("sideLeft");
    out.push(`- ${t("audiologNoteLat")}: ${Math.abs(ms).toFixed(2)} ms (${sideTxt}). ${t("audiologNoteLatReason")}`);
  }
  // Sym-Warp + einseitig → andere Seite als Vermerk?
  if (isSingleSide && typeof pWarpOn !== "undefined" && pWarpOn
      && typeof pWarpMode !== "undefined" && pWarpMode === "sym"
      && typeof fRes !== "undefined" && fRes.length > 0) {
    const otherSide = mainSides[0] === "left" ? "right" : "left";
    const otherFm = fRes.filter((r) => r.varSide === otherSide);
    if (otherFm.length > 0) {
      out.push(`- ${t("audiologNoteWarp")} (${otherSide === "left" ? t("sideLeft") : t("sideRight")}):`);
      for (const r of otherFm) {
        const elTxt = withSide(otherSide, () => `${dENPrefix()}${dEN(r.elIdx)}`);
        out.push(`  - ${elTxt}: ${_mdFmtHz(r.varFreq)} → ${_mdFmtHz(r.refFreq)}`);
      }
    }
  }
  if (out.length === 0) return "";
  return `### ${t("audiologSecNote")}\n\n` + out.join("\n") + "\n";
}

// EQ aus?
function _audiologEqOffBlock() {
  if (typeof plEqOn === "undefined" || plEqOn) return "";
  return `> ${t("audiologEqOff")}\n\n`;
}

// Haupt-Generator
function buildAudiologMarkdown() {
  const now = new Date();
  const dateStr = now.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
  const mainSides = _audiologMainSides();
  const sideLabel = _mdBilateralLabel();
  const parts = [];
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}\n`);
  parts.push(_audiologEqOffBlock());
  parts.push(`## ${t("audiologSecCorrection")}\n`);
  let anyTable = false;
  for (const side of mainSides) {
    const t1 = _audiologSideTable(side);
    if (t1) { parts.push(t1); anyTable = true; }
  }
  if (!anyTable) {
    parts.push(`_${t("audiologNoCorrection")}_\n`);
  }
  // MAPLAW
  const ml = _audiologMaplawBlock(mainSides);
  if (ml) parts.push(ml);
  // Frequenzbänder (nur bei aktivem Warp)
  if (typeof pWarpOn !== "undefined" && pWarpOn
      && typeof plEqOn !== "undefined" && plEqOn) {
    const freqParts = [];
    for (const side of mainSides) {
      const fb = _audiologFreqBlock(side);
      if (fb) freqParts.push(fb);
    }
    if (freqParts.length > 0) {
      parts.push(`## ${t("audiologSecFreq")}\n`);
      parts.push(freqParts.join("\n"));
    }
  }
  // Balance
  const bal = _audiologBalanceBlock();
  if (bal) parts.push(bal);
  // Latenz
  const lat = _audiologLatencyBlock();
  if (lat) parts.push(lat);
  // Vermerk-Block
  const note = _audiologNoteBlock(mainSides);
  if (note) parts.push(note);
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ============================================================
// MODUS B — DRUCK MIT GRAFIK
// ============================================================
//
// Konvertiert das Markdown in einfaches HTML und ergänzt am Anfang ein
// Korrektur-Bar-Chart pro betroffener Seite (als PNG-Img).

function _mdToHtmlBasic(md) {
  // Einfacher Konverter: Headings, Listen, Bold, Tabellen, Absätze.
  // Genug für die Audiologen-Box. Keine generische Library.
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    // Überschriften
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${esc(h[2])}</h${lvl}>`);
      i++; continue;
    }
    // Tabelle erkennen
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i+1])) {
      const head = line.split("|").slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      let tbl = '<table style="border-collapse:collapse;margin:8px 0;">';
      tbl += "<thead><tr>" + head.map((c) => `<th style="border:1px solid #888;padding:4px 8px;background:#eee;">${esc(c)}</th>`).join("") + "</tr></thead>";
      tbl += "<tbody>" + rows.map((r) =>
        "<tr>" + r.map((c) => `<td style="border:1px solid #888;padding:4px 8px;">${esc(c).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</td>`).join("") + "</tr>"
      ).join("") + "</tbody></table>";
      out.push(tbl);
      continue;
    }
    // Listen
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      out.push("<ul>" + items.map((it) =>
        `<li>${esc(it).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/_([^_]+)_/g, "<i>$1</i>")}</li>`
      ).join("") + "</ul>");
      continue;
    }
    // Block-Quote
    if (/^\s*>\s+/.test(line)) {
      out.push(`<blockquote style="border-left:3px solid #888;padding-left:8px;color:#555;">${esc(line.replace(/^\s*>\s+/, ""))}</blockquote>`);
      i++; continue;
    }
    // Absatz / leere Zeile
    if (line.trim() === "") { i++; continue; }
    // einfache **bold** / _italic_ in inline
    const inline = esc(line)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/_([^_]+)_/g, "<i>$1</i>");
    out.push(`<p>${inline}</p>`);
    i++;
  }
  return out.join("\n");
}

// Kleines Bar-Chart der ΔdB-Werte pro Elektrode auf einem temporären Canvas.
// Liefert ein <img>-HTML-Snippet (PNG-Daten-URL).
function _audiologChartImg(side) {
  const dBs = _audiologDbForSide(side);
  return withSide(side, () => {
    const canvas = document.createElement("canvas");
    const W = 700, H = 220;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
    let maxAbs = 1;
    for (let i = 0; i < nEl; i++) maxAbs = Math.max(maxAbs, Math.abs(dBs[i] || 0));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const pad = { l: 36, r: 14, t: 28, b: 28 };
    const pW = W - pad.l - pad.r, pH = H - pad.t - pad.b;
    const zY = pad.t + pH / 2;
    const gW = pW / nEl;
    // Achse + Null-Linie
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zY); ctx.lineTo(W - pad.r, zY); ctx.stroke();
    // Y-Skala
    ctx.fillStyle = "#444"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("+" + maxAbs, pad.l - 4, pad.t + 8);
    ctx.fillText("0", pad.l - 4, zY + 3);
    ctx.fillText("-" + maxAbs, pad.l - 4, H - pad.b + 4);
    // Balken
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "mute" || elSt[i] === "excluded") continue;
      const v = dBs[i] || 0;
      if (Math.abs(v) < 0.05) continue;
      const h = (Math.abs(v) / maxAbs) * (pH / 2);
      const x = pad.l + i * gW + 2;
      const w = Math.max(2, gW - 4);
      ctx.fillStyle = v >= 0 ? "#3b82f6" : "#ef4444";
      if (v >= 0) ctx.fillRect(x, zY - h, w, h);
      else        ctx.fillRect(x, zY,    w, h);
      // E-Beschriftung unten
      ctx.fillStyle = "#444"; ctx.textAlign = "center";
      ctx.fillText(`${dENPrefix()}${dEN(i)}`, x + w / 2, H - pad.b + 16);
    }
    // Titel
    ctx.fillStyle = "#000"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    ctx.fillText(`${t("audiologChartTitle")} — ${sideName}`, pad.l, 16);
    return canvasToImg(canvas, 700);
  });
}

function audiologPrint() {
  const md = buildAudiologMarkdown();
  const mainSides = _audiologMainSides();
  const eqOn = (typeof plEqOn === "undefined") ? true : plEqOn;
  const charts = (eqOn ? mainSides.map((s) => _audiologChartImg(s)).filter(Boolean) : []);
  const body = charts.join("") + _mdToHtmlBasic(md);
  if (typeof openPrintWindow !== "function") {
    alert("openPrintWindow not available — print.js missing?");
    return;
  }
  openPrintWindow(t("audiologTitle"), body);
}
```

---

## Schritt 3 — Listener in `init.js`

In `init.js`, direkt nach dem `fArchivMdBtn`-Listener (aus
Bauanleitung 38), folgenden Block einfügen:

```js
  document.getElementById("fAudiologPrintBtn").addEventListener("click", audiologPrint);
  document.getElementById("fAudiologCopyBtn").addEventListener("click", () => {
    mdCopyToClipboard(buildAudiologMarkdown());
  });
  document.getElementById("fAudiologMdBtn").addEventListener("click", () => {
    mdDownload(buildAudiologMarkdown(), mdAudiologFilename());
  });
```

---

## Schritt 4 — i18n-Strings (alle vier Sprachen)

In `i18n.js` in **allen vier Sprachblöcken** folgende Keys ergänzen.

**Deutscher Block** (im Anschluß an die `archiv…`-Keys aus
Bauanleitung 38):

```js
    audiologTitle: "Einstellungswünsche an den Audiologen",
    audiologDesc: "Wiedergabe der Einstellungen gemäß dem Player: Die Einstellungen sollen bewirken, daß Sie genau so hören, wie wenn Sie etwas im Player abspielen.",
    audiologHintSide: "Bitte auf die Side-Auswahl im Player (Links/Rechts/Beide) achten — der Auftrag enthält nur die ausgewählte(n) Seite(n).",
    audiologHintWarp: "Frequenzkorrektur wird nur ausgegeben, wenn im Player Frequenz-Warping aktiv ist.",
    audiologHintNote: "Bei einseitigem Ausdruck und symmetrischem Frequenz-Warping wird nur die ausgewählte Seite in die Korrekturtabelle übernommen. Werte der anderen Seite werden als Vermerk angehängt.",
    audiologPrint: "Drucken (mit Grafik)",
    audiologCopyMd: "Markdown kopieren",
    audiologDownloadMd: "Markdown herunterladen",
    audiologHeaderSide: "Aktive Side-Auswahl",
    audiologSecCorrection: "Korrekturwerte pro Elektrode",
    audiologSecMaplaw: "MAPLAW-Änderung",
    audiologSecFreq: "Empfohlene Frequenzbänder",
    audiologSecBalance: "Stereo-Balance",
    audiologSecLatency: "Inter-Ohr-Latenz",
    audiologSecNote: "Vermerk",
    audiologColDb: "Δ relativ",
    audiologColAbs: "Δ absolut",
    audiologColFreqOld: "bisher",
    audiologColFreqNew: "empfohlen",
    audiologBalValue: "Globaler L↔R-Offset",
    audiologBalDir: "positiv = links anheben / rechts dämpfen",
    audiologBalMode: "Anwendung im Player",
    audiologBalHint: "Korrekturwerte oben enthalten diese Anpassung bereits, sofern beidseitig ausgegeben. Audiologe entscheidet einseitige oder beidseitige Umsetzung.",
    audiologLatValue: "Verzögerung",
    audiologLatHint: "Umsetzung am Hörgerät/CI nach Maßgabe des Akustikers.",
    audiologNoCorrection: "Keine Korrektur abgeleitet — Player-EQ liefert für alle Elektroden 0 dB.",
    audiologEqOff: "**Hinweis:** Player-EQ ist ausgeschaltet — es werden keine CI-Änderungen abgeleitet.",
    audiologNoteBal: "Stereo-Balance wurde gemessen",
    audiologNoteBalReason: "Nicht in obigen Auftrag eingeflossen, da Player aktuell ohne aktive Balance oder einseitig.",
    audiologNoteLat: "Latenz wurde gemessen",
    audiologNoteLatReason: "Nicht in obigen Auftrag eingeflossen, da Player aktuell ohne aktiven Latenzausgleich oder einseitig.",
    audiologNoteWarp: "Frequenz-Warping wirkt im Player symmetrisch. Empfehlungen für die nicht gedruckte Seite",
    audiologChartTitle: "Korrektur",
```

**Englischer Block**:

```js
    audiologTitle: "Settings request for the audiologist",
    audiologDesc: "Reflects the current player settings: the requested CI settings should make you hear at the CI what you currently hear in the player.",
    audiologHintSide: "Please pay attention to the player side selection (Left/Right/Both) — the request only contains the selected side(s).",
    audiologHintWarp: "Frequency corrections are only included if frequency warping is active in the player.",
    audiologHintNote: "On single-sided output with symmetric frequency warping, only the selected side is part of the correction table. Values for the other side are appended as a note.",
    audiologPrint: "Print (with chart)",
    audiologCopyMd: "Copy Markdown",
    audiologDownloadMd: "Download Markdown",
    audiologHeaderSide: "Active side selection",
    audiologSecCorrection: "Corrections per electrode",
    audiologSecMaplaw: "MAPLAW change",
    audiologSecFreq: "Recommended frequency bands",
    audiologSecBalance: "Stereo balance",
    audiologSecLatency: "Inter-ear latency",
    audiologSecNote: "Note",
    audiologColDb: "Δ relative",
    audiologColAbs: "Δ absolute",
    audiologColFreqOld: "current",
    audiologColFreqNew: "recommended",
    audiologBalValue: "Global L↔R offset",
    audiologBalDir: "positive = boost left / cut right",
    audiologBalMode: "Player application",
    audiologBalHint: "Correction values above already include this offset, if output is bilateral. Audiologist decides single- or bilateral implementation.",
    audiologLatValue: "Delay",
    audiologLatHint: "Implementation at the hearing aid / CI as decided by the audiologist.",
    audiologNoCorrection: "No correction derived — Player EQ is 0 dB on all electrodes.",
    audiologEqOff: "**Note:** Player EQ is off — no CI changes derived.",
    audiologNoteBal: "Stereo balance was measured",
    audiologNoteBalReason: "Not included in the request above, as the player is currently single-sided or balance is inactive.",
    audiologNoteLat: "Latency was measured",
    audiologNoteLatReason: "Not included in the request above, as the player is currently single-sided or latency compensation is inactive.",
    audiologNoteWarp: "Frequency warping in the player acts symmetrically. Recommendations for the non-printed side",
    audiologChartTitle: "Correction",
```

**Französisch** und **Spanisch** analog. Sonnet: bei Begriffen, die
schon in anderen Keys existieren („Print", „Copy", „Side"), die
dortige Wortwahl übernehmen, damit die Sprache konsistent bleibt.

---

## Schritt 5 — `CODESTRUKTUR.md` aktualisieren

### 5a. Modul-Tabelle

Den `print-md.js`-Eintrag aus Bauanleitung 38 erweitern um die
neuen Modus-B-Funktionen:

```
| 12d | print-md.js | Markdown-Generatoren für Archiv-Box (Modus A) und Audiologen-Box (Modus B). Modus A: `buildArchivMarkdown` + diverse `_md*`-Sektion-Helfer. Modus B: `buildAudiologMarkdown`, `audiologPrint`, `mdAudiologFilename`, ein interner Mini-MD→HTML-Konverter `_mdToHtmlBasic` und ein Korrektur-Chart-Helfer `_audiologChartImg`. Gemeinsame Helfer: `mdCopyToClipboard`, `mdDownload`, `mdArchivFilename`, `mdDateStampFile`, `_mdEsc`, `_mdFmtDb`, `_mdFmtHz`, `_mdBilateralLabel`. Lädt zwischen `print.js` und `tab-print.js`. |
```

### 5b. Datenfluss-Block (Absatz anhängen)

```
**Audiologen-Auftrag (Modus B):** `buildAudiologMarkdown` in
print-md.js leitet die CI-Einstellungen aus dem aktuellen Player-
Zustand ab. Welche Seiten in den Hauptteil kommen, ergibt sich aus
`getPlayerSide()`: bei `left`/`right` nur die jeweilige Seite, bei
`both`/`mono` beide. EQ-Werte werden als `-computeGains() * plStr`
berechnet (NH-Sim wird ignoriert), in dB ausgegeben und über
`calcMedel`/`calcCochlear`/`calcAB` zusätzlich in der Hersteller-
Einheit aufgeführt (sofern MCL pro Elektrode bekannt). Stereo-
Balance, Latenz und Frequenz-Warping landen im Hauptteil, wenn
ihre Player-Checkbox aktiv ist und der Side-Modus paßt. Daten,
die gemessen wurden, aber im Hauptteil nicht eingeflossen sind,
landen im Vermerk-Block am Ende — einschließlich der zweiten
Seite bei symmetrischem Warping mit einseitigem Druck. Druck-Pfad
nutzt `_mdToHtmlBasic` (Mini-Konverter) plus pro Seite ein
Korrektur-Bar-Chart als PNG-Img, wird in `openPrintWindow` aus
print.js gerendert.
```

---

## Schritt 6 — `SPEC.md` aktualisieren

Im „Drucken"-Abschnitt einen weiteren Unterabschnitt einfügen:

```
### Audiologen-Box im Tab Laden/Speichern

Karte „Einstellungswünsche an den Audiologen" zwischen Archiv-Karte
und EasyEffects-Karte. Drei Aktionen: Drucken (mit Korrektur-Chart
als Grafik), Markdown kopieren, Markdown herunterladen.

Der ausgegebene Bericht spiegelt den Player-Zustand wider:
- Korrekturwerte pro Elektrode in dB und Hersteller-Einheit
  (qu/CL/CU), berücksichtigt EQ-Stärke und Quellen-Toggles.
- MAPLAW-Änderung (nur MED-EL, nur wenn aktiv).
- Empfohlene Mittenfrequenzen aus `fRes` (nur bei aktivem Warp).
- Stereo-Balance als eigener Abschnitt; Hinweis, daß die
  Korrekturen oben sie bereits enthalten, sofern beidseitig.
- Inter-Ohr-Latenz; Umsetzung dem Akustiker überlassen.
- Vermerk-Block am Ende: gemessene Werte, die nicht in den Hauptteil
  einfließen (z.B. Latenz/Balance bei einseitigem Druck, andere
  Seite bei sym-Warp).

Side-Logik:
- `getPlayerSide() === "left"` oder `"right"`: nur die jeweilige
  Seite. Balance und Latenz werden bei einseitigem Druck nicht in
  den Hauptteil, sondern in den Vermerk übernommen, sofern Werte
  vorliegen.
- `getPlayerSide() === "both"` oder `"mono"`: beide Seiten plus
  Balance/Latenz (sofern aktiv).

Dateinamen: `ci-sound-balancing-audiologe-<datum>-<zeit>-<seite>.md`
mit `<seite>` ∈ {`links`, `rechts`, `beide`}.
```

---

## Schritt 7 — IDEEN.md aufräumen

Nach Fertigstellung dieser dritten Bauanleitung in IDEEN.md den
Eintrag „Druck/Export-Funktion umbauen — Archiv-Modus und
Audiologen-Auftrag" **entfernen** (das Konzept ist umgesetzt, siehe
Bauanleitungen 37–39).

---

## Nicht zu tun

- Keine externe Markdown-Library einbinden. Der Mini-Konverter
  `_mdToHtmlBasic` deckt das Modus-B-Markdown ab.
- Den `fPrintBtn`-Handler in init.js (Modus-A-Druck) NICHT
  anfassen.
- Modus-B-Druck nutzt `openPrintWindow` aus print.js — `print.js`
  selbst nicht ändern.
- NH-Sim wird in Modus B ignoriert (Begründung: NH-Sim ist eine
  reine Player-Diagnose-Funktion, keine CI-Anweisung). Keine
  Inversion in `_audiologDbForSide`.
- `getPlayerBalance()` und `getPlayerBalanceGains()` aus
  Bauanleitung 37 nicht ändern.
- Keine bestehenden i18n-Keys umbenennen.

---

## Akzeptanztest

Vorbereitung: Daten mit Messungen, Stereo-Balance-Ergebnissen,
Latenzwert und Frequenzabgleich-Ergebnissen. Audiodatei im Player
geladen.

1. **Standardfall — beide Seiten**: Player auf `plBothSides` an,
   Balance an, Latenz an, MAPLAW an (MED-EL beide Seiten), Warp aus.
   - Erwartet: Audiologen-Box → „Markdown kopieren". Inhalt enthält:
     - Kopf mit „Aktive Side-Auswahl: beide Seiten"
     - Sektion „Korrekturwerte pro Elektrode" mit zwei Untertabellen
       (links + rechts), je vier Spalten (E, Hz, Δ relativ in dB,
       Δ absolut in qu/CL/CU)
     - MAPLAW-Sektion mit Hersteller-spezifischen Werten
     - Balance-Sektion mit Mittelwert und Mode-Beschriftung
     - Latenz-Sektion
     - Keine Vermerk-Sektion (alles eingeflossen)

2. **Einseitig links**: Player auf nur links umstellen
   (`plBothSides` aus, Side-Button links).
   - Erwartet: „Markdown kopieren" liefert
     - Nur Tabelle für links
     - MAPLAW nur für links (sofern MED-EL)
     - Balance-Sektion **fehlt**, Latenz-Sektion **fehlt**
     - Vermerk-Sektion enthält Balance- und Latenz-Werte mit Hinweis
       „nicht eingeflossen, da einseitig"

3. **Sym-Warp + einseitig**: Warp im Player an, Modus
   „symmetrisch", Side einseitig links.
   - Erwartet:
     - Frequenz-Sektion mit empfohlenen Mittenfrequenzen für links
     - Vermerk-Sektion zusätzlich: Werte der rechten Seite mit
       Hinweis „Warping wirkt symmetrisch"

4. **EQ aus**: `plEqOn` ausschalten.
   - Erwartet: Kopfzeile enthält Hinweis „Player-EQ ist
     ausgeschaltet — es werden keine CI-Änderungen abgeleitet."
     Korrektur-Tabellen sind leer (oder „keine Korrektur
     abgeleitet"). Balance/Latenz/MAPLAW/Warp werden ebenfalls
     nicht ausgegeben.

5. **NH-Sim an**: NH-Simulation aktivieren.
   - Erwartet: Markdown unverändert (NH-Sim ignoriert). Vorzeichen
     der Korrekturen wie bei NH-Sim aus.

6. **Markdown herunterladen**: Dateiname enthält Side-Kennung
   `links`/`rechts`/`beide`, z.B. `ci-sound-balancing-audiologe-
   2026-05-19-1830-links.md`.

7. **Drucken**: „Drucken (mit Grafik)" klicken.
   - Erwartet: Neues Browserfenster mit Druck-Layout. Pro betroffener
     Seite ein Korrektur-Bar-Chart (Balken pro Elektrode, blau für
     Anhebung, rot für Absenkung). Darunter der Markdown-Inhalt als
     HTML (Tabellen, Listen, Zitate). Druck-Dialog öffnet sich.
   - Bei `plEqOn` aus: kein Chart, nur Text.

8. **Sprache wechseln**: EN/FR/ES.
   - Erwartet: alle neuen Sektionen in der gewählten Sprache, ohne
     deutsche Reste.

9. **Box-Hinweise sichtbar**: in der Karte erscheinen unter dem
   Beschreibungstext drei Bullet-Hinweise zu Side-Auswahl, Warp,
   Vermerk-Block.

10. **Schließen-Test**: Nach Modus-B-Druck den Tab „Laden/Speichern"
    verlassen und wieder betreten — keine Layout-Regression.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen
und in dieser Tabelle eintragen:

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| HTML-Karte `cardAudiolog` mit Erklär-Text + drei Hinweis-Bullets + drei Buttons | | |
| `buildAudiologMarkdown` in print-md.js mit allen Sektionen | | |
| `audiologPrint` ruft `openPrintWindow` mit Chart + HTML-Konvertierung | | |
| `_mdToHtmlBasic` deckt H1–H6, Tabellen, Listen, Bold/Italic, Blockquote ab | | |
| `_audiologChartImg` zeichnet Bar-Chart pro Seite auf temporärem Canvas | | |
| `_audiologDbForSide` skaliert mit `plStr` und respektiert `plEqOn` | | |
| NH-Sim wird in Modus B nicht angewandt | | |
| Balance kommt in Hauptteil nur bei `plApplyBalance` + Two-Ear-Modus | | |
| Latenz kommt in Hauptteil nur bei `plApplyLatency` + Two-Ear-Modus | | |
| Vermerk-Block enthält Balance/Latenz, wenn Daten da sind, aber nicht eingeflossen | | |
| Vermerk-Block enthält andere Seite bei sym-Warp + einseitig | | |
| MAPLAW-Block nur MED-EL und nur bei `pMaplawOn` + `plEqOn` | | |
| Frequenz-Block nur bei `pWarpOn` + `plEqOn` | | |
| Drei Listener in init.js (Print, Copy, MD-Download) | | |
| Alle neuen i18n-Strings in DE, EN, FR, ES | | |
| CODESTRUKTUR.md `print-md.js`-Eintrag erweitert + neuer Datenfluss-Absatz | | |
| SPEC.md Audiologen-Box-Absatz im Drucken-Block | | |
| IDEEN.md-Eintrag „Druck/Export-Funktion umbauen…" entfernt | | |
| Dateiname-Schema mit Side-Tag (`links`/`rechts`/`beide`) | | |

Bei „Unklar"-Punkten dem Nutzer eine konkrete Rückfrage stellen,
bevor du weiterläufst.
