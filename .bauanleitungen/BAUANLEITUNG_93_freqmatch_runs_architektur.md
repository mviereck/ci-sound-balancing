# BA 93 — runs[]-Architektur + Anti-Überschreib

## Ziel

Die heutige Lauf-1/Lauf-2-Architektur (Spezialbehandlung in
`freqmatchAdaptive.currentLauf` + `lauf1Result`) wird durch ein
generisches **`runs[]`-Array** ersetzt. Jeder Lauf wird angehängt, nie
überschrieben. `fRes` ist die robuste Median-Kombination über alle Läufe.

**Konkreter Trigger**: aktuell überschreibt ein dritter Lauf die
Ergebnisse der ersten beiden — das **darf niemals passieren**.

## Hintergrund (kurz)

Siehe `docs/spec/02b-freqmatch-adaptiv.md`, Abschnitte „Storage" und
„Mehrere Läufe und Reliabilität". Die SPEC ist mit dem neuen Schema
bereits aktualisiert; diese BA setzt die SPEC im Code um.

**Wichtig:** In dieser BA arbeitet jeder Lauf weiterhin mit **einem
Staircase-Track pro Elektrode** (alte Architektur). Die Erweiterung
auf **zwei verschränkte Staircases pro Elektrode** folgt erst in BA 94.
Diese BA betrifft nur die Lauf-Persistenz, nicht die Track-Logik
innerhalb eines Laufs.

## Akzeptanztest

1. Frischer Datensatz: Frequenzabgleich starten, einen Lauf vollständig
   durchspielen → erwartet: Lauf wird abgeschlossen, Ergebnisse in `fRes`
   sichtbar.
2. Start-Button beschriftet sich auf „**Weiteren Lauf starten**".
3. Klick auf „Weiteren Lauf starten" → zweiter Lauf wird durchlaufen.
   Erwartet: Ergebnisse in `fRes` sind nun Mittelwert beider Läufe.
   Spalten „Restunsicherheit" und „Unsicherheit (gesamt)" verändern sich
   wie erwartet (Streuung über Läufe fließt ein).
4. Start-Button steht wieder auf „Weiteren Lauf starten". Klick →
   **Bestätigungsdialog erscheint**: „Sie haben bereits 2 Läufe
   gespeichert. Ein weiterer Lauf wird zum Datensatz hinzugefügt und in
   die kombinierte Auswertung einbezogen. Wenn Sie ganz neu beginnen
   wollen, drücken Sie [Messungen löschen]."
   Buttons: [Hinzufügen] (default), [Abbrechen].
5. [Hinzufügen] → dritter Lauf läuft. Ergebnisse in `fRes` sind
   **Median** über drei Läufe.
6. Vorhandene gespeicherte Datensätze mit altem Schema
   (`freqmatchAdaptive.currentLauf` + `lauf1Result`) lassen sich
   problemlos laden. **Migration** beim Laden: alte Daten werden in
   `runs[]` überführt (Lauf 1 = `runs[0]`, Lauf 2 = `runs[1]`).
7. Wenn der letzte Lauf älter als 7 Tage ist, zeigt der
   Bestätigungsdialog **zusätzlich**: „Ihre letzte Messung ist X Tage
   alt. Pitch-Wahrnehmung kann sich durch Plastizität verschoben haben."
8. Pause/Resume innerhalb eines laufenden Laufs funktioniert weiterhin:
   Test starten → pausieren (Stop) → „Test fortsetzen" → Lauf läuft
   weiter, kein neuer Lauf wird begonnen.
9. „Frequenzabgleich-Ergebnisse löschen"-Button löscht alle `runs[]`
   beider Seiten und setzt `fRes` zurück.

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.93-beta";
```

## Schritt 2 — Neues Speicher-Schema

Per-Seite in `sideData[side].freqmatchAdaptive`:

```js
{
  runs: [
    {
      runId:        "2026-05-27T14:32:00Z",   // ISO-Timestamp
      startedAt:    1748358720000,
      completedAt:  1748359500000 | null,     // null = unvollständig (pausiert)
      varSide:      'left' | 'right',
      refSide:      'left' | 'right',
      electrodeIdxList: [0,1,2,...],
      tracks: {
        [electrodeIdx]: {
          // unverändert wie heute (siehe Z. 412-) — wird in BA 94 erweitert
          trialHistory, reversals, stepSize, direction, status,
          match, residual, catchTotal, catchErrors, trialCount,
          ...
        }
      },
      roundQueue: [electrodeIdx, ...]
    },
    // ... weitere Läufe werden angehängt
  ],
  currentRunIdx: number | null   // Index des aktiven oder zuletzt
                                  // abgeschlossenen Laufs. null nur,
                                  // wenn runs[] leer.
}
```

Hinweis: `currentLauf` und `lauf1Result` fallen weg. Die Tracks eines
Laufs liegen in `runs[i].tracks` statt direkt unter `freqmatchAdaptive.tracks`.

## Schritt 3 — Migration alter Daten

In `js/state-side.js`, beim Laden eines Side-Datensatzes
(Funktion, die `freqmatchAdaptive` aus `d` übernimmt). Eine
Migration-Funktion einbauen:

```js
function _fmMigrateAdaptive(fa) {
  if (!fa) return null;
  if (Array.isArray(fa.runs)) return fa;   // schon neues Schema

  // Altes Schema: { currentLauf, lauf1Result, tracks, roundQueue,
  //                 varSide, refSide, electrodeIdxList, startedAt, completedAt }
  const out = { runs: [], currentRunIdx: null };

  // Lauf 1: aus lauf1Result rekonstruieren — wir haben hier nur die
  // finalen Matches, keine Trial-Historie mehr. Das ist akzeptabel,
  // weil wir die fRes-Kombination nur den finalen Match-Wert braucht.
  if (fa.lauf1Result) {
    const lauf1Tracks = {};
    Object.keys(fa.lauf1Result).forEach(function(k) {
      const m = fa.lauf1Result[k];
      lauf1Tracks[k] = {
        electrodeIdx: parseInt(k, 10),
        status:       (m != null) ? 'converged' : 'not-perceivable',
        match:        m,
        residual:     null,            // Detail-Daten verloren bei Migration
        reversals:    [],
        trialHistory: [],
        stepSize:     3,
        catchTotal:   0,
        catchErrors:  0,
        trialCount:   0,
        _migrated:    true             // Marker, dass diese Daten unvollständig sind
      };
    });
    out.runs.push({
      runId:            'migrated-lauf-1',
      startedAt:        fa.startedAt || 0,
      completedAt:      fa.startedAt || 0,    // hatten wir nicht separat
      varSide:          fa.varSide,
      refSide:          fa.refSide,
      electrodeIdxList: fa.electrodeIdxList || [],
      tracks:           lauf1Tracks,
      roundQueue:       []
    });
  }

  // Lauf 2: die aktuellen `tracks` sind Lauf 2 (sofern currentLauf === 2)
  if (fa.tracks && fa.currentLauf === 2) {
    out.runs.push({
      runId:            'migrated-lauf-2',
      startedAt:        fa.startedAt || 0,
      completedAt:      fa.completedAt,
      varSide:          fa.varSide,
      refSide:          fa.refSide,
      electrodeIdxList: fa.electrodeIdxList || [],
      tracks:           fa.tracks,
      roundQueue:       Array.isArray(fa.roundQueue) ? fa.roundQueue.slice() : []
    });
  } else if (fa.tracks && fa.currentLauf !== 2) {
    // Lauf 1 noch im Gange (nicht abgeschlossen) — als runs[0] übernehmen
    out.runs.push({
      runId:            'migrated-lauf-1',
      startedAt:        fa.startedAt || 0,
      completedAt:      fa.completedAt,
      varSide:          fa.varSide,
      refSide:          fa.refSide,
      electrodeIdxList: fa.electrodeIdxList || [],
      tracks:           fa.tracks,
      roundQueue:       Array.isArray(fa.roundQueue) ? fa.roundQueue.slice() : []
    });
  }

  out.currentRunIdx = out.runs.length > 0 ? out.runs.length - 1 : null;
  return out;
}
```

Im Side-Loader: `s.freqmatchAdaptive = _fmMigrateAdaptive(d.freqmatchAdaptive);`.

**Wichtig (Lessons learned, „State-Mutation vs. Reassignment"):**
`_fmMigrateAdaptive` gibt **immer ein neues Objekt** zurück, nie
in-place-Mutation. Aufrufer überschreibt `s.freqmatchAdaptive`
komplett mit dem Return-Wert.

## Schritt 4 — `_fmPersist`, `_fmTryRestore`, `_fmMarkCompleted`

In `js/freqmatch.js` (ab Z. 350): Funktionen so umschreiben, daß sie
auf den **aktuellen Lauf** in `runs[currentRunIdx]` operieren, nicht
auf das Top-Level-`freqmatchAdaptive`.

### `_fmPersist` (Z. 350)

```js
function _fmPersist() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  let fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs)) {
    fa = { runs: [], currentRunIdx: null };
    sideData[fmVarSide].freqmatchAdaptive = fa;
  }

  // Aktuellen Lauf finden oder neu anlegen
  let run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run || run.completedAt != null) {
    // Kein aktiver Lauf → neuen Lauf anlegen
    run = {
      runId:            new Date().toISOString(),
      startedAt:        Date.now(),
      completedAt:      null,
      varSide:          fmVarSide,
      refSide:          fmRefSide,
      electrodeIdxList: Object.keys(fmTracks).map(function(k) {
        return parseInt(k, 10);
      }).sort(function(a, b) {
        const fa_ = withSide(fmVarSide, function() { return effFreq(a); });
        const fb_ = withSide(fmVarSide, function() { return effFreq(b); });
        return fa_ - fb_;
      }),
      tracks:           fmTracks,
      roundQueue:       fmRoundQueue.slice()
    };
    fa.runs.push(run);
    fa.currentRunIdx = fa.runs.length - 1;
  } else {
    // Bestehenden Lauf aktualisieren (Pause/Resume-Fall)
    run.tracks     = fmTracks;
    run.roundQueue = fmRoundQueue.slice();
  }

  _fmDbg('persist: run#' + fa.currentRunIdx + ', tracks=' + Object.keys(fmTracks).length);
}
```

### `_fmMarkCompleted` (Z. 372)

```js
function _fmMarkCompleted() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || fa.currentRunIdx == null) return;
  const run = fa.runs[fa.currentRunIdx];
  if (run) run.completedAt = Date.now();
}
```

### `_fmClearPersist` (Z. 378)

Löscht **alle** Läufe der Seite:

```js
function _fmClearPersist(side) {
  side = side || fmVarSide;
  if (side && sideData[side]) sideData[side].freqmatchAdaptive = null;
}
```
(unverändert — leert das ganze Objekt.)

### `_fmTryRestore` (Z. 383)

```js
function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) return false;

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  if (!run) return false;
  if (run.completedAt != null) return false;            // letzter Lauf war fertig
  if (run.varSide !== fmVarSide || run.refSide !== fmRefSide) return false;
  if (!run.tracks) return false;

  const saved = (run.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
  const now   = currentElIdxList.slice().sort(function(a, b) { return a - b; });
  if (saved.length !== now.length) return false;
  for (let i = 0; i < saved.length; i++) if (saved[i] !== now[i]) return false;

  const hasActive = Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });
  if (!hasActive) return false;

  fmTracks     = run.tracks;
  fmRoundQueue = Array.isArray(run.roundQueue) ? run.roundQueue.slice() : [];
  _fmDbg('restore: run#' + fa.currentRunIdx + ', ' + Object.keys(fmTracks).length + ' tracks');
  return true;
}
```

## Schritt 5 — `fmCurrentLauf` / `fmLauf1Result` entfernen

In `js/freqmatch.js` ganz oben (Variable-Deklarationen) und überall,
wo `fmCurrentLauf` oder `fmLauf1Result` referenziert werden, die
Verwendung entfernen. Stattdessen:

- Wo bisher `fmCurrentLauf === 2` als „neuer Lauf"-Signal genutzt wurde,
  jetzt prüfen: `fa.runs.length >= 1 && (kein aktiver Lauf)` →
  „neuer Lauf".
- Wo bisher `fmLauf1Result` als Startwerte-Quelle für Lauf 2 genutzt
  wurde, jetzt **entfallen lassen**: SPEC sagt, Startwerte sind immer
  symmetrisch ±100 cent (siehe „Staircase-Parameter"). Kein Warmstart.

Konkret in `fmStartAdaptive` (Z. 455–506) den Block Z. 472–484 ersetzen:

```js
// vorher
    elIdxList.forEach(function(idx) {
      let prevCent;
      if (fmCurrentLauf === 2) {
        // Lauf 2: Startwert aus Lauf-1-Ergebnis (→ ±50 ct Streuung in fmCreateTrack)
        const k = String(idx);
        prevCent = (fmLauf1Result && fmLauf1Result[k] != null) ? fmLauf1Result[k] : null;
      } else {
        // Lauf 1: alter gespeicherter Match aus fRes (bisheriges Verhalten)
        const prev = fmPrevCent(idx);
        prevCent = (prev !== 0) ? prev : null;
      }
      fmTracks[idx] = fmCreateTrack(idx, prevCent);
    });
// nachher
    elIdxList.forEach(function(idx) {
      // SPEC: kein Warmstart. Jeder Lauf startet symmetrisch ±100 cent.
      // (fmCreateTrack akzeptiert null → eigene Startwert-Logik dort
      //  übernimmt; siehe BA 94 für die Umstellung auf zwei Staircases.)
      fmTracks[idx] = fmCreateTrack(idx, null);
    });
```

**Edge-Case (Lessons learned):** `fmCreateTrack(idx, null)` muß den
symmetrischen ±100-cent-Startwert korrekt setzen. Wenn die heutige
Implementierung von `fmCreateTrack` bei `prevCent === null` einen
asymmetrischen Random-Wert wählt, in dieser BA auf reines `±100`
festlegen oder in BA 94 sauber überarbeiten — vor Übergabe an Sonnet
einmal in den Code von `fmCreateTrack` schauen.

## Schritt 6 — `fmRefreshResumeHint` neue Button-Texte

Ersetzen (Z. 418–444):

```js
function fmRefreshResumeHint() {
  if (!fmEls) return;
  const startBtn = fmEls.startBtn;
  if (!startBtn) return;
  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;

  // Kein adaptiver State → Test starten
  if (!fa || !Array.isArray(fa.runs) || fa.runs.length === 0) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
    return;
  }

  const run = (fa.currentRunIdx != null) ? fa.runs[fa.currentRunIdx] : null;
  const hasActive = run && run.tracks && Object.keys(run.tracks).some(function(k) {
    return run.tracks[k].status === 'active';
  });

  if (hasActive) {
    // Pausierter Lauf
    startBtn.textContent = (typeof t === 'function' && t('fmLblResume')) || 'Test fortsetzen';
  } else {
    // Lauf abgeschlossen → weiterer Lauf möglich
    startBtn.textContent = (typeof t === 'function' && t('fmLblNewRun')) || 'Weiteren Lauf starten';
  }
}
```

Die alten i18n-Keys `fmLblResumeL2` und `fmLblRun2Start` werden nicht
mehr verwendet — können in `i18n/de.js` stehen bleiben (sie schaden
nicht, aber sind tote Strings).

## Schritt 7 — Anti-Überschreib-Dialog

In `fmStartAdaptive`, **ganz am Anfang** der Funktion (vor Z. 457),
einen Pre-Start-Check einbauen, der **nur beim Start eines neuen Laufs**
(nicht beim Resume eines pausierten) den Bestätigungsdialog zeigt:

```js
function fmStartAdaptive() {
  if (!fmEls) return;

  // --- Anti-Überschreib-Check (BA 93): bei vorhandenen abgeschlossenen
  //     Läufen vor Start eines weiteren Laufs Hinweis zeigen. ---
  const _fa = (sideData[fmEls.refSelect.value === 'left' ? 'right' : 'left']
              && sideData[fmEls.refSelect.value === 'left' ? 'right' : 'left'].freqmatchAdaptive) || null;
  if (_fa && Array.isArray(_fa.runs) && _fa.runs.length > 0) {
    const lastRun = _fa.runs[_fa.runs.length - 1];
    const lastDone = lastRun && lastRun.completedAt != null;
    // Nur warnen wenn letzter Lauf abgeschlossen (= wir starten einen NEUEN Lauf,
    // nicht ein Resume).
    if (lastDone && _fa.runs.length >= 2) {
      const daysOld = Math.floor((Date.now() - lastRun.completedAt) / (1000 * 60 * 60 * 24));
      const baseMsg = (typeof t === 'function' && t('fmAntiOverwriteMsg'))
        || 'Sie haben bereits ' + _fa.runs.length + ' Läufe gespeichert. '
         + 'Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die '
         + 'kombinierte Auswertung einbezogen. Wenn Sie ganz neu beginnen '
         + 'wollen, drücken Sie [Messungen löschen].';
      let msg = baseMsg.replace('{N}', String(_fa.runs.length));
      if (daysOld >= 7) {
        const ageMsg = (typeof t === 'function' && t('fmAgeWarnMsg'))
          || 'Ihre letzte Messung ist {D} Tage alt. Pitch-Wahrnehmung kann '
           + 'sich durch Plastizität verschoben haben.';
        msg += '\n\n' + ageMsg.replace('{D}', String(daysOld));
      }
      if (!window.confirm(msg)) return;
    }
  }

  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';
  // ... Rest der Funktion unverändert (Z. 460 ff)
```

**Bewußt window.confirm statt eigenes Modal** für minimale BA-Größe.
Falls später ein hübscheres Modal gewünscht ist (siehe `fmRCOkBtn`-
Pattern in Z. 1528 für Vorlage), separate Mini-BA.

## Schritt 8 — `fRes`-Berechnung als Median über `runs`

In `js/freqmatch.js`, Funktion `_fmWriteResult` (Z. 714 ff). Komplett
umschreiben — sie schreibt jetzt nicht den **Lauf-Wert** in `fRes`,
sondern die **Kombination über alle abgeschlossenen Läufe**.

Erst Helper-Funktion einbauen (z.B. direkt vor `_fmWriteResult`):

```js
// Aggregiert pro-Elektrode-Matches aus allen Läufen einer Seite.
// Gibt für eine Elektrode: { cent, combinedUncertainty, runsCount, status }
function _fmAggregateRunsForElectrode(side, electrodeIdx) {
  const fa = (sideData[side] && sideData[side].freqmatchAdaptive) || null;
  if (!fa || !Array.isArray(fa.runs)) {
    return { cent: null, combinedUncertainty: 0, runsCount: 0, status: null };
  }
  const matches  = [];
  const residuals = [];
  let statusAcc = null;
  fa.runs.forEach(function(run) {
    const tr = run.tracks && run.tracks[electrodeIdx];
    if (!tr || tr.status === 'aborted') return;
    if (tr.match != null) {
      matches.push(tr.match);
      if (typeof tr.residual === 'number') residuals.push(tr.residual);
    }
    if (tr.status === 'not-perceivable' && !statusAcc) statusAcc = 'not-perceivable';
  });

  if (matches.length === 0) {
    return { cent: null, combinedUncertainty: 0, runsCount: 0,
             status: statusAcc || null };
  }

  // Robuste Kombination: 1 → Wert, 2 → Mittel, 3+ → Median.
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

  // combinedUncertainty: sqrt(meanResidual² + (matchSpread/2)²)
  const meanRes = residuals.length
    ? residuals.reduce(function(s, x) { return s + x; }, 0) / residuals.length
    : 0;
  const matchSpread = (matches.length >= 2)
    ? Math.max.apply(null, matches) - Math.min.apply(null, matches)
    : 0;
  const combinedUncertainty = Math.sqrt(
    meanRes * meanRes + (matchSpread / 2) * (matchSpread / 2)
  );

  return {
    cent:                 cent,
    combinedUncertainty:  combinedUncertainty,
    runsCount:            matches.length,
    status:               statusAcc || null    // Track-Status kommt aus BA 96
  };
}
```

Dann `_fmWriteResult` umbauen, sodaß es **alle Elektroden** (nicht nur die
des aktuellen Tracks) refresht — denn jeder neue Lauf-Trial-Abschluß
kann die kombinierte Statistik aller seiner Elektroden ändern (im Einzel-
fall reicht aber die eine, sicher ist sicher und O(n) ist günstig):

```js
function _fmWriteResult(track) {
  // Wird nach jedem konvergierten Track gerufen.
  // Schreibt den robust kombinierten Wert in fRes[electrodeIdx].
  if (!fmVarSide || !sideData[fmVarSide] || !sideData[fmVarSide].fRes) return;
  const fRes = sideData[fmVarSide].fRes;
  const i    = track.electrodeIdx;
  const agg  = _fmAggregateRunsForElectrode(fmVarSide, i);

  // BACKWARDS-COMPAT: fRes[i] war früher ein primitives Cent-Number oder
  // ein Objekt mit { cent, fmDelta, ... }. Wir akzeptieren beides als
  // Eingang und schreiben jetzt das neue Objekt-Format.
  fRes[i] = {
    cent:                 agg.cent,
    combinedUncertainty:  agg.combinedUncertainty,
    runsCount:            agg.runsCount,
    fmDelta:              null    // wird in BA 95 zur Tabellenanzeige genutzt;
                                   // hier null halten, damit alte Tabellen-
                                   // Logik nicht crasht
  };

  _fmDbg('writeResult: el=' + i + ' cent=' + (agg.cent != null ? agg.cent.toFixed(1) : 'null')
       + ' unc=' + agg.combinedUncertainty.toFixed(1)
       + ' runs=' + agg.runsCount);
}
```

**Edge-Case (Lessons learned):** Andere Stellen, die `fRes[i]` lesen
(z.B. Druck, Kurven, Anzeige), erwarten heute meist ein **Number**, nicht
ein Objekt. Vor Übergabe der BA an Sonnet einmal `grep -n "fRes\\[" js/`
durchgehen und feststellen: gibt es Leser, die `fRes[i]` als Number
behandeln? Falls ja: entweder Lese-Stellen mitanpassen (`typeof fRes[i] === 'object' ? fRes[i].cent : fRes[i]`) oder einen Helper `fmGetCent(side, i)`
einführen. Diese Migration MUSS in dieser BA mitgemacht werden, sonst
crashen Folge-Systeme. Sonnet soll vor dem Bau diese Leser-Stellen
auflisten und in seinem Bericht zeigen, welche er angepasst hat.

## Schritt 9 — i18n DE

In `i18n/de.js`, neue Keys ergänzen:

```js
    fmLblNewRun: "Weiteren Lauf starten",
    fmAntiOverwriteMsg: "Sie haben bereits {N} Läufe gespeichert. Ein weiterer Lauf wird zum Datensatz hinzugefügt und in die kombinierte Auswertung einbezogen. Wenn Sie ganz neu beginnen wollen, drücken Sie „Messungen löschen".",
    fmAgeWarnMsg: "Ihre letzte Messung ist {D} Tage alt. Pitch-Wahrnehmung kann sich durch Plastizität verschoben haben.",
```

(Tote Keys `fmLblResumeL2`, `fmLblRun2Start`, `fmLblRun2Hint` bleiben
für Backwards-Compat unverändert.)

**Achtung (Lessons learned):** `„"`-typographische Anführungszeichen
werden hier durchgängig genutzt, kein ASCII-`"` im String-Inhalt.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus der Liste oben
einzeln durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich gegenchecken:
- `grep -n "fmCurrentLauf\\|fmLauf1Result\\|currentLauf\\|lauf1Result" js/` —
  außer in der Migrations-Funktion `_fmMigrateAdaptive` (in `state-side.js`)
  sollten KEINE Treffer mehr in der Logik vorhanden sein. Reine
  Tot-Code-Variablen-Deklarationen oben in `freqmatch.js` müssen
  entfernt werden.
- Tabellen-Logik in `js/results.js` (BA 90, Δ-Spalte) liest heute
  vermutlich `fRes[i].fmDelta`. Solange diese Felder auf `null` stehen,
  zeigt die Tabelle „—" — Verhalten ist korrekt, kein Crash. BA 95
  füllt das Feld dann sinnvoll.
- Lade-Test: alte JSON-Datei mit `freqmatchAdaptive.currentLauf: 2` und
  `lauf1Result: {...}` laden → `_fmMigrateAdaptive` macht daraus
  `runs: [migrierter Lauf 1, aktueller Lauf 2]`. Im UI sichtbar:
  Start-Button steht auf „Weiteren Lauf starten" (wenn Lauf 2
  abgeschlossen war) oder „Test fortsetzen" (wenn Lauf 2 pausiert).
- `_fmPersist` legt bei einem komplett frischen Aufruf wirklich nur
  einen Lauf an (keine doppelten Einträge bei Wiederholung).

## Hinweis

Englisch / Französisch / Spanisch der drei neuen Keys (`fmLblNewRun`,
`fmAntiOverwriteMsg`, `fmAgeWarnMsg`) folgen in der Mini-Anleitung am
Ende der BA-Serie 91–97.
