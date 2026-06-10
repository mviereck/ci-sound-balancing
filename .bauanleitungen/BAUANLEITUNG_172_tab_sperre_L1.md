# BAUANLEITUNG 172 — Tab-Sperre L1: Haupt-Reiter sperren bei unzureichenden Implantat-Angaben

**Ziel:** Reiter „Messungen", „Meßergebnisse", „Kurven" (data-tab `levels`), „Schieber" und „Player" werden ausgegraut und nicht zugänglich, solange die Implantat-Angaben unzureichend sind. Beim Klick auf einen gesperrten Reiter erscheint ein Modal-Overlay mit Erklärung. Frei zugänglich bleiben: Einführung, Implantat (data-tab `setup`), Datei, Unterstützung, Links.

**Sperr-Schwelle:**
- Sperre **inaktiv** (Tabs frei) wenn:
  - **beide Seiten** haben eine konkrete Hörsituation gewählt (`config !== "unknown"`)
  - **UND mindestens eine Seite** ist CI mit gewähltem Hersteller (`config === "ci"` und `manufacturer ∈ {"medel","ab","cochlear"}`)
- Sperre **aktiv** sonst. Sonderfall: wenn beide Seiten akustisch sind (`config ∈ {"hg","normal","shoh"}`), wird eine eigene Modal-Variante angezeigt.

**Versionsbump:** `js/version.js` → `"3.1.172-beta"`.

**i18n-Hinweis:** Nur deutsche Strings in dieser BA. Englische/französische/spanische Strings folgen in einer eigenen kleinen Übersetzungs-BA.

**Vorrang:** Wenn beim Bauen etwas nicht eindeutig ist, **stoppen und melden** — nicht raten. Die Konzeptphase war ausführlich, Abweichungen sind ein Warnsignal.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.171-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.172-beta";
```

---

## Schritt 1 — Modal-Skeleton in `index.html`

Modal-Overlay für die Sperr-Mitteilung. Das `.modal-overlay`/`.modal-box`-Pattern existiert bereits (siehe `style.css:742–768`); wir hängen einen neuen Container ans Ende des `<body>`. **Ort:** direkt **vor** dem schließenden `</body>`-Tag von `index.html`.

```html
<!-- BA 172: Modal-Overlay für Tab-Sperre L1 -->
<div id="tabLockModal" class="modal-overlay" role="dialog" aria-modal="true">
  <div class="modal-box" style="text-align:left;max-width:520px">
    <h2 class="tab-lock-title" style="text-align:center"></h2>
    <div class="tab-lock-body" style="font-size:0.95em;line-height:1.5;margin-top:10px"></div>
    <div style="margin-top:18px;text-align:center">
      <button class="btn" id="tabLockCloseBtn" data-t="tabLockClose"></button>
    </div>
  </div>
</div>
```

Das Modal ist initial unsichtbar (default `display:none` aus `.modal-overlay`); per `.active`-Klasse wird `display:flex` gesetzt.

---

## Schritt 2 — CSS in `style.css`

Am Ende von `style.css` (außerhalb des `@media print {…}`-Blocks) anhängen:

```css
/* BA 172: Tab-Sperre L1 — visuelle Markierung gesperrter Haupt-Reiter */
.tab.tab-locked {
  opacity: 0.4;
  cursor: not-allowed;
}
.tab.tab-locked:hover {
  opacity: 0.4;
}
```

Wichtig: Der Tab-Button bleibt **klickbar** (Klick öffnet das Modal). Wir setzen nicht `pointer-events: none`.

---

## Schritt 3 — i18n-Strings in `i18n/de.js`

Im deutschen `Object.assign`-Block (vermutlich am Ende der Datei oder thematisch zu „cfg…"-Strings) folgende Keys neu anlegen:

```js
    // BA 172: Tab-Sperre L1
    tabLockTitleStd: "Reiter noch nicht verfügbar",
    tabLockBodyStd:
      "Bitte tragen Sie zuerst im Reiter <b>Implantat &amp; Elektroden</b> die Angaben für beide Seiten ein:<br>– Hörsituation links und rechts<br>– bei Cochlea-Implantat: zusätzlich den Hersteller<br><br>Sobald die Angaben vollständig sind, werden die übrigen Reiter freigeschaltet.",
    tabLockTitleBothAc: "Reiter nicht verfügbar",
    tabLockBodyBothAc:
      "Dieses Tool benötigt mindestens eine CI-Seite. Details siehe Reiter <b>Implantat &amp; Elektroden</b>.",
    tabLockClose: "Schließen",
```

**Anführungszeichen-Hygiene:** Jeder String hat gerade Anzahl an `"`-Zeichen. `&amp;` wird vom Browser bei `innerHTML` zu `&` aufgelöst.

---

## Schritt 4 — Sperr-Logik in `js/tabs-eq.js`

Datei `js/tabs-eq.js`. **Vor** der bestehenden Funktion `switchTab(n)` (etwa Z. 58) einen neuen Block einfügen:

```js
// ============================================================
// BA 172: TAB-SPERRE L1
// ------------------------------------------------------------
// Sperrt Haupt-Reiter, wenn die Implantat-Angaben unzureichend
// sind. Sperr-Schwelle und Tab-Liste sind hier zentral.
// ============================================================
const LOCKED_TABS_L1 = ["messungen", "ergebnisse", "levels", "schieber", "player"];

// Liefert den aktuellen Sperr-Zustand:
//   { locked: false, reason: null }                 — frei
//   { locked: true,  reason: "unconfigured" }       — fehlende Angaben
//   { locked: true,  reason: "bothAcoustic" }       — beide Seiten akustisch
function evalTabLockState() {
  const lC = (sideData.left  && sideData.left.config)  || "unknown";
  const rC = (sideData.right && sideData.right.config) || "unknown";
  const isAc = (c) => c === "hg" || c === "normal" || c === "shoh";
  if (isAc(lC) && isAc(rC)) return { locked: true, reason: "bothAcoustic" };
  if (lC === "unknown" || rC === "unknown") return { locked: true, reason: "unconfigured" };
  const lMfr = sideData.left  && sideData.left.manufacturer;
  const rMfr = sideData.right && sideData.right.manufacturer;
  const validMfr = (m) => !!m && m !== "unknown";
  const lCI = lC === "ci" && validMfr(lMfr);
  const rCI = rC === "ci" && validMfr(rMfr);
  if (!lCI && !rCI) return { locked: true, reason: "unconfigured" };
  return { locked: false, reason: null };
}

// Visuelle Sperre setzen und ggf. den aktuellen Tab zurückwechseln,
// falls er nun gesperrt wäre.
function tabLockApply() {
  const state = evalTabLockState();
  window._tabLockState = state;
  LOCKED_TABS_L1.forEach((name) => {
    const btn = document.querySelector('.tab[data-tab="' + name + '"]');
    if (btn) btn.classList.toggle("tab-locked", state.locked);
  });
  if (state.locked) {
    // Wenn der User aktuell auf einem nun gesperrten Tab steht, sanft auf
    // den Implantat-Reiter zurückwechseln, damit kein inkonsistenter
    // Inhalt sichtbar bleibt. KEIN Modal in diesem Fall — der User
    // ändert ja gerade die Implantat-Angaben.
    const activeTabEl = document.querySelector(".tab.active");
    const activeName  = activeTabEl ? activeTabEl.dataset.tab : null;
    if (activeName && LOCKED_TABS_L1.indexOf(activeName) !== -1) {
      _switchTabInternal("setup");
    }
  }
}

// Zeigt das Sperr-Modal mit der zur Reason passenden Variante.
function tabLockShowModal(reason) {
  const modal = document.getElementById("tabLockModal");
  if (!modal) return;
  const titleEl = modal.querySelector(".tab-lock-title");
  const bodyEl  = modal.querySelector(".tab-lock-body");
  if (reason === "bothAcoustic") {
    if (titleEl) titleEl.textContent = t("tabLockTitleBothAc");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyBothAc");
  } else {
    if (titleEl) titleEl.textContent = t("tabLockTitleStd");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyStd");
  }
  modal.classList.add("active");
}

function tabLockHideModal() {
  const modal = document.getElementById("tabLockModal");
  if (modal) modal.classList.remove("active");
}
```

Den Close-Handler des Modals registrieren wir am Ende von `tabs-eq.js`, nach den existierenden Funktionen — in einem `DOMContentLoaded`-Hook oder direkt am Ende, falls die Datei bereits unbedingt nach DOM-Bereitstellung lädt. Bitte den vorhandenen Init-Pfad in `tabs-eq.js` prüfen; wenn unklar, einen eigenen `DOMContentLoaded`-Listener verwenden:

```js
// BA 172: Close-Handler für Tab-Sperr-Modal
document.addEventListener("DOMContentLoaded", function () {
  const closeBtn = document.getElementById("tabLockCloseBtn");
  if (closeBtn) closeBtn.addEventListener("click", tabLockHideModal);
});
```

---

## Schritt 5 — `switchTab()` anpassen

Die bestehende Funktion `switchTab(n)` in `js/tabs-eq.js` (Z. 58–…) bekommt am Anfang einen Sperr-Check. **Wichtig:** Es gibt heute schon einen Guard für laufende Tests; der bleibt erhalten. Wir fügen den Sperr-Guard **nach** dem Test-Guard ein und kapseln zusätzlich die bisherige Funktion in eine interne Hilfsfunktion `_switchTabInternal`, damit `tabLockApply()` den Tab-Wechsel ohne erneuten Sperr-Check ausführen kann (sonst Endlos-Schleife).

**Vor (gekürzt — Originalblock von `switchTab` mit Test-Guard):**

```js
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning)
    || (typeof latActive !== "undefined" && latActive);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === n));
  // ... weiterer bestehender Code ...
}
```

**Nach:**

```js
function switchTab(n) {
  // Guard: Verhindere Tab-Wechsel während aktiver Test
  const anyTestRunning = testAct
    || (typeof lrRunning !== "undefined" && lrRunning)
    || (typeof fmRunning !== "undefined" && fmRunning)
    || (typeof latActive !== "undefined" && latActive);
  if (anyTestRunning && n !== "messungen") {
    return; // Tab-Wechsel blockiert
  }
  // BA 172: Sperr-Guard L1 — bei gesperrtem Tab Modal zeigen statt zu wechseln
  const lockState = window._tabLockState;
  if (lockState && lockState.locked && LOCKED_TABS_L1.indexOf(n) !== -1) {
    tabLockShowModal(lockState.reason);
    return;
  }
  _switchTabInternal(n);
}

// BA 172: interner Tab-Wechsel ohne Sperr-Check. Wird von switchTab und von
// tabLockApply (Rückwechsel auf Implantat-Tab) genutzt.
function _switchTabInternal(n) {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.toggle("active", t.dataset.tab === n));
  // ... ab hier den **gesamten** restlichen Code aus der bisherigen
  // switchTab-Funktion übernehmen, unverändert ...
}
```

**Wichtig:** Der **gesamte** bisherige Code von `switchTab` **nach** dem Test-Guard (von `document.querySelectorAll(".tab")…` bis zur schließenden Klammer) wandert 1:1 in `_switchTabInternal`. Nichts ändern, nichts weglassen. Sonnet — wenn unklar wo der Block endet, **bitte stoppen und nachfragen**.

---

## Schritt 6 — Sperr-Auslöser-Hooks

Die Sperre muß bei jeder Implantat-relevanten Änderung neu bewertet werden.

### 6a) `js/state-side.js` — `setSideConfig`

Funktion `setSideConfig(side, cfg)` (etwa Z. 636) endet mit:

```js
  bindActiveSide();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
```

Eine Zeile direkt davor ergänzen:

```js
  bindActiveSide();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 172: Tab-Sperre L1 neu bewerten
  if (typeof tabLockApply === 'function') tabLockApply();
}
```

### 6b) `js/freq-table.js` — `switchMfr`

Funktion `switchMfr(m)` (etwa Z. 341) endet mit:

```js
  buildFreqTable();
  buildImplantCard();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
```

Ergänzen:

```js
  buildFreqTable();
  buildImplantCard();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
  // BA 172: Tab-Sperre L1 neu bewerten
  if (typeof tabLockApply === 'function') tabLockApply();
}
```

### 6c) `js/i18n.js` — `applyLang`

Funktion `applyLang()` (Z. 33–…) endet am Funktionsende. Vor der schließenden Klammer ergänzen:

```js
  // BA 172: Tab-Sperre L1 — Klassen-Toggle + Modal-Texte ggf. neu aufgrund Sprachwechsel
  if (typeof tabLockApply === 'function') tabLockApply();
```

### 6d) `js/init.js` — initialer Aufruf nach DOM-Ready / sessionStorage-Load

In `js/init.js` läuft am Ende der Init-Phase ein Block, der die UI hochzieht (etwa Z. 600+ nach `Load from sessionStorage`). Direkt **nach** dem Restore-Block (vor dem letzten `}` der Init-Funktion oder vor dem nächsten Top-Level-Statement) ergänzen:

```js
  // BA 172: Initialer Sperr-Stand
  if (typeof tabLockApply === 'function') tabLockApply();
```

Wenn die genaue Stelle nicht eindeutig ist (mehrere Init-Pfade): den Aufruf in der **letzten** ausgeführten Init-Zeile platzieren — sicher ist sicher.

---

## Schritt 7 — Selbstprüfungs-Auftrag an Sonnet

Bevor Du fertig meldest, gehe jeden Punkt einzeln durch und melde **erfüllt / nicht erfüllt / unklar**, mit Datei und Zeilenangabe.

1. `js/version.js` zeigt `"3.1.172-beta"`.
2. `index.html` enthält am Ende vor `</body>` das `<div id="tabLockModal">…</div>`.
3. `style.css` enthält die `.tab.tab-locked`-Regeln (mit `:hover`-Variante).
4. `i18n/de.js` enthält die fünf neuen Keys: `tabLockTitleStd`, `tabLockBodyStd`, `tabLockTitleBothAc`, `tabLockBodyBothAc`, `tabLockClose`. Anführungszeichen-Hygiene gewahrt.
5. `js/tabs-eq.js` enthält die Konstante `LOCKED_TABS_L1` mit genau den fünf Tabs `["messungen","ergebnisse","levels","schieber","player"]`.
6. `js/tabs-eq.js` enthält `evalTabLockState`, `tabLockApply`, `tabLockShowModal`, `tabLockHideModal`, `_switchTabInternal`.
7. `evalTabLockState` liefert `{locked: true, reason: "bothAcoustic"}` wenn beide Seiten in `["hg","normal","shoh"]`.
8. `evalTabLockState` liefert `{locked: true, reason: "unconfigured"}` wenn mindestens eine Seite `"unknown"` ist.
9. `evalTabLockState` liefert `{locked: true, reason: "unconfigured"}` wenn beide Seiten konfiguriert sind aber keine Seite CI mit gültigem Hersteller hat.
10. `evalTabLockState` liefert `{locked: false}` sobald beide Seiten ≠ `"unknown"` UND mindestens eine Seite `config === "ci"` mit `manufacturer ∈ {"medel","ab","cochlear"}`.
11. `switchTab` enthält den Sperr-Guard direkt **nach** dem Test-Guard.
12. `_switchTabInternal` enthält **exakt** den bisherigen Code von `switchTab` ab der Klassen-Toggle-Zeile bis zum Funktionsende. Nichts weggelassen, nichts hinzugefügt.
13. `tabLockApply` setzt `.tab-locked` auf die fünf Buttons je nach `locked`.
14. `tabLockApply` ruft `_switchTabInternal("setup")` auf, wenn der aktive Tab gesperrt wird (Rückwechsel auf Implantat).
15. `tabLockShowModal` setzt Titel und Body je nach `reason` korrekt.
16. Close-Button (`#tabLockCloseBtn`) entfernt die `.active`-Klasse vom Modal.
17. `setSideConfig` ruft am Ende `tabLockApply()` auf.
18. `switchMfr` ruft am Ende `tabLockApply()` auf.
19. `applyLang` ruft am Ende `tabLockApply()` auf.
20. `init.js` ruft `tabLockApply()` einmal nach Init / sessionStorage-Load auf.

Wenn ein Punkt unklar ist, **nicht raten** — melden und Rückfrage abwarten.

---

## Schritt 8 — Akzeptanz-Checkliste für den Nutzer

Nach erfolgreichem Bau bitte durchgehen:

1. **Frischer Browser-Tab.** Reiter „Einführung" ist offen (Standard). Reiter „Messungen", „Meßergebnisse", „Kurven", „Schieber", „Player" sind **ausgegraut** (Opazität 0.4, Cursor zeigt „not-allowed").
2. **Klick auf „Messungen".** Modal erscheint mittig: „Reiter noch nicht verfügbar" + Erklärtext mit „Hörsituation links und rechts" und „bei Cochlea-Implantat: zusätzlich den Hersteller". Tab bleibt **nicht** gewechselt. Klick auf „Schließen" schließt das Modal.
3. **Auf Reiter „Implantat" wechseln.** Hörsituation LINKS auf „Cochlea-Implantat" stellen.
4. **Klick auf „Messungen".** Modal erscheint weiterhin (RECHTS noch „Keine Angabe").
5. **Auf Reiter „Implantat" zurückwechseln**, RECHTS auf „Normalhörend" stellen.
6. **Klick auf „Messungen".** Modal erscheint weiterhin (LINKS = CI aber Hersteller noch unbekannt).
7. **Reiter Implantat**, Hersteller LINKS auf MED-EL. Reiter „Messungen" et al. **sind freigeschaltet** (volle Opazität, Cursor zeigt Standard-Pointer). Klick auf „Messungen" wechselt direkt — kein Modal.
8. **Zurück auf Reiter Implantat.** Hörsituation LINKS auf „Keine Angabe". Reiter sind wieder gesperrt. War man vorher auf „Messungen" (Probe: erst auf Messungen, dann zurück auf Implantat, dann Hörsituation entfernen) — beim Setzen von „Keine Angabe" wechselt der Browser automatisch auf Reiter „Implantat" (kein Modal, weil der User gerade selbst die Änderung macht).
9. **Beide Seiten akustisch:** LINKS „Normalhörend", RECHTS „Schwerhörig". Auf der Implantat-Seite erscheint der existierende „Tool nicht für rein akustische Versorgung"-Hinweis. Klick auf „Messungen" zeigt das Modal mit Titel „Reiter nicht verfügbar" und Body „Dieses Tool benötigt mindestens eine CI-Seite. Details siehe Reiter Implantat & Elektroden."
10. **Reiter Einführung, Datei, Unterstützung, Links** sind in allen Zuständen frei klickbar (nicht ausgegraut).
11. **Sprachwechsel** (DE/EN/FR/ES): die deutschen `tabLock*`-Strings sind in den anderen Sprachen nicht vorhanden — Fallback auf Deutsch (erwartet, eigene Übersetzungs-BA später).
12. **Konsole offen, keine roten Fehler** beim Tab-Klick, beim Hersteller-Wechsel, beim Hörsituation-Wechsel.

---

## Schritt 9 — Nachfolgende BAs

Nach BA 172 stehen an:
- **BA 173+** (Nummer nach `version.js`-Stand): Sub-Tab- und Player-Bereich-Sperre L2/L3 für „eine Seite taub". Nutzt die Modal-Komponente aus BA 172 wieder.
- Anschließend Übersetzungs-Mini-BA für alle in BA 165, 169, 172 angelegten deutschen Strings.

Diese Folge-BAs sind **nicht** Teil von BA 172.

---

## Schlußbemerkung

Die heikelste Stelle ist Schritt 5 — die Extraktion des bisherigen `switchTab`-Inhalts in `_switchTabInternal`. Bitte besonders sorgfältig den Funktionsumfang prüfen, **nichts** verlieren. Bei Unsicherheit: stoppen, melden.
