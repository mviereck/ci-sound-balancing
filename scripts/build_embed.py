#!/usr/bin/env python3
"""
build_embed.py — Embed-Module für Offline-Fallback
==================================================

Liest audio.manifest/<source>/saetze/*.json, holt pro Sprache eine
kleine Auswahl, kodiert das Audio als data-URL und schreibt pro
Sprache ein JS-Modul nach assets/sentences/embed/<lang>.js.

Das Embed-Format ist mit dem neuen Manifest-Schema verträglich —
der Player kann Embed- und Online-Collections gleich behandeln.

Aufruf
------

    # Default: nimmt voice/opus/ als Audio-Wurzel
    python3 scripts/build_embed.py

    # andere Wurzeln / Auswahl
    python3 scripts/build_embed.py \\
        --mirror-root /mnt/xbox/lauscher/voice/opus \\
        --manifests-root audio.manifest \\
        --out assets/sentences/embed \\
        --langs de en fr es \\
        --items-per-collection 3

Wie eingebunden
---------------

Das Tool lädt assets/sentences/embed/<lang>.js per <script>-Tag
on-demand, wenn der Online-Manifest-Fetch fehlschlägt (file://-Mode
oder Server unerreichbar). Es füllt window.CI_SB_EMBED.sources mit
Collection-Objekten, die dem Online-Schema entsprechen.
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import sys
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ci-sb-corpus/2"

DEFAULT_MIRROR = Path("/mnt/xbox/lauscher/voice/opus")
DEFAULT_MANIFESTS = Path(__file__).resolve().parents[1] / "audio.manifest"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "assets/sentences/embed"

MIME_BY_SUFFIX = {
    ".opus": "audio/opus",
    ".ogg":  "audio/ogg",
    ".mp3":  "audio/mpeg",
    ".wav":  "audio/wav",
    ".m4a":  "audio/mp4",
    ".flac": "audio/flac",
}

# Priorität pro Sätze-Stil — bestimmt, welche Sammlungen pro Sprache
# bevorzugt im Embed landen. Niedrigere Zahl = höhere Priorität.
STYLE_PRIORITY = {
    "studio": 0,         # Thorsten
    "crowdsourced": 1,   # Common Voice
    "test": 2,           # Freiburger, OLSA, ARU
    "dialect": 3,        # Thorsten-Hessisch
    "emotional": 4,      # Thorsten-Emotional
}
DEFAULT_STYLE_PRIORITY = 5

log = logging.getLogger("build_embed")


def file_to_data_url(path: Path) -> str | None:
    """Liest path und liefert data:-URL. Fällt zurück auf .wav, falls
    das Skript gegen voice/ läuft, der Mirror aber noch nicht alle
    .opus-Dateien geschrieben hat."""
    real_path = path
    if not real_path.is_file():
        if path.suffix.lower() == ".opus":
            alt = path.with_suffix(".wav")
            if alt.is_file():
                real_path = alt
            else:
                return None
        else:
            return None
    mime = MIME_BY_SUFFIX.get(real_path.suffix.lower(), "audio/octet-stream")
    data = real_path.read_bytes()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def collection_priority(coll: dict) -> tuple[int, str]:
    """Sortier-Schlüssel für Collections — niedriger = besser."""
    tags = coll.get("tags") or {}
    style = tags.get("style")
    # Sätze aus Hörbüchern (MLS) sehr niedrig priorisieren — viele Bücher
    if tags.get("origin") == "librivox-via-mls":
        return (10, coll.get("title", ""))
    return (STYLE_PRIORITY.get(style, DEFAULT_STYLE_PRIORITY),
            coll.get("title", ""))


def read_source(source_json: Path) -> dict | None:
    if not source_json.is_file():
        return None
    try:
        with open(source_json, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        log.warning("source.json defekt: %s (%s)", source_json, e)
        return None


def gather_collections(manifests_root: Path, langs: list[str] | None) -> dict[str, list[tuple[dict, Path, str]]]:
    """Liefert {lang: [(collection_dict, manifest_path, source_base)]}."""
    out: dict[str, list[tuple[dict, Path, str]]] = {}
    for src_dir in sorted(manifests_root.iterdir()):
        if not src_dir.is_dir():
            continue
        source = read_source(src_dir / "source.json")
        if not source:
            continue
        base = source.get("base", "")
        saetze_dir = src_dir / "saetze"
        if not saetze_dir.is_dir():
            continue
        for m in sorted(saetze_dir.glob("*.json")):
            try:
                with open(m, "r", encoding="utf-8") as f:
                    coll = json.load(f)
            except (OSError, json.JSONDecodeError):
                continue
            lang = coll.get("lang")
            if not lang:
                continue
            if langs and lang not in langs:
                continue
            out.setdefault(lang, []).append((coll, m, base))
    return out


def trim_collection(coll: dict, n: int, mirror_root: Path, source_base: str) -> dict | None:
    """Kürzt coll auf max n Items und ersetzt audio durch data:URLs.
    None wenn keine Audio-Datei einbettbar war."""
    items_in = coll.get("items") or []
    items_out: list[dict] = []
    for it in items_in:
        if len(items_out) >= n:
            break
        rel = it.get("audio") or ""
        if not rel or rel.startswith(("http://", "https://", "data:")):
            continue
        full = mirror_root / source_base / rel
        url = file_to_data_url(full)
        if not url:
            continue
        items_out.append({
            "id": it.get("id"),
            "text": it.get("text", ""),
            "audio": url,
            **({"duration": it["duration"]} if "duration" in it else {}),
        })
    if not items_out:
        return None
    out = dict(coll)
    out["items"] = items_out
    out["embed"] = True
    return out


def render_js(lang: str, collections: list[dict]) -> str:
    payload = {
        "lang": lang,
        "schema": SCHEMA_VERSION,
        "sources": {},
    }
    for coll in collections:
        key_base = coll.get("title", "x").lower()
        key = "".join(ch if ch.isalnum() else "-" for ch in key_base).strip("-") or "x"
        suffix = f"-{lang}-embed"
        key = (key[: 40 - len(suffix)] + suffix)
        payload["sources"][key] = coll
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    return (
        "// generated by scripts/build_embed.py — do not edit\n"
        "(function() {\n"
        "  window.CI_SB_EMBED = window.CI_SB_EMBED || { sources: {} };\n"
        f"  var payload = {body};\n"
        "  for (var k in payload.sources) {\n"
        "    window.CI_SB_EMBED.sources[k] = payload.sources[k];\n"
        "  }\n"
        "})();\n"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                  formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--mirror-root", type=Path, default=DEFAULT_MIRROR,
                    help=f"Wurzel der Audio-Dateien (Default: {DEFAULT_MIRROR})")
    ap.add_argument("--manifests-root", type=Path, default=DEFAULT_MANIFESTS,
                    help=f"Wurzel der Sätze-Manifeste (Default: {DEFAULT_MANIFESTS})")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT,
                    help=f"Ausgabe-Verzeichnis (Default: {DEFAULT_OUT})")
    ap.add_argument("--langs", nargs="*", default=None,
                    help="Sprach-Codes, die exportiert werden sollen. Default: alle gefundenen.")
    ap.add_argument("--items-per-collection", type=int, default=3,
                    help="Max. Items pro Sammlung im Embed (Default 3).")
    ap.add_argument("--max-sources-per-lang", type=int, default=3,
                    help="Max. Sammlungen pro Sprache (Default 3 — vermeidet "
                         "aufgeblähte Embeds wenn z. B. viele MLS-Bücher dieselbe "
                         "Sprache tragen).")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    manifests_root = args.manifests_root.resolve()
    mirror_root = args.mirror_root.resolve()
    out_root = args.out.resolve()
    if not manifests_root.is_dir():
        log.error("Manifeste fehlen: %s", manifests_root)
        return 1
    if not mirror_root.is_dir():
        log.error("Mirror fehlt: %s", mirror_root)
        return 1

    grouped = gather_collections(manifests_root, args.langs)
    if not grouped:
        log.error("Keine Sätze-Manifeste gefunden.")
        return 1

    total_sources = 0
    total_items = 0
    for lang in sorted(grouped.keys()):
        # Sortiere nach Priorität: Studio vor Crowdsourced vor Test usw.
        sorted_in_lang = sorted(grouped[lang],
                                key=lambda triple: collection_priority(triple[0]))
        keep: list[dict] = []
        for coll, mf, base in sorted_in_lang:
            if len(keep) >= args.max_sources_per_lang:
                break
            trimmed = trim_collection(coll, args.items_per_collection,
                                       mirror_root, base)
            if trimmed:
                keep.append(trimmed)
                total_items += len(trimmed["items"])
        if not keep:
            log.info("[%s] keine einbettbaren Items.", lang)
            continue
        js = render_js(lang, keep)
        size_kb = len(js.encode("utf-8")) / 1024
        target = out_root / f"{lang}.js"
        if args.dry_run:
            log.info("DRY [%s] %d sources, %.1f kB -> %s",
                     lang, len(keep), size_kb, target)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(js, encoding="utf-8")
        log.info("[%s] %d sources, %.1f kB geschrieben.", lang, len(keep), size_kb)
        total_sources += len(keep)

    log.info("Fertig. %d Sprachen, %d Sources, %d Items.",
             len(grouped), total_sources, total_items)
    return 0


if __name__ == "__main__":
    sys.exit(main())
