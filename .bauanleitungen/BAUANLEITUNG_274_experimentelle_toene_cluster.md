# Bauanleitung 274 — Experimentelle Töne: Cluster (mehrere dichte Frequenzen)

Zielversion nach Build: `0.4.274-beta`

**Voraussetzung:** BA 273 ist gebaut (die Gruppe „Experimentelle Töne"
existiert bereits in `js/tone-popup.js`, und das Eintrags-Muster über die
sechs Stellen ist etabliert).

## Worum es geht

Acht weitere Töne in die Gruppe **„Experimentelle Töne"**: jeweils die
Zielfrequenz plus mehrere **eng benachbarte Nebenfrequenzen**, die
gleichzeitig klingen. Dicht beieinanderliegende Frequenzen erzeugen eine
**Schwebung** — ein Experiment, ob das den Ton im CI fülliger/stabiler
macht.

Zwei Achsen, je in zwei Stufen, in zwei Einheiten:

- **Abstand in Hertz** (feste Schwebungsgeschwindigkeit über alle
  Tonhöhen): ±3 Hz, ±8 Hz
- **Abstand in Cent** (proportional zur Tonhöhe): ±10 ct, ±30 ct
- **Anzahl Nebentöne**: 2 (einer drüber, einer drunter) oder 4 (zwei
  drüber, zwei drunter, in Vielfachen des Abstands)

Daraus acht Töne:

| Schlüssel | Einheit | Abstand | Nebentöne |
|---|---|---|---|
| `clusterHz2x3`    | Hz   | 3 Hz  | 2 |
| `clusterHz4x3`    | Hz   | 3 Hz  | 4 |
| `clusterHz2x8`    | Hz   | 8 Hz  | 2 |
| `clusterHz4x8`    | Hz   | 8 Hz  | 4 |
| `clusterCent2x10` | Cent | 10 ct | 2 |
| `clusterCent4x10` | Cent | 10 ct | 4 |
| `clusterCent2x30` | Cent | 30 ct | 2 |
| `clusterCent4x30` | Cent | 30 ct | 4 |

Alle Teiltöne (Zielfrequenz + Nebentöne) sind **gleich laut** (gegen die
Summe normalisiert), damit die Schwebung voll durchmoduliert. Sehr tiefe
Nebenfrequenzen werden bei 20 Hz abgefangen.

**Wichtig:** Im Code ausschließlich ASCII-Anführungszeichen `"` und `'`.

---

## Schritt 1 — Cluster-Synthese in `js/audio.js`

**Einfügen direkt nach `playSineNoiseMixTone`** (aus BA 273), vor dem
Kommentar `// BA 225: zentrale Whitelist-Pruefung`.

```js
// BA 274: Cluster — Zielfrequenz plus count eng benachbarte
// Nebenfrequenzen, je count/2 ober- und unterhalb. unit "hz": fester
// Hz-Abstand (Schwebung mit gleichem Tempo ueber alle Tonhoehen). unit
// "cent": proportionaler Abstand. Alle Teiltoene gleich laut (gegen die
// Summe normalisiert). Sehr tiefe Nebenfrequenzen werden bei MIN_HZ
// abgefangen, zu hohe (ueber Nyquist) weggelassen.
function playClusterTone(c, hz, vol, ms, pan, count, spacing, unit, ramp = 50) {
  return new Promise((r) => {
    var MIN_HZ  = 20;
    var nyquist = c.sampleRate / 2 - 100;
    var freqList = [hz];
    var half = Math.floor(count / 2);
    for (var k = 1; k <= half; k++) {
      var up, dn;
      if (unit === "cent") {
        up = hz * Math.pow(2,  (k * spacing) / 1200);
        dn = hz * Math.pow(2, -(k * spacing) / 1200);
      } else {
        up = hz + k * spacing;
        dn = hz - k * spacing;
      }
      freqList.push(up);
      freqList.push(dn);
    }
    var g = c.createGain();
    var p = c.createStereoPanner();
    p.pan.value = pan;
    var amp = 1 / freqList.length;
    var oscs = [];
    for (var i = 0; i < freqList.length; i++) {
      var f = freqList[i];
      if (f < MIN_HZ || f >= nyquist) continue;
      var o  = c.createOscillator();
      var og = c.createGain();
      o.type = "sine";
      o.frequency.value = f;
      og.gain.value = amp;
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
```

## Schritt 2 — Whitelist `_BASE_TONE_TYPES` erweitern

In `js/audio.js`. Nach BA 273 endet die Liste mit:

```js
  "wobbleSweep",
  "neighborSine", "sineNoiseHalf", "sineNoiseFull"];
```

ersetzen durch:

```js
  "wobbleSweep",
  "neighborSine", "sineNoiseHalf", "sineNoiseFull",
  "clusterHz2x3", "clusterHz4x3", "clusterHz2x8", "clusterHz4x8",
  "clusterCent2x10", "clusterCent4x10", "clusterCent2x30", "clusterCent4x30"];
```

## Schritt 3 — Dispatcher in `playToneTyped` erweitern

In `js/audio.js`. Nach BA 273 stehen dort die drei `neighborSine`/
`sineNoise…`-Zeilen. **Direkt darunter** (weiterhin vor der
`startsWith("smplr:")`-Zeile) einfügen:

```js
  if (toneType === "clusterHz2x3")    return playClusterTone(c, hz, vol, ms, pan, 2, 3,  "hz",   ramp);
  if (toneType === "clusterHz4x3")    return playClusterTone(c, hz, vol, ms, pan, 4, 3,  "hz",   ramp);
  if (toneType === "clusterHz2x8")    return playClusterTone(c, hz, vol, ms, pan, 2, 8,  "hz",   ramp);
  if (toneType === "clusterHz4x8")    return playClusterTone(c, hz, vol, ms, pan, 4, 8,  "hz",   ramp);
  if (toneType === "clusterCent2x10") return playClusterTone(c, hz, vol, ms, pan, 2, 10, "cent", ramp);
  if (toneType === "clusterCent4x10") return playClusterTone(c, hz, vol, ms, pan, 4, 10, "cent", ramp);
  if (toneType === "clusterCent2x30") return playClusterTone(c, hz, vol, ms, pan, 2, 30, "cent", ramp);
  if (toneType === "clusterCent4x30") return playClusterTone(c, hz, vol, ms, pan, 4, 30, "cent", ramp);
```

## Schritt 4 — Cluster-Töne der Gruppe in `js/tone-popup.js` hinzufügen

In der Gruppe `toneGroupExperimental` (aus BA 273) die `items`-Liste
erweitern. Sie sieht nach BA 273 so aus:

```js
    items: [
      ['neighborSine',  'toneNeighborSine',  'toneNeighborSineDesc'],
      ['sineNoiseHalf', 'toneSineNoiseHalf', 'toneSineNoiseHalfDesc'],
      ['sineNoiseFull', 'toneSineNoiseFull', 'toneSineNoiseFullDesc']
    ]
```

ersetzen durch:

```js
    items: [
      ['neighborSine',  'toneNeighborSine',  'toneNeighborSineDesc'],
      ['sineNoiseHalf', 'toneSineNoiseHalf', 'toneSineNoiseHalfDesc'],
      ['sineNoiseFull', 'toneSineNoiseFull', 'toneSineNoiseFullDesc'],
      ['clusterHz2x3',    'toneClusterHz2x3',    'toneClusterHz2x3Desc'],
      ['clusterHz4x3',    'toneClusterHz4x3',    'toneClusterHz4x3Desc'],
      ['clusterHz2x8',    'toneClusterHz2x8',    'toneClusterHz2x8Desc'],
      ['clusterHz4x8',    'toneClusterHz4x8',    'toneClusterHz4x8Desc'],
      ['clusterCent2x10', 'toneClusterCent2x10', 'toneClusterCent2x10Desc'],
      ['clusterCent4x10', 'toneClusterCent4x10', 'toneClusterCent4x10Desc'],
      ['clusterCent2x30', 'toneClusterCent2x30', 'toneClusterCent2x30Desc'],
      ['clusterCent4x30', 'toneClusterCent4x30', 'toneClusterCent4x30Desc']
    ]
```

## Schritt 5 — i18n-Auflösung `_toneTypeKey` in `js/test-ui.js`

Im `map`-Objekt. Nach BA 273 endet es mit:

```js
    neighborSine: 'toneNeighborSine',
    sineNoiseHalf: 'toneSineNoiseHalf', sineNoiseFull: 'toneSineNoiseFull'
  };
```

ersetzen durch:

```js
    neighborSine: 'toneNeighborSine',
    sineNoiseHalf: 'toneSineNoiseHalf', sineNoiseFull: 'toneSineNoiseFull',
    clusterHz2x3: 'toneClusterHz2x3', clusterHz4x3: 'toneClusterHz4x3',
    clusterHz2x8: 'toneClusterHz2x8', clusterHz4x8: 'toneClusterHz4x8',
    clusterCent2x10: 'toneClusterCent2x10', clusterCent4x10: 'toneClusterCent4x10',
    clusterCent2x30: 'toneClusterCent2x30', clusterCent4x30: 'toneClusterCent4x30'
  };
```

## Schritt 6 — Druck-Mapping `TONE_LABEL_KEY` in `js/print-md.js`

Nach BA 273 endet die Map mit:

```js
    neighborSine: "toneNeighborSine",
    sineNoiseHalf: "toneSineNoiseHalf", sineNoiseFull: "toneSineNoiseFull"
  };
```

ersetzen durch:

```js
    neighborSine: "toneNeighborSine",
    sineNoiseHalf: "toneSineNoiseHalf", sineNoiseFull: "toneSineNoiseFull",
    clusterHz2x3: "toneClusterHz2x3", clusterHz4x3: "toneClusterHz4x3",
    clusterHz2x8: "toneClusterHz2x8", clusterHz4x8: "toneClusterHz4x8",
    clusterCent2x10: "toneClusterCent2x10", clusterCent4x10: "toneClusterCent4x10",
    clusterCent2x30: "toneClusterCent2x30", clusterCent4x30: "toneClusterCent4x30"
  };
```

## Schritt 7 — Deutsche Texte in `i18n/de.js`

**Nach** dem `toneSineNoiseFullDesc`-Eintrag (aus BA 273) einfügen.
ASCII-Doppelquotes außen.

```js
    toneClusterHz2x3:        "Cluster ±3 Hz, 2 Nebentöne",
    toneClusterHz2x3Desc:    "Zielfrequenz plus zwei Nebenfrequenzen im Abstand 3 Hz (eine darüber, eine darunter). Fester Hz-Abstand: gleiche Schwebungsgeschwindigkeit über alle Tonhöhen. Alle Teiltöne gleich laut.",
    toneClusterHz4x3:        "Cluster ±3 Hz, 4 Nebentöne",
    toneClusterHz4x3Desc:    "Zielfrequenz plus vier Nebenfrequenzen in Schritten von 3 Hz (±3 Hz und ±6 Hz). Fester Hz-Abstand. Alle Teiltöne gleich laut.",
    toneClusterHz2x8:        "Cluster ±8 Hz, 2 Nebentöne",
    toneClusterHz2x8Desc:    "Zielfrequenz plus zwei Nebenfrequenzen im Abstand 8 Hz. Schnellere Schwebung als bei ±3 Hz. Alle Teiltöne gleich laut.",
    toneClusterHz4x8:        "Cluster ±8 Hz, 4 Nebentöne",
    toneClusterHz4x8Desc:    "Zielfrequenz plus vier Nebenfrequenzen in Schritten von 8 Hz (±8 Hz und ±16 Hz). Alle Teiltöne gleich laut.",
    toneClusterCent2x10:     "Cluster ±10 ct, 2 Nebentöne",
    toneClusterCent2x10Desc: "Zielfrequenz plus zwei Nebenfrequenzen im Abstand 10 Cent. Cent-Abstand ist proportional: bei tiefen Tönen langsame, bei hohen Tönen schnellere Schwebung. Alle Teiltöne gleich laut.",
    toneClusterCent4x10:     "Cluster ±10 ct, 4 Nebentöne",
    toneClusterCent4x10Desc: "Zielfrequenz plus vier Nebenfrequenzen in Schritten von 10 Cent (±10 ct und ±20 ct). Alle Teiltöne gleich laut.",
    toneClusterCent2x30:     "Cluster ±30 ct, 2 Nebentöne",
    toneClusterCent2x30Desc: "Zielfrequenz plus zwei Nebenfrequenzen im Abstand 30 Cent. Deutlichere Verstimmung als ±10 ct. Alle Teiltöne gleich laut.",
    toneClusterCent4x30:     "Cluster ±30 ct, 4 Nebentöne",
    toneClusterCent4x30Desc: "Zielfrequenz plus vier Nebenfrequenzen in Schritten von 30 Cent (±30 ct und ±60 ct). Alle Teiltöne gleich laut.",
```

Die anderen Sprachdateien bleiben unberührt.

## Schritt 8 — Version hochzählen

In `js/version.js`:

```js
const APP_VERSION = "0.4.274-beta";
```

---

## Akzeptanztest (Klick für Klick)

1. App neu laden. Tonauswahl-Modalbox öffnen (Reiter **Implantat** →
   **„Elektroden über Töne anspielen"**).
2. In der Gruppe **„Experimentelle Töne"** stehen jetzt **acht weitere**
   Knöpfe (vier „Cluster ±… Hz", vier „Cluster ±… ct").
3. **„Cluster ±3 Hz, 2 Nebentöne"** anklicken → man hört einen Ton mit
   langsamer, gleichmäßiger Lautstärke-Schwebung. **„Cluster ±8 Hz, 2
   Nebentöne"** → die Schwebung ist deutlich schneller.
4. **„Cluster ±10 ct"** vs. **„±30 ct"** → die ±30-ct-Variante klingt
   breiter/rauer.
5. Die „4 Nebentöne"-Varianten klingen voller als die „2 Nebentöne"-
   Varianten derselben Stufe.
6. Bei einer **sehr tiefen** Zielfrequenz (z.B. tiefste Elektrode) keinen
   Aussetzer/Knack — sehr tiefe Nebentöne werden sauber weggelassen.
7. Einen Cluster-Ton wählen, OK, eine Messung damit laufen lassen,
   **Druckvorschau** prüfen → deutscher Name erscheint (nicht
   „clusterHz2x3").
8. Browser-Konsole: keine Fehler.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jedes Akzeptanzkriterium einzeln melden (erfüllt /
nicht erfüllt / unklar, mit Datei + Zeile). Zusätzlich prüfen, dass
**alle acht** Cluster-Schlüssel an **allen sechs** Stellen eingetragen
sind:

| Stelle | enthält alle 8? |
|---|---|
| `_BASE_TONE_TYPES` (audio.js) | ☐ |
| `playToneTyped`-Dispatcher (audio.js) | ☐ |
| `GROUPS` items (tone-popup.js) | ☐ |
| `_toneTypeKey` map (test-ui.js) | ☐ |
| `TONE_LABEL_KEY` (print-md.js) | ☐ |
| `de.js` Label + Desc (je 8) | ☐ |

Bei „unklar": Rückfrage, nicht still annehmen.

## Hinweis

Die anderen Sprachen sind nicht angefaßt; Übersetzungen folgen, wenn der
Nutzer dazu auffordert.
