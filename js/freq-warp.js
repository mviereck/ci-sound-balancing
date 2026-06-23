// ============================================================
// FREQ-WARP – Offline-Frequenz-Warping auf Basis von fRes
// ============================================================
// Geladen zwischen player.js (#14) und lr-balance.js (#15).
// Exportiert ins globale Scope:
//   buildWarpPoints(fResData, warpMode) → points[]
//   centShift(f, side, points) → number
//   pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) → Promise<AudioBuffer>
//   pWarpedBuf, pWarpMode, pWarpOn, pWarpStrength, pWarpBusy  (State)
//   pWarpTrigger()   – UI → Vorberechnung auslösen
//   pWarpUpdUI()     – Status-Anzeige aktualisieren

let pWarpedBuf = null;
let pWarpedBufNHSim = null;
let pWarpOn = true;
let pWarpSettingsOpen = false;
let pWarpMode = "right";        // "left" | "right" | "symmetric" — Default synchron mit HTML
let pWarpStrength = 100;        // 0–150
let pWarpCalcMode = "fast";    // BA375: Berechnungs-Modus. "fast"|"mid"|"best".
                               // Quelle fuer engine (r2/r3) + Streaming/Voll.
                               // Persistent (localStorage + JSON), Default "fast".
let pWarpBusy = false;
let pWarpCancel = false;     // wird vom Stop-Button gesetzt, von _rbProcessMonoSide gelesen
let pWarpProgress = 0;        // 0..1, nur bei Rubberband gefüttert
let pWarpAffected = { warpsLeft: false, warpsRight: false };

// BA375: engine (r2/r3) aus dem Berechnungs-Modus. Einzige Quelle.
function _warpEngineForMode() {
  return (pWarpCalcMode === "fast") ? "r2" : "r3";
}
// BA375: true = Streaming-Pfad, false = Voll-Vorberechnung.
function _warpUseStreamingForMode() {
  return pWarpCalcMode === "fast" || pWarpCalcMode === "mid";
}

// BA 191: Rubberband-Optionen. `realtime` und `liveShifter` sind RESERVE
// (BA370): ab S0 ohne UI, nur per Konsole erreichbar
// (pRubberbandOptions.realtime = true / .liveShifter = true). Bewusst
// behalten fuer die Streaming-Arbeit — NICHT als toten Code entfernen.
// Beide sind nicht persistent (werden beim Laden ignoriert, Default false).
let pRubberbandOptions = {
  engine:   "r3",        // bleibt; BA374 leitet aus Modus ab
  material: "standard",  // fest (UI entfernt, BA373)
  formant:  false,       // fest AUS (UI entfernt, BA373)
  fast:     false,       // fest AUS (UI entfernt, BA373)
  realtime: false,       // BA367 Testschalter: Rubberband Realtime-Modus
                         // (Elastic). NICHT persistent — faellt bei
                         // Neuladen auf false zurueck.
  liveShifter: false,    // BA368 Testschalter: RubberBandLiveShifter statt
                         // Stretcher. Ignoriert dann das realtime-Bit.
                         // NICHT persistent — faellt bei Neuladen auf false.
};

// Liefert die Rubberband-Bit-Maske aus dem Options-Objekt.
// Aufrufer aus dieser BA setzt realtime=false (Default). Die spaetere
// Live-BA ruft mit realtime=true auf — alle anderen Bits bleiben
// kombinierbar.
function _rbBuildOptionBits(opts) {
  const realtime = !!opts.realtime;
  const engine   = opts.engine === "r2" ? "r2" : "r3";
  const material = (opts.material === "speech" || opts.material === "percussive")
    ? opts.material : "standard";
  const formant  = opts.formant !== false; // Default an
  const fast     = !!opts.fast;

  let bits = 0;

  // Process-Mode: Offline (0x0) oder RealTime (0x1).
  bits |= realtime ? 0x00000001 : 0x00000000;

  // Engine: EngineFaster (R2, 0x0) oder EngineFiner (R3).
  bits |= (engine === "r3") ? 0x20000000 : 0x00000000;

  // Stretch: offline = Precise (0x10), live = Elastic (0x0).
  bits |= realtime ? 0x00000000 : 0x00000010;

  // Threading: Never (Pipeline ruft pro Band auf, kein internes Threading).
  bits |= 0x00010000;

  // Formant: Preserved (0x01000000) oder Shifted (0x0).
  bits |= formant ? 0x01000000 : 0x00000000;

  if (engine === "r3") {
    // PitchHighQuality (0x02000000) oder PitchHighSpeed (0x0).
    bits |= fast ? 0x00000000 : 0x02000000;
    // Material wirkt in R3 nur ueber die Fenstergroesse.
    if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    } else if (material === "percussive") {
      bits |= 0x00100000; // WindowShort
    }
    // Standard => WindowStandard (0x0).
  } else {
    // R2: Detector + Transients aus Material.
    if (material === "speech") {
      bits |= 0x00000800; // DetectorSoft
      bits |= 0x00000200; // TransientsSmooth
    } else if (material === "percussive") {
      bits |= 0x00000400; // DetectorPercussive
      // TransientsCrisp ist Default (0x0).
    }
    // Window: Schnell hat Vorrang vor Material-Window-Wahl.
    if (fast) {
      bits |= 0x00100000; // WindowShort
    } else if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    }
  }

  return bits;
}

// BA370 RESERVE: LiveShifter-Pfad, nur per Konsole erreichbar
// (pRubberbandOptions.liveShifter = true). Bewusst behalten — nicht loeschen.
// BA368: Option-Bits fuer den RubberBandLiveShifter (eigene, kleinere
// Enum als der Stretcher). Window fest auf Medium (beste Qualitaet —
// vorberechnet, "Schnell" ist hier bedeutungslos). Formant aus UI.
function _rbBuildLiveOptionBits(opts) {
  const formant = opts.formant !== false; // Default an

  let bits = 0;
  bits |= 0x00100000;                        // OptionWindowMedium
  bits |= formant ? 0x01000000 : 0x00000000; // FormantPreserved : Shifted
  return bits;
}

let _pWarpFResVersion = 0;

// Quelle der Warp-Punkte: fRes (final) + laufende Tracks (vorläufig), exakt
// dieselbe Vereinigung wie die Meßergebnis-Tabelle in results.js. So sieht
// das Warping immer das, was der Nutzer in der Tabelle sieht — keine
// abweichende Logik. fmStatus 'in-progress' und 'in-progress-early'
// (Platzhalter cent=0) werden mitgenommen; final hat Vorrang pro
// (varSide, elIdx).
// BA353: Quelle = zentraler aktives-Verfahren-Filter (results.js).
// Frueher: fRes + in-progress + Slider-Schaetzungen ungefiltert vereinigt.
function _warpFResSource() {
  return (typeof fmActiveResults === "function")
    ? fmActiveResults().filter(function (r) { return !(r && r.fmExcluded); })
    : [];
}

// Zählt die Quelle für UI-Anzeige.
function _warpFResStats() {
  const all = _warpFResSource();
  let finals = 0, provisional = 0, sliderEst = 0;
  for (const r of all) {
    if (!r) continue;
    if (r._sliderEstimate)   sliderEst++;
    else if (r._provisional) provisional++;
    else                     finals++;
  }
  return { total: all.length, finals, provisional, sliderEst };
}

// ---- Warp-Kurve aufbauen --------------------------------

function buildWarpPoints(fResData, warpMode, invert = false) {
  // fResData: Array { varSide, refSide, elIdx, varFreq, refFreq }
  // Gibt sortiertes Array { varFreq, csL, csR } zurück.
  //
  // Vorzeichen-Konvention der zurückgegebenen cs-Werte:
  // - Ohne invert (Default): cs = 1200 * log2(refFreq / varFreq), also die
  //   Wahrnehmungs-/Simulations-Richtung — wie die Cochlea die Wahrnehmung
  //   gegenüber der nominellen Elektroden-Mittenfrequenz verschiebt.
  //   `effFreqDisplay` nutzt das so, um die wahrgenommene Frequenz für die
  //   Anzeige zu berechnen.
  // - Mit invert=true: Vorzeichen gespiegelt; ergibt die Korrektur-/Vorhalt-
  //   Richtung — das Audio wird so vorverarbeitet, daß nach der Cochlea-
  //   Verzerrung beim CI-Träger die richtige Frequenz ankommt.
  //
  // Aufrufkonvention der Audio-Pipeline: `buildWarpPoints(..., !nhSim)`.
  //   NH-Sim aus (Korrektur-Modus) → invert=true → Vorhalt für CI-Wiedergabe.
  //   NH-Sim an (Simulation für Normalhörende) → invert=false → Verzerrung
  //   wird direkt aufs Audio gelegt.
  const pts = [];
  for (const r of fResData) {
    const cent = 1200 * Math.log2(r.refFreq / r.varFreq);
    let csL = 0, csR = 0;
    if (warpMode === "left") {
      if (r.refSide === "symmetric") {
        // sym-Eintrag ohne klare Ref-/Var-Seite: gleichmäßig verteilen
        csL = cent / 2;
        csR = cent / 2;
      } else if (r.varSide === "left") {
        csL = cent;
      } else if (r.refSide === "left") {
        csL = -cent;
      }
    } else if (warpMode === "right") {
      if (r.refSide === "symmetric") {
        csL = cent / 2;
        csR = cent / 2;
      } else if (r.varSide === "right") {
        csR = cent;
      } else if (r.refSide === "right") {
        csR = -cent;
      }
    } else { // symmetric
      if (r.refSide === "left")  csL = -cent / 2;
      else                       csR = -cent / 2;
      if (r.varSide === "left")  csL += cent / 2;
      else                       csR += cent / 2;
    }
    if (invert) { csL = -csL; csR = -csR; }
    pts.push({ varFreq: r.varFreq, csL, csR });
  }
  pts.sort((a, b) => a.varFreq - b.varFreq);
  return pts;
}

// ---- Migrations-Helfer für Alt-Werte ref_side/var_side ----
// Übersetzt Alt-Werte in absolute Seiten anhand der Referenzseite,
// die in den gespeicherten fRes-Einträgen steht. Wenn keine
// fRes-Daten vorhanden sind, fallback auf Default-Seite.
function _migrateLegacyWarpMode(savedMode, savedFRes) {
  if (savedMode !== "ref_side" && savedMode !== "var_side") {
    return savedMode;
  }
  let refSide = "left";
  if (Array.isArray(savedFRes) && savedFRes.length > 0) {
    const first = savedFRes[0];
    if (first && typeof first.refSide === "string") {
      refSide = first.refSide;
    }
  }
  if (refSide === "symmetric") return "symmetric";
  if (savedMode === "ref_side") {
    return refSide === "left" ? "left" : "right";
  }
  // var_side
  return refSide === "left" ? "right" : "left";
}

// ---- Hilfsfunktion: betroffene Seiten ermitteln ---------

function _warpAffectedSides(points) {
  let l = false, r = false;
  for (const p of points) {
    if (Math.abs(p.csL) > 1e-9) l = true;
    if (Math.abs(p.csR) > 1e-9) r = true;
  }
  return { warpsLeft: l, warpsRight: r };
}

// ---- Interpolation --------------------------------------

function centShift(f, side, points) {
  if (!points || points.length === 0) return 0;
  const key = side === "left" ? "csL" : "csR";
  if (points.length === 1) return points[0][key];
  const logF = Math.log2(f);
  const logFirst = Math.log2(points[0].varFreq);
  const logLast  = Math.log2(points[points.length - 1].varFreq);
  if (logF <= logFirst) return points[0][key];
  if (logF >= logLast)  return points[points.length - 1][key];
  for (let i = 0; i < points.length - 1; i++) {
    const f1 = Math.log2(points[i].varFreq);
    const f2 = Math.log2(points[i + 1].varFreq);
    if (logF >= f1 && logF <= f2) {
      const t = (logF - f1) / (f2 - f1);
      return points[i][key] + t * (points[i + 1][key] - points[i][key]);
    }
  }
  return 0;
}

// ---- Variante E: Rubberband-WASM Offline-Vorberechnung -----
//
// Bandweise echter Pitch-Shift via Rubberband-WASM. FIR-Bandpaesse
// (linearphasig, Blackman-Harris-Fenster) mit Grenzen am geometrischen
// Mittel der Nachbarmittenfrequenzen, pro Band ein Rubberband-Lauf in
// EngineFiner-Qualitaet, danach Summe und Pegelausgleich. Mono-
// Optimierung: pro Lauf nur die effektiv hoerbaren und tatsaechlich
// gewarpten Kanaele verarbeiten (siehe _rbDecideAffectedSides).


const _RB_FIR_ORDER = 4096; // FIR-Ordnung der Bandpaesse (linearphasig)

// BA371: Abschnittslänge für gestreamtes Warping. Startwert 5 s
// (Nutzer-Entscheidung): längeres Erst-Warten als 2-3 s, dafür weniger
// Abschnittsgrenzen (weniger hörbare harte Kanten bis S2-Crossfade, und
// weniger Crossfade-Aufwand). In S3 justierbar zu machen.
const STREAM_SEGMENT_SECONDS = 5;

// BA372 (S2): Equal-power-Crossfade-Laenge an Abschnittsgrenzen, in
// Sekunden. 15 ms = robuster Kompromiss (Messbefund: Korridor 10-20 ms
// unkritisch; <5 ms zu nah am Ausloeschungs-Tal, >=50 ms Doppel-Risiko bei
// Transienten). In S3 justierbar gemacht; vorerst feste Konstante.
const STREAM_CROSSFADE_SECONDS = 0.015;

// BA371: Stufen-agnostische Streaming-Engine (Architektur-Kapitel Paragraph3/4).
// Fuellt `target` (Stereo-AudioBuffer voller Stuecklänge) abschnittsweise,
// indem sie `stage.processSegment` pro Abschnitt aufruft. Meldet jeden
// fertigen Abschnitt ueber onSegmentReady(segIndex, segStart, segLen),
// damit der Aufrufer (Wiedergabe) ihn terminieren kann. Kennt KEINE
// Stufen-Namen.
//
// Parameter:
//   srcBuf  : Quell-AudioBuffer (Original, volle Laenge)
//   target  : Ziel-AudioBuffer (Stereo, volle Laenge) -- wird in-place gefuellt
//   stage   : Vertrag aus BA371 (processSegment, changesLength)
//   onSegmentReady(segIndex, segStartSample, segLenSample): Callback nach
//             jedem geschriebenen Abschnitt (fuer Wiedergabe-Terminierung)
//   onProgress(frac01): Fortschritt 0..1 (fuer pWarpProgress)
//   isCancelled(): () => bool  (Stop-Button / Generation-Wechsel)
//
// Rueckgabe: Promise, das nach dem letzten Abschnitt resolved (target voll).
async function streamFillBuffer(srcBuf, target, stage, onSegmentReady, onProgress, isCancelled, onMeasuredR) {
  const sr = srcBuf.sampleRate;
  const total = srcBuf.length;
  const segLen = Math.max(1, Math.round(STREAM_SEGMENT_SECONDS * sr));
  const nSeg = Math.ceil(total / segLen);

  // BA372 (S2): Crossfade-Laenge in Samples. Bypass-Stage (Warp aus) hat
  // keine Grenzartefakte -> changesLength bleibt false, aber wir blenden nur,
  // wenn die Stage tatsaechlich warpt. Indikator: stage.crossfade !== false.
  // (buildWarpStage setzt das; Bypass-Stage liefert crossfade: false.)
  const doXf = stage.crossfade !== false;
  const xfLen = doXf ? Math.max(0, Math.round(STREAM_CROSSFADE_SECONDS * sr)) : 0;

  // BA372: Schwanz des zuletzt geschriebenen Abschnitts (im Crossfade-Bereich),
  // zum Blenden des naechsten Kopfes. null = noch keiner (vor Abschnitt 0).
  let tailPrevL = null;
  let tailPrevR = null;

  for (let i = 0; i < nSeg; i++) {
    if (isCancelled()) throw new Error("__warp_cancelled__");
    const segStart = i * segLen;
    const thisLen = Math.min(segLen, total - segStart);

    // BA372: Folge-Abschnitte (i > 0) beginnen xfLen frueher und sind
    // entsprechend laenger -> die ersten xfLen Output-Samples bilden den
    // Blend-Kopf. Abschnitt 0 hat keinen Vorgaenger -> kein Vorlauf.
    const lead = (i > 0 && tailPrevL) ? Math.min(xfLen, segStart) : 0;
    const fetchStart = segStart - lead;
    const fetchLen = thisLen + lead;

    const srcSeg = stage.getSourceSegment(fetchStart, fetchLen);

    const ctx = {
      segIndex: i, segStart, segLen: thisLen, sampleRate: sr,
      isFirst: i === 0, isLast: i === nSeg - 1,
    };

    let _t0 = 0;
    const _measR = i < 4;   // BA376.1: erste bis zu 4 Abschnitte messen
    if (_measR) _t0 = (performance && performance.now) ? performance.now() : Date.now();
    const outSeg = await stage.processSegment(srcSeg, ctx);
    if (_measR) {
      const _t1 = (performance && performance.now) ? performance.now() : Date.now();
      const segAudio = thisLen / sr;
      const segCompute = (_t1 - _t0) / 1000;
      const rMeasured = segAudio > 0 ? (segCompute / segAudio) : 1;
      if (typeof onMeasuredR === "function") onMeasuredR(rMeasured, i);
    }
    if (isCancelled()) throw new Error("__warp_cancelled__");

    // BA372: Output ohne Vorlauf isolieren. outSeg.L/R hat Laenge fetchLen;
    // die ersten `lead` Samples sind der Vorlauf-Kopf, danach das
    // nominale Abschnitts-Material (Laenge thisLen).
    let bodyL = lead > 0 ? outSeg.L.subarray(lead, lead + thisLen) : outSeg.L.subarray(0, thisLen);
    let bodyR = lead > 0 ? outSeg.R.subarray(lead, lead + thisLen) : outSeg.R.subarray(0, thisLen);

    // BA372: Equal-power-Crossfade in den KOPF dieses Abschnitts schreiben.
    // Geblendet wird der gespeicherte Schwanz des Vorgaengers (tailPrev*) mit
    // dem Vorlauf-Kopf dieses Abschnitts (outSeg[0..lead)). Ergebnis ueber-
    // schreibt die ersten `lead` Samples von body* -> diese decken denselben
    // Zeitbereich ab wie der Vorgaenger-Schwanz. Der bereits geschriebene
    // Schwanz von i-1 in `target` bleibt UNVERAENDERT (Baustein A).
    if (lead > 0 && tailPrevL && tailPrevR) {
      // Kopien anlegen, weil body* Subarrays von outSeg sind und wir
      // hineinschreiben.
      const newL = new Float32Array(bodyL);
      const newR = new Float32Array(bodyR);
      const headL = outSeg.L; // Vorlauf-Kopf liegt in den ersten `lead` Samples
      const headR = outSeg.R;
      for (let n = 0; n < lead; n++) {
        const t = (n + 0.5) / lead;            // 0..1 ueber den Blend-Bereich
        const gOut = Math.cos(t * 0.5 * Math.PI); // Vorgaenger klingt aus
        const gIn  = Math.sin(t * 0.5 * Math.PI); // dieser Abschnitt setzt ein
        newL[n] = tailPrevL[n] * gOut + headL[n] * gIn;
        newR[n] = tailPrevR[n] * gOut + headR[n] * gIn;
      }
      bodyL = newL;
      bodyR = newR;
    }

    // In den Ziel-Buffer schreiben (Laengen-Treue: bodyL/R Laenge == thisLen).
    target.getChannelData(0).set(bodyL.subarray(0, thisLen), segStart);
    target.getChannelData(1).set(bodyR.subarray(0, thisLen), segStart);

    // BA372: Schwanz dieses Abschnitts fuer den naechsten Blend merken
    // (letzte xfLen Samples des gerade geschriebenen body*). Defensive Kopie,
    // weil bodyL/R im naechsten Durchlauf wiederverwendet/ueberschrieben wird.
    if (xfLen > 0 && thisLen >= xfLen) {
      tailPrevL = new Float32Array(bodyL.subarray(thisLen - xfLen, thisLen));
      tailPrevR = new Float32Array(bodyR.subarray(thisLen - xfLen, thisLen));
    } else {
      tailPrevL = null;
      tailPrevR = null;
    }

    if (typeof onSegmentReady === "function") onSegmentReady(i, segStart, thisLen);
    if (typeof onProgress === "function") onProgress((i + 1) / nSeg);
  }
}

// BA371: Baut die Warp-Stage fuer die Streaming-Engine. Kapselt die
// gesamte Vorbereitung (Punkte/Baender/cents/optionBits/Mono/Rueck-Pegel)
// und liefert getSourceSegment + processSegment, das EINEN Abschnitt durch
// die bestehende Band-fuer-Band-Verarbeitung schickt. KEIN Crossfade (S1).
//
// BA371.1: Rueck-Pegel-Bezugs-Basis = Abschnitt 0.
// Abschnitt 0 wird mit lokaler Normierung (heutiges Verhalten) verarbeitet;
// der dabei berechnete Faktor (peakIn/peakOut) wird als streamScaleL/R
// gespeichert und fuer alle Folgeabschnitte als fester scaleOverride
// uebergeben. So ist die Lautstaerke ueber alle Abschnitte konsistent
// (kein Dynamik-Nivellieren, keine Spruenge an Grenzen). Die leichte
// Abweichung zum Voll-Pfad (anderer Bezugspunkt: Abschnitt-0-Verhaeltnis
// vs. stückweites Verhaeltnis) ist bewusst akzeptiert.
// Spaeter ggf. erste N Abschnitte mitteln (Nutzer-Entscheidung).
function buildWarpStage(srcBuf, warpMode, strength) {
  const src = _warpFResSource();
  if (warpMode === "off" || src.length === 0 || strength === 0) {
    // Bypass: liefert originale Abschnitte unveraendert zurueck.
    return {
      changesLength: false,
      crossfade: false, // BA372: Bypass hat keine Grenzartefakte -> kein Blend
      getSourceSegment(segStart, thisLen) {
        const L = srcBuf.getChannelData(0).subarray(segStart, segStart + thisLen);
        const R = (srcBuf.numberOfChannels > 1 ? srcBuf.getChannelData(1) : srcBuf.getChannelData(0))
          .subarray(segStart, segStart + thisLen);
        return { L, R };
      },
      async processSegment(srcSeg) {
        return { L: srcSeg.L, R: srcSeg.R };
      },
    };
  }

  const nhSim = !!(document.getElementById("plNHSim") ? document.getElementById("plNHSim").checked : false);
  const points = buildWarpPoints(src, warpMode, !nhSim);
  const warpAffected = _warpAffectedSides(points);
  const str = strength / 100;

  const playerSide = (typeof getPlayerSide === "function") ? getPlayerSide() : "both";
  const decided = _rbDecideAffectedSides(points, playerSide);

  const sampleRate = srcBuf.sampleRate;
  const nyquist = sampleRate / 2;
  const bands = _rbBuildBandEdges(points, nyquist);

  const csL = points.map(function(p) { return p.csL * str; });
  const csR = points.map(function(p) { return p.csR * str; });

  const useLive = !!pRubberbandOptions.liveShifter;
  const optionBits = useLive
    ? _rbBuildLiveOptionBits({ formant: pRubberbandOptions.formant })
    : _rbBuildOptionBits({
        engine:   pRubberbandOptions.engine,
        material: pRubberbandOptions.material,
        formant:  pRubberbandOptions.formant,
        fast:     pRubberbandOptions.fast,
        realtime: !!pRubberbandOptions.realtime,
      });

  // Mono-Entscheidung (identisch zu pComputeRubberbandWarpedBuffer).
  const monoContent = playerSide === "left"
                   || playerSide === "right"
                   || playerSide === "mono";

  // Quell-Kanaele EINMAL extrahieren (volle Laenge; defensive Kopie).
  let fullSrcL, fullSrcR;
  if (monoContent) {
    const mono = (typeof _pDownmixMono === "function")
      ? _pDownmixMono(srcBuf)
      : new Float32Array(srcBuf.getChannelData(0));
    fullSrcL = mono;
    fullSrcR = mono;
  } else {
    fullSrcL = new Float32Array(srcBuf.getChannelData(0));
    fullSrcR = srcBuf.numberOfChannels > 1
      ? new Float32Array(srcBuf.getChannelData(1))
      : fullSrcL;
  }

  // pWarpAffected globale Variable fuer _buildWarpedPlaybackBuffer setzen.
  pWarpAffected = warpAffected;

  const sameAsLAnticipated = decided.needL && decided.needR
    && fullSrcL === fullSrcR
    && csL.length === csR.length
    && csL.every(function(v, i) { return v === csR[i]; });

  // rb-Handle wird lazy (beim ersten processSegment-Aufruf) geladen.
  let rbHandle = null;
  async function ensureRb() {
    if (!rbHandle) rbHandle = await rubberbandLoad();
    return rbHandle;
  }

  const _processSide = useLive ? _rbProcessMonoSideLive : _rbProcessMonoSide;

  // Schritt-Zaehler fuer onBand-Callback (Fortschritt innerhalb eines Abschnitts).
  // Im Streaming-Pfad wird der aeussere Fortschritt von streamFillBuffer gesteuert
  // (onProgress). onBand hier leer (kein per-Band-Update im Streaming-Modus).
  const onBand = null;

  // BA371.1: Rueck-Pegel-Bezugs-Basis = Abschnitt 0.
  // null = noch nicht bestimmt (Abschnitt 0 noch nicht verarbeitet).
  let streamScaleL = null;
  let streamScaleR = null;

  return {
    changesLength: false,
    crossfade: true, // BA372: Warp-Grenzen weich ueberblenden (equal-power, 15 ms)

    // Liefert { L, R } als Subarrays des voll extrahierten Quellsignals.
    // BA372: Engine darf hier mit Vorlauf (segStart frueher, thisLen laenger)
    // aufrufen; subarray bleibt korrekt, fetchStart >= 0 garantiert die Engine.
    getSourceSegment(segStart, thisLen) {
      return {
        L: fullSrcL.subarray(segStart, segStart + thisLen),
        R: fullSrcR.subarray(segStart, segStart + thisLen),
      };
    },

    async processSegment(srcSeg, ctx) {
      const rb = await ensureRb();
      if (pWarpCancel) throw new Error("__warp_cancelled__");

      let outL = srcSeg.L;
      let outR = srcSeg.R;

      // BA371.1: Abschnitt 0 ohne scaleOverride verarbeiten und Faktor merken;
      // alle Folgeabschnitte mit diesem festen Faktor (sprungfrei, konsistent).
      // Spaeter ggf. erste N Abschnitte mitteln (Nutzer-Entscheidung).
      const isFirst = streamScaleL === null;

      if (decided.needL) {
        if (isFirst) {
          const res = await _processSide(rb, srcSeg.L, sampleRate, bands, csL, onBand, optionBits, undefined, true);
          outL = res.out;
          streamScaleL = res.scale;
        } else {
          outL = await _processSide(rb, srcSeg.L, sampleRate, bands, csL, onBand, optionBits, streamScaleL);
        }
      }
      if (decided.needR) {
        if (sameAsLAnticipated && decided.needL) {
          outR = outL;
          if (isFirst) streamScaleR = streamScaleL;
        } else {
          if (pWarpCancel) throw new Error("__warp_cancelled__");
          if (isFirst) {
            const res = await _processSide(rb, srcSeg.R, sampleRate, bands, csR, onBand, optionBits, undefined, true);
            outR = res.out;
            streamScaleR = res.scale;
          } else {
            outR = await _processSide(rb, srcSeg.R, sampleRate, bands, csR, onBand, optionBits, streamScaleR);
          }
        }
      }
      // Falls weder L noch R berechnet wurde (kein decided.need*), Skalen auf 1 setzen.
      if (isFirst && streamScaleL === null) streamScaleL = 1;
      if (isFirst && streamScaleR === null) streamScaleR = 1;

      return { L: outL, R: outR };
    },
  };
}


// Entscheidet, welche Kanaele tatsaechlich Rubberband durchlaufen
// muessen — abhaengig von Player-Seite (was wird hoerbar?) und
// warpAffected-Sides (wo gibt es ueberhaupt Cent-Werte != 0?).
// Liefert { needL, needR }.
function _rbDecideAffectedSides(points, playerSide) {
  const aff = _warpAffectedSides(points);

  let audibleL = false, audibleR = false;
  if (playerSide === "left") audibleL = true;
  else if (playerSide === "right") audibleR = true;
  else { audibleL = true; audibleR = true; } // "both" oder "mono"

  return {
    needL: audibleL && aff.warpsLeft,
    needR: audibleR && aff.warpsRight,
  };
}

// Geometrische Bandgrenzen aus Stuetzpunkt-Frequenzen.
// Gibt Array von [low, high] Tupeln zurueck, gleiche Anzahl wie points.
// Bei einem einzigen Stuetzpunkt: ein Vollband (0 .. ~Nyquist).
function _rbBuildBandEdges(points, nyquist) {
  if (points.length === 0) return [];
  if (points.length === 1) {
    return [[0, nyquist * 0.999]];
  }
  const edges = [0];
  for (let i = 0; i < points.length - 1; i++) {
    edges.push(Math.sqrt(points[i].varFreq * points[i + 1].varFreq));
  }
  edges.push(nyquist * 0.999);

  const bands = [];
  for (let i = 0; i < points.length; i++) {
    bands.push([edges[i], edges[i + 1]]);
  }
  return bands;
}

// FIR-Bandpass-Koeffizienten (linearphasig, Blackman-Harris-Fenster).
// lowN, highN: normalisierte Frequenzen (0..1, 1 = Nyquist).
// Aequivalent zu scipy.signal.firwin(order+1, [low, high], pass_zero=False,
// window="blackmanharris") aus scripts/freqshift_filterbank.py.
function _rbDesignBandpassFIR(lowN, highN, order) {
  const n = order + 1;
  const h = new Float32Array(n);
  const M = order;
  // Sinc-basierter Bandpass = Sinc(high) - Sinc(low).
  for (let i = 0; i < n; i++) {
    const k = i - M / 2;
    let v;
    if (k === 0) {
      v = highN - lowN;
    } else {
      v = (Math.sin(Math.PI * highN * k) - Math.sin(Math.PI * lowN * k))
        / (Math.PI * k);
    }
    // Blackman-Harris-Fenster (4-Term)
    const a0 = 0.35875, a1 = 0.48829, a2 = 0.14128, a3 = 0.01168;
    const w = a0
            - a1 * Math.cos((2 * Math.PI * i) / M)
            + a2 * Math.cos((4 * Math.PI * i) / M)
            - a3 * Math.cos((6 * Math.PI * i) / M);
    h[i] = v * w;
  }
  return h;
}

// Convolution: signal (Float32Array) * fir (Float32Array) -> Float32Array
// gleicher Laenge ("same"-Mode, FIR-Verzoegerung order/2 heraus-
// gerechnet). Linear, ohne FFT — bei order=4096 wuerde JS O(N*M) zu
// langsam. Stattdessen FFT-Convolution via OfflineAudioContext +
// ConvolverNode.
async function _rbConvolveViaWebAudio(signal, fir, sampleRate) {
  const outLen = signal.length + fir.length - 1;
  const oc = new OfflineAudioContext(1, outLen, sampleRate);

  const irBuf = oc.createBuffer(1, fir.length, sampleRate);
  irBuf.getChannelData(0).set(fir);

  const conv = oc.createConvolver();
  conv.normalize = false;
  conv.buffer = irBuf;

  const srcBuf = oc.createBuffer(1, signal.length, sampleRate);
  srcBuf.getChannelData(0).set(signal);
  const src = oc.createBufferSource();
  src.buffer = srcBuf;
  src.connect(conv);
  conv.connect(oc.destination);
  src.start(0);

  const rendered = await oc.startRendering();
  // FIR-Verzoegerung ist (fir.length - 1) / 2; wir trimmen den Anfang
  // weg und bringen die Ausgabe auf signal.length.
  const delay = Math.floor((fir.length - 1) / 2);
  const out = new Float32Array(signal.length);
  const src0 = rendered.getChannelData(0);
  out.set(src0.subarray(delay, delay + signal.length));
  return out;
}

// Pitch-Shift via Rubberband. cents > 0: hoeher, cents < 0: tiefer.
// Liefert Float32Array gleicher Laenge wie signal (Anfangs-Latenz von
// Rubberband wird abgeschnitten, Tail-Padding mit Stille).
async function _rbPitchShift(rb, signal, sampleRate, cents, optionBits) {
  if (Math.abs(cents) < 0.5) {
    // Vernachlaessigbar — direkt zurueck (defensive Kopie nicht noetig,
    // weil Aufrufer signal nicht weiterverwendet).
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_new(
    sampleRate, 1, optionBits, 1.0, pitchScale
  );

  // Pointer-auf-Pointer-Setup fuer Rubberband-API (channels=1).
  const inPtrPtr  = rb.malloc(4);
  const outPtrPtr = rb.malloc(4);
  const CHUNK = 4096;
  const inBufPtr  = rb.malloc(CHUNK * 4);
  const outBufPtr = rb.malloc(CHUNK * 4);
  rb.memWritePtr(inPtrPtr,  inBufPtr);
  rb.memWritePtr(outPtrPtr, outBufPtr);

  try {
    rb.rubberband_set_expected_input_duration(state, signal.length);

    const startPad = rb.rubberband_get_preferred_start_pad(state);
    const tmp = new Float32Array(CHUNK);

    // 1) Study-Phase: Eingabe einmal komplett scannen.
    // Alle ~16 Chunks an den Event-Loop yielden + pWarpCancel prüfen, damit
    // der Stop-Button anklickbar bleibt und der Abbruch zeitnah wirkt
    // (sonst blockiert die WASM-Schleife den Main-Thread bei großen Buffern).
    {
      let pos = -startPad;
      let yieldCounter = 0;
      while (pos < signal.length) {
        const want = Math.min(CHUNK, signal.length - Math.max(pos, 0));
        if (want <= 0) break;
        for (let i = 0; i < want; i++) {
          const srcIdx = pos + i;
          tmp[i] = (srcIdx >= 0 && srcIdx < signal.length)
            ? signal[srcIdx] : 0;
        }
        rb.memWrite(inBufPtr, tmp.subarray(0, want));
        const isFinal = (pos + want) >= signal.length ? 1 : 0;
        rb.rubberband_study(state, inPtrPtr, want, isFinal);
        pos += want;
        if ((++yieldCounter & 15) === 0) {
          if (pWarpCancel) throw new Error("__warp_cancelled__");
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
    }

    // 2) Process-Phase: Eingabe erneut, parallel Output abholen.
    const outChunks = [];
    let outTotal = 0;
    {
      let pos = -startPad;
      let yieldCounter = 0;
      while (pos < signal.length) {
        const want = Math.min(CHUNK, signal.length - Math.max(pos, 0));
        if (want <= 0) break;
        for (let i = 0; i < want; i++) {
          const srcIdx = pos + i;
          tmp[i] = (srcIdx >= 0 && srcIdx < signal.length)
            ? signal[srcIdx] : 0;
        }
        rb.memWrite(inBufPtr, tmp.subarray(0, want));
        const isFinal = (pos + want) >= signal.length ? 1 : 0;
        rb.rubberband_process(state, inPtrPtr, want, isFinal);

        let avail = rb.rubberband_available(state);
        while (avail > 0) {
          const take = Math.min(avail, CHUNK);
          rb.rubberband_retrieve(state, outPtrPtr, take);
          const chunk = rb.memReadF32(outBufPtr, take);
          const copy = new Float32Array(take);
          copy.set(chunk);
          outChunks.push(copy);
          outTotal += take;
          avail = rb.rubberband_available(state);
        }
        pos += want;
        if ((++yieldCounter & 15) === 0) {
          if (pWarpCancel) throw new Error("__warp_cancelled__");
          await new Promise(function (r) { setTimeout(r, 0); });
        }
      }
    }

    // 3) Drain: restliches Output abholen, bis Rubberband meldet, daß
    //    nichts mehr da ist (avail <= 0).
    while (true) {
      const avail = rb.rubberband_available(state);
      if (avail <= 0) break;
      const take = Math.min(avail, CHUNK);
      rb.rubberband_retrieve(state, outPtrPtr, take);
      const chunk = rb.memReadF32(outBufPtr, take);
      const copy = new Float32Array(take);
      copy.set(chunk);
      outChunks.push(copy);
      outTotal += take;
    }

    // Output zusammenfuegen.
    const merged = new Float32Array(outTotal);
    let off = 0;
    for (const c of outChunks) {
      merged.set(c, off);
      off += c.length;
    }

    // Anfangs-Latenz von Rubberband abschneiden.
    const startDelay = rb.rubberband_get_start_delay(state);
    const result = new Float32Array(signal.length);
    const usable = Math.max(0, merged.length - startDelay);
    const copyLen = Math.min(signal.length, usable);
    if (copyLen > 0) {
      result.set(merged.subarray(startDelay, startDelay + copyLen));
    }
    return result;
  } finally {
    rb.free(inPtrPtr);
    rb.free(outPtrPtr);
    rb.free(inBufPtr);
    rb.free(outBufPtr);
    rb.rubberband_delete(state);
  }
}

// Eine Mono-Seite durch alle Baender schicken und summieren, mit
// Pegelausgleich.
// BA371.1: optionaler 8. Parameter scaleOverride (Default undefined).
//   undefined: heutiges Verhalten -- lokales peakIn/peakOut bestimmen
//              und scale = peakIn/peakOut anwenden. Voll-Pfad nutzt
//              immer diesen Weg (unveraendert).
//   Zahl:      diesen Skalierungsfaktor direkt anwenden, keine eigene
//              Peak-Messung. Streaming-Pfad ab Abschnitt 1 (Faktor
//              aus Abschnitt 0).
// Optionaler 9. Parameter returnScale (Default false):
//   true:  Rueckgabe { out, scale } statt nur out. Genutzt von
//          buildWarpStage beim ersten Abschnitt, um den Faktor zu merken.
//   false: Rueckgabe Float32Array (Voll-Pfad, alle anderen Aufrufe).
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone, optionBits, scaleOverride, returnScale) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bands.length; i++) {
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i], optionBits);
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
    if (typeof onBandDone === "function") onBandDone();
  }
  // Pegelausgleich.
  let appliedScale = 1;
  if (scaleOverride !== undefined) {
    // BA371.1: festen Faktor aus Abschnitt 0 anwenden.
    appliedScale = scaleOverride;
    if (appliedScale !== 1) {
      for (let n = 0; n < out.length; n++) out[n] *= appliedScale;
    }
  } else {
    // Heutiges Verhalten: peakIn/peakOut lokal messen.
    let peakIn = 0, peakOut = 0;
    for (let n = 0; n < srcMono.length; n++) {
      const ai = Math.abs(srcMono[n]); if (ai > peakIn) peakIn = ai;
    }
    for (let n = 0; n < out.length; n++) {
      const ao = Math.abs(out[n]); if (ao > peakOut) peakOut = ao;
    }
    if (peakOut > 0 && peakIn > 0) {
      appliedScale = peakIn / peakOut;
      for (let n = 0; n < out.length; n++) out[n] *= appliedScale;
    }
  }
  return returnScale ? { out, scale: appliedScale } : out;
}

// BA370 RESERVE: LiveShifter-Pfad, nur per Konsole erreichbar
// (pRubberbandOptions.liveShifter = true). Bewusst behalten — nicht loeschen.
// BA368: LiveShifter-Variante von _rbProcessMonoSide. Nutzt den
// RubberBandLiveShifter (reiner Pitch-Shift, feste Blockgroesse) statt
// des Stretchers. Vorberechnet wie die Stretcher-Variante: blockweise
// ueber das ganze Stueck in einen Buffer. Pegelausgleich + Latenz-
// Abschnitt identisch zu _rbProcessMonoSide.
//
// liveOpts: Rubberband-LiveShifter-Option-Bits (Window + Formant).
async function _rbProcessMonoSideLive(rb, srcMono, sampleRate, bands, csValues, onBandDone, liveOpts) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;

  for (let i = 0; i < bands.length; i++) {
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    if (pWarpCancel) throw new Error("__warp_cancelled__");

    const shifted = await _rbLivePitchShift(rb, filtered, sampleRate, csValues[i], liveOpts);
    if (pWarpCancel) throw new Error("__warp_cancelled__");

    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
    if (typeof onBandDone === "function") onBandDone();
  }

  // Pegelausgleich: Peak des Inputs als Ziel. (Identisch zu _rbProcessMonoSide.)
  let peakIn = 0, peakOut = 0;
  for (let n = 0; n < srcMono.length; n++) {
    const ai = Math.abs(srcMono[n]); if (ai > peakIn)  peakIn  = ai;
    const ao = Math.abs(out[n]);     if (ao > peakOut) peakOut = ao;
  }
  if (peakOut > 0 && peakIn > 0) {
    const scale = peakIn / peakOut;
    for (let n = 0; n < out.length; n++) out[n] *= scale;
  }
  return out;
}

// BA370 RESERVE: LiveShifter-Pfad, nur per Konsole erreichbar
// (pRubberbandOptions.liveShifter = true). Bewusst behalten — nicht loeschen.
// BA368: Pitch-Shift eines Mono-Signals via RubberBandLiveShifter.
// Liefert Float32Array gleicher Laenge wie signal (Anfangs-Latenz
// abgeschnitten). cents > 0: hoeher, < 0: tiefer.
async function _rbLivePitchShift(rb, signal, sampleRate, cents, liveOpts) {
  if (Math.abs(cents) < 0.5) {
    // Vernachlaessigbar — direkt zurueck (vgl. _rbPitchShift).
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_live_new(sampleRate, 1, liveOpts);
  rb.rubberband_live_set_pitch_scale(state, pitchScale);

  // Feste Blockgroesse abfragen — rein UND raus immer genau block Frames.
  const block = rb.rubberband_live_get_block_size(state);

  // Pointer-auf-Pointer-Setup (channels = 1), wie bei _rbPitchShift.
  const inPtrPtr  = rb.malloc(4);
  const outPtrPtr = rb.malloc(4);
  const inBufPtr  = rb.malloc(block * 4);
  const outBufPtr = rb.malloc(block * 4);
  rb.memWritePtr(inPtrPtr,  inBufPtr);
  rb.memWritePtr(outPtrPtr, outBufPtr);

  const tmpIn = new Float32Array(block);

  try {
    // Output sammeln. Der LiveShifter liefert pro shift()-Aufruf genau
    // block Frames, mit einer Anfangs-Latenz (start_delay), die wir
    // hinterher abschneiden. Wir fuettern das Signal in block-Haeppchen
    // und haengen am Ende genug Null-Bloecke an, um die Latenz aus dem
    // Shifter herauszuspuelen.
    const startDelay = rb.rubberband_live_get_start_delay(state);
    const totalIn = signal.length;
    // Anzahl Eingangs-Bloecke (aufgerundet) + Latenz-Spuelung.
    const inBlocks    = Math.ceil(totalIn / block);
    const flushBlocks = Math.ceil(startDelay / block) + 1;
    const totalBlocks = inBlocks + flushBlocks;

    const outChunks = [];
    let outTotal = 0;
    let yieldCounter = 0;

    for (let b = 0; b < totalBlocks; b++) {
      if (pWarpCancel) throw new Error("__warp_cancelled__");

      // Eingangs-Block fuellen (mit Stille auffuellen, wenn Signal zu Ende).
      const base = b * block;
      for (let k = 0; k < block; k++) {
        const idx = base + k;
        tmpIn[k] = (idx < totalIn) ? signal[idx] : 0;
      }
      rb.memWrite(inBufPtr, tmpIn);

      rb.rubberband_live_shift(state, inPtrPtr, outPtrPtr);

      const chunk = rb.memReadF32(outBufPtr, block);
      const copy = new Float32Array(block);
      copy.set(chunk);
      outChunks.push(copy);
      outTotal += block;

      // Periodisch an den Event-Loop yielden + Cancel pruefen
      // (analog _rbPitchShift), damit der Stop-Button reagiert.
      if ((++yieldCounter & 15) === 0) {
        if (pWarpCancel) throw new Error("__warp_cancelled__");
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }

    // Output zusammenfuegen.
    const merged = new Float32Array(outTotal);
    let off = 0;
    for (const c of outChunks) { merged.set(c, off); off += c.length; }

    // Anfangs-Latenz abschneiden, auf signal.length bringen.
    // (Identische Logik wie am Ende von _rbPitchShift.)
    const result = new Float32Array(signal.length);
    const usable = Math.max(0, merged.length - startDelay);
    const copyLen = Math.min(signal.length, usable);
    if (copyLen > 0) {
      result.set(merged.subarray(startDelay, startDelay + copyLen));
    }
    return result;
  } finally {
    rb.free(inPtrPtr);
    rb.free(outPtrPtr);
    rb.free(inBufPtr);
    rb.free(outBufPtr);
    rb.rubberband_live_delete(state);
  }
}

async function pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) {
  const src = _warpFResSource();
  if (warpMode === "off" || src.length === 0 || strength === 0) {
    return srcBuf;
  }

  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const points = buildWarpPoints(src, warpMode, !nhSim);
  pWarpAffected = _warpAffectedSides(points);
  const str = strength / 100;

  const playerSide = (typeof getPlayerSide === "function")
    ? getPlayerSide() : "both";
  const decided = _rbDecideAffectedSides(points, playerSide);

  const sampleRate = srcBuf.sampleRate;
  const nyquist = sampleRate / 2;
  const bands = _rbBuildBandEdges(points, nyquist);

  const csL = points.map(p => p.csL * str);
  const csR = points.map(p => p.csR * str);

  // Rubberband-Interface lazy laden (kann mit sprechender Fehlermeldung
  // werfen — der pWarpTrigger-catch-Block reicht sie nach
  // rubberbandLastError durch).
  const rb = await rubberbandLoad();

  // Quell-Kanaele extrahieren (defensive Kopie — Rubberband schreibt in
  // eigenen WASM-Heap, aber wir vermeiden Aliasing-Risiken).
  // BA 306: In allen Mono-Modi (Einseiten links/rechts ODER Beide-Seiten
  // mit Mono-Mischung) wird VOR dem Warping zu Mono gemischt. Das Warping
  // bleibt seitenspezifisch: beide Seiten warpen denselben Mono-Inhalt,
  // jede mit ihrer eigenen Cent-Kurve (csL/csR).
  const monoContent = playerSide === "left"
                   || playerSide === "right"
                   || playerSide === "mono";
  let srcL, srcR;
  if (monoContent) {
    const mono = (typeof _pDownmixMono === "function")
      ? _pDownmixMono(srcBuf)
      : new Float32Array(srcBuf.getChannelData(0));
    srcL = mono;
    srcR = mono;
  } else {
    srcL = new Float32Array(srcBuf.getChannelData(0));
    srcR = srcBuf.numberOfChannels > 1
      ? new Float32Array(srcBuf.getChannelData(1))
      : srcL;
  }

  // Ergebnis-Kanaele initial mit Original-Inhalt (= Bypass, falls nicht
  // gewarpt wird).
  let outL = srcL;
  let outR = srcR;

  // Schritt-Zähler vorab bestimmen, damit der Prozentwert stimmt.
  const sameAsLAnticipated = decided.needL && decided.needR
    && srcL === srcR
    && csL.length === csR.length
    && csL.every((v, i) => v === csR[i]);
  const totalBands = bands.length * (
    (decided.needL ? 1 : 0)
    + (decided.needR && !sameAsLAnticipated ? 1 : 0)
  );
  let doneBands = 0;
  const onBand = () => {
    if (totalBands > 0) {
      doneBands++;
      pWarpProgress = Math.min(1, doneBands / totalBands);
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    }
  };

  // BA370 RESERVE: Methoden-/Realtime-Auswahl bleibt erhalten, auch wenn
  // die UI-Schalter entfernt sind. liveShifter/realtime nur per Konsole.
  const useLive = !!pRubberbandOptions.liveShifter;

  const optionBits = useLive
    ? _rbBuildLiveOptionBits({ formant: pRubberbandOptions.formant })
    : _rbBuildOptionBits({
        engine:   pRubberbandOptions.engine,
        material: pRubberbandOptions.material,
        formant:  pRubberbandOptions.formant,
        fast:     pRubberbandOptions.fast,
        realtime: !!pRubberbandOptions.realtime,
      });

  const _processSide = useLive ? _rbProcessMonoSideLive : _rbProcessMonoSide;

  if (decided.needL) {
    outL = await _processSide(rb, srcL, sampleRate, bands, csL, onBand, optionBits);
  }
  if (decided.needR) {
    if (sameAsLAnticipated) {
      outR = outL;
    } else {
      if (pWarpCancel) throw new Error("__warp_cancelled__");
      outR = await _processSide(rb, srcR, sampleRate, bands, csR, onBand, optionBits);
    }
  }

  // Resultat-Buffer im Live-Context aufbauen.
  const c = gPC();
  const out = c.createBuffer(2, srcBuf.length, sampleRate);
  out.getChannelData(0).set(outL.subarray(0, srcBuf.length));
  out.getChannelData(1).set(outR.subarray(0, srcBuf.length));
  return out;
}

// ---- UI-Aktionen ----------------------------------------

function pWarpUpdUI() {
  const cbEl = document.getElementById("plWarpOn");

  if (!cbEl) return;

  styleToggleBtn("plWarpOn", pWarpOn, "pwWarpName");

  // SW (BA378): Play-Button NICHT mehr sperren. Berechnung und Wiedergabe
  // sind getrennt -- Play nimmt den Wunsch auch waehrend des Rechnens an.
  const playBtn = document.getElementById("plPlay");
  if (playBtn) {
    playBtn.disabled = false;
    playBtn.style.pointerEvents = "";
  }

  // Sanduhr = "Frequenz-Warping-Berechnung laeuft" (nur waehrend pWarpBusy).
  const busyIcon = document.getElementById("plPlayBusyIcon");
  if (busyIcon) busyIcon.style.display = pWarpBusy ? "" : "none";

  // Tooltip auf festen Text reduziert (kein Prozent, kein Sperr-Bezug).
  const busyTip = document.getElementById("plPlayBusyTip");
  if (busyTip) {
    busyTip.textContent = t("plWarpBusyTooltip");
    if (!pWarpBusy) busyTip.style.display = "none";
  }

  // Fortschrittsbalken im Transport-Bereich
  const progressRow = document.getElementById("plWarpProgressRow");
  const progressBar = document.getElementById("plWarpProgressBar");
  const progressPct = document.getElementById("plWarpProgressPct");
  if (progressRow) {
    if (pWarpBusy) {
      progressRow.style.display = "flex";
      const pct = Math.round(pWarpProgress * 100);
      if (progressBar) progressBar.style.width = pct + "%";
      if (progressPct) progressPct.textContent = pct + " %";
    } else {
      progressRow.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      if (progressPct) progressPct.textContent = "";
    }
  }
  if (typeof plUpdWarpLock === "function") plUpdWarpLock();
}

let pWarpGen = 0;  // Generation-Zähler — neuer Aufruf überholt ältere Runs.

async function pWarpTrigger() {
  const myGen = ++pWarpGen;
  pWarpedBuf = null;

  if (!pWarpOn) { pWarpUpdUI(); return; }
  if (_warpFResSource().length === 0) { pWarpUpdUI(); return; }
  if (!pSourceBuf) { pWarpUpdUI(); return; }

  // Falls eine vorherige Berechnung noch läuft (anderer Buffer): abbrechen
  // und auf deren Beendigung warten. Damit laufen zwei Aufrufe nicht parallel.
  if (pWarpBusy) {
    pWarpCancel = true;
    // BA371: Streaming-Sources stoppen, falls aktiv.
    if (typeof _streamStopAll === "function") _streamStopAll();
    while (pWarpBusy) {
      await new Promise(function (r) { setTimeout(r, 20); });
      if (myGen !== pWarpGen) return;
    }
  }

  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpCancel = false;
  pWarpProgress = 0;
  pWarpUpdUI();

  let cancelled = false;

  // BA375: Engine frisch aus dem Modus ableiten (einzige Schreibstelle).
  pRubberbandOptions.engine = _warpEngineForMode();
  const useStreaming = _warpUseStreamingForMode() && !pRubberbandOptions.liveShifter;

  if (useStreaming) {
    // ---- Streaming-Pfad (BA371 S1) ----
    try {
      const srcBuf = pSourceBuf;
      const c = gPC();
      // Leeren Ziel-Buffer anlegen (volle Länge, Stereo).
      pWarpedBuf = c.createBuffer(2, srcBuf.length, srcBuf.sampleRate);

      const stage = buildWarpStage(srcBuf, pWarpMode, pWarpStrength);

      // BA376: Startposition merken, bevor State zurueckgesetzt wird.
      if (typeof _streamSetStartPos === "function") _streamSetStartPos(pOff);
      // BA371: Streaming-State in player.js zurücksetzen.
      if (typeof _streamResetState === "function") _streamResetState();
      // BA376: Startposition nach Reset neu setzen (Reset nullt _streamStartPos).
      if (typeof _streamSetStartPos === "function") _streamSetStartPos(pOff);

      await streamFillBuffer(
        srcBuf,
        pWarpedBuf,
        stage,
        function onSegmentReady(segIndex, segStart, segLen) {
          // Abschnitt in player.js zur Wiedergabe-Terminierung melden.
          if (typeof _streamOnSegmentReady === "function") {
            _streamOnSegmentReady(segIndex, segStart, segLen, myGen);
          }
        },
        function onProgress(frac) {
          pWarpProgress = frac;
          if (typeof pWarpUpdUI === "function") pWarpUpdUI();
        },
        function isCancelled() {
          return pWarpCancel || myGen !== pWarpGen;
        },
        function onMeasuredR(rMeasured, segIndex) {   // BA376.1: Index statt seg0Audio
          if (typeof _streamSetMeasuredR === "function") _streamSetMeasuredR(rMeasured, segIndex);
        }
      );
    } catch (err) {
      if (err && err.message === "__warp_cancelled__") {
        cancelled = true;
        pWarpedBuf = null;
        if (typeof _streamStopAll === "function") _streamStopAll();
      } else {
        console.error("Warp-Streaming-Fehler:", err);
        pWarpedBuf = null;
        if (typeof _streamStopAll === "function") _streamStopAll();
        if (typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
          rubberbandLastError = err && err.message ? err.message : String(err);
        }
      }
    }
  } else {
    // ---- Voll-Vorrechnen-Pfad (unverändert) ----
    try {
      pWarpedBuf = await pComputeRubberbandWarpedBuffer(
        pSourceBuf, pWarpMode, pWarpStrength
      );
    } catch (err) {
      if (err && err.message === "__warp_cancelled__") {
        cancelled = true;
        pWarpedBuf = null;
      } else {
        console.error("Warp-Fehler:", err);
        pWarpedBuf = null;
        if (typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
          rubberbandLastError = err && err.message ? err.message : String(err);
        }
      }
    }
  }

  // pWarpBusy zurücksetzen, damit ein wartender Trigger weiterlaufen kann.
  pWarpBusy = false;
  pWarpProgress = 0;

  // Überholt von neuerem Trigger: still aufräumen, kein UI-Toggle, kein pPlay,
  // pWarpOn bleibt unverändert (Cancel war kein User-Wille).
  if (myGen !== pWarpGen) return;

  pWarpCancel = false;

  if (cancelled) {
    // Interner Cancel (neuer Trigger) wird nie hierher kommen —
    // myGen !== pWarpGen hat schon returniert.
    // Hier ist es also immer ein User-Cancel: pWarpOn ist bereits false
    // (vom Click-Handler gesetzt). Nur DOM-Sync noetig.
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    // SW (BA379): ungewarpt weiterspielen ueber Wunsch-Mechanismus.
    if (wasPlaying && typeof _pSetPlayWish === "function") _pSetPlayWish(true);
    if (wasPlaying && typeof pPlay === "function") pPlay();
    return;
  }

  // Nach Streaming: pBuf auf den nun fertigen pWarpedBuf setzen (2. Durchlauf
  // nutzt ihn wie der Voll-Pfad, ohne Neuberechnung).
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (pWarpOn) {
    // SW (BA380): Einheitlicher Start ueber Play-Wunsch + Gate fuer ALLE Modi.
    if (useStreaming) {
      // Streaming-Pfad: _streamOnSegmentReady hat Wiedergabe bereits gestartet
      // (pPlaying=true, Kette verdrahtet). Kein pPlay() -- wuerde eine zweite
      // Source starten und die Kette neu verdrahten.
      // Ausnahme: Stück so kurz, dass kein Abschnitt _streamFirstReady gesetzt
      // hat (kaum vorkommbar). Falls Play-Wunsch vorliegt, normal starten.
      // BA371.2: _streamFirstReady ist der verbindliche Indikator --
      // nicht _streamIsActive() (Sources koennen am Trigger-Ende schon leer sein).
      if (!_streamFirstReady && pPlayWish && typeof pPlay === "function") pPlay();
      // Wenn _streamFirstReady gesetzt: Wiedergabe laeuft -- nichts tun.
    } else {
      // "Beste": Berechnung hier fertig (pWarpedBuf gesetzt, pWarpBusy=false).
      // Gate in _pGateOpen() jetzt offen -> pPlay() startet sofort.
      if (pPlayWish && typeof pPlay === "function") pPlay();
    }
  }
}

function pWarpCancelCompute() {
  if (!pWarpBusy) return;
  pWarpCancel = true;
}

// ---- Default-Anwendung beim ersten Frequenzabgleich-Resultat ----
// Wird einmal pro Session beim Übergang "0 → 1+ Messungen"
// aufgerufen. Setzt pWarpMode auf die Zielseite (= nicht die
// Referenzseite). Wenn der Default in dieser Session bereits
// angewendet wurde, ist die Funktion idempotent (kein Override).
// Beim Laden eines Saves mit vorhandenen Messungen muß
// pMarkPlayerWarpDefaultAsApplied() einmal aufgerufen werden,
// damit der gespeicherte pWarpMode nicht beim nächsten Insert
// überschrieben wird.
let _pPlayerWarpDefaultApplied = false;

// BA375: Spiegelt den persistenten pWarpCalcMode-Wert auf die Radio-Buttons.
// Nach jedem Laden (localStorage-Autoload, JSON-Datei) aufrufen.
function _pWarpCalcModeApply() {
  const v = (pWarpCalcMode === "mid" || pWarpCalcMode === "best") ? pWarpCalcMode : "fast";
  const r = document.querySelector('input[name="plWarpMode"][value="' + v + '"]');
  if (r) r.checked = true;
}

function pApplyWarpModeDefaultFromFm() {
  if (_pPlayerWarpDefaultApplied) return;
  _pPlayerWarpDefaultApplied = true;
  let mode = "right";
  if (typeof fmRefSide === "string") {
    if (fmRefSide === "left")            mode = "right";
    else if (fmRefSide === "right")      mode = "left";
    else if (fmRefSide === "symmetric")  mode = "symmetric";
  }
  pWarpMode = mode;
  const sel = document.getElementById("plWarpModeSelect");
  if (sel) sel.value = pWarpMode;
}

function pMarkPlayerWarpDefaultAsApplied() {
  _pPlayerWarpDefaultApplied = true;
}

// --- Tooltip auf gesperrtem Play-Button -------------------------
// Hover / Klick / Tap auf den gesperrten Play-Button zeigt
// "Frequenz-Warping wird noch berechnet …". Der Wrapper
// (#plPlayWrap) fängt die Events, weil disabled-Buttons selbst
// keine Maus-Events feuern; pWarpUpdUI setzt pointer-events:none
// auf dem Button, damit Klicks auf den Wrapper durchfallen.
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("plPlayWrap");
  const tip = document.getElementById("plPlayBusyTip");
  const btn = document.getElementById("plPlay");
  if (!wrap || !tip || !btn) return;

  const show = () => {
    if (typeof pWarpBusy === "undefined" || !pWarpBusy) return;  // SW (BA378)
    tip.style.display = "";
  };
  const hide = () => { tip.style.display = "none"; };

  wrap.addEventListener("mouseenter", show);
  wrap.addEventListener("mouseleave", hide);
  wrap.addEventListener("click", show);
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
});
