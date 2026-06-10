# Bauanleitung 68 — Kurven-Tab: Warp-Bewußtsein + permanenter Hinweistext

## Ziel

Im **Kurven-Tab** (sichtbarer Tab „Kurven", DOM `panel-levels`,
Hauptmodul `js/levels.js`) sollen sowohl die **x-Achse des Chart-
Diagramms** als auch die **Kurvenberechnung** (`calcPresetCurve`) dem
**Frequenz-Warping** folgen. Bei aktivem Warping verschieben sich
also die Elektroden-Positionen auf der x-Achse, und die geometrischen
Kurvenfunktionen (tilt, scurve, pivot, gauss) rechnen mit den
gewarpten Wahrnehmungs-Frequenzen.

Außerdem erscheint im Kurven-Tab ein **permanenter** Hinweistext
unter dem Chart-Canvas:

> Die Auswirkung der Kurven pro Elektrode verschiebt sich leicht bei
> aktiviertem Frequenz-Warping.

Damit das mit minimalem Refactor erreichbar ist und alle abhängigen
Pfade (Kurven, Player, später Archiv-Druck) auf dieselbe Logik
zugreifen, kommt eine **zentrale Hilfsfunktion** `effFreqDisplay(i,
side)` in `state-side.js` hinzu. Sie liefert die effektive
Anzeige-/Berechnungs-Frequenz pro Elektrode unter Berücksichtigung
des aktuellen Warp-Zustands (`pWarpOn`, `pWarpMode`, `pWarpStrength`,
`fRes`).

**Wichtig — andere Tabs bleiben warp-frei:**
- Tests (`test.js`, `audio.js`, `freqmatch.js`): nutzen weiterhin
  `effFreq`. Test-Töne dürfen nicht gewarpt werden, weil die
  Elektroden physisch nicht verschoben werden.
- Schieber-Tab (`levels-tab.js`): seit BA 66 elektrodennummern-
  basiert ohne Frequenz-Bezug.
- Meßergebnisse Loudness/LR (`drawChart`/`lrDrawChart`): seit BA 67
  elektrodennummern-basiert mit Hz-Beschriftung aus `effFreq`.
- Implantat-Tabelle (`freq-table.js`): bleibt physikalisch (Cent-
  Spalte aus BA 63 unverändert).
- MAPLAW: bleibt vorerst auf hartcodierten MED-EL-Standardfrequenzen
  (siehe IDEEN.md).

Player kommt in **Bauanleitung 69** (analog), Archiv-Druck in
**Bauanleitung 71**.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.68-beta";
```

---

## 2. Zentrale Hilfsfunktion `effFreqDisplay` in state-side.js

In `js/state-side.js` direkt **unter** der bestehenden Funktion
`effFreq` (Z. 21–23) eine neue Funktion einfügen:

```js
// Effektive Anzeige-/Berechnungs-Frequenz unter Berücksichtigung des
// aktuellen Frequenz-Warping-Zustands. Verwendet von Kurven-Tab
// (drawLvChart, calcPresetCurve) und Player (pDrawEQ, pBuildEQ) für
// die Cent-basierte x-Achse und die Frequenz-Interpolation.
//
// Andere Module (Tests, Audio-Pfad, Schieber-Tab, Meßergebnisse,
// Implantat-Tabelle, MAPLAW) verwenden weiterhin effFreq() — die
// Elektroden bewegen sich physisch nicht, Warp ist eine
// Anzeige-/Berechnungs-Schicht für die wahrgenommene Frequenz.
//
// Parameter side optional: wenn gesetzt, wird temporär die andere
// Seite gebunden (für seitenspezifische Aufrufe wie im Druck).
function effFreqDisplay(i, side) {
  const baseHz = (side != null && typeof withSide === "function")
    ? withSide(side, function () { return effFreq(i); })
    : effFreq(i);
  if (typeof pWarpOn === "undefined" || !pWarpOn) return baseHz;
  if (typeof fRes === "undefined" || !fRes || !fRes.length) return baseHz;
  if (typeof buildWarpPoints !== "function" ||
      typeof centShift !== "function") return baseHz;
  const points = buildWarpPoints(fRes, pWarpMode);
  const sideKey = side || activeSide;
  const str = (typeof pWarpStrength === "number" ? pWarpStrength : 100) / 100;
  const cs = centShift(baseHz, sideKey, points) * str;
  return baseHz * Math.pow(2, cs / 1200);
}
```

**Hinweis zur Reihenfolge:** `state-side.js` lädt vor `freq-warp.js`,
d.h. zum Zeitpunkt der Funktionsdefinition stehen `pWarpOn`,
`buildWarpPoints` etc. noch **nicht** zur Verfügung. Das ist okay,
weil `effFreqDisplay` nur **zur Laufzeit** (in Render-Calls) aufgerufen
wird — die `typeof`-Guards greifen dann. Beim allerersten Render vor
Warp-Init ist das Verhalten identisch zu `effFreq`.

---

## 3. `calcPresetCurve` (levels.js) auf `effFreqDisplay` umstellen

In `js/levels.js`, `calcPresetCurve` (Z. 5–98) alle `effFreq(...)`-
Aufrufe in den vier geometrischen Kurvenzweigen **tilt, scurve,
pivot, gauss** (Z. 14, 15, 22, 31, 40, 51) durch `effFreqDisplay(...)`
ersetzen. Außerdem im **speech**-Zweig (Z. 81).

### 3a. Span-Berechnung (Z. 14–15)

**Vorher:**

```js
  const fMin = effFreq(act[0]);
  const fMax = effFreq(act[act.length - 1]);
```

**Nachher:**

```js
  const fMin = effFreqDisplay(act[0]);
  const fMax = effFreqDisplay(act[act.length - 1]);
```

### 3b. Tilt-Zweig (Z. 21–22)

**Vorher:**

```js
  if (pr.type === "tilt") {
    for (const i of act) {
      const xC = hzToCent(effFreq(i)) - ctrC;
      c[i] = xC / halfSpanC;
    }
```

**Nachher:**

```js
  if (pr.type === "tilt") {
    for (const i of act) {
      const xC = hzToCent(effFreqDisplay(i)) - ctrC;
      c[i] = xC / halfSpanC;
    }
```

### 3c. Scurve-Zweig (Z. 30–31)

**Vorher:**

```js
    for (const i of act) {
      const x = (hzToCent(effFreq(i)) - ctrC) / halfSpanC;
      c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    }
```

**Nachher:**

```js
    for (const i of act) {
      const x = (hzToCent(effFreqDisplay(i)) - ctrC) / halfSpanC;
      c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
    }
```

### 3d. Pivot-Zweig (Z. 39–40)

**Vorher:**

```js
    for (const i of act) {
      const d = Math.abs(hzToCent(effFreq(i)) - ctrC) / halfSpanC;
      c[i] = -(d * d * 2 - 1);
    }
```

**Nachher:**

```js
    for (const i of act) {
      const d = Math.abs(hzToCent(effFreqDisplay(i)) - ctrC) / halfSpanC;
      c[i] = -(d * d * 2 - 1);
    }
```

### 3e. Gauß-Zweig (Z. 50–51)

**Vorher:**

```js
    for (const i of act) {
      const dC = hzToCent(effFreq(i)) - ctrC;
      c[i] = Math.exp(-0.5 * Math.pow(dC / sigC, 2));
    }
```

**Nachher:**

```js
    for (const i of act) {
      const dC = hzToCent(effFreqDisplay(i)) - ctrC;
      c[i] = Math.exp(-0.5 * Math.pow(dC / sigC, 2));
    }
```

### 3f. Speech-Zweig (Z. 81)

**Vorher:**

```js
    const effF = Array.from({ length: n }, (_, i) => effFreq(i));
```

**Nachher:**

```js
    const effF = Array.from({ length: n }, (_, i) => effFreqDisplay(i));
```

(Die SII-Gewichtung folgt damit ebenfalls den gewarpten
Wahrnehmungs-Frequenzen — konsequent.)

Die Zweige **bassboost** (Z. 58 ff.), **highboost** (Z. 69 ff.) und
**volume** (Z. 89 ff.) bleiben **unverändert** — sie arbeiten
elektrodennummern-basiert, nicht frequenzbasiert.

---

## 4. `drawLvChart` (levels.js) auf `effFreqDisplay` umstellen

In `js/levels.js`, `drawLvChart` (Z. 322–438).

### 4a. buildCentAxis-Aufruf mit hzGetter (Z. 358)

**Vorher:**

```js
  const axis = buildCentAxis(act, pad.left, pW);
```

**Nachher:**

```js
  const axis = buildCentAxis(act, pad.left, pW, function (i) {
    return effFreqDisplay(i);
  });
```

(Der Default-hzGetter in `buildCentAxis` ist `effFreq` — explizites
Übergeben von `effFreqDisplay` setzt den Warp-Bezug.)

### 4b. Label-Schleife unverändert

Die Hz- und Cent-Beschriftung unter der x-Achse (Z. 411–427) liest
bereits aus `axis.hzArr[j]` und `axis.centArr[j]`. Da `buildCentAxis`
diese Arrays jetzt mit `effFreqDisplay` befüllt, ist nichts weiter zu
tun.

### 4c. Tooltip-Hitboxes unverändert

`cv._axisHits` (Z. 429–435) verwendet ebenfalls `axis.hzArr[j]` und
`axis.centArr[j]` — wandert automatisch mit.

---

## 5. Permanenter Hinweistext im Kurven-Tab

### 5a. HTML-Eintrag in index.html

In `index.html` im Block `<div class="card lv-chart-card">`
(Z. 836 ff.) direkt **nach** `<div class="lv-chart-wrap">…</div>`
(Z. 891–893), also vor dem schließenden `</div>` der Karte (Z. 894),
eine neue Hinweis-Zeile einfügen:

**Vorher (Auszug Z. 891–894):**

```html
          <div class="lv-chart-wrap">
            <canvas id="lvChartCv"></canvas>
          </div>
        </div>
```

**Nachher:**

```html
          <div class="lv-chart-wrap">
            <canvas id="lvChartCv"></canvas>
          </div>
          <div
            id="lvChartWarpHint"
            data-t="lvChartWarpHint"
            style="margin-top: 6px; font-size: 0.82em; color: #888;"
          ></div>
        </div>
```

(Der Hinweistext ist **permanent** sichtbar, unabhängig vom
Warp-Zustand — gemäß Konzeptentscheidung. Begründung: er informiert
über das Verhalten der Kurven, das auch bei ausgeschaltetem Warp
relevantes Hintergrundwissen darstellt.)

### 5b. i18n-Eintrag in i18n/de.js

In `i18n/de.js` im `Object.assign(L.de, { ... })`-Block einen neuen
Schlüssel ergänzen (sinnvolle Position: in der Nähe anderer
`lvChart*`-Schlüssel, alphabetisch oder thematisch):

```js
lvChartWarpHint:
  "Die Auswirkung der Kurven pro Elektrode verschiebt sich " +
  "leicht bei aktiviertem Frequenz-Warping.",
```

`en.js`, `fr.js`, `es.js` **nicht** anfassen — fehlende Schlüssel
fallen auf Deutsch zurück. Die Übersetzungen kommen in einer
späteren Mini-Anleitung.

### 5c. Kein zusätzlicher applyLang-Aufruf nötig

`applyLang()` läuft beim Laden und bei Sprachwechsel automatisch alle
`[data-t="..."]`-Elemente durch. Da das neue Div ein
`data-t="lvChartWarpHint"`-Attribut trägt, wird es automatisch
befüllt — keine zusätzliche Verdrahtung in `init.js` oder anderswo
nötig.

---

## 6. Re-Render des Kurven-Tabs bei Warp-Toggle

Damit die x-Achse und die Kurven sich **live** anpassen, wenn der
User im Player den Warp-Toggle umschaltet oder die Strength ändert,
muß `drawLvChart` bei diesen Ereignissen aufgerufen werden.

### 6a. Bei Warp-Toggle (init.js)

In `js/init.js` den bestehenden Warp-Toggle-Handler suchen (laut
grep liegt er bei Z. 418 mit `pWarpOn = !pWarpOn;`). Direkt am
Ende des Handlers (vor dem schließenden `})` der Listener-Funktion)
folgende Zeilen ergänzen, falls nicht bereits vorhanden:

```js
    if (typeof drawLvChart === "function") drawLvChart();
```

(Falls der Handler bereits `pUpdEQ()` oder ähnliche
UI-Aktualisierungen aufruft, hier in die gleiche Sequenz einfügen.
Wenn die genaue Stelle unklar ist, **Rückfrage stellen** — nicht
raten.)

### 6b. Bei Warp-Strength-Änderung (init.js, Z. 447 ff. und 464 ff.)

In den beiden Stellen, an denen `pWarpStrength` aktualisiert wird
(grep auf `pWarpStrength` in init.js), analog die Zeile

```js
    if (typeof drawLvChart === "function") drawLvChart();
```

ergänzen.

### 6c. Bei Warp-Mode-Änderung (init.js)

Falls es einen Handler für `pWarpMode`-Änderung gibt: ebenfalls
ergänzen. (Grep: `pWarpMode =` in `init.js`.)

### 6d. Bei JSON-Load (init.js Z. ~636)

Im Laden-Pfad, der `pWarpOn = d.pWarpOn;` setzt, am Ende des
Lade-Blocks ebenfalls `drawLvChart()` aufrufen, falls die Funktion
nicht bereits über einen anderen Pfad (z. B. `bindActiveSide`)
getriggert wird.

**Hinweis:** falls die Stellen schwer zu finden sind oder unklar
ist, ob die Verdrahtung schon bestand, **mit grep prüfen** und
notfalls dem User rückfragen. Stiller Trial-and-Error in init.js ist
riskant — die Datei ist groß.

---

## 7. Doku-Updates

### 7a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`state-side.js`** (Z. 127) die neue Funktion
`effFreqDisplay` in der Aufzählung der UI-Helper ergänzen,
sinngemäß:

> UI-Helper: `updSideButtons`, `updFClearBtn`, `dEN`, `dENPrefix`,
> `effFreq`, **`effFreqDisplay`** (effFreq + Warp-Shift gemäß
> `pWarpOn`/`pWarpMode`/`pWarpStrength` und `fRes`; verwendet vom
> Kurven-Tab und Player für Anzeige und Frequenz-Interpolation —
> Audio-Pfad, Tests, Schieber, Meßergebnisse und MAPLAW nutzen
> weiterhin `effFreq`), `fRes`.

Im Eintrag zu **`levels.js`** (Z. 141): `calcPresetCurve` und
`drawLvChart` verwenden seit Bauanleitung 68 `effFreqDisplay` statt
`effFreq` für die Frequenz-basierte Berechnung — ergänzen.

Im **Datenfluss-Block** „Preset-Berechnung" (Z. ~344–357) den
Hinweis ergänzen, daß bei aktivem Frequenz-Warping die geometrischen
Kurven auf den **gewarpten Wahrnehmungs-Frequenzen** der Elektroden
rechnen (über `effFreqDisplay`). Bass-/High-Boost und Volume bleiben
unverändert elektrodennummern-basiert.

### 7b. `docs/spec/05-kurven.md`

Im Abschnitt zur Kurvenberechnung einen Satz ergänzen, sinngemäß:

> Bei aktivem Frequenz-Warping (Player-Toggle) folgen die
> geometrischen Kurven (tilt, scurve, pivot, gauss) und die SII-
> Sprachgewichtung den **gewarpten Wahrnehmungs-Frequenzen** der
> Elektroden. Die x-Achse des Charts verschiebt sich entsprechend.
> Bass-/High-Boost und Volume sind elektrodennummern-basiert und
> ändern sich durch Warping nicht.
>
> Unter dem Chart steht ein permanenter Hinweistext: „Die Auswirkung
> der Kurven pro Elektrode verschiebt sich leicht bei aktiviertem
> Frequenz-Warping."

---

## 8. Akzeptanztest (Klick-für-Klick)

**Voraussetzung:** Frequenzabgleich-Daten (`fRes`) müssen vorhanden
sein, sonst läßt sich Warp nicht sinnvoll aktivieren. Wenn nötig
einen Frequenzabgleich-Test durchführen oder eine JSON-Datei laden,
die solche Daten enthält.

1. **App neu laden** (Cache-Bust). Tab „Kurven" öffnen, **Warping
   im Player aus**.
   **Erwartet:** Chart sieht aus wie vor dem Build — Elektroden-
   Positionen unverändert. Unter dem Canvas ein **kleiner grauer
   Hinweistext**: „Die Auswirkung der Kurven pro Elektrode
   verschiebt sich leicht bei aktiviertem Frequenz-Warping."

2. **Pivot aktivieren**, Stärke +10. Scheitel-Position merken.

3. **Tab „Player" öffnen → Frequenz-Warping einschalten**
   (Strength 100 %, var_side-Modus).

4. **Zurück zu Tab „Kurven".**
   **Erwartet:** x-Achsen-Positionen einzelner Elektroden haben
   sich **sichtbar verschoben**. Pivot-Scheitel sitzt jetzt
   geringfügig an anderer Stelle (weil sich die effektiven Cent-
   Positionen verschoben haben). Hz-Werte unter der x-Achse zeigen
   die **gewarpten** Werte.

5. **Warp-Strength** im Player auf 50 % reduzieren.
   **Erwartet:** Cent-Verschiebung halbiert sich, Chart bewegt sich
   live mit.

6. **Warp im Player ausschalten.**
   **Erwartet:** Chart kehrt zurück zum Ausgangszustand. Hz-Werte
   wieder die ursprünglichen.

7. **Gauß aktivieren**, Stärke +5, Breite 1200 ¢. Mit/ohne Warp
   vergleichen.
   **Erwartet:** Gauß-Buckel verschiebt sich proportional zur
   geänderten Cent-Geometrie.

8. **Bass-Boost / High-Boost / Volume** aktivieren.
   **Erwartet:** Mit/ohne Warp **kein** Unterschied (diese Kurven
   sind elektrodennummern-basiert).

9. **Speech (SII)** aktivieren.
   **Erwartet:** Mit Warp leichte Verschiebung des SII-Gewichts,
   weil die Speech-Berechnung auf `effFreqDisplay` umgestellt
   wurde.

10. **Schieber-Tab** öffnen (Quervergleich).
    **Erwartet:** Mit/ohne Warp **keine** x-Achsen-Verschiebung
    dort (BA 66 Rückbau gilt). Die dort gezeichneten Stack-Anteile
    (wenn `lvTabShowCurves` aktiv) ändern sich aber **numerisch
    geringfügig**, weil die Kurven sich ja in der Berechnung
    verschoben haben.

11. **Tests** (Loudness-Test, Stereo-Balance, Frequenzabgleich) bei
    aktivem Warp starten.
    **Erwartet:** Test-Töne klingen unverändert (Warp-frei). UI
    während des Tests zeigt unveränderte Hz-Werte.

12. **JSON speichern und neu laden** mit aktivem Warp.
    **Erwartet:** Warp-Zustand wird restauriert, Kurven-Tab zeigt
    wieder gewarpte Achse und Kurven.

13. **Sprachwechsel** (z. B. auf Englisch).
    **Erwartet:** Hinweistext bleibt sichtbar, fällt aufgrund
    fehlendem `lvChartWarpHint` in en.js auf den **deutschen
    Default** zurück (das ist beabsichtigt; Übersetzungen kommen
    später).

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §8 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.68-beta"`.
- `js/state-side.js`: Funktion `effFreqDisplay(i, side)` existiert
  direkt unter `effFreq`.
- `js/levels.js`: `calcPresetCurve` enthält in den Zweigen tilt,
  scurve, pivot, gauss und speech **keinen** Aufruf von `effFreq(i)`
  mehr, sondern `effFreqDisplay(i)`. bassboost/highboost/volume
  weiterhin elektrodennummern-basiert.
- `js/levels.js`: `drawLvChart` ruft `buildCentAxis` mit dem
  `hzGetter`-Argument `function (i) { return effFreqDisplay(i); }`
  auf.
- `js/levels.js`: `drawLvChart` enthält **keinen** direkten
  `effFreq(i)`-Aufruf mehr für die x-Achsen-Labels (die
  Hz-Anzeige läuft über `axis.hzArr`).
- `index.html`: unter `<div class="lv-chart-wrap">` existiert das
  neue Div `<div id="lvChartWarpHint" data-t="lvChartWarpHint">`.
- `i18n/de.js`: neuer Schlüssel `lvChartWarpHint` ist gesetzt.
- `js/init.js`: bei den Warp-relevanten Listenern (Toggle, Strength,
  Mode, JSON-Load) wird `drawLvChart()` mit aufgerufen. Wenn beim
  Auffinden der genauen Stellen Zweifel bestehen, **Rückfrage
  stellen** und nicht raten.
- `js/test.js`, `js/audio.js`, `js/freqmatch.js`, `js/levels-tab.js`,
  `js/chart.js`, `js/lr-balance.js`, `js/freq-table.js`,
  `js/maplaw.js`: **unverändert** — verwenden weiterhin `effFreq`
  (kein Versehen einbauen).
- `docs/CODESTRUKTUR.md` und `docs/spec/05-kurven.md` sind
  entsprechend angepaßt.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 10. Hinweis für Folge-Anleitungen

- **Bauanleitung 69**: Player-EQ-Graph und EQ-Berechnung analog auf
  `effFreqDisplay` umstellen.
- **Bauanleitung 70**: Schieber-Tab dezenter Hinweistext bei Warp
  + sichtbaren Kurven.
- **Bauanleitung 71**: Archiv-Druck-Renderer in `print-md.js`
  (`_archivChartKurven`, `_archivChartPlayerEq`) auf
  `effFreqDisplay` umstellen, damit der Druck der GUI folgt.
- **Mini-Anleitung Übersetzungen**: `en.js`, `fr.js`, `es.js` für
  `lvChartWarpHint` ergänzen, sobald die deutsche Vorlage durch ist.
