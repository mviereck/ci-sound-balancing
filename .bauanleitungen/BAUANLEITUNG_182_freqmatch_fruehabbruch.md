# BA 182 — Frequenzabgleich adaptiv: Frühabbruch-Mechanismen

**Ziel:** Test-Dauer im adaptiven Frequenzabgleich verkürzen, ohne die
methodische Aussagekraft zu schmälern. Vier orthogonale Mechanismen:

1. **Smart Stop** — vorzeitige Konvergenz bei 6 statt 8 Reversals,
   wenn das Residuum zwei Reversal-Updates in Folge unter der
   Klassen-Schwelle bleibt (nur für `converged` und `converged-fair`).
2. **Residuum-Stagnation** — Frühabbruch als `unstable`, wenn nach
   40 Trials das Residuum über 80 ct liegt.
3. **Reversal-Mangel** — Frühabbruch als `unstable`, wenn nach
   30 Trials weniger als 2 Reversals vorhanden sind.
4. **Catch-Verdichtung** — erste zwei Catches eng am Anfang
   (Trial 4 und 8 statt 5 und 13), damit `not-perceivable` ab
   Trial 14 statt 21 greifen kann.

**Konzept-Grundlage:** `docs/spec/02b-freqmatch-adaptiv.md` — Abschnitt
„Frühabbruch-Mechanismen (BA 182)" und überarbeiteter Catch-Trial-
Abschnitt (sind bereits eingetragen, Stand vor dem Bau).

**Berührte Dateien:**

- `js/freqmatch-staircase.js` — Konstanten, neue Helper-Funktion,
  Konvergenz-Check-Erweiterung.
- `js/freqmatch-adaptive.js` — Catch-Check auf Helper-Funktion umstellen.
- `js/version.js` — Versionsbump.

---

## Schritt 1 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.2.182-beta";
```

---

## Schritt 2 — Konstanten in `js/freqmatch-staircase.js`

Im Konstantenblock am Dateianfang (aktuell Z. 14 ff.) die Catch-
Konstanten umbauen und neue Frühabbruch-Konstanten ergänzen.

**Ersetzen:**

```js
// Catch-Trial-Konstanten
const FM_CATCH_INTERVAL     = 8;     // Catch-Trial-Abstand pro Track (deterministisch)
const FM_CATCH_PHASE        = 5;     // Track-Trial-Index des ersten Catch (Trial 5, 13, 21 …)
const FM_CATCH_MAGNITUDE    = 500;   // cent — Untergrenze der Catch-Spreizung
const FM_NOT_PERC_MIN_CATCH = 3;     // mind. Catch-Trials vor Konvergenz-Freigabe
const FM_NOT_PERC_ERR_RATE  = 2/3;   // Catch-Fehlerrate für not-perceivable (≥ 67 %)
```

**durch:**

```js
// Catch-Trial-Konstanten
// BA 182: Verteilung umgestellt auf 4, 8, 14, 22, 30, … (statt 5, 13, 21, …).
// Erste zwei Catches eng am Anfang, damit not-perceivable ab Trial 14 greift.
const FM_CATCH_TRIALS_EARLY = [4, 8]; // Erste zwei Catches: feste Trial-Indizes
const FM_CATCH_REGULAR_FROM = 14;     // Ab hier Modulo-Logik mit FM_CATCH_INTERVAL
const FM_CATCH_INTERVAL     = 8;      // Catch-Trial-Abstand ab FM_CATCH_REGULAR_FROM
const FM_CATCH_MAGNITUDE    = 500;    // cent — Untergrenze der Catch-Spreizung
const FM_NOT_PERC_MIN_CATCH = 3;      // mind. Catch-Trials vor Konvergenz-Freigabe
const FM_NOT_PERC_ERR_RATE  = 2/3;    // Catch-Fehlerrate für not-perceivable (≥ 67 %)
```

**Wichtig:** `FM_CATCH_PHASE` ist ersatzlos entfernt. Wenn andere
Dateien diese Konstante referenzieren, müssen die Stellen auch
umgestellt werden — vor dem Bau prüfen mit:

```
grep -rn "FM_CATCH_PHASE" js/
```

Bekannte Referenz: `js/freqmatch-adaptive.js` Z. 228 (wird in
Schritt 4 umgestellt).

**Direkt im Anschluß an den Catch-Block einfügen (vor `FM_PROVISIONAL_MATCH_MIN`):**

```js
// Frühabbruch-Konstanten (BA 182)
// Smart Stop: vorzeitige Konvergenz bei 6 (statt 8) Reversals,
//   wenn das Residuum zwei Reversal-Updates in Folge stabil unter
//   der Klassen-Schwelle (FM_RESIDUAL_OK / FM_RESIDUAL_FAIR) liegt.
const FM_SMART_STOP_REVERSALS = 6;

// Residuum-Stagnation: nach FM_EARLY_UNSTABLE_TRIALS Trials und
//   Residuum > FM_EARLY_UNSTABLE_RESID ct => unstable.
const FM_EARLY_UNSTABLE_TRIALS = 40;
const FM_EARLY_UNSTABLE_RESID  = 80;

// Reversal-Mangel: nach FM_EARLY_NO_PROGRESS_TRIALS Trials und
//   weniger als FM_EARLY_NO_PROGRESS_MIN_REVERSALS Reversals => unstable.
const FM_EARLY_NO_PROGRESS_TRIALS         = 30;
const FM_EARLY_NO_PROGRESS_MIN_REVERSALS  = 2;
```

---

## Schritt 3 — Helper-Funktion und Konvergenz-Check in `js/freqmatch-staircase.js`

### 3a — `_fmIsCatchTrial`-Helper

Direkt **oberhalb** der Funktion `_fmCheckAndUpdateStatus` (aktuell
Z. 284) einfügen:

```js
// --- Catch-Trial-Bestimmung (BA 182) ---
//
// Verteilung: erste zwei Catches bei Trial 4 und 8 (eng am Anfang,
// damit not-perceivable früher greifen kann); danach jeder
// FM_CATCH_INTERVAL-te ab FM_CATCH_REGULAR_FROM.
// Aufruf: VOR dem trialCount++ in fmApplyResponse — also nach
// trialCount === 4 ist der nächste Trial der 5., aber der Catch greift,
// wenn der trialCount im Aufruferkontext direkt vor Trial-Start
// === 4 ist.
//
function _fmIsCatchTrial(trialCount) {
  for (let i = 0; i < FM_CATCH_TRIALS_EARLY.length; i++) {
    if (trialCount === FM_CATCH_TRIALS_EARLY[i]) return true;
  }
  if (trialCount < FM_CATCH_REGULAR_FROM) return false;
  return ((trialCount - FM_CATCH_REGULAR_FROM) % FM_CATCH_INTERVAL) === 0;
}
```

### 3b — `_fmCheckAndUpdateStatus`-Erweiterung

Die bestehende Funktion `_fmCheckAndUpdateStatus` (Z. 284 ff.) **vollständig
ersetzen** durch die folgende Variante. Reihenfolge der Checks:
not-perceivable → Smart Stop → klassische Konvergenz → Residuum-
Stagnation → Reversal-Mangel → Hard Cap.

```js
function _fmCheckAndUpdateStatus(track) {
  if (track.status !== 'active') return track.status;

  // (1) Not-perceivable-Check: immer, unabhängig von Umkehr-Zahl.
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status = 'not-perceivable';
      return track.status;
    }
  }

  // Konvergenz erst erlauben, wenn mind. FM_NOT_PERC_MIN_CATCH Catches da sind.
  if (track.catchTotal < FM_NOT_PERC_MIN_CATCH) {
    if (track.trialCount < FM_TRIAL_CAP) return 'active';
    // Hard-Cap ohne genug Catches → unbrauchbar
    track.status = 'not-perceivable';
    return track.status;
  }

  // (2) Smart Stop (BA 182): vorzeitige Konvergenz bei 6 Reversals,
  // wenn das Residuum zwei Reversal-Updates in Folge unter der
  // Schwelle liegt. Nur für converged und converged-fair, nicht
  // für converged-wide.
  const _revCount = track.reversals.length;
  if (track.stepSize === FM_STEP_MIN
      && _revCount >= FM_SMART_STOP_REVERSALS
      && _revCount > (track._smartStopLastEvalAtRevCount || 0)) {
    const _resNow = fmComputeResidual(track);
    if (_resNow != null) {
      const _resPrev = track._smartStopPrevResid;
      if (_resPrev != null) {
        if (_resNow <= FM_RESIDUAL_OK && _resPrev <= FM_RESIDUAL_OK) {
          track.status   = 'converged';
          track.match    = fmComputeMatch(track);
          track.residual = _resNow;
          return track.status;
        }
        if (_resNow <= FM_RESIDUAL_FAIR && _resPrev <= FM_RESIDUAL_FAIR) {
          track.status   = 'converged-fair';
          track.match    = fmComputeMatch(track);
          track.residual = _resNow;
          return track.status;
        }
      }
      // Smart Stop greift noch nicht: aktuelles Residuum als Vorgänger
      // für den NÄCHSTEN Reversal-Update merken.
      track._smartStopPrevResid          = _resNow;
      track._smartStopLastEvalAtRevCount = _revCount;
    }
  }

  // (3) Klassische Konvergenz: ≥8 Umkehrungen, Schrittweite am Minimum.
  // Match/Residuum werden aus den letzten 6 berechnet (FM_REVERSALS_WIN).
  if (track.reversals.length >= FM_REVERSALS_REQ && track.stepSize === FM_STEP_MIN) {
    const residual = fmComputeResidual(track);
    if (residual != null) {
      if (residual <= FM_RESIDUAL_OK) {
        track.status   = 'converged';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      if (residual <= FM_RESIDUAL_FAIR) {
        track.status   = 'converged-fair';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      if (residual <= FM_RESIDUAL_WIDE) {
        track.status   = 'converged-wide';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      // Residuum > FM_RESIDUAL_WIDE → noch aktiv (bis Frühabbruch oder Hard-Cap)
    }
  }

  // (4) Residuum-Stagnation (BA 182): nach FM_EARLY_UNSTABLE_TRIALS
  // Trials und Residuum > FM_EARLY_UNSTABLE_RESID → unstable.
  if (track.trialCount >= FM_EARLY_UNSTABLE_TRIALS
      && track.reversals.length >= FM_REVERSALS_WIN) {
    const _resEarly = fmComputeResidual(track);
    if (_resEarly != null && _resEarly > FM_EARLY_UNSTABLE_RESID) {
      track.match    = fmComputeMatch(track);
      track.residual = _resEarly;
      track.status   = 'unstable';
      return track.status;
    }
  }

  // (5) Reversal-Mangel (BA 182): nach FM_EARLY_NO_PROGRESS_TRIALS
  // Trials und weniger als FM_EARLY_NO_PROGRESS_MIN_REVERSALS Reversals
  // → unstable. Match/Residuum aus dem Fallback (Mittel/halbe Spanne
  // aller bisherigen Reversals).
  if (track.trialCount >= FM_EARLY_NO_PROGRESS_TRIALS
      && track.reversals.length < FM_EARLY_NO_PROGRESS_MIN_REVERSALS) {
    track.match    = _fmMeanReversals(track);
    if (track.match == null) track.match = track.currentOffset;
    track.residual = _fmHalfSpanReversals(track);
    track.status   = 'unstable';
    return track.status;
  }

  // (6) Hard-Cap erreicht ohne Konvergenz: als unstable klassifizieren.
  if (track.trialCount >= FM_TRIAL_CAP) {
    if (track.reversals.length >= FM_REVERSALS_WIN) {
      // Genug für 6er-Fenster: Standard-Match/Residuum
      const residual = fmComputeResidual(track);
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      track.status   = (residual != null && residual <= FM_RESIDUAL_WIDE)
                       ? 'converged-wide'
                       : 'unstable';
      return track.status;
    }
    // Weniger als 6 Reversals: Fallback auf Mittel aller Reversals.
    track.match    = _fmMeanReversals(track);
    if (track.match == null) track.match = track.currentOffset;
    track.residual = _fmHalfSpanReversals(track);
    track.status   = 'unstable';
    return track.status;
  }

  return 'active';
}
```

**Edge-Case-Hinweise:**

- `_smartStopPrevResid` und `_smartStopLastEvalAtRevCount` sind neue
  optionale Track-Properties. Sie tauchen in `fmCreateTrack` **nicht**
  als Initialwerte auf — sie werden lazy beim ersten Smart-Stop-Eval
  gesetzt. `undefined` und `null` werden im Code korrekt als „noch
  nicht gesetzt" behandelt (`_resPrev != null` schließt beide aus).
  Trotzdem in `fmCreateTrack` einen Kommentar ergänzen (Schritt 3c).
- Smart Stop tritt nur bei **echten Reversal-Updates** in Aktion
  (Vergleich `_revCount > track._smartStopLastEvalAtRevCount`). Wird
  `_fmCheckAndUpdateStatus` zweimal hintereinander ohne neue Reversal
  aufgerufen, läuft Smart Stop nicht durch — gut so, sonst würde der
  identische Residuum-Wert mit sich selbst verglichen.
- Reihenfolge zwischen Smart Stop (2) und klassischer Konvergenz (3)
  ist wichtig: Smart Stop muß **vor** der klassischen Konvergenz
  geprüft werden, sonst greift letztere bei 8 Reversals und Smart
  Stop hätte nie eine Chance.
- Residuum-Stagnation (4) greift nur, wenn klassische Konvergenz (3)
  nicht gegriffen hat — also Residuum > FM_RESIDUAL_WIDE (50 ct).
  Die Schwelle 80 ct ist strenger als „nicht-wide", was bewußt
  Spielraum läßt: 51–80 ct laufen weiter bis zum Hard Cap (Klassifizierung
  als `converged-wide` oder `unstable` je nach Endwert).
- Smart Stop steht **vor** der Mindest-Catch-Vorprüfung-Hard-Cap-Logik
  ist erfüllt: oben in (1) wird bei catchTotal < FM_NOT_PERC_MIN_CATCH
  early returned, daher kann Smart Stop nur bei ≥ 3 Catches greifen —
  passend zur Spec-Anforderung.

### 3c — Kommentar in `fmCreateTrack`

In `fmCreateTrack` (aktuell Z. 65 ff.) am Ende des `return`-Objekts,
nach der `residual: null`-Zeile, einen erläuternden Kommentar
ergänzen (keine neuen Property-Initialisierungen — die Smart-Stop-
Felder bleiben lazy):

```js
    match:           null,
    residual:        null
    // _smartStopPrevResid und _smartStopLastEvalAtRevCount werden in
    // _fmCheckAndUpdateStatus lazy gesetzt (BA 182, Smart Stop).
  };
}
```

---

## Schritt 4 — Catch-Check umstellen in `js/freqmatch-adaptive.js`

Aktuell Z. 226-228:

```js
  // --- Catch-Entscheidung: deterministisch pro Track ---
  // Jeder FM_CATCH_INTERVAL-te Trial eines Tracks ist ein Catch-Trial
  // (Trial-Indizes 5, 13, 21, … — gleichmäßige Verteilung je Elektrode).
  if ((fmTracks[fmCurTrackId].trialCount % FM_CATCH_INTERVAL) === FM_CATCH_PHASE) {
```

**ersetzen durch:**

```js
  // --- Catch-Entscheidung: deterministisch pro Track ---
  // Verteilung (BA 182): Trial 4, 8, 14, 22, 30, … — siehe
  // _fmIsCatchTrial in freqmatch-staircase.js.
  if (_fmIsCatchTrial(fmTracks[fmCurTrackId].trialCount)) {
```

Alles andere im Catch-Block (Spreizungs-Berechnung, `fmCurCatchInfo`-
Aufbau) bleibt unverändert.

**Cross-Check vor Bau:**

```
grep -rn "FM_CATCH_PHASE" js/
```

Es darf nur die zu löschende Konstantendefinition gefunden werden
(Schritt 2). Sollte der Grep weitere Treffer liefern, sind das
unbekannte Verwender — vor dem Umbauen prüfen, ob die ebenfalls
auf `_fmIsCatchTrial` umgestellt werden müssen.

---

## Schritt 5 — Akzeptanztest-Checkliste

Der adaptive Test ist nur über die Frequenzabgleich-UI durchführbar;
einige Punkte lassen sich nicht ohne aufwendigen Live-Test prüfen.
Für die Checkliste reicht es, **strukturelle** Korrektheit (existieren
die Konstanten/Funktionen, ist die alte `FM_CATCH_PHASE` weg) plus
einen einzelnen Klick-Test im Browser zu prüfen.

1. **Versionsnummer ist sichtbar.**
   - `index.html` öffnen (Cache-Reload mit Strg-Umschalt-R), oben
     rechts steht „v3.2.182-beta" o. ä.
   - Erwartet: Versionsanzeige zeigt 3.2.182-beta.

2. **Keine alte Catch-Konstante mehr.**
   - In der Browser-Konsole: `typeof FM_CATCH_PHASE`.
   - Erwartet: `"undefined"`.

3. **Neue Catch-Konstanten existieren.**
   - In der Konsole: `FM_CATCH_TRIALS_EARLY`.
   - Erwartet: `[4, 8]`.
   - `FM_CATCH_REGULAR_FROM` → `14`.
   - `FM_CATCH_INTERVAL` → `8`.

4. **Frühabbruch-Konstanten existieren.**
   - Konsole: `FM_SMART_STOP_REVERSALS` → `6`,
     `FM_EARLY_UNSTABLE_TRIALS` → `40`,
     `FM_EARLY_UNSTABLE_RESID` → `80`,
     `FM_EARLY_NO_PROGRESS_TRIALS` → `30`,
     `FM_EARLY_NO_PROGRESS_MIN_REVERSALS` → `2`.

5. **Helper-Funktion liefert das richtige Catch-Pattern.**
   - Konsole:
     ```
     [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,21,22,29,30].map(_fmIsCatchTrial)
     ```
   - Erwartet (`true`-Positionen): bei den Eingaben
     `4, 8, 14, 22, 30` ist das Ergebnis `true`, sonst `false`.
   - Voll erwartete Ausgabe: `[false, false, false, false, true,
     false, false, false, true, false, false, false, false, false,
     true, false, false, true, false, true]`.

6. **Live-Test eines Tracks (kurze Sichtprüfung).**
   - Tab „Messungen" → Sub-Tab „Frequenzabgleich" → Verfahren
     „Adaptiv" → „Test starten".
   - Nach jedem Trial mit „höher" / „tiefer" antworten. Versuchen,
     **konsistent in dieselbe Richtung** zu antworten (z. B. immer
     „höher") für eine künstlich erzeugte Monotonie.
   - Erwartet: Spätestens beim 30. Trial dieses Tracks zeigt der
     Status-Grid „unstabil" (Mechanismus C, Reversal-Mangel) oder
     `not-perceivable`, falls die Catch-Trials konsistent falsch
     beantwortet wurden.
   - Falls beim normalen Spielen Konvergenz früh greift: Track-
     Status wechselt nach 6. Reversal auf `converged` oder
     `converged-fair`, sofern Residuum stabil ≤ 10 / ≤ 25 ct ist.

7. **Bestehende Tests verändern sich nicht im Verhalten.**
   - Stereo-Balance-Test, Schieber-Modus, Levels-Tab: keine
     Regressionen, Schalten/Wiedergabe wie vorher.

---

## Schritt 6 — Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede der folgenden Akzeptanz-Kriterien
einzeln durchgehen und mit Datei- und Zeilenangabe der relevanten
Code-Stelle melden, ob: **erfüllt / nicht erfüllt / unklar**.

- (a) `js/version.js` enthält `"3.2.182-beta"` (Zeilen-Verweis).
- (b) `js/freqmatch-staircase.js` enthält die neuen Konstanten
  `FM_CATCH_TRIALS_EARLY`, `FM_CATCH_REGULAR_FROM`, `FM_SMART_STOP_REVERSALS`,
  `FM_EARLY_UNSTABLE_TRIALS`, `FM_EARLY_UNSTABLE_RESID`,
  `FM_EARLY_NO_PROGRESS_TRIALS`, `FM_EARLY_NO_PROGRESS_MIN_REVERSALS`
  (je Zeilenangabe).
- (c) `FM_CATCH_PHASE` taucht in `js/` nirgends mehr auf (Grep-Befund
  mitliefern: leere Trefferliste oder genaue restliche Treffer).
- (d) `_fmIsCatchTrial(trialCount)` existiert in
  `js/freqmatch-staircase.js` und ist exakt wie in Schritt 3a
  implementiert (Zeilen-Verweis).
- (e) `_fmCheckAndUpdateStatus` enthält in dieser Reihenfolge:
  not-perceivable-Check, Smart-Stop-Block, klassische Konvergenz,
  Residuum-Stagnation, Reversal-Mangel, Hard Cap (Sektion-Marker
  per Inline-Kommentar in der finalen Datei vorhanden? Zeilenangabe).
- (f) `js/freqmatch-adaptive.js` ruft im Catch-Check
  `_fmIsCatchTrial(...)` auf und referenziert weder `FM_CATCH_PHASE`
  noch ein direktes `% FM_CATCH_INTERVAL === ...`-Muster (Zeile).
- (g) Der Bau ist syntaktisch sauber: in der Browser-Konsole keine
  `Uncaught SyntaxError` o. ä. beim Laden der Seite.

Wenn ein Punkt als **unklar** markiert wird, vor der Fertig-Meldung
nachfragen statt stillschweigend anzunehmen.

---

## Akzeptanzhinweis zum Verhalten (kein Pflicht-Test, nur Erwartung)

- Gut konvergierende Tracks beenden typischerweise nach 9–14 Trials
  statt 15–25. Spar-Effekt sichtbar in der „N Vergleiche"-Anzeige
  pro Elektrode.
- Zähe Tracks (Residuum > 80 ct) brechen spätestens bei Trial 40
  als `unstable` ab, statt bis 80 zu laufen.
- Nicht wahrnehmbare Elektroden: `not-perceivable` greift ab Trial
  14 (3. Catch durch), nicht erst ab Trial 21.

---

## Nachpflege (außerhalb dieser BA)

- `docs/spec/02b-freqmatch-adaptiv.md` ist bereits aktualisiert
  (Abschnitt „Frühabbruch-Mechanismen (BA 182)" und überarbeiteter
  Catch-Trial-Abschnitt). Keine Spec-Edits in dieser BA mehr nötig.
- Keine i18n-Strings betroffen — UI-Texte ändern sich nicht. Keine
  Folge-Mini-BA für en/fr/es nötig.
- `docs/CODESTRUKTUR.md` — keine strukturelle Änderung (keine neuen
  Dateien, keine neuen globalen Variablen, keine Tabs/Sub-Tabs).
  Keine Aktualisierung nötig.
