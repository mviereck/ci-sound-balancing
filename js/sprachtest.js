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
  st_saved = {
    maskOn:    plMaskOn,
    maskLevel: plMaskLevelKey,
    noiseId:   plNoiseSelectedId,
    activeSrc: plActiveSource,
    sentRec:   (typeof sCurRec !== "undefined") ? sCurRec : null
  };
}
function st_restorePlayerState() {
  if (!st_saved) return;
  pSetEndedCallback(null);              // BA605: unseren Callback abraeumen
  plMaskSetLevelDb(null);               // BA605: freien SNR loslassen
  plMaskSetOn(!!st_saved.maskOn);
  plMaskSetLevel(st_saved.maskLevel);
  plNoiseSelectedId = st_saved.noiseId;
  st_saved = null;
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
  return list.find(function (it) { return it.tags && it.tags.test_set === "OLSA"; }) || null;
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
  // Kopfhoerercheck zuerst (beide Seiten), dann Testablauf.
  testUI.sideCheck.run({ sides: "both" }, function () {
    st_beginRun();
  }, function () {
    // Abbruch im Kopfhoerercheck -> nichts starten.
  });
}

function st_beginRun() {
  const all = st_allOlsaSentences();
  if (all.length < ST_LIST_LEN) {
    console.warn("[sprachtest] zu wenige OLSA-Saetze:", all.length);
  }
  st_savePlayerState();
  st_forceOlsaNoise();

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
  // Satz als aktives Saetze-Item setzen und ueber den vorhandenen Player abspielen.
  if (plActiveSource !== "saetze") plSetSource("saetze");
  sCurRec = item;
  plAutoAdvance = false;
  plLoop = false;
  // Laden + abspielen.
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

  // Konvergenz-Abbruch (SS6): ab dem 7. gewerteten Satz, wenn delta == 0.
  const converged = isMeasure && measureCount >= 7 && delta === 0;

  st_advance(converged);
}

// Phasen-Delta: measureCount = Anzahl bereits gewerteter Saetze.
// Saetze 1-4 der Liste folgen der Grobphase, ab dem 5. die Feinphase.
function st_adaptDelta(correct, measureCount) {
  const table = (measureCount <= 4) ? ST_ADAPT_COARSE : ST_ADAPT_FINE;
  return table[correct] || 0;
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
