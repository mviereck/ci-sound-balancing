# Bauanleitung 207 — Auswahl Testelektroden (FreqMatch)

**Version**: nach Bau `3.2.207-beta`
**Vorgänger-Version**: `3.2.206.1-beta`
**Folge-Bauanleitung**: BA 208 zieht die Übersetzungen (en/fr/es) nach.

## Ziel

Im Reiter Messungen → Frequenzabgleich bekommt der Nutzer eine Funktion
„Testelektroden auswählen". Über einen Button im FreqMatch-Header öffnet
sich ein Popup-Dialog, in dem alle Elektroden gelistet werden. Stumm
geschaltete und ausgeschlossene Elektroden sind ausgegraut und nicht
anklickbar; alle übrigen sind anklickbar und per Default an. Die
Auswahl gilt **für beide Seiten gleichzeitig** und wirkt auf alle drei
FreqMatch-Verfahren (Slider Round, Adaptiv — und zukünftige).

Während laufender Pause darf der Nutzer die Auswahl ändern. Wenn der
aktuell „vorgemerkte" nächste Trial eine eben abgewählte Elektrode
betrifft, springt das Verfahren zur nächsten gültigen Elektrode bzw.
Runde. Wenn keine ausgewählte Elektrode übrig ist, endet der Test
sauber mit einer kurzen Meldung. Bereits gespeicherte Ergebnisse für
später abgewählte Elektroden bleiben erhalten.

Die UI-Komponente wird **generisch in `js/test-ui.js`** angelegt, sodaß
sie später (z.B. bei Migration der Elektrodenlautstärke-Messung auf
testUI) wiederverwendet werden kann. Die Mindestanzahl auszuwählender
Elektroden ist Konfigurationsparameter (`minSelected`). FreqMatch
verwendet `minSelected: 1`.

## Reihenfolge der Schritte

1. Versionsnummer bumpen (`js/version.js`).
2. Neue State-Variable `freqmatchTestSelection` in `js/freqmatch.js`.
3. Generische Komponente in `js/test-ui.js` (Header-Block + Modal-Dialog).
4. FreqMatch-Config (`fmCfg.header.common.electrodeSelection`) in
   `js/freqmatch.js`.
5. Filter-Helper `_fmFilterSeqBySelection` in `js/freqmatch.js`.
6. Selection-Filter in `fmBuildSeq` und `fmBuildSeqSymmetric`
   (`js/freqmatch.js`).
7. Adaptive-Track-Sync `_fmApplySelectionToTracks` in
   `js/freqmatch-adaptive.js`.
8. Slider-Round-Sync `_fmApplySelectionToSliderRun` in
   `js/freqmatch-slider.js`.
9. Selection-Change-Handler `_fmOnSelectionChanged` in `js/freqmatch.js`.
10. Save/Load-Anschluß für `freqmatchTestSelection` in `js/file.js`.
11. Deutsche i18n-Strings in `i18n/de.js`.
12. Spec-Update in `docs/spec/02-messung.md`.
13. CODESTRUKTUR-Update in `docs/CODESTRUKTUR.md`.
14. Selbstprüfung gegen die Akzeptanztest-Checkliste.

## Schritt 1 — Versionsnummer bumpen

`js/version.js` komplett ersetzen durch:

```js
const APP_VERSION = "3.2.207-beta";
```

## Schritt 2 — Neue State-Variable

In `js/freqmatch.js` im Variablen-Block am Dateianfang (etwa nach
Zeile 50, am Ende des `let _fmParentEl = null;`-Blocks) ergänzen:

```js
// BA 207: Selektion der zu testenden Elektroden.
// null  = Default (= alle aktiven Elektroden testen).
// []    = Nutzer hat explizit nichts ausgewählt (Test startet nicht).
// [...] = explizite Auswahl. Filter greift in fmBuildSeq / fmBuildSeqSymmetric.
// Die Auswahl gilt für beide Seiten gleichzeitig, weil FreqMatch
// links↔rechts vergleicht.
let freqmatchTestSelection = null;
```

## Schritt 3 — Generische Komponente in test-ui.js

### 3a. Header-Block

In `js/test-ui.js` direkt VOR dem Block `if (cfg.header.extra && cfg.header.extra.fragment)` (Zeile 952) folgenden Block einfügen:

```js
// BA 207: Auswahl Testelektroden (generisch, optional pro Verfahren).
if (hc.electrodeSelection) {
  var esCfg = hc.electrodeSelection;
  var rowES = _mkEl('div', 'controls-row');
  rowES.dataset.row = 'electrode-selection';
  var esSummary = _mkEl('span', 'electrode-selection-summary');
  esSummary.dataset.t = '';  // wird in _esUpdateSummary aktiv gesetzt
  var esBtn = _mkEl('button', 'btn btn-small');
  esBtn.type = 'button';
  esBtn.dataset.t = 'electrodeSelectionHeaderBtn';
  rowES.append(esSummary, esBtn);
  headerBox.appendChild(rowES);
  headerRefs.electrodeSelectionSummary = esSummary;
  headerRefs.electrodeSelectionBtn = esBtn;
  headerRefs.electrodeSelectionCfg = esCfg;

  function _esUpdateSummary() {
    var sel = esCfg.getSelection();
    var stat = esCfg.getElectrodeStatus();
    var testable = stat.testable.length;
    var selected;
    if (sel == null) selected = testable;
    else selected = sel.filter(function(i) { return stat.testable.indexOf(i) >= 0; }).length;
    var tpl = (typeof t === 'function' && t('electrodeSelectionHeaderSummary'))
      || '{m} von {n} Elektroden gewählt';
    esSummary.textContent = tpl.replace('{m}', selected).replace('{n}', testable);
  }
  headerRefs.electrodeSelectionUpdate = _esUpdateSummary;

  esBtn.addEventListener('click', function() {
    _openElectrodeSelectionDialog(esCfg, _esUpdateSummary);
  });

  _esUpdateSummary();
}
```

### 3b. Modal-Dialog

In `js/test-ui.js` ans Dateiende (vor dem letzten `})();` falls IIFE,
sonst einfach an passender Stelle vor `buildTestPanel`) folgende
Hilfsfunktion einfügen:

```js
// BA 207: Modal-Dialog „Testelektroden auswählen".
// cfg: {
//   minSelected:        number   - Mindestanzahl gewählter Elektroden (>=1)
//   getSelection:       () => number[] | null   - aktuelle Auswahl
//   setSelection:       (sel: number[]) => void - Auswahl setzen, Sync-Callbacks intern
//   getElectrodeStatus: () => { testable: number[], muted: number[], excluded: number[] }
//   electrodeLabel:     (i) => string  - Anzeigename z.B. "E3 (590 Hz)"
// }
function _openElectrodeSelectionDialog(cfg, onChange) {
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  var dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:320px;max-width:90vw;max-height:85vh;overflow:auto;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);';

  var title = document.createElement('h3');
  title.dataset.t = 'electrodeSelectionTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  var hint = document.createElement('p');
  hint.dataset.t = 'electrodeSelectionHint';
  hint.style.cssText = 'margin:0 0 12px 0;font-size:.92em;';
  dlg.appendChild(hint);

  var errBox = document.createElement('div');
  errBox.style.cssText = 'color:#c00;font-size:.88em;min-height:1.2em;margin-bottom:6px;';
  dlg.appendChild(errBox);

  var allRow = document.createElement('div');
  allRow.style.cssText = 'display:flex;gap:8px;margin-bottom:10px;';
  var allOnBtn = document.createElement('button');
  allOnBtn.type = 'button';
  allOnBtn.className = 'btn btn-small';
  allOnBtn.dataset.t = 'electrodeSelectionSelectAll';
  var allOffBtn = document.createElement('button');
  allOffBtn.type = 'button';
  allOffBtn.className = 'btn btn-small';
  allOffBtn.dataset.t = 'electrodeSelectionDeselectAll';
  allRow.append(allOnBtn, allOffBtn);
  dlg.appendChild(allRow);

  var stat = cfg.getElectrodeStatus();
  var allIndices = [].concat(stat.testable, stat.muted, stat.excluded)
    .sort(function(a, b) { return a - b; });
  var cur = cfg.getSelection();
  var selSet;
  if (cur == null) selSet = new Set(stat.testable);
  else selSet = new Set(cur.filter(function(i) { return stat.testable.indexOf(i) >= 0; }));

  // Spaltenweise gefüllt: bei N Elektroden wird in zwei Spalten gelegt,
  // erste Spalte = obere Hälfte (aufgerundet), zweite Spalte = Rest.
  var nTotal = allIndices.length;
  var perCol = Math.ceil(nTotal / 2);
  var list = document.createElement('div');
  list.style.cssText =
    'display:grid;' +
    'grid-template-columns:1fr 1fr;' +
    'grid-template-rows:repeat(' + perCol + ', auto);' +
    'grid-auto-flow:column;' +
    'gap:4px 18px;' +
    'margin-bottom:14px;';
  var cbRefs = {};
  var mutedSuf  = (typeof t === 'function' && t('electrodeSelectionMutedSuffix'))      || 'stumm';
  var exclSuf   = (typeof t === 'function' && t('electrodeSelectionExcludedSuffix'))   || 'ausgeschlossen';
  var mutedSet = new Set(stat.muted);
  var exclSet  = new Set(stat.excluded);

  allIndices.forEach(function(i) {
    var lbl = document.createElement('label');
    var disabled = mutedSet.has(i) || exclSet.has(i);
    lbl.style.cssText =
      'display:flex;align-items:center;gap:6px;font-size:.92em;' +
      (disabled ? 'opacity:.45;cursor:not-allowed;' : 'cursor:pointer;');
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(i);
    cb.checked = !disabled && selSet.has(i);
    cb.disabled = disabled;
    cbRefs[i] = cb;
    var sp = document.createElement('span');
    var baseTxt = cfg.electrodeLabel(i);
    if (mutedSet.has(i))     baseTxt += ' (' + mutedSuf + ')';
    else if (exclSet.has(i)) baseTxt += ' (' + exclSuf + ')';
    sp.textContent = baseTxt;
    lbl.append(cb, sp);
    list.appendChild(lbl);
  });
  dlg.appendChild(list);

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.dataset.t = 'electrodeSelectionCancel';
  var confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.dataset.t = 'electrodeSelectionConfirm';
  btnRow.append(cancelBtn, confirmBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  if (typeof applyLang === 'function') applyLang();

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  cancelBtn.addEventListener('click', close);

  allOnBtn.addEventListener('click', function() {
    stat.testable.forEach(function(i) { if (cbRefs[i]) cbRefs[i].checked = true; });
    errBox.textContent = '';
  });
  allOffBtn.addEventListener('click', function() {
    stat.testable.forEach(function(i) { if (cbRefs[i]) cbRefs[i].checked = false; });
  });

  confirmBtn.addEventListener('click', function() {
    var chosen = [];
    stat.testable.forEach(function(i) {
      if (cbRefs[i] && cbRefs[i].checked) chosen.push(i);
    });
    var minN = cfg.minSelected || 1;
    if (chosen.length < minN) {
      var tpl = (typeof t === 'function' && t('electrodeSelectionMinError'))
        || 'Mindestens {n} Elektrode(n) auswählen';
      errBox.textContent = tpl.replace('{n}', minN);
      return;
    }
    cfg.setSelection(chosen);
    if (typeof onChange === 'function') onChange();
    close();
  });
}
```

## Schritt 4 — FreqMatch-Config

In `js/freqmatch.js` in der `fmCfg`-Definition den `header.common`-Block
(etwa Zeilen 1028–1041) am Ende ergänzen — nach `sliderTarget`:

```js
header: {
  common: {
    refSelect:    { type: 'side', key: 'fmLblRef', includeSymmetric: true },
    volume:       { show: true },
    duration:     { show: true, default: 400, min: 100, max: 3000, step: 50 },
    pause:        { show: true, default: 400, min: 50,  max: 2000, step: 50 },
    toneType:     { show: true, source: 'global' },
    sequence:     { show: true, source: 'global' },
    sliderTarget: {
      options:  ['ref','var','balance'],
      default:  'ref',
      disabled: true,
      hintKey:  'fmSliderTargetDisabledHint'
    },
    // BA 207: Auswahl-Komponente. FreqMatch braucht >= 1 Elektrode.
    electrodeSelection: {
      minSelected: 1,
      getSelection: function() { return freqmatchTestSelection; },
      setSelection: function(sel) {
        freqmatchTestSelection = sel.slice();
        _fmOnSelectionChanged();
      },
      getElectrodeStatus: function() {
        var testable = [], muted = [], excluded = [];
        for (var i = 0; i < nEl; i++) {
          if (elExDur[i] != null)         excluded.push(i);
          else if (elActive[i] === false) muted.push(i);
          else                            testable.push(i);
        }
        return { testable: testable, muted: muted, excluded: excluded };
      },
      electrodeLabel: function(i) {
        return dENPrefix() + dEN(i) + ' (' + Math.round(effFreq(i)) + ' Hz)';
      }
    }
  },
  startStop: { startKey: 'fmLblStart', resumable: true }
},
```

> **Edge-Case-Hinweis (für Sonnet):** `elActive`, `elExDur`, `dEN`,
> `dENPrefix`, `effFreq`, `nEl` sind im FreqMatch-Kontext seitenabhängig
> über `withSide(...)` zu schalten. Für die Status-Erhebung im
> Header-Dialog gilt aber die Regel „FreqMatch betrifft beide Seiten
> gleichzeitig" — wir lesen den Status ohne `withSide`-Wechsel, also
> bezogen auf die gerade aktive Seite (`activeSide`). Das ist akzeptabel,
> weil für FreqMatch ohnehin beide Seiten dieselben aktiven Elektroden
> haben müssen (sonst meldet `fmStartAdaptive`/`fmStartSlider` Mismatch).
> Kein `withSide`-Aufruf in der `electrodeLabel`-Callback einbauen.

## Schritt 5 — Filter-Helper

In `js/freqmatch.js` direkt VOR `function fmBuildSeq()` einfügen:

```js
// BA 207: Schneidet eine Elektroden-Sequenz auf die User-Auswahl.
// freqmatchTestSelection === null → keine Einschränkung (alle aktiven).
// freqmatchTestSelection !== null → Schnittmenge mit gewählten.
function _fmFilterSeqBySelection(seq) {
  if (freqmatchTestSelection == null) return seq;
  var selSet = new Set(freqmatchTestSelection);
  return seq.filter(function(i) { return selSet.has(i); });
}
```

## Schritt 6 — fmBuildSeq und fmBuildSeqSymmetric

In `js/freqmatch.js`:

**`fmBuildSeq`** — letzte Zeile (Zeile 292) ändern von

```js
return elList.map((x) => x.idx);
```

zu

```js
return _fmFilterSeqBySelection(elList.map((x) => x.idx));
```

**`fmBuildSeqSymmetric`** — letzte Zeile (Zeile 323) ändern von

```js
return seq.map(function(x) { return x.idx; });
```

zu

```js
return _fmFilterSeqBySelection(seq.map(function(x) { return x.idx; }));
```

## Schritt 7 — Adaptive-Track-Sync

In `js/freqmatch-adaptive.js` direkt VOR `function fmStartAdaptive()`
(Zeile 27) einfügen:

```js
// BA 207: Synchronisiert Track-Status mit der aktuellen
// freqmatchTestSelection. Wird nach Auswahl-Änderungen aufgerufen.
// Regeln:
//   - status 'active'      + Elektrode abgewählt → 'deselected'
//   - status 'deselected'  + Elektrode wieder gewählt → 'active'
//   - alle anderen Status (converged*, unstable, not-perceivable, aborted)
//     bleiben unverändert. Konvergierte Ergebnisse gehen NICHT verloren.
function _fmApplySelectionToTracks() {
  if (!fmTracks) return;
  var sel = freqmatchTestSelection;
  var hasSel = (sel != null);
  var selSet = hasSel ? new Set(sel) : null;
  Object.keys(fmTracks).forEach(function(k) {
    var tr = fmTracks[k];
    if (!tr) return;
    var idx = fmParseTrackKey(k).electrodeIdx;
    var wanted = !hasSel || selSet.has(idx);
    if (wanted && tr.status === 'deselected') tr.status = 'active';
    else if (!wanted && tr.status === 'active') tr.status = 'deselected';
  });
  // Wenn der aktuell vorgemerkte Track jetzt 'deselected' ist:
  // RoundQueue stumpf leeren, beim nächsten fmPickNextTrack wird neu gepickt.
  if (fmCurTrackId != null && fmTracks[fmCurTrackId]
      && fmTracks[fmCurTrackId].status === 'deselected') {
    fmRoundQueue = [];
  }
}
```

## Schritt 8 — Slider-Round-Sync

In `js/freqmatch-slider.js` direkt VOR `function fmStartSlider()`
(Zeile 117) einfügen:

```js
// BA 207: Synchronisiert sliderRoundRun mit der User-Auswahl.
// Wird nach Auswahl-Änderung aufgerufen, wenn der Slider-Modus aktiv ist.
// Wirkung:
//   - run.electrodeIdxList auf gefilterte Sequenz setzen
//   - remainingInRound auf Schnittmenge filtern
//   - totalInRound aktualisieren
//   - fmSeq spiegeln und fmSeqIdx auf passenden Index nachjustieren
function _fmApplySelectionToSliderRun() {
  if (!sideData[fmVarSide]) return;
  var fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa || !fa.sliderRoundRun) return;
  var run = fa.sliderRoundRun;
  var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
  if (!Array.isArray(freshSeq)) freshSeq = [];
  run.electrodeIdxList = freshSeq.slice();
  var freshSet = new Set(freshSeq);
  run.remainingInRound = (run.remainingInRound || []).filter(function(i) { return freshSet.has(i); });
  run.totalInRound = run.electrodeIdxList.length;
  run.completedInRound = run.totalInRound - run.remainingInRound.length;

  // Aktive fmSeq-Sicht in Übereinstimmung mit verbliebenen Elektroden.
  fmSeq = run.remainingInRound.slice();
  // fmSeqIdx so setzen, daß fmCurrentEl (falls noch gültig) auf [0] sitzt;
  // sonst beginnt der Lauf bei [0] mit der nächsten verbliebenen.
  if (fmCurrentEl != null && freshSet.has(fmCurrentEl)) {
    var pos = fmSeq.indexOf(fmCurrentEl);
    fmSeqIdx = pos >= 0 ? pos : 0;
  } else {
    fmSeqIdx = 0;
  }
}
```

## Schritt 9 — Selection-Change-Handler in freqmatch.js

In `js/freqmatch.js` direkt NACH der Definition von
`function fmBuildSeqSymmetric()` (also nach Zeile 324) einfügen:

```js
// BA 207: Wird vom Auswahl-Dialog nach Confirm aufgerufen.
// Aufgaben:
//   - Adaptive: laufende Tracks mit neuer Auswahl synchronisieren
//   - Slider: laufenden Slider-Round-State synchronisieren
//   - Header-Zusammenfassung neu rendern
//   - Wenn nach Filter keine Elektrode mehr übrig: laufenden Test sauber beenden
function _fmOnSelectionChanged() {
  if (fmAdaptiveActive && typeof _fmApplySelectionToTracks === 'function') {
    _fmApplySelectionToTracks();
    // Statusgrid neu zeichnen, falls existiert.
    if (typeof fmRenderStatusGrid === 'function') fmRenderStatusGrid();
  }
  if (fmRunning && !fmAdaptiveActive && typeof _fmApplySelectionToSliderRun === 'function') {
    _fmApplySelectionToSliderRun();
    if (typeof fmRenderSliderStatusGrid === 'function') fmRenderSliderStatusGrid();
    if (typeof fmUpdateSliderProgress === 'function') fmUpdateSliderProgress();
  }

  // Header-Summary nach-rendern
  if (fmEls && fmEls.header && typeof fmEls.header.electrodeSelectionUpdate === 'function') {
    fmEls.header.electrodeSelectionUpdate();
  }

  // Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist
  // UND ein Test läuft: sauber beenden.
  if (fmRunning) {
    var freshSeq = fmSymmetric ? fmBuildSeqSymmetric() : fmBuildSeq();
    if (!Array.isArray(freshSeq) || freshSeq.length === 0) {
      var msg = (typeof t === 'function' && t('electrodeSelectionEmptyEnd'))
        || 'Test beendet: Keine ausgewählte Elektrode mehr verfügbar.';
      alert(msg);
      if (fmEls && fmEls._stopTest) fmEls._stopTest();
    }
  }
}
```

> **Mutations-Hinweis (für Sonnet):** `fmRoundQueue` ist eine
> module-globale Variable in `freqmatch.js`. Die Zuweisung
> `fmRoundQueue = []` in `_fmApplySelectionToTracks` (Schritt 7) wirkt
> direkt auf das Modul-Global, **nicht** auf eine Kopie. Das ist
> beabsichtigt: beim nächsten `fmNextAdaptiveTrial` wird die leere
> Queue durch `fmPickNextTrack` neu befüllt — ausschließlich mit
> Tracks im Status `'active'`, also unter Berücksichtigung der
> Selection. Nicht auf in-place-mutate umstellen.

## Schritt 10 — Save/Load-Anschluß

### 10a. Save

In `js/file.js` in der `saveJson`-Funktion (Zeile 193 ff.) in das
Top-Level-Objekt `d` (etwa nach `fRes: ...` Zeile 260) ergänzen:

```js
freqmatchTestSelection: (typeof freqmatchTestSelection !== "undefined")
  ? freqmatchTestSelection : null,
```

### 10b. Load

In `js/file.js` an passender Stelle im Lade-Pfad (in der Nähe von
`if (Array.isArray(d.fRes)) {...}` um Zeile 635, vor dem
`fRes.splice(...)`) einen neuen Block einfügen:

```js
// BA 207: Auswahl der Testelektroden für FreqMatch.
// Alte Dateien ohne dieses Feld → null (= alle aktiven testen).
if (typeof freqmatchTestSelection !== "undefined") {
  freqmatchTestSelection = Array.isArray(d.freqmatchTestSelection)
    ? d.freqmatchTestSelection.slice()
    : null;
}
```

Auch im Reset-Pfad (Suche nach `globalSequence = "aba";` Zeile 60 ff.,
da werden Defaults beim Tool-Reset gesetzt) einfügen:

```js
if (typeof freqmatchTestSelection !== "undefined") freqmatchTestSelection = null;
```

## Schritt 11 — Deutsche i18n-Strings

In `i18n/de.js` am Ende des `Object.assign(L.de, { ... })`-Blocks
folgende Keys einfügen (genau diese Schreibweise — Klammerzählung
prüfen: jeder Wert ist ein einfacher String ohne `"`-Inhalt, also
ASCII-`"` als Begrenzer):

```js
electrodeSelectionTitle: "Testelektroden auswählen",
electrodeSelectionHint: "Nur ausgewählte Elektroden nehmen am Testverfahren teil.",
electrodeSelectionSelectAll: "Alle auswählen",
electrodeSelectionDeselectAll: "Alle abwählen",
electrodeSelectionCancel: "Abbrechen",
electrodeSelectionConfirm: "Übernehmen",
electrodeSelectionMinError: "Mindestens {n} Elektrode(n) auswählen.",
electrodeSelectionMutedSuffix: "stumm",
electrodeSelectionExcludedSuffix: "ausgeschlossen",
electrodeSelectionHeaderBtn: "Testelektroden auswählen",
electrodeSelectionHeaderSummary: "{m} von {n} Elektroden gewählt",
electrodeSelectionEmptyEnd: "Test beendet: Keine ausgewählte Elektrode mehr verfügbar.",
```

## Schritt 12 — Spec-Update

In `docs/spec/02-messung.md` im Abschnitt **Sub-Tab 3 — Frequenzabgleich**
nach dem **Modus-Schalter**-Abschnitt (also nach dem Adaptiv-Punkt, vor
„Seitenhörtest vor Test-Start") folgenden neuen Absatz einfügen:

```markdown
- **Auswahl Testelektroden** (BA 207): Header-Button „Testelektroden
  auswählen" mit nebenstehender Zusammenfassung („m von n Elektroden
  gewählt"; n zählt nur testbare = nicht stummgeschaltete und nicht
  ausgeschlossene Elektroden). Der Button öffnet einen Popup-Dialog
  mit Checkbox-Liste aller Elektroden in zwei Spalten (E1..E6 links,
  E7..E12 rechts bei 12 Kanälen). Stumm geschaltete Elektroden tragen
  das Suffix „(stumm)", ausgeschlossene das Suffix „(ausgeschlossen)";
  beide sind ausgegraut und nicht anklickbar. Buttons „Alle auswählen"
  / „Alle abwählen" wirken nur auf testbare Elektroden. Mindestauswahl:
  1 Elektrode. Die Auswahl gilt seitenübergreifend, weil
  Frequenzabgleich links↔rechts vergleicht. State-Variable:
  `freqmatchTestSelection: number[] | null` (`null` = Default „alle
  testbaren"). Persistiert in Save/Load als Top-Level-Feld.

  Auswahl-Änderungen während Pause oder laufendem Test:
  - Slider Round — `sliderRoundRun.remainingInRound` wird gefiltert,
    `fmSeq`/`fmSeqIdx` neu justiert; wenn die aktuelle Elektrode noch
    gewählt ist, bleibt sie aktuell, sonst springt der Test zur nächsten.
  - Adaptiv — Tracks bekommen Pseudo-Status `'deselected'` für abgewählte
    bzw. `'active'` für wieder ausgewählte (Status-Wechsel nur für aktive
    Tracks; konvergierte und nicht-wahrnehmbare bleiben unangetastet).
    `fmRoundQueue` wird geleert, damit `fmPickNextTrack` neu auswählt.
  - Wenn nach Filter keine testbare Elektrode mehr in der Auswahl ist,
    endet der laufende Test mit Hinweis „Test beendet: Keine ausgewählte
    Elektrode mehr verfügbar.".

  Bestehende Ergebnisse (`rounds[]`, `tracks[*]` mit Status
  `'converged*'`/`'not-perceivable'`/`'aborted'`) bleiben bei
  Selection-Änderungen unangetastet.
```

## Schritt 13 — CODESTRUKTUR-Update

In `docs/CODESTRUKTUR.md` im Abschnitt zu `js/freqmatch.js` (suche nach
„freqmatch.js" als Datei-Überschrift) am Ende der Aufzählung der
globalen Variablen ergänzen:

```markdown
- **`freqmatchTestSelection: number[] | null`** (BA 207) — Auswahl der
  zu testenden Elektroden im Frequenzabgleich. `null` = Default „alle
  aktiven testen". Filter in `fmBuildSeq` / `fmBuildSeqSymmetric` über
  `_fmFilterSeqBySelection`. Selection-Change-Sync für laufende Tests
  in `_fmOnSelectionChanged`, dort werden `_fmApplySelectionToTracks`
  (adaptiv) und `_fmApplySelectionToSliderRun` (Slider Round)
  aufgerufen.
```

Und im Abschnitt zu `js/test-ui.js` (Komponenten-Übersicht) bei
`header.common.*` ergänzen:

```markdown
- **`header.common.electrodeSelection`** (BA 207) — generische
  Auswahl-Komponente: Header-Zeile mit Summary + Button „Testelektroden
  auswählen", öffnet `_openElectrodeSelectionDialog`. Konfiguration:
  `{ minSelected, getSelection, setSelection, getElectrodeStatus,
  electrodeLabel }`. Stumm geschaltete und ausgeschlossene Elektroden
  werden ausgegraut angezeigt, Mindestanzahl wird im Dialog erzwungen.
  Verwendet aktuell von FreqMatch (`minSelected: 1`); für eine spätere
  Migration der Elektrodenlautstärke-Messung auf testUI vorgesehen
  (dort dann `minSelected: 2` und seitenspezifischer State).
```

## Akzeptanztest

Nach jedem Schritt einmal die Seite im Browser neu laden
(Cache-Refresh: Strg+Shift+R) und Konsole offen halten.

### 1. Sichtbarkeit & Default

- [ ] Reiter Messungen → Sub-Tab „Frequenzabgleich" öffnen.
- [ ] Im Header (oberhalb des „Test starten"-Buttons) erscheint eine
      neue Zeile mit Text wie „11 von 11 Elektroden gewählt" und einem
      Button „Testelektroden auswählen". (Die Zahl hängt vom Implantat
      ab — bei stummgeschalteten Elektroden zählt nur die Differenz.)

### 2. Dialog öffnen, Layout

- [ ] Button klicken → Popup öffnet sich.
- [ ] Titel: „Testelektroden auswählen". Hinweis: „Nur ausgewählte
      Elektroden nehmen am Testverfahren teil."
- [ ] Liste in **zwei Spalten**, spaltenweise gefüllt: erste Spalte
      enthält die niedrig-indizierten Elektroden (E1, E2, …), zweite
      Spalte die höheren — **nicht** zeilenweise.
- [ ] Stumm geschaltete Elektroden tragen Suffix „(stumm)", sind
      ausgegraut und nicht klickbar; ausgeschlossene Elektroden tragen
      Suffix „(ausgeschlossen)", ebenso ausgegraut.
- [ ] Buttons „Alle auswählen" und „Alle abwählen" oberhalb der Liste.
- [ ] Buttons „Abbrechen" und „Übernehmen" unten rechts.

### 3. Mindestauswahl

- [ ] Auf „Alle abwählen" klicken → alle anklickbaren Häkchen weg.
- [ ] „Übernehmen" → Fehlerzeile in Rot: „Mindestens 1 Elektrode(n)
      auswählen."
- [ ] Mindestens eine Elektrode anhaken → „Übernehmen" → Dialog schließt.
- [ ] Im Header steht „1 von N Elektroden gewählt".

### 4. Auswahl wirkt auf Slider Round

- [ ] Sub-Tab „Frequenzabgleich" → Verfahren „Slider Round" wählen.
- [ ] Auswahl auf 3 Elektroden reduzieren, „Übernehmen".
- [ ] „Test starten" → Seitenhörtest absolvieren → Test läuft.
- [ ] Fortschrittsanzeige zeigt „Runde 1 · Elektrode 1 von 3" (nicht
      mehr „von 11" o.ä.).
- [ ] Status-Grid unter dem Slider listet nur die 3 ausgewählten
      Elektroden.

### 5. Auswahl-Änderung während laufendem Slider-Test

- [ ] Im laufenden Slider-Test eine weitere Elektrode dazuholen über
      den Header-Button → Übernehmen.
- [ ] Status-Grid und Fortschritts-Total aktualisieren sich live auf
      4 Elektroden.
- [ ] Wenn die gerade aktuell laufende Elektrode abgewählt wird:
      Test springt zur nächsten gültigen Elektrode (nicht abstürzen,
      kein Konsolen-Error).
- [ ] Alle ausgewählten Elektroden abwählen außer einer → Test läuft
      weiter, Restanzahl wird kleiner.

### 6. Auswahl wirkt auf Adaptiv

- [ ] Verfahren „Adaptiv" wählen, Auswahl auf 4 Elektroden setzen.
- [ ] „Test starten" → Seitenhörtest → Test läuft.
- [ ] Status-Grid listet alle aktiven Elektroden, abgewählte zeigen
      Status `'deselected'` (Anzeige weiterhin wie zuvor — kein
      eigener neuer Status-Text in dieser BA).
- [ ] `fmPickNextTrack` wählt keine abgewählte Elektrode mehr — beim
      Trial-Wechsel kommt nur eine der 4 gewählten dran.

### 7. Auswahl-Änderung während Pause/Adaptiv

- [ ] Test starten, ein paar Trials machen → Tab wechseln (pausiert
      implizit über Tab-Lock) → zurück zu Frequenzabgleich.
- [ ] Auswahl ändern (eine Elektrode abwählen, andere dazu) →
      Übernehmen.
- [ ] „Test starten" → Resume-Path springt sauber an: bisherige
      Tracks-Resultate bleiben erhalten, abgewählte sind
      `'deselected'`.

### 8. Ergebnisse bleiben erhalten

- [ ] Mit Auswahl 4 Elektroden im adaptiven Modus 2 Trials abschließen.
- [ ] Im Header eine der 4 abwählen.
- [ ] „Test starten" → Status-Grid zeigt diese Elektrode weiter mit
      den bisherigen Daten, aber sie wird nicht mehr in Trials gepickt.

### 9. Persistenz über Reload

- [ ] Auswahl auf 5 Elektroden setzen.
- [ ] Reiter „Laden/Speichern" → Datei speichern.
- [ ] Browser-Tab schließen, Tool neu laden, Datei laden.
- [ ] Im Frequenzabgleich-Header steht „5 von N Elektroden gewählt".

### 10. Alte Save-Datei

- [ ] Eine ältere Save-Datei (vor BA 207) laden → kein Konsolen-Error;
      Auswahl ist `null` → Header zeigt „N von N Elektroden gewählt".

### 11. Test-Ende bei leerer Auswahl während laufendem Test

- [ ] Adaptiv-Test mit 2 Elektroden starten.
- [ ] Im Header beide abwählen wollen → Dialog blockt mit
      „Mindestens 1 Elektrode auswählen.". (Im Dialog kommt der Fall
      „leer" gar nicht durch.)
- [ ] Über den Reiter Implantat eine der 2 stumm schalten → zurück
      zu Frequenzabgleich → Auswahl-Dialog öffnen → die stumme ist
      ausgegraut → übrig: 1 Elektrode. Test läuft mit 1 Elektrode
      weiter.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen und
melden: **erfüllt** / **nicht erfüllt** / **unklar**, mit Datei und
Zeilenangabe der relevanten Stelle. Bei „unklar" — Rückfrage stellen,
nicht stillschweigend annehmen.

Zusätzliche Selbstprüf-Punkte (intern):

1. `version.js` zeigt `3.2.207-beta`.
2. `freqmatchTestSelection` ist in `js/freqmatch.js` deklariert und
   sowohl in `_fmFilterSeqBySelection` als auch in `fmBuildSeq` /
   `fmBuildSeqSymmetric` referenziert.
3. Die generische Komponente in `js/test-ui.js` ist über
   `header.common.electrodeSelection`-Schalter abgekoppelt — wenn
   ein anderes Panel diesen Block nicht konfiguriert, erscheint die
   Zeile nicht.
4. `_openElectrodeSelectionDialog` ruft `applyLang()` nach dem Anhängen
   an `document.body`, sodaß `data-t`-Übersetzungen sofort greifen.
5. In `_fmApplySelectionToTracks` werden `'converged'`,
   `'converged-fair'`, `'converged-wide'`, `'unstable'`,
   `'not-perceivable'`, `'aborted'` **nicht** verändert. Nur
   `'active' ↔ 'deselected'` wechselt.
6. Save/Load: `freqmatchTestSelection` wird in `saveJson` als Top-Level
   gespeichert und in `loadJson` an passender Stelle vor dem Test-UI-
   Refresh wieder gesetzt. Reset-Pfad setzt zurück auf `null`.
7. `_fmOnSelectionChanged` ruft den Header-Summary-Refresh
   (`fmEls.header.electrodeSelectionUpdate`) und nicht den
   selbst-implementierten Update auf — Konsistenz mit `headerRefs`.
8. ASCII-Quotes in JS-Snippets: prüfen, daß keine typografischen
   Anführungszeichen `„"` etc. in `.js`-Dateien gelandet sind. In
   `i18n/de.js` ist `"..."` als ASCII-Begrenzer verwendet, der Inhalt
   darf typografisch sein (`„"`), aber muß zu den ASCII-`"`-Zählern
   konsistent bleiben (keine ungescapeten `"` im String-Inneren).

## Hinweis auf Folge-Bauanleitung

BA 208 zieht die englischen, französischen und spanischen
Übersetzungen für die in Schritt 11 angelegten i18n-Keys nach. Erst
bauen, wenn die deutschen Texte aus Schritt 11 nach Sicht stehen.
