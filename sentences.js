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
let sEndless = false;
let sEndlessCount = 0;
let sCurRec = null;     // aktuell laufende Recording {speakerKey, idx}
let sShownText = "";
let sPauseTimer = null;
let sPauseMsVal = 2000;
let sOfflineMode = false;      // true = fetch hat versagt, nutze Embed
let sEmbedLoading = new Set(); // Sprachen, deren Embed gerade lädt

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

// Liefert ein Array von {speakerKey, recIdx, rec}-Einträgen,
// das die Auswahl-Vorgabe widerspiegelt.
//   spkSel === "any"  -> alle Sprecher der Sprache, flach
//   spkSel === "<key>" -> nur dieser Sprecher
function sBuildRecordingPool(spkSel) {
  if (typeof lang === "undefined") return [];
  const speakers = sSpeakersForLang(lang);
  const keys = spkSel === "any"
    ? speakers
    : speakers.includes(spkSel) ? [spkSel] : [];
  const out = [];
  for (const k of keys) {
    const recs = sCorpus.speakers[k].recordings || [];
    for (let i = 0; i < recs.length; i++) {
      out.push({ speakerKey: k, recIdx: i, rec: recs[i] });
    }
  }
  return out;
}

function sPickRandom(pool, exclude) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (
    exclude
    && pick.speakerKey === exclude.speakerKey
    && pick.recIdx === exclude.recIdx
  );
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
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return;
    pSourceBuf = decoded;
    pMonoBuf = null;
    pLeftOnlyBuf = null;
    pRightOnlyBuf = null;
    if (typeof pWarpedBuf !== "undefined") {
      pWarpedBuf = null;
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    }
    pOff = 0;
    pBuf = getPlaybackBuffer();
    pBuildEQ();
    pDrawEQ();
    pBuildTbl();
    document.getElementById("plCtrl").style.display = "";
    document.getElementById("plEqViz").style.display = "";
    document.getElementById("plTL").value = 0;
    document.getElementById("plCur").textContent = "0:00";
    if (typeof pFmt === "function") {
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
    }
    sShownText = sCurRec.rec.text || "";
    sUpdateTextBox();
    await pPlay();
  } catch (err) {
    console.error("[sentences] Wiedergabe-Fehler:", err);
    sStop();
  }
}

function sPlay() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  if (!sCurRec) {
    sCurRec = sPickRandom(pool, null);
  }
  sActive = true;
  sEndless = false;
  sUpdateButtons();
  sPlayCurrent();
}

function sNext() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  sCurRec = sPickRandom(pool, sCurRec);
  sActive = true;
  sEndless = false;
  sUpdateButtons();
  sPlayCurrent();
}

function sEndlessStart() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  sCurRec = sPickRandom(pool, sCurRec);
  sActive = true;
  sEndless = true;
  sEndlessCount = 0;
  sUpdateButtons();
  sPlayCurrent();
}

function sStop() {
  sActive = false;
  sEndless = false;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
    pOff = 0;
    if (typeof pUpdTL === "function") pUpdTL();
  }
  sShownText = "";
  sUpdateTextBox();
  sUpdateButtons();
}

// Wird von player.js nach onended aufgerufen, falls sActive=true.
function sOnEnded() {
  if (!sActive) return;
  if (!sEndless) {
    sStop();
    return;
  }
  sEndlessCount++;
  if (sEndlessCount >= 100) { sStop(); return; }
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sStop(); return; }
  sCurRec = sPickRandom(pool, sCurRec);
  const ms = sPauseMs();
  if (ms > 0) {
    sPauseTimer = setTimeout(function () {
      sPauseTimer = null;
      if (sActive) sPlayCurrent();
    }, ms);
  } else {
    sPlayCurrent();
  }
}

// Befüllt das Sprecher-Dropdown dynamisch je nach aktueller Tool-Sprache.
function sRefreshSpeakerDropdown() {
  const sel = document.getElementById("plSentSpeaker");
  if (!sel) return;
  const prev = sel.value;
  const speakers = (typeof lang !== "undefined") ? sSpeakersForLang(lang) : [];
  // Leeren
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  // "Alle" als Default-Option
  const optAll = document.createElement("option");
  optAll.value = "any";
  optAll.textContent = (typeof t === "function") ? t("sentSpkAll") : "Alle";
  sel.appendChild(optAll);
  // pro Sprecher eine Option mit dem speakers.<key>.label
  for (const k of speakers) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = sCorpus.speakers[k].label || k;
    sel.appendChild(opt);
  }
  // Auswahl wiederherstellen, falls noch verfügbar
  if (speakers.includes(prev) || prev === "any") {
    sel.value = prev;
  } else {
    sel.value = "any";
  }
}

function sUpdateUI() {
  if (typeof lang === "undefined") return;
  const card = document.getElementById("plSentencesCard");
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
    if (!speakers.includes(sCurRec.speakerKey)) sStop();
  }
  sUpdateButtons();
  sUpdateTextBox();
}

function sUpdateButtons() {
  const play    = document.getElementById("plSentPlay");
  const next    = document.getElementById("plSentNext");
  const endless = document.getElementById("plSentEndless");
  const stop    = document.getElementById("plSentStop");
  const busy    = sActive;
  if (play)    play.disabled    = busy;
  if (next)    next.disabled    = busy;
  if (endless) endless.disabled = busy;
  if (stop)    stop.disabled    = !busy;
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
// Verdrahtung
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  const play    = document.getElementById("plSentPlay");
  const next    = document.getElementById("plSentNext");
  const endless = document.getElementById("plSentEndless");
  const stop    = document.getElementById("plSentStop");
  const show    = document.getElementById("plSentShowText");
  if (play)    play.addEventListener("click",    sPlay);
  if (next)    next.addEventListener("click",    sNext);
  if (endless) endless.addEventListener("click", sEndlessStart);
  if (stop)    stop.addEventListener("click",    sStop);
  if (show)  show.addEventListener("change", sUpdateTextBox);

  // Pausen-Buttons (falls von Etappe 1 vorhanden) — Logik unverändert.
  const pauseBtns = document.getElementById("plSentPauseBtns");
  if (pauseBtns) {
    for (const btn of pauseBtns.querySelectorAll("button")) {
      btn.addEventListener("click", function () {
        sPauseSetActive(parseInt(this.dataset.ms, 10));
      });
    }
    sPauseSetActive(sPauseMsVal);
  }

  sLoadIfNeeded();
});
