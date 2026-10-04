// ============================================================
// SPRACHTEST (OLSA) -- Sub-Reiter unter "Messungen"
// Spielt OLSA-Saetze ueber den vorhandenen Player ab (keine zweite
// Wiedergabe), fuehrt den Sprachpegel-SNR adaptiv nach (Tab. 3-1),
// wertet 0-5 richtige Woerter je Satz und ermittelt den SRT.
// Architektur: .docs/spec/00-sprachtest-olsa-architektur.md
// ============================================================

// --- Material-Auswahl (Architektur SS3) ---
// Das aktive Matrix-Testmaterial wird als test_set-Wert aus dem Saetze-Pool
// gewaehlt. Gebaute (Manifest) und hochgeladene Sammlungen sind gleich
// behandelt -- kein eigener Buenel-Mechanismus mehr.

// Aktive Matrix-Sammlung (test_set-Wert). null = noch nicht gewaehlt;
// st_currentTestSet() liefert die erste verfuegbare.
let ST_activeTestSet = null;

// Gewaehltes Hintergrundgeraeusch im Sprachtest. Sentinel ST_NOISE_DEFAULT
// = testeigenes Werksrauschen (st_findNoiseItem). Sonst die id eines
// gleichmaessig gemessenen Geraeusche-Items (stationary). Global fuer den Sprachtest (nicht pro Seite/
// Testset); sitzungsuebergreifend gesichert (SAVE_SCHEMA).
const ST_NOISE_DEFAULT = "__werk__";
let st_noiseChoiceId = ST_NOISE_DEFAULT;

// Alle Matrix-Sammlungen aus dem Saetze-Pool (test_type === "matrix"),
// dedupliziert nach test_set.
function st_availableCollections() {
  const pool = (typeof sBuildRecordingPool === "function") ? sBuildRecordingPool() : [];
  const seen = new Map();
  pool.forEach(function (it) {
    const tg = it.tags || {};
    if (tg.test_type !== "matrix" || !tg.test_set) return;
    if (!seen.has(tg.test_set)) seen.set(tg.test_set, tg.test_set);
  });
  return Array.from(seen.keys()).map(function (ts) { return { testSet: ts, label: ts }; });
}

// Aktive Sammlung, mit Fallback auf die erste verfuegbare.
function st_currentTestSet() {
  const avail = st_availableCollections();
  if (ST_activeTestSet && avail.some(function (c) { return c.testSet === ST_activeTestSet; })) {
    return ST_activeTestSet;
  }
  return avail.length ? avail[0].testSet : null;
}

// Matrix-Extraktor (SS3.2): sammelt ueber alle Satztexte je Position (0..4)
// die vorkommenden Woerter, dedupliziert, sortiert. Ergebnis: Array[5] von
// Wort-Arrays (die zehn Woerter je Spalte). Erwartet, dass die Items ihren
// text tragen (st_ensureTexts lief). Saetze ohne genau fuenf Woerter werden
// uebersprungen (gleiche Regel wie st_drawBalanced).
function st_extractMatrix(items) {
  const cols = [ new Set(), new Set(), new Set(), new Set(), new Set() ];
  items.forEach(function (it) {
    const txt = (it.text || "").replace(/\.$/, "").trim();
    if (!txt) return;
    const w = txt.split(/\s+/);
    if (w.length !== 5) return;
    for (let p = 0; p < 5; p++) cols[p].add(w[p]);
  });
  return cols.map(function (s) {
    return Array.from(s).sort(function (a, b) { return a.localeCompare(b); });
  });
}

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
let _st_preloadedSeq = null; // Satz-Reihenfolge aus _st_preload (Ziehung vorgezogen)
let _st_matrix = null;       // Matrix des aktiven Buendels (aus Satztexten, SS3.2)

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

// Der Sprachtest mischt sein Rauschen selbst in den Satz-Buffer (Architektur
// SS4.5) und benutzt die Player-Geraeusch-Unterlegung NICHT. Fuer die Testdauer
// wird sie ausgeschaltet, damit sie das Testsignal nicht zusaetzlich ueberlagert.
function st_forceMaskOff() {
  if (typeof plMaskSetOn === "function") plMaskSetOn(false);
}

// ------------------------------------------------------------
// Material: Wortmatrix-Saetze aus den vorhandenen Listen
// (tags.test_set === "wortmatrix"). KEIN eigener Ladeweg -- amGetItemBuffer
// laedt via Kategorie-Adapter (audio+text per Detail-Range).
// ------------------------------------------------------------
function st_allOlsaSentences() {
  const pool = (typeof sBuildRecordingPool === "function") ? sBuildRecordingPool() : [];
  const ts = st_currentTestSet();
  if (!ts) return [];
  return pool.filter(function (it) { return it.tags && it.tags.test_set === ts; });
}
// Das Geraeusche-Pool-Item der aktiven Sammlung finden
// (test_type matrix, gleicher test_set).
function st_findNoiseItem() {
  const ts = st_currentTestSet();
  if (!ts) return null;
  const list = (typeof plNoiseAllItems === "function")
    ? plNoiseAllItems()
    : ((typeof amCollectItems === "function") ? amCollectItems("geraeusche") : []);
  return list.find(function (it) {
    return it.tags && it.tags.test_type === "matrix" && it.tags.test_set === ts;
  }) || null;
}

let _st_noiseCache = { testSet: null, choice: null, buf: null };

// Stellt den Stoergeraeusch-Buffer bereit. Default = testeigenes
// Werksrauschen (roh). Ein gewaehltes gleichmaessiges Geraeusch (stationary) wird auf den
// RMS der Werksdatei normiert (SNR-Achse bleibt stabil); das Werks-
// rauschen ist die Eichreferenz und bleibt unveraendert.
async function _st_ensureNoiseBuf() {
  const ts = st_currentTestSet();
  const choice = st_noiseChoiceId;
  if (_st_noiseCache.testSet === ts && _st_noiseCache.choice === choice && _st_noiseCache.buf) {
    return _st_noiseCache.buf;
  }
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx || !ts) return null;

  // Werksdatei laden (immer noetig: roher Default ODER Eich-Referenz).
  const werkItem = st_findNoiseItem();
  if (!werkItem) return null;
  const werkBuf = await amGetItemBuffer(ctx, werkItem);
  if (!werkBuf) return null;

  let outBuf = werkBuf;
  if (choice && choice !== ST_NOISE_DEFAULT) {
    const items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
    const chosen = items.find(function (it) { return it.id === choice; });
    if (chosen) {
      const chosenBuf = await amGetItemBuffer(ctx, chosen);
      if (chosenBuf) {
        // Auf eine Kopie normieren (Original-Buffer im Cache nicht veraendern).
        const refRms = _amRms(werkBuf);
        const copy = ctx.createBuffer(chosenBuf.numberOfChannels, chosenBuf.length, chosenBuf.sampleRate);
        for (let ch = 0; ch < chosenBuf.numberOfChannels; ch++) {
          copy.copyToChannel(chosenBuf.getChannelData(ch), ch);
        }
        _amNormalizeBufferRms(copy, refRms);
        outBuf = copy;
      }
    }
    // Gewaehltes Item fehlt / laedt nicht -> stiller Fallback auf Werksrauschen.
  }

  _st_noiseCache = { testSet: ts, choice: choice, buf: outBuf };
  return outBuf;
}

// Rausch-Vorlauf/-Nachlauf um den Satz (Architektur SS4.5): Das Rauschen setzt
// vor dem Satz ein und laeuft nach ihm noch nach -- kein durchgehendes Rauschen
// (das kommt in CImbel nicht in Frage), sondern ein je Darbietung eigenes
// Rausch-Segment, das den Satz zeitlich umschliesst. Vermeidet den Onset-Effekt
// eines satzsynchron einsetzenden Stoerers. Feste Werte (kein UI-Regler).
const ST_NOISE_PREROLL_S  = 1.0;    // Rauschen beginnt 1 s vor dem Satz
const ST_NOISE_POSTROLL_S = 0.5;    // Rauschen endet 0,5 s nach dem Satz
const ST_NOISE_FADE_S     = 0.030;  // Ein-/Ausblendung an den AEUSSEREN Raendern

// Baut EINEN Buffer aus Satz (Original-Pegel) + auf den Ziel-SNR skaliertem
// Rauschen. Faktor auf das Rauschen = 10^(-snr/20): SNR 0 -> 1,0 (Werks-
// Verhaeltnis), hoeheres SNR -> Rauschen leiser. Der Ausgabe-Buffer ist um
// Vor- und Nachlauf laenger als der Satz; der Satz sitzt um den Vorlauf nach
// hinten versetzt. Rauschen fuellt den GANZEN Buffer (Umlauf am Ende) und wird
// nur an den beiden aeusseren Raendern ein-/ausgeblendet -- der Uebergang zum
// Satz bleibt auf vollem Pegel. KEINE RMS-Messung.
function _st_buildMixedBuffer(sentenceBuf, noiseBuf, snr) {
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx || !sentenceBuf) return sentenceBuf;
  const sr  = sentenceBuf.sampleRate;
  const sLen = sentenceBuf.length;                        // Satzlaenge (Samples)
  const pre  = Math.round(ST_NOISE_PREROLL_S  * sr);      // Vorlauf (Samples)
  const post = Math.round(ST_NOISE_POSTROLL_S * sr);      // Nachlauf (Samples)
  const fade = Math.max(1, Math.round(ST_NOISE_FADE_S * sr));
  const len  = pre + sLen + post;                         // Gesamtlaenge
  const nCh  = sentenceBuf.numberOfChannels;
  const out  = ctx.createBuffer(nCh, len, sr);
  const factor = Math.pow(10, -snr / 20);

  // Rausch-Startpunkt zufaellig (mit Umlauf); Rausch-Kanalzahl kann abweichen.
  const noiseLen = noiseBuf ? noiseBuf.length : 0;
  const noiseCh  = noiseBuf ? noiseBuf.numberOfChannels : 0;
  const start = noiseLen > 0 ? Math.floor(Math.random() * noiseLen) : 0;

  for (let ch = 0; ch < nCh; ch++) {
    const dst = out.getChannelData(ch);
    const src = sentenceBuf.getChannelData(ch);
    // Rausch-Kanal: gleicher Kanal, sonst letzter vorhandener (mono-Rausch -> ch 0).
    const nData = (noiseLen > 0)
      ? noiseBuf.getChannelData(Math.min(ch, noiseCh - 1))
      : null;
    for (let i = 0; i < len; i++) {
      // Satz sitzt um den Vorlauf versetzt.
      let v = (i >= pre && i < pre + sLen) ? src[i - pre] : 0;
      if (nData) {
        // Aeussere Fade-Huellkurve: 0->1 ueber die ersten `fade` Samples,
        // 1->0 ueber die letzten `fade` Samples, dazwischen voll.
        let env = 1;
        if (i < fade) env = i / fade;
        else if (i >= len - fade) env = (len - 1 - i) / fade;
        v += factor * env * nData[(start + i) % noiseLen];
      }
      dst[i] = v;
    }
  }
  return out;
}

// Laedt die Satztexte der Wortmatrix-Items EINMAL vorab (die balancierte Ziehung
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
// Ladebalken-Hilfsfunktionen (ST_loadHint in index.html).
function _st_loadShow(msg) {
  const el = document.getElementById("ST_loadHint");
  if (!el) return;
  el.innerHTML = "";
  const txt = document.createElement("div");
  txt.textContent = msg || t("stLoadingMsg");
  const bar = document.createElement("progress");
  bar.id = "ST_loadBar";
  bar.value = 0;
  bar.max = 1;
  el.appendChild(txt);
  el.appendChild(bar);
  el.hidden = false;
}
function _st_loadProgress(done, total) {
  const bar = document.getElementById("ST_loadBar");
  if (bar) { bar.value = done; bar.max = total; }
}
function _st_loadHide() {
  const el = document.getElementById("ST_loadHint");
  if (el) el.hidden = true;
}

function st_start() {
  // Ladebalken sofort synchron einblenden -- _st_preload ist async und gibt
  // Kontrolle erst beim ersten await ab; ohne diesen Aufruf hier verschwindet
  // der Balken, bevor der Browser einen Frame rendern kann.
  _st_loadShow();
  Promise.resolve(_st_preload()).then(function () {
    // Kopfhoerercheck erst nach vollstaendigem Vorladen.
    testUI.sideCheck.run({ sides: "one", side: st_currentSide() }, function () {
      Promise.resolve(st_beginRun()).catch(function (e) {
        console.error("[sprachtest] Start fehlgeschlagen:", e);
        _st_abortStart();
      });
    }, function () {
      // Abbruch im Kopfhoerercheck.
      _st_abortStart();
    });
  }).catch(function (e) {
    console.error("[sprachtest] Vorladen fehlgeschlagen:", e);
    _st_abortStart();
  });
}

// Teststart komplett zuruecknehmen: Ladebalken weg UND den laufenden Test-
// Zustand von testUI aufheben (Button-Sperren, Tab-Sperre, Player-Reset ueber
// onStop=st_stop). Ohne diesen Stop-Weg bliebe testUI nach einem Fehlschlag
// oder Kopfhoerercheck-Abbruch im "Test laeuft"-Zustand haengen -- Stop-Button
// aktiv, kein Ton, kein Body.
function _st_abortStart() {
  _st_loadHide();
  if (ST_els && typeof ST_els._stopTest === "function") ST_els._stopTest();
}

// Laedt Texte + Audio-Buffer der benoetigten Saetze (33) + Rauschen sequenziell
// in den Browser-Cache. Ladebalken in ST_loadHint sofort beim Aufruf sichtbar.
// Zieht die Satz-Reihenfolge vor und speichert sie in _st_preloadedSeq, damit
// st_beginRun nur die tatsaechlich gespielte Teilmenge laedt (nicht alle ~150).
async function _st_preload() {
  const all = st_allOlsaSentences();
  if (all.length < ST_LIST_LEN) {
    console.warn("[sprachtest] zu wenige Wortmatrix-Saetze:", all.length);
  }
  // Ladebalken wurde bereits in st_start() synchron eingeblendet.
  _st_loadProgress(0, 1);   // unbestimmt bis Texte geladen

  // Texte laden (ein Range-Request fuer alle Items — braucht die Ziehung).
  try {
    await st_ensureTexts(all);
  } catch (e) {
    console.error("[sprachtest] Satztexte laden fehlgeschlagen:", e);
    throw e;
  }
  _st_matrix = st_extractMatrix(all);

  // Ziehung JETZT — nur die 33 tatsaechlich gespielten Saetze vorladen.
  const train = st_drawBalanced(all, ST_TRAIN_LEN);
  const rest = all.filter(function (it) { return train.indexOf(it) < 0; });
  const measure = st_shuffle(st_drawBalanced(rest, ST_LIST_LEN));
  _st_preloadedSeq = train.concat(measure);

  // Audio-Buffer der 33 Saetze sequenziell laden (Roh-Buffer cachen).
  // Rauschen zaehlt als ein weiterer Schritt.
  const total = _st_preloadedSeq.length + 1;   // +1 fuer das Rausch-Asset
  _st_loadProgress(0, total);
  const ctx = (typeof gPC === "function") ? gPC() : null;
  for (let i = 0; i < _st_preloadedSeq.length; i++) {
    if (ctx) {
      try {
        await amGetItemBuffer(ctx, _st_preloadedSeq[i]);
      } catch (e) { console.warn("[sprachtest] Audio vorladen:", _st_preloadedSeq[i].id, e); }
    }
    _st_loadProgress(i + 1, total);
  }
  try { await _st_ensureNoiseBuf(); }
  catch (e) { console.warn("[sprachtest] Rauschen vorladen:", e); }
  _st_loadProgress(total, total);
}

async function st_beginRun() {
  // Satz-Reihenfolge aus _st_preload uebernehmen (Buffer bereits im Cache).
  const seq = _st_preloadedSeq;
  _st_preloadedSeq = null;
  if (!seq || seq.length < ST_LIST_LEN + ST_TRAIN_LEN) {
    console.error("[sprachtest] Vorladen fehlgeschlagen oder Sequenz zu kurz");
    return;
  }

  st_savePlayerState();
  st_forceSingleSide();   // Test laeuft einseitig (aktive Seite), "beide" aus
  st_forceMaskOff();      // Player-Unterlegung fuer die Testdauer aus (SS4.4)

  const train   = seq.slice(0, ST_TRAIN_LEN);
  const measure = seq.slice(ST_TRAIN_LEN);

  st_seq = train.concat(measure);
  st_idx = 0;
  st_snr = ST_START_SNR;
  st_snrHistory = [];
  st_wordHistory = [];
  st_phase = (ST_TRAIN_LEN > 0) ? "train" : "measure";
  st_active = true;

  _st_loadHide();

  // Testkörper jetzt einblenden (deferBody, SS-Start): Material ist geladen
  // und der Kopfhörercheck bestanden, das Raster wird gleich befüllt.
  if (typeof testUI !== "undefined" && typeof testUI.showBody === "function") {
    testUI.showBody(ST_els);
  }

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

// Aktuellen Satz mischen und abspielen: Satz-Buffer (Cache) holen, Rauschen
// auf den Ziel-SNR mischen, als fertigen Buffer an den Player uebergeben.
function st_playCurrent() {
  const item = st_seq[st_idx];
  if (!item) return;
  // Raster fuer die neue Runde leeren.
  if (ST_els) {
    const vr = ST_els.verfahren["olsa"];
    if (vr) {
      testUI.wordGrid.setWords(vr.wordGrid, _st_matrix || []);
    }
  }
  plAutoAdvance = false;
  plLoop = false;
  // Satz-Buffer holen (im Vorlauf bereits gecacht, kein Nachladen), Rauschen
  // auf den Ziel-SNR mischen, als fertigen Buffer an den Player uebergeben.
  // KEIN Umweg ueber sLoadCurrent/onActivate: der Mix steht VOR pPlay(),
  // deshalb kein Race und kein "erster Satz ohne Rauschen".
  const ctx = (typeof gPC === "function") ? gPC() : null;
  Promise.resolve(amGetItemBuffer(ctx, item)).then(function (sentBuf) {
    if (!st_active) return;
    if (!sentBuf) { console.error("[sprachtest] Satz-Buffer fehlt:", item.id); return; }
    const mixed = _st_buildMixedBuffer(sentBuf, _st_noiseCache.buf, st_snr);
    sCurRec = item;                       // fuer Wertung/Textbezug
    sSetDirectBuffer(mixed, item.text || "");
    if (!st_active) return;
    // OK erst nach Satzende freigeben (st_onSentenceEnded) -- man soll den
    // Satz zu Ende hoeren, bevor bestaetigt wird. Das Raster bleibt waehrend
    // der Wiedergabe bedienbar (nur der Bestaetigen-Button ist gesperrt).
    st_setConfirmEnabled(false);
    _pSetPlayWish(true);
    pPlay();
  }).catch(function (e) { console.error("[sprachtest] Satz mischen/laden:", e); });
}

// Bestaetigen-Button (OK / naechster Satz) sperren/freigeben.
function st_setConfirmEnabled(on) {
  if (!ST_els) return;
  const vr = ST_els.verfahren["olsa"];
  if (vr && vr.confirmButton && typeof testUI !== "undefined"
      && testUI.confirmButton) {
    testUI.confirmButton.setEnabled(vr.confirmButton, on);
  }
}

// Satz-Ende (BA605-Callback): der Satz ist fertig abgespielt -- jetzt darf
// der Nutzer bestaetigen. Die Wertung passiert im OK-Hook (st_onConfirm).
function st_onSentenceEnded() {
  st_setConfirmEnabled(true);
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

  // Verwendetes Hintergrundgeraeusch fuer die Ergebnisanzeige festhalten.
  let noiseLabel;
  if (st_noiseChoiceId === ST_NOISE_DEFAULT) {
    noiseLabel = (typeof t === "function") ? t("stNoiseDefaultOpt") : "Testeigenes Rauschen";
  } else {
    const items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
    const it = items.find(function (x) { return x.id === st_noiseChoiceId; });
    noiseLabel = it ? _amNoiseTitleLabel(it) : st_noiseChoiceId;
  }

  // Ergebnis an das Ergebnis-Modul uebergeben (BA608 liefert ST_saveResult).
  const result = {
    srt: srt,
    converged: !!converged,
    snrHistory: st_snrHistory.slice(),
    wordHistory: st_wordHistory.slice(),
    testSet: st_currentTestSet(),
    bundleLabel: st_currentTestSet(),
    noiseLabel: noiseLabel,
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

  // Balken auf fertig: endet der Test durch Konvergenz vor der Obergrenze,
  // steht st_idx noch darunter -- hier explizit auf voll setzen, statt mit
  // st_updateUI auf dem Zwischenstand zu verharren.
  const vr = ST_els && ST_els.verfahren["olsa"];
  if (vr && vr.progress && typeof testUI !== "undefined" && testUI.progress) {
    const total = ST_TRAIN_LEN + ST_LIST_LEN;
    testUI.progress.set(vr.progress, { fraction: 1, text: total + "/" + total });
  }
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
    // Fortschritt: bestaetigte Saetze / Gesamtzahl (Uebung + Messung). st_idx
    // rueckt bei JEDEM OK vor (st_advance), also auch waehrend der Uebung --
    // so bewegt sich der Balken bei jeder Bestaetigung sichtbar. Der Nenner
    // ist die Obergrenze; endet der Test durch Konvergenz frueher, springt er
    // beim Abschluss einfach auf fertig.
    const total = ST_TRAIN_LEN + ST_LIST_LEN;
    const done = Math.min(st_idx, total);
    testUI.progress.set(vr.progress, {
      fraction: done / total,
      text: done + "/" + total
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
  const bundleEl = document.getElementById("ST_resBundle");
  if (bundleEl) {
    const lbl = res.bundleLabel || "";
    bundleEl.textContent = lbl
      ? (t("stResBundlePrefix") + " " + lbl)
      : "";
  }
  const noiseEl = document.getElementById("ST_resNoise");
  if (noiseEl) {
    const nl = res.noiseLabel || "";
    noiseEl.textContent = nl ? (t("stResNoisePrefix") + " " + nl) : "";
  }

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
  ctx.fillStyle = CHART_LABEL_FARBE; ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [-15, -10, -5, 0, 5, 10, 15, 20].forEach(function (v) {
    const y = yAt(v);
    ctx.strokeStyle = v === 0 ? "#999" : "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    ctx.fillStyle = CHART_LABEL_FARBE;
    ctx.fillText(v + " dB", padL - 4, y);
  });

  // x-Ticks: 1, 5, 10, 15, 20, 25, 30
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = CHART_LABEL_FARBE;
  [1, 5, 10, 15, 20, 25, 30].forEach(function (i) {
    if (i > n) return;
    const x = xAt(i - 1);
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    ctx.fillStyle = CHART_LABEL_FARBE;
    ctx.fillText(i, x, padT + H + 4);
  });

  // Achsenbeschriftungen
  ctx.fillStyle = CHART_LABEL_FARBE; ctx.font = "11px sans-serif";
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
  ctx.fillStyle = CHART_LABEL_FARBE; ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  [0, 1, 2, 3, 4, 5].forEach(function (v) {
    const y = yAt(v);
    ctx.strokeStyle = "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + W, y); ctx.stroke();
    ctx.fillStyle = CHART_LABEL_FARBE;
    ctx.fillText(v, padL - 4, y);
  });

  // x-Ticks: alle 5 dB
  ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = CHART_LABEL_FARBE;
  [-15, -10, -5, 0, 5, 10, 15, 20].forEach(function (v) {
    const x = xAt(v);
    ctx.strokeStyle = v === 0 ? "#999" : "#e8e8e8"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + H); ctx.stroke();
    ctx.fillStyle = CHART_LABEL_FARBE;
    ctx.fillText(v, x, padT + H + 4);
  });

  // Achsenbeschriftungen
  ctx.fillStyle = CHART_LABEL_FARBE; ctx.font = "11px sans-serif";
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
// Buendel-Fragment (Upload + Auswahl + Status + Ladebalken)
// ------------------------------------------------------------
let ST_bundleEls = null;   // Refs des Buendel-Fragments

function st_buildBundleFragment() {
  const wrap = document.createElement("div");
  wrap.className = "st-bundle-box";

  // Buendel-Auswahl (nur bei > 1 Buendel sichtbar).
  const selRow = document.createElement("div");
  selRow.className = "control-group st-bundle-select-row";
  const selLabel = document.createElement("label");
  selLabel.setAttribute("data-t", "stBundleLabel");
  const sel = document.createElement("select");
  sel.id = "ST_bundleSelect";
  sel.addEventListener("change", function () { st_setActiveCollection(sel.value); });
  selRow.append(selLabel, sel);

  // Lizenz-/Herkunftszeile der Satzaufnahmen (gleiche Anzeige wie im Player,
  // ueber plRenderMetaLine). Mit vorangestelltem Label, damit klar ist, wozu
  // die Lizenz gehoert.
  const sentLic = document.createElement("div");
  sentLic.className = "st-license-line";
  const sentLicLabel = document.createElement("span");
  sentLicLabel.className = "st-license-label";
  sentLicLabel.setAttribute("data-t", "stLicSentences");
  const sentLicMeta = document.createElement("span");
  sentLicMeta.className = "st-license-meta";
  sentLicMeta.id = "ST_sentLicenseMeta";
  sentLic.append(sentLicLabel, document.createTextNode(" "), sentLicMeta);

  // Upload-Bereich mit Zenodo-Erklaerung.
  const upRow = document.createElement("div");
  upRow.className = "st-bundle-upload-row";
  const explain = document.createElement("p");
  explain.className = "explain-plain";
  explain.setAttribute("data-t", "stUploadExplain");
  explain.dataset.bgHtml = "1";   // Wert enthaelt Links -> als HTML rendern
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".zip";
  fileInput.style.display = "none";
  fileInput.addEventListener("change", function () {
    if (fileInput.files && fileInput.files[0]) st_onUploadFile(fileInput.files[0]);
    fileInput.value = "";
  });
  const upBtn = document.createElement("button");
  upBtn.className = "btn";
  upBtn.setAttribute("data-t", "stUploadBtn");
  upBtn.addEventListener("click", function () { fileInput.click(); });
  upRow.append(explain, upBtn, fileInput);

  // Status-/Fehlerzeile.
  const status = document.createElement("div");
  status.className = "st-bundle-status";
  status.id = "ST_bundleStatus";

  // Ladebalken-Container (zieht hierher um, §4).
  const loadHint = document.createElement("div");
  loadHint.id = "ST_loadHint";
  loadHint.hidden = true;

  // Hintergrundgeraeusch-Auswahl (Default testeigenes Rauschen, sonst
  // gleichmaessige Geraeusche (stationary)). Nur vor dem Start waehlbar -- die Sperrung
  // waehrend des Tests erledigt die testUI-Automatik (header.extra).
  var noiseRow = document.createElement("div");
  noiseRow.className = "control-group st-noise-select-row";
  var noiseLabel = document.createElement("label");
  noiseLabel.setAttribute("data-t", "stNoiseLabel");
  var noiseSel = document.createElement("select");
  noiseSel.id = "ST_noiseSelect";
  noiseSel.autocomplete = "off";
  noiseSel.addEventListener("change", function () {
    st_noiseChoiceId = noiseSel.value || ST_NOISE_DEFAULT;
    if (typeof window._autoSaveState === "function") window._autoSaveState();
    st_refreshLicenseLines();
  });
  noiseRow.append(noiseLabel, noiseSel);

  // Lizenz-/Herkunftszeile des Stoergeraeuschs (gleiche Anzeige wie im Player).
  const noiseLic = document.createElement("div");
  noiseLic.className = "st-license-line";
  const noiseLicLabel = document.createElement("span");
  noiseLicLabel.className = "st-license-label";
  noiseLicLabel.setAttribute("data-t", "stLicNoise");
  const noiseLicMeta = document.createElement("span");
  noiseLicMeta.className = "st-license-meta";
  noiseLicMeta.id = "ST_noiseLicenseMeta";
  noiseLic.append(noiseLicLabel, document.createTextNode(" "), noiseLicMeta);

  wrap.append(selRow, sentLic, noiseRow, noiseLic, upRow, status, loadHint);
  ST_bundleEls = {
    wrap: wrap, selRow: selRow, select: sel, status: status, noiseSelect: noiseSel,
    sentLicenseMeta: sentLicMeta, noiseLicenseMeta: noiseLicMeta
  };
  return wrap;
}

// Zeichnet die beiden Lizenz-/Herkunftszeilen (Satzaufnahmen + Stoergeraeusch)
// neu -- gleiche Anzeige wie im Player, ueber plRenderMetaLine mit der jeweiligen
// Kategorie-fieldDecl und einem reinen ctx (plSentCtxFromItem/plNoiseCtxFromItem).
// Satz-ctx aus einem repraesentativen Item der aktiven Sammlung (eine Lizenz pro
// Sammlung). Geraeusch-ctx: Werks-Item beim Default, sonst das gewaehlte Item.
function st_refreshLicenseLines() {
  if (!ST_bundleEls) return;
  if (typeof plRenderMetaLine !== "function") return;

  const sentEl = ST_bundleEls.sentLicenseMeta;
  if (sentEl && typeof PL_FILTER_DECL !== "undefined" && PL_FILTER_DECL.saetze) {
    const sent = st_allOlsaSentences();
    const ctx = (sent.length && typeof plSentCtxFromItem === "function")
      ? plSentCtxFromItem(sent[0]) : null;
    plRenderMetaLine(sentEl, PL_FILTER_DECL.saetze.fieldDecl, ctx);
  }

  const noiseEl = ST_bundleEls.noiseLicenseMeta;
  if (noiseEl && typeof PL_FILTER_DECL !== "undefined" && PL_FILTER_DECL.geraeusche) {
    let nItem = null;
    if (st_noiseChoiceId === ST_NOISE_DEFAULT) {
      nItem = st_findNoiseItem();                       // testeigenes Werksrauschen
    } else {
      const items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
      nItem = items.find(function (x) { return x.id === st_noiseChoiceId; }) || null;
    }
    const ctx = (nItem && typeof plNoiseCtxFromItem === "function")
      ? plNoiseCtxFromItem(nItem) : null;
    plRenderMetaLine(noiseEl, PL_FILTER_DECL.geraeusche.fieldDecl, ctx);
  }
}

// Geraeusch-Dropdown befuellen: feste Default-Option (testeigenes
// Werksrauschen) + alle gleichmaessig gemessenen Geraeusche-Items (stationary). Auswahl aus
// st_noiseChoiceId wiederherstellen.
function st_refreshNoiseSelect() {
  if (!ST_bundleEls || !ST_bundleEls.noiseSelect) return;
  var sel = ST_bundleEls.noiseSelect;
  sel.innerHTML = "";

  var optDef = document.createElement("option");
  optDef.value = ST_NOISE_DEFAULT;
  optDef.setAttribute("data-t", "stNoiseDefaultOpt");
  optDef.textContent = (typeof t === "function") ? t("stNoiseDefaultOpt") : "Testeigenes Rauschen";
  sel.appendChild(optDef);

  var items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
  var gleichmaessig = items.filter(function (it) {
    return it && it.tags && it.tags.stationary === "y";
  });
  gleichmaessig.sort(function (a, b) {
    return _amNoiseTitleLabel(a).toLowerCase().localeCompare(_amNoiseTitleLabel(b).toLowerCase());
  });
  gleichmaessig.forEach(function (it) {
    var opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = _amNoiseTitleLabel(it);
    sel.appendChild(opt);
  });

  // Gesicherte/aktuelle Auswahl wiederherstellen; fehlt das Item
  // (nicht mehr geladen), auf Default zurueckfallen.
  var exists = (st_noiseChoiceId === ST_NOISE_DEFAULT)
    || gleichmaessig.some(function (it) { return it.id === st_noiseChoiceId; });
  if (!exists) st_noiseChoiceId = ST_NOISE_DEFAULT;
  sel.value = st_noiseChoiceId;
  st_refreshLicenseLines();
}

// Auswahl-Dropdown befuellen; Auswahl-Zeile nur bei > 1 Sammlung zeigen.
function st_refreshBundleSelect() {
  if (!ST_bundleEls) return;
  const sel = ST_bundleEls.select;
  const avail = st_availableCollections();
  sel.innerHTML = "";
  avail.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.testSet;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
  const cur = st_currentTestSet();
  if (cur) sel.value = cur;
  ST_bundleEls.selRow.style.display = (avail.length > 1) ? "" : "none";
  st_refreshLicenseLines();
}

// Aktive Sammlung setzen (Umschalten per test_set-Wert).
function st_setActiveCollection(testSet) {
  ST_activeTestSet = testSet;
  st_refreshBundleSelect();
}

async function st_onUploadFile(file) {
  const st = ST_bundleEls ? ST_bundleEls.status : null;
  if (st) st.textContent = t("stUploadWorking");
  try {
    const res = await zuHandleZipUpload(file, "saetze", { matrixOnly: true });
    st_setActiveCollection(res.test_set);
    if (st) st.textContent = "";
  } catch (e) {
    console.error("[sprachtest] Upload fehlgeschlagen:", e);
    if (st) st.textContent = (e && e.message) ? e.message : t("stUploadErrGeneric");
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
      { key: "stIntro1",     kind: "plain" },
      { key: "stIntro2",     kind: "plain" },
      { key: "stInstruction", kind: "info" },
      { key: "stIntro4",     kind: "plain" },
      { key: "stTrainHint",  kind: "plain" }
    ]
  },
  header: {
    common: {},                 // keine Voreinstellungen -- nur Start/Stop
    startStop: { startKey: "stBtnStart", stopKey: "btnCancelTest", resumable: false }
  },
  verfahren: [
    {
      id: "olsa",
      // Der Testkörper wird erst nach dem asynchronen Vorladen + Kopfhörer-
      // check gezeigt (st_beginRun ruft testUI.showBody). Ohne deferBody
      // erschiene das Antwort-Raster der Vorrunde, bevor Ton kommt.
      deferBody: true,
      body: {
        instruction: { key: "stPickHint" },
        progress:    { format: "simple" },
        wordGrid:    { columns: 5, placeholder: "____" },
        confirmButton: { key: "stBtnOk" }
      },
      prerequisites: [
        {
          checkFn: function() {
            return !(typeof sideData !== "undefined" && sideData[activeSide] && sideData[activeSide].ST_result);
          },
          titleKey:   "stOverwriteTitle",
          messageKey: "stOverwriteMsg",
          actions: [
            { kind: "continue", labelKey: "stBtnOverwriteOk" },
            { kind: "abort",    labelKey: "stBtnOverwriteCancel" }
          ]
        }
      ],
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
  // Buendel-Bereich (Auswahl + Upload + Status + Ladebalken) gehoert OBEN, vor
  // dem Start-Button: er ist der Vor-dem-Test-Schritt (Material waehlen/laden).
  // Deshalb header.extra (zwischen common und startStop, immer sichtbar) --
  // NICHT body.extraFragment: das sitzt in der festen Body-Reihenfolge unter
  // dem Antwort-Raster und im initial verborgenen testBox (test-ui.js:487,894).
  const stBundleFrag = st_buildBundleFragment();
  st_cfg.header.extra = { fragment: stBundleFrag, lockDuringTest: true };
  ST_els = buildTestPanel(parentEl, st_cfg);
  st_refreshBundleSelect();
  st_refreshNoiseSelect();
  // Am Kategorie-Refresh-Register anmelden: Wird das Saetze-Material nachge-
  // laden (bedarfsgeladenes Buendel, Sprachwechsel, Upload), aktualisiert sich
  // die Sammlungs-Auswahl von selbst -- sonst erschiene das Dropdown erst nach
  // einem Upload, obwohl schon mehrere gebaute Sammlungen im Pool stehen.
  if (typeof amRegisterCategoryRefresh === "function") {
    amRegisterCategoryRefresh("saetze", st_refreshBundleSelect);
    amRegisterCategoryRefresh("geraeusche", st_refreshNoiseSelect);
  }
  if (typeof applyLang === "function") applyLang();
});
