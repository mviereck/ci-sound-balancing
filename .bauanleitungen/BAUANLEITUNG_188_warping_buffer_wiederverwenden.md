# Bauanleitung 188 — Frequenz-Warping: Fertigen Buffer beim An/Aus-Toggle wiederverwenden

## Kontext

Nach BA 187 wird beim Wieder-Einschalten von Warp im gleichen Audio
unnoetig neu berechnet. Ursache: Beim Ausschalten wird `pWarpedBuf` in
`js/init.js` Zeile 429 explizit auf `null` gesetzt; beim Einschalten ruft
der Klick-Handler unbedingt `pWarpTrigger()`, der den Buffer auch wieder
am Anfang auf `null` setzt und neu berechnet.

Gewuenschtes Verhalten: Solange ein gueltiger fertig berechneter Buffer
vorliegt und sich nichts an den Eingangsparametern (Methode, Mode,
Staerke, Audio-Datei) geaendert hat, soll der Buffer ueber beliebig viele
An/Aus-Toggles erhalten bleiben und wiederverwendet werden.

Drei Code-Stellen sind betroffen, alle in `js/init.js`. Reines
Verhalten-Fix, keine UI- oder Persistenz-Aenderung, keine
Spec-Aktualisierung noetig.

**Wann der Buffer verworfen werden muss (Invalidierungs-Triggerpunkte):**

| Ereignis                         | Verwerfen?  | Wo bereits abgedeckt                              |
|----------------------------------|-------------|---------------------------------------------------|
| Audio-Datei wechselt             | Ja          | `pSetPlaybackMode` in `player.js:152` (Bestand)  |
| Methode wechselt (Dropdown)      | Ja, IMMER   | Aktuell luekig — Schritt 3 dieser BA              |
| Mode wechselt (links/rechts/etc) | Ja, IMMER   | Aktuell luekig — Schritt 4 dieser BA              |
| Staerke wechselt                 | Ja, IMMER   | Aktuell luekig — Schritt 4 dieser BA              |
| `pWarpTrigger` lauft an          | Ja          | `freq-warp.js:1478` (Bestand, am Anfang setzt es null) |
| Berechnungsfehler                | Ja          | `freq-warp.js:1529` (Bestand)                     |
| JSON-Load eines Speicherstands   | Ja          | `file.js:625` (Bestand)                           |
| Warp aus-Toggle                  | **Nein**    | Schritt 2 dieser BA                               |

Die drei „IMMER"-Faelle bedeuten: auch wenn Warp gerade aus ist, muss
`pWarpedBuf` invalidiert werden — sonst wird beim naechsten Einschalten
ein stale Buffer wiederverwendet, der nicht zu den neuen Parametern
passt.

---

## Schritt 1: Versions-Bump

**Datei:** `js/version.js`

**Vorher:**
```js
const APP_VERSION = "3.2.187-beta";
```

**Nachher:**
```js
const APP_VERSION = "3.2.188-beta";
```

(Wenn waehrend BA 187 nachgereicht wurde und die Version jetzt
`3.2.187.1-beta` o.ae. ist: in diesem Schritt trotzdem auf
`3.2.188-beta` setzen.)

---

## Schritt 2: Warp-Toggle — Buffer beim Ausschalten erhalten, beim Einschalten nicht doppelt berechnen

**Datei:** `js/init.js`, Klick-Handler `plWarpOn` (ungefaehr Zeilen 412-437
nach Stand BA 187).

Zwei Aenderungen in diesem Handler:

(a) **Im Offline-Einschalt-Sonderpfad** nur dann `pWarpTrigger` rufen,
    wenn kein gueltiger Buffer vorliegt.

(b) **Im allgemeinen else-Pfad** die Zeile entfernen, die beim
    Ausschalten `pWarpedBuf = null` setzt.

**Vorher (Stand nach BA 187):**
```js
  // ---- Frequenz-Warping Listener ----
  // Warp-Checkbox
  document.getElementById("plWarpOn").addEventListener("click", function () {
    pWarpOn = !pWarpOn;
    pWarpUpdUI();
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
    // Sonst (Vocoder/Bandshift ein oder beliebig aus): Pfadwechsel an aktueller
    // Position. Symmetrisch in beide Toggle-Richtungen, damit Einschalten genauso
    // wirkt wie Ausschalten.
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    if (!pWarpOn) pWarpedBuf = null;
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
  // ---- Frequenz-Warping Listener ----
  // Warp-Checkbox
  document.getElementById("plWarpOn").addEventListener("click", function () {
    pWarpOn = !pWarpOn;
    pWarpUpdUI();
    const method = document.getElementById("plWarpMethod").value;
    // Offline-Verfahren einschalten (offline, rubberband) OHNE gueltigen
    // Buffer: Vorberechnung anstossen. pWarpTrigger regelt Vorberechnung +
    // pause/resume + Play-Sperre selbst. Wenn schon ein gueltiger Buffer
    // vorliegt (z.B. weil der Nutzer Warp gerade nur aus- und wieder
    // einschaltet), faellt der Code in den allgemeinen Pfad weiter unten
    // und verwendet den vorhandenen Buffer ohne Neuberechnung.
    if (pWarpOn && (method === "offline" || method === "rubberband") && !pWarpedBuf) {
      pWarpTrigger();
      if (typeof drawLvChart === "function") drawLvChart();
      if (typeof pDrawEQ === "function") pDrawEQ();
      if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
      return;
    }
    // Sonst (Vocoder/Bandshift ein/aus, Offline-Verfahren ein mit vorhandenem
    // Buffer, Offline-Verfahren aus): Pfadwechsel an aktueller Position.
    // pWarpedBuf bleibt erhalten, damit erneutes Einschalten ohne
    // Neuberechnung moeglich ist. Invalidierung geschieht nur in
    // pWarpTrigger (Mode/Staerke/Methodenwechsel) und in pSetPlaybackMode
    // (Audiodatei-/Saetze-Wechsel).
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

Aenderungen im Detail:
- Bedingung des Sonderpfads erweitert um `&& !pWarpedBuf`.
- Kommentare des Sonderpfads und des else-Pfads aktualisiert.
- Im else-Pfad die Zeile `if (!pWarpOn) pWarpedBuf = null;` **entfernt**.

`getPlaybackBuffer()` (in `player.js`) prueft selbst `pWarpOn && plEqOn
&& pWarpedBuf && !pWarpBusy && (method ist offline oder rubberband)` —
beim Ausschalten greift `pWarpOn=false` und der Original-Buffer wird
zurueckgegeben. Beim Wieder-Einschalten greift alles, und der gewarpte
Buffer wird ohne Neuberechnung verwendet.

---

## Schritt 3: Methoden-Dropdown — Buffer bei jedem Methodenwechsel verwerfen

**Datei:** `js/init.js`, Change-Handler `plWarpMethod`
(ungefaehr Zeilen 439-460 nach Stand BA 187).

Aktuell ruft der Handler `pWarpTrigger` nur, wenn `pWarpOn=true` UND auf
Offline/Rubberband gewechselt wurde. Damit ist ein Wechsel der Methode
**bei deaktiviertem Warp** stumm — der fertige Buffer bleibt erhalten,
gehoert aber zur alten Methode. Beim naechsten Einschalten greift Schritt
2 und wuerde den stale Buffer wiederverwenden.

Fix: Direkt am Anfang des Handlers `pWarpedBuf = null;` setzen, sodass
jede Methode-Aenderung den Buffer als ungueltig markiert. `pWarpTrigger`
am Ende rechnet bei aktivem Warp ohnehin neu (und setzt selbst nochmal
auf null — schadet nicht).

**Vorher (Stand nach BA 187):**
```js
  // Verfahren-Dropdown
  document.getElementById("plWarpMethod").addEventListener("change", function () {
    // Methoden-Labels neu setzen (data-t-opt)
    _pWarpApplyMethodLabels();
    pWarpUpdUI();
    // Vocoder vorab laden, damit das await im pPlay nach dem ersten Mal nicht
    // mehr blockt — entkrampft den Toggle-Pfad.
    if ((this.value === "vocoder" || this.value === "sinmodel") &&
        typeof pInitWarpWorklet === "function") {
      try { pInitWarpWorklet(gPC()); } catch (e) {}
    }
    if (!pWarpOn) return;
    if (this.value === "offline" || this.value === "rubberband") {
      pWarpTrigger();
      return;
    }
    // Methodenwechsel bei aktivem Warp: laufende Wiedergabe auf neuen Pfad bringen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  });
```

**Nachher:**
```js
  // Verfahren-Dropdown
  document.getElementById("plWarpMethod").addEventListener("change", function () {
    // Methodenwechsel: ein fertig berechneter Buffer gehoert immer zur
    // alten Methode (offline-Buffer != rubberband-Buffer). Sofort
    // invalidieren — auch wenn Warp gerade aus ist, sonst wuerde der
    // stale Buffer beim naechsten Einschalten faelschlich wiederverwendet.
    pWarpedBuf = null;
    // Methoden-Labels neu setzen (data-t-opt)
    _pWarpApplyMethodLabels();
    pWarpUpdUI();
    // Vocoder vorab laden, damit das await im pPlay nach dem ersten Mal nicht
    // mehr blockt — entkrampft den Toggle-Pfad.
    if ((this.value === "vocoder" || this.value === "sinmodel") &&
        typeof pInitWarpWorklet === "function") {
      try { pInitWarpWorklet(gPC()); } catch (e) {}
    }
    if (!pWarpOn) return;
    if (this.value === "offline" || this.value === "rubberband") {
      pWarpTrigger();
      return;
    }
    // Methodenwechsel bei aktivem Warp: laufende Wiedergabe auf neuen Pfad bringen
    const wasPlaying = pPlaying;
    if (wasPlaying) pPause();
    pBuf = getPlaybackBuffer();
    pWarpUpdUI();
    if (wasPlaying) pPlay();
  });
```

Aenderung: Eine einzige Zeile `pWarpedBuf = null;` ganz am Anfang des
Handlers ergaenzt, davor erlaeuternder Kommentar.

---

## Schritt 4: Parameter-Aenderungen (Mode/Staerke) — Buffer immer verwerfen

**Datei:** `js/init.js`, Hilfsfunktion `_pWarpParamsChanged`
(ungefaehr Zeilen 465-482 nach Stand BA 187).

Aktuell returnt die Funktion fruh bei `!pWarpOn` und laesst einen
vorhandenen Buffer unangetastet. Bei Mode-/Staerke-Aenderungen waehrend
deaktiviertem Warp bleibt der Buffer also mit alten Parametern liegen —
beim naechsten Einschalten waere er stale.

Fix: Direkt am Anfang der Funktion `pWarpedBuf = null;` setzen.
`pWarpTrigger` (im Aktiv-Zweig) wuerde das ohnehin tun; bei
`!pWarpOn`-Return greift jetzt zusaetzlich die Invalidierung.

**Vorher (Stand nach BA 187):**
```js
  // Gemeinsamer Reaktor auf Parameteränderungen (Modus, Stärke):
  // - Offline: Vorberechnung neu anstoßen (pWarpTrigger regelt pause/resume)
  // - Vocoder: knackfreier postMessage-Update an laufenden Worklet
  // - Bandshift: Graph-Rebuild via pause/resume (kurze Unterbrechung)
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

**Nachher:**
```js
  // Gemeinsamer Reaktor auf Parameteränderungen (Modus, Stärke):
  // - Offline: Vorberechnung neu anstoßen (pWarpTrigger regelt pause/resume)
  // - Vocoder: knackfreier postMessage-Update an laufenden Worklet
  // - Bandshift: Graph-Rebuild via pause/resume (kurze Unterbrechung)
  function _pWarpParamsChanged() {
    // Parameter haben sich geaendert: fertiger Buffer (falls vorhanden)
    // passt nicht mehr zu Mode/Staerke. Sofort invalidieren — auch wenn
    // Warp gerade aus ist, sonst wuerde der stale Buffer beim naechsten
    // Einschalten faelschlich wiederverwendet.
    pWarpedBuf = null;
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

Aenderung: Eine einzige Zeile `pWarpedBuf = null;` ganz am Anfang der
Funktion ergaenzt, davor erlaeuternder Kommentar.

---

## Akzeptanztest-Checkliste

Tests fuer **jedes** Offline-Verfahren einzeln durchspielen — einmal mit
`Verfahren: Offline (vor Wiedergabe)`, einmal mit
`Verfahren: Rubberband (vor Wiedergabe)`.

Frequenzabgleich-Messungen muessen vorhanden sein.

**A) Warp wiederholt an/aus toggeln — keine Neuberechnung nach erster**
1. Audio laden, Verfahren waehlen, Warp einschalten.
   - **Erwartet:** Status "wird berechnet ...", Play grau, dann fertig.
2. Warp ausschalten.
   - **Erwartet:** Status "bereit", kein Berechnen-Status, kein Sperren.
3. Warp wieder einschalten.
   - **Erwartet:** **KEIN** "wird berechnet ..."-Status. Status sofort
     "aktiv — n Messungen" o.ae., Play-Button sofort klickbar.
4. Warp aus, an, aus, an, aus, an — beliebig oft toggeln.
   - **Erwartet:** Nur das **erste** Einschalten triggert die
     Berechnung; danach instant.

**B) Toggle bei laufender Wiedergabe — Buffer bleibt erhalten**
1. Audio laden, Warp einschalten (Berechnung laeuft), Play druecken.
   Wiedergabe laeuft gewarpt.
2. Warp ausschalten waehrend Wiedergabe.
   - **Erwartet:** Kurze Luecke, danach Original.
3. Warp wieder einschalten waehrend Wiedergabe.
   - **Erwartet:** Kurze Luecke, danach gewarpt. **Kein** Pausieren
     fuer Neuberechnung — der vorhandene Buffer wird verwendet.

**C) Methodenwechsel verwirft den Buffer korrekt**
1. Verfahren Offline, Warp ein, Buffer berechnet.
2. Warp aus.
3. Verfahren auf Rubberband wechseln (waehrend Warp aus).
4. Warp wieder ein.
   - **Erwartet:** **Doch** "wird berechnet ..."-Status, weil der
     vorherige Buffer zur Offline-Methode gehoerte und beim
     Methodenwechsel invalidiert wurde.
5. Warp aus, ein.
   - **Erwartet:** Kein neues Berechnen — der Rubberband-Buffer wird
     wiederverwendet.

**D) Mode-/Staerke-Aenderung verwirft den Buffer korrekt**
1. Warp ein, Verfahren Rubberband, Buffer berechnet (z.B. Mode "rechts",
   Staerke 100).
2. Warp aus.
3. Mode auf "links" umschalten oder Staerke auf 50 setzen (waehrend
   Warp aus).
4. Warp wieder ein.
   - **Erwartet:** "wird berechnet ..." erscheint, weil die alten
     Parameter im Buffer nicht mehr passen.

**E) Audiodatei-Wechsel verwirft den Buffer korrekt**
1. Audio A laden, Warp ein, Buffer berechnet.
2. Warp aus.
3. Audio B laden (waehrend Warp aus).
4. Warp ein.
   - **Erwartet:** "wird berechnet ..." erscheint, weil Audio B nicht
     den Buffer von Audio A nutzen kann (`pSetPlaybackMode` setzt
     `pWarpedBuf = null` — bestehende Logik in `player.js:152`).

**F) Regression — Berechnung beim ersten Einschalten unveraendert**
1. Frische Session, Audio laden, Warp einschalten.
   - **Erwartet:** "wird berechnet ..." erscheint einmalig
     (unveraendert zu BA 187).

**G) Regression — Live-Verfahren unveraendert**
1. Verfahren Vocoder, Warp ein, Audio spielt.
2. Warp aus, ein.
   - **Erwartet:** Kein "wird berechnet ..." (Vocoder hat keine
     Vorberechnung — unveraendert zu BA 187).

---

## Selbstpruefungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanzkriterie A-G einzeln durchgehen und
in der Build-Meldung pro Kriterie melden: **erfuellt / nicht erfuellt /
unklar**, mit Datei- und Zeilenangabe der relevanten Code-Stelle.

Insbesondere pruefen:
- Schritt 2: Die Bedingung `pWarpOn && (method === "offline" ||
  method === "rubberband") && !pWarpedBuf` greift in dieser Reihenfolge
  korrekt (truthy-Pruefung auf `pWarpedBuf` ist OK — `null` ist falsy,
  `AudioBuffer` ist truthy).
- Schritt 2: Die Zeile `if (!pWarpOn) pWarpedBuf = null;` wurde wirklich
  entfernt (keine versehentliche Beibehaltung).
- Schritt 3/4: `pWarpedBuf = null;` steht **vor** den `if (!pWarpOn)
  return;`-Returns, sonst greift die Invalidierung bei deaktiviertem
  Warp nicht.
- Keine weiteren Stellen im Code, die `pWarpedBuf` setzen und durch die
  Aenderungen verwaist wuerden: `grep -n "pWarpedBuf" js/` durchgehen.
  Erwartete Setter nach BA 188:
  - `js/file.js`: 1x bei JSON-Load (Bestand)
  - `js/freq-warp.js`: 2x in pWarpTrigger (Bestand, Anfang + Fehler)
  - `js/init.js`: 2x in plWarpMethod-change und _pWarpParamsChanged
    (neu in dieser BA)
  - `js/player.js`: 1x in pSetPlaybackMode (Bestand)
  - Die Zeile `if (!pWarpOn) pWarpedBuf = null;` im plWarpOn-Handler
    (Bestand vor BA 188) ist **entfernt**.

---

## Hinweise / Bekannte Grenze

Diese BA invalidiert den Buffer **nicht** bei Aenderungen der
Frequenzabgleich-Daten (`_warpFResSource()`-Inhalt). Wenn der Nutzer
waehrend deaktiviertem Warp eine neue Messung einfuegt oder eine alte
loescht, koennte beim naechsten Einschalten der Buffer mit veralteten
Frequenzpunkten wiederverwendet werden. Dasselbe Problem besteht auch
bei aktivem Warp (Buffer wird bei neuer Messung nicht automatisch neu
berechnet). Loesung waere ein expliziter "Neu berechnen"-Button oder
ein Hash-Vergleich der fRes-Daten; das ist eine separate Diskussion und
nicht Teil dieser BA. Falls der Bug in der Praxis stoert: separate
Bauanleitung.

Keine i18n-Aenderungen. Keine Spec-Aenderung noetig. Keine Debug-Tests
in `js/debug-tests-current.js` noetig — der Akzeptanztest ist reines
UI-Klick-Verhalten.
