# Bauanleitung 67 — Meßergebnisse Loudness + Stereo-Balance: x-Achse zurück auf elektrodennummern-basiert

## Ziel

Im Sub-Tab **Meßergebnisse → Elektrodenlautstärke-Balance**
(`drawChart` in `js/chart.js`) und im Sub-Tab **Meßergebnisse →
Stereo-Balance** (`lrDrawChart` in `js/lr-balance.js`) wird die in
Bauanleitung 64/65 eingeführte **Cent-skalierte x-Achse zurückgebaut**.

- Säulen werden **gleichmäßig nach Elektrodennummer** verteilt.
- Unter der x-Achse bleibt die **Hz-Zeile** erhalten (die Hz-Werte
  kommen aus dem Implantat-Eintrag, sind also tragende Information:
  „bei welcher Frequenz wurde gemessen").
- Die **Cent-Zeile entfällt**.
- Der Hover-Tooltip über den x-Achsen-Labels zeigt weiterhin
  „Elektrode N / Hz", **ohne Cent-Zeile**.

In den Ergebnis-Tabellen (`renderResults` in `js/results.js`) gibt es
heute eine **Hz-Spalte**, aber **keine Cent-Spalte** — dort ist nichts
zu ändern.

**Hintergrund:** Frequenz-Warping wird beim Test nicht angewandt; die
gemessenen Hz-Werte stehen für die echte Mess-Frequenz und sollen
unverändert sichtbar bleiben. Cent-Beschriftung war eine
proportionale Darstellungs-Hilfe, die bei elektrodennummern-basierter
x-Achse keinen Sinn mehr ergibt.

`buildCentAxis` in `chart.js` bleibt erhalten — sie wird in
Bauanleitung 68/71 für den Kurven-Tab und den Archiv-Druck noch
gebraucht.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.67-beta";
```

---

## 2. Neue lineare Achsen-Hilfsfunktion in chart.js

In `js/chart.js` direkt **über** `function buildCentAxis(...)` (Z. 33)
eine neue Hilfsfunktion einfügen. Sie verteilt die Elektroden
gleichmäßig über die Plot-Breite und liefert zusätzlich die
Hz-Werte per `effFreq` (oder über einen optionalen Getter, analog zu
`buildCentAxis`).

```js
// Gleichmäßige x-Verteilung der Elektroden über die Plot-Breite
// (elektrodennummern-basiert). Verwendet von drawChart (Meßergebnisse
// Loudness) und lrDrawChart (Stereo-Balance) seit Bauanleitung 67.
// Liefert zusätzlich hzArr (per effFreq oder optionalem hzGetter) für
// die Hz-Beschriftung unter der x-Achse.
function buildLinearAxis(electrodes, padLeft, plotW, hzGetter) {
  const getHz = hzGetter || effFreq;
  const hzArr = electrodes.map(function (i) { return getHz(i); });
  const n = electrodes.length;
  if (n === 0) return { tX: function () { return padLeft; }, minDx: 0, hzArr: hzArr };
  if (n === 1) return {
    tX: function () { return padLeft + plotW / 2; },
    minDx: plotW, hzArr: hzArr,
  };
  const dx = plotW / n;
  const tX = function (j) { return padLeft + dx * (j + 0.5); };
  return { tX: tX, minDx: dx, hzArr: hzArr };
}
```

(`buildCentAxis` darunter **unverändert** lassen.)

---

## 3. `drawChart` (chart.js) umstellen

In `js/chart.js`, `drawChart` (Z. 109 ff.).

### 3a. Achsen-Aufruf ersetzen (Z. 144–146)

**Vorher:**

```js
  const axis = buildCentAxis(allE, pad.left, pW),
    tX = axis.tX,
    xS = axis.minDx,
    tY = (v) => pad.top + (yMx - v) * (pH / (yMx - yMn || 1));
```

**Nachher:**

```js
  const axis = buildLinearAxis(allE, pad.left, pW),
    tX = axis.tX,
    xS = axis.minDx,
    tY = (v) => pad.top + (yMx - v) * (pH / (yMx - yMn || 1));
```

### 3b. Cent-Zeile aus der x-Achsen-Beschriftung entfernen (Z. 231–242)

**Vorher:**

```js
    ctx.fillStyle = i === refEl ? "#2563eb" : "#555";
    ctx.font = (i === refEl ? "bold " : "") + "10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const yE = h - pad.bottom + 14,
          yHz = h - pad.bottom + 25,
          yCent = h - pad.bottom + 36,
          yAB = h - pad.bottom + 48;
    ctx.fillText(dENPrefix() + dEN(i), tX(j), yE);
    ctx.font = "8px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(axis.hzArr[j]), tX(j), yHz);
    if (j % axis.step === 0 || j === 0 || j === allE.length - 1) {
      const c = Math.round(axis.centArr[j]);
      ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", tX(j), yCent);
    }
    if (j === 0) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("apikal"), tX(j), yAB);
    }
    if (j === allE.length - 1) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("basal"), tX(j), yAB);
    }
```

**Nachher:**

```js
    ctx.fillStyle = i === refEl ? "#2563eb" : "#555";
    ctx.font = (i === refEl ? "bold " : "") + "10px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    const yE = h - pad.bottom + 14,
          yHz = h - pad.bottom + 25,
          yAB = h - pad.bottom + 38;
    ctx.fillText(dENPrefix() + dEN(i), tX(j), yE);
    ctx.font = "8px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(axis.hzArr[j]), tX(j), yHz);
    if (j === 0) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("apikal"), tX(j), yAB);
    }
    if (j === allE.length - 1) {
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.fillText(t("basal"), tX(j), yAB);
    }
```

(Cent-Zeile gestrichen; apikal/basal rückt eine Zeile nach oben.)

### 3c. Tooltip-Hitboxes anpassen (Z. 252–264)

**Vorher:**

```js
  cv._axisHits = [];
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    const cx = tX(j);
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: cx - halfDx, x1: cx + halfDx,
      y0: h - pad.bottom + 2, y1: h - pad.bottom + 44,
      label: dENPrefix() + dEN(i),
      hz: axis.hzArr[j],
      cent: axis.centArr[j],
    });
  }
```

**Nachher:**

```js
  cv._axisHits = [];
  for (let j = 0; j < allE.length; j++) {
    const i = allE[j];
    const cx = tX(j);
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: cx - halfDx, x1: cx + halfDx,
      y0: h - pad.bottom + 2, y1: h - pad.bottom + 34,
      label: dENPrefix() + dEN(i),
      hz: axis.hzArr[j],
      // cent fehlt absichtlich — Tooltip zeigt seit BA 67 nur noch Hz
    });
  }
```

(`y1` von `+44` auf `+34` reduziert, weil die Cent-Zeile entfällt.)

### 3d. `pad.bottom`-Wert anpassen (Z. 119)

**Vorher:**

```js
  const pad = { top: 30, right: 20, bottom: 67, left: 55 },
```

**Nachher:**

```js
  const pad = { top: 30, right: 20, bottom: 57, left: 55 },
```

(10 px weniger, weil eine Beschriftungs-Zeile wegfällt.)

---

## 4. `lrDrawChart` (lr-balance.js) umstellen

In `js/lr-balance.js`, `lrDrawChart` (Z. ~580 ff.).

### 4a. Achsen-Aufruf ersetzen (Z. 586–589)

**Vorher:**

```js
  const axis = buildCentAxis(idxArr, pad.left, pW, function (i) {
    return lrEffFreq("left", i);
  });
  const tX = axis.tX;
```

**Nachher:**

```js
  const axis = buildLinearAxis(idxArr, pad.left, pW, function (i) {
    return lrEffFreq("left", i);
  });
  const tX = axis.tX;
```

### 4b. Cent-Zeile aus der x-Achsen-Beschriftung entfernen (Z. 648–661)

**Vorher:**

```js
    // X-Achsenbeschriftung pro Elektrode (E / Hz / Cent re 1000 Hz)
    const leftLabel = withSide("left", () => dENPrefix("left") + dEN(i));
    ctx.fillStyle = "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftLabel, tX(i), H - pad.bottom + 12);
    const hzL = axis.hzArr[i];
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(hzL), tX(i), H - pad.bottom + 23);
    if (i % axis.step === 0 || i === 0 || i === count - 1) {
      const c = Math.round(axis.centArr[i]);
      ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", tX(i), H - pad.bottom + 33);
    }
  }
```

**Nachher:**

```js
    // X-Achsenbeschriftung pro Elektrode (E / Hz)
    const leftLabel = withSide("left", () => dENPrefix("left") + dEN(i));
    ctx.fillStyle = "#555";
    ctx.font = "9px Segoe UI,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(leftLabel, tX(i), H - pad.bottom + 12);
    const hzL = axis.hzArr[i];
    ctx.font = "7px Consolas,monospace";
    ctx.fillStyle = "#999";
    ctx.fillText(Math.round(hzL), tX(i), H - pad.bottom + 23);
  }
```

### 4c. Tooltip-Hitboxes anpassen (Z. 663–673)

**Vorher:**

```js
  cv._axisHits = [];
  for (let i = 0; i < count; i++) {
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: tX(i) - halfDx, x1: tX(i) + halfDx,
      y0: H - pad.bottom + 2, y1: H - pad.bottom + 42,
      label: withSide("left", () => dENPrefix("left") + dEN(i)),
      hz: axis.hzArr[i],
      cent: axis.centArr[i],
    });
  }
```

**Nachher:**

```js
  cv._axisHits = [];
  for (let i = 0; i < count; i++) {
    const halfDx = Math.max(8, (axis.minDx || 12) / 2);
    cv._axisHits.push({
      x0: tX(i) - halfDx, x1: tX(i) + halfDx,
      y0: H - pad.bottom + 2, y1: H - pad.bottom + 32,
      label: withSide("left", () => dENPrefix("left") + dEN(i)),
      hz: axis.hzArr[i],
      // cent fehlt absichtlich — Tooltip zeigt seit BA 67 nur noch Hz
    });
  }
```

### 4d. `pad.bottom`-Wert anpassen (Z. 581)

**Vorher:**

```js
  const pad = { top: 20, right: 16, bottom: 56, left: 52 };
```

**Nachher:**

```js
  const pad = { top: 20, right: 16, bottom: 46, left: 52 };
```

---

## 5. Tooltip-Handler in chart.js robust machen

Der Hover-Tooltip-Handler `_axisTooltipHandler` in `chart.js` (Z. 70 ff.)
zeigt heute zwingend die Cent-Zeile. Damit der Schieber-Tab (BA 66
ohne Tooltip) und die nun cent-freien Loudness-/LR-Charts sauber
behandelt werden, muß die Cent-Zeile bedingt sein.

In `js/chart.js`, `_axisTooltipHandler` (Z. 89–100).

**Vorher:**

```js
  if (hit) {
    const elLbl = (typeof t === "function" ? t("lvTabElLabel") : "Elektrode");
    tip.innerHTML =
      "<b>" + elLbl + " " + hit.label + "</b><br>" +
      Math.round(hit.hz) + " Hz<br>" +
      (hit.cent >= 0 ? "+" : "") + Math.round(hit.cent) + " ¢";
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
```

**Nachher:**

```js
  if (hit) {
    const elLbl = (typeof t === "function" ? t("lvTabElLabel") : "Elektrode");
    let html = "<b>" + elLbl + " " + hit.label + "</b>";
    if (hit.hz != null && isFinite(hit.hz)) {
      html += "<br>" + Math.round(hit.hz) + " Hz";
    }
    if (hit.cent != null && isFinite(hit.cent)) {
      html += "<br>" + (hit.cent >= 0 ? "+" : "") + Math.round(hit.cent) + " ¢";
    }
    tip.innerHTML = html;
    tip.style.display = "block";
    tip.style.left = (e.clientX + 14) + "px";
    tip.style.top = (e.clientY - 10) + "px";
  } else {
    tip.style.display = "none";
  }
```

---

## 6. Ergebnis-Tabellen prüfen — keine Änderung nötig

`renderResults` in `js/results.js` (Z. 161 ff., Z. 208 ff.) hat heute:

- Spalten für die Bonferroni-Ansicht: `thEl`, **`thHz`**, `thOff`,
  `thMes`, `thRes`, `thWgt`, `thStR`, `thRefEl` — Hz bleibt.
- Spalten für die J-Test-Ansicht: `thEl`, **`thHzStd`**, `thSc`,
  `thComp` — Hz bleibt.

Es gibt **keine** Cent-Spalte. Diese Datei wird in BA 67 **nicht
angefaßt**. Falls Sonnet beim Lesen versucht ist, etwas zu „bereinigen":
hier passiert nichts.

---

## 7. Doku-Updates

### 7a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`chart.js`** (Z. 135) die Beschreibung anpassen:

**Vorher (Auszug):**

> `buildCentAxis(electrodes, padLeft, plotW, hzGetter?)` (gemeinsame
> Cent-x-Achsen-Berechnung für `drawChart` und `lrDrawChart`; …),
> `_attachAxisTooltip` + `_axisTooltipHandler` (Hover-Tooltip
> „Elektrode N / Hz / ¢" über x-Achsen-Labels; …), `drawChart`
> (Meßergebnisse, x-Achse cent-skaliert), …

**Nachher:**

> `buildCentAxis(electrodes, padLeft, plotW, hzGetter?)` (gemeinsame
> Cent-x-Achsen-Berechnung — seit Bauanleitung 67 nur noch im
> Kurven-Tab und in den Archiv-Druck-Renderern verwendet, nicht mehr
> in `drawChart`/`lrDrawChart`), `buildLinearAxis(electrodes,
> padLeft, plotW, hzGetter?)` (gleichmäßige Elektroden-Verteilung,
> liefert `hzArr`; verwendet von `drawChart` und `lrDrawChart` seit
> Bauanleitung 67), `_attachAxisTooltip` + `_axisTooltipHandler`
> (Hover-Tooltip über x-Achsen-Labels; zeigt **bedingt** Hz und Cent
> abhängig von den Feldern in `cv._axisHits` — Hz wenn `hz != null`,
> Cent wenn `cent != null`), `drawChart` (Meßergebnisse, x-Achse
> elektrodennummern-basiert, Hz unter Achse), …

Im Eintrag zu **`lr-balance.js`** (Z. 146) den Hinweis zu `lrDrawChart`
ergänzen, sinngemäß: „x-Achse elektrodennummern-basiert seit
Bauanleitung 67, Hz-Zeile unter Achse erhalten".

Im **Datenfluss-Block** „lrDrawChart" (Z. ~442) den Satz zur Cent-
Skalierung streichen, falls vorhanden. Und im Abschnitt **drawChart**
(implizit in den Helper-Texten) den Hinweis auf Cent-Achse entfernen.

### 7b. `docs/spec/02-messung.md` und `docs/spec/01-tabs.md`

Falls dort eine Cent-x-Achse beschrieben ist für die Sub-Tabs
Elektrodenlautstärke oder Stereo-Balance: auf „x-Achse
elektrodennummern-basiert, Hz unter Achse" anpassen. Falls keine
solche Beschreibung existiert, **nichts ergänzen** — der
Default-Eindruck einer „Elektroden-Achse" ist bereits korrekt.

---

## 8. Akzeptanztest (Klick-für-Klick)

1. **App neu laden** (Cache-Bust). Tab „Meßergebnisse" → Sub-Tab
   „Elektrodenlautstärke-Balance".
   **Erwartet:** Säulen-Diagramm mit **gleichmäßig** verteilten
   Balken. Unter jedem Balken steht die Elektroden-Bezeichnung
   (z. B. „E1"), darunter die Hz-Zahl (z. B. „836"). **Keine
   Cent-Zeile mehr.**

2. Über eine x-Achsen-Beschriftung mit der Maus fahren.
   **Erwartet:** Tooltip zeigt „Elektrode E5" und „836 Hz" —
   **ohne Cent-Zeile**.

3. Beschriftung am linken und rechten Rand: „apikal" links,
   „basal" rechts.
   **Erwartet:** Beide Labels sichtbar, ca. 10 Pixel höher als
   vorher (weil die Cent-Zeile entfallen ist).

4. **Hz-Spalte in der Ergebnis-Tabelle** unter dem Chart.
   **Erwartet:** unverändert vorhanden — gleiche Werte wie vor dem
   Bau.

5. **Referenzelektrode** (sofern gesetzt): das fette „Ref.-El."-Label
   am oberen Rand des Charts sitzt weiterhin über der richtigen
   Säule (jetzt an gleichmäßiger x-Position).

6. **Residuum-Fehlerbalken** (vertikale Striche mit Querstrich auf
   den Säulen): sitzen weiterhin auf der jeweiligen Säule.

7. Sub-Tab **Stereo-Balance** öffnen.
   **Erwartet:** Bar-Chart mit gleichmäßig verteilten Balken pro
   Index. Unter jedem Balken: Elektroden-Bezeichnung (linke Seite,
   da `lrEffFreq("left", i)` als Bezugsfrequenz dient) und die
   Hz-Zahl. **Keine Cent-Zeile.**

8. Hover über die x-Achsen-Labels im Stereo-Balance-Chart.
   **Erwartet:** Tooltip „Elektrode E5 / Hz" — ohne Cent.

9. **Schieber-Tab** (zum Quervergleich): unverändert vom Rückbau aus
   Bauanleitung 66 (rein elektrodennummern-basiert, **ohne** Hz unter
   Achse).

10. **Kurven-Tab** (zum Quervergleich): die Cent-Achse dort soll
    **unverändert** geblieben sein.

11. **Druck-Pfade** (Archiv-Box und Audiologen-Box): beide
    funktionieren noch. Im Archiv-Druck werden die Charts noch über
    die `_archivChart*`-Renderer in `print-md.js` gezeichnet, die
    weiterhin `buildCentAxis` nutzen — diese werden erst in
    Bauanleitung 71 angepaßt.

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §8 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.67-beta"`.
- `js/chart.js`: Funktion `buildLinearAxis` existiert direkt über
  `buildCentAxis`. `buildCentAxis` ist **nicht** gelöscht.
- `js/chart.js`: `drawChart` ruft `buildLinearAxis` auf, **nicht**
  mehr `buildCentAxis`. Es gibt keinen Zugriff mehr auf
  `axis.centArr` in `drawChart`.
- `js/chart.js`: `_axisTooltipHandler` zeigt Hz und Cent **bedingt**
  (nur wenn die Felder im `hit`-Objekt gesetzt sind).
- `js/chart.js`: `_axisHits`-Objekt in `drawChart` enthält `hz`,
  aber **kein** `cent`.
- `js/lr-balance.js`: `lrDrawChart` ruft `buildLinearAxis` auf,
  **nicht** mehr `buildCentAxis`. Es gibt keinen Zugriff mehr auf
  `axis.centArr` in dieser Funktion.
- `js/lr-balance.js`: `_axisHits`-Objekt in `lrDrawChart` enthält
  `hz`, aber **kein** `cent`.
- `js/results.js`: **unverändert** — Hz-Spalte bleibt sichtbar in
  beiden Tabellen-Modi (Bonferroni und J-Test).
- `docs/CODESTRUKTUR.md`: Eintrag zu `chart.js` enthält
  `buildLinearAxis` und den Hinweis auf bedingten Cent-Block im
  Tooltip.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 10. Hinweis für Folge-Anleitungen

- **Bauanleitung 68** (geplant): zentrale Hilfsfunktion
  `effFreqDisplay(i, side)` in `state-side.js` und Anpassung des
  Kurven-Tabs (Chart-x-Achse und `calcPresetCurve`) auf
  Warp-Bewußtsein. Permanenter Hinweistext im Kurven-Tab.
- **Bauanleitung 69** (geplant): Player-EQ-Graph und EQ-Berechnung
  auf `effFreqDisplay` umstellen.
- **Bauanleitung 70** (geplant): dezenter Hinweistext im
  Schieber-Tab bei aktivem Warping + sichtbaren Kurven.
- **Bauanleitung 71** (geplant): `_archivChart*`-Renderer in
  `print-md.js` auf `effFreqDisplay` umstellen, damit der
  Archiv-Druck den GUI-Charts (Kurven, Player-EQ) folgt. Loudness-,
  LR- und Schieber-Charts im Archiv-Druck werden parallel zum
  GUI-Stand auf `buildLinearAxis` umgestellt (kann in BA 71 mit
  passieren oder als eigener Schritt — wird dort entschieden).
- Übersetzungen (en/fr/es): in dieser Bauanleitung **keine** neuen
  i18n-Strings — keine Mini-Übersetzungs-Anleitung nötig.
