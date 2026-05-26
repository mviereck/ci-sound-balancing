/* Archivierte Bau-Diagnose-Tests — Bauanleitung 84
 * Thema: Round-Robin-Verteilung in fmPickNextTrack
 * Abgenommen: 2026-05-26
 * Verschoben aus js/debug-tests-current.js nach Bau-Abnahme.
 *
 * Funktion unter Test: fmPickNextTrack(state, rng) in freqmatch-staircase.js
 * Änderung: Signatur von (tracks, rng) auf ({tracks, roundQueue}, rng) umgestellt;
 *           geshuffelter Round-Robin statt uniform-zufälliger Auswahl.
 */

/* Bauanleitung 84 — Round-Robin in fmPickNextTrack */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmPickNextTrack !== 'function') return;

  dbg.test(
    'build/BA84/round-robin-verteilung',
    { tab: 'messungen', label: 'BA84 · Round-Robin-Verteilung' },
    function () {
      const tracks = {};
      const ids = [1, 3, 5, 7, 9];
      ids.forEach(function (i) {
        tracks[i] = { electrodeIdx: i, status: 'active' };
      });
      const state = { tracks: tracks, roundQueue: [] };

      const counts = {};
      ids.forEach(function (i) { counts[i] = 0; });
      const totalPicks = 20;
      for (let k = 0; k < totalPicks; k++) {
        const id = fmPickNextTrack(state);
        if (id == null) return { ok: false, msg: 'fmPickNextTrack lieferte null bei Pick ' + k };
        if (counts[id] == null) return { ok: false, msg: 'unerwartete ID: ' + id };
        counts[id]++;
        if ((k + 1) % ids.length === 0) {
          const want = (k + 1) / ids.length;
          for (const i of ids) {
            if (counts[i] !== want) {
              return {
                ok: false,
                msg: 'nach ' + (k + 1) + ' Picks: ID ' + i + '=' + counts[i] + ' (erwartet ' + want + ')'
              };
            }
          }
        }
      }
      return { ok: true, msg: '5 IDs, 4 Runden, Verteilung exakt gleichmäßig' };
    }
  );

  dbg.test(
    'build/BA84/round-robin-konvergenz-mitten',
    { tab: 'messungen', label: 'BA84 · Round-Robin: konvergierte Tracks fallen raus' },
    function () {
      const tracks = {
        1: { electrodeIdx: 1, status: 'active' },
        2: { electrodeIdx: 2, status: 'active' },
        3: { electrodeIdx: 3, status: 'active' }
      };
      const state = { tracks: tracks, roundQueue: [] };

      const seen = new Set();
      for (let k = 0; k < 3; k++) seen.add(fmPickNextTrack(state));
      if (seen.size !== 3) return { ok: false, msg: 'Runde 1: ' + seen.size + '/3 IDs gesehen' };

      tracks[2].status = 'converged';

      const next2 = [fmPickNextTrack(state), fmPickNextTrack(state)];
      const set2 = new Set(next2);
      if (set2.has(2)) return { ok: false, msg: 'konvergierter Track 2 wurde gewählt' };
      if (set2.size !== 2 || !set2.has(1) || !set2.has(3)) {
        return { ok: false, msg: 'Runde 2 unvollständig: ' + JSON.stringify(next2) };
      }
      return { ok: true, msg: 'konvergierter Track wird bei laufenden Runden übersprungen' };
    }
  );
})();
