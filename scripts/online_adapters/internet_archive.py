#!/usr/bin/env python3
"""
internet_archive.py — Internet-Archive-Musik-Adapter
====================================================

Sucht in archive.org nach Musik-Items mit CC- oder PD-Lizenz, holt
pro Item die Metadaten und schreibt ein Album-Manifest pro Item +
einen Index pro Genre.

Aufruf
------

    python3 scripts/online_adapters/internet_archive.py --out audio.manifest

    # nur ein Genre testen:
    python3 scripts/online_adapters/internet_archive.py \\
        --out audio.manifest --only-genre blues

Ausgabe-Struktur
----------------

    audio.manifest/online/internet-archive/
        source.json
        musik/
            alben/<lang?>-<slug>-<id>.json
            indizes/
                nach-genre/<genre>.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _common import SCHEMA_VERSION, slugify, write_json, relative_ref  # noqa: E402

SEARCH_URL = "https://archive.org/advancedsearch.php"
META_URL = "https://archive.org/metadata/"
DOWNLOAD_BASE = "https://archive.org/download/"
DETAILS_BASE = "https://archive.org/details/"

DEFAULT_CURATION = Path(__file__).resolve().parent / "internet_archive_curation.json"
USER_AGENT = "ci-sound-balancing/ia-adapter (https://github.com/mviereck/ci-sound-balancing)"
RATE_LIMIT_S = 0.6

# Audio-Format-Filter (case-insensitive)
AUDIO_EXTS = {".mp3", ".ogg", ".flac", ".opus", ".m4a", ".wav"}


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def build_search_query(curation: dict, subject: str) -> str:
    cols = curation.get("collections") or []
    col_clause = " OR ".join(f"collection:{c}" for c in cols) or "collection:audio"
    # Lizenz: explizit CC oder PD
    lic_clause = (
        "("
        "licenseurl:*creativecommons.org*"
        " OR licenseurl:*publicdomain*"
        " OR rights:publicdomain"
        " OR licenseurl:*publicdomainmark*"
        ")"
    )
    q = (
        "mediatype:audio"
        f" AND ({col_clause})"
        f" AND subject:\"{subject}\""
        f" AND {lic_clause}"
    )
    return q


def search_items(query: str, rows: int) -> list[dict]:
    params = {
        "q": query,
        "fl[]": "identifier,title,creator,date,licenseurl,subject,downloads,language",
        "sort[]": "downloads desc",
        "rows": str(rows),
        "page": "1",
        "output": "json",
    }
    # urlencode mit fl[]/sort[] erlaubt
    parts = []
    for k, v in params.items():
        if isinstance(v, list):
            for item in v:
                parts.append(f"{k}={urllib.parse.quote(item)}")
        else:
            parts.append(f"{urllib.parse.quote(k)}={urllib.parse.quote(v)}")
    url = SEARCH_URL + "?" + "&".join(parts)
    data = http_get_json(url)
    return ((data.get("response") or {}).get("docs") or [])


def fetch_metadata(identifier: str) -> dict:
    url = META_URL + urllib.parse.quote(identifier)
    return http_get_json(url)


def license_to_spdx(licenseurl: str | None) -> str:
    if not licenseurl:
        return "PD"
    lu = licenseurl.lower()
    # Common patterns
    patterns = [
        ("publicdomain/zero", "CC0-1.0"),
        ("publicdomainmark", "PD"),
        ("publicdomain", "PD"),
        ("by-sa/4.0", "CC-BY-SA-4.0"),
        ("by-sa/3.0", "CC-BY-SA-3.0"),
        ("by-sa/2.5", "CC-BY-SA-2.5"),
        ("by-sa", "CC-BY-SA-3.0"),
        ("by-nd/4.0", "CC-BY-ND-4.0"),
        ("by-nd", "CC-BY-ND-4.0"),
        ("by-nc-sa/4.0", "CC-BY-NC-SA-4.0"),
        ("by-nc-sa", "CC-BY-NC-SA-3.0"),
        ("by-nc/4.0", "CC-BY-NC-4.0"),
        ("by-nc", "CC-BY-NC-3.0"),
        ("by/4.0", "CC-BY-4.0"),
        ("by/3.0", "CC-BY-3.0"),
        ("by/2.5", "CC-BY-2.5"),
        ("by/2.0", "CC-BY-2.0"),
        ("by", "CC-BY-3.0"),
    ]
    for pat, spdx in patterns:
        if pat in lu:
            return spdx
    return "unknown"


def pick_audio_files(meta: dict, prefer: list[str]) -> list[dict]:
    """Aus der Datei-Liste die Audio-Dateien herausziehen, eine pro Track."""
    files = meta.get("files") or []
    # Filter: nur Audio
    audio = []
    for f in files:
        name = f.get("name") or ""
        ext = Path(name).suffix.lower()
        fmt = (f.get("format") or "")
        if ext in AUDIO_EXTS or fmt in prefer:
            audio.append(f)
    if not audio:
        return []

    # Pro Track gibt es oft mehrere Formate. Track-Identifier:
    # bevorzugt 'original'-Flag oder Basis-Name ohne Endung.
    by_track: dict[str, list[dict]] = {}
    for f in audio:
        name = f.get("name") or ""
        track_id = Path(name).stem
        by_track.setdefault(track_id, []).append(f)

    def fmt_rank(f: dict) -> int:
        fmt = f.get("format") or ""
        try:
            return prefer.index(fmt)
        except ValueError:
            return len(prefer) + 1

    chosen: list[dict] = []
    for track_id in sorted(by_track.keys()):
        variants = by_track[track_id]
        # bevorzugt das Format, das im Pref-Vector am weitesten oben steht
        variants.sort(key=fmt_rank)
        chosen.append(variants[0])
    return chosen


def parse_duration(s: str | None) -> int:
    """archive.org liefert Dauer oft als '123.45' oder '01:23' oder '1:23:45'."""
    if not s:
        return 0
    s = str(s).strip()
    try:
        return int(float(s))
    except ValueError:
        pass
    parts = s.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) * 60 + int(parts[1])
        if len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    except ValueError:
        return 0
    return 0


def fetch_item_manifest(identifier: str, genre_key: str, prefer: list[str],
                         min_dur: int, max_dur: int) -> dict | None:
    """Holt Metadaten, wählt eine Audio-Datei pro Track, baut das Manifest."""
    meta = fetch_metadata(identifier)
    m = meta.get("metadata") or {}
    files = pick_audio_files(meta, prefer)
    if not files:
        return None

    items = []
    for i, f in enumerate(files, 1):
        dur = parse_duration(f.get("length"))
        if dur and (dur < min_dur or dur > max_dur):
            # einzelne unpassende Tracks überspringen
            continue
        items.append({
            "id": f"track-{i:02d}",
            "title": (f.get("title") or Path(f.get("name") or "").stem).strip(),
            "audio": DOWNLOAD_BASE + urllib.parse.quote(identifier) + "/" + urllib.parse.quote(f.get("name") or ""),
            "duration": dur or None,
            "tags": {
                "track_no": i,
                "format": f.get("format"),
            },
        })
    if not items:
        return None

    title = (m.get("title") or identifier).strip()
    creator = m.get("creator") or ""
    if isinstance(creator, list):
        creator = ", ".join(str(c) for c in creator)
    licenseurl = m.get("licenseurl") or ""
    spdx = license_to_spdx(licenseurl)
    year = None
    date = m.get("date") or ""
    mm = re.search(r"(\d{4})", str(date))
    if mm:
        year = int(mm.group(1))

    subj = m.get("subject") or []
    if isinstance(subj, str):
        subj = [subj]
    subj_lower = [str(s).lower() for s in subj]

    return {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "musik",
        "title": title,
        "lang": None,
        "license": spdx,
        "credit": f"{creator} — Internet Archive ({identifier})" if creator else f"Internet Archive ({identifier})",
        "url": DETAILS_BASE + identifier,
        "tags": {
            "artist": creator or None,
            "year": year,
            "genres": [genre_key],
            "subjects": subj_lower,
            "vocal": None,
            "source_item_id": identifier,
            "licenseurl": licenseurl or None,
        },
        "items": items,
    }


def write_source(out_root: Path, dry_run: bool) -> Path:
    src = {
        "schema": SCHEMA_VERSION,
        "key": "internet-archive",
        "name": "Internet Archive",
        "url": "https://archive.org",
        "license": "mixed",
        "credit": "Internet Archive — Sammlung mit gemischten CC- und PD-Lizenzen, pro Item dokumentiert",
        "base": "",
        "categories": ["musik"],
        "manifests": {
            "musik": ["musik/indizes/nach-genre/"]
        },
        "notes": "Audio-URLs zeigen direkt auf archive.org. Pro Item gilt die spezifische Lizenz aus dem Item-Manifest.",
    }
    p = out_root / "online" / "internet-archive" / "source.json"
    write_json(p, src, dry_run)
    return p


def write_genre_index(out_root: Path, genre_key: str, label: str,
                      item_files: list[Path], dry_run: bool) -> Path:
    p = out_root / "online" / "internet-archive" / "musik" / "indizes" / "nach-genre" / f"{genre_key}.json"
    items = [{"ref": relative_ref(p, f)} for f in item_files]
    data = {
        "schema": SCHEMA_VERSION,
        "kind": "index",
        "title": f"Internet Archive — {label}",
        "items": items,
    }
    write_json(p, data, dry_run)
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--curation", type=Path, default=DEFAULT_CURATION)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only-genre", default=None)
    ap.add_argument("--fetch-pool", type=int, default=30,
                    help="Wie viele Kandidaten pro Genre roh holen (Default 30).")
    args = ap.parse_args()

    with open(args.curation, "r", encoding="utf-8") as f:
        curation = json.load(f)

    out_root = args.out.resolve()
    write_source(out_root, args.dry_run)

    genres = curation.get("genres") or []
    if args.only_genre:
        genres = [g for g in genres if g.get("key") == args.only_genre]
        if not genres:
            print(f"Genre {args.only_genre!r} nicht in der Curation.", file=sys.stderr)
            return 2

    items_per_genre = int(curation.get("items_per_genre", 10))
    min_dur = int(curation.get("min_duration_seconds", 0))
    max_dur = int(curation.get("max_duration_seconds", 10_000))
    prefer = curation.get("audio_formats_preferred") or []

    total = 0
    for g in genres:
        gkey = g["key"]
        label = g.get("label") or gkey
        subject = g.get("subject") or gkey
        query = build_search_query(curation, subject)
        print(f"[{gkey}] suche '{subject}'…", flush=True)
        try:
            docs = search_items(query, rows=args.fetch_pool)
        except Exception as e:
            print(f"[{gkey}] Suche fehlgeschlagen: {e}", file=sys.stderr)
            continue
        time.sleep(RATE_LIMIT_S)

        item_paths: list[Path] = []
        for d in docs:
            if len(item_paths) >= items_per_genre:
                break
            ident = d.get("identifier")
            if not ident:
                continue
            try:
                manifest = fetch_item_manifest(ident, gkey, prefer, min_dur, max_dur)
            except Exception as e:
                print(f"[{gkey}] Metadaten fehlten für {ident}: {e}", file=sys.stderr)
                continue
            time.sleep(RATE_LIMIT_S)
            if not manifest:
                continue
            filename = f"{slugify(d.get('title') or ident)}-{ident}.json"
            target = out_root / "online" / "internet-archive" / "musik" / "alben" / filename
            write_json(target, manifest, args.dry_run)
            item_paths.append(target)
            total += 1

        write_genre_index(out_root, gkey, label, item_paths, args.dry_run)
        print(f"[{gkey}] {len(item_paths)} Alben geschrieben.", flush=True)

    print(f"Fertig. Alben gesamt: {total}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
