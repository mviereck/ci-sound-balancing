# Bauanleitung 195 — Hörbuch-Quelle aktivieren

**Versionsbump:** `js/version.js` von `"3.2.194-beta"` (oder aktuellem
194-Fix-Stand) auf `"3.2.195-beta"`.

**Voraussetzung:** BA 194 muss durchgebaut sein. Diese BA nutzt das
Provider-System aus `js/audio-source.js` (BA 193) und erweitert es um
die Collection-Ebene.

## Ziel

Hörbücher als vierte Audioquelle aktivieren. In dieser BA:

- **User-Upload eines Hörbuch-Ordners** mit nummerierten Audiodateien
  (z.B. `01_kapitel1.mp3`, `02_kapitel2.mp3`). Pro Ordner = ein Buch,
  Dateien = Kapitel in alphabetischer Reihenfolge.
- **Hörbuch-Sub-Block** mit drei Dropdowns: Sortierung, Hörbuch-Auswahl
  (Collection), Kapitel-Auswahl (Item).
- **Auto-Advance** spielt Kapitel-für-Kapitel durch, stoppt am Buch-Ende.
- **Loop** wirkt auf Kapitel-Ebene (Kapitel wiederholt sich).
- **Positions-Persistenz pro Hörbuch:** zuletzt aktives Kapitel und
  Wiedergabe-Sekunde werden beim Buch-Wechsel und Stop gespeichert,
  beim Wieder-Auswählen wiederhergestellt.

**Nicht in dieser BA:**
- m4b-Dateien mit Chapter-Tags: brauchen mp4-Atom-Parsing
  (z. B. mp4box.js), eigene BA wert.
- Webspace-Hörbücher: kommen mit BA 196 (allgemeiner Manifest-Loader).

**Bekannte Einschränkung:** Hörbuch-Kapitel werden komplett in einen
AudioBuffer dekodiert. Bei 30 Minuten / 128 kbps mp3 sind das ~30 MB
RAM-Footprint pro Kapitel. Streaming-Wiedergabe wäre die saubere
Lösung, erfordert aber Umbau der Pipeline auf MediaElement +
ScriptProcessor — eigene BA.

## Schritt 1: `audio-source.js` um Collection-Ebene erweitern

In BA 193 liefert das Provider-System nur Items (flach). Hörbücher
brauchen die Collection-Ebene: ein Buch = eine Collection mit
Kapitel-Items.

In `js/audio-source.js` am Ende ergänzen:

```js
// ============================================================
// Collection-Ebene (BA195)
// ============================================================

// Sortier-Achsen pro Kategorie auf Collection-Ebene.
const AM_COLLECTION_SORT_AXES = {
  hoerbuecher: [
    {
      key: "author",
      labelKey: "amBookSortAuthor",
      labelDefault: "nach Autor",
      getter: function (c) {
        return (c.tags && c.tags.work_author) || "zzz-unbekannt";
      }
    },
    {
      key: "genre",
      labelKey: "amBookSortGenre",
      labelDefault: "nach Genre",
      getter: function (c) {
        const g = c.tags && c.tags.genres;
        return Array.isArray(g) && g.length > 0 ? g[0] : "zzz-unbekannt";
      }
    },
    {
      key: "lang",
      labelKey: "amBookSortLang",
      labelDefault: "nach Sprache",
      getter: function (c) {
        return c.lang || "zzz-unbekannt";
      }
    },
    {
      key: "reader",
      labelKey: "amBookSortReader",
      labelDefault: "nach Sprecher",
      getter: function (c) {
        return (c.tags && c.tags.reader) || "zzz-unbekannt";
      }
    },
    {
      key: "title",
      labelKey: "amBookSortTitle",
      labelDefault: "nach Titel",
      getter: function (c) {
        return (c.title || "zzz-unbekannt").toLowerCase();
      }
    }
  ]
};

function amCollectionSortAxesFor(category) {
  return AM_COLLECTION_SORT_AXES[category] || [];
}

function amCollectCollections(category) {
  const out = [];
  for (const p of AM_PROVIDERS) {
    if (typeof p.listCollections !== "function") continue;
    try {
      const cols = p.listCollections(category);
      if (Array.isArray(cols)) {
        for (const c of cols) {
          if (!c) continue;
          c._providerId = p.id;
          out.push(c);
        }
      }
    } catch (e) {
      console.warn("[audio-source] provider " + p.id + " listCollections warf:", e);
    }
  }
  return out;
}

function amSortCollections(collections, category, axisKey) {
  const axes = amCollectionSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; }) || axes[0];
  if (!axis) return collections.slice();
  const arr = collections.slice();
  arr.sort(function (a, b) {
    const va = axis.getter(a), vb = axis.getter(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    const ta = (a.title || "").toLowerCase();
    const tb = (b.title || "").toLowerCase();
    return ta < tb ? -1 : (ta > tb ? 1 : 0);
  });
  return arr;
}
```

## Schritt 2: Lokaler Hörbuch-Provider

In `js/audio-source.js` weiter unten:

```js
// ============================================================
// Provider: lokale Hoerbuch-Uploads (BA195)
// ============================================================

const _amLocalBookCollections = []; // Array<Collection>

function amAddLocalBookCollection(col) {
  if (!col || col.category !== "hoerbuecher") return;
  _amLocalBookCollections.push(col);
}

function amRemoveLocalBookCollection(id) {
  const idx = _amLocalBookCollections.findIndex(function (c) { return c.id === id; });
  if (idx >= 0) {
    const removed = _amLocalBookCollections[idx];
    // Audio-Blob-URLs sauber freigeben
    for (const it of (removed.items || [])) {
      if (it.audio && it.audio.indexOf("blob:") === 0) {
        try { URL.revokeObjectURL(it.audio); } catch (e) {}
      }
    }
    _amLocalBookCollections.splice(idx, 1);
  }
}

amRegisterProvider({
  id: "local-books",
  listItems: function (category) {
    return []; // Hoerbuecher werden auf Collection-Ebene angeboten, nicht als flache Items
  },
  listCollections: function (category) {
    if (category !== "hoerbuecher") return [];
    return _amLocalBookCollections.slice();
  }
});
```

## Schritt 3: HTML — Hörbuch-Sub-Block aktivieren und Top-Toggle freischalten

In `index.html` den Hörbuch-Platzhalter aus BA 192 ersetzen:

```html
<div id="plSubAudiobook" class="pl-subblock" style="margin-bottom:12px; display:none">
  <div class="controls-row" style="gap:8px; flex-wrap:wrap; margin-bottom:6px">
    <button class="btn btn-sm" id="plBookUploadBtn" type="button" style="font-size:0.85em">
      <span data-t="plBookUpload"></span>
    </button>
    <input type="file" id="plBookUploadInput" webkitdirectory multiple style="display:none" />
    <span id="plBookUploadHint" style="font-size:0.78em;color:var(--text-muted)" data-t="plBookUploadHint"></span>
  </div>

  <div class="controls-row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
    <div class="control-group">
      <label data-t="plBookSortLabel" style="margin-right:6px"></label>
      <select id="plBookSortSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
      </select>
    </div>
  </div>

  <div class="controls-row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
    <div class="control-group" style="flex:1; min-width:240px">
      <label data-t="plBookSelLabel" style="margin-right:6px"></label>
      <select id="plBookSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em; min-width:240px">
      </select>
      <button class="btn btn-sm" id="plBookRemoveBtn" type="button"
              style="margin-left:6px; font-size:0.82em" data-t="plBookRemove"></button>
    </div>
  </div>

  <div class="controls-row" style="gap:8px;flex-wrap:wrap;margin-bottom:6px">
    <div class="control-group" style="flex:1; min-width:240px">
      <label data-t="plBookChapterLabel" style="margin-right:6px"></label>
      <select id="plBookChSel"
              style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em; min-width:240px">
      </select>
    </div>
  </div>

  <div id="plBookEmpty" class="explain"
       style="display:none;font-size:0.85em;color:var(--text-muted)"
       data-t="plBookEmpty"></div>
</div>
```

Den Top-Toggle-Button **enabled** machen (Disabled-Attribut + dim-Styles entfernen):

```html
<button id="plSrcAudiobookBtn" class="btn btn-sm"
        style="font-weight: 600; min-width: 140px; border-radius: 6px"
        data-t="plSrcAudiobook"></button>
```

## Schritt 4: i18n-Strings in `i18n/de.js`

```js
plBookUpload: "+ Hörbuch-Ordner laden",
plBookUploadHint: "Ordner mit nummerierten Kapitel-Dateien wählen (z. B. 01_*.mp3).",
plBookSortLabel: "Sortierung:",
plBookSelLabel: "Hörbuch:",
plBookChapterLabel: "Kapitel:",
plBookRemove: "×",
plBookEmpty: "Noch kein Hörbuch geladen. Klicke „+ Hörbuch-Ordner laden", um eines zu öffnen.",
plAudiobookComingSoon: "(unused, ersetzt durch plBookEmpty)",
amBookSortAuthor: "nach Autor",
amBookSortGenre: "nach Genre",
amBookSortLang: "nach Sprache",
amBookSortReader: "nach Sprecher",
amBookSortTitle: "nach Titel",
```

## Schritt 5: State + Persistenz

### 5a. `js/state-side.js`

```js
let plBookSelectedId = null;       // Collection-ID des aktuellen Buchs
let plBookChapterIdx = 0;          // Index des aktuellen Kapitels
let plBookSortAxis   = "author";   // Sortierachse
let plBookPositions  = {};         // { <bookId>: { chapterIdx, posSeconds } }
let pBookBuf         = null;       // dekodierter Kapitel-Buffer (Laufzeit, nicht persistiert)
```

### 5b. `js/file.js` und `js/init.js`

Reset / Save / Restore für `plBookSelectedId`, `plBookChapterIdx`,
`plBookSortAxis`, `plBookPositions` analog zu BA 192/193/194.

**Wichtig:** `plBookPositions` ist ein Objekt — beim Restore mit
`Object.assign({}, ...)` rekonstruieren, nicht einfach Referenz
übernehmen.

User-hochgeladene Hörbuch-Sammlungen selbst werden **nicht**
persistiert (Blob-URLs überleben Reload nicht; siehe lokale Sätze-
Sammlungen aus BA 192). Aber Positions-Daten pro Buch-ID bleiben, sodaß
beim erneuten Hochladen desselben Ordners (Sammlungs-ID-Schema siehe
Schritt 6) die Position wieder greift.

## Schritt 6: Hörbuch-Upload-Logik in `js/player.js`

```js
// ============================================================
// BA195: Hoerbuch-Quelle (lokal)
// ============================================================

const AM_AUDIO_EXT = /\.(mp3|wav|flac|ogg|opus|m4a|m4b|mp4)$/i;

async function plBookHandleUpload(fileList) {
  const files = Array.from(fileList || []).filter(function (f) {
    return AM_AUDIO_EXT.test(f.name);
  });
  if (files.length === 0) {
    alert(t("plBookUploadNoAudio") || "Keine Audiodateien gefunden.");
    return;
  }
  // Alphabetisch nach Dateinamen-Endung-frei sortieren
  files.sort(function (a, b) {
    const na = a.webkitRelativePath || a.name;
    const nb = b.webkitRelativePath || b.name;
    return na < nb ? -1 : (na > nb ? 1 : 0);
  });

  // Ordnernamen als Buch-Titel verwenden (oberster Pfad-Teil)
  const firstPath = files[0].webkitRelativePath || files[0].name;
  const folderName = (firstPath.indexOf("/") >= 0)
    ? firstPath.split("/")[0]
    : "Hörbuch";

  const bookId = "local-book:" + folderName + ":" + files.length;
  // Falls schon vorhanden, vorherigen Eintrag ersetzen (Blob-URLs freigeben)
  if (typeof amRemoveLocalBookCollection === "function") {
    amRemoveLocalBookCollection(bookId);
  }

  const items = files.map(function (f, i) {
    return {
      id: bookId + "#ch" + String(i + 1).padStart(3, "0"),
      title: f.name.replace(/\.[^.]+$/, ""),
      audio: URL.createObjectURL(f),
      duration: null,
      tags: { chapter_no: i + 1 }
    };
  });

  const collection = {
    schema: "ci-sb-corpus/2",
    kind: "collection",
    category: "hoerbuecher",
    id: bookId,
    title: folderName,
    lang: null,
    tags: { reader: null, work_author: null, genres: [] },
    items: items,
    _isLocal: true
  };

  amAddLocalBookCollection(collection);
  plBookSelectedId = bookId;
  plBookChapterIdx = 0;
  plBookRefreshUI();
}

function plBookCurrentCollection() {
  const all = (typeof amCollectCollections === "function")
    ? amCollectCollections("hoerbuecher") : [];
  return all.find(function (c) { return c.id === plBookSelectedId; }) || null;
}

function plBookCurrentChapter() {
  const col = plBookCurrentCollection();
  if (!col || !col.items || col.items.length === 0) return null;
  const idx = Math.max(0, Math.min(plBookChapterIdx, col.items.length - 1));
  return col.items[idx];
}

function plBookRefreshUI() {
  const sortSel = document.getElementById("plBookSortSel");
  const bookSel = document.getElementById("plBookSel");
  const chSel   = document.getElementById("plBookChSel");
  const empty   = document.getElementById("plBookEmpty");
  if (!sortSel || !bookSel || !chSel) return;

  // Sortier-Achsen
  const axes = (typeof amCollectionSortAxesFor === "function")
    ? amCollectionSortAxesFor("hoerbuecher") : [];
  if (sortSel.options.length === 0) {
    for (const a of axes) {
      const opt = document.createElement("option");
      opt.value = a.key;
      opt.textContent = (typeof t === "function") ? t(a.labelKey) : a.labelDefault;
      sortSel.appendChild(opt);
    }
  }
  sortSel.value = plBookSortAxis;

  // Hoerbuch-Liste
  const all = (typeof amCollectCollections === "function")
    ? amCollectCollections("hoerbuecher") : [];
  const sorted = (typeof amSortCollections === "function")
    ? amSortCollections(all, "hoerbuecher", plBookSortAxis)
    : all;

  while (bookSel.firstChild) bookSel.removeChild(bookSel.firstChild);
  for (const c of sorted) {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title || c.id;
    bookSel.appendChild(opt);
  }
  if (sorted.find(function (c) { return c.id === plBookSelectedId; })) {
    bookSel.value = plBookSelectedId;
  } else if (sorted.length > 0) {
    plBookSelectedId = sorted[0].id;
    bookSel.value = plBookSelectedId;
  } else {
    plBookSelectedId = null;
  }

  // Kapitel-Liste
  while (chSel.firstChild) chSel.removeChild(chSel.firstChild);
  const col = plBookCurrentCollection();
  if (col && Array.isArray(col.items)) {
    for (let i = 0; i < col.items.length; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = (i + 1) + ". " + (col.items[i].title || ("Kapitel " + (i+1)));
      chSel.appendChild(opt);
    }
    if (plBookChapterIdx >= col.items.length) plBookChapterIdx = 0;
    chSel.value = String(plBookChapterIdx);
  }

  if (empty) empty.style.display = sorted.length === 0 ? "" : "none";

  // Anzeige-Block updaten
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

async function plBookLoadSelected() {
  const ch = plBookCurrentChapter();
  if (!ch) return;
  const ctx = gPC();
  // Kapitel-Audio laden — Blob-URL bei local, http(s) bei spaeterem Webspace
  let abuf = null;
  try {
    const r = await fetch(ch.audio);
    const ab = await r.arrayBuffer();
    abuf = await ctx.decodeAudioData(ab);
  } catch (e) {
    console.error("[book] Kapitel-Lade-Fehler:", e);
    alert("Kapitel konnte nicht geladen werden: " + e.message);
    return;
  }
  if (!abuf) return;

  pBookBuf = abuf;
  pSetPlaybackMode("book");
  document.getElementById("plTot").textContent = pFmt(pBuf ? pBuf.duration : 0);

  // Position wiederherstellen, falls vorhanden
  const pos = (plBookPositions && plBookPositions[plBookSelectedId]) || null;
  if (pos && typeof pos.chapterIdx === "number" && pos.chapterIdx === plBookChapterIdx
      && typeof pos.posSeconds === "number" && pos.posSeconds > 0
      && pos.posSeconds < abuf.duration - 5) {
    pOff = pos.posSeconds;
    document.getElementById("plCur").textContent = pFmt(pOff);
    document.getElementById("plTL").value = (pOff / abuf.duration) * 1000;
  } else {
    pOff = 0;
    document.getElementById("plCur").textContent = "0:00";
    document.getElementById("plTL").value = 0;
  }

  if (typeof plUpdDisplay     === "function") plUpdDisplay();
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
  pBuildEQ();
  pDrawEQ();
  pBuildTbl();
  document.getElementById("plEqViz").style.display = "";
  if (typeof pWarpOn !== "undefined" && pWarpOn) {
    if (typeof pWarpTrigger === "function") pWarpTrigger();
  }
}

function plBookSavePosition() {
  if (!plBookSelectedId || !plBookCurrentChapter()) return;
  const cur = (typeof pCtx !== "undefined" && pCtx && pPlaying)
    ? (pCtx.currentTime - pT0)
    : pOff;
  plBookPositions[plBookSelectedId] = {
    chapterIdx: plBookChapterIdx,
    posSeconds: Math.max(0, cur)
  };
}

// Listener-Verkabelung (am Ende von player.js):
const _plBookUpBtn = document.getElementById("plBookUploadBtn");
const _plBookUpInp = document.getElementById("plBookUploadInput");
const _plBookSortS = document.getElementById("plBookSortSel");
const _plBookSelS  = document.getElementById("plBookSel");
const _plBookChS   = document.getElementById("plBookChSel");
const _plBookRmBtn = document.getElementById("plBookRemoveBtn");

if (_plBookUpBtn && _plBookUpInp) {
  _plBookUpBtn.addEventListener("click", function () { _plBookUpInp.click(); });
  _plBookUpInp.addEventListener("change", function (e) {
    plBookHandleUpload(e.target.files);
    e.target.value = "";
  });
}
if (_plBookSortS) {
  _plBookSortS.addEventListener("change", function () {
    plBookSortAxis = _plBookSortS.value;
    plBookRefreshUI();
  });
}
if (_plBookSelS) {
  _plBookSelS.addEventListener("change", function () {
    // Aktuelle Position des bisherigen Buchs speichern
    plBookSavePosition();
    plBookSelectedId = _plBookSelS.value;
    // chapterIdx aus der gemerkten Position laden, sonst 0
    const pos = plBookPositions && plBookPositions[plBookSelectedId];
    plBookChapterIdx = (pos && typeof pos.chapterIdx === "number") ? pos.chapterIdx : 0;
    plBookRefreshUI();
    if (plActiveSource === "audiobook") plBookLoadSelected();
  });
}
if (_plBookChS) {
  _plBookChS.addEventListener("change", function () {
    plBookSavePosition();
    plBookChapterIdx = parseInt(_plBookChS.value, 10) || 0;
    if (typeof plUpdDisplay === "function") plUpdDisplay();
    if (plActiveSource === "audiobook") plBookLoadSelected();
  });
}
if (_plBookRmBtn) {
  _plBookRmBtn.addEventListener("click", function () {
    if (!plBookSelectedId) return;
    if (!confirm(t("plBookRemoveConfirm") || "Diese Hörbuch-Auswahl entfernen?")) return;
    const id = plBookSelectedId;
    delete plBookPositions[id];
    if (typeof amRemoveLocalBookCollection === "function") amRemoveLocalBookCollection(id);
    plBookSelectedId = null;
    plBookChapterIdx = 0;
    plBookRefreshUI();
  });
}
```

i18n-Ergänzung für die zwei Confirm-/Alert-Texte:

```js
plBookUploadNoAudio: "Keine Audiodateien im Ordner gefunden.",
plBookRemoveConfirm: "Diese Hörbuch-Auswahl entfernen? Die Originaldateien auf der Festplatte bleiben unberührt.",
```

## Schritt 7: Player-Pipeline-Modus "book"

### 7a. `pSetPlaybackMode` in `js/player.js` erweitern

In Anlehnung an BA 193 (Modus "noise") jetzt einen weiteren Modus:

```js
function pSetPlaybackMode(mode) {
  if (!["file", "sentence", "noise", "book"].includes(mode)) return;
  pPlaybackMode = mode;
  if (mode === "file") {
    pSourceBuf = pFileBuf;
  } else if (mode === "sentence") {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  } else if (mode === "noise") {
    pSourceBuf = (typeof pNoiseBuf !== "undefined") ? pNoiseBuf : null;
  } else { // book
    pSourceBuf = (typeof pBookBuf !== "undefined") ? pBookBuf : null;
  }
  pMonoBuf = null;
  pLeftOnlyBuf = null;
  pRightOnlyBuf = null;
  if (typeof pWarpedBuf !== "undefined") {
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (pSourceBuf) {
    pBuf = getPlaybackBuffer();
    pBuildEQ();
  } else {
    pBuf = null;
  }
}
```

### 7b. Auto-Advance bei Hörbüchern in `pPlay`-`onended`

In Anlehnung an BA 193 (Auto-Advance bei Geräuschen) jetzt einen
zweiten Hook im `onended`-Pfad:

```js
// BA195: Auto-Advance bei Hoerbuechern (Kapitel-fuer-Kapitel)
if (plActiveSource === "audiobook" && plAutoAdvance && !plLoop) {
  const col = plBookCurrentCollection();
  if (col && Array.isArray(col.items)) {
    const next = plBookChapterIdx + 1;
    if (next < col.items.length) {
      const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
      setTimeout(function () {
        plBookSavePosition();
        plBookChapterIdx = next;
        const sel = document.getElementById("plBookChSel");
        if (sel) sel.value = String(next);
        // Position fuer neues Kapitel auf 0 zuruecksetzen, damit nicht
        // ein alter Restore-Punkt aus plBookPositions greift
        if (plBookPositions[plBookSelectedId]) {
          plBookPositions[plBookSelectedId].chapterIdx = next;
          plBookPositions[plBookSelectedId].posSeconds = 0;
        }
        plBookLoadSelected().then(function () {
          if (typeof pPlay === "function") pPlay();
        });
      }, ms);
    }
    // letztes Kapitel: still stoppen, kein Auto-Advance ueber Buch-Ende
  }
}
```

## Schritt 8: Zentrale Steuerung erweitern

### 8a. `plSetSource` — Audiobook freischalten

In BA 192 wurde `plSetSource("audiobook")` mit `return` blockiert. Diese
Sperre jetzt entfernen:

```js
function plSetSource(src) {
  if (!["music", "sentences", "noise", "audiobook"].includes(src)) return;
  if (src === plActiveSource) return;
  // Aktuelle Position des Hoerbuchs speichern, bevor wir wechseln
  if (plActiveSource === "audiobook") plBookSavePosition();
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  if (src === "noise") {
    plNoiseRefreshUI();
    plNoiseLoadSelected();
  } else if (src === "audiobook") {
    plBookRefreshUI();
    if (plBookSelectedId) plBookLoadSelected();
  }
  plUpdDisplay();
}
```

### 8b. `plUpdSourceUI` — Audiobook-Button nicht mehr immer aus

```js
setActive(btnA, plActiveSource === "audiobook");
```

### 8c. `plUpdDisplay` — Audiobook-Zweig

In der Funktion (aus BA 192/193) einen Zweig für Hörbücher ergänzen:

```js
} else if (plActiveSource === "audiobook") {
  const col = plBookCurrentCollection();
  const ch  = plBookCurrentChapter();
  if (col && ch) {
    titleText = (ch.title || "Kapitel") + " — " + (col.title || "");
    const parts = [];
    if (col.tags && col.tags.work_author) parts.push(col.tags.work_author);
    if (col.tags && col.tags.reader)      parts.push("Sprecher: " + col.tags.reader);
    if (col.lang)                          parts.push(col.lang);
    if (col.license)                       parts.push(col.license);
    metaParts = parts;
  } else {
    titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
  }
}
```

### 8d. `plPlayPauseToggle` und `plStopAll`

`plPlayPauseToggle` analog zu BA 193 für "noise" jetzt auch "audiobook":

```js
if (plActiveSource === "audiobook") {
  if (!pBookBuf || !pBuf) {
    plBookLoadSelected().then(function () {
      if (typeof pToggle === "function") pToggle();
    });
    return;
  }
  if (typeof pToggle === "function") pToggle();
  return;
}
```

`plStopAll` ergänzen: vor dem Stoppen die Buch-Position speichern.

```js
function plStopAll() {
  if (plActiveSource === "audiobook") plBookSavePosition();
  if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") sStop();
  if (typeof pStopReset === "function") pStopReset();
  _plAutoAdvCancel();
}
```

### 8e. `plPrev` / `plNext` für Hörbücher

Heute in BA 192/193: nur bei Sätzen sinnvoll. Jetzt auch bei Hörbüchern
für Kapitel-Sprung:

```js
function plPrev() {
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  if (plActiveSource === "audiobook") {
    const col = plBookCurrentCollection();
    if (!col || !col.items) return;
    plBookSavePosition();
    plBookChapterIdx = Math.max(0, plBookChapterIdx - 1);
    const sel = document.getElementById("plBookChSel");
    if (sel) sel.value = String(plBookChapterIdx);
    plBookLoadSelected();
    return;
  }
  if (typeof pStopReset === "function") { pStopReset(); if (typeof pToggle === "function") pToggle(); }
}

function plNext() {
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  if (plActiveSource === "audiobook") {
    const col = plBookCurrentCollection();
    if (!col || !col.items) return;
    plBookSavePosition();
    plBookChapterIdx = Math.min(col.items.length - 1, plBookChapterIdx + 1);
    const sel = document.getElementById("plBookChSel");
    if (sel) sel.value = String(plBookChapterIdx);
    plBookLoadSelected();
    return;
  }
}
```

In `plUpdTransportUI` die `hasNext`-Berechnung aktualisieren:

```js
const hasNext = (plActiveSource === "sentences" || plActiveSource === "audiobook");
```

## Schritt 9: Initialisierung

In `js/init.js` am Ende:

```js
if (typeof plBookRefreshUI === "function") plBookRefreshUI();
```

## Schritt 10: Doku

### 10a. `docs/CODESTRUKTUR.md`

`js/audio-source.js` — neu: Collection-Ebene (`amCollectCollections`,
`amSortCollections`, `AM_COLLECTION_SORT_AXES`), lokaler Hörbuch-
Provider mit `amAddLocalBookCollection` / `amRemoveLocalBookCollection`.

Hörbuch-Sub-Block beschreiben: Upload-Button, Sortier-Dropdown,
Hörbuch-Dropdown, Kapitel-Dropdown, Entfernen-Button.

### 10b. `docs/spec/06-player.md`

Im Aufbau-Abschnitt (BA 192) den Hörbuch-Punkt aktualisieren — nicht
mehr „ausgegraut", sondern:

```
- **Hörbücher:** Sub-Block mit Upload-Button (Ordner mit nummerierten
  Audio-Dateien), drei Dropdowns (Sortierung, Hörbuch, Kapitel) und
  Entfernen-Button. Auto-Advance spielt Kapitel-für-Kapitel; Stop am
  Buch-Ende. Loop wirkt auf Kapitel. Position-Persistenz pro Buch-ID
  in `plBookPositions`: zuletzt aktives Kapitel und Wiedergabe-Sekunde.
  Lokale User-Uploads sind ein Provider unter `audio-source.js`; ihre
  Blob-URLs überleben Reload nicht, ihre Position-Marker aber schon.
- Anzeige unter Transport: Kapitel-Titel — Buch-Titel · Autor · Sprecher
  · Sprache · Lizenz.
- Bekannte Einschränkung: m4b-Chapter-Tags werden in dieser BA nicht
  ausgewertet; m4b-Dateien werden wie eine einzelne lange Datei
  behandelt. Webspace-Hörbücher folgen mit BA 196.
```

## Schritt 11: Versionsbump

```js
const APP_VERSION = "3.2.195-beta";
```

## Akzeptanztest

1. Tool laden. Version `3.2.195-beta`. **Erwartet:** ✓
2. Quelle „Hörbücher" wählen (jetzt nicht mehr ausgegraut). Sub-Block
   sichtbar mit Upload-Button und drei (leeren) Dropdowns. Hinweis
   „Noch kein Hörbuch geladen" sichtbar. **Erwartet:** ✓
3. „+ Hörbuch-Ordner laden" klicken, einen Ordner mit nummerierten
   Audio-Dateien wählen. Ordnername erscheint als Hörbuch-Titel im
   Dropdown; Kapitel-Dropdown zeigt die Dateien in alphabetischer
   Reihenfolge. **Erwartet:** ✓
4. Anzeige-Block zeigt z.B. „01_kapitel1 — Buch-Ordnername". Meta-Zeile
   ist leer (keine Tags bei User-Upload). **Erwartet:** ✓
5. Play drücken: erstes Kapitel spielt. Slider läuft, Anzeige aktuell.
   **Erwartet:** ✓
6. ⏭ klicken: nächstes Kapitel beginnt. **Erwartet:** ✓
7. ⏮ klicken: vorheriges Kapitel beginnt. **Erwartet:** ✓
8. Stop drücken bei laufendem Kapitel 2 (z. B. nach 30 s).
   Quelle auf „Musik" wechseln, dann zurück auf „Hörbücher": Kapitel 2
   ist gewählt, Slider zeigt die gespeicherte Position. **Erwartet:** ✓
9. Play: Wiedergabe setzt an der gespeicherten Position fort.
   **Erwartet:** ✓
10. Loop (🔁) an, Play: aktuelles Kapitel wiederholt sich.
    **Erwartet:** ✓
11. Loop aus, Auto-Advance (↪) an, Play: Kapitel laufen
    nacheinander; nach dem letzten Kapitel stoppt der Player still.
    **Erwartet:** ✓
12. Sortier-Achse auf „nach Titel" umstellen: Reihenfolge der
    Hörbuch-Auswahl ändert sich (relevant ab dem zweiten geladenen
    Buch). **Erwartet:** ✓
13. „×" (Entfernen) klicken, mit Ja bestätigen: Hörbuch verschwindet
    aus der Liste, Positions-Daten dazu sind gelöscht. **Erwartet:** ✓
14. Save (JSON), Tool neu laden, Restore: Sortier-Achse, gewählte
    Hörbuch-ID (sofern Sammlung weiterhin vorhanden), Kapitel-Index
    und Positions-Map sind wiederhergestellt. Bei nicht mehr
    vorhandenen Sammlungen (lokale Uploads sind weg) zeigt das Dropdown
    den ersten verfügbaren Eintrag oder leer. **Erwartet:** ✓

## Selbstprüfungsauftrag

Jeden der 14 Punkte einzeln durchgehen. Zusätzlich prüfen:

- `js/audio-source.js`: enthält `amCollectCollections`,
  `amSortCollections`, `AM_COLLECTION_SORT_AXES.hoerbuecher`, sowie
  den `local-books`-Provider mit `listCollections`.
- In `index.html`: Top-Toggle-Button für Hörbücher hat `disabled`-
  Attribut entfernt, keine `opacity:0.5`-Styles mehr.
- `pSetPlaybackMode` akzeptiert `"book"` und setzt `pSourceBuf` aus
  `pBookBuf`.
- Auto-Advance-Hook in `pPlay.onended` läuft Kapitel-für-Kapitel und
  stoppt am Buch-Ende.
- `plBookSavePosition()` wird sicher vor jedem Wechsel aufgerufen
  (Quellenwechsel, Buch-Wechsel, Kapitel-Wechsel, Stop).
- `js/version.js` enthält `"3.2.195-beta"`.

## Folge-Bauanleitungen

- **BA 196:** Webspace-Manifest-Loader — aktiviert Sample-Geräusche,
  Webspace-Sätze und Webspace-Hörbücher über das vorhandene
  `audio.manifest/`-Schema.
- **BA 197:** Sätze auf neues Manifest umstellen, inklusive Titel-Fix.
- **BA 198:** i18n en/fr/es für alle Keys aus BA 192–197.
