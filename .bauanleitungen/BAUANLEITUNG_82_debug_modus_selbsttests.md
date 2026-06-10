# Bauanleitung 82 — Debug-Modus: Selbsttests + Adaptiv-Live-Log

## Ziel

Auf BA 80 (Grundgerüst) und BA 81 (Felder) aufbauen und das
Debug-Panel um das **Selbsttest-Framework** ergänzen, plus
**Live-Log-Hooks** im adaptiven Frequenzabgleich (`freqmatch.js`).

Ergebnis nach dieser Bauanleitung:

- `dbg.test(name, opts, fn)` registriert benannte Tests mit
  Tab-Zuordnung und optionalem Live-Log-Flag.
- Panel-Sektion „Tests" zeigt pro Test: Checkbox · Status-Icon ·
  Label · letzte Meldung · ↻-Knopf · (optional) Live-Log-Toggle.
- Default-Auswahl: angehakt sind Tests mit `opts.tab === currentTab`
  oder `opts.tab === "global"`. User kann jederzeit umhaken.
- Button „Alles testen" läuft über **alle** registrierten Tests
  (ignoriert Häkchen). Einzelner ↻ läuft nur den jeweiligen Test.
- `dbg.flag(name)` / `dbg.setFlag(name, v)` als generische
  Flag-API, in `localStorage` persistiert.
- Neue Datei `js/debug-tests.js` registriert die vier konkreten
  Tests: `global/player`, `global/i18n`, `global/sentence`,
  `frequenzabgleich/adaptiv`.
- In `js/freqmatch.js` werden Live-Log-Hooks an acht Stellen
  eingebaut, gewrapped über eine kleine Lokalfunktion `_fmDbg(msg)`,
  die das Flag `adaptiv.live` abfragt.

**Voraussetzungen:** Bauanleitungen 80 und 81 sind umgesetzt und
abgenommen.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.82-beta";
```

---

## 2. Test-Registry und Flag-API in `js/debug.js`

Die bestehende Stub-Implementierung aus BA 80

```js
const _tests = [];                    // {name, opts, fn}  — BA 82

// ...

test: function (name, opts, fn) {
  if (typeof opts === 'function') { fn = opts; opts = {}; }
  _tests.push({ name: name, opts: opts || {}, fn: fn });
}
```

wird komplett durch eine **Map-basierte** Registry mit Status,
letztem Ergebnis und Auswahl-Status ersetzt.

### 2.1 Neue Datenstrukturen (oben im IIFE, neben `_autoFields`)

```js
const _testReg     = new Map();           // name → { name, opts, fn, status, last }
const _testSelect  = new Set();           // names der angehakten Tests
const _flags       = Object.create(null); // flag-name → bool
const FLAG_KEY     = 'ciSb.debugFlags';

// Flags aus localStorage laden (best-effort)
try {
  const raw = localStorage.getItem(FLAG_KEY);
  if (raw) {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      for (const k in obj) _flags[k] = !!obj[k];
    }
  }
} catch (_) {}

function _persistFlags() {
  try { localStorage.setItem(FLAG_KEY, JSON.stringify(_flags)); } catch (_) {}
}
```

### 2.2 Test-Run-Logik (vor der öffentlichen API einfügen)

```js
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
  const list = Array.from(_testReg.values()).filter(t => _testSelect.has(t.name));
  for (const t of list) await _runTest(t);
}
```

### 2.3 Render der Tests-Sektion (neue Funktion, neben `_renderFields`)

```js
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
  if (t.status === 'pass') return 'dbg-test-pass';
  if (t.status === 'fail') return 'dbg-test-fail';
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
    const selected  = _testSelect.has(t.name);
    const icon      = _testStatusIcon(t);
    const cls       = _testStatusClass(t);
    const label     = t.opts.label || t.name;
    const tabLabel  = t.opts.tab ? '<span class="dbg-test-tab">' + _esc(t.opts.tab) + '</span>' : '';
    const lastMsg   = (t.last && t.last.msg) ? '<div class="dbg-test-msg">' + _esc(t.last.msg) + '</div>' : '';
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

  // Event-Listener verdrahten
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
```

### 2.4 Default-Auswahl-Logik

Eine kleine Helferfunktion, die bei Aktivierung oder
Test-Registrierung die Default-Häkchen setzt — **ohne** bestehende
User-Auswahl zu überschreiben:

```js
function _applyDefaultSelection() {
  const curTab = _testCurrentTab();
  for (const t of _testReg.values()) {
    if (_testSelect.has(t.name)) continue;
    const tab = t.opts.tab || 'global';
    if (tab === 'global' || tab === curTab) _testSelect.add(t.name);
  }
}
```

In `_activate()` ergänzen, **nach** `_startRefreshLoop()`:

```js
_applyDefaultSelection();
_renderTests();
```

### 2.5 Panel-Skelett: Sektion „Tests" umbauen

In `_ensurePanel()` die bisherige Tests-Sektion

```js
+   '<div class="dbg-section" id="dbgTestsSec">'
+     '<h4>Tests <button class="dbg-btn-mini dbg-copy-sec" data-sec="tests" title="Tests kopieren">kopieren</button></h4>'
+     '<div class="dbg-tests-list dbg-empty">— in BA 82 —</div>'
+   '</div>'
```

**ersetzen** durch:

```js
+   '<div class="dbg-section" id="dbgTestsSec">'
+     '<h4>Tests '
+        '<button class="dbg-btn-mini" id="dbgRunAll" title="Alles testen">▶ alle</button> '
+        '<button class="dbg-btn-mini dbg-copy-sec" data-sec="tests" title="Tests kopieren">kopieren</button>'
+     '</h4>'
+     '<div class="dbg-tests-list"></div>'
+   '</div>'
```

Und im Event-Listener-Block von `_ensurePanel()` (nach den
`dbg-copy-sec`-Handlern) ergänzen:

```js
const runAllBtn = _panel.querySelector('#dbgRunAll');
if (runAllBtn) runAllBtn.addEventListener('click', _runAllTests);
```

### 2.6 Public API erweitern

In `window.dbg = { ... }` die Methode `test(...)` ersetzen und
drei neue Methoden ergänzen:

```js
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
```

### 2.7 Markdown-Tests-Block füllen

`_mdTestsBlock()` aus BA 81 ersetzen durch:

```js
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
```

---

## 3. CSS in `style.css` ergänzen

Ans Ende des Debug-Panel-Blocks (aus BA 80) anhängen:

```css
/* Test-Sektion */
.dbg-tests-list { display: flex; flex-direction: column; gap: 4px; }

.dbg-test-row {
  border-left: 3px solid #555;
  padding: 4px 6px;
  background: #181818;
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 4px;
  align-items: center;
}

.dbg-test-pass    { border-left-color: #4c4; }
.dbg-test-fail    { border-left-color: #c44; }
.dbg-test-running { border-left-color: #ca4; }
.dbg-test-pending { border-left-color: #555; }

.dbg-test-head {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  min-width: 0;
}

.dbg-test-cb { margin: 0; }

.dbg-test-icon {
  display: inline-block;
  width: 14px;
  text-align: center;
}

.dbg-test-tab {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  border: 1px solid #444;
  padding: 0 4px;
  border-radius: 2px;
}

.dbg-test-label {
  color: #ddd;
  word-break: break-word;
}

.dbg-test-msg {
  grid-column: 1 / -1;
  color: #999;
  font-size: 11px;
  margin-left: 22px;
  word-break: break-word;
}

.dbg-test-flag.dbg-flag-on {
  background: #4a3a1a;
  border-color: #ca4;
  color: #fc8;
}
```

---

## 4. Neue Datei `js/debug-tests.js`

Komplett neue Datei. Registriert alle vier Tests beim Modulladen:

```js
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
      const tracks = adapt.tracks || {};
      const tkeys = Object.keys(tracks);
      if (!tkeys.length) return { ok: false, msg: 'Lauf vorhanden, aber keine Tracks' };
      let conv = 0, noisy = 0, notp = 0, active = 0;
      tkeys.forEach(function (k) {
        const st = tracks[k] && tracks[k].status;
        if (st === 'converged')      conv++;
        else if (st === 'converged-noisy') noisy++;
        else if (st === 'not-perceivable') notp++;
        else active++;
      });
      // Konsistenz: konvergierte/noisy-Tracks müssen einen fRes-Eintrag haben.
      let missingInFres = 0;
      if (typeof fRes !== 'undefined' && Array.isArray(fRes)) {
        const fresMap = Object.create(null);
        for (let i = 0; i < fRes.length; i++) {
          const e = fRes[i];
          if (e && e.side === activeSide) fresMap[e.el] = true;
        }
        tkeys.forEach(function (k) {
          const tr = tracks[k];
          const st = tr && tr.status;
          if ((st === 'converged' || st === 'converged-noisy') && !fresMap[tr.electrodeIdx]) {
            missingInFres++;
          }
        });
      }
      let msg = tkeys.length + ' Tracks: '
              + conv + ' conv, ' + noisy + ' noisy, '
              + notp + ' notp, ' + active + ' aktiv';
      if (missingInFres > 0) {
        return { ok: false, msg: msg + ' — ' + missingInFres + ' konvergierte Tracks fehlen in fRes!' };
      }
      return { ok: true, msg: msg };
    }
  );
})();
```

Der Adaptiv-Test prüft genau das Beispiel-Problem: konvergierte
Tracks, deren `fRes`-Eintrag fehlt. Wenn der zurückliefert
„X konvergierte Tracks fehlen in fRes!", ist der Bug greifbar.
Falls Sonnet beim Lesen von `freqmatch.js` feststellt, daß die
Track-Datenstruktur leicht abweicht (z.B. `electrodeIdx` heißt
anders, oder `tracks` ist ein Array statt eines Objekts): das
beim Build entsprechend anpassen und in der Selbstprüfung
melden. Im Zweifel kurz rückfragen.

---

## 5. Loader-Liste in `index.html` erweitern

In `index.html`, im zweiten Inline-Loader, das Scripts-Array am
**Ende** (nach `js/unterstuetzung.js`) um `js/debug-tests.js`
ergänzen. So sind alle Module schon geladen, wenn die Tests
registriert werden.

Vorher (letzte Zeile des Arrays):

```js
'js/finanzen.js', 'js/unterstuetzung.js'
```

Nachher:

```js
'js/finanzen.js', 'js/unterstuetzung.js',
'js/debug-tests.js'
```

---

## 6. Live-Log-Hooks in `js/freqmatch.js`

### 6.1 Lokalfunktion `_fmDbg` einfügen

Oben in `js/freqmatch.js`, am Anfang des Moduls (vor der ersten
Funktionsdefinition oder direkt nach den globalen `let`-
Deklarationen), folgende kleine Hilfsfunktion ergänzen:

```js
function _fmDbg(msg) {
  if (typeof dbg !== 'undefined' && dbg.flag && dbg.flag('adaptiv.live')) {
    dbg.log(msg, 'info');
  }
}
```

### 6.2 Hook-Stellen

Sonnet sucht die folgenden Funktionen in `freqmatch.js` und fügt
jeweils einen `_fmDbg(...)`-Aufruf ein. Die genauen Variablennamen
liest Sonnet aus dem Code (CODESTRUKTUR.md listet sie unter `9`);
unten stehen die Inhalte der Logzeilen, der genaue Aufruf-Punkt
ergibt sich aus Funktionsanfang bzw. Variablen-Schreibestelle.

**A) `fmStartAdaptive`** — direkt nach Initialisierung der Tracks,
vor dem ersten `fmNextAdaptiveTrial`-Aufruf:

```js
_fmDbg('start: ref=' + refSide + ' var=' + varSide
     + ', tracks=' + Object.keys(fmTracks).length);
```

**B) `fmNextAdaptiveTrial`** — am Anfang, nach Auswahl des
nächsten Tracks per `fmPickNextTrack`:

```js
_fmDbg('trial #' + (fmTracks[fmCurTrackId].trialCount + 1)
     + ' track=' + fmCurTrackId
     + ' refHz=' + Math.round(fmTracks[fmCurTrackId].refHz || 0)
     + ' varHz=' + Math.round(fmTracks[fmCurTrackId].curHz || 0)
     + (fmCurCatchInfo ? ' [CATCH dir=' + fmCurCatchInfo.direction + ']' : ''));
```

(Variablen-Namen ggf. anpassen, falls Track-Felder anders heißen.
Aus CODESTRUKTUR.md: `fmTracks` ist Map, `fmCurTrackId` ist
aktueller Key.)

**C) `fmHandleHeight`** — direkt nach `_fmConvertHeight` und
`fmApplyResponse`, vor dem Status-Check:

```js
_fmDbg('response: heard=' + heardHigher + (catchHit !== undefined
       ? ' catch=' + (catchHit ? 'ok' : 'miss') : '')
     + ' step=' + tr.step + ' reversals=' + (tr.reversals || []).length);
```

(`heardHigher`/`catchHit`/`tr` sind die in `fmHandleHeight`
verwendeten lokalen Variablen — Sonnet ersetzt mit den
tatsächlichen Namen.)

**D) Status-Wechsel** — überall dort, wo `track.status` von
`'active'` auf etwas anderes wechselt. Wenn das zentral in
`_fmCheckAndUpdateStatus` aus `freqmatch-staircase.js` passiert,
**dort nicht eingreifen** (Pure-Function-Modul), sondern in
`freqmatch.js` direkt nach jedem Aufruf der Status-aktualisierenden
Funktion prüfen und loggen:

```js
const prevStatus = tr.status;       // VOR fmApplyResponse merken
// ... fmApplyResponse ...
if (tr.status !== prevStatus) {
  _fmDbg('status: track=' + fmCurTrackId + ' ' + prevStatus + '→' + tr.status
       + (tr.status === 'not-perceivable'
            ? ' (catch-fail=' + (tr.catchFails || 0) + '/' + (tr.catchHits || 0) + ')'
            : ''));
}
```

**E) `_fmWriteResult`** — direkt nach dem Schreiben des `fRes`-
Eintrags:

```js
_fmDbg('fRes write: side=' + side + ' el=' + el
     + ' matchHz=' + Math.round(matchHz)
     + ' residCt=' + (residualCent != null ? residualCent.toFixed(1) : '—'));
```

**F) `_fmRemoveResult`** — direkt vor oder nach dem Entfernen:

```js
_fmDbg('fRes remove: side=' + side + ' el=' + el + ' (not-perceivable)');
```

**G) `fmFinishAdaptive`** — am Anfang oder Ende der Funktion,
mit Zusammenfassung:

```js
let cv = 0, nv = 0, np = 0;
Object.keys(fmTracks).forEach(function (k) {
  const st = fmTracks[k].status;
  if (st === 'converged') cv++;
  else if (st === 'converged-noisy') nv++;
  else if (st === 'not-perceivable') np++;
});
_fmDbg('finish: ' + cv + ' converged, ' + nv + ' noisy, ' + np + ' not-perceivable');
```

**H) Pause/Resume** — in `_fmPersist` (nach erfolgreichem
Schreiben in `sideData[...].freqmatchAdaptive`) und in
`_fmTryRestore` (nach erfolgreicher Wiederherstellung):

```js
_fmDbg('persist: tracks=' + Object.keys(fmTracks).length);
// bzw.:
_fmDbg('restore: ' + Object.keys(fmTracks).length + ' tracks geladen');
```

Wenn eine der genannten Funktionen anders strukturiert ist als
oben angenommen (z.B. `fmTracks` ist Array statt Map, oder eine
Hook-Stelle existiert nicht in genau der Form): Sonnet paßt den
Log-Inhalt sinngemäß an und meldet die Abweichung im
Selbstprüfungs-Bericht. Wichtig ist, daß die Hooks die im
Beispiel-Problem (kein `fRes`-Eintrag) entscheidenden Punkte
abdecken: **Trial-Response · Status-Wechsel · fRes-Write ·
fRes-Remove · Finish-Summary**.

---

## 7. CODESTRUKTUR.md aktualisieren

In `docs/CODESTRUKTUR.md`:

**(a)** Neue Tabellenzeile **am Ende** der Modul-Tabelle (nach
`unterstuetzung.js`):

```
| 22 | debug-tests.js | Selbsttest-Registrierung für das Debug-Panel (Bauanleitung 82). Lädt zuletzt, registriert via `dbg.test(...)` die vier Tests `global/player`, `global/i18n`, `global/sentence`, `frequenzabgleich/adaptiv`. Der Adaptiv-Test trägt `liveLogFor: "adaptiv.live"` — das Flag schaltet die `_fmDbg(...)`-Aufrufe in `freqmatch.js` an, ohne den Code zu modifizieren. Keine eigene UI, kein DOMContentLoaded-Handler. |
```

**(b)** Eintrag für `debug.js` (Zeile `0a`, eingefügt in BA 80,
ergänzt in BA 81) um den Test-Framework-Block erweitern:

> *Seit Bauanleitung 82:* Test-Registry `_testReg` (Map name → t),
> User-Auswahl `_testSelect` (Set), Flags `_flags`
> (persistiert in `localStorage` unter `ciSb.debugFlags`).
> Public API erweitert um `runTest(name)`, `runAllTests()`,
> `flag(name)`, `setFlag(name, v)`. Test-Funktionen können
> `true`, `false`, einen String oder `{ok, msg}` zurückgeben
> (oder eine Promise davon); Wrapper `_runTest` normalisiert.
> Default-Auswahl der Checkboxen über `_applyDefaultSelection`
> beim Aktivieren und bei `dbg.test(...)`-Registrierung: angehakt
> sind Tests mit `opts.tab === currentTab` oder
> `opts.tab === "global"`.

**(c)** Eintrag für `freqmatch.js` (Zeile `9`) am Ende ergänzen:

> *Seit Bauanleitung 82:* Lokalfunktion `_fmDbg(msg)` als
> Live-Log-Brücke ins Debug-Panel — schreibt nur, wenn
> `dbg.flag('adaptiv.live')` true ist. Hooks an acht Stellen:
> `fmStartAdaptive`, `fmNextAdaptiveTrial`, `fmHandleHeight`,
> Status-Wechsel, `_fmWriteResult`, `_fmRemoveResult`,
> `fmFinishAdaptive`, `_fmPersist`/`_fmTryRestore`.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Version `3.0.82-beta`.
2. **Default unverändert**: ohne Debug-Aktivierung sieht das Tool
   identisch aus.
3. **Panel öffnen** (Doppelklick aufs Logo). Sektion „Tests"
   zeigt jetzt vier Einträge:
   - `global/i18n`
   - `global/player`
   - `global/sentence`
   - `frequenzabgleich/adaptiv`
4. **Default-Status**: jeder Test hat das Icon `○` (noch nicht
   gelaufen). Default-Häkchen sind gesetzt für alle Tests mit
   `tab === "global"` plus — falls aktuell `tab === "messungen"`
   — auch der Adaptiv-Test.
5. **Tab-Wechsel-Check** der Default-Auswahl: vor dem ersten
   Aktivieren des Panels in einen Tab wechseln (z.B. Levels),
   dann Panel öffnen. Adaptiv-Test ist **nicht** automatisch
   angehakt, weil sein Tab (`messungen`) nicht dem aktuellen Tab
   entspricht. Die drei `global/`-Tests sind angehakt.
6. **Einzeltest manuell laufen lassen**: ↻ neben `global/player`.
   Status wechselt kurz auf `⏳`, dann auf `✓` oder `✗`. Die
   letzte Meldung erscheint unter dem Test (z.B. „AC running
   @ 44100 Hz, vol=80%").
7. **Alles testen**: Klick auf „▶ alle" im Tests-Header. Alle vier
   Tests laufen seriell durch. Die Tests-Sektion zeigt am Ende
   alle Status-Icons.
8. **Live-Log-Toggle** für Adaptiv-Test: das ⌚-Symbol neben dem
   Adaptiv-Test klicken. Symbol wird hervorgehoben (Rahmen
   orange). Status persistiert (Reload → Toggle bleibt an).
9. **Adaptiv-Lauf mit Live-Log**: in den Tab Messungen →
   Frequenzabgleich → adaptiver Modus → „Test starten". Im Log
   erscheinen Zeilen wie:
   - `[HH:MM:SS] info: start: ref=… var=… tracks=…`
   - `[HH:MM:SS] info: trial #1 track=K refHz=… varHz=…`
   - bei jeder Antwort: `[…] info: response: heard=true step=…`
   - bei Status-Wechsel: `[…] info: status: track=K active→converged`
   - bei Write: `[…] info: fRes write: …`
   - am Ende: `[…] info: finish: X converged, …`
10. **Live-Log aus**: ⌚-Toggle wieder klicken — keine weiteren
    Adaptiv-Log-Zeilen mehr.
11. **Adaptiv-Konsistenz-Test**: Nach einem Adaptiv-Lauf den
    `frequenzabgleich/adaptiv`-Test manuell mit ↻ erneut
    ausführen. Wenn alle konvergierten Tracks in `fRes`
    eingetragen sind, meldet er `ok` mit Track-Aufstellung. Wenn
    konvergierte Tracks fehlen, meldet er `fail` mit „X konvergierte
    Tracks fehlen in fRes!" — und im Log lassen sich die fehlenden
    Schreib-/Lösch-Pfade anhand der Live-Log-Spur nachvollziehen.
12. **Häkchen-Verhalten**: Häkchen vor einem Test entfernen, dann
    „▶ alle" — alle vier laufen (Häkchen werden ignoriert).
13. **Test-Re-Run via Konsole**: `dbg.runTest("global/player")`
    löst einen Einzellauf aus, Status aktualisiert sich im Panel.
14. **Flag-API via Konsole**: `dbg.setFlag("adaptiv.live", true)`
    setzt das Flag (Live-Log an), `dbg.flag("adaptiv.live")` gibt
    `true` zurück. Persistiert im `localStorage` unter
    `ciSb.debugFlags`.
15. **Sektion-Copy „Tests"**: Klick auf „kopieren" im Tests-Header.
    Markdown enthält Kopfblock + Tests-Liste mit Status-Symbolen
    und Meldungen.
16. **„Alles kopieren"**: Markdown enthält alle drei Sektionen
    (Felder, Tests, Log).
17. **Druckansicht**: Strg-P bei aktivem Debug-Panel — Sidebar
    fehlt in der Vorschau (unverändert seit BA 80).
18. **Konsole** frei von Fehlern in allen Schritten.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der 18 Akzeptanz-Punkte einzeln
durchgehen und melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe.

Speziell prüfen:

- Sind alle Hook-Stellen in `freqmatch.js` einzeln nachweisbar?
  Sonnet listet **pro Hook (A bis H) die Zeilennummer** in
  `freqmatch.js`, an der `_fmDbg(...)` eingefügt wurde, plus
  den genauen Logtext.
- Falls eine Hook-Stelle aus inhaltlichen Gründen nicht so
  eingebaut werden kann (Variable existiert nicht, Funktion
  anders strukturiert): das **explizit** im Selbstprüfungs-
  Bericht als „unklar" markieren — nicht stillschweigend auslassen.
- Track-Datenstruktur in `fmTracks`: ist es ein Plain-Object
  (Map-artig per Key) oder eine `Map`-Instanz? Falls `Map`, statt
  `Object.keys(fmTracks)` `fmTracks.size` / `for (... of fmTracks.entries())`
  verwenden, auch im Adaptiv-Test in `debug-tests.js`.
- Hat ein Track das Feld `electrodeIdx` oder heißt es anders
  (`elIdx`, `el`, ...)? Sonnet prüft das im Code und korrigiert
  die Stelle im Adaptiv-Test entsprechend.
- Trägt `fRes` Einträge mit `side` und `el`, oder hat es eine
  andere Struktur? Vergleich mit Aufrufer-Stellen
  (`_fmWriteResult`, `results.js → renderFreqMatchResults`).
- Wird `js/debug-tests.js` wirklich nach allen anderen Modulen
  geladen? In der Loader-Liste **letzter** Eintrag?
- Bleibt der initial leere Log nach Reload mit aktivem Panel
  und aktivem Live-Log-Flag, bis ein Adaptiv-Lauf startet? (D.h.
  das Flag triggert nicht selbst Log-Einträge, sondern nur die
  Hooks tun das.)
- Werden Tests, die `Promise` zurückgeben (async-fähige
  Schnittstelle), korrekt mit `await` behandelt? — der Wrapper
  `_runTest` ist `async` und benutzt `Promise.resolve(t.fn())`,
  fängt also beides ab.

Bei Zweifel zu einer Variable, Funktion oder Datenstruktur:
**kurze Rückfrage statt stiller Annahme**. Sonnet darf die
Anleitung im Selbstprüfungs-Bericht kommentieren mit „hier
abgewichen, weil …" — der Nutzer entscheidet dann, ob die
Abweichung übernommen oder rückgängig gemacht wird.

---

## Was diese Anleitung NICHT macht

- Keine Live-Log-Hooks außerhalb von `freqmatch.js` (z.B. nicht
  in `player.js`, `lr-balance.js`, `latency.js`). Wenn dort
  später ähnliche Diagnose nötig ist, eigene Mini-Anleitung —
  das `dbg.flag(...)`-Pattern ist generisch nutzbar.
- Keine Persistenz der `_testSelect`-User-Auswahl. Das Häkchen-
  Setup wird bei jedem Aktivieren neu aus der Default-Regel
  gebaut, User-Änderungen sind Session-temporär.
- Keine Test-Historie (letzte N Läufe). Pro Test nur „last".
- Keine Übersetzung der Test-Labels (Panel ist Entwickler-UI,
  wie in BA 80/81 begründet).
- Keine Druck-/Export-Anpassung des Panels.

---

## Abschluß der Debug-Modus-Reihe

Mit dieser Anleitung ist der Debug-Modus vollständig:

- **BA 80** — Grundgerüst (Aktivierung, Panel, Copy-All, API-Stubs)
- **BA 81** — Persistente Felder (Polling, Auto vs. User, Sektion-Copy)
- **BA 82** — Selbsttests + Adaptiv-Live-Log (Registry, Flags,
  vier Tests, Hooks in `freqmatch.js`)

Optionale Folge-Anleitungen (nur auf expliziten Wunsch):

- Resizable Sidebar (Drag am linken Rand)
- Live-Log-Hooks in weiteren Modulen (`player.js`, `lr-balance.js`,
  `latency.js`)
- Persistenz der `_testSelect`-User-Auswahl
- Englische/französische/spanische Übersetzung der Panel-Texte
  (bewußt zurückgestellt, weil Entwickler-UI)
