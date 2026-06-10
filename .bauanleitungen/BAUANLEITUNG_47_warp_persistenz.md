# Bauanleitung 47 — Frequenz-Warping: Zustand vollständig persistieren

## Worum es geht

Der „Frequenz-Warping"-Button im Player wird derzeit nach Reload nie
als „an" wiederhergestellt:

- **localStorage-Autosave** (`init.js`, 5-Sekunden-Intervall ab Z. 656)
  speichert `pWarpOn` und die zugehörigen Felder gar nicht.
- **JSON-Save** (`file.js` Z. 129–132) speichert `warpOn`/`warpMode`/
  `warpStrength`/`warpMethod` zwar.
- **JSON-Load** (`file.js` Z. 401–404) setzt aber bewußt
  `pWarpOn = false` zurück, mit Kommentar „Warp beim Laden immer
  deaktiviert starten". Diese Absicht wird zurückgenommen — Wunsch:
  alles persistieren und beim Laden wiederherstellen.

Ziel: nach Browser-Reload oder JSON-Load erscheint der Warp-Button im
selben Zustand wie beim Speichern, mit derselben Methode, demselben
Mode und derselben Stärke. UI-Sync per `pWarpUpdUI()` und ggf.
`pWarpTrigger()` (Worklet/Buffer wird bei Bedarf neu aufgebaut, wenn
ein Audio-Puffer geladen ist).

## Stelle 1 — `file.js` JSON-Load: kein Force-Off mehr

In `file.js` aktuell ab Z. 400:

```js
  // Warp-Einstellungen laden (Buffer wird nicht gespeichert – neu berechnen bei Bedarf)
  if (typeof pWarpOn !== "undefined") {
    if (d.warpOn !== undefined) {
      pWarpOn = false; // Warp beim Laden immer deaktiviert starten
    }
    if (d.warpMode !== undefined) pWarpMode = d.warpMode;
    if (d.warpStrength !== undefined) {
      pWarpStrength = d.warpStrength;
      const ws = document.getElementById("plWarpStr");
      if (ws) ws.value = pWarpStrength;
    }
    if (d.warpMethod !== undefined && typeof pWarpMethod !== "undefined") {
      pWarpMethod = d.warpMethod;
      const methodSel = document.getElementById("plWarpMethod");
      if (methodSel) methodSel.value = pWarpMethod;
    }
    const warpCb = document.getElementById("plWarpOn");
    if (warpCb) warpCb.checked = false;
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
```

Ersetzen durch:

```js
  // Warp-Einstellungen laden (Buffer wird nicht gespeichert – neu berechnen bei Bedarf)
  if (typeof pWarpOn !== "undefined") {
    if (typeof d.warpOn === "boolean") pWarpOn = d.warpOn;
    if (d.warpMode !== undefined) pWarpMode = d.warpMode;
    if (d.warpStrength !== undefined) {
      pWarpStrength = d.warpStrength;
      const ws = document.getElementById("plWarpStr");
      if (ws) ws.value = pWarpStrength;
    }
    if (d.warpMethod !== undefined && typeof pWarpMethod !== "undefined") {
      pWarpMethod = d.warpMethod;
      const methodSel = document.getElementById("plWarpMethod");
      if (methodSel) methodSel.value = pWarpMethod;
    }
    const modeSel = document.getElementById("plWarpModeSelect");
    if (modeSel) modeSel.value = pWarpMode;
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
```

Wichtig: die Zeile `if (warpCb) warpCb.checked = false;` ist
ersatzlos entfernt (alte Checkbox existiert nicht mehr, und der Reset
wäre falsch). `pWarpUpdUI()` synchronisiert Knopf-Beschriftung und
Sichtbarkeit des Einstellungs-Boxes selbst.

## Stelle 2 — `init.js` localStorage-Restore: Warp-Werte lesen

In `init.js` im Restore-Block (aktuell Z. 532–614, innerhalb des
`try`-Blocks nach `localStorage.getItem("ci-lb-v4")`). Direkt **nach**
dem Block für `playerShowExperimental` (Z. 575–576) — also vor den
`if (d.lrResults …)`-Block (Z. 579) — einfügen:

```js
      // Warp-Zustand wiederherstellen
      if (typeof pWarpOn !== "undefined") {
        if (typeof d.pWarpOn === "boolean") pWarpOn = d.pWarpOn;
        if (typeof d.pWarpMethod === "string") {
          pWarpMethod = d.pWarpMethod;
          const sel = document.getElementById("plWarpMethod");
          if (sel) sel.value = pWarpMethod;
        }
        if (typeof d.pWarpMode === "string") {
          pWarpMode = d.pWarpMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
        if (typeof d.pWarpStrength === "number") {
          pWarpStrength = d.pWarpStrength;
          const ws = document.getElementById("plWarpStr");
          if (ws) ws.value = pWarpStrength;
        }
        if (typeof pWarpUpdUI === "function") pWarpUpdUI();
      }
```

## Stelle 3 — `init.js` localStorage-Autosave: Warp-Werte schreiben

In `init.js` im `setInterval`-Autosave (aktuell ab Z. 656), innerhalb
des `JSON.stringify({...})`-Objekts. Direkt **nach** dem
`playerShowExperimental:`-Feld (Z. 712) einfügen:

```js
          pWarpOn:       (typeof pWarpOn       !== "undefined") ? pWarpOn       : false,
          pWarpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "sinmodel",
          pWarpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "var_side",
          pWarpStrength: (typeof pWarpStrength !== "undefined") ? pWarpStrength : 100,
```

(Genau diese vier Zeilen; das Komma am Ende von `playerShowExperimental`
bleibt unverändert.)

## Stelle 4 — SPEC.md

Im Abschnitt zur Player-Persistenz festhalten: der Frequenz-Warping-
Zustand (`pWarpOn`, `pWarpMethod`, `pWarpMode`, `pWarpStrength`) wird
in localStorage und in JSON-Save gespeichert und beim Laden
wiederhergestellt. Beim Laden wird `pWarpedBuf` ungültig gemacht und
auf Anforderung neu gerechnet (kein Audio-Buffer-Cache im Save).

## Stelle 5 — CODESTRUKTUR.md

Im Abschnitt **„Player-Quellen-Toggles"** bzw. **„Player Side-Modi"**
(Datenfluss-Block) den Hinweis ergänzen, dass der Warp-Zustand
genauso wie MAPLAW über localStorage (`pWarpOn`/`pWarpMethod`/
`pWarpMode`/`pWarpStrength`) und JSON (`warpOn`/`warpMethod`/
`warpMode`/`warpStrength`) persistiert wird. Erwähnen, dass der
JSON-Load-Pfad in `file.js` das frühere bewusste Force-Off entfernt
hat.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — localStorage-Persistenz nach Reload

1. Tool laden. In den Player-Tab gehen.
2. „Frequenz-Warping" einschalten. Methode z.B. „Sinusoidal
   Modeling" wählen, Mode „Var-Seite", Stärke 75 %.
3. Mindestens 6 Sekunden warten (Autosave-Intervall).
4. Browser-Tab neu laden (Strg-R).
5. In den Player-Tab gehen. Erwartet:
   - Der „Frequenz-Warping"-Knopf zeigt **„an"** (grüne Färbung).
   - Methode-Dropdown steht auf „Sinusoidal Modeling".
   - Mode-Dropdown auf „Var-Seite".
   - Stärke-Feld zeigt **75**.
6. Audio-Datei laden und Wiedergabe starten — Warping ist tatsächlich
   aktiv (Hörtest, oder Konsole: `pWarpOn === true` und
   `pWarpedBuf !== null` während Wiedergabe).

### Test B — JSON-Round-Trip

1. Player → Frequenz-Warping einschalten, Werte wie oben setzen.
2. Laden/Speichern-Tab → „Daten speichern" → JSON-Datei abspeichern.
3. „Daten löschen" oder Reset, dann
4. „Daten laden" → die eben gespeicherte JSON-Datei laden.
5. Erwartet: Warp-Knopf, Methode, Mode, Stärke alle wie vor dem
   Speichern.

### Test C — Sauberkeit

1. Mit Warp **aus** starten. Reload. Erwartet: Warp bleibt aus,
   Methode/Mode/Stärke aus dem letzten Stand (nicht zurückgesetzt
   auf Default).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar, mit Datei- und
Zeilenangabe.

Insbesondere:
- Wird `pWarpUpdUI()` nach dem Setzen der Variablen aufgerufen,
  damit der Knopf-Zustand und das Einstellungs-Feld sichtbar
  synchronisiert sind?
- Ist `pWarpedBuf = null` beim JSON-Load weiterhin gesetzt
  (Buffer wird bei Bedarf neu berechnet)?
- Wird das `pWarpOn = false`-Force-Off in `file.js` wirklich
  vollständig entfernt? (Auch keine versteckten Aufrufe wie
  `warpCb.checked = false`.)

Bei Unklarheit Rückfrage statt Annahme.
