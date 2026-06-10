# BA 190 — Warp-Verfahren ausräumen (nur Rubberband bleibt)

## Worum es geht

Im Player-Tab gibt es heute fünf Warp-Verfahren (`rubberband`, `offline`,
`vocoder`, `sinmodel`, `bandshift`). Rubberband hat sich klar bewährt;
die anderen vier werden ersatzlos entfernt. Diese Anleitung räumt den
gesamten Code rund um diese Verfahren aus — Dropdown, Worklet, Vocoder-
Graph, Bandshift-Graph, alte Offline-Variante, zugehörige State-
Variablen, i18n-Keys, Save/Load-Schlüssel. Nach dieser BA gibt es nur
noch Rubberband; das Dropdown `plWarpMethod` ist ganz weg, die Optionen
für Rubberband selbst kommen in BA 191.

Akzeptanz dieser Anleitung: Tool startet ohne Konsolen-Fehler, Player-
Tab zeigt im Warp-Einstellungsblock kein Verfahren-Dropdown mehr, der
Rubberband-Warp läuft unverändert (Sanduhr, Stop-Button, Status-Text,
Prozentanzeige weiterhin funktional). Sätze und Audiodatei spielen mit
und ohne Warp ab.

## Reihenfolge

Die Schritte unten gehen Datei für Datei durch. Reihenfolge ist so
gewählt, daß zwischendurch nichts unauflösbar referenziert wird. Falls
ein Schritt einen Reload-Test braucht: erst am Ende, wenn alles raus
ist, sonst werfen Zwischenstände Reference-Errors.

## Schritt 1 — Version hochzählen

`js/version.js`:

```js
const APP_VERSION = "3.2.190-beta";
```

## Schritt 2 — HTML: Verfahren-Dropdown entfernen

`index.html` Z. ~1224–1234 enthält den `controls-row` mit zwei
`control-group`s (Verfahren-Dropdown und Modus-Dropdown). Die erste
`control-group` (Verfahren) ersatzlos löschen.

Vorher:

```html
<div class="controls-row" style="margin-bottom:6px;flex-wrap:wrap;gap:10px">
  <div class="control-group">
    <label data-t="pwMethod" style="margin-right:6px"></label>
    <select id="plWarpMethod" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
      <option value="rubberband" data-t-opt="pwMethodRubberband" selected></option>
      <option value="offline" data-t-opt="pwMethodOffline"></option>
      <option value="vocoder" data-t-opt="pwMethodVocoder"></option>
      <option value="sinmodel" data-t-opt="pwMethodSinModel"></option>
      <option value="bandshift" data-t-opt="pwMethodBandShift"></option>
    </select>
  </div>
  <div class="control-group">
    <label data-t="pwMode" style="margin-right:6px"></label>
    <select id="plWarpModeSelect" ...>...</select>
  </div>
</div>
```

Nachher:

```html
<div class="controls-row" style="margin-bottom:6px;flex-wrap:wrap;gap:10px">
  <div class="control-group">
    <label data-t="pwMode" style="margin-right:6px"></label>
    <select id="plWarpModeSelect" ...>...</select>
  </div>
</div>
```

Die `controls-row` bleibt erhalten — BA 191 hängt dort weitere Bedien-
elemente an.

## Schritt 3 — freq-warp.js: Worklet-Code-String entfernen

`js/freq-warp.js` Z. 15 beginnt mit:

```js
const _FREQ_WARP_PROCESSOR_CODE = `
```

Diese Konstante ist ein langer Template-Literal-String, der den
Phasen-Vocoder + Sinusoidal-Worklet enthält. Er endet mit `;` auf
einer eigenen Zeile (Backtick + Semikolon). Sonnet, bitte die
abschließende Zeile per Suche nach `^\`;` ab Zeile 15 finden — sie
liegt etwa bei Z. 450 (genaues Ende per `grep -n '^\`;' js/freq-warp.js`
verifizieren).

Komplette Konstante samt Initialkommentar (Z. 13–14 „AudioWorklet-
Processor-Code als String …") ersatzlos löschen.

Erwartung danach: Datei beginnt nach dem Modul-Header (Z. 1–12) direkt
mit `function _centShiftW(...)` (heute Z. 453).

## Schritt 4 — freq-warp.js: State-Variablen und Konstanten entfernen

`js/freq-warp.js` heute Z. 525, 534, 535:

```js
const _VOCODER_FFT_SIZE = 2048;
```

```js
let pWarpMethod = "rubberband";   // "rubberband" | "offline" | "bandshift" | "vocoder" | "sinmodel"
let pWarpWorkletReady = false;
```

Alle drei Zeilen löschen.

`pWarpedBuf`, `pWarpOn`, `pWarpMode`, `pWarpStrength`, `pWarpBusy`,
`pWarpCancel`, `pWarpProgress`, `pWarpAffected` bleiben erhalten.

## Schritt 5 — freq-warp.js: Alte Offline-Variante (D) entfernen

`js/freq-warp.js` Z. ~717: `async function pComputeWarpedBuffer(srcBuf, warpMode, strength, fResData)`

Diese Funktion endet mit der schließenden Klammer der Variante-C/D-
Implementierung kurz vor dem Block `// ---- Variante E: Rubberband-WASM
Offline-Vorberechnung -----` (heute Z. 806).

Komplette Funktion samt voranstehendem Kommentarblock löschen. Bis
einschließlich der Zeile vor `// ---- Variante E: Rubberband-WASM …`.

Der Block ab Z. 806 (Variante E) bleibt vollständig erhalten.

Hinweis: Auch den Verweis in der Modul-Header-Liste (Z. 8) anpassen.
Vorher: `pComputeWarpedBuffer(srcBuf, warpMode, strength, fResData) → Promise<AudioBuffer>`
Nachher: `pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) → Promise<AudioBuffer>`

## Schritt 6 — freq-warp.js: Live-Varianten und Worklet-Init entfernen

`js/freq-warp.js` Z. ~1161–1396 enthält in dieser Reihenfolge:

- `// ---- Variante B: Live Bandweise Pitch-Shift -------------`
- `function pBuildWarpedGraph(...)`
- `// ---- Variante A: Phasen-Vocoder (AudioWorklet) ----------`
- `function _warpSideGains(mode) { ... }`
- `async function pInitWarpWorklet(audioCtx) { ... }`
- `async function pBuildVocoderGraph(...) { ... }`
- `// ---- Live-Update für laufenden Vocoder ------------------` (Z. ~1366)
- Kommentarblock und Funktion `pWarpLiveUpdate()` (bis Z. ~1396)

Diesen ganzen Bereich ersatzlos löschen — vom Kommentar
`// ---- Variante B: …` bis einschließlich der schließenden Klammer
von `pWarpLiveUpdate()`. Direkt danach (Z. ~1398) folgt der Kommentar
`// ---- UI-Aktionen ----------------------------------------` und
darunter `function pWarpUpdUI()`. Dieser Bereich bleibt erhalten.

## Schritt 7 — freq-warp.js: pWarpUpdUI auf Rubberband-only reduzieren

`js/freq-warp.js` heute Z. ~1400–1525: `function pWarpUpdUI()` liest das
`plWarpMethod`-Dropdown und verzweigt nach Methode. Da das Dropdown
weg ist, fällt die ganze Methoden-Verzweigung weg.

Vorher (Auszug):

```js
function pWarpUpdUI() {
  const cbEl      = document.getElementById("plWarpOn");
  const statusEl  = document.getElementById("plWarpStatus");
  const hintEl    = document.getElementById("plWarpHint");
  const methodSel = document.getElementById("plWarpMethod");

  if (!cbEl) return;
  ...
  const method = methodSel ? methodSel.value : "offline";
  pWarpMethod = method;

  // "noch nicht verfügbar"-Hinweis entfernt – alle Verfahren implementiert
  const notAvailEl = document.getElementById("plWarpNotAvail");
  if (notAvailEl) notAvailEl.style.display = "none";
  ...
  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    if (method === "rubberband" && pWarpProgress > 0) {
      const pct = Math.round(pWarpProgress * 100);
      statusText = t("pwStatusBusyProgress").replace("{pct}", pct);
    } else {
      statusText = t("pwStatusBusy");
    }
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (method === "rubberband") {
    if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
      statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
    } else if (pWarpBusy) {
      statusText = t("pwStatusRubberbandLoading");
    } else {
      statusText = pWarpedBuf
        ? t("pwStatusActiveRubberband").replace("{n}", n)
        : t("pwStatusReady");
    }
  } else if (method === "offline") {
    statusText = pWarpedBuf
      ? t("pwStatusActiveOffline").replace("{n}", n)
      : t("pwStatusReady");
  } else if (method === "bandshift") {
    statusText = t("pwStatusActiveBandShift").replace("{n}", n);
  } else if (method === "vocoder") {
    statusText = t("pwStatusActiveVocoder").replace("{n}", n);
  } else if (method === "sinmodel") {
    statusText = t("pwStatusActiveSinModel").replace("{n}", n);
  }
  ...
  const playLocked = pWarpBusy && (method === "offline" || method === "rubberband");
  ...
  if (method === "rubberband" && pWarpProgress > 0) {
    tipText += " " + Math.round(pWarpProgress * 100) + " %";
  }
  ...
  if (stopBtn) {
    stopBtn.style.display = (pWarpBusy && method === "rubberband") ? "" : "none";
  }
}
```

Nachher:

```js
function pWarpUpdUI() {
  const cbEl     = document.getElementById("plWarpOn");
  const statusEl = document.getElementById("plWarpStatus");
  const hintEl   = document.getElementById("plWarpHint");

  if (!cbEl) return;

  if (pWarpOn) {
    cbEl.textContent = t("pwEnableOn");
    cbEl.style.background = "var(--success)";
    cbEl.style.color = "#fff";
    cbEl.style.borderColor = "var(--success)";
  } else {
    cbEl.textContent = t("pwEnableOff");
    cbEl.style.background = "#e5e7eb";
    cbEl.style.color = "var(--text)";
    cbEl.style.borderColor = "var(--border)";
  }
  const settingsBox = document.getElementById("plWarpSettingsBox");
  if (settingsBox) settingsBox.style.display = pWarpOn ? "" : "none";

  const stats = _warpFResStats();
  const noData = stats.total === 0;
  const n = stats.total;

  let statusText = "";
  if (!pWarpOn) {
    statusText = t("pwStatusReady");
  } else if (pWarpBusy) {
    if (pWarpProgress > 0) {
      const pct = Math.round(pWarpProgress * 100);
      statusText = t("pwStatusBusyProgress").replace("{pct}", pct);
    } else if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
      statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
    } else {
      statusText = t("pwStatusRubberbandLoading");
    }
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
    statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
  } else {
    statusText = pWarpedBuf
      ? t("pwStatusActiveRubberband").replace("{n}", n)
      : t("pwStatusReady");
  }

  // Provisorische und Vor-Schätzungs-Anteile hinten anhängen.
  if (statusText && (stats.provisional > 0 || stats.sliderEst > 0)) {
    const parts = [];
    if (stats.provisional > 0) {
      parts.push(t("pwStatusProvisional")
        .replace("{prov}", stats.provisional)
        .replace("{fin}", stats.finals));
    }
    if (stats.sliderEst > 0) {
      parts.push(t("pwStatusSliderEst")
        .replace("{est}", stats.sliderEst));
    }
    statusText += " " + parts.join(" · ");
  }
  if (pWarpBusy && statusText) {
    statusText = "⏳ " + statusText;
  }
  if (statusEl) statusEl.textContent = statusText;

  if (hintEl) {
    if (pWarpOn && noData) {
      hintEl.textContent = t("pwHintNoFRes");
      hintEl.style.display = "";
    } else {
      hintEl.style.display = "none";
    }
  }

  const playBtn = document.getElementById("plPlay");
  const playLocked = pWarpBusy;
  if (playBtn) {
    playBtn.disabled = playLocked;
    playBtn.style.pointerEvents = playLocked ? "none" : "";
  }

  const busyIcon = document.getElementById("plPlayBusyIcon");
  if (busyIcon) busyIcon.style.display = playLocked ? "" : "none";

  const busyTip = document.getElementById("plPlayBusyTip");
  if (busyTip) {
    let tipText = t("plWarpBusyTooltip");
    if (pWarpProgress > 0) {
      tipText += " " + Math.round(pWarpProgress * 100) + " %";
    }
    busyTip.textContent = tipText;
    if (!playLocked) busyTip.style.display = "none";
  }

  const stopBtn = document.getElementById("plWarpStopBtn");
  if (stopBtn) {
    stopBtn.style.display = pWarpBusy ? "" : "none";
  }
}
```

Hinweis: `"·"` ist das ASCII-Escape für das Mittelpunkt-Zeichen `·`
aus dem heutigen Code, `"⏳"` ist die Sanduhr `⏳`. Beide bleiben so
in der Datei (heute stehen sie direkt drin); falls die heutige Datei die
echten Unicode-Zeichen verwendet, dürfen sie wieder als Unicode-Literale
geschrieben werden — keine semantische Änderung.

## Schritt 8 — freq-warp.js: pWarpTrigger auf Rubberband-only reduzieren

`js/freq-warp.js` heute Z. ~1527–1608: `async function pWarpTrigger()`
liest das Dropdown und verzweigt nach Methode.

Vorher (relevanter Auszug):

```js
async function pWarpTrigger() {
  pWarpedBuf = null;

  if (!pWarpOn) { ... return; }
  if (_warpFResSource().length === 0) { ... return; }
  if (!pSourceBuf) { ... return; }

  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "rubberband";
  pWarpMethod = method;

  if (method !== "offline" && method !== "rubberband") {
    pWarpUpdUI();
    return;
  }

  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpCancel = false;
  pWarpProgress = 0;
  pWarpUpdUI();

  let cancelled = false;
  try {
    if (method === "rubberband") {
      pWarpedBuf = await pComputeRubberbandWarpedBuffer(
        pSourceBuf, pWarpMode, pWarpStrength
      );
    } else {
      pWarpedBuf = await pComputeWarpedBuffer(
        pSourceBuf, pWarpMode, pWarpStrength, null
      );
    }
  } catch (err) {
    if (err && err.message === "__warp_cancelled__") {
      cancelled = true;
      pWarpedBuf = null;
    } else {
      console.error("Warp-Fehler:", err);
      pWarpedBuf = null;
      if (method === "rubberband" && typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
        rubberbandLastError = err && err.message ? err.message : String(err);
      }
    }
  }
  ...
}
```

Nachher:

```js
async function pWarpTrigger() {
  pWarpedBuf = null;

  if (!pWarpOn) { pWarpUpdUI(); return; }
  if (_warpFResSource().length === 0) { pWarpUpdUI(); return; }
  if (!pSourceBuf) { pWarpUpdUI(); return; }

  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpCancel = false;
  pWarpProgress = 0;
  pWarpUpdUI();

  let cancelled = false;
  try {
    pWarpedBuf = await pComputeRubberbandWarpedBuffer(
      pSourceBuf, pWarpMode, pWarpStrength
    );
  } catch (err) {
    if (err && err.message === "__warp_cancelled__") {
      cancelled = true;
      pWarpedBuf = null;
    } else {
      console.error("Warp-Fehler:", err);
      pWarpedBuf = null;
      if (typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
        rubberbandLastError = err && err.message ? err.message : String(err);
      }
    }
  }

  pWarpBusy = false;
  pWarpCancel = false;
  pWarpProgress = 0;

  if (cancelled) {
    pWarpOn = false;
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
  }

  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying && pWarpOn) pPlay();
}
```

Die Variablen `pBuf` und `pPlay` kommen aus `player.js` (globaler Scope)
und werden weiterhin aus dieser Funktion referenziert — unverändert.

## Schritt 9 — player.js: getPlaybackBuffer entwarpen

`js/player.js` Z. 168–173 vorher:

```js
const _warpMethodEl = document.getElementById("plWarpMethod");
const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "rubberband";
// EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
const warpReady = typeof pWarpOn !== "undefined"
                && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy
                && (_warpMethod === "offline" || _warpMethod === "rubberband");
```

Nachher:

```js
// EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
const warpReady = typeof pWarpOn !== "undefined"
                && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy;
```

## Schritt 10 — player.js: pPlay-Branches für Vocoder/Bandshift entfernen

`js/player.js` Z. ~522–569 enthält:

```js
const methodSel = document.getElementById("plWarpMethod");
const method = methodSel ? methodSel.value : "offline";

let leadSrc = null;

const _warpHasData = (typeof _warpFResSource === "function")
  && _warpFResSource().length > 0;
if (pWarpOn && plEqOn && method === "bandshift" && _warpHasData && pSourceBuf) {
  // Variante B: Live Bandweise Pitch-Shift
  pBuf = pSourceBuf;
  const pb = pBuildWarpedGraph(
    c, pSourceBuf, firstNode, pWarpMode, pWarpStrength, null, 0, pOff
  );
  pCurrentPlayback = pb;
  leadSrc = pb.sources[0] || null;

} else if (pWarpOn && plEqOn && (method === "vocoder" || method === "sinmodel") && _warpHasData && pSourceBuf) {
  // Variante A: Phasen-Vocoder (async wegen erstem Worklet-Laden)
  pBuf = pSourceBuf;
  let pb;
  try {
    pb = await pBuildVocoderGraph(
      c, pSourceBuf, firstNode, pWarpMode, pWarpStrength, null, 0, pOff
    );
  } catch (err) {
    console.error("Vocoder-Fehler:", err);
    return;
  }
  if (gen !== pPlayGen) {
    pb.stop();
    return;
  }
  pCurrentPlayback = pb;
  leadSrc = pb.sources[0] || null;

} else {
  // Normal oder Offline-Warp (Variante C)
  pSrc = c.createBufferSource();
  pSrc.buffer = pBuf;
  pSrc.connect(firstNode);
  pSrc.start(0, pOff);
  leadSrc = pSrc;
}
```

Ersetzen durch:

```js
let leadSrc = null;
// Nur ein Pfad uebrig: BufferSource auf pBuf (entweder original oder
// Rubberband-Vorberechnung via getPlaybackBuffer).
pSrc = c.createBufferSource();
pSrc.buffer = pBuf;
pSrc.connect(firstNode);
pSrc.start(0, pOff);
leadSrc = pSrc;
```

Direkt davor (Z. ~515–520) bleibt der MAPLAW-Block unveraendert. Direkt
danach folgt der `if (leadSrc) { leadSrc.onended = ... }`-Block — der
bleibt ebenfalls.

`pCurrentPlayback` wird ab jetzt nirgendwo mehr gesetzt. Die Variable
selbst bleibt vorerst stehen (wird in `pPause()` defensiv geprueft),
das ist ungefaehrlich.

## Schritt 11 — init.js: i18n-Hilfsfunktionen für Methoden-Labels entfernen

`js/init.js` Z. ~62–83:

```js
// ---- Warp i18n Hilfsfunktionen ----
function _pWarpApplyMethodLabels() {
  const sel = document.getElementById("plWarpMethod");
  if (!sel) return;
  const keys = ["pwMethodRubberband", "pwMethodOffline", "pwMethodVocoder", "pwMethodSinModel", "pwMethodBandShift"];
  for (let i = 0; i < sel.options.length; i++) {
    if (keys[i]) sel.options[i].text = t(keys[i]);
  }
  const modeSel = document.getElementById("plWarpModeSelect");
  if (!modeSel) return;
  const modeKeys = ["pwModeLeft", "pwModeRight", "pwModeSym"];
  for (let i = 0; i < modeSel.options.length; i++) {
    if (modeKeys[i]) modeSel.options[i].text = t(modeKeys[i]);
  }
}
window._pWarpApplyMethodLabels = _pWarpApplyMethodLabels;

function _pWarpApplyLangTexts() {
  // data-t-Elemente werden von applyLang() automatisch aktualisiert.
  // Hier nur Dropdown-Optionen (haben kein data-t).
  _pWarpApplyMethodLabels();
}
window._pWarpApplyLangTexts = _pWarpApplyLangTexts;
```

Zwischen-Modus-Dropdown braucht weiterhin Label-Refresh. Vereinfachen
auf:

```js
// ---- Warp i18n Hilfsfunktion (Modus-Dropdown) ----
function _pWarpApplyLangTexts() {
  const modeSel = document.getElementById("plWarpModeSelect");
  if (!modeSel) return;
  const modeKeys = ["pwModeLeft", "pwModeRight", "pwModeSym"];
  for (let i = 0; i < modeSel.options.length; i++) {
    if (modeKeys[i]) modeSel.options[i].text = t(modeKeys[i]);
  }
}
window._pWarpApplyLangTexts = _pWarpApplyLangTexts;
```

Etwaige Aufrufer von `_pWarpApplyMethodLabels` per Suche pruefen
(`grep -n "_pWarpApplyMethodLabels" js/` — wenn nur init.js trifft,
ist die Funktion damit erledigt).

## Schritt 12 — init.js: plEqToggle-Handler vereinfachen

`js/init.js` Z. ~203–215 vorher:

```js
document.getElementById("plEqToggle").addEventListener("click", function () {
  plEqOn = !plEqOn;
  updEqToggleBtn();
  pUpdEQ();
  if (pWarpOn) {
    const method = document.getElementById("plWarpMethod").value;
    if (method === "vocoder" || method === "bandshift") {
      const wasPlaying = pPlaying;
      if (wasPlaying) pPause();
      pBuf = getPlaybackBuffer();
      pWarpUpdUI();
      if (wasPlaying) pPlay();
```

Den ganzen `if (pWarpOn) { const method = ... ; if (method === "vocoder"
|| method === "bandshift") { ... } }`-Block streichen. Den Rest des
Handlers (Auto-Restart bei Offline-Pfad / EQ-Buffer-Rebuild) so lassen,
wie er ist.

Sonnet, bitte hier den vollen Handler im Quelltext lesen (Z. ~203 bis
zum Ende des click-Handlers) und ausschließlich den Vocoder/Bandshift-
Pfad herausnehmen. Wenn unklar, was bleibt: vorher rückfragen, nicht
raten — der EQ-Toggle ist sicherheitskritisch fuer die Audio-Pipeline.

## Schritt 13 — init.js: plWarpOn-Handler und plWarpMethod-Listener

`js/init.js` Z. ~413–445 (plWarpOn-Klick-Handler) vorher:

```js
document.getElementById("plWarpOn").addEventListener("click", function () {
  pWarpOn = !pWarpOn;
  pWarpUpdUI();
  const method = document.getElementById("plWarpMethod").value;
  if (pWarpOn && (method === "offline" || method === "rubberband") && !pWarpedBuf) {
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

Nachher:

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

Direkt danach (heute Z. ~447–473): kompletter Listener auf
`plWarpMethod`:

```js
document.getElementById("plWarpMethod").addEventListener("change", function () {
  ...
});
```

Diesen Listener **komplett ersatzlos löschen**. Das Element existiert
nicht mehr.

## Schritt 14 — init.js: _pWarpParamsChanged vereinfachen

`js/init.js` heute Z. ~478–497 vorher:

```js
function _pWarpParamsChanged() {
  pWarpedBuf = null;
  if (!pWarpOn) return;
  const method = document.getElementById("plWarpMethod").value;
  if (method === "offline" || method === "rubberband") {
    pWarpTrigger();
    return;
  }
  if (method === "vocoder" && typeof pWarpLiveUpdate === "function") {
    pWarpLiveUpdate();
    ...
  }
  ...
}
```

Nachher:

```js
function _pWarpParamsChanged() {
  pWarpedBuf = null;
  if (!pWarpOn) return;
  pWarpTrigger();
}
```

Die heutigen Bandshift-/Vocoder-Pfade in dieser Funktion (mit
`pBuildEQ`-Rebuild und Worklet-postMessage) ersatzlos streichen.

## Schritt 15 — init.js: Autosave Save/Load entgleisen

`js/init.js` Z. ~673–684 (Load):

```js
const _wMethod   = (typeof d.warpMethod   === "string")  ? d.warpMethod
                 : (typeof d.pWarpMethod  === "string")  ? d.pWarpMethod  : undefined;
...
if (typeof _wMethod === "string") {
  pWarpMethod = _wMethod;
  const sel = document.getElementById("plWarpMethod");
  if (sel) sel.value = pWarpMethod;
}
```

Beide Stellen (Variablen-Deklaration **und** Anwendungs-Block)
ersatzlos löschen. Die anderen Warp-Schluessel (`_wOn`, `_wMode`,
`_wStrength`) bleiben unveraendert.

`js/init.js` Z. ~896 (Save):

```js
warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "sinmodel",
```

Diese Zeile aus dem Autosave-Objekt streichen.

## Schritt 16 — file.js: Save/Load/Reset für warpMethod entgleisen

`js/file.js` Z. ~109–113 (resetAll):

```js
pWarpMethod = "rubberband";
const _ws  = document.getElementById("plWarpStr");
if (_ws) _ws.value = pWarpStrength;
const _wm  = document.getElementById("plWarpMethod");
if (_wm) _wm.value = pWarpMethod;
```

`pWarpMethod = "rubberband";` und die zwei `_wm`-Zeilen ersatzlos
löschen. Die `_ws`-Zeile mit `plWarpStr` bleibt — die ist fuer die
Stärke, nicht fuer die Methode.

`js/file.js` Z. ~255 (Save):

```js
warpMethod: (typeof pWarpMethod !== "undefined") ? pWarpMethod : "rubberband",
```

Streichen.

`js/file.js` Z. ~618–622 (Load):

```js
if (d.warpMethod !== undefined && typeof pWarpMethod !== "undefined") {
  pWarpMethod = d.warpMethod;
  const methodSel = document.getElementById("plWarpMethod");
  if (methodSel) methodSel.value = pWarpMethod;
}
```

Ersatzlos streichen.

## Schritt 17 — print-md.js: methodKey aus Druckausgabe entgleisen

`js/print-md.js` Z. ~361:

```js
warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "rubberband",
```

Streichen.

`js/print-md.js` Z. ~624–631 vorher:

```js
if (p.warpOn) {
  const modeKey = p.warpMode === "left"  ? "pwModeLeft"
                : p.warpMode === "right" ? "pwModeRight" : "pwModeSym";
  const methodKey = p.warpMethod === "sinmodel" ? "pwMethodSinmodel"
                  : p.warpMethod === "vocoder"  ? "pwMethodVocoder"
                  : p.warpMethod === "bandshift" ? "pwMethodBandshift"
                  : "pwMethodOffline";
  out.push(`- ${t("archivPlWarp")}: ${t("on")} (${t(methodKey)}, ${t(modeKey)}, ${p.warpStrength}%)`);
} else {
  out.push(`- ${t("archivPlWarp")}: ${t("off")}`);
}
```

Nachher:

```js
if (p.warpOn) {
  const modeKey = p.warpMode === "left"  ? "pwModeLeft"
                : p.warpMode === "right" ? "pwModeRight" : "pwModeSym";
  out.push(`- ${t("archivPlWarp")}: ${t("on")} (${t(modeKey)}, ${p.warpStrength}%)`);
} else {
  out.push(`- ${t("archivPlWarp")}: ${t("off")}`);
}
```

Das Verfahren erscheint im Druck nicht mehr — gewollt, da es nur eines
gibt. BA 191 fuegt die neuen Rubberband-Optionen wieder dazu.

## Schritt 18 — i18n/de.js: Methoden-Keys aufräumen

`i18n/de.js` Z. ~696–714 vorher:

```js
pwMethod: "Verfahren",
pwMethodRubberband: "Rubberband (Vorberechnung, beste Qualitaet)",
pwMethodOffline: "Offline-Vorberechnung",
pwMethodVocoder: "Phasen-Vocoder (Live, mit Latenz)",
pwMethodSinModel: "Sinusoidal Modeling",
pwMethodBandShift: "Bandweise Pitch-Shift (Live)",
...
pwStatusActiveRubberband: "Aktiv – Rubberband ({n} Stuetzpunkte)",
pwStatusActiveOffline: "Aktiv – Offline ({n} Stuetzpunkte)",
pwStatusActiveBandShift: "Aktiv – Bandweise ({n} Stuetzpunkte)",
pwStatusActiveVocoder: "Aktiv – Phasen-Vocoder ({n} Stuetzpunkte)",
pwStatusActiveSinModel: "Sinusoidal aktiv ({n} Stuetzpunkte)",
pwStatusRubberbandLoading: "Rubberband wird geladen …",
pwStatusRubberbandError: "Rubberband-Fehler: {msg}",
```

Folgende Keys streichen (Zeile **inklusive** abschließendem Komma):

- `pwMethod`
- `pwMethodRubberband`
- `pwMethodOffline`
- `pwMethodVocoder`
- `pwMethodSinModel`
- `pwMethodBandShift`
- `pwStatusActiveOffline`
- `pwStatusActiveBandShift`
- `pwStatusActiveVocoder`
- `pwStatusActiveSinModel`

Folgende Keys bleiben unveraendert:

- `pwStatusActiveRubberband`
- `pwStatusRubberbandLoading`
- `pwStatusRubberbandError`

`en.js`, `fr.js`, `es.js` werden in dieser BA **nicht** angefaßt —
fehlende Keys nach Streichung fallen ohnehin auf die deutschen
Defaults zurueck (per `i18n.js`-Verhalten). Eine Folge-Mini-Anleitung
darf die uebersetzten Keys spaeter ausraeumen.

## Schritt 19 — docs/CODESTRUKTUR.md / docs/SPEC.md anpassen

Im `docs/CODESTRUKTUR.md`:

- Z. ~161 (Tabellenzeile „16 | freq-warp.js"): die Aufzaehlung
  `pBuildWarpedGraph, pBuildVocoderGraph, pInitWarpWorklet, ... pWarpLiveUpdate`
  herausnehmen, ebenso die Erwaehnung von `_FREQ_WARP_PROCESSOR_CODE`,
  `_VOCODER_FFT_SIZE`, `pInitWarpWorklet` und den Worklet-Methoden
  `_processFrame` / `_processFrameSinModel`. State-Liste:
  `pWarpMethod`, `pWarpWorkletReady` entfernen.
- Z. ~285 (Abschnitt „Frequenz-Warping — Persistenz"): den Schluessel
  `pWarpMethod` / `warpMethod` aus der Aufzaehlung streichen. Default-
  Fallback-Erwaehnungen mit warpMethod entfernen.

In `docs/SPEC.md` und `docs/spec/06-player.md` ggf. Erwaehnungen der
fuenf Verfahren auf „Rubberband" reduzieren. Sonnet, bitte vor dem
Edit das jeweilige Kapitel lesen — nur die Stellen anfassen, die
tatsaechlich Verfahren listen oder Methoden vergleichen.

## Akzeptanztest

Nach Build im Browser durchgehen:

1. Tool öffnen, Konsole oeffnen: **keine** roten Fehler beim Laden
   (Reference-Errors auf `pWarpMethod`, `pBuildVocoderGraph`,
   `pInitWarpWorklet` etc. waeren ein Hinweis auf einen vergessenen
   Aufrufer).
2. Player-Tab oeffnen, Audiodatei laden, Frequenzabgleich-Messungen
   vorhanden (Demo-Save laden, falls noch nicht da).
3. Warp-Toggle einschalten: erwartete Sanduhr neben Play-Button,
   Status zeigt „Rubberband wird geladen …" oder direkt
   „Aktiv – Rubberband (N Stuetzpunkte)" nach Vorberechnung.
4. **Kein** Verfahren-Dropdown sichtbar im Warp-Einstellungsblock.
   Nur Modus-Dropdown (Links/Rechts/Symmetrisch) und Staerke-Eingabe.
5. Stop-Button erscheint waehrend Vorberechnung (rot, klickbar). Klick
   bricht ab, Warp schaltet aus.
6. Mode-Dropdown und Staerke-Eingabe loesen Neuberechnung aus (kurze
   Sanduhr, neuer Status).
7. Warp aus: Wiedergabe ohne Verzerrung, Status „Bereit".
8. Save/Load: Tool laden mit vorhandenem JSON-Save (auch mit
   alten `warpMethod`-Schluesseln darin). Erwartet: kein Fehler,
   Warp-Status korrekt; das `warpMethod`-Feld wird einfach ignoriert.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden: erfuellt / nicht erfuellt / unklar, mit Datei- und Zeilen-
angabe. Insbesondere:

- Keine Aufrufer von `pComputeWarpedBuffer`, `pBuildWarpedGraph`,
  `pBuildVocoderGraph`, `pInitWarpWorklet`, `pWarpLiveUpdate`,
  `_warpSideGains`, `_VOCODER_FFT_SIZE`, `pWarpMethod`,
  `pWarpWorkletReady`, `_FREQ_WARP_PROCESSOR_CODE` mehr im gesamten
  `js/`-Baum (Suche mit `grep -rn`). Pro Symbol: 0 Treffer
  bestaetigen oder Stelle melden.
- Keine Referenz auf `getElementById("plWarpMethod")` mehr im
  gesamten Repo.
- i18n-Keys `pwMethod`, `pwMethodRubberband`, `pwMethodOffline`,
  `pwMethodVocoder`, `pwMethodSinModel`, `pwMethodBandShift`,
  `pwStatusActiveOffline`, `pwStatusActiveBandShift`,
  `pwStatusActiveVocoder`, `pwStatusActiveSinModel` nicht mehr in
  `i18n/de.js`.
- `pwStatusActiveRubberband`, `pwStatusRubberbandLoading`,
  `pwStatusRubberbandError` weiterhin in `i18n/de.js`.
- `js/version.js` auf `"3.2.190-beta"`.
- Im Browser: Konsole sauber, Warp-Toggle funktioniert, Rubberband
  laeuft.

## Hinweis fuer Folge-Anleitungen

- BA 191 ergaenzt vier neue Bedienelemente (Engine-Radio, Material-
  Radio, Formante-Toggle, Schnell-Toggle) in derselben `controls-row`,
  in der heute das Verfahren-Dropdown stand.
- Eine kleine Mini-Anleitung wird spaeter die en/fr/es-i18n-Datei
  von den geloeschten Keys befreien.
