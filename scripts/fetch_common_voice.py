#!/usr/bin/env python3
"""
Pre-Fetch-Skript für Common Voice 17.0 via inoffiziellem Mirror
fsicoli/common_voice_17_0 auf Hugging Face.

Streamt pro Sprache eine kuratierte Auswahl.

Filter-Stufen (werden bei Bedarf schrittweise gelockert):
  Stufe 0: alle Filter aktiv, shuffle, Gender m/f
  Stufe 1: Regex-Filter aus
  Stufe 2: Längenfilter aus, Votes-Filter aus
  Stufe 3: client_dup erlaubt (mehrere Aufnahmen pro Sprecher)
  Jede Stufe: neuer shuffle-seed, bereits gesammelte IDs werden übersprungen

Gender-Fallback:
  Nach 10 aufeinanderfolgenden Zeilen ohne m/f UND 0 Gesamttreffer → unknown-Modus.
  Nach Scan-Limit noch nicht voll → verbleibende Slots auf unknown umbuchen.

Split-Fallback:
  Wenn gewählter Split leer → automatisch weitere Splits probieren:
  train → validation → validated → other → test → invalidated

Dateiname-Schema:
  <lang>_<m|f|u>_<sentence_id>[_<accent>].mp3

Ausgabe-Ordnerstruktur:
  <out_base>/common-voice/<lang>/
    male/
    female/
    unknown/
    manifest.json

Nutzung:
    python fetch_common_voice.py --lang de --count 100
    python fetch_common_voice.py --all --count 100
    python fetch_common_voice.py --lang de --count 100 --out /data/cv

Voraussetzung:
    pip install datasets

Lizenz: CC0-1.0 (Mozilla Common Voice).
"""

import argparse
import json
import os
import re
import sys
import traceback
from collections import Counter

# HF-Cache neben dem Script – muss VOR dem datasets-Import gesetzt werden.
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
_cache_dir = os.path.join(REPO_ROOT, "hf_cache")
if os.environ.get("HF_DATASETS_CACHE") != _cache_dir:
    os.environ["HF_DATASETS_CACHE"] = _cache_dir
    os.environ["HF_HOME"]           = _cache_dir
    os.execv(sys.executable, [sys.executable] + sys.argv)

try:
    from datasets import load_dataset, Audio, get_dataset_config_names
except ImportError:
    sys.exit("Bitte 'datasets' installieren: pip install datasets")

OUT_BASE_DEFAULT = REPO_ROOT

ALLOWED_RE = re.compile(
    r"^[A-Za-zÀ-ÿäöüÄÖÜßéèêëàâîïôöùûüÿñÑáíóúÁÉÍÓÚçÇœŒæÆ\s,.;:\-\'' ]+$"
)
SENTENCE_ID_RE  = re.compile(r"common_voice_[^_]+_(\d+)\.mp3")
ACCENT_CLEAN_RE = re.compile(r"[^a-z0-9]+")

EARLY_FALLBACK_STREAK = 10
SPLIT_ORDER = ["train", "validation", "validated", "other", "test", "invalidated"]
SHUFFLE_BUFFER = 10_000

# Filter-Stufen: jede Stufe lockert Filter weiter auf
# (use_regex, check_length, check_votes, check_client_dup)
FILTER_STAGES = [
    (True,  True,  True,  True),   # Stufe 0: alles aktiv
    (False, True,  True,  True),   # Stufe 1: Regex aus
    (False, False, False, True),   # Stufe 2: Länge + Votes aus
    (False, False, False, False),  # Stufe 3: client_dup erlaubt
]


# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------

def sentence_ok(text, use_regex=True, check_length=True):
    if not text:
        return "empty"
    text = text.strip()
    if check_length:
        n = len(text.split())
        if n < 5:
            return "too_short"
        if n > 18:
            return "too_long"
    if text.endswith("?") or text.endswith("!"):
        return "exclam_or_question"
    if use_regex and not ALLOWED_RE.match(text):
        return "regex_fail"
    caps_streak = 0
    for w in text.split():
        if len(w) >= 2 and w.isupper():
            caps_streak += 1
            if caps_streak >= 2:
                return "caps_streak"
        else:
            caps_streak = 0
    return True


def extract_sentence_id(audio_path):
    if not audio_path:
        return None
    m = SENTENCE_ID_RE.search(audio_path)
    return m.group(1) if m else None


def build_filename(lang, gender_key, sentence_id, accent):
    parts = [lang, gender_key, sentence_id]
    if accent:
        clean = ACCENT_CLEAN_RE.sub("_", accent.strip().lower()).strip("_")
        if clean:
            parts.append(clean)
    return "_".join(parts) + ".mp3"


def load_existing(male_dir, female_dir, unk_dir):
    existing_ids = set()
    for d in (male_dir, female_dir, unk_dir):
        if not os.path.isdir(d):
            continue
        for fname in os.listdir(d):
            if not fname.endswith(".mp3"):
                continue
            parts = fname[:-4].split("_")
            if len(parts) >= 3:
                existing_ids.add(parts[2])
    return existing_ids


def load_manifest(manifest_path):
    if os.path.isfile(manifest_path):
        with open(manifest_path, encoding="utf-8") as f:
            return json.load(f)
    return None


def _write_manifest(manifest_path, lang_code, existing_manifest, new_items,
                    gender_count, split_used, stage):
    all_items = (existing_manifest.get("items", []) if existing_manifest else []) + new_items
    stage_labels = [
        "alle Filter aktiv",
        "regex-filter-aus",
        "länge+votes-aus",
        "client-dup-erlaubt",
    ]
    manifest = {
        "lang":                lang_code,
        "source":              "fsicoli/common_voice_17_0",
        "license":             "CC0-1.0",
        "split_used":          split_used,
        "filter_stage":        f"{stage} ({stage_labels[stage]})",
        "gender_distribution": dict(gender_count),
        "n_items":             len(all_items),
        "items":               all_items,
    }
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Split-Fallback
# ---------------------------------------------------------------------------

def find_split(lang_code, preferred_split):
    order = [preferred_split] + [s for s in SPLIT_ORDER if s != preferred_split]
    last_error = {}
    for split in order:
        try:
            ds = load_dataset(
                "fsicoli/common_voice_17_0",
                lang_code,
                split=split,
                streaming=True,
            )
            ds = ds.cast_column("audio", Audio(decode=False))
            it = iter(ds)
            first = next(it, None)
            if first is None:
                last_error[split] = "leer (0 Zeilen)"
                continue
            ds = load_dataset(
                "fsicoli/common_voice_17_0",
                lang_code,
                split=split,
                streaming=True,
            )
            ds = ds.cast_column("audio", Audio(decode=False))
            return split, ds
        except KeyError as e:
            # Sprache fehlt komplett im Mirror – andere Splits bringen nichts
            details = f"Sprache nicht im Mirror vorhanden (KeyError: {e})"
            return None, f"    alle Splits: {details}"
        except Exception as e:
            last_error[split] = f"{type(e).__name__}: {e}"
            continue
    details = "\n".join(f"    {s}: {e}" for s, e in last_error.items())
    return None, details


def load_ds_shuffled(lang_code, split_used, seed):
    ds = load_dataset(
        "fsicoli/common_voice_17_0",
        lang_code,
        split=split_used,
        streaming=True,
    )
    ds = ds.cast_column("audio", Audio(decode=False))
    ds = ds.shuffle(seed=seed, buffer_size=SHUFFLE_BUFFER)
    return ds


# ---------------------------------------------------------------------------
# Ein Stream-Durchlauf
# ---------------------------------------------------------------------------

def stream_pass(ds, lang_code, scan_limit,
                still_need_m, still_need_f, still_need_u,
                existing_ids, seen_clients,
                use_regex, check_length, check_votes, check_client_dup,
                unknown_mode, collected_m, collected_f, collected_u,
                lang_dir, male_dir, female_dir, unk_dir):
    """
    Liest den Stream durch und sammelt Sätze.
    Gibt (new_items, collected_m, collected_f, collected_u,
          unknown_mode, reject, scanned) zurück.
    Modifiziert existing_ids und seen_clients in-place.
    """
    new_items  = []
    reject     = Counter()
    scanned    = 0

    no_gender_streak  = 0
    total_gender_hits = 0

    def _enough():
        return (collected_m >= still_need_m and
                collected_f >= still_need_f and
                collected_u >= still_need_u)

    def _target_dir(gkey):
        return male_dir if gkey == "m" else (female_dir if gkey == "f" else unk_dir)

    for row in ds:
        scanned += 1

        if scanned % 500 == 0:
            flags = []
            if unknown_mode:   flags.append("unknown-mode")
            if not use_regex:  flags.append("no-regex")
            if not check_length: flags.append("no-len")
            if not check_votes:  flags.append("no-votes")
            if not check_client_dup: flags.append("no-dedup")
            print(f"  [{lang_code}] scanned={scanned}/{scan_limit} "
                  f"m={collected_m}/{still_need_m} "
                  f"f={collected_f}/{still_need_f} "
                  f"u={collected_u}/{still_need_u} "
                  f"{' '.join(flags)} "
                  f"reject={reject.most_common(3)}")

        # Scan-Limit
        if scanned >= scan_limit:
            open_slots = ((still_need_m - collected_m) +
                          (still_need_f - collected_f))
            if open_slots > 0 and not unknown_mode:
                still_need_u += open_slots
                still_need_m  = collected_m
                still_need_f  = collected_f
                unknown_mode  = True
                print(f"  [{lang_code}] Scan-Limit erreicht, "
                      f"{open_slots} Slots → unknown-Fallback")
            break

        # Gender
        raw_gender = (row.get("gender") or "").strip().lower()
        if raw_gender == "male":
            gkey = "m"
        elif raw_gender == "female":
            gkey = "f"
        else:
            gkey = None

        if gkey is None:
            no_gender_streak += 1
            if (not unknown_mode
                    and total_gender_hits == 0
                    and no_gender_streak >= EARLY_FALLBACK_STREAK):
                unknown_mode  = True
                still_need_u  = ((still_need_m - collected_m) +
                                 (still_need_f - collected_f) +
                                 (still_need_u - collected_u))
                still_need_m  = collected_m
                still_need_f  = collected_f
                print(f"  [{lang_code}] Gender-Fallback nach {scanned} Zeilen → unknown-Modus")
            if not unknown_mode:
                reject["no_gender"] += 1
                continue
            gkey = "u"
        else:
            no_gender_streak  = 0
            total_gender_hits += 1

        # Gender-Cap
        if gkey == "m" and collected_m >= still_need_m:
            reject["gender_cap_m"] += 1
            continue
        if gkey == "f" and collected_f >= still_need_f:
            reject["gender_cap_f"] += 1
            continue
        if gkey == "u" and collected_u >= still_need_u:
            reject["gender_cap_u"] += 1
            continue

        # Audio
        audio_data  = row.get("audio") or {}
        audio_path  = audio_data.get("path") or ""
        sentence_id = extract_sentence_id(audio_path)
        if not sentence_id:
            reject["no_sentence_id"] += 1
            continue
        if sentence_id in existing_ids:
            reject["already_exists"] += 1
            continue

        # Text
        text = (row.get("sentence") or "").strip()
        ok = sentence_ok(text, use_regex=use_regex, check_length=check_length)
        if ok is not True:
            reject[ok] += 1
            continue

        # Client-Deduplizierung
        client_id = row.get("client_id") or ""
        if not client_id:
            reject["no_client"] += 1
            continue
        if check_client_dup and client_id in seen_clients:
            reject["client_dup"] += 1
            continue

        # Votes
        if check_votes:
            up   = int(row.get("up_votes")   or 0)
            down = int(row.get("down_votes") or 0)
            if up < 1:
                reject["upvotes_low"] += 1
                continue
            if down > 1:
                reject["downvotes_high"] += 1
                continue
        else:
            up   = int(row.get("up_votes")   or 0)
            down = int(row.get("down_votes") or 0)

        # Audio-Bytes
        audio_bytes = audio_data.get("bytes")
        if not audio_bytes:
            reject["no_audio_bytes"] += 1
            continue

        # Speichern
        accent = (row.get("accent") or "").strip()
        fname  = build_filename(lang_code, gkey, sentence_id, accent)
        tdir   = _target_dir(gkey)
        os.makedirs(tdir, exist_ok=True)

        with open(os.path.join(tdir, fname), "wb") as f:
            f.write(audio_bytes)

        seen_clients.add(client_id)
        existing_ids.add(sentence_id)

        if gkey == "m":
            collected_m += 1
        elif gkey == "f":
            collected_f += 1
        else:
            collected_u += 1

        subdir = {"m": "male", "f": "female", "u": "unknown"}[gkey]
        new_items.append({
            "id":        sentence_id,
            "text":      text,
            "gender":    gkey,
            "accent":    accent or None,
            "audio":     os.path.join(subdir, fname),
            "up_votes":  up,
            "down_votes": down,
        })

        if _enough():
            break

    return (new_items, collected_m, collected_f, collected_u,
            unknown_mode, reject, scanned,
            still_need_m, still_need_f, still_need_u)


# ---------------------------------------------------------------------------
# Kern-Fetch
# ---------------------------------------------------------------------------

def fetch_lang(lang_code, count, out_base, split="train"):
    lang_dir   = os.path.join(out_base, lang_code)
    male_dir   = os.path.join(lang_dir, "male")
    female_dir = os.path.join(lang_dir, "female")
    unk_dir    = os.path.join(lang_dir, "unknown")
    manifest_path = os.path.join(lang_dir, "manifest.json")

    existing_ids      = load_existing(male_dir, female_dir, unk_dir)
    existing_manifest = load_manifest(manifest_path)

    have = Counter()
    if existing_manifest:
        for item in existing_manifest.get("items", []):
            g = item.get("gender")
            if g in ("m", "f", "u"):
                have[g] += 1

    already_have = sum(have.values())
    if already_have >= count:
        print(f"[{lang_code}] bereits {already_have}/{count} vorhanden – übersprungen.")
        return True, None

    need_m       = count // 2
    need_f       = count - need_m
    still_need_m = max(0, need_m - have["m"])
    still_need_f = max(0, need_f - have["f"])
    still_need_u = max(0, count - already_have - still_need_m - still_need_f)

    print(f"[{lang_code}] starte – brauche noch "
          f"{still_need_m}m / {still_need_f}f / {still_need_u}u "
          f"(vorhanden: {have['m']}m / {have['f']}f / {have['u']}u)")

    # Split finden
    split_used, ds_or_err = find_split(lang_code, split)
    if split_used is None:
        msg = (f"[{lang_code}] FEHLER: kein nutzbarer Split gefunden.\n"
               f"  Details pro Split:\n{ds_or_err}\n"
               f"  → Erneuter Versuch: --lang {lang_code}")
        return False, msg

    if split_used != split:
        print(f"  [{lang_code}] Split '{split}' leer → verwende '{split_used}'")

    os.makedirs(lang_dir, exist_ok=True)

    scan_limit   = count * 10
    all_new      = []
    seen_clients = set()
    gender_count = Counter(have)
    collected_m  = 0
    collected_f  = 0
    collected_u  = 0
    unknown_mode = False
    final_stage  = 0

    def _total_enough():
        return (collected_m >= still_need_m and
                collected_f >= still_need_f and
                collected_u >= still_need_u)

    for stage, (use_regex, check_length, check_votes, check_client_dup) \
            in enumerate(FILTER_STAGES):

        if _total_enough():
            break

        if stage > 0:
            print(f"  [{lang_code}] Stufe {stage}: Filter lockern "
                  f"(regex={use_regex}, länge={check_length}, "
                  f"votes={check_votes}, dedup={check_client_dup})")

        try:
            ds = load_ds_shuffled(lang_code, split_used, seed=stage)
        except Exception as e:
            msg = (f"[{lang_code}] FEHLER beim Laden (Stufe {stage}):\n"
                   f"  {type(e).__name__}: {e}\n"
                   f"  → Erneuter Versuch: --lang {lang_code}")
            _write_manifest(manifest_path, lang_code, existing_manifest, all_new,
                            gender_count, split_used, stage)
            return False, msg

        try:
            result = stream_pass(
                ds, lang_code, scan_limit,
                still_need_m, still_need_f, still_need_u,
                existing_ids, seen_clients,
                use_regex, check_length, check_votes, check_client_dup,
                unknown_mode, collected_m, collected_f, collected_u,
                lang_dir, male_dir, female_dir, unk_dir,
            )
        except Exception as e:
            msg = (f"[{lang_code}] FEHLER während Streaming (Stufe {stage}):\n"
                   f"  Typ:     {type(e).__name__}\n"
                   f"  Details: {e}\n"
                   f"  Gespeichert bisher: {collected_m}m/{collected_f}f/{collected_u}u\n"
                   f"  Traceback:\n"
                   + "".join(f"    {l}" for l in traceback.format_exc().splitlines(True))
                   + f"\n  → Erneuter Versuch: --lang {lang_code} --split {split_used}")
            _write_manifest(manifest_path, lang_code, existing_manifest, all_new,
                            gender_count, split_used, stage)
            return False, msg

        (new_items, collected_m, collected_f, collected_u,
         unknown_mode, reject, scanned,
         still_need_m, still_need_f, still_need_u) = result

        all_new += new_items
        for item in new_items:
            gender_count[item["gender"]] += 1
        final_stage = stage

        remaining = (still_need_m - collected_m +
                     still_need_f - collected_f +
                     still_need_u - collected_u)
        print(f"  [{lang_code}] Stufe {stage} fertig: "
              f"+{len(new_items)} ({collected_m}m/{collected_f}f/{collected_u}u), "
              f"noch {remaining} offen, "
              f"top_reject={reject.most_common(3)}")

    total_new = collected_m + collected_f + collected_u
    total_all = already_have + total_new

    _write_manifest(manifest_path, lang_code, existing_manifest, all_new,
                    gender_count, split_used, final_stage)

    # Bytes zählen
    total_bytes = 0
    for item in all_new:
        fp = os.path.join(lang_dir, item["audio"])
        if os.path.isfile(fp):
            total_bytes += os.path.getsize(fp)

    flags = []
    if unknown_mode:       flags.append(f"unknown-mode ({collected_u}u)")
    if final_stage > 0:    flags.append(f"filter-stufe={final_stage}")
    if split_used != split: flags.append(f"split={split_used}")

    print(f"[{lang_code}] fertig: {collected_m}m+{collected_f}f+{collected_u}u neu "
          f"({total_bytes/1024/1024:.1f} MB), "
          f"gesamt {gender_count['m']}m/{gender_count['f']}f/{gender_count['u']}u"
          + (f"  [{', '.join(flags)}]" if flags else ""))

    warnings = []
    if total_all < count:
        warnings.append(
            f"WARN [{lang_code}]: nur {total_all}/{count} Sätze "
            f"({collected_m}m/{collected_f}f/{collected_u}u neu). "
            f"Split={split_used}, Stufe={final_stage}."
        )
    return True, "\n".join(warnings) if warnings else None


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    group = ap.add_mutually_exclusive_group(required=True)
    group.add_argument("--lang",
                       help="Einzelne Locale (z.B. en, de, fr, es, en_US)")
    group.add_argument("--all", action="store_true",
                       help="Alle verfügbaren Sprachen (~123) herunterladen")
    ap.add_argument("--count", type=int, default=100,
                    help="Sätze pro Sprache (Default 100)")
    ap.add_argument("--out", default=None,
                    help=f"Basis-Ordner (Default: {OUT_BASE_DEFAULT})")
    ap.add_argument("--split", default="train",
                    help="Bevorzugter HF-Split (Default: train). "
                         "Automatischer Fallback auf andere Splits wenn leer.")
    args = ap.parse_args()

    out_base = args.out or OUT_BASE_DEFAULT

    if args.all:
        print("Ermittle verfügbare Sprachen …")
        try:
            langs = get_dataset_config_names("fsicoli/common_voice_17_0")
        except Exception as e:
            sys.exit(f"FEHLER Sprachliste: {type(e).__name__}: {e}")
        print(f"  {len(langs)} Sprachen: {langs}\n")

        errors   = []
        warnings = []
        for i, lang in enumerate(langs, 1):
            print(f"\n[{i}/{len(langs)}] {lang}")
            ok, msg = fetch_lang(lang, args.count, out_base, split=args.split)
            if not ok:
                errors.append((lang, msg))
            elif msg:
                warnings.append((lang, msg))

        print("\n" + "=" * 60)
        if warnings:
            print(f"\n{len(warnings)} Sprachen mit Warnungen (zu wenig Daten):")
            for lang, msg in warnings:
                print(f"  {msg}")

        if errors:
            print(f"\nFERTIG – {len(langs)-len(errors)}/{len(langs)} OK, "
                  f"{len(errors)} FEHLER:\n")
            for lang, msg in errors:
                print(msg)
                print()
            print("Retry-Befehle:")
            for lang, _ in errors:
                print(f"  python fetch_common_voice.py "
                      f"--lang {lang} --count {args.count}")
        else:
            print(f"\nFERTIG – alle {len(langs)} Sprachen abgeschlossen.")

    else:
        ok, msg = fetch_lang(args.lang, args.count, out_base, split=args.split)
        if not ok:
            print(msg, file=sys.stderr)
            sys.exit(1)
        elif msg:
            print(msg)


if __name__ == "__main__":
    main()
