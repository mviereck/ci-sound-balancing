# Bauanleitung 17: Bug-Fix — Stereo-Balance-Mittelwert-Anzeige

Symptom: Im Sub-Tab „Stereo-Balance" unter Meßergebnisse zeigt
die Anzeige „Empfohlener Balance-Offset (Mittelwert)" hartkodiert
„0.0 dB", obwohl die Tabelle darunter Werte enthält. Tritt
typisch nach Browser-Reload, Side-Wechsel oder Sub-Tab-Klick auf.

Ursache: `lrApplyMeanToBalance()` aktualisiert die Anzeige, wird
aber nicht überall aufgerufen, wo `lrRenderResults()` läuft.
Insbesondere fehlt der Aufruf nach Browser-Reload / Side-Wechsel /
Sub-Tab-Klick. Die Anzeige bleibt dann auf dem HTML-Default
„0.0 dB" stehen.

## Änderung

In `lr-balance.js`, am **Ende** der Funktion `lrRenderResults`
(die Funktion beginnt bei ca. Z. 484), eine Zeile **vor** der
schließenden geschweiften Klammer der Funktion einfügen:

```js
  lrApplyMeanToBalance();
```

Sonnet: such die Funktion `function lrRenderResults() {` und
trage diese Zeile als allerletzte Anweisung **innerhalb** der
Funktion ein, direkt vor dem schließenden `}`. Achtung — die
Funktion ist länger und enthält selbst mehrere `}`-Klammern für
if-Blöcke und Schleifen. Das gesuchte `}` ist das, das auf
gleicher Einrückungstiefe wie `function lrRenderResults() {`
steht.

## Begründung der Einfüge-Stelle

`lrRenderResults` baut die Tabelle aus `lrResults`. Direkt im
Anschluß den Mittelwert neu zu berechnen und die Anzeige zu
aktualisieren ist konzeptionell richtig — beide Funktionen
gehören zur Stereo-Balance-Ergebnis-Anzeige und sollten konsistent
gehalten werden. Damit fängt eine einzige Zeile alle bisher
gefundenen Lücken auf (lrStop, Sub-Tab-Click, setSideConfig-
Handler, Side-Wechsel).

## Nicht zu tun

- Keine anderen Stellen anfassen.
- `lrApplyMeanToBalance` selbst nicht ändern.
- Keine andere Datei berühren.

## Akzeptanztest

Vorbereitung: in deinen Daten liegen Stereo-Balance-Ergebnisse
mit nicht-null Werten (z.B. überall negativ wie zuletzt
berichtet).

1. Browser-Reload. Tab „Meßergebnisse" → Sub-Tab „Stereo-Balance".
   - Erwartet: oben in der grünen/orangen Card wird der
     korrekte Mittelwert angezeigt (nicht mehr „0.0 dB").

2. Side wechseln (LINKS / RECHTS), Sub-Tab erneut öffnen.
   - Erwartet: Mittelwert paßt zur Tabelle.

3. Auf dem Schieber-Sub-Tab „Stereo-Balance" eine Messung
   bestätigen / undo-en — Mittelwert aktualisiert sich wie zuvor.

4. Bestehende Funktionalität: Verlassen + Wiederkehren in den
   Sub-Tab — Anzeige bleibt korrekt.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| Genau **eine** Zeile in `lr-balance.js` hinzugefügt | | |
| Zeile steht innerhalb `lrRenderResults`, direkt vor der schließenden Klammer der Funktion | | |
| Keine andere Datei angefaßt | | |
| `lrApplyMeanToBalance` selbst unverändert | | |
