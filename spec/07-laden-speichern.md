## Globaler Dateinamen-Suffix

Oberhalb der Karten Archiv-Box und Audiologen-Box steht eine globale
Eingabezeile „Dateinamen ergänzen um eigenes Wort". Der eingegebene
Wert wird beim Speichern aller exportierten Dateien (JSON-Save,
EasyEffects-Export, Archiv-Markdown, Audiologen-Markdown) ans Ende
des Dateinamens gehängt, vor die Datei-Endung, getrennt durch einen
Unterstrich. Vorgeschlagen werden „MAP1" bis „MAP4" über ein Custom-Combobox
(Textfeld + ▼-Button + aufklappende Liste); Freitext ist möglich. Dateinamen-feindliche
Zeichen werden auf `_` reduziert. Persistenz: separater
localStorage-Schlüssel `ci-lb-userFileSuffix` (sofort beim
Eingabe-Change) plus Mitspeicherung im Haupt-Save (`ci-lb-v4`) und
im JSON-Save/Load.

## Speichern und Laden

- JSON mit allen Einstellungen, Meßergebnissen, manuellen Levels,
  Presets, globalen Test-Einstellungen, **Implantat-Daten (Modell,
  Prozessor, MCL, THR, Upper-Level, cValue/IDR/iIDR/Generation),
  manuellen Frequenzen (`electrodeFreqOwn`) und Sweep-Resume-Stand**
- Autosave in localStorage alle 5 Sekunden — speichert dasselbe pro-
  Seite-Datenset wie JSON (insbesondere `implant`, sodaß MCL/THR
  und alle weiteren Implantat-Daten einen Reload überstehen), plus
  Levels-Tab-Anzeigestate und Player-Quellen-Toggles.
- `showSaveFilePicker` mit Fallback auf Download
