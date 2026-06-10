# Bauanleitung 20: MAPLAW-UI, Persistenz, Doku, Alt-Code aufräumen

Dritte und letzte Bauanleitung der MAPLAW-Phase-3-Serie. Setzt
Bauanleitung 18 (Worklet) und 19 (Audio-Graph-Integration) voraus.

Diese Anleitung:
1. Entfernt die versteckte alte MAPLAW-UI in `index.html` und den
   toten WaveShaper-Code in `player.js`.
2. Baut die neue MAPLAW-Card in den Player ein.
3. Verdrahtet die UI mit den State-Variablen und ruft
   `pMaplawTrigger` bei Änderungen.
4. Aktualisiert Side-Wechsel und Implantat-Tab-Änderungen, damit
   die Ist-c-Anzeige aktuell bleibt.
5. Fügt neue i18n-Keys in allen 4 Sprachen hinzu.
6. Persistiert `pMaplawOn` und `pMaplawSollC` in JSON und
   localStorage.
7. Pflegt SPEC.md, CODESTRUKTUR.md, IDEEN.md.

## 1. Alten WaveShaper-MAPLAW-Code entfernen

### 1a. In `player.js`

Folgende Teile **vollständig entfernen**:

- Aus dem State-Block (Z. 4–24): die Zeile `pMapNode = null,`
- Die Funktion `pBuildMapNode()` (Z. 365–386 — komplette
  Funktion samt umschließendem `function`-Block)
- Alle Aufrufe von `pBuildMapNode()` — typisch:
  - in `pBuildEQ` (Z. 362): `pBuildMapNode();`-Aufruf streichen
  - in `pUpdEQ` (Z. 421): `pBuildMapNode();`-Aufruf streichen
- In `pPlay` (Z. 506–508): den Block
  ```js
  if (pMapNode) {
    pSrc.connect(pMapNode);
    pMapNode.connect(firstNode);
  } else {
    pSrc.connect(firstNode);
  }
  ```
  ersetzen durch:
  ```js
  pSrc.connect(firstNode);
  ```

### 1b. In `index.html`

Die versteckte MAPLAW-UI (Z. 1163–1175) komplett entfernen:

```html
          <!-- MAPLAW hidden -->
          <div style="display: none">
            <input
              type="number"
              id="plMaplaw"
              value="500"
              min="0"
              max="8000"
              step="50"
            />
            <input type="checkbox" id="plMapOn" />
            <div id="plMapInfo"></div>
          </div>
```

### 1c. In `init.js`

Suchen nach Referenzen auf `plMapOn`, `plMaplaw` (Element-IDs),
`pBuildMapNode`. Falls vorhanden: entfernen. Insbesondere Z. 778
(`pBuildMapNode()`-Aufruf in einem EQ-Toggle-Handler-Block oder
ähnlichem) muß raus.

Sonnet: nach dem Entfernen `grep -n "pBuildMapNode\|plMaplaw\b\|plMapOn" *.js *.html` ausführen
und nur noch Treffer aus den **neuen** Identifikatoren erwarten
(`pMaplaw*` mit Suffix, die neuen i18n-Keys, neue HTML-IDs).

## 2. Neue MAPLAW-Card in `index.html`

Im Player-Panel, **unmittelbar vor** der Frequenz-Warping-Card
(`<div class="card" id="plWarpCard">`, ca. Z. 1178), folgende
Card einfügen:

```html
        <!-- MAPLAW-Simulation (oberhalb Frequenz-Warping) -->
        <div class="card" id="plMaplawCard">
          <h2 data-t="plMaplawTitle"></h2>
          <div class="explain" style="font-size:0.85em;color:var(--text-muted);margin-bottom:8px" data-t="plMaplawSubtitle"></div>

          <div class="controls-row" style="margin-bottom:10px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="plMaplawOn" />
              <span data-t="plMaplawEnable"></span>
            </label>
          </div>

          <div id="plMaplawConfig">
            <div style="margin-bottom:8px;font-size:.9em;color:var(--text-muted)">
              <span data-t="plMaplawIstLabel"></span>:
              <strong id="plMaplawIstVal" style="font-family:var(--mono);color:var(--text)">—</strong>
            </div>

            <div style="margin-bottom:6px;font-size:.9em;font-weight:600">
              <span data-t="plMaplawSollLabel"></span>:
            </div>

            <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
              <button class="btn btn-sm" data-maplaw-quick="100" type="button">100</button>
              <button class="btn btn-sm" data-maplaw-quick="250" type="button">250</button>
              <button class="btn btn-sm" data-maplaw-quick="500" type="button">500</button>
              <button class="btn btn-sm" data-maplaw-quick="1000" type="button">1000</button>
              <button class="btn btn-sm" data-maplaw-quick="1500" type="button">1500</button>
              <button class="btn btn-sm" data-maplaw-quick="2000" type="button">2000</button>
              <input type="number" id="plMaplawSollInput"
                     min="0" max="8000" step="50"
                     style="width:90px;padding:4px 8px;margin-left:8px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono)" />
            </div>
          </div>

          <div id="plMaplawNotApplicableHint" class="explain explain-warn" style="display:none;margin-top:8px;font-size:0.85em" data-t="plMaplawNotMedel"></div>
        </div>
```

## 3. Neue i18n-Keys

In `i18n.js` in **jedem** der vier Sprachblöcke (DE, EN, FR, ES)
die folgenden Keys ergänzen — Position: bei den anderen `plMap*`-
Keys (in DE Z. 184–185 `plMapLabel`, `plMapExpl`). Diese
existierenden zwei Keys werden im neuen UI nicht mehr verwendet
und können bleiben (tot) oder entfernt werden. Empfehlung:
bleiben lassen, falls jemand auf sie referenziert.

DE:
```js
    plMaplawTitle: "MAPLAW-Simulation",
    plMaplawSubtitle: "Simuliert, wie sich Ihr Klangbild ändern würde, wenn der Audiologe Ihren MAPLAW-c-Wert ändert. Funktioniert nur für MED-EL-Implantate. Bluetooth-Wiedergabe direkt aufs CI empfohlen.",
    plMaplawEnable: "Simulation aktivieren",
    plMaplawIstLabel: "Ihr aktueller c-Wert (aus Implantat-Tab)",
    plMaplawSollLabel: "Zu simulierender c-Wert",
    plMaplawNotMedel: "MAPLAW ist eine MED-EL-Funktion. Die aktive Seite ist nicht MED-EL — die Simulation ist deaktiviert.",
```

EN:
```js
    plMaplawTitle: "MAPLAW Simulation",
    plMaplawSubtitle: "Simulates how your sound would change if the audiologist set a different MAPLAW c-value. Works for MED-EL implants only. Bluetooth streaming directly to the CI is recommended.",
    plMaplawEnable: "Enable simulation",
    plMaplawIstLabel: "Your current c-value (from Implant tab)",
    plMaplawSollLabel: "Target c-value to simulate",
    plMaplawNotMedel: "MAPLAW is a MED-EL function. The active side is not MED-EL — the simulation is disabled.",
```

FR:
```js
    plMaplawTitle: "Simulation MAPLAW",
    plMaplawSubtitle: "Simule comment votre son changerait si l'audiologiste réglait une autre valeur MAPLAW c. Fonctionne uniquement avec les implants MED-EL. Streaming Bluetooth direct vers l'IC recommandé.",
    plMaplawEnable: "Activer la simulation",
    plMaplawIstLabel: "Votre valeur c actuelle (depuis l'onglet Implant)",
    plMaplawSollLabel: "Valeur c cible à simuler",
    plMaplawNotMedel: "MAPLAW est une fonction MED-EL. Le côté actif n'est pas MED-EL — la simulation est désactivée.",
```

ES:
```js
    plMaplawTitle: "Simulación MAPLAW",
    plMaplawSubtitle: "Simula cómo cambiaría su sonido si el audiólogo ajustase otro valor c de MAPLAW. Funciona solo con implantes MED-EL. Se recomienda streaming Bluetooth directamente al IC.",
    plMaplawEnable: "Activar la simulación",
    plMaplawIstLabel: "Su valor c actual (del tab Implante)",
    plMaplawSollLabel: "Valor c objetivo a simular",
    plMaplawNotMedel: "MAPLAW es una función MED-EL. El lado activo no es MED-EL — la simulación está desactivada.",
```

Die alten Keys `plMapLabel` und `plMapExpl` können stehen bleiben
(nicht mehr verwendet, schaden nicht).

## 4. UI-Verdrahtung in `init.js`

In `init.js`, im großen `DOMContentLoaded`-Handler (in der Nähe
der anderen Player-spezifischen Event-Listener), folgenden Block
einfügen:

```js
  // ========== MAPLAW-UI ==========
  const plMaplawOnEl   = document.getElementById("plMaplawOn");
  const plMaplawSollEl = document.getElementById("plMaplawSollInput");
  const plMaplawIstEl  = document.getElementById("plMaplawIstVal");

  // Toggle „Simulation aktivieren"
  if (plMaplawOnEl) {
    plMaplawOnEl.addEventListener("change", function () {
      pMaplawOn = this.checked;
      pMaplawTrigger();
    });
  }

  // Quick-Buttons (Soll-c)
  document.querySelectorAll('[data-maplaw-quick]').forEach((btn) => {
    btn.addEventListener("click", function () {
      const v = parseInt(this.getAttribute("data-maplaw-quick"));
      if (isFinite(v) && v >= 0) {
        pMaplawSollC = v;
        if (plMaplawSollEl) plMaplawSollEl.value = String(v);
        pMaplawTrigger();
      }
    });
  });

  // Zahleneingabe Soll-c
  if (plMaplawSollEl) {
    plMaplawSollEl.addEventListener("change", function () {
      const v = parseInt(this.value);
      if (isFinite(v) && v >= 0 && v <= 8000) {
        pMaplawSollC = v;
        pMaplawTrigger();
      } else {
        // Ungültig: zurücksetzen
        this.value = String(pMaplawSollC);
      }
    });
  }
```

## 5. UI-Update-Funktion `pMaplawUpdUI`

Folgende Funktion in `player.js` global anlegen (ans Ende der
Datei oder zu den anderen `pUpd*`-Funktionen):

```js
// Aktualisiert die MAPLAW-Card-Anzeige: Ist-c-Wert, Aktivierungs-
// Zustand der Bedienelemente, Hinweis bei Nicht-MED-EL. Wird bei
// Side-Wechsel, Implantat-Tab-Änderungen und beim Tool-Start
// aufgerufen.
function pMaplawUpdUI() {
  const cardOn   = document.getElementById("plMaplawOn");
  const sollIn   = document.getElementById("plMaplawSollInput");
  const istEl    = document.getElementById("plMaplawIstVal");
  const cfgBox   = document.getElementById("plMaplawConfig");
  const hintBox  = document.getElementById("plMaplawNotApplicableHint");
  if (!cardOn) return;

  const applicable = (typeof pMaplawIsApplicable === "function")
    ? pMaplawIsApplicable() : false;

  // Toggle und Eingaben-Sperre
  cardOn.disabled = !applicable;
  if (cfgBox) cfgBox.style.opacity = applicable ? "1" : "0.4";
  if (cfgBox) {
    cfgBox.querySelectorAll("button, input").forEach((el) => {
      el.disabled = !applicable;
    });
  }
  if (hintBox) hintBox.style.display = applicable ? "none" : "";

  // Toggle-Zustand
  cardOn.checked = !!pMaplawOn;

  // Ist-c-Anzeige
  if (istEl) {
    const ist = (typeof pMaplawGetIstC === "function") ? pMaplawGetIstC() : null;
    istEl.textContent = ist != null ? String(ist) : "—";
  }

  // Soll-c-Eingabefeld
  if (sollIn) sollIn.value = String(pMaplawSollC);
}
```

## 6. Aufruf von `pMaplawUpdUI` an passenden Stellen

Folgende Stellen ergänzen:

### 6a. Beim Tool-Start (DOMContentLoaded in `init.js`)

Nach dem `applyLang()`-Aufruf:
```js
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
```

### 6b. Bei Side-Wechsel

In `state-side.js`, in `setActiveSide()`, nach den anderen
UI-Update-Aufrufen:
```js
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
```

### 6c. Bei Implantat-Tab-Änderungen

Wenn `cValue` oder der Hersteller pro Seite geändert wird,
müssen wir die UI aktualisieren. Konkrete Stelle: in
`buildImplantCard` (`ui-implant.js`) am Ende, oder im
`mfrSelect`-Change-Handler in `init.js`. Sonnet: füge an
**beiden** Stellen `pMaplawUpdUI()`-Aufrufe ein, falls vorhanden,
für maximale Konsistenz.

Außerdem im Implantat-Tab beim Ändern von `cValue` (sucht das
Input-Feld für cValue auf — sollte in `buildImplantCard`
existieren): `pMaplawUpdUI()` nach Speichern in `sideData[side].
implant.cValue`. Und wenn MAPLAW gerade aktiv ist:
`pMaplawTrigger()` aufrufen, damit das laufende Audio den neuen
Ist-c bekommt.

## 7. Persistenz in JSON

In `file.js`, in der `saveJson`-Funktion (oder wo das Save-Objekt
aufgebaut wird), zwei Felder hinzufügen:

```js
    plMaplawOn: pMaplawOn,
    plMaplawSollC: pMaplawSollC,
```

In `applyLoadedData` (file.js), nach dem Laden anderer Player-
Felder:

```js
  if (typeof d.plMaplawOn === "boolean") pMaplawOn = d.plMaplawOn;
  if (typeof d.plMaplawSollC === "number") pMaplawSollC = d.plMaplawSollC;
  if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
  if (typeof pMaplawTrigger === "function") pMaplawTrigger();
```

## 8. Persistenz in localStorage (Autosave)

In `init.js`, im Autosave-`setInterval`-Block (ca. Z. 1054), im
JSON-Objekt zwei Felder ergänzen — direkt nach den anderen
Player-Feldern wie `eqOn` und `eqStrength`:

```js
          plMaplawOn: pMaplawOn,
          plMaplawSollC: pMaplawSollC,
```

Im Restore-Code (wo der localStorage gelesen wird, vermutlich
auch in init.js DOMContentLoaded oder bei applyLoadedData):
analog zum JSON-Load die Werte zurücklesen und
`pMaplawUpdUI()` / `pMaplawTrigger()` aufrufen.

## 9. SPEC.md aktualisieren

Im Block „Player" → die Zeile
`- MAPLAW-Simulation ausgeblendet (Code vorhanden, UI versteckt)`
**ersetzen** durch:

```
- MAPLAW-Simulation (MED-EL): bandweise Hüllkurven-Vorverzerrung
  Ist⁻¹∘Soll als AudioWorklet im Tool. Eigene Card oberhalb der
  Frequenz-Warping-Card. Ist-c kommt aus `implant.cValue` der
  aktiven Seite (read-only), Soll-c per Quick-Buttons
  (100/250/500/1000/1500/2000) oder Zahleneingabe (0–8000).
  Master-Toggle „Simulation aktivieren". EQ-Toggle wirkt als
  Master-Bypass auch für MAPLAW. Audio-Pfad-Position: nach Tool-EQ
  und vor pGain. Bei Soll-c == Ist-c oder Card aus: Passthrough.
  Bei aktiver Seite Cochlear oder AB: Card ausgegraut mit Hinweis.
  Konzeptioneller Hintergrund: `.docs/MAPLAW_Konzept.md`.
```

Im Block „Offene Punkte (Warteliste)": MAPLAW-Eintrag entfernen
(ist jetzt implementiert).

## 10. CODESTRUKTUR.md aktualisieren

- In der player.js-Zeile der Modul-Tabelle: State-Liste um
  `pMaplawOn`, `pMaplawSollC`, `pMaplawNode` ergänzen (falls noch
  nicht durch BA 19 geschehen); Funktion `pMaplawUpdUI`,
  `pMaplawGetIstC`, `pMaplawIsApplicable`, `pMaplawTrigger`
  erwähnen.
- Die Bauanleitung-18-Erweiterung (`16b | maplaw.js`) bleibt
  unverändert.

## 11. IDEEN.md aktualisieren

MAPLAW-Eintrag aus IDEEN.md **entfernen** (komplett). Im Header
der Datei den Hinweis lassen, daß umgesetzte Punkte in SPEC.md
wandern und IDEEN.md-Einträge dafür entfallen.

## Akzeptanztest (vom Nutzer durchzugehen)

Vorbereitung: Tool laden, Implantat-Tab → aktive Seite MED-EL,
cValue eintragen (z.B. 1000). Audio-Datei laden.

1. **UI-Sichtbarkeit**: Tab Player öffnen.
   - Erwartet: eine neue Card „MAPLAW-Simulation" steht direkt
     oberhalb der Frequenz-Warping-Card.
   - Sprache durchschalten (DE/EN/FR/ES): alle Texte
     entsprechend lokalisiert.

2. **Ist-c-Anzeige**: in der Card erscheint „Ihr aktueller
   c-Wert: 1000" (oder dein Wert).

3. **Toggle-Funktion**: Toggle „Simulation aktivieren" anklicken.
   Quick-Button „500" klicken. Audio abspielen.
   - Erwartet: hörbarer Klangunterschied.

4. **Live-Update Soll-c**: während Wiedergabe Quick-Button „1500"
   klicken.
   - Erwartet: sofortiger Klangwechsel ohne Pause.

5. **Zahleneingabe**: Wert 750 in Zahleneingabe tippen, Enter.
   - Erwartet: Audio passt sich an, Zahleneingabe zeigt 750.

6. **Toggle aus**: Toggle anklicken.
   - Erwartet: Audio fällt zurück auf Original (kurze Pause für
     Pfadwechsel).

7. **Side-Wechsel**: Seite auf RECHTS, falls Cochlear → Card wird
   ausgegraut, Hinweis „MAPLAW ist eine MED-EL-Funktion"
   erscheint. Toggle/Quick-Buttons/Zahleneingabe sind nicht mehr
   bedienbar.

8. **Side zurück zu MED-EL**: Card wieder bedienbar, Hinweis
   verschwindet, Ist-c-Anzeige zeigt den cValue der aktiven Seite.

9. **Persistenz**: Toggle an, Soll-c=500. Tool-Reload.
   - Erwartet: Toggle ist wieder an, Soll-c=500, kein Verlust.

10. **JSON-Speichern/Laden**: in Laden/Speichern → Speichern
    klicken. JSON-Datei laden. Toggle und Soll-c werden korrekt
    wiederhergestellt.

11. **Regression**: Frequenz-Warping aktiv + MAPLAW aktiv
    gleichzeitig: kein Crash, beide Effekte gemeinsam hörbar.
    Reihenfolge: erst Warp, dann MAPLAW.

12. **EQ-Toggle-Bypass**: MAPLAW aktiv, dann EQ ausschalten.
    Erwartet: MAPLAW ist auch automatisch aus.

13. **Validierungs-Test gegen Hardware-Vergleichsprogramm** (nur
    für Martin, optional): CI auf Vergleichsprogramm c=500.
    Original-Audio im Tool ohne MAPLAW abspielen — Referenzklang
    merken. CI zurück auf Normalprogramm c=1000. Im Tool MAPLAW
    an, Soll-c=500. Selbes Audio abspielen — sollte ähnlich
    klingen.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| Alter WaveShaper-Code (`pBuildMapNode`, `pMapNode`, alle Aufrufe) komplett entfernt | | |
| Versteckte MAPLAW-UI in index.html (Z. 1163–1175) entfernt | | |
| Neue MAPLAW-Card in index.html oberhalb von `plWarpCard` | | |
| Alle Quick-Buttons (100/250/500/1000/1500/2000) und Zahleneingabe vorhanden | | |
| 6 neue i18n-Keys in jedem der 4 Sprachblöcke (also 24 Einträge) | | |
| UI-Listener (Toggle, Quick-Buttons, Zahleneingabe) in init.js | | |
| `pMaplawUpdUI` als globale Funktion in player.js | | |
| `pMaplawUpdUI` wird aufgerufen bei: Tool-Start, setActiveSide, buildImplantCard, mfrSelect-Change | | |
| `pMaplawOn` und `pMaplawSollC` in saveJson und applyLoadedData | | |
| `pMaplawOn` und `pMaplawSollC` im Autosave-localStorage | | |
| SPEC.md Player-Block aktualisiert; MAPLAW aus „Offene Punkte" entfernt | | |
| CODESTRUKTUR.md player.js-Zeile um MAPLAW-Funktionen ergänzt | | |
| IDEEN.md-MAPLAW-Eintrag entfernt | | |
| Akzeptanztest 7 (Side-Wechsel Cochlear → Card grau) bestanden | | |
| Akzeptanztest 9 (Persistenz nach Reload) bestanden | | |
| Akzeptanztest 11 (Frequenz-Warping + MAPLAW gleichzeitig) bestanden | | |

Bei Unklarheit zur exakten Position eines Aufrufs oder bei
Klang-Artefakten in Test 11: vor Fertig-Meldung fragen.
