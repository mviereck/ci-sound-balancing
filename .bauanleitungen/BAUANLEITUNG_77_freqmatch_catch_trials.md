# Bauanleitung 77 — Frequenzabgleich adaptiv: Catch-Trials + „nicht wahrnehmbar"

## Ziel

Sechste Anleitung der 02b-Reihe. Vervollständigt die Methodik:

- **Catch-Trials** (~10 % aller Trials, pro Track separat) — var-Ton
  wird um ±500 cent von der Referenz verschoben, der User sollte
  bei intaktem Hören die Richtung eindeutig erkennen.
- **„nicht wahrnehmbar"**-Klassifikation: Track-Endzustand wenn
  Catch-Fehlerrate hoch ist und keine Konvergenz erreicht wird.
- **fRes-Behandlung**: not-perceivable-Tracks bekommen **keinen**
  Eintrag in `fRes` — die Information lebt nur im
  `freqmatchAdaptive.tracks`-Storage. Bestehende fRes-Einträge
  werden gelöscht, wenn ein Track als not-perceivable markiert
  wird.

**Voraussetzungen**: Bauanleitungen 72–76 sind umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.77-beta";
```

---

## 2. Staircase-Kern: not-perceivable-Check

In `js/freqmatch-staircase.js` (aus 02b/3), `_fmCheckAndUpdateStatus`
um den not-perceivable-Pfad ergänzen.

Neue Konstanten oben in der Datei ergänzen:

```js
const FM_CATCH_PROBABILITY  = 0.10;   // Anteil Catch-Trials pro Track
const FM_CATCH_MAGNITUDE    = 500;    // cent — Auslenkung in Catch
const FM_NOT_PERC_MIN_CATCH = 6;      // mind. Catch-Trials für Klassifikation
const FM_NOT_PERC_ERR_RATE  = 0.5;    // Catch-Fehlerrate für not-perceivable
const FM_NOT_PERC_MIN_TRIAL = 30;     // mind. Trials für Klassifikation
```

In `_fmCheckAndUpdateStatus`, an den Anfang (VOR der
Konvergenz-Prüfung) den not-perceivable-Block einbauen:

```js
function _fmCheckAndUpdateStatus(track) {
  if (track.status !== 'active') return track.status;

  // --- "Nicht wahrnehmbar"-Check (Bauanleitung 02b/6) ---
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH
      && track.trialCount >= FM_NOT_PERC_MIN_TRIAL
      && track.reversals.length < FM_REVERSALS_REQ) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status   = 'not-perceivable';
      track.match    = null;
      track.residual = null;
      return track.status;
    }
  }

  // --- bestehende Konvergenz-Logik unverändert weiter ---
  if (track.reversals.length >= FM_REVERSALS_REQ && track.stepSize === FM_STEP_MIN) {
    // ...
```

(Den restlichen Body unverändert lassen — der ist aus 02b/3.)

---

## 3. Catch-Trial-Erzeugung in `freqmatch.js`

### 3a) Neue State-Variable

Im State-Block ergänzen:

```js
// Catch-Trial-Info des aktuellen Trials (Bauanleitung 02b/6)
let fmCurCatchInfo = null;   // null | { direction: +500|-500, expectedResponse: 'var-higher'|'var-lower' }
```

### 3b) Trial-Erzeugung in `fmNextAdaptiveTrial`

In der Funktion aus 02b/4, nach `fmCurFirstSide` setzen und VOR
`fmPlayAdaptiveTrial`, den Catch-Pull einbauen:

```js
function fmNextAdaptiveTrial() {
  if (!fmAdaptiveActive) return;

  fmCurTrackId = fmPickNextTrack(fmTracks);
  if (fmCurTrackId === null) {
    fmFinishAdaptive();
    return;
  }

  fmCurFirstSide   = (Math.random() < 0.5) ? 'ref' : 'var';
  fmAwaitingResponse = false;

  // --- Catch-Entscheidung (Bauanleitung 02b/6) ---
  if (Math.random() < FM_CATCH_PROBABILITY) {
    const dir = (Math.random() < 0.5) ? +FM_CATCH_MAGNITUDE : -FM_CATCH_MAGNITUDE;
    fmCurCatchInfo = {
      direction:        dir,
      // Bei +500 cent ist var deutlich HÖHER als ref → korrekt = 'var-higher'.
      // Bei -500 cent ist var deutlich TIEFER → korrekt = 'var-lower'.
      expectedResponse: (dir > 0) ? 'var-higher' : 'var-lower'
    };
  } else {
    fmCurCatchInfo = null;
  }

  const track = fmTracks[fmCurTrackId];
  if (fmEls.pairLeft)  fmEls.pairLeft.textContent  = (typeof t === 'function' && t('fmTone1')) || 'Ton 1';
  if (fmEls.pairRight) fmEls.pairRight.textContent = (typeof t === 'function' && t('fmTone2')) || 'Ton 2';
  if (fmEls.pairFreq)  fmEls.pairFreq.textContent  = '';

  fmUpdateAdaptiveProgress();
  fmDisableHeightButtons();

  fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
    fmTrialStartTs = Date.now();
  });
}
```

### 3c) `fmPlayAdaptiveTrial` um Catch-Override erweitern

In der Funktion aus 02b/4 die Berechnung der var-Frequenz
verzweigen:

**Vorher**:

```js
async function fmPlayAdaptiveTrial(track, firstSide) {
  // ...
  const varHz = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
  const refHz = varHz * Math.pow(2, track.currentOffset / 1200);
```

**Nachher**:

```js
async function fmPlayAdaptiveTrial(track, firstSide, catchInfo) {
  // ...
  const elFreq = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
  const refHz  = elFreq * Math.pow(2, track.currentOffset / 1200);
  // var-Frequenz:
  //   normaler Trial: elFreq (CI-Elektrode bleibt statisch)
  //   Catch-Trial:    refHz * 2^(±500/1200) — ±500 cent von ref
  const varHz  = catchInfo
    ? refHz * Math.pow(2, catchInfo.direction / 1200)
    : elFreq;
```

Wichtig: bei normalem Trial bleibt `varHz === elFreq` (Soll-Frequenz
der CI-Elektrode, keine Schiebung — Konvention aus 02b/4). Bei
Catch wird varHz NUR FÜR DIESEN TRIAL ±500 cent von refHz weg
gesetzt — die Stair-Logik selbst ist davon ausgenommen (siehe 3d).

### 3d) `fmHandleHeight` um Catch-Auswertung erweitern

```js
function fmHandleHeight(userChoice) {
  if (!fmAdaptiveActive || !fmAwaitingResponse) return;
  fmAwaitingResponse = false;
  fmDisableHeightButtons();

  const response = _fmConvertHeight(userChoice, fmCurFirstSide);
  const track    = fmTracks[fmCurTrackId];

  const isCatch      = !!fmCurCatchInfo;
  const catchCorrect = isCatch && (response === fmCurCatchInfo.expectedResponse);

  fmApplyResponse(track, response, isCatch, catchCorrect, fmCurFirstSide);

  // Catch-Info aufräumen (vor nächstem Trial)
  fmCurCatchInfo = null;

  // Ergebnis in fRes schreiben — nur bei Konvergenz / Restunsicherheit.
  // Bei not-perceivable: bestehenden Eintrag entfernen.
  if (track.status === 'converged' || track.status === 'converged-noisy') {
    _fmWriteResult(track);
  } else if (track.status === 'not-perceivable') {
    _fmRemoveResult(track.electrodeIdx);
  }

  _fmPersist();
  fmRenderStatusGrid();

  setTimeout(function() {
    if (fmAdaptiveActive) fmNextAdaptiveTrial();
  }, 200);
}
```

### 3e) fRes-Eintrag bei not-perceivable entfernen

Neue Helfer-Funktion, vor `_fmWriteResult`:

```js
function _fmRemoveResult(elIdx) {
  const idx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  if (idx >= 0) fRes.splice(idx, 1);
}
```

---

## 4. Anzeige im Status-Grid

`fmRenderStatusGrid` aus 02b/4 zeigt schon die Catch-Statistik
(`catchErrors/catchTotal`). Das funktioniert ab dieser Anleitung
automatisch, weil `_fmCheckAndUpdateStatus` jetzt `catchTotal`
und `catchErrors` zählt und `fmApplyResponse` bei isCatch=true
die Statistik aktualisiert.

Der Status `not-perceivable` führt zur CSS-Klasse
`fm-status-not-perceivable` (rot, ✗-Icon, ausgegrauter Text) —
das CSS aus 02b/4 deckt das bereits ab.

---

## 5. Replay bei Catch-Trial

`fmReplayCurrent` aus 02b/4 muss die Catch-Info erhalten:

**Vorher**:

```js
function fmReplayCurrent() {
  if (!fmAdaptiveActive) return;
  if (fmCurTrackId === null) return;
  const track = fmTracks[fmCurTrackId];
  fmDisableHeightButtons();
  fmAwaitingResponse = false;
  fmPlayAdaptiveTrial(track, fmCurFirstSide).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
  });
}
```

**Nachher** — `fmCurCatchInfo` mit übergeben:

```js
function fmReplayCurrent() {
  if (!fmAdaptiveActive) return;
  if (fmCurTrackId === null) return;
  const track = fmTracks[fmCurTrackId];
  fmDisableHeightButtons();
  fmAwaitingResponse = false;
  fmPlayAdaptiveTrial(track, fmCurFirstSide, fmCurCatchInfo).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
  });
}
```

---

## 6. Pure-Function-Selbsttest (Konsole)

Sonnet kann den not-perceivable-Pfad mit deterministischem RNG
verifizieren:

```js
// Simuliere einen "tauben" User: antwortet auf Catch immer falsch,
// auf normale Trials zufällig
const t = fmCreateTrack(7, null);
t.currentOffset = 0;
for (let i = 0; i < 60; i++) {
  // Zufällig 10% Catch
  const isCatch = Math.random() < 0.1;
  if (isCatch) {
    const dir = Math.random() < 0.5 ? +500 : -500;
    const expected = dir > 0 ? 'var-higher' : 'var-lower';
    const wrong    = expected === 'var-higher' ? 'var-lower' : 'var-higher';
    fmApplyResponse(t, wrong, true, false, 'ref');
  } else {
    const response = Math.random() < 0.5 ? 'var-higher' : 'var-lower';
    fmApplyResponse(t, response, false, false, 'ref');
  }
  if (t.status === 'not-perceivable') break;
}
console.log('Status:', t.status);          // erwartet: 'not-perceivable'
console.log('Catch err rate:', t.catchErrors + '/' + t.catchTotal);
console.log('Reversals:', t.reversals.length);
console.log('Trials:', t.trialCount);
```

---

## 7. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`:

- Zeile für `freqmatch-staircase.js`: neue Konstanten
  `FM_CATCH_PROBABILITY`, `FM_CATCH_MAGNITUDE`, `FM_NOT_PERC_*`
  ergänzen. Status `'not-perceivable'` als möglicher Endzustand
  erwähnen.
- Zeile für `freqmatch.js`: neue Funktionen `_fmRemoveResult`,
  neue State-Var `fmCurCatchInfo`.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.77-beta`.
2. Tab Messungen → Frequenzabgleich, Modus `adaptive`, Test
   starten.
3. ~30 Trials normal beantworten. Im Status-Grid sollte die
   Catch-Spalte bei einigen Tracks nicht mehr `0/0` sein
   (typisch etwa 1–3 Catches pro 30 Trials).
4. **Hörtest des Catch**: bei einem Catch-Trial sollte einer der
   beiden Töne **deutlich** höher oder tiefer als der andere
   klingen (≈ 4 Halbtöne / 500 cent Unterschied). Wenn das nicht
   zu hören ist, ist der Catch nicht korrekt erzeugt.
5. Bei einem Catch absichtlich falsch antworten → Status-Grid:
   `catchErrors`-Zähler bei diesem Track steigt um 1. Bei
   korrektem Antworten bleibt er bei 0.
6. **„Nicht wahrnehmbar"-Triggerung**: gezielt eine Elektrode
   testen, indem Sie alle Catches in diesem Bereich falsch
   beantworten und auch sonst zufällig. Nach ≥ 30 Trials und
   ≥ 6 Catches mit ≥ 50 % Fehlerrate sollte der Track auf
   `not-perceivable` umspringen — Status-Grid zeigt ✗-Icon mit
   rotem Hintergrund, Match „—", Residuum „—".
7. Konsole nach dem ✗: `console.log(fRes.find(r => r.elIdx ===
   <jeneElektrodenIdx>))` → erwartet `undefined` (oder Eintrag
   entfernt).
8. Im Status-Grid bleibt die not-perceivable-Zeile sichtbar, wird
   aber von `fmPickNextTrack` nicht mehr gezogen.
9. Test fortsetzen — verbleibende Tracks konvergieren irgendwann.
   Test schließt automatisch.
10. **Slider-Modus weiterhin unverändert.**
11. Konsole frei von Fehlern.
12. Konsolen-Selbsttest aus Schritt 6 (Pure-Function) ausführen.

---

## Selbstprüfungs-Auftrag an Sonnet

1. Akzeptanztest-Schritte einzeln durchgehen und melden.
2. Speziell prüfen:
   - Catch-Trials werden NICHT in `reversals` und NICHT als
     Bewegung gezählt (in `fmApplyResponse` aus 02b/3 ist der
     `if (isCatch)`-early-return implementiert).
   - `expectedResponse` ist korrekt:
     - direction = +500 (var deutlich höher als ref) → erwartet
       `'var-higher'` (User sollte sagen „var ist höher")
     - direction = -500 (var deutlich tiefer) → erwartet
       `'var-lower'`
   - Bei firstSide='var' wird die User-Antwort **vor** der
     Korrektheits-Prüfung über `_fmConvertHeight` invertiert
     (passiert automatisch in `fmHandleHeight`).
   - `fRes`-Eintrag wird bei not-perceivable entfernt
     (Bestätigung über Konsole `fRes.find(...)`).
3. Edge-Case: was passiert bei einem Catch-Trial, wenn der Track
   schon nahe Konvergenz ist (≥ 6 reversals, stepSize = 3)?
   Antwort: der Catch zählt nicht in reversals, ändert
   stepSize nicht, aktualisiert nur catchStatistik und checkt
   not-perceivable. Konvergenz wird ggf. um diesen Trial
   verzögert. Sonnet bestätigt das im Code-Review.

---

## Was diese Anleitung NICHT macht

- Keine Chart-Anpassung (kommt in 02b/7)
- Keine i18n-Strings (kommt in 02b/8)
- Keine UI-Warnung bei vielen Catch-Fehlern — Spec sagt explizit:
  Catch-Fehler triggern keine globale UI-Warnung.
