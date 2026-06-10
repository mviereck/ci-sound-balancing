# Bauanleitung 200 — build_manifests.py grundsanieren

**Versionsbump:** `js/version.js` von `"3.2.199-beta"` auf
`"3.2.200-beta"`. Auch wenn diese BA keinen JS-Code anfaßt: der
Browser lädt `audio.manifest/`-JSONs zur Laufzeit. Der Versionsbump
ist hier das einfachste Cache-Buster-Signal an den Nutzer („alles
neu, hartes Refresh").

**Voraussetzung:** BA 199 ist gebaut (Loader vererbt
`lang`/`license`/`credit`/`url`). Sonst zeigt der Browser nach
Mirror-Neuerzeugung die korrigierten Tags trotzdem nicht.

**Mirror muß lokal erreichbar sein:** Standardpfad
`/mnt/xbox/lauscher/voice/opus`. Wenn der Pfad bei dir nicht
erreichbar ist, melde das **vor dem Bauen** an den Nutzer —
der Voll-Lauf in Schritt 8 muß dann bei ihm ablaufen.

---

## Ziel

`scripts/build_manifests.py` so erweitern, daß die generierten
Manifeste

1. die tatsächlich im Mirror liegenden Audio-Endungen pro Quelle
   verläßlich treffen (nicht raten),
2. pro Item prüfen, ob die Audiodatei tatsächlich existiert, und
   Fehler in einem Differenzen-Report melden,
3. pro Item ein `duration`-Feld in Sekunden tragen, das nach dem
   ersten teuren Lauf aus einem persistenten Cache kommt,
4. den `thorsten-voice-emotional`-Bug beheben — heute schreibt der
   Builder dort `manifests.saetze: []`, weil er auf `.wav` filtert,
   während der Mirror `.opus` enthält.

Online-Quellen, ARU-Rename und MUSAN-Klassifikation sind **nicht**
Teil dieser BA (BAs 201, 202).

---

## Schritt 1 — Endungs-Tabelle und Diff-Sammler

In `scripts/build_manifests.py`, direkt unter den bestehenden
Konstanten (unter `DEFAULT_OUT = …`, ca. Z. 49), folgenden Block
einfügen:

```python
# Pro Source-Key die Audio-Endung, die im Mirror tatsaechlich liegt.
# Identisch zu den voice_to_opus-Regeln:
#   - .opus fuer konvertierte WAV-Aufnahmen
#   - .wav  fuer Test-Standards (Freiburger, OLSA, test-noise) und
#           MUSAN-noise
#   - .mp3  fuer Common Voice (unveraendert)
EXT_BY_SOURCE = {
    "thorsten-voice":            ".opus",
    "thorsten-voice-emotional":  ".opus",
    "thorsten-voice-hessisch":   ".opus",
    "aru-speech-corpus":         ".opus",
    "freiburger":                ".wav",
    "oldenburger-olsa":          ".wav",
    "mls-french":                ".opus",
    "mls-spanish":               ".opus",
    "mls-polish":                ".opus",
    "common-voice":              ".mp3",
    "test-noise":                ".wav",
    # musan ist gemischt - wird im MUSAN-Builder pro Sub-Quelle entschieden
}

# Globaler Sammler fuer den Differenzen-Report.
_BUILD_DIFFS = {
    "missing_audio": [],   # im Manifest referenziert, im Mirror nicht da
    "orphan_audio":  [],   # im Mirror vorhanden, in keinem Manifest
}

# Pro Source-Key gesammelte Audio-Pfade (relativ zur source.base),
# damit am Schluss verwaiste Mirror-Dateien gefunden werden koennen.
_BUILD_AUDIO_PATHS = {}      # source_key -> set[str]
_BUILD_SOURCE_BASES = {}     # source_key -> "Thorsten Voice/"
```

---

## Schritt 2 — Hilfsfunktionen für Check und Report

Im UTILITIES-Block (etwa nach `write_json`, ca. Z. 64) folgende
Hilfsfunktionen einfügen:

```python
def audio_in_mirror(mirror_root: Path, source_base: str, rel: str) -> Path:
    """Lokaler Pfad einer Audiodatei im Mirror."""
    return mirror_root / source_base.rstrip("/") / rel


def verify_manifest_audio(manifest: dict, mirror_root: Path,
                          source_base: str, source_key: str) -> None:
    """Prueft pro Item, ob die referenzierte Audiodatei im Mirror
    existiert. Fehlende landen in _BUILD_DIFFS['missing_audio']."""
    for it in manifest.get("items", []):
        rel = it.get("audio")
        if not rel or rel.startswith(("http://", "https://", "data:")):
            continue
        p = audio_in_mirror(mirror_root, source_base, rel)
        if not p.is_file():
            _BUILD_DIFFS["missing_audio"].append({
                "source":   source_key,
                "manifest": manifest.get("title", "?"),
                "item":     it.get("id", "?"),
                "expected": str(p),
            })


def collect_audio_paths(manifest: dict) -> set[str]:
    out = set()
    for it in manifest.get("items", []):
        a = it.get("audio")
        if a and not a.startswith(("http://", "https://", "data:")):
            out.add(a)
    return out


def remember_paths(source_key: str, manifest: dict) -> None:
    s = _BUILD_AUDIO_PATHS.setdefault(source_key, set())
    s.update(collect_audio_paths(manifest))


def scan_orphans(mirror_root: Path, source_base: str,
                 source_key: str, manifested_paths: set[str]) -> None:
    """Sucht Audiodateien im Mirror, die in keinem Manifest stehen."""
    src_root = mirror_root / source_base.rstrip("/")
    if not src_root.is_dir():
        return
    audio_exts = {".opus", ".wav", ".mp3", ".flac", ".ogg"}
    for p in src_root.rglob("*"):
        if not p.is_file():
            continue
        if p.suffix.lower() not in audio_exts:
            continue
        rel = str(p.relative_to(src_root))
        if rel not in manifested_paths:
            _BUILD_DIFFS["orphan_audio"].append({
                "source": source_key,
                "path":   str(p),
            })


def write_diff_report(path: Path, diffs: dict, dry_run: bool) -> None:
    from collections import defaultdict
    lines = [
        "# Audio-Manifest-Differenzen-Report",
        "",
        "Erzeugt von `scripts/build_manifests.py` am Ende eines Voll-Laufs.",
        "",
        "## Fehlende Audio-Dateien",
        "",
        f"Manifeste referenzieren {len(diffs['missing_audio'])} Items, "
        "die im Mirror nicht vorliegen. Pro Quelle die ersten 30:",
        "",
    ]
    by_src = defaultdict(list)
    for d in diffs["missing_audio"]:
        by_src[d["source"]].append(d)
    for src in sorted(by_src):
        lines.append(f"### {src} ({len(by_src[src])} fehlend)")
        lines.append("")
        for d in by_src[src][:30]:
            lines.append(f"- `{d['manifest']}` / `{d['item']}` -> `{d['expected']}`")
        if len(by_src[src]) > 30:
            lines.append(f"- ... und {len(by_src[src]) - 30} weitere")
        lines.append("")

    lines.append("## Verwaiste Audio-Dateien")
    lines.append("")
    lines.append(
        f"Im Mirror liegen {len(diffs['orphan_audio'])} Audiodateien, "
        "auf die kein Manifest verweist. Pro Quelle die ersten 30:")
    lines.append("")
    by_src = defaultdict(list)
    for d in diffs["orphan_audio"]:
        by_src[d["source"]].append(d)
    for src in sorted(by_src):
        lines.append(f"### {src} ({len(by_src[src])} verwaist)")
        lines.append("")
        for d in by_src[src][:30]:
            lines.append(f"- `{d['path']}`")
        if len(by_src[src]) > 30:
            lines.append(f"- ... und {len(by_src[src]) - 30} weitere")
        lines.append("")

    if dry_run:
        log.info("DRY write %s", path)
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines), encoding="utf-8")
```

In `write_source(...)` direkt zu Beginn der Funktion (vor dem
`src = { ... }`-Dict) eine Zeile einfügen, damit der Bases-Lookup
für `scan_orphans` gefüllt wird:

```python
_BUILD_SOURCE_BASES[key] = base
```

---

## Schritt 3 — Dauer mit persistentem Cache

Imports erweitern (oben in der Datei):

```python
import shutil
import subprocess
```

Im UTILITIES-Block:

```python
DURATION_CACHE_PATH = (Path(__file__).resolve().parent /
                       ".cache" / "duration_cache.json")
_DURATION_CACHE: dict[str, float] = {}
_DURATION_CACHE_LOADED = False
_DURATION_CACHE_DIRTY = False


def _duration_cache_key(p: Path) -> str:
    try:
        st = p.stat()
        return f"{p}|{st.st_size}|{int(st.st_mtime)}"
    except OSError:
        return f"{p}|?"


def load_duration_cache() -> None:
    global _DURATION_CACHE, _DURATION_CACHE_LOADED
    if _DURATION_CACHE_LOADED:
        return
    if DURATION_CACHE_PATH.is_file():
        try:
            with open(DURATION_CACHE_PATH, "r", encoding="utf-8") as f:
                _DURATION_CACHE = json.load(f)
        except (OSError, json.JSONDecodeError):
            _DURATION_CACHE = {}
    _DURATION_CACHE_LOADED = True


def save_duration_cache(dry_run: bool) -> None:
    if not _DURATION_CACHE_DIRTY or dry_run:
        return
    DURATION_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DURATION_CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(_DURATION_CACHE, f, indent=2, sort_keys=True)


def _check_ffprobe() -> bool:
    if shutil.which("ffprobe") is None:
        log.warning("ffprobe nicht im PATH - Dauer-Felder werden ausgelassen.")
        return False
    return True


def get_duration(p: Path) -> float | None:
    """Sekunden, gerundet auf 2 Nachkommastellen. None bei Fehler."""
    global _DURATION_CACHE_DIRTY
    if not p.is_file():
        return None
    key = _duration_cache_key(p)
    cached = _DURATION_CACHE.get(key)
    if cached is not None:
        return cached
    ffprobe = shutil.which("ffprobe")
    if not ffprobe:
        return None
    try:
        out = subprocess.check_output(
            [ffprobe, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(p)],
            stderr=subprocess.STDOUT,
            timeout=10,
        )
        secs = round(float(out.strip()), 2)
    except (subprocess.SubprocessError, ValueError):
        return None
    _DURATION_CACHE[key] = secs
    _DURATION_CACHE_DIRTY = True
    return secs


def attach_durations(manifest: dict, mirror_root: Path,
                     source_base: str) -> None:
    """Iteriert items und ergaenzt 'duration' (Sekunden), wenn ffprobe
    es liefern kann. Bestehende duration-Werte bleiben unveraendert."""
    for it in manifest.get("items", []):
        if it.get("duration") is not None:
            continue
        rel = it.get("audio")
        if not rel or rel.startswith(("http://", "https://", "data:")):
            continue
        p = audio_in_mirror(mirror_root, source_base, rel)
        d = get_duration(p)
        if d is not None:
            it["duration"] = d
```

---

## Schritt 4 — Builder-Aufrufe vereinheitlichen

In **jedem** Builder (`build_thorsten_voice`, `build_thorsten_emotional`,
`build_thorsten_hessisch`, `build_aru`, `build_freiburger`,
`build_oldenburger`, `build_mls`, `build_common_voice`, `build_musan`,
`build_test_noise`) nach dem letzten `write_json(... manifest ...)`
für Kategorie-Manifeste folgende drei Aufrufe ergänzen, **bevor**
der Builder den Source-Key zurückgibt:

```python
attach_durations(manifest, metadata_root, "<source.base>")
verify_manifest_audio(manifest, metadata_root, "<source.base>", "<source-key>")
remember_paths("<source-key>", manifest)
```

`<source.base>` und `<source-key>` sind dieselben Werte, die der
Builder ohnehin an `write_source(...)` übergibt.

Bei Buildern, die **mehrere** Kategorie-Manifeste schreiben (z.B.
MLS pro Buch, Freiburger Einsilbig + Mehrsilbig + CCITT, MUSAN
pro Sub-Quelle): pro `write_json`-Aufruf einen Block.

Beispiel `build_thorsten_voice` (am Ende):

```python
attach_durations(manifest, metadata_root, "Thorsten Voice/")
write_json(out / "thorsten-voice" / "saetze" / "thorsten.json",
           manifest, dry_run)
verify_manifest_audio(manifest, metadata_root,
                      "Thorsten Voice/", "thorsten-voice")
remember_paths("thorsten-voice", manifest)
return "thorsten-voice"
```

Beispiel `build_mls` (innerhalb der Buch-Schleife, vor `write_json`):

```python
attach_durations(manifest, metadata_root, f"{dir_name}/")
fname = f"buch-{slug or 'x'}-{book}.json"
rel = f"saetze/{fname}"
write_json(out / key / rel, manifest, dry_run)
verify_manifest_audio(manifest, metadata_root, f"{dir_name}/", key)
remember_paths(key, manifest)
manifests_idx.append(rel)
```

---

## Schritt 5 — Emotional-Bug fixen

In `build_thorsten_emotional` (ca. Z. 236-298), die Zeile

```python
for wav in sorted(emo_dir.iterdir()):
    if wav.suffix.lower() != ".wav":
        continue
```

ersetzen durch ein Endungs-tolerantes Listing, das **primär** auf der
Soll-Endung aus `EXT_BY_SOURCE` arbeitet und einen Notfall-Fallback
hat, wenn der Lauf gegen das Original (ohne Konvertierung) gefahren
wird:

```python
ext = EXT_BY_SOURCE.get("thorsten-voice-emotional", ".opus")

# 1) Primaer: Dateien mit der Soll-Endung
files = [f for f in sorted(emo_dir.iterdir())
         if f.is_file() and f.suffix.lower() == ext]

# 2) Fallback: wenn nichts gefunden, aber im Original .wav vorhanden,
# die WAV-Liste verwenden, Manifest-Pfade aber auf die Soll-Endung
# umschreiben (Konvertierungs-Annahme).
if not files:
    wavs = [f for f in sorted(emo_dir.iterdir())
            if f.is_file() and f.suffix.lower() == ".wav"]
    if wavs:
        log.warning(
            "emotional/%s: keine %s gefunden, %d .wav vorhanden - "
            "vermutlich Lauf gegen Original. Manifest-Pfade werden "
            "auf %s gesetzt.", emo, ext, len(wavs), ext)
        files = wavs

items = []
for f in files:
    h = f.stem
    text = text_by_hash.get(h, "")
    items.append({
        "id": h[:8],
        "text": text,
        "audio": f"thorsten-emotional_v02/{emo}/{h}{ext}",
    })
if not items:
    continue
```

Der Rest des Builders bleibt unverändert. Auch hier am Ende des
Builders **pro Emotion-Manifest** die drei Aufrufe aus Schritt 4
einsetzen (vor dem `manifests_idx.append(rel)`):

```python
attach_durations(manifest, metadata_root, "Thorsten-Voice-Emotional/")
write_json(out / "thorsten-voice-emotional" / rel, manifest, dry_run)
verify_manifest_audio(manifest, metadata_root,
                      "Thorsten-Voice-Emotional/",
                      "thorsten-voice-emotional")
remember_paths("thorsten-voice-emotional", manifest)
manifests_idx.append(rel)
```

---

## Schritt 6 — main() erweitern

In `main()`:

- **Vor** der Builder-Schleife: `_check_ffprobe()` und
  `load_duration_cache()` aufrufen.
- **Nach** der Builder-Schleife, **vor** `write_top_index`:
  Orphan-Scan und Diff-Report schreiben, Cache speichern.

Konkret:

```python
def main() -> int:
    ap = argparse.ArgumentParser(...)
    ...
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO,
                        format="%(levelname)s %(message)s")

    metadata_root = (args.metadata_root or args.mirror_root).resolve()
    out_root = args.out.resolve()
    log.info("Metadaten aus: %s", metadata_root)
    log.info("Manifeste nach: %s", out_root)

    _check_ffprobe()
    load_duration_cache()

    selected = args.only or list(ALL_BUILDERS.keys())
    built: list[str] = []
    for key in selected:
        if key not in ALL_BUILDERS:
            log.error("Unbekannter Quell-Key: %s", key)
            continue
        try:
            result = ALL_BUILDERS[key](metadata_root, out_root, args.dry_run)
            if result:
                built.append(result)
        except Exception as e:
            log.exception("Quelle %s fehlgeschlagen: %s", key, e)

    # Diff-Sammlung abschliessen
    for src_key, base in _BUILD_SOURCE_BASES.items():
        manifested = _BUILD_AUDIO_PATHS.get(src_key, set())
        scan_orphans(metadata_root, base, src_key, manifested)

    report_path = out_root / "_diff_report.md"
    write_diff_report(report_path, _BUILD_DIFFS, dry_run=args.dry_run)
    log.info("Differenzen-Report: %s", report_path)
    log.info("  - %d fehlende Audio-Dateien",
             len(_BUILD_DIFFS["missing_audio"]))
    log.info("  - %d verwaiste Audio-Dateien",
             len(_BUILD_DIFFS["orphan_audio"]))

    save_duration_cache(args.dry_run)

    if built:
        write_top_index(out_root, built, args.dry_run)
        log.info("Top-Index geschrieben: %d Quellen.", len(built))
    return 0
```

---

## Schritt 7 — Voller Lauf

```bash
python3 scripts/build_manifests.py
```

Erwartete Konsolen-Ausgabe (Auszug):

```
INFO thorsten-voice: 22672 Saetze
...
INFO thorsten-voice-emotional: 8 Emotionen erkannt: amused, angry, ...
...
INFO Differenzen-Report: audio.manifest/_diff_report.md
INFO   - X fehlende Audio-Dateien
INFO   - Y verwaiste Audio-Dateien
```

Wenn X > 0: `_diff_report.md` aufschlagen, an den Nutzer melden.
Wenn Y > 0: ebenso, könnte auf nicht-Audio-Sidecars im Mirror
deuten (z.B. `.scp`-Dateien) — der Orphan-Scan filtert auf
Audio-Endungen, false positives sollten selten sein.

---

## Schritt 8 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.200-beta";
```

---

## Akzeptanztest

1. **Konsole im Build-Lauf**: Log nennt zwei Zahlen ("fehlende",
   "verwaiste").
2. **Datei vorhanden**: `audio.manifest/_diff_report.md` existiert,
   beide Sektionen lesbar.
3. **Emotional gefüllt**:
   - `audio.manifest/thorsten-voice-emotional/source.json`:
     `manifests.saetze` listet 8 Pfade.
   - `audio.manifest/thorsten-voice-emotional/saetze/` enthält 8
     `.json`-Dateien (eine pro Emotion).
4. **Dauer-Felder vorhanden**:
   - `audio.manifest/thorsten-voice/saetze/thorsten.json`: erste 3
     Items haben `"duration": <zahl>`.
5. **Cache existiert nach Lauf**:
   `scripts/.cache/duration_cache.json` ist eine nicht-leere
   JSON-Datei. Bei einem zweiten Lauf ist der Schritt
   `attach_durations` deutlich schneller (kein ffprobe-Aufruf
   für unveränderte Files).
6. **Browser-Test**: Player neu laden, Sub-Tab "Sätze", Sortierung
   "nach Sprache". Erwartet: deutsche Sätze (Thorsten, Emotional,
   Hessisch, Freiburger, OLSA, CV-de) tauchen in der Gruppe "de"
   auf. Englische (ARU, CV-en) in "en". usw.

## Selbstprüfungs-Auftrag an Sonnet

Für jeden der 6 Akzeptanzpunkte einzeln: erfüllt / nicht erfüllt /
unklar, mit Datei- und Zeilenangabe der relevanten Änderung. Bei
Punkt 6: nur die Code-Seite prüfen ("Manifeste enthalten lang
korrekt"), Browser-Test überlasse dem Nutzer.

**Wichtig:** Wenn `metadata_root` (sprich der Mirror unter
`/mnt/xbox/lauscher/voice/opus`) für dich nicht erreichbar ist, baue
**alles bis Schritt 6** durch (Code-Änderungen) und überlasse den
Voll-Lauf (Schritt 7) dem Nutzer. Im Bericht klar trennen.

## Hinweise

- ASCII-Quotes in allen Snippets.
- Keine i18n-Strings.
- Keine JS-Code-Änderungen außer Versionsbump.
- Nachfolge-BAs: BA 201 (ARU-ASCII-Rename), BA 202 (MUSAN-Auto-
  Klassifikation).
