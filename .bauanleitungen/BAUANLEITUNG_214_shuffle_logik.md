# BAUANLEITUNG 214 — Shuffle-Logik in allen 4 Wiedergabe-Modi

Voraussetzung: BA 213 wurde gebaut (Shuffle-Button im HTML vorhanden).

Der Zufall-Toggle (`plShuffle`) wirkt konsistent in allen vier Modi:
- **Musik**: Toggle vorhanden, derzeit no-op (Erweiterung für Playlists/Streaming vorgemerkt)
- **Sätze**: Zufall AUS → linearer Index durch Pool; Zufall AN → bisheriges Zufallsverhalten
- **Geräusche**: Zufall AUS → lineare Folge; Zufall AN → zufälliges Stück
- **Hörbuch**: Zufall AUS → nächstes/vorheriges Kapitel; Zufall AN → zufälliges Kapitel

Zielversion: `3.2.214-beta`

---

## Schritt 1 — version.js

```js
const APP_VERSION = "3.2.214-beta";
```

---

## Schritt 2 — i18n: plTipShuffle in allen vier Sprachen

### i18n/de.js

Einfügen direkt nach der Zeile `plTipLoop`:
```js
    plTipShuffle: "Zufällige Wiedergabe (Sätze: zufälliger Satz; Geräusche/Hörbuch: zufälliges Stück)",
```

### i18n/en.js

Einfügen direkt nach der Zeile `plTipLoop` (falls vorhanden) oder nach einem passenden Player-Key:
```js
    plTipShuffle: "Shuffle playback (sentences: random sentence; sounds/audiobook: random item)",
```

### i18n/fr.js

```js
    plTipShuffle: "Lecture aléatoire (phrases : phrase aléatoire ; sons/livre audio : élément aléatoire)",
```

### i18n/es.js

```js
    plTipShuffle: "Reproducción aleatoria (frases: frase aleatoria; sonidos/audiolibro: elemento aleatorio)",
```

Vor dem Einfügen: mit `grep -n "plTipLoop" i18n/en.js i18n/fr.js i18n/es.js` prüfen, ob der Key dort existiert.
Falls `plTipLoop` in einer Datei fehlt, den neuen Key nach einem anderen nahestehenden Player-Key einfügen.

---

## Schritt 3 — state-side.js: plShuffle-State

Direkt nach der Zeile `let plLoop = false;` (ca. Z. 717) einfügen:

```js
let plShuffle      = false;     // Zufall-Toggle: zufaellige Auswahl statt linearer Reihenfolge
```

---

## Schritt 4 — sentences.js: Satz-Index für lineare Wiedergabe

### 4a) sSentIdx als State-Variable

Direkt nach `let sCurRec = null;` (Zeile 16) einfügen:

```js
let sSentIdx = 0;   // Index fuer lineare Wiedergabe (plShuffle=false)
```

### 4b) Hilfsfunktion sPickLinear

Direkt nach `sPickRandom` einfügen:

```js
function sPickLinear(pool) {
  if (!pool || pool.length === 0) return null;
  const cur = sCurRec ? pool.findIndex(function (x) { return x.id === sCurRec.id; }) : -1;
  sSentIdx = (cur < 0) ? 0 : (cur + 1) % pool.length;
  return pool[sSentIdx];
}
```

### 4c) sPlay() anpassen — erster Satz bei Zufall AUS

In `sPlay()`, den Block `if (!sCurRec)` anpassen:

**Vorher:**
```js
  if (!sCurRec) {
    sCurRec = sPickRandom(pool, null);
  }
```

**Nachher:**
```js
  if (!sCurRec) {
    sCurRec = (typeof plShuffle !== "undefined" && plShuffle)
      ? sPickRandom(pool, null)
      : pool[0] || null;
    sSentIdx = sCurRec ? pool.indexOf(sCurRec) : 0;
  }
```

### 4d) sNext() anpassen — Auswahl je nach plShuffle

**Vorher:**
```js
  sCurRec = sPickRandom(pool, sCurRec);
```

**Nachher:**
```js
  sCurRec = (typeof plShuffle !== "undefined" && plShuffle)
    ? sPickRandom(pool, sCurRec)
    : sPickLinear(pool);
```

### 4e) sOnEnded() Auto-Advance anpassen

In `sOnEnded()`, im Auto-Advance-Block (Grep: `sCurRec = sPickRandom(pool, sCurRec)`
innerhalb des `plAutoAdvance`-Zweigs):

**Vorher:**
```js
    sCurRec = sPickRandom(pool, sCurRec);
```

**Nachher:**
```js
    sCurRec = (typeof plShuffle !== "undefined" && plShuffle)
      ? sPickRandom(pool, sCurRec)
      : sPickLinear(pool);
```

---

## Schritt 5 — player.js: Shuffle-Logik für Geräusche, Hörbuch + Toggle-Funktion

### 5a) plToggleShuffle und plUpdTransportUI erweitern

In `js/player.js`, direkt nach `plToggleLoop()`:

```js
function plToggleShuffle() {
  plShuffle = !plShuffle;
  plUpdTransportUI();
}
```

In `plUpdTransportUI()`, direkt nach dem `aaBtn`-Block:

```js
  const shBtn = document.getElementById("plShuffleBtn");
  if (shBtn) {
    shBtn.classList.toggle("active", plShuffle);
    shBtn.style.background = plShuffle ? "var(--accent, #6aa84f)" : "";
    shBtn.style.color      = plShuffle ? "#fff" : "";
  }
```

### 5b) onended: Geräusche-Auto-Advance mit Shuffle

Den Auto-Advance-Block für Geräusche im `onended`-Handler (Grep: `plActiveSource === "noise" && plAutoAdvance`):

**Vorher:**
```js
      if (plActiveSource === "noise" && plAutoAdvance) {
        setTimeout(function () {
          if (!plAutoAdvance || plLoop) return;
          const all = amCollectItems("geraeusche");
          const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
          if (sorted.length === 0) return;
          const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
          const next = sorted[(idx + 1) % sorted.length];
          if (!next) return;
          plNoiseSelectedId = next.id;
          const sel = document.getElementById("plNoiseItemSel");
          if (sel) sel.value = next.id;
          plNoiseLoadSelected().then(function () {
            if (typeof pPlay === "function") pPlay();
          });
        }, ms);
        return;
      }
```

**Nachher:**
```js
      if (plActiveSource === "noise" && plAutoAdvance) {
        setTimeout(function () {
          if (!plAutoAdvance || plLoop) return;
          const all = amCollectItems("geraeusche");
          const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
          if (sorted.length === 0) return;
          const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
          var next;
          if (plShuffle && sorted.length > 1) {
            var rnd;
            do { rnd = Math.floor(Math.random() * sorted.length); } while (rnd === idx);
            next = sorted[rnd];
          } else {
            next = sorted[(idx + 1) % sorted.length];
          }
          if (!next) return;
          plNoiseSelectedId = next.id;
          const sel = document.getElementById("plNoiseItemSel");
          if (sel) sel.value = next.id;
          plNoiseLoadSelected().then(function () {
            if (typeof pPlay === "function") pPlay();
          });
        }, ms);
        return;
      }
```

### 5c) onended: Hörbuch-Auto-Advance mit Shuffle

Den Auto-Advance-Block für Hörbücher im `onended`-Handler (Grep: `plActiveSource === "audiobook" && plAutoAdvance`):

**Vorher:**
```js
      if (plActiveSource === "audiobook" && plAutoAdvance) {
        const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
        if (col && Array.isArray(col.items)) {
          const next = plBookChapterIdx + 1;
          if (next < col.items.length) {
            setTimeout(function () {
              if (!plAutoAdvance || plLoop) return;
              if (typeof plBookSavePosition === "function") plBookSavePosition();
              plBookChapterIdx = next;
              const sel = document.getElementById("plBookChSel");
              if (sel) sel.value = String(next);
              if (plBookPositions[plBookSelectedId]) {
                plBookPositions[plBookSelectedId].chapterIdx = next;
                plBookPositions[plBookSelectedId].posSeconds = 0;
              }
              plBookLoadSelected().then(function () {
                if (typeof pPlay === "function") pPlay();
              });
            }, ms);
          }
        }
      }
```

**Nachher:**
```js
      if (plActiveSource === "audiobook" && plAutoAdvance) {
        const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
        if (col && Array.isArray(col.items)) {
          var nextCh;
          if (plShuffle && col.items.length > 1) {
            var rnd;
            do { rnd = Math.floor(Math.random() * col.items.length); } while (rnd === plBookChapterIdx);
            nextCh = rnd;
          } else {
            nextCh = plBookChapterIdx + 1;
          }
          if (nextCh < col.items.length) {
            setTimeout(function () {
              if (!plAutoAdvance || plLoop) return;
              if (typeof plBookSavePosition === "function") plBookSavePosition();
              plBookChapterIdx = nextCh;
              const sel = document.getElementById("plBookChSel");
              if (sel) sel.value = String(nextCh);
              if (plBookPositions[plBookSelectedId]) {
                plBookPositions[plBookSelectedId].chapterIdx = nextCh;
                plBookPositions[plBookSelectedId].posSeconds = 0;
              }
              plBookLoadSelected().then(function () {
                if (typeof pPlay === "function") pPlay();
              });
            }, ms);
          }
        }
      }
```

### 5d) _plNoiseStep: Shuffle-Zweig für Next/Prev-Button

In `_plNoiseStep(delta)`, den Bereich nach `const n = sorted.length;`:

**Vorher:**
```js
  const nextItem = sorted[((base + delta) % n + n) % n];
```

**Nachher:**
```js
  var nextItem;
  if (plShuffle && n > 1) {
    var rnd;
    do { rnd = Math.floor(Math.random() * n); } while (rnd === base);
    nextItem = sorted[rnd];
  } else {
    nextItem = sorted[((base + delta) % n + n) % n];
  }
```

### 5e) plNext(): Hörbuch Shuffle

In `plNext()`, im Audiobook-Zweig, nach `plBookSavePosition()`:

**Vorher:**
```js
    plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
```

**Nachher:**
```js
    if (plShuffle && col.items.length > 1) {
      var rnd;
      do { rnd = Math.floor(Math.random() * col.items.length); } while (rnd === plBookChapterIdx);
      plBookChapterIdx = rnd;
    } else {
      plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
    }
```

### 5f) plPrev(): Hörbuch Shuffle

In `plPrev()`, im Audiobook-Zweig, nach `plBookSavePosition()`:

**Vorher:**
```js
    plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
```

**Nachher:**
```js
    if (plShuffle && col.items.length > 1) {
      var rnd;
      do { rnd = Math.floor(Math.random() * col.items.length); } while (rnd === plBookChapterIdx);
      plBookChapterIdx = rnd;
    } else {
      plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
    }
```

---

## Schritt 6 — init.js: Click-Handler für plShuffleBtn registrieren

In `js/init.js`, direkt nach dem EventListener für `plLoopBtn`.
Grep-Prüfung: `grep -n "plLoopBtn.*addEventListener\|addEventListener.*plLoopBtn" js/init.js js/player.js`

Falls der Listener in `js/player.js` steht (ca. Z. 1387):
```js
document.getElementById("plLoopBtn").addEventListener("click", plToggleLoop);
```
Dann direkt danach einfügen:
```js
document.getElementById("plShuffleBtn").addEventListener("click", plToggleShuffle);
```

Falls in `js/init.js`, dort analog einfügen.

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Punkt durchgehen — **erfüllt / nicht erfüllt / unklar** mit Datei + Zeile:

1. `version.js`: `APP_VERSION === "3.2.214-beta"`?
2. `i18n/de.js`: `plTipShuffle`-Key vorhanden, kein unescaptes `"` im Wert?
3. `i18n/en.js`, `fr.js`, `es.js`: `plTipShuffle` jeweils vorhanden?
4. `state-side.js`: `let plShuffle = false;` vorhanden?
5. `sentences.js`: `let sSentIdx = 0;` vorhanden?
6. `sentences.js`: `sPickLinear(pool)` definiert?
7. `sentences.js` `sPlay()`: erster Satz bei `plShuffle=false` → `pool[0]`?
8. `sentences.js` `sNext()`: Auswahl je nach `plShuffle`?
9. `sentences.js` `sOnEnded()` Auto-Advance: Auswahl je nach `plShuffle`?
10. `player.js` `plToggleShuffle()`: vorhanden, ruft `plUpdTransportUI()` auf?
11. `player.js` `plUpdTransportUI()`: `plShuffleBtn` wird grün/grau je nach `plShuffle`?
12. `player.js` `onended` Geräusche: Shuffle-Zweig mit `Math.random()` vorhanden?
13. `player.js` `onended` Hörbuch: Shuffle-Zweig mit `Math.random()` vorhanden?
14. `player.js` `_plNoiseStep`: Shuffle-Zweig vorhanden?
15. `player.js` `plNext()` Audiobook: Shuffle-Zweig vorhanden?
16. `player.js` `plPrev()` Audiobook: Shuffle-Zweig vorhanden?
17. `init.js`: `plShuffleBtn` hat `addEventListener("click", plToggleShuffle)`?

---

## Akzeptanztest-Checkliste

### A) Toggle-Verhalten
1. Player-Tab öffnen, Würfel-Button klicken → **erwartet: Button wird grün**.
2. Nochmals klicken → **erwartet: Button wird grau**.

### B) Geräusche — Shuffle
3. Quelle „Geräusche" wählen, mehrere Geräusche geladen.
4. Shuffle AN. „Nächstes"-Button mehrfach klicken →
   **erwartet: Stücke wechseln nicht linear** (über 5+ Klicks kein striktes Durch-die-Reihe).
5. Shuffle AUS. „Nächstes"-Button mehrfach klicken →
   **erwartet: Stücke wechseln in fester Reihenfolge** (1→2→3→… und dann wieder von vorne).

### C) Geräusche — Auto-Advance + Shuffle
6. Shuffle AN, Auto-Weiter AN. Kurzes Geräusch abspielen bis zum Ende →
   **erwartet: nächstes Geräusch ist zufällig**.

### D) Sätze — linearer Modus
7. Quelle „Sätze" wählen. Shuffle AUS.
8. „Nächstes"-Button mehrfach klicken →
   **erwartet: Sätze kommen in fester Reihenfolge** (gleicher Pool), kein Zufall.
9. Shuffle AN. „Nächstes" mehrfach klicken →
   **erwartet: Sätze wechseln zufällig** (bisheriges Verhalten).

### E) Hörbuch — Shuffle
10. Quelle „Hörbuch" wählen, Werk mit mehreren Kapiteln.
11. Shuffle AN. „Nächstes"-Button klicken →
    **erwartet: zufälliges Kapitel wird geladen** (nicht zwingend das direkt folgende).
12. Shuffle AUS. „Nächstes" klicken →
    **erwartet: nächstes Kapitel linear**.

### F) Musik — kein Effekt
13. Quelle „Musik" wählen. Shuffle AN/AUS umschalten →
    **erwartet: Wiedergabe unverändert** (Toggle sichtbar, aber keine Wirkung).
