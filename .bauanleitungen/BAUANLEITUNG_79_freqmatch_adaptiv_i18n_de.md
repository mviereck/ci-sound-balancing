# Bauanleitung 79 — Frequenzabgleich adaptiv: i18n DE

## Ziel

Letzte Anleitung der 02b-Reihe. Trägt **alle** deutschen Strings
für den adaptiven Modus gebündelt in `i18n/de.js` nach. Die Keys
wurden in den Bauanleitungen 72–78 schon im Code referenziert,
in `de.js` aber bewusst noch nicht angelegt — diese Anleitung
schließt die Lücke.

`en.js`, `fr.js`, `es.js` bleiben **unangetastet**. Fehlende Keys
dort fallen über den i18n-Fallback auf die deutschen Werte zurück.
Übersetzungen für andere Sprachen kommen in eigenen Mini-Anleitungen,
nachdem die deutsche UI-Vorlage steht und Du sie geprüft hast.

**Voraussetzungen**: Bauanleitungen 72–78 sind umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.79-beta";
```

---

## 2. Neue Keys in `i18n/de.js`

In `i18n/de.js`, im großen Sprach-Objekt — die folgenden Einträge
ergänzen. Sonnet sucht eine passende Stelle in der Nähe der
bestehenden `fm*`-Keys (um Z. 572 ff.) und fügt die neuen Keys
in alphabetischer Nähe zu thematisch verwandten Keys ein.

```js
// Antwort-Buttons (Bauanleitung 02b/1, 02b/2, 02b/4)
bHigher: "höher",
bLower:  "tiefer",

// Modus-Schalter (Bauanleitung 02b/2)
fmLblMode:        "Modus",
fmModeAdaptive:   "Adaptiv (2I-2AFC)",
fmModeSlider:     "Klassisch (Slider)",
fmAdaptiveNotImpl: "Adaptiver Modus noch nicht implementiert.",   // Fallback nur, falls Stub doch greift

// Start- vs. Fortsetzen-Label (Bauanleitung 02b/5)
fmLblResume: "Test fortsetzen",

// Pair-Anzeige im adaptiven Modus (Bauanleitung 02b/4)
fmTone1: "Ton 1",
fmTone2: "Ton 2",

// Status-Grid-Spalten (Bauanleitung 02b/4)
fmGridEl:     "Elektrode",
fmGridStatus: "Status",
fmGridMatch:  "Match",
fmGridResid:  "Residuum",
fmGridTrials: "Trials",
fmGridCatch:  "Catch",

// Erklärungstexte für den adaptiven Modus (aus 02b-freqmatch-adaptiv.md)
fmExplainAdaptiveIntro:
  "Sie hören zwei kurze Töne hintereinander. Beantworten Sie nur: war der zweite Ton höher oder tiefer als der erste? — mit Pfeil hoch oder Pfeil runter.",
fmExplainAdaptiveGuess:
  "Wenn Sie keinen oder nur einen der Töne hören: einfach raten. Falsche Antworten in einem Bereich, in dem Sie wenig hören, sind kein Fehler — die Messung erkennt das selbst und stuft die Elektrode in diesem Bereich als „nicht wahrnehmbar" oder „unsicher" ein.",
fmExplainAdaptivePause:
  "Der Test läuft, bis alle Elektroden ausreichend genau gemessen sind. Sie können jederzeit pausieren und später fortsetzen.",

// Ergebnis-Tabelle und Chart (Bauanleitung 02b/7)
fmrThStatus:        "Status",
fmrStatusOk:        "konvergiert",
fmrStatusNoisy:     "Restunsicherheit",
fmrStatusNotPerc:   "nicht wahrnehmbar",
fmrTipNotPerc:      "nicht wahrnehmbar in diesem Frequenzbereich",
fmrTipResidual:     "Restunsicherheit",
fmrChartHintAdaptive:
  "Ist-Strich = programmierte Elektroden-Frequenz, Soll-Punkt = wahrgenommene Übereinstimmung. ✓ saubere Konvergenz, ◐ Restunsicherheit (orange Band, Halb-Höhe entspricht ±cent), ✗ nicht wahrnehmbar.",

// Optional, falls noch nicht vorhanden: keine aktiven Elektroden
// fmNoActiveEl: "Keine aktiven Elektroden auf der variablen Seite.",
```

Sonnet prüft beim Einfügen, ob ein Key (z.B. `fmNoActiveEl`)
schon existiert — Duplikate vermeiden. Falls vorhanden, den
Eintrag in obigem Block streichen.

---

## 3. Erklärungstext-Umschaltung im Modus-Wechsel (optional)

Heute haben beide Modi denselben Erklärungstext (`fmHintMethod`,
`fmPrereqHint`, `fmHintWarn`) aus dem `fmCfg.explain`-Block.

Für den adaptiven Modus sind die Erklärungs-Keys oben (`fmExplain*`)
inhaltlich passender. Eine sauberere Umschaltung ist möglich, indem
`fmApplyMode()` (aus Bauanleitung 02b/2) den Inhalt des
Erklärungs-Blocks austauscht.

**Diese Umschaltung ist optional** und wird in dieser Anleitung
**nicht** umgesetzt — sie kann als kleine Folge-Anleitung nachgezogen
werden, falls Du die adaptiv-spezifischen Texte sehen willst. Bis
dahin zeigt der adaptive Modus weiterhin die bisherigen
Slider-Erklärtexte.

---

## 4. Verifikation der Schlüssel-Vollständigkeit

Sonnet führt nach dem Einfügen einen Konsistenz-Check durch:

```bash
# Alle in den Bauanleitungen 72–78 referenzierten neuen Keys:
KEYS="bHigher bLower fmLblMode fmModeAdaptive fmModeSlider \
      fmAdaptiveNotImpl fmLblResume fmTone1 fmTone2 \
      fmGridEl fmGridStatus fmGridMatch fmGridResid fmGridTrials fmGridCatch \
      fmExplainAdaptiveIntro fmExplainAdaptiveGuess fmExplainAdaptivePause \
      fmrThStatus fmrStatusOk fmrStatusNoisy fmrStatusNotPerc \
      fmrTipNotPerc fmrTipResidual fmrChartHintAdaptive"

for k in $KEYS; do
  if ! grep -q "^[[:space:]]*$k:" i18n/de.js; then
    echo "FEHLT: $k"
  fi
done
```

Erwartet: keine Ausgabe. Falls ein Key fehlt: ergänzen.

---

## 5. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`, ggf. einen Verweis ergänzen: alle
adaptiv-spezifischen i18n-Keys leben in `i18n/de.js` ab Bauanleitung
79, andere Sprachen folgen separat. Diese Erwähnung ist optional
und nur sinnvoll, wenn CODESTRUKTUR.md i18n-Dateien einzeln auflistet.

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.79-beta`.
2. Tab Messungen → Frequenzabgleich.
3. **Modus-Dropdown** zeigt jetzt Labels:
   - „Adaptiv (2I-2AFC)" und „Klassisch (Slider)"
   - Label „Modus" links neben dem Dropdown
4. **Im adaptiven Modus**:
   - Höher-Button beschriftet mit „höher" und Pfeil-hoch-Tastatur-Hinweis
   - Tiefer-Button beschriftet mit „tiefer" und Pfeil-runter-Hinweis
   - Status-Grid Kopfzeile: „Elektrode | Status | Match | Residuum | Trials | Catch"
   - Pair-Anzeige während des Tests: „Ton 1" und „Ton 2"
5. **Test starten** klicken — Button-Text war „Test starten", wird
   nach Stop in „Test fortsetzen" geändert.
6. **Ergebnis-Tabelle** nach dem Test: neue Spalte „Status" mit
   Badges:
   - Konvergent: grüner ✓-Badge
   - Restunsicherheit: oranger ±N ct-Badge
   - Nicht wahrnehmbar: rotes ✗ + Text
7. **Tooltip** im Chart: bei converged-noisy zusätzliche Zeile
   „Restunsicherheit ±N ct", bei not-perceivable Text „nicht
   wahrnehmbar in diesem Frequenzbereich".
8. **Chart-Hinweis-Zeile** unter dem Chart: ausführlicherer Text
   mit Legende ✓ / ◐ / ✗.
9. **Sprachwechsel** (falls verfügbar): EN/FR/ES zeigen für die
   neuen Keys deutsche Werte (Fallback). Das ist beabsichtigt
   und kein Fehler.
10. Slider-Modus weiterhin unverändert mit alten Erklärungstexten
    (keine Regression).
11. Konsole frei von Fehlern.

---

## Selbstprüfungs-Auftrag an Sonnet

1. Akzeptanztest-Schritte einzeln durchgehen, melden.
2. Konsistenz-Check aus Schritt 4 ausführen — keine Ausgabe = OK.
3. Speziell prüfen:
   - Wurden Keys versehentlich doppelt angelegt? (z.B. wenn
     `fmNoActiveEl` schon existiert.) Sonnet entfernt Duplikate.
   - Wurden Keys in `en.js`, `fr.js`, `es.js` **NICHT** angelegt?
     (Die sollen bewußt leer bleiben — Fallback auf de.)
   - Bricht der Build / das Tool nicht durch fehlende Kommata oder
     Syntax-Fehler nach dem Einfügen?
4. Bei Zweifel zu Formulierung („höher" vs. „Höher", „Cent" vs.
   „cent"): an bestehende Konvention der Datei halten (kleingeschrieben
   für „höher/tiefer", weil Verlauf-Vergleich mit bestehenden
   `bLoud: "lauter"`-Style).

---

## Was diese Anleitung NICHT macht

- Keine Übersetzungen für `en.js`, `fr.js`, `es.js` — kommen in
  einer separaten Mini-Anleitung „Übersetzungen 02b adaptive
  Frequenzabgleich", wenn die deutsche Vorlage durch ist und
  Du sie freigegeben hast.
- Keine Erklärungstext-Umschaltung im Modus-Wechsel — optional,
  separate Folge-Anleitung (siehe Abschnitt 3).
- Kein Drucker-Anpassung (Audiologen-Druck / Archiv-Druck) — Spec
  02b sagt zum Druck nichts; falls gewünscht, separate Mini-
  Anleitung.

---

## Abschluß der 02b-Reihe

Mit dieser Anleitung ist der adaptive Frequenzabgleich-Modus
**vollständig** umgesetzt:

- 02b/1 (Bauanleitung 72): Builder-Sektionen heightJudgment + statusGrid
- 02b/2 (Bauanleitung 73): Modus-Schalter slider/adaptive
- 02b/3 (Bauanleitung 74): Staircase-Kern (Pure Functions)
- 02b/4 (Bauanleitung 75): Trial-Loop + Status-Grid-Befüllung
- 02b/5 (Bauanleitung 76): Pause/Resume-Persistenz
- 02b/6 (Bauanleitung 77): Catch-Trials + „nicht wahrnehmbar"
- 02b/7 (Bauanleitung 78): Ergebnis-Chart + Tabelle
- 02b/8 (Bauanleitung 79, diese Anleitung): i18n DE

Optionale Folge-Schritte (jeweils eigene Mini-Anleitung, nur auf
expliziten Wunsch):

- Erklärungstext-Umschaltung im Modus-Wechsel
- Übersetzungen en/fr/es
- Druck-Anpassungen (Audiologen- und Archiv-Druck)
- Reduzierter Modus für einzelne Elektroden (Spec-Idee aus
  `docs/IDEEN.md`, falls dort gelistet)
