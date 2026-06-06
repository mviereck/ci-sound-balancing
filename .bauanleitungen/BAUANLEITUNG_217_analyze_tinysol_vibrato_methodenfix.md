# BAUANLEITUNG 217 — analyze_tinysol.py: Vibrato-Methodenfix

Zweck
-----

In `docs/richtone_profiles.json` (erzeugt von `tools/analyze_tinysol.py`)
zeigen mehrere Streicher-Instrumente kein detektierbares Vibrato, obwohl
die TinySOL-Samples deutliches Vibrato enthalten. Beispiel Violine (Vn):
`vibratoHz: 0.0`, `vibratoCents: 0.0`, obwohl die F0-Kurve in 5 von 6
Samples eindeutig Vibrato bei ~5 Hz zeigt.

Diagnose (Opus, 2026-06-06) hat drei Ursachen identifiziert:

1. **Bug: inkonsistenter Frame-Zuschnitt.** Die Harmonischen-Analyse nimmt
   den stationären Mittelteil `y[s_start:s_end]` (10–80 % der Voicing-
   Spanne). Die Vibrato-FFT nimmt dagegen **alle** voiced Frames
   `f0_v = f0[~np.isnan(f0)]` inklusive Attack-Phase. Die Attack-Phase
   enthält Pitch-Bend / Attack-Drift, der die Vibrato-FFT verwässert. Auf
   Sonnets drei Vn-Samples gemessen:

   | Sample      | ALT (alle voiced) prom | KORRIGIERT (Mittelteil) prom |
   |-------------|------------------------|------------------------------|
   | Vn-A4-2c    | 1.25                   | 2.19                         |
   | Vn-D5-2c    | 2.86 ← passt zum JSON  | 7.19                         |
   | Vn-G5-1c    | 6.55                   | 13.52                        |
   | **Median**  | **2.86 (= JSON-Wert)** | **7.19 → klar erkannt**      |

2. **Sample-Auswahl zu eng.** `pick_samples` nimmt 3 Samples in
   `mid ± 5 Pitch-IDs`. Das ist nur ±Quart, ein Klumpen um die Mitte. Bei
   3 Samples zieht ein einzelner schwacher Pick den Median auf 0. Mit 6
   gleichmäßig über den ganzen Pitch-Range verteilten Samples ist die
   Schätzung deutlich robuster.

3. **Aggregation: Median maskiert.** Ein einzelnes Sample mit
   `vibratoHz=0` zieht den Median über alle Samples auf 0. Pro-Sample
   binäre Klassifikation („Vibrato ja/nein") + Anteils-basierte
   Aggregation („wenn ≥ 50 % positiv: Mittelwert über positive Samples")
   ist tragfähiger.

Zusätzlich: einzelne TinySOL-Samples (Va-A4, Fl-F6, Ob-A4, Ob-G#6) haben
exakt konstante F0 über die ganze Note. Das sind elektronisch nachgestimmte
Kammerton-Aufnahmen. Solche Samples werden bei der Vibrato-Aggregation
ausgeschlossen (Filter auf F0-Cent-Span ≥ 1.0).

Holzbläser (Fl, Ob, ClBb) zeigen in TinySOL-ord-mf-Samples
**tatsächlich kein periodisches Vibrato** — die F0-Cent-Kurven zeigen
Drifts und Stufen, aber keine 5-Hz-Periodizität. Das ist die Bibliotheks-
Realität, kein Methodenfehler. Erwartung: für Bläser bleibt
`vibratoHz=0`.

Reihenfolge in der Anleitung
----------------------------

1. Versionsbump
2. Schritt A — Frame-Inkonsistenz fixen
3. Schritt B — Sample-Auswahl auf 6 erweitern, breit über Pitch-Range
4. Schritt C — Aggregations-Logik: binäre Klassifikation + Anteils-Schwelle
5. Schritt D — Plausi-Feld `vibratoDetectionRate` im JSON
6. Schritt E — analyze_tinysol.py laufen, JSON-Output prüfen
7. Schritt F — profiles_to_js.py laufen
8. Akzeptanztest
9. Selbstprüfungs-Auftrag

Schritt 1 — Versionsbump
-------------------------

In `js/version.js`:

vorher:

```js
const APP_VERSION = "3.2.216-beta";
```

nachher:

```js
const APP_VERSION = "3.2.217-beta";
```

Schritt 2 — Schritt A: Frame-Inkonsistenz fixen
------------------------------------------------

In `tools/analyze_tinysol.py`, Funktion `analyze_sample`:

Zwischen den Konstanten am Modulkopf zwei neue Schwellen ergänzen (oberhalb
des `VIB_CENTS_THRESHOLD`):

vorher:

```python
VIB_CENTS_THRESHOLD = 3.0  # unterhalb: Vibrato als nicht vorhanden werten
AM_DEPTH_THRESHOLD  = 0.05 # unterhalb: AM als nicht vorhanden werten
```

nachher:

```python
VIB_CENTS_THRESHOLD     = 3.0   # unterhalb: Vibrato als nicht vorhanden werten
VIB_SPAN_MIN_CENT       = 1.0   # Samples mit F0-Cent-Spannweite < 1 (z.B. elektronisch nachgestimmte
                                # Kammerton-Aufnahmen wie Va-A4=440Hz) werden bei der Vibrato-
                                # Aggregation ausgeschlossen, weil ihre F0-Kurve kein natuerliches
                                # Verhalten zeigt.
VIB_DETECTION_MIN_RATIO = 0.5   # Anteil der Samples, die Vibrato zeigen muessen, damit das
                                # Profil ueberhaupt vibratoHz/vibratoCents bekommt; sonst 0.
N_SAMPLES_PER_INSTR     = 6     # Vorher 3 (zu eng am Mittelpunkt). 6 verteilt sich besser.
AM_DEPTH_THRESHOLD      = 0.05  # unterhalb: AM als nicht vorhanden werten
```

Den bisherigen Vibrato-Block in `analyze_sample` ersetzen.

vorher (etwa Z. 144–172):

```python
    # Vibrato: FFT der F0-Kurve in Cent
    f0_cents = 1200 * np.log2(f0_v / f0_med)
    f0_cents -= np.mean(f0_cents)
    if len(f0_cents) >= 16:
        vib_spec  = np.abs(np.fft.rfft(f0_cents))
        vib_freqs = np.fft.rfftfreq(len(f0_cents), HOP / sr)
        vib_mask  = (vib_freqs > VIB_MIN_HZ) & (vib_freqs < VIB_MAX_HZ)
        if vib_mask.any():
            vib_in_mask = vib_spec[vib_mask]
            peak_amp = float(vib_in_mask.max())
            med_amp  = float(np.median(vib_in_mask))
            prom = peak_amp / max(med_amp, 1e-9)
            # Echtes Vibrato hat einen scharfen Peak; Akkordeon-Tremulant
            # und Schwebungen zeigen sich als breitbandiges Rauschen ohne
            # ausgeprägten Peak. Schwelle: Peak >= 3x Median im Suchfenster.
            prominent = prom >= 3.0
            if prominent and peak_amp > 0.5:
                vib_idx      = int(np.argmax(np.where(vib_mask, vib_spec, 0)))
                vibratoHz    = float(vib_freqs[vib_idx])
                vibratoCents = float(np.std(f0_cents) * np.sqrt(2))
            else:
                vibratoHz, vibratoCents = 0.0, 0.0
            vibratoProm = round(prom, 2)
        else:
            vibratoHz, vibratoCents, vibratoProm = 0.0, 0.0, 0.0
    else:
        vibratoHz, vibratoCents, vibratoProm = 0.0, 0.0, 0.0
    if vibratoCents < VIB_CENTS_THRESHOLD:
        vibratoHz, vibratoCents = 0.0, 0.0
```

nachher:

```python
    # Vibrato: FFT der F0-Kurve in Cent.
    # WICHTIG: gleicher Mittelteil wie fuer Harmonische (i_start..i_end).
    # Bisher wurde f0_v = f0[~np.isnan(f0)] genommen (ALLE voiced Frames inkl.
    # Attack-Phase), was die Vibrato-FFT durch Attack-Drift verwaesserte.
    f0_mid = f0[i_start:i_end].copy()
    nan_mask = np.isnan(f0_mid)
    if nan_mask.any():
        f0_mid[nan_mask] = f0_med
    f0_cents  = 1200 * np.log2(f0_mid / f0_med)
    f0_cents -= np.mean(f0_cents)
    spanCents = float(f0_cents.max() - f0_cents.min())

    vibratoHz, vibratoCents, vibratoProm = 0.0, 0.0, 0.0
    vibratoDetected = False
    if len(f0_cents) >= 16:
        vib_spec  = np.abs(np.fft.rfft(f0_cents))
        vib_freqs = np.fft.rfftfreq(len(f0_cents), HOP / sr)
        vib_mask  = (vib_freqs > VIB_MIN_HZ) & (vib_freqs < VIB_MAX_HZ)
        if vib_mask.any():
            vib_in_mask = vib_spec[vib_mask]
            peak_amp = float(vib_in_mask.max())
            med_amp  = float(np.median(vib_in_mask))
            prom     = peak_amp / max(med_amp, 1e-9)
            vibratoProm = round(prom, 2)
            cand_idx   = int(np.argmax(np.where(vib_mask, vib_spec, 0)))
            cand_hz    = float(vib_freqs[cand_idx])
            cand_cents = float(np.std(f0_cents) * np.sqrt(2))
            # Drei kombinierte Kriterien: spektrale Prominenz, Mindest-
            # Auslenkung, ueberhaupt natuerliche F0-Variation im Sample.
            vibratoDetected = (
                prom       >= 3.0
                and peak_amp > 0.5
                and cand_cents >= VIB_CENTS_THRESHOLD
                and spanCents  >= VIB_SPAN_MIN_CENT
            )
            if vibratoDetected:
                vibratoHz    = cand_hz
                vibratoCents = cand_cents
```

Im return-Dict zwei zusätzliche Felder ergänzen.

vorher:

```python
    return {
        "f0":           round(f0_med, 2),
        "partials":     partials,
        "vibratoHz":    round(vibratoHz, 2),
        "vibratoCents": round(vibratoCents, 2),
        "vibratoProm":  vibratoProm,
        "amHz":         round(amHz, 2),
        "amDepth":      round(amDepth, 3),
        "attackMs":     round(attackMs, 1),
    }
```

nachher:

```python
    return {
        "f0":               round(f0_med, 2),
        "partials":         partials,
        "vibratoHz":        round(vibratoHz, 2),
        "vibratoCents":     round(vibratoCents, 2),
        "vibratoProm":      vibratoProm,
        "vibratoSpanCents": round(spanCents, 1),
        "vibratoDetected":  bool(vibratoDetected),
        "amHz":             round(amHz, 2),
        "amDepth":          round(amDepth, 3),
        "attackMs":         round(attackMs, 1),
    }
```

Schritt 3 — Schritt B: Sample-Auswahl auf 6, breit über Pitch-Range
-------------------------------------------------------------------

Funktion `pick_samples` komplett ersetzen.

vorher (Z. 63–91):

```python
def pick_samples(meta, instr, n=3):
    """Drei Samples pro Instrument: Mitte des Pitch-Range plus +/- ~Quart."""
    pool = [
        r for r in meta
        if r["Instrument (abbr.)"] == instr
        and r["Technique (abbr.)"] == "ord"
        and r["Dynamics"] == "mf"
    ]
    if not pool:
        return []
    no_retune = [r for r in pool if r.get("Needed digital retuning", "FALSE") == "FALSE"]
    cands = no_retune if no_retune else pool
    pids = sorted({int(r["Pitch ID"]) for r in cands})
    if not pids:
        return []
    mid = pids[len(pids) // 2]
    targets = [mid - 5, mid, mid + 5]
    seen = set()
    chosen = []
    for t in targets:
        best = min(cands, key=lambda r: abs(int(r["Pitch ID"]) - t))
        key = best["Path"]
        if key in seen:
            continue
        seen.add(key)
        chosen.append(best)
        if len(chosen) >= n:
            break
    return chosen
```

nachher:

```python
def pick_samples(meta, instr, n=N_SAMPLES_PER_INSTR):
    """Samples gleichmaessig ueber den verfuegbaren Pitch-Range des
    Instruments verteilen. Vorher nur 3 Samples mid +/- 5 PIDs (also
    +/- Quart) -- zu eng am Mittelpunkt; ein einzelnes schwaches
    Sample konnte die Aggregation ueber den Median auf 0 ziehen.
    """
    pool = [
        r for r in meta
        if r["Instrument (abbr.)"] == instr
        and r["Technique (abbr.)"] == "ord"
        and r["Dynamics"] == "mf"
    ]
    if not pool:
        return []
    no_retune = [r for r in pool if r.get("Needed digital retuning", "FALSE") == "FALSE"]
    cands = no_retune if no_retune else pool
    by_pid = {}
    for r in cands:
        by_pid.setdefault(int(r["Pitch ID"]), []).append(r)
    pids = sorted(by_pid.keys())
    if not pids:
        return []
    if len(pids) <= n:
        chosen_pids = pids
    else:
        step = (len(pids) - 1) / (n - 1)
        chosen_pids = [pids[round(i * step)] for i in range(n)]
    return [by_pid[pid][0] for pid in chosen_pids]
```

Schritt 4 — Schritt C: Aggregations-Logik
------------------------------------------

Funktion `aggregate_profile` ersetzen.

vorher (Z. 215–242):

```python
def aggregate_profile(samples, instr):
    valid = [s for s in samples if s]
    if not valid:
        return None
    # Harmonische: pro mult die Amplituden ueber alle Samples mitteln
    by_h = {}
    for s in valid:
        for p in s["partials"]:
            by_h.setdefault(p["mult"], []).append(p["amp"])
    partials = sorted(
        [
            {"mult": h, "amp": round(float(np.mean(amps)), 3)}
            for h, amps in by_h.items()
            if float(np.mean(amps)) >= HARM_MIN or h == 1
        ],
        key=lambda x: x["mult"],
    )
    return {
        "label":        INSTRUMENT_LABELS_DE[instr],
        "abbr":         instr,
        "partials":     partials,
        "vibratoHz":    round(float(np.median([s["vibratoHz"]    for s in valid])), 2),
        "vibratoCents": round(float(np.median([s["vibratoCents"] for s in valid])), 2),
        "vibratoProm":  round(float(np.median([s["vibratoProm"]  for s in valid])), 2),
        "amHz":         round(float(np.median([s["amHz"]         for s in valid])), 2),
        "amDepth":      round(float(np.median([s["amDepth"]      for s in valid])), 3),
        "attackMs":     round(float(np.median([s["attackMs"]     for s in valid])), 1),
    }
```

nachher:

```python
def aggregate_profile(samples, instr):
    valid = [s for s in samples if s]
    if not valid:
        return None
    # Harmonische: pro mult die Amplituden ueber alle Samples mitteln
    by_h = {}
    for s in valid:
        for p in s["partials"]:
            by_h.setdefault(p["mult"], []).append(p["amp"])
    partials = sorted(
        [
            {"mult": h, "amp": round(float(np.mean(amps)), 3)}
            for h, amps in by_h.items()
            if float(np.mean(amps)) >= HARM_MIN or h == 1
        ],
        key=lambda x: x["mult"],
    )

    # Vibrato-Aggregation: pro-Sample-Klassifikation, anteilsbasiert.
    # Samples mit elektronisch konstanter F0 (vibratoSpanCents < VIB_SPAN_MIN_CENT)
    # nehmen wir aus der Anteilsbildung heraus, weil sie keine natuerliche
    # F0-Variation enthalten und das Gesamtbild verzerren wuerden.
    vib_eligible = [s for s in valid if s.get("vibratoSpanCents", 0) >= VIB_SPAN_MIN_CENT]
    vib_positive = [s for s in vib_eligible if s.get("vibratoDetected", False)]
    n_eligible   = len(vib_eligible)
    n_positive   = len(vib_positive)
    n_total      = len(valid)
    ratio        = (n_positive / n_eligible) if n_eligible > 0 else 0.0
    if ratio >= VIB_DETECTION_MIN_RATIO and vib_positive:
        vibratoHz    = float(np.mean([s["vibratoHz"]    for s in vib_positive]))
        vibratoCents = float(np.mean([s["vibratoCents"] for s in vib_positive]))
    else:
        vibratoHz, vibratoCents = 0.0, 0.0

    return {
        "label":             INSTRUMENT_LABELS_DE[instr],
        "abbr":              instr,
        "partials":          partials,
        "vibratoHz":         round(vibratoHz, 2),
        "vibratoCents":      round(vibratoCents, 2),
        "vibratoProm":       round(float(np.median([s["vibratoProm"] for s in valid])), 2),
        "vibratoDetectionRate": f"{n_positive}/{n_eligible} (von {n_total} insgesamt)",
        "vibratoSpansCents": [round(float(s.get("vibratoSpanCents", 0)), 1) for s in valid],
        "amHz":              round(float(np.median([s["amHz"]      for s in valid])), 2),
        "amDepth":           round(float(np.median([s["amDepth"]   for s in valid])), 3),
        "attackMs":          round(float(np.median([s["attackMs"]  for s in valid])), 1),
    }
```

Schritt 5 — Schritt D: Plausi-Felder im JSON
--------------------------------------------

Schritt D ist bereits durch Schritt C abgedeckt: `vibratoDetectionRate` und
`vibratoSpansCents` werden vom Aggregator ausgegeben. `profiles_to_js.py`
filtert diese Plausi-Felder ohnehin aus, sie landen nicht im
`js/richtone-profiles.js` — sie sind nur in der JSON sichtbar, fuer den
manuellen Plausi-Blick. Keine zusaetzliche Aenderung noetig.

Schritt 6 — Schritt E: analyze_tinysol.py laufen
-------------------------------------------------

```
~/.venv-cv/bin/python3 tools/analyze_tinysol.py
```

Erwartung: `OK: 14 Profile -> docs/richtone_profiles.json`. Pro Instrument
sechs Samples in der `samples`-Liste. Pro Profil `vibratoDetectionRate`
und `vibratoSpansCents` vorhanden.

Schritt 7 — Schritt F: profiles_to_js.py laufen
------------------------------------------------

```
~/.venv-cv/bin/python3 tools/profiles_to_js.py
```

Erwartung: `OK: 14 Profile -> js/richtone-profiles.js`. In der Datei
**keine** `vibratoDetectionRate`- oder `vibratoSpansCents`-Felder, nur
die Synth-Parameter (das ist die bisherige Filter-Logik in
`profiles_to_js.py`, unveraendert).

Akzeptanztest
-------------

| #   | Punkt                                                                                              | Erwartet              |
|-----|----------------------------------------------------------------------------------------------------|-----------------------|
| AT1 | `tools/analyze_tinysol.py` laeuft ohne unbehandelte Exception                                      | ja                    |
| AT2 | `docs/richtone_profiles.json` enthaelt 14 Profile                                                  | ja                    |
| AT3 | Pro Profil 6 Samples in der `samples`-Liste (oder Maximum, falls Instrument weniger Pitch-IDs hat) | ja                    |
| AT4 | `Vn.vibratoHz` zwischen 4.5 und 5.5                                                                | ja                    |
| AT5 | `Vn.vibratoCents` zwischen 4 und 12                                                                | ja                    |
| AT6 | `Vn.vibratoDetectionRate` zeigt mindestens 4 von n positive Samples                                | ja                    |
| AT7 | `Va.vibratoHz` und `Vc.vibratoHz` weiterhin im Bereich 4.5–5.5 (nicht degradiert)                  | ja                    |
| AT8 | `Acc.vibratoHz` = 0.0 (Akkordeon-Tremulant nicht faelschlich detektiert)                           | ja                    |
| AT9 | `Fl.vibratoHz` = `Ob.vibratoHz` = `ClBb.vibratoHz` = 0.0 (Bibliotheks-Realitaet)                  | ja                    |
| AT10 | `tools/profiles_to_js.py` erzeugt `js/richtone-profiles.js` ohne Exception                        | ja                    |
| AT11 | `js/richtone-profiles.js` enthaelt **keine** `vibratoDetectionRate`-Felder                         | ja                    |
| AT12 | `js/version.js` zeigt `"3.2.217-beta"`                                                             | ja                    |

Bei abweichenden Werten in AT4/AT5/AT7 bitte das Profil im JSON
auszugsweise mitschicken, ich werte den Befund.

Selbstprüfungs-Auftrag an Sonnet
---------------------------------

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen und in
einer Tabelle melden: erfuellt / nicht erfuellt / unklar, mit
Datei-/Zeilenangabe (bei AT4–AT9 mit dem konkret gemessenen Wert).

Wenn ein Punkt als unklar markiert wird, sofort rueckfragen, nicht still
weiterbauen. Bei Schwellenstreit (z.B. `Vn.vibratoCents = 3.8` knapp am
Limit) Rohwerte melden, **nicht** an den Konstanten drehen.

Hinweis für i18n
----------------

Keine UI-Texte in dieser Bauanleitung — der Vibrato-Methodenfix berührt
nur das Analyse-Tool und die generierte JSON / JS-Datei. Keine
Folge-i18n-BA nötig.
