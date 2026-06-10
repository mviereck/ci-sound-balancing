# BA 256 — Korrektur-Toggles in den Test-Tonauswahl-Modalboxen ausblenden

## Hintergrund

Die Tonauswahl-Modalbox (`js/tone-popup.js`, BA 209/227, Toggles seit
BA 239) zeigt aktuell in allen Aufrufstellen oben zwei Toggle-Knöpfe:

- „Elektrodenlautstärke anwenden" (`tonePopupApplyMeas`)
- „Stereo-Balance anwenden"     (`tonePopupApplyBalance`)

Beide stehen lokal in der Modal-Instanz, Default „an". Sie wirken auf
Vorhör-Steps, Klavier-Anschlag und Sweep.

Nutzer-Entscheidung: In den vier Tests (Elektrodenlautstärke,
Stereo-Balance, Latenz, Frequenzabgleich) sollen diese zwei Knöpfe
nicht mehr erscheinen — die Korrektur wirkt fix wie bisher („beide an"),
nur die Bedienoberfläche entfällt dort. Im Reiter Implantat
(`ui-implant.js`) bleibt alles, wie es heute ist.

Begründung: in den Tests ist eine pro-Aufruf-Umschaltung der Korrektur
nicht sinnvoll und nur potenziell verwirrend. Nur im Reiter Implantat
hat der Nutzer den Vergleich „mit/ohne Korrektur" als legitimen
Anwendungsfall (Vorher/Nachher anhören).

## Versionsbump (Pflicht, am Anfang)

In `js/version.js` die Konstante setzen:

```js
const APP_VERSION = "3.2.256-beta";
```

## Schritt 1 — Modal-API um `showToggles` erweitern (`js/tone-popup.js`)

Suche in `js/tone-popup.js` den Block, der die zwei Toggle-Knöpfe
erzeugt und ans Dialog-Element hängt. Aktuell etwa bei Z. 246–288,
direkt nach dem Hint-Box-Block (`if (cfg.hintKey) { ... }`) und vor
dem optionalen Vol/Dur/Pau-Block (`if (anyVdpField) { ... }`).

**Vorher** (der gesamte Block):

```js
  // BA 239: Korrektur-Toggles. Stil analog Player-Toggles
  // (siehe js/tabs-eq.js updPlSrcButtons / updBalApplyBtn):
  // grün = aktiv, grau = inaktiv. Beide Default an, lokal.
  var togRow = document.createElement('div');
  togRow.style.cssText =
    'display:flex;gap:8px;margin:0 0 14px 0;flex-wrap:wrap;';

  function _tpUpdToggleStyle(btn, active) {
    if (active) {
      btn.style.background  = 'var(--success)';
      btn.style.color       = '#fff';
      btn.style.borderColor = 'var(--success)';
    } else {
      btn.style.background  = '#e5e7eb';
      btn.style.color       = 'var(--text)';
      btn.style.borderColor = 'var(--border)';
    }
  }

  var togMeas = document.createElement('button');
  togMeas.type = 'button';
  togMeas.className = 'btn btn-sm';
  togMeas.dataset.t = 'tonePopupApplyMeas';
  togMeas.style.cssText = 'font-weight:600;border-radius:6px;';
  togMeas.addEventListener('click', function() {
    applyMeasLevels = !applyMeasLevels;
    _tpUpdToggleStyle(togMeas, applyMeasLevels);
  });
  _tpUpdToggleStyle(togMeas, applyMeasLevels);

  var togBal = document.createElement('button');
  togBal.type = 'button';
  togBal.className = 'btn btn-sm';
  togBal.dataset.t = 'tonePopupApplyBalance';
  togBal.style.cssText = 'font-weight:600;border-radius:6px;';
  togBal.addEventListener('click', function() {
    applyBalance = !applyBalance;
    _tpUpdToggleStyle(togBal, applyBalance);
  });
  _tpUpdToggleStyle(togBal, applyBalance);

  togRow.append(togMeas, togBal);
  dlg.appendChild(togRow);
```

**Nachher** — den kompletten Block in `if (cfg.showToggles !== false) { ... }`
verpacken. Damit fällt im Default-Fall (kein Flag gesetzt) nichts weg,
der Implantat-Tab funktioniert unverändert. In den Tests setzen die
Aufrufer `showToggles: false` (Schritte 2–4).

```js
  // BA 239: Korrektur-Toggles. Stil analog Player-Toggles
  // (siehe js/tabs-eq.js updPlSrcButtons / updBalApplyBtn):
  // grün = aktiv, grau = inaktiv. Beide Default an, lokal.
  //
  // BA 256: In den Test-Aufrufern (Elektrodenlautstärke, Stereo-Balance,
  // Latenz, Frequenzabgleich) wird showToggles: false gesetzt — die
  // Knopfreihe entfällt dann komplett. Die Variablen applyMeasLevels /
  // applyBalance bleiben oben auf true; die Korrekturen wirken weiterhin
  // auf Vorhör-Step, Klavier-Anschlag und Sweep. Im Reiter Implantat
  // (ui-implant.js) bleiben die Knöpfe sichtbar (kein showToggles-Flag
  // gesetzt -> Default true).
  if (cfg.showToggles !== false) {
    var togRow = document.createElement('div');
    togRow.style.cssText =
      'display:flex;gap:8px;margin:0 0 14px 0;flex-wrap:wrap;';

    var _tpUpdToggleStyle = function(btn, active) {
      if (active) {
        btn.style.background  = 'var(--success)';
        btn.style.color       = '#fff';
        btn.style.borderColor = 'var(--success)';
      } else {
        btn.style.background  = '#e5e7eb';
        btn.style.color       = 'var(--text)';
        btn.style.borderColor = 'var(--border)';
      }
    };

    var togMeas = document.createElement('button');
    togMeas.type = 'button';
    togMeas.className = 'btn btn-sm';
    togMeas.dataset.t = 'tonePopupApplyMeas';
    togMeas.style.cssText = 'font-weight:600;border-radius:6px;';
    togMeas.addEventListener('click', function() {
      applyMeasLevels = !applyMeasLevels;
      _tpUpdToggleStyle(togMeas, applyMeasLevels);
    });
    _tpUpdToggleStyle(togMeas, applyMeasLevels);

    var togBal = document.createElement('button');
    togBal.type = 'button';
    togBal.className = 'btn btn-sm';
    togBal.dataset.t = 'tonePopupApplyBalance';
    togBal.style.cssText = 'font-weight:600;border-radius:6px;';
    togBal.addEventListener('click', function() {
      applyBalance = !applyBalance;
      _tpUpdToggleStyle(togBal, applyBalance);
    });
    _tpUpdToggleStyle(togBal, applyBalance);

    togRow.append(togMeas, togBal);
    dlg.appendChild(togRow);
  }
```

Anmerkungen:

- Die ehemalige `function _tpUpdToggleStyle(...)` wird zu einem
  `var _tpUpdToggleStyle = function(...)`. Grund: eine `function`-
  Declaration in einem if-Block hat in non-strict JS engine-abhängig
  unklares Scoping. Mit `var + function-expression` ist das eindeutig
  block-lokal, weil die Funktion ohnehin nur innerhalb des if-Blocks
  aufgerufen wird (`togMeas`/`togBal`-Listener und die zwei
  Initialisierungs-Aufrufe).
- Die zwei Variablen `applyMeasLevels` und `applyBalance` werden in
  diesem Schritt **nicht angefasst**. Sie stehen oben am Funktionsanfang
  (in der heutigen Datei etwa Z. 209–210) auf `true` — das bleibt so,
  damit die Korrektur auch ohne sichtbare Knöpfe wirkt.
- Der Block muss vor dem Vol/Dur/Pau-Block (`if (anyVdpField) { ... }`)
  stehen bleiben, damit die Reihenfolge im Modal unverändert ist
  (Toggles oben, dann Vol/Dur/Pau, dann optional Klavier, dann
  Tonart-Gruppen).

## Schritt 2 — `js/test.js`: `showToggles: false` ergänzen

In `js/test.js` im `tonePopupButton`-Block (aktuell ab Z. 1140) die
Property `showToggles: false` einfügen. Gut platzierbar direkt unter
`hintKey` (falls vorhanden) oder vor den `showVolume`-Properties.

**Vor (Auszug)**:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          // BA 252: Tonart-Merker fuer Klavier-Anschlag im Modal.
          onToneSelected: function(tt) { _testTpModalTone = tt; },
          onModalClose:   function()   { _testTpModalTone = null; _testTpCorrectVol = null; },
          onTogglesReady: function(fn) { _testTpCorrectVol = fn; },
          // BA 250: Lautstaerke/Tondauer/Tonpause als Modalbox-Felder.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
```

**Nach**:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_test; },
          setToneType: function(tt) { toneType_test = tt; },
          // BA 252: Tonart-Merker fuer Klavier-Anschlag im Modal.
          onToneSelected: function(tt) { _testTpModalTone = tt; },
          onModalClose:   function()   { _testTpModalTone = null; _testTpCorrectVol = null; },
          onTogglesReady: function(fn) { _testTpCorrectVol = fn; },
          // BA 256: Korrektur-Toggles in Tests ausgeblendet — Wirkung bleibt aktiv.
          showToggles:  false,
          // BA 250: Lautstaerke/Tondauer/Tonpause als Modalbox-Felder.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
```

## Schritt 3 — `js/lr-balance.js`: `showToggles: false` ergänzen

In `js/lr-balance.js` im `tonePopupButton`-Block (aktuell ab Z. 818)
analog ergänzen — gut platziert direkt nach den drei `on*`-Callbacks
und vor `hintKey`.

**Vor (Auszug)**:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_balance; },
          setToneType: function(tt) { toneType_balance = tt; },
          onToneSelected: function(tt) { _lrTpModalTone = tt; },
          onModalClose:   function()   { _lrTpModalTone = null; _lrTpCorrectVol = null; },
          onTogglesReady: function(fn) { _lrTpCorrectVol = fn; },
          hintKey: 'tonePopupHint',
          showVolume:   true,
```

**Nach**:

```js
        tonePopupButton: {
          getToneType: function()   { return toneType_balance; },
          setToneType: function(tt) { toneType_balance = tt; },
          onToneSelected: function(tt) { _lrTpModalTone = tt; },
          onModalClose:   function()   { _lrTpModalTone = null; _lrTpCorrectVol = null; },
          onTogglesReady: function(fn) { _lrTpCorrectVol = fn; },
          // BA 256: Korrektur-Toggles in Tests ausgeblendet — Wirkung bleibt aktiv.
          showToggles:  false,
          hintKey: 'tonePopupHint',
          showVolume:   true,
```

## Schritt 4 — `js/freqmatch.js`: `showToggles: false` ergänzen

In `js/freqmatch.js` im `tonePopupButton`-Block (aktuell ab Z. 1074)
ebenso.

**Vor (Auszug)**:

```js
        tonePopupButton: {
          getToneType: function() { return toneType_freqmatch; },
          setToneType: function(tt) { toneType_freqmatch = tt; },
          // BA 230: Klavier-Bug-Fix — Modal teilt die aktuell angeklickte
          // Tonart mit; onPress liest fmModalTone mit Fallback auf toneType_freqmatch.
          onToneSelected:  function(tt) { fmModalTone = tt; },
          onModalClose:    function()   { fmModalTone = null; fmKbdCorrectVol = null; },
          onTogglesReady:  function(fn) { fmKbdCorrectVol = fn; },
          // BA 240: Vol/Dur/Pau-Felder in der Modal aktivieren.
          showVolume:   true,
```

**Nach**:

```js
        tonePopupButton: {
          getToneType: function() { return toneType_freqmatch; },
          setToneType: function(tt) { toneType_freqmatch = tt; },
          // BA 230: Klavier-Bug-Fix — Modal teilt die aktuell angeklickte
          // Tonart mit; onPress liest fmModalTone mit Fallback auf toneType_freqmatch.
          onToneSelected:  function(tt) { fmModalTone = tt; },
          onModalClose:    function()   { fmModalTone = null; fmKbdCorrectVol = null; },
          onTogglesReady:  function(fn) { fmKbdCorrectVol = fn; },
          // BA 256: Korrektur-Toggles in Tests ausgeblendet — Wirkung bleibt aktiv.
          showToggles:  false,
          // BA 240: Vol/Dur/Pau-Felder in der Modal aktivieren.
          showVolume:   true,
```

## Schritt 5 — `js/ui-implant.js`: nicht ändern

Keine Anpassung. Der Implantat-Aufruf in `openImplantTonePopup` setzt
kein `showToggles` und erhält damit den Default `true` aus dem Modal —
die zwei Toggle-Knöpfe bleiben dort sichtbar wie heute.

## Schritt 6 — Spec aktualisieren (`docs/spec/02-messung.md`)

In `docs/spec/02-messung.md` den Absatz zu den Korrektur-Toggles
(aktuell etwa Z. 128–151) so erweitern, dass der neue Zustand
festgehalten ist:

Vor dem Satz „Latenz-Anwendung im Modal entfällt …" einen kurzen
Hinweis einschieben — etwa:

```
Sichtbarkeit (seit BA 256): in den vier Test-Modalen
(Elektrodenlautstärke, Stereo-Balance, Latenz, Frequenzabgleich) wird
die Toggle-Reihe nicht mehr gerendert (`showToggles: false` im jeweiligen
`tonePopupButton`-cfg). Die Korrekturen wirken trotzdem — die internen
Variablen `applyMeasLevels` / `applyBalance` stehen weiterhin auf `true`.
Im Reiter Implantat bleibt die Reihe sichtbar (`ui-implant.js` setzt
das Flag nicht).
```

`docs/spec/03-implantat.md` (Z. 23 ff., „Tonauswahl-Knopf") bleibt
unverändert — die Erwähnung der Korrektur-Toggles dort ist weiterhin
korrekt.

## Akzeptanztest (Klick-für-Klick)

1. App neu laden (Cache umgehen — Strg-F5), Versionsanzeige unten zeigt
   `v3.2.256-beta`.
2. Reiter „Implantat" öffnen, Hörsituation = CI, Hersteller = MED-EL
   wählen (falls noch nicht), bis die Elektrodentabelle erscheint.
   Knopf „Elektroden über Töne anspielen — ‹Tonart›" → öffnet die
   Tonauswahl-Modalbox.
   **Erwartet:** Oben zwei grüne Toggle-Knöpfe „Elektrodenlautstärke
   anwenden" und „Stereo-Balance anwenden" sichtbar, wie vorher. Klick
   auf einen schaltet ihn grau, nochmaliger Klick zurück grün. Modal
   schließen.
3. Reiter „Messungen" → Sub-Tab „Elektrodenlautstärke". Im Test-Header
   den Tonart-Knopf klicken → öffnet die Tonauswahl-Modalbox.
   **Erwartet:** Oben **keine** Toggle-Reihe mehr. Direkt unter der
   Hint-Box (falls vorhanden) folgen die Vol/Dur/Pau-Felder. Probehör-
   Knopf an einer Tonart funktioniert.
4. Sub-Tab „Stereo-Balance" → Tonart-Knopf → Tonauswahl-Modalbox.
   **Erwartet:** Keine Toggle-Reihe. Klavier-Widget vorhanden, Tonart-
   Gruppen vorhanden.
5. Sub-Tab „Frequenzabgleich" → Tonart-Knopf.
   **Erwartet:** Keine Toggle-Reihe. Layout wie sonst.
6. Sub-Tab „Latenz" → derzeit kein Tonart-Knopf im Header (Latenz hat
   keine eigene Tonauswahl-Modalbox). Schritt entfällt — Vermerk: bei
   späterer Einführung sollte `showToggles: false` von Anfang an
   gesetzt sein.
7. Funktionsprüfung: in einem der Test-Modale (z.B. Stereo-Balance) auf
   eine Tonart klicken → Vorhör-Sequenz spielt. Klang sollte sich
   gegenüber dem Zustand vor BA 256 nicht hörbar ändern — die
   Korrekturen wirken wie zuvor, nur die Bedienoberfläche entfällt.
8. Konsole prüfen: keine JavaScript-Fehler beim Öffnen einer der vier
   Test-Modalen oder des Implantat-Modals.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Position einzeln durchgehen und
**für jede** melden: erfüllt / nicht erfüllt / unklar, mit Datei- und
Zeilenangabe. Zusätzlich explizit bestätigen:

- `js/tone-popup.js`: Toggle-Block in `if (cfg.showToggles !== false) { ... }`
  gewrappt. `function _tpUpdToggleStyle` durch `var _tpUpdToggleStyle = function`
  ersetzt. Zeile(n) und neuer Bereich angeben.
- `js/test.js`, `js/lr-balance.js`, `js/freqmatch.js`: `showToggles: false`
  ins jeweilige `tonePopupButton`-Objekt eingefügt, exakte Zeile(n) angeben.
- `js/ui-implant.js`: unverändert (bestätigen, dass kein `showToggles`-Flag
  hinzugefügt wurde).
- `js/version.js`: auf `3.2.256-beta` gesetzt.
- `docs/spec/02-messung.md`: Sichtbarkeits-Hinweis ergänzt.

Bei Unklarheit (z.B. wenn der Toggle-Block in `tone-popup.js` strukturell
abweicht von dem hier zitierten Snippet, weil Zwischen-BAs ihn umgebaut
haben): nicht raten, sondern stoppen und Nutzer fragen, ob die Anleitung
angepasst werden soll.

## i18n

Keine UI-Text-Änderungen. `en.js`/`fr.js`/`es.js` werden nicht
angefaßt — die Toggles werden nur ausgeblendet, ihre i18n-Keys bleiben
für den Implantat-Tab nach wie vor in Gebrauch.

## Kein Bau-Diagnose-Test

Reine UI-Sichtbarkeit, Akzeptanzkriterien sind per Auge prüfbar.
