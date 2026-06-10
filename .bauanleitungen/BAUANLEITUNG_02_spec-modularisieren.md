# BAUANLEITUNG 02 — SPEC.md in Index + 9 Kapitel aufteilen

## Ziel

SPEC.md (745 Zeilen, 40 KB) wird zerlegt in einen schlanken
**Index** und neun thematische Kapitel-Dateien unter `spec/`.
Beim Arbeiten an einem konkreten Bereich (z.B. Player) liest
Sonnet künftig nur das passende Kapitel, statt die ganze Spec
zu laden. Spart bei jedem Bau-Chat erheblich Token.

Inhaltlich ändert sich **nichts**. Reine Verschiebung.

## Vorab lesen

- **Diese Bauanleitung** komplett.
- **`SPEC.md`** im Repo-Root — komplett, weil du daraus
  herausschneidest. Es ist das einzige Mal, daß du sie ganz
  brauchst.
- **`CLAUDE.md`** den Abschnitt "Referenzdateien" (etwa Z. 12–35),
  weil du dort den SPEC-Verweis anpassen mußt.

## Vorgehen

### Schritt 1 — Verzeichnis `spec/` anlegen

Im Repo-Root neben SPEC.md.

### Schritt 2 — Neun Kapitel-Dateien erzeugen

Folgende Bereiche der heutigen SPEC.md werden jeweils als
**eigene Datei** in `spec/` angelegt. Inhalt jeweils **1:1**
herauskopieren — keine Umformulierung, keine Sortierung ändern,
keine Korrekturen.

| Datei                           | Quelle (Zeilen) | Hauptüberschrift in der Quelle |
|---------------------------------|-----------------|-------------------------------|
| `spec/01-tabs.md`               | Z. 31–52        | `## Tab-Übersicht`            |
| `spec/02-messung.md`            | Z. 54–188       | `## Messungen — drei Sub-Tabs` |
| `spec/03-implantat.md`          | Z. 200–234      | `## Implantat-Tab`            |
| `spec/04-schieber.md`           | Z. 236–350      | `## Schieber-Tab`             |
| `spec/05-kurven.md`             | Z. 352–383      | `## Kurven-Tab`               |
| `spec/06-player.md`             | Z. 385–593      | `## Player`                   |
| `spec/07-laden-speichern.md`    | Z. 595–605      | `## Speichern und Laden`      |
| `spec/08-drucken.md`            | Z. 607–726      | `## Drucken`                  |
| `spec/09-warteliste.md`         | Z. 728–745      | `## Offene Punkte (Warteliste, nicht im aktuellen Build)` |

Jede Kapitel-Datei beginnt mit ihrer **bisherigen** `##`-Überschrift
aus SPEC.md (nicht durch eine neue ersetzen, nicht zu `#`
hochstufen). Sub-Überschriften `###` aus der Quelle bleiben
unverändert mitgenommen.

**Hinweis zu spec/02-messung.md:** Die Überschrift in der
Quelle lautet "Messungen — drei Sub-Tabs", obwohl unter ihr
tatsächlich **vier** Sub-Tabs beschrieben werden (Sub-Tab 4 ist
"Latenz"). Diese Diskrepanz **nicht** korrigieren — sie wird
1:1 mitgenommen. Es ist eine bestehende Inkonsistenz der Spec,
die wir hier nicht im Rahmen einer reinen Verschiebung anfassen.

### Schritt 3 — SPEC.md durch Index ersetzen

Die heutige SPEC.md wird komplett ersetzt durch folgenden Inhalt:

```markdown
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
```

Wichtig: **Eckdaten** und **Anzeige-Konvention** bleiben in
SPEC.md, weil sie kurz und übergreifend sind. Alles andere ist
ausgelagert.

### Schritt 4 — CLAUDE.md anpassen

Im Abschnitt "Referenzdateien" von CLAUDE.md den Eintrag zu
SPEC.md so umformulieren, daß die neue Struktur sichtbar ist.

**Vorher** (ungefähr, exakter Wortlaut in der Datei):

```
- **SPEC.md** — vollständige Funktionsspezifikation (Tabs, Tests,
  Levels, Player, Speichern, Drucken, Warteliste). Bei Fragen zum
  Funktionsumfang dorthin.
```

**Nachher**:

```
- **SPEC.md + spec/** — Funktionsspezifikation. SPEC.md ist
  ein schlanker Index mit Eckdaten, Anzeige-Konvention und
  Verweisen auf neun Kapitel unter `spec/` (Tabs, Messungen,
  Implantat, Schieber, Kurven, Player, Laden/Speichern, Drucken,
  Warteliste). **Bei Arbeiten an einem konkreten Bereich nur
  das passende Kapitel aus spec/ lesen, nicht die ganze Spec.**
```

Sonst nichts an CLAUDE.md verändern.

## Was du NICHT tust

- Du **änderst keinen** Spec-Inhalt. Keine Tippfehler-Korrekturen,
  keine Umformulierungen, keine "Aufräum"-Aktionen.
- Du **erfindest keine** neuen Kapitel.
- Du **bewegst keine** Inhalte zwischen Kapiteln (auch wenn etwas
  thematisch passender erscheint — das wäre eine eigene Aktion,
  nicht Teil dieser Verschiebung).
- Du **rührst nicht** `CODESTRUKTUR.md`, `DEBUG.md`, `IDEEN.md`,
  `Berechnungsgrundlagen dB zu CI.md` oder irgendeine `.js`-/
  `.html`-Datei an.

## Akzeptanztest (für den Nutzer, ohne Code-Kenntnisse)

1. **Im Editor öffnen**: SPEC.md im Repo-Root → erwartet:
   kurz, mit den Sektionen *Eckdaten*, *Anzeige-Konvention* und
   einer *Kapitel*-Liste mit klickbaren Links.
2. **Im Editor öffnen**: Ordner `spec/` → erwartet: genau neun
   Dateien `01-tabs.md` bis `09-warteliste.md`.
3. **Stichprobe Inhalt**: `spec/06-player.md` öffnen → erwartet:
   beginnt mit `## Player` und enthält den vollständigen Player-
   Block (Aufbau-Karten, Side-Modi, MAPLAW, Warping, Sätze-
   Wiedergabe, lokale Audio-Ordner). Länge sollte ~210 Zeilen
   sein.
4. **Klick-Test in einem Markdown-Viewer**: Links in SPEC.md
   anklicken → führen jeweils zur richtigen Kapitel-Datei.
5. **CLAUDE.md öffnen** → Abschnitt "Referenzdateien" erwähnt
   jetzt SPEC.md + spec/ und enthält die Anweisung, nur das
   passende Kapitel zu lesen.

## Selbstprüfung vor der Fertig-Meldung

Gehe jeden Punkt einzeln durch und melde *erfüllt / nicht
erfüllt / unklar*, jeweils mit Datei- und Zeilenangabe der
relevanten Stelle.

1. Ordner `spec/` existiert.
2. Genau **neun** Dateien in `spec/`, exakte Namen wie in der
   Tabelle in Schritt 2.
3. Jede Kapitel-Datei beginnt mit ihrer ursprünglichen
   `##`-Überschrift aus der alten SPEC.md.
4. **Diff-Check**: Wenn du die neuen Dateien zusammenmischst
   (Index + neun Kapitel in passender Reihenfolge), entspricht
   das Ergebnis inhaltlich der alten SPEC.md (vor Schritt 3).
   Erlaubte Abweichungen: die zusätzliche Zeile im Wartungs-
   Hinweis, die auf die Kapitel-Struktur verweist, und der
   neue `## Kapitel`-Abschnitt. Keine Änderung an den Text-
   Inhalten der Kapitel.
5. Die neue SPEC.md ist deutlich kürzer als vorher (Größenordnung
   ~50–70 Zeilen statt 745).
6. CLAUDE.md verweist auf die neue Struktur (siehe Schritt 4).
7. Keine `.js`/`.html`/`.css`-Datei wurde verändert (Diff-Check).

Wenn ein Punkt **unklar** ist (z.B. Grenzlinie zwischen zwei
Kapiteln nicht eindeutig), **frage beim Nutzer nach**, bevor du
fertig meldest. Stille Annahmen sind in diesem Projekt teurer
als Rückfragen.
