# Bauanleitung 234 — Spenden-Verlauf-Graph

## Ziel

Im Unterstützung-Tab eine zweite Card unterhalb der Finanztabelle
einfügen, die den Spenden-Verlauf als Canvas-Diagramm anzeigt:

- X-Achse: Monate von `FINANZEN_BEGIN` bis „heute + 24 Monate".
- Y-Achse: Euro/Monat.
- Pro Monat ein **gestapelter Balken**:
  1. **Dauerspenden** (solides Grün)
  2. **aus Einmalspenden-Puffer gedeckt** (helles Grün)
  3. **Lücke** (Rot)
- Zwei horizontale Bezugslinien: `kostenCurrent` (gestrichelt grau)
  und `kostenFull` (gepunktet grau), jeweils kurz beschriftet.
- Vertikaler **„heute"-Marker** (blau, gestrichelt).
- Legende unter dem Diagramm.
- Hinweis: „Berechnung unterstellt unveränderte Kosten und
  gleichbleibende Dauerspenden in der Zukunft."

**Voraussetzung:** BA 232 muß abgenommen sein (`finBerechneZeitreihe`,
`finMonatHeute`, `finMonatNext`, `FINANZEN_BEGIN` müssen existieren).

## Scope

Neu: `js/unterstuetzung-graph.js`.
Geändert: `index.html`, `style.css`, `js/version.js`, alle vier
i18n-Dateien, `docs/CODESTRUKTUR.md` (neuer Modul-Eintrag „21a").

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.234-beta";
```

## Schritt 2 — Neue Datei `js/unterstuetzung-graph.js`

Komplett neu anlegen:

```js
// unterstuetzung-graph.js – Spenden-Verlauf-Graph für den
// Unterstützung-Tab. Pure Canvas-Zeichnung. Stacked Bars pro Monat
// (Dauerspenden + aus Puffer gedeckt + Lücke), horizontale Linien
// für aktuelle Kosten und Vollausbau, vertikaler "Heute"-Marker.

function _ugMonatPlus(m, n) {
  for (var i = 0; i < n; i++) m = finMonatNext(m);
  return m;
}

function _ugMonatLabel(m) {
  // "2026-05" → "05/26"
  var p = m.split("-");
  return p[1] + "/" + p[0].slice(2);
}

function _ugT(key, fallback) {
  if (typeof t === "function") {
    var s = t(key);
    if (s && s !== key) return s;
  }
  return fallback;
}

function _ugRenderGraph() {
  var canvas = document.getElementById("untGraphCanvas");
  if (!canvas) return;
  if (typeof finBerechneZeitreihe !== "function") return;
  if (typeof FINANZEN_BEGIN !== "string") return;

  var ctx = canvas.getContext("2d");
  var dpr = window.devicePixelRatio || 1;
  var cssW = canvas.clientWidth  || 720;
  var cssH = canvas.clientHeight || 280;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);

  var heute = finMonatHeute();
  var bis   = _ugMonatPlus(heute, 24);
  var reihe = finBerechneZeitreihe(FINANZEN_BEGIN, bis);
  if (!reihe.length) return;

  // Layout
  var padL = 50, padR = 18, padT = 16, padB = 38;
  var plotW = cssW - padL - padR;
  var plotH = cssH - padT - padB;

  // Y-Skala: max ≈ Vollausbau × 1.1, geordnet auf 10er/50er Schritte
  var kostenFull    = reihe[0].kostenFull;
  var kostenCurrent = reihe[0].kostenCurrent;
  var maxY = Math.max(kostenFull * 1.1, 1);
  var step = 20;
  while (maxY / step > 8) step += step < 50 ? 10 : 50;
  var maxYRounded = Math.ceil(maxY / step) * step;

  // Koordinaten
  var n = reihe.length;
  var gap = 2;
  var barW = Math.max(2, Math.floor((plotW - gap * (n + 1)) / n));
  function xMonat(i) { return padL + gap + i * (barW + gap); }
  function yEuro(v)  { return padT + plotH - (v / maxYRounded) * plotH; }

  // Y-Gitter + Labels
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth   = 1;
  ctx.fillStyle   = "#555";
  ctx.font        = "11px Segoe UI, sans-serif";
  ctx.textAlign   = "right";
  ctx.textBaseline = "middle";
  for (var v = 0; v <= maxYRounded; v += step) {
    var y = yEuro(v);
    ctx.beginPath();
    ctx.moveTo(padL,         y);
    ctx.lineTo(padL + plotW, y);
    ctx.stroke();
    ctx.fillText(v + " €", padL - 6, y);
  }

  // Stacked Bars
  for (var i = 0; i < n; i++) {
    var r = reihe[i];
    var x = xMonat(i);
    var yBase      = yEuro(0);
    var yDauerTop  = yEuro(r.dauer);
    var yPufferTop = yEuro(r.dauer + r.pufferEingesetzt);
    var yLueckeTop = yEuro(r.dauer + r.pufferEingesetzt + r.luecke);

    if (r.dauer > 0) {
      ctx.fillStyle = "#4a9d4a";
      ctx.fillRect(x, yDauerTop, barW, yBase - yDauerTop);
    }
    if (r.pufferEingesetzt > 0) {
      ctx.fillStyle = "#a8d5a8";
      ctx.fillRect(x, yPufferTop, barW, yDauerTop - yPufferTop);
    }
    if (r.luecke > 0) {
      ctx.fillStyle = "#d94a4a";
      ctx.fillRect(x, yLueckeTop, barW, yPufferTop - yLueckeTop);
    }
  }

  // Linie "aktuelle Kosten"
  ctx.strokeStyle = "#777";
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenCurrent));
  ctx.lineTo(padL + plotW, yEuro(kostenCurrent));
  ctx.stroke();
  ctx.fillStyle = "#555";
  ctx.font = "10.5px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(_ugT("supportGraphCostCurrent", "aktuelle Kosten"),
               padL + 4, yEuro(kostenCurrent) - 2);

  // Linie "Vollausbau"
  ctx.setLineDash([1.5, 3]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenFull));
  ctx.lineTo(padL + plotW, yEuro(kostenFull));
  ctx.stroke();
  ctx.fillText(_ugT("supportGraphCostFull", "Vollausbau"),
               padL + 4, yEuro(kostenFull) - 2);
  ctx.setLineDash([]);

  // "Heute"-Marker
  var heuteIdx = -1;
  for (var hi = 0; hi < n; hi++) {
    if (reihe[hi].monat === heute) { heuteIdx = hi; break; }
  }
  if (heuteIdx >= 0) {
    var xH = xMonat(heuteIdx) + barW / 2;
    ctx.strokeStyle = "#1e6cd6";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(xH, padT);
    ctx.lineTo(xH, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle    = "#1e6cd6";
    ctx.font         = "bold 10.5px Segoe UI, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(_ugT("supportGraphToday", "heute"), xH, padT - 1);
  }

  // X-Achsen-Labels: jeden N-ten Monat
  var labelEvery = n <= 12 ? 1 : (n <= 24 ? 3 : 6);
  ctx.fillStyle    = "#555";
  ctx.font         = "10.5px Segoe UI, sans-serif";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  for (var li = 0; li < n; li++) {
    if (li % labelEvery !== 0 && li !== n - 1) continue;
    var xL = xMonat(li) + barW / 2;
    ctx.fillText(_ugMonatLabel(reihe[li].monat), xL, padT + plotH + 4);
  }

  // Plot-Rahmen
  ctx.strokeStyle = "#999";
  ctx.lineWidth   = 1;
  ctx.strokeRect(padL, padT, plotW, plotH);
}

document.addEventListener("DOMContentLoaded", function () {
  _ugRenderGraph();
});

// Bei Sprachumschaltung Graph neu zeichnen (Linien-Beschriftungen).
document.addEventListener("languagechange-applied", function () {
  _ugRenderGraph();
});

// Bei Fenstergröße neu zeichnen (debounced).
var _ugResizeTimer = null;
window.addEventListener("resize", function () {
  if (_ugResizeTimer) clearTimeout(_ugResizeTimer);
  _ugResizeTimer = setTimeout(_ugRenderGraph, 150);
});
```

**Hinweis zum `languagechange-applied`-Event:** Falls die i18n-Schicht
ein solches Event nicht feuert (in `js/i18n.js` prüfen — wenn nicht
vorhanden, ist der Event-Listener wirkungslos, das ist OK), wird der
Graph nach Sprachumschaltung nicht automatisch neu gezeichnet. Das ist
ein bekannter, kleiner Schönheitsfehler (zwei Linien-Beschriftungen
bleiben in der alten Sprache, bis der Tab neu geladen wird). Nicht
nachbessern, nur erwähnen.

## Schritt 3 — Script-Tag in `index.html` ergänzen

In `index.html` Z. 147 die `scripts`-Liste erweitern. **Vorher:**

```js
        'js/finanzen.js', 'js/unterstuetzung.js', 'js/update-check.js',
```

**Nachher:**

```js
        'js/finanzen.js', 'js/unterstuetzung.js', 'js/unterstuetzung-graph.js', 'js/update-check.js',
```

## Schritt 4 — HTML-Card im Unterstützung-Panel einfügen

In `index.html` direkt vor dem schließenden `</div>` des
`#panel-unterstuetzung` (also nach `</div>` der `support-card-finance`
in Z. 1848, vor Z. 1850) folgenden Block einfügen:

```html
        <div class="card support-card-graph">
          <h2 data-t="supportGraphTitle"></h2>
          <div class="support-graph-wrap">
            <canvas id="untGraphCanvas" class="support-graph-canvas"></canvas>
          </div>
          <div class="support-graph-legend">
            <span class="lg-item"><span class="lg-swatch lg-dauer"></span><span data-t="supportGraphLegendDauer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-puffer"></span><span data-t="supportGraphLegendPuffer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-luecke"></span><span data-t="supportGraphLegendLuecke"></span></span>
          </div>
          <p class="support-graph-hinweis" data-t="supportGraphHinweis"></p>
        </div>
```

## Schritt 5 — CSS einfügen

In `style.css` direkt nach dem Block `.support-onetime-hint { ... }`
(eingeführt in BA 233, wenn BA 233 abgenommen) bzw. wenn BA 233 noch
nicht abgenommen ist, nach `.support-gap-row strong { ... }`:

```css
.support-graph-wrap {
  width: 100%;
  margin: 8px 0 10px;
}
.support-graph-canvas {
  display: block;
  width: 100%;
  height: 280px;
  background: #fff;
  border-radius: 4px;
}
.support-graph-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin: 6px 0 8px;
  font-size: 0.9em;
}
.support-graph-legend .lg-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.support-graph-legend .lg-swatch {
  display: inline-block;
  width: 14px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,0.15);
}
.support-graph-legend .lg-dauer  { background: #4a9d4a; }
.support-graph-legend .lg-puffer { background: #a8d5a8; }
.support-graph-legend .lg-luecke { background: #d94a4a; }
.support-graph-hinweis {
  font-size: 0.85em;
  opacity: 0.7;
  font-style: italic;
  margin: 4px 0 0;
}
```

## Schritt 6 — i18n-Strings in alle vier Sprachdateien

Position: in jeder Datei nach den Support-Strings, vor `supportSlogan`
(in `de.js` z. B. nach Z. 986 `supportGithubHint`, vor Z. 988
`supportSlogan`). Acht neue Keys pro Sprache.

**`i18n/de.js`:**

```js
    supportGraphTitle: "Spenden-Verlauf",
    supportGraphLegendDauer: "Dauerspenden",
    supportGraphLegendPuffer: "aus Einmalspenden gedeckt",
    supportGraphLegendLuecke: "Lücke",
    supportGraphCostCurrent: "aktuelle Kosten",
    supportGraphCostFull: "Vollausbau",
    supportGraphHinweis: "Berechnung unterstellt unveränderte Kosten und gleichbleibende Dauerspenden in der Zukunft.",
    supportGraphToday: "heute",
```

**`i18n/en.js`:**

```js
    supportGraphTitle: "Donation timeline",
    supportGraphLegendDauer: "Recurring donations",
    supportGraphLegendPuffer: "covered by one-time donations",
    supportGraphLegendLuecke: "Gap",
    supportGraphCostCurrent: "current costs",
    supportGraphCostFull: "full build",
    supportGraphHinweis: "The calculation assumes unchanged costs and constant recurring donations in the future.",
    supportGraphToday: "today",
```

**`i18n/fr.js`:**

```js
    supportGraphTitle: "Évolution des dons",
    supportGraphLegendDauer: "Dons récurrents",
    supportGraphLegendPuffer: "couvert par dons ponctuels",
    supportGraphLegendLuecke: "Manque",
    supportGraphCostCurrent: "coûts actuels",
    supportGraphCostFull: "déploiement complet",
    supportGraphHinweis: "Le calcul suppose des coûts inchangés et des dons récurrents constants à l'avenir.",
    supportGraphToday: "aujourd'hui",
```

(Die `\u00XX`-Notation sind UTF-8-Akzente; alternativ direkt
„Évolution", „récurrents" etc. einsetzen, je nachdem wie die anderen
fr-Einträge in der Datei geschrieben sind — vor dem Einfügen einmal
in `i18n/fr.js` nachsehen, ob dort Akzente direkt oder als Escapes
stehen, und der bestehenden Konvention folgen.)

**`i18n/es.js`:**

```js
    supportGraphTitle: "Evolución de las donaciones",
    supportGraphLegendDauer: "Donaciones recurrentes",
    supportGraphLegendPuffer: "cubierto por donaciones puntuales",
    supportGraphLegendLuecke: "Déficit",
    supportGraphCostCurrent: "costes actuales",
    supportGraphCostFull: "versión completa",
    supportGraphHinweis: "El cálculo asume costes invariables y donaciones recurrentes constantes en el futuro.",
    supportGraphToday: "hoy",
```

(Gleicher Hinweis zur Akzent-Notation wie bei `fr.js`.)

## Schritt 7 — `docs/CODESTRUKTUR.md` neuen Modul-Eintrag einfügen

Direkt nach Eintrag `| 21 | unterstuetzung.js | ... |` einen neuen
Eintrag einfügen, **ohne** die folgenden Nummern (22, 23) zu
verändern:

```
| 21a | unterstuetzung-graph.js | Spenden-Verlauf-Graph (Canvas) für den Unterstützung-Tab. Pure Canvas-Zeichnung über `_ugRenderGraph()`: stacked Bars pro Monat aus `finBerechneZeitreihe(FINANZEN_BEGIN, heute+24)` (Dauerspenden grün, Puffer-Verzehr hellgrün, Lücke rot), horizontale Linien für `kostenCurrent`/`kostenFull`, vertikaler "Heute"-Marker. Helper `_ugMonatPlus`, `_ugMonatLabel`, `_ugT`. Eigene DOMContentLoaded-Verdrahtung, debounced Resize-Handler, optionaler `languagechange-applied`-Handler. Muß nach `unterstuetzung.js` (und nach `finanzen.js`) geladen werden. |
```

Außerdem in der Tabelle ganz oben unter „Unterstützung-Tab" (Z. 27)
die Modul-Liste ergänzen, damit der Querverweis stimmt:

```
| Unterstützung | unterstuetzung | finanzen.js, unterstuetzung.js, unterstuetzung-graph.js |
```

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload**, Tab **Unterstützung** öffnen.
2. **Unterhalb der Finanztabelle** (bzw. unterhalb des
   Einmalspenden-Blocks aus BA 233) erscheint eine zweite Card mit
   der Überschrift „Spenden-Verlauf".
3. Das Diagramm zeigt:
   - Eine Reihe schmaler **gestapelter Balken** von Mai 2026 bis
     ca. Juni 2028 (heute + 24).
   - Die ersten paar Monate haben einen sichtbaren **hellgrünen
     Anteil** (Puffer-Verzehr aus den 150 € Einmalspenden) und keine
     rote Lücke.
   - Sobald der Puffer aufgebraucht ist, erscheint oben **roter
     Anteil** (Lücke = 14 € pro Monat bei unverändertem Setup).
   - Im April 2027 endet die 10-€-Befristung; ab Mai 2027 ist der
     grüne Dauer-Anteil sichtbar **niedriger** (Wechsel von 35 auf
     25 €), die rote Lücke entsprechend größer.
   - **Gestrichelte graue Linie** auf Höhe von 49 € (aktuelle Kosten).
   - **Gepunktete graue Linie** auf Höhe von ~118 € (Vollausbau).
   - **Vertikale blaue gestrichelte Linie** mit Beschriftung „heute"
     am aktuellen Monat.
4. Die **Legende** darunter zeigt drei farbige Quadrate mit den
   Bezeichnungen „Dauerspenden", „aus Einmalspenden gedeckt", „Lücke".
5. Darunter der **kursive Hinweis** zur Annahme.
6. **Sprachumschaltung:** EN/FR/ES — alle Texte (Card-Überschrift,
   Legende, Hinweis) übersetzt; Linien-Beschriftungen im Canvas
   werden ggf. erst nach Reload aktualisiert (s. Hinweis im
   Schritt 2).
7. **Fenstergröße ändern:** der Graph zeichnet sich nach kurzer
   Verzögerung passend neu, ohne verzerrt zu wirken (saubere
   Schrift, scharfe Linien dank DPR-Skalierung).
8. **Konsole nach Reload:** keine neuen Errors.

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden, mit Datei- und Zeilenangabe:

- [ ] `js/version.js` auf `"3.2.234-beta"`.
- [ ] `js/unterstuetzung-graph.js` neu angelegt, vollständig
  übernommen.
- [ ] `index.html` Z. 147: Script-Liste ergänzt.
- [ ] `index.html` zwischen Z. 1848 und 1850: neue Card eingefügt.
- [ ] `style.css`: alle CSS-Regeln am korrekten Ort eingefügt
  (kein versehentliches Überschreiben von BA-233-Regeln).
- [ ] Vier i18n-Dateien: je acht neue Keys, gleiche Namen, an der
  empfohlenen Stelle. Akzent-Konvention der jeweiligen Datei
  übernommen (Escape oder Klartext).
- [ ] `docs/CODESTRUKTUR.md`: Eintrag „21a" eingefügt, Tabellen-
  Zeile „Unterstützung" um `unterstuetzung-graph.js` ergänzt.
- [ ] Im Browser: erste Balken zeigen hellgrünen Puffer-Anteil; ab
  ca. November 2026 (Puffer aufgebraucht) rote Lücke. Stimmt mit
  manueller Rechnung (`finBerechneZeitreihe(...)` in Konsole)
  überein.
- [ ] „Heute"-Marker ist sichtbar und mit „heute"/„today"/…
  beschriftet.
- [ ] Konsole zeigt keine neuen Errors nach Reload.
