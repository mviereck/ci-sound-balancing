# Bauanleitung 112 — Slider-Vor-Schätzung: Tabelle, Enter-Taste, Neustart, Debug + Adaptiv-Startoffset

**Kontext:** Nach BA 111 hat das Slider-Verfahren die richtigen
Bausteine. Nutzungs-Tests haben mehrere Detail-Bugs und -Wünsche
aufgedeckt, plus eine kleine Anpassung im adaptiven Test (höherer
Default-Startoffset). Diese Anleitung räumt sie zusammen ab.

**Zielversion:** `APP_VERSION = "3.0.112-beta"`

**Nicht in dieser Anleitung:** Tonseitenabfrage-Generalisierung,
Adaptive-Start-Check (alle Schätzungen vorhanden?). Beides später.

---

## Pflichtlektüre

1. `CLAUDE.md` — ARBEITSWEISE, VERSIONIERUNG, NOTAUSGANG-PRINZIP.
2. `docs/BAUANLEITUNGEN_LEITLINIEN.md`.
3. `docs/spec/00-testui-architektur.md` — Pfeiltasten-Tabelle (wird
   um Enter erweitert).
4. `js/test-ui.js` — Pfeiltasten-Handler (Capture-Listener) und
   `_buildTestPanelNew` Refs.
5. `js/freqmatch.js` — gezielt:
   - `fmStartAdaptive` (Default-Startoffset, ~Z. 700–900 je nach Stand)
   - `FM_FOLLOWUP_BRACKET_OFFSET` und Default-Konstanten in
     `js/freqmatch-staircase.js`
   - `fmRenderSliderStatusGrid` (aus BA 111)
   - `fmRunSliderDebugSim` (aus BA 111)
   - `fmLoadElectrode` (~Z. 1434) und `fmPrevCent` (Slider-Startwert
     pro Elektrode)
   - `fmConfirm`, `fmAbort`, `fmFinish` (Lifecycle-Ende des Slider-Laufs)
6. `i18n/de.js` — `fmExplainSliderScience` aus BA 111.

---

## Teil A — Enter-Taste löst „Offset bestätigen" aus

In `_buildTestPanelNew` (`js/test-ui.js`), Pfeiltasten-Handler
(globaler keydown-Capture-Listener), neue Zeile ergänzen:

```js
if (event.key === 'Enter') {
  // Nur reagieren, wenn ein confirmButton im aktiven Verfahren-Body deklariert ist
  if (vActive && vActive.hooks && vActive.hooks.onConfirm) {
    event.preventDefault();
    vActive.hooks.onConfirm();
  }
  return;
}
```

(Variablen-Namen wie `vActive` an den heutigen Stand anpassen.)

**Spec-Datei** `docs/spec/00-testui-architektur.md`, Pfeiltasten-Tabelle:
neue Zeile

```
| Enter | „Offset bestätigen" / `onConfirm` auslösen | `confirmButton`-Baustein deklariert |
```

**Achtung Fokus:** Wenn der Fokus in einem Eingabefeld (z.B. number-input
Lautstärke) liegt, ist Enter dort vermutlich schon belegt. Der
Capture-Listener feuert vorher; bei number-inputs darf er nicht
abfangen. Lösung: wenn `event.target` ein `<input>`, `<select>` oder
`<textarea>` ist, **nicht abfangen** und nichts tun.

```js
var tag = event.target && event.target.tagName;
if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
```

(Diese Vorab-Prüfung gilt für **alle** Tasten-Handler im Capture-Listener.
Heute existiert sie vermutlich nicht — Sonnet ergänzt sie pauschal.)

---

## Teil B — Adaptiver Startoffset: 250 cent Abstand auch bei Vor-Schätzung

**Hintergrund:** Im adaptiven Test wird der erste Trial pro Elektrode mit
einem festen Cent-Abstand vom erwarteten Match-Wert gestartet. Martin
hört einen deutlichen Unterschied erst ab etwa 250 cent — der Test
profitiert davon, wenn der erste Trial dieser hörbar weit entfernt
beginnt. Das gilt **auch dann**, wenn eine Slider-Vor-Schätzung
existiert: die Schätzung darf nicht direkt der Startwert sein, sonst
ist der erste Vergleich für den Nutzer zu nah am gewünschten Match.

**Anpassung der drei Startoffset-Pfade aus BA 104:**

- **Pfad (a) — Folgelauf-Bracketing** aus `prevRun.perElectrode[idx].match
  ± FM_FOLLOWUP_BRACKET_OFFSET`: **unverändert** (Folgeläufe brauchen
  enges Bracketing, weil der vorherige Lauf-Match schon präzise ist).
- **Pfad (b) — Slider-Vor-Schätzung:** der Startoffset wird **nicht**
  direkt aus `sliderEstimate.cent` genommen, sondern liegt **250 cent
  davon entfernt**. Konkret: `startOffset = sliderEstimate.cent + sign · 250`,
  wobei `sign` (`+1` oder `−1`) der Track-Startsign-Logik aus dem
  bestehenden Adaptive-Init-Pfad folgt. Beispiel: Schätzung +30 cent,
  `sign = +1` → Start bei +280 cent; bei `sign = −1` → Start bei
  −220 cent.
- **Pfad (c) — Default-Fallback** (weder Folgelauf noch Vor-Schätzung):
  `sign · 250` cent statt `sign · 100`.

**Konstante einführen:**

```js
const FM_INITIAL_START_OFFSET = 250;   // BA 112 — Default-Cent-Abstand des ersten Trials
```

Sinnvoller Ort: bei den anderen `FM_*`-Konstanten in
`js/freqmatch-staircase.js`. Wenn dort bereits `FM_FOLLOWUP_BRACKET_OFFSET`
liegt, daneben.

**`fmStartAdaptive` anpassen** (Pfade b und c):

```js
// Pfad (b): Slider-Vor-Schätzung als Mittelpunkt
if (sliderEst && typeof sliderEst.cent === 'number') {
  startOffset = sliderEst.cent + sign * FM_INITIAL_START_OFFSET;
}
// Pfad (c): Default-Fallback
else {
  startOffset = sign * FM_INITIAL_START_OFFSET;
}
```

(Variablen-Namen `sliderEst`, `sign`, `startOffset` an die heutige
Implementation anpassen — falls die Stelle nicht eindeutig auffindbar
ist, **Rückfrage statt raten**.)

**Spec-Datei** `docs/spec/02b-freqmatch-adaptiv.md`: Beschreibung der
Startoffset-Logik aktualisieren. Konstanten-Liste anpassen
(`FM_INITIAL_START_OFFSET = 250` neu; ggf. alte Erwähnung von
`sign · 100` ersetzen).

---

## Teil C — Slider-Status-Tabelle: sechs Spalten, klar lesbar

Funktion `fmRenderSliderStatusGrid` aus BA 111 wird umgebaut.
Vorgabe für die Spalten (von links nach rechts):

| Spalte | Inhalt | Datenquelle |
|---|---|---|
| Elektrode | `E<nr>`, z.B. `E5` | aus `fmSeq` |
| Startwert (Hz) | Default-Frequenz dieser Elektrode auf der zu testenden Seite | `fmVarHz(elektrode)` |
| Differenz (cent) | Aktueller Slider-Offset in cent (nur für aktuelle Elektrode), sonst `—` | `fmCentOffset` für `fmCurrentEl`, sonst `—` |
| Differenz (Hz) | Differenz in Hz umgerechnet; `Math.round(startHz * (2^(cent/1200) - 1))` | berechnet |
| Schätzung mit Slider (Hz) | Final gespeicherter Hz-Wert nach `fmConfirm`; sonst `—` | `sliderEstimates[el].cent` → `fmFreqFromCents(startHz, cent)` |
| Status | `✓` wenn Eintrag in `sliderEstimates` vorhanden, sonst `✗` | `sliderEstimates[el]` !== undefined |

**Render-Reihenfolge:** alle Elektroden aus `fmSeq` in der ursprünglichen
Reihenfolge.

**Skeleton-Code:**

```js
function fmRenderSliderStatusGrid() {
  if (!fmEls) return;
  const grid = fmEls.verfahren && fmEls.verfahren.slider && fmEls.verfahren.slider.statusGrid;
  if (!grid) return;

  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                 && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};

  const rows = [];
  rows.push(
    '<tr>' +
      '<th>Elektrode</th>' +
      '<th>Startwert (Hz)</th>' +
      '<th>Differenz (cent)</th>' +
      '<th>Differenz (Hz)</th>' +
      '<th>Schätzung mit Slider (Hz)</th>' +
      '<th>Status</th>' +
    '</tr>'
  );

  fmSeq.forEach(function(el) {
    const startHz = fmVarHz(el);
    const isCur   = (fmCurrentEl === el && fmRunning && !fmAdaptiveActive);
    const saved   = store[String(el)];

    let curCentCell  = '—';
    let curDiffCell  = '—';
    let estimateCell = '—';
    let statusCell   = '✗';

    if (isCur) {
      const cents = Math.round(fmCentOffset);
      curCentCell = (cents >= 0 ? '+' : '') + cents + ' cent';
      const diffHz = Math.round(startHz * (Math.pow(2, cents / 1200) - 1));
      curDiffCell = (diffHz >= 0 ? '+' : '') + diffHz + ' Hz';
    }
    if (saved) {
      const finalHz = Math.round(fmFreqFromCents(startHz, saved.cent));
      estimateCell  = finalHz + ' Hz';
      statusCell    = '✓';
    }

    rows.push(
      '<tr' + (isCur ? ' class="current-row"' : '') + '>' +
        '<td>E' + el + '</td>' +
        '<td>' + Math.round(startHz) + ' Hz</td>' +
        '<td>' + curCentCell + '</td>' +
        '<td>' + curDiffCell + '</td>' +
        '<td>' + estimateCell + '</td>' +
        '<td>' + statusCell + '</td>' +
      '</tr>'
    );
  });

  grid.innerHTML = '<table class="fm-slider-status">' + rows.join('') + '</table>';
}
```

**Aufrufpunkte** (wie in BA 111, aber jetzt mit dem neuen Inhalt):
- `fmStartSlider` (initial)
- `fmLoadElectrode` (neue aktuelle Elektrode markieren)
- `fmConfirm` (nach Eintrag in `sliderEstimates`)
- `fmUndo` (nach Entfernen aus `sliderEstimates`)
- **Plus**: bei jeder Änderung von `fmCentOffset` während der laufenden
  Elektrode, damit die Cent/Hz-Anzeige live aktualisiert wird. Konkret:
  in der `onSlide`-Hook-Funktion (heute `fmHandleSlider` oder
  `fmSliderChange`). Falls Performance ein Problem wird (jede
  Slider-Bewegung rendert die ganze Tabelle), kann der Render auf eine
  schmale Variante reduziert werden (nur die zwei Cent/Hz-Zellen der
  aktuellen Zeile updaten). Beim ersten Versuch ganz neu rendern —
  falls's stockt, melden.

**CSS-Hinweis:** Klasse `fm-slider-status` und Highlight-Klasse
`current-row` sollten klar lesbar sein. Falls noch nicht in `style.css`
vorhanden:

```css
.fm-slider-status {
  width: 100%;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.95em;
}
.fm-slider-status th,
.fm-slider-status td {
  padding: 0.3em 0.6em;
  text-align: center;
  border-bottom: 1px solid #e5e7eb;
}
.fm-slider-status th {
  background: #f3f4f6;
  font-weight: 600;
}
.fm-slider-status tr.current-row td {
  background: #fef3c7;
  font-weight: 600;
}
```

**Adaptive-Status-Tabelle nicht anfassen** (User-Anweisung).
`fmRenderStatusGrid` (für adaptive) bleibt unverändert.

---

## Teil D — Slider-Neustart: Startwert aus gespeicherter Schätzung

**Heute:** `fmLoadElectrode` (`js/freqmatch.js` ~Z. 1434) setzt
`fmCentOffset = fmPrevCent(fmCurrentEl);`. Sonnet prüft, ob `fmPrevCent`
für eine Elektrode mit bereits vorhandener Slider-Schätzung den
gespeicherten cent-Wert zurückgibt. Falls ja: ist alles richtig.
Falls nein (z.B. weil `fmPrevCent` aus dem alten Code stammt und nur
historische Werte aus einem anderen Datenfeld liest): umbauen, sodass
zuerst aus `sliderEstimates[String(el)].cent` gelesen wird.

**Skeleton:**

```js
function fmPrevCent(el) {
  const store = (sideData[fmVarSide] && sideData[fmVarSide].freqmatchAdaptive
                 && sideData[fmVarSide].freqmatchAdaptive.sliderEstimates) || {};
  const saved = store[String(el)];
  if (saved && typeof saved.cent === 'number') return saved.cent;
  // Fallback: was die heutige Implementation sonst noch zurückgibt
  return 0;
}
```

**Akzeptanz aus Nutzersicht:** Wenn der Nutzer einen Slider-Wert
bestätigt, den Test verlässt (Stop), später wieder startet — landet
er auf jeder schon bearbeiteten Elektrode mit dem Slider direkt am
zuletzt bestätigten Wert (statt bei 0 cent).

**Test-Stop ohne Bestätigung:** Wenn der Nutzer mitten in einer
Elektrode aufgibt (ohne „Bestätigen") und später wiederkommt: Startwert
ist 0 cent (bzw. der zuletzt bestätigte, falls es einen gibt — vor dem
laufenden Versuch). Es gibt keine zwischengespeicherten unbestätigten
Werte.

---

## Teil E — Akkordeon-Text ergänzen

In `i18n/de.js` den Wert von `fmExplainSliderScience` um den vom Nutzer
vorgegebenen Schlusssatz erweitern. Heute (BA 111):

```
"Die Vor-Schätzung bittet Sie, die Frequenz auf einer Seite manuell
so zu verschieben, dass die Töne auf beiden Seiten gleich hoch klingen.
…<strong>Startpunkt</strong>: das adaptive Verfahren bekommt mit einer
guten Vor-Schätzung deutlich kürzere Testzeiten, weil es nicht von 0
cent loslaufen muss."
```

**Anhängen** (am Ende, durch `<br><br>` getrennt):

```
"Die Slidermethode ist kein wissenschaftliches Meßverfahren und ist
besonders stark psychoakustischen Fehlwahrnehmungen ausgesetzt."
```

(„psychoakustischen" mit ck.)

**Anführungszeichen-Hinweis:** keine ASCII-`"` ohne Escape; das ganze
String-Literal bleibt mit `"…"` als äußere Klammer.

---

## Teil F — Debug-Knopf im Slider: Werte einfüllen, Test ordentlich beenden

**Nutzer-Bericht:** Der „DEBUG: Testlauf"-Knopf im Slider hat den Test
beendet, ohne dass die Tabelle sich mit Werten gefüllt hat.

**Soll-Verhalten:**
1. Für jede Elektrode einen zufälligen Cent-Wert aus dem Bereich
   −200 bis +500 in `sliderEstimates` schreiben.
2. Den Test ordentlich beenden — gleicher Lifecycle-Pfad wie nach
   normalem Durchlauf aller Elektroden (`fmFinish` o.ä.).
3. Die Werte sind dann im Ergebnis-Reiter sichtbar (`renderFreqMatchResults`).

**Diagnose-Auftrag an Sonnet:** Im BA-111-Skeleton von
`fmRunSliderDebugSim` wurde die Reihenfolge möglicherweise so gewählt,
dass `fmFinish` aufgerufen wird, **bevor** die `store`-Befüllung greift
oder unter Annahmen, die im Lifecycle nicht stimmen. Vor dem
Anpassen kurz prüfen, warum heute die Werte nicht in `sliderEstimates`
landen (mit `console.log` der Funktion und der `store`-Inhalte am Ende).
Falls die Werte **doch** geschrieben werden und nur nicht sichtbar
sind: Render-Pfad in `renderFreqMatchResults` oder im Ergebnis-Reiter
prüfen.

**Konkrete Implementation:**

```js
function fmRunSliderDebugSim() {
  if (!fmRunning) {
    fmStartSlider();
    setTimeout(fmRunSliderDebugSim, 100);
    return;
  }
  const store = _fmEnsureSliderStore(fmVarSide);
  if (!store) return;

  // Streuung −200 bis +500 cent (asymmetrisch, BA 112)
  fmSeq.forEach(function(el) {
    const cent = Math.round(-200 + Math.random() * 700);   // [-200, +500]
    store[String(el)] = {
      cent:      cent,
      varSide:   fmVarSide,
      refSide:   fmRefSide,
      varFreq:   fmVarHz(el),
      timestamp: Date.now()
    };
  });

  // Test ordentlich beenden — gleicher Pfad wie nach normalem Durchlauf
  fmSeqIdx = fmSeq.length;
  fmLoadElectrode();   // → ruft fmFinish() auf, weil fmSeqIdx >= fmSeq.length

  if (typeof renderFreqMatchResults === 'function') {
    try { renderFreqMatchResults(); } catch (e) {}
  }
}
```

**Wenn der Test trotz korrekter Reihenfolge ohne Werte endet:** Sonnet
prüft, ob `fmFinish` (oder ein Teilpfad davon) den `sliderEstimates`-
Store überschreibt oder leert. Falls ja, **Rückfrage statt
eigenmächtigen Umbau** — der Lifecycle-Code ist heikel.

---

## i18n — Änderungen in `i18n/de.js`

- `fmExplainSliderScience`: Schlusssatz ergänzen (Teil E).

**Keine neuen Keys** in dieser Anleitung. Andere Sprachen (en/fr/es)
nicht anfassen.

---

## Pflicht-Schritte am Ende

1. **`js/version.js`**: `APP_VERSION` `"3.0.111-beta"` → `"3.0.112-beta"`.
2. **`docs/CODESTRUKTUR.md`** Ergänzungen:
   - test-ui.js: Enter-Taste löst `onConfirm` aus (Pfeiltasten-
     Capture-Listener); Vorab-Schutz für Fokus in input/select/textarea.
   - freqmatch.js: `FM_INITIAL_START_OFFSET = 250` neu;
     Adaptive-Startoffset nutzt 250 cent Abstand **auch bei
     Slider-Vor-Schätzung** (Schätzung als Mittelpunkt, Start
     `schätzung ± 250 cent`); Default ohne Schätzung `sign · 250`
     (war `sign · 100`); Folgelauf-Bracketing unverändert.
     `fmRenderSliderStatusGrid` zeigt 6 Spalten und wird in
     `onSlide` mit aufgerufen; `fmPrevCent` liest aus
     `sliderEstimates`; `fmRunSliderDebugSim` mit Streuung
     −200…+500 cent, beendet den Test ordentlich.
3. **`docs/spec/00-testui-architektur.md`**:
   - Pfeiltasten-Tabelle: Zeile `Enter` neu.
4. **`docs/spec/02b-freqmatch-adaptiv.md`**: Default-Startoffset
   in der Konstanten-Liste auf 250 cent.

---

## Akzeptanztest

1. **Slider-Test starten** → Tabelle unten zeigt für jede Elektrode
   eine Zeile mit: Elektroden-ID, Startwert (Hz), Differenz (cent + Hz)
   nur für aktuelle Elektrode, Schätzung-Hz leer, Status ✗.
   Aktuelle Elektrode ist farblich hervorgehoben.
2. **Slider bewegen** → in der aktuellen Zeile aktualisieren sich
   „Differenz (cent)" und „Differenz (Hz)" live mit jedem Wert.
3. **Enter-Taste** drücken → löst „Bestätigen" aus; Tabelle aktualisiert,
   Schätzung-Hz für die gerade bestätigte Elektrode erscheint, Status ✓,
   nächste Elektrode wird aktiv (hervorgehoben).
4. **Test verlassen, neu starten** → der Slider startet auf einer
   bereits bestätigten Elektrode bei deren gespeichertem Wert
   (Slider-Position nicht 0).
5. **Auf den Tonart-Dropdown klicken**, dann **Enter** → das Dropdown
   schließt sich normal, „Bestätigen" wird **nicht** ausgelöst.
6. **Akkordeon** ausklappen → der neue Satz „Die Slidermethode ist kein
   wissenschaftliches Meßverfahren und ist besonders stark psychoakustischen
   Fehlwahrnehmungen ausgesetzt." steht am Ende.
7. **Debug-Knopf** (bei aktivem Debug-Panel) → Werte zwischen
   `-200 cent` und `+500 cent` werden pro Elektrode gespeichert,
   Test endet wie nach normalem Durchlauf. Im **Ergebnis-Reiter** sind
   die generierten Werte sichtbar.
8. **Adaptiver Test starten** mit einer Elektrode, für die weder eine
   Slider-Schätzung noch ein vorheriger Lauf existiert → der erste
   Trial spielt einen deutlich größeren Cent-Abstand ab als vorher
   (Default-Startoffset ist 250 cent statt 100).
9. **Adaptiver Test mit Slider-Vor-Schätzung** (z.B. +30 cent) →
   erster Trial liegt **250 cent von der Schätzung entfernt** (also
   bei +280 oder −220 cent, je nach Startvorzeichen). Der Nutzer hört
   am Start einen klar wahrnehmbaren Unterschied; der Track läuft
   trotzdem in Richtung der Schätzung zusammen.
10. **Status-Tabelle im adaptiven Test** ist unverändert.
11. **Konsole:** `FM_INITIAL_START_OFFSET` → `250`.

---

## Selbstprüfung (vor der Fertig-Meldung)

Pro Punkt **erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe.

1. Enter-Taste löst `onConfirm` aus, wenn `confirmButton`-Baustein
   deklariert ist.
2. Tasten-Capture-Listener ignoriert Tasten in `<input>`, `<select>`,
   `<textarea>`.
3. `FM_INITIAL_START_OFFSET = 250` neu definiert; alte 100-cent-
   Stellen im adaptiven Start-Pfad ersetzt; Slider-Vor-Schätzung
   wird in Pfad (b) mit `+ sign · 250` versetzt, nicht direkt
   übernommen.
4. `fmRenderSliderStatusGrid` rendert 6 Spalten mit den vorgegebenen
   Inhalten; aktuelle Elektrode hervorgehoben.
5. `fmRenderSliderStatusGrid` wird in `onSlide`-Hook (Slider-Bewegung)
   aufgerufen — live-Update der aktuellen Zeile.
6. `fmPrevCent` liefert den gespeicherten Slider-Wert pro Elektrode,
   falls vorhanden.
7. Akkordeon-Text erweitert um den Schlusssatz.
8. `fmRunSliderDebugSim` mit Streuung `-200…+500 cent`; speichert
   alle Werte in `sliderEstimates`; beendet den Test ordentlich über
   `fmFinish`-Pfad.
9. CSS-Klassen `.fm-slider-status` und `.current-row` in `style.css`.
10. `APP_VERSION` ist `"3.0.112-beta"`.
11. Spec- und CODESTRUKTUR-Updates entsprechend.

Bei **unklar**: Rückfrage statt raten.

---

## Notausgang-Prinzip

- **Enter-Konflikte**: wenn Enter in irgendeinem Form-Element
  notwendig ist (z.B. zum Bestätigen einer manuellen Eingabe in der
  Lautstärke), passt der pauschale Schutz „nicht abfangen wenn Fokus
  in input/select/textarea" — sicherstellen, dass kein Fall übersehen
  wird.
- **Debug-Sim-Lifecycle**: wenn `fmFinish` den `sliderEstimates`-Store
  beim Beenden überschreibt oder leert, **vor dem Umbau melden**, statt
  eigenmächtig ein Schutz-Flag einzubauen.
- **Slider-Live-Render Performance**: falls die Tabelle bei jeder
  Slider-Bewegung ruckelt, eine schmale Update-Variante vorschlagen
  (nur die Cent/Hz-Zellen der aktuellen Zeile), nicht eigenmächtig den
  ganzen Mechanismus umbauen.
- **`fmPrevCent`-Refactor**: wenn die Funktion heute noch von alten
  Pfaden (BA 75 oder früher) gerufen wird, die andere Annahmen haben:
  vor der Änderung melden.

---

## Hinweis am Ende

- BA 113: Tonseitenabfrage als generelles testUI-Feature +
  Adaptive-Start-Check.
- en/fr/es-Übersetzungen für den Akkordeon-Schlusssatz: eigene
  Mini-Anleitung später.
