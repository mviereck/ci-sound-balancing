# BAUANLEITUNG 165 — Implantat-Tab Umbau

**Ziel:** Reiter „Implantat" (HTML-Panel `panel-setup`) inhaltlich und visuell überarbeiten. Reihenfolge der Elemente neu sortieren, redundante Intro-Texte zusammenführen, Default-Frequenzraster komplett aus dem UI entfernen, Konfig-Hinweise präzisieren, Tabellen-Hinweise dynamisch ein-/ausblenden, zwei bekannte Bugs (Hersteller-Dropdown-Sync, leere Hinweisbox) mit beheben, Einführungstext Punkt 2 nachziehen.

**Versionsbump:** `js/version.js` → `"3.1.165-beta"`. Bitte am Anfang setzen, damit kein Cache-Problem.

**i18n-Hinweis:** Nach Projekt-Regel werden in dieser BA **nur die deutschen i18n-Strings** in `i18n/de.js` angefaßt. Die anderen Sprachen (`en.js`, `fr.js`, `es.js`) bleiben unverändert; fehlende Keys fallen über die Fallback-Logik in `js/i18n.js:9-11` auf Deutsch zurück. Eine eigene kleine Übersetzungs-BA folgt später.

**Vorrang:** Wenn Du als Sonnet beim Bauen auf Widersprüche oder unklare Stellen stößt, bitte **stoppen und nachfragen**, nicht raten — die BA wurde mit voller Klärrunde geschrieben, abweichende Annahmen sind ein Fehler-Signal.

---

## Schritt 0 — Versionsbump

Datei `js/version.js` öffnen, eine Zeile, ersetzen:

```js
const APP_VERSION = "3.1.164-beta";
```

durch

```js
const APP_VERSION = "3.1.165-beta";
```

---

## Schritt 1 — HTML-Reihenfolge im Implantat-Tab neu aufbauen

Datei `index.html`, Bereich `<div id="panel-setup" class="panel">` (etwa Z. 261 ff.). Der Block bis einschließlich Tabelle wird **komplett neu sortiert**. Die Buttons (Sweep/Stop/Lautstärke) darunter bleiben unverändert.

**Was wegfällt:**
- `<p id="freqHint">` (Z. ~271–278) — obsoleter oberer Intro-Text
- `<p id="implIntro">` (Z. ~456–464) — wird durch neues Tabellen-Intro ersetzt
- `<div id="defaultMfrGroup">…</div>` (Z. ~441–454) — Default-Frequenzraster entfällt komplett

**Was verschoben wird:**
- `freqDeactHintEl` (Aktiv-Hinweis) — wandert von oben (war über Konfig) nach unten direkt über die Tabelle
- `freqAbfHintEl` (ABF/FAT-Hinweis) — wandert ebenfalls direkt über die Tabelle
- `implBilateralHintEl` — wandert direkt unter den `<h2>`-Titel ganz nach oben

**Neue Reihenfolge des `panel-setup`-Karteninhalts:**

Ersetze den gesamten Block von `<div class="card">` (Z. ~262) bis einschließlich `</div><!-- /implMfrBlock -->` plus die nachfolgenden Elemente `defaultMfrGroup` + `implIntro` + `implBilateralHintEl` + Tabelle (bis `</table>`) durch folgende Struktur:

```html
<div class="card">
  <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <h2 id="freqTitle" style="margin:0;"></h2>
    <button class="btn" id="printImplantBtn"
            title=""
            style="padding:4px 10px;font-size:0.9em;">
      🖨 <span data-t="printBtn"></span>
    </button>
  </div>

  <!-- Bilateral-Hinweis (oben, sichtbar solange ≥1 Seite „Keine Angabe") -->
  <div
    class="explain explain-warn"
    id="implBilateralHintEl"
    style="margin-top: 8px; margin-bottom: 12px; display: none"
  ></div>

  <!-- Hörsituation (Konfiguration pro Seite) -->
  <div class="controls-row" style="margin-bottom: 8px">
    <div class="control-group">
      <label id="lblCfg"></label>
      <select id="cfgSelect">
        <option value="unknown" id="cfgOptUnknown"></option>
        <option value="ci" id="cfgOptCI"></option>
        <option value="hg" id="cfgOptHG"></option>
        <option value="normal" id="cfgOptNormal"></option>
        <option value="shoh" id="cfgOptSchwerh"></option>
        <option value="deaf" id="cfgOptTaub"></option>
      </select>
    </div>
  </div>

  <!-- Konfig-Hinweise (bedingt) -->
  <div id="cfgHintUnknownEl" class="explain"
       style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"></div>
  <div id="cfgHintAcousticEl" class="explain"
       style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"></div>
  <div id="cfgHintDeafEl" class="explain explain-warn"
       style="display:none;margin-bottom:8px"></div>
  <div id="cfgHintBothAcousticEl" class="explain explain-warn"
       style="display:none;margin-bottom:8px"></div>

  <!-- CI-spezifischer Block: Hersteller + Prozessor + Modell + Params -->
  <div id="implMfrBlock">

    <!-- Hersteller -->
    <div class="controls-row" style="margin-bottom: 6px">
      <div class="control-group">
        <label id="lblMfr"></label>
        <select id="mfrSelect">
          <option value="unknown" id="mfrOptUnknown">—</option>
          <option value="medel">MED-EL (12)</option>
          <option value="ab">Advanced Bionics (16)</option>
          <option value="cochlear">Cochlear (22)</option>
        </select>
      </div>
    </div>

    <!-- Hersteller-Hinweis (wenn unknown) -->
    <div id="mfrHintUnknownEl" class="explain"
         style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"></div>

    <!-- Audioprozessor -->
    <div class="controls-row" id="implProcRow" style="margin-bottom: 6px">
      <div class="control-group">
        <label id="lblImplProc"></label>
        <select id="implProcSelect" style="min-width: 200px"></select>
      </div>
    </div>

    <!-- Implantat-Modell + Generation (Cochlear) -->
    <div class="controls-row" id="implModelRow" style="margin-bottom: 6px">
      <div class="control-group">
        <label id="lblImplModel"></label>
        <select id="implModelSelect" style="min-width: 220px"></select>
      </div>
      <div class="control-group" id="implGenGroup" style="display: none">
        <label id="lblImplGen"></label>
        <span id="implGenDisplay"
              style="font-family: var(--mono); font-size: 0.88em"></span>
      </div>
    </div>

    <!-- MED-EL: c-Wert -->
    <div class="controls-row" id="implMedelParams" style="display: none; margin-bottom: 6px">
      <div class="control-group">
        <label id="lblImplC"></label>
        <input type="number" id="implC" min="0" max="8000" step="1" style="width: 80px" />
      </div>
    </div>

    <!-- AB: IDR -->
    <div class="controls-row" id="implAbParams" style="display: none; margin-bottom: 6px">
      <div class="control-group">
        <label id="lblImplIDR"></label>
        <input type="number" id="implIDR" min="20" max="80" step="1" style="width: 80px" />
        dB
      </div>
    </div>

    <!-- Cochlear: IIDR -->
    <div class="controls-row" id="implCochParams" style="display: none; margin-bottom: 6px">
      <div class="control-group">
        <label id="lblImplIIDR"></label>
        <input type="number" id="implIIDR" min="20" max="80" step="1" style="width: 80px" />
        dB
      </div>
    </div>

  </div><!-- /implMfrBlock -->

  <!-- Tabellen-Intro (zwei Sätze: Pflicht / Optional) -->
  <p
    style="
      font-size: 0.86em;
      color: var(--text);
      margin-top: 14px;
      margin-bottom: 6px;
    "
    id="implTableIntroEl"
  ></p>

  <!-- Tabellen-Hinweis 1 — Aktiv-Spalte / deaktivierte Elektroden -->
  <div
    id="freqDeactHintEl"
    class="explain explain-warn"
    style="margin-bottom: 8px; display: none"
  ></div>

  <!-- Tabellen-Hinweis 2 — ABF / FAT -->
  <div
    id="freqAbfHintEl"
    class="explain explain-warn"
    style="margin-bottom: 12px; display: none"
  ></div>

  <div style="overflow-x: auto">
    <table class="freq-table" id="freqTable">
      <thead>
        <tr id="freqTH"></tr>
      </thead>
      <tbody id="freqTB"></tbody>
    </table>
  </div>

  <!-- Sweep / Stop / Lautstärke / Dauer / Pause — unverändert lassen, NICHT mit anfassen -->
  …existierende Button-Reihe bleibt 1:1 stehen…
```

**Wichtig:**
- Der existierende Button-/Lautstärke-Block direkt nach `</table>` bleibt **unverändert**. Sonnet bitte nichts daran ändern.
- `<p id="implIntro">` wird durch `<p id="implTableIntroEl">` **ersetzt** (anderer ID, andere Styling-Position). Der alte `implIntro` und alle Verweise darauf in JS müssen weg.
- `freqHint` wird komplett entfernt — siehe Schritt 4 zum applyLang-Aufruf.

---

## Schritt 2 — i18n-Strings in `i18n/de.js`

### 2a) Neue / geänderte Strings

**`freqTitle` ersetzen** (aktuell Z. ~66, `"Hersteller, Elektrodenfrequenzen & Status"`):

```js
    freqTitle: "Implantat & Elektroden",
```

**`cfgLabel` ersetzen** (aktuell Z. ~753, `"Konfiguration"`) — wird in `ui-implant.js` dynamisch erweitert, der Basistext bleibt aber:

```js
    cfgLabel: "Hörsituation",
```

**`implBilateralHint` ersetzen** (aktuell Z. ~558):

```js
    implBilateralHint:
      "<b>Beide Seiten konfigurieren.</b> Geben Sie für links und rechts die Hörsituation an (Normalhörend, Schwerhörig, Hörgerät, Cochlea-Implantat, Taub). Bei CI-Seiten kommen Hersteller und ggf. Implantat- und Elektrodendaten dazu. Wechseln Sie oben rechts zwischen LINKS und RECHTS.",
```

**`cfgHintAcoustic` ersetzen** (aktuell Z. ~791) — wird in `ui-implant.js` dynamisch mit Seitennamen befüllt (Platzhalter `{otherSide}`):

```js
    cfgHintAcoustic:
      "Das Frequenzraster wird von der CI-Seite {otherSide} übernommen, damit die Vergleichbarkeit zwischen beiden Seiten besteht.",
```

**`cfgHintDeaf` ersetzen** (aktuell Z. ~793):

```js
    cfgHintDeaf:
      "Audio wird auf dieser Seite nicht zu hören sein. Tests werden ohne Klang auf dieser Seite durchgeführt.",
```

**`cfgHintBothAcoustic` ersetzen** (aktuell Z. ~615):

```js
    cfgHintBothAcoustic:
      "<b>Tool nicht für rein akustische Versorgung vorgesehen.</b> Dieses Sound Balancing Tool richtet sich an Cochlea-Implantat-Träger und benötigt mindestens eine CI-Seite. Wenn Sie beide Seiten akustisch versorgt haben, sind Messung, Schieber und Player hier nicht anwendbar. (Eine spätere Programmversion könnte Messungen für beidseitig akustische Versorgung unterstützen.)",
```

**`mfrHintUnknown` erweitern** (aktuell Z. ~757):

```js
    mfrHintUnknown:
      "Bitte Hersteller wählen, damit Frequenzraster und Pro-Elektroden-Felder erscheinen.",
```

**`freqDeactHint` ersetzen** (aktuell Z. ~71/72), „Status" → „Aktiv":

```js
    freqDeactHint:
      "<b>Wichtig – deaktivierte Elektroden:</b> Wenn in Ihrem CI Elektroden deaktiviert sind, verteilt das Implantat den Frequenzbereich auf die verbleibenden aktiven Elektroden. Die Mittenfrequenzen aller anderen Elektroden verschieben sich dadurch — die hier voreingestellten Standardwerte gelten dann nicht mehr.<br>Haken Sie deaktivierte Elektroden in der Spalte „Aktiv" ab und tragen Sie die aktuellen Mittenfrequenzen aus Ihrer Anpassung ein. Ohne korrekte Frequenzen sind Messung und Player-Equalizer nicht aussagekräftig.",
```

**Neuer Key `implTableIntro`** (gleich nach `implBilateralHint` einfügen, alten `implIntro` daneben stehen lassen wenn er noch irgendwo referenziert wird — wird in Schritt 4 endgültig aus JS rausgeworfen):

```js
    implTableIntro:
      "<b>Was Sie eintragen sollten:</b> Tragen Sie für jede Elektrode die Mittenfrequenz (FAT) aus Ihrer CI-Anpassung ein, falls vom Audiologen bekannt. Die eingetragenen Default-Werte passen für viele CI-Träger, können aber individuell leicht bis erheblich abweichen.<br><b>Optional, verbessert den Ausdruck:</b> THR und MCL (MED-EL) bzw. T-Level/C-Level (Cochlear) bzw. T-Level/M-Level (Advanced Bionics) — diese Werte aus der Anpaß-Software Ihres Audiologen verbessern die im Ausdruck berechneten Korrekturwerte.",
```

**`introFlowDesc` ersetzen** (aktuell Z. ~22, langer HTML-String) — nur Punkt 2 anpassen, alle anderen Punkte unverändert lassen. **Achtung:** Im String steckt typographische Anführungszeichen, das Ersetzen muß die ganze Zeichenkette intakt halten. Konkret den Punkt 2 von „…unter „Status" markiert werden." auf „…in Spalte „Aktiv" angehakt werden." ändern. Der Block sieht danach so aus:

```js
    introFlowDesc:
      "<b>1. Seite</b> – Wählen Sie oben rechts die Seite aus, auf der Sie das CI tragen. Wenn Sie 2 CI tragen, führen Sie die Messung (Punkt 4) für beide aus.<br><b>2. Implantat</b> – Wählen Sie Ihren Hersteller. Falls bekannt, korrigieren Sie die Frequenzeinträge pro Elektrode. Standardwerte sind voreingestellt. <b>Wichtig:</b> Deaktivierte Elektroden müssen in Spalte „Aktiv" angehakt werden.<br><b>3. Lautstärke</b> – Stellen Sie die Lautstärke ihres PC oder Smartphone auf gefühlt 3/4 ein. Nicht leise, noch nicht unangenehm laut.<br><b>4. Messung</b> – Starten Sie eine Testreihe in „Messungen" → „Elektrodenlautstärke". Das Tool spielt Tonpaare ab; Sie stellen ein, bis beide gleich laut klingen.<br><b>5. Player</b> – Laden Sie eine Musikdatei und hören Sie den Unterschied mit und ohne Korrektur.<br><b>6. Levels</b> – Optional: Gesamteinstellungen wie Sprachbetonung oder Baßverstärkung, live hörbar im Player.",
```

### 2b) Strings entfernen aus `i18n/de.js`

Die folgenden Keys werden in JS nirgends mehr verwendet (siehe Schritte 4–6) und können entfernt werden:

- `cfgHintAcousticDefault` (Z. ~792)
- `cfgDefaultLabel` (Z. ~763)
- `freqHint` (Z. ~69/70) — der alte obere Intro-Text
- `implIntro` (Z. ~556/557) — wird durch `implTableIntro` ersetzt

Wenn beim Versuch der Entfernung unklar ist, ob ein anderer Code-Pfad sie noch braucht, **belassen** und melden — Tabellen-Keys verschwinden zu lassen ist riskanter als ungenutzte Strings stehenzulassen.

### 2c) Anführungszeichen-Hygiene

Die i18n-Strings mischen typographische („…") und ASCII-Anführungszeichen. Vor dem Speichern bitte einmal mit Augenmaß durchgehen: pro String muß die Zahl der `"`-Zeichen gerade sein, sonst bricht der JS-Parser. Bei Strings, die typographische „…" für angezeigten Text und ASCII `"` als Stringterminator nutzen, ist das so beabsichtigt — nur reine ASCII-`"` im Stringinneren sind problematisch (nicht escaped).

---

## Schritt 3 — `ui-implant.js`: Hörsituation-Label, Hersteller-Sync, Hinweise

Datei `js/ui-implant.js`, Funktion `buildImplantCard()`.

### 3a) Bug A1 Fix — Hersteller-Dropdown sync

Direkt nach dem Block, der `implMfrBlock` ein-/ausblendet (etwa Z. 62–63), eine neue Zeile einfügen, die den `mfrSelect`-Wert hart auf den aktuellen State setzt — egal ob CI oder nicht:

**Vor:**
```js
  const mfrBlock = document.getElementById("implMfrBlock");
  if (mfrBlock) mfrBlock.style.display = isCiCfg ? "" : "none";
```

**Nach:**
```js
  const mfrBlock = document.getElementById("implMfrBlock");
  if (mfrBlock) mfrBlock.style.display = isCiCfg ? "" : "none";
  // BA 165: Dropdown-Wert hart auf State sync (Bug A1: Anzeige blieb sonst hängen)
  const mfrSelEl = document.getElementById("mfrSelect");
  if (mfrSelEl) mfrSelEl.value = s.manufacturer || "unknown";
```

### 3b) „Hörsituation" mit dynamischem Seiten-Suffix

Im Block, der `lblCfg` setzt (etwa Z. 42–43), `cfgLabel` um Seitennamen erweitern. **Vor:**

```js
    const lbl = document.getElementById("lblCfg");
    if (lbl) lbl.textContent = t("cfgLabel") + ":";
```

**Nach:**

```js
    const lbl = document.getElementById("lblCfg");
    if (lbl) {
      const sideLbl = activeSide === "left" ? t("sideLeft") : t("sideRight");
      lbl.textContent = t("cfgLabel") + " " + sideLbl + ":";
    }
```

`sideLeft`/`sideRight` sind bereits in `i18n/de.js` (Z. 6/7, „LINKS"/„RECHTS"). Das ergibt: „Hörsituation LINKS:" bzw. „Hörsituation RECHTS:".

### 3c) Konfig-Hinweis „akustisch" mit Seitennamen befüllen

Der Block, der `cfgHintAcousticEl` setzt (etwa Z. 79–93), nutzt heute zwei verschiedene Strings (`cfgHintAcoustic` und `cfgHintAcousticDefault`). Beide vereinheitlichen auf den neuen `cfgHintAcoustic`-String mit `{otherSide}`-Platzhalter; den `Default`-Fallback ersatzlos entfernen.

**Vor:**

```js
  const hintAc = document.getElementById("cfgHintAcousticEl");
  if (hintAc) {
    const isAcoustic = ["hg","normal","shoh"].includes(cfg);
    hintAc.style.display = isAcoustic ? "" : "none";
    if (isAcoustic) {
      const src = getFreqSource();
      if (src) {
        const srcLabel = src === "left" ? t("sideLeft") : t("sideRight");
        hintAc.textContent = t("cfgHintAcoustic") + " (" + srcLabel + ")";
      } else {
        hintAc.textContent = t("cfgHintAcousticDefault");
      }
    }
  }
```

**Nach:**

```js
  const hintAc = document.getElementById("cfgHintAcousticEl");
  if (hintAc) {
    const isAcoustic = ["hg","normal","shoh"].includes(cfg);
    const src = getFreqSource();
    // BA 165: Hinweis nur sinnvoll, wenn andere Seite tatsächlich CI ist.
    // Sonst greift cfgHintBothAcoustic (an anderer Stelle gerendert).
    const showAc = isAcoustic && !!src;
    hintAc.style.display = showAc ? "" : "none";
    if (showAc) {
      const srcLabel = src === "left" ? t("sideLeft") : t("sideRight");
      hintAc.textContent = t("cfgHintAcoustic").replace("{otherSide}", srcLabel);
    }
  }
```

### 3d) Bilateral-Hinweis-Sichtbarkeit „solange ≥1 Seite Keine Angabe"

Im Block direkt nach den i18n-Setzern für `implBilateralHintEl` (etwa Z. 27–29), die statische Anzeige durch eine bedingte ersetzen.

**Vor:**

```js
  document.getElementById("implBilateralHintEl").innerHTML =
    t("implBilateralHint");
  document.getElementById("implBilateralHintEl").style.display = "block";
```

**Nach:**

```js
  // BA 165: Sichtbarkeit nach Konzept — sichtbar solange ≥1 Seite „Keine Angabe"
  const bilatEl = document.getElementById("implBilateralHintEl");
  if (bilatEl) {
    const leftUnknown  = (sideData.left.config  || "unknown") === "unknown";
    const rightUnknown = (sideData.right.config || "unknown") === "unknown";
    const showBilat = leftUnknown || rightUnknown;
    bilatEl.innerHTML = t("implBilateralHint");
    bilatEl.style.display = showBilat ? "block" : "none";
  }
```

### 3e) `defaultMfrGroup`-Manipulation entfernen

Der Block, der `defaultMfrGroup` referenziert (etwa Z. 119–127), kann komplett gelöscht werden — die UI-Komponente ist nicht mehr im DOM.

**Vor (gelöscht):**

```js
  // Default-Frequenzraster-Dropdown
  const dfGroup = document.getElementById("defaultMfrGroup");
  if (dfGroup) {
    dfGroup.style.display = "none";
    const lblDfMfr = document.getElementById("lblDefaultMfr");
    if (lblDfMfr) lblDfMfr.textContent = t("cfgDefaultLabel") + ":";
    const dfSel = document.getElementById("defaultMfrSelect");
    if (dfSel) dfSel.value = defaultMfr;
  }
```

**Nach:** ersatzlos entfernen.

### 3f) Tabellen-Intro setzen

Im selben `buildImplantCard()`-Lauf zusätzlich den neuen `implTableIntroEl` mit Text füllen — und sichtbar machen, wenn die Tabelle gerendert wird (sprich: kein unknown-Zustand). Direkt nach dem Setzen von `implTitle`/`implBilateralHintEl` einfügen:

```js
  // BA 165: Tabellen-Intro — nur sichtbar, wenn die Tabelle gerendert wird
  const tableIntroEl = document.getElementById("implTableIntroEl");
  if (tableIntroEl) {
    const showTable = isCiCfg && !isUnknownMfr;
    tableIntroEl.innerHTML = t("implTableIntro");
    tableIntroEl.style.display = showTable ? "block" : "none";
  }
```

`isUnknownMfr` wird in der Funktion ohnehin schon weiter unten berechnet (Z. ~60); diese Berechnung **muß vor dem Tabellen-Intro-Setter passieren**. Wenn nötig, die Variable `isUnknownMfr = isCiCfg && (s.manufacturer === "unknown" || !s.manufacturer)` an die obere Hälfte der Funktion hochziehen, sodaß sie hier verfügbar ist.

### 3g) Alter `implIntro`-Setter raus

Die alte Zeile

```js
  document.getElementById("implIntro").textContent = t("implIntro");
```

(etwa Z. 26) ersatzlos entfernen — das Element existiert nicht mehr.

---

## Schritt 4 — `freq-table.js`: Tabellen-Hinweise dynamisch ein-/ausblenden

Datei `js/freq-table.js`, Funktion `buildFreqTable()`.

### 4a) Bug A3 Fix — Hinweise bei Early-Return ausblenden

Im Early-Return-Block (Z. 14–18), der bei `isUnknownCfg` oder `isUnknownMfr` greift, zusätzlich die beiden Hinweis-Boxen auf `display:none` setzen.

**Vor:**

```js
  if (isUnknownCfg || isUnknownMfr) {
    document.getElementById("freqTH").innerHTML = "";
    document.getElementById("freqTB").innerHTML = "";
    return;
  }
```

**Nach:**

```js
  if (isUnknownCfg || isUnknownMfr) {
    document.getElementById("freqTH").innerHTML = "";
    document.getElementById("freqTB").innerHTML = "";
    // BA 165: Tabellen-Hinweise nicht anzeigen, wenn keine Tabelle gerendert wird
    const hDeact = document.getElementById("freqDeactHintEl");
    if (hDeact) hDeact.style.display = "none";
    const hAbf = document.getElementById("freqAbfHintEl");
    if (hAbf) hAbf.style.display = "none";
    return;
  }
```

Den zweiten Early-Return-Block für „beide Seiten akustisch" (Z. 23–27) analog ergänzen:

**Vor:**

```js
  if (_isAc(leftCfg2) && _isAc(rightCfg2)) {
    document.getElementById("freqTH").innerHTML = "";
    document.getElementById("freqTB").innerHTML = "";
    return;
  }
```

**Nach:**

```js
  if (_isAc(leftCfg2) && _isAc(rightCfg2)) {
    document.getElementById("freqTH").innerHTML = "";
    document.getElementById("freqTB").innerHTML = "";
    // BA 165: Tabellen-Hinweise nicht anzeigen, wenn keine Tabelle gerendert wird
    const hDeact = document.getElementById("freqDeactHintEl");
    if (hDeact) hDeact.style.display = "none";
    const hAbf = document.getElementById("freqAbfHintEl");
    if (hAbf) hAbf.style.display = "none";
    return;
  }
```

### 4b) Dynamische Sichtbarkeit „alle aktiven Elektroden haben eigene Hz"

Im Bereich, der heute `freqDeactHintEl` und `freqAbfHintEl` mit Text füllt (Z. ~266–276), die Sichtbarkeit zusätzlich an die „alle aktiven mit eigenen Hz"-Bedingung koppeln.

**Vor:**

```js
  // BA 164: Hinweis & Warnung jetzt aus elActive[]
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = (elActive || []).some((a) => a === false);
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
  }
  // ABF hint (always visible)
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.innerHTML = t("freqAbfHint");
  }
```

**Nach:**

```js
  // BA 164/165: Hinweis & Warnung aus elActive[] + Sichtbarkeit nach „eigene Hz vollständig"
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = (elActive || []).some((a) => a === false);
  // BA 165: „vollständig eigene Hz" = jede aktive Elektrode hat elFreqOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => elFreqOwn[i] != null);
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
    hintEl.style.display = ownHzComplete ? "none" : "";
  }
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.innerHTML = t("freqAbfHint");
    abfHintEl.style.display = ownHzComplete ? "none" : "";
  }
```

**Akustischer Branch (`isAcoustic`):** Auch hier dieselbe Sichtbarkeits-Regel anwenden? Aktuell wird im akustischen Branch (BA 153, Z. ~37 ff.) eine andere Tabelle ohne `elFreqOwn`/`elActive` aufgebaut. Die beiden Tabellen-Hinweise sind dort **nicht** sichtbar — entsprechend im akustischen Zweig vor Render explizit ausblenden. Im Block direkt vor dem `if (isAcoustic) { … }` (Z. ~36) einfügen:

```js
  // BA 165: Tabellen-Hinweise auch im akustischen Branch ausblenden
  // (gelten nur für die CI-Tabelle mit Aktiv-Spalte und eigenen Hz)
  if (isAcoustic) {
    const hDeact2 = document.getElementById("freqDeactHintEl");
    if (hDeact2) hDeact2.style.display = "none";
    const hAbf2 = document.getElementById("freqAbfHintEl");
    if (hAbf2) hAbf2.style.display = "none";
  }
```

---

## Schritt 5 — `js/init.js`: defaultMfrSelect-Handler entfernen

Datei `js/init.js`, Z. 117–125. Der gesamte Block, der den Change-Handler für `defaultMfrSelect` registriert, kann **ersatzlos entfernt** werden. Die `defaultMfr`-Variable bleibt im State erhalten (Persistenz, Datei-Format), aber sie wird nicht mehr aktiv über UI verändert.

**Vor:**

```js
  // Default-Frequenzraster (nur wenn keine Seite CI)
  document.getElementById("defaultMfrSelect").addEventListener("change", (e) => {
    defaultMfr = e.target.value;
    syncFreqsToAcoustic();
    buildFreqTable();
    buildImplantCard();
    buildPrTbl();
    drawLvChart();
    renderResults();
  });
```

**Nach:** ersatzlos entfernen.

---

## Schritt 6 — `js/i18n.js` applyLang: `freqHint`-Setter raus

Datei `js/i18n.js`, Z. 76. Die Zeile

```js
  s("freqHint", "freqHint");
```

ersatzlos entfernen — das Element existiert nicht mehr im DOM und der i18n-Key wurde in Schritt 2b entfernt. Das `s()`-Helper-Pattern ist tolerant gegenüber fehlenden Elementen (`if (e)`), aber ein toter Eintrag bleibt ein toter Eintrag.

---

## Schritt 7 — `js/state-side.js`: kein aktiver Eingriff nötig

`defaultMfr` bleibt als globale Variable für Persistenz und Datei-Kompatibilität bestehen. Der Branch in `syncFreqsToAcoustic()` Z. 608–627 (beide-nicht-CI → Default-Raster anwenden) bleibt **technisch bestehen**, greift aber unter normalen Bedingungen nicht mehr (Tab-Sperre in BA 166 wird die beide-akustisch-Konstellation abfangen). Bitte nichts ändern in `state-side.js`.

`setActiveSide()` (Z. 178–181) referenziert `defaultMfrSelect`-DOM-Element:

```js
  const dfSel = document.getElementById("defaultMfrSelect");
  if (dfSel) dfSel.value = defaultMfr;
```

Der `if (dfSel)`-Guard greift bei fehlendem DOM-Element, der Block schadet also nicht. Trotzdem zum Aufräumen entfernen, weil das Element garantiert weg ist. **Vor:**

```js
  const dfSel = document.getElementById("defaultMfrSelect");
  if (dfSel) dfSel.value = defaultMfr;
```

**Nach:** ersatzlos entfernen.

---

## Schritt 8 — Selbstprüfungs-Auftrag an Sonnet

Bevor Du eine Fertig-Meldung gibst, gehe jeden Punkt einzeln durch und melde pro Punkt: **erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

1. `js/version.js` zeigt `"3.1.165-beta"`.
2. In `index.html` ist die neue Reihenfolge im `panel-setup` umgesetzt; `<p id="freqHint">`, `<p id="implIntro">` und `<div id="defaultMfrGroup">` existieren nicht mehr; `<div id="implBilateralHintEl">` steht direkt unter dem `<h2>`; `<p id="implTableIntroEl">`, `<div id="freqDeactHintEl">`, `<div id="freqAbfHintEl">` stehen direkt vor `<table id="freqTable">`.
3. Die in Schritt 2a genannten i18n-Strings sind in `i18n/de.js` aktualisiert.
4. Die in Schritt 2b genannten i18n-Strings (`cfgHintAcousticDefault`, `cfgDefaultLabel`, `freqHint`, `implIntro`) sind aus `i18n/de.js` entfernt **oder** explizit als belassen begründet (sollte nicht nötig sein).
5. `js/ui-implant.js`: Hersteller-Sync per `mfrSelect.value = s.manufacturer || "unknown"` ist drin.
6. `js/ui-implant.js`: Label-Setter für `lblCfg` enthält Seiten-Suffix dynamisch.
7. `js/ui-implant.js`: `cfgHintAcousticEl` greift mit `{otherSide}`-Replace zu; `cfgHintAcousticDefault`-Fallback ist weg.
8. `js/ui-implant.js`: Bilateral-Hinweis nur sichtbar, wenn ≥1 Seite `config === "unknown"`.
9. `js/ui-implant.js`: `defaultMfrGroup`-Block ist ersatzlos entfernt.
10. `js/ui-implant.js`: alter `implIntro`-Setter ist entfernt; neuer `implTableIntroEl`-Setter ist drin, mit Sichtbarkeit an „CI + Hersteller bekannt" gekoppelt.
11. `js/freq-table.js`: beide Early-Returns blenden `freqDeactHintEl` und `freqAbfHintEl` auf `display:none`.
12. `js/freq-table.js`: im akustischen Branch werden beide Hinweise vorab ausgeblendet.
13. `js/freq-table.js`: Sichtbarkeit der beiden Hinweise ist gekoppelt an „alle aktiven Elektroden haben eigene Hz" (`elFreqOwn[i] != null` für alle `i` mit `elActive[i] !== false`).
14. `js/init.js`: `defaultMfrSelect`-Change-Handler ist entfernt.
15. `js/i18n.js`: `s("freqHint", "freqHint")` ist entfernt.
16. `js/state-side.js`: `defaultMfrSelect`-Wert-Setter in `setActiveSide` ist entfernt.
17. `introFlowDesc` Punkt 2 enthält den neuen Wortlaut „in Spalte „Aktiv" angehakt werden".
18. `i18n/de.js`: jeder geänderte String hat eine gerade Anzahl von ASCII-`"`-Zeichen (Parser-Hygiene).

Wenn ein Punkt **unklar** ist, **nicht raten** — melden und auf Rückfrage warten.

---

## Schritt 9 — Akzeptanz-Checkliste für den Nutzer

Nach erfolgreichem Bau bitte vom Nutzer durchgehen lassen. Erwartetes Verhalten in `[…]`.

1. **Frischer Browser-Reload (F5 oder Cache leeren).**
   - `index.html` lädt, Reiter-Bar oben zeigt „Implantat" als zweiten Tab. [Version-Label rechts oben zeigt `v3.1.165-beta`.]

2. **Klick auf Reiter „Implantat".**
   - Überschrift lautet **„Implantat & Elektroden"**.
   - Direkt darunter ein gelb umrandeter Hinweis-Kasten („Beide Seiten konfigurieren…").
   - Darunter Dropdown **„Hörsituation LINKS:"** (oder RECHTS, je nach aktiver Seite). Default-Wert „Keine Angabe".
   - Darunter ein blauer Info-Kasten „Bitte zuerst Hörsituation wählen…".
   - Hersteller-Block, Tabellen-Intro, Tabellen-Hinweise und Tabelle sind **nicht sichtbar**.

3. **Hörsituation wechseln auf „Cochlea-Implantat".**
   - Bilateral-Hinweis bleibt sichtbar (andere Seite noch unknown).
   - Hersteller-Block erscheint mit Hersteller-Dropdown auf „Keine Angabe" + blauer Hinweis „Bitte Hersteller wählen…".
   - Tabellen-Intro und Tabellen-Hinweise und Tabelle sind weiterhin **nicht sichtbar**.

4. **Hersteller wechseln auf „MED-EL".**
   - Audioprozessor-, Implantat-Modell- und c-Wert-Zeile erscheinen.
   - Direkt darunter: zwei Sätze Tabellen-Intro („Was Sie eintragen sollten:" / „Optional, verbessert den Ausdruck:").
   - Direkt darunter: gelb umrandeter Hinweis zu deaktivierten Elektroden (Text erwähnt **Spalte „Aktiv"**, nicht mehr „Status").
   - Direkt darunter: gelb umrandeter ABF-Hinweis.
   - Direkt darunter: Frequenztabelle mit 12 Zeilen, sichtbar.

5. **Bug A1 reproduzieren — funktioniert nicht mehr:** Hörsituation auf „Keine Angabe" stellen, dann wieder zurück auf „Cochlea-Implantat" — der Hersteller-Dropdown zeigt jetzt „Keine Angabe" (nicht mehr fälschlich „MED-EL"), und der Hersteller-Block weiß deshalb wieder den Hinweis „Bitte Hersteller wählen…".

6. **Bug A3 reproduzieren — funktioniert nicht mehr:** In einem Zustand, in dem die Tabelle nicht gerendert wird (z.B. Hörsituation = „Keine Angabe"), sind die beiden gelben Tabellen-Hinweis-Boxen **vollständig unsichtbar**, nicht nur leer.

7. **Eigene Hz-Werte vollständig eintragen:** In der Tabelle für jede Elektrode in der „Hz eigene"-Spalte einen Wert eintragen (Zahl, egal welche). Sobald **alle aktiven** Elektroden eigene Hz haben, **verschwinden** die beiden Tabellen-Hinweise (Aktiv-Hinweis und ABF-Hinweis). Ein einzelnes Hz-Feld löschen lassen sie wieder erscheinen.

8. **Andere Seite konfigurieren:** Auf der anderen Seite (Button rechts oben) Hörsituation wählen — sobald **beide** Seiten ≠ „Keine Angabe", verschwindet der Bilateral-Hinweis-Kasten oben.

9. **Akustische Konfiguration:** Eine Seite auf „Normalhörend" stellen, andere bleibt CI. Hinweis-Kasten auf der akustischen Seite zeigt: „Das Frequenzraster wird von der CI-Seite **RECHTS** übernommen, damit die Vergleichbarkeit zwischen beiden Seiten besteht." Seitenname dynamisch.

10. **Beide akustisch:** Beide Seiten auf „Normalhörend" stellen. Auf beiden Seiten erscheint der Hinweis „**Tool nicht für rein akustische Versorgung vorgesehen.** …". Frequenztabelle und Tabellen-Hinweise nicht sichtbar.

11. **Taub:** Eine Seite auf „Taub" stellen. Hinweis: „Audio wird auf dieser Seite nicht zu hören sein. Tests werden ohne Klang auf dieser Seite durchgeführt."

12. **Reiter „Einführung":** Punkt 2 endet auf „…in Spalte „Aktiv" angehakt werden." (nicht mehr „unter „Status" markiert werden.").

13. **Sprachwechsel auf EN/FR/ES:** Texte fallen für unveränderte Keys auf Deutsch zurück (erwartet, weil andere Sprachen in dieser BA bewußt nicht angefaßt). Die deutsche Vorlage ist die Quelle für die Folge-Übersetzungs-BA.

---

## Schritt 10 — Hinweis auf Folge-Bauanleitungen

Nach erfolgreichem Bau von BA 165:

- **BA 166** folgt: Tab-Sperr-Mechanik (Messungen/Meßergebnisse/Kurven/Schieber/Player ausgrauen, solange Implantat-Angaben unzureichend oder beide-akustisch). Modal-Overlay-Komponente wird dort etabliert.
- **BA 167** folgt: Sub-Tab- und Player-Bereich-Sperre für „eine Seite taub".
- **Übersetzungs-Mini-BA** folgt: en/fr/es-Strings für alle in BA 165 geänderten/neuen Keys.

Diese drei sind nicht Teil von BA 165 und sollen hier nicht mitgebaut werden.

---

## Schlußbemerkung

Wenn beim Bauen etwas nicht aufgeht (Datei sieht anders aus als beschrieben, Zeilennummer paßt nicht, ein Snippet hat keinen klaren Anker), **stoppe und melde**. Lieber eine Rückfrage als eine stille Annahme — die BA wurde nach mehreren Klärrunden geschrieben, Abweichungen sind ein Signal.
