## Player

- Aufbau des Tabs in fünf Karten, in dieser Reihenfolge:
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
  4. **Audiodatei** (`plFileTitle`) — Datei-Picker, Transport-Controls
     (Play/Stop, Zeitleiste, Lautstärke).
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
- Frequenz-Warping mit fünf Verfahren (freq-warp.js):
  - **Rubberband (Variante E, Default):** bandweise Vorberechnung über
    Rubberband-WASM mit FIR-Bandpässen auf geometrischen Bandgrenzen,
    echter zeitkonsistenter Pitch-Shift pro Band (kein `playbackRate`-
    Trick), Mono-Optimierung (nur effektiv hörbare und tatsächlich
    gewarpte Kanäle werden verarbeitet). Optionen-Set hartcodiert auf
    `EngineFiner | PitchHighQuality | FormantPreserved | StretchPrecise
    | WindowStandard | ThreadingNever | ChannelsApart`. Lazy WASM-Load
    via `js/rubberband-loader.js` (Vendor in
    `vendors/rubberband-wasm/dist/`).
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play
  - **Bandweise Pitch-Shift** (Variante B): Live-Audio-Graph, N Subbänder
    × 2 Kanäle; wirkt sofort beim nächsten Play, keine Vorberechnung
  - **Phasen-Vocoder** (Variante A): AudioWorklet mit FFT/IFFT und
    Identity Phase Locking (Laroche/Dolson) — Spektrum-Peaks tragen ihre
    Phase eigenständig fort, Non-Peak-Bins werden phasen-gelockt zum
    jeweils nächsten Peak. Reduziert die typischen Phasen-Vocoder-Artefakte
    (roboterhafter Klang, tremoloartiges Vibrieren). Ca. 46 ms Latenz;
    Worklet-Code liegt inline als String in freq-warp.js und wird per
    Blob-URL geladen — funktioniert daher auch unter `file://`
  - **Sinusoidal Modeling** (Variante D): STFT-basiert wie der Phasen-Vocoder.
    Peaks werden mit Quadratic Peak Interpolation sub-bin-genau lokalisiert
    und über Frames getrackt (kontinuierliche Phase pro Oszillator). Residual-
    Spektrum (nicht-tonale Anteile) bleibt unverschoben → Konsonanten und
    Rauschen klingen natürlicher als beim Phasen-Vocoder. Pitch-Shift mit
    Spectral Spread auf zwei benachbarte Bins. Defaults: Phasen-Vocoder bleibt
    Default; Sinusoidal Modeling wahlweise im Dropdown.
  - Korrektur-Modus: left / right / symmetric (User-Labels „Linke Seite" /
    „Rechte Seite" / „Beide Seiten symmetrisch"). Alt-Werte `ref_side`/`var_side`
    aus älteren Save-Dateien werden beim Laden über `_migrateLegacyWarpMode`
    in absolute Seiten übersetzt (anhand der refSide des ersten fRes-Eintrags).
  - Defaults: Verfahren = Rubberband, Korrektur-Modus = Rechte Seite.
    Beim ersten Frequenzabgleich-Resultat einer Session wird der Korrektur-Modus
    automatisch einmalig auf die **Zielseite** (= Gegenseite der Frequenzabgleich-
    Referenzseite) gesetzt, sofern der User ihn nicht zuvor manuell geändert hat.
    Gilt für jede Schreibstelle (Slider-Confirm, Adaptive-Aggregat-Insert,
    Adaptive-finaler-Insert, Slider-DebugSim); idempotent über die Session-
    Variable `_pPlayerWarpDefaultApplied` in `freq-warp.js`. Gespeicherte JSON-
    Werte gewinnen weiter beim Laden: nach dem Load wird das Flag gesetzt,
    sodass der nächste Mess-Insert den geladenen Wert nicht überschreibt.
  - Korrektur-Modus und Stärke sind immer sichtbar (nicht mehr von Checkbox abhängig)
  - Stärke 0–150%; Recalc-Button nur bei Offline-Verfahren sichtbar
  - Untertitel-Zeile oben in der Einstellungsbox (i18n-Key `pwSubtitle`), sichtbar wenn Box ausgeklappt
  - Status-Anzeige zeigt aktives Verfahren und Stützpunkt-Anzahl. Sind vorläufige Punkte aus einem laufenden Frequenzabgleich-Test dabei, wird ein Zusatztext „(davon N vorläufig aus laufendem Test, M final)" angehängt (i18n-Key `pwStatusProvisional`).
  - **Daten-Quelle der Warp-Stützpunkte:** identisch zur Meßergebnis-Tabelle — `_warpFResSource()` vereint `fRes` (finale Konvergenz-Punkte) mit den Provisionals aus `_fmrBuildInProgressEntries(side)` beider Seiten (aktive Tracks mit ≥1 Reversal liefern einen vorläufigen Match, Status `in-progress`; früher Stand mit cent=0 als Platzhalter, Status `in-progress-early`). Final hat Vorrang pro (varSide, elIdx). Folge: Warping wirkt bereits während eines laufenden Tests, sobald die Tabelle vorläufige Werte zeigt — und gibt genau dasselbe wieder, was die Tabelle anzeigt.
  - Hinweis-Zeile in der Einstellungsbox (`#plWarpHint`): wird eingeblendet, wenn Warp eingeschaltet ist, aber weder finale noch vorläufige Daten vorliegen — sagt „Bitte zuerst den Frequenzabgleich-Test durchführen" (i18n-Key `pwHintNoFRes`).
  - **Persistenz:** `pWarpOn`, `pWarpMethod`, `pWarpMode`, `pWarpStrength` werden
    vollständig in localStorage (Autosave alle 5 s) und in JSON-Save gespeichert
    und beim Laden wiederhergestellt. `pWarpedBuf` wird nicht gespeichert;
    er wird bei Bedarf neu berechnet. Beim JSON-Load gibt es kein Force-Off
    mehr — der Warp-Zustand erscheint nach Reload und JSON-Load genauso wie
    beim Speichern. UI-Sync erfolgt über `pWarpUpdUI()` nach dem Setzen der Werte.
  - Bei aktivem Frequenz-Warping folgen die Säulen-Positionen des
    EQ-Graphen den gewarpten Wahrnehmungs-Frequenzen der Elektroden
    — das ist das Klangbild, das beim Träger ankommt, und ist
    unabhängig vom Modus. Die im Audio-Pfad eingehängten Biquad-
    Filter sitzen dagegen **modus-abhängig**:
    - **Korrektur-Modus (NH-Sim aus):** Filter auf den **nominellen**
      Mittenfrequenzen `effFreq(i)`. Begründung: die Pegel-Korrektur
      pro Elektrode entspricht der Anpassung am CI-Prozessor, die
      starr auf der nominellen Bandzuordnung der jeweiligen Elektrode
      sitzt — sie wandert nicht mit der Cochlea-Verzerrung mit.
      Das vorgewarpte Audio führt die Inhalte einer Elektrode an
      genau dieser nominellen Position; der Filter trifft dort das
      richtige Material.
    - **NH-Sim-Modus:** Filter auf den gewarpten Wahrnehmungs-
      Frequenzen `effFreqDisplay(i, side)`. Begründung: das simuliert-
      verzerrte Audio führt die Elektroden-Inhalte hier an der
      wahrgenommenen Position; der normalhörende Hörer soll die
      Pegel-Verzerrung an genau dieser Position erleben.
    Im Stereo-Modus werden die Filter pro Channel mit der
    jeweiligen Seiten-Bindung gesetzt (`withSide("left"/"right",
    () => effFreq(i))` bzw. `effFreqDisplay(i, "left"/"right")`); im
    Mono-Modus bindet die Frequenz an `activeSide`.
  - Druck-Export enthält aktives Verfahren wenn Warp aktiv
  - Offline-Verfahren beachtet die gewählte Player-Seite: bei LINKS/RECHTS
    ist nur diese Seite hörbar (Gegenkanal stumm); bei „Beide Seiten" ist
    auf der vom Korrektur-Modus nicht betroffenen Seite das Original zu
    hören (klanglich unverändert, kein Bandpass-Artefakt)
  - Vocoder-Graph beachtet ebenfalls die Player-Seite und mischt bei
    „Beide Seiten" + einseitigem Korrektur-Modus die nicht betroffene
    Seite aus einer zweiten Original-BufferSource ein, die per DelayNode
    um die Vocoder-Latenz (ein FFT-Fenster) verzögert wird, damit L/R
    synchron bleiben
  - Warp-Toggle und Methoden-Wechsel wirken auch während laufender Wiedergabe:
    Pfadwechsel erfolgt an aktueller Position mit kurzer Unterbrechung
    (Offline regelt das in `pWarpTrigger`; Vocoder/Bandshift im Toggle-Handler
    in init.js). Worklet des Vocoders wird beim Auswählen der Methode vorab
    geladen, damit der spätere Pfadwechsel ohne erkennbare Verzögerung wirkt.
  - Live-Änderung von Stärke und Korrektur-Modus während Wiedergabe:
    - Rubberband → Neuberechnung via `pWarpTrigger` (längere Pause; beim
      ersten Lauf zusätzlich WASM-Lade-Zeit)
    - Offline → Neuberechnung via `pWarpTrigger` (kürzere Pause)
    - Vocoder → knackfreier `postMessage` an den laufenden Worklet
      (`pWarpLiveUpdate`), sofort wirksam
    - Bandshift → Graph-Rebuild via pause/resume (kurzer hörbarer Knack)
  - Aktivierung über Toggle-Button im Einstellungs-Block (Zeile 6), grün wenn aktiv. Bei Aktivierung klappt die Einstellungsbox (`plWarpSettingsBox`) auf; beim Deaktivieren wird sie ausgeblendet.
  - EQ-Toggle wirkt als Master-Bypass auch für das Frequenz-Warping: wenn
    EQ aus, sind sowohl Filter als auch Warp deaktiviert. Der Warp-Toggle-
    Zustand bleibt als „Memory" erhalten und greift wieder, sobald EQ
    wieder eingeschaltet wird. Bei Toggle während Wiedergabe erfolgt der
    nötige Pfadwechsel an aktueller Position.
  - Stop-Button greift auch in Zwischenzuständen, in denen `pPlaying` kurz
    `false` ist, aber Audio-Sources aktiv sind (Race im async Vocoder-pPlay).

- Sätze-Wiedergabe im Player: Card „Sätze abspielen" unterhalb der
  Audiodatei-Card. Wiedergabe vorgesprochener Sätze durch denselben
  Audiograph wie Musikdateien (EQ, MAPLAW, Korrektur, Lautstärke wirken).
  Sprecher-Auswahl folgt der globalen Tool-Sprache und bietet immer
  Option „Alle (zufällig)" plus einzelne Sprecher der jeweiligen Sprache:
  - **Thorsten** (Deutsch, Studioqualität, 50 kuratierte Sätze;
    Quelle: Thorsten-Voice, CC0)
  - **Common Voice** (Pool aus 100 verschiedenen Sprechern pro
    Sprache; Quelle: Mozilla Common Voice 17.0, CC0)
  Bedienung über drei Buttons: **Spielen** (aktueller Satz einmal,
  beim ersten Klick zufällig gewählt) — **Nächster Satz** (anderer
  zufälliger Satz, einmal) — **Endlosfolge** (zufällige Folge,
  maximal 100 Sätze; danach automatischer Stop, Button-Klick startet
  neue 100er-Folge). Stop hält alles an. Sprecher-Auswahl folgt globaler
  Tool-Sprache. Optionaler Text-Einblender. Pause-Buttons
  (500 / 750 / 1000 / 2000 / 4000 / 8000 ms, Default 2000 ms —
  Wartezeit zwischen Sätzen bei Endlosfolge).
  Sätze und Audiodatei haben getrennte Buffer und sind unabhängig
  voneinander steuerbar. Sätze-Start pausiert eine laufende
  Datei-Wiedergabe; Klick auf den Datei-Play-Button während laufender
  Sätze stoppt diese und startet die Datei (ein Klick, vorher zwei).
  Sätze-Stop und Sätze-Ende setzen den Player zurück in den Datei-
  Modus, ohne die Datei-Auswahl zu verlieren. Datei-Upload und
  Seite-Wechsel stoppen Sätze ebenfalls. Sprachwechsel aktualisiert
  Sprecher-Dropdown sofort. Schema: `assets/sentences/sentences.json`
  ist sprecher-zentriert, `speakers.<key>.recordings[]` mit Text +
  Audio-Pfad. Siehe README.

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
