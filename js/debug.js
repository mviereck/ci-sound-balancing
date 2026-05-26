/* Debug-Panel (Bauanleitung 80)
 * Aktivierung: Doppelklick aufs Logo, ?debug=1 in der URL,
 * oder window.dbg.activate(). Deaktivierung analog.
 * Status persistiert in localStorage.
 * Panel-Texte bewußt nur deutsch — Entwickler-/Diagnose-UI,
 * keine i18n.
 */
(function () {
  'use strict';

  const DBG_KEY  = 'ciSb.debugActive';
  const LOG_MAX  = 200;

  const _fields = Object.create(null);   // key → value
  const _log    = [];                    // {ts, level, msg}
  const _tests  = [];                    // {name, opts, fn}  — BA 82

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
    try { return localStorage.getItem(DBG_KEY) === '1'; }
    catch (_) { return false; }
  }

  function _writePersistedActive(v) {
    try {
      if (v) localStorage.setItem(DBG_KEY, '1');
      else   localStorage.removeItem(DBG_KEY);
    } catch (_) {}
  }

  function _activate() {
    if (_active) return;
    _active = true;
    _writePersistedActive(true);
    document.body.classList.add('dbg-active');
    _ensurePanel();
    _renderAll();
  }

  function _deactivate() {
    if (!_active) return;
    _active = false;
    _writePersistedActive(false);
    document.body.classList.remove('dbg-active');
    if (_panel) _panel.style.display = 'none';
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
      +     '<h4>Felder</h4>'
      +     '<table class="dbg-fields-tbl"><tbody></tbody></table>'
      +   '</div>'
      +   '<div class="dbg-section" id="dbgTestsSec">'
      +     '<h4>Tests</h4>'
      +     '<div class="dbg-tests-list dbg-empty">— in BA 82 —</div>'
      +   '</div>'
      +   '<div class="dbg-section" id="dbgLogSec">'
      +     '<h4>Log <button class="dbg-btn-mini" id="dbgClearLog">leeren</button></h4>'
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
  }

  // ---------- Rendering ----------

  function _renderAll() {
    _renderFields();
    _renderLog();
  }

  function _renderFields() {
    if (!_panel) return;
    const tbody = _panel.querySelector('.dbg-fields-tbl tbody');
    if (!tbody) return;
    const keys = Object.keys(_fields).sort();
    if (!keys.length) {
      tbody.innerHTML = '<tr><td colspan="2" class="dbg-empty">— leer —</td></tr>';
      return;
    }
    tbody.innerHTML = keys.map(function (k) {
      return '<tr><th>' + _esc(k) + '</th><td>' + _esc(_fmtValue(_fields[k])) + '</td></tr>';
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

  // ---------- Copy ----------

  function _buildSnapshotMarkdown() {
    const ts = new Date().toISOString();
    const ver = (typeof APP_VERSION === 'string') ? APP_VERSION : '?';
    let md = '';
    md += '# Debug-Snapshot — ' + ts + '\n';
    md += 'Version: ' + ver + '\n';
    md += 'URL: ' + location.href + '\n';
    md += 'UA: ' + navigator.userAgent + '\n\n';

    md += '## Felder\n\n';
    const keys = Object.keys(_fields).sort();
    if (keys.length) {
      md += '| Schlüssel | Wert |\n|---|---|\n';
      md += keys.map(function (k) {
        return '| ' + k + ' | ' + _fmtValue(_fields[k]) + ' |';
      }).join('\n') + '\n';
    } else {
      md += '_(leer)_\n';
    }

    md += '\n## Log (letzte ' + Math.min(_log.length, LOG_MAX) + ')\n\n';
    md += '```\n';
    md += _log.slice(-LOG_MAX).map(function (e) {
      return '[' + e.ts + '] ' + e.level + ': ' + e.msg;
    }).join('\n');
    md += '\n```\n';

    return md;
  }

  function _copyAll() {
    const md = _buildSnapshotMarkdown();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(md).then(
        function () { _toast('Kopiert'); },
        function () { _fallbackCopy(md); }
      );
    } else {
      _fallbackCopy(md);
    }
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
      _fields[key] = value;
      if (_active) _renderFields();
    },

    unset: function (key) {
      delete _fields[key];
      if (_active) _renderFields();
    },

    // Platzhalter für BA 82 — nimmt Eintrag entgegen, rendert noch nicht.
    test: function (name, opts, fn) {
      if (typeof opts === 'function') { fn = opts; opts = {}; }
      _tests.push({ name: name, opts: opts || {}, fn: fn });
    }
  };

  // ---------- Aktivierungs-Bootstrap ----------

  document.addEventListener('DOMContentLoaded', function () {
    const urlSays = _readUrlParam();
    if (urlSays === true)       _activate();
    else if (urlSays === false) _writePersistedActive(false);  // löscht localStorage auch wenn Panel nicht aktiv war
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
