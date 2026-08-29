/* debug-tests-current.js — Bauanleitung 83
 *
 * Aktive Bau-Diagnose-Tests aus laufenden Bauanleitungen.
 * Konvention:
 *   - Tests heißen `build/BAxx/<topic>` und tragen `opts.tab` der
 *     zugehörigen Bauanleitung (z.B. "messungen", "player",
 *     "global").
 *   - Pro temporärem Test ein eigener IIFE-Block, klar mit
 *     Bauanleitungs-Nummer kommentiert.
 *   - Nach Bau-Abnahme wird der Test wieder entfernt (die
 *     Git-Historie hält ihn fest).
 *
 * Diese Datei beim Start leer (bis auf Header). Sie wird von
 * Bauanleitungen befüllt und wieder geleert — und ist deshalb
 * der einzige Ort im aktiven Code, an dem Tests kommen und gehen.
 */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;

  // BA522: Verletzungs-Kanten + gewichtete Mitte
  dbg.test('build/BA522/streuband-kanten', { tab: 'messungen', label: 'BA522: Verletzungs-Kanten + gewichtete Mitte' }, function () {
    var backup = (typeof FRQ_pianoSession !== 'undefined') ? FRQ_pianoSession : null;
    function err(msg) { return { ok: false, msg: msg }; }
    try {
      // Fall A: sauberer Konvergierer (Elektrode 0, Sitzung 1)
      // Band = letzte Runde (+-30), grobe Vorrunden zaehlen nicht mehr
      FRQ_pianoSession = {
        frqRefMode: null, run: null,
        perElectrode: {
          0: { verlauf: [
            { step: 240, lower: -240, upper: 240, durchgang: 1 },
            { step: 120, lower: -120, upper: 120, durchgang: 1 },
            { step:  60, lower:  -60, upper:  60, durchgang: 1 },
            { step:  30, lower:  -30, upper:  30, durchgang: 1 }
          ]}
        }
      };
      var bandA = _frq_pianoResiduumBand(0);
      if (!bandA) return err('Fall A: kein Band');
      if (Math.abs(bandA.mitte - 0) > 0.001)      return err('Fall A: mitte erwartet 0, got ' + bandA.mitte);
      if (Math.abs(bandA.residDown - 30) > 0.001)  return err('Fall A: residDown erwartet 30, got ' + bandA.residDown);
      if (Math.abs(bandA.residUp   - 30) > 0.001)  return err('Fall A: residUp erwartet 30, got ' + bandA.residUp);
      if (Math.abs(bandA.restspanne - 30) > 0.001) return err('Fall A: restspanne erwartet 30, got ' + bandA.restspanne);
      var stepA = _frq_pianoNaechsterSchritt(0, 1);
      if (Math.abs(stepA - 15) > 0.001) return err('Fall A: step erwartet 15, got ' + stepA);
      if (_frq_pianoAusgereizt(0, 1) !== false) return err('Fall A: ausgereizt soll false sein');

      // Fall B: stabiler Pendler (Elektrode 1, Sitzung 1)
      FRQ_pianoSession.perElectrode[1] = { verlauf: [
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 }
      ]};
      if (_frq_pianoAusgereizt(1, 1) !== true) return err('Fall B: ausgereizt soll true sein');
      if (_frq_pianoNaechsterSchritt(1, 1) !== null) return err('Fall B: naechsterSchritt soll null sein');
      var bandB = _frq_pianoResiduumBand(1);
      if (!bandB) return err('Fall B: kein Band');
      // Fenster = Runden 3-5 (gleiche step=60): gewichtet = ungewichtet -> mitte=10
      if (Math.abs(bandB.mitte - 10) > 0.001)      return err('Fall B: mitte erwartet 10, got ' + bandB.mitte);
      if (Math.abs(bandB.residDown - 70) > 0.001)  return err('Fall B: residDown erwartet 70, got ' + bandB.residDown);
      if (Math.abs(bandB.residUp   - 80) > 0.001)  return err('Fall B: residUp erwartet 80, got ' + bandB.residUp);
      if (Math.abs(bandB.restspanne - 60) > 0.001) return err('Fall B: restspanne erwartet 60, got ' + bandB.restspanne);

      // Fall C: Sitzungsstart Elektrode 1 fuer Sitzung 2
      var startC = _frq_pianoSitzungsStart(1, 2);
      if (Math.abs(startC.step - 30) > 0.001)   return err('Fall C: step erwartet 30, got ' + startC.step);
      if (Math.abs(startC.center - 15) > 0.001) return err('Fall C: center erwartet 15, got ' + startC.center);

      // Fall D: asymmetrische Konvergenz, gewichtete Mitte (Elektrode 2, Sitzung 1)
      // Runde 1: step=60, lower=-30, upper=90 -> mitte=30; w=1/3600
      // Runde 2: step=30, lower=-30, upper=30 -> mitte=0;  w=1/900=4/3600
      // mitte = (30*1 + 0*4)/5 = 6
      // Band: Ausgangspunkt (letzte Runde) [-30,+30]; Verletzungs-Logik:
      //   e1 lower=-30 (sLo=null->-30), upper=90 (sHi=null->90)
      //   e2 lower=-30 (nicht < sLo=-30), upper=30 (nicht > sHi_davor=90) -> keine Ausweitung
      // bandLo=-30, bandHi=30; mitte=6 liegt darin
      FRQ_pianoSession.perElectrode[2] = { verlauf: [
        { step: 60, lower: -30, upper: 90, durchgang: 1 },
        { step: 30, lower: -30, upper: 30, durchgang: 1 }
      ]};
      var bandD = _frq_pianoResiduumBand(2);
      if (!bandD) return err('Fall D: kein Band');
      if (Math.abs(bandD.mitte - 6) > 0.001)       return err('Fall D: mitte erwartet 6, got ' + bandD.mitte);
      if (Math.abs(bandD.residDown - 36) > 0.001)   return err('Fall D: residDown erwartet 36, got ' + bandD.residDown);
      if (Math.abs(bandD.residUp - 24) > 0.001)     return err('Fall D: residUp erwartet 24, got ' + bandD.residUp);
      if (Math.abs(bandD.restspanne - 30) > 0.001)  return err('Fall D: restspanne erwartet 30, got ' + bandD.restspanne);

      return { ok: true, msg: 'A/B/C/D bestanden' };
    } finally {
      FRQ_pianoSession = backup;
    }
  });
})();

/* BA552 — FRQ_werte-Cache: Treffer bei gleichen Eingaben, Miss nach
 * Aenderung. Prueft die Zuverlaessigkeits-Invariante an einer im Schluessel
 * erfassten Quelle (activeSide). */
(function () {
  if (typeof dbg === "undefined" || !dbg.test) return;
  dbg.test("build/BA552/frqwerte-cache", { label: "FRQ_werte-Cache" }, function () {
    if (typeof FRQ_werte !== "function") return { ok: false, msg: "FRQ_werte fehlt" };
    var dist = (typeof FRQ_distribution !== "undefined") ? FRQ_distribution : "right";

    // 1) Zwei Aufrufe mit identischen Eingaben -> identische Array-Referenz
    //    (Cache-Treffer gibt dieselbe Referenz zurueck).
    var a = FRQ_werte("gehoert", dist, false);
    var b = FRQ_werte("gehoert", dist, false);
    if (a !== b) return { ok: false, msg: "Zweiter gleicher Aufruf war KEIN Cache-Treffer (verschiedene Referenz)" };

    // 2) Anderes Argument (form) -> Miss -> andere Referenz.
    var c = FRQ_werte("warp", dist, false);
    if (c === a) return { ok: false, msg: "Anderes Argument haette Neuberechnung ausloesen muessen" };

    // 3) Nach Aenderung einer erfassten Eingabe (activeSide) -> Miss.
    //    activeSide sicher zuruecksetzen im finally.
    var savedSide = activeSide;
    var missNachSideWechsel = false;
    try {
      var vorher = FRQ_werte("gehoert", "right", false);
      activeSide = (activeSide === "left") ? "right" : "left";
      var nachher = FRQ_werte("gehoert", "right", false);
      missNachSideWechsel = (vorher !== nachher);
    } finally {
      activeSide = savedSide;
      if (typeof bindActiveSide === "function") bindActiveSide();
    }
    if (!missNachSideWechsel) {
      return { ok: false, msg: "activeSide-Wechsel loeste keinen Cache-Miss aus (Schluessel unvollstaendig!)" };
    }

    return { ok: true, msg: "Treffer bei gleichen Eingaben, Miss bei Argument- und activeSide-Aenderung" };
  });
})();
