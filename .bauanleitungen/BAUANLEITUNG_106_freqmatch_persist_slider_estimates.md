# BAUANLEITUNG 106 — Laden/Speichern: Slider-Estimates Persistenz + Alt-fRes-Migration

**Voraussetzung:** BA 102–105 sind abgenommen. Slider-Vor-Schätzungen
leben in `sideData[side].freqmatchAdaptive.sliderEstimates`, fließen in
Anzeige und Test-Start ein, und die Catch-up-Priorisierung läuft.

**Ziel:** Persistenz für Slider-Estimates vollständig durchziehen und
**alte klassische Slider-Daten aus `fRes` als Vor-Schätzungen
übernehmen**, statt sie zu verwerfen. Drei Punkte:

1. **Speicherung verifizieren** (JSON-Save + Autosave): Slider-Estimates
   werden über das `freqmatchAdaptive`-Sub-Objekt automatisch
   mitgesichert.
2. **Default für `sliderEstimates` in `_fmMigrateAdaptive`** verbindlich
   verankern (war in BA 102 §5.1 angekündigt).
3. **Migration Alt-Slider-fRes → `sliderEstimates`:** Bestehende
   `fRes`-Einträge ohne `fmStatus` stammen aus dem klassischen
   Slider-Modus vor BA 102. Statt sie zu verwerfen (wie es heute der
   Filter in `file.js` Z. 487 tut) werden sie beim Laden in
   `sideData[varSide].freqmatchAdaptive.sliderEstimates` migriert und
   aus `fRes` entfernt — die Werte stehen damit als Startwerte für den
   adaptiven Test bereit.

**Reihenfolge in der Serie:** 102 → 103 → 104 → 105 → **106 (dies)**.

**Volumen:** ein Sonnet-Chat.

---

## 1. Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.0.106-beta";
```

---

## 2. Speicherung von `sliderEstimates` verifizieren

### 2.1 JSON-Save (`js/file.js`)

`file.js` Z. 115 und Z. 136 speichern bereits:
```js
freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
```
und entsprechend für right.

Da `sliderEstimates` ein Unterfeld dieses Objekts ist, wird es
automatisch mitgespeichert. **Keine Code-Änderung nötig.** Sonnet
bitte nur verifizieren: nach einem Slider-Vor-Schätzungs-Lauf eine
JSON-Datei exportieren, im Editor öffnen, in
`sides.<side>.freqmatchAdaptive.sliderEstimates` die Einträge prüfen.

### 2.2 Autosave (`js/init.js`)

`init.js` Z. 793 und Z. 811 speichern analog dasselbe Objekt.
Auch hier wird `sliderEstimates` automatisch mitgenommen.
**Keine Code-Änderung nötig.** Sonnet bitte verifizieren mit hartem
Reload (Strg+F5): die Werte überleben.

---

## 3. `_fmMigrateAdaptive`: `sliderEstimates`-Default sicherstellen

Diese Änderung war in BA 102 §5.1 vorgeschrieben. **Hier nochmal
verbindlich prüfen und ggf. nachziehen**, falls Sonnet sie in BA 102
übersehen oder gelöst hat, der Default aber nicht greift.

In `js/state-side.js`, Funktion `_fmMigrateAdaptive` (Z. 209–224).

**Ziel-Stand nach BA 106:**
```js
function _fmMigrateAdaptive(fa) {
  if (!fa) return null;
  if (!Array.isArray(fa.runs)) return null;   // Vor-runs[]-Schemas → weg

  // Wenn irgendein Lauf noch das alte 2-Track-Key-Schema ':up'/':down' hat,
  // ist das gesamte Aggregat nicht mehr verlässlich aggregierbar → verwerfen.
  for (let i = 0; i < fa.runs.length; i++) {
    const r = fa.runs[i];
    if (!r || !r.tracks) continue;
    const keys = Object.keys(r.tracks);
    for (let j = 0; j < keys.length; j++) {
      if (keys[j].indexOf(':') >= 0) return null;
    }
  }

  // BA 102/106: sliderEstimates-Default. Wenn das Feld fehlt oder
  // beschädigt ist (kein Objekt), auf {} setzen — sonst übernehmen.
  if (!fa.sliderEstimates || typeof fa.sliderEstimates !== 'object'
      || Array.isArray(fa.sliderEstimates)) {
    fa.sliderEstimates = {};
  }

  return fa;
}
```

**Wichtig:** wenn `_fmMigrateAdaptive` das ganze Objekt verwirft
(`return null`), gehen vorhandene `sliderEstimates` mit verloren. Das
ist beabsichtigt und konsistent: wer noch im Vor-`runs[]`-Schema
gespeichert hat, hat ohnehin Daten, die mit dem aktuellen Schema nicht
kompatibel sind.

---

## 4. Alt-fRes → `sliderEstimates` migrieren (Kern dieser BA)

### 4.1 Neue Funktion in `state-side.js`

In `js/state-side.js`, **direkt unter `_fmMigrateAdaptive`**
(ca. nach Z. 224), folgende neue Funktion ergänzen:

```js
// Migriert Alt-Slider-Einträge aus fRes nach
// sideData[varSide].freqmatchAdaptive.sliderEstimates.
//
// Hintergrund: bis BA 102 schrieb der klassische Slider-Modus seine
// Werte direkt in fRes — ohne fmStatus-Feld, weil der Eintrag als
// finaler Wert galt. Ab BA 102 lebt der Slider-Modus als Vor-Schätzung
// in freqmatchAdaptive.sliderEstimates; fRes enthält nur noch adaptive
// Mess-Ergebnisse (mit fmStatus). Alte fRes-Einträge ohne fmStatus sind
// Klassisch-Slider-Werte und werden hier in die neue Datenstruktur
// überführt, damit sie als Startwerte für einen anschließenden adaptiven
// Test wieder zur Verfügung stehen.
//
// Vorrang-Regel: wenn für eine (varSide, elIdx)-Kombination bereits ein
// sliderEstimate existiert (neuere Daten, BA 102+), bleibt dieser
// erhalten — der Alt-Eintrag wird verworfen.
//
// Wird in file.js (JSON-Load) und init.js (Autosave-Load) NACH
// _fmCleanupLegacyFRes() aufgerufen.
function _fmMigrateAltSliderFRes() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return;
  if (typeof sideData === 'undefined') return;

  for (let i = fRes.length - 1; i >= 0; i--) {
    const r = fRes[i];
    if (!r) continue;
    if (r.fmStatus != null) continue;   // adaptive Einträge bleiben unangetastet

    const side = r.varSide;
    if (side !== 'left' && side !== 'right') {
      fRes.splice(i, 1);   // korrupte Seite: still verwerfen
      continue;
    }
    const sd = sideData[side];
    if (!sd) { fRes.splice(i, 1); continue; }

    const elIdx = r.elIdx;
    if (typeof elIdx !== 'number') { fRes.splice(i, 1); continue; }
    const nElSide = sd.nEl || 22;
    if (elIdx < 0 || elIdx >= nElSide) { fRes.splice(i, 1); continue; }

    if (typeof r.varFreq !== 'number' || typeof r.refFreq !== 'number'
        || r.varFreq <= 0 || r.refFreq <= 0) {
      fRes.splice(i, 1); continue;
    }

    // freqmatchAdaptive-Container ggf. anlegen
    if (!sd.freqmatchAdaptive) {
      sd.freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} };
    }
    if (!sd.freqmatchAdaptive.sliderEstimates
        || typeof sd.freqmatchAdaptive.sliderEstimates !== 'object'
        || Array.isArray(sd.freqmatchAdaptive.sliderEstimates)) {
      sd.freqmatchAdaptive.sliderEstimates = {};
    }
    const store = sd.freqmatchAdaptive.sliderEstimates;

    // Vorrang: existierender neuer sliderEstimate gewinnt.
    if (store[String(elIdx)] != null) {
      fRes.splice(i, 1);
      continue;
    }

    const cent = Math.round(1200 * Math.log2(r.refFreq / r.varFreq));
    store[String(elIdx)] = {
      cent:      cent,
      varSide:   r.varSide,
      refSide:   r.refSide || (side === 'left' ? 'right' : 'left'),
      varFreq:   r.varFreq,
      timestamp: (typeof r.timestamp === 'number') ? r.timestamp : Date.now()
    };
    fRes.splice(i, 1);
  }
}
```

**State-Mutation-Hinweis:** `store` ist eine Referenz auf das in
`sd.freqmatchAdaptive.sliderEstimates` lebende Objekt; das `store[...] = ...`
mutiert es in-place. Die Initialisierung über `if (!sd.freqmatchAdaptive)`
führt ggf. ein Reassignment auf `sd.freqmatchAdaptive` ein — `sd` selbst
ist die Referenz aus `sideData[side]`, das Reassignment ist also
auf `sideData[side].freqmatchAdaptive` und vom Aufrufer sichtbar.
Sonnet bitte verifizieren.

### 4.2 Aufruf in `js/file.js` (JSON-Load)

In `js/file.js` Z. 485–493:

**Vorher:**
```js
if (typeof fRes !== "undefined") {
  if (Array.isArray(d.fRes)) {
    const adaptiveOnly = d.fRes.filter(function(r) { return r.fmStatus != null; });
    fRes.splice(0, fRes.length, ...adaptiveOnly);
  } else {
    fRes.splice(0, fRes.length); // keine fRes im JSON → zurücksetzen
  }
  if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
}
```

**Nachher:**
```js
if (typeof fRes !== "undefined") {
  if (Array.isArray(d.fRes)) {
    // BA 106: KEIN fmStatus-Filter mehr — alle Einträge übernehmen.
    // _fmCleanupLegacyFRes() entfernt Alt-Adaptive-Schema-Einträge
    // (mit fmConvUp etc.). _fmMigrateAltSliderFRes() überführt
    // Alt-Slider-Einträge (ohne fmStatus) nach
    // freqmatchAdaptive.sliderEstimates, damit sie als Startwerte
    // für den adaptiven Test verfügbar sind.
    fRes.splice(0, fRes.length, ...d.fRes);
  } else {
    fRes.splice(0, fRes.length); // keine fRes im JSON → zurücksetzen
  }
  if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
  if (typeof _fmMigrateAltSliderFRes === "function") _fmMigrateAltSliderFRes();
}
```

### 4.3 Aufruf in `js/init.js` (Autosave-Load)

In `js/init.js` Z. 696–699:

**Vorher:**
```js
if (Array.isArray(d.fRes) && typeof fRes !== "undefined") {
  fRes.splice(0, fRes.length, ...d.fRes);
  if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
}
```

**Nachher:**
```js
if (Array.isArray(d.fRes) && typeof fRes !== "undefined") {
  // BA 106: KEIN Filter, dieselbe Migrations-Sequenz wie in file.js.
  fRes.splice(0, fRes.length, ...d.fRes);
  if (typeof _fmCleanupLegacyFRes === "function") _fmCleanupLegacyFRes();
  if (typeof _fmMigrateAltSliderFRes === "function") _fmMigrateAltSliderFRes();
}
```

**Reihenfolgen-Hinweis:** in beiden Pfaden sind `loadSideData("left", ...)`
und `loadSideData("right", ...)` schon **vor** dem fRes-Load gelaufen
(file.js: Z. ~80ff; init.js: Z. 613–625). Damit ist `sideData[<side>].nEl`
und ggf. ein migriertes `freqmatchAdaptive`-Objekt verfügbar, wenn
`_fmMigrateAltSliderFRes` läuft. Sonnet bitte kurz prüfen, daß die
Reihenfolge in beiden Pfaden tatsächlich `loadSideData → fRes-Load →
_fmCleanupLegacyFRes → _fmMigrateAltSliderFRes` ist.

---

## 5. Edge-Cases prüfen

Vor Versand: folgende fünf Lade-Szenarien gedanklich durchspielen und
auf Konsistenz prüfen.

### 5.1 Neuanwender ohne jegliche Daten

`freqmatchAdaptive === null`, `fRes === []`.
→ `_fmMigrateAdaptive(null)` gibt `null` zurück.
→ `_fmMigrateAltSliderFRes` läuft über leeres `fRes`, tut nichts.

**Erwartet:** sauberer Erstkontakt.

### 5.2 User mit altem Stand: nur klassische Slider-Werte in `fRes`

Datei vor BA 102: `freqmatchAdaptive === null`, `fRes` enthält 8
Slider-Einträge ohne `fmStatus`.
→ `loadSideData` läuft, `freqmatchAdaptive` bleibt `null`.
→ `fRes.splice(0, fRes.length, ...d.fRes)` übernimmt alle 8.
→ `_fmCleanupLegacyFRes` läßt sie durch (keine `fmConvUp`-Felder).
→ `_fmMigrateAltSliderFRes` läuft pro Eintrag: legt
`sideData[<side>].freqmatchAdaptive = { runs:[], currentRunIdx:null, sliderEstimates:{} }`
an, befüllt `sliderEstimates[<elIdx>]`, entfernt den `fRes`-Eintrag.
→ Nach der Migration: `fRes === []`, `sliderEstimates` enthält 8
Einträge.

**Erwartet:** Die alten Slider-Werte sind als Vor-Schätzungen
verfügbar. Tabelle (BA 103) zeigt sie als „🎚 Vor-Schätzung"-Zeilen.
Adaptiver Test (BA 104) nimmt sie als Startwerte.

### 5.3 User mit Mischstand: Alt-Slider + neue Adaptive-Einträge

Datei aus späterer Bauphase: `fRes` enthält 3 Alt-Slider-Einträge (kein
`fmStatus`) und 4 Adaptive-Einträge (mit `fmStatus`).
→ `_fmCleanupLegacyFRes` läßt alle durch.
→ `_fmMigrateAltSliderFRes` migriert nur die 3 ohne `fmStatus`.
→ Nach: `fRes` enthält die 4 Adaptive, `sliderEstimates` enthält die 3
Slider.

**Erwartet:** Adaptive Daten bleiben in `fRes`, Slider werden zu
Vor-Schätzungen. Wenn die jeweilige Elektrode auch einen `fRes`-Eintrag
hat (Adaptive), sehen die Lese-Pfade (`_warpFResSource`) den Slider-
Estimate nicht — Adaptive hat Vorrang (Stufe 1 vor Stufe 3).

### 5.4 User mit Doppel-Daten: neuer sliderEstimate UND Alt-fRes für dieselbe Elektrode

Möglich, wenn nach BA 102 schon eine Vor-Schätzung gemacht wurde und
parallel Altdaten dieser Elektrode in `fRes` liegen (z. B. aus Import).
→ `_fmMigrateAltSliderFRes` prüft `store[String(elIdx)] != null`,
findet den neuen Eintrag — neuer gewinnt, Alt-Eintrag wird verworfen.

**Erwartet:** Neuer sliderEstimate bleibt unverändert. Konsistenz mit
„neue Daten gewinnen".

### 5.5 User mit Vor-`runs[]`-Stand UND Alt-Slider-fRes

`freqmatchAdaptive` hat kein `runs[]`-Array (sehr alter Stand) →
`_fmMigrateAdaptive` verwirft auf `null`. `fRes` enthält Alt-Slider.
→ `_fmMigrateAltSliderFRes` legt `freqmatchAdaptive` neu an
(`runs:[], currentRunIdx:null, sliderEstimates:{}`) und befüllt es mit
den migrierten Slidern.

**Erwartet:** Adaptive Schema ist sauber neu (kein Schemawechsel-Problem),
Slider als Vor-Schätzung verfügbar. Beste Ausgangslage für einen
adaptiven Erstlauf.

---

## 6. CODESTRUKTUR-Update

In `docs/CODESTRUKTUR.md`:

- `state-side.js`-Eintrag: ergänzen — „Seit BA 106:
  `_fmMigrateAltSliderFRes()` überführt Alt-Slider-fRes-Einträge (ohne
  `fmStatus`) in `sideData[varSide].freqmatchAdaptive.sliderEstimates`
  und entfernt sie aus `fRes`. Wird in `file.js` und `init.js` nach
  `_fmCleanupLegacyFRes()` aufgerufen. `_fmMigrateAdaptive` defaultet
  `fa.sliderEstimates = {}`, wenn das Feld fehlt."
- `file.js`-Eintrag: ergänzen — „Seit BA 106: kein `fmStatus`-Filter
  mehr beim fRes-Load; stattdessen Sequenz `_fmCleanupLegacyFRes`
  (Alt-Adaptive-Schema) und `_fmMigrateAltSliderFRes` (Alt-Slider →
  Vor-Schätzung). Slider-Estimates über das `freqmatchAdaptive`-
  Sub-Objekt automatisch mitgesichert."
- `init.js`-Eintrag: ergänzen — „Seit BA 106: Autosave-Load nutzt die
  gleiche Migrations-Sequenz wie der JSON-Load. Filter-Konsistenz
  zwischen beiden Pfaden."

---

## 7. SPEC-Update

In `docs/spec/02b-freqmatch-adaptiv.md`, Abschnitt **„Storage" →
„Altdaten-Behandlung"** ersetzen durch:

> **Altdaten-Behandlung (BA 100 + 106):**
> - Vorhandene `freqmatchAdaptive`-Objekte ohne `runs[]`-Array oder mit
>   dem alten 2-Track-Schema (Keys `<idx>:up`, `<idx>:down`) werden beim
>   Laden **verworfen** (Sub-Objekt auf `null` gesetzt). Es gibt keine
>   Migration dieser Adaptive-Daten.
> - Alte `fRes`-Einträge mit den Detail-Feldern `fmConvUp`/`fmConvDown`/
>   `fmTrackDiff`/`fmStatusUpLast`/`fmStatusDownLast` stammen aus dem
>   alten 2-Track-Adaptive-Schema und werden über `_fmCleanupLegacyFRes()`
>   entfernt.
> - **`fRes`-Einträge ohne `fmStatus`-Feld** stammen aus dem klassischen
>   Slider-Modus (vor BA 102) und werden ab BA 106 **als Vor-Schätzungen
>   übernommen**: `_fmMigrateAltSliderFRes()` schreibt sie nach
>   `sideData[varSide].freqmatchAdaptive.sliderEstimates[elIdx]` und
>   entfernt sie aus `fRes`. Damit stehen die Werte als Startwerte für
>   den adaptiven Test bereit (siehe BA 104). Vorrang-Regel: wenn ein
>   neuerer `sliderEstimates`-Eintrag (BA 102+) für dieselbe Elektrode
>   bereits existiert, bleibt dieser erhalten und der Alt-Eintrag wird
>   verworfen.

---

## 8. Akzeptanztest-Checkliste

### 8.1 Persistenz neuer Slider-Estimates über JSON

1. Frischer Browser-Tab, alle Daten leer.
2. Slider-Modus, 2 Vor-Schätzungen für 2 Elektroden setzen.
3. JSON-Export. Im Editor in `sides.<side>.freqmatchAdaptive.sliderEstimates`
   die 2 Einträge prüfen.
4. Browser-Tab schließen, neu öffnen.
5. JSON-Import. **Erwartet:** Slider-Estimates erscheinen wieder in der
   Tabelle, `fRes === []`.

### 8.2 Persistenz neuer Slider-Estimates über Autosave (Reload)

1. Mit den Daten aus 8.1 harten Reload (Strg+F5).
2. **Erwartet:** Slider-Estimates aus localStorage wiederhergestellt;
   in der Tabelle weiter sichtbar.

### 8.3 Migration Alt-Slider-fRes → sliderEstimates (JSON)

1. Eine alte JSON-Datei mit Alt-Slider-fRes-Einträgen vorbereiten:
   ```json
   {
     "sides": { "left": { ... }, "right": { ... } },
     "fRes": [
       { "varSide": "right", "refSide": "left", "elIdx": 5,
         "varFreq": 1500, "refFreq": 1620, "timestamp": 1700000000000 },
       { "varSide": "right", "refSide": "left", "elIdx": 11,
         "varFreq": 4900, "refFreq": 5300, "timestamp": 1700000060000 }
     ]
   }
   ```
   (oder eine echte Datei aus Martin's Datenbestand vor BA 102
   verwenden).
2. Datei laden.
3. **Erwartet nach dem Laden:**
   - `fRes` ist **leer** (oder enthält nur etwaige adaptive Einträge).
   - `sideData.right.freqmatchAdaptive.sliderEstimates['5']` und `['11']`
     existieren mit `cent ≈ +132` (E5) und `cent ≈ +136` (E11).
     (Cent-Werte sind `1200 · log2(refFreq/varFreq)`, gerundet.)
4. Tab Meßergebnisse → Frequenzabgleich. **Erwartet:** Tabelle zeigt
   die zwei Elektroden mit dem Badge „🎚 Vor-Schätzung", kursiv, Cent-
   Werte plausibel.
5. Adaptiven Test starten. **Erwartet:** Die Tracks für E5 und E11
   starten aus `startOffset ≈ +132` bzw. `+136` (Konsolen-Check
   `fmTracks['5'].startOffset`, `fmTracks['11'].startOffset`).

### 8.4 Migration über Autosave-Pfad

1. Per Konsole `localStorage.setItem('audioState', ...)` mit demselben
   Alt-fRes-Inhalt wie in 8.3 setzen.
2. Browser-Reload.
3. **Erwartet:** identisches Verhalten wie 8.3 — Migration ist im
   Autosave-Pfad genauso aktiv.

### 8.5 Vorrang neuer Daten bei Konflikt

1. Frisch starten. Per Slider-Modus für E5 eine Vor-Schätzung mit z. B.
   +80 cent setzen.
2. Per Konsole einen Alt-fRes-Eintrag für dieselbe Elektrode setzen:
   ```js
   fRes.push({
     varSide: 'right', refSide: 'left', elIdx: 5,
     varFreq: 1500, refFreq: 1620, timestamp: 1700000000000
   });
   ```
3. JSON-Export, Browser-Tab neu, JSON-Import.
4. **Erwartet:** `sliderEstimates['5'].cent === 80` (der neue Wert hat
   gewonnen). `fRes` ist leer (der Alt-Eintrag wurde verworfen, nicht
   migriert).

### 8.6 Alt-Adaptive-Einträge (`fmConvUp` etc.) bleiben entfernt

1. JSON mit Alt-2-Track-fRes-Einträgen vorbereiten (siehe
   `_fmCleanupLegacyFRes`-Felder: `fmConvUp`, `fmConvDown`, `fmTrackDiff`,
   `fmStatusUpLast`, `fmStatusDownLast`).
2. Laden.
3. **Erwartet:** `_fmCleanupLegacyFRes` greift VOR `_fmMigrateAltSliderFRes`
   und entfernt sie. Sie tauchen nicht als Slider-Estimates auf.

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der sechs Akzeptanz-Sektionen einzeln mit
**erfüllt / nicht erfüllt / unklar** und Datei+Zeile melden.

Zusätzlich prüfen:
- **Reihenfolge der Aufrufe:** in `file.js` und `init.js`:
  `loadSideData → fRes-Load → _fmCleanupLegacyFRes → _fmMigrateAltSliderFRes`.
  Bitte den jeweils konkreten Block kommentieren und bestätigen, daß
  die Reihenfolge stimmt. **Falle:** wenn `_fmMigrateAltSliderFRes` vor
  `loadSideData` läuft, ist `sideData[<side>]` noch nicht initialisiert
  → Einträge werden verworfen statt migriert.
- **State-Mutation:** `_fmMigrateAltSliderFRes` mutiert `fRes` in-place
  (`splice`) und `sideData[side].freqmatchAdaptive.sliderEstimates`
  ebenfalls in-place. Bei nicht existierendem
  `sd.freqmatchAdaptive` wird ein neues Objekt zugewiesen — das ist
  Reassignment auf `sideData[side].freqmatchAdaptive` und sichtbar
  für spätere Leser.
- **Edge-Case Doppel-Daten 8.5:** Vorrang-Logik (neuer
  `sliderEstimate` gewinnt) explizit verifizieren.
- **Cent-Berechnung:** `1200 * Math.log2(r.refFreq / r.varFreq)` —
  Vorzeichen-Konvention identisch zu fRes-Speicherkonvention. Für
  `refFreq > varFreq` ist `cent > 0` (Referenz höher als variable
  Seite). Diese Konvention paßt zu fmCents in `freqmatch.js` Z. 93
  (`fmCents(refHz, hz)`). Sonnet bitte einmal mit konkreten Zahlen
  (1500 / 1620) nachrechnen: cent ≈ +133.
- **Zwei Schwellen-Falle:** Diese Anleitung führt keine neuen Schwellen
  ein, sondern arbeitet mit existierenden Daten. Keine Falle.
- **i18n:** keine neuen Strings nötig.

---

## 10. Hinweis: keine i18n-Änderungen

BA 106 berührt keine UI-Texte.

---

## 11. Abschluß der erweiterten Serie 102–106

| BA | Wirkung |
|----|---------|
| 102 | Slider-Vor-Schätzung als Workflow vor adaptivem Test. |
| 103 | Slider-Schätzungen in Tabelle, Chart, Druck, Player-Warp sichtbar. |
| 104 | Adaptiver Track startet aus Schätzung oder Vorlauf-Match. |
| 105 | Catch-up-Bonus pro Runde für hinten-dran-Tracks. |
| 106 | Slider-Persistenz + Alt-fRes-Migration als Vor-Schätzungen. |

Nach Abnahme BA 106: spätere Mini-Anleitung für en/fr/es-Übersetzungen
der in BA 102 + 103 eingeführten Strings.
