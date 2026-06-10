# Bauanleitung 14: i18n-Cleanup — doppelte `sideLeft`/`sideRight` im FR-Block

Im französischen Sprachblock von `i18n.js` stehen `sideLeft` und
`sideRight` **doppelt**: einmal mit den englischen Werten
„LEFT"/„RIGHT" und einmal direkt danach mit den französischen
Werten „GAUCHE"/„DROITE". Da JS-Objekte bei doppelten Keys den
letzten gewinnen lassen, ist das funktional unauffällig — die
französische Anzeige stimmt. Aber der Code enthält tote Einträge,
die bei zukünftiger Wartung verwirren.

## Änderung

In `i18n.js`, **im FR-Block** (beginnt etwa bei Z. 946), aktuell
stehen die Zeilen 949–952 so:

```js
    sideLeft: "LEFT",
    sideRight: "RIGHT",
    sideLeft: "GAUCHE",
    sideRight: "DROITE",
```

Die ersten beiden Zeilen (`"LEFT"` und `"RIGHT"`) **entfernen**, so
daß nur noch die korrekten französischen Einträge übrigbleiben:

```js
    sideLeft: "GAUCHE",
    sideRight: "DROITE",
```

**Wichtig**:
- Nur diese zwei englischen Duplikat-Zeilen entfernen.
- Im EN-Block (Z. 480) und ES-Block (Z. 1406) stehen die
  Single-Einträge korrekt. Nicht anfassen.
- Im DE-Block (Z. 7) stehen die deutschen Einträge korrekt. Nicht
  anfassen.

## Nicht zu tun

- Keine Bauanleitung-08-Änderungen anfassen.
- Keine anderen i18n-Cleanups vornehmen, auch wenn weitere
  Duplikate oder Inkonsistenzen auffallen — separat melden, nicht
  inline mit erledigen.

## Akzeptanztest

1. Tool laden, Sprache auf **Français** stellen.
   - Erwartet: oben in der Side-Schalter-Leiste die Buttons
     zeigen „GAUCHE" und „DROITE" — wie vor dem Cleanup.

2. `grep -n "^    sideLeft:" i18n.js` ergibt **vier** Treffer (je
   einer pro DE/EN/FR/ES). Vor dem Cleanup waren es fünf.

3. `grep -n "^    sideRight:" i18n.js` ergibt **vier** Treffer.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| Im FR-Block stehen `sideLeft: "GAUCHE"` und `sideRight: "DROITE"` jeweils genau einmal | | |
| `sideLeft: "LEFT"` und `sideRight: "RIGHT"` sind aus dem FR-Block entfernt | | |
| EN/DE/ES-Blöcke unverändert | | |
| Keine andere Datei angefaßt | | |
