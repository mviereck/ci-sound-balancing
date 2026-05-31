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
benachbarten Elektroden). Weitere Prüfungen werden in BA 134 ff.
ergänzt.
