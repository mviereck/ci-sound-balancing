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
    var slRef = typeof FRQ_els !== 'undefined' && FRQ_els &&
      FRQ_els.verfahren && FRQ_els.verfahren.slider && FRQ_els.verfahren.slider.slider;
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

/* BA399 — ELL_compWLS/drawChart-Parametrisierung neutral */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA399/parametrisierung-neutral', {
    tab: 'messungen',
    label: 'BA399: ELL_compWLS/drawChart-Parametrisierung neutral'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }

    // Test 1: ELL_compWLS ohne ctx vs. mit gleichwertigem ctx — identische levels
    var r1 = ELL_compWLS();
    var r2 = ELL_compWLS({
      ELL_results: ELL_results,
      elSt: elSt,
      elExDur: elExDur,
      ELL_refEl: ELL_refEl,
      nEl: nEl
    });
    var identical = r1.levels.length === r2.levels.length;
    if (identical) {
      for (var i = 0; i < r1.levels.length; i++) {
        if (Math.abs(r1.levels[i] - r2.levels[i]) > 1e-9) { identical = false; break; }
      }
    }
    chk('levels ohne ctx == levels mit globalem ctx (Toleranz 1e-9)', identical);

    // Test 2: ctx wirkt wirklich (Mini-ctx)
    var resultsVorher = ELL_results.slice();
    var miniCtx = {
      nEl: 3,
      ELL_results: [{a:0, b:1, offset:6}, {a:1, b:2, offset:6}],
      elSt: [null, null, null],
      elExDur: [null, null, null],
      ELL_refEl: 1
    };
    var r3 = ELL_compWLS(miniCtx);
    chk('Mini-ctx: levels hat 3 Elemente', r3.levels.length === 3);
    // Mit refEl=1, Paaren 0<1 und 1<2 mit offset=6 ergibt: lv[1]=0 (refEl),
    // lv[0] negativ (tiefer als Ref), lv[2] positiv (hoeher als Ref)
    chk('Mini-ctx: levels[0] < levels[1] (= 0)', r3.levels[0] < r3.levels[1]);
    chk('Mini-ctx: levels[1] (= 0) < levels[2]', r3.levels[1] < r3.levels[2]);
    // Globaler Zustand unveraendert
    var zustandUnveraendert = ELL_results.length === resultsVorher.length;
    if (zustandUnveraendert) {
      for (var j = 0; j < resultsVorher.length; j++) {
        if (ELL_results[j] !== resultsVorher[j]) { zustandUnveraendert = false; break; }
      }
    }
    chk('Globaler ELL_results unveraendert nach Mini-ctx-Aufruf', zustandUnveraendert);

    return lines.join('\n');
  });

  // BA400: ELL_ctx-Bauer reproduziert globalen Zustand
  dbg.test('build/BA400/ctx-bauer-neutral', {
    tab: 'messungen',
    label: 'BA400: ELL_ctx-Bauer reproduziert globalen Zustand'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }

    // Test 1: ELL_compWLS() vs ELL_compWLS(ELL_ctx("global")) — levels identisch
    var r1 = ELL_compWLS();
    var r2 = ELL_compWLS(ELL_ctx("global"));
    var identical = r1.levels.length === r2.levels.length;
    if (identical) {
      for (var i = 0; i < r1.levels.length; i++) {
        if (Math.abs(r1.levels[i] - r2.levels[i]) > 1e-9) { identical = false; break; }
      }
    }
    chk('compWLS(): levels ohne ctx == levels mit ELL_ctx("global") (Toleranz 1e-9)', identical);

    // Test 2: ctx-Felder korrekt
    var c = ELL_ctx("global");
    chk('c.nEl === nEl', c.nEl === nEl);
    chk('c.ELL_results === ELL_results', c.ELL_results === ELL_results);
    chk('c.ELL_refEl === ELL_refEl', c.ELL_refEl === ELL_refEl);
    chk('c.dEN(0) == dEN(0)', c.dEN(0) === dEN(0));
    chk('c.dENPrefix() == dENPrefix()', c.dENPrefix() === dENPrefix());
    chk('c.hzGetter(0) == FRQ_implantatEffektiv(0)', c.hzGetter(0) === FRQ_implantatEffektiv(0));

    // Test 3: andere Seite liefert DEREN nEl/ELL_results, globaler Zustand unveraendert
    var otherSide = activeSide === "left" ? "right" : "left";
    var co = ELL_ctx(otherSide);
    var otherSd = sideData[otherSide];
    var otherOk = otherSd && co.nEl === otherSd.nEl && co.ELL_results === otherSd.ELL_results;
    chk('ELL_ctx(otherSide).nEl/ELL_results gehoert zur anderen Seite', !!otherOk);
    chk('Globale nEl nach ELL_ctx(otherSide) unveraendert', nEl === c.nEl);
    chk('Globale ELL_results nach ELL_ctx(otherSide) unveraendert', ELL_results === c.ELL_results);

    return lines.join('\n');
  });
})();

/* BA401 — ELL_measGain nutzt effektive Frequenz */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA401/measgain-effektiv', {
    tab: 'messungen',
    label: 'BA401: ELL_measGain nutzt effektive Frequenz'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? '✓' : '✗') + ' ' + label); }

    var sd = sideData[activeSide];
    var hasData = sd && sd.ELL_results && sd.ELL_results.length > 0
               && typeof ELL_compWLS === 'function';
    if (!hasData) {
      return 'n/a — keine ELL-Messdaten fuer aktive Seite';
    }

    // Gepruefte Elektrode k: erste mit endlichem correction-Wert
    var levels = ELL_testData({ ctx: ELL_ctx('global') }).correction;
    var k = -1;
    for (var _i = 0; _i < levels.length; _i++) {
      if (isFinite(levels[_i])) { k = _i; break; }
    }
    if (k < 0) { return 'n/a — alle correction-Werte nicht-endlich'; }

    // Originale FRQ_implantatOwn sichern
    var origOwn = sd.FRQ_implantatOwn.slice();

    // Deutlich abweichenden eigenen Frequenzwert setzen
    var origHz = FRQ_implantat[k];
    var fakeHz = origHz * 1.5;
    sd.FRQ_implantatOwn[k] = fakeHz;
    bindActiveSide();

    // ELL_measGain genau bei der ueberschriebenen Frequenz aufrufen
    var gEff = ELL_measGain(activeSide, fakeHz);
    // Erwarteter Gain: dB2G(levels[k]) — Stuetzstelle sitzt jetzt an fakeHz
    var gExpected = dB2G(levels[k]);

    // Zustand exakt wiederherstellen
    sd.FRQ_implantatOwn = origOwn;
    bindActiveSide();

    var tol = 1e-6;
    chk('gEff(fakeHz) nahe gExpected(levels[k]) (Fix wirkt)', Math.abs(gEff - gExpected) < tol);
    chk('FRQ_implantatOwn nach Test wiederhergestellt', sd.FRQ_implantatOwn[k] === origOwn[k]);
    chk('Globale FRQ_implantatOwn nach bindActiveSide korrekt', FRQ_implantatOwn[k] === origOwn[k]);

    lines.push('  gEff=' + gEff.toFixed(6) + ' gExpected=' + gExpected.toFixed(6)
             + ' diff=' + Math.abs(gEff - gExpected).toExponential(2));

    return lines.join('\n');
  });
})();

/* BA402 — FRQ_implantatEffektiv(i, srcData) == _implEffFreqOf */
(function() {
  dbg.test('build/BA402/effektiv-srcData-neutral', {
    tab: 'messungen',
    label: 'BA402: FRQ_implantatEffektiv(i,srcData) == _implEffFreqOf'
  }, function() {
    var lines = [];
    function chk(desc, ok) { lines.push((ok ? 'OK' : 'FAIL') + ' ' + desc); }

    // Synthetisches srcData
    var sA = { FRQ_implantat: [100, 200, 300], FRQ_implantatOwn: [null, 250, null] };
    chk('i=0 -> Default 100', FRQ_implantatEffektiv(0, sA) === 100);
    chk('i=1 -> Own 250',     FRQ_implantatEffektiv(1, sA) === 250);
    chk('i=2 -> Default 300', FRQ_implantatEffektiv(2, sA) === 300);

    // 0-Fallback: kein FRQ_implantat im Objekt
    chk('0-Fallback kein FRQ_implantat', FRQ_implantatEffektiv(0, {}) === 0);

    // undefined -> globaler Pfad (nicht 0)
    var globalVal = FRQ_implantatEffektiv(0);
    var globalViaUndefined = FRQ_implantatEffektiv(0, undefined);
    chk('undefined -> globaler Pfad (nicht 0)', globalViaUndefined === globalVal);
    lines.push('  globalVal[0]=' + globalVal + ' globalViaUndefined[0]=' + globalViaUndefined);

    return lines.join('\n');
  });
})();

/* BA406 — Pro-Datei-Rechnung via ELL_compWLS(ctx) */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA406/prodatei-rechnung', {
    tab: 'messungen',
    label: 'BA406: Pro-Datei-Rechnung via ELL_compWLS(ctx)'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug) { return 'FAIL zaDebug nicht exportiert'; }
    var zaToCtx = window.zaDebug.toCtx;
    var zaMeanResidual = window.zaDebug.meanResidual;

    // 1. Synthetische Sitzung
    var session = {
      nEl: 3,
      raw: [{a:0, b:1, offset:6}, {a:1, b:2, offset:6}],
      elSt:    [null, null, null],
      elExDur: [null, null, null],
      refEl:   1
    };
    var mr = zaMeanResidual(session);
    chk('meanResidual: endliche Zahl >= 0 (kein NaN/null)', typeof mr === 'number' && isFinite(mr) && mr >= 0);

    // 2. zaToCtx-Felder korrekt
    var ctx = zaToCtx(session);
    chk('zaToCtx: nEl korrekt',         ctx.nEl         === session.nEl);
    chk('zaToCtx: ELL_results === raw', ctx.ELL_results === session.raw);
    chk('zaToCtx: elSt korrekt',        ctx.elSt        === session.elSt);
    chk('zaToCtx: elExDur korrekt',     ctx.elExDur     === session.elExDur);
    chk('zaToCtx: ELL_refEl === refEl', ctx.ELL_refEl   === session.refEl);

    // 3. Kein globaler Seiteneffekt
    var ellBefore = (typeof ELL_results !== 'undefined') ? ELL_results.slice() : null;
    var sideBefore = (typeof activeSide !== 'undefined') ? activeSide : null;
    zaMeanResidual(session);
    var ellAfter = (typeof ELL_results !== 'undefined') ? ELL_results : null;
    if (ellBefore !== null && ellAfter !== null) {
      var unchanged = ellBefore.length === ellAfter.length;
      if (unchanged) {
        for (var i = 0; i < ellBefore.length; i++) {
          if (ellBefore[i] !== ellAfter[i]) { unchanged = false; break; }
        }
      }
      chk('ELL_results global unveraendert nach zaMeanResidual', unchanged);
    } else {
      lines.push('INFO ELL_results nicht verfuegbar (kein Tool-Zustand)');
    }
    if (sideBefore !== null) {
      chk('activeSide unveraendert nach zaMeanResidual',
        (typeof activeSide !== 'undefined') && activeSide === sideBefore);
    }

    lines.push('  meanResidual=' + (mr !== null ? mr.toFixed(4) : 'null'));
    return lines.join('\n');
  });
})();

/* BA407 — Dedup + Vollstaendigkeitsfilter */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA407/dedup-vollstaendigkeit', {
    tab: 'messungen',
    label: 'BA407: Dedup + Vollstaendigkeitsfilter'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug) { return 'FAIL zaDebug nicht exportiert'; }
    var zaSameSession = window.zaDebug.sameSession;
    var zaDedup       = window.zaDebug.dedup;
    var zaIsComplete  = window.zaDebug.isComplete;

    var now = Date.now();
    var H = 3600 * 1000;

    // Hilfsfunktion: minimale synthetische Sitzung
    function mkSess(side, stempelMs, pairs) {
      var raw = pairs.map(function(p) {
        return { a: p[0], b: p[1], offset: p[2], timestamp: stempelMs };
      });
      return {
        side: side, nEl: 3,
        raw: raw,
        elSt:    [null, null, null],
        elExDur: [null, null, null],
        elActive: [true, true, true]
      };
    }

    var pairsA = [[0,1,3.0], [1,2,2.0]];

    // Test 1: Dedup fasst zusammen — gleiche Seite, 1 h Abstand, identische Paare
    var sA = mkSess('right', now,       pairsA);
    var sB = mkSess('right', now + H,   pairsA);   // 1 h juenger
    chk('zaSameSession: gleiche Seite 1h — true', zaSameSession(sA, sB));
    var dd1 = zaDedup([sA, sB]);
    chk('zaDedup: kept.length === 1', dd1.kept.length === 1);
    chk('zaDedup: mergedCount === 1', dd1.mergedCount === 1);
    chk('zaDedup: behalten = juengerer (sB)', dd1.kept[0] === sB);

    // Test 2: Dedup trennt — 48 h Abstand
    var sC = mkSess('right', now + 48 * H, pairsA);
    chk('zaSameSession: 48h Abstand — false', !zaSameSession(sA, sC));
    var dd2 = zaDedup([sA, sC]);
    chk('zaDedup: 48h — kept.length === 2', dd2.kept.length === 2);

    // Test 3: Verschiedene Seiten werden nie zusammengefasst
    var sLeft = mkSess('left',  now,     pairsA);
    var sRight = mkSess('right', now + H, pairsA);
    var dd3 = zaDedup([sLeft, sRight]);
    chk('zaDedup: links+rechts — kept.length === 2', dd3.kept.length === 2);

    // Test 4: Vollstaendigkeit — alle aktiven Elektroden gemessen
    var sessKomplett = {
      side: 'right', nEl: 3,
      raw: [{a:0, b:1, offset:1, timestamp: now},
            {a:1, b:2, offset:1, timestamp: now}],
      elSt:    [null, null, null],
      elExDur: [null, null, null],
      elActive: [true, true, true]
    };
    chk('zaIsComplete: alle gemessen — true', zaIsComplete(sessKomplett));

    // Test 5: Vollstaendigkeit — E1 aktiv aber ungemessen
    var sessLuecke = {
      side: 'right', nEl: 3,
      raw: [{a:0, b:2, offset:1, timestamp: now}],   // E1 fehlt
      elSt:    [null, null, null],
      elExDur: [null, null, null],
      elActive: [true, true, true]
    };
    chk('zaIsComplete: E1 ungemessen — false', !zaIsComplete(sessLuecke));

    // Test 6: Vollstaendigkeit — E1 abgewaehlt (elActive=false), ungemessen -> ok
    var sessAbgewaehlt = {
      side: 'right', nEl: 3,
      raw: [{a:0, b:2, offset:1, timestamp: now}],
      elSt:    [null, null, null],
      elExDur: [null, null, null],
      elActive: [true, false, true]   // E1 abgewaehlt
    };
    chk('zaIsComplete: E1 abgewaehlt+ungemessen — true', zaIsComplete(sessAbgewaehlt));

    return lines.join('\n');
  });
})();

/* BA403 — ELL_measGain/ELL_testData ohne withSide, seitenrichtig */
(function() {
  dbg.test('build/BA403/withside-ellctx-neutral', {
    tab: 'messungen',
    label: 'BA403: ELL_measGain/ELL_testData ohne withSide, seitenrichtig'
  }, function() {
    var lines = [];
    function chk(desc, ok) { lines.push((ok ? 'OK' : 'FAIL') + ' ' + desc); }

    // 1. ELL_measGain seitenrichtig: Seite ohne Messdaten liefert 1
    var sideBefore = activeSide;
    var otherSide = (activeSide === 'left') ? 'right' : 'left';
    var ctxOther = ELL_ctx(otherSide);
    var hasOtherData = ctxOther.ELL_results && ctxOther.ELL_results.length > 0;
    if (!hasOtherData) {
      chk('ELL_measGain(otherSide, 1000) == 1 (keine Daten)', ELL_measGain(otherSide, 1000) === 1);
    } else {
      lines.push('INFO otherSide hat Messdaten, Wert-Check entfaellt');
      var val = ELL_measGain(otherSide, 1000);
      chk('ELL_measGain(otherSide, 1000) finit', isFinite(val) && val > 0);
    }

    // 2. Kein globaler Seiteneffekt: activeSide unveraendert nach ELL_measGain
    ELL_measGain(otherSide, 1000);
    chk('activeSide nach ELL_measGain unveraendert', activeSide === sideBefore);

    // 3. ELL_testData({side}) == ELL_testData({ctx: ELL_ctx(side)}) elementweise
    var side = activeSide;
    var viaside = ELL_testData({ side: side }).correction;
    var viactx  = ELL_testData({ ctx: ELL_ctx(side) }).correction;
    var corrMatch = viaside && viactx && viaside.length === viactx.length &&
      viaside.every(function(v, i) { return Math.abs(v - viactx[i]) < 1e-9; });
    chk('ELL_testData({side}) == ELL_testData({ctx}) elementweise', !!corrMatch);
    lines.push('  correction.length=' + (viaside ? viaside.length : 'n/a'));

    return lines.join('\n');
  });

  dbg.test('build/BA404/den-side-neutral', {
    tab: 'messungen',
    label: 'BA404: dEN(i,side) == withSide-Label, seitenrichtig'
  }, function() {
    var lines = [];
    function chk(desc, ok) { lines.push((ok ? 'OK' : 'FAIL') + ' ' + desc); }

    // 1. dEN(i, side) == withSide(side, ()=>dEN(i)) fuer beide Seiten
    var sideBefore = activeSide;
    ['left', 'right'].forEach(function(side) {
      [0, 1, 2].forEach(function(i) {
        var via_param = dEN(i, side);
        var via_ws    = withSide(side, function() { return dEN(i); });
        chk('dEN(' + i + ',"' + side + '") == withSide', via_param === via_ws);
      });
    });

    // 2. dEN(i) ohne Argument == globales Verhalten unveraendert
    var globalMfr = MFR[mfr];
    [0, 1, 2].forEach(function(i) {
      var expected = globalMfr.apFirst ? i + 1 : nEl - i;
      chk('dEN(' + i + ') ohne side == global', dEN(i) === expected);
    });

    // 3. Kein globaler Seiteneffekt nach dEN(i, otherSide)
    var otherSide = (activeSide === 'left') ? 'right' : 'left';
    dEN(0, otherSide);
    chk('activeSide nach dEN(i,otherSide) unveraendert', activeSide === sideBefore);

    // 4. ELL_ctx.dEN weiterhin korrekt (Duplikat sauber aufgeloest)
    ['left', 'right'].forEach(function(side) {
      [0, 1].forEach(function(i) {
        var via_ctx   = ELL_ctx(side).dEN(i);
        var via_param = dEN(i, side);
        chk('ELL_ctx("' + side + '").dEN(' + i + ') == dEN(i,side)', via_ctx === via_param);
      });
    });
    var ctxGlobal = ELL_ctx('global');
    chk('ELL_ctx("global").dEN(0) == dEN(0, activeSide)', ctxGlobal.dEN(0) === dEN(0, activeSide));

    return lines.join('\n');
  });
})();
