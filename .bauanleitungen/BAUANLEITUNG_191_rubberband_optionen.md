# BA 191 — Rubberband-Optionen (Engine / Material / Formante / Schnell)

## Voraussetzung

BA 190 wurde ausgefuehrt. Der Warp-Einstellungsblock im Player enthaelt
kein Verfahren-Dropdown mehr; im Code gibt es ausschliesslich
Rubberband. `js/version.js` steht auf `3.2.190-beta`.

Falls noch nicht: erst BA 190 abschliessen.

## Worum es geht

Vier neue Bedienelemente fuer Rubberband werden in den Warp-
Einstellungsblock eingebaut:

- **Engine** (Radio, 2 Werte): R3 Finer (Default) / R2 Faster
- **Material** (Radio, 3 Werte): Standard (Default) / Sprache / Perkussiv
- **Formante erhalten** (Toggle, default an)
- **Schnell** (Toggle, default aus)

Die Werte werden als State-Objekt `pRubberbandOptions` gehalten, in
localStorage und JSON-Save persistiert, im Druck mit ausgegeben. Eine
zentrale Funktion `_rbBuildOptionBits(opts)` produziert aus dem State
die Rubberband-Bit-Maske; ein Parameter `realtime` ist bereits
vorgesehen, bleibt aber in dieser BA hartcodiert `false` (Live-Modus
folgt in einer spaeteren BA).

UI-Anordnung in der heutigen `controls-row` (Z. ~1224 im HTML):

```
[ Engine: 2 Radio uebereinander ] [ Material: 3 Radio uebereinander ] [ Formante  Schnell ] [ Modus-Dropdown ]
```

Engine und Material vertikal je control-group; die Toggles nebenein-
ander in einer eigenen control-group; das bestehende Modus-Dropdown
bleibt rechts daneben. Die Zeile darf umbrechen (`flex-wrap:wrap` ist
schon gesetzt). Unter der Material-Spalte sitzt ein kleiner Hinweis-
text, der nur bei Engine R3 sichtbar wird.

## Schritt 1 — Version hochzaehlen

`js/version.js`:

```js
const APP_VERSION = "3.2.191-beta";
```

## Schritt 2 — HTML: vier neue Bedienelemente einfuegen

`index.html` Z. ~1224 (`controls-row` mit dem Modus-Dropdown). Neue
`control-group`s **vor** dem bestehenden Modus-Dropdown einfuegen,
damit Engine/Material/Toggles links stehen.

Vorher (nach BA 190):

```html
<div class="controls-row" style="margin-bottom:6px;flex-wrap:wrap;gap:10px">
  <div class="control-group">
    <label data-t="pwMode" style="margin-right:6px"></label>
    <select id="plWarpModeSelect" ...>...</select>
  </div>
</div>
```

Nachher:

```html
<div class="controls-row" style="margin-bottom:6px;flex-wrap:wrap;gap:14px;align-items:flex-start">
  <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:3px">
    <label style="font-size:0.78em;color:var(--text-muted)" data-t="pwEngineLabel"></label>
    <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="radio" name="plWarpEngine" value="r3" checked />
      <span data-t="pwEngineR3"></span>
    </label>
    <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="radio" name="plWarpEngine" value="r2" />
      <span data-t="pwEngineR2"></span>
    </label>
  </div>

  <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:3px">
    <label style="font-size:0.78em;color:var(--text-muted)" data-t="pwMaterialLabel"></label>
    <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="radio" name="plWarpMaterial" value="standard" checked />
      <span data-t="pwMaterialStandard"></span>
    </label>
    <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="radio" name="plWarpMaterial" value="speech" />
      <span data-t="pwMaterialSpeech"></span>
    </label>
    <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
      <input type="radio" name="plWarpMaterial" value="percussive" />
      <span data-t="pwMaterialPercussive"></span>
    </label>
    <span id="plWarpMaterialR3Hint" style="font-size:0.76em;color:var(--text-muted);margin-top:2px;display:none;max-width:180px" data-t="pwMaterialR3Hint"></span>
  </div>

  <div class="control-group" style="flex-direction:column;align-items:flex-start;gap:3px">
    <label style="font-size:0.78em;color:var(--text-muted)" data-t="pwOptionsLabel"></label>
    <div style="display:flex;gap:14px">
      <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
        <input type="checkbox" id="plWarpFormant" checked />
        <span data-t="pwOptFormant"></span>
      </label>
      <label style="font-size:0.88em;display:flex;align-items:center;gap:5px;cursor:pointer">
        <input type="checkbox" id="plWarpFast" />
        <span data-t="pwOptFast"></span>
      </label>
    </div>
  </div>

  <div class="control-group">
    <label data-t="pwMode" style="margin-right:6px"></label>
    <select id="plWarpModeSelect" ...>...</select>
  </div>
</div>
```

Die `...` beim Modus-`<select>` bleiben so, wie sie heute sind
(Padding, Border, Optionen). Nicht anfassen.

Das Attribut `name="plWarpEngine"` bzw. `name="plWarpMaterial"` ist
wichtig — daran haengt das Radio-Gruppen-Verhalten. **Keine `id` auf
den Radios**, gelesen wird ueber `document.querySelector("input[name=plWarpEngine]:checked")`.

## Schritt 3 — i18n/de.js: neue Strings ergaenzen

`i18n/de.js` — nach dem Block der `pwStrength`-Strings (heute Z. ~706)
folgende Keys einfuegen. Reihenfolge im Codeblock ist nur Lesbarkeit;
alphabetische Ordnung ist nicht erforderlich.

```js
pwEngineLabel: "Engine",
pwEngineR3:    "R3 Finer (Qualität)",
pwEngineR2:    "R2 Faster (klassisch)",
pwMaterialLabel:      "Material",
pwMaterialStandard:   "Standard",
pwMaterialSpeech:     "Sprache",
pwMaterialPercussive: "Perkussiv",
pwMaterialR3Hint:     "Bei R3 wirkt Material nur über die Fenstergröße.",
pwOptionsLabel: "Optionen",
pwOptFormant:   "Formante erhalten",
pwOptFast:      "Schnell",
```

`en.js`, `fr.js`, `es.js` werden hier **nicht** angefaßt. Sonnet,
bitte ans Ende der BA-Schluss-Hinweise notieren, daß eine Mini-
Anleitung die Uebersetzungen nachzieht.

## Schritt 4 — freq-warp.js: State-Objekt und Bit-Builder

`js/freq-warp.js` — nach dem heutigen State-Block (Z. ~527–536, nach
BA 190 ohne `pWarpMethod` und `pWarpWorkletReady`) folgendes ergaenzen.
Sonnet, bitte direkt unter `let pWarpAffected = ...;` einfuegen:

```js
// BA 191: Rubberband-Optionen. Wird per UI gesetzt, in localStorage
// und JSON-Save persistiert. `realtime` ist Platzhalter fuer den
// spaeter geplanten Live-Modus (BA folgt) und bleibt hier immer false.
let pRubberbandOptions = {
  engine:   "r3",        // "r3" | "r2"
  material: "standard",  // "standard" | "speech" | "percussive"
  formant:  true,        // FormantPreserved an
  fast:     false,       // R3: PitchHighSpeed; R2: WindowShort
};

// Liefert die Rubberband-Bit-Maske aus dem Options-Objekt.
// Aufrufer aus dieser BA setzt realtime=false (Default). Die spaetere
// Live-BA ruft mit realtime=true auf — alle anderen Bits bleiben
// kombinierbar.
function _rbBuildOptionBits(opts) {
  const realtime = !!opts.realtime;
  const engine   = opts.engine === "r2" ? "r2" : "r3";
  const material = (opts.material === "speech" || opts.material === "percussive")
    ? opts.material : "standard";
  const formant  = opts.formant !== false; // Default an
  const fast     = !!opts.fast;

  let bits = 0;

  // Process-Mode: Offline (0x0) oder RealTime (0x1).
  bits |= realtime ? 0x00000001 : 0x00000000;

  // Engine: EngineFaster (R2, 0x0) oder EngineFiner (R3).
  bits |= (engine === "r3") ? 0x20000000 : 0x00000000;

  // Stretch: offline = Precise (0x10), live = Elastic (0x0).
  bits |= realtime ? 0x00000000 : 0x00000010;

  // Threading: Never (Pipeline ruft pro Band auf, kein internes Threading).
  bits |= 0x00010000;

  // Formant: Preserved (0x01000000) oder Shifted (0x0).
  bits |= formant ? 0x01000000 : 0x00000000;

  if (engine === "r3") {
    // PitchHighQuality (0x02000000) oder PitchHighSpeed (0x0).
    bits |= fast ? 0x00000000 : 0x02000000;
    // Material wirkt in R3 nur ueber die Fenstergroesse.
    if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    } else if (material === "percussive") {
      bits |= 0x00100000; // WindowShort
    }
    // Standard => WindowStandard (0x0).
  } else {
    // R2: Detector + Transients aus Material.
    if (material === "speech") {
      bits |= 0x00000800; // DetectorSoft
      bits |= 0x00000200; // TransientsSmooth
    } else if (material === "percussive") {
      bits |= 0x00000400; // DetectorPercussive
      // TransientsCrisp ist Default (0x0).
    }
    // Window: Schnell hat Vorrang vor Material-Window-Wahl.
    if (fast) {
      bits |= 0x00100000; // WindowShort
    } else if (material === "speech") {
      bits |= 0x00200000; // WindowLong
    }
  }

  return bits;
}
```

## Schritt 5 — freq-warp.js: heutige Bit-Konstante durch dynamische Bits ersetzen

`js/freq-warp.js` Z. ~823 enthaelt heute die Konstante
`_RB_OPTIONS_OFFLINE_HIGHQ`. Diese Konstante **komplett samt voran-
stehendem Kommentarblock** loeschen.

Heute Z. ~938: `async function _rbPitchShift(rb, signal, sampleRate, cents)`.
Signatur um einen Parameter `optionBits` erweitern und die hartcodierte
Konstante durch diesen Parameter ersetzen.

Vorher:

```js
async function _rbPitchShift(rb, signal, sampleRate, cents) {
  if (Math.abs(cents) < 0.5) {
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_new(
    sampleRate, 1, _RB_OPTIONS_OFFLINE_HIGHQ, 1.0, pitchScale
  );
  ...
}
```

Nachher:

```js
async function _rbPitchShift(rb, signal, sampleRate, cents, optionBits) {
  if (Math.abs(cents) < 0.5) {
    return signal;
  }
  const pitchScale = Math.pow(2, cents / 1200);

  const state = rb.rubberband_new(
    sampleRate, 1, optionBits, 1.0, pitchScale
  );
  ...
}
```

Den restlichen Funktionskoerper unveraendert lassen.

Heute Z. ~1057: `async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone)`.
Signatur ebenfalls um `optionBits` erweitern und beim `_rbPitchShift`-
Aufruf durchreichen.

Vorher (Auszug):

```js
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone) {
  ...
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i]);
  ...
}
```

Nachher:

```js
async function _rbProcessMonoSide(rb, srcMono, sampleRate, bands, csValues, onBandDone, optionBits) {
  ...
    const shifted  = await _rbPitchShift(rb, filtered, sampleRate, csValues[i], optionBits);
  ...
}
```

Heute Z. ~1084: `async function pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength)`.
Vor dem ersten `_rbProcessMonoSide`-Aufruf (heute Z. ~1142) die Bits
einmalig berechnen und beim Aufruf durchreichen.

Vorher (Auszug aus dem Block ab Z. ~1141):

```js
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

Nachher:

```js
const optionBits = _rbBuildOptionBits({
  engine:   pRubberbandOptions.engine,
  material: pRubberbandOptions.material,
  formant:  pRubberbandOptions.formant,
  fast:     pRubberbandOptions.fast,
  realtime: false,
});

if (decided.needL) {
  outL = await _rbProcessMonoSide(rb, srcL, sampleRate, bands, csL, onBand, optionBits);
}
if (decided.needR) {
  if (sameAsLAnticipated) {
    outR = outL;
  } else {
    if (pWarpCancel) throw new Error("__warp_cancelled__");
    outR = await _rbProcessMonoSide(rb, srcR, sampleRate, bands, csR, onBand, optionBits);
  }
}
```

## Schritt 6 — init.js: DOM-Listener fuer die vier neuen Bedienelemente

`js/init.js` — an den Stelle, an der heute der `plWarpMethod`-Listener
stand (in BA 190 geloescht). Direkt nach dem `plWarpOn`-Handler die
neuen Listener einbauen. Sonnet, bitte den Block in den Frequenz-
Warping-Listener-Bereich (heute markiert durch
`// ---- Frequenz-Warping Listener ----`) einsortieren.

```js
// BA 191: Rubberband-Optionen — Engine-/Material-Radios, Toggles.
// Aenderungen invalidieren den vorberechneten Buffer und triggern
// (bei aktivem Warp) eine Neuberechnung. Reiner Zustand wird ueber
// _autoSaveState() persistiert.
function _pRbOptUpdateR3Hint() {
  const hint = document.getElementById("plWarpMaterialR3Hint");
  if (!hint) return;
  hint.style.display = (pRubberbandOptions.engine === "r3") ? "" : "none";
}
window._pRbOptUpdateR3Hint = _pRbOptUpdateR3Hint;

function _pRbOptOnChange() {
  pWarpedBuf = null;
  _pRbOptUpdateR3Hint();
  if (typeof _autoSaveState === "function") _autoSaveState();
  if (!pWarpOn) return;
  pWarpTrigger();
}

document.querySelectorAll('input[name="plWarpEngine"]').forEach(function (r) {
  r.addEventListener("change", function () {
    if (!this.checked) return;
    pRubberbandOptions.engine = (this.value === "r2") ? "r2" : "r3";
    _pRbOptOnChange();
  });
});

document.querySelectorAll('input[name="plWarpMaterial"]').forEach(function (r) {
  r.addEventListener("change", function () {
    if (!this.checked) return;
    const v = this.value;
    pRubberbandOptions.material = (v === "speech" || v === "percussive") ? v : "standard";
    _pRbOptOnChange();
  });
});

document.getElementById("plWarpFormant").addEventListener("change", function () {
  pRubberbandOptions.formant = !!this.checked;
  _pRbOptOnChange();
});

document.getElementById("plWarpFast").addEventListener("change", function () {
  pRubberbandOptions.fast = !!this.checked;
  _pRbOptOnChange();
});

// Hinweistext-Sichtbarkeit beim ersten Render synchronisieren.
_pRbOptUpdateR3Hint();
```

## Schritt 7 — init.js: Autosave Save/Load fuer pRubberbandOptions

`js/init.js`, Autosave-Save-Block (heute Z. ~880–920, das grosse
Objekt-Literal in `_autoSaveState`). Direkt unter der Zeile
`warpStrength: ...` einfuegen:

```js
warpRbOptions: (typeof pRubberbandOptions !== "undefined")
  ? { ...pRubberbandOptions } : null,
```

`js/init.js`, Autosave-Load-Block (heute Z. ~668–698, der Block, der
die `_w*`-Variablen liest). Nach dem `_wStrength`-Anwendungsblock
folgendes ergaenzen:

```js
if (typeof pRubberbandOptions !== "undefined"
    && d.warpRbOptions && typeof d.warpRbOptions === "object") {
  if (typeof d.warpRbOptions.engine === "string") {
    pRubberbandOptions.engine = (d.warpRbOptions.engine === "r2") ? "r2" : "r3";
  }
  if (typeof d.warpRbOptions.material === "string") {
    const m = d.warpRbOptions.material;
    pRubberbandOptions.material = (m === "speech" || m === "percussive") ? m : "standard";
  }
  if (typeof d.warpRbOptions.formant === "boolean") {
    pRubberbandOptions.formant = d.warpRbOptions.formant;
  }
  if (typeof d.warpRbOptions.fast === "boolean") {
    pRubberbandOptions.fast = d.warpRbOptions.fast;
  }
  // UI-Sync
  const rE = document.querySelector('input[name="plWarpEngine"][value="' + pRubberbandOptions.engine + '"]');
  if (rE) rE.checked = true;
  const rM = document.querySelector('input[name="plWarpMaterial"][value="' + pRubberbandOptions.material + '"]');
  if (rM) rM.checked = true;
  const cF = document.getElementById("plWarpFormant");
  if (cF) cF.checked = !!pRubberbandOptions.formant;
  const cS = document.getElementById("plWarpFast");
  if (cS) cS.checked = !!pRubberbandOptions.fast;
  if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
}
```

## Schritt 8 — file.js: JSON-Save/Load fuer pRubberbandOptions, Reset

`js/file.js` — Reset (heute Z. ~104–120). Innerhalb des
`if (typeof pWarpOn !== "undefined") { ... }`-Blocks (nach BA 190
ohne `pWarpMethod`) folgenden Block ergaenzen:

```js
if (typeof pRubberbandOptions !== "undefined") {
  pRubberbandOptions.engine   = "r3";
  pRubberbandOptions.material = "standard";
  pRubberbandOptions.formant  = true;
  pRubberbandOptions.fast     = false;
  const rE = document.querySelector('input[name="plWarpEngine"][value="r3"]');
  if (rE) rE.checked = true;
  const rM = document.querySelector('input[name="plWarpMaterial"][value="standard"]');
  if (rM) rM.checked = true;
  const cF = document.getElementById("plWarpFormant");
  if (cF) cF.checked = true;
  const cS = document.getElementById("plWarpFast");
  if (cS) cS.checked = false;
  if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
}
```

JSON-Save (heute Z. ~250–260, das Objekt mit `warpOn`, `warpMode`,
`warpStrength`). Nach `warpStrength`:

```js
warpRbOptions: (typeof pRubberbandOptions !== "undefined")
  ? { ...pRubberbandOptions } : null,
```

JSON-Load (heute Z. ~600–627). Nach dem `warpStrength`-Block (nach
BA 190 ohne `warpMethod`-Block) folgenden Block einfuegen — Logik
identisch zum Autosave-Load aus Schritt 7:

```js
if (typeof pRubberbandOptions !== "undefined"
    && d.warpRbOptions && typeof d.warpRbOptions === "object") {
  if (typeof d.warpRbOptions.engine === "string") {
    pRubberbandOptions.engine = (d.warpRbOptions.engine === "r2") ? "r2" : "r3";
  }
  if (typeof d.warpRbOptions.material === "string") {
    const m = d.warpRbOptions.material;
    pRubberbandOptions.material = (m === "speech" || m === "percussive") ? m : "standard";
  }
  if (typeof d.warpRbOptions.formant === "boolean") {
    pRubberbandOptions.formant = d.warpRbOptions.formant;
  }
  if (typeof d.warpRbOptions.fast === "boolean") {
    pRubberbandOptions.fast = d.warpRbOptions.fast;
  }
  const rE = document.querySelector('input[name="plWarpEngine"][value="' + pRubberbandOptions.engine + '"]');
  if (rE) rE.checked = true;
  const rM = document.querySelector('input[name="plWarpMaterial"][value="' + pRubberbandOptions.material + '"]');
  if (rM) rM.checked = true;
  const cF = document.getElementById("plWarpFormant");
  if (cF) cF.checked = !!pRubberbandOptions.formant;
  const cS = document.getElementById("plWarpFast");
  if (cS) cS.checked = !!pRubberbandOptions.fast;
  if (typeof _pRbOptUpdateR3Hint === "function") _pRbOptUpdateR3Hint();
}
```

## Schritt 9 — print-md.js: Optionen im Archiv-Druck

`js/print-md.js`, Snapshot-Build (heute Z. ~355–365). Nach
`warpStrength`-Eintrag ergaenzen:

```js
warpRbOptions: (typeof pRubberbandOptions !== "undefined")
  ? { ...pRubberbandOptions } : null,
```

Render-Funktion `_archivMdPlayer` (oder welche auch immer den Warp-
Block ausgibt — heute Z. ~624–635). Den nach BA 190 reduzierten Block
weiter ergaenzen:

Vorher (Stand nach BA 190):

```js
if (p.warpOn) {
  const modeKey = p.warpMode === "left"  ? "pwModeLeft"
                : p.warpMode === "right" ? "pwModeRight" : "pwModeSym";
  out.push(`- ${t("archivPlWarp")}: ${t("on")} (${t(modeKey)}, ${p.warpStrength}%)`);
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
  if (p.warpRbOptions) {
    const o = p.warpRbOptions;
    const engKey = (o.engine === "r2") ? "pwEngineR2" : "pwEngineR3";
    const matKey = (o.material === "speech")     ? "pwMaterialSpeech"
                 : (o.material === "percussive") ? "pwMaterialPercussive"
                 : "pwMaterialStandard";
    const flags = [];
    if (o.formant) flags.push(t("pwOptFormant"));
    if (o.fast)    flags.push(t("pwOptFast"));
    const flagsStr = flags.length ? " · " + flags.join(", ") : "";
    out.push(`  - ${t("pwEngineLabel")}: ${t(engKey)} · ${t("pwMaterialLabel")}: ${t(matKey)}${flagsStr}`);
  }
} else {
  out.push(`- ${t("archivPlWarp")}: ${t("off")}`);
}
```

Der zweite Listenpunkt ist eingerueckt (zwei Leerzeichen + Bindestrich),
damit Markdown ihn als Sub-Item unter den Warp-Eintrag setzt.

## Schritt 10 — docs/CODESTRUKTUR.md / docs/SPEC.md anpassen

`docs/CODESTRUKTUR.md`:

- Tabellenzeile freq-warp.js (Z. ~161): in der State-Aufzaehlung
  `pRubberbandOptions` ergaenzen; in der Helper-Liste `_rbBuildOptionBits`
  ergaenzen.
- Abschnitt „Frequenz-Warping — Persistenz" (Z. ~285): `warpRbOptions`
  als zusaetzlichen persistierten Schluessel in beiden Pfaden
  (localStorage und JSON) auffuehren.

`docs/SPEC.md` / `docs/spec/06-player.md`: den Bereich, der heute die
Verfahrenswahl beschreibt (nach BA 190 vermutlich auf „Rubberband"
reduziert), um die vier neuen Bedienelemente erweitern.

Sonnet, bitte vor dem Edit das jeweilige Kapitel lesen — nur die
Stellen anfassen, die mit Bezug zum Player-Warp stehen. Wenn die
Kapitel keine ausdrueckliche Verfahrens-/Optionen-Beschreibung
enthalten, reicht eine kurze Erwaehnung.

## Akzeptanztest

Nach Build im Browser durchgehen:

1. Tool oeffnen, keine Konsolen-Fehler. Player-Tab oeffnen, Warp-
   Einstellungen ausklappen.
2. Drei neue Spalten sichtbar: **Engine** (R3 selektiert, R2 daneben
   bzw. darunter), **Material** (Standard selektiert, Sprache und
   Perkussiv darunter), **Optionen** (Formante haken gesetzt, Schnell
   leer). Rechts daneben (oder nach Umbruch unten) das Modus-Dropdown.
3. R3-Material-Hinweistext „Bei R3 wirkt Material nur ueber die
   Fenstergroesse." ist sichtbar.
4. Engine auf R2 umschalten: Hinweistext verschwindet.
5. Warp einschalten, Vorberechnung laeuft, Rubberband-Aktiv-Status
   erscheint.
6. Material auf „Sprache" wechseln → Sanduhr, kurze Neuberechnung,
   Status wieder Aktiv.
7. „Schnell" anhaken → erneut Neuberechnung. Bei R3 deutlich schneller
   als ohne Haken.
8. „Formante erhalten" abschalten → erneut Neuberechnung. Klangbild
   hoerbar anders (Stimmen wandern in der Klangfarbe).
9. Wieder R3 + Standard + Formante an + Schnell aus → erneut Neuberechnung,
   wieder der heutige Klang.
10. Tool neu laden: zuletzt gesetzte Optionen erscheinen wieder, ohne
    daß man sie manuell setzt (localStorage-Persistenz).
11. JSON-Save erstellen, Tool laden, JSON-Save einspielen: Optionen
    werden uebernommen, UI synchron.
12. JSON-Save eines alten Standes (ohne `warpRbOptions`) einspielen:
    keine Fehler, Optionen behalten ihren letzten Wert oder fallen
    auf Default zurueck (kein Crash, kein Reset auf andere Werte
    erforderlich).
13. Reset-Knopf druecken: Optionen springen auf Default (R3/Standard/
    Formante an / Schnell aus), UI synchron.
14. Druck/Archiv-Markdown: bei aktivem Warp erscheint unter der Warp-
    Zeile eine zweite Zeile mit Engine, Material und ggf. Formante/
    Schnell.

## Selbstpruefungs-Auftrag

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
melden: erfuellt / nicht erfuellt / unklar, mit Datei- und Zeilen-
angabe.

Zusaetzlich verifizieren:

- `_rbBuildOptionBits` und `pRubberbandOptions` existieren in
  `freq-warp.js` (per `grep -n`).
- `_RB_OPTIONS_OFFLINE_HIGHQ` wird nirgendwo mehr referenziert
  (`grep -rn _RB_OPTIONS_OFFLINE_HIGHQ js/` → 0 Treffer).
- `_rbPitchShift` und `_rbProcessMonoSide` haben den neuen
  `optionBits`-Parameter; `pComputeRubberbandWarpedBuffer` berechnet
  die Bits einmal und reicht sie durch.
- `js/version.js` auf `"3.2.191-beta"`.
- HTML enthaelt die Radios mit den korrekten `name`-Attributen und
  Default-Selektion (R3 / Standard / Formante checked / Schnell un-
  checked).
- Alle vier neuen Bedienelemente erscheinen in der `controls-row` vor
  dem Modus-Dropdown.

## Hinweise fuer Folge-Anleitungen

- **Live-Modus**: Eine spaetere BA fuegt einen fuenften Toggle „Live"
  neben den anderen ein, baut einen AudioWorklet mit rubberband-wasm
  und ruft `_rbBuildOptionBits({..., realtime: true})` mit demselben
  State-Objekt auf. Die hier eingebauten Architektur-Trennungen
  (State-Objekt, Bit-Builder mit `realtime`-Parameter) sind genau
  daraufhin angelegt.
- **i18n en/fr/es**: Eine kleine Mini-Anleitung soll die in Schritt 3
  hinzugefuegten Strings (`pwEngineLabel`, `pwEngineR3`, `pwEngineR2`,
  `pwMaterialLabel`, `pwMaterialStandard`, `pwMaterialSpeech`,
  `pwMaterialPercussive`, `pwMaterialR3Hint`, `pwOptionsLabel`,
  `pwOptFormant`, `pwOptFast`) in `i18n/en.js`, `i18n/fr.js`,
  `i18n/es.js` nachziehen.
