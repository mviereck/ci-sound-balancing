## Tab-Übersicht

- **Einführung** (intro) — Begrüßung; unter der Einführungs-Beschreibung steht ein Link „Ausführliche Bedienungsanleitung", der je nach gewählter Oberflächen-Sprache auf README_de.md, README_en.md, README_fr.md oder README_es.md im GitHub-Repo zeigt (öffnet in neuem Tab). Sprachumschaltung aktualisiert sowohl Linktext als auch Ziel-URL. Der Ablauf-Block (`introFlowDesc`) umfaßt sechs Schritte: 1. Seite, 2. Implantat (mit eingebetteter „Wichtig"-Zeile zu deaktivierten Elektroden), 3. Lautstärke (neu: auf ~3/4 einstellen), 4. Messung (mit Pfad „Messungen → Elektrodenlautstärke"), 5. Player, 6. Levels. Am Ende des Tabs: zweite Karte `.card.support-card-call.card-support-hint` mit Spendenaufruf und Link-Button zum Unterstützung-Tab (`switchTab('unterstuetzung')`); orangefarbener Linksrand über `.card-support-hint`.
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
- **Unterstützung** (unterstuetzung) — Drei Karten: (1) Spendenaufruf mit zwei Bot-geschützten Dialogen (Bankverbindung mit IBAN/BIC/QR-Code, Kontakt-E-Mail); sensible Daten werden erst beim Klick aus Fragmenten zusammengebaut, stehen nicht im HTML-Quelltext. (2) Offenlegung der Finanzierung: Vergleichstabelle Vollausbau vs. aktueller Stand, Einzelposten und Summen aus `finanzen.js` (`FINANZEN.posten`, `FINANZEN.donationsMonthly`), Summen-/Differenz-Berechnung in `finBerechne()`; darunter Liste „Geplant"/„In Erwägung". (3) Mehrsprachiger Slogan (per `data-t` in aktiver UI-Sprache). Tab wird wie alle Top-Level-Tabs während laufender Tests gesperrt. Nicht Teil des „Alles drucken"-Ablaufs.
- **Links** (links) — Letzter Top-Level-Tab. Zwei Karten: (1) „Ressourcen rund um CI und Hören" — externe Projekte und Tools (eira, Pico-ASHA, HearWell, Binaural CI Alignment, asha_pipewire_sink, MUSIC REHAB, Online Tone Generator, Hör-Wiki, Project Gutenberg) als `<article class="link-entry">`-Blöcke mit Homepage- und/oder Projektseite-Link plus Beschreibung. (2) „Quellen für verwendete Audiodateien" — Thorsten-Voice, Common Voice (mit inoffiziellem Mirror auf Hugging Face), OpenSLR. Alle Links öffnen in neuem Tab (`target="_blank" rel="noopener noreferrer"`). i18n-Schlüssel: `tabLinks`, `linksTitle`, `linksIntro`, `linksHomepageLabel`, `linksProjectLabel`, `linksWebsiteLabel`, `linksMirrorLabel`, `linksAudioTitle`, `linksAudioIntro` sowie pro Eintrag `links<Name>Desc`. Tab wird wie alle Top-Level-Tabs während laufender Tests gesperrt. Nicht Teil des „Alles drucken"-Ablaufs. CSS-Klassen: `.link-entry`, `.link-entry-urls` in style.css.
- **Slogan-Karte** — außerhalb aller Panels, immer sichtbar (unter jedem Tab). Enthält den kursiven Slogan-Text (`supportSlogan`). CSS-Klasse `.support-card-slogan`.
- **Footer** — am Seitenende, immer sichtbar. Enthält Versions-Tag,
  Impressum, MIT-Lizenz, GitHub-Link. Impressum-Inhalt fix deutsch
  (rechtliche Pflicht); Footer-Labels in allen vier UI-Sprachen.

## Tab/Subtab-Persistenz

Der zuletzt aktive Top-Level-Tab und die zuletzt aktiven Sub-Tabs in
„Messungen" und „Meßergebnisse" überleben einen Browser-Reload. Sie
werden in `localStorage` gespeichert (separat vom JSON-Save):

- `ci-lb-activeTab` — aktiver Top-Level-Tab
- `ci-lb-subtab-messungen` — aktiver Sub-Tab in „Messungen"
- `ci-lb-subtab-ergebnisse` — aktiver Sub-Tab in „Meßergebnisse"

Schreiben: `switchTab` (tabs-eq.js) und `switchSubtab` (tabs-eq.js) nach
jedem Wechsel. Restore: am Ende des DOMContentLoaded-Handlers in init.js,
nach allen anderen Init-Schritten. Nicht mehr existierende Tab-Werte
werden ignoriert, Default-Tab bleibt dann aktiv.
