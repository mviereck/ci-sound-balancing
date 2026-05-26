# Archivierte Bau-Diagnose-Tests

Hier liegen Test-Definitionen, die während einer Bauanleitung
als Diagnose-Brücke zwischen Sonnet (kein Browser-Zugriff) und
Nutzer (Browser-Beobachtung) dienten und nach Abnahme der
jeweiligen Bauanleitung archiviert wurden.

**Diese Dateien werden vom Tool nicht geladen.** Sie liegen
hier ausschließlich als Nachschlagewerk, falls ein historischer
Diagnose-Test später noch einmal benötigt wird.

## Aufbau

Eine Datei pro archivierter Test:

```
archive/debug-tests/BAxx_<topic>.js
```

Inhalt: ein eigenständiger IIFE-Block im selben Format wie in
`js/debug-tests-current.js`, ergänzt um einen Kommentarkopf mit
Datum der Archivierung und Kurzbegründung.

## Reaktivierung

Bei Bedarf den Inhalt einer Archiv-Datei in
`js/debug-tests-current.js` zurückkopieren (eigener IIFE-Block).
Der Loader holt die Datei dann beim nächsten Reload mit. Die
Archiv-Datei selbst bleibt unverändert liegen.

## Aufräumen

Wenn eine archivierte Datei sicher nicht mehr gebraucht wird,
kann sie ersatzlos gelöscht werden. Git bewahrt den Inhalt in
der Historie auf.
