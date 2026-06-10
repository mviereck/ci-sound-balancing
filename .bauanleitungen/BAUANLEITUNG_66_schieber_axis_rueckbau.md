# Bauanleitung 66 — Schieber-Tab: x-Achse zurück auf elektrodennummern-basiert

## Ziel

Im **Schieber-Tab** (sichtbarer Tab „Schieber", DOM `panel-schieber`,
Hauptmodul `js/levels-tab.js`) wird die in Bauanleitung 65 eingeführte
**Cent-skalierte x-Achse zurückgebaut**. Stattdessen werden die Säulen
wieder **gleichmäßig nach Elektrodennummer** verteilt. Die
Hz-/Cent-Zeilen unter der x-Achse fallen weg. Der bisherige
Hover-Tooltip „Elektrode N / Hz / ¢" über der x-Achse entfällt im
Schieber.

**Hintergrund:** Der Schieber-Tab verändert ausschließlich
**dB-Korrekturen pro Elektrode**, nicht Frequenzen. Frequenz-Bezug
auf der x-Achse ist hier konzeptionell überflüssig und kollidiert mit
dem in einer Folge-Bauanleitung geplanten Frequenz-Warping (der
Schieber bleibt warp-frei). Die Cent-Skalierung bleibt im Kurven-Tab
und im Player erhalten — der Schieber ist die Ausnahme.

**Wichtig:** Nur der Schieber-Tab wird zurückgebaut. `chart.js`
(`drawChart`, `buildCentAxis`, `_attachAxisTooltip`) bleibt vollständig
unverändert, weil andere Module (Loudness-Chart, LR-Chart) den
gemeinsamen Helper noch nutzen.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.66-beta";
```

---

## 2. Neue lokale Achsen-Hilfsfunktion in levels-tab.js

In `js/levels-tab.js` direkt **über** `lvTabDrawRelative` (Z. 65) eine
neue lokale Hilfsfunktion einfügen. Sie verteilt die Elektroden
gleichmäßig über die Plot-Breite — kein Cent-Bezug, keine Hz-Lookup.

```js
// Gleichmäßige x-Verteilung der Elektroden über die Plot-Breite
// (elektrodennummern-basiert). Ersetzt buildCentAxis im Schieber-Tab:
// hier soll die x-Achse keinerlei Frequenzbezug haben, weil der
// Schieber nur dB-Korrekturen pro Elektrode verändert.
function _lvTabBuildAxis(electrodes, padLeft, plotW) {
  const n = electrodes.length;
  if (n === 0) return { tX: () => padLeft, minDx: 0 };
  if (n === 1) return { tX: () => padLeft + plotW / 2, minDx: plotW };
  const dx = plotW / n;
  const tX = (j) => padLeft + dx * (j + 0.5);
  return { tX: tX, minDx: dx };
}
```

---

## 3. `lvTabDrawRelative` umstellen

In `js/levels-tab.js`, `lvTabDrawRelative` (Z. 65 ff.).

### 3a. buildCentAxis-Aufruf ersetzen (Z. 89)

**Vorher:**

```js
  const axis = buildCentAxis(all, padL, plotW);
  cols.forEach((c, idx) => { c.xMid = axis.tX(idx); c._axisIdx = idx; });
  const barW = Math.max(8, Math.min(40, (axis.minDx || 24) * 0.6));
```

**Nachher:**

```js
  const axis = _lvTabBuildAxis(all, padL, plotW);
  cols.forEach((c, idx) => { c.xMid = axis.tX(idx); c._axisIdx = idx; });
  const barW = Math.max(8, Math.min(40, (axis.minDx || 24) * 0.6));
```

### 3b. Label-Aufruf vereinfachen (Z. 127)

Der Aufruf von `lvTabDrawLabelsRelative` bekommt nach §5 eine
schlankere Signatur (ohne `axis`). Hier den Aufruf ersetzen:

**Vorher:**

```js
    lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col, axis);
```

**Nachher:**

```js
    lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col);
```

### 3c. `_lvTabSetAxisHits`-Aufruf entfernen (Z. 133)

**Vorher:**

```js
  _lvTabSetAxisHits(ctx.canvas, cols, axis, H, padBot);
```

**Nachher:** Zeile **ersatzlos löschen**. (Tooltip im Schieber-Tab
entfällt vollständig.)

---

## 4. `lvTabDrawAbsolute` umstellen

In `js/levels-tab.js`, `lvTabDrawAbsolute` (Z. 138 ff.).

### 4a. buildCentAxis-Aufruf ersetzen (Z. 190)

**Vorher:**

```js
  const axis = buildCentAxis(all, padL, plotW);
```

**Nachher:**

```js
  const axis = _lvTabBuildAxis(all, padL, plotW);
```

### 4b. Label-Aufruf in der Spalten-Schleife (Z. 285)

**Vorher:**

```js
    // Beschriftung unten
    lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col, axis);
```

**Nachher:**

```js
    // Beschriftung unten
    lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col);
```

(Das `padTop`-Argument fällt mit weg, weil die Funktion es bereits
heute nicht verwendet — siehe §5 unten.)

### 4c. `_lvTabSetAxisHits`-Aufruf entfernen (Z. 291)

**Vorher:**

```js
  _lvTabSetAxisHits(ctx.canvas, cols, axis, H, padBot);
```

**Nachher:** Zeile ersatzlos löschen.

---

## 5. `lvTabDrawLabelsRelative` vereinfachen

In `js/levels-tab.js`, `lvTabDrawLabelsRelative` (Z. 442–457).

**Vorher:**

```js
function lvTabDrawLabelsRelative(ctx, xMid, padTop, H, padBot, col, axis) {
  const j = col._axisIdx;
  const hz = axis.hzArr[j];
  ctx.fillStyle = "#333";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dENPrefix() + dEN(col.i), xMid, H - padBot + 14);
  ctx.fillStyle = "#888";
  ctx.font = "9px Consolas,monospace";
  const fTxt = hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz);
  ctx.fillText(fTxt, xMid, H - padBot + 26);
  if (j % axis.step === 0 || j === 0 || j === axis.hzArr.length - 1) {
    const c = Math.round(axis.centArr[j]);
    ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", xMid, H - padBot + 38);
  }
}
```

**Nachher:**

```js
function lvTabDrawLabelsRelative(ctx, xMid, H, padBot, col) {
  ctx.fillStyle = "#333";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(dENPrefix() + dEN(col.i), xMid, H - padBot + 14);
}
```

(Nur noch eine Zeile mit der Elektroden-Bezeichnung; Hz- und Cent-Zeile
fallen weg.)

---

## 6. Hz aus `lvTabDrawExcludedColumn` entfernen

In `js/levels-tab.js`, `lvTabDrawExcludedColumn` (Z. 296–315) die
Hz-Zeile entfernen.

**Vorher (Z. 307–314):**

```js
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
  ctx.font = "9px Consolas,monospace";
  const f = effFreq(i);
  const fTxt = f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f);
  ctx.fillText(fTxt, xMid, H - padBot + 28);
}
```

**Nachher:**

```js
  ctx.textAlign = "center";
  ctx.fillStyle = "#9ca3af";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
}
```

---

## 7. Hz aus `lvTabDrawNoMclColumn` entfernen

In `js/levels-tab.js`, `lvTabDrawNoMclColumn` (Z. 317–332) die
Hz-Zeile entfernen.

**Vorher (Z. 322–331):**

```js
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("—", xMid, padTop + plotH / 2);
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
  const f = effFreq(i);
  ctx.font = "9px Consolas,monospace";
  const fTxt = f >= 1000 ? (f / 1000).toFixed(1) + "k" : Math.round(f);
  ctx.fillText(fTxt, xMid, H - padBot + 28);
}
```

**Nachher:**

```js
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px Segoe UI,sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("—", xMid, padTop + plotH / 2);
  ctx.fillText(dENPrefix() + dEN(i), xMid, H - padBot + 14);
}
```

---

## 8. `_lvTabSetAxisHits` entfernen

In `js/levels-tab.js` die Funktion `_lvTabSetAxisHits` (Z. 504–517)
**komplett löschen**. Sie wurde nur von `lvTabDrawRelative` und
`lvTabDrawAbsolute` benutzt — beide Aufrufe sind in §3c und §4c
entfernt.

Damit fällt im Schieber-Tab auch der Hover-Tooltip über den
x-Achsen-Labels weg.

---

## 9. `padBot`-Korrektur (optisch)

Die Konstanten `padBot = 56` in `lvTabDrawRelative` (Z. 84) und
`lvTabDrawAbsolute` (Z. 186) waren auf eine dreizeilige x-Achsen-
Beschriftung (Elektrode / Hz / Cent) ausgelegt. Nach dem Rückbau steht
unter der Achse nur noch die Elektroden-Bezeichnung.

**In beiden Funktionen** den Wert reduzieren:

**Vorher:**

```js
  const padBot = 56;
```

**Nachher:**

```js
  const padBot = 36;
```

(Hinweis: falls dieselbe Konstante in der Datei mehrfach vorkommt:
nur die beiden in `lvTabDrawRelative` und `lvTabDrawAbsolute`
anpassen. Andere Vorkommen unverändert lassen.)

---

## 10. Doku-Updates

### 10a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`levels-tab.js`** (Z. 142) die Beschreibung
anpassen — die Cent-Skalierung gilt dort nicht mehr.

**Vorher (Auszug):**

> `lvTabDraw` (Dispatcher), `lvTabDrawRelative`, `lvTabDrawAbsolute`
> (beide cent-skaliert via `buildCentAxis`; Säulen sitzen an
> Cent-Position der Elektrode, Säulenbreite an `axis.minDx` gekoppelt;
> pro Spalte werden `xMid` und `_axisIdx` in das `col`-Objekt
> geschrieben, damit die Helper darauf zugreifen können), … (`lvTabDrawLabelsRelative` (dreizeilig E / Hz / ¢), …), `_lvTabSetAxisHits`
> (befüllt `cv._axisHits` und registriert `_attachAxisTooltip` aus
> chart.js für den Hover-Tooltip), …

**Nachher:**

> `lvTabDraw` (Dispatcher), `lvTabDrawRelative`, `lvTabDrawAbsolute`
> (beide elektrodennummern-basiert, gleichmäßige x-Verteilung via
> `_lvTabBuildAxis`; Säulen sitzen an gleichmäßiger x-Position,
> Säulenbreite an `axis.minDx` gekoppelt; pro Spalte wird `xMid` in
> das `col`-Objekt geschrieben), … (`lvTabDrawLabelsRelative`
> (einzeilig: nur Elektroden-Bezeichnung), …). Kein x-Achsen-Tooltip im
> Schieber-Tab — der Schieber verändert ausschließlich dB-Korrekturen
> pro Elektrode, daher kein Frequenz-Bezug auf der x-Achse.

Im Eintrag zu **`chart.js`** (Z. 135) den Hinweis auf den Schieber-Tab
streichen — `buildCentAxis` bleibt für `drawChart` (Loudness) und
`lrDrawChart` (LR-Balance) in Verwendung, aber nicht mehr für den
Schieber.

**Vorher (Auszug):**

> `buildCentAxis(electrodes, padLeft, plotW, hzGetter?)` (gemeinsame
> Cent-x-Achsen-Berechnung für sämtliche Elektroden-Charts: …)

**Nachher:**

> `buildCentAxis(electrodes, padLeft, plotW, hzGetter?)` (gemeinsame
> Cent-x-Achsen-Berechnung für `drawChart` und `lrDrawChart`; der
> Schieber-Tab nutzt seit Bauanleitung 66 eine eigene, rein
> elektrodennummern-basierte Achsen-Hilfsfunktion `_lvTabBuildAxis`
> in `levels-tab.js`.)

### 10b. `docs/spec/04-schieber.md`

Falls dort eine x-Achsen-Beschreibung mit Cent/Hz steht, auf
„elektrodennummern-basiert, nur Elektroden-Bezeichnung unter der
Säule" anpassen. Falls keine x-Achsen-Beschreibung existiert, einen
kurzen Satz unter dem ersten Absatz ergänzen, sinngemäß:

> Die x-Achse ist rein elektrodennummern-basiert (gleichmäßige
> Verteilung über die Plot-Breite). Frequenz-Bezug (Hz, Cent) wird in
> diesem Tab nicht angezeigt — der Schieber verändert ausschließlich
> dB-Korrekturen pro Elektrode.

---

## 11. Akzeptanztest (Klick-für-Klick)

1. **App neu laden** (Cache-Bust durch Versionsbump). Tab „Schieber"
   öffnen.
   **Erwartet:** Säulen-Diagramm wie bisher, aber die Säulen sind
   **gleichmäßig** über die Breite verteilt — keine engen Cluster im
   Apikal-Bereich mehr.

2. Unter jeder Säule steht **nur noch die Elektroden-Bezeichnung**
   (z. B. „E1", „E2" …).
   **Erwartet:** Keine Hz-Zahl, kein „¢"-Wert.

3. Über eine x-Achsen-Beschriftung mit der Maus fahren.
   **Erwartet:** **Kein** Tooltip erscheint (Hover-Info ist im
   Schieber-Tab entfernt).

4. **Modus B (absolut)** aktivieren (sofern MCL-Werte gepflegt sind).
   **Erwartet:** Auch hier nur Elektroden-Bezeichnung unter der Säule,
   keine Hz/Cent.

5. **Excluded-Spalten** (deaktivierte Elektroden mit X-Diagonale):
   **Erwartet:** ebenfalls nur Elektroden-Bezeichnung, keine Hz-Zeile.

6. **Spalten ohne MCL** im Absolutmodus (gestrichelter Outline,
   „—" in der Mitte):
   **Erwartet:** ebenfalls nur Elektroden-Bezeichnung.

7. **Pfeiltasten ←/→** im Schieber-Tab, sobald Canvas Fokus hat.
   **Erwartet:** Navigation zwischen aktiven Elektroden funktioniert
   unverändert. Die Umrahmung der aktiven Elektrode wandert.

8. **Touch-Bedienleiste** (Stepper-Buttons unter dem Canvas):
   **Erwartet:** Werte ändern sich live, Säulen-Höhe paßt sich an.
   Verteilung der Säulen bleibt gleichmäßig.

9. **Kurven-Tab** (zum Quervergleich): die Cent-Achse dort soll
   **unverändert** erhalten geblieben sein.

10. **Meßergebnisse → Elektrodenlautstärke-Balance**: ebenfalls
    **unverändert**, weil der Rückbau dort eigene Bauanleitung 67 ist.

---

## 12. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §11 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.66-beta"`.
- `js/levels-tab.js`: Funktion `_lvTabBuildAxis` existiert und wird
  in `lvTabDrawRelative` und `lvTabDrawAbsolute` aufgerufen.
- `js/levels-tab.js`: Es gibt **keinen** Aufruf von `buildCentAxis`
  mehr (grep auf die Datei).
- `js/levels-tab.js`: `_lvTabSetAxisHits` ist gelöscht; es gibt
  keinen Aufruf davon mehr.
- `js/levels-tab.js`: `lvTabDrawLabelsRelative` hat die schlanke
  Signatur `(ctx, xMid, H, padBot, col)` und zeichnet nur noch die
  Elektroden-Bezeichnung.
- `js/levels-tab.js`: `lvTabDrawExcludedColumn` und
  `lvTabDrawNoMclColumn` enthalten keinen `effFreq(i)`-Aufruf für die
  x-Achsen-Beschriftung mehr.
- `js/levels-tab.js`: `padBot` in `lvTabDrawRelative` und
  `lvTabDrawAbsolute` ist `36` (statt vorher `56`).
- `js/chart.js`: **unverändert** — `buildCentAxis` und
  `_attachAxisTooltip` existieren weiter, weil `drawChart` und
  `lrDrawChart` sie noch nutzen.
- `docs/CODESTRUKTUR.md`: Einträge zu `levels-tab.js` und `chart.js`
  sind entsprechend angepaßt.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 13. Hinweis für Folge-Anleitungen

- **Bauanleitung 67** (geplant): analoger Rückbau für
  Meßergebnisse → Elektrodenlautstärke (`drawChart` in `chart.js`)
  und Stereo-Balance (`lrDrawChart` in `lr-balance.js`). Dort
  bleibt die Hz-Zeile unter der x-Achse erhalten, die Cent-Zeile
  entfällt.
- **Bauanleitung 68** (geplant): zentrale Hilfsfunktion
  `effFreqDisplay(i, side)` für Warp-Bewußtsein und Anpassung im
  Kurven-Tab.
- **Bauanleitung 70** (geplant): dezenter Hinweistext unter dem
  Schieber-Canvas, der bei aktivem Frequenz-Warping **und**
  eingeblendeten Kurven (`lvTabShowCurves`) auf die geringfügige
  numerische Verschiebung der Kurven-Werte hinweist (die x-Achse
  selbst ist nicht betroffen — die ist nach dieser Bauanleitung
  warp-frei).
- Übersetzungen (en/fr/es): in dieser Bauanleitung **keine** neuen
  i18n-Strings — keine Mini-Übersetzungs-Anleitung nötig.
