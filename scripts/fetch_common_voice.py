#!/usr/bin/env python3
"""
Pre-Fetch-Skript für Common Voice 17.0 via inoffiziellem Mirror
fsicoli/common_voice_17_0 auf Hugging Face.

Streamt pro Sprache eine kuratierte Auswahl aus dem 'validated' Split.
Filtert auf:
  - Wortanzahl 6–15
  - Sprecher-Diversität (max. 1 Aufnahme pro client_id)
  - Gender male/female ausgewogen
  - up_votes >= 2, down_votes == 0
  - Einfache Interpunktion, keine Ziffern, keine ALL-CAPS-Wörter

Ausgabe: assets/sentences/cv-<lang>/
  - 001.mp3 ... NNN.mp3    (rohe Common-Voice-MP3s, kein Re-Encoding)
  - manifest.json          (Texte, anonymisierter Sprecher-Hash, Gender)

Nutzung:
    python scripts/fetch_common_voice.py --lang en --count 100
    python scripts/fetch_common_voice.py --lang de --count 100
    python scripts/fetch_common_voice.py --lang fr --count 100
    python scripts/fetch_common_voice.py --lang es --count 100

Voraussetzung:
    pip install datasets soundfile      # soundfile nur, falls cast_column meckert

Lizenz der gezogenen Daten: CC0-1.0 (Mozilla Common Voice, im Mirror beibehalten).
Quellen-Hinweis im README empfohlen, da es ein inoffizieller Mirror ist.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from collections import Counter

try:
    from datasets import load_dataset, Audio
except ImportError:
    sys.exit("Bitte 'datasets' installieren: pip install datasets")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_BASE = os.path.join(REPO_ROOT, "assets", "sentences")

# Zugelassene Zeichen: lateinische Buchstaben (inkl. Umlaute, Akzente),
# Leerzeichen, Komma, Punkt, Bindestrich, Apostroph, Doppelpunkt, Strichpunkt.
ALLOWED_RE = re.compile(
    r"^[A-Za-zÀ-ÿäöüÄÖÜßéèêëàâîïôöùûüÿñÑáíóúÁÉÍÓÚçÇœŒæÆ\s,.;:\-\'’ ]+$"
)


def sentence_ok(text):
    """Liefert True oder einen String-Reason warum nicht."""
    if not text:
        return "empty"
    text = text.strip()
    n = len(text.split())
    if n < 5:
        return "too_short"
    if n > 18:
        return "too_long"
    # Fragen/Ausrufe vermeiden (zu prosodisch); Punkt nicht zwingend
    if text.endswith("?") or text.endswith("!"):
        return "exclam_or_question"
    if not ALLOWED_RE.match(text):
        return "regex_fail"
    # 2+ aufeinanderfolgende ALL-CAPS-Wörter raus
    words = text.split()
    caps_streak = 0
    for w in words:
        if len(w) >= 2 and w.isupper():
            caps_streak += 1
            if caps_streak >= 2:
                return "caps_streak"
        else:
            caps_streak = 0
    return True


def short_hash(s, n=8):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:n]


def fetch(lang_code, count, out_dir, split="train"):
    print(f"[{lang_code}] streaming aus fsicoli/common_voice_17_0 (split={split}) …")
    print(f"        (das initiale Laden kann eine Minute dauern)")

    ds = load_dataset(
        "fsicoli/common_voice_17_0",
        lang_code,
        split=split,
        trust_remote_code=True,
        streaming=True,
    )
    # Audio NICHT decodieren — wir wollen die rohen MP3-Bytes direkt schreiben.
    ds = ds.cast_column("audio", Audio(decode=False))

    selected = []
    seen_clients = set()
    gender_count = Counter()
    reject = Counter()
    cap_per_gender = (count // 2) + max(5, count // 10)

    scanned = 0
    for row in ds:
        scanned += 1
        if scanned % 500 == 0:
            top_reject = reject.most_common(5)
            print(f"  scanned={scanned}, kept={len(selected)}, "
                  f"gender={dict(gender_count)}, top_reject={top_reject}")

        text = (row.get("sentence") or "").strip()
        ok = sentence_ok(text)
        if ok is not True:
            reject[ok] += 1
            continue

        client_id = row.get("client_id") or ""
        if not client_id:
            reject["no_client"] += 1
            continue
        if client_id in seen_clients:
            reject["client_dup"] += 1
            continue

        gender = (row.get("gender") or "").strip().lower()
        # Lockerer Filter: leer = unbekannt, zählt als "u"; für Pool OK.
        if gender in ("male",):
            gkey = "m"
        elif gender in ("female",):
            gkey = "f"
        else:
            gkey = "u"
        # Cap nur auf m/f, "u" darf bis count
        if gkey in ("m", "f") and gender_count[gkey] >= cap_per_gender:
            reject["gender_cap"] += 1
            continue

        up = int(row.get("up_votes") or 0)
        down = int(row.get("down_votes") or 0)
        if up < 1:
            reject["upvotes_low"] += 1
            continue
        if down > 1:
            reject["downvotes_high"] += 1
            continue

        audio_data = row.get("audio") or {}
        audio_bytes = audio_data.get("bytes")
        if not audio_bytes:
            reject["no_audio_bytes"] += 1
            continue

        seen_clients.add(client_id)
        gender_count[gkey] += 1
        selected.append({
            "text": text,
            "gender": gkey,
            "client_hash": short_hash(client_id),
            "audio_bytes": audio_bytes,
            "up_votes": up,
            "down_votes": down,
        })
        if len(selected) >= count:
            break

    if len(selected) < count:
        print(f"  WARN: nur {len(selected)}/{count} Sätze gefunden "
              f"(Filter ggf. lockern, oder Stream-Anfang ungünstig).")

    os.makedirs(out_dir, exist_ok=True)
    manifest = {
        "lang": lang_code,
        "source": "fsicoli/common_voice_17_0",
        "license": "CC0-1.0",
        "n_speakers": len(seen_clients),
        "gender_distribution": dict(gender_count),
        "items": [],
    }

    for i, item in enumerate(selected, 1):
        fname = f"{i:03d}.mp3"
        with open(os.path.join(out_dir, fname), "wb") as f:
            f.write(item["audio_bytes"])
        manifest["items"].append({
            "id": f"{i:03d}",
            "text": item["text"],
            "gender": item["gender"],
            "client_hash": item["client_hash"],
            "audio": fname,
        })

    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    print(f"[{lang_code}] fertig: {len(selected)} MP3s in {out_dir}")
    print(f"  Gender: {dict(gender_count)}")
    print(f"  Sprecher: {len(seen_clients)} verschiedene")
    total_bytes = sum(len(item["audio_bytes"]) for item in selected)
    print(f"  Gesamtgröße: {total_bytes / 1024 / 1024:.1f} MB")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--lang", required=True,
                    help="Locale (z.B. en, de, fr, es)")
    ap.add_argument("--count", type=int, default=100,
                    help="Anzahl Sätze (Default 100)")
    ap.add_argument("--out", default=None,
                    help="Ziel-Ordner (Default: assets/sentences/cv-<lang>/)")
    ap.add_argument("--split", default="train",
                    help="HF-Split: train (Default) / validation / test / other / invalidated")
    args = ap.parse_args()

    out = args.out or os.path.join(OUT_BASE, f"cv-{args.lang}")
    fetch(args.lang, args.count, out, split=args.split)


if __name__ == "__main__":
    main()
