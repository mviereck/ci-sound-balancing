# Bauanleitung 31: Mobile-Tauglichkeit — Header

Erste von drei Bauanleitungen zur Smartphone-Tauglichkeit. Die anderen
beiden (32: readonly-Inputs auf Mobile, 33: Touch-Bedienleisten als
Pfeiltasten-Ersatz) sind unabhängig hiervon und können in beliebiger
Reihenfolge gebaut werden.

## Problem

Auf Smartphones (schmaler Viewport) überlagern sich das 150×150 px
Logo (links absolut positioniert) und die LINKS/RECHTS-Buttons
(zentriert). Das Logo verdeckt einen Teil der Buttons.

## Ziel

- Bei `max-width: 768px` (existierender Breakpoint) sollen die
  LINKS/RECHTS-Buttons **unter** das Logo rutschen.
- Das Logo behält seine Größe (150×150 px) und bleibt zentriert.
- Auf Desktop ändert sich nichts.

## Änderung 1 — `index.html` Z. 51 bis 93

Der Block enthält Logo und Side-Buttons in einem `position:relative`-
Container mit Inline-Styles. Wir ersetzen die zwei Inline-Styles durch
zwei neue CSS-Klassen, damit der Mobile-Breakpoint per Media-Query
greifen kann.

**Vorher** (`index.html` Z. 51–93):
```html
      <div style="position: relative; display: flex; justify-content: center; align-items: center; min-height: 150px; margin-bottom: 14px;">
        <img src="favicon.png" width="150" height="150" alt="" style="position: absolute; left: 25px; top: 50%; transform: translateY(-50%);">
        <div style="display: flex; gap: 10px;">
        <button
          id="sideLeftBtn"
          data-t="sideLeft"
          onclick="setActiveSide('left')"
          style="
            min-width: 110px;
            padding: 10px 24px;
            font-size: 1.05em;
            font-weight: 700;
            border-radius: 6px;
            border: 2px solid var(--border);
            cursor: pointer;
            font-family: var(--font);
            transition: all 0.15s;
            letter-spacing: 0.04em;
          "
        >
          LINKS
        </button>
        <button
          id="sideRightBtn"
          data-t="sideRight"
          onclick="setActiveSide('right')"
          style="
            min-width: 110px;
            padding: 10px 24px;
            font-size: 1.05em;
            font-weight: 700;
            border-radius: 6px;
            border: 2px solid var(--border);
            cursor: pointer;
            font-family: var(--font);
            transition: all 0.15s;
            letter-spacing: 0.04em;
          "
        >
          RECHTS
        </button>
        </div>
      </div>
```

**Nachher**:
```html
      <div class="brand-row">
        <img class="brand-logo" src="favicon.png" width="150" height="150" alt="">
        <div class="side-switch">
          <button
            id="sideLeftBtn"
            class="side-btn"
            data-t="sideLeft"
            onclick="setActiveSide('left')"
          >
            LINKS
          </button>
          <button
            id="sideRightBtn"
            class="side-btn"
            data-t="sideRight"
            onclick="setActiveSide('right')"
          >
            RECHTS
          </button>
        </div>
      </div>
```

Wichtig: Inline-Styles vollständig entfernen — sie würden sonst die
Media-Query überschreiben.

## Änderung 2 — `style.css`

Drei neue Regeln im Hauptblock (vor dem `@media (max-width: 768px)`
Block bei Z. 693) ergänzen — zum Beispiel direkt unter der
`.version-tag`-Regel (nach Z. 51):

```css
.brand-row {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 150px;
  margin-bottom: 14px;
}
.brand-logo {
  position: absolute;
  left: 25px;
  top: 50%;
  transform: translateY(-50%);
}
.side-switch {
  display: flex;
  gap: 10px;
}
.side-btn {
  min-width: 110px;
  padding: 10px 24px;
  font-size: 1.05em;
  font-weight: 700;
  border-radius: 6px;
  border: 2px solid var(--border);
  cursor: pointer;
  font-family: var(--font);
  transition: all 0.15s;
  letter-spacing: 0.04em;
  background: var(--surface);
  color: var(--text);
}
```

Hinweis zur `background`/`color`-Zeile: Die bisherigen Inline-Styles
hatten weder `background` noch `color` gesetzt — die Buttons erbten
den Default des Browsers. Damit sich am Aussehen nichts ändert, lege
ich Surface-Weiß und Default-Text-Farbe explizit fest. Falls der
existierende `updSideButtons`-Code (state-side.js) den aktiven Button
über Inline-Styles färbt, bleibt dieses Verhalten unverändert
(`style="…"` überstimmt Klassen-CSS).

## Änderung 3 — `style.css` Mobile-Breakpoint

Innerhalb des bestehenden `@media (max-width: 768px)`-Blocks (ab Z. 693)
zwei neue Regeln **am Ende des Blocks** ergänzen — vor der
schließenden `}` der Media-Query:

```css
  .brand-row {
    flex-direction: column;
    gap: 10px;
    min-height: auto;
    padding-top: 10px;
  }
  .brand-logo {
    position: static;
    transform: none;
  }
```

Wirkung: Bei ≤768 px wird der Flex-Container zur Spalte; das Logo
verläßt die absolute Positionierung und steht oben, die
LINKS/RECHTS-Buttons stehen darunter. Das Logo bleibt 150×150 px.

## Sync-Check: keine weiteren Module betroffen

- `setActiveSide`, `updSideButtons` (state-side.js) greifen per ID
  auf die Buttons zu — bleibt funktional.
- Kein Verweis auf die alten Inline-Styles in JS-Modulen (Suche im
  Repo: keine Treffer für `min-width: 110px` oder `letter-spacing:
  0.04em` außerhalb dieses Headers).

## Akzeptanztest-Checkliste

Nutzer-Klick-Schritte (manuell im Browser):

1. **Desktop, Fensterbreite ≥ 1000 px**
   - Logo links, Buttons LINKS/RECHTS zentriert daneben — Layout wie
     vorher. Keine Überlappung.
2. **Logo-Position bei 800 px Breite**
   - Logo immer noch links absolut, Buttons zentriert. Bei sehr
     breitem Logo-Text könnte Überlappung sichtbar werden — das
     ist gewollt erst ≤768 px gelöst.
3. **Mobile-Layout bei 700 px Breite** (z.B. DevTools Responsive,
   iPhone 12 Pro)
   - Logo oben mittig, 150×150 px.
   - Direkt darunter zentriert die zwei Buttons LINKS/RECHTS in
     einer Reihe.
   - Keine Überlappung.
4. **Sehr schmal (375 px)**
   - Logo oben, Buttons darunter immer noch in einer Reihe (zwei
     Buttons à 110 px + 10 px gap = 230 px passen).
   - Falls bei extrem schmalen Geräten (<350 px) der Platz nicht
     reicht, würde Flex die zweite Reihe selbst wickeln — kein
     zusätzlicher Code nötig.
5. **Side-Wechsel funktional**
   - Klick LINKS / RECHTS schaltet wie zuvor um, aktiver Button wird
     visuell markiert (von `updSideButtons` gesteuert).
6. **Sprachwechsel**
   - DE/EN/FR/ES-Beschriftungen über `data-t="sideLeft"` /
     `sideRight` ändern sich wie bisher.

## Selbstprüfungs-Auftrag an Sonnet

Bevor du „fertig" meldest, gehe jede Akzeptanz-Kriterie einzeln durch.
Pro Punkt melde **erfüllt / nicht erfüllt / unklar** mit Datei- und
Zeilenangabe der relevanten Stelle. Bei „unklar" stoppe und frage
nach. Insbesondere prüfen:

- Wurden die Inline-Styles in `index.html` Z. 51–93 vollständig
  entfernt? (Andernfalls greift die Media-Query nicht.)
- Sind die drei neuen CSS-Klassen (`brand-row`, `brand-logo`,
  `side-switch`, `side-btn`) nur einmal im Stylesheet definiert
  und nicht versehentlich in einem ungenutzten Block gelandet?
- Sieht der aktive Button (`updSideButtons` in state-side.js) noch
  korrekt aus? Falls die Funktion einen Hintergrund oder eine
  Border-Farbe setzt, könnte das mit der neuen `background:
  var(--surface)`-Zeile interagieren. Falls ja, beschreibe das
  Verhalten knapp und schlage ggf. einen kleinen Anpassungs-Snippet
  vor (z.B. `updSideButtons` nutzt `!important` oder Inline-Style —
  Inline-Style sticht ohnehin).
- Aktualisierung der Referenzdateien: **CODESTRUKTUR.md** und
  **SPEC.md** sind hier **nicht** zu ändern (keine strukturelle und
  keine funktionale Änderung — nur Layout).
