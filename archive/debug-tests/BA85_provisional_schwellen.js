/* debug-tests-current.js — Bauanleitung 83
 *
 * Aktive Bau-Diagnose-Tests aus laufenden Bauanleitungen.
 * Konvention:
 *   - Tests heißen `build/BAxx/<topic>` und tragen `opts.tab` der
 *     zugehörigen Bauanleitung (z.B. "messungen", "player",
 *     "global").
 *   - Pro temporärem Test ein eigener IIFE-Block, klar mit
 *     Bauanleitungs-Nummer kommentiert.
 *   - Nach Bau-Abnahme entscheidet Sonnet auf Nachfrage beim
 *     Nutzer: entweder den Test entfernen, oder die Test-Definition
 *     nach archive/debug-tests/BAxx_<topic>.js verschieben.
 *
 * Diese Datei beim Start leer (bis auf Header). Sie wird von
 * Bauanleitungen befüllt und wieder geleert — und ist deshalb
 * der einzige Ort im aktiven Code, an dem Tests kommen und gehen.
 */

/* Bauanleitung 85 — fmComputeProvisional-Schwellen */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmComputeProvisional !== 'function') return;

  dbg.test(
    'build/BA85/provisional-schwellen',
    { tab: 'messungen', label: 'BA85 · Provisional-Schwellen (Match ab 2, Residual ab 4)' },
    function () {
      const mk = function (revCount, status) {
        const reversals = [];
        for (let i = 0; i < revCount; i++) reversals.push(i * 10 - revCount * 5);
        return { status: status || 'active', reversals: reversals, trialCount: revCount * 2 + 1 };
      };
      const cases = [
        { name: '0 revs',  track: mk(0), wantStatus: 'in-progress-early', wantMatch: false, wantResid: false },
        { name: '1 rev',   track: mk(1), wantStatus: 'in-progress-early', wantMatch: false, wantResid: false },
        { name: '2 revs',  track: mk(2), wantStatus: 'in-progress',       wantMatch: true,  wantResid: false },
        { name: '3 revs',  track: mk(3), wantStatus: 'in-progress',       wantMatch: true,  wantResid: false },
        { name: '4 revs',  track: mk(4), wantStatus: 'in-progress',       wantMatch: true,  wantResid: true  },
        { name: '6 revs',  track: mk(6), wantStatus: 'in-progress',       wantMatch: true,  wantResid: true  },
        { name: 'converged ignoriert', track: mk(6, 'converged'), wantStatus: null, wantMatch: false, wantResid: false }
      ];
      const fails = [];
      for (const c of cases) {
        const p = fmComputeProvisional(c.track);
        if (p.status !== c.wantStatus) {
          fails.push(c.name + ': status=' + p.status + ' (erwartet ' + c.wantStatus + ')');
          continue;
        }
        if (c.wantMatch && p.match == null) fails.push(c.name + ': match=null, erwartet Zahl');
        if (!c.wantMatch && p.match != null) fails.push(c.name + ': match=' + p.match + ', erwartet null');
        if (c.wantResid && p.residual == null) fails.push(c.name + ': residual=null, erwartet Zahl');
        if (!c.wantResid && p.residual != null) fails.push(c.name + ': residual=' + p.residual + ', erwartet null');
      }
      if (fails.length) return { ok: false, msg: fails.join(' · ') };
      return { ok: true, msg: cases.length + ' Schwellen-Fälle korrekt' };
    }
  );
})();
