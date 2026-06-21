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
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  // (aktuell keine temporären Tests registriert)
})();

/* BA116 — SHT-Infrastruktur */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA116/sht-infrastruktur', { tab: 'messungen', label: 'SHT-Infrastruktur (BA116)' }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }
    chk('testUI.sideCheck vorhanden',
      typeof testUI !== 'undefined' && !!testUI.sideCheck &&
      typeof testUI.sideCheck.run === 'function');
    chk('testUI.sideCheck.startIdleWatch / stopIdleWatch',
      typeof testUI.sideCheck.startIdleWatch === 'function' &&
      typeof testUI.sideCheck.stopIdleWatch  === 'function');

    // Lazy-DOM-Test: run() soll .sht-modal.active erzeugen
    testUI.sideCheck.run(
      { sides: 'one', side: 'right' },
      function() {},
      function() {}
    );
    var shown = !!document.querySelector('.sht-modal.active');
    // Cleanup
    var mo = document.querySelector('.sht-modal');
    if (mo) mo.classList.remove('active');
    chk('SHT-Modal erscheint nach run() (lazy DOM)', shown);
    return lines.join('\n');
  });
})();

/* BA113 — Slider Auto-Extend API */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA113/slider-auto-extend', { tab: 'messungen', label: 'Slider Auto-Extend API (BA113)' }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }
    chk('testUI.slider.setValue vorhanden',
      typeof testUI !== 'undefined' && !!testUI.slider && typeof testUI.slider.setValue === 'function');
    chk('FM_SLIDER_RANGES entfernt',
      typeof FM_SLIDER_RANGES === 'undefined');
    chk('fmSlRangeIdx entfernt',
      typeof fmSlRangeIdx === 'undefined');
    var slRef = typeof fmEls !== 'undefined' && fmEls &&
      fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.slider;
    chk('slider.initialRange === 100', !!slRef && slRef.initialRange === 100);
    chk('slider.maxRange === 1200', !!slRef && slRef.maxRange === 1200);
    chk('extendBtn nicht in slider-refs', !!slRef && !('extendBtn' in slRef));
    return lines.join('\n');
  });
})();

/* BA368 — LiveShifter-Methode: Diagnose-Test */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA368/liveshifter-output', { tab: 'player', label: 'LiveShifter-Output (BA368)' }, async function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }

    chk('_rbProcessMonoSideLive vorhanden', typeof _rbProcessMonoSideLive === 'function');
    chk('_rbLivePitchShift vorhanden',      typeof _rbLivePitchShift === 'function');
    chk('_rbBuildLiveOptionBits vorhanden', typeof _rbBuildLiveOptionBits === 'function');
    chk('pRubberbandOptions.liveShifter vorhanden',
      typeof pRubberbandOptions !== 'undefined' && 'liveShifter' in pRubberbandOptions);

    // Synthetischer Sinus (440 Hz, 0.5 s bei 44100 Hz)
    var sr = 44100;
    var len = Math.round(sr * 0.5);
    var sig = new Float32Array(len);
    for (var i = 0; i < len; i++) sig[i] = Math.sin(2 * Math.PI * 440 * i / sr) * 0.5;

    try {
      var rb = await rubberbandLoad();
      var liveOpts = _rbBuildLiveOptionBits({ formant: true });
      var out = await _rbLivePitchShift(rb, sig, sr, 200, liveOpts);  // +200 Cent
      chk('Output gleiche Laenge wie Input', out.length === sig.length);
      var peakOut = 0;
      for (var n = 0; n < out.length; n++) { var a = Math.abs(out[n]); if (a > peakOut) peakOut = a; }
      chk('Output nicht nur Stille (peak > 0.01)', peakOut > 0.01);
    } catch(e) {
      lines.push('✗ Fehler: ' + e.message);
    }

    return lines.join('\n');
  });
})();
