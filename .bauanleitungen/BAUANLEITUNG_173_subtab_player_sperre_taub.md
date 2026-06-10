# BAUANLEITUNG 173 — Sub-Tab- & Player-Bereich-Sperre L2/L3 für „eine Seite taub"

**Ziel:** Wenn mindestens eine Seite als „Taub" eingetragen ist, werden in Reiter „Messungen" die Sub-Reiter Stereo-Balance, Latenz, Frequenzabgleich ausgegraut. Klick auf einen gesperrten Sub-Reiter öffnet eine eigene Variante des bestehenden Sperr-Modals aus BA 172. Im Reiter „Player" werden die Bereiche Stereo-Balance, Latenzausgleich und Frequenz-Warping disabled angezeigt, jeweils mit einem kleinen Inline-Hinweis. Die redundante „blocked"-Warnung im Frequenzabgleich (`_fmRenderBlockedWarning`) für die Reasons `sideDeaf` und `bothAcoustic` entfällt — diese Fälle sind jetzt durch L1 (BA 172) und L2 abgefangen.

**Versionsbump:** `js/version.js` → `"3.1.173-beta"`.

**i18n-Hinweis:** Nur deutsche Strings — en/fr/es kommen in der separaten Übersetzungs-Mini-BA am Ende des Vorhabens.

**Vorrang:** Bei jeder Unklarheit **stoppen und melden**, nicht raten.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.172-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.173-beta";
```

---

## Schritt 1 — Sperr-Logik L2 in `js/tabs-eq.js`

Datei `js/tabs-eq.js`. Direkt **unter** dem BA-172-Block (also nach `tabLockHideModal` und vor der `switchTab`-Funktion bzw. vor dem `DOMContentLoaded`-Listener) neuen Block einfügen:

```js
// ============================================================
// BA 173: SUB-TAB-SPERRE L2 — eine Seite taub
// ------------------------------------------------------------
// Sperrt Sub-Reiter in „Messungen", wenn mindestens eine Seite
// auf „Taub" steht (config === "deaf"). Die betroffenen Tests
// vergleichen beide Seiten und sind dann nicht sinnvoll.
// ============================================================
const LOCKED_SUBTABS_L2 = {
  messungen: ["balance", "latenz", "freqmatch"],
};

// Liefert {hasDeaf, deafSide}. deafSide ist die zuerst gefundene
// taube Seite (left vor right) und wird aktuell nicht weiter genutzt;
// das Feld bleibt für mögliche Wortlaut-Erweiterungen reserviert.
function evalDeafState() {
  const lC = (sideData.left  && sideData.left.config)  || "unknown";
  const rC = (sideData.right && sideData.right.config) || "unknown";
  if (lC === "deaf") return { hasDeaf: true, deafSide: "left" };
  if (rC === "deaf") return { hasDeaf: true, deafSide: "right" };
  return { hasDeaf: false, deafSide: null };
}

function subtabLockApply() {
  const deaf = evalDeafState();
  Object.keys(LOCKED_SUBTABS_L2).forEach(function (parent) {
    const subs = LOCKED_SUBTABS_L2[parent];
    subs.forEach(function (sub) {
      const btn = document.querySelector(
        '.subtab[data-parent="' + parent + '"][data-subtab="' + sub + '"]'
      );
      if (btn) btn.classList.toggle("tab-locked", deaf.hasDeaf);
    });
    if (deaf.hasDeaf) {
      const activeSubBtn = document.querySelector(
        '.subtab.active[data-parent="' + parent + '"]'
      );
      const activeSub = activeSubBtn ? activeSubBtn.dataset.subtab : null;
      if (activeSub && subs.indexOf(activeSub) !== -1) {
        // Auto-Rückwechsel auf den ersten freien Sub-Reiter „test"
        // (Elektrodenlautstärke). Kein Modal — der User ändert
        // gerade die Implantat-Angaben.
        if (typeof _switchSubtabInternal === "function") {
          _switchSubtabInternal(parent, "test");
        }
      }
    }
  });
}
```

---

## Schritt 2 — `switchSubtab` umstellen

Funktion `switchSubtab(parent, subtab)` (etwa Z. 7) bekommt am Anfang einen Sperr-Check; der bisherige Inhalt wandert in `_switchSubtabInternal`.

**Vor:**

```js
function switchSubtab(parent, subtab) {
  // Subtab-Buttons
  document.querySelectorAll(`.subtab[data-parent="${parent}"]`).forEach((b) => {
    b.classList.toggle("active", b.dataset.subtab === subtab);
  });
  // ... gesamter restlicher Code ...
}
```

**Nach:**

```js
function switchSubtab(parent, subtab) {
  // BA 173: Sperr-Guard L2 — taube Seite blockiert Vergleichstests
  const deaf = evalDeafState();
  const subs = LOCKED_SUBTABS_L2[parent] || [];
  if (deaf.hasDeaf && subs.indexOf(subtab) !== -1) {
    if (typeof tabLockShowModal === "function") tabLockShowModal("sideDeaf");
    return;
  }
  _switchSubtabInternal(parent, subtab);
}

function _switchSubtabInternal(parent, subtab) {
  // ... ab hier der **gesamte** bisherige Inhalt von switchSubtab,
  // unverändert (Subtab-Buttons, Subpanels, Callbacks, Latenz-Stop,
  // sessionStorage, history.pushState) ...
}
```

**Wichtig:** Der **vollständige** bisherige Funktionskörper ab der Subtab-Buttons-Zeile bis zum letzten `history.pushState`-Aufruf wandert 1:1 in `_switchSubtabInternal`. **Nichts** verändern, **nichts** wegfallen lassen. Bei Unsicherheit über die Block-Grenze: stoppen, melden.

---

## Schritt 3 — `tabLockShowModal` um `sideDeaf` erweitern

Datei `js/tabs-eq.js`, die in BA 172 angelegte Funktion `tabLockShowModal(reason)`. Im `if/else`-Block einen `sideDeaf`-Zweig ergänzen.

**Vor:**

```js
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
```

**Nach:**

```js
function tabLockShowModal(reason) {
  const modal = document.getElementById("tabLockModal");
  if (!modal) return;
  const titleEl = modal.querySelector(".tab-lock-title");
  const bodyEl  = modal.querySelector(".tab-lock-body");
  if (reason === "bothAcoustic") {
    if (titleEl) titleEl.textContent = t("tabLockTitleBothAc");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyBothAc");
  } else if (reason === "sideDeaf") {
    if (titleEl) titleEl.textContent = t("tabLockTitleSideDeaf");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodySideDeaf");
  } else {
    if (titleEl) titleEl.textContent = t("tabLockTitleStd");
    if (bodyEl)  bodyEl.innerHTML    = t("tabLockBodyStd");
  }
  modal.classList.add("active");
}
```

---

## Schritt 4 — L3 Player-Bereich-Sperre in `index.html`

Drei Inline-Hinweis-Spans neben den drei betroffenen Player-Bereichen einfügen.

### 4a) Frequenz-Warping (Z. ~1209–1219)

**Vor:**

```html
<!-- Zeile 3: Frequenz-Warping -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group" style="gap: 8px">
    <button
      class="btn btn-sm"
      id="plWarpOn"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
    ></button>
    <span data-t="plWarpExpNote" style="font-size:0.82em;color:var(--text-muted)"></span>
  </div>
</div>
```

**Nach** (eine Zeile ergänzen — `plLockHintWarp`):

```html
<!-- Zeile 3: Frequenz-Warping -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group" style="gap: 8px">
    <button
      class="btn btn-sm"
      id="plWarpOn"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
    ></button>
    <span data-t="plWarpExpNote" style="font-size:0.82em;color:var(--text-muted)"></span>
    <span id="plLockHintWarp" style="display:none;font-size:0.82em;color:var(--warning);margin-left:8px"></span>
  </div>
</div>
```

### 4b) Stereo-Balance (Z. ~1312–1338)

**Vor:**

```html
<!-- Zeile 6: Stereo-Balance + Dropdown -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group">
    <button
      id="plBalApplyBtn"
      class="btn btn-sm"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
      data-t="plBalApply"
    ></button>
  </div>
  <div class="control-group" id="plBalModeRow">
    <label …>…</label>
    <select id="plBalModeSelect" …>…</select>
  </div>
</div>
```

**Nach** (eine `<span>`-Zeile ans Ende der `controls-row` anhängen):

```html
<!-- Zeile 6: Stereo-Balance + Dropdown -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group">
    <button
      id="plBalApplyBtn"
      class="btn btn-sm"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
      data-t="plBalApply"
    ></button>
  </div>
  <div class="control-group" id="plBalModeRow">
    <label …>…</label>
    <select id="plBalModeSelect" …>…</select>
  </div>
  <span id="plLockHintBal" style="display:none;font-size:0.82em;color:var(--warning);margin-left:8px"></span>
</div>
```

### 4c) Latenzausgleich (Z. ~1339–1348)

**Vor:**

```html
<!-- Zeile 7: Latenzausgleich -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group">
    <button
      id="plLatApplyBtn"
      class="btn btn-sm"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
    ></button>
  </div>
</div>
```

**Nach**:

```html
<!-- Zeile 7: Latenzausgleich -->
<div class="controls-row" style="margin-top: 8px">
  <div class="control-group">
    <button
      id="plLatApplyBtn"
      class="btn btn-sm"
      style="font-weight: 600; min-width: 180px; border-radius: 6px"
    ></button>
    <span id="plLockHintLat" style="display:none;font-size:0.82em;color:var(--warning);margin-left:8px"></span>
  </div>
</div>
```

---

## Schritt 5 — L3 Player-Bereich-Sperre in `js/player.js`

Eine neue Funktion `playerLockApply()` hinzufügen — am Ende von `js/player.js`:

```js
// ============================================================
// BA 173: PLAYER-BEREICH-SPERRE L3 — eine Seite taub
// ------------------------------------------------------------
// Disabled die drei seitenabhängigen Player-Bereiche
// (Stereo-Balance, Latenzausgleich, Frequenz-Warping) und
// blendet daneben einen Inline-Hinweis ein, sobald mindestens
// eine Seite auf „Taub" steht.
// ============================================================
function playerLockApply() {
  const deaf = (typeof evalDeafState === "function") ? evalDeafState() : { hasDeaf: false };
  const off = deaf.hasDeaf;
  const setDisabled = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = off;
    if (off) el.style.opacity = "0.4";
    else el.style.opacity = "";
  };
  setDisabled("plBalApplyBtn");
  setDisabled("plBalModeSelect");
  setDisabled("plLatApplyBtn");
  setDisabled("plWarpOn");
  // Inline-Hinweise
  ["plLockHintBal", "plLockHintLat", "plLockHintWarp"].forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    if (off) {
      el.textContent = (typeof t === "function") ? t("plLockHintSideDeaf") : "Nicht verfügbar — Seite als taub eingetragen.";
      el.style.display = "inline";
    } else {
      el.style.display = "none";
    }
  });
}
```

---

## Schritt 6 — Hooks: `tabLockApply` ruft L2 und L3 mit auf

Damit Sperr-Zustände synchron bleiben, erweitern wir `tabLockApply()` aus BA 172 um zwei Aufrufe am Ende.

Datei `js/tabs-eq.js`, Funktion `tabLockApply()`. **Vor** dem letzten `}` der Funktion ergänzen:

```js
  // BA 173: Sub-Tab- und Player-Bereich-Sperre L2/L3 mit nachziehen
  if (typeof subtabLockApply === "function") subtabLockApply();
  if (typeof playerLockApply === "function") playerLockApply();
```

Damit decken die bestehenden BA-172-Hooks (in `setSideConfig`, `switchMfr`, `applyLang`, Init) automatisch L2 und L3 mit ab. **Keine zusätzlichen Hooks nötig.**

---

## Schritt 7 — i18n-Strings in `i18n/de.js`

Drei neue Keys ergänzen — direkt nach den BA-172-Keys einfügen:

```js
    // BA 173: Sub-Tab-/Player-Sperre L2/L3 — eine Seite taub
    tabLockTitleSideDeaf: "Test bei einer tauben Seite nicht möglich",
    tabLockBodySideDeaf:
      "Sie haben eine Seite als taub eingetragen. Dieser Test vergleicht beide Seiten miteinander; das ist auf einer tauben Seite nicht durchführbar.",
    plLockHintSideDeaf: "Nicht verfügbar — Seite als taub eingetragen.",
```

---

## Schritt 8 — Redundante Block-Warnung im Frequenzabgleich entfernen

Datei `js/freqmatch.js`.

### 8a) Aufrufe entfernen

An den Stellen, an denen `_fmRenderBlockedWarning()` aufgerufen wird (Z. 747, 905, 1176 oder vergleichbar nach BA-Drift), die Aufrufe **ersatzlos** entfernen. **Vor:**

```js
  _fmRenderBlockedWarning();
```

**Nach:** ersatzlos entfernen.

### 8b) Funktion entfernen

Die Funktion `function _fmRenderBlockedWarning() { … }` (etwa Z. 819–841) **ersatzlos** entfernen.

### 8c) i18n-Strings entfernen

Datei `i18n/de.js`. Folgende Keys können entfernt werden, weil sie nicht mehr referenziert werden:

- `fmBlocked_sideDeaf` (etwa Z. 610)
- `fmBlocked_bothAcoustic` (etwa Z. 611)

**Wichtig:** Vor dem Entfernen mit `grep -n "fmBlocked_sideDeaf\|fmBlocked_bothAcoustic" js/ i18n/` prüfen, daß die Keys wirklich nirgends mehr referenziert sind. Sollte ein anderer Code-Pfad sie doch noch nutzen: Keys belassen, in Selbstprüfung melden.

---

## Schritt 9 — Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen, melden: **erfüllt / nicht erfüllt / unklar**, mit Datei und Zeilenangabe.

1. `js/version.js` zeigt `"3.1.173-beta"`.
2. `js/tabs-eq.js` enthält Konstante `LOCKED_SUBTABS_L2` mit genau `{ messungen: ["balance","latenz","freqmatch"] }`.
3. `js/tabs-eq.js` enthält `evalDeafState`, `subtabLockApply`, `_switchSubtabInternal`.
4. `switchSubtab` enthält den Sperr-Guard ganz oben und ruft `_switchSubtabInternal(parent, subtab)` im freien Fall.
5. `_switchSubtabInternal` enthält **exakt** den bisherigen Inhalt von `switchSubtab` ab der Subtab-Buttons-Zeile bis zum letzten `history.pushState`. Nichts weggelassen.
6. `tabLockShowModal` hat den neuen `else if (reason === "sideDeaf")`-Zweig.
7. `index.html` enthält die drei Inline-Hinweis-Spans `plLockHintWarp`, `plLockHintBal`, `plLockHintLat`, jeweils initial `display:none`.
8. `js/player.js` enthält die neue Funktion `playerLockApply` am Ende. Sie disabled Buttons, setzt Opazität und Inline-Hinweise.
9. `tabLockApply` ruft am Ende `subtabLockApply()` und `playerLockApply()` auf.
10. `i18n/de.js` enthält die drei neuen Keys `tabLockTitleSideDeaf`, `tabLockBodySideDeaf`, `plLockHintSideDeaf`. Anführungszeichen-Hygiene gewahrt.
11. `js/freqmatch.js` enthält keine `_fmRenderBlockedWarning`-Funktion mehr und keine Aufrufe davon.
12. `i18n/de.js` enthält `fmBlocked_sideDeaf` und `fmBlocked_bothAcoustic` nicht mehr **oder** sie sind explizit als noch referenziert begründet.
13. `grep -n "fmBlocked_" js/ i18n/` liefert keine Treffer **oder** nur in Sprachdateien, die in dieser BA bewußt nicht angefaßt werden (`en.js`, `fr.js`, `es.js`).
14. Browser-Test: Konsole zeigt keine roten Fehler beim Wechsel der Hörsituation auf/von „Taub", beim Klick auf Player-Buttons, beim Sub-Tab-Wechsel in Messungen.

---

## Schritt 10 — Akzeptanz-Checkliste für den Nutzer

1. **Frischer Browser-Tab.** Beide Seiten konfigurieren: LINKS = CI MED-EL, RECHTS = Normalhörend. Tabs sind frei (BA 172 Sperre erfüllt).
2. **Reiter „Messungen" öffnen.** Sub-Reiter Elektrodenlautstärke ist aktiv. Stereo-Balance, Latenz, Frequenzabgleich sind sichtbar und **anklickbar** (nicht ausgegraut), weil keine Seite taub.
3. **Zurück zu Reiter Implantat**, RECHTS auf „Taub" wechseln. (Falls dabei das Tool auf einen anderen Tab springt, das ist BA 172 Auto-Rückwechsel — passt nicht hier.)
4. **Reiter „Messungen" öffnen.** Sub-Reiter Stereo-Balance, Latenz, Frequenzabgleich sind **ausgegraut** (Opazität 0.4, Cursor not-allowed). Elektrodenlautstärke bleibt frei.
5. **Klick auf Sub-Reiter „Stereo-Balance".** Modal-Overlay erscheint: Titel „Test bei einer tauben Seite nicht möglich", Body „Sie haben eine Seite als taub eingetragen. Dieser Test vergleicht beide Seiten miteinander; das ist auf einer tauben Seite nicht durchführbar." Schließen-Button schließt das Modal. Sub-Reiter bleibt nicht gewechselt.
6. **Reiter „Player" öffnen.** Bereiche Frequenz-Warping (Zeile 3), Stereo-Balance (Zeile 6), Latenzausgleich (Zeile 7) sind disabled (Button-Opazität 0.4), und rechts neben dem jeweiligen Bereich steht in oranger/Warn-Farbe „Nicht verfügbar — Seite als taub eingetragen." MAPLAW, Lautstärke, Pause/Play, EQ-Toggle, „beide Seiten"-Checkbox bleiben funktionsfähig.
7. **Zurück zu Reiter Implantat**, RECHTS auf „Normalhörend" zurückwechseln. Sub-Reiter in Messungen sind wieder frei klickbar, Player-Bereiche wieder aktiv, Inline-Hinweise verschwunden.
8. **Test mit anderer Seite:** LINKS auf „Taub", RECHTS bleibt CI. Gleiches Sperr-Verhalten — taube Seite egal welche.
9. **Frequenzabgleich-Sub-Reiter direkt erreichen** (aus History/Bookmark) wird bei tauber Seite durch das Modal abgefangen; der vorherige Inline-Warn-Block in der Frequenzabgleich-Seite ist weg, weil redundant.
10. **Konsole offen, keine roten Fehler** in allen obigen Schritten.

---

## Schritt 11 — Folge-BA

Nach Abnahme von BA 173 steht nur noch an:

- **Übersetzungs-Mini-BA** — alle in BA 165, 169, 172, 173 neu/geänderten deutschen Strings auf en/fr/es ziehen. Reine Mechanik-BA, keine UI-Entscheidungen.

Damit ist das ursprüngliche Vorhaben abgeschlossen.

---

## Schlußbemerkung

Die heikelsten Stellen sind:
- Schritt 2 — Extraktion `switchSubtab` → `_switchSubtabInternal` (vollständiger Inhalt).
- Schritt 8 — gefahrloses Entfernen der `_fmRenderBlockedWarning`-Mechanik (Grep-Check vor Löschung).

Bei beiden bei Unsicherheit lieber stoppen und melden.
