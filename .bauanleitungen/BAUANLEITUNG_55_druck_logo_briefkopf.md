# Bauanleitung 55 — Logo im Briefkopf der Druck-Ausgaben

## Worum es geht

In den beiden Berichts-Ausdrucken („Archiv" und „Audiologen-Auftrag")
soll oben rechts ein Logo erscheinen: `assets/images/logo_briefkopf6.png`,
dezent, voll deckend, Höhe testweise 150 px. Der User hatte den Pfad
als `assets/favicon/...` angegeben, tatsächlich liegt die Datei aber
unter `assets/images/...`.

Die Druck-Pfade im Tool:

- **Audiologen-Druck** (`audiologPrint` in print-md.js) geht durch
  `openPrintWindow` → `buildPrintHeader` in print.js. Wenn das Logo
  in `buildPrintHeader` landet, wird es automatisch von allen
  Drucken benutzt, die diesen Header verwenden — also auch von den
  Tab-Einzeldrucken (Implantat, Meßergebnisse, Kurven, Schieber).
  Das ist gewünscht: konsistentes Briefkopf-Logo überall.
- **Archiv-Druck** (`renderArchivPrintHtml` in print-md.js) baut sein
  HTML komplett selbst und nutzt `buildPrintHeader` **nicht**. Hier
  muß das Logo separat eingefügt werden.

URL-Behandlung: Das Druck-Fenster ist `about:blank`, hat also keine
Base-URL. Ein relativer Pfad würde nicht aufgelöst. Lösung:
`new URL("assets/images/logo_briefkopf6.png", window.location.href).href`
ergibt eine absolute URL relativ zum App-Origin (funktioniert
gleichermaßen unter `http(s)://` und `file://`).

## Stelle 1 — `print.js`: `buildPrintHeader` mit Logo rechts

In `print.js` ab Z. 22 (`function buildPrintHeader(tabTitle)`). Den
gesamten Return-Block (aktuell Z. 38–47) ersetzen.

Vorher:

```js
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
```

Nachher:

```js
  const logoUrl = new URL("assets/images/logo_briefkopf6.png", window.location.href).href;
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
}
```

Hintergrund:

- Der Header ist jetzt ein Flexbox-Container: links Titel + Sub-Zeile
  (`flex: 1`), rechts das Logo (`flex-shrink: 0`, behält Originalbreite).
- `min-width: 0` auf dem linken Container sorgt dafür, daß die
  Sub-Zeile bei schmalen Druckbreiten umbrechen darf, statt das Logo
  zu verdrängen.
- Logo-Höhe 150 px fest, Breite automatisch nach Seitenverhältnis.
- `alt="CI Sound Balancing"` als Accessibility-/Druck-Alternativtext.
- Voll deckend — kein `opacity` gesetzt.

## Stelle 2 — `print-md.js`: `renderArchivPrintHtml` mit Logo

In `print-md.js` ab Z. 1601 (`function renderArchivPrintHtml(data)`).
Den Return-Block am Ende (aktuell Z. 1660) ersetzen.

Vorher:

```js
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("archivTitle")}</title><style>${styles}</style></head><body>${enrichedHtml}</body></html>`;
}
```

Nachher:

```js
  const logoUrl = new URL("assets/images/logo_briefkopf6.png", window.location.href).href;
  const logoHtml = `<img src="${logoUrl}" alt="CI Sound Balancing" class="archiv-logo" />`;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("archivTitle")}</title><style>${styles}</style></head><body>${logoHtml}${enrichedHtml}</body></html>`;
}
```

Damit das Logo rechts oben steht und der Markdown-Text drumherum
fließt, im `styles`-Block (aktuell Z. 1651–1659) einen Regel-Eintrag
für `.archiv-logo` ergänzen. Vorher:

```js
  const styles = `
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    h1 { margin-top: 0; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    h3 { margin-top: 14px; }
    table { font-size: 0.85em; }
    img.archiv-chart { display: block; max-width: 100%; margin: 6px 0 10px 0; }
    @media print { body { margin: 0; padding: 0; } }
  `;
```

Nachher:

```js
  const styles = `
    body { margin: 0; padding: 20px; font-family: sans-serif; }
    h1 { margin-top: 0; }
    h2 { border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
    h3 { margin-top: 14px; }
    table { font-size: 0.85em; }
    img.archiv-chart { display: block; max-width: 100%; margin: 6px 0 10px 0; }
    img.archiv-logo { float: right; height: 150px; width: auto; margin: 0 0 8px 12px; }
    @media print { body { margin: 0; padding: 0; } img.archiv-logo { height: 150px; } }
  `;
```

Hintergrund:

- `float: right` läßt das Logo rechts oben „schweben"; der nachfolgende
  H1-Titel und der weitere Markdown-Text fließen drumherum.
- `margin: 0 0 8px 12px` hält Abstand nach unten und links, damit der
  Text nicht direkt am Logo klebt.
- Die Print-Media-Wiederholung der Höhe ist defensive Backup — manche
  Browser ignorieren bestimmte Stile beim Druck, wenn sie ein
  globales `@media print { body { margin/padding: 0 } }` haben.

## Stelle 3 — `SPEC.md` / `spec/`

Im Kapitel **Drucken** (`spec/`-Datei für die Druck-Ausgaben) ergänzen:

> Beide Berichts-Ausdrucke (Archiv und Audiologen-Auftrag) zeigen
> rechts oben im Briefkopf das App-Logo
> `assets/images/logo_briefkopf6.png`, voll deckend, Höhe 150 px,
> Breite proportional. Das Logo erscheint auch in den Tab-Einzeldrucken
> (Implantat, Meßergebnisse, Kurven, Schieber), weil diese denselben
> `buildPrintHeader` aus `print.js` verwenden. Pfadauflösung über
> `new URL(..., window.location.href).href`, damit auch im
> `about:blank`-Druckfenster eine vollständige URL steht.

## Stelle 4 — `CODESTRUKTUR.md`

Im Abschnitt zur `print.js`-Modulbeschreibung (Z. 117) den Halbsatz
ergänzen:

> `buildPrintHeader` bindet zusätzlich das Logo
> `assets/images/logo_briefkopf6.png` rechts oben ein (Höhe 150 px,
> Flexbox-Layout mit Titel + Subtitle links, Logo rechts).

Im Abschnitt zur `print-md.js`-Modulbeschreibung (Z. 118) ergänzen,
daß `renderArchivPrintHtml` das Logo eigenständig per `float: right`
am Body-Anfang einbindet (kein `buildPrintHeader`-Pfad).

## Akzeptanztest-Checkliste (manuell im Browser)

### Vorbereitung

1. Werkzeug laden, möglichst über `http(s)://` (Live-Setup, Pages,
   `python -m http.server`). Reines `file://` testen wir separat.
2. Eine Side-Konfiguration mit ein paar Meßdaten vorbereiten, damit
   beide Berichte etwas zu zeigen haben.

### Test A — Audiologen-Druck

1. Tab Laden/Speichern → in der Audiologen-Box „Bericht drucken".
2. Im Druck-Vorschaufenster oben rechts: das Logo erscheint, Höhe
   ca. 150 px, voll deckend, scharf gerendert. Links daneben der
   Titel „CI Sound Balancing — Audiologen-Auftrag" plus Sub-Zeile
   mit Datum/Seite/Implantat.
3. PDF-Speicherung simulieren („Als PDF speichern" im Druck-Dialog):
   das Logo ist im PDF enthalten.

### Test B — Archiv-Druck

1. Archiv-Box → „Bericht drucken".
2. Im Druck-Vorschaufenster oben rechts: das Logo, rechts schwebend.
   Der Markdown-Text (H1 „Archiv-Bericht …" plus Abschnitte) fließt
   links davon und drunter.
3. PDF testen.

### Test C — Tab-Einzeldruck (Bonus)

1. Tab Implantat öffnen → Druck-Knopf klicken (sofern vorhanden).
2. Oben rechts im Druck-Header erscheint das Logo, wie in Test A.
3. Gleiches für Tab Meßergebnisse, Tab Kurven, Tab Schieber.

### Test D — `file://`-Modus

1. App lokal als `file://`-URL öffnen (z. B. `index.html` direkt
   anklicken).
2. Audiologen-Druck und Archiv-Druck wie A und B.
3. Erwartet: Logo lädt trotzdem, weil `new URL(...).href` eine
   absolute `file://`-URL auf den Dateipfad ergibt.

### Test E — Robustheit ohne Logo-Datei

1. Datei testweise umbenennen
   (`assets/images/logo_briefkopf6.png` → `..._briefkopf6_off.png`).
2. Druck ausführen.
3. Erwartet: An der Logo-Position erscheint nur der Alt-Text
   „CI Sound Balancing" (oder ein leerer Platzhalter) — der restliche
   Druck-Inhalt bleibt vollständig sichtbar, keine Exception.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–E einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Ist der Pfad in **beiden** Stellen identisch:
  `assets/images/logo_briefkopf6.png`? Tippfehler oder veraltete
  Pfade führen zu fehlendem Bild.
- Erzeugt `new URL(..., window.location.href).href` tatsächlich eine
  absolute URL? Stichprobe in der Konsole:
  `new URL("assets/images/logo_briefkopf6.png", window.location.href).href`
  sollte z. B. `http://localhost:8000/assets/images/logo_briefkopf6.png`
  oder `file:///home/.../assets/images/logo_briefkopf6.png` liefern.
- Bricht der Flexbox-Header in `buildPrintHeader` keinen bestehenden
  Druck (z. B. Implantat-Tab) — die Sub-Zeile (`<p>`) muß weiterhin
  vollständig sichtbar sein und die Tab-Title-`<h1>` rechts vom Logo
  endend.
- In `renderArchivPrintHtml`: führt das `float: right`-Logo zu
  unerwünschtem Text-Wrap, der den ersten H1/H2 unsauber aussehen
  läßt? Bei sehr kurzem Titel könnte er rechts vom Logo statt darüber
  enden. Stichprobe im Browser. Falls problematisch: alternativer
  Layout-Trick (z. B. den Logo-`<img>` in einen `<div
  style="float: right">` einwickeln, oder Flexbox-Container vor dem
  ersten H1) — bei Bedarf Rückfrage.

Bei Unklarheit Rückfrage statt Annahme.
