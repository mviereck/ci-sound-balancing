# BA 88 — Zweiter Staircase-Lauf: Logik (freqmatch.js)

## Ziel

Den adaptiven Frequenzabgleich um einen zweiten vollständigen Staircase-Lauf erweitern.
Lauf 1 liefert ein erstes Ergebnis (wird sofort in `fRes` geschrieben, damit Einzellauf-User
ein Ergebnis bekommen). Lauf 2 startet dort, wo Lauf 1 aufgehört hat (`prevMatchCent` aus
Lauf-1-Match → Startstreuung ±50 ct statt ±100 ct → ca. halb so lang). Das endgültige
Ergebnis in `fRes` ist der Mittelwert beider Läufe. `fRes`-Einträge bekommen ein neues Feld
`fmDelta` (|Match1 − Match2| in Cent, null bei Einzellauf), das in BA 90 als Reliabilitäts-
spalte angezeigt wird.

**Nur freqmatch.js anfassen.** Keine UI-Änderungen (zweiter Fortschrittsbalken, Hinweistext)
— die kommen in BA 89.

## Betroffene Dateien

- `js/freqmatch.js` (ausschließlich)

---

## Schritt 1 — Neue globale State-Variablen

Direkt nach `let _fmNextTrialTO = null;` (Zeile ≈ 34) einfügen:

```js
let fmCurrentLauf  = 1;     // 1 oder 2 — welcher Staircase-Lauf gerade aktiv ist
let fmLauf1Result  = null;  // { [String(electrodeIdx)]: centMatch|null } nach Lauf-1-Abschluss
```

---

## Schritt 2 — `_fmPersist`: zwei neue Felder

In `_fmPersist` (Zeile ≈ 347) das Objekt um `currentLauf` und `lauf1Result` ergänzen.

**Vorher** (relevanter Ausschnitt):
```js
  sideData[fmVarSide].freqmatchAdaptive = {
    varSide:          fmVarSide,
    refSide:          fmRefSide,
    startedAt:        (sideData[fmVarSide].freqmatchAdaptive
                       && sideData[fmVarSide].freqmatchAdaptive.startedAt) || Date.now(),
    completedAt:      null,
    electrodeIdxList: ids.slice().sort(function(a, b) {
```

**Nachher**:
```js
  sideData[fmVarSide].freqmatchAdaptive = {
    varSide:          fmVarSide,
    refSide:          fmRefSide,
    startedAt:        (sideData[fmVarSide].freqmatchAdaptive
                       && sideData[fmVarSide].freqmatchAdaptive.startedAt) || Date.now(),
    completedAt:      null,
    currentLauf:      fmCurrentLauf,
    lauf1Result:      fmLauf1Result,
    electrodeIdxList: ids.slice().sort(function(a, b) {
```

---

## Schritt 3 — `_fmTryRestore`: Lauf-State immer laden

Die Funktion `_fmTryRestore` (Zeile ≈ 378) muss `fmCurrentLauf` und `fmLauf1Result` immer
aus dem persistierten State lesen — auch wenn sie `false` zurückgibt (z. B. zwischen den
Läufen oder nach Abschluss). Nur so weiß `fmStartAdaptive` beim Neuaufruf, ob Lauf 1 oder
Lauf 2 gestartet werden soll.

**Vorher** (Anfang der Funktion):
```js
function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return false;
  if (fa.completedAt != null) return false;
  if (fa.varSide !== fmVarSide || fa.refSide !== fmRefSide) return false;
  if (!fa.tracks) return false;

  const saved = (fa.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
```

**Nachher**:
```js
function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;

  // Lauf-State immer laden, damit fmStartAdaptive weiß, ob Lauf 1 oder 2 startet.
  // Bei null/abgeschlossenem fa → Reset auf Lauf 1.
  if (fa && fa.completedAt == null) {
    fmCurrentLauf = fa.currentLauf || 1;
    fmLauf1Result = fa.lauf1Result || null;
  } else {
    fmCurrentLauf = 1;
    fmLauf1Result = null;
  }

  if (!fa) return false;
  if (fa.completedAt != null) return false;
  if (fa.varSide !== fmVarSide || fa.refSide !== fmRefSide) return false;
  if (!fa.tracks) return false;

  const saved = (fa.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
```

---

## Schritt 4 — `fmStartAdaptive`: Lauf-2-Branch im else

Im `else`-Zweig von `fmStartAdaptive` (Zeile ≈ 431) wird bisher immer Lauf 1 gestartet.
Jetzt muss unterschieden werden: Lauf 1 (normales Vorgehen) vs. Lauf 2 (prevMatchCent kommt
aus `fmLauf1Result`, nicht aus `fRes`).

**Vorher** (der else-Zweig):
```js
  } else {
    fmTracks = {};
    fmRoundQueue = [];                                 // Bauanleitung 84
    elIdxList.forEach(function(idx) {
      const prev = fmPrevCent(idx);
      const prevOrNull = (prev !== 0) ? prev : null;
      fmTracks[idx] = fmCreateTrack(idx, prevOrNull);
    });
    _fmPersist();
  }
```

**Nachher**:
```js
  } else {
    fmTracks = {};
    fmRoundQueue = [];
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
    _fmPersist();
  }
```

**Hinweis**: `fmCreateTrack(idx, prevCent)` nutzt bereits die ±50 ct-Streuung wenn
`prevCent != null`, und ±100 ct wenn `prevCent == null` — kein Änderungsbedarf an
`freqmatch-staircase.js`.

Außerdem das `console.log` im if-Zweig (Lauf fortgesetzt) um den Lauf-Index ergänzen:

```js
  if (_fmTryRestore(elIdxList)) {
    console.log('[freqmatch] Adaptiver Lauf', fmCurrentLauf, 'fortgesetzt:',
                Object.keys(fmTracks).length, 'Tracks');
```

---

## Schritt 5 — `_fmWriteResult`: Lauf-2-Mittelwert und fmDelta

`_fmWriteResult(track)` (Zeile ≈ 661) muss im Lauf 2 den Match-Cent mitteln und `fmDelta`
in den `fRes`-Eintrag schreiben.

**Vollständiger Ersatz der Funktion**:

```js
function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });

  // Lauf 2: Mittelwert (Lauf1 + Lauf2) / 2 berechnen und |Delta| ermitteln
  const k    = String(elIdx);
  const l1m  = (fmCurrentLauf === 2 && fmLauf1Result) ? fmLauf1Result[k] : null;
  const raw  = track.match;
  let finalMatch, fmDelta;
  if (l1m != null && raw != null) {
    finalMatch = (l1m + raw) / 2;
    fmDelta    = Math.abs(l1m - raw);
  } else {
    finalMatch = raw;
    fmDelta    = null;
  }

  const refHz = (finalMatch != null)
    ? varHz * Math.pow(2, finalMatch / 1200)
    : null;

  const existingIdx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  const entry = {
    varSide:    fmVarSide,
    refSide:    fmRefSide,
    elIdx:      elIdx,
    varFreq:    varHz,
    refFreq:    refHz,
    timestamp:  Date.now(),
    fmStatus:   track.status,
    fmResidual: track.residual,
    fmDelta:    fmDelta
  };
  if (existingIdx >= 0) fRes[existingIdx] = entry;
  else                  fRes.push(entry);
  _fmDbg('fRes write: side=' + fmVarSide + ' el=' + elIdx
       + (fmDelta != null ? ' Δ=' + fmDelta.toFixed(1) + 'ct' : ' (L1)')
       + ' varHz=' + Math.round(varHz)
       + ' residCt=' + (track.residual != null ? track.residual.toFixed(1) : '—'));
}
```

---

## Schritt 6 — `_fmRemoveResult`: Lauf-1-Ergebnis in Lauf 2 behalten

Wenn eine Elektrode in Lauf 2 als `not-perceivable` klassifiziert wird, aber Lauf 1 ein
Match hatte, soll der Lauf-1-Eintrag in `fRes` erhalten bleiben (statt gelöscht zu werden).

**Vollständiger Ersatz der Funktion** (Zeile ≈ 653):

```js
function _fmRemoveResult(elIdx) {
  // Lauf 2: Lauf-1-Ergebnis behalten, falls vorhanden
  const k = String(elIdx);
  if (fmCurrentLauf === 2 && fmLauf1Result && fmLauf1Result[k] != null) {
    _fmDbg('fRes keep L1: side=' + fmVarSide + ' el=' + elIdx + ' (L2 not-perceivable)');
    return;
  }
  const idx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  if (idx >= 0) fRes.splice(idx, 1);
  _fmDbg('fRes remove: side=' + fmVarSide + ' el=' + elIdx + ' (not-perceivable)');
}
```

---

## Schritt 7 — `fmFinishAdaptive`: zwei Abschluss-Pfade

Die Funktion `fmFinishAdaptive` (Zeile ≈ 701) komplett ersetzen. Die UI-Teile (testBox
verstecken, startBtn freigeben) bleiben in beiden Pfaden gleich und werden am Ende behandelt.

```js
function fmFinishAdaptive() {
  let _cv = 0, _nv = 0, _np = 0;
  Object.keys(fmTracks).forEach(function(k) {
    const st = fmTracks[k].status;
    if (st === 'converged')            _cv++;
    else if (st === 'converged-noisy') _nv++;
    else if (st === 'not-perceivable') _np++;
  });
  _fmDbg('finish lauf' + fmCurrentLauf + ': ' + _cv + ' converged, ' + _nv +
         ' noisy, ' + _np + ' not-perceivable');

  fmAdaptiveActive   = false;
  fmAwaitingResponse = false;
  fmIsPlay           = false;
  fmRunning          = false;
  fmCurTrackId       = null;
  fmRoundQueue       = [];
  updateTabLockState();
  setPlayingIndicator(null);

  if (fmCurrentLauf === 1) {
    // --- Lauf 1 abgeschlossen ---
    // Lauf-1-Matches sichern (fRes wurde schon track-by-track via _fmWriteResult gefüllt)
    fmLauf1Result = {};
    Object.keys(fmTracks).forEach(function(k) {
      const track = fmTracks[parseInt(k, 10)];
      fmLauf1Result[k] = (track.match != null) ? track.match : null;
    });
    fmCurrentLauf = 2;
    fmTracks      = {};
    fmRoundQueue  = [];
    _fmPersist();   // currentLauf:2, lauf1Result gesetzt, tracks:{}, completedAt:null
  } else {
    // --- Lauf 2 abgeschlossen: Sitzung vollständig ---
    _fmMarkCompleted();
  }

  // UI-Reset (identisch in beiden Pfaden)
  if (fmEls) {
    fmEls.testBox.hidden    = true;
    fmEls.lockedHint.hidden = true;
    fmEls.startBtn.disabled = false;
    fmEls.stopBtn.disabled  = true;
    if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
  }
  fmRefreshResumeHint();
  if (typeof renderFreqMatchResults === 'function') renderFreqMatchResults();
}
```

---

## Schritt 8 — `fmRefreshResumeHint`: vier Zustände

Die Funktion (Zeile ≈ 402) kennt jetzt vier Zustände: kein Lauf, Lauf 1 läuft/pausiert,
zwischen den Läufen, Lauf 2 läuft/pausiert.

**Vollständiger Ersatz**:

```js
function fmRefreshResumeHint() {
  if (!fmEls) return;
  const startBtn = fmEls.startBtn;
  if (!startBtn) return;
  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;

  if (!fa || fa.completedAt != null) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
    return;
  }
  const tracks = fa.tracks || {};
  const hasActive = Object.keys(tracks).some(function(k) {
    return tracks[k].status === 'active';
  });

  if (fa.currentLauf === 2 && hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblResumeL2'))
      || 'Zweiten Lauf fortsetzen';
  } else if (fa.currentLauf === 2 && !hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblRun2Start'))
      || 'Zweiten Lauf starten';
  } else if (hasActive) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblResume')) || 'Test fortsetzen';
  } else {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
  }
}
```

---

## Akzeptanztest-Checkliste

Alle Schritte in der Browser-Konsole nach dem manuellen Test auswertbar.

**Setup**: Adaptiver Modus aktiv, mindestens 2 Elektroden aktiv, Referenzseite: links.

**Test A — Lauf 1 startet frisch**

1. JSON-Datei laden oder localStorage leeren (kein alter adaptiver State).
2. „Test starten" klicken → Test läuft.
3. In der Konsole: `console.log(sideData.right.freqmatchAdaptive.currentLauf)` → `1`.
4. `console.log(sideData.right.freqmatchAdaptive.lauf1Result)` → `null`.

**Test B — Lauf 1 Abschluss**

5. Simulation starten: `fmRunDebugSim()` (Debug-Modus muss aktiv sein).
6. Warten bis Simulation endet (alle Tracks fertig).
7. Start-Button zeigt „Zweiten Lauf starten".
8. `console.log(sideData.right.freqmatchAdaptive.currentLauf)` → `2`.
9. `console.log(sideData.right.freqmatchAdaptive.lauf1Result)` →
   Objekt mit einem Eintrag pro Elektrode (Zahlen oder null).
10. `console.log(sideData.right.freqmatchAdaptive.completedAt)` → `null` (noch nicht abgeschlossen).
11. `console.log(Object.keys(sideData.right.freqmatchAdaptive.tracks).length)` → `0`.

**Test C — Lauf 2 startet**

12. „Zweiten Lauf starten" klicken.
13. `console.log(sideData.right.freqmatchAdaptive.currentLauf)` → `2`.
14. `console.log(Object.keys(sideData.right.freqmatchAdaptive.tracks).length)` → Anzahl Elektroden (> 0).

**Test D — Lauf 2 Abschluss und fmDelta**

15. `fmRunDebugSim()` erneut starten.
16. Warten bis fertig.
17. `console.log(sideData.right.freqmatchAdaptive.completedAt)` → Timestamp (nicht null).
18. `console.log(fRes.filter(r => r.varSide === 'right').map(r => ({el:r.elIdx, d:r.fmDelta})))`
    → Array mit `fmDelta`-Werten ≥ 0 (oder null für not-perceivable beider Läufe).
19. Ergebnis-Tab zeigt Match-Werte (Mittelwert — in BA 90 mit Δ-Spalte sichtbar).

**Test E — Pause/Resume**

20. Neuen Lauf 1 starten.
21. Nach einigen Trials: Stop-Button klicken.
22. Seite neu laden.
23. Start-Button zeigt „Test fortsetzen".
24. „Test fortsetzen" klicken → Test setzt nahtlos fort.

---

## Selbstprüfungsauftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanzkriterium einzeln prüfen:

| # | Kriterium | Fundstelle | Erfüllt? |
|---|-----------|------------|---------|
| 1 | `fmCurrentLauf`, `fmLauf1Result` deklariert | freqmatch.js ≈ Z. 35 | ? |
| 2 | `_fmPersist` schreibt `currentLauf` und `lauf1Result` | freqmatch.js _fmPersist | ? |
| 3 | `_fmTryRestore` setzt beide Vars immer, auch bei `false`-Return | freqmatch.js _fmTryRestore | ? |
| 4 | `fmStartAdaptive` Lauf-2-Branch wählt `prevCent` aus `fmLauf1Result` | freqmatch.js fmStartAdaptive | ? |
| 5 | `_fmWriteResult` mittelt in Lauf 2 und setzt `fmDelta` | freqmatch.js _fmWriteResult | ? |
| 6 | `_fmRemoveResult` behält L1-Ergebnis in Lauf 2 bei | freqmatch.js _fmRemoveResult | ? |
| 7 | `fmFinishAdaptive` Lauf-1-Pfad: `fmLauf1Result` füllen, `fmCurrentLauf=2`, `_fmPersist`, completedAt NICHT setzen | freqmatch.js fmFinishAdaptive | ? |
| 8 | `fmFinishAdaptive` Lauf-2-Pfad: `_fmMarkCompleted` aufrufen | freqmatch.js fmFinishAdaptive | ? |
| 9 | `fmRefreshResumeHint` zeigt „Zweiten Lauf starten" wenn `fa.currentLauf===2 && !hasActive` | freqmatch.js fmRefreshResumeHint | ? |

Wenn eine Zeile unklar ist: melden statt annehmen.

**Kein Version-Bump in dieser BA** — kommt in BA 89.
