# BAUANLEITUNG 296 — Tonauswahl-Modalbox reduzieren, Rest nur im Debug

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'`.**

## Ziel

Die Modalbox „Tonart wählen" (Modul `js/tone-popup.js`, geöffnet aus
Frequenzabgleich, Elektrodenlautstärke, Stereo-Balance und dem
Implantat-Reiter) wird im Normalbetrieb drastisch reduziert. Die
experimentellen Teile werden **nicht gelöscht**, sondern nur dann
gerendert, wenn der Debug-Modus aktiv ist (`window.dbg.isActive()` —
Doppelklick aufs Logo oder `?debug=1`). Der gesamte Code (alle
Tongruppen, der Anstieg/Ausklang-Block) bleibt vollständig erhalten.

Konkret im Normalbetrieb (Debug **aus**):

1. Titel heißt „Einstellungen Testton" (vorher „Tonart wählen").
2. Die gelben Hinweis-Boxen oben werden ausgeblendet.
3. Der Block „Anstieg / Ausklang" wird ausgeblendet.
4. Im **Implantat-Reiter** wird die Zeile Lautstärke/Tondauer/Tonpause
   ausgeblendet (in den drei Mess-Verfahren bleibt sie sichtbar).
5. Die komplette Tonart-Sammlung (alle Ton-Buttons) wird ausgeblendet.
6. Der Default-Ton ist überall Sinus; beim Öffnen ohne Debug wird der
   Ton auf Sinus zurückgesetzt.
7. Bei aktivem Debug-Modus ist alles wieder sichtbar wie bisher.

Es werden **fünf** Dateien angefaßt: `js/tone-popup.js`,
`js/ui-implant.js`, `js/state-side.js`, `i18n/de.js`, `js/version.js`.
Alle Edits sind klein und gehören zusammen — eine einzige BA.

---

## Schritt 1 — `js/tone-popup.js`: Debug-Schalter + Sinus-Zwang

Am Anfang der Funktion `openToneSelectionDialog` (heute Zeile 236 ff.)
einen lokalen Debug-Schalter einführen und den Ton im Normalbetrieb auf
Sinus zwingen.

**Vorher:**

```js
function openToneSelectionDialog(cfg, onChange) {
  var initial = cfg.getToneType();
  var selected = initial;
  var playing = false;
```

**Nachher:**

```js
function openToneSelectionDialog(cfg, onChange) {
  // BA 296: Debug-Schalter. Im Normalbetrieb ist die Box reduziert;
  // der volle Funktionsumfang (Hinweise, Anstieg/Ausklang, Tonart-
  // Sammlung) erscheint nur bei aktivem Debug-Modus.
  var dbgOn = !!(window.dbg && typeof window.dbg.isActive === 'function'
                 && window.dbg.isActive());

  var initial = cfg.getToneType();
  // BA 296: Ohne Debug ist die Tonart-Auswahl ausgeblendet -> Ton wird
  // auf Sinus gezwungen. Ein im Debug oder per Datei gesetzter anderer
  // Ton wird so beim Oeffnen ohne Debug auf Sinus zurueckgesetzt.
  if (!dbgOn && initial !== 'sine') {
    cfg.setToneType('sine');
    if (typeof onChange === 'function') onChange();
    initial = 'sine';
  }
  var selected = initial;
  var playing = false;
```

---

## Schritt 2 — `js/tone-popup.js`: Hinweis-Boxen nur im Debug

Die beiden gelben Hinweis-Boxen (heute Zeile 273 und 283) nur rendern,
wenn Debug aktiv ist. Es werden **nur die beiden `if`-Bedingungen**
ergänzt, der Inhalt der Blöcke bleibt unverändert.

**Vorher:**

```js
  var _tpHasExtraHint = !!cfg.extraHintKey;
  if (cfg.hintKey) {
```

**Nachher:**

```js
  var _tpHasExtraHint = !!cfg.extraHintKey;
  if (dbgOn && cfg.hintKey) {
```

**Vorher** (zweite Box, heute Zeile 283):

```js
  if (cfg.extraHintKey) {
    var extraHint = document.createElement('p');
```

**Nachher:**

```js
  if (dbgOn && cfg.extraHintKey) {
    var extraHint = document.createElement('p');
```

---

## Schritt 3 — `js/tone-popup.js`: Anstieg/Ausklang-Block nur im Debug

Der Block ist eine sofort aufgerufene Funktion `buildToneEnvSection`
(heute Zeile 297, Abschluss `})();` bei Zeile 472). Der Aufruf wird in
`if (dbgOn)` gehängt. **Nur die eine Zeile mit dem Funktionskopf wird
geändert**, der Funktionskörper und das `})();` am Ende bleiben unberührt.

**Vorher** (Zeile 297):

```js
  (function buildToneEnvSection() {
```

**Nachher:**

```js
  if (dbgOn) (function buildToneEnvSection() {
```

> Hinweis für Sonnet: Das ergibt `if (dbgOn) (function buildToneEnvSection(){ ... })();`
> — ein einzelnes konditionales Ausdruck-Statement. Das abschließende
> `})();` bleibt exakt wie es ist. Nicht zusätzlich umklammern.

---

## Schritt 4 — `js/tone-popup.js`: Tonart-Sammlung nur im Debug

Die Schleife `GROUPS.forEach(...)` (heute Zeile 748, Abschluss `});`
bei Zeile 809) baut alle Ton-Buttons. Sie wird in `if (dbgOn)` gehängt.
**Nur die Kopfzeile wird geändert**, der Schleifenkörper und das
abschließende `});` bleiben unberührt.

**Vorher** (Zeile 748):

```js
  // BA 230: Buttons-Reihe statt Radio-Grid.
  GROUPS.forEach(function(grp) {
```

**Nachher:**

```js
  // BA 230: Buttons-Reihe statt Radio-Grid.
  // BA 296: Tonart-Sammlung nur im Debug-Modus.
  if (dbgOn) GROUPS.forEach(function(grp) {
```

> Hinweis für Sonnet: Das ergibt `if (dbgOn) GROUPS.forEach(function(grp){ ... });`.
> Das abschließende `});` der `forEach` bleibt exakt wie es ist.

---

## Schritt 5 — `js/ui-implant.js`: Vol/Dur/Pau nur im Debug

Die Steuerung läuft über die bestehenden API-Flags `showVolume`,
`showDuration`, `showPause` — die Modalbox selbst wird dafür **nicht**
geändert. Nur der Implantat-Aufrufer macht diese Flags vom Debug-Modus
abhängig. In den drei Mess-Verfahren bleiben die Flags unverändert auf
`true`.

In `openImplantTonePopup` (heute Zeile 300 ff.) nach der `activePan`-
Zeile einen lokalen Debug-Schalter einführen.

**Vorher:**

```js
function openImplantTonePopup() {
  if (typeof openToneSelectionDialog !== "function") return;
  var activePan = (activeSide === "left") ? -1 : 1;

  openToneSelectionDialog({
```

**Nachher:**

```js
function openImplantTonePopup() {
  if (typeof openToneSelectionDialog !== "function") return;
  var activePan = (activeSide === "left") ? -1 : 1;
  // BA 296: Vol/Dur/Pau-Zeile nur im Debug-Modus zeigen.
  var _implDbgOn = !!(window.dbg && typeof window.dbg.isActive === 'function'
                      && window.dbg.isActive());

  openToneSelectionDialog({
```

Dann die drei Flags (heute Zeile 313–315) von `true` auf `_implDbgOn`
umstellen.

**Vorher:**

```js
    showVolume:       true,
    showDuration:     true,
    showPause:        true,
```

**Nachher:**

```js
    showVolume:       _implDbgOn,
    showDuration:     _implDbgOn,
    showPause:        _implDbgOn,
```

Die Getter darunter (`getVolumePercent`, `setVolumePercent`, …) bleiben
unverändert stehen.

---

## Schritt 6 — `js/state-side.js`: Default-Ton überall Sinus

In `TEST_DEFAULTS` (heute Zeile 731 ff.) die drei Mess-Verfahren von
`"richCiG"` auf `"sine"` umstellen (Implantat ist bereits `"sine"`) und
den erklärenden Kommentar darüber anpassen.

**Vorher:**

```js
// toneType "richCiG" = CI-Test Grundton (Engine zerlegt rich+CiG).
const TEST_DEFAULTS = {
  commonVolume: 50,                 // BA 287: gemeinsame Lautstaerke aller Tests + Implantat
  freqmatch: { toneType: "richCiG", volume: 75, duration: 750, pause: 400, sequence: "ab" },
  test:      { toneType: "richCiG", volume: 50, duration: 750, pause: 300, sequence: "ab" },
  balance:   { toneType: "richCiG", volume: 75, duration: 750, pause: 400, sequence: "ab" },
  implant:   { toneType: "sine",    volume: 75, duration: 1000, pause: 500 }
};
```

**Nachher:**

```js
// BA 296: Default-Ton fuer alle Verfahren auf "sine" (Sinus). Die
// Tonart-Auswahl ist im Normalbetrieb ausgeblendet und nur im
// Debug-Modus waehlbar.
const TEST_DEFAULTS = {
  commonVolume: 50,                 // BA 287: gemeinsame Lautstaerke aller Tests + Implantat
  freqmatch: { toneType: "sine", volume: 75, duration: 750, pause: 400, sequence: "ab" },
  test:      { toneType: "sine", volume: 50, duration: 750, pause: 300, sequence: "ab" },
  balance:   { toneType: "sine", volume: 75, duration: 750, pause: 400, sequence: "ab" },
  implant:   { toneType: "sine", volume: 75, duration: 1000, pause: 500 }
};
```

Die `let toneType_*`-Zeilen darunter bleiben unverändert — sie lesen
ihre Startwerte aus `TEST_DEFAULTS`.

---

## Schritt 7 — Titel ändern (alle vier Sprachen)

Der Text ist sehr kurz (2 Wörter), deshalb werden EN/FR/ES direkt
mitgezogen. Jeweils der `tonePopupTitle`-Schlüssel (heute Zeile 1069 in
en/fr/es, Zeile 1122 in de).

`i18n/de.js` — **vorher:**

```js
    tonePopupTitle:  "Tonart wählen",
```

**nachher:**

```js
    tonePopupTitle:  "Einstellungen Testton",
```

`i18n/en.js` — **vorher:**

```js
    tonePopupTitle:  "Select tone type",
```

**nachher:**

```js
    tonePopupTitle:  "Test tone settings",
```

`i18n/fr.js` — **vorher:**

```js
    tonePopupTitle:  "Choisir le type de son",
```

**nachher:**

```js
    tonePopupTitle:  "Réglages du son de test",
```

`i18n/es.js` — **vorher:**

```js
    tonePopupTitle:  "Elegir tipo de tono",
```

**nachher:**

```js
    tonePopupTitle:  "Ajustes del tono de prueba",
```

---

## Schritt 8 — `js/version.js`: Versionsbump

**Vorher:**

```js
const APP_VERSION = "0.4.293.1-beta";
```

**Nachher:**

```js
const APP_VERSION = "0.4.296-beta";
```

---

## Schritt 9 — Spec nachziehen

In `docs/spec/02-messung.md` und `docs/spec/03-implantat.md` die
Stellen suchen, die die Tonauswahl-Modalbox bzw. die Tonart beschreiben,
und knapp ergänzen:

- Default-Ton ist jetzt für alle Verfahren Sinus.
- Im Normalbetrieb zeigt die Box nur noch die für das Verfahren nötigen
  Bedienelemente; der volle Umfang (Hinweise, Anstieg/Ausklang,
  Tonart-Sammlung; im Implantat zusätzlich Lautstärke/Tondauer/Tonpause)
  erscheint nur bei aktivem Debug-Modus.

Keine strukturellen Änderungen an `docs/CODESTRUKTUR.md` nötig (keine
neue Datei/Funktion/globale Variable, kein neuer Tab).

---

## Akzeptanztest (Normalbetrieb, Debug AUS)

Vorab sicherstellen, daß der Debug-Modus aus ist (kein `?debug=1` in der
URL; ggf. Doppelklick aufs Logo, bis das Debug-Panel verschwindet).

1. Tab **Messungen → Frequenzabgleich**, den Knopf zum Öffnen der
   Tonauswahl klicken.
   - Titel der Box: **„Einstellungen Testton"**.
   - **Keine** gelbe Hinweis-Box oben.
   - **Kein** Block „Anstieg / Ausklang".
   - **Keine** Tonart-Buttons / Tongruppen.
   - Lautstärke/Tondauer/Tonpause-Zeile **ist** sichtbar.
2. Tab **Messungen → Elektrodenlautstärke**, Tonauswahl öffnen:
   gleiches Bild, Lautstärke/Tondauer/Tonpause-Zeile sichtbar.
3. Tab **Messungen → Stereo-Balance**, Tonauswahl öffnen:
   gleiches Bild, Lautstärke/Tondauer/Tonpause-Zeile sichtbar.
4. Tab **Implantat**, Tonauswahl öffnen:
   - Titel „Einstellungen Testton".
   - Keine Hinweise, kein Anstieg/Ausklang, keine Tonart-Buttons.
   - Lautstärke/Tondauer/Tonpause-Zeile **ausgeblendet**.
   - Klavier und Durchlauf-Knopf weiterhin vorhanden.
5. In einem beliebigen Verfahren einen Ton anspielen (z.B. Klavier im
   Implantat-Reiter, oder Test starten): es klingt ein **Sinuston**.

## Akzeptanztest (Debug AN)

Debug-Modus aktivieren (Doppelklick aufs Logo, Panel erscheint), dann
in einem beliebigen Verfahren die Tonauswahl öffnen:

6. Titel weiterhin „Einstellungen Testton".
7. Gelbe Hinweis-Box(en) **sichtbar**.
8. Block „Anstieg / Ausklang" **sichtbar**.
9. Komplette Tonart-Sammlung (alle Gruppen/Buttons) **sichtbar** und
   wählbar; ein gewählter Ton wird auch gespielt.
10. Im **Implantat-Reiter** ist die Lautstärke/Tondauer/Tonpause-Zeile
    bei Debug AN wieder **sichtbar**.
11. Einen anderen Ton als Sinus wählen, mit OK bestätigen, Box schließen.
    Dann Debug ausschalten und dieselbe Box erneut öffnen: der Ton ist
    wieder auf **Sinus** zurückgesetzt (Auswahl ist ja ausgeblendet).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der 11 Akzeptanz-Kriterien einzeln
durchgehen und je melden: erfüllt / nicht erfüllt / unklar, mit Datei-
und Zeilenangabe der relevanten Stelle. Zusätzlich bestätigen:

- `dbgOn` in `openToneSelectionDialog` wird **vor** `var initial`
  berechnet (sonst greift der Sinus-Zwang nicht).
- Das abschließende `})();` (Schritt 3) und das abschließende `});`
  der `GROUPS.forEach` (Schritt 4) sind unverändert geblieben.
- In `js/tone-popup.js` und `js/ui-implant.js` stehen ausschließlich
  ASCII-Anführungszeichen.

Wenn etwas als unklar markiert wird: Rückfrage statt stiller Annahme.

## i18n-Hinweis

Der geänderte Text ist sehr kurz (1 Schlüssel, 2 Wörter) und liegt
unter der Schwelle von 4 Sätzen / 30 Wörtern, ab der nachgefragt wird.
Deshalb sind die Übersetzungen in `en.js`, `fr.js`, `es.js` in Schritt 7
direkt mit erledigt.
