# BAUANLEITUNG 206 — Frequenzabgleich: „Slider Round" (Mehrfach-Runden)

Bauanleitung erst ausführen, wenn Du sie komplett gelesen hast. Reihenfolge der Schritte einhalten.

**Hinweis zur Abweichung von den Leitlinien**: Diese Anleitung führt deutsche **und** englische, französische, spanische Strings in einem Schub ein (sonst werden i18n-Strings als Folge-BA nachgezogen — siehe `docs/BAUANLEITUNGEN_LEITLINIEN.md` Z. 37-56). Auf ausdrücklichen Wunsch des Nutzers: alles in einer BA.

---

## 1. Ziel

Ersetze das heutige Slider-Verfahren im Frequenzabgleich (`fmStartSlider` / `freqmatch-slider.js`) durch ein neues Verfahren „Slider Round" mit beliebig vielen Runden. Pro Runde wird jede aktive (und nicht ausgeschlossene) Elektrode genau einmal in zufälliger Reihenfolge abgefragt. Der Test endet nicht von alleine; der Nutzer pausiert manuell und kann später nahtlos weitermachen. Pro Elektrode sammelt sich eine Historie aller bisherigen Messwerte; unter dem Slider erscheint ab dem zweiten Messwert ein farbiger Balken (Min..Max) mit Dreieck (Median bei ≥3 Werten, Mittelwert bei genau 2 Werten, einziger Wert bei 1).

Der aggregierte Wert (= dasselbe was das Dreieck markiert) wird in `sliderEstimates[el].cent` geschrieben — bestehender Code, der diesen Wert liest (Ergebnis-Diagramm Pfeil, adaptive Vorschätzung, Loudness-Korrektur im Audio-Pfad), bleibt unverändert.

---

## 2. Version

**Letzter Schritt**: in `js/version.js` die Konstante setzen:

```js
const APP_VERSION = "3.2.206-beta";
```

---

## 3. Datenmodell

Heute (`sideData[side].freqmatchAdaptive.sliderEstimates`):

```js
sliderEstimates["3"] = {
  cent: -15, varSide: "right", refSide: "left",
  varFreq: 1248, timestamp: 1700000000000
};
```

Neu — pro Elektrode kommt das Feld `rounds` hinzu, das die Historie hält:

```js
sliderEstimates["3"] = {
  cent: -15,                  // = Aggregat-Wert (Median/Mean/Single), wird neu berechnet bei jedem Update
  varSide: "right", refSide: "left",
  varFreq: 1248,
  timestamp: 1700000000200,   // letzter Update
  rounds: [
    { cent: -10, ts: 1700000000000, round: 1 },
    { cent: -20, ts: 1700000000100, round: 2 },
    { cent: -15, ts: 1700000000200, round: 3 }
  ]
};
```

Zusätzlich ein neues Feld `sideData[side].freqmatchAdaptive.sliderRoundRun` für die Lauf-Steuerung (Pause/Resume):

```js
sliderRoundRun = {
  runId:              "2026-06-04T12:34:56.000Z",  // ISO-Timestamp Start
  startedAt:          1700000000000,
  lastUpdate:         1700000000200,
  varSide:            "right",
  refSide:            "left",
  symmetric:          false,
  currentRound:       3,                    // aktuell laufende Runde
  totalInRound:       12,                   // Soll-Anzahl in dieser Runde (aktive Elektroden)
  remainingInRound:   [7, 2, 11],           // restliche Elektroden in aktueller Runde (zufällige Reihenfolge)
  completedInRound:   9,                    // wieviel in dieser Runde schon gemessen
  electrodeIdxList:   [0,1,2,3,4,5,6,7,8,9,10,11]  // Plan-Liste der aktiven Elektroden zum Lauf-Start
};
```

Beide Felder liegen neben dem bestehenden `runs[]`-Array (für den adaptiven Modus). Sie werden vom adaptiven Modus nicht berührt, und umgekehrt.

---

## 4. Schritt 1 — `state-side.js`: Migration alter `sliderEstimates`

In `js/state-side.js`, in der Funktion `_fmMigrateAdaptive(fa)` (ca. Z. 215-236), nach der `fa.sliderEstimates = savedEstimates;`-Zuweisung folgenden Block einfügen, der alte Einzelwerte (ohne `rounds`-Feld) in eine R1-Historie überführt:

**Vorher** (Z. 234 ff.):
```js
  fa.sliderEstimates = savedEstimates;
  return fa;
}
```

**Nachher**:
```js
  fa.sliderEstimates = savedEstimates;
  // BA 206: Alte sliderEstimates (ohne rounds[]-Feld) auf R1-Historie heben.
  // Slider Round liest dieses Feld; alte Stände werden so als erste Runde
  // behandelt, und der nächste Lauf beginnt mit Runde 2.
  Object.keys(fa.sliderEstimates).forEach(function(k) {
    const e = fa.sliderEstimates[k];
    if (!e || typeof e !== 'object') return;
    if (Array.isArray(e.rounds)) return;
    if (typeof e.cent !== 'number') return;
    e.rounds = [{ cent: e.cent, ts: e.timestamp || Date.now(), round: 1 }];
  });
  return fa;
}
```

Analog in `_fmMigrateAltSliderFRes()` (Z. 256 ff.): am Ende, wo der neue Slider-Estimate-Eintrag geschrieben wird (Z. 301-307), das `rounds`-Feld direkt mitgeben:

**Vorher**:
```js
    store[String(elIdx)] = {
      cent:      cent,
      varSide:   r.varSide,
      refSide:   r.refSide || (side === 'left' ? 'right' : 'left'),
      varFreq:   r.varFreq,
      timestamp: (typeof r.timestamp === 'number') ? r.timestamp : Date.now()
    };
```

**Nachher**:
```js
    const _ts206 = (typeof r.timestamp === 'number') ? r.timestamp : Date.now();
    store[String(elIdx)] = {
      cent:      cent,
      varSide:   r.varSide,
      refSide:   r.refSide || (side === 'left' ? 'right' : 'left'),
      varFreq:   r.varFreq,
      timestamp: _ts206,
      // BA 206: Alt-Slider-fRes-Eintrag wird als R1-Wert übernommen.
      rounds:    [{ cent: cent, ts: _ts206, round: 1 }]
    };
```

---

## 5. Schritt 2 — `freqmatch.js`: Helfer für Aggregat und Vorrunde

In `js/freqmatch.js` direkt **nach** `_fmEnsureSliderStore(side)` (Z. 86-97) folgende Helfer einfügen:

```js
// BA 206: Aggregat-Wert aus rounds[]-Historie berechnen.
// Regel: ≥3 Werte → Median, =2 → Mittelwert, =1 → der Wert selbst, 0 → null.
// Wird beim Speichern eines neuen Wertes (fmConfirm) und beim Anzeigen
// des Dreiecks unter dem Slider verwendet — identische Zahl.
function _fmAggregateCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  if (vals.length === 1) return vals[0];
  if (vals.length === 2) return (vals[0] + vals[1]) / 2;
  const sorted = vals.slice().sort(function(a, b) { return a - b; });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

// BA 206: Min/Max aus rounds[]-Historie. Rückgabe {min, max} oder null.
function _fmRangeCent(rounds) {
  if (!Array.isArray(rounds) || rounds.length === 0) return null;
  const vals = rounds.map(function(r) { return r && typeof r.cent === 'number' ? r.cent : null; })
                     .filter(function(v) { return v != null && isFinite(v); });
  if (vals.length === 0) return null;
  let mn = vals[0], mx = vals[0];
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] < mn) mn = vals[i];
    if (vals[i] > mx) mx = vals[i];
  }
  return { min: mn, max: mx };
}

// BA 206: Letzter Messwert dieser Elektrode (= Startwert für nächste Runde).
// Liefert null, wenn noch kein Wert vorliegt.
function _fmLastRoundCent(elIdx) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  if (!store) return null;
  const e = store[String(elIdx)];
  if (!e || !Array.isArray(e.rounds) || e.rounds.length === 0) return null;
  const last = e.rounds[e.rounds.length - 1];
  return (last && typeof last.cent === 'number') ? last.cent : null;
}
```

Die bisherige Funktion `fmPrevCent(elIdx)` (Z. 287-311) durch folgende ersetzen — sie wechselt von „beliebigem Vorwert" auf „letzter Runden-Wert":

```js
// BA 206: Startwert für eine Elektrode = letzter Wert aus rounds[].
// Fallback: existierender fRes-Eintrag (alte Speicherstände, in
// _fmMigrateAltSliderFRes nicht migrierbar). 0 wenn nichts vorhanden.
function fmPrevCent(elIdx) {
  const last = _fmLastRoundCent(elIdx);
  if (last != null) return Math.round(last);

  const existing = fRes.find((r) => fmSymmetric
    ? (r.refSide === 'symmetric' && r.elIdx === elIdx)
    : (r.varSide === fmVarSide && r.refSide === fmRefSide && r.elIdx === elIdx)
  );
  if (!existing) return 0;
  if (fmSymmetric && typeof existing.cent === 'number' && isFinite(existing.cent)) {
    return Math.round(existing.cent);
  }
  return Math.round(fmCents(existing.varFreq, existing.refFreq));
}
```

---

## 6. Schritt 3 — `freqmatch-slider.js`: Komplett-Umbau

Inhalt von `js/freqmatch-slider.js` durch das folgende Modul ersetzen. Funktionsnamen bleiben (`fmStartSlider`, `fmConfirm`, `fmSkip`, `fmShowElectrode`, `fmUpdateSliderDisplay`, `fmLoadElectrode`, `fmUpdateSliderProgress`, `fmRenderSliderStatusGrid`, `fmRunSliderDebugSim`), damit die Hooks in `freqmatch.js` greifen. Neu: `fmPauseSlider`, `_fmSliderRoundEnsureRun`, `_fmSliderRoundLoadOrStartRound`, `_fmUpdateSliderRangeMarker`.

```js
// ============================================================
// freqmatch-slider.js — Frequenzabgleich: Verfahren "Slider Round"
// ============================================================
// BA 206: Mehrfach-Runden, zufällige Reihenfolge pro Runde, Pause/Resume.
// Abhängigkeit: freqmatch.js (shared State, Hilfsfunktionen, Persistenz).

// --- UI-Anzeige ---

function fmUpdateSliderDisplay() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const centStr = (fmCentOffset >= 0 ? "+" : "") + Math.round(fmCentOffset);
  const centUnit = (typeof t === 'function' && t("fmCentUnit")) || "Cent";
  if (fmSymmetric) {
    const leftBase  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightBase = withSide('right', function() { return effFreq(fmCurrentEl); });
    const playL = leftBase  * Math.pow(2, -fmCentOffset / 2 / 1200);
    const playR = rightBase * Math.pow(2, +fmCentOffset / 2 / 1200);
    if (slRefs && slRefs.sliderValue) {
      slRefs.sliderValue.textContent = centStr + " " + centUnit
        + " (L: " + playL.toFixed(0) + " Hz / R: " + playR.toFixed(0) + " Hz)";
    }
    return;
  }
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const hzStr = refHz.toFixed(2);
  if (slRefs && slRefs.sliderValue) {
    slRefs.sliderValue.textContent = centStr + " " + centUnit + " (" + hzStr + " Hz)";
  }
  const refSideLabel = fmRefSide === "left" ? t("sideLeft") : t("sideRight");
  const refText = refSideLabel + ": " + hzStr + " Hz, " + centStr + " " + centUnit;
  const pi = _fmSliderPI();
  if (pi) {
    if (fmRefSide === "left") pi.left.textContent = refText;
    else                      pi.right.textContent = refText;
  }
}

function fmShowElectrode() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  const pi = _fmSliderPI();
  if (fmSymmetric) {
    const leftHz  = withSide('left',  function() { return effFreq(fmCurrentEl); });
    const rightHz = withSide('right', function() { return effFreq(fmCurrentEl); });
    if (pi) {
      const leftLabel  = withSide('left',  function() { return dENPrefix() + dEN(fmCurrentEl); });
      const rightLabel = withSide('right', function() { return dENPrefix() + dEN(fmCurrentEl); });
      pi.left.textContent  = leftLabel  + ", " + leftHz.toFixed(2)  + " Hz (" + t("sideLeft")  + ")";
      pi.right.textContent = rightLabel + ", " + rightHz.toFixed(2) + " Hz (" + t("sideRight") + ")";
    }
  } else {
    const varHz = fmVarHz(fmCurrentEl);
    const varSideLabel = fmVarSide === "left" ? t("sideLeft") : t("sideRight");
    const varText = withSide(fmVarSide, () => dENPrefix()) + fmDEN(fmCurrentEl) + ", " +
      varHz.toFixed(2) + " Hz (" + varSideLabel + ")";
    if (pi) {
      if (fmVarSide === "left") pi.left.textContent = varText;
      else                      pi.right.textContent = varText;
    }
  }
  if (slRefs && slRefs.slider) {
    testUI.slider.setValue(slRefs.slider, fmCentOffset);
  }
  fmUpdateSliderDisplay();
  _fmUpdateSliderRangeMarker();   // BA 206: Balken + Dreieck unter Slider
  fmUpdateSliderProgress();
  const undoBtn = _fmSliderUndo();
  if (undoBtn) undoBtn.disabled = fmSeqIdx === 0;
}

// BA 206: Balken (Min..Max der bisherigen Werte) + Dreieck (Median/Mean/Single)
// unter dem Slider. Sichtbar ab dem ersten gespeicherten Wert; Balken erst ab 2.
// Analog zur LV-Hint-Mechanik in test.js, aber mit Cent-Skala und auf
// rounds[]-Historie gestützt.
function _fmUpdateSliderRangeMarker() {
  if (!fmEls || fmCurrentEl === null) return;
  const slRefs = fmEls.verfahren && fmEls.verfahren.slider;
  if (!slRefs) return;
  const hint = slRefs.rangeHint, band = slRefs.rangeHintBand,
        mark = slRefs.rangeHintMark, label = slRefs.rangeHintLabel;
  if (!hint || !band || !mark || !label) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive)
    ? sideData[fmVarSide].freqmatchAdaptive.sliderEstimates : null;
  const e = store ? store[String(fmCurrentEl)] : null;
  const rounds = (e && Array.isArray(e.rounds)) ? e.rounds : null;
  const agg = _fmAggregateCent(rounds);
  if (agg == null) { hint.style.display = "none"; return; }

  const slider = slRefs.slider;
  if (!slider) { hint.style.display = "none"; return; }
  const minV = parseFloat(slider.min), maxV = parseFloat(slider.max);
  if (!isFinite(minV) || !isFinite(maxV) || maxV <= minV) { hint.style.display = "none"; return; }
  const span = maxV - minV;

  if (agg < minV || agg > maxV) { hint.style.display = "none"; return; }
  hint.style.display = "";
  const markPct = ((agg - minV) / span) * 100;
  mark.style.left  = markPct + "%";
  label.style.left = markPct + "%";
  label.textContent = (agg >= 0 ? "+" : "") + (Math.round(agg * 10) / 10) + " ct";

  const range = _fmRangeCent(rounds);
  if (!range || range.min === range.max) {
    band.style.display = "none";
    return;
  }
  band.style.display = "";
  const bandLeft  = Math.max(minV, range.min);
  const bandRight = Math.min(maxV, range.max);
  band.style.left  = (((bandLeft  - minV) / span) * 100) + "%";
  band.style.width = (((bandRight - bandLeft) / span) * 100) + "%";
}

// --- Testablauf ---

function fmStartSlider() {
  if (!fmEls) return;
  _fmInitSides();
  if (fmSymmetric) {
    fmSeq = fmBuildSeqSymmetric();
    if (fmSeq === null) {
      alert((typeof t === 'function' && t('fmSymmetricElMismatch'))
        || 'Symmetrischer Modus: Beide Seiten müssen dieselben aktiven Elektroden haben.');
      fmEls._stopTest();
      return;
    }
    if (fmSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden.');
      fmEls._stopTest();
      return;
    }
  } else {
    if ((sideData.left  && sideData.left.config)  === 'ci' &&
        (sideData.right && sideData.right.config) === 'ci' &&
        fmBuildSeqSymmetric() === null) {
      alert((typeof t === 'function' && t('fmElMismatch'))
        || 'Frequenzabgleich nicht möglich: Auf beiden Seiten müssen dieselben Elektroden aktiv sein.');
      fmEls._stopTest();
      return;
    }
    fmSeq = fmBuildSeq();
    if (fmSeq.length === 0) {
      alert((typeof t === 'function' && t('fmNoActiveEl')) || 'Keine aktiven Elektroden auf der variablen Seite.');
      fmEls._stopTest();
      return;
    }
  }
  testUI.sideCheck.run(
    { sides: 'both' },
    _fmDoStartSlider,
    function() { if (fmEls) fmEls._stopTest(); }
  );
}

function _fmDoStartSlider() {
  _fmSliderRoundEnsureRun();
  _fmSliderRoundLoadOrStartRound();
  fmSeqIdx  = 0;
  fmRunning = true;
  fmLoadElectrode();
  _fmStartTimer();
  testUI.sideCheck.startIdleWatch(_fmParentEl, 5 * 60 * 1000, function() {
    if (fmEls) fmEls._stopTest();
  });
}

// BA 206: stellt sicher, daß sliderRoundRun für die aktuelle (varSide,
// refSide, symmetric)-Kombination existiert. Wenn ein Run existiert,
// aber von einer anderen Seiten-Kombi stammt, wird er ersetzt.
function _fmSliderRoundEnsureRun() {
  if (!sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive
    || (sideData[fmVarSide].freqmatchAdaptive = { runs: [], currentRunIdx: null, sliderEstimates: {} });
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  let run = fa.sliderRoundRun;
  const elList = fmSeq.slice();
  if (!run || run.varSide !== fmVarSide || run.refSide !== fmRefSide
      || run.symmetric !== fmSymmetric) {
    run = {
      runId:              new Date().toISOString(),
      startedAt:          Date.now(),
      lastUpdate:         Date.now(),
      varSide:            fmVarSide,
      refSide:            fmRefSide,
      symmetric:          fmSymmetric,
      currentRound:       0,
      totalInRound:       0,
      remainingInRound:   [],
      completedInRound:   0,
      electrodeIdxList:   elList
    };
    fa.sliderRoundRun = run;
  } else {
    // Falls Elektroden ausgeschlossen/aktiviert wurden, electrodeIdxList und
    // remainingInRound bereinigen (nur noch in aktueller Plan-Liste enthaltene).
    run.electrodeIdxList = elList;
    const set = new Set(elList);
    run.remainingInRound = run.remainingInRound.filter(function(i) { return set.has(i); });
  }
}

// BA 206: Falls die aktuelle Runde noch offene Elektroden hat, wird sie
// fortgesetzt (Pause/Resume); sonst beginnt eine neue Runde mit frisch
// gemischter Reihenfolge.
function _fmSliderRoundLoadOrStartRound() {
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  const run = fa.sliderRoundRun;
  const fullList = run.electrodeIdxList.slice();
  if (!run.remainingInRound || run.remainingInRound.length === 0) {
    // neue Runde
    run.currentRound      = (run.currentRound || 0) + 1;
    run.totalInRound      = fullList.length;
    run.completedInRound  = 0;
    run.remainingInRound  = _fmShuffle(fullList);
  } else {
    // bestehende Runde fortsetzen — totalInRound bleibt, completedInRound bleibt.
    if (run.currentRound < 1) run.currentRound = 1;
    if (!run.totalInRound) run.totalInRound = fullList.length;
  }
  // fmSeq spiegelt die Reihenfolge dieses Resume-Abschnitts wider.
  fmSeq = run.remainingInRound.slice();
}

function _fmShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function fmLoadElectrode() {
  if (fmSeqIdx >= fmSeq.length) {
    // Runde fertig — sofort die nächste Runde beginnen.
    const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
    if (fa && fa.sliderRoundRun) fa.sliderRoundRun.remainingInRound = [];
    _fmSliderRoundLoadOrStartRound();
    fmSeqIdx = 0;
    fmRenderSliderStatusGrid();
    fmUpdateSliderProgress();
  }
  fmCurrentEl = fmSeq[fmSeqIdx];
  fmCentOffset = fmPrevCent(fmCurrentEl);
  fmFirstSide = Math.random() < 0.5 ? "ref" : "var";
  fmShowElectrode();
  fmRenderSliderStatusGrid();
  setTimeout(() => { if (fmRunning) fmPlayCurrent(); }, 100);
}

function fmConfirm() {
  if (!fmRunning || fmCurrentEl === null) return;
  const varHz = fmVarHz(fmCurrentEl);
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  const run = fa.sliderRoundRun;
  const roundNo = (run && run.currentRound) || 1;
  const now = Date.now();
  const cent = Math.round(fmCentOffset);

  const key = String(fmCurrentEl);
  let entry = fa.sliderEstimates[key];
  if (!entry || typeof entry !== 'object') {
    entry = {
      cent:      cent,
      varSide:   fmVarSide,
      refSide:   fmSymmetric ? 'symmetric' : fmRefSide,
      varFreq:   varHz,
      timestamp: now,
      rounds:    []
    };
    fa.sliderEstimates[key] = entry;
  }
  if (!Array.isArray(entry.rounds)) entry.rounds = [];
  entry.rounds.push({ cent: cent, ts: now, round: roundNo });
  entry.varSide   = fmVarSide;
  entry.refSide   = fmSymmetric ? 'symmetric' : fmRefSide;
  entry.varFreq   = varHz;
  entry.timestamp = now;
  // BA 206: Aggregat (gleiche Zahl wie das Dreieck unter dem Slider) ins
  // .cent-Feld schreiben. Diesen Wert lesen Pfeil im Ergebnis-Diagramm,
  // adaptive Vorschätzung und Loudness-Korrektur im Audio-Pfad.
  const agg = _fmAggregateCent(entry.rounds);
  if (agg != null) entry.cent = Math.round(agg * 10) / 10;

  if (run) {
    // aktuelle Elektrode aus remainingInRound entfernen
    const idx = run.remainingInRound.indexOf(fmCurrentEl);
    if (idx >= 0) run.remainingInRound.splice(idx, 1);
    run.completedInRound = (run.totalInRound || 0) - run.remainingInRound.length;
    run.lastUpdate = now;
  }

  if (typeof pApplyWarpModeDefaultFromFm === "function") {
    pApplyWarpModeDefaultFromFm();
  }

  fmSeqIdx++;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
  if (typeof depLockApply === 'function') depLockApply();
}

// BA 206: Skip — nur Reihenfolge weiter, KEIN Wert speichern.
function fmSkip() {
  if (!fmRunning) return;
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (fa && fa.sliderRoundRun) {
    const run = fa.sliderRoundRun;
    const idx = run.remainingInRound.indexOf(fmCurrentEl);
    if (idx >= 0) run.remainingInRound.splice(idx, 1);
    run.completedInRound = (run.totalInRound || 0) - run.remainingInRound.length;
  }
  fmSeqIdx++;
  fmLoadElectrode();
}

// BA 206: Pause — Lauf nicht abbrechen, nur stoppen. Persistenz bleibt;
// beim nächsten Start setzt _fmSliderRoundLoadOrStartRound die Runde dort fort.
function fmPauseSlider() {
  if (!fmRunning) return;
  if (fmEls && fmEls._stopTest) fmEls._stopTest();
}

// --- Fortschritt ---

function fmUpdateSliderProgress() {
  if (!fmEls) return;
  const _sprog = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.progress;
  if (!_sprog) return;
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  const run = fa && fa.sliderRoundRun;
  const total = run ? (run.totalInRound || 0) : (fmSeq ? fmSeq.length : 0);
  const cur   = run ? Math.min((run.completedInRound || 0) + 1, total) : (fmSeqIdx + 1);
  const frac  = total > 0 ? Math.min(cur / total, 1) : 0;
  const roundNo = run ? (run.currentRound || 1) : 1;
  const lbl = (typeof t === 'function' && t('fmSliderRoundProgress')) || 'Runde %R · Elektrode %C von %T';
  const txt = lbl.replace('%R', roundNo).replace('%C', cur).replace('%T', total);
  testUI.progress.set(_sprog, { fraction: frac, text: txt });
}

function fmRenderSliderStatusGrid() {
  if (!fmEls) return;
  const grid = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.statusGrid;
  if (!grid) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                 && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};
  const fa  = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  const run = fa && fa.sliderRoundRun;
  const fullList = (run && run.electrodeIdxList) || fmSeq || [];

  const head =
    '<tr>' +
      '<th>' + (t('fmSliderRoundColEl')       || 'Elektrode')          + '</th>' +
      '<th>' + (t('fmSliderRoundColStartHz')  || 'Startfreq (Hz)')      + '</th>' +
      '<th>' + (t('fmSliderRoundColCount')    || 'Anzahl Werte')        + '</th>' +
      '<th>' + (t('fmSliderRoundColRange')    || 'Bereich (Cent)')      + '</th>' +
      '<th>' + (t('fmSliderRoundColAgg')      || 'Aktuelle Schätzung')  + '</th>' +
      '<th>' + (t('fmSliderRoundColAggHz')    || 'Schätzung (Hz)')      + '</th>' +
      '<th>' + (t('fmSliderRoundColStatus')   || 'Status')              + '</th>' +
    '</tr>';

  const rows = [head];
  fullList.forEach(function(el) {
    const startHz = fmVarHz(el);
    const isCur   = (fmCurrentEl === el && fmRunning && !fmAdaptiveActive);
    const entry   = store[String(el)];
    const rounds  = (entry && Array.isArray(entry.rounds)) ? entry.rounds : [];
    const count   = rounds.length;
    const range   = _fmRangeCent(rounds);
    const agg     = _fmAggregateCent(rounds);

    const rangeCell = (range && count >= 2)
      ? ((range.min >= 0 ? '+' : '') + Math.round(range.min) + ' … ' + (range.max >= 0 ? '+' : '') + Math.round(range.max))
      : '—';
    const aggCell = (agg != null)
      ? ((agg >= 0 ? '+' : '') + (Math.round(agg * 10) / 10) + ' ct')
      : '—';
    const aggHzCell = (agg != null)
      ? (Math.round(fmFreqFromCents(startHz, agg)) + ' Hz')
      : '—';
    const statusCell = count > 0 ? ('✓ (' + count + ')') : '✗';

    rows.push(
      '<tr' + (isCur ? ' class="current-row"' : '') + '>' +
        '<td>E' + el + '</td>' +
        '<td>' + Math.round(startHz) + ' Hz</td>' +
        '<td>' + count + '</td>' +
        '<td>' + rangeCell + '</td>' +
        '<td>' + aggCell + '</td>' +
        '<td>' + aggHzCell + '</td>' +
        '<td>' + statusCell + '</td>' +
      '</tr>'
    );
  });

  grid.innerHTML = '<table class="fm-slider-status">' + rows.join('') + '</table>';
}

// --- Debug-Simulation ---

function fmRunSliderDebugSim() {
  if (!fmRunning) {
    fmStartSlider();
    setTimeout(fmRunSliderDebugSim, 100);
    return;
  }
  const fa = sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return;
  if (!fa.sliderEstimates) fa.sliderEstimates = {};
  const run = fa.sliderRoundRun;
  const roundNo = (run && run.currentRound) || 1;
  const now = Date.now();
  (fmSeq || []).forEach(function(el) {
    const key = String(el);
    let entry = fa.sliderEstimates[key];
    if (!entry) {
      entry = { cent: 0, varSide: fmVarSide, refSide: fmRefSide, varFreq: fmVarHz(el),
                timestamp: now, rounds: [] };
      fa.sliderEstimates[key] = entry;
    }
    const cent = Math.round(-200 + Math.random() * 700);
    entry.rounds.push({ cent: cent, ts: now, round: roundNo });
    const agg = _fmAggregateCent(entry.rounds);
    if (agg != null) entry.cent = Math.round(agg * 10) / 10;
    entry.varFreq = fmVarHz(el);
    entry.timestamp = now;
  });
  if (run) {
    run.completedInRound = run.totalInRound;
    run.remainingInRound = [];
    run.lastUpdate = now;
  }
  if (typeof pApplyWarpModeDefaultFromFm === "function") pApplyWarpModeDefaultFromFm();
  // nach Sim: nächste Runde anlegen, weiter "leeren" Render
  _fmSliderRoundLoadOrStartRound();
  fmSeqIdx = 0;
  fmLoadElectrode();
  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
```

---

## 7. Schritt 4 — `test-ui.js`: Balken + Dreieck unter dem Slider als testUI-Feld

Im Slider-Verfahren-Body (`freqmatch.js` Z. 1008-1023) liegt heute `slider: { unit: 'cent', initialRange: 100, ... }`. Damit der neue „Balken+Dreieck"-Block beim Bau des Slider-Containers angelegt und in `slRefs.rangeHint*` referenziert wird, in `js/test-ui.js` an der Stelle, an der der Slider-Container für die `verfahren`-Body-Variante zusammengebaut wird (suchen nach `slWrap.appendChild(lsHint);` Z. 1157 und `lsHint` in der `refs`-Rückgabe Z. 1169), ein zweites Element-Set in **derselben Position** ergänzen:

**Suchen** (nahe Z. 1149-1170):
```js
      var lsHint = null, lsHintBand = null, lsHintMark = null, lsHintLabel2 = null;
      if (vCfg.body.slider && vCfg.body.slider.lsHint !== false) {
        lsHint = _mkEl('div', 'ls-hint');
        lsHint.style.display = 'none';
        lsHintBand = _mkEl('div', 'ls-hint-band');
        lsHintMark = _mkEl('div', 'ls-hint-mark');
        lsHintLabel2 = _mkEl('div', 'ls-hint-label');
        lsHint.append(lsHintBand, lsHintMark, lsHintLabel2);
        slWrap.appendChild(lsHint);
      }
```

**Direkt darunter** ergänzen:
```js
      // BA 206: Slider Round — Min/Max-Bereich + Median-Dreieck (eigene Klassen,
      // damit nicht mit der LV-LS-Hint-Geometrie kollidiert).
      var rangeHint = null, rangeHintBand = null, rangeHintMark = null, rangeHintLabel = null;
      if (vCfg.body.slider && vCfg.body.slider.rangeHint) {
        rangeHint = _mkEl('div', 'fm-range-hint');
        rangeHint.style.display = 'none';
        rangeHintBand  = _mkEl('div', 'fm-range-hint-band');
        rangeHintMark  = _mkEl('div', 'fm-range-hint-mark');
        rangeHintLabel = _mkEl('div', 'fm-range-hint-label');
        rangeHint.append(rangeHintBand, rangeHintMark, rangeHintLabel);
        slWrap.appendChild(rangeHint);
      }
```

In der refs-Rückgabe (Z. 1169) **ergänzen**:
```js
        lsHint: lsHint, lsHintBand: lsHintBand, lsHintMark: lsHintMark, lsHintLabel: lsHintLabel2,
        rangeHint: rangeHint, rangeHintBand: rangeHintBand,        // BA 206
        rangeHintMark: rangeHintMark, rangeHintLabel: rangeHintLabel, // BA 206
```

In `freqmatch.js` im `slider`-Verfahren-Body (Z. 1013) das Slider-Konfigurationsobjekt ergänzen:
```js
          slider:        { unit: 'cent', initialRange: 100, maxRange: 1200, touchStep: 5, touchFineStep: 1, rangeHint: true },
```

**Hinweis Sonnet**: prüfen, ob es im testUI noch eine zweite Slider-Definitions-Stelle (Z. 492-498) gibt, die für andere Tests verwendet wird — dort NICHT eingreifen, das Range-Hint-Element ist ausschließlich für das Slider-Round-Verfahren bestimmt.

---

## 8. Schritt 5 — `style.css`: Range-Hint-Optik

In `style.css` (passende Stelle: in der Nähe der bestehenden `.ls-hint`-Regeln) ergänzen:

```css
/* BA 206: Slider Round — Bereich (Min..Max) + Median-Dreieck unter dem Slider. */
.fm-range-hint {
  position: relative;
  height: 18px;
  margin-top: 2px;
}
.fm-range-hint-band {
  position: absolute;
  top: 6px;
  height: 6px;
  background: rgba(60, 130, 220, 0.25);
  border-radius: 3px;
  pointer-events: none;
}
.fm-range-hint-mark {
  position: absolute;
  top: 2px;
  width: 0; height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 10px solid rgba(60, 130, 220, 0.9);
  transform: translateX(-6px);
  pointer-events: none;
}
.fm-range-hint-label {
  position: absolute;
  top: 12px;
  transform: translateX(-50%);
  font-size: 11px;
  color: rgba(60, 130, 220, 0.95);
  pointer-events: none;
  white-space: nowrap;
}
```

Falls die LV-LS-Hint-Regeln in einer anderen CSS-Datei liegen (Sonnet: per `grep` `.ls-hint` finden), das Snippet dort ergänzen.

---

## 9. Schritt 6 — `freqmatch.js`: Verfahren-Config und Pause-Button

Im Slider-Verfahren-Body (Z. 1008-1023) das `actions`-Array um `'pause'` ergänzen, damit testUI einen Pause-Button rendert, und den Hook in `hooks` mitgeben:

**Vorher** (Z. 1016, Z. 1024):
```js
          actions:       ['undo', 'replay', 'simul'],
          statusGrid:    { show: true },
          ...
        hooks: {
          onStart:    fmStartSlider,
          onStop:     fmAbort,
          ...
```

**Nachher**:
```js
          actions:       ['undo', 'replay', 'simul', 'pause'],
          statusGrid:    { show: true },
          ...
        hooks: {
          onStart:    fmStartSlider,
          onStop:     fmAbort,
          onPause:    fmPauseSlider,
          ...
```

In `js/test-ui.js` prüfen, ob `'pause'` als Action bereits gerendert wird; wenn nicht, in der `actions`-Verarbeitung (suchen nach `actions.forEach` oder einem Switch über die Action-IDs) einen `'pause'`-Zweig ergänzen, der einen Button erzeugt mit `data-t="btnPauseTest"` und `cfg.hooks.onPause` als Click-Listener. Format: gleiches Muster wie die anderen Actions, kein Sonderfall.

**Außerdem in `freqmatch.js`**: Die Labels umbenennen, damit das Verfahren in der UI als „Slider Round" auftaucht. Die Funktion `fmUpdateSliderModeAvail` (Z. 905-909) sperrte bisher das Slider-Verfahren, wenn schon adaptive Antworten vorlagen — diese Sperre **entfernen** (Slider Round darf parallel zu adaptiven Daten existieren):

**Suchen** (Z. 905-909):
```js
  testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', !hasAnswers,
                          { reason: 'fmAdaptiveExists' });
  if (hasAnswers && fmVerfahren === 'slider' && !fmRunning) {
    fmSetVerfahren('adaptive', { force: true });
  }
```

**Ersetzen durch**:
```js
  // BA 206: Slider Round kann parallel zu adaptiven Daten weiterlaufen
  // (war früher gesperrt, weil Slider nur Vor-Schätzung war).
  testUI.field.setEnabled(fmEls, 'verfahrenSelect.slider', true, {});
```

---

## 10. Schritt 7 — `results.js`: Löschbuttons anpassen

In `js/results.js` die drei Lösch-Handler (Z. 776-833) so anpassen, daß `sliderRoundRun` korrekt mit aufgeräumt wird.

**`fmrClearAllBtn`** (Z. 785-796) — unverändert lassen, weil dort `freqmatchAdaptive = null` gesetzt wird; das löscht automatisch auch `sliderRoundRun`.

**`fmrClearSliderBtn`** (Z. 798-813) — beim Löschen der Slider-Werte muß auch `sliderRoundRun` zurückgesetzt werden:

**Vorher** (Z. 805-810):
```js
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates) fa.sliderEstimates = {};
        });
      }
```

**Nachher**:
```js
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (!fa) return;
          if (fa.sliderEstimates) fa.sliderEstimates = {};
          fa.sliderRoundRun = null;   // BA 206: Lauf-Stand mit löschen
        });
      }
```

**`fmrClearAdaptiveBtn`** (Z. 815-832) — unverändert lassen; löscht nur `runs[]` und `currentRunIdx`, läßt `sliderEstimates` und `sliderRoundRun` in Ruhe.

---

## 11. Schritt 8 — `file.js`: `resetAll` ergänzen

In `js/file.js` der Funktion `resetAll()` (Z. 20-…) — `freqmatchAdaptive` wird heute über `initSideData` indirekt zurückgesetzt (Z. 38, ruft state-side.js Z. 114 `s.freqmatchAdaptive = null`). Damit sind sliderEstimates und sliderRoundRun automatisch weg. **Kein Edit nötig**, aber Sonnet verifiziert per Re-Lese, daß `initSideData` tatsächlich `s.freqmatchAdaptive = null` setzt (state-side.js Z. 114).

---

## 12. Schritt 9 — i18n: deutsche Strings

In `i18n/de.js` folgende Strings ergänzen / ändern. Konsequent ASCII-`"` als String-Begrenzer, **keine** typografischen `„"` in Snippets.

**Ändern** (vorhandene Keys, mit den heutigen Werten überschreiben):
```js
    fmModeSlider:          "Slider Round",
    fmExplainSlider:       "Slider Round mißt jede Elektrode in beliebig vielen Runden. Pro Runde kommt jede aktive Elektrode in zufälliger Reihenfolge einmal dran; der Test endet nicht von selbst, sondern wird per Pause-Knopf unterbrochen. Aus allen Runden wird pro Elektrode ein Aggregat-Wert (Median ab 3 Werten, sonst Mittelwert oder Einzelwert) berechnet — diesen Wert sieht man als Dreieck unter dem Slider und im Ergebnis-Diagramm.",
    fmSliderInstruction:   "Passen Sie den Slider an, bis sich beide Töne gleich hoch anhören, dann bestätigen. Nach jeder Runde startet der Test automatisch die nächste mit neuer zufälliger Reihenfolge.",
    fmExplainSliderScience:"Mehrere Runden mit Median-Aggregation reduzieren den Einfluß einzelner subjektiver Fehl-Einschätzungen. Der Balken unter dem Slider zeigt die Spannweite aller bisherigen Messungen einer Elektrode (Min..Max); das Dreieck markiert den Median.<br><br>Slider Round ist kein wissenschaftlich abgesichertes Mess-Verfahren, liefert aber durch die Wiederholung deutlich stabilere Werte als ein einmaliger Schieb-Vorgang.",
    fmrClearSliderBtnLabel:"🗑 Nur Slider-Round-Werte löschen",
    fmrClearSliderConfirm: "Slider-Round-Werte (alle Runden) löschen?",
```

**Neu** (am sinnvollen Block-Ende einfügen):
```js
    fmSliderRoundProgress: "Runde %R · Elektrode %C von %T",
    fmSliderRoundColEl:    "Elektrode",
    fmSliderRoundColStartHz:"Startfreq (Hz)",
    fmSliderRoundColCount: "Anzahl Werte",
    fmSliderRoundColRange: "Bereich (Cent)",
    fmSliderRoundColAgg:   "Aktuelle Schätzung",
    fmSliderRoundColAggHz: "Schätzung (Hz)",
    fmSliderRoundColStatus:"Status",
    btnPauseTest:          "Test pausieren",
```

---

## 13. Schritt 10 — i18n: en, fr, es

**Wichtig**: dieselben Keys, die in Schritt 9 in `de.js` geändert/neu sind, müssen in `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` ebenfalls geändert/neu gesetzt werden. Bei vorhandenen Keys den alten Wert mit der neuen Übersetzung **überschreiben** (kein Rückfall auf Deutsch). Konsequent ASCII-`"` als Begrenzer.

**en.js** (gleiche Keys):
```js
    fmModeSlider:          "Slider Round",
    fmExplainSlider:       "Slider Round measures every electrode in any number of rounds. Each round runs through all active electrodes once in random order; the test never ends by itself but is paused manually. From all rounds, an aggregate value per electrode (median for 3+ readings, otherwise mean or single value) is computed — the triangle below the slider and the result chart show that value.",
    fmSliderInstruction:   "Adjust the slider until both tones sound equally high, then confirm. After each round the test automatically starts the next round with a new random order.",
    fmExplainSliderScience:"Several rounds with median aggregation reduce the impact of single subjective misjudgements. The bar below the slider shows the range of all readings for the current electrode (min..max); the triangle marks the median.<br><br>Slider Round is not a scientifically validated measurement, but the repetition yields markedly more stable values than a single slider pass.",
    fmrClearSliderBtnLabel:"🗑 Delete Slider-Round values only",
    fmrClearSliderConfirm: "Delete Slider-Round values (all rounds)?",
    fmSliderRoundProgress: "Round %R · Electrode %C of %T",
    fmSliderRoundColEl:    "Electrode",
    fmSliderRoundColStartHz:"Start freq (Hz)",
    fmSliderRoundColCount: "Reading count",
    fmSliderRoundColRange: "Range (cent)",
    fmSliderRoundColAgg:   "Current estimate",
    fmSliderRoundColAggHz: "Estimate (Hz)",
    fmSliderRoundColStatus:"Status",
    btnPauseTest:          "Pause test",
```

**fr.js**:
```js
    fmModeSlider:          "Slider Round",
    fmExplainSlider:       "Slider Round mesure chaque électrode sur un nombre quelconque de tours. À chaque tour, toutes les électrodes actives sont parcourues une fois dans un ordre aléatoire ; le test ne s'arrête jamais de lui-même et doit être mis en pause manuellement. Une valeur agrégée par électrode est calculée à partir de tous les tours (médiane à partir de 3 valeurs, sinon moyenne ou valeur unique) — c'est cette valeur qui apparaît comme triangle sous le curseur et dans le graphique de résultats.",
    fmSliderInstruction:   "Ajustez le curseur jusqu'à ce que les deux sons aient la même hauteur, puis confirmez. Après chaque tour, le test démarre automatiquement le tour suivant avec un nouvel ordre aléatoire.",
    fmExplainSliderScience:"Plusieurs tours combinés à une agrégation médiane réduisent l'effet des erreurs subjectives ponctuelles. La barre sous le curseur indique l'amplitude de toutes les mesures de l'électrode courante (min..max) ; le triangle marque la médiane.<br><br>Slider Round n'est pas un protocole de mesure scientifiquement validé, mais la répétition fournit des valeurs nettement plus stables qu'un passage unique du curseur.",
    fmrClearSliderBtnLabel:"🗑 Supprimer uniquement les valeurs Slider Round",
    fmrClearSliderConfirm: "Supprimer les valeurs Slider Round (tous les tours) ?",
    fmSliderRoundProgress: "Tour %R · Électrode %C sur %T",
    fmSliderRoundColEl:    "Électrode",
    fmSliderRoundColStartHz:"Fréq. initiale (Hz)",
    fmSliderRoundColCount: "Nb de mesures",
    fmSliderRoundColRange: "Plage (cent)",
    fmSliderRoundColAgg:   "Estimation actuelle",
    fmSliderRoundColAggHz: "Estimation (Hz)",
    fmSliderRoundColStatus:"Statut",
    btnPauseTest:          "Mettre en pause",
```

**es.js**:
```js
    fmModeSlider:          "Slider Round",
    fmExplainSlider:       "Slider Round mide cada electrodo en cualquier número de rondas. En cada ronda se recorren todos los electrodos activos una vez en orden aleatorio; el test no termina por sí solo, sino que se pausa manualmente. A partir de todas las rondas se calcula un valor agregado por electrodo (mediana a partir de 3 valores, en otro caso media o valor único) — ese valor aparece como triángulo bajo el deslizador y en el gráfico de resultados.",
    fmSliderInstruction:   "Ajuste el deslizador hasta que ambos tonos suenen igual de altos, luego confirme. Tras cada ronda, el test inicia automáticamente la siguiente con un nuevo orden aleatorio.",
    fmExplainSliderScience:"Varias rondas con agregación por mediana reducen el impacto de juicios subjetivos puntuales. La barra bajo el deslizador muestra el rango de todas las mediciones del electrodo actual (mín..máx); el triángulo marca la mediana.<br><br>Slider Round no es un protocolo científicamente validado, pero la repetición proporciona valores claramente más estables que un único pase del deslizador.",
    fmrClearSliderBtnLabel:"🗑 Borrar solo valores Slider Round",
    fmrClearSliderConfirm: "¿Borrar valores Slider Round (todas las rondas)?",
    fmSliderRoundProgress: "Ronda %R · Electrodo %C de %T",
    fmSliderRoundColEl:    "Electrodo",
    fmSliderRoundColStartHz:"Frec. inicial (Hz)",
    fmSliderRoundColCount: "Nº de mediciones",
    fmSliderRoundColRange: "Rango (cent)",
    fmSliderRoundColAgg:   "Estimación actual",
    fmSliderRoundColAggHz: "Estimación (Hz)",
    fmSliderRoundColStatus:"Estado",
    btnPauseTest:          "Pausar prueba",
```

**Sonnet-Selbst-Check für i18n-Strings** (siehe Leitlinien Z. 180-186): Vor Versand jeden String einmal auf reine `"`-Zähl-Konsistenz prüfen, **keine** typografischen `„"` in Werten verwenden.

---

## 14. Schritt 11 — `docs/spec/02-messung.md` und `docs/CODESTRUKTUR.md` aktualisieren

**`docs/spec/02-messung.md`**: Im Abschnitt „Sub-Tab 3 — Frequenzabgleich" den Modus-Schalter-Absatz (Z. 244-250) so anpassen, daß „Slider" durch „Slider Round" ersetzt wird und kurz beschrieben ist: Mehrfach-Runden, Pause/Resume, Min/Max-Balken + Median-Dreieck unter dem Slider, Aggregat-Wert = Pfeil-Wert im Ergebnis-Diagramm.

**`docs/CODESTRUKTUR.md`**: Die Beschreibung von `freqmatch-slider.js` aktualisieren (neuer Verfahrens-Name + Run-Steuerung in `sliderRoundRun`).

Keine Spec-Großoperation, nur die Stelle, an der heute „Slider-Verfahren" steht.

---

## 15. Akzeptanztest (vom Nutzer durchführbar)

Nach dem Bau im Browser durchgehen:

1. **Reload mit Cache-Bust** (Strg+F5). Versionsnummer unten zeigt `3.2.206-beta`. — *Ohne Bump bleibt der Cache hängen.*
2. **Tab Messungen → Frequenzabgleich**: Im Verfahren-Dropdown steht „Slider Round" (statt „Vor-Schätzung (Slider)"). — *Beweis: Renaming greift.*
3. **Verfahren „Slider Round" wählen, Start klicken**: nach dem Seitenhörtest erscheint der Slider, oben steht „Runde 1 · Elektrode 1 von N". — *Beweis: Runden-Anzeige funktioniert, N = Anzahl aktiver Elektroden.*
4. **Slider verschieben, Bestätigen**: Anzeige springt auf „Runde 1 · Elektrode 2 von N", andere Elektrode dran (Reihenfolge zufällig, nicht aufsteigend nach Frequenz). — *Beweis: Random-Reihenfolge.*
5. Alle Elektroden in Runde 1 bestätigen: Anzeige springt automatisch auf „Runde 2 · Elektrode 1 von N" mit neuer zufälliger Reihenfolge. — *Beweis: nahtloser Übergang in nächste Runde.*
6. **Runde 2 für die erste Elektrode**: Slider startet auf dem Wert, den die Elektrode in Runde 1 bekommen hat. Unter dem Slider: ein Dreieck (kein Balken), Label „±X.X ct". — *Beweis: Startwert = letzter Messwert, Dreieck zeigt Einzelwert.*
7. Eine Elektrode in Runde 2 bestätigen, in Runde 3 wieder anstauchen: unter dem Slider Balken + Dreieck. Dreieck sitzt auf Mittelwert der zwei Werte. — *Beweis: 2 Werte → Mean.*
8. Eine Elektrode in 3 Runden bestätigen → 3 Werte: Dreieck sitzt auf Median (mittlerer von drei Werten). — *Beweis: ≥3 → Median.*
9. **Pause-Knopf**: drückbar, Test stoppt, Voreinstellungen werden wieder bedienbar, Werte bleiben erhalten. — *Beweis: Pause funktioniert.*
10. **Start erneut klicken**: nach Seitenhörtest geht es bei der nächsten noch nicht gemessenen Elektrode derselben Runde weiter. Runden-Nummer und Reihenfolge der noch ausstehenden Elektroden sind erhalten. — *Beweis: Resume funktioniert.*
11. **Tab Messergebnisse → Frequenzabgleich**: Pfeile für gemessene Elektroden sind sichtbar. Der Pfeil-Endwert pro Elektrode entspricht dem Aggregat (Dreieck-Wert) aus dem Slider-Round-Status-Grid. — *Beweis: aggregierter Wert landet im Ergebnis-Diagramm.*
12. **Knopf „🗑 Nur Slider-Round-Werte löschen"**: löscht alle Slider-Round-Daten (alle Runden), läßt adaptive Daten unberührt. — *Beweis: Lösch-Knopf gezielt.*
13. **Knopf „🗑 Alles löschen"**: löscht beides. — *Beweis: Komplett-Reset.*
14. **JSON-Save + Reload + JSON-Load** (mit einer Datei, die noch alte Slider-Einzelwerte enthält): nach Load steht im Slider-Round-Status-Grid für jede migrierte Elektrode Anzahl Werte = 1, Status = ✓ (1). Nächster Test-Start beginnt mit Runde 2. — *Beweis: Migration alter Stände.*
15. **Modus auf „Adaptiv" wechseln, Adaptiv-Daten löschen, zurück auf „Slider Round"**: Slider-Round-Werte sind noch da. — *Beweis: Adaptiv-Löschen schont Slider Round.*
16. **Sprachumschaltung auf EN / FR / ES**: alle in Schritt 9/10 geänderten Strings sind übersetzt. — *Beweis: i18n vollständig.*
17. **Browser-Konsole**: keine roten Fehler (insbesondere keine `Uncaught SyntaxError`, kein `Uncaught TypeError: ... is not a function`). — *Beweis: keine Syntax/Reference-Bugs.*

---

## 16. Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede Akzeptanz-Kriterie (1-17) einzeln durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**, jeweils mit Datei- und Zeilenangabe der relevanten Code-Stelle. Wenn ein Punkt als „unklar" markiert ist, **vor** der Fertig-Meldung beim Nutzer rückfragen, nicht stillschweigend annehmen.

Zusätzlich gegen die vier Fallen aus den Leitlinien (Z. 156-195) prüfen:
- **State-Mutation vs. Reassignment**: `sliderEstimates`-Objekt-Properties werden konsequent in-place mutiert, kein Reassignment des Aufrufer-Objekts.
- **Edge-Cases**: Was passiert bei 0 aktiven Elektroden zur Lauf-Zeit, bei Wechsel der Referenzseite mit existierendem `sliderRoundRun` (wird verworfen → neuer Lauf), bei `_fmShuffle` mit leerem Array (liefert leeres Array)?
- **Anführungszeichen in i18n-Strings**: nur ASCII-`"` als String-Begrenzer, keine inneren `"` ohne `\"`-Escape.
- **Zwei Schwellen = zwei Konstanten**: hier nur eine Schwelle (Median ab 3 Werten); die „2 → Mean"-Regel ist im selben Helfer `_fmAggregateCent`.

Wenn die Selbstprüfung sauber durchläuft und der Nutzer den Akzeptanztest abgenommen hat: `docs/spec/02-messung.md` und `docs/CODESTRUKTUR.md` finalisiert speichern, Versionsbump fixiert, Fertig.

---

## 17. Folge-BA (nicht zwingend)

— keine, weil i18n in dieser BA bereits mitgezogen wird. Falls in der Praxis Texte umformuliert werden, wandert das in eine kleine Mini-BA.
