# CI Sound Balancing Tool – Funktionsspezifikation

Vollständige Beschreibung des Funktionsumfangs. CLAUDE.md verweist
auf diese Datei und enthält selbst nur den knappen Projektkontext und
Verhaltensregeln für die Zusammenarbeit. Implementations- und
Modulübersicht steht in CODESTRUKTUR.md.

> **Wartung dieser Datei**: bei jeder Funktionsänderung mit
> aktualisieren. Aktualisierung gehört in denselben Arbeitsschritt
> wie die Code-Änderung, nicht nachträglich.
>
> Die Spec liegt aufgeteilt in **diesem Index** plus neun
> thematischen Kapiteln unter `spec/`. Bei Arbeiten an einem
> konkreten Bereich nur das passende Kapitel lesen, nicht die
> ganze Spec.

## Eckdaten

- **3 Hersteller**: MED-EL (12 Elektroden), Advanced Bionics (16),
  Cochlear (22)
- **Frequenzwerte** aus bicial (github.com/cito/bicial)
- **4 Sprachen**: DE, EN, FR, ES
- **Korrekturkurven-Berechnung**: Gewichtete Least Squares (sauber
  1.0, verrauscht 0.5, fast stumm 0.1)
- **Mobile-Verhalten**: auf reinen Touch-Geräten sind alle
  Number-Inputs read-only — Werte werden ausschließlich über die
  sichtbaren Touch-Buttons (− / + / Fein) geändert. Auf Desktop und
  Tablet-mit-Tastatur unverändert tippbar.
- **Bilateral**: separate Datensätze pro Seite (Implantat-
  Konfiguration, Messungen, Levels, Presets, MCL/THR). Side-
  Buttons LINKS/RECHTS oben im UI schalten zwischen den beiden
  Datensätzen um. Jede Seite kann eine eigene Konfiguration haben
  (CI, Hörgerät, Normal, Schwerhörig, Taub). Frequenzraster wird
  von einer CI-Seite auf eine akustische Seite gespiegelt.

## Anzeige-Konvention

Alle drei Ergebnis-Sub-Reiter zeigen *alle* Elektroden. Deaktivierte
oder stumm-geschaltete Elektroden werden im Diagramm als hellgrauer
Balken über die volle Y-Achsen-Höhe mit dunkelgrauem „X" Ecke-zu-Ecke
dargestellt; in Tabellen erscheinen die Wertespalten als „—" und die
Status-Spalte zeigt „deaktiviert/ausgelassen". Aktive, aber noch nicht
gemessene Elektroden bekommen ihren eigenen Marker (siehe Bauanleitung
02 für Stereo-Balance und Frequenzabgleich).

## Kapitel

- [Tab-Übersicht](spec/01-tabs.md)
- [Messungen — Sub-Tabs](spec/02-messung.md)
- [Implantat-Tab](spec/03-implantat.md)
- [Schieber-Tab](spec/04-schieber.md)
- [Kurven-Tab](spec/05-kurven.md)
- [Player](spec/06-player.md)
- [Speichern und Laden](spec/07-laden-speichern.md)
- [Drucken](spec/08-drucken.md)
- [Offene Punkte (Warteliste)](spec/09-warteliste.md)
