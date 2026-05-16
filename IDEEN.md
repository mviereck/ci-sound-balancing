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

---

## MAPLAW-Simulation

**Aufgenommen am**: 2026-05-16
**Status**: **zurückgestellt** (Stand 2026-05-16). Saubere
Variante (Phase 3 — eigene Filterbank, Hüllkurve pro Band,
Vorverzerrung auf Hüllkurve, Resynthese) ist eine größere
Bauaufgabe (~4–6h Sonnet-Zeit, 2–3 Bauanleitungen). Eine
abgespeckte Phase-1-Variante (Wellenform-Vorverzerrung) klingt
zwar anders, ist aber für eine ehrliche Validierung gegen das
Hardware-Vergleichsprogramm zu ungenau — sie erzeugt Spektral-
Verzerrung statt Hüllkurven-Charakteristik, und die AGC im CI
dämpft den Effekt zusätzlich.

**Geklärt**: Setup ist Bluetooth direkt aufs CI (Setup X), das
Audio durchläuft im Prozessor dieselbe Kette wie ein
Mikrofonsignal außer dem Frontend.

**Bestehender Code**: `pBuildMapNode` in `player.js` und versteckte
UI in `index.html` bleiben unangetastet. Beim nächsten Anfassen
einen Hinweis-Kommentar dort anbringen.

**Ausführliche Diskussion**: siehe `MAPLAW_Konzept.md` im Root.

**Wiederaufnahme**: bei Bedarf — Sonnet-Zeit oder verschobene
Anforderung. Dann offene Fragen 2–7 aus Abschnitt 8 des Konzept-
Papiers klären und die Bauanleitungs-Serie aus Abschnitt 9
schreiben.
