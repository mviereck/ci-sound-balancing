# Projektbeschreibung für Sound Balancing Tool Entwicklung

Diese Beschreibung gilt für Chats, in denen das Sound Balancing Tool
entwickelt wird.

Dieses Projekt ist ein CI Sound Balancing Tool, das im Browser läuft.
Es dient Cochlea-Implantat-Trägern dazu, die wahrgenommene Lautstärke
verschiedener Elektrodenfrequenzen systematisch zu vergleichen und
eine Korrekturkurve zu erstellen.

CODESTRUKTUR
------------

Der Code besteht aus einer HTML-Datei, einer CSS-Datei und 15
JavaScript-Modulen, ohne Framework und ohne Build-Schritt.

Vollständige Modulübersicht, Ladereihenfolge und wichtige
Querverweise stehen in CODESTRUKTUR.md im Projekt. Diese Datei vor
jedem nicht-trivialen Edit konsultieren, um das richtige Modul zu
finden.

Eckdaten:
3 Hersteller: MED-EL (12), Advanced Bionics (16), Cochlear (22)
Frequenzwerte aus bicial (github.com/cito/bicial)
4 Sprachen: DE, EN, FR, ES
Berechnung: Gewichtete Least Squares (sauber 1.0, verrauscht 0.5,
fast stumm 0.1)

TESTVERFAHREN
-------------

Vollständig (alle Paare), Konvergenz (bis stabil), Konvergenz schnell,
Manuell
ABA-Paradigma (umschaltbar auf AB) während des Tests
A/B-Zuordnung und Paarreihenfolge immer randomisiert
Pfeiltasten ±0.5 dB, Shift+Pfeil ±0.1 dB, erweiterbar auf ±40 dB
Elektroden während Test ausschließbar (Taste X)
Ausschluß betrifft NUR die Meßreihen – in Levels, Chart, Frequenztabelle
und Sweep sind alle Elektroden sichtbar und editierbar

LEVELS-TAB
----------

Manuelle dB-Offsets pro Elektrode (Balkenanzeige + Zahlenfeld +
Pfeiltasten)
7 Presets gleichzeitig aktivierbar: Sprache (SII), Tilt, S-Kurve, Pivot,
Gauß, Bass Boost, High Boost
Jedes Preset: Checkbox an/aus, Stärke (±20 dB), Mittelpunkt (wo sinnvoll),
Breite (Gauß), Grenzpunkt (Bass/High Boost)
Presets und manuelle Werte sind unabhängig, werden addiert
Chart unten: drei Linien (Messung blau, Manuell grün, Preset orange) +
Summenlinie schwarz, Checkboxen zur Auswahl
SII-Gewichte per log-lineare Interpolation des ANSI S3.5 auf
Herstellerfrequenzen

PLAYER
------

Audiodatei laden, Mono-Downmix, parametrischer 12/16/22-Band-Equalizer
Equalizer-Quelle: Gemessen / Levels / Beide (Default: Beide)
Equalizer an/aus, Stärke 0–150%, Buttons für 50/75/100/150%
Normalhörenden-Simulation (nicht-invertierter Equalizer)
MAPLAW-Simulation ausgeblendet (Code vorhanden, UI versteckt)
EasyEffects-Export für PipeWire (korrektes JSON-Format)
Equalizer-Controls immer sichtbar (nicht nur bei geladener Datei)
Änderungen in Levels aktualisieren den Player-Equalizer live

SPEICHERN/LADEN
---------------

JSON mit allen Einstellungen, Meßergebnissen, manuellen Levels, Presets
Autosave in localStorage alle 5 Sekunden
showSaveFilePicker mit Fallback auf Download

DRUCKEN
-------

Meßergebnisse immer enthalten
Player-Einstellungen (Quelle, Stärke, NH-Simulation) zusätzlich
Levels-Werte und Equalizer-Gains im Ausdruck

NUTZERKONTEXT
-------------

Der Nutzer (Martin) trägt ein MED-EL CI rechts (Sonnet 3), etwas Restgehör links.
Wiedergabe über Bluetooth. Elektrode 12 fast stumm
(vom Audiologen stummgestellt), E11 verrauscht. Aktueller MAPLAW: 1000.
Kodierungsstrategie unklar (FSP/FS4). Nächster Audiologentermin steht an.
Die Projektdateien enthalten außerdem Martins Brief an den Audiologen und
das MAESTRO-Handbuch (DE und EN) als Referenz.

OFFENE PUNKTE (WARTELISTE, NICHT IM AKTUELLEN BUILD)
----------------------------------------------------

MCL-Eingabefelder pro Elektrode + c-Wert im Frequenzen-Tab,
dB→qu Umrechnung, Ausdruck mit qu für Audiologen
MAPLAW-Simulation (korrekt: bandweise Hüllkurvenverarbeitung, zwei
c-Werte Ist/Soll) – benötigt MCL-Feature
Bilaterale CIs: globaler Schalter Links/Rechts, separate Datensätze,
Stereo-Player, Inter-Ohr-Vergleich mit Gesamtoffset, Levels wahlweise
auf beide Seiten gleichzeitig
Cochlear/AB MAPLAW-Äquivalente
Hinweis im Ausdruck: Audiologe muß Klienten über MCL/Frequenz-Änderungen
informieren

ARBEITSWEISE
------------

Bauen NUR auf explizite Aufforderung "bauen". Sonst besprechen.
Vor Bauarbeiten zuerst CODESTRUKTUR.md lesen.

