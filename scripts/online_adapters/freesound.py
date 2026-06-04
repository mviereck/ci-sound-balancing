#!/usr/bin/env python3
"""
freesound.py — Freesound-Adapter (Geräusche)
============================================

Sucht für jede Geräuschklasse aus der Curation in Freesound nach
passenden Aufnahmen (nur CC0 und CC-BY) und schreibt pro Klasse ein
Paket-Manifest sowie einen Index nach-klasse.

Authentifizierung
-----------------

Freesound braucht einen API-Key. Auf https://freesound.org einloggen,
unter Profil → API Credentials einen Key erzeugen, dann lokal
ablegen (NIE committen) — eine der folgenden Varianten:

  1. ENV-Variable:
       export FREESOUND_API_KEY=dein_key
       python3 scripts/online_adapters/freesound.py --out audio.manifest

  2. .env-Datei im Repo-Root mit Inhalt:
       FREESOUND_API_KEY=dein_key
     (Die .env steht in .gitignore.)

Aufruf
------

    python3 scripts/online_adapters/freesound.py --out audio.manifest
    python3 scripts/online_adapters/freesound.py --out audio.manifest --only-class cafe
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SCHEMA_VERSION, slugify, write_json, relative_ref  # noqa: E402

SEARCH_URL = "https://freesound.org/apiv2/search/text/"
DEFAULT_CURATION = Path(__file__).resolve().parent / "freesound_curation.json"
USER_AGENT = "ci-sound-balancing/freesound-adapter (https://github.com/mviereck/ci-sound-balancing)"
RATE_LIMIT_S = 0.7
ENV_KEY = "FREESOUND_API_KEY"


def load_env_file(repo_root: Path) -> None:
    """Liest .env im Repo-Root und setzt die Werte als os.environ.
    Minimaler Parser — KEY=VALUE pro Zeile, # ist Kommentar."""
    p = repo_root / ".env"
    if not p.is_file():
        return
    with open(p, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def http_get_json(url: str, token: str) -> dict:
    req = urllib.request.Request(url, headers={
        "User-Agent": USER_AGENT,
        "Authorization": f"Token {token}",
    })
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def license_to_spdx(license_name: str | None) -> str:
    if not license_name:
        return "unknown"
    s = license_name.strip().lower()
    if "creative commons 0" in s or s == "cc0":
        return "CC0-1.0"
    if "attribution noncommercial" in s:
        return "CC-BY-NC-3.0"
    if "attribution" in s:
        # Freesound zeigt meist "Attribution" ohne Version → annehmen 3.0
        return "CC-BY-3.0"
    if "sampling" in s:
        return "CC-Sampling-Plus-1.0"
    return "unknown"


def license_allowed(license_name: str, whitelist: list[str]) -> bool:
    if not license_name:
        return False
    ln = license_name.lower()
    for w in whitelist:
        if w.lower() in ln:
            # darf nicht "noncommercial" enthalten, wenn whitelist "Attribution" ist
            if w.lower() == "attribution" and "noncommercial" in ln:
                return False
            return True
    return False


def build_filter(whitelist: list[str]) -> str:
    parts = [f'license:"{w}"' for w in whitelist]
    return " OR ".join(parts)


def search_class(query: str, license_filter: str, page_size: int, token: str) -> list[dict]:
    fields = ",".join([
        "id", "name", "url", "duration", "previews", "license",
        "username", "tags", "avg_rating", "num_downloads", "channels",
    ])
    params = {
        "query": query,
        "filter": license_filter,
        "fields": fields,
        "page_size": str(page_size),
        "sort": "downloads_desc",
    }
    url = SEARCH_URL + "?" + urllib.parse.urlencode(params)
    data = http_get_json(url, token)
    return data.get("results") or []


def class_to_manifest(class_def: dict, items_raw: list[dict],
                       min_dur: int, max_dur: int) -> dict | None:
    items = []
    for r in items_raw:
        dur_f = r.get("duration") or 0
        try:
            dur = int(round(float(dur_f)))
        except (TypeError, ValueError):
            dur = 0
        if dur < min_dur or dur > max_dur:
            continue
        previews = r.get("previews") or {}
        # bevorzugte Preview: preview-hq-mp3 (192kbps mp3)
        audio_url = (
            previews.get("preview-hq-mp3")
            or previews.get("preview-lq-mp3")
            or previews.get("preview-hq-ogg")
            or previews.get("preview-lq-ogg")
        )
        if not audio_url:
            continue
        lic = r.get("license") or ""
        items.append({
            "id": f"fs-{r.get('id')}",
            "title": (r.get("name") or "").strip(),
            "audio": audio_url,
            "duration": dur,
            "tags": {
                "source_item_id": str(r.get("id")),
                "license": license_to_spdx(lic),
                "license_url": lic,
                "recorder": r.get("username") or None,
                "tags": r.get("tags") or [],
                "url": r.get("url") or "",
            },
        })
    if not items:
        return None

    return {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "geraeusche",
        "title": f"Freesound — {class_def.get('key')}",
        "lang": None,
        "license": "mixed",
        "credit": "Freesound (Lizenz pro Aufnahme im Item)",
        "url": "https://freesound.org",
        "tags": {
            "kind": class_def.get("kind"),
            "stationary": class_def.get("stationary"),
            "loop_safe": class_def.get("loop_safe"),
        },
        "items": items,
    }


def write_source(out_root: Path, dry_run: bool) -> Path:
    src = {
        "schema": SCHEMA_VERSION,
        "key": "freesound",
        "name": "Freesound",
        "url": "https://freesound.org",
        "license": "mixed",
        "credit": "Freesound — gemischte CC0/CC-BY-Lizenzen, pro Item dokumentiert",
        "base": "",
        "categories": ["geraeusche"],
        "manifests": {
            "geraeusche": ["geraeusche/indizes/nach-klasse/"]
        },
        "notes": "Audio-URLs zeigen auf freesound.org-Preview-Streams (mp3).",
    }
    p = out_root / "online" / "freesound" / "source.json"
    write_json(p, src, dry_run)
    return p


def write_class_index(out_root: Path, class_key: str,
                       paket_path: Path, dry_run: bool) -> Path:
    p = out_root / "online" / "freesound" / "geraeusche" / "indizes" / "nach-klasse" / f"{class_key}.json"
    data = {
        "schema": SCHEMA_VERSION,
        "kind": "index",
        "title": f"Freesound — {class_key}",
        "items": [{"ref": relative_ref(p, paket_path)}],
    }
    write_json(p, data, dry_run)
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--curation", type=Path, default=DEFAULT_CURATION)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only-class", default=None)
    args = ap.parse_args()

    # .env aus Repo-Root laden
    repo_root = Path(__file__).resolve().parents[2]
    load_env_file(repo_root)

    token = os.environ.get(ENV_KEY, "").strip()
    if not token:
        print(
            f"Kein {ENV_KEY} gesetzt. Erzeuge einen Freesound-API-Key auf\n"
            "  https://freesound.org → Profil → API Credentials\n"
            f"und setze ihn als ENV-Variable {ENV_KEY} oder in .env.",
            file=sys.stderr,
        )
        return 1

    with open(args.curation, "r", encoding="utf-8") as f:
        curation = json.load(f)

    out_root = args.out.resolve()
    write_source(out_root, args.dry_run)

    classes = curation.get("classes") or []
    if args.only_class:
        classes = [c for c in classes if c.get("key") == args.only_class]
        if not classes:
            print(f"Klasse {args.only_class!r} nicht in Curation.", file=sys.stderr)
            return 2

    items_per_class = int(curation.get("items_per_class", 5))
    min_dur = int(curation.get("min_duration_seconds", 0))
    max_dur = int(curation.get("max_duration_seconds", 10_000))
    whitelist = curation.get("license_whitelist") or ["Creative Commons 0", "Attribution"]
    license_filter = build_filter(whitelist)

    total = 0
    for c in classes:
        ckey = c["key"]
        query = c.get("query") or ckey
        print(f"[{ckey}] suche '{query}'…", flush=True)
        try:
            results = search_class(query, license_filter,
                                    page_size=items_per_class * 3, token=token)
        except Exception as e:
            print(f"[{ckey}] Suche fehlgeschlagen: {e}", file=sys.stderr)
            continue
        time.sleep(RATE_LIMIT_S)

        # Lizenz-Strenge: NC ausschließen
        filtered = [r for r in results
                    if license_allowed(r.get("license") or "", whitelist)]
        # Auf items_per_class begrenzen
        filtered = filtered[:items_per_class]

        manifest = class_to_manifest(c, filtered, min_dur, max_dur)
        if not manifest:
            print(f"[{ckey}] keine gültigen Treffer.", file=sys.stderr)
            continue

        paket_path = out_root / "online" / "freesound" / "geraeusche" / "pakete" / f"{ckey}.json"
        write_json(paket_path, manifest, args.dry_run)
        write_class_index(out_root, ckey, paket_path, args.dry_run)
        total += len(manifest["items"])
        print(f"[{ckey}] {len(manifest['items'])} Aufnahmen geschrieben.", flush=True)

    print(f"Fertig. Aufnahmen gesamt: {total}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
