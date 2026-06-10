# BAUANLEITUNG 134 — Hz Range + Größenordnungs-Prüfung

## Ziel

Zwei weitere Hz-Plausibilitätsprüfungen ergänzen, universell für
alle drei Hersteller. Beide arbeiten auf den **vom User
eingetragenen** Hz-eigen-Werten — Default-Werte werden nicht
geprüft.

- **Range-Check (Level 1, rot)**: Hz-eigen außerhalb des
  hersteller-spezifischen Software-Bereichs.
- **Größenordnungs-Check (Level 2, orange)**: Hz-eigen weicht um
  Faktor ≥5 oder ≤1/5 vom Default an derselben Elektrode ab —
  klassischer Tippfehler-Verdacht (Komma vergessen, Null zuviel).

Aufsetzend auf BA 133 (Grundgerüst + Monotonie). Aufbau und
Render-Pfad bleiben unverändert; nur neue `_implCheck…`-Funktionen
und neue i18n-Keys.

## Begründung

Range und Größenordnung sind die einfachsten und treffsichersten
Plausibilitätschecks: sie melden eindeutige Eingabefehler ohne
Falschalarme bei realistischen Anpassungen. Hersteller-spezifische
Trend- und Lookup-Prüfungen folgen in BA 135 ff.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.133-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.134-beta";
```

---

## Neue Konstanten in `js/implant-validate.js`

Direkt nach der Block-Definition der Level-Konstanten
(`IMPL_VAL_LEVEL_RED` etc.) folgenden Block einfügen:

```js
// Hz-Software-Range pro Hersteller.
//   MED-EL: 70–8500 Hz (MAESTRO Kap. 24.6, FS/FSP-Strategien).
//   Cochlear: 63–18938 Hz (umfassender LFE/HFE-Bereich aus
//             CI Select Manual; Standard-Range ist enger, aber
//             jeder Wert in diesem Intervall ist erreichbar).
//   AB: 250–8700 Hz (Extended Low Filter Default aus SoundWave
//       Quick Reference S. 37).
const IMPL_VAL_HZ_RANGE = {
  medel:    { min: 70,  max: 8500  },
  cochlear: { min: 63,  max: 18938 },
  ab:       { min: 250, max: 8700  }
};

// Größenordnungs-Schwelle (Tippfehler-Verdacht):
//   ratio = eigen / default; warnt, wenn ratio >= 5 oder <= 0.2.
const IMPL_VAL_HZ_MAGNITUDE_FACTOR = 5;
```

---

## Neue Prüfungen in `js/implant-validate.js`

Nach der bestehenden `_implCheckHzMonotonie`-Funktion folgende
zwei Funktionen einfügen:

```js
function _implCheckHzRange(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;
  const mfr = s.manufacturer;
  const range = IMPL_VAL_HZ_RANGE[mfr];
  if (!range) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    // Nur User-Override prüfen, nicht Default.
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const hz = s.elFreqOwn[i];
    if (hz < range.min || hz > range.max) {
      warnings.push({
        level: IMPL_VAL_LEVEL_RED,
        electrodeIdx: i,
        field: 'hz',
        messageKey: 'implValidateHzRange',
        messageParams: {
          e: dENFn(i),
          hz: Math.round(hz),
          min: range.min,
          max: range.max
        }
      });
    }
  }
  return warnings;
}

function _implCheckHzMagnitude(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.freqs) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };
  const fac = IMPL_VAL_HZ_MAGNITUDE_FACTOR;

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const eigen = s.elFreqOwn[i];
    const def = s.freqs[i];
    if (!def || def <= 0) continue;

    const ratio = eigen / def;
    if (ratio >= fac || ratio <= (1 / fac)) {
      warnings.push({
        level: IMPL_VAL_LEVEL_ORANGE,
        electrodeIdx: i,
        field: 'hz',
        messageKey: 'implValidateHzMagnitude',
        messageParams: {
          e: dENFn(i),
          hz: Math.round(eigen),
          def: Math.round(def),
          ratio: ratio >= 1 ? Math.round(ratio) : '1/' + Math.round(1 / ratio)
        }
      });
    }
  }
  return warnings;
}
```

---

## Aufrufe in `validateImplantTable`

In der Funktion `validateImplantTable` die bestehende Zeile

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
```

um zwei weitere Aufrufe ergänzen, sodass der Block so aussieht:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
```

Reihenfolge ist nicht semantisch relevant — Sortierung nach
Level erfolgt im Render-Schritt.

---

## i18n-Keys in `i18n/de.js`

Nach `implValidateHzMonotonie` (aus BA 133) folgende zwei Keys
einfügen:

```js
    implValidateHzRange: "E{e} ({hz} Hz) liegt außerhalb des erlaubten Bereichs ({min}–{max} Hz)",
    implValidateHzMagnitude: "E{e}: eigener Wert {hz} Hz ist ca. {ratio}× vom Standard ({def} Hz) entfernt — Tippfehler?",
```

**Nur Deutsch.** en/fr/es werden in der Sammel-Übersetzungs-
Anleitung am Ende der Reihe nachgezogen.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im in BA 133 angelegten Abschnitt „Plausibilitätsprüfung der
User-Eingaben" am Ende ergänzen:

```markdown
### Hz-Prüfungen (Stand BA 134)

Geprüft werden nur User-Override-Werte (`elFreqOwn[i] != null`),
nicht die Default-Werte aus `MFR[mfr].freqs`. Deaktivierte
Elektroden (Status „im CI deaktiviert") sind ausgenommen.

- **Monotonie** (BA 133, Level 1 rot): die Hz-Reihe sollte
  aufsteigend mit dem Elektroden-Index sein. Verletzung wird an
  der zweiten beteiligten Elektrode markiert.
- **Range** (BA 134, Level 1 rot): Hz innerhalb der hersteller-
  spezifischen Software-Grenzen. MED-EL 70–8500 Hz, Cochlear
  63–18938 Hz, AB 250–8700 Hz.
- **Größenordnung** (BA 134, Level 2 orange): Hz-eigen weicht um
  Faktor ≥5 oder ≤1/5 vom Default an derselben Elektrode ab —
  typischer Tippfehler (Komma vergessen, Null zuviel).

Trend-basierte und hersteller-spezifische Verteilungs-Prüfungen
folgen in BA 135 (Cochlear-FAT-Lookup) und BA 136 (MED-EL/AB
Trend und lokale Sprünge).
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` den Zusatz aktualisieren —
statt „BA 133: nur Hz-Monotonie als erste Prüfung implementiert"
nun:

```
BA 133–134 implementiert: Hz-Monotonie (Level 1), Hz-Range
(Level 1, Konstante IMPL_VAL_HZ_RANGE pro Hersteller),
Hz-Größenordnung (Level 2, Faktor 5 gegen Default).
```

---

## Akzeptanztest

Im Browser, jeweils auf einer Seite mit dem genannten Hersteller:

1. **MED-EL Range-Check (oberhalb)**: Hz-eigen bei E5 auf 99999
   setzen. Erwartung: Feld bekommt **roten Rand**; in der Warnbox
   erscheint Text „E5 (99999 Hz) liegt außerhalb des erlaubten
   Bereichs (70–8500 Hz)".
2. **MED-EL Range-Check (unterhalb)**: Hz-eigen bei E5 auf 50
   setzen. Erwartung: dieselbe Warnung, mit aktualisiertem Hz-Wert.
3. **MED-EL Größenordnungs-Check**: Hz-eigen bei E5 auf 10000
   (Default ca. 836 Hz, Faktor ~12). Erwartung: **oranger Rand**,
   Tooltip „E5: eigener Wert 10000 Hz ist ca. 12× vom Standard
   (836 Hz) entfernt — Tippfehler?". In der Warnbox entsprechende
   orange Zeile.
4. **MED-EL Größenordnung umgekehrt**: Hz-eigen bei E5 auf 50.
   Erwartung: Range-Warnung **und** Größenordnungs-Warnung (Faktor
   1/17). Feld ist rot (strengere Stufe gewinnt für den Rand), Box
   listet aber beide Warnungen separat.
5. **Wert löschen**: E5 Hz-eigen leeren. Erwartung: alle E5-
   Warnungen verschwinden, Rand weg.
6. **Cochlear Range-Check**: Hersteller auf Cochlear, Hz-eigen bei
   E11 auf 50 setzen → rote Warnung. Auf 19000 setzen → rote
   Warnung. Auf 100 setzen → keine Range-Warnung (innerhalb 63–
   18938), aber wahrscheinlich Größenordnungs-Warnung (Default an
   E11 ca. 1938 Hz, ratio 1/19).
7. **AB Range-Check**: Hersteller auf AB, Hz-eigen bei E5 auf 100
   setzen. Erwartung: rote Warnung (außerhalb 250–8700).
8. **Default-Werte unauffällig**: alle Hz-eigen leeren, Tabelle
   zeigt nur Defaults. Erwartung: keine Range- oder
   Größenordnungs-Warnung; die Box zeigt „Keine Auffälligkeiten"
   (sofern auch keine Monotonie-Verletzung vorliegt).
9. **Deaktivierte Elektroden ausgenommen**: E5 auf Status „im CI
   deaktiviert" stellen, dann Hz-eigen bei E5 auf 99999. Erwartung:
   **keine** Warnung, weil deaktivierte Elektroden aus der
   Prüfung ausgeschlossen sind.
10. **Sprachwechsel**: Englisch → Deutsch. Die neuen Warnungen
    erscheinen in Deutsch (en zeigt noch den deutschen Default-
    Text, wie in BA 133).
11. **Konsole**: keine neuen Fehler oder Warnungen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der elf Akzeptanzpunkte einzeln
durchgehen und für jeden melden: erfüllt / nicht erfüllt /
unklar, mit Datei- und Zeilenangabe. Bei „unklar" Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "IMPL_VAL_HZ_RANGE" js/implant-validate.js` → mindestens
  zwei Treffer (Definition + Nutzung in `_implCheckHzRange`).
- `grep -n "_implCheckHzRange\b" js/implant-validate.js` →
  Definition + Aufruf, also zwei Treffer.
- `grep -n "_implCheckHzMagnitude\b" js/implant-validate.js` →
  Definition + Aufruf, zwei Treffer.
- `grep -n "implValidateHzRange" i18n/de.js` → ein Treffer.
- `grep -n "implValidateHzMagnitude" i18n/de.js` → ein Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.134-beta"`.

**Vier-Augen-Check für Schwellwerte** (Lesson learned aus
Leitlinien): die in dieser Anleitung genannten Werte müssen sich
unverändert im Code wiederfinden. Konkret:

- Range-Werte 70/8500 (MED-EL), 63/18938 (Cochlear), 250/8700 (AB)
  → in `IMPL_VAL_HZ_RANGE` exakt so.
- Faktor 5 → in `IMPL_VAL_HZ_MAGNITUDE_FACTOR` exakt so.

---

## Hinweise

- Reine Erweiterung des Validators. Keine UI-Architektur-
  Änderung, kein Layout-Eingriff. Die Warnungen erscheinen
  automatisch in der schon vorhandenen Warnbox.
- **Kein Bau-Diagnose-Test nötig** — die Akzeptanz ist visuell
  und durch das Eintragen konkreter Werte direkt prüfbar.
- BA 135 baut darauf auf: Cochlear-FAT-Tabellen als eigene Daten-
  Datei `js/data/cochlear-fats.js`, Lookup-Logik gegen diese
  Tabellen. BA 136 ergänzt MED-EL/AB Trend- und Sprung-Prüfung.
