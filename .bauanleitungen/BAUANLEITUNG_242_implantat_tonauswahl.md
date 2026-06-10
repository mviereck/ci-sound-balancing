# BA 242: Implantat-Tab — sweepRow raus, Tonauswahl-Modal rein

## Ziel

Dritter Schritt der vierteiligen Umstellung (BA 240–243). Der
Implantat-Tab bekommt die neue Tonauswahl-Modal als zentrale Wieder-
gabe-Steuerung.

1. **`#sweepRow` wird komplett entfernt** aus `index.html`. Damit fallen
   weg: Sweep-/Stop-Knopf, die drei Eingabefelder `vol1` / `dur1` /
   `pau1`, der globale Korrektur-Toggle `#corrToggle`.
2. **Neuer Knopf „Elektroden über Töne anspielen"** an gleicher Stelle.
   Label zeigt zusätzlich die aktuell gewählte Tonart (analog
   Freqmatch-Header-Knopf). Klick öffnet die Modal.
3. **Neue State-Variablen** in `state-side.js`:
   - `toneType_implant = "sine"` (Default Sinus)
   - `volume_implant = 75`
   - `duration_implant = 1000`
   - `pause_implant = 500`
4. **Modal-Aufruf** in `ui-implant.js` mit allen BA-240/241-Features:
   - Hint-Box (eigener i18n-Key für den Implantat-Hinweis-Text)
   - Korrektur-Toggles (Default an, wie im Freqmatch)
   - Vol/Dur/Pau-Eingabefelder
   - Klavier-Widget mit allen Elektroden der `activeSide` inkl.
     Disabled-Anzeige für deaktivierte (`elActive[i] === false`) und
     ausgeschlossene (`elExDur[i] != null`) Elektroden
   - Sweep-Knopf (spielt alle aktiven Elektroden apikal→basal auf
     `activeSide`-Pan)
   - Klaviertaste = Hold-Modus: Druck spielt Ton der Modal-Tonart
     so lange wie gedrückt
5. **Aufräumen in `js/audio.js`**: `playSweep`-Funktion und die
   Variable `sweepAct` entfallen (toter Code nach sweepRow-Entfernung).
6. **Persistenz**: `volume_implant / duration_implant / pause_implant /
   toneType_implant` werden in `file.js` (Save + Load + Reset)
   verankert.
7. **`freq-table.js`**: die Sichtbarkeits-Steuerung wird vom alten
   `sweepRow`-Element auf den neuen `implTonePopupRow`-Container
   umgeschrieben.

`playSingle`, `playHold`, `toggleHold`, `corrG` bleiben in `audio.js`
**vorerst** stehen — sie werden von den Play/Hold-Spalten in der
`freq-table` noch gerufen. Die Spalten und damit auch diese Funktionen
fallen in BA 243.

i18n: nur Deutsch. Zwei neue Keys (`implTonePopupBtn`, `tonePopupHintImplant`).
EN/FR/ES als spätere Folge-Mini-BA.

## Codestand (zur Orientierung)

- `index.html` Z. 451–544: `<div id="sweepRow">`-Block mit Sweep-/Stop-
  Knopf, `vol1`/`dur1`/`pau1`-Eingaben und `corrToggle`-Checkbox. Wird
  ersetzt durch einen einfachen Knopf-Container.
- `js/audio.js`: `playSweep()` (Z. 901–915), `sweepAct` als globale
  Variable in `state-side.js:676`. `corrG()` (Z. 873–878) liest den
  Wert von `#corrToggle.checked` — bleibt vorerst, fällt mit BA 243.
- `js/init.js:85–86`: Listener für `#sweepBtn` und `#stopBtn`. Werden
  entfernt.
- `js/ui-implant.js`: heute keine Anbindung an die Tonauswahl-Modal.
  Bekommt neue Funktionen `openImplantTonePopup()` und
  `_implTonePopupUpdLabel()`.
- `js/freq-table.js` Z. 17, 323–324: `sweepRow`-ID wird gegen
  `implTonePopupRow` getauscht.
- `js/state-side.js`: globale State-Variablen, Stelle für die neuen
  vier Implantat-Variablen.
- `js/file.js`: Z. 55–65 Reset-Block, Z. 283–285 Save-Block,
  Z. 593–605 Load-Block.

## Schritte

### 1. Version bumpen — `js/version.js`

```js
const APP_VERSION = "3.2.242-beta";
```

### 2. Neue State-Variablen — `js/state-side.js`

Direkt unter den BA-240-Variablen (`volume_freqmatch`,
`duration_freqmatch`, `pause_freqmatch`) vier weitere einfügen:

```js
// BA 242: Implantat-Tab-Tonauswahl. Vol/Dur/Pau analog freqmatch.
// Default-Tonart Sinus, weil im Implantat-Tab problematische Elektroden
// per Sinus am besten zu erkennen sind (Rauschen, Aussetzer).
let toneType_implant = "sine";
let volume_implant   = 75;
let duration_implant = 1000;
let pause_implant    = 500;
```

Außerdem `sweepAct` entfernen (BA 242: dead code). Z. 676 die
Deklaration `sweepAct = false,` aus dem Multi-Deklarations-Block
löschen. Aufrufer in `audio.js` werden im Schritt 6 mit-entfernt.

### 3. HTML — `sweepRow` ersetzen — `index.html`

Den ganzen Block von Z. 451 bis einschließlich Z. 544 (das
`<div id="sweepRow">…</div>` mit Sweep-Knopf, Stop-Knopf, vol1, dur1,
pau1, corrToggle) **ersetzen** durch:

```html
          <div
            id="implTonePopupRow"
            style="margin-top: 12px; display: none;"
          >
            <button class="btn" id="implTonePopupBtn"></button>
          </div>
```

Das Element behält denselben Eltern-Container; nur sein Inhalt ändert
sich. Die direkt darauf folgende `<details id="implValidateBox">`-Box
bleibt unverändert.

### 4. Init — `js/init.js`

Z. 85–86 (die zwei Listener für `sweepBtn` / `stopBtn`) ersetzen
durch:

```js
  // BA 242: Tonauswahl-Modal im Implantat-Tab.
  var implTpBtn = document.getElementById("implTonePopupBtn");
  if (implTpBtn) {
    implTpBtn.addEventListener("click", function () {
      if (typeof openImplantTonePopup === "function") openImplantTonePopup();
    });
  }
```

### 5. Implantat-Modal-Logik — `js/ui-implant.js`

Am Ende der Datei (nach `updCochlearGen()`-Funktion) den folgenden
Block anhängen:

```js
// ============================================================
// BA 242: Implantat-Tab Tonauswahl-Modal
// ============================================================

// Label des Tonauswahl-Knopfs neu rendern: Praefix-Text + aktuelle Tonart.
function _implTonePopupUpdLabel() {
  var btn = document.getElementById("implTonePopupBtn");
  if (!btn) return;
  var prefix = (typeof t === "function") ? t("implTonePopupBtn") : "Elektroden über Töne anspielen";
  var ttKey  = (typeof window.toneTypeI18nKey === "function")
    ? window.toneTypeI18nKey(toneType_implant) : null;
  var ttLbl  = (ttKey && typeof t === "function") ? t(ttKey) : toneType_implant;
  btn.textContent = prefix + " — " + ttLbl;
}

// Aktive Elektroden-Indizes der activeSide, Reihenfolge apikal -> basal
// (Index 0 = apikal). Liefert ALLE Elektroden inkl. deaktivierten/
// ausgeschlossenen; die disabled-Liste wird separat geliefert (damit
// das Klavier sie ausgrauen kann).
function _implTpAllElectrodeIdx() {
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(i);
  return arr;
}

function _implTpElectrodeFreqs() {
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(effFreq(i));
  return arr;
}

function _implTpElectrodeLabels() {
  var prefix = (typeof dENPrefix === "function") ? dENPrefix() : "E";
  var arr = [];
  for (var i = 0; i < nEl; i++) arr.push(prefix + ((typeof dEN === "function") ? dEN(i) : (i + 1)));
  return arr;
}

function _implTpDisabledElectrodes() {
  var arr = [];
  for (var i = 0; i < nEl; i++) {
    if (elActive[i] === false) { arr.push(i); continue; }
    if (typeof elExDur !== "undefined" && elExDur[i] != null) { arr.push(i); continue; }
  }
  return arr;
}

// Korrektur-Funktion (von onTogglesReady der Modal gesetzt). Analog
// freqmatch.js / tone-popup.js. Wirkung auf Klavier-Hold und Sweep-Tone.
var _implTpCorrectVol = null;
// Live-Tonart waehrend Modal offen (vor OK-Bestaetigung).
var _implTpModalTone = null;

function openImplantTonePopup() {
  if (typeof openToneSelectionDialog !== "function") return;
  var activePan = (activeSide === "left") ? -1 : 1;

  openToneSelectionDialog({
    // --- Tonart ---
    getToneType:    function ()   { return toneType_implant; },
    setToneType:    function (tt) { toneType_implant = tt; _implTonePopupUpdLabel(); },
    onToneSelected: function (tt) { _implTpModalTone = tt; },
    onModalClose:   function ()   { _implTpModalTone = null; _implTpCorrectVol = null; },

    // --- Hint-Text (eigener Key fuer Implantat) ---
    hintKey: "tonePopupHintImplant",

    // --- Vol/Dur/Pau ---
    showVolume:       true,
    showDuration:     true,
    showPause:        true,
    getVolumePercent: function ()  { return volume_implant; },
    setVolumePercent: function (v) { volume_implant = v; },
    getDurationMs:    function ()  { return duration_implant; },
    setDurationMs:    function (v) { duration_implant = v; },
    getPauseMs:       function ()  { return pause_implant; },
    setPauseMs:       function (v) { pause_implant = v; },

    // Vorspiel-Lautstaerke (Audio-Wert 0..1). Wird vom Vorspiel-Pfad und
    // vom Sweep gerufen.
    getVolume: function () {
      return Math.pow(volume_implant / 100, 2);
    },

    // Vorspiel-Sequenz beim Tonart-Klick. Spielt einen kurzen Ton der
    // mittleren Elektrode auf activeSide-Pan.
    getPreviewSequence: function () {
      var midIdx = Math.floor(nEl / 2);
      var hz = effFreq(midIdx);
      return [{ hz: hz, pan: activePan, durationMs: duration_implant }];
    },

    // Korrektur-Toggles. onTogglesReady kommt aus der Modal und liefert
    // eine Funktion (vol, hz, pan) -> korrigiertes vol.
    onTogglesReady: function (fn) { _implTpCorrectVol = fn; },

    // --- Klavier (Hold-Modus) ---
    keyboardMode:          true,
    getElectrodeFreqs:     _implTpElectrodeFreqs,
    getElectrodeLabels:    _implTpElectrodeLabels,
    getDisabledElectrodes: _implTpDisabledElectrodes,
    onPress: function (electrodeIdx, hz) {
      var c = (typeof gAC === "function") ? gAC() : null;
      if (!c) return;
      var tt  = (_implTpModalTone !== null) ? _implTpModalTone : toneType_implant;
      var vol = Math.pow(volume_implant / 100, 2);
      if (typeof _implTpCorrectVol === "function") vol = _implTpCorrectVol(vol, hz, activePan);
      try {
        // Hold-Modus: dauerhafter Ton bis onRelease (oder duration_implant
        // als Sicherheits-Maximum). playHold ruft osc.stop() in stopAll().
        if (typeof playHold === "function") playHold(hz, vol);
        else playToneTyped(c, hz, vol, 5000, activePan, tt);
      } catch (e) { /* swallow */ }
    },
    onRelease: function () {
      if (typeof stopAll === "function") stopAll();
    },
    // Hold-Highlight braucht keine eigene Dauer; das Klavier ignoriert
    // getHighlightMs im Hold-Modus (onRelease toggelt den Highlight aus).

    // --- Sweep ---
    sweepMode: true,
    getSweepPan: function () { return activePan; },

  }, _implTonePopupUpdLabel);
}
```

**Wichtig:** Diese Funktionen sind globale function declarations. Sie
dürfen nicht in `buildImplantCard` eingerückt werden — sie müssen am
Top-Level der Datei stehen.

**Hinweis zu `playHold`:** Wenn `playHold` heute nur den **globalen**
`globalToneType` benutzt (siehe `js/audio.js`), spielt der Klaviertasten-
Druck mit dieser Tonart, nicht mit `toneType_implant`. Das ist ein
Bug, den BA 242 nicht repariert — er wird durch BA 243 obsolet, sobald
die Play/Hold-Spalten und mit ihnen die `playHold`-Funktion umgebaut
werden. Für BA 242 reicht der Fallback-Pfad `playToneTyped(c, hz, vol,
5000, activePan, tt)`, der die richtige Tonart spielt, aber kein
kontinuierliches Hold leisten kann (Ton endet nach 5 s). **Sonnet prüft
in Schritt 5b:** rufen wir `playHold` oder den Fallback? Wenn `playHold`
genutzt wird, ist die Tonart `globalToneType` — das ist falsch. Korrekte
Wahl: **Fallback verwenden** (`playToneTyped` mit hoher Maximaldauer),
damit zumindest die Tonart stimmt. Die Lücke der dauerhaften Wiedergabe
beim Gedrückthalten wird im Akzeptanztest dokumentiert und in BA 243
behoben.

**5b) Den `playHold`-Pfad entfernen** — den `if (typeof playHold ==='function')`-
Zweig löschen, stattdessen direkt:

```js
      try {
        playToneTyped(c, hz, vol, 5000, activePan, tt);
      } catch (e) { /* swallow */ }
```

(Damit klingt der Ton nach 5 Sekunden aus, auch wenn die Taste gehalten
bleibt. Behebung des dauerhaften Hold-Modus für die Implantat-Tonart
folgt in BA 243.)

### 6. `playSweep` und `sweepAct` aus `js/audio.js` entfernen

Z. 901–915 (`async function playSweep() { … }`) ersatzlos löschen.

In `stopAll` (Z. 48–63) die Zuweisung `sweepAct = false;` (Z. 59)
entfernen.

### 7. `freq-table.js` — ID auf `implTonePopupRow` umstellen

Z. 17: das Array

```js
const ids = ["freqDeactHintEl","freqAbfHintEl","freqExclHintEl","sweepRow"];
```

ersetzen durch:

```js
const ids = ["freqDeactHintEl","freqAbfHintEl","freqExclHintEl","implTonePopupRow"];
```

Z. 323–324:

```js
const sweepRowEl = document.getElementById("sweepRow");
if (sweepRowEl) sweepRowEl.style.display = "flex";
```

ersetzen durch:

```js
const implTpRow = document.getElementById("implTonePopupRow");
if (implTpRow) implTpRow.style.display = "";
```

(Der neue Container hat kein Flex-Layout — `display: ""` reicht für die
Default-Block-Anzeige.)

Außerdem **vor** dem `implTpRow`-Ein-/Ausblenden den Knopf-Label
einmal aktualisieren, damit die Tonart-Beschriftung sofort stimmt:

```js
if (typeof _implTonePopupUpdLabel === "function") _implTonePopupUpdLabel();
```

(Direkt vor der `if (implTpRow)`-Zeile.)

### 8. i18n-Keys — `i18n/de.js`

Nach `tonePopupSweepStart` (aus BA 241) zwei weitere Keys einfügen:

```js
    implTonePopupBtn:     "Elektroden über Töne anspielen",
    tonePopupHintImplant: "Die Tonart Sinus eignet sich am Besten, um problematische Elektroden zu erkennen. Beispielsweise, ob und wie stark sie rauschen.",
```

ASCII-`"` als String-Begrenzer.

### 9. Persistenz: Reset — `js/file.js`

Im Reset-Block (Z. 55–65) die Zeilen `document.getElementById("vol1")…`,
`dur1`, `pau1`, `corrToggle` ersatzlos entfernen (Elemente existieren
nicht mehr).

Nach dem BA-240-Block der `volume_freqmatch`/`duration_freqmatch`/
`pause_freqmatch`-Defaults ergänzen:

```js
  if (typeof toneType_implant !== "undefined") toneType_implant = "sine";
  if (typeof volume_implant   !== "undefined") volume_implant   = 75;
  if (typeof duration_implant !== "undefined") duration_implant = 1000;
  if (typeof pause_implant    !== "undefined") pause_implant    = 500;
```

### 10. Persistenz: Speichern — `js/file.js`

Im Speichern-Block (nach `pause_freqmatch` aus BA 240) ergänzen:

```js
    toneType_implant:   (typeof toneType_implant !== "undefined") ? toneType_implant : "sine",
    volume_implant:     (typeof volume_implant   !== "undefined") ? volume_implant   : 75,
    duration_implant:   (typeof duration_implant !== "undefined") ? duration_implant : 1000,
    pause_implant:      (typeof pause_implant    !== "undefined") ? pause_implant    : 500,
```

### 11. Persistenz: Laden — `js/file.js`

Nach dem BA-240-Block der `volume_freqmatch`/`duration_freqmatch`/
`pause_freqmatch`-Restore ergänzen:

```js
  // BA 242: Implantat-State aus JSON zuruecklesen.
  if (typeof toneType_implant !== "undefined") {
    toneType_implant = isValidToneType(d.toneType_implant) ? d.toneType_implant : "sine";
  }
  if (typeof volume_implant !== "undefined") {
    var svi = parseInt(d.volume_implant, 10);
    volume_implant = (isFinite(svi) && svi >= 0 && svi <= 100) ? svi : 75;
  }
  if (typeof duration_implant !== "undefined") {
    var sdi = parseInt(d.duration_implant, 10);
    duration_implant = (isFinite(sdi) && sdi >= 100 && sdi <= 3000) ? sdi : 1000;
  }
  if (typeof pause_implant !== "undefined") {
    var spi = parseInt(d.pause_implant, 10);
    pause_implant = (isFinite(spi) && spi >= 50 && spi <= 2000) ? spi : 500;
  }
```

### 12. i18n-Initialisierung — `js/i18n.js`

Die Z. 87 `s("lblCorr", "lblCorr");` entfernen (Element `#lblCorr`
gehört zu `corrToggle` und existiert nicht mehr). Andere
Default-Bindings unverändert lassen.

## Akzeptanztest

Nach dem Build im Browser:

1. **Hard-Reload**, Version `3.2.242-beta`.
2. **Tab Implantat & Elektroden** öffnen: Konfiguration auf CI mit
   bekanntem Hersteller (z. B. MED-EL) gesetzt — Tabelle wird
   gerendert.
   - **Kein** alter Sweep-/Stop-Block mehr sichtbar, keine
     vol1/dur1/pau1-Eingaben, keine Korrektur-Checkbox.
   - Stattdessen ein einzelner Knopf direkt unter der Tabelle:
     **„Elektroden über Töne anspielen — CI-Test flach"** (Default-
     Tonart heißt Sinus laut Konzept — Sonnet prüft, ob der Default
     beim ersten Reset tatsächlich „Sinus" anzeigt, oder ob ein
     gespeicherter Wert übersteuert).
3. **Knopf klicken** → Modal öffnet sich. Erwartet:
   - Hint-Box mit dem neuen Implantat-Hinweis-Text
     („Die Tonart Sinus eignet sich am Besten…").
   - Korrektur-Toggles (Default grün-aktiv).
   - Vol/Dur/Pau (75 % / 1000 ms / 500 ms beim ersten Öffnen).
   - Klavier-Widget mit so vielen Tasten, wie aktive Elektroden auf
     der activeSide bekannt sind, plus durchgestrichene Tasten für
     deaktivierte/ausgeschlossene.
   - **Sweep-Knopf** „Sweep starten".
   - Tonart-Gruppen, Default-Tonart **Sinus** ist markiert.
4. **Deaktivierte Elektrode prüfen**: in der Tabelle eine Elektrode
   per Aktiv-Checkbox abhaken → Modal erneut öffnen → die zugehörige
   weiße Taste ist ausgegraut und mit X durchgestrichen, nicht
   klickbar. Die benachbarten schwarzen Tasten sind durch einen
   schmalen Balken verbunden und spielen das Mittel der nächsten
   aktiven Elektroden.
5. **Zwei deaktivierte in Folge**: nochmal eine angrenzende
   Elektrode deaktivieren → Modal erneut öffnen → drei schwarze
   Tasten sind über einen längeren Balken verbunden, alle spielen
   denselben Ton (Mittel der beiden äußeren aktiven Nachbarn). Auf-
   leuchten beim Anschlag: alle drei + Balken + die zwei Anker-
   weiße Tasten.
6. **Reset der Aktivierungen** für den Rest der Tests.
7. **Sweep-Knopf klicken** → spielt nacheinander alle aktiven
   Elektroden apikal→basal auf der activeSide. Knopf bleibt
   blau-aktiv hervorgehoben. Klaviertasten leuchten in der Reihe
   auf. Endet automatisch nach der letzten Elektrode, Knopf wird
   wieder normal.
8. **Sweep abbrechen**: Sweep starten, mitten im Lauf nochmal auf
   den blauen Knopf klicken → Sweep stoppt sofort, kein weiterer
   Ton, Knopf zurück in Ausgangszustand.
9. **Tonart wechseln während Sweep**: Sweep starten, eine andere
   Tonart in der Modal klicken → Sweep stoppt, Vorspiel der neuen
   Tonart läuft kurz.
10. **Manueller Klaviertasten-Anschlag während Sweep**: läuft
    parallel, kein Stop des Sweeps (Überlagerung erlaubt).
11. **Klavier Hold-Modus**: Klaviertaste drücken und halten → Ton
    spielt. Loslassen → Ton hört auf. Bei BA 242 wird der Ton nach
    5 Sekunden ohnehin von selbst beendet (dokumentierte
    Zwischenlücke, BA 243 behebt sie).
12. **Modal mit Cancel schließen während Sweep**: Sweep startet,
    Cancel-Klick → Modal zu, Sweep gestoppt, kein Audio-Rest.
13. **Modal mit OK schließen**: Tonart-Wahl in der Modal ändern,
    OK klicken → Knopf-Label im Tab zeigt die neue Tonart.
14. **Konfiguration auf „Keine Angabe"** stellen → der Knopf-Container
    `#implTonePopupRow` ist ausgeblendet (analog dem früheren
    `sweepRow`-Verhalten).
15. **Speichern / Reset / Laden**: JSON enthält `toneType_implant`,
    `volume_implant`, `duration_implant`, `pause_implant`. Reset →
    Werte zurück auf `sine` / 75 / 1000 / 500. Laden → Werte wieder
    da.
16. **Tab Messungen → Frequenzabgleich** unverändert (BA 240/241
    funktionieren weiter).
17. **Konsole prüfen**: kein `ReferenceError` zu `sweepBtn`, `stopBtn`,
    `playSweep`, `sweepAct`, `corrToggle`, `vol1`, `dur1`, `pau1`,
    `lblCorr`.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

- Akzeptanzpunkte 1–17 einzeln durchgehen, je Punkt erfüllt /
  nicht erfüllt / unklar mit Datei/Zeilen-Verweis.
- Konsolen-Fehler-Check nach Hard-Reload, Tab-Wechsel, Modal-Öffnen,
  Sweep-Lauf, Speichern, Laden, Reset.
- Insbesondere prüfen:
  - `index.html`: keine `id="sweepRow|sweepBtn|stopBtn|vol1|dur1|pau1|corrToggle|lblCorr"` mehr vorhanden (grep über die Datei).
  - `js/audio.js`: `playSweep`, `sweepAct` entfernt; `playSingle`,
    `playHold`, `toggleHold`, `corrG` sind weiterhin definiert
    (werden in BA 243 entfernt).
  - `js/init.js`: keine Listener mehr für die alten Knöpfe.
  - `js/file.js`: Reset-Block enthält keine `getElementById("vol1")` etc.
  - `js/state-side.js`: `sweepAct` ist nicht mehr deklariert.
  - `_implTpCorrectVol` und `_implTpModalTone` werden in der
    `onPress`-Funktion korrekt gelesen.
  - `getDisabledElectrodes` wird beim Modal-Öffnen aufgerufen und
    der Klavier-Render zeigt die X-Durchstreichung.
- Bei `unklar`: Bau pausieren, Rückfrage.

## Hinweise für spätere Folge-BA

- EN/FR/ES-Übersetzungen für `implTonePopupBtn` und
  `tonePopupHintImplant` als Mini-BA, wenn der Nutzer anordnet.
- BA 243 entfernt die Play/Hold-Spalten aus der `freq-table` und
  räumt `playSingle`, `playHold`, `toggleHold`, `corrG` aus
  `audio.js`. Mit BA 243 wird auch der Hold-Modus im Klavier richtig
  dauerhaft, weil der dann zu schreibende neue Hold-Spieler die
  Modal-Tonart respektiert.
