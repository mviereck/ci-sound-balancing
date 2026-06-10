# Bauanleitung 42c: Audiologen-Korrektur-Bericht — Nacharbeit

Setzt **Bauanleitung 42** voraus (durchgelaufen). Diese Anleitung
korrigiert mehrere konzeptionelle und Detail-Punkte am Bericht-
Ausgang, die nach erster Sichtung des fertigen Berichts noch
aufgekommen sind:

- **Notiz und Allgemeine Bitten gehören NICHT in den Korrektur-Bericht.**
  Sie werden in BA 43 (Brief) untergebracht. Aus dem Korrektur-Bericht
  beide Sektionen entfernen.
- **MAPLAW** soll genauso prominent als eigene H2-Sektion erscheinen
  wie Stereo-Balance, nicht als Inline-Block in der Seite.
- **Bugfix Konfig-Label**: `_audiologConfigLabel` sucht den falschen
  i18n-Key (`cfg_ci` existiert nicht).
- **Hersteller-Label prüfen**: aktueller Code liefert `MFR[sd.manufacturer].name`,
  was „MED-EL" ergeben sollte. Wenn im Bericht trotzdem „medel" erscheint,
  Code-Pfad genau prüfen.
- **Lautstärken-Tabelle**: Hz-Spalte entfernen, Zahlenspalten mehr Padding.
- **Frequenz-Tabelle**: neuer H2-Titel „Änderung der Mittenfrequenzen",
  neue Spalten-Aufteilung (Hz Default + Hz manuell), mehr Padding.
- **Latenz**: negativ-Satz weglassen.
- **Testprogramm-Hinweis**: weiter oben, direkt unter Tool-Version-Zeile.
- **Fehlende Implantat-Angaben**: zusätzlich THR und „derzeit eingestellte
  Mittenfrequenzen je Elektrode" auflisten.
- **Footer-Zeile** umformulieren (Tool-Version + Domain).

Berührt: `print-md.js`, `i18n.js`, `CODESTRUKTUR.md`, `SPEC.md`.
Die Notiz-Eingabe-Box in der Karte (BA 42, Schritt 1) bleibt
**unverändert oben in der Karte** — das Feld dient ab BA 43 für den
Brief.

---

## Schritt 1 — `_audiologConfigLabel` korrigieren

In `print-md.js`, Funktion `_audiologConfigLabel(side)` (heute Z. 1015–1021)
**ersetzen** durch:

```js
function _audiologConfigLabel(side) {
  const sd = sideData[side];
  const cfg = (sd && sd.config) || "ci";
  const map = {
    ci:     "cfgCI",
    hg:     "cfgHG",
    normal: "cfgNormal",
    shoh:   "cfgSchwerh",
    deaf:   "cfgTaub",
  };
  const key = map[cfg];
  if (!key) return cfg;
  const tr = t(key);
  return (tr && tr !== key) ? tr : cfg;
}
```

---

## Schritt 2 — Hersteller-Label sicherstellen

Aktueller Code in `print-md.js` (Z. 1064):

```js
const mfrLbl = (MFR[sd.manufacturer] && MFR[sd.manufacturer].name) || sd.manufacturer;
```

`MFR.medel.name === "MED-EL"` in `core.js` Z. 175. Der Code-Pfad
**sollte** „MED-EL" liefern. Wenn der Bericht trotzdem „medel" zeigt:

1. Browser-Hard-Reload (Strg+Shift+R) — möglicherweise Cache.
2. Falls das nicht hilft, mit `grep -n "audiologMfr\|sd.manufacturer" print-md.js` prüfen, ob die o.g. Zeile noch unverändert ist oder versehentlich umgebaut wurde, und ggf. wieder auf das Snippet oben setzen.
3. Bei Bedarf in `console.log` die Werte ausgeben:
   ```js
   console.log("DEBUG mfrLbl", sd.manufacturer, MFR[sd.manufacturer], MFR[sd.manufacturer]?.name);
   ```
   und Sonnet meldet das Ergebnis an den Nutzer.

Kein Code-Edit nötig, wenn der Pfad korrekt ist und das Phänomen
nur durch Cache verursacht war.

---

## Schritt 3 — `buildAudiologMarkdown` umbauen

In `print-md.js`, Funktion `buildAudiologMarkdown()` (Z. 1023ff)
**vollständig ersetzen** durch:

```js
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

  // ---- Kopf ----
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}`);
  // Tool-Version-Zeile NEU formuliert:
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`_${t("audiologToolVersionLine").replace("{VERSION}", APP_VERSION)}_`);
  }
  parts.push("");

  // ---- Testprogramm-Hinweis FRÜH (direkt unter Tool-Version) ----
  const tp = _audiologTestProgramHint(mainSides);
  if (tp) parts.push(tp);

  // ---- EQ aus ----
  if (typeof plEqOn !== "undefined" && !plEqOn) {
    parts.push(`> ${t("audiologEqOff")}\n`);
  }

  // ---- Pro Seite: Sub-Kopf + Loudness-Tabelle + Legende ----
  // (MAPLAW NICHT mehr inline — siehe eigene Sektion unten.)
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd) continue;
    const impl = sd.implant || {};
    const sideLbl = _audiologSideLabel(side);
    const mfrLbl  = (MFR[sd.manufacturer] && MFR[sd.manufacturer].name) || sd.manufacturer;
    const cfgLbl  = _audiologConfigLabel(side);
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

    parts.push(`### ${t("audiologSecLoudness")}`);
    parts.push("");
    parts.push(_audiologLoudnessTable(side));
    parts.push("");
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");
  }

  // ---- MAPLAW als eigene H2-Sektion (parallel zu Balance/Latenz) ----
  const mlAll = _audiologMaplawSection(mainSides);
  if (mlAll) parts.push(mlAll);

  // ---- Frequenz-Sektion (eigene H2) ----
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
      if (mainSides.length === 1 && typeof pWarpMode !== "undefined" && pWarpMode === "sym") {
        parts.push(`_${t("audiologFreqSymHint")}_`);
        parts.push("");
      }
      parts.push(freqParts.join("\n"));
    }
  }

  // ---- Stereo-Balance + Latenz ----
  const bal = _audiologBalanceBlock(mainSides);
  if (bal) parts.push(bal);
  const lat = _audiologLatencyBlock(mainSides);
  if (lat) parts.push(lat);

  // ---- Hinweise für den Audiologen (4 Bullets) bleiben ----
  parts.push(_audiologAdvice());

  // ---- Fehlende Implantat-Angaben ----
  const miss = _audiologMissingImplantData(mainSides);
  if (miss) parts.push(miss);

  // ---- KEIN _audiologGeneralRequests mehr — wandert in den Brief (BA 43) ----
  // ---- KEINE Notiz mehr im Korrektur-Bericht — Brief-only ----

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
```

---

## Schritt 4 — MAPLAW-Helper umbauen

In `print-md.js`, Funktion `_audiologMaplawForSide(side)` (war pro-Seite)
**entfernen** und durch eine neue, H2-Sektion-Funktion ersetzen:

```js
function _audiologMaplawSection(mainSides) {
  if (typeof pMaplawOn === "undefined" || !pMaplawOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const sollC = (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : null;
  if (sollC == null) return "";
  const rows = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd || sd.manufacturer !== "medel") continue;
    const istC = (sd.implant && sd.implant.cValue) ? sd.implant.cValue : null;
    if (istC == null || istC === sollC) continue;
    const sideName = _audiologSideLabel(side);
    rows.push(`- ${sideName}: MAPLAW c **${istC} → ${sollC}**`);
  }
  if (rows.length === 0) return "";
  const lines = [`## ${t("audiologSecMaplaw")}`, "", ...rows, ""];
  return lines.join("\n");
}
```

---

## Schritt 5 — Lautstärken-Tabelle: Hz-Spalte entfernen, Padding erhöhen

In `print-md.js`, Funktion `_audiologLoudnessTable(side)` (heute
Z. 200ff in der Datei) **ersetzen** durch:

```js
function _audiologLoudnessTable(side) {
  return withSide(side, () => {
    const dBs = _audiologDbForSide(side);
    const resArr = _audiologResForSide(side);
    const unit = lvUnitLabelFor(mfr);
    const lines = [];
    lines.push(`| ${t("thEl")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("audColNote")} |`);
    lines.push("|---|---|---|---|---|---|---|---|");
    for (let i = 0; i < nEl; i++) {
      const dB = dBs[i] || 0;
      const r  = resArr[i] || 0;
      const abs = _audiologAbsDelta(side, i, dB);
      const status = _audStatusText(side, i);
      const note = (elNt && elNt[i]) ? elNt[i] : "";
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | ${_audDb(dB)} | ${r > 0 ? r.toFixed(1) + " dB" : "—"} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status || "—"} | ${note || "—"} |`
      );
    }
    return lines.join("\n");
  });
}
```

Das Padding der Zellen wird im HTML-Renderer `_mdToHtmlBasic` gesetzt.
Heute steht dort:

```js
`<th style="border:1px solid #000;padding:3px 6px;background:#eee;text-align:left;">${esc(c)}</th>`
…
`<td style="border:1px solid #000;padding:3px 6px;">${esc(c).replace(…)}</td>`
```

In `print-md.js`, Funktion `_mdToHtmlBasic` (heute Z. 660ff in der
Datei), das `padding:3px 6px;` an **beiden** Stellen
(`<th …>` und `<td …>`) ersetzen durch:

```css
padding: 4px 10px;
```

Zusätzlich: damit Zahlenspalten visuell von Text-Spalten unterscheidbar
werden, im `<td …>` style ergänzen:

```css
white-space: nowrap;
```

Vollständig sehen die zwei Style-Strings dann so aus:

```js
`<th style="border:1px solid #000;padding:4px 10px;background:#eee;text-align:left;white-space:nowrap;">${esc(c)}</th>`
…
`<td style="border:1px solid #000;padding:4px 10px;white-space:nowrap;">${esc(c).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")}</td>`
```

---

## Schritt 6 — Frequenz-Tabelle umbauen

In `print-md.js`, Funktion `_audiologFreqTable(side, mainSides)`
**ersetzen** durch:

```js
function _audiologFreqTable(side, mainSides) {
  if (typeof pWarpOn === "undefined" || !pWarpOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  if (typeof fRes === "undefined" || fRes.length === 0) return "";

  const isSymSingle = (mainSides.length === 1
                      && typeof pWarpMode !== "undefined"
                      && pWarpMode === "sym");
  const own = fRes.filter((r) => r.varSide === side);
  if (own.length === 0 && !isSymSingle) return "";

  const ownByEl = {};
  for (const r of own) ownByEl[r.elIdx] = r;

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
    const sd = sideData[side];
    const defFreqs = (sd && sd.manufacturer && MFR[sd.manufacturer])
      ? MFR[sd.manufacturer].freqs
      : freqs;
    const ownFreqOwn = (sd && sd.elFreqOwn) ? sd.elFreqOwn : null;

    if (isSymSingle && otherByEl && Object.keys(otherByEl).length > 0) {
      const otherLbl = otherSide === "left" ? t("sideLeft") : t("sideRight");
      lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColHzWish")} || ${t("audColCent")} (${otherLbl}) | ${t("audColHzWish")} (${otherLbl}) |`);
      lines.push("|---|---|---|---|---||---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        const o = otherByEl[i];
        if (!r && !o) continue;
        const hzDef = defFreqs[i] != null ? _mdFmtHz(defFreqs[i]) : "—";
        const hzMan = (ownFreqOwn && ownFreqOwn[i] != null) ? _mdFmtHz(ownFreqOwn[i]) : "—";
        const ownCent = r ? _audCent(r.varFreq, r.refFreq) : "—";
        const ownNew  = r ? _mdFmtHz(r.refFreq) : "—";
        const othCent = o ? _audCent(o.varFreq, o.refFreq) : "—";
        const othNew  = o ? _mdFmtHz(o.refFreq) : "—";
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${hzDef} | ${hzMan} | ${ownCent} | ${ownNew} || ${othCent} | ${othNew} |`);
      }
    } else {
      lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColHzWish")} |`);
      lines.push("|---|---|---|---|---|");
      for (let i = 0; i < nEl; i++) {
        const r = ownByEl[i];
        if (!r) continue;
        const hzDef = defFreqs[i] != null ? _mdFmtHz(defFreqs[i]) : "—";
        const hzMan = (ownFreqOwn && ownFreqOwn[i] != null) ? _mdFmtHz(ownFreqOwn[i]) : "—";
        lines.push(`| ${dENPrefix()}${dEN(i)} | ${hzDef} | ${hzMan} | ${_audCent(r.varFreq, r.refFreq)} | ${_mdFmtHz(r.refFreq)} |`);
      }
    }
    return lines.join("\n") + "\n";
  });
}
```

H2-Titel der Sektion wird über den i18n-Key `audiologSecFreq` gesetzt
(siehe Schritt 9: dort wird er auf „Änderung der Mittenfrequenzen"
umbenannt).

---

## Schritt 7 — Latenz: negativ-Satz weglassen

In `print-md.js`, Funktion `_audiologLatencyBlock(mainSides)`
**ersetzen** durch:

```js
function _audiologLatencyBlock(mainSides) {
  if (typeof latencyResult === "undefined" || !latencyResult) return "";
  if (!isFinite(latencyResult.valueMs)) return "";
  const ms = latencyResult.valueMs;
  if (ms === 0) return "";
  const latActive = (typeof plApplyLatency !== "undefined") && plApplyLatency
                 && (mainSides.length === 2);
  const earlierSide = ms >= 0 ? t("sideLeft")  : t("sideRight");
  const laterSide   = ms >= 0 ? t("sideRight") : t("sideLeft");
  const lines = [];
  lines.push(`## ${t("audiologSecLatency")}`);
  lines.push("");
  lines.push(`- ${t("audiologLatValue")}: **${Math.abs(ms).toFixed(2)} ms**`);
  lines.push(`- ${t("audiologLatImpact")
    .replace("{earlier}", earlierSide)
    .replace("{later}", laterSide)}`);
  // Nur den positiven Satz ausgeben:
  if (latActive) {
    lines.push(`- ${t("audiologLatIncluded")}`);
  }
  lines.push("");
  return lines.join("\n");
}
```

---

## Schritt 8 — Fehlende-Implantat-Angaben um THR und eigene Hz ergänzen

In `print-md.js`, Funktion `_audiologMissingImplantData(mainSides)`
**ersetzen** durch:

```js
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
    const thrSet = (impl.thr || []).some((v) => v != null && isFinite(v));
    if (!thrSet) missing.push(t("audMissThr"));
    const freqOwnSet = (sd && sd.elFreqOwn || []).some((v) => v != null && isFinite(v));
    if (!freqOwnSet) missing.push(t("audMissFreqOwn"));
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
```

---

## Schritt 9 — i18n-Keys anpassen

In `i18n.js`, im DE-Block:

**Ändern**:
- `audiologSecFreq` von `"Frequenz-Änderung"` zu `"Änderung der Mittenfrequenzen"`

**Hinzufügen**:
```js
    audiologToolVersionLine: "Meßwerte ermittelt mit CI Sound Balancing Tool {VERSION} (www.ci-sound-balancing.org)",
    audColHzDefault: "Hz Default",
    audColHzManual: "Hz (manuell eingetragen)",
    audColHzWish: "Gewünschte Mittenfrequenz",
    audMissThr: "THR (T-Levels)",
    audMissFreqOwn: "derzeit eingestellte Mittenfrequenzen je Elektrode",
```

**Entfernen** (nicht mehr verwendet):
- `audiologSecRequests`
- `audiologRequestsBody`
- `audiologSecUserNote`
- `audColHzOld` (war: „bisher Hz")
- `audColHzNew` (war: „neu Hz")
- `audiologToolVersion` (war: „Tool-Version" — wird durch `audiologToolVersionLine` ersetzt)

**Vor dem Entfernen** mit `grep -n "audiologSecRequests" *.js *.html`
o.ä. prüfen, daß die Keys wirklich nirgendwo sonst referenziert
werden. In den anderen Sprach-Blöcken (en/fr/es) analog.

---

## Schritt 10 — `_audiologGeneralRequests` entfernen

In `print-md.js`, Funktion `_audiologGeneralRequests()` komplett
löschen — sie wird in `buildAudiologMarkdown` nicht mehr aufgerufen
und ist toter Code.

Analog: wenn die alte Funktion `_audiologMaplawForSide(side)` aus
BA 42 noch existiert (sie wird in Schritt 4 durch
`_audiologMaplawSection` ersetzt), die alte Funktion löschen.

---

## Schritt 11 — Druck-Output: Tool-Version-Footer entfernen

In `print-md.js`, `audiologPrint()` (heute Z. ~1170), die Footer-Zeile

```js
const footer = `<hr><div style="font-size:0.75em;color:#444;text-align:center;margin-top:12px;">CI Sound Balancing Tool` +
               (typeof APP_VERSION !== "undefined" ? ` v${APP_VERSION}` : "") +
               ` · ${new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US")}</div>`;
body = body + footer;
```

**löschen** und durch eine **leere** Footer-Behandlung ersetzen
(also die Zeile `body = body + footer;` entfernen) — die Versions-
Information steht jetzt **oben** als Tool-Version-Zeile direkt unter
dem Datum/Side-Header (`audiologToolVersionLine`). Doppelung
vermeiden.

---

## Schritt 12 — CODESTRUKTUR.md aktualisieren

In `CODESTRUKTUR.md`, im Abschnitt für `print-md.js`, die in BA 42
ergänzte Helfer-Liste **anpassen**:

- entfernen: `_audiologMaplawForSide`, `_audiologGeneralRequests`
- hinzufügen: `_audiologMaplawSection`
- in der Liste der i18n-Schlüssel-Stellen darauf hinweisen, daß
  `audiologRequestsBody`, `audiologSecRequests`, `audiologSecUserNote`,
  `audColHzOld`, `audColHzNew`, `audiologToolVersion` entfernt
  wurden und stattdessen `audiologToolVersionLine`, `audColHzDefault`,
  `audColHzManual`, `audColHzWish`, `audMissThr`, `audMissFreqOwn`
  hinzugekommen sind.

---

## Schritt 13 — SPEC.md aktualisieren

In `SPEC.md`, im Abschnitt „Audiologen-Box im Tab Laden/Speichern",
die in BA 42 ersetzte Bericht-Gliederung **anpassen**:

- Punkt 2 („Persönliche Notiz, wenn ausgefüllt") **streichen** —
  die Notiz wandert in den Brief (BA 43).
- Punkt 3 („Pro Seite … MAPLAW-Mini-Block") — letzten Halbsatz
  zum MAPLAW-Mini-Block streichen.
- **Vor** der Frequenz-Sektion (heute Punkt 4) einen neuen Punkt
  „MAPLAW-Änderung — eigene H2-Sektion mit Auflistung pro Seite"
  einfügen.
- Punkt zu „Allgemeine Bitten" und „Footer mit Tool-Version" als
  letzte Punkte streichen — Bitten gehen in den Brief, die Tool-
  Versions-Info steht jetzt im Kopf, nicht im Footer.
- Tabellen-Spalten der Lautstärken-Tabelle aktualisieren (keine
  Hz-Spalte mehr).
- Tabellen-Spalten der Frequenz-Tabelle ergänzen (Hz Default,
  Hz manuell, Δ cent, Gewünschte Mittenfrequenz).

---

## Akzeptanztest

1. **Notiz im Korrekturbericht nicht mehr.** Notiz-Feld in der
   Karte mit Text füllen, „Drucken (mit Grafik)".
   *Erwartet:* keine Sektion „Persönliche Notiz" im Korrektur-
   Bericht. (Sie erscheint erst nach BA 43 im Brief.)

2. **Allgemeine Bitten weg.** Druck-Output bis zum Ende durchsehen.
   *Erwartet:* keine Sektion „Allgemeine Bitten". Hinweise für den
   Audiologen + Fehlende Implantat-Angaben sind weiterhin am Ende
   sichtbar.

3. **Tool-Version-Zeile.** Im Kopf nach Datum/Side-Auswahl.
   *Erwartet:* Italic-Zeile „Meßwerte ermittelt mit CI Sound
   Balancing Tool v<VERSION> (www.ci-sound-balancing.org)". Im
   Footer steht keine Tool-Version mehr.

4. **Testprogramm-Hinweis oben.** Schieber und Kurven auf 0,
   NH-Sim aus, EQ an.
   *Erwartet:* Blockquote „Testprogramm erkannt" steht direkt unter
   der Tool-Version-Zeile, nicht mehr am Ende.

5. **Konfig-Label.** Im Reiter Implantat „CI" als Konfiguration für
   die gedruckte Seite wählen. Drucken.
   *Erwartet:* Sub-Kopf zeigt „RECHTS — CI" (oder „LINKS — CI"),
   nicht „RECHTS - ci".

6. **Hersteller-Label.** Sub-Kopf-Meta-Zeile.
   *Erwartet:* „Hersteller: MED-EL", nicht „Hersteller: medel".
   Falls Cache: Hard-Reload.

7. **Lautstärken-Tabelle ohne Hz-Spalte.** *Erwartet:* Spalten sind
   Elektrode, Δ dB, Residuum, MCL, Δ MCL, neuer MCL, Status, Notiz.

8. **Mehr Luft in Tabellen-Zellen.** Visuell vergleichen mit dem
   Vor-Zustand. *Erwartet:* Zahlen quetschen nicht mehr am Rand,
   spürbar mehr Padding links und rechts.

9. **MAPLAW eigene Sektion.** Im Player MAPLAW aktivieren, einen
   abweichenden Soll-c-Wert eintragen (z.B. 800 statt 1000),
   für eine MED-EL-Seite den gleichen Ist-c-Wert (1000) im Implantat-
   Reiter setzen.
   *Erwartet:* Sektion „MAPLAW-Änderung" als eigene H2-Überschrift
   **zwischen** den Seiten-Loudness-Tabellen und der Frequenz-
   Sektion, mit Auflistung pro betroffener Seite („Links: MAPLAW c
   **1000 → 800**").

10. **Frequenz-Tabelle: neuer Titel + Spalten.** Warp einschalten,
    Frequenz-Match-Werte vorhanden, drucken.
    *Erwartet:* H2 „Änderung der Mittenfrequenzen". Spalten:
    Elektrode, Hz Default, Hz (manuell eingetragen), Δ cent,
    Gewünschte Mittenfrequenz. Bei sym-Warp + einseitig: zusätzlich
    Δ cent (Andere Seite) und Gewünschte Mittenfrequenz (Andere
    Seite) mit Doppel-Trennstrich.

11. **Latenz-Block kürzer.** Latenz-Messung vorhanden, einseitiger
    Druck.
    *Erwartet:* Sektion Latenz zeigt Wert + Auswirkung-Satz; **kein**
    Satz „Die Latenz ist im Player aktuell nicht ausgeglichen.".

12. **Latenz-Block bei beidseitigem Druck mit aktivem Ausgleich.**
    Side „Beide", `plApplyLatency` an.
    *Erwartet:* Satz „Die Latenz ist im Player bereits ausgeglichen."
    bleibt sichtbar.

13. **Fehlende-Daten-Block: THR und eigene Hz.** Im Reiter Implantat
    THR-Werte leer lassen, ebenso die manuell eingegebenen Mitten-
    frequenzen (elFreqOwn auf Default).
    *Erwartet:* In „Fehlende Implantat-Angaben" erscheinen die
    beiden neuen Punkte: „THR (T-Levels)" und „derzeit eingestellte
    Mittenfrequenzen je Elektrode".

14. **Footer leer/sauber.** *Erwartet:* unten am Bericht steht kein
    separater Tool-Version-Footer mehr.

15. **Markdown-Export prüfen.** Knopf „Markdown Text exportieren".
    *Erwartet:* Datei enthält dieselben Sektionen wie der Druck
    (außer Bar-Chart-Bildern). Keine Bitten-Sektion mehr, keine
    Notiz-Sektion mehr.

---

## Selbstprüfungs-Auftrag an Sonnet

Bevor du dem Nutzer „fertig" meldest, jede Akzeptanz-Kriterie
einzeln durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, jeweils mit konkreter Datei- und Zeilenangabe der Stelle,
die das Verhalten erzeugt.

Wenn du etwas als unklar markierst, ist das ein Signal zur
Rückfrage, nicht zur stillschweigenden Annahme.

Prüfe insbesondere:
- Ist `_audiologGeneralRequests` aus `print-md.js` wirklich
  vollständig entfernt (kein Aufruf, keine Funktionsdefinition)?
- Ist `_audiologMaplawForSide` entfernt und durch
  `_audiologMaplawSection` ersetzt?
- Sind die in Schritt 9 markierten i18n-Keys (`audiologSecRequests`,
  `audiologRequestsBody`, `audiologSecUserNote`, `audColHzOld`,
  `audColHzNew`, `audiologToolVersion`) wirklich aus allen vier
  Sprach-Blöcken entfernt? `grep -n` zur Bestätigung.
- Lieferte der Hersteller-Label-Pfad „MED-EL" oder noch „medel"?
  Wenn „medel", in der Konsole `console.log` einbauen und Ergebnis
  an den Nutzer melden — kein blinder Code-Umbau.
- Ist der Konfig-Label-Bug aus Schritt 1 behoben (z.B. zeigt
  Bericht „LINKS — CI" statt „LINKS — ci")?
- Sind die `audColHzDefault`/`audColHzManual`/`audColHzWish`-
  Spalten in allen vier Sprach-Blöcken vorhanden, damit
  `_audiologFreqTable` nicht „undefined" als Header schreibt?
