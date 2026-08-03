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

})();
