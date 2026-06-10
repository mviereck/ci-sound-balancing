# Bauanleitung 06 — Frequenz-Warping: Vocoder lädt aus file:// und Seitenrespekt

## Zielbild

Drei Punkte am Player-Frequenz-Warping in Ordnung bringen:

**(A) Vocoder/Bandshift starten nicht.** Ursache beim Vocoder: das AudioWorklet
`freq-warp-processor.js` darf unter `file://` nicht per
`audioCtx.audioWorklet.addModule("freq-warp-processor.js")` geladen werden
(Browser-CORS). Der Worklet-Code muß stattdessen als JS-String in `freq-warp.js`
inline liegen und über `URL.createObjectURL(new Blob([code]))` an `addModule`
übergeben werden. Bandshift testet der Nutzer nach diesem Bau getrennt.

**(B) Seite wird bei aktivem Warping ignoriert (Offline-Verfahren).** Wenn oben
„LINKS" oder „RECHTS" gewählt ist, soll nur diese Seite Ton machen (andere
stumm). Heute wird der vorberechnete Stereo-Buffer in `getPlaybackBuffer()`
direkt zurückgegeben und der Side-Switch übersprungen. Folge: beide Kanäle
spielen ab.

**(C) Bei „Beide Seiten" wird die im Korrektur-Modus NICHT betroffene Seite
trotzdem durchs Bandpass-Bank-Verfahren geschickt.** Das verändert ihre
Klangfarbe, obwohl ihr Cent-Shift 0 ist. Soll: die nicht betroffene Seite
unverändert vom Original durchreichen.

Aus Nutzerperspektive: Bei `ref_side`-Modus wird nur die Referenzseite gewarpt,
bei `var_side`-Modus nur die variable Seite, bei `symmetric` beide. Die jeweils
„andere" Seite bleibt im Player auf „Beide Seiten" klanglich unverändert.

## Vorab lesen

- `freq-warp.js` (komplett, etwa 400 Zeilen)
- `freq-warp-processor.js` (komplett, etwa 240 Zeilen — Inhalt wird in
  `freq-warp.js` eingebettet)
- `player.js`, insbesondere `getPlaybackBuffer` (Z. 80–107) und `pPlay`
  (Z. 372–468)
- CODESTRUKTUR.md (Zeile zu freq-warp.js und freq-warp-processor.js)
- SPEC.md (Player-Abschnitt, Zeilen rund um 212–224)

## Schritt 1 — Worklet-Code als Inline-String in freq-warp.js einbetten

### 1.1 String-Konstante anlegen

Am Anfang von `freq-warp.js` (direkt nach dem Header-Kommentar, vor
`let pWarpedBuf = null;`) eine Konstante einfügen:

```js
// AudioWorklet-Processor-Code als String (wird zur Laufzeit als Blob geladen,
// damit der Vocoder auch unter file:// funktioniert).
const _FREQ_WARP_PROCESSOR_CODE = `
<HIER der vollständige Inhalt von freq-warp-processor.js, unverändert>
`;
```

**Wichtig zur Einbettung:**

- Den gesamten Inhalt der Datei `freq-warp-processor.js` 1:1 zwischen die
  Backticks setzen (Template-String). Keine Anführungszeichen escapen — Template
  Strings verkraften beides.
- Achtung auf Backticks **im** Worklet-Code: falls dort ein `` ` `` vorkommt
  (im aktuellen Stand kommt keiner vor), müßte es als `` \` `` escapt werden.
  Vor dem Einfügen einmal `grep '\`' freq-warp-processor.js` prüfen — Treffer
  einzeln escapen.
- Achtung auf `${...}`: im Worklet-Code stehen keine, aber falls jemand später
  welche einfügt, würden sie als Template-Interpolation interpretiert. Für den
  jetzigen Stand: nichts zu tun.

### 1.2 `pInitWarpWorklet` auf Blob-URL umstellen

**Vorher** (Z. 224–228):

```js
async function pInitWarpWorklet(audioCtx) {
  if (pWarpWorkletReady) return;
  await audioCtx.audioWorklet.addModule("freq-warp-processor.js");
  pWarpWorkletReady = true;
}
```

**Nachher:**

```js
async function pInitWarpWorklet(audioCtx) {
  if (pWarpWorkletReady) return;
  const blob = new Blob([_FREQ_WARP_PROCESSOR_CODE], {
    type: "application/javascript",
  });
  const url = URL.createObjectURL(blob);
  try {
    await audioCtx.audioWorklet.addModule(url);
    pWarpWorkletReady = true;
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

### 1.3 Datei `freq-warp-processor.js` löschen

Nach erfolgreichem Einbetten:

```
git rm freq-warp-processor.js
```

(oder im Dateisystem löschen, falls noch nicht commited.)

In `CODESTRUKTUR.md` den entsprechenden Eintrag entfernen — das ist die Zeile
mit „freq-warp-processor.js — AudioWorklet-Processor für Variante A …". Auch
den Verweis im freq-warp.js-Eintrag anpassen: dort wird heute `pInitWarpWorklet`
mit dem `addModule(...)`-Detail erwähnt; reicht zu sagen, daß der Worklet-Code
inline als String vorliegt.

## Schritt 2 — Seite respektieren (Offline-Verfahren)

### 2.1 Was sich ändert

Heute: `getPlaybackBuffer()` gibt bei aktivem Warp direkt `pWarpedBuf` zurück
und überspringt den Side-Switch.

Soll:
- `mode === "left"`: linker Kanal von `pWarpedBuf`, rechter Kanal stumm.
- `mode === "right"`: rechter Kanal von `pWarpedBuf`, linker Kanal stumm.
- `mode === "both"`:
  - bei `pWarpMode === "symmetric"`: `pWarpedBuf` so wie er ist (beide Seiten
    gewarpt).
  - bei `pWarpMode === "ref_side"` oder `"var_side"`: der vom Mode betroffene
    Kanal aus `pWarpedBuf`, der andere Kanal direkt aus `pSourceBuf` (Original).

### 2.2 Hilfsfunktion: welche Seite ist „gewarpt"?

In `freq-warp.js`, direkt nach `buildWarpPoints`, eine kleine Hilfsfunktion
einfügen:

```js
// Gibt zurück: { warpsLeft: bool, warpsRight: bool }
// Bestimmt anhand der Cent-Shifts in den Punkten, welche Seite(n) tatsächlich
// gewarpt werden. Bei symmetric beide; bei ref_side/var_side nur eine.
function _warpAffectedSides(points) {
  let l = false, r = false;
  for (const p of points) {
    if (Math.abs(p.csL) > 1e-9) l = true;
    if (Math.abs(p.csR) > 1e-9) r = true;
  }
  return { warpsLeft: l, warpsRight: r };
}
```

Zusätzlich beim Computing speichern wir die Info, damit `getPlaybackBuffer`
sie nutzen kann. Eine neue Modulvariable in `freq-warp.js` neben den anderen
State-Variablen ergänzen:

```js
let pWarpAffected = { warpsLeft: false, warpsRight: false };
```

Und in `pComputeWarpedBuffer` direkt nach `const points = ...`:

```js
pWarpAffected = _warpAffectedSides(points);
```

### 2.3 `getPlaybackBuffer` umbauen

Datei: `player.js`, Funktion `getPlaybackBuffer` (Z. 80–107).

**Vorher** (komplette Funktion ersetzen):

```js
function getPlaybackBuffer() {
  const mode = getPlayerSide();
  if (!pSourceBuf) return null;

  // Wenn Warp aktiv, vorberechnet und Offline-Verfahren gewählt: gewarpten Buffer
  const _warpMethodEl = document.getElementById("plWarpMethod");
  const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "offline";
  if (typeof pWarpOn !== "undefined" && pWarpOn && pWarpedBuf && !pWarpBusy && _warpMethod === "offline") {
    return pWarpedBuf;
  }

  switch (mode) {
    case "left":
      if (!pLeftOnlyBuf) pLeftOnlyBuf = createLeftOnlyBuffer(pSourceBuf);
      return pLeftOnlyBuf;
    case "right":
      if (!pRightOnlyBuf) pRightOnlyBuf = createRightOnlyBuffer(pSourceBuf);
      return pRightOnlyBuf;
    case "both":
    case "mono":
      if (pSourceBuf.numberOfChannels > 1) return pSourceBuf;
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
    default:
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
  }
}
```

**Nachher:**

```js
function getPlaybackBuffer() {
  const mode = getPlayerSide();
  if (!pSourceBuf) return null;

  const _warpMethodEl = document.getElementById("plWarpMethod");
  const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "offline";
  const warpReady = typeof pWarpOn !== "undefined"
                  && pWarpOn && pWarpedBuf && !pWarpBusy
                  && _warpMethod === "offline";

  if (warpReady) {
    // Side-Filter auf gewarpten Buffer anwenden (analog Original).
    // Bei "both" zusätzlich: nicht vom Mode betroffene Seite aus Original.
    return _buildWarpedPlaybackBuffer(mode);
  }

  switch (mode) {
    case "left":
      if (!pLeftOnlyBuf) pLeftOnlyBuf = createLeftOnlyBuffer(pSourceBuf);
      return pLeftOnlyBuf;
    case "right":
      if (!pRightOnlyBuf) pRightOnlyBuf = createRightOnlyBuffer(pSourceBuf);
      return pRightOnlyBuf;
    case "both":
    case "mono":
      if (pSourceBuf.numberOfChannels > 1) return pSourceBuf;
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
    default:
      if (!pMonoBuf) pMonoBuf = createMonoBuffer(pSourceBuf);
      return pMonoBuf;
  }
}
```

### 2.4 Neue Helfer-Funktion `_buildWarpedPlaybackBuffer`

Direkt nach `createMonoBuffer` (vor `getPlaybackBuffer`) in `player.js`
einfügen:

```js
// Baut den abzuspielenden Stereo-Buffer aus pWarpedBuf gemäß Player-Side.
// - "left":  linker Kanal aus pWarpedBuf, rechter stumm
// - "right": rechter Kanal aus pWarpedBuf, linker stumm
// - "both":  betroffene Seite aus pWarpedBuf, andere Seite aus pSourceBuf
// - "mono":  wie "both", aber Downmix
// pWarpAffected (aus freq-warp.js) zeigt, welche Seite tatsächlich gewarpt
// wird. Bei symmetric sind beide true.
function _buildWarpedPlaybackBuffer(mode) {
  const c = gPC();
  const len = pWarpedBuf.length;
  const sr = pWarpedBuf.sampleRate;
  const out = c.createBuffer(2, len, sr);
  const outL = out.getChannelData(0);
  const outR = out.getChannelData(1);
  const warpL = pWarpedBuf.getChannelData(0);
  const warpR = pWarpedBuf.numberOfChannels > 1
    ? pWarpedBuf.getChannelData(1)
    : pWarpedBuf.getChannelData(0);

  if (mode === "left") {
    outL.set(warpL);
    // outR bleibt 0
    return out;
  }
  if (mode === "right") {
    outR.set(warpR);
    // outL bleibt 0
    return out;
  }

  // mode "both" oder "mono"
  const affected = typeof pWarpAffected !== "undefined"
    ? pWarpAffected
    : { warpsLeft: true, warpsRight: true };

  const srcL = pSourceBuf.getChannelData(0);
  const srcR = pSourceBuf.numberOfChannels > 1
    ? pSourceBuf.getChannelData(1)
    : srcL;
  const srcLen = pSourceBuf.length;
  const copyLen = Math.min(len, srcLen);

  if (affected.warpsLeft)  outL.set(warpL.subarray(0, len));
  else                     outL.set(srcL.subarray(0, copyLen));

  if (affected.warpsRight) outR.set(warpR.subarray(0, len));
  else                     outR.set(srcR.subarray(0, copyLen));

  if (mode === "mono") {
    // Downmix beider Kanäle auf beide Seiten
    for (let i = 0; i < len; i++) {
      const v = (outL[i] + outR[i]) * 0.5;
      outL[i] = v;
      outR[i] = v;
    }
  }
  return out;
}
```

### 2.5 Side-Wechsel triggert kein Recompute, nur Buffer-Neuaufbau

`updatePlayerForSideChange` in `player.js` (Z. 179–193) muß nichts ändern —
es ruft schon `getPlaybackBuffer()` neu auf. Bei Side-Wechsel wird der gewarpte
Buffer **nicht** neu gerendert (teuer), sondern nur das Stereo-Routing.

## Schritt 3 — Vocoder respektiert Seite (Live-Graph)

`pBuildVocoderGraph` in `freq-warp.js` (Z. 230–277). Heute leitet der
WorkletNode immer beide Kanäle an `destNode`. Soll: Side-Filter nachschalten.

### 3.1 Helfer in `freq-warp.js`

Direkt vor `pBuildVocoderGraph` einfügen:

```js
// Liefert die Mode-spezifischen Kanal-Gains: { gL, gR } zwischen 0 und 1.
// Bei "both" + Mode-betroffener Seite: gewarpte Quelle behält, andere wird
// in einem Mix mit dem Original ergänzt (siehe Aufrufer).
function _warpSideGains(mode) {
  if (mode === "left")  return { gL: 1, gR: 0 };
  if (mode === "right") return { gL: 0, gR: 1 };
  return { gL: 1, gR: 1 };
}
```

### 3.2 `pBuildVocoderGraph` erweitern

**Vorher** (relevanter Block ab `const src = audioCtx.createBufferSource();`):

```js
const src = audioCtx.createBufferSource();
src.buffer = srcBuf;

const workletNode = new AudioWorkletNode(audioCtx, "freq-warp-processor", {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
});

workletNode.port.postMessage({
  type: "params",
  points: adjPoints,
  strength: 1.0,
  active: true,
});

src.connect(workletNode);
workletNode.connect(destNode);
src.start(startTime, offsetSec);

return {
  sources: [src],
  workletNode,
  stop() {
    try { src.stop(); } catch(e) {}
    try { workletNode.disconnect(); } catch(e) {}
  }
};
```

**Nachher:**

```js
const src = audioCtx.createBufferSource();
src.buffer = srcBuf;

const workletNode = new AudioWorkletNode(audioCtx, "freq-warp-processor", {
  numberOfInputs: 1,
  numberOfOutputs: 1,
  outputChannelCount: [2],
});
workletNode.port.postMessage({
  type: "params",
  points: adjPoints,
  strength: 1.0,
  active: true,
});

src.connect(workletNode);

// Side-Routing: gewarpte Kanäle gehen über Gains in einen Merger.
// Bei "both" + ref_side/var_side: nicht betroffene Seite kommt aus zweiter
// BufferSource (Original-srcBuf), so daß die nicht gewarpte Seite klanglich
// unverändert bleibt.
const mode = getPlayerSide();
const sg = _warpSideGains(mode);
const splitter = audioCtx.createChannelSplitter(2);
const merger   = audioCtx.createChannelMerger(2);
const gL = audioCtx.createGain(); gL.gain.value = sg.gL;
const gR = audioCtx.createGain(); gR.gain.value = sg.gR;

workletNode.connect(splitter);
splitter.connect(gL, 0); splitter.connect(gR, 1);

const affected = _warpAffectedSides(points);

// Bei "both" und nicht betroffener Seite: gewarpten Kanal stummschalten,
// stattdessen Original auf diese Seite mischen.
let origSrc = null;
let origSplitter = null;
let origGL = null;
let origGR = null;
if (mode === "both") {
  if (!affected.warpsLeft || !affected.warpsRight) {
    origSrc = audioCtx.createBufferSource();
    origSrc.buffer = srcBuf;
    origSplitter = audioCtx.createChannelSplitter(2);
    origGL = audioCtx.createGain();
    origGR = audioCtx.createGain();
    origGL.gain.value = affected.warpsLeft  ? 0 : 1;
    origGR.gain.value = affected.warpsRight ? 0 : 1;
    if (!affected.warpsLeft)  gL.gain.value = 0;
    if (!affected.warpsRight) gR.gain.value = 0;
    origSrc.connect(origSplitter);
    origSplitter.connect(origGL, 0);
    origSplitter.connect(origGR, 1);
    origGL.connect(merger, 0, 0);
    origGR.connect(merger, 0, 1);
  }
}

gL.connect(merger, 0, 0);
gR.connect(merger, 0, 1);
merger.connect(destNode);

src.start(startTime, offsetSec);
if (origSrc) origSrc.start(startTime, offsetSec);

const sources = origSrc ? [src, origSrc] : [src];

return {
  sources,
  workletNode,
  stop() {
    try { src.stop(); } catch(e) {}
    if (origSrc) { try { origSrc.stop(); } catch(e) {} }
    try { workletNode.disconnect(); } catch(e) {}
  }
};
```

**Beachten:**
- `points` ist bereits in dieser Funktion verfügbar (Z. 241).
- `getPlayerSide()` ist eine globale Funktion aus `state-side.js`, also auch in
  `freq-warp.js` aufrufbar.
- Wenn `destNode` ein BiquadFilter (Mono-Eingang) ist: der Merger gibt einen
  Stereo-Stream raus, dieser wird beim Connect auf Mono runtergemixt.
  Konsequenz: bei `mode === "left"` und `destNode` = `pEqF[0]` (Biquad) wird
  links + (stummer) rechts gemittelt → Pegelhalbierung. Das gleicht der
  Original-Pfad ohne Warp **auch nicht** sauber aus, weil dort der
  `createLeftOnlyBuffer`/`createRightOnlyBuffer` ebenfalls auf den Mono-Filter
  läuft. Akzeptables Verhalten — bleibt konsistent.

## Schritt 4 — Bandshift bleibt unangetastet

Der User testet das in einem separaten Schritt. **Keine Änderungen** an
`pBuildWarpedGraph` in diesem Build.

## Schritt 5 — Dokumentation aktualisieren

### 5.1 CODESTRUKTUR.md

Die Zeile zu `freq-warp-processor.js` komplett entfernen. Im Eintrag zu
`freq-warp.js` ergänzen, daß der Worklet-Code als String inline liegt und per
Blob-URL geladen wird. Außerdem in der Liste der globalen State-Variablen von
freq-warp.js `pWarpAffected` ergänzen.

Konkrete vorher/nachher-Schnipsel:

**Vorher** (Modul-Tabelle):
```
| 16 | freq-warp.js | … State: `pWarpedBuf`, `pWarpOn`, `pWarpMode`, `pWarpStrength`, `pWarpBusy`, `pWarpMethod`, `pWarpWorkletReady` |
| –  | freq-warp-processor.js | AudioWorklet-Processor für Variante A (Phasen-Vocoder). Wird **nicht** als `<script>`-Tag geladen, sondern per `audioCtx.audioWorklet.addModule("freq-warp-processor.js")` zur Laufzeit. Enthält `FreqWarpProcessor`, `_fft`, `_ifft`, `_centShiftW`. |
```

**Nachher:**
```
| 16 | freq-warp.js | … State: `pWarpedBuf`, `pWarpOn`, `pWarpMode`, `pWarpStrength`, `pWarpBusy`, `pWarpMethod`, `pWarpWorkletReady`, `pWarpAffected`. Worklet-Code für den Phasen-Vocoder liegt als String-Konstante `_FREQ_WARP_PROCESSOR_CODE` im selben Modul; `pInitWarpWorklet` lädt ihn per Blob-URL, damit der Vocoder auch unter `file://` funktioniert. |
```

(Den separaten Zeile-Eintrag für `freq-warp-processor.js` entfernen.)

### 5.2 SPEC.md

Im Player-Abschnitt (rund um Z. 212–224):

- Anmerkung zum Vocoder anpassen: „Worklet-Code wird inline als String geladen
  (Blob-URL); funktioniert daher auch unter `file://`".
- Neue Bullet bei Offline-Verfahren ergänzen: „Beachtet die im Player gewählte
  Seite — bei LINKS/RECHTS nur diese Seite hörbar; bei `Beide Seiten` ist auf
  der vom Korrektur-Modus nicht betroffenen Seite das Original zu hören
  (klanglich unverändert)."

## Akzeptanztest (Klick für Klick)

Voraussetzungen:
- `index.html` doppelklicken (also `file://`).
- Implantat-Konfiguration so, daß mindestens ein Frequenzabgleich-Meßwert
  vorhanden ist (oder JSON-Testdaten laden). `fRes` darf nicht leer sein.
- Eine kurze Audiodatei im Player laden (Mono oder Stereo).

### A) Vocoder lädt unter file://
1. Im Player-Tab Warp aktivieren, Verfahren = „Phasen-Vocoder".
2. Play drücken.
3. **Erwartet:** Wiedergabe startet (kein stiller Abbruch). In der Konsole
   keine „Vocoder-Fehler: DOMException: The operation was aborted." mehr.

### B) LINKS/RECHTS-Schalter respektiert
4. Verfahren = „Offline-Vorberechnung". Stop. Seite oben auf „LINKS" stellen,
   Warp einschalten, abwarten bis Status „aktiv" zeigt, Play.
5. **Erwartet:** Ton nur auf linker Seite hörbar (rechte Seite still). Im
   Korrektur-Modus `var_side` bleibt die linke Seite gewarpt, wenn varSide
   = links; sonst hört man links das Original.
6. Seite auf „RECHTS" stellen, Play.
7. **Erwartet:** Ton nur rechts hörbar, links still.

### C) „Beide Seiten" mit ref_side/var_side
8. Seite = aktiver Side (egal, wird durch Player-Side überschrieben).
9. Player auf „Beide Seiten" (Checkbox).
10. Verfahren = Offline, Korrektur-Modus = `var_side`. Play.
11. **Erwartet:** Auf einer Seite (der varSide laut fRes) ist die gewarpte
    Version zu hören, auf der anderen das **unveränderte Original**. Die
    nicht gewarpte Seite klingt nicht „klangfarbig verändert" durch Bandpässe.
12. Korrektur-Modus auf `symmetric` ändern, Recalc abwarten, Play.
13. **Erwartet:** Beide Seiten gewarpt (klanglich verändert), keine
    Original-Spur mehr.

### D) Bandshift bleibt funktional wie vorher
14. Verfahren = „Bandweise Pitch-Shift". Play.
15. **Erwartet:** Startet (oder verhält sich wie zuvor — der User testet das
    in einem Folgeschritt, keine Verschlechterung).

### E) Datei gelöscht, App lädt fehlerfrei
16. Seite mit DevTools-Network-Tab neu laden.
17. **Erwartet:** Kein 404 auf `freq-warp-processor.js`. Keine Fehler in der
    Konsole.

## Selbstprüfung an Sonnet — VOR der Fertig-Meldung

Gehe jede Akzeptanzkriterie A–E einzeln durch und beantworte:
**erfüllt / nicht erfüllt / unklar**, jeweils mit Datei und Zeile der Stelle,
die das absichert.

- **A.1** Worklet-Code als String in freq-warp.js → Datei:Zeile.
- **A.2** `pInitWarpWorklet` lädt per Blob-URL → Datei:Zeile.
- **A.3** `freq-warp-processor.js` ist gelöscht → mit `ls` prüfen, melden.
- **B.1** `getPlaybackBuffer` ruft `_buildWarpedPlaybackBuffer` bei
  `warpReady` → Datei:Zeile.
- **B.2** `_buildWarpedPlaybackBuffer` setzt für `left`/`right` den
  Gegenkanal auf 0 → Datei:Zeile.
- **C.1** Bei `mode === "both"` und nicht betroffener Seite wird `pSourceBuf`
  auf den entsprechenden Kanal kopiert → Datei:Zeile.
- **C.2** `pWarpAffected` wird in `pComputeWarpedBuffer` befüllt → Datei:Zeile.
- **C.3** Vocoder-Graph: bei `mode === "both"` und nicht betroffener Seite
  wird Original-BufferSource auf den anderen Kanal gemischt → Datei:Zeile.
- **D.1** `pBuildWarpedGraph` (Bandshift) wurde **nicht** verändert →
  bestätigen.
- **E.1** CODESTRUKTUR.md: Zeile zu `freq-warp-processor.js` entfernt,
  freq-warp.js-Zeile aktualisiert → Datei:Zeile.
- **E.2** SPEC.md: Player-Abschnitt um Vocoder-Inline-Notiz und Side-
  Respekt-Bullet ergänzt → Datei:Zeile.

Bei einem „unklar" oder „nicht erfüllt": **NICHT fertig melden**. Stattdessen
beim User rückfragen mit der konkreten Stelle und Frage.

## Was bewußt NICHT in diesem Build steckt

- **Bandshift-Seitenrespekt**: kommt erst, wenn der User Bandshift getrennt
  testet.
- **Nahtloses Toggle (Vorausberechnung im Hintergrund)**: kommt als eigener
  Build, wenn 1+2+3 sitzt.
- **Offline-Variante durch Offline-Vocoder ersetzen**: hängt davon ab, wie
  gut der Live-Vocoder läuft.
