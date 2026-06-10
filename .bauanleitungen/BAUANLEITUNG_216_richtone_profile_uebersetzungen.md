# BAUANLEITUNG 216 — Übersetzungen für die 14 richTone-Instrumenten-Tontypen

## Ziel

Mini-BA. Die 14 neuen Tontypen aus BA 215 (`toneRichAcc` …
`toneRichHn`) sind nur in `i18n/de.js` mit Labels versehen. Andere
Sprachen fallen aktuell auf die deutschen Defaults zurück. BA 216
ergänzt die übersetzten Labels in `i18n/en.js`, `i18n/fr.js` und
`i18n/es.js`.

Kein Code-Logik-Bezug, kein UI-Umbau, ausschließlich Übersetzungs-
Eintragungen plus Versionsbump.

## Voraussetzungen

- BA 215 abgeschlossen, Version aktuell `3.2.215-beta`.
- `i18n/de.js` enthält die 14 `toneRich<Abbr>`-Schlüssel (Z. 162–175).
- `i18n/en.js`, `fr.js`, `es.js` enthalten `toneRichTone` und
  `toneIRN`, aber **keinen** der 14 Instrumenten-Schlüssel — genau
  diese Lücke wird hier gefüllt.

## Reihenfolge der Schlüssel

In allen drei Sprachdateien werden die 14 Einträge direkt nach
`toneRichTone:` und **vor** `toneNoise:` eingefügt, in der gleichen
Reihenfolge wie in `de.js`:

```
toneRichAcc, toneRichASax, toneRichBTb, toneRichVa, toneRichBn,
toneRichClBb, toneRichCb, toneRichOb, toneRichTbn, toneRichFl,
toneRichTpC, toneRichVn, toneRichVc, toneRichHn
```

Das Suffix `(richTone)` aus den deutschen Labels bleibt **wörtlich**
erhalten — `richTone` ist ein Tool-interner Begriff und wird nicht
übersetzt. Damit weiß der Nutzer in jeder Sprache, daß diese Tontypen
zur richTone-Familie gehören.

## Schritt 1 — `i18n/en.js`

Vorher (Z. 159–160):
```javascript
    toneRichTone: "Rich complex tone (8 harmonics, vibrato 5 Hz, breath AM 3 Hz)",
    toneNoise: "Narrow-band noise",
```

Nachher:
```javascript
    toneRichTone: "Rich complex tone (8 harmonics, vibrato 5 Hz, breath AM 3 Hz)",
    toneRichAcc:   "Accordion (richTone)",
    toneRichASax:  "Alto saxophone (richTone)",
    toneRichBTb:   "Bass tuba (richTone)",
    toneRichVa:    "Viola (richTone)",
    toneRichBn:    "Bassoon (richTone)",
    toneRichClBb:  "Clarinet in B♭ (richTone)",
    toneRichCb:    "Double bass (richTone)",
    toneRichOb:    "Oboe (richTone)",
    toneRichTbn:   "Trombone (richTone)",
    toneRichFl:    "Flute (richTone)",
    toneRichTpC:   "Trumpet in C (richTone)",
    toneRichVn:    "Violin (richTone)",
    toneRichVc:    "Violoncello (richTone)",
    toneRichHn:    "French horn (richTone)",
    toneNoise: "Narrow-band noise",
```

## Schritt 2 — `i18n/fr.js`

Vorher (Z. 159–160):
```javascript
    toneRichTone: "Son complexe enrichi (8 harmoniques, vibrato 5 Hz, souffle AM 3 Hz)",
    toneNoise: "Bruit à bande étroite",
```

Nachher:
```javascript
    toneRichTone: "Son complexe enrichi (8 harmoniques, vibrato 5 Hz, souffle AM 3 Hz)",
    toneRichAcc:   "Accordéon (richTone)",
    toneRichASax:  "Saxophone alto (richTone)",
    toneRichBTb:   "Tuba basse (richTone)",
    toneRichVa:    "Alto (richTone)",
    toneRichBn:    "Basson (richTone)",
    toneRichClBb:  "Clarinette en si bémol (richTone)",
    toneRichCb:    "Contrebasse (richTone)",
    toneRichOb:    "Hautbois (richTone)",
    toneRichTbn:   "Trombone (richTone)",
    toneRichFl:    "Flûte traversière (richTone)",
    toneRichTpC:   "Trompette en ut (richTone)",
    toneRichVn:    "Violon (richTone)",
    toneRichVc:    "Violoncelle (richTone)",
    toneRichHn:    "Cor d'harmonie (richTone)",
    toneNoise: "Bruit à bande étroite",
```

Hinweis zur Solfège-Notation: TinySOL stammt vom IRCAM, also wird
die französische Notentradition verwendet (`en ut`, `en si bémol`).
Das entspricht der Konvention, die im Quellmaterial steht.

## Schritt 3 — `i18n/es.js`

Vorher (Z. 159–160):
```javascript
    toneRichTone: "Tono complejo enriquecido (8 armónicos, vibrato 5 Hz, respiración AM 3 Hz)",
    toneNoise: "Ruido de banda estrecha",
```

Nachher:
```javascript
    toneRichTone: "Tono complejo enriquecido (8 armónicos, vibrato 5 Hz, respiración AM 3 Hz)",
    toneRichAcc:   "Acordeón (richTone)",
    toneRichASax:  "Saxofón alto (richTone)",
    toneRichBTb:   "Tuba baja (richTone)",
    toneRichVa:    "Viola (richTone)",
    toneRichBn:    "Fagot (richTone)",
    toneRichClBb:  "Clarinete en si bemol (richTone)",
    toneRichCb:    "Contrabajo (richTone)",
    toneRichOb:    "Oboe (richTone)",
    toneRichTbn:   "Trombón (richTone)",
    toneRichFl:    "Flauta travesera (richTone)",
    toneRichTpC:   "Trompeta en do (richTone)",
    toneRichVn:    "Violín (richTone)",
    toneRichVc:    "Violonchelo (richTone)",
    toneRichHn:    "Trompa (richTone)",
    toneNoise: "Ruido de banda estrecha",
```

## Schritt 4 — Versionsbump

In `js/version.js`:

Vorher:
```javascript
const APP_VERSION = "3.2.215-beta";
```

Nachher:
```javascript
const APP_VERSION = "3.2.216-beta";
```

## Akzeptanztest

1. `i18n/en.js` enthält die 14 neuen `toneRich<Abbr>`-Schlüssel
   direkt nach `toneRichTone:`. Quick-Check:
   ```
   grep -c "toneRich" i18n/en.js
   ```
   ergibt **15** (einer für `toneRichTone`, vierzehn für die
   Instrumente). ✅ / ❌
2. `i18n/fr.js`: gleiche Bedingung, `grep -c "toneRich" i18n/fr.js`
   ergibt **15**. ✅ / ❌
3. `i18n/es.js`: gleiche Bedingung, `grep -c "toneRich" i18n/es.js`
   ergibt **15**. ✅ / ❌
4. Browser-Hard-Reload, Version unten zeigt `3.2.216-beta`. ✅ / ❌
5. Sprache auf Englisch umstellen. Tonart-Popup im Frequenzabgleich
   öffnen. Die 14 Instrumenten-Varianten zeigen englische Labels
   („Accordion (richTone)", „Cello (richTone)" — wait, hier
   „Violoncello (richTone)" — etc.) statt der deutschen. ✅ / ❌
6. Sprache auf Französisch umstellen. Stichprobe: „Akkordeon
   (richTone)" sollte als „Accordéon (richTone)" erscheinen,
   „Querflöte" als „Flûte traversière". ✅ / ❌
7. Sprache auf Spanisch umstellen. Stichprobe: „Akkordeon (richTone)"
   als „Acordeón (richTone)", „Fagott" als „Fagot". ✅ / ❌
8. Sprache zurück auf Deutsch. Die Labels sind unverändert (Deutsch).
   ✅ / ❌

## Selbstprüfungs-Auftrag

Sonnet geht **vor der Fertig-Meldung** die acht Akzeptanz-Punkte
einzeln durch und meldet pro Punkt: erfüllt / nicht erfüllt / unklar,
jeweils mit Konsolenausgabe (`grep -c …`) oder UI-Beobachtung.

Im Fertig-Bericht den Inhalt einer der erweiterten Sprachdateien
(z. B. `i18n/en.js` Zeilen 159–175) mitschicken, damit auf einen
Blick prüfbar ist, daß die Einrückung mit dem umliegenden Code
konsistent ist.

## Hinweise

- Reihenfolge der Schlüssel ist in allen drei Dateien identisch zu
  `i18n/de.js` — vereinfacht Wartung und Diff-Lesen.
- ASCII-Quotes konsequent: nur `"…"` als Stringbegrenzer. Innerhalb
  der Strings sind Akzente (é, è, ü, í, ñ, …) und das musikalische
  ♭ (U+266D) zulässig — das sind keine Quotes, die den Parser stören.
- Wenn ein Label sprachlich noch verbessert werden soll
  (z. B. „French horn" vs. „Horn", „Cello" vs. „Violoncello"): kurze
  Nachfrage in einem Folge-Edit, kein Grund für eine Anpassung der
  BA mitten im Lauf.
