# BA 96 — Konvergenz-Verfeinerung: 5 Status-Kategorien, Catch-Schwelle 67 %, adaptive Catch-Spreizung

## Ziel

Drei thematisch eng verwandte Anpassungen am Konvergenz- und Catch-Code:

1. **Status-Kategorien feiner**: aus den heute zwei Konvergenz-Stati
   (`converged`, `converged-noisy`) werden drei nach Residuum gestaffelt
   (`converged`, `converged-fair`, `converged-wide`). Neu außerdem
   `unstable` (Hard-Cap ohne sauberen Match) und `aborted` (User-Abbruch).
2. **Catch-Fehlerrate-Schwelle** von 50 % auf **67 %** (`2/3`) erhöhen.
   Mit nur 3 Catch-Trials hat die alte 50-%-Schwelle eine zu hohe
   Falsch-Positiv-Rate (~12,5 % bei gut hörendem User).
3. **Catch-Spreizung adaptiv**: statt fix ±500 ct nun
   `max(500, 2·currentResidual)` ct. Bei großen Residuen werden ±500 ct
   nicht mehr als „eindeutig hörbarer Unterschied" wahrgenommen.

Siehe `docs/spec/02b-freqmatch-adaptiv.md`, Abschnitte
„Konvergenz und Ergebnis-Kategorien" und „Catch-Trials".

## Vorbedingungen

- BA 91–95 sind gebaut und akzeptiert.

## Akzeptanztest

1. Test mit absichtlich konsistenten Antworten durchspielen. Erwartet:
   Track-Status `converged` (grün ✓), Residuum ≤ 10 ct.
2. Test mit etwas wackeligen Antworten (User antwortet nicht perfekt
   konsistent in der Nähe des Match-Punkts): einzelne Tracks landen
   bei `converged-fair` (gelb ◐). Residuum 11-25 ct.
3. Bei sehr wackeligen Antworten: `converged-wide` (orange ◐),
   Residuum 26-50 ct.
4. Wenn Hard-Cap (80 Trials) ohne Konvergenz erreicht und Residuum
   > 50 ct: `unstable` (rot-orange ⚠), Match-Wert trotzdem verfügbar
   (mit Vorbehalt).
5. Bei zufälligen Catch-Antworten (User rät überall): bei einem
   Track-Catch-Statistik von 2/3 falsch → `not-perceivable` (rot ✗).
   Bei 1/3 falsch → kein `not-perceivable`-Trigger.
6. Catch-Trials bei einer Elektrode, deren laufendes Residuum 250 ct
   ist: Catch-Spreizung beträgt 2·250 = 500 ct (also unverändert die
   Untergrenze). Bei Residuum 350 ct: Spreizung = 700 ct.
7. Status-Grid und Ergebnistabelle zeigen die neuen Status-Badges:
   `converged-fair` und `converged-wide` als verschiedene Farben (gelb
   vs. orange), `unstable` als rot-oranges Warn-Badge.
8. Alte Datensätze mit `status: 'converged-noisy'` werden weiterhin
   gelesen — kein Crash; in der Anzeige werden sie als `converged-fair`
   gemappt (Backwards-Compat).

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.96-beta";
```

## Schritt 2 — Konstanten anpassen

In `js/freqmatch-staircase.js`, Z. 9–24. **Drei Konstanten ergänzen/ändern**:

```js
// vorher
const FM_RESIDUAL_OK   = 10;                   // Residuum für saubere Konvergenz (cent)
const FM_STABLE_DELTA  = 2;                    // Residuums-Stabilität für noisy (cent)
...
const FM_NOT_PERC_ERR_RATE  = 0.5;  // Catch-Fehlerrate für not-perceivable
```

```js
// nachher
const FM_RESIDUAL_OK     = 10;          // converged-Schwelle (cent)
const FM_RESIDUAL_FAIR   = 25;          // converged-fair-Schwelle (cent)
const FM_RESIDUAL_WIDE   = 50;          // converged-wide-Schwelle (cent)
const FM_STABLE_DELTA    = 2;           // Residuums-Stabilität (cent)
...
const FM_NOT_PERC_ERR_RATE  = 2/3;     // Catch-Fehlerrate für not-perceivable (BA 96)
```

`FM_STABLE_DELTA` bleibt — wird in `_fmResidualStable` für die
Hard-Cap-Logik weiter genutzt.

## Schritt 3 — `_fmCheckAndUpdateStatus` umbauen

In `js/freqmatch-staircase.js`, Funktion `_fmCheckAndUpdateStatus`
(Z. 209). **Komplett ersetzen**:

```js
function _fmCheckAndUpdateStatus(track) {
  if (track.status !== 'active') return track.status;

  // Not-perceivable-Check: immer, unabhängig von Umkehr-Zahl.
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

  // Saubere Konvergenz: ≥6 Umkehrungen, Schrittweite am Minimum.
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
      if (residual <= FM_RESIDUAL_WIDE && _fmResidualStable(track)) {
        // Stabile, aber breit gestreute Konvergenz
        track.status   = 'converged-wide';
        track.match    = fmComputeMatch(track);
        track.residual = residual;
        return track.status;
      }
      // Residuum > FM_RESIDUAL_WIDE oder nicht stabil → noch nicht konvergiert,
      // weiter laufen lassen (bis zum Hard-Cap)
    }
  }

  // Hard-Cap erreicht ohne Konvergenz: als unstable klassifizieren,
  // Match-Wert mit Vorbehalt aus bisherigen Umkehrungen mitteln.
  if (track.trialCount >= FM_TRIAL_CAP) {
    if (track.reversals.length >= FM_REVERSALS_REQ) {
      const residual = fmComputeResidual(track);
      track.match    = fmComputeMatch(track);
      track.residual = residual;
      track.status   = (residual != null && residual <= FM_RESIDUAL_WIDE)
                       ? 'converged-wide'
                       : 'unstable';
      return track.status;
    }
    // Nicht mal 6 Umkehrungen → kein Match möglich, als unstable mit currentOffset
    track.status   = 'unstable';
    track.match    = track.reversals.length > 0
                     ? fmComputeMatch(track)
                     : track.currentOffset;
    track.residual = (track.reversals.length >= 2)
                     ? fmComputeResidual(track) : null;
    return track.status;
  }

  return 'active';
}
```

**Wichtig (Lessons learned, „getrennte Schwellen"):** Drei separate
Konstanten (`FM_RESIDUAL_OK`, `_FAIR`, `_WIDE`), drei separate
if-Branches. Nicht in eine Konstante zusammenfassen.

## Schritt 4 — Track-Initial-Status-Kommentar anpassen

In `js/freqmatch-staircase.js`, Z. 51 (Kommentar im `fmCreateTrack`-Return):

```js
// vorher
    status:           'active',       // 'active' | 'converged' | 'converged-noisy' | 'not-perceivable'
// nachher
    status:           'active',       // 'active' | 'converged' | 'converged-fair' | 'converged-wide'
                                       //  | 'unstable' | 'not-perceivable' | 'aborted'
```

## Schritt 5 — `aborted`-Status setzen

In `js/freqmatch.js`, Funktion `fmAbort` (suchen — Funktion, die der
Stop-Button auslöst). Beim Abbrechen aller aktiven Tracks deren Status
auf `aborted` setzen:

```js
// Suche in fmAbort die Stelle, wo der Test gestoppt wird, und ergänze:
if (fmTracks) {
  Object.keys(fmTracks).forEach(function(k) {
    if (fmTracks[k].status === 'active') {
      fmTracks[k].status = 'aborted';
    }
  });
  _fmPersist();
}
```

**Edge-Case:** Die heutige Pause/Resume-Logik braucht den Status
`active` für Tracks, die später fortgesetzt werden sollen. Daher
`aborted` nur setzen, wenn der User wirklich abbricht (z.B. via
„Messungen löschen" oder einem expliziten „Test beenden"-Button — der
heute nicht existiert).
**Empfehlung:** Diesen Schritt 5 erstmal NICHT implementieren, sondern
in einer eigenen kleinen Folge-BA (BA 96b) das Abbruch-vs.-Pause-Konzept
sauber spezifizieren. In dieser BA bleibt der Status `aborted` als
gültiger Wert nur in der Status-Typ-Definition und in
`_fmCombineTwoTracks` (aus BA 94) — gesetzt wird er nicht automatisch.

(Falls Sonnet hier unsicher ist: lieber Schritt 5 ganz weglassen und
in der Selbstprüfung als „nicht implementiert, offen für BA 96b"
melden, statt eine unklare Implementierung zu liefern.)

## Schritt 6 — Adaptive Catch-Spreizung

In `js/freqmatch.js`, Funktion `fmNextAdaptiveTrial`, Z. 526–531.
**Ersetzen**:

```js
// vorher
  if ((fmTracks[fmCurTrackId].trialCount % FM_CATCH_INTERVAL) === FM_CATCH_PHASE) {
    const dir = (Math.random() < 0.5) ? +FM_CATCH_MAGNITUDE : -FM_CATCH_MAGNITUDE;
    fmCurCatchInfo = {
      direction:        dir,
      expectedResponse: (dir > 0) ? 'var-higher' : 'var-lower'
    };
  } else {
    fmCurCatchInfo = null;
  }
// nachher
  if ((fmTracks[fmCurTrackId].trialCount % FM_CATCH_INTERVAL) === FM_CATCH_PHASE) {
    // Adaptive Spreizung: bei großem Residuum wird ±500 ct nicht mehr
    // eindeutig hörbar. Spreizung mit dem Residuum mitwachsen lassen.
    const _t = fmTracks[fmCurTrackId];
    let _resForCatch = 0;
    if (_t.reversals && _t.reversals.length >= 2) {
      // grobe laufende Residuum-Schätzung (halbe Spanne aller Umkehrungen)
      let _max = -Infinity, _min = Infinity;
      for (let _i = 0; _i < _t.reversals.length; _i++) {
        if (_t.reversals[_i] > _max) _max = _t.reversals[_i];
        if (_t.reversals[_i] < _min) _min = _t.reversals[_i];
      }
      _resForCatch = (_max - _min) / 2;
    }
    const _mag = Math.max(FM_CATCH_MAGNITUDE, 2 * _resForCatch);
    const dir = (Math.random() < 0.5) ? +_mag : -_mag;
    fmCurCatchInfo = {
      direction:        dir,
      expectedResponse: (dir > 0) ? 'var-higher' : 'var-lower'
    };
  } else {
    fmCurCatchInfo = null;
  }
```

## Schritt 7 — Status-Badges und i18n

In `js/results.js` (Status-Badge-Switch, Z. 487 ff). **Erweitern**:

```js
      } else if (r.fmStatus === 'converged') {
        statusBadge = '<span class="fm-badge fm-badge-ok" data-t="fmrStatusOk">'
                    + t('fmrStatusOk') + '</span>';
      } else if (r.fmStatus === 'converged-fair') {
        statusBadge = '<span class="fm-badge fm-badge-fair" data-t="fmrStatusFair">'
                    + t('fmrStatusFair') + '</span>';
      } else if (r.fmStatus === 'converged-wide') {
        statusBadge = '<span class="fm-badge fm-badge-wide" data-t="fmrStatusWide">'
                    + t('fmrStatusWide') + '</span>';
      } else if (r.fmStatus === 'unstable') {
        statusBadge = '<span class="fm-badge fm-badge-unstable" data-t="fmrStatusUnstable">'
                    + t('fmrStatusUnstable') + '</span>';
      } else if (r.fmStatus === 'aborted') {
        statusBadge = '<span class="fm-badge fm-badge-aborted" data-t="fmrStatusAborted">'
                    + t('fmrStatusAborted') + '</span>';
      } else if (r.fmStatus === 'converged-noisy') {
        // Backwards-Compat: alte Status-Werte als converged-fair anzeigen
        statusBadge = '<span class="fm-badge fm-badge-fair" data-t="fmrStatusFair">'
                    + t('fmrStatusFair') + '</span>';
      } else if (r.fmStatus === 'not-perceivable') {
        statusBadge = '<span class="fm-badge fm-badge-np" data-t="fmrStatusNp">'
                    + t('fmrStatusNp') + '</span>';
      } else {
        statusBadge = '<span class="muted">—</span>';
      }
```

In `js/freqmatch.js` ähnliche Status-Badge-Map ergänzen (Status-Grid,
Z. 853 ff):

```js
// vorher
      'converged':       '✓ konvergiert',
      'converged-noisy': '◐ unsicher',
      'not-perceivable': '✗ nicht wahrnehmbar'
// nachher
      'converged':       '✓ konvergiert',
      'converged-fair':  '◐ leichte Streuung',
      'converged-wide':  '◐ breite Streuung',
      'unstable':        '⚠ unstabil',
      'aborted':         '∅ abgebrochen',
      'not-perceivable': '✗ nicht wahrnehmbar',
      'converged-noisy': '◐ leichte Streuung'   // Backwards-Compat
```

## Schritt 8 — CSS für die neuen Badges

In `css/style.css` (oder analog, wo `fm-badge-ok` / `fm-badge-noisy`
definiert sind — vor dem Anlegen suchen). Neue Klassen ergänzen:

```css
.fm-badge-fair     { background:#fef3c7; color:#92400e; }   /* gelb */
.fm-badge-wide     { background:#fed7aa; color:#9a3412; }   /* orange */
.fm-badge-unstable { background:#fecaca; color:#9a3412; }   /* rot-orange */
.fm-badge-aborted  { background:#e5e7eb; color:#374151; }   /* grau */
```

Vorhandenes `fm-badge-noisy` kann bleiben (wird durch `fm-badge-fair`
abgelöst, aber Backwards-Compat-Anzeigen nutzen `fair`).

## Schritt 9 — i18n DE

In `i18n/de.js` neue Keys ergänzen:

```js
    fmrStatusFair: "Streuung",
    fmrStatusWide: "starke Streuung",
    fmrStatusUnstable: "unstabil",
    fmrStatusAborted: "abgebrochen",
```

(Bestehende `fmrStatusOk`, `fmrStatusNoisy`, `fmrStatusNp` bleiben.)

In den Status-Grid-Strings (vermutlich in `i18n/de.js` ebenfalls
vorhanden), entsprechende Werte ergänzen. Falls die Strings im Code
fest verdrahtet sind (Schritt 7 oben), entfällt das.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen.
Zusätzlich gegenchecken:

- `grep -n "FM_RESIDUAL\\|FM_NOT_PERC_ERR_RATE" js/` — drei separate
  Konstanten (`OK`, `FAIR`, `WIDE`) sichtbar, Catch-Schwelle auf `2/3`
  gesetzt.
- `grep -n "converged-noisy" js/` — nur noch in Backwards-Compat-
  Branches (Anzeige) und in der `RANK`-Map (BA 94), KEINE Schreibstellen
  mehr im Konvergenz-Code.
- In `js/results.js` haben die Helper `_fmrBuildInProgressEntries` und
  `_fmrCollectNotPerceivable` (von Sonnet bei BA 93/94 eingeführt/angepasst)
  ggf. eigene Status-Mappings oder Badge-Strings. Beim Bau einmal inspizieren
  und prüfen, ob die neuen Status-Werte (`converged-fair`, `converged-wide`,
  `unstable`, `aborted`) dort konsistent durchgereicht werden. In der
  Selbstprüfung explizit melden, welche dieser Helper berührt wurden.
- Adaptive Catch-Spreizung: `_mag` ist nie kleiner als
  `FM_CATCH_MAGNITUDE`.
- Schritt 5 (`aborted`-Setzung) bewußt offen lassen — als bekannte
  Lücke melden, in BA 96b zu klären.

## Hinweis

i18n en/fr/es der neuen Status-Strings folgt in der Mini-Anleitung am
Ende der BA-Serie. Bis dahin greift der i18n-Fallback auf den deutschen
String.
