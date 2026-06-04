#!/usr/bin/env python3
"""
musan_noise_enrich.py — Stage-2-Anreicherung der MUSAN-Geräusch-Manifeste
=========================================================================

Liest eine Anreicherungs-Datei mit kind/stationary/loop_safe-Tags pro
Item und schreibt sie in die zugehörigen Geräusch-Manifeste unter
audio.manifest/musan/geraeusche/.

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
import sys
from pathlib import Path

DEFAULT_ENRICH = Path(__file__).resolve().parent / "musan_noise_enrichment.json"
DEFAULT_MANIFESTS = (Path(__file__).resolve().parents[1]
                     / "audio.manifest/musan/geraeusche")

ENRICH_KEYS = ("kind", "stationary", "loop_safe", "spectrum",
               "dominant_freq_hz", "level_db", "notes")

log = logging.getLogger("musan_noise_enrich")


def merge_item(item: dict, enr: dict) -> bool:
    tags = item.setdefault("tags", {})
    changed = False
    for key in ENRICH_KEYS:
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

    if not args.enrichment.is_file():
        log.error("Anreicherungs-Datei fehlt: %s", args.enrichment)
        return 1
    with open(args.enrichment, "r", encoding="utf-8") as f:
        enrichment = {k: v for k, v in json.load(f).items() if not k.startswith("_")}

    if not args.manifests.is_dir():
        log.error("Geräusch-Manifest-Verzeichnis fehlt: %s", args.manifests)
        return 1

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
            iid = it.get("id")
            if iid in enrichment:
                if merge_item(it, enrichment[iid]):
                    changed_in_file += 1
        if changed_in_file:
            n_files += 1
            n_items_changed += changed_in_file
            if not args.dry_run:
                with open(mf, "w", encoding="utf-8") as f:
                    json.dump(manifest, f, ensure_ascii=False, indent=2)
                    f.write("\n")
            log.info("%s → %d Items angereichert", mf.name, changed_in_file)

    log.info("Fertig. %d Dateien geändert, %d Items angereichert.",
             n_files, n_items_changed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
