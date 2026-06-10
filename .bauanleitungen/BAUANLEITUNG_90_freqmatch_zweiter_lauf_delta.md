# BA 90 — Zweiter Staircase-Lauf: Reliabilitätsspalte (results.js)

## Voraussetzung

BA 88 und BA 89 abgeschlossen. Die `fRes`-Einträge haben nach BA 88 ein neues Feld
`fmDelta` (|Match1 − Match2| in Cent, null bei Einzellauf oder wenn eine der Seiten
`not-perceivable` war).

## Ziel

In der Frequenzabgleich-Ergebnistabelle eine neue **Δ-Spalte** einführen:
- **Δ Lauf** (Spaltenheader) — zeigt `fmDelta` mit Ampelfarbe.
- Ampelfarbe: Δ ≤ 10 ct → grün `#16a34a`, 11–25 ct → gelb-orange `#d97706`, >25 ct → rot `#dc2626`.
- Beim Einzellauf (nur Lauf 1 gemacht) oder bei `not-perceivable`: „—" (kein Δ).
- Zeile kommt **zwischen** Residuum-Spalte und Status-Spalte.

Die Tabelle hat heute 9 Spalten; nach dieser BA: 10 Spalten. **Alle drei Zeilentypen**
(excluded, not-measured, normal) müssen eine 10. Zelle bekommen.

## Betroffene Dateien

- `js/results.js`

---

## Schritt 1 — Tabellen-Header: Δ-Spalte einfügen

In `renderFreqMatchResults` (Zeile ≈ 355), das `th.innerHTML`-Statement:

**Vorher** (Ende der Header-Kette):
```js
    "<th title=\"" + t("fmrThResidualTip") + "\">" + t("fmrThResidual") + "</th>" +
    "<th>" + t("fmrThStatus") + "</th>";
```

**Nachher**:
```js
    "<th title=\"" + t("fmrThResidualTip") + "\">" + t("fmrThResidual") + "</th>" +
    "<th title=\"" + t("fmrThDeltaTip") + "\">" + t("fmrThDelta") + "</th>" +
    "<th>" + t("fmrThStatus") + "</th>";
```

---

## Schritt 2 — i18n-Keys für Δ-Spalte in de.js

In `js/i18n/de.js` einfügen:

```js
  fmrThDelta:    'Δ Lauf',
  fmrThDeltaTip: 'Differenz der Matches zwischen Lauf 1 und Lauf 2 — Maß für Reproduzierbarkeit',
```

---

## Schritt 3 — Excluded-Zeile: 10. Zelle

In der `if (exCI)` Branch (Zeile ≈ 391):

**Vorher** (Ende des `tr.innerHTML`):
```js
        "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>" +
        "<td>—</td>";
```

**Nachher**:
```js
        "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>" +
        "<td>—</td>" +
        "<td>—</td>";
```

**(Reihenfolge: … | Residuum-Platz | Δ | Status-Platz)** — die Δ-Zelle kommt an Position 9
(vor der letzten „—"-Zelle).

**Wichtig**: Die Original-Zeile hat 9 `<td>`-Elemente in dieser Reihenfolge:
El | Var | — | Ref | — | — | — | excludedSkipped | —

Werden zu:
El | Var | — | Ref | — | — | — | excludedSkipped | — (Δ) | — (Status)

Der vollständige Ersatz des excluded-`tr.innerHTML`:

```js
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td>—</td>" +
        "<td>" + refLabel + "</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td>—</td>" +
        "<td style=\"font-size:.82em\">" + t('excludedSkipped') + "</td>" +
        "<td>—</td>" +
        "<td>—</td>";
```

---

## Schritt 4 — Not-measured-Zeile: 10. Zelle

In der `else if (!r)` Branch (Zeile ≈ 403):

Vollständiger Ersatz des `tr.innerHTML`:

```js
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + refLabel + "</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td style=\"color:#9ca3af\">—</td>" +
        "<td>" + note + "</td>";
```

*(Δ-Zelle: Position 9, grau „—"; Status-Zelle mit `note` bleibt letzte.)*

---

## Schritt 5 — Normale Zeile: Δ-Cell berechnen und einfügen

In der `else`-Branch (normale Messung, Zeile ≈ 420) muss eine neue Variable `deltaCell`
berechnet werden. **Nach** der Berechnung von `residCell` und **vor** `statusBadge`:

```js
      // Δ-Spalte: nur sichtbar wenn fmDelta vorhanden (= zweiter Lauf abgeschlossen)
      let deltaCell;
      if (r.fmDelta == null) {
        deltaCell = "<span style=\"color:#9ca3af\">—</span>";
      } else {
        const delta = Math.round(r.fmDelta);
        const dColor = delta <= 10  ? '#16a34a'
                     : delta <= 25  ? '#d97706'
                     :                '#dc2626';
        deltaCell = "<span style=\"color:" + dColor + ";font-weight:600\">"
                  + delta + " ct</span>";
      }
```

Dann in `tr.innerHTML` zwischen `residCell` und `statusBadge`:

**Vorher** (Ende des `tr.innerHTML`):
```js
        "<td>" + residCell + "</td>" +
        "<td>" + statusBadge + "</td>";
```

**Nachher**:
```js
        "<td>" + residCell + "</td>" +
        "<td>" + deltaCell + "</td>" +
        "<td>" + statusBadge + "</td>";
```

**Vollständiges `tr.innerHTML` zur Kontrolle** (alle 10 Zellen in Reihenfolge):
```js
      tr.innerHTML =
        "<td style=\"font-weight:600\">" + elLabel + "</td>" +
        "<td>" + varLabel + "</td>" +
        "<td>" + varHzCell + "</td>" +
        "<td>" + refLabel + "</td>" +
        "<td>" + refHzCell + "</td>" +
        "<td>" + diffHzCell + "</td>" +
        "<td>" + diffCtCell + "</td>" +
        "<td>" + residCell + "</td>" +
        "<td>" + deltaCell + "</td>" +
        "<td>" + statusBadge + "</td>";
```

---

## Schritt 6 — Provisional-Einträge: Δ-Zelle immer „—"

Provisional-Einträge (`in-progress-early`, `in-progress`) haben kein `fmDelta`. Da `r.fmDelta`
für diese Einträge `undefined`/`null` ist, greift bereits die `deltaCell`-Logik aus Schritt 5
(zeigt „—"). Kein separater Code nötig — sicherstellen, dass `r.fmDelta == null` auch
`undefined` abfängt (double-equals `==` deckt das ab).

---

## Akzeptanztest-Checkliste

**Setup**: BA 88 + 89 abgeschlossen. Beide Simulationsläufe abgeschlossen (oder reale Messung
mit zwei vollständigen Läufen).

**Test A — Tabellen-Header**

1. Reiter „Meßergebnisse" → Sub-Tab „Frequenzabgleich" öffnen.
2. Tabellen-Kopfzeile zeigt 10 Spalten: … Residuum | Δ Lauf | Status.
3. Hover über „Δ Lauf" → Tooltip erscheint (Browser-Standard-Tooltip mit `title`-Attribut).

**Test B — Einzellauf (nur Lauf 1 gemacht)**

4. `fmrClearBtn` drücken (Ergebnisse löschen).
5. `fmRunDebugSim()` — nur Lauf 1 abschließen (Simulation beenden sobald Start-Button
   „Zweiten Lauf starten" zeigt, OHNE zweiten Lauf zu starten).
6. Δ-Spalte in allen Zeilen: „—" (grau).

**Test C — Nach zweitem Lauf**

7. „Zweiten Lauf starten" → `fmRunDebugSim()` — Lauf 2 abschließen.
8. Δ-Spalte zeigt pro Elektrode einen Wert in Cent.
9. Farbcodierung: Δ ≤ 10 → grüner Wert, 11–25 → gelb-oranger Wert, >25 → roter Wert.
   (Bei simulierten Daten können alle grün sein — das ist korrekt.)
10. Excluded-Elektroden: alle Zellen dieser Zeile „—".
11. Not-perceivable-Elektroden: Δ-Zelle „—".

**Test D — Konsolen-Gegenchek**

12. `console.log(fRes.filter(r => r.varSide === 'right').map(r => r.fmDelta))`
    → Array mit Zahlen ≥ 0 (oder null für not-perceivable beider Läufe oder Einzellauf).
    Tabellenwerte und Konsolen-Werte müssen konsistent sein.

---

## Selbstprüfungsauftrag an Sonnet

| # | Kriterium | Fundstelle | Erfüllt? |
|---|-----------|------------|---------|
| 1 | Header: `fmrThDelta` und `fmrThDeltaTip` Keys genutzt | results.js th.innerHTML | ? |
| 2 | `fmrThDelta`, `fmrThDeltaTip` in `de.js` vorhanden | i18n/de.js | ? |
| 3 | Excluded-Zeile: 10 `<td>`-Elemente (Δ an Position 9) | results.js if (exCI) | ? |
| 4 | Not-measured-Zeile: 10 `<td>`-Elemente (Δ an Position 9) | results.js else if (!r) | ? |
| 5 | Normale Zeile: `deltaCell` berechnet, an Position 9 eingefügt | results.js tr.innerHTML | ? |
| 6 | Δ ≤ 10 → `#16a34a` (grün) | results.js deltaCell | ? |
| 7 | Δ 11–25 → `#d97706` (gelb-orange) | results.js deltaCell | ? |
| 8 | Δ > 25 → `#dc2626` (rot) | results.js deltaCell | ? |
| 9 | `r.fmDelta == null` (double-equals) fängt `undefined` ab | results.js deltaCell | ? |
| 10 | Provisional-Einträge: kein separater Δ-Code, default greift | results.js | ? |

**Kein Version-Bump** — erfolgte in BA 89.

**Hinweis auf Mini-Anleitung**: en/fr/es-Strings für `fmrThDelta` und `fmrThDeltaTip`
kommen in der Übersetzungs-Mini-Anleitung zusammen mit den anderen BA-88/89-Strings.
