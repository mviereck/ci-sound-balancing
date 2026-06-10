# Bauanleitung 11: Druck-Knopf für Meßergebnisse-Sub-Tabs

Setzt Bauanleitung 09 und 10 voraus. Fügt **einen** Druck-Knopf in
die Sub-Tab-Leiste des Meßergebnisse-Tabs ein, der den jeweils
aktiven Sub-Tab druckt (Elektrodenlautstärke-Balance, Stereo-
Balance, oder Frequenzabgleich) — jeweils Diagramm + Tabelle für
die aktive Seite.

## Übersicht

1. Druck-Knopf in `index.html` (Sub-Tab-Leiste) einfügen
2. Drei Druck-Funktionen in `tab-print.js` ergänzen plus
   Dispatcher `printErgebnisseTab()`
3. Click-Listener in `init.js`
4. `applyLang`-Eintrag für `title` und Sichtbarkeit

## 1. Druck-Knopf in `index.html`

In der Sub-Tab-Leiste des Meßergebnisse-Panels (Z. 455–459) den
Knopf rechts anhängen. Das `subtabs`-Div umschließt die drei
`<button class="subtab">` — direkt vor dem schließenden `</div>`
folgendes einfügen:

```html
          <button class="btn" id="printErgebnisseBtn"
                  style="margin-left:auto;padding:4px 10px;font-size:0.9em;">
            🖨 <span data-t="printBtn"></span>
          </button>
```

Falls das umschließende `subtabs`-Div nicht `display:flex` hat,
zusätzlich am `<div class="subtabs">` öffnenden Tag
`style="display:flex;align-items:center;"` ergänzen — Sonnet bitte
vorher mit Browser/DevTools prüfen, ob die Subtab-Leiste schon Flex
ist (das ist je nach CSS-Stand wahrscheinlich der Fall, dann nicht
notwendig).

## 2. `tab-print.js` ergänzen

Folgende Funktionen am Ende von `tab-print.js` einfügen
(nach `printImplantTab` aus Bauanleitung 10):

```js
// --- Meßergebnisse-Sub-Tab Dispatcher ---
function printErgebnisseTab() {
  // Aktiver Sub-Tab ermitteln
  const sub = document.querySelector(
    '#panel-ergebnisse .subpanel.active',
  );
  if (!sub) return;
  const id = sub.id; // "subpanel-ergebnisse-results" | "...-lrresults" | "...-freqmatch"
  if (id === "subpanel-ergebnisse-results")  return _printResLoudness();
  if (id === "subpanel-ergebnisse-lrresults") return _printResLR();
  if (id === "subpanel-ergebnisse-freqmatch") return _printResFreqmatch();
}

// Klont einen Container, entfernt vor dem Klonen alle interaktiven
// Elemente (Buttons, Inputs, Selects), damit der Druck sauber bleibt.
function _printCloneSafe(rootSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) return "";
  const clone = root.cloneNode(true);
  clone.querySelectorAll("button, input, select, .btn").forEach(el => el.remove());
  // Canvas durch <img> ersetzen, damit das Bild im neuen Fenster sichtbar ist
  // (Canvas-Inhalt überlebt den Kontext-Wechsel nicht)
  const origCanvases = root.querySelectorAll("canvas");
  const cloneCanvases = clone.querySelectorAll("canvas");
  for (let i = 0; i < origCanvases.length && i < cloneCanvases.length; i++) {
    const imgHtml = canvasToImg(origCanvases[i], 800);
    const tmp = document.createElement("div");
    tmp.innerHTML = imgHtml;
    const img = tmp.firstElementChild;
    if (img && cloneCanvases[i].parentNode) {
      cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
    }
  }
  return clone.innerHTML;
}

function _printResLoudness() {
  const body = _printCloneSafe('#subpanel-ergebnisse-results .card');
  openPrintWindow(t("subTabLoudness") || "Elektrodenlautstärke-Balance", body);
}

function _printResLR() {
  const body = _printCloneSafe('#subpanel-ergebnisse-lrresults .card');
  openPrintWindow(t("tabBalance") || "Stereo-Balance", body);
}

function _printResFreqmatch() {
  // Frequenzabgleich hat zwei Cards (NoData-Card + fmrCard) — nur die
  // sichtbare drucken.
  const noData = document.querySelector('#fmrNoData');
  const card   = document.querySelector('#fmrCard');
  const target = (card && card.style.display !== 'none')
    ? '#fmrCard'
    : '#fmrNoData';
  const body = _printCloneSafe(target);
  openPrintWindow(t("subTabFreqMatch") || "Frequenzabgleich", body);
}
```

**Hinweis zum Klon-Ansatz**: Wir kopieren das DOM des aktiven
Sub-Panels, entfernen Buttons/Selects/Inputs (die im Druck
unsinnig sind) und ersetzen Canvas durch PNG-Daten-URL-Bilder
(`canvasToImg`). Das ist robust, weil das DOM bereits die
aktualisierten Werte zeigt — wir müssen nicht parallel aus dem
State neu rendern.

## 3. Click-Listener in `init.js`

In der Nähe des Listeners aus Bauanleitung 10 ergänzen:

```js
  const printErgebnisseBtn = document.getElementById("printErgebnisseBtn");
  if (printErgebnisseBtn) {
    printErgebnisseBtn.title = t("printBtn");
    printErgebnisseBtn.addEventListener("click", printErgebnisseTab);
  }
```

## 4. `applyLang`-Update

In `i18n.js`, in `applyLang`, die Zeile aus Bauanleitung 10 um
diesen Knopf erweitern (im selben Block):

```js
  const _peb = document.getElementById("printErgebnisseBtn");
  if (_peb) _peb.title = t("printBtn");
```

## Nicht zu tun

- Keine neuen i18n-Keys einführen — die existierenden Sub-Tab-
  Titel (`subTabLoudness`, `tabBalance`, `subTabFreqMatch`)
  werden benutzt. Falls einer der Keys nicht existiert, fallen die
  Funktionen auf den deutschen Literal-String zurück (siehe `||`
  im Code).
- Keine bestehenden Render-Funktionen ändern (`renderResults`,
  `lrDrawChart`, `drawFreqMatchChart`, `drawChart`).
- Keine andere Datei als index.html, tab-print.js, init.js, i18n.js
  anfassen.

## Akzeptanztest

Vorbereitung: in Tab Messungen den Test 1
(Elektrodenlautstärke-Balance) und Test 2 (Stereo-Balance) mit
ein paar Paaren laufen lassen, damit Ergebnisse vorhanden sind.

1. Tab **Meßergebnisse** öffnen. Erwartet: in der Sub-Tab-Leiste
   ganz rechts steht ein „🖨 Drucken"-Knopf.

2. Sub-Tab **Elektrodenlautstärke-Balance** aktiv lassen. Knopf
   klicken.
   - Erwartet: neues Druckfenster mit Mini-Kopf „CI Sound
     Balancing — Elektrodenlautstärke-Balance" (oder die i18n-
     Variante), Datum, aktive Seite.
   - Darunter: das Balkendiagramm als Bild, der zugehörige
     Erklärtext und ggf. die Reliability-/Meta-Texte.
   - **Keine** Buttons („Löschen", „Refresh", …) im Druck
     sichtbar.

3. Sub-Tab auf **Stereo-Balance** umschalten, Knopf klicken.
   - Erwartet: Druck mit dem Stereo-Balance-Diagramm und der
     Werte-Tabelle.

4. Sub-Tab auf **Frequenzabgleich** umschalten, Knopf klicken.
   - Wenn Daten vorhanden: Diagramm + Tabelle gedruckt.
   - Wenn keine Daten: die „keine Daten"-Card mit Hinweistext
     gedruckt (akzeptables Ergebnis, kein Bug).

5. Seitenwechsel: Side auf RECHTS, Sub-Tab Elektrodenlautstärke,
   Knopf klicken. Erwartet: Mini-Kopf zeigt RECHTS und die
   rechten Werte werden gedruckt.

6. Regression: bestehender „Ergebnisse drucken"-Button in
   Laden/Speichern funktioniert wie zuvor.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `#printErgebnisseBtn` in der Sub-Tab-Leiste sichtbar (CSS `margin-left:auto`) | | |
| `printErgebnisseTab` Dispatcher in `tab-print.js` | | |
| Drei Helper `_printResLoudness`, `_printResLR`, `_printResFreqmatch` in `tab-print.js` | | |
| `_printCloneSafe` ersetzt Canvas durch `<img>` mit PNG-Daten-URL | | |
| Buttons/Inputs/Selects werden vor dem Klonen entfernt | | |
| Click-Listener in `init.js` | | |
| `applyLang`-Zeile für den Knopf-Title | | |
| `printImplantTab` (Bauanleitung 10) unverändert | | |
| Keine andere Datei angefaßt | | |
