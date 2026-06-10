# Bauanleitung 45 — Player-EQ-Graph: aktive Seite bei „both"

## Worum es geht

Wenn im Player „Beide Seiten" (`plBothSides`) aktiv ist und nur eine
Seite ein CI ist (z.B. activeSide=`right`, links akustisch), bleibt der
Equalizer-Graph leer: Achsen + Beschriftungen erscheinen, aber keine
Balken. Ursache: `pDrawEQ` und `pBuildTbl` greifen bei
`getPlayerSide() === "both"` blind auf `gains.left` zu — und die linke
Seite hat keine Daten.

Gewünschtes Verhalten: bei „both" zeigt der Graph (und die
darunterstehende Werte-Tabelle) die **aktive Seite**. Audio bleibt
stereo wie bisher.

## Stelle 1 — `pDrawEQ` in `player.js`

In `player.js` aktuell ab Z. 719:

```js
let gains = getPlayerGains();
if (typeof gains.left !== "undefined") {
  gains = gains.left;
}
```

Ersetze diesen Block durch:

```js
let gains = getPlayerGains();
if (typeof gains.left !== "undefined") {
  gains = (activeSide === "right") ? gains.right : gains.left;
}
```

## Stelle 2 — `pBuildTbl` in `player.js`

In `player.js` aktuell ab Z. 805 (genau das gleiche Muster):

```js
let gains = getPlayerGains();
if (typeof gains.left !== "undefined") {
  gains = gains.left;
}
```

Ersetze durch:

```js
let gains = getPlayerGains();
if (typeof gains.left !== "undefined") {
  gains = (activeSide === "right") ? gains.right : gains.left;
}
```

## Stelle 3 — CODESTRUKTUR.md

Im Abschnitt **„Player Side-Modi"** (Datenfluss-Block) den Hinweis
ergänzen, dass `pDrawEQ` und `pBuildTbl` bei `getPlayerSide() === "both"`
die Anzeige der **aktiven Seite** zeichnen — Audio bleibt stereo,
aber der EQ-Graph und die Werte-Tabelle folgen `activeSide`. Begründung
hinzufügen: bei einseitigem CI wäre die andere Seite sonst leer.

## Akzeptanztest-Checkliste (manuell im Browser)

1. Tool laden. In den Implantat-Tab → links auf „Hörgerät" oder
   „Schwerhörig" stellen, rechts auf „CI" / MED-EL. (Falls schon so:
   gut.)
2. Im Kurven-Tab rechts zwei Kurvenfunktionen aktivieren mit Stärke
   != 0 (z.B. SCurve −2 dB, Gauss +4 dB).
3. Auf den Side-Button **„RECHTS"** klicken.
4. In den Player-Tab wechseln.
5. „Beide Seiten" ankreuzen.
6. Erwartet: der Equalizer-Graph zeigt grüne/rote Balken pro
   Elektrode entsprechend der Kurvenfunktionen. Die Werte-Tabelle
   darunter zeigt die gleichen Werte pro Elektrode.
7. Auf den Side-Button **„LINKS"** klicken.
8. Erwartet: Graph aktualisiert sich; zeigt jetzt die Werte der
   linken Seite (vermutlich alle 0, weil links keine Kurven).
9. Auf den Side-Button **„RECHTS"** zurück.
10. Erwartet: Balken sind wieder da.
11. „Beide Seiten" deaktivieren, anschließend wieder aktivieren —
    der Graph zeigt durchgehend die aktive Seite, nichts springt
    auf eine leere Anzeige.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar, mit Datei- und
Zeilenangabe.

Wenn ein Punkt unklar ist (z.B. „getPlayerSide() liefert manchmal
'mono' — soll der Code das auch behandeln?"), nicht still annehmen,
sondern als Rückfrage formulieren. `getPlayerSide() === "mono"`
liefert bereits ein Array (kein {left,right}-Objekt), daher trifft
die Korrektur diesen Fall nicht — das ist die korrekte Voraussetzung
und sollte in der Selbstprüfung kurz bestätigt werden.
