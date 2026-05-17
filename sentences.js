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
let sCurRec = null;     // aktuell laufende Recording {speakerKey, idx}
let sShownText = "";
let sPauseTimer = null;
let sPauseMsVal = 2000;

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
  } catch (err) {
    console.error("[sentences] konnte sentences.json nicht laden:", err);
    sCorpus = { speakers: {} };
    sLoaded = true;
  } finally {
    sLoading = false;
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

function sPickNext(mode, pool, prev) {
  if (pool.length === 0) return null;
  if (mode === "loop") return prev || pool[0];
  if (mode === "random") {
    if (pool.length === 1) return pool[0];
    let pick;
    do {
      pick = pool[Math.floor(Math.random() * pool.length)];
    } while (prev && pick.speakerKey === prev.speakerKey
                  && pick.recIdx === prev.recIdx);
    return pick;
  }
  // "once": nicht weiter
  return null;
}

async function sPlayCurrent() {
  if (!sActive || !sCurRec) return;
  const url = "assets/sentences/" + sCurRec.rec.audio;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arrayBuf = await res.arrayBuffer();
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

function sStart() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) {
    sUpdateUI();
    return;
  }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  sActive = true;
  const mode = document.getElementById("plSentMode").value;
  sCurRec = (mode === "once" || mode === "loop")
    ? pool[0]
    : pool[Math.floor(Math.random() * pool.length)];
  sUpdateButtons();
  sPlayCurrent();
}

function sStop() {
  sActive = false;
  sCurRec = null;
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
  const mode = document.getElementById("plSentMode").value;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  const next = sPickNext(mode, pool, sCurRec);
  if (!next) {
    sStop();
    return;
  }
  sCurRec = next;
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
  const start = document.getElementById("plSentStart");
  const stop  = document.getElementById("plSentStop");
  if (start) start.disabled = sActive;
  if (stop)  stop.disabled  = !sActive;
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
  const start = document.getElementById("plSentStart");
  const stop  = document.getElementById("plSentStop");
  const show  = document.getElementById("plSentShowText");
  if (start) start.addEventListener("click", sStart);
  if (stop)  stop.addEventListener("click",  sStop);
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
