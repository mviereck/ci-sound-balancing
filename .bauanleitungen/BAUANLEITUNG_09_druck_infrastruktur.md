# Bauanleitung 09: Druck-Infrastruktur (Basis für 10–13)

Diese Bauanleitung legt die Druck-Infrastruktur für Einzel-
ausdrucke pro Tab an. Sie ist die Voraussetzung für die
Bauanleitungen 10–13, die pro Tab Druck-Knöpfe ergänzen.

**Sichtbares Verhalten nach dieser Anleitung**: keines. Es werden
nur globale Helper-Funktionen, i18n-Keys und eine neue JS-Datei
hinzugefügt. Der bestehende „Alles drucken"-Button in
Laden/Speichern bleibt unverändert.

## Übersicht

1. Neue Datei `print.js` mit drei Helper-Funktionen:
   - `buildPrintHeader(tabTitle)` — HTML-Mini-Kopf
   - `openPrintWindow(tabTitle, bodyHtml)` — Druckfenster öffnen
     und drucken
   - `canvasToImg(canvas)` — Canvas zu `<img>`-Tag (PNG-Datei-URL)
2. `print.js` im Loader-Block von `index.html` ergänzen
3. Neue i18n-Keys in allen 4 Sprachen
4. `CODESTRUKTUR.md` aktualisieren

## 1. Neue Datei `print.js`

Anlegen im Projekt-Root mit folgendem Inhalt:

```js
// ============================================================
// PRINT INFRASTRUCTURE
// ============================================================
//
// Gemeinsame Helper für Einzelausdrucke pro Tab. Wird von den
// Tab-spezifischen Druck-Handlern (Implantat, Meßergebnisse,
// Kurven, Schieber) verwendet. Der zentrale "Alles drucken"-Button
// in Laden/Speichern (init.js fPrintBtn) bleibt davon unberührt.

function _printEscHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Liefert HTML-String mit zweizeiligem Mini-Kopf:
//   Zeile 1 groß:  "CI Sound Balancing — <tabTitle>"
//   Zeile 2 klein: Datum · Seite · Implantat
function buildPrintHeader(tabTitle) {
  const dateStr = new Date().toISOString().slice(0, 10);
  const sideStr =
    activeSide === "left" ? t("sideLeft") : t("sideRight");
  const cfg = (sideData[activeSide] && sideData[activeSide].config) || "ci";
  const cfgSuffix =
    cfg !== "ci" ? ` (${t("cfgOpt_" + cfg) || cfg})` : "";
  const impl = (sideData[activeSide] && sideData[activeSide].implant) || {};
  const mfrName = (MFR[mfr] && MFR[mfr].label) || mfr || "";
  const procName = impl.processor || "";
  const modelName = impl.model || "";
  const implParts = [];
  if (mfrName) implParts.push(mfrName);
  if (procName) implParts.push(procName);
  if (modelName) implParts.push(modelName);
  const implStr = implParts.length ? implParts.join(", ") : "—";
  return `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: sans-serif;">
      <h1 style="font-size: 1.5em; margin: 0 0 4px 0;">CI Sound Balancing — ${_printEscHtml(tabTitle)}</h1>
      <p style="font-size: 0.85em; color: #666; margin: 0;">
        ${_printEscHtml(t("printHeaderDate"))}: ${dateStr}
        &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderSide"))}: ${_printEscHtml(sideStr)}${_printEscHtml(cfgSuffix)}
        &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderImpl"))}: ${_printEscHtml(implStr)}
      </p>
    </div>
  `;
}

// Wandelt ein Canvas in einen <img>-Tag mit PNG-Daten-URL.
// Optional: maxWidth-Style in px für die Darstellung im Druck.
function canvasToImg(canvas, maxWidth) {
  if (!canvas) return "";
  let dataUrl;
  try {
    dataUrl = canvas.toDataURL("image/png");
  } catch (e) {
    console.error("canvasToImg: toDataURL fehlgeschlagen", e);
    return "";
  }
  const styleAttr = maxWidth
    ? ` style="max-width:${maxWidth}px;width:100%;height:auto;"`
    : ` style="max-width:100%;height:auto;"`;
  return `<img src="${dataUrl}"${styleAttr} alt="">`;
}

// Öffnet ein neues Browserfenster, schreibt komplettes HTML hinein
// (mit Mini-Kopf + bodyHtml) und ruft window.print() auf.
// tabTitle: bereits lokalisierter Titelstring (z.B. t("tabFreq"))
// bodyHtml: das eigentliche Tab-Inhalt-HTML als String
function openPrintWindow(tabTitle, bodyHtml) {
  const header = buildPrintHeader(tabTitle);
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CI Sound Balancing — ${_printEscHtml(tabTitle)}</title>
  <style>
    body { margin: 0; padding: 20px; font-family: sans-serif; color: #000; }
    h1, h2, h3 { color: #000; }
    table { border-collapse: collapse; }
    @media print {
      body { margin: 0; padding: 0; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  ${header}
  ${bodyHtml}
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) {
    alert(t("printPopupBlocked"));
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
```

**Wichtig**:
- `print.js` wird im **globalen Scope** geladen (kein IIFE, kein
  Modul-Export). Andere Module rufen die Helper direkt auf.
- Die drei `_printEscHtml`-internen Funktion bleibt mit
  Unterstrich-Präfix, damit klar ist daß sie modul-intern ist
  (nicht für andere Module gedacht).
- Browser-Popup-Blocker können `window.open` blockieren. Der
  `if (!w)`-Zweig fängt das ab und zeigt eine i18n-Meldung
  (siehe Punkt 3).

## 2. Eintrag im `index.html`-Loader

In `index.html`, im Inline-Loader-Block im `<head>` das Array der
Skript-Dateien öffnen. Die exakte Position: **nach `file.js` und
vor `tabs-eq.js`**. Nach Bauanleitung-09-Fertigstellung sollte die
Reihenfolge so aussehen:

```
…
"file.js",
"print.js",      ← neu einfügen
"tabs-eq.js",
…
```

Sonnet: suche das Loader-Array im `<head>` (oder im `<script>` ganz
oben in `index.html`) und füge dort `"print.js"` an dieser Stelle
ein. Die exakte Zeilennummer kann ich nicht zusichern, weil das
Array stilistisch variieren kann — die Position relativ zu `file.js`
und `tabs-eq.js` ist das Verbindliche.

## 3. Neue i18n-Keys (alle 4 Sprachen)

In `i18n.js` in **jedem** der vier Sprachblöcke (DE, EN, FR, ES) die
folgenden Keys einfügen. Empfohlene Position: bei den anderen
`print*`-/`fPrint*`-Keys, im File-Tab-Block (in der Nähe von
`fPrint`).

```js
    printBtn: "Drucken",
    printPopupBlocked: "Druckfenster wurde vom Browser blockiert. Bitte Popups für diese Seite erlauben.",
    printHeaderDate: "Datum",
    printHeaderSide: "Seite",
    printHeaderImpl: "Implantat",
```

EN:

```js
    printBtn: "Print",
    printPopupBlocked: "Print window was blocked by the browser. Please allow popups for this page.",
    printHeaderDate: "Date",
    printHeaderSide: "Side",
    printHeaderImpl: "Implant",
```

FR:

```js
    printBtn: "Imprimer",
    printPopupBlocked: "La fenêtre d'impression a été bloquée par le navigateur. Veuillez autoriser les fenêtres contextuelles pour cette page.",
    printHeaderDate: "Date",
    printHeaderSide: "Côté",
    printHeaderImpl: "Implant",
```

ES:

```js
    printBtn: "Imprimir",
    printPopupBlocked: "La ventana de impresión fue bloqueada por el navegador. Permita las ventanas emergentes para esta página.",
    printHeaderDate: "Fecha",
    printHeaderSide: "Lado",
    printHeaderImpl: "Implante",
```

Nichts an existierenden Keys ändern. Keine HTML-Datei anfassen
(außer dem Loader-Eintrag aus Punkt 2).

## 4. CODESTRUKTUR.md aktualisieren

Im Block „Module im Ladeverlauf" einen neuen Eintrag nach `file.js`
einfügen (vor `tabs-eq.js`). Vorschlag-Text:

```
| 12b | print.js | Druck-Infrastruktur: `buildPrintHeader` (Mini-Kopf für Einzelausdrucke), `openPrintWindow` (neues Fenster, HTML schreiben, drucken), `canvasToImg` (Canvas → `<img>` PNG-Daten-URL). Wird von den Tab-spezifischen Druck-Handlern in den jeweiligen Tab-Modulen aufgerufen. Der zentrale „Alles drucken"-Button (`fPrintBtn` in init.js) ist unabhängig davon. |
```

Außerdem: an die Modul-Tabelle die existierenden Module
**umnummerieren ist nicht nötig** — die Tabelle benutzt freie
Zahlen (z.B. „14b" für levels-tab.js). „12b" für print.js ist im
selben Stil zulässig.

Im Block „Edit-Szenarien" am Ende einen neuen Eintrag hinzufügen:

```
### Neuer Tab-Einzeldruck
- Tab-Modul oder init.js: Druck-Knopf-Listener registrieren
- print.js: nicht ändern (Infrastruktur ist stabil)
- Bei neuen Druck-Header-Feldern: i18n.js (alle 4 Sprachen),
  buildPrintHeader in print.js erweitern
```

## 5. SPEC.md aktualisieren

Im Block „Drucken" am Ende einen Absatz ergänzen:

```
- Einzelne Tabs (Implantat, Meßergebnisse-Sub-Tabs, Kurven,
  Schieber) erhalten je einen eigenen Druck-Knopf, der nur den
  Inhalt dieses Tabs (bzw. aktiven Sub-Tabs) für die aktuell
  aktive Seite druckt. Jeder Einzeldruck trägt einen Mini-Kopf
  mit App-Name, Tab-Titel, Datum, Seite und Implantat-
  Identifikation. Der bestehende „Alles drucken"-Button in
  Laden/Speichern bleibt unverändert und druckt weiterhin beide
  Seiten mit allen Sektionen.
```

## Nicht zu tun

- Keinen Druck-Knopf in irgendeinem Tab platzieren. Das passiert in
  den Bauanleitungen 10–13.
- Den bestehenden `fPrintBtn`-Handler in init.js nicht anfassen.
- Keine bestehenden Helper umbenennen oder verschieben.
- Keine Print-CSS-Regeln in `style.css` einfügen — der Druck
  läuft in einem separaten `window.open`-Fenster mit eigenem
  Inline-CSS in `print.js`.

## Akzeptanztest (nach Sonnets Build vom Nutzer durchzugehen)

1. Tool im Browser laden. Erwartet: keine Fehler in der
   Browser-Konsole (F12 → Console).

2. In der Konsole eingeben (kopierbar):
   ```js
   typeof buildPrintHeader === 'function' &&
   typeof openPrintWindow === 'function' &&
   typeof canvasToImg === 'function'
   ```
   Erwartet: `true`.

3. In der Konsole eingeben:
   ```js
   buildPrintHeader('Test-Tab')
   ```
   Erwartet: ein HTML-String, der „CI Sound Balancing — Test-Tab"
   sowie Datum, „LINKS" (oder die jeweils aktive Seite), und die
   Implantat-Info enthält.

4. Tab „Laden/Speichern" öffnen, auf den existierenden „Ergebnisse
   drucken"-Button klicken. Erwartet: das bisherige Druckfenster
   erscheint wie zuvor, mit beiden Seiten. **Keine Regression.**

5. Sprachen DE / EN / FR / ES durchschalten. In der Konsole
   `t("printBtn")` aufrufen. Erwartet pro Sprache: Drucken / Print
   / Imprimer / Imprimir.

## Selbstprüfungs-Auftrag an Sonnet (vor Fertig-Meldung)

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `print.js` existiert im Projekt-Root | | |
| `print.js` enthält die drei globalen Funktionen `buildPrintHeader`, `openPrintWindow`, `canvasToImg` | | |
| Loader-Array in `index.html` enthält `"print.js"` zwischen `"file.js"` und `"tabs-eq.js"` | | |
| Alle 5 neuen i18n-Keys (`printBtn`, `printPopupBlocked`, `printHeaderDate`, `printHeaderSide`, `printHeaderImpl`) in DE, EN, FR, ES vorhanden — also je 5 × 4 = 20 Einträge | | |
| Existierender `fPrintBtn`-Handler in `init.js` ist unverändert | | |
| CODESTRUKTUR.md hat einen neuen `print.js`-Eintrag in der Modul-Tabelle | | |
| CODESTRUKTUR.md hat den neuen „Neuer Tab-Einzeldruck"-Eintrag im Edit-Szenarien-Block | | |
| SPEC.md „Drucken"-Block hat den neuen Absatz | | |
| Keine andere Datei angefaßt (außer `print.js`, `index.html`, `i18n.js`, `CODESTRUKTUR.md`, `SPEC.md`) | | |

Bei Unklarheiten: fragen, nicht raten.
