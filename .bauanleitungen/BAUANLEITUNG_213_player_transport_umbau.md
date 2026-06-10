# BAUANLEITUNG 213 — Player-Transport: Layout + Tab-Sperre + Warp-Cancel

Vier unabhängige Verbesserungen am Player-Reiter:
1. Loop-Button erhält Text „Loop"
2. Platzhalter-Button „Zufall" (🎲) in Transportzeile einfügen (JS-Logik folgt in BA 214)
3. Auto-Weiter-Button in die Transportzeile verschieben
4. Anzeige-Box (Stückinformationen) über die Pausenzeile verschieben
5. Player-Tab-Sperre vollständig aufheben
6. Warp-Berechnung stoppt, wenn Toggle während laufender Berechnung deaktiviert wird

Nach BA 213 ist der Shuffle-Button sichtbar, aber noch nicht funktional (kein Click-Handler).
JS-Logik + i18n + Click-Handler kommen in BA 214.

Zielversion: `3.2.213-beta`

---

## Schritt 1 — version.js

```js
const APP_VERSION = "3.2.213-beta";
```

---

## Schritt 2 — index.html: Transportzeile umbauen

Alle Änderungen liegen innerhalb des Blocks `<!-- Transport-Leiste -->` sowie im umgebenden Player-Bereich.

### 2a) Loop-Button: breiter machen, Text „Loop" hinzufügen

**Vorher:**
```html
            <button class="btn pl-trans-btn" id="plLoopBtn" type="button"
                    title="" data-tip="plTipLoop"
                    style="width:40px;height:40px;border-radius:50%;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0">
              &#128257;
            </button>
```

**Nachher:**
```html
            <button class="btn pl-trans-btn" id="plLoopBtn" type="button"
                    title="" data-tip="plTipLoop"
                    style="height:40px;border-radius:6px;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0 10px;gap:5px">
              &#128257; Loop
            </button>
```

### 2b) Shuffle-Button nach plLoopBtn einfügen

Direkt nach dem Loop-Button, noch vor dem Timeline-div:
```html
            <button class="btn pl-trans-btn" id="plShuffleBtn" type="button"
                    title="" data-tip="plTipShuffle"
                    style="width:40px;height:40px;border-radius:50%;font-size:1.1em;display:flex;align-items:center;justify-content:center;padding:0">
              &#127922;
            </button>
```

`data-tip="plTipShuffle"` ist der i18n-Key, der in BA 214 befüllt wird.
Bis BA 214 gebaut ist, bleibt der Tooltip leer — das ist kein Fehler.

### 2c) Auto-Weiter-Button in die Transportzeile verschieben

Den `plAutoAdvBtn` **aus** `plAutoAdvanceRow` (weiter unten im Dokument) **ausschneiden** und direkt nach dem Shuffle-Button, noch vor dem Timeline-div, einfügen:

```html
            <button class="btn pl-trans-btn" id="plAutoAdvBtn" type="button"
                    title="" data-tip="plTipAutoAdv"
                    style="height:40px;min-width:140px;font-weight:600;border-radius:6px">
              <span data-t="plAutoAdvLabel"></span>
            </button>
```

Reihenfolge in der Transportzeile danach:
`plPrev | plPlayWrap | plStop | plNext | plLoopBtn | plShuffleBtn | plAutoAdvBtn | Timeline-div | Mono-span`

### 2d) plAutoAdvanceRow: Auto-Weiter-Button entfernen

In `plAutoAdvanceRow` nur den `plAutoAdvBtn` entfernen. Das `control-group`-div mit Pause-Label und Pause-Buttons bleibt vollständig erhalten.

**Vorher (plAutoAdvanceRow komplett):**
```html
          <div id="plAutoAdvanceRow" class="controls-row"
               style="align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap">
            <button class="btn pl-trans-btn" id="plAutoAdvBtn" type="button"
                    title="" data-tip="plTipAutoAdv"
                    style="min-width:140px; font-weight:600; border-radius:6px">
              <span data-t="plAutoAdvLabel"></span>
            </button>
            <div class="control-group" style="flex-wrap:wrap; gap:4px">
              <label data-t="plPauseLabel" style="margin-right:4px"></label>
              <div id="plPauseBtns" ...>
                ...
              </div>
              <span ...>ms</span>
            </div>
          </div>
```

**Nachher (nur Pause-Zeile):**
```html
          <div id="plAutoAdvanceRow" class="controls-row"
               style="align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap">
            <div class="control-group" style="flex-wrap:wrap; gap:4px">
              <label data-t="plPauseLabel" style="margin-right:4px"></label>
              <div id="plPauseBtns" ...>
                ...
              </div>
              <span ...>ms</span>
            </div>
          </div>
```

### 2e) Anzeige-Box vor die Pause-Zeile verschieben

Aktuell steht `<!-- Anzeige-Block -->` (`id="plDisplayBox"`) nach der Lautstärke-Zeile.
Den gesamten Block ausschneiden und **direkt vor** `plAutoAdvanceRow` einfügen.

Neue Block-Reihenfolge:
1. `plTransport` (Transport-Leiste)
2. `plWarpProgressRow` (Warp-Fortschrittsbalken)
3. `plDisplayBox` (Anzeige-Block) ← hierher verschoben
4. `plAutoAdvanceRow` (Pauseneinstellungen)
5. Lautstärke-Zeile

---

## Schritt 3 — tabs-eq.js: Player-Tab entsperren

In `js/tabs-eq.js`, Zeile 72:

**Vorher:**
```js
const LOCKED_TABS_L1 = ["messungen", "ergebnisse", "levels", "schieber", "player"];
```

**Nachher:**
```js
const LOCKED_TABS_L1 = ["messungen", "ergebnisse", "levels", "schieber"];
```

---

## Schritt 4 — init.js: Warp-Cancel bei laufender Berechnung

In `js/init.js`, den bestehenden `plWarpOn`-Click-Handler (Grep: `getElementById("plWarpOn").addEventListener`).

**Vorher:**
```js
  document.getElementById("plWarpOn").addEventListener("click", function () {
    pWarpOn = !pWarpOn;
    pWarpUpdUI();
    if (pWarpOn && !pWarpedBuf) {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
    else if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
```

**Nachher:**
```js
  document.getElementById("plWarpOn").addEventListener("click", function () {
    pWarpOn = !pWarpOn;
    // Wenn Warp deaktiviert wird waehrend Berechnung laeuft: abbrechen.
    // pWarpTrigger() uebernimmt danach (pBuf, pPlay, UI-Update).
    if (!pWarpOn && typeof pWarpBusy !== "undefined" && pWarpBusy) {
      if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    pWarpUpdUI();
    if (pWarpOn && !pWarpedBuf) {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
    else if (typeof pBuildEQ === "function") pBuildEQ();
    if (typeof drawLvChart === "function") drawLvChart();
    if (typeof pDrawEQ === "function") pDrawEQ();
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
  });
```

---

## Schritt 5 — freq-warp.js: nach User-Cancel ungewarpt weiterspielen

In `js/freq-warp.js`, in `pWarpTrigger()`, den Abschnitt nach `if (myGen !== pWarpGen) return;`.

**Vorher (ca. Z. 818):**
```js
  pWarpCancel = false;

  if (cancelled) {
    pWarpOn = false;
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
  }

  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying && pWarpOn) pPlay();
```

**Nachher:**
```js
  pWarpCancel = false;

  if (cancelled) {
    // Interner Cancel (neuer Trigger) wird nie hierher kommen —
    // myGen !== pWarpGen hat schon returniert.
    // Hier ist es also immer ein User-Cancel: pWarpOn ist bereits false
    // (vom Click-Handler gesetzt). Nur DOM-Sync noetig.
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();  // ungewarpt weiterspielen
    return;
  }

  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying && pWarpOn) pPlay();
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Punkt durchgehen — **erfüllt / nicht erfüllt / unklar** mit Datei + Zeile:

1. `version.js`: `APP_VERSION === "3.2.213-beta"`?
2. `index.html` `plLoopBtn`: `border-radius:6px` (nicht 50%), Text „&#128257; Loop" im Inhalt?
3. `index.html` `plShuffleBtn`: existiert, steht innerhalb `plTransport` nach `plLoopBtn`, vor Timeline-div?
4. `index.html` `plAutoAdvBtn`: steht jetzt in `plTransport`, nicht mehr in `plAutoAdvanceRow`?
5. `index.html` `plAutoAdvanceRow`: enthält nur noch Pause-`control-group`, keinen `plAutoAdvBtn`?
6. `index.html` `plDisplayBox`: steht **vor** `plAutoAdvanceRow`, **nach** `plWarpProgressRow`?
7. `tabs-eq.js` `LOCKED_TABS_L1`: enthält `"player"` nicht mehr?
8. `init.js` `plWarpOn`-Handler: Cancel-Zweig prüft `pWarpBusy`, setzt `pWarpCancelCompute()` und returniert?
9. `freq-warp.js` `if (cancelled)`: Block endet mit `return`, `pPlay()` wird **ohne** `pWarpOn`-Guard aufgerufen?

---

## Akzeptanztest-Checkliste

### A) Player-Tab-Sperre
1. Reiter „Implantat" öffnen, CI-Konfiguration löschen (beide Seiten auf „unbekannt").
2. Player-Tab anklicken → **erwartet: Tab öffnet sich** (kein Sperr-Modal mehr).

### B) Transportzeile
3. Player-Tab öffnen, Transportzeile anschauen.
4. Loop-Button: **erwartet: Symbol + Text „Loop"**, breiter als die runden Buttons.
5. Direkt nach Loop: **erwartet: Würfel-Button (🎲)**, rund, grau (noch nicht aktiv).
6. Direkt nach Würfel: **erwartet: „↪ Auto-Weiter"-Button** in der Transportzeile.
7. Würfel-Button klicken → **erwartet: vorerst keine sichtbare Reaktion** (JS-Logik folgt in BA 214).

### C) Anzeige-Box und Pausenzeile
8. Geräusch laden und abspielen.
9. **erwartet: Anzeige-Box mit Stückinformationen steht ÜBER der Pausenzeile** (Pause-Buttons sind weiter unten).

### D) Warp-Cancel
10. Musikdatei laden. Warp-Toggle aktivieren → Fortschrittsbalken erscheint, Berechnung läuft.
11. Während Berechnung läuft: Warp-Toggle erneut klicken (deaktivieren).
12. **erwartet: Fortschrittsbalken verschwindet, Wiedergabe läuft ungewarpt weiter**
    (oder startet, wenn sie vor dem Warp-Aktivieren lief).
