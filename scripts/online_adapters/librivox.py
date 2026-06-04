#!/usr/bin/env python3
"""
librivox.py — LibriVox-Adapter
==============================

Fragt die LibriVox-API ab, wählt pro Sprache eine Auswahl von Büchern
aus, schreibt pro Buch ein Manifest und je Sprache einen Index nach
audio.manifest/online/librivox/.

Aufruf
------

    # mit Default-Curation aus librivox_curation.json
    python3 scripts/online_adapters/librivox.py \\
        --out audio.manifest

    # nur eine Sprache, gut zum Testen
    python3 scripts/online_adapters/librivox.py \\
        --out audio.manifest --only-lang de

    # Trockenlauf — schreibt nichts
    python3 scripts/online_adapters/librivox.py \\
        --out audio.manifest --dry-run

Ausgabe-Struktur
----------------

    audio.manifest/online/librivox/
        source.json
        hoerbuecher/
            buecher/
                de-marchen-100.json
                en-moby-dick-...json
                ...
            indizes/
                nach-sprache/
                    de.json
                    en.json
                    ...

Hinweise
--------

- Die LibriVox-API liefert nicht zuverlässig Genre oder Reader-Geschlecht.
  Diese Felder bleiben hier null und werden in einer späteren Stufe
  manuell ergänzt.
- Audio-URLs zeigen direkt auf archive.org (LibriVox-Audio liegt dort).
  Diese URLs sind CORS-offen und im Player ohne Proxy abspielbar.
- Idempotent: vorhandene Buch-Manifeste werden überschrieben (das
  Buch könnte ergänzte Kapitel haben). Manuell ergänzte Tags an den
  Manifesten gehen dabei verloren — falls dort schon Werte stehen,
  würden sie überschrieben. Soll das später anders sein, lässt sich
  in `merge_existing_manifest()` ein Merge-Pfad einbauen.
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

API_BOOKS = "https://librivox.org/api/feed/audiobooks/"
API_TRACKS = "https://librivox.org/api/feed/audiotracks/"
DEFAULT_CURATION = Path(__file__).resolve().parent / "librivox_curation.json"
USER_AGENT = "ci-sound-balancing/librivox-adapter (https://github.com/mviereck/ci-sound-balancing)"
RATE_LIMIT_S = 0.6


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def fetch_books_for_language(api_name: str, limit: int = 100) -> list[dict]:
    """Holt bis zu `limit` Bücher der Sprache. Ein einziger API-Call
    mit sections=1 liefert auch die Kapitel-URLs gleich mit."""
    url = API_BOOKS + "?" + urllib.parse.urlencode({
        "format": "json",
        "language": api_name,
        "limit": str(limit),
    })
    data = http_get_json(url)
    return data.get("books", []) or []


def parse_int(v: Any, default: int | None = None) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def book_total_minutes(book: dict) -> int:
    secs = parse_int(book.get("totaltimesecs"), 0) or 0
    return secs // 60


def is_solo_reader(book: dict) -> bool:
    """Heuristik: Solo-Reader an einer Kapitel-Stichprobe ablesen.
    LibriVox bietet kein Solo-Flag — wir prüfen, ob in den ersten 5
    Kapiteln immer derselbe Reader steht."""
    sections = book.get("sections") or []
    readers = set()
    for s in sections[:5]:
        for r in s.get("readers") or []:
            display = r.get("display_name") or r.get("readerid")
            if display:
                readers.add(display)
    return len(readers) == 1


def primary_reader(book: dict) -> str | None:
    sections = book.get("sections") or []
    if not sections:
        return None
    for s in sections:
        for r in s.get("readers") or []:
            display = r.get("display_name") or r.get("readerid")
            if display:
                return display
    return None


def authors_string(book: dict) -> str:
    out = []
    for a in book.get("authors") or []:
        first = (a.get("first_name") or "").strip()
        last = (a.get("last_name") or "").strip()
        full = (first + " " + last).strip()
        if full:
            out.append(full)
    return ", ".join(out)


def manifest_filename(book: dict, lang_code: str) -> str:
    title = book.get("title") or ""
    return f"{lang_code}-{slugify(title)}-{book.get('id')}.json"


def book_to_manifest(book: dict, lang_code: str) -> dict:
    sections = book.get("sections") or []
    items = []
    for i, s in enumerate(sections, 1):
        section_num = parse_int(s.get("section_number"), i) or i
        play = parse_int(s.get("playtime"), 0) or 0
        item: dict[str, Any] = {
            "id": f"ch{section_num:03d}",
            "title": (s.get("title") or "").strip(),
            "audio": s.get("listen_url") or "",
            "duration": play,
        }
        # Per-Item Reader, falls verfügbar
        readers = s.get("readers") or []
        if readers:
            names = [(r.get("display_name") or "").strip() for r in readers]
            names = [n for n in names if n]
            if names:
                item["tags"] = {"reader": names[0] if len(names) == 1 else names}
        items.append(item)

    reader_main = primary_reader(book)
    solo = is_solo_reader(book)
    return {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "hoerbuecher",
        "title": (book.get("title") or "").strip(),
        "lang": lang_code,
        "license": "PD",
        "credit": f"Public Domain — LibriVox project {book.get('id')}",
        "url": book.get("url_librivox") or "",
        "tags": {
            "reader": reader_main,
            "reader_gender": None,
            "reader_mode": "solo" if solo else "mixed",
            "work_author": authors_string(book),
            "genres": [],
            "book_year_published": parse_int(book.get("copyright_year")),
            "total_seconds": parse_int(book.get("totaltimesecs"), 0),
            "source_item_id": str(book.get("id") or ""),
            "url_iarchive": book.get("url_iarchive") or "",
        },
        "items": items,
    }


def select_books(books: list[dict], curation: dict) -> list[dict]:
    n_target = int(curation.get("books_per_language", 15))
    minmin = int(curation.get("min_total_minutes", 0))
    maxmin = int(curation.get("max_total_minutes", 10_000))
    prefer_solo = bool(curation.get("prefer_solo_reader", True))

    eligible = []
    for b in books:
        mins = book_total_minutes(b)
        if mins < minmin or mins > maxmin:
            continue
        sections = b.get("sections") or []
        if not sections:
            continue
        # mindestens ein abspielbares Kapitel
        if not any(s.get("listen_url") for s in sections):
            continue
        eligible.append(b)

    if prefer_solo:
        solo = [b for b in eligible if is_solo_reader(b)]
        nonsolo = [b for b in eligible if b not in solo]
        ordered = solo + nonsolo
    else:
        ordered = eligible

    # Reader-Diversität: keine Häufung desselben Sprechers
    chosen: list[dict] = []
    seen_readers: set[str] = set()
    for b in ordered:
        if len(chosen) >= n_target:
            break
        r = primary_reader(b)
        if r and r in seen_readers and len(chosen) >= n_target // 2:
            continue
        chosen.append(b)
        if r:
            seen_readers.add(r)
    # Wenn noch nicht voll, übrige auffüllen
    if len(chosen) < n_target:
        for b in ordered:
            if b in chosen:
                continue
            chosen.append(b)
            if len(chosen) >= n_target:
                break
    return chosen


def write_source(out_root: Path, dry_run: bool) -> Path:
    src = {
        "schema": SCHEMA_VERSION,
        "key": "librivox",
        "name": "LibriVox",
        "url": "https://librivox.org",
        "license": "PD",
        "credit": "LibriVox — Public-Domain-Hörbücher, Audio gespiegelt auf archive.org",
        "base": "",
        "categories": ["hoerbuecher"],
        "manifests": {
            "hoerbuecher": ["hoerbuecher/indizes/nach-sprache/"]
        },
        "notes": "Audio-URLs zeigen direkt auf archive.org (CORS-offen).",
    }
    p = out_root / "online" / "librivox" / "source.json"
    write_json(p, src, dry_run)
    return p


def write_lang_index(out_root: Path, lang_code: str,
                     book_files: list[Path], dry_run: bool) -> Path:
    p = out_root / "online" / "librivox" / "hoerbuecher" / "indizes" / "nach-sprache" / f"{lang_code}.json"
    items = []
    for bf in book_files:
        items.append({"ref": relative_ref(p, bf)})
    data = {
        "schema": SCHEMA_VERSION,
        "kind": "index",
        "title": f"LibriVox — {lang_code}",
        "items": items,
    }
    write_json(p, data, dry_run)
    return p


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--curation", type=Path, default=DEFAULT_CURATION,
                    help=f"Curation-JSON (Default: {DEFAULT_CURATION})")
    ap.add_argument("--out", type=Path, required=True,
                    help="Wurzel des audio.manifest-Baums (wird angelegt)")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only-lang", default=None,
                    help="Nur diesen Sprach-Code verarbeiten (Test).")
    ap.add_argument("--fetch-limit", type=int, default=200,
                    help="API-limit pro Sprache (Default 200).")
    args = ap.parse_args()

    with open(args.curation, "r", encoding="utf-8") as f:
        curation = json.load(f)

    out_root = args.out.resolve()
    write_source(out_root, args.dry_run)

    langs = curation.get("languages") or []
    if args.only_lang:
        langs = [l for l in langs if l.get("code") == args.only_lang]
        if not langs:
            print(f"Sprache {args.only_lang!r} nicht in der Curation.", file=sys.stderr)
            return 2

    total_books = 0
    for entry in langs:
        code = entry["code"]
        api_name = entry["api_name"]
        print(f"[{code}] hole bis zu {args.fetch_limit} Bücher von LibriVox ({api_name})…",
              flush=True)
        try:
            books = fetch_books_for_language(api_name, limit=args.fetch_limit)
        except Exception as e:
            print(f"[{code}] API-Fehler: {e}", file=sys.stderr)
            continue
        time.sleep(RATE_LIMIT_S)

        selected = select_books(books, curation)
        print(f"[{code}] {len(books)} kandidaten, {len(selected)} ausgewählt.",
              flush=True)

        book_paths: list[Path] = []
        for b in selected:
            manifest = book_to_manifest(b, code)
            filename = manifest_filename(b, code)
            target = out_root / "online" / "librivox" / "hoerbuecher" / "buecher" / filename
            write_json(target, manifest, args.dry_run)
            book_paths.append(target)
            total_books += 1

        write_lang_index(out_root, code, book_paths, args.dry_run)

    print(f"Fertig. Bücher geschrieben: {total_books}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
