# BAUANLEITUNG 135 — Cochlear-FAT-Lookup

## Ziel

Hersteller-spezifische Hz-Plausibilitätsprüfung für Cochlear:
Vergleich der User-eingetragenen Hz-Werte mit der Cochlear-
Standard-FAT (Frequency Allocation Table). Bei deutlichen
Abweichungen Warnung.

In dieser Anleitung:

- neue Datendatei `js/data/cochlear-fats.js` mit der Standard-FAT
  für 22 aktive Kanäle (LFE 188 Hz, HFE 7938 Hz);
- neue Prüfung `_implCheckHzCochlearLookup` in
  `js/implant-validate.js`;
- Cent-Schwellen 300 Cent (Level 3, gelb) und 600 Cent
  (Level 2, orange);
- neuer i18n-Key.

Setzt auf BA 133 (Grundgerüst) und BA 134 (Range/Größenordnung)
auf.

## Begründung

Cochlear hat im Gegensatz zu MED-EL und AB eine diskret
tabellierte FAT-Struktur. Custom Sound Pro berechnet bei
Standard-LFE/HFE und gegebener Elektrodenzahl deterministische
Mittenfrequenzen. Ein User-Wert, der mehr als eine halbe Oktave
von der erwarteten Standard-FAT abweicht, ist entweder ein
Tippfehler oder eine nicht-standardisierte Konfiguration und
verdient einen Hinweis.

**Beschränkung dieser Anleitung**: Lookup nur aktiv, wenn alle
22 Cochlear-Elektroden aktiv sind (keine Deaktivierung). Bei
Deaktivierungen verteilt Custom Sound die FAT auf (n−1)
Kanäle, was eine andere Tabelle erfordert — diese Fälle werden
in BA 137 (FAT-Sonderprüfung) behandelt. Alternative
LFE/HFE-Kombinationen (siehe CI Select Manual) sind ebenfalls
nicht abgedeckt, weil sie nicht aus den User-Eingaben rückwärts
erschließbar sind.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.134-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.135-beta";
```

---

## Neue Datendatei `js/data/cochlear-fats.js`

Lege das Verzeichnis `js/data/` neu an, falls es noch nicht
existiert (es ist im Repo bislang nicht vorhanden). Darin die
folgende Datei komplett neu anlegen:

```js
// ============================================================
// COCHLEAR FAT — Standard-Frequency-Allocation-Tables
// ============================================================
// Datenquelle: CI Select App Manual (NYU Langone, Svirsky-Labor),
// S. 12/13 (Standard-FAT 22 Kanäle, LFE 188 Hz, HFE 7938 Hz).
// Recherche-Notiz: .manuals/Recherche_CI_Select_App.md.
//
// Indexierung im Array entspricht der Speicherung in
// MFR.cochlear.freqs (core.js): Position 0 = niedrigste Hz
// (apikalste Elektrode in der UI: E22), Position 21 = höchste
// Hz (basalste Elektrode: E1). Verwendet ausschließlich für die
// Plausibilitätsprüfung in implant-validate.js — Audio-Pfad
// und Berechnungen nutzen weiter MFR.cochlear.freqs.
//
// Erweiterungen (alternative LFE/HFE-Kombinationen, reduzierte
// Elektrodenzahlen für die Deaktivierungs-Sonderprüfung) folgen
// in BA 137 ff.
// ============================================================

const COCHLEAR_FATS = {
  // Standard, alle 22 Kanäle aktiv, LFE 188 Hz, HFE 7938 Hz.
  standard_22_lfe188_hfe7938: [
    250, 375, 500, 625, 750, 875, 1000, 1125, 1250,
    1438, 1688, 1938, 2188, 2500, 2875, 3313, 3813,
    4375, 5000, 5688, 6500, 7438
  ]
};
```

---

## Script-Tag in `index.html` ergänzen

Im `scripts`-Array die neue Datei **vor** `'js/implant-validate.js'`
einfügen, sodass die Tabellen-Konstante geladen ist, wenn der
Validator sie referenziert. Vorher (Zeilen aus BA 133):

```js
'js/ui-implant.js', 'js/freq-table.js', 'js/implant-validate.js', 'js/test-ui.js', …
```

Nachher:

```js
'js/ui-implant.js', 'js/freq-table.js', 'js/data/cochlear-fats.js', 'js/implant-validate.js', 'js/test-ui.js', …
```

---

## Neue Konstanten in `js/implant-validate.js`

Direkt nach `IMPL_VAL_HZ_MAGNITUDE_FACTOR` (aus BA 134) folgenden
Block einfügen:

```js
// Trend-/Lookup-Schwellen in Cent (gegen erwarteten Verlauf).
//   Sanfter Hinweis ab 300 Cent (≈ 3 Halbtöne).
//   Stärkere Warnung ab 600 Cent (= halbe Oktave).
// Schwellwerte begründet in .manuals/Recherche_Cent_Schwellwerte_Plausibilitaet.md.
const IMPL_VAL_HZ_TREND_YELLOW_CENT = 300;
const IMPL_VAL_HZ_TREND_ORANGE_CENT = 600;
```

---

## Neue Prüfung in `js/implant-validate.js`

Nach `_implCheckHzMagnitude` (BA 134) folgende Funktion einfügen:

```js
function _implCheckHzCochlearLookup(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'cochlear') return warnings;
  if (s.nEl !== 22) return warnings;
  if (typeof COCHLEAR_FATS === 'undefined') return warnings;

  // Lookup nur bei vollem Elektrodensatz aktiv — siehe BA 137
  // für die Deaktivierungs-Sonderprüfung.
  let nActive = s.nEl;
  if (s.elSt) {
    nActive = 0;
    for (let i = 0; i < s.nEl; i++) {
      if (s.elSt[i] !== 'deactivated') nActive++;
    }
  }
  if (nActive !== 22) return warnings;

  const fat = COCHLEAR_FATS.standard_22_lfe188_hfe7938;
  if (!fat || fat.length !== s.nEl) return warnings;
  const dENFn = (typeof dEN === 'function') ? dEN : function (i) { return i + 1; };

  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt && s.elSt[i] === 'deactivated') continue;
    // Nur User-Override prüfen.
    if (!s.elFreqOwn || s.elFreqOwn[i] == null) continue;

    const eigen = s.elFreqOwn[i];
    const expected = fat[i];
    if (!expected || expected <= 0 || eigen <= 0) continue;

    const cents = Math.abs(1200 * Math.log2(eigen / expected));

    let level = null;
    if (cents >= IMPL_VAL_HZ_TREND_ORANGE_CENT) {
      level = IMPL_VAL_LEVEL_ORANGE;
    } else if (cents >= IMPL_VAL_HZ_TREND_YELLOW_CENT) {
      level = IMPL_VAL_LEVEL_YELLOW;
    }
    if (level == null) continue;

    warnings.push({
      level: level,
      electrodeIdx: i,
      field: 'hz',
      messageKey: 'implValidateHzCochlearLookup',
      messageParams: {
        e: dENFn(i),
        hz: Math.round(eigen),
        expected: Math.round(expected),
        cents: Math.round(cents)
      }
    });
  }
  return warnings;
}
```

---

## Aufruf in `validateImplantTable`

Den bestehenden Block aus BA 134:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
```

um eine vierte Zeile ergänzen:

```js
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
```

---

## i18n-Key in `i18n/de.js`

Nach `implValidateHzMagnitude` (aus BA 134) folgenden Key
einfügen:

```js
    implValidateHzCochlearLookup: "E{e}: eigener Wert {hz} Hz weicht {cents} Cent vom Cochlear-Standard ({expected} Hz) ab",
```

**Nur Deutsch.** en/fr/es kommen in der Sammel-Übersetzungs-
Anleitung am Ende der Reihe.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im Abschnitt „Plausibilitätsprüfung der User-Eingaben" / „Hz-
Prüfungen (Stand BA 134)" den Stand-Hinweis auf BA 135 erhöhen
und folgenden Eintrag in der Liste ergänzen:

```markdown
- **Cochlear-FAT-Lookup** (BA 135, Level 2/3): nur aktiv bei
  Hersteller Cochlear und n_aktiv = 22 (alle Kanäle aktiv).
  Vergleich der User-Override-Werte mit der Standard-FAT
  (LFE 188 Hz, HFE 7938 Hz, Datendatei
  `js/data/cochlear-fats.js`, Quelle CI Select Manual S. 12/13).
  Abweichung ≥ 300 Cent → Level 3 gelb, ≥ 600 Cent → Level 2
  orange. Alternative LFE/HFE-Kombinationen und reduzierte
  Elektrodenzahlen werden in BA 137 abgedeckt.
```

Überschrift des Abschnitts auf „(Stand BA 135)" anpassen.

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` ergänzen: nutzt jetzt
zusätzlich `COCHLEAR_FATS` aus `js/data/cochlear-fats.js`. Neue
Konstanten `IMPL_VAL_HZ_TREND_YELLOW_CENT` (300) und
`IMPL_VAL_HZ_TREND_ORANGE_CENT` (600); neue Prüfung
`_implCheckHzCochlearLookup`.

Neuer Datendatei-Eintrag in der Modul-Liste:

```
| <neue Nr.> | data/cochlear-fats.js | Cochlear Frequency Allocation Tables für Plausibilitätsprüfung. Globale Konstante `COCHLEAR_FATS` mit `standard_22_lfe188_hfe7938` als 22-Element-Array (Mittenfrequenzen in Hz, aufsteigend; entspricht E22..E1 in Cochlear-Notation). Quelle: CI Select App Manual S. 12/13. Wird ausschließlich vom Validator gelesen — Audio-Pfad und Berechnungen nutzen weiter `MFR.cochlear.freqs` aus `core.js`. Erweiterungen für alternative LFE/HFE und reduzierte Elektrodenzahlen folgen in BA 137. |
```

(Position in der Tabelle: direkt vor `implant-validate.js`, damit
die Lade-Reihenfolge im `scripts`-Array auch dokumentarisch klar
ist.)

---

## Akzeptanztest

Im Browser auf einer Cochlear-Seite mit 22 aktiven Elektroden:

1. **Default-Werte unauffällig**: Tabelle ohne Hz-eigen-Einträge,
   alle Elektroden aktiv → keine Lookup-Warnung in der Warnbox.
   (Defaults werden nicht geprüft, nur User-Overrides.)
2. **Match-Bereich**: Hz-eigen bei E11 (Cochlear-Notation, im
   Code Index 11) auf 2000 setzen — erwartet 1938 Hz, Differenz
   ca. 54 Cent. **Keine Warnung**, weil unter Schwelle 300 Cent.
3. **Sanfte Warnung**: Hz-eigen bei E11 auf 2400 setzen —
   Differenz ca. 376 Cent. **Gelbe Warnung**: Rahmen gelb,
   Tooltip „E11: eigener Wert 2400 Hz weicht 376 Cent vom
   Cochlear-Standard (1938 Hz) ab"; gelbe Zeile in der Warnbox.
4. **Starke Warnung**: Hz-eigen bei E11 auf 3400 setzen —
   Differenz ca. 838 Cent. **Orange Warnung** (Range/Größen-
   ordnung greifen hier nicht, weil 3400 innerhalb 63–18938
   und Faktor 3400/1938 ≈ 1,75 unter 5).
5. **Wert löschen**: Hz-eigen bei E11 wieder leeren — Warnung
   verschwindet.
6. **Anderer Hersteller (MED-EL)**: Hersteller auf MED-EL
   umstellen, Hz-eigen bei E5 auf 3000 setzen. Keine Cochlear-
   Lookup-Warnung (sehr wohl ggf. andere Warnungen aus BA 134).
7. **Anderer Hersteller (AB)**: dito für AB.
8. **Cochlear mit Deaktivierung**: zurück auf Cochlear, eine
   Elektrode auf Status „im CI deaktiviert" setzen. Hz-eigen bei
   einer anderen Elektrode auf einen Wert setzen, der ohne
   Deaktivierung eine Lookup-Warnung erzeugen würde (z. B. E11
   = 3400). **Keine Lookup-Warnung**, weil n_aktiv ≠ 22. Andere
   Prüfungen laufen weiter.
9. **Sprachwechsel**: en → de. Cochlear-Lookup-Warnungen
   erscheinen in Deutsch (en zeigt den deutschen Default-Text).
10. **Konsole**: keine neuen Fehler oder Warnungen, insbesondere
    keine Meldung „COCHLEAR_FATS is not defined".

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der zehn Akzeptanzpunkte einzeln
durchgehen und für jeden melden: erfüllt / nicht erfüllt /
unklar, mit Datei- und Zeilenangabe. Bei „unklar" Rückfrage.

Zusätzliche Sub-Prüfungen:

- `ls js/data/cochlear-fats.js` → Datei existiert.
- `grep -n "COCHLEAR_FATS" js/data/cochlear-fats.js` → genau
  ein Treffer (Definition).
- `grep -n "COCHLEAR_FATS" js/implant-validate.js` → mindestens
  ein Treffer (Nutzung in `_implCheckHzCochlearLookup`).
- `grep -n "_implCheckHzCochlearLookup" js/implant-validate.js`
  → zwei Treffer (Definition + Aufruf).
- `grep -n "cochlear-fats.js" index.html` → ein Treffer im
  `scripts`-Array, direkt vor `implant-validate.js`.
- `grep -n "IMPL_VAL_HZ_TREND_YELLOW_CENT" js/implant-validate.js`
  → mindestens zwei Treffer (Definition + Nutzung).
- `grep -n "IMPL_VAL_HZ_TREND_ORANGE_CENT" js/implant-validate.js`
  → mindestens zwei Treffer.
- `grep -n "implValidateHzCochlearLookup" i18n/de.js` → ein
  Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.135-beta"`.

**Vier-Augen-Check für Schwellwerte und Tabellenwerte**
(Lessons learned aus Leitlinien):

- Cent-Schwellen 300 und 600 müssen sich exakt in
  `IMPL_VAL_HZ_TREND_YELLOW_CENT` und
  `IMPL_VAL_HZ_TREND_ORANGE_CENT` wiederfinden.
- Die 22 Tabellenwerte (250, 375, 500, …, 7438) in
  `standard_22_lfe188_hfe7938` exakt so wie in dieser Anleitung
  und in `.manuals/Recherche_CI_Select_App.md` S. 12/13.
- Aktivierungsbedingung n_aktiv = 22 muss eine **strenge**
  Gleichheit sein, nicht z. B. `>=`. Bei n_aktiv = 21 ist die
  Standard-FAT die falsche Referenz.

---

## Hinweise

- Erweitert die Hz-Plausibilität um die hersteller-spezifische
  Schiene für Cochlear. MED-EL und AB bekommen ihre eigenen
  Trend/Default-Prüfungen in BA 136.
- **Kein Bau-Diagnose-Test nötig** — die Akzeptanz ist visuell
  und durch Eintragen konkreter Werte direkt prüfbar.
- Folgende Erweiterungen sind bewusst aus dieser Anleitung
  ausgeklammert:
  - alternative LFE-Werte (63, 313, 438, … Hz) — Multi-Tabellen-
    Lookup wird konzeptuell offen, kann in BA 137 oder einer
    eigenen Anleitung nachgezogen werden;
  - reduzierte Elektrodenzahlen (n_aktiv < 22) — Teil der
    FAT-Sonderprüfung in BA 137;
  - NEXA-Implantate mit nur 27 festen FAT-Optionen — eigene
    Anleitung, falls relevant.
