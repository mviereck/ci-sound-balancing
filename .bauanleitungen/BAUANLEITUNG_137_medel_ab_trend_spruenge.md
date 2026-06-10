# BAUANLEITUNG 137 — MED-EL/AB Trend + lokale Sprünge

## Ziel

Zwei weitere Hz-Plausibilitätsprüfungen ergänzen, aktiv **nur**
für die Hersteller MED-EL und AB (für Cochlear übernimmt der
Lookup aus BA 135 dieselbe Rolle):

- **Trend-basiert (global)**: Cent-Versatz jedes User-Hz-Werts
  gegen den Default an derselben Elektrode. Geglätteter
  Versatz-Trend per lokalem Median über die Nachbarelektroden
  (Fenster 4, ohne i selbst). Wenn der Versatz an einer
  Elektrode signifikant vom Nachbarn-Median abweicht → Warnung.
  Schwellen: 300 Cent (Level 3, gelb), 600 Cent (Level 2,
  orange).
- **Lokaler Sprung**: Cent-Schrittweite zwischen zwei
  benachbarten Elektroden vs. Default-Schrittweite an dieser
  Stelle. Schwellen: 400 Cent (Level 3, gelb), 700 Cent (Level
  2, orange).

Setzt auf BA 133 (Grundgerüst), BA 134 (Range/Größenordnung)
und BA 136 (Default-Korrektur) auf.

## Begründung

Trend-Prüfung fängt verrutschte Zeilen und einzelne Tippfehler
in einer ansonsten konsistent verschobenen Reihe (z. B. nach
ABF). Sprung-Prüfung fängt zusätzlich Unregelmäßigkeiten in der
Schrittstruktur, die ein globaler Trend nicht sieht (z. B.
gestauchte oder gespreizte Lokal-Abschnitte).

Schwellwerte sind in Konzeptphase aus Pieper et al. 2022 und
Canfarotta 2020 hergeleitet (siehe
`.manuals/Recherche_Cent_Schwellwerte_Plausibilitaet.md`,
Empfehlung „lokale Sprünge etwas weiter als globale
Abweichung"). Cochlear ist ausgenommen, weil dort die diskrete
Tabellen-Struktur (BA 135) die passendere Referenz ist als ein
geglätteter Trend.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.136-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.137-beta";
```

---

## Neue Konstanten in `js/implant-validate.js`

Direkt nach den Trend-Schwellen aus BA 135 (`IMPL_VAL_HZ_TREND_*`)
zwei weitere Konstanten ergänzen:

```js
// Lokale Sprung-Schwellen in Cent (Cent-Schrittweite zwischen
// Nachbarelektroden vs. Default-Schrittweite). Aus Konzept:
// lokale Sprünge dürfen etwas weiter als globale Trend-
// Abweichungen sein, weil der apikal-basal-Gradient die
// Schrittweiten ohnehin variiert.
const IMPL_VAL_HZ_JUMP_YELLOW_CENT = 400;
const IMPL_VAL_HZ_JUMP_ORANGE_CENT = 700;
```

---

## Neuer Helfer in `js/implant-validate.js`

Vor dem ersten `_implCheck…`-Funktion (z. B. vor
`_implCheckHzMonotonie`) folgenden Helfer einfügen:

```js
// Lokaler Median über die Nachbar-Werte von Index i im Versatz-Array,
// Fenster ±2, ohne i selbst. Null-Werte und null/undefined werden
// übersprungen. Rückgabe: Median oder null wenn keine Nachbarn vorhanden.
function _implLocalNeighborMedian(arr, i) {
  const vals = [];
  const from = Math.max(0, i - 2);
  const to   = Math.min(arr.length - 1, i + 2);
  for (let j = from; j <= to; j++) {
    if (j === i) continue;
    const v = arr[j];
    if (v == null || isNaN(v)) continue;
    vals.push(v);
  }
  if (vals.length === 0) return null;
  vals.sort(function (a, b) { return a - b; });
  const mid = Math.floor(vals.length / 2);
  return (vals.length % 2 === 0)
    ? (vals[mid - 1] + vals[mid]) / 2
    : vals[mid];
}
```

---

## Neue Prüfung — Trend (MED-EL und AB)

Nach den bestehenden `_implCheck…`-Funktionen folgende Funktion
einfügen:

```js
function _implCheckHzTrendMedelAb(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  if (s.manufacturer !== 'medel' && s.manufacturer !== 'ab') return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  // Versatz-Array vorbereiten: Cent-Differenz zwischen
  // eigen_i und default_i, nur für User-Override und aktive
  // (nicht deaktivierte) Elektroden. Sonst null.
  const versatz = new Array(s.nEl).fill(null);
  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;
    const eigen = s.elFreqOwn[i];
    const def = s.freqs[i];
    if (!eigen || !def || eigen <= 0 || def <= 0) continue;
    versatz[i] = 1200 * Math.log2(eigen / def);
  }

  // Mindestens 3 Versatz-Werte erforderlich, damit ein lokaler
  // Median überhaupt aussagekräftig wird.
  let nVersatz = 0;
  for (let i = 0; i < versatz.length; i++) if (versatz[i] != null) nVersatz++;
  if (nVersatz < 3) return warnings;

  for (let i = 0; i < s.nEl; i++) {
    if (versatz[i] == null) continue;
    const trend = _implLocalNeighborMedian(versatz, i);
    if (trend == null) continue;
    const dev = Math.abs(versatz[i] - trend);

    let level = null;
    if (dev >= IMPL_VAL_HZ_TREND_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (dev >= IMPL_VAL_HZ_TREND_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    warnings.push({
      level: level,
      electrodeIdx: i,
      field: 'hz',
      messageKey: 'implValidateHzTrend',
      messageParams: {
        e: dENFn(i),
        dev: Math.round(dev),
        trend: Math.round(trend)
      }
    });
  }
  return warnings;
}
```

---

## Neue Prüfung — Lokaler Sprung (MED-EL und AB)

Direkt danach:

```js
function _implCheckHzJumpMedelAb(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  if (s.manufacturer !== 'medel' && s.manufacturer !== 'ab') return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl - 1; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (s.elSt && s.elSt[i + 1] === 'deactivated') continue;

    // Sprung-Prüfung nur, wenn mindestens eine der beiden
    // Elektroden einen User-Override hat — sonst sind die Werte
    // = Default und die Schrittweite stimmt per Konstruktion.
    const hasOverride = (s.elFreqOwn && s.elFreqOwn[i] != null)
                     || (s.elFreqOwn && s.elFreqOwn[i + 1] != null);
    if (!hasOverride) continue;

    const hzI = (s.elFreqOwn && s.elFreqOwn[i]     != null) ? s.elFreqOwn[i]     : s.freqs[i];
    const hzJ = (s.elFreqOwn && s.elFreqOwn[i + 1] != null) ? s.elFreqOwn[i + 1] : s.freqs[i + 1];
    if (!hzI || !hzJ || hzI <= 0 || hzJ <= 0) continue;
    if (!s.freqs[i] || !s.freqs[i + 1]) continue;

    const stepUser  = 1200 * Math.log2(hzJ / hzI);
    const stepDef   = 1200 * Math.log2(s.freqs[i + 1] / s.freqs[i]);
    const dev = Math.abs(stepUser - stepDef);

    let level = null;
    if (dev >= IMPL_VAL_HZ_JUMP_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (dev >= IMPL_VAL_HZ_JUMP_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    // Markiert die rechte Elektrode des Paars (E_{i+1}), weil
    // die Lesart "der Sprung zu dieser Elektrode ist verdächtig"
    // intuitiv ist.
    warnings.push({
      level: level,
      electrodeIdx: i + 1,
      field: 'hz',
      messageKey: 'implValidateHzJump',
      messageParams: {
        eI:       dENFn(i),
        eJ:       dENFn(i + 1),
        stepUser: Math.round(stepUser),
        stepDef:  Math.round(stepDef),
        dev:      Math.round(dev)
      }
    });
  }
  return warnings;
}
```

---

## Aufrufe in `validateImplantTable`

Den bestehenden Aufruf-Block aus BA 135:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
```

um zwei weitere Zeilen ergänzen:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));
```

---

## i18n-Keys in `i18n/de.js`

Nach `implValidateHzCochlearLookup` (aus BA 135) folgende zwei
Keys ergänzen:

```js
    implValidateHzTrend: "E{e}: Cent-Versatz vom Standard weicht {dev} Cent vom Nachbar-Trend ({trend} Cent) ab — könnte ein Eingabefehler sein",
    implValidateHzJump: "Sprung E{eI}→E{eJ}: {stepUser} Cent (Standard wäre {stepDef} Cent, Abweichung {dev} Cent)",
```

**Nur Deutsch.** en/fr/es kommen am Ende der Reihe.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im Abschnitt „Plausibilitätsprüfung der User-Eingaben" → „Hz-
Prüfungen (Stand BA 135)" die Überschrift auf „(Stand BA 137)"
anpassen und folgende zwei Punkte am Ende der Liste ergänzen:

```markdown
- **Trend-Abweichung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB und mindestens 3 User-Override-Werten in der
  Hz-eigen-Spalte. Für jeden Override wird der Cent-Versatz vom
  Default berechnet; der Trend an dieser Elektrode ist der
  Median der Versatzwerte der Nachbarn (Fenster ±2, ohne i
  selbst). Abweichung vom Trend ≥ 300 Cent → Level 3 gelb,
  ≥ 600 Cent → Level 2 orange.
- **Lokaler Sprung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB. Vergleich der Cent-Schrittweite zwischen
  benachbarten Elektroden (mit mindestens einem Override im
  Paar) gegen die Default-Schrittweite an dieser Stelle.
  Abweichung ≥ 400 Cent → Level 3 gelb, ≥ 700 Cent → Level 2
  orange. Warnung markiert das rechte Feld des Paars.
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` ergänzen: neue Konstanten
`IMPL_VAL_HZ_JUMP_YELLOW_CENT` (400) und
`IMPL_VAL_HZ_JUMP_ORANGE_CENT` (700); neuer Helfer
`_implLocalNeighborMedian` (Fenster ±2 um i, ohne i selbst);
neue Prüfungen `_implCheckHzTrendMedelAb` und
`_implCheckHzJumpMedelAb` (beide nur für MED-EL/AB aktiv).

---

## Akzeptanztest

Im Browser. Voraussetzung: Hersteller auf MED-EL oder AB
gestellt.

### Trend-Prüfung

1. **Unter Aktivierungsschwelle**: nur **zwei** Hz-eigen-Werte
   eintragen (z. B. E3 und E8 leicht abweichend). Erwartung:
   **keine** Trend-Warnung — Mindestanzahl 3 nicht erreicht.
2. **Konsistente Verschiebung**: bei MED-EL bei E3, E4, E5, E6
   jeweils Hz-eigen so setzen, dass alle ca. +500 Cent über
   dem Standard liegen. Erwartung: **keine** Trend-Warnung —
   der Trend ist gleichmäßig, kein Ausreißer.
3. **Ein Ausreißer**: bei E5 (vorherige Schritte beibehalten)
   den Wert so setzen, dass er stattdessen ca. +1000 Cent über
   Standard liegt. Erwartung: gelbe Warnung an E5, Text etwa
   „E5: Cent-Versatz vom Standard weicht ca. 500 Cent vom
   Nachbar-Trend (+500 Cent) ab".
4. **Starker Ausreißer**: E5 noch weiter verschieben, so dass
   die Abweichung vom Trend ≥ 600 Cent ist. Erwartung: orange
   Warnung statt gelb.
5. **Reset**: E5 wieder auf den +500-Cent-Wert setzen. Warnung
   verschwindet.

### Sprung-Prüfung

6. **Kein Override**: alle Hz-eigen-Spalten leer (nur Defaults).
   Erwartung: **keine** Sprung-Warnung — Schrittweiten = Default.
7. **Override innerhalb Toleranz**: bei MED-EL E5 (Default
   ~836 Hz) Hz-eigen auf 1000 setzen (Standardsprung E4→E5 ist
   ca. 636 Cent, mit Override wäre Sprung E4→E5 etwas anders).
   Wenn die Abweichung < 400 Cent ist: **keine** Warnung.
8. **Sprung-Warnung gelb**: E5 Hz-eigen auf ~1700 Hz setzen
   (etwa Faktor 2 vs. Default), sodass die Sprung-Abweichung zu
   E4 deutlich >400 Cent wird. Erwartung: gelbe Warnung am
   Hz-Feld von E5, Text „Sprung E4→E5: …".
9. **Sprung-Warnung orange**: E5 Hz-eigen auf einen Wert, der
   den Sprung zu E4 um >700 Cent vom Default abweichen lässt.
   Erwartung: orange Warnung am Hz-Feld von E5.

### Hersteller-Spezifik

10. **Cochlear ausgenommen**: Hersteller auf Cochlear setzen,
    dieselben Hz-eigen-Werte eintragen, die bei MED-EL Trend-
    oder Sprung-Warnungen produzieren würden. Erwartung:
    **keine** Trend- oder Sprung-Warnung (die beiden Prüfungen
    sind nicht aktiv); ggf. greift stattdessen der Cochlear-
    Lookup aus BA 135.

### Status und Robustheit

11. **Deaktivierte Elektroden ausgenommen**: bei MED-EL E5 auf
    Status „im CI deaktiviert" stellen, dann Hz-eigen bei E5
    auf einen extrem abweichenden Wert. Erwartung: **keine**
    Trend- oder Sprung-Warnung an E5.
12. **Sprung über deaktivierte Elektrode**: E5 deaktiviert, bei
    E4 und E6 jeweils Hz-eigen-Werte setzen. Erwartung: der
    Sprung E4→E5 und E5→E6 wird aus der Prüfung ausgeschlossen
    (Wegfall durch Deaktivierungs-Filter). Damit gibt es keine
    „Sprung-über-Lücke"-Warnung — das ist gewollt.
13. **Sprachwechsel**: Englisch → Deutsch. Trend- und Sprung-
    Warnungen erscheinen in Deutsch.
14. **Konsole**: keine neuen Fehler oder Warnungen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der vierzehn Akzeptanzpunkte
einzeln durchgehen und für jeden melden: erfüllt / nicht
erfüllt / unklar, mit Datei- und Zeilenangabe. Bei „unklar"
Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "_implCheckHzTrendMedelAb" js/implant-validate.js`
  → zwei Treffer (Definition + Aufruf).
- `grep -n "_implCheckHzJumpMedelAb" js/implant-validate.js`
  → zwei Treffer.
- `grep -n "_implLocalNeighborMedian" js/implant-validate.js`
  → zwei Treffer (Definition + Nutzung in
  `_implCheckHzTrendMedelAb`).
- `grep -n "IMPL_VAL_HZ_JUMP_YELLOW_CENT" js/implant-validate.js`
  → mindestens zwei Treffer.
- `grep -n "IMPL_VAL_HZ_JUMP_ORANGE_CENT" js/implant-validate.js`
  → mindestens zwei Treffer.
- `grep -n "implValidateHzTrend\b" i18n/de.js` → ein Treffer.
- `grep -n "implValidateHzJump\b" i18n/de.js` → ein Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.137-beta"`.

**Vier-Augen-Check für Schwellwerte** (Lessons learned):

- Schwellen 300 und 600 (Trend) sind dieselben Konstanten wie
  in BA 135 — `IMPL_VAL_HZ_TREND_YELLOW_CENT` und
  `IMPL_VAL_HZ_TREND_ORANGE_CENT`, hier nur referenziert.
- Schwellen 400 und 700 (Sprung) müssen sich in genau dieser
  Form in den **neuen** Konstanten
  `IMPL_VAL_HZ_JUMP_YELLOW_CENT` und
  `IMPL_VAL_HZ_JUMP_ORANGE_CENT` wiederfinden.
- Hersteller-Filter `s.manufacturer !== 'medel' && s.manufacturer !== 'ab'`
  ist eine **UND**-Verknüpfung (mit return), damit beide
  ausgeschlossen werden, wenn Hersteller etwas anderes ist.
- Mindestanzahl 3 für Trend-Prüfung ist eine **strenge**
  Untergrenze (`< 3` führt zu Rückgabe), nicht `<= 3`.

---

## Hinweise

- Damit ist die Hz-Plausibilitätsprüfung architektonisch
  vollständig — Range, Größenordnung und Monotonie (BA 133/134)
  universell, Cochlear-Lookup (BA 135) hersteller-spezifisch,
  Trend und lokale Sprünge (BA 137) für MED-EL/AB. Cochlear
  hat keine Trend/Sprung-Prüfung, weil dort der Lookup die
  konzeptuell stimmigere Referenz ist.
- **Kein Bau-Diagnose-Test nötig** — Akzeptanz ist durch das
  gezielte Eintragen konkreter Werte visuell direkt prüfbar.
- Nächste Anleitungen:
  - BA 138: THR/Upper-Level-Plausibilität (Wertebereich pro
    Hersteller, THR ≥ Upper-Konflikt, MAD-Ausreißer).
  - BA 139: FAT-Sonderprüfung bei Deaktivierung (globaler vs.
    lokaler Umverteilungs-Test).
  - BA 140: globale Parameter (c-Wert, IDR, IIDR).
  - BA 141: i18n en/fr/es nachziehen.
