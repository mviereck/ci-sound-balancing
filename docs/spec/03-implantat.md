## Implantat-Tab

Karten-Titel: **„Implantat & Elektroden"** (BA 165, vorher „Hersteller,
Elektrodenfrequenzen & Status").

**Bilateral-Hinweis** (`implBilateralHintEl`): Steht direkt unter dem
Titel. Sichtbar solange ≥1 Seite Hörsituation = „Keine Angabe";
verschwindet, sobald beide Seiten eine explizite Hörsituation haben
(BA 165, vorher immer sichtbar).

**Tabellen-Intro** (`implTableIntroEl`): Zweiteiliger Einleitungstext
(„Was Sie eintragen sollten" / „Optional, verbessert den Ausdruck")
direkt über den Tabellen-Hinweisen. Sichtbar nur wenn Hörsituation = CI
**und** Hersteller bekannt (BA 165).

**Tabellen-Hinweise** (`freqDeactHintEl`, `freqAbfHintEl`): Stehen direkt
über der Tabelle. Sichtbar nur wenn die CI-Tabelle gerendert wird **und**
noch nicht alle aktiven Elektroden eigene Hz-Werte haben. Werden sofort
ausgeblendet, sobald jede aktive Elektrode (`elActive[i] !== false`) einen
`elFreqOwn[i]`-Wert hat; kehren zurück, wenn ein Wert gelöscht wird (BA 165).
Für akustische Branch und bei Early-Return immer ausgeblendet.

**Tonauswahl-Knopf** (`implTonePopupRow`): Container mit einem Button
„Elektroden über Töne anspielen — ‹Tonart›" direkt unter der Tabelle.
Ausgeblendet (`display:none`) solange keine Tabelle gerendert wird
(Early-Return-Bedingungen: unbekannte Hörsituation/Hersteller, beide Seiten
akustisch). Wird eingeblendet sobald die Tabelle erscheint (BA 242, ersetzt
die frühere Sweep/Stop-Zeile). Klick öffnet die Tonauswahl-Modal
(`openImplantTonePopup` in `ui-implant.js`) mit Klavier-Widget, Sweep,
Korrektur-Toggles und Vol/Dur/Pau-Feldern. State: `toneType_implant` (Default
`"sine"`), `volume_implant` (75), `duration_implant` (1000 ms),
`pause_implant` (500 ms) in `state-side.js`, persistiert in `file.js`.

**Ausschließen-Hinweis** (`freqExclHintEl`): Dritter Hinweis-Kasten direkt
vor der Tabelle. Sichtbar sobald CI-Tabelle gerendert wird (CI + Hersteller
bekannt), bleibt sichtbar unabhängig vom Hz-Vollständigkeits-Status. Erklärt
die Ausschließen-Spalte und automatischen Ausschluß deaktivierter Elektroden
(v3.1.166-beta). Für akustische Branch und bei Early-Return ausgeblendet.

- **Konfigurations-Dropdown** (Hörsituation): unknown (Default „Keine
  Angabe"), ci, hg, normal, schwerhörig, taub. Bestimmt, welche
  Eingabebereiche sichtbar sind. **Label** zeigt „Hörsituation LINKS:"
  bzw. „Hörsituation RECHTS:" je nach aktiver Seite (BA 165).
  **Cascade (BA 154):** Bei „Keine Angabe" wird der gesamte Implantat-
  Block ausgeblendet; stattdessen Hinweistext „Bitte zuerst Hörtechnik
  wählen…". Bei CI + Hersteller = „Keine Angabe" sind Modell, Prozessor
  und Parameter ausgeblendet; Hinweistext „Bitte Hersteller wählen,
  damit Frequenzraster und Pro-Elektroden-Felder erscheinen." (BA 165).
  **Sperre (BA 151):** Das Dropdown wird per `dependency-lock.js`
  gesperrt, sobald Lautstärke-Test-Ergebnisse (`bRes`) der
  aktiven Seite oder FreqMatch-Daten vorliegen (`fRes` nicht leer,
  `_fmHasAdaptiveData()` — also auch Laufdaten ohne konvergierten
  Match — oder `sliderEstimates` nicht leer). Klick öffnet Popup
  mit Feldname „Hörtechnik".
- **Hersteller-Auswahl**: Keine Angabe (Default), MED-EL / Advanced
  Bionics / Cochlear.
  Bestimmt Elektrodenzahl (12/16/22) und Einheit für Upper-Level
  (MCL/qu / M-Level/CU / C-Level/CL).
  **Sperre (BA 149):** Das Dropdown wird per `dependency-lock.js`
  gesperrt (`.dep-locked`, grauer Hintergrund, „not-allowed"-Cursor),
  sobald Meßergebnisse vorliegen, die durch einen Hersteller-Wechsel
  ungültig würden: Lautstärke-Test-Ergebnisse (`bRes`) der aktiven
  Seite, Lautstärke-Test-Ergebnisse der anderen Seite (wenn akustisch),
  Frequenzabgleich-Daten (`fRes` nicht leer, `_fmHasAdaptiveData()` —
  also auch Laufdaten ohne konvergierten Match — oder `sliderEstimates`
  nicht leer). Manuell gesetzte
  Schieber-Korrekturen (`manualLevels`) sperren nicht — sie sind
  Einstellungen, keine Meßergebnisse, und werden beim Wechsel ohnehin
  auf Null gesetzt.
  Klick auf das gesperrte Feld öffnet ein kontextuelles Popup mit
  Auflistung der blockierenden Daten und Hinweis zum Löschen/Reset.
  Ersetzt den früheren `confirm()`-Dialog.
- **Audio-Prozessor-Modell**: Dropdown, herstellerspezifisch.
- **Implantat-Modell + Generation**: Dropdown. Bei Cochlear bestimmt
  das Modell automatisch die Generation A (alte Stromformel,
  0.176 dB/CL) oder B (Freedom+, 0.157 dB/CL).
- **Globale Implantat-Parameter**: c-Wert (MED-EL, für MAPLAW-Simulation
  im Player) und IDR (AB, Default 60 dB; geht direkt in die CU-Berechnung
  im Druck ein). Für Cochlear gibt es kein zusätzliches globales Feld —
  die dB→CL-Umrechnung benötigt nur die Generation (A/B) und den
  C-Level pro Elektrode.
- **Frequenz- und Elektrodentabelle** (`freq-table.js`), pro Elektrode:
  - Beschriftung mit Elektrodennummer und (bei i=0/i=n−1) apikal/basal
  - Hz Standard (Herstellervorgabe, nicht editierbar)
  - Hz eigen (optionaler abweichender Wert).
    **Tab-Navigation (v3.1.170-beta):** Tab in den Eingabespalten Hz-eigen
    (`.fo`), THR (`.it`) und Upper Level (`.iu`) springt senkrecht zur
    nächsten Zeile derselben Spalte. Am Ende jeder Spalte weiter zur ersten
    Zelle der nächsten Spalte (`.fo`→`.it`→`.iu`); am Ende von `.iu`
    Browser-Standard. Shift+Tab geht zur Zeile darüber; an der ersten Zeile
    einer Spalte zurück zur letzten Zeile der vorherigen Spalte (`.fo` oben:
    Browser-Standard). Implementiert als `keydown`-Listener-Gruppe in
    `buildFreqTable()`.
    **Sperre (BA 151):** Alle Hz-eigen-Felder werden per `dependency-lock.js`
    gesperrt (`.fo`-Klasse, Multi-Selektor), sobald Lautstärke-Test-
    Ergebnisse der aktiven Seite oder FreqMatch-Daten vorliegen
    (gleiche Bedingung wie Hörtechnik-Sperre). Bilateral wirksam.
    Klick öffnet Popup mit Feldname „Hz-eigen".
  - **THR** (Hörschwelle) in Hersteller-Einheit (qu/CL/CU)
  - **Upper Level**: MCL bei MED-EL (qu), C-Level bei Cochlear (CL),
    M-Level bei AB (CU)
  - **Aktiv-Checkbox (BA 164):** neue Spalte vor Status. Gehakt = Elektrode
    aktiv im CI. Abgehakt = inaktiv (Zeile halbtransparent). Quelle:
    `elActive[i]` (`sideData[side].elActive[]`, Bool-Array, Default `true`).
    Bei vorhandenen Meßdaten gesperrt (`.dep-locked` via `DEP_LOCK_RULES`,
    Feldname `depFieldActive`): Opacity 0.45, Cursor `not-allowed`, kein
    `disabled`-Attribut — Klick öffnet Sperr-Popup. Aktiv und Ausschluss
    sind **vollständig unabhängig** — kein automatisches Setzen/Löschen
    zwischen den beiden Konzepten.
  - Status-Dropdown: ok, leicht/mittel/stark verrauscht, fast stumm,
    stumm (6 Optionen — **kein „im CI deaktiviert"** mehr seit BA 164).
    **Mute-Sperre (BA 205):** Wechsel auf „stumm" ist gesperrt, wenn
    adaptive FreqMatch-Trials vorliegen (`_fmHasAdaptiveData() === true`,
    Feldname `depFieldMute`); andere Werte bleiben wählbar. Dropdown-Wert
    springt zurück, Transient-Popup mit Begründung
    `depReasonFreqMatchAdaptive`.
  - Ausschluss-Checkbox: „stumm" → automatisch gesetzt (BA 153), manuell
    wieder abhakbar. Andere Status: frei bedienbar.
    **Sperre (BA 205):** Bei adaptiven FreqMatch-Trials per
    `dependency-lock.js` gesperrt (`.ec`-Klasse, Feldname `depFieldExclude`,
    Sperrgrund `depReasonFreqMatchAdaptive`). Eng nur auf adaptive Daten —
    Loudness- und Slider-Daten lösen die Sperre **nicht** aus (bewußte
    Asymmetrie zur Aktiv-Checkbox-Regel).
  - Notiz-Feld
- **Beide Seiten akustisch (BA 155, Text BA 165):** Sind beide Seiten auf
  hg/normal/shoh eingestellt, wird die Frequenztabelle vollständig geleert
  (`buildFreqTable` kehrt früh zurück). An ihrer Stelle erscheint die
  Hinweis-Box `cfgHintBothAcousticEl` (Stil `explain-warn`) mit dem Hinweis,
  daß das Tool mindestens eine CI-Seite erwartet. Die CI-abhängigen Tests
  (Lautstärke, Stereo-Balance, Frequenzabgleich) sind gesperrt.
  Das Default-Frequenzraster-Dropdown (`defaultMfrGroup`) wurde in BA 165
  vollständig entfernt.
- **Akustische Tabellen-Variante (BA 153):** Bei Hörtechnik hg/normal/shoh
  werden nur **6 Spalten** gezeigt: Position, Hz (CI), Status, Ausschluß,
  Notiz. Spalten Hz-eigen, THR, Upper Level, Play, Hold entfallen (BA 243).
  Status-Dropdown zeigt akustische Wortwahl (ok / leicht beeinträchtigt /
  mittel beeinträchtigt / stark beeinträchtigt / fast stumm / stumm),
  kein „im CI deaktiviert". Hz-Werte sind read-only und zeigen die
  **effektive** Frequenz der CI-Gegenseite (inkl. Nutzereingaben, via
  `withSide(ciSide, () => effFreq(i))`); Spaltenüberschrift „Hz (CI)".
  Die Ausschluß-Checkbox der akustischen Seite ist frei bedienbar und
  spiegelt **nicht** mehr den Ausschluß-Status der CI-Gegenseite (früher
  bis BA 279 automatisch ausgegraut/gesperrt — entfernt). Nur eigene,
  auf dieser Seite gesetzte Ausschlüsse grauen die Zeile aus.
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
Frequenztabelle (Hook am Ende von `buildFreqTable`) sowie direkt
aus den `change`-Handlern der THR- und Upper-Level-Felder in
`freq-table.js` (damit Warnungen ohne vollständigen Re-Render
sofort erscheinen, BA 139-bugfix). Vier
Auffälligkeits-Stufen:

- **Rot** (Level 1): logisch falsch, eindeutig fehlerhaft.
- **Orange** (Level 2): Tippfehler-Verdacht
  (Größenordnungs-Abweichung).
- **Gelb** (Level 3): Auffälligkeit, kann real sein.
- **Blau** (Level 4, Info): Hinweis auf leere oder unvollständige
  Felder; kein Fehler, nur Information. Markiert keine Felder
  mit Outline — erscheint nur als Listeneintrag.

Warnungen werden in der Box „Plausibilitätsprüfung" unter dem
Sweep/Stop-Block aufgelistet (einklappbar, per Default offen,
scrollbar bei vielen Einträgen). Zusätzlich bekommt das betroffene
Eingabefeld einen farbigen Rahmen in der Stufe der strengsten
aktiven Warnung; Tooltip am Feld zeigt den Begründungstext. Reine
Warnungen, keine harten Sperren.

Ein Warning-Objekt darf in `field` einen String oder ein
String-Array enthalten — letzteres markiert mehrere Felder
derselben Elektrode gleichzeitig (verwendet beim THR/Upper-
Konflikt, BA 138). Alternativ kann `globalEl` (`'c'`, `'idr'`
oder `'iidr'`) gesetzt sein — markiert eines der globalen
Parameter-Felder `#implC`, `#implIDR` oder `#implIIDR` (BA 143).

Persistenz: keine — bei jedem Re-Render wird neu geprüft. Eine
einmal gesehene Warnung erscheint in der nächsten Session wieder,
wenn die Eingabe unverändert ist.

BA 133: Grundgerüst und erste Prüfung (Hz-Monotonie zwischen
benachbarten Elektroden).

### Hz-Prüfungen (Stand BA 137)

Geprüft werden nur User-Override-Werte (`elFreqOwn[i] != null`),
nicht die Default-Werte aus `MFR[mfr].freqs`. Inaktive Elektroden
(`elActive[i] === false`, BA 164) sind ausgenommen.

- **Monotonie** (BA 133, Level 1 rot): die Hz-Reihe sollte
  aufsteigend mit dem Elektroden-Index sein. Verletzung wird an
  der zweiten beteiligten Elektrode markiert.
- **Range** (BA 134, Level 1 rot): Hz innerhalb der hersteller-
  spezifischen Software-Grenzen. MED-EL 70–8500 Hz, Cochlear
  63–18938 Hz, AB 250–8700 Hz.
- **Größenordnung** (BA 134, Level 2 orange): Hz-eigen weicht um
  Faktor ≥5 oder ≤1/5 vom Default an derselben Elektrode ab —
  typischer Tippfehler (Komma vergessen, Null zuviel).
- **Cochlear-FAT-Lookup** (BA 135, Level 2/3): nur aktiv bei
  Hersteller Cochlear und n_aktiv = 22 (alle Kanäle aktiv).
  Vergleich der User-Override-Werte mit der Standard-FAT
  (LFE 188 Hz, HFE 7938 Hz, Datendatei
  `js/data/cochlear-fats.js`, Quelle CI Select Manual S. 12/13).
  Abweichung ≥ 300 Cent → Level 3 gelb, ≥ 600 Cent → Level 2
  orange. Alternative LFE/HFE-Kombinationen und reduzierte
  Elektrodenzahlen werden in einer späteren Anleitung abgedeckt.
- **Trend-Abweichung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB und mindestens 3 User-Override-Werten in
  der Hz-eigen-Spalte. Für jeden Override wird der Cent-Versatz
  vom Default berechnet; der Trend an dieser Elektrode ist der
  Median der Versatzwerte der Nachbarn (Fenster ±2, ohne i
  selbst, via `_implLocalNeighborMedian`). Abweichung vom Trend
  ≥ 300 Cent → Level 3 gelb, ≥ 600 Cent → Level 2 orange.
- **Lokaler Sprung MED-EL/AB** (BA 137, Level 2/3): nur aktiv
  bei MED-EL oder AB. Vergleich der Cent-Schrittweite zwischen
  benachbarten Elektroden (mit mindestens einem Override im
  Paar) gegen die Default-Schrittweite an dieser Stelle.
  Abweichung ≥ 400 Cent → Level 3 gelb, ≥ 700 Cent → Level 2
  orange. Warnung markiert das rechte Feld des Paars
  (Elektrode mit höherem Index).

### THR/Upper-Level-Prüfungen (Stand BA 138)

Geprüft werden `s.implant.thr[i]` und `s.implant.mcl[i]` (MED-EL)
bzw. `s.implant.upperLevel[i]` (Cochlear/AB) für aktive
(nicht-deaktivierte) Elektroden.

- **Wertebereich** (BA 138, Level 1 rot): außerhalb hersteller-
  spezifischer Hardware-Grenzen (`IMPL_VAL_THR_UPPER_RANGE`).
  MED-EL THR/MCL 0–268.6 qu, Cochlear 0–255 CL, AB 0–1000 CU.
- **THR ≥ Upper-Level-Konflikt** (BA 138, Level 1 rot):
  physiologisch unmöglich. Ein Warning markiert **beide** Felder
  derselben Zeile (THR und Upper) — Schema-Erweiterung: `field`
  kann String oder Array sein.
- **Größenordnung** (BA 138, Level 2 orange): Faktor ≥10 oder
  ≤1/10 gegen Spaltenmedian. Aktivierung ab 3 Werten in der
  Spalte.
- **MAD-Ausreißer** (BA 138, Level 3 gelb): |x − median| > 3·MAD.
  Aktivierung ab 5 Werten. Nur inaktive Elektroden (`elActive[i] === false`)
  sind ausgenommen; verrauschte oder stumme Elektroden bleiben in der
  MAD-Statistik enthalten und bekommen ggf. Warnungen (BA 140-fix).

### FAT-Sonderprüfung bei Deaktivierung (Stand BA 141, aktualisiert BA 164)

Eigene Prüfung `_implCheckFatOnDeactivation`. Auslöser:
mindestens eine Elektrode mit `elActive[i] === false`. Prüft
indirekt am Vorhandensein von Hz-eigen-Overrides, ob die FAT
adaptiert wurde:

- **globaler Test bestanden**: alle aktiven (`elActive[i] !== false`)
  Elektroden haben einen Hz-eigen-Override (globale Umverteilung
  der FAT erkennbar).
- **lokaler Test bestanden**: für mindestens eine der
  inaktiven Elektroden hat ein direkter aktiver Nachbar
  einen Hz-eigen-Override (lokale Anpassung an die Lücke).
- **weder noch**: Warnung.

Bewertung herstellerspezifisch (Konzept-Befund aus Recherche):

- **MED-EL und Cochlear**: Level 2 orange. Fitting-Software
  verteilt die FAT bei Deaktivierungen normalerweise global um;
  fehlende Adaption ist verdächtig.
- **Advanced Bionics**: Level 3 gelb. Feste Filtergrenzen,
  Lücke ist Default-Verhalten — Hinweis, keine starke Warnung.

Die Warnung trägt **kein** `electrodeIdx` und markiert deshalb
kein einzelnes Feld — sie erscheint nur als Box-Eintrag, weil
sich die Aussage auf die Tabelle als Ganzes bezieht.

### Globale Implantat-Parameter (Stand BA 143, IIDR-Ausbau BA 269)

Prüfung der beiden globalen Parameter (`s.implant.cValue`,
`s.implant.idr`) gegen Hersteller-spezifische Bereiche. Nur
aktiv, wenn der Wert gesetzt ist (`!= null`). Zwei Stufen:

- **Hardware-Range** (Level 1 rot): außerhalb der dokumentierten
  Software-Grenze. c-Wert 0–8000 (MED-EL, MAESTRO Boyd 2006),
  IDR 20–80 dB (AB, Holden 2011).
- **Typischer Bereich** (Level 3 gelb): innerhalb der Software-
  Grenze, aber außerhalb des typischen Audiologen-Bereichs.
  c-Wert 100–2000, IDR 40–70 dB.

Pro Hersteller wird nur der jeweils relevante Parameter geprüft:
c-Wert nur MED-EL, IDR nur AB. Cochlear hat seit BA 269 kein
globales Eingabefeld mehr — IIDR ging in keine Berechnung ein
(siehe `docs/Berechnungsgrundlagen dB zu CI.md`, Kap. 4.4) und
wurde mitsamt UI-Feld, Range-Prüfung und Druck-Anzeige entfernt.

Markierung an den Eingabefeldern `#implC`, `#implIDR` über die
Schema-Erweiterung `globalEl` und den Helfer `_implGlobalSelector`.

### Info-Hinweise / Stufen-Mix (BA 267, geändert BA 269)

Prüfungen, die nur aktive Elektroden betrachten. Kein Feld-
Outline — nur Listeneintrag in der Warnbox. Stufenmischung seit
BA 269:

- **FreqOwn leer** (A1, Level 3 gelb seit BA 269): alle aktiven
  Elektroden haben kein Hz-eigen-Override. Verschärfter Text:
  Default-Werte könnten für den Nutzer falsch sein und zu
  verfälschten Meßergebnissen führen.
- **FreqOwn unvollständig** (A2, Level 3 gelb seit BA 269): mind.
  eine aktive Elektrode hat Hz-eigen, mind. eine nicht.
- **Alle aktiv** (B1, Level 4 blau): keine Elektrode ist als
  inaktiv markiert.
- **Upper-Level leer** (C1, Level 4 blau): MCL/C-Level/M-Level
  bei allen aktiven Elektroden leer — Hersteller-Werte (qu/CL/CU)
  im Ausdruck nicht berechenbar.
- **Upper-Level unvollständig** (C2, Level 4 blau): Upper-Level
  nur teilweise eingetragen.
- **THR leer** (D1, nur AB, Level 4 blau): T-Level bei allen
  aktiven leer — CU nicht berechenbar.
- **THR unvollständig** (D2, nur AB, Level 4 blau): T-Level nur
  teilweise eingetragen.
- **c-Wert leer** (E1, neu BA 269, nur MED-EL, Level 4 blau):
  globaler MAPLAW-c-Wert nicht eingetragen — wird für die
  MAPLAW-Simulation im Player gebraucht.
- **IDR leer** (E2, neu BA 269, nur AB, Level 3 gelb): globaler
  IDR-Wert nicht eingetragen — geht direkt in `calcAB` ein; ohne
  Eintrag wird Default 60 dB angenommen und im Druck markiert.

Hersteller-Mapping für `{label}`/`{unit}` in den i18n-Strings:
`IMPL_VAL_UPPER_LABEL` und `IMPL_VAL_UNIT` (beide in
`implant-validate.js`).

**Überlappung mit `deactWarnBar`**: das bestehende Warnbanner
oberhalb der Tabelle (`#deactWarnBar` in `freq-table.js`) prüft
eine verwandte, aber nicht identische Bedingung: Auslöser ≥1
deaktivierte Elektrode; Bedingung: mindestens eine **aktive**
(nicht-deaktivierte) Elektrode hat noch keinen Hz-eigen-Override
(Bugfix BA 142 — vorher wurde fälschlich auf deaktivierte
Elektroden geprüft). Es bleibt parallel bestehen. Eine spätere
Konsolidierung kann den Banner durch diese Prüfung ersetzen.

### Cochlear-Default-Korrektur (BA 136)

`MFR.cochlear.freqs` in `js/core.js` wurde am 2026-05-31 auf
die offiziellen Werte aus dem CI Select App Manual (LFE 188 Hz,
HFE 7938 Hz, 22 Kanäle) korrigiert. Positionen 0–8 unverändert,
9–21 verschoben um bis zu ~125 Cent (max bei E1 basal).

Gespeicherte `fRes`-Einträge mit `timestamp` vor der
Korrektur-Konstante `COCHLEAR_FAT_CORRECTION_DATE` beziehen
sich auf die alten Defaults. Im Frequenzabgleich-Reiter wird
für Cochlear-User mit solchen Einträgen eine sanfte Info-Box
oben angezeigt, die zum Re-Test rät.
