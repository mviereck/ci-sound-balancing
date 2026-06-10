# BA 254 — Globale Tonart/Tonfolge abschaffen, Sequence pro Test, Druckbericht umstellen

Status: ENTWURF (noch nicht im Bau).

Voraussetzung: BA 252 und BA 253 sind gebaut.

## Ziel

`globalToneType` und `globalSequence` aus dem State entfernen. Jeder
Test bekommt eigene Werte:

- Tonart: `toneType_freqmatch`, `toneType_test`, `toneType_balance`
  (existieren bereits seit BA 209/250/253) — heute parallel zum
  globalen Wert; nach BA 254 ist der globale Wert weg.
- Tonfolge AB/ABA: neue Variablen `sequence_freqmatch`,
  `sequence_test`, `sequence_balance`.

Audio-Helfer (`playTone`, `playSeq`) lesen die Tonart/Tonfolge nicht
mehr aus dem globalen Scope, sondern bekommen sie pro Aufruf
übergeben. `playFreqPair` ist tot und wird entfernt.

Druckbericht-Sektion "Test-Einstellungen": pro Test eigener Block
statt eines globalen Anhangs.

## Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.2.254-beta";
```

## Änderungen

### 1) `js/state-side.js` — Globalen Zustand neu aufstellen

**Schritt 1a — neue Sequence-Variablen** (direkt unter den
bestehenden `*_balance`-Variablen aus BA 253):

```js
// BA 254: Tonfolge (AB/ABA) speziell pro Test. Ersetzt globalSequence.
let sequence_freqmatch = "ab";
let sequence_test      = "ab";
let sequence_balance   = "ab";
```

**Schritt 1b — globale Variablen löschen.** Diese Zeilen ersatzlos
entfernen:

```js
let globalToneType = "richCiHF"; // ...
let globalSequence = "ab";       // ...
```

(Der Kommentar zur Frequenzabgleich-Tonart-Variable, die unter
diesen stand, bleibt erhalten — nur die zwei `globalXxx`-Zeilen
löschen.)

### 2) `js/test-ui.js` — Dropdowns auf pro-Test-State umstellen

**Schritt 2a — `_syncGlobalDropdowns` und `syncAllGlobalDropdowns`
ersatzlos entfernen** (Z. ca. 17–27).

**Schritt 2b — Tonart-Dropdown-Bau komplett entfernen.** Alle Tests
nutzen seit BA 209/250/253 `toneType: false` und `tonePopupButton`.
Den `if (showTone) { … }`-Block (Z. ca. 360–391) im
`buildTestPanel` ersatzlos löschen — inklusive der Variable
`toneSelect` (Deklaration, Refs-Zuweisung, Event-Listener
Z. ca. 1071–1077). Damit verschwinden auch alle Verweise auf
`globalToneType` aus dieser Datei.

**Schritt 2c — Sequence-Dropdown pro Test verdrahten.** Heutige
Stelle (Z. ca. 355):

```js
      seqSelect.value = globalSequence;
```

ersetzen durch:

```js
      var seqVal = (id === 'test')      ? sequence_test
                 : (id === 'balance')   ? sequence_balance
                 : (id === 'freqmatch') ? sequence_freqmatch
                 : 'ab';
      seqSelect.value = seqVal;
```

Heutige Stelle (Z. ca. 1064–1069):

```js
  if (seqSelect) {
    seqSelect.addEventListener('change', function() {
      globalSequence = seqSelect.value;
      _syncGlobalDropdowns('sequence', seqSelect.value);
    });
  }
```

ersetzen durch:

```js
  if (seqSelect) {
    seqSelect.addEventListener('change', function() {
      if (id === 'test')      sequence_test      = seqSelect.value;
      if (id === 'balance')   sequence_balance   = seqSelect.value;
      if (id === 'freqmatch') sequence_freqmatch = seqSelect.value;
    });
  }
```

**Schritt 2d — `data-global="sequence"` und `data-global="toneType"`
entfernen.** Im sequence-Dropdown-Bau (Z. ca. 351) die Zeile
`seqSelect.dataset.global = 'sequence';` ersatzlos löschen — durch
die pro-Test-Logik werden die Dropdowns nicht mehr synchronisiert.

### 3) `js/audio.js` — globale Defaults rausziehen

**Schritt 3a — `playTone` mit explizitem `toneType`-Parameter.**

Heute (Z. 728–733):

```js
function playTone(hz, vol, ms, ramp = 50) {
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  const effectiveVol = isDeaf(activeSide) ? 0 : vol;
  return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType, ramp);
}
```

ersetzen durch:

```js
function playTone(hz, vol, ms, ramp = 50, toneType = "sine") {
  const c = gAC();
  const pan = activeSide === "left" ? -1 : 1;
  const effectiveVol = isDeaf(activeSide) ? 0 : vol;
  return playToneTyped(c, hz, effectiveVol, ms, pan, toneType, ramp);
}
```

**Schritt 3b — `playSeq` mit `opts.toneType` und `opts.aba`.**

Heute (Z. 734–760):

```js
async function playSeq(eA, eB, off) {
  const v = gVol(), d = gDur(), p = gPau();
  // ...
  await playTone(effFreq(eA), vA, d);
  // ...
  await playTone(effFreq(eB), vB, d);
  // ...
  if (globalSequence === "aba") {
    // ...
    await playTone(effFreq(eA), vA, d);
  }
  // ...
}
```

ersetzen durch (Signatur erweitert, AB/ABA aus `opts.aba`,
Tonart durchgeben):

```js
async function playSeq(eA, eB, off, opts) {
  const o = opts || {};
  const tt  = o.toneType || "sine";
  const aba = !!o.aba;
  const v = gVol(), d = gDur(), p = gPau();
  // Symmetrische Verschiebung: off/2 zu B, -off/2 zu A
  const halfOff = off / 2;
  const vA = Math.max(Math.min(v * dB2G(-halfOff), 1), 0);
  const vB = Math.max(Math.min(v * dB2G(halfOff), 1), 0);
  updInd(eA, "a");
  await playTone(effFreq(eA), vA, d, 50, tt);
  if (!isPlay) return;
  updInd(-1);
  await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
  if (!isPlay) return;
  updInd(eB, "b");
  await playTone(effFreq(eB), vB, d, 50, tt);
  if (!isPlay) return;
  if (aba) {
    updInd(-1);
    await new Promise((r) => (playTO = setTimeout(r, 50 + p)));
    if (!isPlay) return;
    updInd(eA, "a");
    await playTone(effFreq(eA), vA, d, 50, tt);
  }
  isPlay = false;
  updInd(-1);
}
```

**Schritt 3c — `playFreqPair` ersatzlos entfernen** (Z. ca. 761
bis zum Ende des Block-Endes). Die Funktion ist nirgendwo
aufgerufen.

### 4) `js/test.js` — Aufrufer auf neue Signaturen umstellen

**Schritt 4a — `playSeq` in `playCur`** (Z. 892):

```js
  playSeq(curA, curB, _testSliderVal()).then(function() {
```

ersetzen durch:

```js
  playSeq(curA, curB, _testSliderVal(), {
    toneType: toneType_test,
    aba: (sequence_test === 'aba')
  }).then(function() {
```

**Schritt 4b — `playTone` in `_testPlaySimul`** (Z. 1207–1208):

```js
  var p1 = playTone(effFreq(curA), vA, dur);
  var p2 = playTone(effFreq(curB), vB, dur);
```

ersetzen durch:

```js
  var p1 = playTone(effFreq(curA), vA, dur, 50, toneType_test);
  var p2 = playTone(effFreq(curB), vB, dur, 50, toneType_test);
```

### 5) `js/lr-balance.js` — Sequence pro Test

**Schritt 5a — `globalSequence`-Stelle** (Z. ca. 149):

```js
  if (globalSequence === "aba" && lrIsPlay) {
```

ersetzen durch:

```js
  if (sequence_balance === "aba" && lrIsPlay) {
```

### 6) `js/freqmatch.js` — Sequence pro Test

**Schritt 6a — `globalSequence`-Stelle** (Z. ca. 214):

```js
  return (typeof globalSequence !== 'undefined') ? globalSequence === "aba" : true;
```

ersetzen durch:

```js
  return sequence_freqmatch === "aba";
```

### 7) `js/file.js` — Persistenz aufräumen

**Schritt 7a — Reset-Defaults** (Z. ca. 56, im Reset-Block). Die
Zeilen, die `globalSequence`, `globalToneType` zurücksetzen,
ersatzlos entfernen. Im selben Block die drei neuen Variablen
ergänzen:

```js
  if (typeof sequence_freqmatch !== "undefined") sequence_freqmatch = "ab";
  if (typeof sequence_test      !== "undefined") sequence_test      = "ab";
  if (typeof sequence_balance   !== "undefined") sequence_balance   = "ab";
```

**Schritt 7b — Export** (Z. ca. 272–290, `serializeState`). Die
Felder

```js
    paradigm: globalSequence,
    globalSequence: globalSequence,
    globalToneType: globalToneType,
```

ersatzlos entfernen. Drei neue Felder ergänzen:

```js
    sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : "ab",
    sequence_test:      (typeof sequence_test      !== "undefined") ? sequence_test      : "ab",
    sequence_balance:   (typeof sequence_balance   !== "undefined") ? sequence_balance   : "ab",
```

**Schritt 7c — Import** (Z. ca. 596–612). Die Stellen

```js
  if (d.globalSequence) globalSequence = d.globalSequence;
  else if (d.paradigm)  globalSequence = (d.paradigm === "aba" || d.paradigm === "ab") ? d.paradigm : "aba";
  // ...
  globalToneType = isValidToneType(d.globalToneType) ? d.globalToneType : "richCiHF";
```

ersatzlos entfernen. Neue Import-Blöcke ergänzen — Migration vom
alten `globalSequence` als Fallback berücksichtigen:

```js
  function _validSeq(s) { return (s === "aba" || s === "ab") ? s : null; }
  var _legacySeq = _validSeq(d.globalSequence)
                || _validSeq(d.paradigm)
                || "ab";
  if (typeof sequence_freqmatch !== "undefined") {
    sequence_freqmatch = _validSeq(d.sequence_freqmatch) || _legacySeq;
  }
  if (typeof sequence_test !== "undefined") {
    sequence_test = _validSeq(d.sequence_test) || _legacySeq;
  }
  if (typeof sequence_balance !== "undefined") {
    sequence_balance = _validSeq(d.sequence_balance) || _legacySeq;
  }
```

In den `toneType_*`-Import-Blöcken (Z. ca. 616–660) bleibt die
`d.globalToneType`-Fallback-Lesung als Migration für alte
Speicherdateien erlaubt — das Feld wird zwar nicht mehr
geschrieben, kann aber von Altdateien noch ankommen.

### 8) `js/init.js` — Sitzungs-Persistenz aufräumen

**Schritt 8a — Lade-Seite** (Z. ca. 730–747). Die Stellen

```js
      if (d.globalToneType) globalToneType = d.globalToneType;
      // ...
      if (d.globalSequence) globalSequence = d.globalSequence;
```

ersatzlos entfernen. Lege-Migration-Fallback in den `toneType_*`-
Blöcken bleibt (analog `file.js`-Import).

Ergänzen — drei Sequence-Variablen mit Migration aus `globalSequence`
und neue Felder:

```js
      function _validSeq(s) { return (s === "aba" || s === "ab") ? s : null; }
      var _legacySeq = _validSeq(d.globalSequence) || "ab";
      if (typeof sequence_freqmatch !== "undefined") {
        sequence_freqmatch = _validSeq(d.sequence_freqmatch) || _legacySeq;
      }
      if (typeof sequence_test !== "undefined") {
        sequence_test = _validSeq(d.sequence_test) || _legacySeq;
      }
      if (typeof sequence_balance !== "undefined") {
        sequence_balance = _validSeq(d.sequence_balance) || _legacySeq;
      }
```

**Schritt 8b — Schreib-Seite** (Z. ca. 920–930). Die Felder

```js
          globalToneType: globalToneType,
          // ...
          globalSequence: globalSequence,
```

ersatzlos entfernen. Neue Felder ergänzen:

```js
          sequence_freqmatch: (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : "ab",
          sequence_test:      (typeof sequence_test      !== "undefined") ? sequence_test      : "ab",
          sequence_balance:   (typeof sequence_balance   !== "undefined") ? sequence_balance   : "ab",
```

### 9) `js/print-md.js` — Druckbericht pro Test umstellen

**Schritt 9a — `_collectGlobalTest` umbenennen und neu strukturieren**
(Z. ca. 125–139). Ersetzen durch:

```js
function _collectTestSettings() {
  function _row(toneType, sequence, duration, pause, volume) {
    return { toneType: toneType, sequence: sequence,
             duration: duration, pause: pause, volume: volume };
  }
  return {
    test: _row(
      (typeof toneType_test !== "undefined") ? toneType_test : "richCiHF",
      (typeof sequence_test !== "undefined") ? sequence_test : "ab",
      (typeof duration_test !== "undefined") ? duration_test : null,
      (typeof pause_test    !== "undefined") ? pause_test    : null,
      (typeof volume_test   !== "undefined") ? volume_test   : null
    ),
    balance: _row(
      (typeof toneType_balance !== "undefined") ? toneType_balance : "richCiHF",
      (typeof sequence_balance !== "undefined") ? sequence_balance : "ab",
      (typeof duration_balance !== "undefined") ? duration_balance : null,
      (typeof pause_balance    !== "undefined") ? pause_balance    : null,
      (typeof volume_balance   !== "undefined") ? volume_balance   : null
    ),
    freqmatch: _row(
      (typeof toneType_freqmatch !== "undefined") ? toneType_freqmatch : "richCiHF",
      (typeof sequence_freqmatch !== "undefined") ? sequence_freqmatch : "ab",
      (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : null,
      (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : null,
      (typeof volume_freqmatch   !== "undefined") ? volume_freqmatch   : null
    ),
    slTargetTest:    (typeof slTarget_test    !== "undefined") ? slTarget_test    : null,
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null
  };
}
```

**Schritt 9b — Aufrufer umbenennen** (Z. ca. 106):

```js
    globalTest: _collectGlobalTest(),
```

ersetzen durch:

```js
    testSettings: _collectTestSettings(),
```

**Schritt 9c — MD-Renderer umstellen** (Z. ca. 464–491). Aktuelle
Funktion `_archivMdGlobalTest(data)` ersetzen durch:

```js
function _archivMdTestSettings(data) {
  var TONE_LABEL_KEY = {
    richCiHF: "toneRichCiHF", richCiH: "toneRichCiH",
    richCiP:  "toneRichCiP",
    richCiB:  "toneRichCiB",  richCiBF: "toneRichCiBF",
    richCiHA: "toneRichCiHA", richCiHS: "toneRichCiHS",
    sine: "toneSine", complex: "toneComplex",
    pulsedComplex: "tonePulsedComplex", richTone: "toneRichTone",
    richAcc: "toneRichAcc", richASax: "toneRichASax",
    richBTb: "toneRichBTb", richVa:  "toneRichVa",
    richBn:  "toneRichBn",  richClBb: "toneRichClBb",
    richCb:  "toneRichCb",  richOb:   "toneRichOb",
    richTbn: "toneRichTbn", richFl:   "toneRichFl",
    richTpC: "toneRichTpC", richVn:   "toneRichVn",
    richVc:  "toneRichVc",  richHn:   "toneRichHn",
    noise: "toneNoise", noiseAdaptive: "toneNoiseAdaptive",
    irn: "toneIRN", amSine: "toneAmSine",
    warbleSine: "toneWarbleSine", burstSine: "toneBurstSine",
    wobbleSweep: "toneWobbleSweep"
  };
  var ts = data.testSettings;
  var lines = ["\n## " + t("archivSecTest") + "\n"];

  function _renderRow(testKey, headerKey, row) {
    lines.push("\n### " + t(headerKey) + "\n");
    lines.push("- " + t("toneTypeLabel") + ": "
      + t(TONE_LABEL_KEY[row.toneType] || "toneSine"));
    lines.push("- " + t("archivTestSeq") + ": "
      + String(row.sequence || "ab").toUpperCase());
    if (row.duration != null) lines.push("- " + t("lblDur") + ": " + row.duration + " ms");
    if (row.pause    != null) lines.push("- " + t("lblPau") + ": " + row.pause    + " ms");
    if (row.volume   != null) lines.push("- " + t("lblVol") + ": " + row.volume   + " %");
  }

  _renderRow("test",      "testVerfahrenFull",  ts.test);      // Elektrodenlautstärke
  _renderRow("balance",   "lrTitle",            ts.balance);   // Stereo-Balance
  _renderRow("freqmatch", "fmTitle",            ts.freqmatch); // Frequenzabgleich

  return lines.join("\n") + "\n";
}
```

Den Aufruf der alten Funktion in `_archivMd` (Z. ca. 399):

```js
    _archivMdGlobalTest(data),
```

ersetzen durch:

```js
    _archivMdTestSettings(data),
```

**Achtung:** `testVerfahrenFull`/`lrTitle`/`fmTitle` sind als
i18n-Keys schon vorhanden — daher hier kein neuer Übersetzungs-
Bedarf. Wenn der Bericht-Stil getrennte Überschriften für die
Sub-Sektionen anders haben soll (z.B. eigene Keys
`archivSecTestElektroden`, `archivSecTestBalance`,
`archivSecTestFreqmatch`), bitte vor dem Bau klären.

## Nicht ändern

- i18n-Dateien (`de.js`/`en.js`/`fr.js`/`es.js`) bleiben
  unverändert. Vorhandene Keys (`archivSecTest`, `archivTestSeq`,
  `toneTypeLabel`, `lblDur`, `lblPau`, `lblVol`,
  `testVerfahrenFull`, `lrTitle`, `fmTitle`) reichen.
- `js/sampler-keyboard.js`, `js/tone-popup.js`, `js/ui-implant.js`
  bleiben unangetastet.

## Akzeptanztest

1. App neu laden. Reiter Messungen → Sub-Reiter Frequenzabgleich.
2. Test-Kopfzeile zeigt einen Tonfolge-Dropdown (AB/ABA) und
   weder Tonart-Dropdown noch Lautstärke/Tondauer/Tonpause-Felder
   (wie nach BA 240).
3. Tonfolge auf ABA umstellen.
4. Sub-Reiter wechseln zu Elektrodenlautstärke.
5. **Erwartet:** Tonfolge dort steht weiterhin auf AB (Default) —
   die Umstellung in Frequenzabgleich hat hier nichts geändert.
6. Tonfolge in Elektrodenlautstärke auf ABA setzen, Test starten.
   **Erwartet:** Die Tonsequenz spielt Ton A, B, A.
7. Reiter Implantat öffnen, Tonart-Knopf klicken → Tonauswahl-
   Modalbox erscheint, das Klavier ist da, Probehör funktioniert
   weiter (regression-Test BA 252/253).
8. Reiter Messungen → Sub-Reiter Stereo-Balance: Tonfolge-Dropdown
   sichtbar, Tonart per Modalbox. Tonart in der Modalbox z.B. auf
   „Sinus" stellen. Test starten. **Erwartet:** Die Ton-Wiedergabe
   nutzt einen Sinus, nicht die Tonart aus Frequenzabgleich.
9. Speicher-Datei (JSON) exportieren. Öffnen → das Feld
   `globalToneType` und `globalSequence` existieren **nicht** mehr.
   Stattdessen sind `sequence_test`, `sequence_balance`,
   `sequence_freqmatch` und die Tonart-Felder pro Test vorhanden.
10. App komplett zurücksetzen, die Datei wieder importieren →
    Werte aus den drei Tests sind wiederhergestellt.
11. Eine alte Speicher-Datei (vor BA 254) importieren. **Erwartet:**
    Frequenzabgleich/Elektrodenlautstärke/Stereo-Balance bekommen
    den alten `globalSequence` als Initialwert übernommen
    (Migration in `file.js`).
12. Druckbericht öffnen (Reiter Drucken). **Erwartet:** im
    Abschnitt „Test-Einstellungen" stehen jetzt drei Unterblöcke
    (Elektrodenlautstärke / Stereo-Balance / Frequenzabgleich)
    mit jeweils eigener Tonart, Tonfolge, Tondauer, Pause,
    Lautstärke.

## Selbstprüfung an Sonnet

Vor Fertig-Meldung jede Akzeptanz-Kriterie 1.–12. einzeln
durchgehen und für jede melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

Zusätzlich vor Versand prüfen mit folgenden grep-Kommandos:

```
grep -rn "globalToneType\|globalSequence" js/
```

**Erwartet:** keine Treffer mehr (außer ggf. eine Migrations-Lese-
Stelle in `file.js` bzw. `init.js`, die explizit als „Migration
aus Alt-Format" kommentiert ist).

```
grep -rn "playFreqPair" js/
```

**Erwartet:** keine Treffer mehr.

```
grep -rn "_syncGlobalDropdowns\|syncAllGlobalDropdowns" js/
```

**Erwartet:** keine Treffer mehr.

```
grep -rn "data-global" js/ index.html
```

**Erwartet:** keine Treffer mehr (das Attribut war ausschließlich
für die globale Dropdown-Synchronisation).

Versions-Bump auf `3.2.254-beta` ist erfolgt. ASCII-Quotes in
allen Snippets.

## Hinweis am Ende

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen,
wenn der Nutzer dazu auffordert.
