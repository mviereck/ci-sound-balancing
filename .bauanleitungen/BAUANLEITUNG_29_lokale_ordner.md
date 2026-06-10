# BAUANLEITUNG 29 — Lokale Audio-Ordner im Sprachspieler

## Voraussetzung

Bauanleitung 28 (Player-/Sätze-Trennung) ist abgeschlossen und der
Akzeptanztest dort ist bestanden. Diese Anleitung baut darauf auf,
aber führt selbst kein Persistenz-Verhalten ein (das macht
Bauanleitung 30).

## Ziel

Der User kann lokale Ordner mit Audiodateien wählen, die im
Sprecher-Dropdown des Sprachspielers erscheinen. Zwei bekannte
Datensätze werden automatisch erkannt:

- **Freiburger Sprachtest** (zwei Unterordner `Einsilbig`/
  `Mehrsilbig`, darin `Testliste_NN`/`L<NN>_W<NN>_<wort>.wav` bzw.
  `…_<zahl>.wav`) → zwei Sprecher-Einträge.
- **Oldenburger Satztest** (flacher Ordner mit `<id>_OLSA<male|female>_TTS.wav`
  + zugehörige `sentences_OLSA<…>.txt` im Format `<dateiname.wav> :
  <text>`) → ein Sprecher-Eintrag, Label-Variante je nach Stimme.

Andere Ordner laufen über einen **generischen Fallback**: alle
gefundenen Audiodateien werden zu einem Sprecher zusammengefasst,
benannt nach dem Wurzel-Ordnernamen, in der aktuellen Tool-Sprache.
Wenn im Ordner eine Manifest-Datei (`.txt`, `.csv`, `.tsv`) liegt,
die ≥ 80 % der Audio-Dateien zu Texten zuordnet, werden diese als
Text angezeigt.

Dateien werden **lazy** geladen — nur beim Abspielen, nicht beim
Ordner-Scan.

## Nicht-Ziel dieser Anleitung

- **Keine Persistenz** über Reload. Auswahl gilt nur in der
  laufenden Session. Persistenz folgt in Bauanleitung 30.
- Kein File-System-Access-API-Picker (auch in Bauanleitung 30).
  Diese Anleitung benutzt ausschließlich `<input type="file"
  webkitdirectory multiple>` — funktioniert in Chromium und
  Firefox und ist die einfachste Basis.

## Dateien

- `index.html` (Sätze-Card erweitern)
- `sentences.js` (neue Funktionen + Anpassungen)
- `i18n.js` (neue Strings in DE/EN/FR/ES)
- `CODESTRUKTUR.md`
- `SPEC.md`

---

## Schritt 1 — index.html: UI in der Sätze-Card erweitern

### 1a) Innerhalb von `<div id="plSentControls">` (Z. 1263), VOR dem
ersten `<div class="controls-row">`, folgenden Block einfügen:

```html
<!-- Lokale Audio-Sammlungen -->
<div id="plSentLocalBlock" style="margin-bottom:10px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px">
  <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
    <button class="btn" id="plSentLocalAddBtn" type="button" style="font-size:0.85em">
      <span data-t="sentLocalAdd"></span>
    </button>
    <span id="plSentLocalHint" style="font-size:0.78em;color:var(--text-muted)" data-t="sentLocalHint"></span>
  </div>
  <div id="plSentLocalList" style="display:none;font-size:0.85em">
    <!-- Liste wird dynamisch von sentences.js befüllt -->
  </div>
  <input
    type="file"
    id="plSentLocalInput"
    webkitdirectory
    multiple
    style="display:none"
  />
</div>
```

`webkitdirectory` ist in Firefox seit Version 50 ebenfalls als
"directory upload" implementiert; der ältere Vendor-Präfix-Name
wird im Standardweg vom Browser akzeptiert.

---

## Schritt 2 — i18n.js: neue Strings in allen vier Sprachen

In jedem der vier Sprach-Blöcke (DE ab Z. 230, EN ab Z. 765, FR ab
Z. 1280, ES ab Z. 1799) **direkt nach `sentNotReady`** folgende
Schlüssel einfügen.

### DE
```js
sentLocalAdd: "+ Lokalen Ordner laden",
sentLocalHint: "Audiodateien aus einem lokalen Ordner als Sprecher hinzufügen (nur diese Sitzung).",
sentLocalNone: "Keine lokalen Ordner geladen.",
sentLocalRemove: "Entfernen",
sentLocalUnknownFormat: "Format nicht erkannt — als generische Sammlung geladen.",
sentLocalNoAudio: "Keine Audiodateien in diesem Ordner gefunden.",
sentLocalSpkFreiburgerMono: "Freiburger Einsilbig",
sentLocalSpkFreiburgerPoly: "Freiburger Mehrsilbig",
sentLocalSpkOldenburgerFemale: "Oldenburger OLSA (female)",
sentLocalSpkOldenburgerMale: "Oldenburger OLSA (male)",
sentLocalSpkOldenburger: "Oldenburger OLSA",
sentLocalSpkGenericPrefix: "Eigener Ordner",
```

### EN
```js
sentLocalAdd: "+ Load local folder",
sentLocalHint: "Add audio files from a local folder as a speaker (this session only).",
sentLocalNone: "No local folders loaded.",
sentLocalRemove: "Remove",
sentLocalUnknownFormat: "Format not recognized — loaded as a generic collection.",
sentLocalNoAudio: "No audio files found in this folder.",
sentLocalSpkFreiburgerMono: "Freiburger monosyllabic",
sentLocalSpkFreiburgerPoly: "Freiburger polysyllabic",
sentLocalSpkOldenburgerFemale: "Oldenburger OLSA (female)",
sentLocalSpkOldenburgerMale: "Oldenburger OLSA (male)",
sentLocalSpkOldenburger: "Oldenburger OLSA",
sentLocalSpkGenericPrefix: "Custom folder",
```

### FR
```js
sentLocalAdd: "+ Charger un dossier local",
sentLocalHint: "Ajoute des fichiers audio d'un dossier local comme locuteur (uniquement pour cette session).",
sentLocalNone: "Aucun dossier local chargé.",
sentLocalRemove: "Retirer",
sentLocalUnknownFormat: "Format non reconnu — chargé comme collection générique.",
sentLocalNoAudio: "Aucun fichier audio trouvé dans ce dossier.",
sentLocalSpkFreiburgerMono: "Freiburger monosyllabique",
sentLocalSpkFreiburgerPoly: "Freiburger polysyllabique",
sentLocalSpkOldenburgerFemale: "Oldenburger OLSA (féminin)",
sentLocalSpkOldenburgerMale: "Oldenburger OLSA (masculin)",
sentLocalSpkOldenburger: "Oldenburger OLSA",
sentLocalSpkGenericPrefix: "Dossier personnel",
```

### ES
```js
sentLocalAdd: "+ Cargar carpeta local",
sentLocalHint: "Añade archivos de audio de una carpeta local como locutor (solo en esta sesión).",
sentLocalNone: "No hay carpetas locales cargadas.",
sentLocalRemove: "Quitar",
sentLocalUnknownFormat: "Formato no reconocido — cargado como colección genérica.",
sentLocalNoAudio: "No se han encontrado archivos de audio en esta carpeta.",
sentLocalSpkFreiburgerMono: "Freiburger monosílabo",
sentLocalSpkFreiburgerPoly: "Freiburger polisílabo",
sentLocalSpkOldenburgerFemale: "Oldenburger OLSA (femenino)",
sentLocalSpkOldenburgerMale: "Oldenburger OLSA (masculino)",
sentLocalSpkOldenburger: "Oldenburger OLSA",
sentLocalSpkGenericPrefix: "Carpeta propia",
```

---

## Schritt 3 — sentences.js: lokale Sammlungen

Alle nachfolgenden Erweiterungen kommen in **sentences.js**.

### 3a) Neuen State-Block direkt nach `sEmbedLoading` (Z. 23) ergänzen

```js
// ============================================================
// LOKALE SAMMLUNGEN
// ============================================================
// Map: collectionId -> {
//   id, label, lang, kind ("freiburger-mono"|"freiburger-poly"|
//     "oldenburger-female"|"oldenburger-male"|"oldenburger"|"generic"),
//   folderName (Wurzel-Ordnername, für UI),
//   files: Map<relPath, File>,            // lazy ArrayBuffer-Quelle
//   recordings: Array<{id, text, audioRel}>  // wird in sCorpus gespiegelt
// }
let sLocalCollections = new Map();
let sLocalNextId = 1;

function sNewCollectionId() {
  return "local-" + (sLocalNextId++);
}
```

### 3b) `sPlayCurrent` (Z. 147–189) muß lokale Audio-Refs auflösen

Im Funktionsblock, **vor dem fetch**, gibt es bereits einen Branch
für `data:`-URLs. Erweitere ihn um lokale Refs.

**Vor:**
```js
const audioRef = sCurRec.rec.audio;
try {
  let arrayBuf;
  if (audioRef.startsWith("data:")) {
    arrayBuf = sDataUrlToArrayBuffer(audioRef);
  } else {
    const res = await fetch("assets/sentences/" + audioRef);
    if (!res.ok) throw new Error("HTTP " + res.status);
    arrayBuf = await res.arrayBuffer();
  }
  ...
```

**Nach:** zwischen den beiden Branches einen dritten einfügen:
```js
const audioRef = sCurRec.rec.audio;
try {
  let arrayBuf;
  if (audioRef.startsWith("data:")) {
    arrayBuf = sDataUrlToArrayBuffer(audioRef);
  } else if (audioRef.startsWith("local:")) {
    // Form: "local:<collectionId>:<relPath>"
    const second = audioRef.indexOf(":", 6);
    const cid = audioRef.substring(6, second);
    const rel = audioRef.substring(second + 1);
    const coll = sLocalCollections.get(cid);
    if (!coll) throw new Error("Lokale Sammlung " + cid + " nicht (mehr) verfügbar");
    const file = coll.files.get(rel);
    if (!file) throw new Error("Datei " + rel + " nicht in Sammlung " + cid);
    arrayBuf = await file.arrayBuffer();
  } else {
    const res = await fetch("assets/sentences/" + audioRef);
    if (!res.ok) throw new Error("HTTP " + res.status);
    arrayBuf = await res.arrayBuffer();
  }
  ...
```

Rest der Funktion unverändert.

### 3c) Sprach-Heuristik (welche Tool-Sprache für lokale Sammlungen)

Freiburger und Oldenburger sind deutsch. Generische Sammlungen
landen in der **aktuell eingestellten Tool-Sprache** beim Ingest.
Wechselt der User danach die Tool-Sprache, verschwindet die
Sammlung aus dem Dropdown — wie alle anderen Sprecher auch.

### 3d) Heuristik-Funktionen

Direkt vor dem DOMContentLoaded-Handler einfügen:

```js
// ============================================================
// LOKALE SAMMLUNGEN — HEURISTIK
// ============================================================

// Liefert true, wenn dateiPfad-Pattern auf Freiburger passt.
// Erwartet, daß webkitRelativePath relative Pfade wie
// "<root>/Einsilbig/Testliste_07/L07_W12_Hecht.wav" liefert.
// Erkennt auch beide Subtypen unabhängig — gibt {mono, poly} zurück.
function sDetectFreiburger(audioFiles) {
  let mono = [], poly = [];
  for (const f of audioFiles) {
    const parts = f.webkitRelativePath.split("/");
    if (parts.length < 4) continue;
    const sub = parts[1];               // "Einsilbig" oder "Mehrsilbig"
    const listDir = parts[2];           // "Testliste_NN"
    const name = parts[parts.length - 1];
    if (!/^Testliste_\d+$/i.test(listDir)) continue;
    if (!/^L\d+_W\d+_/i.test(name)) continue;
    if (/Einsilbig/i.test(sub)) mono.push(f);
    else if (/Mehrsilbig/i.test(sub)) poly.push(f);
  }
  if (mono.length === 0 && poly.length === 0) return null;
  return { mono, poly };
}

// Erkennt Oldenburger. Erwartet flachen Ordner mit
// "<id>_OLSA[female|male]_TTS.wav".
// Liefert {variant: "female"|"male"|"generic", files: [...]}
function sDetectOldenburger(audioFiles) {
  const matched = [];
  let femaleCount = 0, maleCount = 0;
  for (const f of audioFiles) {
    const name = f.name;
    const m = /_OLSA(female|male)?_TTS\.wav$/i.exec(name);
    if (!m) continue;
    matched.push(f);
    if (m[1] && m[1].toLowerCase() === "female") femaleCount++;
    else if (m[1] && m[1].toLowerCase() === "male") maleCount++;
  }
  if (matched.length === 0) return null;
  let variant = "generic";
  if (femaleCount > 0 && maleCount === 0) variant = "female";
  else if (maleCount > 0 && femaleCount === 0) variant = "male";
  return { variant, files: matched };
}

// Sucht in fileList nach einer passenden Oldenburger-Manifest-Datei
// (sentences_OLSA*.txt) und parst sie zu einer Map<filename, text>.
async function sLoadOldenburgerManifest(allFiles) {
  for (const f of allFiles) {
    if (/sentences_OLSA.*\.txt$/i.test(f.name)) {
      const txt = await f.text();
      return sParseOldenburgerManifest(txt);
    }
  }
  return new Map();
}

// Format: "<filename.wav> : <text>" pro Zeile.
function sParseOldenburgerManifest(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const filename = line.substring(0, idx).trim();
    const sentence = line.substring(idx + 1).trim();
    if (filename && sentence) map.set(filename, sentence);
  }
  return map;
}

// Generischer Manifest-Parser: probiert verschiedene Separatoren
// und liefert einen Map<filename, text>, wenn ≥ 80 % der
// audioFilenames einen Treffer kriegen. Sonst leere Map.
function sParseGenericManifest(text, audioFilenames) {
  const audioSet = new Set(audioFilenames.map((n) => n.toLowerCase()));
  const candidates = [
    /^\s*([^\s,;:\t]+\.(?:wav|mp3|ogg|flac|m4a))\s*[:,;|\t]\s*(.+?)\s*$/i,
    /^\s*"?([^"\s,;:\t]+\.(?:wav|mp3|ogg|flac|m4a))"?\s*[,;|\t:]\s*"?(.+?)"?\s*$/i,
  ];
  let best = new Map();
  for (const re of candidates) {
    const map = new Map();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const m = re.exec(line);
      if (!m) continue;
      const fn = m[1].trim();
      const tx = m[2].trim();
      if (audioSet.has(fn.toLowerCase())) map.set(fn, tx);
    }
    if (map.size > best.size) best = map;
  }
  const coverage = audioFilenames.length === 0
    ? 0
    : best.size / audioFilenames.length;
  if (coverage < 0.8) return new Map();
  return best;
}

async function sLoadGenericManifest(allFiles, audioFilenames) {
  // Sammele alle .txt/.csv/.tsv-Dateien (nicht zu groß)
  for (const f of allFiles) {
    if (!/\.(txt|csv|tsv)$/i.test(f.name)) continue;
    if (f.size > 5 * 1024 * 1024) continue;     // > 5 MB: skip
    try {
      const txt = await f.text();
      const map = sParseGenericManifest(txt, audioFilenames);
      if (map.size > 0) return map;
    } catch (e) { /* skip */ }
  }
  return new Map();
}
```

### 3e) Builder-Funktionen für die drei Sammlungs-Typen

```js
// Sprecher-Objekt nach Schema von sCorpus.speakers
function sMakeSpeaker(label, lang, kind, recordings) {
  return {
    lang: lang,
    label: label,
    kind: kind,
    source: "local",
    license: "",
    credit: "",
    recordings: recordings,
  };
}

// Baut die recordings-Liste für Freiburger.
// Wort/Zahl wird aus Dateinamen extrahiert: "L01_W01_Ring.wav" -> "Ring",
// "L01_W01_98.wav" -> "98". Audio-Ref im Form local:<cid>:<relPath>.
function sBuildFreiburgerRecordings(files, cid) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, "");
    const parts = base.split("_");
    const text = parts.length >= 3 ? parts.slice(2).join(" ") : base;
    out.push({
      id: "fb-" + (++n),
      text: text,
      audio: "local:" + cid + ":" + f.webkitRelativePath,
    });
  }
  return out;
}

function sBuildOldenburgerRecordings(files, textMap, cid) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const text = textMap.get(f.name) || "";
    out.push({
      id: "olsa-" + (++n),
      text: text,
      audio: "local:" + cid + ":" + f.webkitRelativePath,
    });
  }
  return out;
}

function sBuildGenericRecordings(files, textMap, cid) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const text = textMap.get(f.name) || "";
    out.push({
      id: "loc-" + (++n),
      text: text,
      audio: "local:" + cid + ":" + f.webkitRelativePath,
    });
  }
  return out;
}
```

### 3f) Zentrale Ingest-Funktion

```js
// Verarbeitet die FileList eines Ordner-Pickers. Liest keine Audio-
// Daten ein — nur Manifest-Texte werden synchron geparst (klein).
async function sIngestLocalFolder(fileList) {
  const all = Array.from(fileList);
  if (all.length === 0) return;

  // Wurzel-Ordnername aus erstem File
  const firstRel = all[0].webkitRelativePath || all[0].name;
  const folderName = firstRel.split("/")[0] || "Ordner";

  const audioFiles = all.filter((f) =>
    /\.(wav|mp3|ogg|flac|m4a)$/i.test(f.name)
  );
  if (audioFiles.length === 0) {
    alert(t("sentLocalNoAudio"));
    return;
  }

  // Heuristiken
  const fb = sDetectFreiburger(audioFiles);
  const old = sDetectOldenburger(audioFiles);

  const cidBase = sNewCollectionId();
  const created = [];   // {id, label, lang, kind, folderName, files, recordings}

  const filesMap = new Map();
  for (const f of audioFiles) filesMap.set(f.webkitRelativePath, f);

  if (fb) {
    if (fb.mono.length > 0) {
      const cid = sNewCollectionId();
      const recs = sBuildFreiburgerRecordings(fb.mono, cid);
      const fmap = new Map();
      for (const f of fb.mono) fmap.set(f.webkitRelativePath, f);
      created.push({
        id: cid, label: t("sentLocalSpkFreiburgerMono"),
        lang: "de", kind: "freiburger-mono",
        folderName, files: fmap, recordings: recs,
      });
    }
    if (fb.poly.length > 0) {
      const cid = sNewCollectionId();
      const recs = sBuildFreiburgerRecordings(fb.poly, cid);
      const fmap = new Map();
      for (const f of fb.poly) fmap.set(f.webkitRelativePath, f);
      created.push({
        id: cid, label: t("sentLocalSpkFreiburgerPoly"),
        lang: "de", kind: "freiburger-poly",
        folderName, files: fmap, recordings: recs,
      });
    }
  } else if (old) {
    const textMap = await sLoadOldenburgerManifest(all);
    const cid = sNewCollectionId();
    const recs = sBuildOldenburgerRecordings(old.files, textMap, cid);
    const fmap = new Map();
    for (const f of old.files) fmap.set(f.webkitRelativePath, f);
    const label =
      old.variant === "female" ? t("sentLocalSpkOldenburgerFemale")
      : old.variant === "male"  ? t("sentLocalSpkOldenburgerMale")
      : t("sentLocalSpkOldenburger");
    created.push({
      id: cid, label, lang: "de",
      kind: "oldenburger-" + old.variant,
      folderName, files: fmap, recordings: recs,
    });
  } else {
    // Generischer Fallback
    const audioNames = audioFiles.map((f) => f.name);
    const textMap = await sLoadGenericManifest(all, audioNames);
    const cid = sNewCollectionId();
    const recs = sBuildGenericRecordings(audioFiles, textMap, cid);
    const langCode = (typeof lang !== "undefined") ? lang : "de";
    created.push({
      id: cid, label: t("sentLocalSpkGenericPrefix") + ": " + folderName,
      lang: langCode, kind: "generic",
      folderName, files: filesMap, recordings: recs,
    });
  }

  for (const c of created) {
    sLocalCollections.set(c.id, c);
    sCorpus.speakers[c.id] = sMakeSpeaker(c.label, c.lang, c.kind, c.recordings);
  }

  sRefreshLocalList();
  sUpdateUI();   // Sprecher-Dropdown neu aufbauen
}
```

### 3g) UI: Liste der geladenen Sammlungen + Remove-Button

```js
function sRefreshLocalList() {
  const list = document.getElementById("plSentLocalList");
  if (!list) return;
  list.innerHTML = "";
  if (sLocalCollections.size === 0) {
    list.style.display = "";
    const span = document.createElement("span");
    span.style.color = "var(--text-muted)";
    span.textContent = t("sentLocalNone");
    list.appendChild(span);
    return;
  }
  list.style.display = "";
  for (const [cid, coll] of sLocalCollections) {
    const row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:3px 0";
    const lbl = document.createElement("span");
    lbl.textContent = coll.label
      + "  (" + coll.recordings.length + " · " + coll.folderName + ")";
    const btn = document.createElement("button");
    btn.className = "btn";
    btn.type = "button";
    btn.style.cssText = "padding:1px 8px;font-size:0.85em";
    btn.title = t("sentLocalRemove");
    btn.textContent = "×";
    btn.addEventListener("click", function () {
      sRemoveLocalCollection(cid);
    });
    row.appendChild(lbl);
    row.appendChild(btn);
    list.appendChild(row);
  }
}

function sRemoveLocalCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll) return;
  // Wenn aktuell ein recording dieser Sammlung läuft: stoppen
  if (sActive && sCurRec && sCurRec.speakerKey === cid) {
    sStop();
  }
  sLocalCollections.delete(cid);
  delete sCorpus.speakers[cid];
  sRefreshLocalList();
  sUpdateUI();
}
```

### 3h) Picker-Verdrahtung im DOMContentLoaded-Handler

Am Ende des bestehenden DOMContentLoaded-Handlers (Z. 367–391),
vor dem `sLoadIfNeeded()`-Aufruf, ergänzen:

```js
const localAdd = document.getElementById("plSentLocalAddBtn");
const localInput = document.getElementById("plSentLocalInput");
if (localAdd && localInput) {
  localAdd.addEventListener("click", function () {
    localInput.value = "";   // erlaubt erneute Auswahl desselben Ordners
    localInput.click();
  });
  localInput.addEventListener("change", async function (e) {
    try {
      await sIngestLocalFolder(e.target.files);
    } catch (err) {
      console.error("[sentences/local] ingest failed:", err);
      alert("Fehler beim Laden des Ordners: " + err.message);
    }
  });
}
sRefreshLocalList();
```

---

## Schritt 4 — Hinweis "unbekanntes Format" für generische Sammlungen
ohne Manifest-Treffer (optional, leichte Variante)

In `sIngestLocalFolder`, im generischen Branch, **nach** dem
`sLoadGenericManifest`-Aufruf: wenn `textMap.size === 0`, einen
nicht-blockierenden Hinweis ins UI-Element `plSentLocalHint`
schreiben für 5 Sek. Optional — wenn du es einfach halten willst,
weglassen. (Console-Log reicht für jetzt; Hinweis-Text in i18n ist
schon angelegt.)

---

## Schritt 5 — CODESTRUKTUR.md aktualisieren

Im Eintrag für `sentences.js`: State erweitern um `sLocalCollections`,
`sLocalNextId`. Funktionen erwähnen: `sIngestLocalFolder`,
`sDetectFreiburger`, `sDetectOldenburger`, `sLoadOldenburgerManifest`,
`sParseOldenburgerManifest`, `sParseGenericManifest`,
`sLoadGenericManifest`, `sBuildFreiburgerRecordings`,
`sBuildOldenburgerRecordings`, `sBuildGenericRecordings`,
`sMakeSpeaker`, `sRefreshLocalList`, `sRemoveLocalCollection`,
`sNewCollectionId`. Audio-Ref-Schema um Branch
`"local:<collectionId>:<relPath>"` ergänzen.

---

## Schritt 6 — SPEC.md aktualisieren

Im Sätze-Player-Abschnitt einen neuen Punkt einfügen:

```
**Lokale Audio-Ordner:** Der User kann über "+ Lokalen Ordner laden"
in der Sätze-Card lokale Ordner mit Audiodateien hinzufügen. Erkennung:
- Freiburger Sprachtest (Pfad-Pattern Einsilbig|Mehrsilbig/Testliste_NN/
  L<NN>_W<NN>_<text>.wav) → zwei Sprecher (Einsilbig, Mehrsilbig),
  Text aus Dateiname.
- Oldenburger Satztest (Dateiname *_OLSA[female|male]_TTS.wav) → ein
  Sprecher mit Label-Variante (female/male/generisch), Text aus
  zugehöriger sentences_OLSA*.txt im Format "<datei.wav> : <text>".
- Generisch: alle Audiodateien des Ordners als ein Sprecher in der
  aktuellen Tool-Sprache; Manifest-Texte werden gelesen, wenn eine
  .txt/.csv/.tsv ≥ 80 % der Audio-Dateien zuordnet (Separator
  : , ; | Tab).
Audio wird lazy geladen (erst beim Abspielen, nicht beim Scan). Die
Auswahl gilt nur in der laufenden Browser-Session. Entfernen über
"×" neben dem Listeneintrag. Sprache der Sammlung bestimmt, ob sie
im Sprecher-Dropdown der aktuellen Tool-Sprache erscheint.
```

---

## Akzeptanztest

Vorbereitung: aus `.sprachdatensätze/` Freiburger und Oldenburger
griffbereit haben (entpackte Ordner).

1. **Picker öffnen:** Sätze-Card → "+ Lokalen Ordner laden" klicken.
   Erwartet: System-File-Picker öffnet im Ordner-Auswahl-Modus.
2. **Freiburger laden:** Ordner `Freiburger` wählen.
   Erwartet: Liste in Sätze-Card zeigt zwei Einträge (Einsilbig,
   Mehrsilbig) mit Anzahl-Recordings und Ordnernamen. Sprecher-
   Dropdown (deutsch) zeigt zusätzlich beide.
3. **Freiburger Einsilbig spielen:** Sprecher "Freiburger Einsilbig"
   wählen, "Text anzeigen" aktivieren, Play. Erwartet: ein deutsches
   Wort wird gespielt, Text-Box zeigt das Wort (z.B. "Ring", "Pult").
4. **Freiburger Mehrsilbig spielen:** Sprecher wechseln, Play.
   Erwartet: zweistellige Zahl wird gesprochen, Text zeigt die Zahl
   (z.B. "98").
5. **Oldenburger laden:** Picker erneut, Ordner `Oldenburger` wählen.
   Erwartet: Liste enthält jetzt drei Sammlungen (zwei Freiburger +
   Oldenburger), Sprecher-Dropdown zeigt zusätzlich "Oldenburger OLSA
   (female)" mit ~117 Sätzen.
6. **Oldenburger spielen:** Sprecher wählen, Play. Erwartet: ein
   Satz wie "Peter sieht sieben schwere Steine." wird gesprochen,
   Text-Box zeigt exakt diesen Satz.
7. **Generischer Ordner:** einen beliebigen lokalen Ordner mit ein
   paar MP3s wählen. Erwartet: Eintrag "Eigener Ordner: <name>" in
   der Liste; Sprecher-Dropdown enthält den Eintrag. Play spielt
   eine MP3 zufällig. Wenn keine Manifest-Datei: Text-Box bleibt
   leer, kein Crash.
8. **Sprachwechsel:** Tool-Sprache auf Englisch stellen. Erwartet:
   Freiburger und Oldenburger verschwinden aus dem Sprecher-Dropdown
   (sind "de"). Liste der Sammlungen bleibt aber sichtbar (die ist
   sprachenübergreifend). Bei Rückwechsel auf Deutsch: alle wieder da.
9. **Entfernen:** "×" beim Oldenburger-Eintrag klicken. Erwartet:
   Eintrag verschwindet aus Liste und Sprecher-Dropdown. Falls der
   Oldenburger-Sprecher gerade aktiv war: Wiedergabe stoppt.
10. **"Alle (zufällig)":** mit geladenen lokalen DE-Sammlungen
    "Alle (zufällig)" wählen, Endlosfolge starten. Erwartet:
    Sätze/Wörter werden bunt gemischt aus allen DE-Sprechern
    gezogen (Thorsten, cv-de, Freiburger, Oldenburger).
11. **Lazy-Load-Kontrolle:** im DevTools Memory-Tab vor und nach
    Ordner-Laden vergleichen. Erwartet: kein signifikanter Anstieg
    nach dem Scan (≤ ein paar MB für Manifest-Strings). Erst beim
    Abspielen einer Datei steigt der Speicher um den Größenwert
    des dekodierten Buffers.
12. **Bugfix-Regression (28):** Datei in Audioplayer laden, dann
    Freiburger-Wort spielen, dann Audioplayer-Play. Erwartet: Datei
    spielt (nicht das Wort) — siehe Bauanleitung 28.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede der 12 Akzeptanz-Kriterien einzeln
durchgehen und melden: **erfüllt** / **nicht erfüllt** / **unklar**,
mit Datei- und Zeilenangabe.

Zusätzlich prüfen:

- A) Liefert `webkitRelativePath` in beiden Browsern (Chromium,
  Firefox) konsistente Pfade mit `/` als Trenner? (Erwartet: ja.)
- B) Funktioniert die Manifest-Erkennung auch, wenn die Encoding-
  Vorgabe der `.txt`-Datei UTF-8 mit BOM ist? Wenn nicht: ggf.
  `.text()` Output auf `﻿` am Anfang prüfen und strippen.
- C) Bei sehr vielen Audio-Dateien (>1000): bleibt das UI
  responsiv? Falls Anzeichen für Hänger: ein `await new Promise(r
  => setTimeout(r, 0))` zwischen Heuristik und Builder einbauen.
- D) Greift der `sCorpus`-Eintrag durch, BEVOR der Embed-Loader
  für lokale Sammlungs-Sprachen versucht, irgendwas nachzuladen?
  (Erwartet: ja, weil Embed-Loader nur über `sUpdateUI` getriggert
  wird und nur eingreift, wenn KEIN Sprecher der Sprache existiert.)

Bei unklaren Punkten: konkrete Rückfrage formulieren statt zu raten.
