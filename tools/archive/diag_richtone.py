#!/usr/bin/env python3
"""Diagnose-Skript fuer richTone-Profile.

Vergleicht drei Vibrato-Detektor-Methoden auf einzelnen TinySOL-Samples:
  (1) FFT ueber die gesamte F0-Cent-Kurve (aktuelle Methode in analyze_tinysol.py)
  (2) STFT in 1s-Fenstern, Peak pro Fenster
  (3) Autokorrelation der F0-Cent-Kurve mit Peak im Vibrato-Periodenbereich

Pro Sample zusaetzlich ASCII-Plot der F0-Cent-Kurve, damit per Sicht
nachvollziehbar ist, ob ueberhaupt Vibrato im Sample steckt.

Lauf:    python3 tools/diag_richtone.py
Ausgabe: Text auf stdout.
"""
import csv
import sys
from pathlib import Path

import numpy as np
import librosa

TINYSOL_ROOT = Path("/mnt/xbox/lauscher/voice/TinySOL")
META_CSV     = TINYSOL_ROOT / "TinySOL_metadata.csv"

HOP        = 512
VIB_MIN_HZ = 3.0
VIB_MAX_HZ = 8.0

INSTRUMENTS = ["Vn", "Va", "Vc", "Fl", "Ob", "ClBb"]
N_SAMPLES_PER_INSTR = 6


def load_meta():
    with META_CSV.open(encoding="utf-8") as f:
        return list(csv.DictReader(f))


def pick_samples_wide(meta, instr, n):
    """Samples breit ueber den verfuegbaren Pitch-Range verteilen."""
    pool = [
        r for r in meta
        if r["Instrument (abbr.)"] == instr
        and r["Technique (abbr.)"] == "ord"
        and r["Dynamics"] == "mf"
        and r.get("Needed digital retuning", "FALSE") == "FALSE"
    ]
    if not pool:
        return []
    by_pid = {}
    for r in pool:
        pid = int(r["Pitch ID"])
        by_pid.setdefault(pid, []).append(r)
    pids = sorted(by_pid.keys())
    if len(pids) <= n:
        chosen_pids = pids
    else:
        step = (len(pids) - 1) / (n - 1)
        chosen_pids = [pids[round(i * step)] for i in range(n)]
    chosen = []
    for pid in chosen_pids:
        chosen.append(by_pid[pid][0])
    return chosen


def compute_f0_cents(y, sr):
    f0, voiced, _ = librosa.pyin(
        y, fmin=40, fmax=8000, sr=sr, frame_length=2048, hop_length=HOP
    )
    voiced_mask = ~np.isnan(f0)
    if voiced_mask.sum() < 20:
        return None, None, None
    f0_v   = f0[voiced_mask]
    f0_med = float(np.median(f0_v))
    voiced_idx = np.where(voiced_mask)[0]
    i_start = voiced_idx[int(len(voiced_idx) * 0.1)]
    i_end   = voiced_idx[int(len(voiced_idx) * 0.8)]
    # nur die voiced frames im stationaeren Mittelteil, NaN durch Median ersetzen
    seg = f0[i_start:i_end].copy()
    seg_voiced = ~np.isnan(seg)
    if seg_voiced.sum() < 16:
        return None, None, None
    seg[~seg_voiced] = f0_med
    cents = 1200.0 * np.log2(seg / f0_med)
    cents -= np.mean(cents)
    frame_rate = sr / HOP
    return cents, f0_med, frame_rate


def method_fft(cents, frame_rate):
    if len(cents) < 16:
        return None
    spec  = np.abs(np.fft.rfft(cents - np.mean(cents)))
    freqs = np.fft.rfftfreq(len(cents), 1.0 / frame_rate)
    mask  = (freqs > VIB_MIN_HZ) & (freqs < VIB_MAX_HZ)
    if not mask.any():
        return None
    in_mask    = spec[mask]
    freqs_mask = freqs[mask]
    peak_idx   = int(np.argmax(in_mask))
    peak_freq  = float(freqs_mask[peak_idx])
    peak_amp   = float(in_mask.max())
    med        = float(np.median(in_mask))
    prom       = peak_amp / max(med, 1e-9)
    vib_cents  = float(np.std(cents) * np.sqrt(2))
    return {
        "vibHz":     round(peak_freq, 2),
        "vibCents":  round(vib_cents, 2),
        "prom":      round(prom, 2),
        "peakAmp":   round(peak_amp, 2),
        "binsInBand": int(mask.sum()),
    }


def method_stft(cents, frame_rate, win_sec=1.0, hop_sec=0.25):
    win = int(win_sec * frame_rate)
    hop = int(hop_sec * frame_rate)
    if len(cents) < win or win < 16:
        return None
    peaks, proms, cents_list = [], [], []
    for i in range(0, len(cents) - win + 1, hop):
        seg = cents[i:i + win]
        seg = seg - np.mean(seg)
        spec  = np.abs(np.fft.rfft(seg * np.hanning(len(seg))))
        freqs = np.fft.rfftfreq(len(seg), 1.0 / frame_rate)
        mask  = (freqs > VIB_MIN_HZ) & (freqs < VIB_MAX_HZ)
        if not mask.any():
            continue
        in_mask   = spec[mask]
        freqs_mk  = freqs[mask]
        peak_idx  = int(np.argmax(in_mask))
        peak_freq = float(freqs_mk[peak_idx])
        peak_amp  = float(in_mask.max())
        med       = float(np.median(in_mask))
        prom      = peak_amp / max(med, 1e-9)
        peaks.append(peak_freq)
        proms.append(prom)
        cents_list.append(float(np.std(seg) * np.sqrt(2)))
    if not peaks:
        return None
    proms_a = np.array(proms)
    return {
        "vibHz_med":   round(float(np.median(peaks)), 2),
        "vibHz_max":   round(float(np.max(peaks)), 2),
        "vibCents_med": round(float(np.median(cents_list)), 2),
        "prom_med":    round(float(np.median(proms_a)), 2),
        "prom_max":    round(float(np.max(proms_a)), 2),
        "n_win":       len(peaks),
        "n_prom_ge3":  int(np.sum(proms_a >= 3.0)),
    }


def method_autocorr(cents, frame_rate):
    if len(cents) < 32:
        return None
    x = cents - np.mean(cents)
    norm = float(np.dot(x, x))
    if norm <= 0:
        return None
    ac = np.correlate(x, x, mode="full")
    ac = ac[len(ac) // 2:] / norm
    lags_sec = np.arange(len(ac)) / frame_rate
    min_lag = 1.0 / VIB_MAX_HZ
    max_lag = 1.0 / VIB_MIN_HZ
    mask = (lags_sec >= min_lag) & (lags_sec <= max_lag)
    if not mask.any():
        return None
    ac_mask  = ac[mask]
    lags_mk  = lags_sec[mask]
    peak_idx = int(np.argmax(ac_mask))
    peak_lag = float(lags_mk[peak_idx])
    peak_val = float(ac_mask.max())
    return {
        "vibHz":         round(1.0 / peak_lag, 2),
        "autocorrPeak":  round(peak_val, 3),
    }


def ascii_plot(cents, width=78, height=8):
    if len(cents) < 2:
        return "  (zu kurz)"
    step    = max(1, len(cents) // width)
    samples = np.array([float(cents[i]) for i in range(0, len(cents), step)][:width])
    lo, hi  = float(samples.min()), float(samples.max())
    span    = hi - lo
    if span < 0.5:
        return f"  (flach, Span {span:.2f} Cent ueber {len(cents)} Frames)"
    grid    = [[" "] * len(samples) for _ in range(height)]
    for x, val in enumerate(samples):
        y = int((height - 1) - (val - lo) / span * (height - 1))
        y = max(0, min(height - 1, y))
        grid[y][x] = "*"
    rows = ["  " + "".join(r) for r in grid]
    rows.append(f"  Span={span:.1f} Cent, std={float(np.std(samples)):.2f} Cent")
    return "\n".join(rows)


def analyze(wav_path):
    y, sr = librosa.load(str(wav_path), sr=None, mono=True)
    cents, f0_med, fr = compute_f0_cents(y, sr)
    if cents is None:
        return None
    return {
        "f0":         round(f0_med, 1),
        "n_frames":   len(cents),
        "duration_s": round(len(cents) / fr, 2),
        "frame_rate": round(fr, 1),
        "fft":        method_fft(cents, fr),
        "stft":       method_stft(cents, fr),
        "autocorr":   method_autocorr(cents, fr),
        "ascii":      ascii_plot(cents),
    }


def main():
    meta = load_meta()
    for instr in INSTRUMENTS:
        chosen = pick_samples_wide(meta, instr, N_SAMPLES_PER_INSTR)
        print()
        print("=" * 90)
        print(f"  {instr}  ({len(chosen)} Samples, breit ueber Pitch-Range verteilt)")
        print("=" * 90)
        for row in chosen:
            wav = TINYSOL_ROOT / row["Path"]
            if not wav.exists():
                print(f"\n  FEHLT: {row['Path']}")
                continue
            r = analyze(wav)
            if not r:
                print(f"\n  {row['Pitch']:>5}  -> Analyse fehlgeschlagen ({row['Path']})")
                continue
            tag_str = row.get("String ID (if applicable)") or "-"
            print()
            print(f"  --- Pitch={row['Pitch']:<4}  PID={row['Pitch ID']:>3}  String={tag_str:<3}  {row['Path']}")
            print(f"      f0={r['f0']} Hz   dur={r['duration_s']}s   {r['n_frames']} F0-Frames @ {r['frame_rate']} Hz")
            fft = r["fft"]
            if fft:
                print(f"      FFT:        vibHz={fft['vibHz']:>5}  vibCents={fft['vibCents']:>6}  prom={fft['prom']:>6}   (bins im Band: {fft['binsInBand']}, peakAmp={fft['peakAmp']})")
            else:
                print(f"      FFT:        n/a")
            st = r["stft"]
            if st:
                print(f"      STFT (1s):  vibHz_med={st['vibHz_med']:>5}  vibCents_med={st['vibCents_med']:>6}  prom_med={st['prom_med']:>5}  prom_max={st['prom_max']:>5}  ({st['n_prom_ge3']}/{st['n_win']} Fenster prom>=3)")
            else:
                print(f"      STFT (1s):  n/a")
            ac = r["autocorr"]
            if ac:
                print(f"      Autocorr:   vibHz={ac['vibHz']:>5}  autocorrPeak={ac['autocorrPeak']}")
            else:
                print(f"      Autocorr:   n/a")
            print("      F0-Cent-Kurve (stationaerer Mittelteil):")
            print(r["ascii"])


if __name__ == "__main__":
    main()
