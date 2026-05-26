/* Archivierte Bau-Diagnose-Tests — Bauanleitung 84
 * Thema: Fortschritts-Formel fmComputeProgressStats
 * Abgenommen: 2026-05-26
 * Verschoben aus js/debug-tests-current.js nach Bau-Abnahme.
 *
 * Funktion unter Test: fmComputeProgressStats(tracks) in freqmatch.js
 * Änderung: neue Funktion; realistischer Fortschritt mit
 *           min(reversals/6, 0.95) für aktive Tracks.
 */

/* Bauanleitung 84 — fmComputeProgressStats */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmComputeProgressStats !== 'function') return;

  dbg.test(
    'build/BA84/progress-formel',
    { tab: 'messungen', label: 'BA84 · Fortschritts-Formel' },
    function () {
      const cases = [
        {
          name: '4 aktiv, 0 Umkehrungen',
          tracks: {
            1: { status: 'active', reversals: [], trialCount: 2 },
            2: { status: 'active', reversals: [], trialCount: 1 },
            3: { status: 'active', reversals: [], trialCount: 3 },
            4: { status: 'active', reversals: [], trialCount: 0 }
          },
          want: 0
        },
        {
          name: '4 aktiv, je 3 Umkehrungen',
          tracks: {
            1: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            2: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            3: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            4: { status: 'active', reversals: [0,0,0], trialCount: 10 }
          },
          want: 50
        },
        {
          name: '2 konvergiert, 2 aktiv mit ≥6 Umkehrungen',
          tracks: {
            1: { status: 'converged',         reversals: [0,0,0,0,0,0], trialCount: 30 },
            2: { status: 'converged-noisy',   reversals: [0,0,0,0,0,0], trialCount: 35 },
            3: { status: 'active',            reversals: [0,0,0,0,0,0], trialCount: 20 },
            4: { status: 'active',            reversals: [0,0,0,0,0,0,0,0], trialCount: 25 }
          },
          want: 97.5
        },
        {
          name: 'alle konvergiert',
          tracks: {
            1: { status: 'converged',       reversals: [0,0,0,0,0,0], trialCount: 30 },
            2: { status: 'not-perceivable', reversals: [],            trialCount: 40 }
          },
          want: 100
        }
      ];
      const fails = [];
      for (const c of cases) {
        const got = fmComputeProgressStats(c.tracks).percent;
        if (Math.abs(got - c.want) > 0.5) {
          fails.push(c.name + ': erwartet ' + c.want + ' %, bekam ' + got.toFixed(1) + ' %');
        }
      }
      if (fails.length) return { ok: false, msg: fails.join(' · ') };
      return { ok: true, msg: cases.length + ' Fälle, alle innerhalb ±0,5 %' };
    }
  );
})();
