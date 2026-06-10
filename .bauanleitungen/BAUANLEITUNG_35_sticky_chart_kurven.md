# Bauanleitung 35: Sticky-Chart im Kurven-Tab

Kleine Erweiterung: Damit der 4-Linien-Chart beim Bedienen der
Preset-Tabelle weiter sichtbar bleibt, wird die Chart-Card mit
`position: sticky` an den Viewport-Oberrand geklebt. Auf Mobile wird
zusätzlich die Canvas-Höhe von 400 px auf 200 px reduziert, damit
unter dem Sticky-Bereich noch genug Platz für die Preset-Zeilen
bleibt.

## Ziel

- Beim Scrollen im Kurven-Tab bleibt der Chart oben sichtbar.
- Live-Änderung an Preset-Stärke ändert den Chart unmittelbar
  (bestehendes Verhalten von `lvOnChange` → `drawLvChart`); der User
  sieht die Wirkung sofort, ohne hochzuscrollen.
- Auf Desktop: Chart 400 px hoch (unverändert).
- Auf Mobile (≤768 px): Chart 200 px hoch.
- Klar als „schwebend" erkennbar (leichter Schatten unter der Card).

## Schritt 1 — Inline-Style des Canvas-Containers ersetzen

In `index.html`, der Canvas-Wrapper Z. 888–902 hat aktuell einen
langen `style="…"`-Block mit fester `height: 400px`. Inline-Styles
können vom Media-Query nicht überschrieben werden (außer mit
`!important`, das wir vermeiden). Wir ersetzen den Inline-Style
durch eine CSS-Klasse.

**Vorher** (Z. 888–902):
```html
          <div
            style="
              position: relative;
              width: 100%;
              height: 400px;
              background: var(--bg);
              border-radius: 8px;
              overflow: hidden;
            "
          >
            <canvas
              id="lvChartCv"
              style="width: 100%; height: 100%; display: block"
            ></canvas>
          </div>
```

**Nachher**:
```html
          <div class="lv-chart-wrap">
            <canvas id="lvChartCv"></canvas>
          </div>
```

## Schritt 2 — Chart-Card-Klasse vergeben

Im selben Tab, die Chart-Card-Öffnungs-Zeile (`index.html` Z. 833):

**Vorher**:
```html
        <div class="card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <h2 data-t="lvChartTitle" style="margin:0;"></h2>
```

**Nachher**:
```html
        <div class="card lv-chart-card">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <h2 data-t="lvChartTitle" style="margin:0;"></h2>
```

Nur die zweite Klasse `lv-chart-card` ist neu — `card` bleibt.

## Schritt 3 — CSS in `style.css`

In `style.css`, im Hauptblock (vor dem `@media (max-width: 768px)`-
Block bei Z. 693), folgenden Block anhängen:

```css
.lv-chart-wrap {
  position: relative;
  width: 100%;
  height: 400px;
  background: var(--bg);
  border-radius: 8px;
  overflow: hidden;
}
.lv-chart-wrap canvas {
  width: 100%;
  height: 100%;
  display: block;
}
.lv-chart-card {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}
```

Im bestehenden `@media (max-width: 768px)`-Block (ab Z. 693), am Ende
vor der schließenden `}` der Media-Query, folgende Regel ergänzen:

```css
  .lv-chart-wrap {
    height: 200px;
  }
```

Hinweise:
- `z-index: 5` reicht — die `.tabs`-Leiste oben hat keine eigene
  z-Order und nichts anderes schwebt im Kurven-Tab.
- `background: var(--surface)` ist nötig, damit die Sticky-Card den
  darunter laufenden Inhalt verdeckt (sonst scheint die Preset-
  Tabelle durch die Card hindurch).
- Der leichte Schatten (`0 4px 8px rgba(0,0,0,0.08)`) signalisiert
  visuell, daß die Card schwebt.

## Schritt 4 — `SPEC.md` knapper Hinweis

Im Kurven-Tab-Abschnitt von SPEC.md, unter „Übersicht" oder
„Kurven-Tab", folgenden Bullet ergänzen:

```
- Die Chart-Card ist beim Scrollen sticky (`position: sticky;
  top: 0`), damit der Graph beim Bedienen der Preset-Tabelle sichtbar
  bleibt. Auf Mobile (≤768 px) wird die Canvas-Höhe von 400 px auf
  200 px reduziert.
```

## Schritt 5 — `CODESTRUKTUR.md` — nichts

Keine strukturelle Änderung: kein neues Modul, keine neue Funktion,
keine neue globale Variable. CODESTRUKTUR.md bleibt unverändert.

## Akzeptanztest-Checkliste

### Desktop

1. Kurven-Tab öffnen.
   - Chart-Card und Preset-Card sind sichtbar.
   - Über der Chart-Card liegt nichts; sie schwebt mit Schatten.
2. In die Preset-Tabelle scrollen (Mausrad oder Touchpad).
   - Die Chart-Card bleibt **oben** am Viewport-Rand kleben.
   - Die Preset-Tabelle scrollt darunter durch.
3. Klick `+` an einer Preset-Zeile (Bauanleitung 34):
   - Stärke ändert sich, Chart wird live aktualisiert. Sichtbar **ohne**
     Hochscrollen, weil der Chart oben klebt.
4. Long-Press `+`: Auto-Repeat, Chart-Animation läuft sichtbar mit.
5. Druck-Funktion (`printKurvenBtn`) funktioniert unverändert
   (Sticky betrifft nur das Bildschirm-Layout, nicht das Druck-
   Markup).

### Mobile (iPhone 12 Pro Emulation)

6. Kurven-Tab öffnen.
   - Chart-Wrap ist nur 200 px hoch — Chart sichtbar, aber kompakt.
7. In die Preset-Tabelle scrollen.
   - Chart-Card bleibt oben kleben; darunter wird die Preset-Tabelle
     gescrollt.
   - Unter dem 200-px-Chart steht noch die Intro-Box-Card; auch sie
     scrollt unter dem Sticky-Block durch.
8. Touch-Buttons in der Preset-Tabelle bedienen:
   - Chart oben aktualisiert sich live.
9. Orientierungswechsel Portrait↔Landscape:
   - Bekanntes existierendes Verhalten: `drawLvChart()` reagiert
     **nicht** auf Resize-Events (kein `window.addEventListener
     ('resize', drawLvChart)` im Code). Nach Orientierungswechsel
     kann der Chart-Inhalt verzerrt erscheinen, bis eine andere
     Aktion `drawLvChart()` neu triggert (z.B. Checkbox toggeln,
     Preset ändern). Das ist **nicht** Teil dieser Anleitung; nur
     dokumentieren.

### Andere Tabs

10. Wechsel zu Implantat- oder Player-Tab und zurück: Sticky-Verhalten
    funktioniert weiter. (Tab-Wechsel re-rendert das Panel nicht; die
    Chart-Card bleibt im DOM und behält ihr Sticky.)
11. Andere Tabs zeigen **keine** Sticky-Effekte (`.lv-chart-card` ist
    auf den Kurven-Tab beschränkt).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede Akzeptanz-Kriterie einzeln durchgehen
und **erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Bei „unklar" stoppen und nachfragen.

Zusätzlich prüfen:

- **Inline-Style komplett entfernt?** Z. 888–902 in index.html darf
  keinen Inline-`style="…"` mehr am Canvas-Wrapper haben — sonst
  greift die Media-Query nicht.
- **Sticky-Vorfahr-Falle**: `.lv-chart-card` darf keinen Vorfahren
  mit `overflow: hidden`, `overflow: auto`, `overflow: scroll`,
  `transform`, `filter` oder `perspective` haben — sonst wird das
  Sticky-Verhalten still deaktiviert. `.container`, `.panel`,
  `body`, `html` haben keine solchen Eigenschaften (geprüft per
  Quick-Grep durch `style.css`).
- **Z-Order zur Tabs-Leiste**: `.tabs` (Z. 52 in style.css) hat keine
  Position-Eigenschaft und ist im Flow — der Sticky-Chart läuft
  beim Hochscrollen unter die Tabs-Leiste oder neben sie, je nach
  Tab-Scroll-Verhalten. Falls die Tabs-Leiste optisch zu nahe an der
  Chart-Card ist: `top: 0` ggf. auf `top: 10px` oder etwas höher
  setzen — Entscheidung beim Visual-Check, nicht jetzt.
- **Druckverhalten**: `@media print` (style.css Z. 620) sollte das
  Sticky aufheben, falls es im Druck stört. Stand jetzt: keine
  spezielle Print-Regel. Falls der Druck-Test im Akzeptanztest
  Schritt 5 unauffällig läuft, ist nichts zu tun. Falls der Sticky-
  Chart den Druck wiederholt, ergänzen:
  ```css
  @media print {
    .lv-chart-card { position: static; box-shadow: none; }
  }
  ```
- **SPEC.md** ist im selben Arbeitsschritt aktualisiert.
- **CODESTRUKTUR.md** wurde **nicht** geändert (bewußt) — kein neues
  Modul/Funktion/Variable.
