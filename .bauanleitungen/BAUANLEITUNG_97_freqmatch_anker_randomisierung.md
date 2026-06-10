# BA 97 — Anker-Randomisierung im Restpool

## Ziel

Am Test-Ende, wenn nur noch wenige Tracks aktiv sind, fällt der
geshuffelte Round-Robin in ein vorhersehbares Muster zurück: bei z.B.
nur zwei verbleibenden Tracks `A B A B A B …`. Der User merkt das, was
den Anker-Schutz aushebelt.

Lösung: Sobald die aktive Track-Anzahl unter `FM_ANCHOR_SMALL_POOL = 4`
fällt, ersetzt eine **echte Randomisierung mit Wiederholungs-Sperre**
den Round-Robin. „Wiederholungs-Sperre" heißt: derselbe Track darf
nicht direkt zweimal hintereinander gewählt werden (außer es ist
nur noch ein einziger aktiv).

Siehe `docs/spec/02b-freqmatch-adaptiv.md`, Abschnitt „Verfahren im
Überblick", Punkt „Anker-Schutz am Test-Ende".

## Vorbedingungen

- BA 91–96 sind gebaut und akzeptiert.
- `fmPickNextTrack(state, rng)` lebt in `js/freqmatch-staircase.js` und
  arbeitet jetzt mit Track-Keys vom Typ String (`<idx>:up` / `<idx>:down`).

## Akzeptanztest

1. Test starten, alle Elektroden bis kurz vor Konvergenz durchspielen.
2. Wenn nur noch 3 oder weniger Tracks aktiv sind, im Debug-Log
   (`_fmDbg`) oder im Status-Grid beobachten: aufeinanderfolgende
   Trials kommen NICHT mehr im strikten Wechsel `A B A B`, sondern
   gemischt (z. B. `A B B A A B`).
3. Bei nur 2 verbleibenden Tracks: kein Trial wiederholt unmittelbar
   denselben Track (z. B. `A A` ist verboten), `A B A B A B` mit kleiner
   zufälliger Variation (z. B. `A B B A`) ist erlaubt.
4. Bei nur 1 verbleibenden Track: dieser Track läuft selbstverständlich
   wiederholt — Wiederholungs-Sperre greift dann nicht.
5. Bei großem Pool (≥4 aktive Tracks) verhält sich `fmPickNextTrack`
   exakt wie bisher (geshuffelter Round-Robin). Regressionstest.

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.97-beta";
```

## Schritt 2 — Konstante und Last-Picked-State

In `js/freqmatch-staircase.js`, Konstanten-Block (Z. 9–24). **Ergänzen**:

```js
const FM_ANCHOR_SMALL_POOL = 4;   // ab so wenigen aktiven Tracks Anker-Randomisierung statt Round-Robin
```

In `js/freqmatch.js` ganz oben, bei den fm-State-Variablen, eine neue
ergänzen:

```js
let fmLastPickedTrackId = null;   // BA 97: Wiederholungs-Sperre für Anker-Randomisierung
```

Beim Start eines neuen Laufs in `fmStartAdaptive` zurücksetzen:

```js
fmLastPickedTrackId = null;
```

(Direkt neben `fmCurTrackId = null;` — Stelle ist nach Schritt 1 von BA 93/94.)

Nach jedem `fmPickNextTrack`-Aufruf in `fmNextAdaptiveTrial`
(Z. 513 im heutigen Code) den aktuellen Track als
`fmLastPickedTrackId` merken:

```js
// vorher (vereinfacht)
fmCurTrackId = fmPickNextTrack(_rrState, undefined);

// nachher
fmCurTrackId = fmPickNextTrack(_rrState, undefined, fmLastPickedTrackId);
if (fmCurTrackId !== null) fmLastPickedTrackId = fmCurTrackId;
```

## Schritt 3 — `fmPickNextTrack` erweitern

In `js/freqmatch-staircase.js`, Funktion `fmPickNextTrack` (Z. 71).
**Signatur erweitern** und **Logik ergänzen**:

```js
// vorher
function fmPickNextTrack(state, rng) {
  // ...
  const tracks = state.tracks || {};
  const activeIds = Object.keys(tracks)
    .filter(function(k) { return tracks[k].status === 'active'; })
    .map(function(k) { return parseInt(k, 10); });
  if (activeIds.length === 0) return null;

  // Aus der Restliste die nächste noch aktive ID nehmen.
  while (state.roundQueue && state.roundQueue.length > 0) {
    const cand = state.roundQueue.shift();
    if (tracks[cand] && tracks[cand].status === 'active') {
      return cand;
    }
  }

  // Neue Runde: aktive IDs in zufälliger Reihenfolge ...
  // (Fisher-Yates ...)
}
```

```js
// nachher
function fmPickNextTrack(state, rng, lastPickedKey) {
  // Rückwärtskompatibilität wie bisher
  if (state && state.electrodeIdx === undefined && state.tracks === undefined) {
    state = { tracks: state, roundQueue: [] };
  }

  const r = rng || Math.random;
  const tracks = state.tracks || {};

  // BA 94: Track-Keys sind ab BA 94 Strings ("<idx>:up" / "<idx>:down").
  // Wir lassen die Keys jetzt als String, parseInt entfällt.
  const activeIds = Object.keys(tracks)
    .filter(function(k) { return tracks[k].status === 'active'; });
  if (activeIds.length === 0) return null;

  // --- Anker-Randomisierung im Restpool (BA 97) ---
  if (activeIds.length < FM_ANCHOR_SMALL_POOL) {
    // Roundqueue wird im kleinen Pool ignoriert. Echte Random-Wahl
    // mit Wiederholungs-Sperre.
    state.roundQueue = [];

    let candidates = activeIds;
    if (lastPickedKey != null && activeIds.length > 1) {
      const filtered = activeIds.filter(function(k) { return k !== lastPickedKey; });
      if (filtered.length > 0) candidates = filtered;
    }
    return candidates[Math.floor(r() * candidates.length)];
  }

  // --- Normaler Modus: geshuffelter Round-Robin ---
  while (state.roundQueue && state.roundQueue.length > 0) {
    const cand = state.roundQueue.shift();
    if (tracks[cand] && tracks[cand].status === 'active') {
      return cand;
    }
  }

  // Neue Runde: aktive IDs in zufälliger Reihenfolge in die Queue
  // schreiben. Fisher-Yates-Shuffle.
  const shuffled = activeIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  state.roundQueue = shuffled;
  return state.roundQueue.shift();
}
```

**Wichtig (Lessons learned, „State-Mutation"):** `state.roundQueue = []`
im Anker-Modus mutiert das State-Objekt in-place. Der Caller
(`fmNextAdaptiveTrial`) liest danach `_rrState.roundQueue` und schreibt
es nach `fmRoundQueue` zurück — also Zuweisung an die Property eines
übergebenen Objekts ist OK (sie wird nicht ersetzt, sondern ihr Inhalt
wird zugewiesen). Sollte in der Tests funktionieren.

## Schritt 4 — Caller-Anpassung dokumentieren

Der einzige Caller von `fmPickNextTrack` ist `fmNextAdaptiveTrial` in
`js/freqmatch.js`. Mit dem neuen 3. Parameter (`lastPickedKey`) wird
die Wiederholungs-Sperre angesteuert. Andere Caller existieren nicht
(`grep -n "fmPickNextTrack" js/`).

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden.

Zusätzlich gegenchecken:
- `fmLastPickedTrackId` wird in `fmStartAdaptive` auf `null` gesetzt
  (vor jedem neuen Lauf), und nach jedem erfolgreichen
  `fmPickNextTrack`-Aufruf auf den frisch gewählten Key gesetzt.
- Anker-Modus-Branch greift erst, wenn `activeIds.length < 4`. Bei 4
  oder mehr aktiven Tracks unverändertes Round-Robin-Verhalten.
- Bei nur einem aktiven Track liefert der Anker-Modus immer denselben
  Track (das `filtered.length > 0`-Guard verhindert leere Auswahl).
- Bei Pause/Resume: `fmLastPickedTrackId` ist nach Resume nicht mehr
  konsistent (Variable wird beim Reload nicht persistiert). Das ist
  akzeptabel — Wiederholungs-Sperre greift dann erst beim
  zweitnächsten Trial wieder korrekt. Wenn dieser Edge-Case stört:
  als bekannte Lücke melden, ggf. später beheben.

## Hinweis

Keine i18n-Änderungen. Keine SPEC-Änderung nötig (die SPEC enthält den
Anker-Schutz bereits seit dem SPEC-Update aus dieser BA-Serie).
