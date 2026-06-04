#!/usr/bin/env python3
"""
aru_ascii_rename.py - ARU-Mirror auf ASCII-saubere Dateinamen
==============================================================

Benennt die Dateien im ARU-Mirror unter voice/opus/ARU_Speech_Corpus_v1_0/
um, damit sie in URLs ohne Encoding funktionieren. Die Sidecar-Datei
sentences_ARU.txt wird mit umbenannt, damit build_manifests.py beim
naechsten Lauf die neuen Namen findet.

Schema:
  ID01_ARU_Fs=65536Hz_Standard speech - List 1 - Sentence 1 - Version 1_0.opus
  -> id01-L01-S01-v1.opus

Idempotent: ein zweiter Lauf erkennt bereits umbenannte Dateien an der
neuen Form und ueberspringt sie.

Aufruf:
    python3 scripts/aru_ascii_rename.py --dry-run
    python3 scripts/aru_ascii_rename.py
    python3 scripts/aru_ascii_rename.py --mirror /pfad/zu/voice/opus
"""

from __future__ import annotations

import argparse
import logging
import re
import sys
from pathlib import Path

DEFAULT_MIRROR = Path("/mnt/xbox/lauscher/voice/opus")
ARU_SUBDIR = "ARU_Speech_Corpus_v1_0"

# Akzeptiert sowohl Original- als auch evtl. teilumbenannte Form
RENAME_PATTERN = re.compile(
    r"^(ID\d+|IEEE|sentences)_ARU_Fs=\d+Hz_Standard[ _-]speech[ _-]+"
    r"List[ _-]?(\d+)[ _-]+Sentence[ _-]?(\d+)[ _-]+Version[ _-]?(\d+)_(\d+)\.([A-Za-z0-9]+)$",
    re.IGNORECASE,
)

NEW_PATTERN = re.compile(r"^(id\d+|ieee|sentences)-L(\d+)-S(\d+)-v(\d+)\.[A-Za-z0-9]+$")

log = logging.getLogger("aru_ascii_rename")


def new_name(old: str) -> str | None:
    """None, wenn der Name schon im Zielformat ist oder nicht matcht."""
    if NEW_PATTERN.match(old):
        return None
    m = RENAME_PATTERN.match(old)
    if not m:
        return None
    speaker = m.group(1).lower()
    list_no = int(m.group(2))
    sent_no = int(m.group(3))
    ver_no  = int(m.group(4))
    ext     = m.group(6).lower()
    return f"{speaker}-L{list_no:02d}-S{sent_no:02d}-v{ver_no}.{ext}"


def rename_files(aru_root: Path, dry_run: bool) -> dict[str, str]:
    """Renamings als old_basename -> new_basename, rekursiv."""
    mapping: dict[str, str] = {}
    for p in sorted(aru_root.rglob("*")):
        if not p.is_file():
            continue
        nn = new_name(p.name)
        if nn is None:
            continue
        target = p.with_name(nn)
        if target.exists():
            log.warning("Ziel existiert schon, uebersprungen: %s -> %s",
                        p.name, nn)
            continue
        if dry_run:
            log.info("DRY rename %s -> %s", p.name, nn)
        else:
            p.rename(target)
        mapping[p.name] = nn
    return mapping


def patch_sidecar(sidecar: Path, mapping: dict[str, str],
                  dry_run: bool) -> int:
    """Ersetzt alte Dateinamen in der Sidecar-Datei. Liefert Anzahl
    ersetzter Vorkommen."""
    if not sidecar.is_file() or not mapping:
        return 0
    text = sidecar.read_text(encoding="utf-8")
    n = 0
    for old, new in mapping.items():
        cnt = text.count(old)
        if cnt:
            text = text.replace(old, new)
            n += cnt
    if n and not dry_run:
        sidecar.write_text(text, encoding="utf-8")
    elif n:
        log.info("DRY patch sentences_ARU.txt: %d Ersetzungen", n)
    return n


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mirror", type=Path, default=DEFAULT_MIRROR,
                    help="Voice-Mirror-Wurzel "
                         "(Default: /mnt/xbox/lauscher/voice/opus)")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(message)s")

    aru_root = args.mirror / ARU_SUBDIR
    if not aru_root.is_dir():
        log.error("ARU-Mirror fehlt: %s", aru_root)
        return 1

    mapping = rename_files(aru_root, args.dry_run)
    log.info("Umbenannt: %d Audiodateien", len(mapping))

    sidecar = aru_root / "sentences_ARU.txt"
    n = patch_sidecar(sidecar, mapping, args.dry_run)
    log.info("Sidecar-Ersetzungen: %d", n)

    return 0


if __name__ == "__main__":
    sys.exit(main())
