# Bauanleitung 62 — Kurvenberechnung frequenzbasiert (log Hz / Cent)

## Ziel

Die geometrischen Kurvenfunktionen im Kurven-Tab (**Pivot, Tilt,
S-Kurve, Gauß**) sollen statt über den Elektroden-Index über die
**echte Frequenz** der Elektroden rechnen, und zwar in **log(Hz)** —
äquivalent zu Cent. Konkret:

- **Mittelpunkt** wird als **Hz-Wert** gespeichert (Default 1000 Hz
  für alle Hersteller, alle FATs).
- **Gauß-Breite** wird als **Cent-Wert** gespeichert (Default 1200 ¢
  = 1 Oktave).
- **Cent-Referenz**: 1000 Hz = 0 ¢ (audiologischer Standard).
- **Bass-/High-Boost-Grenzpunkt** bleibt eine **Kanal-Anzahl** —
  unverändert.
- **Sprache (SII)** und **Lautstärke** unverändert.
- Die **x-Achse des Charts bleibt unverändert** (gleichmäßige
  Elektroden-Abstände). Pivot wird dadurch optisch leicht schief
  dargestellt — das ist gewollt und Folge der Semantik-Änderung.
  Eine spätere Bauanleitung kann die x-Achse log-skalieren.

Alte JSON-Dateien werden beim Laden migriert (siehe §8). Beim
Speichern wird das neue Feld `presetFormat: "freq-v3"` geschrieben.

Die heute existierende Meldung „Geladen: N Messungen auf Seite X"
in `file.js:493` wird entfernt und durch eine **Migrationswarnung**
ersetzt, die nur erscheint, wenn eine alte Datei konvertiert wurde.

---

## 1. Versionsnummer hochzählen

In `js/version.js` die Konstante setzen:

```js
const APP_VERSION = "3.0.62-beta";
```

(Neues Versionsformat: `<Major>.<Minor>.<Bauanleitungsnummer>-beta`.
Die ersten beiden Stellen `3.0` werden ab jetzt nur manuell geändert.)

---

## 2. Cent-Hilfsfunktionen in core.js

In `js/core.js` direkt nach den `MFR`-Konstanten (etwa Z. 198) einen
neuen Hilfs-Block einfügen:

```js
// ============================================================
// FREQUENCY HELPERS (Cent, log-Interpolation)
// ============================================================
// Cent re 1000 Hz: 1000 Hz = 0 ¢, eine Oktave = 1200 ¢.
const CENT_REF_HZ = 1000;
function hzToCent(hz) {
  if (!hz || hz <= 0) return 0;
  return 1200 * Math.log2(hz / CENT_REF_HZ);
}
function centToHz(c) {
  return CENT_REF_HZ * Math.pow(2, c / 1200);
}
// Log-Interpolation zwischen zwei Frequenzen, t in [0,1].
function logInterpHz(f1, f2, t) {
  if (!f1 || !f2 || f1 <= 0 || f2 <= 0) return f1 || f2 || CENT_REF_HZ;
  return Math.exp(Math.log(f1) + t * (Math.log(f2) - Math.log(f1)));
}
// Mittlere Cent-Distanz pro Elektroden-Schritt einer Frequenzliste.
// Für Migration alter Breite-Werte (Kanal-Anzahl → Cent) gebraucht.
function meanCentStepOfFreqs(freqArr) {
  if (!freqArr || freqArr.length < 2) return 600;
  let sum = 0, n = 0;
  for (let i = 0; i < freqArr.length - 1; i++) {
    if (freqArr[i] > 0 && freqArr[i + 1] > 0) {
      sum += Math.abs(1200 * Math.log2(freqArr[i + 1] / freqArr[i]));
      n++;
    }
  }
  return n > 0 ? sum / n : 600;
}
```

---

## 3. Berechnung umstellen — `calcPresetCurve` in levels.js

In `js/levels.js` die vier Zweige **tilt, scurve, pivot, gauss** in
`calcPresetCurve` (Z. 5–88) ersetzen. Vorher liegt `ctr` als
Elektroden-Index vor; nachher als **Hz-Wert** in `pr.center`.

**Vorher (Z. 10–48 auszugsweise):**

```js
const ctr =
  pr.center != null
    ? pr.center
    : Math.floor((act[0] + act[act.length - 1]) / 2);
const mn = act[0],
  mx = act[act.length - 1],
  span = mx - mn || 1;
if (pr.type === "tilt") {
  for (const i of act) c[i] = (i - ctr) / (span / 2);
  ...
}
```

**Nachher:**

```js
// Mittelpunkt in Hz (Default 1000 Hz)
const ctrHz = pr.center != null ? pr.center : CENT_REF_HZ;
const ctrC = hzToCent(ctrHz);
// Span in Cent über die aktiven Elektroden
const fMin = effFreq(act[0]);
const fMax = effFreq(act[act.length - 1]);
const cMin = hzToCent(fMin);
const cMax = hzToCent(fMax);
const halfSpanC = Math.max(1, (cMax - cMin) / 2);

if (pr.type === "tilt") {
  for (const i of act) {
    const xC = hzToCent(effFreq(i)) - ctrC;
    c[i] = xC / halfSpanC;
  }
  const mx2 = Math.max(...c.map(Math.abs)) || 1;
  for (const i of act) c[i] /= mx2;
  return c;
}
if (pr.type === "scurve") {
  for (const i of act) {
    const x = (hzToCent(effFreq(i)) - ctrC) / halfSpanC;
    c[i] = Math.sign(x) * Math.pow(Math.abs(x), 0.6);
  }
  const mx2 = Math.max(...c.map(Math.abs)) || 1;
  for (const i of act) c[i] /= mx2;
  return c;
}
if (pr.type === "pivot") {
  for (const i of act) {
    const d = Math.abs(hzToCent(effFreq(i)) - ctrC) / halfSpanC;
    c[i] = -(d * d * 2 - 1);
  }
  const mx2 = Math.max(...c.map(Math.abs)) || 1;
  for (const i of act) c[i] /= mx2;
  return c;
}
if (pr.type === "gauss") {
  // Breite in Cent (Default 1200 ¢ = 1 Oktave)
  const sigC = Math.max(50, pr.width || 1200);
  for (const i of act) {
    const dC = hzToCent(effFreq(i)) - ctrC;
    c[i] = Math.exp(-0.5 * Math.pow(dC / sigC, 2));
  }
  const mx2 = Math.max(...c.map(Math.abs)) || 1;
  for (const i of act) c[i] /= mx2;
  return c;
}
```

Die Zweige **bassboost** (Z. 49–59), **highboost** (Z. 60–70),
**speech** (Z. 71–79) und **volume** (Z. 80–87) bleiben **unverändert**.

---

## 4. Defaults für neue Presets umstellen

### 4a. `js/state-side.js` — `initPresets()` (Z. 32–44)

**Vorher:**

```js
function initPresets() {
  const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
  const defaultCenter = centerMap[mfr] || Math.floor(nEl / 2);
  presets = PR_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: defaultCenter,
    width: Math.max(2, Math.floor(nEl / 4)),
    cutoff:
      tp === "bassboost" ? Math.floor(nEl / 3) : Math.floor((nEl * 2) / 3),
  }));
}
```

**Nachher:**

```js
function initPresets() {
  presets = PR_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: CENT_REF_HZ,   // 1000 Hz Default für alle
    width: 1200,           // 1200 ¢ = 1 Oktave (nur Gauß nutzt es)
    cutoff:
      tp === "bassboost" ? Math.floor(nEl / 3) : Math.floor((nEl * 2) / 3),
  }));
}
```

### 4b. `js/file.js` — Fallback in `applyLoadedData` (Z. 270–283)

**Vorher:**

```js
} else {
  const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
  const defaultCenter = centerMap[s.manufacturer] || Math.floor(s.nEl / 2);
  s.presets = PR_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: defaultCenter,
    width: Math.max(2, Math.floor(s.nEl / 4)),
    cutoff:
      tp === "bassboost"
        ? Math.floor(s.nEl / 3)
        : Math.floor((s.nEl * 2) / 3),
  }));
}
```

**Nachher:**

```js
} else {
  s.presets = PR_TYPES.map((tp) => ({
    type: tp,
    on: false,
    strength: 0,
    center: CENT_REF_HZ,
    width: 1200,
    cutoff:
      tp === "bassboost"
        ? Math.floor(s.nEl / 3)
        : Math.floor((s.nEl * 2) / 3),
  }));
}
```

---

## 5. UI in `buildPrTbl` (levels.js) umstellen

Die heutigen Selects für **Mittelpunkt** und **Breite** sind auf
Elektroden-Index zugeschnitten. Wir ersetzen sie durch
**Number-Inputs** mit Hz bzw. Cent.

### 5a. Default-Konstante entfernen

In `js/levels.js` Z. 193–194 löschen:

```js
const centerMap = { medel: 5.5, ab: 7.5, cochlear: 10.5 };
const defaultCenter = centerMap[mfr] || Math.floor(nEl / 2);
```

### 5b. Option-Builder ersetzen

In `js/levels.js` Z. 175–192 die Blöcke `ctrOpts`, `widthOpts` (und
nur `elOpts` für Cutoff behalten) anpassen:

**Vorher:**

```js
const pfx = dENPrefix();
let ctrOpts = "";
for (let i = 0; i < nEl; i++) {
  ctrOpts += `<option value="${i}">${pfx}${dEN(i)}</option>`;
  if (i < nEl - 1) {
    const halfVal = i + 0.5;
    const lbl = `${pfx}${dEN(i)}–${pfx}${dEN(i + 1)}`;
    ctrOpts += `<option value="${halfVal}">${lbl}</option>`;
  }
}
const elOpts = act
  .map((i) => `<option value="${i}">${pfx}${dEN(i)}</option>`)
  .join("");
const widthOpts = Array.from(
  { length: nEl },
  (_, i) => `<option value="${i + 1}">${i + 1}</option>`,
).join("");
```

**Nachher:**

```js
const pfx = dENPrefix();
const elOpts = act
  .map((i) => `<option value="${i}">${pfx}${dEN(i)}</option>`)
  .join("");
// Mittelpunkt: Number-Input in Hz (50–20000, Schritt 50).
// Breite (Gauß): Number-Input in Cent (50–4800, Schritt 50).
```

### 5c. Zeilen-HTML für Center/Width ändern (Z. 201–204)

**Vorher:**

```js
if (PR_HAS_CENTER[pr.type])
  params += ` <label>${t("lvPrCenter")}</label><select class="prCtr" data-pi="${pi}">${ctrOpts}</select>`;
if (PR_HAS_WIDTH[pr.type])
  params += ` <label>${t("lvPrWidth")}</label><select class="prWid" data-pi="${pi}">${widthOpts}</select>`;
```

**Nachher:**

```js
if (PR_HAS_CENTER[pr.type])
  params += ` <label>${t("lvPrCenter")}</label><input type="number" class="prCtr" data-pi="${pi}" min="50" max="20000" step="50" style="width:80px"> ${t("lvPrUnitHz")}`;
if (PR_HAS_WIDTH[pr.type])
  params += ` <label>${t("lvPrWidth")}</label><input type="number" class="prWid" data-pi="${pi}" min="50" max="4800" step="50" style="width:80px"> ${t("lvPrUnitCent")}`;
```

### 5d. Wert-Vorbelegung (Z. 210–214)

**Vorher:**

```js
const ctrSel = tr.querySelector(".prCtr");
if (ctrSel)
  ctrSel.value = pr.center !== undefined ? pr.center : defaultCenter;
const widSel = tr.querySelector(".prWid");
if (widSel) widSel.value = pr.width;
```

**Nachher:**

```js
const ctrInp = tr.querySelector(".prCtr");
if (ctrInp)
  ctrInp.value = Math.round(
    pr.center !== undefined ? pr.center : CENT_REF_HZ,
  );
const widInp = tr.querySelector(".prWid");
if (widInp) widInp.value = Math.round(pr.width != null ? pr.width : 1200);
```

### 5e. Change-Handler (Z. 281–292) — Clamping + Validierung

**Vorher (`.prCtr`):**

```js
tbl.querySelectorAll(".prCtr").forEach((sel) =>
  sel.addEventListener("change", function () {
    presets[+this.dataset.pi].center = parseFloat(this.value);
    lvOnChange();
  }),
);
tbl.querySelectorAll(".prWid").forEach((sel) =>
  sel.addEventListener("change", function () {
    presets[+this.dataset.pi].width = +this.value;
    lvOnChange();
  }),
);
```

**Nachher:**

```js
tbl.querySelectorAll(".prCtr").forEach((inp) =>
  inp.addEventListener("change", function () {
    const pi = +this.dataset.pi;
    let v = parseFloat(this.value);
    if (!isFinite(v) || v < 50) v = 50;
    if (v > 20000) v = 20000;
    presets[pi].center = v;
    this.value = Math.round(v);
    // Mirror auf andere Seite, falls Spiegelung aktiv
    if (document.getElementById("prBothSides")?.checked) {
      const otherSide = activeSide === "left" ? "right" : "left";
      const op = sideData[otherSide].presets;
      if (op && op[pi] && op[pi].type === presets[pi].type) {
        op[pi].center = v;
      }
    }
    lvOnChange();
  }),
);
tbl.querySelectorAll(".prWid").forEach((inp) =>
  inp.addEventListener("change", function () {
    const pi = +this.dataset.pi;
    let v = parseFloat(this.value);
    if (!isFinite(v) || v < 50) v = 50;
    if (v > 4800) v = 4800;
    presets[pi].width = v;
    this.value = Math.round(v);
    if (document.getElementById("prBothSides")?.checked) {
      const otherSide = activeSide === "left" ? "right" : "left";
      const op = sideData[otherSide].presets;
      if (op && op[pi] && op[pi].type === presets[pi].type) {
        op[pi].width = v;
      }
    }
    lvOnChange();
  }),
);
```

(`.prCut`-Handler unverändert lassen.)

---

## 6. `applyPresetDeltaOtherSide` (levels.js Z. 109–125)

Die Spiegelung der Form-Parameter spiegelt heute `center`, `width`,
`cutoff` 1:1. Das **bleibt korrekt**, weil die Werte ihre Bedeutung
geändert haben, aber die Spiegelungslogik dieselbe ist. **Keine
Änderung nötig** — nur prüfen, daß bei einem Test mit aktivierter
„Beide Seiten"-Checkbox die Cent-/Hz-Werte sauber auf die andere
Seite kopiert werden.

---

## 7. Print- und Export-Pfade prüfen

`tab-print.js` Z. 353–357 nutzt `PR_HAS_CENTER`/`WIDTH`/`CUTOFF`
ebenfalls — überprüfen, daß dort beim Druck nur `pr.center` /
`pr.width` ausgegeben wird und keine Elektroden-Beschriftung
versucht wird. Falls dort Texte wie „Mitte bei E5,5" erzeugt
werden: ersetzen durch „Mitte bei <Hz> Hz" und „Breite <Cent> ¢".
Falls sich solche Stellen ergeben, mit denselben i18n-Schlüsseln
`lvPrUnitHz` und `lvPrUnitCent` arbeiten.

---

## 8. JSON-Format und Migration in `file.js`

### 8a. Beim Speichern (`saveJson`, Z. ~83)

In das Top-Level-Objekt zusätzlich:

```js
presetFormat: "freq-v3",
```

einfügen — direkt neben `version: APP_VERSION`.

### 8b. Beim Laden (`applyLoadedData`)

**Reihenfolge:** Erst `electrodeFreqOwn` (Z. 286–293) und die
Hersteller-Standards laden, **dann** die Presets. Falls die
heutige Reihenfolge die Presets vor `elFreqOwn` verarbeitet,
**umstellen** — Migration braucht die Datei-FAT.

Direkt vor `s.presets = d.presets;` (Z. 269) eine
Migrations-Funktion einfügen:

```js
function _migratePresetsFromIndexToFreq(rawPresets, fileFreqs, fileElFreqOwn) {
  const effF = (i) =>
    fileElFreqOwn && fileElFreqOwn[i] != null ? fileElFreqOwn[i] : fileFreqs[i];
  const meanStep = meanCentStepOfFreqs(fileFreqs.map((_, i) => effF(i)));
  return rawPresets.map((pr) => {
    const np = { ...pr };
    // center: Elektroden-Index (ggf. fraktional) → Hz
    if (np.center != null) {
      const idx = np.center;
      const lo = Math.max(0, Math.min(fileFreqs.length - 1, Math.floor(idx)));
      const hi = Math.max(0, Math.min(fileFreqs.length - 1, Math.ceil(idx)));
      const t = idx - lo;
      const f = lo === hi ? effF(lo) : logInterpHz(effF(lo), effF(hi), t);
      np.center = +f.toFixed(1);
    } else {
      np.center = CENT_REF_HZ;
    }
    // width: Kanal-Anzahl → Cent
    if (np.width != null) {
      const newW = np.width * meanStep;
      np.width = Math.max(50, Math.min(4800, Math.round(newW)));
    } else {
      np.width = 1200;
    }
    // cutoff: unverändert
    return np;
  });
}
```

Dann den Lade-Block (Z. 268–284) auf folgendes Schema bringen:

```js
// Datei-FAT zuerst laden (für Migration nötig)
const fileFreqs = MFR[s.manufacturer]
  ? [...MFR[s.manufacturer].freqs]
  : (Array.isArray(d.freqs) ? [...d.freqs] : []);
const fileElFreqOwn = Array.isArray(d.electrodeFreqOwn)
  ? [...d.electrodeFreqOwn]
  : null;

const isOldFormat = d.presetFormat !== "freq-v3";
let didMigrate = false;
if (d.presets && Array.isArray(d.presets)) {
  if (isOldFormat) {
    s.presets = _migratePresetsFromIndexToFreq(
      d.presets,
      fileFreqs,
      fileElFreqOwn,
    );
    didMigrate = true;
  } else {
    s.presets = d.presets;
  }
} else {
  // Default-Fallback (unverändert aus §4b)
  s.presets = PR_TYPES.map((tp) => ({ ... }));
}
```

Das Flag `didMigrate` an den Aufrufer weiterreichen (Rückgabewert
oder lokale Variable in `loadJson`, siehe §9).

---

## 9. Alte „X Messungen geladen"-Meldung entfernen, Migrations-Toast einbauen

In `js/file.js` Z. 491–493 den blockenden `alert(...)` **ersatzlos
entfernen**. Stattdessen am Ende von `loadJson` (nach `applyLoadedData`,
außerhalb der Schleife über beide Seiten):

```js
// Migrationswarnung, nur wenn mindestens eine Seite migriert wurde
const migrated = ["left", "right"].some(
  (side) => sideData[side]._presetsMigrated === true,
);
if (migrated) {
  alert(t("loadMigratedCurves"));
  sideData.left._presetsMigrated = false;
  sideData.right._presetsMigrated = false;
}
```

Im Migrations-Pfad in `applyLoadedData` (§8b) das Flag setzen:

```js
if (didMigrate) {
  s._presetsMigrated = true;
}
```

---

## 10. i18n — neue deutsche Strings

In `i18n/de.js` im `Object.assign(L.de, { ... })`-Block folgende
Schlüssel ergänzen (oder bestehende `lvPrCenter` / `lvPrWidth`
prüfen — Beschriftung soll weiter „Mitte" bzw. „Breite" sein,
**nur** die zwei neuen Einheits-Schlüssel und der Migrations-
Hinweis sind neu):

```js
lvPrUnitHz: "Hz",
lvPrUnitCent: "¢",
loadMigratedCurves:
  "Die Kurvenberechnung wurde mathematisch präzisiert " +
  "(Frequenz-basiert statt elektroden-basiert). Deine alten " +
  "Kurven-Einstellungen wurden bestmöglich umgerechnet, der " +
  "vertraute Klang kann sich aber leicht ändern. Bitte die " +
  "Kurven im Tab „Kurven" prüfen und ggf. nachjustieren.",
```

`en.js`, `fr.js`, `es.js` **nicht** anfassen — fehlende Schlüssel
fallen auf Deutsch zurück. Die Übersetzungen kommen in einer
späteren Mini-Anleitung.

Falls `lvPrCenter` / `lvPrWidth` heute noch andere Beschriftungen
haben (z. B. „Mittel-Elektrode"), beide Werte in `i18n/de.js` auf
neutrale Begriffe setzen:

```js
lvPrCenter: "Mitte",
lvPrWidth: "Breite",
```

---

## 11. Doku-Updates

### 11a. `docs/BAUANLEITUNGEN_LEITLINIEN.md` Z. 70–77

**Vorher:**

> - **Versionsnummer hochzählen**: Jede Bauanleitung muß als
>   expliziten Schritt enthalten, in `js/version.js` die Konstante
>   `APP_VERSION` auf `"2.<Bauanleitungsnummer>-beta"` zu setzen
>   (z.B. Bauanleitung 58 → `"2.58-beta"`). …

**Nachher:**

> - **Versionsnummer hochzählen**: Jede Bauanleitung muß als
>   expliziten Schritt enthalten, in `js/version.js` die Konstante
>   `APP_VERSION` auf `"<Major>.<Minor>.<Bauanleitungsnummer>-beta"`
>   zu setzen. Die ersten beiden Stellen (`Major.Minor`) werden
>   **nur manuell** geändert (bei semantischen Brüchen). Die
>   Bauanleitungsnummer wird **immer** weitergezählt, unabhängig
>   von Major/Minor — z.B. Bauanleitung 62 → `"3.0.62-beta"`,
>   Bauanleitung 63 → `"3.0.63-beta"`. Ohne diesen Bump bleibt
>   der Browser-Cache bei der alten Version hängen und die Nutzer
>   sehen die Änderung nicht. Der Schritt gehört an den Anfang
>   oder ans Ende der Anleitung, nicht in die Mitte (sonst leicht
>   übersehen).

### 11b. `docs/spec/05-kurven.md`

Den Abschnitt „Jede Kurvenfunktion" so erweitern, daß klar wird:

- Pivot, Tilt, S-Kurve, Gauß rechnen in **log(Hz)** (Cent re 1000 Hz).
- **Mittelpunkt** als Hz-Wert, Default 1000 Hz, persistent in JSON.
- **Gauß-Breite** als Cent-Wert, Default 1200 ¢.
- Bass-/High-Boost-Grenzpunkt bleibt Kanal-Anzahl.
- Sprache (SII) und Lautstärke unverändert.
- Hinweis: die x-Achse ist (noch) gleichmäßig in Elektroden — Pivot
  erscheint dadurch optisch schief.

### 11c. `docs/CODESTRUKTUR.md`

Im Eintrag zu `core.js` (Z. 126) die neuen Hilfsfunktionen
ergänzen: `CENT_REF_HZ`, `hzToCent`, `centToHz`, `logInterpHz`,
`meanCentStepOfFreqs`.

Im Eintrag zu `file.js` (Z. 136) die neue Hilfsfunktion
`_migratePresetsFromIndexToFreq` ergänzen.

Falls der Abschnitt „Preset-Berechnung" (Z. 344–347) etwas über
die Berechnungs-Grundlage sagt: ergänzen, daß die geometrischen
Kurven in log(Hz) rechnen und `pr.center` (Hz) und `pr.width`
(Cent) als persistente Werte gespeichert werden.

---

## 12. Akzeptanztest (Klick-für-Klick)

1. **Frische Sitzung** (incognito oder LocalStorage geleert):
   Tab „Kurven" → Tabelle Kurvenfunktionen anschauen.
   **Erwartet:** Bei Pivot, Tilt, S-Kurve, Gauß steht im Feld
   „Mitte" jeweils `1000` mit Einheit `Hz`. Bei Gauß steht
   zusätzlich „Breite" `1200` mit Einheit `¢`.

2. **Pivot aktivieren**, Stärke z. B. auf `+10`. Chart oben
   anschauen.
   **Erwartet:** Pivot-Linie ist eine **leicht schiefe** Kuppel
   (nicht mehr eine perfekte Halbkugel), Scheitel liegt
   ungefähr bei der Elektrode, deren Frequenz am nächsten an
   1000 Hz liegt (bei MED-EL-Default zwischen E5 und E6).

3. **Mittelpunkt von Pivot** im Eingabefeld auf `500` Hz ändern.
   **Erwartet:** Scheitel verschiebt sich sichtbar nach links.

4. **Gauß aktivieren**, Stärke `+5`, Breite `600` ¢.
   **Erwartet:** schmälerer Gauß-Buckel im Chart. Bei Breite
   `2400` ¢ deutlich breiterer Buckel.

5. **Tilt aktivieren**, Stärke `+10`, Mitte `1000` Hz.
   **Erwartet:** Linie steigt von links nach rechts an, Null-
   Durchgang nahe 1000 Hz (visuell ungefähr bei E5–E6).

6. **JSON speichern** (Tab „Laden/Speichern"). Datei in einem
   Editor öffnen.
   **Erwartet:** Top-Level enthält `"presetFormat": "freq-v3"`
   und `"version": "3.0.62-beta"`. Im Presets-Array sind
   `center` und `width` als Hz/Cent-Zahlen erkennbar (z. B.
   `"center": 500`, `"width": 600`).

7. **Alte Datei laden:** Eine vor diesem Build gespeicherte
   JSON-Datei (z. B. aus 2.61-beta) laden.
   **Erwartet:**
   - Genau **ein** Popup mit dem Migrations-Hinweis erscheint
     („Die Kurvenberechnung wurde mathematisch präzisiert …").
   - **Kein** Popup „Geladen: N Messungen auf Seite X".
   - Im Kurven-Tab sind die alten Schieber wieder aktiv;
     Mittelpunkt steht jetzt als Hz-Wert (z. B. `1382` für
     ursprünglich E5,5 bei MED-EL-Default), Breite als Cent.
   - Direkt erneut speichern → neue Datei hat
     `"presetFormat": "freq-v3"`.

8. **Lautstärke und Sprache (SII)** je einmal aktivieren.
   **Erwartet:** Funktionieren wie bisher unverändert.

9. **Bass Boost / High Boost** aktivieren, Grenzpunkt verstellen.
   **Erwartet:** unverändertes Verhalten, weiterhin
   Kanal-Auswahl.

10. **Mobile (≤ 768 px):** Eingabefelder Mitte/Breite testen.
    **Erwartet:** Mit `applyMobileReadonly` weiterhin korrekt
    bedienbar (auf Touch-Geräten als readonly mit numeric
    keyboard).

---

## 13. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §12 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.62-beta"`.
- `js/core.js`: `CENT_REF_HZ`, `hzToCent`, `centToHz`,
  `logInterpHz`, `meanCentStepOfFreqs` existieren.
- `js/levels.js` `calcPresetCurve`: in den vier Zweigen tilt,
  scurve, pivot, gauss wird `effFreq(i)` und `hzToCent(...)`
  verwendet, **nicht** mehr `(i - ctr)`.
- `js/state-side.js` `initPresets`: kein `centerMap` mehr,
  `center: CENT_REF_HZ`, `width: 1200`.
- `js/file.js` Default-Fallback (§4b) ebenso umgestellt.
- `js/file.js` `saveJson`: `presetFormat: "freq-v3"` wird
  geschrieben.
- `js/file.js` `applyLoadedData`: Migration läuft nur wenn
  `d.presetFormat !== "freq-v3"`, und nur dann erscheint die
  Migrations-Meldung.
- Der alte `alert("Geladen: ${msgCount} Messungen auf Seite …")`
  ist entfernt.
- `docs/BAUANLEITUNGEN_LEITLINIEN.md` Z. 70 ff. enthält die neue
  Versions-Regel.
- `docs/spec/05-kurven.md` und `docs/CODESTRUKTUR.md` sind
  entsprechend angepaßt.

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 14. Folge-Anleitungen (nicht in diese Anleitung)

- **Bauanleitung 63** (geplant): Cent-Spalte in der Elektroden-
  Tabelle (`buildFreqTable` in `freq-table.js`). Neue Spalte
  „¢" zwischen „Hz (eigen)" und „Schwelle", Wert
  `Math.round(hzToCent(effFreq(i)))`, Header-i18n-Key
  `thCentRel1k` o. ä.
- **Migrations-Warnung präzisieren** (eigene kleine Folge-Anleitung
  oder Teil von 63): Den Toast `loadMigratedCurves` **nicht**
  anzeigen, wenn die alte Datei keine effektive Kurvenänderung
  betrifft. Konkret: Warnung **unterdrücken**, wenn für **beide
  Seiten** gilt — alle vier migrationsrelevanten Kurven (tilt,
  scurve, pivot, gauss) haben `strength === 0`, **oder** nur
  `speech` (SII) hat eine von 0 abweichende Stärke. Das `on`-Flag
  ist dabei egal: auch eine deaktivierte Kurve mit Wert ≠ 0 zählt
  als „betroffen", weil der Nutzer sie evtl. später wieder
  einschaltet. Begründung: SII bleibt unverändert frequenzbasiert,
  und Kurven mit Stärke 0 verändern den Klang nicht — eine Warnung
  wäre dort übergriffig.
- **Mini-Anleitung Übersetzungen**: `en.js`, `fr.js`, `es.js`
  für `lvPrUnitHz`, `lvPrUnitCent`, `loadMigratedCurves` und
  (nach Bauanleitung 63) `thCentRel1k` ergänzen.

---
