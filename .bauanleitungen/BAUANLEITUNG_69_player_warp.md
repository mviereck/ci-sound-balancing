# Bauanleitung 69 — Player-EQ: Warp-Bewußtsein in Graph und Berechnung

## Ziel

Im Player (`js/player.js`) sollen sowohl der **EQ-Graph** (`pDrawEQ`)
als auch die **EQ-Filter-Berechnung** (`pBuildEQ`, `pCompQ`) dem
**Frequenz-Warping** folgen — analog zum Kurven-Tab aus
Bauanleitung 68. Die Filter sitzen dann an den **gewarpten
Wahrnehmungs-Frequenzen** der Elektroden, der Graph zeigt sie an
denselben Positionen.

**Voraussetzung:** Bauanleitung 68 ist umgesetzt, d. h. die Funktion
`effFreqDisplay(i, side)` existiert in `state-side.js`.

**Kein zusätzlicher UI-Text:** Im Player erscheint kein Hinweis, weil
der User dort den Warp-Toggle selbst bedient und die Wirkung
unmittelbar erlebt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.69-beta";
```

---

## 2. `pCompQ` (player.js Z. 284–303) umstellen

In `js/player.js`, `pCompQ(i)` alle `effFreq(...)`-Aufrufe durch
`effFreqDisplay(...)` ersetzen.

**Vorher:**

```js
function pCompQ(i) {
  const ef = effFreq(i),
    ef0 = effFreq(0),
    ef1 = effFreq(Math.min(1, nEl - 1)),
    efN = effFreq(nEl - 1),
    efNm1 = effFreq(Math.max(0, nEl - 2));
  let fL, fH;
  if (i === 0) {
    fL = (ef0 * ef0) / (ef1 || ef0);
    fH = ef1 || ef0;
  } else if (i === nEl - 1) {
    fL = efNm1;
    fH = (ef * ef) / efNm1;
  } else {
    fL = effFreq(i - 1);
    fH = effFreq(i + 1);
  }
  const bw = Math.log2(Math.sqrt(ef * fH)) - Math.log2(Math.sqrt(fL * ef));
  return ef / (ef * (Math.pow(2, bw / 2) - Math.pow(2, -bw / 2)));
}
```

**Nachher:**

```js
function pCompQ(i) {
  const ef = effFreqDisplay(i),
    ef0 = effFreqDisplay(0),
    ef1 = effFreqDisplay(Math.min(1, nEl - 1)),
    efN = effFreqDisplay(nEl - 1),
    efNm1 = effFreqDisplay(Math.max(0, nEl - 2));
  let fL, fH;
  if (i === 0) {
    fL = (ef0 * ef0) / (ef1 || ef0);
    fH = ef1 || ef0;
  } else if (i === nEl - 1) {
    fL = efNm1;
    fH = (ef * ef) / efNm1;
  } else {
    fL = effFreqDisplay(i - 1);
    fH = effFreqDisplay(i + 1);
  }
  const bw = Math.log2(Math.sqrt(ef * fH)) - Math.log2(Math.sqrt(fL * ef));
  return ef / (ef * (Math.pow(2, bw / 2) - Math.pow(2, -bw / 2)));
}
```

---

## 3. `pBuildEQ` (player.js Z. 305–396) umstellen

Drei `effFreq(i)`-Aufrufe in `pBuildEQ` ersetzen — alle setzen
`frequency.value` eines Biquad-Peaking-Filters.

### 3a. Stereo „both"-Modus, linker Kanal (Z. 343)

**Vorher:**

```js
      lf.frequency.value = effFreq(i);
```

**Nachher:**

```js
      lf.frequency.value = effFreqDisplay(i, "left");
```

### 3b. Stereo „both"-Modus, rechter Kanal (Z. 352)

**Vorher:**

```js
      rf.frequency.value = effFreq(i);
```

**Nachher:**

```js
      rf.frequency.value = effFreqDisplay(i, "right");
```

(Damit greift pro Channel die Warp-Cent-Verschiebung der jeweiligen
Seite — die Warp-Punkte sind pro Seite `csL`/`csR` in
`buildWarpPoints`. Heute liest derselbe Code-Pfad
`effFreq(i)` ohne Side-Bindung; mit `effFreqDisplay(i, side)` wird die
Seite jetzt explizit übergeben.)

### 3c. Mono-Modus / Default-Pfad (Z. 386)

**Vorher:**

```js
      f.frequency.value = effFreq(i);
```

**Nachher:**

```js
      f.frequency.value = effFreqDisplay(i);
```

(Ohne Side-Argument bindet `effFreqDisplay` an `activeSide` — das
paßt zu `mode === "left" | "right" | "mono"`, weil im
Default-Pfad-Else der bestehende Code ohnehin schon
`withSide(activeSide, computeGains)` benutzt und so die aktive Seite
treibt.)

---

## 4. `pDrawEQ` (player.js Z. 713–832) umstellen

In `pDrawEQ` den `buildCentAxis`-Aufruf um den `hzGetter` ergänzen.
Die Anzeige der Label (Z. 808–820) liest aus `axis.hzArr`/`centArr`
und wandert damit automatisch mit.

### 4a. buildCentAxis-Aufruf (Z. 744)

**Vorher:**

```js
  const axis = buildCentAxis(allE, pad.left, pW);
```

**Nachher:**

```js
  const axis = buildCentAxis(allE, pad.left, pW, function (i) {
    return effFreqDisplay(i);
  });
```

(`effFreqDisplay` ohne Side-Argument verwendet `activeSide`. Im
„both"-Stereo-Modus zeigt der Player-EQ-Graph laut bestehender
Konvention die aktive Seite — siehe CODESTRUKTUR.md, Abschnitt
„Player Side-Modi". Damit bleibt das konsistent.)

### 4b. Label-Schleife unverändert

Die x-Achsen-Beschriftung (Z. 808–820) und die Tooltip-Hitboxes
(Z. 822–829) lesen aus `axis.hzArr[j]` und `axis.centArr[j]` — keine
Änderung nötig.

---

## 5. Re-Render bei Warp-Änderungen

Damit der Player-EQ-Graph **und** die EQ-Filter sich live anpassen,
wenn Warp-Toggle, -Strength oder -Mode geändert werden, muß
`pBuildEQ()` (Filter-Frequenzen neu setzen) und `pDrawEQ()` (Graph
neu zeichnen) bei diesen Ereignissen aufgerufen werden.

**Hinweis:** in Bauanleitung 68 wird `drawLvChart()` an dieselben
Stellen in `init.js` ergänzt. Die Player-Aufrufe gehören dort
ebenfalls hin — vermutlich sind sie schon teilweise vorhanden, weil
heute beim Warp-Toggle bereits ein Audio-Graph-Umbau passiert.

Konkret die folgenden Listener prüfen und sicherstellen, daß am Ende
**beides** läuft:

```js
    if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof pDrawEQ === "function") pDrawEQ();
```

Stellen in `js/init.js` (grep auf `pWarpOn`, `pWarpStrength`,
`pWarpMode`):

- Z. ~418: `pWarpOn = !pWarpOn;` (Warp-Toggle)
- Z. ~447 und ~464: `pWarpStrength`-Änderungen
- ggf. `pWarpMode`-Änderung

Beim **JSON-Load-Pfad** (Z. ~636) ebenfalls — auch hier ist
vermutlich schon ein Player-Render-Aufruf vorhanden, der nach
Warp-Restore feuert. Falls nicht, ergänzen.

**Wenn der genaue Stand in init.js unklar ist: Rückfrage stellen,
nicht raten.** Die Datei ist groß und stille Trial-and-Error-Edits
sind riskant.

---

## 6. Doku-Updates

### 6a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`player.js`** (Z. 143) ergänzen, daß `pBuildEQ`,
`pCompQ` und `pDrawEQ` seit Bauanleitung 69 `effFreqDisplay` statt
`effFreq` verwenden — damit folgen Filter-Frequenzen und Graph dem
Frequenz-Warping-Zustand.

Im **Datenfluss-Block** „Player Side-Modi" (Z. ~236–248) einen Satz
am Ende ergänzen, sinngemäß:

> Bei aktivem Frequenz-Warping verschieben sich die EQ-Filter-
> Frequenzen (`pBuildEQ`) und die x-Achse des EQ-Graphen (`pDrawEQ`)
> entsprechend; im „both"-Modus pro Channel mit der jeweiligen
> Seiten-Warp-Verschiebung (`effFreqDisplay(i, "left"/"right")`),
> im Mono-Modus mit `activeSide`.

### 6b. `docs/spec/06-player.md`

Falls dort der EQ-Graph beschrieben ist, einen Satz ergänzen,
sinngemäß:

> Bei aktivem Frequenz-Warping folgen die Säulen-Positionen des
> EQ-Graphen und die im Audio-Pfad eingehängten Biquad-Filter den
> gewarpten Wahrnehmungs-Frequenzen der Elektroden. Die Filter im
> Stereo-Modus werden pro Channel mit der jeweiligen Seiten-Warp-
> Verschiebung gesetzt.

---

## 7. Akzeptanztest (Klick-für-Klick)

**Voraussetzung:** Frequenzabgleich-Daten (`fRes`) liegen vor.

1. **App neu laden** (Cache-Bust). Tab „Player" öffnen,
   Frequenz-Warping **aus**.
   **Erwartet:** Player-EQ-Graph zeigt Säulen an gewohnten Cent-
   Positionen. Wenn Kurven im Kurven-Tab gesetzt sind, sind die
   entsprechenden EQ-Bars im Player sichtbar.

2. **Frequenz-Warping aktivieren** (Strength 100 %, var_side).
   **Erwartet:** EQ-Säulen wandern auf dem Graph sichtbar. Die
   Hz-Werte unter der x-Achse zeigen die gewarpten Frequenzen.

3. **Audio abspielen** (eine Audiodatei oder einen Satz).
   **Erwartet:** Klang ändert sich hörbar gegenüber dem
   Warp-Aus-Zustand (war schon vorher der Fall; jetzt wirkt
   zusätzlich der EQ auf den gewarpten Frequenzen).

4. **Strength** auf 50 % reduzieren.
   **Erwartet:** EQ-Säulen-Positionen verschieben sich halb so weit
   wie bei 100 %. Klang ändert sich entsprechend.

5. **Warp ausschalten.**
   **Erwartet:** EQ-Säulen kehren an die ursprünglichen Positionen
   zurück.

6. **Stereo-Modus „both" + Warp an + Strength 100 %.**
   **Erwartet:** Beide Channels haben EQ-Filter an ihren jeweiligen
   Seiten-Warp-Frequenzen. (Hörbarer Effekt erfordert beidseitige
   `fRes`-Daten; bei einseitigem CI ist der Effekt nur auf der
   CI-Seite hörbar.)

7. **Side-Wechsel** (left ↔ right) bei „both"-Modus + Warp aktiv.
   **Erwartet:** EQ-Graph zeigt jeweils die Seite mit ihren
   eigenen Warp-Positionen.

8. **Kurven-Tab parallel öffnen.**
   **Erwartet:** Cent-Achse im Kurven-Tab und im Player-EQ stimmen
   überein (beide nutzen `effFreqDisplay`).

9. **JSON speichern und neu laden** mit aktivem Warp.
   **Erwartet:** Player-EQ-Graph zeigt nach dem Laden die gewarpten
   Positionen.

10. **MAPLAW-Simulation** parallel aktivieren (sofern MED-EL).
    **Erwartet:** MAPLAW läuft unverändert auf den hartcodierten
    MED-EL-Standardfrequenzen (Filterbank im Worklet nicht
    angefaßt). Kein Crash, kein Audio-Aussetzer.

---

## 8. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §7 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.69-beta"`.
- `js/player.js`: `pCompQ` enthält **keinen** `effFreq(`-Aufruf mehr,
  sondern `effFreqDisplay(`.
- `js/player.js`: `pBuildEQ` enthält an den drei
  `f.frequency.value = ...`-Stellen `effFreqDisplay(...)`. Im
  Stereo-Pfad explizit mit Side-Argument
  (`effFreqDisplay(i, "left")` und `effFreqDisplay(i, "right")`).
- `js/player.js`: `pDrawEQ` ruft `buildCentAxis` mit dem hzGetter
  `function (i) { return effFreqDisplay(i); }` auf.
- `js/init.js`: bei den Warp-Listenern (Toggle, Strength, Mode,
  JSON-Load) werden sowohl `drawLvChart()` (aus BA 68) als auch
  `pBuildEQ()` + `pDrawEQ()` aufgerufen. Wenn unklar, **Rückfrage
  stellen**.
- `js/test.js`, `js/audio.js`, `js/freqmatch.js`, `js/maplaw.js`:
  **unverändert** — Tests und MAPLAW bleiben warp-frei.
- `docs/CODESTRUKTUR.md` und `docs/spec/06-player.md` sind
  entsprechend angepaßt.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 9. Hinweis für Folge-Anleitungen

- **Bauanleitung 70**: Schieber-Tab dezenter Hinweistext bei Warp
  + sichtbaren Kurven.
- **Bauanleitung 71**: Archiv-Druck-Renderer in `print-md.js`
  (`_archivChartKurven`, `_archivChartPlayerEq`) auf
  `effFreqDisplay` umstellen.
- Übersetzungen: keine neuen i18n-Strings in dieser Bauanleitung.
