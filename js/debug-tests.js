/* Debug-Tests (Bauanleitung 82)
 * Wird nach allen anderen Modulen geladen, damit globale
 * Variablen und Funktionen verfügbar sind.
 * Alle Tests sind defensiv: kein Modul-Bruch, wenn etwas fehlt.
 */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;

  // -------- global/player --------
  dbg.test('global/player', { tab: 'global', label: 'Player-Audio' }, function () {
    if (typeof pCtx === 'undefined' || !pCtx) {
      return { ok: true, msg: 'AudioContext noch nicht erzeugt (kein Audio gestartet)' };
    }
    if (pCtx.state === 'suspended') {
      return { ok: false, msg: 'AudioContext suspended — User-Interaktion nötig' };
    }
    if (pCtx.state !== 'running') {
      return { ok: false, msg: 'AudioContext state=' + pCtx.state };
    }
    const sr = pCtx.sampleRate;
    if (sr < 16000 || sr > 192000) {
      return { ok: false, msg: 'Sample-Rate ungewöhnlich: ' + sr + ' Hz' };
    }
    const volEl = document.getElementById('plVol');
    const vol = volEl ? parseInt(volEl.value, 10) : null;
    let msg = 'AC running @ ' + sr + ' Hz';
    if (vol != null) msg += ', vol=' + vol + '%';
    if (vol === 0)   return { ok: false, msg: msg + ' — Lautstärke auf 0' };
    return { ok: true, msg: msg };
  });

  // -------- global/i18n --------
  dbg.test('global/i18n', { tab: 'global', label: 'i18n / Sprache' }, function () {
    if (typeof L !== 'object' || !L || !L.de) {
      return { ok: false, msg: 'L oder L.de nicht definiert' };
    }
    if (typeof lang !== 'string') {
      return { ok: false, msg: 'lang nicht definiert' };
    }
    const deKeys = Object.keys(L.de);
    if (!deKeys.length) return { ok: false, msg: 'L.de leer' };
    const cur = L[lang] || {};
    const missing = deKeys.filter(function (k) { return !(k in cur); });
    if (lang === 'de') return { ok: true, msg: 'lang=de, ' + deKeys.length + ' keys' };
    if (missing.length > 0) {
      return { ok: true, msg: 'lang=' + lang + ', ' + missing.length + ' keys fallen auf de zurück' };
    }
    return { ok: true, msg: 'lang=' + lang + ', voll übersetzt' };
  });

  // -------- global/sentence --------
  dbg.test('global/sentence', { tab: 'global', label: 'Sätze-Korpus' }, function () {
    if (typeof sCorpus === 'undefined') {
      return { ok: true, msg: 'sentences.js noch nicht initialisiert' };
    }
    if (!sCorpus || !sCorpus.speakers) {
      const off = (typeof sOfflineMode !== 'undefined' && sOfflineMode);
      return { ok: true, msg: 'Korpus noch nicht geladen' + (off ? ' (offline-Modus)' : '') };
    }
    const spkKeys = Object.keys(sCorpus.speakers);
    if (!spkKeys.length) return { ok: false, msg: 'Korpus geladen, aber keine Sprecher' };
    let recCount = 0;
    spkKeys.forEach(function (k) {
      const s = sCorpus.speakers[k];
      if (s && s.recordings) recCount += s.recordings.length;
    });
    return { ok: true, msg: spkKeys.length + ' Sprecher, ' + recCount + ' Aufnahmen' };
  });

  // -------- frequenzabgleich/adaptiv --------
  // Abweichung von BA-Snippet: fRes-Einträge haben .elIdx (nicht .el) und .varSide (nicht .side).
  // catchErrors/catchTotal statt catchFails/catchHits (so heißen die Track-Felder im Code).
  dbg.test(
    'frequenzabgleich/adaptiv',
    { tab: 'messungen', label: 'Adaptiv-Frequenzabgleich', liveLogFor: 'adaptiv.live' },
    function () {
      if (typeof sideData === 'undefined' || typeof activeSide === 'undefined') {
        return { ok: false, msg: 'sideData/activeSide nicht definiert' };
      }
      const sd = sideData[activeSide];
      if (!sd) return { ok: false, msg: 'Keine Daten für Seite ' + activeSide };
      const adapt = sd.freqmatchAdaptive;
      if (!adapt) return { ok: true, msg: 'Kein Adaptiv-Lauf für ' + activeSide };
      const _adaptRun = Array.isArray(adapt.runs) && adapt.currentRunIdx != null
        ? adapt.runs[adapt.currentRunIdx] : null;
      const tracks = (_adaptRun && _adaptRun.tracks) ? _adaptRun.tracks : {};
      const tkeys = Object.keys(tracks);
      if (!tkeys.length) return { ok: false, msg: 'Lauf vorhanden, aber keine Tracks' };
      let conv = 0, fair = 0, wide = 0, unst = 0, notp = 0, active = 0;
      tkeys.forEach(function (k) {
        const st = tracks[k] && tracks[k].status;
        if      (st === 'converged')        conv++;
        else if (st === 'converged-fair')   fair++;
        else if (st === 'converged-wide')   wide++;
        else if (st === 'unstable')         unst++;
        else if (st === 'not-perceivable')  notp++;
        else active++;
      });
      // Konsistenz: alle Tracks mit Match müssen einen fRes-Eintrag haben.
      let missingInFres = 0;
      if (typeof fRes !== 'undefined' && Array.isArray(fRes)) {
        const fresMap = Object.create(null);
        for (let i = 0; i < fRes.length; i++) {
          const e = fRes[i];
          if (e && e.varSide === activeSide) fresMap[e.elIdx] = true;
        }
        tkeys.forEach(function (k) {
          const tr = tracks[k];
          const st = tr && tr.status;
          const isMatched = (st === 'converged' || st === 'converged-fair'
                          || st === 'converged-wide' || st === 'unstable');
          if (isMatched && tr.match != null && !fresMap[tr.electrodeIdx]) {
            missingInFres++;
          }
        });
      }
      let msg = tkeys.length + ' Tracks: '
              + conv + ' conv, ' + fair + ' fair, ' + wide + ' wide, '
              + unst + ' unstable, ' + notp + ' notp, ' + active + ' aktiv';
      if (missingInFres > 0) {
        return { ok: false, msg: msg + ' — ' + missingInFres + ' konvergierte Tracks fehlen in fRes!' };
      }
      return { ok: true, msg: msg };
    }
  );
})();
