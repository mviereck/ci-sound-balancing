// ============================================================
// I18N
// ============================================================
const L = {
  de: {
    subtitle: "CI Sound Balancing Tool · v2.7",
    sideLeft: "LINKS",
    sideRight: "RECHTS",
    tabIntro: "Einführung",
    tabFreq: "Implantat",
    tabTest: "Messung",
    tabResults: "Meßergebnisse",
    tabFile: "Laden/Speichern",
    introTitle: "Sound Balancing Tool für Cochlea Implantat Träger",
    introDesc:
      "Dieses Tool hilft CI-Trägern, die wahrgenommene Lautstärke ihrer Elektroden systematisch zu vergleichen und eine individuelle Korrekturkurve zu erstellen. Ziel ist es, exakt gleiche Lautstärke aller Elektroden einzustellen – die grundlegende Basis für gutes Hören mit CI. Diese Einstellung ist optimal für Musik und Naturgeräusche. Anpassungen für Sprachverständnis oder Effekte wie Baßverstärkung sind ebenfalls möglich und können live getestet werden.",
    introWhat: "Wie ist der Ablauf?",
    introWhatDesc: "",
    introFlow: "",
    introFlowDesc:
      "<b>1. Seite</b> - Wählen Sie oben rechts die Seite aus, auf der Sie das CI tragen. Wenn Sie 2 CI tragen, führen Sie die Messung (Punkt 3) für beide aus.<br><b>2. Implantat</b> – Wählen Sie Ihren Hersteller. Falls bekannt, korrigieren Sie die Frequenzeinträge pro Elektrode. Standardwerte sind voreingestellt.<br><b>Wichtig:</b> Deaktivierte Elektroden müssen unter „Status“ markiert werden.<br><b>3. Messung</b> – Starten Sie eine Testreihe. Das Tool spielt Tonpaare ab; Sie stellen ein, bis beide gleich laut klingen.<br><b>4. Player</b> – Laden Sie eine Musikdatei und hören Sie den Unterschied mit und ohne Korrektur.<br><b>5. Levels</b> – Optional: Gesamteinstellungen wie Sprachbetonung oder Baßverstärkung, live hörbar im Player.",
    introWarn:
      "Verwenden Sie möglichst ein CI-Programm ohne Sprachfilter, das ansonsten Ihrem Hauptprogramm entspricht. Sprachfilter neigen dazu, Töne zu verfälschen. Verbinden Sie Ihr CI mit Bluetooth für möglichst klare Töne.",
    introAudio: "Für Ihren Audiologen",
    tabPlayer: "Player",
    tabBalance: "Stereo-Balance",
    introAudioDesc:
      "Die Ergebnisse können ausgedruckt werden. Der Ausdruck enthält die Meßergebnisse, Ihre gewünschten Korrekturen und die resultierenden Equalizer-Werte.",
    freqTitle: "Hersteller, Elektrodenfrequenzen & Status",
    lblSide: "Seite:",
    lblMfr: "Hersteller:",
    freqHint:
      "Wählen Sie den Hersteller Ihres CI aus. Markieren Sie problematische Elektroden unter „Status“. Status „Deaktiviert“ = Elektrode im CI selbst abgeschaltet, wird automatisch ausgeschlossen. ▶ = Einzelton, ◼ = Dauerton.",
    freqDeactHint:
      "<b>Wichtig – deaktivierte Elektroden:</b> Wenn in Ihrem CI Elektroden deaktiviert sind, verteilt das Implantat den Frequenzbereich auf die verbleibenden aktiven Elektroden. Die Mittenfrequenzen aller anderen Elektroden verschieben sich dadurch – die hier voreingestellten Standardwerte gelten dann nicht mehr.<br>Markieren Sie deaktivierte Elektroden unter „Status“ und tragen Sie die aktuellen Mittenfrequenzen aus Ihrer Anpassung ein. Ohne korrekte Frequenzen sind Messung und Player-Equalizer nicht aussagekräftig.",
    thEl: "El.",
    thHzStd: "Hz Standard",
    thHzOwn: "Hz eigene",
    thPlay: "▶",
    thHold: "◼",
    thSt: "Status",
    thNote: "Notiz",
    thExclCb: "Ausschließen",
    stDeactivated: "Deaktiviert im CI",
    warnDeactivated:
      "Achtung: Frequenztabelle vermutlich nicht aktuell. Sie haben Elektrode(n) als deaktiviert markiert, die Frequenzwerte entsprechen aber den Standardwerten. Wenn Elektroden im CI deaktiviert sind, verteilen sich die Frequenzbänder auf die aktiven Elektroden um. Bitte aktuelle Mittenfrequenzen vom Audiologen erfragen und eintragen, sonst sind Messung und Equalizer nicht aussagekräftig.",
    resetFreq: "Zurücksetzen",
    sweep: "▶ Sweep",
    stop: "■ Stopp",
    lblCorr: "Korrektur anwenden",
    lblLevels: "Levels anwenden",
    toneTitle: "Tonparameter",
    lblVol: "Lautstärke:",
    lblDur: "Tondauer:",
    lblPau: "Pause:",
    testTitle: "Testeinstellungen",
    lblMode: "Modus:",
    optBal: "Ausgleichsmodus (dB-Offset)",
    optJdg: "Urteilsmodus (A/gleich/B)",
    lblRun: "Testverfahren:",
    optFull: "Vollständig (alle Paare)",
    optCF: "Konvergenz",
    optMan: "Manuell",
    lblRef: "Referenzelektrode:",
    lblVol2: "Lautstärke:",
    lblDur2: "Tondauer:",
    lblPau2: "Pause:",
    preCorrectLabel: "Feinjustierung mit vorkorrigierten Werten",
    runExplFull:
      "Alle Elektrodenpaare werden in Runden verglichen. In jeder Runde wird jede Elektrode genau einmal verglichen. A und B werden pro Paar zufällig zugewiesen. Genauestes Verfahren, dauert am längsten. Empfohlen als erster Durchlauf.",
    runExplCF:
      "Die Paare mit den größten Abweichungen werden erneut getestet, plus einige Zufallspaare. Erfordert vorhandene Ergebnisse. Kann beliebig oft wiederholt werden.",
    runExplMan: "Zwei Elektroden frei wählen und vergleichen.",
    recommend:
      "Empfehlung: <br> - Stellen Sie den Ton so laut ein, daß es fast unangenehm ist.<br> - Nutzen Sie möglichst eine Bluetooth Verbindung zum Streamen.<br> - Erst Testverfahren „Vollständig“ durchführen, dann „Konvergenz“. Beides ist beliebig oft wiederholbar.<br> - „Vollständig“ gliedert sich in Runden. In jeder Runde wird jede Elektrode genau einmal verglichen. Erste brauchbare Schätzungen liegen ab etwa drei oder vier abgeschlossenen Runden vor; verläßliche Werte erst nach vollständigem Durchlauf aller Runden.<br> - Bei Abbruch wird beim nächsten Start von „Vollständig“ dort fortgesetzt, wo aufgehört wurde.<br> - Wenn die Einstellungen grundsätzlich stimmig sind, nach diesen beiden Testvarianten das Häkchen bei „Feinjustierung“ setzen und „Konvergenz“ erneut durchführen.<br> - Im Reiter Meßergebnisse kann die Qualität der Justierung anhand der Farben eingeschätzt werden.",
    startTest: "▶ Test starten",
    stopTest: "■ Test beenden",
    testLockedInfo:
      "Während eines laufenden Tests kann dieser Tab nicht verlassen werden.",
    bBack: "Zurück",
    bReplay: "Nochmal",
    kSpace: "Leertaste",
    kEnter: "Enter",
    bExcl: "Ausschließen",
    bLoud: "lauter",
    bLoud2: "lauter",
    bEqual: "Gleich",
    slHint: "Mittleren Ton (B) anpassen. ◀▶ ±0.5 dB · Shift+◀▶ ±0.1 dB",
    bExtend: "Bereich erweitern (±40 dB)",
    bConf: "Offset bestätigen",
    bCanc: "Abbrechen",
    exclTitle: "Welche Elektrode ausschließen?",
    resTitle: "Ergebnisse",
    noRes: 'Noch keine Messungen. Starte einen Test im Tab „Test".',
    comp: "Vergleich",
    of: "von",
    round: "Runde",
    chartExplB:
      "Wahrgenommene Lautstärke relativ zur Referenz (0 dB). Positiv = lauter, negativ = leiser. Fehlerbalken = mittleres Residuum. Berechnung: Gewichtete Least Squares.",
    chartExplJ:
      'Score = „lauter" minus „leiser". Hohe positive Werte = wird als zu laut empfunden.',
    thOff: "Offset (dB)",
    thMes: "Messungen",
    thRes: "∅ Residuum",
    thWgt: "Gewicht",
    thStR: "Status",
    thSc: "Score",
    thComp: "Vergl.",
    resExplain:
      "Residuum: Die mittlere Abweichung der Einzelmessungen einer Elektrode vom Gesamtergebnis. Hohe Werte = unsichere Messung, z.B. durch verrauschte Elektrode oder schwieriges Urteil. Least Squares: Mathematisches Verfahren, das aus allen Paarvergleichen gleichzeitig die bestmöglichen Offset-Werte berechnet. Einzelne Meßfehler haben wenig Einfluß, weil sie sich gegen viele andere Messungen behaupten müssen. Gewichtung: Starkes Rauschen (0.1), Rauschen mit etwas Ton (0.5), Ton mit Rauschen (0.9), fast stumm (0.1) fließen mit reduziertem Gewicht ein.",
    fClear: "Meßergebnisse für eingestellte Seite löschen",
    delConfirmMeas: "Meßergebnisse löschen?",
    resetConfirm:
      "Wirklich alles zurücksetzen? Alle Einstellungen, Meßwerte und Notizen werden gelöscht.",
    resetDone: "Alles zurückgesetzt.",
    reliabilityTitle: "Einschätzung der Meßzuverlässigkeit",
    glossTitle: "Begriffserklärung",
    glossResiduum:
      "<b>Residuum</b>: Zeigt, wie widersprüchlich Ihre Urteile bei einer Elektrode waren. Kurze Fehlerbalken = konsistente Urteile, lange Fehlerbalken = die Einschätzungen haben geschwankt.",
    glossErrBar:
      "<b>Fehlerbalken</b> (die senkrechten Striche an den Balken): Zeigen die Größe des Residuums – je länger, desto unsicherer die Messung.",
    glossAnpassung:
      "<b>Anpassung</b>: Gibt an, um wie viel dB diese Elektrode lauter (+) oder leiser (−) eingestellt wird als die Referenzelektrode.",
    glossFarbe:
      "<b>Ampelfarben</b>: Grün = zuverlässig gemessen, Gelb = grenzwertig, Rot = unsichere Messung, Grau = noch keine Messung für diese Elektrode. Die Farbe zeigt die Meßqualität – nicht die Stärke der Änderung.",
    glossRef:
      "<b>Referenzelektrode</b>: Der Fixpunkt der Messung. Ihre Anpassung ist immer 0 dB. Alle anderen Elektroden werden relativ zu ihr bewertet.",
    glossLS:
      "<b>Least Squares</b>: Mathematisches Verfahren, das aus allen Paarvergleichen gleichzeitig die bestmöglichen Offset-Werte berechnet. Einzelne Meßehler haben wenig Einfluß, weil sie sich gegen viele andere Messungen behaupten müssen. Im Reiter „Implantat“ als problematisch markierte Elektroden fließen mit reduziertem Gewicht ein.",
    preCorrHint: "Vorheriger Wert: {v} dB vom Schätzwert",
    apikal: "apikal",
    basal: "basal",
    stNoisyHeavy: "Starkes Rauschen",
    stNoisyMore: "Rauschen mit etwas Ton",
    stNoisyLess: "Ton mit Rauschen",
    stAlmMute: "fast stumm",
    stMute: "stumm",
    stExcl: "ausschließen",
    total: "Gesamt",
    prev: "vorher",
    excluded: "ausgeschl.",
    copyDone: "Kopiert.",
    delConfirmMeas: "Meßergebnisse löschen?",
    delConfirmAll: "Auch alle Einstellungen zurücksetzen?",
    manComp: "Manueller Vergleich",
    pairsRem: "Vergleiche verbleiben",
    exclDuring: "ausgeschlossen",
    plTitle: "Audioplayer mit Korrektur-Equalizer",
    plDesc:
      "Dieser Player simuliert, wie Musik oder Sprache klingen könnte, wenn die CI-Lautstärkekurve korrigiert würde. Er verändert das Signal vor der CI-Verarbeitung – nicht identisch mit einer MCL-Anpassung, aber ein Anhaltspunkt.",
    plNoData: "Noch keine Meßdaten. Erst einen Test durchführen.",
    plFile: "Audiodatei (MP3, WAV, FLAC, OGG, M4A, MP4)",
    plEqOn: "Equalizer AN",
    plEqOff: "Equalizer AUS",
    plEqStr: "Equalizer-Stärke:",
    plEqTitle: "Equalizer-Kurve (angewandt)",
    plNotice:
      "Der Equalizer korrigiert das Audiosignal vor der CI-Verarbeitung. Das ist nicht identisch mit einer MCL-Anpassung, gibt aber einen Anhaltspunkt.",
    plNHLabel: "Simulation für Normalhörende",
    plBalApply: "Stereo-Balance anwenden",
    plBalApplyOn: "✓ Stereo-Balance AN",
    plBalApplyOff: "Stereo-Balance AUS",
    plNHExpl:
      "Veranschaulicht die Fehleinstellung, die ohne Korrektur vorliegt: die gemessenen Lautstärkeunterschiede werden auf das Originalsignal angewandt (nicht invertiert). Einschränkung: Dies zeigt nur die Lautstärkebalance, nicht die CI-typischen Artefakte.",
    plMapLabel: "MAPLAW-Simulation",
    plMapExpl: "Simuliert die MED-EL MAPLAW-Kompression (logarithmisch).",
    balTitle: "Stereo-Balance",
    balDesc:
      "Stellt die relative Lautstärke zwischen linker und rechter Korrektur ein. Funktioniert im Player bei Stereo-Audio.",
    balLabel: "Balance:",
    fileTitle: "Laden / Speichern",
    fileDesc:
      "Alle Einstellungen und Ergebnisse werden als JSON-Datei gespeichert: Hersteller, Frequenzen, Elektrodenstatus, Notizen, Referenzelektrode, Tonparameter, Paradigma und alle Meßergebnisse.",
    fLoad: "Laden",
    fSave: "Speichern",
    fPrint: "Ergebnisse drucken",
    fCopy: "Tabelle kopieren",
    fResetAll: "Alles zurücksetzen",
    fExplain:
      "Die Einstellungen im Player werden beim Ausdruck berücksichtigt. Der Ausdruck gibt das wieder, was Sie im Player hören und als Equalizer-Kurve sehen.",
    eeDesc:
      "Exportiert die Korrekturkurve als EasyEffects-Preset für PipeWire/PulseAudio.",
    eeExport: "EasyEffects-Preset exportieren",
    eeHowTo:
      "Anleitung: 1) EasyEffects installieren. 2) Exportierte Datei nach ~/.config/easyeffects/output/ kopieren. 3) In EasyEffects das Preset laden und aktivieren.",
    eePlayerHint:
      "Die Einstellungen im Player werden berücksichtigt. Achten Sie auf die Einstellungen zu Links/Rechts/Beide Seiten. WICHTIG: EasyEffects muß deaktiviert sein, wenn Sie dieses Tool zum Messen oder Hören verwenden!",
    tabLevels: "Levels",
    lvTitle: "Manuelle Levels",
    lvExpl:
      "Hier können die Lautstärkepegel einzelner Elektroden manuell angepaßt werden (dB relativ). Diese Werte sind unabhängig von den Meßergebnissen und können im Player wahlweise einzeln oder zusammen mit der Meßkorrektur angewandt werden. Tastatur: ↑↓ Elektrode wechseln, ←→ ±0.5 dB, Shift ±0.1 dB.",
    lvPreset: "Preset:",
    lvPrNone: "Keines",
    lvPrTilt: "Tilt (Höhen/Tiefen)",
    lvPrPivot: "Pivot (Mitte betonen)",
    lvPrSpeech: "Sprache (SII)",
    lvPrScurve: "S-Kurve",
    lvPrGauss: "Gauß",
    lvPrBass: "Bass Boost",
    lvPrHigh: "High Boost",
    lvPrStr: "Stärke:",
    lvReset: "Manuelle Werte zurücksetzen",
    lvPrExplTilt:
      "Linearer Anstieg von apikal nach basal. Positive Werte betonen Höhen, negative Tiefen. Entspricht dem MAESTRO Tilt-Werkzeug.",
    lvPrExplPivot:
      "Mitte betonen, Ränder absenken (positiv) oder umgekehrt. Entspricht dem MAESTRO Pivot-Werkzeug.",
    lvPrExplScurve:
      "Wie Tilt, aber mit weicherem Übergang in der Mitte. Links der Mitte abgesenkt, rechts angehoben (oder umgekehrt).",
    lvPrExplGauss:
      "Glockenkurve um eine gewählte Elektrode. Breite bestimmt, wie viele Nachbarelektroden betroffen sind.",
    lvPrExplBass:
      "Tiefe Frequenzen anheben (positiv) oder absenken (negativ). Grenzpunkt bestimmt, bis zu welcher Elektrode der Effekt wirkt.",
    lvPrExplHigh:
      "Hohe Frequenzen anheben (positiv) oder absenken (negativ). Grenzpunkt bestimmt, ab welcher Elektrode der Effekt wirkt.",
    lvPrExplSpeech:
      "Gewichtung nach Sprachverständlichkeit (ANSI S3.5 Band Importance Function). Positive Werte heben sprachrelevante Frequenzen (ca. 800–4000 Hz) an, negative senken sie ab.",
    lvPresetTitle: "Presets",
    lvPresetBoth: "Veränderung auf beide Seiten anwenden",
    lvPresetDesc:
      "Vordefinierte Kurvenformen. Tilt und Pivot entsprechen den gleichnamigen MAESTRO-Werkzeugen. Das Sprache-Preset gewichtet Frequenzen nach ihrer Bedeutung für die Sprachverständlichkeit (ANSI S3.5). Tastatur: ↑↓ justiert Werte im Eingabefeld.",
    lvChartTitle: "Übersicht",
    lvChartMan: "Manuell",
    lvChartSum: "Summe",
    lvPrCenter: "Mitte:",
    lvPrWidth: "Breite:",
    lvPrCutoff: "Grenzpunkt:",
    plSrcLabel: "Equalizer-Quelle:",
    plSideLabel: "Seite:",
    plSrcMeas: "Gemessen",
    plSrcLevels: "Levels",
    plSrcBoth: "Beide (addiert)",
    plBothLabel: "Beide Seiten",
    plMonoEQLabel:
      "EQ der aktiven Seite auf beide Seiten Links+Rechts anwenden",
    freqAbfHint:
      "<b>Wichtig – Anatomy Based Fitting (ABF) und FAT:</b> Auch bei Anatomy Based Fitting (ABF) gelten andere Mittenfrequenzen für die Elektroden. Generell: Fragen Sie Ihren Audiologen nach der FAT (Frequency Allocation Table) Ihres CI, um alle den Elektroden zugeordneten Frequenzen zu erfahren.",
    plFileTitle: "Audiodatei",
    printPlayerTitle: "Player-Einstellungen",
    printPreCorrect: "Feinjustierung mit Vorkorrektur: aktiv",
    implTitle: "Implantat-Daten",
    implIntro:
      "Erfragen Sie bei Ihrem Audiologen die Werte der FAT (Frequency Allocation Table) mit Mittelfrequenzen (in Hz) für jede Elektrode und tragen Sie diese oben ein. Erfragen Sie auch MCL (MED-EL), T-Level/C-Level (Cochlear) oder T-Level/M-Level (Advanced Bionics) – diese Werte stehen in der Anpaß-Software des Audiologen und werden für die Berechnung der Anpassungswerte im Ausdruck benötigt. Sie können das Tool auch ohne diese Werte nutzen, mit den Werten werden die Ergebnisse aber präziser.",
    implBilateralHint:
      "Bei zwei CIs müssen die Werte für Links und Rechts getrennt eingegeben werden. Wechseln Sie mit den Seiten-Buttons oben.",
    lblImplModel: "Implantat-Modell:",
    lblImplProc: "Audioprozessor:",
    lblImplC: "c-Wert (MAPLAW):",
    lblImplIDR: "IDR (dB):",
    lblImplIIDR: "IIDR (dB):",
    lblImplGen: "Generation:",
    implPerElTitle: "Pro-Elektroden-Werte (vom Audiologen)",
    implPerElHint:
      "Tragen Sie THR und MCL (MED-EL) bzw. T-Level/C-Level (Cochlear) bzw. T-Level/M-Level (Advanced Bionics) ein. Diese Werte stehen in der Anpaß-Software Ihres Audiologen.",
    implThHdr: "THR",
    implMclHdr: "MCL (qu)",
    implTLvlHdr: "T-Level",
    implCLvlHdr: "C-Level (CL)",
    implMLvlHdr: "M-Level (CU)",
    implUnknown: "Unbekannt",
    implSelectPleaseHdr: "— bitte wählen —",
    implGenA: "Generation A (0,176 dB/CL)",
    implGenB: "Generation B (0,157 dB/CL)",
    implGenUnknown: "—",
    implPrintHeader: "Implantat",
    implPrintProcessor: "Prozessor",
    implPrintCVal: "c-Wert",
    implPrintIDR: "IDR",
    implPrintIIDR: "IIDR",
    implPrintGen: "Generation",
    implPrintColDelta: "Δ dB (Tool)",
    implPrintColCurrent: "Aktuell",
    implPrintColDeltaUnit: "Δ (Einheit)",
    implPrintColNew: "Neuer Wert",
    implPrintColStatus: "Status",
    implPrintNA: "N/A",
    implPrintNotesTitle: "Hinweise für den Audiologen",
    implPrintNote1:
      "Die gezeigten Korrekturwerte sind Approximationen aus akustischen Lautstärkemessungen mit psychoakustischem Paarvergleich. Sie ersetzen keine direkte stimulationsbasierte Anpassung.",
    implPrintNote2:
      "Empfohlene Vorgehensweise: Werte als Startpunkt verwenden · mit Balancing-Funktion gegen Nachbarelektroden prüfen · Patient bestätigt subjektive Gleichheit · bei Diskrepanzen Tool-Werten nicht folgen.",
    implPrintNote2b:
      "Vorzeichen: Positive Δ-Werte bedeuten, daß MCL/C/M-Level angehoben werden soll (Elektrode wurde als zu leise gemessen). Negative Werte = absenken.",
    implPrintNote3Missing:
      "Folgende Werte fehlen und konnten nicht berechnet werden: {list}. Bitte teilen Sie diese Werte dem Klienten mit, damit das Tool künftig vollständige Empfehlungen liefern kann.",
    implPrintNote4IDR:
      "IDR wurde nicht angegeben. Berechnung erfolgte mit Standardwert 60 dB. Falls Ihr eingestellter IDR abweicht, sind die Δ-Werte entsprechend zu skalieren.",
    implPrintNote5Large:
      "Bei Korrekturen über ±5 dB pro Elektrode: Compliance-Grenzen prüfen · Loudness-Growth-Function kann sich verändern · stimulationsbasierte Verifikation zwingend.",
    implPrintModelMissing:
      "Bitte Implantat-Modell wählen – Generation unbekannt, Berechnung nicht möglich.",
  },
  en: {
    subtitle: "CI Sound Balancing Tool · v2.7",
    sideLeft: "LEFT",
    sideRight: "RIGHT",
    tabIntro: "Introduction",
    tabFreq: "Implant",
    tabTest: "Measurement",
    tabResults: "Results",
    tabFile: "Load/Save",
    introTitle: "Sound Balancing Tool for Cochlear Implant Users",
    introDesc:
      "This tool helps CI users systematically compare the perceived loudness of their electrodes and create an individual correction curve. The goal is to set exactly equal loudness across all electrodes – the fundamental basis for good hearing with CI. This setting is optimal for music and natural sounds. Adjustments for speech intelligibility or effects such as bass boost are also possible and can be tested live.",
    introWhat: "What is the workflow?",
    introWhatDesc: "",
    introFlow: "",
    introFlowDesc:
      "<b>1. Side</b> – Select the side on which you wear your CI in the top right corner. If you wear two CIs, perform the measurement (Step 3) for both.<br><b>2. Implant</b> – Select your manufacturer. If known, adjust the frequency values listed for each electrode; standard values are pre-configured by default.<br><b>Important:</b> Deactivated electrodes must be marked under “Status”.<br><b>3. Measurement</b> – Start a test sequence. The tool plays pairs of tones; adjust the settings until both tones sound equally loud. Recommendation: Set the volume to a level that borders on being uncomfortable.<br><b>4. Player</b> – Load a music file and listen to the difference with and without the correction applied.<br><b>5. Levels</b> – Optional: Apply global settings (e.g., speech emphasis, bass boosting) and listen to the difference live in the player simultaneously.",
    introWarn:
      "Use a CI program without speech filters that otherwise matches your main program. Speech filters tend to distort tones. Connect your CI via Bluetooth for the clearest possible sound..",
    introAudio: "For your audiologist",
    tabPlayer: "Player",
    tabBalance: "Stereo-Balance",
    introAudioDesc:
      'The results can be printed out. The printout includes the measurement results, your requested corrections, and the resulting equalizer values. This allows your audiologist to see exactly where adjustments are needed.<br>Project Homepage: <a href="https://github.com/mviereck/ci-loudness-balancing" target="_blank" style="color:var(--accent)">https://github.com/mviereck/ci-loudness-balancing</a>',
    freqTitle: "Manufacturer, electrode frequencies & status",
    lblSide: "Side:",
    lblMfr: "Manufacturer:",
    freqHint:
      'Select your CI manufacturer. Mark problematic electrodes under "Status". Status "Deactivated" = electrode switched off in the CI itself, will be automatically excluded. ▶ = single tone, ◼ = sustained tone.',
    freqDeactHint:
      "<b>Important – deactivated electrodes:</b> When electrodes in your CI are deactivated, the implant redistributes the frequency range across the remaining active electrodes. The centre frequencies of all other electrodes shift as a result – the pre-set default values no longer apply.<br>Mark deactivated electrodes under “Status” and enter the current centre frequencies from your fitting. Without correct frequencies, measurements and the player equalizer will not be meaningful.",
    thEl: "El.",
    thHzStd: "Hz default",
    thHzOwn: "Hz custom",
    thPlay: "▶",
    thHold: "◼",
    thSt: "Status",
    thNote: "Note",
    thExclCb: "Exclude",
    stDeactivated: "Deactivated in CI",
    warnDeactivated:
      "Warning: Frequency table may not be current. You have marked electrode(s) as deactivated, but the frequency values still reflect the default values. When electrodes in the CI are deactivated, the frequency bands are redistributed across the active electrodes. Please ask your audiologist for the current centre frequencies and enter them here – otherwise measurements and the equalizer will not be meaningful.",
    resetFreq: "Reset",
    sweep: "▶ Sweep",
    stop: "■ Stop",
    lblCorr: "Apply correction",
    lblLevels: "Apply levels",
    toneTitle: "Tone parameters",
    lblVol: "Volume:",
    lblDur: "Duration:",
    lblPau: "Pause:",
    testTitle: "Test settings",
    lblMode: "Mode:",
    optBal: "Balance mode (dB offset)",
    optJdg: "Judgment mode (A/equal/B)",
    lblRun: "Test method:",
    optFull: "Complete (all pairs)",
    optCF: "Convergence",
    optMan: "Manual",
    lblRef: "Reference electrode:",
    lblVol2: "Volume:",
    lblDur2: "Duration:",
    lblPau2: "Pause:",
    preCorrectLabel: "Fine-tuning with pre-corrected values",
    runExplFull:
      "All electrode pairs are compared in rounds. In each round, every electrode is compared exactly once. A and B are randomly assigned per pair. Most accurate method, takes longest. Recommended as first run.",
    runExplCF:
      "Pairs with the largest deviations are re-tested, plus some random pairs. Requires existing results. Can be repeated as often as desired.",
    runExplMan: "Freely choose two electrodes and compare them.",
    recommend:
      'Recommendation: <br> - Set the volume to a level that borders on being uncomfortable.<br> - Use a Bluetooth connection for streaming if at all possible.<br> - First, perform the "Complete" test procedure, then "Convergence." Both can be repeated as often as desired.<br> - "Complete" is organized in rounds. In each round, every electrode is compared exactly once. Reliable first estimates emerge after about three or four completed rounds; dependable values only after all rounds are finished.<br> - If you stop early, the next start of "Complete" resumes where you left off.<br> - If the settings appear fundamentally sound, check the "Fine-tuning" box after running these two test variants, and then run "Convergence" again.<br> - On the "Measurement Results" tab, the quality of the adjustment can be assessed based on the colors.',
    startTest: "▶ Start test",
    stopTest: "■ End test",
    testLockedInfo: "Cannot leave this tab while a test is running.",
    bBack: "Back",
    bReplay: "Replay",
    kSpace: "Space",
    kEnter: "Enter",
    bExcl: "Exclude",
    bLoud: "louder",
    bLoud2: "louder",
    bEqual: "Equal",
    slHint: "Adjust middle tone (B). ◀▶ ±0.5 dB · Shift+◀▶ ±0.1 dB",
    bExtend: "Extend range (±40 dB)",
    bConf: "Confirm offset",
    bCanc: "Cancel",
    exclTitle: "Which electrode to exclude?",
    resTitle: "Results",
    noRes: "No measurements yet. Start a test.",
    comp: "Comparison",
    of: "of",
    round: "Round",
    chartExplB:
      "Perceived loudness relative to reference (0 dB). Positive = louder, negative = quieter. Error bars = mean residual. Weighted least squares.",
    chartExplJ: 'Score = "louder" minus "quieter" judgments.',
    thOff: "Offset (dB)",
    thMes: "Measurements",
    thRes: "∅ Residual",
    thWgt: "Weight",
    thStR: "Status",
    thSc: "Score",
    thComp: "Comp.",
    resExplain: "",
    fClear: "Delete results",
    delConfirmMeas: "Delete measurement results?",
    resetConfirm:
      "Really reset everything? All settings, measurement results, and notes will be deleted.",
    resetDone: "Everything reset.",
    reliabilityTitle: "Measurement Reliability Assessment",
    glossTitle: "Glossary",
    glossResiduum:
      "<b>Residual</b>: Shows how inconsistent your judgments were for an electrode. Short error bars = consistent judgments, long error bars = judgments varied.",
    glossErrBar:
      "<b>Error bars</b> (the vertical lines on the bars): Show the size of the residual – the longer, the more uncertain the measurement.",
    glossAnpassung:
      "<b>Adjustment</b>: How many dB louder (+) or quieter (−) this electrode is set compared to the reference electrode.",
    glossFarbe:
      "<b>Traffic light colors</b>: Green = reliably measured, Yellow = borderline, Red = uncertain measurement, Grey = no measurements yet for this electrode. The color shows measurement quality – not the size of the adjustment.",
    glossRef:
      "<b>Reference electrode</b>: The fixed point of the measurement. Its adjustment is always 0 dB. All other electrodes are evaluated relative to it.",
    glossLS:
      '<b>Least Squares</b>: Mathematical method that calculates the best offset values from all pair comparisons simultaneously. Individual measurement errors have little influence because they must compete against many other measurements. Electrodes marked as problematic in the "Implant" tab contribute with reduced weight.',
    preCorrHint: "Previous value: {v} dB from estimate",
    apikal: "apical",
    basal: "basal",
    stNoisyHeavy: "Heavy noise",
    stNoisyMore: "Noise with some tone",
    stNoisyLess: "Tone with noise",
    stAlmMute: "almost mute",
    stMute: "mute",
    stExcl: "exclude",
    total: "Total",
    prev: "previous",
    excluded: "excluded",
    copyDone: "Copied.",
    delConfirmMeas: "Delete measurement results?",
    delConfirmAll: "Also reset all settings?",
    manComp: "Manual comparison",
    pairsRem: "pairs remaining",
    exclDuring: "excluded",
    plTitle: "Audio player with correction equalizer",
    plDesc:
      "This player simulates how music or speech might sound if the CI loudness curve were corrected. It modifies the signal before CI processing – not identical to MCL adjustment, but an indication.",
    plNoData: "No measurement data yet. Run a test first.",
    plFile: "Audio file (MP3, WAV, FLAC, OGG, M4A, MP4)",
    plEqOn: "Equalizer ON",
    plEqOff: "Equalizer OFF",
    plEqStr: "Equalizer strength:",
    plEqTitle: "Equalizer curve (applied)",
    plNotice:
      "The equalizer corrects the audio signal before CI processing. Not identical to MCL adjustment but an indication.",
    plNHLabel: "Normal hearing simulation",
    plNHExpl:
      "Illustrates the distortion present without correction: measured loudness differences are applied (not inverted).",
    plBalApply: "Apply Stereo Balance",
    plBalApplyOn: "✓ Stereo Balance ON",
    plBalApplyOff: "Stereo Balance OFF",
    plMapLabel: "MAPLAW simulation",
    plMapExpl: "Simulates MED-EL MAPLAW compression.",
    balTitle: "Stereo balance",
    balDesc:
      "Adjust the relative loudness between left and right correction. Works in the player with stereo audio.",
    balLabel: "Balance:",
    fileTitle: "Load / Save",
    fileDesc: "All settings and results saved as JSON.",
    fLoad: "Load results",
    fSave: "Save results",
    fPrint: "Print results",
    fCopy: "Copy table",
    fResetAll: "Reset everything",
    fExplain:
      "Player settings are included in the printout. The printout reflects what you hear in the player and see as equalizer curve.",
    eeDesc:
      "Exports the correction curve as EasyEffects preset for PipeWire/PulseAudio.",
    eeExport: "Export EasyEffects preset",
    eeHowTo:
      "Instructions: 1) Install EasyEffects. 2) Copy exported file to ~/.config/easyeffects/output/. 3) Load and activate the preset in EasyEffects.",
    eePlayerHint:
      "Export uses the current player settings (equalizer source, strength, normal hearing simulation). Note the Left/Right/Both sides settings. IMPORTANT: EasyEffects must be disabled when using this tool for measurement or listening!",
    tabLevels: "Levels",
    lvTitle: "Manual Levels",
    lvExpl:
      "Manually adjust the loudness level of individual electrodes (dB relative). These values are independent of measurements and can be applied in the player separately or combined with measured correction. Keyboard: ↑↓ switch electrode, ←→ ±0.5 dB, Shift ±0.1 dB.",
    lvPreset: "Preset:",
    lvPrNone: "None",
    lvPrTilt: "Tilt",
    lvPrPivot: "Pivot",
    lvPrSpeech: "Speech (SII)",
    lvPrScurve: "S-Curve",
    lvPrGauss: "Gaussian",
    lvPrBass: "Bass Boost",
    lvPrHigh: "High Boost",
    lvPrStr: "Strength:",
    lvReset: "Reset manual values",
    lvPrExplTilt:
      "Linear slope from apical to basal. Positive values emphasize highs, negative values emphasize lows. Corresponds to the MAESTRO Tilt tool.",
    lvPrExplPivot:
      "Emphasize center, reduce edges (positive) or vice versa (negative). Corresponds to the MAESTRO Pivot tool.",
    lvPrExplScurve: "Like Tilt but with a softer transition in the center.",
    lvPrExplGauss:
      "Bell curve around a chosen electrode. Width determines how many neighboring electrodes are affected.",
    lvPrExplBass:
      "Boost low frequencies (positive) or cut them (negative). Cutoff sets which electrode the effect reaches.",
    lvPrExplHigh:
      "Boost high frequencies (positive) or cut them (negative). Cutoff sets where the effect starts.",
    lvPrExplSpeech:
      "Weighting by speech intelligibility (ANSI S3.5 Band Importance Function). Positive values boost speech-relevant frequencies (approx. 800–4000 Hz), negative values reduce them.",
    lvPresetTitle: "Presets",
    lvPresetBoth: "Apply changes to both sides",
    lvPresetDesc:
      "Predefined curve shapes. Tilt and Pivot correspond to the MAESTRO tools of the same name. The Speech preset weights frequencies by their importance for speech intelligibility (ANSI S3.5). Keyboard: ↑↓ adjusts values in the input field.",
    lvChartTitle: "Overview",
    lvChartMan: "Manual",
    lvChartSum: "Sum",
    lvPrCenter: "Center:",
    lvPrWidth: "Width:",
    lvPrCutoff: "Cutoff:",
    plSrcLabel: "Equalizer source:",
    plSrcMeas: "Measured",
    plSrcLevels: "Levels",
    plSrcBoth: "Both (summed)",
    plBothLabel: "Both sides",
    plMonoEQLabel: "Apply active side EQ to both channels Left+Right",
    freqAbfHint:
      "<b>Important – Anatomy Based Fitting (ABF) and FAT:</b> With Anatomy Based Fitting (ABF), different centre frequencies apply to the electrodes as well. In general: ask your audiologist for the FAT (Frequency Allocation Table) of your CI to find out all the frequencies assigned to the electrodes.",
    recommend:
      'Recommendation: <br> - Set the volume to a level that borders on being uncomfortable.<br> - Use a Bluetooth connection for streaming if at all possible.<br> - First, perform the "Complete" test procedure, then "Convergence." Both can be repeated as often as desired.<br> - "Complete" is organized in rounds. In each round, every electrode is compared exactly once. Reliable first estimates emerge after about three or four completed rounds; dependable values only after all rounds are finished.<br> - If you stop early, the next start of "Complete" resumes where you left off.<br> - If the settings appear fundamentally sound, check the "Fine-tuning" box after running these two test variants, and then run "Convergence" again.<br> - On the "Measurement Results" tab, the quality of the adjustment can be assessed based on the colors.',
    plFileTitle: "Audio file",
    printPlayerTitle: "Player settings",
    printPreCorrect: "Fine-tuning with pre-correction: active",
    implTitle: "Implant data",
    implIntro:
      "Ask your audiologist for the FAT (Frequency Allocation Table) with centre frequencies (in Hz) for each electrode and enter them above. Also ask for MCL (MED-EL), T-Level/C-Level (Cochlear) or T-Level/M-Level (Advanced Bionics) – these values are in the audiologist's fitting software and are needed to calculate the fitting recommendations in the printout. You can use the tool without these values, but results will be more precise with them.",
    implBilateralHint:
      "For two CIs, values for left and right must be entered separately. Switch sides using the buttons above.",
    lblImplModel: "Implant model:",
    lblImplProc: "Audio processor:",
    lblImplC: "c value (MAPLAW):",
    lblImplIDR: "IDR (dB):",
    lblImplIIDR: "IIDR (dB):",
    lblImplGen: "Generation:",
    implPerElTitle: "Per-electrode values (from audiologist)",
    implPerElHint:
      "Enter THR and MCL (MED-EL), T-Level/C-Level (Cochlear), or T-Level/M-Level (Advanced Bionics). These values are available in your audiologist's fitting software.",
    implThHdr: "THR",
    implMclHdr: "MCL (qu)",
    implTLvlHdr: "T-Level",
    implCLvlHdr: "C-Level (CL)",
    implMLvlHdr: "M-Level (CU)",
    implUnknown: "Unknown",
    implSelectPleaseHdr: "— please select —",
    implGenA: "Generation A (0.176 dB/CL)",
    implGenB: "Generation B (0.157 dB/CL)",
    implGenUnknown: "—",
    implPrintHeader: "Implant",
    implPrintProcessor: "Processor",
    implPrintCVal: "c value",
    implPrintIDR: "IDR",
    implPrintIIDR: "IIDR",
    implPrintGen: "Generation",
    implPrintColDelta: "Δ dB (tool)",
    implPrintColCurrent: "Current",
    implPrintColDeltaUnit: "Δ (unit)",
    implPrintColNew: "New value",
    implPrintColStatus: "Status",
    implPrintNA: "N/A",
    implPrintNotesTitle: "Notes for the audiologist",
    implPrintNote1:
      "The correction values shown are approximations derived from acoustic loudness measurements using psychoacoustic paired comparison. They do not replace direct stimulation-based fitting.",
    implPrintNote2:
      "Recommended approach: use values as a starting point · verify against neighbouring electrodes with the balancing function · patient confirms subjective equality · if discrepancies arise, do not follow the tool values.",
    implPrintNote2b:
      "Sign convention: positive Δ values mean MCL/C/M-level should be raised (electrode was measured as too quiet). Negative values = lower.",
    implPrintNote3Missing:
      "The following values are missing and could not be calculated: {list}. Please share these values with the client so the tool can provide complete recommendations in the future.",
    implPrintNote4IDR:
      "IDR was not specified. Calculation used default value of 60 dB. If your configured IDR differs, the Δ values should be scaled accordingly.",
    implPrintNote5Large:
      "For corrections exceeding ±5 dB per electrode: check compliance limits · loudness growth function may change · stimulation-based verification mandatory.",
    implPrintModelMissing:
      "Please select implant model – generation unknown, calculation not possible.",
  },
  fr: {
    subtitle: "CI Sound Balancing Tool · v2.7",
    sideLeft: "LEFT",
    sideRight: "RIGHT",
    sideLeft: "GAUCHE",
    sideRight: "DROITE",
    tabIntro: "Introduction",
    tabFreq: "Implant",
    tabTest: "Mesure",
    tabResults: "Résultats",
    tabFile: "Charger/Sauver",
    introTitle: "CI Sound Balancing Tool",
    introDesc:
      "Cet outil aide les porteurs d'IC à comparer systématiquement le volume perçu de leurs électrodes et à créer une courbe de correction individuelle. L'objectif est d'obtenir un volume exactement égal pour toutes les électrodes – la base fondamentale d'une bonne audition avec IC. Ce réglage est optimal pour la musique et les sons naturels. Des ajustements pour la compréhension de la parole ou des effets comme le renforcement des basses sont également possibles.",
    introWhat: "Quel est le déroulement?",
    introWhatDesc: "",
    introFlow: "",
    introFlowDesc:
      "<b>1. Côté</b> – Sélectionnez, dans le coin supérieur droit, le côté sur lequel vous portez votre implant cochléaire. Si vous portez deux implants, effectuez la mesure (Étape 3) pour chacun d'eux.<br><b>2. Implant</b> – Sélectionnez le fabricant de votre implant cochléaire. Si vous les connaissez, ajustez les valeurs de fréquence indiquées pour chaque électrode ; des valeurs standard sont préconfigurées par défaut.<br><b>Important :</b> Les électrodes désactivées doivent être marquées sous «Statut».<br><b>3. Mesure</b> – Lancez une séquence de test. L'outil diffuse des paires de sons ; ajustez les réglages jusqu'à ce que les deux sons vous semblent avoir exactement le même volume. Recommandation : réglez le volume à un niveau frisant l'inconfort.<br><b>4. Lecteur</b> – Chargez un fichier musical et écoutez la différence, avec et sans l'application de la correction.<br><b>5. Niveaux</b> – Facultatif : Appliquez des réglages globaux (par ex. accentuation de la parole, renforcement des basses) et écoutez simultanément la différence en direct dans le lecteur.",
    introWarn:
      "Si possible, utilisez un programme d'implant cochléaire sans filtre vocal qui corresponde par ailleurs à votre programme principal. Les filtres vocaux ont tendance à déformer les sons. Connectez votre implant cochléaire via Bluetooth pour obtenir le son le plus clair possible.",
    introAudio: "Pour votre audiologiste",
    tabPlayer: "Player",
    tabBalance: "Stereo-Balance",
    introAudioDesc:
      'Les résultats peuvent être imprimés. Le document contient les résultats de mesure, vos corrections souhaitées et les valeurs égaliseur. Cela permet à votre audiologiste de voir directement où un ajustement est nécessaire.<br>Page d\'accueil du projet : <a href="https://github.com/mviereck/ci-loudness-balancing" target="_blank" style="color:var(--accent)">https://github.com/mviereck/ci-loudness-balancing</a>',
    freqTitle: "Fabricant, fréquences & statut",
    lblMfr: "Fabricant:",
    freqHint:
      "Sélectionnez le fabricant de votre IC. Marquez les électrodes problématiques sous «Statut». Statut «Désactivé» = électrode éteinte dans l’IC lui-même, sera automatiquement exclue. ▶ = son, ◼ = son continu.",
    freqDeactHint:
      "<b>Important – électrodes désactivées :</b> Lorsque des électrodes de votre IC sont désactivées, l’implant redistribue la plage de fréquences sur les électrodes actives restantes. Les fréquences centrales de toutes les autres électrodes se déplacent en conséquence – les valeurs standard préconfigurées ne s’appliquent alors plus.<br>Marquez les électrodes désactivées sous «Statut» et saisissez les fréquences centrales actuelles de votre réglage. Sans fréquences correctes, les mesures et l’égaliseur du lecteur ne seront pas significatifs.",
    thEl: "Él.",
    thHzStd: "Hz standard",
    thHzOwn: "Hz propres",
    thPlay: "▶",
    thHold: "◼",
    thSt: "Statut",
    thNote: "Note",
    thExclCb: "Exclure",
    stDeactivated: "Désactivé dans IC",
    warnDeactivated:
      "Attention : tableau de fréquences probablement pas à jour. Vous avez marqué des électrode(s) comme désactivées, mais les valeurs de fréquence correspondent encore aux valeurs standard. Lorsque des électrodes sont désactivées dans l’IC, les bandes de fréquence se redistribuent sur les électrodes actives. Veuillez demander à votre audiologiste les fréquences centrales actuelles et les saisir ici – sinon les mesures et l’égaliseur ne seront pas significatifs.",
    resetFreq: "Réinitialiser",
    sweep: "▶ Balayage",
    stop: "■ Stop",
    lblCorr: "Correction",
    lblLevels: "Appliquer les niveaux",
    toneTitle: "Paramètres",
    lblVol: "Volume:",
    lblDur: "Durée:",
    lblPau: "Pause:",
    testTitle: "Paramètres de test",
    lblMode: "Mode:",
    optBal: "Équilibrage (dB)",
    optJdg: "Jugement",
    lblRun: "Type:",
    optFull: "Complet",
    optCF: "Convergence",
    optMan: "Manuel",
    lblRef: "Réf.:",
    lblVol2: "Volume:",
    lblDur2: "Durée:",
    lblPau2: "Pause:",
    preCorrectLabel: "Ajustement fin avec valeurs pré-corrigées",
    runExplFull:
      "Toutes les paires d'électrodes sont comparées en tours. Dans chaque tour, chaque électrode est comparée exactement une fois. A et B attribués aléatoirement. Méthode la plus précise. Recommandé comme premier passage.",
    runExplCF: "Re-test des paires les plus incertaines. Répétable à volonté.",
    runExplMan: "Choisir deux électrodes.",
    recommend:
      "Recommandé: <br> - Réglez le volume à un niveau qui frôle l'inconfort.<br> - Utilisez autant que possible une connexion Bluetooth pour la diffusion.<br> - D'abord «Complet», puis «Convergence». Si les réglages sont fondamentalement corrects, cochez «Ajustement fin» et répétez «Convergence». Dans l'onglet Résultats, évaluez la qualité par les couleurs. Toutes les mesures peuvent être répétées à volonté et améliorent le résultat. Les résultats sont toujours conservés.",
    startTest: "▶ Démarrer",
    stopTest: "■ Arrêter",
    testLockedInfo:
      "Impossible de quitter cet onglet pendant qu'un test est en cours.",
    bBack: "Retour",
    bReplay: "Rejouer",
    kSpace: "Espace",
    kEnter: "Entrée",
    bExcl: "Exclure",
    bLoud: "plus fort",
    bLoud2: "plus fort",
    bEqual: "Égal",
    slHint: "Ajuster B. ◀▶ ±0,5 dB · Shift ±0,1 dB",
    bExtend: "±40 dB",
    bConf: "Confirmer",
    bCanc: "Annuler",
    exclTitle: "Exclure quelle électrode?",
    resTitle: "Résultats",
    noRes: "Pas de mesures.",
    comp: "Comparaison",
    of: "de",
    round: "Tour",
    chartExplB: "Volume perçu relatif. Barres d'erreur = résidu moyen.",
    chartExplJ: "Score = jugements.",
    thOff: "Offset",
    thMes: "Mesures",
    thRes: "Résidu",
    thWgt: "Poids",
    thStR: "Statut",
    thSc: "Score",
    thComp: "Comp.",
    resExplain: "",
    apikal: "apical",
    basal: "basal",
    stNoisyHeavy: "Bruit fort",
    stNoisyMore: "Bruit avec ton",
    stNoisyLess: "Ton avec bruit",
    stAlmMute: "presque muet",
    stMute: "muet",
    stExcl: "exclure",
    total: "Total",
    prev: "précédent",
    excluded: "exclu",
    copyDone: "Copié.",
    fClear: "Supprimer résultats",
    delConfirmMeas: "Supprimer les mesures?",
    delConfirmAll: "Aussi réinitialiser?",
    manComp: "Manuel",
    pairsRem: "restantes",
    exclDuring: "exclu",
    plTitle: "Lecteur audio avec correction",
    plDesc:
      "Ce lecteur simule comment la musique ou la parole pourrait sonner si la courbe de volume IC était corrigée.",
    plNoData: "Pas de données.",
    plFile: "Fichier audio",
    plFileTitle: "Fichier audio",
    plEqOn: "Equalizer ON",
    plEqOff: "Equalizer OFF",
    plEqStr: "Force Equalizer:",
    plEqTitle: "Courbe Equalizer",
    plNotice: "Simulation de correction.",
    plNHLabel: "Simulation audition normale",
    plNHExpl: "Rend la distorsion audible pour les normo-entendants.",
    plBalApply: "Appliquer balance stéréo",
    plBalApplyOn: "✓ Balance stéréo ON",
    plBalApplyOff: "Balance stéréo OFF",
    plMapLabel: "Simulation MAPLAW",
    plMapExpl: "Simulation compression MED-EL.",
    fileTitle: "Charger / Sauver",
    fileDesc: "Paramètres et résultats en JSON.",
    fLoad: "Charger",
    fSave: "Sauver",
    fPrint: "Imprimer",
    fCopy: "Copier",
    fExplain: "Les réglages du lecteur sont inclus dans l'impression.",
    eeDesc: "Export EasyEffects pour PipeWire.",
    eeExport: "Exporter EasyEffects",
    eeHowTo: "Copier dans ~/.config/easyeffects/output/ et activer.",
    eePlayerHint: "L'export utilise les réglages actuels du lecteur.",
    tabLevels: "Levels",
    lvTitle: "Levels manuels",
    lvExpl:
      "Ajuster manuellement le volume de chaque électrode. Clavier: ↑↓ changer, ←→ ±0,5 dB, Shift ±0,1 dB.",
    lvPreset: "Preset:",
    lvPrNone: "Aucun",
    lvPrTilt: "Tilt",
    lvPrPivot: "Pivot",
    lvPrSpeech: "Parole (SII)",
    lvPrScurve: "Courbe S",
    lvPrGauss: "Gauss",
    lvPrBass: "Bass Boost",
    lvPrHigh: "High Boost",
    lvPrCenter: "Centre:",
    lvPrWidth: "Largeur:",
    lvPrCutoff: "Limite:",
    lvPrStr: "Force:",
    lvReset: "Réinitialiser",
    lvPrExplTilt: "Pente linéaire. Correspond à Tilt MAESTRO.",
    lvPrExplPivot: "Centre accentué. Correspond à Pivot MAESTRO.",
    lvPrExplSpeech: "Pondération ANSI S3.5.",
    lvPrExplScurve: "Transition douce au centre.",
    lvPrExplGauss: "Courbe en cloche.",
    lvPrExplBass: "Renforcer les basses.",
    lvPrExplHigh: "Renforcer les aigus.",
    lvPresetTitle: "Presets",
    lvPresetBoth: "Appliquer les changements aux deux côtés",
    lvPresetDesc:
      "Courbes prédéfinies. Tilt/Pivot = outils MAESTRO. Le préréglage Parole pondère les fréquences selon leur importance pour la compréhension de la parole (ANSI S3.5). Clavier: ↑↓ ajuste les valeurs dans le champ de saisie.",
    lvChartTitle: "Aperçu",
    lvChartMan: "Manuel",
    lvChartSum: "Somme",
    plSrcLabel: "Source Equalizer:",
    plSrcMeas: "Mesuré",
    plSrcLevels: "Levels",
    plSrcBoth: "Les deux",
    plBothLabel: "Les deux côtés",
    plMonoEQLabel: "Appliquer l'EQ du côté actif aux deux canaux Gauche+Droite",
    freqAbfHint:
      "<b>Important – Anatomy Based Fitting (ABF) et FAT :</b> Avec l'Anatomy Based Fitting (ABF), d'autres fréquences centrales s'appliquent également aux électrodes. En général : demandez à votre audiologiste la FAT (Frequency Allocation Table) de votre IC pour connaître toutes les fréquences attribuées aux électrodes.",
    recommend:
      "Recommandé : <br> - Réglez le volume à un niveau qui frôle l'inconfort.<br> - Utilisez autant que possible une connexion Bluetooth.<br> - D'abord «Complet», puis «Convergence». Les deux sont répétables à volonté.<br> - «Complet» est divisé en tours. Dans chaque tour, chaque électrode est comparée exactement une fois. Les premières estimations fiables apparaissent après trois ou quatre tours complets ; valeurs sûres seulement après tous les tours.<br> - En cas d'arrêt, le prochain démarrage de «Complet» reprend où vous vous êtes arrêté.<br> - Si les réglages sont fondamentalement corrects, cochez «Ajustement fin» et répétez «Convergence».<br> - Dans l'onglet Résultats, évaluez la qualité par les couleurs.",
    printPlayerTitle: "Réglages lecteur",
    printPreCorrect: "Ajustement fin avec pré-correction: actif",
    reliabilityTitle: "Fiabilité des mesures",
    glossTitle: "Glossaire",
    glossResiduum:
      "<b>Résidu</b>: Indique l'incohérence de vos jugements pour une électrode. Barres courtes = jugements cohérents, barres longues = jugements variables.",
    glossErrBar:
      "<b>Barres d'erreur</b> (traits verticaux sur les barres): Indiquent la taille du résidu.",
    glossAnpassung:
      "<b>Correction</b>: De combien de dB cette électrode est réglée plus fort (+) ou moins fort (−) que la référence.",
    glossFarbe:
      "<b>Couleurs</b>: Vert = fiable, Jaune = limite, Rouge = incertain, Gris = pas encore mesuré. La couleur indique la qualité de mesure, pas l'amplitude de la correction.",
    glossRef:
      "<b>Électrode de référence</b>: Le point fixe de la mesure. Sa correction est toujours 0 dB.",
    glossLS:
      "<b>Least Squares</b>: Méthode mathématique qui calcule simultanément les meilleures valeurs d'offset à partir de toutes les comparaisons de paires. Les erreurs de mesure individuelles ont peu d'influence. Les électrodes marquées comme problématiques dans l'onglet «Implantat» contribuent avec un poids réduit.",
    preCorrHint: "Valeur précédente: {v} dB de l'estimation",
    implTitle: "Données d'implant",
    implIntro:
      "Demandez à votre audiologiste les valeurs de la FAT (Frequency Allocation Table) avec les fréquences centrales (en Hz) pour chaque électrode et saisissez-les ci-dessus. Demandez aussi le MCL (MED-EL), T-Level/C-Level (Cochlear) ou T-Level/M-Level (Advanced Bionics) – ces valeurs se trouvent dans le logiciel de réglage de l'audiologiste et sont nécessaires pour calculer les recommandations d'ajustement dans l'impression. Vous pouvez utiliser l'outil sans ces valeurs, mais les résultats seront plus précis avec elles.",
    implBilateralHint:
      "Pour deux IC, les valeurs pour la gauche et la droite doivent être saisies séparément. Changez de côté avec les boutons ci-dessus.",
    lblImplModel: "Modèle d'implant:",
    lblImplProc: "Processeur audio:",
    lblImplC: "Valeur c (MAPLAW):",
    lblImplIDR: "IDR (dB):",
    lblImplIIDR: "IIDR (dB):",
    lblImplGen: "Génération:",
    implPerElTitle: "Valeurs par électrode (de l'audiologiste)",
    implPerElHint:
      "Saisir THR et MCL (MED-EL), T-Level/C-Level (Cochlear) ou T-Level/M-Level (Advanced Bionics). Ces valeurs sont disponibles dans le logiciel de réglage de votre audiologiste.",
    implThHdr: "THR",
    implMclHdr: "MCL (qu)",
    implTLvlHdr: "T-Level",
    implCLvlHdr: "C-Level (CL)",
    implMLvlHdr: "M-Level (CU)",
    implUnknown: "Inconnu",
    implSelectPleaseHdr: "— veuillez sélectionner —",
    implGenA: "Génération A (0,176 dB/CL)",
    implGenB: "Génération B (0,157 dB/CL)",
    implGenUnknown: "—",
    implPrintHeader: "Implant",
    implPrintProcessor: "Processeur",
    implPrintCVal: "Valeur c",
    implPrintIDR: "IDR",
    implPrintIIDR: "IIDR",
    implPrintGen: "Génération",
    implPrintColDelta: "Δ dB (outil)",
    implPrintColCurrent: "Actuel",
    implPrintColDeltaUnit: "Δ (unité)",
    implPrintColNew: "Nouvelle valeur",
    implPrintColStatus: "Statut",
    implPrintNA: "N/A",
    implPrintNotesTitle: "Notes pour l'audiologiste",
    implPrintNote1:
      "Les valeurs de correction sont des approximations issues de mesures acoustiques de sonie par comparaison par paires. Elles ne remplacent pas un réglage direct basé sur la stimulation.",
    implPrintNote2:
      "Procédure recommandée : utiliser les valeurs comme point de départ · vérifier avec la fonction de balance contre les électrodes voisines · le patient confirme l'égalité subjective · en cas de divergence, ne pas suivre les valeurs de l'outil.",
    implPrintNote2b:
      "Signe : les valeurs Δ positives signifient que le MCL/C/M-level doit être augmenté (l'électrode a été mesurée comme trop silencieuse). Valeurs négatives = diminuer.",
    implPrintNote3Missing:
      "Les valeurs suivantes sont manquantes et n'ont pas pu être calculées : {list}. Veuillez communiquer ces valeurs au client afin que l'outil puisse fournir des recommandations complètes.",
    implPrintNote4IDR:
      "L'IDR n'a pas été indiqué. Le calcul a utilisé la valeur par défaut de 60 dB. Si votre IDR configuré diffère, les valeurs Δ doivent être ajustées en conséquence.",
    implPrintNote5Large:
      "Pour les corrections supérieures à ±5 dB par électrode : vérifier les limites de conformité · la fonction de croissance de sonie peut changer · vérification par stimulation obligatoire.",
    implPrintModelMissing:
      "Veuillez sélectionner le modèle d'implant – génération inconnue, calcul impossible.",
  },
  es: {
    subtitle: "CI Sound Balancing Tool · v2.7",
    sideLeft: "IZQUIERDA",
    sideRight: "DERECHA",
    tabIntro: "Introducción",
    tabFreq: "Implante",
    tabTest: "Medición",
    tabResults: "Resultados",
    tabFile: "Cargar/Guardar",
    introTitle: "CI Sound Balancing Tool",
    introDesc:
      "Esta herramienta ayuda a los usuarios de IC a comparar sistemáticamente el volumen percibido de sus electrodos y crear una curva de corrección individual. El objetivo es ajustar exactamente el mismo volumen en todos los electrodos – la base fundamental para una buena audición con IC. Este ajuste es óptimo para música y sonidos naturales. Los ajustes para la comprensión del habla o efectos como el realce de graves también son posibles.",
    introWhat: "¿Cuál es el procedimiento?",
    introWhatDesc: "",
    introFlow: "",
    introFlowDesc:
      "<b>1. Lado</b> – Seleccione, en la esquina superior derecha, el lado en el que lleva su IC. Si utiliza dos IC, realice la medición (Paso 3) para ambos.<br><b>2. Implante</b> – Seleccione su fabricante. Si conoce los datos específicos, ajuste los valores de frecuencia listados para cada electrodo; los valores estándar vienen preconfigurados por defecto.<br><b>Importante:</b> Los electrodos desactivados deben marcarse en «Estado».<br><b>3. Medición</b> – Inicie una secuencia de prueba. La herramienta reproduce pares de tonos; ajuste la configuración hasta que ambos tonos suenen con la misma intensidad. Recomendación: Ajuste el volumen a un nivel que roce lo incómodo.<br><b>4. Reproductor</b> – Cargue un archivo de música y escuche la diferencia con y sin la corrección aplicada.<br><b>5. Niveles</b> – Opcional: Aplique ajustes globales (p. ej., énfasis en el habla, refuerzo de graves) y escuche la diferencia en directo en el reproductor de forma simultánea.",
    introWarn:
      "Si es posible, utilice un programa de su implante coclear sin filtro de voz que, por lo demás, corresponda a su programa principal. Los filtros de voz tienden a distorsionar los sonidos. Conecte su implante coclear mediante Bluetooth para obtener el sonido más nítido posible.",
    introAudio: "Para su audiólogo",
    tabPlayer: "Player",
    tabBalance: "Balance Estéreo",
    introAudioDesc:
      'Los resultados se pueden imprimir. El documento contiene los resultados de medición, sus correcciones deseadas y los valores de ecualizador resultantes. Esto permite al audiólogo ver exactamente dónde son necesarios los ajustes.<br>Página web del proyecto: <a href="https://github.com/mviereck/ci-loudness-balancing" target="_blank" style="color:var(--accent)">https://github.com/mviereck/ci-loudness-balancing</a>',
    freqTitle: "Fabricante, frecuencias y estado",
    lblMfr: "Fabricante:",
    freqHint:
      "Seleccione el fabricante de su IC. Marque los electrodos problemáticos en «Estado». Estado «Desactivado» = electrodo apagado en el propio IC, será excluido automáticamente. ▶ = tono, ◼ = tono continuo.",
    freqDeactHint:
      "<b>Importante – electrodos desactivados:</b> Cuando los electrodos de su IC están desactivados, el implante redistribuye el rango de frecuencias entre los electrodos activos restantes. Las frecuencias centrales de todos los demás electrodos se desplazan en consecuencia – los valores estándar preconfigurados ya no son válidos.<br>Marque los electrodos desactivados en «Estado» e introduzca las frecuencias centrales actuales de su ajuste. Sin frecuencias correctas, las mediciones y el ecualizador del reproductor no serán significativos.",
    thEl: "El.",
    thHzStd: "Hz estándar",
    thHzOwn: "Hz propios",
    thPlay: "▶",
    thHold: "◼",
    thSt: "Estado",
    thNote: "Nota",
    thExclCb: "Excluir",
    stDeactivated: "Desactivado en IC",
    warnDeactivated:
      "Atención: la tabla de frecuencias probablemente no está actualizada. Ha marcado electrodo(s) como desactivados, pero los valores de frecuencia corresponden aún a los valores estándar. Cuando los electrodos están desactivados en el IC, las bandas de frecuencia se redistribuyen entre los electrodos activos. Por favor, pregunte a su audiólogo las frecuencias centrales actuales e intródzcalas aquí, de lo contrario las mediciones y el ecualizador no serán significativos.",
    resetFreq: "Restablecer",
    sweep: "▶ Barrido",
    stop: "■ Parar",
    lblCorr: "Corrección",
    lblLevels: "Aplicar Levels",
    toneTitle: "Parámetros",
    lblVol: "Volumen:",
    lblDur: "Duración:",
    lblPau: "Pausa:",
    testTitle: "Configuración",
    lblMode: "Modo:",
    optBal: "Equilibrio (dB)",
    optJdg: "Juicio",
    lblRun: "Tipo:",
    optFull: "Completo",
    optCF: "Convergencia",
    optMan: "Manual",
    lblRef: "Ref.:",
    lblVol2: "Volumen:",
    lblDur2: "Duración:",
    lblPau2: "Pausa:",
    preCorrectLabel: "Ajuste fino con valores precorregidos",
    runExplFull:
      "Todos los pares de electrodos se comparan en rondas. En cada ronda, cada electrodo se compara exactamente una vez. A y B se asignan aleatoriamente por par. Método más preciso, lleva más tiempo. Recomendado como primera pasada.",
    runExplCF: "Re-test de los pares más inciertos. Repetible a voluntad.",
    runExplMan: "Elegir dos electrodos.",
    recommend:
      "Recomendado: <br> - Ajuste el volumen a un nivel que raye en lo incómodo.<br> - Utilice una conexión Bluetooth para la transmisión si es posible.<br> - Primero «Completo», luego «Convergencia». Si la configuración es fundamentalmente sólida, marque «Ajuste fino» y repita «Convergencia». En la pestaña Resultados, evalúe la calidad por los colores. Todas las mediciones pueden repetirse tantas veces como se desee y mejoran el resultado. Los resultados siempre se conservan.",
    startTest: "▶ Iniciar",
    stopTest: "■ Finalizar",
    testLockedInfo:
      "No puede abandonar esta pestaña mientras se ejecuta una prueba.",
    bBack: "Atrás",
    bReplay: "Repetir",
    kSpace: "Espacio",
    kEnter: "Intro",
    bExcl: "Excluir",
    bLoud: "más alto",
    bLoud2: "más alto",
    bEqual: "Igual",
    slHint: "Ajustar B. ◀▶ ±0,5 dB · Shift ±0,1 dB",
    bExtend: "±40 dB",
    bConf: "Confirmar",
    bCanc: "Cancelar",
    exclTitle: "¿Excluir cuál?",
    resTitle: "Resultados",
    noRes: "Sin mediciones.",
    comp: "Comparación",
    of: "de",
    round: "Ronda",
    chartExplB: "Volumen percibido relativo.",
    chartExplJ: "Puntuación = juicios.",
    thOff: "Offset",
    thMes: "Mediciones",
    thRes: "Residuo",
    thWgt: "Peso",
    thStR: "Estado",
    thSc: "Punt.",
    thComp: "Comp.",
    resExplain: "",
    apikal: "apical",
    basal: "basal",
    stNoisyHeavy: "Ruido fuerte",
    stNoisyMore: "Ruido con tono",
    stNoisyLess: "Tono con ruido",
    stAlmMute: "casi mudo",
    stMute: "mudo",
    stExcl: "excluir",
    total: "Total",
    prev: "anterior",
    excluded: "excluido",
    copyDone: "Copiado.",
    fClear: "Eliminar resultados",
    delConfirmMeas: "¿Eliminar mediciones?",
    delConfirmAll: "¿También restablecer?",
    manComp: "Manual",
    pairsRem: "restantes",
    exclDuring: "excluido",
    plTitle: "Reproductor con corrección",
    plDesc:
      "Este reproductor simula cómo podría sonar la música o el habla si se corrigiera la curva de volumen del IC.",
    plNoData: "Sin datos.",
    plFile: "Archivo de audio",
    plFileTitle: "Archivo de audio",
    plEqOn: "Equalizer ON",
    plEqOff: "Equalizer OFF",
    plEqStr: "Fuerza Equalizer:",
    plEqTitle: "Curva Equalizer",
    plNotice: "Simulación de corrección.",
    plNHLabel: "Simulación audición normal",
    plNHExpl: "Hace audible la distorsión.",
    plBalApply: "Aplicar balance estéreo",
    plBalApplyOn: "✓ Balance estéreo ON",
    plBalApplyOff: "Balance estéreo OFF",
    plMapLabel: "Simulación MAPLAW",
    plMapExpl: "Simulación compresión MED-EL.",
    fileTitle: "Cargar / Guardar",
    fileDesc: "Configuración y resultados en JSON.",
    fLoad: "Cargar",
    fSave: "Guardar",
    fPrint: "Imprimir",
    fCopy: "Copiar",
    fExplain: "La configuración del reproductor se incluye en la impresión.",
    eeDesc: "Export EasyEffects para PipeWire.",
    eeExport: "Exportar EasyEffects",
    eeHowTo: "Copiar a ~/.config/easyeffects/output/ y activar.",
    eePlayerHint: "El export usa la configuración actual.",
    tabLevels: "Levels",
    lvTitle: "Levels manuales",
    lvExpl:
      "Ajustar manualmente el volumen de cada electrodo. Teclado: ↑↓ cambiar, ←→ ±0,5 dB, Shift ±0,1 dB.",
    lvPreset: "Preset:",
    lvPrNone: "Ninguno",
    lvPrTilt: "Tilt",
    lvPrPivot: "Pivot",
    lvPrSpeech: "Habla (SII)",
    lvPrScurve: "Curva S",
    lvPrGauss: "Gauss",
    lvPrBass: "Bass Boost",
    lvPrHigh: "High Boost",
    lvPrCenter: "Centro:",
    lvPrWidth: "Ancho:",
    lvPrCutoff: "Límite:",
    lvPrStr: "Fuerza:",
    lvReset: "Restablecer",
    lvPrExplTilt: "Pendiente lineal. Corresponde a Tilt MAESTRO.",
    lvPrExplPivot: "Centro enfatizado. Corresponde a Pivot MAESTRO.",
    lvPrExplSpeech: "Ponderación ANSI S3.5.",
    lvPrExplScurve: "Transición suave en el centro.",
    lvPrExplGauss: "Curva gaussiana.",
    lvPrExplBass: "Reforzar graves.",
    lvPrExplHigh: "Reforzar agudos.",
    lvPresetTitle: "Presets",
    lvPresetBoth: "Aplicar cambios a ambos lados",
    lvPresetDesc:
      "Curvas predefinidas. Tilt/Pivot = herramientas MAESTRO. El preset Habla pondera las frecuencias según su importancia para la inteligibilidad del habla (ANSI S3.5). Teclado: ↑↓ ajusta valores en el campo de entrada.",
    lvChartTitle: "Resumen",
    lvChartMan: "Manual",
    lvChartSum: "Suma",
    plSrcLabel: "Fuente Equalizer:",
    plSrcMeas: "Medido",
    plSrcLevels: "Levels",
    plSrcBoth: "Ambos",
    plBothLabel: "Ambos lados",
    plMonoEQLabel: "Aplicar EQ del lado activo a ambos canales Izq+Der",
    freqAbfHint:
      "<b>Importante – Anatomy Based Fitting (ABF) y FAT:</b> Con el Anatomy Based Fitting (ABF) también se aplican otras frecuencias centrales a los electrodos. En general: pregunte a su audiólogo la FAT (Frequency Allocation Table) de su IC para conocer todas las frecuencias asignadas a los electrodos.",
    recommend:
      "Recomendado: <br> - Ajuste el volumen a un nivel que raye en lo incómodo.<br> - Utilice una conexión Bluetooth si es posible.<br> - Primero «Completo», luego «Convergencia». Ambos son repetibles a voluntad.<br> - «Completo» se divide en rondas. En cada ronda, cada electrodo se compara exactamente una vez. Las primeras estimaciones fiables aparecen tras unas tres o cuatro rondas completas; valores seguros sólo tras completar todas las rondas.<br> - Si se interrumpe, el siguiente inicio de «Completo» retoma donde se dejó.<br> - Si la configuración es fundamentalmente sólida, marque «Ajuste fino» y repita «Convergencia».<br> - En la pestaña Resultados, evalúe la calidad por los colores.",
    printPlayerTitle: "Config. reproductor",
    printPreCorrect: "Ajuste fino con precorrección: activo",
    reliabilityTitle: "Fiabilidad de las mediciones",
    glossTitle: "Glosario",
    glossResiduum:
      "<b>Residuo</b>: Indica la inconsistencia de sus juicios para un electrodo. Barras cortas = juicios coherentes, barras largas = juicios variables.",
    glossErrBar:
      "<b>Barras de error</b> (líneas verticales en las barras): Muestran el tamaño del residuo.",
    glossAnpassung:
      "<b>Ajuste</b>: Cuántos dB más fuerte (+) o más suave (−) se configura este electrodo respecto a la referencia.",
    glossFarbe:
      "<b>Colores semáforo</b>: Verde = fiable, Amarillo = límite, Rojo = incierto, Gris = sin medición. El color indica la calidad de medición, no la magnitud del ajuste.",
    glossRef:
      "<b>Electrodo de referencia</b>: El punto fijo de la medición. Su ajuste es siempre 0 dB.",
    glossLS:
      "<b>Least Squares</b>: Método matemático que calcula simultáneamente los mejores valores de offset a partir de todas las comparaciones de pares. Los errores de medición individuales tienen poca influencia. Los electrodos marcados como problemáticos en la pestaña «Implante» contribuyen con peso reducido.",
    preCorrHint: "Valor anterior: {v} dB de la estimación",
    implTitle: "Datos del implante",
    implIntro:
      "Solicite a su audiólogo los valores de la FAT (Frequency Allocation Table) con las frecuencias centrales (en Hz) de cada electrodo e introdúzcalos arriba. Solicite también MCL (MED-EL), T-Level/C-Level (Cochlear) o T-Level/M-Level (Advanced Bionics) – estos valores se encuentran en el software de ajuste del audiólogo y son necesarios para calcular las recomendaciones de ajuste en la impresión. Puede usar la herramienta sin estos valores, pero los resultados serán más precisos con ellos.",
    implBilateralHint:
      "Para dos IC, los valores para izquierda y derecha deben introducirse por separado. Cambie de lado con los botones de arriba.",
    lblImplModel: "Modelo de implante:",
    lblImplProc: "Procesador de audio:",
    lblImplC: "Valor c (MAPLAW):",
    lblImplIDR: "IDR (dB):",
    lblImplIIDR: "IIDR (dB):",
    lblImplGen: "Generación:",
    implPerElTitle: "Valores por electrodo (del audiólogo)",
    implPerElHint:
      "Introduzca THR y MCL (MED-EL), T-Level/C-Level (Cochlear) o T-Level/M-Level (Advanced Bionics). Estos valores están disponibles en el software de ajuste de su audiólogo.",
    implThHdr: "THR",
    implMclHdr: "MCL (qu)",
    implTLvlHdr: "T-Level",
    implCLvlHdr: "C-Level (CL)",
    implMLvlHdr: "M-Level (CU)",
    implUnknown: "Desconocido",
    implSelectPleaseHdr: "— por favor seleccione —",
    implGenA: "Generación A (0,176 dB/CL)",
    implGenB: "Generación B (0,157 dB/CL)",
    implGenUnknown: "—",
    implPrintHeader: "Implante",
    implPrintProcessor: "Procesador",
    implPrintCVal: "Valor c",
    implPrintIDR: "IDR",
    implPrintIIDR: "IIDR",
    implPrintGen: "Generación",
    implPrintColDelta: "Δ dB (herramienta)",
    implPrintColCurrent: "Actual",
    implPrintColDeltaUnit: "Δ (unidad)",
    implPrintColNew: "Nuevo valor",
    implPrintColStatus: "Estado",
    implPrintNA: "N/A",
    implPrintNotesTitle: "Notas para el audiólogo",
    implPrintNote1:
      "Los valores de corrección mostrados son aproximaciones derivadas de mediciones acústicas de sonoridad mediante comparación por pares. No sustituyen un ajuste directo basado en estimulación.",
    implPrintNote2:
      "Procedimiento recomendado: usar valores como punto de partida · verificar con función de balance frente a electrodos vecinos · el paciente confirma la igualdad subjetiva · ante discrepancias, no seguir los valores de la herramienta.",
    implPrintNote2b:
      "Signo: los valores Δ positivos indican que el MCL/C/M-level debe aumentarse (el electrodo se midió como demasiado silencioso). Valores negativos = reducir.",
    implPrintNote3Missing:
      "Los siguientes valores faltan y no pudieron calcularse: {list}. Por favor, comunique estos valores al cliente para que la herramienta pueda proporcionar recomendaciones completas en el futuro.",
    implPrintNote4IDR:
      "No se especificó IDR. El cálculo usó el valor predeterminado de 60 dB. Si su IDR configurado difiere, los valores Δ deben escalarse en consecuencia.",
    implPrintNote5Large:
      "Para correcciones superiores a ±5 dB por electrodo: verificar límites de cumplimiento · la función de crecimiento de sonoridad puede cambiar · verificación basada en estimulación obligatoria.",
    implPrintModelMissing:
      "Seleccione el modelo de implante – generación desconocida, cálculo no posible.",
  },
};
let lang = "de";

function t(k) {
  return (L[lang] && L[lang][k]) || L.de[k] || k;
}
function updateMfrSelectLabels() {
  const labels = {
    de: "Elektroden",
    en: "electrodes",
    fr: "électrodes",
    es: "electrodos",
  };
  const lbl = labels[lang] || "electrodes";
  const opts = document.getElementById("mfrSelect").options;
  if (opts[0]) opts[0].text = "MED-EL (12 " + lbl + ")";
  if (opts[1]) opts[1].text = "Advanced Bionics (16 " + lbl + ")";
  if (opts[2]) opts[2].text = "Cochlear (22 " + lbl + ")";
}
function applyLang() {
  lang = document.getElementById("langSelect").value;
  document.querySelectorAll("[data-t]").forEach((el) => {
    const v = t(el.dataset.t);
    if (v.includes("<")) el.innerHTML = v;
    else el.textContent = v;
  });
  const s = (id, k) => {
    const e = document.getElementById(id);
    if (e) e.textContent = t(k);
  };
  updateMfrSelectLabels();
  s("subtitleText", "subtitle");
  s("tabIntro", "tabIntro");
  s("tabSetup", "tabFreq");
  s("tabTest", "tabTest");
  s("tabResults", "tabResults");
  s("tabLevels", "tabLevels");
  s("tabPlayer", "tabPlayer");
  s("tabBalance", "tabBalance");
  s("tabFile", "tabFile");
  const gEl2 = (id) => document.getElementById(id);
  if (gEl2("glossLSEl")) gEl2("glossLSEl").innerHTML = t("glossLS");
  s("freqTitle", "freqTitle");
  s("lblMfr", "lblMfr");
  s("freqHint", "freqHint");
  const abfEl = document.getElementById("freqAbfHintEl");
  if (abfEl) abfEl.innerHTML = t("freqAbfHint");
  s("sweepBtn", "sweep");
  s("stopBtn", "stop");
  s("lblCorr", "lblCorr");
  s("toneTitle", "toneTitle");
  s("lblVol", "lblVol");
  s("lblDur", "lblDur");
  s("lblPau", "lblPau");
  s("testTitle", "testTitle");
  s("lblMode", "lblMode");
  s("optBal", "optBal");
  s("optJdg", "optJdg");
  s("lblRun", "lblRun");
  s("optFull", "optFull");
  s("optCF", "optCF");
  s("optMan", "optMan");
  s("lblRef", "lblRef");
  s("lblVol2", "lblVol2");
  s("lblDur2", "lblDur2");
  s("lblPau2", "lblPau2");
  s("balLabel", "balLabel");
  s("startBtn", "startTest");
  s("stopTBtn", "stopTest");
  s("resTitle", "resTitle");
  updEqToggleBtn();
  updBalApplyBtn();
  updSideButtons();
  updateRunExplain();
  buildFreqTable();
  if (typeof buildImplantCard === "function") buildImplantCard();
  if (document.getElementById("resC").style.display !== "none") renderResults();
  try {
    localStorage.setItem("ci-lb-lang", lang);
  } catch (e) {}
}
function updateRunExplain() {
  document.getElementById("runExplain").innerHTML = t("recommend")
    .split("\n")
    .map((l) => (l.startsWith("*") ? "<li>" + l.slice(1).trim() + "</li>" : l))
    .join("<br>");
}
