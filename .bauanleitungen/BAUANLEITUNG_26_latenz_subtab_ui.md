# Bauanleitung 26: Latenz-Messung — Sub-Tab und UI

Zweite von drei Bauanleitungen. Setzt **Bauanleitung 25** voraus
(Engine in `latency.js`, DelayNodes im Player-Graph).

Diese Anleitung baut den Sub-Tab „Latenz" unter „Messungen" mit
allen Bedienelementen. Die Engine aus 25 wird durch UI-Events
angesteuert. Nach diesem Build ist die Messung im Browser ohne
Konsole bedienbar; Persistenz und Ergebnis-Anzeige folgen in
Bauanleitung 27.

## Ziel dieses Builds

- Neuer Sub-Tab-Button „Latenz" in „Messungen", neben „Frequenz-
  abgleich".
- Subpanel-Inhalt:
  - **BT-Warnung** als prominente Hinweis-Box ganz oben.
  - **Schieber** −50 ms … +50 ms, mit Tastatursteuerung
    (Pfeil = 1 ms, Shift+Pfeil = 0,1 ms, Ctrl+Pfeil = 10 ms).
  - Klartext-Anzeige unter dem Schieber.
  - **Klick-Intervall-Buttonreihe** (30 / 50 / 100 / 200 / 500 ms).
  - **Klangtyp-Buttonreihe** (Klick / Tieftöner / Mittelton /
    Hochton).
  - **Abwechseln-Toggle** (Klickfolge ↔ Einzelklick im Wechsel).
  - **Start/Stop-Knopf** für den Test.
  - **Tab-Locked-Hinweis** während aktivem Test.
- Tab-Lock: während `latActive=true` keinen Wechsel zu anderen
  Haupt-Tabs erlauben (analog `lrRunning` / `fmRunning`).
- Alle Texte erstmal **deutsch hartkodiert**. i18n-Keys kommen in
  Bauanleitung 27.

## Schritt 1 — HTML in `index.html` einfügen

### 1a. Sub-Tab-Button

In `index.html`, Block ab Z. 431, die Subtab-Buttons im
`panel-messungen`:

Vorher:
```html
<button class="subtab active" data-subtab="test" data-parent="messungen">Elektrodenlautstärke-Balance</button>
<button class="subtab" data-subtab="balance" data-parent="messungen">Stereo-Balance</button>
<button class="subtab" data-subtab="freqmatch" data-parent="messungen" id="fmSubtabBtn">Frequenzabgleich</button>
```

Nachher:
```html
<button class="subtab active" data-subtab="test" data-parent="messungen">Elektrodenlautstärke-Balance</button>
<button class="subtab" data-subtab="balance" data-parent="messungen">Stereo-Balance</button>
<button class="subtab" data-subtab="freqmatch" data-parent="messungen" id="fmSubtabBtn">Frequenzabgleich</button>
<button class="subtab" data-subtab="latenz" data-parent="messungen" id="latSubtabBtn">Latenz</button>
```

### 1b. Subpanel-Container mit Inhalt

In `index.html`, direkt nach Z. 442
(`<div id="subpanel-messungen-freqmatch" class="subpanel"></div>`)
und **vor** dem schließenden `</div><!-- /panel-messungen-wrapper -->`,
folgenden Block einfügen:

```html
      <!-- ===== LATENZ ===== -->
      <div id="subpanel-messungen-latenz" class="subpanel">
        <div class="card">
          <div class="info-box" style="background:#fef3c7;border-color:#f59e0b;color:#78350f;margin-bottom:16px;">
            <strong>⚠️ Wichtig: Diesen Test nur mit Kabel-Kopfhörern durchführen.</strong><br>
            Bluetooth fügt eigene, unterschiedliche Latenzen pro Ohr hinzu und verfälscht die Messung.
            Andere Tests funktionieren mit Bluetooth — dieser hier <em>nicht</em>.
          </div>

          <h2>Latenz-Messung</h2>
          <p style="color:var(--text-muted);font-size:0.95em;">
            Stelle mit dem Schieber den Versatz ein, bei dem die Klicks gleichzeitig
            wahrgenommen werden. Pfeiltasten: 1 ms — Shift+Pfeil: 0,1 ms —
            Strg+Pfeil: 10 ms.
          </p>

          <!-- Schieber -->
          <div style="margin:20px 0;">
            <input type="range" id="latSlider" min="-50" max="50" step="0.1" value="0"
                   style="width:100%;" />
            <div style="display:flex;justify-content:space-between;font-size:0.85em;color:var(--text-muted);">
              <span>−50 ms (rechts verzögern)</span>
              <span>0</span>
              <span>+50 ms (links verzögern)</span>
            </div>
            <div id="latValueText" style="text-align:center;margin-top:12px;font-size:1.1em;">
              0,0 ms — kein Versatz
            </div>
          </div>

          <!-- Klick-Intervall -->
          <div style="margin:18px 0;">
            <div style="font-weight:600;margin-bottom:6px;">Klick-Intervall</div>
            <div id="latIntervalRow" class="btn-row" style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn lat-interval-btn" data-ms="30">30 ms</button>
              <button class="btn lat-interval-btn" data-ms="50">50 ms</button>
              <button class="btn lat-interval-btn active" data-ms="100">100 ms</button>
              <button class="btn lat-interval-btn" data-ms="200">200 ms</button>
              <button class="btn lat-interval-btn" data-ms="500">500 ms</button>
            </div>
            <div id="latIntervalHint" style="font-size:0.85em;color:var(--text-muted);margin-top:4px;">
              Eindeutiger Bereich: ±50 ms
            </div>
          </div>

          <!-- Klangtyp -->
          <div style="margin:18px 0;">
            <div style="font-weight:600;margin-bottom:6px;">Klangtyp</div>
            <div id="latClickRow" class="btn-row" style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn lat-click-btn active" data-type="click">Klick (breitband)</button>
              <button class="btn lat-click-btn" data-type="burst500">Tieftöner 500 Hz</button>
              <button class="btn lat-click-btn" data-type="burst1500">Mittelton 1500 Hz</button>
              <button class="btn lat-click-btn" data-type="burst4000">Hochton 4 kHz</button>
            </div>
          </div>

          <!-- Abwechseln -->
          <div style="margin:18px 0;">
            <label style="display:inline-flex;align-items:center;gap:8px;">
              <input type="checkbox" id="latAltCheckbox" />
              <span>Klickfolge und Einzelklick abwechselnd (3 s Folge + 1 Einzelklick im Wechsel)</span>
            </label>
          </div>

          <!-- Start/Stop -->
          <div style="margin:24px 0 8px 0;">
            <button class="btn primary" id="latStartBtn">▶ Test starten</button>
            <button class="btn" id="latStopBtn" disabled>■ Stop</button>
          </div>

          <!-- Locked-Hint -->
          <div id="latLockedHint" class="info-box tab-locked-hint" hidden
               style="margin-top:16px;">
            Test läuft. Stoppe den Test, um die Tabs zu wechseln.
          </div>
        </div>
      </div>
```

Die Klassen `info-box`, `card`, `btn`, `btn-row`, `tab-locked-hint`,
`primary` existieren in `style.css` bereits und werden auch von
anderen Tabs genutzt.

## Schritt 2 — UI-Verdrahtung in `latency.js` ergänzen

Am **Ende** von `latency.js` (nach den Funktionen aus
Bauanleitung 25) den folgenden Block anhängen:

```js
// =====================================================================
// UI-Bindings (Bauanleitung 26)
// =====================================================================

let latEls = null;  // wird in DOMContentLoaded befüllt

function latUpdateValueText() {
  if (!latEls || !latEls.valueText) return;
  const v = latSliderMs;
  let txt;
  if (Math.abs(v) < 0.05) {
    txt = "0,0 ms — kein Versatz";
  } else if (v > 0) {
    txt = `+${v.toFixed(1).replace(".", ",")} ms — linke Seite war ${v.toFixed(1).replace(".", ",")} ms schneller. Wird ausgeglichen.`;
  } else {
    const a = Math.abs(v).toFixed(1).replace(".", ",");
    txt = `−${a} ms — rechte Seite war ${a} ms schneller. Wird ausgeglichen.`;
  }
  latEls.valueText.textContent = txt;
}

function latUpdateIntervalHint() {
  if (!latEls || !latEls.intervalHint) return;
  const unique = latIntervalMs / 2;
  latEls.intervalHint.textContent =
    `Eindeutiger Bereich: ±${unique} ms` +
    (unique < 50 ? " (bei mehr Versatz wird die Richtung mehrdeutig)" : "");
}

function latUpdateButtonStates() {
  if (!latEls) return;
  for (const b of latEls.intervalBtns) {
    b.classList.toggle("active", parseInt(b.dataset.ms, 10) === latIntervalMs);
  }
  for (const b of latEls.clickBtns) {
    b.classList.toggle("active", b.dataset.type === latClickType);
  }
  if (latEls.altCheckbox) latEls.altCheckbox.checked = latAltMode;
  if (latEls.startBtn) latEls.startBtn.disabled = latActive;
  if (latEls.stopBtn)  latEls.stopBtn.disabled  = !latActive;
  if (latEls.lockedHint) latEls.lockedHint.hidden = !latActive;
}

function latSliderInput(newMs) {
  // Wert auf step-Genauigkeit clampen
  let v = parseFloat(newMs);
  if (!isFinite(v)) v = 0;
  if (v < -50) v = -50;
  if (v >  50) v =  50;
  // auf 0.1 runden
  v = Math.round(v * 10) / 10;
  if (latEls && latEls.slider) latEls.slider.value = String(v);
  latSetSliderMs(v);
  latUpdateValueText();
}

function latKeyHandler(ev) {
  if (!latEls || document.activeElement !== latEls.slider) return;
  let step = 1;
  if (ev.shiftKey) step = 0.1;
  if (ev.ctrlKey || ev.metaKey) step = 10;
  let delta = 0;
  if (ev.key === "ArrowLeft"  || ev.key === "ArrowDown") delta = -step;
  if (ev.key === "ArrowRight" || ev.key === "ArrowUp")   delta =  step;
  if (delta === 0) return;
  ev.preventDefault();
  latSliderInput(latSliderMs + delta);
}

function latStartTestUI() {
  latStartTest();
  latUpdateButtonStates();
  // Tab-Lock-State aktualisieren
  if (typeof updateTabLockState === "function") updateTabLockState();
}

function latStopTestUI() {
  latStopTest();
  latUpdateButtonStates();
  if (typeof updateTabLockState === "function") updateTabLockState();
}

document.addEventListener("DOMContentLoaded", function () {
  latEls = {
    slider:        document.getElementById("latSlider"),
    valueText:     document.getElementById("latValueText"),
    intervalHint:  document.getElementById("latIntervalHint"),
    intervalBtns:  Array.from(document.querySelectorAll(".lat-interval-btn")),
    clickBtns:     Array.from(document.querySelectorAll(".lat-click-btn")),
    altCheckbox:   document.getElementById("latAltCheckbox"),
    startBtn:      document.getElementById("latStartBtn"),
    stopBtn:       document.getElementById("latStopBtn"),
    lockedHint:    document.getElementById("latLockedHint"),
  };
  if (!latEls.slider) return; // HTML noch nicht da

  latEls.slider.addEventListener("input", function (e) {
    latSliderInput(e.target.value);
  });
  // Tastatur (Pfeile mit Modifiern). Wir überschreiben das Default-
  // Verhalten von <input type=range>, damit Schrittgrößen exakt
  // 1 / 0,1 / 10 ms sind.
  latEls.slider.addEventListener("keydown", latKeyHandler);

  for (const b of latEls.intervalBtns) {
    b.addEventListener("click", function () {
      latIntervalMs = parseInt(b.dataset.ms, 10);
      latUpdateButtonStates();
      latUpdateIntervalHint();
      latRestartIfActive();
    });
  }
  for (const b of latEls.clickBtns) {
    b.addEventListener("click", function () {
      latClickType = b.dataset.type;
      latUpdateButtonStates();
      latRestartIfActive();
    });
  }
  if (latEls.altCheckbox) {
    latEls.altCheckbox.addEventListener("change", function () {
      latAltMode = latEls.altCheckbox.checked;
      latRestartIfActive();
    });
  }
  if (latEls.startBtn) latEls.startBtn.addEventListener("click", latStartTestUI);
  if (latEls.stopBtn)  latEls.stopBtn.addEventListener("click",  latStopTestUI);

  // Initial-Update
  latSliderInput(0);
  latUpdateButtonStates();
  latUpdateIntervalHint();
});
```

## Schritt 3 — Tab-Lock-Integration in `tabs-eq.js`

In `tabs-eq.js`, **Funktion `switchTab`** (etwa Z. 34):

Vorher (etwa Z. 36–41):
```js
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
```

Nachher:
```js
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning)
    || (typeof latActive !== "undefined" && latActive);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
```

In derselben Datei, **Funktion `updateTabLockState`** (etwa Z. 78):

Vorher (etwa Z. 79–85):
```js
function updateTabLockState() {
  const locked = testAct || (typeof lrRunning !== "undefined" && lrRunning)
                          || (typeof fmRunning !== "undefined" && fmRunning);
  var activeTestId = null;
  if (testAct) activeTestId = 'test';
  else if (typeof lrRunning !== "undefined" && lrRunning) activeTestId = 'balance';
  else if (typeof fmRunning !== "undefined" && fmRunning) activeTestId = 'freqmatch';
  lockTestTabs(locked, activeTestId);
```

Nachher:
```js
function updateTabLockState() {
  const locked = testAct || (typeof lrRunning !== "undefined" && lrRunning)
                          || (typeof fmRunning !== "undefined" && fmRunning)
                          || (typeof latActive !== "undefined" && latActive);
  var activeTestId = null;
  if (testAct) activeTestId = 'test';
  else if (typeof lrRunning !== "undefined" && lrRunning) activeTestId = 'balance';
  else if (typeof fmRunning !== "undefined" && fmRunning) activeTestId = 'freqmatch';
  else if (typeof latActive !== "undefined" && latActive) activeTestId = 'latenz';
  lockTestTabs(locked, activeTestId);
```

Im selben Block (etwa Z. 93–95 nachher), nach dem `if (typeof fmEls
...)`-Block, einen analogen `if`-Block für `latEls` anhängen:

```js
  if (typeof latEls !== "undefined" && latEls && latEls.lockedHint) {
    latEls.lockedHint.hidden = !(typeof latActive !== "undefined" && latActive);
  }
```

## Schritt 4 — Sub-Tab-Wechsel-Handling

In `tabs-eq.js`, **Funktion `switchSubtab`** (etwa Z. 4), keine
Änderung nötig — der Sub-Tab-Wechsel funktioniert generisch über
data-attributes. Beim Wechsel weg vom Latenz-Sub-Tab während eines
laufenden Tests muß der Test allerdings gestoppt werden.

Im Block ab etwa Z. 14, **nach** den bestehenden if-Blöcken für
`ergebnisse` und vor dem schließenden `}` der Funktion, einfügen:

```js
  // Sub-Tab-Wechsel weg vom Latenz-Tab: Test stoppen
  if (parent === "messungen" && subtab !== "latenz") {
    if (typeof latActive !== "undefined" && latActive
        && typeof latStopTest === "function") {
      latStopTest();
      if (typeof latUpdateButtonStates === "function") latUpdateButtonStates();
      if (typeof updateTabLockState === "function") updateTabLockState();
    }
  }
```

Wichtig: Sonnet, dieser Block muß **innerhalb** der
`switchSubtab`-Funktion stehen, **vor** dem schließenden `}` der
Funktion. Such die Funktion mit:

```bash
grep -n "^function switchSubtab" tabs-eq.js
```

und füge den Block direkt vor dem ersten `}` auf derselben
Einrückungstiefe ein.

## Akzeptanztest

Vorbereitung: Browser neu laden. Kabel-Kopfhörer aufsetzen, mittlere
Lautstärke.

### 1. Sub-Tab erscheint
Tab „Messungen" anklicken.
- Erwartet: vierter Sub-Tab-Button „Latenz" rechts neben
  „Frequenzabgleich".
- Anklicken → Sub-Panel öffnet sich.
- Im Sub-Panel sichtbar: gelbe BT-Warn-Box, Schieber, zwei
  Buttonreihen, Abwechseln-Checkbox, Start/Stop-Buttons.

### 2. Schieber mit Maus
Schieber mit Maus bewegen.
- Erwartet: Text unter dem Schieber ändert sich live, z.B.
  „+12,3 ms — linke Seite war 12,3 ms schneller. Wird ausgeglichen."

### 3. Schieber mit Tastatur
Schieber durch Klicken fokussieren.
- ←/→ → 1-ms-Schritte.
- Shift+←/→ → 0,1-ms-Schritte.
- Strg+←/→ → 10-ms-Schritte.
- Erwartet: Anzeige unter Schieber folgt sofort.

### 4. Test starten, hörbarer Effekt
„▶ Test starten" klicken.
- Erwartet: Klicks gleichmäßig in beiden Kopfhörern, Schieber
  noch bei 0 ms.
- Start-Button ausgegraut, Stop-Button aktiv.
- Locked-Hint erscheint.

Schieber auf +20 ms ziehen.
- Erwartet: deutlich hörbar, daß linke Klicks später kommen.

Schieber auf −20 ms.
- Erwartet: rechte Klicks später.

### 5. Tab-Lock
Während Test läuft: Haupt-Tab „Player" anklicken.
- Erwartet: keine Reaktion. Bleibt auf „Messungen / Latenz".

Sub-Tab „Frequenzabgleich" anklicken.
- Erwartet: wechselt zum Frequenzabgleich, der Latenz-Test wird
  gestoppt. Stop-Button und Locked-Hint zeigen jetzt korrekt
  inactive an, wenn man zurück zum Latenz-Tab geht.

### 6. Klick-Intervall ändern
Latenz-Tab zurück, Test wieder starten (100 ms voreingestellt).
„30 ms"-Button klicken.
- Erwartet: schnellere Klickfolge. Intervall-Hinweis zeigt:
  „Eindeutiger Bereich: ±15 ms (bei mehr Versatz wird die
  Richtung mehrdeutig)".

„500 ms"-Button klicken.
- Erwartet: langsame Klickfolge. Hinweis: „Eindeutiger Bereich:
  ±250 ms" — der mehrdeutig-Zusatz fehlt (weil 250 > 50).

### 7. Klangtyp ändern
„Tieftöner 500 Hz"-Button klicken.
- Erwartet: Tieffrequenter Burst statt Klick, Tempo unverändert.

„Hochton 4 kHz".
- Erwartet: hochfrequenter Burst.

„Klick (breitband)".
- Erwartet: wieder breitbandiger Klick.

### 8. Abwechseln-Modus
Checkbox „Klickfolge und Einzelklick abwechselnd" anhaken.
- Erwartet: 3 Sekunden lang Klickfolge, dann Stille, dann ein
  einzelner Klick, dann wieder Stille, wiederholt.

Wieder abhaken.
- Erwartet: nur Klickfolge.

### 9. Stop-Button
„■ Stop" klicken.
- Erwartet: Klicks aus. Start-Button wieder aktiv. Locked-Hint
  weg. Tab-Wechsel wieder möglich.

### 10. Player-Wirkung außerhalb des Tests
Test stoppen. Hauptmenü-Tab „Player" wechseln. Musik laden, Play.
- Erwartet: Musik kommt synchron, weil `plApplyLatency` zwar
  aktiv ist, aber `latencyResult` noch null (kommt erst in
  Bauanleitung 27).

Konsole:
```js
latencyResult = { valueMs: 15, clickType: "click", intervalMs: 100 };
latApplyToPlayer();
```
- Erwartet: Musik kommt links 15 ms später.

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der 10 Akzeptanz-Schritte oben
einzeln durchgehen und für jeden melden:

- **erfüllt** + Datei:Zeile der relevanten Code-Stelle
- **nicht erfüllt** + warum + was du versucht hast
- **unklar** + welche Information dir fehlt

Insbesondere kritisch prüfen:
- Schritt 1: HTML-Block korrekt eingefügt, Sub-Tab erscheint
  visuell und ist klickbar.
- Schritt 3: Tastatur-Modifier funktionieren (Shift/Ctrl) und
  überschreiben das Browser-Default des Range-Inputs.
- Schritt 5: Tab-Lock greift, aber Sub-Tab-Wechsel **innerhalb**
  „Messungen" stoppt den Test korrekt (nicht doppelt-locken).
- Schritt 9: Stop-Button setzt alle UI-Zustände zurück, kein
  „hängender" Locked-Hint.

Falls Schritt 3 versagt (Browser-Default überschreibt deinen
Handler): prüfe, ob `ev.preventDefault()` wirklich gerufen wird
und ob der Range-Input fokussiert ist (sonst greift dein Handler
nicht).

## Nicht zu tun

- Keine Persistenz, kein Save/Load. Wert geht bei Reload verloren.
- Keine i18n-Keys (`data-t`). Texte bleiben hartkodiert deutsch.
  → kommt in Bauanleitung 27.
- Keine Anzeige im Ergebnis-Tab.
- Kein Druck-Support.
- CODESTRUKTUR.md und SPEC.md nicht aktualisieren — kommt mit 27.
- Keine Änderungen in `player.js`, `latency.js`-Engine-Code aus
  Bauanleitung 25 oder anderen Modulen.

## Zusammenfassung der Datei-Änderungen

| Datei | Änderung |
|---|---|
| `index.html` | Sub-Tab-Button (Schritt 1a), Subpanel-Block (Schritt 1b) |
| `latency.js` | UI-Bindings-Block am Ende anhängen (Schritt 2) |
| `tabs-eq.js` | `switchTab` Guard erweitern, `updateTabLockState` erweitern, `switchSubtab` Stop-Block (Schritte 3 + 4) |
