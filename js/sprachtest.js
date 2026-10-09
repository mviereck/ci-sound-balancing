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
// snr_currentTestSet() liefert die erste verfuegbare.
let SNR_activeTestSet = null;

// Gewaehltes Hintergrundgeraeusch im Sprachtest. Sentinel SNR_NOISE_DEFAULT
// = testeigenes Werksrauschen (snr_findNoiseItem). Sonst die id eines
// gleichmaessig gemessenen Geraeusche-Items (stationary). Global fuer den Sprachtest (nicht pro Seite/
// Testset); sitzungsuebergreifend gesichert (SAVE_SCHEMA).
const SNR_NOISE_DEFAULT = "__werk__";
let snr_noiseChoiceId = SNR_NOISE_DEFAULT;

// Alle Matrix-Sammlungen aus dem Saetze-Pool (test_type === "matrix"),
// dedupliziert nach test_set.
function snr_availableCollections() {
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
function snr_currentTestSet() {
  const avail = snr_availableCollections();
  if (SNR_activeTestSet && avail.some(function (c) { return c.testSet === SNR_activeTestSet; })) {
    return SNR_activeTestSet;
  }
  return avail.length ? avail[0].testSet : null;
}

// Matrix-Extraktor (SS3.2): sammelt ueber alle Satztexte je Position (0..4)
// die vorkommenden Woerter, dedupliziert, sortiert. Ergebnis: Array[5] von
// Wort-Arrays (die zehn Woerter je Spalte). Erwartet, dass die Items ihren
// text tragen (snr_ensureTexts lief). Saetze ohne genau fuenf Woerter werden
// uebersprungen (gleiche Regel wie snr_drawBalanced).
function snr_extractMatrix(items) {
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
const SNR_ADAPT_COARSE = { 5: -3, 4: -2, 3: -1, 2: +1, 1: +2, 0: +3 };
const SNR_ADAPT_FINE   = { 5: -2, 4: -1, 3:  0, 2:  0, 1: +1, 0: +2 };

const SNR_START_SNR = 0;      // erster Satz bei SNR 0 dB
const SNR_MIN = -15;      // Klemmung (Architektur SS4.3)
const SNR_MAX = 21;
const SNR_LIST_LEN = 30;      // gewertete Saetze
const SNR_TRAIN_LEN = 3;      // Trainingssaetze (zaehlen nicht)
const SNR_SRT_WINDOW = 20;    // SRT = Mittel der letzten 20 SNR-Werte
const SNR_SRT_WINDOW_CONV = 6;// bei Konvergenz-Abbruch: letzte 6

// --- Modul-Zustand ---
let _st_parentEl = null;     // Panel-Element (im DOMContentLoaded gesetzt)
let SNR_els = null;           // Refs aus buildTestPanel
let snr_active = false;       // laeuft ein Durchgang?
let snr_phase = null;         // "train" | "measure"
let snr_seq = [];             // gezogene Satz-Items (Trainingssaetze + 30)
let snr_idx = 0;              // Index in snr_seq
let snr_snr = SNR_START_SNR;   // aktueller Ziel-SNR
let snr_snrHistory = [];      // SNR je gewertetem Satz (nur measure-Phase)
let snr_wordHistory = [];     // richtige Woerter (0..5) je gewertetem Satz
let snr_saved = null;         // gesicherter Player-Unterlegungszustand (Restore)
let _st_preloadedSeq = null; // Satz-Reihenfolge aus _st_preload (Ziehung vorgezogen)
let _st_matrix = null;       // Matrix des aktiven Buendels (aus Satztexten, SS3.2)

// ------------------------------------------------------------
// Player-Zustand sichern / erzwingen / wiederherstellen (SS4.4)
// ------------------------------------------------------------
function snr_savePlayerState() {
  var volEl  = document.getElementById("plVol");
  snr_saved = {
    maskOn:    plMaskOn,
    maskLevel: plMaskLevelKey,
    noiseId:   plNoiseSelectedId,
    activeSrc: plActiveSource,
    sentRec:   (typeof sCurRec !== "undefined") ? sCurRec : null,
    bothSides: plBothSides,
    plVol:     volEl ? parseInt(volEl.value, 10) : null
  };
  // Sprachtest-Lautstaerke hart in den Player setzen (00-lautstaerke Sec. 4.5).
  if (volEl) {
    var p = saveGet("SNRtest_volume");
    if (typeof p === "number") {
      volEl.value = p;
      volEl.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
}
function snr_restorePlayerState() {
  if (!snr_saved) return;
  pSetEndedCallback(null);              // BA605: unseren Callback abraeumen
  plMaskSetLevelDb(null);               // BA605: freien SNR loslassen
  plMaskSetOn(!!snr_saved.maskOn);
  plMaskSetLevel(snr_saved.maskLevel);
  plNoiseSelectedId = snr_saved.noiseId;
  // "Beide Seiten" wiederherstellen (einseitig war nur fuer den Test erzwungen).
  if (plBothSides !== snr_saved.bothSides) {
    plBothSides = snr_saved.bothSides;
    if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
  }
  // Player-Lautstaerke wiederherstellen (00-lautstaerke Sec. 4.5).
  var volEl2 = document.getElementById("plVol");
  if (volEl2 && snr_saved.plVol != null) {
    volEl2.value = snr_saved.plVol;
    volEl2.dispatchEvent(new Event("change", { bubbles: true }));
  }
  snr_saved = null;
}

// Erzwingt EINSEITIGE Wiedergabe (die global aktive Seite) fuer die Testdauer.
// Der OLSA laeuft je Seite getrennt (ein Ergebnis pro Seite); "beide Seiten"
// waere fachlich falsch. Nutzt den regulaeren Umschaltweg (Checkbox +
// updatePlayerForSideChange), nicht einen Patch an getPlayerSide.
function snr_forceSingleSide() {
  if (plBothSides) {
    plBothSides = false;
    if (typeof updatePlayerForSideChange === "function") updatePlayerForSideChange();
  }
}

// Die aktive Seite (fuer Ergebnis-Zuordnung / Anzeige).
function snr_currentSide() {
  return (typeof activeSide !== "undefined") ? activeSide : "left";
}

// Der Sprachtest mischt sein Rauschen selbst in den Satz-Buffer (Architektur
// SS4.5) und benutzt die Player-Geraeusch-Unterlegung NICHT. Fuer die Testdauer
// wird sie ausgeschaltet, damit sie das Testsignal nicht zusaetzlich ueberlagert.
function snr_forceMaskOff() {
  if (typeof plMaskSetOn === "function") plMaskSetOn(false);
}

// ------------------------------------------------------------
// Material: Wortmatrix-Saetze aus den vorhandenen Listen
// (tags.test_set === "wortmatrix"). KEIN eigener Ladeweg -- amGetItemBuffer
// laedt via Kategorie-Adapter (audio+text per Detail-Range).
// ------------------------------------------------------------
function snr_allOlsaSentences() {
  const pool = (typeof sBuildRecordingPool === "function") ? sBuildRecordingPool() : [];
  const ts = snr_currentTestSet();
  if (!ts) return [];
  return pool.filter(function (it) { return it.tags && it.tags.test_set === ts; });
}
// Das Geraeusche-Pool-Item der aktiven Sammlung finden
// (test_type matrix, gleicher test_set).
function snr_findNoiseItem() {
  const ts = snr_currentTestSet();
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
  const ts = snr_currentTestSet();
  const choice = snr_noiseChoiceId;
  if (_st_noiseCache.testSet === ts && _st_noiseCache.choice === choice && _st_noiseCache.buf) {
    return _st_noiseCache.buf;
  }
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx || !ts) return null;

  // Werksdatei laden (immer noetig: roher Default ODER Eich-Referenz).
  const werkItem = snr_findNoiseItem();
  if (!werkItem) return null;
  const werkBuf = await amGetItemBuffer(ctx, werkItem);
  if (!werkBuf) return null;

  let outBuf = werkBuf;
  if (choice && choice !== SNR_NOISE_DEFAULT) {
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
const SNR_NOISE_PREROLL_S  = 1.0;    // Rauschen beginnt 1 s vor dem Satz
const SNR_NOISE_POSTROLL_S = 0.5;    // Rauschen endet 0,5 s nach dem Satz
const SNR_NOISE_FADE_S     = 0.030;  // Ein-/Ausblendung an den AEUSSEREN Raendern

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
  const pre  = Math.round(SNR_NOISE_PREROLL_S  * sr);      // Vorlauf (Samples)
  const post = Math.round(SNR_NOISE_POSTROLL_S * sr);      // Nachlauf (Samples)
  const fade = Math.max(1, Math.round(SNR_NOISE_FADE_S * sr));
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
async function snr_ensureTexts(items) {
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
function snr_drawBalanced(all, n) {
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
// Ladebalken-Hilfsfunktionen (SNR_loadHint in index.html).
function _st_loadShow(msg) {
  const el = document.getElementById("SNR_loadHint");
  if (!el) return;
  el.innerHTML = "";
  const txt = document.createElement("div");
  txt.textContent = msg || t("stLoadingMsg");
  const bar = document.createElement("progress");
  bar.id = "SNR_loadBar";
  bar.value = 0;
  bar.max = 1;
  el.appendChild(txt);
  el.appendChild(bar);
  el.hidden = false;
}
function _st_loadProgress(done, total) {
  const bar = document.getElementById("SNR_loadBar");
  if (bar) { bar.value = done; bar.max = total; }
}
function _st_loadHide() {
  const el = document.getElementById("SNR_loadHint");
  if (el) el.hidden = true;
}

function snr_start() {
  // Ladebalken sofort synchron einblenden -- _st_preload ist async und gibt
  // Kontrolle erst beim ersten await ab; ohne diesen Aufruf hier verschwindet
  // der Balken, bevor der Browser einen Frame rendern kann.
  _st_loadShow();
  Promise.resolve(_st_preload()).then(function () {
    // Kopfhoerercheck erst nach vollstaendigem Vorladen.
    testUI.sideCheck.run({ sides: "one", side: snr_currentSide() }, function () {
      Promise.resolve(snr_beginRun()).catch(function (e) {
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
// onStop=snr_stop). Ohne diesen Stop-Weg bliebe testUI nach einem Fehlschlag
// oder Kopfhoerercheck-Abbruch im "Test laeuft"-Zustand haengen -- Stop-Button
// aktiv, kein Ton, kein Body.
function _st_abortStart() {
  _st_loadHide();
  if (SNR_els && typeof SNR_els._stopTest === "function") SNR_els._stopTest();
}

// Laedt Texte + Audio-Buffer der benoetigten Saetze (33) + Rauschen sequenziell
// in den Browser-Cache. Ladebalken in SNR_loadHint sofort beim Aufruf sichtbar.
// Zieht die Satz-Reihenfolge vor und speichert sie in _st_preloadedSeq, damit
// snr_beginRun nur die tatsaechlich gespielte Teilmenge laedt (nicht alle ~150).
async function _st_preload() {
  const all = snr_allOlsaSentences();
  if (all.length < SNR_LIST_LEN) {
    console.warn("[sprachtest] zu wenige Wortmatrix-Saetze:", all.length);
  }
  // Ladebalken wurde bereits in snr_start() synchron eingeblendet.
  _st_loadProgress(0, 1);   // unbestimmt bis Texte geladen

  // Texte laden (ein Range-Request fuer alle Items — braucht die Ziehung).
  try {
    await snr_ensureTexts(all);
  } catch (e) {
    console.error("[sprachtest] Satztexte laden fehlgeschlagen:", e);
    throw e;
  }
  _st_matrix = snr_extractMatrix(all);

  // Ziehung JETZT — nur die 33 tatsaechlich gespielten Saetze vorladen.
  const train = snr_drawBalanced(all, SNR_TRAIN_LEN);
  const rest = all.filter(function (it) { return train.indexOf(it) < 0; });
  const measure = snr_shuffle(snr_drawBalanced(rest, SNR_LIST_LEN));
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

async function snr_beginRun() {
  // Satz-Reihenfolge aus _st_preload uebernehmen (Buffer bereits im Cache).
  const seq = _st_preloadedSeq;
  _st_preloadedSeq = null;
  if (!seq || seq.length < SNR_LIST_LEN + SNR_TRAIN_LEN) {
    console.error("[sprachtest] Vorladen fehlgeschlagen oder Sequenz zu kurz");
    return;
  }

  snr_savePlayerState();
  snr_forceSingleSide();   // Test laeuft einseitig (aktive Seite), "beide" aus
  snr_forceMaskOff();      // Player-Unterlegung fuer die Testdauer aus (SS4.4)

  const train   = seq.slice(0, SNR_TRAIN_LEN);
  const measure = seq.slice(SNR_TRAIN_LEN);

  snr_seq = train.concat(measure);
  snr_idx = 0;
  snr_snr = SNR_START_SNR;
  snr_snrHistory = [];
  snr_wordHistory = [];
  snr_phase = (SNR_TRAIN_LEN > 0) ? "train" : "measure";
  snr_active = true;

  _st_loadHide();

  // Testkörper jetzt einblenden (deferBody, SS-Start): Material ist geladen
  // und der Kopfhörercheck bestanden, das Raster wird gleich befüllt.
  if (typeof testUI !== "undefined" && typeof testUI.showBody === "function") {
    testUI.showBody(SNR_els);
  }

  // BA605: Satz-Ende-Signal auf unseren Handler legen.
  pSetEndedCallback(snr_onSentenceEnded);

  snr_playCurrent();
  snr_updateUI();
}

function snr_shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Aktuellen Satz mischen und abspielen: Satz-Buffer (Cache) holen, Rauschen
// auf den Ziel-SNR mischen, als fertigen Buffer an den Player uebergeben.
function snr_playCurrent() {
  const item = snr_seq[snr_idx];
  if (!item) return;
  // Raster fuer die neue Runde leeren.
  if (SNR_els) {
    const vr = SNR_els.verfahren["olsa"];
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
    if (!snr_active) return;
    if (!sentBuf) { console.error("[sprachtest] Satz-Buffer fehlt:", item.id); return; }
    const mixed = _st_buildMixedBuffer(sentBuf, _st_noiseCache.buf, snr_snr);
    sCurRec = item;                       // fuer Wertung/Textbezug
    sSetDirectBuffer(mixed, item.text || "");
    if (!snr_active) return;
    // OK erst nach Satzende freigeben (snr_onSentenceEnded) -- man soll den
    // Satz zu Ende hoeren, bevor bestaetigt wird. Das Raster bleibt waehrend
    // der Wiedergabe bedienbar (nur der Bestaetigen-Button ist gesperrt).
    snr_setConfirmEnabled(false);
    _pSetPlayWish(true);
    pPlay();
  }).catch(function (e) { console.error("[sprachtest] Satz mischen/laden:", e); });
}

// Bestaetigen-Button (OK / naechster Satz) sperren/freigeben.
function snr_setConfirmEnabled(on) {
  if (!SNR_els) return;
  const vr = SNR_els.verfahren["olsa"];
  if (vr && vr.confirmButton && typeof testUI !== "undefined"
      && testUI.confirmButton) {
    testUI.confirmButton.setEnabled(vr.confirmButton, on);
  }
}

// Satz-Ende (BA605-Callback): der Satz ist fertig abgespielt -- jetzt darf
// der Nutzer bestaetigen. Die Wertung passiert im OK-Hook (snr_onConfirm).
function snr_onSentenceEnded() {
  snr_setConfirmEnabled(true);
}

// OK-Button: aktuellen Satz werten, SNR fuer den Folgesatz bestimmen.
function snr_onConfirm() {
  if (!snr_active) return;
  const item = snr_seq[snr_idx];
  const vr = SNR_els.verfahren["olsa"];
  const sel = testUI.wordGrid.getSelection(vr.wordGrid);   // 5 Werte (Wort|null)
  const correct = snr_countCorrect(item, sel);

  const isMeasure = (snr_phase === "measure");
  if (isMeasure) {
    snr_snrHistory.push(snr_snr);
    snr_wordHistory.push(correct);
  }

  // Naechsten SNR bestimmen (Adaption).
  const measureCount = snr_snrHistory.length;
  const delta = snr_adaptDelta(correct, measureCount);
  snr_snr = Math.max(SNR_MIN, Math.min(SNR_MAX, snr_snr + delta));

  // Konvergenz-Abbruch (Standard, Diplomarbeit Kap. 3.3): der Pegel hat sich
  // eingependelt, wenn er sich ueber die LETZTEN 7 gewerteten Saetze nicht
  // aendert (Konvergenzbereich). Dann Ende, SRT aus den letzten 6 Werten.
  // Ein einzelnes delta==0 ist KEINE Konvergenz -- erst 7 gleiche SNR-Werte.
  const converged = isMeasure && snr_last7Stable();

  snr_advance(converged);
}

// Phasen-Delta: measureCount = Anzahl bereits gewerteter Saetze.
// Saetze 1-4 der Liste folgen der Grobphase, ab dem 5. die Feinphase.
function snr_adaptDelta(correct, measureCount) {
  const table = (measureCount <= 4) ? SNR_ADAPT_COARSE : SNR_ADAPT_FINE;
  return table[correct] || 0;
}

// Konvergenzbereich: true, wenn die letzten 7 gewerteten SNR-Werte identisch
// sind (der Pegel hat sich ueber 7 Saetze nicht mehr veraendert). Vorher (< 7
// Werte) nie konvergiert.
function snr_last7Stable() {
  const h = snr_snrHistory;
  if (h.length < 7) return false;
  const last = h[h.length - 1];
  for (let i = h.length - 7; i < h.length; i++) {
    if (h[i] !== last) return false;
  }
  return true;
}

function snr_advance(converged) {
  snr_idx++;
  // Trainingsphase zu Ende?
  if (snr_phase === "train" && snr_idx >= SNR_TRAIN_LEN) {
    snr_phase = "measure";
    snr_snr = SNR_START_SNR;   // Messung startet frisch bei 0 dB
    snr_playCurrent();
    snr_updateUI();
    return;
  }
  const measureCount = snr_snrHistory.length;
  const done = converged || (snr_phase === "measure" && measureCount >= SNR_LIST_LEN)
             || (snr_idx >= snr_seq.length);
  if (done) { snr_finish(converged); return; }
  snr_playCurrent();
  snr_updateUI();
}

function snr_countCorrect(item, sel) {
  const t = (item.text || "").replace(/\.$/, "").trim().split(/\s+/);
  let n = 0;
  for (let p = 0; p < 5; p++) {
    if (sel[p] !== null && sel[p] === t[p]) n++;
  }
  return n;
}

function snr_finish(converged) {
  snr_active = false;
  const win = converged ? SNR_SRT_WINDOW_CONV : SNR_SRT_WINDOW;
  const tail = snr_snrHistory.slice(-win);
  const srt = tail.length ? (tail.reduce(function (a, b) { return a + b; }, 0) / tail.length) : null;

  // Wiedergabe stoppen, Player-Zustand wiederherstellen.
  if (typeof pStopReset === "function") pStopReset();
  snr_restorePlayerState();

  // Ergebnis an das Ergebnis-Modul uebergeben (BA608 liefert SNR_saveResult).
  const result = {
    srt: srt,
    converged: !!converged,
    snrHistory: snr_snrHistory.slice(),
    wordHistory: snr_wordHistory.slice(),
    ts: Date.now()
  };
  if (typeof SNR_saveResult === "function") SNR_saveResult(result);
  else { window.SNR_lastResult = result; console.log("[sprachtest] Ergebnis:", result); }

  // testUI ueber natuerliches Ende informieren: stoppt den laufenden Test
  // (blendet Stop-Button aus, hebt Tab-Sperre auf) -- analog zum Stop-Button,
  // aber ohne den onStop-Hook zu rufen (kein zweites snr_stop).
  if (SNR_els && typeof SNR_els._stopTest === "function") SNR_els._stopTest();

  // Abschluss-Box.
  if (typeof testUI !== "undefined" && testUI.completion) {
    testUI.completion.show({ nameKey: "tabSprachtest", subtabKey: "tabSprachtest", bodyKey: "stDoneBody" });
  }

  // Balken auf fertig: endet der Test durch Konvergenz vor der Obergrenze,
  // steht snr_idx noch darunter -- hier explizit auf voll setzen, statt mit
  // snr_updateUI auf dem Zwischenstand zu verharren.
  const vr = SNR_els && SNR_els.verfahren["olsa"];
  if (vr && vr.progress && typeof testUI !== "undefined" && testUI.progress) {
    const total = SNR_TRAIN_LEN + SNR_LIST_LEN;
    testUI.progress.set(vr.progress, { fraction: 1, text: total + "/" + total });
  }
}

function snr_stop() {
  // Nutzer bricht ab: Wiedergabe stoppen, Zustand zurueck,
  // kein Ergebnis speichern.
  snr_active = false;
  if (typeof pStopReset === "function") pStopReset();
  snr_restorePlayerState();
  snr_updateUI();
}

function snr_updateUI() {
  if (!SNR_els) return;
  const vr = SNR_els.verfahren["olsa"];
  if (vr && vr.progress && typeof testUI !== "undefined" && testUI.progress) {
    // Fortschritt: bestaetigte Saetze / Gesamtzahl (Uebung + Messung). snr_idx
    // rueckt bei JEDEM OK vor (snr_advance), also auch waehrend der Uebung --
    // so bewegt sich der Balken bei jeder Bestaetigung sichtbar. Der Nenner
    // ist die Obergrenze; endet der Test durch Konvergenz frueher, springt er
    // beim Abschluss einfach auf fertig.
    const total = SNR_TRAIN_LEN + SNR_LIST_LEN;
    const done = Math.min(snr_idx, total);
    testUI.progress.set(vr.progress, {
      fraction: done / total,
      text: done + "/" + total
    });
  }
}

// ------------------------------------------------------------
// Persistenz + Ergebnisanzeige
// ------------------------------------------------------------
function SNR_saveResult(result) {
  sideData[activeSide].SNR_result = result;
  if (typeof window._autoSaveState === "function") window._autoSaveState();
  SNR_renderResults();
}

function SNR_renderResults() {
  const res = (typeof sideData !== "undefined" && sideData[activeSide])
    ? sideData[activeSide].SNR_result || null
    : null;
  const empty = document.getElementById("SNR_resEmpty");
  const content = document.getElementById("SNR_resContent");
  if (!empty || !content) return;
  if (!res || !res.snrHistory || !res.snrHistory.length) {
    empty.style.display = "";
    content.style.display = "none";
    return;
  }
  empty.style.display = "none";
  content.style.display = "";

  const srtEl = document.getElementById("SNR_resSrtValue");
  if (srtEl) srtEl.textContent = (res.srt === null)
    ? "---"
    : (res.srt.toFixed(1) + " dB SNR");
  const conv = document.getElementById("SNR_resConvHint");
  if (conv) conv.style.display = res.converged ? "" : "none";
  const bundleEl = document.getElementById("SNR_resBundle");
  if (bundleEl) {
    const lbl = snr_currentTestSet() || "";
    bundleEl.textContent = lbl
      ? (t("stResBundlePrefix") + " " + lbl)
      : "";
  }
  const noiseEl = document.getElementById("SNR_resNoise");
  if (noiseEl) {
    let nl;
    if (snr_noiseChoiceId === SNR_NOISE_DEFAULT) {
      nl = (typeof t === "function") ? t("stNoiseDefaultOpt") : "Testeigenes Rauschen";
    } else {
      const items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
      const it = items.find(function (x) { return x.id === snr_noiseChoiceId; });
      nl = it ? _amNoiseTitleLabel(it) : snr_noiseChoiceId;
    }
    noiseEl.textContent = nl ? (t("stResNoisePrefix") + " " + nl) : "";
  }

  SNR_drawCourse(res);
  SNR_drawScatter(res);
  SNR_showSlope(res);
}

function SNR_drawCourse(res) {
  const cv = document.getElementById("SNR_resCourseCanvas");
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

function SNR_drawScatter(res) {
  const cv = document.getElementById("SNR_resScatterCanvas");
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

function SNR_showSlope(res) {
  const el = document.getElementById("SNR_resSlopeValue");
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
let SNR_bundleEls = null;   // Refs des Buendel-Fragments

function snr_buildBundleFragment() {
  const wrap = document.createElement("div");
  wrap.className = "st-bundle-box";

  // Buendel-Auswahl (nur bei > 1 Buendel sichtbar).
  const selRow = document.createElement("div");
  selRow.className = "control-group st-bundle-select-row";
  const selLabel = document.createElement("label");
  selLabel.setAttribute("data-t", "stBundleLabel");
  const sel = document.createElement("select");
  sel.id = "SNR_bundleSelect";
  sel.addEventListener("change", function () { snr_setActiveCollection(sel.value); });
  // Dezenter Link hinter dem Dropdown: oeffnet die Erzeuger-/Lizenz-Modalbox
  // der Satzaufnahmen (gleiche Anzeige wie im Player, ueber plRenderMetaLine).
  const sentLicLink = snr_makeLicenseLink("saetze");
  selRow.append(selLabel, sel, sentLicLink);

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
    if (fileInput.files && fileInput.files[0]) snr_onUploadFile(fileInput.files[0]);
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
  status.id = "SNR_bundleStatus";

  // Ladebalken-Container (zieht hierher um, §4).
  const loadHint = document.createElement("div");
  loadHint.id = "SNR_loadHint";
  loadHint.hidden = true;

  // Hintergrundgeraeusch-Auswahl (Default testeigenes Rauschen, sonst
  // gleichmaessige Geraeusche (stationary)). Nur vor dem Start waehlbar -- die Sperrung
  // waehrend des Tests erledigt die testUI-Automatik (header.extra).
  var noiseRow = document.createElement("div");
  noiseRow.className = "control-group st-noise-select-row";
  var noiseLabel = document.createElement("label");
  noiseLabel.setAttribute("data-t", "stNoiseLabel");
  var noiseSel = document.createElement("select");
  noiseSel.id = "SNR_noiseSelect";
  noiseSel.autocomplete = "off";
  noiseSel.addEventListener("change", function () {
    snr_noiseChoiceId = noiseSel.value || SNR_NOISE_DEFAULT;
    sideData[activeSide].SNRtest_noise = snr_noiseChoiceId;
    if (typeof window._autoSaveState === "function") window._autoSaveState();
  });
  // Dezenter Link hinter dem Geraeusch-Dropdown: Erzeuger-/Lizenz-Modalbox.
  const noiseLicLink = snr_makeLicenseLink("geraeusche");
  noiseRow.append(noiseLabel, noiseSel, noiseLicLink);

  wrap.append(selRow, noiseRow, upRow, status, loadHint);
  SNR_bundleEls = {
    wrap: wrap, selRow: selRow, select: sel, status: status, noiseSelect: noiseSel
  };
  return wrap;
}

// Baut den dezenten "Erzeuger und Lizenz"-Link fuer eine Kategorie
// ("saetze" | "geraeusche"); Klick oeffnet die Modalbox mit genau den
// zugehoerigen Angaben.
function snr_makeLicenseLink(kind) {
  const a = document.createElement("a");
  a.href = "#";
  a.className = "st-license-link";
  a.setAttribute("data-t", "stLicLink");
  a.textContent = (typeof t === "function") ? t("stLicLink") : "Erzeuger und Lizenz";
  a.addEventListener("click", function (e) {
    e.preventDefault();
    snr_openLicenseDialog(kind);
  });
  return a;
}

// Oeffnet die Erzeuger-/Lizenz-Modalbox fuer eine Kategorie und fuellt den
// Body mit der Player-Meta-Zeile (plRenderMetaLine) aus dem passenden ctx:
// Satz-ctx aus einem repraesentativen Item der aktiven Sammlung (eine Lizenz
// pro Sammlung); Geraeusch-ctx aus dem gewaehlten Geraeusch-Item. Sonderfall
// "testeigenes Rauschen": das Werksrauschen gehoert zur Testmaterial-Sammlung
// und hat keine eigene Nennung -- dann nur der Verweis auf das Testmaterial.
function snr_openLicenseDialog(kind) {
  const dlg  = document.getElementById("stLicenseDialog");
  const body = document.getElementById("stLicenseBody");
  if (!dlg || !body || typeof plRenderMetaLine !== "function") return;
  if (typeof PL_FILTER_DECL === "undefined") return;

  body.innerHTML = "";

  // Testeigenes Rauschen: gehoert zum Testmaterial -> nur Verweis.
  if (kind === "geraeusche" && snr_noiseChoiceId === SNR_NOISE_DEFAULT) {
    const hint = document.createElement("div");
    hint.className = "st-license-meta";
    hint.textContent = (typeof t === "function" && t("stLicNoiseSeeMaterial") !== "stLicNoiseSeeMaterial")
      ? t("stLicNoiseSeeMaterial") : "siehe Lizenz von Testmaterial";
    body.appendChild(hint);
    if (typeof dlg.showModal === "function") dlg.showModal();
    else dlg.setAttribute("open", "open");
    return;
  }

  let decl = null, ctx = null;
  if (kind === "saetze" && PL_FILTER_DECL.saetze) {
    decl = PL_FILTER_DECL.saetze.fieldDecl;
    const sent = snr_allOlsaSentences();
    ctx = (sent.length && typeof plSentCtxFromItem === "function")
      ? plSentCtxFromItem(sent[0]) : null;
  } else if (kind === "geraeusche" && PL_FILTER_DECL.geraeusche) {
    decl = PL_FILTER_DECL.geraeusche.fieldDecl;
    const items = (typeof plNoiseAllItems === "function") ? plNoiseAllItems() : [];
    const nItem = items.find(function (x) { return x.id === snr_noiseChoiceId; }) || null;
    ctx = (nItem && typeof plNoiseCtxFromItem === "function")
      ? plNoiseCtxFromItem(nItem) : null;
  }

  const line = document.createElement("div");
  line.className = "st-license-meta";
  plRenderMetaLine(line, decl, ctx);
  if (!line.textContent.trim()) {
    line.textContent = (typeof t === "function" && t("alNoText") !== "alNoText")
      ? t("alNoText") : "Keine Angaben hinterlegt.";
  }
  body.appendChild(line);

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
}

// Geraeusch-Dropdown befuellen: feste Default-Option (testeigenes
// Werksrauschen) + alle gleichmaessig gemessenen Geraeusche-Items (stationary). Auswahl aus
// snr_noiseChoiceId wiederherstellen.
function snr_refreshNoiseSelect() {
  if (!SNR_bundleEls || !SNR_bundleEls.noiseSelect) return;
  var sel = SNR_bundleEls.noiseSelect;
  sel.innerHTML = "";

  var optDef = document.createElement("option");
  optDef.value = SNR_NOISE_DEFAULT;
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
  var exists = (snr_noiseChoiceId === SNR_NOISE_DEFAULT)
    || gleichmaessig.some(function (it) { return it.id === snr_noiseChoiceId; });
  if (!exists) {
    snr_noiseChoiceId = SNR_NOISE_DEFAULT;
    sideData[activeSide].SNRtest_noise = SNR_NOISE_DEFAULT;
  }
  sel.value = snr_noiseChoiceId;
}

// Auswahl-Dropdown befuellen; Auswahl-Zeile nur bei > 1 Sammlung zeigen.
function snr_refreshBundleSelect() {
  if (!SNR_bundleEls) return;
  const sel = SNR_bundleEls.select;
  const avail = snr_availableCollections();
  sel.innerHTML = "";
  avail.forEach(function (c) {
    const opt = document.createElement("option");
    opt.value = c.testSet;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
  const cur = snr_currentTestSet();
  if (cur) sel.value = cur;
  SNR_bundleEls.selRow.style.display = (avail.length > 1) ? "" : "none";
}

// Aktive Sammlung setzen (Umschalten per test_set-Wert).
function snr_setActiveCollection(testSet) {
  SNR_activeTestSet = testSet;
  sideData[activeSide].SNRtest_material = testSet;
  snr_refreshBundleSelect();
}

// Lautstaerke-Button im Sprachtest-Header nach Seitenwechsel neu
// beschriften (saveGet liefert dann den Wert der neuen aktiven Seite).
function SNR_refreshVolumeLabel() {
  if (SNR_els && SNR_els.header && typeof SNR_els.header.volumeUpdate === "function") {
    SNR_els.header.volumeUpdate();
  }
}

async function snr_onUploadFile(file) {
  const st = SNR_bundleEls ? SNR_bundleEls.status : null;
  if (st) st.textContent = t("stUploadWorking");
  try {
    const res = await zuHandleZipUpload(file, "saetze", { matrixOnly: true });
    snr_setActiveCollection(res.test_set);
    if (st) st.textContent = "";
  } catch (e) {
    console.error("[sprachtest] Upload fehlgeschlagen:", e);
    if (st) st.textContent = (e && e.message) ? e.message : t("stUploadErrGeneric");
  }
}

// ------------------------------------------------------------
// Aufbau des Sub-Reiters
// ------------------------------------------------------------
const snr_cfg = {
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
    common: {
      volumeButton: {
        getVolume: function () { return saveGet("SNRtest_volume"); },
        setVolume: function (v) { saveSet("SNRtest_volume", v); },
      }
    },
    startStop: { startKey: "stBtnStart", stopKey: "btnCancelTest", resumable: false }
  },
  verfahren: [
    {
      id: "olsa",
      // Der Testkörper wird erst nach dem asynchronen Vorladen + Kopfhörer-
      // check gezeigt (snr_beginRun ruft testUI.showBody). Ohne deferBody
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
            return !(typeof sideData !== "undefined" && sideData[activeSide] && sideData[activeSide].SNR_result);
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
        onStart:   snr_start,
        onStop:    snr_stop,
        onConfirm: snr_onConfirm
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
  const stBundleFrag = snr_buildBundleFragment();
  snr_cfg.header.extra = { fragment: stBundleFrag, lockDuringTest: true };
  SNR_els = buildTestPanel(parentEl, snr_cfg);
  snr_refreshBundleSelect();
  snr_refreshNoiseSelect();
  // Am Kategorie-Refresh-Register anmelden: Wird das Saetze-Material nachge-
  // laden (bedarfsgeladenes Buendel, Sprachwechsel, Upload), aktualisiert sich
  // die Sammlungs-Auswahl von selbst -- sonst erschiene das Dropdown erst nach
  // einem Upload, obwohl schon mehrere gebaute Sammlungen im Pool stehen.
  if (typeof amRegisterCategoryRefresh === "function") {
    amRegisterCategoryRefresh("saetze", snr_refreshBundleSelect);
    amRegisterCategoryRefresh("geraeusche", snr_refreshNoiseSelect);
  }
  if (typeof applyLang === "function") applyLang();
});
