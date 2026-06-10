# Bauanleitung 12: Druck-Knopf im Kurven-Tab

Setzt Bauanleitung 09, 10, 11 voraus. Fügt einen Druck-Knopf in
den Kurven-Tab ein, der den 4-Linien-Chart und die
Kurvenfunktionen-Tabelle für die aktive Seite druckt.

## Übersicht

1. Druck-Knopf in `index.html` (Kurven-Chart-Card) einfügen
2. Druck-Funktion `printKurvenTab()` in `tab-print.js` ergänzen
3. Click-Listener in `init.js`
4. `applyLang`-Eintrag für `title`

## 1. Druck-Knopf in `index.html`

Im Kurven-Panel (`<div id="panel-levels" class="panel">`, Z. 749)
sitzt eine Chart-Card mit `<h2 data-t="lvChartTitle">` (Z. 755).
Wie in Bauanleitung 10: den H2-Bereich in einen Flex-Wrapper
packen mit Druck-Knopf rechts.

**Vor**:
```html
<div class="card">
  <h2 data-t="lvChartTitle"></h2>
```

**Nach**:
```html
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <h2 data-t="lvChartTitle" style="margin:0;"></h2>
    <button class="btn" id="printKurvenBtn"
            style="padding:4px 10px;font-size:0.9em;">
      🖨 <span data-t="printBtn"></span>
    </button>
  </div>
```

## 2. `tab-print.js` ergänzen

Folgende Funktion ans Ende anfügen:

```js
// --- Kurven-Tab ---
function printKurvenTab() {
  // Chart-Card und Kurvenfunktionen-Card hintereinander drucken
  const chartCard  = _printCloneSafe('#panel-levels .card:nth-of-type(2)');
  const presetCard = _printCloneSafe('#panel-levels .card:nth-of-type(3)');
  // Falls die Intro-Card (1) entfällt: nth-of-type-Zählung
  // anpassen. Aktuell sind drei Cards: Intro (1), Chart (2),
  // Kurvenfunktionen (3).
  const body = chartCard + '<div style="margin-top:16px;"></div>' + presetCard;
  openPrintWindow(t("tabLevels") || "Kurven", body);
}
```

**Hinweis**: `_printCloneSafe` aus Bauanleitung 11 wird hier
wiederverwendet. Es entfernt Buttons/Inputs/Selects und ersetzt
Canvas durch PNG-Daten-URL-Bilder.

Tabellenelemente in `#prTbl` enthalten teilweise Checkboxen und
Inputs (Stärke-Felder, Center-Auswahl). Diese werden durch
`_printCloneSafe` entfernt — die gedruckte Tabelle zeigt nur die
**Texte** (Kurvenfunktions-Name, ggf. Stärke-Wert wenn als Text
gerendert, sonst leer). Wenn das Druckergebnis zu wenig Inhalt
hat, ist das ein Hinweis daß `buildPrTbl` (in `levels.js`) eine
Druck-Variante braucht. Diese Erweiterung gehört nicht in diese
Bauanleitung — als Folge-Auftrag offen lassen.

## 3. Click-Listener in `init.js`

```js
  const printKurvenBtn = document.getElementById("printKurvenBtn");
  if (printKurvenBtn) {
    printKurvenBtn.title = t("printBtn");
    printKurvenBtn.addEventListener("click", printKurvenTab);
  }
```

## 4. `applyLang`-Update

```js
  const _pkb = document.getElementById("printKurvenBtn");
  if (_pkb) _pkb.title = t("printBtn");
```

## Akzeptanztest

Vorbereitung: im Kurven-Tab eine oder zwei Kurvenfunktionen
aktivieren (Stärke ≠ 0), damit im Chart eine sichtbare Preset-/
Summen-Linie erscheint.

1. Tab **Kurven** öffnen. Erwartet: rechts neben dem Chart-Titel
   ein „🖨 Drucken"-Knopf.

2. Knopf klicken. Erwartet:
   - Mini-Kopf „CI Sound Balancing — Kurven" mit Datum, aktive
     Seite, Implantat-Info.
   - 4-Linien-Chart als Bild.
   - Darunter: Kurvenfunktionen-Tabelle (mindestens die Spalten-
     Namen und Funktions-Namen sichtbar; Stärke-Werte
     möglicherweise leer, weil die Tabelle Inputs verwendet —
     siehe Hinweis oben).

3. Seitenwechsel und nochmal drucken: Mini-Kopf passt sich an,
   Chart zeigt die andere Seite.

4. Regression: bestehender Gesamtdruck und die Druck-Knöpfe aus
   Bauanleitung 10 und 11 funktionieren wie zuvor.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `#printKurvenBtn` in der Chart-Card rechts neben dem H2 | | |
| `printKurvenTab` in `tab-print.js` ergänzt | | |
| Click-Listener in `init.js` | | |
| `applyLang`-Zeile für den Knopf-Title | | |
| Funktionen aus 10 und 11 unverändert | | |
| Keine andere Datei angefaßt | | |
