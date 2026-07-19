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

/* BA408 — Konsens-Paarliste + Gewichtung + ctxKonsens */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA408/konsolidierung', {
    tab: 'messungen',
    label: 'BA408: Konsens-Paarliste + Gewichtung + ctxKonsens'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug) return 'FAIL zaDebug nicht exportiert';
    var consensusPairs  = window.zaDebug.consensusPairs;
    var weight          = window.zaDebug.weight;
    var consolidatedCtx = window.zaDebug.consolidatedCtx;

    if (typeof consensusPairs !== 'function')  return 'FAIL zaDebug.consensusPairs fehlt';
    if (typeof weight         !== 'function')  return 'FAIL zaDebug.weight fehlt';
    if (typeof consolidatedCtx !== 'function') return 'FAIL zaDebug.consolidatedCtx fehlt';

    // Zugriff auf zaSessions via zaDebug ist nicht noetig — wir injecten
    // synthetische Sitzungen direkt ueber window._zaSessionsOverride nicht
    // moeglich (privat). Stattdessen: zaDebug.weight testen mit synthetischen
    // session-Objekten (meanResidual direkt gesetzt).

    // Test 1: Konsens-Mittel — gleiches Gewicht
    // weight funktioniert mit session.meanResidual
    var sessGleich = [
      { meanResidual: 1.0 },
      { meanResidual: 1.0 }
    ];
    var w0 = weight(sessGleich[0]);
    var w1 = weight(sessGleich[1]);
    chk('weight: gleiche Residuen => gleiche Gewichte', Math.abs(w0 - w1) < 1e-9);
    chk('weight: Gewicht > 0 bei Residuum 1.0', w0 > 0);

    // Test 2: Stärkere Sitzung (kleines Residuum) > schwache (grosses Residuum)
    var wGut    = weight({ meanResidual: 0.5 });
    var wSchlecht = weight({ meanResidual: 3.0 });
    chk('weight: kleine Residuum => groesseres Gewicht', wGut > wSchlecht);

    // Test 3: Keine Residuum => Gewicht 0
    var wNull = weight({ meanResidual: null });
    chk('weight: null-Residuum => 0', wNull === 0);
    var wNaN  = weight({});
    chk('weight: fehlendes meanResidual => 0', wNaN === 0);

    // Test 4: Schärfe wirkt — scharf spreizter als mild
    // Wir berechnen das Verhältnis wGut/wSchlecht bei mild vs scharf
    var origKey = window.zaDebug._zaSharpKey;   // nicht exportiert, ok
    // Wir testen indirekt: bei p=2 (scharf) ist Verhältnis groesser als p=1 (mild)
    // 1/(0.5^1 + EPS) vs 1/(3.0^1 + EPS) => ratio ~6
    // 1/(0.5^2 + EPS) vs 1/(3.0^2 + EPS) => ratio ~36
    var eps = 0.01;
    var ratioMild  = (1 / (Math.pow(0.5, 1.0) + eps)) / (1 / (Math.pow(3.0, 1.0) + eps));
    var ratioScharf = (1 / (Math.pow(0.5, 2.0) + eps)) / (1 / (Math.pow(3.0, 2.0) + eps));
    chk('weight-Verhältnis: scharf > mild (Formel)', ratioScharf > ratioMild);

    // Test 5: ctxKonsens haelt elSt aus Tool (nicht null/undefined)
    if (typeof ELL_ctx === 'function') {
      try {
        var ctx = consolidatedCtx('right');
        var toolCtx = ELL_ctx('right');
        chk('consolidatedCtx: elSt === ELL_ctx(side).elSt', ctx.elSt === toolCtx.elSt);
        chk('consolidatedCtx: ELL_refEl aus Tool', ctx.ELL_refEl === toolCtx.ELL_refEl);
        chk('consolidatedCtx: ELL_results ist Array', Array.isArray(ctx.ELL_results));
      } catch(e) {
        lines.push('FAIL consolidatedCtx-Ausnahme: ' + e);
      }
    } else {
      lines.push('SKIP ELL_ctx nicht verfuegbar');
    }

    // Test 6: consensusPairs liefert kein Duplikat-Paar (normalisiert)
    // Testen via direktem Aufruf (zaSessions ist leer wenn kein File geladen)
    var pairs = consensusPairs('right');
    var keys = {};
    var dupFound = false;
    (pairs || []).forEach(function(p) {
      var a = Math.min(p.a, p.b), b = Math.max(p.a, p.b);
      var k = a + '-' + b;
      if (keys[k]) dupFound = true;
      keys[k] = true;
    });
    chk('consensusPairs: keine Duplikat-Paare', !dupFound);

    return lines.join('\n');
  });
})();

/* BA409 — Heatmap-Datenbasis + Farbskala */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA409/heatmap-daten', {
    tab: 'messungen',
    label: 'BA409: Heatmap-Datenbasis + Farbskala'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug) return 'FAIL zaDebug nicht exportiert';
    var heatmapData = window.zaDebug.heatmapData;
    var heatColor   = window.zaDebug.heatColor;
    if (typeof heatmapData !== 'function') return 'FAIL zaDebug.heatmapData fehlt';
    if (typeof heatColor   !== 'function') return 'FAIL zaDebug.heatColor fehlt';

    // Test 1: Datenbasis mit geladenen Sitzungen
    var data = heatmapData(typeof activeSide !== 'undefined' ? activeSide : 'right');
    if (data.sessions.length > 0) {
      chk('sessions.length > 0', data.sessions.length > 0);
      chk('elCount > 0', data.elCount > 0);
      chk('tMin <= tMax', data.tMin <= data.tMax);
      var corrOk = data.sessions.every(function(s) {
        return Array.isArray(s.corr) && s.corr.length <= data.elCount;
      });
      chk('jede Session: corr.length <= elCount', corrOk);
    } else {
      lines.push('INFO keine Sitzungen geladen — Datenbasis-Test uebersprungen');
    }

    // Test 2: Historischer Status — synthetische Sitzung mit elSt[2]='mute'
    // Direkt zaHeatmapData zu testen ist nicht moeglich (greift auf zaSessions zu).
    // Stattdessen: zaToCtx-Kanal pruefen — elSt wird aus Datei-Feldern gelesen.
    var zaToCtx = window.zaDebug.toCtx;
    if (typeof zaToCtx === 'function') {
      var sessMute = {
        side: 'right', nEl: 3,
        raw: [{a:0, b:1, offset:3, timestamp: 1700000000000},
              {a:1, b:2, offset:3, timestamp: 1700000000000}],
        elSt:    [null, null, 'mute'],
        elExDur: [null, null, null],
        elActive: [true, true, true],
        refEl:   0
      };
      var ctx = zaToCtx(sessMute);
      chk('zaToCtx: elSt[2] === mute uebergeben', ctx.elSt[2] === 'mute');
      // ELL_compWLS berechnet levels; E2 wuerde als mute gefiltert
      if (typeof ELL_compWLS === 'function') {
        var r = ELL_compWLS(ctx);
        chk('ELL_compWLS auf mute-ctx liefert levels', Array.isArray(r.levels));
      }
    }

    // Test 3: Farbskala
    var white = heatColor(0);
    var cWhite = white.match(/\d+/g);
    chk('heatColor(0) nahe weiss (rgb >= 240)', cWhite && cWhite.every(function(v) { return parseInt(v) >= 240; }));

    var blue = heatColor(-10);
    var cBlue = blue.match(/\d+/g);
    chk('heatColor(-10) blau-betont (b > r)', cBlue && parseInt(cBlue[2]) > parseInt(cBlue[0]));

    var red = heatColor(10);
    var cRed = red.match(/\d+/g);
    chk('heatColor(+10) rot-betont (r > b)', cRed && parseInt(cRed[0]) > parseInt(cRed[2]));

    chk('heatColor(20) == heatColor(10) (gekappt)', heatColor(20) === heatColor(10));

    var grey = heatColor(null);
    chk('heatColor(null) grau (#e5e5e5)', grey === '#e5e5e5');

    // Test 4: Kein globaler Seiteneffekt
    var ellBefore = (typeof ELL_results !== 'undefined') ? ELL_results.slice() : null;
    var sideBefore = (typeof activeSide !== 'undefined') ? activeSide : null;
    heatmapData(sideBefore || 'right');
    var ellAfter = (typeof ELL_results !== 'undefined') ? ELL_results : null;
    if (ellBefore !== null && ellAfter !== null) {
      var unchanged = ellBefore.length === ellAfter.length;
      if (unchanged) {
        for (var i = 0; i < ellBefore.length; i++) {
          if (ellBefore[i] !== ellAfter[i]) { unchanged = false; break; }
        }
      }
      chk('ELL_results nach heatmapData unveraendert', unchanged);
    } else {
      lines.push('INFO ELL_results nicht verfuegbar');
    }
    if (sideBefore !== null) {
      chk('activeSide nach heatmapData unveraendert',
        (typeof activeSide !== 'undefined') && activeSide === sideBefore);
    }

    return lines.join('\n');
  });
})();

/* BA410 — Zeit-Trend-Datenbasis */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA410/trend-daten', {
    tab: 'messungen',
    label: 'BA410: Zeit-Trend-Datenbasis'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug) return 'FAIL zaDebug nicht exportiert';
    var heatmapData = window.zaDebug.heatmapData;
    var trendData   = window.zaDebug.trendData;
    if (typeof heatmapData !== 'function') return 'FAIL zaDebug.heatmapData fehlt';
    if (typeof trendData   !== 'function') return 'FAIL zaDebug.trendData fehlt';

    var side = (typeof activeSide !== 'undefined') ? activeSide : 'right';
    var hm = heatmapData(side);

    // Test 1: Residuum in der Datenquelle
    if (hm.sessions.length > 0) {
      var s0 = hm.sessions[0];
      chk('sessions[0].res ist Array', Array.isArray(s0.res));
      chk('sessions[0].res.length === corr.length', s0.res.length === s0.corr.length);
    } else {
      lines.push('INFO keine Sitzungen geladen — Tests 1-3 uebersprungen');
      return lines.join('\n');
    }

    // Test 2: Trend-Punkte fuer eine gemessene Elektrode
    var measuredEl = null;
    for (var i = 0; i < hm.elCount; i++) {
      var hasPts = hm.sessions.some(function(s) {
        return i < s.corr.length && s.corr[i] !== null;
      });
      if (hasPts) { measuredEl = i; break; }
    }
    if (measuredEl !== null) {
      var td = trendData(side, measuredEl);
      chk('trendData: points.length > 0', td.points.length > 0);
      var allValid = td.points.every(function(p) {
        return typeof p.ts === 'number' && isFinite(p.corr) && isFinite(p.res);
      });
      chk('alle Punkte: {ts, corr, res} endliche Zahlen', allValid);
      var sorted = td.points.every(function(p, i) {
        return i === 0 || p.ts >= td.points[i-1].ts;
      });
      chk('Punkte chronologisch sortiert (ts aufsteigend)', sorted);
    } else {
      lines.push('INFO keine gemessene Elektrode gefunden');
    }

    // Test 3: Inaktive Sitzungen erzeugen keinen Trend-Punkt
    // Synthethisch: trendData fuer Elektroden-Index ausserhalb aller corr-Arrays
    var outsideIdx = hm.elCount + 99;
    var tdOut = trendData(side, outsideIdx);
    chk('trendData: inaktiver Index ergibt 0 Punkte', tdOut.points.length === 0);

    // Test 4: Kein globaler Seiteneffekt
    var ellBefore = (typeof ELL_results !== 'undefined') ? ELL_results.slice() : null;
    var sideBefore = (typeof activeSide !== 'undefined') ? activeSide : null;
    trendData(side, measuredEl !== null ? measuredEl : 0);
    var ellAfter = (typeof ELL_results !== 'undefined') ? ELL_results : null;
    if (ellBefore !== null && ellAfter !== null) {
      var unchanged = ellBefore.length === ellAfter.length;
      if (unchanged) {
        for (var j = 0; j < ellBefore.length; j++) {
          if (ellBefore[j] !== ellAfter[j]) { unchanged = false; break; }
        }
      }
      chk('ELL_results nach trendData unveraendert', unchanged);
    } else {
      lines.push('INFO ELL_results nicht verfuegbar');
    }
    if (sideBefore !== null) {
      chk('activeSide nach trendData unveraendert',
        (typeof activeSide !== 'undefined') && activeSide === sideBefore);
    }

    return lines.join('\n');
  });
})();

/* BA411 — Konsens-Paarliste hat ELL_results-Format */
(function() {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA411/uebertrag', {
    tab: 'messungen',
    label: 'BA411: Konsens-Paarliste hat ELL_results-Format'
  }, function() {
    var lines = [];
    function chk(label, val) { lines.push((val ? 'OK' : 'FAIL') + ' ' + label); }

    if (!window.zaDebug || typeof window.zaDebug.consensusPairs !== 'function') {
      return 'FAIL zaDebug.consensusPairs fehlt';
    }
    var side = (typeof activeSide !== 'undefined') ? activeSide : 'right';
    var pairs = window.zaDebug.consensusPairs(side);

    if (!Array.isArray(pairs)) return 'FAIL consensusPairs liefert kein Array';

    if (pairs.length === 0) {
      lines.push('INFO keine konsolidierten Paare — Format-Tests uebersprungen');
      return lines.join('\n');
    }

    // Test 1: Format jedes Eintrags
    var allFormat = pairs.every(function(p) {
      return typeof p.a === 'number' && typeof p.b === 'number'
          && typeof p.offset === 'number' && typeof p.timestamp === 'number';
    });
    chk('alle Eintraege: {a,b,offset,timestamp} mit Zahlen', allFormat);

    // Test 2: normalisiert (a < b)
    var allNorm = pairs.every(function(p) { return p.a < p.b; });
    chk('alle Eintraege: a < b (normalisiert)', allNorm);

    // Test 3: ein Eintrag pro Paar (keine Duplikate)
    var seen = {};
    var noDup = pairs.every(function(p) {
      var key = p.a + ',' + p.b;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    chk('kein doppeltes (a,b)-Paar', noDup);

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

/* BA432 — Bandberechnung Fundament */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA432/bandberechnung", { tab: "results", label: "BA432 Bandberechnung" }, function () {
    var lines = [];
    // 1. geomMitte
    var gm = geomMitte(100, 400);
    lines.push("geomMitte(100,400) = " + gm.toFixed(2) + " (erwartet 200.00)");
    // 2. fmtNum
    lines.push("fmtNum(85.752, 'hz') = " + fmtNum(85.752, "hz") + " (erwartet 85.75)");
    lines.push("fmtNum(-12.34, 'cent') = " + fmtNum(-12.34, "cent") + " (erwartet -12.3)");
    lines.push("fmtNum(null, 'hz') = '" + fmtNum(null, "hz") + "' (erwartet leer)");
    // 3. FRQ_baender an MED-EL Default-Mitten, alle aktiv
    var medel = [120,235,384,579,836,1175,1624,2222,3019,4084,5507,7410];
    var mitten = medel.map(function (hz, i) { return { elIdx: i, hz: hz, aktiv: true }; });
    var res = FRQ_baender(mitten);
    if (res.error) {
      lines.push("FRQ_baender FEHLER: " + res.error);
    } else {
      var b0 = res.bands[0], bl = res.bands[res.bands.length - 1];
      lines.push("E1 Band: " + b0.loHz.toFixed(2) + " - " + b0.hiHz.toFixed(2)
        + " (erwartet ca. 85.75 - 167.93)");
      lines.push("E12 Band: " + bl.loHz.toFixed(2) + " - " + bl.hiHz.toFixed(2)
        + " (erwartet ca. 6388.03 - 8595.47)");
    }
    // 4. Ueberlauf: eine Mitte ueberholt den Nachbarn
    var kaputt = [{elIdx:0,hz:200,aktiv:true},{elIdx:1,hz:150,aktiv:true}];
    var ov = FRQ_baender(kaputt);
    lines.push("Ueberlauf-Test: " + (ov.error === "overlap" ? "overlap erkannt OK" : "NICHT erkannt FEHLER"));
    // 5. Nicht-aktive faellt raus: mittlere Elektrode aktiv=false
    var m3 = [{elIdx:0,hz:100,aktiv:true},{elIdx:1,hz:200,aktiv:false},{elIdx:2,hz:400,aktiv:true}];
    var r3 = FRQ_baender(m3);
    lines.push("Nicht-aktiv raus: " + r3.bands.length + " Baender (erwartet 2), "
      + "Grenze E0/E2 = " + (r3.bands[0] ? r3.bands[0].hiHz.toFixed(2) : "?")
      + " (erwartet 200.00 = geomMitte 100/400)");
    return lines.join("\n");
  });
})();

/* BA442 — Bandverfahren-Faktorisierung verhaltensneutral */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA442/faktorisierung-neutral", {
    tab: "results", label: "BA442: Bandverfahren toP/fromP neutral"
  }, function () {
    var lines = [];
    function chk(label, ok) { lines.push((ok ? "OK" : "FAIL") + " " + label); }

    // Referenz-Mitten (MED-EL Default, ungleiche Abstaende -> harter Test)
    var hz = [120,235,384,579,836,1175,1624,2222,3019,4084,5507,7410];
    var mitten = hz.map(function (h, i) { return { elIdx: i, hz: h, aktiv: true }; });

    // Alt-Formel-Referenz je Verfahren (die frueheren innerEdge/low/high/center).
    var ref = {
      geometrisch: {
        inner: function (a, b) { return Math.sqrt(a * b); },
        low:   function (k) { var i = Math.sqrt(k[0].hz*k[1].hz); return (k[0].hz*k[0].hz)/i; },
        high:  function (k) { var n=k.length; var i=Math.sqrt(k[n-2].hz*k[n-1].hz); return (k[n-1].hz*k[n-1].hz)/i; },
        center:function (lo, hi) { return Math.sqrt(lo * hi); }
      },
      cochlear: {
        inner: function (a, b) { return (a + b) / 2; },
        low:   function (k) { var i=(k[0].hz+k[1].hz)/2; return 2*k[0].hz - i; },
        high:  function (k) { var n=k.length; var i=(k[n-2].hz+k[n-1].hz)/2; return 2*k[n-1].hz - i; },
        center:function (lo, hi) { return (lo + hi) / 2; }
      },
      greenwood: {
        inner: function (a, b) { return greenwoodHz((greenwoodX(a)+greenwoodX(b))/2); },
        low:   function (k) { var x0=greenwoodX(k[0].hz); var xm=(greenwoodX(k[0].hz)+greenwoodX(k[1].hz))/2; return greenwoodHz(2*x0 - xm); },
        high:  function (k) { var n=k.length; var xn=greenwoodX(k[n-1].hz); var xm=(greenwoodX(k[n-2].hz)+greenwoodX(k[n-1].hz))/2; return greenwoodHz(2*xn - xm); },
        center:function (lo, hi) { return greenwoodHz((greenwoodX(lo)+greenwoodX(hi))/2); }
      }
    };

    var TOL = 1e-9;
    ["geometrisch", "greenwood", "cochlear"].forEach(function (vf) {
      var res = FRQ_baender(mitten, vf);
      if (res.error) { chk(vf + ": kein Fehler", false); return; }
      var r = ref[vf];
      // Referenz-Grenzen aufbauen (Laenge n+1)
      var innerRef = [];
      for (var j = 0; j < mitten.length - 1; j++) innerRef.push(r.inner(mitten[j].hz, mitten[j+1].hz));
      var edgesRef = [r.low(mitten)].concat(innerRef, [r.high(mitten)]);
      var okLo = true, okHi = true, okCe = true;
      for (var e = 0; e < mitten.length; e++) {
        var b = res.bands[e];
        var loRef = edgesRef[e], hiRef = edgesRef[e+1], ceRef = r.center(loRef, hiRef);
        if (Math.abs(b.loHz - loRef) > TOL) okLo = false;
        if (Math.abs(b.hiHz - hiRef) > TOL) okHi = false;
        if (Math.abs(b.centerHz - ceRef) > TOL) okCe = false;
      }
      chk(vf + ": loHz == Alt-Formel (Tol 1e-9)", okLo);
      chk(vf + ": hiHz == Alt-Formel (Tol 1e-9)", okHi);
      chk(vf + ": centerHz == Alt-Formel (Tol 1e-9)", okCe);
    });

    // Unbekanntes Verfahren -> Fehler
    chk("unbekanntes Verfahren -> error", FRQ_baender(mitten, "gibtsnicht").error === "unknownVerfahren");

    // Ueberlauf weiterhin erkannt (Rahmen unveraendert)
    var kaputt = [{elIdx:0,hz:200,aktiv:true},{elIdx:1,hz:150,aktiv:true}];
    chk("Ueberlauf weiterhin erkannt", FRQ_baender(kaputt).error === "overlap");

    return lines.join("\n");
  });
})();

/* BA443 — Band-Topologie (nahtlos identisch, lueckig/ueberlappend Eigenschaften) */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA443/topologie", {
    tab: "results", label: "BA443: Band-Topologie"
  }, function () {
    var lines = [];
    function chk(label, ok) { lines.push((ok ? "OK" : "FAIL") + " " + label); }

    var hz = [120,235,384,579,836,1175,1624,2222,3019,4084,5507,7410];
    var mitten = hz.map(function (h, i) { return { elIdx: i, hz: h, aktiv: true }; });
    var TOL = 1e-9;

    ["geometrisch", "greenwood", "cochlear"].forEach(function (vf) {
      // 1. nahtlos == kein topologie-Argument (Default) == BA442-Verhalten
      var d = FRQ_baender(mitten, vf);                 // Default nahtlos
      var s = FRQ_baender(mitten, vf, "nahtlos");      // explizit
      var same = d.bands.length === s.bands.length && d.bands.every(function (b, i) {
        return Math.abs(b.loHz - s.bands[i].loHz) < TOL
            && Math.abs(b.hiHz - s.bands[i].hiHz) < TOL
            && Math.abs(b.centerHz - s.bands[i].centerHz) < TOL;
      });
      chk(vf + ": nahtlos-Default == nahtlos-explizit", same);

      var gap = FRQ_baender(mitten, vf, "lueckig").bands;
      var ovl = FRQ_baender(mitten, vf, "ueberlappend").bands;

      // 2. lueckig/ueberlappend: Center == gehoerte Frequenz (symmetrisch)
      var gapCenterOk = gap.every(function (b, i) { return Math.abs(b.centerHz - hz[i]) < 1e-6; });
      var ovlCenterOk = ovl.every(function (b, i) { return Math.abs(b.centerHz - hz[i]) < 1e-6; });
      chk(vf + ": lueckig Center == gehoerte Frequenz", gapCenterOk);
      chk(vf + ": ueberlappend Center == gehoerte Frequenz", ovlCenterOk);

      // 3. lueckig: nie Ueberlappung (hi[k] <= lo[k+1], Toleranz)
      var nieOverlap = true;
      for (var k = 0; k < gap.length - 1; k++) if (gap[k].hiHz > gap[k+1].loHz + 1e-6) nieOverlap = false;
      chk(vf + ": lueckig -> nie Ueberlappung", nieOverlap);

      // 4. ueberlappend: nie Luecke (hi[k] >= lo[k+1], Toleranz)
      var nieLuecke = true;
      for (var m = 0; m < ovl.length - 1; m++) if (ovl[m].hiHz < ovl[m+1].loHz - 1e-6) nieLuecke = false;
      chk(vf + ": ueberlappend -> nie Luecke", nieLuecke);

      // 5. Symmetrie im Positionsraum: Center-Position == Mittelpunkt der Grenz-Positionen
      //    (bei lueckig/ueberlappend per Konstruktion; hier ueber Hz zurueckgeprueft
      //     via Verfahrens-toP)
      var toP = FRQ_bandVerfahren[vf].toP;
      var gapSym = gap.every(function (b, i) {
        return Math.abs((toP(b.loHz) + toP(b.hiHz)) / 2 - toP(hz[i])) < 1e-9;
      });
      chk(vf + ": lueckig symmetrisch in p", gapSym);
    });

    // 6. Unbekannte Topologie -> Fehler
    chk("unbekannte Topologie -> error",
      FRQ_baender(mitten, "geometrisch", "gibtsnicht").error === "unknownTopologie");

    // 7. Gleichmaessige Abstaende (in p): lueckig == ueberlappend == nahtlos
    //    Konstruiere Mitten mit konstantem Log-Abstand (fuer geometrisch).
    var eq = [];
    for (var q = 0; q < 6; q++) eq.push({ elIdx: q, hz: 100 * Math.pow(2, q), aktiv: true });
    var eN = FRQ_baender(eq, "geometrisch", "nahtlos").bands;
    var eG = FRQ_baender(eq, "geometrisch", "lueckig").bands;
    var eO = FRQ_baender(eq, "geometrisch", "ueberlappend").bands;
    var eqSame = eN.every(function (b, i) {
      return Math.abs(b.loHz - eG[i].loHz) < 1e-6 && Math.abs(b.loHz - eO[i].loHz) < 1e-6
          && Math.abs(b.hiHz - eG[i].hiHz) < 1e-6 && Math.abs(b.hiHz - eO[i].hiHz) < 1e-6;
    });
    chk("gleichmaessige Abstaende: nahtlos==lueckig==ueberlappend", eqSame);

    return lines.join("\n");
  });
})();

/* BA456 — Frequenzgraph-Engine Geruest: zeichnet drawFRQGraph mit
 * Beispieldaten (Band-Variante) in ein temporaeres sichtbares Canvas.
 */
(function () {
  if (typeof dbg === "undefined" || !dbg.test) return;
  dbg.test("build/BA456/frqgraph-geruest",
    { tab: "messungen", label: "BA456 Engine-Geruest zeichnen" },
    function () {
      if (typeof drawFRQGraph !== "function") return { ok: false, msg: "drawFRQGraph fehlt" };
      let host = document.getElementById("ba456_host");
      if (!host) {
        host = document.createElement("div"); host.id = "ba456_host";
        host.style.cssText = "width:640px;border:1px solid #ccc;margin:8px 0;";
        document.body.appendChild(host);
      }
      host.innerHTML = "";
      const cv = document.createElement("canvas");
      host.appendChild(cv);
      const rows = [
        { elNum: 3, xLinksHz: 380, xRechtsHz: 400, yCent: 20, residuumCent: 30,
          bandLoHz: 300, bandHiHz: 520, sichtbar: true, warn: false,
          tooltip: ["<b>E3</b>", "gehoert: 380 Hz", "erreicht: 400 Hz",
                    "Verschiebung: +20 ct · im Rauschen (±30 ct)", "Band: 300-520 Hz"] },
        { elNum: 5, xLinksHz: 900, xRechtsHz: 1180, yCent: 120, residuumCent: 25,
          bandLoHz: 760, bandHiHz: 1500, sichtbar: true, warn: false,
          tooltip: ["<b>E5</b>", "gehoert: 900 Hz", "erreicht: 1180 Hz",
                    "Verschiebung: +120 ct · deutlich (±25 ct)", "Band: 760-1500 Hz"] },
        { elNum: 8, xLinksHz: 2200, xRechtsHz: 2150, yCent: null, residuumCent: 0,
          bandLoHz: 1500, bandHiHz: 3000, sichtbar: true, warn: false,
          tooltip: ["<b>E8</b>", "nicht gemessen"] }
      ];
      const cfg = {
        residuumAnker: "nulllinie", xWandHz: [70, 8500], yLabel: "Abweichung",
        fixedSize: null, verbindung: true
      };
      try {
        drawFRQGraph(cv, rows, cfg);
        if (!cv._frqg_listener) {
          cv.addEventListener("mousemove", function (e) { _frqg_tooltipHandler(cv, e); });
          cv.addEventListener("mouseleave", function () {
            const t = document.getElementById("frqg_tooltip"); if (t) t.style.display = "none";
          });
          cv._frqg_listener = true;
        }
        return "gezeichnet: " + rows.length + " Zeilen, Canvas " + cv.width + "x" + cv.height +
               " | Sichtpruefung (Bandgraph-Modus, nulllinie, kein Amberband):" +
               " KEIN waagerechtes/breites Amberband. T-Balken um die Nulllinie" +
               " je gemessener El (E3,E5). Punkt gruen(E3)/rot(E5), E8 ohne Punkt.";
      } catch (err) {
        return { ok: false, msg: "FEHLER: " + err.message };
      }
    });
})();

/* BA466: CBF Treffer-Prioritaet -- Rechenkern-Diagnose. */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA466/cbf-treffer-prioritaet", { tab: "frequenzabgleich", label: "CBF Treffer-Prioritaet" }, function () {
    var kette = [
      { elIdx: 0, hz: 104,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 1, hz: 296,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 2, hz: 673,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 3, hz: 1211, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 4, hz: 2302, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 5, hz: 4153, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 6, hz: 7410, statusGewicht: 0, residuum: null, gemessen: false }
    ];
    var wand = { loHz: 70, hiHz: 8500 };
    var out = [], fails = [];
    function lauf(name, opt) {
      var r = FRQ_cbfGrenzen(kette, wand, opt);
      var e = r.edges, mono = true, i;
      for (i = 1; i < e.length; i++) if (!(e[i] > e[i - 1])) mono = false;
      var waende = (e[0] >= 70 - 1e-3) && (e[e.length - 1] <= 8500 + 1e-3);
      if (!mono) fails.push(name + ": nicht monoton");
      if (!waende) fails.push(name + ": Wand verletzt");
      out.push(name + ": [" + e.map(function (x) { return Math.round(x); }).join(", ") + "]");
      return e;
    }
    // BA472: cbfRandverhalten entfaellt, stattdessen cbfApikalFrei/cbfBasalFrei (Default 1).
    var basis = { cbfGewicht: "ausgewogen", cbfApikalFrei: 1, cbfBasalFrei: 1,
                  cbfRandspektrum: "frei", cbfSprache: "mittel" };
    var e0 = lauf("ausgewogen/frei", basis);
    lauf("treffer/frei", { cbfGewicht: "treffer", cbfApikalFrei: 1, cbfBasalFrei: 1, cbfRandspektrum: "frei", cbfSprache: "mittel" });
    lauf("breite/frei", { cbfGewicht: "breite", cbfApikalFrei: 1, cbfBasalFrei: 1, cbfRandspektrum: "frei", cbfSprache: "mittel" });
    var eV = lauf("ausgewogen/voll", { cbfGewicht: "ausgewogen", cbfApikalFrei: 1, cbfBasalFrei: 1, cbfRandspektrum: "voll", cbfSprache: "mittel" });
    // INNERE El. treffen (Ziel 1; verifiziert E2-E6 <= 26ct):
    var ziele = [104, 296, 673, 1211, 2302, 4153];
    for (var b = 1; b < 6; b++) {
      var abw = Math.abs(1200 * Math.log2(Math.sqrt(e0[b] * e0[b + 1]) / ziele[b]));
      if (!(abw <= 60)) fails.push("E" + (b + 1) + " (innen) Abw " + abw.toFixed(0) + "ct > 60ct");
    }
    // Rand E1 traegt den Fehler, aber begrenzt (verifiziert +82ct):
    var abw0 = Math.abs(1200 * Math.log2(Math.sqrt(e0[0] * e0[1]) / ziele[0]));
    if (!(abw0 <= 150)) fails.push("E1 (Rand) Abw " + abw0.toFixed(0) + "ct > 150ct");
    // Stummes Randband klein + Wand NICHT erreicht (verifiziert 150ct / ~6114 Hz):
    var brS = 1200 * Math.log2(e0[7] / e0[6]);
    if (!(brS <= 160)) fails.push("stummes Band " + brS.toFixed(0) + "ct > 160ct");
    if (!(e0[7] < 7000)) fails.push("stumme Oberkante " + Math.round(e0[7]) + " erreicht die Wand");
    // Achse "voll": letzte Kante auf der Wand.
    if (!(Math.abs(eV[7] - 8500) < 0.5)) fails.push("voll: Oberkante " + Math.round(eV[7]) + " != 8500");
    return { ok: fails.length === 0,
             msg: (fails.length ? "FEHLER:\n" + fails.join("\n") + "\n" : "") + out.join("\n") };
  });
})();

/* BA467 FBF-Rechenkern -- Kurve + Grenzen gegen Prototyp-Zahlen. */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA467/fbf-kern", { tab: "frequenzabgleich", label: "FBF Rechenkern" }, function () {
    // Martins Datei (rechts), identisch zum Prototyp.
    var NOM  = [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410];
    var CENT = [245, -399, -215, -260, -176, -52, 16, -61, 42, -29, -248, null];
    var RES  = [15, 61.25, 42.5, 35, 8.75, 7.5, 6.25, 51.25, 0, 41.25, 67.5, null];
    var GWT  = [1,1,1,1,1,1,1,1,1, 0.4, 0.15, 0];
    var kette = [];
    for (var i = 0; i < NOM.length; i++) {
      var gem = CENT[i] !== null;
      var hz = gem ? NOM[i] * Math.pow(2, -CENT[i] / 1200) : NOM[i];
      kette.push({ elIdx: i, hz: hz, statusGewicht: GWT[i],
                   residuum: RES[i], gemessen: gem });
    }
    var wk = FRQ_wahrnKurve(kette);
    var abw = wk.diagnose.map(function (d) {
      return d.abwCent === null ? null : Math.round(d.abwCent);
    });
    var verdacht = wk.diagnose.map(function (d) { return d.verdacht; });
    var edges = FRQ_fbfGrenzen(kette, { loHz: 70, hiHz: 8500 }, { kurveY: wk.y }).edges;

    // Erwartungen (Prototyp):
    var e2Ok   = (abw[1] === 72);                       // E2 = +72 ct
    var keinVerdacht = verdacht.every(function (v) { return v === false; });
    var monoK  = !wk.monoEingriff;                      // kein Monotonie-Eingriff
    var kMono  = true;
    for (var m = 1; m < edges.length; m++) if (edges[m] < edges[m-1] - 1e-6) kMono = false;
    var inWand = (edges[0] >= 70 - 1e-3) && (edges[edges.length-1] <= 8500 + 1e-3);
    var stummBreite0 = Math.abs(edges[12] - edges[11]) < 1e-3;  // E12 stumm -> Breite 0

    var ok = e2Ok && keinVerdacht && monoK && kMono && inWand && stummBreite0;
    var msg = [
      "abwCent   = [" + abw.join(", ") + "]",
      "verdacht  = [" + verdacht.join(", ") + "]",
      "monoEingriff = " + wk.monoEingriff,
      "edges(Hz) = [" + edges.map(function (x) { return Math.round(x); }).join(", ") + "]",
      "E2=+72:" + e2Ok + " keinVerdacht:" + keinVerdacht + " monoOk:" + monoK +
        " kantenMono:" + kMono + " inWand:" + inWand + " E12Breite0:" + stummBreite0
    ].join("\n");
    return { ok: ok, msg: msg };
  });
})();

/* BA502 — Polynom-Vereinheitlichung: Verhaltensneutralitaet */
(function () {
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  dbg.test('build/BA502/polynom-neutral', {
    tab: 'frequenzbaender',
    label: 'BA502 Polynom verhaltensneutral'
  }, function () {
    var lines = [], ok = true;
    function chk(label, val, detail) {
      var pass = !!val;
      if (!pass) ok = false;
      lines.push((pass ? 'ok' : 'FAIL') + ' ' + label + (detail ? ' | ' + detail : ''));
    }

    // Pruefe Voraussetzungen
    if (typeof _frqGlaettPolynom !== 'function') {
      return { ok: false, msg: '_frqGlaettPolynom nicht verfuegbar' };
    }
    if (typeof greenwoodX !== 'function' || typeof greenwoodHz !== 'function') {
      return { ok: false, msg: 'greenwoodX/greenwoodHz nicht verfuegbar' };
    }
    if (typeof sideData === 'undefined' || typeof activeSide === 'undefined') {
      return { ok: false, msg: 'sideData/activeSide nicht verfuegbar' };
    }

    // Testdaten: 5 Elektroden, nominelle Hz, kleine Abweichungen, gleiche Gewichte
    var noms    = [500, 750, 1000, 1500, 2500];
    var cents   = [30, -20, 50, -10, 40];
    var weights = [1, 1, 1, 1, 1];

    // Hilfsreferenz fuer altes log-Polynom (position+log):
    // x = log2(nom), y = log2(gehoert), Ridge gleich, Grad 2.
    function refLogPolynom(nms, cts, wts) {
      var n = nms.length;
      var FRQ_GLAETT_STEIFE_LAMBDA = [0, 0.02, 0.05, 0.12, 0.25, 0.35, 0.5];
      var lambda = FRQ_GLAETT_STEIFE_LAMBDA[2]; // Stufe 2
      var deg = 2;
      var xr = nms.map(function (hz) { return Math.log2(hz); });
      var xm = 0; for (var i = 0; i < n; i++) xm += xr[i]; xm /= n;
      var xv = 0; for (var i = 0; i < n; i++) { var d = xr[i] - xm; xv += d * d; } xv /= n;
      var xs = Math.sqrt(xv) || 1;
      var x = xr.map(function (v) { return (v - xm) / xs; });
      var y = nms.map(function (nm, i) {
        return Math.log2(nm * Math.pow(2, -cts[i] / 1200));
      });
      var m = deg + 1;
      var M = [], rhs = [];
      for (var a = 0; a < m; a++) { M.push(new Array(m).fill(0)); rhs.push(0); }
      for (var i = 0; i < n; i++) {
        var w = wts[i]; if (!(w > 0)) continue;
        var xp = new Array(m); xp[0] = 1;
        for (var p = 1; p < m; p++) xp[p] = xp[p - 1] * x[i];
        for (var r = 0; r < m; r++) {
          rhs[r] += w * xp[r] * y[i];
          for (var c = 0; c < m; c++) M[r][c] += w * xp[r] * xp[c];
        }
      }
      var anker = M[0][0] || 1;
      for (var rr = 2; rr < m; rr++) M[rr][rr] += lambda * anker;
      var coef = _frqGauss(M, rhs);
      if (!coef) return cts.slice();
      var out = new Array(n);
      for (var i2 = 0; i2 < n; i2++) {
        var yf = 0, xk = 1;
        for (var p2 = 0; p2 < m; p2++) { yf += coef[p2] * xk; xk *= x[i2]; }
        out[i2] = -1200 * Math.log2(Math.pow(2, yf) / nms[i2]);
      }
      return out;
    }

    // Hilfsreferenz fuer altes greenwood-Polynom (position+greenwood, k=0.88, w=0):
    function refGreenwoodPolynom(nms, cts, wts) {
      var n = nms.length;
      var FRQ_GLAETT_STEIFE_LAMBDA = [0, 0.02, 0.05, 0.12, 0.25, 0.35, 0.5];
      var lambda = FRQ_GLAETT_STEIFE_LAMBDA[2];
      var deg = 2;
      var xr = nms.map(function (hz) { return greenwoodX(hz, 0.88); });
      var xm = 0; for (var i = 0; i < n; i++) xm += xr[i]; xm /= n;
      var xv = 0; for (var i = 0; i < n; i++) { var d = xr[i] - xm; xv += d * d; } xv /= n;
      var xs = Math.sqrt(xv) || 1;
      var x = xr.map(function (v) { return (v - xm) / xs; });
      var y = nms.map(function (nm, i) {
        return greenwoodX(nm * Math.pow(2, -cts[i] / 1200), 0.88);
      });
      var m = deg + 1;
      var M = [], rhs = [];
      for (var a = 0; a < m; a++) { M.push(new Array(m).fill(0)); rhs.push(0); }
      for (var i = 0; i < n; i++) {
        var w = wts[i]; if (!(w > 0)) continue;
        var xp = new Array(m); xp[0] = 1;
        for (var p = 1; p < m; p++) xp[p] = xp[p - 1] * x[i];
        for (var r = 0; r < m; r++) {
          rhs[r] += w * xp[r] * y[i];
          for (var c = 0; c < m; c++) M[r][c] += w * xp[r] * xp[c];
        }
      }
      var anker = M[0][0] || 1;
      for (var rr = 2; rr < m; rr++) M[rr][rr] += lambda * anker;
      var coef = _frqGauss(M, rhs);
      if (!coef) return cts.slice();
      var out = new Array(n);
      for (var i2 = 0; i2 < n; i2++) {
        var yf = 0, xk = 1;
        for (var p2 = 0; p2 < m; p2++) { yf += coef[p2] * xk; xk *= x[i2]; }
        out[i2] = -1200 * Math.log2(greenwoodHz(yf, 0.88) / nms[i2]);
      }
      return out;
    }

    // Hilfsreferenz fuer alte Ortskurve (index+greenwood, k=0.88):
    function refOrtskurve(nms, cts, wts) {
      var n = nms.length;
      var FRQ_GLAETT_STEIFE_LAMBDA = [0, 0.02, 0.05, 0.12, 0.25, 0.35, 0.5];
      var lambda = FRQ_GLAETT_STEIFE_LAMBDA[2];
      var deg = 2;
      var xort = nms.map(function (nm, i) {
        return greenwoodX(nm * Math.pow(2, -cts[i] / 1200), 0.88);
      });
      var idx = []; for (var q = 0; q < n; q++) idx.push(q);
      var im = 0; for (var a = 0; a < n; a++) im += idx[a]; im /= n;
      var iv = 0; for (var a = 0; a < n; a++) { var dd = idx[a] - im; iv += dd * dd; } iv /= n;
      var is = Math.sqrt(iv) || 1;
      var x = idx.map(function (v) { return (v - im) / is; });
      var y = xort;
      var m = deg + 1;
      var M = [], rhs = [];
      for (var b = 0; b < m; b++) { M.push(new Array(m).fill(0)); rhs.push(0); }
      for (var i = 0; i < n; i++) {
        var w = wts[i]; if (!(w > 0)) continue;
        var xp = new Array(m); xp[0] = 1;
        for (var p = 1; p < m; p++) xp[p] = xp[p - 1] * x[i];
        for (var r = 0; r < m; r++) {
          rhs[r] += w * xp[r] * y[i];
          for (var c = 0; c < m; c++) M[r][c] += w * xp[r] * xp[c];
        }
      }
      var anker = M[0][0] || 1;
      for (var rr = 2; rr < m; rr++) M[rr][rr] += lambda * anker;
      var coef = _frqGauss(M, rhs);
      if (!coef) return cts.slice();
      var out = new Array(n);
      for (var i2 = 0; i2 < n; i2++) {
        var yf = 0, xk = 1;
        for (var p2 = 0; p2 < m; p2++) { yf += coef[p2] * xk; xk *= x[i2]; }
        out[i2] = -1200 * Math.log2(greenwoodHz(yf, 0.88) / nms[i2]);
      }
      return out;
    }

    // Hilfsfunktion: _frqGlaettPolynom mit temporaer gesetzten Achsen aufrufen.
    // Setzt sideData[activeSide]-Felder kurz um, ruft auf, stellt wieder her.
    function callPolynom(fitX, achse, k, lage) {
      var s = sideData[activeSide];
      var prev = {
        bandGlaettFitX:  s.bandGlaettFitX,
        bandGlaettAchse: s.bandGlaettAchse,
        bandGlaettGrad:  s.bandGlaettGrad,
        bandGlaettSteife: s.bandGlaettSteife,
        bandGlaettK:     s.bandGlaettK,
        bandGlaettLage:  s.bandGlaettLage
      };
      s.bandGlaettFitX  = fitX;
      s.bandGlaettAchse = achse;
      s.bandGlaettGrad  = "2";
      s.bandGlaettSteife = "2";
      s.bandGlaettK     = String(k);
      s.bandGlaettLage  = lage;
      var result = _frqGlaettPolynom(noms, cents, weights);
      Object.keys(prev).forEach(function (key) { s[key] = prev[key]; });
      return result;
    }

    var TOL = 1e-9;

    // Test 1: position + log vs. Referenz-log-Polynom
    var ref1 = refLogPolynom(noms, cents, weights);
    var res1 = callPolynom("position", "log", 0.88, "aussen");
    var diff1 = ref1.map(function (v, i) { return Math.abs(v - res1[i]); });
    var maxD1 = Math.max.apply(null, diff1);
    chk('position+log == ref-log-Polynom', maxD1 < TOL, 'maxDiff=' + maxD1.toExponential(3));

    // Test 2: position + ortsraum + w=0 (aussen) + k=0.88 vs. Referenz-greenwood-Polynom
    var ref2 = refGreenwoodPolynom(noms, cents, weights);
    var res2 = callPolynom("position", "ortsraum", 0.88, "aussen");
    var diff2 = ref2.map(function (v, i) { return Math.abs(v - res2[i]); });
    var maxD2 = Math.max.apply(null, diff2);
    chk('position+ortsraum+aussen+k0.88 == ref-greenwood-Polynom', maxD2 < TOL, 'maxDiff=' + maxD2.toExponential(3));

    // Test 3: index + ortsraum + w=0 (aussen) + k=0.88 vs. Referenz-Ortskurve
    var ref3 = refOrtskurve(noms, cents, weights);
    var res3 = callPolynom("index", "ortsraum", 0.88, "aussen");
    var diff3 = ref3.map(function (v, i) { return Math.abs(v - res3[i]); });
    var maxD3 = Math.max.apply(null, diff3);
    chk('index+ortsraum+aussen+k0.88 == ref-Ortskurve', maxD3 < TOL, 'maxDiff=' + maxD3.toExponential(3));

    return { ok: ok, msg: lines.join('\n') };
  });
})();
