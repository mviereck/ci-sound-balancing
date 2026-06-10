# BAUANLEITUNG 141 — FAT-Sonderprüfung bei Elektroden-Deaktivierung

## Ziel

Eine neue Prüfung in `js/implant-validate.js`, die sich auslöst,
sobald mindestens eine Elektrode den Status „im CI deaktiviert"
hat. Sie prüft, ob die User-Eingaben eine **FAT-Adaption**
erkennen lassen — also ob der Audiologe die Frequenzverteilung
bei deaktivierten Elektroden angepasst hat. Wenn keine Adaption
erkennbar ist, kommt eine Warnung in der Plausibilitätsbox.

Zwei parallele Sub-Tests:

- **globaler Test**: alle aktiven Elektroden (nicht deaktiviert)
  haben einen Hz-eigen-Override. Deutet auf vollständige
  globale Umverteilung der FAT.
- **lokaler Test**: für mindestens eine der deaktivierten
  Elektroden hat ein direkter Nachbar einen Hz-eigen-Override.
  Deutet auf lokale Anpassung an die Lücke.

Wenn **weder** der globale noch der lokale Test bestanden ist,
fällt die Warnung. Bewertung herstellerspezifisch:

- **MED-EL und Cochlear**: Level 2 orange — bei diesen
  Herstellern verteilt die Fitting-Software die FAT global um,
  fehlende Adaption ist verdächtig.
- **Advanced Bionics**: Level 3 gelb — feste Tabellen pro
  Elektrode, eine Lücke im Spektrum ist der dokumentierte
  Default-Zustand und kein Tippfehler, aber ein Hinweis wert.

Setzt auf BA 133–140 auf.

## Begründung

Aus Recherche (`.manuals/Recherche_Cochlear_FAT_Deaktivierung.md`
und `MAESTRO-Handbuch Kap. 24.6`): bei MED-EL und Cochlear ist
globale Umverteilung der FAT der Software-Default, sobald eine
Elektrode deaktiviert wird. AB hat feste Filter-Tabellen ohne
automatische Umverteilung.

Konzeptuell besprochen: die Prüfung schaut nicht direkt in die
FAT-Werte, sondern erkennt eine Adaption indirekt am Vorhanden-
sein von Hz-eigen-Overrides. Beide Tests parallel decken sowohl
„komplette Neuverteilung" als auch „nur lokal an die Lücke
angepasst" ab.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.140-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.141-beta";
```

---

## Neue Prüfung in `js/implant-validate.js`

Nach `_implCheckThrUpperMAD` (am Ende der bestehenden Prüfungs-
Reihe, vor `// --- Hauptfunktion ---`) folgende Funktion
einfügen:

```js
function _implCheckFatOnDeactivation(s) {
  const warnings = [];
  if (!s || !s.nEl || !s.elSt) return warnings;

  // Indizes der deaktivierten und der aktiven Elektroden sammeln.
  const deactIdxs = [];
  const activeIdxs = [];
  for (let i = 0; i < s.nEl; i++) {
    if (s.elSt[i] === 'deactivated') deactIdxs.push(i);
    else activeIdxs.push(i);
  }

  // Auslöser: ≥1 deaktivierte Elektrode.
  if (deactIdxs.length === 0) return warnings;

  // Wenn keine aktiven mehr da sind (Edge-Case), nichts melden.
  if (activeIdxs.length === 0) return warnings;

  // Sub-Test 1 — globaler Test:
  //   Alle aktiven Elektroden haben einen Hz-eigen-Override.
  //   Deutet auf vollständige globale Umverteilung der FAT.
  const allActiveOverridden = activeIdxs.every(function (i) {
    return s.elFreqOwn && s.elFreqOwn[i] != null;
  });
  if (allActiveOverridden) return warnings; // global-Test bestanden

  // Sub-Test 2 — lokaler Test:
  //   Für mindestens eine deaktivierte Elektrode hat ein direkter
  //   (aktiver) Nachbar einen Hz-eigen-Override.
  //   Deutet auf lokale Anpassung an die Lücke.
  const localTestPassed = deactIdxs.some(function (d) {
    const neighbors = [];
    if (d > 0)             neighbors.push(d - 1);
    if (d < s.nEl - 1)     neighbors.push(d + 1);
    return neighbors.some(function (n) {
      if (s.elSt[n] === 'deactivated') return false;
      return s.elFreqOwn && s.elFreqOwn[n] != null;
    });
  });
  if (localTestPassed) return warnings; // lokal-Test bestanden

  // Weder global noch lokal bestanden → FAT scheint nicht angepasst.
  // Bewertung herstellerspezifisch.
  const isAb = (s.manufacturer === 'ab');
  warnings.push({
    level: isAb ? IMPL_VAL_LEVEL_YELLOW : IMPL_VAL_LEVEL_ORANGE,
    messageKey: isAb ? 'implValidateFatAb' : 'implValidateFatMissing',
    messageParams: {
      n_deact: deactIdxs.length
    }
  });
  return warnings;
}
```

**Wichtig**: das Warnung-Objekt enthält **kein** `electrodeIdx`
und **kein** `field`. `_implApplyFieldLevel` returnt bei
`electrodeIdx == null` ohne Markierung — gewollt. Der Eintrag
erscheint nur in der Warnbox, nicht an einem einzelnen Feld,
weil die Aussage über die ganze Tabelle geht.

---

## Aufruf in `validateImplantTable`

Den bestehenden Aufruf-Block (Hz-Prüfungen + THR/Upper-Prüfungen)
um eine elfte Zeile am Ende ergänzen:

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
  warnings.push.apply(warnings, _implCheckFatOnDeactivation(s));
```

---

## i18n-Keys in `i18n/de.js`

Nach `implValidateUpperMAD` (BA 138) folgende zwei Keys
ergänzen:

```js
    implValidateFatMissing: "{n_deact} Elektrode(n) sind im CI deaktiviert, aber keine Frequenzanpassung der aktiven Elektroden erkennbar. MED-EL/Cochlear verteilen die FAT bei Deaktivierungen normalerweise um — aktuelle Mittenfrequenzen bitte vom Audiologen erfragen und in Hz-eigen eintragen.",
    implValidateFatAb: "{n_deact} Elektrode(n) sind im CI deaktiviert. Bei Advanced Bionics ist eine FAT-Anpassung nicht zwingend (feste Filtergrenzen) — im Hörbild kann eine Lücke im Spektrum entstehen.",
```

**Nur Deutsch.** en/fr/es kommen am Ende der Reihe.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im Abschnitt „Plausibilitätsprüfung der User-Eingaben" am Ende
einen neuen Unter-Abschnitt anfügen:

```markdown
### FAT-Sonderprüfung bei Deaktivierung (Stand BA 141)

Eigene Prüfung `_implCheckFatOnDeactivation`. Auslöser:
mindestens eine Elektrode mit Status „im CI deaktiviert". Prüft
indirekt am Vorhandensein von Hz-eigen-Overrides, ob die FAT
adaptiert wurde:

- **globaler Test bestanden**: alle aktiven (nicht-deaktivierten)
  Elektroden haben einen Hz-eigen-Override (globale Umverteilung
  der FAT erkennbar).
- **lokaler Test bestanden**: für mindestens eine der
  deaktivierten Elektroden hat ein direkter aktiver Nachbar
  einen Hz-eigen-Override (lokale Anpassung an die Lücke).
- **weder noch**: Warnung.

Bewertung herstellerspezifisch (Konzept-Befund aus Recherche):

- **MED-EL und Cochlear**: Level 2 orange. Fitting-Software
  verteilt die FAT bei Deaktivierungen normalerweise global um;
  fehlende Adaption ist verdächtig.
- **Advanced Bionics**: Level 3 gelb. Feste Filtergrenzen,
  Lücke ist Default-Verhalten — Hinweis, keine starke Warnung.

Die Warnung trägt **kein** `electrodeIdx` und markiert deshalb
kein einzelnes Feld — sie erscheint nur als Box-Eintrag, weil
sich die Aussage auf die Tabelle als Ganzes bezieht.

**Überlappung mit `deactWarnBar`**: das bestehende Warnbanner
oberhalb der Tabelle (`#deactWarnBar` in `freq-table.js`) prüft
eine verwandte, aber nicht identische Bedingung („deaktivierte
Elektrode hat noch Default-Hz"). Es bleibt parallel bestehen.
Eine spätere Konsolidierung kann den Banner durch diese
Prüfung ersetzen.
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` am Ende ergänzen:

```
BA 141 ergänzt: FAT-Sonderprüfung bei Deaktivierung
(`_implCheckFatOnDeactivation`, kein `electrodeIdx` →
reine Box-Warnung). Auslöser ≥1 deaktivierte Elektrode.
Sub-Tests: globaler Test (alle aktiven Elektroden haben
Hz-eigen-Override) und lokaler Test (mind. ein direkter Nachbar
einer deaktivierten Elektrode hat Override). Bestanden ↔ keine
Warnung. Sonst: MED-EL/Cochlear Level 2 orange
(`implValidateFatMissing`), AB Level 3 gelb
(`implValidateFatAb`).
```

---

## Akzeptanztest

Im Browser. Voraussetzung: Hersteller-Wechsel und Status-
Dropdown-Zugriff klar.

### MED-EL

1. **Keine deaktivierte Elektrode**: alle Hz-Spalten leer, alle
   Stati „ok". Erwartung: **keine** FAT-Warnung in der Warnbox.
2. **Eine deaktivierte Elektrode, keine Overrides**: bei E5
   Status auf „im CI deaktiviert" stellen, sonst nichts ändern.
   Erwartung: **orange Warnung** in der Warnbox, Text
   „1 Elektrode(n) sind im CI deaktiviert, aber keine
   Frequenzanpassung der aktiven Elektroden erkennbar…".
3. **Lokaler Test bestanden**: zusätzlich zu Schritt 2 bei E4
   einen Hz-eigen-Wert eintragen (z. B. 900 statt Default 579).
   Erwartung: orange FAT-Warnung **verschwindet** (Nachbar
   von E5 hat Override).
4. **Lokaler Test über entferntem Override**: Override bei E4
   wieder löschen, stattdessen bei E10 einen Hz-eigen-Wert
   eintragen. Erwartung: orange FAT-Warnung **kommt zurück**
   (E10 ist kein direkter Nachbar von E5).
5. **Globaler Test bestanden**: bei allen aktiven Elektroden
   (E1–E4, E6–E12) jeweils einen Hz-eigen-Override eintragen,
   E5 bleibt deaktiviert. Erwartung: FAT-Warnung
   **verschwindet** (globaler Test schlägt an).
6. **Zwei deaktivierte Elektroden, keine Overrides**: zurück
   zu nur deaktivierten Elektroden E5 und E10, Hz-eigen leer.
   Erwartung: orange FAT-Warnung mit Text „**2** Elektrode(n)
   sind im CI deaktiviert…".

### Cochlear

7. **Hersteller-Wechsel auf Cochlear**, dann eine Elektrode
   deaktivieren, keine Overrides. Erwartung: orange FAT-Warnung
   (gleicher Text wie bei MED-EL).

### Advanced Bionics

8. **Hersteller-Wechsel auf AB**, eine Elektrode deaktivieren,
   keine Overrides. Erwartung: **gelbe** FAT-Warnung (Level 3),
   Text „… Bei Advanced Bionics ist eine FAT-Anpassung nicht
   zwingend (feste Filtergrenzen) — im Hörbild kann eine Lücke
   im Spektrum entstehen."
9. **AB lokaler Test bestanden**: zusätzlich bei einem
   direkten Nachbarn der deaktivierten Elektrode einen
   Hz-eigen-Override eintragen. Erwartung: gelbe FAT-Warnung
   **verschwindet**.

### Robustheit

10. **Markierung an Eingabefeldern**: in keinem der Schritte 1–9
    bekommt ein einzelnes Hz/THR/Upper-Feld einen farbigen
    Rahmen wegen FAT-Warnung — die Warnung ist ausschließlich
    Box-Eintrag.
11. **Sprachwechsel**: en → de. Die FAT-Warnungstexte
    erscheinen in Deutsch.
12. **Konsole**: keine neuen Fehler.

### Bestehender deactWarnBar bleibt

13. **Visuell prüfen**: der rote `#deactWarnBar` oberhalb der
    Frequenztabelle (aus `freq-table.js`) erscheint weiterhin,
    wenn eine deaktivierte Elektrode noch ihren Default-Hz hat.
    Beide Warnungen können parallel erscheinen — Doppelung in
    dieser Bauanleitung bewusst akzeptiert, Konsolidierung
    später möglich.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der dreizehn Akzeptanzpunkte
einzeln durchgehen und für jeden melden: erfüllt / nicht
erfüllt / unklar, mit Datei- und Zeilenangabe. Bei „unklar"
Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "_implCheckFatOnDeactivation" js/implant-validate.js`
  → zwei Treffer (Definition + Aufruf).
- `grep -n "implValidateFatMissing\|implValidateFatAb" i18n/de.js`
  → zwei Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.141-beta"`.
- Die Funktion **darf nicht** `electrodeIdx` oder `field` im
  Warnung-Objekt setzen — Box-Warnung über die ganze Tabelle.

**Vier-Augen-Check für Logik** (Lessons learned):

- Globaler Test: `activeIdxs.every(…)` — **alle** aktiven
  Elektroden, nicht nur einige.
- Lokaler Test: `deactIdxs.some(…)` über direkte Nachbarn,
  Nachbar muss **aktiv** sein (`s.elSt[n] !== 'deactivated'`)
  und einen Override haben.
- AB-Erkennung: `s.manufacturer === 'ab'` exakt (nicht
  `=== 'AB'` o. ä.).
- Bedingung „weder global noch lokal bestanden": erst nach
  beiden Sub-Tests die Warnung pushen — die `return warnings;`
  bei bestandenen Tests vorher prüfen.

---

## Hinweise

- Nach dieser Anleitung steht aus: BA 142 (globale Parameter
  c/IDR/IIDR) und BA 143 (i18n en/fr/es nachziehen). Eine
  „Tabelle unvollständig"-Warnung („X von Y THR-Werte fehlen")
  ist konzeptuell besprochen, kann nach Bedarf als kleine
  eigene Anleitung dazwischen oder in BA 142 mit eingebaut
  werden.
- **Kein Bau-Diagnose-Test nötig** — Akzeptanz ist durch
  Status-Setzen und Hz-Eingaben direkt visuell prüfbar.
- Die FAT-Sonderprüfung ist bewusst **indirekt** (über
  Hz-eigen-Overrides) und prüft **nicht** ob die eingetragenen
  Hz-Werte zur tatsächlichen Umverteilung passen würden. Die
  Verteilungs-Plausibilität wird vom Cochlear-Lookup (BA 135)
  und vom MED-EL/AB-Trend (BA 137) erfasst.
