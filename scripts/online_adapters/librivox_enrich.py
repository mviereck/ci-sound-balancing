#!/usr/bin/env python3
"""
librivox_enrich.py — Stage-2-Anreicherung der LibriVox-Buch-Manifeste
=====================================================================

Liest eine Anreicherungs-Datei mit manuell gepflegten Tags
(z. B. genres, reader_gender) und schreibt sie in die zugehörigen
Buch-Manifeste unter audio.manifest/online/librivox/hoerbuecher/buecher/.

Damit bleibt der LibriVox-Adapter (der die Buch-Manifeste regenerieren
kann) frei von manuell gepflegten Daten — und manuelle Anreicherungen
müssen nicht nach jedem Adapter-Lauf neu eingetragen werden.

Reihenfolge im Build-Workflow
-----------------------------

    1. librivox.py          → Buch-Manifeste neu aus API
    2. librivox_enrich.py   → manuelle Tags drüberlegen

Aufruf
------

    python3 scripts/online_adapters/librivox_enrich.py \\
        --enrichment scripts/online_adapters/librivox_enrichment.json \\
        --manifests audio.manifest/online/librivox/hoerbuecher/buecher
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

DEFAULT_ENRICH = Path(__file__).resolve().parent / "librivox_enrichment.json"
DEFAULT_MANIFESTS = (Path(__file__).resolve().parents[2]
                     / "audio.manifest/online/librivox/hoerbuecher/buecher")

log = logging.getLogger("librivox_enrich")


def load_enrichment(p: Path) -> dict:
    if not p.is_file():
        log.error("Anreicherungs-Datei fehlt: %s", p)
        sys.exit(1)
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)


def book_id(manifest: dict) -> str | None:
    tags = manifest.get("tags") or {}
    sid = tags.get("source_item_id")
    return str(sid) if sid else None


def merge(manifest: dict, enr: dict) -> bool:
    """Merged enr in manifest['tags']. Liefert True wenn etwas geändert."""
    tags = manifest.setdefault("tags", {})
    changed = False
    for key in ("genres", "reader_gender", "notes"):
        if key in enr and enr[key] != tags.get(key):
            tags[key] = enr[key]
            changed = True
    return changed


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--enrichment", type=Path, default=DEFAULT_ENRICH)
    ap.add_argument("--manifests", type=Path, default=DEFAULT_MANIFESTS)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    enrichment = load_enrichment(args.enrichment)
    if not args.manifests.is_dir():
        log.error("Buch-Manifest-Verzeichnis fehlt: %s", args.manifests)
        return 1

    n_seen = n_matched = n_changed = 0
    for mf in sorted(args.manifests.glob("*.json")):
        try:
            with open(mf, "r", encoding="utf-8") as f:
                manifest = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            log.warning("Skip defektes Manifest %s: %s", mf, e)
            continue
        n_seen += 1
        bid = book_id(manifest)
        if not bid or bid not in enrichment:
            continue
        n_matched += 1
        # _comment-Werte ignorieren
        enr = {k: v for k, v in enrichment[bid].items() if not k.startswith("_")}
        if merge(manifest, enr):
            n_changed += 1
            if not args.dry_run:
                with open(mf, "w", encoding="utf-8") as f:
                    json.dump(manifest, f, ensure_ascii=False, indent=2)
                    f.write("\n")
            log.info("[%s] %s → angereichert", bid, mf.name)

    log.info("Fertig. %d Buch-Manifeste gesehen, %d gematcht, %d geändert.",
             n_seen, n_matched, n_changed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
