# Bauanleitung 38: Tab Laden/Speichern — Archiv-Box mit Markdown-Ausgabe

Setzt Bauanleitung 37 voraus (Player-Fix), weil der Markdown-
Generator auf `plBalanceMode` und das ausgegraute Verhalten Bezug
nimmt. Ohne 37 lädt das Tool zwar trotzdem, einige Werte im
Markdown bleiben aber als Fallback auf Defaults.

Diese Anleitung baut die **Archiv-Box** (Modus A) im Tab
Laden/Speichern aus. Modus B (Audiologen-Auftrag) folgt in
Bauanleitung 39.

**Sichtbares Verhalten nach dieser Anleitung**:

- Datei-Tab heißt weiterhin „Laden / Speichern". Die bestehende
  Karte wird zur **Archiv-Karte** umgebaut und um zwei neue
  Aktionen ergänzt: „Markdown kopieren" und „Markdown
  herunterladen". Der bisherige „Tabelle kopieren"-Knopf entfällt.
- Dateinamen-Schema global geändert: `loudness-balancing-…` →
  `ci-sound-balancing-…`, Versionsnummer entfällt im Dateinamen.
- EasyEffects-Export-Datei heißt nun
  `ci-sound-balancing-easyeffects.json`.
- Druck-Knopf bleibt unverändert (nutzt den bestehenden
  `fPrintBtn`-Handler, der schon alle Sektionen mit Grafik
  ausgibt).

Berührt: `index.html`, `i18n.js`, `init.js`, `file.js`, **neue
Datei** `print-md.js`, `CODESTRUKTUR.md`, `SPEC.md`.

---

## Schritt 1 — Dateinamen-Schema umstellen

### 1a. JSON-Save (`file.js`)

In `file.js`, Z. 246, in `saveJson`:

Vorher:
```js
  const fn = `loudness-balancing-v${APP_VERSION}-${ds}-${ts}.json`;
```

Nachher:
```js
  const fn = `ci-sound-balancing-${ds}-${ts}.json`;
```

### 1b. EasyEffects-Export (`file.js`)

In `file.js`, Z. 619, in `exportEasyEffects`:

Vorher:
```js
  a.download = "ci-correction-easyeffects.json";
```

Nachher:
```js
  a.download = "ci-sound-balancing-easyeffects.json";
```

### 1c. Bestehende JSONs

Bestehende Dateien mit dem alten Namen werden weiterhin geladen —
der Dateiname spielt für `loadJson` keine Rolle. Keine Migration
nötig.

---

## Schritt 2 — Neue Datei `print-md.js`

Im Projekt-Root anlegen. Diese Datei kapselt den Modus-A-Markdown-
Generator und alle Markdown-Hilfsfunktionen. Modus B (Bauanleitung
39) ergänzt sie um einen zweiten Generator.

```js
// ============================================================
// MARKDOWN PRINT/EXPORT
// ============================================================
//
// Generatoren für die Archiv-Box (Modus A) und später die
// Audiologen-Box (Modus B). Kein DOM-Druck — der bisherige
// fPrintBtn-Handler in init.js bleibt unangetastet und übernimmt
// den Druck mit Grafiken.
//
// Funktionen:
//   buildArchivMarkdown()       — vollständiger Modus-A-Bericht
//   mdDateStampFile()           — "2026-05-19-1830" für Dateinamen
//   mdArchivFilename()          — "ci-sound-balancing-archiv-…md"
//   mdCopyToClipboard(text)     — Wrapper für navigator.clipboard
//   mdDownload(text, filename)  — File-Download via Blob

// ----------------------------------------------------------------
// Helfer
// ----------------------------------------------------------------

function _mdEsc(s) {
  // Markdown-Special-Zeichen entschärfen für Inline-Text (in
  // Tabellenzellen reicht das Escapen von | und \).
  if (s == null) return "";
  return String(s).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function _mdFmtDb(v, withSign) {
  if (v == null || !isFinite(v)) return "—";
  const sign = withSign && v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} dB`;
}

function _mdFmtHz(v) {
  if (v == null || !isFinite(v)) return "—";
  return `${Math.round(v)} Hz`;
}

function _mdBilateralLabel() {
  // Hilfsbeschriftung für die aktuelle Side im Markdown.
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (m === "both")  return t("sideBoth")  || "beide Seiten";
  if (m === "mono")  return t("sideMono")  || "beide Seiten (Mono-EQ)";
  if (m === "left")  return t("sideLeft")  || "Links";
  if (m === "right") return t("sideRight") || "Rechts";
  return "";
}

function mdDateStampFile() {
  const now = new Date();
  const ds = now.toISOString().slice(0, 10); // 2026-05-19
  const ts = now.toLocaleTimeString("en-US", {
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).replace(":", "");
  return `${ds}-${ts}`;
}

function mdArchivFilename() {
  return `ci-sound-balancing-archiv-${mdDateStampFile()}.md`;
}

function mdCopyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text)
      .then(() => alert(t("copyDone")))
      .catch(() => _mdCopyFallback(text));
  }
  return _mdCopyFallback(text);
}

function _mdCopyFallback(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch (e) {}
  document.body.removeChild(ta);
  alert(t("copyDone"));
}

function mdDownload(text, filename) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ----------------------------------------------------------------
// Sektion: Header
// ----------------------------------------------------------------

function _mdArchivHeader() {
  const now = new Date();
  const dateStr = now.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
  const ver = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "?";
  return `# CI Sound Balancing — ${t("archivTitle")}\n\n`
       + `**${t("archivHeaderDate")}**: ${dateStr}\n`
       + `**${t("archivHeaderVersion")}**: v${ver}\n`
       + `**${t("archivHeaderLang")}**: ${lang.toUpperCase()}\n`;
}

// ----------------------------------------------------------------
// Sektion: Konfiguration pro Seite
// ----------------------------------------------------------------

function _mdConfigBlock() {
  const lines = [`\n## ${t("archivSecConfig")}\n`];
  for (const side of SIDES) {
    const sd = sideData[side];
    if (!sd) continue;
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    lines.push(`### ${sideName}`);
    const cfgKey = sd.config || "ci";
    const cfgLabel = t("cfgOpt_" + cfgKey) || cfgKey;
    lines.push(`- ${t("archivCfgConfig")}: ${cfgLabel}`);
    const mfrLabel = (MFR[sd.manufacturer] && MFR[sd.manufacturer].label) || sd.manufacturer;
    lines.push(`- ${t("archivCfgMfr")}: ${mfrLabel}`);
    lines.push(`- ${t("archivCfgN")}: ${sd.nEl}`);
    const impl = sd.implant || {};
    if (impl.model)     lines.push(`- ${t("archivCfgModel")}: ${impl.model}`);
    if (impl.processor) lines.push(`- ${t("archivCfgProcessor")}: ${impl.processor}`);
    if (impl.cValue)    lines.push(`- ${t("archivCfgCValue")}: ${impl.cValue}`);
    if (impl.strategy)  lines.push(`- ${t("archivCfgStrategy")}: ${impl.strategy}`);
    lines.push("");
  }
  lines.push(`- ${t("archivCfgDefMfr")}: ${(MFR[defaultMfr] && MFR[defaultMfr].label) || defaultMfr}`);
  return lines.join("\n") + "\n";
}

// ----------------------------------------------------------------
// Sektion: Test-Einstellungen
// ----------------------------------------------------------------

function _mdTestSettings() {
  const TONE_LABEL_KEY = {
    sine: "toneSine", complex: "toneComplex", noise: "toneNoise",
    noiseAdaptive: "toneNoiseAdaptive", amSine: "toneAmSine",
    warbleSine: "toneWarbleSine", burstSine: "toneBurstSine",
    wobbleSweep: "toneWobbleSweep"
  };
  const dur = document.getElementById("dur1");
  const pau = document.getElementById("pau1");
  const vol = document.getElementById("vol1");
  const lines = [`\n## ${t("archivSecTest")}\n`];
  lines.push(`- ${t("toneTypeLabel")}: ${t(TONE_LABEL_KEY[globalToneType] || "toneSine")}`);
  lines.push(`- ${t("archivTestSeq")}: ${globalSequence.toUpperCase()}`);
  if (dur) lines.push(`- ${t("lblDur")}: ${dur.value} ms`);
  if (pau) lines.push(`- ${t("lblPau")}: ${pau.value} ms`);
  if (vol) lines.push(`- ${t("lblVol")}: ${vol.value} %`);
  return lines.join("\n") + "\n";
}

// ----------------------------------------------------------------
// Sektion: pro Seite — Messungen / Schieber / Kurven / Frequenzabgleich
// ----------------------------------------------------------------

function _mdMeasTable(side) {
  return withSide(side, () => {
    if (!bRes || bRes.length === 0) return "";
    const { levels, elRes } = compWLS();
    const lines = [];
    lines.push(`#### ${t("archivSecMeas")} (Ref: ${dENPrefix()}${dEN(refEl)})`);
    lines.push("");
    lines.push(`| ${t("thEl")} | ${t("thHz")} | ${t("thOff")} | ${t("thRes")} | ${t("thStR")} |`);
    lines.push("|---|---|---|---|---|");
    for (let i = 0; i < nEl; i++) {
      const hd = bRes.some((r) => r.a === i || r.b === i);
      const elTxt = `${dENPrefix()}${dEN(i)}`;
      const hzTxt = _mdFmtHz(effFreq(i));
      const offTxt = hd ? _mdFmtDb(levels[i], true) : "—";
      const resTxt = hd ? _mdFmtDb(elRes[i], false) : "—";
      const stTxt = elSt[i] ? (t("stat_" + elSt[i]) || elSt[i]) : "";
      const noteTxt = elNt[i] ? ` (${_mdEsc(elNt[i])})` : "";
      lines.push(`| ${elTxt} | ${hzTxt} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} |`);
    }
    return lines.join("\n") + "\n";
  });
}

function _mdSchieberTable(side) {
  return withSide(side, () => {
    if (!manualLevels || !manualLevels.some((v) => v !== 0)) return "";
    const lines = [];
    lines.push(`#### ${t("archivSecSchieber")}`);
    lines.push("");
    // Modus: relativ vs. absolut hängt am globalen lvTabMode
    const absMode = (lvTabMode === "abs"
                     && typeof lvTabAbsoluteAvailable === "function"
                     && lvTabAbsoluteAvailable());
    if (absMode) {
      const unit = (typeof lvUnitLabelFor === "function") ? lvUnitLabelFor(mfr) : "";
      lines.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} | ${unit} |`);
      lines.push("|---|---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const v = manualLevels[i] || 0;
        const elTxt = `${dENPrefix()}${dEN(i)}`;
        const hzTxt = _mdFmtHz(effFreq(i));
        const relTxt = _mdFmtDb(v, true);
        // Absolutwert via Hersteller-spezifischer Funktion, sofern verfügbar.
        // calc* liefert {delta, absolute} — delta ist Δ in Hersteller-Einheit.
        let absTxt = "—";
        const impl = sideData[side].implant || {};
        const mcl = impl.mcl && impl.mcl[i];
        const thr = impl.thr && impl.thr[i];
        let res = null;
        if (mfr === "medel" && typeof calcMedel === "function" && mcl != null) {
          res = calcMedel(v, mcl);
        } else if (mfr === "cochlear" && typeof calcCochlear === "function" && mcl != null) {
          res = calcCochlear(v, mcl, impl.generation);
        } else if (mfr === "ab" && typeof calcAB === "function" && mcl != null && thr != null) {
          res = calcAB(v, mcl, thr, impl.idr);
        }
        if (res && res.delta != null && isFinite(res.delta)) {
          const sign = res.delta >= 0 ? "+" : "";
          absTxt = `${sign}${res.delta.toFixed(1)}`;
        }
        lines.push(`| ${elTxt} | ${hzTxt} | ${relTxt} | ${absTxt} |`);
      }
    } else {
      lines.push(`| ${t("thEl")} | ${t("thHz")} | ${t("archivColRel")} |`);
      lines.push("|---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const v = manualLevels[i] || 0;
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${_mdFmtHz(effFreq(i))} | ${_mdFmtDb(v, true)} |`);
      }
    }
    return lines.join("\n") + "\n";
  });
}

function _mdKurvenList(side) {
  return withSide(side, () => {
    if (!presets || presets.length === 0) return "";
    const active = presets.filter((p) => p.on && p.strength !== 0);
    if (active.length === 0) return "";
    const lines = [];
    lines.push(`#### ${t("archivSecKurven")}`);
    lines.push("");
    for (const p of active) {
      const name = t("PR_" + p.type) || p.type;
      const parts = [];
      parts.push(`${t("archivKurvStrength")}: ${(p.strength >= 0 ? "+" : "") + p.strength} dB`);
      if (p.center !== undefined)
        parts.push(`${t("archivKurvCenter")}: E${dEN(Math.round(p.center))}`);
      if (p.width !== undefined)
        parts.push(`${t("archivKurvWidth")}: ${p.width}`);
      if (p.cutoff !== undefined)
        parts.push(`${t("archivKurvCutoff")}: E${dEN(p.cutoff)}`);
      lines.push(`- **${name}** — ${parts.join(", ")}`);
    }
    return lines.join("\n") + "\n";
  });
}

function _mdFreqMatchTable(side) {
  if (typeof fRes === "undefined" || fRes.length === 0) return "";
  const own = fRes.filter((r) => r.varSide === side);
  if (own.length === 0) return "";
  const lines = [];
  lines.push(`#### ${t("fmResultsTitle")}`);
  lines.push("");
  lines.push(`| ${t("fmResColEl")} | ${t("fmResColVarFreq")} | ${t("fmResColRefFreq")} | ${t("fmResColCent")} |`);
  lines.push("|---|---|---|---|");
  for (const r of own) {
    const elTxt = withSide(side, () => `${dENPrefix()}${dEN(r.elIdx)}`);
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    const centStr = `${cent >= 0 ? "+" : ""}${Math.round(cent)} ¢`;
    lines.push(`| ${elTxt} | ${_mdFmtHz(r.varFreq)} | ${_mdFmtHz(r.refFreq)} | ${centStr} |`);
  }
  return lines.join("\n") + "\n";
}

function _mdSideSection(side) {
  const sideName = side === "left" ? t("sideLeft") : t("sideRight");
  const lines = [`\n## ${sideName}\n`];
  const meas = _mdMeasTable(side);
  const sch  = _mdSchieberTable(side);
  const kurv = _mdKurvenList(side);
  const fm   = _mdFreqMatchTable(side);
  if (!meas && !sch && !kurv && !fm) {
    lines.push(`_${t("archivSideEmpty")}_\n`);
    return lines.join("\n");
  }
  if (meas) lines.push(meas);
  if (sch)  lines.push(sch);
  if (kurv) lines.push(kurv);
  if (fm)   lines.push(fm);
  return lines.join("\n");
}

// ----------------------------------------------------------------
// Sektion: Bilateral (Stereo-Balance + Latenz)
// ----------------------------------------------------------------

function _mdBilateralBlock() {
  const out = [];
  // Stereo-Balance
  if (typeof lrResults !== "undefined") {
    const keys = Object.keys(lrResults).filter((k) => isFinite(lrResults[k]));
    if (keys.length > 0) {
      out.push(`\n## ${t("archivSecBilateral")}\n`);
      out.push(`### ${t("balTitle")}`);
      out.push("");
      out.push(`| ${t("thEl")} | ${t("archivBalOffset")} |`);
      out.push("|---|---|");
      for (const k of keys.sort((a, b) => (+a) - (+b))) {
        out.push(`| E${k} | ${_mdFmtDb(lrResults[k], true)} |`);
      }
      const mean = keys.reduce((a, b) => a + lrResults[b], 0) / keys.length;
      out.push("");
      out.push(`**${t("archivBalMean")}**: ${_mdFmtDb(mean, true)}`);
      out.push("");
    }
  }
  // Latenz
  if (typeof latencyResult !== "undefined" && latencyResult && isFinite(latencyResult.valueMs)) {
    if (out.length === 0) out.push(`\n## ${t("archivSecBilateral")}\n`);
    out.push(`### ${t("latResTitle") || "Inter-Ohr-Latenz"}`);
    const ms = latencyResult.valueMs;
    const sideTxt = ms >= 0 ? t("sideRight") : t("sideLeft");
    out.push(`- ${t("archivLatValue")}: ${Math.abs(ms).toFixed(2)} ms (${sideTxt})`);
    out.push(`- ${t("archivLatClick")}: ${latencyResult.clickType || "—"}`);
    out.push(`- ${t("archivLatInterval")}: ${latencyResult.intervalMs || "—"} ms`);
    out.push("");
  }
  return out.join("\n");
}

// ----------------------------------------------------------------
// Sektion: Player
// ----------------------------------------------------------------

function _mdPlayerBlock() {
  const lines = [`\n## ${t("archivSecPlayer")}\n`];
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  lines.push(`- ${t("archivPlSide")}: ${_mdBilateralLabel()}`);
  lines.push(`- ${t("archivPlEqOn")}: ${plEqOn ? t("on") : t("off")}`);
  const str = document.getElementById("plStr");
  if (str) lines.push(`- ${t("archivPlStrength")}: ${str.value} %`);
  const nh = document.getElementById("plNHSim");
  if (nh) lines.push(`- ${t("archivPlNH")}: ${nh.checked ? t("on") : t("off")}`);
  lines.push(`- ${t("archivPlSrc")}: ${t("archivSrcMeas")} ${plSrcMeas ? "✓" : "✗"} · ${t("archivSrcLevels")} ${plSrcLevels ? "✓" : "✗"} · ${t("archivSrcCurves")} ${plSrcCurves ? "✓" : "✗"}`);
  if (typeof plApplyBalance !== "undefined") {
    const bm = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
    const bmTxt = t("plBalMode" + bm.charAt(0).toUpperCase() + bm.slice(1)) || bm;
    lines.push(`- ${t("archivPlBalance")}: ${plApplyBalance ? t("on") : t("off")}${plApplyBalance ? " (" + bmTxt + ")" : ""}`);
  }
  if (typeof plApplyLatency !== "undefined") {
    lines.push(`- ${t("archivPlLatency")}: ${plApplyLatency ? t("on") : t("off")}`);
  }
  if (typeof pMaplawOn !== "undefined") {
    lines.push(`- ${t("archivPlMaplaw")}: ${pMaplawOn ? t("on") : t("off")}${pMaplawOn ? " (Soll-c=" + pMaplawSollC + ")" : ""}`);
  }
  if (typeof pWarpOn !== "undefined") {
    const modeKey = pWarpMode === "ref_side" ? "pwModeRef"
                  : pWarpMode === "var_side" ? "pwModeVar" : "pwModeSym";
    lines.push(`- ${t("archivPlWarp")}: ${pWarpOn ? t("on") : t("off")}${pWarpOn ? " (" + t(modeKey) + ", " + pWarpStrength + "%)" : ""}`);
  }
  return lines.join("\n") + "\n";
}

// ----------------------------------------------------------------
// Haupt-Generator: Modus A
// ----------------------------------------------------------------

function buildArchivMarkdown() {
  const parts = [];
  parts.push(_mdArchivHeader());
  parts.push(_mdConfigBlock());
  parts.push(_mdTestSettings());
  for (const side of SIDES) {
    parts.push(_mdSideSection(side));
  }
  parts.push(_mdBilateralBlock());
  parts.push(_mdPlayerBlock());
  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
```

**Sonnet — wichtige Hinweise zur Implementierung dieser Datei**:

1. **Alle Helfer mit Unterstrich-Präfix** (`_md…`) sind modul-intern.
2. Der Generator stützt sich auf folgende **globale Funktionen,
   die existieren müssen**: `withSide`, `compWLS`, `dEN`, `dENPrefix`,
   `effFreq`, `t`, `actEl`, `MFR`, `SIDES`, `sideData`, `lvTabMode`,
   `lvTabAbsoluteAvailable`, `lvUnitLabelFor`, `calcMedel`,
   `calcCochlear`, `calcAB`. Wenn beim Test einer fehlt: lies in
   `CODESTRUKTUR.md` nach, in welchem Modul sie deklariert ist, und
   stelle sicher, daß `print-md.js` **nach** diesem Modul geladen
   wird.
3. **Hersteller-Einheit im Absolutmodus** wird über
   `lvUnitLabelFor(mfr)` als Spalten-Überschrift gesetzt
   (z.B. „qu" / „CL" / „CU"). Die konkrete Berechnung des Δ-Werts
   nutzt `calcMedel`/`calcCochlear`/`calcAB`, indem aus dem
   MCL-Wert plus dB-Korrektur der absolute Wert berechnet wird und
   davon der MCL abgezogen wird, um Δ als Hersteller-Einheit zu
   bekommen.
4. **`lrResults`-Schlüssel** sind Strings (Elektroden-Indices als
   `"0"`, `"1"`, …). Beim Sortieren mit `(+a) - (+b)` numerisch
   sortieren.
5. **Frequenzabgleich**: `fRes` enthält Einträge mit `varSide`.
   Nur die Einträge der jeweiligen Seite gehören in den Side-Block.

---

## Schritt 3 — Loader-Eintrag in `index.html`

Im Inline-Loader im `<head>` von `index.html`, im Skript-Array,
`"print-md.js"` **nach** `"print.js"` und **vor** `"tab-print.js"`
einfügen. Falls `tab-print.js` direkt nach `print.js` steht, dann
`"print-md.js"` zwischen die beiden setzen.

---

## Schritt 4 — HTML: Archiv-Karte umbauen

In `index.html`, **kompletter Ersatz** des `panel-file`-Blocks
(Z. 1417–1472). Die EasyEffects-Karte bleibt am Ende erhalten,
ein **Platzhalter** für die Audiologen-Karte (Bauanleitung 39)
wird mit `display: none` eingefügt:

```html
      <!-- ===== FILE ===== -->
      <div id="panel-file" class="panel">
        <div class="card" id="cardArchiv">
          <h2 data-t="archivTitle"></h2>
          <p
            style="
              font-size: 0.84em;
              color: var(--text-muted);
              margin-bottom: 14px;
            "
            data-t="archivDesc"
          ></p>
          <div class="btn-group" style="margin-bottom: 16px">
            <button class="btn" id="fLoadBtn">
              &#128194; <span data-t="fLoad"></span>
            </button>
            <button class="btn" id="fSaveBtn">
              &#128190; <span data-t="fSave"></span>
            </button>
            <button class="btn" id="fPrintBtn">
              &#128424; <span data-t="archivPrint"></span>
            </button>
            <button class="btn" id="fArchivCopyBtn">
              &#128203; <span data-t="archivCopyMd"></span>
            </button>
            <button class="btn" id="fArchivMdBtn">
              &#11015; <span data-t="archivDownloadMd"></span>
            </button>
          </div>
          <input type="file" id="fInput" accept=".json" class="hidden" />
          <div class="explain" data-t="archivExplain"></div>
          <button
            class="btn"
            id="fResetBtn"
            style="color: var(--danger); margin-top: 16px"
          >
            🔄 <span data-t="fResetAll"></span>
          </button>
        </div>
        <!-- Audiologen-Karte: Platzhalter, befüllt in Bauanleitung 39 -->
        <div class="card" id="cardAudiolog" style="display:none"></div>
        <div class="card">
          <h2>EasyEffects Export</h2>
          <p
            style="
              font-size: 0.84em;
              color: var(--text-muted);
              margin-bottom: 10px;
            "
            data-t="eeDesc"
          ></p>
          <div
            class="explain explain-warn"
            style="margin-bottom: 10px"
            data-t="eePlayerHint"
          ></div>
          <button class="btn" id="eeExportBtn">
            &#128190; <span data-t="eeExport"></span>
          </button>
          <div class="explain" style="margin-top: 10px" data-t="eeHowTo"></div>
        </div>
      </div>
```

Geändert gegenüber vorher:
- `fileTitle` → `archivTitle`, `fileDesc` → `archivDesc`, `fPrint` →
  `archivPrint`, `fExplain` → `archivExplain`
- `fCopyBtn` **gelöscht** (alter „Tabelle kopieren"-Knopf)
- Neue Buttons `fArchivCopyBtn` und `fArchivMdBtn`
- Platzhalter-Karte `cardAudiolog` zwischen Archiv und EasyEffects

---

## Schritt 5 — Listener in `init.js`

### 5a. Alten `fCopyBtn`-Listener entfernen

In `init.js`, Z. 688 **löschen**:

```js
  document.getElementById("fCopyBtn").addEventListener("click", copyRes);
```

### 5b. Neue Listener registrieren

In `init.js`, **direkt nach** der Zeile aus 5a (an deren Stelle),
folgende zwei Listener einfügen:

```js
  document.getElementById("fArchivCopyBtn").addEventListener("click", () => {
    mdCopyToClipboard(buildArchivMarkdown());
  });
  document.getElementById("fArchivMdBtn").addEventListener("click", () => {
    mdDownload(buildArchivMarkdown(), mdArchivFilename());
  });
```

### 5c. Bestehender `fPrintBtn`-Handler

**Unverändert lassen**. Der DOM-basierte Druck-Pfad (Z. 176–687) gibt
weiterhin den vollständigen Bericht mit Grafiken aus — das ist das
Druck-Verhalten für Modus A.

---

## Schritt 6 — `file.js` aufräumen

In `file.js` die nicht mehr benötigten Funktionen entfernen:

- `expText` (Z. 4–82) — **vollständig löschen**.
- `copyRes` (Z. 83–96) — **vollständig löschen**.

`exportEasyEffects` und alle anderen Funktionen bleiben.

---

## Schritt 7 — i18n-Strings (alle vier Sprachen)

In `i18n.js` in **allen vier Sprachblöcken** die alten Keys
`fileTitle`, `fileDesc`, `fPrint`, `fCopy`, `fExplain` durch die
neuen Keys ersetzen bzw. ergänzen. Bestehende Keys werden so neu
verwendet:

- `fileTitle` → entfernen, ersetzt durch `archivTitle`
- `fileDesc`  → entfernen, ersetzt durch `archivDesc`
- `fPrint`    → entfernen, ersetzt durch `archivPrint`
- `fCopy`     → entfernen (Knopf entfällt)
- `fExplain`  → entfernen, ersetzt durch `archivExplain`

**Deutscher Block** (im Bereich der bisherigen `file…`-Keys):

```js
    archivTitle: "Archiv — Datensicherung des Tools",
    archivDesc: "Speichert oder lädt den vollständigen Tool-Zustand als JSON. Zusätzlich Druck, Markdown-Export und Markdown-Kopieren für menschenlesbare Berichte.",
    archivPrint: "Bericht drucken",
    archivCopyMd: "Markdown kopieren",
    archivDownloadMd: "Markdown herunterladen",
    archivExplain: "Die Einstellungen im Player werden beim Ausdruck berücksichtigt. Der Ausdruck gibt das wieder, was Sie im Player hören und als Equalizer-Kurve sehen.",
    archivHeaderDate: "Datum",
    archivHeaderVersion: "Tool-Version",
    archivHeaderLang: "Sprache",
    archivSecConfig: "Konfiguration",
    archivSecTest: "Test-Einstellungen",
    archivSecMeas: "Messungen",
    archivSecSchieber: "Schieber",
    archivSecKurven: "Kurven",
    archivSecBilateral: "Bilateral",
    archivSecPlayer: "Player",
    archivCfgConfig: "Konfiguration",
    archivCfgMfr: "Hersteller",
    archivCfgN: "Elektrodenzahl",
    archivCfgModel: "Implantat",
    archivCfgProcessor: "Audio-Prozessor",
    archivCfgCValue: "MAPLAW Ist-c",
    archivCfgStrategy: "Kodierungsstrategie",
    archivCfgDefMfr: "Default-Frequenzraster",
    archivTestSeq: "Sequenz",
    archivColRel: "Δ relativ",
    archivKurvStrength: "Stärke",
    archivKurvCenter: "Center",
    archivKurvWidth: "Breite",
    archivKurvCutoff: "Cutoff",
    archivBalOffset: "Offset (dB)",
    archivBalMean: "Mittelwert",
    archivLatValue: "Wert",
    archivLatClick: "Click-Typ",
    archivLatInterval: "Intervall",
    archivPlSide: "Side-Modus",
    archivPlEqOn: "EQ aktiv",
    archivPlStrength: "EQ-Stärke",
    archivPlNH: "NH-Simulation",
    archivPlSrc: "Quellen",
    archivSrcMeas: "Messung",
    archivSrcLevels: "Schieber",
    archivSrcCurves: "Kurven",
    archivPlBalance: "Stereo-Balance",
    archivPlLatency: "Latenzausgleich",
    archivPlMaplaw: "MAPLAW-Simulation",
    archivPlWarp: "Frequenz-Warping",
    archivSideEmpty: "Keine Daten",
    sideBoth: "beide Seiten",
    sideMono: "beide Seiten (Mono-EQ)",
    on: "ein",
    off: "aus",
```

**Englischer Block**:

```js
    archivTitle: "Archive — full tool snapshot",
    archivDesc: "Save or load the complete tool state as JSON. Additionally, print, Markdown export and Markdown copy for human-readable reports.",
    archivPrint: "Print report",
    archivCopyMd: "Copy Markdown",
    archivDownloadMd: "Download Markdown",
    archivExplain: "Player settings are reflected in the printout. The print shows what you hear in the player and see as equalizer curve.",
    archivHeaderDate: "Date",
    archivHeaderVersion: "Tool version",
    archivHeaderLang: "Language",
    archivSecConfig: "Configuration",
    archivSecTest: "Test settings",
    archivSecMeas: "Measurements",
    archivSecSchieber: "Sliders",
    archivSecKurven: "Curves",
    archivSecBilateral: "Bilateral",
    archivSecPlayer: "Player",
    archivCfgConfig: "Configuration",
    archivCfgMfr: "Manufacturer",
    archivCfgN: "Electrodes",
    archivCfgModel: "Implant",
    archivCfgProcessor: "Audio processor",
    archivCfgCValue: "MAPLAW c (actual)",
    archivCfgStrategy: "Coding strategy",
    archivCfgDefMfr: "Default frequency map",
    archivTestSeq: "Sequence",
    archivColRel: "Δ relative",
    archivKurvStrength: "Strength",
    archivKurvCenter: "Center",
    archivKurvWidth: "Width",
    archivKurvCutoff: "Cutoff",
    archivBalOffset: "Offset (dB)",
    archivBalMean: "Mean",
    archivLatValue: "Value",
    archivLatClick: "Click type",
    archivLatInterval: "Interval",
    archivPlSide: "Side mode",
    archivPlEqOn: "EQ on",
    archivPlStrength: "EQ strength",
    archivPlNH: "NH simulation",
    archivPlSrc: "Sources",
    archivSrcMeas: "Measurement",
    archivSrcLevels: "Sliders",
    archivSrcCurves: "Curves",
    archivPlBalance: "Stereo balance",
    archivPlLatency: "Latency compensation",
    archivPlMaplaw: "MAPLAW simulation",
    archivPlWarp: "Frequency warping",
    archivSideEmpty: "No data",
    sideBoth: "both sides",
    sideMono: "both sides (mono EQ)",
    on: "on",
    off: "off",
```

**Französischer Block** und **Spanischer Block**: analog mit
sinnvollen Übersetzungen aller obigen Keys. Sonnet darf, wo
Standard-Begriffe (z.B. „Print", „Copy", „Download") bereits in
anderen Keys des Files vorkommen, die dortige Wortwahl
übernehmen.

Die alten Keys `fileTitle`, `fileDesc`, `fPrint`, `fCopy`,
`fExplain` aus allen vier Blöcken **entfernen** (oder leer
lassen — sauberer ist entfernen).

---

## Schritt 8 — `CODESTRUKTUR.md` aktualisieren

### 8a. Modul-Tabelle

Neuen Eintrag in der Tabelle einfügen, nach Zeile für `print.js`
(„12b") und vor `tab-print.js` („12c"):

```
| 12d | print-md.js | Markdown-Generatoren für die Archiv-Box (Modus A) und Audiologen-Box (Modus B — Bauanleitung 39). `buildArchivMarkdown`, `mdCopyToClipboard`, `mdDownload`, `mdArchivFilename`, `mdDateStampFile`, diverse `_md*`-Helfer (Header, Konfig, pro-Seite-Tabellen, Bilateral, Player). Lädt zwischen `print.js` und `tab-print.js`. |
```

### 8b. Edit-Szenarien

Im Block „Edit-Szenarien" am Ende einen neuen Eintrag:

```
### Markdown-Generator erweitern oder anpassen
- `print-md.js`: Sektion-Helfer (`_md…`) ergänzen, im Haupt-
  Generator `buildArchivMarkdown` einbinden.
- `i18n.js`: neue `archiv…`-Keys in allen vier Sprachen.
- Bei Verweis auf neue Tool-State-Variablen: deren Modul muß
  **vor** `print-md.js` im Loader stehen.
```

### 8c. Datenfluss-Block (kurzer Absatz am Ende)

```
**Markdown-Export (Archiv-Box):** `buildArchivMarkdown` in
print-md.js liest direkt aus den globalen State-Variablen
(`sideData`, `lrResults`, `latencyResult`, `fRes`,
`plApplyBalance`/`Latency`, `plBalanceMode`, `pMaplawOn`/`SollC`,
`pWarpOn`/`Mode`/`Strength`) und liefert einen vollständigen
Markdown-Bericht. Pro Seite wird `withSide(side, fn)` benutzt, um
die seiten-spezifische Live-View korrekt zu binden. Die drei
Aktionen Drucken/Kopieren/Download sitzen in der Archiv-Karte
(`#cardArchiv`). Der Druck-Pfad nutzt weiterhin den bestehenden
`fPrintBtn`-Handler in init.js (DOM-basiert, mit Grafiken).
```

---

## Schritt 9 — `SPEC.md` aktualisieren

Im „Drucken"-Abschnitt einen neuen Unterabschnitt einfügen:

```
### Archiv-Box im Tab Laden/Speichern

Die ehemalige Karte „Laden / Speichern" heißt nun „Archiv —
Datensicherung des Tools" und bietet fünf Aktionen: JSON laden,
JSON speichern, Bericht drucken, Markdown kopieren, Markdown
herunterladen.

Markdown-Bericht: vollständige Tool-Sicht in einer festen Markdown-
Struktur (Konfiguration pro Seite, Test-Einstellungen, pro Seite
Messungen / Schieber / Kurven / Frequenzabgleich, bilaterale Daten,
Player-Konfiguration). Leere Sektionen werden weggelassen. Der
Bericht ist sprach-aktuell — der Sprachwechsel im Tool wechselt
auch die Markdown-Sprache.

Druck-Pfad: unverändert (DOM-basiert mit Grafiken, durch
`fPrintBtn`-Handler in init.js).

Dateinamen: `ci-sound-balancing-<datum>-<zeit>.json` (JSON) und
`ci-sound-balancing-archiv-<datum>-<zeit>.md` (Markdown).
EasyEffects-Export: `ci-sound-balancing-easyeffects.json`.
```

---

## Nicht zu tun

- Den `fPrintBtn`-Handler in init.js (Z. 176–687) NICHT anfassen.
- Keinen Druck-Pfad in `print-md.js` einbauen — Druck bleibt
  DOM-basiert.
- Die EasyEffects-Karte NICHT verändern (außer dem Dateinamen
  in 1b).
- Das Side-Wahl-Modal `loadSideOverlay` NICHT anfassen.
- KEINE bestehende Datenstruktur in JSON umbenennen — nur
  Dateinamen.
- Keine neuen Felder ins JSON-Save schreiben, die nicht in
  Bauanleitung 37 bereits eingeführt sind.

---

## Akzeptanztest

Vorbereitung: ein Datensatz mit Messungen auf beiden Seiten,
Stereo-Balance-Ergebnissen, ggf. Latenzwert. Browser geöffnet.

1. **Speichern**: Tab Laden/Speichern → „Speichern" klicken.
   - Erwartet: Datei heißt `ci-sound-balancing-<datum>-<zeit>.json`
     (keine `v…`-Versionsnummer mehr).

2. **EasyEffects-Export**: Tab Laden/Speichern → „EasyEffects-
   Preset exportieren".
   - Erwartet: Dateiname `ci-sound-balancing-easyeffects.json`.

3. **Markdown kopieren**: Tab Laden/Speichern → „Markdown
   kopieren".
   - Erwartet: Bestätigungs-Alert.
   - Erwartet: Inhalt im Clipboard (z.B. in einen Editor einfügen)
     ist ein vollständiger Markdown-Bericht mit `# CI Sound
     Balancing — Archiv`, Datum, Version, beiden Seiten,
     Bilateral-Block, Player-Block.

4. **Markdown herunterladen**: „Markdown herunterladen" klicken.
   - Erwartet: Datei heißt `ci-sound-balancing-archiv-<datum>-
     <zeit>.md`.
   - Erwartet: Inhalt identisch zur Kopier-Aktion.

5. **Druck**: „Bericht drucken" klicken.
   - Erwartet: Wie bisher das volle Druck-Layout mit Grafiken
     (Mess-Chart, Kurven-Chart, Schieber-Bild) für beide Seiten.
     **Keine Regression**.

6. **Sprache wechseln**: Sprache auf EN/FR/ES umstellen, dann
   „Markdown kopieren".
   - Erwartet: Sektionen und Beschriftungen in der gewählten
     Sprache.

7. **Schieber-Tab Absolutmodus**: im Schieber-Tab auf „absolut"
   stellen, dann Markdown kopieren.
   - Erwartet: Im jeweiligen Seiten-Block hat die Schieber-Tabelle
     drei Spalten (E, Hz, Δ relativ, qu/CL/CU); die letzte Spalte
     enthält absolute Werte, wo MCL vorhanden ist, sonst „—".

8. **Leere Daten**: Reset → kein bRes / lrResults / latencyResult /
   fRes → Markdown kopieren.
   - Erwartet: Bericht enthält Header, Konfig, Test-Einstellungen,
     Player-Block. Side-Sektionen enthalten den Text „Keine Daten".
     Bilateral-Block fehlt.

9. **Side-Wechsel während Markdown-Erzeugung**: nach Erzeugung
   eines Berichts in Side „links" das Side-Button auf „rechts"
   klicken, dann erneut Markdown kopieren.
   - Erwartet: Beide Side-Sektionen unverändert vollständig
     (`withSide` koppelt sauber ab).

10. **Reset**: „Alles zurücksetzen" funktioniert wie bisher;
    Bericht nach Reset enthält Defaults.

11. **Bestehende JSON laden**: eine alte Datei mit Namen
    `loudness-balancing-v3.36-2026-05-15-1200.json` laden.
    - Erwartet: lädt sauber, kein Dateinamen-Check.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen
und in dieser Tabelle eintragen:

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `file.js` Z. 246: JSON-Dateiname `ci-sound-balancing-<datum>-<zeit>.json` | | |
| `file.js` Z. 619: EasyEffects-Dateiname `ci-sound-balancing-easyeffects.json` | | |
| `file.js`: `expText`/`copyRes` entfernt | | |
| Neue Datei `print-md.js` mit allen Generatoren und Helfern | | |
| `print-md.js` im Loader von `index.html` zwischen `print.js` und `tab-print.js` | | |
| HTML `panel-file` reorganisiert (Archiv-Karte mit neuen Buttons, Audiolog-Platzhalter, EasyEffects unverändert) | | |
| `fCopyBtn` aus HTML entfernt | | |
| `fArchivCopyBtn` und `fArchivMdBtn` neu im HTML | | |
| Listener für die zwei neuen Buttons in init.js | | |
| Alter `fCopyBtn`-Listener in init.js entfernt | | |
| Bestehender `fPrintBtn`-Handler in init.js unverändert | | |
| i18n-Strings in DE, EN, FR, ES vollständig (alle `archiv…`-Keys + `sideBoth`, `sideMono`, `on`, `off`) | | |
| Alte Keys `fileTitle`/`fileDesc`/`fPrint`/`fCopy`/`fExplain` in allen vier Sprachen entfernt | | |
| CODESTRUKTUR.md: Modul-Tabelle, Edit-Szenarien, Datenfluss-Absatz aktualisiert | | |
| SPEC.md: Archiv-Box-Absatz im Drucken-Block | | |
| Markdown-Bericht enthält Header, Konfig, Test, beide Seiten, Bilateral, Player | | |
| Schieber-Tab im Absolutmodus liefert die Hersteller-Einheit-Spalte im Markdown | | |
| Druck-Pfad gibt unverändert das gewohnte DOM-Layout mit Grafiken aus | | |

Bei „Unklar"-Punkten dem Nutzer eine konkrete Rückfrage stellen,
bevor du weiterläufst.
