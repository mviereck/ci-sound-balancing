# BA 255 — Seitenabfrage vor Test-Start: Elektrodenlautstärke und Stereo-Balance

Status: ENTWURF (noch nicht im Bau).

Voraussetzung: BA 252, 253, 254 sind gebaut.

## Ziel

Vor dem Start eines Tests soll der Seitenabfrage-Dialog erscheinen
und beide Seiten (links und rechts) prüfen — analog zu Latenz (seit
BA 223) und Frequenzabgleich. Heute fehlt das bei:

- Test Elektrodenlautstärke (`test`)
- Test Stereo-Balance (`balance`)

In beiden Fällen wird `testUI.sideCheck.run({sides:'both'}, onOk, onCancel)`
um den eigentlichen Startcode gewickelt.

## Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.2.255-beta";
```

## Änderungen

### 1) `js/test.js` — onStart-Hooks für `full` und `conv` wrappen

Heute (Z. ca. 1170–1188 im `buildTestPanel`-cfg):

```js
      {
        id: 'full',
        labelKey:   'testVerfahrenFull',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            _testActiveVerfahren = 'full';
            startTestFull();
          }
        }, _testHooksCommon())
      },
      {
        id: 'conv',
        labelKey:   'testVerfahrenConv',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            _testActiveVerfahren = 'conv';
            startTestConv();
          }
        }, _testHooksCommon())
      }
```

ersetzen durch (jeweils die `onStart`-Funktion mit `sideCheck.run`
wrappen):

```js
      {
        id: 'full',
        labelKey:   'testVerfahrenFull',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            // BA 255: Seitenabfrage vor eigentlichem Start.
            testUI.sideCheck.run(
              { sides: 'both' },
              function() {
                _testActiveVerfahren = 'full';
                startTestFull();
              },
              function() {
                // Abbruch: testUI stoppt sich selbst, hier nichts weiter zu tun.
                if (testEls && testEls._stopTest) testEls._stopTest();
              }
            );
          }
        }, _testHooksCommon())
      },
      {
        id: 'conv',
        labelKey:   'testVerfahrenConv',
        explainKey: null,
        body: _testBody(),
        hooks: Object.assign({
          onStart: function() {
            // BA 255: Seitenabfrage vor eigentlichem Start.
            testUI.sideCheck.run(
              { sides: 'both' },
              function() {
                _testActiveVerfahren = 'conv';
                startTestConv();
              },
              function() {
                if (testEls && testEls._stopTest) testEls._stopTest();
              }
            );
          }
        }, _testHooksCommon())
      }
```

### 2) `js/lr-balance.js` — `lrHookOnStart` mit `sideCheck.run` wrappen

Heute (Z. 662–682):

```js
function lrHookOnStart() {
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('lrBlockedSideUnknown'));
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  // Resume: Sequenz und Position erhalten, nur Zustand wieder hochfahren
  if (!lrSeq || !lrSeq.length || lrSeqIdx >= lrSeq.length) {
    lrBuildSequence();
  }
  if (!lrSeq.length) {
    alert(t("lrNoElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  lrRunning = true;
  lrUndoStack = [];
  lockTestTabs(true, 'balance');
  lrShowPair();
}
```

ersetzen durch (Vorprüfung `isSideUsable` und Sequenzbau bleiben in
einer inneren Funktion; die Seitenabfrage geht voran):

```js
function lrHookOnStart() {
  // BA 255: Seitenabfrage vor eigentlichem Start.
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      _lrDoStart();
    },
    function() {
      if (lrEls && lrEls._stopTest) lrEls._stopTest();
    }
  );
}

function _lrDoStart() {
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('lrBlockedSideUnknown'));
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  // Resume: Sequenz und Position erhalten, nur Zustand wieder hochfahren
  if (!lrSeq || !lrSeq.length || lrSeqIdx >= lrSeq.length) {
    lrBuildSequence();
  }
  if (!lrSeq.length) {
    alert(t("lrNoElMsg") || "Keine gemeinsamen aktiven Elektroden gefunden.");
    if (lrEls && lrEls._stopTest) lrEls._stopTest();
    return;
  }
  lrRunning = true;
  lrUndoStack = [];
  lockTestTabs(true, 'balance');
  lrShowPair();
}
```

## Nicht ändern

- `js/freqmatch.js`, `js/latency.js`: Seitenabfrage ist dort
  bereits etabliert.
- `js/test-ui.js`: `testUI.sideCheck.run` ist seit BA 223 / 116
  vorhanden, keine API-Erweiterung nötig.

## i18n

Keine neuen Keys.

## Akzeptanztest

**Elektrodenlautstärke:**

1. Reiter Messungen → Sub-Reiter Elektrodenlautstärke.
2. Voreinstellungen wählen, „Test starten" klicken.
3. **Erwartet:** Bevor der Test losläuft, erscheint ein Seitenabfrage-
   Dialog. Er fragt links und rechts ab. Mit OK bestätigen.
4. **Erwartet:** Test läuft an wie bisher (Pair-Indicator, Slider,
   Status-Grid).
5. Test stoppen, erneut „Test starten" klicken, im Dialog
   „Abbrechen". **Erwartet:** Test startet nicht; Stop-/Start-Button
   sind wieder im Ausgangszustand.

**Stereo-Balance:**

6. Reiter Messungen → Sub-Reiter Stereo-Balance.
7. „Test starten" klicken.
8. **Erwartet:** Seitenabfrage-Dialog (beide Seiten) erscheint vor
   dem eigentlichen Test.
9. OK → Test läuft, L/R-Indikator leuchtet beim Tonabspielen wie
   bisher.
10. Test stoppen, erneut „Test starten", im Dialog „Abbrechen".
    **Erwartet:** Test startet nicht; Stop-/Start-Button im
    Ausgangszustand.

**Regression:**

11. Reiter Messungen → Sub-Reiter Frequenzabgleich → Start →
    Seitenabfrage erscheint wie bisher.
12. Reiter Messungen → Sub-Reiter Latenz → Start → Seitenabfrage
    erscheint wie bisher.

## Selbstprüfung an Sonnet

Vor Fertig-Meldung jede Akzeptanz-Kriterie 1.–12. einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

Zusätzlich vor Versand prüfen:

- `js/test.js`: beide `onStart`-Funktionen rufen
  `testUI.sideCheck.run({sides:'both'}, ok, cancel)` auf; im
  Cancel-Callback wird `testEls._stopTest()` aufgerufen.
- `js/lr-balance.js`: `lrHookOnStart` enthält nur den `sideCheck.run`-
  Wrapper. Der frühere Funktionsrumpf liegt in `_lrDoStart`.
- `js/version.js` zeigt `"3.2.255-beta"`.
- ASCII-Quotes in allen Code-Stellen.

## Hinweis am Ende

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen,
wenn der Nutzer dazu auffordert.
