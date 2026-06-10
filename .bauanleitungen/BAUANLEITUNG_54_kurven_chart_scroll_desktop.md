# Bauanleitung 54 — Kurven-Tab: Chart auf Desktop mitscrollen, mobil weiter gepinnt

## Worum es geht

Im Tab „Kurven" (HTML-Id `panel-levels`) sitzt das Chart in einer
Karte mit Klasse `lv-chart-card`. Aktuell ist diese Karte **immer**
oben gepinnt (`position: sticky; top: 0`), auch auf Desktop. Der
User möchte auf Desktop/Laptop das übliche Scroll-Verhalten — die
Chart-Karte rollt mit der Seite weg — und nur auf Smartphone die
Pin-Funktion behalten.

Die App nutzt bereits den Breakpoint `@media (max-width: 768px)` als
Mobile/Touch-Grenze (z. B. in `style.css` Z. 745, Z. 915). Dieser
Breakpoint wird übernommen.

## Stelle 1 — `style.css`: Sticky nur noch im Mobile-Block

In `style.css` aktuell ab Z. 738:

```css
.lv-chart-card {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--surface);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
}
@media (max-width: 768px) {
  .container {
    padding: 12px;
  }
  …
}
```

Ersetzen den `.lv-chart-card`-Block (Z. 738–744) durch nur die
unverwüstlichen Karten-Styles ohne sticky:

```css
.lv-chart-card {
  background: var(--surface);
}
```

Anschließend im bestehenden `@media (max-width: 768px) { … }`-Block
(beginnt aktuell bei Z. 745) **innerhalb** dieser geschweiften Klammer
einen neuen Regel-Block für `.lv-chart-card` ergänzen — sinnvoll am
Anfang des Mobile-Blocks, direkt nach der öffnenden `{`:

```css
@media (max-width: 768px) {
  .lv-chart-card {
    position: sticky;
    top: 0;
    z-index: 5;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  }
  .container {
    padding: 12px;
  }
  …
}
```

(Die anderen Regeln innerhalb des Mobile-Blocks bleiben unverändert.)

Hintergrund:

- Desktop-Default: weder `position: sticky` noch `top` noch `z-index`
  noch der Schatten — die Karte verhält sich wie eine ganz normale
  Box im Fluß und scrollt mit.
- Im Mobile-Block kommen `position: sticky; top: 0; z-index: 5` plus
  der ursprüngliche `box-shadow` zurück — das ist das alte Verhalten
  ab Smartphone-Breite.
- Hintergrundfarbe (`background: var(--surface)`) bleibt auf beiden
  Bildschirm-Größen identisch, damit die Karte visuell wie alle
  anderen Karten aussieht.
- Schatten gehört konzeptionell zur Pin-Funktion (markiert „du
  scrollst hinter mir vorbei"), deshalb wandert er ebenfalls in
  den Mobile-Block.

## Stelle 2 — `SPEC.md` / `spec/`

Im Kapitel **Kurven** (`spec/`-Datei für den Kurven-Tab) ergänzen:

> Auf Bildschirmbreiten ≤ 768 px (Mobile) bleibt die Chart-Karte
> oben angepinnt (`position: sticky; top: 0`), damit das Diagramm
> beim Scrollen durch die Kurven-Konfiguration sichtbar bleibt.
> Auf Desktop / Laptop (Breite > 768 px) scrollt die Chart-Karte
> mit der Seite mit. Geschaltet rein per CSS Media Query in
> `style.css`.

## Stelle 3 — `CODESTRUKTUR.md`

Im Datenfluss-Block einen kurzen Absatz nach **„Mobile-Eingabe-Sperre"**
(oder einem anderen Mobile-bezogenen Eintrag) ergänzen:

> **Kurven-Chart-Pinning:** Die `.lv-chart-card` im Kurven-Tab ist
> nur auf Mobile-Breite (`max-width: 768px`) `position: sticky`. Auf
> Desktop scrollt sie als normale Karte mit. Der Breakpoint passt zu
> den anderen Mobile-Regeln in `style.css`.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Desktop (Browser-Fenster > 768 px)

1. Tool laden. Fenster auf Desktop-Breite (> 768 px).
2. Tab „Kurven" öffnen.
3. Seite nach unten scrollen (Maus-Rad oder Scroll-Bar). Falls die
   Inhalte unterhalb der Chart-Karte über die Bildschirmhöhe
   hinausgehen: erwartet — die Chart-Karte scrollt mit weg, bleibt
   nicht oben kleben.
4. Falls die Inhalte ohnehin auf den Bildschirm passen: Fenster
   verkleinern (vertikal), so daß gescrollt werden muß, dann wie
   3.

### Test B — Mobile (Browser-Fenster ≤ 768 px)

1. Browser-Fenster auf ≤ 768 px Breite ziehen (Desktop-Browser
   funktioniert dafür) oder Smartphone öffnen.
2. Tab „Kurven" öffnen.
3. Seite nach unten scrollen.
4. Erwartet: Chart-Karte bleibt oben angepinnt, der Rest scrollt
   darunter durch. Schatten der Karte ist sichtbar.

### Test C — Breakpoint-Übergang

1. Browser-Fenster langsam in der Breite vergrößern, beginnend bei
   < 768 px (Chart gepinnt).
2. Sobald die Breite 769 px überschreitet, wird die Karte unpinned —
   wenn aktuell gescrollt, „springt" sie an ihre Fluß-Position.
   Verkleinern: Karte pinnt wieder.

### Test D — Keine Regression in anderen Tabs

1. Schieber-Tab, Player-Tab, Meßergebnisse-Tab, Implantat-Tab
   anschauen.
2. Erwartet: keiner dieser Tabs ist von der Änderung berührt — alle
   anderen sticky-/fixed-Elemente bleiben unverändert (z. B.
   Header-Tabs).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–D einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Ist der `.lv-chart-card`-Block außerhalb des Media-Query auf nur
  noch die Hintergrundfarbe (oder bleibende Card-Styles) reduziert?
  Keine `position`, kein `top`, kein `z-index`, kein `box-shadow`
  außerhalb des Mobile-Blocks.
- Steht die neue `.lv-chart-card`-Regel innerhalb der geschweiften
  Klammern von `@media (max-width: 768px) { … }` (Z. 745)? Wenn
  versehentlich danach oder davor, ist sie eine globale Regel und
  pinnt die Karte wieder dauerhaft.
- Bleibt der Breakpoint **exakt** `(max-width: 768px)`, konsistent
  mit den anderen Mobile-Regeln im selben Block?

Bei Unklarheit Rückfrage statt Annahme.
