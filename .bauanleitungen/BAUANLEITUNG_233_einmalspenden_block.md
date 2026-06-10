# Bauanleitung 233 — Einmalspenden-Block im Unterstützung-Tab

## Ziel

Unterhalb der Finanztabelle und oberhalb der Differenz-Hinweise einen
kurzen, optisch abgesetzten Block einfügen, der die bisher
eingegangenen Einmalspenden ausweist und kurz erklärt, wofür sie
verwendet werden.

Layout-Inhalt:

```
Zusätzlich eingegangen: 150,00 € als Einmalspenden.
Fließt in den Puffer für Monate, in denen die monatlichen Spenden nicht reichen.
```

Wenn keine Einmalspenden eingetragen sind (Summe = 0): Block wird
ausgeblendet.

**Voraussetzung:** BA 232 muß abgenommen sein (`finEinmalSummeBis`,
`finMonatHeute`, `finFmtEuro` müssen existieren).

## Scope

Geändert: `index.html`, `js/unterstuetzung.js`, `js/version.js`,
`style.css`, alle vier i18n-Dateien (`i18n/de.js`, `en.js`, `fr.js`,
`es.js`), `docs/CODESTRUKTUR.md` (Eintrag 21 minimal).

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.233-beta";
```

## Schritt 2 — HTML einfügen

In `index.html`, **zwischen** dem schließenden `</table>` (Z. 1825)
und dem `<div id="untGapHints">` (Z. 1827) einen neuen Block einfügen:

**Vorher:**

```html
          </table>

          <div id="untGapHints" class="support-gap-hints"><!-- befüllt durch unterstuetzung.js --></div>
```

**Nachher:**

```html
          </table>

          <div id="untEinmalBlock" class="support-onetime-block"><!-- befüllt durch unterstuetzung.js --></div>

          <div id="untGapHints" class="support-gap-hints"><!-- befüllt durch unterstuetzung.js --></div>
```

## Schritt 3 — CSS einfügen

In `style.css` direkt nach dem Block `.support-gap-row strong { ... }`
(endet Z. 1234) und vor `.support-card-slogan` einfügen:

```css
.support-onetime-block {
  margin: 12px 0 16px;
  padding: 8px 14px;
  background: var(--surface-alt, rgba(0,0,0,0.04));
  border-left: 4px solid #4a9d4a;
  border-radius: 0 4px 4px 0;
}
.support-onetime-row {
  display: flex;
  gap: 6px;
  align-items: baseline;
  flex-wrap: wrap;
  font-size: 0.95em;
}
.support-onetime-row strong {
  font-variant-numeric: tabular-nums;
}
.support-onetime-hint {
  margin-top: 4px;
  font-size: 0.88em;
  opacity: 0.75;
  font-style: italic;
}
```

## Schritt 4 — JS-Funktion in `js/unterstuetzung.js`

Neue Funktion **vor** `_untBuildIban` (also zwischen Z. 64 und Z. 66)
einfügen:

```js
function _untRenderEinmalBlock() {
  var box = document.getElementById("untEinmalBlock");
  if (!box) return;
  if (typeof finEinmalSummeBis !== "function") return;
  var summe = finEinmalSummeBis(finMonatHeute());
  if (summe <= 0) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }
  box.style.display = "";
  box.innerHTML =
    '<div class="support-onetime-row">' +
      '<span data-t="supportOneTimePrefix"></span> ' +
      '<strong>' + finFmtEuro(summe) + '</strong> ' +
      '<span data-t="supportOneTimeSuffix"></span>' +
    '</div>' +
    '<div class="support-onetime-hint" data-t="supportOneTimeHint"></div>';
  if (typeof applyLang === "function") applyLang();
}
```

Am Ende von `_untRenderFinanzTable()` (nach dem `if (gap) { ... }`-
Block, also nach Z. 63) den Aufruf ergänzen:

```js
  _untRenderEinmalBlock();
```

## Schritt 5 — i18n-Strings in alle vier Sprachdateien einfügen

Position: in jeder Sprachdatei direkt nach dem Block
`supportGapToFull: ...` (in `de.js` Z. 971), also vor der Leerzeile
und `supportFinanceGoal`.

**`i18n/de.js`** — drei neue Zeilen einfügen:

```js
    supportOneTimePrefix: "Zusätzlich eingegangen:",
    supportOneTimeSuffix: "als Einmalspenden.",
    supportOneTimeHint: "Fließt in den Puffer für Monate, in denen die monatlichen Spenden nicht reichen.",
```

**`i18n/en.js`** — an entsprechender Stelle:

```js
    supportOneTimePrefix: "Additionally received:",
    supportOneTimeSuffix: "as one-time donations.",
    supportOneTimeHint: "Goes into the buffer for months when the monthly donations are not enough.",
```

**`i18n/fr.js`** — an entsprechender Stelle:

```js
    supportOneTimePrefix: "Reçu en plus :",
    supportOneTimeSuffix: "en dons ponctuels.",
    supportOneTimeHint: "Alimente la réserve pour les mois où les dons mensuels ne suffisent pas.",
```

**`i18n/es.js`** — an entsprechender Stelle:

```js
    supportOneTimePrefix: "Adicionalmente recibido:",
    supportOneTimeSuffix: "en donaciones puntuales.",
    supportOneTimeHint: "Alimenta la reserva para los meses en los que las donaciones mensuales no son suficientes.",
```

## Schritt 6 — `docs/CODESTRUKTUR.md` Eintrag 21 leicht ergänzen

Im bestehenden Eintrag für `unterstuetzung.js` (Zeile mit
`| 21 | unterstuetzung.js | ...`) die Beschreibung der Render-
Funktion erweitern. Konkret den Satz

```
Befüllt `#untFinanzBody` / `#untFinanzFoot` / `#untGapHints` per `_untRenderFinanzTable()`.
```

ersetzen durch:

```
Befüllt `#untFinanzBody` / `#untFinanzFoot` / `#untGapHints` / `#untEinmalBlock` per `_untRenderFinanzTable()`. Der Einmalspenden-Block wird in `_untRenderEinmalBlock()` aus `finEinmalSummeBis(finMonatHeute())` gebaut und ausgeblendet, falls die Summe 0 ist.
```

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload** (Strg+Shift+R), Tab **Unterstützung** öffnen.
2. **Zwischen** Tabelle und Differenz-Hinweisen erscheint ein heller
   Block mit grünem linken Rand. Text:
   `Zusätzlich eingegangen: 150,00 € als Einmalspenden.` und darunter
   in kleinerer, kursiver Schrift:
   `Fließt in den Puffer für Monate, in denen die monatlichen Spenden
   nicht reichen.`
3. **Sprachumschaltung:** Tab/Toolbar auf EN, FR, ES schalten — der
   Block übersetzt sich jeweils sauber, Betrag `150,00 €` bleibt
   gleich.
4. **Edge-Test (optional, manuell):** in `js/finanzen.js` den
   `FINANZEN_EINMAL`-Array temporär auf `[]` setzen, Cache-Reload.
   Der Block muß komplett verschwinden (display:none). Danach
   ursprünglichen Array wiederherstellen.
5. **Tabelle und Differenz-Hinweise** sind unverändert in Position
   und Inhalt.

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden, mit Datei- und Zeilenangabe:

- [ ] `js/version.js` auf `"3.2.233-beta"`.
- [ ] HTML-Block `#untEinmalBlock` an korrekter Stelle zwischen
  `</table>` und `#untGapHints` (`index.html` Z. ~1826).
- [ ] CSS-Block in `style.css` direkt nach `.support-gap-row strong`.
- [ ] `_untRenderEinmalBlock` in `js/unterstuetzung.js` definiert
  und aus `_untRenderFinanzTable` aufgerufen.
- [ ] Vier i18n-Dateien: je drei neue Keys, alle gleich benannt,
  alle vor `supportFinanceGoal` plaziert.
- [ ] `docs/CODESTRUKTUR.md` Eintrag 21 aktualisiert.
- [ ] Konsole nach Cache-Reload: keine neuen Warnungen oder Errors.
- [ ] Beim Schalten zwischen DE/EN/FR/ES wird der Hinweistext
  korrekt gewechselt (Test: `applyLang()`-Aufruf in
  `_untRenderEinmalBlock` ist vorhanden).
