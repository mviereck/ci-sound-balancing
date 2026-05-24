## Messungen — drei Sub-Tabs

Alle drei Tests teilen sich denselben Aufbau, erzeugt durch den
Builder `buildTestPanel` aus test-ui.js. Drei Blöcke pro Test:

1. **Erklärungen** (reiner Text)
2. **Voreinstellungen** (Bedienelemente vor dem Test, Start/Stop)
3. **Test** (während der Messung; sperrt alle anderen Tabs und
   Sub-Tabs)

### Globale Test-Einstellungen

In `state-side.js` und persistiert in JSON und localStorage:

- **Tonart** (`globalToneType`) — Sinus / Komplexton / Rauschen /
  Schmalbandrauschen adaptiv / AM-Sinus / Warble-Sinus / Sinus-Bursts
  / Wobble-Sweep. Default `'sine'` (Sinus). Dropdown im
  Voreinstellungs-Block aller drei Tests sichtbar; alle Instanzen an
  dieselbe Variable gebunden.
- **Tonfolge** (`globalSequence`) — `'aba'` oder `'ab'`. Default
  `'aba'`. Vor dem Test wählbar, während des Tests fest.

### Slider-Wirkung (pro Test eigener Wert)

- **Test 1** (`slTarget_test`): A / B / Balance. Default `Balance`.
  Bei Slider +6 dB im Modus Balance: A wird mit −3 dB, B mit +3 dB
  gespielt.
- **Test 2** (`slTarget_balance`): Links / Rechts / Beide. Default
  `Beide`, symmetrisch wie in Test 1.
- **Test 3**: kein Dropdown, intern fest auf der
  Nicht-Referenzohr-Seite (CI-Ohr).

**Modus-Wechsel zur Laufzeit**: Slider-Wert wird übernommen
(relativer Lautheitsunterschied bleibt). **Swap (A↔B / L↔R)**:
Slider-Wert wird invertiert.

### Slider-Bedienung

- **Pfeiltasten ±0,5 dB**, Shift+Pfeil ±0,1 dB (Test 1 und 2)
- **Pfeiltasten ±5 cent**, Shift+Pfeil ±1 cent (Test 3)
- **Touch-Bedienleiste** direkt unter jedem Slider (auch auf
  Desktop sichtbar): Buttons − / Fein / + und Replay (Wiederholen).
  Long-Press = Auto-Repeat. Der Fein-Toggle ersetzt Shift+Pfeil und
  bleibt aktiv, bis erneut getippt.
- Slider-Bereich in 3 Stufen erweiterbar:
  - Test 1+2: ±20 dB → ±40 dB → ±60 dB
  - Test 3: ±100 cent → ±500 cent → ±1200 cent
- Tastatursteuerung muß fokus-robust sein (nach Klick auf Buttons,
  Dropdowns, Checkboxen weiterhin nutzbar)

### Elektroden-Ausschluß

- Zwei rote Buttons im Test-Block, kein Tastenkürzel
- Bestätigungsdialog vor Ausschluß
- Ausschluß betrifft **alle** Testverfahren, änderbar im Reiter
  Implantat
- In Levels, Chart, Frequenztabelle und Sweep sind alle Elektroden
  sichtbar und editierbar

### Confidence-Auswahl (vorbereitet, ohne Funktion)

- 5 Radios pro Test: keine Angabe (Default) / sicher / mittel /
  unsicher / unbrauchbar
- Hinweis: „wird derzeit nicht ausgewertet und nicht gespeichert"
- Nach jedem Confirm zurück auf „keine Angabe"

### Resume

- **Nur Test 1 im Modus „full" (Round-Robin)**: bestätigte Paare
  bleiben über Stop/Browser-Neustart hinweg gespeichert
  (`fullSweepRound`, `fullSweepDonePairs` in `sideData[side]`). Undo
  entfernt das Paar wieder aus der Done-Liste.
- **Test 1 conv_fast und manual**: kein Resume.
- **Test 2 und Test 3**: kein Resume.
- UI-Texte suggerieren Resume nur dort, wo es tatsächlich greift.

### Sub-Tab 1 — Elektrodenlautstärke ausgleichen (test.js)

- **Modi**: balance (Slider) und judgment (3-Knopf-Urteil)
- **Testverfahren**: vollständig (alle Paare) / Konvergenz schnell /
  manuell
- A/B-Zuordnung und Paarreihenfolge immer randomisiert
- Referenzelektroden-Auswahl erfolgt im Ergebnis-Reiter
  (Elektrodenlautstärke-Balance), nicht mehr im Test selbst. Sie
  wirkt nur auf die Anzeige und Anwendung der Ergebnisse, nicht auf
  die Messung.
- Vorkorrektur-Schalter (preCorrect)
- Wenn Modus „Vollständig" angefangen aber nicht abgeschlossen wurde,
  zeigt der Ergebnis-Reiter oben einen Hinweis mit Runde X von Y und
  bestätigten Paaren des aktuellen Sweeps.

### Sub-Tab 2 — Stereo-Balance (lr-balance.js)

- Reihenfolge der Elektroden: zufällig / apikal→basal / basal→apikal
- Seitenfolge: zufällig / L→R / R→L
- Vergleicht gleiche Frequenz auf beiden Ohren
- Vorbedingung „erst Test 1 ausführen" ist nicht zwingend, sondern
  reiner Hinweis

### Sub-Tab 3 — Frequenzabgleich (freqmatch.js)

- Cent-Slider (statt dB)
- Vergleicht CI-Elektroden-Ton vs. variabler Sinus auf der
  Restgehör-Seite
- Referenzseite-Auswahl (LINKS/RECHTS = welche Seite ist Restgehör)
- Bei Wechsel des Referenzohrs nach vorhandenen Ergebnissen:
  Bestätigungsdialog, Verwerfen der bisherigen Ergebnisse
- Ergebnis-Diagramm: X-Achse log-Hz (CI-Frequenz `varFreq`), Y-Achse
  lineare Cent-Abweichung (positiv = subjektiv höher als CI-Frequenz,
  negativ = tiefer). Null-Linie = perfekter Match.

### Sub-Tab 4 — Latenz (latency.js)

- Schieber ±200 ms, Auflösung 1 ms / 0,1 ms (Fein-Toggle per Touch-Bedienleiste). Auf Desktop zusätzlich Ctrl+Pfeil = 10 ms wie bisher.
- Schieber ist **nur während laufendem Test** bedienbar (sonst disabled)
- Klick-Intervall manuell wählbar: 100 / 200 / 500 / 1000 / 2000 ms
- 4 Klangvarianten: Klick (breitband), 500 Hz, 1500 Hz, 4 kHz Tone-Bursts
- **Nur mit Kabel-Kopfhörer durchführen** — Bluetooth verfälscht die Messung
  (Hinweis-Box im Messpanel, nach der Überschrift)
- Mess-Panel: Überschrift → kurze Beschreibung → Wichtig-Hinweis (BT) →
  Schieber-Anleitung → Hinweis auf Ortungswahrnehmung als Anhaltspunkt
- Beim **Stop** wird der aktuelle Schieberwert automatisch als `latencyResult`
  übernommen (kein separater „Übernehmen"-Button)
- Während des Tests: alle anderen Tabs und Sub-Tabs gesperrt (wie bei allen
  anderen Tests — via `lockTestTabs` / `updateTabLockState`)
- Wirkung live im Player (`latApplyToPlayer`), sofern `plApplyLatency` aktiv
- Persistenz: `latencyResult` und `plApplyLatency` werden gespeichert/geladen
  (beide Pfade: file.js-Download/Upload und localStorage-Auto-Restore in init.js)
- Ergebnis-Sub-Tab „Latenz": zentrierte Highlight-Box (wie Stereo-Balance)
  mit Label, großem Zahlenwert in Akzentfarbe + Monospace, kurzem Klartext;
  Kontext (Klangtyp + Intervall) darunter; kein „Wird ausgeglichen."
- Im Player: Toggle-Button „Latenzausgleich" (`plLatApplyBtn`) neben
  „Stereo-Balance"-Button — aktiviert/deaktiviert `plApplyLatency`;
  grün wenn aktiv, grau wenn inaktiv; Sync via `updLatApplyBtn()` in tabs-eq.js
- Druck-Unterstützung via `_printResLatency` in tab-print.js
