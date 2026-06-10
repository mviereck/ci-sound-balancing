# BA 94 — Zwei verschränkte Staircases pro Elektrode

## Ziel

Pro Elektrode laufen **zwei verschränkte adaptive Staircases**:

- **Track-up** startet bei `+100 ct` (Ref-Frequenz oberhalb der CI-Soll-
  Frequenz). Wandert von oben Richtung Match.
- **Track-down** startet bei `−100 ct`. Wandert von unten Richtung Match.

Der elektroden-finale Match ist der **Mittelwert der beiden Konvergenz-
punkte**. Das eliminiert zwei systematische Bias-Quellen gleichzeitig:

- den 2-down-1-up-Bias (eine einzelne Staircase konvergiert auf den
  70,7-%-Punkt, nicht auf den Match-Punkt),
- den Bracketing-Effekt (Jensen et al. 2021 — Match-Werte verschieben
  sich systematisch weg vom Rand des Antwortbereichs).

Siehe `docs/spec/02b-freqmatch-adaptiv.md`, Abschnitt „Verfahren im
Überblick" und „Bekannte Einschränkungen".

## Vorbedingungen

- BA 91, BA 92, BA 93 sind gebaut und akzeptiert. Insbesondere:
  `runs[]`-Architektur ist aktiv, `_fmAggregateRunsForElectrode` aus
  BA 93 existiert.

## Akzeptanztest

1. Frequenzabgleich starten (frischer Datensatz, Adaptiv-Modus).
2. Im Debug-Log (oder `_fmDbg`-Ausgabe in der Konsole) sichtbar:
   pro Elektrode **zwei** Tracks angelegt, Keys mit Suffix `:up` und
   `:down`. Bei z.B. 12 Elektroden → 24 Tracks im Pool.
3. Status-Grid im Test-Panel zeigt **pro Elektrode eine Zeile**
   (nicht zwei). Status-Anzeige kombiniert beide Tracks (siehe
   „Elektroden-Status aus zwei Tracks" in der SPEC).
4. Trials wechseln im Round-Robin durcheinander zwischen Track-up und
   Track-down derselben Elektrode — Reihenfolge für den User
   unvorhersagbar.
5. Wenn beide Tracks einer Elektrode konvergieren, wird der
   pro-Elektrode-Match in `fRes[i].cent` als Mittelwert der beiden
   Track-Match-Werte geschrieben.
6. Wenn nur einer der Tracks konvergiert (der andere `not-perceivable`),
   wird die Elektrode als `not-perceivable` markiert (siehe SPEC).
7. Pause/Resume innerhalb eines Laufs funktioniert weiterhin —
   beide Tracks werden persistiert und wiederhergestellt.
8. Slider-Modus bleibt unverändert.

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.94-beta";
```

## Schritt 2 — Track-Key-Schema umstellen

Bisher: `fmTracks[electrodeIdx]` (Integer-Key). Neu:
`fmTracks[trackKey]` mit String-Key der Form `"<idx>:up"` oder
`"<idx>:down"`.

Helper-Funktionen direkt nach den Konstanten oben in `js/freqmatch.js`
ergänzen:

```js
// Track-Key-Schema (BA 94): "<electrodeIdx>:up" oder "<electrodeIdx>:down"
function fmTrackKey(electrodeIdx, direction) {
  return String(electrodeIdx) + ':' + direction;
}
function fmParseTrackKey(key) {
  const parts = String(key).split(':');
  return {
    electrodeIdx: parseInt(parts[0], 10),
    direction:    parts[1]     // 'up' | 'down'
  };
}
```

## Schritt 3 — `fmCreateTrack` auf Up/Down-Variante umstellen

Aktuelle Signatur (vermutlich): `fmCreateTrack(electrodeIdx, prevCent)`.
Neue Signatur:

```js
// startDirection: 'up' (Track startet oberhalb, +100 ct)
//                 oder 'down' (Track startet unterhalb, −100 ct)
function fmCreateTrack(electrodeIdx, startDirection) {
  const START_MAG = 100;   // cent, symmetrisch
  const startOffset = (startDirection === 'up') ? +START_MAG : -START_MAG;
  return {
    electrodeIdx:    electrodeIdx,
    direction:       startDirection,           // 'up' | 'down'  — Markierung des Tracks
    startOffset:     startOffset,
    currentOffset:   startOffset,
    trialHistory:    [],
    reversals:       [],
    stepSize:        FM_STEP_SIZES[0],         // 50 ct, wie heute
    stepDir:         (startDirection === 'up') ? 'down' : 'up',  // sucht Match in
                                                                  // entgegengesetzter Richtung
    pendingResponse: null,
    lastMoveDir:     null,
    status:          'active',
    match:           null,
    residual:        null,
    catchTotal:      0,
    catchErrors:     0,
    trialCount:      0
  };
}
```

**Hinweis (Edge-Case, Lessons learned):** der `prevCent`-Parameter aus
der alten Signatur entfällt vollständig. Alle Aufrufer (insbesondere
`fmStartAdaptive`) auf die neue Signatur umstellen — keine Warmstarts
aus alten Matches.

## Schritt 4 — `fmStartAdaptive`: zwei Tracks pro Elektrode anlegen

In `js/freqmatch.js`, `fmStartAdaptive` (Z. 455 ff). Den Block
für Neuanlage der Tracks ersetzen:

```js
// vorher (nach BA 93 Schritt 5)
    elIdxList.forEach(function(idx) {
      fmTracks[idx] = fmCreateTrack(idx, null);
    });
// nachher
    elIdxList.forEach(function(idx) {
      fmTracks[fmTrackKey(idx, 'up')]   = fmCreateTrack(idx, 'up');
      fmTracks[fmTrackKey(idx, 'down')] = fmCreateTrack(idx, 'down');
    });
```

## Schritt 5 — Round-Robin auf Track-Keys umstellen

Suche im Code (in `freqmatch.js`) alle Stellen, wo `fmRoundQueue` oder
ähnliche Track-ID-Container Integer-Indizes erwarten. Nach dem Umbau
enthält `fmRoundQueue` jetzt **Track-Keys (Strings)**.

Konkret in `fmPickNextTrack`-Funktion (suchen): Argument-Container ist
weiterhin `state.tracks` (jetzt mit String-Keys) und `state.roundQueue`
(jetzt mit String-Elementen). Logik bleibt gleich, nur Typen ändern sich.

Im Persist-Code aus BA 93 (`_fmPersist`, Z. 350) der Block
`Object.keys(fmTracks).map(...sort by effFreq...)` muß die
`electrodeIdxList` aus den **distinct** electrodeIdx-Werten bauen
(jeder Index taucht in 2 Tracks auf):

```js
electrodeIdxList: Array.from(new Set(
  Object.keys(fmTracks).map(function(k) {
    return fmParseTrackKey(k).electrodeIdx;
  })
)).sort(function(a, b) {
  const fa = withSide(fmVarSide, function() { return effFreq(a); });
  const fb = withSide(fmVarSide, function() { return effFreq(b); });
  return fa - fb;
})
```

## Schritt 6 — `fmCurTrackId` ist jetzt ein String

Alle Stellen, die `fmCurTrackId` als Integer behandeln, anpassen.
Insbesondere im Debug-Log (`_fmDbg`-Calls in `fmNextAdaptiveTrial`) —
String funktioniert dort sowieso problemlos. Wichtiger Punkt:
`fmTracks[fmCurTrackId]` greift jetzt mit String-Key zu, was JS
nativ kann.

In `fmCreateTrack` und allen davon abgeleiteten Stellen muß `electrodeIdx`
weiterhin separat verfügbar sein, weil viele Stellen die Soll-Frequenz
über `effFreq(track.electrodeIdx)` berechnen. Der Track-Datenstruktur
oben (`fmCreateTrack`) ist bereits `electrodeIdx` als Property gesetzt —
das genügt.

## Schritt 7 — `_fmCombineTwoTracks` + erweiterter Aggregator + `_fmWriteResult`

**Wichtige Korrektur (Stand BA 93 nach Bau):** Sonnet hat in BA 93 das
tatsächliche `fRes`-Format genutzt — `fRes` ist ein **Array von Objekten**
mit `findIndex`-Suche über `elIdx`, kein elektroden-indexiertes Array.
Die Felder sind `{varSide, refSide, elIdx, varFreq, refFreq, timestamp,
fmStatus, fmResidual, fmDelta}`. Außerdem hat Sonnet `combinedUncertainty`
pragmatisch in das bestehende `fmResidual`-Feld geschrieben. **Wir korrigieren
das jetzt:** `fmResidual` enthält wieder das Lauf-interne Mittel-Residuum,
und ein **neues Feld `fmCombinedUncertainty`** trägt die kombinierte
Unsicherheit. So bleibt die SPEC mit zwei semantisch getrennten Spalten
konsistent (BA 95 nutzt diese Trennung).

In BA 93 haben wir `_fmAggregateRunsForElectrode(side, electrodeIdx)`
eingeführt, die über `run.tracks[electrodeIdx]` aggregiert hat. Jetzt
müssen pro Lauf **beide Track-Keys** für eine Elektrode aggregiert
werden (Mittelwert), bevor über Läufe weiter aggregiert wird.

Funktion in `js/freqmatch.js` ersetzen:

```js
// Pro Lauf: Mittelwert von Track-up und Track-down einer Elektrode.
// Status-Kombination siehe SPEC „Elektroden-Status aus zwei Tracks".
function _fmCombineTwoTracks(trackUp, trackDown) {
  // Beide null/undefined → kein Beitrag dieses Laufs
  if (!trackUp && !trackDown) {
    return { match: null, residual: null, status: 'aborted' };
  }

  // Beide aborted → aborted
  const upSt   = trackUp   ? trackUp.status   : 'aborted';
  const downSt = trackDown ? trackDown.status : 'aborted';
  if (upSt === 'aborted' && downSt === 'aborted') {
    return { match: null, residual: null, status: 'aborted' };
  }

  // Einer not-perceivable → Elektrode not-perceivable (SPEC)
  if (upSt === 'not-perceivable' || downSt === 'not-perceivable') {
    return { match: null, residual: null, status: 'not-perceivable' };
  }

  // Mindestens einer unstable → Elektrode unstable
  if (upSt === 'unstable' || downSt === 'unstable') {
    // Mittelwert nur über Tracks mit Match
    const ms = [trackUp, trackDown]
      .filter(function(t) { return t && t.match != null; })
      .map(function(t) { return t.match; });
    const m = ms.length ? ms.reduce(function(s, x) { return s + x; }, 0) / ms.length : null;
    const rs = [trackUp, trackDown]
      .filter(function(t) { return t && t.residual != null; })
      .map(function(t) { return t.residual; });
    const r = rs.length ? rs.reduce(function(s, x) { return s + x; }, 0) / rs.length : null;
    return { match: m, residual: r, status: 'unstable' };
  }

  // Beide haben Match (in irgendeiner converged-Stufe)
  const mu = trackUp   ? trackUp.match   : null;
  const md = trackDown ? trackDown.match : null;
  const ru = trackUp   ? trackUp.residual : null;
  const rd = trackDown ? trackDown.residual : null;
  const match    = (mu != null && md != null) ? (mu + md) / 2 : (mu != null ? mu : md);
  const residual = (ru != null && rd != null) ? (ru + rd) / 2 : (ru != null ? ru : rd);

  // Status-Stufe: die schlechtere der beiden Stufen + Divergenz-Strafe
  const RANK = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                 'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };
  const STAGES = ['converged', 'converged-fair', 'converged-wide', 'unstable',
                  'not-perceivable', 'aborted'];
  let stage = STAGES[Math.max(RANK[upSt] || 0, RANK[downSt] || 0)];
  if (mu != null && md != null && Math.abs(mu - md) > 25 && RANK[stage] < 2) {
    // Divergenz > 25 ct: mindestens auf converged-wide stufen
    stage = 'converged-wide';
  }
  return { match: match, residual: residual, status: stage };
}

// Aggregiert pro-Elektrode-Matches über alle Läufe einer Seite.
// In jedem Lauf werden zuerst die zwei Tracks (up + down) gemittelt.
// Gibt: { cent, meanResidual, combinedUncertainty, runsCount, status }
//   meanResidual         — mittleres Lauf-internes Residuum (für fmResidual-Spalte)
//   combinedUncertainty  — sqrt(meanResidual² + (matchSpread/2)²) (für neue Spalte)
function _fmAggregateRunsForElectrode(side, electrodeIdx) {
  const fa = (sideData[side] && sideData[side].freqmatchAdaptive) || null;
  if (!fa || !Array.isArray(fa.runs)) {
    return { cent: null, meanResidual: null, combinedUncertainty: 0,
             runsCount: 0, status: null };
  }

  const matches  = [];
  const residuals = [];
  let worstStatus = null;
  const RANK = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                 'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };

  fa.runs.forEach(function(run) {
    const tu = run.tracks && run.tracks[fmTrackKey(electrodeIdx, 'up')];
    const td = run.tracks && run.tracks[fmTrackKey(electrodeIdx, 'down')];
    const combo = _fmCombineTwoTracks(tu, td);

    if (combo.match != null) {
      matches.push(combo.match);
      if (combo.residual != null) residuals.push(combo.residual);
    }
    if (combo.status &&
        (worstStatus == null || (RANK[combo.status] || 0) > (RANK[worstStatus] || 0))) {
      worstStatus = combo.status;
    }
  });

  const meanRes = residuals.length
    ? residuals.reduce(function(s, x) { return s + x; }, 0) / residuals.length
    : null;

  if (matches.length === 0) {
    return { cent: null, meanResidual: meanRes, combinedUncertainty: 0,
             runsCount: 0, status: worstStatus || null };
  }

  // Median (1 → Wert, 2 → Mittel, 3+ → echter Median)
  let cent;
  if (matches.length === 1) {
    cent = matches[0];
  } else if (matches.length === 2) {
    cent = (matches[0] + matches[1]) / 2;
  } else {
    const sorted = matches.slice().sort(function(a, b) { return a - b; });
    const mid = sorted.length >> 1;
    cent = (sorted.length & 1) ? sorted[mid]
                               : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const matchSpread = (matches.length >= 2)
    ? Math.max.apply(null, matches) - Math.min.apply(null, matches)
    : 0;
  const meanResForCombined = (meanRes != null) ? meanRes : 0;
  const combinedUncertainty = Math.sqrt(
    meanResForCombined * meanResForCombined + (matchSpread / 2) * (matchSpread / 2)
  );

  return {
    cent:                 cent,
    meanResidual:         meanRes,
    combinedUncertainty:  combinedUncertainty,
    runsCount:            matches.length,
    status:               worstStatus || null
  };
}
```

### `_fmWriteResult` korrigiert

Sonnet hat in BA 93 `_fmWriteResult` mit dem korrekten `fRes`-Array-
Format gebaut (findIndex + Push, `entry`-Objekt mit `varSide/refSide/elIdx/...`).
Das bleibt grundsätzlich erhalten — wir korrigieren nur die Feldwerte
und ergänzen das neue Feld `fmCombinedUncertainty`. In
`js/freqmatch.js`, Funktion `_fmWriteResult` (nach BA-93-Bau ungefähr
Z. 856). **Im `entry`-Objekt anpassen**:

```js
// vorher (nach BA 93)
  const entry = {
    varSide:    fmVarSide,
    refSide:    fmRefSide,
    elIdx:      elIdx,
    varFreq:    varHz,
    refFreq:    refHz,
    timestamp:  Date.now(),
    fmStatus:   track.status,
    fmResidual: agg.combinedUncertainty,
    fmDelta:    null
  };
// nachher
  const entry = {
    varSide:               fmVarSide,
    refSide:               fmRefSide,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
    fmStatus:              agg.status || track.status,    // Elektroden-Status, nicht Track-Status
    fmResidual:            agg.meanResidual,              // Lauf-internes Mittel-Residuum
    fmCombinedUncertainty: agg.combinedUncertainty,       // NEU: kombiniert über Läufe
    fmDelta:               null                            // bleibt unbenutzt (BA 95 entfernt die Spalte)
  };
```

In `_fmRemoveResult` (analog, nach BA-93-Bau ungefähr Z. 822) dasselbe
Schema anwenden — der `entry`, der bei "andere Läufe haben Daten"
zurückgeschrieben wird, bekommt ebenfalls `fmCombinedUncertainty` und
`fmStatus: agg.status` (das gibt es dort schon mit `'converged'`
hardgecoded — bitte durch `agg.status || 'converged'` ersetzen, damit
auch `converged-fair`/`converged-wide` aus späteren Läufen korrekt
durchgereicht werden):

```js
// _fmRemoveResult — entry-Objekt (nach BA 93 ungefähr Z. 832)
    const entry = {
      varSide:               fmVarSide,
      refSide:               fmRefSide,
      elIdx:                 elIdx,
      varFreq:               varHz,
      refFreq:               refHz,
      timestamp:             Date.now(),
      fmStatus:              agg.status || 'converged',
      fmResidual:            agg.meanResidual,
      fmCombinedUncertainty: agg.combinedUncertainty,
      fmDelta:               null
    };
```

## Schritt 8 — Status-Grid: pro Elektrode eine Zeile

In `fmRenderStatusGrid` (suchen): die Zeile-pro-Elektrode-Logik beibehalten,
aber den Status pro Zeile aus `_fmCombineTwoTracks(fmTracks[idx+':up'],
fmTracks[idx+':down'])` ableiten. Statt direkt aus `fmTracks[idx]`.

Pseudocode-Snippet:

```js
elIdxList.forEach(function(idx) {
  const tu = fmTracks[fmTrackKey(idx, 'up')];
  const td = fmTracks[fmTrackKey(idx, 'down')];
  const combo = _fmCombineTwoTracks(tu, td);
  // combo.status + combo.match in Zeile rendern wie bisher
  // ergänzend: kleine Anzeige beider Track-Stati (z.B. "↑✓ ↓◐") wäre nützlich,
  // aber optional. Wenn unklar: erst ohne, später als Mini-BA.
});
```

**Wichtig (Lessons learned, „Edge-Cases bei neuen Code-Pfaden"):**
Der Fall „ein Track noch active, anderer schon converged" tritt jetzt
ständig auf. Im Status-Grid sollte das als kombinierter Status
**„in-progress"** angezeigt werden, solange einer der beiden Tracks noch
`active` ist. Erst wenn **beide** Tracks einen Endstatus haben, gilt
die Elektrode als fertig.

`_fmCombineTwoTracks` deckt diesen Fall heute NICHT explizit ab — bitte
in der Implementierung als zusätzlichen frühen Branch ergänzen:

```js
// Direkt nach den "aborted"-Branches einfügen:
if (upSt === 'active' || downSt === 'active') {
  return { match: null, residual: null, status: 'in-progress' };
}
```

## Schritt 9 — Progress-Berechnung anpassen

`fmComputeProgressStats` (suchen): heute zählt sie aktive Tracks als
`min(reversals / 6, 0.95)`, abgeschlossene als 1.0. Diese Logik bleibt;
nur die Track-Anzahl verdoppelt sich automatisch, weil jetzt 2 Tracks
pro Elektrode. Anzeige bleibt sauber, weil prozentual berechnet.

Im Fortschrittstext „X von Y Elektroden konvergiert" gilt eine Elektrode
als konvergiert, wenn beide ihrer Tracks einen Endstatus haben. Konkret:

```js
const electrodesDone = elIdxList.filter(function(idx) {
  const tu = fmTracks[fmTrackKey(idx, 'up')];
  const td = fmTracks[fmTrackKey(idx, 'down')];
  return tu && td &&
         tu.status !== 'active' && td.status !== 'active' &&
         tu.status !== 'not-perceivable' && td.status !== 'not-perceivable';
}).length;
```

(„not-perceivable" zählt nicht als „konvergiert" im Wortlaut, aber als
abgeschlossen — Fortschritts-Anzeige differenziert das ggf. wie bisher.)

## Schritt 10 — Trial-History speichert beide Tracks

`trialHistory` lebt schon pro Track. Da jeder Track jetzt seine eigene
Historie hat (up-Track-Historie != down-Track-Historie), ist nichts zu
ändern — die Daten landen automatisch im richtigen Eintrag, sobald
`fmCurTrackId` einen String-Key liefert.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe.

Zusätzlich gegenchecken:
- `grep -n "fmTracks\\[" js/freqmatch.js` — jede einzelne Stelle muß
  prüfen, ob sie einen Integer-Index oder einen String-Key erwartet.
  Ab BA 94 ist es immer ein String-Key.
- `fmCreateTrack`-Aufrufer: nur die zwei in `fmStartAdaptive` Schritt 4.
  Keine anderen Aufrufer übrig.
- `_fmCombineTwoTracks` deckt alle SPEC-Fälle ab:
  - beide active → in-progress
  - einer active, einer fertig → in-progress
  - beide aborted → aborted
  - einer not-perceivable → not-perceivable
  - einer unstable → unstable
  - beide converged-* → schlechterer Status + ggf. Divergenz-Strafe
- Pause/Resume: nach Stop und neuem „Test fortsetzen" sind beide
  Track-Datensätze (up + down) pro Elektrode korrekt wiederhergestellt
  und der Round-Robin enthält noch die nicht-konvergierten Track-Keys.
- Im Debug-Panel oder im Konsolen-Log: `Object.keys(fmTracks).length`
  ist beim Start mit N Elektroden gleich `2*N`.
- In `js/results.js` die Helper `_fmrBuildInProgressEntries` und
  `_fmrCollectNotPerceivable` greifen seit BA 93 auf `run.tracks[idx]`
  zu (Sonnet hatte sie damals angepasst). Nach BA 94 sind die Keys
  jedoch `<idx>:up`/`<idx>:down` — diese Helper müssen entsprechend
  mit `fmTrackKey()` und `_fmCombineTwoTracks()` arbeiten, sonst
  schmeißen sie keine sichtbaren Ergebnisse aus. Vor dem Bau einmal
  prüfen, wie diese Helper heute (post-BA-93) aussehen, und sie auf
  die zwei-Tracks-Logik umstellen. In der Selbstprüfung explizit
  melden, welche Anpassungen in `results.js` nötig wurden.

## Hinweis

Status-Kategorien (`converged-fair`, `converged-wide`, `unstable`) sind
in dieser BA als gültige Statuswerte vorausgesetzt — die feinere
Klassifikation pro Track aus den Reversal-Werten kommt in BA 96. Bis
dahin produzieren die Tracks weiterhin nur `converged` / `converged-noisy`
(je nach heutigem Code) — das ist OK, `_fmCombineTwoTracks` kommt damit
zurecht (RANK behandelt unbekannte Status-Strings als 0).
