# BA 225 — Mellotron + Soundfont2 als Tonart-Eintraege

## Ziel

Smplr-Sampler-Klaenge (Mellotron, Soundfont2) sind ab dieser BA als
normale Tonart-Eintraege in der bestehenden Tonart-Modalbox
auswaehlbar. Der Vorhoer-Knopf rechts neben jedem Eintrag spielt
seine Default-Sequenz wie bisher, dann aber mit Sampler-Klang. Die
Klaviatur in der Modalbox kommt erst in BA 226 — diese BA aendert
das Modalbox-Layout nicht.

Voraussetzung: BA 224 ist gebaut (`js/smplr-loader.js`,
`vendors/smplr/dist/smplr.esm.js`, `vendors/soundfont2/lib/SoundFont2.js`,
Version 3.2.224-beta).

Versionsbump: 3.2.224-beta -> 3.2.225-beta.

## Konventionen

- **Token-Schema** (festgelegt in BA 224):
  - Mellotron-Variante: `"smplr:mellotron:<variantName>"`
    (variantName aus `getMellotronNames()` aus dem smplr-Modul,
    z. B. `"smplr:mellotron:TRON FLUTE"`).
  - Soundfont2-Datei: `"smplr:sf2:<key>"` mit
    `key` in `{"galaxy","gigaMidi","supersaw"}`.
- **Pan**: smplr unterstuetzt Pan nur global pro Sampler-Instance via
  `instance.output.pan`. Wir setzen den Pan vor jedem `start()`.
  Bei kurzen sequenziellen Aufrufen (Vorhoer, Verfahren-Trial) ist
  das ausreichend. Wenn ein simul-Aufruf links+rechts GLEICHZEITIG
  einen Sampler-Ton braucht, wird der Pan-Wert des zuerst gestarteten
  Tons vom zweiten ueberschrieben — bekannte Einschraenkung, in BA
  225 NICHT loesen, nur in der "Bekannte Einschraenkungen"-Sektion
  des Akzeptanztests erwaehnen.
- **Velocity**: Wir lassen smplr-Velocity beim Default (100) und
  regeln Lautstaerke ueber `instance.output.volume` (MIDI 0-127),
  abgeleitet aus dem bestehenden `vol`-Parameter
  (`Math.round(vol * 127)`).
- **Default-Instrument bei SF2**: BA 224 hat den Loader schon so
  gebaut, dass `loadSoundfont2()` automatisch `instrumentNames[0]`
  laedt. Wir verlassen uns darauf — keine Sub-Instrument-Wahl in
  dieser BA.

## Schritt 1 — Helfer und smplr-Branch in `js/audio.js`

In `js/audio.js` direkt VOR der bestehenden Funktion `playToneTyped`
(aktuell Z. 626) zwei neue Top-Level-Funktionen einfuegen.

**Einzufuegen vor Z. 626 (`function playToneTyped`)**:

```js
// BA 225: zentrale Whitelist-Pruefung fuer toneType-Strings.
// Wird von file.js und init.js statt der lokalen VALID_TONE_TYPES-Arrays
// verwendet.
const _BASE_TONE_TYPES = ["sine", "complex", "pulsedComplex", "richTone",
  "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
  "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
  "richVc", "richHn",
  "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
  "wobbleSweep"];

const _SMPLR_SF2_VALID_KEYS = ["galaxy", "gigaMidi", "supersaw"];

function isValidToneType(tt) {
  if (typeof tt !== "string" || tt.length === 0) return false;
  if (_BASE_TONE_TYPES.includes(tt)) return true;
  if (tt.startsWith("smplr:mellotron:")) {
    return tt.length > "smplr:mellotron:".length;
  }
  if (tt.startsWith("smplr:sf2:")) {
    const key = tt.substring("smplr:sf2:".length);
    return _SMPLR_SF2_VALID_KEYS.includes(key);
  }
  return false;
}

// BA 225: Sampler-Wiedergabe via smplr (Mellotron, Soundfont2).
// hz -> naechste MIDI-Note + Cent-Detune
// vol (0..1) -> instance.output.volume (0..127)
// pan (-1..+1) -> instance.output.pan vor jedem start()
// ms -> duration (Sekunden)
// Wenn der Sampler noch nicht geladen ist: Lade-Trigger anstossen,
// Promise.resolve() ohne Tonwiedergabe zurueckgeben. UI-Hinweis "Laedt..."
// kommt erst in BA 226 (Klaviatur-Widget); hier passiert lautlos nichts.
function _playSmplrTone(c, hz, vol, ms, pan, token) {
  if (typeof loadSamplerByToken !== "function" || typeof smplrSamplerIsReady !== "function") {
    // BA 224 nicht installiert — stiller Fallback
    return Promise.resolve();
  }
  if (!smplrSamplerIsReady(token)) {
    // Lade-Trigger ausloesen, ohne auf Fertigstellung zu warten.
    loadSamplerByToken(c, token).catch(function () { /* swallow */ });
    return Promise.resolve();
  }
  // Sampler ist geladen — Synchroner Pfad
  let instance;
  try {
    // loadSamplerByToken liefert bei Cache-Hit synchron, aber via Promise.resolve()
    // Wir holen die Instance ueber den Cache via erneutem load (cached).
    // Da Cache-Hit, ist Promise sofort aufgeloest und wir verwenden .then().
    return loadSamplerByToken(c, token).then(function (inst) {
      if (!inst || typeof inst.start !== "function") return;
      // Pan + Lautstaerke vor start setzen
      try {
        if (inst.output) {
          inst.output.pan = Math.max(-1, Math.min(1, pan || 0));
          inst.output.volume = Math.max(0, Math.min(127, Math.round((vol || 0) * 127)));
        }
      } catch (e) { /* swallow — defensive */ }
      // Hz -> MIDI + Cent-Detune
      const midiFloat = 69 + 12 * Math.log2(Math.max(1, hz) / 440);
      const midiNote = Math.round(midiFloat);
      const detuneCents = Math.round((midiFloat - midiNote) * 100);
      try {
        inst.start({
          note: midiNote,
          velocity: 100,
          detune: detuneCents,
          duration: Math.max(0.05, (ms || 500) / 1000)
        });
      } catch (e) { /* swallow */ }
    });
  } catch (e) {
    return Promise.resolve();
  }
}
```

Anschliessend in der bestehenden `playToneTyped`-Funktion (jetzt
weiterhin etwa bei Z. 626 + Anzahl eingefuegter Zeilen) einen neuen
Branch direkt VOR dem letzten `return playSineTone(...)`-Fallback
einfuegen.

**Vorher** (in `playToneTyped`, ca. Z. 643-644):
```js
  if (toneType === "wobbleSweep")    return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}
```

**Nachher**:
```js
  if (toneType === "wobbleSweep")    return playWobbleSweepTone(c, hz, vol, ms, pan, ramp);
  if (typeof toneType === "string" && toneType.startsWith("smplr:"))
    return _playSmplrTone(c, hz, vol, ms, pan, toneType);
  return playSineTone(c, hz, vol, ms, pan, ramp);
}
```

Wichtig: KEINE Aenderungen an den bestehenden Tonart-Branches —
nur ein neuer Branch dazu.

## Schritt 2 — Whitelist in `js/file.js` ueber Helfer

In `js/file.js` die lokale `VALID_TONE_TYPES`-Konstante (Z. 592-597)
durch Helfer-Aufrufe ersetzen.

**Vorher** (Z. 592-599):
```js
  const VALID_TONE_TYPES = ["sine", "complex", "pulsedComplex", "richTone",
    "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
    "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
    "richVc", "richHn",
    "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
    "wobbleSweep"];
  globalToneType = VALID_TONE_TYPES.includes(d.globalToneType)
    ? d.globalToneType : "complex";
```

**Nachher**:
```js
  // BA 225: Whitelist-Check ausgelagert nach audio.js (isValidToneType).
  globalToneType = isValidToneType(d.globalToneType)
    ? d.globalToneType : "complex";
```

Und Z. 605/607 entsprechend anpassen:

**Vorher**:
```js
  if (typeof toneType_freqmatch !== "undefined") {
    if (VALID_TONE_TYPES.includes(d.toneType_freqmatch)) {
      toneType_freqmatch = d.toneType_freqmatch;
    } else if (VALID_TONE_TYPES.includes(d.globalToneType)) {
      toneType_freqmatch = d.globalToneType;
    } else {
      toneType_freqmatch = "pulsedComplex";
    }
  }
```

**Nachher**:
```js
  if (typeof toneType_freqmatch !== "undefined") {
    if (isValidToneType(d.toneType_freqmatch)) {
      toneType_freqmatch = d.toneType_freqmatch;
    } else if (isValidToneType(d.globalToneType)) {
      toneType_freqmatch = d.globalToneType;
    } else {
      toneType_freqmatch = "pulsedComplex";
    }
  }
```

## Schritt 3 — Whitelist in `js/init.js` ueber Helfer

Analog in `js/init.js` die lokale `_VALID_TT`-Konstante (Z. 773-778).

**Vorher** (Z. 773-784):
```js
      // BA 209: Per-Test-Tonart Frequenzabgleich (Auto-Restore).
      const _VALID_TT = ["sine", "complex", "pulsedComplex", "richTone",
        "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
        "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
        "richVc", "richHn",
        "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
        "wobbleSweep"];
      if (typeof toneType_freqmatch !== "undefined") {
        if (_VALID_TT.includes(d.toneType_freqmatch)) {
          toneType_freqmatch = d.toneType_freqmatch;
        } else if (_VALID_TT.includes(d.globalToneType)) {
          toneType_freqmatch = d.globalToneType;
        }
      }
```

**Nachher**:
```js
      // BA 209 + BA 225: Per-Test-Tonart Frequenzabgleich (Auto-Restore).
      // Whitelist-Check via isValidToneType in audio.js.
      if (typeof toneType_freqmatch !== "undefined") {
        if (isValidToneType(d.toneType_freqmatch)) {
          toneType_freqmatch = d.toneType_freqmatch;
        } else if (isValidToneType(d.globalToneType)) {
          toneType_freqmatch = d.globalToneType;
        }
      }
```

## Schritt 4 — Modalbox-GROUPS erweitern (`js/test-ui.js`)

In `js/test-ui.js` in der Funktion `_openToneTypeDialog` (Z. 2310)
das `GROUPS`-Array (Z. 2311-2361) um zwei neue Gruppen am Ende
erweitern.

**Aktueller Stand am Ende des GROUPS-Arrays** (Z. 2352-2361):
```js
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
```

**Erweitert** (zwei neue Gruppen direkt vor dem schliessenden `];`
einfuegen, mit Komma nach dem `Noise`-Block):

```js
    {
      headKey: 'toneGroupNoise',
      hintKey: 'toneGroupNoiseHint',
      items: [
        ['noise',         'toneNoise',         'toneNoiseDesc'],
        ['noiseAdaptive', 'toneNoiseAdaptive', 'toneNoiseAdaptiveDesc'],
        ['irn',           'toneIRN',           'toneIRNDesc']
      ]
    },
    {
      headKey: 'toneGroupSf2',
      hintKey: 'toneGroupSf2Hint',
      items: [
        ['smplr:sf2:galaxy',   'toneSmplrGalaxy',   'toneSmplrGalaxyDesc'],
        ['smplr:sf2:gigaMidi', 'toneSmplrGigaMidi', 'toneSmplrGigaMidiDesc'],
        ['smplr:sf2:supersaw', 'toneSmplrSupersaw', 'toneSmplrSupersawDesc']
      ]
    },
    {
      headKey: 'toneGroupMellotron',
      hintKey: 'toneGroupMellotronHint',
      items: [
        ['smplr:mellotron:300 STRINGS CELLO', null, null],
        ['smplr:mellotron:300 STRINGS VIOLA', null, null],
        ['smplr:mellotron:8VOICE CHOIR',      null, null],
        ['smplr:mellotron:BASSA+STRNGS',      null, null],
        ['smplr:mellotron:BOYS CHOIR',        null, null],
        ['smplr:mellotron:CHA CHA FLT',       null, null],
        ['smplr:mellotron:CHM CLARINET',      null, null],
        ['smplr:mellotron:CHMB 3 VLNS',       null, null],
        ['smplr:mellotron:CHMB ALTOSAX',      null, null],
        ['smplr:mellotron:CHMB FEMALE',       null, null],
        ['smplr:mellotron:CHMB MALE VC',      null, null],
        ['smplr:mellotron:CHMB TNR SAX',      null, null],
        ['smplr:mellotron:CHMB TRMBONE',      null, null],
        ['smplr:mellotron:CHMB TRUMPET',      null, null],
        ['smplr:mellotron:CHMBLN CELLO',      null, null],
        ['smplr:mellotron:CHMBLN FLUTE',      null, null],
        ['smplr:mellotron:CHMBLN OBOE',       null, null],
        ['smplr:mellotron:DIXIE+TRMBN',       null, null],
        ['smplr:mellotron:FOXTROT+SAX',       null, null],
        ['smplr:mellotron:HALFSP.BRASS',      null, null],
        ['smplr:mellotron:MIXED STRGS',       null, null],
        ['smplr:mellotron:MKII BRASS',        null, null],
        ['smplr:mellotron:MKII GUITAR',       null, null],
        ['smplr:mellotron:MKII ORGAN',        null, null],
        ['smplr:mellotron:MKII SAX',          null, null],
        ['smplr:mellotron:MKII VIBES',        null, null],
        ['smplr:mellotron:MKII VIOLINS',      null, null],
        ['smplr:mellotron:MOVE BS+STGS',      null, null],
        ['smplr:mellotron:STRGS+BRASS',       null, null],
        ['smplr:mellotron:TROMB+TRMPT',       null, null],
        ['smplr:mellotron:TRON 16VLNS',       null, null],
        ['smplr:mellotron:TRON CELLO',        null, null],
        ['smplr:mellotron:TRON FLUTE',        null, null],
        ['smplr:mellotron:TRON VIOLA',        null, null]
      ]
    }
  ];
```

Wichtige Stelle in der Render-Schleife (Z. 2415-2462): die Items
verarbeiten `[key, i18nKey, descKey]`. Die Mellotron-Items haben
`i18nKey = null` — die Render-Schleife liefert dann ein leeres
Label. Damit der Variant-Name trotzdem sichtbar ist, muss in der
Render-Schleife eine Fallback-Logik dazu: wenn `i18nKey` `null` ist,
zeige den Teil des Keys nach dem letzten `:` als Label.

**Zu aendern** in der Render-Schleife (aktuell Z. 2430-2434):

**Vorher**:
```js
      var nameLine = document.createElement('span');
      var nameSpan = document.createElement('span');
      nameSpan.dataset.t = i18nKey;
      nameSpan.style.cssText = 'font-size:.94em;';
      nameLine.appendChild(nameSpan);
```

**Nachher**:
```js
      var nameLine = document.createElement('span');
      var nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-size:.94em;';
      if (i18nKey) {
        nameSpan.dataset.t = i18nKey;
      } else {
        // BA 225: Fallback fuer Eintraege ohne i18n-Key (z. B. Mellotron-Varianten):
        // letzten Token-Teil als Label anzeigen.
        var lastColon = key.lastIndexOf(':');
        nameSpan.textContent = lastColon >= 0 ? key.substring(lastColon + 1) : key;
      }
      nameLine.appendChild(nameSpan);
```

## Schritt 5 — i18n-Strings (4 Sprachen)

Da nur wenige Strings, alle vier Sprachen direkt mitnehmen.

In `i18n/de.js` an einer thematisch passenden Stelle (bei den anderen
`toneGroup...`-Keys) ergaenzen:

```js
  toneGroupSf2: "Soundfont-Sampler",
  toneGroupSf2Hint: "Externe SF2-Sample-Pakete (laden beim ersten Anschlag).",
  toneSmplrGalaxy: "Galaxy E-Pianos",
  toneSmplrGalaxyDesc: "Sammlung verschiedener Rhodes-/Wurlitzer-Klaenge.",
  toneSmplrGigaMidi: "Giga HQ FM GM",
  toneSmplrGigaMidiDesc: "Allgemeines MIDI-Set mit klarem FM-Charakter.",
  toneSmplrSupersaw: "Supersaw Collection",
  toneSmplrSupersawDesc: "Trance-typische Saegezahn-Synthesizer-Sounds.",
  toneGroupMellotron: "Mellotron-Sampler",
  toneGroupMellotronHint: "Klangbibliothek aus dem Original-Mellotron (laden beim ersten Anschlag).",
```

In `i18n/en.js` an der entsprechenden Stelle:

```js
  toneGroupSf2: "Soundfont samplers",
  toneGroupSf2Hint: "External SF2 sample packs (load on first key press).",
  toneSmplrGalaxy: "Galaxy E-Pianos",
  toneSmplrGalaxyDesc: "Collection of various Rhodes/Wurlitzer sounds.",
  toneSmplrGigaMidi: "Giga HQ FM GM",
  toneSmplrGigaMidiDesc: "General MIDI set with clear FM character.",
  toneSmplrSupersaw: "Supersaw Collection",
  toneSmplrSupersawDesc: "Trance-style sawtooth synthesizer sounds.",
  toneGroupMellotron: "Mellotron samplers",
  toneGroupMellotronHint: "Sample library from the original Mellotron (loads on first key press).",
```

In `i18n/fr.js`:

```js
  toneGroupSf2: "Echantillonneurs Soundfont",
  toneGroupSf2Hint: "Banques d'echantillons SF2 externes (chargees au premier appui).",
  toneSmplrGalaxy: "Galaxy E-Pianos",
  toneSmplrGalaxyDesc: "Collection de sons Rhodes/Wurlitzer varies.",
  toneSmplrGigaMidi: "Giga HQ FM GM",
  toneSmplrGigaMidiDesc: "Banque General MIDI au caractere FM marque.",
  toneSmplrSupersaw: "Supersaw Collection",
  toneSmplrSupersawDesc: "Sons synthetiseur en dents de scie style trance.",
  toneGroupMellotron: "Echantillonneurs Mellotron",
  toneGroupMellotronHint: "Bibliotheque de sons du Mellotron original (chargee au premier appui).",
```

In `i18n/es.js`:

```js
  toneGroupSf2: "Samplers Soundfont",
  toneGroupSf2Hint: "Paquetes de muestras SF2 externos (se cargan al primer pulsado).",
  toneSmplrGalaxy: "Galaxy E-Pianos",
  toneSmplrGalaxyDesc: "Coleccion de sonidos Rhodes/Wurlitzer variados.",
  toneSmplrGigaMidi: "Giga HQ FM GM",
  toneSmplrGigaMidiDesc: "Banco General MIDI con caracter FM marcado.",
  toneSmplrSupersaw: "Supersaw Collection",
  toneSmplrSupersawDesc: "Sonidos de sintetizador en diente de sierra estilo trance.",
  toneGroupMellotron: "Samplers Mellotron",
  toneGroupMellotronHint: "Biblioteca de sonidos del Mellotron original (se carga al primer pulsado).",
```

Die 34 Mellotron-Variant-Namen bleiben **bewusst englisch** (Original-
Bezeichnungen wie "TRON FLUTE") — kein i18n-Key. Der Fallback aus
Schritt 4 zeigt sie direkt an.

## Schritt 6 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.225-beta";
```

## Schritt 7 — `docs/CODESTRUKTUR.md`

In den Eintraegen zu `audio.js` (vermutlich Eintrag Nr. 7 oder
aehnlich, suchen mit `grep -n "audio.js" docs/CODESTRUKTUR.md`) am
Ende der Beschreibung anhaengen:

```
BA 225: globale Helfer `isValidToneType(tt)` (Whitelist + smplr:-Prefix-Check),
`_playSmplrTone(c, hz, vol, ms, pan, token)` und neuer `smplr:`-Branch in
`playToneTyped`. file.js und init.js nutzen `isValidToneType` statt eigener Arrays.
```

In den Eintraegen zu `test-ui.js` analog ergaenzen:

```
BA 225: `GROUPS` in `_openToneTypeDialog` um zwei Gruppen erweitert
(`toneGroupSf2` mit 3 SF2-Keys, `toneGroupMellotron` mit 34 Variants).
Render-Schleife mit Fallback fuer Items ohne i18nKey (zeigt letzten
Token-Teil als Label).
```

## Schritt 8 — `docs/spec/02-messung.md`

In der Beschreibung des Frequenzabgleich-Sub-Tabs (oder im Abschnitt
zur Tonart-Auswahl, je nachdem wo die bestehende Liste dokumentiert
ist) einen Hinweis ergaenzen, dass die Tonart-Liste seit Version
3.2.225 zwei zusaetzliche Gruppen enthaelt:

- **Soundfont-Sampler**: 3 SF2-Pakete (Galaxy E-Pianos, Giga HQ FM GM,
  Supersaw Collection), laden beim ersten Anschlag von externer URL
  (`smpldsnds.github.io`).
- **Mellotron-Sampler**: 34 Original-Mellotron-Varianten, ebenfalls
  Lazy-Load von externer URL.

Falls kein passender Abschnitt existiert, einen kurzen Block "Sampler-
Tonarten" hinten anhaengen.

## Was diese BA NICHT macht

- Keine Klaviatur in der Modalbox (das ist BA 226).
- Keine Aenderung der `_playPreview`-Funktion — Vorhoer-Knopf
  spielt weiterhin die Default-Sequenz aus `cfg.getPreviewSequence()`,
  jetzt aber mit Sampler-Klang sobald geladen.
- Kein `keyboardMode`-Parameter in der testUI-API (kommt mit BA 226).
- Kein UI-Hinweis "Laedt..." beim ersten Anschlag — der erste Vorhoer
  einer noch-nicht-geladenen Tonart bleibt einfach stumm; der zweite
  Vorhoer klingt nach Sampler-Load.

## Akzeptanztest (Nutzer)

1. Tool laden, Version-Label oben rechts zeigt `3.2.225-beta`.
2. Tab Messungen -> Frequenzabgleich -> auf den Tonart-Button
   klicken (oeffnet die Tonart-Modalbox).
3. In der Modalbox sind unten zwei neue Gruppen sichtbar:
   - "Soundfont-Sampler" (3 Eintraege)
   - "Mellotron-Sampler" (34 Eintraege, englische Originalnamen)
4. Vorhoer "Galaxy E-Pianos" anklicken -> beim ERSTEN Klick passiert
   nichts hoerbares (Sampler laedt im Hintergrund, dauert 5-30 s je
   nach Netzwerk). Konsole zeigt keine Errors.
5. Nach ~30 s erneut Vorhoer "Galaxy E-Pianos" -> jetzt klingt es
   nach E-Piano (Default-Frequenz-Sequenz).
6. Vorhoer "TRON FLUTE" anklicken -> erste Anspielung stumm,
   nach 2-10 s zweite Anspielung klingt nach Floete.
7. OK in der Modalbox klicken -> gewaehlte Tonart bleibt aktiv.
8. Im Frequenzabgleich (Slider Round) auf "Test starten" -> Trial
   spielt mit Sampler-Klang (sofern bereits geladen) oder stumm
   (wenn nicht); Verhalten ist konsistent zum Modalbox-Vorhoer.
9. Datei speichern (Speichern-Button) -> JSON enthaelt
   `toneType_freqmatch: "smplr:..."`. Mit anderem Editor pruefbar.
10. Datei neu laden -> Tonart wird korrekt wiederhergestellt
    (Modalbox zeigt sie als gewaehlt an).
11. **Regression**: Alle bisherigen Tonarten (Sinus, Komplex, Pulsed,
    Rich-Profile, Noise, IRN) funktionieren wie vor BA 225 — Vorhoer
    klingt, Verfahrens-Trials klingen.

**Bekannte Einschraenkungen** (keine Bugs, in BA 226+ adressiert):
- Stumme erste Anspielung bei nicht-geladenem Sampler ist beabsichtigt.
- Pan-Konflikt bei simul-Aufrufen (beidseitig CI mit smplr-Tonart und
  gleichzeitigem Beidseits-Modus) — der Pan-Wert des ersten Tons wird
  vom zweiten ueberschrieben. Nur relevant fuer beidseitig CI;
  Einzelseiten-Verfahren sind nicht betroffen.

## Selbstprueffungs-Auftrag an Sonnet

VOR der Fertig-Meldung jede Akzeptanz-Kriterie aus der Checkliste
(1-11) einzeln berichten:

- Kriterium 1-11: erfuellt / nicht erfuellt / unklar (mit Datei- und
  Zeilenangabe).
- Zusatz: `js/version.js` enthaelt `"3.2.225-beta"`.
- Zusatz: `js/audio.js` enthaelt am Beginn (vor `playToneTyped`) die
  drei neuen Top-Level-Symbole `_BASE_TONE_TYPES`, `_SMPLR_SF2_VALID_KEYS`,
  `isValidToneType`, `_playSmplrTone`. Zeilen nennen.
- Zusatz: `playToneTyped` enthaelt den neuen `smplr:`-Branch zwischen
  `wobbleSweep` und `playSineTone`-Fallback. Zeile nennen.
- Zusatz: `js/file.js` Z. ~592-597 enthaelt KEINE `VALID_TONE_TYPES`-
  Konstante mehr; statt dessen `isValidToneType`-Aufrufe. Zeile nennen.
- Zusatz: `js/init.js` Z. ~773-778 enthaelt KEINE `_VALID_TT`-Konstante
  mehr; statt dessen `isValidToneType`-Aufrufe. Zeile nennen.
- Zusatz: `js/test-ui.js` `_openToneTypeDialog` `GROUPS`-Array enthaelt
  zwei neue Gruppen mit den richtigen `headKey`-Werten und der korrekten
  Anzahl Items (3 fuer Sf2, 34 fuer Mellotron). Zeile nennen.
- Zusatz: Render-Schleife in `_openToneTypeDialog` hat den i18nKey-
  Fallback. Zeile nennen.
- Zusatz: Alle vier i18n-Dateien (`de.js`, `en.js`, `fr.js`, `es.js`)
  enthalten die 10 neuen Keys. Eine Stichprobe pro Datei nennen.

Wenn etwas als "unklar" oder "nicht erfuellt" markiert ist: STOP und
beim Nutzer rueckfragen, statt selbst zu reparieren.

## Nach Abschluss manuell pruefen (Zwischenpruefung)

- Versionslabel zeigt `3.2.225-beta`.
- Modalbox zeigt 6 Gruppen statt 4 (Sinus, Komplex, Rich, Noise,
  Soundfont-Sampler, Mellotron-Sampler).
- Vorhoer einer Sampler-Tonart bewirkt nach kurzem Vorlauf einen
  hoerbaren Klang.
- Bestehende Tonarten unveraendert.
- Anschliessend kann BA 226 starten.

## Mini-Klaerung vor BA-Start (falls Sonnet darauf trifft)

Wenn Sonnet beim Lesen des Codes feststellt, dass `isValidToneType`
in `js/file.js` oder `js/init.js` bereits eingesetzt wird (z. B. weil
eine fruehere BA das schon umgestellt hat), STOP und beim Nutzer
rueckfragen, ob die Stelle uebersprungen werden soll. Nicht
stillschweigend zweimal die gleiche Aenderung machen.

Aehnlich: Wenn die Mellotron-Liste im smplr-Modul von 34 Eintraegen
abweicht (neuere smplr-Version), STOP und rueckfragen.
