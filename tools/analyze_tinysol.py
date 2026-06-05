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
VIB_MIN_HZ = 3.0  # physiologische Untergrenze fuer Vibrato. Diskriminierung Vibrato vs. Tremulant erfolgt ueber Peak-Prominenz im Spektrum, siehe analyze_sample.
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
        if vib_mask.any():
            vib_in_mask = vib_spec[vib_mask]
            peak_amp = float(vib_in_mask.max())
            med_amp  = float(np.median(vib_in_mask))
            prom = peak_amp / max(med_amp, 1e-9)
            # Echtes Vibrato hat einen scharfen Peak; Akkordeon-Tremulant
            # und Schwebungen zeigen sich als breitbandiges Rauschen ohne
            # ausgeprägten Peak. Schwelle: Peak >= 3x Median im Suchfenster.
            prominent = prom >= 3.0
            if prominent and peak_amp > 0.5:
                vib_idx      = int(np.argmax(np.where(vib_mask, vib_spec, 0)))
                vibratoHz    = float(vib_freqs[vib_idx])
                vibratoCents = float(np.std(f0_cents) * np.sqrt(2))
            else:
                vibratoHz, vibratoCents = 0.0, 0.0
            vibratoProm = round(prom, 2)
        else:
            vibratoHz, vibratoCents, vibratoProm = 0.0, 0.0, 0.0
    else:
        vibratoHz, vibratoCents, vibratoProm = 0.0, 0.0, 0.0
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
        "vibratoProm":  vibratoProm,
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
        "vibratoProm":  round(float(np.median([s["vibratoProm"]  for s in valid])), 2),
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
