# BAUANLEITUNG 116 — Seitenhörtest: Implementierung in test-ui.js

Ziel: `testUI.sideCheck` als neue API in `test-ui.js` einführen.
Kein Anschluß an Tests in dieser BA — nur die Infrastruktur.
BA 117 verdrahtet freqmatch.js.

Scope: `js/test-ui.js`, `i18n/de.js`, `js/version.js`

---

## Schritt 1 — Versionsnummer

`js/version.js`, Zeile 1:

```js
const APP_VERSION = "3.0.116-beta";
```

---

## Schritt 2 — i18n/de.js: neue Keys

Nach dem Eintrag `fmHpBtnCancel` (ca. Zeile 794) einfügen.
Regulaere JS-Strings mit `"..."` — keiner der Werte enthaelt innere `"`, kein Escaping noetig.

```js
    // --- Seitenhoertest ---
    shtTitle:        "Seitenhoertest",
    shtMsgLeft:      "Linker Ton — auf welcher Seite hoeren Sie?",
    shtMsgRight:     "Rechter Ton — auf welcher Seite hoeren Sie?",
    shtMsgOne:       "Auf welcher Seite hoeren Sie den Ton?",
    shtBtnReplay:    "Ton wiederholen",
    shtBtnLeft:      "Links",
    shtBtnRight:     "Rechts",
    shtBtnBoth:      "Beide",
    shtBtnNone:      "Nichts",
    shtBtnRetry:     "Wiederholen",
    shtBtnAbort:     "Abbruch",
    shtErrFlip:      "Kopfhoerer moeglicherweise falsch herum aufgesetzt. Bitte umpolen und erneut testen.",
    shtErrAudiolink: "Beide Toene auf nur einer Seite gehoert. Moeglicherweise ist nur ein Geraet verbunden (z. B. Audiolink mit einem CI). Bitte Audioverbindung pruefen.",
    shtErrBilateral: "Ton auf beiden Seiten gehoert. Bitte Audioverbindung pruefen.",
    shtErrNone:      "Kein Ton gehoert. Bitte Audioverbindung und Lautstaerke pruefen.",
    shtErrMissing:   "Eine Seite fehlt. Bitte Audioverbindung pruefen.",
    shtErrMixed:     "Gestoerte Audioverbindung, bitte ueberpruefen.",
    shtSymLeftNone:  "Linker Ton: nichts gehoert",
    shtSymRightNone: "Rechter Ton: nichts gehoert",
    shtSymLeftBoth:  "Linker Ton: beidseitig gehoert",
    shtSymRightBoth: "Rechter Ton: beidseitig gehoert",
    shtSymLeftWrong: "Linker Ton: auf rechter Seite gehoert",
    shtSymRightWrong:"Rechter Ton: auf linker Seite gehoert",
```

**WICHTIG:** Die Werte oben sind mit ASCII-Ersetzungen (oe/ae/ue) geschrieben, damit
dieses Dokument keine Encoding-Probleme hat. In der echten `de.js` die Umlaute korrekt
schreiben: `Seitenhörtest`, `hören`, `möglicherweise`, `Kopfhörer`, `Töne`, `gehört`,
`gestörte`, `überprüfen`, `überprüfen`, `gehört` usw. Die `—` in `shtMsgLeft`
und `shtMsgRight` durch einen echten Gedankenstrich `—` ersetzen.

Kurzform: Alle Strings entsprechen dem deutschen Text aus dem Konzept —
Umlaute und Gedankenstriche direkt (UTF-8).

Die fertigen Strings lauten:

| Key | Wert |
|-----|------|
| shtTitle | Seitenhörtest |
| shtMsgLeft | Linker Ton — auf welcher Seite hören Sie? |
| shtMsgRight | Rechter Ton — auf welcher Seite hören Sie? |
| shtMsgOne | Auf welcher Seite hören Sie den Ton? |
| shtBtnReplay | Ton wiederholen |
| shtBtnLeft | Links |
| shtBtnRight | Rechts |
| shtBtnBoth | Beide |
| shtBtnNone | Nichts |
| shtBtnRetry | Wiederholen |
| shtBtnAbort | Abbruch |
| shtErrFlip | Kopfhörer möglicherweise falsch herum aufgesetzt. Bitte umpolen und erneut testen. |
| shtErrAudiolink | Beide Töne auf nur einer Seite gehört. Möglicherweise ist nur ein Gerät verbunden (z. B. Audiolink mit einem CI). Bitte Audioverbindung prüfen. |
| shtErrBilateral | Ton auf beiden Seiten gehört. Bitte Audioverbindung prüfen. |
| shtErrNone | Kein Ton gehört. Bitte Audioverbindung und Lautstärke prüfen. |
| shtErrMissing | Eine Seite fehlt. Bitte Audioverbindung prüfen. |
| shtErrMixed | Gestörte Audioverbindung, bitte überprüfen. |
| shtSymLeftNone | Linker Ton: nichts gehört |
| shtSymRightNone | Rechter Ton: nichts gehört |
| shtSymLeftBoth | Linker Ton: beidseitig gehört |
| shtSymRightBoth | Rechter Ton: beidseitig gehört |
| shtSymLeftWrong | Linker Ton: auf rechter Seite gehört |
| shtSymRightWrong | Rechter Ton: auf linker Seite gehört |

---

## Schritt 3 — test-ui.js: IIFE nach testUI-Objekt

Das `testUI`-Objekt endet in Zeile 1748 mit `};`.
**Direkt dahinter** (Zeile 1749) folgenden Block einfügen — nichts vorher entfernen:

```js
// ===== testUI.sideCheck — Seitenhoertest =====
(function() {
  var _shtEls     = null;
  var _shtCfg     = null;
  var _shtSuccess = null;
  var _shtAbort   = null;
  var _shtResult  = {};
  var _shtAskSide = null;

  var _shtIdleTimer   = null;
  var _shtIdleEl      = null;
  var _shtIdleMs      = 0;
  var _shtIdleCb      = null;
  var _shtIdleHandler = null;

  function _shtT(key) {
    return (typeof t === 'function' && t(key)) || key;
  }

  function _shtInitDom() {
    if (_shtEls) return;
    var overlay  = _mkEl('div', 'modal-overlay sht-modal');
    var box      = _mkEl('div', 'modal-box');
    var titleEl  = _mkEl('h2');
    titleEl.dataset.t   = 'shtTitle';
    titleEl.textContent = _shtT('shtTitle');
    var msgEl    = _mkEl('p');

    var replayRow = _mkEl('div', 'btn-group');
    var replayBtn = _mkEl('button', 'btn');
    replayBtn.dataset.t   = 'shtBtnReplay';
    replayBtn.textContent = _shtT('shtBtnReplay');
    replayRow.appendChild(replayBtn);

    var ansRow = _mkEl('div', 'btn-group');
    var btnL = _mkEl('button', 'btn'); btnL.dataset.t = 'shtBtnLeft';  btnL.textContent = _shtT('shtBtnLeft');
    var btnR = _mkEl('button', 'btn'); btnR.dataset.t = 'shtBtnRight'; btnR.textContent = _shtT('shtBtnRight');
    var btnB = _mkEl('button', 'btn'); btnB.dataset.t = 'shtBtnBoth';  btnB.textContent = _shtT('shtBtnBoth');
    var btnN = _mkEl('button', 'btn'); btnN.dataset.t = 'shtBtnNone';  btnN.textContent = _shtT('shtBtnNone');
    ansRow.append(btnL, btnR, btnB, btnN);

    var phaseBtns = _mkEl('div', 'sht-phase-btns');
    phaseBtns.style.marginTop = '0.8em';
    phaseBtns.append(replayRow, ansRow);

    var errBtns = _mkEl('div', 'sht-err-btns');
    errBtns.hidden = true;
    errBtns.style.marginTop = '0.8em';
    var errRow = _mkEl('div', 'btn-group');
    var retryBtn = _mkEl('button', 'btn btn-primary');
    retryBtn.dataset.t   = 'shtBtnRetry';
    retryBtn.textContent = _shtT('shtBtnRetry');
    var abortBtn = _mkEl('button', 'btn');
    abortBtn.dataset.t   = 'shtBtnAbort';
    abortBtn.textContent = _shtT('shtBtnAbort');
    errRow.append(retryBtn, abortBtn);
    errBtns.appendChild(errRow);

    box.append(titleEl, msgEl, phaseBtns, errBtns);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    _shtEls = { overlay: overlay, msgEl: msgEl, replayBtn: replayBtn,
                phaseBtns: phaseBtns, errBtns: errBtns,
                retryBtn: retryBtn, abortBtn: abortBtn };

    btnL.onclick      = function() { _shtAnswer('left');  };
    btnR.onclick      = function() { _shtAnswer('right'); };
    btnB.onclick      = function() { _shtAnswer('both');  };
    btnN.onclick      = function() { _shtAnswer('none');  };
    replayBtn.onclick = function() { _shtPlayTone(_shtAskSide); };
    retryBtn.onclick  = function() { _shtRetry(); };
    abortBtn.onclick  = function() { _shtDoAbort(); };
  }

  function _shtPlayTone(side) {
    playToneTyped(gAC(), 1000, 0.25, 1000, side === 'left' ? -1 : 1, 'complex');
  }

  function _shtAsk(side) {
    _shtAskSide = side;
    var key = (_shtCfg.sides === 'one') ? 'shtMsgOne'
            : (side === 'left')         ? 'shtMsgLeft' : 'shtMsgRight';
    _shtEls.msgEl.textContent = _shtT(key);
    _shtEls.phaseBtns.hidden  = false;
    _shtEls.errBtns.hidden    = true;
    _shtPlayTone(side);
  }

  function _shtAnswer(answer) {
    _shtResult[_shtAskSide] = answer;
    if (_shtCfg.sides === 'both' && _shtAskSide === 'left') {
      _shtAsk('right');
    } else {
      _shtEval();
    }
  }

  function _shtEval() {
    var L = _shtResult.left;
    var R = _shtResult.right;
    var msg = '';
    var syms = [];

    if (_shtCfg.sides === 'one') {
      var ans = (_shtCfg.side === 'left') ? L : R;
      if (ans === _shtCfg.side)              { _shtSucceed(); return; }
      if (ans === 'left' || ans === 'right')   msg = _shtT('shtErrFlip');
      else if (ans === 'both')                 msg = _shtT('shtErrBilateral');
      else                                     msg = _shtT('shtErrNone');
    } else {
      if (L === 'left' && R === 'right')     { _shtSucceed(); return; }
      if (L === 'none' || R === 'none') {
        if (L === 'none' && R === 'none') {
          msg = _shtT('shtErrNone');
        } else {
          msg = _shtT('shtErrMissing');
          if (L === 'none') syms.push(_shtT('shtSymLeftNone'));
          if (R === 'none') syms.push(_shtT('shtSymRightNone'));
        }
      } else if (L === 'both' && R === 'both') {
        msg = _shtT('shtErrBilateral');
      } else if ((L === 'left'  && R === 'left') ||
                 (L === 'right' && R === 'right')) {
        msg = _shtT('shtErrAudiolink');
      } else if (L === 'right' && R === 'left') {
        msg = _shtT('shtErrFlip');
      } else {
        msg = _shtT('shtErrMixed');
        if (L === 'none')  syms.push(_shtT('shtSymLeftNone'));
        if (R === 'none')  syms.push(_shtT('shtSymRightNone'));
        if (L === 'both')  syms.push(_shtT('shtSymLeftBoth'));
        if (R === 'both')  syms.push(_shtT('shtSymRightBoth'));
        if (L === 'right') syms.push(_shtT('shtSymLeftWrong'));
        if (R === 'left')  syms.push(_shtT('shtSymRightWrong'));
      }
    }
    if (syms.length) msg += ' ' + syms.join(', ') + '.';
    _shtEls.msgEl.textContent = msg;
    _shtEls.phaseBtns.hidden  = true;
    _shtEls.errBtns.hidden    = false;
  }

  function _shtSucceed() {
    _shtEls.overlay.classList.remove('active');
    var cb = _shtSuccess;
    _shtSuccess = null; _shtAbort = null;
    if (cb) cb();
  }

  function _shtDoAbort() {
    _shtEls.overlay.classList.remove('active');
    var cb = _shtAbort;
    _shtSuccess = null; _shtAbort = null;
    if (cb) cb();
  }

  function _shtRetry() {
    _shtResult = {};
    _shtAsk((_shtCfg.sides === 'one') ? _shtCfg.side : 'left');
  }

  function _shtRun(cfg, onSuccess, onAbort) {
    _shtInitDom();
    _shtCfg     = cfg;
    _shtSuccess = onSuccess;
    _shtAbort   = onAbort;
    _shtResult  = {};
    _shtEls.overlay.classList.add('active');
    _shtAsk(cfg.sides === 'one' ? cfg.side : 'left');
  }

  function _shtResetTimer() {
    if (_shtIdleTimer) clearTimeout(_shtIdleTimer);
    _shtIdleTimer = setTimeout(function() {
      var cb = _shtIdleCb;
      if (cb) cb();
    }, _shtIdleMs);
  }

  function _shtStartIdleWatch(el, ms, onIdle) {
    _shtStopIdleWatch();
    _shtIdleEl      = el;
    _shtIdleMs      = ms;
    _shtIdleCb      = onIdle;
    _shtIdleHandler = function() { _shtResetTimer(); };
    el.addEventListener('pointerdown', _shtIdleHandler, true);
    el.addEventListener('keydown',     _shtIdleHandler, true);
    el.addEventListener('click',       _shtIdleHandler, true);
    _shtResetTimer();
  }

  function _shtStopIdleWatch() {
    if (_shtIdleTimer) { clearTimeout(_shtIdleTimer); _shtIdleTimer = null; }
    if (_shtIdleEl && _shtIdleHandler) {
      _shtIdleEl.removeEventListener('pointerdown', _shtIdleHandler, true);
      _shtIdleEl.removeEventListener('keydown',     _shtIdleHandler, true);
      _shtIdleEl.removeEventListener('click',       _shtIdleHandler, true);
    }
    _shtIdleEl = null; _shtIdleHandler = null; _shtIdleCb = null;
  }

  testUI.sideCheck = {
    run:            _shtRun,
    startIdleWatch: _shtStartIdleWatch,
    stopIdleWatch:  _shtStopIdleWatch
  };
})();
```

**Hinweis zum Kommentar**: Die ASCII-Ersetzungen im Kommentar `// ===== testUI.sideCheck — Seitenhoertest =====`
koennen durch korrekte Umlaute ersetzt werden: `Seitenhörtest`.

---

## Schritt 4 — Bau-Diagnose-Test

In `js/debug-tests-current.js` folgenden Block **am Ende der Datei** (vor dem letzten `)`
der Wrapper-Funktion, analog zu bestehenden Blöcken) einfügen:

```js
// --- BA116: SHT-Infrastruktur ---
(function() {
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
})();
```

---

## Akzeptanztest BA 116

Da der SHT noch an keinen Startbutton angebunden ist, genuegt der
Bau-Diagnose-Test. Sonnet fuehrt nach dem Build die Debug-Panel-Tests
aus (Schritt im Selbstpruefungs-Auftrag).

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Punkt einzeln prüfen und melden
(erfüllt / nicht erfüllt / unklar — mit Datei + Zeile):

1. `APP_VERSION` in `version.js` ist `"3.0.116-beta"`.
2. Alle 23 neuen i18n-Keys in `de.js` vorhanden; kein ASCII-`"` innerhalb
   der String-Werte (nur als äußerer Delimiter).
3. IIFE in `test-ui.js` steht **nach** dem schließenden `};` des `testUI`-Objekts.
4. `_mkEl`, `gAC`, `playToneTyped` werden in der IIFE als Globals genutzt
   (keine lokale Redefinition) — per Grep bestätigen.
5. `testUI.sideCheck.run`, `.startIdleWatch`, `.stopIdleWatch` am Ende
   der IIFE ans `testUI`-Objekt angehängt.
6. Bau-Diagnose-Test in `debug-tests-current.js` eingetragen.
7. Debug-Panel öffnen, Test ausführen → alle drei Checks grün.
   Ergebnis hier melden.

---

*Nächste Anleitung: BAUANLEITUNG_117_seitenhoertest_freqmatch.md*
*Übersetzungen (en/fr/es) in eigener Mini-Anleitung, wenn deutsche GUI steht.*
