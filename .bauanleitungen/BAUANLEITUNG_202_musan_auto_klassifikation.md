# Bauanleitung 202 — MUSAN-Geräusche automatisch klassifizieren

**Versionsbump:** `js/version.js` auf `"3.2.202-beta"`.

**Voraussetzung:** BA 200 ist gebaut (Manifest-Builder schreibt
MUSAN-Noise-Manifeste mit `kind: null`-Platzhaltern). BA 199 ist
gebaut (Loader vererbt Tags, sodaß die neuen `kind`-Werte im Player
filterbar werden). BA 201 ist nicht zwingend nötig (ARU betrifft
MUSAN nicht).

**Python-Abhängigkeiten:** `numpy` und `soundfile`. Wenn nicht
installiert, läuft die Signal-Analyse **nicht** — der Title/URL/
ANNOTATIONS-Teil läuft weiter. Sonnet meldet das im Bericht und
schlägt dem Nutzer die Installation vor:

```bash
pip install --user numpy soundfile
```

---

## Ziel

`scripts/musan_noise_enrich.py` so erweitern, daß es ohne manuell
gepflegtes `musan_noise_enrichment.json` läuft und die Klassen
`kind`, `stationary`, `loop_safe`, `spectrum`, `dominant_freq_hz`
für die ~900 MUSAN-Noise-Items automatisch füllt.

Drei Quellen:

- **`sound-bible/LICENSE`**: pro Item `Title:` und URL —
  Title-Keyword-Map auf `kind`.
- **`free-sound/ANNOTATIONS`**: Kategorien wie `Background noises:` —
  default-`kind` ableiten.
- **Signal-Analyse** der WAV-Dateien: RMS-Varianz → `stationary`,
  Anfang-Ende-Spektrum-Distanz → `loop_safe`, FFT-Bandverteilung +
  Peak-Dominanz → `spectrum` und `dominant_freq_hz`.

Manuelle Anreicherung (`musan_noise_enrichment.json`) bleibt
unterstützt und überschreibt die Auto-Werte.

---

## Schritt 1 — Imports und Konstanten

In `scripts/musan_noise_enrich.py`, Header-Block direkt unter den
bestehenden Imports erweitern:

```python
import re

try:
    import numpy as np
    import soundfile as sf
    SIGNAL_AVAILABLE = True
except ImportError:
    SIGNAL_AVAILABLE = False
```

Direkt unter den bestehenden Defaults eine Title-Map ergänzen:

```python
# Title-Keyword -> kind. Reihenfolge ist relevant: spezifischer zuerst.
TITLE_TO_KIND = [
    (r"\b(white noise|pink noise|brown noise)\b",
     "rauschen-weiss"),
    (r"\b(sine|sine wave|tone|test signal|chirp|sweep)\b",
     "test-ton"),
    (r"\b(applause|audience|crowd|stadium|cheering|cheer|spectators)\b",
     "crowd"),
    (r"\b(cafe|coffee shop|restaurant|bar interior|pub)\b",
     "cafe"),
    (r"\b(babble|chatter|conversation|talking|whisper)\b",
     "babble"),
    (r"\b(dog|cat|bird|cricket|cow|sheep|frog|chicken|rooster|"
     r"horse|whale|wolf|owl|duck|cricket|cicada|insect|monkey|"
     r"lion|tiger|seagull|crow|sparrow)\b",
     "tier"),
    (r"\b(rain|wind|thunder|storm|hail|water drip|drizzle|"
     r"raindrops|breeze|gust)\b",
     "wetter"),
    (r"\b(car|truck|train|airplane|jet|motorcycle|bus|engine|"
     r"traffic|horn|siren|tire|brake|skid|bicycle|cycle|"
     r"helicopter|propeller)\b",
     "verkehr"),
    (r"\b(door|glass|dishes|vacuum|microwave|fridge|kettle|"
     r"alarm clock|telephone|phone|toilet|flush|sink|faucet|"
     r"clock|tick|footstep|knock|key|jingle|drawer|chair|"
     r"page|paper|cutlery)\b",
     "haushalt"),
    (r"\b(hammer|drill|saw|chainsaw|jackhammer|machine|"
     r"construction|grinder|lawnmower|mower|electric tool|"
     r"compressor|industrial|metal|forge|welding)\b",
     "industrie"),
    (r"\b(gun|rifle|shotgun|pistol|smg|bullet|explosion|"
     r"grenade|rpg|cannon|firework|blast|gunfire|shooting)\b",
     "industrie"),
    (r"\b(ambient|background|atmosphere|room|indoor|outdoor|"
     r"environment|nature)\b",
     "ambient"),
]
```

---

## Schritt 2 — Sidecar-Parser

Folgende Hilfsfunktionen in derselben Datei einfügen, oberhalb von
`merge_item`:

```python
def parse_sound_bible_titles(license_path: Path) -> dict[str, str]:
    """Pro Item-ID den Title (Lowercase) aus der MUSAN-sound-bible
    LICENSE-Datei extrahieren."""
    out: dict[str, str] = {}
    if not license_path.is_file():
        return out
    text = license_path.read_text(encoding="utf-8", errors="replace")
    blocks = re.split(r"^[=]{3,}\s*$", text, flags=re.MULTILINE)
    id_re = re.compile(r"^(noise-sound-bible-\d+)$", re.IGNORECASE)
    title_re = re.compile(r"^Title:\s*(.+)$", re.IGNORECASE)
    for block in blocks:
        iid = None
        title = None
        for raw in block.split("\n"):
            ln = raw.strip()
            m = id_re.match(ln)
            if m:
                iid = m.group(1).lower()
                continue
            m = title_re.match(ln)
            if m and iid:
                title = m.group(1).strip().lower()
                break
        if iid and title:
            out[iid] = title
    return out


def parse_free_sound_annotations(annot_path: Path) -> dict[str, str]:
    """Pro Item-ID die Kategorie-Bezeichnung (Lowercase) aus
    free-sound/ANNOTATIONS extrahieren."""
    out: dict[str, str] = {}
    if not annot_path.is_file():
        return out
    current = None
    for raw in annot_path.read_text(encoding="utf-8", errors="replace").splitlines():
        ln = raw.strip()
        if not ln:
            continue
        if ln.endswith(":"):
            current = ln[:-1].strip().lower()
            continue
        if current and ln.startswith("noise-free-sound-"):
            out[ln] = current
    return out


def kind_from_title(title: str) -> str | None:
    if not title:
        return None
    for rgx, kind in TITLE_TO_KIND:
        if re.search(rgx, title):
            return kind
    return None


def kind_from_free_sound_category(cat: str) -> str:
    cat = (cat or "").lower()
    if "background" in cat:
        return "ambient"
    if "music" in cat or "musical" in cat:
        return "ambient"  # MUSAN-noise enthaelt kein Musik-Material
    if "speech" in cat or "babble" in cat or "voice" in cat:
        return "babble"
    return "ambient"
```

---

## Schritt 3 — Signal-Analyse

```python
def analyze_signal(p: Path) -> dict:
    """Liest Audiodatei und liefert
    {stationary, loop_safe, spectrum, dominant_freq_hz}.
    Werte None, wenn die Analyse nicht moeglich war."""
    out = {
        "stationary": None,
        "loop_safe": None,
        "spectrum": None,
        "dominant_freq_hz": None,
    }
    if not SIGNAL_AVAILABLE:
        return out
    try:
        data, sr = sf.read(str(p), always_2d=False)
    except Exception:
        return out
    if data.ndim > 1:
        data = data.mean(axis=1)
    if data.size < sr // 4:
        return out

    data = data.astype(np.float32)
    peak = float(np.max(np.abs(data)))
    if peak > 0:
        data = data / peak

    # --- stationary: RMS-Frames, geringe Streuung = stationaer ---
    frame = max(int(0.05 * sr), 1)
    n_frames = data.size // frame
    if n_frames >= 4:
        frames = data[:n_frames * frame].reshape(n_frames, frame)
        rms = np.sqrt(np.mean(frames ** 2, axis=1))
        if rms.mean() > 0:
            cv = rms.std() / (rms.mean() + 1e-9)
            out["stationary"] = "y" if cv < 0.5 else "n"

    # --- loop_safe: erste 0.05 s vs. letzte 0.05 s ---
    win = min(int(0.05 * sr), data.size // 4)
    if win > 32:
        head = data[:win]
        tail = data[-win:]
        Fh = np.abs(np.fft.rfft(head))
        Ft = np.abs(np.fft.rfft(tail))
        if Fh.sum() > 0 and Ft.sum() > 0:
            Fh = Fh / Fh.sum()
            Ft = Ft / Ft.sum()
            dist = float(np.linalg.norm(Fh - Ft))
            level_jump = float(abs(np.abs(head[-1]) - np.abs(tail[0])))
            out["loop_safe"] = ("y" if (dist < 0.05 and level_jump < 0.1)
                                else "n")

    # --- spectrum + dominant_freq_hz ---
    seg = min(int(2.0 * sr), data.size)
    spec = np.abs(np.fft.rfft(data[:seg]))
    freqs = np.fft.rfftfreq(seg, 1.0 / sr)
    total = float(spec.sum())
    if total > 0:
        e_low  = float(spec[freqs <  500].sum() / total)
        e_mid  = float(spec[(freqs >= 500) & (freqs < 4000)].sum() / total)
        e_high = float(spec[freqs >= 4000].sum() / total)
        peak_idx = int(np.argmax(spec))
        peak_share = float(spec[peak_idx] / total)
        if peak_share > 0.4:
            out["spectrum"] = "tonal"
            out["dominant_freq_hz"] = int(round(float(freqs[peak_idx])))
        elif e_low > 0.7:
            out["spectrum"] = "lowpass"
        elif e_high > 0.5:
            out["spectrum"] = "highpass"
        elif e_mid > 0.5 and e_low < 0.3 and e_high < 0.3:
            out["spectrum"] = "bandpass"
        else:
            out["spectrum"] = "broadband"

    return out
```

---

## Schritt 4 — main() umbauen

`main()` so erweitern, daß die Auto-Klassifikation standardmäßig
läuft und das manuelle Enrichment (falls vorhanden) überschreibt.

Argument-Parser ergänzen:

```python
ap.add_argument("--mirror", type=Path,
                default=Path("/mnt/xbox/lauscher/voice"),
                help="Voice-Wurzel mit musan/noise/ "
                     "(Default: /mnt/xbox/lauscher/voice)")
ap.add_argument("--no-auto", action="store_true",
                help="Auto-Klassifikation ausschalten - "
                     "nur das Enrichment-File anwenden.")
```

Schleifenkörper komplett ersetzen durch:

```python
# Manuelle Anreicherung (optional)
enrichment = {}
if args.enrichment.is_file():
    with open(args.enrichment, "r", encoding="utf-8") as f:
        enrichment = {k: v for k, v in json.load(f).items()
                      if not k.startswith("_")}
else:
    log.info("Keine manuelle Anreicherung gefunden (%s) - laufe "
             "nur mit Auto-Klassifikation.", args.enrichment)

# Sidecars
sb_titles = parse_sound_bible_titles(
    args.mirror / "musan/noise/sound-bible/LICENSE")
fs_cats = parse_free_sound_annotations(
    args.mirror / "musan/noise/free-sound/ANNOTATIONS")
log.info("Sidecar-Titles: %d sound-bible, %d free-sound",
         len(sb_titles), len(fs_cats))

if not SIGNAL_AVAILABLE:
    log.warning("numpy/soundfile nicht installiert - Signal-Analyse "
                "(stationary/loop_safe/spectrum) wird ausgelassen. "
                "Installation: pip install --user numpy soundfile")

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
        iid = (it.get("id") or "").lower()
        tags = it.setdefault("tags", {})

        # 1) Auto-kind aus Sidecars
        if not args.no_auto:
            k = None
            if iid.startswith("noise-sound-bible-"):
                title = sb_titles.get(iid)
                k = kind_from_title(title) if title else None
            elif iid.startswith("noise-free-sound-"):
                cat = fs_cats.get(iid)
                if cat:
                    k = kind_from_free_sound_category(cat)
            if k and tags.get("kind") in (None, "null"):
                tags["kind"] = k
                changed_in_file += 1

        # 2) Signal-Analyse
        if not args.no_auto and SIGNAL_AVAILABLE:
            audio_rel = it.get("audio")
            if audio_rel:
                audio_path = args.mirror / "musan" / audio_rel
                if audio_path.is_file():
                    sig = analyze_signal(audio_path)
                    for k_sig, v in sig.items():
                        if v is not None and tags.get(k_sig) in (None, "null"):
                            tags[k_sig] = v
                            changed_in_file += 1

        # 3) Manuelles Enrichment ueberschreibt
        if it.get("id") in enrichment:
            if merge_item(it, enrichment[it.get("id")]):
                changed_in_file += 1

    if changed_in_file:
        n_files += 1
        n_items_changed += changed_in_file
        if not args.dry_run:
            with open(mf, "w", encoding="utf-8") as f:
                json.dump(manifest, f, ensure_ascii=False, indent=2)
                f.write("\n")
        log.info("%s -> %d Items angereichert", mf.name, changed_in_file)

log.info("Fertig. %d Dateien geaendert, %d Items angereichert.",
         n_files, n_items_changed)
```

Die bestehende `merge_item(...)`-Funktion bleibt unverändert.

---

## Schritt 5 — Lauf

```bash
# Trockenlauf zum Inspizieren
python3 scripts/musan_noise_enrich.py --dry-run

# Echter Lauf
python3 scripts/musan_noise_enrich.py
```

Erwartete Konsolen-Ausgabe (Auszug):

```
INFO Sidecar-Titles: ~400 sound-bible, ~900 free-sound
INFO free-sound.json -> ~900 Items angereichert
INFO sound-bible.json -> ~400 Items angereichert
INFO Fertig. 2 Dateien geaendert, ~1300 Items angereichert.
```

(Genau Zahl variiert mit Mirror-Stand.)

---

## Schritt 6 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.202-beta";
```

---

## Akzeptanztest

1. **Stichprobe sound-bible**: in `audio.manifest/musan/geraeusche/sound-bible.json`
   folgende Items prüfen:
   - `noise-sound-bible-0049` (Crickets Chirping) → `tags.kind: "tier"`
   - `noise-sound-bible-0035` (Hammering) → `tags.kind: "industrie"`
   - `noise-sound-bible-0003` (Audience Applause) → `tags.kind: "crowd"`
2. **Stichprobe free-sound**: in `audio.manifest/musan/geraeusche/free-sound.json`
   die Items aus der `Background noises:`-Kategorie haben
   `tags.kind: "ambient"`.
3. **Signal-Tags** (nur wenn `numpy`+`soundfile` installiert):
   Ein paar Items haben `tags.stationary: "y"` oder `"n"`,
   `tags.spectrum: "broadband"` o.ä. — kein durchgehendes `null`.
4. **Tonale Items**: ein paar Items mit `tags.spectrum: "tonal"` und
   gesetztem `tags.dominant_freq_hz: <int>` finden sich (typischerweise
   Pieptöne, Pfeifsignale).
5. **Idempotenz**: ein zweiter Lauf meldet `0 Items angeaendert`
   (alle Tags schon gesetzt, Auto-Logik überschreibt nicht).
6. **Browser**: Player neu laden, Sub-Tab "Geräusche", Sortierung
   "nach Art". Erwartet: Gruppen `tier`, `verkehr`, `crowd`, `cafe`,
   `ambient`, `industrie`, `haushalt`, `wetter` erscheinen je nach
   Bestand. "zzz-unbekannt" sollte deutlich schrumpfen (oder
   verschwinden, je nach Tag-Trefferquote).

## Selbstprüfungs-Auftrag an Sonnet

Für die 6 Akzeptanzpunkte einzeln: erfüllt / nicht erfüllt / unklar.

Wenn `numpy`/`soundfile` bei dir nicht installiert sind: Punkte 3-4
auf "unklar — Signal-Analyse nicht gelaufen" setzen und den Nutzer
informieren. Punkte 1, 2, 5 sind ohne Signal-Analyse prüfbar.

Wenn der Mirror nicht erreichbar ist: alle Code-Änderungen bauen,
den Lauf (Schritt 5) dem Nutzer überlassen, Akzeptanzpunkte 1-5
auf "Code-Seite erfüllt, Lauf offen" markieren.

## Hinweise

- ASCII-Quotes in allen Snippets.
- Keine i18n-Strings.
- Keine JS-Änderungen außer Versionsbump.
- Keine Spec-Doku-Änderungen (Tag-Werte stehen bereits im Katalog).
- Damit ist die Manifest-Reparatur (BA 199-202) abgeschlossen.
  Online-Quellen (LibriVox, Internet Archive, Freesound) sind eigene
  Vorhaben.
