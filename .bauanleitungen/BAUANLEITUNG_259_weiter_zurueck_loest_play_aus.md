# BA 259 — Weiter/Zurück löst Play aus (alle Quellen einheitlich)

## Hintergrund

Heutiges Verhalten der Transport-Knöpfe ⏮ Prev und ⏭ Next:

- **Sätze**: starten die Wiedergabe ohnehin schon (sNext/sPrev rufen
  `sPlayCurrent`).
- **Geräusche**: `_plNoiseStep` startet `pPlay` nur, wenn vorher schon
  abgespielt wurde (`wasPlaying === true`). Bei gestopptem Player
  bleibt nach Prev/Next stumm.
- **Hörbücher**: nach `plBookLoadSelected()` wird **kein** `pPlay`
  gerufen — der Player bleibt im gerade aktuellen Zustand. Bei
  gestopptem Player ist Prev/Next dann reines „Buffer wechseln".

Nutzer-Entscheidung: Prev/Next sollen **immer** die Wiedergabe
auslösen, auch wenn der Player gerade gestoppt ist. Das vereinheit-
licht das Verhalten über alle Quellen und entspricht dem Standard-
Bedienmodell eines Players.

Setzt BA 258 voraus (`plShuffle`, neue `_plNoiseStep`-Variante,
Audiobook-Zufall-Pfad in `plPrev`/`plNext`).

## Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.259-beta";
```

## Schritt 1 — Geräusche: immer Play nach Step (`js/player.js`)

In `_plNoiseStep` (nach BA 258 umgeschrieben) das Trailing-Block-Ende
ändern:

**Vorher (nach BA 258, etwa Z. 1140–1148):**

```js
plNoiseSelectedId = nextItem.id;
const sel = document.getElementById("plNoiseItemSel");
if (sel) sel.value = nextItem.id;
const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
if (wasPlaying && typeof pPause === "function") pPause();
plNoiseLoadSelected().then(function () {
  if (wasPlaying && typeof pPlay === "function") pPlay();
});
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
```

**Nachher:**

```js
plNoiseSelectedId = nextItem.id;
const sel = document.getElementById("plNoiseItemSel");
if (sel) sel.value = nextItem.id;
if (typeof pPause === "function" && pPlaying) pPause();
plNoiseLoadSelected().then(function () {
  // BA259: Prev/Next loesen immer Play aus, auch wenn vorher gestoppt.
  if (typeof pPlay === "function") pPlay();
});
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
```

Heißt: `wasPlaying`-Gate weg, immer `pPlay` aufrufen.

## Schritt 2 — Hörbücher: Play nach Load (`js/player.js`)

In `plPrev` und `plNext` jeweils im Audiobook-Zweig (nach BA 258 neu
geschrieben) **`plBookLoadSelected()` als Promise behandeln und
anschließend Play auslösen**:

**`plPrev`-Audiobook-Zweig (BA 258 Schritt 5b) — letzte zwei Zeilen anpassen:**

**Vorher (nach BA 258):**

```js
const sel = document.getElementById("plBookChSel");
if (sel) sel.value = String(plBookChapterIdx);
if (typeof plBookLoadSelected === "function") plBookLoadSelected();
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
return;
```

**Nachher:**

```js
const sel = document.getElementById("plBookChSel");
if (sel) sel.value = String(plBookChapterIdx);
if (typeof pPause === "function" && pPlaying) pPause();
if (typeof plBookLoadSelected === "function") {
  plBookLoadSelected().then(function () {
    // BA259: Prev loest immer Play aus.
    if (typeof pPlay === "function") pPlay();
  });
}
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
return;
```

**`plNext`-Audiobook-Zweig** — analog dieselbe Anpassung der letzten
Zeilen.

## Schritt 3 — Sätze: Sicherstellen, daß `sPrev`/`sNext` immer Play machen

`sNext` und `sPrev` (BA 258 Schritt 3c) rufen bereits `sPlayCurrent`
unbedingt auf — keine Änderung nötig. Aber: `sPlayCurrent` baut
darauf, daß `sActive` gesetzt ist. In BA 258 wird `sActive = true`
in `sNext` gesetzt, in `sPrev` ebenfalls. Bestätigen, daß das in
beiden Funktionen vor `sPlayCurrent()` steht.

(Kein Code-Change nötig — Schritt nur als Verifikations-Punkt für
Sonnet im Selbstprüfungs-Auftrag.)

## Schritt 4 — Musik (Single-File-Modus, bis BA 261): keine Aktion

Bei der heutigen Musik-Quelle (`plActiveSource === "music"`) sind
Prev/Next bereits ausgegraut (`hasNext` ist `false`). Mit BA 260+261
wird die Musik-Bibliothek aktiv; ab dann gelten die hier festgelegten
Regeln auch für Musik. In BA 260 explizit darauf hinweisen.

## Schritt 5 — Spec-Update (`docs/spec/06-player.md`)

Im Wiedergabe-Card-Block (etwa Z. 17–42) zur Transport-Leiste
ergänzen:

```
- Weiter/Zurück lösen immer die Wiedergabe aus — auch wenn der
  Player gerade gestoppt ist (gilt für Sätze, Geräusche, Hörbücher).
```

## Akzeptanztest

1. Hard-Reload. Reiter „Player".
2. Quelle „Geräusche". Stop drücken (oder Tool im gestoppten Zustand).
3. „Next" klicken. → Erwartet: nächstes Geräusch wird sofort
   abgespielt (kein Stille).
4. Stop. „Prev" → vorheriges Geräusch wird sofort abgespielt.
5. Quelle „Hörbücher", ein Buch geladen. Stop.
6. „Next" → nächstes Kapitel wird sofort abgespielt.
7. „Prev" → voriges Kapitel wird sofort abgespielt.
8. Quelle „Sätze". Stop.
9. „Next" → zufälliger oder sequentieller Satz spielt sofort
   (je nach Zufall-Toggle).
10. „Prev" → analog.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung prüfen:

- `js/player.js` `_plNoiseStep`: kein `wasPlaying`-Gate mehr, `pPlay`
  unbedingt im `.then`. Zeile zitieren.
- `js/player.js` `plPrev`/`plNext` Audiobook-Zweig: `plBookLoadSelected`
  als Promise gehandhabt, `pPlay` im `.then`. Zeilen zitieren.
- `js/sentences.js`: `sActive = true;` steht vor `sPlayCurrent()` in
  beiden Funktionen `sNext` und `sPrev`. Zeilen zitieren.

Wenn ein Punkt nicht klar erfüllt ist: nicht still annehmen, sondern
rückfragen.
