# Bauanleitung 237 — Unterstützung-Tab: zweite Feinjustierung

## Ziel

Zwei kleine Anpassungen nach BA 236:

1. Zahl in der Zeile **„Zusätzlich nötige monatliche Spenden für
   sinnvolle Erweiterung:"** (das ist `r.gapToFull`) ebenfalls in
   **rot** darstellen, mit derselben Klasse wie die rote Zahl in
   der Tabelle.
2. Im Graph: die **hellrote Differenz-Fläche** und die **Balken**
   schließen rechts und links **bündig** ab. Aktuell läuft die
   Fläche bis zum Plot-Rahmen, die Balken hören vorher auf — das
   wirkt inkonsistent.

**Nur DE-Änderungen** (keine neuen i18n-Strings; nur CSS, JS, HTML
ist nicht betroffen).

## Scope

Geändert: `js/version.js`, `js/unterstuetzung.js` (eine Klasse),
`js/unterstuetzung-graph.js` (Differenz-Fläche-Block), `style.css`
(eine Regel umgehängt).

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.237-beta";
```

## Schritt 2 — CSS-Klasse `.support-self-amount` generalisieren

Aktuell ist die Klasse in `style.css` an den Tabellen-Scope gebunden:

```css
.support-finance-table .support-self-amount {
  color: #d94a4a;
  font-weight: 600;
}
```

Da die Klasse jetzt auch außerhalb der Tabelle verwendet wird (in
den Differenz-Hinweisen, wo das `<strong>`-Element ohnehin schon
`font-weight: 700` durch `.support-gap-emph` bekommt), wird sie
generalisiert.

**Vorher:**

```css
.support-finance-table .support-self-amount {
  color: #d94a4a;
  font-weight: 600;
}
```

**Nachher:**

```css
.support-self-amount {
  color: #d94a4a;
}
.support-finance-table .support-self-amount {
  font-weight: 600;
}
```

Erklärung: `color` ist global gesetzt, `font-weight: 600` bleibt
spezifisch für den Tabellen-Kontext. In der Gap-Hint-Zeile gewinnt
`.support-gap-emph strong { font-weight: 700; }` durch höhere
Spezifität — die rote Farbe schlägt aber durch, weil keine andere
Regel sie überschreibt.

## Schritt 3 — Klasse an `<strong>` in der Gap-Hint-Zeile

In `js/unterstuetzung.js` im Block `_untRenderFinanzTable`, der die
Differenz-Hinweise rendert (Z. 53–61), beim **zweiten** `<strong>`
(`r.gapToFull`) die Klasse ergänzen.

**Vorher (Z. 58–61):**

```js
      '<div class="support-gap-row support-gap-emph">' +
        '<span data-t="supportGapToFull"></span> ' +
        '<strong>' + finFmtEuro(r.gapToFull) + '</strong>' +
      '</div>';
```

**Nachher:**

```js
      '<div class="support-gap-row support-gap-emph">' +
        '<span data-t="supportGapToFull"></span> ' +
        '<strong class="support-self-amount">' + finFmtEuro(r.gapToFull) + '</strong>' +
      '</div>';
```

(Die **erste** Gap-Row mit `r.fullVsCurrent` — Z. 54–57 — bleibt
**unverändert** ohne Klasse. Nur die untere, betonte Zeile wird rot.)

## Schritt 4 — Differenz-Fläche im Graph auf Bar-Bereich beschränken

In `js/unterstuetzung-graph.js` den Differenz-Flächen-Block (eingeführt
in BA 236, Z. ~104–111) anpassen, sodaß die Fläche links und rechts
bündig mit dem Bar-Bereich abschließt statt mit dem Plot-Rahmen.

**Vorher:**

```js
  // Differenz-Fläche zwischen aktuellen Kosten und Erweiterung
  if (kostenFull > kostenCurrent) {
    ctx.fillStyle = "rgba(217, 74, 74, 0.18)";
    ctx.fillRect(padL,
                 yEuro(kostenFull),
                 plotW,
                 yEuro(kostenCurrent) - yEuro(kostenFull));
  }
```

**Nachher:**

```js
  // Differenz-Fläche zwischen aktuellen Kosten und Erweiterung —
  // bündig mit dem Bar-Bereich (linke Kante des ersten Bars bis
  // rechte Kante des letzten Bars), nicht über den ganzen Plot.
  if (kostenFull > kostenCurrent) {
    var flaecheLinks  = xMonat(0);
    var flaecheRechts = xMonat(n - 1) + barW;
    ctx.fillStyle = "rgba(217, 74, 74, 0.18)";
    ctx.fillRect(flaecheLinks,
                 yEuro(kostenFull),
                 flaecheRechts - flaecheLinks,
                 yEuro(kostenCurrent) - yEuro(kostenFull));
  }
```

Die zwei waagerechten **Bezugslinien** (aktuelle Kosten / Erweiterung)
gehen weiterhin über den ganzen Plot (`padL` bis `padL + plotW`) —
das ist gewollt, sie sind Skalen-Markierungen, nicht Daten.

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload**, Tab **Unterstützung**, Sprache **Deutsch**.
2. **Tabelle und Differenz-Hinweise:**
   - In der Tabelle weiterhin die Zahl bei „Nicht durch monatliche
     Spenden gedeckt:" (14,00 €) in **rot**.
   - In der Differenz-Hinweis-Zeile bei „Zusätzlich nötige monatliche
     Spenden für sinnvolle Erweiterung:" (19,93 €) jetzt **ebenfalls
     rot**, weiterhin fett (durch `.support-gap-emph`).
   - Die obere Hinweis-Zeile bei „Differenz Stand → sinnvolle
     Erweiterung:" (5,93 €) bleibt **schwarz**.
3. **Graph:**
   - Die hellrote Differenz-Fläche zwischen den zwei Bezugslinien
     beginnt jetzt erst beim ersten Balken (linke Kante) und endet
     mit dem letzten Balken (rechte Kante). Links und rechts davon
     ist der Plot innerhalb des Rahmens wieder weiß.
   - Die gestrichelte/gepunktete graue Bezugslinie geht weiterhin
     über den vollen Plot, von Y-Achse bis rechter Plot-Rand.
4. **Sprachen EN/FR/ES:** rote Zahlen bleiben rot (CSS sprachfrei).
   Graph-Verhalten gleich.
5. **Konsole nach Reload:** keine neuen Errors.

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

- [ ] `js/version.js` auf `"3.2.237-beta"`.
- [ ] `style.css`: `.support-self-amount` umgehängt (color global,
  font-weight nur im Tabellen-Scope).
- [ ] `js/unterstuetzung.js`: nur die untere Differenz-Hinweis-Zeile
  (`r.gapToFull`) hat `<strong class="support-self-amount">`; obere
  Zeile (`r.fullVsCurrent`) hat keine Klasse.
- [ ] `js/unterstuetzung-graph.js`: Differenz-Flächen-Block nutzt
  jetzt `xMonat(0)` und `xMonat(n - 1) + barW` als linke/rechte
  Grenze. Bezugslinien unverändert.
- [ ] Im Browser geprüft: rote Zahlen an beiden Stellen sichtbar;
  Differenz-Fläche bündig mit Balken.

Wenn alle Punkte erfüllt: Bauanleitung als abgenommen melden, mit
neutralem Hinweis, daß EN/FR/ES nicht angefaßt wurden.
