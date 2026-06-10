# Bauanleitung 05 — Levels-Tab: Absolutmodus + Variant-Toggle

## Ziel

Erweiterung des Levels-Tabs aus Bauanleitung 03 + 04 um zwei
unabhängige Anzeige-Achsen:

1. **Hauptmodus** (relativ ↔ absolut):
   - **Modus A — relativ** (bisheriger Zustand): Y-Achse ±60 dB,
     Nullinie in der Mitte, Werte sind dB-Offsets relativ zur
     Audiologen-MCL.
   - **Modus B — absolut**: Y-Achse 0..Hersteller-Max in qu/CL/CU,
     Nullinie unten, Balken zeigt MCL-Niveau nach oben, THR-Zone
     innerhalb des Balkens farblich abgegrenzt. Anzeige in
     herstellerspezifischen Einheiten **und** dB.
   - Toggle nur klickbar, wenn **mindestens eine aktive Elektrode**
     der Aktivseite einen MCL/Upper-Level-Wert hat.

2. **Quellen-Darstellungs-Variante** (gilt in beiden Modi):
   - **2a — Nur Summe**: ein einziger Balken mit der Summe der
     aktiven Quellen, keine Anteilsaufschlüsselung.
   - **2b — Gestapelt**: diverging stacked bar mit allen aktiven
     Quellen pro Spalte (Standard aus Bauanleitung 03).
   - **2c — Summe + Vergleichslinien**: ein Balken (Summe) plus
     farbige Linien quer über alle Elektroden, je eine Linie pro
     aktivem Quell-Toggle.

**Defaults**:
- Modus A → Variante 2b
- Modus B → Variante 2a

**Vorbedingung**: Bauanleitungen 03 + 04 sind komplett umgesetzt.
Der Levels-Tab existiert, der Player hat drei Source-Toggles, der
alte Levels-Tab heißt „Kurven", `levels-tab.js` ist als Modul
geladen.

---

## Übersicht der Schritte

1. State erweitern (zwei neue globale Variablen für die zwei Toggles).
2. Hersteller-Konstanten und inverse Umrechnungs-Funktionen in
   `core.js` ergänzen.
3. `levels-tab.js`: Zeichenfunktionen für Modus B und Varianten 2a/2c,
   Pfeiltasten-Logik pro Modus.
4. `index.html`: Toggle-Bar oberhalb der Balken erweitern.
5. `init.js`: Listener für die zwei neuen Toggles, Pfeiltasten-Pfad
   pro Modus.
6. i18n-Strings in DE/EN/FR/ES.
7. `file.js` und `init.js`-Autosave: die zwei UI-States persistieren.
8. `CODESTRUKTUR.md` und `SPEC.md` aktualisieren.

---

## Schritt 1 — State erweitern

In `state-side.js` direkt unter den bestehenden Anzeige-Toggles
`lvTabShowMeas`/`lvTabShowCurves` (aus Bauanleitung 03) zwei weitere
ergänzen:

```javascript
// Hauptmodus des Schieber-Tabs.
// "rel" = relativ (±dB-Skala, Default)
// "abs" = absolut (Hersteller-Einheit, MCL/THR sichtbar)
let lvTabMode = "rel";

// Quellen-Darstellungs-Variante.
// "stack"   = gestapelt (Diverging Stacked Bar)
// "sum"     = nur Summen-Balken, keine Anteile
// "lines"   = Summen-Balken + farbige Vergleichslinien quer
let lvTabVariant = "stack";  // Default für Modus A; wird beim Modus-Wechsel angepasst
```

Beim Wechsel des Hauptmodus wird die Variante automatisch auf den
Default des neuen Modus gesetzt, falls der User noch nichts manuell
geändert hat — Details in Schritt 5b.

## Schritt 2 — `core.js`: Konstanten und inverse Funktionen

### 2a) Hersteller-Maxima für die Y-Skala im Modus B

In `core.js` nach den `calcMedel`/`calcCochlear`/`calcAB`-Definitionen
einen Konstanten-Block ergänzen:

```javascript
// Y-Achsen-Maxima für die Absolutmodus-Skala im Levels-Tab.
// Quelle: Berechnungsgrundlagen dB zu CI.md, Sections 3.1, 4.1, 5.1.
const LV_AXIS_MAX = {
  medel: 300,    // MCL-Bereich bis 268.6 qu, leicht aufgerundet
  cochlear: 255, // CL-Skala 0..255
  ab: 600,       // M-Level typisch bis 600 CU
};

function lvAxisMaxFor(mfrId) {
  return LV_AXIS_MAX[mfrId] || 300;
}

function lvUnitLabelFor(mfrId) {
  if (mfrId === "medel") return "qu";
  if (mfrId === "cochlear") return "CL";
  if (mfrId === "ab") return "CU";
  return "";
}
```

### 2b) Inverse Umrechnung (Hersteller-Einheit → dB)

Im selben Konstanten-Block, jeweils das mathematische Inverse der
bestehenden `calcXxx`-Funktionen aus Section 3.4 / 4.4 / 5.3 der
Berechnungsgrundlagen:

```javascript
// MED-EL: dB = 20 · log10(MCL_neu / MCL_alt)
function dbFromMedel(mclNew, mclOld) {
  if (mclOld == null || mclNew == null || mclOld <= 0 || mclNew <= 0)
    return null;
  return 20 * Math.log10(mclNew / mclOld);
}

// Cochlear: dB = step · (C_neu − C_alt)
function dbFromCochlear(cNew, cOld, generation) {
  const step = generation === "A" ? 0.176 : generation === "B" ? 0.157 : null;
  if (step === null || cOld == null || cNew == null) return null;
  return step * (cNew - cOld);
}

// AB: dB = (M_neu − M_alt) · IDR / (M_alt − T_alt)
function dbFromAB(mNew, mOld, tOld, idr) {
  const idrUse = idr != null && !isNaN(idr) ? idr : 60;
  if (mOld == null || tOld == null || mNew == null) return null;
  const span = mOld - tOld;
  if (span === 0) return null;
  return (mNew - mOld) * idrUse / span;
}
```

Diese drei Funktionen sind das Gegenstück zu `calcMedel`/`calcCochlear`/
`calcAB` und werden für die Pfeiltasten-Logik in Modus B gebraucht.

## Schritt 3 — `levels-tab.js`: Zeichenfunktionen erweitern

Aus Bauanleitung 03 existiert `lvTabDraw()` mit fest verdrahtetem
Modus A + Variante 2b. Diese Funktion wird jetzt in mehrere Sub-
Funktionen aufgeteilt.

### 3a) Eintrittspunkt `lvTabDraw` umbauen

```javascript
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

  if (lvTabMode === "abs") {
    lvTabDrawAbsolute(ctx, W, H);
  } else {
    lvTabDrawRelative(ctx, W, H);
  }
}
```

### 3b) `lvTabDrawRelative` — bisheriger Modus-A-Code

Den bisherigen `lvTabDraw`-Korpus in eine eigene Funktion
`lvTabDrawRelative(ctx, W, H)` verschieben. Dabei den
Variant-Switch berücksichtigen:

```javascript
function lvTabDrawRelative(ctx, W, H) {
  // ... bisheriger Code zur Spalten-Berechnung bis cols-Array ...

  // Layout
  const padTop = 56;
  const padBot = 44;
  const padL = 28, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const zeroY = padTop + plotH / 2;
  const slotW = plotW / cols.length;
  const barW = Math.max(8, Math.min(40, slotW * 0.6));
  const yPerDb = plotH / (2 * LV_TAB_RANGE);

  // ... Skala/Nullinie wie bisher ...

  // Spalten zeichnen — je nach Variante
  cols.forEach((col, idx) => {
    const xMid = padL + slotW * (idx + 0.5);
    if (col.excluded) {
      lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    if (lvTabVariant === "stack") {
      lvTabDrawStackRelative(ctx, xMid, barW, zeroY, yPerDb, col);
    } else {
      lvTabDrawSumBarRelative(ctx, xMid, barW, zeroY, yPerDb, col);
    }
    lvTabDrawFocusAndSum(ctx, xMid, barW, padTop, plotH, zeroY, yPerDb, col);
    lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col);
  });

  // Variante "lines": nach den Balken Vergleichslinien quer ziehen
  if (lvTabVariant === "lines") {
    lvTabDrawCompareLinesRelative(ctx, padL, padTop, slotW, plotH, zeroY, yPerDb, cols);
  }
}
```

### 3c) `lvTabDrawAbsolute` — neuer Modus-B-Code

```javascript
function lvTabDrawAbsolute(ctx, W, H) {
  const all = allEl();
  if (!all.length) return;
  const isExcluded = (i) =>
    elSt[i] === "deactivated" || elSt[i] === "mute" || elExDur[i] !== null;

  const im = sideData[activeSide].implant || {};
  const isMedel = mfr === "medel";
  const isCoch = mfr === "cochlear";
  const isAB = mfr === "ab";
  const yMax = lvAxisMaxFor(mfr);
  const unitLbl = lvUnitLabelFor(mfr);

  // Pro Elektrode Werte berechnen
  const { levels: measArr } = compWLS();
  const preArr = getTotalPresetCurve();
  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const mclAudi = isMedel
      ? im.mcl?.[i]
      : im.upperLevel?.[i];
    const thrAudi = im.thr?.[i];
    if (mclAudi == null) {
      // Keine MCL für diese Elektrode → leere Spalte mit Hinweis
      return { i, excluded: false, noMcl: true };
    }
    // Beiträge in dB
    const schDb = manualLevels[i] || 0;
    const mesDb = lvTabShowMeas
      ? (bRes.some((r) => r.a === i || r.b === i) ? measArr[i] : 0)
      : 0;
    const curDb = lvTabShowCurves ? preArr[i] : 0;
    const sumDb = schDb + mesDb + curDb;

    // Umrechnung in Hersteller-Einheit
    const toAbs = (dB) => {
      if (isMedel) return calcMedel(dB, mclAudi).absolute;
      if (isCoch) return calcCochlear(dB, mclAudi, detectCochlearGen(im.model)).absolute;
      if (isAB) return calcAB(dB, mclAudi, thrAudi, im.idr).absolute;
      return null;
    };
    return {
      i, excluded: false, noMcl: false,
      mclAudi, thrAudi,
      schDb, mesDb, curDb, sumDb,
      mclNew: toAbs(sumDb),
      mclSch: toAbs(schDb),
    };
  });

  // Layout
  const padTop = 56;
  const padBot = 44;
  const padL = 36, padR = 14;
  const plotW = W - padL - padR;
  const plotH = H - padTop - padBot;
  const slotW = plotW / cols.length;
  const barW = Math.max(8, Math.min(40, slotW * 0.6));
  const yPerUnit = plotH / yMax;
  const baseY = padTop + plotH; // Nullinie unten

  // Skala/Gitter
  ctx.strokeStyle = "#e5e5e5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#999";
  ctx.font = "9px Consolas,monospace";
  ctx.textAlign = "right";
  const stepY = yMax > 400 ? 100 : yMax > 200 ? 50 : 25;
  for (let v = 0; v <= yMax; v += stepY) {
    const y = baseY - v * yPerUnit;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    ctx.fillText(v + " " + unitLbl, padL - 4, y + 3);
  }

  // Spalten zeichnen
  cols.forEach((col, idx) => {
    const xMid = padL + slotW * (idx + 0.5);
    if (col.excluded) {
      lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    if (col.noMcl) {
      lvTabDrawNoMclColumn(ctx, xMid, barW, padTop, plotH, H, padBot, col.i);
      return;
    }
    // Variante 2b (gestapelt) — drei Anteile in qu/CL/CU
    if (lvTabVariant === "stack") {
      lvTabDrawStackAbsolute(ctx, xMid, barW, baseY, yPerUnit, col);
    } else {
      lvTabDrawSumBarAbsolute(ctx, xMid, barW, baseY, yPerUnit, col);
    }
    // THR-Zone innerhalb des Balkens (hellrot, ca. 30 % Opazität)
    if (col.thrAudi != null) {
      const thrY = baseY - col.thrAudi * yPerUnit;
      ctx.fillStyle = "rgba(220, 38, 38, 0.18)";
      ctx.fillRect(xMid - barW / 2, thrY, barW, baseY - thrY);
      ctx.strokeStyle = "#dc2626";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(xMid - barW / 2, thrY);
      ctx.lineTo(xMid + barW / 2, thrY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // MCL-Audiologe als horizontaler Strich (Originalmarker)
    const mclAudiY = baseY - col.mclAudi * yPerUnit;
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(xMid - barW / 2 - 3, mclAudiY);
    ctx.lineTo(xMid + barW / 2 + 3, mclAudiY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Fokus
    if (col.i === lvTabFocus) {
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.strokeRect(xMid - barW / 2 - 2, padTop, barW + 4, plotH);
    }
    // Beschriftung oben: qu-Wert groß, dB-Delta klein
    ctx.textAlign = "center";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 12px Consolas,monospace";
    const valTxt = col.mclNew != null ? Math.round(col.mclNew) + " " + unitLbl : "—";
    ctx.fillText(valTxt, xMid, padTop - 26);
    ctx.font = "10px Consolas,monospace";
    ctx.fillStyle = "#555";
    const dbTxt = "(" + (col.sumDb >= 0 ? "+" : "") + col.sumDb.toFixed(1) + " dB)";
    ctx.fillText(dbTxt, xMid, padTop - 12);
    // Beschriftung unten
    lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col);
  });

  if (lvTabVariant === "lines") {
    lvTabDrawCompareLinesAbsolute(ctx, padL, padTop, slotW, plotH, baseY, yPerUnit, cols);
  }
}
```

### 3d) Helper-Funktionen

Die folgenden Helper-Funktionen werden von `lvTabDrawRelative` und
`lvTabDrawAbsolute` aufgerufen. Stelle sie in `levels-tab.js`
zwischen den Hauptfunktionen ein:

```javascript
function lvTabDrawExcludedColumn(ctx, xMid, barW, padTop, plotH, H, padBot, i) {
  // Identisch zum bestehenden excluded-Code aus Bauanleitung 03
  // (hellgrauer Balken volle Höhe, X-Diagonale, gedämpfte Beschriftung)
  // ... unverändert übernehmen ...
}

function lvTabDrawNoMclColumn(ctx, xMid, barW, padTop, plotH, H, padBot, i) {
  // Spalte ohne MCL im Absolutmodus: dünne gestrichelte Outline,
  // Tooltip "MCL nicht eingetragen" beim Hover.
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(xMid - barW / 2, padTop, barW, plotH);
  ctx.setLineDash([]);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("—", xMid, padTop + plotH / 2);
  // Beschriftung unten in gedämpfter Farbe
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
  const f = effFreq(i);
  ctx.font = "9px Consolas,monospace";
  const fTxt = f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f);
  ctx.fillText(fTxt, xMid, H - padBot + 28);
}

function lvTabDrawStackRelative(ctx, xMid, barW, zeroY, yPerDb, col) {
  // Bisheriger Diverging-Stack-Code aus Bauanleitung 03
  // (positive Anteile nach oben, negative nach unten gestapelt)
  // ... aus dem alten lvTabDraw extrahieren ...
}

function lvTabDrawSumBarRelative(ctx, xMid, barW, zeroY, yPerDb, col) {
  // Variante 2a: ein einziger Balken mit der Summe.
  // Farbe je nach Vorzeichen, Höhe = |sum|.
  if (Math.abs(col.sum) < 0.001) return;
  const dy = -col.sum * yPerDb;
  const y0 = Math.min(zeroY, zeroY + dy);
  const y1 = Math.max(zeroY, zeroY + dy);
  ctx.fillStyle = col.sum >= 0 ? "#16a34a" : "#dc2626";
  ctx.fillRect(xMid - barW / 2, y0, barW, y1 - y0);
}

function lvTabDrawStackAbsolute(ctx, xMid, barW, baseY, yPerUnit, col) {
  // Drei Anteile in qu/CL/CU. Konvention:
  //   Untere Schicht: Audiologen-MCL bei 0
  //   Stack-Reihenfolge: Schieber, Messung, Kurven
  // Negative Beiträge in der Hersteller-Einheit ziehen vom Stapel ab
  // — bei dB negativ sinkt die qu-Höhe ggf. unter MCL-Audi.
  // Pragmatik: wir zeigen drei Streifen entsprechend ihrer Beiträge
  // an der Gesamthöhe; bei gemischten Vorzeichen kann ein Streifen
  // "rausgeschnitten" wirken. Bei reinem 0er-Anteil entfällt der Streifen.
  // (Detail-Algorithmik: Sonnet darf hier eigene Lösung wählen,
  //  Hauptsache die Farben sind den Quellen zugeordnet und die
  //  Gesamthöhe = mclNew.)
  // Empfehlung: Balken bis mclNew zeichnen, dann die Beiträge der
  // einzelnen Quellen mit ihrer Farbe als horizontale Trennlinien
  // dazwischen markieren — sauberer als Anteilssegmente zu bauen.
  if (col.mclNew == null || col.mclNew <= 0) return;
  // Basis: Audiologen-MCL grün
  const yAudi = baseY - col.mclAudi * yPerUnit;
  const yNew = baseY - col.mclNew * yPerUnit;
  // Hauptbalken: Audiologen-MCL bis MCL_neu
  // Farbe wechselt mit Vorzeichen der Summe
  ctx.fillStyle = col.sumDb >= 0 ? "#3b82f6" : "#dc2626";
  ctx.fillRect(xMid - barW / 2, Math.min(yAudi, yNew), barW, Math.abs(yAudi - yNew));
  // Audiologen-Basis als blauer Block bis Nullinie
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(xMid - barW / 2, yAudi, barW, baseY - yAudi);
}

function lvTabDrawSumBarAbsolute(ctx, xMid, barW, baseY, yPerUnit, col) {
  // Variante 2a / 2c: ein einfacher Balken von 0 bis mclNew
  if (col.mclNew == null || col.mclNew <= 0) return;
  const yNew = baseY - col.mclNew * yPerUnit;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillRect(xMid - barW / 2, yNew, barW, baseY - yNew);
}

function lvTabDrawFocusAndSum(ctx, xMid, barW, padTop, plotH, zeroY, yPerDb, col) {
  // Fokus-Rahmen
  if (col.i === lvTabFocus) {
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.strokeRect(xMid - barW / 2 - 2, padTop, barW + 4, plotH);
  }
  // Summen-Marker und dB-Beschriftung oben — Code aus Bauanleitung 03
  // ... unverändert übernehmen ...
}

function lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col) {
  // Beschriftung unten (E-Nr + Hz) — Code aus Bauanleitung 03
  // ... unverändert übernehmen ...
}

function lvTabDrawCompareLinesRelative(ctx, padL, padTop, slotW, plotH, zeroY, yPerDb, cols) {
  // Variante 2c: pro aktivem Quell-Toggle eine farbige Kurvenlinie
  // quer durch alle aktiven (nicht excluded, nicht noMcl) Spalten.
  // Linie folgt den jeweiligen Werten der Quelle.
  const drawSrc = (key, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    let first = true;
    cols.forEach((col, idx) => {
      if (col.excluded) return;
      const xMid = padL + slotW * (idx + 0.5);
      const v = col[key] || 0;
      const y = zeroY - v * yPerDb;
      if (first) { ctx.moveTo(xMid, y); first = false; }
      else ctx.lineTo(xMid, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };
  // Schieber immer
  drawSrc("sch", "#16a34a");
  if (lvTabShowMeas) drawSrc("mes", "#2563eb");
  if (lvTabShowCurves) drawSrc("cur", "#d97706");
}

function lvTabDrawCompareLinesAbsolute(ctx, padL, padTop, slotW, plotH, baseY, yPerUnit, cols) {
  // Analog für Modus B — Linien in qu/CL/CU.
  // Schieber-Linie folgt mclSch (Audi-MCL + Schieber-Beitrag).
  // Messung/Kurven brauchen je eine zusätzliche Umrechnung; siehe
  // Pattern in lvTabDrawAbsolute. Empfehlung: in lvTabDrawAbsolute
  // diese Werte schon mit ins cols-Objekt schreiben (`mesAbs`,
  // `curAbs`), damit hier nur noch gezeichnet wird.
  // ... Implementierung analog zur Relative-Variante ...
}
```

**Hinweis an Sonnet**: Die Detail-Algorithmik der Stack-Variante im
Modus B ist nicht trivial, weil sich qu-Beiträge bei Vorzeichen-Mix
überlagern können. Wenn ein einfacher Ansatz mit „Audiologen-Basis
grau + Differenz-Hauptbalken farbig" nicht ausreicht, frag den
Nutzer nach der konkreten Visualisierungs-Vorstellung statt zu
raten. Im Zweifel: erst Variante 2a robust bauen, 2b im Modus B als
„noch nicht implementiert" hinten anstellen und in IDEEN.md
verschieben.

## Schritt 4 — `index.html`: Toggle-Bar erweitern

Im Schieber-Tab-Panel (`#panel-schieber`) die bestehende Toggle-Bar
aus Bauanleitung 03 (mit den drei Quell-Toggles und dem
Reset-Button) um zwei zusätzliche Bedien-Gruppen ergänzen.

**vorher** (Stand nach 03):
```html
<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:.86em">
  <span style="font-weight:600" data-t="lvTabShowLabel"></span>
  <label ...><span ...></span><span data-t="lvTabSrcSlider"></span></label>
  <label ...><input id="lvTabChkMeas">...<span data-t="lvTabSrcMeas"></span></label>
  <label ...><input id="lvTabChkCurves">...<span data-t="lvTabSrcCurves"></span></label>
  <span ...>|</span>
  <button id="lvTabResetBtn" data-t="lvTabReset"></button>
</div>
```

**nachher**:
```html
<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:10px;font-size:.86em">
  <!-- Hauptmodus -->
  <span style="font-weight:600" data-t="lvTabModeLabel"></span>
  <label><input type="radio" name="lvTabMode" id="lvTabModeRel" value="rel" checked>
    <span data-t="lvTabModeRelative"></span></label>
  <label><input type="radio" name="lvTabMode" id="lvTabModeAbs" value="abs">
    <span data-t="lvTabModeAbsolute"></span></label>
  <span style="color:var(--text-muted)">|</span>
  <!-- Variante -->
  <span style="font-weight:600" data-t="lvTabVariantLabel"></span>
  <label><input type="radio" name="lvTabVariant" id="lvTabVarSum" value="sum">
    <span data-t="lvTabVarSum"></span></label>
  <label><input type="radio" name="lvTabVariant" id="lvTabVarStack" value="stack" checked>
    <span data-t="lvTabVarStack"></span></label>
  <label><input type="radio" name="lvTabVariant" id="lvTabVarLines" value="lines">
    <span data-t="lvTabVarLines"></span></label>
  <span style="color:var(--text-muted)">|</span>
  <!-- Quellen-Toggles wie in 03 -->
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
```

## Schritt 5 — `init.js`: Listener für Modus- und Variant-Toggle

### 5a) Listener anlegen

Im DOMContentLoaded-Handler (nach den bestehenden Schieber-Listenern
aus Bauanleitung 03) ergänzen:

```javascript
// Modus-Toggle relativ/absolut
document.querySelectorAll('input[name="lvTabMode"]').forEach((r) => {
  r.addEventListener("change", function () {
    if (!this.checked) return;
    const newMode = this.value; // "rel" oder "abs"
    // Modus B nur erlauben, wenn mindestens eine aktive Elektrode MCL hat
    if (newMode === "abs" && !lvTabAbsoluteAvailable()) {
      this.checked = false;
      document.getElementById("lvTabModeRel").checked = true;
      alert(t("lvTabAbsNotAvailable"));
      return;
    }
    lvTabMode = newMode;
    // Variant-Default anpassen
    lvTabVariant = newMode === "abs" ? "sum" : "stack";
    document.getElementById("lvTabVar" + (lvTabVariant === "sum" ? "Sum" : lvTabVariant === "stack" ? "Stack" : "Lines")).checked = true;
    lvTabDraw();
  });
});
// Variant-Toggle
document.querySelectorAll('input[name="lvTabVariant"]').forEach((r) => {
  r.addEventListener("change", function () {
    if (!this.checked) return;
    lvTabVariant = this.value;
    lvTabDraw();
  });
});
```

### 5b) Helper in `levels-tab.js`

```javascript
function lvTabAbsoluteAvailable() {
  const im = sideData[activeSide].implant || {};
  const act = actEl();
  const isMedel = mfr === "medel";
  for (const i of act) {
    const mcl = isMedel ? im.mcl?.[i] : im.upperLevel?.[i];
    if (mcl != null && mcl > 0) return true;
  }
  return false;
}

function lvTabUpdateModeAvailability() {
  const btn = document.getElementById("lvTabModeAbs");
  if (!btn) return;
  const ok = lvTabAbsoluteAvailable();
  btn.disabled = !ok;
  const lbl = btn.parentElement;
  if (lbl) {
    lbl.style.opacity = ok ? "1" : "0.5";
    lbl.title = ok ? "" : t("lvTabAbsNotAvailable");
  }
  // Falls aktuell Modus B, MCL aber weg: zurück auf rel
  if (lvTabMode === "abs" && !ok) {
    lvTabMode = "rel";
    document.getElementById("lvTabModeRel").checked = true;
    lvTabVariant = "stack";
    document.getElementById("lvTabVarStack").checked = true;
  }
}
```

`lvTabUpdateModeAvailability` muss aufgerufen werden, wenn sich
MCL-Werte ändern können — also nach Side-Wechsel und bei jedem
Tab-Wechsel auf Schieber. Erweitere `lvTabRebuild` (aus Bauanleitung
03) am Anfang um:

```javascript
function lvTabRebuild() {
  lvTabUpdateModeAvailability();
  // ... bestehender Code ...
}
```

### 5c) Pfeiltasten-Listener pro Modus

Der in Bauanleitung 03 angelegte Keyboard-Handler für
`#panel-schieber` wird erweitert. **vorher** (Stand 03):

```javascript
if (e.key === "ArrowUp" || e.key === "ArrowDown") {
  e.preventDefault();
  const st = e.shiftKey ? 0.1 : 0.5;
  const cur = manualLevels[lvTabFocus] || 0;
  const next = e.key === "ArrowUp" ? cur + st : cur - st;
  lvTabOnSchieberChange(lvTabFocus, next);
}
```

**nachher**:

```javascript
if (e.key === "ArrowUp" || e.key === "ArrowDown") {
  e.preventDefault();
  const dir = e.key === "ArrowUp" ? 1 : -1;
  if (lvTabMode === "abs") {
    lvTabStepAbsolute(lvTabFocus, dir, e.shiftKey);
  } else {
    const st = e.shiftKey ? 0.1 : 0.5;
    const cur = manualLevels[lvTabFocus] || 0;
    lvTabOnSchieberChange(lvTabFocus, cur + dir * st);
  }
}
```

### 5d) `lvTabStepAbsolute` in `levels-tab.js`

```javascript
function lvTabStepAbsolute(i, dir, shift) {
  const im = sideData[activeSide].implant || {};
  const isMedel = mfr === "medel";
  const isCoch = mfr === "cochlear";
  const isAB = mfr === "ab";
  const mclAudi = isMedel ? im.mcl?.[i] : im.upperLevel?.[i];
  if (mclAudi == null) return; // ohne MCL kein Step im Absolutmodus

  const step = shift ? 5 : 1; // ±1 normal, ±5 mit Shift

  // Aktuelle Hersteller-Einheit: MCL_audi · 10^(dB/20) für MED-EL etc.
  const curDb = manualLevels[i] || 0;
  let curAbs;
  if (isMedel) curAbs = calcMedel(curDb, mclAudi).absolute;
  else if (isCoch) curAbs = calcCochlear(curDb, mclAudi, detectCochlearGen(im.model)).absolute;
  else if (isAB) curAbs = calcAB(curDb, mclAudi, im.thr?.[i], im.idr).absolute;
  if (curAbs == null) return;

  const nextAbs = curAbs + dir * step;
  // Inverse Umrechnung in dB-Offset
  let nextDb;
  if (isMedel) nextDb = dbFromMedel(nextAbs, mclAudi);
  else if (isCoch) nextDb = dbFromCochlear(nextAbs, mclAudi, detectCochlearGen(im.model));
  else if (isAB) nextDb = dbFromAB(nextAbs, mclAudi, im.thr?.[i], im.idr);
  if (nextDb == null) return;

  lvTabOnSchieberChange(i, nextDb);
}
```

`lvTabOnSchieberChange` ist aus Bauanleitung 03; es klemmt auf
±LV_TAB_RANGE (±60 dB) und synchronisiert die anderen UIs. Wenn der
User über die dB-Grenze hinaus drückt, stoppt der Wert bei ±60 dB —
das ist konsistent zu Modus A und schützt vor extremen Korrekturen.

## Schritt 6 — i18n

In jedem der vier Sprachblöcke neue Strings ergänzen, zusammen mit
den schon aus Bauanleitung 03 vorhandenen `lvTab…`-Keys.

### DE
```javascript
lvTabModeLabel: "Modus:",
lvTabModeRelative: "relativ (dB)",
lvTabModeAbsolute: "absolut (qu/CL/CU)",
lvTabVariantLabel: "Anzeige:",
lvTabVarSum: "nur Summe",
lvTabVarStack: "gestapelt",
lvTabVarLines: "Vergleichslinien",
lvTabAbsNotAvailable: "Absolutmodus erfordert MCL-Werte. Im Reiter Implantat eintragen.",
```

### EN
```javascript
lvTabModeLabel: "Mode:",
lvTabModeRelative: "relative (dB)",
lvTabModeAbsolute: "absolute (qu/CL/CU)",
lvTabVariantLabel: "Display:",
lvTabVarSum: "sum only",
lvTabVarStack: "stacked",
lvTabVarLines: "compare lines",
lvTabAbsNotAvailable: "Absolute mode requires MCL values. Enter in the Implant tab.",
```

### FR
```javascript
lvTabModeLabel: "Mode :",
lvTabModeRelative: "relatif (dB)",
lvTabModeAbsolute: "absolu (qu/CL/CU)",
lvTabVariantLabel: "Affichage :",
lvTabVarSum: "somme uniquement",
lvTabVarStack: "empilé",
lvTabVarLines: "lignes de comparaison",
lvTabAbsNotAvailable: "Le mode absolu nécessite des valeurs MCL. À saisir dans l'onglet Implant.",
```

### ES
```javascript
lvTabModeLabel: "Modo:",
lvTabModeRelative: "relativo (dB)",
lvTabModeAbsolute: "absoluto (qu/CL/CU)",
lvTabVariantLabel: "Visualización:",
lvTabVarSum: "solo suma",
lvTabVarStack: "apilado",
lvTabVarLines: "líneas de comparación",
lvTabAbsNotAvailable: "El modo absoluto requiere valores MCL. Introdúzcalos en la pestaña Implante.",
```

## Schritt 7 — Persistenz

In `file.js` `saveJson` und `applyLoadedData`, und im Autosave-Block
in `init.js`, die beiden UI-States mitnehmen:

```javascript
// Save:
levelsTabMode: lvTabMode,
levelsTabVariant: lvTabVariant,

// Load:
if (typeof d.levelsTabMode === "string") lvTabMode = d.levelsTabMode;
if (typeof d.levelsTabVariant === "string") lvTabVariant = d.levelsTabVariant;
```

Beim Laden zusätzlich `lvTabUpdateModeAvailability()` aufrufen, damit
ein geladener Modus B gegen die aktuelle MCL-Lage geprüft und ggf.
auf relativ zurückgefallen wird.

## Schritt 8 — `CODESTRUKTUR.md` und `SPEC.md`

### CODESTRUKTUR.md
- Modul-Tabelle: `levels-tab.js` enthält jetzt zusätzlich
  `lvTabDrawRelative`, `lvTabDrawAbsolute`, `lvTabAbsoluteAvailable`,
  `lvTabUpdateModeAvailability`, `lvTabStepAbsolute`, diverse Helper.
- `core.js`: neue Funktionen `dbFromMedel`, `dbFromCochlear`,
  `dbFromAB`; neue Konstanten `LV_AXIS_MAX`, `lvAxisMaxFor`,
  `lvUnitLabelFor`.
- Datenfluß-Block: `lvTabMode`, `lvTabVariant` als globale UI-States;
  `lvTabUpdateModeAvailability` wird bei Side-Wechsel und
  Tab-Wechsel aufgerufen.

### SPEC.md
- Levels-Tab-Beschreibung erweitern (oder im neuen „Levels-Tab"-
  Abschnitt aus 04 anpassen):
  - Modus A (relativ, ±60 dB, Nullinie Mitte) — bisheriges Verhalten
  - Modus B (absolut, Y-Achse in qu/CL/CU, Nullinie unten, THR
    innerhalb des Balkens, MCL-Audiologe als gestrichelter Strich,
    Anzeige in qu/CL/CU oben + dB-Delta darunter)
  - Drei Anzeige-Varianten (nur Summe / gestapelt / Summe +
    Vergleichslinien), umschaltbar in beiden Modi.
  - Pfeiltasten-Schritte: in Modus A ±0.5/0.1 dB, in Modus B
    ±1/±5 in der Hersteller-Einheit. Datenspeicherung immer in dB
    mit Nachkommastellen.

---

## Akzeptanztest-Checkliste

Voraussetzung: Bauanleitungen 03 + 04 sind komplett umgesetzt und
funktionieren.

1. **Tool laden**, Tab „Levels" öffnen. Oberhalb der Balken stehen
   jetzt drei Toggle-Gruppen: **Modus** (relativ/absolut), **Anzeige**
   (nur Summe / gestapelt / Vergleichslinien), **Quellen** (Schieber/
   Messung/Kurven) — plus „Alles auf 0".
2. Default beim ersten Öffnen: Modus **relativ**, Anzeige
   **gestapelt** — verhält sich identisch zu Bauanleitung 03.
3. **Anzeige auf „nur Summe" umschalten**: pro Spalte wird nur noch
   ein einziger Balken (Summe der aktiven Quellen) gezeichnet. Bei
   nur-Schieber-Modus = grüner Balken mit Schieber-Wert.
4. **Anzeige auf „Vergleichslinien" umschalten**: Summen-Balken bleibt,
   zusätzlich grüne (Schieber), blaue (wenn Messung an) und orange
   (wenn Kurven an) gestrichelte Linien quer über alle Elektroden.
5. **Ohne eingetragene MCL-Werte**: das Radio „absolut" ist
   ausgegraut, ein Tooltip erklärt den Grund. Klick darauf erscheint
   ohne Effekt (oder erscheint eine Erklärungs-Alert).
6. **MCL eintragen** im Reiter Implantat für mindestens eine aktive
   Elektrode → zurück im Levels-Tab ist „absolut" klickbar.
7. **Auf „absolut" wechseln**: Skala wechselt auf 0..300 qu (MED-EL)
   / 0..255 CL (Cochlear) / 0..600 CU (AB), Nullinie wandert unten.
   Anzeige-Variante springt automatisch auf „nur Summe".
8. **Im Absolutmodus zeigt jede Spalte mit MCL** einen Balken bis zur
   MCL-Höhe; THR-Zone innerhalb des Balkens hellrot/orange abgegrenzt
   (falls THR auch eingetragen). MCL-Audiologen-Wert als dünner
   gestrichelter horizontaler Strich im Balken.
9. **Spalten ohne MCL** zeigen eine gestrichelte Outline und ein „—"
   in der Mitte — kein Balken.
10. **Beschriftung oben am Balken im Absolutmodus**: erste Zeile groß
    der MCL-neu-Wert in qu/CL/CU (z.B. „143 qu"), zweite Zeile klein
    der dB-Delta („(+2.5 dB)").
11. **Pfeil ↑ im Absolutmodus**: qu-Wert steigt um 1, im Datenmodell
    wird der dB-Offset entsprechend angepasst (mit Nachkommastellen).
    Beispiel: bei MCL_audi=100 qu, Schieber-dB=0, Pfeil ↑ → qu=101,
    dB ≈ +0.086. Sichtbar in der zweiten Zeile als „(+0.1 dB)" oder
    genauer.
12. **Shift + Pfeil ↑ im Absolutmodus**: qu-Wert steigt um 5.
13. **Pfeil → im Absolutmodus**: Fokus wandert auf die nächste
    aktive Elektrode mit MCL. Spalten ohne MCL werden übersprungen.
14. **Modus zurück auf „relativ"**: Skala springt zurück auf ±60 dB,
    Variante automatisch zurück auf „gestapelt". Werte unverändert
    (Speicherung in dB bleibt konsistent).
15. **Side-Wechsel** während Modus B aktiv ist: wenn die andere
    Seite keine MCL-Werte hat, fällt der Modus automatisch auf
    relativ zurück; das Toggle „absolut" wird ausgegraut.
16. **JSON speichern und neu laden**: `levelsTabMode` und
    `levelsTabVariant` werden persistiert; nach dem Laden ist die
    Toggle-Stellung wiederhergestellt — sofern die MCL-Bedingung
    erfüllt ist, sonst Fallback auf relativ.
17. **Sprachwechsel**: alle Toggle-Labels in allen vier Sprachen
    korrekt.
18. **Browser-Konsole**: keine Fehler beim Modus-Wechsel oder
    Pfeiltasten-Einsatz.

## Selbstprüfung vor Fertig-Meldung an Sonnet

**Pflicht**: Jeden Akzeptanztest-Punkt einzeln durchgehen und für
jeden melden: erfüllt + Datei- und Zeilenangabe / nicht erfüllt +
Grund / unklar + welche Annahme nötig wäre.

Zusätzliche Selbstprüfungen:

- [ ] `grep "dbFromMedel\|dbFromCochlear\|dbFromAB"` liefert Treffer
  in `core.js` (Deklaration) und in `levels-tab.js` (Aufruf in
  `lvTabStepAbsolute`)?
- [ ] `grep "lvTabMode\|lvTabVariant"` liefert Treffer in
  `state-side.js` (Deklaration), `levels-tab.js` (Auswertung),
  `init.js` (Listener + Persistenz), `file.js` (Save/Load),
  `index.html` (Radio-Inputs)?
- [ ] Wenn der User im Modus B ist und MCL für die fokussierte
  Elektrode löscht (im Implantat-Tab): nächste Pfeiltaste tut
  nichts, kein JS-Fehler in der Konsole.
- [ ] Im Modus B mit Stack-Variante (2b): wenn nicht trivial
  umsetzbar, ist explizit dokumentiert (in IDEEN.md oder einer
  Akzeptanztest-Notiz), warum 2b im Modus B aktuell als „nur Summe"
  fällt zurück oder anders verfährt.
- [ ] `CODESTRUKTUR.md` und `SPEC.md` sind im selben Arbeitsschritt
  aktualisiert worden.
- [ ] Alte JSONs ohne `levelsTabMode`/`levelsTabVariant` öffnen ohne
  Fehler (Defaults aus state-side.js greifen).
