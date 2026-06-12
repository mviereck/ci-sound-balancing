## Player

- Aufbau des Tabs in vier Karten, in dieser Reihenfolge:
  1. **Einleitung** — reine Textbox mit Titel „Audioplayer mit Korrektur-
     Equalizer" und Beschreibung (`plTitle`, `plDesc`). Kein blauer
     Hinweis-Strich, nur normaler Absatz.
  2. **Equalizer-Graph** (`plEqViz`) — Kurven-Canvas plus Tabelle.
     Die Referenzelektrode wird im EQ-Graph durch ein fettes schwarzes
     „Ref.-El."-Label am oberen Rand markiert.
  3. **Einstellungen** (`plSettingsTitle`) — sieben Zeilen: (1) Equalizer
     an/aus, Stärke, Stärke-Buttons; (2) Quellen-Buttons
     (Elektrodenlautstärke / Kurven / Schieber); (3) „Beide Seiten mit
     ihren jeweiligen Anpassungen abspielen"; (4) Stereo-Balance +
     Dropdown; (5) Latenzausgleich; (6) Frequenz-Warping-Button +
     ausklappbare Einstellungsbox (`plWarpSettingsBox`); (7) Normalhörenden-
     Simulation; NH-Hinweisbox (`plNHInfo`).
  4. **Wiedergabe** (`plPlayTitle`) — vereinheitlichte Card mit
     Top-Toggle Quelle (Musik / Sätze / Geräusche / Hörbücher; nur
     Hörbücher ausgegraut bis spätere BA), quellenspezifischem
     Sub-Block, gemeinsamer Transport-Leiste (Prev, Play/Pause, Stop,
     Next, Endlos-Toggle 🔁 Loop, Shuffle-Button 🎲, Auto-Advance-Toggle ↪,
     Slider + Zeitanzeige, Mono-Badge),
     Anzeige-Block (Titel, Art, Spektrum, Quelle, Lizenz, optional
     Satz-Text), eigener Zeile für Pause-Buttons,
     eigener Zeile für Lautstärke + Schnellbuttons 25/50/75/100.
     (Reihenfolge seit BA 213: Transport → Warp-Fortschrittsbalken →
     Anzeige-Block → Pause-Zeile → Lautstärke-Zeile.
     - **Zufall-Toggle (🎲, BA 258)**: wirkt in allen Quellen. Zufall aus =
       sequentieller Modus. Sätze: pro Sprecher blockweise (DE zuerst,
       sonst alphabetisch); Geräusche/Hörbücher: zufälliges Element.
       Zurück (⏮) im Zufall-Modus: 1×-Memory zum zuletzt gespielten Stück
       (Knopf danach ausgegraut bis nächstes Item lief); im sequentiellen
       Modus: echter Schritt zurück.
     - **Endlos (🔁)** = aktuelles Stück wiederholen (Loop).
     - **Auto-Advance (↪)** = nach Stück-Ende nächstes Stück (je nach
       Zufall-Toggle zufällig oder sequentiell; bei Musik: hält am Ende
       der gefilterten Sicht an). Stoppt nach 30 Minuten ohne UI-Interaktion.
     - **Pause-Buttons**: 0 / 500 / 750 / 1000 / 2000 / 4000 / 8000 ms,
       **immer aktiv** (wirken zwischen Loop-Wiederholungen und bei
       Auto-Advance). Default 2000 ms.
     - Loop hat Vorrang vor Auto-Advance.
     - Transport-Leiste immer sichtbar (auch ohne geladene Datei);
       Prev/Next aktiv für Musik, Geräusche und Hörbücher — springen
       ±1 in der gefilterten/sortierten Reihenfolge (Musik: gefilterte
       Sicht; Geräusche: Sortierreihenfolge mit Wrap-Around).
     - **Weiter/Zurück lösen immer die Wiedergabe aus** — auch wenn
       der Player gerade gestoppt ist (gilt für Sätze, Geräusche,
       Hörbücher, Musik; BA 259).
     - **Musik (BA 260):** Sub-Block mit Datei-Upload (oben), Suchfeld,
       Sortier-Achse (Titel/Artist/Album/Genre/Jahr/Quelle), Kategorie-
       Dropdown („(alle)" + Achs-spezifische Werte) und Stück-Dropdown
       („Artist — Titel"). Ein Track erscheint in jedem Kategorie-Bucket,
       dessen Wert das Tag enthält (Multi-Genre: ein Track in mehreren
       Genres taucht in mehreren Buckets auf). Prev/Next analog Geräuschen
       (Shuffle/Memory aus BA 258, immer-Play aus BA 259). Auto-Advance
       hält am Ende der gefilterten Sicht an (kein Wrap-Around).
       Zusätzlich kann der Nutzer **lokale Ordner** mit Audio-Dateien
       einbinden (Button „+ Lokalen Ordner laden"; mehrere Ordner
       gleichzeitig möglich; jede Sammlung erscheint mit Anzahl in
       Klammern und kann über „×" wieder entfernt werden). Pro
       Audiodatei ein Track; `tags.album` = Ordnername, damit die
       Sortier-Achse „nach Album" die Sammlung sauber gruppiert.
       Webspace-Musik-Sammlungen aus dem Manifest
       (`audio.manifest/<src>/musik/*.json`) erscheinen automatisch,
       sobald der Webspace-Bootstrap eine Source mit Kategorie
       `"musik"` geladen hat.
     - **Geräusche:** Sub-Block mit Suchfeld, Sortier-Achse (Default „nach Art";
       weitere: „nach Spektrum", „nach Quelle"), Kategorie-Dropdown („(alle)" +
       achs-spezifische Werte) und Geräusch-Auswahl. Drei generierte
       Standardrauscher (Weiß, Rosa, Braun) plus Sample-Geräusche aus
       Embed/Webspace. Anzeige unter Transport: Titel · `kind` · `spectrum` ·
       Lizenz · Quelle. Loop, Auto-Advance, Zufall, Prev-Memory wirken wie
       bei den anderen Quellen — auf der gefilterten Sicht.
     - **Hörbücher:** Sub-Block mit Upload-Button (Ordner mit nummerierten
       Audio-Dateien), drei Dropdowns (Sortierung, Hörbuch, Kapitel) und
       Entfernen-Button (×). Auto-Advance spielt Kapitel-für-Kapitel durch;
       stoppt still am Buch-Ende. Loop wirkt auf Kapitel-Ebene. Positions-
       Persistenz pro Buch-ID in `plBookPositions`: zuletzt aktives Kapitel
       und Wiedergabe-Sekunde werden beim Buch-Wechsel, Quellen-Wechsel und
       Stop gespeichert und beim Wieder-Auswählen wiederhergestellt. Lokale
       User-Uploads sind ein Provider unter `audio-source.js` (Blob-URLs
       überleben Reload nicht; Positions-Marker schon).
       Anzeige unter Transport: Kapitel-Titel — Buch-Titel · Autor · Sprecher
       · Sprache · Lizenz.
       Bekannte Einschränkung: m4b-Chapter-Tags werden nicht ausgewertet.
       Webspace-Hörbücher werden über den Webspace-Manifest-Loader (s.u.)
       geliefert.
     - **Webspace-Manifest-Loader (BA 196):** Beim Tool-Start lädt
       `js/audio-source.js` im Hintergrund `audio.manifest/index.json`
       same-origin aus dem Repo (kein CORS erforderlich für Manifeste).
       Pro Quelle werden `source.json` und Kategorie-Manifeste lazy
       nachgeladen; bei jedem erfolgreichen Source-Lade-Vorgang werden die
       betroffenen Sub-Block-UIs neu gerendert. Audio-Pfad-Auflösung:
       `<webspace-root> + source.base + item.audio` — CORS am Webspace
       nur für die Audio-Dateien selbst nötig. Webspace-Root konfigurierbar
       via `window.CI_SB_WEBSPACE_ROOT` (Default
       `http://ci-sound-balancing.honigburg.de/opus/`).
       Audio-URLs werden in `_amResolveAudioUrl` per `encodeURI`
       URL-sicher zusammengebaut. Pfade mit Leerzeichen oder Sonderzeichen
       funktionieren damit zuverlässig, auch wenn das Manifest sie nicht
       selbst encoded (BA 263).
       Webspace-Items reichen die `text`-Property aus dem Manifest direkt
       an den Player durch — sichtbar in der Sätze-„Text anzeigen"-Box
       (BA 263).
       Offline-Fallback: bei Netzwerk-/CORS-Fehlern bleibt der Player
       ohne Webspace-Inhalte funktional (generiert + embed + lokale
       Uploads). Pointer-Manifeste (`kind: "index"`) werden in BA 196
       ignoriert; nur direkte Collection-Manifeste fließen in die UI.
     - **Persistenz**: `plActiveSource`, `plAutoAdvance`, `plLoop`,
       `plShuffle`, `plPauseMs`, `plSentShowText`, `plNoiseSelectedId`,
       `plNoiseSortAxis`, `plNoiseCategory`, `plNoiseSearchQuery`,
       `plBookSelectedId`, `plBookChapterIdx`,
       `plBookSortAxis`, `plBookPositions`, `plMusicSelectedId`,
       `plMusicSortAxis`, `plMusicCategory`, `plMusicSearchQuery`
       werden in JSON-Save und localStorage gespeichert und beim
       Restore wiederhergestellt.
- Audiodatei laden, Mono-Downmix, parametrischer 12/16/22-Band-
  Equalizer
- Drei unabhängige Quellen-Toggles: **Elektrodenlautstärke · Kurven · Schieber**
  (in dieser Reihenfolge in der Button-Leiste; alle Default an).
  Addieren sich unabhängig im Player-EQ. „Kurven" = nur Preset-Anteil;
  „Schieber" = nur manuelle Schieber-Werte. (DOM-/i18n-Keys:
  `plSrcMeas`, `plSrcCurves`, `plSrcLevels`.)
- Equalizer an/aus, Stärke 0–150%, Buttons für 50/75/100/150%
- **Side-Modi** (durch Checkbox „Beide Seiten mit ihren jeweiligen
  Anpassungen abspielen" in den Einstellungen, geliefert von
  `getPlayerSide()`):
  - Checkbox aus → nur die aktive Seite hörbar, Gegenkanal stumm
    (Modus `"left"` oder `"right"`).
  - Checkbox an → Stereo mit getrennten EQ-Ketten pro Kanal
    (`pEqFLeft` / `pEqFRight`), gespeist über `pChannelSplitter`
    und `pChannelMerger` (Modus `"both"`). EQ-Graph und Werte-Tabelle
    zeigen dabei die **aktive Seite** (`activeSide`), nicht fest „links"
    — damit bei einseitigem CI-Nutzer immer die CI-Seite sichtbar ist.
    Das Audio-Routing bleibt davon unberührt (weiterhin stereo).
  - Stereo-Balance: nur im echten Stereo-Modus (`getPlayerSide() ===
    "both"`) bedienbar. In `left`/`right`/`mono` ist die Balance-
    Schaltfläche ausgegraut, weil die Korrektur dort akustisch
    wirkungslos wäre.
  - „Stereo-Balance anwenden" (`plApplyBalance`): zusätzlicher
    L↔R-Gesamtoffset aus dem Mittelwert der gemessenen
    `lrResults` (Stereo-Balance-Test).
  - Bei aktiver Balance erscheint ein Dropdown „Anwendung:":
    symmetrisch (Default), nur links, nur rechts. Bei einseitiger
    Anwendung wird der doppelte Wert auf eine Seite gelegt, damit
    der akustische L↔R-Unterschied derselbe ist wie symmetrisch.
  - Latenzausgleich: nur im Stereo-Modus (`both`) bedienbar. In
    `left`/`right` ist die Schaltfläche ausgegraut, weil
    Inter-Ohr-Verzögerung in einseitiger Wiedergabe akustisch
    wirkungslos ist.
  - Frequenz-Warping: nur im Stereo-Modus (`both`) bedienbar. In
    `left`/`right` ist der Warp-Toggle-Button ausgegraut (`updWarpBtn`
    in tabs-eq.js), weil die Korrektur frequenz-seitenspezifisch ist
    und im einseitigen Modus nicht wirken kann. `pWarpOn` bleibt dabei
    intern erhalten — beim Zurückschalten auf „Beide Seiten" ist der
    Button wieder aktiv und zeigt den gemerkten Zustand.
  - **Persistenz der Checkbox:** Der Zustand von „Beide Seiten" (`plBothSides`)
    wird in localStorage (Autosave alle 5 s) und in JSON-Save gespeichert
    und beim Reload bzw. JSON-Load wiederhergestellt.
- Normalhörenden-Simulation (nicht-invertierter Equalizer). Steuert
  zugleich die **Wirkungsrichtung** der Audio-Verarbeitung:
  - **NH-Sim aus (Korrektur-Modus, Default):** Frequenz-Warping und
    Equalizer arbeiten als Vorhalt — das Audio wird so vorverarbeitet,
    daß nach der Cochlea-Verzerrung beim CI-Träger das richtige
    Klangbild ankommt. Pegel-Equalizer ist invertiert (Verzerrung
    kompensiert). Inhalte werden vom Warping auf die **nominellen**
    Mittenfrequenzen der Elektroden verschoben, damit die richtige
    Elektrode stimuliert wird. Konkretes Beispiel: ein Ton, der im
    Original-Audio bei 100 Hz liegt und auf einer Elektrode landen
    soll, deren nominelle Mittenfrequenz 120 Hz ist (und die als
    100 Hz wahrgenommen wird), wird vom Warping auf 120 Hz Audio
    verschoben — das CI stimuliert dann die richtige Elektrode, und
    die Cochlea-Verzerrung bringt die Wahrnehmung wieder auf 100 Hz.
    Die Messungs-Korrektur folgt derselben Vorzeichen-Behandlung wie die
    Kurven: positives `levels[i]` (leise Elektrode) wird angehoben. In
    `computeGains` fließt sie negiert ein (`addMeas = -levels[i]`),
    analog `addCurves`.
  - **NH-Sim an:** zeigt einem normalhörenden Hörer, wie ein
    CI-Träger das Audio wahrnimmt. Frequenz-Warping wirkt in
    Simulations-Richtung — Inhalte werden auf die gewarpten
    Wahrnehmungs-Frequenzen verschoben. Pegel-Equalizer ist
    nicht-invertiert (Verzerrung wird direkt aufs Audio gelegt).
  - Beide Richtungen werden in `buildWarpPoints` über den
    `invert`-Flag gesteuert; der Audio-Pfad ruft mit `!nhSim` auf,
    damit `invert=true` im Korrektur-Modus den Vorhalt liefert und
    `invert=false` im NH-Sim die Wahrnehmungs-Verschiebung.
  - Konzeptionelle Hintergründe (warum der Warp in welche Richtung
    wirken muß, warum die EQ-Filter modus-abhängig auf nominellen
    oder gewarpten Frequenzen sitzen, wie beide Korrekturen
    zusammenwirken, Vereinfachungen gegenüber dem echten CI):
    `docs/Konzept_Frequenzwarping_und_EQ.md`.
- MAPLAW-Simulation (MED-EL): bandweise Hüllkurven-Vorverzerrung
  Ist⁻¹∘Soll als AudioWorklet im Tool. Eigene Card oberhalb der
  Frequenz-Warping-Card. Ist-c kommt aus `implant.cValue` der
  aktiven Seite (read-only), Soll-c per Quick-Buttons
  (100/250/500/1000/1500/2000/3000/4000/6000/8000) oder Zahleneingabe (0–8000).
  Master-Toggle „MAPLAW Simulation aktivieren" (Toggle-Button, grün
  wenn aktiv). EQ-Toggle wirkt als Master-Bypass auch für MAPLAW.
  Audio-Pfad-Position: nach Tool-EQ und vor pGain. Bei Soll-c == Ist-c
  oder Card aus: Passthrough. Bei aktiver Seite Cochlear oder AB:
  Card ausgegraut mit Hinweis. Konzeptioneller Hintergrund:
  `.docs/MAPLAW_Konzept.md`.
  Die Ist-c-Anzeige im Einstellungs-Block wird um den gesetzten
  Soll-c-Wert verlängert. Beide Werte stehen fett auf derselben
  Zeile, getrennt durch einen Gedankenstrich. Der Soll-Wert
  aktualisiert sich live, wenn der User ihn per Quick-Button oder
  Zahleneingabe ändert (die jeweiligen Listener rufen
  `pMaplawUpdUI` zusätzlich zu `pMaplawTrigger`).
- Experimentell-Toggle im Player: Checkbox „Experimentelle Optionen
  einblenden" oberhalb der MAPLAW-Card. **Default aus** — MAPLAW-Card
  initial verborgen. Wird der Toggle aktiviert, erscheint die Card plus
  ein Hinweistext über klangliche Schwächen. Persistiert in JSON und
  localStorage (`playerShowExperimental`). **Solange MAPLAW Simulation
  aktiv ist, ist die Checkbox deaktiviert** (Ausblenden nicht möglich).
  Frequenz-Warping ist nicht mehr experimentell — es erscheint direkt
  im Einstellungs-Block (Zeile 6).
- EasyEffects-Export für PipeWire (korrektes JSON-Format)
- Equalizer-Controls immer sichtbar (nicht nur bei geladener Datei)
- Änderungen im Schieber-Tab aktualisieren den Player-Equalizer live
- Frequenz-Warping via Rubberband (freq-warp.js):
  - **Verfahren: Rubberband** — bandweise Vorberechnung über Rubberband-WASM
    mit FIR-Bandpässen auf geometrischen Bandgrenzen, echter zeitkonsistenter
    Pitch-Shift pro Band (kein `playbackRate`-Trick), Mono-Optimierung (nur
    effektiv hörbare und tatsächlich gewarpte Kanäle werden verarbeitet).
    Lazy WASM-Load via `js/rubberband-loader.js` (Vendor in
    `vendors/rubberband-wasm/dist/`). Vier einstellbare Optionen (BA 191):
    **Engine** (R3 Finer / R2 Faster), **Material** (Standard / Sprache /
    Perkussiv), **Formante erhalten** (Toggle, Default an), **Schnell**
    (Toggle, Default aus). Die Bit-Maske wird einmalig pro Vorberechnung
    aus dem State-Objekt `pRubberbandOptions` via `_rbBuildOptionBits()`
    erzeugt und an `_rbProcessMonoSide` und `_rbPitchShift` weitergereicht.
  - Korrektur-Modus: left / right / symmetric (User-Labels „Linke Seite" /
    „Rechte Seite" / „Beide Seiten symmetrisch"). Alt-Werte `ref_side`/`var_side`
    aus älteren Save-Dateien werden beim Laden über `_migrateLegacyWarpMode`
    in absolute Seiten übersetzt (anhand der refSide des ersten fRes-Eintrags).
  - Default Korrektur-Modus = Rechte Seite. Beim ersten Frequenzabgleich-
    Resultat einer Session wird der Modus automatisch einmalig auf die
    **Zielseite** (= Gegenseite der Referenzseite) gesetzt, sofern nicht zuvor
    manuell geändert. Idempotent über `_pPlayerWarpDefaultApplied`; geladene
    JSON-Werte gewinnen (Flag wird nach Load gesetzt).
  - Stärke 0–150%
  - Untertitel-Zeile oben in der Einstellungsbox (i18n-Key `pwSubtitle`), sichtbar wenn Box ausgeklappt
  - Status-Anzeige zeigt Stützpunkt-Anzahl. Sind vorläufige Punkte aus einem laufenden Frequenzabgleich-Test dabei, wird ein Zusatztext „(davon N vorläufig aus laufendem Test, M final)" angehängt (i18n-Key `pwStatusProvisional`).
  - **Daten-Quelle der Warp-Stützpunkte:** identisch zur Meßergebnis-Tabelle — `_warpFResSource()` vereint `fRes` (finale Konvergenz-Punkte) mit den Provisionals aus `_fmrBuildInProgressEntries(side)` beider Seiten (aktive Tracks mit ≥1 Reversal liefern einen vorläufigen Match, Status `in-progress`; früher Stand mit cent=0 als Platzhalter, Status `in-progress-early`). Final hat Vorrang pro (varSide, elIdx).
  - Hinweis-Zeile in der Einstellungsbox (`#plWarpHint`): wird eingeblendet, wenn Warp eingeschaltet ist, aber weder finale noch vorläufige Daten vorliegen (i18n-Key `pwHintNoFRes`).
  - **Persistenz:** `pWarpOn`, `pWarpMode`, `pWarpStrength` und
    `pRubberbandOptions` (als `warpRbOptions`) werden vollständig in
    localStorage (Autosave alle 5 s) und in JSON-Save gespeichert und beim
    Laden wiederhergestellt. `pWarpedBuf` wird nicht gespeichert; er wird bei
    Bedarf neu berechnet. Ältere Saves ohne `warpRbOptions` werden ohne Fehler
    geladen (Optionen behalten ihren letzten Wert). Ältere Saves mit
    `warpMethod`-Feld werden ohne Fehler geladen (Feld wird ignoriert).
    UI-Sync über `pWarpUpdUI()`.
  - **Fortschrittsbalken im Transport-Bereich** (`#plWarpProgressRow`):
    Während der Rubberband-Vorberechnung erscheint unterhalb der Transport-
    Buttons eine schmale Zeile mit Label „Warp:", einem wachsenden Balken
    und einer Prozentangabe (`#plWarpProgressBar`, `#plWarpProgressPct`).
    Zeile ist `display:none` wenn keine Berechnung läuft oder `pWarpProgress`
    noch 0 ist; gesteuert von `pWarpUpdUI()` (i18n-Key `pwProgressLabel`).
  - Bei aktivem Frequenz-Warping folgen die Säulen-Positionen des
    EQ-Graphen den gewarpten Wahrnehmungs-Frequenzen der Elektroden.
    Die im Audio-Pfad eingehängten Biquad-Filter sitzen **modus-abhängig**:
    - **Korrektur-Modus (NH-Sim aus):** Filter auf den **nominellen**
      Mittenfrequenzen `effFreq(i)`.
    - **NH-Sim-Modus:** Filter auf den gewarpten Wahrnehmungs-Frequenzen
      `effFreqDisplay(i, side)`.
    Im Stereo-Modus werden die Filter pro Channel gesetzt; im Mono-Modus
    bindet die Frequenz an `activeSide`.
  - Druck-Export enthält Korrektur-Modus und Stärke wenn Warp aktiv
  - Rubberband beachtet die gewählte Player-Seite: bei LINKS/RECHTS ist nur
    diese Seite hörbar (Gegenkanal stumm); bei „Beide Seiten" ist auf der
    nicht betroffenen Seite das Original zu hören.
  - Warp-Toggle wirkt auch während laufender Wiedergabe: Pfadwechsel erfolgt
    an aktueller Position. Änderung von Stärke oder Korrektur-Modus löst
    Neuberechnung via `pWarpTrigger` aus (kurze Pause; beim ersten Lauf
    zusätzlich WASM-Lade-Zeit).
  - Aktivierung über Toggle-Button im Einstellungs-Block, grün wenn aktiv.
    Die Einstellungsbox (`plWarpSettingsBox`) wird unabhängig vom Toggle-
    Zustand über ein Dreieck-Symbol (`plWarpSettingsToggle`, ▶/▼) rechts
    neben dem Toggle auf- und zugeklappt. Beim Seitenstart ist die Box
    zugeklappt (▶). Die Einstellungen darin bleiben auch bei deaktiviertem
    Warping bedienbar.
  - EQ-Toggle wirkt als Master-Bypass auch für das Frequenz-Warping: wenn
    EQ aus, sind sowohl Filter als auch Warp deaktiviert. Der Warp-Toggle-
    Zustand bleibt als „Memory" erhalten und greift wieder, sobald EQ
    wieder eingeschaltet wird. Bei Toggle während Wiedergabe erfolgt der
    nötige Pfadwechsel an aktueller Position.
  - Stop-Button (`#plWarpStopBtn`) bricht laufende Rubberband-Vorberechnung
    ab; Warp-Toggle schaltet dabei aus. Der Abbruch wirkt zeitnah, auch
    bei großen Buffern — `_rbPitchShift` gibt regelmäßig an den Event-Loop
    zurück, sodass der Klick verarbeitet und `pWarpCancel` zwischen
    WASM-Chunks geprüft wird.
  - **Warp-Toggle-Cancel (BA 213):** Wird der Warp-Toggle während laufender
    Berechnung deaktiviert, ruft der Click-Handler `pWarpCancelCompute()`
    auf und kehrt sofort zurück. `pWarpTrigger` erkennt den User-Cancel
    (`cancelled === true`) und spielt danach **ungewarpt** weiter
    (kein `pWarpOn`-Guard bei `pPlay()`). Der Warp-Toggle bleibt aus.
  - Wechselt während laufender Warp-Berechnung der Quell-Buffer (z.B. Nutzer
    klickt „nächstes Audio" oder Auto-Advance schaltet weiter), wird der
    laufende Compute automatisch abgebrochen und die Berechnung mit dem
    neuen Buffer gestartet — der Warp-Toggle bleibt dabei aktiv (kein
    User-Cancel).
  - `pPlay` wartet vor dem eigentlichen Start auf eine laufende Warp-Berechnung
    (`pWarpComputingPromise`). Damit startet auch automatisch ausgelöste
    Wiedergabe (Loop-Restart, Auto-Advance, Sätze-Folge-Satz) erst, sobald
    der gewarpte Buffer bereit ist — sonst würde der nächste Inhalt ohne
    Warp losspielen.

- Sätze-Wiedergabe im Player: Sub-Block der vereinheitlichten Wiedergabe-Card
  (Quelle „💬 Sätze"), Wiedergabe vorgesprochener Sätze durch denselben
  Audiograph wie Musikdateien (EQ, MAPLAW, Korrektur, Lautstärke wirken).
  Sprecher-Auswahl folgt der globalen Tool-Sprache und bietet immer
  Option „Alle (zufällig)" plus einzelne Sprecher der jeweiligen Sprache:
  - **Thorsten** (Deutsch, Studioqualität, 50 kuratierte Sätze;
    Quelle: Thorsten-Voice, CC0)
  - **Common Voice** (Pool aus 100 verschiedenen Sprechern pro
    Sprache; Quelle: Mozilla Common Voice 17.0, CC0)
  Bedienung über die zentrale Transport-Leiste: **Play** startet
  zufälligen Satz; **Prev/Next** wählen anderen zufälligen Satz;
  **Stop** hält an; **🔁 Loop** wiederholt denselben Satz; **↪ Auto-Weiter**
  spielt nach jedem Satz automatisch einen anderen zufälligen Satz.
  Stop hält alles an. Sprecher-Auswahl folgt globaler Tool-Sprache.
  Optionaler Text-Einblender (`plSentShowText`). Pause-Buttons
  (500 / 750 / 1000 / 2000 / 4000 / 8000 ms, Default 2000 ms — wirken
  bei Loop und Auto-Advance). Loop hat Vorrang vor Auto-Advance.
  Sätze und Audiodatei haben getrennte Buffer; Quelle-Toggle stoppt
  laufende Wiedergabe. Sprachwechsel aktualisiert Sprecher-Dropdown sofort.

  **Hintergrund-Geräusch (BA 194):** Master-Toggle + Dropdown (Auswahl aus
  allen verfügbaren Geräuschen via `amCollectItems`) + SNR-Quick-Buttons
  (-10 / -5 / 0 / +5 / +10 dB). Bei aktivem Hintergrund wird vor jedem
  Satz ein Pre-Mix berechnet (Hintergrund auf Satzlänge geloopt,
  RMS-normalisiert auf Referenz-Pegel, mit `10^(-SNR/20)` skaliert und
  sample-weise zum Satz addiert). Der gemischte Buffer durchläuft
  EQ/Warp/MAPLAW wie ein Satz ohne Hintergrund — Sprache und Geräusch
  werden gemeinsam korrigiert. Hintergrund startet pro Satz bei 0
  (kein Phase-Counter über Sätze). Mix-Cache (max 8 Einträge, LRU) hält
  Pre-Mix-Buffer pro (Satz-Audio-Ref, Geräusch-Id, SNR-Wert) vor.
  Toggle-, Dropdown- und SNR-Änderungen leeren den Mix-Cache.
  **Quellen-Aggregation (BA 197):** Sätze werden über das amProvider-System
  eingesammelt — `sentences-legacy` (heutige sCorpus-Quelle aus
  `assets/sentences/sentences.json` bzw. Embed), `sentences-local`
  (User-Uploads), `embed`, `webspace`. Das Sprecher-Dropdown und der
  Wiedergabe-Pfad arbeiten ausschließlich mit Items aus
  `amCollectItems("saetze")`. Webspace-Sprecher erscheinen damit
  automatisch im Dropdown.

  **Titel-Anzeige (BA 197):** Im Anzeige-Block steht „Sammlung — Sprecher"
  als Titel (z. B. „Thorsten-Voice — Thorsten"). Der Satz-Text bleibt
  nur in der „Text anzeigen"-Box.

  Schema: `assets/sentences/sentences.json` ist sprecher-zentriert,
  `speakers.<key>.recordings[]` mit Text + Audio-Pfad. Siehe README.

  **Offline-Modus**: Wenn `fetch("assets/sentences/sentences.json")`
  fehlschlägt (z.B. weil das Tool als `file://` aus einem ZIP geöffnet
  wurde), schaltet die Sätze-Wiedergabe automatisch in den Embed-Modus.
  Pro Sprache wird `assets/sentences/embed/<lang>.js` per `<script>`-Tag
  on-demand geladen — Audio liegt dort als `data:`-URL. Im Embed sind
  ~5 Sätze pro Sprache verfügbar (de: Thorsten; en/fr/es: Common Voice).
  Spätere Sprachen, für die kein Embed existiert, sind offline nicht
  verfügbar (Block zeigt „keine Sätze verfügbar").

  **Lokale Audio-Ordner:** Der User kann über „+ Lokalen Ordner laden"
  in der Sätze-Card lokale Ordner mit Audiodateien hinzufügen. Erkennung:
  - Freiburger Sprachtest (Pfad-Pattern Einsilbig|Mehrsilbig/Testliste_NN/
    L<NN>_W<NN>_<text>.wav) → zwei Sprecher (Einsilbig, Mehrsilbig),
    Text aus Dateiname.
  - Oldenburger Satztest (Dateiname *_OLSA[female|male]_TTS.wav) → ein
    Sprecher mit Label-Variante (female/male/generisch), Text aus
    zugehöriger sentences_OLSA*.txt im Format `<datei.wav> : <text>`.
  - Generisch: alle Audiodateien des Ordners als ein Sprecher in der
    aktuellen Tool-Sprache; Manifest-Texte werden gelesen, wenn eine
    .txt/.csv/.tsv ≥ 80 % der Audio-Dateien zuordnet (Separator
    : , ; | Tab; Leerzeichen im Dateinamen werden beim Doppelpunkt-
    Separator unterstützt: `datei mit leerzeichen.wav: Text`).
  Audio wird lazy geladen (erst beim Abspielen, nicht beim Scan).
  Entfernen über „×" neben dem Listeneintrag. Sprache der Sammlung
  bestimmt, ob sie im Sprecher-Dropdown der aktuellen Tool-Sprache
  erscheint.

  **Persistenz:** Lokale Sammlungen werden mit ihren Metadaten in JSON
  gespeichert. Audio-Daten selbst nicht. Beim Reload mit JSON-Restore:
  - In Chromium/Edge (File System Access API verfügbar) nutzt der Picker
    `showDirectoryPicker()`; der zurückgelieferte Handle wird in IndexedDB
    persistiert (DB „ciSoundBalancing", Store „folderHandles"). Nach
    JSON-Restore fragt der Browser nach Re-Permission für den
    ursprünglichen Ordner (ein Dialog); nach Bestätigung ist die Sammlung
    sofort wieder verfügbar. Künftige Re-Auswahlen öffnen an der
    gespeicherten Stelle (`startIn`-Hint).
  - In Firefox erscheint die Sammlung als „(nicht geladen)" im
    Sprecher-Dropdown und in der Liste. Auswahl im Dropdown öffnet
    einen Hinweis mit Ordnernamen und den webkitdirectory-Picker.
  „×" entfernt die Sammlung dauerhaft (auch den IndexedDB-Handle,
  sofern keine andere Sammlung ihn referenziert).
