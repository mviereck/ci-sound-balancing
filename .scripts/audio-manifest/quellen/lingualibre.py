"""Lingua-Libre-Adapter (Saetze/Einzelwoerter)."""
from __future__ import annotations
import hashlib
import random
import sys
import time
import urllib.parse
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_manifests as bm
from online_adapters._common import (
    SCHEMA_VERSION, write_json, quelle_stammdaten, http_get_json, http_post_json,
)
import lizenz

SPARQL = "https://lingualibre.org/bigdata/namespace/wdq/sparql"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
SOURCE_KEY = "lingualibre"

DEFAULT_MIN_WORDS = 300
DEFAULT_LIMIT = 10000
TOOL_LANGS = {"de", "en", "fr", "es"}
TOOL_LANG_LIMIT = 20000
SAMPLE_SEED = 20260923

LANG_TAG_OVERRIDE = {
    "Q123270": "en-GB",
}


def _lang_bcp47(qid, iso3):
    if qid in LANG_TAG_OVERRIDE:
        return LANG_TAG_OVERRIDE[qid]
    if iso3 and iso3 not in ("mis", "---"):
        try:
            import pycountry
            L = pycountry.languages.get(alpha_3=iso3)
            if L is not None:
                return getattr(L, "alpha_2", None) or iso3
        except ImportError:
            return iso3
        return iso3
    return "ll-" + qid


def _pick_iso3(codes):
    clean = sorted(c for c in codes if c and c not in ("mis", "---"))
    if clean:
        return clean[0]
    return codes[0] if codes else ""


def _sparql(query):
    body = urllib.parse.urlencode({"query": query, "format": "json"}).encode("utf-8")
    result = http_post_json(SPARQL, body, headers={
        "Accept": "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    return result["results"]["bindings"]


def fetch_language_list(min_words):
    q = """
SELECT ?lang (GROUP_CONCAT(DISTINCT ?iso3;separator="|") AS ?codes) (COUNT(DISTINCT ?word) AS ?wrd) WHERE {
  ?r prop:P4 ?lang . ?r prop:P3 ?file . ?r prop:P7 ?word .
  OPTIONAL { ?lang prop:P13 ?iso3 }
} GROUP BY ?lang ORDER BY DESC(?wrd)
"""
    out = []
    for b in _sparql(q):
        wrd = int(b.get("wrd", {}).get("value", "0"))
        if wrd < min_words:
            continue
        codes = [c for c in b.get("codes", {}).get("value", "").split("|") if c]
        out.append({
            "qid": b.get("lang", {}).get("value", "").rsplit("/", 1)[-1],
            "iso3": _pick_iso3(codes),
            "wrd": wrd,
        })
    return out


def _commons_url(commons_filename):
    fn = commons_filename.replace(" ", "_")
    h = hashlib.md5(fn.encode("utf-8")).hexdigest()
    quoted = urllib.parse.quote(fn)
    return f"https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[0:2]}/{quoted}"


def fetch_records(lang_qid):
    q = f"""
SELECT ?word ?file ?spk ?spkLabel ?genderLabel WHERE {{
  ?r prop:P4 entity:{lang_qid} .
  ?r prop:P7 ?word .
  ?r prop:P3 ?file .
  OPTIONAL {{ ?r prop:P5 ?spk . ?spk rdfs:label ?spkLabel . }}
  OPTIONAL {{ ?r prop:P5 ?s2 . ?s2 prop:P8 ?g . ?g rdfs:label ?genderLabel FILTER(LANG(?genderLabel)="de") }}
}}
"""
    rows = _sparql(q)
    out = []
    for b in rows:
        word = b.get("word", {}).get("value", "").strip()
        file_uri = b.get("file", {}).get("value", "")
        if not word or not file_uri:
            continue
        fname = urllib.parse.unquote(file_uri.split("Special:FilePath/")[-1])
        spk_qid = b.get("spk", {}).get("value", "").rsplit("/", 1)[-1] if b.get("spk") else ""
        out.append({
            "word": word,
            "file": fname,
            "speaker_qid": spk_qid,
            "speaker": b.get("spkLabel", {}).get("value", ""),
            "gender_de": b.get("genderLabel", {}).get("value", ""),
        })
    return out


def fetch_license_for_file(commons_filename):
    params = urllib.parse.urlencode({
        "action": "query",
        "titles": "File:" + commons_filename,
        "prop": "imageinfo",
        "iiprop": "extmetadata",
        "format": "json",
    })
    data = http_get_json(COMMONS_API + "?" + params)
    for _, page in data.get("query", {}).get("pages", {}).items():
        ii = page.get("imageinfo", [{}])
        if not ii:
            continue
        em = ii[0].get("extmetadata", {})
        short = em.get("LicenseShortName", {}).get("value", "")
        attr = str(em.get("AttributionRequired", {}).get("value", "")).lower() == "true"
        return short, attr
    return "", False


LL_LIZENZ_STICHPROBEN = 4


def _lizenz_je_sprecher(dateien):
    """Ermittelt (short, attr) fuer einen Sprecher aus bis zu
    LL_LIZENZ_STICHPROBEN zufaelligen seiner Dateien. Erste Stichprobe mit
    erkennbarer (nicht-leerer, nicht-unknown) Lizenz gewinnt. Liefert
    ("", False), wenn alle Stichproben leer/unknown bleiben."""
    kandidaten = list(dateien)
    random.shuffle(kandidaten)
    for fname in kandidaten[:LL_LIZENZ_STICHPROBEN]:
        try:
            short, attr = fetch_license_for_file(fname)
        except Exception as e:
            print(f"  LL-Lizenzabfrage fehlgeschlagen ({fname}): {e}", file=sys.stderr)
            short, attr = "", False
        time.sleep(0.2)
        if short and lizenz.to_spdx(short) != "unknown":
            return short, attr
    return "", False


def build_collection(records, lang_bcp47, sd):
    speaker_files = {}
    for rec in records:
        speaker_files.setdefault(rec["speaker_qid"], []).append(rec["file"])
    lic_cache = {}
    for spk, dateien in speaker_files.items():
        lic_cache[spk] = _lizenz_je_sprecher(dateien)

    gender_map = {"maennlich": "m", "weiblich": "w", "intersexuell": "i"}

    items = []
    seen_ids = set()
    verworfen_spk = set()
    for rec in sorted(records, key=lambda r: r["word"].lower()):
        dedup_key = rec["speaker_qid"] + "|" + rec["file"]
        if dedup_key in seen_ids:
            continue
        seen_ids.add(dedup_key)
        short, attr = lic_cache.get(rec["speaker_qid"], ("", False))
        spdx = lizenz.to_spdx(short)
        if spdx == "unknown":
            verworfen_spk.add(rec["speaker_qid"])
            continue
        credit = ""
        if attr and rec["speaker"]:
            credit = f"{rec['speaker']} (Lingua Libre, {short})"
        tags = {"style": "pronunciation"}
        if rec["speaker_qid"]:
            tags["speaker_id"] = "ll-" + rec["speaker_qid"]
        if rec["speaker"]:
            tags["speaker_name"] = rec["speaker"]
        g = gender_map.get(rec["gender_de"])
        if g:
            tags["gender"] = g
        item = {
            "id": rec["speaker_qid"] + "-" + hashlib.md5(rec["file"].encode()).hexdigest()[:8],
            "text": rec["word"],
            "audio": _commons_url(rec["file"]),
            "license": spdx,
            "tags": tags,
        }
        if credit:
            item["credit"] = credit
        items.append(item)

    if verworfen_spk:
        print(f"  {lang_bcp47}: {len(verworfen_spk)} Sprecher ohne belegbare Lizenz verworfen.",
              flush=True)

    return {
        "schema": SCHEMA_VERSION,
        "kind": "collection",
        "category": "saetze",
        "title": "Lingua Libre",
        "lang": lang_bcp47,
        "license": sd["license"],
        "credit": sd["credit"],
        "url": sd["url"],
        "items": items,
    }


def _sample_by_words(records, limit):
    words = sorted({r["word"] for r in records})
    if len(words) <= limit:
        return records
    rnd = random.Random(SAMPLE_SEED)
    keep = set(rnd.sample(words, limit))
    return [r for r in records if r["word"] in keep]


def _finalize_source(out_root, dry_run):
    sd = quelle_stammdaten(SOURCE_KEY)
    saetze_dir = out_root / "online" / SOURCE_KEY / "saetze"
    manifests = sorted(
        f"saetze/{p.name}" for p in saetze_dir.glob("*.json")
    ) if saetze_dir.is_dir() else []
    bm.write_source(out_root / "online", SOURCE_KEY, "", ["saetze"],
                    {"saetze": manifests},
                    notes="Audio-URLs zeigen direkt auf upload.wikimedia.org (MD5-Pfad, CORS offen). "
                          "Lizenz pro Sprecher (CC0 oder CC BY-SA 4.0), im Item hinterlegt.",
                    dry_run=dry_run)


def baue(ctx):
    sd = ctx.quelle
    params = sd.get("params") or {}
    min_words = params.get("min_words", DEFAULT_MIN_WORDS)
    limit_default = params.get("limit", DEFAULT_LIMIT)

    out_root = ctx.tmp

    print(f"Sprachliste (>= {min_words} Woerter) abfragen ...", flush=True)
    langs = fetch_language_list(min_words)
    print(f"{len(langs)} Sprachen.", flush=True)

    written = 0
    for i, L in enumerate(langs, 1):
        bcp47 = _lang_bcp47(L["qid"], L["iso3"])
        limit = TOOL_LANG_LIMIT if bcp47 in TOOL_LANGS else limit_default
        print(f"[{i}/{len(langs)}] {bcp47}  (~{L['wrd']} Woerter, Limit {limit})",
              flush=True)
        try:
            print(f"  SPARQL-Abzug fuer {bcp47} ...", flush=True)
            records = fetch_records(L["qid"])
            print(f"    {len(records)} Aufnahmen gelesen.", flush=True)
            if not records:
                print(f"    Keine Aufnahmen — uebersprungen.", file=sys.stderr)
                continue
            kept = _sample_by_words(records, limit)
            collection = build_collection(kept, bcp47, sd)
            print(f"    {len(collection['items'])} Items.", flush=True)
            coll_path = out_root / "online" / SOURCE_KEY / "saetze" / f"{bcp47}.json"
            write_json(coll_path, collection, ctx.dry_run)
            written += 1
        except Exception as e:
            print(f"    FEHLER bei {bcp47}: {e}", file=sys.stderr)

    if written or not ctx.dry_run:
        _finalize_source(out_root, ctx.dry_run)
    print(f"Fertig: {written} Manifest(e) geschrieben.", flush=True)
    return ctx.key if written else None
