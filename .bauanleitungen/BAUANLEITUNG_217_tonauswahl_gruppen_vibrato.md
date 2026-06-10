# BAUANLEITUNG 217 — Tonauswahl-Dialog: Gruppen, Beschreibungen, Vibrato-Stärke

## Ziel

Den modalen Tonauswahl-Dialog (`_openToneTypeDialog` in `js/test-ui.js`)
neu strukturieren:

1. Die 25 Tonarten werden in **vier Gruppen** mit Gruppen-Überschrift
   und einem kurzen Gruppen-Hinweis dargestellt:
   - **Sinustöne** — Sinus, AM-Sinus, Sinus-Bursts, Warble-Sinus, Wobble-Sweep
   - **Komplextöne** — Komplex, Pulsierter Komplex, richTone
   - **Instrumenten-Klänge** — die 14 richXX-Profile
   - **Rauschsignale** — Rauschen, Adaptives Rauschen, IRN
2. Jede Tonart (außer den Instrumenten) bekommt eine **kurze Beschreibung**
   in einer zweiten Zeile unter dem Namen.
3. In der Instrumenten-Gruppe steht direkt unter der Gruppen-Überschrift
   eine **Vibrato-Stärke-Reihe** mit fünf Buttons (0 %, 25 %, 50 %, 75 %,
   100 %). Der Wert ist global, gilt für **alle Instrumenten-Profile**
   (nicht für richTone-Basis), wird mit dem Workspace persistiert und
   skaliert den Profil-Vibrato-Wert bei der Tonerzeugung.
4. Instrumente, deren Profil ein Vibrato enthält (`vibratoCents > 0` —
   derzeit Bratsche und Violoncello), bekommen hinter ihrem Namen den
   kursiven Hinweis **„(Vibrato)"**.
5. i18n: **Alle vier Sprachen** (de, en, fr, es) werden in dieser BA
   mitgeliefert — Vorgabe des Nutzers, ausnahmsweise nicht der
   Leitlinien-Default „nur Deutsch".

Versionsbump auf **3.2.217-beta** (aktuell 3.2.216-beta).

---

## 0. Versionsbump (Pflicht — direkt am Anfang)

**Datei:** `js/version.js`

Ersetze die gesamte Zeile:

```js
const APP_VERSION = "3.2.216-beta";
```

durch:

```js
const APP_VERSION = "3.2.217-beta";
```

---

## 1. Neue globale Variable `globalInstrumentVibrato`

**Datei:** `js/state-side.js` — direkt nach der `toneType_freqmatch`-Zeile
(im Bereich um Z. 694–702).

**Vor:**

```js
let globalToneType = "complex"; // "sine" | "complex" | "pulsedComplex" | "noise" | ...
// BA 209: Tonart speziell für Frequenzabgleich. Separat von globalToneType,
// das weiterhin für Elektrodenlautstärke und Stereo-Balance gilt.
// Default 'pulsedComplex' (Komplexton gepulst).
let toneType_freqmatch = "pulsedComplex";
let globalSequence = "ab";        // "aba" | "ab"
```

**Nach:**

```js
let globalToneType = "complex"; // "sine" | "complex" | "pulsedComplex" | "noise" | ...
// BA 209: Tonart speziell für Frequenzabgleich. Separat von globalToneType,
// das weiterhin für Elektrodenlautstärke und Stereo-Balance gilt.
// Default 'pulsedComplex' (Komplexton gepulst).
let toneType_freqmatch = "pulsedComplex";
// BA 217: Globaler Skalierungsfaktor (0..100 %) für das Profil-Vibrato
// der Instrumenten-richTones. Wirkt in playRichToneProfile als
// Multiplikator auf vibratoCents. richTone-Basis (playRichTone) bleibt
// unverändert (fest 10 Cent).
let globalInstrumentVibrato = 100;
let globalSequence = "ab";        // "aba" | "ab"
```

---

## 2. `playRichToneProfile` skaliert Profil-Vibrato

**Datei:** `js/audio.js` — Funktion `playRichToneProfile` (ab Z. 317).
Ersetze die VIB_CENTS-Zeile so, daß der globale Skalierungsfaktor
einfließt.

**Vor (Z. 324–325):**

```js
    const VIB_HZ      = profile.vibratoHz    || 0;
    const VIB_CENTS   = profile.vibratoCents || 0;
```

**Nach:**

```js
    const VIB_HZ      = profile.vibratoHz    || 0;
    // BA 217: Profil-Vibrato wird global skaliert (0..100 %).
    const _vibScale   = (typeof globalInstrumentVibrato === "number")
                          ? Math.max(0, Math.min(100, globalInstrumentVibrato)) / 100
                          : 1;
    const VIB_CENTS   = (profile.vibratoCents || 0) * _vibScale;
```

**Wichtig (Selbstprüfung):** `playRichTone` (audio.js Z. 235 — Basis-
richTone, ohne Profil) bleibt **unverändert**. Der globale Faktor wirkt
ausschließlich auf `playRichToneProfile` (die 14 Instrumenten-Profile).

---

## 3. Save / Load / Reset in `js/file.js`

### 3a. Reset (Z. ~63, im `resetAll()`)

**Vor:**

```js
  if (typeof globalToneType !== "undefined") globalToneType = "complex";
  if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = "pulsedComplex";
```

**Nach:**

```js
  if (typeof globalToneType !== "undefined") globalToneType = "complex";
  if (typeof toneType_freqmatch !== "undefined") toneType_freqmatch = "pulsedComplex";
  if (typeof globalInstrumentVibrato !== "undefined") globalInstrumentVibrato = 100;
```

### 3b. Save (Z. ~283, im Save-Objekt)

**Vor:**

```js
    globalToneType: globalToneType,
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : "pulsedComplex",
```

**Nach:**

```js
    globalToneType: globalToneType,
    toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
      ? toneType_freqmatch : "pulsedComplex",
    globalInstrumentVibrato: (typeof globalInstrumentVibrato !== "undefined")
      ? globalInstrumentVibrato : 100,
```

### 3c. Load (Z. ~598ff)

Direkt nach dem `toneType_freqmatch`-Migrationsblock (also nach der
schließenden Klammer der `if (typeof toneType_freqmatch !== "undefined") { ... }`
um Z. 612) folgenden Block einfügen, **vor** der `syncAllGlobalDropdowns`-Zeile:

```js
  // BA 217: Globaler Instrumenten-Vibrato (0..100 %).
  if (typeof globalInstrumentVibrato !== "undefined") {
    const _v = Number(d.globalInstrumentVibrato);
    globalInstrumentVibrato = (Number.isFinite(_v) && _v >= 0 && _v <= 100)
      ? _v : 100;
  }
```

---

## 4. Save / Load im Auto-Save (`js/init.js`)

### 4a. Load (Z. ~771)

**Vor:**

```js
      if (d.globalToneType) globalToneType = d.globalToneType;
```

**Nach:**

```js
      if (d.globalToneType) globalToneType = d.globalToneType;
      // BA 217: Globaler Instrumenten-Vibrato (0..100 %).
      if (typeof globalInstrumentVibrato !== "undefined") {
        const _v = Number(d.globalInstrumentVibrato);
        globalInstrumentVibrato = (Number.isFinite(_v) && _v >= 0 && _v <= 100)
          ? _v : 100;
      }
```

### 4b. Save (Z. ~968)

**Vor:**

```js
          globalToneType: globalToneType,
          toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
            ? toneType_freqmatch : "pulsedComplex",
```

**Nach:**

```js
          globalToneType: globalToneType,
          toneType_freqmatch: (typeof toneType_freqmatch !== "undefined")
            ? toneType_freqmatch : "pulsedComplex",
          globalInstrumentVibrato: (typeof globalInstrumentVibrato !== "undefined")
            ? globalInstrumentVibrato : 100,
```

---

## 5. Dialog-Umbau in `js/test-ui.js`

Das ist der zentrale Schritt. Die bisherige flache Tonart-Liste
(test-ui.js Z. 2113ff, Funktion `_openToneTypeDialog`) wird durch eine
Gruppen-Struktur ersetzt. Lautäußerung des Dialogs sonst (Titel,
Hinweis-Box, OK/Cancel) bleibt gleich.

### 5a. Vollständig zu ersetzende Funktion

**Datei:** `js/test-ui.js` — Funktion `_openToneTypeDialog` (Z. 2105–2275).
Komplett ersetzen durch folgenden Block. Der Kommentar-Block oben bleibt
fast gleich, der Kern wird umgebaut.

```js
// BA 209 + 217: Modal-Dialog 'Tonart wählen'.
// BA 217: Gruppen-Struktur mit kurzen Beschreibungen pro Tonart.
//         Eigene Vibrato-Stärke-Reihe (0/25/50/75/100 %) über der
//         Instrumenten-Gruppe; wirkt auf alle richXX-Profile, nicht
//         auf richTone-Basis. Instrumente mit Profil-Vibrato bekommen
//         hinter dem Namen kursiv "(Vibrato)".
//
// cfg: {
//   getToneType:        () => string             - aktuelle Tonart
//   setToneType:        (tt: string) => void     - bei OK gespeicherte Tonart setzen
//   getVolume:          () => number             - Lautstärke (linear, 0..1) für Vorschau
//   getPreviewSequence: () => Array<Step>        - Probehör-Sequenz, siehe unten
// }
// Step: { hz: number, pan: number, durationMs: number } | { pauseMs: number }
function _openToneTypeDialog(cfg, onChange) {
  // Pro Eintrag: [key, i18nLabelKey, i18nDescKey?]
  // Bei Instrumenten ist desc bewußt leer (Name reicht).
  var GROUPS = [
    {
      headKey: 'toneGroupSine',
      hintKey: 'toneGroupSineHint',
      items: [
        ['sine',          'toneSine',          'toneSineDesc'],
        ['amSine',        'toneAmSine',        'toneAmSineDesc'],
        ['burstSine',     'toneBurstSine',     'toneBurstSineDesc'],
        ['warbleSine',    'toneWarbleSine',    'toneWarbleSineDesc'],
        ['wobbleSweep',   'toneWobbleSweep',   'toneWobbleSweepDesc']
      ]
    },
    {
      headKey: 'toneGroupComplex',
      hintKey: 'toneGroupComplexHint',
      items: [
        ['complex',       'toneComplex',       'toneComplexDesc'],
        ['pulsedComplex', 'tonePulsedComplex', 'tonePulsedComplexDesc'],
        ['richTone',      'toneRichTone',      'toneRichToneDesc']
      ]
    },
    {
      headKey: 'toneGroupRich',
      hintKey: 'toneGroupRichHint',
      vibratoBlock: true,   // BA 217: hier kommt die Vibrato-Stärke-Reihe rein
      items: [
        ['richAcc',   'toneRichAcc',   null],
        ['richASax',  'toneRichASax',  null],
        ['richBTb',   'toneRichBTb',   null],
        ['richVa',    'toneRichVa',    null],
        ['richBn',    'toneRichBn',    null],
        ['richClBb',  'toneRichClBb',  null],
        ['richCb',    'toneRichCb',    null],
        ['richOb',    'toneRichOb',    null],
        ['richTbn',   'toneRichTbn',   null],
        ['richFl',    'toneRichFl',    null],
        ['richTpC',   'toneRichTpC',   null],
        ['richVn',    'toneRichVn',    null],
        ['richVc',    'toneRichVc',    null],
        ['richHn',    'toneRichHn',    null]
      ]
    },
    {
      headKey: 'toneGroupNoise',
      hintKey: 'toneGroupNoiseHint',
      items: [
        ['noise',         'toneNoise',         'toneNoiseDesc'],
        ['noiseAdaptive', 'toneNoiseAdaptive', 'toneNoiseAdaptiveDesc'],
        ['irn',           'toneIRN',           'toneIRNDesc']
      ]
    }
  ];

  // BA 217: Welche richXX-Profile haben aktuell ein Profil-Vibrato?
  // Wird zur Kennzeichnung "(Vibrato)" im Label und für die Logik
  // gebraucht, daß die Vibrato-Buttons sichtbar wirksam sind.
  function _hasProfileVibrato(key) {
    if (typeof RICHTONE_PROFILES === "undefined") return false;
    if (!key || key.length <= 4 || !key.startsWith("rich")) return false;
    var abbr = key.substring(4);
    var p = RICHTONE_PROFILES[abbr];
    return !!(p && typeof p.vibratoCents === "number" && p.vibratoCents > 0);
  }

  var initial = cfg.getToneType();
  var selected = initial;
  var playing = false;

  // BA 217: Vibrato-Wert beim Dialog-Öffnen merken — bei Abbrechen
  // wird er zurückgesetzt. Buttons mutieren live, damit Vorspielen
  // sofort den eingestellten Wert hört.
  var initialVibrato = (typeof globalInstrumentVibrato === "number")
    ? globalInstrumentVibrato : 100;
  var vibratoButtons = []; // Refs, für visuelles Update

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  var dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:420px;max-width:90vw;max-height:85vh;' +
    'overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.3);';

  var title = document.createElement('h3');
  title.dataset.t = 'tonePopupTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  var hint = document.createElement('p');
  hint.dataset.t = 'tonePopupHint';
  hint.style.cssText =
    'margin:0 0 14px 0;font-size:.92em;line-height:1.35;' +
    'background:#fff4d6;border-left:3px solid #d8a200;' +
    'padding:8px 10px;border-radius:4px;';
  dlg.appendChild(hint);

  // BA 217: Pro Gruppe ein Container mit Überschrift, Hinweis,
  // optional Vibrato-Stärke-Reihe und Item-Liste.
  GROUPS.forEach(function(grp) {
    var section = document.createElement('section');
    section.style.cssText = 'margin-bottom:14px;';

    var h4 = document.createElement('h4');
    h4.dataset.t = grp.headKey;
    h4.style.cssText =
      'margin:0 0 2px 0;font-size:.98em;font-weight:600;' +
      'color:var(--fg,#000);';
    section.appendChild(h4);

    var subhint = document.createElement('div');
    subhint.dataset.t = grp.hintKey;
    subhint.style.cssText =
      'margin:0 0 8px 0;font-size:.85em;color:#666;font-style:italic;';
    section.appendChild(subhint);

    // BA 217: Vibrato-Stärke-Reihe nur über der Instrumenten-Gruppe.
    if (grp.vibratoBlock) {
      var vibRow = document.createElement('div');
      vibRow.style.cssText =
        'display:flex;align-items:center;gap:8px;margin:0 0 10px 0;' +
        'padding:6px 0;';
      var vibLbl = document.createElement('span');
      vibLbl.dataset.t = 'toneVibratoLabel';
      vibLbl.style.cssText = 'font-size:.9em;';
      vibRow.appendChild(vibLbl);

      [0, 25, 50, 75, 100].forEach(function(val) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn btn-small';
        b.textContent = val + ' %';
        b.dataset.vibVal = String(val);
        b.style.cssText = 'min-width:54px;';
        b.addEventListener('click', function() {
          globalInstrumentVibrato = val;
          _refreshVibratoButtons();
        });
        vibratoButtons.push(b);
        vibRow.appendChild(b);
      });
      section.appendChild(vibRow);
    }

    var list = document.createElement('div');
    list.style.cssText =
      'display:grid;grid-template-columns:auto 1fr auto;' +
      'gap:4px 10px;align-items:center;';

    grp.items.forEach(function(triple) {
      var key = triple[0], i18nKey = triple[1], descKey = triple[2];

      var rb = document.createElement('input');
      rb.type = 'radio';
      rb.name = 'tonePopupChoice';
      rb.value = key;
      rb.checked = (key === initial);
      rb.id = 'tonePopupRb_' + key;

      // Label-Block: Name (per data-t) + ggf. "(Vibrato)"-Marker
      //   für Instrumente mit Profil-Vibrato + Beschreibung (per data-t).
      var lblBlock = document.createElement('label');
      lblBlock.htmlFor = rb.id;
      lblBlock.style.cssText =
        'cursor:pointer;display:flex;flex-direction:column;gap:1px;';

      var nameLine = document.createElement('span');
      var nameSpan = document.createElement('span');
      nameSpan.dataset.t = i18nKey;
      nameSpan.style.cssText = 'font-size:.94em;';
      nameLine.appendChild(nameSpan);

      if (_hasProfileVibrato(key)) {
        var vibMark = document.createElement('span');
        vibMark.dataset.t = 'toneVibratoMarker';
        vibMark.style.cssText =
          'font-style:italic;font-size:.85em;color:#666;margin-left:6px;';
        nameLine.appendChild(vibMark);
      }
      lblBlock.appendChild(nameLine);

      if (descKey) {
        var descSpan = document.createElement('span');
        descSpan.dataset.t = descKey;
        descSpan.style.cssText =
          'font-size:.82em;color:#666;line-height:1.3;';
        lblBlock.appendChild(descSpan);
      }

      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn-small';
      play.dataset.t = 'tonePopupPlay';
      play.dataset.toneKey = key;
      play.style.cssText = 'min-width:90px;';

      rb.addEventListener('change', function() {
        if (rb.checked) selected = key;
      });
      play.addEventListener('click', function() {
        if (playing) return;
        rb.checked = true;
        selected = key;
        _playPreview(key);
      });

      list.append(rb, lblBlock, play);
    });

    section.appendChild(list);
    dlg.appendChild(section);
  });

  // BA 217: Vibrato-Buttons visuell als Radio-Group: aktiver Button
  // hervorgehoben, restliche normal. Aufruf direkt nach DOM-Aufbau
  // und bei jedem Klick.
  function _refreshVibratoButtons() {
    var cur = (typeof globalInstrumentVibrato === "number")
      ? globalInstrumentVibrato : 100;
    vibratoButtons.forEach(function(b) {
      var v = Number(b.dataset.vibVal);
      if (v === cur) {
        b.style.background = '#1976d2';
        b.style.color = '#fff';
        b.style.borderColor = '#1976d2';
      } else {
        b.style.background = '';
        b.style.color = '';
        b.style.borderColor = '';
      }
    });
  }

  function _playPreview(toneType) {
    var seq = cfg.getPreviewSequence();
    if (!Array.isArray(seq) || seq.length === 0) return;
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;
    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setPlayButtonsDisabled(true);

    var idx = 0;
    function nextStep() {
      if (idx >= seq.length) {
        playing = false;
        _setPlayButtonsDisabled(false);
        return;
      }
      var step = seq[idx++];
      if (step && typeof step.pauseMs === 'number') {
        setTimeout(nextStep, step.pauseMs);
        return;
      }
      if (!step || typeof step.hz !== 'number' || typeof step.durationMs !== 'number') {
        nextStep();
        return;
      }
      var pan = (typeof step.pan === 'number') ? step.pan : 0;
      try {
        playToneTyped(c, step.hz, vol, step.durationMs, pan, toneType);
      } catch (e) { /* swallow */ }
      setTimeout(nextStep, step.durationMs);
    }
    nextStep();
  }
  function _setPlayButtonsDisabled(flag) {
    var btns = dlg.querySelectorAll('button[data-tone-key]');
    btns.forEach(function(b) { b.disabled = flag; });
  }

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.dataset.t = 'tonePopupCancel';
  var okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.dataset.t = 'tonePopupOk';
  btnRow.append(cancelBtn, okBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  if (typeof applyLang === 'function') applyLang();
  _refreshVibratoButtons();

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  cancelBtn.addEventListener('click', function() {
    // BA 217: Vibrato-Mutation rückgängig machen.
    globalInstrumentVibrato = initialVibrato;
    close();
  });
  okBtn.addEventListener('click', function() {
    if (selected !== initial) {
      cfg.setToneType(selected);
    }
    // BA 217: Vibrato-Änderung wird übernommen (bereits live gesetzt).
    if (selected !== initial || globalInstrumentVibrato !== initialVibrato) {
      if (typeof onChange === 'function') onChange();
    }
    close();
  });
}
```

### 5b. Was bleibt unverändert

- Alle Aufrufer von `_openToneTypeDialog(...)` müssen **nicht** angepaßt
  werden — die Signatur (cfg, onChange) ist gleich geblieben.
- Andere Tonart-Dropdowns außerhalb dieses Dialogs (z.B. das alte
  `<select>` in test-ui.js Z. 238ff für die Sub-Tabs) bleiben in dieser
  BA unangetastet. Sie werden in einer späteren BA migriert.

---

## 6. i18n-Strings (alle vier Sprachen)

Pro Sprachdatei werden **22 neue Keys** ergänzt: 4 Gruppen-Überschriften,
4 Gruppen-Hinweise, 11 Tonart-Beschreibungen (nicht alle 25 Tonarten —
die 14 Instrumente und die bereits sprechenden Labels brauchen keine
Beschreibung), 1 Vibrato-Label, 1 Vibrato-Marker, 1 Vibrato-Wert (für
ggf. künftige Verwendung — entfällt hier, siehe Hinweis unten).

**Hinweis zu Vibrato-Wert-Anzeige:** Der numerische Wert auf den
Buttons (`"0 %"`, `"25 %"`, …) wird direkt im JS als String gesetzt
(`b.textContent = val + ' %'`), nicht über i18n. Das ist absichtlich
einfach gehalten — die Schreibweise „% mit Leerzeichen" ist
international, und das Prozentzeichen reicht ohne Übersetzung.

### 6a. `i18n/de.js`

Direkt **nach** der existierenden `tonePopupCancel`-Zeile (Z. ~1073),
**vor** der schließenden `});`-Zeile, einfügen:

```js
    // BA 217: Tonauswahl-Dialog mit Gruppen und Beschreibungen.
    toneGroupSine:           "Sinustöne",
    toneGroupSineHint:       "Eine klare Frequenz, schmales Spektrum.",
    toneGroupComplex:        "Komplextöne",
    toneGroupComplexHint:    "Grundton mit Obertönen, klangfarbenreich.",
    toneGroupRich:           "Instrumenten-Klänge",
    toneGroupRichHint:       "richTones nach echten Instrumenten-Samples.",
    toneGroupNoise:          "Rauschsignale",
    toneGroupNoiseHint:      "Schmalbandig um die Nominalfrequenz.",
    toneSineDesc:            "Reine, einzelne Frequenz.",
    toneAmSineDesc:          "Sinus mit langsamem Tremolo (Lautstärke schwankt).",
    toneBurstSineDesc:       "Vier kurze Sinus-Pulse mit Pausen.",
    toneWarbleSineDesc:      "Sinus mit kräftigem Vibrato (±5 %).",
    toneWobbleSweepDesc:     "Sinus, der langsam ±5 % um die Nominalfrequenz wandert.",
    toneComplexDesc:         "Grundton plus vier Obertöne, stationär.",
    tonePulsedComplexDesc:   "Komplexton mit 100-Hz-Amplitudenpuls.",
    toneRichToneDesc:        "Acht Obertöne mit Atem-Modulation.",
    toneNoiseDesc:           "Schmalbandiges Rauschen mit fester Bandbreite.",
    toneNoiseAdaptiveDesc:   "Schmalbandiges Rauschen mit frequenzabhängiger Bandbreite.",
    toneIRNDesc:             "Rauschen mit hörbarer Resttonhöhe.",
    toneVibratoLabel:        "Vibrato-Stärke:",
    toneVibratoMarker:       "(Vibrato)",
```

### 6b. `i18n/en.js`

An derselben Stelle (analog zur de.js — nach den existierenden
`tonePopup*`-Keys) einfügen:

```js
    // BA 217: Tone selection dialog with groups and descriptions.
    toneGroupSine:           "Sine tones",
    toneGroupSineHint:       "A clear frequency, narrow spectrum.",
    toneGroupComplex:        "Complex tones",
    toneGroupComplexHint:    "Fundamental with overtones, rich in timbre.",
    toneGroupRich:           "Instrument timbres",
    toneGroupRichHint:       "richTones based on real instrument samples.",
    toneGroupNoise:          "Noise signals",
    toneGroupNoiseHint:      "Narrowband around the nominal frequency.",
    toneSineDesc:            "Pure single frequency.",
    toneAmSineDesc:          "Sine with slow tremolo (loudness fluctuates).",
    toneBurstSineDesc:       "Four short sine pulses with pauses.",
    toneWarbleSineDesc:      "Sine with strong vibrato (±5 %).",
    toneWobbleSweepDesc:     "Sine slowly sweeping ±5 % around the nominal frequency.",
    toneComplexDesc:         "Fundamental plus four overtones, stationary.",
    tonePulsedComplexDesc:   "Complex tone with 100-Hz amplitude pulse.",
    toneRichToneDesc:        "Eight overtones with breath modulation.",
    toneNoiseDesc:           "Narrowband noise with fixed bandwidth.",
    toneNoiseAdaptiveDesc:   "Narrowband noise with frequency-dependent bandwidth.",
    toneIRNDesc:             "Noise with audible residual pitch.",
    toneVibratoLabel:        "Vibrato strength:",
    toneVibratoMarker:       "(vibrato)",
```

### 6c. `i18n/fr.js`

```js
    // BA 217: Dialogue de sélection du timbre avec groupes et descriptions.
    toneGroupSine:           "Sons sinusoïdaux",
    toneGroupSineHint:       "Une fréquence claire, spectre étroit.",
    toneGroupComplex:        "Sons complexes",
    toneGroupComplexHint:    "Fondamentale avec harmoniques, timbre riche.",
    toneGroupRich:           "Timbres d'instruments",
    toneGroupRichHint:       "richTones basés sur de vrais échantillons d'instruments.",
    toneGroupNoise:          "Signaux de bruit",
    toneGroupNoiseHint:      "Bande étroite autour de la fréquence nominale.",
    toneSineDesc:            "Fréquence pure unique.",
    toneAmSineDesc:          "Sinus avec trémolo lent (l'intensité varie).",
    toneBurstSineDesc:       "Quatre brèves impulsions sinusoïdales avec pauses.",
    toneWarbleSineDesc:      "Sinus avec vibrato prononcé (±5 %).",
    toneWobbleSweepDesc:     "Sinus glissant lentement de ±5 % autour de la fréquence nominale.",
    toneComplexDesc:         "Fondamentale plus quatre harmoniques, stationnaire.",
    tonePulsedComplexDesc:   "Son complexe avec impulsion d'amplitude à 100 Hz.",
    toneRichToneDesc:        "Huit harmoniques avec modulation de souffle.",
    toneNoiseDesc:           "Bruit à bande étroite, largeur fixe.",
    toneNoiseAdaptiveDesc:   "Bruit à bande étroite, largeur dépendante de la fréquence.",
    toneIRNDesc:             "Bruit avec hauteur résiduelle audible.",
    toneVibratoLabel:        "Force du vibrato :",
    toneVibratoMarker:       "(vibrato)",
```

### 6d. `i18n/es.js`

```js
    // BA 217: Diálogo de selección de timbre con grupos y descripciones.
    toneGroupSine:           "Tonos sinusoidales",
    toneGroupSineHint:       "Una frecuencia clara, espectro estrecho.",
    toneGroupComplex:        "Tonos complejos",
    toneGroupComplexHint:    "Fundamental con armónicos, timbre rico.",
    toneGroupRich:           "Timbres de instrumentos",
    toneGroupRichHint:       "richTones basados en muestras de instrumentos reales.",
    toneGroupNoise:          "Señales de ruido",
    toneGroupNoiseHint:      "Banda estrecha alrededor de la frecuencia nominal.",
    toneSineDesc:            "Frecuencia pura única.",
    toneAmSineDesc:          "Sinusoide con trémolo lento (el volumen fluctúa).",
    toneBurstSineDesc:       "Cuatro impulsos sinusoidales cortos con pausas.",
    toneWarbleSineDesc:      "Sinusoide con vibrato fuerte (±5 %).",
    toneWobbleSweepDesc:     "Sinusoide que oscila lentamente ±5 % alrededor de la frecuencia nominal.",
    toneComplexDesc:         "Fundamental más cuatro armónicos, estacionario.",
    tonePulsedComplexDesc:   "Tono complejo con pulso de amplitud a 100 Hz.",
    toneRichToneDesc:        "Ocho armónicos con modulación de respiración.",
    toneNoiseDesc:           "Ruido de banda estrecha con ancho fijo.",
    toneNoiseAdaptiveDesc:   "Ruido de banda estrecha con ancho dependiente de la frecuencia.",
    toneIRNDesc:             "Ruido con altura tonal residual audible.",
    toneVibratoLabel:        "Intensidad del vibrato:",
    toneVibratoMarker:       "(vibrato)",
```

---

## Akzeptanztest (Klick für Klick)

**A1. Dialog öffnen**
- Tab **Messungen → Frequenzabgleich** öffnen.
- Den Button für die Tonart-Auswahl (im Verfahren-Bereich) klicken.
- **Erwartet:** Modaler Dialog öffnet sich. Sichtbar sind nacheinander
  von oben: Titel „Tonart wählen", gelber Hinweis-Kasten, **vier
  Gruppen-Überschriften** in dieser Reihenfolge:
  1. „Sinustöne" mit Hinweis-Zeile darunter
  2. „Komplextöne" mit Hinweis-Zeile darunter
  3. „Instrumenten-Klänge" mit Hinweis-Zeile UND einer Reihe
     **„Vibrato-Stärke: [0 %] [25 %] [50 %] [75 %] [100 %]"** direkt
     unter dem Hinweis
  4. „Rauschsignale" mit Hinweis-Zeile darunter

**A2. Beschreibungen sichtbar**
- In der Sinustöne-Gruppe sieht man unter jedem Tonart-Namen eine
  zweite Zeile in dezenter Schrift mit kurzer Erklärung.
- **Erwartet** (Beispiele):
  - Sinus → „Reine, einzelne Frequenz."
  - AM-Sinus → „Sinus mit langsamem Tremolo (Lautstärke schwankt)."
  - Wobble-Sweep → „Sinus, der langsam ±5 % um die Nominalfrequenz wandert."
- In der Komplextöne-Gruppe: Komplex, Pulsierter Komplex, richTone —
  jeweils mit Beschreibung darunter.
- In der Rauschsignal-Gruppe: alle drei mit Beschreibung.
- In der Instrumenten-Gruppe: **keine** Beschreibung unter den Namen
  (Instrument-Name reicht).

**A3. (Vibrato)-Marker bei Bratsche und Violoncello**
- In der Instrumenten-Gruppe stehen 14 Instrumente.
- **Erwartet:** Hinter „Bratsche (richTone)" und „Violoncello (richTone)"
  steht in kursiv, in kleinerer Schrift und grau das Wort „(Vibrato)".
  Bei keinem anderen Instrument erscheint dieser Marker.

**A4. Vibrato-Buttons als Radio-Group**
- Beim Öffnen des Dialogs ist der „100 %"-Button hervorgehoben
  (gefüllter Hintergrund, weiße Schrift). Die anderen vier sind
  unauffällig (Standard-Button-Look).
- Auf „50 %" klicken → **erwartet:** „50 %" wird hervorgehoben, „100 %"
  springt zurück auf normal. Auf „0 %" klicken → „0 %" hervorgehoben.
  Auf „100 %" klicken → wieder „100 %" hervorgehoben.

**A5. Vibrato wirkt beim Vorspielen — nur auf Instrumente mit Profil-Vibrato**
- Vibrato auf „100 %" stellen.
- Bei der Bratsche auf „Vorspielen" klicken → es klingt mit Vibrato.
- Vibrato auf „0 %" stellen.
- Wieder Bratsche „Vorspielen" → klingt jetzt **ohne** Vibrato
  (statischer Ton).
- Vibrato auf „50 %" stellen → Bratsche „Vorspielen" → Vibrato hörbar,
  aber dezenter als bei 100 %.

**A6. Vibrato wirkt NICHT auf richTone (Basis) und nicht auf Instrumente
ohne Profil-Vibrato**
- Vibrato auf „0 %" stellen.
- richTone (in Gruppe „Komplextöne") „Vorspielen" → Vibrato hörbar
  (10 Cent, fix — richTone-Basis ist von der Skalierung **nicht**
  betroffen).
- Akkordeon „Vorspielen" → klingt gleich wie bei 100 % (Profil-Vibrato
  ist 0).

**A7. Persistenz: Wert überlebt einen Reload**
- Dialog öffnen, Vibrato auf „25 %" stellen, eine Tonart wählen
  (z.B. Bratsche), „OK" klicken.
- Browser-Reload (F5 oder Ctrl+R).
- Dialog wieder öffnen → **erwartet:** Bratsche ist weiterhin gewählt,
  Vibrato-Buttons stehen weiterhin auf „25 %" (Button hervorgehoben).
- Bratsche vorspielen → klingt mit reduziertem Vibrato.

**A8. Abbrechen verwirft Vibrato-Änderung**
- Vibrato steht aktuell auf „25 %" (von A7).
- Dialog öffnen → „25 %" hervorgehoben.
- Auf „100 %" klicken → „100 %" hervorgehoben.
- Bratsche vorspielen → kräftiges Vibrato (zur Bestätigung, daß Wert
  live wirkt).
- Auf **Abbrechen** klicken (nicht OK).
- Dialog wieder öffnen → **erwartet:** Vibrato steht wieder auf „25 %".

**A9. Save/Load über Datei**
- Vibrato auf „75 %", eine Tonart auswählen, OK.
- Speichern-Funktion auslösen (Workspace-Datei).
- Reset (z.B. „Reset"-Button oder Browser-Datenlöschung) → Vibrato
  fällt auf 100 % zurück.
- Workspace-Datei wieder laden → Vibrato steht auf „75 %", Tonart wie
  gespeichert.

**A10. Sprachwechsel zeigt korrekte Übersetzungen**
- Sprache auf Englisch wechseln (üblicher Mechanismus).
- Dialog öffnen → Gruppen-Überschriften zeigen „Sine tones", „Complex
  tones", „Instrument timbres", „Noise signals".
- Vibrato-Reihe: „Vibrato strength:" als Label.
- Marker bei Bratsche/Violoncello: „(vibrato)".
- Beschreibungen z.B. unter „Sine": „Pure single frequency."
- Stichprobe mit fr und es analog: „Sons sinusoïdaux" bzw. „Tonos
  sinusoidales" sichtbar als erste Gruppen-Überschrift.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden Akzeptanz-Punkt A1–A10 einzeln
durchgehen und melden:

- **erfüllt** (mit Datei + Zeile der relevanten Stelle), oder
- **nicht erfüllt** (mit Begründung), oder
- **unklar** (dann Rückfrage stellen, **nicht** stillschweigend
  annehmen).

Zusätzliche Selbstprüfungs-Punkte:

- **S1 — Versionsbump durchgeführt?** `js/version.js` enthält
  `"3.2.217-beta"`. Wenn nicht: vor Fertig-Meldung nachholen.
- **S2 — `playRichTone` (audio.js Z. 235) unverändert?** Suche im
  Diff: dort darf weder `_vibScale` noch `globalInstrumentVibrato`
  vorkommen. Nur `playRichToneProfile` (Z. 317ff) bekommt die
  Multiplikation.
- **S3 — Sind tatsächlich exakt 5 Vibrato-Buttons mit den Werten
  0, 25, 50, 75, 100 erzeugt?** Im Code-Block in test-ui.js die
  Array-Literal-Stelle prüfen.
- **S4 — Reset (file.js Z. ~63) auf 100?** `globalInstrumentVibrato`
  wird beim Reset auf 100 gesetzt, nicht auf 0 und nicht auf NaN.
- **S5 — i18n-Strings: jede `de.js`-Zeile hat eine analoge
  `en.js`-, `fr.js`-, `es.js`-Zeile?** Alle 22 Keys einmal über die
  vier Dateien checken (gleiches Set, kein Tippfehler im Key-Namen).
- **S6 — Anführungszeichen in i18n-Strings (Lessons learned aus
  Leitlinien):** Jeder String mit `"` als Begrenzung. Innen keine
  ASCII-`"` ohne Escape. Typographisches „…" innen ist OK.
  Stichprobe: alle Strings, die Klammern oder Anführungen enthalten.
- **S7 — `RICHTONE_PROFILES` ist im Scope, wenn `_hasProfileVibrato`
  beim Dialog-Aufbau läuft?** In js/audio.js wird die Konstante
  geladen, in test-ui.js abgefragt. Check: kein `ReferenceError`
  beim Öffnen des Dialogs.

---

## Hinweis nach Abschluß

Diese BA enthält ausnahmsweise alle vier Sprachen (Vorgabe des
Nutzers). Eine Folge-Mini-Anleitung „Übersetzungen für …" entfällt
deshalb.
