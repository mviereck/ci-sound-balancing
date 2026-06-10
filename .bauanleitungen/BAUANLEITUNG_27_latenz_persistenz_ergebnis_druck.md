# Bauanleitung 27: Latenz-Messung — Persistenz, Ergebnis-Anzeige, Druck, i18n

Dritte und letzte Bauanleitung für die Latenz-Funktion. Setzt
Bauanleitungen **25 und 26** voraus.

Diese Anleitung verbindet die einzelnen Teile zur vollständigen
Feature-Integration:
- Übernehmen-Button im Messung-Tab (Schieber-Wert in
  `latencyResult` schreiben)
- Persistenz in `file.js` (Save/Load)
- Neuer Sub-Tab „Latenz" in „Meßergebnisse" mit Wert + Klartext +
  `plApplyLatency`-Toggle
- Druck-Anbindung
- i18n-Strings für DE/EN/FR/ES, alle hartkodierten deutschen Texte
  aus 26 auf `data-t` umstellen
- CODESTRUKTUR.md und SPEC.md aktualisieren

## Schritt 1 — Übernehmen-Button im Messung-Sub-Tab

### 1a. HTML

In `index.html`, im Block aus Bauanleitung 26
(`subpanel-messungen-latenz`), im Start/Stop-Button-Block, nach
dem Stop-Button und vor dem Locked-Hint einen Übernehmen-Button
einfügen:

Vorher:
```html
<div style="margin:24px 0 8px 0;">
  <button class="btn primary" id="latStartBtn">▶ Test starten</button>
  <button class="btn" id="latStopBtn" disabled>■ Stop</button>
</div>
```

Nachher:
```html
<div style="margin:24px 0 8px 0;">
  <button class="btn primary" id="latStartBtn" data-t="latStartBtn">▶ Test starten</button>
  <button class="btn" id="latStopBtn" disabled data-t="latStopBtn">■ Stop</button>
  <button class="btn" id="latApplyBtn" style="margin-left:16px;" data-t="latApplyBtn">✓ Wert übernehmen</button>
</div>
```

(Hinweis: `data-t` Attribute werden in Schritt 5 noch in i18n
versorgt.)

### 1b. JS in `latency.js`

In `latency.js`, im UI-Block aus Bauanleitung 26, nach
`latStopTestUI` Funktion folgenden Block einfügen:

```js
function latApplyAsResult() {
  latencyResult = {
    valueMs: latSliderMs,
    clickType: latClickType,
    intervalMs: latIntervalMs,
    timestamp: Date.now(),
  };
  // Player sofort aktualisieren
  latApplyToPlayer();
  // Ergebnis-Anzeige updaten
  if (typeof latRenderResults === "function") latRenderResults();
}
```

Außerdem in `latency.js`, im `DOMContentLoaded`-Handler, im Block
der Element-Referenzen, neue Zeile:
```js
    applyBtn:      document.getElementById("latApplyBtn"),
```

Und im Event-Bindings-Block:
```js
  if (latEls.applyBtn) latEls.applyBtn.addEventListener("click", latApplyAsResult);
```

## Schritt 2 — Persistenz in `file.js`

### 2a. Speichern erweitern

In `file.js`, **Block der Save-Daten** (etwa Z. 189–210 — die
Stelle, wo `lrResults`, `fRes`, etc. ins Speicher-Objekt geschrieben
werden). Direkt nach der Zeile mit `lrResults:` zwei neue Zeilen
einfügen:

Vorher:
```js
lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
fRes: (typeof fRes !== "undefined") ? fRes : [],
```

Nachher:
```js
lrResults: (typeof lrResults !== "undefined") ? lrResults : {},
latencyResult: (typeof latencyResult !== "undefined") ? latencyResult : null,
plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
fRes: (typeof fRes !== "undefined") ? fRes : [],
```

### 2b. Laden erweitern

In `file.js`, **Block der Load-Daten** (etwa Z. 436–448, wo
`lrResults` geladen wird). Direkt nach dem `lrResults`-if-Block:

```js
  if (typeof latencyResult !== "undefined") {
    latencyResult = (d && d.latencyResult) ? d.latencyResult : null;
  }
  if (typeof plApplyLatency !== "undefined") {
    plApplyLatency = (d && typeof d.plApplyLatency === "boolean")
      ? d.plApplyLatency : true;
  }
  if (typeof latApplyToPlayer === "function") latApplyToPlayer();
  if (typeof latRenderResults === "function") latRenderResults();
```

### 2c. Init.js — gleicher Block für JSON-Restore aus localStorage

In `init.js` gibt es einen zweiten Lade-Pfad (für Auto-Restore
nach Reload, etwa um Z. 1056). Such mit:

```bash
grep -n "d.lrResults && typeof lrResults" init.js
```

Direkt nach diesem Block (Ende des lrResults-Restore) den gleichen
Block einsetzen wie in 2b oben.

Außerdem im **Save-Pfad in init.js** (etwa Z. 1158): an die Stelle
wo `lrResults:` im Save-Objekt steht, die gleichen beiden Zeilen
(latencyResult + plApplyLatency) einfügen wie in 2a.

## Schritt 3 — Ergebnis-Sub-Tab „Latenz" in „Meßergebnisse"

### 3a. HTML

In `index.html`, Subtab-Buttons des `panel-ergebnisse` (etwa
Z. 451–453). Vor dem `printErgebnisseBtn` einen weiteren Sub-Tab-
Button einfügen:

Vorher:
```html
<button class="subtab active" data-subtab="results" data-parent="ergebnisse" id="subTabLoudnessBtn"></button>
<button class="subtab" data-subtab="lrresults" data-parent="ergebnisse">Stereo-Balance</button>
<button class="subtab" data-subtab="freqmatch" data-parent="ergebnisse" id="subTabFreqMatchBtn"></button>
<button class="btn" id="printErgebnisseBtn"
        style="margin-left:auto;padding:4px 10px;font-size:0.9em;">
  🖨 <span data-t="printBtn"></span>
</button>
```

Nachher:
```html
<button class="subtab active" data-subtab="results" data-parent="ergebnisse" id="subTabLoudnessBtn"></button>
<button class="subtab" data-subtab="lrresults" data-parent="ergebnisse">Stereo-Balance</button>
<button class="subtab" data-subtab="freqmatch" data-parent="ergebnisse" id="subTabFreqMatchBtn"></button>
<button class="subtab" data-subtab="latenz" data-parent="ergebnisse" id="subTabLatenzBtn" data-t="tabLatenz">Latenz</button>
<button class="btn" id="printErgebnisseBtn"
        style="margin-left:auto;padding:4px 10px;font-size:0.9em;">
  🖨 <span data-t="printBtn"></span>
</button>
```

### 3b. Subpanel-Container

In `index.html`, im Block `panel-ergebnisse`, nach dem letzten
Subpanel (`subpanel-ergebnisse-freqmatch`), neuen Container
einfügen:

```html
        <!-- ===== ERGEBNIS LATENZ ===== -->
        <div id="subpanel-ergebnisse-latenz" class="subpanel">
          <div class="card">
            <h2 data-t="latResTitle">Latenz</h2>
            <div id="latResNone" style="color:var(--text-muted);">
              <p data-t="latResNoneText">Noch keine Latenz gemessen. Im Reiter „Messungen" → „Latenz" durchführen.</p>
            </div>
            <div id="latResContent" hidden>
              <div style="font-size:1.6em;font-weight:600;margin:12px 0;" id="latResValueBig">—</div>
              <div id="latResText" style="margin:8px 0;"></div>
              <div id="latResContext" style="color:var(--text-muted);font-size:0.9em;margin:8px 0;"></div>
              <div style="margin:18px 0;">
                <label style="display:inline-flex;align-items:center;gap:8px;">
                  <input type="checkbox" id="latApplyToggle" />
                  <span data-t="latApplyToggle">Im Player anwenden</span>
                </label>
              </div>
            </div>
          </div>
        </div>
```

### 3c. JS — Render-Funktion und Toggle

In `latency.js`, am **Ende** der Datei (nach dem `DOMContentLoaded`-
Block), folgenden Block anhängen:

```js
// =====================================================================
// Ergebnis-Tab (Bauanleitung 27)
// =====================================================================

let latResEls = null;

function latRenderResults() {
  if (!latResEls) {
    latResEls = {
      none:      document.getElementById("latResNone"),
      content:   document.getElementById("latResContent"),
      valueBig:  document.getElementById("latResValueBig"),
      text:      document.getElementById("latResText"),
      context:   document.getElementById("latResContext"),
      toggle:    document.getElementById("latApplyToggle"),
    };
    if (latResEls.toggle) {
      latResEls.toggle.addEventListener("change", function () {
        plApplyLatency = latResEls.toggle.checked;
        latApplyToPlayer();
      });
    }
  }
  if (!latResEls.none || !latResEls.content) return;

  if (!latencyResult || !isFinite(latencyResult.valueMs)) {
    latResEls.none.hidden = false;
    latResEls.content.hidden = true;
    return;
  }
  latResEls.none.hidden = true;
  latResEls.content.hidden = false;

  const v = latencyResult.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  if (Math.abs(v) < 0.05) {
    latResEls.valueBig.textContent = "0,0 ms";
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResNoOffset") : "Kein Versatz.";
  } else if (v > 0) {
    latResEls.valueBig.textContent = `+${a} ms`;
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResLeftFaster").replace("{ms}", a)
      : `Linke Seite war ${a} ms schneller. Wird ausgeglichen.`;
  } else {
    latResEls.valueBig.textContent = `−${a} ms`;
    latResEls.text.textContent = (typeof t === "function")
      ? t("latResRightFaster").replace("{ms}", a)
      : `Rechte Seite war ${a} ms schneller. Wird ausgeglichen.`;
  }
  // Kontext-Zeile
  const typeLabel = {
    "click":     "Klick (breitband)",
    "burst500":  "Tieftöner 500 Hz",
    "burst1500": "Mittelton 1500 Hz",
    "burst4000": "Hochton 4 kHz",
  }[latencyResult.clickType] || latencyResult.clickType;
  latResEls.context.textContent =
    `Gemessen mit: ${typeLabel}, Klick-Intervall ${latencyResult.intervalMs} ms`;

  // Toggle-State synchronisieren
  if (latResEls.toggle) latResEls.toggle.checked = !!plApplyLatency;
}
```

### 3d. Render-Hook im Sub-Tab-Wechsel

In `tabs-eq.js`, **Funktion `switchSubtab`** (etwa Z. 14), im
ergebnisse-Block, einen neuen `if` für „latenz" einfügen.

Vorher (etwa Z. 20):
```js
  if (parent === "ergebnisse" && subtab === "freqmatch") {
    ...
  }
```

Nachher (nach dem freqmatch-Block, vor dem messungen-Block):
```js
  if (parent === "ergebnisse" && subtab === "freqmatch") {
    ...
  }
  if (parent === "ergebnisse" && subtab === "latenz") {
    if (typeof latRenderResults === "function") latRenderResults();
  }
```

(Den exakten Inhalt des freqmatch-Blocks belassen wie er ist —
nur den neuen latenz-Block davor oder danach einfügen.)

### 3e. Auto-Wechsel-Logik in `switchTab`

In `tabs-eq.js`, **Funktion `switchTab`**, Block für
`if (n === "ergebnisse")`. Aktuell entscheidet die Funktion welches
Sub-Tab Default ist anhand der vorhandenen Daten. Latenz bleibt
**nicht** Default — wenn andere Daten da sind, wird der user-zuletzt-
gewählte Sub-Tab bevorzugt. Keine Änderung dort nötig.

## Schritt 4 — Druck-Anbindung

In `tab-print.js`, **Funktion `printErgebnisseTab`** (etwa Z. 139).

Vorher (etwa Z. 145–148):
```js
  if (id === "subpanel-ergebnisse-results")  return _printResLoudness();
  if (id === "subpanel-ergebnisse-lrresults") return _printResLR();
  if (id === "subpanel-ergebnisse-freqmatch") return _printResFreqmatch();
}
```

Nachher:
```js
  if (id === "subpanel-ergebnisse-results")  return _printResLoudness();
  if (id === "subpanel-ergebnisse-lrresults") return _printResLR();
  if (id === "subpanel-ergebnisse-freqmatch") return _printResFreqmatch();
  if (id === "subpanel-ergebnisse-latenz")    return _printResLatency();
}
```

In derselben Datei, nach `_printResFreqmatch`, neue Funktion
hinzufügen:

```js
function _printResLatency() {
  if (!latencyResult || !isFinite(latencyResult.valueMs)) {
    return `<div class="print-card"><h2>${t("latResTitle")}</h2>` +
           `<p>${t("latResNoneText")}</p></div>`;
  }
  const v = latencyResult.valueMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  let mainTxt;
  if (Math.abs(v) < 0.05) {
    mainTxt = t("latResNoOffset");
  } else if (v > 0) {
    mainTxt = t("latResLeftFaster").replace("{ms}", a);
  } else {
    mainTxt = t("latResRightFaster").replace("{ms}", a);
  }
  const typeKey = {
    "click":     "latTypeClick",
    "burst500":  "latTypeBurst500",
    "burst1500": "latTypeBurst1500",
    "burst4000": "latTypeBurst4000",
  }[latencyResult.clickType];
  const typeLabel = typeKey ? t(typeKey) : latencyResult.clickType;
  return `
    <div class="print-card">
      <h2>${t("latResTitle")}</h2>
      <p style="font-size:1.4em;font-weight:600;">${v >= 0 ? "+" : "−"}${a} ms</p>
      <p>${mainTxt}</p>
      <p style="color:#666;font-size:0.9em;">
        ${t("latResMeasuredWith")}: ${typeLabel},
        ${t("latResInterval")} ${latencyResult.intervalMs} ms
      </p>
      <p style="color:#666;font-size:0.9em;">
        ${t("latResApplied")}: ${plApplyLatency ? t("yes") : t("no")}
      </p>
    </div>`;
}
```

## Schritt 5 — i18n-Strings

In `i18n.js`, im `L`-Objekt, für **jede der vier Sprachen** (de, en,
fr, es) folgende Keys ergänzen. Such-Anker: in jedem Sprach-Block
gibt es z.B. den Key `tabBalance` für „Stereo-Balance". Direkt nach
diesem oder am Ende des Blocks einfügen.

### Deutsch (`de:`)
```js
    tabLatenz: "Latenz",
    latSubtabName: "Latenz",
    latStartBtn: "▶ Test starten",
    latStopBtn: "■ Stop",
    latApplyBtn: "✓ Wert übernehmen",
    latApplyToggle: "Im Player anwenden",
    latResTitle: "Latenz",
    latResNoneText: "Noch keine Latenz gemessen. Im Reiter „Messungen" → „Latenz" durchführen.",
    latResNoOffset: "Kein Versatz.",
    latResLeftFaster: "Linke Seite war {ms} ms schneller. Wird ausgeglichen.",
    latResRightFaster: "Rechte Seite war {ms} ms schneller. Wird ausgeglichen.",
    latResMeasuredWith: "Gemessen mit",
    latResInterval: "Klick-Intervall",
    latResApplied: "Im Player angewendet",
    latTypeClick: "Klick (breitband)",
    latTypeBurst500: "Tieftöner 500 Hz",
    latTypeBurst1500: "Mittelton 1500 Hz",
    latTypeBurst4000: "Hochton 4 kHz",
```

### Englisch (`en:`)
```js
    tabLatenz: "Latency",
    latSubtabName: "Latency",
    latStartBtn: "▶ Start test",
    latStopBtn: "■ Stop",
    latApplyBtn: "✓ Apply value",
    latApplyToggle: "Apply in player",
    latResTitle: "Latency",
    latResNoneText: "No latency measured yet. Run under \"Measurements\" → \"Latency\".",
    latResNoOffset: "No offset.",
    latResLeftFaster: "Left side was {ms} ms faster. Will be compensated.",
    latResRightFaster: "Right side was {ms} ms faster. Will be compensated.",
    latResMeasuredWith: "Measured with",
    latResInterval: "Click interval",
    latResApplied: "Applied in player",
    latTypeClick: "Click (broadband)",
    latTypeBurst500: "Low tone 500 Hz",
    latTypeBurst1500: "Mid tone 1500 Hz",
    latTypeBurst4000: "High tone 4 kHz",
```

### Französisch (`fr:`)
```js
    tabLatenz: "Latence",
    latSubtabName: "Latence",
    latStartBtn: "▶ Démarrer le test",
    latStopBtn: "■ Arrêter",
    latApplyBtn: "✓ Appliquer la valeur",
    latApplyToggle: "Appliquer dans le lecteur",
    latResTitle: "Latence",
    latResNoneText: "Aucune latence mesurée. À effectuer dans « Mesures » → « Latence ».",
    latResNoOffset: "Aucun décalage.",
    latResLeftFaster: "Le côté gauche était plus rapide de {ms} ms. Compensé.",
    latResRightFaster: "Le côté droit était plus rapide de {ms} ms. Compensé.",
    latResMeasuredWith: "Mesuré avec",
    latResInterval: "Intervalle de clic",
    latResApplied: "Appliqué dans le lecteur",
    latTypeClick: "Clic (large bande)",
    latTypeBurst500: "Basse fréquence 500 Hz",
    latTypeBurst1500: "Médium 1500 Hz",
    latTypeBurst4000: "Aigu 4 kHz",
```

### Spanisch (`es:`)
```js
    tabLatenz: "Latencia",
    latSubtabName: "Latencia",
    latStartBtn: "▶ Iniciar prueba",
    latStopBtn: "■ Detener",
    latApplyBtn: "✓ Aplicar valor",
    latApplyToggle: "Aplicar en el reproductor",
    latResTitle: "Latencia",
    latResNoneText: "Aún no se ha medido latencia. Realizar en «Mediciones» → «Latencia».",
    latResNoOffset: "Sin desfase.",
    latResLeftFaster: "El lado izquierdo fue {ms} ms más rápido. Se compensará.",
    latResRightFaster: "El lado derecho fue {ms} ms más rápido. Se compensará.",
    latResMeasuredWith: "Medido con",
    latResInterval: "Intervalo de clic",
    latResApplied: "Aplicado en el reproductor",
    latTypeClick: "Clic (banda ancha)",
    latTypeBurst500: "Tono bajo 500 Hz",
    latTypeBurst1500: "Tono medio 1500 Hz",
    latTypeBurst4000: "Tono alto 4 kHz",
```

### Allgemeine Helfer (alle 4 Sprachen)
Falls noch nicht vorhanden, „yes" und „no" prüfen:
```bash
grep -n "yes:\|no:" i18n.js | head
```
Falls fehlen, in allen vier Sprachblöcken nachtragen:
- de: `yes: "ja", no: "nein",`
- en: `yes: "yes", no: "no",`
- fr: `yes: "oui", no: "non",`
- es: `yes: "sí", no: "no",`

## Schritt 6 — Hartkodierte deutsche Texte aus Bauanleitung 26 auf i18n umstellen

In `index.html`, im `subpanel-messungen-latenz`-Block aus
Bauanleitung 26:

- **BT-Warnung**: aktuell direkt deutsch. Ersetzen durch:
  ```html
  <div class="info-box" style="..." data-t-html="latBTWarning">
  ```
  Und im i18n-`L`-Objekt für jede Sprache einen `latBTWarning`-Key
  mit dem HTML-Inhalt (in DE bestehender Text, andere Sprachen
  übersetzt).
  
- **Überschrift** „Latenz-Messung": `<h2 data-t="latMeasTitle">`
- **Erklär-Paragraph**: `<p data-t-html="latMeasIntro">` (mit
  Tastatur-Hinweis, in allen Sprachen).
- **Schieber-Labels** unter dem Slider (-50/0/+50): mit
  `data-t` versorgen (`latSliderMinusLabel`, `latSliderZeroLabel`,
  `latSliderPlusLabel`).
- **„Klick-Intervall"**-Label: `data-t="latIntervalLabel"`
- **„Klangtyp"**-Label: `data-t="latTypeLabel"`
- **Klangtyp-Buttons**: Texte über `data-t="latTypeClick"` etc.
- **Abwechseln-Checkbox-Text**: `data-t="latAltLabel"`
- **Locked-Hint-Text**: `data-t="latLockedHint"`

Die zugehörigen i18n-Strings für jede Sprache hinzufügen. Sonnet:
auch hier alle 4 Sprachen synchron pflegen.

In `latency.js`, alle Stellen wo aktuell hartkodierter Text steht
(`latUpdateValueText`, `latUpdateIntervalHint`, etc.) auf
`t("...")`-Calls umstellen.

Beispiel, `latUpdateValueText` aus Bauanleitung 26 wird zu:
```js
function latUpdateValueText() {
  if (!latEls || !latEls.valueText) return;
  const v = latSliderMs;
  const a = Math.abs(v).toFixed(1).replace(".", ",");
  let txt;
  if (Math.abs(v) < 0.05) {
    txt = `0,0 ms — ${t("latResNoOffset").replace(".","")}`;
  } else if (v > 0) {
    txt = `+${a} ms — ${t("latResLeftFaster").replace("{ms}", a)}`;
  } else {
    txt = `−${a} ms — ${t("latResRightFaster").replace("{ms}", a)}`;
  }
  latEls.valueText.textContent = txt;
}
```

Und `latUpdateIntervalHint`:
```js
function latUpdateIntervalHint() {
  if (!latEls || !latEls.intervalHint) return;
  const unique = latIntervalMs / 2;
  let s = `${t("latUniqueRange")} ±${unique} ms`;
  if (unique < 50) s += ` ${t("latUniqueRangeAmbig")}`;
  latEls.intervalHint.textContent = s;
}
```

Dafür neue i18n-Keys in allen 4 Sprachen:
```js
// de
latUniqueRange: "Eindeutiger Bereich:",
latUniqueRangeAmbig: "(bei mehr Versatz wird die Richtung mehrdeutig)",
// en
latUniqueRange: "Unique range:",
latUniqueRangeAmbig: "(beyond this the direction becomes ambiguous)",
// fr
latUniqueRange: "Plage non ambiguë :",
latUniqueRangeAmbig: "(au-delà, le sens devient ambigu)",
// es
latUniqueRange: "Rango inequívoco:",
latUniqueRangeAmbig: "(más allá, la dirección se vuelve ambigua)",
```

## Schritt 7 — Reset bei „Neu"-Funktion

In `file.js` oder wo immer ein „Neu"-Button alle Daten zurücksetzt
(such mit `grep -n "Neu\\|reset\\|clearAll" file.js init.js`).
Wenn so eine Funktion existiert, ergänzen:
```js
if (typeof latencyResult !== "undefined") latencyResult = null;
if (typeof plApplyLatency !== "undefined") plApplyLatency = true;
if (typeof latApplyToPlayer === "function") latApplyToPlayer();
if (typeof latRenderResults === "function") latRenderResults();
```

Wenn keine zentrale Reset-Funktion existiert: weglassen, das ist
nicht kritisch — Reload reicht.

## Schritt 8 — CODESTRUKTUR.md aktualisieren

In `CODESTRUKTUR.md` mindestens folgende Stellen aktualisieren:

### 8a. Modul-Tabelle

Such die Tabelle mit Modul-Übersicht (Spalten-Header `JS-Datei` und
`Hauptzweck`). Neuen Eintrag für `latency.js` hinzufügen, möglichst
in alphabetischer/logischer Reihenfolge nahe `lr-balance.js`:

```
| 21 | latency.js | Latenz-Messung (Inter-Ohr-Zeitversatz). State: `latencyResult` ({valueMs, clickType, intervalMs}), `plApplyLatency`, `latSliderMs`, `latActive`, `latClickType`, `latIntervalMs`, `latAltMode`. Audio-Nodes: `pLatSplitter`, `pLatDelayL`, `pLatDelayR`, `pLatMerger`. Funktionen: `latBuildClickBuffer`, `latBuildBurstBuffer`, `latBuildLoopedTestBuffer`, `latStartTest`, `latStopTest`, `latSetSliderMs`, `latApplyToPlayer`, `latInitGraph` (Audio-Engine), plus UI-Bindings `latRenderResults`, `latApplyAsResult`, `latUpdateValueText`, eigener DOMContentLoaded-Handler. |
```

Die exakte Spalten-Nummerierung an die vorhandene Tabelle
anpassen.

### 8b. Sub-Tab-Tabellen

In den Sub-Tab-Tabellen für „Messungen" und „Meßergebnisse" (ganz
oben in CODESTRUKTUR.md) jeweils eine Zeile ergänzen:

**Sub-Tabs in „Messungen"** — neu:
```
| Latenz | latenz | latency.js |
```

**Sub-Tabs in „Meßergebnisse"** — neu:
```
| Latenz | latenz | latency.js (Render), tab-print.js (Druck) |
```

### 8c. Player-Audio-Graph-Abschnitt

Such den Abschnitt der den Audio-Graph beschreibt (`pGain`,
`c.destination`). Erwähnen, daß zwischen `pGain` und `c.destination`
jetzt eine Latenz-Kette eingehängt ist (Splitter → 2 Delays →
Merger), die von `latency.js` verwaltet wird.

## Schritt 9 — SPEC.md aktualisieren

In `SPEC.md`, im Abschnitt der die Sub-Tabs unter „Messungen"
beschreibt, einen neuen Unterpunkt für „Latenz" einfügen:

- Schieber ±50 ms, Auflösung 1 ms / 0,1 ms (Shift) / 10 ms (Ctrl)
- Klick-Intervalle 30/50/100/200/500 ms manuell wählbar
- 4 Klangvarianten (Klick, 500 Hz, 1500 Hz, 4 kHz Tone-Bursts)
- Abwechseln-Modus Klickfolge ↔ Einzelklick
- Wert wird gespeichert durch „Wert übernehmen"-Button
- **Nur mit Kabel-Kopfhörer durchführen** (BT verfälscht Messung)
- Wirkung wird live im Player angewendet, sofern `plApplyLatency`
  aktiv
- Persistenz: `latencyResult` und `plApplyLatency` werden mit
  gespeichert / geladen
- Ergebnis-Sub-Tab in „Meßergebnisse" zeigt Wert, Klartext,
  Kontext und Toggle für Player-Anwendung
- Druck-Unterstützung

## Akzeptanztest

Vorbereitung: Browser neu laden. Sprache zunächst Deutsch.

### 1. Wert übernehmen
Latenz-Tab öffnen, Test starten, Schieber auf +7 ms ziehen.
„✓ Wert übernehmen" klicken.
Test stoppen.
- Erwartet: keine sichtbare Änderung am Messung-Tab (außer Stop-
  Effekt).

Sub-Tab „Meßergebnisse" → „Latenz" anklicken.
- Erwartet: große Zahl „+7,0 ms", darunter „Linke Seite war 7,0 ms
  schneller. Wird ausgeglichen.", darunter Kontext „Gemessen mit:
  Klick (breitband), Klick-Intervall 100 ms". Toggle „Im Player
  anwenden" ist gesetzt.

### 2. Player-Wirkung
Musik laden, Play.
- Erwartet: Links 7 ms später.

Toggle „Im Player anwenden" ausschalten.
- Erwartet: Musik synchron.

Toggle wieder einschalten.
- Erwartet: wieder mit Versatz.

### 3. Speichern und Laden
Tab „Laden/Speichern", Datei speichern.
Browser-Reload (cacheBust).
Datei laden.
- Erwartet: Sub-Tab „Latenz" in „Meßergebnisse" zeigt wieder
  +7,0 ms. Toggle-Zustand auch wiederhergestellt.

### 4. Sprachwechsel
Sprache auf Englisch wechseln.
- Erwartet: Alle Texte in Latenz-Tab (Messung + Ergebnis) auf
  Englisch. Werte unverändert.

Sprache auf Französisch.
- Erwartet: Französisch.

Sprache auf Spanisch.
- Erwartet: Spanisch.

Zurück auf Deutsch.

### 5. Druck
Im Ergebnis-Sub-Tab „Latenz" auf „🖨 Drucken" klicken.
- Erwartet: Druckvorschau enthält Latenz-Block mit Wert,
  Klartext und Kontext. Anwendung-Status (ja/nein) ebenfalls
  sichtbar.

### 6. Negativer Wert
Test starten, Schieber auf −12,3 ms (per Tastatur Shift+←),
übernehmen, stoppen.
- Erwartet: Ergebnis-Tab zeigt „−12,3 ms", Klartext „Rechte Seite
  war 12,3 ms schneller. Wird ausgeglichen.".

### 7. Kein gemessener Wert (Initial-Zustand)
Bei einem frischen Browser-Profil ohne gespeicherte Daten:
Sub-Tab „Meßergebnisse" → „Latenz".
- Erwartet: nur „Noch keine Latenz gemessen…"-Hinweis. Keine Zahl.

### 8. „Neu"-Funktion (falls vorhanden)
Wenn das Tool eine zentrale Reset-Funktion hat: ausführen.
- Erwartet: Latenz-Wert weg, Ergebnis-Tab zeigt
  „Noch keine Latenz gemessen…".

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der 8 Akzeptanz-Schritte oben
einzeln durchgehen und für jeden melden:

- **erfüllt** + Datei:Zeile der relevanten Code-Stelle
- **nicht erfüllt** + warum + was du versucht hast
- **unklar** + welche Information dir fehlt

Besonders kritisch prüfen:
- Schritt 3: Persistenz funktioniert in **beiden** Lade-Pfaden —
  Save/Load über file.js (Datei-Download/Upload) UND localStorage-
  Auto-Restore in init.js. Beide Pfade müssen `latencyResult` und
  `plApplyLatency` setzen und danach `latApplyToPlayer` rufen.
- Schritt 4: Sprachwechsel triggert eine Re-Render der Texte. Du
  brauchst möglicherweise einen Aufruf von `latRenderResults()`
  und/oder `latUpdateValueText()` nach `applyLang()`. Such mit
  `grep -n "applyLang\b" *.js`. Wenn andere Module dort einen
  Update-Hook haben, ergänze einen für Latenz.
- Schritt 5: Druck-Output enthält die Latenz-Card NUR wenn der
  Latenz-Sub-Tab aktiv ist. Andere Sub-Tabs drucken weiterhin ihre
  Inhalte, **ohne** dass Latenz mit reinrutscht.
- Schritt 7: Initial-Zustand: `latencyResult === null`, Ergebnis-
  Tab zeigt korrekt den „Noch keine…"-Hinweis und das Content-Div
  ist `hidden`.

Falls Sprachwechsel die Texte nicht updated: prüfe, ob `applyLang`
am Ende einen Hook für Latenz hat. Falls nicht — füge einen ein
(in `i18n.js` selbst oder wo `applyLang` definiert ist):

```js
if (typeof latRenderResults === "function") latRenderResults();
if (typeof latUpdateValueText === "function") latUpdateValueText();
if (typeof latUpdateIntervalHint === "function") latUpdateIntervalHint();
```

## Nicht zu tun

- Keine Audio-Engine-Änderung. `latency.js`-Engine (Buffer-Gen,
  DelayNodes, Start/Stop, Slider-Wert) bleibt unverändert aus 25.
- Keine Änderung an `player.js`-Audio-Graph.
- Keine UI-Strukturänderungen am Messung-Sub-Tab (Schieber etc.)
  außer dem hinzukommenden Übernehmen-Button und i18n-Attributen.
- Keine Migration alter gespeicherter Dateien — falls eine alte
  Save-Datei keinen `latencyResult`-Eintrag hat, soll der Load-
  Pfad das als `null` behandeln (Default). Genau das tut der
  Code in 2b.

## Zusammenfassung der Datei-Änderungen

| Datei | Änderung |
|---|---|
| `index.html` | Übernehmen-Button (1a), Ergebnis-Subtab-Button (3a), Ergebnis-Subpanel (3b), i18n-Attribute (6) |
| `latency.js` | Übernehmen-Funktion (1b), Ergebnis-Render (3c), i18n-Umstellung von Strings (6) |
| `file.js` | Save erweitern (2a), Load erweitern (2b) |
| `init.js` | Save + localStorage-Restore erweitern (2c) |
| `tabs-eq.js` | Sub-Tab-Render-Hook für „latenz" (3d) |
| `tab-print.js` | Dispatcher + `_printResLatency` (4) |
| `i18n.js` | Neue Keys in allen 4 Sprachen (5), Sprachwechsel-Hook (Selbstprüfung) |
| `CODESTRUKTUR.md` | Modul-Eintrag, Sub-Tab-Tabellen, Audio-Graph-Erwähnung (8) |
| `SPEC.md` | Neuer Sub-Tab-Abschnitt (9) |
