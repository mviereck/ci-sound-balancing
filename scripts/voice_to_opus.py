#!/usr/bin/env python3
"""
voice_to_opus.py
================

Erzeugt einen vollständigen Mirror des voice/-Ordners unter
voice/opus/. Im Mirror sind:

- WAV-Aufnahmen aus konvertier-tauglichen Quellen als .opus,
- WAV-Aufnahmen aus Test-Standards (Freiburger, Oldenburger) und
  Geräusche-Sammlungen (musan/noise, test-noise/noise) **unverändert**
  kopiert (genormtes Material — nicht antasten),
- alle anderen Dateien (Manifeste, README, LICENSE, metadata.csv,
  transcripts.txt, ANNOTATIONS, schon-komprimierte mp3/opus, …)
  unverändert kopiert.

Der voice/-Original-Ordner wird nie verändert. voice/opus/ ist der
spätere Webspace-Inhalt.

Ausgeschlossen vom Mirror:
- der Mirror-Ordner selbst (verhindert Rekursion)
- macOS-Müllordner (__MACOSX) und .DS_Store
- entpackte Quell-Archive im voice-Wurzel (*.tgz, *.tar.gz) — der
  entpackte Inhalt liegt schon nebenan und wird mit-gemirrort.

Beispielaufrufe
---------------

    # Trockenlauf
    python3 scripts/voice_to_opus.py --dry-run

    # Mirror erzeugen
    python3 scripts/voice_to_opus.py

    # andere Voice-Wurzel
    python3 scripts/voice_to_opus.py --voice-root /pfad/zu/voice

    # andere Bitrate
    python3 scripts/voice_to_opus.py --bitrate 96k

Verhalten
---------

- Idempotent: bestehende Mirror-Dateien werden übersprungen.
- Fortschrittsanzeige alle 50 Einträge.
- Schreibt CONVERT.log in den Voice-Root.
- Bei ffmpeg-Fehlern: unvollständige .opus-Datei wird gelöscht,
  Lauf macht weiter.
"""

import argparse
import logging
import shutil
import subprocess
import sys
from pathlib import Path

VOICE_ROOT_DEFAULT = Path("/mnt/xbox/lauscher/voice")
MIRROR_SUBDIR = "opus"

# Pfade relativ zu VOICE_ROOT, deren WAVs *nicht* konvertiert, sondern
# unverändert in den Mirror kopiert werden. Material ist genormt oder roh.
NO_CONVERT_DIRS = [
    "Freiburger",                  # Freiburger Sprachtest (Standard)
    "Oldenburger OLSA female",     # OLSA-Standard
    "musan/noise",                 # Geräusche
    "musan/speech",                # leer nach Bereinigung, hier nur Belegdateien
    "test-noise/noise",            # 3 hochwertige Geräusche (cafe/car/white)
    "test-noise/0db",              # leer nach Bereinigung
]

# Top-Level-Pfade, die komplett übersprungen werden (nicht in den Mirror).
SKIP_TOP_PATHS = [
    MIRROR_SUBDIR,                 # der Mirror selbst (Rekursionsschutz)
]

# Relative Pfade (mehrteilig erlaubt), die komplett aus dem Mirror
# ausgeschlossen werden. Wir nehmen aus den MLS-Korpora nur die
# kuratierten dev/test-Splits — der riesige train-Split bleibt lokal
# als Reserve, gehört aber nicht in den Webspace.
SKIP_SUBPATHS = [
    "mls_french_opus/train",
    "mls_spanish_opus/train",
    "mls_polish_opus/train",
]

# Pfadkomponenten, die überall ignoriert werden.
SKIP_DIR_NAMES = {
    "__MACOSX",
    ".git",
}
SKIP_FILE_NAMES = {
    ".DS_Store",
    "CONVERT.log",
}

# Wurzel-Dateien, die nicht in den Mirror gehören (Archive, deren
# entpackter Inhalt nebenan liegt).
SKIP_ROOT_FILE_SUFFIXES = {".tgz", ".tar.gz", ".gz"}

CONVERT_EXTS = {".wav"}
TARGET_EXT = ".opus"
DEFAULT_BITRATE = "64k"


def has_skipped_dir(rel_parts) -> bool:
    return any(part in SKIP_DIR_NAMES for part in rel_parts)


def is_excluded_from_mirror(path: Path, voice_root: Path) -> bool:
    rel = path.relative_to(voice_root)
    parts = rel.parts
    if not parts:
        return True
    if parts[0] in SKIP_TOP_PATHS:
        return True
    if has_skipped_dir(parts):
        return True
    rel_str = str(rel)
    for sp in SKIP_SUBPATHS:
        if rel_str == sp or rel_str.startswith(sp + "/"):
            return True
    if path.is_file():
        if path.name in SKIP_FILE_NAMES:
            return True
        # Top-Level-Archive überspringen
        if len(parts) == 1:
            for suffix in SKIP_ROOT_FILE_SUFFIXES:
                if path.name.endswith(suffix):
                    return True
    return False


def is_in_no_convert_area(path: Path, voice_root: Path) -> bool:
    rel_str = str(path.relative_to(voice_root))
    for d in NO_CONVERT_DIRS:
        if rel_str == d or rel_str.startswith(d + "/"):
            return True
    return False


def is_convert_candidate(path: Path, voice_root: Path) -> bool:
    if not path.is_file():
        return False
    if path.suffix.lower() not in CONVERT_EXTS:
        return False
    return not is_in_no_convert_area(path, voice_root)


def walk_files(voice_root: Path):
    for p in voice_root.rglob("*"):
        if not p.is_file():
            continue
        if is_excluded_from_mirror(p, voice_root):
            continue
        yield p


def convert_to_opus(src: Path, dst: Path, bitrate: str) -> bool:
    cmd = [
        "ffmpeg", "-y", "-hide_banner", "-loglevel", "warning",
        "-i", str(src),
        "-c:a", "libopus",
        "-b:a", bitrate,
        "-application", "audio",
        "-vbr", "on",
        "-compression_level", "10",
        str(dst),
    ]
    try:
        subprocess.run(cmd, check=True)
        return True
    except subprocess.CalledProcessError as e:
        logging.error("ffmpeg fehlgeschlagen fuer %s: %s", src, e)
        if dst.exists():
            try:
                dst.unlink()
            except OSError:
                pass
        return False


def copy_file(src: Path, dst: Path) -> bool:
    try:
        shutil.copy2(src, dst)
        return True
    except OSError as e:
        logging.error("Kopie fehlgeschlagen fuer %s: %s", src, e)
        return False


def mirror_target(src: Path, voice_root: Path, mirror_root: Path, convert: bool) -> Path:
    rel = src.relative_to(voice_root)
    dst = mirror_root / rel
    if convert:
        dst = dst.with_suffix(TARGET_EXT)
    return dst


def main():
    ap = argparse.ArgumentParser(
        description="Erzeugt voice/opus/ als Mirror — WAVs konvertiert, Rest unverändert.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--voice-root", type=Path, default=VOICE_ROOT_DEFAULT,
                    help=f"Wurzel des Voice-Ordners (Default: {VOICE_ROOT_DEFAULT})")
    ap.add_argument("--mirror-subdir", default=MIRROR_SUBDIR,
                    help=f"Unterordner-Name für den Mirror (Default: {MIRROR_SUBDIR})")
    ap.add_argument("--dry-run", action="store_true",
                    help="Nur zeigen, was passieren wuerde")
    ap.add_argument("--bitrate", default=DEFAULT_BITRATE,
                    help=f"Opus-Bitrate (Default: {DEFAULT_BITRATE})")
    args = ap.parse_args()

    voice_root = args.voice_root.resolve()
    if not voice_root.is_dir():
        print(f"Voice-Ordner nicht gefunden: {voice_root}", file=sys.stderr)
        sys.exit(1)

    mirror_root = voice_root / args.mirror_subdir
    # Top-Level-Skip dynamisch an mirror_subdir anpassen
    if args.mirror_subdir not in SKIP_TOP_PATHS:
        SKIP_TOP_PATHS.append(args.mirror_subdir)

    log_path = voice_root / "CONVERT.log"
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )

    logging.info("Voice-Root: %s", voice_root)
    logging.info("Mirror-Ziel: %s", mirror_root)
    logging.info("Bitrate fuer Konvertierung: %s", args.bitrate)
    if args.dry_run:
        logging.info("DRY-RUN — es wird nichts geschrieben.")

    if not args.dry_run:
        mirror_root.mkdir(parents=True, exist_ok=True)

    convert_n = copy_n = skipped_n = fail_n = 0
    bytes_in = bytes_out = 0
    seen = 0

    for src in walk_files(voice_root):
        seen += 1
        convert = is_convert_candidate(src, voice_root)
        dst = mirror_target(src, voice_root, mirror_root, convert)

        if dst.exists():
            skipped_n += 1
        else:
            if not args.dry_run:
                dst.parent.mkdir(parents=True, exist_ok=True)
            if convert:
                if args.dry_run:
                    logging.info("DRY conv: %s -> %s", src, dst)
                    convert_n += 1
                else:
                    ok = convert_to_opus(src, dst, args.bitrate)
                    if ok and dst.exists():
                        convert_n += 1
                        bytes_in += src.stat().st_size
                        bytes_out += dst.stat().st_size
                    else:
                        fail_n += 1
            else:
                if args.dry_run:
                    logging.info("DRY copy: %s -> %s", src, dst)
                    copy_n += 1
                else:
                    ok = copy_file(src, dst)
                    if ok:
                        copy_n += 1
                    else:
                        fail_n += 1

        if seen % 100 == 0:
            saved_mb = (bytes_in - bytes_out) / (1024 * 1024)
            logging.info(
                "Fortschritt: gesehen=%d, konvertiert=%d, kopiert=%d, übersprungen=%d, fehl=%d, eingespart=%.1f MB",
                seen, convert_n, copy_n, skipped_n, fail_n, saved_mb,
            )

    saved_mb = (bytes_in - bytes_out) / (1024 * 1024)
    logging.info(
        "Fertig. gesehen=%d, konvertiert=%d, kopiert=%d, übersprungen=%d, fehl=%d, eingespart=%.1f MB",
        seen, convert_n, copy_n, skipped_n, fail_n, saved_mb,
    )
    logging.info("Originale unter %s wurden nicht angetastet.", voice_root)


if __name__ == "__main__":
    main()
