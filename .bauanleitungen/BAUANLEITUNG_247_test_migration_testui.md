# Bauanleitung 247 — Elektrodenlautstärke: Migration test.js auf neue testUI-API

## Ziel

Migration von `js/test.js` auf die neue testUI-API. Damit nutzt
`test.js` als letzter Sub-Reiter den neuen Build-Pfad
`_buildTestPanelNew`. Mit dieser BA ist die testUI-Migration aus
Aufrufer-Sicht abgeschlossen; das tatsächliche Löschen des alten
API-Codes passiert in BA 248.

Die testUI-API-Anpassungen (swap-`labelKey`, Wegfall des historischen
`lsHint`-Blocks in `_buildTestPanelNew`) sowie der neue State
`toneType_test` mit Save/Load-Pfad sind bereits in BA 246 gebaut —
diese BA nutzt sie nur.

**Was sich gleichzeitig funktional ändert** (mit dem Nutzer im
Konzept abgestimmt — kein Status quo):

- Modi-Auswahl `balance`/`judgment` entfällt; `judgment`-Verfahren
  (3-Knopf-Urteil) ersatzlos raus
- Laufart-Optionen `selective` (Spezial: Round Robin mit Vorauswahl)
  und `manual` (Manuelle Paar-Wahl) entfallen. Statt `selective`
  übernimmt die Elektroden-Auswahl im Header
  (`electrodeSelection`) die Filterung
- Laufarten bleiben: Round Robin (`full`) und Konvergenz (`conv_fast`)
  — als zwei eigenständige Verfahren in der testUI-Config
- Konfidenz-Eingabe entfällt komplett (war nie persistiert)
- Tonart wechselt von globalem Dropdown (`globalToneType`) auf eigene
  Persistenz (`toneType_test`, Popup-Dialog wie Freqmatch)
- LS-Hint sitzt jetzt über dem Slider (durch `rangeHint` statt
  historischem `lsHint`-Block)
- Slider-Startwert: bei bereits gemessenem Paar **auf dem
  gespeicherten Wert** (heute: in der Mitte mit Sockel); bei
  ungemessenem Paar auf 0 (heute: auf LS-Schätzung). Damit ist
  `curBase` immer 0 — kein Sockel mehr
- `cumulativeDisplay` und `instruction` entfallen aus dem Body
  (Anzeige durch `sliderValue` ausreichend; Lauf-Hinweis ist jetzt
  Teil des Intros)
- Intro neu komponiert: nur noch zwei Paragraphen
  (`testMaturityHint`, `testIntro`); alle bisherigen Recommends/Various
  sind in `testIntro` aufgegangen
- `isSideUsable`-Alert in `startTest` entfällt (Tab ist über
  `tabLockApply` ohnehin gesperrt, doppelter Check)

**Nicht in dieser BA** (für BA 248):

- `_buildTestPanelOld` und der gesamte alte API-Code in `test-ui.js`
- Tote i18n-Keys
- Anpassung `docs/CODESTRUKTUR.md` / `docs/spec/02-messung.md` /
  `docs/spec/00-testui-architektur.md`

## Voraussetzungen

- BA 246 ist abgenommen und im Browser getestet
- aktuelle Version vor dem Bau: `3.2.246-beta`
- `toneType_test` ist als State in `state-side.js` deklariert; Save/Load
  in `file.js` ist eingebaut; testUI-API kennt `swap` mit `labelKey`;
  der `lsHint`-Block ist aus `_buildTestPanelNew` entfernt
- i18n: nur Deutsch (`i18n/de.js`); Übersetzungen für en/fr/es werden
  in dieser BA **nicht** mitgeschrieben

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.246-beta";

// nachher
const APP_VERSION = "3.2.247-beta";
```

## Schritt 2 — i18n: testIntro neu, zwei neue Verfahrens-Labels

`i18n/de.js`:

**Schritt 2a** — `testIntro` ersetzen (etwa Z. 801).

**Suche**:

```js
    testIntro: "Dieser Test vergleicht die Lautstärke der Elektroden miteinander. Finales Ziel ist es, eine ausgeglichene Lautstärke für alle Elektroden zu finden.<br> - Dies ist die wichtige Basis für alle weiteren Optimierungen, sei es Musikhören oder Sprachverständlichkeit.",
```

**Ersetze durch** (Mehrzeilen-String; innere ASCII-`"`-Zeichen
escaped):

```js
    testIntro:
      "Dieser Test vergleicht die Lautstärke der Elektroden miteinander. " +
      "Ziel ist es, eine ausgeglichene Lautstärke für alle Elektroden zu finden." +
      "<br> - Dies ist bereits eine gute Einstellung für Naturgeräusche und Musik." +
      "<br> - Die korrigierte Lautstärke über alle Elektroden hinweg ist die saubere Basis " +
      "für alle weiteren Anpassungen, insbesondere für Sprachverständlichkeit, die später " +
      "im Reiter \"Kurven\" eingestellt werden kann." +
      "<br><br>Empfehlungen:" +
      "<br> 1. Stellen Sie die Lautstärke so ein, daß es etwa 3/4 laut ist. " +
      "Also mehr als nur mittel, aber noch nicht unangenehm laut." +
      "<br> 2. Nutzen Sie möglichst Bluetooth zum Streamen." +
      "<br> 3. Machen Sie erst einen Test \"Round Robin (Vollständig)\", dann einmal " +
      "oder mehrfach den Test \"Konvergenz\". (Der Konvergenztest überprüft noch einmal " +
      "die Elektrodenpaare mit der größten Meßunsicherheit.)" +
      "<br> 4. Ein blauer Balken über dem Slider zeigt an, in welchem Bereich der Test " +
      "den nächsten korrekten Wert vermutet. Dies können Sie als Anhaltspunkt nehmen. " +
      "Verlassen Sie sich nicht zu sehr darauf." +
      "<br><br>Weitere Hinweise:" +
      "<br> - Sie können die Tests jederzeit unterbrechen und später an gleicher Stelle weiterführen." +
      "<br> - Der Test \"Round Robin\" läuft über einige Runden. Nach etwa 3 bis 4 Runden " +
      "können Sie im Reiter \"Meßergebnisse\" schon in etwa sehen, wohin Ihre Messung führt." +
      "<br> - Wenn eine Elektrode sich im Laufe des Tests als unmeßbar erweist (zu leise, " +
      "inaktiv), markieren Sie sie entsprechend im Reiter \"Implantat\". Sie wird dann vom " +
      "Test ausgeschlossen." +
      "<br><br>Passen Sie die Lautstärke der beiden Töne an, bis sie sich gleich laut anhören.",
```

**Schritt 2b** — neue Labels für die zwei Verfahren im
Verfahren-Dropdown. An einer beliebigen passenden Stelle in der
Sektion mit Test-Texten (z.B. direkt nach `testIntro`):

```js
    // BA 247: Verfahren-Labels fuer Elektrodenlautstaerke (zwei Verfahren).
    testVerfahrenFull: "Round Robin (Vollständig)",
    testVerfahrenConv: "Konvergenz",
```

Die bisherigen Schlüssel (`testExplainRecommend`, `testExplainVarious`,
`testRunningHint`, `runExpl*`, `optJdg`, `optBal`, `optSel`, `optMan`,
`optFull`, `optCF`, `lblMode`, `lblRun`, `selChange`, `selDlg*`,
`selSummary*`, `selectiveEnd`, `manComp`, `cnf*`, `confidenceLabel*`,
`confidenceNotStored`, `testRunningTitle`, `testBlockedSideUnknown`)
**nicht** löschen — das passiert in BA 248. Hier nur überschreiben,
was tatsächlich überschrieben werden muß.

## Schritt 3 — test.js: Löschen (ersatzlos)

In `js/test.js` folgende Funktions- und Variablendefinitionen
ersatzlos löschen:

- Z. 666–667: `const TEST_SLIDER_RANGES`, `let testSlRangeIdx`
- Z. 668–670: Konstanten `LS_HINT_BASIS_DB`, `LS_HINT_K`
  **bleiben** — sie werden in `getLsEstimate` weiter genutzt
- Z. 673–681: `function _testRstSlR()`
- Z. 682–693: `function _testExtSlider()`
- Z. 694–700: `function _testCheckExtend()`
- Z. 701–728: `let selectiveElectrodes`, Block-Kommentar
  „SELEKTIVES ROUND ROBIN — Elektroden-Vorauswahl",
  `_selectivePairsFromRR`, `_selectiveUpdateSummary`
- Z. 730–807: `function _selectiveOpenDialog()`
- Z. 809–820: `function _testUpdCumulative()`
- Z. 821–851: `function _testUpdLsHint()`
- Z. 1032–1038: `function showMode()`
- Z. 1107–1122: `function recJdg()`
- Z. 1288–1334: `function playManPair()`, `function afterManRes()`
- Z. 1339–1350: `function updateRunExplain()`

## Schritt 4 — test.js: Modifizieren

### 4a — `startTest` (Z. 894–1017) → zwei Hook-Funktionen

Den ganzen `startTest`-Block (Z. 894–1017) durch die folgenden zwei
Funktionen plus Filter-Helfer ersetzen:

```js
// BA 247: Round-Robin-Start (frueher 'full' in startTest)
function startTestFull() {
  if (!testEls) return;
  testMode = "balance";
  var s = sideData[activeSide];
  var rrTable = ROUND_ROBIN[nEl];
  var p;
  if (!rrTable) {
    p = allPairs();
  } else {
    if (s.fullSweepRound === null) {
      s.fullSweepRound = 1;
      s.fullSweepDonePairs = [];
    }
    fullSweepRound = s.fullSweepRound;
    fullSweepDonePairs = s.fullSweepDonePairs;
    var roundPairs = rrTable[fullSweepRound - 1];
    var actSet = new Set(actEl());
    var available = roundPairs.filter(function(p) {
      return actSet.has(p[0]) && actSet.has(p[1]);
    });
    var doneSet = new Set(fullSweepDonePairs.map(function(p) {
      return p[0] + "-" + p[1];
    }));
    p = available.filter(function(p) {
      return !doneSet.has(p[0] + "-" + p[1]);
    });
  }
  // BA 247: Elektroden-Auswahl im Header filtert die Sequenz.
  p = _testFilterByElectrodeSelection(p);
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  compCnt = 0;
  convRnd = 0;
  tStart = Date.now();
  lockTestTabs(true, 'test');
  startTmr();
  showCurPair();
}

// BA 247: Konvergenz-Start (frueher 'conv_fast' in startTest)
function startTestConv() {
  if (!testEls) return;
  testMode = "balance";
  var p = getConvPairs(true);
  p = _testFilterByElectrodeSelection(p);
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  compCnt = 0;
  convRnd = 1;
  tStart = Date.now();
  lockTestTabs(true, 'test');
  startTmr();
  showCurPair();
}

// BA 247: Sequenz auf die im Header gewaehlten Elektroden filtern.
// Liefert nur Paare, bei denen mindestens eine Elektrode gewaehlt ist
// (oder unveraendert, wenn keine Auswahl getroffen wurde = alle).
function _testFilterByElectrodeSelection(pairs) {
  var sel = _testSelectedEls;
  if (!sel || !sel.length) return pairs;
  var s = new Set(sel);
  return pairs.filter(function(p) {
    return s.has(p[0]) || s.has(p[1]);
  });
}
```

`_testSelectedEls` wird im neuen DOMContentLoaded-Block deklariert
(siehe 4c).

### 4b — Weitere Funktionen anpassen

#### `endTest` (Z. 1018–1031)

Start-/Stop-Button-Steuerung übernimmt die neue API über die
Lifecycle-Automatik; das Test-Modul setzt nichts mehr selbst.

**Suche**:

```js
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  if (testEls) {
    testEls.startBtn.disabled = false;
    testEls.stopBtn.disabled = true;
    testEls.testBox.hidden = true;
  }
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  stopTmr();
}
```

**Ersetze durch**:

```js
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  stopTmr();
}
```

#### `showCurPair` (Z. 1039–1097) → komplett neu

**Suche** (die ganze Funktion Z. 1039–1097) und **ersetze durch**:

```js
function showCurPair() {
  if (!testEls) return;
  if (testIdx >= testPairs.length) {
    if (convRnd === 0) return nextFullRound();
    if (convRnd > 0)  return nextConvRnd();
    endTest();
    renderResults();
    return;
  }
  var pair = testPairs[testIdx];
  curA = pair[0];
  curB = pair[1];

  _testUpdateProgress();

  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftLabel:  dENPrefix() + dEN(curA),
      rightLabel: dENPrefix() + dEN(curB),
      hzText:     Math.round(effFreq(curA)) + " Hz vs. " + Math.round(effFreq(curB)) + " Hz"
    });
  }

  // BA 247: curBase ist immer 0. Slider sitzt auf dem gespeicherten
  // Wert (falls vorhanden), sonst 0 dB.
  curBase = 0;
  var ex = bRes.find(function(r) {
    return (r.a === curA && r.b === curB) || (r.a === curB && r.b === curA);
  });
  var startVal = 0;
  if (ex) startVal = (ex.a === curA) ? ex.offset : -ex.offset;
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, startVal);
    testUI.slider.setValueDisplay(vref.slider, startVal.toFixed(1) + " dB");
  }

  _testUpdateRangeHint();

  curPlayed = false;
  updUndo();
  playCur();
}

// BA 247: Helfer fuer showCurPair, ehemals inline.
let _testActiveVerfahren = "full";

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

function _testUpdateRangeHint() {
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.slider) return;
  if (!testAct || testIdx >= testPairs.length) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  var est = getLsEstimate(curA, curB);
  if (!est.hasData) {
    testUI.slider.setRangeHint(vref.slider, null);
    return;
  }
  testUI.slider.setRangeHint(vref.slider, {
    marker: est.estimate,
    label:  (est.estimate >= 0 ? "+" : "") + est.estimate.toFixed(1) + " dB",
    min:    est.estimate - est.halfWidth,
    max:    est.estimate + est.halfWidth
  });
}
```

#### `playCur` (Z. 1098–1106)

**Suche**:

```js
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  if (testMode === "balance")
    playSeq(curA, curB, curBase + _testSliderVal());
  else playSeq(curA, curB, 0);
  curPlayed = true;
}
```

**Ersetze durch**:

```js
function playCur() {
  if (testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  // BA 247: Slider-Wert ist direkt die absolute Korrektur (curBase = 0).
  playSeq(curA, curB, _testSliderVal());
  curPlayed = true;
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  }
}
```

Hinweis: das exakte Aufleuchten der pairIndicator-Boxen während der
A-B-A-Sequenz (left → right → left) bleibt für eine spätere
Verfeinerung offen, weil `playSeq` heute keine entsprechenden Hooks
bietet. Für diese BA reicht `'both'` während ein Trial läuft.

#### `_testSliderVal` (Z. 852–854)

**Suche**:

```js
function _testSliderVal() {
  return testEls ? parseFloat(testEls.slider.value) : 0;
}
```

**Ersetze durch**:

```js
function _testSliderVal() {
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  return (vref && vref.slider && vref.slider.input)
    ? parseFloat(vref.slider.input.value) : 0;
}
```

#### `_testRequestExcl` (Z. 856–864)

Das alte Exclude-Modal hing an `testEls.exclOverlay`, das in der neuen
API zwar weiterhin existiert, aber von `test.js` nicht mehr genutzt
wird (kein excludeButtons-Pfad im Body). Ohne Bestätigungs-Modal
direkt ausschließen.

**Suche**:

```js
function _testRequestExcl(elIdx) {
  if (!testEls) return;
  stopAll();
  const label = `${dENPrefix()}${dEN(elIdx)} (${Math.round(effFreq(elIdx))} Hz)`;
  setTestExclConfirm(testEls.exclOverlay, label, function() {
    doExcl(elIdx);
  });
}
```

**Ersetze durch**:

```js
// BA 247: Exclude-Modal entfaellt; Bestaetigung erfolgt im
// Implantat-Reiter. Aktuell wird `_testRequestExcl` nach BA 247 nicht
// mehr aufgerufen — die alten Listener excludeLeftBtn/excludeRightBtn
// sind im neuen DOMContentLoaded weg. Funktion bleibt vorerst als
// Stub, weil sie in BA 248 mit dem Aufraeumen entfernt wird.
function _testRequestExcl(elIdx) {
  if (!testEls) return;
  stopAll();
  doExcl(elIdx);
}
```

#### `_testSwap` (Z. 866–893)

**Suche** (gesamte Funktion):

```js
function _testSwap() {
  if (!testAct || testIdx >= testPairs.length || !testEls) return;
  stopAll();
  const slVal = _testSliderVal();
  const totOff = curBase + slVal;
  [curA, curB] = [curB, curA];
  testPairs[testIdx] = [curA, curB];
  curBase = 0;
  _testRstSlR();
  const newSlVal = -totOff;
  const s = testEls.slider;
  const absV = Math.abs(newSlVal);
  // Expand range if needed
  while (absV > TEST_SLIDER_RANGES[testSlRangeIdx] && testSlRangeIdx < TEST_SLIDER_RANGES.length - 1) {
    testSlRangeIdx++;
  }
  const r = TEST_SLIDER_RANGES[testSlRangeIdx];
  s.min = String(-r); s.max = String(r);
  s.value = String(newSlVal);
  if (testEls.sliderValue) testEls.sliderValue.textContent = newSlVal.toFixed(1) + " dB";
  _testUpdCumulative(newSlVal);
  testEls.pairLeft.innerHTML = `<span class="aba-label">A</span>${dENPrefix()}${dEN(curA)}`;
  testEls.pairRight.innerHTML = `<span class="aba-label">B</span>${dENPrefix()}${dEN(curB)}`;
}
```

**Ersetze durch**:

```js
function _testSwap() {
  if (!testAct || testIdx >= testPairs.length || !testEls) return;
  stopAll();
  var oldVal = _testSliderVal();
  var swapped = [curB, curA];
  curA = swapped[0]; curB = swapped[1];
  testPairs[testIdx] = [curA, curB];
  var newVal = -oldVal;
  var vref = testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.slider) {
    testUI.slider.setValue(vref.slider, newVal);
    testUI.slider.setValueDisplay(vref.slider, newVal.toFixed(1) + " dB");
  }
  if (vref && vref.pairIndicator) {
    testUI.pairIndicator.setLabels(vref.pairIndicator, {
      leftLabel:  dENPrefix() + dEN(curA),
      rightLabel: dENPrefix() + dEN(curB),
      hzText:     Math.round(effFreq(curA)) + " Hz vs. " + Math.round(effFreq(curB)) + " Hz"
    });
  }
  _testUpdateRangeHint();
}
```

#### `recBal` (Z. 1123–1149)

**Suche**:

```js
  const a = curA, b = curB, tot = curBase + _testSliderVal();
```

**Ersetze durch**:

```js
  // BA 247: curBase ist immer 0.
  const a = curA, b = curB, tot = _testSliderVal();
```

Und im Vollständig-Markierungs-Block:

**Suche**:

```js
  // Vollständig: gemessenes Paar als erledigt markieren
  const pt = testEls ? testEls.runSelect.value : "";
  if (pt === "full") {
```

**Ersetze durch**:

```js
  // BA 247: Vollstaendig: gemessenes Paar als erledigt markieren.
  if (_testActiveVerfahren === "full") {
```

#### `undoL` (Z. 1150–1185)

Der `judgment`-Pfad (`u.t === "j"`) entfällt; `runSelect.value` →
`_testActiveVerfahren`.

**Suche** (gesamte Funktion):

```js
function undoL() {
  if (!testAct || !undoSt.length || testIdx <= 0) return;
  stopAll();
  testIdx--;
  compCnt = Math.max(0, compCnt - 1);
  const u = undoSt.pop();
  if (u.t === "j") {
    if (u.a === "a") {
      const i = jRes.findIndex((x) => x.timestamp === u.e.timestamp);
      if (i >= 0) jRes.splice(i, 1);
    } else {
      const i = jRes.findIndex((x) => x.a === u.e.a && x.b === u.e.b);
      if (i >= 0) jRes[i] = u.p;
    }
  } else {
    if (u.a === "a") {
      const i = bRes.findIndex((x) => x.timestamp === u.e.timestamp);
      if (i >= 0) bRes.splice(i, 1);
    } else {
      const i = bRes.findIndex((x) => x.a === u.e.a && x.b === u.e.b);
      if (i >= 0) bRes[i] = u.p;
    }
    // Bug-Fix §6.9: Bei full-Modus auch aus fullSweepDonePairs entfernen
    const pt = testEls ? testEls.runSelect.value : "";
    if (pt === "full") {
      const ka = Math.min(u.e.a, u.e.b);
      const kb = Math.max(u.e.a, u.e.b);
      const s = sideData[activeSide];
      const idx = s.fullSweepDonePairs.findIndex(([x, y]) => x === ka && y === kb);
      if (idx >= 0) s.fullSweepDonePairs.splice(idx, 1);
      fullSweepDonePairs = s.fullSweepDonePairs;
    }
  }
  updUndo();
  showCurPair();
}
```

**Ersetze durch**:

```js
function undoL() {
  if (!testAct || !undoSt.length || testIdx <= 0) return;
  stopAll();
  testIdx--;
  compCnt = Math.max(0, compCnt - 1);
  const u = undoSt.pop();
  // BA 247: nur noch der b-Pfad (balance); j-Pfad entfaellt mit judgment.
  if (u.a === "a") {
    const i = bRes.findIndex(function(x) { return x.timestamp === u.e.timestamp; });
    if (i >= 0) bRes.splice(i, 1);
  } else {
    const i = bRes.findIndex(function(x) { return x.a === u.e.a && x.b === u.e.b; });
    if (i >= 0) bRes[i] = u.p;
  }
  // Bug-Fix §6.9: Bei full-Verfahren auch aus fullSweepDonePairs entfernen.
  if (_testActiveVerfahren === "full") {
    const ka = Math.min(u.e.a, u.e.b);
    const kb = Math.max(u.e.a, u.e.b);
    const s = sideData[activeSide];
    const idx = s.fullSweepDonePairs.findIndex(function(p) { return p[0] === ka && p[1] === kb; });
    if (idx >= 0) s.fullSweepDonePairs.splice(idx, 1);
    fullSweepDonePairs = s.fullSweepDonePairs;
  }
  updUndo();
  showCurPair();
}
```

#### `doExcl` (Z. 1247–1274)

Der `selective`-Spezialfall entfällt; Progress läuft über
`testUI.progress.set`.

**Suche** (gesamte Funktion):

```js
function doExcl(i) {
  elExDur[i] = Date.now();
  const rem = testPairs.slice(testIdx).filter(([a, b]) => a !== i && b !== i);
  testPairs = [...testPairs.slice(0, testIdx), ...rem];
  buildFreqTable();
  if (testEls && testEls.progressText)
    testEls.progressText.textContent = `${dENPrefix()}${dEN(i)} ${t("exclDuring")}. ${testPairs.length - testIdx} ${t("pairsRem")}.`;
  // BA 204: Im selektiven Modus auch auf selectiveElectrodes filtern
  const ptNow = testEls && testEls.runSelect ? testEls.runSelect.value : '';
  if (ptNow === 'selective') {
    const sel = new Set(selectiveElectrodes);
    const newPairs = testPairs
      .slice(testIdx)
      .filter(([a, b]) => sel.has(a) || sel.has(b));
    if (!newPairs.length) {
      alert(t('selectiveEnd'));
      endTest();
      renderResults();
      return;
    }
    testPairs = newPairs;
    testIdx = 0;
  }
  if (testIdx >= testPairs.length) {
    endTest();
    renderResults();
  } else showCurPair();
}
```

**Ersetze durch**:

```js
function doExcl(i) {
  elExDur[i] = Date.now();
  const rem = testPairs.slice(testIdx).filter(function(p) { return p[0] !== i && p[1] !== i; });
  testPairs = [].concat(testPairs.slice(0, testIdx), rem);
  buildFreqTable();
  // BA 247: Progress laeuft jetzt ueber den testUI-Progress-Baustein.
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress,
      dENPrefix() + dEN(i) + " " + t("exclDuring") + ". " +
      (testPairs.length - testIdx) + " " + t("pairsRem") + ".");
  }
  if (testIdx >= testPairs.length) {
    endTest();
    renderResults();
  } else showCurPair();
}
```

#### `updTmr` (Z. 1283–1287)

Die neue API bietet keinen separaten `timerDisplay`. Der reine
Timer-Tick wird nicht gerendert.

**Suche**:

```js
function updTmr() {
  const e = Math.floor((Date.now() - tStart) / 1000);
  if (testEls && testEls.timerDisplay)
    testEls.timerDisplay.textContent = `${Math.floor(e / 60)}:${String(e % 60).padStart(2, "0")}`;
}
```

**Ersetze durch**:

```js
function updTmr() {
  // BA 247: testUI bietet keinen separaten timerDisplay; reiner Timer-Tick
  // wird nicht mehr gerendert. Hauptprogress kommt aus _testUpdateProgress
  // nach Trial-Aktionen.
}
```

#### `nextConvRnd` (Z. 1218–1246) — Progress-Text

**Suche** am Ende der Funktion:

```js
  if (testEls && testEls.progressText)
    testEls.progressText.textContent = `${t("round")} ${convRnd} – ${mg.length} (max res: ${mx.toFixed(1)} dB)`;
  showCurPair();
}
```

**Ersetze durch**:

```js
  // BA 247: Progress laeuft ueber testUI.progress.set
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.progress) {
    testUI.progress.set(vref.progress,
      t("round") + " " + convRnd + " – " + mg.length + " (max res: " + mx.toFixed(1) + " dB)");
  }
  showCurPair();
}
```

### 4c — DOMContentLoaded-Block komplett neu

Den gesamten Block Z. 1353–1587 (von `// DOMContentLoaded — buildTestPanel + Event-Wiring`
bis zur schließenden `});`) durch den folgenden ersetzen:

```js
// ============================================================
// BA 247: DOMContentLoaded — buildTestPanel (neue testUI-API)
// ============================================================
let _testSelectedEls = [];  // BA 247: Elektroden-Auswahl im Header

document.addEventListener("DOMContentLoaded", function() {
  var parentEl = document.getElementById("subpanel-messungen-test");
  if (!parentEl) return;

  // Gemeinsamer Body fuer beide Verfahren (Round Robin und Konvergenz
  // unterscheiden sich nur im Start-/Sequenz-Aufbau, nicht in der UI).
  function _testBody() {
    return {
      pairIndicator:  { variant: 'electrode' },
      progress:       { format: 'rounds' },
      keyHint:        { unitKey: 'sliderHintDb' },
      slider:         {
        unit: 'dB',
        initialRange: 20,
        maxRange: 60,
        rangeHint: true,
        touchStep: 0.5,
        touchFineStep: 0.1
      },
      sliderValue:    { show: true },
      confirmButton:  { key: 'btnConfirmOffset' },
      actions:        [
        'undo',
        'replay',
        'simul',
        { kind: 'swap', labelKey: 'btnSwapAB' }
      ],
      statusGrid:     { show: true }
    };
  }

  function _testHooksCommon() {
    return {
      onStop:    function() { endTest(); renderResults(); },
      onConfirm: function() { recBal(); },
      onReplay:  function() { playCur(); },
      onUndo:    function() { undoL(); },
      onSimul:   function() { _testPlaySimul(); },
      onSwap:    function() { _testSwap(); }
    };
  }

  var cfg = {
    id: 'test',
    explain: {
      titleKey: 'testExplainTitle',
      paragraphs: [
        { key: 'testMaturityHint', kind: 'ok'    },
        { key: 'testIntro',        kind: 'plain' }
      ]
    },
    header: {
      common: {
        refSelect: false,
        volume:    { show: true },
        duration:  { show: true },
        pause:     { show: true },
        toneType:  false,
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          getVolume:   function()   { return gVol(); },
          getPreviewSequence: function() {
            var hz = 1000;
            var dur = gDur();
            var pau = gPau();
            return [
              { hz: hz, durationMs: dur },
              { pauseMs: pau },
              { hz: hz, durationMs: dur }
            ];
          }
        },
        sequence:     { show: true, source: 'global' },
        sliderTarget: {
          options:  ['a','b','balance'],
          stateKey: 'slTarget_test',
          default:  'balance'
        },
        electrodeSelection: {
          minSelected: 1,
          getSelection:    function()    { return _testSelectedEls.slice(); },
          setSelection:    function(sel) { _testSelectedEls = sel.slice(); },
          getElectrodeStatus: function() {
            // BA 247: Filter NUR auf aktive Seite.
            var testable = [], muted = [], excluded = [];
            for (var i = 0; i < nEl; i++) {
              if (elExDur[i] !== null)  excluded.push(i);
              else if (elSt[i] === 'mute') muted.push(i);
              else                          testable.push(i);
            }
            return { testable: testable, muted: muted, excluded: excluded };
          },
          electrodeLabel: function(i) {
            return dENPrefix() + dEN(i) + " (" + Math.round(effFreq(i)) + " Hz)";
          }
        }
      },
      startStop: { startKey: 'btnStartTest', stopKey: 'btnPauseTest', resumable: true }
    },
    verfahren: [
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
    ]
  };

  testEls = buildTestPanel(parentEl, cfg);
});

// BA 247: "beide Toene gleichzeitig" (frueher inline am Simul-Button).
function _testPlaySimul() {
  if (!testAct || testIdx >= testPairs.length) return;
  stopAll();
  isPlay = true;
  var tot = _testSliderVal();
  var vol = gVol();
  var dur = gDur();
  var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot)  : 1), 1), 0);
  var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
  var p1 = playTone(effFreq(curA), vA, dur);
  var p2 = playTone(effFreq(curB), vB, dur);
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.pairIndicator) testUI.pairIndicator.setPlaying(vref.pairIndicator, 'both');
  Promise.all([p1, p2]).then(function() {
    if (vref && vref.pairIndicator) testUI.pairIndicator.setPlaying(vref.pairIndicator, null);
    isPlay = false;
  });
  curPlayed = true;
}
```

## Schritt 5 — Akzeptanztest

Nach dem Bau die folgenden Schritte einzeln durchgehen und das
erwartete Verhalten bestätigen.

1. **Tab Messungen → Sub-Tab Elektrodenlautstärke öffnen**
   Intro mit grünem Reifegrad-Hinweis oben und dem gemeinsamen
   Intro-Text darunter. Keine wechselnden runExpl-Texte unten.

2. **Voreinstellungen prüfen**
   - Verfahren-Dropdown: zwei Optionen „Round Robin (Vollständig)"
     und „Konvergenz"
   - Tonart-Button öffnet Popup mit Probehör-Spalte (kein Dropdown)
   - Sequence (AB/ABA), Sliderziel (a/b/balance), Lautstärke, Dauer,
     Pause sichtbar
   - Elektroden-Auswahl-Zeile im Header sichtbar mit Sprachzeile
     „N von M Elektroden gewählt" und Button „Auswahl ändern"

3. **Test starten (Round Robin)**
   Start-Button ausgegraut, Stop-Button aktiv, Voreinstellungen
   gesperrt, Tab-Wechsel auf andere Top-Tabs blockiert. Im Body:
   Pair-Indicator mit „A E1" / „B E2" und Hz-Zeile; blauer Balken
   über dem Slider mit geschätztem Wert (falls Daten vorhanden);
   Slider startet bei 0 oder beim gespeicherten Wert.

4. **Wert per Slider einstellen und Bestätigen**
   Nächstes Paar erscheint, Slider sitzt am gespeicherten Wert oder
   bei 0. Progress zeigt Trial X von Y, Runde A von B.

5. **Swap-Button A↔B testen**
   Button trägt „A↔B", nicht „L↔R". Klick tauscht die Bezeichnungen
   und den Slider-Wert auf den negierten Wert.

6. **Tonart ändern**
   Im Popup eine andere Tonart wählen → bestätigen. Nach Schließen
   und Wiederöffnen ist die neue Tonart markiert. Datei speichern,
   neu laden: Tonart bleibt.

7. **Tonart wechselt nicht mit Stereo-Balance**
   In Sub-Tab Stereo-Balance eine andere Tonart wählen
   (Dropdown `toneType`); zurück in Elektrodenlautstärke öffnen: dort
   steht weiterhin die in Schritt 6 gewählte Tonart, unabhängig.

8. **Elektroden-Auswahl filtert die Sequenz**
   Auswahl auf z.B. E1 und E3 reduzieren, Test starten: nur Paare
   gespielt, in denen mindestens E1 oder E3 vorkommt.

9. **Test pausieren und fortsetzen (Round Robin)**
   Stop drücken (Button beschriftet „Test pausieren"), Tab wechseln,
   zurück, erneut Start: aktueller Sweep läuft am gleichen Punkt
   weiter.

10. **Test Konvergenz**
    Vorher mindestens eine Round-Robin-Runde abschließen. Verfahren
    auf „Konvergenz" wechseln, Start: nur die kritischsten Paare.
    Stop bricht ab; neuer Start beginnt frisch (kein Resume).

11. **Keine Konfidenz-Auswahl im Body**
    Während eines Trials gibt es keine Radio-Buttons für Konfidenz.

12. **Keine Cumulative-Display-Zeile im Body**
    Nur `sliderValue` unter dem Slider; keine zusätzliche
    „Kumulativ: X.X dB"-Zeile.

13. **Pfeiltasten und Shortcuts**
    Links/Rechts: Slider bewegen. Space: Trial wiederholen.
    Backspace: Zurück. B: beide gleichzeitig. S: A↔B. Alles aktiv
    während eines Trials.

14. **Reload und Persistenz**
    Datei speichern, neu laden: aktuelle Verfahrens-Auswahl bleibt,
    `slTarget_test` bleibt, `toneType_test` bleibt, Elektroden-Auswahl
    im Header bleibt.

15. **Andere Sub-Reiter unbeschädigt**
    Stereo-Balance, Frequenzabgleich, Latenz: alle Tests laufen wie
    vorher. Stereo-Balance-Swap-Button steht weiterhin „L↔R".

## Schritt 6 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–15
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle. Bei „unklar": Rückfrage stellen, nicht still annehmen.

Vier zusätzliche Spezial-Checks vor Build-Abschluß:

- **i18n-Anführungszeichen**: jeden in `i18n/de.js` neu eingefügten
  oder geänderten String mit den Augen abzählen, ob die ASCII-`"`-Zeichen
  paarweise stehen. Insbesondere `testIntro` enthält viele
  Escape-Sequenzen `\"`. Bei JS-Parser-Fehler fast immer ein Quoten-Bug.
- **Wer ruft die alte API auf?** Nach dem Build per
  ```
  grep -n "buildTestPanel" js/*.js | grep -v test-ui.js
  ```
  prüfen, daß keine Datei mehr eine alte-API-Cfg übergibt
  (Erkennungsmerkmal: Top-Level-Schlüssel `presets:` oder `test:` in
  der Cfg). Erwartet: alle vier Aufrufer (`freqmatch.js`,
  `lr-balance.js`, `latency.js`, `test.js`) übergeben Cfgs mit
  `header:` und `verfahren:`.
- **Globale Variablen-Leichen**: prüfen, daß keine der gelöschten
  Funktionen oder Variablen anderswo im Repo noch referenziert wird:
  ```
  grep -rn "TEST_SLIDER_RANGES\|testSlRangeIdx\|_testRstSlR\|_testExtSlider\|_testCheckExtend\|selectiveElectrodes\|_selectivePairsFromRR\|_selectiveUpdateSummary\|_selectiveOpenDialog\|_testUpdCumulative\|_testUpdLsHint\|recJdg\|showMode\|updateRunExplain\|playManPair\|afterManRes" js/
  ```
- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.247-beta`.

## Folge-BA

- **BA 248** entfernt anschließend `_buildTestPanelOld`, räumt tote
  i18n-Keys und Doku-Reste aus.

## Hinweise zur Sprachpflege

Übersetzungen für `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` werden in
dieser Bauanleitung **nicht** mitgepflegt. Fehlende Keys fallen über
den i18n-Fallback auf die deutschen Defaults zurück. Eine Folge-BA
zum Nachziehen ist bewußt nicht vorgesehen — der Nutzer entscheidet
selbst, wann übersetzt wird.
