# BAUANLEITUNG 155 — Test-Voraussetzungs-Sperre + „beide akustisch = Tabelle aus"

**Zieldateien:** `js/state-side.js`, `js/freqmatch.js`, `js/test.js`, `js/lr-balance.js`, `js/freq-table.js`, `js/ui-implant.js`, `index.html`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 154 abgeschlossen. Stand `js/version.js` = `3.0.154-beta`.

**Version:** 3.0.154-beta → **3.0.155-beta**

---

## Kontext

BA 154 hat „Keine Angabe" als Default eingeführt. Diese Anleitung sorgt
dafür, daß Tests, die eine konkret eingerichtete Seite brauchen, nicht
startbar sind, solange die benötigte Seite noch auf „Keine Angabe"
steht (Hörtechnik oder Hersteller). Außerdem wird der Sonderfall „beide
Seiten akustisch (Hörgerät / Normal / Schwerhörig)" sauber abgeschlossen:
in diesem Fall wird die Frequenztabelle ausgeblendet, weil keine CI-
Seite existiert, von der Hz-Werte gespiegelt werden könnten — stattdessen
ein Hinweistext.

**Konkret:**

1. **Hilfsfunktion `isSideUsable(side)`** in `js/state-side.js`:
   liefert `true`, wenn die Seite Tests bedienen kann
   (Hörtechnik gewählt und — falls CI — Hersteller gewählt).
2. **`_fmEvalTestEligibility`** in `js/freqmatch.js`: zusätzliche
   Sperr-Gründe `sideUnknown` und `sideUnknownMfr`.
3. **`startTest()`** in `js/test.js` (Lautstärke-Test): Vorprüfung,
   ob die aktive Seite testbar ist.
4. **LR-Balance-Start** in `js/lr-balance.js`: Vorprüfung, ob beide
   Seiten testbar sind (mindestens eine CI muss dabei sein, weil LR
   die Stereo-Balance über die CI-Seite kalibriert).
5. **Latenz-Test** bleibt frei — er hat keine seitenspezifische
   Voraussetzung.
6. **Beide-akustisch-Fall** in `js/freq-table.js` + `js/ui-implant.js`:
   neue Hinweis-Box „keine CI-Seite konfiguriert", Tabelle leer.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.155-beta";
```

---

## Schritt 2 — Helper `isSideUsable` in `js/state-side.js`

Datei `js/state-side.js`, an passender Stelle (z.B. nach `getFreqSource`
Z. 482), neue Hilfsfunktion ergänzen:

```js
// BA 155: liefert true, wenn eine Seite für Tests bereit ist
function isSideUsable(side) {
  const s = sideData[side];
  if (!s) return false;
  const cfg = s.config || "unknown";
  if (cfg === "unknown") return false;
  if (cfg === "ci" && (!s.manufacturer || s.manufacturer === "unknown")) return false;
  return true; // ci+gewähltem Hersteller, hg, normal, shoh, deaf
}
```

(„deaf" ist hier `true`, weil eine taube Seite zwar selbst keinen Ton
produziert, aber ihre Konfiguration ausdrücklich getroffen wurde. Tests,
die eine taube Seite betreffen, sperren weiter über die bestehenden
`fmBlocked_sideDeaf`-Logik.)

---

## Schritt 3 — `_fmEvalTestEligibility` erweitern

Datei `js/freqmatch.js`, Funktion `_fmEvalTestEligibility` ab Z. 749.

**Vorher:**
```js
function _fmEvalTestEligibility() {
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  if (leftCfg === 'deaf' || rightCfg === 'deaf') {
    return { blocked: true, reason: 'sideDeaf' };
  }
  function isAcoustic(c) { return c === 'normal' || c === 'shoh' || c === 'hg'; }
  if (isAcoustic(leftCfg) && isAcoustic(rightCfg)) {
    return { blocked: true, reason: 'bothAcoustic' };
  }
  return { blocked: false, reason: null };
}
```

**Nachher:**
```js
function _fmEvalTestEligibility() {
  // BA 155: „Keine Angabe" / Hersteller-fehlend
  if (typeof isSideUsable === 'function') {
    if (!isSideUsable('left') || !isSideUsable('right')) {
      return { blocked: true, reason: 'sideUnknown' };
    }
  }
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  if (leftCfg === 'deaf' || rightCfg === 'deaf') {
    return { blocked: true, reason: 'sideDeaf' };
  }
  function isAcoustic(c) { return c === 'normal' || c === 'shoh' || c === 'hg'; }
  if (isAcoustic(leftCfg) && isAcoustic(rightCfg)) {
    return { blocked: true, reason: 'bothAcoustic' };
  }
  return { blocked: false, reason: null };
}
```

(Der neue Block kommt **vor** den existierenden Checks. `isSideUsable`
deckt sowohl „cfg=unknown" als auch „cfg=ci aber mfr=unknown" ab.)

In `i18n/de.js`, neuer Sperr-Begründungs-Text:
```js
  fmBlocked_sideUnknown: "Bitte zuerst Hörtechnik und Hersteller für beide Seiten festlegen.",
```

(Bestehende Keys `fmBlocked_sideDeaf` und `fmBlocked_bothAcoustic`
bleiben unverändert.)

---

## Schritt 4 — Lautstärke-Test Voraussetzung

Datei `js/test.js`, Funktion `startTest()` ab Z. 786. **Am Anfang**
der Funktion (vor jeder anderen Aktion) einfügen:

```js
function startTest() {
  // BA 155
  if (typeof isSideUsable === 'function' && !isSideUsable(activeSide)) {
    alert(t('testBlockedSideUnknown'));
    return;
  }
  // ... bisheriger Inhalt
}
```

In `i18n/de.js`:
```js
  testBlockedSideUnknown: "Bitte Hörtechnik und Hersteller für diese Seite wählen, bevor der Test gestartet wird.",
```

Eine sichtbare Sperre des Start-Knopfes wäre eleganter; sie kommt
später, wenn der Lautstärke-Test einen `_loudRenderBlockedWarning`-
analog zu FreqMatch bekommt. Für BA 155 reicht der alert-Hinweis als
Voraussetzungs-Sperre (Schicht c).

---

## Schritt 5 — LR-Balance Voraussetzung

Datei `js/lr-balance.js`, Z. 773 — Start-Knopf-Listener:

**Vorher:**
```js
lrEls.startBtn.addEventListener('click', function() {
```

**Nachher:**
```js
lrEls.startBtn.addEventListener('click', function() {
  // BA 155: Voraussetzungs-Sperre
  if (typeof isSideUsable === 'function'
      && (!isSideUsable('left') || !isSideUsable('right'))) {
    alert(t('lrBlockedSideUnknown'));
    return;
  }
```

In `i18n/de.js`:
```js
  lrBlockedSideUnknown: "Bitte Hörtechnik (und ggf. Hersteller) für beide Seiten wählen, bevor der Stereo-Balance-Test gestartet wird.",
```

---

## Schritt 6 — „Beide akustisch = Tabelle aus"

### 6a) HTML: neue Hinweis-Box

Datei `index.html`, **direkt nach** der bestehenden Hinweis-Box für
`cfgHintAcousticEl` (Z. 303-308), eine weitere einfügen:

```html
          <!-- Hinweis: beide Seiten akustisch -->
          <div
            id="cfgHintBothAcousticEl"
            class="explain"
            style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"
          ></div>
```

### 6b) `buildImplantCard` zeigt den Hinweis

Datei `js/ui-implant.js`, im Hinweise-Block (nach dem
`cfgHintDeafEl`-Setzen, derzeit ab Z. 75-78), zusätzlichen Block
einfügen:

```js
// BA 155: beide Seiten akustisch
const hintBothAc = document.getElementById("cfgHintBothAcousticEl");
if (hintBothAc) {
  const leftCfg  = sideData.left.config  || "unknown";
  const rightCfg = sideData.right.config || "unknown";
  const isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
  const bothAcoustic = isAc(leftCfg) && isAc(rightCfg);
  hintBothAc.style.display = bothAcoustic ? "" : "none";
  if (bothAcoustic) hintBothAc.textContent = t("cfgHintBothAcoustic");
}
```

In `i18n/de.js`:
```js
  cfgHintBothAcoustic: "Beide Seiten akustisch — keine CI-Seite konfiguriert. Frequenztabelle entfällt, weil kein CI-Frequenzraster vorhanden ist. Die Tests, die ein CI brauchen, sind nicht verfügbar.",
```

### 6c) `buildFreqTable` Tabelle ausblenden

Datei `js/freq-table.js`, am Anfang der Funktion (nach den
„unknown"-Checks aus BA 154) zusätzliche Bedingung einfügen:

```js
// BA 155: beide Seiten akustisch — Tabelle leeren
const leftCfg2  = sideData.left.config  || "unknown";
const rightCfg2 = sideData.right.config || "unknown";
const _isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
if (_isAc(leftCfg2) && _isAc(rightCfg2)) {
  document.getElementById("freqTH").innerHTML = "";
  document.getElementById("freqTB").innerHTML = "";
  return;
}
```

---

## Schritt 7 — Default-Frequenzraster-Dropdown ausblenden

Da bei „beide akustisch" keine Tabelle mehr gerendert wird, soll auch
das `defaultMfrGroup`-Dropdown (Z. 418-431 in `index.html`) entfallen.
In `js/ui-implant.js`, ab Z. 90-99 (`defaultMfrGroup`-Sichtbarkeit
setzen): die Bedingung anpassen.

**Vorher:**
```js
const bothNonCI = (sideData.left.config || "ci") !== "ci"
               && (sideData.right.config || "ci") !== "ci";
dfGroup.style.display = bothNonCI ? "" : "none";
```

**Nachher:**
```js
// BA 155: nicht mehr automatisch bei beide-nicht-CI zeigen —
// der Default-Mfr-Wahl ist im „beide akustisch = Tabelle aus"-
// Konzept kein Bedienelement mehr.
dfGroup.style.display = "none";
```

(Der Default-Mfr-Wert kommt jetzt nicht mehr aus diesem Dropdown,
sondern wird nur bei Datei-Laden gesetzt. Späterer Aufräum: Dropdown
ganz aus HTML entfernen.)

---

## Akzeptanztest

1. **Frische Session.** Version 3.0.155-beta. Beide Seiten „Keine
   Angabe" (aus BA 154).
2. **Reiter „Messungen" → „Lautstärke" öffnen, Start-Knopf
   drücken.** Erwartet: Alert „Bitte Hörtechnik und Hersteller…".
   Test startet nicht.
3. **Reiter „Frequenzabgleich".** Erwartet: Start-Knopf gesperrt,
   Sperr-Hinweis „Bitte zuerst Hörtechnik und Hersteller für beide
   Seiten festlegen."
4. **Reiter „Stereo-Balance".** Start-Knopf drücken: Alert „Bitte
   Hörtechnik … für beide Seiten wählen…".
5. **Latenz-Test.** Start funktioniert (Latenz hat keine
   seitenspezifische Voraussetzung).
6. **Hörtechnik beide Seiten auf „CI" setzen, Hersteller MED-EL
   für beide.** Tests sind jetzt startbar (sofern restliche
   Voraussetzungen erfüllt).
7. **Linke Seite auf „Normal" stellen.** Frequenzabgleich
   weiterhin startbar, Stereo-Balance auch.
8. **Beide Seiten auf „Normal" stellen.** Erwartet: Frequenztabelle
   im Implantat-Reiter wird leer / verschwindet. Stattdessen
   Hinweisbox „Beide Seiten akustisch — keine CI-Seite
   konfiguriert. …" sichtbar.
9. **Frequenzabgleich-Test starten:** gesperrt, Begründung
   „bothAcoustic".
10. **Stereo-Balance starten:** wäre auch nicht sinnvoll. Erwartet:
    der Alert mit „Bitte Hörtechnik wählen" greift hier zwar nicht
    (beide Seiten haben Konfig), aber inhaltlich ist der Test
    leerlaufend. Eine fortgeschrittene Sperre könnte hier ergänzt
    werden — Vorschlag fürs Selbstprüf-Bericht.
11. **Default-Frequenzraster-Dropdown** ist nicht mehr sichtbar.
12. **Tool-Reset.** Beide Seiten zurück auf „Keine Angabe", alle
    Sperren wirksam wie in Schritt 2-4.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 12 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar.

Zusätzlich melden:
- Definiert `js/state-side.js` jetzt eine globale Funktion
  `isSideUsable`?
- Wird `_fmEvalTestEligibility` bei „Keine Angabe" mit dem neuen
  Grund `sideUnknown` zurückkommen, und zeigt das Popup im
  Frequenzabgleich-Reiter den entsprechenden Text?
- Ist der Lautstärke-Test über `alert(t(...))` geblockt, wenn
  die aktive Seite nicht testbar ist?
- Ist der Stereo-Balance-Start mit dem entsprechenden Alert
  geblockt?
- Wird die Frequenztabelle bei beide-akustisch tatsächlich leer
  gerendert und der Hinweistext angezeigt?
- Steht `js/version.js` auf `3.0.155-beta`?
- **Vorschlag**: soll Stereo-Balance bei beide-akustisch auch
  geblockt werden? Mit Begründung im Bericht — Martin entscheidet
  später.

---

## Übersicht der geänderten Dateien

- `js/version.js`
- `js/state-side.js` — `isSideUsable`-Helper
- `js/freqmatch.js` — `_fmEvalTestEligibility` erweitert
- `js/test.js` — `startTest`-Vorprüfung
- `js/lr-balance.js` — Start-Knopf-Vorprüfung
- `js/freq-table.js` — Tabelle leer bei beide-akustisch
- `js/ui-implant.js` — neuer Hinweis + Default-Mfr-Group versteckt
- `index.html` — neue Hinweis-Box
- `i18n/de.js` — vier neue Keys
