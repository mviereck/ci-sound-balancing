# BA 95 — `combinedUncertainty` in `fRes` + Tabellen-Anpassung

## Ziel

Die alte „Δ Lauf"-Spalte in der Frequenzabgleich-Ergebnistabelle wird
zu einer allgemeinen **„Unsicherheit (gesamt)"**-Spalte. Sie zeigt
`fmCombinedUncertainty` aus dem `fRes`-Eintrag, das in BA 94 als
separates Feld eingeführt wurde.

Aus User-Sicht: Zwei Spalten mit klar getrennter Bedeutung —
- „**Restunsicherheit**" zeigt das Lauf-interne Mittel-Residuum (wie heute,
  Inhalt aus `fmResidual`).
- „**Unsicherheit (gesamt)**" zeigt die kombinierte Unsicherheit aus
  Residuum + Streuung über alle Läufe (`fmCombinedUncertainty`).

Diese Trennung ist später auch der Träger für eine gewichtete Regression
(„einheitliche Verschiebung aller Elektroden statt pro-Elektroden-Korrektur"),
siehe SPEC-Abschnitt „Bekannte Einschränkungen".

## Vorbedingungen

- BA 93 und BA 94 sind gebaut und akzeptiert.
- `fRes`-Einträge sind Objekte im Array (Zugriff über `findIndex`, nicht
  per Direktindex) mit den Feldern `varSide, refSide, elIdx, varFreq,
  refFreq, timestamp, fmStatus, fmResidual, fmCombinedUncertainty,
  fmDelta`. `fmCombinedUncertainty` wird seit BA 94 separat von
  `fmResidual` geschrieben.

## Akzeptanztest

1. Frequenzabgleich abschließen (mind. ein Lauf). Tabelle aufrufen.
2. Spalte ganz rechts vor „Status" heißt jetzt **„Unsicherheit (ges.)"**
   (Spalten-Tooltip: „Kombinierte Messunsicherheit: Mittel aus
   Restunsicherheit pro Lauf und Streuung über alle Läufe").
3. Pro Elektrode steht in dieser Spalte die `combinedUncertainty` in ct,
   mit Ampelfarbe (≤10 ct grün, 11–25 ct gelb-orange, >25 ct rot).
4. Bei einer Elektrode mit `not-perceivable`-Status: „—" (grau).
5. Bei einem einzigen Lauf: `combinedUncertainty` ≈ `residual`
   (Streuung über Läufe ist 0).
6. Nach zweitem Lauf: `combinedUncertainty` ist typischerweise größer
   als das Residuum eines einzelnen Laufs (Streuung kommt hinzu).
7. Spalte „Restunsicherheit" bleibt unverändert (zeigt das mittlere
   Lauf-interne Residuum).

## Schritt 1 — Version-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.95-beta";
```

## Schritt 2 — Spalten-Header umbenennen

In `js/results.js`, Z. 364. **Ersetzen**:

```js
// vorher
    "<th title=\"" + t("fmrThDeltaTip") + "\">" + t("fmrThDelta") + "</th>" +
// nachher
    "<th title=\"" + t("fmrThCombinedTip") + "\">" + t("fmrThCombined") + "</th>" +
```

## Schritt 3 — Spalten-Zelle umstellen

In `js/results.js`, Z. 466–476. **Ersetzen**:

```js
// vorher
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
// nachher
      let combinedCell;
      // not-perceivable und kein Wert → "—"
      const isNotPerc = (r.fmStatus === 'not-perceivable');
      if (isNotPerc || r.fmCombinedUncertainty == null) {
        combinedCell = "<span style=\"color:#9ca3af\">—</span>";
      } else {
        const cu = Math.round(r.fmCombinedUncertainty);
        const cuColor = cu <= 10 ? '#16a34a'
                      : cu <= 25 ? '#d97706'
                      :            '#dc2626';
        combinedCell = "<span style=\"color:" + cuColor + ";font-weight:600\">±"
                     + cu + " ct</span>";
      }
```

Weiter unten im `tr.innerHTML`-Block: die `deltaCell`-Referenz durch
`combinedCell` ersetzen (gleiche Position).

## Schritt 4 — `fmCombinedUncertainty` in den Row-Daten erscheinen lassen

In `js/results.js` an der Stelle, wo die Daten pro Elektrode in das
`r`-Objekt zusammengestellt werden (sucht der Bauer am besten über
`fmResidual:` als Anker — direkt darunter / dazwischen liegen die
fm-Felder). Pro Eintrag ergänzen:

```js
fmCombinedUncertainty: (fr && typeof fr === 'object' && fr.fmCombinedUncertainty != null)
                       ? fr.fmCombinedUncertainty : null,
```

Dabei ist `fr` ein `fRes`-Eintrag (Objekt aus dem Array, gefunden via
`findIndex` über `elIdx`). Wenn das Feld auf einem alten Datensatz
fehlt oder `fr` aus irgendeinem Grund kein Objekt ist: `null`, Anzeige
zeigt „—".

**Wichtig (Lessons learned, Edge-Case):**
- Wenn `r.fmStatus` aus alten Datensätzen `'converged-noisy'` ist (vor BA 96),
  muß die Spaltenanzeige weiterhin sinnvoll funktionieren. Status-Badge-Switch
  in Z. 487 bleibt unverändert; BA 96 ergänzt die neuen Stati.
- Die zwei results.js-Helper `_fmrBuildInProgressEntries` und
  `_fmrCollectNotPerceivable`, die Sonnet bei BA 93/94 angepasst hat,
  sollten ebenfalls `fmCombinedUncertainty` weiterreichen, falls sie
  vorläufige oder not-perceivable-Einträge mit Residuum-Spalte
  produzieren. Vor dem Bau einmal beide Helper inspizieren und in
  der Selbstprüfung melden, was angepasst wurde.

## Schritt 5 — i18n-Keys

In `i18n/de.js`, neue Keys ergänzen (alte `fmrThDelta` / `fmrThDeltaTip`
können stehen bleiben für Backwards-Compat, sind aber tote Strings):

```js
    fmrThCombined: "Unsicherheit (ges.)",
    fmrThCombinedTip: "Kombinierte Messunsicherheit: Mittel aus Restunsicherheit pro Lauf und Streuung über alle Läufe.",
```

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe.

Zusätzlich gegenchecken:
- `fr.combinedUncertainty` wird in der Datenzeile ausgelesen. Wenn `fr`
  ein primitiver Number ist (Alt-Format), darf kein Crash entstehen
  (`typeof === 'object'`-Guard).
- Spalte zeigt bei `not-perceivable` zuverlässig „—" und nicht „±0 ct".

## Hinweis

`fmDelta` wird nach dieser BA in der Tabelle nicht mehr gelesen. Die
Schreibstelle in `_fmWriteResult` (BA 93) hat das Feld auf `null`
zementiert — kein toter Schreibcode mehr nötig, aber auch keine
Aufräumarbeit jetzt: das Feld kann in `fRes`-Einträgen weiterhin
gesetzt werden (= `null`), wird einfach nicht mehr angezeigt.

i18n en/fr/es der zwei neuen Keys folgt in der Mini-Anleitung am Ende
der BA-Serie.
