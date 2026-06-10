# Bauanleitung 42: Audiologen-Bericht — Inhalt und Aufbau überarbeiten

Setzt Bauanleitungen 39 (Audiologen-Box, Generator
`buildAudiologMarkdown` in `print-md.js`) und 41 (Druck mit Grafiken)
voraus. Diese Anleitung **ersetzt** den bestehenden Markdown- und
Druck-Output der Audiologen-Box komplett, ergänzt ein Notiz-Eingabefeld
in der Karte „Einstellungswünsche" und führt zwei statt einer Tabelle
pro Seite ein.

Berührt: `print-md.js`, `index.html`, `i18n.js`, `init.js`, `file.js`,
`CODESTRUKTUR.md`, `SPEC.md`.

**Wichtig — Terminologie:** Im Code heißt der Schieber-Tab historisch
„Presets" (`presets`, `getTotalPresetCurve`). **In allen nutzersichtbaren
Texten** (i18n, Markdown, HTML, Anleitungs-Beispiele) **„Schieber"
verwenden, nie „Presets"**.

## Ziel

Der bestehende Bericht (heutige `_audiologSideTable` mit nur Δ-Werten
und kompakter Vermerk-Block) wird ersetzt durch einen erweiterten
Bericht für den Audiologen:

1. Kopf mit Datum, Tool-Version, gewählter Seite(n)
2. **Optionale Patient-Notiz**, falls ausgefüllt
3. **Pro Seite (LINKS, dann RECHTS)**:
   - Sub-Kopf mit Seite, Hersteller, Prozessor, Implantat-Modell
   - Equalizer-Bar-Chart **mit Residuum-Fehlerbalken**
   - **Tabelle 1: Lautstärken-Änderung** mit allen Elektroden, Hz,
     Δ dB, Residuum, MCL/Δ MCL/Neuer Wert (qu/CL/CU), Status, Notiz
   - Tabelle-Legende (1–2 Sätze)
   - MAPLAW-Mini-Tabelle (wenn MED-EL und aktiv)
4. **Frequenz-Sektion** (nur wenn Warp aktiv):
   - **Tabelle 2: Frequenz-Änderung** pro Seite (Δ cent, alte Hz,
     neue Hz). Bei sym-Warp + einseitigem Druck: Zusatzspalten für
     die andere Seite, deutlich abgesetzt
5. Stereo-Balance (immer wenn gemessen, **auch bei einseitigem Druck**)
   mit Eingerechnet-/Nicht-eingerechnet-Vermerk
6. Latenz (analog)
7. **Hinweis Testprogramm-Erkennung** (wenn Heuristik anschlägt)
8. **Hinweise für den Audiologen** (4 Bullets)
9. **Fehlende Implantat-Angaben** (wenn welche fehlen)
10. **Allgemeine Bitten** zur Standardabfrage
11. Footer mit Datum, Tool-Version, Seitenzahlen

Vermerk-Block (heute `_audiologNoteBlock`) entfällt vollständig —
seine Inhalte ziehen in die jeweils thematisch passende Sektion.

---

## Schritt 1 — Notiz-Eingabefeld in der Karte „Einstellungswünsche"

In `index.html`, in `<div class="card" id="cardAudiolog">` (heute
Z. 1436–1466), das `<ul>`-Hinweis-Element ersetzen durch das gleiche
`<ul>` **plus ein neues Notiz-Eingabefeld davor**, sodass der Block
aussieht:

```html
<div class="card" id="cardAudiolog">
  <h2 data-t="audiologTitle"></h2>
  <p style="font-size:0.84em;color:var(--text-muted);margin-bottom:8px;"
     data-t="audiologDesc"></p>

  <!-- NEU: Notiz-Eingabefeld -->
  <label for="audiologNoteInput"
         style="display:block;font-size:0.84em;color:var(--text-muted);
                margin-top:10px;margin-bottom:4px;"
         data-t="audiologNoteLabel"></label>
  <textarea id="audiologNoteInput" rows="3"
            style="width:100%;box-sizing:border-box;font-size:0.9em;
                   padding:6px;border:1px solid var(--border);
                   border-radius:4px;background:var(--surface);
                   color:var(--text);resize:vertical;"
            data-t-placeholder="audiologNotePlaceholder"></textarea>

  <ul style="font-size:0.82em;color:var(--text-muted);
             margin:10px 0 14px 18px;padding:0;">
    <li data-t="audiologHintSide"></li>
    <li data-t="audiologHintWarp"></li>
    <li data-t="audiologHintNote"></li>
  </ul>
  <div class="btn-group">
    <button class="btn" id="fAudiologPrintBtn">
      &#128424; <span data-t="audiologPrint"></span>
    </button>
    <button class="btn" id="fAudiologMdBtn">
      &#11015; <span data-t="audiologDownloadMd"></span>
    </button>
  </div>
</div>
```

**Wichtig:** Das `data-t-placeholder` Attribut nutzt eine konsistente
i18n-Konvention; falls noch nicht vorhanden, in `i18n.js` `applyLang()`
prüfen, ob `data-t-placeholder` bereits verarbeitet wird. Falls nein,
in `applyLang()` (i18n.js) den vorhandenen Loop ergänzen:

```js
// Bestehender Loop für data-t in applyLang() — danach ergänzen:
document.querySelectorAll('[data-t-placeholder]').forEach((el) => {
  const k = el.getAttribute('data-t-placeholder');
  if (k && t(k)) el.setAttribute('placeholder', t(k));
});
```

(Falls dieser Block schon existiert: nicht doppelt einfügen.)

---

## Schritt 2 — neue globale Variable + Listener

In `state-side.js`, **am Ende der globalen `let`-Liste** (heute Z. 8–19),
neue Variable anhängen — nicht in `sideData`, weil **top-level**, nicht
seiten-spezifisch:

```js
// NEU: Patient-Notiz für Audiologen-Bericht (top-level, beide Seiten)
let audiologUserNote = "";
```

In `init.js`, direkt nach dem `fAudiologMdBtn`-Listener (heute Z. 183–185),
folgenden Block einfügen:

```js
// Notiz-Eingabe → globale Variable
const audiologNoteEl = document.getElementById("audiologNoteInput");
if (audiologNoteEl) {
  audiologNoteEl.addEventListener("input", function () {
    audiologUserNote = this.value;
  });
}
```

---

## Schritt 3 — JSON-Persistenz für die Notiz

In `file.js`, `saveJson()` (heute Z. 50ff), im `d`-Objekt-Literal
**direkt vor der schließenden Klammer** des Top-level-Objekts (nach
`localCollections: …`, vor dem `};`) ein Feld ergänzen:

```js
    audiologUserNote: (typeof audiologUserNote !== "undefined") ? audiologUserNote : "",
```

In `file.js`, `applyLoadedData(d)` (heute Z. 313ff), **direkt vor dem
abschließenden Block** (vor `buildFreqTable(); renderResults();`)
einfügen:

```js
  // Audiologen-Notiz laden
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = (typeof d.audiologUserNote === "string") ? d.audiologUserNote : "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = audiologUserNote;
  }
```

In `file.js`, `resetAll()` (heute Z. 4ff), nach `defaultMfr = "medel";`
(heute Z. 24) ergänzen:

```js
  if (typeof audiologUserNote !== "undefined") {
    audiologUserNote = "";
    const aNoteEl = document.getElementById("audiologNoteInput");
    if (aNoteEl) aNoteEl.value = "";
  }
```

---

## Schritt 4 — Modus-B-Block in `print-md.js` komplett ersetzen

In `print-md.js`, **alles** ab dem Marker

```js
// ============================================================
// MODUS B — AUDIOLOGEN-AUFTRAG
// ============================================================
```

(heute Z. 643) bis **Dateiende** (heute Z. 1009)
**vollständig löschen und ersetzen** durch den folgenden Block.

> **Hinweis:** Der Block enthält intern den schon bestehenden
> Helper `_mdToHtmlBasic` (war bisher in MODUS B unten). Er wird hier
> mit übernommen und um Tabellen-Klassen erweitert.

```js
// ============================================================
// MODUS B — AUDIOLOGEN-AUFTRAG
// ============================================================
// Berichts-Aufbau: siehe Bauanleitung 42.
// Hauptgenerator: buildAudiologMarkdown()
// Druck-Variante:  audiologPrint()
// Markdown-Export: mdAudiologFilename() + buildAudiologMarkdown()

// ---------- Side-Modus ----------

function mdAudiologFilename() {
  const side = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const sideTag = (side === "left")  ? "links"
                : (side === "right") ? "rechts"
                : "beide";
  return `ci-sound-balancing-audiologe-${mdDateStampFile()}-${sideTag}.md`;
}

function _audiologMainSides() {
  const m = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (m === "left")  return ["left"];
  if (m === "right") return ["right"];
  return ["left", "right"];
}

function _audiologSideLabel(side) {
  return side === "left" ? t("sideLeft") : t("sideRight");
}

// ---------- Gewinne pro Seite (ΔdB, EQ-Stärke-skaliert) ----------

function _audiologDbForSide(side) {
  return withSide(side, () => {
    const g = computeGains();
    const str = parseInt(document.getElementById("plStr").value) / 100;
    const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
    if (!eqOn) return g.map(() => 0);
    return g.map((v) => -v * str);
  });
}

// ---------- Residuum pro Elektrode (für Tabelle + Chart) ----------

function _audiologResForSide(side) {
  return withSide(side, () => {
    try {
      const { elRes } = compWLS();
      return Array.from(elRes || []);
    } catch (e) {
      return new Array(nEl).fill(0);
    }
  });
}

// ---------- Implantat-Werte: MCL → neuer Wert (qu/CL/CU) ----------

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
      return { mcl: mcl, delta: res.delta, newVal: mcl + res.delta, unit };
    }
    return { mcl: mcl, delta: null, newVal: null, unit };
  });
}

// ---------- Hilfsformatierer ----------

function _audDb(v) {
  if (!isFinite(v) || v == null) return "—";
  if (Math.abs(v) < 0.05) return "0.0 dB";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} dB`;
}
function _audUnit(v, unit) {
  if (!isFinite(v) || v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} ${unit}`;
}
function _audUnitAbs(v, unit) {
  if (!isFinite(v) || v == null) return "—";
  return `${v.toFixed(1)} ${unit}`;
}
function _audCent(varHz, refHz) {
  if (!isFinite(varHz) || !isFinite(refHz) || varHz <= 0 || refHz <= 0) return "—";
  const c = 1200 * Math.log2(refHz / varHz);
  return `${c >= 0 ? "+" : ""}${Math.round(c)} cent`;
}

function _audStatusText(side, i) {
  return withSide(side, () => {
    if (elExDur[i] !== null) return t("audStatExcluded");
    if (elSt[i] === "mute") return t("audStatMute");
    if (elSt[i]) {
      const lb = {
        noisyHeavy: t("stNoisyHeavy"),
        noisyMore:  t("stNoisyMore"),
        noisyLess:  t("stNoisyLess"),
        almostMute: t("stAlmMute"),
      };
      return lb[elSt[i]] || "";
    }
    return "";
  });
}

// ---------- Testprogramm-Heuristik ----------
// Erkennt: keine elektroden-spezifische Klangformung.
// Schieber (getTotalPresetCurve) + Kurven (manualLevels) werden mit
// EQ-Stärke skaliert; Mittelwert wird abgezogen (reine Pegelver-
// schiebung ist erlaubt); Standardabweichung über aktive Elektroden
// muß < 0.2 dB sein. Außerdem: EQ aktiv, NH-Sim aus.

function _audiologIsTestProgram(side) {
  const eqOn = (typeof plEqOn !== "undefined") ? plEqOn : true;
  if (!eqOn) return false;
  const nhSim = document.getElementById("plNHSim")?.checked;
  if (nhSim) return false;
  return withSide(side, () => {
    const str = parseInt(document.getElementById("plStr").value) / 100;
    const presetC = (typeof plSrcCurves !== "undefined" && plSrcCurves)
      ? getTotalPresetCurve() : new Array(nEl).fill(0);
    const lvls = (typeof plSrcLevels !== "undefined" && plSrcLevels)
      ? manualLevels.slice() : new Array(nEl).fill(0);
    const active = [];
    for (let i = 0; i < nEl; i++) {
      if (elSt[i] === "mute" || elExDur[i] !== null) continue;
      active.push(i);
    }
    if (active.length === 0) return false;
    const sums = active.map((i) => (presetC[i] + lvls[i]) * str);
    const mean = sums.reduce((a, b) => a + b, 0) / sums.length;
    const variance = sums.reduce((a, b) => a + (b - mean) ** 2, 0) / sums.length;
    const sd = Math.sqrt(variance);
    return sd < 0.2;
  });
}

// ---------- Lautstärken-Tabelle pro Seite ----------

function _audiologLoudnessTable(side) {
  return withSide(side, () => {
    const dBs = _audiologDbForSide(side);
    const resArr = _audiologResForSide(side);
    const unit = lvUnitLabelFor(mfr);
    const lines = [];
    lines.push(`| ${t("thEl")} | ${t("thHz")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("audColNote")} |`);
    lines.push("|---|---|---|---|---|---|---|---|---|");
    for (let i = 0; i < nEl; i++) {
      const dB = dBs[i] || 0;
      const r  = resArr[i] || 0;
      const abs = _audiologAbsDelta(side, i, dB);
      const status = _audStatusText(side, i);
      const note = (elNt && elNt[i]) ? elNt[i] : "";
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | ${_mdFmtHz(effFreq(i))} | ${_audDb(dB)} | ${r > 0 ? r.toFixed(1) + " dB" : "—"} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status || "—"} | ${note || "—"} |`
      );
    }
    return lines.join("\n");
  });
}

// ---------- Frequenz-Tabelle pro Seite (mit sym-Warp-Zusatzspalten) ----------

function _audiologFreqTable(side, mainSides) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  if (typeof fRes === "undefined" || fRes.length === 0) return "";

  const isSymSingle = (mainSides.length === 1
                      && typeof pWarpMode !== "undefined"
                      && pWarpMode === "sym");
  const own = fRes.filter((r) => r.varSide === side);
  if (own.length === 0 && !isSymSingle) return "";

  // Daten pro Elektrode der eigenen Seite einsammeln
  const ownByEl = {};
  for (const r of own) ownByEl[r.elIdx] = r;

  // Bei sym-Warp + einseitig: andere Seite zusätzlich erfassen
  let otherByEl = null;
  let otherSide = null;
  if (isSymSingle) {
    otherSide = side === "left" ? "right" : "left";
    const otherRows = fRes.filter((r) => r.varSide === otherSide);
    otherByEl = {};
    for (const r of otherRows) otherByEl[r.elIdx] = r;
  }

  return withSide(side, () => {
    const lines = [];
    if (isSymSingle && otherByEl && Object.keys(otherByEl).length > 0) {
      // Zusatzspalten — durch Doppel-Trennlinie optisch separiert
      const otherLbl = otherSide === "left" ? t("sideLeft") : t("sideRight");
      lines.push(`| ${t("thEl")} | ${t("audColHzOld")} | ${t("audColCent")} | ${t("audColHzNew")} || ${t("audColCent")} (${otherLbl}) | ${t("audColHzNew")} (${otherLbl}) |`);
      lines.push("|---|---|---|---||---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        const o = otherByEl[i];
        if (!r && !o) continue;
        const ownVar = r ? _mdFmtHz(r.varFreq) : "—";
        const ownCent = r ? _audCent(r.varFreq, r.refFreq) : "—";
        const ownNew  = r ? _mdFmtHz(r.refFreq) : "—";
        const othCent = o ? _audCent(o.varFreq, o.refFreq) : "—";
        const othNew  = o ? _mdFmtHz(o.refFreq) : "—";
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${ownVar} | ${ownCent} | ${ownNew} || ${othCent} | ${othNew} |`);
      }
    } else {
      lines.push(`| ${t("thEl")} | ${t("audColHzOld")} | ${t("audColCent")} | ${t("audColHzNew")} |`);
      lines.push("|---|---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        if (!r) continue;
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${_mdFmtHz(r.varFreq)} | ${_audCent(r.varFreq, r.refFreq)} | ${_mdFmtHz(r.refFreq)} |`);
      }
    }
    return lines.join("\n") + "\n";
  });
}

// ---------- MAPLAW (nur MED-EL) ----------

function _audiologMaplawForSide(side) {
  if (typeof pMaplawOn === "undefined" || !pMaplawOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const sd = sideData[side];
  if (!sd || sd.manufacturer !== "medel") return "";
  const sollC = (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : null;
  const istC = (sd.implant && sd.implant.cValue) ? sd.implant.cValue : null;
  if (istC == null || sollC == null || istC === sollC) return "";
  return `\n**${t("audiologSecMaplaw")}**: MAPLAW c **${istC} → ${sollC}**\n`;
}

// ---------- Stereo-Balance (immer wenn gemessen, auch einseitig) ----------

function _audiologBalanceBlock(mainSides) {
  if (typeof lrResults === "undefined") return "";
  const keys = Object.keys(lrResults).filter((k) => isFinite(lrResults[k]));
  if (keys.length === 0) return "";
  const mean = keys.reduce((a, k) => a + lrResults[k], 0) / keys.length;
  if (!isFinite(mean) || mean === 0) return "";

  const balActive = (typeof plApplyBalance !== "undefined") && plApplyBalance
                 && (mainSides.length === 2);
  const louderSide = mean > 0 ? t("sideRight") : t("sideLeft");
  const quieterSide = mean > 0 ? t("sideLeft")  : t("sideRight");

  const lines = [];
  lines.push(`## ${t("audiologSecBalance")}`);
  lines.push("");
  lines.push(`- ${t("audiologBalDiff")}: **${Math.abs(mean).toFixed(1)} dB**`);
  lines.push(`- ${t("audiologBalImpact")
    .replace("{louder}", louderSide)
    .replace("{quieter}", quieterSide)}`);
  lines.push(`- ${balActive ? t("audiologBalIncluded") : t("audiologBalNotIncluded")}`);
  lines.push("");
  return lines.join("\n");
}

// ---------- Latenz (immer wenn gemessen, auch einseitig) ----------

function _audiologLatencyBlock(mainSides) {
  if (typeof latencyResult === "undefined" || !latencyResult) return "";
  if (!isFinite(latencyResult.valueMs)) return "";
  const ms = latencyResult.valueMs;
  if (ms === 0) return "";
  const latActive = (typeof plApplyLatency !== "undefined") && plApplyLatency
                 && (mainSides.length === 2);
  // ms > 0 → rechts kommt später (siehe Latenz-Konvention)
  const earlierSide = ms >= 0 ? t("sideLeft")  : t("sideRight");
  const laterSide   = ms >= 0 ? t("sideRight") : t("sideLeft");
  const lines = [];
  lines.push(`## ${t("audiologSecLatency")}`);
  lines.push("");
  lines.push(`- ${t("audiologLatValue")}: **${Math.abs(ms).toFixed(2)} ms**`);
  lines.push(`- ${t("audiologLatImpact")
    .replace("{earlier}", earlierSide)
    .replace("{later}", laterSide)}`);
  lines.push(`- ${latActive ? t("audiologLatIncluded") : t("audiologLatNotIncluded")}`);
  lines.push("");
  return lines.join("\n");
}

// ---------- Testprogramm-Hinweis ----------

function _audiologTestProgramHint(mainSides) {
  let anyTP = false;
  for (const s of mainSides) if (_audiologIsTestProgram(s)) anyTP = true;
  if (!anyTP) return "";
  return `\n> ${t("audiologTestProgramHint")}\n\n`;
}

// ---------- Fehlende Implantat-Angaben pro Seite ----------

function _audiologMissingImplantData(mainSides) {
  const out = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    const impl = (sd && sd.implant) || {};
    const sideLbl = _audiologSideLabel(side);
    const missing = [];
    if (!impl.model)     missing.push(t("audMissImplantModel"));
    if (!impl.processor) missing.push(t("audMissProcessor"));
    const mclSet = (impl.mcl || []).some((v) => v != null && isFinite(v));
    if (!mclSet) missing.push(t("audMissMcl"));
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "cochlear" && !impl.iidr) missing.push(t("audMissIidr"));
    if (sd && sd.manufacturer === "ab" && !impl.idr) missing.push(t("audMissIdr"));
    if (missing.length > 0) {
      out.push(`- **${sideLbl}**: ${missing.join(", ")}`);
    }
  }
  if (out.length === 0) return "";
  const lines = [`## ${t("audiologSecMissing")}`, "", ...out, ""];
  return lines.join("\n");
}

// ---------- Hinweise für den Audiologen (4 Bullets) ----------

function _audiologAdvice() {
  const lines = [];
  lines.push(`## ${t("audiologSecAdvice")}`);
  lines.push("");
  lines.push(`- ${t("audiologAdvice1")}`);
  lines.push(`- ${t("audiologAdvice2")}`);
  lines.push(`- ${t("audiologAdvice3")}`);
  lines.push(`- ${t("audiologAdvice4")}`);
  lines.push("");
  return lines.join("\n");
}

// ---------- Allgemeine Bitten ----------

function _audiologGeneralRequests() {
  const lines = [];
  lines.push(`## ${t("audiologSecRequests")}`);
  lines.push("");
  lines.push(t("audiologRequestsBody"));
  lines.push("");
  return lines.join("\n");
}

// ---------- Letzte Messung pro Seite (max-Timestamp von jRes+bRes) ----------

function _audiologLastMeas(side) {
  const sd = sideData[side];
  if (!sd) return null;
  let max = 0;
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e && e.timestamp && e.timestamp > max) max = e.timestamp;
  };
  collect(sd.jRes); collect(sd.bRes);
  return max > 0 ? new Date(max) : null;
}

function _audiologDateStr(d) {
  if (!d) return "—";
  return d.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
}

// ---------- Konfig-Beschriftung pro Seite ----------

function _audiologConfigLabel(side) {
  const sd = sideData[side];
  const cfg = (sd && sd.config) || "ci";
  const key = "cfg_" + cfg;
  const tr = t(key);
  return (tr && tr !== key) ? tr : cfg;
}

// ---------- Haupt-Generator ----------

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

  // Kopf
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}`);
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`**${t("audiologToolVersion")}**: ${APP_VERSION}`);
  }
  parts.push("");

  // EQ aus → früher Hinweis
  if (typeof plEqOn !== "undefined" && !plEqOn) {
    parts.push(`> ${t("audiologEqOff")}\n`);
  }

  // Patient-Notiz
  const note = (typeof audiologUserNote === "string") ? audiologUserNote.trim() : "";
  if (note.length > 0) {
    parts.push(`## ${t("audiologSecUserNote")}\n`);
    parts.push(note);
    parts.push("");
  }

  // Pro Seite: Sub-Kopf + Loudness-Tabelle + Legende + MAPLAW
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd) continue;
    const impl = sd.implant || {};
    const sideLbl = _audiologSideLabel(side);
    const mfrLbl = (MFR[sd.manufacturer] && MFR[sd.manufacturer].name) || sd.manufacturer;
    const cfgLbl = _audiologConfigLabel(side);
    parts.push(`## ${sideLbl} — ${cfgLbl}`);
    parts.push("");
    const meta = [];
    meta.push(`${t("audiologMfr")}: ${mfrLbl}`);
    if (impl.processor) meta.push(`${t("audiologProcessor")}: ${impl.processor}`);
    if (impl.model)     meta.push(`${t("audiologImplant")}: ${impl.model}`);
    const lastM = _audiologLastMeas(side);
    if (lastM) meta.push(`${t("audiologLastMeas")}: ${_audiologDateStr(lastM)}`);
    parts.push(`_${meta.join(" · ")}_`);
    parts.push("");

    // Loudness-Tabelle
    parts.push(`### ${t("audiologSecLoudness")}`);
    parts.push("");
    parts.push(_audiologLoudnessTable(side));
    parts.push("");
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // MAPLAW
    const ml = _audiologMaplawForSide(side);
    if (ml) parts.push(ml);
  }

  // Frequenz-Sektion (übergreifend, pro Seite eine Sub-Tabelle)
  if (typeof pWarpOn !== "undefined" && pWarpOn
      && typeof plEqOn !== "undefined" && plEqOn
      && typeof fRes !== "undefined" && fRes.length > 0) {
    const freqParts = [];
    for (const side of mainSides) {
      const ft = _audiologFreqTable(side, mainSides);
      if (ft) {
        freqParts.push(`### ${_audiologSideLabel(side)}`);
        freqParts.push("");
        freqParts.push(ft);
      }
    }
    if (freqParts.length > 0) {
      parts.push(`## ${t("audiologSecFreq")}`);
      parts.push("");
      // Hinweis bei sym-Warp + einseitig
      if (mainSides.length === 1 && typeof pWarpMode !== "undefined" && pWarpMode === "sym") {
        parts.push(`_${t("audiologFreqSymHint")}_`);
        parts.push("");
      }
      parts.push(freqParts.join("\n"));
    }
  }

  // Stereo-Balance + Latenz
  const bal = _audiologBalanceBlock(mainSides);
  if (bal) parts.push(bal);
  const lat = _audiologLatencyBlock(mainSides);
  if (lat) parts.push(lat);

  // Testprogramm-Erkennung
  const tp = _audiologTestProgramHint(mainSides);
  if (tp) parts.push(tp);

  // Hinweise für den Audiologen
  parts.push(_audiologAdvice());

  // Fehlende Implantat-Angaben
  const miss = _audiologMissingImplantData(mainSides);
  if (miss) parts.push(miss);

  // Allgemeine Bitten
  parts.push(_audiologGeneralRequests());

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ============================================================
// MODUS B — DRUCK MIT GRAFIK
// ============================================================

function _mdToHtmlBasic(md) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      out.push(`<h${lvl}>${esc(h[2])}</h${lvl}>`);
      i++; continue;
    }
    if (/^\|.*\|$/.test(line) && i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i+1])) {
      const head = line.split("|").slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      let tbl = '<table style="border-collapse:collapse;margin:8px 0;font-size:0.85em;">';
      tbl += "<thead><tr>" + head.map((c) =>
        `<th style="border:1px solid #000;padding:3px 6px;background:#eee;text-align:left;">${esc(c)}</th>`
      ).join("") + "</tr></thead>";
      tbl += "<tbody>" + rows.map((r) =>
        "<tr>" + r.map((c) =>
          `<td style="border:1px solid #000;padding:3px 6px;">${esc(c).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</td>`
        ).join("") + "</tr>"
      ).join("") + "</tbody></table>";
      out.push(tbl);
      continue;
    }
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
    if (/^\s*>\s+/.test(line)) {
      out.push(`<blockquote style="border-left:3px solid #000;padding-left:8px;">${esc(line.replace(/^\s*>\s+/, ""))}</blockquote>`);
      i++; continue;
    }
    if (line.trim() === "") { i++; continue; }
    const inline = esc(line)
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/_([^_]+)_/g, "<i>$1</i>");
    out.push(`<p>${inline}</p>`);
    i++;
  }
  return out.join("\n");
}

// Bar-Chart pro Seite mit Residuum-Fehlerbalken.
// 2× Auflösung, CSS-Width = logische Breite.

function _audiologChartImg(side) {
  const dBs = _audiologDbForSide(side);
  const resArr = _audiologResForSide(side);
  return withSide(side, () => {
    const SCALE = 2;
    const Wlog = 700, Hlog = 240;
    const canvas = document.createElement("canvas");
    canvas.width = Wlog * SCALE;
    canvas.height = Hlog * SCALE;
    const ctx = canvas.getContext("2d");
    ctx.scale(SCALE, SCALE);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, Wlog, Hlog);

    let maxAbs = 1;
    for (let i = 0; i < nEl; i++) {
      const v = dBs[i] || 0;
      const r = resArr[i] || 0;
      maxAbs = Math.max(maxAbs, Math.abs(v) + r);
    }
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;

    const pad = { l: 40, r: 14, t: 30, b: 32 };
    const pW = Wlog - pad.l - pad.r, pH = Hlog - pad.t - pad.b;
    const zY = pad.t + pH / 2;
    const gW = pW / nEl;

    // Nulllinie
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad.l, zY); ctx.lineTo(Wlog - pad.r, zY); ctx.stroke();

    // Y-Skala
    ctx.fillStyle = "#444"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
    ctx.fillText("+" + maxAbs, pad.l - 4, pad.t + 8);
    ctx.fillText("0", pad.l - 4, zY + 3);
    ctx.fillText("-" + maxAbs, pad.l - 4, Hlog - pad.b + 4);

    // Balken + Fehlerbalken
    for (let i = 0; i < nEl; i++) {
      const v = dBs[i] || 0;
      const r = resArr[i] || 0;
      const x = pad.l + i * gW + 2;
      const w = Math.max(2, gW - 4);
      const disabled = (elSt[i] === "mute") || (elExDur[i] !== null);
      if (disabled) {
        ctx.fillStyle = "#ccc";
        ctx.fillRect(x, pad.t, w, pH);
        ctx.fillStyle = "#444"; ctx.textAlign = "center";
        ctx.fillText(`${dENPrefix()}${dEN(i)}`, x + w / 2, Hlog - pad.b + 16);
        continue;
      }
      if (Math.abs(v) >= 0.05) {
        const h = (Math.abs(v) / maxAbs) * (pH / 2);
        ctx.fillStyle = v >= 0 ? "#3b82f6" : "#ef4444";
        if (v >= 0) ctx.fillRect(x, zY - h, w, h);
        else        ctx.fillRect(x, zY,    w, h);
      }
      // Residuum-Balken (T-Form, schwarz mit Transparenz)
      if (r > 0) {
        const yV = zY - (v / maxAbs) * (pH / 2);
        const yT = zY - ((v + r) / maxAbs) * (pH / 2);
        const yB = zY - ((v - r) / maxAbs) * (pH / 2);
        const xC = x + w / 2;
        ctx.strokeStyle = "rgba(0,0,0,0.55)";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(xC, yT); ctx.lineTo(xC, yB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xC - 4, yT); ctx.lineTo(xC + 4, yT); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(xC - 4, yB); ctx.lineTo(xC + 4, yB); ctx.stroke();
      }
      // Elektroden-Label
      ctx.fillStyle = "#444"; ctx.textAlign = "center";
      ctx.font = "10px sans-serif";
      ctx.fillText(`${dENPrefix()}${dEN(i)}`, x + w / 2, Hlog - pad.b + 16);
    }
    // Titel
    ctx.fillStyle = "#000"; ctx.font = "bold 12px sans-serif"; ctx.textAlign = "left";
    const sideName = side === "left" ? t("sideLeft") : t("sideRight");
    ctx.fillText(`${t("audiologChartTitle")} — ${sideName}`, pad.l, 18);

    // CSS-Width auf Wlog, damit der Browser nicht hochskaliert
    return `<img src="${canvas.toDataURL("image/png")}" style="width:${Wlog}px;max-width:100%;height:auto;" />`;
  });
}

function audiologPrint() {
  const mainSides = _audiologMainSides();
  const eqOn = (typeof plEqOn === "undefined") ? true : plEqOn;
  // Markdown ohne pro-Seite-Chart erzeugen
  const md = buildAudiologMarkdown();
  const html = _mdToHtmlBasic(md);
  // Charts in HTML einsortieren: nach jedem Sub-Kopf "## LINKS"/"## RECHTS",
  // direkt vor der Loudness-Tabellen-Überschrift. Wir machen das via
  // String-Injection im fertigen HTML.
  let body = html;
  if (eqOn) {
    for (const s of mainSides) {
      const sideName = s === "left" ? t("sideLeft") : t("sideRight");
      const chart = _audiologChartImg(s);
      // Wir suchen die H3-Überschrift "Lautstärken-Änderung" nach dem
      // jeweiligen H2 mit der Seite. Heuristik: erste Loudness-H3
      // nach dem ersten Auftauchen der Seiten-Bezeichnung in einem H2.
      // Vereinfachung: wir injizieren vor jeder Loudness-H3 in Reihenfolge.
      const marker = `<h3>${t("audiologSecLoudness")}</h3>`;
      const idx = body.indexOf(marker);
      if (idx >= 0) {
        body = body.slice(0, idx) + chart + body.slice(idx);
      }
    }
  }
  // Footer
  const footer = `<hr><div style="font-size:0.75em;color:#444;text-align:center;margin-top:12px;">CI Sound Balancing Tool` +
                 (typeof APP_VERSION !== "undefined" ? ` v${APP_VERSION}` : "") +
                 ` · ${new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US")}</div>`;
  body = body + footer;

  if (typeof openPrintWindow !== "function") {
    alert("openPrintWindow not available — print.js missing?");
    return;
  }
  openPrintWindow(t("audiologTitle"), body);
}
```

---

## Schritt 5 — i18n.js: Strings ersetzen und ergänzen

In `i18n.js`, im deutschen Block (DE), die existierenden
`audiolog*`-Strings (heute Z. 338–370) **komplett ersetzen** durch:

```js
    audiologTitle: "Einstellungswünsche an den Audiologen",
    audiologDesc: "Wiedergabe der Einstellungen gemäß dem Player: Die Einstellungen sollen bewirken, daß Sie genau so hören, wie wenn Sie etwas im Player abspielen.",
    audiologNoteLabel: "Persönliche Notiz an den Audiologen (optional)",
    audiologNotePlaceholder: "z.B. ‚E11 rauscht seit zwei Wochen stärker als sonst.‘",
    audiologHintSide: "Bitte auf die Side-Auswahl im Player (Links/Rechts/Beide) achten — der Bericht enthält nur die ausgewählte(n) Seite(n).",
    audiologHintWarp: "Frequenz-Empfehlungen erscheinen nur, wenn im Player Frequenz-Warping aktiv ist.",
    audiologHintNote: "Bei einseitigem Ausdruck und symmetrischem Frequenz-Warping wird die Anpassung der anderen Seite als Zusatzspalte mit angezeigt.",
    audiologPrint: "Drucken (mit Grafik)",
    audiologCopyMd: "Markdown kopieren",
    audiologDownloadMd: "Markdown Text exportieren",
    audiologHeaderSide: "Aktive Side-Auswahl",
    audiologToolVersion: "Tool-Version",
    audiologMfr: "Hersteller",
    audiologProcessor: "Prozessor",
    audiologImplant: "Implantat-Modell",
    audiologLastMeas: "Letzte Messung",
    audiologSecUserNote: "Persönliche Notiz",
    audiologSecLoudness: "Lautstärken-Änderung",
    audiologSecMaplaw: "MAPLAW-Änderung",
    audiologSecFreq: "Frequenz-Änderung",
    audiologSecBalance: "Stereo-Balance",
    audiologSecLatency: "Inter-Ohr-Latenz",
    audiologSecAdvice: "Hinweise für den Audiologen",
    audiologSecMissing: "Fehlende Implantat-Angaben",
    audiologSecRequests: "Allgemeine Bitten",
    audColEl: "Elektrode",
    audColHz: "Hz",
    audColDb: "Δ dB",
    audColRes: "Residuum",
    audColMcl: "MCL",
    audColMclDelta: "Δ MCL",
    audColMclNew: "neuer MCL",
    audColStatus: "Status",
    audColNote: "Notiz",
    audColHzOld: "bisher Hz",
    audColHzNew: "neu Hz",
    audColCent: "Δ cent",
    audStatExcluded: "ausgeschlossen",
    audStatMute: "stumm",
    audiologLoudnessLegend: "Δ dB = vom Patienten gemessene Lautstärken-Abweichung gegenüber dem Mittel (positiv = MCL anheben). Residuum = mittlere Reststreuung der zugrundeliegenden Vergleiche; niedrigere Werte = konsistentere Messung.",
    audiologFreqSymHint: "Frequenz-Warping wirkt symmetrisch auf beide Seiten. Da nur eine Seite gedruckt wird, sind die Werte der anderen Seite als Zusatzspalten mit angegeben.",
    audiologBalDiff: "Differenz zwischen den Seiten",
    audiologBalImpact: "{louder} wird lauter wahrgenommen, {quieter} leiser.",
    audiologBalIncluded: "Diese Differenz ist in den oben gezeigten Korrekturen **bereits eingerechnet**.",
    audiologBalNotIncluded: "Diese Differenz ist in den oben gezeigten Korrekturen **nicht eingerechnet**.",
    audiologLatValue: "Inter-Ohr-Verzögerung",
    audiologLatImpact: "{earlier} wird früher, {later} später gehört.",
    audiologLatIncluded: "Die Latenz ist im Player bereits ausgeglichen.",
    audiologLatNotIncluded: "Die Latenz ist im Player aktuell nicht ausgeglichen.",
    audiologTestProgramHint: "**Testprogramm erkannt.** Die Player-Einstellung dieser Korrektur enthält keine elektroden-spezifische Klangformung; alle Elektroden werden auf psychoakustisch gleiche Lautstärke gebracht. Diese Korrektur entspricht damit dem angestrebten Testprogramm.",
    audiologAdvice1: "Die gezeigten Korrekturwerte sind Approximationen aus akustischen Lautstärkemessungen mit psychoakustischem Paarvergleich. Sie ersetzen keine direkte stimulationsbasierte Anpassung.",
    audiologAdvice2: "Ggf. errechnete qu-/CL-/CU-Werte sind eine Umrechnung von Dezibel-Werten gemäß recherchierter Formeln. Bitte auf Plausibilität prüfen.",
    audiologAdvice3: "Empfohlene Vorgehensweise: Werte als Startpunkt verwenden · mit Balancing-Funktion gegen Nachbarelektroden prüfen · Patient bestätigt subjektive Gleichheit.",
    audiologAdvice4: "Vorzeichen: Positive Δ-Werte bedeuten, daß MCL/C-/M-Level angehoben werden soll (Elektrode wurde als zu leise gemessen). Negative Werte = absenken.",
    audMissImplantModel: "Implantat-Modell",
    audMissProcessor: "Audioprozessor-Modell",
    audMissMcl: "MCL-Werte",
    audMissCValue: "MAPLAW c-Wert",
    audMissIidr: "IIDR",
    audMissIdr: "IDR",
    audiologRequestsBody: "Das folgende brauche ich für Lautstärken-Messung zu Hause mit dem CI Sound Balancing Tool:\n\n**1. Vollständiger Fitting-Report aller aktuellen MAPs:**\n\n- Implantat-Modell und Audioprozessor-Modell\n- Kodierungsstrategie und Stimulationsrate\n- FAT (Frequency Allocation Table): Mittenfrequenz pro Elektrode in Hz\n- THR (T-Level) pro Elektrode\n- MCL pro Elektrode (MED-EL in qu, Cochlear in CL, Advanced Bionics in CU)\n- Status jeder Elektrode (aktiv / deaktiviert)\n- MED-EL zusätzlich: MAPLAW c-Wert\n- Cochlear zusätzlich: IIDR (Instantaneous Input Dynamic Range, in dB)\n- Advanced Bionics zusätzlich: IDR (Input Dynamic Range, in dB)\n\n**2. Test-MAP ohne ASM-Filter auf einer freien Programm-Position:**\n\n- Microphone Directionality: Omni\n- Adaptive Intelligence: Off\n- Wind Noise Reduction: Off\n- Ambient Noise Reduction: Off\n- Transient Noise Reduction: Off\n\nCompression Ratio und sonstige Map-Parameter bitte unverändert lassen. Diese MAP brauche ich für Lautheits-Messung zu Hause.",
    audiologChartTitle: "Korrektur",
    audiologEqOff: "**Hinweis:** Player-EQ ist ausgeschaltet — es werden keine CI-Änderungen abgeleitet.",
    audiologNoCorrection: "Keine Korrektur abgeleitet — Player-EQ liefert für alle Elektroden 0 dB.",
```

Die analoge Übersetzung in den anderen Sprach-Blöcken (en/fr/es) wird
**nicht** in dieser Bauanleitung verlangt — Sonnet legt für jede
Sprache **die DE-Strings als Fallback** ab (also: in den anderen
Sprach-Blöcken denselben deutschen Text einsetzen, jeweils 1:1 kopiert).
Eine richtige Lokalisierung kommt in einer späteren Bauanleitung.

Falls einer der hier ersetzten Keys (`audiologSecCorrection`,
`audiologSecNote`, `audiologColDb`, `audiologColAbs`,
`audiologColFreqOld`, `audiologColFreqNew`, `audiologBalValue`,
`audiologBalDir`, `audiologBalMode`, `audiologBalHint`,
`audiologLatHint`, `audiologNoteBal`, `audiologNoteBalReason`,
`audiologNoteLat`, `audiologNoteLatReason`, `audiologNoteWarp`)
nirgendwo sonst mehr verwendet wird — was nach diesem Umbau der Fall
sein sollte — entfernen. **Vor dem Entfernen** mit `grep -n "audiologSecCorrection" *.js *.html` o.ä. prüfen, ob wirklich
kein Codepfad mehr drauf zugreift.

---

## Schritt 6 — CODESTRUKTUR.md aktualisieren

In `CODESTRUKTUR.md`, im Abschnitt für `print-md.js` (heute Z. 114),
den letzten Satzteil zu Modus B ersetzen durch:

> Modus B: `buildAudiologMarkdown`, `audiologPrint`, `mdAudiologFilename`,
> Helfer `_audiologMainSides`, `_audiologSideLabel`, `_audiologDbForSide`,
> `_audiologResForSide`, `_audiologAbsDelta`, `_audiologLoudnessTable`,
> `_audiologFreqTable`, `_audiologMaplawForSide`, `_audiologBalanceBlock`,
> `_audiologLatencyBlock`, `_audiologTestProgramHint`,
> `_audiologIsTestProgram`, `_audiologMissingImplantData`,
> `_audiologAdvice`, `_audiologGeneralRequests`, `_audiologLastMeas`,
> `_audiologConfigLabel`, `_audiologChartImg`, Mini-MD→HTML-Konverter
> `_mdToHtmlBasic`.

Im Abschnitt über `state-side.js` die globale Variable
`audiologUserNote` neu erwähnen (top-level, beide Seiten gemeinsam).

---

## Schritt 7 — SPEC.md aktualisieren

In `SPEC.md`, Abschnitt „Audiologen-Box im Tab Laden/Speichern"
(heute Z. 655ff), den Block ersetzen durch:

```
### Audiologen-Box im Tab Laden/Speichern

Karte „Einstellungswünsche an den Audiologen" zwischen Archiv-Karte
und EasyEffects-Karte. Enthält ein optionales Notiz-Eingabefeld
(`audiologUserNote`, top-level persistiert) und zwei Aktionen:
Drucken (mit Grafik), Markdown-Export.

Der Bericht ist gegliedert in:

1. Kopf (Datum, Side-Auswahl, Tool-Version).
2. Persönliche Notiz (wenn ausgefüllt).
3. Pro Seite (LINKS, dann RECHTS — je nach Player-Side-Auswahl):
   - Sub-Kopf mit Hersteller, Prozessor, Implantat-Modell,
     Datum der letzten Messung.
   - Bar-Chart der ΔdB-Werte mit Residuum-Fehlerbalken.
   - Tabelle „Lautstärken-Änderung": alle Elektroden mit Hz,
     Δ dB, Residuum, MCL/Δ MCL/Neuer MCL (qu/CL/CU), Status,
     elektroden-Notiz. Legende darunter.
   - MAPLAW-Mini-Block (nur MED-EL, nur bei abweichendem c-Wert).
4. Sektion „Frequenz-Änderung" (nur bei aktivem Warp) mit
   Sub-Tabellen pro Seite. Bei sym-Warp + einseitigem Druck:
   Zusatzspalten für die andere Seite.
5. Stereo-Balance — immer, wenn gemessen, auch bei einseitigem
   Druck. Mit Hinweis, ob die Differenz in die ΔdB-Werte oben
   bereits eingerechnet ist.
6. Inter-Ohr-Latenz — analog.
7. Hinweis „Testprogramm erkannt", wenn die Heuristik anschlägt
   (keine elektrodenspezifische Klangformung über Schieber/Kurven).
8. „Hinweise für den Audiologen" (4 Bullets).
9. „Fehlende Implantat-Angaben" — falls Implantat-Daten unvollständig.
10. „Allgemeine Bitten" (Fitting-Report + Test-MAP ohne ASM).
11. Footer mit Tool-Version und Zeitstempel.

Testprogramm-Heuristik: EQ aktiv, NH-Sim aus, und Standardabweichung
des Schieber+Kurven-Beitrags pro aktiver Elektrode (mit EQ-Stärke
skaliert, Mittelwert abgezogen) < 0,2 dB. Reine Pegelverschiebung
wird damit nicht als „nicht-Testprogramm" gewertet.

Dateinamen: `ci-sound-balancing-audiologe-<datum>-<zeit>-<seite>.md`
mit `<seite>` ∈ {`links`, `rechts`, `beide`}.
```

---

## Akzeptanztest

Klick-für-Klick, ohne Code-Kenntnisse durchgehbar:

1. **Reset und Laden eines vorhandenen Datensatzes.** Tab Laden/Speichern
   → Datei laden → eine JSON mit Mess-Ergebnissen auf beiden Seiten.
   *Erwartet:* keine Konsolenfehler. Karte „Einstellungswünsche an den
   Audiologen" sichtbar, Textfeld „Persönliche Notiz" leer.

2. **Notiz eintragen.** In das Notiz-Textfeld einen kurzen Satz tippen.
   *Erwartet:* Text bleibt stehen, keine Anzeige flackert.

3. **Speichern.** Tab Laden/Speichern → JSON speichern. Datei mit
   Texteditor öffnen.
   *Erwartet:* Feld `"audiologUserNote": "<dein Satz>"` vorhanden.

4. **Laden.** Tool neu laden (F5), JSON wieder laden.
   *Erwartet:* Notiz steht wieder im Textfeld.

5. **Drucken (beide Seiten, EQ an).** Im Player Side-Auswahl auf
   „Beide". EQ einschalten, Schieber/Kurven nicht angefaßt lassen.
   Knopf „Drucken (mit Grafik)".
   *Erwartet im Druckfenster:* (a) Titel + Datum + Side-Auswahl + Tool-
   Version oben. (b) Notiz-Abschnitt nach dem Kopf. (c) Sub-Kopf
   „Links — CI" (oder analog) mit Hersteller-Zeile. (d) Bar-Chart
   mit T-förmigen Residuum-Fehlerbalken. (e) Eine Tabelle pro Seite
   mit ALLEN Elektroden (auch denen mit 0 dB), inkl. Status/Notiz-
   Spalten. (f) Legende unter jeder Tabelle. (g) „Hinweise für den
   Audiologen" als 4er-Liste am Ende. (h) „Allgemeine Bitten" mit
   beiden nummerierten Bitten. (i) Footer mit Tool-Version + Datum.

6. **Frequenzwarping, beidseitig, asym.** Im Player Warp einschalten,
   `pWarpMode === "ref_side"` (oder anderes nicht-`sym`).
   *Erwartet:* eigene Sektion „Frequenz-Änderung" mit Sub-Tabellen
   pro Seite, jeweils Spalten „bisher Hz / Δ cent / neu Hz".

7. **Frequenzwarping, einseitiger Druck, sym.** Side-Auswahl auf
   „Links". Warp ein, `pWarpMode === "sym"`.
   *Erwartet:* die Frequenz-Tabelle für „Links" hat **zusätzliche
   Spalten** „Δ cent (Rechts) / neu Hz (Rechts)" mit Doppel-Trennstrich,
   und ein Hinweissatz „Frequenz-Warping wirkt symmetrisch …" steht
   über der Tabelle.

8. **Stereo-Balance gemessen, einseitiger Druck.** Side-Auswahl
   „Links". Stereo-Balance-Messung im Datensatz vorhanden.
   *Erwartet:* eigene Sektion „Stereo-Balance" sichtbar mit
   Differenzwert, Auswirkung („… wird lauter wahrgenommen, …
   leiser") und Vermerk **„nicht eingerechnet"** (weil einseitig).

9. **Stereo-Balance gemessen, beidseitiger Druck, Balance aktiv.**
   Side-Auswahl „Beide". `plApplyBalance` an.
   *Erwartet:* Sektion „Stereo-Balance" mit Vermerk **„bereits
   eingerechnet"**.

10. **Testprogramm erkannt.** Schieber und Kurven alle auf 0,
    NH-Sim aus, EQ an, Messung vorhanden.
    *Erwartet:* Hinweis-Blockquote „Testprogramm erkannt. …" zwischen
    Latenz und „Hinweise für den Audiologen".

11. **Testprogramm NICHT erkannt.** Einen Schieber auf z.B. +4 dB
    (Bassanhebung) stellen.
    *Erwartet:* Hinweis-Blockquote verschwindet.

12. **Reine Pegelverschiebung.** Alle Schieber gleichmäßig auf +3 dB
    (oder die „Volume"-Voreinstellung mit Wert +3, falls vorhanden).
    *Erwartet:* Hinweis-Blockquote „Testprogramm erkannt" bleibt
    sichtbar (Standardabweichung um den Mittelwert ist 0).

13. **Fehlende Implantat-Daten.** Im Reiter Implantat keine MCL-Werte
    eintragen.
    *Erwartet:* Sektion „Fehlende Implantat-Angaben" am Ende, vor
    „Allgemeine Bitten", mit Auflistung der fehlenden Felder pro
    Seite.

14. **Markdown-Export.** Knopf „Markdown Text exportieren".
    *Erwartet:* Datei `ci-sound-balancing-audiologe-<datum>-<seite>.md`
    wird heruntergeladen. Inhalt entspricht dem Druck-Output ohne
    Bar-Chart (Tabellen vorhanden, Sektionen vorhanden, Footer
    nicht).

15. **EQ aus.** Player-EQ ausschalten, drucken.
    *Erwartet:* Hinweis-Blockquote „Player-EQ ist ausgeschaltet …"
    direkt nach dem Kopf. Tabellen erscheinen trotzdem
    (mit 0,0 dB), kein Bar-Chart.

---

## Selbstprüfungs-Auftrag an Sonnet

**Bevor** du dem Nutzer „fertig" meldest, gehe jeden Akzeptanztest
einzeln durch und melde für jeden: **erfüllt / nicht erfüllt /
unklar**, jeweils mit der konkreten Datei- und Zeilenangabe der
Stelle, die das Verhalten erzeugt.

Wenn du etwas als **unklar** markierst, ist das ein Signal,
nochmal beim Nutzer rückzufragen, nicht stillschweigend anzunehmen.

Prüfe insbesondere:
- Ist `audiologUserNote` als globale `let`-Variable korrekt deklariert
  und wird sie beim Tippen im Textfeld aktualisiert?
- Wird die Notiz in `saveJson()` ausgegeben und in `applyLoadedData()`
  wieder eingelesen, **bevor** Render-Funktionen laufen?
- Sind in allen vier Sprach-Blöcken von `i18n.js` die neuen Keys
  gesetzt (in den nicht-DE-Blöcken als deutscher Fallback)?
- Schlägt die Testprogramm-Heuristik bei reiner Volume-Verschiebung
  korrekt **nicht** als „nicht-Testprogramm" an?
- Bei sym-Warp + einseitigem Druck: erscheinen die Zusatzspalten
  und der Hinweissatz?
- Sind in `CODESTRUKTUR.md` und `SPEC.md` die genannten Stellen
  aktualisiert?
- Wurden die nicht mehr verwendeten i18n-Keys aus Schritt 5 entfernt
  bzw. ihr Weiterleben grep-bestätigt?
