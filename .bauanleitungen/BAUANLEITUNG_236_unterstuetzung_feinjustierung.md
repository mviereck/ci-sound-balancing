# Bauanleitung 236 — Unterstützung-Tab: Feinjustierung

## Ziel

Vier kleine optische Anpassungen im Unterstützung-Tab:

1. Zahl bei „Nicht durch monatliche Spenden gedeckt:" in **rot**.
2. Im Graph „Vollausbau" durch **„Erweiterung"** ersetzen.
3. Linien-Labels „aktuelle Kosten" und „Erweiterung" **links neben
   den Plot** verschieben, mit kleinem Markierungsstrich zur Y-Achse.
   Der Plot wird dadurch etwas schmaler.
4. Den Bereich zwischen den zwei Bezugslinien (aktuelle Kosten →
   Erweiterung) **hellrot, halb-transparent** unterlegen. Neuer
   Eintrag in der Legende dazu.

**Nur DE-Änderungen.** EN/FR/ES bleiben unangetastet (Übersetzungen
folgen, wenn der Nutzer auffordert).

## Scope

Geändert: `js/version.js`, `js/unterstuetzung.js`,
`js/unterstuetzung-graph.js`, `index.html` (Legende), `style.css`
(zwei kleine Regeln), `i18n/de.js` (ein geänderter String, ein neuer
Key).

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.236-beta";
```

## Schritt 2 — Zahl rot (Tabelle-Footer)

In `js/unterstuetzung.js` die `supportSelfLabel`-Zeile im Footer um
eine CSS-Klasse erweitern.

**Vorher (Z. 41-45):**

```js
    '<tr>' +
      '<td data-t="supportSelfLabel"></td>' +
      '<td class="num">–</td>' +
      '<td class="num">' + finFmtEuro(r.selfShare) + '</td>' +
    '</tr>';
```

**Nachher:**

```js
    '<tr>' +
      '<td data-t="supportSelfLabel"></td>' +
      '<td class="num">–</td>' +
      '<td class="num support-self-amount">' + finFmtEuro(r.selfShare) + '</td>' +
    '</tr>';
```

## Schritt 3 — CSS für die rote Zahl

In `style.css` nach den bestehenden `.support-finance-table`-Regeln
folgende Regel einfügen:

```css
.support-finance-table .support-self-amount {
  color: #d94a4a;
  font-weight: 600;
}
```

## Schritt 4 — `i18n/de.js`: Graph-Label und neuer Legenden-Key

**Geändert:**

```js
    supportGraphCostFull: "Erweiterung",
```

(vorher: `"Vollausbau"`)

**Neu**, direkt nach `supportGraphLegendLuecke`:

```js
    supportGraphLegendErweiterung: "Differenz zur Erweiterung",
```

Nur in `i18n/de.js`. Andere Sprachen unverändert.

## Schritt 5 — Legenden-Eintrag in `index.html`

Im Block `<div class="support-graph-legend">` (Teil der
`support-card-graph`) einen vierten `lg-item` ergänzen:

**Vorher:**

```html
          <div class="support-graph-legend">
            <span class="lg-item"><span class="lg-swatch lg-dauer"></span><span data-t="supportGraphLegendDauer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-puffer"></span><span data-t="supportGraphLegendPuffer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-luecke"></span><span data-t="supportGraphLegendLuecke"></span></span>
          </div>
```

**Nachher:**

```html
          <div class="support-graph-legend">
            <span class="lg-item"><span class="lg-swatch lg-dauer"></span><span data-t="supportGraphLegendDauer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-puffer"></span><span data-t="supportGraphLegendPuffer"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-luecke"></span><span data-t="supportGraphLegendLuecke"></span></span>
            <span class="lg-item"><span class="lg-swatch lg-erweiterung"></span><span data-t="supportGraphLegendErweiterung"></span></span>
          </div>
```

## Schritt 6 — CSS für das neue Legenden-Swatch

In `style.css` direkt nach den bestehenden `.lg-dauer / .lg-puffer /
.lg-luecke`-Regeln folgende Regel ergänzen:

```css
.support-graph-legend .lg-erweiterung { background: rgba(217, 74, 74, 0.35); }
```

(Etwas opaker als im Plot selbst — sonst kaum sichtbar im 14×12 px
Swatch.)

## Schritt 7 — `js/unterstuetzung-graph.js` umbauen

Drei zusammenhängende Änderungen in `_ugRenderGraph`:

### 7a — `padL` vergrößern

**Vorher (Z. 46):**

```js
  var padL = 50, padR = 18, padT = 16, padB = 38;
```

**Nachher:**

```js
  var padL = 110, padR = 18, padT = 16, padB = 38;
```

(Y-Ticks bleiben rechtsbündig bei `padL - 6` wie bisher; die zusätz-
lichen ~60 px nutzen die neuen Linien-Labels links davon.)

### 7b — Differenz-Fläche zeichnen (vor den Bezugslinien)

Nach dem `for`-Loop „Stacked Bars" (endet Z. 102 mit `}`) und vor
dem Block „Linie ‚aktuelle Kosten'" (beginnt Z. 104) folgenden Block
einfügen:

```js
  // Differenz-Fläche zwischen aktuellen Kosten und Erweiterung
  // (hellrot, halb-transparent). Bedeutet: "in diesem Bereich
  // wäre die Erweiterung noch nicht gedeckt".
  if (kostenFull > kostenCurrent) {
    ctx.fillStyle = "rgba(217, 74, 74, 0.18)";
    ctx.fillRect(padL,
                 yEuro(kostenFull),
                 plotW,
                 yEuro(kostenCurrent) - yEuro(kostenFull));
  }
```

### 7c — Linien-Labels nach links verschieben + Markierungsstrich

Den **gesamten Block** „Linie ‚aktuelle Kosten'" und „Linie
‚Vollausbau'" (Z. 104-127, vom Kommentar `// Linie "aktuelle Kosten"`
bis einschließlich `ctx.setLineDash([]);` nach dem zweiten
`fillText`) **ersetzen** durch:

```js
  // Linie "aktuelle Kosten" — horizontale Bezugslinie, gestrichelt
  ctx.strokeStyle = "#777";
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenCurrent));
  ctx.lineTo(padL + plotW, yEuro(kostenCurrent));
  ctx.stroke();
  ctx.setLineDash([]);
  // Markierungsstrich + Label links außerhalb des Plots
  ctx.beginPath();
  ctx.moveTo(padL - 28, yEuro(kostenCurrent));
  ctx.lineTo(padL,      yEuro(kostenCurrent));
  ctx.stroke();
  ctx.fillStyle    = "#555";
  ctx.font         = "10.5px Segoe UI, sans-serif";
  ctx.textAlign    = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(_ugT("supportGraphCostCurrent", "aktuelle Kosten"),
               padL - 32, yEuro(kostenCurrent));

  // Linie "Erweiterung" — horizontale Bezugslinie, gepunktet
  ctx.strokeStyle = "#777";
  ctx.lineWidth   = 1.2;
  ctx.setLineDash([1.5, 3]);
  ctx.beginPath();
  ctx.moveTo(padL,         yEuro(kostenFull));
  ctx.lineTo(padL + plotW, yEuro(kostenFull));
  ctx.stroke();
  ctx.setLineDash([]);
  // Markierungsstrich + Label links außerhalb des Plots
  ctx.beginPath();
  ctx.moveTo(padL - 28, yEuro(kostenFull));
  ctx.lineTo(padL,      yEuro(kostenFull));
  ctx.stroke();
  ctx.fillText(_ugT("supportGraphCostFull", "Erweiterung"),
               padL - 32, yEuro(kostenFull));
```

(Inhaltlich: gleiche Linien wie vorher, aber die Labels werden
rechtsbündig bei `padL - 32` plaziert und ein 28-px-Strich verbindet
sie mit der Y-Achse. Default-Fallback von `Vollausbau` auf
`Erweiterung` angepaßt.)

### 7d — Y-Tick-Loop: Y-Achse selbst nicht überschreiben

Der bestehende Y-Gitter-Loop (Z. 65-79) zeichnet auch eine horizontale
Linie *auf* Höhe 0, die optisch dem Plot-Rahmen unten entspricht —
das bleibt wie es ist. Keine Änderung. Falls aber bei `padL = 110`
das `v + " €"`-Label zu nah an die linken Linien-Labels rückt
(kollidiert ab dem 100er-Y-Tick mit „aktuelle Kosten"), kann der
Y-Tick-Text bei sehr großem Y-Wert links angeschnitten wirken.
Sollte bei den jetzigen Daten (Y-Max ~60 €) nicht auftreten —
falls doch, in der Selbstprüfung melden.

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload**, Tab **Unterstützung**, Sprache **Deutsch**.
2. **Tabelle:** Die Zahl in der Zeile „Nicht durch monatliche Spenden
   gedeckt:" (Wert: 14,00 €) erscheint **rot und etwas fetter** als
   die anderen Werte.
3. **Graph:**
   - Links neben dem Plot stehen zwei Labels rechtsbündig:
     **„aktuelle Kosten"** auf Höhe 49 € und **„Erweiterung"** auf
     Höhe 54,93 €. Jeweils mit kurzem horizontalen Strich zur
     Y-Achse.
   - Der Plot beginnt etwas weiter rechts als vorher (mehr Platz
     links für die Labels).
   - Zwischen den zwei Bezugslinien (49 und 54,93) liegt ein
     **hellroter, halb-transparenter Streifen** quer durch den
     ganzen Plot.
   - Die Bezugslinien selbst bleiben sichtbar (eine gestrichelt,
     eine gepunktet, grau).
   - Y-Tick-Zahlen („20 €", „40 €", „60 €" …) bleiben gut lesbar,
     überlappen weder mit den Linien-Labels noch mit dem Strich.
4. **Legende unter dem Graphen:** Vier Einträge statt bisher drei.
   Der neue Eintrag „**Differenz zur Erweiterung**" hat ein hellrotes
   Swatch.
5. **Sprache auf EN/FR/ES:** In der Tabelle erscheint die rote Zahl
   weiterhin rot. Im Graph erscheint links neben der oberen Linie
   weiterhin das vorherige Wort („full build" / „déploiement
   complet" / „versión completa"), weil die anderen Sprachdateien
   nicht angefaßt wurden. Der neue Legenden-Eintrag erscheint auf
   Deutsch (Fallback). **Das ist gewollt.**
6. **Konsole nach Reload:** keine neuen Errors.

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

- [ ] `js/version.js` auf `"3.2.236-beta"`.
- [ ] `js/unterstuetzung.js`: `support-self-amount` als Klasse an
  der `r.selfShare`-Zelle.
- [ ] `style.css`: Regel `.support-finance-table .support-self-amount`
  mit roter Schrift + Fett-Gewicht; Regel
  `.support-graph-legend .lg-erweiterung` mit hellrotem Hintergrund.
- [ ] `i18n/de.js`: `supportGraphCostFull` auf „Erweiterung" geändert;
  neuer Key `supportGraphLegendErweiterung` mit dem angegebenen
  Text.
- [ ] `i18n/en.js`, `fr.js`, `es.js`: **nicht angefaßt** (keine
  Übersetzung der zwei DE-Änderungen).
- [ ] `index.html`: vierter `lg-item` in der Legende.
- [ ] `js/unterstuetzung-graph.js`:
  - `padL` auf 110.
  - Differenz-Fläche-Block nach Stacked-Bars-Loop, vor erster
    Bezugslinie.
  - Beide Linien-Label-Blöcke ersetzt (Position links, mit
    Markierungsstrich; Default-Fallback der oberen Linie auf
    „Erweiterung").
- [ ] Im Browser visuell überprüft: Y-Tick-Zahlen und Linien-Labels
  überlappen nicht; Differenz-Fläche sichtbar; Legende viergeteilt;
  rote Zahl in der Tabelle.

Wenn alle Punkte erfüllt: Bauanleitung als abgenommen melden, mit
neutralem Hinweis, daß EN/FR/ES nicht angefaßt wurden.
