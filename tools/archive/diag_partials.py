#!/usr/bin/env python3
"""Diagnose-Skript fuer Partials-Auffaelligkeiten in richTone-Profilen.

Vergleicht pro Sample vier Varianten der Amplitudenbestimmung:
  (A) max im +/-20 Cent Fenster   <- aktuelle Methode in analyze_tinysol.py
  (B) max im +/-50 Cent Fenster   <- breiteres Fenster
  (C) Energie-Summe (RMS) im +/-20 Cent Fenster
  (D) Energie-Summe (RMS) im +/-50 Cent Fenster

Zusaetzlich pro Sample:
  - spektrale Aufloesung (Hz/bin) -> sagt, wie eng das +/-20 Cent Fenster real ist
  - Anzahl pyin-Spruenge > 500 Cent zwischen Frames -> Oktavsprung-Indikator
  - F0-Spannweite der voiced Frames in Cent

Lauf:    python3 tools/diag_partials.py
Ausgabe: Text auf stdout.

Wegwerf-Diagnose im Kontext der BA-218-Klaerung.
"""
import csv
import sys
from pathlib import Path

import numpy as np
import librosa

TINYSOL_ROOT = Path("/mnt/xbox/lauscher/voice/TinySOL")
META_CSV     = TINYSOL_ROOT / "TinySOL_metadata.csv"
HOP          = 512
N_HARMS      = 12

INSTRUMENTS         = ["BTb", "Tbn", "Cb", "Bn", "Ob", "Acc"]
N_SAMPLES_PER_INSTR = 4


def load_meta():
    with META_CSV.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def pick_samples(meta, instr, n):
    pool = [
        r for r in meta
        if r["Instrument (abbr.)"] == instr
        and r["Technique (abbr.)"] == "ord"
        and r["Dynamics"] == "mf"
    ]
    if not pool:
        return []
    by_pid = {}
    for r in pool:
        pid = int(r["Pitch ID"])
        by_pid.setdefault(pid, []).append(r)
    pids = sorted(by_pid.keys())
    if len(pids) <= n:
        chosen = pids
    else:
        step = (len(pids) - 1) / (n - 1)
        chosen = [pids[round(i * step)] for i in range(n)]
    return [by_pid[p][0] for p in chosen]


def analyze(wav_path):
    y, sr = librosa.load(str(wav_path), sr=None, mono=True)
    if len(y) < sr // 4:
        return None
    f0, voiced, _ = librosa.pyin(
        y, fmin=40, fmax=8000, sr=sr, frame_length=2048, hop_length=HOP
    )
    voiced_idx = np.where(~np.isnan(f0))[0]
    if len(voiced_idx) < 20:
        return None
    f0_v   = f0[~np.isnan(f0)]
    f0_med = float(np.median(f0_v))

    # pyin-Stabilitaet: Spruenge > 500 Cent zwischen aufeinanderfolgenden voiced Frames
    if len(f0_v) >= 2:
        ratios     = f0_v[1:] / f0_v[:-1]
        cents_diff = 1200.0 * np.log2(np.clip(ratios, 1e-9, None))
        n_jumps    = int(np.sum(np.abs(cents_diff) > 500))
    else:
        n_jumps = 0
    span_voiced = float(1200.0 * np.log2(f0_v.max() / max(f0_v.min(), 1e-9)))

    i_start = voiced_idx[int(len(voiced_idx) * 0.1)]
    i_end   = voiced_idx[int(len(voiced_idx) * 0.8)]
    s_start = i_start * HOP
    s_end   = min(len(y), i_end * HOP)
    y_mid   = y[s_start:s_end]
    if len(y_mid) < 1024:
        return None

    window = np.hanning(len(y_mid))
    spec   = np.abs(np.fft.rfft(y_mid * window))
    freqs  = np.fft.rfftfreq(len(y_mid), 1.0 / sr)
    df_bin = freqs[1] - freqs[0]

    def harm_amp(target, cents, mode):
        df   = target * (2 ** (cents / 1200.0) - 1)
        mask = (freqs > target - df) & (freqs < target + df)
        if not mask.any():
            return None, 0
        if mode == "max":
            return float(spec[mask].max()), int(mask.sum())
        else:  # "int"
            return float(np.sqrt(np.sum(spec[mask] ** 2))), int(mask.sum())

    rows = []
    for h in range(1, N_HARMS + 1):
        target = f0_med * h
        if target > sr / 2 * 0.9:
            break
        max20, nb20 = harm_amp(target, 20, "max")
        max50, _    = harm_amp(target, 50, "max")
        int20, _    = harm_amp(target, 20, "int")
        int50, _    = harm_amp(target, 50, "int")
        rows.append({
            "h":      h,
            "target": target,
            "max20":  max20,
            "max50":  max50,
            "int20":  int20,
            "int50":  int50,
            "nb20":   nb20,
        })

    return {
        "f0":          f0_med,
        "spec_res_hz": df_bin,
        "n_jumps":     n_jumps,
        "span_voiced": span_voiced,
        "n_voiced":    len(voiced_idx),
        "partials":    rows,
    }


def print_sample(row, r):
    print()
    print(f"  --- Pitch={row['Pitch']:<5} PID={row['Pitch ID']:>3}  retune={row.get('Needed digital retuning','?'):<5}  {row['Path']}")
    print(f"      f0={r['f0']:.1f} Hz   spec_res={r['spec_res_hz']:.3f} Hz/bin   pyin-Spruenge>500c: {r['n_jumps']}   voiced-Span: {r['span_voiced']:.0f} Cent")
    if not r["partials"]:
        return
    a1_max20 = r["partials"][0]["max20"]
    a1_max50 = r["partials"][0]["max50"]
    a1_int20 = r["partials"][0]["int20"]
    a1_int50 = r["partials"][0]["int50"]
    def rel(v, a1):
        if v is None or a1 is None or a1 <= 0:
            return "  n/a "
        return f"{v / a1:>6.3f}"
    print("       h | rel_max_20c | rel_max_50c | rel_int_20c | rel_int_50c | bins20")
    print("      ---+-------------+-------------+-------------+-------------+-------")
    for p in r["partials"]:
        print(f"      {p['h']:>2} |   {rel(p['max20'], a1_max20)}    |   {rel(p['max50'], a1_max50)}    |   {rel(p['int20'], a1_int20)}    |   {rel(p['int50'], a1_int50)}    |  {p['nb20']:>3}")


def main():
    meta = load_meta()
    for instr in INSTRUMENTS:
        chosen = pick_samples(meta, instr, N_SAMPLES_PER_INSTR)
        if not chosen:
            print(f"\n{instr}: keine Samples")
            continue
        print()
        print("=" * 96)
        print(f"  {instr}  ({len(chosen)} Samples breit ueber Pitch-Range verteilt)")
        print("=" * 96)
        for row in chosen:
            wav = TINYSOL_ROOT / row["Path"]
            if not wav.exists():
                print(f"\n  FEHLT: {row['Path']}")
                continue
            r = analyze(wav)
            if not r:
                print(f"\n  {row['Pitch']:>5}  -> Analyse fehlgeschlagen")
                continue
            print_sample(row, r)


if __name__ == "__main__":
    main()
