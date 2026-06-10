# BAUANLEITUNG 176 — Druck-Header konsolidieren (Tool-Version + URL)

**Ziel:** Im Audiologen-Ausdruck erscheinen Titel und Datum doppelt
(einmal im gemeinsamen Druck-Header, einmal direkt darunter im
Markdown-Block). Das wird bereinigt. Gleichzeitig wandert die
Tool-Versions-Zeile mit URL aus dem Audiologen-spezifischen
Markdown-Block in den gemeinsamen Header, damit sie in **allen**
Tab-Drucken erscheint.

**Versionsbump:** `js/version.js` → `"3.1.176-beta"`.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.175-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.176-beta";
```

---

## Schritt 1 — `buildPrintHeader` um Versions-Zeile erweitern

Datei `js/print.js`, Funktion `buildPrintHeader` (Zeilen 22–52).

Aktueller Header-HTML-Block (Zeilen 39–51):

```js
  return `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: sans-serif; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
      <div style="flex: 1; min-width: 0;">
        <h1 style="font-size: 1.5em; margin: 0 0 4px 0;">CI Sound Balancing — ${_printEscHtml(tabTitle)}</h1>
        <p style="font-size: 0.85em; color: #666; margin: 0;">
          ${_printEscHtml(t("printHeaderDate"))}: ${dateStr}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderSide"))}: ${_printEscHtml(sideStr)}${_printEscHtml(cfgSuffix)}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderImpl"))}: ${_printEscHtml(implStr)}
        </p>
      </div>
      <img src="${logoUrl}" alt="CI Sound Balancing" style="height:150px;width:auto;flex-shrink:0;" />
    </div>
  `;
```

Ersetzen durch (zusätzliche Versions-Zeile als zweiter Absatz):

```js
  const versionStr = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "";
  const versionLine = versionStr
    ? _printEscHtml(t("printHeaderToolVersion").replace("{VERSION}", versionStr))
    : "";
  return `
    <div style="margin-bottom: 16px; border-bottom: 1px solid #ccc; padding-bottom: 8px; font-family: sans-serif; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;">
      <div style="flex: 1; min-width: 0;">
        <h1 style="font-size: 1.5em; margin: 0 0 4px 0;">CI Sound Balancing — ${_printEscHtml(tabTitle)}</h1>
        <p style="font-size: 0.85em; color: #666; margin: 0;">
          ${_printEscHtml(t("printHeaderDate"))}: ${dateStr}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderSide"))}: ${_printEscHtml(sideStr)}${_printEscHtml(cfgSuffix)}
          &nbsp;·&nbsp; ${_printEscHtml(t("printHeaderImpl"))}: ${_printEscHtml(implStr)}
        </p>
        ${versionLine ? `<p style="font-size: 0.78em; color: #888; margin: 4px 0 0 0; font-style: italic;">${versionLine}</p>` : ""}
      </div>
      <img src="${logoUrl}" alt="CI Sound Balancing" style="height:150px;width:auto;flex-shrink:0;" />
    </div>
  `;
```

---

## Schritt 2 — Neuer i18n-Key für die Versions-Zeile

Datei `i18n/de.js`. In dem Block, in dem die anderen
`printHeader*`-Keys stehen (in der Nähe von `printHeaderDate`,
`printHeaderSide`, `printHeaderImpl`), eine zusätzliche Zeile
einfügen:

```js
    printHeaderToolVersion: "Meßwerte ermittelt mit CI Sound Balancing Tool {VERSION} (www.ci-sound-balancing.org)",
```

Wortlaut ist identisch mit dem bisherigen `audiologToolVersionLine` —
nur unter neuem, allgemeinem Key, weil er jetzt für alle Tab-Drucke
gilt, nicht nur den Audiologen-Druck.

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **nicht** anfassen — Fallback
auf Deutsch greift, bis die Übersetzungs-BA nachgezogen wird.

---

## Schritt 3 — Doppel-Kopf aus `buildAudiologMarkdown` entfernen

Datei `js/print-md.js`, Funktion `buildAudiologMarkdown`
(beginnt ca. Zeile 1103).

Aktueller Kopf-Block (Zeilen 1114–1121):

```js
  // ---- Kopf ----
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}`);
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`_${t("audiologToolVersionLine").replace("{VERSION}", APP_VERSION)}_`);
  }
  parts.push("");
```

Ersetzen durch nur die Trenn-Leerzeile (der ganze Kopf ist jetzt
Aufgabe von `buildPrintHeader`):

```js
  // ---- Kopf wird komplett vom gemeinsamen buildPrintHeader gestellt ----
  parts.push("");
```

Die lokalen Variablen `now`, `dateStr`, `mainSides`, `sideLabel`
am Anfang der Funktion (Zeilen 1104–1112) bleiben **vorerst** stehen.
`mainSides` und `sideLabel` werden weiter unten möglicherweise
noch verwendet. Nur, wenn `dateStr` und `now` nach diesem Schritt
nirgendwo mehr in der Funktion vorkommen, dürfen sie auch raus.

**Sonnet-Auftrag:** Nach dem Edit explizit per Grep prüfen, ob
`dateStr` oder `now` noch innerhalb von `buildAudiologMarkdown`
gelesen werden. Wenn nicht: ersatzlos entfernen. Wenn doch:
stehen lassen.

---

## Schritt 4 — Toter i18n-Key `audiologToolVersionLine`

In Schritt 3 wurde die einzige Verwendung von
`audiologToolVersionLine` entfernt. Den Key aus `i18n/de.js`
entfernen.

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **nicht** ändern — die
Übersetzungs-BA räumt das später auf.

**Sonnet-Auftrag:** Vor dem Entfernen per Grep absichern, daß der
Key tatsächlich nirgendwo mehr im Code referenziert wird.
Befund mitteilen.

---

## Schritt 5 — Veraltete i18n-Keys prüfen

Nach den Änderungen sind folgende Keys möglicherweise tot
(prüfen per Grep im Whitelist-Suchpfad `js/**/*.js` außer
`js/data/`, plus `index.html`, `style.css`):

- `audiologHeaderSide` — wurde in Schritt 3 entfernt; in Schritt 4
  bereits behandelt.

**Sonnet-Auftrag:** Jeden Key explizit per Grep prüfen. Bei keinem
Treffer im Whitelist-Suchpfad: aus `i18n/de.js` entfernen, andere
Sprachen unverändert. Wenn doch noch Treffer: Key behalten und
Treffer-Liste in den Bericht aufnehmen.

---

## Schritt 6 — Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen, melden:
**erfüllt / nicht erfüllt / unklar**, mit konkretem Bezug.

1. `js/version.js` zeigt `"3.1.176-beta"`.
2. `buildPrintHeader` (`js/print.js`) liefert nun einen zweiten
   `<p>`-Absatz mit der Versions-Zeile, der nur erscheint, wenn
   `APP_VERSION` definiert ist.
3. Der HTML-Aufbau in `buildPrintHeader` bleibt syntaktisch korrekt
   (Template-Literal-Backticks sauber geschlossen, keine doppelten
   `<div>`-Verschachtelung).
4. `i18n/de.js` enthält den neuen Key `printHeaderToolVersion`
   mit Wortlaut wie in Schritt 2 vorgegeben.
5. `i18n/de.js` enthält den Key `audiologToolVersionLine` **nicht**
   mehr; weder im Code (`js/print-md.js`) noch sonstwo wird er
   referenziert.
6. `buildAudiologMarkdown` in `js/print-md.js` pusht **nicht** mehr
   H1-Titel, Datums-Zeile, Seiten-Zeile oder Versions-Zeile in `parts`.
   Der `_audiologUserNoteBlock`-Aufruf und alle nachfolgenden
   Sektionen sind unverändert.
7. Etwaige tote lokale Variablen (`dateStr`, `now`) in
   `buildAudiologMarkdown` sind entfernt, falls sie nicht mehr
   gelesen werden — andernfalls Befund melden.
8. Klammer-Balance jeder geänderten Datei geprüft (Browser lädt
   ohne `SyntaxError`).
9. Browser-Test: Tool öffnet ohne Konsolen-Fehler.

Bei einem Punkt unklar: **stoppen, melden, Rückfrage**.

---

## Schritt 7 — Akzeptanz-Checkliste für den Nutzer

1. **Frischer Browser-Tab.** Tool lädt ohne Konsolen-Fehler.
   Versions-Label rechts oben zeigt `v3.1.176-beta`.
2. **Datei → Drucken Audiologen-Bericht** (Knopf neben
   Audiologen-Notiz). Im neuen Fenster erscheint **einmal**:
   - H1 „CI Sound Balancing — Einstellungswünsche an den Audiologen"
   - Datum / Seite / Implantat-Zeile
   - Eine kursive Zeile darunter „Meßwerte ermittelt mit CI Sound
     Balancing Tool v3.1.176-beta (www.ci-sound-balancing.org)"
   - Logo rechts
3. **Kein doppelter Titel, kein doppeltes Datum, keine doppelte
   Seitenangabe** unterhalb des Headers im Body. Audiologen-Notiz,
   Hinweise, MAPLAW, Tabellen folgen wie gewohnt.
4. **Andere Tab-Drucke prüfen** (z.B. Reiter Implantat → Drucken,
   Reiter Meßergebnisse → Drucken, Reiter Kurven → Drucken). Auch
   dort erscheint die neue Versions-Zeile direkt unter der
   Datum/Seite/Implantat-Zeile.
5. **Sprachwechsel auf EN/FR/ES**, Druck-Header erneut prüfen.
   Versions-Zeile fällt auf den deutschen Text zurück (erwartet,
   bis die Übersetzungs-BA nachzieht).

---

## Schritt 8 — Folge-BA

Die englische, französische und spanische Übersetzung von
`printHeaderToolVersion` wird in der Übersetzungs-Sammel-BA
nachgezogen (kein Pflicht-Anschluß).

---

## Schlußbemerkung

Diese BA ist rein konsolidierend. Verhalten der einzelnen
Tab-Drucke bleibt sonst unverändert. Wenn beim Edit unklar wird,
ob eine zusätzliche Stelle (z.B. `print-md.js:1465 audiologPrint`,
`openPrintWindow`-Aufrufe in Tab-Print-Handlern) noch angefaßt
werden muß: **stoppen, nachfragen**, nicht raten.
