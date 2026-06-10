// ============================================================
// SENTENCES (Sätze-Wiedergabe im Player, Etappe 2: Pools)
// ============================================================
//
// Lädt sentences.json mit sprecher-zentriertem Schema:
//   speakers.<key>.recordings = [{id, text, audio, ...}, ...]
//
// Wiedergabe nutzt denselben Audiograph wie Musikdateien.
// Bei Sprecher-Wahl "any" werden recordings aller verfügbaren
// Sprecher flach gemischt und gleichverteilt zufällig gezogen.

let sCorpus = null;
let sLoaded = false;
let sLoading = false;
let sActive = false;
let sCurRec = null;     // aktuell laufendes Item (flaches amProvider-Schema)
let sShownText = "";
let sPrevRec = null;            // BA258: 1x-Memory fuer Zufall-Zurueck
let sSentenceBuf = null;        // dekodierter aktueller Satz, getrennt von pFileBuf
let sPauseTimer = null;
let sPauseMsVal = 2000;
let sOfflineMode = false;      // true = fetch hat versagt, nutze Embed
let sEmbedLoading = new Set(); // Sprachen, deren Embed gerade lädt

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

function sPauseMs() { return sPauseMsVal; }

function sPauseSetActive(ms) {
  sPauseMsVal = ms;
  const container = document.getElementById("plSentPauseBtns");
  if (!container) return;
  for (const btn of container.querySelectorAll("button")) {
    const active = parseInt(btn.dataset.ms, 10) === ms;
    btn.style.opacity = active ? "1" : "0.4";
    btn.style.fontWeight = active ? "600" : "";
  }
}

async function sLoadIfNeeded() {
  if (sLoaded || sLoading) return;
  sLoading = true;
  try {
    const res = await fetch("assets/sentences/sentences.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    sCorpus = await res.json();
    sLoaded = true;
    sOfflineMode = false;
  } catch (err) {
    console.warn("[sentences] online fetch fehlgeschlagen, wechsle in Embed-Modus:", err);
    sOfflineMode = true;
    sCorpus = { speakers: {} };
    sLoaded = true;
    // Aktuelle Sprache als Embed nachladen
    if (typeof lang !== "undefined") {
      await sEnsureEmbedForLang(lang);
    }
  } finally {
    sLoading = false;
    sUpdateUI();
  }
}

// Lädt assets/sentences/embed/<lang>.js per <script>-Tag (file://-kompatibel),
// merged die Sprecher in sCorpus. No-op wenn online oder schon geladen.
async function sEnsureEmbedForLang(langCode) {
  if (!sOfflineMode) return;
  if (!langCode) return;
  if (sEmbedLoading.has(langCode)) return;
  // Schon geladen? Wenn irgendein Sprecher in der Sprache existiert: ja.
  for (const k in sCorpus.speakers) {
    if (sCorpus.speakers[k].lang === langCode) return;
  }
  sEmbedLoading.add(langCode);
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "assets/sentences/embed/" + langCode + ".js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("embed " + langCode + " nicht ladbar"));
      document.head.appendChild(s);
    });
    const data = window.SENTENCES_EMBED && window.SENTENCES_EMBED[langCode];
    if (data && data.speakers) {
      for (const k in data.speakers) {
        sCorpus.speakers[k] = data.speakers[k];
      }
    }
  } catch (err) {
    console.warn("[sentences] kein Embed für", langCode, ":", err.message);
  } finally {
    sEmbedLoading.delete(langCode);
    sUpdateUI();
  }
}

// Alle Sprecher-Keys für eine Sprache (z.B. "de" -> ["thorsten", "cv-de"]).
function sSpeakersForLang(langCode) {
  if (!sCorpus || !sCorpus.speakers) return [];
  return Object.keys(sCorpus.speakers)
    .filter((k) => sCorpus.speakers[k].lang === langCode);
}

function sBuildRecordingPool(spkSel) {
  const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
  const curLang = (typeof lang !== "undefined") ? lang : "de";
  return all.filter(function (it) {
    if (!it.tags || it.tags.lang !== curLang) return false;
    if (spkSel === "any") return true;
    return it.tags.speaker_id === spkSel;
  });
}

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

function sPickRandom(pool, exclude) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (exclude && pick.id === exclude.id && pool.length > 1);
  return pick;
}

function sDataUrlToArrayBuffer(url) {
  // "data:audio/mp3;base64,XXXX" -> ArrayBuffer
  const comma = url.indexOf(",");
  const b64 = url.substring(comma + 1);
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function sPlayCurrent() {
  if (!sActive || !sCurRec) return;
  const audioRef = sCurRec.audio;
  if (!audioRef) { sStop(); return; }
  try {
    let arrayBuf;
    if (audioRef.indexOf("data:") === 0) {
      arrayBuf = sDataUrlToArrayBuffer(audioRef);
    } else if (audioRef.indexOf("local:") === 0) {
      // Form: "local:<cid>:<relPath>"
      const second = audioRef.indexOf(":", 6);
      const cid = audioRef.substring(6, second);
      const rel = audioRef.substring(second + 1);
      const coll = sLocalCollections.get(cid);
      if (!coll) throw new Error("Lokale Sammlung " + cid + " nicht (mehr) verfügbar");
      const file = coll.files.get(rel);
      if (!file) throw new Error("Datei " + rel + " nicht in Sammlung " + cid);
      arrayBuf = await file.arrayBuffer();
    } else if (/^(https?:|blob:)/i.test(audioRef)) {
      const res = await fetch(audioRef, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      arrayBuf = await res.arrayBuffer();
    } else {
      // Relativ — Alt-Verhalten: unter assets/sentences/ suchen.
      const res = await fetch("assets/sentences/" + audioRef);
      if (!res.ok) throw new Error("HTTP " + res.status);
      arrayBuf = await res.arrayBuffer();
    }
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return;

    // BA194: Hintergrund-Geraeusch ggf. einmischen.
    let finalBuf = decoded;
    if (typeof plSentBgEnabled !== "undefined" && plSentBgEnabled
        && typeof plSentBgItemId !== "undefined" && plSentBgItemId
        && typeof amCollectItems === "function") {
      try {
        const allBg = amCollectItems("geraeusche");
        const bgItem = allBg.find(function (it) { return it.id === plSentBgItemId; });
        if (bgItem) {
          const bgBuf = await amGetNormalizedNoiseBuffer(c, bgItem);
          if (bgBuf) {
            finalBuf = amMixForeground(c, audioRef, decoded, bgItem, bgBuf, plSentBgSnrDb);
          }
        }
      } catch (mixErr) {
        console.warn("[sentences] Hintergrund-Mix fehlgeschlagen:", mixErr);
        finalBuf = decoded;
      }
      if (!sActive) return;
    }

    sSentenceBuf = finalBuf;
    pSetPlaybackMode("sentence");
    pOff = 0;
    pDrawEQ();
    pBuildTbl();
    document.getElementById("plEqViz").style.display = "";
    sShownText = sCurRec.text || "";
    sUpdateTextBox();
    if (typeof plUpdDisplay === "function") plUpdDisplay();
    await pPlay();
  } catch (err) {
    console.error("[sentences] Wiedergabe-Fehler:", err);
    sStop();
  }
}

function sPlay() {
  if (!sLoaded) return;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
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
  sActive = true;
  sPlayCurrent();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

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

function sStop() {
  sActive = false;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  pOff = 0;
  if (typeof pSetPlaybackMode === "function") {
    pSetPlaybackMode("file");
  }
  if (typeof pUpdTL === "function") pUpdTL();
  sShownText = "";
  sUpdateTextBox();
  if (typeof plUpdDisplay === "function") plUpdDisplay();
}

// Wird von player.js nach onended aufgerufen, falls sActive=true.
function sOnEnded() {
  if (!sActive) return;

  // Loop hat Vorrang: gleichen Satz nochmal — den bereits dekodierten
  // sSentenceBuf wiederverwenden (kein Re-Decode, keine Warp-Neuberechnung).
  if (typeof plLoop !== "undefined" && plLoop) {
    const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
    const restart = function () {
      sPauseTimer = null;
      if (!sActive || !plLoop) return;
      if (typeof pPlay === "function") pPlay();
    };
    if (ms > 0) {
      sPauseTimer = setTimeout(restart, ms);
    } else {
      restart();
    }
    return;
  }

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

  // Weder Loop noch Auto-Advance: still anhalten
  sStop();
}

// Befüllt das Sprecher-Dropdown dynamisch je nach aktueller Tool-Sprache.
function sRefreshSpeakerDropdown() {
  const sel = document.getElementById("plSentSpeaker");
  if (!sel) return;
  const prev = sel.value;

  const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
  const curLang = (typeof lang !== "undefined") ? lang : "de";
  const itemsInLang = all.filter(function (it) {
    return it.tags && it.tags.lang === curLang;
  });

  // Sprecher-Map aufbauen (Reihenfolge stabil: nach erstem Auftreten)
  const speakerMap = new Map(); // speaker_id -> { label, sourceTitle }
  for (const it of itemsInLang) {
    const sid = it.tags.speaker_id || "unbekannt";
    if (!speakerMap.has(sid)) {
      speakerMap.set(sid, {
        label: it.title || sid,
        sourceTitle: it.sourceTitle || ""
      });
    }
  }

  while (sel.firstChild) sel.removeChild(sel.firstChild);

  const optAll = document.createElement("option");
  optAll.value = "any";
  optAll.textContent = (typeof t === "function") ? t("sentSpkAll") : "Alle";
  sel.appendChild(optAll);

  for (const [sid, meta] of speakerMap) {
    const opt = document.createElement("option");
    opt.value = sid;
    opt.textContent = meta.sourceTitle && meta.sourceTitle !== meta.label
      ? (meta.label + " — " + meta.sourceTitle)
      : meta.label;
    sel.appendChild(opt);
  }

  if (Array.from(speakerMap.keys()).includes(prev) || prev === "any") {
    sel.value = prev;
  } else {
    sel.value = "any";
  }

  sel.onchange = function () {
    const v = sel.value;
    const coll = sLocalCollections.get(v);
    if (coll && coll.stub) {
      sReloadStubCollection(v);
    }
  };
}

function sUpdateUI() {
  if (typeof lang === "undefined") return;
  const card = document.getElementById("plSubSentences");
  if (!card) return;

  // Im Offline-Mode bei Sprachwechsel ggf. Embed nachladen.
  // (fire-and-forget; sUpdateUI wird beim Embed-Load-Ende erneut gerufen.)
  if (sOfflineMode && sLoaded) {
    sEnsureEmbedForLang(lang);
  }

  const ctrls = document.getElementById("plSentControls");
  const noMat = document.getElementById("plSentNoMaterial");
  const notReady = document.getElementById("plSentNotReady");
  if (!sLoaded) {
    if (notReady) notReady.style.display = "";
    if (noMat) noMat.style.display = "none";
    if (ctrls) ctrls.style.display = "none";
    return;
  }
  if (notReady) notReady.style.display = "none";
  const speakers = sSpeakersForLang(lang);
  if (speakers.length === 0) {
    if (noMat) noMat.style.display = "";
    if (ctrls) ctrls.style.display = "none";
    if (sActive) sStop();
    return;
  }
  if (noMat) noMat.style.display = "none";
  if (ctrls) ctrls.style.display = "";
  sRefreshSpeakerDropdown();
  // Falls Sätze laufen und der gewählte Sprecher in dieser Sprache nicht
  // existiert: stoppen (Dropdown ist eh schon umgesprungen auf "any").
  if (sActive && sCurRec) {
    const curSpk = sCurRec.tags && sCurRec.tags.speaker_id;
    if (curSpk) {
      const pool = sBuildRecordingPool(curSpk);
      if (pool.length === 0) sStop();
    }
  }
  sUpdateButtons();
  sUpdateTextBox();
}

function sUpdateButtons() {
  // BA192: Sätze-spezifische Knöpfe entfernt; Steuerung über zentrale Transport-Leiste
}

function sUpdateTextBox() {
  const show = document.getElementById("plSentShowText");
  const box  = document.getElementById("plSentTextBox");
  const txt  = document.getElementById("plSentText");
  if (!show || !box || !txt) return;
  if (show.checked && sShownText) {
    txt.textContent = sShownText;
    box.style.display = "";
  } else {
    box.style.display = "none";
  }
}

// ============================================================
// LOKALE SAMMLUNGEN — HEURISTIK
// ============================================================

function sDetectFreiburger(audioFiles) {
  let mono = [], poly = [];
  for (const f of audioFiles) {
    const parts = f.webkitRelativePath.split("/");
    if (parts.length < 4) continue;
    const sub = parts[1];
    const listDir = parts[2];
    const name = parts[parts.length - 1];
    if (!/^Testliste_\d+$/i.test(listDir)) continue;
    if (!/^L\d+_W\d+_/i.test(name)) continue;
    if (/Einsilbig/i.test(sub)) mono.push(f);
    else if (/Mehrsilbig/i.test(sub)) poly.push(f);
  }
  if (mono.length === 0 && poly.length === 0) return null;
  return { mono, poly };
}

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

async function sLoadOldenburgerManifest(allFiles) {
  for (const f of allFiles) {
    if (/sentences_OLSA.*\.txt$/i.test(f.name)) {
      const txt = await f.text();
      return sParseOldenburgerManifest(txt);
    }
  }
  return new Map();
}

function sParseOldenburgerManifest(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^﻿/, "");
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const filename = line.substring(0, idx).trim();
    const sentence = line.substring(idx + 1).trim();
    if (filename && sentence) map.set(filename, sentence);
  }
  return map;
}

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

async function sIngestLocalFolder(fileList) {
  const all = Array.from(fileList);
  if (all.length === 0) return;

  const firstRel = all[0].webkitRelativePath || all[0].name;
  const folderName = firstRel.split("/")[0] || "Ordner";

  const audioFiles = all.filter((f) =>
    /\.(wav|mp3|ogg|flac|m4a)$/i.test(f.name)
  );
  if (audioFiles.length === 0) {
    alert(t("sentLocalNoAudio"));
    return;
  }

  const fb = sDetectFreiburger(audioFiles);
  const old = sDetectOldenburger(audioFiles);

  const created = [];
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
    const audioNames = audioFiles.map((f) => f.name);
    const textMap = await sLoadGenericManifest(all, audioNames);
    if (textMap.size === 0) {
      console.log("[sentences/local] kein Manifest gefunden —", t("sentLocalUnknownFormat"));
    }
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
  sUpdateUI();
}

// Liest rekursiv alle Dateien aus einem FileSystemDirectoryHandle und ruft
// sIngestLocalFolder mit einer FileList-ähnlichen Struktur auf. Setzt
// webkitRelativePath analog zum webkitdirectory-Verhalten.
async function sIngestFromHandle(rootHandle, handleId) {
  const files = [];
  async function walk(dirHandle, relPrefix) {
    for await (const [name, entry] of dirHandle.entries()) {
      if (entry.kind === "file") {
        const f = await entry.getFile();
        const rel = relPrefix + name;
        try {
          Object.defineProperty(f, "webkitRelativePath", {
            value: rel, configurable: true,
          });
        } catch (e) {
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

  const before = new Set(sLocalCollections.keys());
  await sIngestLocalFolder(files);
  const newCids = [];
  for (const k of sLocalCollections.keys()) {
    if (!before.has(k)) newCids.push(k);
  }

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
    let suffix;
    if (coll.stub) {
      suffix = "  " + t("sentLocalNotLoaded") + " · " + coll.folderName;
    } else {
      suffix = "  (" + coll.recordings.length + " · " + coll.folderName + ")";
    }
    lbl.textContent = coll.label + suffix;
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

async function sRemoveLocalCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll) return;
  if (sActive && sCurRec && sCurRec.tags && sCurRec.tags.speaker_id === cid) {
    sStop();
  }
  sLocalCollections.delete(cid);
  delete sCorpus.speakers[cid];
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

// Wird nach JSON-Load aufgerufen. Versucht für jede Sammlung mit
// handleId den FSAA-Handle aus IndexedDB zu holen und neu zu mounten.
// Bei Erfolg: Sammlung ist sofort verfügbar.
// Bei Mißerfolg (kein Handle, keine Permission, Firefox): Stub-Sprecher.
async function sRestoreLocalCollections(metaArr) {
  for (const meta of metaArr) {
    if (sLocalCollections.has(meta.id)) continue;
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

async function sReloadStubCollection(cid) {
  const coll = sLocalCollections.get(cid);
  if (!coll || !coll.stub) return;
  const hint = t("sentLocalReloadHint") + " " + coll.folderName;
  if (coll.handleId && sFsaaAvailable()) {
    try {
      const rec = await sIdbGet(coll.handleId);
      const opts = { id: "ci-sound-saetze", mode: "read" };
      if (rec && rec.handle) opts.startIn = rec.handle;
      const handle = await window.showDirectoryPicker(opts);
      sLocalCollections.delete(cid);
      delete sCorpus.speakers[cid];
      await sIngestFromHandle(handle, coll.handleId);
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
      console.warn("[sentences/local] FSAA reload failed, fallback:", err);
    }
  }
  alert(hint);
  const li = document.getElementById("plSentLocalInput");
  if (li) {
    li.value = "";
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

// ============================================================
// Verdrahtung
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  // BA192: alte Sätze-spezifische Knöpfe entfernt; Steuerung über zentrale
  // Transport-Leiste in player.js. Nur noch lokale Sammlungen verdrahten.

  const localAdd = document.getElementById("plSentLocalAddBtn");
  const localInput = document.getElementById("plSentLocalInput");
  if (localAdd && localInput) {
    localAdd.addEventListener("click", async function () {
      if (sFsaaAvailable()) {
        try {
          const handle = await window.showDirectoryPicker({
            id: "ci-sound-saetze",
            mode: "read",
            startIn: "music",
          });
          await sIngestFromHandle(handle, null);
        } catch (err) {
          if (err && err.name !== "AbortError") {
            console.error("[sentences/local] picker failed:", err);
            localInput.value = "";
            localInput.click();
          }
        }
      } else {
        localInput.value = "";
        localInput.click();
      }
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

  sLoadIfNeeded();
});

// ============================================================
// BA197: amProvider — sCorpus als Sätze-Quelle exponieren
// ============================================================

if (typeof amRegisterProvider === "function") {
  amRegisterProvider({
    id: "sentences-legacy",
    listItems: function (category) {
      if (category !== "saetze") return [];
      if (!sLoaded || !sCorpus || !sCorpus.speakers) return [];
      const out = [];
      const speakers = sCorpus.speakers;
      for (const spkKey in speakers) {
        const spk = speakers[spkKey];
        if (!spk || !Array.isArray(spk.recordings)) continue;
        const speakerLabel = spk.label || spkKey;
        const lang_       = spk.lang  || null;
        const sourceTitle = spk.source || spk.label || "Eingebaut";
        const license     = spk.license || null;
        const credit      = spk.credit  || null;
        for (let i = 0; i < spk.recordings.length; i++) {
          const r = spk.recordings[i];
          if (!r || !r.audio) continue;
          out.push({
            id: "sentences-legacy:" + spkKey + ":" + (r.id || String(i)),
            title: speakerLabel,
            text: r.text || "",
            audio: r.audio,
            duration: r.duration,
            sourceTitle: sourceTitle,
            license: license,
            credit:  credit,
            tags: {
              lang: lang_,
              speaker_id: spkKey,
              gender: spk.gender || "u",
              style: spk.style || null
            }
          });
        }
      }
      return out;
    }
  });
}

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
          out.push({
            id: "sentences-local:" + cid + ":" + (r.id || ""),
            title: coll.label || cid,
            text: r.text || "",
            audio: r.audio,
            sourceTitle: coll.label || cid,
            license: coll.license || null,
            credit:  coll.credit  || null,
            tags: {
              lang: coll.lang || null,
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
