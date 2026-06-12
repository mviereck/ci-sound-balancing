# Bauanleitung 278 — Voreinschätzung folgt der Slider-Bereichserweiterung

**Ziel-Version nach Build:** `0.4.278-beta`
**Betroffene Datei:** `js/test-ui.js` (genau zwei kleine Edits)
**Keine UI-Texte, keine i18n, keine neuen Dateien.**

---

## Hintergrund (was ist kaputt)

Im Reiter **Messungen → Elektrodenlautstärke** wird während eines
Vergleichs über dem Schieber eine **Voreinschätzung** angezeigt: ein
kleines Dreieck mit dB-Wert plus ein helleres Band drumherum
(`fm-range-hint` / `-band` / `-mark` / `-label`, gesetzt über
`testUI.slider.setRangeHint`).

Der Schieber startet mit dem Bereich ±20 dB (`initialRange: 20`) und
wird beim Anschlag stufenweise bis ±60 dB erweitert
(`maxRange: 60`). Die Erweiterung passiert in der generischen Funktion
`_maybeExtendSlider` in `js/test-ui.js`.

**Fehler:** `_maybeExtendSlider` ändert `slRef.input.min`/`max`, läßt
aber die Voreinschätzung **nicht** neu zeichnen. `setRangeHint`
positioniert Dreieck und Band aber **in Prozent des aktuellen
Slider-Bereichs** (`var span = maxV - minV; var markPct = ((marker -
minV) / span) * 100;`). Nach einer Bereichserweiterung stimmen die
alten Prozentwerte nicht mehr. Folgen:

1. **Dreieck wandert nicht mit:** Es behält seine alte Prozentposition
   und zeigt dadurch auf einen falschen dB-Wert.
2. **Voreinschätzung manchmal gar nicht sichtbar:** Liegt der
   Marker außerhalb des engen Anfangsbereichs ±20 dB, blendet
   `setRangeHint` ihn bewußt aus (`if (marker < minV || marker > maxV)
   { hint.style.display = 'none'; return; }`). Beim Aufziehen des
   Bereichs würde er hineinpassen — aber weil nichts ihn neu zeichnet,
   bleibt er unsichtbar.

Beide Symptome haben **dieselbe Wurzel**: Die Bereichserweiterung
stößt keine Neuberechnung der Voreinschätzung an.

---

## Lösungsidee

Die Voreinschätzungs-Logik bleibt vollständig in der testUI-API (kein
Eingriff im Elektrodenlautstärke-Modul, Notausgang-Prinzip):

- `setRangeHint` merkt sich seine zuletzt übergebenen Werte am
  Schieber-Ref (`slRef._rangeHintOpts`).
- `_maybeExtendSlider` ruft nach jeder tatsächlichen Bereichsänderung
  `setRangeHint` mit genau diesen gemerkten Werten erneut auf. Dadurch
  werden Dreieck und Band relativ zum **neuen** Bereich neu
  positioniert; eine zuvor ausgeblendete Voreinschätzung erscheint,
  sobald der Bereich groß genug ist.

---

## Edit 1 — `setRangeHint` merkt sich die letzten Werte

Datei `js/test-ui.js`, Funktion `setRangeHint` (beginnt bei Z. 1493).

**Vorher** (Anfang der Funktion):

```js
    setRangeHint: function(slRef, opts) {
      if (!slRef || !slRef.rangeHint) return;
      var hint = slRef.rangeHint;
```

**Nachher:**

```js
    setRangeHint: function(slRef, opts) {
      if (!slRef || !slRef.rangeHint) return;
      // BA 278: zuletzt uebergebene opts am Schieber-Ref merken, damit
      // _maybeExtendSlider die Voreinschaetzung nach einer Bereichs-
      // erweiterung mit denselben Werten neu positionieren kann.
      slRef._rangeHintOpts = opts || null;
      var hint = slRef.rangeHint;
```

Der Rest der Funktion bleibt unverändert. Wichtig: das Merken passiert
**vor** den ganzen Early-Returns weiter unten (ausblenden bei Marker
außerhalb Bereich usw.) — sonst würde gerade der Bug-2-Fall
(zunächst ausgeblendet) seine Werte nicht behalten.

---

## Edit 2 — `_maybeExtendSlider` zeichnet die Voreinschätzung neu

Datei `js/test-ui.js`, Funktion `_maybeExtendSlider` (Z. 125–136).

**Vorher:**

```js
function _maybeExtendSlider(slRef) {
  if (!slRef || !slRef.initialRange) return;
  var val = parseFloat(slRef.input.value) || 0;
  var curMax = parseFloat(slRef.input.max);
  if (Math.abs(val) < curMax) return;
  if (curMax >= slRef.maxRange) return;
  var newMax = Math.min(curMax + slRef.initialRange, slRef.maxRange);
  slRef.rangeIdx++;
  slRef.input.min = String(-newMax);
  slRef.input.max = String(newMax);
  slRef.input.style.setProperty('--sl-range-step', slRef.rangeIdx);
}
```

**Nachher:**

```js
function _maybeExtendSlider(slRef) {
  if (!slRef || !slRef.initialRange) return;
  var val = parseFloat(slRef.input.value) || 0;
  var curMax = parseFloat(slRef.input.max);
  if (Math.abs(val) < curMax) return;
  if (curMax >= slRef.maxRange) return;
  var newMax = Math.min(curMax + slRef.initialRange, slRef.maxRange);
  slRef.rangeIdx++;
  slRef.input.min = String(-newMax);
  slRef.input.max = String(newMax);
  slRef.input.style.setProperty('--sl-range-step', slRef.rangeIdx);
  // BA 278: Slider-Bereich wurde erweitert -> Voreinschaetzung mit den
  // zuletzt gesetzten Werten neu positionieren. Sonst behaelt das
  // Dreieck/Band seine alte Prozent-Position (falscher dB-Wert), und
  // eine zunaechst ausgeblendete Voreinschaetzung bliebe unsichtbar.
  // setRangeHint ist ein No-op fuer Slider ohne rangeHint-Konfiguration.
  testUI.slider.setRangeHint(slRef, slRef._rangeHintOpts);
}
```

Hinweise:

- `testUI` ist im selben Datei-Scope definiert (`var testUI = {...}`,
  Z. 1295). `_maybeExtendSlider` läuft nur aus Event-Handlern
  (mouseup/touchend/Keyboard-Nudge), also zur Laufzeit — `testUI` ist
  dann längst zugewiesen. Kein Vorwärts-Referenz-Problem.
- Wird `setRangeHint` nie aufgerufen (kein rangeHint), ist
  `slRef._rangeHintOpts` `undefined`; `setRangeHint` bricht über seinen
  `if (!slRef.rangeHint) return;` sofort ab. Unschädlich.
- Wurde die Voreinschätzung zuletzt mit `null` ausgeblendet
  (`_rangeHintOpts === null`), zeichnet der Re-Render sie korrekt
  weiterhin nicht. Genau das gewünschte Verhalten.

---

## Was NICHT angefaßt wird

- Keine Änderung in `js/test.js` (`_testUpdateRangeHint` bleibt wie
  es ist — es liefert die Werte, die jetzt korrekt gecacht werden).
- Keine CSS-Änderung.
- Keine Texte, keine i18n-Dateien.
- Keine SPEC-/CODESTRUKTUR-Änderung nötig (reiner Verhaltens-Bugfix,
  die bestehende Spezifikation der Voreinschätzung bleibt gültig).

---

## Versionsbump (Pflicht)

In `js/version.js`:

```js
const APP_VERSION = "0.4.278-beta";
```

(vorher `"0.4.277.2-beta"`).

---

## Akzeptanztest (Klick für Klick)

Voraussetzung: Reiter **Implantat** ausgefüllt (mind. eine CI-Seite),
sodass es Elektroden zum Vergleichen gibt.

1. Reiter **Messungen → Elektrodenlautstärke** öffnen, Test starten.
2. So weit testen, bis über dem Schieber eine **Voreinschätzung**
   (Dreieck mit dB-Wert + helleres Band) erscheint. Sie erscheint,
   sobald genug Daten für eine Schätzung vorliegen.
3. Schieber **bis an den äußeren Anschlag** ziehen und loslassen.
   → **Erwartet:** Der Wertebereich des Schiebers wird größer, und das
   Dreieck der Voreinschätzung **wandert mit**, sodass es weiterhin auf
   seinen dB-Wert zeigt (nicht stehenbleibt, nicht verspringt).
4. Falls eine Voreinschätzung anfangs **nicht** sichtbar war
   (Schätzwert lag außerhalb ±20 dB): Schieber an den Anschlag ziehen
   und loslassen, ggf. mehrfach.
   → **Erwartet:** Sobald der Bereich groß genug ist, **erscheint** die
   Voreinschätzung an der richtigen Stelle.
5. Gegenprobe: einen Schieber, der **keine** Voreinschätzung hat (z.B.
   in einem anderen Sub-Reiter mit Slider ohne rangeHint), an den
   Anschlag ziehen.
   → **Erwartet:** Bereich erweitert sich normal, keine Fehler in der
   Konsole, keine plötzlich auftauchende Voreinschätzung.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe.
Zusätzlich bestätigen:

- `slRef._rangeHintOpts` wird in `setRangeHint` **vor** allen
  Early-Returns gesetzt (Edit 1).
- Der `setRangeHint`-Re-Render-Aufruf in `_maybeExtendSlider` steht
  **nach** dem Setzen von `input.min`/`max` (Edit 2), nicht davor.
- `APP_VERSION` steht auf `"0.4.278-beta"`.
- Im Code ausschließlich ASCII-Anführungszeichen (`"` und `'`).
