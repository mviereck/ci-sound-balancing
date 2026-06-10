# Bauanleitung 46 — Audiologen-Bericht: Sektion „Aktive Kurvenfunktionen"

## Worum es geht

Im Audiologen-Druck (Modus B, `print-md.js`/`audiologPrint`) sieht der
Audiologe pro Seite die ΔdB-Werte je Elektrode. Die im Tab „Kurven"
aktivierten Kurvenfunktionen (Speech, Volume, Tilt, SCurve, Pivot,
Gauss, Bassboost, Highboost) sind in diese ΔdB-Werte zwar eingerechnet,
aber **nicht explizit benannt**. Der Audiologe sieht also Netto-Werte,
weiß aber nicht, dass z.B. „SCurve mit Stärke −1.7 dB" und „Gauss mit
Stärke +4 dB" der Grund sind.

Gewünscht: Pro Seite eine zusätzliche H3-Sektion **„Aktive
Kurvenfunktionen"** mit Typ, Stärke, ggf. Center / Breite / Cutoff.
Erscheint nur, wenn auf dieser Seite mindestens eine Kurve aktiv ist
(`p.on && p.strength !== 0`). Reihenfolge im Pro-Seite-Block: nach der
Lautstärken-Korrektur-Tabelle, vor MAPLAW.

Die nötigen Bausteine existieren bereits — `_archivMdKurven` in
`print-md.js` macht im Archiv-Bericht das gleiche, und alle i18n-Keys
sind da. Nur eine Hilfsfunktion und ein Aufruf im
`buildAudiologMarkdown` fehlen, plus genau **ein** neuer i18n-Key für
die Sektion-Überschrift.

## Stelle 1 — Neue Hilfsfunktion in `print-md.js`

In `print-md.js` direkt **nach** der Funktion `_audiologFreqTable`
(endet ca. Z. 884, kurz vor `_audiologMaplawSection`) einfügen:

```js
// ---------- Aktive Kurvenfunktionen pro Seite ----------
// Liefert einen Markdown-Block mit Sektion-Überschrift und einer
// Bullet-Liste der aktiven Kurven für die übergebene Seite. Wenn
// keine Kurve aktiv ist, leerer String — Aufrufer entscheidet, ob
// das Ergebnis eingehängt wird.
function _audiologCurvesSection(side) {
  return withSide(side, () => {
    const active = (presets || []).filter((p) => p.on && p.strength !== 0);
    if (active.length === 0) return "";
    const lines = [];
    lines.push(`### ${t("audiologSecCurves")}`);
    lines.push("");
    for (const p of active) {
      const name = (typeof PR_NAMES !== "undefined" && PR_NAMES[p.type])
        ? t(PR_NAMES[p.type]) : p.type;
      const parts = [];
      const strSign = p.strength >= 0 ? "+" : "";
      parts.push(`${t("archivKurvStrength")}: ${strSign}${p.strength} dB`);
      if (p.center !== undefined && p.center !== null) {
        const ci = Math.round(p.center);
        parts.push(`${t("archivKurvCenter")}: ${dENPrefix()}${dEN(ci)}`);
      }
      if (p.width !== undefined && p.width !== null) {
        parts.push(`${t("archivKurvWidth")}: ${p.width}`);
      }
      if (p.cutoff !== undefined && p.cutoff !== null) {
        parts.push(`${t("archivKurvCutoff")}: ${dENPrefix()}${dEN(p.cutoff)}`);
      }
      lines.push(`- **${name}** — ${parts.join(", ")}`);
    }
    lines.push("");
    return lines.join("\n");
  });
}
```

Anmerkung: `dEN`/`dENPrefix` sind innerhalb `withSide` auf die jeweilige
Seite gebunden, daher liefern sie die korrekten Elektrodenbezeichner.

## Stelle 2 — Einbau in `buildAudiologMarkdown`

In `print-md.js`, in der Funktion `buildAudiologMarkdown`, in der
Pro-Seite-Schleife (aktuell ca. Z. 1102–1147). **Nach** der
Lautstärken-Korrektur-Tabelle und **vor** der MAPLAW-Sektion einfügen.
Kontextblock:

```js
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // H3 MAPLAW-Änderung — falls relevant für diese Seite
    const mlSide = _audiologMaplawSection([side], "###");
    if (mlSide) parts.push(mlSide);
```

wird zu:

```js
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // H3 Aktive Kurvenfunktionen — nur wenn diese Seite welche hat
    const curvesSide = _audiologCurvesSection(side);
    if (curvesSide) parts.push(curvesSide);

    // H3 MAPLAW-Änderung — falls relevant für diese Seite
    const mlSide = _audiologMaplawSection([side], "###");
    if (mlSide) parts.push(mlSide);
```

## Stelle 3 — Neuer i18n-Key in `i18n.js`

Genau **ein** neuer Schlüssel, in allen vier Sprachen. Einfügen in
jedem Sprachblock direkt nach `audiologSecLoudness`:

- de: `audiologSecCurves: "Aktive Kurvenfunktionen",`
- en: `audiologSecCurves: "Active curve functions",`
- fr: `audiologSecCurves: "Fonctions de courbe actives",`
- es: `audiologSecCurves: "Funciones de curva activas",`

## Stelle 4 — CODESTRUKTUR.md

Im Abschnitt **„Audiologen-Auftrag (Modus B)"** (Datenfluss-Block)
ergänzen:

- Reihenfolge im Pro-Seite-Block jetzt: Lautstärken-Korrektur →
  **Aktive Kurvenfunktionen** (wenn welche aktiv) → MAPLAW (wenn
  applikabel) → Mittenfrequenzen (wenn Warp aktiv).
- Neue Helper-Funktion `_audiologCurvesSection(side)` erwähnen, mit
  Hinweis, dass sie Preset-Daten aus `sideData[side].presets` per
  `withSide` liest und mit `dEN`/`dENPrefix` der Seite formatiert.

## Stelle 5 — SPEC.md

Im Abschnitt zum Audiologen-Bericht (Funktionsspezifikation) den neuen
Pro-Seite-Block „Aktive Kurvenfunktionen" eintragen: erscheint, wenn
auf der Seite ≥1 Kurve mit `on=true && strength!=0` aktiv ist, listet
pro Kurve Typ, Stärke und ggf. Center/Breite/Cutoff. Inhaltsgleich mit
der Archiv-Box.

## Akzeptanztest-Checkliste (manuell im Browser)

1. Tool laden. Implantat-Tab: links Hörgerät/Schwerhörig, rechts
   CI MED-EL (oder Tester-Setup, das bereits so ist).
2. Side-Button **„RECHTS"** wählen.
3. Im Kurven-Tab zwei Kurven aktivieren mit Stärke ≠ 0, z.B.
   - SCurve, Stärke −1.7 dB, Center E5–E6.
   - Gauss, Stärke +4 dB, Center E7, Breite 4.
4. In den Laden/Speichern-Tab wechseln.
5. „Bericht für Audiologen" → „Bericht drucken" klicken. Vorschau-
   Fenster öffnet sich.
6. Im Pro-Seite-Block **„RECHTS"** ist nach der „Lautstärken-Änderung"-
   Tabelle eine neue Sektion **„Aktive Kurvenfunktionen"** sichtbar
   mit den beiden Bullet-Punkten:
   - **SCurve** — Stärke: −1.7 dB, Center: E5–E6 (oder vergleichbar).
   - **Gauss** — Stärke: +4 dB, Center: E7, Breite: 4.
7. Im Pro-Seite-Block **„LINKS"** erscheint **keine** Kurven-Sektion
   (weil dort nichts aktiv ist). Die Lautstärken-Tabelle für LINKS
   bleibt — auch wenn sie nur Nullen zeigt; das ist akzeptiert.
8. Markdown-Download („Bericht herunterladen") prüfen: der erzeugte
   `.md`-Text enthält den gleichen Block in Markdown-Syntax.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar, mit Datei- und
Zeilenangabe.

Insbesondere prüfen:
- Erscheint die Sektion **nur** dann, wenn auf der konkreten Seite
  Kurven aktiv sind? (Nicht die globalen `presets` prüfen, sondern
  per `withSide(side, …)` die seiten-spezifischen.)
- Wird `PR_NAMES[p.type]` korrekt in die jeweilige Sprache übersetzt?
- Sind `dEN`/`dENPrefix` für die richtige Seite gebunden (innerhalb
  `withSide`)?

Bei Unklarheit lieber Rückfrage stellen als annehmen.
