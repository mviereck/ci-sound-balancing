# Bauanleitung 99 — Frequenzabgleich: drei Ergebnis-Spalten (Konvergenz u/d, Track-Differenz, Residuum)

## Voraussetzung

BA 98 muß abgenommen sein. Die Reste der Lauf-2-Anzeige müssen
weg sein, sonst kollidieren die Spaltennamen.

## Kontext

Die heutige Ergebnis-Tabelle im Reiter Frequenzabgleich zeigt
zwei Spalten:

- „Restunsicherheit" — Mittelwert der halben Umkehr-Spannen
  beider Tracks (innerhalb eines Laufs) und über alle Läufe.
- „Unsicherheit (ges.)" — `sqrt(meanResidual² + (matchSpread/2)²)`,
  wobei `matchSpread` ausschließlich die Streuung der pro-Lauf-
  Mittelwerte ist. Bei nur einem Lauf ist `matchSpread = 0`,
  also identisch mit „Restunsicherheit". Nicht informativ.

Beobachtung aus realen Test-Daten: die zwei Staircases pro
Elektrode (Track-up startet bei +100 ct, Track-down bei
−100 ct) konvergieren oft **deutlich auseinander** — bei
einigen Elektroden über 100 ct Differenz. Der Mittelwert der
beiden Tracks-Residuen versteckt das vollständig. Der Nutzer
möchte diese drei Größen getrennt sehen können.

## Ziel

Die Tabelle bekommt zwischen „Diff. (Cent)" und „Status" drei
Spalten statt zwei:

| Spalte | Inhalt | Format E0-Beispiel |
|---|---|---|
| **Konvergenz u/d (ct)** | mittlere halbe Umkehr-Spanne Track-up / Track-down (über Läufe) | `±22 / ±19` |
| **Track-Differenz (ct)** | mittlere `|Match_up − Match_down|` (über Läufe) | `270` |
| **Residuum (ct)** | quadratisch kombiniert, ampelgefärbt, Tooltip mit Aufschlüsselung | `±135` |

**Residuum-Formel:**

```
σ_konv     = (residual_up_mean + residual_down_mean) / 2
σ_trackHalf = trackDiff_mean / 2
σ_runHalf   = runSpread / 2

residuum = sqrt(σ_konv² + σ_trackHalf² + σ_runHalf²)
```

mit:

- `residual_up_mean` = Mittelwert der `residual`-Werte aller
  Track-up-Tracks dieser Elektrode über alle Läufe
- `residual_down_mean` = analog für Track-down
- `trackDiff_mean` = Mittelwert über Läufe von
  `|match_up − match_down|` (pro Lauf einer)
- `runSpread` = `max(perRunMatchMean) − min(perRunMatchMean)`,
  also Spannweite der pro-Lauf-Mittelwerte. Bei einem Lauf = 0.

Quadratisch kombiniert (anstelle additiv) ist die übliche Annahme
für unabhängige Fehlerquellen. **Additiv** wäre konservativer
(pessimistischer) und ist ebenfalls vertretbar — siehe Vermerk in
der Spec.

Ampelfarbe nur auf der **Residuum**-Spalte:
- ≤10 ct grün (`#16a34a`)
- 11–25 ct gelb-orange (`#d97706`)
- \>25 ct rot (`#dc2626`)

Die anderen beiden Spalten bleiben farbneutral (graues Text).

Tooltip auf der Residuum-Zelle zeigt die Aufschlüsselung:
> Konvergenz ±N ct · Track-Differenz N ct · Run-Differenz N ct (R Lauf/Läufe)

## Anzeige bei not-perceivable / aborted

Auch zweifelhafte Werte werden angezeigt — große Streuung ist
eine Aussage, kein Grund zum Verstecken. Konkret:

- **Track up `not-perceivable`, Track down konvergiert:**
  „Konvergenz u/d" zeigt `✗ / ±N`. „Track-Differenz" zeigt `—`.
  „Residuum" zeigt `—`.
- **Track up `aborted`, Track down konvergiert:**
  „Konvergenz u/d" zeigt `— / ±N`. „Track-Differenz" zeigt `—`.
  „Residuum" zeigt `—`.
- **Beide `not-perceivable`:** alle drei Spalten zeigen `—` mit grauer Farbe.
- **Beide konvergiert in beliebiger Qualität (`converged`,
  `converged-fair`, `converged-wide`):** volle Drei-Spalten-Anzeige
  mit allen Werten.
- **Mindestens einer `unstable` und beide haben einen Match-Wert:**
  volle Drei-Spalten-Anzeige (große Streuung sichtbar machen).

## Volumen

Mittlere Größe — mehrere Dateien (`freqmatch.js`, `chart.js`,
`results.js`, `i18n/de.js`, Spec). Sorgfältig snippet-by-snippet
arbeiten.

## Schritt 1 — `js/version.js`

```js
const APP_VERSION = "3.0.99-beta";
```

## Schritt 2 — Aggregation umbauen: `_fmCombineTwoTracks` erweitern

In `js/freqmatch.js` die Funktion `_fmCombineTwoTracks`
(ab Z. 799) erweitern: zusätzlich zu `match`, `residual`,
`status` auch `matchUp`, `matchDown`, `residualUp`,
`residualDown`, `trackDiff` zurückgeben. Das bestehende
Rückgabe-Objekt wird ergänzt, vorhandene Felder bleiben
unverändert. Die alten Aufrufer (`_fmAggregateRunsForElectrode`,
`fmRenderStatusGrid`) lesen weiter die alten Felder; neue Logik
ab Schritt 3 nutzt die neuen Felder zusätzlich.

**Skeleton der erweiterten Funktion:**

```js
function _fmCombineTwoTracks(trackUp, trackDown) {
  if (!trackUp && !trackDown) {
    return { match: null, residual: null, status: 'aborted',
             matchUp: null, matchDown: null,
             residualUp: null, residualDown: null,
             trackDiff: null,
             statusUp: 'aborted', statusDown: 'aborted' };
  }
  const upSt   = trackUp   ? trackUp.status   : 'aborted';
  const downSt = trackDown ? trackDown.status : 'aborted';

  // Roh-Werte pro Track (immer mit zurückgeben, auch bei sonstigen Status)
  const mu = trackUp   ? trackUp.match    : null;
  const md = trackDown ? trackDown.match  : null;
  const ru = trackUp   ? trackUp.residual  : null;
  const rd = trackDown ? trackDown.residual : null;
  const trackDiff = (mu != null && md != null) ? Math.abs(mu - md) : null;

  if (upSt === 'aborted' && downSt === 'aborted') {
    return { match: null, residual: null, status: 'aborted',
             matchUp: mu, matchDown: md,
             residualUp: ru, residualDown: rd,
             trackDiff: trackDiff,
             statusUp: upSt, statusDown: downSt };
  }
  // Noch aktive Tracks → Elektrode in-progress
  if (upSt === 'active' || downSt === 'active') {
    return { match: null, residual: null, status: 'in-progress',
             matchUp: mu, matchDown: md,
             residualUp: ru, residualDown: rd,
             trackDiff: trackDiff,
             statusUp: upSt, statusDown: downSt };
  }
  // Einer not-perceivable → Elektrode not-perceivable (SPEC)
  if (upSt === 'not-perceivable' || downSt === 'not-perceivable') {
    return { match: null, residual: null, status: 'not-perceivable',
             matchUp: mu, matchDown: md,
             residualUp: ru, residualDown: rd,
             trackDiff: trackDiff,
             statusUp: upSt, statusDown: downSt };
  }
  // Mindestens einer unstable → Elektrode unstable
  if (upSt === 'unstable' || downSt === 'unstable') {
    const ms = [mu, md].filter(function(x) { return x != null; });
    const m = ms.length ? ms.reduce(function(s, x) { return s + x; }, 0) / ms.length : null;
    const rs = [ru, rd].filter(function(x) { return x != null; });
    const r = rs.length ? rs.reduce(function(s, x) { return s + x; }, 0) / rs.length : null;
    return { match: m, residual: r, status: 'unstable',
             matchUp: mu, matchDown: md,
             residualUp: ru, residualDown: rd,
             trackDiff: trackDiff,
             statusUp: upSt, statusDown: downSt };
  }
  // Beide haben Match (irgendeine converged-Variante)
  const match    = (mu != null && md != null) ? (mu + md) / 2 : (mu != null ? mu : md);
  const residual = (ru != null && rd != null) ? (ru + rd) / 2 : (ru != null ? ru : rd);
  const RANK   = { 'converged': 0, 'converged-fair': 1, 'converged-wide': 2,
                   'unstable': 3, 'not-perceivable': 4, 'aborted': 5 };
  const STAGES = ['converged', 'converged-fair', 'converged-wide', 'unstable',
                  'not-perceivable', 'aborted'];
  let stage = STAGES[Math.max(RANK[upSt] || 0, RANK[downSt] || 0)];
  if (mu != null && md != null && Math.abs(mu - md) > 25 && RANK[stage] < 2) {
    stage = 'converged-wide';
  }
  return { match: match, residual: residual, status: stage,
           matchUp: mu, matchDown: md,
           residualUp: ru, residualDown: rd,
           trackDiff: trackDiff,
           statusUp: upSt, statusDown: downSt };
}
```

## Schritt 3 — `_fmAggregateRunsForElectrode` umbauen

In `js/freqmatch.js` die Funktion `_fmAggregateRunsForElectrode`
(ab Z. 849) ersetzen. Sie liefert jetzt zusätzlich die fünf
neuen Aggregate `convUpMean`, `convDownMean`, `trackDiffMean`,
`runSpread`, `residuum`. Die alten Felder `cent`, `meanResidual`,
`combinedUncertainty`, `runsCount`, `status` bleiben für
Übergangs-Aufrufer (Schritt 4 macht sie überflüssig).

**Skeleton:**

```js
// Aggregiert pro-Elektrode-Matches über alle Läufe einer Seite.
// In jedem Lauf werden zuerst die zwei Tracks (up + down) kombiniert.
// Gibt aggregierte Werte zurück inkl. neuer Konvergenz-/Track-Diff.-
// Größen (BA 99).
function _fmAggregateRunsForElectrode(side, electrodeIdx) {
  const fa = (sideData[side] && sideData[side].freqmatchAdaptive) || null;
  const empty = {
    cent: null, meanResidual: null, combinedUncertainty: 0, runsCount: 0, status: null,
    convUpMean: null, convDownMean: null,
    trackDiffMean: null, runSpread: 0, residuum: null,
    statusUpRuns: [], statusDownRuns: []
  };
  if (!fa || !Array.isArray(fa.runs)) return empty;

  const matches   = [];      // pro Lauf: combo.match (Mittel beider Tracks)
  const residuals = [];      // pro Lauf: combo.residual
  const ups       = [];      // pro Lauf: combo.residualUp (für convUpMean)
  const downs     = [];      // pro Lauf: combo.residualDown
  const diffs     = [];      // pro Lauf: combo.trackDiff
  const statusesUp   = [];   // pro Lauf: combo.statusUp
  const statusesDown = [];   // pro Lauf: combo.statusDown
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
    if (combo.residualUp   != null) ups.push(combo.residualUp);
    if (combo.residualDown != null) downs.push(combo.residualDown);
    if (combo.trackDiff    != null) diffs.push(combo.trackDiff);
    statusesUp.push(combo.statusUp);
    statusesDown.push(combo.statusDown);
    if (combo.status &&
        (worstStatus == null || (RANK[combo.status] || 0) > (RANK[worstStatus] || 0))) {
      worstStatus = combo.status;
    }
  });

  function meanOf(arr) {
    if (!arr.length) return null;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  const meanRes      = meanOf(residuals);
  const convUpMean   = meanOf(ups);
  const convDownMean = meanOf(downs);
  const trackDiffMean = meanOf(diffs);

  // cent aus matches (Median ab 3 Läufen, sonst Mittel/Direkt)
  let cent = null;
  if (matches.length === 1) {
    cent = matches[0];
  } else if (matches.length === 2) {
    cent = (matches[0] + matches[1]) / 2;
  } else if (matches.length >= 3) {
    const sorted = matches.slice().sort(function(a, b) { return a - b; });
    const mid = sorted.length >> 1;
    cent = (sorted.length & 1) ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const runSpread = (matches.length >= 2)
    ? Math.max.apply(null, matches) - Math.min.apply(null, matches)
    : 0;

  // Konvergenz σ_konv = Mittel beider Track-Residuum-Mittel
  let sigmaKonv = null;
  if (convUpMean != null && convDownMean != null) {
    sigmaKonv = (convUpMean + convDownMean) / 2;
  } else if (convUpMean != null) {
    sigmaKonv = convUpMean;
  } else if (convDownMean != null) {
    sigmaKonv = convDownMean;
  }

  // Residuum (Gesamtunsicherheit) — quadratisch kombiniert.
  // Anmerkung: additive Kombination wäre konservativer und ist ebenfalls vertretbar
  // (siehe Spec). Hier quadratisch (übliche Annahme für unabhängige Fehlerquellen).
  let residuum = null;
  if (sigmaKonv != null) {
    const sK2 = sigmaKonv * sigmaKonv;
    const sT2 = (trackDiffMean != null) ? (trackDiffMean / 2) * (trackDiffMean / 2) : 0;
    const sR2 = (runSpread / 2) * (runSpread / 2);
    residuum = Math.sqrt(sK2 + sT2 + sR2);
  }

  // Altes Feld combinedUncertainty bleibt befüllt (= residuum), damit Übergangs-Aufrufer nicht brechen.
  const combinedUncertainty = (residuum != null) ? residuum : 0;

  return {
    cent:                cent,
    meanResidual:        meanRes,
    combinedUncertainty: combinedUncertainty,
    runsCount:           matches.length,
    status:              worstStatus || null,
    convUpMean:          convUpMean,
    convDownMean:        convDownMean,
    trackDiffMean:       trackDiffMean,
    runSpread:           runSpread,
    residuum:            residuum,
    statusUpRuns:        statusesUp,
    statusDownRuns:      statusesDown
  };
}
```

## Schritt 4 — Neue Felder in `fRes`-Einträge schreiben

In `js/freqmatch.js` die Funktionen `_fmWriteResult` (ab Z. 946)
und `_fmRemoveResult` (ab Z. 911) so anpassen, daß sie die neuen
Felder in den `fRes`-Eintrag schreiben. Die alten Felder
`fmResidual` und `fmCombinedUncertainty` werden weiterhin gefüllt
(als Übergangs-Brücke für Code-Pfade, die in BA 99 noch nicht
umgestellt werden — konkret die Provisorisch-Einträge in
`results.js`); die Tabelle in `results.js` liest aber ab BA 99
die neuen Felder.

In **`_fmWriteResult`** (Z. 958–968) das `entry`-Objekt erweitern.
Vorher:
```js
  const entry = {
    varSide:               fmVarSide,
    refSide:               fmRefSide,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
    fmStatus:              agg.status || track.status,
    fmResidual:            agg.meanResidual,
    fmCombinedUncertainty: agg.combinedUncertainty,
    fmDelta:               null
  };
```

Nachher:
```js
  const entry = {
    varSide:               fmVarSide,
    refSide:               fmRefSide,
    elIdx:                 elIdx,
    varFreq:               varHz,
    refFreq:               refHz,
    timestamp:             Date.now(),
    fmStatus:              agg.status || track.status,
    fmResidual:            agg.meanResidual,
    fmCombinedUncertainty: agg.combinedUncertainty,
    fmDelta:               null,
    // BA 99
    fmConvUp:              agg.convUpMean,
    fmConvDown:            agg.convDownMean,
    fmTrackDiff:           agg.trackDiffMean,
    fmRunSpread:           agg.runSpread,
    fmResiduum:            agg.residuum,
    fmRunsCount:           agg.runsCount,
    fmStatusUpLast:        (agg.statusUpRuns.length   ? agg.statusUpRuns[agg.statusUpRuns.length - 1]     : null),
    fmStatusDownLast:      (agg.statusDownRuns.length ? agg.statusDownRuns[agg.statusDownRuns.length - 1] : null)
  };
```

In **`_fmRemoveResult`** (Z. 921–932) analog: das `entry`-Objekt
um dieselben Felder erweitern (für den Fall, daß andere Läufe
trotz `not-perceivable` ein Ergebnis liefern).

## Schritt 5 — Chart-Band auf `fmResiduum` umstellen

In `js/chart.js` die Stellen, die `fmResidual` für die
Cent-Unsicherheits-Band-Höhe nutzen, auf das neue Feld
`fmResiduum` umstellen. Das macht semantisch mehr Sinn: das Band
zeigt dann die Gesamtunsicherheit (inklusive Track-Differenz),
nicht nur die Konvergenz.

Fallback: wenn `el.fmResiduum` `null`/`undefined` ist (Alt-Daten),
auf `el.fmResidual` zurückfallen, damit gespeicherte Sitzungen
weiter darstellbar bleiben.

**Z. 385:**
```js
      fmResidual: r ? (r.fmResidual || 0)           : null,
```
ersetzen durch:
```js
      fmResidual: r ? (r.fmResiduum != null ? r.fmResiduum : (r.fmResidual || 0)) : null,
```

(Feldname im Chart-Objekt bleibt `fmResidual` — das ist
chart-intern und wird nicht von außen referenziert.)

Die übrigen Stellen in `chart.js` (Z. 521–526, 555–556, 897)
lesen `el.fmResidual` direkt — die brauchen nicht angepaßt zu
werden, weil sie das chart-interne Feld lesen, das wir oben schon
mit dem richtigen Wert befüllen.

## Schritt 6 — Provisorisch-Einträge in `results.js` ergänzen

In `js/results.js` die Funktion `_fmrBuildInProgressEntries`
(ab ca. Z. 290) ergänzt die provisorischen Einträge um die neuen
Felder, sodaß die Tabelle in Schritt 7 sauber rendert.

Die zwei `out.push(…)`-Aufrufe (Z. 315–326 und Z. 328–340)
bekommen je die zusätzlichen Felder:

```js
        fmConvUp:     null,
        fmConvDown:   null,
        fmTrackDiff:  null,
        fmRunSpread:  null,
        fmResiduum:   null,
        fmRunsCount:  0,
        fmStatusUpLast:   null,
        fmStatusDownLast: null,
```

(Beide push-Aufrufe identisch ergänzen.)

## Schritt 7 — Tabellen-Header und -Zellen umbauen

In `js/results.js`:

a) **Header** (Z. 414–416). Die zwei Einträge
```js
    "<th title=\"" + t("fmrThResidualTip") + "\">" + t("fmrThResidual") + "</th>" +
    "<th title=\"" + t("fmrThCombinedTip") + "\">" + t("fmrThCombined") + "</th>" +
```
ersetzen durch:
```js
    "<th title=\"" + t("fmrThConvUdTip") + "\">" + t("fmrThConvUd") + "</th>" +
    "<th title=\"" + t("fmrThTrackDiffTip") + "\">" + t("fmrThTrackDiff") + "</th>" +
    "<th title=\"" + t("fmrThResiduumTip") + "\">" + t("fmrThResiduum") + "</th>" +
```

Die Tabelle hat damit eine Spalte mehr (3 statt 2 zwischen
Diff. Cent und Status).

b) **Zellen-Rendering** (Z. 507–531). Die alten Blöcke für
`residCell` und `combinedCell` ersetzen durch drei neue Blöcke
für `convUdCell`, `trackDiffCell`, `residuumCell`.

**Skeleton (an Stelle der alten Blöcke einsetzen):**

```js
      // BA 99: drei Spalten — Konvergenz u/d, Track-Differenz, Residuum
      const isNotPerc = (r.fmStatus === 'not-perceivable');
      const statusUpLast   = r.fmStatusUpLast   || null;
      const statusDownLast = r.fmStatusDownLast || null;

      function _fmCellRoh(v, statusLast) {
        if (statusLast === 'not-perceivable') return '<span style="color:#9ca3af">✗</span>';
        if (statusLast === 'aborted')         return '<span style="color:#9ca3af">—</span>';
        if (v == null)                        return '<span style="color:#9ca3af">—</span>';
        return '<span style="color:#374151">±' + Math.round(v) + '</span>';
      }

      let convUdCell;
      if (isProv || (statusUpLast == null && statusDownLast == null
                     && r.fmConvUp == null && r.fmConvDown == null)) {
        convUdCell = '<span style="color:#9ca3af">—</span>';
      } else {
        convUdCell = _fmCellRoh(r.fmConvUp, statusUpLast)
                   + ' / '
                   + _fmCellRoh(r.fmConvDown, statusDownLast);
      }

      let trackDiffCell;
      if (isProv || r.fmTrackDiff == null
          || statusUpLast === 'not-perceivable' || statusDownLast === 'not-perceivable'
          || statusUpLast === 'aborted'         || statusDownLast === 'aborted') {
        trackDiffCell = '<span style="color:#9ca3af">—</span>';
      } else {
        trackDiffCell = '<span style="color:#374151">' + Math.round(r.fmTrackDiff) + '</span>';
      }

      let residuumCell;
      if (isProv || r.fmResiduum == null || isNotPerc) {
        residuumCell = '<span style="color:#9ca3af">—</span>';
      } else {
        const re      = Math.round(r.fmResiduum);
        const reColor = re <= 10 ? '#16a34a'
                      : re <= 25 ? '#d97706'
                      :            '#dc2626';
        const tipParts = [];
        if (r.fmConvUp != null || r.fmConvDown != null) {
          const ku = r.fmConvUp   != null ? Math.round(r.fmConvUp)   : '?';
          const kd = r.fmConvDown != null ? Math.round(r.fmConvDown) : '?';
          tipParts.push('Konvergenz ±' + ku + ' / ±' + kd + ' ct');
        }
        if (r.fmTrackDiff != null) {
          tipParts.push('Track-Differenz ' + Math.round(r.fmTrackDiff) + ' ct');
        }
        if (r.fmRunSpread != null) {
          tipParts.push('Run-Spannweite ' + Math.round(r.fmRunSpread) + ' ct');
        }
        const runsLabel = (r.fmRunsCount === 1) ? '1 Lauf'
                        : (r.fmRunsCount != null && r.fmRunsCount > 1) ? r.fmRunsCount + ' Läufe'
                        : '';
        if (runsLabel) tipParts.push('(' + runsLabel + ')');
        const tipText = tipParts.join(' · ');
        residuumCell = '<span style="color:' + reColor + ';font-weight:600" title="'
                     + tipText + '">±' + re + ' ct</span>';
      }
```

Wo die alten `residCell`/`combinedCell` als HTML-Strings in die
Tabellen-Zeile eingebaut werden (suchen mit `grep -n "residCell\|combinedCell" js/results.js`),
durch die neuen drei Zellen ersetzen (in der Reihenfolge
`convUdCell` · `trackDiffCell` · `residuumCell`).

## Schritt 8 — Qualitätstext-Statistik anpassen

In `js/results.js` die zwei Statistiken (Z. 624–625, 639–640),
die heute `r.fmResidual` für mittlere Restunsicherheit lesen,
weiter so lassen — `meanResidual` bleibt als „mittlere Konvergenz
aller Tracks" eine sinnvolle Größe für den Qualitätstext. Keine
Änderung in Schritt 8 nötig; nur prüfen daß der Pfad noch klappt
(Feld `fmResidual` wird in Schritt 4 weiter mit `agg.meanResidual`
befüllt).

## Schritt 9 — i18n-Strings in `i18n/de.js`

In `i18n/de.js` die Keys `fmrThResidual`, `fmrThResidualTip`,
`fmrThCombined`, `fmrThCombinedTip` (Z. 643–648) ersetzen durch:

```js
    fmrThConvUd:        "Konvergenz u/d (ct)",
    fmrThConvUdTip:     "Halbe Spanne der letzten 6 Umkehrungen je Staircase, gemittelt über alle Läufe. Erste Zahl: Track startet bei +100 ct (von oben). Zweite Zahl: Track startet bei −100 ct (von unten). Niedrig = enge Konvergenz, hoch = unsichere Wahrnehmung.",
    fmrThTrackDiff:     "Track-Differenz (ct)",
    fmrThTrackDiffTip:  "Abstand zwischen den Match-Punkten der beiden Staircases (oben minus unten, gemittelt über alle Läufe). Großer Wert = die beiden Tracks landen weit auseinander — Hinweis auf breite oder uneindeutige Pitch-Wahrnehmung in diesem Frequenzbereich.",
    fmrThResiduum:      "Residuum (ct)",
    fmrThResiduumTip:   "Gesamtmessunsicherheit, quadratisch kombiniert aus Konvergenz, Track-Differenz und Streuung über Läufe. Ampel: ≤10 ct grün, 11–25 ct gelb, >25 ct rot.",
```

Außerdem die Statusbadge-Strings prüfen — `fmrStatusFair: "Streuung"` und
`fmrStatusWide: "starke Streuung"` (Z. 651–652) sind weiterhin
korrekt, nichts ändern.

`fmrThDelta` und `fmrThDeltaTip` (Z. 645–646) sind seit BA 95 nicht mehr
in Verwendung. Ungenutzte Keys auf Auffälligkeit prüfen mit
`grep -n "fmrThDelta\b" js/`, und wenn nirgends mehr referenziert,
**diese zwei Zeilen entfernen**. Wenn sie aber doch noch
irgendwo gelesen werden, **drin lassen** — kein blindes Löschen.

Die alten Tooltip-Keys `fmrThResidualTip`, `fmrThCombinedTip`,
`fmrThResidual`, `fmrThCombined` werden ersatzlos entfernt.

## Schritt 10 — Spec aktualisieren

In `docs/spec/02b-freqmatch-adaptiv.md`:

a) Den Abschnitt **„Ergebnis-Tabelle (Status-Spalte)"** (ab
Z. 145) lassen; nur die Aufzählung der zusätzlichen Spalten und
Anzeige-Regeln ergänzen.

b) Den Abschnitt **„Anzeige im Reiter Meßergebnisse →
Frequenzabgleich"** (ab Z. 164) ab dem Satz „Die Tabelle enthält
10 Spalten…" durch folgenden Block ersetzen:

```
Die Tabelle enthält 11 Spalten. Zwischen „Diff. (Cent)" und „Status"
liegen drei Qualitätsspalten:

**Konvergenz u/d (Cent)** — mittlere halbe Umkehr-Spanne der beiden
Staircases pro Elektrode, getrennt für Track-up (Start +100 ct) und
Track-down (Start −100 ct). Anzeige im Format `±N / ±M`. Farb-
neutral, ohne Ampelung — eine Roh-Größe für den Nutzer.
Bei einem Track `not-perceivable`: `✗` an dessen Stelle. Bei
`aborted`: `—`.

**Track-Differenz (Cent)** — gemittelte `|Match_up − Match_down|`
über alle Läufe einer Elektrode. Großer Wert = die beiden
Staircases konvergieren weit auseinander, Hinweis auf breite
oder mehrdeutige Pitch-Wahrnehmung. Farb-neutral. Bei einem
Track `not-perceivable`/`aborted`: `—`.

**Residuum (Cent)** — Gesamtmessunsicherheit, quadratisch
kombiniert:
```
σ_konv      = (residual_up_mean + residual_down_mean) / 2
σ_trackHalf = trackDiff_mean / 2
σ_runHalf   = runSpread / 2

residuum = sqrt(σ_konv² + σ_trackHalf² + σ_runHalf²)
```
Bei einem Lauf ist `runSpread = 0`, der Wert besteht nur aus
Konvergenz und halbe Track-Differenz. Ampelfarbe:
≤10 ct grün, 11–25 ct gelb-orange, >25 ct rot. Tooltip zeigt
Aufschlüsselung: Konvergenz u/d · Track-Differenz · Run-Spannweite
(N Lauf/Läufe).

Hinweis: Die quadratische Kombination ist die übliche Annahme
für unabhängige Fehlerquellen. Eine **additive** Kombination
(`σ_konv + σ_trackHalf + σ_runHalf`) wäre konservativer
(pessimistischer) und ist ebenfalls vertretbar — der Wechsel
würde sich auf eine einzelne Code-Stelle in
`_fmAggregateRunsForElectrode` beschränken.
```

c) Im Abschnitt **„Storage"** das `fRes`-Schema um die neuen
Felder erweitern:

```
fRes[electrodeIdx]:
  {
    cent, status, runsCount, timestamp,
    varSide, refSide, varFreq, refFreq,
    // Konvergenz-Detail (BA 99)
    fmConvUp, fmConvDown,    // mittlere halbe Umkehr-Spannen je Track
    fmTrackDiff,             // mittlere |Match_up − Match_down|
    fmRunSpread,             // max−min der pro-Lauf-Match-Mittelwerte
    fmResiduum,              // Gesamtmessunsicherheit (quadr.)
    fmStatusUpLast, fmStatusDownLast,  // Status des letzten Track-Laufs je Direction
    // Übergangsfelder (für Chart, Druck, Altdaten-Kompat)
    fmResidual,              // = meanResidual (Konvergenz-Mittel)
    fmCombinedUncertainty,   // = fmResiduum (Brücke für Chart)
    fmDelta:    null          // ungenutzt seit BA 93
  }
```

d) Im Abschnitt **„Aufteilung der Bauanleitungen"** am Ende den
Punkt zu BA 99 ergänzen:

```
- **BA 99** — Drei Ergebnis-Spalten (Konvergenz u/d, Track-Differenz,
  Residuum) statt zwei. Tooltip mit Run-Spannweite. Chart-Band liest
  künftig fmResiduum statt fmResidual.
```

## Akzeptanztest

Nach Hard-Reload im Browser ausführen.

1. Tab „Meßergebnisse" → Sub-Tab „Frequenzabgleich". **Erwartet:**
   wenn schon Daten vorhanden sind, zeigt die Tabelle jetzt **drei**
   Spalten zwischen „Diff. (Cent)" und „Status": Konvergenz u/d,
   Track-Differenz, Residuum.
2. Maus über die Konvergenz-u/d-Spaltenüberschrift bewegen.
   **Erwartet:** Tooltip mit Erklärung der zwei Tracks erscheint.
3. Maus über die Residuum-Spaltenüberschrift. **Erwartet:**
   Tooltip mit Ampel-Schwellen erscheint.
4. Maus über eine konkrete Residuum-Zelle (mit Wert). **Erwartet:**
   Tooltip zeigt Aufschlüsselung: „Konvergenz ±N / ±M ct · Track-
   Differenz N ct · Run-Spannweite N ct · (X Lauf/Läufe)".
5. Ampelfarbe auf Residuum-Spalte prüfen:
   - Zellen mit ≤10 ct sind grün.
   - Zellen mit 11–25 ct sind gelb-orange.
   - Zellen mit >25 ct sind rot.
6. Für eine Elektrode mit großer Track-Differenz (z.B. > 100 ct
   in einem realen Test) prüfen: Konvergenz u/d zeigt zwei kleine
   Werte (z.B. `±22 / ±19`), Track-Differenz zeigt den großen
   Wert, Residuum zeigt einen entsprechend großen Wert mit roter
   Ampel.
7. Falls eine Elektrode als `not-perceivable` markiert ist:
   alle drei Spalten zeigen `—` mit grauer Farbe.
8. Im Sub-Tab Frequenzabgleich-Chart prüfen: das Unsicherheits-
   Band (gefärbter Balken) für eine Elektrode mit großer Track-
   Differenz ist jetzt deutlich breiter als vorher (es liest
   `fmResiduum`).
9. Browser-Konsole prüfen. **Erwartet:** keine `TypeError` zu
   `fmConvUp`, `fmConvDown`, `fmTrackDiff`, `fmResiduum`,
   `fmRunSpread`, `fmStatusUpLast`, `fmStatusDownLast` oder zu
   den entfernten i18n-Keys.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Position einzeln
durchgehen und mit Datei + Zeile melden: erfüllt / nicht erfüllt /
unklar.

Außerdem vor dem Versand:

- `grep -n "fmrThResidual\b\|fmrThCombined\b\|fmrThResidualTip\|fmrThCombinedTip" js/ i18n/`
  darf nur die Definition in Schritt 9 als „entfernt" zeigen
  (also leer in `js/`).
- `grep -n "fmResidual\b" js/freqmatch.js js/results.js` muß nur
  noch dort vorkommen, wo das Übergangsfeld weiter geschrieben/gelesen
  wird (Schritt 4: `_fmWriteResult`/`_fmRemoveResult`,
  Schritt 8-Hinweis: Qualitätstext-Statistik). Keine
  Tabellen-Rendering-Stelle mehr.
- `grep -n "fmResiduum\b" js/` muß die neuen Stellen zeigen
  (Aggregation, Schreiben, Tabelle, Chart-Brücke).
- `js/version.js` enthält `APP_VERSION = "3.0.99-beta"`.
- Den User darauf hinweisen, daß **alte gespeicherte Sitzungen
  (vor BA 99)** beim Laden nicht durch die neuen Felder ergänzt
  werden — `fmConvUp` etc. sind dann `undefined`. Die Tabelle
  zeigt für diese Alt-Einträge `—` in den drei neuen Spalten.
  Wer aktuelle Werte will, muß den Test neu laufen lassen (ein
  einziger neuer Lauf reicht).

## Folge-Anleitung

i18n en/fr/es: separate Mini-Anleitung. Die neuen Keys
(`fmrThConvUd`, `fmrThConvUdTip`, `fmrThTrackDiff`,
`fmrThTrackDiffTip`, `fmrThResiduum`, `fmrThResiduumTip`) und
der angepaßte `fmAntiOverwriteMsg` aus BA 98 sind zu übersetzen.
