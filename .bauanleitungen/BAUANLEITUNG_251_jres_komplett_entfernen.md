# Bauanleitung 251 — `jRes` (Judgment-Ergebnisse) komplett aus dem Code entfernen

## Ziel

BA 247 hat das `judgment`-Verfahren (3-Knopf-Urteil A/=/B) im
Elektrodenlautstärke-Test ersatzlos gestrichen. Die zugehörige
Ergebnis-Liste `jRes` ist seitdem im Code nicht mehr beschreibbar, wird
aber noch in vielen Modulen mitgeführt (Save, Load, Reset, Anzeige,
Sperrlogik, Prereq-Checks).

Diese BA entfernt `jRes` flächendeckend:

- aus dem State (`state-side.js`)
- aus Persistenz: **Save** schreibt `judgmentResults` nicht mehr; **Load**
  ignoriert `judgmentResults` aus alten Dateien stillschweigend
- aus Anzeige (`results.js`, Meta-Zeile + reine Jdg-Tabelle)
- aus Reset/Clear-Pfaden (`freq-table.js`, `file.js`)
- aus Vortest-Detektoren (`lr-balance.js`, `freqmatch.js`, `latency.js`)
- aus Sub-Tab-Auswahl (`tabs-eq.js`)
- aus Sperr-Regeln (`dependency-lock.js`)
- aus Druck/Audiolog-Aggregation (`print-md.js`)
- aus dem unload-Save in `init.js`

**Verhaltensänderung gegenüber BA 250**: keine sichtbare; alte
Profil-Dateien mit `judgmentResults: [...]` werden ohne Warnung
geladen, die Einträge verworfen.

## Voraussetzungen

- BA 248, BA 249, BA 250 sind gebaut und abgenommen
- aktuelle Version vor dem Bau: `3.2.250-beta`
- i18n: nur Deutsch — keine Texte berührt

## Schritt 1 — Versionsbump

`js/version.js`:

```js
// vorher
const APP_VERSION = "3.2.250-beta";

// nachher
const APP_VERSION = "3.2.251-beta";
```

## Schritt 2 — `js/state-side.js`: `jRes` aus State entfernen

### 2a — globale `let`-Deklaration

`js/state-side.js`, etwa Z. 10–19.

**Suche**:

```js
  freqs,
  elFreqOwn,
  elSt,
  elNt,
  elExDur,
  manualLevels,
  refEl,
  jRes,
  bRes,
  config;
```

**Ersetze durch**:

```js
  freqs,
  elFreqOwn,
  elSt,
  elNt,
  elExDur,
  manualLevels,
  refEl,
  bRes,
  config;
```

### 2b — `bindActiveSide`-Sync

`js/state-side.js`, etwa Z. 83–86 (innerhalb `bindActiveSide`).

**Suche**:

```js
  refEl = s.refEl;
  jRes = s.jRes;
  bRes = s.bRes;
```

**Ersetze durch**:

```js
  refEl = s.refEl;
  bRes = s.bRes;
```

### 2c — `initSideData`

`js/state-side.js`, etwa Z. 105–108.

**Suche**:

```js
  s.refEl = Math.floor(s.nEl / 2);
  s.jRes = [];
  s.bRes = [];
```

**Ersetze durch**:

```js
  s.refEl = Math.floor(s.nEl / 2);
  s.bRes = [];
```

### 2d — Load-Pfad (`d.judgmentResults`)

`js/state-side.js`, etwa Z. 365.

**Suche**:

```js
  s.jRes = d.judgmentResults || [];
  s.bRes = d.balanceResults || [];
```

**Ersetze durch**:

```js
  // BA 251: judgmentResults aus alten Dateien werden stillschweigend ignoriert.
  s.bRes = d.balanceResults || [];
```

### 2e — `withSide`/Save-Bind-Objekt

`js/state-side.js`, etwa Z. 472–482.

**Suche**:

```js
    nEl,
    freqs,
    elSt,
    elNt,
    elExDur,
    manualLevels,
    presets,
    refEl,
    jRes,
    bRes,
  };
```

**Ersetze durch**:

```js
    nEl,
    freqs,
    elSt,
    elNt,
    elExDur,
    manualLevels,
    presets,
    refEl,
    bRes,
  };
```

## Schritt 3 — `js/file.js`: Save/Load/Reset entfetten

### 3a — initialer Reset im Default-Init

`js/file.js`, etwa Z. 35–36.

**Suche**:

```js
    sideData[s].jRes = [];
    sideData[s].bRes = [];
```

**Ersetze durch**:

```js
    sideData[s].bRes = [];
```

### 3b — Save-Objekt links

`js/file.js`, etwa Z. 226.

**Suche**:

```js
        referenceElectrode: sideData.left.refEl,
        judgmentResults: sideData.left.jRes,
        balanceResults: sideData.left.bRes,
```

**Ersetze durch**:

```js
        referenceElectrode: sideData.left.refEl,
        balanceResults: sideData.left.bRes,
```

### 3c — Save-Objekt rechts

`js/file.js`, etwa Z. 248.

**Suche**:

```js
        referenceElectrode: sideData.right.refEl,
        judgmentResults: sideData.right.jRes,
        balanceResults: sideData.right.bRes,
```

**Ersetze durch**:

```js
        referenceElectrode: sideData.right.refEl,
        balanceResults: sideData.right.bRes,
```

### 3d — Load-Pfad

`js/file.js`, etwa Z. 436–438.

**Suche**:

```js
  // Messergebnisse
  s.jRes = d.judgmentResults ? [...d.judgmentResults] : [];
  s.bRes = d.balanceResults ? [...d.balanceResults] : [];
```

**Ersetze durch**:

```js
  // Messergebnisse
  // BA 251: judgmentResults aus alten Dateien werden stillschweigend
  // ignoriert (das Judgment-Verfahren wurde mit BA 247 entfernt).
  s.bRes = d.balanceResults ? [...d.balanceResults] : [];
```

### 3e — `clearRes`

`js/file.js`, etwa Z. 856–867.

**Suche**:

```js
function clearRes() {
  const ch = confirm(t("delConfirmMeas"));
  if (!ch) return;
  sideData[activeSide].jRes.splice(0, sideData[activeSide].jRes.length);
  sideData[activeSide].bRes.splice(0, sideData[activeSide].bRes.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  jRes = sideData[activeSide].jRes;
  bRes = sideData[activeSide].bRes;
  fullSweepRound = null;
  fullSweepDonePairs = [];
  renderResults();
  pUpdEQ();
```

**Ersetze durch**:

```js
function clearRes() {
  const ch = confirm(t("delConfirmMeas"));
  if (!ch) return;
  sideData[activeSide].bRes.splice(0, sideData[activeSide].bRes.length);
  sideData[activeSide].fullSweepRound = null;
  sideData[activeSide].fullSweepDonePairs = [];
  bRes = sideData[activeSide].bRes;
  fullSweepRound = null;
  fullSweepDonePairs = [];
  renderResults();
  pUpdEQ();
```

## Schritt 4 — `js/freq-table.js`: Reset-Pfad

### 4a — Side-Reset

`js/freq-table.js`, etwa Z. 456–458.

**Suche**:

```js
  s.refEl = Math.floor(s.nEl / 2);
  s.jRes = [];
  s.bRes = [];
```

**Ersetze durch**:

```s
  s.refEl = Math.floor(s.nEl / 2);
  s.bRes = [];
```

(Hinweis für Sonnet: das `s` im Codeblock-Marker oben ist ein
Schreibfehler aus diesem Dokument; im Code bleibt es ein normaler
JS-Block — siehe nächstes Snippet, das die identische Form korrekt
zeigt. Maßgeblich ist der **Inhalt** zwischen den Backticks.)

### 4b — globale Bind-Splice

`js/freq-table.js`, etwa Z. 480–483.

**Suche**:

```js
  s.presets = presets;
  jRes.splice(0, jRes.length);
  bRes.splice(0, bRes.length);
  refEl = Math.floor(nEl / 2);
```

**Ersetze durch**:

```js
  s.presets = presets;
  bRes.splice(0, bRes.length);
  refEl = Math.floor(nEl / 2);
```

## Schritt 5 — `js/results.js`: Jdg-Verzweigung und Meta-String

### 5a — `hJ`-Variable und Frühstart

`js/results.js`, etwa Z. 4–13 (Funktionsanfang `renderResults`).

**Suche**:

```js
function renderResults() {
  const hJ = jRes.length > 0,
    hB = bRes.length > 0;
  if (!hJ && !hB) {
    const nr = document.getElementById("noRes");
    const rc = document.getElementById("resC");
    if (nr) nr.style.display = "";
    if (rc) rc.style.display = "none";
    return;
  }
```

**Ersetze durch**:

```js
function renderResults() {
  // BA 251: hJ entfaellt (judgment-Verfahren raus); nur noch bRes.
  const hB = bRes.length > 0;
  if (!hB) {
    const nr = document.getElementById("noRes");
    const rc = document.getElementById("resC");
    if (nr) nr.style.display = "";
    if (rc) rc.style.display = "none";
    return;
  }
```

### 5b — Meta-String

`js/results.js`, etwa Z. 46–49.

**Suche**:

```js
  let meta = `${new Date().toLocaleString(lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US")}`;
  if (hB) meta += ` · ${bRes.length} bal.`;
  if (hJ) meta += ` · ${jRes.length} jdg.`;
  meta += ` · ${t("lblVol")} ${vol}% · ${MFR[mfr].name}`;
```

**Ersetze durch**:

```js
  let meta = `${new Date().toLocaleString(lang === "de" ? "de-DE" : lang === "fr" ? "fr-FR" : lang === "es" ? "es-ES" : "en-US")}`;
  if (hB) meta += ` · ${bRes.length} bal.`;
  meta += ` · ${t("lblVol")} ${vol}% · ${MFR[mfr].name}`;
```

### 5c — Jdg-Tabellen-Verzweigung

`js/results.js`, etwa Z. 194–215 (innerhalb `renderResults`,
Verzweigung nach `if (hB) { … }`).

**Suche** (Beginn der `else if (hJ)`-Verzweigung):

```js
  } else if (hJ) {
    const sc = new Array(nEl).fill(0),
      cc = new Array(nEl).fill(0);
    for (const r of jRes) {
      cc[r.a]++;
      cc[r.b]++;
      if (r.result === "a") {
        sc[r.a]++;
        sc[r.b]--;
      } else if (r.result === "b") {
        sc[r.b]++;
        sc[r.a]--;
      }
    }
    th.innerHTML = `<th>${t("thEl")}</th><th>${t("thHzStd")}</th><th>${t("thSc")}</th><th>${t("thComp")}</th>`;
    for (let i = 0; i < nEl; i++) {
      const tr = document.createElement("tr"),
        s = sc[i];
      tr.innerHTML = `<td style="font-weight:600">${dEN(i)}</td><td>${Math.round(effFreq(i))}</td><td style="color:${s > 0 ? "#2563eb" : s < 0 ? "#dc2626" : "#666"}">${s > 0 ? "+" : ""}${s}</td><td>${cc[i] || "—"}</td>`;
      tb.appendChild(tr);
    }
```

**Den gesamten `else if (hJ) { … }`-Zweig ersatzlos löschen** —
einschließlich der schließenden `}`, die diesen Zweig beendet. Die
darauf folgenden `else`/`}` der äußeren Verzweigung bleiben unverändert.
Vor dem Edit den Block einmal von Hand auf Klammerbalance prüfen
(Editor-Faltung hilft).

## Schritt 6 — `js/latency.js`: `_latHasLoudness` ohne jRes

`js/latency.js`, etwa Z. 353–363.

**Suche**:

```js
function _latHasLoudness() {
  // Pragmatische Detektion: mindestens eine Seite hat von Default
  // abweichende manualLevels ODER nicht-leere jRes.
  if (typeof sideData !== 'object' || !sideData) return false;
  for (const side of ['left', 'right']) {
    const sd = sideData[side];
    if (!sd) continue;
    if (Array.isArray(sd.manualLevels) && sd.manualLevels.some(function(v) { return isFinite(v) && v !== 0; })) return true;
    if (Array.isArray(sd.jRes) && sd.jRes.length > 0) return true;
  }
  return false;
}
```

**Ersetze durch**:

```js
function _latHasLoudness() {
  // BA 251: jRes entfaellt. Detektion ueber manualLevels (von Default
  // abweichend) oder nicht-leere bRes.
  if (typeof sideData !== 'object' || !sideData) return false;
  for (const side of ['left', 'right']) {
    const sd = sideData[side];
    if (!sd) continue;
    if (Array.isArray(sd.manualLevels) && sd.manualLevels.some(function(v) { return isFinite(v) && v !== 0; })) return true;
    if (Array.isArray(sd.bRes) && sd.bRes.length > 0) return true;
  }
  return false;
}
```

(Bewußt um `bRes` ergänzt — vorher prüfte die Funktion `jRes`, ein
nicht-leeres `bRes`-Array ist der natürliche Ersatz für „Lautstärke
gemessen".)

## Schritt 7 — `js/tabs-eq.js`: `hasJdg` raus

`js/tabs-eq.js`, etwa Z. 231–238.

**Suche**:

```js
    const hasBal = typeof bRes !== "undefined" && bRes.length > 0;
    const hasJdg = typeof jRes !== "undefined" && jRes.length > 0;
    const hasFR = typeof fRes !== "undefined" && fRes.length > 0;
    const hasLR = typeof lrResults !== "undefined" && Object.keys(lrResults).length > 0;
    if (!currentName || currentName === "results") {
      // Default-Auswahl: Tab mit Daten bevorzugen
      if (!hasBal && !hasJdg && hasFR) {
        switchSubtab("ergebnisse", "freqmatch");
        return;
```

**Ersetze durch**:

```js
    const hasBal = typeof bRes !== "undefined" && bRes.length > 0;
    const hasFR = typeof fRes !== "undefined" && fRes.length > 0;
    const hasLR = typeof lrResults !== "undefined" && Object.keys(lrResults).length > 0;
    if (!currentName || currentName === "results") {
      // Default-Auswahl: Tab mit Daten bevorzugen
      // BA 251: hasJdg entfaellt; reine Bal/FR-Logik bleibt.
      if (!hasBal && hasFR) {
        switchSubtab("ergebnisse", "freqmatch");
        return;
```

## Schritt 8 — `js/dependency-lock.js`: jRes-OR-Bedingungen entschlacken

In `DEP_LOCK_RULES` fünf Stellen mit dem Muster
`(s.jRes && s.jRes.length > 0)` (und einmal analog für `other`).
Pattern: das OR mit der Belüftungs-Variante streichen.

Vorgehen für jede Stelle: per `grep` exakt finden, dann die OR-Variante
löschen.

```
grep -n "jRes && s.jRes\|sideData\[other\].jRes" js/dependency-lock.js
```

Erwartete Treffer (Stand vor BA 251): Z. 30–31, Z. 37–38, Z. 77–78,
Z. 112–113, Z. 176–177.

### 8a — Z. 28–32 (Hersteller-Auswahl, eigene Seite)

**Suche**:

```js
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0);
```

**Ersetze durch**:

```js
      // BA 251: jRes entfaellt; nur noch bRes.
      const ownHasLoud = (s.bRes && s.bRes.length > 0);
```

(Diese Form ist die gleiche an allen vier weiteren Stellen — jedes Mal
identisch ersetzen. Mit `replace_all` machbar, wenn man sicherstellt,
daß die OR-Variante **nirgendwo** noch gewollt ist; sicher geht man
mit der manuellen Zweistellen-Suche.)

### 8b — Z. 36–39 (Hersteller-Auswahl, andere Seite)

**Suche**:

```js
      const otherHasLoud = otherSync && (
        (sideData[other].bRes && sideData[other].bRes.length > 0) ||
        (sideData[other].jRes && sideData[other].jRes.length > 0)
      );
```

**Ersetze durch**:

```js
      // BA 251: jRes entfaellt; nur noch bRes.
      const otherHasLoud = otherSync
        && (sideData[other].bRes && sideData[other].bRes.length > 0);
```

### 8c–e — weitere drei Regeln (Hörtechnik, Hz-eigen, elActive)

In Regeln „Hörtechnik-Auswahl" (etwa Z. 76–78), „Hz-eigen-Felder"
(Z. 111–113) und „elActive" (Z. 176–177) das gleiche Muster
`(s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0)`
durch `(s.bRes && s.bRes.length > 0)` ersetzen.

## Schritt 9 — `js/lr-balance.js`: `_lrHasLvData`

`js/lr-balance.js`, etwa Z. 625–630.

**Suche**:

```js
// Lautstaerke-Mess-Daten vorhanden? (Slider-Verfahren bRes oder Judgment-Verfahren jRes)
function _lrHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0);
}
```

**Ersetze durch**:

```js
// BA 251: jRes entfaellt; Lautstaerke-Daten = bRes.
function _lrHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0);
}
```

## Schritt 10 — `js/freqmatch.js`: `_fmHasLvData`

`js/freqmatch.js`, etwa Z. 898–902.

**Suche**:

```js
function _fmHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0);
}
```

**Ersetze durch**:

```js
// BA 251: jRes entfaellt; Lautstaerke-Daten = bRes.
function _fmHasLvData(side) {
  const s = sideData[side];
  if (!s) return false;
  return (s.bRes && s.bRes.length > 0);
}
```

## Schritt 11 — `js/print-md.js`: Audiolog-Letzte-Messung

`js/print-md.js`, etwa Z. 1075–1086.

**Suche**:

```js
// ---------- Letzte Messung pro Seite (max-Timestamp von jRes+bRes) ----------

function _audiologLastMeas(side) {
  const sd = sideData[side];
  if (!sd) return null;
  let max = 0;
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e && e.timestamp && e.timestamp > max) max = e.timestamp;
  };
  collect(sd.jRes); collect(sd.bRes);
  return max > 0 ? new Date(max) : null;
}
```

**Ersetze durch**:

```js
// BA 251: jRes entfaellt; letzte Messung kommt nur noch aus bRes.

function _audiologLastMeas(side) {
  const sd = sideData[side];
  if (!sd) return null;
  let max = 0;
  const collect = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const e of arr) if (e && e.timestamp && e.timestamp > max) max = e.timestamp;
  };
  collect(sd.bRes);
  return max > 0 ? new Date(max) : null;
}
```

## Schritt 12 — `js/init.js`: unload-Save

`js/init.js`, im unload-Save-Block (etwa Z. 845–875). An zwei Stellen
(links Z. 848, rechts Z. 872) `judgmentResults: sideData.<side>.jRes,`
ersatzlos entfernen.

### 12a — links

**Suche**:

```js
              referenceElectrode: sideData.left.refEl,
              judgmentResults: sideData.left.jRes,
              balanceResults: sideData.left.bRes,
```

**Ersetze durch**:

```js
              referenceElectrode: sideData.left.refEl,
              balanceResults: sideData.left.bRes,
```

### 12b — rechts

**Suche**:

```js
              referenceElectrode: sideData.right.refEl,
              judgmentResults: sideData.right.jRes,
              balanceResults: sideData.right.bRes,
```

**Ersetze durch**:

```js
              referenceElectrode: sideData.right.refEl,
              balanceResults: sideData.right.bRes,
```

## Schritt 13 — Akzeptanztest

1. **Browser-Cache leeren, Anwendung neu laden**
   Erwartet: kein JS-Fehler. `3.2.251-beta` sichtbar.

2. **Alle vier Sub-Reiter unter „Messungen"**
   Elektrodenlautstärke, Stereo-Balance, Frequenzabgleich, Latenz
   öffnen — alle rendern, keine Konsolen-Fehler.

3. **Elektrodenlautstärke-Test starten und ein Paar bestätigen**
   Round Robin starten. Pair-Indicator, Slider, Bestätigen
   funktionieren wie nach BA 250. Nach einem Trial: Ergebnis steht in
   der „Vergleich"-Spalte im Ergebnisreiter (kommt aus `bRes`,
   nicht `jRes`).

4. **Tab „Meßergebnisse"**
   Mit nicht-leerem `bRes`: Tabelle wird angezeigt. Meta-Zeile
   enthält nur noch „N bal.", keine „M jdg."-Sektion mehr.

5. **Datei speichern und neu laden**
   Aktuellen Stand speichern. Datei in einem Editor öffnen, im JSON
   nach `"judgmentResults"` suchen — Erwartet: **nicht vorhanden**.
   Datei neu laden: alle Daten kommen zurück, kein Fehler.

6. **Alte Datei laden**
   Eine Profil-Datei aus der Zeit vor BA 251 laden (sofern verfügbar).
   Erwartet: kein JS-Fehler. Etwaige `judgmentResults`-Einträge in der
   Datei werden ohne Warnung ignoriert. `bRes`/`manualLevels`/Implantat-
   Daten kommen wie gewohnt zurück.

7. **Lautstärke-Mess-Detektion (Frequenzabgleich, Stereo-Balance, Latenz)**
   Nach einigen `bRes`-Einträgen sind die Vortest-Hinweise in
   Stereo-Balance, Frequenzabgleich, Latenz verschwunden (waren
   vorher schon korrekt — sind jetzt mit der gleichen Logik, aber
   ohne `jRes`-OR).

8. **Sperr-Regeln (`depLock`)**
   Im Implantat-Tab: nach Anlegen von `bRes`-Einträgen ist die
   Hersteller-Auswahl gesperrt (Reason: Lautstärke-Daten). Hat sich
   gegenüber vorher nicht verändert; in BA 251 nur der Code-Pfad
   entschlackt.

9. **Druck**
   Druck aufrufen: das Audiolog-Anschreiben enthält die letzte
   Messung pro Seite (aus `bRes`). Keine fehlenden Daten, keine
   Fehler.

10. **„Messergebnisse löschen"**
    Im Tab „Meßergebnisse" auf den Lösch-Button. Bestätigen.
    Erwartet: Ergebnisse weg. Anschließend Datei speichern + laden:
    Daten bleiben gelöscht.

## Schritt 14 — Selbstprüfungs-Auftrag an Sonnet

Bevor du den Build als fertig meldest: gehe Akzeptanzschritte 1–10
einzeln durch und melde für jeden Schritt: **erfüllt** / **nicht erfüllt**
/ **unklar**, jeweils mit Datei- und Zeilenangabe der relevanten
Code-Stelle.

Fünf Pflicht-Checks vor Build-Abschluß:

- **`jRes` nirgendwo mehr referenziert**:
  ```
  grep -rn "\bjRes\b" js/
  ```
  Erwartet: **keine Treffer**.

- **`judgmentResults` nirgendwo mehr referenziert**:
  ```
  grep -rn "judgmentResults" js/
  ```
  Erwartet: keine Treffer (auch nicht im Save/Load — beim Load ist die
  Annahme „silent ignore", nicht „explizit ignorieren").

- **Save schreibt kein `judgmentResults` mehr**: einmal Datei speichern,
  JSON-Output prüfen — kein `"judgmentResults"`-Key.

- **Load duldet alte `judgmentResults` ohne Crash**: eine Datei mit
  `"judgmentResults": [...]` laden — keine Fehler, Daten werden
  verworfen.

- **Versionsbump tatsächlich gesetzt**: `js/version.js` zeigt
  `3.2.251-beta`.

## Doku-Hinweis

`docs/spec/02-messung.md` und `docs/spec/00-testui-architektur.md`
sind in BA 248 schon entrümpelt worden, was den `judgment`-Begriff
betrifft. Falls beim Lesen der Spec ein Verweis auf `jRes` noch
übrigbleibt: jetzt mit entfernen. Sonst bleibt die Doku in dieser BA
unangetastet.
