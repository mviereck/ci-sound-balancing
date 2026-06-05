## Tab-Übersicht

- **Einführung** (intro) — Begrüßung; unter der Einführungs-Beschreibung steht ein Link „Ausführliche Bedienungsanleitung", der je nach gewählter Oberflächen-Sprache auf README_de.md, README_en.md, README_fr.md oder README_es.md im GitHub-Repo zeigt (öffnet in neuem Tab). Sprachumschaltung aktualisiert sowohl Linktext als auch Ziel-URL. Der Ablauf-Block (`introFlowDesc`) umfaßt sechs Schritte: 1. Seite, 2. Implantat (mit eingebetteter „Wichtig"-Zeile zu deaktivierten Elektroden), 3. Lautstärke (neu: auf ~3/4 einstellen), 4. Messung (mit Pfad „Messungen → Elektrodenlautstärke"), 5. Player, 6. Levels. Am Ende des Tabs: zweite Karte `.card.support-card-call.card-support-hint` mit Spendenaufruf und Link-Button zum Unterstützung-Tab (`switchTab('unterstuetzung')`); orangefarbener Linksrand über `.card-support-hint`. Darunter dritte Karte `.card.card-feedback-hint` mit Feedback-Einladung (GitHub-Issues-Link inline im Text + Link-Button zum Unterstützung-Tab für E-Mail-Kontakt).
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
  Impressum, GNU GPL v2+ (GPL-2.0-or-later), GitHub-Link. Impressum-Inhalt fix deutsch
  (rechtliche Pflicht); Footer-Labels in allen vier UI-Sprachen.

## Tab-Sperre L1 — Voraussetzungs-Sperre (BA 172)

Solange die Implantat-Angaben unzureichend sind, sind vier Hauptreiter
gesperrt: **Messungen**, **Meßergebnisse**, **Kurven**, **Schieber**.
Frei zugänglich bleiben Einführung, Implantat, Player, Laden/Speichern,
Unterstützung, Links. (Player war bis BA 212 ebenfalls gesperrt; ab BA 213
ist er immer zugänglich.)

**Frei-Schwelle:** Beide Seiten haben eine konkrete Hörsituation
(`config ≠ "unknown"`) **und** mindestens eine Seite ist CI mit
gewähltem Hersteller (`config === "ci"` und
`manufacturer ∈ {"medel","ab","cochlear"}`).

**Visuelle Markierung:** Gesperrte Reiter erhalten CSS-Klasse
`.tab-locked` (opacity 0.4, cursor not-allowed). Die Buttons bleiben
klickbar — ein Klick öffnet das Modal.

**Modal `#tabLockModal`** (`.modal-overlay`-Pattern): drei Varianten je
nach Reason —
- `"unconfigured"`: Titel `tabLockTitleStd`, Text `tabLockBodyStd`
  (Auftrag: Implantat-Angaben beider Seiten + Hersteller eintragen)
- `"bothAcoustic"`: Titel `tabLockTitleBothAc`, Text `tabLockBodyBothAc`
  (Hinweis: mindestens eine CI-Seite benötigt)
- `"sideDeaf"` (BA 173, L2): Titel `tabLockTitleSideDeaf`, Text
  `tabLockBodySideDeaf` (Test bei tauber Seite nicht möglich)

**Automatischer Rückwechsel:** Wenn der aktive Reiter durch eine
Implantat-Änderung gesperrt wird, wechselt die Anzeige automatisch auf
den Implantat-Reiter (`setup`) — ohne Modal (der User ändert ja gerade
selbst die Angaben).

**Auslöser** für Neu-Bewertung: `setSideConfig` (state-side.js),
`switchMfr` (freq-table.js), `applyLang` (i18n.js, für
Sprach-Wechsel), initialer Aufruf am Ende von init.js.

## Sub-Tab-Sperre L2 — eine Seite taub (BA 173)

Sobald mindestens eine Seite als „Taub" eingetragen ist
(`config === "deaf"`), werden in **Messungen** drei Sub-Reiter gesperrt:
**Stereo-Balance**, **Latenz**, **Frequenzabgleich**. Diese Tests
vergleichen beide Seiten miteinander und sind auf einer tauben Seite
nicht durchführbar. Frei bleibt nur **Elektrodenlautstärke**.

**Visuelle Markierung:** wie L1 — CSS-Klasse `.tab-locked`, Buttons
bleiben klickbar.

**Klick auf gesperrten Sub-Reiter** öffnet `#tabLockModal` mit
Reason `"sideDeaf"`.

**Automatischer Rückwechsel:** Wenn der aktive Sub-Reiter durch
Umschalten auf „Taub" gesperrt wird, wechselt die Anzeige automatisch
auf **Elektrodenlautstärke** (`test`) — ohne Modal.

**Frequenzabgleich:** Der frühere Inline-Block `#fmBlockedWarning` mit
i18n-Keys `fmBlocked_sideDeaf`/`fmBlocked_bothAcoustic` und die Funktion
`_fmRenderBlockedWarning` entfallen, weil L1 (`bothAcoustic`) und L2
(`sideDeaf`) die Fälle bereits am Tab-Eingang abfangen.

## Player-Bereich-Sperre L3 — eine Seite taub (BA 173)

Im Reiter **Player** werden bei tauber Seite die drei seitenabhängigen
Bereiche disabled angezeigt: **Stereo-Balance**, **Latenzausgleich**,
**Frequenz-Warping**. Neben dem jeweiligen Bereich erscheint ein
kleiner Inline-Hinweis in Warnfarbe (i18n-Key `plLockHintSideDeaf`:
„Nicht verfügbar — Seite als taub eingetragen.").

MAPLAW, Lautstärke, Pause/Play, EQ-Toggle und die „Beide
Seiten"-Checkbox bleiben funktionsfähig.

Umsetzung: Funktion `playerLockApply()` in `player.js`, automatisch
aufgerufen aus `tabLockApply()`.

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

## URL-Hash / Deep Linking

Jeder Tab-Wechsel aktualisiert den URL-Hash per `history.pushState`:

- Top-Level-Tab: `#<tab>` (z. B. `#messungen`)
- Tab + Sub-Tab: `#<tab>:<subtab>` (z. B. `#messungen:freqmatch`)

Ein direkter Link auf einen Tab öffnet diesen beim Laden — der Hash hat
Vorrang vor dem localStorage-Wert. Der Browser-Zurück/Vor-Button
navigiert zwischen Tab-Zuständen. Beim ersten Laden setzt
`history.replaceState` den Hash ohne zusätzlichen History-Eintrag.
