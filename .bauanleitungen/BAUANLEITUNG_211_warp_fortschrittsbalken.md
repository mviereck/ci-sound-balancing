# BAUANLEITUNG 211 — Warp-Fortschrittsbalken im Transport-Bereich

Ziel: Während einer Warp-Berechnung erscheint unterhalb der Transport-
Buttons (Prev/Play/Stop/Next/Loop + Zeitbalken) eine schmale Zeile mit
einem Fortschrittsbalken und der Prozentangabe. Die Zeile ist unsichtbar,
solange keine Berechnung läuft.

Voraussetzung: BA 210 wurde bereits ausgeführt.

---

## Schritt 1 — Versionsnummer setzen

`js/version.js`:
```
const APP_VERSION = "3.2.211-beta";
```

---

## Schritt 2 — Neue Fortschrittszeile in `index.html`

Die Transport-Zeile `plTransport` endet bei `</div>` (nach dem
„Mono"-Span und dem Lautstärke-Block, ca. Z. 1644). Direkt nach dem
schließenden `</div>` von `plTransport` und vor dem öffnenden `<div`
von `plAutoAdvanceRow` (ca. Z. 1647) einfügen:

```html
          <!-- Warp-Fortschrittsbalken (nur während Berechnung sichtbar) -->
          <div id="plWarpProgressRow"
               style="display:none; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap">
            <span style="font-size:0.82em; color:var(--text-muted)" data-t="pwProgressLabel"></span>
            <div style="flex:1; min-width:80px; height:6px; background:var(--border); border-radius:3px; overflow:hidden">
              <div id="plWarpProgressBar"
                   style="height:100%; width:0%; background:var(--success); transition:width 0.25s ease"></div>
            </div>
            <span id="plWarpProgressPct"
                  style="font-family:var(--mono); font-size:0.82em; color:var(--text-muted); min-width:36px; text-align:right"></span>
          </div>
```

---

## Schritt 3 — i18n-Key in `i18n/de.js`

In `i18n/de.js` im Warp-Block (bei den anderen `pw…`-Keys, ca. nach
`plWarpBusyTooltip`) einfügen:

```js
    pwProgressLabel: "Warp:",
```

---

## Schritt 4 — `pWarpUpdUI()` in `freq-warp.js` erweitern

Am Ende von `pWarpUpdUI()`, nach der letzten Zeile die den `statusEl`
oder `hintEl` setzt (ca. Z. 713, nach dem Block mit `pWarpBusy`-Prüfung
für `pointer-events`), folgenden Block anhängen:

```js
  // Fortschrittsbalken im Transport-Bereich
  const progressRow = document.getElementById("plWarpProgressRow");
  const progressBar = document.getElementById("plWarpProgressBar");
  const progressPct = document.getElementById("plWarpProgressPct");
  if (progressRow) {
    if (pWarpBusy && pWarpProgress > 0) {
      progressRow.style.display = "flex";
      const pct = Math.round(pWarpProgress * 100);
      if (progressBar) progressBar.style.width = pct + "%";
      if (progressPct) progressPct.textContent = pct + " %";
    } else {
      progressRow.style.display = "none";
      if (progressBar) progressBar.style.width = "0%";
      if (progressPct) progressPct.textContent = "";
    }
  }
```

Hinweis: Der Block hängt am Ende der Funktion, vor der schließenden
`}` von `pWarpUpdUI()`. Sicherstellen, dass er nach dem hintEl-Block
steht, nicht mittendrin.

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Zeile abhaken:

1. `plWarpProgressRow` in `index.html` vorhanden, startet mit
   `display:none`?
2. `plWarpProgressBar` und `plWarpProgressPct` existieren als
   Kindelemente von `plWarpProgressRow`?
3. i18n-Key `pwProgressLabel` in `de.js` eingetragen?
4. `pWarpUpdUI()` zeigt `plWarpProgressRow` nur wenn `pWarpBusy && pWarpProgress > 0`?
5. Breite von `plWarpProgressBar` wird korrekt auf `pct + "%"` gesetzt?
6. Bei Berechnung abgeschlossen (nicht busy): Zeile wird versteckt,
   Balken auf `0%` zurückgesetzt?
7. Versionsnummer in `version.js` auf `3.2.211-beta` gesetzt?

---

## Akzeptanztest-Checkliste

1. Seite neu laden. Zwischen Transport-Zeile und Auto-Advance-Zeile
   ist kein zusätzlicher Balken sichtbar.
2. Frequenz-Warping einschalten (Toggle auf AN). Falls noch keine
   Warp-Daten vorhanden: Frequenzabgleich-Test zuerst durchführen,
   dann Warping einschalten. Die Berechnung startet.
3. Während der Berechnung erscheint unterhalb der Transport-Buttons
   die Fortschrittszeile mit Label „Warp:", einem Balken und einer
   Prozentangabe (z.B. „37 %"). Der Balken wächst von links nach rechts.
4. Wenn die Berechnung abgeschlossen ist, verschwindet die Zeile
   wieder vollständig.
5. Warping ausschalten: Zeile bleibt unsichtbar.
6. Die Auto-Advance + Pause-Zeile darunter ist unverändert.

---

*Hinweis für später:* Übersetzungen des Labels „Warp:" in en/fr/es
können in einer separaten Mini-Anleitung nachgezogen werden.
