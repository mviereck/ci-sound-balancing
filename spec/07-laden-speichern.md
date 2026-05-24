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
