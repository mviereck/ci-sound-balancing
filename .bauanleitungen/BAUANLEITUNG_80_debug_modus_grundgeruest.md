# Bauanleitung 80 — Debug-Modus: Grundgerüst

## Ziel

Einen zuschaltbaren Debug-Modus einführen, der eine rechte Sidebar
einblendet (Reflow, nicht Overlay). Der Modus hat drei Aktivierungs-
Wege, persistiert in `localStorage` und ist in der unaktivierten
Form vollständig unsichtbar — d.h. das Tool kann auch im
veröffentlichten Stand mit eingebautem Debug-Code ausgeliefert
werden, ohne daß ein Endnutzer ihn versehentlich sieht.

Diese Anleitung legt **nur** das Grundgerüst:
- Aktivierung (Doppelklick aufs Logo + URL-Parameter `?debug=1`)
- Persistenz in `localStorage`
- Panel-DOM-Skelett mit Reflow-Verhalten
- API `window.dbg` mit `log`/`set`/`unset`/`test`/`isActive`/
  `activate`/`deactivate`/`toggle`
- „Alles kopieren"-Button → Markdown-Snapshot in die Zwischenablage
- Schließen-Button im Panel-Header

Was diese Anleitung **noch nicht** enthält:
- Persistente Felder mit konkreten Inhalten (Player-State,
  Implantat, etc.) — kommt in **BA 81**.
- Selbsttest-Framework mit Tab-Zuordnung, Checkboxes,
  Re-Run-Buttons — kommt in **BA 82**. `dbg.test(...)` ist
  als API-Platzhalter schon da, sammelt Einträge in einer Liste,
  rendert sie aber noch nicht.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.80-beta";
```

---

## 2. Neue Datei `js/debug.js` anlegen

Komplett neue Datei mit folgendem Inhalt:

```js
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
    else if (urlSays === false) _deactivate();
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
```

---

## 3. Loader-Liste in `index.html` erweitern

In `index.html`, im zweiten Inline-Loader (Z. 20-28), das
Scripts-Array **als allerersten Eintrag** um `js/debug.js`
ergänzen. So ist `window.dbg` schon verfügbar, bevor andere
Module geladen werden und damit auch von späteren Bauanleitungen
früh aufrufbar.

Vorher:

```js
var scripts = [
  'js/mobile.js', 'js/touch-ctrl.js', 'js/i18n.js',
  ...
];
```

Nachher:

```js
var scripts = [
  'js/debug.js',
  'js/mobile.js', 'js/touch-ctrl.js', 'js/i18n.js',
  ...
];
```

Nur diese eine Zeile vorne ergänzen, sonst nichts ändern.

---

## 4. CSS in `style.css` ergänzen

Ans **Ende** von `style.css` anhängen (eigener Block, klar
abgegrenzt mit Kommentar):

```css
/* ===========================================================
 * Debug-Panel (Bauanleitung 80)
 * Wenn body keine .dbg-active-Klasse trägt: nichts sichtbar.
 * =========================================================== */

body.dbg-active {
  padding-right: 360px;
}

.dbg-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 360px;
  background: #1e1e1e;
  color: #e0e0e0;
  font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.4;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #444;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.35);
}

.dbg-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #2d2d2d;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}

.dbg-title {
  flex: 1;
  font-weight: bold;
  letter-spacing: 0.5px;
}

.dbg-btn {
  background: #3a3a3a;
  color: #e0e0e0;
  border: 1px solid #555;
  padding: 2px 10px;
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border-radius: 2px;
}

.dbg-btn:hover { background: #4a4a4a; }

.dbg-btn-close {
  padding: 0 8px;
  font-size: 16px;
  line-height: 18px;
}

.dbg-btn-mini {
  background: #3a3a3a;
  color: #ccc;
  border: 1px solid #555;
  padding: 0 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  margin-left: 8px;
  border-radius: 2px;
  vertical-align: middle;
}

.dbg-btn-mini:hover { background: #4a4a4a; color: #fff; }

.dbg-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px 12px 8px;
}

.dbg-section { margin-bottom: 12px; }

.dbg-section h4 {
  margin: 8px 0 4px 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #9c9;
  font-weight: bold;
}

.dbg-fields-tbl {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.dbg-fields-tbl th,
.dbg-fields-tbl td {
  padding: 3px 6px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid #2d2d2d;
  word-break: break-word;
}

.dbg-fields-tbl th {
  color: #9cf;
  font-weight: normal;
  width: 45%;
}

.dbg-empty {
  color: #777;
  font-style: italic;
  padding: 4px;
}

.dbg-log-pre {
  margin: 0;
  background: #111;
  padding: 6px;
  max-height: 240px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 11px;
  color: #b9b;
  border: 1px solid #2d2d2d;
}

.dbg-toast {
  position: absolute;
  top: 36px;
  right: 8px;
  background: #2a4a2a;
  border: 1px solid #4c4;
  color: #cfc;
  padding: 4px 10px;
  font-size: 11px;
  border-radius: 3px;
  pointer-events: none;
  z-index: 10000;
}

@media print {
  .dbg-panel { display: none !important; }
  body.dbg-active { padding-right: 0 !important; }
}
```

Sonnet prüft, daß die Regel `body.dbg-active { padding-right: 360px; }`
keine bestehenden Regeln überlagert, die `padding-right` auf
`body` setzen. Falls doch (z.B. eine media-query für Mobile mit
`body { padding: ... }`): den Konflikt im Kommentar erwähnen, aber
nicht eigenmächtig umbauen — kurzer Hinweis ist genug, die Anleitung
geht von einem nicht-konfliktären Body aus.

---

## 5. CODESTRUKTUR.md aktualisieren

In `docs/CODESTRUKTUR.md`, in der Tabelle „Module im Ladeverlauf",
**vor** der Zeile für `mobile.js` (Position `0b`) eine neue Zeile
einfügen:

```
| 0a | debug.js | Debug-Panel (Bauanleitung 80). Globale API `window.dbg` mit `isActive`/`activate`/`deactivate`/`toggle`/`log`/`set`/`unset`/`test`. Aktivierung über Doppelklick auf `.brand-logo`, URL-Parameter `?debug=1` (oder `?debug=0` zum Deaktivieren) oder programmatisch. Status persistiert in `localStorage` unter `ciSb.debugActive`. Panel als rechte Sidebar (fixed, 360 px); im aktiven Zustand schiebt `body.dbg-active { padding-right: 360px }` den Hauptinhalt nach links. „Alles kopieren"-Button im Header schreibt Markdown-Snapshot (Versionsangaben, Felder-Tabelle, Log-Auszug) in die Zwischenablage. Eigener DOMContentLoaded-Handler. Muß vor `mobile.js` geladen werden, damit andere Module früh `dbg.log`/`dbg.set` rufen können. |
```

Falls die Tabelle in `CODESTRUKTUR.md` eine Reihenfolge-Konvention
nutzt, an die sich der `0a`-Index nicht sauber anschließt: Sonnet
darf einen passenderen Index (z.B. `0aa` oder schlicht `0a`) wählen,
solange die Zeile vor `mobile.js` einsortiert ist.

Sonnet ergänzt die Aktivierungs-Wege auch unter „Edit-Szenarien"
nicht. Es gibt keine bestehende Szenarie, in die das paßt; der
Eintrag in der Modul-Tabelle reicht.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer/Versionslabel zeigt
   `3.0.80-beta`.
2. **Default-Zustand prüfen**: Tool sieht unverändert aus, keine
   Sidebar, kein zusätzlicher Knopf. Im DOM-Inspektor:
   `body` hat **keine** Klasse `dbg-active`. Kein `<aside id="dbgPanel">`
   im DOM (das Element wird erst beim Aktivieren erzeugt).
3. **Aktivierung per Logo-Doppelklick**: Doppelklick aufs Briefkopf-
   Logo (Klasse `.brand-logo`). Erwartet:
   - Rechte Sidebar erscheint, 360 px breit, dunkel.
   - Header zeigt „Debug", „Kopieren", „×".
   - Drei Sektionen: „Felder" (zeigt „— leer —"), „Tests" (zeigt
     „— in BA 82 —"), „Log" mit „leeren"-Knopf und leerem
     Code-Block.
   - Hauptinhalt rückt nach links (Reflow, kein Overlay) —
     `body.dbg-active` ist gesetzt.
4. **Persistenz**: Browser reload. Panel kommt automatisch zurück
   (localStorage `ciSb.debugActive === "1"`).
5. **Deaktivierung per × im Header**: Klick aufs ×. Panel
   verschwindet, Hauptinhalt rückt zurück. Reload → Panel kommt
   nicht mehr.
6. **URL-Parameter `?debug=1`**: URL um `?debug=1` ergänzen
   (vorher localStorage geleert). Panel erscheint. Persistenz greift
   (`?debug=1` aus URL entfernen, reload → Panel bleibt).
7. **URL-Parameter `?debug=0`**: URL um `?debug=0` ergänzen.
   Panel verschwindet, Persistenz wird gelöscht. Reload ohne
   Parameter → kein Panel.
8. **`window.dbg` in der Browser-Konsole**:
   - `dbg.isActive()` → `true` oder `false`, je nach Stand.
   - `dbg.activate()` → öffnet das Panel.
   - `dbg.set("foo", 123)` → in der Felder-Tabelle taucht „foo |
     123" auf.
   - `dbg.set("obj", {a:1, b:2})` → zeigt `{"a":1,"b":2}`.
   - `dbg.unset("foo")` → Zeile verschwindet.
   - `dbg.log("hallo", "info")` → Log-Sektion zeigt
     `[HH:MM:SS] info: hallo`.
   - `dbg.log("warnung", "warn")` → analog mit `warn`.
   - „leeren"-Knopf an der Log-Sektion → Log-Block leer.
9. **„Alles kopieren"**: Klick auf „Kopieren" im Header.
   - Kurzer grüner Toast „Kopiert" erscheint im Panel und
     verschwindet nach ~1,5 Sek.
   - In ein leeres Textfeld einfügen → Markdown mit Kopfzeile
     (Zeitstempel, Version, URL, UA), Felder-Tabelle (oder
     `_(leer)_`), Log-Block.
10. **Mit Inhalt kopieren**: `dbg.set("a", 1)` und
    `dbg.log("test")` ausführen, dann nochmal „Kopieren".
    Der Markdown enthält die Felder-Tabelle mit `a | 1` und den
    Log-Eintrag.
11. **Druckansicht**: Drucken-Dialog öffnen (Strg-P) bei aktivem
    Debug-Panel. Erwartet: Panel **nicht** in der Druckvorschau,
    Hauptinhalt nimmt volle Breite ein (Print-Media-Query greift).
12. **Konsole frei von Fehlern** in allen Schritten.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der zwölf Akzeptanz-Punkte einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Speziell prüfen:

- Wird die Bootstrap-Logik **erst nach `DOMContentLoaded`**
  ausgeführt? (Sonst hängt der `.brand-logo`-Selektor in der Luft.)
- Bleibt das DOM in `_ensurePanel()` einmalig erzeugt und wird
  bei wiederholter Aktivierung nur sichtbar/unsichtbar geschaltet?
  (Verhindert Memory-Leaks und doppelte Event-Listener.)
- Funktioniert der `_fallbackCopy`-Pfad in Firefox ohne
  `navigator.clipboard.writeText`? (Wird wahrscheinlich nicht
  getroffen, aber der Code muß valide bleiben.)
- Wird `padding-right: 360px` per `body.dbg-active` zuverlässig
  angewendet? (Per DOM-Inspektor: `computed style` von `body`
  prüfen, wenn aktiv.)
- Bricht der Print-Media-Query bei aktiver Sidebar wirklich auf
  `padding-right: 0` zurück?
- Wenn das Tool unter `file://` läuft: funktionieren localStorage
  und `navigator.clipboard.writeText` dort? Falls clipboard nicht
  geht, greift der `_fallbackCopy`-Pfad und der Toast meldet
  „Kopiert" oder „Kopieren fehlgeschlagen". Bei fehlgeschlagenem
  Fallback: in den Akzeptanz-Bericht aufnehmen, **nicht** still
  abnicken.

Bei Zweifel zu einer Formulierung oder Position (z.B. Index in der
CODESTRUKTUR-Tabelle): kurze Rückfrage statt stiller Annahme.

---

## Was diese Anleitung NICHT macht

- Keine inhaltlichen Felder (Tab, Sentence, Player, Implantat,
  Sprache) — kommt in **BA 81**.
- Kein Selbsttest-Framework mit Checkboxes, Re-Run-Buttons,
  Tab-Zuordnung — kommt in **BA 82**. `dbg.test(...)` ist als
  API-Methode da, sammelt Einträge intern, rendert sie aber noch
  nicht.
- Keine Resize-/Drag-Funktion am Panelrand — bewußt nicht jetzt.
- Keine Tastenkombi (Ctrl+Shift+D) — wir bleiben bei den zwei
  Wegen Doppelklick + URL, wie zwischen Opus und Nutzer geklärt.
- Keine i18n. Panel-Texte (Debug, Felder, Tests, Log, Kopieren,
  leeren) sind bewußt hartcodiert deutsch. Begründung: das Panel
  ist Entwickler-/Diagnose-UI, keine End-User-UI; eine Übersetzung
  würde die anderen drei i18n-Dateien aufblähen, ohne daß ein
  Endnutzer das Panel je zu sehen bekommt.
