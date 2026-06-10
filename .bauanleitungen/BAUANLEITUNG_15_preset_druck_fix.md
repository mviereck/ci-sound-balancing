# Bauanleitung 15: Preset-Tabellen-Werte im Druck sichtbar machen

Folge-Aufgabe zu Bauanleitung 12. Die Kurvenfunktionen-Tabelle
(`#prTbl`, gebaut von `buildPrTbl` in `levels.js`) enthält für
„Stärke", „Center", „Breite", „Cutoff" `<input>`-Elemente. Der
`_printCloneSafe`-Helper aus Bauanleitung 11 entfernt Inputs vor
dem Klonen — damit erscheinen die Werte im Druck nicht.

Diese Bauanleitung erweitert `_printCloneSafe` so, daß Input-Werte
**vor** dem Entfernen als Text-Knoten in den Klon übernommen
werden.

Setzt Bauanleitung 09, 10, 11 voraus.

## Änderung

In `tab-print.js`, Funktion `_printCloneSafe` (aus Bauanleitung 11)
ersetzen durch folgende erweiterte Version:

```js
function _printCloneSafe(rootSelector) {
  const root = document.querySelector(rootSelector);
  if (!root) return "";
  const clone = root.cloneNode(true);

  // Inputs/Selects: aktuellen Wert als Text-Span einsetzen, dann
  // entfernen. So bleibt die gedruckte Tabelle vollständig.
  const origInputs = root.querySelectorAll("input, select");
  const cloneInputs = clone.querySelectorAll("input, select");
  for (let i = 0; i < origInputs.length && i < cloneInputs.length; i++) {
    const ci = cloneInputs[i];
    const oi = origInputs[i];
    let val = "";
    if (oi.type === "checkbox" || oi.type === "radio") {
      val = oi.checked ? "✓" : "—";
    } else if (oi.tagName === "SELECT") {
      const opt = oi.options[oi.selectedIndex];
      val = opt ? opt.textContent.trim() : "";
    } else {
      val = oi.value || "";
    }
    const span = document.createElement("span");
    span.textContent = val;
    span.style.fontFamily = "inherit";
    if (ci.parentNode) ci.parentNode.replaceChild(span, ci);
  }

  // Buttons und sonstige Bedienelemente weiterhin entfernen
  clone.querySelectorAll("button, .btn").forEach(el => el.remove());

  // Canvas durch <img> ersetzen (wie zuvor)
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
```

**Unterschied zur alten Version**:
- Inputs/Selects werden vorher in Text-Spans übersetzt (Wert
  ablesen, Span einfügen, Original entfernen)
- Checkboxen/Radios werden zu „✓" oder „—"
- Selects übernehmen den sichtbaren Optionstext, nicht den
  internen `value`
- Buttons (`.btn` und `<button>`) werden weiterhin komplett
  entfernt — die sollen im Druck nicht erscheinen

## Nicht zu tun

- Die Funktion `buildPrTbl` in `levels.js` nicht ändern.
- Andere Druck-Funktionen (`printImplantTab`, `printSchieberTab`)
  nicht anfassen — die nutzen `_printCloneSafe` nicht oder bauen
  ihre Tabellen selbst aus dem State.
- Keine HTML-Datei anfassen.

## Akzeptanztest

Vorbereitung: im Kurven-Tab zwei Kurvenfunktionen aktivieren
(Stärke ≠ 0, z.B. Tilt = +3, Gauß = +5 mit Center = 7, Breite =
4).

1. Tab **Kurven** öffnen, Druck-Knopf klicken.
   - Erwartet: in der gedruckten Kurvenfunktionen-Tabelle stehen
     pro aktivierter Funktion die tatsächlichen Werte (Stärke,
     Center, Breite, Cutoff je nach Funktionstyp) als Text — nicht
     mehr leere Eingabefelder.
   - Aktivierungs-Checkbox erscheint als „✓" oder „—".

2. Regression: Bauanleitung-10-Druck (Implantat) und
   Bauanleitung-11-Drucke (Ergebnisse-Sub-Tabs) unverändert
   nutzbar. Tabellen sehen wie zuvor aus (keine plötzlich
   sichtbar gewordenen Buttons).

3. Regression: bestehender Gesamtdruck (Laden/Speichern →
   Ergebnisse drucken) funktioniert weiterhin.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `_printCloneSafe` ersetzt Inputs/Selects durch Text-Spans **vor** dem Klon-Cleanup | | |
| Checkbox/Radio-Werte werden zu „✓"/„—" | | |
| Select-Optionen liefern den sichtbaren Text | | |
| Buttons werden weiterhin entfernt | | |
| Canvas-zu-Img-Logik bleibt unverändert | | |
| `buildPrTbl` und andere Module unverändert | | |
| Keine andere Datei angefaßt | | |
