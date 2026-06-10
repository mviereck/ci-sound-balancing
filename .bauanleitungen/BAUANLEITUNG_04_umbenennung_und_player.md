# Bauanleitung 04 — Umbenennung „Schieber → Levels", alter Tab → „Kurven", Player-Erweiterung

## Ziel

Phase 2 nach Bauanleitung 03. Endzustand:

- Der in 03 angelegte Tab „Schieber" heißt jetzt sichtbar **„Levels"**
  (DE/EN), „Niveaux" (FR), „Niveles" (ES).
- Der alte Levels-Tab heißt sichtbar **„Kurven"** und enthält nur noch
  die Preset-Bedienung und das 4-Linien-Chart. Das Manuell-Grid und der
  Reset-Button werden entfernt; die Pfeiltasten-Logik für `panel-levels`
  entfällt.
- Die Manuell-Linie im Chart ist Default off.
- Der Player bekommt einen dritten Source-Button **„Kurven"**, sodass
  drei unabhängige Toggles existieren (Messung / Levels / Kurven), alle
  drei Default an.
- JSON-Format wird um getrennte Flags erweitert; alte JSONs (mit
  `playerSource: "both"` etc.) werden migriert.

**Vorbedingung**: Bauanleitung 03 muss abgeschlossen sein.
`levels-tab.js` existiert, `manualLevels` ist gemeinsamer State,
beide Tabs funktionieren parallel.

**DOM-IDs bleiben unverändert**: `id="tabLevels"`/`panel-levels`
gehört weiterhin zum alten Tab (jetzt sichtbar „Kurven"), und
`id="tabSchieber"`/`panel-schieber` gehört weiterhin zum neuen Tab
(jetzt sichtbar „Levels"). Nur die sichtbaren Strings und die i18n-Keys
ändern sich. Das hält den Diff klein und alle bestehenden
`document.getElementById`-Stellen funktionieren ohne Änderung.

---

## Schritt 1 — i18n-Strings umstellen

In `i18n.js` in **allen vier Sprachblöcken**:

### 1a) `tabLevels` Inhalt unverändert lassen

Der Key `tabLevels` behält in allen vier Sprachen den Inhalt
„Levels"/„Levels"/„Levels"/„Levels". Wird ab jetzt aber dem **neuen
Tab** zugeordnet (siehe Schritt 1d).

### 1b) Neuen Key `tabCurves` ergänzen

Direkt unter `tabLevels` einfügen:

- **DE**: `tabCurves: "Kurven",`
- **EN**: `tabCurves: "Curves",`
- **FR**: `tabCurves: "Courbes",`
- **ES**: `tabCurves: "Curvas",`

### 1c) Bestehenden Key `tabSchieber` löschen

Aus Bauanleitung 03 stammen folgende Keys, die jetzt überflüssig sind:

```javascript
tabSchieber: "Schieber",     // DE — löschen
tabSchieber: "Sliders",      // EN — löschen
tabSchieber: "Curseurs",     // FR — löschen
tabSchieber: "Deslizadores", // ES — löschen
```

Alle vier löschen.

### 1d) `applyLang`-Zuordnung in `i18n.js`

In `applyLang` (Z. 1746ff) den Block der Tab-Buttons anpassen:

**vorher** (Stand nach Bauanleitung 03):
```javascript
s("tabIntro", "tabIntro");
s("tabSetup", "tabFreq");
// tabTest und tabResults haben feste mehrsprachige Texte unten
s("tabLevels", "tabLevels");
s("tabSchieber", "tabSchieber");
s("tabPlayer", "tabPlayer");
```

**nachher**:
```javascript
s("tabIntro", "tabIntro");
s("tabSetup", "tabFreq");
// tabTest und tabResults haben feste mehrsprachige Texte unten
s("tabLevels", "tabCurves");       // alter Tab heißt jetzt "Kurven"
s("tabSchieber", "tabLevels");     // neuer Tab heißt jetzt "Levels"
s("tabPlayer", "tabPlayer");
```

### 1e) Player-Strings ergänzen

Im selben Sprachblock-Bereich, wo `plSrcLevels` definiert ist:

- **DE**: nach `plSrcLevels: "Levels",` einfügen
  `plSrcCurves: "Kurven",`
- **EN**: `plSrcCurves: "Curves",`
- **FR**: `plSrcCurves: "Courbes",`
- **ES**: `plSrcCurves: "Curvas",`

### 1f) Schieber-Tab-Strings sprachlich nachziehen (optional aber empfohlen)

In Bauanleitung 03 wurden die Schieber-Tab-Strings (`lvTabTitle` etc.)
mit dem Inhalt „Schieber"/„Sliders"/… angelegt. Da der Tab jetzt
„Levels" heißt, ist es konsequent, auch diese Strings sprachlich zu
aktualisieren — der Inhalt bleibt im Wesentlichen gleich, nur der
einleitende Begriff. Konkret:

- DE: `lvTabTitle: "Levels",`
- EN: `lvTabTitle: "Levels",`
- FR: `lvTabTitle: "Niveaux",`
- ES: `lvTabTitle: "Niveles",`

`lvTabDesc`, `lvTabSrcSlider`, `lvTabSrcMeas`, `lvTabSrcCurves`,
`lvTabReset`, `lvTabKeyHint` können inhaltlich gleich bleiben — keine
Tweet-spezifischen Anpassungen erforderlich. Im Zweifel beim Schreiben
das Wort „Schieber"/„Sliders" im Beschreibungstext stehen lassen
(beschreibt die UI-Elemente, nicht den Tab-Namen).

---

## Schritt 2 — HTML-Änderungen

### 2a) Manuell-Grid-Card aus `panel-levels` entfernen

In `index.html` den dritten `<div class="card">`-Block im
`panel-levels` löschen. Das ist der Block ab dem `<h2 data-t="lvTitle">`
bis einschließlich dem zugehörigen `</div>`. Konkret etwa Z. 733–748:

**vorher**:
```html
<div class="card">
  <h2 data-t="lvTitle"></h2>
  <div class="explain" style="margin-bottom: 14px" data-t="lvExpl"></div>
  <div class="lv-grid" id="lvGrid"></div>
  <div style="margin-top: 10px">
    <button class="btn btn-sm" id="lvResetBtn" data-t="lvReset"></button>
  </div>
</div>
```

**nachher**:
Diesen Block komplett entfernen.

Nach dem Entfernen besteht `panel-levels` nur noch aus zwei Cards:
Übersicht (Chart) und Presets.

### 2b) `lvChkMan` Default off

In `index.html` Z. 675 — beim Manuell-Linie-Checkbox in der Chart-
Legende:

**vorher**:
```html
<input type="checkbox" id="lvChkMan" checked />
```

**nachher**:
```html
<input type="checkbox" id="lvChkMan" />
```

(Das `checked`-Attribut weglassen.)

### 2c) Player: dritter Source-Button

In `index.html` im Player-Panel, Z. 802–814 erweitern. Den vorhandenen
zweiten Button (`plSrcLevelsBtn`) und einen neuen dritten Button für
„Kurven" einfügen.

**vorher**:
```html
<button
  id="plSrcMeasBtn"
  class="btn btn-sm"
  style="min-width: 120px"
  data-t="plSrcMeas"
></button>
<button
  id="plSrcLevelsBtn"
  class="btn btn-sm"
  style="min-width: 80px"
  data-t="plSrcLevels"
></button>
```

**nachher**:
```html
<button
  id="plSrcMeasBtn"
  class="btn btn-sm"
  style="min-width: 120px"
  data-t="plSrcMeas"
></button>
<button
  id="plSrcLevelsBtn"
  class="btn btn-sm"
  style="min-width: 80px"
  data-t="plSrcLevels"
></button>
<button
  id="plSrcCurvesBtn"
  class="btn btn-sm"
  style="min-width: 80px"
  data-t="plSrcCurves"
></button>
```

---

## Schritt 3 — State erweitern (`state-side.js`)

In `state-side.js` Z. 401–402:

**vorher**:
```javascript
let plSrcMeas = true,
  plSrcLevels = true; // EQ source toggles
```

**nachher**:
```javascript
let plSrcMeas = true,
  plSrcLevels = true,
  plSrcCurves = true; // EQ source toggles
```

Bedeutung jetzt:

- `plSrcMeas`: Messwerte aus `compWLS().levels` einrechnen
- `plSrcLevels`: **nur** `manualLevels` (Schieber-Werte) einrechnen
  — Inhalt der Variable ändert sich!
- `plSrcCurves`: **nur** `getTotalPresetCurve()` (Presets) einrechnen

Default: alle drei `true` (User-Vorgabe: alle drei Quellen Default an).

---

## Schritt 4 — `player.js` `computeGains` splitten

In `player.js` Z. 105–123:

**vorher**:
```javascript
function computeGains() {
  const { levels } = compWLS();
  const eff = getEffectiveLevels();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    const hd = bRes.some(
      (r) =>
        (r.a === i || r.b === i) &&
        elSt[r.a] !== "excluded" &&
        elSt[r.a] !== "mute" &&
        elSt[r.b] !== "excluded" &&
        elSt[r.b] !== "mute",
    );
    const addMeas = plSrcMeas && hd ? levels[i] : 0;
    const addLvls = plSrcLevels ? -eff[i] : 0;
    g[i] = addMeas + addLvls;
  }
  return g;
}
```

**nachher**:
```javascript
function computeGains() {
  const { levels } = compWLS();
  const presetCurve = getTotalPresetCurve();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    const hd = bRes.some(
      (r) =>
        (r.a === i || r.b === i) &&
        elSt[r.a] !== "excluded" &&
        elSt[r.a] !== "mute" &&
        elSt[r.b] !== "excluded" &&
        elSt[r.b] !== "mute",
    );
    const addMeas = plSrcMeas && hd ? levels[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
    g[i] = addMeas + addLvls + addCurves;
  }
  return g;
}
```

Beachten: Das Vorzeichen bleibt negativ (`-manualLevels[i]`,
`-presetCurve[i]`) — die Konvention „Anhebung in Levels → Absenkung im
Player-EQ" bleibt unverändert.

## Schritt 5 — `player.js` `plCheck` erweitern

In `player.js` Z. 463–472:

**vorher**:
```javascript
function plCheck() {
  const hMeas = bRes.length > 0;
  const hLv =
    manualLevels.some((v) => v !== 0) ||
    presets.some((p) => p.on && p.strength !== 0);
  const hasData = (plSrcMeas && hMeas) || (plSrcLevels && hLv);
  document
    .getElementById("plNoD")
    .classList.toggle("hidden", hasData || hMeas || hLv);
  ...
```

**nachher**:
```javascript
function plCheck() {
  const hMeas = bRes.length > 0;
  const hLv = manualLevels.some((v) => v !== 0);
  const hCur = presets.some((p) => p.on && p.strength !== 0);
  const hasData =
    (plSrcMeas && hMeas) ||
    (plSrcLevels && hLv) ||
    (plSrcCurves && hCur);
  document
    .getElementById("plNoD")
    .classList.toggle("hidden", hasData || hMeas || hLv || hCur);
  ...
```

(Restliche Funktion unverändert.)

---

## Schritt 6 — `tabs-eq.js` `updPlSrcButtons` erweitern

In `tabs-eq.js` Z. 101–119:

**vorher**:
```javascript
function updPlSrcButtons() {
  const mBtn = document.getElementById("plSrcMeasBtn");
  const lBtn = document.getElementById("plSrcLevelsBtn");
  if (!mBtn || !lBtn) return;
  const activeS =
    "background:var(--success);color:#fff;border-color:var(--success)";
  const inactS = "";
  mBtn.style.cssText = plSrcMeas ? activeS : inactS;
  lBtn.style.cssText = plSrcLevels ? activeS : inactS;
  // Sync hidden select
  const sel = document.getElementById("plSrc");
  if (sel) {
    if (plSrcMeas && plSrcLevels) sel.value = "both";
    else if (plSrcMeas) sel.value = "measured";
    else if (plSrcLevels) sel.value = "levels";
    else sel.value = "measured"; // fallback
  }
  updEqToggleBtn();
}
```

**nachher**:
```javascript
function updPlSrcButtons() {
  const mBtn = document.getElementById("plSrcMeasBtn");
  const lBtn = document.getElementById("plSrcLevelsBtn");
  const cBtn = document.getElementById("plSrcCurvesBtn");
  if (!mBtn || !lBtn || !cBtn) return;
  const activeS =
    "background:var(--success);color:#fff;border-color:var(--success)";
  const inactS = "";
  mBtn.style.cssText = plSrcMeas ? activeS : inactS;
  lBtn.style.cssText = plSrcLevels ? activeS : inactS;
  cBtn.style.cssText = plSrcCurves ? activeS : inactS;
  // Sync hidden legacy select (best effort)
  const sel = document.getElementById("plSrc");
  if (sel) {
    if (plSrcMeas && (plSrcLevels || plSrcCurves)) sel.value = "both";
    else if (plSrcMeas) sel.value = "measured";
    else if (plSrcLevels || plSrcCurves) sel.value = "levels";
    else sel.value = "measured";
  }
  updEqToggleBtn();
}
```

Und `updEqToggleBtn` Z. 120–139:

**vorher**:
```javascript
const bothOff = plEqOn && !plSrcMeas && !plSrcLevels;
```

**nachher**:
```javascript
const allOff = plEqOn && !plSrcMeas && !plSrcLevels && !plSrcCurves;
```

Den Bezeichner-Variablennamen `bothOff` in den 3 Vorkommen unten in
derselben Funktion zu `allOff` ändern.

---

## Schritt 7 — `init.js` aufräumen

### 7a) Alten Pfeiltasten-Listener für `panel-levels` entfernen

In `init.js` Z. 836–870 den Block „Levels keyboard nav" **komplett
entfernen** (er ist obsolet, weil das Manuell-Grid weg ist und die
Pfeiltasten-Navigation jetzt im Schieber-Tab über `levels-tab.js`
läuft):

```javascript
// Levels keyboard nav
document.addEventListener("keydown", function (e) {
  const lvPanel = document.getElementById("panel-levels");
  if (!lvPanel.classList.contains("active")) return;
  ...
});
```

Diesen `document.addEventListener("keydown", ...)`-Block komplett
löschen. Der Schieber-Tab-Listener (in Bauanleitung 03 hinzugefügt)
bleibt erhalten.

### 7b) `lvResetBtn`-Handler entfernen

In `init.js` Z. 679–683 den Block:

```javascript
// Levels tab
document.getElementById("lvResetBtn").addEventListener("click", function () {
  manualLevels.splice(0, manualLevels.length, ...new Array(nEl).fill(0));
  buildLvGrid();
  lvOnChange();
});
```

**komplett entfernen** (Button existiert nicht mehr; Reset läuft über
den Schieber-Tab).

Der nachfolgende Block für `lvChkMeas`/`lvChkMan`/`lvChkPre` bleibt:

```javascript
["lvChkMeas", "lvChkMan", "lvChkPre"].forEach((id) =>
  document.getElementById(id).addEventListener("change", drawLvChart),
);
```

### 7c) Dritter Player-Source-Listener

In `init.js` Z. 702–718, nach dem `plSrcLevelsBtn`-Listener ergänzen:

**vorher**:
```javascript
document
  .getElementById("plSrcLevelsBtn")
  .addEventListener("click", function () {
    plSrcLevels = !plSrcLevels;
    updPlSrcButtons();
    if (pEqF.length > 0) pUpdEQ();
    else plCheck();
  });
```

**nachher**:
```javascript
document
  .getElementById("plSrcLevelsBtn")
  .addEventListener("click", function () {
    plSrcLevels = !plSrcLevels;
    updPlSrcButtons();
    if (pEqF.length > 0) pUpdEQ();
    else plCheck();
  });
document
  .getElementById("plSrcCurvesBtn")
  .addEventListener("click", function () {
    plSrcCurves = !plSrcCurves;
    updPlSrcButtons();
    if (pEqF.length > 0) pUpdEQ();
    else plCheck();
  });
```

### 7d) Print-Source-Label erweitern

In `init.js` Z. 317–332 wird die `srcLabel`-Berechnung gemacht. Drei
unabhängige Quellen brauchen eine geänderte Logik:

**vorher**:
```javascript
const src =
  plSrcMeas && plSrcLevels
    ? "both"
    : plSrcMeas
      ? "measured"
      : plSrcLevels
        ? "levels"
        : "measured";
const srcLabel =
  {
    measured: "Gemessen",
    levels: "Levels",
    both: "Beide (addiert)",
    none: "Keine",
  }[src] || src;
```

**nachher**:
```javascript
const parts = [];
if (plSrcMeas) parts.push("Gemessen");
if (plSrcLevels) parts.push("Levels");
if (plSrcCurves) parts.push("Kurven");
const srcLabel = parts.length ? parts.join(" + ") : "Keine";
```

(Sprachabhängige Beschriftung im Ausdruck war auch vorher hartkodiert
in Deutsch — bleibt so, oder ergänzend i18n-fähig machen. Für 04 nicht
zwingend.)

### 7e) Autosave-Block (Z. 1010–1017) aktualisieren

**vorher**:
```javascript
playerSource:
  plSrcMeas && plSrcLevels
    ? "both"
    : plSrcMeas
      ? "measured"
      : plSrcLevels
        ? "levels"
        : "none",
```

**nachher**:
```javascript
playerSourceMeas: plSrcMeas,
playerSourceLevels: plSrcLevels,
playerSourceCurves: plSrcCurves,
```

### 7f) Autosave-Loader (Z. 935–937) aktualisieren

Suchen nach `d.playerSource ===`-Block im `applyLoadedData`-Pfad oder
direkt im `init.js` (Z. 935–937):

**vorher**:
```javascript
plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
updPlSrcButtons();
```

**nachher**:
```javascript
if (typeof d.playerSourceMeas === "boolean") {
  plSrcMeas = d.playerSourceMeas;
  plSrcLevels = !!d.playerSourceLevels;
  plSrcCurves = !!d.playerSourceCurves;
} else if (typeof d.playerSource === "string") {
  // Migration aus alten JSONs
  plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
  plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
  plSrcCurves = d.playerSource === "levels" || d.playerSource === "both";
}
updPlSrcButtons();
```

Migration: alte JSONs mit `"both"` → alle drei an. Mit `"levels"` →
Levels+Kurven an, Messung aus. Mit `"measured"` → nur Messung an. Mit
`"none"` → alle aus.

---

## Schritt 8 — `levels.js` Manuell-Grid-Funktionen entfernen

In `levels.js`:

### 8a) `buildLvGrid` umschreiben

Die Funktion baut bisher das Manuell-Grid + ruft `buildPrTbl()` auf.
Da das Grid wegfällt, bleibt nur noch der `buildPrTbl`-Aufruf. Sauber:
Funktion **streichen** und alle Aufrufer auf `buildPrTbl()` umstellen.

Aufrufer:
- `state-side.js` Z. 143 (in `setActiveSide`): `buildLvGrid()` →
  `buildPrTbl()`
- `tabs-eq.js` Z. 67–70 (`switchTab`): `buildLvGrid(); drawLvChart();`
  → `buildPrTbl(); drawLvChart();`
- `file.js` Z. 102, 115 (`applyLoadedData`-Pfad): jeweils
  `buildLvGrid()` → `buildPrTbl()`

Funktionen aus `levels.js` **komplett entfernen**:

- `buildLvGrid` (Z. 99–190 in `levels.js`)
- `updLvFocus` (Z. 191–198)
- `updAllBars` (Z. 204–227)

Funktionen behalten:

- `calcPresetCurve` (Z. 5–81)
- `getTotalPresetCurve` (Z. 82–90)
- `getEffectiveLevels` (Z. 91–94) — wird woanders nicht mehr verwendet,
  könnte mit entfernt werden. **Prüfen mit `grep`**: aktuell nutzt sie
  `chart.js` und `drawLvChart`. Wenn `drawLvChart` weiter `eff` braucht
  (Z. 396 in levels.js: `const manV = act.map((i) => manualLevels[i]);`
  — nein, der Chart liest direkt aus `manualLevels` und
  `getTotalPresetCurve`, nicht aus `getEffectiveLevels`).
  → `getEffectiveLevels` kann entfernt werden. Vorher: `grep
  "getEffectiveLevels" *.js`. Wenn keine weiteren Treffer außer in
  Player (der ist in Schritt 4 angepasst), dann löschen.

### 8b) `lvOnChange` anpassen

Bisher (Z. 199–203):
```javascript
function lvOnChange() {
  updAllBars();
  drawLvChart();
  if (typeof lvTabDraw === "function") lvTabDraw();
  if (pEqF.length > 0) pUpdEQ();
}
```

Nach Streichen von `updAllBars`:
```javascript
function lvOnChange() {
  drawLvChart();
  if (typeof lvTabDraw === "function") lvTabDraw();
  if (pEqF.length > 0) pUpdEQ();
}
```

### 8c) `drawLvChart`: Default-Verhalten der Manuell-Linie

Die Funktion liest die Checkbox `lvChkMan` und zeichnet die
Manuell-Linie wenn checked. Da in Schritt 2b der `checked`-Default
entfernt wurde, ist das Default-Verhalten jetzt: Manuell-Linie aus.
Kein weiterer Code-Eingriff nötig.

### 8d) `lvFocus` als globaler State

`lvFocus` ist in `state-side.js` Z. 24 deklariert (`let lvFocus = 0;`).
Wird vom Schieber-Tab nicht verwendet (der nutzt `lvTabFocus`).
Kann **bleiben** für Kompatibilität, oder entfernt werden. Empfehlung:
bleibt — niemand stört sich an einer unbenutzten Variable, und das
Risiko, mit dem Entfernen einen anderen `lvFocus`-Referenzpfad zu
kappen, ist nicht null. Wenn entfernt werden soll: `grep "lvFocus"
*.js` und alle Vorkommen entfernen.

---

## Schritt 9 — `file.js` Persistenz

Analog zu Schritt 7e/7f in `init.js` auch hier.

### 9a) `saveJson` (Z. 187–195 ungefähr)

**vorher**:
```javascript
playerSource:
  plSrcMeas && plSrcLevels
    ? "both"
    : plSrcMeas
      ? "measured"
      : plSrcLevels
        ? "levels"
        : "none",
```

**nachher**:
```javascript
playerSourceMeas: plSrcMeas,
playerSourceLevels: plSrcLevels,
playerSourceCurves: plSrcCurves,
```

### 9b) `applyLoadedData` (Z. 410–417 ungefähr)

**vorher**:
```javascript
if (typeof d.playerSource === "string") {
  plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
  plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
} else {
  plSrcMeas = true;
  plSrcLevels = true;
}
```

**nachher**:
```javascript
if (typeof d.playerSourceMeas === "boolean") {
  plSrcMeas = d.playerSourceMeas;
  plSrcLevels = !!d.playerSourceLevels;
  plSrcCurves = !!d.playerSourceCurves;
} else if (typeof d.playerSource === "string") {
  plSrcMeas = d.playerSource === "measured" || d.playerSource === "both";
  plSrcLevels = d.playerSource === "levels" || d.playerSource === "both";
  plSrcCurves = d.playerSource === "levels" || d.playerSource === "both";
} else {
  plSrcMeas = true;
  plSrcLevels = true;
  plSrcCurves = true;
}
```

---

## Schritt 10 — `CODESTRUKTUR.md` aktualisieren

Im selben Arbeitsschritt:

- Tab-Tabelle: alter Eintrag „Levels" wird zu „Kurven", Inhalt
  „nur Preset-Bedienung und Chart". Neuer Eintrag „Levels" verweist
  auf `levels-tab.js`. Hinweis: die DOM-IDs sind aus historischen
  Gründen „kreuzverdrahtet": `panel-levels` gehört zu „Kurven",
  `panel-schieber` zu „Levels".
- Datenfluß-Block: `plSrcLevels` bedeutet jetzt **nur manualLevels**,
  nicht mehr „Manuell + Presets". Neuer Eintrag `plSrcCurves` für
  Preset-Anteil. Player rechnet drei unabhängige Source-Toggles
  zusammen.
- `getEffectiveLevels` wird nicht mehr genutzt (falls entfernt:
  Zeile löschen; falls behalten: als „intern unbenutzt, deprecated"
  markieren).
- Modul-Tabelle: `levels.js` enthält jetzt nur noch
  `calcPresetCurve`, `getTotalPresetCurve`, `buildPrTbl`,
  `drawLvChart`, `applyPresetDeltaOtherSide`, `lvOnChange`.
  Frühere Funktionen `buildLvGrid`, `updLvFocus`, `updAllBars`
  sind entfernt.

## Schritt 11 — `SPEC.md` aktualisieren

- Tab-Übersicht: Bezeichnungen anpassen (alter Levels-Tab heißt
  „Kurven", Schieber-Tab heißt „Levels"). Reihenfolge im Tool:
  zwischen „Meßergebnisse" und „Player" stehen jetzt „Levels"
  und „Kurven" in dieser Reihenfolge.
- Levels-Tab-Beschreibung (neuer Tab): identisch zu Bauanleitung 03,
  aber Tabname jetzt „Levels".
- Kurven-Tab-Beschreibung: nur noch Preset-Bedienung + 4-Linien-Chart
  (Messung / Manuell / Preset / Summe). Manuell-Linie Default off.
  Sieben Presets unverändert.
- Player: drei unabhängige Quellen-Toggles (Messung / Levels / Kurven),
  alle drei Default an. Print- und Speicher-Format reflektieren das.
- Section „Offene Punkte" — „MCL-Eingabefelder pro Elektrode" bleibt
  unter Warteliste; explizit klarstellen, daß der jetzige „Levels"-Tab
  **keine** MCL-Werte enthält, sondern dB-Offsets.

---

## Akzeptanztest-Checkliste

Vom Nutzer durchzugehen:

1. **Tool neu laden**. Tab-Bar zeigt von links nach rechts: Einführung,
   Implantat, Messungen, Meßergebnisse, **Levels**, **Kurven**, Player,
   Laden/Speichern.
2. **Tab „Levels" klicken** → senkrechte Balken wie aus 03, alles
   funktioniert. Beschriftung „Levels".
3. **Tab „Kurven" klicken** → zeigt nur das 4-Linien-Chart und die
   Preset-Tabelle. Kein Manuell-Grid mehr. Kein „Manuelle Werte
   zurücksetzen"-Button. Die Manuell-Linien-Checkbox in der
   Chart-Legende ist **nicht** angehakt; das Chart zeigt keine grüne
   Manuell-Linie, bis der User sie aktiviert.
4. **Manuell-Checkbox ankreuzen** im Kurven-Tab → grüne Linie
   erscheint, identisch zum vorherigen Verhalten.
5. **Im Levels-Tab einen Wert per ↑ ändern** → Manuell-Linie im
   Kurven-Chart (sofern angekreuzt) folgt; Summenlinie aktualisiert.
6. **Player öffnen** → drei Buttons in einer Reihe: „Gemessen",
   „Levels", „Kurven", alle drei mit aktivem (grünem) Hintergrund.
7. **„Levels"-Button im Player aus** → Klang ändert sich; im EQ-Bild
   (`pDrawEQ`) sind die manuellen Korrekturen weg, Presets weiter
   drin. Toggle zurück → manuelle Korrektur wieder hörbar.
8. **„Kurven"-Button im Player aus** → Preset-Korrektur weg, Messung
   und Schieber bleiben.
9. **„Gemessen"-Button im Player aus** → Messung weg, Schieber und
   Presets bleiben.
10. **JSON speichern**. Datei zeigt drei Felder: `playerSourceMeas`,
    `playerSourceLevels`, `playerSourceCurves`. Kein `playerSource`-
    String mehr.
11. **Altes JSON laden** (aus früherer Version, mit
    `playerSource: "both"`) → alle drei Toggles werden auf an gesetzt.
12. **Sprachwechsel** durch alle vier Sprachen: Tab-Beschriftungen
    Levels/Kurven, Player-Buttons Messung/Levels/Kurven (in den
    entsprechenden Übersetzungen) korrekt angezeigt.
13. **Side-Wechsel** (LINKS ↔ RECHTS): beide Tabs zeigen die Werte
    der jeweiligen Seite.
14. **Reset im Levels-Tab** („Alles auf 0"-Button): manuelle Werte
    auf 0, die Manuell-Linie im Kurven-Chart (sofern aktiv) bleibt
    auf der Nulllinie.
15. **Browser-Konsole** beim Tool-Start: keine Fehler oder Warnings.

## Selbstprüfung vor Fertig-Meldung an Sonnet

**Pflicht**: Vor der Fertig-Meldung jeden Punkt der Akzeptanztest-
Checkliste einzeln durchgehen und für jeden melden:

- **erfüllt** + Datei- und Zeilenangabe der relevanten Stelle, oder
- **nicht erfüllt** + warum, oder
- **unklar** + welche Annahme nötig wäre.

Zusätzliche Selbstprüfungen:

- [ ] `grep "buildLvGrid" *.js *.html` liefert keine Treffer mehr
  (Funktion ist entfernt und alle Aufrufer umgestellt)?
- [ ] `grep "updAllBars\|updLvFocus" *.js` liefert keine Treffer mehr?
- [ ] `grep "lvResetBtn" *.js *.html` liefert keine Treffer mehr?
- [ ] `grep "plSrcCurves" *.js *.html` liefert Treffer in
  state-side.js (Deklaration), player.js (computeGains, plCheck),
  init.js (Listener + Save+Load), file.js (Save+Load), tabs-eq.js
  (updPlSrcButtons + updEqToggleBtn), index.html (Button), i18n.js
  (Strings in 4 Sprachen) — alle erwartet?
- [ ] `grep "playerSource" *.js` zeigt im Save-Pfad jetzt
  `playerSourceMeas/Levels/Curves`, und im Load-Pfad sowohl die neuen
  Flags **als auch** den Migrations-Pfad für den alten `playerSource`-
  String?
- [ ] Alte JSONs mit `playerSource: "both"` öffnen ohne Fehler und
  setzen alle drei Toggles an?
- [ ] `CODESTRUKTUR.md` und `SPEC.md` sind im selben Arbeitsschritt
  mit aktualisiert worden, nicht nachträglich?
- [ ] Keine Konsolen-Fehler beim Tool-Start?
- [ ] Beim Klick auf „Kurven"-Tab kein Versuch mehr, das
  Manuell-Grid zu bauen (Grid-Div `#lvGrid` existiert nicht mehr im
  DOM, also wäre `buildLvGrid` ein Null-Fehler)?
