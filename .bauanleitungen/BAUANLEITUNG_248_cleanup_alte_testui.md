# Bauanleitung 248 — Cleanup nach BA 247: alte testUI-API + tote Reste in test.js + i18n + Doku

## Ziel

Aufräumen nach Abschluß der testUI-Migration in BA 247. Diese BA hat
**keine sichtbare Verhaltensänderung**. Sie entfernt nur Code, der
seit BA 247 nicht mehr erreicht wird:

1. `_buildTestPanelOld` und die Helfer-Verzweigung in `js/test-ui.js`
2. tote Funktionen/Variablen in `js/test.js`
   (`_testRequestExcl`-Stub, `updFullSweepInfo`, leere Timer-Mechanik
   inkl. `tStart`/`tInt`/`compCnt` und der Setter `testMode = "balance"`)
3. `updInd`-Fallback auf alte API (`testEls.pairLeft`/`pairRight`,
   DOM-Fallback `tAL`/`tBL`) in `js/audio.js`
4. `updateRunExplain` in `js/i18n.js` (`runExplain`-Box gibt es nur in
   der alten API)
5. tote i18n-Keys in `i18n/de.js`
6. Doku: `docs/CODESTRUKTUR.md`, `docs/spec/00-testui-architektur.md`,
   `docs/spec/02-messung.md`

`en.js`/`fr.js`/`es.js` werden in dieser BA **nicht** angefaßt.
Überzählige Keys in den anderen Sprachen sind harmlos (fallen auf
Default zurück, werden aber nicht referenziert) — sie können in einer
späteren kleinen BA mitgeräumt werden, wenn der Nutzer es wünscht.

`jRes` (Judgment-Ergebnisse) wird in dieser BA **nicht** angefaßt — das
ist Thema einer eigenen BA.

## Voraussetzungen

- aktuelle Version vor dem Bau: `3.2.247.4-beta`
- i18n: nur Deutsch
- BA 247 inkl. aller drei Fix-BAs ist gebaut und abgenommen

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.247.4-beta";

// nachher
const APP_VERSION = "3.2.248-beta";
```

## Schritt 2 — `js/test-ui.js`: alte API ersatzlos löschen

### 2a — `_buildTestPanelOld` löschen (Z. 70–665)

**Suche** (Start-Anker):

```js
// ===== ALTE API (unverändert) =====

function _buildTestPanelOld(parentEl, cfg) {
```

**Bis einschließlich** (End-Anker — die schließende `}` von
`_buildTestPanelOld` und die anschließende Leerzeile vor `// ===== NEUE API =====`):

```js
    exclConfirmBtn: exclConfirmBtn, exclCancelBtn: exclCancelBtn,
  };
}

// ===== NEUE API =====
```

**Ersetze durch**:

```js
// ===== NEUE API =====
```

Der gesamte Block dazwischen (knapp 600 Zeilen, inkl.
`_buildTestPanelOld` und dem Kommentar `// ===== ALTE API (unverändert) =====`)
wird ersatzlos gelöscht. Der Marker-Kommentar `// ===== NEUE API =====`
bleibt erhalten, denn er ist Anker für andere Suchvorgänge.

### 2b — `buildTestPanel`-Weiche zur direkten Delegation umbauen

**Suche** (etwa Z. 1923–1931 vor diesem Schritt):

```js
// ===== Haupt-Builder: Signatur-Weiche =====
function buildTestPanel(parentEl, cfg) {
  // Neue API erkennen: hat header UND verfahren
  if (cfg.header && cfg.verfahren) {
    return _buildTestPanelNew(parentEl, cfg);
  }
  // Alte API: hat presets UND test
  return _buildTestPanelOld(parentEl, cfg);
}
```

**Ersetze durch**:

```js
// ===== Haupt-Builder =====
// BA 248: alte API entfaellt; Direktaufruf statt Signatur-Weiche.
function buildTestPanel(parentEl, cfg) {
  return _buildTestPanelNew(parentEl, cfg);
}
```

## Schritt 3 — `js/test.js`: tote Reste entfernen

### 3a — `_testRequestExcl`-Stub löschen (Z. 675–685)

**Suche**:

```js
// ---- Ausschluss-Helfer ----
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

**Ersatzlos löschen** (gesamter Block inkl. Kommentar).

### 3b — `updFullSweepInfo` löschen (Z. 973) plus Aufruf in `nextFullRound` (Z. 1001)

**Suche** (Funktion):

```js
function updFullSweepInfo() {}
```

**Ersatzlos löschen**.

**Suche** (Aufruf in `nextFullRound`):

```js
  updFullSweepInfo();
  showCurPair();
}
```

**Ersetze durch**:

```js
  showCurPair();
}
```

### 3c — leere Timer-Mechanik löschen (Z. 1057–1069)

**Suche**:

```js
function startTmr() {
  tStart = Date.now();
  tInt = setInterval(updTmr, 1000);
  updTmr();
}
function stopTmr() {
  if (tInt) { clearInterval(tInt); tInt = null; }
}
function updTmr() {
  // BA 247: testUI bietet keinen separaten timerDisplay; reiner Timer-Tick
  // wird nicht mehr gerendert. Hauptprogress kommt aus _testUpdateProgress
  // nach Trial-Aktionen.
}
```

**Ersatzlos löschen** (alle drei Funktionen).

### 3d — Aufrufer von `startTmr`/`stopTmr` und `compCnt`/`testMode`/`tStart` entfernen

`endTest` (etwa Z. 788–796):

**Suche**:

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

**Ersetze durch**:

```js
function endTest() {
  stopAll();
  testAct = false;
  curPlayed = false;
  lockTestTabs(false, null);
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
```

`startTestFull` (etwa Z. 713–754) — Setter für `testMode`, `compCnt`,
`tStart` und Aufruf von `startTmr` entfernen.

**Suche**:

```js
function startTestFull() {
  if (!testEls) return;
  testMode = "balance";
  var s = sideData[activeSide];
  var rrTable = ROUND_ROBIN[nEl];
  var p;
```

**Ersetze durch**:

```js
function startTestFull() {
  if (!testEls) return;
  var s = sideData[activeSide];
  var rrTable = ROUND_ROBIN[nEl];
  var p;
```

Weiter unten in derselben Funktion:

**Suche**:

```js
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
```

**Ersetze durch**:

```js
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  convRnd = 0;
  lockTestTabs(true, 'test');
  showCurPair();
}
```

`startTestConv` (etwa Z. 757–773) — analog.

**Suche**:

```js
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
```

**Ersetze durch**:

```js
function startTestConv() {
  if (!testEls) return;
  var p = getConvPairs(true);
  p = _testFilterByElectrodeSelection(p);
  testPairs = randAB(shuffle(p));
  testIdx = 0;
  undoSt = [];
  testAct = true;
  curPlayed = false;
  convRnd = 1;
  lockTestTabs(true, 'test');
  showCurPair();
}
```

`recBal` (etwa Z. 934–937) — `compCnt++` entfernen.

**Suche**:

```js
  testIdx++;
  compCnt++;
  updUndo();
  showCurPair();
}
```

**Ersetze durch**:

```js
  testIdx++;
  updUndo();
  showCurPair();
}
```

`undoL` (etwa Z. 942–944) — `compCnt`-Adjust entfernen.

**Suche**:

```js
  stopAll();
  testIdx--;
  compCnt = Math.max(0, compCnt - 1);
  const u = undoSt.pop();
```

**Ersetze durch**:

```js
  stopAll();
  testIdx--;
  const u = undoSt.pop();
```

### 3e — Deklarationen in `js/state-side.js` entschlacken

`js/state-side.js`, etwa Z. 678–691.

**Suche**:

```js
let testAct = false,
  testPairs = [],
  testIdx = 0,
  testMode = "balance",
  curPlayed = false,
  curBase = 0,
  slExt = false;
let curA = -1,
  curB = -1,
  undoSt = [],
  tStart = 0,
  tInt = null,
  compCnt = 0,
  convRnd = 0;
```

**Ersetze durch**:

```js
let testAct = false,
  testPairs = [],
  testIdx = 0,
  curPlayed = false,
  curBase = 0,
  slExt = false;
let curA = -1,
  curB = -1,
  undoSt = [],
  convRnd = 0;
```

(`testMode`, `tStart`, `tInt`, `compCnt` ersatzlos raus.)

## Schritt 4 — `js/audio.js`: `updInd`-Fallback auf alte API entfernen

`updInd` (etwa Z. 779–800).

**Suche**:

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

**Ersetze durch**:

```js
function updInd(i, w) {
  document
    .querySelectorAll('.freq-table .pbtn[data-a="play"]')
    .forEach((b, j) => {
      b.style.background = j === i ? "var(--accent-light)" : "";
    });
  // BA 248: Pair-Anzeige nur noch ueber neue testUI-API
  // (testEls.verfahren[...].pairIndicator). Alte API und DOM-Fallback
  // sind mit BA 248 weg.
  let pL = null, pR = null;
  if (typeof testEls !== 'undefined' && testEls
      && testEls.verfahren && typeof _testActiveVerfahren !== 'undefined'
      && testEls.verfahren[_testActiveVerfahren]
      && testEls.verfahren[_testActiveVerfahren].pairIndicator) {
    pL = testEls.verfahren[_testActiveVerfahren].pairIndicator.left;
    pR = testEls.verfahren[_testActiveVerfahren].pairIndicator.right;
  }
  if (pL) pL.classList.toggle("playing", w === "a");
  if (pR) pR.classList.toggle("playing", w === "b");
}
```

(Die `tAL`/`tBL`-DOM-Elemente existieren im aktuellen HTML nicht mehr;
sie hingen an der alten API.)

## Schritt 5 — `js/i18n.js`: `updateRunExplain` entfernen

Die Funktion zielt auf eine DOM-Box (`runExplain`), die nur
`_buildTestPanelOld` baut. Nach Schritt 2 existiert sie nie wieder.

`js/i18n.js`, Funktion `updateRunExplain` (etwa Z. 132–139).

**Suche**:

```js
function updateRunExplain() {
  var el = document.getElementById("runExplain");
  if (!el) return;
  el.innerHTML = t("recommend")
    .split("\n")
    .map((l) => (l.startsWith("*") ? "<li>" + l.slice(1).trim() + "</li>" : l))
    .join("<br>");
}
```

**Ersatzlos löschen**.

Vor dem Löschen sicherheitshalber prüfen, daß die Funktion nirgendwo
sonst aufgerufen wird:

```
grep -rn "updateRunExplain" js/
```

Erwartet: ausschließlich diese Definition (und sonst nichts). Falls ein
Aufrufer auftaucht: melden, nicht löschen.

## Schritt 6 — `i18n/de.js`: tote Keys entfernen

`en.js`/`fr.js`/`es.js` **nicht** anfassen.

Jeden der folgenden Keys in `i18n/de.js` ersatzlos entfernen. Die
Zeilennummern sind Hinweise (Stand `3.2.247.4-beta`); maßgeblich ist
der Key-Name. Vor dem Löschen jeden Key einmal per
`grep -n "<KEY>" js/ index.html` prüfen — erwartet: keine Treffer
mehr in JS/HTML. Falls doch: melden, nicht löschen.

**Liste der zu löschenden Keys**:

```
lblMode
optBal
optJdg
lblRun
optFull
optCF
optMan
optSel
runExplSel
runExplFull
runExplCF
runExplMan
manComp
testBlockedSideUnknown
testRunningTitle
testRunningHint
testRunningTitleWord_test
testRunningTitleWord_running
testExplainRecommend
testExplainVarious
selChange
selectiveEnd
selDlgTitle
selDlgHint
selDlgEmpty
selSummaryAll
selSummarySome
confidenceLabelNone
confidenceLabelSure
confidenceLabelMedium
confidenceLabelUnsure
confidenceLabelInvalid
confidenceNotStored
confQualityLabel
cnfSure
cnfMedium
cnfUnsure
cnfInvalid
bLoud
bLoud2
bEqual
```

Vorgehen pro Key:

1. `grep -n "^\s*<KEY>:" i18n/de.js` für die exakte Zeile
2. die ganze Zeile (Key + Wert + abschließendes Komma) löschen
3. `grep -rn "\"<KEY>\"\|'<KEY>'" js/ index.html` — wenn Treffer:
   stoppen und melden

Reihenfolge ist egal. Manche Keys (z.B. `confQualityLabel`, `cnfSure`
bis `cnfInvalid`) existieren ggf. nicht in der heutigen `de.js` —
das ist OK; nur Vorhandenes löschen.

Nach Abschluß einmal:

```
node -e "require('./i18n/de.js')"
```

oder im Browser kurz die Anwendung neu laden und Konsole auf Parse-
Fehler prüfen.

## Schritt 7 — Doku-Updates

### 7a — `docs/CODESTRUKTUR.md`

In der Modulübersicht zu `js/test-ui.js` (und allen relevanten
Edit-Szenarien) den Hinweis auf die „alte API" / `_buildTestPanelOld`
entfernen. Erwähnt werden darf weiterhin der Migrationsverlauf in der
Versions-Historie; aktiv beschrieben wird nur noch
`_buildTestPanelNew` als der Builder.

Beim Eintrag zu `js/test.js`: Verweise auf `_testRequestExcl`,
`updFullSweepInfo`, `startTmr`/`stopTmr`/`updTmr`, `testMode`,
`compCnt`, `tStart`, `tInt` entfernen.

Beim Eintrag zu `js/i18n.js`: `updateRunExplain` aus der
Funktionsliste streichen.

### 7b — `docs/spec/00-testui-architektur.md`

Abschnitte mit Bezug auf die alte API (modeOptions, jdgContainer,
selective, manual, runExplain-Box, `judgment`-Verfahren) als
historisch markieren oder löschen — abhängig davon, ob das Kapitel
historisch dokumentiert oder den Ist-Zustand beschreibt. Sicher
löschen:

- Sätze, die behaupten, die alte API existiere noch
- Tabellen-Zeilen zu `optJdg`, `optMan`, `optSel` als aktuelle Optionen
- Die Verfahren-Beschreibungen `judgment`, `selective`, `manual` als
  aktive Verfahren

### 7c — `docs/spec/02-messung.md`

Im Abschnitt zum Elektrodenlautstärke-Test:
- Verweise auf die Modi `judgment`, `selective`, `manual` als aktuelle
  Optionen entfernen
- nur noch `full` (Round Robin) und `conv_fast` (Konvergenz) als
  aktive Verfahren beschreiben

`jRes` in dieser Spec **nicht** anfassen — eigene BA.

## Schritt 8 — Akzeptanztest

Diese BA macht keine sichtbaren Verhaltensänderungen. Der Akzeptanz-
test besteht im Wesentlichen aus „nichts darf brechen".

1. **Browser-Cache leeren, Anwendung neu laden**
   Erwartet: kein JS-Fehler in der Konsole. `3.2.248-beta` sichtbar.

2. **Alle vier Sub-Reiter unter „Messungen" öffnen**
   Elektrodenlautstärke, Stereo-Balance, Frequenzabgleich, Latenz
   einzeln öffnen. Jeder Reiter rendert wie nach BA 247.4.

3. **Elektrodenlautstärke: einen Round-Robin-Lauf starten**
   Test startet, ein Paar bestätigen. Pair-Indicator zeigt
   Elektroden-Labels, Progress läuft. Stop drücken: Test pausiert.
   (Vor BA 247.4 funktionierte das schon — diese BA ändert nichts
   daran.)

4. **Stereo-Balance**: einen Trial laufen lassen. Pair-Indicator
   leuchtet abwechselnd. Swap-Button weiterhin „L↔R".

5. **Frequenzabgleich (Slider und Adaptiv)**: Tonart-Popup öffnen,
   Tonart wechseln, Probehören. Test starten. Funktioniert wie vorher.

6. **Latenz**: Test starten, Klicks hörbar. Funktioniert wie vorher.

7. **i18n-Test**
   Sprache wechseln (Setup-Tab → Sprache → English/Français/Español
   und zurück auf Deutsch). Erwartet: kein Konsolen-Fehler. Tab-Inhalte
   bleiben sichtbar und lesbar (auch wenn manche jetzt mit deutschem
   Default-Fallback gerendert werden — Übersetzungen werden in einer
   späteren BA nachgezogen).

8. **Datei speichern und neu laden**
   Aktuellen Stand speichern, dann neu laden. Erwartet: kein Fehler,
   Inhalt unverändert.

## Schritt 9 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–8
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle. Bei „unklar": Rückfrage stellen, nicht still annehmen.

Sieben Pflicht-Checks vor Build-Abschluß:

- **Alte API tatsächlich weg**:
  ```
  grep -n "_buildTestPanelOld\|cfg\.presets\|cfg\.test\b" js/test-ui.js
  ```
  Erwartet: keine Treffer.

- **Tote Funktionen weg**:
  ```
  grep -rn "_testRequestExcl\|updFullSweepInfo\|startTmr\|stopTmr\|updTmr\|updateRunExplain" js/
  ```
  Erwartet: keine Treffer.

- **Tote Variablen weg**:
  ```
  grep -rn "\btestMode\b\|\btInt\b\|\btStart\b\|\bcompCnt\b" js/
  ```
  Erwartet: in `js/audio.js` Z. ~594 darf eine **lokale** `const tStart`
  in `playBurstTone` stehen (gleichnamig, aber lokal — nicht anfassen).
  Sonst keine weiteren Treffer.

- **`testEls.pairLeft`/`pairRight`/`tAL`/`tBL` nicht mehr referenziert**:
  ```
  grep -rn "testEls\.pairLeft\|testEls\.pairRight\|getElementById\(\"tAL\"\|getElementById\(\"tBL\"" js/
  ```
  Erwartet: keine Treffer.

- **Tote i18n-Keys weg**:
  ```
  grep -n "lblMode:\|optBal:\|optJdg:\|lblRun:\|optFull:\|optCF:\|optMan:\|optSel:\|runExpl\|manComp:\|testBlockedSideUnknown:\|testRunningTitle\|testExplainRecommend:\|testExplainVarious:\|selChange:\|selectiveEnd:\|selDlg\|selSummary\|confidenceLabel\|confidenceNotStored:\|confQualityLabel:\|cnfSure:\|cnfMedium:\|cnfUnsure:\|cnfInvalid:\|bLoud:\|bLoud2:\|bEqual:" i18n/de.js
  ```
  Erwartet: keine Treffer.

- **Andere Sprachdateien unangetastet**: `git diff -- i18n/en.js i18n/fr.js i18n/es.js`
  Erwartet: leerer Diff.

- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.248-beta`.

## Folge-BAs

- **BA 249** — Bug-Fix: `_activeTestInput` in `audio.js`, `volInput`
  in `results.js`, `lockedHint` in `tabs-eq.js` lesen heute die alte
  API-Form (`testEls.volInput` statt `testEls.header.volInput`).
  Konsequenz: Lautstärke/Dauer/Pause werden im Elektrodenlautstärke-
  Test ignoriert (Default 25%/1000 ms/500 ms). Wird in BA 249 für
  alle vier Module gefixt.
- **BA 250** — UI-Änderung: Lautstärke/Dauer/Pause im Elektrodenlautstärke-
  Test in die Tonart-Modalbox verschieben (analog freqmatch nach
  BA 240). Header wird schlanker.
- **BA 251** — `jRes` (Judgment-Ergebnisse) komplett aus dem Code
  entfernen. Save schreibt nicht mehr, Load ignoriert.

## Hinweise zur Sprachpflege

Übersetzungen für `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` werden in
dieser BA bewußt **nicht** mitgepflegt — die toten Keys können dort
stehenbleiben, sie schaden nicht. Eine spätere Mini-BA „tote Keys auch
in en/fr/es räumen" ist möglich, wenn der Nutzer es wünscht.
