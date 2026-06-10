# Bauanleitung 247-Fix-2 — Elektrodenlautstärke: Lifecycle- und Anzeige-Bugs

## Ziel

Sieben Bugs aus dem Akzeptanztest nach BA 247(/fix1) beheben. Alle haben
eine klare Ursache: Snippets in BA 247 trafen die testUI-API nicht
genau, und drei Lifecycle-Mechaniken (Aufleuchten, Replay-Sperre,
Undo-Button-State) liefen ins Leere, weil sie auf Refs der alten API
zielen.

Die Bugs im Detail:

1. **A/B-Boxen leuchten beim Abspielen nicht.** `updInd` in `audio.js`
   zielt auf `testEls.pairLeft`/`testEls.pairRight` (alte API). In der
   neuen API liegen die Boxen unter
   `testEls.verfahren['full'].pairIndicator.left/right` mit
   CSS-Klassen `.tone-label-left` / `.tone-label-right`
2. **Bei Spacebar wird der zweite Ton zweimal gespielt.** Replay-Button
   hat nach Klick weiterhin Fokus. Spacebar löst sowohl
   Browser-Button-Klick als auch testUI-Keyboard-Handler aus → zwei
   `onReplay → playCur`-Aufrufe → Race in `playSeq`
3. **„Offset bestätigen" und „A↔B" durchgehend disabled.** `playCur`
   ruft `setPlaying('both')` vor dem Tonabspielen, aber **nie**
   `setPlaying(null)` danach. testUI sperrt confirm + swap über
   `_lockTargets` zwischen den beiden Aufrufen → bleiben dauerhaft
   gesperrt. Bug 4 („schnelles Enter hängt") ist eine Folge davon —
   beim ersten Recover kommt der Lock-Zustand aus dem Takt
4. **A/B statt E1/E2.** Mein `setLabels`-Aufruf in BA 247 hat die
   falschen Property-Namen verwendet: `leftLabel`/`rightLabel`/`hzText`
   statt der tatsächlichen API-Namen
   `leftText`/`rightText`/`leftHz`/`rightHz`. Konsequenz: die Werte
   gehen ins Leere, der Default „A"/„B" aus dem testUI-Bau bleibt
   stehen
5. **„Zurück" Button durchgehend disabled, Backspace funktioniert.**
   `updUndo` in `test.js` zielt auf `testEls.undoBtn` (alte API). In
   der neuen API liegt der Button unter `testEls.verfahren['full'].actions.undo`
   und wird vom testUI-Bau mit `disabled = true` initialisiert →
   bleibt dauerhaft disabled, weil `updUndo` ihn nicht findet
6. **Konvergenz-Rundenanzeige weg + Round-Robin-Fortschritt weg.**
   `_testUpdateProgress` (und drei weitere Stellen) rufen
   `testUI.progress.set(refs, "STRING")` auf. Die korrekte Signatur
   ist `set(refs, {text, fraction, timer})`. Da `opts.text` undefined
   ist (weil opts ein String ist), wird kein Text gerendert
7. **„0:00" durchgehend sichtbar.** testUI rendert im progress-Baustein
   automatisch einen `timer-display`-Span mit Default „0:00". Niemand
   pflegt ihn aktiv (auch `lr-balance` nicht). Wird ersatzlos aus
   testUI entfernt

**Undo-Verhalten** (Stack vs. einmalig): Stack-Logik bleibt erhalten
wie heute und wie vor BA 247. Der Fix beschränkt sich darauf, den
Button-State korrekt zu aktualisieren.

## Voraussetzungen

- BA 247 und BA 247-Fix sind gebaut; aktuelle Version: `3.2.247.2-beta`
- i18n: nur Deutsch

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.247.2-beta";

// nachher
const APP_VERSION = "3.2.247.3-beta";
```

## Schritt 2 — Bug 1: `updInd` auf neue API erweitern

`js/audio.js`, Funktion `updInd` (etwa Z. 779–790).

**Suche**:

```js
function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  // Pair-Anzeige über testEls (falls verfügbar)
  const pL = (typeof testEls !== 'undefined' && testEls) ? testEls.pairLeft : document.getElementById("tAL");
  const pR = (typeof testEls !== 'undefined' && testEls) ? testEls.pairRight : document.getElementById("tBL");
  if (pL) pL.classList.toggle("playing", w === "a");
  if (pR) pR.classList.toggle("playing", w === "b");
}
```

**Ersetze durch**:

```js
function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  // Pair-Anzeige: erst neue testUI-API (testEls.verfahren[...].pairIndicator),
  // dann alte API (testEls.pairLeft/pairRight), zuletzt DOM-Fallback.
  let pL = null, pR = null;
  if (typeof testEls !== 'undefined' && testEls) {
    if (testEls.verfahren && typeof _testActiveVerfahren !== 'undefined'
        && testEls.verfahren[_testActiveVerfahren]
        && testEls.verfahren[_testActiveVerfahren].pairIndicator) {
      pL = testEls.verfahren[_testActiveVerfahren].pairIndicator.left;
      pR = testEls.verfahren[_testActiveVerfahren].pairIndicator.right;
    }
    if (!pL && testEls.pairLeft)  pL = testEls.pairLeft;
    if (!pR && testEls.pairRight) pR = testEls.pairRight;
  }
  if (!pL) pL = document.getElementById("tAL");
  if (!pR) pR = document.getElementById("tBL");
  if (pL) pL.classList.toggle("playing", w === "a");
  if (pR) pR.classList.toggle("playing", w === "b");
}
```

Hinweis: `_testActiveVerfahren` ist in `js/test.js` deklariert. Der
typeof-Guard fängt Module ab, in denen die Variable nicht existiert
(z.B. in Tests des Implantat-Reiters), ohne ReferenceError.

## Schritt 3 — Bug 3+4: `playCur` ruft `setPlaying(null)` nach Sequenz-Ende

`js/test.js`, Funktion `playCur` (etwa Z. 884–895).

**Suche**:

```js
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  // BA 247: Slider-Wert ist direkt die absolute Korrektur (curBase = 0).
  playSeq(curA, curB, _testSliderVal());
  curPlayed = true;
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
}
```

**Ersetze durch**:

```js
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  // BA 247fix2: setPlaying('both') setzt die Replay-Sperre (lock_targets:
  // confirm, swap). Das Aufleuchten der einzelnen Box (left|right) macht
  // updInd in playSeq weiter. Am Ende der Sequenz wird die Sperre via
  // setPlaying(null) wieder aufgehoben.
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
  curPlayed = true;
  playSeq(curA, curB, _testSliderVal()).then(function() {
    if (vref && vref.pairIndicator) {
      testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
    }
  });
}
```

`playSeq` ist async und liefert ein Promise. Mit `.then(...)` läuft
das `setPlaying(null)` zuverlässig nach Ende der A-(Pause)-B-(Pause-A)-
Sequenz, auch wenn sie durch `stopAll()` (über `if (!isPlay) return`
in `playSeq`) abgekürzt wurde — `playSeq` returnt dann ebenfalls.

Achtung: das `setPlaying('both')` setzt zwar beide Boxen kurz auf
`.playing`, aber `updInd(eA, "a")` innerhalb von `playSeq` schaltet
das sofort um (Schritt 2 macht `updInd` API-tauglich). Die
Replay-Sperre bleibt aktiv solange die Sequenz läuft, weil
`setPlaying(null)` erst nach Sequenz-Ende kommt.

## Schritt 4 — Bug 5: `setLabels` mit korrekten Property-Namen

`js/test.js`, zwei Stellen.

### 4a — in `showCurPair` (etwa Z. 811–817)

**Suche**:

```js
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftLabel:  dENPrefix() + dEN(curA),
      rightLabel: dENPrefix() + dEN(curB),
      hzText:     Math.round(effFreq(curA)) + " Hz vs. " + Math.round(effFreq(curB)) + " Hz"
    });
  }
```

**Ersetze durch**:

```js
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(curA),
      rightText: dENPrefix() + dEN(curB),
      leftHz:    Math.round(effFreq(curA)),
      rightHz:   Math.round(effFreq(curB))
    });
  }
```

### 4b — in `_testSwap` (etwa Z. 701–707)

**Suche**:

```js
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftLabel:  dENPrefix() + dEN(curA),
      rightLabel: dENPrefix() + dEN(curB),
      hzText:     Math.round(effFreq(curA)) + " Hz vs. " + Math.round(effFreq(curB)) + " Hz"
    });
  }
```

**Ersetze durch**:

```js
  if (vref && vref.pairIndicator) {
    // BA 247fix2: korrekte Property-Namen der testUI-setLabels-API.
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftText:  dENPrefix() + dEN(curA),
      rightText: dENPrefix() + dEN(curB),
      leftHz:    Math.round(effFreq(curA)),
      rightHz:   Math.round(effFreq(curB))
    });
  }
```

## Schritt 5 — Bug 6: `updUndo` auf neue API umstellen

`js/test.js`, Funktion `updUndo` (etwa Z. 949–952).

**Suche**:

```js
function updUndo() {
  if (testEls && testEls.undoBtn)
    testEls.undoBtn.disabled = testIdx <= 0 || !undoSt.length;
}
```

**Ersetze durch**:

```js
function updUndo() {
  // BA 247fix2: Undo-Button liegt in der neuen API unter
  // testEls.verfahren[<id>].actions.undo, nicht direkt auf testEls.
  if (!testEls || !testEls.verfahren) return;
  var vref = testEls.verfahren[_testActiveVerfahren];
  var btn = vref && vref.actions && vref.actions.undo;
  if (btn) btn.disabled = testIdx <= 0 || !undoSt.length;
}
```

Stack-Logik bleibt unverändert. Der Button spiegelt jetzt korrekt den
Stack-Zustand: nach einem Undo, das den Stack leert oder `testIdx` auf
0 zieht, wird er disabled.

## Schritt 6 — Bug 7+8+10: `progress.set` mit Objekt-Signatur

Vier Stellen in `js/test.js`.

### 6a — in `_testUpdateProgress` (etwa Z. 842–863)

**Suche**:

```js
function _testUpdateProgress() {
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.progress) return;
  if (_testActiveVerfahren === "full") {
    var s = sideData[activeSide];
    var rrTable = ROUND_ROBIN[nEl];
    if (rrTable) {
      var maxRounds = rrTable.length;
      var pairsPerRound = rrTable[0].length;
      var completedRounds = (s.fullSweepRound || 1) - 1;
      var totalPairs = maxRounds * pairsPerRound;
      var n = completedRounds * pairsPerRound + testIdx + 1;
      testUI.progress.set(vref.progress,
        t("comp") + " " + n + " " + t("of") + " " + totalPairs +
        ". " + t("round") + " " + (s.fullSweepRound || 1) + " " + t("of") + " " + maxRounds);
    }
  } else {
    testUI.progress.set(vref.progress,
      t("comp") + " " + (testIdx + 1) + " " + t("of") + " " + testPairs.length +
      (convRnd > 0 ? " (" + t("round") + " " + convRnd + ")" : ""));
  }
}
```

**Ersetze durch**:

```js
function _testUpdateProgress() {
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.progress) return;
  if (_testActiveVerfahren === "full") {
    var s = sideData[activeSide];
    var rrTable = ROUND_ROBIN[nEl];
    if (rrTable) {
      var maxRounds = rrTable.length;
      var pairsPerRound = rrTable[0].length;
      var completedRounds = (s.fullSweepRound || 1) - 1;
      var totalPairs = maxRounds * pairsPerRound;
      var n = completedRounds * pairsPerRound + testIdx + 1;
      // BA 247fix2: progress.set erwartet ein opts-Objekt, kein String.
      testUI.progress.set(vref.progress, {
        text: t("comp") + " " + n + " " + t("of") + " " + totalPairs +
              ". " + t("round") + " " + (s.fullSweepRound || 1) + " " + t("of") + " " + maxRounds,
        fraction: n / totalPairs
      });
    }
  } else {
    testUI.progress.set(vref.progress, {
      text: t("comp") + " " + (testIdx + 1) + " " + t("of") + " " + testPairs.length +
            (convRnd > 0 ? " (" + t("round") + " " + convRnd + ")" : ""),
      fraction: (testIdx + 1) / Math.max(1, testPairs.length)
    });
  }
}
```

### 6b — in `nextConvRnd` (etwa Z. 1009–1014)

**Suche**:

```js
  // BA 247: Progress laeuft ueber testUI.progress.set
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress,
      t("round") + " " + convRnd + " – " + mg.length + " (max res: " + mx.toFixed(1) + " dB)");
  }
```

**Ersetze durch**:

```js
  // BA 247fix2: progress.set erwartet ein opts-Objekt.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress, {
      text: t("round") + " " + convRnd + " – " + mg.length + " (max res: " + mx.toFixed(1) + " dB)",
      fraction: 0
    });
  }
```

### 6c — in `doExcl` (etwa Z. 1022–1027)

**Suche**:

```js
  // BA 247: Progress laeuft jetzt ueber den testUI-Progress-Baustein.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress,
      dENPrefix() + dEN(i) + " " + t("exclDuring") + ". " +
      (testPairs.length - testIdx) + " " + t("pairsRem") + ".");
  }
```

**Ersetze durch**:

```js
  // BA 247fix2: progress.set erwartet ein opts-Objekt.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress, {
      text: dENPrefix() + dEN(i) + " " + t("exclDuring") + ". " +
            (testPairs.length - testIdx) + " " + t("pairsRem") + "."
    });
  }
```

## Schritt 7 — Bug 2: Replay-Button (und andere) blur'en nach Klick

`js/test-ui.js`, im `actions`-Block (etwa Z. 1440–1481). Der Fix
betrifft alle action-Buttons (undo, replay, simul, swap), nicht nur
replay — der Bug-Mechanismus (Fokus → Browser-Click bei Space/Enter
zusätzlich zum Keyboard-Handler) gilt für alle. Lösung: in der
`forEach`-Schleife einen `mousedown`-Listener registrieren, der den
Fokus nach dem Klick entfernt.

**Suche** (Anfang der actions-Schleife, etwa Z. 1438):

```js
      body.actions.forEach(function(actSpec) {
        // BA 246: Eintrag darf String oder { kind, labelKey } sein.
        var act      = (typeof actSpec === 'string') ? actSpec : actSpec.kind;
        var labelKey = (typeof actSpec === 'string') ? null    : actSpec.labelKey;
        var btn = _mkEl('button', 'btn btn-sm');
        btn.type = 'button';
        btn.dataset.action = act;
```

**Ersetze durch**:

```js
      body.actions.forEach(function(actSpec) {
        // BA 246: Eintrag darf String oder { kind, labelKey } sein.
        var act      = (typeof actSpec === 'string') ? actSpec : actSpec.kind;
        var labelKey = (typeof actSpec === 'string') ? null    : actSpec.labelKey;
        var btn = _mkEl('button', 'btn btn-sm');
        btn.type = 'button';
        btn.dataset.action = act;
        // BA 247fix2: Fokus nach Klick entfernen, sonst loest die Leertaste
        // doppelt aus (Browser-Click auf focussierten Button + testUI-Keyboard).
        btn.addEventListener('mouseup', function() { btn.blur(); });
```

Den Confirm-Button im `confirmButton`-Block (etwa Z. 1395–1412)
analog behandeln.

**Suche** (im confirmButton-Block):

```js
    if (body.confirmButton) {
      var confirmBtn = _mkEl('button', 'btn btn-primary');
      confirmBtn.type = 'button';
      _tEl(confirmBtn, body.confirmButton.key);
      vWrap.appendChild(confirmBtn);
      refs.confirmButton = confirmBtn;
      if (vCfg.hooks && vCfg.hooks.onConfirm) {
        confirmBtn.addEventListener('click', function() { vCfg.hooks.onConfirm(); });
      }
    }
```

(Falls dein Code dort leicht abweicht: ein `addEventListener('mouseup',
function() { confirmBtn.blur(); });` direkt nach `vWrap.appendChild(confirmBtn);`
ergänzen.)

**Ersetze durch**:

```js
    if (body.confirmButton) {
      var confirmBtn = _mkEl('button', 'btn btn-primary');
      confirmBtn.type = 'button';
      _tEl(confirmBtn, body.confirmButton.key);
      vWrap.appendChild(confirmBtn);
      refs.confirmButton = confirmBtn;
      // BA 247fix2: Fokus nach Klick entfernen, sonst loest Enter den Button
      // doppelt aus (Browser-Click + testUI-Keyboard).
      confirmBtn.addEventListener('mouseup', function() { confirmBtn.blur(); });
      if (vCfg.hooks && vCfg.hooks.onConfirm) {
        confirmBtn.addEventListener('click', function() { vCfg.hooks.onConfirm(); });
      }
    }
```

## Schritt 8 — Bug 9: Timer-Display komplett aus testUI entfernen

`js/test-ui.js`, zwei Code-Bereiche.

### 8a — Bau des Timer-Spans im progress-Baustein (etwa Z. 1193–1204)

**Suche**:

```js
    // --- progress ---
    if (body.progress) {
      var pbWrap = _mkEl('div', 'progress-bar');
      var pbFill = _mkEl('div', 'progress-fill');
      pbWrap.appendChild(pbFill);
      var pbText = _mkEl('div', 'progress-text');
      var pbTimer = _mkEl('span', 'timer-display');
      pbTimer.textContent = '0:00';
      pbText.appendChild(pbTimer);
      vWrap.append(pbWrap, pbText);
      refs.progress = { fill: pbFill, text: pbText, timer: pbTimer };
    }
```

**Ersetze durch**:

```js
    // --- progress ---
    if (body.progress) {
      var pbWrap = _mkEl('div', 'progress-bar');
      var pbFill = _mkEl('div', 'progress-fill');
      pbWrap.appendChild(pbFill);
      var pbText = _mkEl('div', 'progress-text');
      vWrap.append(pbWrap, pbText);
      // BA 247fix2: timer-Span entfaellt (niemand pflegt ihn aktiv).
      refs.progress = { fill: pbFill, text: pbText };
    }
```

### 8b — `progress.set`-Helfer (etwa Z. 1972–1997)

**Suche**:

```js
    set: function(els, opts) {
      if (!els) return;
      if (opts.fraction !== undefined && els.fill) {
        els.fill.style.width = Math.max(0, Math.min(1, opts.fraction)) * 100 + '%';
      }
      if (opts.text !== undefined && els.text) {
        // text ersetzt den Inhalt (Timer bleibt als separates Element)
        // Nur Textknoten aktualisieren, timer-Span bleibt
        var tn = els.text.firstChild;
        if (tn && tn.nodeType === 3) {
          tn.textContent = opts.text + ' ';
        } else {
          els.text.insertBefore(document.createTextNode(opts.text + ' '), els.text.firstChild);
        }
      }
      if (opts.timer !== undefined && els.timer) {
        els.timer.textContent = opts.timer;
      }
    }
```

**Ersetze durch**:

```js
    set: function(els, opts) {
      if (!els) return;
      if (opts.fraction !== undefined && els.fill) {
        els.fill.style.width = Math.max(0, Math.min(1, opts.fraction)) * 100 + '%';
      }
      if (opts.text !== undefined && els.text) {
        // BA 247fix2: Timer-Span entfaellt; Text darf den ganzen Inhalt setzen.
        els.text.textContent = opts.text;
      }
    }
```

### 8c — Hinweis zu lr-balance/freqmatch/latency

Diese drei Module rufen `progress.set` heute nur mit `{fraction, text}`
auf (lr-balance Z. 285), nicht mit `timer:`. Der Wegfall des
Timer-Branches bricht sie nicht. Vor Build trotzdem mit
`grep -n "progress\.set" js/freqmatch.js js/lr-balance.js js/latency.js`
verifizieren, daß kein Aufruf eine `timer:`-Property mitgibt.

## Schritt 9 — Akzeptanztest

1. **Browser-Cache leeren, Anwendung neu laden**
   Konsole: kein Fehler. `3.2.247.3-beta` sichtbar.

2. **Sub-Tab Elektrodenlautstärke, Test starten (Round Robin)**
   - Pair-Indicator zeigt **„E1"** und **„E2"** (oder die jeweiligen
     Elektroden-Nummern), nicht „A"/„B"
   - Beim Abspielen leuchtet zuerst die linke Box (A), dann die rechte
     Box (B). Bei ABA: linke Box am Schluß nochmal
   - Fortschrittsbalken füllt sich, darunter Text der Form
     „Vergleich n von N. Runde X von Y"
   - **Kein** „0:00" sichtbar

3. **„Offset bestätigen" klickbar während/nach Sequenz**
   Nach Sequenz-Ende ist der Button enabled (vorher gesperrt während
   Tonabspielen). Klick speichert den Wert, nächstes Paar erscheint.

4. **„A↔B" klickbar nach Sequenz**
   Button enabled nach Sequenz-Ende. Klick tauscht die Bezeichnungen
   (E1 ↔ E2) und negiert den Slider-Wert.

5. **„Zurück" Button verhält sich richtig**
   - Vor erstem Bestätigen: disabled
   - Nach erstem Bestätigen: enabled
   - Nach Klick auf „Zurück": springt zurück, Slider auf altem
     Wert. Button bleibt enabled, solange `undoSt` noch Einträge hat,
     wird disabled wenn der Stack leer ist
   - Backspace und Button-Klick zeigen exakt das gleiche Verhalten
     (Stack-Logik, mehrfach möglich)

6. **Spacebar wiederholt nicht doppelt**
   Während ein Trial läuft: Leertaste drücken — Sequenz wird einmal
   wiederholt, nicht zweimal. Auch direkt nach Klick auf „Nochmal":
   nochmal Leertaste → einmal.

7. **Enter mehrfach in schneller Folge**
   Während die Sequenz noch spielt: Enter mehrfach drücken. Erwartet:
   Confirm reagiert nur, wenn die Sequenz fertig ist (Replay-Sperre);
   nach Sequenz-Ende greift der erste Enter. Kein Hängen.

8. **Konvergenz-Verfahren**
   Vorher mindestens eine Round-Robin-Runde abschließen. Verfahren
   auf „Konvergenz" wechseln, Start. Fortschrittsbalken füllt sich;
   Text der Form „Runde 1 – N (max res: X.X dB)". Nach Abschluß: Test
   endet.

9. **Sub-Tab Stereo-Balance unverändert**
   Test starten, Pair-Indicator zeigt „Links"/„Rechts". Aufleuchten
   linke Box dann rechte Box. Confirm-Button funktioniert wie vorher.
   Fortschrittsbalken füllt sich. **Kein** „0:00" sichtbar (war es
   vorher auch, wird jetzt nicht mehr gerendert).

10. **Sub-Tab Frequenzabgleich unverändert**
    Adaptive und Slider beide spielbar. Pair-Indicator-Aufleuchten
    funktioniert wie vorher.

11. **Sub-Tab Latenz unverändert**
    Test starten, Klicks hörbar.

## Schritt 10 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–11
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Fünf Pflicht-Checks vor Build-Abschluß:

- **Niemand setzt `progress.timer` mehr**:
  ```
  grep -rn "progress.timer\|\.timer\s*=\|opts.timer" js/
  ```
  Erwartet: keine Treffer mehr außer im Helfer-Body (der jetzt ohne
  Timer auskommt).
- **`progress.set` wird überall mit Objekt aufgerufen**:
  ```
  grep -rn "testUI\.progress\.set" js/
  ```
  Jeder Aufruf muß als zweites Argument `{...}` haben, keinen String.
- **`testEls.pairLeft` / `testEls.undoBtn` werden nirgendwo mehr
  gelesen** (ausgenommen Definition in alter API `_buildTestPanelOld`,
  die in BA 248 sowieso wegfällt):
  ```
  grep -rn "testEls\.pairLeft\|testEls\.pairRight\|testEls\.undoBtn" js/
  ```
  In `audio.js` darf nach Fix Schritt 2 nur noch der Fallback-Pfad
  Treffer haben; in `test.js` keine.
- **Andere Sub-Reiter testen**: vor der Übergabe Sub-Tabs
  Stereo-Balance, Frequenzabgleich, Latenz je einmal kurz öffnen und
  einen Trial starten. Erwartet: kein JS-Fehler in der Konsole,
  Pair-Indicator-Aufleuchten funktioniert dort wie bisher.
- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.247.3-beta`.
