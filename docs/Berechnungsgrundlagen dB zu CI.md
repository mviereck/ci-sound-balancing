# Berechnungsgrundlagen
## Umrechnung gemessener dB-Korrekturen in Hersteller-Software-Einheiten

CI Sound Balancing Tool · Stand 2025

---

## 1. Zweck

Das Sound Balancing Tool mißt mit psychoakustischen Lautstärke-
vergleichen, wie weit die wahrgenommene Lautstärke einzelner
Elektroden voneinander abweicht. Ergebnis ist eine Korrekturkurve
in dB pro Elektrode.

Damit der Audiologe diese Korrekturen direkt in seiner Anpaß-
software einstellen kann, müssen die dB-Werte in die Einheiten der
jeweiligen Hersteller-Software umgerechnet werden:

- MED-EL MAESTRO: Ladung in qu (charge units)
- Cochlear Custom Sound Pro: Current Level in CL
- Advanced Bionics SoundWave: Clinical Units in CU

Dieses Dokument beschreibt die mathematischen Grundlagen, die
verwendeten Formeln, die Quellen und die bekannten Grenzen der
Berechnung.

---

## 2. Grundprinzip

Eine wahrgenommene Lautstärkedifferenz von ΔdB zwischen zwei
Elektroden kann auf zwei Wegen ausgeglichen werden.

### Weg A: Output-Seite (MCL/M-Level/C-Level verschieben)

Der Audiologe ändert direkt den Wert, der die maximale
Stimulationsamplitude festlegt. Dieser Weg ist bei allen drei
Herstellern eindeutig umsetzbar und wird vom Tool primär
empfohlen.

### Weg B: Input-Seite (Channel-Gain verschieben)

Der Audiologe ändert die Kanal-Verstärkung vor der Mapping-
Funktion. Bei Advanced Bionics ist dies direkt als Parameter
verfügbar. Bei MED-EL und Cochlear gibt es ähnliche Mechanismen,
die jedoch unterschiedlich heißen und verschieden eingreifen.

Das Tool gibt im Ausdruck primär Weg A aus, optional auch Weg B,
wenn vorhanden.

---

## 3. MED-EL

### 3.1 Fitting-Modell

MAESTRO verwendet pro Elektrode zwei Werte:

- THR (Threshold): Hörschwellenladung in qu
- MCL (Most Comfortable Level): maximale Komfortladung in qu

Dazwischen liegt der elektrische Dynamikbereich (EDR). Der
Audiologe stellt die Lautheit eines Kanals durch Anheben oder
Absenken des MCL ein. Bei aktivem Volume Mode IBK (Standard für
FS4 und FSP) bleibt THR konstant, MCL steigt mit der Lautstärke.

Einheiten:

- 1 qu = 1 nC (Nanocoulomb), Ladung pro Phase
- 1 cu = 1 µA (Mikroampere), Stromstärke
- MAESTRO bildet physikalische auf klinische Einheiten als
  Identitätsfunktion ab

MCL-Bereich: 0 bis 268,6 qu (für ABI: 0 bis 237,6 qu)

Quelle: MAESTRO 11 User Manual (MED-EL, AW44981_10), Kapitel
7.6.7 und 24.3.

### 3.2 MAPLAW-Kompressionsfunktion

Die MAPLAW bildet die Hüllkurvenamplitude eines Kanals (nach AGC
und Filterbank) auf den elektrischen Dynamikbereich ab:

```
y = ln(1 + c · x) / ln(1 + c)
qu(x) = THR + (MCL - THR) · y
```

mit:

- x = normalisierte Eingangsamplitude (0 bis 1)
- y = normalisierte Ausgangsladung (0 bis 1)
- c = Kompressionskoeffizient (0 bis 8000, Standard 500)
- ln = natürlicher Logarithmus

Bei c = 0 ist die Kennlinie linear. Höhere c-Werte bewirken eine
stärkere Anhebung leiser Eingangssignale.

Quelle: Boyd PJ (2006), "Effects of Programming Threshold and
Maplaw Settings on Acoustic Thresholds and Speech Discrimination
with the MED-EL COMBI 40+ Cochlear Implant", Ear and Hearing
27(6), Seite 610.

### 3.3 Eingangsdynamik

MED-EL verwendet keinen festen IDR im Sinne von AB oder Cochlear.
Stattdessen liegt eine zweistufige AGC vor der MAPLAW, die ein
55 dB breites Adaptive Sound Window dynamisch im Eingangsbereich
verschiebt. Effektiver IDR über die AGC-Bewegung: ca. 75 dB.

Bei Default-Sensitivity 75 % und Compression 3:1 liegt der
AGC-Knee-Punkt bei 52,7 dB SPL. Bei 106 dB SPL Eingang wird MCL
erreicht.

Quelle: Vaerenberg B, Govaerts PJ, Stainsby T, Nopp P, Gault A,
Gnansia D (2014), "A Uniform Graphical Representation of Intensity
Coding in Current-Generation Cochlear Implant Systems", Ear &
Hearing 35(5), Seite 533–543.

### 3.4 Berechnung Weg A (MED-EL)

Eine wahrgenommene Lautstärkeerhöhung um ΔdB wird umgesetzt durch
Anhebung des MCL:

```
MCL_neu [qu] = MCL_alt · 10^(ΔdB / 20)

ΔMCL [qu] = MCL_alt · (10^(ΔdB / 20) - 1)
```

Diese Formel betrachtet ΔdB als elektrischen Ausgangs-dB
(Stromverhältnis). Sie ist unabhängig vom c-Wert, weil die
MAPLAW-Form bei reiner MCL-Verschiebung erhalten bleibt.

Beispiel: MCL_alt = 100 qu, ΔdB = +3
MCL_neu = 100 · 10^0,15 = 100 · 1,4125 = 141,3 qu
ΔMCL = +41,3 qu

### 3.5 Vorbehalte

- Bei Volume Mode IBK ändert eine MCL-Anhebung den elektrischen
  Dynamikbereich und damit die effektive Kompressions-Form. Bei
  großen Korrekturen (über ±5 dB) kann das spürbar werden.
- Die Wahrnehmungs-dB ist nicht streng linear mit der
  elektrischen dB-Skala verknüpft. Loudness Growth Functions sind
  individuell und nicht-linear.
- Compliance-Grenze des Implantats kann bei stark erhöhten
  MCL-Werten überschritten werden. MAESTRO zeigt dies als
  Warnung an. Über der Compliance wird die Stimulation begrenzt.
- Die Formel ist eine Approximation für moderate Korrekturen.

---

## 4. Cochlear

### 4.1 Fitting-Modell

Custom Sound Pro verwendet pro Elektrode zwei Werte:

- T-Level (Threshold Level): Hörschwelle in CL
- C-Level (Comfort Level): obere Komfortgrenze in CL

CL ist eine logarithmische Skala von 0 bis 255, die die
Stimulationsstromstärke in einer Pseudoeinheit kodiert.

### 4.2 Stromformel und Schrittgröße

Die Umrechnung von CL zu Stromstärke hängt von der Implantat-
Generation ab.

#### Alte Generation (CI22M, CI24M, CI24R)

```
I [µA] = 17,5 · 100^(CL / 255)
```

Schrittgröße: 0,176 dB pro CL.
Strombereich: ca. 17,5 µA bei CL = 0 bis 1750 µA bei CL = 255.

Quelle: Smith C, Shivdasani MN, Fallon JB et al. (2018),
"Evaluation of focused multipolar stimulation for cochlear
implants: a preclinical safety study", Trends in Hearing,
PMC5681383.

#### Freedom-Generation und neuer (CI24RE, CI500, CI600, CI1000)

Die Freedom-Generation verwendet eine modifizierte Skala mit
feinerer Schrittweite:

Schrittgröße: 0,157 dB pro CL.
Strombereich: ca. 10 µA bis 1750 µA, gleiche Grenzen wie alt.

Quelle: Zhou N et al., "Effect of Pulse Rate on Loudness
Discrimination in Cochlear Implant Users", PMC5962473.

Hinweis: Die exakte mathematische Form der Freedom-Stromformel
ist in den durchsuchten Quellen nicht explizit angegeben. Die
Schrittgröße 0,157 dB/CL ist verifiziert.

### 4.3 Eingangsdynamik

IIDR (Input Instantaneous Dynamic Range): Default 40 dB,
einstellbar.

Standard-Mapping: 25 dB SPL (T-SPL) bis 65 dB SPL (C-SPL).
Eingänge oberhalb 65 dB SPL werden komprimiert.

Quelle: Vaerenberg et al. 2014; Cosetti et al., PMC7358003.

### 4.4 Berechnung Weg A (Cochlear)

Eine wahrgenommene Lautstärkeerhöhung um ΔdB wird umgesetzt durch
Anhebung des C-Level:

```
Alte Generation:
ΔC [CL] = ΔdB / 0,176 ≈ 5,7 · ΔdB

Freedom und neuer:
ΔC [CL] = ΔdB / 0,157 ≈ 6,4 · ΔdB

C_neu [CL] = C_alt + ΔC
```

Die Formel ist unabhängig vom aktuellen C-Level, weil die CL-Skala
logarithmisch ist (jeder CL-Schritt entspricht einer festen
dB-Änderung).

Beispiel (Freedom): C_alt = 180 CL, ΔdB = +3
ΔC = 3 / 0,157 = 19,1 CL → C_neu = 199 CL

### 4.5 Vorbehalte

- Die Generations-Zuordnung muß im Tool korrekt gewählt werden,
  sonst weicht die Berechnung um ca. 12 % ab.
- Custom Sound Pro nutzt einen Q-Wert (Loudness Growth Parameter)
  zur Lautheitsformung. Eine reine C-Level-Anhebung ändert nicht
  die Wachstumskennlinie.
- Compliance-Grenze des Implantats kann bei stark erhöhten
  C-Levels überschritten werden. Custom Sound zeigt dies an.
- Wie bei MED-EL: elektrische dB ≠ Wahrnehmungs-dB. Die
  Approximation gilt für moderate Korrekturen.

---

## 5. Advanced Bionics

### 5.1 Fitting-Modell

SoundWave verwendet pro Elektrode zwei Werte:

- T-Level: Hörschwelle in CU (Clinical Units)
- M-Level: maximale Komfortstimulation in CU

CU ist eine herstellerspezifische klinische Einheit, die nicht
direkt einem Stromwert in µA entspricht. Die Beziehung CU zu µA
ist in den öffentlich zugänglichen Quellen nicht dokumentiert.

Stimulationsbereiche typisch 50 bis 600 CU. Compliance-Grenzen
sind implantatabhängig.

Quelle: Advanced Bionics SoundWave Quick Reference Guide.

### 5.2 Mapping-Funktion

AB verwendet ein lineares Mapping von Eingangs-dB SPL auf
Stimulations-CU:

```
I = ((M - T) / IDR) · (L - KNEE + IDR + GAIN) + T
```

mit:

- I = Stimulationsstrom in CU
- M = M-Level der Elektrode in CU
- T = T-Level der Elektrode in CU
- L = Hüllkurvenamplitude in dB SPL
- KNEE = Eingangs-SPL, das auf M-Level abgebildet wird
- IDR = Input Dynamic Range in dB
- GAIN = Channel-Gain in dB

Standardwerte:

- KNEE = 63 dB SPL
- IDR = 60 dB (einstellbar 20 bis 80 dB)
- GAIN = 0 dB

Bei diesen Standardwerten gilt: Eingang 63 dB SPL → M-Level,
Eingang 3 dB SPL → T-Level.

Quelle: Holden LK, Reeder RM, Firszt JB, Finley CC (2011),
"Optimizing the Perception of Soft Speech and Speech in Noise with
the Advanced Bionics Cochlear Implant System", International
Journal of Audiology 50(4), 255–269. Auch Vaerenberg et al. 2014.

### 5.3 Berechnung Weg A (AB)

Eine wahrgenommene Lautstärkeerhöhung um ΔdB wird umgesetzt durch
Anhebung des M-Levels:

```
ΔM [CU] = ((M - T) / IDR) · ΔdB

M_neu [CU] = M_alt + ΔM
```

Die Formel ist linear in ΔdB. Sie hängt vom aktuellen M-Level,
T-Level und IDR ab.

Beispiel: M = 400 CU, T = 100 CU, IDR = 60 dB, ΔdB = +3
ΔM = (300 / 60) · 3 = 15 CU → M_neu = 415 CU

### 5.4 Berechnung Weg B (AB)

Eine alternative Korrektur ist die Anhebung des Channel-Gain:

```
GAIN_neu [dB] = GAIN_alt + ΔdB
```

Dies verschiebt die gesamte Mapping-Funktion vertikal, ohne den
M- oder T-Level zu ändern. Die Form der Loudness-Wachstumskurve
bleibt erhalten.

Bei AB ist Weg B besonders sauber umsetzbar, weil GAIN ein
expliziter Software-Parameter ist.

### 5.5 Vorbehalte

- Standardwerte für IDR können vom Audiologen abweichen. Wenn der
  Patient den IDR-Wert nicht kennt, gilt die Berechnung mit IDR =
  60 dB als Approximation.
- Das M-T-Verhältnis variiert pro Elektrode. Ohne diese Werte ist
  nur die relative dB-Empfehlung präzise.
- Sensitivity (separate Funktion) verschiebt die gesamte Kennlinie
  horizontal. Sie ist bei der Berechnung nicht zu verwechseln mit
  GAIN.
- Compliance-Grenze des Implantats kann bei stark erhöhten
  M-Levels überschritten werden. SoundWave zeigt dies an.

---

## 6. Implantat- und Prozessor-Modelle

Die folgenden Listen sind Stand 2025 und basieren auf öffentlichen
Herstellerangaben. Sie können unvollständig sein. Bei Unsicherheit
über das eigene Modell sollte "Unbekannt" gewählt werden.

### 6.1 MED-EL

Implantate (12 Elektroden):

| Modell | Tech. Bez. | Jahr |
|---|---|---|
| SYNCHRONY 2 | Mi1200 | 2020 |
| SYNCHRONY | Mi1200 | 2013 |
| CONCERTO | Mi1000 | 2009 |
| SONATA | Mi1000 | 2006 |
| PULSAR | Mi1000 | 2004 |
| COMBI 40+ | C40+ | 1999 |
| COMBI 40 | C40 | 1997 |

Audio-Prozessoren:

| Modell | Form | Jahr |
|---|---|---|
| SONNET 3 | BTE | 2023 |
| RONDO 3 | OTE | 2020 |
| SONNET 2 | BTE | 2018 |
| RONDO 2 | OTE | 2016 |
| SONNET | BTE | 2014 |
| RONDO | OTE | 2011 |
| OPUS 2 | BTE | 2007 |
| TEMPO+ | BTE | 2003 |

### 6.2 Cochlear

Implantate (22 Elektroden), nach Generation:

Generation A (alte Stromformel, 0,176 dB/CL):

| Modell | Jahr |
|---|---|
| CI22M (Nucleus 22) | 1985 |
| CI24M | 1998 |
| CI24R | 2002 |

Generation B (Freedom und neuer, 0,157 dB/CL):

| Modell | Jahr |
|---|---|
| CI24RE (Freedom) | 2005 |
| CI500-Serie / Profile (CI512, CI522, CI532) | 2009 |
| CI600-Serie / Profile Plus (CI612, CI622, CI624, CI632) | 2020 |

Audio-Prozessoren:

| Modell | Form | Jahr |
|---|---|---|
| Kanso 3 Nexa (CP1175) | OTE | 2024 |
| Kanso 3 (CP1170) | OTE | 2023 |
| Nucleus 8 | BTE | 2022 |
| Kanso 2 | OTE | 2020 |
| Nucleus 7 | BTE | 2017 |
| Kanso (CP950) | OTE | 2016 |
| Nucleus 6 (CP910/CP920) | BTE | 2013 |
| Nucleus 5 (CP810) | BTE | 2010 |
| Freedom | BTE | 2005 |
| ESPrit 3G | BTE | 2002 |

### 6.3 Advanced Bionics

Implantate (16 Elektroden):

| Modell | Tech. Bez. | Jahr |
|---|---|---|
| HiRes Ultra 3D | CI-1601 | 2017 |
| HiRes Ultra | CI-1600 | 2013 |
| HiRes 90K Advantage | CI-1500 | 2013 |
| HiRes 90K | CI-1400 | 2003 |
| Clarion CII | AB-5100H | 2001 |
| Clarion 1.2 | AB-5100 | 1999 |
| Clarion 1.0 | MMT-5100 | 1996 |

Audio-Prozessoren:

| Modell | Form | Jahr |
|---|---|---|
| Naída CI M / Sky CI M | BTE | 2020 |
| Naída CI Q90 | BTE | 2016 |
| Naída CI Q70 | BTE | 2012 |
| Neptune | Body | 2011 |
| Harmony | BTE | 2007 |
| Auria | BTE | 2004 |
| Platinum Series | Body | 2000 |

---

## 7. Notwendige und optionale Eingaben im Tool

### 7.1 Pflichtangaben

- Hersteller (zwingend, immer bekannt)
- Implantat-Modell (oder "Unbekannt")

Bei Cochlear zusätzlich automatisch: Generations-Zuordnung A oder B
basierend auf dem gewählten Implantat-Modell.

### 7.2 Empfohlene Angaben

- Audio-Prozessor-Modell
- c-Wert (MED-EL)
- IIDR (Cochlear) bzw. IDR (AB)
- T-/THR-Werte pro Elektrode
- C-/MCL-/M-Werte pro Elektrode

### 7.3 Berechnungsfähigkeit nach Eingaben

| Eingaben | Was das Tool ausgeben kann |
|---|---|
| Nur ΔdB-Messung | Relative dB-Empfehlung pro Elektrode |
| + Hersteller, Modell | Schrittgröße zum dB ausrechnen |
| + MCL/M/C pro Elektrode | Absolute neue Werte (Weg A) |
| + IDR, c-Wert | Validierte Approximation mit Vorbehalten |

Das Tool zeigt im Ausdruck immer die dB-Empfehlung. Wenn die
Hersteller-Einheit-Werte nicht eingegeben sind, wird "N/A" für
den Absolutwert ausgegeben, mit Vermerk an den Audiologen, dem
Klienten die fehlenden Werte mitzuteilen.

---

## 8. Hinweise an den Audiologen (Ausdruck)

Der Tool-Ausdruck enthält folgende Hinweise:

1. Die Korrekturwerte sind Approximationen aus akustischen
   Lautstärkemessungen. Sie ersetzen keine direkte Stimulations-
   basierte Anpassung.

2. Empfohlene Vorgehensweise:
   - Tool-Werte als Startpunkt verwenden
   - Mit Balancing-Funktion gegen Nachbarelektroden prüfen
   - Patient bestätigt subjektive Gleichheit
   - Bei Diskrepanzen: Tool-Werten nicht folgen

3. Falls Werte fehlen (MCL, M, C, IDR): Bitte dem Klienten diese
   Werte für künftige Messungen mitteilen.

4. Bei Korrekturen über ±5 dB pro Elektrode:
   - Compliance-Grenzen prüfen (in MAESTRO/Custom Sound/SoundWave
     als Warnung sichtbar). Eine MCL/M/C-Anhebung über die
     Compliance hinaus wird vom Implantat begrenzt – der Patient
     hört trotz höherer Einstellung nichts Lauteres.
   - Loudness Growth Function kann für diese Elektrode flacher
     werden – Patient hört möglicherweise ein verändertes
     Lautheits-Empfinden.
   - Stimulations-basierte Verifikation ist zwingend, da die
     Approximation des Tools über ±5 dB hinaus an Genauigkeit
     verliert.

---

## 9. Quellenverzeichnis

### 9.1 MED-EL

- MED-EL (2025): MAESTRO 11 User Manual, AW44981_10.
- Boyd PJ (2006): "Effects of Programming Threshold and Maplaw
  Settings on Acoustic Thresholds and Speech Discrimination with
  the MED-EL COMBI 40+ Cochlear Implant", Ear and Hearing 27(6),
  608–618. DOI 10.1097/01.aud.0000240643.18581.f8

### 9.2 Cochlear

- Smith C, Shivdasani MN, Fallon JB et al. (2018): "Evaluation
  of focused multipolar stimulation for cochlear implants: a
  preclinical safety study", Trends in Hearing,
  PMC5681383.
- Galvin JJ, Fu QJ et al.: "Current-Level Discrimination in the
  Context of Interleaved, Multichannel Stimulation in Cochlear
  Implants", Ear & Hearing, PMC2430008.
- Bierer JA, Faulkner KF (2003): "Across-Site Variation in
  Detection Thresholds and Maximum Comfortable Loudness Levels
  for Cochlear Implants", JARO.
- Zhou N et al.: "Effect of Pulse Rate on Loudness Discrimination
  in Cochlear Implant Users", PMC5962473.
- Cosetti et al.: PMC7358003.

### 9.3 Advanced Bionics

- Holden LK, Reeder RM, Firszt JB, Finley CC (2011): "Optimizing
  the Perception of Soft Speech and Speech in Noise with the
  Advanced Bionics Cochlear Implant System", International
  Journal of Audiology 50(4), 255–269.
  DOI 10.3109/14992027.2010.533200
- Advanced Bionics: SoundWave 2.2 Quick Reference Guide.
- Advanced Bionics: SoundWave Kurzanleitungskarten.

### 9.4 Hersteller-übergreifend

- Vaerenberg B, Govaerts PJ, Stainsby T, Nopp P, Gault A, Gnansia
  D (2014): "A Uniform Graphical Representation of Intensity
  Coding in Current-Generation Cochlear Implant Systems", Ear &
  Hearing 35(5), 533–543. (Co-Autoren von Cochlear, MED-EL und
  AB; einzige Quelle mit direkter Hersteller-Bestätigung der
  jeweiligen Mapping-Funktionen.)

---

## 10. Versionierung

- Version 1.0: Erstfassung. Drei Hersteller, Weg A vollständig,
  Weg B nur AB. Modell-Listen Stand 2025.

Spätere Versionen sollten ergänzen:
- Detailliertere Behandlung der Loudness Growth Functions
- Q-Wert-Behandlung bei Cochlear
- Channel-Gain-Mechanik bei MED-EL und Cochlear
- Implantat-spezifische Compliance-Grenzen
