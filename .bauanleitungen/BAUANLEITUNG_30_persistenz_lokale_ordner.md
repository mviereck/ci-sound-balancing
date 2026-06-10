# BAUANLEITUNG 30 — Persistenz lokaler Ordner (JSON + IndexedDB)

## Voraussetzung

Bauanleitung 28 und 29 sind abgeschlossen, beide Akzeptanztests
sind bestanden.

## Ziel

Lokale Audio-Sammlungen überleben einen Reload und werden im
JSON-Save/Load mit gespeichert. Hybrid-Strategie nach
Browser-Fähigkeit:

- **Chromium/Edge** (File System Access API verfügbar): zusätzlich
  zum bestehenden `webkitdirectory`-Picker bietet das Tool
  `showDirectoryPicker()` an. Der zurückgelieferte
  `FileSystemDirectoryHandle` wird in **IndexedDB** persistiert.
  Beim Restore: Tool holt den Handle, fragt den Browser per
  `requestPermission()` um Re-Permission (kurzer Browser-Dialog),
  liest dann ohne neue Auswahl direkt. Picker startet mit
  `startIn: <handle>` an der gespeicherten Stelle.
- **Firefox** (keine FSAA): Sammlung erscheint nach Reload als
  "(nicht geladen)" im Sprecher-Dropdown und in der Liste. Klick
  darauf öffnet den webkitdirectory-Picker; das Tool zeigt den
  Ordnernamen als Hinweis. Nach Auswahl wird Re-Identifikation
  per Heuristik versucht.

JSON enthält in beiden Fällen die Sammlungs-Metadaten (Label,
Sprache, kind, Ordnername, Dateianzahl, persistenz-spezifische
IDs). Audio-Daten werden nicht ins JSON serialisiert.

## Dateien

- `sentences.js` (Picker-Hybrid, IndexedDB, Restore, Stub-Sprecher)
- `file.js` (Save/Load-Felder)
- `i18n.js` (drei zusätzliche Strings je Sprache)
- `index.html` (zweiter Picker-Button für FSAA optional, siehe 3a)
- `CODESTRUKTUR.md`, `SPEC.md`

---

## Schritt 1 — i18n.js: Strings ergänzen

In allen vier Sprach-Blöcken, direkt nach den in Bauanleitung 29
eingefügten Schlüsseln:

### DE
```js
sentLocalReload: "Erneut wählen",
sentLocalNotLoaded: "(nicht geladen)",
sentLocalReloadHint: "Bitte den Ordner erneut wählen:",
```
### EN
```js
sentLocalReload: "Re-select",
sentLocalNotLoaded: "(not loaded)",
sentLocalReloadHint: "Please re-select the folder:",
```
### FR
```js
sentLocalReload: "Re-sélectionner",
sentLocalNotLoaded: "(non chargé)",
sentLocalReloadHint: "Veuillez re-sélectionner le dossier :",
```
### ES
```js
sentLocalReload: "Volver a seleccionar",
sentLocalNotLoaded: "(no cargado)",
sentLocalReloadHint: "Vuelve a seleccionar la carpeta:",
```

---

## Schritt 2 — sentences.js: IndexedDB-Wrapper

Neuer Block direkt nach den lokalen Heuristiken aus Bauanleitung 29
einfügen (vor den Builder-Funktionen):

```js
// ============================================================
// INDEXEDDB FÜR ORDNER-HANDLES (Chromium/Edge)
// ============================================================
// Schema:
//   DB "ciSoundBalancing", Store "folderHandles", key = handleId (String),
//   value = { handle: FileSystemDirectoryHandle, meta: {...} }

const S_IDB_NAME = "ciSoundBalancing";
const S_IDB_STORE = "folderHandles";
const S_IDB_VER = 1;

function sIdbOpen() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("no IndexedDB")); return; }
    const req = indexedDB.open(S_IDB_NAME, S_IDB_VER);
    req.onupgradeneeded = function () {
      const db = req.result;
      if (!db.objectStoreNames.contains(S_IDB_STORE)) {
        db.createObjectStore(S_IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function sIdbPut(key, value) {
  const db = await sIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(S_IDB_STORE, "readwrite");
    tx.objectStore(S_IDB_STORE).put(value, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function sIdbGet(key) {
  const db = await sIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(S_IDB_STORE, "readonly");
    const req = tx.objectStore(S_IDB_STORE).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function sIdbDel(key) {
  const db = await sIdbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(S_IDB_STORE, "readwrite");
    tx.objectStore(S_IDB_STORE).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

function sFsaaAvailable() {
  return typeof window.showDirectoryPicker === "function";
}
```

---

## Schritt 3 — Picker-Hybrid in sentences.js

### 3a) FSAA-Picker-Funktion (kein neuer Button in der UI)

Wir verzichten auf einen zweiten Button. Der vorhandene
"+ Lokalen Ordner laden" entscheidet intern, welcher Picker
geöffnet wird:

- FSAA verfügbar → `showDirectoryPicker()`
- sonst → bestehender `<input webkitdirectory>`-Pfad

Im `DOMContentLoaded`-Handler den existierenden Click-Handler des
Buttons (in Bauanleitung 29 Schritt 3h) ersetzen:

**Vor (Bauanleitung 29):**
```js
localAdd.addEventListener("click", function () {
  localInput.value = "";
  localInput.click();
});
```

**Nach:**
```js
localAdd.addEventListener("click", async function () {
  if (sFsaaAvailable()) {
    try {
      const handle = await window.showDirectoryPicker({
        id: "ci-sound-saetze",
        mode: "read",
        startIn: "music",
      });
      await sIngestFromHandle(handle, null);  // null = neuer Handle, IDB-Eintrag erzeugen
    } catch (err) {
      if (err && err.name !== "AbortError") {
        console.error("[sentences/local] picker failed:", err);
        // Fallback auf webkitdirectory bei unerwartetem Fehler
        localInput.value = "";
        localInput.click();
      }
    }
  } else {
    localInput.value = "";
    localInput.click();
  }
});
```

### 3b) Funktion `sIngestFromHandle` — File-List aus FSAA-Handle bauen

Nach `sIngestLocalFolder` ergänzen:

```js
// Liest rekursiv alle Dateien aus einem FileSystemDirectoryHandle und ruft
// sIngestLocalFolder mit einer FileList-ähnlichen Struktur auf. Setzt
// webkitRelativePath analog zum webkitdirectory-Verhalten.
async function sIngestFromHandle(rootHandle, handleId) {
  const files = [];
  async function walk(dirHandle, relPrefix) {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "file") {
        const f = await entry.getFile();
        // webkitRelativePath ist auf File-Instanzen schreibgeschützt;
        // wir wrappen mit einem Pseudo-File, das die Property liefert.
        const rel = relPrefix + name;
        try {
          Object.defineProperty(f, "webkitRelativePath", {
            value: rel, configurable: true,
          });
        } catch (e) {
          // Fallback: Klon-Objekt mit allen relevanten Properties
          const wrap = {
            name: f.name,
            size: f.size,
            type: f.type,
            lastModified: f.lastModified,
            webkitRelativePath: rel,
            arrayBuffer: () => f.arrayBuffer(),
            text: () => f.text(),
            slice: f.slice ? f.slice.bind(f) : undefined,
          };
          files.push(wrap);
          continue;
        }
        files.push(f);
      } else if (entry.kind === "directory") {
        await walk(entry, relPrefix + name + "/");
      }
    }
  }
  const rootName = rootHandle.name || "Ordner";
  await walk(rootHandle, rootName + "/");

  // Sammlungs-IDs werden im Ingest erzeugt. Damit wir hinterher
  // die Sammlungen mit dem Handle koppeln können, merken wir uns
  // die Anzahl vorher und greifen alle hinzugefügten Sammlungen ab.
  const before = new Set(sLocalCollections.keys());
  await sIngestLocalFolder(files);
  const newCids = [];
  for (const k of sLocalCollections.keys()) {
    if (!before.has(k)) newCids.push(k);
  }

  // Handle-ID erzeugen (falls noch keine) und an die neuen Sammlungen binden
  const hid = handleId || ("h-" + Date.now() + "-" + Math.floor(Math.random() * 1e6));
  try {
    await sIdbPut(hid, { handle: rootHandle });
  } catch (e) {
    console.warn("[sentences/local] IDB put failed:", e);
  }
  for (const cid of newCids) {
    const coll = sLocalCollections.get(cid);
    if (coll) {
      coll.handleId = hid;
      coll.persistable = true;
    }
  }
  sRefreshLocalList();
}
```

### 3c) Webkitdirectory-Pfad: gleicher Handle-Vermerk fehlt absichtlich

Sammlungen, die per `webkitdirectory` geladen wurden, haben **keinen**
`handleId` und sind damit nicht persistabel über Reload. Sie werden
beim JSON-Save als Stub gespeichert (Schritt 4) und beim Restore als
"(nicht geladen)" angezeigt.

---

## Schritt 4 — JSON-Save/Load in file.js

### 4a) `saveJson` (file.js, Z. 143–259): Metadaten-Liste einfügen

In das Daten-Objekt `d` (zwischen `playerShowExperimental` und der
schließenden `}`) ergänzen:

```js
localCollections: (typeof sLocalCollections !== "undefined")
  ? Array.from(sLocalCollections.values()).map((c) => ({
      id: c.id,
      label: c.label,
      lang: c.lang,
      kind: c.kind,
      folderName: c.folderName,
      fileCount: c.recordings.length,
      handleId: c.handleId || null,
    }))
  : [],
```

### 4b) `applyLoadedData` (file.js, Z. 393 ff): Restore aufrufen

Am Ende von `applyLoadedData`, vor dem `alert(...)`-Aufruf:

```js
if (Array.isArray(d.localCollections)
    && typeof sRestoreLocalCollections === "function") {
  // fire-and-forget; Restore arbeitet async, blockt aber nicht das Laden
  sRestoreLocalCollections(d.localCollections);
}
```

---

## Schritt 5 — sentences.js: Restore-Mechanik

Nach `sRemoveLocalCollection` ergänzen:

```js
// Wird nach JSON-Load aufgerufen. Versucht für jede Sammlung mit
// handleId den FSAA-Handle aus IndexedDB zu holen und neu zu mounten.
// Bei Erfolg: Sammlung ist sofort verfügbar.
// Bei Mißerfolg (kein Handle, keine Permission, Firefox): Stub-Sprecher
// im Dropdown.
async function sRestoreLocalCollections(metaArr) {
  for (const meta of metaArr) {
    if (sLocalCollections.has(meta.id)) continue;   // schon da
    let restored = false;
    if (meta.handleId && sFsaaAvailable()) {
      try {
        const rec = await sIdbGet(meta.handleId);
        if (rec && rec.handle) {
          const perm = await rec.handle.queryPermission({ mode: "read" });
          let granted = perm === "granted";
          if (!granted) {
            const req = await rec.handle.requestPermission({ mode: "read" });
            granted = req === "granted";
          }
          if (granted) {
            await sIngestFromHandle(rec.handle, meta.handleId);
            restored = true;
          }
        }
      } catch (e) {
        console.warn("[sentences/local] restore failed for", meta.id, e);
      }
    }
    if (!restored) {
      // Stub-Sammlung anlegen — als "(nicht geladen)" im Dropdown
      sLocalCollections.set(meta.id, {
        id: meta.id,
        label: meta.label,
        lang: meta.lang,
        kind: meta.kind,
        folderName: meta.folderName,
        files: new Map(),
        recordings: [],
        handleId: meta.handleId || null,
        stub: true,
      });
      sCorpus.speakers[meta.id] = sMakeSpeaker(
        meta.label + " " + t("sentLocalNotLoaded"),
        meta.lang, meta.kind + "-stub", []
      );
    }
  }
  sRefreshLocalList();
  sUpdateUI();
}
```

### 5a) Sprecher-Dropdown: Klick auf Stub-Sprecher → Re-Mount

Im `sRefreshSpeakerDropdown` (Bauanleitung-21-Erbe, Z. 272 ff)
nach dem Befüllen, vor dem Auswahl-Restore, einen Change-Listener
für Re-Mount installieren. Wichtig: nicht den existierenden
Default-Pfad brechen.

**Vor (Ende der Funktion):**
```js
if (speakers.includes(prev) || prev === "any") {
  sel.value = prev;
} else {
  sel.value = "any";
}
```

**Nach:**
```js
if (speakers.includes(prev) || prev === "any") {
  sel.value = prev;
} else {
  sel.value = "any";
}
// Stub-Re-Mount: wenn der User einen "(nicht geladen)"-Sprecher
// auswählt, Re-Mount-Dialog anstoßen. Einmaliger Listener pro Refresh.
sel.onchange = function () {
  const v = sel.value;
  const coll = sLocalCollections.get(v);
  if (coll && coll.stub) {
    sReloadStubCollection(v);
  }
};
```

### 5b) Funktion `sReloadStubCollection`

Nach `sRestoreLocalCollections` ergänzen:

```js
async function sReloadStubCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll || !coll.stub) return;
  const hint = t("sentLocalReloadHint") + " " + coll.folderName;
  // Bei FSAA: erneuter Picker-Versuch mit startIn-Hint, wenn Handle in IDB
  if (coll.handleId && sFsaaAvailable()) {
    try {
      const rec = await sIdbGet(coll.handleId);
      const opts = { id: "ci-sound-saetze", mode: "read" };
      if (rec && rec.handle) opts.startIn = rec.handle;
      const handle = await window.showDirectoryPicker(opts);
      // Stub entfernen, neu ingesten
      sLocalCollections.delete(cid);
      delete sCorpus.speakers[cid];
      await sIngestFromHandle(handle, coll.handleId);
      // sIngestLocalFolder erzeugt neue cids; Anzeige stimmt nach
      // sRefreshLocalList + sUpdateUI.
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
      console.warn("[sentences/local] FSAA reload failed, fallback:", err);
    }
  }
  // Fallback: webkitdirectory mit Ordnername-Hinweis
  alert(hint);
  const li = document.getElementById("plSentLocalInput");
  if (li) {
    li.value = "";
    // Nach dem Picker-Change: Stub erst entfernen, dann ingesten
    const oneShot = async function (e) {
      li.removeEventListener("change", oneShot);
      try {
        sLocalCollections.delete(cid);
        delete sCorpus.speakers[cid];
        await sIngestLocalFolder(e.target.files);
      } catch (err) {
        console.error("[sentences/local] webkitdir reload failed:", err);
      }
    };
    li.addEventListener("change", oneShot);
    li.click();
  }
}
```

Hinweis: nach Re-Mount kann die neue Sammlung eine **andere
Collection-ID** bekommen als die ursprüngliche. Das ist OK; die
JSON-Metadaten beziehen sich nur auf das nächste Save. Wer
sicherstellen will, daß die IDs stabil bleiben, müsste den Ingest
um einen optionalen `preferredId`-Parameter erweitern — für jetzt
nicht nötig.

### 5c) Remove-Funktion: IDB-Handle ebenfalls löschen

**Vor (Bauanleitung 29 Schritt 3g):**
```js
function sRemoveLocalCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll) return;
  if (sActive && sCurRec && sCurRec.speakerKey === cid) {
    sStop();
  }
  sLocalCollections.delete(cid);
  delete sCorpus.speakers[cid];
  sRefreshLocalList();
  sUpdateUI();
}
```

**Nach:**
```js
async function sRemoveLocalCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll) return;
  if (sActive && sCurRec && sCurRec.speakerKey === cid) {
    sStop();
  }
  sLocalCollections.delete(cid);
  delete sCorpus.speakers[cid];
  // Handle aus IndexedDB löschen, wenn keine andere Sammlung mehr
  // denselben handleId benutzt
  if (coll.handleId) {
    let stillReferenced = false;
    for (const c of sLocalCollections.values()) {
      if (c.handleId === coll.handleId) { stillReferenced = true; break; }
    }
    if (!stillReferenced) {
      try { await sIdbDel(coll.handleId); } catch (e) { /* ignore */ }
    }
  }
  sRefreshLocalList();
  sUpdateUI();
}
```

### 5d) `sRefreshLocalList` zeigt Stub-Zustand

In der Schleife über `sLocalCollections` den Label-Aufbau
anpassen:

**Vor (Bauanleitung 29):**
```js
lbl.textContent = coll.label
  + "  (" + coll.recordings.length + " · " + coll.folderName + ")";
```

**Nach:**
```js
let suffix;
if (coll.stub) {
  suffix = "  " + t("sentLocalNotLoaded") + " · " + coll.folderName;
} else {
  suffix = "  (" + coll.recordings.length + " · " + coll.folderName + ")";
}
lbl.textContent = coll.label + suffix;
```

Optional zusätzlich neben "×" einen "Reload"-Button bei Stubs
einblenden. Der Listener ruft `sReloadStubCollection(cid)` auf.
Minimal-Variante: Auswahl im Sprecher-Dropdown reicht (Schritt 5a).

---

## Schritt 6 — CODESTRUKTUR.md aktualisieren

Eintrag für `sentences.js`: `sLocalCollections`-Beschreibung um
`handleId`, `persistable`, `stub` erweitern. Funktionen ergänzen:
`sIdbOpen`, `sIdbPut`, `sIdbGet`, `sIdbDel`, `sFsaaAvailable`,
`sIngestFromHandle`, `sRestoreLocalCollections`,
`sReloadStubCollection`. Datenfluss-Abschnitt um Persistenz-
Hinweis ergänzen:

```
**Lokale Sammlungen — Persistenz:** Sammlungen, die über FSAA
(`showDirectoryPicker`) angelegt wurden, haben einen `handleId`,
unter dem der FileSystemDirectoryHandle in IndexedDB liegt
(DB "ciSoundBalancing", Store "folderHandles"). Beim JSON-Save
wandert die Metadaten-Liste mit (file.js `saveJson.localCollections`).
Nach JSON-Load ruft applyLoadedData `sRestoreLocalCollections` auf;
dort wird pro Sammlung versucht, den Handle aus IDB zu holen,
Permission anzufordern und neu zu mounten. Schlägt das fehl (keine
FSAA, kein Handle, Permission verweigert), wird ein Stub-Sprecher
angelegt; Klick darauf im Dropdown öffnet den Picker.
```

---

## Schritt 7 — SPEC.md aktualisieren

Im in Bauanleitung 29 ergänzten Block "Lokale Audio-Ordner" einen
Persistenz-Absatz anhängen:

```
**Persistenz:** Lokale Sammlungen werden mit ihren Metadaten in JSON
gespeichert. Audio-Daten selbst nicht. Beim Reload mit JSON-Restore:
- In Chromium/Edge wird der Browser nach Re-Permission für den
  ursprünglichen Ordner gefragt (ein Dialog); nach Bestätigung ist
  die Sammlung sofort wieder verfügbar, der Picker für künftige
  Re-Auswahlen öffnet an der gespeicherten Stelle (per
  showDirectoryPicker startIn-Hint).
- In Firefox erscheint die Sammlung als "(nicht geladen)" im
  Sprecher-Dropdown und in der Liste. Auswahl im Dropdown öffnet
  einen Hinweis mit Ordnernamen und den webkitdirectory-Picker.
"×" entfernt die Sammlung dauerhaft (auch den IndexedDB-Handle,
sofern keine andere Sammlung ihn referenziert).
```

---

## Akzeptanztest

Vorbereitung: gleiche Test-Ordner wie in Bauanleitung 29.

### Chromium (Hybrid-Pfad)

1. **Picker öffnet FSAA:** "+ Lokalen Ordner laden" → System-Picker
   im "Read"-Modus, möglicher Start in `~/Music` o.ä. Freiburger
   wählen.
2. **Sammlungen sichtbar:** wie in Bauanleitung 29 — zwei Einträge
   in der Liste.
3. **JSON speichern:** Tab "Laden / Speichern" → Speichern. Datei
   öffnen und prüfen: `localCollections` enthält zwei Einträge mit
   `handleId`-String.
4. **Reload des Tools (F5):** ohne JSON-Load. Erwartet: Liste
   ist leer (Session-State weg).
5. **JSON laden:** die eben gespeicherte Datei wählen. Erwartet:
   Browser fragt nach Berechtigung für den Freiburger-Ordner
   ("Diese Seite möchte auf …"). Bestätigen. Liste enthält wieder
   beide Freiburger-Einträge mit korrekter Anzahl. Sprecher-Dropdown
   ebenfalls.
6. **Wiedergabe nach Restore:** Sprecher "Freiburger Einsilbig"
   wählen, Play. Erwartet: Wort wird gespielt.
7. **Re-Picker startIn-Test:** Eintrag entfernen ("×"), dann
   "+ Lokalen Ordner laden". Erwartet: Picker öffnet sich an der
   zuletzt benutzten Stelle (gleiches Wurzel-Verzeichnis sichtbar),
   nicht im Default-Pfad.
8. **Permission-Denial-Test:** in den Browser-Einstellungen die
   Berechtigung für die Seite zurücksetzen, JSON erneut laden.
   Erwartet: Browser fragt erneut; bei Ablehnung erscheint die
   Sammlung als "(nicht geladen)" in der Liste und im Dropdown.

### Firefox (Fallback)

9. **Webkitdirectory-Picker:** "+ Lokalen Ordner laden" öffnet den
   Standard-Datei-Dialog im Ordner-Modus. Oldenburger wählen.
10. **JSON speichern + Reload + JSON laden:** Sammlung erscheint
    in der Liste als "Oldenburger OLSA (female) (nicht geladen) ·
    Oldenburger". Im Sprecher-Dropdown taucht der Eintrag mit
    "(nicht geladen)" auf.
11. **Re-Mount per Dropdown:** Sprecher "Oldenburger … (nicht
    geladen)" wählen. Erwartet: Alert mit "Bitte den Ordner
    erneut wählen: Oldenburger". Nach OK: Picker öffnet. Ordner
    `Oldenburger` neu wählen. Sammlung wird neu ingestet, Stub
    verschwindet, Anzahl Sätze korrekt, Play funktioniert.

### Allgemein

12. **Remove löscht IDB-Handle:** Sammlung in Chromium per "×"
    entfernen, dann DevTools → Application → IndexedDB →
    ciSoundBalancing → folderHandles prüfen. Erwartet: Eintrag
    mit der entsprechenden `handleId` ist weg, sofern keine andere
    Sammlung denselben Handle teilt.
13. **Stub ohne Match nach JSON-Load:** JSON laden, das eine
    Sammlung referenziert, deren `handleId` nicht in IDB liegt
    (z.B. JSON von anderem Browser). Erwartet: Stub-Eintrag,
    keine Fehler.
14. **Regression Bauanleitung 29:** alle Akzeptanztest-Punkte 1–12
    aus Bauanleitung 29 noch mal kurz durchspielen. Erwartet:
    unverändert.
15. **Regression Bauanleitung 28:** Audioplayer-Datei + Sätze-
    Trennung weiterhin korrekt (Klick-für-Klick-Test 5 aus
    Bauanleitung 28).

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden Akzeptanz-Punkt (1–15) einzeln
melden: **erfüllt** / **nicht erfüllt** / **unklar**, mit
Datei/Zeile.

Zusätzlich prüfen:

- A) IDB-Wrapper: ist `db.close()` in jedem Pfad (inkl.
  `onerror`) sichergestellt? Wenn nicht: ergänzen.
- B) `requestPermission` ist eine User-Aktivierungs-pflichtige API
  in einigen Chromium-Versionen — nach reinem Page-Load ohne
  vorherigen Klick könnte sie scheitern. Was passiert, wenn JSON
  per Drag-and-Drop direkt geladen wird, ohne dass der User
  vorher etwas geklickt hat? Wenn Probleme: Restore in einen
  expliziten Bestätigungs-Klick verlagern ("Lokale Ordner aus
  Backup wiederherstellen"-Button).
- C) `webkitRelativePath` per `Object.defineProperty` auf eine
  echte `File`-Instanz: funktioniert in beiden Browsern? Bei
  Fehlschlag greift der Wrap-Pfad — verifizieren, dass `arrayBuffer`
  und `text` korrekt durchgereicht werden.
- D) `for await … of dirHandle.entries()` ist Chrome 84+; ältere
  Browser werfen TypeError. Falls Support für Edge-Pre-Chromium
  o.ä. nötig wäre, müsste man auf `keys()` + `getFileHandle` /
  `getDirectoryHandle` ausweichen. Für aktuelles Chromium reicht
  `entries()`.
- E) Wenn der User eine Sammlung im Chromium-Pfad lädt, JSON
  speichert und auf einem zweiten Rechner / in Firefox lädt: die
  Sammlung erscheint als Stub mit `handleId` aus dem fremden
  Browser. Re-Mount auf Stub-Klick öffnet dann den webkit-Picker
  (Fallback in `sReloadStubCollection` ohne IDB-Hit). Verifizieren,
  daß dieser Pfad sauber funktioniert.

Bei unklaren Punkten: konkrete Rückfrage formulieren statt zu raten.
