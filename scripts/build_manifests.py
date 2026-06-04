#!/usr/bin/env python3
"""
build_manifests.py — erzeugt audio.manifest/ aus dem voice-/voice/opus-Material
==============================================================================

Liest die Sidecar-Metadaten aller lokalen Quellen (Thorsten, ARU,
MUSAN, MLS, Common Voice, Freiburger, OLSA, test-noise) und schreibt
das audio.manifest/-Verzeichnis nach Schema aus
docs/Konzept_Audio_Manifest.md.

Aufruf
------

    # Mirror fertig → alles in einem Lauf
    python3 scripts/build_manifests.py

    # Mirror noch nicht fertig: Metadaten aus dem Original lesen, Audio-Pfade trotzdem
    # gegen den (späteren) Mirror referenzieren:
    python3 scripts/build_manifests.py --metadata-root /mnt/xbox/lauscher/voice

    # nur einzelne Quellen
    python3 scripts/build_manifests.py --only thorsten-voice common-voice

    # Trockenlauf
    python3 scripts/build_manifests.py --dry-run

Hinweis: Das Skript prüft *nicht*, ob die referenzierten Audio-
Dateien existieren — Manifeste spiegeln den geplanten Inhalt wider,
der Player toleriert 404 auf Item-Ebene.
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import os
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ci-sb-corpus/2"

DEFAULT_MIRROR = Path("/mnt/xbox/lauscher/voice/opus")
DEFAULT_METADATA = None  # wenn None -> gleich wie mirror_root
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "audio.manifest"

# Pro Source-Key die Audio-Endung, die im Mirror tatsaechlich liegt.
EXT_BY_SOURCE = {
    "thorsten-voice":            ".opus",
    "thorsten-voice-emotional":  ".opus",
    "thorsten-voice-hessisch":   ".opus",
    "aru-speech-corpus":         ".opus",
    "freiburger":                ".wav",
    "oldenburger-olsa":          ".wav",
    "mls-french":                ".opus",
    "mls-spanish":               ".opus",
    "mls-polish":                ".opus",
    "common-voice":              ".mp3",
    "test-noise":                ".wav",
    # musan ist gemischt - wird im MUSAN-Builder pro Sub-Quelle entschieden
}

# Globaler Sammler fuer den Differenzen-Report.
_BUILD_DIFFS = {
    "missing_audio": [],
    "orphan_audio":  [],
}

# Pro Source-Key gesammelte Audio-Pfade (relativ zur source.base).
_BUILD_AUDIO_PATHS = {}      # source_key -> set[str]
_BUILD_SOURCE_BASES = {}     # source_key -> "Thorsten Voice/"

log = logging.getLogger("build_manifests")


# ============================================================
# UTILITIES
# ============================================================

def write_json(path: Path, data: Any, dry_run: bool) -> None:
    if dry_run:
        log.info("DRY write %s", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def audio_in_mirror(mirror_root: Path, source_base: str, rel: str) -> Path:
    """Lokaler Pfad einer Audiodatei im Mirror."""
    return mirror_root / source_base.rstrip("/") / rel


def verify_manifest_audio(manifest: dict, mirror_root: Path,
                          source_base: str, source_key: str) -> None:
    """Prueft pro Item, ob die referenzierte Audiodatei im Mirror existiert."""
    for it in manifest.get("items", []):
        rel = it.get("audio")
        if not rel or rel.startswith(("http://", "https://", "data:")):
            continue
        p = audio_in_mirror(mirror_root, source_base, rel)
        if not p.is_file():
            _BUILD_DIFFS["missing_audio"].append({
                "source":   source_key,
                "manifest": manifest.get("title", "?"),
                "item":     it.get("id", "?"),
                "expected": str(p),
            })


def collect_audio_paths(manifest: dict) -> set[str]:
    out = set()
    for it in manifest.get("items", []):
        a = it.get("audio")
        if a and not a.startswith(("http://", "https://", "data:")):
            out.add(a)
    return out


def remember_paths(source_key: str, manifest: dict) -> None:
    s = _BUILD_AUDIO_PATHS.setdefault(source_key, set())
    s.update(collect_audio_paths(manifest))


def scan_orphans(mirror_root: Path, source_base: str,
                 source_key: str, manifested_paths: set[str]) -> None:
    """Sucht Audiodateien im Mirror, die in keinem Manifest stehen."""
    src_root = mirror_root / source_base.rstrip("/")
    if not src_root.is_dir():
        return
    audio_exts = {".opus", ".wav", ".mp3", ".flac", ".ogg"}
    for p in src_root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in audio_exts:
            continue
        rel = str(p.relative_to(src_root))
        if rel not in manifested_paths:
            _BUILD_DIFFS["orphan_audio"].append({
                "source": source_key,
                "path":   str(p),
            })


def write_diff_report(path: Path, diffs: dict, dry_run: bool) -> None:
    lines = [
        "# Audio-Manifest-Differenzen-Report",
        "",
        "Erzeugt von `scripts/build_manifests.py` am Ende eines Voll-Laufs.",
        "",
        "## Fehlende Audio-Dateien",
        "",
        f"Manifeste referenzieren {len(diffs['missing_audio'])} Items, "
        "die im Mirror nicht vorliegen. Pro Quelle die ersten 30:",
        "",
    ]
    by_src: dict = defaultdict(list)
    for d in diffs["missing_audio"]:
        by_src[d["source"]].append(d)
    for src in sorted(by_src):
        lines.append(f"### {src} ({len(by_src[src])} fehlend)")
        lines.append("")
        for d in by_src[src][:30]:
            lines.append(f"- `{d['manifest']}` / `{d['item']}` -> `{d['expected']}`")
        if len(by_src[src]) > 30:
            lines.append(f"- ... und {len(by_src[src]) - 30} weitere")
        lines.append("")

    lines.append("## Verwaiste Audio-Dateien")
    lines.append("")
    lines.append(
        f"Im Mirror liegen {len(diffs['orphan_audio'])} Audiodateien, "
        "auf die kein Manifest verweist. Pro Quelle die ersten 30:")
    lines.append("")
    by_src2: dict = defaultdict(list)
    for d in diffs["orphan_audio"]:
        by_src2[d["source"]].append(d)
    for src in sorted(by_src2):
        lines.append(f"### {src} ({len(by_src2[src])} verwaist)")
        lines.append("")
        for d in by_src2[src][:30]:
            lines.append(f"- `{d['path']}`")
        if len(by_src2[src]) > 30:
            lines.append(f"- ... und {len(by_src2[src]) - 30} weitere")
        lines.append("")

    if dry_run:
        log.info("DRY write %s", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")


# Duration-Cache

DURATION_CACHE_PATH = (Path(__file__).resolve().parent /
                       ".cache" / "duration_cache.json")
_DURATION_CACHE: dict[str, float] = {}
_DURATION_CACHE_LOADED = False
_DURATION_CACHE_DIRTY = False


def _duration_cache_key(p: Path) -> str:
    try:
        st = p.stat()
        return f"{p}|{st.st_size}|{int(st.st_mtime)}"
    except OSError:
        return f"{p}|?"


def load_duration_cache() -> None:
    global _DURATION_CACHE, _DURATION_CACHE_LOADED
    if _DURATION_CACHE_LOADED:
        return
    if DURATION_CACHE_PATH.is_file():
        try:
            with open(DURATION_CACHE_PATH, "r", encoding="utf-8") as f:
                _DURATION_CACHE = json.load(f)
        except (OSError, json.JSONDecodeError):
            _DURATION_CACHE = {}
    _DURATION_CACHE_LOADED = True


def save_duration_cache(dry_run: bool) -> None:
    if not _DURATION_CACHE_DIRTY or dry_run:
        return
    DURATION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DURATION_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(_DURATION_CACHE, f, indent=2, sort_keys=True)


def _check_ffprobe() -> bool:
    if shutil.which("ffprobe") is None:
        log.warning("ffprobe nicht im PATH - Dauer-Felder werden ausgelassen.")
        return False
    return True


def get_duration(p: Path) -> float | None:
    """Sekunden, gerundet auf 2 Nachkommastellen. None bei Fehler."""
    global _DURATION_CACHE_DIRTY
    if not p.is_file():
        return None
    key = _duration_cache_key(p)
    cached = _DURATION_CACHE.get(key)
    if cached is not None:
        return cached
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    try:
        out = subprocess.check_output(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(p)],
            stderr=subprocess.STDOUT,
            timeout=10,
        )
        secs = round(float(out.strip()), 2)
    except (subprocess.SubprocessError, ValueError):
        return None
    _DURATION_CACHE[key] = secs
    _DURATION_CACHE_DIRTY = True
    return secs


def attach_durations(manifest: dict, mirror_root: Path,
                     source_base: str) -> None:
    """Iteriert items und ergaenzt 'duration' (Sekunden) via ffprobe/Cache."""
    for it in manifest.get("items", []):
        if it.get("duration") is not None:
            continue
        rel = it.get("audio")
        if not rel or rel.startswith(("http://", "https://", "data:")):
            continue
        p = audio_in_mirror(mirror_root, source_base, rel)
        d = get_duration(p)
        if d is not None:
            it["duration"] = d


def safe_id(s: str, prefix: str = "") -> str:
    base = re.sub(r"[^A-Za-z0-9_-]+", "-", s).strip("-")
    return (prefix + base) if base else (prefix + "x")


def map_cc_license(text: str) -> str:
    """Mappt Freitext-Lizenzangabe auf SPDX-Identifier."""
    if not text:
        return "unknown"
    t = text.lower()
    if "public domain" in t or "publicdomain" in t or t.strip() in ("pd",):
        return "PD"
    if "cc0" in t or "creative commons zero" in t or "creative commons 0" in t:
        return "CC0-1.0"
    if "sampling plus" in t or "sampling+" in t:
        return "CC-Sampling-Plus-1.0"
    m = re.search(r"(\d\.\d)", t)
    ver = m.group(1) if m else "3.0"
    sa = ("sharealike" in t or "share alike" in t
          or re.search(r"\bsa\b", t) or "-sa" in t)
    nc = ("noncommercial" in t or "non commercial" in t
          or re.search(r"\bnc\b", t) or "-nc" in t)
    nd = ("no derivatives" in t or "noderivatives" in t
          or re.search(r"\bnd\b", t) or "-nd" in t)
    has_by = ("attribution" in t or "by-" in t or "cc by" in t or "cc-by" in t)
    if not has_by:
        return "unknown"
    parts = ["CC-BY"]
    if nc:
        parts.append("NC")
    if sa:
        parts.append("SA")
    elif nd:
        parts.append("ND")
    parts.append(ver)
    return "-".join(parts)


def parse_musan_license_blocks(license_path: Path) -> dict[str, tuple[str, str | None]]:
    """Parst eine MUSAN-Sub-LICENSE-Datei (fma, jamendo, sound-bible, …) und
    liefert {item-id: (spdx, license_url)}. Bei pauschalen Lizenz-Dateien
    (z. B. free-sound) bleibt das Dict leer — Kallengebrauch ergänzt einen
    pauschalen Fallback."""
    out: dict[str, tuple[str, str | None]] = {}
    if not license_path.is_file():
        return out
    text = license_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"^[=]{3,}\s*$|^[-]{3,}\s*$", text, flags=re.MULTILINE)
    id_pattern = re.compile(r"^(?:music|noise)-[a-z0-9-]+-\d+$", re.IGNORECASE)
    url_pattern = re.compile(r"^(https?://\S+)")
    keywords = ("public domain", "attribution", "cc by", "cc-by",
                "cc0", "share alike", "sharealike", "sampling plus",
                "sampling+", "noncommercial", "non commercial")
    for block in blocks:
        ids: list[str] = []
        lic_line: str | None = None
        url: str | None = None
        for raw in block.split("\n"):
            ln = raw.strip()
            if not ln:
                continue
            if id_pattern.match(ln):
                ids.append(ln.lower())
                continue
            if url is None:
                m = url_pattern.match(ln)
                if m:
                    url = m.group(1)
                    continue
            if lic_line is None and any(k in ln.lower() for k in keywords):
                cl = ln.split(":", 1)[1].strip() if ln.lower().startswith("license:") else ln
                lic_line = cl
        if ids and lic_line:
            spdx = map_cc_license(lic_line)
            for iid in ids:
                out[iid] = (spdx, url)
    return out


def musan_pauschal_license(license_path: Path) -> str | None:
    """Fallback wenn parse_musan_license_blocks() leer ist (z. B. free-sound)."""
    if not license_path.is_file():
        return None
    text = license_path.read_text(encoding="utf-8", errors="replace")
    if "public domain" in text.lower():
        return "PD"
    m = re.search(r"(CC[\s-]?BY[^\n]*|Attribution[^\n]*)", text, re.IGNORECASE)
    if m:
        return map_cc_license(m.group(1))
    return None


def write_source(out: Path, key: str, name: str, url: str,
                 license_spdx: str, credit: str, base: str,
                 categories: list[str], manifests: dict[str, list[str]],
                 notes: str = "", dry_run: bool = False) -> Path:
    _BUILD_SOURCE_BASES[key] = base
    src = {
        "schema": SCHEMA_VERSION,
        "key": key,
        "name": name,
        "url": url,
        "license": license_spdx,
        "credit": credit,
        "base": base,
        "categories": categories,
        "manifests": manifests,
    }
    if notes:
        src["notes"] = notes
    p = out / key / "source.json"
    write_json(p, src, dry_run)
    return p


# ============================================================
# THORSTEN-VOICE (saetze, de, CC0, Studio)
# ============================================================

def build_thorsten_voice(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "Thorsten Voice"
    csv_path = src_dir / "metadata.csv"
    if not csv_path.is_file():
        log.warning("thorsten-voice: metadata.csv fehlt unter %s", csv_path)
        return None
    items = []
    with open(csv_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("|")
            if len(parts) < 2:
                continue
            h, text = parts[0].strip(), parts[1].strip()
            if not h or not text:
                continue
            items.append({
                "id": h[:8],
                "text": text,
                "audio": f"wavs/{h}.opus",
            })
    log.info("thorsten-voice: %d Sätze", len(items))

    write_source(out, "thorsten-voice", "Thorsten-Voice",
                 "https://www.thorsten-voice.de", "CC0-1.0",
                 "Thorsten Müller — Trainingsdaten CC0",
                 "Thorsten Voice/", ["saetze"],
                 {"saetze": ["saetze/thorsten.json"]},
                 dry_run=dry_run)

    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "saetze",
        "title": "Thorsten",
        "lang": "de",
        "license": "CC0-1.0",
        "credit": "Thorsten Müller — Thorsten-Voice (CC0)",
        "url": "https://www.thorsten-voice.de",
        "tags": {"speaker_id": "thorsten", "gender": "m", "style": "studio"},
        "items": items,
    }
    attach_durations(manifest, metadata_root, "Thorsten Voice/")
    write_json(out / "thorsten-voice" / "saetze" / "thorsten.json",
               manifest, dry_run)
    verify_manifest_audio(manifest, metadata_root,
                          "Thorsten Voice/", "thorsten-voice")
    remember_paths("thorsten-voice", manifest)
    return "thorsten-voice"


# ============================================================
# THORSTEN-VOICE-EMOTIONAL (saetze, de, CC0, je Emotion ein Manifest)
# ============================================================

def build_thorsten_emotional(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    base_dir = metadata_root / "Thorsten-Voice-Emotional" / "thorsten-emotional_v02"
    csv_path = base_dir / "thorsten-emotional-metadata.csv"
    if not csv_path.is_file():
        log.warning("thorsten-voice-emotional: CSV fehlt unter %s", csv_path)
        return None

    # Text-Map: hash -> text
    text_by_hash: dict[str, str] = {}
    with open(csv_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("|")
            if len(parts) >= 2:
                text_by_hash[parts[0].strip()] = parts[1].strip()

    emotions = [d.name for d in sorted(base_dir.iterdir())
                if d.is_dir() and not d.name.startswith("_") and not d.name.startswith(".")]
    log.info("thorsten-voice-emotional: %d Emotionen erkannt: %s",
             len(emotions), ", ".join(emotions))

    manifests_idx: list[str] = []
    for emo in emotions:
        emo_dir = base_dir / emo
        ext = EXT_BY_SOURCE.get("thorsten-voice-emotional", ".opus")

        files = [f for f in sorted(emo_dir.iterdir())
                 if f.is_file() and f.suffix.lower() == ext]

        if not files:
            wavs = [f for f in sorted(emo_dir.iterdir())
                    if f.is_file() and f.suffix.lower() == ".wav"]
            if wavs:
                log.warning(
                    "emotional/%s: keine %s gefunden, %d .wav vorhanden - "
                    "vermutlich Lauf gegen Original. Manifest-Pfade werden "
                    "auf %s gesetzt.", emo, ext, len(wavs), ext)
                files = wavs

        items = []
        for f in files:
            h = f.stem
            text = text_by_hash.get(h, "")
            items.append({
                "id": h[:8],
                "text": text,
                "audio": f"thorsten-emotional_v02/{emo}/{h}{ext}",
            })
        if not items:
            continue
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "saetze",
            "title": f"Thorsten — {emo}",
            "lang": "de",
            "license": "CC0-1.0",
            "credit": "Thorsten Müller — Thorsten-Voice Emotional v0.2 (CC0)",
            "url": "https://github.com/thorstenMueller/Thorsten-Voice",
            "tags": {
                "speaker_id": "thorsten",
                "gender": "m",
                "style": "emotional",
                "emotion": emo,
            },
            "items": items,
        }
        rel = f"saetze/thorsten-{emo}.json"
        attach_durations(manifest, metadata_root, "Thorsten-Voice-Emotional/")
        write_json(out / "thorsten-voice-emotional" / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root,
                              "Thorsten-Voice-Emotional/",
                              "thorsten-voice-emotional")
        remember_paths("thorsten-voice-emotional", manifest)
        manifests_idx.append(rel)

    write_source(out, "thorsten-voice-emotional", "Thorsten-Voice Emotional v0.2",
                 "https://github.com/thorstenMueller/Thorsten-Voice", "CC0-1.0",
                 "Thorsten Müller — Thorsten-Voice Emotional v0.2 (CC0)",
                 "Thorsten-Voice-Emotional/", ["saetze"],
                 {"saetze": manifests_idx}, dry_run=dry_run)
    return "thorsten-voice-emotional"


# ============================================================
# THORSTEN-VOICE-HESSISCH (saetze, de-hes)
# ============================================================

def build_thorsten_hessisch(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "Thorsten-Voice-Hessisch"
    csv_path = src_dir / "metadata.csv"
    if not csv_path.is_file():
        log.warning("thorsten-voice-hessisch: CSV fehlt unter %s", csv_path)
        return None
    items = []
    with open(csv_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("|")
            if len(parts) < 2:
                continue
            h = parts[0].strip()
            text = parts[1].strip()  # Spalte 3 (lowercase) ignoriert
            if not h or not text:
                continue
            items.append({
                "id": h[:8],
                "text": text,
                "audio": f"wavs/{h}.opus",
            })
    log.info("thorsten-voice-hessisch: %d Sätze", len(items))

    write_source(out, "thorsten-voice-hessisch", "Thorsten-Voice Hessisch",
                 "https://zenodo.org/records/7265581", "CC0-1.0",
                 "Thorsten Müller — Thorsten-Voice Hessisch (CC0, Zenodo 7265581)",
                 "Thorsten-Voice-Hessisch/", ["saetze"],
                 {"saetze": ["saetze/thorsten-hessisch.json"]},
                 dry_run=dry_run)

    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "saetze",
        "title": "Thorsten (Hessisch)",
        "lang": "de-hes",
        "license": "CC0-1.0",
        "credit": "Thorsten Müller — Thorsten-Voice Hessisch (CC0)",
        "url": "https://github.com/thorstenMueller/Thorsten-Voice",
        "tags": {
            "speaker_id": "thorsten",
            "gender": "m",
            "style": "dialect",
            "accent": "hessisch",
        },
        "items": items,
    }
    attach_durations(manifest, metadata_root, "Thorsten-Voice-Hessisch/")
    write_json(out / "thorsten-voice-hessisch" / "saetze" / "thorsten-hessisch.json",
               manifest, dry_run)
    verify_manifest_audio(manifest, metadata_root,
                          "Thorsten-Voice-Hessisch/", "thorsten-voice-hessisch")
    remember_paths("thorsten-voice-hessisch", manifest)
    return "thorsten-voice-hessisch"


# ============================================================
# ARU SPEECH CORPUS (saetze, en, Liverpool)
# ============================================================

def build_aru(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "ARU_Speech_Corpus_v1_0"
    txt_path = src_dir / "sentences_ARU.txt"
    if not txt_path.is_file():
        log.warning("aru: sentences_ARU.txt fehlt unter %s", txt_path)
        return None

    # Format: "<filename>: <text>"
    text_by_file: dict[str, str] = {}
    with open(txt_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            idx = line.find(":")
            if idx < 0:
                continue
            fname = line[:idx].strip()
            text = line[idx + 1:].strip()
            if fname and text:
                text_by_file[fname] = text

    # Sprecher aus Dateinamen-Pattern: neue ASCII-Form id01-L01-S01-v1.opus
    # oder alte Form ID01_ARU_Fs=65536Hz_Standard speech - List 1 - ...
    pattern_new = re.compile(r"^(id\d+|ieee|sentences)-L(\d+)-S(\d+)-v\d+\.")
    pattern_old = re.compile(r"^(ID\d+|IEEE|sentences)_ARU_")
    by_speaker: dict[str, list[dict]] = defaultdict(list)
    n = 0
    for fname, text in text_by_file.items():
        m_new = pattern_new.match(fname)
        m_old = pattern_old.match(fname)
        if m_new:
            speaker_slug = m_new.group(1).lower()
            list_no = int(m_new.group(2))
            sent_no = int(m_new.group(3))
            out_name = fname
        elif m_old:
            speaker_slug = m_old.group(1).lower()
            m2 = re.search(r"List (\d+) - Sentence (\d+)", fname)
            if not m2:
                continue
            list_no = int(m2.group(1))
            sent_no = int(m2.group(2))
            out_name = (fname[:-4] + ".opus"
                        if fname.lower().endswith(".wav") else fname)
        else:
            continue
        by_speaker[speaker_slug].append({
            "id": f"L{list_no:02d}-S{sent_no:02d}",
            "text": text,
            "audio": out_name,
            "tags": {"list_no": list_no, "sentence_no": sent_no},
        })
        n += 1
    log.info("aru: %d Sätze, %d Sprecher", n, len(by_speaker))

    manifests_idx: list[str] = []
    for spk, items in sorted(by_speaker.items()):
        slug = spk.lower()
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "saetze",
            "title": f"ARU — {spk}",
            "lang": "en",
            "license": "CC-BY-4.0",
            "credit": "ARU Speech Corpus v1.0 — University of Liverpool",
            "url": "https://datacat.liverpool.ac.uk/681/",
            "tags": {
                "speaker_id": f"aru-{slug}",
                "gender": "u",  # nicht dokumentiert je Sprecher in den Quellen
                "style": "test",
                "test_set": "IEEE/Harvard sentences",
            },
            "items": sorted(items, key=lambda it: it["id"]),
        }
        rel = f"saetze/{slug}.json"
        attach_durations(manifest, metadata_root, "ARU_Speech_Corpus_v1_0/")
        write_json(out / "aru-speech-corpus" / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root,
                              "ARU_Speech_Corpus_v1_0/", "aru-speech-corpus")
        remember_paths("aru-speech-corpus", manifest)
        manifests_idx.append(rel)

    write_source(out, "aru-speech-corpus", "ARU Speech Corpus v1.0",
                 "https://datacat.liverpool.ac.uk/681/", "CC-BY-4.0",
                 "ARU Speech Corpus v1.0 — University of Liverpool",
                 "ARU_Speech_Corpus_v1_0/", ["saetze"],
                 {"saetze": manifests_idx}, dry_run=dry_run)
    return "aru-speech-corpus"


# ============================================================
# FREIBURGER SPRACHTEST (saetze + geraeusche, de)
# ============================================================

def build_freiburger(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "Freiburger"
    if not src_dir.is_dir():
        log.warning("freiburger: nicht gefunden unter %s", src_dir)
        return None

    name_pattern = re.compile(r"^L(\d+)_W(\d+)_(.+)\.wav$", re.IGNORECASE)
    items_mono: list[dict] = []
    items_poly: list[dict] = []

    for sub, dest in [("Einsilbig", items_mono), ("Mehrsilbig", items_poly)]:
        sub_dir = src_dir / sub
        if not sub_dir.is_dir():
            continue
        for wav in sub_dir.rglob("*.wav"):
            rel = wav.relative_to(src_dir)
            m = name_pattern.match(wav.name)
            if not m:
                continue
            list_no = int(m.group(1))
            word_no = int(m.group(2))
            text = m.group(3).replace("_", " ")
            dest.append({
                "id": f"L{list_no:02d}-W{word_no:02d}",
                "text": text,
                "audio": str(rel),
                "tags": {"list_no": list_no, "word_no": word_no},
            })

    # CCITT-Rauschen separat als Geraeusch
    ccitt_path = src_dir / "CCITT_Siemens_CD.wav"
    ccitt_item = None
    if ccitt_path.is_file():
        ccitt_item = {
            "id": "ccitt",
            "title": "CCITT Sprachsimulationsrauschen",
            "audio": "CCITT_Siemens_CD.wav",
            "tags": {
                "kind": "rauschen-ccitt",
                "stationary": "y",
                "loop_safe": "y",
                "spectrum": "bandpass",
            },
        }

    log.info("freiburger: %d einsilbig, %d mehrsilbig, ccitt=%s",
             len(items_mono), len(items_poly), bool(ccitt_item))

    saetze_manifests = []
    if items_mono:
        m = {
            "schema": SCHEMA_VERSION,
            "kind": "collection", "category": "saetze",
            "title": "Freiburger Sprachtest — Einsilbig",
            "lang": "de", "license": "CC-BY-4.0",
            "credit": "Freiburger Sprachtest (Zenodo 10082491)",
            "url": "https://zenodo.org/records/10082491",
            "tags": {"speaker_id": "freiburger-mono", "style": "test"},
            "items": sorted(items_mono, key=lambda it: it["id"]),
        }
        attach_durations(m, metadata_root, "Freiburger/")
        write_json(out / "freiburger" / "saetze" / "einsilbig.json", m, dry_run)
        verify_manifest_audio(m, metadata_root, "Freiburger/", "freiburger")
        remember_paths("freiburger", m)
        saetze_manifests.append("saetze/einsilbig.json")
    if items_poly:
        m = {
            "schema": SCHEMA_VERSION,
            "kind": "collection", "category": "saetze",
            "title": "Freiburger Sprachtest — Mehrsilbig",
            "lang": "de", "license": "CC-BY-4.0",
            "credit": "Freiburger Sprachtest (Zenodo 10082491)",
            "url": "https://zenodo.org/records/10082491",
            "tags": {"speaker_id": "freiburger-poly", "style": "test"},
            "items": sorted(items_poly, key=lambda it: it["id"]),
        }
        attach_durations(m, metadata_root, "Freiburger/")
        write_json(out / "freiburger" / "saetze" / "mehrsilbig.json", m, dry_run)
        verify_manifest_audio(m, metadata_root, "Freiburger/", "freiburger")
        remember_paths("freiburger", m)
        saetze_manifests.append("saetze/mehrsilbig.json")

    cat = ["saetze"]
    mf = {"saetze": saetze_manifests}
    if ccitt_item:
        m = {
            "schema": SCHEMA_VERSION,
            "kind": "collection", "category": "geraeusche",
            "title": "Freiburger Sprachtest — CCITT-Rauschen",
            "lang": None, "license": "CC-BY-4.0",
            "credit": "Freiburger Sprachtest (Zenodo 10082491)",
            "url": "https://zenodo.org/records/10082491",
            "items": [ccitt_item],
        }
        attach_durations(m, metadata_root, "Freiburger/")
        write_json(out / "freiburger" / "geraeusche" / "ccitt-rauschen.json", m, dry_run)
        verify_manifest_audio(m, metadata_root, "Freiburger/", "freiburger")
        remember_paths("freiburger", m)
        cat.append("geraeusche")
        mf["geraeusche"] = ["geraeusche/ccitt-rauschen.json"]

    write_source(out, "freiburger", "Freiburger Sprachtest",
                 "https://zenodo.org/records/10082491", "CC-BY-4.0",
                 "Freiburger Sprachtest (Zenodo 10082491)",
                 "Freiburger/", cat, mf, dry_run=dry_run)
    return "freiburger"


# ============================================================
# OLDENBURGER OLSA (saetze, de)
# ============================================================

def build_oldenburger(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "Oldenburger OLSA female"
    if not src_dir.is_dir():
        log.warning("oldenburger: nicht gefunden unter %s", src_dir)
        return None

    text_path = None
    for cand in src_dir.iterdir():
        if cand.name.lower().startswith("sentences_olsa") and cand.suffix.lower() == ".txt":
            text_path = cand
            break
    text_by_file: dict[str, str] = {}
    if text_path:
        with open(text_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip().lstrip("﻿")
                if not line:
                    continue
                idx = line.find(":")
                if idx < 0:
                    continue
                fn = line[:idx].strip()
                tx = line[idx + 1:].strip()
                if fn and tx:
                    text_by_file[fn] = tx

    items = []
    for wav in sorted(src_dir.glob("*.wav")):
        text = text_by_file.get(wav.name, "")
        items.append({
            "id": wav.stem,
            "text": text,
            "audio": wav.name,
        })
    log.info("oldenburger: %d Sätze, %d Texte gefunden",
             len(items), len([i for i in items if i["text"]]))

    write_source(out, "oldenburger-olsa", "Oldenburger OLSA (female TTS)",
                 "https://zenodo.org/records/4522088", "CC-BY-NC-SA-4.0",
                 "Oldenburger Satztest (OLSA), erzeugt mit VirtualSpeaker (Acapela) — Zenodo 4522088",
                 "Oldenburger OLSA female/", ["saetze"],
                 {"saetze": ["saetze/olsa.json"]},
                 notes="Lizenz CC-BY-NC-SA 4.0; TV-/Radio-Broadcast verboten (laut OLSAfemale_TTS.license).",
                 dry_run=dry_run)

    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "saetze",
        "title": "Oldenburger Satztest — female TTS",
        "lang": "de",
        "license": "CC-BY-NC-SA-4.0",
        "credit": "Oldenburger Satztest, VirtualSpeaker (Acapela), Zenodo 4522088",
        "url": "https://zenodo.org/records/4522088",
        "tags": {
            "speaker_id": "olsa-female",
            "gender": "w",
            "style": "test",
            "test_set": "OLSA",
        },
        "items": items,
    }
    attach_durations(manifest, metadata_root, "Oldenburger OLSA female/")
    write_json(out / "oldenburger-olsa" / "saetze" / "olsa.json", manifest, dry_run)
    verify_manifest_audio(manifest, metadata_root,
                          "Oldenburger OLSA female/", "oldenburger-olsa")
    remember_paths("oldenburger-olsa", manifest)
    return "oldenburger-olsa"


# ============================================================
# MLS (saetze aus LibriVox-Segmenten, pro Buch ein Manifest, nur dev+test)
# ============================================================

MLS_LANGS = [
    ("mls_french_opus",  "fr", "MLS Französisch"),
    ("mls_spanish_opus", "es", "MLS Spanisch"),
    ("mls_polish_opus",  "pl", "MLS Polnisch"),
]


def _mls_load_metainfo(metainfo_path: Path) -> tuple[dict[str, str], dict[str, str], dict[str, dict]]:
    """Liest metainfo.txt: speaker→gender, book→title, (book,speaker)→list of chapters."""
    spk_gender: dict[str, str] = {}
    book_title: dict[str, str] = {}
    if not metainfo_path.is_file():
        return spk_gender, book_title, {}
    with open(metainfo_path, "r", encoding="utf-8") as f:
        next(f)  # Header
        for raw in f:
            parts = [p.strip() for p in raw.split("|")]
            if len(parts) < 6:
                continue
            spk, gender, _part, _mins, book_id, title = parts[:6]
            if spk:
                spk_gender.setdefault(spk, gender)
            if book_id and title:
                book_title.setdefault(book_id, title)
    return spk_gender, book_title, {}


def _mls_load_segments(segments_path: Path) -> dict[str, tuple[str, float, float]]:
    """Liest segments.txt: {seg-id: (original_librivox_url, start_s, end_s)}."""
    out: dict[str, tuple[str, float, float]] = {}
    if not segments_path.is_file():
        return out
    with open(segments_path, "r", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 4:
                continue
            try:
                start, end = float(parts[2]), float(parts[3])
            except ValueError:
                continue
            out[parts[0]] = (parts[1], start, end)
    return out


def build_mls(metadata_root: Path, out: Path, dry_run: bool,
              dir_name: str, lang_code: str, source_name: str) -> str | None:
    src_dir = metadata_root / dir_name
    if not src_dir.is_dir():
        log.warning("%s: nicht gefunden unter %s", dir_name, src_dir)
        return None

    spk_gender, book_title, _ = _mls_load_metainfo(src_dir / "metainfo.txt")
    key = dir_name.replace("_opus", "").replace("_", "-")

    # Pro Split (dev, test) Segmente und Texte sammeln
    # Gruppieren nach BookID
    by_book: dict[str, list[dict]] = defaultdict(list)
    splits_used = []
    for split in ("dev", "test"):
        split_dir = src_dir / split
        if not split_dir.is_dir():
            continue
        tr_path = split_dir / "transcripts.txt"
        if not tr_path.is_file():
            continue
        splits_used.append(split)
        seg_meta = _mls_load_segments(split_dir / "segments.txt")
        with open(tr_path, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.rstrip("\n")
                if not line:
                    continue
                # <segment-id>\t<text>
                if "\t" in line:
                    seg_id, text = line.split("\t", 1)
                else:
                    parts = line.split(" ", 1)
                    if len(parts) != 2:
                        continue
                    seg_id, text = parts
                # seg_id = <spk>_<book>_<NNNNNN>
                segm = re.match(r"^(\d+)_(\d+)_(\d+)$", seg_id.strip())
                if not segm:
                    continue
                spk, book, idx = segm.group(1), segm.group(2), segm.group(3)
                audio_rel = f"{split}/audio/{spk}/{book}/{seg_id}.opus"
                tags = {
                    "speaker_id": f"mls-{lang_code}-{spk}",
                    "gender": ("m" if spk_gender.get(spk) == "M"
                               else "w" if spk_gender.get(spk) == "F" else "u"),
                    "book_id": book,
                    "split": split,
                }
                if seg_id in seg_meta:
                    src_url, s_start, s_end = seg_meta[seg_id]
                    tags["original_url"] = src_url
                    tags["original_start_s"] = round(s_start, 2)
                    tags["original_end_s"] = round(s_end, 2)
                by_book[book].append({
                    "id": seg_id,
                    "text": text.strip(),
                    "audio": audio_rel,
                    "tags": tags,
                })

    log.info("%s: %d Bücher, %d Segmente, Splits=%s",
             key, len(by_book), sum(len(v) for v in by_book.values()),
             ",".join(splits_used))

    manifests_idx: list[str] = []
    for book, items in sorted(by_book.items()):
        title = book_title.get(book, f"Buch {book}")
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:40]
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "saetze",
            "title": title,
            "lang": lang_code,
            "license": "CC-BY-4.0",
            "credit": "MLS (Multilingual LibriSpeech) — Facebook AI",
            "url": "https://www.openslr.org/94/",
            "tags": {
                "style": "test",
                "book_id": book,
                "book_title": title,
                "origin": "librivox-via-mls",
            },
            "items": sorted(items, key=lambda it: it["id"]),
        }
        fname = f"buch-{slug or 'x'}-{book}.json"
        rel = f"saetze/{fname}"
        attach_durations(manifest, metadata_root, f"{dir_name}/")
        write_json(out / key / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root, f"{dir_name}/", key)
        remember_paths(key, manifest)
        manifests_idx.append(rel)

    write_source(out, key, source_name,
                 "https://www.openslr.org/94/", "CC-BY-4.0",
                 f"{source_name} — basiert auf LibriVox-Hörbüchern (CC-BY 4.0)",
                 f"{dir_name}/", ["saetze"],
                 {"saetze": manifests_idx}, dry_run=dry_run)
    return key


# ============================================================
# COMMON VOICE (saetze, viele Sprachen, CC0)
# ============================================================

CV_ROOT_REL = "common-voice/assets/sentences/common-voice"


def build_common_voice(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    cv_root = metadata_root / CV_ROOT_REL
    if not cv_root.is_dir():
        log.warning("common-voice: nicht gefunden unter %s", cv_root)
        return None

    manifests_idx: list[str] = []
    n_langs = 0
    for lang_dir in sorted(cv_root.iterdir()):
        if not lang_dir.is_dir():
            continue
        cv_manifest = lang_dir / "manifest.json"
        if not cv_manifest.is_file():
            continue
        with open(cv_manifest, "r", encoding="utf-8") as f:
            cv = json.load(f)
        lang = cv.get("lang", lang_dir.name)
        raw_items = cv.get("items", [])
        items = []
        for r in raw_items:
            g = (r.get("gender") or "u")[:1]
            if g not in ("m", "f", "u"):
                g = "u"
            gender = "w" if g == "f" else g
            tags = {
                "source_item_id": str(r.get("id", "")),
                "gender": gender,
            }
            acc = r.get("accent")
            if acc:
                tags["accent"] = acc
            items.append({
                "id": str(r.get("id")),
                "text": r.get("text", "").strip(),
                # Item-Pfad ist relativ zum Lang-Ordner — wir präfixen mit lang,
                # damit er relativ zur Source-base (common-voice/assets/sentences/common-voice/)
                # auflöst.
                "audio": f"{lang_dir.name}/{r.get('audio', '')}",
                "tags": tags,
            })
        if not items:
            continue
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "saetze",
            "title": f"Common Voice — {lang}",
            "lang": lang,
            "license": "CC0-1.0",
            "credit": f"Mozilla Common Voice {cv.get('source', '17.0')} (CC0)",
            "url": "https://commonvoice.mozilla.org",
            "tags": {
                "speaker_id": f"cv-{lang}",
                "style": "crowdsourced",
                "split_used": cv.get("split_used"),
            },
            "items": items,
        }
        rel = f"saetze/cv-{lang}.json"
        cv_base = "common-voice/assets/sentences/common-voice/"
        attach_durations(manifest, metadata_root, cv_base)
        write_json(out / "common-voice" / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root, cv_base, "common-voice")
        remember_paths("common-voice", manifest)
        manifests_idx.append(rel)
        n_langs += 1
    log.info("common-voice: %d Sprachen", n_langs)

    write_source(out, "common-voice", "Mozilla Common Voice",
                 "https://commonvoice.mozilla.org", "CC0-1.0",
                 "Mozilla Common Voice 17.0 (CC0)",
                 "common-voice/assets/sentences/common-voice/", ["saetze"],
                 {"saetze": manifests_idx}, dry_run=dry_run)
    return "common-voice"


# ============================================================
# MUSAN MUSIC + NOISE
# ============================================================

def _musan_parse_music_annot(path: Path) -> list[dict]:
    """ANNOTATIONS-Format: <id> <genres,csv> <vocal Y/N> <album> [<artist>]"""
    out: list[dict] = []
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 4:
                continue
            iid = parts[0]
            genres = [g.strip() for g in parts[1].split(",") if g.strip()]
            vocal = "y" if parts[2].upper() == "Y" else "n"
            album = parts[3]
            artist = parts[4] if len(parts) >= 5 else None
            out.append({
                "id": iid,
                "genres": genres,
                "vocal": vocal,
                "album": album,
                "artist": artist,
            })
    return out


def build_musan(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "musan"
    if not src_dir.is_dir():
        log.warning("musan: nicht gefunden unter %s", src_dir)
        return None

    # --- Music ---
    music_subs = ["fma", "fma-western-art", "hd-classical", "jamendo", "rfm"]
    music_manifests: list[str] = []
    n_music = 0
    for sub in music_subs:
        sub_dir = src_dir / "music" / sub
        annot_path = sub_dir / "ANNOTATIONS"
        license_path = sub_dir / "LICENSE"
        if not annot_path.is_file():
            continue
        parsed = _musan_parse_music_annot(annot_path)
        license_map = parse_musan_license_blocks(license_path)
        fallback_license = musan_pauschal_license(license_path)
        items = []
        for p in parsed:
            spdx, lic_url = license_map.get(p["id"].lower(), (fallback_license or "unknown", None))
            tags = {
                "genres": p["genres"],
                "artist": (p["artist"] or "").replace("_", " ") or None,
                "album": p["album"].replace("_", " "),
                "vocal": p["vocal"],
                "license": spdx,
            }
            if lic_url:
                tags["license_url"] = lic_url
            items.append({
                "id": p["id"],
                "title": p["album"].replace("_", " "),
                "audio": f"music/{sub}/{p['id']}.opus",
                "tags": tags,
            })
        if not items:
            continue
        # Sammel-Lizenz auf Collection-Ebene: häufigste, oder "mixed"
        from collections import Counter as _Counter
        lic_counter = _Counter(it["tags"]["license"] for it in items)
        coll_license = "mixed" if len(lic_counter) > 1 else next(iter(lic_counter), "unknown")
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "musik",
            "title": f"MUSAN — {sub}",
            "lang": None,
            "license": coll_license,
            "credit": f"MUSAN ({sub}), Lizenzen pro Item",
            "url": "https://www.openslr.org/17/",
            "items": items,
        }
        rel = f"musik/{sub}.json"
        attach_durations(manifest, metadata_root, "musan/")
        write_json(out / "musan" / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root, "musan/", "musan")
        remember_paths("musan", manifest)
        music_manifests.append(rel)
        n_music += len(items)
    log.info("musan music: %d Items in %d Sub-Quellen", n_music, len(music_manifests))

    # --- Noise ---
    noise_subs = ["free-sound", "sound-bible"]
    noise_manifests: list[str] = []
    n_noise = 0
    for sub in noise_subs:
        sub_dir = src_dir / "noise" / sub
        if not sub_dir.is_dir():
            continue
        wavs = sorted(p.name for p in sub_dir.glob("*.wav"))
        if not wavs:
            continue
        license_path = sub_dir / "LICENSE"
        license_map = parse_musan_license_blocks(license_path)
        fallback_license = musan_pauschal_license(license_path)
        items = []
        for w in wavs:
            iid = Path(w).stem
            spdx, lic_url = license_map.get(iid.lower(), (fallback_license or "unknown", None))
            tags = {
                "kind": None,
                "stationary": None,
                "loop_safe": None,
                "license": spdx,
            }
            if lic_url:
                tags["license_url"] = lic_url
            items.append({
                "id": iid,
                "audio": f"noise/{sub}/{w}",
                "tags": tags,
            })
        from collections import Counter as _Counter
        lic_counter = _Counter(it["tags"]["license"] for it in items)
        coll_license = "mixed" if len(lic_counter) > 1 else next(iter(lic_counter), "unknown")
        manifest = {
            "schema": SCHEMA_VERSION,
            "kind": "collection",
            "category": "geraeusche",
            "title": f"MUSAN Geräusche — {sub}",
            "lang": None,
            "license": coll_license,
            "credit": f"MUSAN ({sub}), Lizenzen pro Item",
            "url": "https://www.openslr.org/17/",
            "items": items,
        }
        rel = f"geraeusche/{sub}.json"
        attach_durations(manifest, metadata_root, "musan/")
        write_json(out / "musan" / rel, manifest, dry_run)
        verify_manifest_audio(manifest, metadata_root, "musan/", "musan")
        remember_paths("musan", manifest)
        noise_manifests.append(rel)
        n_noise += len(items)
    log.info("musan noise: %d Items in %d Sub-Quellen", n_noise, len(noise_manifests))

    cats: list[str] = []
    mf: dict[str, list[str]] = {}
    if music_manifests:
        cats.append("musik")
        mf["musik"] = music_manifests
    if noise_manifests:
        cats.append("geraeusche")
        mf["geraeusche"] = noise_manifests

    write_source(out, "musan", "MUSAN — Music And Speech And Noise",
                 "https://www.openslr.org/17/", "mixed",
                 "MUSAN-Korpus (Snyder et al. 2015), Lizenzen pro Item",
                 "musan/", cats, mf,
                 notes="kind/stationary/loop_safe für Geräusche noch leer, manuell zu ergänzen.",
                 dry_run=dry_run)
    return "musan"


# ============================================================
# TEST-NOISE (geraeusche, drei hochwertige WAVs)
# ============================================================

def build_test_noise(metadata_root: Path, out: Path, dry_run: bool) -> str | None:
    src_dir = metadata_root / "test-noise"
    noise_dir = src_dir / "noise"
    if not noise_dir.is_dir():
        log.warning("test-noise: nicht gefunden")
        return None

    spec = [
        ("cafe", "noise/cafe/cafe.wav",
         {"kind": "cafe", "stationary": "y", "loop_safe": "y", "spectrum": "broadband"}),
        ("car", "noise/car/car.wav",
         {"kind": "verkehr", "stationary": "y", "loop_safe": "y", "spectrum": "lowpass"}),
        ("white", "noise/white/white.wav",
         {"kind": "rauschen-weiss", "stationary": "y", "loop_safe": "y", "spectrum": "broadband"}),
    ]
    items = []
    for iid, rel, tags in spec:
        if (src_dir / rel).is_file():
            items.append({"id": iid, "title": iid, "audio": rel, "tags": tags})
    if not items:
        log.warning("test-noise: keine erwarteten Dateien gefunden")
        return None
    log.info("test-noise: %d Geräusche", len(items))

    write_source(out, "test-noise", "THCHS30 Test-Noise",
                 "https://www.openslr.org/18/", "CC-BY-4.0",
                 "THCHS30 / OpenSLR 18 — drei kuratierte Geräusche",
                 "test-noise/", ["geraeusche"],
                 {"geraeusche": ["geraeusche/test-noise.json"]}, dry_run=dry_run)

    manifest = {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "geraeusche",
        "title": "THCHS30 Test-Noise",
        "lang": None,
        "license": "CC-BY-4.0",
        "credit": "THCHS30 — Tsinghua University",
        "url": "https://www.openslr.org/18/",
        "items": items,
    }
    attach_durations(manifest, metadata_root, "test-noise/")
    write_json(out / "test-noise" / "geraeusche" / "test-noise.json",
               manifest, dry_run)
    verify_manifest_audio(manifest, metadata_root, "test-noise/", "test-noise")
    remember_paths("test-noise", manifest)
    return "test-noise"


# ============================================================
# TOP-INDEX
# ============================================================

def write_top_index(out: Path, source_keys: list[str], dry_run: bool) -> None:
    sources: list[dict] = []
    for key in sorted(source_keys):
        sp = out / key / "source.json"
        if not sp.is_file():
            continue
        with open(sp, "r", encoding="utf-8") as f:
            s = json.load(f)
        sources.append({
            "key": s.get("key", key),
            "name": s.get("name", key),
            "categories": s.get("categories", []),
            "license": s.get("license", "unknown"),
            "source": f"{key}/source.json",
        })
    data = {
        "schema": SCHEMA_VERSION,
        "kind": "index",
        "title": "CI Sound Balancing — Audio-Bibliotheken",
        "description": "Top-Level-Index aller Quellen unter audio.manifest/.",
        "sources": sources,
    }
    write_json(out / "index.json", data, dry_run)


# ============================================================
# MAIN
# ============================================================

ALL_BUILDERS = {
    "thorsten-voice":            lambda mr, out, dr: build_thorsten_voice(mr, out, dr),
    "thorsten-voice-emotional":  lambda mr, out, dr: build_thorsten_emotional(mr, out, dr),
    "thorsten-voice-hessisch":   lambda mr, out, dr: build_thorsten_hessisch(mr, out, dr),
    "aru-speech-corpus":         lambda mr, out, dr: build_aru(mr, out, dr),
    "freiburger":                lambda mr, out, dr: build_freiburger(mr, out, dr),
    "oldenburger-olsa":          lambda mr, out, dr: build_oldenburger(mr, out, dr),
    "mls-french":                lambda mr, out, dr: build_mls(mr, out, dr,
                                                                 "mls_french_opus", "fr",
                                                                 "MLS Französisch"),
    "mls-spanish":               lambda mr, out, dr: build_mls(mr, out, dr,
                                                                 "mls_spanish_opus", "es",
                                                                 "MLS Spanisch"),
    "mls-polish":                lambda mr, out, dr: build_mls(mr, out, dr,
                                                                 "mls_polish_opus", "pl",
                                                                 "MLS Polnisch"),
    "common-voice":              lambda mr, out, dr: build_common_voice(mr, out, dr),
    "musan":                     lambda mr, out, dr: build_musan(mr, out, dr),
    "test-noise":                lambda mr, out, dr: build_test_noise(mr, out, dr),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mirror-root", type=Path, default=DEFAULT_MIRROR,
                    help="Wo die Audio-Dateien liegen (Default: voice/opus/)")
    ap.add_argument("--metadata-root", type=Path, default=None,
                    help="Wo die Sidecar-Metadaten liegen (Default: gleich wie --mirror-root)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help=f"Ausgabe-Wurzel (Default: {DEFAULT_OUT})")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", nargs="*", default=None,
                    help="Nur diese Quell-Keys bauen.")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(message)s")

    metadata_root = (args.metadata_root or args.mirror_root).resolve()
    out_root = args.out.resolve()
    log.info("Metadaten aus: %s", metadata_root)
    log.info("Manifeste nach: %s", out_root)

    _check_ffprobe()
    load_duration_cache()

    selected = args.only or list(ALL_BUILDERS.keys())
    built: list[str] = []
    for key in selected:
        if key not in ALL_BUILDERS:
            log.error("Unbekannter Quell-Key: %s", key)
            continue
        try:
            result = ALL_BUILDERS[key](metadata_root, out_root, args.dry_run)
            if result:
                built.append(result)
        except Exception as e:
            log.exception("Quelle %s fehlgeschlagen: %s", key, e)

    # Orphan-Scan und Diff-Report
    for src_key, base in _BUILD_SOURCE_BASES.items():
        manifested = _BUILD_AUDIO_PATHS.get(src_key, set())
        scan_orphans(metadata_root, base, src_key, manifested)

    report_path = out_root / "_diff_report.md"
    write_diff_report(report_path, _BUILD_DIFFS, dry_run=args.dry_run)
    log.info("Differenzen-Report: %s", report_path)
    log.info("  - %d fehlende Audio-Dateien",
             len(_BUILD_DIFFS["missing_audio"]))
    log.info("  - %d verwaiste Audio-Dateien",
             len(_BUILD_DIFFS["orphan_audio"]))

    save_duration_cache(args.dry_run)

    if built:
        write_top_index(out_root, built, args.dry_run)
        log.info("Top-Index geschrieben: %d Quellen.", len(built))
    return 0


if __name__ == "__main__":
    sys.exit(main())
