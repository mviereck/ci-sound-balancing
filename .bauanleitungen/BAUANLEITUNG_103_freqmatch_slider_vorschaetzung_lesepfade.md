# BAUANLEITUNG 103 — Slider-Vor-Schätzung: Lese-Pfade

**Voraussetzung:** BA 102 ist abgenommen. `sideData[side].freqmatchAdaptive.sliderEstimates`
existiert pro Seite und enthält Schätzungs-Einträge `{cent, varSide, refSide, varFreq, timestamp}`
pro Elektrode.

**Ziel:** Slider-Vor-Schätzungen werden in Meßergebnis-Tabelle, Frequenzabgleich-
Chart, Frequenz-Warp (Player-Audio-Pfad) und Audiologen-Druck **als dritte
Datenquelle** sichtbar — strikt unter `fRes` (final) und unter `in-progress`
(aktive Tracks ≥2 Umkehrungen). Eigene Status-Markierung, eigene Badge-Farbe,
eigener Druck-Hinweis.

**Reihenfolge in der Serie:** 102 → **103 (dies)** → 104 → 105.

**Volumen:** ein Sonnet-Chat.

---

## 1. Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.0.103-beta";
```

---

## 2. Neue Pseudo-Quelle: `_fmrBuildSliderEntries`

In `js/results.js`, direkt unterhalb von `_fmrBuildInProgressEntries`
(siehe Z. 258–319).

```js
// Pseudo-fRes-Einträge aus sliderEstimates (Bauanleitung 103).
//
// Slider-Vor-Schätzungen leben in
// sideData[side].freqmatchAdaptive.sliderEstimates[elIdx] und werden
// nicht ins globale fRes geschrieben (siehe BA 102). Diese Funktion
// macht sie für Anzeige und Warp verfügbar — als dritte Datenquelle
// unter fRes (final) und unter den 'in-progress'-Pseudo-Einträgen
// aus aktiven Tracks.
function _fmrBuildSliderEntries(side) {
  const out = [];
  const sd = sideData[side];
  if (!sd) return out;
  const fa = sd.freqmatchAdaptive;
  if (!fa || !fa.sliderEstimates || typeof fa.sliderEstimates !== 'object') return out;
  const ests = fa.sliderEstimates;
  const keys = Object.keys(ests);
  for (var i = 0; i < keys.length; i++) {
    const elIdx = parseInt(keys[i], 10);
    if (!isFinite(elIdx)) continue;
    const est = ests[keys[i]];
    if (!est || typeof est.cent !== 'number') continue;
    // varFreq aus der gespeicherten Schätzung; falls fehlend, aktuell rechnen.
    const varHz = (typeof est.varFreq === 'number' && est.varFreq > 0)
      ? est.varFreq
      : withSide(side, function() { return effFreq(elIdx); });
    if (!isFinite(varHz) || varHz <= 0) continue;
    const refSide = est.refSide || (side === 'left' ? 'right' : 'left');
    const refHz   = varHz * Math.pow(2, est.cent / 1200);
    out.push({
      varSide:      side,
      refSide:      refSide,
      elIdx:        elIdx,
      varFreq:      varHz,
      refFreq:      refHz,
      timestamp:    est.timestamp || Date.now(),
      fmStatus:     'slider-estimate',
      fmResidual:   null,
      fmCombinedUncertainty: null,
      fmConv:       null,
      fmRunSpread:  null,
      fmResiduum:   null,
      fmRunsCount:  0,
      fmStatusLast: null,
      fmTrialCount: 0,
      fmReversals:  0,
      _provisional:    true,
      _sliderEstimate: true
    });
  }
  return out;
}
```

`_sliderEstimate: true` ist ein zusätzliches Flag, das die Druck-, Chart-
und Player-Schicht zur Unterscheidung von `_provisional`-Einträgen (aktive
Tracks) nutzen kann.

---

## 3. `_warpFResSource` erweitern (dreistufige Vorrang-Logik)

In `js/freq-warp.js`, Funktion `_warpFResSource` (Z. 543–562). Die heutige
Funktion hat zwei Stufen: `fRes` (final) > `_fmrBuildInProgressEntries`
(in-progress). Wir ergänzen eine **dritte** Stufe für Slider-Estimates.

**Vorher:**
```js
function _warpFResSource() {
  const out = (typeof fRes !== "undefined" && Array.isArray(fRes))
    ? fRes.slice() : [];
  if (typeof _fmrBuildInProgressEntries !== "function") return out;
  const sides = ["left", "right"];
  for (const side of sides) {
    let prov;
    try { prov = _fmrBuildInProgressEntries(side) || []; }
    catch (e) { prov = []; }
    if (!prov.length) continue;
    const finalsBySide = new Set();
    for (const r of out) {
      if (r && r.varSide === side) finalsBySide.add(r.elIdx);
    }
    for (const p of prov) {
      if (!finalsBySide.has(p.elIdx)) out.push(p);
    }
  }
  return out;
}
```

**Nachher:**
```js
function _warpFResSource() {
  const out = (typeof fRes !== "undefined" && Array.isArray(fRes))
    ? fRes.slice() : [];
  const sides = ["left", "right"];

  // Stufe 2: in-progress-Pseudo-Einträge aus aktiven Tracks ≥0 Umkehrungen.
  // Vorrang: nur einreihen, wenn kein finaler fRes-Eintrag pro (side, elIdx).
  if (typeof _fmrBuildInProgressEntries === "function") {
    for (const side of sides) {
      let prov;
      try { prov = _fmrBuildInProgressEntries(side) || []; }
      catch (e) { prov = []; }
      if (!prov.length) continue;
      const finalsBySide = new Set();
      for (const r of out) {
        if (r && r.varSide === side) finalsBySide.add(r.elIdx);
      }
      for (const p of prov) {
        if (!finalsBySide.has(p.elIdx)) out.push(p);
      }
    }
  }

  // Stufe 3: Slider-Vor-Schätzungen.
  // Vorrang: nur einreihen, wenn weder finaler fRes-Eintrag noch
  // in-progress-Eintrag pro (side, elIdx) — letzteres deckt auch
  // 'in-progress-early' (ohne Match) ab. Sinn: sobald ein adaptiver
  // Track für die Elektrode läuft, ist die Slider-Schätzung überholt
  // (selbst wenn der Track noch keine 2 Umkehrungen hat — er WIRD
  // gleich welche haben, und sein 'in-progress-early' ist im Chart
  // bereits als laufender Punkt sichtbar).
  if (typeof _fmrBuildSliderEntries === "function") {
    for (const side of sides) {
      let ests;
      try { ests = _fmrBuildSliderEntries(side) || []; }
      catch (e) { ests = []; }
      if (!ests.length) continue;
      const covered = new Set();
      for (const r of out) {
        if (r && r.varSide === side) covered.add(r.elIdx);
      }
      for (const e of ests) {
        if (!covered.has(e.elIdx)) out.push(e);
      }
    }
  }

  return out;
}
```

### 3.1 `_warpFResStats` ergänzen

Direkt darunter, in `_warpFResStats`:

**Vorher:**
```js
function _warpFResStats() {
  const all = _warpFResSource();
  let finals = 0, provisional = 0;
  for (const r of all) {
    if (r && r._provisional) provisional++;
    else if (r) finals++;
  }
  return { total: all.length, finals, provisional };
}
```

**Nachher:**
```js
function _warpFResStats() {
  const all = _warpFResSource();
  let finals = 0, provisional = 0, sliderEst = 0;
  for (const r of all) {
    if (!r) continue;
    if (r._sliderEstimate)  sliderEst++;
    else if (r._provisional) provisional++;
    else                     finals++;
  }
  return { total: all.length, finals, provisional, sliderEst };
}
```

Achtung: `_sliderEstimate`-Einträge tragen zusätzlich `_provisional: true`,
daher zuerst auf `_sliderEstimate` prüfen. Sonst würden sie doppelt
gezählt.

---

## 4. Tabelle: dritte Quelle und Slider-Status-Badge

In `js/results.js`, Funktion `renderFreqMatchResults` (Z. 321ff).

### 4.1 Quellen-Vereinigung erweitern

Aktuelle Stelle (ca. Z. 339):
```js
const provisional = _fmrBuildInProgressEntries(ciSide);
```

**Ersetzen durch:**
```js
const provisional = _fmrBuildInProgressEntries(ciSide);
const sliderEsts  = _fmrBuildSliderEntries(ciSide);
```

Die Frühaussstiegs-Bedingung (Z. 341):
```js
if ((typeof fRes === "undefined" || fRes.length === 0) && provisional.length === 0) {
```

**Ersetzen durch:**
```js
if ((typeof fRes === "undefined" || fRes.length === 0)
    && provisional.length === 0
    && sliderEsts.length === 0) {
```

Meta-Zeile (Z. 359ff): nach dem `provCount`-Block einen weiteren Block
für Slider-Estimates ergänzen:

```js
if (provCount > 0) {
  const provStr = t('fmrProvisionalCount').replace('{n}', provCount);
  metaText += (metaText ? ' · ' : '') + provStr;
}
// NEU:
const sliderCount = sliderEsts.length;
if (sliderCount > 0) {
  const sliderStr = t('fmrSliderEstimateCount').replace('{n}', sliderCount);
  metaText += (metaText ? ' · ' : '') + sliderStr;
}
```

### 4.2 displayData-Aufbau erweitern

Aktuelle Stelle (Z. 408–416):
```js
const displayData = fRes.slice();
const haveFinal = {};
for (const r of fRes) {
  if (r.varSide === ciSide) haveFinal[r.elIdx] = true;
}
for (const p of provisional) {
  if (!haveFinal[p.elIdx]) displayData.push(p);
}
```

**Ersetzen durch:**
```js
const displayData = fRes.slice();
const haveCovered = {};
for (const r of fRes) {
  if (r.varSide === ciSide) haveCovered[r.elIdx] = true;
}
// Stufe 2: in-progress (aktive Tracks)
for (const p of provisional) {
  if (!haveCovered[p.elIdx]) {
    displayData.push(p);
    haveCovered[p.elIdx] = true;
  }
}
// Stufe 3: Slider-Vor-Schätzungen
for (const e of sliderEsts) {
  if (!haveCovered[e.elIdx]) {
    displayData.push(e);
    haveCovered[e.elIdx] = true;
  }
}
```

### 4.3 Status-Badge für `slider-estimate` ergänzen

Im Status-Badge-Block (Z. 543–572):

```js
} else if (r.fmStatus === 'not-perceivable') {
  statusBadge = '<span class="fm-badge fm-badge-err" data-t="fmrStatusNotPerc">'
              + t('fmrStatusNotPerc') + '</span>';
}
```

**Vor dem `else`-Endblock einfügen** (zwischen `not-perceivable` und
dem `else { statusBadge = '<span class="muted">—</span>'; }`):

```js
} else if (r.fmStatus === 'slider-estimate') {
  statusBadge = '<span class="fm-badge fm-badge-slider" data-t="fmrStatusSliderEst">'
              + t('fmrStatusSliderEst') + '</span>';
}
```

### 4.4 Zell-Darstellung für `slider-estimate`

Im Zellen-Block für `isProvEarly` / `isProvLate` (Z. 459ff) müssen wir
einen dritten Fall ergänzen. Vor der Zeile (Z. 460):
```js
const isProvEarly = (r.fmStatus === 'in-progress-early');
const isProvLate  = (r.fmStatus === 'in-progress');
const isProv      = isProvEarly || isProvLate;
```

**Ersetzen durch:**
```js
const isProvEarly  = (r.fmStatus === 'in-progress-early');
const isProvLate   = (r.fmStatus === 'in-progress');
const isSliderEst  = (r.fmStatus === 'slider-estimate');
const isProv       = isProvEarly || isProvLate || isSliderEst;
```

**Konsequenz:** `isProv` deckt auch Slider-Estimates ab, daher landen die
Qualitätsspalten (Konv., Lauf-Streuung, Residuum) für sie automatisch auf
„—". Erwünscht.

Bei der Zellen-Berechnung für `varHzCell` etc. (Z. 465ff) ist der Slider-
Estimate-Fall durch den `else`-Zweig (mit Cent-Berechnung) bereits richtig
abgedeckt — er hat `varFreq` und `refFreq`, also funktioniert die normale
Cent-Diff-Anzeige.

Am Schluß des Zeilen-Builds (Z. 584):
```js
if (isProv) tr.style.fontStyle = 'italic';
```

Das bleibt — Slider-Estimates werden ebenfalls kursiv dargestellt, weil
`isProv` jetzt sie mit einschließt.

---

## 5. Chart: `slider-estimate` darstellen

In `js/chart.js`, Funktion `drawFreqMatchChart` (Z. 323ff).

### 5.1 fmStatus-Mapping

Bei der Aufbereitung der Mess-Einträge (Z. 384) wird der `fmStatus`
übernommen. Slider-Estimates haben `fmStatus: 'slider-estimate'` und
landen dort automatisch.

### 5.2 Filter im Sortier-Block

Z. 476:
```js
.filter(e => e.isMeasured && e.fmStatus !== 'in-progress-early')
```

**Ersetzen durch:**
```js
.filter(e => e.isMeasured
          && e.fmStatus !== 'in-progress-early')
```

(Keine Änderung — `slider-estimate` hat einen gültigen `refFreq`, also
darf der Eintrag durch.)

### 5.3 Visuelle Behandlung im Element-Loop

Im Loop (Z. 500ff) wird je nach `fmStatus` gerendert. Vor dem heutigen
`if (el.fmStatus === 'in-progress-early')`-Block einen neuen Spezialfall
für `slider-estimate` einbauen:

```js
if (el.fmStatus === 'slider-estimate') {
  // Hohle graue Raute am Soll-Punkt, gestrichelte Verbindung zum Ist-Strich.
  // Optisch klar von 'converged' (voller blauer Punkt) und
  // 'in-progress-early' (hohler blauer Kreis mit "?") unterscheidbar.
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1.5;
  const sz = 6;
  ctx.beginPath();
  ctx.moveTo(el.x, el.yRef - sz);
  ctx.lineTo(el.x + sz, el.yRef);
  ctx.lineTo(el.x, el.yRef + sz);
  ctx.lineTo(el.x - sz, el.yRef);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(el.x, el.yRef);
  ctx.lineTo(el.x, el.yVar);
  ctx.stroke();
  ctx.restore();
  continue;   // restliche Render-Logik überspringen
}
```

Sonnet, bitte den exakten Einfügeort prüfen — die `el.yRef`/`el.yVar`-
Variablen müssen im Loop bereits berechnet sein. Falls die heutige Struktur
sie erst im späteren `if`-Zweig berechnet, vorab berechnen oder den Block
weiter hinten einfügen.

Auch im Tooltip-Handler (`_fmcTooltipHandler` weiter unten in chart.js)
prüfen, ob die Anzeige für `slider-estimate` einen eigenen Text bekommen
sollte. Vorschlag: zeigt „Vor-Schätzung: ±X cent" statt „Match: …".

---

## 6. Druck (Audiologen-Bericht)

In `js/print-md.js`, Funktion `_audiologFmRowsForSide` (Z. 836ff) und
`_audiologFreqTable` (Z. 873ff).

### 6.1 `_audiologFmRowsForSide` ergänzen

Im Loop, der über `_warpFResSource()` läuft (Z. 849ff), wird heute
`_provisional` per Elektrode gemerkt:

```js
const provByEl = {};
for (const r of fmSrc) {
  elIdxSet.add(r.elIdx);
  if (r._provisional) provByEl[r.elIdx] = true;
}
```

**Ersetzen durch:**
```js
const provByEl = {};
const sliderByEl = {};
for (const r of fmSrc) {
  elIdxSet.add(r.elIdx);
  if (r._sliderEstimate)  sliderByEl[r.elIdx] = true;
  else if (r._provisional) provByEl[r.elIdx]  = true;
}
```

Beim Bau der Row-Objekte:

```js
rows.push({
  elIdx,
  varFreq: fSelf,
  refFreq: fWish,
  cent: cs,
  _provisional: !!provByEl[elIdx],
});
```

**Ersetzen durch:**
```js
rows.push({
  elIdx,
  varFreq: fSelf,
  refFreq: fWish,
  cent: cs,
  _provisional:    !!provByEl[elIdx],
  _sliderEstimate: !!sliderByEl[elIdx],
});
```

### 6.2 Druck-Markierung anpassen

In `_audiologFreqTable` (Z. 887ff) wird `_provisional`-Einträge mit `*`
markiert und am Tabellen-Ende ein Hinweis gesetzt. Wir ergänzen `**` für
Slider-Estimates.

**Vorher:**
```js
let hasProv = false;
lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColDeltaHz")} | ${t("audColHzWish")} |`);
lines.push("|---|---|---|---|---|---|");
for (const r of rows) {
  if (r._provisional) hasProv = true;
  const elLabel = r._provisional ? `${dENPrefix()}${dEN(r.elIdx)} *` : `${dENPrefix()}${dEN(r.elIdx)}`;
  ...
}
```

**Nachher:**
```js
let hasProv = false;
let hasSliderEst = false;
lines.push(`| ${t("thEl")} | ${t("audColHzDefault")} | ${t("audColHzManual")} | ${t("audColCent")} | ${t("audColDeltaHz")} | ${t("audColHzWish")} |`);
lines.push("|---|---|---|---|---|---|");
for (const r of rows) {
  if (r._sliderEstimate) {
    hasSliderEst = true;
  } else if (r._provisional) {
    hasProv = true;
  }
  let elLabel = `${dENPrefix()}${dEN(r.elIdx)}`;
  if (r._sliderEstimate)      elLabel += " **";
  else if (r._provisional)     elLabel += " *";
  ...
}
```

Nach dem Loop (vor dem `return lines.join("\n")`-Ende der Funktion):

```js
if (hasProv) {
  lines.push("");
  lines.push(`*${t("audFmProvNote")}*`);
}
// NEU:
if (hasSliderEst) {
  lines.push("");
  lines.push(`**${t("audFmSliderEstNote")}**`);
}
```

(Sonnet, bitte den genauen vorhandenen Hinweis-Block prüfen — die Variable
hieß je nach Code-Stand ggf. anders. Markdown-Bold mit `**`-Wrapping
verwenden, weil die Tabellen-Markierung `**` mit der Markdown-Syntax
kollidieren könnte; im Zweifel mit `\\*\\*` escapen oder anderes Symbol
verwenden, z. B. `†` statt `**`.)

### 6.3 Zweite Druck-Stelle: Z. 1385

In `js/print-md.js` gibt es eine zweite Stelle, die `_provisional`
verarbeitet (siehe `grep`-Ergebnis Z. 1385). Sonnet, bitte
**identisch ergänzen**: pro Row prüfen, ob `_sliderEstimate` gesetzt
ist, und entsprechend markieren. Wenn die dortige Stelle nicht direkt
`_warpFResSource` nutzt, sondern eine eigene fRes-basierte Vereinigung,
muß die Stufe-3-Logik dort ebenfalls eingezogen werden (analog zu
Abschnitt 3 dieser Anleitung). Bitte zuerst die Stelle anschauen,
dann entscheiden, ob nur Markierung oder auch Datenquelle ergänzt
werden muß.

---

## 7. Player-Status-Banner

In `js/freq-warp.js`, im Bereich der `pwStatus*`-Berechnung (Z. 1020–1025).

**Vorher:**
```js
if (statusText && stats.provisional > 0) {
  statusText += " " + t("pwStatusProvisional")
    .replace("{prov}", stats.provisional)
    .replace("{fin}", stats.finals);
}
```

**Nachher:**
```js
if (statusText && (stats.provisional > 0 || stats.sliderEst > 0)) {
  const parts = [];
  if (stats.provisional > 0) {
    parts.push(t("pwStatusProvisional")
      .replace("{prov}", stats.provisional)
      .replace("{fin}", stats.finals));
  }
  if (stats.sliderEst > 0) {
    parts.push(t("pwStatusSliderEst")
      .replace("{est}", stats.sliderEst));
  }
  statusText += " " + parts.join(" · ");
}
```

---

## 8. Neue i18n-Strings — nur Deutsch

In `i18n/de.js` ergänzen:

```js
fmrStatusSliderEst:    "🎚 Vor-Schätzung",
fmrSliderEstimateCount:"{n} Vor-Schätzung(en)",
audFmSliderEstNote:    "Mit ** markierte Werte sind Vor-Schätzungen aus dem Schieber-Modus und noch nicht durch den adaptiven Test bestätigt.",
pwStatusSliderEst:     "{est} davon Vor-Schätzung",
```

Achtung: `audFmSliderEstNote` enthält im Text doppelte ASCII-Sternchen
`**` — das ist im JS-String unkritisch, aber bei der Markdown-Ausgabe muß
Sonnet prüfen, daß der Text im Bericht **als Klartext** erscheint, nicht
als Fett-Auszeichnung. Falls Markdown den Text doch parsed, vor und nach
den Sternchen Backslash setzen (`\\*\\*` im JS-String) oder den Hinweis
mit einem anderen Symbol (z. B. `†`) versehen.

**Anführungszeichen-Check vor Versand:** jeden neuen String einmal per
Auge auf gerade Anzahl ASCII-`"` prüfen. Keine inneren ungeschnürten
`"`.

**CSS-Badge `fm-badge-slider`:** in `style.css` (oder dem zentralen CSS,
das die anderen `fm-badge-*`-Klassen definiert) eine neue Badge-Klasse
ergänzen. Vorschlag:

```css
.fm-badge-slider {
  background: #f3f4f6;
  color: #4b5563;
  border: 1px solid #d1d5db;
}
```

(Optik abstimmen mit den anderen `fm-badge-*`-Definitionen; nicht in eine
auffällige Farbe wie blau/grün — neutral grau paßt zur halbwegs vorläufigen
Datennatur.)

Sonnet, bitte die CSS-Datei suchen (`grep -rn "fm-badge-prov"`) und die
neue Klasse in derselben Datei in vergleichbarem Stil ergänzen.

---

## 9. Edge-Cases prüfen

- **Slider-Estimate für ausgeschlossene Elektrode** (`elExDur[i] !== null`
  oder `elSt[i] === 'mute'`): Soll in der Tabelle wie heute mit
  `excludedSkipped`-Hinweis erscheinen, nicht als Slider-Schätzung.
  Sonnet bitte sicherstellen, daß die Render-Reihenfolge in
  `renderFreqMatchResults` zuerst auf `exCI` prüft (`tr.style.opacity = "0.4"`-Block,
  Z. 430), erst danach auf `r` — der heutige Code macht das schon, also
  nur sicherstellen, daß keine Slider-Estimate-Zeile vor der
  Ausschluß-Prüfung erscheint.
- **Slider-Estimate für Elektrode, die im laufenden Track schon ≥2
  Umkehrungen hat**: wird durch die Stufen-Logik in `_warpFResSource`
  und `displayData`-Aufbau automatisch unterdrückt (in-progress hat
  Vorrang). Sonnet bitte mit einem manuellen Konsolen-Test
  verifizieren (siehe Akzeptanztest 9).
- **Doppelung im Chart**: falls Slider-Estimates und in-progress-Punkte
  jemals beide für dieselbe Elektrode an `drawFreqMatchChart` übergeben
  würden, sollten die in-progress gewinnen. Dies ist eine Folge der
  korrekten Quellen-Vereinigung — Sonnet bitte in der `displayData`
  oder im Chart-Builder kontrollieren.

---

## 10. SPEC und CODESTRUKTUR mitführen

### 10.1 `docs/spec/02b-freqmatch-adaptiv.md`

Im Abschnitt **„Anzeige im Reiter Meßergebnisse → Frequenzabgleich"** den
neuen Status ergänzen:

> **`slider-estimate`** (neu, BA 103): die Tabelle zeigt eine
> Slider-Vor-Schätzung an. Status-Badge „🎚 Vor-Schätzung" (graues
> Badge), Zeile kursiv. Konv./Lauf-Streuung/Residuum leer („—"). Im
> Chart als hohle graue Raute mit gestricheltem Ist-Strich. Sobald für
> die Elektrode ein adaptiver Track aktiv wird (≥0 Umkehrungen), tritt
> der Schätzung-Eintrag zugunsten von `in-progress` bzw. `in-progress-early`
> zurück.

Im Abschnitt **„Verhältnis zum bestehenden Slider-Modus"** den Satz
„Beide Modi schreiben dasselbe Cent-Offset-Feld pro Elektrode" entfernen
oder korrigieren: seit BA 102 schreibt der Slider-Modus in
`freqmatchAdaptive.sliderEstimates`, nicht in `fRes`.

### 10.2 `docs/CODESTRUKTUR.md`

Im `results.js`-Eintrag ergänzen:
- „Seit BA 103: `_fmrBuildSliderEntries(side)` als dritte Anzeige-Quelle
  (Slider-Vor-Schätzungen). `renderFreqMatchResults` baut `displayData`
  jetzt dreistufig (`fRes` > in-progress > slider-estimate). Status-Badge
  `slider-estimate` ergänzt."

Im `freq-warp.js`-Eintrag (suchen) ergänzen:
- „Seit BA 103: `_warpFResSource` integriert Slider-Estimates als dritte
  Stufe (Vorrang `fRes` > in-progress > slider-estimate). `_warpFResStats`
  liefert zusätzlich `sliderEst`-Zähler."

Im `chart.js`-Eintrag ergänzen:
- „Seit BA 103: `drawFreqMatchChart` rendert `fmStatus === 'slider-estimate'`
  als hohle graue Raute mit gestricheltem Ist-Strich."

Im `print-md.js`-Eintrag ergänzen:
- „Seit BA 103: `_audiologFmRowsForSide` und `_audiologFreqTable`
  markieren Slider-Estimates mit `**` und ergänzen den Fußnotenhinweis
  `audFmSliderEstNote`."

---

## 11. Akzeptanztest-Checkliste

Vorbereitung: BA 102 ist gebaut. Mind. eine Slider-Vor-Schätzung pro
Seite vorhanden. Player-Warp aktiv.

1. **Sub-Tab Meßergebnisse → Frequenzabgleich öffnen.** Erwartet: Die
   Elektroden mit Slider-Vor-Schätzung tauchen in der Tabelle auf, Status-
   Spalte zeigt graues Badge „🎚 Vor-Schätzung", Zeile ist kursiv, die
   Spalten Konv./Lauf-Streuung/Residuum stehen auf „—". Diff-Hz und
   Diff-Cent zeigen die ungefähren Werte aus der Slider-Stellung.
2. **Meta-Zeile prüfen.** Erwartet: Hinweis „N Vor-Schätzung(en)" am Ende
   der Meta-Zeile (zusätzlich zu eventuell „M laufend").
3. **Player → Frequenz-Warp aktivieren (Schieber `pWarpOn` an).** Erwartet:
   Im Status-Banner erscheint „... · {est} davon Vor-Schätzung" am Ende.
4. **Frequenz-Warp-Effekt hören (Player → Test-Sound abspielen).**
   Erwartet: Die Slider-Schätzungen werden in die Warp-Kurve einberechnet
   (der Klang verschiebt sich pro betroffener Elektrode in Richtung der
   Schätzung). Wenn der Effekt im Hörbereich auffällt, ist das Lese-
   Integration erfolgreich.
5. **Audiologen-Druck (Druck-Tab → Korrekturbericht generieren).**
   Erwartet: Frequenztabelle pro Seite. Zeilen mit Slider-Estimate sind
   mit `**` markiert; am Tabellenende erscheint Hinweistext
   „Mit ** markierte Werte sind Vor-Schätzungen …".
6. **Adaptiven Test starten und 2-3 Trials für eine Elektrode mit Slider-
   Estimate antworten.** Sobald der Track im Debug-Konsolen-Output 2
   Umkehrungen meldet (oder „in-progress" in der Tabelle erscheint):
   Erwartet: die Slider-Estimate-Zeile dieser Elektrode wird in der Tabelle
   **durch den `in-progress`-Eintrag ersetzt** (Badge „⏳ N Vergleiche",
   blau). Slider-Estimate-Zeilen anderer Elektroden bleiben.
7. **Player-Status-Banner während laufendem Test prüfen.** Erwartet:
   `{prov}`-Zahl steigt mit den aktiv werdenden Tracks, `{est}`-Zahl sinkt
   um die jeweilige Elektrode.
8. **Adaptive Lauf 1 für eine Elektrode konvergiert.** Erwartet: `fRes`
   bekommt finalen Eintrag (Status z. B. `converged`). Tabelle zeigt
   diesen statt der Slider-Estimate oder `in-progress`. Slider-Estimate
   für diese Elektrode bleibt in `sliderEstimates` gespeichert, taucht
   aber dank Vorrang nicht mehr in Anzeigen auf.
9. **Konsolen-Verifikation:**
   `_warpFResSource().filter(r => r._sliderEstimate).map(r => r.elIdx)` —
   liefert genau die Elektroden-Indizes, für die eine Slider-Estimate
   weder von einem `fRes`-Eintrag noch von einem aktiven Track abgedeckt
   ist.
10. **Chart-Inspektion:** Im Frequenzabgleich-Chart (Reiter Meßergebnisse)
    sind Slider-Estimate-Elektroden als graue Raute mit gestricheltem
    Ist-Strich erkennbar, klar verschieden von „voller blauer Punkt"
    (converged) und „hohler blauer Kreis mit ?" (in-progress-early).

---

## 12. Selbstprüfungs-Auftrag an Sonnet

Pro Akzeptanz-Kriterium (1–10) die Einschätzung **erfüllt / nicht erfüllt /
unklar** mit Datei- und Zeilenangabe melden, bevor die Fertig-Meldung
abgesetzt wird.

Zusätzlich prüfen:
- **State-Mutation:** `_fmrBuildSliderEntries` mutiert nichts am
  globalen State; reine Pseudo-Quelle. `_warpFResSource` baut bei jedem
  Aufruf eine neue Liste — keine versteckten Reassignments.
- **Edge-Case `in-progress-early`:** wenn ein Track 0–1 Umkehrungen hat
  (`in-progress-early`, `cent` ist 0/Platzhalter), darf die Slider-Estimate
  NICHT durchschlagen (sonst sähe man kurz nach Trial-Start einen widersprüchlichen
  Vor-Schätzungs-Wert obwohl der Track schon läuft). Die `covered`-Set-Logik
  in `_warpFResSource` schließt das aus — manuell verifizieren.
- **i18n-Anführungszeichen:** jeden neuen String einmal auf gerade
  `"`-Anzahl prüfen.
- **Schwellen-Konstanten:** in dieser Anleitung gibt es zwei klar
  unterschiedliche Vorrang-Regeln (1) `fRes` > Pseudo, (2)
  Pseudo-in-progress > Pseudo-slider. Beide müssen im Code explizit als
  zwei separate `covered`-Set-Erweiterungen erscheinen, nicht in einer
  zusammengefaßten Bedingung.
- **CSS-Badge-Klasse:** prüfen, daß `fm-badge-slider` tatsächlich
  definiert ist (sonst nimmt das Badge nur die generische `fm-badge`-Optik
  an, was optisch hässlich werden kann).
- **Druck-Doppelstelle (Z. 1385):** wurde tatsächlich angepasst, nicht
  übersehen.

---

## 13. Hinweis: Übersetzungen

Englisch, Französisch und Spanisch werden in einer **eigenen späteren
Mini-Anleitung** ergänzt. In dieser Bauanleitung **nicht** mitführen.

---

## 14. Verweis auf die nächste Bauanleitung

Nach BA 103 sind Slider-Vor-Schätzungen in allen Anzeigen sichtbar. **Aber
der adaptive Track nutzt sie noch nicht als Startwert** — er startet weiter
aus zufälligem ±100 cent. Das ist BA 104. Bis dahin spart die Slider-
Vor-Schätzung nur für die Anzeige etwas, nicht für die Test-Dauer.

Vor Beginn BA 104: BA 103 abnehmen lassen.
