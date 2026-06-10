# Bauanleitung 189 — Warp-Berechnung: Sanduhr, Tooltip auf gesperrtem Play, Stop-Button, Prozentanzeige

Vor Beginn `docs/CODESTRUKTUR.md` lesen (Abschnitt zu `freq-warp.js`,
`player.js`). Diese Anleitung berührt nur den Player-Tab und ändert
keine Audio-Pipeline-Reihenfolge.

## Ziel

Während die Frequenz-Warp-Vorberechnung läuft (`pWarpBusy === true`),
soll der User klare visuelle Rückmeldung bekommen und die Berechnung
abbrechen können:

1. **Sanduhr ⏳** rechts neben dem Play-Button und am Anfang des
   Status-Texts in `plWarpSettingsBox`.
2. **Tooltip** beim Hover oder Klick/Tap auf den gesperrten Play-Button:
   „Frequenz-Warping wird noch berechnet. Bitte warten." + Prozent.
3. **„Berechnung stoppen"-Button** in derselben Zeile wie der
   Status-Text, **nur bei Rubberband** sichtbar (Offline-Verfahren
   nutzt `OfflineAudioContext.startRendering()` und ist nicht
   unterbrechbar). Bei Klick: Cancel-Flag wird gesetzt,
   `_rbProcessMonoSide` bricht zwischen Bändern aus, `pWarpedBuf=null`,
   **Warp-Toggle wird ausgeschaltet**.
4. **Prozentanzeige** im Status-Text und im Tooltip, in Sprüngen pro
   abgeschlossenem Band (bei Rubberband typ. 12 Bänder × 1–2 Seiten,
   also ~4–8 %-Schritte).

Sanduhr und Tooltip greifen bei **beiden** Verfahren, die Play sperren
(offline und rubberband). Stop-Button und Prozent gibt es nur bei
Rubberband.

## Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.189-beta";
```

## Änderungen im Detail

### 1) `index.html` — Play-Button in Wrapper packen

Aktuelle Stelle ab Z. ~1411:

```html
<button
  class="btn"
  id="plPlay"
  style="
    width: 44px;
    height: 44px;
    border-radius: 50%;
    font-size: 1.1em;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  "
>
  &#9654;
</button>
```

Ersetzen durch:

```html
<span
  id="plPlayWrap"
  style="position:relative;display:inline-flex;align-items:center;gap:8px"
>
  <button
    class="btn"
    id="plPlay"
    style="
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 1.1em;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    "
  >
    &#9654;
  </button>
  <span
    id="plPlayBusyIcon"
    style="display:none;font-size:1.4em;line-height:1"
    aria-hidden="true"
  >&#9203;</span>
  <div
    id="plPlayBusyTip"
    style="
      display:none;
      position:absolute;
      bottom:100%;
      left:0;
      margin-bottom:8px;
      padding:6px 10px;
      background:#333;
      color:#fff;
      border-radius:4px;
      font-size:0.82em;
      white-space:nowrap;
      z-index:1000;
      pointer-events:none;
    "
  ></div>
</span>
```

`&#9203;` ist das Sanduhr-Glyph ⏳. Der Tooltip-Text wird per JS in
`pWarpUpdUI` gesetzt (mit Prozentanteil); kein `data-t` nötig.

### 2) `index.html` — Status-Zeile mit Stop-Button

Aktuelle Stelle Z. 1264:

```html
<div id="plWarpStatus" style="margin-top:8px;font-size:0.85em;color:var(--text-muted)"></div>
```

Ersetzen durch:

```html
<div
  id="plWarpStatusRow"
  style="margin-top:8px;display:flex;align-items:center;gap:10px"
>
  <span
    id="plWarpStatus"
    style="font-size:0.85em;color:var(--text-muted);flex:1"
  ></span>
  <button
    type="button"
    class="btn btn-sm"
    id="plWarpStopBtn"
    data-t="plWarpStopBtn"
    style="display:none;background:#c00;color:#fff;border-color:#900;font-size:0.85em"
  ></button>
</div>
```

Die ID `plWarpStatus` bleibt erhalten (vorhandener Code in `pWarpUpdUI`
greift weiter); nur der Wrapper kommt neu dazu.

### 3) `i18n/de.js` — neue Keys

Nach Z. 719 (`pwHintNoFRes: "Bitte zuerst …"`) einfügen:

```js
    pwStatusBusyProgress: "Berechne… {pct} %",
    plWarpStopBtn: "Berechnung stoppen",
    plWarpBusyTooltip: "Frequenz-Warping wird noch berechnet. Bitte warten.",
```

Auf saubere ASCII-Quotes innerhalb der Strings achten (`"…"` als
Begrenzer, kein eingebettetes ASCII-`"`). `en.js`/`fr.js`/`es.js`
bleiben unverändert — i18n-Fallback nimmt die deutschen Defaults.

### 4) `js/freq-warp.js` — State erweitern

Bei den Warp-Variablen (Z. 527–531) ergänzen:

Vor:
```js
let pWarpedBuf = null;
...
let pWarpBusy = false;
```

Direkt nach `let pWarpBusy = false;`:

```js
let pWarpCancel = false;     // wird vom Stop-Button gesetzt, von _rbProcessMonoSide gelesen
let pWarpProgress = 0;        // 0..1, nur bei Rubberband gefüttert
```

### 5) `js/freq-warp.js` — `_rbProcessMonoSide` mit Cancel + Progress

Aktuelle Funktion (Z. 1055):

```js
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bands.length; i++) {
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i]);
    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
  }
  ...
}
```

Ersetzen durch (nur Signatur + Loop-Anfang/Ende, Pegelausgleich-Block
unverändert):

```js
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone) {
  const out = new Float32Array(srcMono.length);
  const nyquist = sampleRate / 2;
  for (let i = 0; i < bands.length; i++) {
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    const [low, high] = bands[i];
    const lowN  = Math.max(low  / nyquist, 1e-6);
    const highN = Math.min(high / nyquist, 1 - 1e-6);
    const fir = _rbDesignBandpassFIR(lowN, highN, _RB_FIR_ORDER);
    const filtered = await _rbConvolveViaWebAudio(srcMono, fir, sampleRate);
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i]);
    for (let n = 0; n < out.length; n++) out[n] += shifted[n];
    if (typeof onBandDone === "function") onBandDone();
  }
  // Pegelausgleich-Block unverändert lassen
  ...
}
```

### 6) `js/freq-warp.js` — `pComputeRubberbandWarpedBuffer` mit Progress

Im bestehenden Block ab Z. 1119 (kurz vor `if (decided.needL)`)
einfügen und den `needL`/`needR`-Block dadurch ersetzen:

```js
  // Schritt-Zähler vorab bestimmen, damit der Prozentwert stimmt.
  const sameAsLAnticipated = decided.needL && decided.needR
    && srcL === srcR
    && csL.length === csR.length
    && csL.every((v, i) => v === csR[i]);
  const totalBands = bands.length * (
    (decided.needL ? 1 : 0)
    + (decided.needR && !sameAsLAnticipated ? 1 : 0)
  );
  let doneBands = 0;
  const onBand = () => {
    if (totalBands > 0) {
      doneBands++;
      pWarpProgress = Math.min(1, doneBands / totalBands);
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    }
  };

  if (decided.needL) {
    outL = await _rbProcessMonoSide(rb, srcL, sampleRate, bands, csL, onBand);
  }
  if (decided.needR) {
    if (sameAsLAnticipated) {
      outR = outL;
    } else {
      if (pWarpCancel) throw new Error("__warp_cancelled__");
      outR = await _rbProcessMonoSide(rb, srcR, sampleRate, bands, csR, onBand);
    }
  }
```

(Der alte Block mit `sameAsL` innerhalb von `decided.needR` entfällt
— er ist jetzt vorab als `sameAsLAnticipated` berechnet.)

### 7) `js/freq-warp.js` — `pWarpTrigger` mit Cancel-Handling

Aktueller Body (Z. 1477 ff.) — der gesamte Block ab `pWarpBusy = true;`
bis Ende der Funktion wird ersetzt durch:

```js
  pWarpBusy = true;
  pWarpCancel = false;
  pWarpProgress = 0;
  pWarpUpdUI();

  let cancelled = false;
  try {
    if (method === "rubberband") {
      pWarpedBuf = await pComputeRubberbandWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength
      );
    } else {
      pWarpedBuf = await pComputeWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength,
        null
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

  pWarpBusy = false;
  pWarpCancel = false;
  pWarpProgress = 0;

  if (cancelled) {
    // User-Abbruch: Warp-Toggle aus, kein Resume.
    pWarpOn = false;
    const cb = document.getElementById("plWarpOn");
    if (cb && typeof cb.checked === "boolean") cb.checked = false;
  }

  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying && pWarpOn) pPlay();
}
```

### 8) `js/freq-warp.js` — Stop-Helfer

Direkt nach `pWarpTrigger` (vor dem Block „Default-Anwendung beim ersten
Frequenzabgleich-Resultat" ab Z. 1542) einfügen:

```js
function pWarpCancelCompute() {
  if (!pWarpBusy) return;
  pWarpCancel = true;
}
```

### 9) `js/freq-warp.js` — `pWarpUpdUI` erweitern

Im bestehenden `pWarpUpdUI` (vor dem Block „Status" Z. 1416 endet und
am Ende der Funktion vor `}`) folgende Anpassungen.

**(a)** Den vorhandenen Status-Builder ergänzen, damit bei Rubberband
mit laufendem Progress der Prozentwert mitkommt. Im `else if
(pWarpBusy)`-Zweig (Z. 1420) den Text bei Rubberband-Methode
parametrisieren:

Vor:
```js
  } else if (pWarpBusy) {
    statusText = t("pwStatusBusy");
  } else if (noData) {
```

Nach:
```js
  } else if (pWarpBusy) {
    if (method === "rubberband" && pWarpProgress > 0) {
      const pct = Math.round(pWarpProgress * 100);
      statusText = t("pwStatusBusyProgress").replace("{pct}", pct);
    } else {
      statusText = t("pwStatusBusy");
    }
  } else if (noData) {
```

**(b)** Den Status-Text mit vorangestellter Sanduhr versehen, wenn
`pWarpBusy`. Direkt vor `if (statusEl) statusEl.textContent = statusText;`
(am Ende des Status-Block, vor Hinweis-Block):

```js
  if (pWarpBusy && statusText) {
    statusText = "⏳ " + statusText;
  }
```

**(c)** Stop-Button-Sichtbarkeit, Sanduhr-Icon am Play-Button und
Play-Button-Pointer-Events. Direkt vor dem bestehenden Play-Button-
Sperr-Block (Z. 1471, `const playBtn = document.getElementById("plPlay");`)
einfügen — bzw. den bestehenden Block ersetzen durch:

```js
  // Play-Button-Sperre bei laufender Vorberechnung
  const playBtn = document.getElementById("plPlay");
  const playLocked = pWarpBusy && (method === "offline" || method === "rubberband");
  if (playBtn) {
    playBtn.disabled = playLocked;
    // pointer-events:none, damit Hover/Click den Wrapper erreichen
    // (disabled-Buttons feuern in Chrome/Firefox keine Maus-Events).
    playBtn.style.pointerEvents = playLocked ? "none" : "";
  }

  // Sanduhr neben dem Play-Button
  const busyIcon = document.getElementById("plPlayBusyIcon");
  if (busyIcon) busyIcon.style.display = playLocked ? "" : "none";

  // Tooltip-Text (Inhalt; Sichtbarkeit steuert _pBusyTooltipInit)
  const busyTip = document.getElementById("plPlayBusyTip");
  if (busyTip) {
    let tipText = t("plWarpBusyTooltip");
    if (method === "rubberband" && pWarpProgress > 0) {
      tipText += " " + Math.round(pWarpProgress * 100) + " %";
    }
    busyTip.textContent = tipText;
    if (!playLocked) busyTip.style.display = "none";
  }

  // Stop-Button: nur bei Rubberband (Offline ist nicht unterbrechbar)
  const stopBtn = document.getElementById("plWarpStopBtn");
  if (stopBtn) {
    stopBtn.style.display = (pWarpBusy && method === "rubberband") ? "" : "none";
  }
```

### 10) `js/freq-warp.js` — Tooltip-Init am Dateiende

Am Dateiende (nach allen Funktionen, vor evtl. vorhandenem
abschließendem Top-Level-Code) einfügen:

```js
// --- Tooltip auf gesperrtem Play-Button -------------------------
// Hover / Klick / Tap auf den gesperrten Play-Button zeigt
// "Frequenz-Warping wird noch berechnet …". Der Wrapper
// (#plPlayWrap) fängt die Events, weil disabled-Buttons selbst
// keine Maus-Events feuern; pWarpUpdUI setzt pointer-events:none
// auf dem Button, damit Klicks auf den Wrapper durchfallen.
document.addEventListener("DOMContentLoaded", () => {
  const wrap = document.getElementById("plPlayWrap");
  const tip = document.getElementById("plPlayBusyTip");
  const btn = document.getElementById("plPlay");
  if (!wrap || !tip || !btn) return;

  const show = () => {
    if (!btn.disabled) return;
    tip.style.display = "";
  };
  const hide = () => { tip.style.display = "none"; };

  wrap.addEventListener("mouseenter", show);
  wrap.addEventListener("mouseleave", hide);
  wrap.addEventListener("click", show);     // Touch-Geräte
  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
});
```

### 11) `js/init.js` — Stop-Button-Listener

Im großen DOMContentLoaded-Handler bei den anderen `pWarp*`-Bindings
(in der Nähe der bestehenden `pWarpTrigger`-Aufrufe in Z. 418–487)
einen Listener auf den Stop-Button hängen:

```js
const _plWarpStopBtn = document.getElementById("plWarpStopBtn");
if (_plWarpStopBtn) {
  _plWarpStopBtn.addEventListener("click", () => {
    if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
  });
}
```

### 12) Doku

Keine Spec-Änderung nötig — die User-Sicht im Player-Tab (Frequenz-
Warping-Card) wird durch diese Anleitung nur **ergänzt**, nicht in
ihrer Funktion verschoben. `docs/CODESTRUKTUR.md` braucht eine
Mini-Ergänzung in der `freq-warp.js`-Zeile: am Ende des State-
Listings `pWarpCancel`, `pWarpProgress` mitführen und kurz erwähnen,
dass `pWarpUpdUI` jetzt zusätzlich Sanduhr (`plPlayBusyIcon`),
Stop-Button (`plWarpStopBtn`) und Tooltip-Text (`plPlayBusyTip`) steuert.

## Akzeptanztest

Voraussetzung: Frequenzabgleich-Daten vorhanden (alternativ einen
Save mit Daten laden).

1. **Setup:** Tool im Browser öffnen → Player-Tab → „Frequenz-Warping
   aktivieren". Verfahren auf **Rubberband** lassen.
2. **Lange Datei laden** (≥ 30 s, damit die Berechnung sichtbar
   dauert):
   - Während der Berechnung ist der Play-Button ausgegraut.
   - Rechts neben dem Play-Button erscheint die Sanduhr ⏳.
   - Im „Frequenz-Warping"-Block steht „⏳ Berechne… X %" und die
     Zahl zählt in Sprüngen hoch.
   - Rechts in der Status-Zeile ist der rote Knopf „Berechnung
     stoppen" sichtbar.
3. **Tooltip:**
   - Maus über den ausgegrauten Play-Button bewegen → Sprechblase
     erscheint mit „Frequenz-Warping wird noch berechnet. Bitte
     warten. X %".
   - Maus wegbewegen → Sprechblase verschwindet.
   - Auf Touch-Gerät (oder Maus-Klick) auf den ausgegrauten Play-
     Button tippen → Sprechblase erscheint. Tippen daneben →
     verschwindet.
4. **Stop:** „Berechnung stoppen" klicken:
   - Die Berechnung endet innerhalb von ≤ 1 Bandschritt.
   - Sanduhr und Stop-Button verschwinden.
   - Der Warp-Toggle springt auf **aus** (der Toggle-Knopf in
     Zeile 6 der Player-Einstellungen ist nicht mehr grün, die
     Einstellungsbox darunter klappt zu).
   - Der Play-Button ist wieder klickbar.
5. **Erneuter Lauf:** Warp wieder einschalten → Berechnung läuft
   diesmal vollständig durch:
   - Prozent steigt bis 100 %.
   - Status zeigt nach Fertigstellung „Aktiv – Rubberband (N
     Stützpunkte)".
   - Sanduhr und Stop-Button sind weg.
   - Play startet die Datei warped.
6. **Offline-Verfahren:** Verfahren auf **Offline** umstellen → Datei
   neu laden:
   - Sanduhr und Tooltip auf Play funktionieren wie bei Rubberband.
   - **Kein** Stop-Button (Offline ist nicht unterbrechbar).
   - **Kein** Prozent im Status („Berechne…" pur).
7. **Live-Verfahren (Vocoder, Bandshift, Sinusoidal):** kurz
   gegenchecken — diese Verfahren brauchen keine Vorberechnung,
   daher dürfen Sanduhr, Stop-Button und Tooltip dort **nicht**
   erscheinen.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede der folgenden Akzeptanz-Kriterien einzeln
durchgehen und mit „erfüllt / nicht erfüllt / unklar" + Datei- und
Zeilenangabe der relevanten Stelle melden:

- A1: `pWarpCancel` und `pWarpProgress` sind als `let` deklariert in
  `freq-warp.js` direkt nach `pWarpBusy`.
- A2: `_rbProcessMonoSide` prüft `pWarpCancel` am Anfang jeder Band-
  Iteration und wirft `new Error("__warp_cancelled__")`.
- A3: `_rbProcessMonoSide` ruft `onBandDone()` am Ende jeder Band-
  Iteration auf, wenn übergeben.
- A4: `pComputeRubberbandWarpedBuffer` berechnet `totalBands` vor den
  beiden `needL`/`needR`-Aufrufen und gibt eine `onBand`-Callback
  weiter, die `pWarpProgress` aktualisiert und `pWarpUpdUI` aufruft.
- A5: `pWarpTrigger` setzt `pWarpCancel=false` und `pWarpProgress=0`
  vor dem Lauf und nach dem Lauf zurück, und fängt
  `__warp_cancelled__` separat ab.
- A6: Bei Abbruch schaltet `pWarpTrigger` `pWarpOn=false` und setzt
  die Checkbox `#plWarpOn` auf `checked=false`.
- A7: `pWarpUpdUI` setzt bei `playLocked` die Sanduhr `#plPlayBusyIcon`
  sichtbar und `playBtn.style.pointerEvents="none"`.
- A8: Tooltip-Text in `#plPlayBusyTip` enthält den Prozent-Suffix nur
  bei `method==="rubberband" && pWarpProgress > 0`.
- A9: Stop-Button `#plWarpStopBtn` ist nur sichtbar bei `pWarpBusy &&
  method==="rubberband"`.
- A10: Status-Text bekommt das `⏳`-Glyph (`⏳`) vorangestellt,
  wenn `pWarpBusy && statusText`.
- A11: Tooltip-Init am Dateiende von `freq-warp.js` registriert
  `mouseenter`/`mouseleave`/`click` am Wrapper, `click`-außerhalb
  am Document, und `Escape` am Document.
- A12: Stop-Button-Listener in `init.js` ruft `pWarpCancelCompute`
  auf.
- A13: `js/version.js` enthält `const APP_VERSION = "3.2.189-beta";`.
- A14: Keine i18n-Strings mit gemischten Anführungszeichen — alle
  drei neuen Keys in `i18n/de.js` haben sauberes ASCII-`"` als
  Stringbegrenzer und kein eingebettetes ASCII-`"`.

## Hinweis für später

Die drei neuen i18n-Keys (`pwStatusBusyProgress`, `plWarpStopBtn`,
`plWarpBusyTooltip`) müssen in einer **eigenen kleinen
Übersetzungs-Anleitung** für `en.js`, `fr.js`, `es.js` nachgepflegt
werden — sobald die deutsche GUI-Vorlage durchgespielt ist. Nicht
Pflicht-Folge dieser Anleitung.
