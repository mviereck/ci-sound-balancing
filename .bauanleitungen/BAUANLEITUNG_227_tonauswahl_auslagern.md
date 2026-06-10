# BA 227 — Tonauswahl-Modal als eigenes Modul auslagern

## Ziel

Die Funktion `_openToneTypeDialog` (aktuell in `js/test-ui.js`,
Z. 2310-2655) wird in eine neue eigene Datei `js/tone-popup.js`
verschoben. Damit wird sie auch von anderen Reitern aufrufbar
(spaeter: Implantat-Tab, Levels), ohne dass diese den ganzen
testUI-Kontext brauchen.

**Diese BA aendert kein sichtbares Verhalten** — sie ist ein
reiner Refactor zur Vorbereitung von BA 228 (Klavier-Widget) und
BA 229 (Lautstaerke/Tondauer/Pause in der Modalbox).

Voraussetzung: BA 226 ist abgenommen. Aktuelle Version
3.2.226.5-beta.

Versionsbump: 3.2.227-beta.

## Schritt 1 — Neue Datei `js/tone-popup.js`

Datei neu anlegen. Inhalt: Header-Kommentar + die Funktion
`openToneSelectionDialog`, die wortgleich aus dem aktuellen
`_openToneTypeDialog` uebernommen wird, nur mit neuem Namen.

**Skeleton-Anfang** (Sonnet ergaenzt den Body wortgleich aus
`js/test-ui.js` Z. 2310-2655):

```js
// ============================================================
// TONE-POPUP — Modaler Dialog "Tonart waehlen"
// ============================================================
// Aus js/test-ui.js (BA 209/217/225/226) ausgelagert in BA 227,
// damit die Tonauswahl auch ausserhalb der testUI nutzbar ist
// (geplante Verwendung: Implantat-Tab, spaetere Mess-Verfahren).
//
// Exportiert ins globale Scope:
//   openToneSelectionDialog(cfg, onChange)
//
// cfg-Felder:
//   getToneType()         -> aktueller toneType-String
//   setToneType(tt)       -> uebernimmt neuen toneType
//   getVolume()           -> Vorspiel-Lautstaerke (0..1)
//   getPreviewSequence()  -> Array von {hz,pan,durationMs} oder
//                            {pauseMs}-Steps fuer den Vorspiel-Klick
//
// Modal-Aufbau: GROUPS-Konstante mit allen Tonart-Gruppen (Sinus,
// Komplex, Rich-Profile, Noise, Mellotron). Pro Item ein Radio-
// Button, Label und ein Vorspiel-Knopf rechts mit Sanduhr-Span
// (BA 226: Sanduhr ist 4. Grid-Spalte, eigenstaendig, sichtbar
// per visibility:visible/hidden ohne Layout-Shift).
//
// Interne Helfer (vor `openToneSelectionDialog` definiert,
// als function declarations damit sie ueberall im Modul greifen):
//   _setHourglassFor(toneType, show)   — Sanduhr ein/aus pro Token
//   _playPreview(toneType)             — Vorspiel-Sequenz starten
//   _setPlayButtonsDisabled(flag)      — alle Vorspiel-Knoepfe sperren
//
// Die Helfer haengen aktuell als innere Funktionen in
// _openToneTypeDialog (Closure ueber `dlg`, `playing`, `cfg`).
// Beim Verschieben in tone-popup.js bleiben sie innere Funktionen
// von openToneSelectionDialog — die Closure-Logik bleibt erhalten,
// damit `dlg` und `playing` weiterhin pro Modal-Instanz frisch
// sind.

function openToneSelectionDialog(cfg, onChange) {
  // BODY: wortgleich aus js/test-ui.js Z. 2311 (var GROUPS = [...])
  // bis Z. 2654 (close();}); übernehmen.
  // Keine inhaltlichen Aenderungen, nur die Funktionssignatur und
  // dieser einleitende Kommentar wandern.
}
```

**Wie Sonnet vorgeht**:
1. `js/test-ui.js` Z. 2310 (`function _openToneTypeDialog(cfg, onChange) {`)
   bis Z. 2655 (`}`) — kompletten Funktions-Block kopieren.
2. In `tone-popup.js` einfuegen: Header-Kommentar wie oben, dann
   den Funktions-Block mit umbenannter Signatur
   `function openToneSelectionDialog(cfg, onChange) {`. Body
   wortgleich, Schliess-Klammer wortgleich.
3. Auch die 7 Kommentar-Zeilen darueber (Z. 2304-2309: "BA 209 +
   217: Modal-Dialog 'Tonart waehlen'. ...") mit umziehen — sie
   beschreiben den Dialog und passen jetzt in die neue Datei.

## Schritt 2 — `js/test-ui.js` aufraeumen

In `js/test-ui.js` die Zeilen 2304-2655 (Kommentar-Block + die
gesamte `_openToneTypeDialog`-Funktion) **entfernen**. Genau diese
352 Zeilen.

**Vor Entfernung** (kontrolle): Z. 2304 beginnt mit
`// BA 209 + 217: Modal-Dialog 'Tonart waehlen'.`
Z. 2655 ist die schliessende `}` der Funktion.
Z. 2656 ist eine Leerzeile, danach folgt `// ===== testUI.sideCheck`.

Nach Entfernung folgt der `sideCheck`-IIFE-Block direkt auf den
Code-Block, der vor `_openToneTypeDialog` stand
(`_openElectrodeSelectionDialog`).

## Schritt 3 — Aufruf umbenennen

In `js/test-ui.js` Z. 1018 die einzige Verwendungsstelle anpassen.

**Vorher**:
```js
        _openToneTypeDialog(tpCfg, _tpUpdateLabel);
```

**Nachher**:
```js
        openToneSelectionDialog(tpCfg, _tpUpdateLabel);
```

Achtung: `_toneTypeKey` (Z. 693) **bleibt** in `test-ui.js` —
sie hat nur lokale Verwendung im Header-Label-Aufbau (`_tpUpdateLabel`)
und gehoert zum testUI-Header-Baustein `tonePopupButton`, nicht
zum Modal-Dialog.

## Schritt 4 — Lade-Reihenfolge in `index.html`

In `index.html` (etwa Z. 141) `tone-popup.js` **vor** `test-ui.js`
einfuegen, weil `openToneSelectionDialog` zur Render-Zeit des
`tonePopupButton`-Bausteins schon erreichbar sein muss.

**Vorher** (Z. 141):
```js
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/test-ui.js', 'js/test.js', ...
```

**Nachher**:
```js
        'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/tone-popup.js', 'js/test-ui.js', 'js/test.js', ...
```

(Da `defer` aktiv ist und beide klassische Skripte sind, wuerden
function declarations auch bei umgekehrter Reihenfolge ueberall
verfuegbar sein. Wir setzen die explizite Reihenfolge trotzdem,
weil sie semantisch die richtige Abhaengigkeit ausdrueckt.)

## Schritt 5 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.227-beta";
```

## Schritt 6 — `docs/CODESTRUKTUR.md`

Neuen Eintrag in der `js/`-Tabelle einfuegen, sinnvoll direkt vor
oder nach `test-ui.js` (Eintrag 7). Vorschlag als `7a`:

```
| 7a | tone-popup.js | Modaler Tonart-Auswahl-Dialog (`openToneSelectionDialog(cfg, onChange)`), aus `test-ui.js` ausgelagert in BA 227. Enthaelt die GROUPS-Konstante mit allen Tonart-Gruppen (Sinus, Komplex, Rich-Profile, Noise, Mellotron-Sampler), interne Helfer `_setHourglassFor`, `_playPreview`, `_setPlayButtonsDisabled`. Sanduhr-Visualisierung beim smplr-Sampler-Laden (BA 226) mit eigenstaendigem Span in 4. Grid-Spalte, visibility-Toggle ohne Layout-Shift. Aktuell nur von `test-ui.js` Z. 1018 aus dem `tonePopupButton`-Header-Baustein aufgerufen; vorbereitet fuer kuenftige Aufrufer (Implantat-Tab, Mess-Verfahren). (BA 227) |
```

Im bestehenden `test-ui.js`-Eintrag (Z. 146 der CODESTRUKTUR) am
Ende ergaenzen:

```
**Seit BA 227**: `_openToneTypeDialog` und Vorspiel-Helfer ausgelagert nach `js/tone-popup.js` (jetzt `openToneSelectionDialog`); `_toneTypeKey` und `tonePopupButton`-Header-Baustein bleiben in `test-ui.js`. Aufruf-Stelle (Z. 1018) verwendet die neue Funktion.
```

## Schritt 7 — `docs/spec/02-messung.md` unveraendert

Diese BA aendert kein Verhalten — die Modalbox sieht identisch
aus und verhaelt sich identisch. SPEC-Update entfaellt.

## Akzeptanztest (Nutzer)

Setup: Tool hart neu laden (Strg+Shift+R).

1. Versionslabel zeigt `3.2.227-beta`.
2. Tab Messungen -> Frequenzabgleich -> Tonart-Button anklicken
   -> Modalbox oeffnet sich wie vorher.
3. Alle bisherigen Modal-Funktionen unveraendert:
   - 5 Gruppen sichtbar (Sinus, Komplex, Rich, Noise, Mellotron).
   - Radio-Auswahl funktioniert.
   - Vorspiel-Knopf funktioniert (Sequenz hoerbar).
   - Sanduhr bei smplr-Tonart noch-nicht-geladen funktioniert wie BA 226.
   - OK uebernimmt die Auswahl, Abbrechen verwirft.
4. Sprachwechsel waehrend Modalbox offen: Texte folgen weiter
   (`applyLang`-Aufrufe in der ausgelagerten Funktion greifen).
5. **Console-Test**: `typeof openToneSelectionDialog` -> `"function"`.
   `typeof _openToneTypeDialog` -> `"undefined"` (alte Funktion weg).
6. **Console-Test**: in `js/test-ui.js` darf kein Aufruf von
   `_openToneTypeDialog` mehr stehen. Pruefbar via
   `grep _openToneTypeDialog js/test-ui.js` -> sollte 0 Treffer
   liefern.
7. Andere Verfahren (Frequenzabgleich Slider/Adaptiv/Vortest,
   Latenz, Stereo-Balance, LR-Balance) unveraendert lauffaehig.

## Selbstprueffungs-Auftrag an Sonnet

VOR der Fertig-Meldung jede Akzeptanz-Kriterie 1-7 einzeln
berichten (erfuellt / nicht erfuellt / unklar mit Datei- und
Zeilenangabe).

Zusatz-Pruefungen:
- `js/version.js` enthaelt `"3.2.227-beta"`. Zeile nennen.
- `js/tone-popup.js` existiert und beginnt mit dem Header-
  Kommentar plus `function openToneSelectionDialog(cfg, onChange) {`.
  Datei-Groesse: erwartet ca. 350-380 Zeilen (Body wortgleich aus
  test-ui.js plus Header).
- `js/test-ui.js` hat um ~352 Zeilen weniger als vor BA 227.
  `_openToneTypeDialog` kommt im Datei-Inhalt NICHT mehr vor.
- `js/test-ui.js` Aufruf in Z. ~1018 lautet jetzt
  `openToneSelectionDialog(tpCfg, _tpUpdateLabel);`. Zeile nennen.
- `index.html` Z. ~141 enthaelt `'js/tone-popup.js',` direkt vor
  `'js/test-ui.js',`. Zeile nennen.
- `docs/CODESTRUKTUR.md` enthaelt neuen Eintrag `7a` fuer
  `tone-popup.js` und die Ergaenzung am Ende des `test-ui.js`-
  Eintrags. Beide Zeilen nennen.
- **Wortgleich-Check**: `diff` zwischen dem ehemaligen
  `_openToneTypeDialog`-Body (aus git history,
  `git show HEAD:js/test-ui.js | sed -n '2311,2654p'`) und dem
  neuen Body in `tone-popup.js` (gleicher Zeilenbereich nach
  Funktionsdeklaration) muss leer sein. Bei Sonnet's eigenen
  i18n-Korrekturen etc. waere dieser Refactor unsauber. Falls
  Diff nicht leer: STOP und beim Nutzer rueckfragen.

Bei "unklar" oder "nicht erfuellt": STOP und beim Nutzer
rueckfragen.

## Nach Abschluss manuell pruefen (Zwischenpruefung)

- Versionslabel `3.2.227-beta`.
- Modal verhaelt sich identisch zu 3.2.226.5-beta (kein sichtbarer
  Unterschied).
- Konsole zeigt keine Fehler beim Tool-Start.
- Anschliessend kann BA 228 (Klavier-Widget) starten.

## i18n

Diese BA aendert keine UI-Texte. Keine Aenderungen an `i18n/*.js`.
