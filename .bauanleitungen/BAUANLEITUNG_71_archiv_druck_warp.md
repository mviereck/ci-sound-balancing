# Bauanleitung 71 — Archiv-Druck folgt GUI (Warp, Rückbau, Helper-Aufteilung)

## Ziel

Die Archiv-Druck-Renderer in `js/print-md.js` (`_archivChart*`)
sollen denselben x-Achsen- und Frequenz-Bezug zeigen wie die
entsprechenden GUI-Charts nach den Bauanleitungen 66–69:

| Renderer | GUI-Tab | x-Achse | Frequenz-Bezug |
|---|---|---|---|
| `_archivChartLoudness` | Meßergebnisse Loudness | elektrodennummern-basiert (BA 67) | Hz unter Achse, **kein Cent** |
| `_archivChartSchieber` | Schieber-Tab | elektrodennummern-basiert (BA 66) | **kein** Hz/Cent |
| `_archivChartKurven` | Kurven-Tab | cent-skaliert, Warp-bewußt (BA 68) | Hz + Cent unter Achse, gewarpt |
| `_archivChartFreqmatch` | Frequenzabgleich-Chart | log-Hz (unverändert) | unverändert |
| `_archivChartLR` | Stereo-Balance | elektrodennummern-basiert (BA 67) | Hz unter Achse, **kein Cent** |
| `_archivChartPlayerEq` | Player-EQ | cent-skaliert, Warp-bewußt (BA 69) | Hz + Cent unter Achse, gewarpt |

Die zentrale Idee: keine eigenen Algorithmen, sondern dieselben
Hilfsfunktionen wie die GUI nutzen — `buildCentAxis` mit
`effFreqDisplay` (Warp-bewußt) für die Cent-Pfade,
`buildLinearAxis` (aus BA 67) für die elektrodennummern-Pfade.

**Voraussetzungen:** Bauanleitungen 66, 67, 68 und 69 sind umgesetzt.
Insbesondere existieren `effFreqDisplay` (state-side.js) und
`buildLinearAxis` (chart.js).

Der **Audiologen-Druck** (`audiologPrint`, `_audiologChartImg`)
bleibt **unverändert** — der ist absichtlich vereinfacht und folgt
nicht der GUI-Anzeige-Variante.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.71-beta";
```

---

## 2. Label-Helper aufsplitten in print-md.js

In `js/print-md.js` die bestehende Funktion `_archivDrawElCentLabel`
(Z. 1340–1354) behalten **und** zwei neue Varianten **direkt
darunter** einfügen, eine ohne Cent-Zeile und eine ohne Hz und Cent.

**Vorher (Z. 1340–1354 unverändert lassen):**

```js
function _archivDrawElCentLabel(ctx, elLabel, cx, H, padB, axis, j) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
  const hz = axis.hzArr[j];
  const fTxt = hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz);
  ctx.fillStyle = "#888";
  ctx.font = "8px sans-serif";
  ctx.fillText(fTxt, cx, H - padB + 23);
  if (j % axis.step === 0 || j === 0 || j === axis.hzArr.length - 1) {
    const c = Math.round(axis.centArr[j]);
    ctx.fillText((c >= 0 ? "+" : "") + c + " ¢", cx, H - padB + 34);
  }
}
```

**Direkt darunter neu einfügen:**

```js
// Variante für elektrodennummern-basierte Charts mit Hz-Zeile
// (ohne Cent) — verwendet von _archivChartLoudness und
// _archivChartLR seit Bauanleitung 71.
function _archivDrawElHzLabel(ctx, elLabel, cx, H, padB, axis, j) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
  const hz = axis.hzArr[j];
  const fTxt = hz >= 1000 ? (hz / 1000).toFixed(1) + "k" : Math.round(hz);
  ctx.fillStyle = "#888";
  ctx.font = "8px sans-serif";
  ctx.fillText(fTxt, cx, H - padB + 23);
}

// Variante nur mit Elektroden-Label (kein Hz, kein Cent) —
// verwendet von _archivChartSchieber seit Bauanleitung 71.
function _archivDrawElLabel(ctx, elLabel, cx, H, padB) {
  ctx.fillStyle = "#555";
  ctx.font = "9px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(elLabel, cx, H - padB + 12);
}
```

---

## 3. `_archivChartLoudness` umstellen (elektrodennummern, Hz)

In `js/print-md.js`, `_archivChartLoudness` (Z. 1384–1423).

### 3a. Achsen-Aufruf (Z. 1398)

**Vorher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW);
```

**Nachher:**

```js
    const axis = buildLinearAxis(idxArr, pad.l, pW);
```

### 3b. Label-Aufruf (Z. 1419)

**Vorher:**

```js
      _archivDrawElCentLabel(ctx, r.label, cx, H, pad.b, axis, j);
```

**Nachher:**

```js
      _archivDrawElHzLabel(ctx, r.label, cx, H, pad.b, axis, j);
```

---

## 4. `_archivChartSchieber` umstellen (elektrodennummern, kein Hz)

In `js/print-md.js`, `_archivChartSchieber` (Z. 1426–1460).

### 4a. Achsen-Aufruf (Z. 1440)

**Vorher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW);
```

**Nachher:**

```js
    const axis = buildLinearAxis(idxArr, pad.l, pW);
```

### 4b. Label-Aufruf (Z. 1456)

**Vorher:**

```js
      _archivDrawElCentLabel(ctx, r.label, cx, H, pad.b, axis, j);
```

**Nachher:**

```js
      _archivDrawElLabel(ctx, r.label, cx, H, pad.b);
```

---

## 5. `_archivChartKurven` umstellen (cent, Warp-bewußt)

In `js/print-md.js`, `_archivChartKurven` (Z. 1463–1512).

### 5a. Achsen-Aufruf mit hzGetter (Z. 1479)

**Vorher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW);
```

**Nachher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW, function (i) {
      return effFreqDisplay(i);
    });
```

(`effFreqDisplay` ohne Side-Argument verwendet `activeSide`. Da
`_archivChartKurven` innerhalb von `withSide(sideBlock.side, ...)`
läuft, ist `activeSide` während des Renderings auf der jeweiligen
Seite gebunden — also korrekt seitenspezifisch.)

### 5b. Label-Aufruf (Z. 1507) bleibt **unverändert**

```js
      _archivDrawElCentLabel(ctx, sideBlock.implant.electrodes[i].label,
                             axis.tX(i), H, pad.b, axis, i);
```

(Hier kommen Hz und Cent aus `axis.hzArr`/`centArr`, die jetzt mit
`effFreqDisplay` befüllt sind → automatisch gewarpt.)

### 5c. `calcPresetCurve` läuft automatisch warp-bewußt

`calcPresetCurve` (Z. 1485) nutzt nach Bauanleitung 68 intern
`effFreqDisplay`. Hier ist keine Änderung nötig.

---

## 6. `_archivChartFreqmatch` — keine Änderung

`_archivChartFreqmatch` (Z. 1515–1543) zeichnet bereits auf einer
log-Hz-Achse mit eigenem `xFor`-Mapping. Diese Funktion wird **nicht
angefaßt**. Falls Sonnet beim Lesen versucht ist, etwas zu
„vereinheitlichen": hier passiert nichts.

---

## 7. `_archivChartLR` umstellen (elektrodennummern, Hz)

In `js/print-md.js`, `_archivChartLR` (Z. 1546–1574).

### 7a. Achsen-Aufruf (Z. 1560)

**Vorher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW);
```

**Nachher:**

```js
    const axis = buildLinearAxis(idxArr, pad.l, pW);
```

(Der Renderer läuft innerhalb von `withSide("left", ...)`, was bei
`buildLinearAxis` ohne expliziten hzGetter den Default-Pfad
`effFreq` ergibt — Hz pro Index aus der linken Seite. Das paßt zur
GUI-Konvention in `lrDrawChart` aus BA 67.)

### 7b. Label-Aufruf (Z. 1570)

**Vorher:**

```js
      _archivDrawElCentLabel(ctx, `E${r.elIdx + 1}`, cx, H, pad.b, axis, j);
```

**Nachher:**

```js
      _archivDrawElHzLabel(ctx, `E${r.elIdx + 1}`, cx, H, pad.b, axis, j);
```

---

## 8. `_archivChartPlayerEq` umstellen (cent, Warp-bewußt)

In `js/print-md.js`, `_archivChartPlayerEq` (Z. 1577–1613).

### 8a. Achsen-Aufruf mit hzGetter (Z. 1592)

**Vorher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW);
```

**Nachher:**

```js
    const axis = buildCentAxis(idxArr, pad.l, pW, function (i) {
      return effFreqDisplay(i);
    });
```

(Analog zu Kurven-Renderer in §5a. `withSide(sideBlock.side, ...)`
hat `activeSide` korrekt gesetzt.)

### 8b. Label-Aufruf (Z. 1608) bleibt **unverändert**

```js
      _archivDrawElCentLabel(ctx, el ? el.label : ("E" + (j + 1)),
                             cx, H, pad.b, axis, j);
```

---

## 9. Doku-Updates

### 9a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`print-md.js`** (Z. 138) die Liste der Helper-
Zeichenfunktionen aktualisieren. **Vorher (Auszug):**

> Zeichenhelfer `_archivMkCanvas`, `_archivDrawAxis`,
> `_archivDrawElCentLabel` (gemeinsame dreizeilige x-Achsen-
> Beschriftung E / Hz / ¢, ausgedünnt nach `axis.step`)

**Nachher:**

> Zeichenhelfer `_archivMkCanvas`, `_archivDrawAxis`,
> `_archivDrawElCentLabel` (dreizeilig E / Hz / ¢ — verwendet von
> Kurven- und Player-EQ-Druck-Renderern auf cent-skalierter Achse),
> `_archivDrawElHzLabel` (zweizeilig E / Hz — verwendet von
> Loudness- und LR-Druck-Renderern auf elektrodennummern-basierter
> Achse seit Bauanleitung 71), `_archivDrawElLabel` (einzeilig
> nur E — verwendet vom Schieber-Druck-Renderer seit Bauanleitung
> 71).

Im gleichen Eintrag den Satz „alle außer Freqmatch nutzen
`buildCentAxis`" ersetzen durch:

> `_archivChartKurven` und `_archivChartPlayerEq` nutzen
> `buildCentAxis` mit `effFreqDisplay` als hzGetter (cent-skaliert,
> Warp-bewußt analog zur GUI seit Bauanleitung 71).
> `_archivChartLoudness` und `_archivChartLR` nutzen
> `buildLinearAxis` (elektrodennummern-basiert mit Hz unter Achse
> analog zur GUI seit BA 67/71).
> `_archivChartSchieber` nutzt ebenfalls `buildLinearAxis`, zeichnet
> aber nur die Elektroden-Bezeichnung (analog zur GUI seit BA
> 66/71).
> `_archivChartFreqmatch` hat seit jeher eine log-Hz-Achse.

### 9b. `docs/spec/08-drucken.md`

Im Abschnitt zur Archiv-Box (Modus A) einen kurzen Absatz ergänzen,
sinngemäß:

> Die Diagramme im Archiv-Druck folgen dem GUI-Zustand: Kurven-Chart
> und Player-EQ sind cent-skaliert und folgen dem Frequenz-Warping
> (sofern aktiv). Loudness- und Stereo-Balance-Diagramme sind
> elektrodennummern-basiert mit Hz unter der Achse. Der Schieber-
> Druck zeigt nur die Elektroden-Bezeichnung unter der Achse. Der
> Frequenzabgleich-Druck behält seine log-Hz-Achse.
>
> Der Audiologen-Druck bleibt davon unberührt — er nutzt eine
> bewußt vereinfachte Darstellung und ist nicht warp-bewußt.

---

## 10. Akzeptanztest (Klick-für-Klick)

**Voraussetzung:** Eine vollständige Beispiel-Session mit Daten in
allen relevanten Tabs (Loudness, Stereo-Balance, Schieber, Kurven,
Frequenzabgleich, Player-EQ). Frequenz-Warping ausgeschaltet.

1. **App neu laden** (Cache-Bust). Tab „Laden/Speichern" → Karte
   „Archiv-Box" → **Bericht drucken** klicken.
   **Erwartet:** Druckansicht öffnet sich. Folgende Grafiken sind
   sichtbar:
   - **Loudness-Chart**: gleichmäßig verteilte Säulen, unter jeder
     Säule E + Hz, **kein Cent**.
   - **Schieber-Chart**: gleichmäßig verteilte Säulen, unter jeder
     Säule nur E, **kein Hz, kein Cent**.
   - **Kurven-Chart**: cent-skalierte Säulen-Positionen (nicht
     gleichmäßig), darunter E + Hz + Cent.
   - **Frequenzabgleich-Chart**: log-Hz-Achse (unverändert).
   - **LR-Chart**: gleichmäßige Säulen, E + Hz, kein Cent.
   - **Player-EQ-Chart**: cent-skalierte Säulen, E + Hz + Cent.

2. Druck-Vorschau schließen. **Frequenz-Warping im Player
   einschalten** (Strength 100 %, var_side, mit `fRes`-Daten).

3. **Bericht drucken** erneut.
   **Erwartet:**
   - **Kurven-Chart** im Druck: Cent-Positionen sind gegenüber
     dem ersten Ausdruck **verschoben**. Hz-Werte unter der Achse
     zeigen die gewarpten Werte.
   - **Player-EQ-Chart**: ebenfalls verschoben.
   - **Loudness-, Schieber-, LR-Chart**: **unverändert** zur ersten
     Druckansicht.
   - **Frequenzabgleich-Chart**: **unverändert**.

4. **Audiologen-Auftrag drucken** (separater Button).
   **Erwartet:** Diese Druckansicht ist **unverändert** vom Warp-
   Zustand — der Audiologen-Druck ignoriert Warp absichtlich.

5. **Side-Wechsel** (active = right) und erneut **Bericht drucken**.
   **Erwartet:** Für jede Seite wird der entsprechende Block
   gerendert; die Warp-Verschiebung folgt der jeweiligen Seite
   (`csL`/`csR`).

6. **Bilateraler Block** (Stereo-Balance, ggf. Frequenzabgleich):
   **Erwartet:** wird wie üblich gerendert. LR-Chart bleibt
   elektrodennummern-basiert.

7. **Versions-Footer**: zeigt `3.0.71-beta`.

---

## 11. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §10 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.71-beta"`.
- `js/print-md.js`: Funktionen `_archivDrawElHzLabel` und
  `_archivDrawElLabel` existieren direkt unter
  `_archivDrawElCentLabel`. `_archivDrawElCentLabel` ist
  unverändert.
- `js/print-md.js`: `_archivChartLoudness` und `_archivChartLR`
  rufen `buildLinearAxis` (nicht `buildCentAxis`) auf und nutzen
  `_archivDrawElHzLabel`.
- `js/print-md.js`: `_archivChartSchieber` ruft `buildLinearAxis`
  auf und nutzt `_archivDrawElLabel`.
- `js/print-md.js`: `_archivChartKurven` und `_archivChartPlayerEq`
  rufen `buildCentAxis` mit dem `hzGetter`-Argument
  `function (i) { return effFreqDisplay(i); }` auf und nutzen
  weiterhin `_archivDrawElCentLabel`.
- `js/print-md.js`: `_archivChartFreqmatch` ist **unverändert**.
- `audiologPrint` / `_audiologChartImg`: **unverändert** — kein
  Warp-Bezug, kein hzGetter-Argument.
- `docs/CODESTRUKTUR.md` und `docs/spec/08-drucken.md` sind
  entsprechend angepaßt.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 12. Hinweis für Folge-Anleitungen

- **Mini-Anleitung Übersetzungen**: `en.js`, `fr.js`, `es.js` für
  `lvChartWarpHint` (aus BA 68) und `lvTabWarpHint` (aus BA 70)
  ergänzen, sobald die deutschen Vorlagen durch sind. **Keine**
  neuen i18n-Strings in dieser Bauanleitung 71.
- Längerfristig (vertagt in `docs/IDEEN.md`):
  - MAPLAW-Filterbank dynamisch aus Implantat-State (statt
    hartcodiertem MED-EL-Standard).
  - Zweiter Schieber-Tab für Frequenz-Warping pro Elektrode.
