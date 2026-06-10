# Bauanleitung 201 — ARU-Mirror auf ASCII-saubere Dateinamen

**Versionsbump:** `js/version.js` auf `"3.2.201-beta"`.

**Voraussetzung:** BA 200 ist gebaut (Manifest-Builder mit
Existenz-Check). Sonst läßt sich der erfolgreiche Effekt nicht
verifizieren — der Differenzen-Report meldet sonst nichts.

**Mirror muß lokal schreibbar sein** — diese BA benennt Dateien im
voice-Mirror um. Wenn der Pfad bei dir nicht erreichbar oder nicht
schreibbar ist: alles bis Schritt 3 (Skripte) bauen, Schritt 4
(Lauf) dem Nutzer überlassen.

---

## Ziel

Die ARU-Speech-Corpus-Dateien tragen heute Namen wie

```
ID01_ARU_Fs=65536Hz_Standard speech - List 1 - Sentence 1 - Version 1_0.opus
```

Leerzeichen und `=` widersprechen der Spec-Regel "Pfade in `audio`
lateinisch und ASCII-sicher (URL-tauglich)" und machen auf
Webspace-Servern (Apache, Nginx) regelmäßig Probleme.

Diese BA legt ein eigenständiges Skript an, das

- die Dateien im **opus-Mirror** auf das Schema
  `id01-L01-S01-v1.opus` umbenennt,
- die Sidecar-Datei `sentences_ARU.txt` mit-umbenennt, damit
  `build_manifests.py` beim nächsten Lauf die neuen Namen findet,
- idempotent ist (zweiter Lauf erkennt fertige Form, überspringt).

Zusätzlich wird der ARU-Builder in `build_manifests.py` so erweitert,
daß er sowohl alte als auch neue Namens-Form akzeptiert (sodaß der
Mirror auch in einem Zwischenzustand bleiben kann).

---

## Schritt 1 — Neues Skript `scripts/aru_ascii_rename.py`

Datei neu anlegen:

```python
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
```

---

## Schritt 2 — ARU-Builder anpassen (beide Namens-Formen akzeptieren)

In `scripts/build_manifests.py`, Funktion `build_aru` (ca. Z. 361),
die Zeile

```python
pattern = re.compile(r"^(ID\d+|IEEE|sentences)_ARU_")
```

ersetzen durch zwei Patterns:

```python
pattern_new = re.compile(r"^(id\d+|ieee|sentences)-L(\d+)-S(\d+)-v\d+\.")
pattern_old = re.compile(r"^(ID\d+|IEEE|sentences)_ARU_")
```

Und die Schleife `for fname, text in text_by_file.items():` (ca.
Z. 386-405) so umbauen, daß beide Formen erkannt werden:

```python
for fname, text in text_by_file.items():
    m_new = pattern_new.match(fname)
    m_old = pattern_old.match(fname)
    if m_new:
        speaker_slug = m_new.group(1).lower()   # id01..id12, ieee, sentences
        list_no = int(m_new.group(2))
        sent_no = int(m_new.group(3))
        out_name = fname   # bereits ASCII
    elif m_old:
        speaker_slug = m_old.group(1).lower()
        m2 = re.search(r"List (\d+) - Sentence (\d+)", fname)
        if not m2:
            continue
        list_no = int(m2.group(1))
        sent_no = int(m2.group(2))
        out_name = (fname[:-4] + ".opus"
                    if fname.lower().endswith(".wav") else fname)
    else:
        continue
    by_speaker[speaker_slug].append({
        "id": f"L{list_no:02d}-S{sent_no:02d}",
        "text": text,
        "audio": out_name,
        "tags": {"list_no": list_no, "sentence_no": sent_no},
    })
    n += 1
```

Damit ist der Builder gegen jeden Zwischen-Zustand robust:

- Mirror und Sidecar noch alt → alte Pfade im Manifest
- Mirror und Sidecar bereits umbenannt → neue Pfade im Manifest
- Mischzustand → der Existenz-Check aus BA 200 meldet die Diskrepanz
  im Differenzen-Report

---

## Schritt 3 — Lauf

```bash
# Erst probieren
python3 scripts/aru_ascii_rename.py --dry-run

# Wenn die Vorschau plausibel ist:
python3 scripts/aru_ascii_rename.py

# Manifest-Build mit neuen Namen
python3 scripts/build_manifests.py --only aru-speech-corpus
```

Erwartete Konsolen-Ausgabe:

```
INFO Umbenannt: ~8640 Audiodateien
INFO Sidecar-Ersetzungen: ~8640
INFO aru: ~8640 Saetze, 12 Sprecher
INFO   - 0 fehlende Audio-Dateien (oder: 0 fuer aru im Report)
```

---

## Schritt 4 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.201-beta";
```

---

## Akzeptanztest

1. **Dry-Run-Vorschau**:
   `python3 scripts/aru_ascii_rename.py --dry-run` zeigt Renamings
   wie `DRY rename ID01_ARU_Fs=65536Hz_Standard speech - List 1 - Sentence 1 - Version 1_0.opus -> id01-L01-S01-v1.opus`.
2. **Lauf ohne Fehler**: kein "Ziel existiert schon" pro Datei
   (Warnung) und kein Stack-Trace.
3. **Mirror-Stichprobe**: `ls /mnt/xbox/lauscher/voice/opus/ARU_Speech_Corpus_v1_0/`
   zeigt Dateien wie `id01-L01-S01-v1.opus`, keine Leerzeichen, keine
   `=`.
4. **Sidecar erneuert**: `head /mnt/xbox/lauscher/voice/opus/ARU_Speech_Corpus_v1_0/sentences_ARU.txt`
   beginnt mit `id01-L01-S01-v1.opus: The birch canoe slid…`.
5. **Manifest-Build sauber**: `audio.manifest/aru-speech-corpus/saetze/id01.json`
   hat Items mit `"audio": "id01-L01-S01-v1.opus"`.
6. **Differenzen-Report**: in `audio.manifest/_diff_report.md` keine
   Sektion `### aru-speech-corpus` unter "Fehlende Audio-Dateien".
7. **Idempotenz**: ein zweiter Lauf von `aru_ascii_rename.py` meldet
   `Umbenannt: 0 Audiodateien`, `Sidecar-Ersetzungen: 0`.

## Selbstprüfungs-Auftrag an Sonnet

Für die 7 Akzeptanzpunkte einzeln: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

Wenn der Mirror bei dir nicht erreichbar ist: Punkte 1-2 in einem
**simulierten** Lauf prüfen (Skript lädt, `--help` läuft sauber,
`new_name(...)` an einer Beispiel-Eingabe gibt das erwartete
Ergebnis), Punkte 3-7 dem Nutzer überlassen. Im Bericht klar
trennen.

## Hinweise

- ASCII-Quotes.
- Keine i18n-Änderungen.
- Keine JS-Änderungen außer Versionsbump.
- Nachfolge-BA: BA 202 (MUSAN-Auto-Klassifikation).
