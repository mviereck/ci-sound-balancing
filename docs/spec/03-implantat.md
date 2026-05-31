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
Frequenztabelle (Hook am Ende von `buildFreqTable`). Drei
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

Persistenz: keine — bei jedem Re-Render wird neu geprüft. Eine
einmal gesehene Warnung erscheint in der nächsten Session wieder,
wenn die Eingabe unverändert ist.

BA 133: Grundgerüst und erste Prüfung (Hz-Monotonie zwischen
benachbarten Elektroden).

### Hz-Prüfungen (Stand BA 135)

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
  Elektrodenzahlen werden in BA 137 abgedeckt.

Trend-basierte und hersteller-spezifische Verteilungs-Prüfungen
für MED-EL/AB folgen in BA 136 (Trend und lokale Sprünge).
