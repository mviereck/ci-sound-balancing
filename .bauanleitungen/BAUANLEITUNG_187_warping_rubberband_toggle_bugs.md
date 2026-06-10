# Bauanleitung 187 — Frequenz-Warping: Rubberband-Toggle-Verhalten konsistent machen

## Kontext

Rubberband (BA 184-186) wurde als zweites Offline-Verfahren neben "offline"
eingebaut, ist im Toggle-/Methodenwechsel-/Parameter-Code aber wie ein
Live-Verfahren behandelt worden. Folge: Vorberechnung wird nicht
getriggert, Play-Button wird nicht gesperrt, EQ-Toggle wechselt den
Audio-Graph nicht. Zusatzproblem: Beim Laden einer neuen Audiodatei
wird eine laufende Wiedergabe nicht beendet.

Diese Bauanleitung enthält fünf kleine Edits in zwei Dateien (`js/init.js`,
`js/player.js`) plus den Versions-Bump. Reines Verhalten-Fix, kein neues
Feature, keine UI-Texte, keine Persistenz-Änderung. Keine
Spec-Aktualisierung nötig.

Alle Edits folgen demselben Muster: **wo der Code aktuell auf
`method === "offline"` testet, muss auch `method === "rubberband"` greifen.**

## Schritt 1: Versions-Bump

**Datei:** `js/version.js`

**Vorher:**
```js
const APP_VERSION = "3.2.186.1-beta";
```

**Nachher:**
```js
const APP_VERSION = "3.2.187-beta";
```

---

## Schritt 2: EQ-Toggle — Rubberband-Zweig ergaenzen

**Datei:** `js/init.js`, Zeilen 203-225 (Klick-Handler `plEqToggle`).

Der `offline`-Zweig (Pause → `getPlaybackBuffer` → Play) muss auch fuer
`rubberband` greifen, sonst hat EQ-Aus bei aktivem Rubberband-Warp keine
hoerbare Wirkung auf den Warp-Pfad.

**Vorher (Zeilen 207-223):**
```js
    if (pWarpOn) {
      const method = document.getElementById("plWarpMethod").value;
      if (method === "vocoder" || method === "bandshift") {
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        pWarpUpdUI();
        if (wasPlaying) pPlay();
      } else if (method === "offline") {
        // Offline: getPlaybackBuffer entscheidet anhand plEqOn neu beim nächsten Play.
        // Bei laufender Wiedergabe Pfad an aktueller Position wechseln.
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        if (wasPlaying) pPlay();
      }
    }
```

**Nachher:**
```js
    if (pWarpOn) {
      const method = document.getElementById("plWarpMethod").value;
      if (method === "vocoder" || method === "bandshift") {
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        pWarpUpdUI();
        if (wasPlaying) pPlay();
      } else if (method === "offline" || method === "rubberband") {
        // Offline-Verfahren (offline, rubberband): getPlaybackBuffer
        // entscheidet anhand plEqOn neu beim nächsten Play.
        // Bei laufender Wiedergabe Pfad an aktueller Position wechseln.
        const wasPlaying = pPlaying;
        if (wasPlaying) pPause();
        pBuf = getPlaybackBuffer();
        if (wasPlaying) pPlay();
      }
    }
```

Aenderung: in der `else if`-Bedingung `|| method === "rubberband"`
hinzufuegen und den Kommentar entsprechend praezisieren.

---

## Schritt 3: Warp-Toggle (`plWarpOn`-Klick) — Rubberband-Vorberechnung ausloesen

**Datei:** `js/init.js`, Zeilen 412-437 (Klick-Handler `plWarpOn`).

Der Sonderzweig fuer `"offline"` (ruft `pWarpTrigger`, der pause/resume
und den Busy-Status selbst regelt) muss auch fuer `"rubberband"` greifen.
Ohne diesen Fix wird beim Einschalten von Rubberband keine Berechnung
gestartet — `pWarpedBuf` bleibt `null`, der Player spielt ungewarpt.

**Vorher (Zeilen 415-423):**
```js
    const method = document.getElementById("plWarpMethod").value;
    // Offline-Einschalten: pWarpTrigger regelt Vorberechnung + pause/resume selbst
    if (pWarpOn && method === "offline") {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
```

**Nachher:**
```js
    const method = document.getElementById("plWarpMethod").value;
    // Offline-Verfahren einschalten (offline, rubberband):
    // pWarpTrigger regelt Vorberechnung + pause/resume + Play-Sperre selbst.
    if (pWarpOn && (method === "offline" || method === "rubberband")) {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
```

Aenderung: Bedingung `method === "offline"` zu
`(method === "offline" || method === "rubberband")`; Kommentar
entsprechend.

Hinweis: Der nachfolgende else-Pfad (Zeilen 424-436) bleibt unveraendert.
Er fuer Vocoder/Bandshift "ein" und fuer alle Verfahren "aus" zustaendig
(in beiden Faellen reicht ein Pause/Buf-Wechsel/Play ohne Berechnung).
Beim Ausschalten von Rubberband wird durch `pWarpedBuf = null` (Zeile 429)
der Warp-Buffer korrekt verworfen — das ist bereits richtig.

---

## Schritt 4: Methoden-Dropdown — Rubberband-Trigger bei Methodenwechsel

**Datei:** `js/init.js`, Zeilen 439-460 (Change-Handler `plWarpMethod`).

Bei aktivem `pWarpOn` wird bisher nur bei Wechsel **auf** `"offline"`
`pWarpTrigger` gerufen. Wechsel auf `"rubberband"` (z.B. von Vocoder)
muss genauso eine Vorberechnung ausloesen — der Nutzer erwartet
konsequentes Verhalten zu Schritt 3.

**Vorher (Zeilen 449-453):**
```js
    if (!pWarpOn) return;
    if (this.value === "offline") {
      pWarpTrigger();
      return;
    }
```

**Nachher:**
```js
    if (!pWarpOn) return;
    if (this.value === "offline" || this.value === "rubberband") {
      pWarpTrigger();
      return;
    }
```

Aenderung: Bedingung `this.value === "offline"` zu
`(this.value === "offline" || this.value === "rubberband")`.

---

## Schritt 5: Parameter-Aenderungen (Mode/Staerke) — Rubberband neu berechnen

**Datei:** `js/init.js`, Zeilen 465-482 (Hilfsfunktion `_pWarpParamsChanged`).

Aktuell ruft die Funktion `pWarpTrigger` nur bei `method === "offline"`.
Fuer Rubberband faellt sie in den Bandshift-Pfad (Pause → Buf-Wechsel →
Play), der aber keine Neuberechnung anstoesst — eine Aenderung von Mode
oder Staerke aendert dann hoerbar nichts.

**Vorher (Zeilen 465-482):**
```js
  function _pWarpParamsChanged() {
    if (!pWarpOn) return;
    const method = document.getElementById("plWarpMethod").value;
    if (method === "offline") {
      pWarpTrigger();
      return;
    }
    if (method === "vocoder" && typeof pWarpLiveUpdate === "function") {
      pWarpLiveUpdate();
      return;
    }
    // bandshift: kein Worklet → Graph neu aufbauen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  }
```

**Nachher:**
```js
  function _pWarpParamsChanged() {
    if (!pWarpOn) return;
    const method = document.getElementById("plWarpMethod").value;
    if (method === "offline" || method === "rubberband") {
      pWarpTrigger();
      return;
    }
    if (method === "vocoder" && typeof pWarpLiveUpdate === "function") {
      pWarpLiveUpdate();
      return;
    }
    // bandshift: kein Worklet → Graph neu aufbauen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  }
```

Aenderung: Bedingung `method === "offline"` zu
`(method === "offline" || method === "rubberband")`.

---

## Schritt 6: Audiodatei-Wechsel — laufende Wiedergabe stoppen

**Datei:** `js/player.js`, Zeilen 233-262 (Change-Handler `plAudio`).

Wenn eine Datei laeuft und der Nutzer eine neue Datei waehlt, wird die
laufende Wiedergabe aktuell nicht beendet — nur `sStop()` (Saetze) wird
gerufen. Die alte Source spielt weiter, waehrend dekodiert und EQ neu
gebaut werden. Erwartung des Nutzers: Stop, neue Datei in den Buffer,
gestoppt bleiben (kein Autostart).

**Vorher (Zeilen 233-262):**
```js
document
  .getElementById("plAudio")
  .addEventListener("change", async function (e) {
    const f = e.target.files[0];
    if (!f) return;
    if (typeof sActive !== "undefined" && sActive
        && typeof sStop === "function") {
      sStop();
    }
    try {
      const c = gPC();
      const buf = await f.arrayBuffer();
      pFileBuf = await c.decodeAudioData(buf);
      pSetPlaybackMode("file");
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
      document.getElementById("plCur").textContent = "0:00";
      document.getElementById("plTL").value = 0;
      document.getElementById("plCtrl").style.display = "";
      pBuildEQ();
      pDrawEQ();
      pBuildTbl();
      document.getElementById("plEqViz").style.display = "";
      // Warp neu berechnen wenn aktiv
      if (typeof pWarpOn !== "undefined" && pWarpOn) {
        pWarpTrigger();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
```

**Nachher:**
```js
document
  .getElementById("plAudio")
  .addEventListener("change", async function (e) {
    const f = e.target.files[0];
    if (!f) return;
    if (typeof sActive !== "undefined" && sActive
        && typeof sStop === "function") {
      sStop();
    }
    // Laufende Datei-Wiedergabe sauber stoppen, bevor die neue Datei
    // dekodiert wird. Kein Autostart — der Nutzer drückt Play selbst.
    if (pPlaying || pSrc || pCurrentPlayback) {
      pStopReset();
    }
    try {
      const c = gPC();
      const buf = await f.arrayBuffer();
      pFileBuf = await c.decodeAudioData(buf);
      pSetPlaybackMode("file");
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
      document.getElementById("plCur").textContent = "0:00";
      document.getElementById("plTL").value = 0;
      document.getElementById("plCtrl").style.display = "";
      pBuildEQ();
      pDrawEQ();
      pBuildTbl();
      document.getElementById("plEqViz").style.display = "";
      // Warp neu berechnen wenn aktiv
      if (typeof pWarpOn !== "undefined" && pWarpOn) {
        pWarpTrigger();
      }
    } catch (err) {
      alert("Error: " + err.message);
    }
  });
```

Aenderung: zwischen dem `sStop()`-Block und dem `try {`-Block den
`pStopReset()`-Aufruf einfuegen (mit Vorab-Pruefung, damit nicht jedes
Datei-Laden ohne laufende Wiedergabe das UI unnoetig anfasst).
`pStopReset` ist in `player.js` Zeile 618 definiert und setzt
`pPlaying`/`pSrc`/`pCurrentPlayback` korrekt zurueck.

---

## Akzeptanztest-Checkliste

Folgende Schritte fuer **jedes** der beiden Offline-Verfahren
durchspielen — einmal mit `Verfahren: Offline (vor Wiedergabe)`, einmal
mit `Verfahren: Rubberband (vor Wiedergabe)`:

**A) Warp-Toggle bei geladener, gestoppter Audiodatei**
1. Tab `Player` oeffnen, eine Audiodatei laden, **nicht** abspielen.
2. Frequenzabgleich-Messungen muessen vorhanden sein (sonst zeigt das
   Warp-UI nur "noch keine Daten" und ueberspringt die Berechnung —
   das ist nicht der Testfall).
3. Verfahren im Dropdown waehlen.
4. `Frequenz-Warping aktivieren` klicken.
   - **Erwartet:** Status-Anzeige in der Warping-Box wechselt auf
     "wird berechnet ..." (`pwStatusBusy`), Play-Button ist grau /
     deaktiviert. Nach Abschluss zeigt der Status den fertigen Buffer
     ("aktiv — n Messungen"), Play-Button wird wieder klickbar.
5. `Frequenz-Warping aktivieren` erneut klicken (Aus).
   - **Erwartet:** Status auf "bereit" zurueck, Play-Button klickbar.

**B) Warp-Toggle bei laufender Wiedergabe**
1. Audio laden, Play druecken — Datei spielt.
2. `Frequenz-Warping aktivieren` klicken.
   - **Erwartet:** Wiedergabe pausiert, Play-Button grau, Status zeigt
     "wird berechnet ...". Nach Abschluss laeuft Wiedergabe automatisch
     fort mit gewarptem Buffer.
3. Waehrend Wiedergabe `Frequenz-Warping aktivieren` erneut klicken
   (Aus).
   - **Erwartet:** Kurze hoerbare Luecke, Wiedergabe laeuft ohne Warp
     weiter (Originalspur).
4. Erneut `Ein` — Erwartung wie 2 (Buffer muesste eigentlich noch da
   sein, falls nicht: kurze Berechnung).

**C) EQ-Toggle bei aktivem Warp und laufender Wiedergabe**
1. Warp aktiv, Buffer fertig berechnet, Wiedergabe laeuft.
2. EQ-Toggle auf "Aus" klicken.
   - **Erwartet:** Kurze Luecke, danach laeuft die Original-Datei
     (ungewarpt, keine EQ-Filterung).
3. EQ-Toggle auf "Ein" zurueck.
   - **Erwartet:** Kurze Luecke, danach laeuft die gewarpte Datei mit
     EQ wieder.

**D) Methodenwechsel bei aktivem Warp**
1. Warp aktiv mit Verfahren "Vocoder" (live, keine Vorberechnung),
   Wiedergabe laeuft.
2. Verfahren auf "Rubberband" wechseln.
   - **Erwartet:** Wiedergabe pausiert, Play-Button grau,
     "wird berechnet ...". Nach Abschluss laeuft Wiedergabe mit
     Rubberband-Buffer fort.
3. Verfahren zurueck auf "Vocoder".
   - **Erwartet:** Wechsel an aktueller Position, kurze Luecke,
     Wiedergabe laeuft mit Vocoder.

**E) Parameter-Aenderung (Modus/Staerke) bei aktivem Rubberband**
1. Warp aktiv, Verfahren Rubberband, Wiedergabe laeuft.
2. `Korrektur-Modus` umschalten (z.B. von "links" auf "rechts").
   - **Erwartet:** Pause, "wird berechnet", danach laeuft Wiedergabe
     mit neu gewarptem Buffer fort.
3. `Staerke` auf einen anderen Wert setzen (z.B. 50 → 100).
   - **Erwartet:** Pause, "wird berechnet", neue Wiedergabe.

**F) Audiodatei-Wechsel waehrend Wiedergabe**
1. Audio A laden, Play druecken — laeuft.
2. Audio B ueber den Datei-Button auswaehlen.
   - **Erwartet:** Wiedergabe von A stoppt sofort, Player ist
     gestoppt (kein Autostart), Position auf 0:00, Gesamtdauer
     entspricht Audio B.
3. Bei aktivem Warp: Status zeigt "wird berechnet ..." waehrend
   Audio B gewarpt wird; Play-Button bleibt grau bis fertig.

**G) Regression — Verhalten von "Offline" unveraendert**
1. Schritte A-F mit Verfahren `Offline (vor Wiedergabe)`
   wiederholen.
   - **Erwartet:** Alle Punkte verhalten sich identisch wie mit
     Rubberband. Keine Unterschiede zum bisherigen Verhalten von
     "Offline".

**H) Regression — Vocoder und Bandshift unveraendert**
1. Verfahren "Vocoder": Toggle-Ein bei laufender Wiedergabe.
   - **Erwartet:** Kein Berechnen-Status, kein Sperren des
     Play-Buttons (Live-Verfahren), kurze Luecke beim Pfadwechsel,
     dann gewarpte Live-Wiedergabe.
2. Verfahren "Bandshift" analog.
   - **Erwartet:** Wie Vocoder, ebenfalls ohne Vorberechnung.

---

## Selbstpruefungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanzkriterie aus der obigen Liste
einzeln durchgehen und in der Build-Meldung pro Kriterie melden:
**erfuellt / nicht erfuellt / unklar**, jeweils mit Datei- und
Zeilenangabe der relevanten Code-Stelle, die die Erwartung tragen
soll. Bei "unklar" Ruekfrage stellen, statt anzunehmen.

Insbesondere pruefen:
- Schritt 3: Im else-Pfad ab Zeile 424 wird beim Ausschalten
  (`!pWarpOn`) `pWarpedBuf = null` gesetzt. Greift das auch fuer
  Rubberband? (Ja — der else-Pfad bleibt unveraendert und behandelt
  alle Ausschalt-Faelle einheitlich.)
- Schritt 6: `pStopReset` existiert in `js/player.js` Zeile 618 und
  ist im Scope erreichbar (oeffentliche Funktion, top-level definiert).
- Keine weiteren Stellen im Code mit `method === "offline"`-Checks,
  die ebenfalls Rubberband mit beruecksichtigen muessten? Mit
  `grep -n '"offline"' js/` gegenpruefen. Stellen in
  `js/freq-warp.js` (z.B. innerhalb `pWarpTrigger` selbst) verwenden
  bereits eine andere Logik (`method !== "offline" && method !== "rubberband"`,
  Zeile 1499) — die ist bereits korrekt.

---

## Hinweise

- **Keine i18n-Aenderungen** in dieser Bauanleitung. Alle bestehenden
  Status-Strings (`pwStatusBusy`, `pwStatusActiveRubberband` etc.)
  decken das geaenderte Verhalten ab.
- **Keine Spec-Aenderung noetig** — `docs/SPEC.md`/`docs/spec/` und
  `docs/CODESTRUKTUR.md` beschreiben das Verhalten bereits passend
  (Rubberband ist als Offline-Verfahren dokumentiert). Wenn beim
  Bauen auffaellt, dass dort doch eine Stelle Rubberband als
  Live-Verfahren klassifiziert: bitte sofort korrigieren.
- **Keine Tests in `js/debug-tests-current.js` noetig** — der
  Akzeptanztest ist reines UI-Klick-Verhalten, das der Nutzer in 5
  Minuten manuell durchgeht.
