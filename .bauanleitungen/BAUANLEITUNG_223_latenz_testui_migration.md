# BAUANLEITUNG 223 — Latenz-Test auf testUI-API migrieren

## Ziel

Der Sub-Reiter „Latenz" (`subpanel-messungen-latenz`) wird vom heutigen
statischen HTML auf `buildTestPanel(parentEl, cfg)` umgestellt — analog
zu freqmatch (BA 108) und passend zu Migrationsschritt 5 in
`docs/spec/00-testui-architektur.md`. Dazu kommt eine kleine
**API-Erweiterung** der testUI: `header.startStop.stopKey` als
Override für die Stop-Button-Beschriftung; in `freqmatch.js` ziehen die
beiden Verfahren diesen neuen Schlüssel mit, statt sich auf den
Default zu verlassen.

Verhaltensänderung (klar abgestimmt):

- **„Offset bestätigen"** (`applyButton`) speichert den aktuellen
  Schieberwert als `latencyResult` und beendet den Test sofort danach.
- **„Test abbrechen"** (Stop-Button mit `stopKey: 'btnCancelTest'`)
  beendet den Test, **ohne** den Wert zu speichern. Das ist neu —
  heute speichert Stop automatisch.

Audio-Pipeline:

- `DelayNode`-Puffer wird von 0,25 s auf **2,0 s** vergrößert, damit
  der Auto-Extend-Slider praktisch unbegrenzt arbeiten kann
  (`initialRange: 50, maxRange: 2000`).
- Der heutige Mix-In der Balance-Gains in `latStartTest` bleibt; ein
  **eigener Lautstärkeregler** (`header.common.volume`) wird **zusätzlich**
  multipliziert (Gesamt-Faktor = Volume × Balance pro Seite).

Vortest-Hinweise (low-level, kein Showstopper):

- Zwei `kind: 'warn'`-Paragraphen im Erklärblock — einer für
  „Stereo-Balance noch nicht gemessen", einer für „Elektrodenlautstärke
  noch nicht gemessen". Sichtbarkeit wird beim Öffnen des Sub-Tabs
  über `testUI.explain.setVisible` umgeschaltet.

Seitenhörtest:

- Beim Start fragt `testUI.sideCheck.run({sides:'both'})` ab, ob beide
  Seiten hörbar sind. Analog freqmatch-Slider.

## Versionsbump

Am Ende der Bauanleitung (nicht am Anfang — sonst stört der Bump bei
einem Abbruch nichts):

In `js/version.js`:

```js
const APP_VERSION = "3.2.223-beta";
```

## i18n

Alle neuen Strings sind unterhalb der Schwelle (alle < 3 Sätze und
< 30 Wörter pro String). **en/fr/es kommen direkt mit**, keine Folge-BA.

---

## Schritt 1 — testUI-API erweitern (`js/test-ui.js`)

### 1.1 Stop-Button-Beschriftung konfigurierbar machen

**Datei:** `js/test-ui.js`, im neuen Builder `_buildTestPanelNew`,
Block `// --- startStop ---` (heute ca. Zeile 1074–1084).

**Suchen:**

```js
  var stopBtn = _mkEl('button', 'btn btn-large');
  stopBtn.dataset.action = 'stop';
  _tEl(stopBtn, 'btnStopTest');
  stopBtn.disabled = true;
```

**Ersetzen durch:**

```js
  var stopBtn = _mkEl('button', 'btn btn-large');
  stopBtn.dataset.action = 'stop';
  _tEl(stopBtn, cfg.header.startStop.stopKey || 'btnStopTest');
  stopBtn.disabled = true;
```

### 1.2 Enter-Taste auch für `applyButton` (zusätzlich zu `confirmButton`)

Latenz nutzt `applyButton` statt `confirmButton`; Enter soll dort
genauso „Wert bestätigen" auslösen. Heute (ca. Zeile 1813–1820):

**Suchen:**

```js
      // Enter : confirmButton / onConfirm
      if (e.key === 'Enter') {
        if (body.confirmButton && vCfg2.hooks && vCfg2.hooks.onConfirm) {
          e.preventDefault();
          vCfg2.hooks.onConfirm();
        }
        return;
      }
```

**Ersetzen durch:**

```js
      // Enter : confirmButton.onConfirm ODER applyButton.onApply
      if (e.key === 'Enter') {
        if (body.confirmButton && vCfg2.hooks && vCfg2.hooks.onConfirm) {
          e.preventDefault();
          vCfg2.hooks.onConfirm();
        } else if (body.applyButton && vCfg2.hooks && vCfg2.hooks.onApply) {
          e.preventDefault();
          vCfg2.hooks.onApply();
        }
        return;
      }
```

### 1.3 Keine weiteren Änderungen an `test-ui.js`

Der `applyButton`-Baustein existiert bereits (`refs.applyButton`,
Hook `onApply`); der Wechsel des Stop-Button-Labels ist die einzige
inhaltliche Erweiterung. **Keine** weiteren Overrides oder Sonder-
Properties einbauen.

---

## Schritt 2 — `freqmatch.js`: `stopKey` setzen

**Datei:** `js/freqmatch.js`, im `fmCfg`-Objekt, Block
`header.startStop` (heute ca. Zeile 1137):

**Suchen:**

```js
      startStop: { startKey: 'fmLblStart', resumable: true }
```

**Ersetzen durch:**

```js
      startStop: { startKey: 'fmLblStart', stopKey: 'btnPauseTest', resumable: true }
```

Das gilt für beide Verfahren (slider und adaptive); der Header ist
gemeinsam.

---

## Schritt 3 — Latenz-Modul komplett umbauen (`js/latency.js`)

Die Datei wird stark umgebaut. Reihenfolge der Änderungen:

### 3.1 `latInitGraph` — DelayNode-Puffer auf 2,0 s

**Suchen:**

```js
  pLatDelayL   = ctx.createDelay(0.25); // 250 ms Puffer für ±200 ms Schieberbereich
  pLatDelayR   = ctx.createDelay(0.25);
```

**Ersetzen durch:**

```js
  pLatDelayL   = ctx.createDelay(2.0); // 2 s Puffer für Schieberbereich bis ±2000 ms
  pLatDelayR   = ctx.createDelay(2.0);
```

### 3.2 `latStartTest` — eigene Lautstärke einrechnen

In `latStartTest`, im Block, wo die Balance-Gains gesetzt werden,
zusätzlich den Volume-Wert aus dem testUI-Header-Volume-Input
multiplikativ anwenden:

**Suchen:**

```js
  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  latBalSplitter = ctx.createChannelSplitter(2);
  latBalMerger   = ctx.createChannelMerger(2);
  latBalGainL    = ctx.createGain();
  latBalGainR    = ctx.createGain();
  latBalGainL.gain.value = dB2G(balG.left);
  latBalGainR.gain.value = dB2G(balG.right);
```

**Ersetzen durch:**

```js
  const balG = (typeof getRawBalanceGains === "function")
    ? getRawBalanceGains() : { left: 0, right: 0 };
  const volFactor = _latGetVolumeFactor();   // 0..1, Default 0.5 (=50%)
  latBalSplitter = ctx.createChannelSplitter(2);
  latBalMerger   = ctx.createChannelMerger(2);
  latBalGainL    = ctx.createGain();
  latBalGainR    = ctx.createGain();
  latBalGainL.gain.value = dB2G(balG.left)  * volFactor;
  latBalGainR.gain.value = dB2G(balG.right) * volFactor;
```

`_latGetVolumeFactor` ist ein neuer kleiner Helfer (siehe 3.6).

### 3.3 Alte UI-Bindings entfernen

Der gesamte Block ab dem Kommentar
`// UI-Bindings (Bauanleitung 26)` bis einschließlich dem Ergebnis-Tab-
Block wird **gelöscht**. Konkret entfallen:

- `latEls`-Variable und ihre Befüllung in `DOMContentLoaded`
- `latUpdateValueText`, `latUpdateIntervalHint`, `latUpdateButtonStates`
- `latSliderInput`, `latKeyHandler`
- `latStartTestUI`, `latStopTestUI`, `latApplyAsResult`
- Der gesamte `DOMContentLoaded`-Handler (wird komplett neu gebaut, siehe 3.6)
- Der globale `keydown`-Listener (kommt jetzt aus testUI)

Was bleibt: `latencyResult`, `plApplyLatency`, `latSliderMs`,
`latActive`, `latClickType`, `latIntervalMs`, alle Buffer-Generatoren,
`latStartTest`, `latStopTest`, `latRestartIfActive`, `latSetSliderMs`,
`latApplyToPlayer`, sowie der Ergebnis-Tab-Render (`latRenderResults`,
`latResEls`).

### 3.4 Ergebnis-Tab-Render bleibt unverändert

Der Block ab `// Ergebnis-Tab (Bauanleitung 27)` bleibt **wie er ist**.
Er befüllt `subpanel-ergebnisse-latenz` und ist von der Migration nicht
betroffen.

### 3.5 Eigene Variable für volume-Default

Oben in der Datei (bei den anderen Modul-Variablen) hinzufügen:

```js
let latEls = null;          // panel-refs aus buildTestPanel
let latVolume = 50;         // 0..100, eigener Lautstärkewert (Test-lokal)
```

(`latEls` wird neu vergeben, nicht mehr das alte Element-Refs-Objekt.
Der Name kollidiert nicht mit anderen Modulen.)

### 3.6 Neuer `DOMContentLoaded`-Handler und Hook-Funktionen

Am Ende der Datei (nach dem Ergebnis-Tab-Block):

```js
// =====================================================================
// Test-UI Migration (BA 223)
// =====================================================================

function _latGetVolumeFactor() {
  // 0..1, fallback 0.5
  const v = (latEls && latEls.header && latEls.header.volInput)
    ? parseFloat(latEls.header.volInput.value) : latVolume;
  if (!isFinite(v)) return 0.5;
  return Math.max(0, Math.min(100, v)) / 100;
}

function _latBuildExtraFragment() {
  // Zwei Button-Reihen: Klick-Intervall und Klangtyp.
  const frag = document.createElement('div');
  frag.className = 'lat-extra';

  // Klick-Intervall
  const intvWrap = document.createElement('div');
  intvWrap.style.margin = '12px 0';
  const intvLbl = document.createElement('div');
  intvLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  intvLbl.dataset.t = 'latIntervalLabel';
  const intvRow = document.createElement('div');
  intvRow.className = 'btn-row';
  intvRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [100, 200, 500, 1000, 2000].forEach(function(ms) {
    const b = document.createElement('button');
    b.className = 'btn lat-interval-btn' + (ms === latIntervalMs ? ' active' : '');
    b.dataset.ms = String(ms);
    b.textContent = ms + ' ms';
    b.addEventListener('click', function() {
      latIntervalMs = ms;
      _latRefreshExtraActives();
      _latUpdateIntervalHint();
      latRestartIfActive();
    });
    intvRow.appendChild(b);
  });
  const intvHint = document.createElement('div');
  intvHint.id = 'latIntervalHint';
  intvHint.style.cssText = 'font-size:0.85em;color:var(--text-muted);margin-top:4px;';
  intvWrap.append(intvLbl, intvRow, intvHint);

  // Klangtyp
  const typeWrap = document.createElement('div');
  typeWrap.style.margin = '12px 0';
  const typeLbl = document.createElement('div');
  typeLbl.style.cssText = 'font-weight:600;margin-bottom:6px;';
  typeLbl.dataset.t = 'latTypeLabel';
  const typeRow = document.createElement('div');
  typeRow.className = 'btn-row';
  typeRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  [
    ['click',     'latTypeClick'],
    ['burst500',  'latTypeBurst500'],
    ['burst1500', 'latTypeBurst1500'],
    ['burst4000', 'latTypeBurst4000']
  ].forEach(function(pair) {
    const b = document.createElement('button');
    b.className = 'btn lat-click-btn' + (pair[0] === latClickType ? ' active' : '');
    b.dataset.type = pair[0];
    b.dataset.t = pair[1];
    b.addEventListener('click', function() {
      latClickType = pair[0];
      _latRefreshExtraActives();
      latRestartIfActive();
    });
    typeRow.appendChild(b);
  });
  typeWrap.append(typeLbl, typeRow);

  frag.append(intvWrap, typeWrap);
  return frag;
}

function _latRefreshExtraActives() {
  if (!latEls || !latEls.header || !latEls.header.extraFragment) return;
  const frag = latEls.header.extraFragment;
  frag.querySelectorAll('.lat-interval-btn').forEach(function(b) {
    b.classList.toggle('active', parseInt(b.dataset.ms, 10) === latIntervalMs);
  });
  frag.querySelectorAll('.lat-click-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.type === latClickType);
  });
}

function _latUpdateIntervalHint() {
  if (!latEls || !latEls.header || !latEls.header.extraFragment) return;
  const hint = latEls.header.extraFragment.querySelector('#latIntervalHint');
  if (!hint) return;
  const unique = latIntervalMs / 2;
  let s = (t("latUniqueRange") || "Eindeutiger Bereich:") + " ±" + unique + " ms";
  if (unique < 200) s += " " + (t("latUniqueRangeAmbig") || "");
  hint.textContent = s;
}

function _latHasBalance() {
  // Pragmatische Detektion: mindestens ein gemessener Balance-Wert
  // existiert in lrResults ODER in sideData[*].bRes.
  if (typeof lrResults === 'object' && lrResults
      && Object.values(lrResults).some(function(v) { return isFinite(v); })) return true;
  if (typeof sideData === 'object' && sideData) {
    for (const side of ['left', 'right']) {
      const sd = sideData[side];
      if (sd && Array.isArray(sd.bRes) && sd.bRes.length > 0) return true;
    }
  }
  return false;
}

function _latHasLoudness() {
  // Pragmatische Detektion: mindestens eine Seite hat von Default
  // abweichende manualLevels ODER nicht-leere jRes.
  if (typeof sideData !== 'object' || !sideData) return false;
  for (const side of ['left', 'right']) {
    const sd = sideData[side];
    if (!sd) continue;
    if (Array.isArray(sd.manualLevels) && sd.manualLevels.some(function(v) { return isFinite(v) && v !== 0; })) return true;
    if (Array.isArray(sd.jRes) && sd.jRes.length > 0) return true;
  }
  return false;
}

function _latRefreshPrereqHints() {
  if (!latEls) return;
  testUI.explain.setVisible(latEls, 'latVortestBalanceMissing',  !_latHasBalance());
  testUI.explain.setVisible(latEls, 'latVortestLoudnessMissing', !_latHasLoudness());
}

// --- Hook-Implementierungen ---

function latHookOnStart() {
  // Seitenhörtest vor Start (analog freqmatch slider).
  testUI.sideCheck.run(
    { sides: 'both' },
    function() {
      // Startwert: vorhandenes Ergebnis oder 0
      const startMs = (latencyResult && isFinite(latencyResult.valueMs))
        ? latencyResult.valueMs : 0;
      const slRef = latEls.verfahren.lat.slider;
      if (slRef) testUI.slider.setValue(slRef, startMs);
      latSetSliderMs(startMs);
      _latUpdateIntervalHint();
      latStartTest();
    },
    function() {
      // Abbruch im sideCheck → testUI stoppt; wir räumen nur unsere Resourcen.
      if (latEls && latEls._stopTest) latEls._stopTest();
    }
  );
}

function latHookOnStop() {
  // = "Test abbrechen": Audio-Loop stoppen, KEIN Speichern.
  latStopTest();
  latApplyToPlayer();   // setzt Delays auf gespeicherten Wert (falls vorhanden)
}

function latHookOnSlide(ms) {
  latSetSliderMs(ms);
}

function latHookOnApply() {
  // = "Offset bestätigen": aktuellen Schieberwert speichern + Test beenden.
  latencyResult = {
    valueMs:    latSliderMs,
    clickType:  latClickType,
    intervalMs: latIntervalMs,
    timestamp:  Date.now(),
    implantSnapshot: (typeof implantSnapshot === 'function') ? implantSnapshot() : null
  };
  latApplyToPlayer();
  if (typeof latRenderResults === 'function') latRenderResults();
  if (typeof depLockApply === 'function') depLockApply();
  // Test sauber beenden
  if (latEls && latEls._stopTest) latEls._stopTest();
}

// --- DOMContentLoaded: testUI-Panel bauen ---

document.addEventListener("DOMContentLoaded", function() {
  const parentEl = document.getElementById("subpanel-messungen-latenz");
  if (!parentEl) return;

  const cfg = {
    id: 'latenz',
    explain: {
      titleKey: 'latMeasTitle',
      preserveOrder: false,        // Default-Sortierung (Stufen oben, Plain unten)
      paragraphs: [
        { key: 'latMaturityHint',           kind: 'info'    },
        { key: 'latBTWarning',              kind: 'caution' },
        { key: 'latVortestBalanceMissing',  kind: 'warn',  id: 'latVortestBalanceMissing',  hidden: true },
        { key: 'latVortestLoudnessMissing', kind: 'warn',  id: 'latVortestLoudnessMissing', hidden: true },
        { key: 'latPrereqHint',             kind: 'warn'    },
        { key: 'latMeasIntro2',             kind: 'plain'   },
        { key: 'latMeasIntro',              kind: 'plain'   },
        { key: 'latLocHint',                kind: 'plain'   }
      ]
    },
    header: {
      common: {
        refSelect:    false,
        volume:       { show: true },
        duration:     false,
        pause:        false,
        toneType:     false,
        sequence:     false,
        sliderTarget: false
      },
      extra:    { fragment: _latBuildExtraFragment() },
      startStop:{ startKey: 'latStartBtn', stopKey: 'btnCancelTest', resumable: false }
    },
    verfahren: [{
      id: 'lat',
      labelKey:   'latVerfahrenLabel',     // wird bei verfahren.length === 1 nicht angezeigt
      explainKey: null,
      body: {
        instruction:  { key: 'latInstruction' },
        keyHint:      { unitKey: 'sliderHintMs' },
        slider:       { unit: 'ms', initialRange: 50, maxRange: 2000, touchStep: 5, touchFineStep: 1 },
        sliderValue:  { show: true },
        applyButton:  { key: 'btnConfirmOffset' }
      },
      hooks: {
        onStart:  latHookOnStart,
        onStop:   latHookOnStop,
        onSlide:  latHookOnSlide,
        onApply:  latHookOnApply
      }
    }]
  };

  latEls = buildTestPanel(parentEl, cfg);

  // Volume-Default setzen
  if (latEls.header && latEls.header.volInput) {
    latEls.header.volInput.value = String(latVolume);
    latEls.header.volInput.addEventListener('change', function() {
      latVolume = parseFloat(latEls.header.volInput.value) || 50;
      // Wenn der Test läuft: Gains live nachziehen
      if (latActive && latBalGainL && latBalGainR) {
        const balG = (typeof getRawBalanceGains === "function")
          ? getRawBalanceGains() : { left: 0, right: 0 };
        const f = _latGetVolumeFactor();
        latBalGainL.gain.value = dB2G(balG.left)  * f;
        latBalGainR.gain.value = dB2G(balG.right) * f;
      }
    });
  }

  // Initial-Setup
  _latUpdateIntervalHint();
  _latRefreshPrereqHints();

  // Vortest-Hinweise jedes Mal beim Öffnen des Sub-Tabs aktualisieren
  document.addEventListener('subtab-shown', function(e) {
    if (e && e.detail && e.detail.subtab === 'latenz'
        && e.detail.parent === 'messungen') {
      _latRefreshPrereqHints();
    }
  });

  // Falls kein subtab-shown-Event existiert: Tab-Button-Klick als Fallback
  const tabBtn = document.getElementById('latSubtabBtn');
  if (tabBtn) {
    tabBtn.addEventListener('click', function() { setTimeout(_latRefreshPrereqHints, 0); });
  }

  // Sprachwechsel: Intervall-Hint neu rendern
  document.addEventListener('lang-changed', _latUpdateIntervalHint);
});
```

**Hinweis an Sonnet zur Detektion in `_latHasBalance`/`_latHasLoudness`:**
das sind pragmatische Best-Effort-Checks. Wenn dir beim Lesen des Codes
eine offensichtlich bessere Detektion auffällt (z. B. weil `lrResults`
beim Side-Switch geleert wird und du den persistenten Wert woanders
findest), darfst du den Helfer entsprechend justieren — aber **frag
nach**, statt eine substanziell andere Semantik still einzubauen.

**Hinweis zu `subtab-shown` / `lang-changed`:** wenn die Events nicht
existieren, ist der Code harmlos — der Listener wird nur nicht feuern.
Der Fallback über den Tab-Button-Klick fängt das wichtigste Szenario
(„User wechselt nach Latenz") trotzdem ab.

---

## Schritt 4 — `index.html` entrümpeln

Im Block `<!-- ===== LATENZ ===== -->` (heute Zeile 570–648) den
**gesamten Inhalt von `subpanel-messungen-latenz`** entfernen, außer
dem `snapHint_lat`-DIV (BA 156).

**Vorher:**

```html
<div id="subpanel-messungen-latenz" class="subpanel">
  <div id="snapHint_lat"></div><!-- BA 156 -->
  <div class="card">
    <h2 data-t="latMeasTitle">Latenz-Messung</h2>
    ... (viele Zeilen) ...
    <div id="latLockedHint" class="info-box tab-locked-hint" hidden
         style="margin-top:16px;" data-t="latLockedHint">
      Test läuft. Stoppe den Test, um die Tabs zu wechseln.
    </div>
  </div>
</div>
```

**Nachher:**

```html
<div id="subpanel-messungen-latenz" class="subpanel">
  <div id="snapHint_lat"></div><!-- BA 156 -->
  <!-- Inhalt wird von latency.js / test-ui.js erzeugt -->
</div>
```

---

## Schritt 5 — i18n-Strings (de/en/fr/es)

### 5.1 Neue Schlüssel

In **allen vier** Dateien (`i18n/de.js`, `i18n/en.js`, `i18n/fr.js`,
`i18n/es.js`) anhängen — innerhalb des großen Wörterbuch-Literals,
am Ende vor der schließenden Klammer.

**`i18n/de.js`** — am Ende des Objekts (vor der schließenden `};` der
großen Map) ergänzen:

```js
    // BA 223 — Latenz-Migration auf testUI-API
    btnEndTest:    "■ Test beenden",
    btnPauseTest:  "■ Test pausieren",
    btnCancelTest: "■ Test abbrechen",
    latInstruction: "Schiebe den Schieber, bis die Klicks links und rechts gleichzeitig erscheinen.",
    sliderHintMs:   "1 ms",
    latVerfahrenLabel: "Latenz",
    latVortestBalanceMissing:  "Hinweis: Vortest „Stereo-Balance" wurde noch nicht durchgeführt. Die Messung läuft trotzdem, ist aber genauer, wenn die Balance vorab gleichgezogen ist.",
    latVortestLoudnessMissing: "Hinweis: Vortest „Elektrodenlautstärke" wurde noch nicht durchgeführt. Die Messung läuft trotzdem, ist aber genauer, wenn die Lautstärke vorab eingestellt ist.",
```

**`i18n/en.js`**:

```js
    // BA 223 — Latency test migration
    btnEndTest:    "■ End test",
    btnPauseTest:  "■ Pause test",
    btnCancelTest: "■ Cancel test",
    latInstruction: "Move the slider until the clicks on the left and right appear at the same time.",
    sliderHintMs:   "1 ms",
    latVerfahrenLabel: "Latency",
    latVortestBalanceMissing:  "Note: pre-test \"Stereo balance\" has not been carried out yet. The measurement still works, but is more accurate if the balance has been levelled beforehand.",
    latVortestLoudnessMissing: "Note: pre-test \"Electrode loudness\" has not been carried out yet. The measurement still works, but is more accurate if loudness has been set beforehand.",
```

**`i18n/fr.js`**:

```js
    // BA 223 — Migration test de latence
    btnEndTest:    "■ Terminer le test",
    btnPauseTest:  "■ Mettre en pause",
    btnCancelTest: "■ Annuler le test",
    latInstruction: "Déplacez le curseur jusqu'à ce que les clics à gauche et à droite apparaissent en même temps.",
    sliderHintMs:   "1 ms",
    latVerfahrenLabel: "Latence",
    latVortestBalanceMissing:  "Remarque : le pré-test « Balance stéréo » n'a pas encore été effectué. La mesure fonctionne quand même, mais elle est plus précise si la balance a été ajustée auparavant.",
    latVortestLoudnessMissing: "Remarque : le pré-test « Volume des électrodes » n'a pas encore été effectué. La mesure fonctionne quand même, mais elle est plus précise si le volume a été réglé auparavant.",
```

**`i18n/es.js`**:

```js
    // BA 223 — Migración del test de latencia
    btnEndTest:    "■ Finalizar prueba",
    btnPauseTest:  "■ Pausar prueba",
    btnCancelTest: "■ Cancelar prueba",
    latInstruction: "Mueve el deslizador hasta que los clics de la izquierda y la derecha aparezcan al mismo tiempo.",
    sliderHintMs:   "1 ms",
    latVerfahrenLabel: "Latencia",
    latVortestBalanceMissing:  "Aviso: la prueba previa «Balance estéreo» aún no se ha realizado. La medición funciona igualmente, pero es más precisa si el balance se ha igualado antes.",
    latVortestLoudnessMissing: "Aviso: la prueba previa «Volumen de electrodos» aún no se ha realizado. La medición funciona igualmente, pero es más precisa si el volumen se ha ajustado antes.",
```

### 5.2 Vorhandene Strings stehen lassen

Folgende Keys bleiben unverändert in Verwendung (sie werden vom neuen
Code referenziert, nicht mehr vom alten HTML):

- `latMeasTitle`, `latMaturityHint`, `latBTWarning`, `latPrereqHint`,
  `latMeasIntro`, `latMeasIntro2`, `latLocHint`
- `latIntervalLabel`, `latTypeLabel`, `latUniqueRange`,
  `latUniqueRangeAmbig`, `latStartBtn`
- `latTypeClick`, `latTypeBurst500`, `latTypeBurst1500`, `latTypeBurst4000`
- `latResNoOffset`, `latResLeftFaster`, `latResRightFaster`,
  `latResMeasuredWith`, `latResInterval`, `latClearConfirm`,
  `btnConfirmOffset`

Folgende Keys werden vom neuen Code **nicht mehr** referenziert (nicht
löschen — andere Bereiche könnten sie noch nutzen, der Cleanup
gehört in BA 6 „Aufräumen" laut SPEC):

- `latStopBtn`, `latSliderMinusLabel`, `latSliderZeroLabel`,
  `latSliderPlusLabel`, `latLockedHint`

Diese stehen lassen.

---

## Schritt 6 — SPEC-Dokumentation aktualisieren

### 6.1 `docs/spec/00-testui-architektur.md`

**a)** Im Bausteine-Katalog (Tabelle), Zeile zu `slider`-Baustein
unverändert lassen.

**b)** Header-Aufteilung-Abschnitt: bei `header.startStop` den
neuen Schlüssel `stopKey` ergänzen. Suchen:

```
**`header.startStop`** ist immer vorhanden. Der Start-Button-Text
ist konfigurierbar (`startKey`); der Stop-Button-Text und das
Lock-Hint-Verhalten richten sich nach `resumable`.
```

Ersetzen durch:

```
**`header.startStop`** ist immer vorhanden. Der Start-Button-Text
ist über `startKey` konfigurierbar; der Stop-Button-Text über
`stopKey` (Default `btnStopTest`, sinnvolle Alternativen
`btnEndTest`, `btnPauseTest`, `btnCancelTest`). Das Lock-Hint-Verhalten
richtet sich nach `resumable`.
```

**c)** Migrationsplan-Schritt 5 als „gebaut (BA 223)" markieren.
Suchen:

```
**Schritt 5 — Latenz unter das Schema bringen** *(Bauanleitung)*

- `latency.js` und `subpanel-messungen-latenz` umbauen; ...
```

Ersetzen durch:

```
**Schritt 5 — Latenz unter das Schema bringen** *(Bauanleitung)* ✅ gebaut (BA 223)

- `latency.js` auf testUI-API umgestellt; `subpanel-messungen-latenz`
  in `index.html` auf leeren Container reduziert (nur `snapHint_lat`
  bleibt). DelayNode-Puffer von 0,25 s auf 2,0 s vergrößert.
- Klicktyp und Intervall in `header.extra.fragment` (Button-Reihen).
- Bluetooth-Warnung als `kind: 'caution'`, Vortest-Empfehlungen als
  `kind: 'warn'` (Sichtbarkeit per `testUI.explain.setVisible`).
- `sliderTarget: false`, `refSelect: false`, `toneType: false`,
  `sequence: false`. Eigener `volume`-Common.
- Slider: `unit: 'ms', initialRange: 50, maxRange: 2000`.
- Apply als eigener `applyButton`; speichert Wert und beendet Test.
  Stop (`stopKey: 'btnCancelTest'`) = abbrechen ohne Speichern
  (Verhaltensänderung gegenüber Alt-Code).
- Seitenhörtest vor Start (`testUI.sideCheck.run({sides:'both'})`).
- testUI-API-Erweiterung: `header.startStop.stopKey`. Enter-Routing
  feuert nun auch `onApply`, falls kein `confirmButton` vorhanden ist.
- freqmatch (slider und adaptive) verwenden `stopKey: 'btnPauseTest'`.
```

**d)** Im Abschnitt „Pfeiltasten-Mapping", Tabelle: bei der Enter-Zeile
ergänzen, daß Enter sowohl `confirmButton` als auch `applyButton`
triggert:

Suchen:

```
| Enter | „Offset bestätigen" / `onConfirm` auslösen | `confirmButton`-Baustein deklariert |
```

Ersetzen durch:

```
| Enter | `onConfirm` (falls `confirmButton` deklariert) oder `onApply` (falls `applyButton` deklariert) | `confirmButton` **oder** `applyButton`-Baustein deklariert |
```

### 6.2 `docs/spec/02-messung.md`

Den Abschnitt „Sub-Tab 4 — Latenz (latency.js)" aktualisieren:

- Hinweis „statisches HTML statt buildTestPanel" entfernen.
- Vortest-Hinweise dokumentieren.
- Apply/Cancel-Verhalten neu beschreiben (Stop = abbrechen).

Sonnet, finde den Abschnitt (ca. Zeile 392 ff.), passe die Beschreibung
an den neuen Code an und entferne Aussagen, die auf das alte statische
HTML verweisen. Konkret die Punkte:

- „Test läuft" / „Schieber nur während Test sichtbar" → bleibt (testUI
  blendet die testBox automatisch ein/aus).
- „Beim Stop wird der aktuelle Schieberwert automatisch als
  `latencyResult` übernommen." → **streichen** und ersetzen durch:
  „Beim **Offset bestätigen** wird der aktuelle Schieberwert als
  `latencyResult` gespeichert und der Test beendet. **Test abbrechen**
  beendet den Test ohne Speichern."
- Bei „latKeyHandler" → streichen (Pfeiltasten kommen aus testUI).
- Neuen Punkt: „Beim Öffnen des Sub-Tabs prüft `_latRefreshPrereqHints`
  zwei Vortest-Bedingungen und zeigt entsprechend einen Warnhinweis im
  Erklärblock — kein Showstopper, der Test läuft auch ohne."

### 6.3 `docs/CODESTRUKTUR.md`

In der Sub-Tab-Tabelle / Modul-Übersicht den Vermerk „nutzt
buildTestPanel" ergänzen, falls die Latenz dort heute noch als
Ausnahme markiert ist. Wenn nicht: keine Änderung nötig.

---

## Schritt 7 — Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.223-beta";
```

---

## Akzeptanztest

Klick-für-Klick durchgehen. Erwartetes Verhalten in Klammern.

1. **Sub-Tab Latenz öffnen** (Messungen → Latenz).
   - Erklärblock erscheint mit Titel „Latenz-Messung", Reifegrad-
     Hinweis (blau), Bluetooth-Warnung (orange), Vorbedingungs-Hinweis
     (gelb), darunter Plain-Texte.
   - Wenn vorher weder Balance noch Lautstärke gemessen wurde:
     **zwei zusätzliche gelbe Hinweise** sichtbar.
   - Wenn beide Vortests durchgeführt wurden: die zwei Zusatzhinweise
     bleiben verborgen.
2. **Header-Voreinstellungen prüfen**:
   - Lautstärke-Input vorhanden, Default 50 %.
   - Kein refSelect, kein Tonart-Dropdown, kein Sequence, kein
     sliderTarget.
   - Klick-Intervall: fünf Buttons (100/200/500/1000/2000 ms), 1000 ms
     aktiv.
   - Klangtyp: vier Buttons, „Klick (breitband)" aktiv.
   - Start-Button „▶ Test starten", Stop-Button **„■ Test abbrechen"** (disabled).
3. **Klick auf „Test starten"**:
   - Seitenhörtest-Modal erscheint („beide Seiten testen").
   - Nach Bestätigung im Modal: testBox wird sichtbar, Schieber bei
     0 ms (oder beim zuletzt gespeicherten Wert), Klicks beginnen
     beidseitig zu laufen.
   - Stop-Button aktiv, „Test abbrechen" beschriftet.
   - „Offset bestätigen"-Button sichtbar im Body.
   - Tab-Sperre aktiv (andere Tabs disabled).
4. **Schieber bewegen** (Maus, Touch, Pfeiltasten):
   - Verzögerung auf der entsprechenden Seite ist hörbar.
   - Pfeiltaste rechts: +1 ms; Shift+rechts: +0,1 ms.
   - Sliderwert-Anzeige aktualisiert sich („+12,3 ms" o.ä.).
   - Über 50 ms hinaus erweitert der Slider seinen Bereich
     automatisch; bei 100 ms ist die Range schon 100, bei 150 ms 150,
     usw. Keine harte Obergrenze, bis 2000 ms erreichbar.
5. **Klick-Typ wechseln**:
   - Anderer Button wird aktiv, Klicks wechseln live im Loop.
6. **Klick-Intervall wechseln**:
   - Anderer Button aktiv, Klicks loopen im neuen Intervall.
   - Hinweis unter den Buttons aktualisiert sich („Eindeutiger Bereich:
     ±n ms").
7. **„Offset bestätigen" klicken** (oder Enter drücken):
   - Klicks stoppen.
   - testBox verschwindet.
   - Stop-Button wieder disabled.
   - Tab-Sperre aufgehoben.
   - Im Ergebnis-Tab „Latenz" steht der neue Wert.
   - Im Player: Latenz wirkt sofort (z.B. Musik abspielen, hörbar).
8. **Test neu starten, dann „Test abbrechen"**:
   - testBox verschwindet, Stop-Button wieder disabled.
   - Im Ergebnis-Tab steht weiterhin der **alte** Wert (oder gar
     keiner, falls noch nie bestätigt wurde) — nicht der gerade
     geschobene.
9. **Sprachwechsel**:
   - Buttons, Hinweise und Anzeigen wechseln sauber zwischen
     de / en / fr / es.
10. **freqmatch-Test starten** (Messungen → Frequenzabgleich):
    - Stop-Button heißt **„■ Test pausieren"** (statt „■ Stop" oder
      „■ Test pausieren" wie heute — der Text ändert sich nicht
      sichtbar, weil der Default schon „pausieren" war; aber der
      Mechanismus läuft jetzt über den expliziten `stopKey`).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung **jedes der zehn Akzeptanzkriterien einzeln**
durchgehen und melden: **erfüllt / nicht erfüllt / unklar**, jeweils
mit Datei + Zeilenangabe der relevanten Stelle.

Besonderes Augenmerk auf:

- Der Slider-Bereich startet bei ±50 und erweitert sich beim
  Schieben automatisch (`_maybeExtendSlider` greift). Wenn beim Test
  die Range hängenbleibt: prüfen, ob `initialRange: 50` und
  `maxRange: 2000` richtig in `slRef` ankommen.
- DelayNode-Puffer von 2,0 s wird tatsächlich genutzt — `pLatDelayL`
  und `pLatDelayR` in `latInitGraph`. Bei großen Werten (z. B. 1500 ms)
  darf das Audio nicht stumm werden.
- `testUI.explain.setVisible` greift nur, wenn der Paragraph eine
  passende `id` im cfg-Eintrag hat. Verifizieren, daß
  `id: 'latVortestBalanceMissing'` und `id: 'latVortestLoudnessMissing'`
  korrekt gesetzt sind und der Helfer beim Sub-Tab-Öffnen feuert.
- Stop-Button-Text in freqmatch sichtbar als „■ Test pausieren". In
  Latenz sichtbar als „■ Test abbrechen". Wenn das eine fehlt: prüfen,
  ob `stopKey` im cfg landet und ob `_tEl(stopBtn, ...)` den richtigen
  Key bekommt.
- **Keine Overrides außerhalb der testUI-API**. Wenn dir während des
  Baus auffällt, daß ein Workaround attraktiv aussieht (DOM direkt
  patchen, Sonder-Property einbauen, Lifecycle-Funktion bypassen):
  **stoppen und Rückfrage stellen**. Lieber eine API-Erweiterung als
  ein versteckter Hack.

Wenn ein Punkt unklar bleibt, lieber Rückfrage als stille Annahme.

## Folge-Arbeiten (nicht in dieser BA)

- Anwendung der Elektrodenlautstärke-Korrektur (EQ-Filter) auf den
  Latenz-Test-Tonpfad. Heute geht `latTestSource` direkt an `pGain`
  und umgeht den Player-EQ. Eigene BA, wenn der Bedarf konkret wird.
- Cleanup der toten i18n-Keys (`latStopBtn`, `latSliderMinusLabel`,
  `latSliderZeroLabel`, `latSliderPlusLabel`, `latLockedHint`) — Teil
  von Schritt 6 „Aufräumen" laut SPEC.
