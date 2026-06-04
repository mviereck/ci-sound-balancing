#!/usr/bin/env python3
"""
musan_noise_enrich.py — Stage-2-Anreicherung der MUSAN-Geräusch-Manifeste
=========================================================================

Liest optional eine Anreicherungs-Datei mit kind/stationary/loop_safe-Tags
pro Item und schreibt sie in die zugehörigen Geräusch-Manifeste unter
audio.manifest/musan/geraeusche/. Ohne Anreicherungs-Datei läuft die
Auto-Klassifikation (Sidecars + Signal-Analyse).

build_manifests.py setzt diese Felder zunächst auf null, weil MUSAN
selbst keine Klassen-Tags liefert. Anreicherung ist daher Pflicht,
sobald die UI nach Geräuschart filtern können soll.

Reihenfolge
-----------

    1. build_manifests.py           → MUSAN-Manifeste mit null-Tags
    2. musan_noise_enrich.py        → Klassen drüberlegen

Aufruf
------

    python3 scripts/musan_noise_enrich.py \\
        --enrichment scripts/musan_noise_enrichment.json \\
        --manifests audio.manifest/musan/geraeusche
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from pathlib import Path

try:
    import numpy as np
    import soundfile as sf
    SIGNAL_AVAILABLE = True
except ImportError:
    SIGNAL_AVAILABLE = False

DEFAULT_ENRICH = Path(__file__).resolve().parent / "musan_noise_enrichment.json"
DEFAULT_MANIFESTS = (Path(__file__).resolve().parents[1]
                     / "audio.manifest/musan/geraeusche")
DEFAULT_MIRROR = Path("/mnt/xbox/lauscher/voice")

ENRICH_KEYS = ("kind", "stationary", "loop_safe", "spectrum",
               "dominant_freq_hz", "level_db", "notes")

# Title-Keyword -> kind. Reihenfolge ist relevant: spezifischer zuerst.
TITLE_TO_KIND = [
    (r"\b(white noise|pink noise|brown noise)(?:s|ing|ed|er)?\b",
     "rauschen-weiss"),
    (r"\b(sine|sine wave|tone|test signal|sweep)(?:s|ing|ed|er)?\b",
     "test-ton"),
    (r"\b(applause|audience|crowd|stadium|cheer|spectator)(?:s|ing|ed|er)?\b",
     "crowd"),
    (r"\b(cafe|coffee shop|restaurant|bar interior|pub)(?:s|ing|ed|er)?\b",
     "cafe"),
    (r"\b(babble|chatter|conversation|talk|whisper)(?:s|ing|ed|er)?\b",
     "babble"),
    (r"\b(dog|cat|bird|cricket|cow|sheep|frog|chicken|rooster|"
     r"horse|whale|wolf|owl|duck|cicada|insect|monkey|"
     r"lion|tiger|seagull|crow|sparrow)(?:s|ing|ed|er)?\b",
     "tier"),
    (r"\b(rain|wind|thunder|storm|hail|water drip|drizzle|"
     r"raindrop|breeze|gust)(?:s|ing|ed|er)?\b",
     "wetter"),
    (r"\b(car|truck|train|airplane|jet|motorcycle|bus|engine|"
     r"traffic|horn|siren|tire|brake|skid|bicycle|cycle|"
     r"helicopter|propeller)(?:s|ing|ed|er)?\b",
     "verkehr"),
    (r"\b(door|glass|dish|vacuum|microwave|fridge|kettle|"
     r"alarm clock|telephone|phone|toilet|flush|sink|faucet|"
     r"clock|tick|footstep|knock|key|jingle|drawer|chair|"
     r"page|paper|cutlery)(?:s|ing|ed|er)?\b",
     "haushalt"),
    (r"\b(hammer|drill|saw|chainsaw|jackhammer|machine|"
     r"construction|grinder|lawnmower|mower|electric tool|"
     r"compressor|industrial|metal|forge|weld)(?:s|ing|ed|er)?\b",
     "industrie"),
    (r"\b(gun|rifle|shotgun|pistol|smg|bullet|explosion|"
     r"grenade|rpg|cannon|firework|blast|gunfire|shoot)(?:s|ing|ed|er)?\b",
     "industrie"),
    (r"\b(ambient|background|atmosphere|room|indoor|outdoor|"
     r"environment|nature)(?:s|ing|ed|er)?\b",
     "ambient"),
]

log = logging.getLogger("musan_noise_enrich")


def merge_item(item: dict, enr: dict) -> bool:
    tags = item.setdefault("tags", {})
    changed = False
    for key in ENRICH_KEYS:
        if key in enr and enr[key] != tags.get(key):
            tags[key] = enr[key]
            changed = True
    return changed


def parse_sound_bible_titles(license_path: Path) -> dict[str, str]:
    """Pro Item-ID den Title (Lowercase) aus der MUSAN-sound-bible
    LICENSE-Datei extrahieren."""
    out: dict[str, str] = {}
    if not license_path.is_file():
        return out
    text = license_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"^[=]{3,}\s*$", text, flags=re.MULTILINE)
    id_re = re.compile(r"^(noise-sound-bible-\d+)$", re.IGNORECASE)
    title_re = re.compile(r"^Title:\s*(.+)$", re.IGNORECASE)
    for block in blocks:
        iid = None
        title = None
        for raw in block.split("\n"):
            ln = raw.strip()
            m = id_re.match(ln)
            if m:
                iid = m.group(1).lower()
                continue
            m = title_re.match(ln)
            if m and iid:
                title = m.group(1).strip().lower()
                break
        if iid and title:
            out[iid] = title
    return out


def parse_free_sound_annotations(annot_path: Path) -> dict[str, str]:
    """Pro Item-ID die Kategorie-Bezeichnung (Lowercase) aus
    free-sound/ANNOTATIONS extrahieren."""
    out: dict[str, str] = {}
    if not annot_path.is_file():
        return out
    current = None
    for raw in annot_path.read_text(encoding="utf-8", errors="replace").splitlines():
        ln = raw.strip()
        if not ln:
            continue
        if ln.endswith(":"):
            current = ln[:-1].strip().lower()
            continue
        if current and ln.startswith("noise-free-sound-"):
            out[ln] = current
    return out


def kind_from_title(title: str) -> str | None:
    if not title:
        return None
    for rgx, kind in TITLE_TO_KIND:
        if re.search(rgx, title):
            return kind
    return None


def kind_from_free_sound_category(cat: str) -> str:
    cat = (cat or "").lower()
    if "background" in cat:
        return "ambient"
    if "music" in cat or "musical" in cat:
        return "ambient"  # MUSAN-noise enthaelt kein Musik-Material
    if "speech" in cat or "babble" in cat or "voice" in cat:
        return "babble"
    return "ambient"


def analyze_signal(p: Path) -> dict:
    """Liest Audiodatei und liefert
    {stationary, loop_safe, spectrum, dominant_freq_hz}.
    Werte None, wenn die Analyse nicht moeglich war."""
    out = {
        "stationary": None,
        "loop_safe": None,
        "spectrum": None,
        "dominant_freq_hz": None,
    }
    if not SIGNAL_AVAILABLE:
        return out
    try:
        data, sr = sf.read(str(p), always_2d=False)
    except Exception:
        return out
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.size < sr // 4:
        return out

    data = data.astype(np.float32)
    peak = float(np.max(np.abs(data)))
    if peak > 0:
        data = data / peak

    # stationary: RMS-Frames, geringe Streuung = stationaer
    frame = max(int(0.05 * sr), 1)
    n_frames = data.size // frame
    if n_frames >= 4:
        frames = data[:n_frames * frame].reshape(n_frames, frame)
        rms = np.sqrt(np.mean(frames ** 2, axis=1))
        if rms.mean() > 0:
            cv = rms.std() / (rms.mean() + 1e-9)
            out["stationary"] = "y" if cv < 0.5 else "n"

    # loop_safe: erste 0.05 s vs. letzte 0.05 s
    win = min(int(0.05 * sr), data.size // 4)
    if win > 32:
        head = data[:win]
        tail = data[-win:]
        Fh = np.abs(np.fft.rfft(head))
        Ft = np.abs(np.fft.rfft(tail))
        if Fh.sum() > 0 and Ft.sum() > 0:
            Fh = Fh / Fh.sum()
            Ft = Ft / Ft.sum()
            dist = float(np.linalg.norm(Fh - Ft))
            level_jump = float(abs(np.abs(head[-1]) - np.abs(tail[0])))
            out["loop_safe"] = ("y" if (dist < 0.05 and level_jump < 0.1)
                                else "n")

    # spectrum + dominant_freq_hz
    seg = min(int(2.0 * sr), data.size)
    spec = np.abs(np.fft.rfft(data[:seg]))
    freqs = np.fft.rfftfreq(seg, 1.0 / sr)
    total = float(spec.sum())
    if total > 0:
        e_low  = float(spec[freqs <  500].sum() / total)
        e_mid  = float(spec[(freqs >= 500) & (freqs < 4000)].sum() / total)
        e_high = float(spec[freqs >= 4000].sum() / total)
        peak_idx = int(np.argmax(spec))
        peak_share = float(spec[peak_idx] / total)
        if peak_share > 0.4:
            out["spectrum"] = "tonal"
            out["dominant_freq_hz"] = int(round(float(freqs[peak_idx])))
        elif e_low > 0.7:
            out["spectrum"] = "lowpass"
        elif e_high > 0.5:
            out["spectrum"] = "highpass"
        elif e_mid > 0.5 and e_low < 0.3 and e_high < 0.3:
            out["spectrum"] = "bandpass"
        else:
            out["spectrum"] = "broadband"

    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--enrichment", type=Path, default=DEFAULT_ENRICH)
    ap.add_argument("--manifests", type=Path, default=DEFAULT_MANIFESTS)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--mirror", type=Path,
                    default=DEFAULT_MIRROR,
                    help="Voice-Wurzel mit musan/noise/ "
                         "(Default: /mnt/xbox/lauscher/voice)")
    ap.add_argument("--no-auto", action="store_true",
                    help="Auto-Klassifikation ausschalten - "
                         "nur das Enrichment-File anwenden.")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    if not args.manifests.is_dir():
        log.error("Geraeusch-Manifest-Verzeichnis fehlt: %s", args.manifests)
        return 1

    # Manuelle Anreicherung (optional)
    enrichment = {}
    if args.enrichment.is_file():
        with open(args.enrichment, "r", encoding="utf-8") as f:
            enrichment = {k: v for k, v in json.load(f).items()
                          if not k.startswith("_")}
    else:
        log.info("Keine manuelle Anreicherung gefunden (%s) - laufe "
                 "nur mit Auto-Klassifikation.", args.enrichment)

    # Sidecars
    sb_titles = parse_sound_bible_titles(
        args.mirror / "musan/noise/sound-bible/LICENSE")
    fs_cats = parse_free_sound_annotations(
        args.mirror / "musan/noise/free-sound/ANNOTATIONS")
    log.info("Sidecar-Titles: %d sound-bible, %d free-sound",
             len(sb_titles), len(fs_cats))

    if not SIGNAL_AVAILABLE:
        log.warning("numpy/soundfile nicht installiert - Signal-Analyse "
                    "(stationary/loop_safe/spectrum) wird ausgelassen. "
                    "Installation: pip install --user numpy soundfile")

    n_files = n_items_changed = 0
    for mf in sorted(args.manifests.glob("*.json")):
        try:
            with open(mf, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            log.warning("Skip defektes Manifest %s: %s", mf, e)
            continue
        changed_in_file = 0
        for it in manifest.get("items") or []:
            iid = (it.get("id") or "").lower()
            tags = it.setdefault("tags", {})

            # 1) Auto-kind aus Sidecars
            if not args.no_auto:
                k = None
                if iid.startswith("noise-sound-bible-"):
                    title = sb_titles.get(iid)
                    k = kind_from_title(title) if title else None
                elif iid.startswith("noise-free-sound-"):
                    cat = fs_cats.get(iid)
                    if cat:
                        k = kind_from_free_sound_category(cat)
                if k and tags.get("kind") in (None, "null"):
                    tags["kind"] = k
                    changed_in_file += 1

            # 2) Signal-Analyse
            if not args.no_auto and SIGNAL_AVAILABLE:
                audio_rel = it.get("audio")
                if audio_rel:
                    audio_path = args.mirror / "musan" / audio_rel
                    if audio_path.is_file():
                        sig = analyze_signal(audio_path)
                        for k_sig, v in sig.items():
                            if v is not None and tags.get(k_sig) in (None, "null"):
                                tags[k_sig] = v
                                changed_in_file += 1

            # 3) Manuelles Enrichment ueberschreibt
            if it.get("id") in enrichment:
                if merge_item(it, enrichment[it.get("id")]):
                    changed_in_file += 1

        if changed_in_file:
            n_files += 1
            n_items_changed += changed_in_file
            if not args.dry_run:
                with open(mf, "w", encoding="utf-8") as f:
                    json.dump(manifest, f, ensure_ascii=False, indent=2)
                    f.write("\n")
            log.info("%s -> %d Items angereichert", mf.name, changed_in_file)

    log.info("Fertig. %d Dateien geaendert, %d Items angereichert.",
             n_files, n_items_changed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
