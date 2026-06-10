# Bauanleitung 10: Druck-Knopf im Implantat-Tab

Setzt Bauanleitung 09 voraus. Fügt einen Druck-Knopf in den
Implantat-Tab ein, der die Frequenz-/Elektrodentabelle inkl.
Implantat-Parameter für die aktuell aktive Seite druckt.

## Übersicht

1. Druck-Knopf in `index.html` (Implantat-Card) einfügen
2. Druck-Funktion `printImplantTab()` in einer neuen Datei
   `tab-print.js` anlegen (Sammeldatei für alle Tab-spezifischen
   Druck-Funktionen — wird in den Folge-Anleitungen erweitert)
3. Loader-Eintrag in `index.html`
4. Click-Listener in `init.js`
5. `CODESTRUKTUR.md` ergänzen

## 1. Druck-Knopf in `index.html`

Im Implantat-Panel (`<div id="panel-setup" class="panel">`,
Z. 161) sitzt eine Card mit `<h2 id="freqTitle">` (Z. 163). Diesen
H2-Bereich in einen Flex-Wrapper packen, der rechts den
Druck-Knopf trägt.

**Vor**:
```html
<div class="card">
  <h2 id="freqTitle"></h2>
```

**Nach**:
```html
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <h2 id="freqTitle" style="margin:0;"></h2>
    <button class="btn" id="printImplantBtn"
            title=""
            style="padding:4px 10px;font-size:0.9em;">
      🖨 <span data-t="printBtn"></span>
    </button>
  </div>
```

Der `title`-Attribut bleibt leer und wird durch `applyLang` oder
direkt im `init.js`-Handler gesetzt (siehe Punkt 4).

## 2. Neue Datei `tab-print.js`

Sammeldatei für alle Tab-spezifischen Druck-Funktionen. Wird
in den Bauanleitungen 11–13 weiter ergänzt; hier ist nur
`printImplantTab()` enthalten.

Inhalt:

```js
// ============================================================
// TAB-SPEZIFISCHE DRUCK-FUNKTIONEN
// ============================================================
//
// Jede Funktion baut für ihren Tab einen HTML-String mit dem
// Druckinhalt zusammen und ruft openPrintWindow() aus print.js
// auf. Die globalen Helper buildPrintHeader und canvasToImg sind
// in print.js definiert.

function _tpEsc(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Implantat-Tab ---
function printImplantTab() {
  const s = sideData[activeSide];
  if (!s) return;
  const im = s.implant || {};
  const cfg = s.config || "ci";
  const isCi = cfg === "ci";
  const m = s.manufacturer || "medel";

  // Implantat-Parameter-Block
  const paramRows = [];
  paramRows.push([t("cfgLabel"), t("cfgOpt_" + cfg) || _cfgFallback(cfg)]);
  if (isCi) {
    paramRows.push([t("lblMfr") || "Hersteller", (MFR[m] && MFR[m].label) || m]);
    if (im.model)     paramRows.push([t("lblImplModel"), im.model]);
    if (im.processor) paramRows.push([t("lblImplProc"),  im.processor]);
    if (im.cValue != null && m === "medel")
      paramRows.push([t("lblImplC"), String(im.cValue)]);
    if (im.idr != null && m === "ab")
      paramRows.push([t("lblImplIDR"), im.idr + " dB"]);
    if (im.iidr != null && m === "cochlear")
      paramRows.push([t("lblImplIIDR"), im.iidr + " dB"]);
    if (im.generation && m === "cochlear")
      paramRows.push([t("lblImplGen"), im.generation]);
  }
  const paramTable = `
    <table style="border-collapse:collapse;font-size:0.9em;margin-bottom:16px;">
      ${paramRows
        .map(
          ([k, v]) =>
            `<tr>
               <td style="padding:2px 12px 2px 0;color:#555;">${_tpEsc(k)}:</td>
               <td style="padding:2px 0;font-weight:600;">${_tpEsc(v)}</td>
             </tr>`,
        )
        .join("")}
    </table>
  `;

  // Frequenz-/Elektrodentabelle
  const headers = [
    "Nr.",
    t("freqColHz") || "Hz",
    t("freqColHzOwn") || "Hz eigen",
    t("implThHdr") || "THR",
    _upperHdr(m),
    t("freqColStatus") || "Status",
    t("freqColNote") || "Notiz",
  ];
  const rows = [];
  for (let i = 0; i < s.nEl; i++) {
    const elNum = dEN(i);
    const apexBasal =
      i === 0 ? " (apikal)" : i === s.nEl - 1 ? " (basal)" : "";
    const hzStd = s.freqs[i] != null ? Math.round(s.freqs[i]) : "—";
    const hzOwn = s.elFreqOwn[i] != null ? Math.round(s.elFreqOwn[i]) : "";
    const thr = im.thr[i] != null ? im.thr[i] : "";
    const upper = isCi
      ? (m === "medel"
          ? im.mcl[i] != null ? im.mcl[i] : ""
          : im.upperLevel[i] != null ? im.upperLevel[i] : "")
      : "";
    const stKey = s.elSt[i];
    const stText =
      stKey === "deactivated"
        ? t("statusDeactivated") || "deaktiviert"
        : stKey
          ? t("status_" + stKey) || stKey
          : "";
    const note = s.elNt[i] || "";
    rows.push(
      `<tr>
        <td style="border:1px solid #ccc;padding:3px 6px;">E${elNum}${_tpEsc(apexBasal)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzStd)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzOwn)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(thr)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(upper)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(stText)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(note)}</td>
      </tr>`,
    );
  }
  const elTable = `
    <table style="border-collapse:collapse;width:100%;font-size:0.85em;">
      <thead>
        <tr>${headers.map(h => `<th style="border:1px solid #888;padding:3px 6px;background:#eee;text-align:left;">${_tpEsc(h)}</th>`).join("")}</tr>
      </thead>
      <tbody>${rows.join("")}</tbody>
    </table>
  `;

  const body = paramTable + elTable;
  openPrintWindow(t("tabFreq") || "Implantat", body);
}

function _upperHdr(m) {
  if (m === "medel")    return t("implMclHdr")  || "MCL (qu)";
  if (m === "cochlear") return t("implCLvlHdr") || "C-Level (CL)";
  if (m === "ab")       return t("implMLvlHdr") || "M-Level (CU)";
  return "";
}

function _cfgFallback(cfg) {
  return cfg === "ci" ? "CI"
       : cfg === "hg" ? "Hörgerät"
       : cfg === "normal" ? "Normal"
       : cfg === "shoh" ? "Schwerhörig"
       : cfg === "deaf" ? "Taub"
       : cfg;
}
```

**Hinweis**: Einige `t("...")`-Keys (`cfgOpt_ci`, `status_*`,
`freqColHz` usw.) existieren evtl. in `i18n.js` schon, evtl.
nicht. Der Code nutzt einen Fallback (`|| "literal"`), damit der
Druck auch ohne perfekte i18n-Abdeckung lesbar bleibt. Sonnet:
**nicht** neue i18n-Keys ergänzen, wenn ein Key fehlt — der
Fallback macht den Druck robust. Eine spätere i18n-Vervollständigung
ist separater Wartungsschritt.

## 3. Loader-Eintrag in `index.html`

Im Loader-Array `tab-print.js` **direkt nach `print.js`** und vor
`tabs-eq.js` einfügen:

```
…
"file.js",
"print.js",
"tab-print.js",   ← neu
"tabs-eq.js",
…
```

## 4. Click-Listener in `init.js`

Im großen `DOMContentLoaded`-Handler in `init.js` einen Listener
für den neuen Knopf eintragen. Sinnvolle Stelle: in der Nähe der
anderen `fPrintBtn`/`fSaveBtn`/`fLoadBtn`-Listener (≈ Z. 144 ff.,
direkt vor oder nach dem `fPrintBtn`-Block).

```js
  const printImplantBtn = document.getElementById("printImplantBtn");
  if (printImplantBtn) {
    printImplantBtn.title = t("printBtn");
    printImplantBtn.addEventListener("click", printImplantTab);
  }
```

Zusätzlich in `i18n.js`-Funktion `applyLang` (am Ende, wo andere
DOM-Texte aktualisiert werden) eine Zeile ergänzen, damit der
`title` bei Sprachwechsel mitwandert:

```js
  const _pib = document.getElementById("printImplantBtn");
  if (_pib) _pib.title = t("printBtn");
```

Sonnet: nicht durch wildes Suchen nach „applyLang" raten — die
Funktion ist klar am Anfang von `i18n.js` definiert. Die Zeile am
besten in den Block ergänzen, der die anderen Druck-bezogenen
Elemente betrifft (oder wenn unklar, am Ende von `applyLang`).

## 5. CODESTRUKTUR.md ergänzen

Modul-Tabelle: neuen Eintrag für `tab-print.js` einfügen, direkt
nach `print.js`:

```
| 12c | tab-print.js | Tab-spezifische Druck-Funktionen: `printImplantTab` (Bauanleitung 10), kommende `printErgebnisTab`, `printKurvenTab`, `printSchieberTab` (Bauanleitungen 11–13). Nutzen die Helper aus `print.js`. |
```

## Nicht zu tun

- Den existierenden `fPrintBtn`-Block nicht ändern.
- Die Tabelle `buildFreqTable` in `freq-table.js` nicht
  modifizieren — `printImplantTab` baut aus dem State eine eigene
  Druck-Tabelle, unabhängig vom UI-DOM (das UI-DOM enthält
  Buttons/Dropdowns, die nicht gedruckt werden sollen).
- Keine Print-CSS in `style.css`.

## Akzeptanztest (vom Nutzer durchzugehen)

1. Tool laden, Tab **Implantat** öffnen.
   - Erwartet: rechts oben in der Card neben dem Titel
     „Frequenzen" (oder vergleichbar) erscheint ein Druck-Knopf
     „🖨 Drucken".
   - Sprache auf EN/FR/ES umstellen: Knopf-Text wird zu Print /
     Imprimer / Imprimir.

2. Daten vorbereiten: bei aktiver Seite (z.B. LINKS) im Implantat-
   Tab Hersteller MED-EL, Modell „Synchrony 2", Prozessor
   „Sonnet 3" eintragen. Bei mindestens einer Elektrode THR und
   MCL setzen, eine Notiz schreiben.

3. Druck-Knopf klicken.
   - Erwartet: ein neues Browser-Fenster öffnet sich, der
     Druckdialog erscheint.
   - Im Druck-Layout: oben der Mini-Kopf mit
     „CI Sound Balancing — Implantat" (Tab-Titel kann je nach
     Sprache variieren), Datum, „Seite: LINKS", „Implantat:
     MED-EL, Sonnet 3, Synchrony 2".
   - Darunter: Parameter-Tabelle (Konfiguration, Hersteller,
     Modell, Prozessor, c-Wert sofern gesetzt).
   - Darunter: Elektroden-Tabelle mit allen Elektroden, deinen
     THR/MCL-Werten, der Notiz.

4. Seitenwechsel testen: Side auf RECHTS umschalten, Druck-Knopf
   klicken. Erwartet: Mini-Kopf zeigt „Seite: RECHTS" und die
   Daten der rechten Seite.

5. Konfigurations-Test: Konfiguration auf „Hörgerät" stellen.
   Knopf klicken. Erwartet: Mini-Kopf zeigt „Seite: LINKS
   (Hörgerät)" oder ähnlich (je nach `cfgOpt_hg`-i18n-Wert);
   Hersteller-Block ist ausgeblendet, weil nicht CI.

6. Regression: in Laden/Speichern den bestehenden „Ergebnisse
   drucken"-Button klicken. Erwartet: das vollständige
   Gesamt-Druck-Fenster wie zuvor, unverändert.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| Druck-Knopf `#printImplantBtn` in `index.html` im Implantat-Panel | | |
| `tab-print.js` existiert und enthält `printImplantTab` | | |
| Loader-Array in `index.html` enthält `"tab-print.js"` direkt nach `"print.js"` | | |
| Click-Listener für `printImplantBtn` in `init.js` registriert | | |
| `applyLang` setzt `title` des Druck-Knopfs | | |
| CODESTRUKTUR.md hat neuen `tab-print.js`-Eintrag | | |
| Bestehender `fPrintBtn`-Block unverändert | | |
| `buildFreqTable` / `buildImplantCard` unverändert | | |
| Keine andere Datei angefaßt | | |

Bei Unklarheiten (insbesondere zur exakten Position des Loader-
Eintrags oder zur `applyLang`-Stelle): vor dem Fertig-Melden fragen.
