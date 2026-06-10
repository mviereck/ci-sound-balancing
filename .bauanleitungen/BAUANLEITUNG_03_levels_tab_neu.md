# Bauanleitung 03 — Neuer Tab „Schieber" (zukünftig „Levels")

## Ziel

Ein neuer Haupt-Tab mit senkrechten Balken pro Elektrode. Der Tab
heißt in dieser Bauanleitung provisorisch **„Schieber"**
(`data-tab="schieber"`). Umbenennung zu „Levels" passiert in
Bauanleitung 04, sobald der alte Levels-Tab zu „Kurven" wurde.

In dieser Bauanleitung bleibt **alles andere unverändert**: der alte
Levels-Tab existiert weiter, der Player hat weiter zwei Source-Buttons,
und `manualLevels` ist der gemeinsame State. Änderungen im neuen Tab
spiegeln sich im alten Manuell-Grid sofort und umgekehrt — das ist
gewollt.

## Was der neue Tab können soll

- **Senkrechte Balken**, ein Balken pro Elektrode. Bei 12/16/22
  Elektroden alle nebeneinander. Anzeige-Konvention konsistent zu den
  Ergebnis-Tabs: deaktivierte und mute-geschaltete Elektroden bekommen
  einen hellgrauen Balken über die volle Y-Achsen-Höhe mit dunkelgrauer
  X-Diagonale (Ecke-zu-Ecke). Keine dB-Beschriftung, kein Summen-Marker
  auf solchen Spalten; Beschriftungen unten in gedämpfter Farbe.
- **Nullinie in der Mitte**, Skala ±60 dB.
- **Diverging stacked bar**: positive Anteile aktiver Quellen werden
  über der Nullinie gestapelt, negative drunter. Quelle = Farbe:
  - Schieber (= `manualLevels`): grün `#16a34a`
  - Messung (= `compWLS().levels`): blau `#2563eb`
  - Kurven (= `getTotalPresetCurve()`): orange `#d97706`
  Schieber-Anteil ist immer sichtbar; Messung und Kurven werden über
  Toggles oberhalb der Balken zugeschaltet (Default beide aus).
- **Summen-Marker**: dicker schwarzer Querstrich am Netto-Wert (Summe
  aller aktiven Anteile inklusive Schieber).
- **dB-Beschriftung oberhalb des Balkens**, zwei Zeilen:
  - Zeile 1: Schieber-Wert groß, mit Vorzeichen, eine Nachkommastelle
    (z.B. „+2.5", „−0.7").
  - Zeile 2: nur wenn mindestens einer der Toggles Messung/Kurven aktiv
    ist: in Klammern „(S: ±X.X)" mit dem aktuellen Summenwert.
- **Beschriftung unterhalb des Balkens**: Elektrodennummer (`dEN(i)`
  mit Präfix), darunter Hz-Wert (`effFreq(i)`, gerundet).
- **Pfeiltasten-Navigation**:
  - ←/→ wechselt zwischen Balken — **nur aktive Elektroden** (per
    `actEl()`), deaktivierte und mute werden übersprungen. Highlight
    sichtbar.
  - ↑/↓ ändert den Schieber-Wert der fokussierten Elektrode um 0.5 dB
    (mit Shift: 0.1 dB). Bereich: −60..+60.
  - Fokus-robust auch nach Klick auf Buttons/Checkboxen.
- **„Alles auf 0"-Button** oberhalb der Balken: setzt alle
  `manualLevels` für die aktive Seite zurück auf 0.
- **Drei Quell-Toggles oberhalb der Balken**: „Schieber" (immer aktiv,
  nur anzeigend), „Messung" (Default off), „Kurven" (Default off).
  Diese Toggles wirken **nur auf die Anzeige in diesem Tab**, nicht
  auf den Player.

## Vor dem Start lesen

`CODESTRUKTUR.md` und `SPEC.md`. Insbesondere:

- `levels.js` enthält `getEffectiveLevels`, `getTotalPresetCurve`,
  `calcPresetCurve` — die brauchen wir.
- `compWLS()` in `test.js` liefert die Messwerte (Array
  `levels[]` mit Länge `nEl`).
- `state-side.js` definiert `manualLevels` über
  `bindActiveSide()`. Beim Side-Wechsel zeigt die globale Variable auf
  ein neues Array.
- Globale State-Variablen werden in `state-side.js` mit `let`
  deklariert; per Side gehört der Inhalt zu `sideData[side]`.

## Übersicht der Schritte

1. State: zwei Anzeige-Toggles (`lvTabShowMeas`, `lvTabShowCurves`).
2. Neue JS-Datei `levels-tab.js` anlegen mit Skeleton.
3. `index.html`: neuer Tab-Button + neues Panel.
4. CSS: senkrechtes Balkenraster.
5. i18n: neue Strings in allen vier Sprachen.
6. `tabs-eq.js`: Hook für `switchTab("schieber")`.
7. `init.js`: keyboard-handler für den neuen Tab und Reset-Button.
8. `file.js`: Anzeige-Toggles in JSON persistieren (optional).
9. `CODESTRUKTUR.md` updaten (neue Datei, neuer Tab, neue Variablen).
10. `SPEC.md` updaten (Tab-Übersicht).

---

## Schritt 1 — State: zwei Anzeige-Toggles

In `state-side.js` am Ende des Datei-Top-Levels (nach Z. 402, wo
`plSrcLevels` definiert ist) folgenden Block einfügen:

```javascript
// Anzeige-Toggles für den Schieber-Tab.
// Beeinflussen NUR die Darstellung im Tab, nicht den Player.
let lvTabShowMeas = false;
let lvTabShowCurves = false;
```

Diese Variablen leben global (nicht pro Seite). Falls der User später
explizit pro Seite getrennte Anzeige will, kann das nachgezogen werden.

## Schritt 2 — Neue Datei `levels-tab.js`

Neue Datei im Projekt-Root anlegen. Sie wird in `index.html` direkt
**nach `levels.js`** geladen (`levels.js` Position 14 im Ladeverlauf,
neue Datei wird neue Position 15). Ladereihenfolge entscheidend, weil
`levels-tab.js` `getTotalPresetCurve`, `compWLS`, `dEN`, `effFreq`,
`allEl` aufruft.

Skeleton:

```javascript
// ============================================================
// LEVELS-TAB (Schieber)
// ============================================================
// Senkrechte Balken pro Elektrode, eigener State manualLevels (Seite
// gebunden), diverging stacked bar mit drei Quellen.
// Pfeiltasten-Navigation, "Alles auf 0"-Button.

// Fokus-Index der aktuell ausgewählten Elektrode (für Pfeiltasten).
// Pro Tab-Laufzeit gemerkt, nicht pro Seite.
let lvTabFocus = 0;

const LV_TAB_RANGE = 60; // ±60 dB Anzeigebereich

function lvTabRebuild() {
  // Wird bei Tab-Wechsel und nach Side-Wechsel aufgerufen.
  // Aktualisiert Toggles-Status und Canvas-Größe und zeichnet neu.
  const meas = document.getElementById("lvTabChkMeas");
  const cur = document.getElementById("lvTabChkCurves");
  if (meas) meas.checked = lvTabShowMeas;
  if (cur) cur.checked = lvTabShowCurves;
  // Fokus auf aktive Elektroden begrenzen (deaktivierte überspringen)
  const act = actEl();
  if (act.length && !act.includes(lvTabFocus)) lvTabFocus = act[0];
  lvTabDraw();
}

function lvTabDraw() {
  const cv = document.getElementById("lvTabCv");
  if (!cv) return;
  const wp = cv.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const W = wp.clientWidth, H = wp.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  // Alle Elektroden anzeigen (auch deaktivierte als ausgegrauter X-Balken).
  // Für die Werte-Berechnung nur dann etwas eintragen, wenn die Elektrode
  // aktiv ist; deaktivierte/mute werden später anders gezeichnet.
  const all = allEl();
  if (!all.length) return;
  const isExcluded = (i) =>
    elSt[i] === "deactivated" || elSt[i] === "mute" || elExDur[i] !== null;

  // Werte vorbereiten
  const { levels: measArr } = compWLS();
  const preArr = getTotalPresetCurve();
  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const sch = manualLevels[i] || 0;
    const mes = lvTabShowMeas ? (bRes.some((r) => r.a === i || r.b === i) ? measArr[i] : 0) : 0;
    const cur = lvTabShowCurves ? preArr[i] : 0;
    return { i, excluded: false, sch, mes, cur, sum: sch + mes + cur };
  });

  // Layout
  const padTop = 56;   // Platz für dB-Beschriftung (zweizeilig)
  const padBot = 44;   // Platz für E-Nr + Hz
  const padL = 28, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const zeroY = padTop + plotH / 2;
  const slotW = plotW / cols.length;
  const barW = Math.max(8, Math.min(40, slotW * 0.6));
  const yPerDb = plotH / (2 * LV_TAB_RANGE);

  // Hintergrund-Skala-Gitter alle 10 dB
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#999";
  ctx.font = "9px Consolas,monospace";
  ctx.textAlign = "right";
  for (let v = -60; v <= 60; v += 10) {
    const y = zeroY - v * yPerDb;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();
    ctx.fillText((v >= 0 ? "+" : "") + v, padL - 4, y + 3);
  }
  // Nullinie betont
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padL, zeroY);
  ctx.lineTo(W - padR, zeroY);
  ctx.stroke();

  // Farben
  const cSch = "#16a34a"; // grün
  const cMes = "#2563eb"; // blau
  const cCur = "#d97706"; // orange

  // Stack-Helper: einen Anteil ab Startpunkt nach oben oder unten zeichnen
  function drawSegment(xMid, fromY, value, color) {
    if (Math.abs(value) < 0.001) return fromY;
    const dy = -value * yPerDb;
    const toY = fromY + dy;
    ctx.fillStyle = color;
    const y0 = Math.min(fromY, toY);
    const y1 = Math.max(fromY, toY);
    ctx.fillRect(xMid - barW / 2, y0, barW, y1 - y0);
    return toY;
  }

  // Diverging Stack pro Spalte (deaktivierte werden separat behandelt)
  cols.forEach((col, idx) => {
    const xMid = padL + slotW * (idx + 0.5);

    if (col.excluded) {
      // Hellgrauer Balken volle Höhe, X-Diagonale Ecke-zu-Ecke (Konvention
      // wie in den Ergebnis-Tabs).
      const x0 = xMid - barW / 2, x1 = xMid + barW / 2;
      const y0 = padTop, y1 = padTop + plotH;
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(x0, y0, barW, plotH);
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
      ctx.moveTo(x1, y0); ctx.lineTo(x0, y1);
      ctx.stroke();
      // Beschriftung unten in gedämpfter Farbe, kein dB oben
      ctx.textAlign = "center";
      ctx.fillStyle = "#9ca3af";
      ctx.font = "10px Segoe UI,sans-serif";
      ctx.fillText(dENPrefix() + dEN(col.i), xMid, H - padBot + 14);
      ctx.font = "9px Consolas,monospace";
      const f = effFreq(col.i);
      const fTxt = f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f);
      ctx.fillText(fTxt, xMid, H - padBot + 28);
      return;
    }

    // Positive Anteile stapeln oberhalb 0
    let yUp = zeroY;
    const posList = [];
    if (col.sch > 0) posList.push({ v: col.sch, c: cSch });
    if (col.mes > 0) posList.push({ v: col.mes, c: cMes });
    if (col.cur > 0) posList.push({ v: col.cur, c: cCur });
    for (const p of posList) yUp = drawSegment(xMid, yUp, p.v, p.c);

    // Negative Anteile stapeln unterhalb 0
    let yDn = zeroY;
    const negList = [];
    if (col.sch < 0) negList.push({ v: col.sch, c: cSch });
    if (col.mes < 0) negList.push({ v: col.mes, c: cMes });
    if (col.cur < 0) negList.push({ v: col.cur, c: cCur });
    for (const p of negList) yDn = drawSegment(xMid, yDn, p.v, p.c);

    // Fokus-Highlight (Rahmen)
    if (col.i === lvTabFocus) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.strokeRect(xMid - barW / 2 - 2, padTop, barW + 4, plotH);
    }

    // Summen-Marker: kurzer dicker schwarzer Querstrich
    const sumY = zeroY - col.sum * yPerDb;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(xMid - barW / 2 - 4, sumY);
    ctx.lineTo(xMid + barW / 2 + 4, sumY);
    ctx.stroke();

    // dB-Beschriftung oben (Schieber-Wert groß)
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 12px Consolas,monospace";
    const schTxt = (col.sch >= 0 ? "+" : "") + col.sch.toFixed(1);
    ctx.fillText(schTxt, xMid, padTop - 26);
    // Zweite Zeile: Summe nur wenn Toggles aktiv
    if (lvTabShowMeas || lvTabShowCurves) {
      ctx.font = "10px Consolas,monospace";
      ctx.fillStyle = "#555";
      const sTxt = "(S: " + (col.sum >= 0 ? "+" : "") + col.sum.toFixed(1) + ")";
      ctx.fillText(sTxt, xMid, padTop - 12);
    }

    // Beschriftung unten (E-Nr + Hz)
    ctx.fillStyle = "#333";
    ctx.font = "10px Segoe UI,sans-serif";
    ctx.fillText(dENPrefix() + dEN(col.i), xMid, H - padBot + 14);
    ctx.fillStyle = "#888";
    ctx.font = "9px Consolas,monospace";
    const f = effFreq(col.i);
    const fTxt = f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f);
    ctx.fillText(fTxt, xMid, H - padBot + 28);
  });
}

function lvTabOnSchieberChange(i, newVal) {
  manualLevels[i] = Math.max(-LV_TAB_RANGE, Math.min(LV_TAB_RANGE, +newVal.toFixed(1)));
  // Bestehende UIs synchron halten
  if (typeof buildLvGrid === "function") buildLvGrid();
  if (typeof drawLvChart === "function") drawLvChart();
  // Player live nachziehen
  if (typeof pEqF !== "undefined" && pEqF.length > 0) pUpdEQ();
  lvTabDraw();
}

function lvTabResetAll() {
  for (let i = 0; i < nEl; i++) manualLevels[i] = 0;
  if (typeof buildLvGrid === "function") buildLvGrid();
  if (typeof drawLvChart === "function") drawLvChart();
  if (typeof pEqF !== "undefined" && pEqF.length > 0) pUpdEQ();
  lvTabDraw();
}

// Klick auf Canvas: Fokus auf nächstgelegene Spalte setzen
document.addEventListener("DOMContentLoaded", () => {
  const cv = document.getElementById("lvTabCv");
  if (!cv) return;
  cv.addEventListener("click", (e) => {
    const rect = cv.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const all = allEl();
    if (!all.length) return;
    const padL = 28, padR = 14;
    const plotW = rect.width - padL - padR;
    const slotW = plotW / all.length;
    const idx = Math.max(0, Math.min(all.length - 1, Math.floor((x - padL) / slotW)));
    const i = all[idx];
    // Klick auf deaktivierte Spalte ignorieren — Fokus bleibt
    if (elSt[i] === "deactivated" || elSt[i] === "mute" || elExDur[i] !== null) return;
    lvTabFocus = i;
    lvTabDraw();
  });
  // Toggle-Listener
  document.getElementById("lvTabChkMeas")?.addEventListener("change", function () {
    lvTabShowMeas = this.checked;
    lvTabDraw();
  });
  document.getElementById("lvTabChkCurves")?.addEventListener("change", function () {
    lvTabShowCurves = this.checked;
    lvTabDraw();
  });
  document.getElementById("lvTabResetBtn")?.addEventListener("click", lvTabResetAll);
  // Resize-Reaktion
  window.addEventListener("resize", () => {
    if (document.getElementById("panel-schieber")?.classList.contains("active")) {
      lvTabDraw();
    }
  });
});
```

## Schritt 3 — `index.html`

### 3a) Tab-Button hinzufügen

In Z. 77–85 die Tab-Leiste so erweitern, daß der neue Button zwischen
`tabResults` und `tabLevels` sitzt:

**vorher:**
```html
<button class="tab" data-tab="ergebnisse" id="tabResults">Meßergebnisse</button>
<button class="tab" data-tab="levels" id="tabLevels"></button>
```

**nachher:**
```html
<button class="tab" data-tab="ergebnisse" id="tabResults">Meßergebnisse</button>
<button class="tab" data-tab="schieber" id="tabSchieber"></button>
<button class="tab" data-tab="levels" id="tabLevels"></button>
```

### 3b) Panel hinzufügen

Direkt **vor** `<!-- ===== LEVELS ===== -->` (Z. 644) folgenden Block
einfügen:

```html
<!-- ===== SCHIEBER (zukünftig „Levels") ===== -->
<div id="panel-schieber" class="panel">
  <div class="card">
    <h2 data-t="lvTabTitle"></h2>
    <p style="font-size:.84em;color:var(--text-muted);margin-bottom:10px" data-t="lvTabDesc"></p>
    <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:.86em">
      <span style="font-weight:600" data-t="lvTabShowLabel"></span>
      <label style="display:flex;align-items:center;gap:4px">
        <span style="display:inline-block;width:12px;height:12px;background:#16a34a;border-radius:2px"></span>
        <span data-t="lvTabSrcSlider"></span>
      </label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
        <input type="checkbox" id="lvTabChkMeas">
        <span style="display:inline-block;width:12px;height:12px;background:#2563eb;border-radius:2px"></span>
        <span data-t="lvTabSrcMeas"></span>
      </label>
      <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
        <input type="checkbox" id="lvTabChkCurves">
        <span style="display:inline-block;width:12px;height:12px;background:#d97706;border-radius:2px"></span>
        <span data-t="lvTabSrcCurves"></span>
      </label>
      <span style="color:var(--text-muted)">|</span>
      <button class="btn btn-sm" id="lvTabResetBtn" data-t="lvTabReset"></button>
    </div>
    <div style="position:relative;width:100%;height:620px;background:var(--bg);border-radius:8px;overflow:hidden">
      <canvas id="lvTabCv" style="width:100%;height:100%;display:block"></canvas>
    </div>
    <p style="font-size:.78em;color:var(--text-muted);margin-top:8px" data-t="lvTabKeyHint"></p>
  </div>
</div>
```

### 3c) Script-Tag

Im `<script>`-Block ganz unten in `index.html` zwischen `levels.js`
und `player.js` neue Zeile einfügen:

**vorher:**
```html
<script src="levels.js"></script>
<script src="player.js"></script>
```

**nachher:**
```html
<script src="levels.js"></script>
<script src="levels-tab.js"></script>
<script src="player.js"></script>
```

## Schritt 4 — CSS

In `style.css` ans Ende anhängen:

```css
/* Schieber-Tab: Canvas hat keine zusätzlichen Klassen, alles inline. */
/* Nur das Panel selbst muss Standard-Tab-Verhalten haben — kein zusätzliches CSS nötig. */
```

(Falls am Canvas Hover-Effekte gewünscht sind, später nachrüsten.
Aktuell reicht das Inline-Styling im HTML.)

## Schritt 5 — i18n-Strings

In `i18n.js` in **jedem der vier Sprachblöcke** (DE, EN, FR, ES) die
folgenden Schlüssel ergänzen. Konkrete Position: jeweils direkt nach
den `lvTitle`/`lvExpl`-Keys (das ist Z. 206ff in DE, Z. 644ff in EN,
Z. 1052ff in FR, Z. 1466ff in ES).

### DE
```javascript
tabSchieber: "Schieber",
lvTabTitle: "Schieber",
lvTabDesc: "Senkrechte Balken pro Elektrode. Anpassung mit Pfeiltasten ↑/↓ (±0.5 dB, Shift = ±0.1 dB). ←/→ wechselt zwischen Elektroden.",
lvTabShowLabel: "Anzeigen:",
lvTabSrcSlider: "Schieber",
lvTabSrcMeas: "Messung",
lvTabSrcCurves: "Kurven",
lvTabReset: "Alles auf 0",
lvTabKeyHint: "Tipp: Pfeiltasten links/rechts wechseln die Elektrode, hoch/runter ändern den Wert. Mit Shift kleinerer Schritt.",
```

### EN
```javascript
tabSchieber: "Sliders",
lvTabTitle: "Sliders",
lvTabDesc: "Vertical bars per electrode. Adjust with arrow keys ↑/↓ (±0.5 dB, Shift = ±0.1 dB). ←/→ moves between electrodes.",
lvTabShowLabel: "Show:",
lvTabSrcSlider: "Slider",
lvTabSrcMeas: "Measurement",
lvTabSrcCurves: "Curves",
lvTabReset: "Reset all to 0",
lvTabKeyHint: "Tip: arrow keys left/right move between electrodes, up/down change the value. Shift = finer step.",
```

### FR
```javascript
tabSchieber: "Curseurs",
lvTabTitle: "Curseurs",
lvTabDesc: "Barres verticales par électrode. Ajuster avec les flèches ↑/↓ (±0.5 dB, Maj = ±0.1 dB). ←/→ change d'électrode.",
lvTabShowLabel: "Afficher :",
lvTabSrcSlider: "Curseur",
lvTabSrcMeas: "Mesure",
lvTabSrcCurves: "Courbes",
lvTabReset: "Tout à 0",
lvTabKeyHint: "Astuce : flèches gauche/droite pour changer d'électrode, haut/bas pour ajuster. Maj = pas plus fin.",
```

### ES
```javascript
tabSchieber: "Deslizadores",
lvTabTitle: "Deslizadores",
lvTabDesc: "Barras verticales por electrodo. Ajuste con las flechas ↑/↓ (±0.5 dB, Mayús = ±0.1 dB). ←/→ cambia de electrodo.",
lvTabShowLabel: "Mostrar:",
lvTabSrcSlider: "Deslizador",
lvTabSrcMeas: "Medición",
lvTabSrcCurves: "Curvas",
lvTabReset: "Todo a 0",
lvTabKeyHint: "Consejo: flechas izquierda/derecha para cambiar de electrodo, arriba/abajo para ajustar. Mayús = paso más fino.",
```

### applyLang erweitern

Tab-Buttons im Bestand werden **nicht** über `data-t` beschriftet,
sondern explizit per `s(id, key)`-Aufruf in `applyLang` (siehe Z. 1746ff
in i18n.js, Pattern: `s("tabIntro", "tabIntro");`).

In `applyLang` direkt nach `s("tabLevels", "tabLevels");` (Z. 1749)
einen Eintrag für den neuen Tab ergänzen:

**vorher:**
```javascript
s("tabLevels", "tabLevels");
s("tabPlayer", "tabPlayer");
```

**nachher:**
```javascript
s("tabLevels", "tabLevels");
s("tabSchieber", "tabSchieber");
s("tabPlayer", "tabPlayer");
```

Das HTML-Snippet aus Schritt 3a braucht **kein** `data-t="tabSchieber"` —
weglassen, damit die ID-basierte Beschriftung nicht von einem
`data-t`-Loop überschrieben wird:

```html
<button class="tab" data-tab="schieber" id="tabSchieber"></button>
```

## Schritt 6 — `tabs-eq.js`: Hook in `switchTab`

In `switchTab` (Z. 34–71 in `tabs-eq.js`) am Ende vor der schließenden
`}` der Funktion ergänzen:

**vorher:**
```javascript
  if (n === "levels") {
    buildLvGrid();
    drawLvChart();
  }
}
```

**nachher:**
```javascript
  if (n === "levels") {
    buildLvGrid();
    drawLvChart();
  }
  if (n === "schieber") {
    if (typeof lvTabRebuild === "function") lvTabRebuild();
  }
}
```

## Schritt 7 — `init.js`: Keyboard-Handler und Side-Wechsel

### 7a) Keyboard-Handler für den Schieber-Tab

In `init.js` direkt nach dem bestehenden Levels-Keyboard-Handler
(Z. 837–870) einen separaten Handler einfügen:

```javascript
// Schieber-Tab keyboard nav — überspringt deaktivierte Elektroden
document.addEventListener("keydown", function (e) {
  const pan = document.getElementById("panel-schieber");
  if (!pan || !pan.classList.contains("active")) return;
  if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
  const act = actEl();
  if (!act.length) return;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    let ci = act.indexOf(lvTabFocus);
    if (ci < 0) ci = 0;
    if (e.key === "ArrowLeft") ci = Math.max(0, ci - 1);
    else ci = Math.min(act.length - 1, ci + 1);
    lvTabFocus = act[ci];
    lvTabDraw();
  }
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
    const st = e.shiftKey ? 0.1 : 0.5;
    const cur = manualLevels[lvTabFocus] || 0;
    const next = e.key === "ArrowUp" ? cur + st : cur - st;
    lvTabOnSchieberChange(lvTabFocus, next);
  }
});
```

Wichtig: **eigenen Listener anlegen**, nicht den bestehenden Levels-
Handler erweitern. Der bestehende soll nur greifen, wenn das alte
`panel-levels` aktiv ist; der neue nur, wenn `panel-schieber` aktiv ist.

### 7b) Side-Wechsel

Im Side-Wechsel-Pfad (`setActiveSide` in `state-side.js`, Z. 132ff)
wird `buildLvGrid()` und `drawLvChart()` aufgerufen. Direkt darunter
ergänzen:

**vorher:**
```javascript
  buildFreqTable();
  buildLvGrid();
  drawLvChart();
  renderResults();
```

**nachher:**
```javascript
  buildFreqTable();
  buildLvGrid();
  drawLvChart();
  if (typeof lvTabRebuild === "function") lvTabRebuild();
  renderResults();
```

Begründung: bei Seitenwechsel zeigt der globale `manualLevels` auf ein
neues Array → der Canvas muss neu gezeichnet werden.

## Schritt 8 — `file.js`: Anzeige-Toggles persistieren (optional)

Die Anzeige-Toggles `lvTabShowMeas`/`lvTabShowCurves` sind reine
UI-Einstellungen. Persistieren in JSON ist nicht zwingend nötig. Falls
gewünscht (Konsistenz mit anderen UI-States):

In `file.js` in `saveJson`-Aufbau ergänzen (Block ähnlich
`playerSource`):

```javascript
// in saveJson:
levelsTabShowMeas: lvTabShowMeas,
levelsTabShowCurves: lvTabShowCurves,
```

In `applyLoadedData`:

```javascript
if (typeof d.levelsTabShowMeas === "boolean") lvTabShowMeas = d.levelsTabShowMeas;
if (typeof d.levelsTabShowCurves === "boolean") lvTabShowCurves = d.levelsTabShowCurves;
```

**Default-Verhalten beim Laden**: wenn der Schieber-Tab gerade aktiv
war, `lvTabRebuild()` aufrufen. Das passiert sowieso über die
bestehenden `buildLvGrid()`-Aufrufe nicht — bitte gezielt am Ende von
`applyLoadedData` ergänzen:

```javascript
if (typeof lvTabRebuild === "function" &&
    document.getElementById("panel-schieber")?.classList.contains("active")) {
  lvTabRebuild();
}
```

## Schritt 9 — Synchronisation manualLevels ↔ alte UI

Wichtig: solange der **alte Levels-Tab noch existiert** (bis
Bauanleitung 04 ihn aufräumt), müssen Änderungen aus beiden Tabs in
beide UIs reflektieren. Das ist im Skeleton durch die expliziten
`buildLvGrid()`+`drawLvChart()`-Aufrufe in `lvTabOnSchieberChange` und
`lvTabResetAll` bereits abgedeckt. Umgekehrt — Änderungen im alten Tab
müssen den Schieber-Tab neu zeichnen:

In `levels.js`, Funktion `lvOnChange` (Z. 199ff), am Ende ergänzen:

**vorher:**
```javascript
function lvOnChange() {
  updAllBars();
  drawLvChart();
  if (pEqF.length > 0) pUpdEQ();
}
```

**nachher:**
```javascript
function lvOnChange() {
  updAllBars();
  drawLvChart();
  if (typeof lvTabDraw === "function") lvTabDraw();
  if (pEqF.length > 0) pUpdEQ();
}
```

Und in der `lvResetBtn`-Handler in `init.js` (Z. 679ff) am Ende
ergänzen:

**vorher:**
```javascript
document.getElementById("lvResetBtn").addEventListener("click", function () {
  manualLevels.splice(0, manualLevels.length, ...new Array(nEl).fill(0));
  buildLvGrid();
  lvOnChange();
});
```

**nachher:**
```javascript
document.getElementById("lvResetBtn").addEventListener("click", function () {
  manualLevels.splice(0, manualLevels.length, ...new Array(nEl).fill(0));
  buildLvGrid();
  lvOnChange();
  if (typeof lvTabDraw === "function") lvTabDraw();
});
```

## Schritt 10 — `CODESTRUKTUR.md` aktualisieren

Im **Selben Arbeitsschritt** (nicht nachträglich):

- Neue Zeile in der Modul-Tabelle: `| 15 | levels-tab.js | …`
  (Nummerierung der nachfolgenden Module um 1 hochsetzen).
- Tab-Tabelle erweitern: neuer Eintrag „Schieber | schieber |
  levels-tab.js".
- Im Datenfluß-Block den Querverweis ergänzen, daß `manualLevels` jetzt
  von zwei Modulen geschrieben wird (`levels.js` über `lvNum`-Inputs
  und Pfeiltasten in `init.js`, **und** `levels-tab.js` über Canvas-
  Pfeiltasten in `init.js`). Hinweis, daß `levels.js`/`lvOnChange` nach
  dem Pattern „neu zeichnen + Player live" jetzt auch `lvTabDraw()`
  aufruft.
- Neue globale Variablen in der state-side.js-Zeile erwähnen:
  `lvTabShowMeas`, `lvTabShowCurves`, `lvTabFocus`.

## Schritt 11 — `SPEC.md` aktualisieren

Im **selben Arbeitsschritt**:

- Tab-Übersicht: neuen Eintrag „Schieber" hinzufügen (Reihenfolge im
  Tool: zwischen Meßergebnisse und Levels).
- Funktionsbeschreibung „Schieber-Tab": siehe Spezifikation oben
  (senkrechte Balken, Pfeiltasten, Diverging-Stack mit drei Quellen,
  Toggles nur für Anzeige, Reset-Button).
- Hinweis: „in Bauanleitung 04 erfolgt das Umbenennen zu Levels und
  die Player-Erweiterung."

---

## Akzeptanztest-Checkliste (für den Nutzer)

Vom User Klick für Klick durchgehen.

1. **Tool laden** → in der Tab-Bar erscheint ein neuer Tab „Schieber"
   zwischen „Meßergebnisse" und „Levels".
2. **Tab „Schieber" klicken** → senkrechte Balken erscheinen, anfangs
   ist die Skala leer (alle Werte 0), Nullinie in der Mitte sichtbar,
   schwarze Querstriche auf der Nulllinie pro Elektrode (Summenmarker
   = 0).
3. **Erste Elektrode hat Fokusrahmen** (dunkler Rahmen um Balken
   Nr. 1).
4. **Pfeil ↑** → der Schieber-Wert der fokussierten Elektrode steigt
   um 0.5, ein grüner Balken wächst nach oben, oben am Balken steht
   „+0.5".
5. **Shift+Pfeil ↑** → Wert steigt nur um 0.1.
6. **Pfeil →** → Fokus springt auf die nächste aktive Elektrode
   (deaktivierte werden übersprungen).
7. **Toggle „Messung" einschalten** (nur sinnvoll, wenn vorher Test 1
   gemacht): blaue Anteile erscheinen gestapelt im Balken, oben in der
   2. Zeile wird „(S: ±X.X)" angezeigt.
8. **Toggle „Kurven" einschalten** (nur sinnvoll, wenn Presets aktiv):
   orange Anteile erscheinen zusätzlich gestapelt.
9. **„Alles auf 0"-Button** klicken → alle Werte auf 0, im alten Tab
   „Levels" (manuelle Levels-Grid) ebenfalls.
10. **In alten Tab „Levels" wechseln**, dort einen manuellen Wert
    setzen (z.B. +3 dB auf E5), zurück zu „Schieber" → der Balken bei
    E5 zeigt +3, oben „+3.0".
11. **Side wechseln** (LINKS ↔ RECHTS oben) → der Schieber-Tab zeigt
    die Werte der anderen Seite, Fokus geht zurück auf die erste
    aktive Elektrode.
12. **JSON speichern und neu laden** (Datei.js): nach dem Laden zeigt
    der Schieber-Tab die gespeicherten manualLevels. (Wenn Schritt 8
    umgesetzt: auch die Toggle-Zustände sind wiederhergestellt.)
13. **Player-Reiter** zeigt unveränderte zwei Buttons (Gemessen /
    Levels) — Player-Verhalten unverändert.
14. **Sprachwechsel** (langSelect): alle vier Sprachen zeigen
    übersetzte Strings im Schieber-Tab.
15. **Browser-Fenster verkleinern**: Canvas bleibt responsiv, Balken
    werden schmaler aber bleiben sichtbar.
16. **Eine Elektrode deaktivieren** (Tab Implantat, Elektrodentabelle):
    die deaktivierte Spalte im Schieber-Tab zeigt einen hellgrauen
    Balken mit X-Diagonale Ecke-zu-Ecke, keine dB-Beschriftung oben,
    Elektrode/Hz unten in gedämpfter Farbe. Pfeil-Navigation springt
    bei ←/→ über diese Spalte hinweg. Klick auf die Spalte verändert
    den Fokus nicht.

## Selbstprüfung vor Fertig-Meldung an Sonnet

**Pflicht**: Vor der Fertig-Meldung jeden Punkt der Akzeptanztest-
Checkliste einzeln durchgehen und für jeden melden:

- **erfüllt** + Datei- und Zeilenangabe der relevanten Stelle, oder
- **nicht erfüllt** + warum, oder
- **unklar** + welche Annahme nötig wäre.

Wenn ein Punkt als „unklar" markiert wird, ist das Signal zur Rück-
frage an den User, nicht zur stillen Annahme.

Zusätzliche Selbstprüfungen:

- [ ] `CODESTRUKTUR.md` enthält jetzt `levels-tab.js` in der Modul-
  Tabelle und die neue Tab-Zeile?
- [ ] `SPEC.md` listet den neuen Tab in der Tab-Übersicht?
- [ ] Alle vier Sprachen (DE/EN/FR/ES) haben die neuen Strings?
- [ ] Keine Konsolen-Fehler beim Tool-Start (`F12 → Console`)?
- [ ] `manualLevels` wird nicht in zwei UIs entkoppelt — Änderung in
  einer reflektiert sofort in der anderen?
- [ ] Pfeiltasten-Listener feuern **nur** im jeweils aktiven Panel
  (Schieber-Panel-Listener nicht beim alten Levels-Panel, und
  umgekehrt)?
- [ ] Bei Side-Wechsel: Schieber-Canvas wird neu gezeichnet und der
  Fokus auf die erste aktive Elektrode gesetzt, falls die vorherige
  Fokus-Elektrode auf der neuen Seite deaktiviert ist?
