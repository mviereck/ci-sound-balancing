# Bauanleitung 16: Helper `drawDisabledBar` extrahieren

Kleine Refaktorierung. Der Code-Block, der eine deaktivierte
Elektrode als hellgrauen Balken mit dunkler X-Diagonale zeichnet,
steht heute zweimal identisch:

- `chart.js`, Z. 83–94, in `drawChart`
- `lr-balance.js`, Z. 616–626, in `lrDrawChart`

Drift-Risiko: wenn die Farben oder Strichstärken später angepaßt
werden, fällt eine Stelle leicht durch. Diese Bauanleitung extra-
hiert die zehn Zeilen in einen gemeinsamen Helper `drawDisabledBar`
in `chart.js` (chart.js wird ohnehin vor lr-balance.js geladen).

**Hinweis**: `drawFreqMatchChart` macht eine andere Visualisierung
für deaktivierte Elektroden (Vertikallinie statt Balken, weil
log-Hz-Achse) — dort **nicht** den Helper einsetzen.

## Änderung 1: Helper in `chart.js` definieren

Am Anfang von `chart.js`, **vor** `function drawChart(...)`,
folgenden Helper einfügen:

```js
// Zeichnet eine deaktivierte/gemute Elektrode als hellgrauen
// Vollbalken mit dunkler X-Diagonale. Wird von chart.js
// (drawChart) und lr-balance.js (lrDrawChart) genutzt. NICHT für
// drawFreqMatchChart geeignet (dort log-Hz-Achse).
function drawDisabledBar(ctx, x, yTop, yBot, bW) {
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(x, yTop, bW, yBot - yTop);
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x + bW, yBot);
  ctx.moveTo(x + bW, yTop);
  ctx.lineTo(x, yBot);
  ctx.stroke();
}
```

## Änderung 2: Aufruf in `chart.js` (innerhalb `drawChart`)

In `chart.js`, in `drawChart`, den Block ab `if (isDisabled) {`
(ca. Z. 83) bis zum `}` vor `else {` (ca. Z. 94) ersetzen.

**Vor** (Z. 83–94):
```js
    if (isDisabled) {
      const yTop = pad.top, yBot = pad.top + pH;
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, yTop, bW, yBot - yTop);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + bW, yBot);
      ctx.moveTo(x + bW, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    } else {
```

**Nach**:
```js
    if (isDisabled) {
      drawDisabledBar(ctx, x, pad.top, pad.top + pH, bW);
    } else {
```

## Änderung 3: Aufruf in `lr-balance.js` (innerhalb `lrDrawChart`)

In `lr-balance.js`, in `lrDrawChart`, den Block ab
`if (status[i] === 'disabled') {` (ca. Z. 616) bis zum `}` vor
`else if (status[i] === 'unmeasured')` (ca. Z. 627) ersetzen.

**Vor**:
```js
    if (status[i] === 'disabled') {
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(x, yTop, bW, yBot - yTop);
      ctx.strokeStyle = '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x + bW, yBot);
      ctx.moveTo(x + bW, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    } else if (status[i] === 'unmeasured') {
```

**Nach**:
```js
    if (status[i] === 'disabled') {
      drawDisabledBar(ctx, x, yTop, yBot, bW);
    } else if (status[i] === 'unmeasured') {
```

## Änderung 4: CODESTRUKTUR.md aktualisieren

In der Modul-Tabelle, in der `chart.js`-Zeile, die Funktionsliste
um `drawDisabledBar` ergänzen. Außerdem im Datenfluss-Abschnitt
am Ende der Anzeige-Konventions-Erläuterung folgenden Satz
anhängen:

> Der Deaktiviert-Balken (hellgrauer Vollbalken + X-Diagonale)
> wird über den gemeinsamen Helper `drawDisabledBar` aus
> `chart.js` gezeichnet und ist damit konsistent zwischen
> `drawChart` und `lrDrawChart`. `drawFreqMatchChart` nutzt einen
> eigenen Stil (Vertikallinie statt Balken) wegen der log-Hz-Achse.

## Nicht zu tun

- `drawFreqMatchChart` in `results.js`/`chart.js` nicht
  anfassen.
- Die „ungemessen"-Visualisierungen (gestrichelte Linien, Kreise)
  nicht in einen Helper extrahieren — die divergieren bewußt
  zwischen den Diagrammen.
- Keine Farben oder Strichstärken ändern.

## Akzeptanztest

Vorbereitung: bei zwei Elektroden den Status auf „deaktiviert"
oder „stumm" setzen, Test 1 (Elektrodenlautstärke) durchlaufen
lassen, dann Test 2 (Stereo-Balance).

1. Tab **Meßergebnisse** → Sub-Tab **Elektrodenlautstärke**.
   - Erwartet: die zwei deaktivierten Elektroden erscheinen als
     hellgraue Balken mit dunkler X-Diagonale — **visuell
     identisch zu vorher**.

2. Sub-Tab **Stereo-Balance**.
   - Erwartet: gleiches Bild — hellgrauer Balken + X-Diagonale.

3. Sub-Tab **Frequenzabgleich**.
   - Erwartet: **anderes** Bild — Vertikallinie mit „×"-Symbol
     (nicht angefaßt, soll auch nicht).

4. Schieber-Tab und Kurven-Tab visuell prüfen — die nutzen den
   Helper nicht, sollten aber unverändert aussehen.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `drawDisabledBar` in `chart.js` vor `drawChart` definiert | | |
| `drawChart` ruft den Helper auf | | |
| `lrDrawChart` ruft den Helper auf | | |
| `drawFreqMatchChart` unverändert | | |
| Pixel-genaue Übereinstimmung mit vorherigem Visual (Farben `#e5e7eb` / `#6b7280`, Strichstärke 1.5) | | |
| CODESTRUKTUR.md aktualisiert | | |
| Keine andere Datei angefaßt | | |
