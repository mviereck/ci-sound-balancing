# Bauanleitung 25: Latenz-Messung — Engine + Audio-Graph

Erste von drei Bauanleitungen für die neue Latenz-Messung. Diese
hier baut **nur die Audio-Engine** auf. Es gibt nach diesem Build
noch keinen Sub-Tab und keine UI — die Engine wird über die
Browser-Konsole getestet.

Bauanleitung 26 baut den Messung-Sub-Tab und die UI, Bauanleitung
27 die Persistenz, Ergebnis-Anzeige und Druck.

## Ziel dieses Builds

- Neues Modul `latency.js` mit State, Buffer-Generatoren für Klick
  und Tone-Bursts, Start/Stop des Test-Audios, Live-Slider-Wert
  in DelayNodes übertragen.
- Erweiterung des Player-Audio-Graphen um zwei `DelayNode`s
  (Stereo-Pfad nach `pGain`), damit das Korrektur-Delay live auf
  alle Player-Quellen wirkt.
- Globaler State `latencyResult` (1 Zahl mit Kontext) und Toggle
  `plApplyLatency`.
- Test-Klick-Quelle, die ebenfalls durch die DelayNodes geht, so
  daß der Schieber-Wert während des Tests live hörbar ist.

## Architektur-Überblick

Der aktuelle Player-Graph endet so:

```
[Quellen] → [EQ/MAPLAW/...] → pGain → c.destination
```

Nachher:

```
[Quellen] → [EQ/MAPLAW/...] → pGain → pLatSplitter ─┬→ pLatDelayL → pLatMerger → c.destination
                                                    └→ pLatDelayR → pLatMerger
                              ↑
[Test-Klicks] ────────────────┘
```

Test-Klicks hängen an `pGain` (gleicher Eingang wie der normale
Player-Pfad), gehen also durch dieselben Latenz-Delays. Der
Volume-Slider wirkt damit auch auf die Test-Klicks.

`pLatDelayL.delayTime` und `pLatDelayR.delayTime` werden so
gesetzt, daß der Schieber-Wert direkt die Differenz steuert:

- Schieber-Wert **+5 ms** (positiv) → `pLatDelayL = 0.005 s`,
  `pLatDelayR = 0` → linker Kanal kommt 5 ms später
- Schieber-Wert **−5 ms** (negativ) → `pLatDelayL = 0`,
  `pLatDelayR = 0.005 s` → rechter Kanal kommt 5 ms später
- Schieber-Wert **0** → beide auf 0

Konvention: Schieber-Wert positiv = linke Seite verzögern.

## Schritt 1 — Neue Datei `latency.js` anlegen

Im Projekt-Root die Datei `latency.js` mit folgendem Inhalt
anlegen:

```js
// ====================================================================
// latency.js — Latenz-Messung (Inter-Ohr-Zeitversatz)
// --------------------------------------------------------------------
// Exportierte Globals:
//   latencyResult           {valueMs, clickType, intervalMs} | null
//   plApplyLatency          bool — im Player anwenden?
//   latSliderMs             aktuell vom UI gesetzter Wert (Live-Test)
//   latActive               Test läuft gerade?
//   latClickType            "click" | "burst500" | "burst1500" | "burst4000"
//   latIntervalMs           Klick-Intervall in ms (manuell wählbar)
//   latAltMode              true wenn "abwechselnd"-Modus aktiv
//
//   pLatSplitter, pLatDelayL, pLatDelayR, pLatMerger
//                           — Audio-Nodes, werden in player.js
//                             eingehängt (siehe Schritt 3 unten)
//
// Exportierte Funktionen:
//   latBuildClickBuffer(ctx)
//   latBuildBurstBuffer(ctx, freqHz, durMs)
//   latBuildLoopedTestBuffer(ctx, clickType, intervalMs, altMode)
//   latStartTest()
//   latStopTest()
//   latSetSliderMs(ms)
//   latApplyToPlayer()
//   latInitGraph(ctx)
// ====================================================================

let latencyResult = null;      // {valueMs, clickType, intervalMs}
let plApplyLatency = true;     // analog plApplyBalance

let latSliderMs = 0;           // aktueller Schieber-Wert (Test-Live)
let latActive = false;
let latClickType = "click";
let latIntervalMs = 100;
let latAltMode = false;        // "abwechselnd" Klick-Folge ↔ Einzelklick

let latTestSource = null;      // BufferSource für Test-Klicks
let latTestBuf = null;         // aktuell verwendeter Loop-Buffer

let pLatSplitter = null;
let pLatDelayL = null;
let pLatDelayR = null;
let pLatMerger = null;

// --- Buffer-Generatoren ----------------------------------------------

// 1-ms-Klick, breitbandig, Hann-gefenstert um Knack-Artefakte zu
// vermeiden. Stereo (L=R), damit er gleichmäßig durch die Delays
// geht.
function latBuildClickBuffer(ctx) {
  const sr = ctx.sampleRate;
  const samples = Math.max(2, Math.round(sr * 0.001));  // 1 ms
  const buf = ctx.createBuffer(2, samples, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  for (let i = 0; i < samples; i++) {
    // Hann-Fenster auf weißes Rauschen
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples - 1)));
    const v = (Math.random() * 2 - 1) * w;
    L[i] = v;
    R[i] = v;
  }
  return buf;
}

// Tone-Burst mit Hann-Fenster, n Perioden, mindestens 3.
function latBuildBurstBuffer(ctx, freqHz, durMs) {
  const sr = ctx.sampleRate;
  const samples = Math.max(8, Math.round(sr * durMs / 1000));
  const buf = ctx.createBuffer(2, samples, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);
  const omega = 2 * Math.PI * freqHz / sr;
  for (let i = 0; i < samples; i++) {
    const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples - 1)));
    const v = Math.sin(omega * i) * w * 0.9;
    L[i] = v;
    R[i] = v;
  }
  return buf;
}

// Komplettes Loop-Buffer: Klick(s) + Pause, fertig zum Schleifen.
// Bei altMode=true wechselt Block: 3 s Klickfolge → 1 s Stille
// → 1× Einzelklick → 1 s Stille → wiederholen.
function latBuildLoopedTestBuffer(ctx, clickType, intervalMs, altMode) {
  const sr = ctx.sampleRate;

  // Einzel-Klick-Buffer (1 Klick) auswählen
  let click;
  switch (clickType) {
    case "burst500":  click = latBuildBurstBuffer(ctx, 500,  6); break;
    case "burst1500": click = latBuildBurstBuffer(ctx, 1500, 4); break;
    case "burst4000": click = latBuildBurstBuffer(ctx, 4000, 3); break;
    case "click":
    default:          click = latBuildClickBuffer(ctx);
  }
  const cL = click.getChannelData(0);
  const cN = click.length;

  // Hilfsfunktion: Klick an Position in Output schreiben
  function placeClick(outL, outR, pos) {
    const end = Math.min(outL.length, pos + cN);
    for (let i = pos; i < end; i++) {
      const v = cL[i - pos];
      outL[i] += v;
      outR[i] += v;
    }
  }

  let totalSamples;
  let segments;  // Liste von Klick-Positionen

  if (altMode) {
    // 3 s Klickfolge + 1 s Stille + 1 Klick + 1 s Stille
    const blockSec   = 3;
    const silenceSec = 1;
    totalSamples = Math.round(sr * (blockSec + silenceSec + 0 + silenceSec));
    segments = [];
    const intSamp = Math.max(cN + 1, Math.round(sr * intervalMs / 1000));
    let p = 0;
    const blockEnd = Math.round(sr * blockSec);
    while (p + cN < blockEnd) {
      segments.push(p);
      p += intSamp;
    }
    // Einzelklick mittig im 2. Silence-Block? Wir setzen ihn an
    // Position = blockEnd + silenceSec (also direkt nach 1 s Stille).
    segments.push(Math.round(sr * (blockSec + silenceSec)));
  } else {
    // Klickfolge: Intervall-langer Loop, ein Klick pro Loop
    const intSamp = Math.max(cN + 1, Math.round(sr * intervalMs / 1000));
    totalSamples = intSamp;
    segments = [0];
  }

  const out = ctx.createBuffer(2, totalSamples, sr);
  const oL = out.getChannelData(0);
  const oR = out.getChannelData(1);
  for (const pos of segments) placeClick(oL, oR, pos);
  return out;
}

// --- Audio-Graph einrichten ------------------------------------------

// Wird einmalig aus player.js aufgerufen, sobald pGain existiert.
// Hängt die Latenz-Delays zwischen pGain und c.destination ein.
function latInitGraph(ctx) {
  if (pLatSplitter) return; // schon initialisiert

  pLatSplitter = ctx.createChannelSplitter(2);
  pLatMerger   = ctx.createChannelMerger(2);
  pLatDelayL   = ctx.createDelay(0.2); // max 200 ms reicht für ±50 ms range plus Reserve
  pLatDelayR   = ctx.createDelay(0.2);
  pLatDelayL.delayTime.value = 0;
  pLatDelayR.delayTime.value = 0;

  pLatSplitter.connect(pLatDelayL, 0);
  pLatSplitter.connect(pLatDelayR, 1);
  pLatDelayL.connect(pLatMerger, 0, 0);
  pLatDelayR.connect(pLatMerger, 0, 1);
  pLatMerger.connect(ctx.destination);

  // Wenn schon ein Wert gemessen wurde, anwenden.
  latApplyToPlayer();
}

// --- Test-Klicks Start/Stop ------------------------------------------

function latStartTest() {
  if (latActive) latStopTest();
  const ctx = (typeof gPC === "function") ? gPC() : null;
  if (!ctx) return;
  // Falls Musik/Sätze laufen: stoppen, damit der Test nicht überlagert
  if (typeof pPlaying !== "undefined" && pPlaying && typeof pPause === "function") {
    pPause();
  }
  if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") {
    sStop();
  }
  latTestBuf = latBuildLoopedTestBuffer(
    ctx, latClickType, latIntervalMs, latAltMode
  );
  latTestSource = ctx.createBufferSource();
  latTestSource.buffer = latTestBuf;
  latTestSource.loop = true;
  // Direkt an pGain — geht durch Lautstärke-Regler und durch die
  // Latenz-Delays. Falls pGain noch nicht existiert, an die
  // Latenz-Kette direkt anschließen (Fallback).
  if (typeof pGain !== "undefined" && pGain) {
    latTestSource.connect(pGain);
  } else if (pLatSplitter) {
    latTestSource.connect(pLatSplitter);
  } else {
    latTestSource.connect(ctx.destination);
  }
  latTestSource.start();
  latActive = true;
}

function latStopTest() {
  if (latTestSource) {
    try { latTestSource.stop(); } catch (e) {}
    try { latTestSource.disconnect(); } catch (e) {}
    latTestSource = null;
  }
  latTestBuf = null;
  latActive = false;
}

// Wird bei laufendem Test aufgerufen, wenn der User Klick-Typ,
// Intervall oder Abwechseln-Modus ändert. Buffer neu bauen und
// Wiedergabe neu starten.
function latRestartIfActive() {
  if (latActive) {
    latStopTest();
    latStartTest();
  }
}

// --- Live-Slider-Wert in Delays ---------------------------------------

function latSetSliderMs(ms) {
  latSliderMs = ms;
  if (!pLatDelayL || !pLatDelayR) return;
  const sec = Math.abs(ms) / 1000;
  if (ms >= 0) {
    pLatDelayL.delayTime.value = sec;
    pLatDelayR.delayTime.value = 0;
  } else {
    pLatDelayL.delayTime.value = 0;
    pLatDelayR.delayTime.value = sec;
  }
}

// --- Anwendung auf Player (kein Test aktiv) --------------------------

// Setzt die Delays auf den gespeicherten latencyResult-Wert, falls
// plApplyLatency aktiv ist. Wird vom Test-Start/Stop und vom
// plApplyLatency-Toggle aufgerufen.
function latApplyToPlayer() {
  if (latActive) return; // während Test übernimmt latSetSliderMs
  if (!pLatDelayL || !pLatDelayR) return;
  if (plApplyLatency && latencyResult && isFinite(latencyResult.valueMs)) {
    latSetSliderMs(latencyResult.valueMs);
  } else {
    pLatDelayL.delayTime.value = 0;
    pLatDelayR.delayTime.value = 0;
  }
}
```

## Schritt 2 — `latency.js` in `index.html` einbinden

In `index.html`, im Script-Loader-Array (etwa Z. 26–30), Eintrag
`'lr-balance.js'` durch `'lr-balance.js', 'latency.js'` ersetzen.

Vorher:
```js
'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'sentences.js', 'init.js'
```

Nachher:
```js
'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'latency.js', 'sentences.js', 'init.js'
```

Reihenfolge ist wichtig: `latency.js` muß **nach** `player.js`
geladen werden (greift auf `pGain` zu) und **vor** `init.js`
(damit init.js bei Bedarf darauf zugreifen kann).

## Schritt 3 — Player-Audio-Graph erweitern

In `player.js`, **Funktion `pBuildEQ`**, an die Stelle wo `pGain`
erstellt wird:

Vorher (etwa Z. 303–307):
```js
if (!pGain) {
  pGain = c.createGain();
  pGain.gain.value = parseInt(document.getElementById("plVol").value) / 100;
  pGain.connect(c.destination);
}
```

Nachher:
```js
if (!pGain) {
  pGain = c.createGain();
  pGain.gain.value = parseInt(document.getElementById("plVol").value) / 100;
  // Latenz-Kette zwischen pGain und destination einhängen
  if (typeof latInitGraph === "function") {
    latInitGraph(c);
    pGain.connect(pLatSplitter);
  } else {
    pGain.connect(c.destination);
  }
}
```

Das ist die einzige Änderung in `player.js`. Die Latenz-Kette ist
dauerhaft im Graph, ihre Wirkung wird über `pLatDelayL/R.delayTime`
gesteuert.

**Wichtig**: nirgendwo sonst in `player.js` darf `pGain` direkt
an `c.destination` angeschlossen werden. Suche im File nach allen
Vorkommen von `pGain.connect`:

```bash
grep -n "pGain\.connect" player.js
```

Es sollte nur **eine** Stelle geben — die oben geänderte. Andere
Stellen (z.B. in `pPlay`) verbinden Nodes mit `pGain`, das ist OK,
das ist der umgekehrte Pfeil.

## Schritt 4 — Konsolen-Hooks für den Akzeptanztest

Keine Code-Änderung nötig — alle Funktionen sind global im Scope
und über die Browser-Konsole aufrufbar.

## Akzeptanztest

Vorbereitung:
- Browser neu laden.
- DevTools-Konsole öffnen.
- Player-Tab öffnen, eine kurze MP3-Datei laden, Lautstärke auf
  ca. 50 %.
- Kabel-Kopfhörer aufsetzen, NICHT Bluetooth. (Sonst zeigt der
  Test andere Verzögerungen als der Code verursacht — die
  BT-Latenz-Differenz überlagert das Meß-Delay.)

### 1. Audio-Graph existiert
Konsole:
```js
console.log(pLatSplitter, pLatDelayL, pLatDelayR, pLatMerger)
```
Erwartet: vier nicht-`null` AudioNodes. Wenn alle `null`: pGain
wurde noch nicht erstellt — Musik kurz starten/stoppen.

### 2. Normale Wiedergabe geht weiter
Klick Musik-Play.
- Erwartet: Musik kommt aus beiden Kopfhörern wie bisher.

Konsole:
```js
console.log(pLatDelayL.delayTime.value, pLatDelayR.delayTime.value)
```
- Erwartet: beide 0 (noch kein Latenz-Wert gemessen oder
  angewendet).

### 3. Test-Klicks starten
Musik stoppen. Konsole:
```js
latIntervalMs = 100;
latClickType = "click";
latAltMode = false;
latStartTest();
```
- Erwartet: gleichmäßige Klicks, alle 100 ms, gleichzeitig L/R.
- `latActive` ist `true`.

### 4. Schieber live verändert L/R-Versatz
Mit laufenden Klicks:
```js
latSetSliderMs(20);   // links 20 ms später
```
- Erwartet: deutlich hörbar, daß die Klicks links später kommen
  als rechts. Bei 20 ms Versatz und 100 ms Intervall: zwei
  Klick-Reihen mit 20 ms Abstand.

```js
latSetSliderMs(-20);  // rechts 20 ms später
```
- Erwartet: andersrum.

```js
latSetSliderMs(0);
```
- Erwartet: wieder synchron.

### 5. Verschiedene Klangtypen, mit Restart
```js
latClickType = "burst500";
latRestartIfActive();
```
- Erwartet: Tieffrequenter Burst (klingt wie ein dumpfes „Bom"),
  Intervall unverändert.

```js
latClickType = "burst4000";
latRestartIfActive();
```
- Erwartet: hochfrequenter Burst (helles „Pieps").

```js
latClickType = "click";
latRestartIfActive();
```
- Erwartet: breitbandiger Klick.

### 6. Intervall ändern
```js
latIntervalMs = 500;
latRestartIfActive();
```
- Erwartet: deutlich langsamere Klickfolge.

```js
latIntervalMs = 30;
latRestartIfActive();
```
- Erwartet: sehr schnelle Klickfolge, klingt fast wie ein Ton.

### 7. Abwechseln-Modus
```js
latIntervalMs = 100;
latAltMode = true;
latRestartIfActive();
```
- Erwartet: 3 s Klickfolge, 1 s Stille, 1 Einzelklick, 1 s Stille,
  wiederholen.

### 8. Test stoppen
```js
latStopTest();
```
- Erwartet: Stille. `latActive` ist `false`.

### 9. Anwendung auf Player
```js
latencyResult = { valueMs: 15, clickType: "click", intervalMs: 100 };
plApplyLatency = true;
latApplyToPlayer();
```
Musik-Play.
- Erwartet: Musik kommt **links 15 ms später** als rechts.

```js
plApplyLatency = false;
latApplyToPlayer();
```
- Erwartet: Musik wieder synchron (Delays auf 0).

```js
plApplyLatency = true;
latApplyToPlayer();
```
- Erwartet: wieder mit Versatz.

### 10. Reload-Verhalten
Browser neu laden, Musik laden, Play.
- Erwartet: Musik synchron. `latencyResult` ist `null` (kein
  Persistenz-Code gebaut — kommt in Bauanleitung 27).

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der 10 Akzeptanz-Schritte oben
einzeln durchgehen und für jeden melden:

- **erfüllt** + Datei:Zeile der relevanten Code-Stelle
- **nicht erfüllt** + warum + was du versucht hast
- **unklar** + welche Information dir fehlt

Insbesondere prüfen:
- Schritt 1: `pLatSplitter` etc. werden tatsächlich angelegt
  (siehe `latInitGraph` in latency.js).
- Schritt 3: `latStartTest()` produziert Audio (Source connect
  hängt an pGain).
- Schritt 4: Schieber-Wert bewirkt Verzögerung. Konvention prüfen:
  Wert positiv → linker Kanal verzögert.
- Schritt 9: `latApplyToPlayer()` wirkt auf laufende Musik
  (DelayNode.delayTime ist live veränderbar).

Wenn Schritt 4 oder 9 nicht funktionieren: prüfen ob `pGain`
genau einmal an `pLatSplitter` angeschlossen ist und nicht
zusätzlich an `c.destination` (Doppelpfad → Audio mischt sich,
Delays wirken halb).

## Nicht zu tun

- Keine UI bauen. Kein neuer Sub-Tab. Kein HTML hinzufügen.
- Keine Persistenz, kein Save/Load. `latencyResult` bleibt nach
  Reload weg — das ist OK für diesen Build.
- Keine i18n-Strings.
- Kein neuer Eintrag in `CODESTRUKTUR.md` oder `SPEC.md` — das
  kommt mit Bauanleitung 27.
- `freq-warp.js`, `maplaw.js`, `sentences.js`, `init.js` nicht
  anfassen.
- `pGain.gain.value` nicht ändern.

## Zusammenfassung der Datei-Änderungen

| Datei | Änderung |
|---|---|
| `latency.js` | **neu**, kompletter Inhalt in Schritt 1 |
| `index.html` | Eintrag `'latency.js'` in Script-Array (Schritt 2) |
| `player.js` | 1 Block in `pBuildEQ` ersetzen (Schritt 3) |
