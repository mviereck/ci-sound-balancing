# BAUANLEITUNG 215 — richTone-Profile als Tontypen integrieren

## Ziel

Die 14 Instrumenten-Profile aus `docs/richtone_profiles.json`
(erzeugt in BA 214) werden im Tool als zusätzliche Tontypen
verfügbar. Pro Instrument ein eigener Tontyp `richAcc`, `richASax`,
`richBn`, `richBTb`, `richCb`, `richClBb`, `richFl`, `richHn`,
`richOb`, `richTbn`, `richTpC`, `richVa`, `richVc`, `richVn`. Diese
verwenden das **volle Profil** (Harmonische + Vibrato + AM +
Profil-Attack), das beim Probehören in BA 215a als am besten
befunden wurde.

In der Tonauswahl erscheinen sie unter dem deutschen Volltext-Namen
(„Violoncello (richTone)", „Akkordeon (richTone)", …) direkt nach
dem bestehenden generischen `richTone`-Eintrag und vor `Noise`.

i18n nur in `de.js`. EN/FR/ES werden in einer separaten Mini-BA 216
nachgezogen, sobald die deutschen Strings stehen.

## Voraussetzungen

- BA 214 abgeschlossen, `docs/richtone_profiles.json` mit 14
  Profilen vorhanden.
- BA 215a abgeschlossen, Probehör erfolgt, **keine** manuellen
  JSON-Tunings nötig (Stand wie BA 214 finalisiert; falls Tunings
  doch erfolgt sind, sind sie bereits im JSON).
- Python 3.9+, gleiche Umgebung wie BA 214/215a.

## Architektur

- Neue Datei `js/richtone-profiles.js` enthält eine globale Konstante
  `RICHTONE_PROFILES` mit den 14 Profilen als JS-Objekt. Diese Datei
  wird per Generator-Skript aus der JSON erzeugt, nicht von Hand
  geschrieben.
- Neue zentrale Funktion `playRichToneProfile(c, hz, vol, ms, pan,
  profile, ramp)` in `js/audio.js` synthetisiert einen Ton aus einem
  Profil-Objekt. 14 schlanke Wrapper rufen sie mit dem jeweiligen
  Profil auf.
- Dispatcher `playToneTyped` bekommt für jeden der 14 Tontypen einen
  Branch.

## Schritt 1 — Generator-Skript `tools/profiles_to_js.py`

Komplett neue Datei:

```python
#!/usr/bin/env python3
"""
Generator: erzeugt js/richtone-profiles.js aus docs/richtone_profiles.json.

Lauf:    python3 tools/profiles_to_js.py
Ausgabe: js/richtone-profiles.js

Bei Aenderungen am JSON dieses Skript erneut laufen lassen.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT     = Path(__file__).resolve().parent.parent
JSON_IN  = ROOT / "docs" / "richtone_profiles.json"
JS_OUT   = ROOT / "js" / "richtone-profiles.js"

INSTRUMENTS = [
    "Acc", "ASax", "Bn", "BTb", "Cb", "ClBb", "Fl",
    "Hn", "Ob", "Tbn", "TpC", "Va", "Vc", "Vn",
]


def main():
    if not JSON_IN.exists():
        print(f"FEHLER: {JSON_IN} nicht gefunden", file=sys.stderr)
        sys.exit(1)
    data = json.loads(JSON_IN.read_text(encoding="utf-8"))
    profiles_src = data.get("profiles", {})
    if not profiles_src:
        print("FEHLER: keine Profile in JSON", file=sys.stderr)
        sys.exit(1)

    # Auf relevante Felder reduzieren (samples-Pfad fliegt raus, nur
    # Synth-Parameter bleiben fuer das Tool).
    out_profiles = {}
    for abbr in INSTRUMENTS:
        if abbr not in profiles_src:
            print(f"WARN: {abbr} fehlt in JSON, ueberspringe", file=sys.stderr)
            continue
        p = profiles_src[abbr]
        out_profiles[abbr] = {
            "abbr":         abbr,
            "label":        p.get("label", abbr),
            "partials":     p.get("partials", [{"mult": 1, "amp": 1.0}]),
            "vibratoHz":    float(p.get("vibratoHz", 0)),
            "vibratoCents": float(p.get("vibratoCents", 0)),
            "amHz":         float(p.get("amHz", 0)),
            "amDepth":      float(p.get("amDepth", 0)),
            "attackMs":     float(p.get("attackMs", 50)),
        }

    body = json.dumps(out_profiles, indent=2, ensure_ascii=False)
    ts = datetime.now(timezone.utc).isoformat()
    content = (
        "// Auto-generiert von tools/profiles_to_js.py\n"
        f"// Quelle: docs/richtone_profiles.json (Lauf {ts})\n"
        "// Nicht von Hand editieren — bei Aenderungen am JSON Skript erneut laufen lassen.\n"
        "//\n"
        "// Wird in index.html vor js/audio.js geladen; globale Konstante\n"
        "// RICHTONE_PROFILES steht audio.js (playRichToneProfile) zur Verfuegung.\n"
        f"const RICHTONE_PROFILES = {body};\n"
    )
    JS_OUT.write_text(content, encoding="utf-8")
    print(f"OK: {len(out_profiles)} Profile -> {JS_OUT}")


if __name__ == "__main__":
    main()
```

Ausführen:
```
python3 tools/profiles_to_js.py
```

Resultat: `js/richtone-profiles.js` mit der Konstante. Datei
**nicht** von Hand bearbeiten — Wartung läuft über Skript-Lauf.

## Schritt 2 — `index.html` ergänzen

In `index.html` Z. 140 die Skript-Liste anpassen, so dass
`js/richtone-profiles.js` **vor** `js/audio.js` geladen wird.

Vorher (Z. 140):
```
'js/core.js', 'js/state-side.js', 'js/audio-source.js', 'assets/audio-embed/noises.js', 'js/audio.js',
```

Nachher (Z. 140):
```
'js/core.js', 'js/state-side.js', 'js/audio-source.js', 'assets/audio-embed/noises.js', 'js/richtone-profiles.js', 'js/audio.js',
```

## Schritt 3 — `js/audio.js` erweitern

### 3a) Neue Funktion `playRichToneProfile`

Direkt nach `playRichTone` (vor `playNoiseTone`) einfügen:

```javascript
function playRichToneProfile(c, hz, vol, ms, pan, profile, ramp = 50) {
  // Generische richTone-Synthese aus einem Profil-Objekt
  // (siehe js/richtone-profiles.js -> RICHTONE_PROFILES.<abbr>).
  // Felder: partials, vibratoHz, vibratoCents, amHz, amDepth, attackMs.
  // Profil-Attack erweitert die Cos2-Rampe ueber den Default hinaus
  // (begrenzt durch applyCosRamp auf max ms/2).
  return new Promise((r) => {
    const VIB_HZ      = profile.vibratoHz    || 0;
    const VIB_CENTS   = profile.vibratoCents || 0;
    const AM_HZ       = profile.amHz         || 0;
    const AM_DEPTH    = profile.amDepth      || 0;
    const partials    = (profile.partials && profile.partials.length)
                          ? profile.partials
                          : [{ mult: 1, amp: 1.0 }];
    const effRamp     = Math.max(ramp, profile.attackMs || ramp);

    const oscs        = [];
    const g           = c.createGain();
    const p           = c.createStereoPanner();
    const carrierMix  = c.createGain();
    carrierMix.gain.value = 1 - AM_DEPTH / 2;

    const total       = partials.reduce((s, x) => s + x.amp, 0) || 1;
    const nyquist     = c.sampleRate / 2 - 100;
    const vibFactor   = (VIB_HZ > 0 && VIB_CENTS > 0)
                          ? Math.pow(2, VIB_CENTS / 1200) - 1
                          : 0;

    let vibLfo = null;
    if (vibFactor > 0) {
      vibLfo = c.createOscillator();
      vibLfo.type = "sine";
      vibLfo.frequency.value = VIB_HZ;
    }

    for (const part of partials) {
      const freq = hz * part.mult;
      if (freq < nyquist) {
        const o  = c.createOscillator();
        const og = c.createGain();
        o.type = "sine";
        o.frequency.value = freq;
        og.gain.value = part.amp / total;
        if (vibLfo) {
          const vibGain = c.createGain();
          vibGain.gain.value = freq * vibFactor;
          vibLfo.connect(vibGain);
          vibGain.connect(o.frequency);
        }
        o.connect(og);
        og.connect(carrierMix);
        o.start();
        o.stop(c.currentTime + ms / 1000 + 0.01);
        oscs.push(o);
      }
    }

    if (AM_HZ > 0 && AM_DEPTH > 0) {
      const amLfo     = c.createOscillator();
      const amLfoGain = c.createGain();
      amLfo.type = "sine";
      amLfo.frequency.value = AM_HZ;
      amLfoGain.gain.value  = AM_DEPTH / 2;
      amLfo.connect(amLfoGain);
      amLfoGain.connect(carrierMix.gain);
      amLfo.start();
      amLfo.stop(c.currentTime + ms / 1000 + 0.01);
    }

    if (vibLfo) {
      vibLfo.start();
      vibLfo.stop(c.currentTime + ms / 1000 + 0.01);
    }

    carrierMix.connect(g);
    p.pan.value = pan;
    applyCosRamp(g, vol, c, ms, effRamp);
    g.connect(p);
    p.connect(c.destination);
    curOsc = oscs[0] || null;
    if (oscs.length > 0) {
      oscs[0].onended = () => { curOsc = null; r(); };
    } else {
      r();
    }
  });
}
```

### 3b) Dispatcher `playToneTyped` erweitern

In der bestehenden `playToneTyped`-Funktion (vor dem fallback auf
`playSineTone`) folgenden Block einfügen, **nach** der Zeile
`if (toneType === "pulsedComplex")  return playPulsedComplexTone(...)`:

```javascript
  if (toneType === "richTone")       return playRichTone(c, hz, vol, ms, pan, ramp);
  // 14 Instrumenten-Profile aus js/richtone-profiles.js
  if (toneType.length > 4 && toneType.startsWith("rich")) {
    const abbr = toneType.substring(4);
    if (typeof RICHTONE_PROFILES !== "undefined" && RICHTONE_PROFILES[abbr]) {
      return playRichToneProfile(c, hz, vol, ms, pan, RICHTONE_PROFILES[abbr], ramp);
    }
  }
```

Die bestehende `if (toneType === "richTone") …`-Zeile bleibt — sie
wird durch die neue Zeile redundant ersetzt; alte Zeile **löschen**,
neue an deren Stelle einfügen (siehe Block oben).

## Schritt 4 — Registries erweitern

Die 14 neuen Tontyp-Strings konsistent in allen Listen anhängen,
**direkt nach `richTone` und vor `noise`**, in folgender Reihenfolge
(alphabetisch nach deutschem Volltext-Namen):

```
richAcc, richASax, richBTb, richVa, richBn, richClBb, richCb,
richOb, richTbn, richFl, richTpC, richVn, richVc, richHn
```

### 4a) `js/file.js` Z. 592

Vorher:
```javascript
  const VALID_TONE_TYPES = ["sine", "complex", "pulsedComplex", "richTone",
    "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
    "wobbleSweep"];
```

Nachher:
```javascript
  const VALID_TONE_TYPES = ["sine", "complex", "pulsedComplex", "richTone",
    "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
    "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
    "richVc", "richHn",
    "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
    "wobbleSweep"];
```

### 4b) `js/init.js` Z. 773

Vorher:
```javascript
      const _VALID_TT = ["sine", "complex", "pulsedComplex", "richTone",
        "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
        "wobbleSweep"];
```

Nachher:
```javascript
      const _VALID_TT = ["sine", "complex", "pulsedComplex", "richTone",
        "richAcc", "richASax", "richBTb", "richVa", "richBn", "richClBb",
        "richCb", "richOb", "richTbn", "richFl", "richTpC", "richVn",
        "richVc", "richHn",
        "noise", "noiseAdaptive", "irn", "amSine", "warbleSine", "burstSine",
        "wobbleSweep"];
```

### 4c) `js/test-ui.js` — zwei Auswahllisten + Map + Popup

Drei Stellen mit derselben Pattern-Erweiterung. Bei den zwei
identischen Dropdown-Listen (Z. ~244 und Z. ~907) mit `replace_all`
arbeiten:

Vorher:
```javascript
        ['sine','toneSine'],['complex','toneComplex'],
        ['pulsedComplex','tonePulsedComplex'],['richTone','toneRichTone'],
        ['noise','toneNoise'],['noiseAdaptive','toneNoiseAdaptive'],
        ['irn','toneIRN'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
```

Nachher:
```javascript
        ['sine','toneSine'],['complex','toneComplex'],
        ['pulsedComplex','tonePulsedComplex'],['richTone','toneRichTone'],
        ['richAcc','toneRichAcc'],['richASax','toneRichASax'],
        ['richBTb','toneRichBTb'],['richVa','toneRichVa'],
        ['richBn','toneRichBn'],['richClBb','toneRichClBb'],
        ['richCb','toneRichCb'],['richOb','toneRichOb'],
        ['richTbn','toneRichTbn'],['richFl','toneRichFl'],
        ['richTpC','toneRichTpC'],['richVn','toneRichVn'],
        ['richVc','toneRichVc'],['richHn','toneRichHn'],
        ['noise','toneNoise'],['noiseAdaptive','toneNoiseAdaptive'],
        ['irn','toneIRN'],['amSine','toneAmSine'],
        ['warbleSine','toneWarbleSine'],['burstSine','toneBurstSine'],
        ['wobbleSweep','toneWobbleSweep']
```

Die Map `_toneTypeKey` (Z. ~685) entsprechend erweitern:

Vorher:
```javascript
    sine: 'toneSine', complex: 'toneComplex',
    pulsedComplex: 'tonePulsedComplex', richTone: 'toneRichTone',
    noise: 'toneNoise', noiseAdaptive: 'toneNoiseAdaptive',
    irn: 'toneIRN', amSine: 'toneAmSine',
    warbleSine: 'toneWarbleSine', burstSine: 'toneBurstSine',
    wobbleSweep: 'toneWobbleSweep'
```

Nachher:
```javascript
    sine: 'toneSine', complex: 'toneComplex',
    pulsedComplex: 'tonePulsedComplex', richTone: 'toneRichTone',
    richAcc: 'toneRichAcc', richASax: 'toneRichASax',
    richBTb: 'toneRichBTb', richVa: 'toneRichVa',
    richBn: 'toneRichBn', richClBb: 'toneRichClBb',
    richCb: 'toneRichCb', richOb: 'toneRichOb',
    richTbn: 'toneRichTbn', richFl: 'toneRichFl',
    richTpC: 'toneRichTpC', richVn: 'toneRichVn',
    richVc: 'toneRichVc', richHn: 'toneRichHn',
    noise: 'toneNoise', noiseAdaptive: 'toneNoiseAdaptive',
    irn: 'toneIRN', amSine: 'toneAmSine',
    warbleSine: 'toneWarbleSine', burstSine: 'toneBurstSine',
    wobbleSweep: 'toneWobbleSweep'
```

Das `TONE_TYPES`-Array im `_openToneTypeDialog` (Z. ~2090):

Vorher:
```javascript
  var TONE_TYPES = [
    ['sine',          'toneSine'],
    ['complex',       'toneComplex'],
    ['pulsedComplex', 'tonePulsedComplex'],
    ['richTone',      'toneRichTone'],
    ['noise',         'toneNoise'],
    ['noiseAdaptive', 'toneNoiseAdaptive'],
    ['irn',           'toneIRN'],
    ['amSine',        'toneAmSine'],
    ['warbleSine',    'toneWarbleSine'],
    ['burstSine',     'toneBurstSine'],
    ['wobbleSweep',   'toneWobbleSweep']
  ];
```

Nachher:
```javascript
  var TONE_TYPES = [
    ['sine',          'toneSine'],
    ['complex',       'toneComplex'],
    ['pulsedComplex', 'tonePulsedComplex'],
    ['richTone',      'toneRichTone'],
    ['richAcc',       'toneRichAcc'],
    ['richASax',      'toneRichASax'],
    ['richBTb',       'toneRichBTb'],
    ['richVa',        'toneRichVa'],
    ['richBn',        'toneRichBn'],
    ['richClBb',      'toneRichClBb'],
    ['richCb',        'toneRichCb'],
    ['richOb',        'toneRichOb'],
    ['richTbn',       'toneRichTbn'],
    ['richFl',        'toneRichFl'],
    ['richTpC',       'toneRichTpC'],
    ['richVn',        'toneRichVn'],
    ['richVc',        'toneRichVc'],
    ['richHn',        'toneRichHn'],
    ['noise',         'toneNoise'],
    ['noiseAdaptive', 'toneNoiseAdaptive'],
    ['irn',           'toneIRN'],
    ['amSine',        'toneAmSine'],
    ['warbleSine',    'toneWarbleSine'],
    ['burstSine',     'toneBurstSine'],
    ['wobbleSweep',   'toneWobbleSweep']
  ];
```

### 4d) `js/print-md.js` Z. 464 `TONE_LABEL_KEY`

Erweitern um die 14 neuen Einträge analog zu `_toneTypeKey` oben.

## Schritt 5 — `i18n/de.js`

Nach dem bestehenden Eintrag `toneRichTone:` die 14 neuen Labels
einfügen (Reihenfolge gemäß Auswahl-Liste):

```javascript
    toneRichAcc:   "Akkordeon (richTone)",
    toneRichASax:  "Altsaxophon (richTone)",
    toneRichBTb:   "Basstuba (richTone)",
    toneRichVa:    "Bratsche (richTone)",
    toneRichBn:    "Fagott (richTone)",
    toneRichClBb:  "Klarinette in B (richTone)",
    toneRichCb:    "Kontrabass (richTone)",
    toneRichOb:    "Oboe (richTone)",
    toneRichTbn:   "Posaune (richTone)",
    toneRichFl:    "Querflöte (richTone)",
    toneRichTpC:   "Trompete in C (richTone)",
    toneRichVn:    "Violine (richTone)",
    toneRichVc:    "Violoncello (richTone)",
    toneRichHn:    "Waldhorn (richTone)",
```

`en.js`, `fr.js`, `es.js` werden in BA 215 **nicht** angefasst — die
fehlenden Keys fallen über den i18n-Fallback auf die deutschen
Defaults. Übersetzungen kommen in BA 216.

## Schritt 6 — `docs/spec/02-messung.md`

Den Tonart-Stichpunkt um die Instrumenten-Varianten ergänzen. Vor
dem Wort „Default `'complex'`" (oder am passenden Ende der
Aufzählung) einschieben:

```
... Iterated Rippled Noise (BA 213.4, 16 Iterationen Add-and-Delay) /
**Reicher Komplexton: Akkordeon / Altsaxophon / Basstuba / Bratsche /
Fagott / Klarinette in B / Kontrabass / Oboe / Posaune / Querflöte /
Trompete in C / Violine / Violoncello / Waldhorn** (BA 215, Profile
aus TinySOL/IRCAM analysiert in BA 214) / AM-Sinus / ...
```

Genaue Position kann Sonnet anhand des bestehenden Textes
einsortieren — der Punkt ist, daß die neuen Tontypen erwähnt werden
und auf BA 214 und 215 verwiesen wird.

## Schritt 7 — `docs/CODESTRUKTUR.md`

Einen neuen Eintrag für die generierte Datei einfügen, **vor** dem
Eintrag für `audio.js` (das ist Modul Nr. 4 in der Tabelle).
Beispiel-Format:

```
| 3a | richtone-profiles.js | Auto-generiert von `tools/profiles_to_js.py` aus `docs/richtone_profiles.json` (BA 215). Globale Konstante `RICHTONE_PROFILES` mit 14 Instrumenten-Profilen (Acc, ASax, Bn, BTb, Cb, ClBb, Fl, Hn, Ob, Tbn, TpC, Va, Vc, Vn). Jedes Profil enthält `partials`, `vibratoHz`, `vibratoCents`, `amHz`, `amDepth`, `attackMs`. Wird in `index.html` vor `js/audio.js` geladen, sodaß `playRichToneProfile` in audio.js die Konstante nutzen kann. Bei JSON-Tunings das Generator-Skript neu laufen lassen, **diese Datei nicht von Hand bearbeiten**. |
```

Genaue Modulnummer prüft Sonnet anhand des aktuellen Tabellenstandes
(`audio.js` ist nicht zwangsläufig immer Nr. 4 — Reihenfolge nach
Lade-Reihenfolge).

## Schritt 8 — Versionsbump

In `js/version.js`:

Vorher:
```javascript
const APP_VERSION = "3.2.213.4-beta";
```

Nachher:
```javascript
const APP_VERSION = "3.2.215-beta";
```

Die Version springt von `213.4` direkt auf `215` (BA 214 hatte
keinen Bump, weil reine Tools/Doku — Pflicht wäre `215` als
BA-Nummer der ersten Lauf-Code-ändernden BA seit BA 213).

## Akzeptanztest

1. `tools/profiles_to_js.py` existiert und ist ausführbar. ✅ / ❌
2. `js/richtone-profiles.js` existiert, ist gültiges JavaScript
   (Konsole: `Function('return ' + require("fs").readFileSync(...))(...)`
   oder einfach durch erfolgreiches Laden der Seite — siehe Punkt 5).
   ✅ / ❌
3. Im Browser, Hard-Reload mit leerem Cache: Version unten zeigt
   `3.2.215-beta`. ✅ / ❌
4. Browser-Konsole zeigt keinen Fehler `RICHTONE_PROFILES is not
   defined`. ✅ / ❌
5. In der Konsole: `Object.keys(RICHTONE_PROFILES).length` ergibt
   `14`. ✅ / ❌
6. In der Konsole: `RICHTONE_PROFILES.Vn.partials.length > 0` und
   `RICHTONE_PROFILES.Vc.vibratoCents > 0` (Vc hat detektiertes
   Vibrato). ✅ / ❌
7. Tab „Messungen" → Sub-Tab „Frequenzabgleich" → Tonart-Popup
   öffnen. Die Liste zeigt **25 Tontypen** (vorher 11): die neuen
   14 erscheinen unter dem deutschen Volltext-Namen direkt nach
   „Reicher Komplexton" und vor „Schmalbandrauschen". ✅ / ❌
8. Eine der Instrumenten-Varianten auswählen (z. B. „Violoncello
   (richTone)"). Probehören-Button im Popup spielt einen Ton in
   richTone-Charakter mit Vibrato (Vc hat detektierbares Vibrato).
   ✅ / ❌
9. Eine vibrato-freie Variante auswählen (z. B. „Querflöte
   (richTone)"). Probehören-Button spielt einen stationären Ton ohne
   hörbares Vibrato (Fl hatte keine detektierbare Vibrato-Komponente
   in der Analyse). ✅ / ❌
10. Frequenzabgleich-Test mit einer Instrumenten-Variante starten
    (z. B. „Violine (richTone)"), ein paar Töne durchklicken — Test
    läuft normal, keine Konsolen-Fehler. ✅ / ❌
11. Test-UI Z. ~244 / ~907 (die zwei Dropdown-Listen für Test 1 und
    Test 2) zeigen ebenfalls die 14 neuen Tontypen. Quick-Check:
    Tab „Messungen" → Sub-Tab „Elektrodenlautstärke" → Tonart-
    Dropdown öffnen. ✅ / ❌
12. Nach einem Frequenzabgleich-Lauf eine Druck-Vorschau erzeugen:
    Tonart wird mit dem deutschen Volltext-Namen angezeigt (z. B.
    „Violoncello (richTone)") statt mit dem internen Key. ✅ / ❌

## Selbstprüfungs-Auftrag

Sonnet geht **vor der Fertig-Meldung** die zwölf Akzeptanz-Punkte
einzeln durch und meldet pro Punkt: erfüllt / nicht erfüllt /
unklar, jeweils mit Datei-/Zeilenangabe oder Konsolen-Output. Wenn
einer der Hör-Punkte (8, 9) nicht selbst prüfbar ist (Sonnet kann
nicht hören): explizit als „durch Nutzer-Probehören zu bestätigen"
markieren, nicht stillschweigend abhaken.

Im Fertig-Bericht mitschicken:
- Inhalt von `js/richtone-profiles.js` (erste 30 Zeilen reichen).
- Die exakte neue Reihenfolge der Tontypen aus dem
  `_openToneTypeDialog`-Block (Schritt 4c, letzter Teil).

## Hinweis auf Folge-BA

**BA 216 (Mini)** — Übersetzungen für die 14 neuen Tontypen in
`i18n/en.js`, `i18n/fr.js`, `i18n/es.js`. Vorlage liefert
`i18n/de.js` aus dieser BA.
