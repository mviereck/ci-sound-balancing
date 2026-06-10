# BAUANLEITUNG 212 — Lautstärke in eigene Zeile

Ziel: Der Lautstärke-Block (Label + Zahleneingabe + Schnell-Buttons)
wird aus der Transport-Zeile herausgelöst und als eigene Zeile unter
die Auto-Advance + Pause-Zeile verschoben.

Voraussetzung: BA 210 und BA 211 wurden bereits ausgeführt.

Nur `index.html` wird geändert. Keine JS- oder i18n-Änderungen.

---

## Schritt 1 — Versionsnummer setzen

`js/version.js`:
```
const APP_VERSION = "3.2.212-beta";
```

---

## Schritt 2 — Lautstärke aus `plTransport` entfernen (`index.html`)

In `index.html` innerhalb von `<div id="plTransport" ...>` den
folgenden Block (ca. Z. 1632–1642) **ersatzlos entfernen**:

```html
            <div class="control-group" style="flex-wrap:wrap; gap:4px">
              <label data-t="lblVol"></label>
              <input type="number" id="plVol" value="80" min="0" max="100" step="1"
                     style="width:55px; padding:3px 5px; border:1px solid var(--border); border-radius:4px; text-align:center; font-family:var(--mono); font-size:0.88em" />%
              <div id="plVolBtns" style="display:flex; gap:3px; flex-wrap:wrap; margin-left:6px">
                <button class="btn pl-vol-btn" type="button" data-v="25">25</button>
                <button class="btn pl-vol-btn" type="button" data-v="50">50</button>
                <button class="btn pl-vol-btn" type="button" data-v="75">75</button>
                <button class="btn pl-vol-btn" type="button" data-v="100">100</button>
              </div>
            </div>
```

Der „Mono"-Badge (`<span ...>Mono</span>`) und der Zeitbalken-Block
bleiben in `plTransport` — nur der Lautstärke-Block wird entfernt.

---

## Schritt 3 — Neue Lautstärke-Zeile nach `plAutoAdvanceRow` (`index.html`)

Direkt nach dem schließenden `</div>` von `plAutoAdvanceRow`
(ca. Z. 1667, das `</div>` direkt vor dem `<!-- Anzeige-Block -->`-Kommentar)
einfügen:

```html
          <!-- Eigene Zeile: Lautstärke -->
          <div class="controls-row"
               style="align-items:center; gap:8px; margin-bottom:10px; flex-wrap:wrap">
            <div class="control-group" style="flex-wrap:wrap; gap:4px">
              <label data-t="lblVol"></label>
              <input type="number" id="plVol" value="80" min="0" max="100" step="1"
                     style="width:55px; padding:3px 5px; border:1px solid var(--border); border-radius:4px; text-align:center; font-family:var(--mono); font-size:0.88em" />%
              <div id="plVolBtns" style="display:flex; gap:3px; flex-wrap:wrap; margin-left:6px">
                <button class="btn pl-vol-btn" type="button" data-v="25">25</button>
                <button class="btn pl-vol-btn" type="button" data-v="50">50</button>
                <button class="btn pl-vol-btn" type="button" data-v="75">75</button>
                <button class="btn pl-vol-btn" type="button" data-v="100">100</button>
              </div>
            </div>
          </div>
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Zeile abhaken:

1. Der Lautstärke-Block existiert **nicht mehr** innerhalb von
   `<div id="plTransport">` (grep nach `id="plVol"` — darf nur
   einmal vorkommen, außerhalb von `plTransport`)?
2. Die neue Lautstärke-Zeile steht nach dem schließenden `</div>`
   von `plAutoAdvanceRow` und vor dem `<!-- Anzeige-Block -->`-Kommentar?
3. `id="plVol"` und `id="plVolBtns"` kommen in `index.html` je genau
   einmal vor (keine Duplikate)?
4. `data-t="lblVol"` im neuen Block vorhanden (i18n-Key bleibt erhalten)?
5. Der „Mono"-Badge und der Zeitbalken-Block sind noch in `plTransport`?
6. Versionsnummer in `version.js` auf `3.2.212-beta` gesetzt?

---

## Akzeptanztest-Checkliste

1. Seite neu laden. Im Wiedergabe-Bereich erscheinen nun vier Zeilen
   untereinander:
   - Transport (⏮ ▶ ⏹ ⏭ 🔁 + Zeitbalken + Mono-Badge)
   - Auto-Advance + Pause-Buttons (ms-Werte)
   - Lautstärke (Label „Lautstärke:" + Zahleneingabe + 25/50/75/100-Buttons)
   - Anzeige-Block (Titel des Stücks)
2. Lautstärke-Regler ist bedienbar: Wert ändern, Schnell-Button klicken
   → Lautstärke ändert sich wie gewohnt.
3. Kein zweiter Lautstärke-Block in der Transport-Zeile sichtbar.
4. Mono-Badge ist noch in der Transport-Zeile (ganz rechts neben dem
   Zeitbalken).
5. Zeitbalken und Transport-Buttons liegen weiterhin korrekt in einer
   Zeile.

---

*Hinweis für später:* Falls die Lautstärke-Zeile zu weit unten wirkt,
kann die Reihenfolge der Zeilen in einem Folge-Edit angepaßt werden.
