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
