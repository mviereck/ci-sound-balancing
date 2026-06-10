# Bauanleitung 78 — Frequenzabgleich adaptiv: Ergebnis-Chart und Tabelle

## Ziel

Siebte Anleitung der 02b-Reihe. Erweitert das Ergebnis-Chart und
die Ergebnis-Tabelle des Frequenzabgleich-Sub-Tabs um die drei
Status des adaptiven Modus:

- **`converged`** — wie heute: voller Soll-Punkt mit Pfeil
- **`converged-noisy`** — Soll-Punkt mit Pfeil **plus**
  Restunsicherheits-Band (semitransparenter vertikaler Balken,
  Halb-Höhe = `fmResidual` cent)
- **`not-perceivable`** — hohles Quadrat mit ✕ am Ist-Strich,
  **kein** Soll-Punkt, **kein** Pfeil

Slider-Modus-Einträge (ohne `fmStatus`-Feld) werden wie heute
gezeichnet (Default = `converged`).

**Voraussetzungen**: Bauanleitungen 72–77 sind umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.78-beta";
```

---

## 2. „nicht wahrnehmbar"-Daten an `drawFreqMatchChart` durchreichen

Not-perceivable-Tracks haben **keinen** `fRes`-Eintrag (siehe
Bauanleitung 02b/6). Information lebt in
`sideData[ciSide].freqmatchAdaptive.tracks[idx]`.

In `js/results.js`, `renderFreqMatchResults` (Z. 228 ff.) — den
Aufruf von `drawFreqMatchChart` erweitern um ein zweites Argument
mit den not-perceivable-Markierungen.

**Vorher** (Z. 333):

```js
if (cv) {
  drawFreqMatchChart(cv, fRes);
  // ...
}
```

**Nachher**:

```js
if (cv) {
  const notPerc = _fmrCollectNotPerceivable();
  drawFreqMatchChart(cv, fRes, { notPerceivable: notPerc });
  // ...
}
```

Neue Helfer-Funktion in `js/results.js`, vor `renderFreqMatchResults`:

```js
function _fmrCollectNotPerceivable() {
  const result = {};
  ['left', 'right'].forEach(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    if (!fa || !fa.tracks) return;
    Object.keys(fa.tracks).forEach(function(k) {
      const tr = fa.tracks[k];
      if (tr.status === 'not-perceivable') {
        // Key = "side:idx" damit beide Seiten unterscheidbar sind
        result[side + ':' + k] = true;
      }
    });
  });
  return result;
}
```

---

## 3. `drawFreqMatchChart` erweitern

In `js/chart.js`, `drawFreqMatchChart(cv, fResData)` (Z. 323).

### 3a) Signatur erweitern

```js
function drawFreqMatchChart(cv, fResData, opts) {
  opts = opts || {};
  const notPerc = opts.notPerceivable || {};
  // ...rest wie heute...
}
```

Den vorhandenen Tooltip-Rerender-Aufruf in der Datei (Z. 786):

```js
drawFreqMatchChart(cv, cv._fmcFResData);
```

ebenfalls erweitern auf:

```js
drawFreqMatchChart(cv, cv._fmcFResData, cv._fmcOpts || {});
```

Und in `drawFreqMatchChart` selbst, an passender Stelle (vor dem
ersten Return):

```js
cv._fmcOpts = opts;
```

### 3b) `allEls`-Aufbau um not-perceivable-Flag erweitern

In der Schleife `for (let i = 0; i < nCi; i++)` (Z. 365 ff.),
neben `r = measuredByIdx[i]` prüfen:

```js
const notPercFlag = !!notPerc[ciSide + ':' + i];
```

Im `allEls.push({...})`-Block neue Felder ergänzen:

```js
allEls.push({
  elIdx: i,
  // ...bestehende Felder...
  isNotPerceivable: notPercFlag,
  // Bei converged-noisy: Residuum in cent aus dem fRes-Eintrag (siehe 02b/4 _fmWriteResult)
  fmStatus:   r ? (r.fmStatus || 'converged') : null,
  fmResidual: r ? (r.fmResidual || 0)         : null
});
```

Hinweis: bei Slider-Modus-Einträgen ist `r.fmStatus` undefined →
Default `'converged'`, `r.fmResidual` ist 0. Visuelle Darstellung
identisch zu heute.

### 3c) Symbol je Status zeichnen

Heute zeichnet die Funktion nach dem Ist-Strich-Block den Soll-Punkt
mit Pfeil. Sonnet findet die entsprechende Schleife (in der Regel
`for (const el of allEls) { ... drawArrow/drawPoint ... }`) und
verzweigt nach `el.fmStatus`.

Pseudocode-Skelett für die Verzweigung:

```js
for (const el of allEls) {
  if (!el.isMeasured && !el.isNotPerceivable) continue;
  const xIst = tX(el.cIst);

  if (el.isNotPerceivable) {
    // Hohles Quadrat mit ✕ in der Mitte am Ist-Strich auf y=0-Linie
    const y0 = tY(0);
    const size = 12;
    ctx.strokeStyle = '#ef4444';   // rot
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(xIst - size/2, y0 - size/2, size, size);
    ctx.beginPath();
    ctx.moveTo(xIst - size/2, y0 - size/2);
    ctx.lineTo(xIst + size/2, y0 + size/2);
    ctx.moveTo(xIst + size/2, y0 - size/2);
    ctx.lineTo(xIst - size/2, y0 + size/2);
    ctx.stroke();
    continue;   // KEIN Pfeil, KEIN Soll-Punkt
  }

  // Bestehende Zeichen-Logik für Pfeil und Soll-Punkt
  // ... (heute schon vorhanden) ...

  if (el.fmStatus === 'converged-noisy' && el.fmResidual > 0) {
    // Restunsicherheits-Band: vertikaler semitransparenter Balken um den Soll-Punkt
    const yC = tY(el.dCent);           // y des Soll-Punkts (auf ΔCent-Achse)
    const halfH = Math.abs(tY(0) - tY(el.fmResidual));
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';   // amber/orange, transparent
    ctx.fillRect(xIst - 6, yC - halfH, 12, 2 * halfH);
  }
}
```

Sonnet passt die genaue Render-Reihenfolge an die heutige Logik
an. Wichtig:
- Das Restunsicherheits-Band soll **hinter** dem Soll-Punkt liegen
  (Band zuerst, Punkt drüber).
- Bei `converged-noisy` wird trotz Band der normale Soll-Punkt
  inkl. Pfeil weiter gezeichnet — das Band ist ein **Zusatz**.

### 3d) Tooltip um Status erweitern

`_fmcTooltipHandler` (existiert in `chart.js`, Sonnet sucht via
`grep -n "_fmcTooltipHandler" js/chart.js`) zeigt heute Cent-Werte
und Frequenzen. Ergänzen:

- Bei `isNotPerceivable`: Tooltip-Text „Elektrode N — nicht
  wahrnehmbar" (i18n-Key `fmrTipNotPerc` — wird in 02b/8 belegt,
  bis dahin Fallback „nicht wahrnehmbar").
- Bei `fmStatus === 'converged-noisy'`: zusätzliche Zeile
  „Restunsicherheit ±N ct" (i18n-Key `fmrTipResidual` — bis 02b/8
  Fallback „Restunsicherheit").

---

## 4. Ergebnis-Tabelle (Status-Spalte)

In `js/results.js`, `renderFreqMatchResults` (Z. 228 ff.).

### 4a) Header-Spalte ergänzen

```js
th.innerHTML =
  "<th>" + t("fmrThEl") + "</th>" +
  "<th>" + t("fmrThVarSide") + "</th>" +
  "<th>" + t("fmrThVarHz") + "</th>" +
  "<th>" + t("fmrThRefSide") + "</th>" +
  "<th>" + t("fmrThRefHz") + "</th>" +
  "<th>" + t("fmrThDiffHz") + "</th>" +
  "<th>" + t("fmrThDiffCent") + "</th>" +
  "<th>" + t("fmrThStatus") + "</th>";   // NEU
```

### 4b) Datenzeile um Status-Spalte erweitern

Im `else`-Zweig der Schleife (Z. 312 ff., gemessen + nicht
ausgeschlossen):

```js
let statusBadge = '';
if (r.fmStatus === 'converged-noisy') {
  statusBadge = '<span class="fm-badge fm-badge-noisy" data-t="fmrStatusNoisy">±' + Math.round(r.fmResidual || 0) + ' ct</span>';
} else if (r.fmStatus === 'converged') {
  statusBadge = '<span class="fm-badge fm-badge-ok" data-t="fmrStatusOk">✓</span>';
} else {
  // Slider-Modus oder kein fmStatus: leere Spalte
  statusBadge = '<span class="muted">—</span>';
}

tr.innerHTML =
  // ...bisherige Zellen...
  "<td style=\"color:" + diffColor + "\">" + (centRound >= 0 ? "+" : "") + centRound + "</td>" +
  "<td>" + statusBadge + "</td>";
```

### 4c) Not-perceivable-Zeile

Im aktuellen Code gibt es einen „not measured"-Zweig (Z. 303 ff.):
`else if (!r)`. Diesen erweitern: wenn `_fmrCollectNotPerceivable()`
den Eintrag enthält, statt „nicht gemessen" eine
„nicht wahrnehmbar"-Zeile zeigen.

```js
} else if (!r) {
  const notPerc = sideData[ciSide].freqmatchAdaptive
    && sideData[ciSide].freqmatchAdaptive.tracks
    && sideData[ciSide].freqmatchAdaptive.tracks[i]
    && sideData[ciSide].freqmatchAdaptive.tracks[i].status === 'not-perceivable';
  const note = notPerc
    ? '<span class="fm-badge fm-badge-err" data-t="fmrStatusNotPerc">✗ nicht wahrnehmbar</span>'
    : t('notMeasured');
  tr.innerHTML =
    "<td style=\"font-weight:600\">" + elLabel + "</td>" +
    "<td>" + varLabel + "</td>" +
    "<td style=\"color:#9ca3af\">—</td>" +
    "<td>" + refLabel + "</td>" +
    "<td style=\"color:#9ca3af\">—</td>" +
    "<td style=\"color:#9ca3af\">—</td>" +
    "<td style=\"color:#9ca3af\">—</td>" +
    "<td>" + note + "</td>";
}
```

### 4d) Tabellen-Spalte für die exCI-Zeile ergänzen

Die ausgeschlossene-Zeile (Z. 293 ff.) bekommt ebenfalls eine
zusätzliche `<td>` für die Status-Spalte (leer / „—"):

```js
tr.innerHTML =
  // ...bisherige Zellen...
  "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>" +
  "<td>—</td>";   // NEU
```

---

## 5. CSS für Status-Badges

In der CSS-Datei der Ergebnis-Anzeige (Sonnet sucht via
`grep -rn "fmrCard\|fm-badge" css/`):

```css
.fm-badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.82em;
  font-weight: 600;
}
.fm-badge-ok    { background: #d1fae5; color: #065f46; }
.fm-badge-noisy { background: #fef3c7; color: #92400e; }
.fm-badge-err   { background: #fee2e2; color: #991b1b; }
```

---

## 6. Legende des Charts

Im Chart-Hinweis-Text (Z. 346 in `js/results.js`) den heutigen
`fmrChartHint` durch einen erweiterten Hinweis ersetzen (i18n-Key
`fmrChartHintAdaptive` — wird in 02b/8 belegt; Fallback wie heute).

Sonnet erweitert den Hinweis-Text um eine kurze Legende:

> Ist-Strich = programmierte Elektroden-Frequenz, Soll-Punkt =
> wahrgenommene Übereinstimmung. ✓ saubere Konvergenz,
> ◐ Restunsicherheit (orange Band), ✗ nicht wahrnehmbar.

Den genauen Text-Wortlaut legt 02b/8 fest. In dieser Anleitung
wird nur der i18n-Key referenziert und der Fallback eingebaut.

---

## 7. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`:

- Zeile für `results.js`: neue Funktion `_fmrCollectNotPerceivable`
  ergänzen. Erwähnen, daß `renderFreqMatchResults` jetzt die
  Adaptiv-Status aus `sideData.*.freqmatchAdaptive` einliest.
- Zeile für `chart.js`: `drawFreqMatchChart` nimmt jetzt einen
  dritten Parameter `opts` mit `notPerceivable`-Map.
- Neue fRes-Felder: `fmStatus`, `fmResidual` dokumentieren (bei
  Bedarf in einer Abschnitt „fRes-Schema").

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.78-beta`.
2. Slider-Test einmal komplett für 2–3 Elektroden durchspielen
   (oder Session mit alten Slider-Daten laden). **Erwartung**:
   Chart unverändert, Tabelle hat eine neue Status-Spalte mit
   ✓-Badge bei den gemessenen Zeilen.
3. Adaptiven Test durchspielen, manche Elektroden mit guter
   Konvergenz (≤10 cent Residuum), manche mit größerem Residuum,
   evtl. eine not-perceivable. Erwartung im Chart:
   - Saubere Konvergenz: voller schwarzer Soll-Punkt mit Pfeil
     (wie heute).
   - `converged-noisy`: derselbe Punkt mit Pfeil **plus**
     orangenes vertikales Band um den Punkt herum, Halb-Höhe
     = Residuum in cent.
   - `not-perceivable`: hohles rotes Quadrat mit ✕ am Ist-Strich
     auf y=0-Linie, **kein** Pfeil, **kein** Soll-Punkt.
4. In der Tabelle:
   - Konvergiert: ✓-Badge
   - Restunsicherheit: gelb-orange ±N ct-Badge
   - Nicht wahrnehmbar: rote ✗-Badge in der Zeile, die sonst
     „nicht gemessen" gezeigt hätte
5. Tooltip im Chart (Mouseover): bei not-perceivable steht
   „nicht wahrnehmbar". Bei converged-noisy zusätzliche
   Zeile „Restunsicherheit ±N ct".
6. Konsole frei von Fehlern.
7. **Slider-Modus weiterhin funktional** und das Chart sieht
   für Slider-Einträge unverändert aus.

---

## Selbstprüfungs-Auftrag an Sonnet

1. Akzeptanztest einzeln durchgehen, melden.
2. Speziell prüfen:
   - `_fmrCollectNotPerceivable` greift auf BEIDE Seiten zu
     (linke und rechte `sideData`), so daß bilaterale Setups
     korrekt funktionieren.
   - Bei Slider-Modus-Einträgen ohne `fmStatus`-Feld zeichnet
     das Chart wie heute (Default `converged`, kein Band, kein ✗).
   - Restunsicherheits-Band: Halb-Höhe in cent stimmt mit der
     Y-Achsen-Skalierung überein (also: pixel-Höhe entspricht
     `|tY(0) - tY(residual)|`).
   - Das ✗-Quadrat wird auf der **y=0-Linie** der ΔCent-Achse
     gezeichnet (also auf dem Ist-Strich-Niveau, nicht am
     Soll-Punkt — den gibt's bei not-perceivable nicht).
3. Bei Unklarheit zur Position der Restunsicherheits-Band-
   Zeichnung (vor oder nach dem Pfeil) — **rückfragen**, sonst
   kann das Band den Pfeil überdecken.

---

## Was diese Anleitung NICHT macht

- Keine Print-Anpassung (`print-md.js`, `_archivChartFreqmatch`)
  — die Spec 02b sagt zum Druck nichts Explizites. Falls der
  Audiologen-Druck oder Archiv-Druck die drei Status zeigen
  soll, kommt das als separate Mini-Anleitung danach.
- Keine i18n-Strings (kommt in 02b/8): `fmrThStatus`,
  `fmrStatusOk`, `fmrStatusNoisy`, `fmrStatusNotPerc`,
  `fmrTipNotPerc`, `fmrTipResidual`, `fmrChartHintAdaptive`.
