# BAUANLEITUNG 215a — Audit-Export: Original und Synth-Varianten je Profil

## Ziel

Vor BA 215 (Code-Integration der richTone-Profile in den Tonsynth)
ein lokales Audit ermöglichen: pro Instrument werden der TinySOL-
Original-Klang und zwei Synth-Varianten als WAV-Dateien in einen
Ordner abgelegt. Damit kann durch Probehören entschieden werden,
ob die Profile aus `docs/richtone_profiles.json` direkt verwendbar
sind oder vor BA 215 noch manuell justiert werden müssen.

BA 215a ist **reine Tool-/Doku-Arbeit**: ein Python-Skript unter
`tools/`, WAV-Output unter `audit/`. Es wird kein Lauf-Code
verändert, kein Versionsbump in `js/version.js`.

## Voraussetzungen

- BA 214 abgeschlossen, `docs/richtone_profiles.json` mit 14
  Profilen vorhanden.
- Gleiche Python-Umgebung wie BA 214 (librosa, numpy, scipy,
  soundfile).
- TinySOL entpackt unter `/mnt/xbox/lauscher/voice/TinySOL/`.

## Schritt 1 — Verzeichnis vorbereiten

Im Repository-Root:
```
mkdir -p audit
```

Das `audit/`-Verzeichnis ist temporäres Probehör-Material und gehört
nicht ins Repository (siehe Schritt 4 .gitignore).

## Schritt 2 — Skript `tools/export_audit_wavs.py`

Komplette Datei wie folgt anlegen:

```python
#!/usr/bin/env python3
"""
Audit-Export pro Instrument-Profil:
  original.wav     -- TinySOL-Sample (mittleres von 3), gekuerzt auf DURATION_S
  synth_basic.wav  -- nur Harmonische + 50ms Cos2-Rampe (Tool-Default)
  synth_full.wav   -- Harmonische + Vibrato + AM + Profil-Attack

Lauf:    python3 tools/export_audit_wavs.py
Ausgabe: audit/<Instr>/{original,synth_basic,synth_full}.wav
         audit/index.md
"""
import json
import sys
from pathlib import Path

import numpy as np
import librosa
import soundfile as sf

TINYSOL_ROOT  = Path("/mnt/xbox/lauscher/voice/TinySOL")
PROFILES_JSON = Path(__file__).resolve().parent.parent / "docs" / "richtone_profiles.json"
OUT_ROOT      = Path(__file__).resolve().parent.parent / "audit"

SAMPLE_RATE     = 44100
DURATION_S      = 2.0
DEFAULT_RAMP_MS = 50.0   # entspricht applyCosRamp Default in js/audio.js
PEAK_TARGET     = 0.7    # ca. -3 dBFS Lautheits-Anker
HOP             = 512
F0_MIN          = 40.0
F0_MAX          = 8000.0


def cos2_rise(n):
    """sin^2 / Hann-Anstieg, n Samples lang. Werte 0..1."""
    if n <= 1:
        return np.ones(max(1, n))
    x = np.arange(n) / (n - 1)
    return 0.5 - 0.5 * np.cos(np.pi * x)


def apply_envelope(signal, sr, attack_ms, decay_ms=DEFAULT_RAMP_MS):
    """Cos2-Anstieg ueber attack_ms, Cos2-Abfall ueber decay_ms.
    Begrenzt automatisch auf max. len/2 Samples pro Seite, damit
    Anstieg und Abfall sich nicht ueberlappen."""
    n = len(signal)
    env = np.ones(n)
    a_n = min(int(round(sr * attack_ms / 1000.0)), n // 2)
    d_n = min(int(round(sr * decay_ms  / 1000.0)), n // 2)
    if a_n > 0:
        env[:a_n] = cos2_rise(a_n)
    if d_n > 0:
        env[-d_n:] = cos2_rise(d_n)[::-1]
    return signal * env


def synth_richtone(f0, sr, duration_s, partials,
                   vibratoHz=0.0, vibratoCents=0.0,
                   amHz=0.0, amDepth=0.0,
                   attackMs=DEFAULT_RAMP_MS):
    """Erzeugt einen richTone-Synth-Signal aus den Profil-Parametern.
    Spiegelbild der spaeteren Web-Audio-Implementierung in BA 215."""
    n = int(sr * duration_s)
    t = np.arange(n) / sr

    # Vibrato: Frequenz-Modulation in Cent
    if vibratoHz > 0 and vibratoCents > 0:
        vib = np.sin(2 * np.pi * vibratoHz * t)
        f_inst = f0 * np.power(2.0, vib * vibratoCents / 1200.0)
    else:
        f_inst = np.full(n, f0)

    phase = 2 * np.pi * np.cumsum(f_inst) / sr

    # Harmonische summieren
    total_amp = sum(p["amp"] for p in partials) or 1.0
    signal   = np.zeros(n)
    nyquist  = sr * 0.45
    for p in partials:
        mult = p["mult"]
        if mult * f0 < nyquist:
            signal += (p["amp"] / total_amp) * np.sin(mult * phase)

    # Atem-AM (RMS-Modulation)
    if amHz > 0 and amDepth > 0:
        d = min(amDepth, 1.0)
        am_env = (1.0 - d / 2.0) + (d / 2.0) * np.sin(2 * np.pi * amHz * t)
        signal *= am_env

    # Cos2-Huellkurve (Attack aus Profil, Decay fest DEFAULT_RAMP_MS)
    signal = apply_envelope(signal, sr, attackMs, decay_ms=DEFAULT_RAMP_MS)

    # Peak-Normalisieren auf PEAK_TARGET
    peak = float(np.max(np.abs(signal)))
    if peak > 0:
        signal = PEAK_TARGET * signal / peak
    return signal.astype(np.float32)


def prepare_original(profile, sr_target, duration_s):
    """Original-WAV laden, F0 schaetzen, auf duration_s schneiden/erweitern,
    peak-normalisieren."""
    paths = profile.get("samples", [])
    if not paths:
        return None, None
    mid_path = TINYSOL_ROOT / paths[len(paths) // 2]
    if not mid_path.exists():
        return None, None
    y, sr = librosa.load(str(mid_path), sr=sr_target, mono=True)
    if len(y) < sr // 4:
        return None, None

    f0, _, _ = librosa.pyin(
        y, fmin=F0_MIN, fmax=F0_MAX, sr=sr,
        frame_length=2048, hop_length=HOP,
    )
    f0_v = f0[~np.isnan(f0)]
    if len(f0_v) < 10:
        return None, None
    f0_med = float(np.median(f0_v))

    n = int(sr * duration_s)
    if len(y) >= n:
        y = y[:n]
    else:
        y = np.concatenate([y, np.zeros(n - len(y))])

    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = PEAK_TARGET * y / peak

    return y.astype(np.float32), f0_med


def main():
    if not PROFILES_JSON.exists():
        print(f"FEHLER: {PROFILES_JSON} nicht gefunden", file=sys.stderr)
        sys.exit(1)
    data = json.loads(PROFILES_JSON.read_text(encoding="utf-8"))
    profiles = data.get("profiles", {})
    if not profiles:
        print("FEHLER: keine Profile in JSON", file=sys.stderr)
        sys.exit(1)

    OUT_ROOT.mkdir(parents=True, exist_ok=True)

    rows = []
    for instr, p in profiles.items():
        out_dir = OUT_ROOT / instr
        out_dir.mkdir(parents=True, exist_ok=True)

        orig, f0 = prepare_original(p, SAMPLE_RATE, DURATION_S)
        if orig is None or f0 is None:
            print(f"  {instr}: kein Original verfuegbar", file=sys.stderr)
            continue
        sf.write(out_dir / "original.wav", orig, SAMPLE_RATE, subtype="PCM_16")

        # Synth basic: nur Harmonische, Default 50ms Cos2-Rampe
        basic = synth_richtone(
            f0, SAMPLE_RATE, DURATION_S, p["partials"],
            vibratoHz=0, vibratoCents=0, amHz=0, amDepth=0,
            attackMs=DEFAULT_RAMP_MS,
        )
        sf.write(out_dir / "synth_basic.wav", basic, SAMPLE_RATE, subtype="PCM_16")

        # Synth full: alles aus Profil
        attack_full = max(DEFAULT_RAMP_MS, float(p.get("attackMs", DEFAULT_RAMP_MS)))
        full = synth_richtone(
            f0, SAMPLE_RATE, DURATION_S, p["partials"],
            vibratoHz=float(p.get("vibratoHz", 0)),
            vibratoCents=float(p.get("vibratoCents", 0)),
            amHz=float(p.get("amHz", 0)),
            amDepth=float(p.get("amDepth", 0)),
            attackMs=attack_full,
        )
        sf.write(out_dir / "synth_full.wav", full, SAMPLE_RATE, subtype="PCM_16")

        vib_str = (f"{p['vibratoHz']} Hz / {p['vibratoCents']} c"
                   if p.get("vibratoHz", 0) > 0 else "-")
        am_str  = (f"{p['amHz']} Hz / {p['amDepth']}"
                   if p.get("amHz", 0) > 0 else "-")
        rows.append((instr, f0, len(p["partials"]), vib_str, am_str, p.get("attackMs", 0)))
        print(f"  {instr}: F0={f0:.1f} Hz, partials={len(p['partials'])}", file=sys.stderr)

    # index.md schreiben
    lines = [
        "# Audit-Export",
        "",
        f"Dauer pro WAV: {DURATION_S} s, Sample-Rate {SAMPLE_RATE} Hz, peak-normalisiert auf {PEAK_TARGET}.",
        "Synth-Tonhoehe = F0 des mittleren TinySOL-Samples (Direkt-Vergleich Original vs. Synth).",
        "",
        "| Instr | Sample-F0 | partials | Vibrato | AM | Attack ms |",
        "|---|---|---|---|---|---|",
    ]
    for instr, f0, np_, vib, am, atk in rows:
        lines.append(f"| {instr} | {f0:.1f} Hz | {np_} | {vib} | {am} | {atk:.0f} |")
    (OUT_ROOT / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"OK: {len(rows)} Instrumente -> {OUT_ROOT}")


if __name__ == "__main__":
    main()
```

Hinweise zum Skript:

- **Synth-Tonhöhe ist die F0 des Original-Samples**, nicht 440 Hz.
  Direkt-Vergleich Original vs. Synth auf gleicher Tonhöhe ist
  aussagekräftiger als ein Cross-Pitch-Vergleich.
- **`synth_basic`** = Harmonische + 50 ms Cos²-Rampe. Das entspricht
  genau dem, was `playRichTone` in `js/audio.js` heute tun würde,
  wenn man Vibrato/AM weglässt — also die Basis-Reproduktion.
- **`synth_full`** = alles aus dem Profil, mit `attackMs` aus dem
  Profil (mindestens `DEFAULT_RAMP_MS`). Bei Streichern (Va 685 ms,
  Vn 871 ms) wird die Rampe automatisch auf `Dauer/2 = 1000 ms`
  gecappt; das macht die Charakteristik „langer Anschlag" hörbar
  ohne das Signal zu zerreißen.
- **Format**: 16-bit PCM Mono, gleiche Sample-Rate wie TinySOL.
- ASCII-Kommentare im Code, damit das Skript robust gegen
  Encoding-Probleme bleibt.

## Schritt 3 — Ausführen

```
python3 tools/export_audit_wavs.py
```

Erwartete Konsolen-Ausgabe (gekürzt):
```
  Acc: F0=..., partials=12
  ASax: F0=..., partials=12
  ...
  Vn: F0=..., partials=12
OK: 14 Instrumente -> .../audit
```

## Schritt 4 — `.gitignore` ergänzen

Wenn nicht bereits enthalten, am Ende der `.gitignore` hinzufügen:
```
/audit/
```

Die Audit-WAVs sind lokal und enthalten Material aus TinySOL
(CC-BY-4.0); sie gehören nicht ins Repository.

## Schritt 5 — Hör-Anleitung an den Nutzer

Sonnet schreibt im Fertig-Bericht eine knappe Hör-Anleitung:

> Pro Instrument in `audit/<Instr>/` drei WAVs anhören, am besten in
> der Reihenfolge **original → synth_basic → synth_full**. Pro
> Instrument einen kurzen Eindruck festhalten:
>
> - Klingt `synth_basic` schon „nah genug" am Original, oder fehlt
>   etwas Wichtiges?
> - Bringt `synth_full` einen hörbaren Mehrwert gegenüber
>   `synth_basic` (Vibrato bei Va/Vc, langer Attack bei
>   Streichern/Bläsern)?
> - Stört der lange Attack im `synth_full`, oder ist er stimmig?
> - Fällt ein Instrument durch Mess-Artefakte unangenehm auf
>   (z. B. Bn mit H2/H3-Dominanz)?
>
> Sonnet macht keine Hör-Bewertung selbst — der Eindruck wird vom
> Nutzer zurückgegeben.

## Akzeptanztest

1. `tools/export_audit_wavs.py` existiert. ✅ / ❌
2. Skript läuft ohne unbehandelte Exceptions durch. ✅ / ❌
3. `audit/` enthält 14 Unterordner, einer pro Instrument
   (Acc, ASax, Bn, BTb, Cb, ClBb, Fl, Hn, Ob, Tbn, TpC, Va, Vc, Vn).
   ✅ / ❌
4. Jeder Unterordner hat genau 3 WAVs: `original.wav`,
   `synth_basic.wav`, `synth_full.wav`. ✅ / ❌
5. Jede WAV hat ca. `SAMPLE_RATE * DURATION_S` Samples (≈ 88200
   bei 44100 Hz × 2 s). Überprüfung mit
   `python3 -c "import soundfile as sf; print(sf.info('audit/Vn/original.wav'))"`.
   ✅ / ❌
6. `audit/index.md` existiert und enthält die Übersichts-Tabelle
   mit 14 Daten-Zeilen. ✅ / ❌
7. Stichprobe Vn: `synth_basic.wav` und `synth_full.wav` sind
   **nicht** bit-identisch (mind. der Attack-Time-Unterschied
   sollte hörbar bzw. messbar sein). Quick-Check:
   ```
   python3 -c "import soundfile as sf, numpy as np;
   a=sf.read('audit/Vn/synth_basic.wav')[0];
   b=sf.read('audit/Vn/synth_full.wav')[0];
   print('diff:', float(np.max(np.abs(a-b))))"
   ```
   Wert > 0 erwartet. ✅ / ❌
8. `js/version.js` ist unverändert (immer noch `3.2.213.4-beta`).
   ✅ / ❌

## Selbstprüfungs-Auftrag

Sonnet geht **vor der Fertig-Meldung** die acht Akzeptanz-Punkte
einzeln durch und meldet pro Punkt erfüllt / nicht erfüllt /
unklar, mit Datei-/Pfadangabe oder Konsolenausgabe.

Im Fertig-Bericht den Inhalt von `audit/index.md` mitschicken, plus
die Konsolen-Ausgabe des Skript-Laufs.

## Hinweis auf Folge-BAs

- **Vor BA 215**: Der Nutzer hört die WAVs durch und entscheidet, ob
  einzelne Profile in `docs/richtone_profiles.json` vor der
  Integration manuell justiert werden müssen (z. B. Vn-Vibrato
  ergänzen, Bn-Harmonische glätten, Streicher-Attack-Zeit kürzen).
  Diese Tunings macht der Nutzer manuell im JSON und sind nicht
  Teil einer BA.
- **BA 215**: Integration der (eventuell getunten) JSON-Profile als
  Tontypen `richVc`, `richVn`, `richAcc`... in `js/audio.js`, plus
  Registries und deutsche i18n-Labels. Versionsbump auf
  `3.2.215-beta`.
- **BA 216 (Mini)**: Übersetzungen EN/FR/ES für die 14 neuen
  Tontypen.
