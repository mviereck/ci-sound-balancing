# Bauanleitung 273 — Gruppe „Experimentelle Töne" + Nachbarelektroden-Sinus + Sinus/Rauschen-Mischung

Zielversion nach Build: `0.4.273-beta`

## Worum es geht

In der Tonauswahl-Modalbox („Tonart wählen") wird **unten eine neue
Gruppe „Experimentelle Töne"** angehängt. Sie nimmt eine Versuchsreihe
auf, mit der der Nutzer den Mess-Stimulus im CI stabiler bekommen will.

Diese Anleitung baut die Gruppe und ihre **ersten drei Töne**:

1. **Sinus + Nachbarelektroden** (`neighborSine`) — reiner Sinus auf der
   Zielfrequenz, dazu die zwei direkt benachbarten Elektroden-
   Mittenfrequenzen auf halbem Pegel.
2. **Sinus + Rauschen 50/50** (`sineNoiseHalf`) — Sinus und adaptives
   Schmalbandrauschen je zur Hälfte gemischt.
3. **Sinus + Rauschen 100/50** (`sineNoiseFull`) — Sinus voll, Rauschen
   halb.

Die acht Cluster-Töne (mehrere dichte Frequenzen) kommen in der
**Folge-Anleitung BA 274** in dieselbe Gruppe.

**Wichtig:** Im Code ausschließlich ASCII-Anführungszeichen `"` und
`'`. Keine typografischen Quotes als String-Begrenzer.

---

## Schritt 1 — Drei Synthese-Funktionen in `js/audio.js`

Die neuen Töne fügen sich in das vorhandene Muster ein
(`playRichToneProfile`, `playNoiseAdaptiveTone`). Sie nutzen `applyCosRamp`
für die globale Hüllkurve und `runningSources` wie alle anderen.

**Einfügen direkt nach `playWobbleSweepTone` (endet ca. Z. 760), vor dem
Kommentar `// BA 225: zentrale Whitelist-Pruefung` (Z. 762).**

```js
// BA 273: Experimentelle Toene.
// neighborSine — Sinus auf der Zielfrequenz plus die beiden direkt
// benachbarten Elektroden-Mittenfrequenzen auf halbem Pegel. freqs ist
// die global an die aktive Seite gebundene Elektroden-Frequenztabelle
// (siehe getElectrodeBandwidth / state-side.js bindActiveSide). Amplituden
// werden gegen die Summe normalisiert, damit kein Clipping entsteht; das
// Verhaeltnis Hauptton:Nachbar (2:1) bleibt dabei erhalten.
function playNeighborSineTone(c, hz, vol, ms, pan, ramp = 50) {
  return new Promise((r) => {
    var tones = [{ f: hz, amp: 1.0 }];
    if (typeof freqs !== "undefined" && freqs && freqs.length >= 2) {
      var idx = 0, minDiff = Math.abs(freqs[0] - hz);
      for (var i = 1; i < freqs.length; i++) {
        var d = Math.abs(freqs[i] - hz);
        if (d < minDiff) { minDiff = d; idx = i; }
      }
      if (idx - 1 >= 0)           tones.push({ f: freqs[idx - 1], amp: 0.5 });
      if (idx + 1 < freqs.length) tones.push({ f: freqs[idx + 1], amp: 0.5 });
    }
    var total   = tones.reduce(function (s, t) { return s + t.amp; }, 0) || 1;
    var nyquist = c.sampleRate / 2 - 100;
    var g = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;
    var oscs = [];
    for (var k = 0; k < tones.length; k++) {
      if (tones[k].f <= 0 || tones[k].f >= nyquist) continue;
      var o  = c.createOscillator();
      var og = c.createGain();
      o.type = "sine";
      o.frequency.value = tones[k].f;
      og.gain.value = tones[k].amp / total;
      o.connect(og); og.connect(g);
      o.start();
      o.stop(c.currentTime + ms / 1000 + 0.01);
      oscs.push(o);
    }
    applyCosRamp(g, vol, c, ms, ramp);
    g.connect(p); p.connect(c.destination);
    for (var j = 0; j < oscs.length; j++) runningSources.push(oscs[j]);
    if (oscs.length > 0) oscs[0].onended = function () { r(); };
    else r();
  });
}

// sineNoiseMix — Sinus + adaptives Schmalbandrauschen. Das Rauschband
// folgt der Frequenz (Bandbreite via getElectrodeBandwidth, identisch zu
// playNoiseAdaptiveTone). sineLevel / noiseLevel sind Pegelfaktoren, die
// vor der gemeinsamen vol-Huellkurve wirken.
function playSineNoiseMixTone(c, hz, vol, ms, pan, sineLevel, noiseLevel, ramp = 50) {
  return new Promise((r) => {
    var envGain = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;

    var o  = c.createOscillator();
    var sg = c.createGain();
    o.type = "sine";
    o.frequency.value = hz;
    sg.gain.value = sineLevel;
    o.connect(sg); sg.connect(envGain);

    var bufLen = Math.ceil(c.sampleRate * (ms / 1000 + 0.05));
    var buf = c.createBuffer(1, bufLen, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource();
    src.buffer = buf;
    var bw = getElectrodeBandwidth(hz);
    var bp = c.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = hz;
    bp.Q.value = Math.max(0.5, hz / bw);
    var ng = c.createGain();
    ng.gain.value = noiseLevel;
    src.connect(bp); bp.connect(ng); ng.connect(envGain);

    applyCosRamp(envGain, vol, c, ms, ramp);
    envGain.connect(p); p.connect(c.destination);

    runningSources.push(o);
    runningSources.push(src);
    o.start(); src.start();
    o.stop(c.currentTime + ms / 1000 + 0.01);
    src.stop(c.currentTime + ms / 1000 + 0.01);
    o.onended = function () { r(); };
  });
}
```

## Schritt 2 — Töne in die Whitelist `_BASE_TONE_TYPES` aufnehmen

In `js/audio.js`, `_BASE_TONE_TYPES` (ca. Z. 765–772). Die letzte Zeile

```js
  "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
  "wobbleSweep"];
```

ersetzen durch:

```js
  "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
  "wobbleSweep",
  "neighborSine", "sineNoiseHalf", "sineNoiseFull"];
```

## Schritt 3 — Dispatcher in `playToneTyped` erweitern

In `js/audio.js`, `playToneTyped` (ca. Z. 820–841). **Direkt vor** der
Zeile

```js
  if (typeof toneType === "string" && toneType.startsWith("smplr:"))
```

einfügen:

```js
  if (toneType === "neighborSine")   return playNeighborSineTone(c, hz, vol, ms, pan, ramp);
  if (toneType === "sineNoiseHalf")  return playSineNoiseMixTone(c, hz, vol, ms, pan, 0.5, 0.5, ramp);
  if (toneType === "sineNoiseFull")  return playSineNoiseMixTone(c, hz, vol, ms, pan, 1.0, 0.5, ramp);
```

## Schritt 4 — Neue Gruppe in `js/tone-popup.js`

Im `GROUPS`-Array (Z. 49–114). Der letzte Eintrag ist die Noise-Gruppe
und endet so (Z. 105–114):

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

Den Abschluss `  }\n];` ersetzen durch ein Komma plus die neue Gruppe:

```js
  },
  {
    headKey: 'toneGroupExperimental',
    hintKey: 'toneGroupExperimentalHint',
    items: [
      ['neighborSine',  'toneNeighborSine',  'toneNeighborSineDesc'],
      ['sineNoiseHalf', 'toneSineNoiseHalf', 'toneSineNoiseHalfDesc'],
      ['sineNoiseFull', 'toneSineNoiseFull', 'toneSineNoiseFullDesc']
    ]
  }
];
```

(BA 274 fügt der `items`-Liste dieser Gruppe später die Cluster-Töne
hinzu.)

## Schritt 5 — i18n-Auflösung im Header-Button `js/test-ui.js`

In `_toneTypeKey`, im `map`-Objekt (Z. 88–106). Die Zeile

```js
    wobbleSweep: 'toneWobbleSweep'
  };
```

ersetzen durch:

```js
    wobbleSweep: 'toneWobbleSweep',
    neighborSine: 'toneNeighborSine',
    sineNoiseHalf: 'toneSineNoiseHalf', sineNoiseFull: 'toneSineNoiseFull'
  };
```

## Schritt 6 — Druck-Mapping in `js/print-md.js`

In `TONE_LABEL_KEY` (Z. 469–489). Die Zeile

```js
    wobbleSweep: "toneWobbleSweep"
  };
```

ersetzen durch:

```js
    wobbleSweep: "toneWobbleSweep",
    neighborSine: "toneNeighborSine",
    sineNoiseHalf: "toneSineNoiseHalf", sineNoiseFull: "toneSineNoiseFull"
  };
```

## Schritt 7 — Deutsche Texte in `i18n/de.js`

Im Tonart-Block, **nach** der Zeile `toneGroupNoiseHint: "..."` (Z. 1186)
einfügen. ASCII-Doppelquotes außen, typografische Quotes nur innerhalb
der Strings.

```js
    toneGroupExperimental:     "Experimentelle Töne",
    toneGroupExperimentalHint: "Versuchsreihe zum Stabilisieren des Mess-Tons im CI. Nicht für Routine-Messungen gedacht, sondern zum Vergleichen, welche Variante bei deinem Gerät am ruhigsten klingt.",
    toneNeighborSine:          "Sinus + Nachbarelektroden",
    toneNeighborSineDesc:      "Reiner Sinus auf der Zielfrequenz, dazu die beiden direkt benachbarten Elektroden-Mittenfrequenzen auf halbem Pegel. Soll den Ton im CI stabiler machen, indem die Nachbarbänder bewusst leicht mitlaufen.",
    toneSineNoiseHalf:         "Sinus + Rauschen 50/50",
    toneSineNoiseHalfDesc:     "Reiner Sinus und adaptives Schmalbandrauschen zu gleichen Teilen gemischt (je halber Pegel). Das Rauschband folgt der Frequenz (schmal bei tiefen, breiter bei hohen Tönen).",
    toneSineNoiseFull:         "Sinus + Rauschen 100/50",
    toneSineNoiseFullDesc:     "Reiner Sinus auf vollem Pegel, adaptives Schmalbandrauschen auf halbem Pegel dazugemischt.",
```

Die anderen Sprachdateien (`en.js`, `fr.js`, `es.js`) bleiben unberührt;
fehlende Keys fallen auf die deutschen Texte zurück.

## Schritt 8 — Version hochzählen

In `js/version.js`:

```js
const APP_VERSION = "0.4.273-beta";
```

---

## Akzeptanztest (Klick für Klick)

1. App neu laden (Cache-Bust durch die neue Version). Reiter **Implantat**
   öffnen, Knopf **„Elektroden über Töne anspielen"** klicken → die
   Tonauswahl-Modalbox geht auf.
2. Ganz nach unten scrollen → **unter** der Gruppe „Rauschsignale" steht
   eine neue Gruppe **„Experimentelle Töne"** mit dem Hinweistext und
   drei Knöpfen.
3. **„Sinus + Nachbarelektroden"** anklicken → Vorhören startet, es klingt
   wie ein Sinus mit etwas Fülle (die Nachbarn liegen leiser darunter/
   darüber). Kein Knacken, kein Fehler in der Konsole.
4. **„Sinus + Rauschen 50/50"** → man hört Sinus und Rauschen etwa gleich
   laut. **„Sinus + Rauschen 100/50"** → Sinus dominiert, Rauschen liegt
   leiser dahinter.
5. Maus über einen der Knöpfe halten → der Beschreibungs-Text erscheint
   als Tooltip.
6. Einen der neuen Töne wählen, **OK** drücken, dann eine Messung mit
   diesem Ton laufen lassen und in die **Druckvorschau** schauen → der
   gewählte Ton erscheint mit deutschem Namen (nicht als roher Schlüssel
   wie „neighborSine").
7. Browser-Konsole: keine Fehler beim Öffnen des Modals und beim Vorhören.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung **jedes** Akzeptanzkriterium einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe.
Zusätzlich prüfen, dass **jeder** der drei neuen Ton-Schlüssel an **allen
sechs** Stellen eingetragen ist (sonst wird ein Ton inkonsistent
behandelt — genau dieser Fehler ist bei `richCiG`/`richCiS` in
`_BASE_TONE_TYPES` schon einmal passiert):

| Ton-Schlüssel | `_BASE_TONE_TYPES` | `playToneTyped` | `GROUPS` | `_toneTypeKey` | `TONE_LABEL_KEY` | `de.js` Label+Desc |
|---|---|---|---|---|---|---|
| `neighborSine`  | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sineNoiseHalf` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |
| `sineNoiseFull` | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ |

Wenn etwas als „unklar" markiert wird: Rückfrage stellen, nicht still
annehmen.

## Hinweis

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen, wenn der
Nutzer dazu auffordert.
