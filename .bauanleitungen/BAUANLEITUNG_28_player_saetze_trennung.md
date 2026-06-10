# BAUANLEITUNG 28 — Player und Sätze: Buffer-Trennung (Bugfix)

## Problem

Aktuell teilen sich die geladene Audiodatei (Audioplayer) und die
Satz-Wiedergabe (Sprachspieler) eine einzige globale Buffer-Variable
`pSourceBuf`. Sobald `sPlayCurrent` (sentences.js) einen Satz lädt,
überschreibt es `pSourceBuf` — und damit ist die Datei-Auswahl
weg. Klick auf den **Audioplayer-Play-Button** spielt dann den
zuletzt geladenen Satz, nicht die Datei.

## Ziel

- **`pFileBuf`** = Audiodatei (überlebt Satz-Wiedergabe)
- **`sSentenceBuf`** = aktueller Satz (überlebt nicht zwingend)
- **`pPlaybackMode`** = `"file"` | `"sentence"` — entscheidet, was
  beim nächsten `pPlay()` läuft
- **Klick auf Audio-Play startet immer die Datei**, auch wenn vorher
  Sätze liefen — und zwar in einem Klick, nicht zwei.

EQ, MAPLAW, Warping, Lautstärke, Latenz-Kette bleiben gemeinsam —
es wird nur der Buffer-Slot getrennt, nicht der Audio-Graph.

## Dateien

- `player.js`
- `sentences.js`
- `CODESTRUKTUR.md` (Zeilen player.js und sentences.js anpassen)
- `SPEC.md` (Player-Card-Beschreibung anpassen)

---

## Schritt 1 — player.js: neue Variablen + Modus-Setter

### 1a) Variablen-Block oben in `player.js` (Z. 4–26)

**Vor:**
```js
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pMonoBuf = null,
  ...
```

**Nach:** zwei neue Vars dazwischen:
```js
let pCtx = null,
  pBuf = null,
  pSourceBuf = null,
  pFileBuf = null,          // Audiodatei-Buffer (überlebt Sätze-Wiedergabe)
  pPlaybackMode = "file",   // "file" | "sentence" — Aktiver Buffer-Slot
  pMonoBuf = null,
  ...
```

Rest unverändert.

### 1b) Neue Funktion `pSetPlaybackMode` direkt vor `getPlaybackBuffer` einfügen

```js
// Setzt den aktiven Buffer-Slot. "file" → pSourceBuf = pFileBuf,
// "sentence" → pSourceBuf = sSentenceBuf. Invalidiert abgeleitete Buffer
// (mono/left/right/warped) und ruft pBuildEQ neu auf, damit der Audio-Graph
// auf den neuen Buffer reagiert (z.B. Stereo/Mono-Umschaltung).
function pSetPlaybackMode(mode) {
  if (mode !== "file" && mode !== "sentence") return;
  pPlaybackMode = mode;
  if (mode === "file") {
    pSourceBuf = pFileBuf;
  } else {
    pSourceBuf = (typeof sSentenceBuf !== "undefined") ? sSentenceBuf : null;
  }
  pMonoBuf = null;
  pLeftOnlyBuf = null;
  pRightOnlyBuf = null;
  if (typeof pWarpedBuf !== "undefined") {
    pWarpedBuf = null;
    if (typeof pWarpUpdUI === "function") pWarpUpdUI();
  }
  if (pSourceBuf) {
    pBuf = getPlaybackBuffer();
    pBuildEQ();
  } else {
    pBuf = null;
  }
}
```

### 1c) `plAudio`-change-Listener (Z. 207–244): `pFileBuf` statt `pSourceBuf`

**Vor:**
```js
const buf = await f.arrayBuffer();
pSourceBuf = await c.decodeAudioData(buf);
pMonoBuf = null;
pLeftOnlyBuf = null;
pRightOnlyBuf = null;
// Warp-Buffer invalidieren – neue Datei erfordert neue Vorberechnung
if (typeof pWarpedBuf !== "undefined") {
  pWarpedBuf = null;
  if (typeof pWarpUpdUI === "function") pWarpUpdUI();
}
pBuf = getPlaybackBuffer();
```

**Nach:**
```js
const buf = await f.arrayBuffer();
pFileBuf = await c.decodeAudioData(buf);
pSetPlaybackMode("file");
```

Die `pBuildEQ()`/`pDrawEQ()`/`pBuildTbl()`-Aufrufe und der
sichtbar-Setter darunter bleiben. `pSetPlaybackMode` ruft selbst
schon `pBuildEQ()`; das zweite `pBuildEQ()` ist harmlos (idempotent),
aber wer es entfernen will, kann.

### 1d) `pToggle` (Z. 417–430): bei laufenden Sätzen direkt zur Datei wechseln

**Vor:**
```js
function pToggle() {
  if (!pBuf) return;
  if (pCtx.state === "suspended") pCtx.resume();
  // Wenn der User auf den Datei-Play-Button drückt, während Sätze
  // laufen, ist das ein Wechsel zur Musikdatei. Sätze-Mode beenden,
  // ohne pPause aufzurufen (das macht der normale Pfad).
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
    return; // sStop hat bereits pausiert; User klickt erneut für Datei.
  }
  if (pPlaying) pPause();
  else pPlay();
}
```

**Nach:**
```js
function pToggle() {
  if (pCtx && pCtx.state === "suspended") pCtx.resume();
  // Wenn Sätze laufen: stoppen, in Datei-Modus wechseln, Datei starten.
  // Ein Klick reicht (vorher waren zwei nötig).
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
    if (!pFileBuf) return;          // keine Datei geladen → nichts zu spielen
    pSetPlaybackMode("file");
    pOff = 0;
    pPlay();
    return;
  }
  if (!pBuf) return;                // kein Buffer → ignorieren
  if (pPlaying) pPause();
  else pPlay();
}
```

### 1e) `updatePlayerForSideChange` (Z. 246–264) bleibt fast unverändert

Nur der Aufruf von `pSetPlaybackMode` ist hier nicht nötig — die
Funktion arbeitet bereits mit `pSourceBuf`, und das ist nach dem
Seitenwechsel weiterhin der zuletzt aktive Buffer.

`sStop()`-Aufruf am Anfang der Funktion bleibt — bei Seitenwechsel
während Sätze laufen wird gestoppt.

---

## Schritt 2 — sentences.js: eigener Satz-Buffer + sauberes Restore

### 2a) Neue globale Variable am Dateianfang (nach `sShownText`)

**Vor (Z. 12–23):**
```js
let sCorpus = null;
let sLoaded = false;
let sLoading = false;
let sActive = false;
let sEndless = false;
let sEndlessCount = 0;
let sCurRec = null;
let sShownText = "";
let sPauseTimer = null;
let sPauseMsVal = 2000;
let sOfflineMode = false;
let sEmbedLoading = new Set();
```

**Nach:** ergänzen um `sSentenceBuf` nach `sShownText`:
```js
let sCorpus = null;
let sLoaded = false;
let sLoading = false;
let sActive = false;
let sEndless = false;
let sEndlessCount = 0;
let sCurRec = null;
let sShownText = "";
let sSentenceBuf = null;        // dekodierter aktueller Satz, getrennt von pFileBuf
let sPauseTimer = null;
let sPauseMsVal = 2000;
let sOfflineMode = false;
let sEmbedLoading = new Set();
```

### 2b) `sPlayCurrent` (Z. 147–189): `sSentenceBuf` setzen, dann `pSetPlaybackMode`

**Vor (Mitte der Funktion):**
```js
const c = gPC();
const decoded = await c.decodeAudioData(arrayBuf);
if (!sActive) return;
pSourceBuf = decoded;
pMonoBuf = null;
pLeftOnlyBuf = null;
pRightOnlyBuf = null;
if (typeof pWarpedBuf !== "undefined") {
  pWarpedBuf = null;
  if (typeof pWarpUpdUI === "function") pWarpUpdUI();
}
pOff = 0;
pBuf = getPlaybackBuffer();
pBuildEQ();
pDrawEQ();
pBuildTbl();
document.getElementById("plCtrl").style.display = "";
document.getElementById("plEqViz").style.display = "";
document.getElementById("plTL").value = 0;
document.getElementById("plCur").textContent = "0:00";
if (typeof pFmt === "function") {
  document.getElementById("plTot").textContent = pFmt(pBuf.duration);
}
sShownText = sCurRec.rec.text || "";
sUpdateTextBox();
await pPlay();
```

**Nach:**
```js
const c = gPC();
const decoded = await c.decodeAudioData(arrayBuf);
if (!sActive) return;
sSentenceBuf = decoded;
pSetPlaybackMode("sentence");
pOff = 0;
pDrawEQ();
pBuildTbl();
// Audioplayer-UI bleibt sichtbar, aber zeigt während Satz-Wiedergabe
// keine Position. Sätze haben eigene Steuerung; keine plTL/plCur-Updates.
document.getElementById("plEqViz").style.display = "";
sShownText = sCurRec.rec.text || "";
sUpdateTextBox();
await pPlay();
```

Begründung: `pSetPlaybackMode("sentence")` macht das ganze
Buffer-Setup atomar (pSourceBuf, abgeleitete Buffer, pBuildEQ,
pBuf). `plCtrl`-Anzeige ist sowieso schon eingeblendet, sobald ein
Buffer existiert (siehe Schritt 4 falls noch nötig).

### 2c) `sStop` (Z. 233–245): zurück in Datei-Modus

**Vor:**
```js
function sStop() {
  sActive = false;
  sEndless = false;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
    pOff = 0;
    if (typeof pUpdTL === "function") pUpdTL();
  }
  sShownText = "";
  sUpdateTextBox();
  sUpdateButtons();
}
```

**Nach:**
```js
function sStop() {
  sActive = false;
  sEndless = false;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  pOff = 0;
  // Zurück in Datei-Modus, damit ein nachfolgender Klick auf den Audio-
  // Play-Button die Datei spielt, nicht den letzten Satz.
  if (typeof pSetPlaybackMode === "function") {
    pSetPlaybackMode("file");
  }
  if (typeof pUpdTL === "function") pUpdTL();
  sShownText = "";
  sUpdateTextBox();
  sUpdateButtons();
}
```

---

## Schritt 3 — CODESTRUKTUR.md aktualisieren

In der Zeile zu `player.js`: neue globale Variablen `pFileBuf`,
`pPlaybackMode` ergänzen, neue Funktion `pSetPlaybackMode`
erwähnen. Im Datenfluss-Block einen kurzen Abschnitt einfügen:

```
**Audio-Datei vs. Sätze (Buffer-Trennung):** `pFileBuf` hält die
vom User geladene Audiodatei, `sSentenceBuf` (in sentences.js) den
gerade dekodierten Satz. `pSourceBuf` ist eine Live-View auf den
durch `pPlaybackMode` gewählten Slot ("file" oder "sentence"),
gesetzt über `pSetPlaybackMode(mode)`. Damit überschreibt die
Sätze-Wiedergabe die Datei-Auswahl nicht mehr. Ein Klick auf den
Datei-Play-Button (`pToggle`) wechselt bei laufenden Sätzen
unmittelbar in den Datei-Modus und startet die Datei.
```

In der Zeile zu `sentences.js`: `sSentenceBuf` zur State-Liste
hinzufügen.

---

## Schritt 4 — SPEC.md aktualisieren

Im Abschnitt zur Sätze-Wiedergabe (`assets/sentences/`-Block) den
Punkt "Sätze und Musikdatei schließen sich gegenseitig aus" wie folgt
korrigieren:

```
Sätze und Audiodatei haben getrennte Buffer und sind unabhängig
voneinander steuerbar. Sätze-Start pausiert eine laufende
Datei-Wiedergabe; Klick auf den Datei-Play-Button während laufender
Sätze stoppt diese und startet die Datei (ein Klick, vorher zwei).
Sätze-Stop und Sätze-Ende setzen den Player zurück in den Datei-
Modus, ohne die Datei-Auswahl zu verlieren.
```

---

## Akzeptanztest (Klick-für-Klick)

Im Browser den Player-Tab öffnen.

1. **Datei laden:** eine MP3 oder WAV im Audioplayer-Bereich
   auswählen. Erwartet: Dauer wird angezeigt, Play-Button (▶)
   sichtbar.
2. **Datei kurz spielen:** Play klicken. Erwartet: hörbar. Stop
   klicken.
3. **Satz spielen:** im Sätze-Bereich einen Sprecher wählen, "▶
   Spielen" klicken. Erwartet: Satz hörbar. Nach Satz-Ende: Sätze-
   Buttons gehen automatisch in Default-Zustand zurück.
4. **Audiodatei-Anzeige prüfen:** der Dateiname und die Dauer der
   ursprünglichen Datei sind weiterhin im Audioplayer sichtbar
   (nicht der Satz). Zeitleiste steht auf 0.
5. **Audioplayer-Play nach Satz:** im Audioplayer Play (▶) klicken
   — in **einem** Klick. Erwartet: die ursprüngliche Datei spielt,
   nicht der zuletzt abgespielte Satz.
6. **Sätze während laufender Datei:** Datei spielen lassen, dann
   im Sätze-Bereich Play klicken. Erwartet: Datei pausiert, Satz
   startet.
7. **Datei-Play während laufender Sätze:** Sätze-Endlosfolge
   starten, dann **während ein Satz läuft** Audioplayer-Play
   klicken. Erwartet: Satz stoppt, Datei startet sofort (ein Klick).
8. **Seitenwechsel während Sätze:** Sätze starten, dann zum
   Implantat-Tab wechseln. Erwartet: Sätze stoppen, Datei-Auswahl
   bleibt erhalten.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede der 8 Akzeptanz-Kriterien einzeln
durchgehen und für jede melden:

- **erfüllt** / **nicht erfüllt** / **unklar**
- Bei "erfüllt": Datei + Zeile der relevanten Code-Stelle nennen.
- Bei "unklar": konkrete Rückfrage formulieren statt zu raten.

Zusätzlich prüfen und melden:

- A) Greift `pSetPlaybackMode` korrekt auf `sSentenceBuf` zu, obwohl
  diese Variable in einer anderen Datei (sentences.js) deklariert
  ist? (Erwartet: ja, beide sind globaler Scope, kein import nötig.)
- B) Wird `pBuildEQ()` nach Modus-Wechsel sicher aufgerufen,
  bevor `pPlay()` versucht, an `pEqF[0]` zu connecten?
- C) Verbleibt nach `sStop()` (ohne Datei zuvor geladen) ein
  konsistenter State, oder kann `pSetPlaybackMode("file")` mit
  `pFileBuf === null` crashen? Erwartet: kein Crash, `pSourceBuf`
  wird `null`, `pBuf` wird `null`, Play-Button reagiert via
  `if (!pBuf) return` in `pToggle`.

Wenn A/B/C als nicht-trivial angesehen werden: vor dem Commit
Rückfrage formulieren.
