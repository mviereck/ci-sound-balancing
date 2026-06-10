# BAUANLEITUNG 117 — Seitenhörtest: freqmatch.js-Migration

Voraussetzung: BA 116 abgeschlossen (`testUI.sideCheck` vorhanden).

Ziel: Alten `_fmHpCheck`-Mechanismus in `freqmatch.js` durch
`testUI.sideCheck.run()` ersetzen. Beide Verfahren (Slider + Adaptiv)
erhalten den SHT vor Teststart. Idle-Watch stoppt den Test nach
5 Minuten ohne Interaktion.

Scope: `js/freqmatch.js`, `i18n/de.js`, `js/version.js`

---

## Schritt 1 — Versionsnummer

`js/version.js`, Zeile 1:

```js
const APP_VERSION = "3.0.117-beta";
```

---

## Schritt 2 — i18n/de.js: alte fmHp*-Keys entfernen

Folgende vier Zeilen (ca. 791–794) **löschen** — sie werden nicht mehr
gebraucht:

```js
    fmHpMsg1: "Auf welcher Seite hören Sie den Ton?",
    fmHpMsg2: "Sie tragen Ihren Kopfhörer möglicherweise falsch herum. Bitte setzen Sie ihn anders herum auf und antworten Sie erneut.",
    fmHpBtnReplay: "Ton wiederholen",
    fmHpBtnCancel: "Abbrechen",
```

---

## Schritt 3 — freqmatch.js: Modulvariable _fmParentEl

Am Anfang der Modul-Variablen (bei den anderen `let`-Deklarationen,
z. B. neben `let fmVarSide`), folgende Zeile einfügen:

```js
let _fmParentEl = null;   // gesetzt im DOMContentLoaded
```

---

## Schritt 4 — freqmatch.js: alte Hp-Funktionen entfernen

Die folgenden drei Funktionen **vollständig löschen**
(ca. Zeilen 43–79, nach dem `_fmSimOffsets`-Kommentar):

```js
// Kopfhörer-Check-Dialog
let _fmHpEls = null;
```
```js
// --- Kopfhörer-Check ---

function _fmHpPlayTone() {
  ...
}

function _fmShowHpCheck(callback) {
  ...
}
```

Entfernt werden: die Variable `_fmHpEls`, beide Funktionen,
die Kommentarzeilen. Der nächste verbleibende Block ist
`// Liefert true, wenn der Empfehlungs-Dialog...`.

---

## Schritt 5 — freqmatch.js: fmStartSlider

`fmStartSlider` (ab Zeile ~1413) **ersetzen**:

**Vorher:**
```js
function fmStartSlider() {
  if (!fmEls) return;
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    fmEls._stopTest();
    return;
  }
  fmSeqIdx    = 0;
  fmRunning   = true;
  fmLoadElectrode();
  _fmStartTimer();
}
```

**Nachher:**
```js
function fmStartSlider() {
  if (!fmEls) return;
  fmRefSide = fmEls.header.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
  fmSeq = fmBuildSeq();
  if (fmSeq.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    fmEls._stopTest();
    return;
  }
  testUI.sideCheck.run(
    { sides: 'one', side: fmVarSide },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}

function _fmDoStartSlider() {
  fmSeqIdx  = 0;
  fmRunning = true;
  fmLoadElectrode();
  _fmStartTimer();
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (fmEls) fmEls._stopTest();
  });
}
```

Die neue Funktion `_fmDoStartSlider` direkt nach `fmStartSlider`
einfügen (vor `fmLoadElectrode`).

---

## Schritt 6 — freqmatch.js: fmStartAdaptive

Am Ende von `fmStartAdaptive` (Zeile ~663) die letzte Zeile ersetzen:

**Vorher (letzte Zeile der Funktion):**
```js
  _fmShowHpCheck(_fmDoStartAdaptive);
```

**Nachher:**
```js
  testUI.sideCheck.run(
    { sides: 'one', side: fmVarSide },
    _fmDoStartAdaptive,
    function() { if (fmEls) fmEls._stopTest(); }
  );
```

---

## Schritt 7 — freqmatch.js: _fmDoStartAdaptive — Idle-Watch

Am Ende von `_fmDoStartAdaptive` (direkt vor der schließenden `}`)
folgende Zeile ergänzen:

```js
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (fmEls) fmEls._stopTest();
  });
```

---

## Schritt 8 — freqmatch.js: fmAbort — Idle-Watch stoppen

`fmAbort` beginnt mit `_fmSimActive = false;` (Zeile ~1515).
**Vor dieser Zeile** einfügen:

```js
  testUI.sideCheck.stopIdleWatch();
```

Ergebnis:
```js
function fmAbort() {
  testUI.sideCheck.stopIdleWatch();
  _fmSimActive = false;
  ...
```

---

## Schritt 9 — freqmatch.js: DOMContentLoaded — Aufräumen

### 9a — _fmParentEl setzen

In `DOMContentLoaded` (ab Zeile ~1802) direkt nach der
`if (!parentEl) return;`-Zeile einfügen:

```js
  _fmParentEl = parentEl;
```

### 9b — _fmHpEls-DOM-Block entfernen

Den gesamten `_fmHpEls`-Aufbau-Block löschen. Er beginnt mit:
```js
  const fmHpDlg = _mkEl('div', 'modal-overlay');
```
und endet mit:
```js
  _fmHpEls = { dlg: fmHpDlg, msgEl: fmHpMsgEl, btnLeft: fmHpBtnLeft, btnReplay: fmHpBtnReplay,
               btnRight: fmHpBtnRight, btnCancel: fmHpBtnCancel };
```
(ca. Zeilen 1955–1978, rund 24 Zeilen). Den Block **komplett löschen**.

### 9c — fmSEBtnSkip.onclick aktualisieren

In `fmSEBtnSkip.onclick` (ca. Zeile 1924–1927):

**Vorher:**
```js
  fmSEBtnSkip.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    _fmShowHpCheck(_fmDoStartAdaptive);
  });
```

**Nachher:**
```js
  fmSEBtnSkip.addEventListener('click', function() {
    fmSEDlg.classList.remove('active');
    testUI.sideCheck.run(
      { sides: 'one', side: fmVarSide },
      _fmDoStartAdaptive,
      function() { if (fmEls) fmEls._stopTest(); }
    );
  });
```

---

## Akzeptanztest

### A — Adaptiver Modus, korrekter Ablauf

1. Tab „Messungen" → Sub-Tab „Frequenzabgleich"
2. Verfahren „Adaptiv" wählen, „Test starten" klicken
   → Erwartet: **Seitenhörtest-Modal erscheint** mit Titel „Seitenhörtest",
     Meldung „Auf welcher Seite hören Sie den Ton?", Ton spielt auf der
     var-Seite, Buttons [Ton wiederholen][Links][Rechts][Beide][Nichts]
3. Richtige Seite anklicken (z. B. Rechts, wenn varSide = right)
   → Erwartet: Modal schließt sich sofort, Test startet (runningTitle,
     Progress sichtbar) — **kein** weiterer Bestätigungs-Knopf

### B — Fehlerfall: falsche Seite

1. Wie A bis Modal erscheint
2. Falsche Seite anklicken (z. B. Links statt Rechts)
   → Erwartet: Fehlermeldung „Kopfhörer möglicherweise falsch herum…",
     Buttons [Wiederholen][Abbruch] sichtbar, Antwort-Buttons verschwunden
3. „Wiederholen" klicken
   → Erwartet: Modal resettet, Ton spielt erneut, Antwort-Buttons wieder da
4. Abbruch klicken
   → Erwartet: Modal schließt sich, Test stoppt (Start-Button wieder aktiv)

### C — Fehlerfall: Nichts gehört

1. Modal erscheint → „Nichts" klicken
   → Erwartet: „Kein Ton gehört. Bitte Audioverbindung und Lautstärke prüfen."

### D — Slider-Modus

1. Verfahren auf „Slider" wechseln, „Test starten"
   → Erwartet: SHT-Modal erscheint (wie A)
2. Richtige Seite → Modal schließt, Slider-Test startet

### E — Alter Code weg

Prüfen (Grep): kein `_fmHpEls`, `_fmHpPlayTone`, `_fmShowHpCheck`
mehr in `freqmatch.js`.

### F — Idle-Watch

Browser-Konsole:
```js
testUI.sideCheck.startIdleWatch(document.getElementById('subpanel-messungen-freqmatch'), 5000, function(){ console.log('IDLE fired'); });
```
5 Sekunden warten ohne Klick → „IDLE fired" erscheint in der Konsole.
Danach `testUI.sideCheck.stopIdleWatch()` ausführen.

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Punkt einzeln prüfen (erfüllt / nicht erfüllt / unklar):

1. `APP_VERSION` ist `"3.0.117-beta"`.
2. `fmHpMsg1`, `fmHpMsg2`, `fmHpBtnReplay`, `fmHpBtnCancel` in `de.js`
   nicht mehr vorhanden (grep).
3. `_fmParentEl` als Modulvariable deklariert, im DOMContentLoaded gesetzt.
4. `_fmHpEls`, `_fmHpPlayTone`, `_fmShowHpCheck` vollständig aus
   `freqmatch.js` entfernt (grep bestätigt keine Treffer).
5. `fmStartSlider` ruft `testUI.sideCheck.run()` auf; `_fmDoStartSlider`
   ist neue Funktion und startet Idle-Watch.
6. `fmStartAdaptive` ruft `testUI.sideCheck.run()` auf (letzter Aufruf
   der Funktion, kein `_fmShowHpCheck` mehr).
7. `_fmDoStartAdaptive` startet Idle-Watch am Ende.
8. `fmAbort` ruft `testUI.sideCheck.stopIdleWatch()` als erste Zeile.
9. `fmSEBtnSkip.onclick` nutzt `testUI.sideCheck.run()`, kein
   `_fmShowHpCheck` mehr.
10. Akzeptanztest A (korrekter Ablauf) manuell durchgeführt —
    Ergebnis hier melden.
