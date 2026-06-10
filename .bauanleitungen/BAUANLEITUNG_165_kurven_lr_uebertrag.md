# BAUANLEITUNG 165 — Reiter Kurven: L↔R-Übertrag der Schieber

**Zieldateien:** `js/version.js`, `index.html`, `js/levels.js`,
`js/init.js`, `i18n/de.js`

**Voraussetzung:** BA 161-164 abgeschlossen. Stand `js/version.js`
= `3.1.164-beta`.

**Version:** 3.1.164-beta → **3.1.165-beta**

---

## Kontext

Im Reiter **Kurven** (HTML `panel-levels`) verwaltet die Karte
„Kurvenfunktionen" (`<table id="prTbl">`) die Schieber pro Seite.
Aktuell gibt es nur die Checkbox **„Schieber für beide Seiten gleich"**
(`prBothSides`, Default ein) — die hält links und rechts gekoppelt.
Sobald die Checkbox aus ist (oder eine geladene JSON-Datei die Seiten
mit unterschiedlichen Werten füllt), gibt es **keine** UI, um die
Werte einer Seite auf die andere zu übertragen.

Konzept (vom Nutzer abgesegnet):

- Zwei neue Knöpfe in der Karte „Kurvenfunktionen", direkt **neben**
  dem `prBothSides`-Label, **über** der Schieber-Tabelle:
  - **„Auf andere Seite übertragen"** — kopiert die Schieber der
    aktiven Seite auf die andere Seite.
  - **„Von anderer Seite holen"** — kopiert die Schieber der anderen
    Seite auf die aktive Seite.
- **Unabhängig vom Zustand der Checkbox** ausgeführt — kein Ausgrauen,
  keine automatische Kopplungs-Aktion.
- **Keine Rückfrage** vor dem Übertrag.
- **Cutoff-Skalierung bei unterschiedlicher Elektrodenzahl**: pro
  Schieber, der einen Cutoff hat (`bassboost`, `highboost`), wird auf
  der Zielseite der Elektroden-Index gewählt, dessen effektive
  Frequenz dem Hz-Wert der Quell-Cutoff-Elektrode **logarithmisch
  am nächsten liegt**.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.1.165-beta";
```

---

## Schritt 2 — HTML: zwei Knöpfe in der Schieber-Karte

In `index.html`, in der Karte „Kurvenfunktionen" (ab Z. 1093),
direkt **nach** dem `prBothSides`-Label und **vor** der
`<table id="prTbl">`-Zeile einfügen.

**Vorher (`index.html` Z. 1100-1113):**
```html
          <label
            style="
              font-size: 0.85em;
              color: var(--text-muted);
              display: flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              margin-bottom: 10px;
            "
            ><input type="checkbox" id="prBothSides" checked />
            <span data-t="lvPresetBoth"></span
          ></label>
          <table class="pr-tbl" id="prTbl"></table>
```

**Nachher:**
```html
          <label
            style="
              font-size: 0.85em;
              color: var(--text-muted);
              display: flex;
              align-items: center;
              gap: 6px;
              cursor: pointer;
              margin-bottom: 10px;
            "
            ><input type="checkbox" id="prBothSides" checked />
            <span data-t="lvPresetBoth"></span
          ></label>
          <!-- BA 165: L↔R-Übertrag-Knöpfe -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;font-size:0.86em;">
            <button class="btn btn-sm" id="prCopyToOther" type="button" data-t="lvCopyLR"></button>
            <button class="btn btn-sm" id="prCopyFromOther" type="button" data-t="lvFromLR"></button>
          </div>
          <table class="pr-tbl" id="prTbl"></table>
```

---

## Schritt 3 — `js/levels.js`: Übertragungs-Funktionen

Am Ende von `js/levels.js` (nach allen bestehenden Funktionen)
ergänzen:

```js
// ============================================================
// BA 165: L↔R-Übertrag der Schieber (presets) im Reiter Kurven
// ============================================================

// Findet auf der Zielseite den Elektroden-Index, dessen effektive
// Frequenz dem Quell-Hz logarithmisch am nächsten liegt.
function _lvNearestElIdxByHz(side, srcHz) {
  if (!isFinite(srcHz) || srcHz <= 0) return 0;
  const n = (sideData[side] && sideData[side].nEl) || 0;
  if (n === 0) return 0;
  let bestIdx = 0, bestDiff = Infinity;
  for (let i = 0; i < n; i++) {
    const f = withSide(side, function () { return effFreq(i); });
    if (!isFinite(f) || f <= 0) continue;
    const diff = Math.abs(Math.log(f) - Math.log(srcHz));
    if (diff < bestDiff) { bestDiff = diff; bestIdx = i; }
  }
  return bestIdx;
}

// Kopiert presets von srcSide nach dstSide. Cutoff wird per
// Hz-Nähe auf das Ziel-Elektrodenraster gemappt.
function _lvCopyPresetsSide(srcSide, dstSide) {
  if (!sideData[srcSide] || !sideData[dstSide]) return;
  if (srcSide === dstSide) return;
  const srcPresets = sideData[srcSide].presets || [];
  const dstPresets = srcPresets.map(function (pr) {
    const np = Object.assign({}, pr);
    if (PR_HAS_CUTOFF[pr.type]) {
      const srcHz = withSide(srcSide, function () {
        return effFreq(pr.cutoff);
      });
      np.cutoff = _lvNearestElIdxByHz(dstSide, srcHz);
    }
    return np;
  });
  sideData[dstSide].presets = dstPresets;
  // Falls die Zielseite die aktive Seite ist, das globale `presets`
  // neu binden, damit buildPrTbl()/drawLvChart() den neuen Inhalt sehen.
  if (dstSide === activeSide) {
    bindActiveSide();
  }
  buildPrTbl();
  drawLvChart();
  if (typeof pUpdEQ === "function") pUpdEQ();
}

function lvPresetsToOther() {
  const dst = activeSide === "left" ? "right" : "left";
  _lvCopyPresetsSide(activeSide, dst);
}

function lvPresetsFromOther() {
  const src = activeSide === "left" ? "right" : "left";
  _lvCopyPresetsSide(src, activeSide);
}
```

---

## Schritt 4 — `js/init.js`: Knopf-Event-Handler verdrahten

Im `DOMContentLoaded`-Handler, an einer geeigneten Stelle (z. B.
direkt nach dem bestehenden `printSchieberBtn`-Block in Z. 173-177),
ergänzen:

```js
  // BA 165: L↔R-Übertrag der Schieber im Reiter Kurven
  const _prCopyTo = document.getElementById("prCopyToOther");
  if (_prCopyTo) _prCopyTo.addEventListener("click", lvPresetsToOther);
  const _prCopyFrom = document.getElementById("prCopyFromOther");
  if (_prCopyFrom) _prCopyFrom.addEventListener("click", lvPresetsFromOther);
```

---

## Schritt 5 — `i18n/de.js`: zwei neue Keys

In `i18n/de.js`, in der Nähe von `lvPresetBoth` (vermutlich nahe
`lvPresetTitle`), einfügen:

```js
    lvCopyLR:  "Schieber auf andere Seite übertragen",
    lvFromLR:  "Schieber von anderer Seite holen",
```

Achtung Stringliteral: ASCII-`"` außen, keine inneren `"`.

---

## Akzeptanztest

1. **Tool frisch laden.** Version oben rechts: `3.1.165-beta`.
2. **Hersteller links MED-EL, rechts Cochlear** einstellen.
   Damit haben die Seiten unterschiedliche Elektrodenzahl (12 vs. 22).
3. **Reiter Kurven** öffnen. Erwartet: In der Karte „Kurvenfunktionen"
   sind zwei neue Knöpfe sichtbar: „Schieber auf andere Seite
   übertragen" und „Schieber von anderer Seite holen".
4. **Checkbox „Schieber für beide Seiten gleich" ausschalten.**
5. **Auf der aktiven Seite (links) einige Schieber einschalten und
   Werte setzen:**
   - Bassboost: Stärke +6.0 dB, Cutoff E4 (entspricht bei MED-EL
     ca. 1100 Hz — abhängig von Standard-Frequenzliste).
   - Tilt: Stärke +3.0 dB.
6. **Klick auf „Schieber auf andere Seite übertragen".** Erwartet:
   - Schieber-Tabelle aktualisiert sich nicht direkt sichtbar
     (aktive Seite unverändert).
   - Wechsel zur rechten Seite über den Side-Knopf: Die rechte Seite
     zeigt jetzt Bassboost +6.0 dB mit Cutoff an einer Elektrode
     im Bereich um 1100 Hz (bei Cochlear voraussichtlich ca. E13-E15),
     plus Tilt +3.0 dB.
7. **Zurück auf links wechseln, alle Schieber zurücksetzen** (alle
   ausschalten). Klick auf „Schieber von anderer Seite holen".
   Erwartet: Die linke Seite übernimmt die Werte der rechten — auch
   wenn die rechte Werte hat, die ursprünglich nur dort gesetzt
   worden waren. Cutoff wird per Hz-Nähe zurück auf das MED-EL-Raster
   gemappt.
8. **Knopf erneut klicken**, wenn die Seiten bereits identisch sind.
   Erwartet: kein Fehler, Tabelle wird neu gezeichnet, Kurvendiagramm
   unverändert.
9. **„Schieber für beide Seiten gleich"-Checkbox wieder einschalten,
   Knöpfe trotzdem klicken.** Erwartet: Übertrag wirkt unabhängig
   davon (laut Konzept), keine zusätzliche Rückfrage, kein
   Ausgrauen.
10. **Schieber-Werte komplett auf eine Seite legen, in den Player-
    Reiter wechseln, EQ ein.** Erwartet: Die Frequenzgang-Kurve des
    Players verändert sich nach dem Übertrag entsprechend (pUpdEQ
    wurde nach dem Übertrag aufgerufen).
11. **Mit gleichem Hersteller beidseitig** (z. B. links und rechts
    MED-EL): Übertrag-Knopf klicken. Erwartet: Cutoff-Werte bleiben
    1:1 erhalten (Hz-Nähe trifft denselben Index).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 11 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich melden:
- Sind die zwei Knöpfe im HTML mit den richtigen IDs
  (`prCopyToOther`, `prCopyFromOther`) und `data-t`-Attributen
  (`lvCopyLR`, `lvFromLR`) eingefügt? Datei/Zeile.
- Werden die Klick-Handler in `js/init.js` registriert? Datei/Zeile.
- Sind `_lvNearestElIdxByHz`, `_lvCopyPresetsSide`,
  `lvPresetsToOther`, `lvPresetsFromOther` in `js/levels.js`
  vorhanden?
- Wird nach dem Übertrag `bindActiveSide()` aufgerufen, **falls**
  die Zielseite die aktive Seite ist? Begründung: ohne `bindActiveSide()`
  zeigt `buildPrTbl()` weiter das alte globale `presets`-Array.
- Bei Cutoff-Mapping zwischen zwei MED-EL-Seiten: ergibt
  `_lvNearestElIdxByHz` denselben Index (kein Drift)? Belege per
  Berechnung im Selbstcheck.
- Steht `js/version.js` auf `3.1.165-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `index.html` — zwei neue Buttons in der Schieber-Karte
- `js/levels.js` — Übertragungs-Funktionen am Dateiende
- `js/init.js` — Klick-Handler-Bindung
- `i18n/de.js` — `lvCopyLR`, `lvFromLR`

---

## Nicht in dieser Bauanleitung enthalten

- Übersetzungen en/fr/es für `lvCopyLR`, `lvFromLR` — eigene Mini-
  Anleitung.
- Visuelles Feedback nach erfolgtem Übertrag (Toast/Snackbar). Bei
  fehlender Bestätigung verlässt der Nutzer sich auf das sofortige
  Neuzeichnen der Tabelle/des Diagramms.
- Sperrlogik für den Übertrag, wenn eine Seite unkonfiguriert ist
  (Hersteller = „Keine Angabe"). Im aktuellen Konzept wird in dem
  Fall ein leeres `presets`-Array übertragen — das ist konsistent
  mit „leeren Schiebern" und korrigiert sich, sobald der Nutzer
  einen Hersteller wählt. Eine spätere BA könnte hier eine
  Vorabprüfung ergänzen.
