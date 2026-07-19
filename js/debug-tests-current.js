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

  // BA520: Streuband/Schritt/Ausgereizt
  dbg.test('build/BA520/streuband', { tab: 'messungen', label: 'BA520: Streuband/Schritt/Ausgereizt' }, function (ok, fail) {
    var backup = (typeof FRQ_pianoSession !== 'undefined') ? FRQ_pianoSession : null;
    try {
      // Fall A: Konvergierer (Elektrode 0, Sitzung 1)
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
      if (!bandA) { fail('Fall A: kein Band'); return; }
      if (Math.abs(bandA.mitte - 0) > 0.01)       { fail('Fall A: mitte erwartet 0, got ' + bandA.mitte); return; }
      if (Math.abs(bandA.residDown - 120) > 0.01)  { fail('Fall A: residDown erwartet 120, got ' + bandA.residDown); return; }
      if (Math.abs(bandA.residUp   - 120) > 0.01)  { fail('Fall A: residUp erwartet 120, got ' + bandA.residUp); return; }
      if (Math.abs(bandA.restspanne - 30) > 0.01)  { fail('Fall A: restspanne erwartet 30, got ' + bandA.restspanne); return; }
      var stepA = _frq_pianoNaechsterSchritt(0, 1);
      if (Math.abs(stepA - 30) > 0.01) { fail('Fall A: step erwartet 30, got ' + stepA); return; }
      if (_frq_pianoAusgereizt(0, 1) !== false) { fail('Fall A: ausgereizt soll false sein'); return; }

      // Fall B: stabiler Pendler (Elektrode 1, Sitzung 1)
      FRQ_pianoSession.perElectrode[1] = { verlauf: [
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 }
      ]};
      if (_frq_pianoAusgereizt(1, 1) !== true) { fail('Fall B: ausgereizt soll true sein'); return; }
      if (_frq_pianoNaechsterSchritt(1, 1) !== null) { fail('Fall B: naechsterSchritt soll null sein'); return; }
      var bandB = _frq_pianoResiduumBand(1);
      if (!bandB) { fail('Fall B: kein Band'); return; }
      // Fenster = Runden 3-5: lo -60, hi +90; mittlere lower=(-60-30-60)/3=-50, mittlere upper=(60+90+60)/3=70 -> mitte=10
      if (Math.abs(bandB.mitte - 10) > 0.01)      { fail('Fall B: mitte erwartet 10, got ' + bandB.mitte); return; }
      if (Math.abs(bandB.residDown - 70) > 0.01)  { fail('Fall B: residDown erwartet 70, got ' + bandB.residDown); return; }
      if (Math.abs(bandB.residUp   - 80) > 0.01)  { fail('Fall B: residUp erwartet 80, got ' + bandB.residUp); return; }
      if (Math.abs(bandB.restspanne - 60) > 0.01) { fail('Fall B: restspanne erwartet 60, got ' + bandB.restspanne); return; }

      // Fall C: Sitzungsstart Elektrode 1 fuer Sitzung 2
      var startC = _frq_pianoSitzungsStart(1, 2);
      if (Math.abs(startC.step - 30) > 0.01)   { fail('Fall C: step erwartet 30, got ' + startC.step); return; }
      if (Math.abs(startC.center - 15) > 0.01) { fail('Fall C: center erwartet 15, got ' + startC.center); return; }

      ok();
    } finally {
      FRQ_pianoSession = backup;
    }
  });
})();
