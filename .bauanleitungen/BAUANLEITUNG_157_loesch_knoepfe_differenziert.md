# BAUANLEITUNG 157 — Differenzierte Lösch-Knöpfe im Frequenzabgleich-Ergebnis

**Zieldateien:** `index.html`, `js/results.js`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 156 abgeschlossen. Stand `js/version.js` = `3.0.156-beta`.

**Version:** 3.0.156-beta → **3.0.157-beta**

---

## Kontext

Konzeptbeschluß: Im Frequenzabgleich-Ergebnis-Reiter soll der einzelne
Lösch-Knopf in drei Knöpfe aufgeteilt werden:

1. **Alles löschen** — wie bisher: alle FreqMatch-Daten weg
   (Slider-Einträge und Adaptiv-Einträge).
2. **Nur Vor-Schätzung (Slider) löschen** — entfernt nur die Slider-
   Einträge aus `fRes` und die `sliderEstimates`-Vor-Schätzungen pro
   Seite. Adaptive Läufe bleiben erhalten.
3. **Nur Adaptiv-Ergebnisse löschen** — entfernt nur die Adaptiv-
   Einträge aus `fRes` und die `runs` in `sideData[side].freqmatchAdaptive`.
   Slider-Einträge und Slider-Vor-Schätzungen bleiben.

Die bestehenden Bestätigungs-Dialoge (`confirm(...)`) bleiben für
jeden der drei Knöpfe erhalten (mit eigenem Bestätigungstext) — das
sind explizite Action-Confirms, kein Verlust-Warnung.

LR-Balance und Latenz behalten jeweils ihren einzelnen Lösch-Knopf
(per Konzeptbeschluß).

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.157-beta";
```

---

## Schritt 2 — HTML: drei Knöpfe statt einem

Datei `index.html` Z. 897-899.

**Vorher:**
```html
<div style="margin-top:16px">
  <button class="btn" id="fmrClearBtn" style="color:var(--danger)" data-t="fmrClearBtnLabel"></button>
</div>
```

**Nachher:**
```html
<div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:8px">
  <button class="btn" id="fmrClearAllBtn" style="color:var(--danger)" data-t="fmrClearAllBtnLabel"></button>
  <button class="btn" id="fmrClearSliderBtn" data-t="fmrClearSliderBtnLabel"></button>
  <button class="btn" id="fmrClearAdaptiveBtn" data-t="fmrClearAdaptiveBtnLabel"></button>
</div>
```

(Die alte ID `fmrClearBtn` wird durch `fmrClearAllBtn` ersetzt. Der
„Alles löschen"-Knopf behält den `danger`-Farbton, die zwei
selektiven Knöpfe nicht.)

---

## Schritt 3 — i18n-Strings

Datei `i18n/de.js`. Die bestehenden Keys `fmrClearBtnLabel` und
`fmrClearConfirm` (Z. 729-730) ersetzen durch:

```js
  fmrClearAllBtnLabel: "🗑 Alle Frequenzabgleich-Ergebnisse löschen",
  fmrClearSliderBtnLabel: "🗑 Nur Vor-Schätzung (Slider) löschen",
  fmrClearAdaptiveBtnLabel: "🗑 Nur Adaptiv-Ergebnisse löschen",
  fmrClearAllConfirm: "Alle Frequenzabgleich-Ergebnisse und Track-Rohdaten (Slider und Adaptiv) löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
  fmrClearSliderConfirm: "Nur die Slider-Vor-Schätzungen löschen? Die Adaptiv-Ergebnisse bleiben erhalten.",
  fmrClearAdaptiveConfirm: "Nur die Adaptiv-Ergebnisse löschen? Die Slider-Vor-Schätzungen bleiben erhalten.",
```

Die alten Keys `fmrClearBtnLabel` und `fmrClearConfirm` **können
entfernt werden**, sofern Sonnet per `grep -rn "fmrClearBtnLabel\\|fmrClearConfirm" js/ i18n/`
keine anderen Aufrufe findet.

---

## Schritt 4 — Click-Handler in `js/results.js` umbauen

Datei `js/results.js` Z. 776-793.

**Vorher (gekürzt):**
```js
document.addEventListener("DOMContentLoaded", function() {
  const fmrClearBtn = document.getElementById("fmrClearBtn");
  if (fmrClearBtn) {
    fmrClearBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearConfirm") || "...")) return;
      fRes.splice(0, fRes.length);
      if (typeof sideData !== "undefined") {
        if (sideData.left)  sideData.left.freqmatchAdaptive  = null;
        if (sideData.right) sideData.right.freqmatchAdaptive = null;
      }
      if (typeof depLockApply === 'function') depLockApply();
      renderFreqMatchResults();
      if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
      if (typeof fmUpdateSliderModeAvail === "function") fmUpdateSliderModeAvail();
    });
  }
});
```

**Nachher:**
```js
document.addEventListener("DOMContentLoaded", function() {
  // BA 157: drei Knöpfe statt einem
  function _fmrRefreshAfterClear() {
    if (typeof depLockApply === 'function') depLockApply();
    renderFreqMatchResults();
    if (typeof fmRefreshResumeHint === "function") fmRefreshResumeHint();
    if (typeof fmUpdateSliderModeAvail === "function") fmUpdateSliderModeAvail();
  }

  const allBtn = document.getElementById("fmrClearAllBtn");
  if (allBtn) {
    allBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearAllConfirm") || "Alle löschen?")) return;
      fRes.splice(0, fRes.length);
      if (typeof sideData !== "undefined") {
        if (sideData.left)  sideData.left.freqmatchAdaptive  = null;
        if (sideData.right) sideData.right.freqmatchAdaptive = null;
      }
      _fmrRefreshAfterClear();
    });
  }

  const sliderBtn = document.getElementById("fmrClearSliderBtn");
  if (sliderBtn) {
    sliderBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearSliderConfirm") || "Slider-Schätzungen löschen?")) return;
      // Slider-Einträge aus fRes entfernen
      for (let i = fRes.length - 1; i >= 0; i--) {
        if (fRes[i] && fRes[i].method === 'slider') fRes.splice(i, 1);
      }
      // sliderEstimates pro Seite leeren
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates) fa.sliderEstimates = {};
        });
      }
      _fmrRefreshAfterClear();
    });
  }

  const adaptiveBtn = document.getElementById("fmrClearAdaptiveBtn");
  if (adaptiveBtn) {
    adaptiveBtn.addEventListener("click", function() {
      if (!confirm(t("fmrClearAdaptiveConfirm") || "Adaptiv-Ergebnisse löschen?")) return;
      // Adaptiv-Einträge aus fRes entfernen
      for (let i = fRes.length - 1; i >= 0; i--) {
        if (fRes[i] && fRes[i].method === 'adaptive') fRes.splice(i, 1);
      }
      // freqmatchAdaptive.runs pro Seite leeren (sliderEstimates erhalten)
      if (typeof sideData !== "undefined") {
        ['left', 'right'].forEach(function(side) {
          const fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa) {
            fa.runs = [];
            fa.completedAt = null;
          }
        });
      }
      _fmrRefreshAfterClear();
    });
  }
});
```

Hinweis zum Adaptiv-Pfad: `freqmatchAdaptive` enthält neben `runs`
auch `sliderEstimates`. Der Adaptiv-Lösch-Pfad setzt nur `runs = []`
und löscht `sliderEstimates` bewußt **nicht** — diese gehören zum
Slider-Test. Sonnet soll per grep prüfen, ob `freqmatchAdaptive`
noch weitere Felder hat, die zum „Adaptiv"-Stand gehören (z.B.
`completedAt`, `lastTrialAt` oder ähnliches) und diese ebenfalls
sauber zurücksetzen.

---

## Akzeptanztest

1. **Frische Session**, Version 3.0.157-beta. Beide Seiten CI mit
   MED-EL.
2. **Frequenzabgleich Schieber-Modus**, einen Match speichern.
   Frequenzabgleich Adaptiv-Modus, einen Match speichern.
3. **Reiter „Frequenzabgleich-Ergebnis" öffnen.** Erwartet: drei
   Knöpfe unten — „Alle Frequenzabgleich-Ergebnisse löschen",
   „Nur Vor-Schätzung (Slider) löschen", „Nur Adaptiv-Ergebnisse
   löschen".
4. **„Nur Vor-Schätzung (Slider) löschen" klicken**, im
   Bestätigungsdialog OK. Erwartet: Slider-Einträge weg, Adaptiv-
   Einträge bleiben sichtbar.
5. **„Nur Adaptiv-Ergebnisse löschen" klicken**, OK. Erwartet:
   Adaptiv-Einträge weg, Ergebnis-Tabelle leer.
6. **Neuen Slider-Match und neuen Adaptiv-Match speichern.** Beide
   Knöpfe „Nur ..." funktionieren weiter unabhängig.
7. **„Alle Frequenzabgleich-Ergebnisse löschen" klicken**, OK.
   Erwartet: alle Einträge weg, `freqmatchAdaptive` auf null,
   Sperren aus BA 149/151 verschwinden (Hersteller-, Hörtechnik-,
   Hz-eigen-, Referenzseite-Felder wieder bedienbar).
8. **Bei zwei abgebrochenen Bestätigungsdialogen** (Cancel) passiert
   jeweils nichts mit den Daten.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 8 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar.

Zusätzlich:
- Welche zusätzlichen Felder in `freqmatchAdaptive` wurden durch
  den Adaptiv-Lösch-Pfad zurückgesetzt? (Vollständige Liste.)
- Wurde der alte Key `fmrClearBtnLabel`/`fmrClearConfirm` aus
  `i18n/de.js` entfernt (sofern nicht mehr referenziert)?
- Sind nirgends mehr Aufrufe von `getElementById("fmrClearBtn")`
  zurückgeblieben?
- Steht `js/version.js` auf `3.0.157-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js`
- `index.html` — drei Knöpfe statt einem
- `js/results.js` — neue Click-Handler
- `i18n/de.js` — sechs neue/ersetzte Keys

---

## Damit ist die Sperrlogik-Linie abgeschlossen

BA 149-157 setzen den Konzept-Beschluß aus der Vorbesprechung
vollständig um:

- 149: Sperr-Modul-Grundlage + Hersteller-Sperre + Smartphone-Popup
- 150 (Nachtrag zu 149): Schieber-Werte aus Sperrbedingung raus
- 151: Hörtechnik-Sperre + Hz-eigen bilateral + Referenzseite
- 152: Status-Sperre auf Options-Ebene („im CI deaktiviert")
- 153: Akustische Tabelle + Spiegel-Ausschluß + Auto-Ausschluß bei
  „stumm"
- 154: „Keine Angabe"-Default für Hörtechnik und Hersteller
- 155: Test-Voraussetzungs-Sperre + „beide akustisch = Tabelle aus"
- 156: Stand-Schnappschuß + Hinweis-Banner für Stereo-Balance und
  Latenz
- 157: Differenzierte Lösch-Knöpfe im FreqMatch-Ergebnis

Folgearbeiten, die später separat anzulegen sind:
- Übersetzungen en/fr/es für alle neuen i18n-Keys
- Aufräumen verbleibender Dialog-Reste (z.B. DOM-Aufbau von
  `fmRCDlg` in `js/freqmatch.js`, falls per grep keine andere
  Referenz mehr besteht)
- Lautstärke-Test bekommt eine Render-basierte Sperre analog zu
  `_fmRenderBlockedWarning` (heute nur Alert)
