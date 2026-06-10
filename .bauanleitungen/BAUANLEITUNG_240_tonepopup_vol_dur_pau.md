# BA 240: Tonauswahl-Modal mit Lautstärke/Tondauer/Tonpause + konfigurierbarer Hint

## Ziel

Erster Schritt einer vierteiligen Umstellung (BA 240–243). Die
Tonauswahl-Modalbox (`js/tone-popup.js`, `openToneSelectionDialog`)
wird zur zentralen Stelle für **Lautstärke / Tondauer / Tonpause**
in den Test-Verfahren. Der Hint-Text wird pro Aufrufer konfigurierbar.
Sanduhr-Anzeige und der smplr-Lade-Branch entfallen (smplr-UI wurde in
3.2.239.2 entfernt; der dazugehörige Vorspiel-Code ist toter Ballast).

Konkret:

1. **Drei neue Eingabefelder** Vol/Dur/Pau in der Modalbox, jeweils
   pro Aufrufer ein/ausschaltbar via cfg-Flags. Werte werden live
   über cfg-Setter zurückgeschrieben (kein OK-Bestätigen für Vol/Dur/Pau).
2. **Hint-Box** konfigurierbar via `cfg.hintKey`. Ohne Key keine Box.
3. **Sanduhr-Konzept raus**: `_setHourglassFor`, Sanduhr-Spans pro
   Tonart-Button, smplr-Lade-Branch in `_playPreview` entfallen.
4. **Freqmatch migriert** als erster Verbraucher: testUI-Header
   verliert die drei Vol/Dur/Pau-Felder, neue State-Variablen in
   `state-side.js`, fmGVol/Dur/Pau lesen jetzt aus diesen Variablen.
   Persistenz in `file.js`/`init.js` ergänzt.
5. **Default-Lautstärke 75** überall (Modal-State, testUI-Header-
   Default, Latenz, alter `sweepRow` im Implantat-Tab — letzterer
   fällt in BA 242 ohnehin weg, der Default wird trotzdem
   konsistent angehoben).

i18n: nur Deutsch. EN/FR/ES-Übersetzung der drei neuen Labels
(`tonePopupVolume`, `tonePopupDuration`, `tonePopupPause`) als
spätere Folge-Mini-BA, wenn der Nutzer es anordnet. Fehlende
Keys fallen auf Deutsch zurück.

**Test Elektrodenlautstärke / Stereo-Balance** sind nicht betroffen
— sie laufen weiter auf der alten testUI-API (`_buildTestPanelOld`)
mit eigenem Header. Spätere Migration ist nicht Teil dieser BA-Serie.

## Codestand (zur Orientierung)

- `js/tone-popup.js`: `openToneSelectionDialog(cfg, onChange)`. cfg-
  Felder heute: `getToneType/setToneType`, `getVolume`,
  `getPreviewSequence`, `onToneSelected/onModalClose/onTogglesReady`,
  `keyboardMode`, `getElectrodeFreqs/Labels`, `getCurrentToneType`,
  `onPress/onRelease/getHighlightMs`. Hint-Text wird in Z. 231–237
  fest gerendert (`hint.dataset.t = 'tonePopupHint'`).
- Sanduhr-Logik: `_setHourglassFor` (Z. 464–473), Sanduhr-Spans pro
  Tonart-Button (Z. 369–376), smplr-Lade-Branch in `_playPreview`
  (Z. 485–510).
- `js/test-ui.js` Z. 877–928: testUI-Header rendert Vol/Dur/Pau-
  Felder, gesteuert über `hc.volume / hc.duration / hc.pause`
  (`hc` = `cfg.header.common`). Bei `volume: false` etc. werden die
  Felder weggelassen — diese Mechanik wird gebraucht.
- `js/freqmatch.js`: `fmGVol/Dur/Pau` (Z. 190–198) lesen aus
  `fmEls.header.volInput/durInput/pauseInput`. fmSetVerfahren
  (Z. 970–992) stasht/restored Dur/Pau pro Slider-Verfahren.
- `js/state-side.js:698`: `let toneType_freqmatch = "richCiHF";` —
  Muster für eine globale Verfahrens-State-Variable.
- `js/file.js`: Reset-Block Z. 55–65 und Speichern Z. 283–285 /
  Laden Z. 593–605. `js/init.js:776–778` ebenfalls Lade-Pfad.
- `js/latency.js:27`: `let latVolume = 50;` — Default wird auf 75
  angehoben.

## Schritte

### 1. Version bumpen — `js/version.js`

```js
const APP_VERSION = "3.2.240-beta";
```

### 2. Neue State-Variablen — `js/state-side.js`

Direkt unter dem bestehenden `let toneType_freqmatch = "richCiHF";`
(Z. 698) drei neue Zeilen einfügen:

```js
// BA 240: Vol/Dur/Pau leben jetzt als State-Variablen statt im testUI-Header.
// Vol als int 0..100 (UI-Wert); fmGVol macht die quadratische Audio-Konversion.
let volume_freqmatch   = 75;
let duration_freqmatch = 750;
let pause_freqmatch    = 400;
```

### 3. fmGVol/Dur/Pau auf State umstellen — `js/freqmatch.js`

Z. 190–198 ersetzen:

```js
function fmGVol() {
  return Math.pow(volume_freqmatch / 100, 2);
}
function fmGDur() {
  return duration_freqmatch || 750;
}
function fmGPau() {
  return pause_freqmatch || 400;
}
```

### 4. fmSetVerfahren auf State umstellen — `js/freqmatch.js`

Z. 980–989 ersetzen (Inputs gibt es nicht mehr; Stash/Restore arbeitet
direkt auf den State-Variablen):

```js
  // BA 240: Dur/Pau-Stash arbeitet jetzt auf State-Variablen statt DOM-Inputs.
  if (oldVerfahren === 'slider') {
    _fmDurStash_slider = duration_freqmatch || 400;
    _fmPauStash_slider = pause_freqmatch    || 400;
  }
  if (newVerfahren === 'slider') {
    duration_freqmatch = _fmDurStash_slider;
    pause_freqmatch    = _fmPauStash_slider;
    if (fmEls && fmEls.header && typeof fmEls.header.tonePopupUpdate === 'function') {
      // Modal-Knopf-Label hängt nicht vom Stash ab, aber falls eine
      // offene Modalbox-Instanz die alten Felder zeigt, refreshen.
    }
  }
```

(Den `tonePopupUpdate`-Block mit dem Refresh-Hinweis nur als Kommentar
beibehalten — die Modal ist beim Verfahrenswechsel praktisch nie offen,
ein DOM-Sync ist nicht nötig.)

### 5. Freqmatch-Header: Vol/Dur/Pau abschalten — `js/freqmatch.js`

In `fmCfg.header.common` (Z. 1067–1069) die drei Felder explizit auf
`false` setzen — testUI rendert sie dann nicht mehr:

```js
      common: {
        refSelect:    { type: 'side', key: 'fmLblRef', includeSymmetric: true },
        // BA 240: Vol/Dur/Pau leben jetzt im Tonauswahl-Modal, nicht mehr im Header.
        volume:       false,
        duration:     false,
        pause:        false,
        // BA 209: Tonart-Dropdown durch tonePopupButton ersetzt.
        toneType:     false,
        tonePopupButton: {
```

### 6. tonePopupButton-cfg um Vol/Dur/Pau erweitern — `js/freqmatch.js`

Im `tonePopupButton`-Block (Z. 1072 ff.) hinter `getToneType` /
`setToneType` neue cfg-Felder eintragen. Konkret nach Z. 1078
(`onModalClose: function() { ... }`) ergänzen:

```js
          // BA 240: Vol/Dur/Pau-Felder in der Modal aktivieren.
          showVolume:   true,
          showDuration: true,
          showPause:    true,
          getVolumePercent: function() { return volume_freqmatch; },
          setVolumePercent: function(v) { volume_freqmatch = v; },
          getDurationMs:    function() { return duration_freqmatch; },
          setDurationMs:    function(v) { duration_freqmatch = v; },
          getPauseMs:       function() { return pause_freqmatch; },
          setPauseMs:       function(v) { pause_freqmatch = v; },
          // BA 240: Hint-Text fuer Test-Verfahren.
          hintKey: 'tonePopupHint',
```

`getVolume` bleibt unverändert (liefert den Audio-Wert für die Vorspiel-
Sequenzen). `keyboardMode`, `getElectrodeFreqs/Labels`, `onPress`,
`onTogglesReady` etc. bleiben wie heute.

### 7. tone-popup.js — Hint konfigurierbar, Sanduhr raus, Vol/Dur/Pau-Felder rein

Diese Datei wird an mehreren Stellen geändert. Vollständige Schritte:

**7a) Hint-Box konfigurierbar — Z. 231–237 ersetzen:**

```js
  // BA 240: Hint-Box optional und reiterspezifisch.
  // cfg.hintKey = i18n-Key fuer den Text. Ohne Key keine Box.
  if (cfg.hintKey) {
    var hint = document.createElement('p');
    hint.dataset.t = cfg.hintKey;
    hint.style.cssText =
      'margin:0 0 14px 0;font-size:.92em;line-height:1.35;' +
      'background:#fff4d6;border-left:3px solid #d8a200;' +
      'padding:8px 10px;border-radius:4px;';
    dlg.appendChild(hint);
  }
```

**7b) Sanduhr-Spans aus den Tonart-Buttons entfernen — Z. 369–377 entfernen:**

Den ganzen Block

```js
      var hgSpan = document.createElement('span');
      hgSpan.className = 'btn-hourglass';
      hgSpan.dataset.toneKey = key;
      hgSpan.style.cssText =
        'visibility:hidden;font-size:1.4em;line-height:1;'
        + 'color:#d8a200;margin-left:2px;display:inline-block;'
        + 'width:1.1em;text-align:center;vertical-align:middle;';
      hgSpan.textContent = '⧖';
```

ersatzlos streichen. Im darauf folgenden `itemWrap.append(btn, hgSpan);`
(Z. 388) das `hgSpan`-Argument entfernen:

```js
      itemWrap.append(btn);
```

**7c) `_setHourglassFor` komplett entfernen — Z. 463–473.**

Den ganzen Funktionsblock von `// BA 226: Sanduhr ein-/ausblenden …` bis
zur schließenden `}` der Funktion `_setHourglassFor` löschen.

**7d) smplr-Lade-Branch in `_playPreview` entfernen — Z. 484–510:**

Den Block ab Kommentar `// BA 226: Bei smplr-Tonart, die noch nicht geladen ist …`
bis zur schließenden `}` vor `var vol = (typeof cfg.getVolume === 'function') ?`
ersatzlos streichen. `_playPreview` startet damit direkt mit dem
`var vol = ...`-Block.

**7e) Vol/Dur/Pau-Eingabefelder in der Modal — neue Zeile direkt nach
der Toggle-Reihe (Z. ~281, nach `dlg.appendChild(togRow);`):**

```js
  // BA 240: Vol/Dur/Pau-Eingabefelder. Pro Feld via cfg.showXxx aktivierbar.
  // Werte werden live ueber cfg-Setter zurueckgeschrieben (kein OK-Bestaetigen).
  var anyVdpField = cfg.showVolume || cfg.showDuration || cfg.showPause;
  if (anyVdpField) {
    var vdpRow = document.createElement('div');
    vdpRow.style.cssText =
      'display:flex;gap:14px;margin:0 0 14px 0;flex-wrap:wrap;align-items:center;';

    function _mkVdpField(labelKey, getter, setter, min, max, step, suffix) {
      var wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.92em;';
      var lbl = document.createElement('span');
      lbl.dataset.t = labelKey;
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min  = String(min);
      inp.max  = String(max);
      inp.step = String(step);
      inp.value = String(getter());
      inp.style.cssText =
        'width:64px;padding:3px 5px;border:1px solid var(--border);'
        + 'border-radius:4px;text-align:center;font-family:var(--mono);font-size:.9em;';
      inp.addEventListener('change', function() {
        var v = parseInt(inp.value, 10);
        if (!isFinite(v)) v = getter();
        if (v < min) v = min;
        if (v > max) v = max;
        inp.value = String(v);
        setter(v);
      });
      var unit = document.createElement('span');
      unit.textContent = suffix;
      unit.style.color = 'var(--text-muted)';
      wrap.append(lbl, inp, unit);
      return wrap;
    }

    if (cfg.showVolume && typeof cfg.getVolumePercent === 'function'
        && typeof cfg.setVolumePercent === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupVolume', cfg.getVolumePercent, cfg.setVolumePercent,
        0, 100, 1, '%'
      ));
    }
    if (cfg.showDuration && typeof cfg.getDurationMs === 'function'
        && typeof cfg.setDurationMs === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupDuration', cfg.getDurationMs, cfg.setDurationMs,
        100, 3000, 50, 'ms'
      ));
    }
    if (cfg.showPause && typeof cfg.getPauseMs === 'function'
        && typeof cfg.setPauseMs === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupPause', cfg.getPauseMs, cfg.setPauseMs,
        50, 2000, 50, 'ms'
      ));
    }

    if (vdpRow.children.length) dlg.appendChild(vdpRow);
  }
```

Diese Zeile gehört **zwischen** `dlg.appendChild(togRow);` (Z. ~281,
Korrektur-Toggles bereits angehängt) **und** dem Klavier-Render-Block
(Z. ~304, `if (cfg.keyboardMode && …)`). Damit landet sie visuell unter
den Toggles und über dem Klavier.

### 8. i18n-Keys ergänzen — `i18n/de.js`

Nach `tonePopupApplyBalance` (Z. 1101) drei neue Keys einfügen:

```js
    tonePopupVolume:   "Lautstärke",
    tonePopupDuration: "Tondauer",
    tonePopupPause:    "Tonpause",
```

ASCII-`"` als String-Begrenzer; keine typografischen Anführungszeichen
in den Werten.

### 9. Latenz-Default auf 75 anheben — `js/latency.js`

Z. 27 ändern:

```js
let latVolume = 75;
```

### 10. Reset-Defaults anpassen — `js/file.js`

Z. 57–59 (Reset-Block) ändern:

```js
  document.getElementById("vol1").value = "75";
  document.getElementById("dur1").value = "1000";
  document.getElementById("pau1").value = "500";
```

Und im selben Block (nach Z. 64) die neuen Variablen zurücksetzen:

```js
  if (typeof volume_freqmatch   !== "undefined") volume_freqmatch   = 75;
  if (typeof duration_freqmatch !== "undefined") duration_freqmatch = 750;
  if (typeof pause_freqmatch    !== "undefined") pause_freqmatch    = 400;
```

### 11. Persistenz: Speichern — `js/file.js`

Im Speichern-Block (Z. ~283, beim `toneType_freqmatch`-Eintrag) drei
weitere Einträge ergänzen:

```js
    globalToneType: globalToneType,
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : "richCiHF",
    // BA 240: Vol/Dur/Pau-State des Frequenzabgleichs persistieren.
    volume_freqmatch:   (typeof volume_freqmatch   !== "undefined") ? volume_freqmatch   : 75,
    duration_freqmatch: (typeof duration_freqmatch !== "undefined") ? duration_freqmatch : 750,
    pause_freqmatch:    (typeof pause_freqmatch    !== "undefined") ? pause_freqmatch    : 400,
```

### 12. Persistenz: Laden — `js/file.js`

Im `loadJson`-Pfad nach dem `toneType_freqmatch`-Restore-Block (Z. ~605)
einen neuen Block ergänzen:

```js
  // BA 240: Vol/Dur/Pau aus gespeicherten Daten zuruecklesen, mit Default-Fallback.
  if (typeof volume_freqmatch !== "undefined") {
    var sv = parseInt(d.volume_freqmatch, 10);
    volume_freqmatch = (isFinite(sv) && sv >= 0 && sv <= 100) ? sv : 75;
  }
  if (typeof duration_freqmatch !== "undefined") {
    var sd = parseInt(d.duration_freqmatch, 10);
    duration_freqmatch = (isFinite(sd) && sd >= 100 && sd <= 3000) ? sd : 750;
  }
  if (typeof pause_freqmatch !== "undefined") {
    var sp = parseInt(d.pause_freqmatch, 10);
    pause_freqmatch = (isFinite(sp) && sp >= 50 && sp <= 2000) ? sp : 400;
  }
```

(Datei-Variant `js/init.js` ab Z. 770 enthält einen parallelen Lade-
Pfad für `toneType_freqmatch`. Dort sind die neuen Variablen **nicht**
nötig — `init.js` lädt nur eine Untermenge beim Tab-Wechsel. Wenn die
Persistenz für Vol/Dur/Pau auch dort gebraucht würde, würde das in
einer Folge-BA nachgezogen.)

### 13. Default des testUI-Headers anheben — `js/test-ui.js`

Im neuen Builder `_buildTestPanelNew` Z. ~902 den Vol-Default von 50
auf 75:

```js
      volInput = makeNumInput2('vol', 75, 0, 100, 1, 55);
```

Im alten Builder `_buildTestPanelOld` Z. ~204 ebenfalls den Default:

```js
    volInput = makeNumInput('vol', 75, 0, 100, 1, 55);
```

### 14. sweepRow-Default im HTML anheben — `index.html`

Z. ~471 (`<input … id="vol1" value="50" …>`) auf `value="75"` ändern.
Der ganze `sweepRow`-Block fällt in BA 242 ohnehin weg; der Default-
Wert wird trotzdem konsistent angehoben, damit ein verfrühtes
Laufen-Lassen vor BA 242 keinen Inkonsistenz-Bug zeigt.

## Akzeptanztest

Nach dem Build im Browser durchgehen (DevTools-Konsole für Fehler offen):

1. **Hard-Reload**, Version oben rechts ist `3.2.240-beta`.
2. **Tab Messungen → Sub-Tab Frequenzabgleich**: Header zeigt nur
   noch Referenzseiten-Wahl, Sequenz-Dropdown und den
   Tonart-Auswahl-Knopf. **Keine** Vol/Dur/Pau-Eingabefelder mehr
   im Header.
3. **Tonart-Knopf klicken** → Modal öffnet sich. Erwartet:
   - Hint-Box gelb-orange oben mit dem bisherigen Test-Hinweis-Text
   - Korrektur-Toggles (Elektrodenlautstärke / Stereo-Balance), beide
     Default grün-aktiv
   - **Neue Zeile**: Lautstärke (75 %), Tondauer (750 ms), Tonpause (400 ms)
   - Klavier-Widget
   - Tonart-Gruppen, jeweils ohne Sanduhr-Symbol rechts neben den Buttons
4. **Lautstärke in der Modal auf 20 % setzen** → Modal schließen mit
   Cancel → erneut öffnen → Wert ist weiterhin 20 %. Test starten,
   Vorspiel ist leiser. Auf 75 % zurückstellen.
5. **Tonart-Knopf-Klick auf einer beliebigen Tonart** → Vorspiel-Sequenz
   spielt (zwei Bursts), keine Sanduhr-Anzeige während des Vorspiels.
6. **OK schließen, Tonart-Wechsel ist übernommen** (Knopf-Label zeigt
   die neue Tonart).
7. **Frequenzabgleich-Test starten** (Slider-Verfahren) → Töne werden
   mit der in der Modal eingestellten Lautstärke / Tondauer / Tonpause
   gespielt.
8. **Verfahren auf Adaptiv umschalten und zurück auf Slider** →
   Tondauer und Tonpause werden wie bisher pro Slider-Verfahren
   gestasht und restored (BA 240 erhält das Verhalten 1:1).
9. **Speichern in Datei** → JSON enthält `volume_freqmatch`,
   `duration_freqmatch`, `pause_freqmatch`. Reset → Werte zurück
   auf 75 / 750 / 400. JSON wieder laden → Werte wiederhergestellt.
10. **Tab Messungen → Sub-Tab Latenz** unverändert: Header zeigt
    weiterhin nur Lautstärke (jetzt Default 75), keine Modal-Anbindung.
11. **Tab Messungen → Sub-Tab Elektrodenlautstärke und Stereo-Balance**
    unverändert (alte testUI-API, eigener Header mit Vol/Dur/Pau).
12. **Tab Implantat → Sweep-Bereich** unverändert (heutiger
    `sweepRow`-Block), Lautstärke-Eingabe zeigt jetzt 75 als Default
    bei Reset. Sweep funktioniert wie bisher.

## Selbstprüfungs-Auftrag an Sonnet

Nach dem Build, **vor** der Fertig-Meldung:

- Akzeptanzpunkte 1–12 oben einzeln durchgehen und je Punkt melden:
  erfüllt / nicht erfüllt / unklar, jeweils mit Datei- und
  Zeilenangabe der relevanten Stelle.
- Konsolen-Fehler-Check: Browser-Konsole nach Hard-Reload und nach
  jedem manuellen Test-Schritt auf Fehler prüfen. Auffälligkeiten
  (z. B. ReferenceError, Uncaught) explizit melden.
- Insbesondere prüfen:
  - `volume_freqmatch / duration_freqmatch / pause_freqmatch` sind
    in `state-side.js` deklariert und werden in `freqmatch.js`,
    `file.js` ohne `ReferenceError` gelesen.
  - `fmEls.header.volInput / durInput / pauseInput` werden in
    `freqmatch.js` nicht mehr referenziert (per grep prüfen). Falls
    doch — Stelle nennen und Klärung anfordern.
  - `_setHourglassFor` und Sanduhr-Spans (`btn-hourglass`) sind aus
    `tone-popup.js` vollständig entfernt; keine verwaisten Aufrufer.
  - smplr-Lade-Branch in `_playPreview` ist entfernt; `_playPreview`
    startet direkt mit der Vol-Berechnung.
- Bei `unklar` oder „nicht erfüllt": Bauarbeit pausieren, beim Nutzer
  rückfragen statt still annehmen.

## Hinweis für spätere Folge-BA

Die drei neuen i18n-Keys `tonePopupVolume / tonePopupDuration /
tonePopupPause` sind nur auf Deutsch belegt. EN/FR/ES-Übersetzungen
ziehen wir bei Bedarf in einer Mini-BA nach, sobald der Nutzer es
anordnet. Bis dahin fallen die fehlenden Keys über `js/i18n.js` auf
die deutschen Defaults zurück.

Nach BA 240 folgen:
- BA 241: Klavier-Disabled-Anzeige + Highlight-API + Modal-Sweep-Knopf
- BA 242: Implantat-Tab Migration (sweepRow raus, Tonauswahl-Knopf rein)
- BA 243: freq-table Play/Hold-Spalten entfernen
