// ============================================================
// SPRACHTEST (OLSA) -- Sub-Reiter unter "Messungen"
// Spielt OLSA-Saetze ueber den vorhandenen Player ab (keine zweite
// Wiedergabe), fuehrt den Sprachpegel-SNR adaptiv nach (Tab. 3-1),
// wertet 0-5 richtige Woerter je Satz und ermittelt den SRT.
// Architektur: .docs/spec/00-sprachtest-olsa-architektur.md
// ============================================================

// --- OLSA-Wort-Inventar (fest, je Position 10 Woerter) ---
// Reihenfolge der Positionen: Name, Verb, Zahl, Adjektiv, Objekt.
const ST_INVENTORY = [
  ["Britta", "Doris", "Kerstin", "Nina", "Peter", "Stefan", "Tanja", "Thomas", "Ulrich", "Wolfgang"],
  ["bekommt", "gewann", "gibt", "hat", "kauft", "malt", "nahm", "schenkt", "sieht", "verleiht"],
  ["zwei", "drei", "vier", "fünf", "sieben", "acht", "neun", "elf", "zwölf", "achtzehn"],
  ["alte", "große", "grüne", "kleine", "nasse", "rote", "schöne", "schwere", "teure", "weiße"],
  ["Autos", "Bilder", "Blumen", "Dosen", "Messer", "Ringe", "Schuhe", "Sessel", "Steine", "Tassen"]
];

// --- Adaptionstabelle 3-1 (Diplomarbeit Hinze, Kap. 3.3) ---
// Pegelaenderung des SPRACHpegels in dB fuer den FOLGEsatz, nach Anzahl
// richtiger Woerter (Index 0..5). Grobphase: Saetze 2-5. Feinphase: ab 6.
// WICHTIG (Architektur SS4.3): realisiert wird die Aenderung ueber das
// RAUSCHEN (Hauptaudio fest). Ein negativer Sprachpegel-Schritt = niedrigerer
// SNR. Wir fuehren den SNR-Sollwert direkt: SNR_neu = SNR_alt + delta, wobei
// delta genau die Tabellenwerte sind (mehr verstanden -> SNR sinkt).
const ST_ADAPT_COARSE = { 5: -3, 4: -2, 3: -1, 2: +1, 1: +2, 0: +3 };
const ST_ADAPT_FINE   = { 5: -2, 4: -1, 3:  0, 2:  0, 1: +1, 0: +2 };

const ST_START_SNR = 0;      // erster Satz bei SNR 0 dB
const ST_SNR_MIN = -15;      // Klemmung (Architektur SS4.3)
const ST_SNR_MAX = 21;
const ST_LIST_LEN = 30;      // gewertete Saetze
const ST_TRAIN_LEN = 3;      // Trainingssaetze (zaehlen nicht)
const ST_SRT_WINDOW = 20;    // SRT = Mittel der letzten 20 SNR-Werte
const ST_SRT_WINDOW_CONV = 6;// bei Konvergenz-Abbruch: letzte 6

// --- Modul-Zustand ---
let _st_parentEl = null;     // Panel-Element (im DOMContentLoaded gesetzt)
let ST_els = null;           // Refs aus buildTestPanel
let st_active = false;       // laeuft ein Durchgang?
let st_phase = null;         // "train" | "measure"
let st_seq = [];             // gezogene Satz-Items (Trainingssaetze + 30)
let st_idx = 0;              // Index in st_seq
let st_snr = ST_START_SNR;   // aktueller Ziel-SNR
let st_snrHistory = [];      // SNR je gewertetem Satz (nur measure-Phase)
let st_wordHistory = [];     // richtige Woerter (0..5) je gewertetem Satz
let st_saved = null;         // gesicherter Player-Unterlegungszustand (Restore)

// ------------------------------------------------------------
// Player-Zustand sichern / erzwingen / wiederherstellen (SS4.4)
// ------------------------------------------------------------
function st_savePlayerState() {
  var bothCb = document.getElementById("plBothSides");
  st_saved = {
    maskOn:    plMaskOn,
    maskLevel: plMaskLevelKey,
    noiseId:   plNoiseSelectedId,
    activeSrc: plActiveSource,
    sentRec:   (typeof sCurRec !== "undefined") ? sCurRec : null,
    bothSides: bothCb ? bothCb.checked : false   // "beide Seiten" — fuer den Test aus
  };
}
function st_restorePlayerState() {
  if (!st_saved) return;
  pSetEndedCallback(null);              // BA605: unseren Callback abraeumen
  plMaskSetLevelDb(null);               // BA605: freien SNR loslassen
  plMaskSetOn(!!st_saved.maskOn);
  plMaskSetLevel(st_saved.maskLevel);
  plNoiseSelectedId = st_saved.noiseId;
  // "Beide Seiten" wiederherstellen (einseitig war nur fuer den Test erzwungen).
  var bothCb = document.getElementById("plBothSides");
  if (bothCb && bothCb.checked !== st_saved.bothSides) {
    bothCb.checked = st_saved.bothSides;
    if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
  }
  st_saved = null;
}

// Erzwingt EINSEITIGE Wiedergabe (die global aktive Seite) fuer die Testdauer.
// Der OLSA laeuft je Seite getrennt (ein Ergebnis pro Seite); "beide Seiten"
// waere fachlich falsch. Nutzt den regulaeren Umschaltweg (Checkbox +
// updatePlayerForSideChange), nicht einen Patch an getPlayerSide.
function st_forceSingleSide() {
  var bothCb = document.getElementById("plBothSides");
  if (bothCb && bothCb.checked) {
    bothCb.checked = false;
    if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
  }
}

// Die aktive Seite (fuer Ergebnis-Zuordnung / Anzeige).
function st_currentSide() {
  return (typeof activeSide !== "undefined") ? activeSide : "left";
}

// Setzt das OLSA-Rauschen als aktives Geraeusche-Item und schaltet die
// Unterlegung an. Das OLSA-Rauschen ist das Geraeusche-Item mit test_set OLSA.
function st_forceOlsaNoise() {
  const noise = st_findOlsaNoiseItem();
  if (noise) plNoiseSelectedId = noise.id;
  plMaskSetOn(true);
}

// ------------------------------------------------------------
// Material: OLSA-Saetze und -Rauschen aus den vorhandenen Listen
// (tags.test_set === "OLSA"). KEIN eigener Ladeweg -- amGetItemBuffer
// laedt via Kategorie-Adapter (audio+text per Detail-Range).
// ------------------------------------------------------------
function st_allOlsaSentences() {
  const pool = (typeof sBuildRecordingPool === "function") ? sBuildRecordingPool() : [];
  return pool.filter(function (it) { return it.tags && it.tags.test_set === "OLSA"; });
}
function st_findOlsaNoiseItem() {
  const list = (typeof plNoiseVisibleItems === "function") ? plNoiseVisibleItems() : [];
  // Das OLSA-Stoerrauschen traegt KEIN test_set-Tag; es wird ueber die stabile
  // Item-id erkannt (Collection _sourceKey "olsa-noise", Datei
  // stereonoise_OLSAfemale_TTS). id-Form: "<srcKey>:<title>/<rohe-id>".
  return list.find(function (it) {
    return typeof it.id === "string" && it.id.indexOf("stereonoise_OLSAfemale_TTS") >= 0;
  }) || null;
}

// Laedt die Satztexte der OLSA-Items EINMAL vorab (die balancierte Ziehung
// braucht den Text, der sonst erst beim Abspielen per Detail-Range kommt).
// Nutzt die vorhandene Detail-NDJSON (item._detailUrl): eine Datei, per
// Byte-Fenster (detailStart/detail) je Item die Zeile ausschneiden -> item.text.
// Kein zweiter Textweg neben der Detail-Datei (Architektur SS3).
async function st_ensureTexts(items) {
  const need = items.filter(function (it) {
    return (!it.text) && it._detailUrl && typeof it.detailStart === "number"
        && typeof it.detail === "number";
  });
  if (!need.length) return;
  const url = need[0]._detailUrl;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Detail-Datei nicht ladbar: HTTP " + resp.status);
  const raw = new Uint8Array(await resp.arrayBuffer());
  const dec = new TextDecoder("utf-8");
  need.forEach(function (it) {
    if (it._detailUrl !== url) return;   // (alle gleich, Sicherheitsnetz)
    const slice = raw.subarray(it.detailStart, it.detailStart + it.detail);
    try {
      const rec = JSON.parse(dec.decode(slice));
      if (rec && rec.text != null) it.text = rec.text;
    } catch (e) { /* Zeile unlesbar -> Item bleibt ohne Text, wird bei der Ziehung uebersprungen */ }
  });
}

// Balancierte Ziehung von n Saetzen: moeglichst gleiche Wort-Balance je
// Position. Greedy: fuer jeden Kandidaten die Summe der bisherigen
// Verwendungshaeufigkeit seiner fuenf Woerter bilden, den mit der kleinsten
// Summe waehlen (seltenste Woerter zuerst), Zufalls-Tiebreak.
function st_drawBalanced(all, n) {
  const pool = all.slice();
  const used = [ {}, {}, {}, {}, {} ];   // je Position: wort -> anzahl
  const chosen = [];
  function wordsOf(item) {
    const t = (item.text || "").replace(/\.$/, "").trim();
    return t.split(/\s+/);
  }
  while (chosen.length < n && pool.length) {
    let best = null, bestScore = Infinity, bestI = -1;
    for (let i = 0; i < pool.length; i++) {
      const w = wordsOf(pool[i]);
      if (w.length !== 5) continue;
      let score = 0;
      for (let p = 0; p < 5; p++) score += (used[p][w[p]] || 0);
      score += Math.random() * 0.5;
      if (score < bestScore) { bestScore = score; best = pool[i]; bestI = i; }
    }
    if (bestI < 0) break;
    const w = wordsOf(best);
    for (let p = 0; p < 5; p++) used[p][w[p]] = (used[p][w[p]] || 0) + 1;
    chosen.push(best);
    pool.splice(bestI, 1);
  }
  return chosen;
}

// ------------------------------------------------------------
// Ablauf
// ------------------------------------------------------------
function st_start() {
  // Der Test laeuft einseitig auf der aktiven Seite -> Kopfhoerercheck nur
  // fuer DIESE Seite (nicht beide). "beide Seiten" wird spaeter in
  // st_beginRun ohnehin fuer die Testdauer erzwungen.
  testUI.sideCheck.run({ sides: "one", side: st_currentSide() }, function () {
    Promise.resolve(st_beginRun()).catch(function (e) {
      console.error("[sprachtest] Start fehlgeschlagen:", e);
    });
  }, function () {
    // Abbruch im Kopfhoerercheck -> nichts starten.
  });
}

async function st_beginRun() {
  const all = st_allOlsaSentences();
  if (all.length < ST_LIST_LEN) {
    console.warn("[sprachtest] zu wenige OLSA-Saetze:", all.length);
  }
  // Satztexte vorab laden (die balancierte Ziehung braucht sie).
  try {
    await st_ensureTexts(all);
  } catch (e) {
    console.error("[sprachtest] Satztexte laden fehlgeschlagen:", e);
    return;
  }
  st_savePlayerState();
  st_forceSingleSide();   // Test laeuft einseitig (aktive Seite), "beide" aus
  st_forceOlsaNoise();
  // Maskierer-Puffer VORAB laden: sonst laedt pMaskStart ihn beim ersten pPlay
  // async nach, der erste Satz laeuft dann ohne Rauschen (ab dem zweiten ist er
  // gecacht). Einmaliges Vorladen macht das Rauschen ab Satz 1 verfuegbar.
  if (typeof pMaskEnsureBuf === "function") {
    try { await pMaskEnsureBuf(); } catch (e) { console.warn("[sprachtest] Rauschen vorladen:", e); }
  }

  // Trainingssaetze (zaehlen nicht) + gewertete Liste, beide balanciert
  // gezogen und getrennt. Danach die gewertete Liste verwuerfeln.
  const train = st_drawBalanced(all, ST_TRAIN_LEN);
  const rest = all.filter(function (it) { return train.indexOf(it) < 0; });
  const measure = st_shuffle(st_drawBalanced(rest, ST_LIST_LEN));

  st_seq = train.concat(measure);
  st_idx = 0;
  st_snr = ST_START_SNR;
  st_snrHistory = [];
  st_wordHistory = [];
  st_phase = (ST_TRAIN_LEN > 0) ? "train" : "measure";
  st_active = true;

  // BA605: Satz-Ende-Signal auf unseren Handler legen.
  pSetEndedCallback(st_onSentenceEnded);

  st_playCurrent();
  st_updateUI();
}

function st_shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Aktuellen Satz ueber den Player abspielen: als Saetze-Item setzen,
// Ziel-SNR setzen, laden+starten.
function st_playCurrent() {
  const item = st_seq[st_idx];
  if (!item) return;
  // Raster fuer die neue Runde leeren.
  if (ST_els) {
    const vr = ST_els.verfahren["olsa"];
    if (vr) {
      testUI.wordGrid.setWords(vr.wordGrid, ST_INVENTORY);
      testUI.scratchText.clear(vr.scratchText);
    }
  }
  // Ziel-SNR in die Unterlegung (freier dB-Wert, BA605).
  plMaskSetLevelDb(st_snr);
  // Unser OLSA-Satz-Item MUSS gesetzt sein, BEVOR die Kategorie auf "saetze"
  // umschaltet: plSetSource -> saetze.onActivate ruft sLoadCurrent() mit dem
  // dann aktuellen sCurRec. Ohne Vorab-Setzen laedt onActivate das ALTE
  // Saetze-Item (Race -> erster Satz falsch, kein OLSA/Rauschen). Reihenfolge:
  // erst sCurRec, dann Kategorie.
  sCurRec = item;
  plAutoAdvance = false;
  plLoop = false;
  if (plActiveSource !== "saetze") plSetSource("saetze");   // onActivate laedt jetzt schon UNSER item
  // Laden + abspielen (idempotent auf denselben Buffer, falls onActivate schon lud).
  Promise.resolve(sLoadCurrent()).then(function () {
    if (!st_active) return;
    _pSetPlayWish(true);
    pPlay();
  }).catch(function (e) { console.error("[sprachtest] Laden:", e); });
}

// Satz-Ende (BA605-Callback): der Nutzer waehlt jetzt im Raster.
// Die Wertung passiert im OK-Hook (st_onConfirm).
function st_onSentenceEnded() {
  // absichtlich leer: Wertung erfolgt bei OK.
}

// OK-Button: aktuellen Satz werten, SNR fuer den Folgesatz bestimmen.
function st_onConfirm() {
  if (!st_active) return;
  const item = st_seq[st_idx];
  const vr = ST_els.verfahren["olsa"];
  const sel = testUI.wordGrid.getSelection(vr.wordGrid);   // 5 Werte (Wort|null)
  const correct = st_countCorrect(item, sel);

  const isMeasure = (st_phase === "measure");
  if (isMeasure) {
    st_snrHistory.push(st_snr);
    st_wordHistory.push(correct);
  }

  // Naechsten SNR bestimmen (Adaption).
  const measureCount = st_snrHistory.length;
  const delta = st_adaptDelta(correct, measureCount);
  st_snr = Math.max(ST_SNR_MIN, Math.min(ST_SNR_MAX, st_snr + delta));

  // Konvergenz-Abbruch (Standard, Diplomarbeit Kap. 3.3): der Pegel hat sich
  // eingependelt, wenn er sich ueber die LETZTEN 7 gewerteten Saetze nicht
  // aendert (Konvergenzbereich). Dann Ende, SRT aus den letzten 6 Werten.
  // Ein einzelnes delta==0 ist KEINE Konvergenz -- erst 7 gleiche SNR-Werte.
  const converged = isMeasure && st_last7Stable();

  st_advance(converged);
}

// Phasen-Delta: measureCount = Anzahl bereits gewerteter Saetze.
// Saetze 1-4 der Liste folgen der Grobphase, ab dem 5. die Feinphase.
function st_adaptDelta(correct, measureCount) {
  const table = (measureCount <= 4) ? ST_ADAPT_COARSE : ST_ADAPT_FINE;
  return table[correct] || 0;
}

// Konvergenzbereich: true, wenn die letzten 7 gewerteten SNR-Werte identisch
// sind (der Pegel hat sich ueber 7 Saetze nicht mehr veraendert). Vorher (< 7
// Werte) nie konvergiert.
function st_last7Stable() {
  const h = st_snrHistory;
  if (h.length < 7) return false;
  const last = h[h.length - 1];
  for (let i = h.length - 7; i < h.length; i++) {
    if (h[i] !== last) return false;
  }
  return true;
}

function st_advance(converged) {
  st_idx++;
  // Trainingsphase zu Ende?
  if (st_phase === "train" && st_idx >= ST_TRAIN_LEN) {
    st_phase = "measure";
    st_snr = ST_START_SNR;   // Messung startet frisch bei 0 dB
    st_playCurrent();
    st_updateUI();
    return;
  }
  const measureCount = st_snrHistory.length;
  const done = converged || (st_phase === "measure" && measureCount >= ST_LIST_LEN)
             || (st_idx >= st_seq.length);
  if (done) { st_finish(converged); return; }
  st_playCurrent();
  st_updateUI();
}

function st_countCorrect(item, sel) {
  const t = (item.text || "").replace(/\.$/, "").trim().split(/\s+/);
  let n = 0;
  for (let p = 0; p < 5; p++) {
    if (sel[p] !== null && sel[p] === t[p]) n++;
  }
  return n;
}

function st_finish(converged) {
  st_active = false;
  const win = converged ? ST_SRT_WINDOW_CONV : ST_SRT_WINDOW;
  const tail = st_snrHistory.slice(-win);
  const srt = tail.length ? (tail.reduce(function (a, b) { return a + b; }, 0) / tail.length) : null;

  // Wiedergabe stoppen, Player-Zustand wiederherstellen.
  if (typeof pStopReset === "function") pStopReset();
  st_restorePlayerState();

  // Ergebnis an das Ergebnis-Modul uebergeben (BA608 liefert ST_saveResult).
  const result = {
    srt: srt,
    converged: !!converged,
    snrHistory: st_snrHistory.slice(),
    wordHistory: st_wordHistory.slice(),
    ts: Date.now()
  };
  if (typeof ST_saveResult === "function") ST_saveResult(result);
  else { window.ST_lastResult = result; console.log("[sprachtest] Ergebnis:", result); }

  // testUI ueber natuerliches Ende informieren: stoppt den laufenden Test
  // (blendet Stop-Button aus, hebt Tab-Sperre auf) -- analog zum Stop-Button,
  // aber ohne den onStop-Hook zu rufen (kein zweites st_stop).
  if (ST_els && typeof ST_els._stopTest === "function") ST_els._stopTest();

  // Abschluss-Box.
  if (typeof testUI !== "undefined" && testUI.completion) {
    testUI.completion.show({ nameKey: "tabSprachtest", subtabKey: "tabSprachtest", bodyKey: "stDoneBody" });
  }
  st_updateUI();
}

function st_stop() {
  // Nutzer bricht ab: Wiedergabe stoppen, Zustand zurueck,
  // kein Ergebnis speichern.
  st_active = false;
  if (typeof pStopReset === "function") pStopReset();
  st_restorePlayerState();
  st_updateUI();
}

function st_updateUI() {
  if (!ST_els) return;
  const vr = ST_els.verfahren["olsa"];
  if (vr && vr.progress && typeof testUI !== "undefined" && testUI.progress) {
    // Fortschritt: gewertete Saetze / 30 (Trainingsphase zeigt 0/30).
    const done = st_snrHistory.length;
    testUI.progress.set(vr.progress, {
      fraction: done / ST_LIST_LEN,
      text: done + "/" + ST_LIST_LEN
    });
  }
}

// ------------------------------------------------------------
// Persistenz + Ergebnisanzeige
// ------------------------------------------------------------
function ST_saveResult(result) {
  sideData[activeSide].ST_result = result;
  if (typeof window._autoSaveState === "function") window._autoSaveState();
  ST_renderResults();
}

function ST_renderResults() {
  const res = (typeof sideData !== "undefined" && sideData[activeSide])
    ? sideData[activeSide].ST_result || null
    : null;
  const empty = document.getElementById("ST_resEmpty");
  const content = document.getElementById("ST_resContent");
  if (!empty || !content) return;
  if (!res || !res.snrHistory || !res.snrHistory.length) {
    empty.style.display = "";
    content.style.display = "none";
    return;
  }
  empty.style.display = "none";
  content.style.display = "";

  const srtEl = document.getElementById("ST_resSrtValue");
  if (srtEl) srtEl.textContent = (res.srt === null)
    ? "---"
    : (res.srt.toFixed(1) + " dB SNR");
  const conv = document.getElementById("ST_resConvHint");
  if (conv) conv.style.display = res.converged ? "" : "none";

  ST_drawCourse(res);
  ST_drawScatter(res);
  ST_showSlope(res);
}

function ST_drawCourse(res) {
  const cv = document.getElementById("ST_resCourseCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const snr = res.snrHistory;
  const n = snr.length;
  if (!n) return;
  const yMin = -15, yMax = 21;
  const padL = 46, padB = 36, padT = 12, padR = 12;
  const W = cv.width - padL - padR, H = cv.height - padT - padB;
  const xAt = function (i) { return padL + (n <= 1 ? 0 : (i / (n - 1)) * W); };
  const yAt = function (v) { return padT + (1 - (v - yMin) / (yMax - yMin)) * H; };

  // Achsen
  ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + H); ctx.lineTo(padL + W, padT + H); ctx.stroke();

  // y-Ticks: -15, -10, -5, 0, 5, 10, 15, 20
  ctx.fillStyle = "#555"; ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [-15, -10, -5, 0, 5, 10, 15, 20].forEach(function (v) {
    const y = yAt(v);
    ctx.strokeStyle = v === 0 ? "#999" : "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.fillText(v + " dB", padL - 4, y);
  });

  // x-Ticks: 1, 5, 10, 15, 20, 25, 30
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#555";
  [1, 5, 10, 15, 20, 25, 30].forEach(function (i) {
    if (i > n) return;
    const x = xAt(i - 1);
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.fillText(i, x, padT + H + 4);
  });

  // Achsenbeschriftungen
  ctx.fillStyle = "#333"; ctx.font = "11px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("Satznummer", padL + W / 2, cv.height);
  ctx.save();
  ctx.translate(11, padT + H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("SNR (dB)", 0, 0);
  ctx.restore();

  // SNR-Verlauf
  ctx.strokeStyle = "#1f77b4"; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = xAt(i), y = yAt(snr[i]);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#1f77b4";
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.arc(xAt(i), yAt(snr[i]), 3, 0, 2 * Math.PI); ctx.fill();
  }

  // SRT-Linie (Mittel der Auswertungs-Saetze), falls berechenbar
  if (res.srt !== null && n >= 6) {
    const srtY = yAt(res.srt);
    ctx.strokeStyle = "#e05"; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, srtY); ctx.lineTo(padL + W, srtY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e05"; ctx.font = "10px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "bottom";
    ctx.fillText("SRT " + res.srt.toFixed(1) + " dB", padL + 2, srtY - 2);
  }
}

function ST_drawScatter(res) {
  const cv = document.getElementById("ST_resScatterCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const snr = res.snrHistory, wc = res.wordHistory;
  const n = Math.min(snr.length, wc.length);
  if (!n) return;
  const xMin = -15, xMax = 21, yMin = 0, yMax = 5;
  const padL = 46, padB = 36, padT = 12, padR = 12;
  const W = cv.width - padL - padR, H = cv.height - padT - padB;
  const xAt = function (v) { return padL + (v - xMin) / (xMax - xMin) * W; };
  const yAt = function (v) { return padT + (1 - (v - yMin) / (yMax - yMin)) * H; };

  // Achsen
  ctx.strokeStyle = "#bbb"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + H); ctx.lineTo(padL + W, padT + H); ctx.stroke();

  // y-Ticks: 0..5 (Woerter)
  ctx.fillStyle = "#555"; ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [0, 1, 2, 3, 4, 5].forEach(function (v) {
    const y = yAt(v);
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.fillText(v, padL - 4, y);
  });

  // x-Ticks: alle 5 dB
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "#555";
  [-15, -10, -5, 0, 5, 10, 15, 20].forEach(function (v) {
    const x = xAt(v);
    ctx.strokeStyle = v === 0 ? "#999" : "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    ctx.fillStyle = "#555";
    ctx.fillText(v, x, padT + H + 4);
  });

  // Achsenbeschriftungen
  ctx.fillStyle = "#333"; ctx.font = "11px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "bottom";
  ctx.fillText("SNR (dB)", padL + W / 2, cv.height);
  ctx.save();
  ctx.translate(11, padT + H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("richtige Woerter", 0, 0);
  ctx.restore();

  // SRT-Linie
  if (res.srt !== null) {
    const x = xAt(res.srt);
    ctx.strokeStyle = "#e05"; ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#e05"; ctx.font = "10px sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText("SRT", x + 2, padT + 2);
  }

  // 50%-Linie (2.5 von 5 = Schwelle des adaptiven Verfahrens)
  ctx.strokeStyle = "#aaa"; ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath(); ctx.moveTo(padL, yAt(2.5)); ctx.lineTo(padL + W, yAt(2.5)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#888"; ctx.font = "10px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText("50 %", padL + 2, yAt(2.5) - 2);

  // Datenpunkte
  ctx.fillStyle = "#ff7f0e";
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.arc(xAt(snr[i]), yAt(wc[i]), 4, 0, 2 * Math.PI); ctx.fill();
  }
}

function ST_showSlope(res) {
  const el = document.getElementById("ST_resSlopeValue");
  if (!el) return;
  const snr = res.snrHistory, wc = res.wordHistory;
  const n = Math.min(snr.length, wc.length);
  if (n < 2) { el.textContent = "---"; return; }
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = snr[i], y = (wc[i] / 5) * 100;
    sx += x; sy += y; sxx += x * x; sxy += x * y;
  }
  const denom = (n * sxx - sx * sx);
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  el.textContent = "ca. " + slope.toFixed(1) + " %/dB";
}

// ------------------------------------------------------------
// Aufbau des Sub-Reiters
// ------------------------------------------------------------
const st_cfg = {
  id: "sprachtest",
  explain: {
    titleKey: "stTitle",
    preserveOrder: true,
    paragraphs: [
      { key: "stInstruction", kind: "info" },
      { key: "stTrainHint",   kind: "plain" }
    ]
  },
  header: {
    common: {},                 // keine Voreinstellungen -- nur Start/Stop
    startStop: { startKey: "stBtnStart", stopKey: "btnCancelTest", resumable: false }
  },
  verfahren: [
    {
      id: "olsa",
      body: {
        instruction: { key: "stPickHint" },
        progress:    { format: "simple" },
        scratchText: { labelKey: "stScratchLabel" },
        wordGrid:    { columns: 5, placeholder: "____" },
        confirmButton: { key: "stBtnOk" }
      },
      hooks: {
        onStart:   st_start,
        onStop:    st_stop,
        onConfirm: st_onConfirm
      }
    }
  ]
};

document.addEventListener("DOMContentLoaded", function () {
  const parentEl = document.getElementById("subpanel-messungen-sprachtest");
  if (!parentEl) return;
  _st_parentEl = parentEl;
  ST_els = buildTestPanel(parentEl, st_cfg);
});
