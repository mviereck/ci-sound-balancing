# Ideen und Konzept-Skizzen

Sammelstelle für Erweiterungs- und Designideen, die **noch nicht
gebaut werden sollen**, aber bei zukünftigen Builds berücksichtigt
werden könnten. Abgrenzung:

- **SPEC.md „Offene Punkte"**: Punkte, die konzeptionell abgesegnet
  sind und auf Umsetzung warten. Knapp gehalten.
- **IDEEN.md (diese Datei)**: Punkte, die noch nicht abgesegnet sind,
  bei denen Design-Fragen offen sind, oder die Auswirkungen auf
  zukünftige Architektur-Entscheidungen haben könnten.

Ein Eintrag in IDEEN.md ist erst dann zur Umsetzung reif, wenn er
besprochen und entweder verworfen oder in SPEC.md („Warteliste" oder
direkt in die Feature-Sektion) übernommen wurde.

> **Wartung dieser Datei**: bei jeder neuen Idee, die nicht sofort
> umgesetzt wird, hier einen Eintrag anlegen. Wenn ein Eintrag
> umgesetzt oder verworfen wird: aus dieser Datei entfernen (mit
> Datum und Verweis auf die Umsetzung im Commit).

---

## Levels-Tab — Einheiten-Umschaltung in der Anzeige

**Aufgenommen am**: 2026-05-15
**Status**: nicht gebaut. Modus B (Absolutmodus) zeigt qu/CL/CU
bereits an, dB-Korrekturwerte sind primär in der Anzeige.

**Idee**: Reine Anzeige-Variante, in der die Y-Achsen-Beschriftung
und die Werte oben am Balken **wahlweise** in dB oder in
herstellerspezifischen Einheiten dargestellt werden — unabhängig
vom Modus A/B. Aktuell ist die Achseneinheit an den Modus gekoppelt
(Modus A: dB, Modus B: qu/CL/CU). Eine entkoppelte Anzeige würde
ermöglichen:

- Modus A mit qu-Beschriftung der Y-Achse (relative qu-Korrekturen).
- Modus B mit dB-Beschriftung der Y-Achse als Vergleichshilfe für
  den User, der in dB denkt.

**Voraussetzung**: keine — Umrechnung steckt schon in `core.js`.

**UI-Skizze**: kleiner Einheiten-Toggle in der Toolbar, neben dem
Modus-Toggle. Default: passt zur Modus-Wahl wie bisher.

**Bemerkung**: möglicherweise unnötig, wenn die Anzeige oben am
Balken in beiden Einheiten gleichzeitig steht. Erst klären, ob das
Bedarf abdeckt, bevor diese Idee umgesetzt wird.

