# BA 258 — Zufall-Toggle echt + sequentieller Modus + Prev-Memory

## Hintergrund

Der Shuffle-Button `#plShuffleBtn` wurde mit BA 213 in die Transport-
Leiste eingefügt, aber ohne Click-Handler verdrahtet. In den
Sub-Modulen (`sentences.js`, Player-Geräusche, Hörbücher) gibt es
keinen sequentiellen Modus — Prev/Next wirken bei Sätzen heute
**immer** als Zufall (`sNext` ruft `sPickRandom`), bei Geräuschen
und Hörbüchern als Schritt ±1 in der Sortier-Reihenfolge.

Diese BA löst drei verwobene Punkte:

1. **Zufall-Toggle (`plShuffle`)**: globaler Player-State, Default
   aus. Wirkt in allen Quellen, inklusive Hörbücher (random Kapitel
   im aktuellen Buch).
2. **Sequentieller Modus** (Zufall = aus):
   - Sätze: pro Sprecher blockweise durchs Korpus — erst alle
     Aufnahmen Sprecher A, dann Sprecher B, dann C, in der
     stabilen Reihenfolge des Sprecher-Dropdowns (DE zuerst,
     sonst alphabetisch). Innerhalb eines Sprechers nach
     `recording.id`-String sortiert.
   - Geräusche: nächstes/voriges in der aktuellen Sortier-Achse
     (wie bisher), aber jetzt vom zentralen Modus gesteuert.
   - Hörbücher: nächstes/voriges Kapitel im aktuellen Buch
     (wie bisher).
3. **Prev-Memory (1× zurück)**: im **Zufall-Modus** speichert jede
   Quelle das jeweils zuletzt gespielte Item. „Zurück" einmal lädt
   und entfernt das Memory; danach ist der Knopf ausgegraut, bis
   wieder ein neues Item lief. Im **sequentiellen Modus** wirkt
   „Zurück" als echter Schritt zurück, ohne Memory-Logik.

Reine Deutsch-BA — Übersetzungen folgen, wenn der Nutzer dazu
auffordert.

## Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.258-beta";
```

## Schritt 1 — State und Persistenz

### 1a — Default-Variable (`js/state-side.js`)

In `js/state-side.js` direkt **nach** der Zeile
`let plLoop         = false;` (Z. 739) einfügen:

```js
let plShuffle      = false;     // BA258: Zufall-Modus global, Default aus
```

### 1b — Reset (`js/file.js`)

In `js/file.js` direkt **nach** `if (typeof plLoop !== "undefined") plLoop = false;`
(Z. 160) einfügen:

```js
if (typeof plShuffle      !== "undefined") plShuffle      = false;
```

### 1c — JSON-Save (`js/file.js`)

Direkt **nach** der Zeile `plLoop: ...` (Z. 327) einfügen:

```js
plShuffle:      (typeof plShuffle      !== "undefined") ? plShuffle      : false,
```

### 1d — JSON-Load (`js/file.js`)

Direkt **nach** `if (typeof d.plLoop === "boolean")  plLoop = d.plLoop;`
(Z. 844) einfügen:

```js
if (typeof d.plShuffle     === "boolean")  plShuffle     = d.plShuffle;
```

## Schritt 2 — Transport-UI: Shuffle-Button verdrahten

### 2a — i18n-Key (`i18n/de.js`)

Nach `plTipLoop: "Aktuelles Stück endlos wiederholen",` (Z. 279)
einfügen:

```js
plTipShuffle: "Zufall: Stücke in zufälliger Reihenfolge wählen",
```

### 2b — `plToggleShuffle` Funktion (`js/player.js`)

Direkt **nach** `function plToggleLoop()` (etwa Z. 1157–1160) ergänzen:

```js
function plToggleShuffle() {
  plShuffle = !plShuffle;
  plUpdTransportUI();
}
```

### 2c — Click-Handler (`js/player.js`)

Direkt **nach** der Zeile
`document.getElementById("plLoopBtn").addEventListener("click", plToggleLoop);`
(Z. 1387) einfügen:

```js
document.getElementById("plShuffleBtn").addEventListener("click", plToggleShuffle);
```

### 2d — Active-Styling in `plUpdTransportUI` (`js/player.js`)

In `plUpdTransportUI` (Z. 1224–1258) direkt **nach** dem
`aaBtn`-Block (etwa Z. 1231–1236) einfügen:

```js
const shBtn = document.getElementById("plShuffleBtn");
if (shBtn) {
  shBtn.classList.toggle("active", plShuffle);
  shBtn.style.background = plShuffle ? "var(--accent, #6aa84f)" : "";
  shBtn.style.color      = plShuffle ? "#fff" : "";
}
```

### 2e — Prev-Button-Enable-Logik (`js/player.js`)

Im selben `plUpdTransportUI` den `hasNext`-Block (Z. 1247–1257)
ersetzen durch zwei separate Berechnungen, weil Prev jetzt im
Zufall-Modus vom Memory abhängt:

**Vorher:**

```js
const prevBtn = document.getElementById("plPrev");
const nextBtn = document.getElementById("plNext");
const hasNext = (plActiveSource === "sentences"
              || plActiveSource === "audiobook"
              || plActiveSource === "noise");
[prevBtn, nextBtn].forEach(function (b) {
  if (!b) return;
  b.disabled = !hasNext;
  b.style.opacity = hasNext ? "1" : "0.5";
  b.style.cursor  = hasNext ? "pointer" : "not-allowed";
});
```

**Nachher:**

```js
const prevBtn = document.getElementById("plPrev");
const nextBtn = document.getElementById("plNext");

// Next ist in S/N/AB grundsaetzlich verfuegbar; bei Musik kommt es
// mit BA 261. (Bei H/B sequentiell am Buchende stoppt der Klick
// hart, das ist OK.)
const hasNext = (plActiveSource === "sentences"
              || plActiveSource === "audiobook"
              || plActiveSource === "noise");

// Prev: bei Zufall = Memory; bei sequentiell = vorheriges Item.
// Wir berechnen pro Quelle das Boolesche "kann zurueck".
let hasPrev = hasNext;
if (hasNext && plShuffle) {
  hasPrev = false;
  if (plActiveSource === "sentences" && typeof sHasPrevMemory === "function") {
    hasPrev = sHasPrevMemory();
  } else if (plActiveSource === "noise" && typeof plNoiseHasPrevMemory === "function") {
    hasPrev = plNoiseHasPrevMemory();
  } else if (plActiveSource === "audiobook" && typeof plBookHasPrevMemory === "function") {
    hasPrev = plBookHasPrevMemory();
  }
}

if (nextBtn) {
  nextBtn.disabled = !hasNext;
  nextBtn.style.opacity = hasNext ? "1" : "0.5";
  nextBtn.style.cursor  = hasNext ? "pointer" : "not-allowed";
}
if (prevBtn) {
  prevBtn.disabled = !hasPrev;
  prevBtn.style.opacity = hasPrev ? "1" : "0.5";
  prevBtn.style.cursor  = hasPrev ? "pointer" : "not-allowed";
}
```

## Schritt 3 — Sätze: sequentiell + Memory

### 3a — Memory-Variable + Helper (`js/sentences.js`)

In `js/sentences.js` direkt **nach** `let sShownText = "";` (Z. 17)
ergänzen:

```js
let sPrevRec = null;            // BA258: 1x-Memory fuer Zufall-Zurueck
```

### 3b — Sequenz-Pool und Schritt-Funktionen (`js/sentences.js`)

Direkt **vor** `function sPickRandom` (Z. 128) einfügen:

```js
// BA258: Sequenzpool aller aktuell verfuegbaren Aufnahmen, sortiert
// pro Sprecher blockweise (DE zuerst, sonst alphabetisch nach
// speaker_id), innerhalb eines Sprechers nach recording.id.
function sBuildSequencePool() {
  const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
  const curLang = (typeof plSentLang === "string" && plSentLang)
    ? plSentLang
    : (typeof lang !== "undefined" ? lang : "de");
  const filtered = all.filter(function (it) {
    return it && it.tags && it.tags.lang === curLang;
  });

  // Sprecher-Reihenfolge gem. sRefreshSpeakerDropdown-Logik:
  // erste Beobachtungsreihenfolge im Pool, "any" gibt's hier nicht.
  const spkOrder = [];
  const seen = new Set();
  for (const it of filtered) {
    const sid = it.tags.speaker_id || "unbekannt";
    if (!seen.has(sid)) { seen.add(sid); spkOrder.push(sid); }
  }

  // Gruppieren und pro Sprecher nach recording.id sortieren.
  const byId = function (it) {
    const i = (it.id || "").lastIndexOf(":");
    return i >= 0 ? it.id.substring(i + 1) : (it.id || "");
  };
  const groups = new Map();
  for (const sid of spkOrder) groups.set(sid, []);
  for (const it of filtered) groups.get(it.tags.speaker_id || "unbekannt").push(it);
  for (const sid of spkOrder) {
    groups.get(sid).sort(function (a, b) {
      return byId(a).localeCompare(byId(b));
    });
  }

  const out = [];
  for (const sid of spkOrder) for (const it of groups.get(sid)) out.push(it);
  return out;
}

// Liefert das nachfolgende Item in der Sequenz; bei Sprecher-Filter
// ungleich "any" wird der Sprecher beruecksichtigt.
function sSeqStep(delta) {
  const spkSel = document.getElementById("plSentSpeaker").value;
  let pool;
  if (spkSel && spkSel !== "any") {
    pool = sBuildRecordingPool(spkSel);
  } else {
    pool = sBuildSequencePool();
  }
  if (pool.length === 0) return null;
  let idx = -1;
  if (sCurRec) idx = pool.findIndex(function (x) { return x.id === sCurRec.id; });
  if (idx < 0) return pool[0];
  const next = (idx + delta + pool.length) % pool.length;
  return pool[next];
}

function sHasPrevMemory() {
  return !!sPrevRec;
}
```

### 3c — `sPlay` und `sNext`/`sPrev` überarbeiten (`js/sentences.js`)

Aktuell heißt die Random-Funktion `sNext` (Z. 233–244). Sie wird in
zwei Funktionen aufgeteilt und durch eine zentrale `sNext`/`sPrev`
ersetzt, die zwischen Zufall und Sequenz schaltet.

**`sPlay` bleibt** (Z. 218–231), aber: der bisherige `if (!sCurRec) sCurRec = sPickRandom(pool, null);`
gilt nur, wenn entweder Zufall aktiv ist oder noch kein Pointer
gesetzt wurde. Anpassen:

**Vorher (Z. 225–227):**

```js
if (!sCurRec) {
  sCurRec = sPickRandom(pool, null);
}
```

**Nachher:**

```js
if (!sCurRec) {
  if (typeof plShuffle !== "undefined" && plShuffle) {
    sCurRec = sPickRandom(pool, null);
  } else {
    // sequentiell: erstes Item der Sequenz nach aktueller Auswahl.
    const seq = (spkSel && spkSel !== "any")
      ? sBuildRecordingPool(spkSel)
      : sBuildSequencePool();
    sCurRec = seq.length ? seq[0] : sPickRandom(pool, null);
  }
}
```

**`sNext` und neue `sPrev` (Z. 233–244 ersetzen durch):**

```js
function sNext() {
  if (!sLoaded) return;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();

  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  const newRec = useRandom ? sPickRandom(pool, sCurRec) : sSeqStep(+1);
  if (newRec) {
    if (sCurRec) sPrevRec = sCurRec;  // Memory pflegen
    sCurRec = newRec;
  }
  sActive = true;
  sPlayCurrent();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

function sPrev() {
  if (!sLoaded) return;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();

  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  let target = null;
  if (useRandom) {
    if (sPrevRec) {
      target = sPrevRec;
      sPrevRec = null;       // 1x-Memory verbraucht
    }
  } else {
    target = sSeqStep(-1);
  }
  if (target) {
    sCurRec = target;
    sActive = true;
    sPlayCurrent();
  }
  if (typeof plUpdDisplay === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}
```

### 3d — `sOnEnded`-Auto-Advance-Pfad (`js/sentences.js`)

In `sOnEnded` (Z. 263–303) den Auto-Advance-Block (Z. 284–299) so
anpassen, daß im sequentiellen Modus nicht mehr per Zufall, sondern
per `sSeqStep(+1)` weitergeschaltet wird:

**Vorher (Z. 283–299):**

```js
// Auto-Advance: anderen zufaelligen Satz waehlen
if (typeof plAutoAdvance !== "undefined" && plAutoAdvance) {
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sStop(); return; }
  sCurRec = sPickRandom(pool, sCurRec);
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  if (ms > 0) {
    sPauseTimer = setTimeout(function () {
      sPauseTimer = null;
      if (sActive && plAutoAdvance && !plLoop) sPlayCurrent();
    }, ms);
  } else {
    sPlayCurrent();
  }
  return;
}
```

**Nachher:**

```js
// Auto-Advance: naechster Satz gemaess Zufall/Sequenz
if (typeof plAutoAdvance !== "undefined" && plAutoAdvance) {
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sStop(); return; }
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  const newRec = useRandom ? sPickRandom(pool, sCurRec) : sSeqStep(+1);
  if (newRec) {
    if (sCurRec) sPrevRec = sCurRec;
    sCurRec = newRec;
  }
  const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
  if (ms > 0) {
    sPauseTimer = setTimeout(function () {
      sPauseTimer = null;
      if (sActive && plAutoAdvance && !plLoop) sPlayCurrent();
    }, ms);
  } else {
    sPlayCurrent();
  }
  return;
}
```

### 3e — `plPrev` in `js/player.js` ruft `sPrev` (`js/player.js`)

In `plPrev` (Z. 1111–1134) den Sätze-Zweig anpassen:

**Vorher (Z. 1112–1115):**

```js
if (plActiveSource === "sentences" && typeof sNext === "function") {
  sNext();
  return;
}
```

**Nachher:**

```js
if (plActiveSource === "sentences" && typeof sPrev === "function") {
  sPrev();
  return;
}
```

(`plNext` bleibt — er ruft weiterhin `sNext()`.)

## Schritt 4 — Geräusche: Memory + Zufall

### 4a — Memory-Variable + Helper (`js/player.js`)

Direkt **vor** `function _plNoiseStep` (Z. 1092) einfügen:

```js
let _plNoisePrevId = null;     // BA258: 1x-Memory fuer Zufall-Zurueck

function plNoiseHasPrevMemory() {
  return !!_plNoisePrevId;
}
```

### 4b — `_plNoiseStep` mit Zufall + Memory (`js/player.js`)

Aktuelle Funktion (Z. 1092–1109):

**Vorher:**

```js
function _plNoiseStep(delta) {
  const all = amCollectItems("geraeusche");
  const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
  if (sorted.length === 0) return;
  const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
  const nextIdx = (idx + delta + sorted.length) % sorted.length;
  const nextItem = sorted[nextIdx];
  if (!nextItem) return;
  plNoiseSelectedId = nextItem.id;
  const sel = document.getElementById("plNoiseItemSel");
  if (sel) sel.value = nextItem.id;
  const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
  if (wasPlaying && typeof pPause === "function") pPause();
  plNoiseLoadSelected().then(function () {
    if (wasPlaying && typeof pPlay === "function") pPlay();
  });
}
```

**Nachher:**

```js
function _plNoiseStep(delta) {
  const all = amCollectItems("geraeusche");
  const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
  if (sorted.length === 0) return;
  const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });

  let nextItem = null;
  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);

  if (useRandom) {
    if (delta < 0) {
      // Zurueck: Memory verbrauchen, falls vorhanden.
      if (_plNoisePrevId) {
        nextItem = sorted.find(function (x) { return x.id === _plNoisePrevId; });
        _plNoisePrevId = null;
      }
      if (!nextItem) return;
    } else {
      // Vorwaerts: zufaelliges anderes Item.
      if (sorted.length === 1) { nextItem = sorted[0]; }
      else {
        let pick;
        do {
          pick = sorted[Math.floor(Math.random() * sorted.length)];
        } while (pick.id === plNoiseSelectedId);
        nextItem = pick;
      }
      _plNoisePrevId = plNoiseSelectedId;
    }
  } else {
    // Sequenz mit Wrap-around.
    const nextIdx = (idx + delta + sorted.length) % sorted.length;
    nextItem = sorted[nextIdx];
  }
  if (!nextItem) return;

  plNoiseSelectedId = nextItem.id;
  const sel = document.getElementById("plNoiseItemSel");
  if (sel) sel.value = nextItem.id;
  const wasPlaying = (typeof pPlaying !== "undefined") ? pPlaying : false;
  if (wasPlaying && typeof pPause === "function") pPause();
  plNoiseLoadSelected().then(function () {
    if (wasPlaying && typeof pPlay === "function") pPlay();
  });
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}
```

### 4c — Auto-Advance bei Geräuschen (`js/player.js`)

In dem Auto-Advance-Pfad bei Geräuschen (Z. 587–604) den Auswahl-
Block auf Zufall vs. Sequenz umstellen:

**Vorher (innerhalb des setTimeout-Callbacks, Z. 590–598):**

```js
const all = amCollectItems("geraeusche");
const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
if (sorted.length === 0) return;
const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
const next = sorted[(idx + 1) % sorted.length];
if (!next) return;
plNoiseSelectedId = next.id;
const sel = document.getElementById("plNoiseItemSel");
if (sel) sel.value = next.id;
```

**Nachher:**

```js
const all = amCollectItems("geraeusche");
const sorted = amSortItems(all, "geraeusche", plNoiseSortAxis);
if (sorted.length === 0) return;
const idx = sorted.findIndex(function (x) { return x.id === plNoiseSelectedId; });
let next;
if (typeof plShuffle !== "undefined" && plShuffle) {
  if (sorted.length === 1) { next = sorted[0]; }
  else {
    let pick;
    do {
      pick = sorted[Math.floor(Math.random() * sorted.length)];
    } while (pick.id === plNoiseSelectedId);
    next = pick;
  }
  _plNoisePrevId = plNoiseSelectedId;
} else {
  next = sorted[(idx + 1) % sorted.length];
}
if (!next) return;
plNoiseSelectedId = next.id;
const sel = document.getElementById("plNoiseItemSel");
if (sel) sel.value = next.id;
```

## Schritt 5 — Hörbücher: Memory + Zufall-Kapitel

### 5a — Memory-Variable + Helper (`js/player.js`)

Direkt **nach** `let _plNoisePrevId = null;` aus Schritt 4a ergänzen:

```js
let _plBookPrevChIdx = null;   // BA258: 1x-Memory fuer Zufall-Zurueck bei Hoerbuechern

function plBookHasPrevMemory() {
  return _plBookPrevChIdx != null;
}
```

### 5b — Hörbuch-Prev/Next in `plPrev`/`plNext` (`js/player.js`)

**`plPrev` (Z. 1116–1125) — Audiobook-Zweig ersetzen:**

```js
if (plActiveSource === "audiobook") {
  const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
  if (!col || !col.items) return;
  if (typeof plBookSavePosition === "function") plBookSavePosition();

  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  if (useRandom) {
    if (_plBookPrevChIdx == null) return;
    plBookChapterIdx = _plBookPrevChIdx;
    _plBookPrevChIdx = null;
  } else {
    plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
  }
  const sel = document.getElementById("plBookChSel");
  if (sel) sel.value = String(plBookChapterIdx);
  if (typeof plBookLoadSelected === "function") plBookLoadSelected();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  return;
}
```

**`plNext` (Z. 1141–1149) — Audiobook-Zweig ersetzen:**

```js
if (plActiveSource === "audiobook") {
  const col = (typeof plBookCurrentCollection === "function") ? plBookCurrentCollection() : null;
  if (!col || !col.items) return;
  if (typeof plBookSavePosition === "function") plBookSavePosition();

  const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
  if (useRandom) {
    if (col.items.length > 1) {
      _plBookPrevChIdx = plBookChapterIdx;
      let pick;
      do {
        pick = Math.floor(Math.random() * col.items.length);
      } while (pick === plBookChapterIdx);
      plBookChapterIdx = pick;
    }
  } else {
    plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
  }
  const sel = document.getElementById("plBookChSel");
  if (sel) sel.value = String(plBookChapterIdx);
  if (typeof plBookLoadSelected === "function") plBookLoadSelected();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  return;
}
```

### 5c — Auto-Advance bei Hörbüchern (`js/player.js`)

Im Auto-Advance-Pfad für Hörbücher (Z. 607–627) den nächsten Kapitel-
Index Zufall-/Sequenz-abhängig wählen:

**Vorher (Z. 608–625):**

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
  if (col && Array.isArray(col.items) && col.items.length > 0) {
    const useRandom = (typeof plShuffle !== "undefined" && plShuffle);
    let next;
    if (useRandom) {
      if (col.items.length === 1) { next = 0; }
      else {
        let pick;
        do {
          pick = Math.floor(Math.random() * col.items.length);
        } while (pick === plBookChapterIdx);
        next = pick;
      }
    } else {
      next = plBookChapterIdx + 1;
      if (next >= col.items.length) next = -1;  // -1 = Buchende, still anhalten
    }
    if (next >= 0) {
      setTimeout(function () {
        if (!plAutoAdvance || plLoop) return;
        if (typeof plBookSavePosition === "function") plBookSavePosition();
        if (useRandom) _plBookPrevChIdx = plBookChapterIdx;
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

## Schritt 6 — Spec-Update (`docs/spec/06-player.md`)

1. Im Persistenz-Block (etwa Z. 79–83) `plShuffle` in die Aufzählung
   ergänzen.
2. In der Wiedergabe-Card-Beschreibung (etwa Z. 17–42) die bisherige
   Notiz „Shuffle-Button ab BA 213 sichtbar, aber noch nicht
   funktional — Click-Handler und i18n folgen in BA 214." **löschen**
   und durch eine vollständige Beschreibung ersetzen:

   ```
   - Zufall-Toggle (🎲): wirkt in allen Quellen (Sätze: pro Sprecher
     blockweise; Geräusche/Hörbücher: zufälliges Element).
     Bei Zufall aus = sequentiell durchs aktuelle Material.
     Zurück (⏮): im Zufall-Modus 1×-Memory zum zuletzt gespielten
     Stück (danach ausgegraut); im sequentiellen Modus echter
     Schritt zurück.
   ```

## Schritt 7 — i18n-Hinweis

Nur `i18n/de.js` wurde ergänzt (`plTipShuffle`). Andere Sprachdateien
unverändert; fehlende Keys fallen auf den deutschen Default zurück.

## Akzeptanztest

1. Hard-Reload (Ctrl+Shift+R). Reiter „Player", Quelle „Sätze".
2. Zufall-Knopf 🎲 sichtbar; Default **grau** (aus).
3. Play drücken. → Erwartet: erster Satz von Thorsten (= erster
   Sprecher in der Liste, erste Aufnahme nach `recording.id`).
4. Mehrfach „Next" klicken. → Erwartet: nächste Aufnahmen desselben
   Sprechers in id-Reihenfolge; nach dem letzten Thorsten-Eintrag
   wechselt es zum nächsten Sprecher.
5. „Prev" klicken. → Erwartet: vorheriger Satz in derselben
   Sequenz.
6. Zufall-Knopf 🎲 klicken → grün/aktiv. Mehrfach „Next" klicken. →
   Erwartet: jedes Mal ein zufälliger anderer Satz.
7. „Prev" klicken. → Erwartet: der direkt vorherige Satz (Memory-
   Eintrag); Prev-Knopf wird danach **grau**.
8. „Prev" zweimal direkt hintereinander klicken (ohne zwischendurch
   Next/Play). → Erwartet: der erste Klick lädt das Memory-Stück,
   der zweite Klick passiert nichts mehr (Knopf grau).
9. Quelle auf „Geräusche" wechseln, Zufall **an**. „Next" mehrfach.
   → Erwartet: zufällige andere Geräusche. „Prev" → Memory-
   Geräusch.
10. Zufall **aus**, „Next" mehrfach. → Erwartet: nächstes in
    Sortier-Reihenfolge mit Wrap-around (wie bisher).
11. Quelle auf „Hörbücher", ein Buch geladen, Zufall **an**.
    „Next" mehrfach. → Erwartet: zufälliges Kapitel im aktuellen
    Buch. „Prev" → Memory-Kapitel.
12. Auto-Advance einschalten, Sätze, Zufall **aus**. Wiedergabe bis
    Satz-Ende laufen lassen. → Erwartet: nächster Satz in Sequenz.
13. Auto-Advance, Zufall **an**. Wiedergabe bis Satz-Ende. →
    Erwartet: zufälliger anderer Satz.
14. F5 (normaler Reload). → Erwartet: Zufall-Toggle-Zustand
    wiederhergestellt (localStorage).
15. JSON-Save+Load: `plShuffle` ist enthalten und wird wiederher-
    gestellt.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
mit Datei/Zeile zitieren. Besonders:

- Punkt 4 (sequentiell pro Sprecher) → `js/sentences.js` Z. von
  `sBuildSequencePool` zitieren; bestätigen, daß die Sortier-
  Reihenfolge (DE zuerst, Speaker-Reihenfolge stabil, recording.id
  innerhalb) tatsächlich so umgesetzt ist.
- Punkt 7/8 (1×-Memory) → `js/sentences.js` Z. von `sPrev` (Setzen
  `sPrevRec = null` nach Verbrauch) und `plUpdTransportUI` Z. der
  Prev-Disable-Logik zitieren.
- Punkt 11 (Hörbuch-Zufall) → `js/player.js` Z. von `plNext`
  Audiobook-Zweig und `_plBookPrevChIdx`-Memory zitieren.
- Punkt 14/15 (Persistenz) → `state-side.js`, `file.js` (3 Stellen)
  zitieren.
