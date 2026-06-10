# BAUANLEITUNG 163 — Tab-Isolation per sessionStorage

**Zieldateien:** `js/version.js`, `js/init.js`, `js/tabs-eq.js`,
`js/debug.js`

**Voraussetzung:** BA 161 und BA 162 abgeschlossen. Stand
`js/version.js` = `3.1.162-beta`.

**Version:** 3.1.162-beta → **3.1.163-beta**

---

## Kontext

Derzeit landet der gesamte Tool-Zustand in `localStorage`. `localStorage`
ist browserweit pro Origin; öffnet der Nutzer das Tool in zwei
Browser-Tabs gleichzeitig, sehen beide Tabs **denselben** Datenstand
und überschreiben sich gegenseitig im 5-Sekunden-Auto-Save.

Konzeptbeschluß:

- Der **Datenstand** (`ci-lb-v4`), die **Tab-/Sub-Tab-Wahl**, der
  **Dateinamen-Suffix** und die **Debug-Flags** wandern auf
  `sessionStorage`. Jeder Browser-Tab ist damit eine eigene Insel.
  F5 erhält den Stand, Schließen des Tabs verwirft ihn.
- Die **Sprach-Auswahl** (`ci-lb-lang`) bleibt in `localStorage` —
  ein neu geöffneter Tab soll nicht jedes Mal wieder auf Englisch
  starten.
- Beim **ersten Aufruf der neuen Version** wird der alte
  `ci-lb-v4`-Stand aus `localStorage` **nicht automatisch übernommen**.
  Wer weiterarbeiten möchte, lädt seine zuletzt gespeicherte JSON-Datei.

Tab-Duplizieren (Strg-Klick / Kontextmenü) bleibt browserabhängig —
manche Browser kopieren sessionStorage in den neuen Tab, manche nicht.
Kein Spezial-Code.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.1.163-beta";
```

---

## Schritt 2 — `js/init.js`: Auto-Save (`_autoSaveState`) auf
sessionStorage umstellen

In der Funktion `_autoSaveState()` (aus BA 161, im
DOMContentLoaded-Handler) genau eine Zeile umstellen.

**Vorher:**
```js
      localStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({ ... })
      );
```

**Nachher:**
```js
      // BA 163: Auto-Save isoliert pro Browser-Tab
      sessionStorage.setItem(
        "ci-lb-v4",
        JSON.stringify({ ... })
      );
```

---

## Schritt 3 — `js/init.js`: Lade-Routine auf sessionStorage

Im selben `DOMContentLoaded`-Handler, an der Stelle „Load from
localStorage" (Z. 608-734). Nur den Lesezugriff umstellen.

**Vorher (`js/init.js` Z. 609-610):**
```js
  try {
    const sv = localStorage.getItem("ci-lb-v4");
```

**Nachher:**
```js
  try {
    // BA 163: Pro-Tab-Isolation — Lesen aus sessionStorage
    const sv = sessionStorage.getItem("ci-lb-v4");
```

Den Kommentar `// Load from localStorage` direkt darüber zu
`// BA 163: Load from sessionStorage (pro Browser-Tab)` ändern.

---

## Schritt 4 — `js/init.js`: plBothSides-Change-Handler

Im `plBothSides`-Change-Handler (ca. Z. 134-141), drei Stellen:

**Vorher:**
```js
      try {
        const _sv = localStorage.getItem("ci-lb-v4");
        if (_sv) {
          const _d = JSON.parse(_sv);
          _d.plBothSides = this.checked;
          localStorage.setItem("ci-lb-v4", JSON.stringify(_d));
        }
      } catch (_e) {}
```

**Nachher:**
```js
      try {
        // BA 163: pro Browser-Tab
        const _sv = sessionStorage.getItem("ci-lb-v4");
        if (_sv) {
          const _d = JSON.parse(_sv);
          _d.plBothSides = this.checked;
          sessionStorage.setItem("ci-lb-v4", JSON.stringify(_d));
        }
      } catch (_e) {}
```

---

## Schritt 5 — `js/init.js`: Dateinamen-Suffix

Drei Stellen (ca. Z. 331, 345, 362).

**Vorher (Z. 331):**
```js
      try { localStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
```

**Nachher:**
```js
      // BA 163: pro Browser-Tab
      try { sessionStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
```

**Vorher (Z. 345):**
```js
      try { localStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
```

**Nachher:**
```js
      // BA 163: pro Browser-Tab
      try { sessionStorage.setItem("ci-lb-userFileSuffix", userFileSuffix); } catch (e) {}
```

**Vorher (Z. 362):**
```js
  try {
    const _sufSaved = localStorage.getItem("ci-lb-userFileSuffix");
```

**Nachher:**
```js
  try {
    // BA 163: pro Browser-Tab
    const _sufSaved = sessionStorage.getItem("ci-lb-userFileSuffix");
```

---

## Schritt 6 — `js/init.js`: Aktiver Tab + Sub-Tabs beim Reload

Im hinteren Bereich des `DOMContentLoaded`-Handlers, Z. 867-883.
Zwei Lesezugriffe.

**Vorher (Z. 867):**
```js
      const savedTab = localStorage.getItem("ci-lb-activeTab");
```

**Nachher:**
```js
      // BA 163: pro Browser-Tab
      const savedTab = sessionStorage.getItem("ci-lb-activeTab");
```

**Vorher (Z. 877):**
```js
        const savedSub = localStorage.getItem("ci-lb-subtab-" + parent);
```

**Nachher:**
```js
        // BA 163: pro Browser-Tab
        const savedSub = sessionStorage.getItem("ci-lb-subtab-" + parent);
```

---

## Schritt 7 — `js/tabs-eq.js`: Tab- und Sub-Tab-Persistierung

Zwei Stellen umstellen.

**Vorher (`js/tabs-eq.js` Z. 50):**
```js
  try { localStorage.setItem("ci-lb-subtab-" + parent, subtab); } catch (e) {}
```

**Nachher:**
```js
  // BA 163: pro Browser-Tab
  try { sessionStorage.setItem("ci-lb-subtab-" + parent, subtab); } catch (e) {}
```

**Vorher (`js/tabs-eq.js` Z. 98):**
```js
  try { localStorage.setItem("ci-lb-activeTab", n); } catch (e) {}
```

**Nachher:**
```js
  // BA 163: pro Browser-Tab
  try { sessionStorage.setItem("ci-lb-activeTab", n); } catch (e) {}
```

---

## Schritt 8 — `js/debug.js`: Debug-Status + Debug-Flags

Vier Stellen in `js/debug.js`. Beide Debug-Schlüssel wandern auf
sessionStorage.

**Vorher (Z. 24):**
```js
  try {
    const raw = localStorage.getItem(FLAG_KEY);
```

**Nachher:**
```js
  try {
    // BA 163: pro Browser-Tab
    const raw = sessionStorage.getItem(FLAG_KEY);
```

**Vorher (Z. 34):**
```js
    try { localStorage.setItem(FLAG_KEY, JSON.stringify(_flags)); } catch (_) {}
```

**Nachher:**
```js
    // BA 163: pro Browser-Tab
    try { sessionStorage.setItem(FLAG_KEY, JSON.stringify(_flags)); } catch (_) {}
```

**Vorher (Z. 58-61):**
```js
  function _readPersistedActive() {
    try { return localStorage.getItem(DBG_KEY) === '1'; }
    catch (_) { return false; }
  }
```

**Nachher:**
```js
  function _readPersistedActive() {
    // BA 163: pro Browser-Tab
    try { return sessionStorage.getItem(DBG_KEY) === '1'; }
    catch (_) { return false; }
  }
```

**Vorher (Z. 63-68):**
```js
  function _writePersistedActive(v) {
    try {
      if (v) localStorage.setItem(DBG_KEY, '1');
      else   localStorage.removeItem(DBG_KEY);
    } catch (_) {}
  }
```

**Nachher:**
```js
  function _writePersistedActive(v) {
    // BA 163: pro Browser-Tab
    try {
      if (v) sessionStorage.setItem(DBG_KEY, '1');
      else   sessionStorage.removeItem(DBG_KEY);
    } catch (_) {}
  }
```

---

## Schritt 9 — `js/i18n.js`: Sprache bleibt unverändert

**Keine Änderung.** `js/i18n.js:118` (`localStorage.setItem(
"ci-lb-lang", lang)`) und `js/init.js:3` (`localStorage.getItem(
"ci-lb-lang")`) bleiben so. Sprache ist global pro Browser.

---

## Akzeptanztest

1. **Tool frisch laden.** Version oben rechts: `3.1.163-beta`.
2. **Reiter Implantat → Hersteller links auf MED-EL,
   rechts auf Cochlear setzen.** Patientenkurzdaten eingeben.
3. **Zweiten Browser-Tab öffnen** mit derselben URL.
   Erwartet: Der neue Tab startet **leer** — kein Hersteller,
   keine Patientendaten, kein „Alles löschen"-Bestätigungs-Hinweis.
4. **Im neuen Tab Hersteller links auf Advanced Bionics setzen.**
   Zurück in den ersten Tab wechseln, F5. Erwartet: Erste Tab zeigt
   weiterhin **MED-EL** (nicht AB), Daten unverändert.
5. **Im zweiten Tab F5.** Erwartet: Der AB-Stand bleibt erhalten.
6. **Beide Tabs schließen, dann das Tool neu öffnen.** Erwartet:
   Komplett leer (sessionStorage verfällt mit Tab-Schließen).
7. **Sprache im einen Tab auf English umstellen, neuen Tab
   öffnen.** Erwartet: Neuer Tab startet auch auf English (Sprache
   bleibt global).
8. **Dateinamen-Suffix „Martin" eingeben, neuen Tab öffnen.**
   Erwartet: Im neuen Tab ist das Suffix-Feld leer.
9. **Debug-Modus per `?debug=1` in URL oder Logo-Doppelklick
   aktivieren.** In zweitem Tab das Tool ohne `?debug=1` aufrufen.
   Erwartet: Im zweiten Tab ist das Debug-Panel **nicht** sichtbar.
10. **Aktiven Reiter im ersten Tab auf „Kurven" stellen, im zweiten
    Tab auf „Player".** F5 in beiden. Erwartet: Erster Tab zeigt
    weiterhin „Kurven", zweiter weiterhin „Player".
11. **Migration**: In den DevTools (F12) → Application → Local
    Storage prüfen. Erwartet: Schlüssel `ci-lb-lang` ist da. Die
    Schlüssel `ci-lb-v4`, `ci-lb-activeTab`, `ci-lb-subtab-*`,
    `ci-lb-userFileSuffix`, `ciSb.debugActive`, `ciSb.debugFlags`
    sind **nicht** im localStorage angelegt, wenn sie nicht von
    Vor-BA-163-Ständen übrig sind. Session Storage enthält sie
    pro Tab.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 11 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich melden:
- Welche Stellen wurden umgestellt? Liste mit Datei und Zeilennummer.
- Wurde **keine** Änderung an `js/i18n.js` Z. 118 und `js/init.js`
  Z. 3 (Sprache laden) vorgenommen?
- Sind alle Vorkommen von `localStorage` außerhalb der Sprach-Stellen
  in den vier Zieldateien umgestellt? (Per `grep -n "localStorage"
  js/init.js js/tabs-eq.js js/debug.js` prüfen — übrig bleibende
  Treffer müssen begründet sein.)
- Steht `js/version.js` auf `3.1.163-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/init.js` — Auto-Save, initialer Load, plBothSides-Handler,
  userFileSuffix (3×), aktiver Tab + Sub-Tab-Load
- `js/tabs-eq.js` — Tab- und Sub-Tab-Persistierung (2×)
- `js/debug.js` — Debug-Active + Debug-Flags (4×)

---

## Nicht in dieser Bauanleitung enthalten

- **BA 164** — Checkbox-Spalte „Aktiv" und neues Bool-Array.
- **BA 165** — L↔R-Knöpfe im Reiter Kurven.
- Aufräumen alter `localStorage`-Reste vom Vorgänger-Tool. Der
  Browser-Stand wird absichtlich nicht migriert; eine spätere
  optionale Mini-Anleitung könnte die alten Keys per `localStorage.
  removeItem(...)` beim ersten Start bereinigen.
