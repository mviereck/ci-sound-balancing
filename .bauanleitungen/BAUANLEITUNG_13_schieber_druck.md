# Bauanleitung 13: Druck-Knopf im Schieber-Tab

Setzt Bauanleitung 09–12 voraus. Fügt einen Druck-Knopf in den
Schieber-Tab ein, der den Schieber-Canvas und eine Werte-Tabelle
pro Elektrode für die aktive Seite druckt.

## Übersicht

1. Druck-Knopf in `index.html` (Schieber-Card) einfügen
2. Druck-Funktion `printSchieberTab()` in `tab-print.js`
3. Click-Listener in `init.js`
4. `applyLang`-Eintrag

## 1. Druck-Knopf in `index.html`

Im Schieber-Panel (`<div id="panel-schieber" class="panel">`,
Z. 688) sitzt die einzige Card mit `<h2 data-t="lvTabTitle">`
(Z. 690). Den H2-Bereich in einen Flex-Wrapper packen:

**Vor**:
```html
<div class="card">
  <h2 data-t="lvTabTitle"></h2>
  <p style="font-size:.84em;color:var(--text-muted);margin-bottom:10px" data-t="lvTabDesc"></p>
```

**Nach**:
```html
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <h2 data-t="lvTabTitle" style="margin:0;"></h2>
    <button class="btn" id="printSchieberBtn"
            style="padding:4px 10px;font-size:0.9em;">
      🖨 <span data-t="printBtn"></span>
    </button>
  </div>
  <p style="font-size:.84em;color:var(--text-muted);margin-bottom:10px;margin-top:6px;" data-t="lvTabDesc"></p>
```

## 2. `tab-print.js` ergänzen

```js
// --- Schieber-Tab ---
function printSchieberTab() {
  const s = sideData[activeSide];
  if (!s) return;
  const m = s.manufacturer || "medel";
  const isAbs = lvTabMode === "abs";

  // Modus/Variante als Info
  const modeLabel  = isAbs ? (t("lvTabModeAbsolute") || "absolut")
                           : (t("lvTabModeRelative") || "relativ");
  const variantLbl =
    lvTabVariant === "sum"   ? (t("lvTabVarSum")   || "nur Summe")
    : lvTabVariant === "lines" ? (t("lvTabVarLines") || "Vergleichslinien")
    : (t("lvTabVarStack") || "gestapelt");

  // Canvas → Bild
  const cv = document.getElementById("lvTabCv");
  const canvasImg = cv ? canvasToImg(cv, 800) : "";

  // Werte-Tabelle pro Elektrode
  const ml = s.manualLevels || [];
  const headers = [
    "Nr.",
    "dB-Wert",
  ];
  if (isAbs) {
    headers.push(_upperHdr(m) + " (neu)");
  }
  const rows = [];
  for (let i = 0; i < s.nEl; i++) {
    const elNum = dEN(i);
    const ap = i === 0 ? " (apikal)"
             : i === s.nEl - 1 ? " (basal)"
             : "";
    const db = ml[i] != null ? ml[i].toFixed(1) : "0.0";
    let unitVal = "";
    if (isAbs && typeof getEffectiveLevels === "function") {
      // Im Absolutmodus: in Hersteller-Einheit umrechnen
      const im = s.implant || {};
      const upper = m === "medel"
        ? (im.mcl ? im.mcl[i] : null)
        : (im.upperLevel ? im.upperLevel[i] : null);
      if (upper != null) {
        const dbVal = ml[i] != null ? ml[i] : 0;
        if (m === "medel" && typeof calcMedel === "function") {
          unitVal = Math.round(calcMedel(upper, dbVal));
        } else if (m === "cochlear" && typeof calcCochlear === "function") {
          unitVal = Math.round(
            calcCochlear(upper, dbVal, im.generation || "B"),
          );
        } else if (m === "ab" && typeof calcAB === "function") {
          unitVal = Math.round(calcAB(upper, dbVal, im.idr || 60));
        }
      }
    }
    const tds = [
      `E${elNum}${ap}`,
      db + " dB",
    ];
    if (isAbs) tds.push(unitVal === "" ? "—" : String(unitVal));
    rows.push(
      "<tr>" +
        tds
          .map(
            v =>
              `<td style="border:1px solid #ccc;padding:3px 8px;">${_tpEsc(v)}</td>`,
          )
          .join("") +
        "</tr>",
    );
  }
  const table = `
    <table style="border-collapse:collapse;font-size:0.85em;width:100%;">
      <thead>
        <tr>${headers
          .map(
            h =>
              `<th style="border:1px solid #888;padding:3px 8px;background:#eee;text-align:left;">${_tpEsc(h)}</th>`,
          )
          .join("")}</tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  // Info-Zeile (Modus + Variante)
  const info = `
    <p style="font-size:0.9em;margin:8px 0 12px 0;color:#444;">
      <strong>${_tpEsc(t("lvTabModeLabel") || "Modus")}:</strong> ${_tpEsc(modeLabel)}
      &nbsp;·&nbsp;
      <strong>${_tpEsc(t("lvTabVariantLabel") || "Variante")}:</strong> ${_tpEsc(variantLbl)}
    </p>
  `;

  const body = info + canvasImg + '<div style="height:12px;"></div>' + table;
  openPrintWindow(t("lvTabTitle") || "Schieber", body);
}
```

**Hinweis zu den `calc*`-Funktionen**: Diese sind in `core.js`
deklariert. Die Argumentlisten können je nach aktueller
Implementation abweichen — Sonnet bitte vor Verwendung in
`core.js` nachsehen und ggf. die Aufrufe anpassen. Die exakten
Signaturen stehen in CODESTRUKTUR.md (Modul-Tabelle, core.js-
Zeile). Bei Abweichung: nicht raten, sondern eine kurze
Rückfrage an den Nutzer.

## 3. Click-Listener in `init.js`

```js
  const printSchieberBtn = document.getElementById("printSchieberBtn");
  if (printSchieberBtn) {
    printSchieberBtn.title = t("printBtn");
    printSchieberBtn.addEventListener("click", printSchieberTab);
  }
```

## 4. `applyLang`-Update

```js
  const _psb = document.getElementById("printSchieberBtn");
  if (_psb) _psb.title = t("printBtn");
```

## Akzeptanztest

Vorbereitung: im Schieber-Tab bei drei oder vier Elektroden die
dB-Werte mit Pfeiltasten verändern (positive und negative
Anteile).

1. Tab **Schieber** öffnen. Erwartet: rechts neben dem Titel ein
   „🖨 Drucken"-Knopf.

2. Modus **relativ** lassen. Knopf klicken. Erwartet:
   - Mini-Kopf „CI Sound Balancing — Schieber" usw.
   - Info-Zeile „Modus: relativ · Variante: gestapelt" (oder
     was aktiv ist).
   - Canvas-Bild des Schiebers mit den balkenförmigen
     Visualisierungen.
   - Tabelle mit Spalten „Nr." und „dB-Wert", eine Zeile pro
     Elektrode mit Werten in der Form „+2.5 dB", „-1.0 dB",
     „0.0 dB" usw.

3. Modus auf **absolut** umschalten (sofern MCL/Upper-Level für
   mindestens eine Elektrode gesetzt ist; sonst ist das Radio
   ausgegraut — dann erst im Implantat-Tab MCL setzen). Knopf
   klicken. Erwartet:
   - Info-Zeile „Modus: absolut".
   - Tabelle hat eine zusätzliche Spalte mit Hersteller-Einheit
     (z.B. „MCL (qu) (neu)" bei MED-EL); Werte als Ganzzahl.
   - Elektroden ohne MCL zeigen „—" in der Hersteller-Spalte.

4. Side wechseln, nochmal drucken. Mini-Kopf zeigt die andere
   Seite, Werte sind die der anderen Seite.

5. Regression: alle bisherigen Druck-Knöpfe und der zentrale
   „Ergebnisse drucken" funktionieren wie zuvor.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `#printSchieberBtn` in der Schieber-Card | | |
| `printSchieberTab` in `tab-print.js` | | |
| Im Absolutmodus enthält die gedruckte Tabelle eine Hersteller-Einheit-Spalte | | |
| Im Relativmodus enthält die gedruckte Tabelle **keine** Hersteller-Spalte | | |
| Click-Listener in `init.js` | | |
| `applyLang`-Zeile für den Knopf-Title | | |
| Funktionen aus 10/11/12 unverändert | | |
| `core.js` unverändert | | |
| Keine andere Datei angefaßt | | |

Falls die Signaturen von `calcMedel` / `calcCochlear` / `calcAB`
in `core.js` nicht zum Code in diesem Bauanleitungs-Snippet passen:
**vor dem Bauen Rückfrage stellen**, nicht raten.
