# BAUANLEITUNG 214 — richTone-Profile aus TinySOL extrahieren

## Ziel

Aus der TinySOL-Sammlung (IRCAM, lokal entpackt unter
`/mnt/xbox/lauscher/voice/TinySOL/`) für jedes der 14 Instrumente ein
spektrales und Modulations-Profil ableiten. Output: eine maschinen-
lesbare Datei `docs/richtone_profiles.json`.

Die Profile beschreiben, wie ein Instrument einen Ton aufbaut
(Anschlag, Harmonische, Vibrato, Atem-Modulation). In BA 215 werden
diese Profile in `js/audio.js` als neue Tontypen pro Instrument
eingebunden (z. B. `richVc`, `richVn`, `richAcc`...), damit der
Frequenzabgleich Stimulus-Klänge anbieten kann, die im CI sauberer
hörbar sind als der bisherige generische `richTone`, ohne Sample-
basierte Cent-Beschränkung.

BA 214 ist **reine Tool-/Doku-Arbeit**: ein Python-Analyseskript
unter `tools/`, eine JSON-Datei unter `docs/`. Es wird kein Lauf-Code
(`js/`, `index.html`, `style.css`) verändert. Versionsbump entfällt
deshalb in dieser BA. Der Bump auf `3.2.215-beta` folgt in BA 215.

## Voraussetzungen

- Python 3.9 oder neuer auf dem System.
- TinySOL ist entpackt unter `/mnt/xbox/lauscher/voice/TinySOL/`. Die
  Datei `TinySOL_metadata.csv` liegt direkt in diesem Verzeichnis;
  Audio-Dateien in Unterordnern `Brass/`, `Strings/`, `Keyboards/`,
  `Winds/`.
- Python-Pakete: `librosa`, `numpy`, `scipy`, `soundfile`. Falls nicht
  vorhanden:
  ```
  pip install --user librosa numpy scipy soundfile
  ```
  Bei librosa-Versions-Problemen mit `pyin`: Mindestversion
  librosa 0.10 verwenden.

## Schritt 1 — Verzeichnis anlegen

Neues Verzeichnis `tools/` im Repository-Root anlegen, falls noch
nicht vorhanden:
```
mkdir -p tools
```

## Schritt 2 — Analyse-Skript `tools/analyze_tinysol.py`

Komplette Datei wie folgt anlegen:

```python
#!/usr/bin/env python3
"""
Analyse-Skript: extrahiert richTone-Profile aus TinySOL.

Lauf:    python3 tools/analyze_tinysol.py
Ausgabe: docs/richtone_profiles.json
"""
import csv
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import librosa

TINYSOL_ROOT = Path("/mnt/xbox/lauscher/voice/TinySOL")
META_CSV     = TINYSOL_ROOT / "TinySOL_metadata.csv"
OUT_JSON     = Path(__file__).resolve().parent.parent / "docs" / "richtone_profiles.json"

INSTRUMENTS = [
    "Acc", "ASax", "Bn", "BTb", "Cb", "ClBb", "Fl",
    "Hn", "Ob", "Tbn", "TpC", "Va", "Vc", "Vn",
]

# Deutsche Volltext-Bezeichner, in der UI-Liste der Tontypen verwendet.
INSTRUMENT_LABELS_DE = {
    "Acc":  "Akkordeon",
    "ASax": "Altsaxophon",
    "Bn":   "Fagott",
    "BTb":  "Basstuba",
    "Cb":   "Kontrabass",
    "ClBb": "Klarinette in B",
    "Fl":   "Querfloete",
    "Hn":   "Waldhorn",
    "Ob":   "Oboe",
    "Tbn":  "Posaune",
    "TpC":  "Trompete in C",
    "Va":   "Bratsche",
    "Vc":   "Violoncello",
    "Vn":   "Violine",
}

HOP        = 512
N_HARMS    = 12
HARM_MIN   = 0.02  # Untergrenze fuer Harmonischen-Amplituden relativ zu a1
VIB_MIN_HZ = 2.0
VIB_MAX_HZ = 8.0
AM_MIN_HZ  = 2.0
AM_MAX_HZ  = 10.0
VIB_CENTS_THRESHOLD = 3.0  # unterhalb: Vibrato als nicht vorhanden werten
AM_DEPTH_THRESHOLD  = 0.05 # unterhalb: AM als nicht vorhanden werten


def load_meta():
    if not META_CSV.exists():
        print(f"FEHLER: {META_CSV} nicht gefunden", file=sys.stderr)
        sys.exit(1)
    with META_CSV.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def pick_samples(meta, instr, n=3):
    """Drei Samples pro Instrument: Mitte des Pitch-Range plus +/- ~Quart."""
    pool = [
        r for r in meta
        if r["Instrument (abbr.)"] == instr
        and r["Technique (abbr.)"] == "ord"
        and r["Dynamics"] == "mf"
    ]
    if not pool:
        return []
    no_retune = [r for r in pool if r.get("Needed digital retuning", "FALSE") == "FALSE"]
    cands = no_retune if no_retune else pool
    pids = sorted({int(r["Pitch ID"]) for r in cands})
    if not pids:
        return []
    mid = pids[len(pids) // 2]
    targets = [mid - 5, mid, mid + 5]
    seen = set()
    chosen = []
    for t in targets:
        best = min(cands, key=lambda r: abs(int(r["Pitch ID"]) - t))
        key = best["Path"]
        if key in seen:
            continue
        seen.add(key)
        chosen.append(best)
        if len(chosen) >= n:
            break
    return chosen


def analyze_sample(wav_path):
    """Liefert dict mit f0, partials, vibratoHz, vibratoCents, amHz, amDepth, attackMs."""
    y, sr = librosa.load(str(wav_path), sr=None, mono=True)
    if len(y) < sr // 4:
        return None

    f0, voiced, _ = librosa.pyin(
        y, fmin=40, fmax=8000, sr=sr, frame_length=2048, hop_length=HOP
    )
    f0_v = f0[~np.isnan(f0)]
    if len(f0_v) < 10:
        return None
    f0_med = float(np.median(f0_v))

    voiced_idx = np.where(~np.isnan(f0))[0]
    if len(voiced_idx) < 20:
        return None
    i_start = voiced_idx[int(len(voiced_idx) * 0.1)]
    i_end   = voiced_idx[int(len(voiced_idx) * 0.8)]
    s_start = i_start * HOP
    s_end   = min(len(y), i_end * HOP)
    y_mid = y[s_start:s_end]
    if len(y_mid) < 1024:
        return None

    # FFT der stationaeren Phase fuer harmonische Amplituden
    window = np.hanning(len(y_mid))
    spectrum = np.abs(np.fft.rfft(y_mid * window))
    freqs    = np.fft.rfftfreq(len(y_mid), 1 / sr)

    a1 = None
    partials = []
    for h in range(1, N_HARMS + 1):
        target = f0_med * h
        if target > sr / 2 * 0.9:
            break
        df = target * (2 ** (20 / 1200) - 1)  # +/- 20 Cent Suchfenster
        mask = (freqs > target - df) & (freqs < target + df)
        if not mask.any():
            continue
        amp = float(spectrum[mask].max())
        if h == 1:
            a1 = amp
            partials.append({"mult": 1, "amp": 1.0})
            continue
        if a1 and a1 > 0:
            rel = amp / a1
            if rel >= HARM_MIN:
                partials.append({"mult": h, "amp": round(rel, 3)})

    # Vibrato: FFT der F0-Kurve in Cent
    f0_cents = 1200 * np.log2(f0_v / f0_med)
    f0_cents -= np.mean(f0_cents)
    if len(f0_cents) >= 16:
        vib_spec  = np.abs(np.fft.rfft(f0_cents))
        vib_freqs = np.fft.rfftfreq(len(f0_cents), HOP / sr)
        vib_mask  = (vib_freqs > VIB_MIN_HZ) & (vib_freqs < VIB_MAX_HZ)
        if vib_mask.any() and vib_spec[vib_mask].max() > 0.5:
            vib_idx     = np.argmax(np.where(vib_mask, vib_spec, 0))
            vibratoHz   = float(vib_freqs[vib_idx])
            vibratoCents = float(np.std(f0_cents) * np.sqrt(2))
        else:
            vibratoHz, vibratoCents = 0.0, 0.0
    else:
        vibratoHz, vibratoCents = 0.0, 0.0
    if vibratoCents < VIB_CENTS_THRESHOLD:
        vibratoHz, vibratoCents = 0.0, 0.0

    # Atem-AM: FFT der RMS-Huellkurve in stationaerer Phase
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=HOP)[0]
    rms_v = rms[i_start:i_end]
    if len(rms_v) >= 16:
        rms_norm = rms_v - np.mean(rms_v)
        am_spec  = np.abs(np.fft.rfft(rms_norm))
        am_freqs = np.fft.rfftfreq(len(rms_v), HOP / sr)
        am_mask  = (am_freqs > AM_MIN_HZ) & (am_freqs < AM_MAX_HZ)
        if am_mask.any() and am_spec[am_mask].max() > 0.5:
            am_idx  = np.argmax(np.where(am_mask, am_spec, 0))
            amHz    = float(am_freqs[am_idx])
            mx      = float(rms_v.max())
            amDepth = float((mx - float(rms_v.min())) / mx) if mx > 0 else 0.0
        else:
            amHz, amDepth = 0.0, 0.0
    else:
        amHz, amDepth = 0.0, 0.0
    if amDepth < AM_DEPTH_THRESHOLD:
        amHz, amDepth = 0.0, 0.0

    # Attack-Time: vom Sample-Start bis 80 Prozent des RMS-Peaks
    peak = float(rms.max())
    if peak > 0:
        above = np.where(rms >= peak * 0.8)[0]
        attack_frames = int(above[0]) if len(above) else 0
        attackMs = float(attack_frames * HOP / sr * 1000.0)
    else:
        attackMs = 0.0

    return {
        "f0":           round(f0_med, 2),
        "partials":     partials,
        "vibratoHz":    round(vibratoHz, 2),
        "vibratoCents": round(vibratoCents, 2),
        "amHz":         round(amHz, 2),
        "amDepth":      round(amDepth, 3),
        "attackMs":     round(attackMs, 1),
    }


def aggregate_profile(samples, instr):
    valid = [s for s in samples if s]
    if not valid:
        return None
    # Harmonische: pro mult die Amplituden ueber alle Samples mitteln
    by_h = {}
    for s in valid:
        for p in s["partials"]:
            by_h.setdefault(p["mult"], []).append(p["amp"])
    partials = sorted(
        [
            {"mult": h, "amp": round(float(np.mean(amps)), 3)}
            for h, amps in by_h.items()
            if float(np.mean(amps)) >= HARM_MIN or h == 1
        ],
        key=lambda x: x["mult"],
    )
    return {
        "label":        INSTRUMENT_LABELS_DE[instr],
        "abbr":         instr,
        "partials":     partials,
        "vibratoHz":    round(float(np.median([s["vibratoHz"]    for s in valid])), 2),
        "vibratoCents": round(float(np.median([s["vibratoCents"] for s in valid])), 2),
        "amHz":         round(float(np.median([s["amHz"]         for s in valid])), 2),
        "amDepth":      round(float(np.median([s["amDepth"]      for s in valid])), 3),
        "attackMs":     round(float(np.median([s["attackMs"]     for s in valid])), 1),
    }


def main():
    meta = load_meta()
    profiles = {}
    for instr in INSTRUMENTS:
        chosen = pick_samples(meta, instr)
        if not chosen:
            print(f"  {instr}: keine geeigneten Samples", file=sys.stderr)
            continue
        print(f"  {instr}: {len(chosen)} Samples", file=sys.stderr)
        results = []
        sources = []
        for row in chosen:
            wav = TINYSOL_ROOT / row["Path"]
            if not wav.exists():
                print(f"    fehlt: {wav}", file=sys.stderr)
                continue
            r = analyze_sample(wav)
            if r:
                results.append(r)
                sources.append(row["Path"])
        prof = aggregate_profile(results, instr)
        if prof:
            prof["samples"] = sources
            profiles[instr] = prof
            print(f"    -> partials={len(prof['partials'])}, vib={prof['vibratoHz']}/{prof['vibratoCents']}c, am={prof['amHz']}/{prof['amDepth']}, attack={prof['attackMs']}ms", file=sys.stderr)

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with OUT_JSON.open("w", encoding="utf-8") as f:
        json.dump(
            {
                "_version":     1,
                "_source":      "TinySOL (IRCAM, CC-BY-4.0)",
                "_generatedAt": datetime.now(timezone.utc).isoformat(),
                "_notes":       "Pro Instrument 3 Samples Dynamik mf Technik ord. Median ueber Samples; partials Mittel.",
                "profiles":     profiles,
            },
            f,
            indent=2,
            ensure_ascii=False,
        )
    print(f"OK: {len(profiles)} Profile -> {OUT_JSON}")


if __name__ == "__main__":
    main()
```

Wichtige Hinweise zum Skript:

- **ASCII-Strings in INSTRUMENT_LABELS_DE**: bewußt ohne Umlaute
  (`Querfloete`) gehalten, damit das Skript robust gegen Encoding-
  Probleme auf verschiedenen Systemen ist. BA 215 übersetzt diese
  Labels in der `i18n/de.js` zu korrekten Umlauten („Querflöte",
  „Klarinette in B", …) — siehe BA 215.
- Drei Sample-Auswahl per Pitch-ID-Verschiebung um ±5 (entspricht
  einer Quart): robust ohne harte Pitch-Tabellen.
- librosa-API: `pyin`, `feature.rms`, `load(sr=None)` — alle stabil
  ab librosa 0.10.

## Schritt 3 — Skript ausführbar machen und ausführen

```
chmod +x tools/analyze_tinysol.py
python3 tools/analyze_tinysol.py
```

Erwartete Konsolen-Ausgabe (gekürzt):
```
  Acc: 3 Samples
    -> partials=N, vib=..., am=..., attack=...
  ASax: 3 Samples
    -> partials=...
  ...
  Vn: 3 Samples
    -> partials=...
OK: 14 Profile -> .../docs/richtone_profiles.json
```

Falls einzelne Samples fehlen oder Analyse fehlschlägt: Skript läuft
weiter, betroffenes Instrument wird ausgelassen oder mit weniger als
3 Samples aggregiert.

## Schritt 4 — JSON sichten (manuelle Plausibilität)

Datei `docs/richtone_profiles.json` öffnen und folgende Punkte
prüfen:

- **Vn (Violine)**: `vibratoHz` zwischen 4 und 7, `vibratoCents`
  zwischen 5 und 25. Sonst sind die Vibrato-Detektor-Schwellen zu
  hoch/niedrig gesetzt.
- **Acc (Akkordeon)**: `vibratoCents` ≈ 0 oder ganz 0. Akkordeon-
  Tremulant kann als AM auftauchen (`amHz` 5–8 Hz), nicht als
  Vibrato.
- **Klavier-Familie ist hier Akkordeon**: kein echtes Klavier in
  TinySOL.
- **Bei allen Instrumenten**: `partials[0]` ist `{"mult": 1, "amp":
  1.0}`. Mindestens 4 Harmonische, oft 6–10.
- **`attackMs`**: kurz bei Blasinstrumenten (10–50 ms), mittel bei
  Streichern (40–120 ms), evtl. länger bei Akkordeon (40–80 ms).

Falls Werte unplausibel sind: nicht selbst justieren — am Ende der
BA 214 Befund melden, dann besprechen wir die Parameter, bevor BA 215
startet.

## Akzeptanztest (Klick-für-Klick, von Sonnet vor der Fertig-Meldung
durchzugehen)

1. Im Repository-Root: `ls tools/analyze_tinysol.py` liefert die
   Datei. ✅ / ❌
2. `python3 tools/analyze_tinysol.py` läuft ohne unbehandelte
   Exceptions durch. ✅ / ❌
3. `ls docs/richtone_profiles.json` liefert die Datei. ✅ / ❌
4. `python3 -c "import json; d=json.load(open('docs/richtone_profiles.json')); print(len(d['profiles']))"`
   liefert `14`. ✅ / ❌
5. Spot-Check: für `profiles.Vn.partials[0]` ist `mult: 1, amp: 1.0`.
   Für `profiles.Acc.vibratoCents` ist ein Wert < 5. ✅ / ❌
6. `js/version.js` ist **unverändert** (gleiche Zeile wie vor BA 214,
   noch `3.2.213.4-beta`). ✅ / ❌

## Selbstprüfungs-Auftrag

Sonnet geht **vor der Fertig-Meldung** die sechs Akzeptanz-Punkte
einzeln durch und meldet pro Punkt: erfüllt / nicht erfüllt /
unklar, jeweils mit Datei- und Zeilenangabe oder Konsolenausgabe.
Wenn Sonnet etwas als unklar markiert → Rückfrage, nicht stille
Annahme.

Zusätzlich: Sonnet schickt im Fertig-Bericht die letzte Konsolen-
Ausgabe des Skript-Laufs (die Zeilen unter „OK: N Profile -> …")
und die ersten 2 Profile als JSON-Auszug, damit die Werte gemeinsam
durchgesehen werden können, bevor BA 215 startet.

## Hinweise

- TinySOL-Lizenz ist **Creative Commons BY 4.0**. Das JSON enthält
  diese Quellenangabe; die Audio-Samples selbst werden nicht ins
  Repository eingecheckt.
- Falls `pip install` an einer Stelle scheitert (z. B. fehlende
  System-Bibliothek `libsndfile` für `soundfile`), das melden, nicht
  selbst Workarounds bauen — wir entscheiden dann, ob wir die Methode
  ändern oder die Voraussetzung schaffen.

## Folge-BA (Hinweis)

BA 215 wird:
- aus `docs/richtone_profiles.json` JS-Konstanten generieren bzw.
  das JSON zur Laufzeit laden,
- `playRichTone` zu `playRichToneProfile(c, hz, vol, ms, pan, profile,
  ramp)` umbauen und 14 dünne Wrapper `playRich<Abbr>Tone(...)`
  erzeugen,
- Registries (`file.js`, `init.js`, `test-ui.js` an 3 Stellen + Map,
  `print-md.js`) erweitern,
- **nur deutsche** Labels in `i18n/de.js` ergänzen (en/fr/es kommen
  in einer Mini-BA „Übersetzungen richTone-Profile" nachher),
- `js/version.js` auf `3.2.215-beta` setzen,
- SPEC in `docs/spec/02-messung.md` aktualisieren.
