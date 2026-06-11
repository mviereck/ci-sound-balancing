# Bauanleitung 272 — Patientenzeile (Name + Zusatzwort) im sichtbaren Druckkopf

## Ziel

Im Reiter **Laden/Speichern** gibt es drei Eingabefelder: **Nachname**,
**Vorname** und **„Dateinamen ergänzen um eigenes Wort"** (das
Zusatzwort). Diese drei Werte landen heute bereits in den Dateinamen
und im vorgeschlagenen PDF-Dateinamen, **nicht** aber im sichtbaren Kopf
der Ausdrucke.

Diese Bauanleitung ergänzt den sichtbaren Druckkopf um **eine neue
Zeile** mit Nachname, Vorname und Zusatzwort. Beispiel:

```
CImbel — CI sound balancing — Frequenzkurve
Müller, Anna — Hörtest
Datum: 2026-06-11 · Seite: rechts · Implantat: MED-EL …
```

Der Druckkopf wird zentral von **einer** Funktion gestellt
(`buildPrintHeader` in `js/print.js`), die alle Druckpfade
(Frequenzkurve, Messungen, Archiv-PDF usw.) gemeinsam nutzen. Es ist
also nur **eine** Stelle zu ändern.

Es sind **keine i18n-Texte** betroffen: Die neue Zeile besteht
ausschließlich aus den vom Nutzer eingegebenen Daten, nicht aus
übersetzbaren Beschriftungen. `en.js`/`fr.js`/`es.js` bleiben
unverändert.

## Regeln (Pflicht)

- Im Code **ausschließlich ASCII-Anführungszeichen** `"` und `'`
  verwenden. Der Geviertstrich `—` und das Komma `,` stehen nur
  **innerhalb** von String-Werten und sind dort erlaubt.
- Keine strukturellen Änderungen, keine neuen Dateien, keine neuen
  globalen Variablen. Nur `js/print.js` und `js/version.js` werden
  angefaßt.

## Schritt 1 — Version bumpen

In `js/version.js`:

```js
const APP_VERSION = "0.4.272-beta";
```

(vorher: `"0.4.271.4-beta"`)

## Schritt 2 — Helper für die Patientenzeile anlegen

In `js/print.js` **direkt vor** der Funktion `buildPrintHeader`
(aktuell Zeile 22, der Kommentarblock `// Liefert HTML-String …`
beginnt bei Zeile 19) folgenden Helper einfügen:

```js
// ---------- BA 272: Patientenzeile für den sichtbaren Druckkopf ----------
// Setzt Nachname, Vorname und Zusatzwort (userFileSuffix) zu einer
// Zeile zusammen. Format: "Nachname, Vorname — Zusatzwort".
// - Ist nur eines der Namensfelder gefüllt, erscheint nur dieses
//   (ohne Komma).
// - Trenner zum Zusatzwort ist der Geviertstrich " — ".
// - Sind alle drei Felder leer, liefert die Funktion "" (leerer
//   String); der Aufrufer läßt die Zeile dann ganz weg.
// - Ist nur das Zusatzwort gefüllt, steht dort nur das Wort.
// Original-Schreibweise (Umlaute) bleibt erhalten; Escaping erfolgt
// im Aufrufer per _printEscHtml.
function _printPatientLine() {
  const ln = (typeof userLastName   === "string" ? userLastName   : "").trim();
  const fn = (typeof userFirstName  === "string" ? userFirstName  : "").trim();
  const sf = (typeof userFileSuffix === "string" ? userFileSuffix : "").trim();
  let nameBlock = "";
  if (ln && fn) nameBlock = ln + ", " + fn;
  else if (ln)  nameBlock = ln;
  else if (fn)  nameBlock = fn;
  let line = nameBlock;
  if (sf) line = line ? (line + " — " + sf) : sf;
  return line;
}
```

`userLastName`, `userFirstName` und `userFileSuffix` sind globale
Variablen aus `js/state-side.js` und im Druck-Kontext verfügbar
(werden in `buildCImbelPrintTitle` in derselben Datei `js/file.js`
bereits genauso gelesen).

## Schritt 3 — Patientenzeile in den Druckkopf einsetzen

In `js/print.js`, innerhalb von `buildPrintHeader`, die Zeile mit der
Patientenangabe **zwischen** dem großen Titel (`<h1>`) und der
Info-Zeile (`<p>` mit Datum/Seite/Implantat) einfügen.

**Vorher** (aktuell Zeile 39 bis 56):

```js
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
```

**Nachher** (zwei Änderungen: `patientLine` berechnen, und die neue
`<p>`-Zeile zwischen `<h1>` und der Info-Zeile einsetzen):

```js
  const versionStr = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "";
  const versionLine = versionStr
    ? _printEscHtml(t("printHeaderToolVersion").replace("{VERSION}", versionStr))
    : "";
  const patientLine = _printPatientLine();
  return `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: sans-serif; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
      <div style="flex: 1; min-width: 0;">
        <h1 style="font-size: 1.5em; margin: 0 0 4px 0;">CImbel — CI sound balancing — ${_printEscHtml(tabTitle)}</h1>
        ${patientLine ? `<p style="font-size: 1.05em; font-weight: 600; margin: 0 0 4px 0;">${_printEscHtml(patientLine)}</p>` : ""}
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
```

Wichtig: Die neue Zeile ist **nur sichtbar, wenn `patientLine` nicht
leer ist** (ternärer Ausdruck `${patientLine ? ... : ""}`). Bei leeren
Feldern bleibt der Kopf exakt wie bisher, ohne Leerzeile.

## Akzeptanztest (Klick für Klick)

1. App neu laden (Cache leeren, falls nötig), Versionsanzeige soll
   `0.4.272-beta` zeigen.
2. Reiter **Laden/Speichern** öffnen. In die Felder eintragen:
   - Nachname: `Müller`
   - Vorname: `Anna`
   - „Dateinamen ergänzen um eigenes Wort": `Hörtest`
3. Einen beliebigen Ausdruck auslösen (z.B. Frequenzkurve drucken).
   - **Erwartet:** Unter dem großen Titel steht eine eigene,
     hervorgehobene Zeile: `Müller, Anna — Hörtest`. Darunter wie
     gehabt die Datum/Seite/Implantat-Zeile.
4. Zurück zu Laden/Speichern, **Zusatzwort löschen** (Nachname/Vorname
   bleiben), erneut drucken.
   - **Erwartet:** Zeile zeigt nur `Müller, Anna` (kein Trennstrich,
     kein Zusatzwort).
5. **Nur Nachname** ausfüllen, Vorname und Zusatzwort leer, drucken.
   - **Erwartet:** Zeile zeigt nur `Müller` (kein Komma).
6. **Nur Zusatzwort** ausfüllen, Nachname und Vorname leer, drucken.
   - **Erwartet:** Zeile zeigt nur `Hörtest`.
7. **Alle drei Felder leer**, drucken.
   - **Erwartet:** Kopf wie vor dieser Änderung, **keine** zusätzliche
     (leere) Zeile zwischen Titel und Datum-Zeile.
8. Mehrere Druckpfade prüfen (Frequenzkurve, ein Mess-Ausdruck, das
   Archiv-PDF): Die Patientenzeile erscheint überall gleich, da der
   Kopf zentral aus `buildPrintHeader` kommt.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–8) einzeln
durchgehen und je melden: **erfüllt / nicht erfüllt / unklar**, mit
Datei- und Zeilenangabe der relevanten Stelle. Zusätzlich:

- Bestätigen, daß `js/version.js` auf `"0.4.272-beta"` steht.
- Bestätigen, daß **nur** `js/print.js` und `js/version.js` geändert
  wurden (keine i18n-Dateien, kein HTML).
- Den fertigen `js/print.js` einmal nach typografischen
  Anführungszeichen als String-Begrenzer durchsehen (U+201C/U+201D/
  U+2018/U+2019) — es dürfen keine im Code stehen.

## Hinweis

Die anderen Sprachen sind nicht angefaßt; hier ist auch keine
Übersetzung nötig, weil die neue Zeile reine Eingabedaten enthält.
