# Bauanleitung 419 — Ergebnisgraph auf `FRQ_werte` umstellen

**Ziel-Version nach Build:** `0.5.419-beta`
**Betroffene Dateien:** `js/core.js`, `js/freq-warp.js`, `js/chart.js`,
`js/results.js`, `js/version.js`
**Kein i18n** (keine neuen/geänderten UI-Texte).

## Arbeitsweise (verbindlich)

Führe alle Änderungen **selbst** aus. Rufe **KEINE** Sub-Agenten/Task-Agenten
zur Parallelisierung auf — diese Bauanleitung ist ein zusammenhängender
Kontext, jede Stelle muss zur gemeinsamen Konvention passen.

Im Code **ausschließlich ASCII-Anführungszeichen** `"` und `'`.

---

## Hintergrund

Der Ergebnisgraph unter *Messergebnisse → Frequenzabgleich* (`drawFRQChart`
in `chart.js`) rechnet die Verschiebung heute **selbst** aus — und dabei
doppelt falsch (am Code + Konzept belegt, Architektur
`00-freqmatch-wertquelle-architektur.md`, Anwendungs-Konzept §11.2):

1. **Verteilung falsch:** Er benutzt den Anzeige-Umschalter (`aktivSide`) als
   Modus. Richtig ist der **Referenzmodus** (im Test bewegte Seite).
2. **Richtung falsch:** Er zeigt die Warp-Richtung statt der **gehörten**
   (`gehoert = -warp`).

Beide verschwinden, wenn der Graph seine Werte aus der zentralen Wertquelle
`FRQ_werte` (BA 418) zieht statt selbst zu rechnen. Diese BA ist der **erste
Konsument**, der umgestellt wird (Konzept-Beschluss „erst die Funktion, dann
Konsumenten einzeln").

**Erwartete sichtbare Änderung — das ist der Fix, kein Fehler:** Messpunkte
wandern in die tatsächlich gehörte Richtung. Beispiel E1 (rechtes Ohr hört
tiefer): Soll-Frequenz rutscht von heute fälschlich ~141 Hz auf ~104 Hz, der
Messpunkt von oberhalb auf unterhalb der Nulllinie.

Zusätzlich in dieser BA:
- Der Ausgrau-/✕-Status wird **seitenlos** (eine Elektrode, die auf *einer*
  Seite nicht testbar ist, gilt beidseitig als „nicht Teil der Messung").
- `FRQ_werte` liefert das **Residuum** mit (Wertquelle-Architektur §7.2,
  korrigiert 2026-07-01).
- Das Mapping „Referenzmodus → korrigierte Seite" wird als **ein geteilter
  Helfer** herausgezogen (bisher inline in der Player-Vorbelegung dupliziert).
- Ein vorbestehender Fehler in der „nicht wahrnehmbar"-Markierung wird an der
  Wurzel behoben.

---

## Schritt 1 — `js/core.js`: geteilter Mapping-Helfer

Das Mapping „Referenzmodus (im Test bewegte Seite) → korrigierte Seite" steckt
heute **inline** in `pApplyWarpModeDefaultFromFm` (`freq-warp.js`). Zieh es als
geteilten Helfer nach `core.js` (lädt zuerst; aus mehreren Modulen gerufen →
`FRQ_`-Präfix).

Füge die Funktion **direkt vor** dem Kommentarblock zu `FRQ_werte` ein
(vor der Zeile `// BA418: Zentrale Frequenzabgleich-Wertquelle.`):

```js
// BA419: Uebersetzt den Referenzmodus (im Test bewegte Seite) in den
// "korrigierte Seite"-Modus, den FRQ_werte/FRQ_seitenWerte erwarten. EINE
// geteilte Stelle fuer alle Referenzmodus-Konsumenten (Ergebnis-Graph,
// spaeter Ergebnis-Tabelle, Player-Warp-Default). Mapping nach
// Nutzer-Beschluss BA417: left<->right getauscht, symmetric bleibt.
function FRQ_modusVonReferenzmodus(rm) {
  if (rm === "left")      return "right";
  if (rm === "right")     return "left";
  if (rm === "symmetric") return "symmetric";
  return "left";
}
```

---

## Schritt 2 — `js/core.js`: `FRQ_werte` liefert das Residuum

In `FRQ_werte`, in der Elektroden-Schleife. **Vorher** (die Basis-Werte am
Schleifenanfang):

```js
  for (var i = 0; i < n; i++) {
    var r = measured[i];
    var gemessen = !!(r && r.cent != null);
    var deaktiviert = (FRQ_electrodeStatusBoth(i) !== "testable");

    // Nominelle (eingetragene) Frequenz je Seite -- keine Messgroesse,
    // existiert immer.
```

**Nachher** (eine Zeile `residuum` ergänzt):

```js
  for (var i = 0; i < n; i++) {
    var r = measured[i];
    var gemessen = !!(r && r.cent != null);
    var deaktiviert = (FRQ_electrodeStatusBoth(i) !== "testable");
    // Residuum (Mess-Unsicherheit in cent) gehoert in die Wertquelle
    // (Architektur 00-freqmatch-wertquelle 7.2) -- formunabhaengig, aus dem
    // fRes-Eintrag durchgereicht. null, wenn kein Eintrag existiert.
    var residuum = r ? (r.fmResiduum != null ? r.fmResiduum
                       : (r.fmResidual != null ? r.fmResidual : null)) : null;

    // Nominelle (eingetragene) Frequenz je Seite -- keine Messgroesse,
    // existiert immer.
```

Und im `entry`-Objekt-Literal (wenige Zeilen darunter) das Feld `residuum`
ergänzen. **Vorher:**

```js
    var entry = {
      elIdx: i,
      gemessen: gemessen,
      deaktiviert: deaktiviert,
      left: left,
      right: right
    };
```

**Nachher:**

```js
    var entry = {
      elIdx: i,
      gemessen: gemessen,
      deaktiviert: deaktiviert,
      residuum: residuum,
      left: left,
      right: right
    };
```

Das Feld ist **formunabhängig** (kommt bei `roh`/`warp`/`gehoert` gleich mit) —
nicht in einen der Form-Zweige packen.

---

## Schritt 3 — `js/freq-warp.js`: Player-Vorbelegung auf den Helfer umstellen

Verhaltensneutral — das inline-Mapping durch den Helfer aus Schritt 1
ersetzen. **Vorher** (`pApplyWarpModeDefaultFromFm`, ~Z. 1316):

```js
function pApplyWarpModeDefaultFromFm() {
  if (_pPlayerWarpDefaultApplied) return;
  _pPlayerWarpDefaultApplied = true;
  var rm = (typeof frq_referenzmodus === "function") ? frq_referenzmodus() : "right";
  // referenzmodus = welche Seite im Test der veraenderbare Ton war.
  // Default-Warp: Mapping nach Nutzer-Beschluss (BA417).
  var mode = "left";
  if (rm === "left")            mode = "right";
  else if (rm === "right")      mode = "left";
  else if (rm === "symmetric")  mode = "symmetric";
  pWarpMode = mode;
  var sel = document.getElementById("plWarpModeSelect");
  if (sel) sel.value = pWarpMode;
}
```

**Nachher:**

```js
function pApplyWarpModeDefaultFromFm() {
  if (_pPlayerWarpDefaultApplied) return;
  _pPlayerWarpDefaultApplied = true;
  var rm = (typeof frq_referenzmodus === "function") ? frq_referenzmodus() : "right";
  // referenzmodus = welche Seite im Test der veraenderbare Ton war.
  // Mapping in den korrigierte-Seite-Modus jetzt zentral (BA419).
  pWarpMode = FRQ_modusVonReferenzmodus(rm);
  var sel = document.getElementById("plWarpModeSelect");
  if (sel) sel.value = pWarpMode;
}
```

---

## Schritt 4 — `js/chart.js`: Graph zieht seine Werte aus `FRQ_werte`

Das ist der Kern. Ersetze den Werte-Aufbau in `drawFRQChart`. **Vorher**
(ab `// Bezug fuer Graph-X-Achse ...`, ~Z. 375 bis zum Ende der
`allEls`-Schleife ~Z. 413):

```js
  // Bezug fuer Graph-X-Achse und Vorzeichen = aktive (angezeigte) Seite
  const aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  const nCi    = sideData[aktivSide].nEl;
  const measuredByIdx = {};
  for (const r of fResData) measuredByIdx[r.elIdx] = r;

  // Y-Verschiebung der aktiven Seite aus kanonischem cent (eine Wertquelle).
  // cent>0 = rechts hoeher; aktive Seite 'right' -> +cent, 'left' -> -cent.
  const _dCentFor = (cent) => {
    if (cent == null) return null;
    const sw = FRQ_seitenWerte(cent, aktivSide);
    return (aktivSide === "left") ? sw.csL : sw.csR;
  };

  // Liste aller Elektroden (alle bekommen mindestens einen Ist-Strich)
  const allEls = [];
  for (let i = 0; i < nCi; i++) {
    const exCI = sideData[aktivSide].elExDur[i] !== null || sideData[aktivSide].elSt[i] === 'mute';
    const hzIst = withSide(aktivSide, () => FRQ_implantatEffektiv(i));
    const r = measuredByIdx[i];
    const notPercFlag = !!notPerc[aktivSide + ':' + i];
    const dc = r && r.cent != null ? _dCentFor(r.cent) : null;
    const hzRef = r && r.cent != null ? FRQ_refHzForMode(r.elIdx) : null;
    allEls.push({
      elIdx: i,
      elNum: dEN(i, aktivSide),
      hzIst: hzIst,
      cIst:  hzToCt(hzIst),
      hzSoll: hzRef != null && dc != null ? hzRef * Math.pow(2, dc / 1200) : null,
      cSoll:  hzRef != null && dc != null ? hzToCt(hzRef) + dc : null,
      dCent:  dc,
      isMeasured: !!r,
      isExcluded: exCI,
      isNotPerceivable: notPercFlag,
      fmStatus:   r ? (r.fmStatus   || 'converged') : null,
      fmResidual: r ? (r.fmResiduum != null ? r.fmResiduum : (r.fmResidual || 0)) : null,
      r: r,
    });
  }
```

**Nachher:**

```js
  // Anzeige-Seite (X-Achsenbezug) = aktive (angezeigte) Seite -- der
  // LINKS/RECHTS-Umschalter. Die VERTEILUNG der Verschiebung kommt dagegen
  // aus dem Referenzmodus (im Test bewegte Seite), NICHT aus dem Umschalter;
  // dazu wird er in den "korrigierte Seite"-Modus fuer FRQ_werte uebersetzt.
  const aktivSide = (typeof activeSide === "string") ? activeSide : "right";
  const measuredByIdx = {};
  for (const r of fResData) measuredByIdx[r.elIdx] = r;

  // EINE Wertquelle (BA419): FRQ_werte liefert je Elektrode fuer beide Seiten
  // die gehoerte Situation (nominell/gehoert/Verschiebung) + Residuum + das
  // "nicht Teil der Messung"-Flag. Der Graph rechnet daraus nur noch seine
  // Achsen-/Pixel-Positionen, keine Frequenz-Ableitung mehr selbst.
  // Form 'gehoert', invertieren=false (Mess-Reiter kennt kein NH-Sim).
  const modus = FRQ_modusVonReferenzmodus(frq_referenzmodus());
  const werte = FRQ_werte("gehoert", modus, false);

  // Liste aller Elektroden (alle bekommen mindestens einen Ist-Strich).
  // Iteration ueber die Wertquelle; der Status ("hat Eintrag", fmStatus)
  // kommt weiter aus dem gespeicherten Ergebnis (measuredByIdx).
  const allEls = [];
  for (const wr of werte) {
    const i = wr.elIdx;
    const seite = wr[aktivSide];          // angezeigte Seite
    const r = measuredByIdx[i];           // Ergebnis-Eintrag = Status-Ebene
    const hzIst  = seite.nominellHz;
    const hzSoll = seite.gehoertHz;       // null wenn ungemessen
    const dc     = seite.shiftCent;       // gehoerte Verschiebung, null wenn ungemessen
    allEls.push({
      elIdx: i,
      elNum: dEN(i, aktivSide),
      hzIst: hzIst,
      cIst:  hzToCt(hzIst),
      hzSoll: hzSoll,
      cSoll:  hzSoll != null ? hzToCt(hzSoll) : null,
      dCent:  dc,
      isMeasured: !!r,
      isExcluded: wr.deaktiviert,         // seitenlos: auf mind. einer Seite nicht testbar
      isNotPerceivable: !!(r && r.fmStatus === "not-perceivable"),
      fmStatus:   r ? (r.fmStatus || "converged") : null,
      fmResidual: wr.residuum != null ? wr.residuum : 0,
      r: r,
    });
  }
```

**Wichtige Punkte (nicht abweichen):**
- `isMeasured` bleibt `!!r` (Ergebnis-Eintrag existiert) — **nicht** durch
  `wr.gemessen` ersetzen. Sonst verlieren „nicht wahrnehmbar" und „in Arbeit"
  ihre Marker (die haben einen Eintrag, aber kein `cent`).
- `isNotPerceivable` kommt jetzt **direkt aus dem Eintrag** (`r.fmStatus`) —
  das ersetzt den bisherigen, faktisch nie ausgelösten `opts.notPerceivable`-
  Pfad (Schritt 5).
- `isExcluded` ist jetzt `wr.deaktiviert` (seitenlos) statt der bisherigen
  Prüfung nur auf der aktiven Seite.

### Schritt 4b — den toten `notPerc`-Lokal entfernen

Weiter oben in `drawFRQChart` (~Z. 340) steht:

```js
  const notPerc = opts.notPerceivable || {};
```

**Diese Zeile ersatzlos löschen.** `notPerc` wird nach Schritt 4 nirgends mehr
gelesen (Strukturprinzip 7: abgelösten Pfad im selben Schritt entfernen).

---

## Schritt 5 — `js/results.js`: `notPerceivable`-Übergabe entfernen

Der aufrufende Code baute eine Liste und übergab sie als Nachschlage-Objekt —
der Fehler, durch den die Markierung nie erschien. Nicht mehr nötig, weil der
Graph den Status jetzt selbst aus dem Eintrag liest. **Vorher** (~Z. 445):

```js
  const cv = document.getElementById("FRQ_resultsChart");
  if (cv) {
    const notPerc = displayData.filter(function(r) { return r.fmStatus === 'not-perceivable'; })
                               .map(function(r) { return r.elIdx; });
    drawFRQChart(
      cv,
      displayData,
      { notPerceivable: notPerc }
    );
```

**Nachher:**

```js
  const cv = document.getElementById("FRQ_resultsChart");
  if (cv) {
    drawFRQChart(cv, displayData);
```

(Der Rest des `if (cv) { … }`-Blocks — Tooltip-Listener — bleibt unverändert.)

---

## Schritt 6 — `js/version.js`

```js
const APP_VERSION = "0.5.419-beta";
```

---

## Struktur-Akzeptanz (grep, blind kontrollierbar)

Nach dem Build müssen diese greps das erwartete Ergebnis liefern:

- `grep -n "FRQ_seitenWerte" js/chart.js` → **leer** (der Graph rechnet die
  Verteilung nicht mehr selbst).
- `grep -n "_dCentFor" js/chart.js` → **leer**.
- `grep -rn "notPerceivable" js/` → **leer** (Wurzel entfernt).
- `grep -n "FRQ_modusVonReferenzmodus" js/core.js js/chart.js js/freq-warp.js`
  → **drei** Treffer: Definition in `core.js`, Nutzung in `chart.js` und
  `freq-warp.js`.
- `grep -n 'mode = "right"' js/freq-warp.js` → **leer** (inline-Mapping in
  `pApplyWarpModeDefaultFromFm` ist weg).
- `grep -n "residuum" js/core.js` → Treffer in `FRQ_werte` (Feld gesetzt).

---

## Akzeptanztest (Nutzer, klick-für-klick)

1. **Tab Messungen → Sub-Tab Frequenzabgleich → Ergebnisse ansehen.**
   Für eine Elektrode, die tiefer gehört wird (z. B. E1 beim Nutzer): Der
   schwarze **Soll**-Strich liegt jetzt **links** vom grauen Ist-Strich
   (tiefere Frequenz), der blaue Messpunkt **unterhalb** der Nulllinie.
   *(Vorher lag er fälschlich rechts/oben — die Umkehr ist der eigentliche
   Fix.)*
2. **LINKS/RECHTS-Umschalter oben umschalten.** Der Graph zeigt die jeweils
   gewählte Seite. Die Verteilung folgt der **Referenzeinstellung des Tests**
   (Dropdown im Test-Header), nicht dem Umschalter: Auf der im Test bewegten
   Seite steht keine Verschiebung, auf der Gegenseite die Korrektur.
3. **Ausgeschlossene/stumme Elektroden** (z. B. E12 rechts): erscheinen jetzt
   auf **beiden** angezeigten Seiten als graues ✕ auf der Nulllinie.
4. **Falls eine Messung „nicht wahrnehmbar" ergab:** Die betroffene Elektrode
   zeigt jetzt das **rote Kästchen mit ✕** (vorher erschien es nie).
5. **Residuum-Anzeige unverändert:** Elektroden mit Restunsicherheit zeigen
   weiter den senkrechten T-Balken und den amberfarbenen Streifen.
6. **Player-Tab:** Der voreingestellte Warp-Modus nach Laden einer Messung ist
   **unverändert** gegenüber vorher (Schritt 3 ist rein struktureller Umbau).
7. **Tooltip** beim Überfahren eines Messpunkts funktioniert wie zuvor.

---

## Selbstprüfungs-Auftrag an Sonnet

Gehe **vor** der Fertigmeldung jeden Struktur-grep und jeden Akzeptanzpunkt
einzeln durch und melde für jeden: **erfüllt / nicht erfüllt / unklar**, mit
Datei- und Zeilenangabe. Prüfe besonders:

- `isMeasured` ist noch `!!r` (nicht `wr.gemessen`).
- Der Graph liest keine Frequenz mehr selbst aus `FRQ_seitenWerte` /
  `FRQ_refHzForMode` / `withSide(...FRQ_implantatEffektiv...)` — alle
  Frequenz-/Verschiebungswerte kommen aus `wr` (`FRQ_werte`). Reine
  Achsen-Skalierung (`hzToCt`) darf im Graph bleiben.
- `pApplyWarpModeDefaultFromFm` liefert für `rm='right'` weiter `'left'`, für
  `'left'` → `'right'`, für `'symmetric'` → `'symmetric'` (verhaltensneutral).

Markierst du etwas als **unklar**, ist das ein Signal zur Rückfrage, nicht zur
stillen Annahme.
