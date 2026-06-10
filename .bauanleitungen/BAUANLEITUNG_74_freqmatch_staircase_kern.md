# Bauanleitung 74 — Frequenzabgleich: Staircase-Kern (Pure Functions)

## Ziel

Dritte Anleitung der 02b-Reihe. Implementiert den **methodischen
Kern** des adaptiven Frequenzabgleichs als reine Pure-Functions
ohne jeglichen DOM-Bezug. Diese Anleitung legt eine neue Datei
`js/freqmatch-staircase.js` an, in der die Track-State-Struktur,
der 2-down-1-up-Algorithmus, die Schrittweiten-Halbierung, die
Match-/Residuum-Berechnung und die Konvergenz-Erkennung leben.

**Reine Logik, keine UI, keine globalen Side-Effects.** Die
Funktionen werden in 02b/4 vom Trial-Loop aufgerufen.

**Voraussetzung**: Bauanleitungen 72 und 73 sind umgesetzt.

**Methodische Quelle**: `docs/spec/02b-freqmatch-adaptiv.md`,
Abschnitt „Staircase-Parameter" und „Konvergenz und
Ergebnis-Kategorien". Pieper et al. 2022 ist hier nicht
zusätzlich nötig — die Spec hat das Verfahren bereits extrahiert.

**Wichtige Konvention** (Klarstellung zur Spec): Geschoben wird
die **Referenz-Frequenz** (Normalohr-Seite), nicht die var-Seite.
Die CI-Elektroden-Frequenzen bleiben statisch (`effFreq(i)`), um
das Aktivieren benachbarter Elektroden zu vermeiden. Damit ist
das Vorzeichen des Match-Werts konsistent zum Slider-Modus und
zur fRes-Speicherung (`cent = 1200 · log2(refFreq/varFreq)`).
`track.currentOffset` ist also der **cent-Offset der ref-Frequenz
relativ zur var-Soll-Frequenz** der jeweiligen Elektrode.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.74-beta";
```

---

## 2. Neue Datei `js/freqmatch-staircase.js` anlegen

Vollständiger Inhalt — neu erstellen:

```js
// ============================================================
// FREQUENZABGLEICH – ADAPTIVER STAIRCASE-KERN
// ============================================================
// Pure-Function-Modul ohne DOM-Bezug.
// Methodik nach docs/spec/02b-freqmatch-adaptiv.md
// (Bauanleitung 02b/3 = Bauanleitung 74)
// ============================================================

// --- Konstanten ---
const FM_STEP_SEQUENCE = [50, 25, 12, 6, 3];   // Schrittweiten in cent
const FM_STEP_MIN      = 3;                    // Minimale Schrittweite
const FM_REVERSALS_REQ = 6;                    // Umkehrungen für Match
const FM_RESIDUAL_OK   = 10;                   // Residuum für saubere Konvergenz (cent)
const FM_STABLE_DELTA  = 2;                    // Residuums-Stabilität für noisy (cent)
const FM_TRIAL_CAP     = 80;                   // Hard cap pro Track

// --- Track-State erzeugen ---
//
// electrodeIdx: Elektroden-Index in nEl der variablen Seite
// prevMatchCent: vorhandener Cent-Offset aus alter Messung, oder null
// rng: optionale Random-Funktion (default Math.random) — für Tests
function fmCreateTrack(electrodeIdx, prevMatchCent, rng) {
  const r = rng || Math.random;
  // Startwert: ±50 cent um alten Match, oder ±100 cent um 0 (Soll)
  const base = (prevMatchCent != null && isFinite(prevMatchCent)) ? prevMatchCent : 0;
  const spread = (prevMatchCent != null && isFinite(prevMatchCent)) ? 50 : 100;
  const startOffset = base + (r() * 2 - 1) * spread;
  return {
    electrodeIdx:     electrodeIdx,
    // currentOffset: cent-Offset der REF-Frequenz relativ zur var-Soll-Frequenz.
    // Positiv = ref liegt höher als var. Var-Seite bleibt statisch auf effFreq(i),
    // damit die CI-Elektrode unverändert angeregt wird.
    currentOffset:    startOffset,
    stepSize:         FM_STEP_SEQUENCE[0],
    pendingResponse:  null,           // 'var-higher' | 'var-lower' | null
    lastMoveDir:      null,           // 'up' | 'down' | null (Richtung der letzten BEWEGUNG)
    reversals:        [],             // cent-Werte an Umkehrpunkten
    trialHistory:     [],             // [{ trial, varOffset, response, isCatch, catchCorrect, firstSide }]
    trialCount:       0,
    catchTotal:       0,
    catchErrors:      0,
    status:           'active',       // 'active' | 'converged' | 'converged-noisy' | 'not-perceivable'
    match:            null,           // cent (nur wenn konvergiert)
    residual:         null            // cent (nur wenn konvergiert)
  };
}

// --- Trial-Reihenfolge: zufällig aus den aktiven Tracks ---
//
// tracks: { [electrodeIdx]: trackState }
// rng: optionale Random-Funktion
// returns: electrodeIdx (Number) oder null wenn alle abgeschlossen
function fmPickNextTrack(tracks, rng) {
  const r = rng || Math.random;
  const activeIds = Object.keys(tracks).filter(function(k) {
    return tracks[k].status === 'active';
  });
  if (activeIds.length === 0) return null;
  const pick = activeIds[Math.floor(r() * activeIds.length)];
  return parseInt(pick, 10);
}

// --- Antwort verarbeiten (2-down-1-up, transformed) ---
//
// track:    mutable Track-State (wird in-place verändert)
// response: 'var-higher' | 'var-lower'
// isCatch:  true falls dieser Trial ein Catch war (kein Stair-Update)
// catchCorrect: bei isCatch=true: hat der User korrekt geantwortet?
// firstSide:    'ref' | 'var' — welche Seite zuerst gespielt wurde
//
// Rückgabe: aktualisierter status (siehe checkConvergence)
function fmApplyResponse(track, response, isCatch, catchCorrect, firstSide) {
  if (track.status !== 'active') return track.status;

  // Trial in History eintragen
  track.trialHistory.push({
    trial:        track.trialCount + 1,
    varOffset:    track.currentOffset,
    response:     response,
    isCatch:      !!isCatch,
    catchCorrect: !!catchCorrect,
    firstSide:    firstSide || null
  });
  track.trialCount++;

  if (isCatch) {
    // Catch-Trials zählen NICHT für Staircase-Bewegung
    track.catchTotal++;
    if (!catchCorrect) track.catchErrors++;
    // Convergence-Check (für "not-perceivable" relevant, kommt in 02b/6)
    return _fmCheckAndUpdateStatus(track);
  }

  // Antwort-Interpretation (REF-Frequenz wird geschoben, var bleibt fest):
  //   'var-higher' → User hört var höher als ref → ref-Frequenz war zu tief
  //                  → wir wollen ref ANHEBEN (up, positive cent-Bewegung)
  //   'var-lower'  → User hört var tiefer als ref → ref-Frequenz war zu hoch
  //                  → wir wollen ref SENKEN (down, negative cent-Bewegung)
  const adjustDir = (response === 'var-higher') ? 'up' : 'down';

  if (track.pendingResponse === null) {
    // Erste Antwort der Sequenz: nur speichern, nicht bewegen.
    track.pendingResponse = response;
    return _fmCheckAndUpdateStatus(track);
  }

  // Zweite Antwort der Sequenz: bewegen
  // — bei "2 gleiche":   bewege in Antwort-Richtung (= adjustDir)
  // — bei "1 abweichende": bewege in NEUE Antwort-Richtung (= adjustDir)
  // Beide Fälle: Bewegung in adjustDir, Umkehr-Erkennung über lastMoveDir.

  // Umkehrungs-Erkennung: Bewegung wechselt die Richtung
  if (track.lastMoveDir && track.lastMoveDir !== adjustDir) {
    track.reversals.push(track.currentOffset);
    // Schrittweite halbieren bis Minimum
    track.stepSize = _fmHalfStep(track.stepSize);
  }

  // Schritt ausführen
  const sign = (adjustDir === 'up') ? +1 : -1;
  track.currentOffset += sign * track.stepSize;
  track.lastMoveDir = adjustDir;
  track.pendingResponse = null;

  return _fmCheckAndUpdateStatus(track);
}

// --- Schrittweiten-Halbierung gemäß Sequenz 50→25→12→6→3 ---
function _fmHalfStep(currentStep) {
  // FM_STEP_SEQUENCE ist die kanonische Folge. Wir suchen das nächstkleinere
  // Element, gefloort auf das nächste in der Folge.
  const idx = FM_STEP_SEQUENCE.indexOf(currentStep);
  if (idx >= 0 && idx < FM_STEP_SEQUENCE.length - 1) {
    return FM_STEP_SEQUENCE[idx + 1];
  }
  // Falls der aktuelle Wert nicht in der Folge ist (sollte nicht passieren):
  // halbieren, mindestens FM_STEP_MIN
  return Math.max(FM_STEP_MIN, Math.floor(currentStep / 2));
}

// --- Match (Mittel der letzten 6 Umkehrungen) ---
function fmComputeMatch(track) {
  if (track.reversals.length < FM_REVERSALS_REQ) return null;
  const last6 = track.reversals.slice(-FM_REVERSALS_REQ);
  let sum = 0;
  for (let i = 0; i < last6.length; i++) sum += last6[i];
  return sum / last6.length;
}

// --- Residuum (halbe Spanne der letzten 6 Umkehrungen) ---
function fmComputeResidual(track) {
  if (track.reversals.length < FM_REVERSALS_REQ) return null;
  const last6 = track.reversals.slice(-FM_REVERSALS_REQ);
  let max = -Infinity, min = Infinity;
  for (let i = 0; i < last6.length; i++) {
    if (last6[i] > max) max = last6[i];
    if (last6[i] < min) min = last6[i];
  }
  return (max - min) / 2;
}

// --- Konvergenz-/Endzustands-Check ---
//
// Schreibt status / match / residual auf den Track, wenn ein Endzustand
// erreicht ist. Gibt den (ggf. aktualisierten) status zurück.
//
// HINWEIS: Die "not-perceivable"-Erkennung (Catch-basiert) wird in dieser
// Anleitung NICHT komplett — sie kommt zusammen mit den Catch-Trials in
// Bauanleitung 02b/6. Hier ist nur das Grundgerüst angelegt:
// catchTotal/catchErrors werden geführt, aber nicht ausgewertet.
function _fmCheckAndUpdateStatus(track) {
  if (track.status !== 'active') return track.status;

  // Saubere Konvergenz: ≥6 Umkehrungen, Schrittweite am Minimum,
  // Residuum klein.
  if (track.reversals.length >= FM_REVERSALS_REQ && track.stepSize === FM_STEP_MIN) {
    const residual = fmComputeResidual(track);
    if (residual != null && residual <= FM_RESIDUAL_OK) {
      track.status   = 'converged';
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      return track.status;
    }
    // Stabilitäts-Check für "converged-noisy":
    // letzte 4 Umkehr-Residuen (rolling über 6 Umkehrungen) ändern sich
    // jeweils um < FM_STABLE_DELTA cent
    if (_fmResidualStable(track)) {
      track.status   = 'converged-noisy';
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      return track.status;
    }
  }

  // Hard cap: ≥80 Trials ohne Konvergenz
  if (track.trialCount >= FM_TRIAL_CAP) {
    // "not-perceivable"-Klassifikation wird in 02b/6 ergänzt. Hier:
    // Wenn ausreichend Umkehrungen vorhanden → noisy. Sonst bleibt active,
    // 02b/6 entscheidet anhand catch-Statistik.
    if (track.reversals.length >= FM_REVERSALS_REQ) {
      track.status   = 'converged-noisy';
      track.match    = fmComputeMatch(track);
      track.residual = fmComputeResidual(track);
      return track.status;
    }
    // Notfall-Klassifikation: keine ausreichenden Umkehrungen → noisy mit
    // null-Werten (Track ist faktisch unbrauchbar; 02b/6 entscheidet,
    // ob "not-perceivable" greift)
    track.status   = 'converged-noisy';
    track.match    = (track.reversals.length > 0) ? fmComputeMatch(track) : track.currentOffset;
    track.residual = fmComputeResidual(track);
    return track.status;
  }

  return 'active';
}

// --- Residuums-Stabilität für "converged-noisy" ---
//
// Spec: "letzte 4 Umkehr-Residuen ändern sich um < FM_STABLE_DELTA cent".
// Interpretation: 4 rollende Residuen über je 6 aufeinanderfolgende
// Umkehrungen. Wir brauchen also mindestens 9 Umkehrungen, um 4 rollende
// Fenster zu haben.
function _fmResidualStable(track) {
  const need = FM_REVERSALS_REQ + 3;   // 9 Umkehrungen für 4 rollende Fenster
  if (track.reversals.length < need) return false;
  const rs = [];
  for (let i = track.reversals.length - 4; i < track.reversals.length; i++) {
    const window = track.reversals.slice(i - FM_REVERSALS_REQ + 1, i + 1);
    let max = -Infinity, min = Infinity;
    for (let j = 0; j < window.length; j++) {
      if (window[j] > max) max = window[j];
      if (window[j] < min) min = window[j];
    }
    rs.push((max - min) / 2);
  }
  for (let i = 1; i < rs.length; i++) {
    if (Math.abs(rs[i] - rs[i - 1]) >= FM_STABLE_DELTA) return false;
  }
  return true;
}

// --- Statistik-Helfer für UI/Storage ---
function fmTrackSummary(track) {
  return {
    electrodeIdx: track.electrodeIdx,
    status:       track.status,
    match:        track.match,
    residual:     track.residual,
    trialCount:   track.trialCount,
    catchTotal:   track.catchTotal,
    catchErrors:  track.catchErrors,
    reversalCount: track.reversals.length,
    stepSize:     track.stepSize,
    currentOffset: track.currentOffset
  };
}
```

---

## 3. Skript in `index.html` einbinden

Die neue Datei muss vor `freqmatch.js` geladen werden, damit
deren Funktionen verfügbar sind, wenn `freqmatch.js`-DOMContentLoaded
läuft.

In `index.html`, Skript-Block für die Frequenzabgleich-Dateien
finden (`grep -n "freqmatch" index.html`) und VOR der Zeile mit
`freqmatch.js` einfügen:

```html
<script src="js/freqmatch-staircase.js"></script>
<script src="js/freqmatch.js"></script>
```

---

## 4. Reihenfolge im `<head>`-Order beachten

Die neue Datei hat **keine Abhängigkeiten** zu anderen Projekt-Dateien.
Sie kann theoretisch an beliebiger Position geladen werden. Für
saubere Sortierung: direkt vor `freqmatch.js` einreihen, da
funktional zusammengehörig.

---

## 5. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`:

### 5a) Neue Modul-Zeile

In der Module-Tabelle eine neue Zeile zwischen `freqmatch.js`
und dem nachfolgenden Modul einfügen (oder direkt davor, je
nach Tabellen-Sortierung):

```
| 9b | freqmatch-staircase.js | Pure-Function-Kern für den adaptiven Frequenzabgleich: `fmCreateTrack`, `fmPickNextTrack`, `fmApplyResponse` (2-down-1-up), `fmComputeMatch`, `fmComputeResidual`, `fmTrackSummary`. Konstanten: `FM_STEP_SEQUENCE`, `FM_STEP_MIN`, `FM_REVERSALS_REQ`, `FM_RESIDUAL_OK`, `FM_STABLE_DELTA`, `FM_TRIAL_CAP`. Keine DOM-Abhängigkeit, kein DOMContentLoaded-Handler. |
```

### 5b) Hinweis bei `freqmatch.js`

Bei der Zeile für `freqmatch.js` ergänzen, daß die Datei
seit Bauanleitung 74 den Staircase-Kern aus
`freqmatch-staircase.js` benutzt.

---

## 6. Pure-Function-Selbsttest (im Browser per Konsole)

Diese Anleitung baut **keine UI**. Stattdessen ein Konsolen-
basierter Selbsttest, der die Logik abklappert. Sonnet führt
diesen Test als Teil der Selbstprüfung durch.

### 6a) Track-Erzeugung mit deterministischem RNG

```js
// Deterministischer RNG-Stub für Tests
let _seed = 42;
const _rng = () => { _seed = (_seed * 9301 + 49297) % 233280; return _seed / 233280; };

const t1 = fmCreateTrack(5, null, _rng);
console.log(t1.currentOffset);   // erwartet: irgendein Wert in [-100, +100]
console.log(t1.stepSize);        // erwartet: 50
console.log(t1.status);          // erwartet: 'active'
console.log(t1.reversals);       // erwartet: []
```

### 6b) Stair walk konvergiert

Synthetischer User: antwortet konsistent gemäß Vorzeichen
des aktuellen Offset (= ref-Vorsprung gegenüber var-Soll, in cent).
Bei offset > 0 hört der User ref höher als var → Antwort
`'var-lower'`. Bei offset < 0: `'var-higher'`. Bei offset ≈ 0
fluktuierend (Noise).

```js
const track = fmCreateTrack(5, null, _rng);
track.currentOffset = 80;   // ref liegt +80 cent über var-Soll; Match-Soll bei 0
let safety = 200;
while (track.status === 'active' && safety-- > 0) {
  const noise = (_rng() - 0.5) * 4;  // ±2 cent Wahrnehmungs-Jitter
  const perceived = track.currentOffset + noise;
  const response = perceived > 0 ? 'var-lower' : 'var-higher';
  fmApplyResponse(track, response, false, false, 'ref');
}
console.log(track.status);         // erwartet: 'converged' oder 'converged-noisy'
console.log(track.match);          // erwartet: nahe 0 (innerhalb ±10 cent)
console.log(track.residual);       // erwartet: ≤ 10 für 'converged'
console.log(track.reversals.length); // erwartet: ≥ 6
console.log(track.stepSize);       // erwartet: 3 (Minimum erreicht)
```

### 6c) Schrittweiten-Folge

```js
const t = fmCreateTrack(0, null, _rng);
t.currentOffset = 100;
// Erzwinge 4 Umkehrungen mit abwechselnden Antworten:
fmApplyResponse(t, 'var-higher', false, false, 'ref');  // pending=v-h
fmApplyResponse(t, 'var-higher', false, false, 'ref');  // move up,   stepSize bleibt 50 (1. Move)
fmApplyResponse(t, 'var-lower',  false, false, 'ref');  // pending=v-l
fmApplyResponse(t, 'var-lower',  false, false, 'ref');  // move down — Umkehr! stepSize 25
fmApplyResponse(t, 'var-higher', false, false, 'ref');  // pending=v-h
fmApplyResponse(t, 'var-higher', false, false, 'ref');  // move up   — Umkehr! stepSize 12
fmApplyResponse(t, 'var-lower',  false, false, 'ref');
fmApplyResponse(t, 'var-lower',  false, false, 'ref');  // move down — Umkehr! stepSize 6
fmApplyResponse(t, 'var-higher', false, false, 'ref');
fmApplyResponse(t, 'var-higher', false, false, 'ref');  // move up   — Umkehr! stepSize 3
console.log(t.stepSize);              // erwartet: 3
console.log(t.reversals.length);      // erwartet: 4
```

### 6d) pickNextTrack zufällig

```js
const tracks = {
  3: fmCreateTrack(3, null, _rng),
  5: fmCreateTrack(5, null, _rng),
  8: fmCreateTrack(8, null, _rng)
};
tracks[5].status = 'converged';
for (let i = 0; i < 20; i++) {
  const next = fmPickNextTrack(tracks, _rng);
  if (![3, 8].includes(next)) {
    console.error('FAIL: picked converged or invalid track', next);
    break;
  }
}
console.log('pickNext OK');
```

---

## Akzeptanztest

In dieser Anleitung passiert UI-mäßig nichts Neues. Akzeptanztest
läuft über die Konsolen-Selbsttests aus Schritt 6.

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.74-beta`.
2. Konsole öffnen, keine Fehler beim Page-Load.
3. Eingeben:
   ```js
   typeof fmCreateTrack === 'function'
   typeof fmApplyResponse === 'function'
   typeof fmPickNextTrack === 'function'
   typeof fmComputeMatch === 'function'
   typeof fmComputeResidual === 'function'
   ```
   Erwartet: `true` für alle.
4. Selbsttest 6a, 6b, 6c, 6d aus dieser Anleitung in die Konsole
   kopieren und ausführen. Erwartete Ausgaben treffen ein, keine
   Errors.
5. Slider-Test ausführen (bisheriger Modus): startet, läuft, speichert
   wie gewohnt. **Keine Regression.**
6. Modus auf `adaptive` setzen, Start klicken: Alert „Adaptiver
   Modus noch nicht implementiert" erscheint (Stub aus 02b/2 ist
   unverändert).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

1. Akzeptanztest-Schritte einzeln durchgehen und Status melden.
2. Selbsttest 6a–6d **selbst** im Browser ausführen (über
   Selbstprüfung-Konsolen-Zugriff oder per manuellem Hinweis
   an den User mit Aufforderung, das Ergebnis zu posten).
3. Bei methodischen Zweifeln zur 2-down-1-up-Interpretation,
   Schrittweiten-Folge oder Residuums-Stabilität: **rückfragen**,
   nicht annehmen. Der Algorithmus ist Herzstück; Fehler hier
   propagieren in alle Folge-Anleitungen.
4. Prüfen: in `freqmatch-staircase.js` keine DOM-Zugriffe
   (`document`, `window`, `fmEls`, `sideData`, …). Keine
   globalen Side-Effects außer der Modul-Konstanten.

---

## Was diese Anleitung NICHT macht

- Keine Trial-Loop-Logik (kommt in 02b/4)
- Kein Tonklingen oder Antwort-Routing (kommt in 02b/4)
- Kein Status-Grid-Update (kommt in 02b/4)
- Keine Pause/Resume-Persistenz (kommt in 02b/5)
- Keine Catch-Trial-Erzeugung (Strukturen sind vorbereitet,
  Erzeugung kommt in 02b/6)
- Keine "not-perceivable"-Entscheidung (kommt in 02b/6)
- Keine Chart-Anpassung (kommt in 02b/7)
- Keine i18n-Strings (kommt in 02b/8)
