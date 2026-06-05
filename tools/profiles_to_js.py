#!/usr/bin/env python3
"""
Generator: erzeugt js/richtone-profiles.js aus docs/richtone_profiles.json.

Lauf:    python3 tools/profiles_to_js.py
Ausgabe: js/richtone-profiles.js

Bei Aenderungen am JSON dieses Skript erneut laufen lassen.
"""
import json
import sys
from pathlib import Path
from datetime import datetime, timezone

ROOT     = Path(__file__).resolve().parent.parent
JSON_IN  = ROOT / "docs" / "richtone_profiles.json"
JS_OUT   = ROOT / "js" / "richtone-profiles.js"

INSTRUMENTS = [
    "Acc", "ASax", "Bn", "BTb", "Cb", "ClBb", "Fl",
    "Hn", "Ob", "Tbn", "TpC", "Va", "Vc", "Vn",
]


def main():
    if not JSON_IN.exists():
        print(f"FEHLER: {JSON_IN} nicht gefunden", file=sys.stderr)
        sys.exit(1)
    data = json.loads(JSON_IN.read_text(encoding="utf-8"))
    profiles_src = data.get("profiles", {})
    if not profiles_src:
        print("FEHLER: keine Profile in JSON", file=sys.stderr)
        sys.exit(1)

    # Auf relevante Felder reduzieren (samples-Pfad fliegt raus, nur
    # Synth-Parameter bleiben fuer das Tool).
    out_profiles = {}
    for abbr in INSTRUMENTS:
        if abbr not in profiles_src:
            print(f"WARN: {abbr} fehlt in JSON, ueberspringe", file=sys.stderr)
            continue
        p = profiles_src[abbr]
        out_profiles[abbr] = {
            "abbr":         abbr,
            "label":        p.get("label", abbr),
            "partials":     p.get("partials", [{"mult": 1, "amp": 1.0}]),
            "vibratoHz":    float(p.get("vibratoHz", 0)),
            "vibratoCents": float(p.get("vibratoCents", 0)),
            "amHz":         float(p.get("amHz", 0)),
            "amDepth":      float(p.get("amDepth", 0)),
            "attackMs":     float(p.get("attackMs", 50)),
        }

    body = json.dumps(out_profiles, indent=2, ensure_ascii=False)
    ts = datetime.now(timezone.utc).isoformat()
    content = (
        "// Auto-generiert von tools/profiles_to_js.py\n"
        f"// Quelle: docs/richtone_profiles.json (Lauf {ts})\n"
        "// Nicht von Hand editieren - bei Aenderungen am JSON Skript erneut laufen lassen.\n"
        "//\n"
        "// Wird in index.html vor js/audio.js geladen; globale Konstante\n"
        "// RICHTONE_PROFILES steht audio.js (playRichToneProfile) zur Verfuegung.\n"
        f"const RICHTONE_PROFILES = {body};\n"
    )
    JS_OUT.write_text(content, encoding="utf-8")
    print(f"OK: {len(out_profiles)} Profile -> {JS_OUT}")


if __name__ == "__main__":
    main()
