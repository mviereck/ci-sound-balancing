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
//   Zeile 1 groß:  "CImbel — CI sound balancing — <tabTitle>"
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
  const logoUrl = new URL("assets/images/CImbel_logo.png", window.location.href).href;
  const versionStr = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "";
  const versionLine = versionStr
    ? _printEscHtml(t("printHeaderToolVersion").replace("{VERSION}", versionStr))
    : "";
  return `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: sans-serif; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
      <div style="flex: 1; min-width: 0;">
        <h1 style="font-size: 1.5em; margin: 0 0 4px 0;">CImbel — CI sound balancing — ${_printEscHtml(tabTitle)}</h1>
        <p style="font-size: 0.85em; margin: 0;">
          ${_printEscHtml(t("printHeaderDate"))}: ${dateStr}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderSide"))}: ${_printEscHtml(sideStr)}${_printEscHtml(cfgSuffix)}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderImpl"))}: ${_printEscHtml(implStr)}
        </p>
        ${versionLine ? `<p style="font-size: 0.78em; margin: 4px 0 0 0; font-style: italic;">${versionLine}</p>` : ""}
      </div>
      <img src="${logoUrl}" alt="CImbel — CI sound balancing" style="height:150px;width:auto;flex-shrink:0;" />
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
// tabTitle: bereits lokalisierter Titelstring (z.B. t("tabFreq")) — geht in
//   den sichtbaren <h1>-Druck-Header
// bodyHtml: das eigentliche Tab-Inhalt-HTML als String
// shortTitle (optional, BA 268.1): kompakter Stamm für <title> / PDF-Dateinamen,
//   falls die Tab-Bezeichnung dafür zu lang wäre (z.B. Audiologen-Druck).
//   Default: tabTitle.
function openPrintWindow(tabTitle, bodyHtml, shortTitle) {
  const header = buildPrintHeader(tabTitle);
  const _titleStem = "CImbel " + String(shortTitle || tabTitle || "");
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${_printEscHtml((typeof buildCImbelPrintTitle === "function") ? buildCImbelPrintTitle(_titleStem) : _titleStem)}</title>
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
