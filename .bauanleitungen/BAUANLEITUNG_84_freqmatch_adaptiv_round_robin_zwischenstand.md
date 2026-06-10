# Bauanleitung 84 — Frequenzabgleich adaptiv: Round-Robin, Zwischenstand-Anzeige, realistischer Fortschritt

Diese Anleitung ist die Folge-Bauanleitung zu 73–79 (adaptiver Modus
Grundausstattung) und behebt drei vom User benannte Schwächen:

1. **Reiter Meßergebnisse → Frequenzabgleich** zeigt bei unvollständigem
   Lauf keine Zwischenergebnisse. Heute schreibt `_fmWriteResult` nur
   bei Endzustand in `fRes`.
2. **Trial-Verteilung** ist uniform-zufällig — bei wenigen Trials sind
   einige Elektroden noch ungemessen, andere mehrfach. Round-Robin
   (geshuffelt) verteilt gleichmäßig und bleibt unvorhersagbar.
3. **Fortschrittsbalken** im laufenden Test klebt lange bei 0 %, weil
   er nur abgeschlossene Tracks zählt.

Eine Zweiteilung „vollständig" / „Konvergenz" ist explizit noch nicht
Teil dieser Bauanleitung. Test-Ende bleibt: alle Tracks in einem
Endzustand.

---

## Version

Erster Schritt: in `js/version.js` setzen:

```js
const APP_VERSION = "3.0.84-beta";
```

---

## Übersicht der Änderungen

| Datei | Was passiert |
|---|---|
| `js/freqmatch-staircase.js` | `fmPickNextTrack` auf geshuffelten Round-Robin umstellen. Persistierbarer `roundQueue`-State. |
| `js/freqmatch.js` | `fmTracks` um `roundQueue` erweitern, Persistenz mitführen. `fmUpdateAdaptiveProgress` mit realistischer Formel. |
| `js/results.js` | `renderFreqMatchResults` erweitert: Zwischenstände aus aktiven Tracks, neue Status-Spalte „Restunsicherheit", Qualitätstext analog Lautstärke, Fortschrittsbalken oben. |
| `js/chart.js` | `drawFreqMatchChart` zeichnet zwei neue Status: `in-progress` (hohler Kreis, optional Restunsicherheits-Band) und `in-progress-early` (hohler Kreis mit „?"). |
| `index.html` | Im Reiter Meßergebnisse → Frequenzabgleich: Fortschrittsbalken-Container, Qualitätstext-Element. |
| `i18n/de.js` | Neue Strings — siehe Block unten. |
| `js/debug-tests-current.js` | Drei Bau-Diagnose-Tests (BA84) — Round-Robin-Verteilung, konvergente-Tracks-fallen-raus, Fortschritts-Formel. Nach Abnahme entweder gelöscht oder ins Archiv. |
| `docs/spec/02b-freqmatch-adaptiv.md` | Round-Robin in „Verfahren im Überblick", Zwischenstand-Abschnitt, Fortschritts-Definition. |
| `docs/CODESTRUKTUR.md` | Nur falls neue zentrale Funktion → Vermerk im Frequenzabgleich-Abschnitt. |

---

## Schritt 1 — Round-Robin in `fmPickNextTrack`

**Datei:** `js/freqmatch-staircase.js`

Die bestehende Funktion (Z. 60–68) komplett ersetzen durch:

```js
// --- Trial-Reihenfolge: geshuffelter Round-Robin ---
//
// state.roundQueue: aktuell laufende Runde (Restliste an Elektroden-IDs,
//                   die in dieser Runde noch drankommen).
// state.tracks:     wie bisher { [electrodeIdx]: trackState }
// rng:              optionale Random-Funktion (default Math.random)
//
// Ablauf: solange `roundQueue` Einträge hat, wird der erste
// genommen (FIFO). Beim Übergang einer neuen Runde wird die
// Liste aller aktiven Track-IDs gezogen und in zufälliger
// Reihenfolge in `roundQueue` geschrieben. Tracks, die innerhalb
// der laufenden Runde konvergieren, werden beim Pop übersprungen.
//
// returns: electrodeIdx (Number) oder null wenn alle abgeschlossen
function fmPickNextTrack(state, rng) {
  // Rückwärtskompatibilität: alter Aufruf mit tracks-Objekt direkt
  // statt Wrapper-State. In dem Fall wird ein flüchtiger Wrapper
  // benutzt; State des Aufrufers geht verloren. Sollte nicht mehr
  // benutzt werden — Warnung in dev nicht hier, sondern beim Aufrufer.
  if (state && state.electrodeIdx === undefined && state.tracks === undefined) {
    // Aufrufer hat tracks-Objekt direkt übergeben (alte API).
    state = { tracks: state, roundQueue: [] };
  }

  const r = rng || Math.random;
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

**Wichtig:** die Funktionssignatur ändert sich von `(tracks, rng)` auf
`(state, rng)`. Der Rückwärtskompatibilitäts-Zweig im Funktionskopf fängt
versehentliche Alt-Aufrufe ab und verhindert Crash, aber die persistierte
Runde geht dann verloren — alle echten Aufrufer müssen umgestellt werden.

---

## Schritt 2 — Aufrufer und Persistenz für `roundQueue`

**Datei:** `js/freqmatch.js`

### 2a) Modul-Variable für die Round-Queue

Direkt neben `let fmTracks = {};` (Z. ~10–30, gleicher Block wie die
anderen `fm*`-State-Variablen) ergänzen:

```js
let fmRoundQueue = [];   // geshuffelter Round-Robin-State, Bauanleitung 84
```

### 2b) Aufruf von `fmPickNextTrack` umstellen

In `fmNextAdaptiveTrial` (Z. ~443) ersetzen:

```js
// alt:
fmCurTrackId = fmPickNextTrack(fmTracks);

// neu:
fmCurTrackId = fmPickNextTrack({ tracks: fmTracks, roundQueue: fmRoundQueue }, undefined);
```

`fmRoundQueue` wird durch den Aufruf in-place mutiert (shift / neue
Runde reinschreiben). Falls weitere Aufrufe von `fmPickNextTrack`
existieren (grep prüfen!), ebenso umstellen.

### 2c) Persistenz von `fmRoundQueue`

In `_fmPersist` (Z. ~331) ergänzen:

```js
sideData[fmVarSide].freqmatchAdaptive = {
  varSide:          fmVarSide,
  refSide:          fmRefSide,
  startedAt:        (sideData[fmVarSide].freqmatchAdaptive
                     && sideData[fmVarSide].freqmatchAdaptive.startedAt) || Date.now(),
  completedAt:      null,
  electrodeIdxList: ids.slice().sort(/* ... wie bisher ... */),
  tracks:           fmTracks,
  roundQueue:       fmRoundQueue.slice()    // NEU: Bauanleitung 84
};
```

In `_fmTryRestore` (Z. ~361) ergänzen, nach `fmTracks = fa.tracks;`:

```js
fmRoundQueue = Array.isArray(fa.roundQueue) ? fa.roundQueue.slice() : [];
```

In `fmStartAdaptive` beim Neuanlegen (Z. ~412, `else`-Zweig) ergänzen:

```js
fmTracks = {};
fmRoundQueue = [];                                 // NEU: Bauanleitung 84
elIdxList.forEach(function(idx) { /* ... */ });
_fmPersist();
```

In `_fmClearPersist` und `fmFinishAdaptive` — `fmRoundQueue` ebenfalls
auf `[]` zurücksetzen (Symmetrie, keine Reste in der Modul-Variable):

```js
// fmFinishAdaptive, am Ende des Aufräum-Blocks:
fmRoundQueue = [];
```

---

## Schritt 3 — Realistischer Fortschrittsbalken im Test-Panel

**Datei:** `js/freqmatch.js`

Die Funktion `fmUpdateAdaptiveProgress` (Z. ~740) komplett ersetzen:

```js
function fmUpdateAdaptiveProgress() {
  if (!fmEls || !fmEls.progressText || !fmEls.progressFill) return;
  const ids  = Object.keys(fmTracks);
  if (ids.length === 0) {
    fmEls.progressText.textContent = '0 / 0';
    fmEls.progressFill.style.width = '0%';
    return;
  }
  const stats = fmComputeProgressStats(fmTracks);
  fmEls.progressText.textContent =
    stats.done + ' / ' + stats.total +
    ' (' + stats.totalTrials + ' trials, ' + Math.round(stats.percent) + ' %)';
  fmEls.progressFill.style.width = stats.percent + '%';
}

// Wiederverwendbare Fortschritts-Statistik. Auch genutzt von
// renderFreqMatchResults für den Ergebnis-Reiter-Balken.
//
// Pro Track:
//   - Endzustand    → Beitrag 1.0
//   - aktiv         → Beitrag min(reversals.length / FM_REVERSALS_REQ, 0.95)
//                     (max. 0.95, damit aktive Tracks nie wie konvergiert wirken)
// Fortschritt = Summe / Tracks * 100 [Prozent]
function fmComputeProgressStats(tracks) {
  const ids = Object.keys(tracks);
  const total = ids.length;
  let done = 0, totalTrials = 0, contrib = 0;
  ids.forEach(function(k) {
    const tr = tracks[k];
    totalTrials += tr.trialCount || 0;
    if (tr.status !== 'active') {
      done++;
      contrib += 1.0;
    } else {
      const rev = (tr.reversals && tr.reversals.length) || 0;
      contrib += Math.min(rev / FM_REVERSALS_REQ, 0.95);
    }
  });
  return {
    total:       total,
    done:        done,
    totalTrials: totalTrials,
    percent:     total > 0 ? (contrib / total) * 100 : 0
  };
}
```

`FM_REVERSALS_REQ` kommt aus `freqmatch-staircase.js` (= 6) und ist als
globale Konstante verfügbar, weil die Datei vor `freqmatch.js` geladen
wird (in `index.html` prüfen — ist so).

---

## Schritt 4 — `index.html`: zusätzliche Elemente im Ergebnis-Reiter

**Datei:** `index.html`

Im Bereich des Frequenzabgleich-Ergebnis-Reiters (suche nach
`id="fmrCard"` oder `fmrTitle`), oberhalb der Tabelle einen
Fortschrittsbalken und einen Qualitätstext einbauen. Direkt nach dem
`fmrMeta`-Element:

```html
<div id="fmrProgressBox" style="display:none;margin:10px 0;">
  <div style="display:flex;justify-content:space-between;font-size:.85em;color:#555;margin-bottom:4px;">
    <span data-t="fmrProgressLabel">Fortschritt laufende Messung</span>
    <span id="fmrProgressText">—</span>
  </div>
  <div style="background:#e5e7eb;border-radius:4px;height:8px;overflow:hidden;">
    <div id="fmrProgressFill" style="background:#3b82f6;height:100%;width:0%;transition:width .3s ease;"></div>
  </div>
</div>

<div id="fmrQualityText" data-t="" style="margin:10px 0;padding:8px 10px;background:#f9fafb;border-left:3px solid #cbd5e1;font-size:.9em;color:#374151;border-radius:0 4px 4px 0;"></div>
```

Hinweis: `data-t=""` bleibt leer, der Text wird in JS gesetzt.

---

## Schritt 5 — `renderFreqMatchResults` erweitern

**Datei:** `js/results.js`

Der Block der Funktion (Z. 243–386) wird umgebaut. Kern-Änderungen:

### 5a) Hilfsfunktion: Zwischenstand-Einträge bauen

Direkt vor `function renderFreqMatchResults()` einfügen:

```js
// Liefert Pseudo-fRes-Einträge für aktive Tracks (Bauanleitung 84).
// Wird nicht in das globale fRes geschrieben — nur temporär für Anzeige.
//
// Status-Konvention:
//   'in-progress'        : ≥4 Umkehrungen, Match aus Mittelwert,
//                          Residuum aus halber Spanne der bisherigen Umkehrungen
//   'in-progress-early'  : <4 Umkehrungen, kein Match, refFreq = varFreq (Platzhalter)
const FMR_PROVISIONAL_REV_MIN = 4;

function _fmrBuildInProgressEntries(side) {
  const out = [];
  const sd = sideData[side];
  if (!sd) return out;
  const fa = sd.freqmatchAdaptive;
  if (!fa || !fa.tracks) return out;
  const refSide = fa.refSide || (side === 'left' ? 'right' : 'left');

  Object.keys(fa.tracks).forEach(function(k) {
    const tr = fa.tracks[k];
    if (tr.status !== 'active') return;
    const elIdx = parseInt(k, 10);
    const varHz = withSide(side, function() { return effFreq(elIdx); });
    const revCount = (tr.reversals && tr.reversals.length) || 0;

    if (revCount >= FMR_PROVISIONAL_REV_MIN) {
      // Mittel aller bisherigen Umkehrungen als vorläufiger Match
      let sum = 0;
      for (let i = 0; i < tr.reversals.length; i++) sum += tr.reversals[i];
      const match = sum / tr.reversals.length;
      // Residuum: halbe Spanne der bisherigen Umkehrungen (alle, nicht nur letzte 6)
      let max = -Infinity, min = Infinity;
      for (let i = 0; i < tr.reversals.length; i++) {
        if (tr.reversals[i] > max) max = tr.reversals[i];
        if (tr.reversals[i] < min) min = tr.reversals[i];
      }
      const residual = (max - min) / 2;
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz * Math.pow(2, match / 1200),
        timestamp: Date.now(),
        fmStatus: 'in-progress',
        fmResidual: residual,
        fmTrialCount: tr.trialCount || 0,
        fmReversals: revCount,
        _provisional: true
      });
    } else {
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz,                    // Platzhalter (=keine Auslenkung)
        timestamp: Date.now(),
        fmStatus: 'in-progress-early',
        fmResidual: null,
        fmTrialCount: tr.trialCount || 0,
        fmReversals: revCount,
        _provisional: true
      });
    }
  });
  return out;
}
```

### 5b) `renderFreqMatchResults` umbauen

Ersetze den Header-Block (ab `if (typeof fRes === "undefined" || fRes.length === 0)`)
durch:

```js
  // CI-Seite bestimmen — entweder aus letztem fRes-Eintrag, sonst aus state
  const ciSide = (fRes.length > 0)
    ? fRes[fRes.length - 1].varSide
    : (sideData.left.config === 'ci' ? 'left' : 'right');

  // Aktive Tracks → Zwischenstand-Einträge
  const provisional = _fmrBuildInProgressEntries(ciSide);

  // Wenn weder fertige noch laufende Daten: Leer-Zustand
  if (fRes.length === 0 && provisional.length === 0) {
    noData.style.display = "";
    card.style.display = "none";
    return;
  }
  noData.style.display = "none";
  card.style.display = "";

  // Vereinigte Anzeige-Daten (fRes hat Vorrang, dann provisorisch)
  const displayData = fRes.slice();
  const haveFinal = {};
  for (const r of fRes) {
    if (r.varSide === ciSide) haveFinal[r.elIdx] = true;
  }
  for (const p of provisional) {
    if (!haveFinal[p.elIdx]) displayData.push(p);
  }
```

Dann im weiteren Verlauf:
- Den `byIdx`-Aufbau auf `displayData` umstellen (nicht mehr auf `fRes`).
- Das `last`-Objekt für die Meta-Zeile vorsichtig: bei leerem `fRes` gibt
  es keinen sinnvollen Timestamp. Lösung:

```js
const metaEl = document.getElementById("fmrMeta");
if (metaEl) {
  const finalCount = fRes.length;
  const provCount  = provisional.length;
  let metaText = '';
  if (finalCount > 0) {
    const last = fRes[fRes.length - 1];
    const d = new Date(last.timestamp);
    const dateStr = d.toLocaleString(/* wie bisher */);
    const refLabel = last.refSide === "left" ? t("sideLeft") : t("sideRight");
    metaText = dateStr + " · " + finalCount + " Messpunkte · Ref: " + refLabel;
  }
  if (provCount > 0) {
    metaText += (metaText ? ' · ' : '') + t('fmrProvisionalCount').replace('{n}', provCount);
  }
  metaEl.textContent = metaText;
}
```

### 5c) Tabellen-Header um „Restunsicherheit" ergänzen

```js
th.innerHTML =
  "<th>" + t("fmrThEl") + "</th>" +
  "<th>" + t("fmrThVarSide") + "</th>" +
  "<th>" + t("fmrThVarHz") + "</th>" +
  "<th>" + t("fmrThRefSide") + "</th>" +
  "<th>" + t("fmrThRefHz") + "</th>" +
  "<th>" + t("fmrThDiffHz") + "</th>" +
  "<th>" + t("fmrThDiffCent") + "</th>" +
  "<th title=\"" + t("fmrThResidualTip") + "\">" + t("fmrThResidual") + "</th>" +
  "<th>" + t("fmrThStatus") + "</th>";
```

### 5d) Tabellen-Body: drei neue Fälle

In der `for (let i = 0; i < nCi; i++)`-Schleife der Zweig `else { /* gemessen */ }`
muß `r.fmStatus` auf die zwei neuen Werte zusätzlich behandeln. Volle
neue Zelldarstellung:

```js
} else {
  const isProvEarly = (r.fmStatus === 'in-progress-early');
  const isProvLate  = (r.fmStatus === 'in-progress');
  const isProv      = isProvEarly || isProvLate;

  // Zahlen
  let varHzCell, refHzCell, diffHzCell, diffCtCell, residCell;
  if (isProvEarly) {
    // <4 Umkehrungen: keine Zahlen
    varHzCell  = r.varFreq.toFixed(2);
    refHzCell  = "<span style=\"color:#9ca3af\">—</span>";
    diffHzCell = "<span style=\"color:#9ca3af\">—</span>";
    diffCtCell = "<span style=\"color:#9ca3af\">—</span>";
    residCell  = "<span style=\"color:#9ca3af\">—</span>";
  } else {
    const diffHzRaw = r.refFreq - r.varFreq;
    const cent      = 1200 * Math.log2(r.refFreq / r.varFreq);
    const centRound = Math.round(cent);
    const diffColor = isProv ? "#6b7280"
                    : Math.abs(diffHzRaw) < 20 ? "#666"
                    : diffHzRaw > 0 ? "#2563eb" : "#dc2626";
    varHzCell  = r.varFreq.toFixed(2);
    refHzCell  = r.refFreq.toFixed(2);
    diffHzCell = "<span style=\"color:" + diffColor + "\">"
               + (diffHzRaw >= 0 ? "+" : "") + diffHzRaw.toFixed(2) + "</span>";
    diffCtCell = "<span style=\"color:" + diffColor + "\">"
               + (centRound >= 0 ? "+" : "") + centRound + "</span>";

    // Residuum-Zelle mit Ampelfarbe
    if (r.fmResidual == null) {
      residCell = "<span style=\"color:#9ca3af\">—</span>";
    } else {
      const res = Math.round(r.fmResidual);
      const resColor = res <= 10 ? "#16a34a"      // grün
                     : res <= 25 ? "#d97706"      // gelb/orange
                     :             "#dc2626";     // rot
      residCell = "<span style=\"color:" + resColor + ";font-weight:600\">±"
                + res + " ct</span>";
    }
  }

  // Status-Badge
  let statusBadge;
  if (isProvEarly) {
    statusBadge = '<span class="fm-badge fm-badge-prov" data-t="fmrStatusProvEarly">'
                + t('fmrStatusProvEarly').replace('{n}', r.fmTrialCount || 0)
                + '</span>';
  } else if (isProvLate) {
    statusBadge = '<span class="fm-badge fm-badge-prov" data-t="fmrStatusProvLate">'
                + t('fmrStatusProvLate').replace('{n}', r.fmReversals || 0)
                + '</span>';
  } else if (r.fmStatus === 'converged-noisy') {
    statusBadge = '<span class="fm-badge fm-badge-noisy" data-t="fmrStatusNoisy">'
                + t('fmrStatusNoisy') + '</span>';
  } else if (r.fmStatus === 'converged') {
    statusBadge = '<span class="fm-badge fm-badge-ok" data-t="fmrStatusOk">'
                + t('fmrStatusOk') + '</span>';
  } else {
    statusBadge = '<span class="muted">—</span>';
  }

  // Zeile mit ggf. gedämpfter Optik für Provisorische
  const rowStyle = isProv ? ' style="font-style:italic;color:#4b5563"' : '';
  tr.innerHTML =
    "<td style=\"font-weight:600\">" + elLabel + "</td>" +
    "<td>" + varLabel + "</td>" +
    "<td>" + varHzCell + "</td>" +
    "<td>" + refLabel + "</td>" +
    "<td>" + refHzCell + "</td>" +
    "<td>" + diffHzCell + "</td>" +
    "<td>" + diffCtCell + "</td>" +
    "<td>" + residCell + "</td>" +
    "<td>" + statusBadge + "</td>";
  if (isProv) tr.style.fontStyle = 'italic';
}
```

Außerdem die zwei anderen Zweige (`exCI` und `!r`) bekommen ebenfalls
eine zusätzliche `<td>—</td>` für die neue Residuum-Spalte, sonst
verrutscht die Tabelle. Stelle sicher, daß *jede* erzeugte Zeile
9 `<td>`s hat.

### 5e) CSS für `.fm-badge-prov`

Falls in `index.html` oder Style-Block: kleinen Stil ergänzen
(neben den bestehenden `.fm-badge-*`-Regeln):

```css
.fm-badge-prov {
  background: #e0f2fe;
  color: #0c4a6e;
  border: 1px solid #7dd3fc;
}
```

### 5f) Fortschrittsbalken im Reiter befüllen

Vor dem `drawFreqMatchChart`-Aufruf einbauen:

```js
// Fortschrittsbalken: nur sichtbar, wenn ein laufender adaptiver Track existiert
const fa = sideData[ciSide] && sideData[ciSide].freqmatchAdaptive;
const pBox  = document.getElementById('fmrProgressBox');
const pText = document.getElementById('fmrProgressText');
const pFill = document.getElementById('fmrProgressFill');
if (pBox) {
  const hasActive = fa && fa.tracks && Object.keys(fa.tracks)
    .some(function(k) { return fa.tracks[k].status === 'active'; });
  if (hasActive && typeof fmComputeProgressStats === 'function') {
    const stats = fmComputeProgressStats(fa.tracks);
    pBox.style.display = '';
    if (pText) pText.textContent =
      stats.done + ' / ' + stats.total + ' · ' + Math.round(stats.percent) + ' %';
    if (pFill) pFill.style.width = stats.percent + '%';
  } else {
    pBox.style.display = 'none';
  }
}
```

### 5g) Qualitätstext analog Elektrodenlautstärke

Ebenfalls vor `drawFreqMatchChart`:

```js
const qEl = document.getElementById('fmrQualityText');
if (qEl) {
  const finalEntries = fRes.filter(function(r) { return r.varSide === ciSide; });
  const provEntries  = provisional;   // schon nach ciSide gefiltert
  const totalActive  = sideData[ciSide].nEl
    - sideData[ciSide].elExDur.filter(function(v) { return v !== null; }).length
    - sideData[ciSide].elSt.filter(function(s) { return s === 'mute'; }).length;

  let txt = '';
  if (finalEntries.length === 0 && provEntries.length === 0) {
    txt = '';
  } else if (finalEntries.length === 0) {
    txt = t('fmrQualEarly').replace('{n}', provEntries.length).replace('{t}', totalActive);
  } else if (finalEntries.length < totalActive) {
    const resVals = finalEntries
      .filter(function(r) { return r.fmResidual != null; })
      .map(function(r) { return r.fmResidual; });
    const meanRes = resVals.length > 0
      ? resVals.reduce(function(s, v) { return s + v; }, 0) / resVals.length
      : 0;
    txt = t('fmrQualPartial')
      .replace('{done}', finalEntries.length)
      .replace('{total}', totalActive)
      .replace('{res}', meanRes.toFixed(1));
  } else {
    // alle fertig
    const noisy = finalEntries.filter(function(r) { return r.fmStatus === 'converged-noisy'; });
    const resVals = finalEntries
      .filter(function(r) { return r.fmResidual != null; })
      .map(function(r) { return r.fmResidual; });
    const meanRes = resVals.length > 0
      ? resVals.reduce(function(s, v) { return s + v; }, 0) / resVals.length
      : 0;
    if (noisy.length > 0) {
      const names = noisy.map(function(r) {
        return withSide(ciSide, function() { return dENPrefix() + dEN(r.elIdx); });
      }).join(', ');
      txt = t('fmrQualOkWithNoisy')
        .replace('{res}', meanRes.toFixed(1))
        .replace('{names}', names);
    } else {
      txt = t('fmrQualOk').replace('{res}', meanRes.toFixed(1));
    }
  }
  qEl.textContent = txt;
  qEl.style.display = txt ? '' : 'none';
}
```

### 5h) `drawFreqMatchChart` mit erweitertem Datensatz aufrufen

Den Aufruf am Ende von `renderFreqMatchResults`:

```js
// alt:
drawFreqMatchChart(cv, fRes, { notPerceivable: notPerc });

// neu:
drawFreqMatchChart(cv, displayData, { notPerceivable: notPerc });
```

`displayData` enthält jetzt zusätzlich die Zwischenstände mit
`fmStatus` `'in-progress'` / `'in-progress-early'`. Das Chart muß diese
Status erkennen — Schritt 6.

---

## Schritt 6 — `drawFreqMatchChart`: neue Status zeichnen

**Datei:** `js/chart.js`

Im Schleifenblock „Punkte und Marker" (ab ca. Z. 486) den `el.isMeasured`-
Zweig erweitern. Identifiziere innerhalb dieses Zweigs das `el.fmStatus`
und zeichne anders:

```js
if (el.isMeasured) {
  const xi = tX(el.cIst), yi = tY(0);
  // Ist-Punkt wie bisher
  ctx.beginPath();
  ctx.arc(xi, yi, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#6b7280";
  ctx.fill();

  if (el.fmStatus === 'in-progress-early') {
    // <4 Umkehrungen: hohler Kreis am Ist-Strich (Position cIst, y=0),
    // daneben ein "?" — keine Soll-Position, da Daten zu dünn
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth   = 1.5;
    ctx.fillStyle   = '#fff';
    ctx.beginPath();
    ctx.arc(xi, yi, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b82f6';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('?', xi + 8, yi + 4);
    hitboxes.push({ x: xi, y: yi, el: el });
    continue;
  }

  // Ab hier: in-progress (≥4 Umkehrungen, hat Soll-Punkt) oder
  // converged / converged-noisy wie bisher.
  const xs = tX(el.cSoll), ys = tY(el.dCent);

  // Restunsicherheits-Band (auch für in-progress, wenn Residuum vorliegt)
  const showBand = (el.fmStatus === 'converged-noisy' && el.fmResidual > 0)
                || (el.fmStatus === 'in-progress'     && el.fmResidual > 0);
  if (showBand) {
    const halfH = Math.abs(tY(0) - tY(el.fmResidual));
    ctx.fillStyle = (el.fmStatus === 'in-progress')
      ? 'rgba(59, 130, 246, 0.18)'    // bläulich für vorläufig
      : 'rgba(245, 158, 11, 0.25)';   // orange für noisy (bisher)
    ctx.fillRect(xs - 6, ys - halfH, 12, 2 * halfH);
  }

  // Hauptsymbol
  if (el.fmStatus === 'in-progress') {
    // hohler Kreis mit blauem Rand (vorläufig)
    ctx.beginPath();
    ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    // bisheriges Verhalten: voller schwarzer Kreis mit weißem Rand
    ctx.beginPath();
    ctx.arc(xs, ys, 5.5, 0, Math.PI * 2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  hitboxes.push({ x: xs, y: ys, el: el });
}
```

Die Verbindungslinie durch die Soll-Punkte (Z. ~472–483) sollte nur
durch *konvergierte* Punkte gehen, nicht durch vorläufige. Andernfalls
wackelt sie bei jedem Reload. Anpassung:

```js
const measSorted = allEls
  .filter(e => e.isMeasured
            && e.fmStatus !== 'in-progress'
            && e.fmStatus !== 'in-progress-early')
  .sort((a, b) => a.cSoll - b.cSoll);
```

Im Chart-Hinweis-Text (`fmrChartHintAdaptive`) ergänze einen Satz zu
den neuen Symbolen — siehe i18n-Block unten.

---

## Schritt 7 — i18n DE

**Datei:** `i18n/de.js`

Im selben Block wie die anderen `fmr*`-Keys ergänzen:

```js
fmrThResidual:        "Restunsicherheit",
fmrThResidualTip:     "Halbe Spanne der bisherigen Umkehrungen, in Cent. Niedrig = präzises Ergebnis, hoch = unsichere Wahrnehmung oder zu wenig Daten.",
fmrProvisionalCount:  "{n} laufend",
fmrStatusProvEarly:   "läuft · {n} Trials",
fmrStatusProvLate:    "in Arbeit · {n} Umkehrungen",
fmrProgressLabel:     "Fortschritt laufende Messung",
fmrQualEarly:         "Erste Messungen laufen ({n} von {t} Elektroden). Werte sind vorläufig, bitte den Test bis zum Ende durchführen.",
fmrQualPartial:       "Teilweise gemessen ({done} von {total} Elektroden konvergiert, mittlere Restunsicherheit {res} Cent). Werte sind grob brauchbar, der Test sollte für ein verläßliches Ergebnis abgeschlossen werden.",
fmrQualOk:            "Messung vollständig (mittlere Restunsicherheit {res} Cent). Werte sind als Anhalt für eine FAT-Anpassung tauglich.",
fmrQualOkWithNoisy:   "Messung vollständig (mittlere Restunsicherheit {res} Cent). Folgende Elektroden mit deutlicher Restunsicherheit: {names}. Werte tauglich, dort aber Vorsicht beim Übertragen.",
```

Außerdem den bestehenden Chart-Hinweis-Text anpassen:

```js
fmrChartHintAdaptive: "Ist-Strich = programmierte Elektroden-Frequenz, Soll-Punkt = wahrgenommene Übereinstimmung. ✓ = saubere Konvergenz, oranges Band = Restunsicherheit (Breite = ±Residuum in Cent), ✗ = nicht wahrnehmbar. Hohler blauer Kreis = vorläufiger Zwischenstand (Messung läuft noch); hohler Kreis mit „?" = noch zu wenig Daten für einen Schätzwert.",
```

**en.js / fr.js / es.js bleiben unverändert** — fehlende Keys fallen
laut `js/i18n.js` auf das Deutsche zurück. Übersetzungen kommen in
einer eigenen kleinen Mini-Anleitung, nachdem die deutsche GUI-Vorlage
steht.

---

## Schritt 8 — Spec-Update

**Datei:** `docs/spec/02b-freqmatch-adaptiv.md`

### 8a) Im Abschnitt „Verfahren im Überblick"

Den ersten Aufzählungspunkt zur Trial-Reihenfolge umformulieren:

> Pro nicht ausgeschlossener Elektrode der variablen Seite läuft ein
> eigener adaptiver Staircase („Track"). Tracks laufen verschränkt
> **als geshuffelter Round-Robin**: pro Runde wird jede aktive Elektrode
> in zufälliger Reihenfolge genau einmal getestet, am Ende der Runde
> wird neu gemischt. Tracks, die innerhalb der Runde konvergieren,
> fallen aus dem Rest der Runde raus. Damit ist die Trial-Verteilung
> gleichmäßig (jeder Track hat nach N Runden ≈ N Trials), während die
> Reihenfolge für den User unvorhersagbar bleibt — Anker- und
> Adaptations-Effekte werden weiter minimiert.

### 8b) Neuer Abschnitt nach „Ergebnis-Tabelle (Status-Spalte)"

```
### Anzeige im Reiter Meßergebnisse → Frequenzabgleich

Der Ergebnis-Reiter zeigt nicht nur abgeschlossene Tracks, sondern auch
laufende. Pro aktivem Track wird ein vorläufiger Zwischenstand
angezeigt:

- **<4 Umkehrungen** (`in-progress-early`): kein Schätzwert. Status-
  Badge „läuft · N Trials". Zahlen-Spalten leer. Im Chart: hohler
  blauer Kreis am Ist-Strich mit „?".
- **≥4 Umkehrungen** (`in-progress`): vorläufiger Match = Mittelwert
  aller bisherigen Umkehrungen, vorläufiges Residuum = halbe Spanne
  aller bisherigen Umkehrungen. Status-Badge „in Arbeit · M
  Umkehrungen". Zahlen-Spalten gefüllt, Zeile kursiv und gedämpft.
  Im Chart: hohler blauer Kreis mit Restunsicherheits-Band
  (blau, transparent), keine Verbindungslinie zu anderen Punkten.

Die Tabelle erhält eine neue Spalte **„Restunsicherheit"** (zwischen
„Diff. (Cent)" und „Status"). Werte mit Ampelfarbe:
- ≤10 cent grün, 10–25 cent gelb-orange, >25 cent rot.
Bei Tracks mit <4 Umkehrungen oder bei nicht-wahrnehmbaren: „—".

Oberhalb der Tabelle:
- **Fortschrittsbalken** (sichtbar nur während laufender Messung),
  Formel siehe „Fortschritt".
- **Qualitätstext** in drei Stufen analog Elektrodenlautstärke
  (erste Messungen / teilweise / vollständig), mit mittlerem
  Residuum und Hinweis auf besonders unsichere Elektroden.

### Fortschritt

Pro Track:
- Endzustand (`converged`, `converged-noisy`, `not-perceivable`)
  zählt als 1,0.
- Aktiver Track zählt als `min(reversals / 6, 0,95)` — damit ist
  garantiert, daß ein aktiver Track nie wie ein abgeschlossener
  aussieht.

Gesamtfortschritt = Mittelwert über alle Tracks, in Prozent. Der
Balken im Test-Panel und im Ergebnis-Reiter nutzen dieselbe Formel.
```

### 8c) Im Abschnitt „Storage"

Im Schema-Beispiel `freqmatchAdaptive` das Feld `roundQueue` ergänzen:

```
{
  tracks: { /* wie bisher */ },
  roundQueue: [electrodeIdx, ...],    // aktuelle Round-Robin-Reihenfolge
  startedAt: timestamp,
  completedAt: timestamp | null
}
```

---

## Schritt 9 — Bau-Diagnose-Tests

Gemäß der ab BA 83 geltenden Konvention (siehe
`docs/BAUANLEITUNGEN_LEITLINIEN.md`, Abschnitt „Bau-Diagnose-Tests"):
für die Teile, die *nicht* rein visuell sind, einen Bau-Diagnose-Test
ablegen. Die UI-Anpassungen (Zwischenstand-Anzeige, Chart-Symbole,
Qualitätstext) werden über die manuelle Akzeptanz-Checkliste geprüft;
für **Round-Robin** und **Fortschritts-Formel** lohnt sich ein
programmatischer Test, weil beide Verteilungs-/Numerik-Eigenschaften
haben, die im Diff nicht offensichtlich sind.

**Datei:** `js/debug-tests-current.js`

Zwei neue IIFE-Blöcke einfügen (oberhalb des abschließenden `})();`,
oder als jeweils eigene IIFEs am Ende der Datei — Stil egal, Hauptsache
klar mit BA-Nummer kommentiert).

### 9a) Test: Round-Robin-Verteilung

```js
/* Bauanleitung 84 — Round-Robin in fmPickNextTrack */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmPickNextTrack !== 'function') return;

  dbg.test(
    'build/BA84/round-robin-verteilung',
    { tab: 'messungen', label: 'BA84 · Round-Robin-Verteilung' },
    function () {
      // Konstruiere synthetisches Tracks-Objekt mit 5 aktiven Tracks.
      const tracks = {};
      const ids = [1, 3, 5, 7, 9];
      ids.forEach(function (i) {
        tracks[i] = { electrodeIdx: i, status: 'active' };
      });
      const state = { tracks: tracks, roundQueue: [] };

      // 20 Picks ziehen, je 5 sollen jede ID genau einmal liefern.
      const counts = {};
      ids.forEach(function (i) { counts[i] = 0; });
      const totalPicks = 20;
      for (let k = 0; k < totalPicks; k++) {
        const id = fmPickNextTrack(state);
        if (id == null) return { ok: false, msg: 'fmPickNextTrack lieferte null bei Pick ' + k };
        if (counts[id] == null) return { ok: false, msg: 'unerwartete ID: ' + id };
        counts[id]++;
        // Nach jeder vollen Runde (5 Picks) müssen alle Counts gleich sein.
        if ((k + 1) % ids.length === 0) {
          const want = (k + 1) / ids.length;
          for (const i of ids) {
            if (counts[i] !== want) {
              return {
                ok: false,
                msg: 'nach ' + (k + 1) + ' Picks: ID ' + i + '=' + counts[i] + ' (erwartet ' + want + ')'
              };
            }
          }
        }
      }
      return { ok: true, msg: '5 IDs, 4 Runden, Verteilung exakt gleichmäßig' };
    }
  );

  dbg.test(
    'build/BA84/round-robin-konvergenz-mitten',
    { tab: 'messungen', label: 'BA84 · Round-Robin: konvergierte Tracks fallen raus' },
    function () {
      const tracks = {
        1: { electrodeIdx: 1, status: 'active' },
        2: { electrodeIdx: 2, status: 'active' },
        3: { electrodeIdx: 3, status: 'active' }
      };
      const state = { tracks: tracks, roundQueue: [] };

      // Erste Runde: alle 3 müssen drankommen.
      const seen = new Set();
      for (let k = 0; k < 3; k++) seen.add(fmPickNextTrack(state));
      if (seen.size !== 3) return { ok: false, msg: 'Runde 1: ' + seen.size + '/3 IDs gesehen' };

      // Track 2 als konvergiert markieren.
      tracks[2].status = 'converged';

      // Nächste Runde: nur 1 und 3 dürfen kommen, je einmal.
      const next2 = [fmPickNextTrack(state), fmPickNextTrack(state)];
      const set2 = new Set(next2);
      if (set2.has(2)) return { ok: false, msg: 'konvergierter Track 2 wurde gewählt' };
      if (set2.size !== 2 || !set2.has(1) || !set2.has(3)) {
        return { ok: false, msg: 'Runde 2 unvollständig: ' + JSON.stringify(next2) };
      }
      return { ok: true, msg: 'konvergierter Track wird bei laufenden Runden übersprungen' };
    }
  );
})();
```

### 9b) Test: Fortschritts-Formel

```js
/* Bauanleitung 84 — fmComputeProgressStats */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmComputeProgressStats !== 'function') return;

  dbg.test(
    'build/BA84/progress-formel',
    { tab: 'messungen', label: 'BA84 · Fortschritts-Formel' },
    function () {
      const cases = [
        {
          name: '4 aktiv, 0 Umkehrungen',
          tracks: {
            1: { status: 'active', reversals: [], trialCount: 2 },
            2: { status: 'active', reversals: [], trialCount: 1 },
            3: { status: 'active', reversals: [], trialCount: 3 },
            4: { status: 'active', reversals: [], trialCount: 0 }
          },
          want: 0
        },
        {
          name: '4 aktiv, je 3 Umkehrungen',
          tracks: {
            1: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            2: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            3: { status: 'active', reversals: [0,0,0], trialCount: 10 },
            4: { status: 'active', reversals: [0,0,0], trialCount: 10 }
          },
          want: 50   // 3/6 = 0.5 → 50%
        },
        {
          name: '2 konvergiert, 2 aktiv mit ≥6 Umkehrungen',
          tracks: {
            1: { status: 'converged',         reversals: [0,0,0,0,0,0], trialCount: 30 },
            2: { status: 'converged-noisy',   reversals: [0,0,0,0,0,0], trialCount: 35 },
            3: { status: 'active',            reversals: [0,0,0,0,0,0], trialCount: 20 },
            4: { status: 'active',            reversals: [0,0,0,0,0,0,0,0], trialCount: 25 }
          },
          want: 97.5  // (1+1+0.95+0.95)/4*100
        },
        {
          name: 'alle konvergiert',
          tracks: {
            1: { status: 'converged',       reversals: [0,0,0,0,0,0], trialCount: 30 },
            2: { status: 'not-perceivable', reversals: [],            trialCount: 40 }
          },
          want: 100
        }
      ];
      const fails = [];
      for (const c of cases) {
        const got = fmComputeProgressStats(c.tracks).percent;
        if (Math.abs(got - c.want) > 0.5) {
          fails.push(c.name + ': erwartet ' + c.want + ' %, bekam ' + got.toFixed(1) + ' %');
        }
      }
      if (fails.length) return { ok: false, msg: fails.join(' · ') };
      return { ok: true, msg: cases.length + ' Fälle, alle innerhalb ±0,5 %' };
    }
  );
})();
```

### 9c) Hinweis im Build-Bericht von Sonnet

Sonnet weist in seinem Build-Bericht den Nutzer ausdrücklich auf
diese drei Tests hin und bittet darum, im Debug-Panel den Tab
„Messungen" zu öffnen, die Tests auszuführen (▶ alle oder
↻ einzeln), und die Markdown-Ausgabe aus dem Sektion-Copy
„Tests" zurückzuschicken.

---

## Schritt 10 — CODESTRUKTUR.md

**Datei:** `docs/CODESTRUKTUR.md`

Im Abschnitt zum Frequenzabgleich (such nach „freqmatch-staircase"):
- Hinweis, daß `fmPickNextTrack(state, rng)` jetzt einen `{tracks,
  roundQueue}`-State erwartet (war vorher nur `tracks`).
- Neue Hilfsfunktion `fmComputeProgressStats(tracks)` in `freqmatch.js`
  als Export-fähige Statistik-Funktion erwähnen, die auch von
  `results.js` benutzt wird.
- Neue Hilfsfunktion `_fmrBuildInProgressEntries(side)` in `results.js`
  als Anzeige-Brücke zwischen `freqmatchAdaptive.tracks` und der
  Render-Pipeline erwähnen.

Knapp halten — nicht jede Zeile dokumentieren.

---

## Akzeptanztest

**Voraussetzung:** Mindestens eine CI-Seite mit ≥3 aktiven Elektroden.
Bestehende Frequenzabgleich-Daten bleiben unverändert.

1. **Adaptiver Test starten und nach wenigen Trials pausieren.**
   - Tab Messungen → Sub-Tab Frequenzabgleich.
   - Modus auf „Adaptiv" (Default).
   - „Test starten" → Test läuft, Status-Grid zeigt alle Elektroden.
   - Nach ca. 5 Trials „Stop" drücken.
   - **Erwartet:** Test pausiert, Status-Grid zeigt teilweise Trials.

2. **Reiter Meßergebnisse → Frequenzabgleich öffnen.**
   - **Erwartet:**
     - Fortschrittsbalken oben sichtbar, irgendwo zwischen 0 und 30 %.
     - Qualitätstext: „Erste Messungen laufen (N von M Elektroden) …".
     - Tabelle zeigt alle Elektroden mit Badge „läuft · N Trials"
       (kursiv, blaue Badge), Zahlen-Spalten leer.
     - Chart zeigt kleine hohle blaue Kreise mit „?" an den Ist-Strichen
       der aktiven Elektroden.

3. **Test fortsetzen, bis mehrere Tracks ≥4 Umkehrungen haben.**
   - „Test fortsetzen" klicken, ca. 30–50 weitere Trials antworten.
   - Pausieren.
   - **Erwartet:**
     - Für Tracks mit ≥4 Umkehrungen: in der Tabelle Status-Badge
       „in Arbeit · M Umkehrungen" und gefüllte Zahlen-Spalten,
       Zeile kursiv und gedämpft. Residuum-Spalte mit Ampelfarbe.
     - Im Chart: hohle blaue Kreise an den geschätzten Soll-Positionen,
       darum ein bläuliches transparentes Restunsicherheits-Band.
     - Fortschrittsbalken weiter gestiegen.

4. **Round-Robin verifizieren** (programmatisch).
   - Debug-Panel öffnen → Tab „Messungen" → die drei BA84-Tests
     finden (`build/BA84/round-robin-verteilung`,
     `build/BA84/round-robin-konvergenz-mitten`,
     `build/BA84/progress-formel`).
   - ▶ alle anhaken, ausführen, alle drei sollen grün sein.
   - Zusätzlich live im Konsolen-Check: nach 1 Runde
     (= N aktive Elektroden) sollten alle Tracks `trialCount = 1`
     haben, prüfbar per
     `Object.values(fmTracks).map(t => [t.electrodeIdx, t.trialCount])`.

5. **Konvergenz eines Tracks.**
   - Test bis zum Abschluß mindestens eines Tracks laufen lassen
     (oder Debug-Modus benutzen, um schneller hinzukommen).
   - **Erwartet:**
     - Konvergierter Track in der Tabelle mit Badge „✓ konvergiert",
       Zeile normal (nicht kursiv), Residuum-Spalte grün, Chart-Punkt
       voll schwarz.
     - Verbindungslinie geht nur durch konvergierte Punkte, nicht
       durch vorläufige.

6. **Vollständige Messung.**
   - Test bis zum Ende durchführen.
   - **Erwartet:**
     - Fortschrittsbalken im Ergebnis-Reiter verschwindet
       (kein aktiver Track mehr).
     - Qualitätstext: „Messung vollständig (mittlere Restunsicherheit
       X Cent) …".
     - Tabelle und Chart entsprechen dem bisherigen Verhalten für
       konvergierte / noisy / not-perceivable Einträge.

7. **Test-Panel-Fortschrittsbalken im laufenden Test.**
   - Test neu starten.
   - **Erwartet:** Der Balken wächst kontinuierlich (nicht nur in
     Sprüngen, wenn Tracks konvergieren). Nach wenigen Trials
     zeigt er bereits einige Prozent, nicht 0 %.

8. **Spalten-Konsistenz in der Tabelle.**
   - Stelle sicher, daß ALLE Zeilen 9 Spalten haben (ausgeschlossene,
     ungemessene, in-progress, in-progress-early, konvergiert,
     noisy, not-perceivable).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen.
Für jede notieren: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe. Wenn etwas als „unklar" markiert wird, ist das
Signal zur Rückfrage an den User, nicht zur stillen Annahme.

Zusätzlich prüfen:

- **Alt-API von `fmPickNextTrack`**: Wird sie irgendwo außer in
  `fmNextAdaptiveTrial` noch aufgerufen (z.B. in Tests oder
  Debug-Modus)? `grep -rn "fmPickNextTrack" js/ .claude/` und
  jeden Aufrufer auf die neue Signatur umstellen.
- **`fmRoundQueue` als Modul-Variable**: ist sie in allen Reset-
  Pfaden (`fmFinishAdaptive`, `_fmClearPersist`, `fmStop` falls
  vorhanden) wieder auf `[]` gesetzt?
- **Persistenz / Resume**: Pause während laufender Runde,
  Tab-Wechsel, dann Resume — die Runde sollte ohne Reset
  weiterlaufen.
- **Fallback bei fehlendem `roundQueue` in Altdaten**: Geladenes
  JSON ohne `roundQueue`-Feld darf nicht crashen — `_fmTryRestore`
  setzt `fmRoundQueue = []` im Fallback (Schritt 2c).
- **Tabelle 9 Spalten**: jede Zeile (alle 4 Fall-Zweige) hat
  exakt 9 `<td>`.
- **Druck/Export-Pipelines** (`js/tab-print.js`, `js/file.js`):
  Werden Zwischenstände versehentlich in den Druck oder Export
  geschrieben? Erwartet: NEIN — `fRes` selbst wird nicht erweitert.

**Aufräum-Workflow für die Bau-Diagnose-Tests aus Schritt 9
(ab BA 83 Pflicht, siehe `docs/BAUANLEITUNGEN_LEITLINIEN.md`):**

1. Sonnet wartet auf die Test-Ausgabe vom Nutzer (Sektion-Copy
   „Tests" aus dem Debug-Panel).
2. Sonnet wertet aus und meldet Befund (alle drei Tests grün
   oder Diagnose, was schiefging).
3. Bei Akzeptanz fragt Sonnet **aktiv** beim Nutzer nach, ob die
   drei BA84-Tests:
   - **(a) ersatzlos entfernt** werden sollen (typisch für Tests,
     die nur den Bauschritt absichern und im Alltag keinen Wert
     mehr haben), oder
   - **(b) ins Archiv verschoben** werden sollen unter
     `archive/debug-tests/BA84_round_robin.js` und
     `archive/debug-tests/BA84_progress_formel.js` — mit jeweils
     einem Kommentarkopf wie in den Leitlinien beschrieben.
4. Sonnet führt die gewählte Aktion aus, bevor die Bauanleitung
   final als abgeschlossen gemeldet wird.
5. Nach Abnahme darf `js/debug-tests-current.js` **keinen** der
   BA84-Tests mehr enthalten.

---

## Hinweise zum Volumen und zur Folge-Anleitung

- en/fr/es-Übersetzungen für die in Schritt 7 hinzugefügten Keys
  werden in einer eigenen Mini-Anleitung nachgezogen, sobald die
  deutsche GUI-Vorlage hier durch ist.
- Die im User-Gespräch erwähnte Zweiteilung „vollständig / Konvergenz"
  ist explizit NICHT Teil dieser Anleitung. Sie kommt als eigene
  Bauanleitung, nachdem diese hier verifiziert ist.
