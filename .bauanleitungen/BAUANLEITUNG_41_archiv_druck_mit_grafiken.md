# Bauanleitung 41: Archiv-Bericht — Druck mit Grafiken

Setzt Bauanleitung 40 voraus. Wir nutzen den dort gebauten
Datensammler `collectArchivData()` und den Markdown-Renderer
`renderArchivMarkdown(data)` als gemeinsame Basis. Der heutige
DOM-basierte Inline-Handler in `init.js` (Z. 169–680, ca. 500
Zeilen) wird vollständig **ersetzt** durch einen schlanken Aufruf
des neuen Druck-Renderers `renderArchivPrintHtml(data)`.

## Ziel

„Bericht drucken" liefert dieselben Sektionen wie der Markdown-
Export, ergänzt um **Grafiken**:

| Sektion | Grafik wann? |
|---|---|
| Messungen Elektrodenlautstärke (pro Seite) | wenn `sd.meas.hasNonZero === true` |
| Schieber (pro Seite) | wenn `sd.schieber.has === true` |
| Kurven (pro Seite) | wenn `sd.kurven.has === true` |
| Frequenzabgleich (pro Seite) | wenn `sd.freqmatch.has === true` |
| Stereo-Balance (bilateral) | wenn `data.bilateral.lr.has === true` |
| Player-EQ | wenn `data.player.eqHasNonZero === true` (pro Seite, je nach Side-Modus) |

Latenz erhält keine Grafik (Highlight-Box-Text wie heute im
Reiter Meßergebnisse).

Berührt: `print-md.js` (sechs neue Render-Funktionen +
`renderArchivPrintHtml`), `init.js` (Inline-Handler entfernen
und 1 Zeile setzen), `CODESTRUKTUR.md`, `SPEC.md`.

---

## Schritt 1 — Sechs Canvas-Renderer in `print-md.js`

Am Ende von `print-md.js` (nach den Audiologen-Funktionen) den
folgenden Block einfügen. Alle Renderer liefern eine PNG-Data-URL
oder `""`. Sie zeichnen auf ein **eigenes offscreen-Canvas** —
nicht auf die UI-Canvases —, damit sichtbare Tabs nicht beeinflußt
werden. `withSide(side, fn)` wird benutzt, damit die Live-Views
(`mfr`, `nEl`, `elSt`, `manualLevels`, `presets`, `bRes`, …)
korrekt auf der gewünschten Seite stehen.

```js
// ----------------------------------------------------------------
// CHART-RENDERER für Archiv-Druck
// Liefern PNG-Data-URLs für die HTML-Druckseite. Alle Renderer
// zeichnen offscreen und greifen nicht auf UI-Canvas zu.
// ----------------------------------------------------------------

const _ARCHIV_CHART_W = 720;
const _ARCHIV_CHART_H = 240;

function _archivMkCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = w || _ARCHIV_CHART_W;
  c.height = h || _ARCHIV_CHART_H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  return { canvas: c, ctx };
}

function _archivDrawAxis(ctx, pad, W, H, maxAbs, opts) {
  const pW = W - pad.l - pad.r;
  const pH = H - pad.t - pad.b;
  const zY = pad.t + pH / 2;
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(pad.l, zY);
  ctx.lineTo(W - pad.r, zY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("+" + maxAbs, pad.l - 4, pad.t + 10);
  ctx.fillText("0",          pad.l - 4, zY + 3);
  ctx.fillText("-" + maxAbs, pad.l - 4, H - pad.b + 2);
  if (opts && opts.title) {
    ctx.fillStyle = "#000";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(opts.title, pad.l, 14);
  }
  return { pW, pH, zY };
}

// 1. Loudness-Balance (Meßergebnis-Sub-Tab 1)
function _archivChartLoudness(sideBlock) {
  if (!sideBlock.meas.hasNonZero) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = sideBlock.meas.rows;
  let maxAbs = 1;
  for (const r of rows) if (r.offsetDb != null) maxAbs = Math.max(maxAbs, Math.abs(r.offsetDb));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecMeas")} — ${sideBlock.label}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    if (r.offsetDb == null) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 1, w, 2);
    } else {
      const h = (Math.abs(r.offsetDb) / maxAbs) * (pH / 2);
      ctx.fillStyle = (r.idx === sideBlock.meas.refEl) ? "#a855f7"
                    : r.offsetDb >= 0 ? "#16a34a" : "#dc2626";
      if (r.offsetDb >= 0) ctx.fillRect(x, zY - h, w, h);
      else                 ctx.fillRect(x, zY,    w, h);
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 2. Schieber (Schieber-Tab, relative dB-Werte)
function _archivChartSchieber(sideBlock) {
  if (!sideBlock.schieber.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = sideBlock.schieber.rows;
  let maxAbs = 1;
  for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.relDb || 0));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecSchieber")} — ${sideBlock.label}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    const v = r.relDb || 0;
    if (Math.abs(v) < 0.05) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 1, w, 2);
    } else {
      const h = (Math.abs(v) / maxAbs) * (pH / 2);
      ctx.fillStyle = "#16a34a"; // Schieber-Farbe (grün)
      if (v >= 0) ctx.fillRect(x, zY - h, w, h);
      else        ctx.fillRect(x, zY,    w, h);
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 3. Kurven (4-Linien-Chart, vereinfacht — eine Linie pro aktive Kurvenfunktion + Summe)
function _archivChartKurven(sideBlock) {
  if (!sideBlock.kurven.has) return "";
  return withSide(sideBlock.side, () => {
    // Wir reusen calcPresetCurve und getTotalPresetCurve aus levels.js,
    // berechnen die Kurven aber gegen ein eigenes Canvas. Stil:
    // hellgraue Hilfslinien, je aktive Kurve in eigener Farbe als
    // dünne Linie, Summe als dicke schwarze Linie. X = Elektroden,
    // Y = dB.
    const { canvas, ctx } = _archivMkCanvas();
    const W = canvas.width, H = canvas.height;
    const pad = { l: 36, r: 14, t: 22, b: 28 };
    const n = nEl;
    const total = getTotalPresetCurve();
    let maxAbs = 1;
    for (let i = 0; i < n; i++) maxAbs = Math.max(maxAbs, Math.abs(total[i] || 0));
    maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
    const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
      title: `${t("archivSecKurven")} — ${sideBlock.label}`,
    });
    const gW = pW / Math.max(1, n - 1);
    const yFor = (v) => zY - (v / maxAbs) * (pH / 2);
    // Pro Kurvenfunktion eine Linie zeichnen
    const COLORS = ["#3b82f6", "#f97316", "#a855f7", "#06b6d4", "#84cc16", "#eab308", "#ec4899", "#14b8a6"];
    let ci = 0;
    for (const p of presets) {
      if (!p.on || p.strength === 0) continue;
      const curve = calcPresetCurve(p, n);
      ctx.strokeStyle = COLORS[ci % COLORS.length];
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const x = pad.l + i * gW;
        const y = yFor(curve[i] || 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ci++;
    }
    // Summen-Linie (dick, schwarz)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = pad.l + i * gW;
      const y = yFor(total[i] || 0);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // X-Achsen-Beschriftung jede zweite Elektrode
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    for (let i = 0; i < n; i++) {
      if (i % 2 !== 0 && n > 8) continue;
      const x = pad.l + i * gW;
      ctx.fillText(sideBlock.implant.electrodes[i].label, x, H - pad.b + 14);
    }
    return canvas.toDataURL("image/png");
  });
}

// 4. Frequenzabgleich (log-Hz x lin-Cent)
function _archivChartFreqmatch(sideBlock) {
  if (!sideBlock.freqmatch.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 40, r: 14, t: 22, b: 28 };
  const rows = sideBlock.freqmatch.rows;
  let maxAbsCent = 50;
  for (const r of rows) maxAbsCent = Math.max(maxAbsCent, Math.abs(r.cent));
  maxAbsCent = Math.ceil(maxAbsCent / 50) * 50;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbsCent + " ¢", {
    title: `${t("fmResultsTitle")} — ${sideBlock.label}`,
  });
  const freqs = rows.map((r) => r.varFreq);
  const fMin = Math.min(...freqs, 100), fMax = Math.max(...freqs, 8000);
  const xFor = (hz) => pad.l + (Math.log2(hz / fMin) / Math.log2(fMax / fMin)) * pW;
  for (const r of rows) {
    const x = xFor(r.varFreq);
    const y = zY - (r.cent / maxAbsCent) * (pH / 2);
    ctx.beginPath();
    ctx.fillStyle = r.cent >= 0 ? "#16a34a" : "#dc2626";
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.elLabel, x, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 5. Stereo-Balance (bilateral)
function _archivChartLR(bilateral) {
  if (!bilateral.lr.has) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  const rows = bilateral.lr.rows;
  let maxAbs = 1;
  for (const r of rows) maxAbs = Math.max(maxAbs, Math.abs(r.value));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("balTitle")}`,
  });
  const gW = pW / rows.length;
  for (let j = 0; j < rows.length; j++) {
    const r = rows[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    const h = (Math.abs(r.value) / maxAbs) * (pH / 2);
    ctx.fillStyle = r.value >= 0 ? "#3b82f6" : "#dc2626";
    if (r.value >= 0) ctx.fillRect(x, zY - h, w, h);
    else              ctx.fillRect(x, zY,    w, h);
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`E${r.elIdx + 1}`, x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}

// 6. Player-EQ pro Seite (nutzt eqGains aus data.player)
function _archivChartPlayerEq(sideBlock, playerEqArr) {
  if (!playerEqArr || playerEqArr.length === 0) return "";
  if (!playerEqArr.some((v) => Math.abs(v) > 0)) return "";
  const { canvas, ctx } = _archivMkCanvas();
  const W = canvas.width, H = canvas.height;
  const pad = { l: 36, r: 14, t: 22, b: 28 };
  let maxAbs = 1;
  for (const v of playerEqArr) maxAbs = Math.max(maxAbs, Math.abs(v));
  maxAbs = Math.ceil(maxAbs / 2) * 2 + 2;
  const { pW, pH, zY } = _archivDrawAxis(ctx, pad, W, H, maxAbs, {
    title: `${t("archivSecPlayer")} EQ — ${sideBlock.label}`,
  });
  const gW = pW / playerEqArr.length;
  for (let j = 0; j < playerEqArr.length; j++) {
    const v = playerEqArr[j];
    const x = pad.l + j * gW + 2;
    const w = Math.max(2, gW - 4);
    if (Math.abs(v) < 0.05) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(x, zY - 1, w, 2);
    } else {
      const h = (Math.abs(v) / maxAbs) * (pH / 2);
      ctx.fillStyle = v >= 0 ? "#16a34a" : "#dc2626";
      if (v >= 0) ctx.fillRect(x, zY - h, w, h);
      else        ctx.fillRect(x, zY,    w, h);
    }
    ctx.fillStyle = "#555";
    ctx.font = "9px sans-serif";
    ctx.textAlign = "center";
    const el = sideBlock.implant.electrodes[j];
    ctx.fillText(el ? el.label : ("E" + (j + 1)), x + w / 2, H - pad.b + 14);
  }
  return canvas.toDataURL("image/png");
}
```

**Hinweis für Sonnet**: Bei `_archivChartKurven` wird `presets`,
`nEl`, `calcPresetCurve`, `getTotalPresetCurve` aus dem globalen
Scope gelesen — `withSide(side, fn)` muß diese korrekt binden.
Wenn beim Test eine Seite leere Kurvenfunktionen hat, gibt der
Renderer eine fast-leere Grafik (nur Achsen + Summe ≈ 0); das ist
okay, weil der Aufruf vor dem `hasNonZero`-Gate steht. Aufruf
erfolgt nur, wenn `sideBlock.kurven.has === true`.

---

## Schritt 2 — Druck-HTML-Renderer

Nach den Chart-Renderern in `print-md.js` die folgende Funktion
einfügen. Sie ruft den Markdown-Renderer aus Bauanleitung 40 auf,
konvertiert zu HTML über `_mdToHtmlBasic` und fügt die Grafiken an
den passenden Stellen ein. Strategie: pro Sektion wird die HTML
neu zusammengesetzt, statt im Markdown-Text zu suchen — dadurch
landet jede Grafik exakt vor ihrer Sektions-Tabelle.

```js
// ----------------------------------------------------------------
// DRUCK-HTML — Archiv (Modus A)
// ----------------------------------------------------------------

function renderArchivPrintHtml(data) {
  const md = renderArchivMarkdown(data);
  // Mini-HTML-Konverter (Audiologen-Helfer wiederverwenden)
  const html = _mdToHtmlBasic(md);
  // Grafiken sammeln, mit Anker-Texten, die im konvertierten HTML
  // identifizierbar sind. Ankerstrategie: H3-Titel der jeweiligen
  // Sektion. Sonnet: bei Sektions-Anker bitte den gerenderten H3-
  // Text in language-aktueller Übersetzung verwenden.
  const inserts = [];
  for (const side of ["left", "right"]) {
    const sd = data.sides[side];
    if (sd.meas.hasNonZero) {
      inserts.push({
        anchorH3: `${t("archivSecMeas")} (`,    // H3 beginnt mit "Messungen ("
        sideOnlyUnder: sd.label,                 // muß unter H2=sd.label sein
        img: _archivChartLoudness(sd),
      });
    }
    if (sd.schieber.has) {
      inserts.push({
        anchorH3: `${t("archivSecSchieber")} (`,
        sideOnlyUnder: sd.label,
        img: _archivChartSchieber(sd),
      });
    }
    if (sd.kurven.has) {
      inserts.push({
        anchorH3: `${t("archivSecKurven")}`,
        sideOnlyUnder: sd.label,
        img: _archivChartKurven(sd),
      });
    }
    if (sd.freqmatch.has) {
      inserts.push({
        anchorH3: `${t("fmResultsTitle")}`,
        sideOnlyUnder: sd.label,
        img: _archivChartFreqmatch(sd),
      });
    }
  }
  if (data.bilateral.lr.has) {
    inserts.push({
      anchorH3: `${t("balTitle")}`,
      sideOnlyUnder: null,
      img: _archivChartLR(data.bilateral),
    });
  }
  if (data.player.eqHasNonZero) {
    // Pro Seite je nach Side-Modus eine Grafik ans Ende der Player-
    // Sektion. Wir hängen sie über einen Sonder-Marker `__PLAYER_EQ__`
    // an, der vom Splitter erkannt wird.
    inserts.push({
      anchorH2: `${t("archivSecPlayer")}`,
      isPlayerEq: true,
      data,
    });
  }
  const enrichedHtml = _archivInjectInserts(html, inserts);
  const styles = `
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    h1 { margin-top: 0; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    h3 { margin-top: 14px; }
    table { font-size: 0.85em; }
    img.archiv-chart { display: block; max-width: 100%; margin: 6px 0 10px 0; }
    @media print { body { margin: 0; padding: 0; } }
  `;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("archivTitle")}</title><style>${styles}</style></head><body>${enrichedHtml}</body></html>`;
}

function _archivInjectInserts(html, inserts) {
  // Splitten an H2/H3-Tags, dabei pro Sektion entscheiden, ob ein
  // Insert davor oder dahinter eingehängt werden muß.
  // Strategie: parse als Knoten-Liste, prüfe je Insert via String-
  // Matching nach dem H3-Tag-Text mit anchorH3. Wir verwenden ein
  // einfaches Splitten an `<h3>...</h3>` bzw. `<h2>...</h2>`.
  let out = html;
  let currentH2 = null;
  const re = /<h([23])>([^<]+)<\/h\1>/g;
  // Wir transformieren: nach jedem matched H3 prüfen wir, ob ein
  // Insert mit passendem anchorH3 unter dem aktuellen H2 (sideOnlyUnder)
  // wartet, und hängen das <img> dahinter.
  out = out.replace(re, (full, lvl, text) => {
    if (lvl === "2") {
      currentH2 = text.trim();
      // Player-EQ-Insert: kommt ans Ende der Player-Sektion. Hier
      // markieren wir die Position via Platzhalter, der nach der
      // ersten Pass-through ausgewertet wird.
      const playerInsert = inserts.find((i) => i.isPlayerEq && i.anchorH2 === currentH2);
      if (playerInsert) {
        return `${full}<!--__PLAYER_EQ_INSERT__-->`;
      }
      return full;
    }
    // lvl === "3"
    for (const ins of inserts) {
      if (ins.isPlayerEq) continue;
      if (ins._used) continue;
      if (ins.sideOnlyUnder && currentH2 !== ins.sideOnlyUnder) continue;
      if (!text.startsWith(ins.anchorH3)) continue;
      ins._used = true;
      if (!ins.img) return full;
      return `${full}<img class="archiv-chart" src="${ins.img}" alt="" />`;
    }
    return full;
  });
  // Player-EQ-Inserts an Marker ersetzen
  const playerInsert = inserts.find((i) => i.isPlayerEq);
  if (playerInsert) {
    const data = playerInsert.data;
    const playerImgs = [];
    const mode = data.player.sideMode;
    const renderFor = (side) => {
      const img = _archivChartPlayerEq(data.sides[side], data.player.eqGains[side]);
      if (img) playerImgs.push(`<img class="archiv-chart" src="${img}" alt="" />`);
    };
    if (mode === "left")  renderFor("left");
    else if (mode === "right") renderFor("right");
    else { renderFor("left"); renderFor("right"); }
    out = out.replace("<!--__PLAYER_EQ_INSERT__-->", playerImgs.join(""));
  }
  return out;
}
```

**Wichtig**: `_archivInjectInserts` parst die H2/H3-Tags via
`String.replace`-Regex. Der Anker-String `anchorH3` ist der
**Anfang** des H3-Textes. Beispiel: das H3 lautet
`Messungen (Referenz: E5)` — `anchorH3` ist daher `"Messungen ("`
(genau so wie i18n liefert). Sonnet: **nicht** die Strings
hartcodieren, immer `t("…")` benutzen, sonst stimmt der Anker im
englischen Build nicht überein.

---

## Schritt 3 — Inline-Handler in `init.js` ersetzen

In `init.js`, **alle Zeilen von Z. 169 bis einschließlich Z. 680**
(also der gesamte `document.getElementById("fPrintBtn")
.addEventListener("click", async () => { … })`-Block) werden durch
folgende **acht** Zeilen ersetzt:

```js
  document.getElementById("fPrintBtn").addEventListener("click", () => {
    const data = collectArchivData();
    const html = renderArchivPrintHtml(data);
    const w = window.open("", "_blank");
    if (!w) { alert("Popup blockiert"); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  });
```

Damit fallen die Hilfsfunktionen `getStatusText`, `getResiduum`,
`formatPresetParams`, `drawEqImageForSide`, `collectSideData`,
`generatePage`, sowie die ganze HTML-Konkatenation weg — sie sind
ersatzlos abgedeckt durch den neuen Pfad.

**Zur Erinnerung**: der gleichnamige `audiologPrint`-Handler in
`print-md.js` und seine Verdrahtung `fAudiologPrintBtn` bleibt
unangetastet.

---

## Schritt 4 — Hinweis-Text in der Archiv-Karte aktualisieren

Da die Druck-Ausgabe jetzt die exakt selben Inhalte hat wie das
Markdown, ist der bisherige Hinweistext `archivExplain` (z.B.
„Die Einstellungen im Player werden beim Ausdruck berücksichtigt
…") nur ein Subset der Wahrheit. Wir lassen ihn unverändert, weil
die Aussage stimmt; ergänzen ihn aber NICHT. Falls Sonnet die
Karte ohnehin gerade berührt: keinen Text ändern.

---

## Schritt 5 — Referenzdateien aktualisieren

### CODESTRUKTUR.md

In der Zeile `12d | print-md.js` (ergänze nach dem in Bauanleitung
40 geänderten Text):

> […] Modus A: Datensammler `collectArchivData`, Markdown-Renderer
> `renderArchivMarkdown` mit `_archivMd*`-Helfern, Druck-HTML-
> Renderer `renderArchivPrintHtml` plus sechs Canvas-Renderer
> (`_archivChartLoudness`, `_archivChartSchieber`,
> `_archivChartKurven`, `_archivChartFreqmatch`, `_archivChartLR`,
> `_archivChartPlayerEq`) und der HTML-Injector `_archivInjectInserts`.
> […]

Im Datenfluss-Abschnitt den Absatz „Markdown-Export (Archiv-Box)"
erweitern um:

> Druck (`fPrintBtn`) ruft `renderArchivPrintHtml(collectArchivData())`,
> wandelt den Markdown über den vorhandenen `_mdToHtmlBasic`-
> Konverter in HTML und hängt PNG-Grafiken pro Sektion ein
> (Messungen-Loudness, Schieber, Kurven, Frequenzabgleich,
> Stereo-Balance, Player-EQ — pro Seite je nach `*.has`-Gate). Der
> alte DOM-basierte Inline-Handler in init.js ist entfernt.

### SPEC.md

Im Abschnitt „Archiv-Box im Tab Laden/Speichern" den Druck-Absatz
ersetzen durch:

> Druck-Pfad: gemeinsamer Datensammler `collectArchivData()` plus
> `renderArchivPrintHtml(data)`. Der Bericht enthält dieselben
> Sektionen wie der Markdown-Export, ergänzt um eingebettete
> PNG-Grafiken zu jeder Sektion, in der Werte ≠ 0 vorliegen:
> Messungen Elektrodenlautstärke, Schieber, Kurven,
> Frequenzabgleich (pro Seite); Stereo-Balance bilateral; Player-EQ
> (pro Seite je nach Side-Modus). Latenz erscheint nur als
> Textsektion.

---

## Akzeptanztest-Checkliste

Schritte durchführen, erwartetes Ergebnis in Klammern.

1. Tool öffnen, **Reset** klicken. Im Tab Laden/Speichern auf
   „**Bericht drucken**" klicken.
   → Druckvorschau öffnet sich. Sichtbare Sektionen: Kopf,
     Konfiguration, Implantat-Tabelle, Test-Einstellungen,
     Player, Sonstiges. **Keine Grafiken** erscheinen (alle
     `has`-Gates sind aus).
2. Im Implantat-Tab THR/MCL für ein paar Elektroden setzen.
   Bericht drucken.
   → Implantat-Tabelle in der Druckvorschau zeigt die Werte.
3. Test 1 starten und drei Paare bestätigen. Bericht drucken.
   → Sektion `Rechts → Messungen (Referenz: E…)` enthält **eine
     Loudness-Balken-Grafik direkt nach dem H3**, danach die
     Tabelle.
4. Im Schieber-Tab eine Elektrode um +3 dB anheben. Bericht
   drucken.
   → Sektion `Rechts → Schieber (relativ)` enthält **eine
     Schieber-Grafik vor der Tabelle**.
5. Im Kurven-Tab „Lautstärke" mit +5 dB aktivieren. Bericht drucken.
   → Sektion `Rechts → Kurven` enthält **eine Kurven-Grafik**
     (mit Summen-Linie sichtbar).
6. Frequenzabgleich-Test einen Wert bestätigen. Bericht drucken.
   → Sektion `Rechts → Frequenzabgleich` enthält **eine Punkt-
     Grafik mit log-Hz-Achse**.
7. Stereo-Balance einen Wert bestätigen. Bericht drucken.
   → Sektion `Bilateral → Stereo-Balance` enthält **eine Bar-Grafik**.
8. Player-EQ aktiv, Stärke 100 %, Quellen-Toggles an, Messungen
   vorhanden. Bericht drucken.
   → Am Ende der Sektion `Player` erscheinen **eine oder zwei**
     Player-EQ-Grafiken (je nach Side-Modus: links/rechts/beide).
9. Side-Modus auf „Links" stellen. Bericht drucken.
   → Nur **eine** Player-EQ-Grafik (für „Links").
10. Im Player Warp aktivieren, Methode Vocoder. Bericht drucken.
    → Im Player-Block Text-Zeile „Frequenz-Warping: an (Vocoder, …,
      100%)".
11. Sprache auf English. Bericht drucken.
    → Alle Sektionstitel und Spaltenüberschriften englisch. Die
      Grafiken bleiben funktional an den richtigen Stellen (Anker
      über `t()` arbeitet sprachneutral).
12. Daten leeren via Reset. „Markdown Text exportieren" und
    „Bericht drucken" parallel ausführen.
    → Beide Ausgaben enthalten dieselben Sektionen mit denselben
      Tabellen; der Druck enthält zusätzlich die Grafiken (wenn
      Daten ≠ 0). Inhalte stimmen sonst überein.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie 1–12 einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe. Insbesondere:

- Schritt 3 — wurden alle Zeilen 169–680 aus init.js entfernt?
  Welche neue Zeilennummern hat der ersetzte Block? Bleiben die
  davor und danach folgenden Listener (`fSaveBtn`, `fLoadBtn`,
  `printImplantBtn`, …) intakt?
- Schritt 1 — beim `_archivChartKurven`-Renderer: ruft er
  `calcPresetCurve` und `getTotalPresetCurve` korrekt nach
  `withSide(sideBlock.side, …)` auf, oder greift er versehentlich
  auf die Live-View der aktuellen Seite zu?
- Schritt 2 — werden die Anker-Strings über `t()` aufgebaut?
  Stimmen die Trefferpositionen in mind. einer Stichprobe
  englisch + französisch?
- Im Stereo-Modus (Player „Beide Seiten") erscheinen exakt zwei
  Player-EQ-Grafiken, im Mono-Modus genau eine.
- Wenn `data.player.eqOn === false`, sind alle Werte in
  `eqGains.left` und `eqGains.right` gleich 0 → `eqHasNonZero` ist
  false → keine Player-EQ-Grafik im Druck.

Falls etwas unklar ist: nicht annehmen, sondern zurückfragen.
