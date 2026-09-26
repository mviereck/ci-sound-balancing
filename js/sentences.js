// ============================================================
// SENTENCES (Sätze-Wiedergabe im Player)
// ============================================================
//
// Sätze sind generische Audio-Items aus amCollectItems("saetze")
// (Provider "webspace" online, "embed" offline, "sentences-local" für
// Uploads). Kein eigener Datencontainer, kein eigener Ladeweg.
//
// Diese Datei hält: die Satz-Pools (sBuildSequencePool/
// sBuildRecordingPool), die Wiedergabe (sLoadCurrent: laden über
// amGetItemBuffer, RMS-Normalisierung + optionaler Hintergrund-Mix),
// die Sätze-UI (sUpdateUI) und den Upload-Weg (local:-Refs,
// sLocalCollections).

let sCurRec = null;     // aktuell laufendes Item (flaches amProvider-Schema)
let sShownText = "";
let sSentenceBuf = null;        // dekodierter aktueller Satz, getrennt von pFileBuf

// ============================================================
// LOKALE SAMMLUNGEN
// ============================================================
// Map: collectionId -> {
//   id, label, lang, kind ("freiburger-mono"|"freiburger-poly"|
//     "oldenburger-female"|"oldenburger-male"|"oldenburger"|"generic"),
//   folderName (Wurzel-Ordnername, für UI),
//   files: Map<relPath, File>,            // lazy ArrayBuffer-Quelle
//   recordings: Array<{id, text, audioRel}>
// }
let sLocalCollections = new Map();
let sLocalNextId = 1;

function sNewCollectionId() {
  return "local-" + (sLocalNextId++);
}

// BA558: Satz-Pool nach paralleler Achsen-Auswahl. Basis = sortierte
// Gesamt-Sequenz der aktuellen Sprache (sBuildSequencePool), dann durch
// die Achsen-Tabelle gefiltert (amItemMatchesAxes). Kein Sprecher-
// Sonderfall mehr.
function sBuildRecordingPool() {
  const curLang = (typeof plContentLang !== "undefined") ? plContentLang : "de";
  const sel = (typeof plSentAxisSel !== "undefined") ? plSentAxisSel : {};
  // Stempel-Cache-Key aus Sprache + serialisierter Achsen-Auswahl.
  const selKey = Object.keys(sel).sort().map(function (k) { return k + "=" + sel[k]; }).join("&");
  return _amCacheGet("saetze", "recpool:" + curLang + ":" + selKey, function () {
    const base = sBuildSequencePool();   // schon sprach-gefiltert + sortiert
    const axes = (typeof amSortAxesFor === "function") ? amSortAxesFor("saetze") : [];
    // Nur die parallelen Achsen (ohne lang) fuer den Match.
    const parAxes = axes.filter(function (a) { return a.key !== "lang"; });
    if (typeof amItemMatchesAxes !== "function") return base;
    return base.filter(function (it) { return amItemMatchesAxes(parAxes, sel, it); });
  });
}

// BA258: Sequenzpool aller aktuell verfuegbaren Aufnahmen, sortiert
// pro Sprecher blockweise (DE zuerst, sonst alphabetisch nach
// speaker_id), innerhalb eines Sprechers nach recording.id.
function sBuildSequencePool() {
  const curLang = (typeof plContentLang !== "undefined") ? plContentLang : "de";
  // BA348: Stempel-Cache (analog amCollectItems). Die teure Gruppierung +
  // localeCompare-Sortierung lief pro Bedien-Klick 2-10x -> ~190 ms je Aufbau,
  // in Summe sekundenlange UI-Blockaden. Jetzt sitzungsweit gecacht, Neuaufbau
  // nur bei Stempel-Aenderung.
  return _amCacheGet("saetze", "seqpool:" + curLang, function () {
    const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
    const baseLang = (typeof _amBaseLang === "function") ? _amBaseLang(curLang) : curLang;
    const filtered = all.filter(function (it) {
      // BA351: lang_any-Items (Dateiupload) immer im Sequenz-Pool.
      // Basissprach-Vergleich (BA564): "de" schliesst de-* ein, "zh" alle zh-*.
      return it && it.tags && (
        ((typeof _amBaseLang === "function") ? _amBaseLang(it.tags.lang) : it.tags.lang) === baseLang
        || it.tags.lang_any === "y"
      );
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
  });
}


// Laedt den aktuellen Satz, normalisiert den Vordergrund per RMS,
// schreibt sSentenceBuf und ruft pSetPlaybackMode("saetze"). Der
// Hintergrundmix ist herausgeloest (siehe 00-player-engine-architektur.md).
// Ruft KEIN pPlay — Aufrufer macht das.
// Gibt Promise zurueck; wirft bei Ladefehler.
async function sLoadCurrent() {
  if (!sCurRec) return;
  const audioRef = sCurRec.audio;
  // Schlankes Boxen-Bündel: audio wird erst per amGetItemBuffer (Detail-Anreicherung)
  // gesetzt; detail-Offset vorhanden => kein Fehler hier.
  if (!audioRef && !sCurRec.detail) { sStop(); throw new Error("kein audio-Ref"); }

  const c = gPC();
  // Ein Ladeweg fuer alle: die zentrale Ladestelle. Lokale Upload-Dateien
  // erkennt sie am item._file (vom Provider gesetzt), Web-Refs per fetch.
  const decoded = await amGetItemBuffer(c, sCurRec);
  if (!decoded) { sStop(); throw new Error("Audio nicht ladbar: " + audioRef); }
  if (plActiveSource !== "saetze") return;

  // BA327: Vordergrund immer RMS-normalisieren (kein Schalter). Einziger
  // postDecode-Schritt der Kategorie Saetze.
  const normItem = sCurRec;
  const finalBuf = amGetNormalizedSentenceBuffer(c, normItem, decoded);

  sSentenceBuf = finalBuf;
  pSetPlaybackMode("saetze");
  pOff = 0;
  pDrawEQ();
  document.getElementById("plEqViz").style.display = "";
  sShownText = sCurRec.text || "";
  sUpdateTextBox();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}


// Direkt-Buffer-Eingang der Saetze-Kategorie (Sprachtest, Architektur SS4.1).
// Setzt einen FERTIGEN Buffer als aktives Saetze-Item -- dieselbe Schreibstelle
// wie sLoadCurrent (sSentenceBuf + pSetPlaybackMode("saetze")), aber ohne
// Laden/Normalisieren. Ruft KEIN pPlay -- der Aufrufer macht das.
function sSetDirectBuffer(buf, text) {
  sSentenceBuf = buf;
  pSetPlaybackMode("saetze");
  pOff = 0;
  pDrawEQ();
  const viz = document.getElementById("plEqViz");
  if (viz) viz.style.display = "";
  sShownText = (typeof text === "string") ? text : "";
  sUpdateTextBox();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

function sStop() {
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  // BA386: pSetPlaybackMode loescht den Play-Wunsch nicht mehr -> hier
  // explizit beenden. sStop ist ein echter Stopp (kein audio-Ref, kein
  // Sprecher/Pool mehr); kann aus aktivem Play-Wunsch heraus laufen.
  if (typeof _pSetPlayWish === "function") _pSetPlayWish(false);
  pOff = 0;
  if (typeof pSetPlaybackMode === "function") {
    pSetPlaybackMode("musik");
  }
  if (typeof pUpdTL === "function") pUpdTL();
  sShownText = "";
  sUpdateTextBox();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

// BA558: Ersetzt den alten Sprecher-Dropdown-Refresh. Baut die
// Saetze-Filterkette neu (parallel-axes-Engine rendert die Boxen).
function sRefreshSpeakerDropdown() {
  if (typeof PL_FILTER_DECL !== "undefined" && PL_FILTER_DECL.saetze
      && typeof plBuildFilterChain === "function") {
    plBuildFilterChain(PL_FILTER_DECL.saetze);
  }
}

function sUpdateUI() {
  if (typeof lang === "undefined") return;
  const card = document.getElementById("plSubSentences");
  if (!card) return;

  const ctrls = document.getElementById("plSentControls");
  const noMat = document.getElementById("plSentNoMaterial");
  const notReady = document.getElementById("plSentNotReady");
  const hasMaterial = sBuildSequencePool().length > 0;
  const axesEl = document.getElementById("plSentAxes");
  if (!hasMaterial) {
    // Unterscheiden: Manifeste der Sprache laden noch ("lädt…") vs. es gibt
    // wirklich kein Material für diese Sprache (Kein-Material-Warnung). Sonst
    // erschiene während des Nachladens fälschlich die Warnung.
    const loading = (typeof amCategoryLoading === "function") && amCategoryLoading("saetze");
    if (notReady) notReady.style.display = loading ? "" : "none";
    if (noMat)    noMat.style.display    = loading ? "none" : "";
    // Controls sichtbar LASSEN, damit die Sprach-Box erreichbar bleibt
    // (sonst kaeme man aus einer leeren Sprache nicht mehr zurueck).
    // Nur die parallelen Achsen ausblenden -- sie haben kein Material.
    if (ctrls) ctrls.style.display = "";
    if (axesEl) axesEl.style.display = "none";
    if (plActiveSource === "saetze") sStop();
    return;
  }
  if (notReady) notReady.style.display = "none";
  if (noMat) noMat.style.display = "none";
  if (ctrls) ctrls.style.display = "";
  if (axesEl) axesEl.style.display = "";
  sRefreshSpeakerDropdown();
  // Falls Sätze laufen und der gewählte Sprecher in dieser Sprache nicht
  // existiert: stoppen (Dropdown ist eh schon umgesprungen auf "any").
  if (plActiveSource === "saetze" && sCurRec) {
    const pool = sBuildRecordingPool();
    if (pool.length === 0) sStop();
  }
  sUpdateButtons();
  sUpdateTextBox();
}


function sUpdateButtons() {
  // BA192: Sätze-spezifische Knöpfe entfernt; Steuerung über zentrale Transport-Leiste
  // BA324: Transport-Leiste aktualisieren, damit hasNext/hasPrev korrekt reflektiert wird.
  if (typeof plUpdTransportUI === "function") plUpdTransportUI();
}

function sUpdateTextBox() {
  // Der Satz-Text wird ueber die zentrale Text-Begleitbox gezeichnet
  // (plUpdDisplay -> plTextBoxRender mit fillReveal). Kein eigener
  // Sichtbarkeits-Pfad mehr.
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

// ============================================================
// LOKALE SAMMLUNGEN
// ============================================================

function sParseGenericManifest(text, audioFilenames) {
  const audioSet = new Set(audioFilenames.map((n) => n.toLowerCase()));
  const candidates = [
    /^\s*([^\s,;:\t]+\.(?:wav|mp3|ogg|flac|m4a))\s*[:,;|\t]\s*(.+?)\s*$/i,
    /^\s*"?([^"\s,;:\t]+\.(?:wav|mp3|ogg|flac|m4a))"?\s*[,;|\t:]\s*"?(.+?)"?\s*$/i,
    /^(.+\.(?:wav|mp3|ogg|flac|m4a))\s*:\s*(.+?)\s*$/i,
  ];
  let best = new Map();
  for (const re of candidates) {
    const map = new Map();
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim().replace(/^﻿/, "");
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
  for (const f of allFiles) {
    if (!/\.(txt|csv|tsv)$/i.test(f.name)) continue;
    if (f.size > 5 * 1024 * 1024) continue;
    try {
      const txt = await f.text();
      const map = sParseGenericManifest(txt, audioFilenames);
      if (map.size > 0) return map;
    } catch (e) { /* skip */ }
  }
  return new Map();
}

// BA323: IndexedDB-Subsystem (S_IDB_*, sIdbOpen/Put/Get/Del) entfernt.
// Lokale Sammlungen werden nicht mehr sitzungsübergreifend gespeichert.

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

// BA559: Ordner-Upload tag-arm. Ein Ordner -> eine Quelle
// "Upload: <Ordnername>", alle Audio-Dateien als Pool-Items. Keine
// datensatz-spezifische Formaterkennung mehr (nach .archiv/ ausgelagert).
// Optionales generisches Text-Manifest (Dateiname->Satztext) wird noch
// gelesen, wenn vorhanden; fehlt es, bleiben die Items text-los.
async function sIngestLocalFolder(fileList) {
  const all = Array.from(fileList);
  if (all.length === 0) return;

  const firstRel = all[0].webkitRelativePath || all[0].name;
  const folderName = firstRel.split("/")[0] || "Ordner";

  const audioFiles = all.filter((f) => /\.(wav|mp3|ogg|flac|m4a)$/i.test(f.name));
  if (audioFiles.length === 0) {
    alert(t("sentLocalNoAudio"));
    return;
  }

  const filesMap = new Map();
  for (const f of audioFiles) filesMap.set(f.webkitRelativePath, f);

  // Optionales generisches Text-Manifest (unveraendert, tag-arm).
  const audioNames = audioFiles.map((f) => f.name);
  const textMap = await sLoadGenericManifest(all, audioNames);

  const cid = sNewCollectionId();
  const recs = sBuildGenericRecordings(audioFiles, textMap, cid);
  sLocalCollections.set(cid, {
    id: cid,
    label: "Upload: " + folderName,   // NICHT uebersetzt (Ordnername ist Nutzer-Text)
    lang_any: "y",                    // in allen Sprachen sichtbar (Architektur SS6.2)
    kind: "generic",
    folderName, files: filesMap, recordings: recs
  });

  sUpdateUI();
}

// BA351: Einzeldatei-Upload als Sprecher "Dateiupload" (sammelnd, sprach-
// unabhaengig sichtbar). Genau eine Sammlung "upload"; jede Datei = ein Satz.
function sAddLocalFile(file) {
  if (!file) return null;
  var cid = "upload";
  var coll = sLocalCollections.get(cid);
  if (!coll) {
    coll = {
      id: cid,
      label: (typeof t === "function") ? t("plUploadSourceFile") : "Dateiupload",
      lang: null,
      lang_any: "y",          // immer sichtbar, unabhaengig von der Inhalts-Sprache
      kind: "upload",
      folderName: (typeof t === "function") ? t("plUploadSourceFile") : "Dateiupload",
      files: new Map(),
      recordings: []
    };
    sLocalCollections.set(cid, coll);
  }
  var rel = file.name;
  if (coll.files.has(rel)) return coll;   // schon vorhanden -> keine Dublette
  coll.files.set(rel, file);
  coll.recordings.push({
    id: "loc-" + (coll.recordings.length + 1),
    text: file.name.replace(/\.[^.]+$/, ""),
    audio: "local:" + cid + ":" + rel
  });
  return coll;
}

// BA351: sIngestFromHandle (FSAA-Ordnerpicker) und sRefreshLocalList (Ordner-
// Liste) entfernt — Ordner-Upload laeuft jetzt ueber die zentrale upload-Stage.

// BA323: sRemoveLocalCollection, sRestoreLocalCollections, sReloadStubCollection entfernt.

// ============================================================
// Verdrahtung
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  // BA351: Sätze-Upload läuft über die zentrale upload-Stage
  // (PL_FILTER_DECL.saetze) — keine eigene Verdrahtung, kein FSAA-Picker mehr.
});

// ============================================================
// BA197: amProvider — lokale User-Sammlungen als Sätze-Quelle
// ============================================================

if (typeof amRegisterProvider === "function") {
  amRegisterProvider({
    id: "sentences-local",
    listItems: function (category) {
      if (category !== "saetze") return [];
      if (!sLocalCollections || sLocalCollections.size === 0) return [];
      const out = [];
      for (const [cid, coll] of sLocalCollections) {
        const recs = Array.isArray(coll.recordings) ? coll.recordings : [];
        for (const r of recs) {
          if (!r || !r.audio) continue;
          // Generischer lokaler Ladeweg: File aus der Sammlung ans Item haengen.
          // r.audio hat die Form "local:<cid>:<relPath>"; relPath ist der Teil
          // nach dem zweiten ":". coll.files ist Map<relPath, File>.
          let localFile = null;
          if (typeof r.audio === "string" && r.audio.indexOf("local:") === 0) {
            const second = r.audio.indexOf(":", 6);
            const rel = (second >= 0) ? r.audio.substring(second + 1) : null;
            if (rel && coll.files) localFile = coll.files.get(rel) || null;
          }
          out.push({
            id: "sentences-local:" + cid + ":" + (r.id || ""),
            title: coll.label || cid,
            text: r.text || "",
            audio: r.audio,
            _file: localFile,
            sourceTitle: coll.label || cid,
            license: coll.license || null,
            credit:  coll.credit  || null,
            tags: {
              lang: coll.lang || null,
              lang_any: coll.lang_any || null,
              speaker_id: cid,
              gender: r.gender || coll.gender || "u",
              style: coll.style || null
            }
          });
        }
      }
      return out;
    }
  });
}
