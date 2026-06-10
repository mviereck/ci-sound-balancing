# Bauanleitung 76 — Frequenzabgleich adaptiv: Pause / Resume

## Ziel

Fünfte Anleitung der 02b-Reihe. Persistiert den vollständigen
Track-State des laufenden adaptiven Tests in
`sideData[varSide].freqmatchAdaptive`, so daß:

- Ein per **Stop** (oder Esc) abgebrochener Lauf beim nächsten
  „Test starten" **nahtlos fortgesetzt** wird.
- Ein Page-Reload mitten im Test denselben State wiederherstellt.
- Ein fertiger Lauf (`completedAt != null`) beim nächsten Start
  einen frischen Lauf erzeugt.
- Ein Wechsel der Referenzseite den alten Lauf verwirft.

**Voraussetzungen**: Bauanleitungen 72–75 sind umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.76-beta";
```

---

## 2. Storage-Schema in `sideData`

In `js/state-side.js`, an der Stelle, an der die `sideData`-
Defaults definiert werden (Sonnet sucht via
`grep -n "fmMode\|fmAdaptiveDur" js/state-side.js` — diese
Felder wurden in 02b/2 ergänzt; das neue Feld kommt direkt
daneben):

```js
freqmatchAdaptive: null,   // Lauf-State, siehe Bauanleitung 02b/5
```

Struktur (wenn nicht null):

```js
{
  varSide:     'left' | 'right',   // zur Konsistenz-Prüfung
  refSide:     'left' | 'right',
  startedAt:   timestamp,
  completedAt: timestamp | null,
  electrodeIdxList: [number, ...], // Reihenfolge wie fmBuildSeq() beim Start
  tracks: {
    [electrodeIdx]: <komplettes Track-Objekt aus fmCreateTrack()>
  }
}
```

`completedAt === null` bedeutet: Lauf läuft noch / ist pausiert.
`completedAt > 0` bedeutet: Lauf ist fertig — nächster Start
erzeugt frische Tracks.

---

## 3. Persist + Restore in `freqmatch.js`

Neue Funktionen, vor `fmStartAdaptive()` einfügen:

```js
// --- Persistenz (Bauanleitung 02b/5) ---

function _fmPersist() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  const ids = Object.keys(fmTracks).map(function(k) { return parseInt(k, 10); });
  sideData[fmVarSide].freqmatchAdaptive = {
    varSide:          fmVarSide,
    refSide:          fmRefSide,
    startedAt:        (sideData[fmVarSide].freqmatchAdaptive
                       && sideData[fmVarSide].freqmatchAdaptive.startedAt) || Date.now(),
    completedAt:      null,
    electrodeIdxList: ids.slice().sort(function(a, b) {
      const fa = withSide(fmVarSide, function() { return effFreq(a); });
      const fb = withSide(fmVarSide, function() { return effFreq(b); });
      return fa - fb;
    }),
    tracks:           fmTracks    // Direkt — fmCreateTrack-Objekte sind JSON-safe
  };
}

function _fmMarkCompleted() {
  if (!fmVarSide || !sideData[fmVarSide]) return;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (fa) fa.completedAt = Date.now();
}

function _fmClearPersist(side) {
  side = side || fmVarSide;
  if (side && sideData[side]) sideData[side].freqmatchAdaptive = null;
}

// Versucht, einen pausierten Lauf zu laden.
// returns: true wenn erfolgreich (fmTracks ist befüllt, Lauf fortsetzbar)
//          false sonst (neu starten)
function _fmTryRestore(currentElIdxList) {
  if (!sideData[fmVarSide]) return false;
  const fa = sideData[fmVarSide].freqmatchAdaptive;
  if (!fa) return false;
  if (fa.completedAt != null) return false;
  if (fa.varSide !== fmVarSide || fa.refSide !== fmRefSide) return false;
  if (!fa.tracks) return false;

  // Elektroden-Liste muß übereinstimmen
  const saved = (fa.electrodeIdxList || []).slice().sort(function(a, b) { return a - b; });
  const now   = currentElIdxList.slice().sort(function(a, b) { return a - b; });
  if (saved.length !== now.length) return false;
  for (let i = 0; i < saved.length; i++) if (saved[i] !== now[i]) return false;

  // Mindestens ein Track muß noch active sein
  const hasActive = Object.keys(fa.tracks).some(function(k) {
    return fa.tracks[k].status === 'active';
  });
  if (!hasActive) return false;

  fmTracks = fa.tracks;
  return true;
}
```

---

## 4. `fmStartAdaptive()` um Resume erweitern

In `js/freqmatch.js`, `fmStartAdaptive()` aus 02b/4 — den
Tracks-Erzeugungs-Block ersetzen.

**Vorher**:

```js
fmTracks = {};
elIdxList.forEach(function(idx) {
  const prev = fmPrevCent(idx);
  const prevOrNull = (prev !== 0) ? prev : null;
  fmTracks[idx] = fmCreateTrack(idx, prevOrNull);
});
```

**Nachher**:

```js
if (_fmTryRestore(elIdxList)) {
  console.log('[freqmatch] Adaptiver Lauf fortgesetzt:',
              Object.keys(fmTracks).length, 'Tracks');
} else {
  fmTracks = {};
  elIdxList.forEach(function(idx) {
    const prev = fmPrevCent(idx);
    const prevOrNull = (prev !== 0) ? prev : null;
    fmTracks[idx] = fmCreateTrack(idx, prevOrNull);
  });
  _fmPersist();   // Initialer Stand speichern (startedAt setzen)
}
```

---

## 5. Persist-Aufrufe an den richtigen Stellen

### 5a) Nach jeder Antwort

In `fmHandleHeight()` aus 02b/4, NACH `fmApplyResponse(...)` und
NACH dem Konvergenz-Schreiben in `_fmWriteResult(track)`:

```js
function fmHandleHeight(userChoice) {
  if (!fmAdaptiveActive || !fmAwaitingResponse) return;
  fmAwaitingResponse = false;
  fmDisableHeightButtons();

  const response = _fmConvertHeight(userChoice, fmCurFirstSide);
  const track    = fmTracks[fmCurTrackId];

  fmApplyResponse(track, response, false, false, fmCurFirstSide);

  if (track.status === 'converged' || track.status === 'converged-noisy') {
    _fmWriteResult(track);
  }

  _fmPersist();          // <-- NEU: Autosave nach jedem Trial
  fmRenderStatusGrid();

  setTimeout(function() {
    if (fmAdaptiveActive) fmNextAdaptiveTrial();
  }, 200);
}
```

### 5b) Beim Stop / Abort

In `fmAbort()`, im Adaptiv-Zweig (aus 02b/4) VOR dem
`fmAdaptiveActive = false`:

```js
function fmAbort() {
  if (fmAdaptiveActive) {
    _fmPersist();        // <-- NEU: aktuellen Stand sichern (completedAt bleibt null)
    fmAdaptiveActive   = false;
    // ...rest unverändert...
  }
  // ...Slider-Abort unverändert...
}
```

### 5c) Beim Test-Ende

In `fmFinishAdaptive()`, am Anfang:

```js
function fmFinishAdaptive() {
  _fmMarkCompleted();    // <-- NEU: completedAt setzen
  fmAdaptiveActive   = false;
  // ...rest unverändert...
}
```

### 5d) Beim Wechsel der Referenzseite

In `js/freqmatch.js`, im bestehenden `refSelect.change`-Handler
(Z. 582 ff. heute) — der Block, der `fRes.splice(0, fRes.length)`
ausführt, wenn der User den Wechsel bestätigt:

```js
fmRCOkBtn.onclick = function() {
  fmRCDlg.hidden = true;
  fRes.splice(0, fRes.length);
  // <-- NEU: gespeicherten Adaptiv-Lauf BEIDER Seiten leeren
  _fmClearPersist('left');
  _fmClearPersist('right');
  _fmPrevRefVal = fmEls.refSelect.value;
};
```

---

## 6. Page-Reload: Tab-Hook erweitern

`fmLoadModeFromSide()` aus 02b/2 wird beim Tab-Eintritt und bei
Seitenwechsel aufgerufen. Diese Funktion lädt nur den Modus —
sie startet **nicht** den Test. Der gespeicherte adaptive Lauf
bleibt unangetastet im `sideData` und wird erst beim Klick auf
**Test starten** über `_fmTryRestore()` wieder aktiv.

Das ist gewollt: nach Page-Reload sieht der User die Voreinstellung,
klickt Start, und der Test setzt fort.

Sonnet prüft, daß `sideData` selbst seine üblichen Persistenz-
Mechanismen (`io.js` / `state-side.js`) hat. Wenn `sideData` über
einen Page-Reload hinweg nicht erhalten bleibt, ist Resume nach
Reload nicht möglich; das ist dann ein bestehendes Limit des
Projekts und keine Aufgabe dieser Anleitung. **Bitte prüfen
und rückfragen**, falls unklar.

---

## 7. Optional: Hinweis-Badge im Voreinstellungs-Block

Wenn ein pausierter Lauf vorliegt, soll der User wissen, daß
„Test starten" diesen fortsetzen wird (statt frisch zu beginnen).

In `js/freqmatch.js`, neue Funktion:

```js
function fmRefreshResumeHint() {
  if (!fmEls) return;
  const startBtn = fmEls.startBtn;
  if (!startBtn) return;
  const fa = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive) || null;
  const resumable = fa && fa.completedAt == null
    && Object.keys(fa.tracks || {}).some(function(k) { return fa.tracks[k].status === 'active'; });
  // Label vorübergehend ändern. Original-i18n-Key bleibt erhalten, nur Text wird ersetzt.
  if (resumable) {
    startBtn.textContent = (typeof t === 'function' && t('fmLblResume')) || 'Test fortsetzen';
  } else {
    startBtn.textContent = (typeof t === 'function' && t('fmLblStart')) || 'Test starten';
  }
}
```

Aufruf-Stellen:
- Im DOMContentLoaded am Ende, NACH `fmLoadModeFromSide()`:
  `fmRefreshResumeHint();`
- In `fmLoadModeFromSide()` am Ende: `fmRefreshResumeHint();`
- In `fmFinishAdaptive()` am Ende: `fmRefreshResumeHint();`
- In `fmAbort()` (beide Zweige) am Ende: `fmRefreshResumeHint();`

`fmLblResume` ist ein i18n-Key, der erst in 02b/8 belegt wird —
bis dahin greift der hartkodierte Fallback `'Test fortsetzen'`.

---

## 8. CODESTRUKTUR aktualisieren

In `docs/CODESTRUKTUR.md`, Zeile für `freqmatch.js`:

Neue Funktionen ergänzen:
- `_fmPersist`, `_fmMarkCompleted`, `_fmClearPersist`,
  `_fmTryRestore`, `fmRefreshResumeHint`

Neue `sideData[side]`-Felder ergänzen:
- `freqmatchAdaptive` (Objekt mit Lauf-State, siehe Schema oben)

---

## Akzeptanztest

1. Browser hart neu laden (Strg-F5). Footer zeigt `3.0.76-beta`.
2. Tab **Messungen** → Sub-Tab **Frequenzabgleich**, Modus
   `adaptive`. Start-Button zeigt „Test starten".
3. **Test starten**. ~10–20 Trials antworten (manuell oder per
   Konsolen-Helfer aus 02b/4).
4. **Esc** (Stop) → Test bricht ab. Test-Block schließt.
5. Start-Button zeigt nun **„Test fortsetzen"**.
6. Konsole: `console.log(sideData[fmVarSide].freqmatchAdaptive)`
   → Objekt mit `tracks`, `startedAt`, `completedAt: null` ist sichtbar.
7. **„Test fortsetzen"** klicken → Status-Grid öffnet sich mit
   den bisherigen Trial-Zahlen und Reversals (NICHT frisch bei 0).
   Konsole: `[freqmatch] Adaptiver Lauf fortgesetzt: N Tracks`.
8. Weitere Antworten geben → Trial-Zähler steigt korrekt.
9. **Page-Reload** während aktivem Lauf → Test-Block schließt
   sich automatisch (Test ist nach Reload nicht im laufenden
   Zustand). Start-Button zeigt „Test fortsetzen". Start klicken
   → Lauf wird mit dem letzten State fortgesetzt.
10. Wenn `sideData` zwischen Sessions nicht persistiert wird
    (was abhängig vom Projekt-Setup ist): Punkt 9 funktioniert
    nur, wenn der User vorher gespeichert / „Session sichern"
    geklickt hat. Sonnet prüft und meldet.
11. **Referenzseite wechseln** mit `fRes`-Bestätigung → alter
    adaptiver Lauf wird ebenfalls verworfen. Konsole:
    `sideData.left.freqmatchAdaptive` und `sideData.right.freqmatchAdaptive`
    sind beide `null`.
12. Test komplett durchspielen (alle Tracks konvergieren oder
    not-perceivable). Test-Block schließt automatisch. Start-Button
    zeigt wieder „Test starten" (nicht „Fortsetzen"). Konsole:
    `sideData[fmVarSide].freqmatchAdaptive.completedAt` ist eine
    Zahl, nicht null.
13. Erneut „Test starten" → frischer Lauf, alle Tracks Trial-Zähler 0.
14. **Slider-Modus weiterhin funktional**: Modus umschalten,
    Slider-Test durchspielen, Cent-Werte werden gespeichert.
15. Konsole frei von Fehlern.

---

## Selbstprüfungs-Auftrag an Sonnet

1. Akzeptanztest-Schritte einzeln durchgehen, melden.
2. Speziell prüfen:
   - Wird `freqmatchAdaptive` in `sideData` der **var-Seite** persistiert
     (nicht der ref-Seite)?
   - Bleibt `startedAt` über mehrere `_fmPersist()`-Aufrufe stabil
     (also Erst-Wert beibehalten, nicht jedesmal überschrieben)?
   - Wird der gespeicherte Lauf bei einer Elektroden-Listen-Änderung
     verworfen? (Test: Elektrode ausschließen, Test fortsetzen
     versuchen → erwartet: frischer Lauf, Konsole meldet keinen
     Resume.)
   - Greift Resume korrekt nach Page-Reload, **wenn `sideData`
     persistiert wird**? Wenn nicht persistiert: melden, ggf.
     bestehendes Projekt-Verhalten dokumentieren.
3. Edge-Case: Was passiert, wenn `_fmTryRestore` einen Lauf
   findet, in dem `fmCurTrackId` (= zuletzt gepickter Track) noch
   gespeichert wäre? Wir picken einfach neu — egal. Prüfen, daß
   der erste Trial nach Resume sauber durchläuft.

---

## Was diese Anleitung NICHT macht

- Keine Catch-Trials (kommt in 02b/6)
- Kein "not-perceivable"-Status (kommt in 02b/6)
- Keine Chart-Anpassung (kommt in 02b/7)
- Keine i18n-Strings für „Test fortsetzen" (kommt in 02b/8)
- Keine Änderung am Session-Save-Format (`io.js`) — die Felder
  fließen automatisch durch, sofern das Schema `sideData`-Felder
  generisch serialisiert. Sonnet prüft und meldet, falls explizite
  Aufnahme nötig ist.
