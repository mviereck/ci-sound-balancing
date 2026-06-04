# Bauanleitung 192 — Player-Wiedergabebox vereinheitlichen

**Versionsbump:** `js/version.js` von `"3.2.191.2-beta"` auf `"3.2.192-beta"`.

## Ziel

Die heutigen zwei Wiedergabebereiche im Player-Tab — die Card „Audiodatei"
(`plFileTitle`) und die Card „Sätze abspielen" (`plSentencesCard`) —
werden zu einer einzigen Wiedergabe-Card zusammengeführt. Diese Card hat
oben einen Top-Toggle für die Quelle (Musik / Sätze / Geräusche / Hörbücher;
Geräusche und Hörbücher in dieser BA noch ausgegraut — Slot wird hier nur
vorbereitet, damit spätere BAs das Layout nicht erneut umbauen müssen),
darunter einen quellenspezifischen Sub-Block, eine einheitliche Transport-
Leiste mit Play/Pause, Stop, Prev, Next, Endlos-Toggle, Slider und
Lautstärke, dann eine eigene Zeile für Auto-Advance-Toggle + Pause-Buttons,
und ganz unten einen Anzeige-Block für Titel, Sprecher, Quelle und Lizenz.

Die Funktion der bisherigen Bereiche bleibt erhalten (eigene Audiodatei
laden + Sätze abspielen), nur die Bedienung wird vereinheitlicht.
Bibliotheken (Webspace, LibriVox, Internet Archive) und Hörbücher
kommen in späteren Bauanleitungen.

## Was ändert sich konzeptuell

| Bisher | Neu |
|---|---|
| Zwei separate Cards (Audiodatei, Sätze), jede mit eigenen Knöpfen | Eine Wiedergabe-Card, gemeinsame Transport-Leiste |
| Sätze-„Endlosfolge" = 100 zufällige Sätze in Folge | Endlos-Toggle (🔁) = aktuelles Stück wiederholen. Random-Folge entsteht über separaten Auto-Advance-Toggle (↪️). |
| Sätze-Pause-Buttons im Sätze-Block | Pause-Buttons generisch, wirken für alle Quellen, ausgegraut wenn Auto-Advance aus |
| `plCtrl` versteckt, solange keine Datei geladen | Transport-Leiste immer sichtbar; deaktivierte Knöpfe sind ausgegraut |
| Anzeige nur via Sätze-Text-Einblender | Anzeige-Block unter Transport: Titel · Sprecher · Quelle · Lizenz · optional Satz-Text |

## Schritt 1: HTML-Umbau in `index.html`

Die beiden Cards `plFileTitle` (ab Zeile ~1425, Card mit `plFileTitle`)
und `plSentencesCard` (ab Zeile ~1582) werden **komplett entfernt**
und durch eine einzige neue Wiedergabe-Card ersetzt. Die EQ-Graph-Card
(`plEqViz`) und die Einstellungen-Card (`plSettingsTitle`) bleiben
unverändert. Die experimentelle Toggle-Card (`plExperimentalToggleCard`)
bleibt ebenfalls unverändert hinter der neuen Card.

**Einfügeposition:** statt der beiden alten Cards, also nach der
Einstellungen-Card und vor `plExperimentalToggleCard`.

**Komplette neue Card als Skeleton (zwischen den `<!-- 4. ... -->`-
Kommentaren der alten Cards einfügen, alte Cards entfernen):**

```html
<!-- 4. Wiedergabe (vereinheitlicht: Musik / Sätze / Hörbücher) -->
<div class="card" id="plPlayCard">
  <h3 data-t="plPlayTitle" style="margin-bottom: 8px"></h3>

  <!-- Top-Toggle: Quelle -->
  <div class="controls-row" style="margin-bottom: 10px">
    <div class="control-group" style="flex-wrap: wrap; gap: 6px">
      <label data-t="plSourceLabel" style="align-self: center"></label>
      <button id="plSrcMusicBtn" class="btn btn-sm"
              style="font-weight: 600; min-width: 140px; border-radius: 6px"
              data-t="plSrcMusic"></button>
      <button id="plSrcSentencesBtn" class="btn btn-sm"
              style="font-weight: 600; min-width: 140px; border-radius: 6px"
              data-t="plSrcSentences"></button>
      <button id="plSrcNoiseBtn" class="btn btn-sm" disabled
              title="noch nicht verfuegbar (kommt in spaeterer Bauanleitung)"
              style="font-weight: 600; min-width: 140px; border-radius: 6px; opacity: 0.5; cursor: not-allowed"
              data-t="plSrcNoise"></button>
      <button id="plSrcAudiobookBtn" class="btn btn-sm" disabled
              title="noch nicht verfuegbar (kommt in spaeterer Bauanleitung)"
              style="font-weight: 600; min-width: 140px; border-radius: 6px; opacity: 0.5; cursor: not-allowed"
              data-t="plSrcAudiobook"></button>
    </div>
  </div>

  <!-- Sub-Block: Musik -->
  <div id="plSubMusic" class="pl-subblock" style="margin-bottom: 12px">
    <div id="plDeafHintEl" class="explain explain-warn"
         style="display:none;margin-bottom:8px"></div>
    <div id="plNoD" class="hidden warning-bar" data-t="plNoData"></div>
    <label style="font-size: 0.84em; color: var(--text-muted); display: block; margin-bottom: 4px"
           data-t="plFile"></label>
    <input type="file" id="plAudio"
           accept=".mp3,.wav,.flac,.ogg,.m4a,.mp4,audio/*"
           style="font-size: 0.88em" />
  </div>

  <!-- Sub-Block: Saetze -->
  <div id="plSubSentences" class="pl-subblock" style="margin-bottom: 12px; display: none">
    <div id="plSentNoMaterial" class="explain explain-warn"
         style="display:none;font-size:0.85em" data-t="sentNoMaterial"></div>
    <div id="plSentNotReady" class="explain"
         style="display:none;font-size:0.85em;color:var(--text-muted)" data-t="sentNotReady"></div>

    <div id="plSentControls" style="display:none">
      <div id="plSentLocalBlock"
           style="margin-bottom:10px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:4px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
          <button class="btn" id="plSentLocalAddBtn" type="button" style="font-size:0.85em">
            <span data-t="sentLocalAdd"></span>
          </button>
          <span id="plSentLocalHint" style="font-size:0.78em;color:var(--text-muted)" data-t="sentLocalHint"></span>
        </div>
        <div id="plSentLocalList" style="display:none;font-size:0.85em"></div>
        <input type="file" id="plSentLocalInput" webkitdirectory multiple style="display:none" />
      </div>

      <div class="controls-row">
        <div class="control-group">
          <label data-t="sentSpeaker" style="margin-right:6px"></label>
          <select id="plSentSpeaker"
                  style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Sub-Block: Geraeusche (Platzhalter, kommt in spaeterer BA) -->
  <div id="plSubNoise" class="pl-subblock"
       style="margin-bottom: 12px; display: none; color: var(--text-muted); font-size: 0.9em"
       data-t="plNoiseComingSoon"></div>

  <!-- Sub-Block: Hoerbuecher (Platzhalter, kommt in spaeterer BA) -->
  <div id="plSubAudiobook" class="pl-subblock"
       style="margin-bottom: 12px; display: none; color: var(--text-muted); font-size: 0.9em"
       data-t="plAudiobookComingSoon"></div>

  <!-- Transport-Leiste -->
  <div id="plTransport" class="controls-row"
       style="align-items:center; gap:10px; margin-bottom:8px; flex-wrap:wrap">
    <button class="btn pl-trans-btn" id="plPrev" type="button"
            title="" data-tip="plTipPrev"
            style="width:40px;height:40px;border-radius:50%;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0">
      &#9198;
    </button>
    <button class="btn pl-trans-btn" id="plPlay" type="button"
            title="" data-tip="plTipPlay"
            style="width:44px;height:44px;border-radius:50%;font-size:1.1em;display:flex;align-items:center;justify-content:center;padding:0">
      &#9654;
    </button>
    <button class="btn pl-trans-btn" id="plStop" type="button"
            title="" data-tip="plTipStop"
            style="width:40px;height:40px;border-radius:50%;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0">
      &#9632;
    </button>
    <button class="btn pl-trans-btn" id="plNext" type="button"
            title="" data-tip="plTipNext"
            style="width:40px;height:40px;border-radius:50%;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0">
      &#9197;
    </button>
    <button class="btn pl-trans-btn" id="plLoopBtn" type="button"
            title="" data-tip="plTipLoop"
            style="width:40px;height:40px;border-radius:50%;font-size:1.0em;display:flex;align-items:center;justify-content:center;padding:0">
      &#128257;
    </button>

    <div style="flex:1; display:flex; flex-direction:column; gap:3px; min-width:160px">
      <input type="range" id="plTL" min="0" max="1000" value="0" step="1" style="width:100%" />
      <div style="display:flex; justify-content:space-between; font-family:var(--mono); font-size:0.78em; color:var(--text-muted)">
        <span id="plCur">0:00</span><span id="plTot">0:00</span>
      </div>
    </div>

    <div class="control-group">
      <label data-t="lblVol"></label>
      <input type="number" id="plVol" value="80" min="0" max="100" step="1"
             style="width:55px; padding:3px 5px; border:1px solid var(--border); border-radius:4px; text-align:center; font-family:var(--mono); font-size:0.88em" />%
    </div>
    <span style="font-family:var(--mono); font-size:0.72em; color:var(--text-muted); background:var(--bg); padding:2px 6px; border-radius:4px">Mono</span>
  </div>

  <!-- Eigene Zeile: Auto-Advance + Pause-Buttons -->
  <div id="plAutoAdvanceRow" class="controls-row"
       style="align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap">
    <button class="btn pl-trans-btn" id="plAutoAdvBtn" type="button"
            title="" data-tip="plTipAutoAdv"
            style="min-width:140px; font-weight:600; border-radius:6px">
      <span data-t="plAutoAdvLabel"></span>
    </button>
    <div class="control-group" style="flex-wrap:wrap; gap:4px">
      <label data-t="plPauseLabel" style="margin-right:4px"></label>
      <div id="plPauseBtns" style="display:flex; gap:3px; flex-wrap:wrap">
        <button class="btn pl-pause-btn" type="button" data-ms="500">500</button>
        <button class="btn pl-pause-btn" type="button" data-ms="750">750</button>
        <button class="btn pl-pause-btn" type="button" data-ms="1000">1000</button>
        <button class="btn pl-pause-btn" type="button" data-ms="2000">2000</button>
        <button class="btn pl-pause-btn" type="button" data-ms="4000">4000</button>
        <button class="btn pl-pause-btn" type="button" data-ms="8000">8000</button>
      </div>
      <span style="font-size:0.85em; color:var(--text-muted)">ms</span>
    </div>
  </div>

  <!-- Anzeige-Block -->
  <div id="plDisplayBox"
       style="padding:10px 12px; background:var(--bg); border:1px solid var(--border); border-radius:4px; font-size:0.9em; line-height:1.45">
    <div id="plDispTitle" style="font-weight:600; margin-bottom:4px">
      <span data-t="plDispEmpty"></span>
    </div>
    <label id="plSentTextToggleWrap"
           style="display:none; align-items:center; gap:6px; cursor:pointer; margin:4px 0">
      <input type="checkbox" id="plSentShowText" />
      <span data-t="sentShowText"></span>
    </label>
    <div id="plSentTextBox"
         style="display:none; padding:6px 8px; background:var(--card-bg, #fff); border:1px solid var(--border); border-radius:4px; font-size:0.95em; line-height:1.4; min-height:2.4em; margin:4px 0">
      <span id="plSentText"></span>
    </div>
    <div id="plDispMeta"
         style="font-size:0.82em; color:var(--text-muted); margin-top:4px"></div>
  </div>
</div>
```

**Wichtig:** Der `id="plDeafHintEl"` und `id="plNoD"` stehen heute in
der alten Audiodatei-Card. Sie werden in den neuen Musik-Sub-Block
übernommen (siehe oben). Bestehende JS-Referenzen darauf
(`document.getElementById("plDeafHintEl")` etc.) müssen weiter
funktionieren — die IDs ändern sich nicht.

## Schritt 2: i18n-Strings in `i18n/de.js`

**Nur deutsche Strings.** `en.js`, `fr.js`, `es.js` bleiben unverändert
(fehlende Keys fallen automatisch auf Deutsch zurück).

Im DE-Block ergänzen, bestehende Keys nicht doppelt anlegen:

```js
plPlayTitle: "Wiedergabe",
plSourceLabel: "Quelle:",
plSrcMusic: "♪ Musik",
plSrcSentences: "💬 Sätze",
plSrcNoise: "🔊 Geräusche",
plSrcAudiobook: "📖 Hörbücher",
plNoiseComingSoon: "Geräusche folgen in einer späteren Bauanleitung.",
plAudiobookComingSoon: "Hörbücher folgen in einer späteren Bauanleitung.",
plTipPrev: "Vorheriges Stück",
plTipPlay: "Abspielen / Pause",
plTipStop: "Stoppen",
plTipNext: "Nächstes Stück",
plTipLoop: "Aktuelles Stück endlos wiederholen",
plTipAutoAdv: "Nach Ende automatisch das nächste Stück abspielen (stoppt nach 30 min ohne Bedienung)",
plAutoAdvLabel: "↪ Auto-Weiter",
plPauseLabel: "Pause zwischen Stücken:",
plDispEmpty: "Nichts geladen",
plDispNoMeta: "—",
```

`sentBtnEndless` wird **nicht** mehr referenziert, der Key kann
in `de.js` stehen bleiben (verursacht keinen Schaden), darf aber
auch entfernt werden. Empfehlung: stehen lassen, damit alte
Übersetzungen in en/fr/es nicht zu Lade-Fehlern führen.

**Anführungszeichen-Hinweis:** in deutschen i18n-Strings können
typografische „" verwendet werden. Wenn ein String ein typografisches
`"` enthält, das von einem ASCII-`"`-Stringbegrenzer umschlossen ist,
ist das problemlos. Beispielsweise oben ist alles ASCII-sicher; bei
neuen Texten dieselbe Konsistenz halten.

## Schritt 3: State + Persistenz

### 3a. `js/state-side.js` — neue globale Variablen ans Ende des Block-Bereichs für Player-State (nach `plShowExperimental`):

```js
let plActiveSource = "music";   // "music" | "sentences" | "noise" | "audiobook"
let plAutoAdvance  = false;     // Auto-Advance-Toggle, Default aus
let plLoop         = false;     // Endlos-Toggle (aktuelles Stueck wiederholen), Default aus
let plPauseMs      = 2000;      // Pause zwischen Stuecken (ms), Default 2000
let plSentShowText = false;     // Satz-Text einblenden (Persistenz neu)
```

### 3b. `js/file.js` — Defaults beim Reset (in der Funktion, in der
auch `plBalanceMode` und `plShowExperimental` zurückgesetzt werden,
Z. ~80 und ~139):

```js
if (typeof plActiveSource !== "undefined") plActiveSource = "music";
if (typeof plAutoAdvance  !== "undefined") plAutoAdvance  = false;
if (typeof plLoop         !== "undefined") plLoop         = false;
if (typeof plPauseMs      !== "undefined") plPauseMs      = 2000;
if (typeof plSentShowText !== "undefined") plSentShowText = false;
```

### 3c. `js/file.js` — Save-Objekt (analog Z. ~243/272):

```js
plActiveSource: (typeof plActiveSource !== "undefined") ? plActiveSource : "music",
plAutoAdvance:  (typeof plAutoAdvance  !== "undefined") ? plAutoAdvance  : false,
plLoop:         (typeof plLoop         !== "undefined") ? plLoop         : false,
plPauseMs:      (typeof plPauseMs      !== "undefined") ? plPauseMs      : 2000,
plSentShowText: (typeof plSentShowText !== "undefined") ? plSentShowText : false,
```

### 3d. `js/file.js` — Restore (analog Z. ~596 und ~676):

```js
if (typeof plActiveSource !== "undefined") {
  plActiveSource = (d && typeof d.plActiveSource === "string"
                    && ["music", "sentences", "noise", "audiobook"].includes(d.plActiveSource))
    ? d.plActiveSource : "music";
  // BA192: noise und audiobook noch nicht verfuegbar -> auf music zurueckfallen
  if (plActiveSource === "noise" || plActiveSource === "audiobook") plActiveSource = "music";
}
if (typeof d.plAutoAdvance === "boolean")  plAutoAdvance  = d.plAutoAdvance;
if (typeof d.plLoop        === "boolean")  plLoop         = d.plLoop;
if (typeof d.plPauseMs     === "number" && d.plPauseMs >= 0) plPauseMs = d.plPauseMs;
if (typeof d.plSentShowText === "boolean") plSentShowText = d.plSentShowText;
```

### 3e. `js/init.js` — analog die Save/Restore-Stellen
(Autosave-Save Z. ~870, Autosave-Restore Z. ~711/630). Genau dieselben
Felder einbauen wie in file.js.

## Schritt 4: Zentrale Player-Steuerung in `js/player.js`

Eine dünne neue Steuer-Ebene oberhalb von `pToggle`/`pStopReset` und
den Sätze-Funktionen, die in Abhängigkeit von `plActiveSource` die
richtige Aktion auslöst. Bestehende Funktionen wie `pToggle`,
`pStopReset`, `sPlay`, `sNext`, `sStop` werden beibehalten und nur
aufgerufen.

### 4a. Neue zentrale Funktionen (z. B. ans Ende von `js/player.js` anhängen):

```js
// ===== BA192: zentrale Wiedergabe-Steuerung =====

function plPlayPauseToggle() {
  if (plActiveSource === "sentences") {
    if (typeof sActive !== "undefined" && sActive && typeof pPlaying !== "undefined" && pPlaying) {
      // laeuft -> Pause
      if (typeof pPause === "function") pPause();
      return;
    }
    if (typeof sActive !== "undefined" && sActive && typeof pPlaying !== "undefined" && !pPlaying && pBuf) {
      // pausiert -> Resume
      if (typeof pPlay === "function") pPlay();
      return;
    }
    // nichts aktiv -> ersten Satz starten
    if (typeof sPlay === "function") sPlay();
    return;
  }
  // music (default)
  if (typeof pToggle === "function") pToggle();
}

function plStopAll() {
  if (typeof sActive !== "undefined" && sActive && typeof sStop === "function") sStop();
  if (typeof pStopReset === "function") pStopReset();
  _plAutoAdvCancel();
}

function plPrev() {
  // BA192: Musik hat heute keine Playlist -> Slider auf 0.
  // Saetze: anderen zufaelligen Satz waehlen (wie Next, aber semantisch klar abgegrenzt).
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  if (typeof pStopReset === "function") {
    pStopReset();
    if (typeof pToggle === "function") pToggle();
  }
}

function plNext() {
  if (plActiveSource === "sentences" && typeof sNext === "function") {
    sNext();
    return;
  }
  // Musik: heute kein Next vorhanden -> Slider an Ende (Track zu Ende spielen lassen geht nicht ohne Playlist).
  // Vorerst: kein Effekt. In spaeterer BA mit Playlist nachruesten.
}

function plToggleLoop() {
  plLoop = !plLoop;
  plUpdTransportUI();
}

function plToggleAutoAdvance() {
  plAutoAdvance = !plAutoAdvance;
  plUpdTransportUI();
  if (!plAutoAdvance) _plAutoAdvCancel();
}

function plSetPause(ms) {
  plPauseMs = ms;
  plUpdTransportUI();
}

function plSetSource(src) {
  if (!["music", "sentences", "noise", "audiobook"].includes(src)) return;
  // BA192: noise und audiobook noch nicht verfuegbar
  if (src === "noise" || src === "audiobook") return;
  if (src === plActiveSource) return;
  // Wechsel = Stop laufender Wiedergabe
  plStopAll();
  plActiveSource = src;
  plUpdSourceUI();
  plUpdDisplay();
}

function plUpdSourceUI() {
  const btnM = document.getElementById("plSrcMusicBtn");
  const btnS = document.getElementById("plSrcSentencesBtn");
  const btnN = document.getElementById("plSrcNoiseBtn");
  const btnA = document.getElementById("plSrcAudiobookBtn");
  const subM = document.getElementById("plSubMusic");
  const subS = document.getElementById("plSubSentences");
  const subN = document.getElementById("plSubNoise");
  const subA = document.getElementById("plSubAudiobook");
  function setActive(btn, on) {
    if (!btn) return;
    btn.classList.toggle("active", on);
    btn.style.background = on ? "var(--accent, #6aa84f)" : "";
    btn.style.color      = on ? "#fff" : "";
  }
  setActive(btnM, plActiveSource === "music");
  setActive(btnS, plActiveSource === "sentences");
  setActive(btnN, false); // Geraeusche in BA192 immer aus
  setActive(btnA, false); // Audiobook in BA192 immer aus
  if (subM) subM.style.display = (plActiveSource === "music")     ? "" : "none";
  if (subS) subS.style.display = (plActiveSource === "sentences") ? "" : "none";
  if (subN) subN.style.display = (plActiveSource === "noise")     ? "" : "none";
  if (subA) subA.style.display = (plActiveSource === "audiobook") ? "" : "none";
}

function plUpdTransportUI() {
  const loopBtn = document.getElementById("plLoopBtn");
  if (loopBtn) {
    loopBtn.classList.toggle("active", plLoop);
    loopBtn.style.background = plLoop ? "var(--accent, #6aa84f)" : "";
    loopBtn.style.color      = plLoop ? "#fff" : "";
  }
  const aaBtn = document.getElementById("plAutoAdvBtn");
  if (aaBtn) {
    aaBtn.classList.toggle("active", plAutoAdvance);
    aaBtn.style.background = plAutoAdvance ? "var(--accent, #6aa84f)" : "";
    aaBtn.style.color      = plAutoAdvance ? "#fff" : "";
  }
  // Pause-Buttons: aktiver Wert hervorheben, alle ausgegraut wenn Auto-Advance aus
  document.querySelectorAll(".pl-pause-btn").forEach(function (b) {
    const v = parseInt(b.dataset.ms, 10);
    const active = (v === plPauseMs);
    b.classList.toggle("active", active);
    b.style.background = active ? "var(--accent, #6aa84f)" : "";
    b.style.color      = active ? "#fff" : "";
    b.disabled = !plAutoAdvance;
    b.style.opacity = plAutoAdvance ? "1" : "0.5";
    b.style.cursor  = plAutoAdvance ? "pointer" : "not-allowed";
  });
  // Prev/Next: in BA192 nur bei Saetzen sinnvoll, bei Musik ausgegraut
  const prevBtn = document.getElementById("plPrev");
  const nextBtn = document.getElementById("plNext");
  const hasNext = (plActiveSource === "sentences");
  [prevBtn, nextBtn].forEach(function (b) {
    if (!b) return;
    b.disabled = !hasNext;
    b.style.opacity = hasNext ? "1" : "0.5";
    b.style.cursor  = hasNext ? "pointer" : "not-allowed";
  });
}

function plUpdDisplay() {
  const title = document.getElementById("plDispTitle");
  const meta  = document.getElementById("plDispMeta");
  const textToggleWrap = document.getElementById("plSentTextToggleWrap");
  if (!title || !meta) return;

  let titleText = "";
  let metaParts = [];
  let showTextToggle = false;

  if (plActiveSource === "sentences") {
    showTextToggle = true;
    if (typeof sCurRec !== "undefined" && sCurRec) {
      // Sprecher-Label aus dem aktiven Sprecher der aktuellen Aufnahme:
      const spkKey = sCurRec.speakerKey || "";
      const spk = (typeof sCorpus !== "undefined" && sCorpus && sCorpus.speakers && sCorpus.speakers[spkKey]) || null;
      titleText = sCurRec.text || (typeof t === "function" ? t("plDispEmpty") : "—");
      if (spk && spk.label) metaParts.push(((typeof t === "function") ? t("sentSpeaker") : "Sprecher:") + " " + spk.label);
      if (spk && spk.source)  metaParts.push(spk.source);
      if (spk && spk.license) metaParts.push(spk.license);
    } else {
      titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
    }
  } else if (plActiveSource === "music") {
    const fi = document.getElementById("plAudio");
    const fname = (fi && fi.files && fi.files[0]) ? fi.files[0].name : "";
    titleText = fname || ((typeof t === "function") ? t("plDispEmpty") : "Nichts geladen");
    // Musik aus User-Upload: keine Lizenz-Metadaten verfuegbar
  } else {
    titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
  }

  title.textContent = titleText;
  meta.textContent  = metaParts.length ? metaParts.join(" · ") : "";
  if (textToggleWrap) textToggleWrap.style.display = showTextToggle ? "inline-flex" : "none";

  // Satz-Textbox folgt der Persistenz-Variable plSentShowText, aber nur bei Saetzen
  const tb = document.getElementById("plSentTextBox");
  const tx = document.getElementById("plSentText");
  const cb = document.getElementById("plSentShowText");
  if (cb) cb.checked = !!plSentShowText;
  if (tb) tb.style.display = (plActiveSource === "sentences" && plSentShowText) ? "" : "none";
  if (tx && plActiveSource === "sentences") {
    tx.textContent = (typeof sCurRec !== "undefined" && sCurRec && sCurRec.text) ? sCurRec.text : "";
  }
}
```

### 4b. Idle-Timer (30 Minuten ohne UI-Interaktion):

Direkt nach den Funktionen aus 4a einfügen:

```js
let _plIdleTimer = null;
const _PL_IDLE_MS = 30 * 60 * 1000;

function _plArmIdleTimer() {
  _plClearIdleTimer();
  _plIdleTimer = setTimeout(function () {
    if (plAutoAdvance) {
      console.log("[player] Auto-Advance gestoppt: 30 min ohne Bedienung");
      plStopAll();
    }
  }, _PL_IDLE_MS);
}
function _plClearIdleTimer() {
  if (_plIdleTimer) { clearTimeout(_plIdleTimer); _plIdleTimer = null; }
}
function _plNoteInteraction() {
  if (plAutoAdvance && (pPlaying || (typeof sActive !== "undefined" && sActive))) {
    _plArmIdleTimer();
  }
}
function _plAutoAdvCancel() {
  _plClearIdleTimer();
}

// Globaler Interaktions-Listener: jeder Klick/Tastendruck/Touch im Dokument
// gilt als Interaktion und setzt den Idle-Timer zurueck.
document.addEventListener("click",      _plNoteInteraction, true);
document.addEventListener("keydown",    _plNoteInteraction, true);
document.addEventListener("touchstart", _plNoteInteraction, true);
```

### 4c. Event-Listener-Verkabelung (z. B. ans Ende von `js/player.js`
oder ans Ende von `js/init.js`, je nachdem, wo bestehende
Player-Listener verkabelt sind — heute teilweise in `player.js` Z. 666):

```js
// BA192: Quellen-Top-Toggle
document.getElementById("plSrcMusicBtn").addEventListener("click",
  function () { plSetSource("music"); });
document.getElementById("plSrcSentencesBtn").addEventListener("click",
  function () { plSetSource("sentences"); });
// AudiobookBtn ist disabled, kein Listener noetig

// BA192: Transport-Knoepfe (Play/Stop sind heute schon verkabelt mit pToggle/pStopReset;
// die Verkabelung wird umgehaengt auf die neue zentrale Steuerung)
const _plPlayBtnEl = document.getElementById("plPlay");
const _plStopBtnEl = document.getElementById("plStop");
// Alte Listener aushaengen ist nicht trivial -> stattdessen die alten Listener-Setup-Zeilen
// (siehe player.js Z. 666/667) durch die neuen ersetzen, NICHT zusaetzlich anhaengen.
// In der bestehenden Datei also pToggle/pStopReset-Listener entfernen und durch:
_plPlayBtnEl.addEventListener("click", plPlayPauseToggle);
_plStopBtnEl.addEventListener("click", plStopAll);

document.getElementById("plPrev").addEventListener("click", plPrev);
document.getElementById("plNext").addEventListener("click", plNext);
document.getElementById("plLoopBtn").addEventListener("click", plToggleLoop);
document.getElementById("plAutoAdvBtn").addEventListener("click", plToggleAutoAdvance);

document.querySelectorAll(".pl-pause-btn").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = parseInt(b.dataset.ms, 10);
    if (Number.isFinite(v)) plSetPause(v);
  });
});

// Satz-Text-Checkbox
const _plSentTxtCb = document.getElementById("plSentShowText");
if (_plSentTxtCb) {
  _plSentTxtCb.addEventListener("change", function () {
    plSentShowText = !!_plSentTxtCb.checked;
    plUpdDisplay();
  });
}

// Tooltip-Initialisierung: data-tip-Keys nach Sprachwechsel auf title-Attribut spiegeln
function plRefreshTooltips() {
  document.querySelectorAll("[data-tip]").forEach(function (el) {
    const k = el.getAttribute("data-tip");
    if (k && typeof t === "function") el.title = t(k);
  });
}

// Erstaufbau:
plUpdSourceUI();
plUpdTransportUI();
plUpdDisplay();
plRefreshTooltips();
```

**Wichtig zum Listener-Umbau:** In `player.js` heute auf Z. 666/667
stehen die Zeilen

```js
document.getElementById("plPlay").addEventListener("click", pToggle);
document.getElementById("plStop").addEventListener("click", pStopReset);
```

Diese zwei Zeilen werden **ersetzt** durch die neuen Verkabelungen
oben (`plPlayPauseToggle` / `plStopAll`). Wenn beides verkabelt
bliebe, würden bei einem Klick zwei verschiedene Handler feuern.

## Schritt 5: Sätze-Funktion umstellen in `js/sentences.js`

### 5a. Endlos-Semantik auflösen

Die Funktion `sEndlessStart` und die Variable `sEndless` /
`sEndlessCount` werden entfernt. Stattdessen entscheidet `sOnEnded`
anhand der zentralen Toggles `plLoop` und `plAutoAdvance`, ob ein
weiterer Satz folgt — und welcher.

`sPlay`-Funktion (Z. ~205): die zwei Zeilen
`sEndless = false;` und `sEndlessCount = 0;` (falls vorhanden)
entfernen. `sActive = true` bleibt.

`sNext`-Funktion (Z. ~220): `sEndless = false;` entfernen.

`sEndlessStart`-Funktion (Z. ~233): **komplett entfernen.**

`sStop`-Funktion (Z. ~247): `sEndless = false;` und
`sEndlessCount` entfernen.

`sOnEnded`-Funktion (Z. ~267) **komplett ersetzen durch:**

```js
function sOnEnded() {
  if (!sActive) return;

  // Loop hat Vorrang: gleichen Satz nochmal
  if (typeof plLoop !== "undefined" && plLoop) {
    const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
    if (ms > 0) {
      sPauseTimer = setTimeout(function () {
        sPauseTimer = null;
        if (sActive) sPlayCurrent();
      }, ms);
    } else {
      sPlayCurrent();
    }
    return;
  }

  // Auto-Advance: anderen zufaelligen Satz waehlen
  if (typeof plAutoAdvance !== "undefined" && plAutoAdvance) {
    const spkSel = document.getElementById("plSentSpeaker").value;
    const pool = sBuildRecordingPool(spkSel);
    if (pool.length === 0) { sStop(); return; }
    sCurRec = sPickRandom(pool, sCurRec);
    const ms = (typeof plPauseMs !== "undefined") ? plPauseMs : 0;
    if (ms > 0) {
      sPauseTimer = setTimeout(function () {
        sPauseTimer = null;
        if (sActive) sPlayCurrent();
      }, ms);
    } else {
      sPlayCurrent();
    }
    return;
  }

  // Weder Loop noch Auto-Advance: still anhalten
  sStop();
}
```

### 5b. `sUpdateButtons` entfernen oder zu No-Op machen

Die alte Knopf-Update-Logik bezog sich auf die jetzt entfallenen
Sätze-spezifischen Knöpfe (`plSentPlay`, `plSentNext`,
`plSentEndless`, `plSentStop`). Diese Knöpfe existieren nicht mehr.
`sUpdateButtons` wird **leer gemacht** (zu `function sUpdateButtons() {}`)
oder die Funktion und alle Aufrufe darauf werden entfernt.
Variante 1 (leer machen) ist sicherer, weil bestehende Aufrufer
nicht angefaßt werden müssen.

Zusätzlich: `sActive`-Zustandsänderungen sollen `plUpdDisplay()`
auslösen, damit Titel und Sprecher-Anzeige aktuell bleiben. Hierzu
in jedem von `sPlay`, `sNext`, `sStop`, `sPlayCurrent` (Stelle: nach
`sCurRec = ...`) und im Erfolgspfad von `sOnEnded` eine Zeile
ergänzen:

```js
if (typeof plUpdDisplay === "function") plUpdDisplay();
```

### 5c. `sUpdateUI` anpassen

Die heutige `sUpdateUI` (Z. ~325) operiert auf `plSentencesCard` und
`plSentControls`. Da der Sätze-Sub-Block nun innerhalb der
Wiedergabe-Card sitzt, gilt:

- Statt `document.getElementById("plSentencesCard")` → `document.getElementById("plSubSentences")`.
- `plSentControls` bleibt; sein Eltern-Element ist jetzt `plSubSentences`.

Effekt: bei keinem verfügbaren Material wird der Sätze-**Sub-Block**
mit Hinweis-Text gezeigt, die anderen Bereiche bleiben unberührt.

## Schritt 6: Datei-Picker-Logik (`plAudio`) im Musik-Sub-Block

Der Datei-Picker `#plAudio` wird heute in `js/player.js` (Z. 231 ff.)
auf `change` gehört, lädt die Datei in `pBuf` und setzt
`plCtrl.style.display = ""` (Z. 252). Das setzt auf das alte
versteckte Steuer-Container-Div. Da `plCtrl` nicht mehr existiert,
**diese Zeile entfernen**. Die Transport-Leiste ist jetzt immer
sichtbar; einzelne Knöpfe steuern ihre Aktivierung über
`plUpdTransportUI()`.

Statt `plCtrl.style.display = ""` am Ende des change-Handlers
folgendes anhängen:

```js
if (typeof plUpdDisplay === "function") plUpdDisplay();
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
```

## Schritt 7: Aufruf-Stellen für UI-Sync

Überall, wo heute ein Re-Render des Player-Tabs nötig ist (Tab-Wechsel,
Sprachwechsel, Side-Wechsel, Lade-Vorgänge), zusätzlich aufrufen:

```js
if (typeof plUpdSourceUI    === "function") plUpdSourceUI();
if (typeof plUpdTransportUI === "function") plUpdTransportUI();
if (typeof plUpdDisplay     === "function") plUpdDisplay();
if (typeof plRefreshTooltips === "function") plRefreshTooltips();
```

Mindestens an diesen Stellen einklinken:

- `js/init.js`: nach dem JSON-Restore (in der Region, in der heute
  `plBalanceMode` wieder gesetzt wird, Z. ~713)
- `js/i18n.js`: in der Funktion, die nach Sprachwechsel die DOM-Strings
  re-applied (Suche nach `applyLang`)

## Schritt 8: Doku nachziehen

### 8a. `docs/CODESTRUKTUR.md`

Im Abschnitt „Player" das HTML-Card-Layout aktualisieren: statt fünf
Karten heißt es jetzt vier Karten (Einleitung, EQ-Graph, Einstellungen,
Wiedergabe). Die Beschreibung der heutigen Cards 4 (Audiodatei) und
4b (Sätze) wird durch eine Beschreibung der neuen Wiedergabe-Card
ersetzt: Top-Toggle Quelle, Sub-Block je Quelle, Transport-Leiste,
Auto-Advance-Zeile, Anzeige-Block.

### 8b. `docs/spec/06-player.md`

Im Abschnitt „Aufbau des Tabs" Punkt 4 ersetzen durch:

```
4. **Wiedergabe** (`plPlayTitle`) — vereinheitlichte Card mit Top-Toggle
   Quelle (Musik / Sätze / Hörbücher; Hörbücher ausgegraut bis spätere BA),
   quellenspezifischer Sub-Block, gemeinsamer Transport-Leiste (Prev,
   Play/Pause, Stop, Next, Endlos-Toggle, Slider, Lautstärke), eigener
   Zeile für Auto-Advance-Toggle + Pause-Buttons, und Anzeige-Block
   (Titel, Sprecher, Quelle, Lizenz, optional Satz-Text).
   - Endlos (🔁) = aktuelles Stück wiederholen.
   - Auto-Advance (↪) = nach Stück-Ende nächstes Stück (Random-Satz
     bei Sätzen; bei Musik in BA 192 ohne Folge-Track, da keine
     Playlist). Stoppt nach 30 Minuten ohne UI-Interaktion.
   - Pause-Buttons: 500 / 750 / 1000 / 2000 / 4000 / 8000 ms, wirken
     nur bei aktivem Auto-Advance; sonst ausgegraut. Default 2000.
   - Loop hat Vorrang vor Auto-Advance.
```

Im selben Kapitel den Abschnitt „Sätze-Wiedergabe im Player" so
anpassen, daß die alten Knöpfe „Spielen / Nächster / Endlosfolge /
Stop" durch die zentrale Transport-Leiste abgelöst sind und die
Endlos-Folge-Konzept-Migration erklärt wird (Endlos heißt jetzt
„aktueller Satz wiederholen"; die alte Random-Folge erreicht man
durch Auto-Advance).

## Schritt 9: Version-Bump

`js/version.js`:

```js
const APP_VERSION = "3.2.192-beta";
```

## Akzeptanztest (Klick-für-Klick)

1. Tool im Browser laden (Hard-Reload für Cache-Bypass). In der
   Statuszeile oder im Page-Source `3.2.192-beta` als Version
   sichtbar. **Erwartet:** ✓
2. Tab „Player" wählen. Card „Wiedergabe" sichtbar (statt vorher zwei
   Cards „Audiodatei" + „Sätze abspielen"). Vier Quellen-Knöpfe
   sichtbar; „Musik" hervorgehoben, „Sätze" normal, „Geräusche" und
   „Hörbücher" ausgegraut. **Erwartet:** ✓
3. Transport-Leiste sichtbar, auch ohne geladene Datei. Prev und
   Next sind ausgegraut (in Musik-Modus ohne Playlist). Play, Stop
   und Loop sichtbar. Slider auf 0. **Erwartet:** ✓
4. Zeile darunter: „↪ Auto-Weiter"-Knopf normal (nicht aktiv) und
   Pause-Buttons 500…8000 ms ausgegraut (weil Auto-Advance aus).
   **Erwartet:** ✓
5. Anzeige-Block ganz unten zeigt „Nichts geladen" und keine
   Sprecher-/Lizenz-Zeile. **Erwartet:** ✓
6. Eine eigene Audiodatei in den Musik-Bereich laden. Anzeige
   wechselt zum Dateinamen. Play startet die Wiedergabe; Slider
   läuft; Stop setzt zurück. **Erwartet:** ✓
7. Quelle auf „Sätze" wechseln. Laufende Datei-Wiedergabe stoppt.
   Sub-Block „Sätze" mit Sprecher-Dropdown und Lokal-Ordner-Knopf
   sichtbar. Anzeige zeigt „Nichts geladen". **Erwartet:** ✓
8. Play drücken: ein zufälliger Satz spielt einmal, dann Stille.
   Anzeige zeigt den aktuellen Satz-Text und den Sprecher in der
   Meta-Zeile (z. B. „Sprecher: Thorsten · thorsten-voice.de · CC0"
   oder ähnlich, abhängig von den vorhandenen `sCorpus`-Metadaten).
   Prev und Next sind jetzt aktiv. **Erwartet:** ✓
9. Checkbox „Text anzeigen" anhaken: Satz-Text erscheint als eigene
   Textbox unter dem Titel. Re-Load der Seite (im selben Tab): die
   Quelle „Sätze" und der Haken bleiben gesetzt. **Erwartet:** ✓
10. 🔁 Loop-Knopf einschalten (hebt sich hervor). Play drücken: der
    Satz wird endlos wiederholt, mit Pause dazwischen (Default 2000 ms
    sollte zwischen Wiederholungen wirken — Loop nutzt dieselbe
    Pause-Wahl). Stop hält. **Erwartet:** ✓
11. Loop wieder aus. „↪ Auto-Weiter" anschalten (hebt sich hervor).
    Pause-Buttons werden aktiv; ein Wert ist hervorgehoben (2000).
    500 ms wählen. Play drücken: nach jedem Satz folgt mit kurzer
    Pause ein anderer zufälliger Satz. Nach Klick auf Stop: hält an.
    **Erwartet:** ✓
12. Quelle auf „Geräusche" oder „Hörbücher" klicken: nichts passiert
    (Knöpfe sind disabled). **Erwartet:** ✓
13. Sprachwechsel im Tool (Footer-Sprachwahl): die Quellen-Knöpfe und
    Transport-Tooltips zeigen die Übersetzungen, soweit vorhanden.
    Bei fehlenden Übersetzungen fallen die Texte auf Deutsch zurück
    (en/fr/es werden in dieser BA nicht ergänzt). **Erwartet:** ✓
14. Save (JSON-Download), neuen Tab im Browser, Tool laden, Restore:
    Quelle, Auto-Advance-Zustand, Loop-Zustand, Pause-Wert und
    Text-Anzeige-Haken sind wiederhergestellt. **Erwartet:** ✓

## Selbstprüfungs-Auftrag

**Bevor du fertig meldest:** Gehe jeden der 14 Akzeptanzpunkte
einzeln durch und melde pro Punkt: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Code-Stelle.
Bei unklarem Punkt: nicht raten, sondern Rückfrage stellen.

Zusätzliche Prüfungen vor Fertig-Meldung:

- In `index.html`: alte Cards `plFileTitle` (Audiodatei) und
  `plSentencesCard` sind komplett entfernt; die neue Card
  `plPlayCard` ist an deren Stelle eingefügt. Vier Quellen-Knöpfe
  vorhanden (`plSrcMusicBtn`, `plSrcSentencesBtn`, `plSrcNoiseBtn`,
  `plSrcAudiobookBtn`); die letzten zwei `disabled`. Keine doppelten
  IDs (`plPlay`, `plStop`, `plTL`, `plVol`, `plAudio`, `plSentSpeaker`,
  `plSentText`, `plSentTextBox`, `plSentShowText` etc.) im Dokument.
- In `js/player.js`: alte Listener-Zeilen `plPlay`/`plStop` →
  `pToggle`/`pStopReset` sind durch die neuen Verkabelungen
  (`plPlayPauseToggle`/`plStopAll`) ersetzt, nicht ergänzt. Die Zeile
  `document.getElementById("plCtrl").style.display = ""` ist
  entfernt (das Element existiert nicht mehr).
- In `js/sentences.js`: `sEndlessStart`, `sEndless`, `sEndlessCount`
  sind entfernt. Die Funktion `sOnEnded` orientiert sich an den
  zentralen Toggles `plLoop` und `plAutoAdvance`.
- In `js/state-side.js` und `js/file.js` und `js/init.js`: die fünf
  neuen Variablen `plActiveSource`, `plAutoAdvance`, `plLoop`,
  `plPauseMs`, `plSentShowText` sind in Reset, Save und Restore
  konsistent berücksichtigt.
- In `docs/CODESTRUKTUR.md` und `docs/spec/06-player.md`: die
  Anpassungen aus Schritt 8 sind vorhanden.
- `js/version.js` enthält `"3.2.192-beta"`.

## Folge-Bauanleitungen (kein Bestandteil dieser BA)

- **BA 193 (geplant):** Geräusche-Quelle aktivieren — Bibliotheks-
  Auswahl über das vorhandene Manifest (`audio.manifest/`,
  Kategorie `geraeusche`), plus generierte Standardrauscher
  (Pink/White/Brown Noise im Browser ohne Datei). Loop-Wiedergabe
  per Default.
- **BA 194 (geplant):** Sätze + Hintergrund-Geräusch über
  Pre-Mix. SNR-Quick-Buttons. Subset-Auswahl aus dem
  Geräusch-Katalog (erst ein Geräusch zur Zeit, manuell wählbar).
- **BA 195 (geplant):** Hörbuch-Quelle aktivieren — lokale Datei,
  lokaler Ordner mit Kapiteln, Kapitelliste.
- **BA 196+ (geplant):** Online-Bibliotheken anbinden (Webspace,
  LibriVox, Internet Archive).
- **i18n-Folge-BA:** Übersetzungen `en.js`, `fr.js`, `es.js` für
  die neuen Keys nachziehen — nach Abschluss der UI-Iteration.
