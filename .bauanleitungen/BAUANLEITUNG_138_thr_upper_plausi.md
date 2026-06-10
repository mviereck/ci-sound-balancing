# BAUANLEITUNG 138 — THR/Upper-Level-Plausibilität

## Ziel

Plausibilitätsprüfung der zweiten Datenebene im Implantat-Reiter:
THR (Hörschwelle) und Upper Level (MCL/C-Level/M-Level). Vier
neue Prüfungen, alle drei Auffälligkeits-Stufen:

- **Wertebereich** (Level 1, rot): THR bzw. Upper außerhalb der
  hersteller-spezifischen Hardware-Grenzen.
- **THR ≥ Upper Level** (Level 1, rot): physiologisch unmöglich,
  vermutlich Spalten vertauscht. Beide Felder bekommen den Rand,
  ein Box-Eintrag.
- **Größenordnung gegen Spaltenmedian** (Level 2, orange):
  Faktor ≥10 oder ≤1/10 — klassischer Komma-Tippfehler.
  Aktivierungsschwelle: ≥3 Werte in der Spalte.
- **MAD-Ausreißer** (Level 3, gelb): |x − median| > 3·MAD.
  Aktivierungsschwelle: ≥5 Werte in der Spalte. Bei Elektroden
  mit „verrauscht"-Status (noisyLess/More/Heavy, almostMute,
  mute) deaktiviert — abweichende Werte sind dort erwartet.

Außerdem **Schema-Erweiterung**: `field` im Warnungs-Objekt darf
ein String oder ein Array sein, damit eine Warnung mehrere Felder
markieren kann (THR + Upper bei Konflikt).

Setzt auf BA 133–137 auf.

## Begründung

THR und Upper Level sind unabhängig vom Hz-Wert, aber spaltenweise
korreliert und durch die Hersteller-Hardware limitiert. Die vier
Prüfungen fangen jeweils einen anderen Fehlertyp:
- Range → eindeutig falscher Wert (z. B. negativ, jenseits qu/CL/CU-Grenze).
- Konflikt → vertauschte Eingabe (THR-Spalte und Upper-Spalte verwechselt).
- Größenordnung → Komma vergessen (Wert in einer anderen Größenordnung als die Nachbarn).
- MAD → einzelner Ausreißer ohne Größenordnungs-Sprung, in einer sonst homogenen Spalte.

Schwellwerte und Aktivierungsschwellen sind aus Konzeptphase:
Faktor 10 für Größenordnung (konservativer als bei Hz, weil
THR/Upper-Werte ohnehin individuell variieren), MAD-Faktor 3
(Standard-Robustschwelle), Aktivierung 3 bzw. 5 (verhindert
Falschalarm bei unvollständigen Eingaben).

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.137-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.138-beta";
```

---

## Neue Konstanten in `js/implant-validate.js`

Nach den Hz-Konstanten (`IMPL_VAL_HZ_JUMP_*`) folgenden Block
ergänzen:

```js
// THR/Upper-Level Wertebereiche pro Hersteller (Hardware-Limits).
//   MED-EL: MCL maximal 268,6 qu (Berechnungsgrundlagen dB zu CI.md
//           Kap. 3.1); THR identische Hardware-Grenze, real meist
//           viel niedriger. Bereich konservativ 0–268.6.
//   Cochlear: T-Level und C-Level als 8-bit-Skala 0–255 CL.
//   AB: M-Level/T-Level in CU; keine harte öffentlich dokumentierte
//       Grenze, typischer klinischer Bereich 0–600. Hard-Cap
//       pragmatisch auf 1000 gesetzt.
const IMPL_VAL_THR_UPPER_RANGE = {
  medel:    { thr: { min: 0, max: 268.6 }, upper: { min: 0, max: 268.6 } },
  cochlear: { thr: { min: 0, max: 255   }, upper: { min: 0, max: 255   } },
  ab:       { thr: { min: 0, max: 1000  }, upper: { min: 0, max: 1000  } }
};

// Größenordnungs-Schwelle für THR/Upper (Tippfehler):
//   Wert weicht um Faktor 10 vom Spaltenmedian ab.
const IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR = 10;

// MAD-Schwelle für THR/Upper-Ausreißer:
//   |x − median| > MAD_FACTOR · MAD wird als Ausreißer markiert.
const IMPL_VAL_THR_UPPER_MAD_FACTOR = 3;

// Aktivierungsschwellen:
//   Größenordnung greift ab MIN_MAGNITUDE Werten,
//   MAD-Ausreißer ab MIN_MAD Werten in der Spalte.
const IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE = 3;
const IMPL_VAL_THR_UPPER_MIN_FOR_MAD = 5;

// Status, bei denen die MAD-Ausreißer-Prüfung für THR/Upper einer
// Elektrode ausgesetzt wird (erwartet abweichende Werte).
const IMPL_VAL_STATUS_TOLERANT = ['noisyLess', 'noisyMore', 'noisyHeavy', 'almostMute', 'mute'];
```

---

## Neue Helfer in `js/implant-validate.js`

Im Helfer-Bereich (vor `_implMsg`, also nach `_implEffFreqOf`)
folgenden Block einfügen:

```js
function _implThrOf(s, i) {
  if (!s || !s.implant || !s.implant.thr) return null;
  const v = s.implant.thr[i];
  return (v == null || isNaN(v)) ? null : v;
}

function _implUpperOf(s, i) {
  if (!s || !s.implant) return null;
  const arr = (s.manufacturer === 'medel')
    ? s.implant.mcl
    : s.implant.upperLevel;
  if (!arr) return null;
  const v = arr[i];
  return (v == null || isNaN(v)) ? null : v;
}

function _implIsTolerantStatus(s, i) {
  if (!s || !s.elSt) return false;
  return IMPL_VAL_STATUS_TOLERANT.indexOf(s.elSt[i]) >= 0;
}

// Sammelt alle nicht-deaktivierten, gültigen Werte einer Spalte.
function _implCollectColumnValues(s, getterFn) {
  const vals = [];
  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    const v = getterFn(s, i);
    if (v != null && !isNaN(v)) vals.push(v);
  }
  return vals;
}

function _implMedian(arr) {
  if (!arr || arr.length === 0) return null;
  const sorted = arr.slice().sort(function (a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  return (sorted.length % 2 === 0)
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function _implMAD(arr, median) {
  if (!arr || arr.length === 0 || median == null) return null;
  const devs = arr.map(function (v) { return Math.abs(v - median); });
  return _implMedian(devs);
}
```

---

## Schema-Erweiterung in `_implApplyFieldLevel`

Im bestehenden Header-Kommentar des Moduls (Z. 12–20) die
Schema-Beschreibung anpassen — die Zeile

```
//     field:        'hz' | 'thr' | 'upper'  (optional),
```

ersetzen durch:

```
//     field:        'hz' | 'thr' | 'upper' oder Array davon
//                   (optional, ein Warning kann mehrere Felder markieren),
```

Die Funktion `_implApplyFieldLevel` (aktuell etwa Z. 86–106)
**vollständig ersetzen** durch:

```js
function _implApplyFieldLevel(w) {
  if (w.electrodeIdx == null || !w.field) return;
  const fields = Array.isArray(w.field) ? w.field : [w.field];

  fields.forEach(function (field) {
    const sel = _implFieldSelector(w.electrodeIdx, field);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;

    // Strengste Stufe (kleinste level-Nr) gewinnt.
    const currentLevel =
      el.classList.contains('impl-warn-red') ? 1 :
      el.classList.contains('impl-warn-orange') ? 2 :
      el.classList.contains('impl-warn-yellow') ? 3 : 99;
    if (w.level >= currentLevel) return;

    el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
    const newClass =
      w.level === 1 ? 'impl-warn-red' :
      w.level === 2 ? 'impl-warn-orange' : 'impl-warn-yellow';
    el.classList.add(newClass);
    el.title = _implMsg(w);
  });
}
```

---

## Neue Prüfungen in `js/implant-validate.js`

Nach `_implCheckHzJumpMedelAb` (Ende der bestehenden Hz-Prüfungs-
Reihe) folgende vier Funktionen einfügen:

```js
function _implCheckThrUpperRange(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const ranges = IMPL_VAL_THR_UPPER_RANGE[s.manufacturer];
  if (!ranges) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;

    const thr = _implThrOf(s, i);
    if (thr != null && (thr < ranges.thr.min || thr > ranges.thr.max)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'thr',
        messageKey: 'implValidateThrRange',
        messageParams: {
          e: dENFn(i),
          val: thr,
          min: ranges.thr.min,
          max: ranges.thr.max
        }
      });
    }

    const upper = _implUpperOf(s, i);
    if (upper != null && (upper < ranges.upper.min || upper > ranges.upper.max)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'upper',
        messageKey: 'implValidateUpperRange',
        messageParams: {
          e: dENFn(i),
          val: upper,
          min: ranges.upper.min,
          max: ranges.upper.max
        }
      });
    }
  }
  return warnings;
}

function _implCheckThrUpperConflict(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    const thr   = _implThrOf(s, i);
    const upper = _implUpperOf(s, i);
    if (thr == null || upper == null) continue;
    if (thr >= upper) {
      // Ein Warning, beide Felder markiert (Schema-Erweiterung).
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: ['thr', 'upper'],
        messageKey: 'implValidateThrUpperConflict',
        messageParams: { e: dENFn(i), thr: thr, upper: upper }
      });
    }
  }
  return warnings;
}

function _implCheckThrUpperMagnitude(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const fac = IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  const colsToCheck = [
    { getter: _implThrOf,   field: 'thr',   msgKey: 'implValidateThrMagnitude' },
    { getter: _implUpperOf, field: 'upper', msgKey: 'implValidateUpperMagnitude' }
  ];

  colsToCheck.forEach(function (col) {
    const vals = _implCollectColumnValues(s, col.getter);
    if (vals.length < IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE) return;
    const med = _implMedian(vals);
    if (med == null || med <= 0) return;

    for (let i = 0; i < s.nEl; i++) {
      if (s.elSt && s.elSt[i] === 'deactivated') continue;
      const v = col.getter(s, i);
      if (v == null) continue;
      const ratio = v / med;
      if (ratio >= fac || ratio <= (1 / fac)) {
        warnings.push({
          level: IMPL_VAL_LEVEL_ORANGE,
          electrodeIdx: i,
          field: col.field,
          messageKey: col.msgKey,
          messageParams: {
            e: dENFn(i),
            val: v,
            median: Math.round(med * 10) / 10,
            ratio: ratio >= 1 ? Math.round(ratio) : '1/' + Math.round(1 / ratio)
          }
        });
      }
    }
  });
  return warnings;
}

function _implCheckThrUpperMAD(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const fac = IMPL_VAL_THR_UPPER_MAD_FACTOR;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  const colsToCheck = [
    { getter: _implThrOf,   field: 'thr',   msgKey: 'implValidateThrMAD' },
    { getter: _implUpperOf, field: 'upper', msgKey: 'implValidateUpperMAD' }
  ];

  colsToCheck.forEach(function (col) {
    const vals = _implCollectColumnValues(s, col.getter);
    if (vals.length < IMPL_VAL_THR_UPPER_MIN_FOR_MAD) return;
    const med = _implMedian(vals);
    const mad = _implMAD(vals, med);
    if (med == null || mad == null || mad <= 0) return;
    const threshold = fac * mad;

    for (let i = 0; i < s.nEl; i++) {
      if (s.elSt && s.elSt[i] === 'deactivated') continue;
      if (_implIsTolerantStatus(s, i)) continue;
      const v = col.getter(s, i);
      if (v == null) continue;
      const dev = Math.abs(v - med);
      if (dev > threshold) {
        warnings.push({
          level: IMPL_VAL_LEVEL_YELLOW,
          electrodeIdx: i,
          field: col.field,
          messageKey: col.msgKey,
          messageParams: {
            e:      dENFn(i),
            val:    v,
            median: Math.round(med * 10) / 10,
            dev:    Math.round(dev * 10) / 10
          }
        });
      }
    }
  });
  return warnings;
}
```

---

## Aufrufe in `validateImplantTable`

Den bestehenden Aufruf-Block (aus BA 137):

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));
```

um vier weitere Zeilen ergänzen:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));
  warnings.push.apply(warnings, _implCheckThrUpperRange(s));
  warnings.push.apply(warnings, _implCheckThrUpperConflict(s));
  warnings.push.apply(warnings, _implCheckThrUpperMagnitude(s));
  warnings.push.apply(warnings, _implCheckThrUpperMAD(s));
```

---

## i18n-Keys in `i18n/de.js`

Nach `implValidateHzJump` (aus BA 137) folgende sieben Keys
einfügen:

```js
    implValidateThrRange: "E{e}: THR ({val}) liegt außerhalb des erlaubten Bereichs ({min}–{max})",
    implValidateUpperRange: "E{e}: Upper Level ({val}) liegt außerhalb des erlaubten Bereichs ({min}–{max})",
    implValidateThrUpperConflict: "E{e}: THR ({thr}) liegt über Upper Level ({upper}) — Spalten vermutlich vertauscht",
    implValidateThrMagnitude: "E{e}: THR ({val}) ist ca. {ratio}× vom Spaltenmedian ({median}) entfernt — Tippfehler?",
    implValidateUpperMagnitude: "E{e}: Upper Level ({val}) ist ca. {ratio}× vom Spaltenmedian ({median}) entfernt — Tippfehler?",
    implValidateThrMAD: "E{e}: THR ({val}) weicht stark vom Median ({median}) ab (Abweichung {dev})",
    implValidateUpperMAD: "E{e}: Upper Level ({val}) weicht stark vom Median ({median}) ab (Abweichung {dev})",
```

**Nur Deutsch.** en/fr/es kommen am Ende der Reihe.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im Abschnitt „Plausibilitätsprüfung der User-Eingaben" nach
dem Hz-Block einen neuen Unter-Abschnitt anfügen:

```markdown
### THR/Upper-Level-Prüfungen (Stand BA 138)

Geprüft werden `s.implant.thr[i]` und `s.implant.mcl[i]` (MED-EL)
bzw. `s.implant.upperLevel[i]` (Cochlear/AB) für aktive
(nicht-deaktivierte) Elektroden.

- **Wertebereich** (BA 138, Level 1 rot): außerhalb hersteller-
  spezifischer Hardware-Grenzen (`IMPL_VAL_THR_UPPER_RANGE`).
  MED-EL THR/MCL 0–268.6 qu, Cochlear 0–255 CL, AB 0–1000 CU.
- **THR ≥ Upper-Level-Konflikt** (BA 138, Level 1 rot):
  physiologisch unmöglich. Ein Warning markiert **beide** Felder
  derselben Zeile (THR und Upper) — Schema-Erweiterung: `field`
  kann String oder Array sein.
- **Größenordnung** (BA 138, Level 2 orange): Faktor ≥10 oder
  ≤1/10 gegen Spaltenmedian. Aktivierung ab 3 Werten in der
  Spalte.
- **MAD-Ausreißer** (BA 138, Level 3 gelb): |x − median| > 3·MAD.
  Aktivierung ab 5 Werten. Bei Elektroden mit Status `noisyLess`,
  `noisyMore`, `noisyHeavy`, `almostMute`, `mute` deaktiviert —
  abweichende Werte sind dort erwartet
  (`IMPL_VAL_STATUS_TOLERANT`).
```

Außerdem im Abschnitts-Anfang (nach „Drei Auffälligkeits-Stufen")
den Schema-Hinweis ergänzen:

```markdown
Ein Warning-Objekt darf in `field` einen String oder ein
String-Array enthalten — letzteres markiert mehrere Felder
derselben Elektrode gleichzeitig (verwendet beim THR/Upper-
Konflikt, BA 138).
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` ergänzen:

- `BA 133–138 implementiert: …` — neue Prüfungen
  `_implCheckThrUpperRange`, `_implCheckThrUpperConflict`,
  `_implCheckThrUpperMagnitude`, `_implCheckThrUpperMAD`.
- Neue Konstanten `IMPL_VAL_THR_UPPER_RANGE` (pro Hersteller),
  `IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR` (10),
  `IMPL_VAL_THR_UPPER_MAD_FACTOR` (3),
  `IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE` (3),
  `IMPL_VAL_THR_UPPER_MIN_FOR_MAD` (5),
  `IMPL_VAL_STATUS_TOLERANT` (Array).
- Neue Helfer `_implThrOf`, `_implUpperOf`, `_implIsTolerantStatus`,
  `_implCollectColumnValues`, `_implMedian`, `_implMAD`.
- **Schema-Erweiterung**: `field` in einem Warning kann String oder
  String-Array sein; `_implApplyFieldLevel` iteriert über alle
  Felder, strengste Stufe gewinnt pro Feld.

---

## Akzeptanztest

Im Browser, Implantat-Reiter. Voraussetzung: in der Tabelle THR-
und Upper-Werte für mehrere Elektroden eintragen (frei wählbar
für Standard-Tests). Stati zunächst alle „ok".

### Wertebereich (Range)

1. **MED-EL THR außerhalb (oberhalb)**: bei E5 THR auf 300
   setzen (Limit 268,6). Erwartung: roter Rand am THR-Feld
   von E5; Box-Eintrag „E5: THR (300) liegt außerhalb des
   erlaubten Bereichs (0–268.6)".
2. **MED-EL Upper außerhalb**: bei E5 MCL auf 350 setzen.
   Erwartung: roter Rand am Upper-Feld von E5 zusätzlich;
   eigener Box-Eintrag für Upper-Range.
3. **Cochlear Range**: Hersteller umstellen, bei einer
   Elektrode T-Level auf 300 (Limit 255) → roter Rand.
4. **Negativer Wert**: THR oder Upper auf -5 setzen. Erwartung:
   roter Rand (Range-Warnung, untere Grenze).

### THR ≥ Upper Level (Konflikt)

5. **Klarer Konflikt**: bei MED-EL E5 THR auf 150, MCL auf 100
   setzen. Erwartung: **beide Felder** (THR und MCL) bekommen
   einen roten Rand; **ein** Box-Eintrag „E5: THR (150) liegt
   über Upper Level (100) — Spalten vermutlich vertauscht".
6. **Gleichheit**: THR = Upper. Erwartung: gleiche Warnung
   (THR ≥ Upper schließt Gleichheit ein).
7. **THR < Upper (normal)**: THR auf 80, MCL auf 130 setzen.
   Erwartung: keine Konflikt-Warnung.

### Größenordnung (Magnitude)

8. **Aktivierungsschwelle unter 3**: nur **zwei** THR-Werte
   eintragen, einer davon extrem (z. B. 0.5 vs. 100). Erwartung:
   **keine** Größenordnungs-Warnung (zu wenige Werte für Median).
9. **Ab 3 Werten**: bei E3, E4, E5, E6 THR jeweils auf 80, 90,
   85, 95 setzen. Dann bei E7 THR auf 800. Erwartung: oranger
   Rand am THR-Feld von E7; Box-Text „E7: THR (800) ist ca.
   10× vom Spaltenmedian (~87.5) entfernt — Tippfehler?".
10. **Komma-Tippfehler**: bei E7 THR stattdessen auf 8.5 setzen
    (Faktor 0.1 → 1/10). Erwartung: gleiche Warnung mit
    „1/10" als ratio-Wert.

### MAD-Ausreißer

11. **Aktivierungsschwelle unter 5**: nur **vier** Werte eintragen,
    davon einer leicht abweichend. Erwartung: **keine** MAD-
    Warnung.
12. **Ab 5 Werten, Ausreißer**: bei E3–E7 THR jeweils auf 80,
    82, 78, 81, 79 setzen. Dann bei E8 THR auf 120. Erwartung:
    gelber Rand am THR-Feld von E8 (klarer MAD-Ausreißer); Box-
    Text „E8: THR (120) weicht stark vom Median (80) ab
    (Abweichung 40)".
13. **Status-Modifikation**: E8 zusätzlich auf Status „mittel
    verrauscht" (noisyMore) stellen. Erwartung: gelbe MAD-
    Warnung an E8 **verschwindet**. (Range/Konflikt/Größenordnung
    bleiben aktiv, falls zutreffend.)
14. **Status zurück**: E8 wieder auf „ok". Erwartung: gelbe
    MAD-Warnung kehrt zurück.

### Deaktivierte Elektroden

15. **Deaktivierte Elektrode**: bei E5 Status auf „im CI
    deaktiviert", dann THR auf 9999. Erwartung: **keine**
    Warnung — deaktivierte Elektroden sind aus allen vier
    THR/Upper-Prüfungen ausgenommen.

### Sprachwechsel und Konsole

16. **Sprachwechsel**: Englisch → Deutsch. Die neuen THR/Upper-
    Warnungstexte erscheinen in Deutsch (en/fr/es zeigen die
    deutschen Defaults).
17. **Konsole**: keine neuen Fehler beim Laden oder während
    der Tests.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der siebzehn Akzeptanzpunkte
einzeln durchgehen und für jeden melden: erfüllt / nicht
erfüllt / unklar, mit Datei- und Zeilenangabe. Bei „unklar"
Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "_implCheckThrUpperRange\|_implCheckThrUpperConflict\|_implCheckThrUpperMagnitude\|_implCheckThrUpperMAD" js/implant-validate.js`
  → vier Definitionen + vier Aufrufe = acht Treffer.
- `grep -n "_implThrOf\|_implUpperOf\|_implIsTolerantStatus\|_implCollectColumnValues\|_implMedian\|_implMAD" js/implant-validate.js`
  → jeweils mindestens zwei Treffer (Definition + Nutzung).
- `grep -n "IMPL_VAL_THR_UPPER_" js/implant-validate.js`
  → mindestens fünf Treffer (eine Konstante pro Wert: RANGE,
  MAGNITUDE_FACTOR, MAD_FACTOR, MIN_FOR_MAGNITUDE, MIN_FOR_MAD)
  jeweils Definition + Nutzung.
- `grep -n "IMPL_VAL_STATUS_TOLERANT" js/implant-validate.js`
  → mindestens zwei Treffer.
- `grep -n "Array.isArray(w.field)" js/implant-validate.js` →
  ein Treffer in `_implApplyFieldLevel`.
- `grep -n "implValidateThr\|implValidateUpper" i18n/de.js` →
  sieben Treffer (alle neuen Keys).
- `grep -n "APP_VERSION" js/version.js` → `"3.0.138-beta"`.

**Vier-Augen-Check für Schwellwerte** (Lessons learned):

- Hardware-Grenzen MED-EL 268.6, Cochlear 255, AB 1000 müssen
  sich exakt in `IMPL_VAL_THR_UPPER_RANGE` wiederfinden.
- Größenordnungs-Faktor 10 in `IMPL_VAL_THR_UPPER_MAGNITUDE_FACTOR`.
- MAD-Faktor 3 in `IMPL_VAL_THR_UPPER_MAD_FACTOR`.
- Aktivierungsschwellen 3 und 5 jeweils in eigener Konstante
  (`IMPL_VAL_THR_UPPER_MIN_FOR_MAGNITUDE` und
  `IMPL_VAL_THR_UPPER_MIN_FOR_MAD`) — **nicht** durch eine
  einzige Konstante ersetzen.
- Status-Liste in `IMPL_VAL_STATUS_TOLERANT` enthält genau
  fünf Werte: `noisyLess`, `noisyMore`, `noisyHeavy`,
  `almostMute`, `mute`. **Nicht** `deactivated` (das wird
  bereits eine Ebene früher abgefangen).

---

## Hinweise

- Damit ist die Plausibilitäts-Schiene für die drei
  Tabellen-Spalten (Hz, THR, Upper) komplett. BA 139 wird die
  FAT-Sonderprüfung bei Deaktivierung einbauen (globaler vs.
  lokaler Umverteilungs-Test, herstellerspezifische
  Bewertung), BA 140 die globalen Parameter (c-Wert, IDR,
  IIDR), BA 141 i18n en/fr/es.
- **Kein Bau-Diagnose-Test nötig** — Akzeptanz ist durch das
  gezielte Eintragen konkreter THR/Upper-Werte direkt prüfbar.
- **EDR-Ausreißer (Upper − THR drastisch anders als Median-
  EDR)** ist konzeptuell vorgesehen, aber nicht Teil dieser
  Anleitung. Kann später als zusätzliche `_implCheck…`-Funktion
  ergänzt werden, ohne Schema-Änderung.
