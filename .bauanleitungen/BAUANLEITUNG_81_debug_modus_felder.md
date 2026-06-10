# Bauanleitung 81 — Debug-Modus: Persistente Felder

## Ziel

Auf das Grundgerüst aus BA 80 aufbauen und das Debug-Panel mit
**inhaltlichen Feldern** befüllen. Zusätzlich pro Sektion (Felder,
Tests, Log) einen kleinen Copy-Button, der nur diese eine Sektion
in die Zwischenablage schreibt.

Die Felder werden über einen leichten **Polling-Loop** (alle 500 ms,
nur wenn Panel aktiv) aus den globalen Modul-Variablen gelesen.
Vorteil: kein Eingriff in andere Module nötig — wenn `pPlaying`,
`sCurRec`, `lang` usw. zur Laufzeit ihren Wert ändern, sieht das
Panel das beim nächsten Tick. Inaktiv kostet das nichts (kein
Interval läuft).

**Voraussetzung:** Bauanleitung 80 ist umgesetzt und im
Akzeptanztest abgenommen.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.81-beta";
```

---

## 2. Trennung von Auto-Feldern und User-Feldern in `js/debug.js`

In `js/debug.js`, im IIFE-Block oben, die bestehende Konstante

```js
const _fields = Object.create(null);   // key → value
```

**ersetzen** durch zwei getrennte Speicher und einen Merge-Helper:

```js
const _autoFields = Object.create(null);   // vom Polling befüllt
const _userFields = Object.create(null);   // via dbg.set(...) befüllt

function _allFields() {
  const out = Object.create(null);
  for (const k in _autoFields) out[k] = _autoFields[k];
  for (const k in _userFields) out[k] = _userFields[k];   // user gewinnt bei Konflikt
  return out;
}
```

Anschließend in der Datei alle bisherigen Zugriffe auf `_fields`
auf den jeweils passenden Speicher umstellen:

- In `_renderFields()`:
  ```js
  const f = _allFields();
  const keys = Object.keys(f).sort();
  // ... statt vorher Object.keys(_fields).sort() ...
  // und f[k] statt _fields[k]
  ```
- In der Markdown-Erzeugung (siehe unten Abschnitt 4): ebenfalls
  `_allFields()` lesen.
- In der öffentlichen API `window.dbg`:
  - `dbg.set(key, value)` → `_userFields[key] = value;` (statt `_fields`)
  - `dbg.unset(key)` → `delete _userFields[key];`

`_autoFields` wird **ausschließlich** vom Polling-Loop befüllt
(nächster Schritt). User-gesetzte Felder bleiben dadurch stabil,
auch wenn das Polling den Auto-Block periodisch neu schreibt.

---

## 3. Polling-Loop und Feldsammler in `js/debug.js`

Zwei neue Funktionen direkt vor dem Block „Öffentliche API"
einfügen:

```js
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
    // Reset: alte Auto-Felder verwerfen, Schlüssel kommen nur, wenn definiert.
    for (const k in _autoFields) delete _autoFields[k];

    // App-Version
    if (typeof APP_VERSION === 'string') _autoFields['app.version'] = APP_VERSION;

    // Sprache
    if (typeof lang === 'string') _autoFields['lang'] = lang;

    // Aktiver Tab / Sub-Tab (DOM-basiert)
    const tabEl = document.querySelector('.tab.active');
    if (tabEl && tabEl.dataset.tab) _autoFields['tab'] = tabEl.dataset.tab;
    const subEl = document.querySelector('.subtab.active');
    if (subEl && subEl.dataset.subtab) _autoFields['tab.sub'] = subEl.dataset.subtab;

    // Seite (links/rechts)
    if (typeof activeSide === 'string') _autoFields['side'] = activeSide;

    // Implantat (aktive Seite)
    if (typeof mfr === 'string') _autoFields['implant.mfr'] = mfr;
    const sd = _safe(() => sideData && sideData[activeSide]);
    if (sd) {
      if (typeof sd.nEl === 'number') _autoFields['implant.electrodes'] = sd.nEl;
      if (sd.implant) {
        if (sd.implant.model)     _autoFields['implant.model']     = sd.implant.model;
        if (sd.implant.processor) _autoFields['implant.processor'] = sd.implant.processor;
      }
    }

    // Player
    if (typeof pPlaying === 'boolean')      _autoFields['player.state'] = pPlaying ? 'playing' : 'stopped';
    if (typeof pPlaybackMode === 'string')  _autoFields['player.mode']  = pPlaybackMode;
    if (typeof pOff === 'number')           _autoFields['player.pos']   = pOff.toFixed(2) + ' s';
    const volEl = document.getElementById('plVol');
    if (volEl)                              _autoFields['player.vol']   = volEl.value + ' %';
    if (typeof plEqOn === 'boolean')        _autoFields['player.eqOn']  = plEqOn;
    if (typeof plApplyBalance === 'boolean')_autoFields['player.balanceOn'] = plApplyBalance;

    // AudioContext
    const pc = _safe(() => pCtx);
    if (pc) {
      _autoFields['audio.sampleRate'] = pc.sampleRate + ' Hz';
      _autoFields['audio.state']      = pc.state;
    }

    // MAPLAW
    if (typeof pMaplawOn === 'boolean') _autoFields['maplaw.on'] = pMaplawOn;
    if (pMaplawOn) {
      const ist = _safe(() => (typeof pMaplawGetIstC === 'function') ? pMaplawGetIstC() : null);
      if (ist != null) _autoFields['maplaw.istC'] = ist;
      if (typeof pMaplawSollC === 'number') _autoFields['maplaw.sollC'] = pMaplawSollC;
    }

    // Frequenz-Warping
    if (typeof pWarpOn === 'boolean') {
      _autoFields['warp.on'] = pWarpOn;
      if (pWarpOn) {
        if (typeof pWarpMode === 'string')      _autoFields['warp.mode']     = pWarpMode;
        if (typeof pWarpStrength === 'number')  _autoFields['warp.strength'] = pWarpStrength;
      }
    }

    // Sentence-Wiedergabe
    if (typeof sActive === 'boolean')       _autoFields['sentence.active']   = sActive;
    if (typeof sEndless === 'boolean')      _autoFields['sentence.endless']  = sEndless;
    if (typeof sOfflineMode === 'boolean')  _autoFields['sentence.corpus']   = sOfflineMode ? 'embed (offline)' : 'fetch (online)';
    const curRec = _safe(() => sCurRec);
    if (curRec && curRec.rec) {
      if (curRec.speakerKey)  _autoFields['sentence.speaker'] = curRec.speakerKey;
      if (curRec.rec.text)    _autoFields['sentence.text']    = _truncate(curRec.rec.text, 80);
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
```

In `_activate()` ergänzen, **nach** `_renderAll()`:

```js
_startRefreshLoop();
```

In `_deactivate()` ergänzen, **vor** dem `if (_panel) _panel.style.display = 'none';`:

```js
_stopRefreshLoop();
```

Anschließend wird `_renderAll()` nicht mehr direkt aus `_activate()`
gebraucht (der Loop macht den initialen Render selbst). Trotzdem
`_renderAll()` drinlassen — es rendert auch Log + (in BA 82)
Tests, die der Loop nicht anfaßt.

---

## 4. Markdown-Erzeugung in Sektionen zerlegen

Die bisherige Funktion `_buildSnapshotMarkdown()` aus BA 80 wird
in vier kleine Helfer zerlegt, damit auch einzelne Sektionen
kopiert werden können.

In `js/debug.js` die Funktion `_buildSnapshotMarkdown()` ersetzen
durch:

```js
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
    // BA 82 — vorerst Platzhalter
    return '## Tests\n\n_(in BA 82)_\n';
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
```

Außerdem den bisherigen Inline-Code für die Felder-Tabelle in
`_renderFields()` so umstellen, daß er ebenfalls über `_allFields()`
geht (statt `_fields`).

---

## 5. Pro-Sektion-Copy-Buttons im Panel-Skelett

In `_ensurePanel()` die drei h4-Zeilen anpassen — jeder bekommt
einen kleinen „kopieren"-Knopf mit `data-sec`:

**Vorher** (aus BA 80):

```js
+     '<h4>Felder</h4>'
...
+     '<h4>Tests</h4>'
...
+     '<h4>Log <button class="dbg-btn-mini" id="dbgClearLog">leeren</button></h4>'
```

**Nachher**:

```js
+     '<h4>Felder <button class="dbg-btn-mini dbg-copy-sec" data-sec="fields" title="Felder kopieren">kopieren</button></h4>'
...
+     '<h4>Tests <button class="dbg-btn-mini dbg-copy-sec" data-sec="tests" title="Tests kopieren">kopieren</button></h4>'
...
+     '<h4>Log '
+        '<button class="dbg-btn-mini dbg-copy-sec" data-sec="log" title="Log kopieren">kopieren</button> '
+        '<button class="dbg-btn-mini" id="dbgClearLog">leeren</button>'
+     '</h4>'
```

Anschließend, **am Ende** des bestehenden Event-Listener-Blocks
in `_ensurePanel()` (nach `dbgClearLog`-Listener), ergänzen:

```js
_panel.querySelectorAll('.dbg-copy-sec').forEach(function (btn) {
  btn.addEventListener('click', function (ev) {
    const sec = ev.currentTarget.dataset.sec;
    _copyText(_buildSectionMarkdown(sec));
  });
});
```

Dabei den bestehenden Code aus `_copyAll()` (Clipboard-Aufruf +
Fallback + Toast) in eine kleine Helferfunktion `_copyText(text)`
herausziehen, damit sie auch hier verwendet werden kann:

```js
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
```

`_fallbackCopy` und `_toast` bleiben unverändert.

---

## 6. CODESTRUKTUR.md aktualisieren

In `docs/CODESTRUKTUR.md`, in der Tabelle „Module im Ladeverlauf",
den Eintrag für `debug.js` (Zeile `0a`, aus BA 80) ergänzen um den
Hinweis auf den Polling-Sammler und die Sektion-Copy-Buttons.
Vorschlag (Ergänzungen kursiv im Original-Eintrag einfügen):

> *Seit Bauanleitung 81:* Polling-basierter Feldsammler
> `_collectFields()` läuft per `setInterval(_, 500 ms)`, solange
> das Panel aktiv ist, und liest globale Variablen (`lang`,
> `activeSide`, `mfr`, `sideData[…].implant`, `pPlaying`,
> `pPlaybackMode`, `pOff`, `pMaplawOn`/`SollC`/`GetIstC`,
> `pWarpOn`/`Mode`/`Strength`, `sActive`/`Endless`/`OfflineMode`/
> `CurRec`) sowie DOM-Selektoren (`.tab.active`, `.subtab.active`,
> `#plVol`). Auto-Felder werden in `_autoFields` gehalten und
> bei jedem Tick neu aufgebaut; benutzergesetzte Felder über
> `dbg.set(...)` leben separat in `_userFields` und überleben
> den Polling-Tick. Markdown-Snapshot ist in
> `_mdHeader`/`_mdFieldsBlock`/`_mdTestsBlock`/`_mdLogBlock`
> zerlegt; pro Sektion ein „kopieren"-Knopf im Panel kopiert nur
> den jeweiligen Block.

Sonnet darf die Formulierung anpassen, solange die genannten
Funktionsnamen und das Trennungs-Prinzip (`_autoFields` vs.
`_userFields`) enthalten sind.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Versionslabel zeigt
   `3.0.81-beta`.
2. **Default unverändert**: ohne Aktivierung sieht das Tool aus
   wie vorher, keine Sidebar.
3. **Aktivierung per Doppelklick aufs Logo**: Panel kommt. In der
   Sektion „Felder" stehen jetzt unmittelbar mehrere Einträge,
   u.a. `app.version`, `lang`, `tab`, `side`, `audio.state`.
4. **Tab-Wechsel**: oben in einen anderen Tab wechseln
   (z.B. „Messungen"). Innerhalb von ≤ 500 ms aktualisiert sich
   das Feld `tab` im Panel auf den neuen Tab-Namen.
5. **Sub-Tab-Wechsel** (Tab „Messungen" → Sub-Tab „Frequenzabgleich"):
   Feld `tab.sub` erscheint mit dem aktiven Sub-Tab-Namen.
6. **Seitenwechsel** (LINKS/RECHTS-Buttons): Feld `side` und die
   Implantat-Felder folgen.
7. **Player anwerfen** (Tab Schieber/Levels mit Audiodatei oder
   ähnliches): Feld `player.state` wechselt zu `playing`, `player.pos`
   tickt mit, `audio.state` zeigt `running`. Beim Stoppen zurück
   zu `stopped`.
8. **MAPLAW-Toggle** (im Player-Tab, falls sichtbar): Feld
   `maplaw.on` wechselt; bei On erscheinen zusätzlich
   `maplaw.istC` und `maplaw.sollC`.
9. **Warping-Toggle** im Player: Feld `warp.on` wechselt; bei On
   erscheinen `warp.mode` und `warp.strength`.
10. **Sätze-Wiedergabe starten**: `sentence.active` wird `true`,
    `sentence.speaker` und `sentence.text` (gekürzt auf max. 80
    Zeichen mit „…") erscheinen. `sentence.corpus` zeigt
    `embed (offline)` oder `fetch (online)`.
11. **User-Feld via Konsole**: `dbg.set("foo", 42)` → Feld
    `foo: 42` erscheint zwischen den Auto-Feldern und bleibt
    auch nach den nächsten Polling-Ticks erhalten. `dbg.unset("foo")`
    → Feld verschwindet.
12. **Konflikt-Test**: `dbg.set("lang", "TEST")` →
    Feld `lang` zeigt `TEST` statt der aktuellen Sprache
    (User-Wert hat Vorrang). `dbg.unset("lang")` →
    Auto-Wert ist beim nächsten Tick wieder da.
13. **„Alles kopieren"** (Header-Button): Markdown im Clipboard
    enthält alle drei Sektionen.
14. **Sektion-Copy**: Klick auf „kopieren" neben „Felder" →
    Markdown enthält Kopf + nur den Felder-Block. Analog für
    „Tests" (zeigt Platzhalter `_(in BA 82)_`) und „Log".
15. **Deaktivieren** per × → Panel weg, Reload bestätigt
    Persistenz. Beim erneuten Aktivieren sind alle Auto-Felder
    sofort wieder da. User-Felder (`_userFields`) sind **nicht**
    persistent über Reloads — bewußt so, sie überleben nur die
    Session.
16. **Polling-Stop bei Deaktivierung**: in der Konsole vor dem
    Deaktivieren `dbg._refreshTimer` ist nicht verfügbar (privat),
    aber Indiz: nach Deaktivieren verändert `dbg.set("test", new
    Date())` zwar die User-Felder, das Auto-Feld `player.pos`
    aktualisiert sich nicht (Loop steht). Beim Reaktivieren
    läuft der Loop wieder.
17. **Konsole** frei von Fehlern in allen Schritten.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der 17 Akzeptanz-Punkte einzeln
durchgehen und melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe.

Speziell prüfen:

- Werden Polling-Intervall sauber gestartet und beim Deaktivieren
  beendet? Doppel-Aktivierung darf nicht zwei parallele Timer
  starten (`_refreshTimer`-Guard).
- Bricht der `_collectFields()`-Lauf, wenn eine globale
  Variable noch nicht initialisiert ist (z.B. `sideData`
  vor `state-side.js`-Init)? Defensive `typeof`-Checks und
  `_safe()`-Wrapper sollten greifen.
- Bleiben die User-Felder (`_userFields`) wirklich erhalten,
  auch wenn der Polling-Tick `_autoFields` komplett zurücksetzt?
  (Sonnet prüft, daß `_collectFields()` nicht versehentlich
  `_userFields` mitlöscht.)
- Sind alle drei Mini-Buttons „kopieren" sichtbar **neben** den
  h4-Überschriften (nicht in einer eigenen Zeile, keine
  Layout-Brüche)? Falls die CSS-Regel für `.dbg-btn-mini`
  bei mehreren Buttons pro h4 zu wenig Abstand erzeugt, einen
  `gap`/`margin` ergänzen.
- Hat der Sektion-Copy für „Log" den Header (`_mdHeader`) drin?
  (Wichtig, damit ein eingeklebter Log-Auszug allein schon URL/
  Version/UA enthält.)
- Sind Globale, die im Default-Zustand `undefined` sein können,
  über `typeof X === '…'` geguarded? `lang` ist immer gesetzt
  (Default `"de"`), `pPlaying` immer (Default `false`), aber
  `sideData[activeSide]` kann fehlen, wenn `activeSide` noch
  leer ist — `_safe()` deckt das ab.

Bei Zweifel zu einer Variable (z.B. ob `plEqOn` wirklich global
verfügbar ist oder lokal/lazy): kurze Rückfrage statt stiller
Annahme. CODESTRUKTUR.md auflistet `plEqOn` und `plApplyBalance`
unter `state-side.js`.

---

## Was diese Anleitung NICHT macht

- Kein Selbsttest-Framework, keine Tab-Zuordnung von Tests,
  keine Re-Run-Buttons — kommt in **BA 82**. Die Sektion
  „Tests" bleibt vorerst ein Platzhalter.
- Keine Live-Logs aus dem Adaptiv-Frequenzabgleich-Modul —
  ebenfalls BA 82.
- Keine Resize-/Drag-Funktion am Panel-Rand.
- Keine i18n der Panel-Texte. Begründung wie in BA 80.
- Keine UI für „Auto-Refresh-Intervall einstellbar". Festwert
  500 ms ist gut genug.
- Keine Persistenz der `_userFields` über Reloads — sie sind
  Session-temporär (siehe Akzeptanztest 15).
