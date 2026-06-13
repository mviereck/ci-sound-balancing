# BAUANLEITUNG 289 — Stereo-Balance: „Slider-Wirkung"-Dropdown entfernen (nur symmetrisch)

**Ziel-Version nach Build:** `0.4.289-beta`
**Berührte Dateien:** `js/lr-balance.js`, `js/state-side.js`, `js/file.js`,
`js/init.js`, `js/print-md.js`, `js/test-ui.js`, `js/version.js`
**Sprache:** nur Deutsch.

---

## Zweck

Im Sub-Tab **Messungen → Stereo-Balance** gibt es im Test-Kopf das
Dropdown **„Slider-Wirkung"** mit **Links / Rechts / Beide**
(`slTarget_balance`, Default „Beide"). Künftig soll der Schieber
**immer symmetrisch** wirken (links leiser / rechts lauter und umgekehrt)
— genau wie beim Elektrodenlautstärke-Test seit BA 283.

Diese BA:
1. reduziert die Pegelberechnung in `lr-balance.js` auf den
   symmetrischen Zweig,
2. entfernt das Dropdown, seinen State, Speichern/Laden und den
   Druck-Eintrag,
3. **räumt den generischen „Slider-Wirkung"-Baustein (`targetSelect`)
   ganz aus `test-ui.js`** — nach dieser BA nutzt ihn **kein** Test mehr
   (Elektrodenlautstärke hat ihn schon in BA 283 verloren; dort blieben
   tote `slTarget_test`-Verweise zurück, die hier mit verschwinden).

**Nicht in dieser BA:** Die Deckelung am Anschlag (Punkt 7 des
Gesamtumbaus) kommt in BA 290 mit der Migration auf die Token-Maschine,
weil sie in die neue `lrSequence()`-Pegelberechnung gehört. Hier bleibt
die symmetrische Berechnung **unverändert** (wie heute der „Beide"-Zweig).

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'`.**

---

## Schritt 1 — `js/lr-balance.js`: Pegellogik auf symmetrisch reduzieren

**1a.** `_lrGetMode()` (Z. 47–49) **ersatzlos entfernen** — wird nach
dieser BA nicht mehr gebraucht.

**1b.** In `lrPlayCurrent()` den Modus-Block (Z. 148–161) ersetzen.

**Vorher:**
```js
  // Apply slider offset depending on mode
  const mode = _lrGetMode();
  let volL, volR;
  if (mode === "right") {
    volL = vol * corrL;
    volR = vol * corrR * dB2G(slOff);
  } else if (mode === "left") {
    volL = vol * corrL * dB2G(slOff);
    volR = vol * corrR;
  } else {
    // 'both': positive = R up / L down
    volL = vol * corrL * dB2G(-slOff / 2);
    volR = vol * corrR * dB2G(slOff / 2);
  }
```

**Nachher:**
```js
  // BA 289: Schieber wirkt immer symmetrisch (Dropdown entfernt).
  // positive = R lauter / L leiser.
  let volL = vol * corrL * dB2G(-slOff / 2);
  let volR = vol * corrR * dB2G(slOff / 2);
```

**1c.** In `lrPlaySimul()` den **identischen** Modus-Block (Z. 208–219)
genauso ersetzen (gleiches Vorher/Nachher wie 1b).

**1d.** Die `sliderTarget`-Konfiguration (Z. 894–898) **ersatzlos
entfernen**:
```js
        sliderTarget: {
          options:  ['left','right','both'],
          stateKey: 'slTarget_balance',
          default:  'both'
        },
```
Die `sequence: { show: true, source: 'global' }`-Zeile davor und
`electrodeSelection` danach **bleiben**.

---

## Schritt 2 — `js/state-side.js`: State entfernen

Z. 782 **entfernen**:
```js
let slTarget_balance = "both";    // "left" | "right" | "both"
```

---

## Schritt 3 — Persistenz aufräumen

**`js/file.js`:**
- Z. 141 (Reset) entfernen: `slTarget_balance = "both";`
- Z. 367 (Datei-Save) entfernen: `slTarget_balance: slTarget_balance,`
- Z. 707 (Datei-Load) entfernen: `if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;`

**`js/init.js`:**
- Z. 828 (Auto-Restore) entfernen: `if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;`
- Z. 1025 (Auto-Save) entfernen: `slTarget_balance: slTarget_balance,`

---

## Schritt 4 — `js/print-md.js`: Druck-Eintrag entfernen

Z. 142 **entfernen**:
```js
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null
```
Achtung Komma: ist dies die **letzte** Property im Objektliteral, muß das
Komma der **vorhergehenden** Zeile sauber bleiben (keine trailing-comma-
Problematik; im Zweifel die vorhergehende Zeile als letzte ohne Komma).

Danach per `grep -n "slTargetBalance" js/` prüfen, ob der Wert irgendwo
**ausgegeben** wird (z.B. in einer Zeile des Markdown-Ausdrucks). Falls
ja, diese Ausgabe-Zeile ebenfalls entfernen.

---

## Schritt 5 — `js/test-ui.js`: „Slider-Wirkung"-Baustein ganz entfernen

Nach dieser BA setzt **kein** Test mehr eine `sliderTarget`-Konfiguration.
Der generische Render-/Listener-Code dafür (samt der toten
`slTarget_test`-Verweise aus BA 283) wird entfernt:

**5a.** Z. 344: `var seqSelect = null, targetSelect = null;`
→ `var seqSelect = null;`

**5b.** Z. 346 **entfernen**:
```js
  var showTarget = hc.sliderTarget && (hc.sliderTarget !== false);
```

**5c.** Z. 347: `showTarget` aus der Bedingung nehmen.
**Vorher:** `if (showSeq || showTarget || hc.tonePopupButton) {`
**Nachher:** `if (showSeq || hc.tonePopupButton) {`

**5d.** Den **gesamten** `if (showTarget) { ... }`-Block (Z. 406 bis zur
schließenden Klammer dieses Blocks, einschließlich `keyMap`,
Options-Schleife, `cg3.append(...)` und ggf. dem optionalen hintKey-Teil
dieses Blocks) **ersatzlos entfernen**. Ende des Blocks ist erreicht,
bevor der nächste eigenständige Abschnitt beginnt — Sonnet identifiziert
die schließende `}` von `if (showTarget) {` und entfernt genau bis
dorthin. (Der Block beginnt bei `if (showTarget) {`, Z. 406.)

**5e.** Z. 443 **entfernen**: `headerRefs.targetSelect = targetSelect;`

**5f.** Den Listener-Block (Z. 1056–1060) **ersatzlos entfernen**:
```js
  if (targetSelect) {
    targetSelect.addEventListener('change', function() {
      if (id === 'test') slTarget_test = targetSelect.value;
      if (id === 'balance') slTarget_balance = targetSelect.value;
    });
  }
```

> **Vorsicht (zentrale Datei):** Dies ist generischer Header-Code für
> **alle** Tests. Nach dem Eingriff müssen die Köpfe von
> Elektrodenlautstärke, Stereo-Balance, Frequenzabgleich **und** Latenz
> weiterhin korrekt rendern (Sequenz-Dropdown, Tonart-Knopf etc. — nur
> die „Slider-Wirkung" fällt weg). Gegencheck:
> `grep -rn "sliderTarget\|slTarget_test\|slTarget_balance\|targetSelect" js/`
> darf danach **keine** Treffer mehr zeigen (außer ggf. im Druck-/i18n-
> Aufräumrest, siehe unten).

---

## Schritt 6 — Version bumpen

In `js/version.js`:
```js
const APP_VERSION = "0.4.289-beta";
```

---

## i18n (optional, nicht zwingend)

Der Schlüssel `targetLbl` („Slider-Wirkung:") und die Options-Keys
`targetA/targetB/targetBalance/targetLeft/targetRight/targetBoth/
targetRef/targetVar` werden nach dieser BA **nirgends** mehr verwendet.
Tote i18n-Keys sind harmlos (sie stören nichts). Sie können in einer
späteren Aufräum-BA entfernt werden — **nicht** zwingend hier. Falls
doch entfernt: vorher per `grep` sicherstellen, daß keiner woanders
referenziert wird.

---

## Akzeptanztest (vom Nutzer durchklickbar)

1. **Dropdown weg:** Messungen → Stereo-Balance → Test-Kopf ansehen.
   **Erwartet:** Kein „Slider-Wirkung"-Dropdown mehr; Tonfolge-Auswahl
   und Tonart-Knopf sind noch da.
2. **Symmetrische Wirkung:** Test starten, Schieber nach rechts.
   **Erwartet:** rechts wird lauter **und** links leiser (nicht nur eine
   Seite). Nach links umgekehrt.
3. **Andere Tests unberührt:** Elektrodenlautstärke, Frequenzabgleich und
   Latenz öffnen — Köpfe rendern normal, keine fehlenden Bedienelemente,
   keine Konsolenfehler.
4. **Profil:** Profil speichern und wieder laden → kein Fehler, Stereo-
   Balance funktioniert.
5. **Seite neu laden:** kein Konsolenfehler (insb. kein „slTarget_balance
   is not defined").
6. **Druck:** Ergebnis drucken/exportieren → kein Fehler; die Zeile
   „Slider-Wirkung" fehlt (falls sie vorher im Ausdruck stand).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen
(erfüllt / nicht erfüllt / unklar, mit Datei-/Zeilenangabe).
Zusätzlich:

- `grep -rn "slTarget_balance\|slTarget_test\|_lrGetMode\|sliderTarget\|targetSelect" js/`
  ausführen und Ergebnis zitieren — es dürfen **keine** Code-Treffer mehr
  übrig sein.
- Bestätigen, daß `lrPlayCurrent` **und** `lrPlaySimul` beide nur noch
  den symmetrischen Pegel berechnen (kein `mode` mehr).
- Bestätigen, daß die Header der anderen Tests (Tonfolge, Tonart-Knopf)
  unverändert rendern.
- In Code-Snippets ausschließlich ASCII-Anführungszeichen `"` und `'`.
