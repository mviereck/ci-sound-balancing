# Bauanleitung 75 — Frequenzabgleich: Trial-Loop + Status-Grid

## Ziel

Vierte Anleitung der 02b-Reihe. Verdrahtet den Staircase-Kern
aus Bauanleitung 74 mit der UI aus Bauanleitung 72:

- Echtes `fmStartAdaptive()` (kein Alert mehr)
- Trial-Loop: Ton-Sequenz spielen → Antwort entgegennehmen →
  `fmApplyResponse` rufen → Status-Grid aktualisieren → nächster Trial
- Status-Grid-Befüllung mit einer Zeile pro Elektrode (Status-Icon,
  Match, Residuum, Trial-Zahl, Catch-Statistik)
- Konvergente Tracks schreiben ihr Ergebnis in `fRes` (kompatibel
  zum Slider-Modus)
- Catch-Trials werden **noch nicht erzeugt** (kommt in 02b/6); der
  Trial-Loop ist aber so vorbereitet, daß isCatch-Trials sauber
  durchlaufen.

**Voraussetzungen**: Bauanleitungen 72, 73, 74 sind umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.75-beta";
```

---

## 2. Neue State-Variablen in `freqmatch.js`

Im State-Block (Z. 6–18) ergänzen:

```js
// Adaptiver Modus (Bauanleitung 02b/4)
let fmAdaptiveActive   = false;   // Test läuft adaptiv
let fmAwaitingResponse = false;   // gerade auf User-Antwort wartend
let fmTracks           = {};      // { [electrodeIdx]: trackState }
let fmCurTrackId       = null;    // aktuell laufende Track-Elektrode
let fmCurFirstSide     = 'ref';   // 'ref' | 'var' für den aktuellen Trial
let fmTrialStartTs     = 0;
```

---

## 3. Trial-Loop in `freqmatch.js`

Die folgenden Funktionen ersetzen / ergänzen die Stubs aus
Bauanleitung 73 (`fmStartAdaptive`, `fmHandleHeight`,
`fmReplayCurrent`). Position: Block „Adaptiver Modus" direkt vor
`fmStart()`:

### 3a) Start

```js
function fmStartAdaptive() {
  if (!fmEls) return;
  fmRefSide = fmEls.refSelect.value;
  fmVarSide = fmRefSide === 'left' ? 'right' : 'left';

  const elIdxList = fmBuildSeq();   // nutzt vorhandene Helfer-Funktion
  if (elIdxList.length === 0) {
    alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
    return;
  }

  fmTracks = {};
  elIdxList.forEach(function(idx) {
    const prev = fmPrevCent(idx);    // alter Match, falls vorhanden, sonst 0
    const prevOrNull = (prev !== 0) ? prev : null;
    fmTracks[idx] = fmCreateTrack(idx, prevOrNull);
  });

  fmRunning           = true;
  fmAdaptiveActive    = true;
  fmAwaitingResponse  = false;
  fmCurTrackId        = null;

  updateTabLockState();
  fmEls.lockedHint.hidden = false;
  fmEls.testBox.hidden    = false;
  fmEls.startBtn.disabled = true;
  fmEls.stopBtn.disabled  = false;
  if (fmEls.modeSelect) fmEls.modeSelect.disabled = true;

  fmRenderStatusGrid();
  fmNextAdaptiveTrial();
}
```

### 3b) Nächster Trial

```js
function fmNextAdaptiveTrial() {
  if (!fmAdaptiveActive) return;

  fmCurTrackId = fmPickNextTrack(fmTracks);
  if (fmCurTrackId === null) {
    fmFinishAdaptive();
    return;
  }

  fmCurFirstSide   = (Math.random() < 0.5) ? 'ref' : 'var';
  fmAwaitingResponse = false;

  const track = fmTracks[fmCurTrackId];
  // Pair-Anzeige semantisch umwidmen auf Ton-1 / Ton-2
  if (fmEls.pairLeft)  fmEls.pairLeft.textContent  = (typeof t === 'function' && t('fmTone1')) || 'Ton 1';
  if (fmEls.pairRight) fmEls.pairRight.textContent = (typeof t === 'function' && t('fmTone2')) || 'Ton 2';
  if (fmEls.pairFreq)  fmEls.pairFreq.textContent  = '';

  fmUpdateAdaptiveProgress();
  fmDisableHeightButtons();

  // Tonsequenz spielen, dann Antwort erlauben
  fmPlayAdaptiveTrial(track, fmCurFirstSide).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
    fmTrialStartTs = Date.now();
  });
}
```

### 3c) Tonsequenz spielen

`fmPlayAdaptiveTrial` lehnt sich an das bestehende `fmPlayCurrent`
an, ist aber strikt AB (kein ABA) und schiebt die **ref-Seite**:

```js
async function fmPlayAdaptiveTrial(track, firstSide) {
  if (fmIsPlay) {
    fmIsPlay = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    await new Promise(function(r) { setTimeout(r, 60); });
  }

  const varHz = withSide(fmVarSide, function() { return effFreq(track.electrodeIdx); });
  const refHz = varHz * Math.pow(2, track.currentOffset / 1200);

  const vol  = fmGVol();
  const ms   = fmGDur();
  const pau  = fmGPau();

  const balG = (typeof getRawBalanceGains === 'function')
    ? getRawBalanceGains() : { left: 0, right: 0 };

  const c = gAC();

  function playOne(side, hz) {
    const pan      = (side === 'left') ? -1 : 1;
    const corr     = fmCorrGain(side, hz);
    const balDb    = (side === 'left') ? balG.left : balG.right;
    const effVol   = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effVol, ms, pan, globalToneType);
  }

  fmIsPlay = true;
  isPlay   = true;

  if (firstSide === 'ref') {
    await playOne(fmRefSide, refHz);
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await playOne(fmVarSide, varHz);
  } else {
    await playOne(fmVarSide, varHz);
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
    if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
    await playOne(fmRefSide, refHz);
  }

  fmIsPlay = false;
  isPlay   = false;
}
```

### 3d) Antwort entgegennehmen

```js
// userChoice: 'up' | 'down' — was der User über höher/tiefer-Buttons
//             oder ↑/↓-Tasten gewählt hat (bezogen auf den zweiten Ton)
function fmHandleHeight(userChoice) {
  if (!fmAdaptiveActive || !fmAwaitingResponse) return;
  fmAwaitingResponse = false;
  fmDisableHeightButtons();

  const response = _fmConvertHeight(userChoice, fmCurFirstSide);
  const track    = fmTracks[fmCurTrackId];

  // 02b/4: noch keine Catch-Trial-Erzeugung — isCatch immer false
  fmApplyResponse(track, response, false, false, fmCurFirstSide);

  // Bei Konvergenz: in fRes schreiben (kompatibel zum Slider-Modus)
  if (track.status === 'converged' || track.status === 'converged-noisy') {
    _fmWriteResult(track);
  }

  fmRenderStatusGrid();

  // Nächster Trial nach kurzer Verzögerung (Wahrnehmungs-Pause)
  setTimeout(function() {
    if (fmAdaptiveActive) fmNextAdaptiveTrial();
  }, 200);
}

// Übersetzung „höher/tiefer auf zweiten Ton" → „var-higher/var-lower" (relativ ref)
function _fmConvertHeight(userChoice, firstSide) {
  // firstSide='ref': Ton2 = var. „höher" = var-higher, „tiefer" = var-lower
  // firstSide='var': Ton2 = ref. „höher" = ref-higher = var-lower, „tiefer" = var-higher
  if (firstSide === 'ref') {
    return (userChoice === 'up') ? 'var-higher' : 'var-lower';
  } else {
    return (userChoice === 'up') ? 'var-lower' : 'var-higher';
  }
}

function fmEnableHeightButtons() {
  if (fmEls && fmEls.hjHigher) fmEls.hjHigher.disabled = false;
  if (fmEls && fmEls.hjLower)  fmEls.hjLower.disabled  = false;
}
function fmDisableHeightButtons() {
  if (fmEls && fmEls.hjHigher) fmEls.hjHigher.disabled = true;
  if (fmEls && fmEls.hjLower)  fmEls.hjLower.disabled  = true;
}
```

### 3e) Replay

```js
function fmReplayCurrent() {
  if (!fmAdaptiveActive) return;
  if (fmCurTrackId === null) return;
  const track = fmTracks[fmCurTrackId];
  fmDisableHeightButtons();
  fmAwaitingResponse = false;
  fmPlayAdaptiveTrial(track, fmCurFirstSide).then(function() {
    if (!fmAdaptiveActive) return;
    fmAwaitingResponse = true;
    fmEnableHeightButtons();
  });
}
```

### 3f) Ergebnis nach fRes schreiben

```js
function _fmWriteResult(track) {
  const elIdx = track.electrodeIdx;
  const varHz = withSide(fmVarSide, function() { return effFreq(elIdx); });
  const refHz = (track.match != null)
    ? varHz * Math.pow(2, track.match / 1200)
    : varHz;

  const existingIdx = fRes.findIndex(function(r) {
    return r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx;
  });
  const entry = {
    varSide:   fmVarSide,
    refSide:   fmRefSide,
    elIdx:     elIdx,
    varFreq:   varHz,
    refFreq:   refHz,
    timestamp: Date.now(),
    // Zusatz-Felder aus dem adaptiven Modus (für Chart in 02b/7):
    fmStatus:  track.status,    // 'converged' | 'converged-noisy' | 'not-perceivable'
    fmResidual: track.residual  // cent, oder null
  };
  if (existingIdx >= 0) fRes[existingIdx] = entry;
  else                  fRes.push(entry);
}
```

### 3g) Test-Ende

```js
function fmFinishAdaptive() {
  fmAdaptiveActive   = false;
  fmAwaitingResponse = false;
  fmIsPlay           = false;
  fmRunning          = false;
  fmCurTrackId       = null;
  updateTabLockState();
  if (fmEls) {
    fmEls.testBox.hidden    = true;
    fmEls.lockedHint.hidden = true;
    fmEls.startBtn.disabled = false;
    fmEls.stopBtn.disabled  = true;
    if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
  }
  if (typeof renderFreqMatchResults === 'function') renderFreqMatchResults();
}
```

### 3h) Stop-Behandlung (Abort)

`fmAbort()` aus 02b/2 ergänzen, am Anfang einen Adaptiv-Zweig:

```js
function fmAbort() {
  if (fmAdaptiveActive) {
    fmAdaptiveActive   = false;
    fmAwaitingResponse = false;
    fmIsPlay           = false;
    if (fmPlayTO) { clearTimeout(fmPlayTO); fmPlayTO = null; }
    fmRunning          = false;
    fmCurTrackId       = null;
    updateTabLockState();
    if (fmEls) {
      fmEls.testBox.hidden    = true;
      fmEls.lockedHint.hidden = true;
      fmEls.startBtn.disabled = false;
      fmEls.stopBtn.disabled  = true;
      if (fmEls.modeSelect) fmEls.modeSelect.disabled = false;
    }
    return;
  }
  // ...bestehender Slider-Abort-Code unverändert...
}
```

---

## 4. Status-Grid-Befüllung

In `js/freqmatch.js`, neue Funktion (vor `fmStartAdaptive`):

```js
function fmRenderStatusGrid() {
  if (!fmEls || !fmEls.statusGrid) return;
  const grid = fmEls.statusGrid;
  grid.innerHTML = '';

  // Header
  const head = _mkEl('div', 'fm-status-row fm-status-head');
  ['fmGridEl', 'fmGridStatus', 'fmGridMatch', 'fmGridResid', 'fmGridTrials', 'fmGridCatch']
    .forEach(function(key) {
      const c = _mkEl('div', 'fm-status-cell');
      c.dataset.t = key;
      head.appendChild(c);
    });
  grid.appendChild(head);

  // Sortierung: apikal → basal (= aufsteigend nach Frequenz, wie fmBuildSeq)
  const ids = Object.keys(fmTracks).map(function(k) { return parseInt(k, 10); });
  ids.sort(function(a, b) {
    const fa = withSide(fmVarSide, function() { return effFreq(a); });
    const fb = withSide(fmVarSide, function() { return effFreq(b); });
    return fa - fb;
  });

  ids.forEach(function(idx) {
    const track = fmTracks[idx];
    const row = _mkEl('div', 'fm-status-row fm-status-' + track.status);
    if (idx === fmCurTrackId) row.classList.add('fm-status-current');

    // Elektroden-Bezeichnung
    const elName = withSide(fmVarSide, function() { return dENPrefix() + dEN(idx); });
    row.appendChild(_mkCell(elName));

    // Status-Icon
    const iconMap = {
      'active':          '⏳',
      'converged':       '✓',
      'converged-noisy': '◐',
      'not-perceivable': '✗'
    };
    row.appendChild(_mkCell(iconMap[track.status] || '?'));

    // Match
    let matchTxt = '—';
    if (track.match != null) {
      const sign = track.match >= 0 ? '+' : '';
      matchTxt = sign + Math.round(track.match) + ' ct';
    }
    row.appendChild(_mkCell(matchTxt));

    // Residuum
    let residTxt = '—';
    if (track.residual != null) {
      residTxt = '±' + Math.round(track.residual) + ' ct';
    }
    row.appendChild(_mkCell(residTxt));

    // Trial-Zahl
    row.appendChild(_mkCell(String(track.trialCount)));

    // Catch-Statistik
    row.appendChild(_mkCell(track.catchErrors + '/' + track.catchTotal));

    grid.appendChild(row);
  });

  // i18n auf Header anwenden
  if (typeof applyLang === 'function') applyLang(grid);
}

function _mkCell(text) {
  const c = _mkEl('div', 'fm-status-cell');
  c.textContent = text;
  return c;
}

function fmUpdateAdaptiveProgress() {
  if (!fmEls || !fmEls.progressText || !fmEls.progressFill) return;
  const ids = Object.keys(fmTracks);
  const done = ids.filter(function(k) { return fmTracks[k].status !== 'active'; }).length;
  const totalTrials = ids.reduce(function(s, k) { return s + fmTracks[k].trialCount; }, 0);
  fmEls.progressText.textContent = done + ' / ' + ids.length + ' (' + totalTrials + ' trials)';
  fmEls.progressFill.style.width = (ids.length > 0 ? (done / ids.length * 100) : 0) + '%';
}
```

`applyLang(root)`-Aufruf: prüfen, ob die Funktion in `js/i18n.js`
existiert und einen Root-Parameter akzeptiert. Falls nicht: die
i18n auf das Status-Grid manuell anwenden (Loop über
`[data-t]`-Elemente).

---

## 5. CSS für das Status-Grid

In der CSS-Datei der Test-UI (gleiche wie für Bauanleitung 72):

```css
.fm-status-grid {
  display: grid;
  grid-template-columns: minmax(60px, 1.2fr) 40px minmax(70px, 1fr) minmax(70px, 1fr) 60px 60px;
  gap: 0;
  margin: 12px 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.88em;
}
.fm-status-row {
  display: contents;
}
.fm-status-row > .fm-status-cell {
  padding: 4px 8px;
  border-top: 1px solid var(--border);
  text-align: center;
  background: var(--bg);
}
.fm-status-row.fm-status-head > .fm-status-cell {
  background: var(--bg-elev, #f0f0f0);
  font-weight: bold;
  border-top: none;
}
.fm-status-row.fm-status-current > .fm-status-cell {
  background: var(--accent-soft, #ffeaa7);
}
.fm-status-row.fm-status-converged > .fm-status-cell {
  background: var(--ok-soft, #d4edda);
}
.fm-status-row.fm-status-converged-noisy > .fm-status-cell {
  background: var(--warn-soft, #fff3cd);
}
.fm-status-row.fm-status-not-perceivable > .fm-status-cell {
  background: var(--err-soft, #f8d7da);
  color: var(--muted, #666);
}
```

Hinweis: `var(--accent-soft)`, `--ok-soft`, `--warn-soft`,
`--err-soft` sind Vorschläge. Wenn das Projekt schon CSS-Variablen
für Status-Farben hat (Sonnet sucht via
`grep -n "\-\-ok\|\-\-warn\|\-\-err" css/`), dann diese benutzen.
Sonst: hartkodierte Fallbacks wie oben.

---

## 6. Event-Verdrahtung der höher/tiefer-Buttons

In `js/freqmatch.js`, im DOMContentLoaded-Handler — die Stub-
Verdrahtung aus 02b/2 ist schon vorhanden:

```js
if (fmEls.hjHigher) fmEls.hjHigher.addEventListener('click', () => fmHandleHeight('up'));
if (fmEls.hjLower)  fmEls.hjLower.addEventListener('click',  () => fmHandleHeight('down'));
```

Sie ruft jetzt das echte `fmHandleHeight` aus Schritt 3d auf —
keine Code-Änderung nötig.

Anfangs sind die Buttons disabled. Nach dem Abspielen der
Tonsequenz werden sie über `fmEnableHeightButtons()` freigegeben.

---

## 7. Tab-Sperrung während aktivem Test

Spec sagt: alle anderen Tabs und Sub-Tabs gesperrt, wie bei den
übrigen Tests (`lockTestTabs`). `fmRunning = true` plus
`updateTabLockState()` (schon in `fmStartAdaptive()` enthalten)
sollten das bereits abdecken — Sonnet prüft, daß
`updateTabLockState()` auch für den Frequenzabgleich-Sub-Tab die
Sperrung greift. Wenn nicht: `updateTabLockState` so erweitern,
daß `fmRunning` (egal ob slider oder adaptive) zur Sperrung
führt.

---

## 8. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`, Zeile für `freqmatch.js` (Modul 9):

Neue Funktionen ergänzen:
- `fmStartAdaptive`, `fmNextAdaptiveTrial`, `fmPlayAdaptiveTrial`,
  `fmHandleHeight`, `fmReplayCurrent`, `fmFinishAdaptive`,
  `fmRenderStatusGrid`, `fmUpdateAdaptiveProgress`
- Interne Helfer: `_fmConvertHeight`, `_fmWriteResult`, `_mkCell`,
  `fmEnableHeightButtons`, `fmDisableHeightButtons`

Neue globale Variablen:
- `fmAdaptiveActive`, `fmAwaitingResponse`, `fmTracks`,
  `fmCurTrackId`, `fmCurFirstSide`, `fmTrialStartTs`

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.75-beta`.
2. Tab **Messungen** → Sub-Tab **Frequenzabgleich**, Modus
   `adaptive`. **Test starten**.
3. Test-Block öffnet sich:
   - Ton-1 / Ton-2-Anzeige
   - leere Tonfrequenz-Zeile (Hz wird im adaptiven Modus NICHT
     angezeigt — Pitch-Match wäre sonst durch Zahlen-Hint kompromittiert)
   - Status-Grid mit einer Zeile pro aktiver Elektrode:
     Kopfzeile + N Datenzeilen, Status-Icon ⏳, Match „—", Residuum „—",
     Trials 0, Catch 0/0
4. Zwei kurze Töne nacheinander hörbar (auf Ref- und Var-Seite),
   400 ms je Ton, 400 ms Pause dazwischen. Reihenfolge wechselt
   zufällig pro Trial.
5. Nach Ende der Tonsequenz: höher/tiefer-Buttons werden aktiv
   (nicht mehr ausgegraut).
6. **Pfeil-hoch** drücken → Status-Grid aktualisiert sich:
   - aktive Elektrode (= die gerade getestete) zeigt
     Trial-Zahl + 1
   - eine andere Elektrode wird zur „current" (gelb-orange
     hervorgehoben) — der nächste Trial pickt zufällig
   - Tonsequenz startet erneut
7. Weiter durchklicken (mal hoch, mal runter, mal abwechselnd) →
   Tracks akkumulieren Reversals. Nach ca. 30-60 Trials je Track
   sollten erste Konvergenzen sichtbar werden (Status-Icon ✓
   oder ◐, Match-Wert, Residuum-Wert).
8. Bei konvergierter Elektrode: Zeile wird grün (✓) oder gelb (◐)
   eingefärbt. Die Elektrode wird beim nächsten `fmPickNextTrack`
   nicht mehr gezogen.
9. **Esc**-Taste während Tonsequenz → Test bricht sofort ab,
   Test-Block schließt, Voreinstellungen wieder aktiv.
10. Test erneut starten → Tracks beginnen frisch (in dieser
    Anleitung gibt es noch keine Pause/Resume — das kommt in 02b/5).
11. Wenn alle Tracks abgeschlossen sind: Test-Block schließt von
    selbst, `renderFreqMatchResults` wird aufgerufen, das
    Freqmatch-Chart zeigt die gemessenen Cent-Offsets der
    konvergierten Elektroden (in alter Form — die Erweiterung
    mit Residuums-Band kommt in 02b/7).
12. Bestehender **Slider-Modus** weiterhin funktional unverändert.
13. Konsole frei von Fehlern.

### Schnelltest mit deterministischem RNG

Da der adaptive Modus 30-60 Antworten pro Track benötigt, ist
manuelles Durchklicken zermürbend. Für die Selbstprüfung Sonnet
kann optional ein „Auto-Antwort"-Helfer in der Konsole genutzt
werden:

```js
// In Konsole: 50 zufällige Antworten simulieren
async function _fmAutoAnswer(n) {
  for (let i = 0; i < n; i++) {
    while (!fmAwaitingResponse) await new Promise(r => setTimeout(r, 50));
    fmHandleHeight(Math.random() < 0.5 ? 'up' : 'down');
    await new Promise(r => setTimeout(r, 100));
  }
}
_fmAutoAnswer(150);
```

Sonnet darf diesen Helfer für Akzeptanztest 6–11 nutzen, **nicht**
ihn in den Production-Code einbauen.

---

## Selbstprüfungs-Auftrag an Sonnet

1. Jeden Akzeptanztest-Schritt einzeln durchgehen, melden:
   erfüllt / nicht erfüllt / unklar.
2. Speziell prüfen:
   - Wird `_fmConvertHeight` bei firstSide='var' korrekt invertiert?
     (siehe Tabelle in 3d-Kommentar)
   - Schreibt `_fmWriteResult` mit `varFreq=effFreq(i)` (Soll,
     unverschoben) und `refFreq=effFreq(i)*2^(match/1200)`?
     Damit fRes-Konvention konsistent zum Slider.
   - Wird `fmAdaptiveActive` in `fmAbort()` zurückgesetzt, so
     daß Tastatur-Handler aus 02b/2 nicht mehr feuern?
   - Funktioniert der Slider-Modus weiterhin vollständig
     (Regressions-Check)?
3. Bei Unklarheit zur Tonfrequenz-Anzeige (Hz-Zahl im
   adaptiven Modus sichtbar oder nicht?) — **rückfragen**, nicht
   raten.

---

## Was diese Anleitung NICHT macht

- Keine Pause/Resume-Persistenz (kommt in 02b/5)
- Keine Catch-Trials (kommt in 02b/6) — `_fmConvertHeight` und
  `fmApplyResponse`-Aufruf sind aber so vorbereitet, daß
  isCatch=true in 02b/6 sauber durchläuft
- Kein "not-perceivable"-Status (kommt in 02b/6)
- Keine Restunsicherheits-Band-Anzeige im Chart (kommt in 02b/7)
- Keine i18n-Strings (kommt in 02b/8)
