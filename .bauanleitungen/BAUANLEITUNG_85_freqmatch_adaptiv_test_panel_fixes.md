# Bauanleitung 85 — Frequenzabgleich adaptiv: Test-Panel-Fixes

Vier kleine Korrekturen aus dem Praxistest nach BA 84. Jeder Fix
ist isoliert, zusammen ergeben sie eine spürbare Verbesserung des
laufenden Tests.

## Version

```js
const APP_VERSION = "3.0.85-beta";
```

## Übersicht

| Fix | Datei(en) | Was |
|---|---|---|
| 1 | `style.css` | CSS-Regeln für `.progress-bar` / `.progress-fill` / `.progress-text` ergänzen (bisher unsichtbar). |
| 2 | (nur Akzeptanztest) | Diagnose-Hinweis: Bug „0 % trotz 36 Trials" ist beim Schnelldurchlauf erwartet, bei echtem Test mit wechselnden Antworten muß der Balken steigen. |
| 3 | `js/freqmatch.js` | In `fmPlayAdaptiveTrial` `playing`-Klasse auf `pairLeft`/`pairRight` setzen/entfernen, damit Ton 1 / Ton 2 visuell aufleuchten. |
| 4 | `js/freqmatch-staircase.js`, `js/freqmatch.js`, `js/results.js`, `style.css` | Match und Residuum auch für aktive Tracks im Status-Grid und Reiter anzeigen (vorläufig, kursiv). Konsolidiert die 2-vs-4-Schwellen-Inkonsistenz aus BA 84. |

---

## Fix 1 — CSS für Fortschrittsbalken

**Datei:** `style.css`

Direkt nach der bestehenden `.progress-label`-Regel (Z. ~296) einfügen:

```css
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 8px;
}
.progress-fill {
  height: 100%;
  width: 0%;
  background: var(--accent, #3b82f6);
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 0.85em;
  color: var(--text-muted);
  margin-top: 4px;
  text-align: center;
}
```

Wenn `--accent` nicht definiert ist, greift der Fallback `#3b82f6`
(gleiche Farbe wie der inline-styled Reiter-Balken). Kurz greppen:
`grep -n "^\s*--accent" style.css` — falls vorhanden, Fallback weg.

**Wirkung:** Der Fortschrittsbalken im Test-Panel ist jetzt sichtbar.
Sollte automatisch auch in anderen Tests (Lautstärke, Latency) wirken,
falls die denselben Container-Stil verwenden — kurz visuell prüfen,
ob das nicht regressiert. Bisher waren alle Test-Panel-Balken
unsichtbar; die Tests funktionierten trotzdem, daher unwahrscheinlich,
daß das woanders stört.

---

## Fix 3 — Ton 1 / Ton 2 aufleuchten lassen

**Datei:** `js/freqmatch.js`

In `fmPlayAdaptiveTrial` (Z. ~492-543) die `playing`-Klasse für
beide sequentiellen Töne setzen. Direkt vor jedem `playOne(...)`
die passende Seite einschalten, direkt danach wieder aus.

Ersetze den Block von `if (firstSide === 'ref')` bis vor
`fmIsPlay = false; isPlay = false;` (Z. ~527-539) durch:

```js
function setPlayingIndicator(which) {
  if (!fmEls) return;
  if (fmEls.pairLeft)  fmEls.pairLeft.classList.toggle('playing',  which === 'left');
  if (fmEls.pairRight) fmEls.pairRight.classList.toggle('playing', which === 'right');
}

if (firstSide === 'ref') {
  setPlayingIndicator('left');                     // Ton 1 = pairLeft
  await playOne(fmRefSide, refHz);
  setPlayingIndicator(null);
  if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
  await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
  if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
  setPlayingIndicator('right');                    // Ton 2 = pairRight
  await playOne(fmVarSide, varHz);
  setPlayingIndicator(null);
} else {
  setPlayingIndicator('left');
  await playOne(fmVarSide, varHz);
  setPlayingIndicator(null);
  if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
  await new Promise(function(r) { fmPlayTO = setTimeout(r, pau); });
  if (!fmAdaptiveActive) { fmIsPlay = false; isPlay = false; return; }
  setPlayingIndicator('right');
  await playOne(fmRefSide, refHz);
  setPlayingIndicator(null);
}
```

Falls beim vorzeitigen Abbruch (`!fmAdaptiveActive`) die Indikatoren
hängen bleiben würden: am Anfang von `fmDisableHeightButtons` und
am Ende von `fmFinishAdaptive` jeweils einmal `setPlayingIndicator(null)`
absetzen — als Sicherung.

CSS für `.playing` existiert bereits (wird im Slider-Modus genutzt).
Falls nicht: `grep -n "\.playing" style.css` prüfen; bei Fehlen eine
kurze Regel ergänzen:

```css
.tone-label-left.playing,
.tone-label-right.playing {
  background: var(--accent-light, #dbeafe);
  border-color: var(--accent, #3b82f6);
  color: var(--accent, #3b82f6);
  transition: background-color 0.15s ease, color 0.15s ease;
}
```

---

## Fix 4 — Zwischenstand-Anzeige im Status-Grid

Aktuell zeigt das Test-Panel-Status-Grid nur Endzustände in den
Spalten Match/Residuum/Status. Bei laufendem Test sieht der User
nur das ⏳-Icon und die Trial-Zahl — selbst nach 50 Trials mit
mehreren Umkehrungen tut sich optisch nichts. Diese Korrektur
zeigt für aktive Tracks vorläufige Match-/Residuum-Schätzungen
mit kursivem Style, analog zur Reiter-Anzeige.

Ein Nebeneffekt: die 2-vs-4-Schwellen-Inkonsistenz aus BA 84
(Schätzwert ab 2 Umkehrungen vs. Residuum ab 4) wird hier
behoben.

### 4a) Zwei klare Schwellen-Konstanten und eine pure Helper-Funktion

**Datei:** `js/freqmatch-staircase.js`

Am Ende der bestehenden Konstanten-Liste (nach `FM_NOT_PERC_MIN_TRIAL`,
Z. ~22) einfügen:

```js
// Vorläufige Zwischenstand-Schwellen (Bauanleitung 85).
// 2-vs-4-Trennung gemäß User-Entscheidung in den BA84-Klärungsfragen.
const FM_PROVISIONAL_MATCH_MIN = 2;  // ab so vielen Umkehrungen Schätz-Match
const FM_PROVISIONAL_RESID_MIN = 4;  // ab so vielen Umkehrungen Schätz-Residuum
```

Nach `fmTrackSummary` (am Ende der Datei) eine neue pure Funktion
ergänzen:

```js
// --- Vorläufige Schätzung für laufende Tracks (Bauanleitung 85) ---
//
// Liefert für einen Track die Schätzwerte, die im Status-Grid
// und im Ergebnis-Reiter vorläufig angezeigt werden sollen.
// Für nicht-aktive Tracks gibt es keine Vorläufigkeit; die Funktion
// liefert dann status = null und match/residual = null.
//
// Rückgabe:
//   {
//     status:   'in-progress'        // wenn ≥FM_PROVISIONAL_MATCH_MIN reversals
//             | 'in-progress-early'  // wenn <FM_PROVISIONAL_MATCH_MIN reversals
//             | null,                // wenn track.status !== 'active'
//     match:    centOffset | null,   // Mittel ALLER bisherigen reversals
//     residual: cents      | null,   // halbe Spanne ALLER bisherigen reversals,
//                                    // nur ab FM_PROVISIONAL_RESID_MIN
//     reversals: count,
//     trials:    count
//   }
function fmComputeProvisional(track) {
  const revCount = (track.reversals && track.reversals.length) || 0;
  const trials   = track.trialCount || 0;
  if (track.status !== 'active') {
    return { status: null, match: null, residual: null, reversals: revCount, trials: trials };
  }
  if (revCount < FM_PROVISIONAL_MATCH_MIN) {
    return { status: 'in-progress-early', match: null, residual: null,
             reversals: revCount, trials: trials };
  }
  // Match = Mittelwert aller bisherigen Umkehrungen
  let sum = 0;
  for (let i = 0; i < track.reversals.length; i++) sum += track.reversals[i];
  const match = sum / track.reversals.length;
  // Residuum nur ab Schwelle
  let residual = null;
  if (revCount >= FM_PROVISIONAL_RESID_MIN) {
    let max = -Infinity, min = Infinity;
    for (let i = 0; i < track.reversals.length; i++) {
      if (track.reversals[i] > max) max = track.reversals[i];
      if (track.reversals[i] < min) min = track.reversals[i];
    }
    residual = (max - min) / 2;
  }
  return { status: 'in-progress', match: match, residual: residual,
           reversals: revCount, trials: trials };
}
```

### 4b) Status-Grid um vorläufige Werte erweitern

**Datei:** `js/freqmatch.js`

In `fmRenderStatusGrid` (Z. ~676-739) die Match- und Residual-
Zellen so umbauen, daß sie auch bei aktiven Tracks ggf. einen
vorläufigen Wert mit kursivem Stil zeigen.

Ersetze den Block ab `let matchTxt = '—';` (Z. ~713) bis vor
`row.appendChild(_mkCell(String(track.trialCount)));` (Z. ~726)
durch:

```js
// Match / Residual: bei Endzustand fest, bei active vorläufig
const prov = (typeof fmComputeProvisional === 'function')
  ? fmComputeProvisional(track)
  : { status: null, match: null, residual: null };

let matchTxt = '—', matchProv = false;
if (track.match != null) {
  matchTxt = (track.match >= 0 ? '+' : '') + Math.round(track.match) + ' ct';
} else if (prov.match != null) {
  matchTxt = (prov.match >= 0 ? '+' : '') + Math.round(prov.match) + ' ct';
  matchProv = true;
}
const matchCell = _mkCell(matchTxt);
if (matchProv) matchCell.classList.add('fm-status-provisional');
row.appendChild(matchCell);

let residTxt = '—', residProv = false;
if (track.residual != null) {
  residTxt = '±' + Math.round(track.residual) + ' ct';
} else if (prov.residual != null) {
  residTxt = '±' + Math.round(prov.residual) + ' ct';
  residProv = true;
}
const residCell = _mkCell(residTxt);
if (residProv) residCell.classList.add('fm-status-provisional');
row.appendChild(residCell);
```

CSS für `.fm-status-provisional` in `style.css` ergänzen
(direkt nach den bestehenden `.fm-status-*`-Regeln; falls keine
existieren, am Ende der Datei):

```css
.fm-status-provisional {
  font-style: italic;
  color: #4b5563;
}
```

### 4c) Reiter-Anzeige auf dieselbe Helper-Funktion umstellen

**Datei:** `js/results.js`

Die in BA 84 eingeführte lokale Konstante und die handgestrickte
Logik in `_fmrBuildInProgressEntries` durch Aufrufe der neuen
pure Funktion ersetzen.

Ersetze die Konstante (Z. ~250):

```js
// alt:
const FMR_PROVISIONAL_REV_MIN = 4;

// neu: (Konstante entfällt — Schwellen kommen aus
// fmComputeProvisional in freqmatch-staircase.js)
```

In `_fmrBuildInProgressEntries` den Body ersetzen:

```js
function _fmrBuildInProgressEntries(side) {
  const out = [];
  const sd = sideData[side];
  if (!sd) return out;
  const fa = sd.freqmatchAdaptive;
  if (!fa || !fa.tracks) return out;
  const refSide = fa.refSide || (side === 'left' ? 'right' : 'left');

  Object.keys(fa.tracks).forEach(function(k) {
    const tr = fa.tracks[k];
    if (tr.status !== 'active') return;
    const elIdx = parseInt(k, 10);
    const varHz = withSide(side, function() { return effFreq(elIdx); });
    const prov  = fmComputeProvisional(tr);

    if (prov.status === 'in-progress') {
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz * Math.pow(2, prov.match / 1200),
        timestamp: Date.now(),
        fmStatus: 'in-progress',
        fmResidual: prov.residual,           // kann null sein (noch <4 Umkehrungen)
        fmTrialCount: prov.trials,
        fmReversals: prov.reversals,
        _provisional: true
      });
    } else {
      // in-progress-early: weniger als 2 Umkehrungen
      out.push({
        varSide: side, refSide: refSide, elIdx: elIdx,
        varFreq: varHz,
        refFreq: varHz,
        timestamp: Date.now(),
        fmStatus: 'in-progress-early',
        fmResidual: null,
        fmTrialCount: prov.trials,
        fmReversals: prov.reversals,
        _provisional: true
      });
    }
  });
  return out;
}
```

### 4d) Reiter-Anzeige: Residuum-Spalte darf bei `in-progress` ohne Residuum „—" zeigen

In `renderFreqMatchResults` (`js/results.js`), im Tabellen-Body für
`fmStatus === 'in-progress'`: aktuell wird `fmResidual` gelesen.
Da es jetzt auch bei `in-progress` `null` sein darf (2 ≤ Umkehrungen
< 4), den Residuum-Zellen-Code so anpassen, daß `null` zu „—" wird
(nicht zu „±0 ct"). Vermutlich liegt das schon korrekt vor — kurz
gegen-greppen:

```js
if (r.fmResidual == null) {
  residCell = "<span style=\"color:#9ca3af\">—</span>";
} else {
  // ... bestehender Ampel-Code ...
}
```

Falls die `null`-Pruefung dort fehlt: ergänzen.

### 4e) Chart-Anzeige analog

**Datei:** `js/chart.js`

Im `drawFreqMatchChart`-Block für `el.fmStatus === 'in-progress'`
prüft heute `el.fmResidual > 0`, um das Restunsicherheits-Band zu
zeichnen. Das ist robust gegen `null` (kein Band). Ohne Änderung.

Nur sicherstellen: ein in-progress-Track ohne Residuum (2 ≤ Umkehrungen
< 4) bekommt trotzdem den hohlen blauen Kreis ohne Band. Schnell-
prüfung im Snippet aus BA 84: der `if (el.fmStatus === 'in-progress')`-
Zweig zeichnet den Kreis unabhängig vom Residuum — korrekt, keine
Änderung nötig.

---

## Bug 2 — Diagnose-Notiz, kein Code-Fix

Die Beobachtung „0 / 12 (36 trials, 0 %)" beim Schnelldurchlauf ist
formelgemäß korrekt: `fmComputeProgressStats` rechnet
`min(reversals.length / 6, 0.95)` pro aktivem Track. Bei zufälligem
Klick-Verhalten ohne wirkliches Hören entstehen wenige bis gar keine
Umkehrungen → Beitrag 0.

Wenn nach Fix 1 (Balken sichtbar) und Fix 4 (Grid zeigt Zwischenstände)
bei einem **echten** Test mit hörgenau wechselnden Antworten der Balken
immer noch 0 % anzeigt, *obwohl* einzelne Tracks im Grid Match-Werte
zeigen → dann liegt ein echter Bug in der Stats-Funktion oder der
Persistenz-Rückübertragung. Erst dann nachgehen, nicht spekulativ
ändern.

Im Akzeptanztest unten ist dafür ein expliziter Prüfschritt.

---

## Bau-Diagnose-Test

**Datei:** `js/debug-tests-current.js`

Einen Test für die zwei Schwellen registrieren (ist pure, ohne DOM,
schnell und stabil):

```js
/* Bauanleitung 85 — fmComputeProvisional-Schwellen */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;
  if (typeof fmComputeProvisional !== 'function') return;

  dbg.test(
    'build/BA85/provisional-schwellen',
    { tab: 'messungen', label: 'BA85 · Provisional-Schwellen (Match ab 2, Residual ab 4)' },
    function () {
      const mk = function (revCount, status) {
        const reversals = [];
        for (let i = 0; i < revCount; i++) reversals.push(i * 10 - revCount * 5);
        return { status: status || 'active', reversals: reversals, trialCount: revCount * 2 + 1 };
      };
      const cases = [
        { name: '0 revs',  track: mk(0), wantStatus: 'in-progress-early', wantMatch: false, wantResid: false },
        { name: '1 rev',   track: mk(1), wantStatus: 'in-progress-early', wantMatch: false, wantResid: false },
        { name: '2 revs',  track: mk(2), wantStatus: 'in-progress',       wantMatch: true,  wantResid: false },
        { name: '3 revs',  track: mk(3), wantStatus: 'in-progress',       wantMatch: true,  wantResid: false },
        { name: '4 revs',  track: mk(4), wantStatus: 'in-progress',       wantMatch: true,  wantResid: true  },
        { name: '6 revs',  track: mk(6), wantStatus: 'in-progress',       wantMatch: true,  wantResid: true  },
        { name: 'converged ignoriert', track: mk(6, 'converged'), wantStatus: null, wantMatch: false, wantResid: false }
      ];
      const fails = [];
      for (const c of cases) {
        const p = fmComputeProvisional(c.track);
        if (p.status !== c.wantStatus) {
          fails.push(c.name + ': status=' + p.status + ' (erwartet ' + c.wantStatus + ')');
          continue;
        }
        if (c.wantMatch && p.match == null) fails.push(c.name + ': match=null, erwartet Zahl');
        if (!c.wantMatch && p.match != null) fails.push(c.name + ': match=' + p.match + ', erwartet null');
        if (c.wantResid && p.residual == null) fails.push(c.name + ': residual=null, erwartet Zahl');
        if (!c.wantResid && p.residual != null) fails.push(c.name + ': residual=' + p.residual + ', erwartet null');
      }
      if (fails.length) return { ok: false, msg: fails.join(' · ') };
      return { ok: true, msg: cases.length + ' Schwellen-Fälle korrekt' };
    }
  );
})();
```

---

## Spec-Update

**Datei:** `docs/spec/02b-freqmatch-adaptiv.md`

Im Abschnitt „Anzeige im Reiter Meßergebnisse → Frequenzabgleich"
(aus BA 84) die Schwellen klarstellen und einen Hinweis ergänzen,
daß dieselbe Logik im Test-Panel-Status-Grid greift:

```
Vorläufige Zwischenstände werden in zwei Stufen angezeigt:

- **<2 Umkehrungen** (`in-progress-early`): kein Schätzwert.
  Status-Badge „läuft · N Trials". Zahlen-Spalten leer. Im Chart:
  hohler blauer Kreis am Ist-Strich mit „?".
- **≥2 Umkehrungen** (`in-progress`): vorläufiger Match = Mittel
  aller bisherigen Umkehrungen. Residuum erst **ab 4 Umkehrungen**
  (halbe Spanne aller bisherigen Umkehrungen). Status-Badge
  „in Arbeit · M Umkehrungen". Match-Spalte gefüllt; Residuum-Spalte
  bei 2-3 Umkehrungen leer. Im Chart: hohler blauer Kreis an
  geschätzter Soll-Position, Restunsicherheits-Band nur ab 4 Umkehrungen.

Dieselbe Logik wird auch im Status-Grid des Test-Panels verwendet,
sodass der User während des Tests sieht, wie sich Match und Residuum
entwickeln. Im Test-Panel werden die vorläufigen Werte kursiv und
in gedämpfter Farbe dargestellt.
```

---

## Akzeptanztest

**Voraussetzung:** Mindestens 3 aktive Elektroden auf einer CI-Seite.

1. **Fortschrittsbalken sichtbar.**
   - Tab Messungen → Sub-Tab Frequenzabgleich → „Test starten".
   - **Erwartet:** Oberhalb der Antwort-Buttons ein grauer Balken
     mit blauer Füllung (anfangs 0 %), darunter ein Text wie
     „0 / N (0 trials, 0 %)".

2. **Ton 1 / Ton 2 leuchten.**
   - Test läuft, ein Trial wird abgespielt.
   - **Erwartet:** Bei Wiedergabe von Ton 1 leuchtet das linke Label
     („Ton 1") farbig auf, beim zweiten Ton wechselt das Leuchten
     zum rechten Label („Ton 2"). Nach dem zweiten Ton sind beide
     wieder neutral.

3. **Status-Grid: Trials zählen hoch, sonst nichts.**
   - Schnelldurchlauf: 10–20 mal denselben Button drücken.
   - **Erwartet:** In der Trials-Spalte verschiedener Tracks
     erscheinen Zahlen. Match/Residuum bleiben „—" (keine
     Umkehrungen bei monotoner Antwort).

4. **Status-Grid: Match-Schätzung erscheint.**
   - Antworten **wechseln** (mal höher, mal tiefer, zufällig),
     bis mindestens ein Track ≥2 Umkehrungen hat.
   - **Erwartet:** In der Match-Spalte dieses Tracks erscheint
     eine cent-Zahl in **kursiv und gedämpfter Farbe** (vorläufig).
     Residuum-Spalte bleibt „—" solange <4 Umkehrungen.

5. **Status-Grid: Residuum-Schätzung erscheint.**
   - Weiter Antworten, bis ein Track ≥4 Umkehrungen hat.
   - **Erwartet:** In der Residuum-Spalte des Tracks erscheint
     „±N ct" in **kursiv und gedämpfter Farbe**.

6. **Konvergenz.**
   - Test bis zur Konvergenz eines Tracks laufen lassen
     (oder Debug-Modus benutzen, um schneller hinzukommen).
   - **Erwartet:** Match und Residuum wechseln von kursiv-gedämpft
     auf normal-schwarz. Status-Icon wechselt von ⏳ zu ✓.

7. **Fortschrittsbalken steigt mit Umkehrungen.**
   - Während Schritt 4–6 den Balken beobachten.
   - **Erwartet:** Sobald in mehreren Tracks Umkehrungen entstehen,
     wächst der Balken kontinuierlich. Bei reinem Schnelldurchlauf
     ohne Umkehrungen bleibt er bei 0 % — *das ist methodisch
     korrekt*.

8. **Reiter-Konsistenz.**
   - Pausieren, in Meßergebnisse → Frequenzabgleich wechseln.
   - **Erwartet:** Die kursiv-gedämpften Werte im Status-Grid
     entsprechen den vorläufigen Einträgen in der Reiter-Tabelle
     (gleiche Cent-Zahlen, gleiche Schwellen-Logik).

9. **Bau-Diagnose-Test.**
   - Debug-Panel → Tab „Messungen" → `build/BA85/provisional-schwellen`
     ausführen.
   - **Erwartet:** grün, „7 Schwellen-Fälle korrekt".

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen.
Pro Punkt melden: **erfüllt / nicht erfüllt / unklar** mit Datei- und
Zeilenangabe.

Zusätzlich prüfen:

- **CSS-Regressionen**: Stört der neue `.progress-bar`-Style andere
  Tests (Lautstärke, Latency)? Optisch öffnen und kurz draufschauen.
- **`setPlayingIndicator` bei vorzeitigem Abbruch**: Bleibt eine
  `.playing`-Klasse irgendwo hängen, wenn der User Stop drückt
  während Ton 1 läuft? Bei Bedarf in `fmFinishAdaptive` und im
  Stop-Pfad eine `setPlayingIndicator(null)`-Sicherung setzen.
- **`fmComputeProvisional` für nicht-aktive Tracks**: gibt `status: null`
  zurück — kein Aufrufer darf in dem Fall auf `match`/`residual` als
  Anzeigewert zugreifen. In den geänderten Stellen gegenchecken
  (`fmRenderStatusGrid` und `_fmrBuildInProgressEntries`).
- **Konsistenz nach Pause/Resume**: Pausiere mitten in einem Track
  mit ≥2 Umkehrungen, wechsle in einen anderen Tab, komme zurück
  und resume. Das Status-Grid sollte sofort wieder den kursiv-
  gedämpften Match anzeigen.
- **Versions-Bump auf 3.0.85-beta erfolgt.**

**Aufräum-Workflow für den Bau-Diagnose-Test** (BA 83-Konvention):
nach Akzeptanz aktiv beim Nutzer nachfragen, ob `BA85_provisional_schwellen.js`:
(a) gelöscht oder (b) ins Archiv `archive/debug-tests/BA85_provisional_schwellen.js`
verschoben werden soll. Aktion vor finalem Abschluß ausführen.
