// ============================================================
// SENTENCES (Sätze-Wiedergabe im Player, Etappe 1: nur DE-Mann)
// ============================================================
//
// Lädt sentences.json beim ersten Anzeigen, hält State (Modus,
// Sprecher, aktueller Index). Wiedergabe nutzt denselben Audio-
// graph wie Musikdateien: lädt MP3 -> decodeAudioData -> setzt
// pSourceBuf -> startet via pPlay(). Nach onended (im
// sentence-Mode) wird der nächste Satz geladen.
//
// Mutual Exclusion zur Musikdatei:
//  - Sätze-Start setzt sSentenceMode=true und ruft pPause() falls
//    Musik läuft.
//  - Musik-Start (plPlay-Click) bricht Sätze-Mode ab.

let sCorpus = null;        // sentences.json geparst
let sLoaded = false;
let sLoading = false;
let sActive = false;       // läuft gerade ein Sätze-Modus?
let sCurIdx = -1;          // Index in sCorpus.sentences
let sCurSpkKey = null;     // "de_m", später "de_f" etc.
let sShownText = "";       // aktuell sichtbarer Text
let sPauseTimer = null;    // setTimeout-Handle für Pause zwischen Sätzen
let sPauseMsVal = 2000;    // aktive Pausenlänge in ms

function sPauseMs() {
  return sPauseMsVal;
}

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

// Wird von außen (init / applyLang) gerufen.
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
    sCorpus = { speakers: {}, sentences: [] };
    sLoaded = true; // weiter, sUpdateUI zeigt dann "noch keine Sätze"
  } finally {
    sLoading = false;
    sUpdateUI();
  }
}

// Liste verfügbarer Sprecher-Keys für eine Sprache, z.B. lang="de"
// -> ["de_m"] (in Etappe 1).
function sSpeakersForLang(langCode) {
  if (!sCorpus || !sCorpus.speakers) return [];
  return Object.keys(sCorpus.speakers)
    .filter((k) => sCorpus.speakers[k].lang === langCode);
}

function sSentencesWithAudioFor(spkKey) {
  if (!sCorpus) return [];
  return sCorpus.sentences.filter((s) => s.audio && s.audio[spkKey]);
}

// Wählt Sprecher-Key gemäß UI-Auswahl. spkSel: "m" | "f" | "any".
function sPickSpeakerKey(spkSel) {
  if (typeof lang === "undefined") return null;
  const all = sSpeakersForLang(lang);
  if (all.length === 0) return null;
  if (spkSel === "any") {
    return all[Math.floor(Math.random() * all.length)];
  }
  const wanted = all.find((k) => sCorpus.speakers[k].gender === spkSel);
  return wanted || null;
}

function sPickNextIdx(mode, list, prevIdx) {
  if (list.length === 0) return -1;
  if (mode === "loop") return prevIdx >= 0 ? prevIdx : 0;
  if (mode === "random") {
    if (list.length === 1) return 0;
    let i;
    do {
      i = Math.floor(Math.random() * list.length);
    } while (i === prevIdx);
    return i;
  }
  // "once": nicht weiter
  return -1;
}

async function sPlayCurrent() {
  if (!sActive) return;
  if (sCurIdx < 0 || !sCurSpkKey) return;
  const list = sSentencesWithAudioFor(sCurSpkKey);
  const item = list[sCurIdx];
  if (!item) {
    sStop();
    return;
  }
  const url = "assets/sentences/" + item.audio[sCurSpkKey];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arrayBuf = await res.arrayBuffer();
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return; // Stop während Decode
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
    // Player-UI: Controls einblenden (so wie bei Datei-Upload),
    // Seekbar zurücksetzen.
    document.getElementById("plCtrl").style.display = "";
    document.getElementById("plEqViz").style.display = "";
    document.getElementById("plTL").value = 0;
    document.getElementById("plCur").textContent = "0:00";
    if (typeof pFmt === "function") {
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
    }
    sShownText = item[lang] || item.de || "";
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
  const spk = sPickSpeakerKey(spkSel);
  if (!spk) {
    sUpdateUI();
    return;
  }
  // Falls Musik gerade läuft, pausieren (Mutual Exclusion).
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  sActive = true;
  sCurSpkKey = spk;
  const list = sSentencesWithAudioFor(spk);
  const mode = document.getElementById("plSentMode").value;
  sCurIdx = mode === "loop" || mode === "once"
    ? 0
    : Math.floor(Math.random() * Math.max(1, list.length));
  sUpdateButtons();
  sPlayCurrent();
}

function sStop() {
  sActive = false;
  sCurIdx = -1;
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
  const list = sSentencesWithAudioFor(sCurSpkKey);
  const next = sPickNextIdx(mode, list, sCurIdx);
  if (next < 0) {
    sStop();
    return;
  }
  // Bei "Random" auch Sprecher neu würfeln, falls "any".
  const spkSel = document.getElementById("plSentSpeaker").value;
  if (spkSel === "any" && mode === "random") {
    const spk = sPickSpeakerKey("any");
    if (spk) sCurSpkKey = spk;
  }
  sCurIdx = next;
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
    // Wenn aktuelle Wiedergabe lief und Sprache gewechselt wurde -> stoppen.
    if (sActive) sStop();
    return;
  }
  if (noMat) noMat.style.display = "none";
  if (ctrls) ctrls.style.display = "";
  // Geschlechter, die nicht verfügbar sind, ausgrauen.
  const sel = document.getElementById("plSentSpeaker");
  if (sel) {
    const hasM = speakers.some((k) => sCorpus.speakers[k].gender === "m");
    const hasF = speakers.some((k) => sCorpus.speakers[k].gender === "f");
    for (const o of sel.options) {
      if (o.value === "m") o.disabled = !hasM;
      if (o.value === "f") o.disabled = !hasF;
    }
    if (sel.value === "m" && !hasM) sel.value = hasF ? "f" : "any";
    if (sel.value === "f" && !hasF) sel.value = hasM ? "m" : "any";
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
  const pauseContainer = document.getElementById("plSentPauseBtns");
  if (pauseContainer) {
    pauseContainer.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-ms]");
      if (btn) sPauseSetActive(parseInt(btn.dataset.ms, 10));
    });
    sPauseSetActive(2000);
  }
  sLoadIfNeeded();
});
