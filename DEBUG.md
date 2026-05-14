# Debug-Hilfe

Diese Datei beschreibt, wie der Nutzer (Martin) Fehler im Tool meldet
und wie er Diagnose-Hilfen von Claude umsetzt. Sie ist bewußt knapp,
damit sie als Spickzettel im Browser griffbereit bleibt.

## Browser-Konsole öffnen

- **Firefox / Chrome**: `F12` oder `Strg+Shift+I`
- Reiter **Console** (oder „Konsole") wählen
- Fehlermeldungen sind rot, Warnungen gelb

## Fehler an Claude weitergeben

- Rot markierten Text in der Konsole markieren, kopieren (`Strg+C`),
  in den Chat einfügen
- Bei langem Stack-Trace reichen die ersten 5–10 Zeilen plus die
  letzte Zeile mit der eigentlichen Fehlermeldung
- Wenn die Konsole mehrere unabhängige Fehler zeigt: alle mitschicken,
  Reihenfolge nicht ändern

## Network-Tab (Lade-Probleme)

- Reiter **Network** (oder „Netzwerk") öffnen
- Seite neu laden (`F5` oder `Strg+R`)
- Einträge mit rotem Status oder Status `404` / `500` deuten auf
  Lade-Fehler einer Datei hin
- Datei-Name + Status-Code an Claude schicken

## Screenshots

- `Druck`-Taste (ganzes Fenster), `Shift+Druck` (Bereich auswählen)
  oder Browser-Snipping-Tool
- In den Chat ziehen oder `Strg+V` einfügen
- Bei UI-Problemen sind Screenshots oft schneller als Beschreibungen

## Konsolen-Befehl ausführen (wenn Claude einen gibt)

Claude kann dir Diagnose-Einzeiler geben, etwa:
```js
console.log(JSON.stringify(sideData, null, 2))
```
Vorgehen:
- Konsole-Reiter öffnen (`F12`)
- Befehl in die Eingabezeile unten einfügen, `Enter` drücken
- Ausgabe markieren, kopieren, an Claude schicken
- Befehle sind ungefährlich, solange Claude sie für **Diagnose**
  ausgibt. Bei Befehlen, die etwas **verändern** würden (zum Beispiel
  Variablen-Zuweisungen), Claude vorher fragen, was sie bewirken.

## Bug-Report-Template

Wenn etwas nicht funktioniert wie erwartet, gib Claude diese Felder
mit. Nicht alle müssen ausgefüllt sein — je mehr, desto schneller die
Diagnose.

```
Wo:           Tab oder Sub-Tab und betroffenes Element
Aktion:       Was geklickt oder getippt wurde
Erwartet:     Was hätte passieren sollen
Tatsächlich:  Was passiert ist
Konsole:      Fehlermeldung aus dem Console-Tab (falls eine kam)
Browser:      Firefox X / Chrome Y (nur bei Anzeigeproblemen relevant)
```

## Akzeptanz-Checkliste (nach jedem Sonnet-Build)

Nach jedem Build liefert Claude (oder Sonnet) eine kurze Klick-für-
Klick-Checkliste mit erwartetem Verhalten. Diese Schritte einmal
durchgehen. Bei jedem Schritt:

- ✓ funktioniert wie beschrieben → weiter
- ✗ weicht ab → Punkt-Nummer und Abweichung an Claude melden,
  bevor weitergearbeitet wird

## Notfall-Backup und Wiederherstellung

- Vor jedem größeren Sonnet-Build: `git status` prüfen, gegebenenfalls
  einen Sicherungs-Commit machen
- Es existiert ein Verzeichnis `.backup/` im Projekt — falls dort
  Sicherungen liegen, kann Claude beim Wiederherstellen helfen
- Letzte Notbremsen: `git stash` (Änderungen zurücklegen) oder
  `git reset --hard HEAD` (alle uncommitteten Änderungen verwerfen).
  Vor diesen Schritten Rücksprache mit Claude — sie sind nicht
  rückgängig zu machen.
