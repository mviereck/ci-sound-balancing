/* Debug-Panel (Bauanleitung 80/81)
 * Aktivierung: Doppelklick aufs Logo, ?debug=1 in der URL,
 * oder window.dbg.activate(). Deaktivierung analog.
 * Status persistiert in sessionStorage (pro Browser-Tab, BA 163).
 * Panel-Texte bewußt nur deutsch — Entwickler-/Diagnose-UI,
 * keine i18n.
 */
(function () {
  'use strict';

  const DBG_KEY  = 'ciSb.debugActive';
  const LOG_MAX  = 200;

  const _autoFields = Object.create(null);   // vom Polling befüllt
  const _userFields = Object.create(null);   // via dbg.set(...) befüllt
  const _log    = [];                        // {ts, level, msg}

  const _testReg     = new Map();            // name → { name, opts, fn, status, last }
  const _testSelect  = new Set();            // names der angehakten Tests
  const _flags       = Object.create(null);  // flag-name → bool
  const FLAG_KEY     = 'ciSb.debugFlags';

  try {
    // BA 163: pro Browser-Tab
    const raw = sessionStorage.getItem(FLAG_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        for (const k in obj) _flags[k] = !!obj[k];
      }
    }
  } catch (_) {}

  function _persistFlags() {
    // BA 163: pro Browser-Tab
    try { sessionStorage.setItem(FLAG_KEY, JSON.stringify(_flags)); } catch (_) {}
  }

  function _allFields() {
    const out = Object.create(null);
    for (const k in _autoFields) out[k] = _autoFields[k];
    for (const k in _userFields) out[k] = _userFields[k];   // user gewinnt bei Konflikt
    return out;
  }

  let _active = false;
  let _panel  = null;

  // ---------- Aktivierungs-Logik ----------

  function _readUrlParam() {
    // null = nicht gesetzt, true = aktivieren, false = deaktivieren
    const params = new URLSearchParams(location.search);
    if (!params.has('debug')) return null;
    const v = (params.get('debug') || '1').toLowerCase();
    if (v === '0' || v === 'false') return false;
    return true;
  }

  function _readPersistedActive() {
    // BA 163: pro Browser-Tab
    try { return sessionStorage.getItem(DBG_KEY) === '1'; }
    catch (_) { return false; }
  }

  function _writePersistedActive(v) {
    // BA 163: pro Browser-Tab
    try {
      if (v) sessionStorage.setItem(DBG_KEY, '1');
      else   sessionStorage.removeItem(DBG_KEY);
    } catch (_) {}
  }

  function _activate() {
    if (_active) return;
    _active = true;
    _writePersistedActive(true);
    document.body.classList.add('dbg-active');
    _ensurePanel();
    _renderAll();
    _startRefreshLoop();
    _applyDefaultSelection();
    _renderTests();
    if (typeof zaUpdateTabVisibility === "function") zaUpdateTabVisibility();
  }

  function _deactivate() {
    if (!_active) return;
    _stopRefreshLoop();
    _active = false;
    _writePersistedActive(false);
    document.body.classList.remove('dbg-active');
    if (_panel) _panel.style.display = 'none';
    if (typeof zaUpdateTabVisibility === "function") zaUpdateTabVisibility();
  }

  function _toggle() { _active ? _deactivate() : _activate(); }

  // ---------- Panel-DOM ----------

  function _ensurePanel() {
    if (_panel) {
      _panel.style.display = '';
      return;
    }
    _panel = document.createElement('aside');
    _panel.id = 'dbgPanel';
    _panel.className = 'dbg-panel';
    _panel.innerHTML = ''
      + '<header class="dbg-head">'
      +   '<span class="dbg-title">Debug</span>'
      +   '<button class="dbg-btn" id="dbgCopyAll" title="Alles kopieren">Kopieren</button>'
      +   '<button class="dbg-btn dbg-btn-close" id="dbgClose" title="Schließen">×</button>'
      + '</header>'
      + '<section class="dbg-body">'
      +   '<div class="dbg-section" id="dbgFieldsSec">'
      +     '<h4>Felder <button class="dbg-btn-mini dbg-copy-sec" data-sec="fields" title="Felder kopieren">kopieren</button></h4>'
      +     '<table class="dbg-fields-tbl"><tbody></tbody></table>'
      +   '</div>'
      +   '<div class="dbg-section" id="dbgTestsSec">'
      +     '<h4>Tests '
      +        '<button class="dbg-btn-mini" id="dbgRunAll" title="Alles testen">▶ alle</button> '
      +        '<button class="dbg-btn-mini dbg-copy-sec" data-sec="tests" title="Tests kopieren">kopieren</button>'
      +     '</h4>'
      +     '<div class="dbg-tests-list"></div>'
      +   '</div>'
      +   '<div class="dbg-section" id="dbgLogSec">'
      +     '<h4>Log '
      +        '<button class="dbg-btn-mini dbg-copy-sec" data-sec="log" title="Log kopieren">kopieren</button> '
      +        '<button class="dbg-btn-mini" id="dbgClearLog">leeren</button>'
      +     '</h4>'
      +     '<pre class="dbg-log-pre"></pre>'
      +   '</div>'
      + '</section>';
    document.body.appendChild(_panel);

    _panel.querySelector('#dbgClose').addEventListener('click', _deactivate);
    _panel.querySelector('#dbgCopyAll').addEventListener('click', _copyAll);
    _panel.querySelector('#dbgClearLog').addEventListener('click', function () {
      _log.length = 0;
      _renderLog();
    });
    _panel.querySelectorAll('.dbg-copy-sec').forEach(function (btn) {
      btn.addEventListener('click', function (ev) {
        const sec = ev.currentTarget.dataset.sec;
        _copyText(_buildSectionMarkdown(sec));
      });
    });
    const runAllBtn = _panel.querySelector('#dbgRunAll');
    if (runAllBtn) runAllBtn.addEventListener('click', _runAllTests);
  }

  // ---------- Test-Run-Logik ----------

  async function _runTest(t) {
    t.status = 'running';
    t.last = null;
    _renderTests();
    try {
      const out = await Promise.resolve(t.fn());
      if (out === true) {
        t.last = { ok: true, msg: '' };
      } else if (out === false) {
        t.last = { ok: false, msg: '' };
      } else if (out && typeof out === 'object') {
        t.last = { ok: !!out.ok, msg: String(out.msg || '') };
      } else {
        t.last = { ok: true, msg: out == null ? '' : String(out) };
      }
      t.status = t.last.ok ? 'pass' : 'fail';
    } catch (err) {
      t.status = 'fail';
      t.last = { ok: false, msg: 'Error: ' + (err && err.message ? err.message : String(err)) };
    }
    _renderTests();
  }

  async function _runAllTests() {
    const list = Array.from(_testReg.values());
    for (const t of list) await _runTest(t);
  }

  async function _runSelectedTests() {
    const list = Array.from(_testReg.values()).filter(function (t) { return _testSelect.has(t.name); });
    for (const t of list) await _runTest(t);
  }

  // ---------- Test-Rendering ----------

  function _testCurrentTab() {
    const f = _allFields();
    return f['tab'] || '';
  }

  function _testStatusIcon(t) {
    if (t.status === 'running') return '⏳';
    if (t.status === 'pass')    return '✓';
    if (t.status === 'fail')    return '✗';
    return '○';
  }

  function _testStatusClass(t) {
    if (t.status === 'pass')    return 'dbg-test-pass';
    if (t.status === 'fail')    return 'dbg-test-fail';
    if (t.status === 'running') return 'dbg-test-running';
    return 'dbg-test-pending';
  }

  function _renderTests() {
    if (!_panel) return;
    const sec = _panel.querySelector('#dbgTestsSec .dbg-tests-list');
    if (!sec) return;
    const tests = Array.from(_testReg.values()).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    if (!tests.length) {
      sec.innerHTML = '<div class="dbg-empty">— keine Tests registriert —</div>';
      return;
    }
    sec.innerHTML = tests.map(function (t) {
      const selected = _testSelect.has(t.name);
      const icon     = _testStatusIcon(t);
      const cls      = _testStatusClass(t);
      const label    = t.opts.label || t.name;
      const tabLabel = t.opts.tab
        ? '<span class="dbg-test-tab">' + _esc(t.opts.tab) + '</span>' : '';
      const lastMsg  = (t.last && t.last.msg)
        ? '<div class="dbg-test-msg">' + _esc(t.last.msg) + '</div>' : '';
      let liveBtn = '';
      if (t.opts.liveLogFor) {
        const on = !!_flags[t.opts.liveLogFor];
        liveBtn = '<button class="dbg-btn-mini dbg-test-flag' + (on ? ' dbg-flag-on' : '')
                + '" data-flag="' + _esc(t.opts.liveLogFor) + '" title="Live-Log: '
                + (on ? 'an' : 'aus') + '">⌚</button>';
      }
      return ''
        + '<div class="dbg-test-row ' + cls + '" data-name="' + _esc(t.name) + '">'
        +   '<label class="dbg-test-head">'
        +     '<input type="checkbox" class="dbg-test-cb"' + (selected ? ' checked' : '') + '>'
        +     '<span class="dbg-test-icon">' + icon + '</span>'
        +     tabLabel
        +     '<span class="dbg-test-label">' + _esc(label) + '</span>'
        +   '</label>'
        +   liveBtn
        +   '<button class="dbg-btn-mini dbg-test-run" title="Test erneut ausführen">↻</button>'
        +   lastMsg
        + '</div>';
    }).join('');

    sec.querySelectorAll('.dbg-test-row').forEach(function (row) {
      const name = row.dataset.name;
      const cb = row.querySelector('.dbg-test-cb');
      cb.addEventListener('change', function () {
        if (cb.checked) _testSelect.add(name);
        else _testSelect.delete(name);
      });
      const runBtn = row.querySelector('.dbg-test-run');
      runBtn.addEventListener('click', function () {
        const t = _testReg.get(name);
        if (t) _runTest(t);
      });
      const flagBtn = row.querySelector('.dbg-test-flag');
      if (flagBtn) {
        flagBtn.addEventListener('click', function () {
          const flag = flagBtn.dataset.flag;
          _flags[flag] = !_flags[flag];
          _persistFlags();
          _renderTests();
        });
      }
    });
  }

  function _applyDefaultSelection() {
    const curTab = _testCurrentTab();
    for (const t of _testReg.values()) {
      if (_testSelect.has(t.name)) continue;
      const tab = t.opts.tab || 'global';
      if (tab === 'global' || tab === curTab) _testSelect.add(t.name);
    }
  }

  // ---------- Rendering ----------

  function _renderAll() {
    _renderFields();
    _renderTests();
    _renderLog();
  }

  function _renderFields() {
    if (!_panel) return;
    const tbody = _panel.querySelector('.dbg-fields-tbl tbody');
    if (!tbody) return;
    const f = _allFields();
    const keys = Object.keys(f).sort();
    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="dbg-empty">— leer —</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map(function (k) {
      return '<tr><th>' + _esc(k) + '</th><td>' + _esc(_fmtValue(f[k])) + '</td></tr>';
    }).join('');
  }

  function _renderLog() {
    if (!_panel) return;
    const pre = _panel.querySelector('.dbg-log-pre');
    if (!pre) return;
    const lines = _log.slice(-LOG_MAX).map(function (e) {
      return '[' + e.ts + '] ' + e.level + ': ' + e.msg;
    });
    pre.textContent = lines.join('\n');
    pre.scrollTop = pre.scrollHeight;
  }

  // ---------- Helfer ----------

  function _now() {
    const d = new Date();
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function _fmtValue(v) {
    if (v == null) return String(v);
    if (typeof v === 'object') {
      try { return JSON.stringify(v); } catch (_) { return String(v); }
    }
    return String(v);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ---------- Auto-Felder (Polling) ----------

  let _refreshTimer = null;
  const REFRESH_MS = 500;

  function _safe(fn) {
    try { return fn(); } catch (_) { return undefined; }
  }

  function _truncate(s, max) {
    s = String(s);
    return s.length > max ? s.slice(0, max) + '…' : s;
  }

  function _collectFields() {
    for (const k in _autoFields) delete _autoFields[k];

    if (typeof APP_VERSION === 'string') _autoFields['app.version'] = APP_VERSION;

    if (typeof lang === 'string') _autoFields['lang'] = lang;

    const tabEl = document.querySelector('.tab.active');
    if (tabEl && tabEl.dataset.tab) _autoFields['tab'] = tabEl.dataset.tab;
    const subEl = document.querySelector('.subtab.active');
    if (subEl && subEl.dataset.subtab) _autoFields['tab.sub'] = subEl.dataset.subtab;

    if (typeof activeSide === 'string') _autoFields['side'] = activeSide;

    if (typeof mfr === 'string') _autoFields['implant.mfr'] = mfr;
    const sd = _safe(function () { return sideData && sideData[activeSide]; });
    if (sd) {
      if (typeof sd.nEl === 'number') _autoFields['implant.electrodes'] = sd.nEl;
      if (sd.implant) {
        if (sd.implant.model)     _autoFields['implant.model']     = sd.implant.model;
        if (sd.implant.processor) _autoFields['implant.processor'] = sd.implant.processor;
      }
    }

    if (typeof pPlaying === 'boolean')       _autoFields['player.state'] = pPlaying ? 'playing' : 'stopped';
    if (typeof pPlaybackMode === 'string')   _autoFields['player.mode']  = pPlaybackMode;
    if (typeof pOff === 'number')            _autoFields['player.pos']   = pOff.toFixed(2) + ' s';
    const volEl = document.getElementById('plVol');
    if (volEl)                               _autoFields['player.vol']   = volEl.value + ' %';
    if (typeof plEqOn === 'boolean')         _autoFields['player.eqOn']       = plEqOn;
    if (typeof plApplyBalance === 'boolean') _autoFields['player.balanceOn']  = plApplyBalance;

    const pc = _safe(function () { return pCtx; });
    if (pc) {
      _autoFields['audio.sampleRate'] = pc.sampleRate + ' Hz';
      _autoFields['audio.state']      = pc.state;
    }

    if (typeof pMaplawOn === 'boolean') _autoFields['maplaw.on'] = pMaplawOn;
    if (typeof pMaplawOn !== 'undefined' && pMaplawOn) {
      const ist = _safe(function () { return (typeof pMaplawGetIstC === 'function') ? pMaplawGetIstC() : null; });
      if (ist != null) _autoFields['maplaw.istC'] = ist;
      if (typeof pMaplawSollC === 'number') _autoFields['maplaw.sollC'] = pMaplawSollC;
    }

    if (typeof pWarpOn === 'boolean') {
      _autoFields['warp.on'] = pWarpOn;
      if (pWarpOn) {
        if (typeof pWarpMode === 'string')     _autoFields['warp.mode']     = pWarpMode;
        if (typeof pWarpStrength === 'number') _autoFields['warp.strength'] = pWarpStrength;
      }
    }

    if (typeof sActive === 'boolean')      _autoFields['sentence.active']  = sActive;
    if (typeof sEndless === 'boolean')     _autoFields['sentence.endless'] = sEndless;
    if (typeof sOfflineMode === 'boolean') _autoFields['sentence.corpus']  = sOfflineMode ? 'embed (offline)' : 'fetch (online)';
    const curRec = _safe(function () { return sCurRec; });
    if (curRec && curRec.rec) {
      if (curRec.speakerKey) _autoFields['sentence.speaker'] = curRec.speakerKey;
      if (curRec.rec.text)   _autoFields['sentence.text']    = _truncate(curRec.rec.text, 80);
    }
  }

  function _startRefreshLoop() {
    if (_refreshTimer) return;
    _collectFields();
    _renderFields();
    _refreshTimer = setInterval(function () {
      if (!_active) return;
      _collectFields();
      _renderFields();
    }, REFRESH_MS);
  }

  function _stopRefreshLoop() {
    if (_refreshTimer) {
      clearInterval(_refreshTimer);
      _refreshTimer = null;
    }
  }

  // ---------- Copy ----------

  function _mdHeader() {
    const ts = new Date().toISOString();
    const ver = (typeof APP_VERSION === 'string') ? APP_VERSION : '?';
    return '# Debug-Snapshot — ' + ts + '\n'
         + 'Version: ' + ver + '\n'
         + 'URL: ' + location.href + '\n'
         + 'UA: ' + navigator.userAgent + '\n\n';
  }

  function _mdFieldsBlock() {
    const f = _allFields();
    const keys = Object.keys(f).sort();
    let md = '## Felder\n\n';
    if (!keys.length) { md += '_(leer)_\n'; return md; }
    md += '| Schlüssel | Wert |\n|---|---|\n';
    md += keys.map(function (k) {
      return '| ' + k + ' | ' + _fmtValue(f[k]) + ' |';
    }).join('\n') + '\n';
    return md;
  }

  function _mdTestsBlock() {
    const list = Array.from(_testReg.values()).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
    let md = '## Tests\n\n';
    if (!list.length) { md += '_(keine registriert)_\n'; return md; }
    md += list.map(function (t) {
      const sym = t.status === 'pass' ? '✓' : t.status === 'fail' ? '✗' : '○';
      const msg = (t.last && t.last.msg) ? ' — ' + t.last.msg : '';
      return '- ' + sym + ' `' + t.name + '`' + msg;
    }).join('\n') + '\n';
    return md;
  }

  function _mdLogBlock() {
    const slice = _log.slice(-LOG_MAX);
    let md = '## Log (letzte ' + slice.length + ')\n\n```\n';
    md += slice.map(function (e) {
      return '[' + e.ts + '] ' + e.level + ': ' + e.msg;
    }).join('\n');
    md += '\n```\n';
    return md;
  }

  function _buildSnapshotMarkdown() {
    return _mdHeader() + _mdFieldsBlock() + '\n' + _mdTestsBlock() + '\n' + _mdLogBlock();
  }

  function _buildSectionMarkdown(sec) {
    if (sec === 'fields') return _mdHeader() + _mdFieldsBlock();
    if (sec === 'tests')  return _mdHeader() + _mdTestsBlock();
    if (sec === 'log')    return _mdHeader() + _mdLogBlock();
    return _buildSnapshotMarkdown();
  }

  function _copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { _toast('Kopiert'); },
        function () { _fallbackCopy(text); }
      );
    } else {
      _fallbackCopy(text);
    }
  }

  function _copyAll() {
    _copyText(_buildSnapshotMarkdown());
  }

  function _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta);
    _toast(ok ? 'Kopiert' : 'Kopieren fehlgeschlagen');
  }

  function _toast(msg) {
    if (!_panel) return;
    const old = _panel.querySelector('.dbg-toast');
    if (old) old.remove();
    const t = document.createElement('div');
    t.className = 'dbg-toast';
    t.textContent = msg;
    _panel.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 1500);
  }

  // ---------- Öffentliche API ----------

  window.dbg = {
    isActive:   function () { return _active; },
    activate:   _activate,
    deactivate: _deactivate,
    toggle:     _toggle,

    log: function (msg, level) {
      level = level || 'info';
      _log.push({ ts: _now(), level: level, msg: String(msg) });
      if (_log.length > LOG_MAX * 2) _log.splice(0, _log.length - LOG_MAX);
      if (_active) _renderLog();
    },

    set: function (key, value) {
      _userFields[key] = value;
      if (_active) _renderFields();
    },

    unset: function (key) {
      delete _userFields[key];
      if (_active) _renderFields();
    },

    test: function (name, opts, fn) {
      if (typeof opts === 'function') { fn = opts; opts = {}; }
      opts = opts || {};
      _testReg.set(name, { name: name, opts: opts, fn: fn, status: 'pending', last: null });
      if (_active) {
        _applyDefaultSelection();
        _renderTests();
      }
    },

    runTest: function (name) {
      const t = _testReg.get(name);
      if (t) return _runTest(t);
    },

    runAllTests: _runAllTests,

    flag: function (name) {
      return !!_flags[name];
    },

    setFlag: function (name, v) {
      _flags[name] = !!v;
      _persistFlags();
      if (_active) _renderTests();
    }
  };

  // ---------- Aktivierungs-Bootstrap ----------

  document.addEventListener('DOMContentLoaded', function () {
    const urlSays = _readUrlParam();
    if (urlSays === true)       _activate();
    else if (urlSays === false) _writePersistedActive(false);
    else if (_readPersistedActive()) _activate();

    const logo = document.querySelector('.brand-logo');
    if (logo) {
      logo.addEventListener('dblclick', function (ev) {
        ev.preventDefault();
        _toggle();
      });
    }
  });
})();
