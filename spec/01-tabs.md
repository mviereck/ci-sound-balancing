## Tab-Übersicht

- **Einführung** (intro) — Begrüßung; unter der Einführungs-Beschreibung steht ein Link „Ausführliche Bedienungsanleitung", der je nach gewählter Oberflächen-Sprache auf README_de.md, README_en.md, README_fr.md oder README_es.md im GitHub-Repo zeigt (öffnet in neuem Tab). Sprachumschaltung aktualisiert sowohl Linktext als auch Ziel-URL.
- **Implantat** (setup) — Konfiguration, Hersteller-/Modell-Auswahl,
  globale Implantat-Parameter, Frequenz- und Elektrodentabelle (siehe
  „Implantat-Tab" unten)
- **Messungen** (messungen) — drei Sub-Tabs (siehe unten)
- **Meßergebnisse** (ergebnisse) — drei Sub-Tabs für
  Elektrodenlautstärke-Balance, Stereo-Balance, Frequenzabgleich
- **Kurven** (levels) — 4-Linien-Chart (Messung / Manuell / Preset /
  Summe) + Preset-Tabelle. Kein manuelles Eingabegitter mehr.
  Manuell-Linie Default aus. DOM-ID historisch `panel-levels` /
  `tabLevels`.
- **Schieber** (schieber) — senkrechte Balken pro Elektrode, manuelle
  dB-Offsets mit Pfeiltasten; Hauptmodul levels-tab.js. DOM-ID
  historisch `panel-schieber` / `tabSchieber`. In der Tab-Leiste
  steht Schieber **nach** Kurven.
- **Player** (player)
- **Laden/Speichern** (file)
- **Footer** — am Seitenende, immer sichtbar. Enthält Versions-Tag,
  Impressum, MIT-Lizenz, GitHub-Link. Impressum-Inhalt fix deutsch
  (rechtliche Pflicht); Footer-Labels in allen vier UI-Sprachen.
