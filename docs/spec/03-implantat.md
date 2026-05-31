## Implantat-Tab

- **Konfigurations-Dropdown**: ci (Default), hg, normal, schwerhörig,
  taub. Bestimmt, welche Eingabebereiche sichtbar sind.
- **Hersteller-Auswahl**: MED-EL / Advanced Bionics / Cochlear.
  Bestimmt Elektrodenzahl (12/16/22) und Einheit für Upper-Level
  (MCL/qu / M-Level/CU / C-Level/CL).
- **Audio-Prozessor-Modell**: Dropdown, herstellerspezifisch.
- **Implantat-Modell + Generation**: Dropdown. Bei Cochlear bestimmt
  das Modell automatisch die Generation A (alte Stromformel,
  0.176 dB/CL) oder B (Freedom+, 0.157 dB/CL).
- **Globale Implantat-Parameter**: c-Wert (MED-EL), IDR / IIDR
  (Cochlear: IIDR Default 40 dB; AB: IDR Default 60 dB). Werden für
  die Umrechnung dB → Hersteller-Einheit im Druck genutzt.
- **Frequenz- und Elektrodentabelle** (`freq-table.js`), pro Elektrode:
  - Beschriftung mit Elektrodennummer und (bei i=0/i=n−1) apikal/basal
  - Hz Standard (Herstellervorgabe, nicht editierbar)
  - Hz eigen (optionaler abweichender Wert)
  - **Cent** re 1000 Hz: `Math.round(hzToCent(effFreq(i)))`, nicht
    editierbar, mit Vorzeichen (`+135`, `−3670`). Aktualisiert sich
    sofort, wenn Hz-eigen geändert wird.
  - **THR** (Hörschwelle) in Hersteller-Einheit (qu/CL/CU)
  - **Upper Level**: MCL bei MED-EL (qu), C-Level bei Cochlear (CL),
    M-Level bei AB (CU)
  - Play- und Hold-Buttons (Einzelton anhören)
  - Status-Dropdown: ok, leicht/mittel/stark verrauscht, fast stumm,
    stumm, deaktiviert
  - Ausschluss-Checkbox (deaktivierte Elektroden automatisch
    ausgeschlossen)
  - Notiz-Feld
- Werte stehen in `sideData[side].implant.thr[i]` und `.mcl[i]`
  (MED-EL) bzw. `.upperLevel[i]` (Cochlear/AB).
- Eingaben sind optional. Ohne THR/Upper-Level zeigt der Druck die
  dB-Korrekturen nur als Relativwerte; mit eingetragenen Werten
  werden zusätzlich absolute Audiologen-Empfehlungen (qu/CL/CU)
  berechnet (`calcMedel`, `calcCochlear`, `calcAB` in `core.js`).
- Berechnungsgrundlagen aller drei Hersteller-Umrechnungen siehe
  `Berechnungsgrundlagen dB zu CI.md`.

## Plausibilitätsprüfung der User-Eingaben

Modul `js/implant-validate.js`. Aufruf nach jedem Re-Render der
Frequenztabelle (Hook am Ende von `buildFreqTable`) sowie direkt
aus den `change`-Handlern der THR- und Upper-Level-Felder in
`freq-table.js` (damit Warnungen ohne vollständigen Re-Render
sofort erscheinen, BA 139-bugfix). Drei
Auffälligkeits-Stufen:

- **Rot** (Level 1): logisch falsch, eindeutig fehlerhaft.
- **Orange** (Level 2): Tippfehler-Verdacht
  (Größenordnungs-Abweichung).
- **Gelb** (Level 3): Auffälligkeit, kann real sein.

Warnungen werden in der Box „Plausibilitätsprüfung" unter dem
Sweep/Stop-Block aufgelistet (einklappbar, per Default offen,
scrollbar bei vielen Einträgen). Zusätzlich bekommt das betroffene
Eingabefeld einen farbigen Rahmen in der Stufe der strengsten
aktiven Warnung; Tooltip am Feld zeigt den Begründungstext. Reine
Warnungen, keine harten Sperren.

Ein Warning-Objekt darf in `field` einen String oder ein
String-Array enthalten — letzteres markiert mehrere Felder
derselben Elektrode gleichzeitig (verwendet beim THR/Upper-
Konflikt, BA 138).

Persistenz: keine — bei jedem Re-Render wird neu geprüft. Eine
einmal gesehene Warnung erscheint in der nächsten Session wieder,
wenn die Eingabe unverändert ist.

BA 133: Grundgerüst und erste Prüfung (Hz-Monotonie zwischen
benachbarten Elektroden).

### Hz-Prüfungen (Stand BA 137)

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
- **Cochlear-FAT-Lookup** (BA 135, Level 2/3): nur aktiv bei
  Hersteller Cochlear und n_aktiv = 22 (alle Kanäle aktiv).
  Vergleich der User-Override-Werte mit der Standard-FAT
  (LFE 188 Hz, HFE 7938 Hz, Datendatei
  `js/data/cochlear-fats.js`, Quelle CI Select Manual S. 12/13).
  Abweichung ≥ 300 Cent → Level 3 gelb, ≥ 600 Cent → Level 2
  orange. Alternative LFE/HFE-Kombinationen und reduzierte
  Elektrodenzahlen werden in einer späteren Anleitung abgedeckt.
- **Trend-Abweichung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB und mindestens 3 User-Override-Werten in
  der Hz-eigen-Spalte. Für jeden Override wird der Cent-Versatz
  vom Default berechnet; der Trend an dieser Elektrode ist der
  Median der Versatzwerte der Nachbarn (Fenster ±2, ohne i
  selbst, via `_implLocalNeighborMedian`). Abweichung vom Trend
  ≥ 300 Cent → Level 3 gelb, ≥ 600 Cent → Level 2 orange.
- **Lokaler Sprung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB. Vergleich der Cent-Schrittweite zwischen
  benachbarten Elektroden (mit mindestens einem Override im
  Paar) gegen die Default-Schrittweite an dieser Stelle.
  Abweichung ≥ 400 Cent → Level 3 gelb, ≥ 700 Cent → Level 2
  orange. Warnung markiert das rechte Feld des Paars
  (Elektrode mit höherem Index).

### THR/Upper-Level-Prüfungen (Stand BA 138)

Geprüft werden `s.implant.thr[i]` und `s.implant.mcl[i]` (MED-EL)
bzw. `s.implant.upperLevel[i]` (Cochlear/AB) für aktive
(nicht-deaktivierte) Elektroden.

- **Wertebereich** (BA 138, Level 1 rot): außerhalb hersteller-
  spezifischer Hardware-Grenzen (`IMPL_VAL_THR_UPPER_RANGE`).
  MED-EL THR/MCL 0–268.6 qu, Cochlear 0–255 CL, AB 0–1000 CU.
- **THR ≥ Upper-Level-Konflikt** (BA 138, Level 1 rot):
  physiologisch unmöglich. Ein Warning markiert **beide** Felder
  derselben Zeile (THR und Upper) — Schema-Erweiterung: `field`
  kann String oder Array sein.
- **Größenordnung** (BA 138, Level 2 orange): Faktor ≥10 oder
  ≤1/10 gegen Spaltenmedian. Aktivierung ab 3 Werten in der
  Spalte.
- **MAD-Ausreißer** (BA 138, Level 3 gelb): |x − median| > 3·MAD.
  Aktivierung ab 5 Werten. Status-Werte außer „im CI deaktiviert"
  haben keinen Einfluss auf die Prüfung — auch verrauschte oder
  stumme Elektroden bleiben in der MAD-Statistik enthalten und
  bekommen ggf. Warnungen (BA 140-fix).

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
eine verwandte, aber nicht identische Bedingung: Auslöser ≥1
deaktivierte Elektrode; Bedingung: mindestens eine **aktive**
(nicht-deaktivierte) Elektrode hat noch keinen Hz-eigen-Override
(Bugfix BA 142 — vorher wurde fälschlich auf deaktivierte
Elektroden geprüft). Es bleibt parallel bestehen. Eine spätere
Konsolidierung kann den Banner durch diese Prüfung ersetzen.

### Cochlear-Default-Korrektur (BA 136)

`MFR.cochlear.freqs` in `js/core.js` wurde am 2026-05-31 auf
die offiziellen Werte aus dem CI Select App Manual (LFE 188 Hz,
HFE 7938 Hz, 22 Kanäle) korrigiert. Positionen 0–8 unverändert,
9–21 verschoben um bis zu ~125 Cent (max bei E1 basal).

Gespeicherte `fRes`-Einträge mit `timestamp` vor der
Korrektur-Konstante `COCHLEAR_FAT_CORRECTION_DATE` beziehen
sich auf die alten Defaults. Im Frequenzabgleich-Reiter wird
für Cochlear-User mit solchen Einträgen eine sanfte Info-Box
oben angezeigt, die zum Re-Test rät.
