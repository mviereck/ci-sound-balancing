# Konzept: CI-Testtöne

## Worum es geht

CImbel mißt mit Tönen, die der Träger über sein CI hört. Damit die
gemessenen Tonhöhen-Vergleiche und Lautstärke-Urteile zuverlässig
sind, müssen die Testtöne so klingen, daß **das CI sie möglichst
unverzerrt wiedergibt** — und nicht eigene Strukturen oder
Pegelmuster über den Ton legt, an denen sich der Hörer dann
orientiert statt am eigentlichen Stimulus.

Dieses Dokument hält fest, welche Testtöne im Tool angeboten werden
und warum sie so designt sind. Es richtet sich an alle, die am
Mess-Pfad arbeiten oder verstehen wollen, warum die CI-Test-Profile
in `js/citest-profiles.js` so aussehen, wie sie aussehen — und warum
einige Kandidaten verworfen wurden.

Code: `js/citest-profiles.js`, Engine in `playRichToneProfile` in
`js/audio.js`.

## Anforderungen an einen brauchbaren CI-Testton

Aus mehreren Iterationen mit Martins MED-EL Sonnet 3 haben sich vier
Anforderungen herauskristallisiert. Sie ergeben sich aus dem, was das
CI mit „ungeeigneten" Testtönen anstellt.

**1. Keine Hüllkurven-Spitzen am Anfang.** Ein Sinus, der aus der
Stille kommt und sofort auf vollem Pegel steht, klingt im CI wie ein
Trommelschlag, dann wird er leiser, dann wieder lauter. Das ist die
AGC-Sprungantwort: der Pegel-Limiter greift, dann regelt die
langsamere Hintergrund-AGC nach. Ein sanftes Anschwingen (~250 ms,
Cos²-Rampe) reduziert die Spitze deutlich.

**2. Möglichst stationärer Pegel im Sustain.** Jede Amplituden-
Modulation gibt der CI-AGC Anlaß, kontinuierlich nachzuregeln. Der
Ton wird dann gefühlt von einer periodischen Welle in der Lautstärke
überlagert. Bei Martin ~2,7 Hz, ~8 Wellen pro 3 Sekunden — sehr
auffällig, weil sie ablenkt. Das CI „macht aus jeder unserer
Modulation eine sichtbare AGC-Reaktion".

**3. Konstante Klangfarbe über den ganzen Mess-Frequenzbereich.**
Die Tests vergleichen subjektive Tonhöhen über mehrere Oktaven. Wenn
der Klang sich zwischen tiefem und hohem Stimulus stark ändert
(weil verschiedene Instrumenten-Samples eingesetzt werden oder weil
Pitching die Formanten verschiebt), klingt jede Frequenz „anders" —
das Tonhöhen-Urteil wird kontaminiert.

**4. Beliebige Frequenz auf cent.** Die Mess-Verfahren brauchen jede
Frequenz zwischen ca. 40 Hz und 8500 Hz. Synthetisch ist das trivial
(eine Zahl); bei Samples wäre jede Zwischen-Frequenz ein neuer
Pitching-Schritt mit klanglicher Drift.

## Warum keine Sample-basierten Töne (Mellotron etc.)

Naheliegende Idee aus den Anforderungen 2 und 3: echte
Instrumenten-Aufnahmen klingen weicher als ein Sinus, haben
natürliche Modulation und sind „in der Musik" das, was uns die
geringsten CI-Artefakte beschert. Wir haben das mit Mellotron-
Samples über smplr ernsthaft erwogen und verworfen:

- **Stimmungsfehler pro Sample.** Mellotron-Original-Aufnahmen haben
  Tape-Drift und Vibrato in der Aufnahme. Smplr korrigiert das nicht.
  Eine Cent-Korrektur müßte pro einzelnem Sample (~25 pro Variante)
  vermessen werden — aufwendig, und für jeden Bandsatz neu.
- **Klangfarbenwechsel beim Pitching.** Smplr deckt mit z. B. einem
  einzigen Geigen-Sample-Satz von MIDI 36 bis 84 ab und pitcht
  außerhalb. Die Klangfarbe ist bei 200 Hz eine andere als bei
  3000 Hz. Bricht Anforderung 3.
- **Kein einzelnes Instrument deckt 40–8500 Hz.** Kontrabass-tiefste
  Saite ist E1 (41 Hz), höchste Pikkolo-Note bei ~4 kHz. Darüber:
  Glockenspiel, Crotales — alles perkussive Quellen mit hartem Onset,
  bricht Anforderung 1.
- **Mehrere Instrumente kombinieren bricht Anforderung 3.** Cello
  unten, Flöte mittel, Glockenspiel oben — der Träger vergleicht
  dann drei verschiedene Klang-Eindrücke, nicht drei Tonhöhen.

Die smplr-Engine (Mellotron-Lader, Sample-Cache, Wiedergabe-Pfad)
bleibt im Code erhalten — sie wird voraussichtlich später im
Player-Tab nützlich sein, wo man tatsächlich nach Klangfarbe und
nicht nach Tonhöhen-Präzision aussucht. Aus der Mess-Tonart-Auswahl
ist sie seit 3.2.239.2 entfernt; die Gruppen-Definitionen liegen
geparkt als `_SMPLR_GROUPS_PARKED` in `js/tone-popup.js`.

## Wie die Profile aufgebaut sind

Alle CI-Test-Profile nutzen die gleiche Synthese-Engine
(`playRichToneProfile` in `js/audio.js`), die schon für die 14
Instrumenten-Imitationen (`RICHTONE_PROFILES.Vn`, `…Vc`, `…Fl` etc.)
existierte. Pro Profil:

- **Partials**: Liste `{mult, amp}`. `mult` ist der Faktor auf den
  Grundton (ganzzahlig = harmonisch, leicht abgesetzt =
  inharmonisch). Amplituden-Folge `1, 1/2, 1/3, 1/4, 1/5` ist
  bewußt **frequenz-unabhängig** — anders als die Instrumenten-
  Imitationen, deren Spektrum pro Aufnahme vorgegeben ist. Dadurch
  bleibt die Klangfarbe konstant (Anforderung 3). Partials oberhalb
  Nyquist werden automatisch weggelassen; bei 7 kHz Grundton spielt
  dann nur noch der Grundton plus 2. Oberton — immer noch reicher
  als ein Sinus.
- **Vibrato**: Frequenz-Modulation des Grundtons. 5 Hz, 5–6 cent
  — unterhalb der Wahrnehmungsschwelle als eigener Effekt, aber
  bricht stationäre Frequenz.
- **AM (Amplituden-Modulation)**: Lautstärke-Schwankung des
  gesamten Tons. *Im Nachhinein die größte Designentscheidung —
  siehe nächster Abschnitt.*
- **Attack (seit BA 270 global)**: Anschwing-Form und -Zeit sind seit BA 270
  tool-weit global einstellbar (vier Formen: hard, linear, cos²/Hann, dB-linear;
  plus Ausklang-Modus). Die Profile tragen kein eigenes `attackMs` mehr.
  Default: cos², 500 ms, kurzer Ausklang — entspricht dem früheren CiHF-Verhalten.

## Die zentrale Erkenntnis: AM ist Welle-Treiber, nicht Lösung

Das ursprüngliche Design ging davon aus, daß sanfte AM („Atem")
hilft, weil rein stationäre Töne die CI-AGC zu monotonem Regeln
anregen würden. Diese Annahme stimmt für Martins CI **nicht**. Eine
systematische Vergleichs-Reihe (CiH, CiB, CiHA, CiHS, CiHF) zeigt:

| Profil | AM-Tiefe @ AM-Hz | Welle bei Martin |
|---|---|---|
| CiHF (flach) | 0 | sehr gering |
| CiH | 8 % @ 3,5 Hz | gering |
| CiB | 8 % @ 3,5 Hz, inharmonisch | mittel |
| CiHA (Attack-stark) | 18 % @ 3,5 Hz | deutlich |
| CiHS (AM-langsam) | 25 % @ 2,7 Hz | am stärksten |

Vier Schlüsse:

**(a) Die periodische Welle entsteht durch unsere AM, nicht durch
AGC-Eigenresonanz.** CiHF ohne AM hat die geringste Welle. Wäre die
AGC selbst schwingungsfähig, müßte sie auch ohne AM-Input pumpen —
tut sie nicht.

**(b) Welle-Tiefe ist proportional zu AM-Tiefe.** 0 → 8 → 18 →
25 % AM bringt sehr gering → gering → deutlich → am stärksten.
Lineares Durchregeln der AGC auf unseren Input.

**(c) Welle-Frequenz ist eine Eigenschaft des CI.** Über alle
AM-Varianten bleibt die Anzahl der Wellen in 3 Sekunden gleich
(~8). Das entspricht der AGC-Zeitkonstante von ~370 ms — fest in
Martins Programm. Mit unserer AM können wir nur die Welle-Tiefe
variieren, nicht ihre Frequenz.

**(d) AM-Frequenz nahe der AGC-Frequenz verschärft, statt zu
kompensieren.** Die Hypothese, eine AM bei 2,7 Hz könne die AGC
„synchronisieren" und damit beruhigen, war falsch — sie regte die
Welle am stärksten an. Klassisches Regelkreis-Verhalten:
Resonanzantwort bei Eigenfrequenz.

Daraus folgt das aktuelle Design: **so stationär wie möglich**.

## Was nicht geht: allgemeine Anti-AGC-Kompensation

Eine zeitbasierte Anti-AGC-Hüllkurve (nach `dwellMs` ein Pegel-
Boost von `boostDb` über `boostMs`, der die AGC-Senke ausgleicht)
ist denkbar, taugt aber **nicht als Default-Lösung**:

- AGC-Zeitkonstanten unterscheiden sich zwischen Herstellern (MED-EL
  vs. Cochlear vs. AB), Soundprozessor-Generationen und sogar
  Programm-Einstellungen (ASC ein/aus bei MED-EL).
- AGC-Knee und Release sind pegel- und spektral-abhängig.
- Eine auf Martins CI getunte Kompensation würde bei anderen
  Trägern unerwartetes Verhalten zeigen.

Eine *Poweruser-Kalibrierung* pro Träger (Wellenfrequenz und
-Tiefe als Slider) wäre theoretisch möglich, ist aber Pflege-
intensiv (bei jeder MAP-Änderung neu) und ist aktuell **nicht
gebaut**. Aufgehoben als denkbarer späterer Schritt, sollte sich
die Erkenntnis aus Punkt (d) auf andere CIs übertragen lassen
und stationäre Töne dort *nicht* ausreichen.

## Was nicht geht: AGC-Vorlauf (Pre-Roll)

Idee: vor dem Mess-Ton 300–500 ms Hintergrund-Stimulus, der die AGC
einregelt, dann nahtlos in den Mess-Ton übergehen. Würde die
einmalige Onset-Welle eliminieren, hat aber zwei Probleme:

- Der Übergang muß so nahtlos sein, daß er nicht selbst einen
  Pegelsprung erzeugt — sonst hat man die Welle zweimal.
- Im Frequenzvergleich werden in schneller Folge Töne L/R/L/R
  abgespielt. Ein Pre-Roll vor jedem würde das Trial-Tempo
  halbieren oder den vergleichenden Eindruck stören.

Falls sich der Pre-Roll-Weg später als sinnvoll erweist (etwa für
Dauertöne im Implantat-Tab statt für Vergleichs-Bursts), wäre er
als separate Wiedergabe-Variante denkbar.

## Aktuelle Profile und ihre Rollen

Reihenfolge in der CI-Test-Gruppe der Tonart-Auswahl (Stand
3.2.239.2):

1. **CiHF** „CI-Test flach" — *Default*. AM aus, Vibrato bleibt,
   Anschwingen 500 ms. Bei Martin der ruhigste Klang. Wird seit
   3.2.239.4 als Default sowohl für Test 1/2 als auch für den
   Frequenzabgleich gesetzt.
2. **CiH** „CI-Test harmonisch" — Original-Design mit dezenter AM
   (3,5 Hz, 8 %). Klingt etwas lebendiger als CiHF, hat aber eine
   gering wahrnehmbare Welle.
3. **CiP** „CI-Test pur" — Maximalreduktion: kein AM, kein Vibrato,
   Anschwingen 250 ms. Diagnose-Variante. Prüft, ob bei einem
   bestimmten CI Frequenzmodulation auch eine Welle erzeugt (über
   die Filterbank, die Frequenz-Vibrato in Hüllkurven-Vibrato auf
   benachbarten Elektroden umsetzen würde).
4. **CiB** „CI-Test inharmonisch" — Partials leicht verstimmt
   (1, 2.005, 3.011, 4.019, 5.028), Glocken-Anmutung. Andere
   Spektral-Anregung der CI-Filterbank. Bei Martin etwas wellig
   weil noch mit AM.
5. **CiBF** „CI-Test inharmonisch flach" — wie CiB, aber ohne AM.
   Trennt Inharmonik-Wirkung von AM-Wirkung.
6. **CiHA** „CI-Test Modulation mittel" — 18 % AM, mittlere Stufe zwischen
   CiH (8 %) und CiHS (25 %). Die Attack-Begründung (600 ms Anschwingen)
   ist mit der globalen Anschwingsteuerung (BA 270) hinfällig; als
   Modulationstiefe-Variante bleibt das Profil dennoch sinnvoll.
7. **CiHS** „CI-Test AM-langsam" — AM bei 2,7 Hz (Martins AGC-
   Frequenz), 25 % Tiefe. Testete die widerlegte Hypothese
   „AM in AGC-Frequenz synchronisiert".

Die Diagnose-Varianten 6 und 7 dokumentieren widerlegte Hypothesen.
Sie bleiben in der Auswahl, weil sie bei anderen CIs (anderer
AGC-Zeitkonstante, anderer ASC-Konfiguration) womöglich anders
ausfallen — die Erkenntnis ist für Martins Sonnet 3 spezifisch.
Andere Träger können durch Vergleich der Profile herausfinden,
welche Variante für ihr Gerät am ruhigsten klingt.

## Globale Hüllkurve (BA 270/271)

Seit BA 270 ist die Ton-Hüllkurve (Anstieg + Ausklang) tool-weit global
einstellbar und persistent (localStorage-Key `ci-lb-toneEnv`). Vier
Anstiegsformen:

- **hard** — sofort voller Pegel, kein Anstieg.
- **linear** — konstante Amplituden-Steigung.
- **cos²** — Hann-Form (Default, spektral glatteste Form, tangential an
  beiden Enden).
- **dB-linear** — gleichmäßig wachsende Lautheit; startet bei einem
  konfigurierbaren Startpegel (Default −50 dB), kein harter Einsprung
  aus absoluter Stille.

Ausklang-Modi: kurz (fester 30-ms-Cos²-Ausklang), sym (gleiche Form und
Zeit wie der Anstieg), hard (abrupt).

Die profileigenen `attackMs`-Werte sind entfallen. BA 271 baut die
Bedienoberfläche dazu in das Tonauswahl-Modal.

## Onset-Welle: bleibt

Über alle Varianten hinweg hört Martin **eine** Welle direkt nach
dem Anschwingen. Das ist die klassische AGC-Sprungantwort auf den
Pegel-Anstieg aus Stille — physikalisch nicht durch Stimulus-
Tuning vermeidbar, solange der Ton aus dem Nichts kommt. Bei
kurzen Bursts (~400 ms) fällt sie zusammen mit dem Ende des Tons;
bei längeren Halttönen wird sie als „einzelne Anfangswelle" hörbar.

Pre-Roll (siehe oben) wäre theoretisch das Gegenmittel, ist aber
für die Trial-Logik der Mess-Verfahren ungeeignet.

## Frequenzbereich

Synthetisch praktisch unbegrenzt. Praktisch relevant:

- **Untere Grenze**: ~40 Hz (Kontrabass-Bereich). Bei sehr tiefen
  Tönen ist der hörbare Anteil oft nur vom Grundton getragen; das
  ist im Profil-Design durch konstante Amplituden-Folge gewährleistet.
- **Obere Grenze**: ~8500 Hz. Bei Cochlear-CIs reicht E1 bis 7938 Hz,
  bei MED-EL bis 7410 Hz — 8500 ist Sicherheitspuffer. Bei der oberen
  Grenze fallen alle Obertöne aus dem Nyquist heraus; der Klang
  reduziert sich auf den Grundton. Das ist akzeptiert — Anforderung
  ist „brauchbarer Mess-Stimulus", nicht „klingt nach Instrument".

## Was wurde verworfen, kurz

- Mellotron mit Cent-Korrektur und Sample-Set-Erweiterung: zu
  aufwendig für unsicheren Nutzen (Anforderungen 1 und 3 bleiben
  ungelöst).
- Längeres Anschwingen (600 ms): bei Martin schlechter, weil die
  AGC dann ständig im Nachjustieren statt im eingeschwungenen
  Zustand ist.
- AM in AGC-Eigenfrequenz: Resonanzanregung statt Kompensation.
- Pre-Roll: passt nicht zur Trial-Logik der Vergleichs-Verfahren.
- Pro-Nutzer-Anti-AGC-Slider: technisch denkbar, aber Pflegeaufwand
  hoch und Default-Werte stationärer Töne reichen für den Hauptfall.

## Offene Fragen

- **Vibrato als Welle-Treiber?** CiHF (mit Vibrato) vs. CiP (ohne
  Vibrato und ohne AM) ist die offene Diagnose. Falls CiP bei
  Martin oder bei anderen Trägern messbar ruhiger ist als CiHF,
  überträgt die CI-Filterbank Frequenz-Vibrato in eine Hüllkurven-
  Modulation, die die AGC genauso reizt wie AM.
- **Inharmonik isoliert** (CiB vs. CiBF): trägt die Inharmonik
  selbst zur Welle bei, oder nur die mitgelaufene AM? Klärt CiBF.
- **Übertragbarkeit auf andere CIs.** Martins Erkenntnisse gelten
  zunächst für sein Sonnet 3 in seiner aktuellen Programmierung.
  Für die Doku spezifisch sind: AGC-Welle bei ~2,7 Hz, AM als
  Treiber, AM-Frequenz nahe AGC verschärft. Bei Cochlear- oder
  AB-Trägern muß sich erst zeigen, welche der Diagnose-Varianten
  bei ihnen am besten funktioniert — die Profile sind absichtlich
  alle erhalten geblieben.

## Code-Anker

- `js/citest-profiles.js` — Profile (sieben Varianten, alle mit
  derselben Partial-Folge und Vibrato-Default).
- `js/audio.js` — `playRichToneProfile` ist die Engine.
  `_BASE_TONE_TYPES`-Whitelist plus `rich`-Präfix-Erkennung in
  `playToneTyped` reichen die `richCi…`-Strings durch.
- `js/tone-popup.js` — `GROUPS[0]` ist die CI-Test-Gruppe, Items
  in der Reihenfolge oben aufgeführt.
- `js/test-ui.js` — Tonart-Dropdown-Listen (zwei Stellen) und
  `_toneTypeKey` für i18n-Auflösung.
- `js/print-md.js` — i18n-Mapping für den Druck.
- `i18n/de.js` — Labels und Beschreibungen.

---

## Anhang A: Lautheit, Pegel, Klangfarbe — Begriffsklärung

Die Anforderung „konstante Klangfarbe über den ganzen Frequenz-
bereich" weiter oben ist sprachlich präziser als die ursprüngliche
Formulierung „gleich laut" — diese wäre für die Mess-Aufgabe
sogar falsch. Drei Begriffe, die leicht verschwimmen:

- **Pegel** (dB SPL/FS) — physikalische Größe, was wir an die
  Hardware schicken.
- **Lautheit** (Sone/Phon) — psychoakustische Wahrnehmung *bei
  normalem Gehör*. Frequenzabhängig (Fletcher-Munson): bei
  gleichem Pegel klingen 100 Hz und 7000 Hz leiser als 1 kHz.
- **Klangfarbe** — wie der Ton klingt unabhängig von Tonhöhe und
  Lautheit: welche Obertöne in welchem Verhältnis.

Was die CI-Test-Profile konstant halten, sind die **Partial-
Amplitudenverhältnisse** (1, ½, ⅓, ¼, ⅕) — also nominal die
Klangfarbe. Pegel und Lautheit *nicht*: das ist Absicht.

### Warum keine Lautheits-Kompensation pro Frequenz

Wenn das Tool die Pegel pro Frequenz so anpassen würde, daß alle
Töne *gleich laut wahrgenommen* werden, würde es genau das
verhindern, was es messen soll: **wie laut der CI-Träger jede
Elektrode bei gleichem Input wahrnimmt**. Die Lautheit-Asymmetrie
pro Elektrode ist das Mess-Objekt. Eine frequenzabhängige Pegel-
Korrektur wäre selbst-aufhebend.

Beim Player ist das anders — dort *will* der Träger einen normal
hörenden Eindruck, und die EQ-Korrektur kompensiert. Aber im
Messpfad nicht.

### Wo „konstante Klangfarbe" tatsächlich bricht

Drei Stellen, an denen die Klangfarbe doch frequenzabhängig wird,
auch wenn die Partial-Vorgabe konstant ist:

**1. Nyquist-Filter.** Bei Sample-Rate 48 kHz ist Nyquist 24 kHz.
Bei Grundton 200 Hz liegen alle fünf Partials (200/400/600/800/
1000 Hz) bequem darunter — voller Klang. Bei Grundton 7000 Hz
liegen nur Grundton + 2. Oberton (14 kHz) drin, 3.–5. Oberton
fallen weg. Tiefer Ton ist spektral reicher als hoher. Das ist
*nicht* konstant — nur die *Vorgabe* der Amplitudenverhältnisse
ist konstant.

**2. CI-Filterbank-Auflösung.** Die Bandbreite der CI-Elektroden
wächst logarithmisch mit der Frequenz. Bei tiefen Tönen treffen
Grundton und Obertöne womöglich *verschiedene* Elektroden (mehrere
Elektroden werden gleichzeitig stimuliert); bei hohen Tönen sitzen
sie alle in einer Elektrode. Der CI-Träger hört bei tiefen Tönen
einen breiteren Stimulationseindruck als bei hohen. Das ist eine
systematische Asymmetrie, die nicht ausgeglichen werden kann, ohne
das Mess-Ziel zu verfälschen. Siehe Anhang B für ein konkretes
Beispiel.

**3. AGC-Verhalten.** Martin berichtet „bei tiefen Frequenzen
etwas weniger auffällig" für die periodische Welle — d. h. die
AGC reagiert nicht ganz frequenzunabhängig. Wahrscheinlich greift
sie pro Filterband (oder zumindest mit frequenzabhängigem Knee).
Ein Profil, das genau die Welle ausgleicht, müßte dafür pro
Frequenz andere Parameter haben.

### Reicht das einfache Grundschema?

Aktuelle Einschätzung: **ja, vorerst**. Begründung:

- Bruch durch Nyquist ist *graduell* — keine Klippe, sondern eine
  schleichende Ausdünnung über mehrere Oktaven.
- Filterbank-Asymmetrie ist eine *Eigenschaft des CI*, nicht des
  Stimulus. Wir würden sie nicht „lösen", indem wir den Stimulus
  pro Frequenz anders bauen — wir würden nur ein zweites
  unkontrolliertes Element einführen.
- AGC-Welle pro Frequenz: bei Martin „ähnlich, tiefe etwas
  weniger" — Größenordnung des Effekts ist klein. Pro-Frequenz-
  Tuning würde dem Tool eine pro-Träger-Kalibrierungsmatrix
  aufzwingen, die Pflegeaufwand und Komplexität deutlich erhöht,
  ohne daß klar wäre, daß die Mess-Präzision dadurch steigt.

Eine kleine Verbesserung ohne Verkomplizierung wäre denkbar: alle
Profile auf maximal 3 Partials begrenzen (Grundton + 2 Obertöne).
Dann hätten tiefe und hohe Töne *strukturell* gleich viele
Partials. Trade-off: tiefe Töne klingen dünner, die Klangfarbe
wäre tatsächlich konstanter über den Bereich, aber als Klang
weniger reichhaltig. Vermutlich kein Gewinn fürs Messen.

---

## Anhang B: Frequenzabhängige Wahrnehmung trotz konstanter Synthese (Martin, 2026-06-11)

Beim Vergleich der CI-Test-Töne über die zwölf MED-EL-Standard-
Elektroden hat Martin folgendes Muster beobachtet — gilt für *alle*
CI-Test-Varianten gleichermaßen:

| Elektrode | MAPLAW-Frequenz | Klang-Eindruck |
|---|---|---|
| E1–E4 | 120–579 Hz | sauber |
| E5 | 836 Hz | Akkordeon-Charakter |
| E6 | 1175 Hz | schnelles Kratzen |
| E7 | 1624 Hz | wie E6, schwächer |
| E8 | 2222 Hz | nur leicht |
| E9 | 3019 Hz | nur leicht |
| E10 | 4084 Hz | sauber |
| E11 | 5507 Hz | rauschig (unabhängig vom Testton — Gerät) |
| E12 | 7410 Hz | stumm (vom Audiologen) |

### Hypothese: Partial-Anregung mehrerer Elektroden

Der CI-Träger hört nicht den synthetisierten Ton, sondern das
Ergebnis nachdem die CI-Filterbank die Partials auf die Elektroden
verteilt hat. Bei MAPLAW-Frequenzen [120, 235, 384, 579, 836,
1175, 1624, 2222, 3019, 4084, 5507, 7410] Hz ergibt sich für die
fünf Partials der CI-Test-Profile (Grundton × {1, 2, 3, 4, 5}):

| Grundton | Oberton 2 | Oberton 3 | Oberton 4 | Oberton 5 |
|---|---|---|---|---|
| E5 = 836 | 1672 (~E7) | 2508 (~E8) | 3344 (~E9) | 4180 (~E10) |
| E6 = 1175 | 2350 (~E8) | 3525 (~E10) | 4700 (~E10/E11) | **5875 (E11)** |
| E7 = 1624 | 3248 (~E9) | 4872 (~E10/E11) | 6496 (~E12) | über CI-Range |
| E8 = 2222 | 4444 (~E10) | 6666 (~E11/E12) | über CI-Range | über CI-Range |
| E9 = 3019 | 6038 (~E11) | über CI-Range | – | – |
| E10 = 4084 | **8168 über CI-Range** | – | – | – |

Das Muster paßt zu den Beobachtungen:

- **E5 „Akkordeon"**: fünf verschiedene Elektroden werden
  gleichzeitig im sauberen Bereich stimuliert → klingt akkordartig.
- **E6 „schnelles Kratzen"**: ähnliche Anregung, aber Oberton 5
  trifft direkt die rauschige E11 → die unsaubere Elektrode wird
  mit-stimuliert.
- **E7 schwächer**: weniger Oberton-Energie auf E11; Oberton 4
  trifft das stumme E12.
- **E8/E9 nur leicht**: maximal ein Oberton in E11-Nähe.
- **E10 sauber**: alle Obertöne fallen über E12 (7410 Hz), also
  außerhalb der CI-Filterbank. Effektiv hört das CI nur den Grund-
  ton, **wie einen Sinus** — daher der saubere Klang. Faktisch
  kein klangfarben-Ton mehr, sondern eine Solo-Elektroden-Anregung.
- **E1–E4 sauber**: Grundtöne 120–579 Hz haben Obertöne im Fine-
  Hearing-Bereich der tiefen Elektroden, wo MED-EL zeitliche
  Feinstruktur überträgt. Vermutlich integriert das CI das
  natürlicher zu einem Klang, statt mehrere getrennte Pitches zu
  erzeugen.

Die Zuordnung Oberton → Elektrode in der Tabelle ist näherungsweise
(ungefähr nach geometrischem Mittel der Nachbar­frequenzen); das
genaue Cross-over hängt von der herstellerspezifischen Filterbank
ab. Die Tendenz ist robust, einzelne Felder können sich um eine
Elektrode verschieben.

### Was das für das Design bedeutet

Zwei wichtige Schlüsse:

**1. Klangfarbenkonstante Synthese ist beim CI keine klangfarben-
konstante Wahrnehmung.** Was am CI ankommt, hängt davon ab, wie
viele Elektroden die Partials gleichzeitig anregen — und ob
darunter eine problematische ist (verrauschte oder stumm-
geschaltete Elektroden im Programm des Trägers).

**2. CiHF ist bei Martin vor allem deshalb der ruhigste, weil's die
AM-Welle nicht hat — *nicht* weil's klangfarben-konstanter wäre.**
Die frequenzabhängige Akkord-/Kratz-Komponente bleibt in allen
Profilen, weil sie aus der gemeinsamen Partial-Struktur stammt.

### Mögliche Anpassungen — keine sofortige Empfehlung

Drei denkbare Wege, alle mit Trade-offs:

1. **Schlankes Profil** (nur Grundton + 1 Oberton, oder gar nur
   Grundton): vermeidet den Akkord. Klingt aber dünner und
   entspricht stärker einem Sinus → könnte die AGC-Welle wieder
   verstärken, weil weniger zeitliche Variation im Signal.
2. **Adaptive Partial-Anzahl pro Grundton**: wenig Obertöne im
   Mittenband (E5–E9), mehr unten und oben. Kompliziert in der
   Datenpflege, mehr potentielle Inkonsistenzen.
3. **Patient-spezifische Filterung**: Partials, die auf rauschige
   oder stumm-geschaltete Elektroden fallen würden, weglassen.
   Pflegeintensiv, aber für einen einzelnen Träger einfach
   (Liste der „kritischen Elektroden" als State-Variable). Würde
   andere Probleme nicht lösen (Akkord im Mittenband bleibt).

Aktueller Stand: nicht gebaut. Vor weiterer Arbeit erst die offene
Diagnose **CiHF vs. CiP** (Vibrato-Frage) abschließen. Wenn CiP
messbar ruhiger ist, ist Vibrato auch ein Welle-Treiber, und ein
schlankes Profil bekommt zusätzliche Begründung. Sonst kann das
Akkord-Phänomen sogar erwünscht sein — es sagt dem Träger etwas
über die Verteilung seines CI-Programms.

### Diagnose-Profil CiG (0.4.269.1)

Auf Wunsch von Martin als Vergleichston ergänzt: **CiG „CI-Test
Grundton"** synthetisiert *nur* den Grundton, ohne jeden Oberton.
Parameter ansonsten wie CiHF (Anschwingen 500 ms, Vibrato 5 Hz /
6 cent, kein AM), damit der Vergleich CiHF↔CiG ausschließlich die
Partial-Struktur isoliert.

Hörerwartung aus der Hypothese oben:

- **E5–E9**: Akkord- und Kratz-Komponente sollte verschwinden, weil
  keine weiteren Elektroden mit-stimuliert werden können. Bleibt
  sie trotzdem, liegt eine andere Ursache vor (Filterbank-Kopplung,
  Vibrato-induzierte Cross-Modulation, Hardware).
- **E10**: sollte gleich klingen wie CiHF, weil dort schon nur der
  Grundton wahrgenommen wird (Obertöne fallen über CI-Range).
- **E1–E4**: sollte ähnlich klingen wie CiHF, eventuell etwas dünner.

Bei einem Sinus-ähnlichen Eindruck reicht CiG als Grundton-Test;
falls der CI-Träger feststellt, daß CiG die AGC-Welle deutlich
stärker zeigt als CiHF, ist die Schlußfolgerung umgekehrt zur
Akkord-Hypothese: Obertöne *helfen* dem CI, die AGC zu beruhigen,
weil sie mehr Energie über mehrere Elektroden verteilen.

### Ergebnis CiG-Test (Martin, 0.4.269.2)

Martin hat CiG getestet. Befund:

- **Akkord-Hypothese bestätigt.** Bei E5–E9 verschwindet der
  Akkordeon-/Kratz-Charakter, den die Profile mit mehreren Partials
  zeigen. Ohne Obertöne werden keine weiteren Elektroden mit-
  stimuliert; der Eindruck ist sauberer Einzelton.
- **Neue, unerwartete Beobachtung an E11**: bei der defekten
  E11 (rauschig, geräteseitig) tritt mit CiG ein zusätzlicher
  warble-sinus-artiger Ton auf, der bei *keinem* anderen Profil
  hörbar ist — auch nicht bei CiHF, dem CiG am nächsten kommt.

Vergleich der Bedingungen am CI für E11 = 5507 Hz:

| Profil | Partials | wirksam am CI-Filter |
|---|---|---|
| CiHF | 5 | nur Grundton (Obertöne ≥ 11 kHz, über CI-Range) |
| CiG | 1 | nur Grundton |

Theoretisch sollten beide gleich klingen. Daß CiG einen warble-
Effekt zeigt und CiHF nicht, läßt drei Hypothesen zu:

**Hypothese A — Vibrato wird ohne Obertöne hörbar.** Beide Profile
haben Vibrato (5 Hz, 6 cent). Bei CiHF verteilt sich das Vibrato
auf fünf Partials, die akustisch leicht unterschiedlich modulieren
und sich gegenseitig „auffüllen". Bei CiG ist die Frequenzmodulation
in Reinform da — und genau das wirkt akustisch wie ein „warble". Daß
es speziell bei E11 auffällt, könnte daran liegen, daß die rauschige
Wiedergabe der E11-Filterbank die Modulation noch verstärkt (FM
wird zu AM, wenn ein Signal eine Filterflanke durchwandert).

**Hypothese B — Lautstärke-Effekt durch Amplituden-Normalisierung.**
`playRichToneProfile` normalisiert die Partial-Amplituden gegen die
Summe aller Partial-Amplituden. Bei CiHF (Summe 2.28) hat der
Grundton nur etwa 44 % der Gesamtenergie; bei CiG (Summe 1.0) hat
er die volle Energie. CiG stimuliert E11 also kräftiger. Würde
allerdings auch bei anderen Elektroden auftreten — tut's nicht.

**Hypothese C — Intermodulation vor der CI-Filterbank.** Die
hohen Partials bei CiHF (11/16/22 kHz) sind für die CI-Filterbank
unsichtbar, sind aber im Audiosignal *vor* Mikrofon und Codec
vorhanden. Sie könnten dort Intermodulationsverzerrungen mit dem
Grundton bilden, die zufällig im hörbaren Bereich landen und den
Vibrato akustisch maskieren. Bei CiG fehlen sie, und der reine
Vibrato kommt zum Vorschein.

Wahrscheinlichste Erklärung: **A.** B würde sich auch auf anderen
Elektroden zeigen. C würde bei den anderen Profilen ein hörbares
Differenz-Verhalten zwischen Elektroden zeigen, das nicht
beobachtet wird.

### Diagnose-Profil CiS (0.4.269.2)

Um Hypothese A scharf zu testen, ergänzt um **CiS „CI-Test
Sinus"**: nur Grundton, *ohne* Vibrato, sonst wie CiG. Damit ist
der Vergleich CiG↔CiS exakt auf das Vibrato isoliert.

Erwartung nach Hypothese A: **CiS zeigt bei E11 keinen warble-
Effekt**. Wenn das eintritt, ist Vibrato + Einzelpartial eindeutig
die Ursache des warble-Tons bei E11.

Wenn CiS bei E11 ebenfalls einen Zusatzton zeigt, fällt Hypothese
A weg und C wird wahrscheinlicher (Intermodulation vor der CI-
Filterbank — auch ohne Vibrato würde die fehlende Maskierung durch
Obertöne hörbar werden).

### Mess-Konsequenz: nicht so dramatisch wie sie klingt

Für die eigentliche Mess-Aufgabe (Tonhöhen-Vergleich links/rechts
bei gleicher Soll-Frequenz, Lautstärke-Urteil pro Elektrode) ist
der Akkord-/Kratz-Effekt weniger problematisch, als er sich beim
freien Hören anfühlt:

- Im Frequenzabgleich werden beide Seiten *mit derselben*
  Frequenz angeregt — der Akkord-Effekt ist auf beiden Seiten
  ähnlich (sofern beide CIs ähnlich programmiert sind) und hebt
  sich beim Vergleich teilweise heraus.
- Im Elektrodenlautstärke-Test wird *eine* Elektrode betrachtet;
  daß Obertöne weitere Elektroden anregen, kann das Urteil
  einfärben, ist aber bei monaurarer Aufgabe weniger gravierend
  als beim binauralen Vergleich.

Wo es kritisch werden kann: wenn die Akkord-Anregung in den
Lautstärke-Vergleichen auf zwei CIs *unterschiedlich* ausfällt
(unterschiedliche MAP-Programmierung der Patienten), erzeugt der
Stimulus selbst eine Asymmetrie, die nichts mit der eigentlichen
zu messenden Größe zu tun hat. Das ist eine offene Frage für
Träger mit beidseitigem CI.
