"""
Gemeinsame Helfer für die Online-Quellen-Adapter.

Jeder Adapter (LibriVox, Internet Archive, Freesound, …) erzeugt
Manifest-Dateien nach dem Schema aus docs/Konzept_Audio_Manifest.md.
Damit Pfad-, Slug- und Schreiblogik nicht in jedem Skript dupliziert
wird, liegen sie hier.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

SCHEMA_VERSION = "ci-sb-corpus/2"

# Lateinische ASCII-Translit-Tabelle. Bewusst keine vollständige
# Unicode-Normalisierung — ein Slug aus dem Buchtitel soll erkennbar
# und kurz bleiben.
_TRANSLIT = str.maketrans({
    "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
    "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
    "á": "a", "à": "a", "â": "a", "ã": "a", "å": "a",
    "é": "e", "è": "e", "ê": "e", "ë": "e",
    "í": "i", "ì": "i", "î": "i", "ï": "i",
    "ó": "o", "ò": "o", "ô": "o", "õ": "o",
    "ú": "u", "ù": "u", "û": "u",
    "ñ": "n", "ç": "c", "ý": "y",
    "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
})


def slugify(text: str, max_len: int = 50) -> str:
    """Erzeugt einen URL-sicheren ASCII-Slug aus Klartext."""
    if not text:
        return "x"
    # Translit (Map kann nur Single-Char-Mapping; Multi-Char-Werte hier)
    out = []
    for ch in text:
        if ch in "äöüßÄÖÜ":
            out.append({
                "ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
                "Ä": "Ae", "Ö": "Oe", "Ü": "Ue",
            }[ch])
        else:
            out.append(ch)
    text = "".join(out)
    text = text.translate(_TRANSLIT)
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(text) > max_len:
        text = text[:max_len].rstrip("-")
    return text or "x"


def write_json(path: Path, data: Any, dry_run: bool = False) -> None:
    """Schreibt JSON nach path (mit Verzeichnis-Anlage)."""
    if dry_run:
        print(f"DRY write {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def read_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def relative_ref(from_file: Path, to_file: Path) -> str:
    """Pfad zu to_file, ausgedrückt relativ zum Verzeichnis von from_file.
    Für Pointer-Indizes ('ref' in indizes/...)."""
    from_dir = from_file.parent.resolve()
    to_file = to_file.resolve()
    try:
        return str(to_file.relative_to(from_dir))
    except ValueError:
        # Auf gemeinsame Wurzel zurückfallen
        from_parts = from_dir.parts
        to_parts = to_file.parts
        common = 0
        while (common < len(from_parts) and common < len(to_parts)
               and from_parts[common] == to_parts[common]):
            common += 1
        ups = [".."] * (len(from_parts) - common)
        return "/".join(ups + list(to_parts[common:]))
