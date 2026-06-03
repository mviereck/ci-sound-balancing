# BAUANLEITUNG 185 — Rubberband-UI-Integration mit Stub-Funktion

## Zweck und Scope

Zweite von drei Bauanleitungen für das Rubberband-Frequenzwarping.
Diese Anleitung hängt das neue Verfahren **vollständig in die Player-
UI** ein — Dropdown-Eintrag, Defaults in allen relevanten JS-Dateien,
i18n-Strings (nur deutsch), Trigger-Verzweigung, Status-Anzeige,
Aufräumen des `pwBtnRecompute`-Dead-Codes. Die eigentliche Compute-
Funktion bleibt **leer**: sie wirft sofort einen sprechenden Fehler,
der in der Player-Status-Anzeige erscheint. Damit kann der Nutzer den
UI-Stand prüfen, ohne daß der Audio-Pfad schon klanglich neuen Output
produziert.

i18n-Strings werden **nur deutsch** gepflegt. Englisch, Französisch,
Spanisch werden in einer Folge-Mini-Bauanleitung nachgezogen.

### Voraussetzung

BA 184 ist gebaut und akzeptiert. `vendors/rubberband-wasm/dist/`
enthält die zwei Dateien, `js/rubberband-loader.js` existiert,
`await rubberbandLoad()` funktioniert in der Konsole.

### Vorabprüfung durch Sonnet

Prüfe per `grep -n 'APP_VERSION' js/version.js`, ob die Datei
`"3.2.184-beta"` enthält. Wenn nicht: rückfragen.

---

## Schritt 1 — `i18n/de.js` aktualisieren

Drei Aktionen: neuen Verfahrens-Namen einführen, neue Status-Zeilen
einführen, Dead-Code-Key entfernen.

### Vorher (Z. 696-700)

```javascript
    pwMethod: "Verfahren",
    pwMethodOffline: "Offline-Vorberechnung (beste Qualität)",
    pwMethodVocoder: "Phasen-Vocoder (Live, mit Latenz)",
    pwMethodSinModel: "Sinusoidal Modeling",
    pwMethodBandShift: "Bandweise Pitch-Shift (Live)",
```

### Nachher

```javascript
    pwMethod: "Verfahren",
    pwMethodRubberband: "Rubberband (Vorberechnung, beste Qualität)",
    pwMethodOffline: "Offline-Vorberechnung",
    pwMethodVocoder: "Phasen-Vocoder (Live, mit Latenz)",
    pwMethodSinModel: "Sinusoidal Modeling",
    pwMethodBandShift: "Bandweise Pitch-Shift (Live)",
```

### Vorher (Z. 708-716)

```javascript
    pwStatusActiveOffline: "Aktiv – Offline ({n} Stützpunkte)",
    pwStatusActiveBandShift: "Aktiv – Bandweise ({n} Stützpunkte)",
    pwStatusActiveVocoder: "Aktiv – Phasen-Vocoder ({n} Stützpunkte)",
    pwStatusActiveSinModel: "Sinusoidal aktiv ({n} Stützpunkte)",
```

```javascript
    pwHintNoFRes: "Bitte zuerst den Frequenzabgleich-Test durchführen.",
    pwBtnRecompute: "Neu berechnen",
```

### Nachher

```javascript
    pwStatusActiveRubberband: "Aktiv – Rubberband ({n} Stützpunkte)",
    pwStatusActiveOffline: "Aktiv – Offline ({n} Stützpunkte)",
    pwStatusActiveBandShift: "Aktiv – Bandweise ({n} Stützpunkte)",
    pwStatusActiveVocoder: "Aktiv – Phasen-Vocoder ({n} Stützpunkte)",
    pwStatusActiveSinModel: "Sinusoidal aktiv ({n} Stützpunkte)",
    pwStatusRubberbandLoading: "Rubberband wird geladen …",
    pwStatusRubberbandError: "Rubberband-Fehler: {msg}",
```

```javascript
    pwHintNoFRes: "Bitte zuerst den Frequenzabgleich-Test durchführen.",
```

**Konkret:**

- Neuen Key `pwMethodRubberband` direkt **vor** `pwMethodOffline`
  einfügen.
- Bei `pwMethodOffline` den Halbsatz „(beste Qualität)" streichen — die
  Bezeichnung gilt jetzt für Rubberband.
- Neuen Key `pwStatusActiveRubberband` direkt **vor**
  `pwStatusActiveOffline` einfügen.
- Neue Keys `pwStatusRubberbandLoading` und `pwStatusRubberbandError`
  hinter den Status-Active-Keys einfügen.
- Den Key `pwBtnRecompute` **ersatzlos löschen** — das HTML-Element
  `#plWarpRecalc` existiert nicht, der zugehörige JS-Lookup läuft ins
  Leere und wird in Schritt 3 entfernt.

### Andere Sprachen — bewußt nicht anfassen

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` bleiben **komplett
unverändert**. Auch die dortigen `pwBtnRecompute`-Einträge werden
**nicht** entfernt — das Aufräumen kommt mit der i18n-Folge-Bauanleitung.
Fehlende Keys (`pwMethodRubberband` etc.) fallen auf die deutschen
Defaults zurück (Verhalten in `js/i18n.js`).

---

## Schritt 2 — `index.html` Dropdown erweitern

### Vorher (Z. 1225-1230)

```html
                <select id="plWarpMethod" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="offline" data-t-opt="pwMethodOffline"></option>
                  <option value="vocoder" data-t-opt="pwMethodVocoder"></option>
                  <option value="sinmodel" data-t-opt="pwMethodSinModel" selected></option>
                  <option value="bandshift" data-t-opt="pwMethodBandShift"></option>
                </select>
```

### Nachher

```html
                <select id="plWarpMethod" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="rubberband" data-t-opt="pwMethodRubberband" selected></option>
                  <option value="offline" data-t-opt="pwMethodOffline"></option>
                  <option value="vocoder" data-t-opt="pwMethodVocoder"></option>
                  <option value="sinmodel" data-t-opt="pwMethodSinModel"></option>
                  <option value="bandshift" data-t-opt="pwMethodBandShift"></option>
                </select>
```

**Konkret:**

- Neuen `<option value="rubberband">` als erste Zeile einfügen, mit
  `selected`.
- Beim `<option value="sinmodel">` das `selected`-Attribut entfernen.

---

## Schritt 3 — `js/init.js`: Label-Array und Recalc-Cleanup

### 3a — Method-Labels-Array (Z. 63-69)

Das Array koppelt die Dropdown-Reihenfolge an i18n-Keys per Index. Da
Rubberband an erster Stelle steht, muß der erste Key
`pwMethodRubberband` sein.

### Vorher

```javascript
  function _pWarpApplyMethodLabels() {
    const sel = document.getElementById("plWarpMethod");
    if (!sel) return;
    const keys = ["pwMethodOffline", "pwMethodVocoder", "pwMethodSinModel", "pwMethodBandShift"];
    for (let i = 0; i < sel.options.length; i++) {
      if (keys[i]) sel.options[i].text = t(keys[i]);
    }
```

### Nachher

```javascript
  function _pWarpApplyMethodLabels() {
    const sel = document.getElementById("plWarpMethod");
    if (!sel) return;
    const keys = ["pwMethodRubberband", "pwMethodOffline", "pwMethodVocoder", "pwMethodSinModel", "pwMethodBandShift"];
    for (let i = 0; i < sel.options.length; i++) {
      if (keys[i]) sel.options[i].text = t(keys[i]);
    }
```

**Konkret:** `"pwMethodRubberband"` als erstes Element ins `keys`-Array
einfügen.

### 3b — Recalc-Button-Listener entfernen (Z. 516-522)

### Vorher

```javascript
  // Neu-berechnen-Button
  const _plWarpRecalcEl = document.getElementById("plWarpRecalc");
  if (_plWarpRecalcEl) {
    _plWarpRecalcEl.addEventListener("click", function () {
      if (pWarpOn) pWarpTrigger();
    });
  }
  // Warp-UI initialisieren
```

### Nachher

```javascript
  // Warp-UI initialisieren
```

**Konkret:** Die sieben Zeilen (Kommentar + `const _plWarpRecalcEl`-Block)
ersatzlos löschen. Das HTML-Element existiert nicht, der Listener läuft
ins Leere. Der Kommentar „Warp-UI initialisieren" bleibt als nächste
Zeile direkt anschließend.

---

## Schritt 4 — `js/freq-warp.js`: Default, Stub, Trigger, Status

Vier Edits in dieser Datei.

### 4a — Default-Wert für `pWarpMethod` (Z. 532)

### Vorher

```javascript
let pWarpMethod = "sinmodel";   // "offline" | "bandshift" | "vocoder" | "sinmodel"
```

### Nachher

```javascript
let pWarpMethod = "rubberband";   // "rubberband" | "offline" | "bandshift" | "vocoder" | "sinmodel"
```

### 4b — Stub-Funktion `pComputeRubberbandWarpedBuffer` einfügen

Direkt nach `pComputeWarpedBuffer` (Z. 802, vor dem Kommentar
`// ---- Variante B: Live Bandweise Pitch-Shift`) folgendes einfügen:

```javascript
// ---- Variante E: Rubberband-WASM Offline-Vorberechnung -----
// Stub — Implementierung folgt in BA 186.
async function pComputeRubberbandWarpedBuffer(srcBuf, warpMode, strength) {
  throw new Error("Implementierung folgt in BA 186");
}
```

Diese Stub-Funktion wirft beim Aufruf einen sprechenden Fehler. Der
Fehler wird vom `pWarpTrigger`-Aufrufer (siehe 4d) gefangen und
über `rubberbandLastError` in die Status-Anzeige durchgereicht.

### 4c — `pWarpUpdUI` Status-Cases erweitern

### Vorher (Z. 1083-1095)

```javascript
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (method === "offline") {
    statusText = pWarpedBuf
      ? t("pwStatusActiveOffline").replace("{n}", n)
      : t("pwStatusReady");
  } else if (method === "bandshift") {
    statusText = t("pwStatusActiveBandShift").replace("{n}", n);
  } else if (method === "vocoder") {
    statusText = t("pwStatusActiveVocoder").replace("{n}", n);
  } else if (method === "sinmodel") {
    statusText = t("pwStatusActiveSinModel").replace("{n}", n);
  }
```

### Nachher

```javascript
  } else if (noData) {
    statusText = t("pwStatusReady");
  } else if (method === "rubberband") {
    if (typeof rubberbandLastError !== "undefined" && rubberbandLastError) {
      statusText = t("pwStatusRubberbandError").replace("{msg}", rubberbandLastError);
    } else if (pWarpBusy) {
      statusText = t("pwStatusRubberbandLoading");
    } else {
      statusText = pWarpedBuf
        ? t("pwStatusActiveRubberband").replace("{n}", n)
        : t("pwStatusReady");
    }
  } else if (method === "offline") {
    statusText = pWarpedBuf
      ? t("pwStatusActiveOffline").replace("{n}", n)
      : t("pwStatusReady");
  } else if (method === "bandshift") {
    statusText = t("pwStatusActiveBandShift").replace("{n}", n);
  } else if (method === "vocoder") {
    statusText = t("pwStatusActiveVocoder").replace("{n}", n);
  } else if (method === "sinmodel") {
    statusText = t("pwStatusActiveSinModel").replace("{n}", n);
  }
```

**Konkret:** Den neuen `else if (method === "rubberband") { ... }`-Block
**vor** dem bestehenden `else if (method === "offline")` einfügen.

### 4d — Recalc-Dead-Code in `pWarpUpdUI` entfernen

### Vorher (Z. 1047)

```javascript
  const recalcBtn = document.getElementById("plWarpRecalc");
  const methodSel = document.getElementById("plWarpMethod");
```

### Nachher

```javascript
  const methodSel = document.getElementById("plWarpMethod");
```

### Vorher (Z. 1122-1132)

```javascript
  // Recalc-Button nur beim Offline-Verfahren
  if (recalcBtn) {
    const showRecalc = pWarpOn && !noFRes && method === "offline";
    recalcBtn.style.display = showRecalc ? "" : "none";
    recalcBtn.disabled = pWarpBusy;
    recalcBtn.textContent = t("pwBtnRecompute");
  }

  // Play-Button nur bei Offline-Berechnung sperren
  const playBtn = document.getElementById("plPlay");
  if (playBtn) playBtn.disabled = pWarpBusy && method === "offline";
```

### Nachher

```javascript
  // Play-Button bei laufender Vorberechnung sperren (Offline + Rubberband)
  const playBtn = document.getElementById("plPlay");
  if (playBtn) playBtn.disabled = pWarpBusy && (method === "offline" || method === "rubberband");
```

**Konkret:**

- Die Variablen-Definition `const recalcBtn = ...` (Z. 1047) löschen.
- Den gesamten `if (recalcBtn) { ... }`-Block (sieben Zeilen mit
  Kommentar) löschen.
- Die Play-Button-Disable-Bedingung um `rubberband` erweitern.

Sanity-Check nach den Edits: `grep -n 'plWarpRecalc' js/freq-warp.js`
sollte 0 Treffer ergeben.

### 4e — `pWarpTrigger` für Rubberband (Z. 1136-1187)

### Vorher (Z. 1152-1187)

```javascript
  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "offline";
  pWarpMethod = method;

  // Variante B und A brauchen keine Vorberechnung – UI aktualisieren, fertig
  if (method !== "offline") {
    pWarpUpdUI();
    return;
  }

  // Variante C: Offline-Vorberechnung. fRes-Argument ist nur Legacy-API —
  // pComputeWarpedBuffer ignoriert es und liest _warpFResSource() selbst.
  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpUpdUI();

  try {
    pWarpedBuf = await pComputeWarpedBuffer(
      pSourceBuf,
      pWarpMode,
      pWarpStrength,
      null
    );
  } catch (err) {
    console.error("Warp-Fehler:", err);
    pWarpedBuf = null;
  }

  pWarpBusy = false;
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying) pPlay();
}
```

### Nachher

```javascript
  const methodSel = document.getElementById("plWarpMethod");
  const method = methodSel ? methodSel.value : "rubberband";
  pWarpMethod = method;

  // Live-Verfahren (vocoder, sinmodel, bandshift) brauchen keine
  // Vorberechnung — UI aktualisieren, fertig.
  if (method !== "offline" && method !== "rubberband") {
    pWarpUpdUI();
    return;
  }

  // Offline-Verfahren (offline, rubberband): Vorberechnung mit
  // Pause-Resume um den Lauf herum.
  const wasPlaying = pPlaying;
  if (wasPlaying) pPause();

  pWarpBusy = true;
  pWarpUpdUI();

  try {
    if (method === "rubberband") {
      pWarpedBuf = await pComputeRubberbandWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength
      );
    } else {
      pWarpedBuf = await pComputeWarpedBuffer(
        pSourceBuf,
        pWarpMode,
        pWarpStrength,
        null
      );
    }
  } catch (err) {
    console.error("Warp-Fehler:", err);
    pWarpedBuf = null;
    // rubberbandLastError wird vom Loader bzw. der Stub-Implementierung
    // gesetzt; pWarpUpdUI liest es spaeter und zeigt es im Status.
    if (method === "rubberband" && typeof rubberbandLastError !== "undefined" && !rubberbandLastError) {
      // Falls der Fehler nicht aus dem Loader kommt (sondern aus dem Stub
      // oder aus pComputeRubberbandWarpedBuffer selbst), packen wir die
      // Fehler-Message in rubberbandLastError, damit der Status sie zeigt.
      rubberbandLastError = err && err.message ? err.message : String(err);
    }
  }

  pWarpBusy = false;
  pBuf = getPlaybackBuffer();
  pWarpUpdUI();

  if (wasPlaying) pPlay();
}
```

**Konkret:**

- Default in `methodSel ? ... : "offline"` auf `"rubberband"` ändern.
- Bedingung `if (method !== "offline")` auf
  `if (method !== "offline" && method !== "rubberband")` erweitern.
- Den bestehenden `pComputeWarpedBuffer`-Aufruf in eine
  `if (method === "rubberband") { ... } else { ... }`-Verzweigung
  einbetten.
- Im `catch`-Zweig die Fehler-Übergabe an `rubberbandLastError`
  ergänzen, damit Fehler aus der Stub-Funktion (BA 185) und der echten
  Compute-Funktion (BA 186) gleichermaßen sichtbar werden.
- Kommentare anpassen.

---

## Schritt 5 — `js/player.js`: `getPlaybackBuffer` für Rubberband

### Vorher (Z. 168-173)

```javascript
  const _warpMethodEl = document.getElementById("plWarpMethod");
  const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "offline";
  // EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
  const warpReady = typeof pWarpOn !== "undefined"
                  && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy
                  && _warpMethod === "offline";
```

### Nachher

```javascript
  const _warpMethodEl = document.getElementById("plWarpMethod");
  const _warpMethod = _warpMethodEl ? _warpMethodEl.value : "rubberband";
  // EQ-Toggle wirkt als Master: wenn EQ aus, ist auch der Warp-Pfad bypass.
  const warpReady = typeof pWarpOn !== "undefined"
                  && pWarpOn && plEqOn && pWarpedBuf && !pWarpBusy
                  && (_warpMethod === "offline" || _warpMethod === "rubberband");
```

**Konkret:**

- Default `: "offline"` auf `: "rubberband"` ändern.
- `_warpMethod === "offline"` auf
  `(_warpMethod === "offline" || _warpMethod === "rubberband")`
  erweitern.

In `pPlay()` (Z. 458 ff.) sind **keine Änderungen** nötig — die
`else`-Verzweigung „Normal oder Offline-Warp (Variante C)" deckt
automatisch alle Methoden außer `bandshift`, `vocoder`, `sinmodel` ab.
Auch der Stub-Fall (Wiedergabe ohne erfolgreich vorberechneten Buffer)
funktioniert: `pWarpedBuf` bleibt `null`, `getPlaybackBuffer` liefert
den Original-Buffer, Original wird abgespielt — die Status-Anzeige
zeigt den Fehler.

---

## Schritt 6 — `js/file.js`: Default-Werte für Save/Load

### 6a — Reset-Default (Z. 109)

### Vorher

```javascript
    pWarpMethod = "sinmodel";
```

### Nachher

```javascript
    pWarpMethod = "rubberband";
```

### 6b — Save-Default (Z. 255)

### Vorher

```javascript
    warpMethod: (typeof pWarpMethod !== "undefined") ? pWarpMethod : "offline",
```

### Nachher

```javascript
    warpMethod: (typeof pWarpMethod !== "undefined") ? pWarpMethod : "rubberband",
```

---

## Schritt 7 — `js/print-md.js` Print-Default (Z. 361)

### Vorher

```javascript
    warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "offline",
```

### Nachher

```javascript
    warpMethod:   (typeof pWarpMethod   !== "undefined") ? pWarpMethod   : "rubberband",
```

---

## Schritt 8 — `docs/spec/06-player.md` minimal aktualisieren

In dieser BA wird in der SPEC **nur** der Default-Wechsel reflektiert.
Der ausführliche Verfahrens-Bullet kommt erst in BA 186, sobald das
Verfahren wirklich klanglich funktioniert.

### 8a — Default-Satz (sinngemäße Stelle, ca. Z. 141)

### Vorher

```markdown
  - Defaults: Verfahren = Sinusoidal Modeling, Korrektur-Modus = Rechte Seite.
```

### Nachher

```markdown
  - Defaults: Verfahren = Rubberband, Korrektur-Modus = Rechte Seite.
```

Falls dieser Default-Satz nicht wörtlich so dasteht: stattdessen die
Stelle suchen, an der „Default … Sinusoidal Modeling" erwähnt ist, und
durch „Rubberband" ersetzen.

### 8b — Recalc-Halbsatz streichen (Z. 121)

### Vorher

```markdown
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play; Recalc-Button bei Änderung von Modus/Stärke/fRes nötig
```

### Nachher

```markdown
  - **Offline-Vorberechnung** (Variante C): rendert gewarpten Buffer vor
    dem Play
```

**Konkret:** Den Halbsatz „; Recalc-Button bei Änderung von
Modus/Stärke/fRes nötig" ersatzlos löschen. Der Button existiert nicht
mehr im HTML, das Aufräumen ist in BA 185 abgeschlossen.

Andere Stellen in der SPEC bleiben unangetastet — die ausführliche
Beschreibung des Rubberband-Verfahrens folgt in BA 186.

---

## Schritt 9 — `js/version.js` Versions-Bump

### Vorher

```javascript
const APP_VERSION = "3.2.184-beta";
```

### Nachher

```javascript
const APP_VERSION = "3.2.185-beta";
```

---

## Akzeptanztest

### A — Smoke-Test

1. Tool über lokalen Server öffnen, Browser-Konsole aufmachen.
2. Erwartet: keine roten JS-Fehler, Versions-Tag zeigt `3.2.185-beta`.

### B — Dropdown-Anzeige

1. Tab „Player" öffnen.
2. Frequenz-Warping-Toggle einschalten → Einstellungsbox klappt auf.
3. Verfahrens-Dropdown öffnen.
4. Erwartet: **fünf** Optionen in dieser Reihenfolge: Rubberband,
   Offline, Phasen-Vocoder, Sinusoidal Modeling, Bandweise.
5. Default-Auswahl ist **Rubberband (Vorberechnung, beste Qualität)**.
6. Sprache auf English/Français/Español wechseln. Erwartet: erster
   Dropdown-Eintrag bleibt sichtbar (fällt auf deutschen Text zurück,
   weil andere Sprachen den Key noch nicht haben — das ist
   beabsichtigt).

### C — Rubberband-Auswahl ohne fRes-Daten

1. Frequenz-Warping aktiv, Verfahren „Rubberband", **keine**
   Frequenzabgleich-Messung vorhanden.
2. Status zeigt: „Bereit — Bitte zuerst den Frequenzabgleich-Test
   durchführen".
3. Audio laden, Play. Erwartet: spielt Original (Warp ist Bypass,
   keine Fehlermeldung).

### D — Rubberband-Auswahl mit fRes-Daten: Stub-Fehler sichtbar

1. Frequenzabgleich-Daten vorhanden (mindestens 3 Stützpunkte).
2. Frequenz-Warping aktiv, Verfahren „Rubberband", Stärke 100 %.
3. Audio laden, Play.
4. Erwartet:
   - Beim ersten Play kurze Pause (WASM lädt).
   - Danach Status zeigt: **„Rubberband-Fehler: Implementierung folgt in
     BA 186"**.
   - Konsole zeigt `console.error` mit derselben Message.
   - Original-Audio wird abgespielt (kein gewarpter Buffer, weil die
     Stub-Funktion fehlschlägt → `pWarpedBuf` bleibt `null` → Player
     fällt auf Original zurück).
5. Auf Verfahren „Sinusoidal Modeling" wechseln. Erwartet:
   normale gewarpte Wiedergabe wie vor der BA, Fehlermeldung
   verschwindet.

### E — Andere Verfahren unverändert

1. Verfahren „Sinusoidal Modeling": Play, hörbarer Warp. Funktioniert
   wie vor der BA.
2. Verfahren „Phasen-Vocoder": Play. Funktioniert wie vor der BA.
3. Verfahren „Bandweise": Play. Funktioniert wie vor der BA.
4. Verfahren „Offline-Vorberechnung": Play (kurze Pause für Vorberechnung).
   Funktioniert wie vor der BA.

### F — Recalc-Cleanup

1. Browser-Konsole: `document.getElementById("plWarpRecalc")` → `null`.
2. DevTools Source-Suche nach `plWarpRecalc` in den geladenen Skripten:
   **keine Treffer** in `js/init.js` und `js/freq-warp.js`.

### G — Persistenz (Save/Load)

1. Speichern (Tool-Save in JSON).
2. Tool neu laden (Browser-Refresh oder JSON-Load).
3. Erwartet: Verfahren bleibt „Rubberband" gewählt.
4. In einem frischen Tool-State (Reset / leere Save-Datei): Default ist
   Rubberband.

---

## Selbstprüfungs-Auftrag an Sonnet

**Bevor du fertig meldest**, gehe jede Akzeptanz-Kriterie einzeln durch
und melde **erfüllt / nicht erfüllt / unklar** mit Datei und Zeilen-
Angabe:

1. `i18n/de.js`: Keys `pwMethodRubberband`, `pwStatusActiveRubberband`,
   `pwStatusRubberbandLoading`, `pwStatusRubberbandError` vorhanden,
   `pwBtnRecompute` **entfernt**, `pwMethodOffline` ohne „(beste
   Qualität)".
2. `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`: **unverändert** (kein Edit).
3. `index.html`: Dropdown `#plWarpMethod` hat fünf Optionen, `rubberband`
   als erste mit `selected`, `sinmodel` ohne `selected`.
4. `js/init.js`: `_pWarpApplyMethodLabels`-Array beginnt mit
   `"pwMethodRubberband"`. `plWarpRecalc`-Listener und vorangehender
   Kommentar entfernt.
5. `js/freq-warp.js`: `pWarpMethod`-Default ist `"rubberband"`. Funktion
   `pComputeRubberbandWarpedBuffer` existiert und wirft sofort
   `new Error("Implementierung folgt in BA 186")`. `pWarpTrigger` ruft
   sie bei `method === "rubberband"`. `pWarpUpdUI` hat Status-Case
   für `rubberband` mit Loading/Error/Active-Differenzierung. Die
   `recalcBtn`-Variable und der `if (recalcBtn)`-Block sind entfernt.
   `grep -n 'plWarpRecalc' js/freq-warp.js` → 0 Treffer.
6. `js/player.js`: `getPlaybackBuffer` akzeptiert `rubberband` zusätzlich
   zu `offline` als warpReady-Bedingung, Default-String ist
   `"rubberband"`.
7. `js/file.js`: Reset-Default Z. 109 ist `"rubberband"`, Save-Default
   Z. 255 hat Fallback `"rubberband"`.
8. `js/print-md.js`: Print-Default ist `"rubberband"`.
9. `docs/spec/06-player.md`: Default-Satz auf „Rubberband" aktualisiert,
   Recalc-Halbsatz beim Offline-Bullet gestrichen. **Kein** neuer
   Verfahrens-Bullet für Rubberband eingefügt (kommt in BA 186).
10. `js/version.js`: `APP_VERSION = "3.2.185-beta"`.

Bei „unklar" rückfragen, nicht still annehmen.

**Übliche Fallen:**
- ASCII-Quotes in JS/HTML/CSS verwenden, keine typographischen „".
- i18n-Strings in `i18n/de.js` durchgängig mit doppelten Quotes; die
  enthaltenen Umlaute und „—" sind ok.
- Beim Edit in `freq-warp.js` nach jedem Edit per
  `grep -n 'plWarpRecalc' js/freq-warp.js` prüfen — 0 Treffer ist
  Pflicht.

---

## Hinweis auf Folge-Bauanleitung (i18n)

Eine spätere Mini-Bauanleitung wird die englischen, französischen und
spanischen Strings für `pwMethodRubberband`, `pwStatusActiveRubberband`,
`pwStatusRubberbandLoading`, `pwStatusRubberbandError` nachziehen und
die `pwBtnRecompute`-Einträge in en/fr/es entfernen. Diese BA wird vom
Nutzer angefordert, wenn die deutsche Vorlage final ist — nicht jetzt
initiieren.

---

## Nach Abschluß manuell prüfen

- Tool startet ohne Fehler, Rubberband ist Default im Dropdown.
- Verfahren-Wechsel zu Rubberband + Play bei vorhandenen fRes-Daten:
  zeigt sprechenden Fehler im Status, kein Crash.
- Verfahren-Wechsel weg von Rubberband (z.B. zu Sinusoidal): Status-
  Fehler verschwindet, normale Wiedergabe.
- Save/Load merkt sich das gewählte Verfahren.

Die nächste Bauanleitung (BA 186 — Compute-Funktion) ersetzt die Stub-
Funktion durch die eigentliche FIR-Bandpaß + Rubberband-Pitch-Shift-
Implementierung.
