# BAUANLEITUNG 104 — Adaptiver Startwert aus Schätzung + Folgelauf-Bracketing

**Voraussetzung:** BA 102 und BA 103 sind abgenommen. Slider-Vor-Schätzungen
liegen in `sideData[side].freqmatchAdaptive.sliderEstimates`. Anzeige und
Warp lesen die Schätzungen korrekt.

**Ziel:** Der adaptive Track startet jetzt **nicht mehr blind aus ±100 cent**,
sondern nimmt — falls vorhanden — die Slider-Vor-Schätzung als Startoffset.
Folgeläufe (Lauf 2+) starten aus dem **Vorlauf-Match ± 25 cent** mit
gepaartem Vorzeichen-Bracketing, statt aus ±100. Die Schrittweiten-Folge
50 → 25 → 12 → 6 → 3 cent bleibt unverändert.

**Wirkung:** Spürbare Beschleunigung des adaptiven Tests. Die Anzahl Trials
bis zur ersten Umkehrung sinkt drastisch, wenn Schätzung oder Vorlauf-Match
nahe am echten PSE liegt.

**Reihenfolge in der Serie:** 102 → 103 → **104 (dies)** → 105.

**Volumen:** ein Sonnet-Chat.

---

## 1. Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.0.104-beta";
```

---

## 2. Neue Konstante: Folgelauf-Bracketing-Offset

In `js/freqmatch-staircase.js`, im Konstanten-Block (ca. Z. 14–36),
hinzufügen:

```js
// Folgelauf-Bracketing (BA 104): bei Lauf 2+ startet jeder Track aus
// Vorlauf-Match ± FM_FOLLOWUP_BRACKET_OFFSET (cent), Vorzeichen gepaart
// alternierend. Ersetzt das ±100-cent-Bracketing aus früheren Bauanleitungen
// für den Fall „Vorlauf-Match vorhanden". Liegt deutlich enger als ±100,
// weil der Vorlauf-Match selbst schon nahe am echten PSE ist.
const FM_FOLLOWUP_BRACKET_OFFSET = 25;
```

---

## 3. `fmCreateTrack` erweitern: optionaler `startOffset`

In `js/freqmatch-staircase.js`, Funktion `fmCreateTrack` (Z. 43–65).

**Vorher:**
```js
function fmCreateTrack(electrodeIdx, startSign) {
  const START_MAG  = 100;
  const sign       = (startSign === -1) ? -1 : +1;
  const startOffset = sign * START_MAG;
  return {
    electrodeIdx:    electrodeIdx,
    startSign:       sign,
    startOffset:     startOffset,
    currentOffset:   startOffset,
    ...
  };
}
```

**Nachher:**
```js
// startSign:    +1 oder −1 (Bracketing-Vorzeichen pro Lauf).
// startOffset:  optionaler Override des Startoffsets (cent). Wenn
//               angegeben, wird er direkt als startOffset/currentOffset
//               verwendet. Wenn nicht angegeben, ergibt sich startOffset
//               aus startSign · 100 cent (alte Voreinstellung).
//               Verwendung in freqmatch.js fmStartAdaptive:
//                 - Lauf 1 mit Slider-Schätzung: startOffset = schätzung.cent
//                 - Lauf 2+ mit Vorlauf-Match:    startOffset = match ± FM_FOLLOWUP_BRACKET_OFFSET
//                 - Sonst: kein Override, klassisches ±100.
function fmCreateTrack(electrodeIdx, startSign, startOffset) {
  const START_MAG = 100;
  const sign      = (startSign === -1) ? -1 : +1;
  const effOffset = (typeof startOffset === 'number' && isFinite(startOffset))
    ? Math.round(startOffset)
    : sign * START_MAG;
  return {
    electrodeIdx:    electrodeIdx,
    startSign:       sign,
    startOffset:     effOffset,
    currentOffset:   effOffset,
    stepSize:        FM_STEP_SEQUENCE[0],
    lastMoveDir:     null,
    reversals:       [],
    trialHistory:    [],
    trialCount:      0,
    catchTotal:      0,
    catchErrors:     0,
    status:          'active',
    match:           null,
    residual:        null
  };
}
```

**Wichtig:** `startSign` bleibt im Track gespeichert (für die Bracketing-
Logik über Läufe). Auch wenn `startOffset` direkt gesetzt wird, ist
`startSign` weiterhin das Vorzeichen, das bei der Paarungslogik
verwendet wird.

---

## 4. `fmStartAdaptive` umbauen: Startwert-Bestimmung pro Track

In `js/freqmatch.js`, Funktion `fmStartAdaptive` (Z. 559–648).

Wir ändern den Bereich, in dem neue Tracks angelegt werden (Z. 614–626):

**Vorher:**
```js
fmTracks = {};
fmRoundQueue = [];
elIdxList.forEach(function(idx) {
  let sign;
  if (fmCurPairedToPrevious && prevRun && prevRun.startSigns
      && prevRun.startSigns[idx] != null) {
    sign = (prevRun.startSigns[idx] === -1) ? +1 : -1;
  } else {
    sign = (Math.random() < 0.5) ? +1 : -1;
  }
  fmTracks[fmTrackKey(idx)] = fmCreateTrack(idx, sign);
});
_fmPersist();
```

**Nachher:**
```js
fmTracks = {};
fmRoundQueue = [];

// Slider-Estimate-Quelle für Lauf 1 (kein vorheriger Lauf).
const _slStore = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                  && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};

elIdxList.forEach(function(idx) {
  // --- 1) Bracketing-Vorzeichen wie bisher ---
  let sign;
  if (fmCurPairedToPrevious && prevRun && prevRun.startSigns
      && prevRun.startSigns[idx] != null) {
    sign = (prevRun.startSigns[idx] === -1) ? +1 : -1;
  } else {
    sign = (Math.random() < 0.5) ? +1 : -1;
  }

  // --- 2) Startoffset bestimmen ---
  // Priorität (hoch → niedrig):
  //   (a) Folgelauf mit vorhandenem Vorlauf-Match für diese Elektrode:
  //       startOffset = prevMatch + sign · FM_FOLLOWUP_BRACKET_OFFSET
  //   (b) Lauf 1 ohne Vorlauf, mit Slider-Vor-Schätzung:
  //       startOffset = sliderEstimate.cent (Vorzeichen aus sign ignoriert,
  //       weil die Schätzung selbst die ungefähre Lage liefert; sign bleibt
  //       für späteres Bracketing in Lauf 2 gespeichert).
  //   (c) Sonst (kein Vorlauf-Match, keine Slider-Schätzung):
  //       startOffset = sign · 100 cent (klassische ±100-Voreinstellung).
  let startOffset;
  let prevMatchForIdx = null;
  if (prevRun && prevRun.perElectrode && prevRun.perElectrode[idx]
      && typeof prevRun.perElectrode[idx].match === 'number'
      && isFinite(prevRun.perElectrode[idx].match)) {
    prevMatchForIdx = prevRun.perElectrode[idx].match;
  }
  if (prevMatchForIdx != null) {
    // (a) Folgelauf-Bracketing um Vorlauf-Match.
    startOffset = prevMatchForIdx + sign * FM_FOLLOWUP_BRACKET_OFFSET;
  } else if (_slStore[String(idx)] != null
             && typeof _slStore[String(idx)].cent === 'number'
             && isFinite(_slStore[String(idx)].cent)) {
    // (b) Slider-Vor-Schätzung als Startwert.
    startOffset = _slStore[String(idx)].cent;
  } else {
    // (c) Klassisches ±100 cent.
    startOffset = sign * 100;
  }

  fmTracks[fmTrackKey(idx)] = fmCreateTrack(idx, sign, startOffset);
});
_fmPersist();
```

**Hinweis:** `prevRun.perElectrode[idx]` muß auch bei Folgeläufen
abgefragt werden, in denen `_fmTryRestore` nicht greift (also wenn kein
gleicher pausierter Lauf vorliegt). Bei aktivem Pause/Resume wird
`fmTracks` aus `_fmTryRestore` rekonstruiert (Z. 595), die hier
zusammengebaute Tracks würden nicht verwendet. Diese Änderung greift
also nur für **neue** Läufe — gewünscht.

---

## 5. Konsistenz-Prüfung: `fmCurPairedToPrevious` und `startOffset`

Die heutige `fmCurPairedToPrevious`-Logik (Z. 605–612) bestimmt, ob der
neue Lauf das gepaarte Bracketing-Vorzeichen des Vorgängers invertiert.
Diese Logik bleibt **unverändert** — sie steuert das Vorzeichen `sign`,
nicht den `startOffset`. Auch bei Folgeläufen mit Slider-Schätzung-
Startoffset (Fall b) bleibt `sign` für das Bracketing in Lauf 2 erhalten
(in `startSigns` gespeichert).

Edge-Case zum Bedenken: in einem Folgelauf, wo Fall (a) greift (Vorlauf-
Match vorhanden), wird `startOffset = prevMatch + sign · 25`. Hier
*kann* `startOffset` auf der „falschen" Seite des PSE landen, wenn der
Vorlauf-Match selbst stark verrauscht war. Das ist akzeptabel — die
Schrittweiten-Folge 50 → 25 → … fängt das ab.

---

## 6. SPEC-Update

In `docs/spec/02b-freqmatch-adaptiv.md`:

### 6.1 Abschnitt „Startwert pro Elektrode" anpassen

Heutiger Wortlaut (gekürzt): „`±100 cent` Cent-Offset gegenüber der
CI-Soll-Frequenz. … Kein Warmstart aus alten Matches; jeder Lauf startet
aus ±100 cent."

**Ersetzen durch** etwa folgenden Wortlaut (Sonnet, bitte sinngemäß
einbauen, exakter Stil wie der Rest der Spec):

> **Startwert pro Elektrode:** Der Startoffset wird in einer dreistufigen
> Priorität bestimmt:
>
> 1. **Folgelauf mit vorhandenem Vorlauf-Match** (Lauf 2+, `prevRun.perElectrode[idx].match` existiert):
>    Startoffset = `prevMatch + sign · 25 cent` (Konstante
>    `FM_FOLLOWUP_BRACKET_OFFSET = 25`). Vorzeichen `sign` ergibt sich aus
>    der gepaarten Bracketing-Logik (s. u.). Damit wird der bekannte
>    Match aus zwei Richtungen mit kleinem Offset eingeschlossen, statt
>    aus ±100 cent neu zu suchen — drastisch schnellere Konvergenz bei
>    nicht-trivialen Mismatches.
> 2. **Lauf 1 mit Slider-Vor-Schätzung** (`sliderEstimates[idx]` vorhanden):
>    Startoffset = Schätzungs-Cent. Das Vorzeichen `sign` wird trotzdem
>    bestimmt und gespeichert (für Lauf 2-Bracketing), beeinflußt den
>    Startoffset in Lauf 1 aber nicht.
> 3. **Sonst (klassisch):** Startoffset = `sign · 100 cent`,
>    Vorzeichen zufällig in Lauf 1, alterniert in Lauf 2 (wie heute).
>
> Die **gepaarte Bracketing-Logik** für Vorzeichen `sign` bleibt
> unverändert: Lauf 2 invertiert pro Elektrode das Vorzeichen aus Lauf 1
> (sofern Lauf 1 selbst „ungepaart" war). Die Schrittweiten-Folge
> 50 → 25 → 12 → 6 → 3 cent bleibt unverändert; eine gute Startposition
> spart Trials in der ersten 50er-Phase, nicht in der Konvergenz-Phase.

### 6.2 Abschnitt „Bekannte Bias-Quellen" — Hinweis ergänzen

Im Unterpunkt „Startpunkt-Bias" am Ende ergänzen:

> Diese Bauanleitung 104 ändert das Verfahren: statt ausschließlich
> aus ±100 cent zu starten, kann der Track aus einer Slider-Vor-Schätzung
> oder einem Vorlauf-Match starten. Der Bias-Schutz durch das gepaarte
> Vorzeichen-Bracketing bleibt für Lauf 2+ erhalten (Vorzeichen
> alterniert), nur der Startoffset ist enger gewählt. In Lauf 1 mit
> Slider-Schätzung ist die Streuung niedriger, aber das mittlere
> Vorzeichen ist nicht mehr ±-symmetrisch — der Bias-Schutz hängt dann
> stärker am Folgelauf.

---

## 7. CODESTRUKTUR-Update

In `docs/CODESTRUKTUR.md`:

- `freqmatch-staircase.js`-Eintrag: neue Konstante `FM_FOLLOWUP_BRACKET_OFFSET = 25` in der Konstanten-Auflistung ergänzen. `fmCreateTrack`-Signatur auf `(electrodeIdx, startSign, startOffset?)` aktualisieren.
- `freqmatch.js`-Eintrag: ergänzen — „Seit BA 104: `fmStartAdaptive` bestimmt den Track-Startoffset dreistufig: (a) Folgelauf-Bracketing aus `prevRun.perElectrode[idx].match ± FM_FOLLOWUP_BRACKET_OFFSET`, (b) Slider-Vor-Schätzung aus `sliderEstimates[idx]`, (c) klassisches ±100 cent. `_slStore`-Lookup auf `sideData[fmVarSide].freqmatchAdaptive.sliderEstimates`."

---

## 8. Akzeptanztest-Checkliste

Vorbereitung: BA 102 + 103 abgenommen. localStorage leer, `sideData.*.freqmatchAdaptive`
neu.

1. **Klassischer Fall ohne Schätzung, ohne Vorlauf.** Slider-Vor-Schätzung
   für KEINE Elektrode vorhanden. Adaptiven Test starten. **Erwartet:** Im
   Konsolen-Output (`fmTracks[<key>].startOffset`) steht entweder +100 oder
   −100. Klassisches Verhalten.
2. **Slider-Schätzung für eine Elektrode.** Vorher per Slider-Modus eine
   Schätzung von z. B. +180 cent für Elektrode 5 setzen. Adaptiven Test
   starten. **Erwartet:** Für Track-Key „5" ist `startOffset ≈ 180` (kann
   gerundet sein). Für andere Elektroden klassisches ±100.
3. **Adaptiven Test bis Konvergenz für Elektrode 5 durchlaufen.**
   **Erwartet:** Die erste Umkehrung kommt deutlich früher als ohne
   Schätzung — anstatt nach 3-8 Trials schon nach 1-3 Trials (je nach
   Schätzgenauigkeit). Konvergenz-Ergebnis liegt in `fRes` mit Status
   `converged*`.
4. **Lauf 1 vollständig abschließen.** Mind. eine Elektrode konvergiert,
   `runs[0].perElectrode[<idx>].match` enthält einen Cent-Wert.
5. **Lauf 2 starten.** Bestätigungsdialog mit „N=1 Lauf gespeichert"
   erscheint, mit Hinzufügen bestätigen. **Erwartet:** Beim Track-Aufbau
   wird `startOffset = prevMatch + sign · 25` gesetzt. Konsolen-Check:
   `fmTracks[<key>].startOffset` liegt nahe `runs[0].perElectrode[<idx>].match` (±25 cent).
   `fmTracks[<key>].startSign` ist das **invertierte** Vorzeichen aus
   `runs[0].startSigns[<idx>]`.
6. **Lauf 2 für eine Elektrode bis Konvergenz durchlaufen.**
   **Erwartet:** Erste Umkehrung sehr früh (≤ 2 Trials), Konvergenz
   schnell. Der Match in Lauf 2 weicht typisch ≤ 10–20 cent vom Lauf-1-
   Match ab (psychometrische Streuung).
7. **Lauf 3 starten.** Diesmal sollte der Lauf gemäß
   „pairedToPrevious"-Regel ein **neues Paar beginnen** (Lauf 2 war
   gepaart, Lauf 3 startet ungepaart, Vorzeichen pro Elektrode wieder
   zufällig). `startOffset` für Elektroden mit Vorlauf-Match: aus
   `prevMatch ± 25` (auf Basis Lauf 2). Sonnet bitte verifizieren, daß
   die Paarungslogik weiterhin korrekt zyklisch ist.
8. **Edge-Case Pause/Resume:** Lauf abbrechen während aktiv, dann
   wieder starten. **Erwartet:** `_fmTryRestore` greift, die geänderte
   Startoffset-Logik wird NICHT erneut angewandt (Tracks kommen aus dem
   gespeicherten State). Tracks haben weiterhin ihren ursprünglichen
   `startOffset` aus dem Lauf-Anfang.
9. **Edge-Case Slider-Schätzung außerhalb ±100 cent:** Wert von z. B.
   +280 cent setzen, Lauf 1 starten. **Erwartet:** `startOffset = 280`,
   keine Begrenzung auf ±100. Schrittweiten-Folge bleibt 50 → 25 → …,
   die ersten 50er-Schritte greifen in Richtung des echten PSE.
10. **Edge-Case Slider-Schätzung 0 cent:** Wert von genau 0 setzen.
    **Erwartet:** `startOffset = 0`. Track macht den ersten 50er-Schritt
    in die Richtung der ersten Antwort. Kein Sonderfall, einfach kleiner
    Startoffset.

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede der 10 Akzeptanz-Kriterien einzeln mit
**erfüllt / nicht erfüllt / unklar** und Datei+Zeile melden.

Zusätzlich prüfen:
- **State-Mutation in `fmCreateTrack`:** keine Reassignment-Falle —
  `fmCreateTrack` gibt ein neues Track-Objekt zurück, das vom Aufrufer
  in `fmTracks[<key>]` gespeichert wird. Saubere Rückgabe-API.
- **Edge-Case `prevRun.perElectrode` fehlt:** in alten Lauf-Datensätzen
  (z. B. nach BA 100, die das Schema einführte) kann `perElectrode` undefined
  sein. Der `prevMatchForIdx != null`-Check fängt das. Bitte
  manuell verifizieren — wenn `perElectrode` fehlt, fällt der Code auf
  Fall (b) oder (c).
- **Zwei Schwellen-Falle:** Diese Anleitung bringt eine **einzige** neue
  Konstante (`FM_FOLLOWUP_BRACKET_OFFSET = 25`). Sicherstellen, daß sie
  an exakt einer Stelle im Code-Snippet referenziert wird (in
  `fmStartAdaptive`), nicht über mehrere `25`-Magic-Numbers verstreut.
- **Edge-Case Folgelauf ohne Vorlauf-Match für eine bestimmte Elektrode**
  (z. B. weil im Vorlauf die Elektrode `not-perceivable` war oder
  `aborted`): `prevRun.perElectrode[idx].match` ist `null`. Der
  `prevMatchForIdx != null && isFinite(...)`-Check muß das abfangen
  und auf Fall (b) oder (c) fallen.
- **Spec-Konsistenz:** Der bisherige Spec-Satz „Kein Warmstart aus
  alten Matches" ist nach BA 104 falsch. Sonnet bitte sicherstellen,
  daß er **vollständig entfernt oder umformuliert** ist; sonst bleibt
  die Spec selbstwidersprüchlich.

---

## 10. Hinweis: keine i18n-Änderungen

BA 104 bringt keine neuen UI-Texte. Falls Sonnet beim Bauen Texte
einführen möchte (z. B. einen Konsolen-Log-Text), bitte als
englischsprachigen `console.log` lassen, nicht in `i18n/de.js`.

---

## 11. Verweis auf die nächste Bauanleitung

Nach BA 104 ist die Vor-Schätzung wirksam — Tests werden im typischen
Fall (Mismatch >100 cent) deutlich kürzer. **Aber Tracks mit lange
fehlender erster Umkehrung** (z. B. ohne Schätzung, klassisches ±100,
echter Mismatch nahe 300 cent) leiden weiter. Das adressiert BA 105
(Catch-up-Priorisierung): pro Runde bekommt ein Track mit 0-1
Umkehrungen ein Bonus-Trial.

Vor Beginn BA 105: BA 104 abnehmen lassen.
