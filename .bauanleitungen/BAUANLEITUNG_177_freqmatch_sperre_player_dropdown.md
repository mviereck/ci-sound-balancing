# BAUANLEITUNG 177 — Frequenzabgleich-Sperre verschärfen + Player-Warp-Dropdown auf Links/Rechts/Symmetrisch

**Ziel:** Zwei zusammengehörige Änderungen rund um die Referenzseite
des Frequenzabgleichs und ihre Wirkung auf den Player.

**Teil A — Frequenzabgleich:** Den toten Bestätigungsdialog
`fmRCDlg` und seine i18n-Strings entfernen. Die Sperre des
Referenzseiten-Dropdowns läuft bereits über die `depLock`-Mechanik
und ist damit ausreichend hart.

**Teil B — Player:** Das Warp-Modus-Dropdown wird auf absolute Seiten
umgestellt: `Linke Seite / Rechte Seite / Beide Seiten symmetrisch`.
Beim ersten Frequenzabgleich-Resultat (Übergang `0 → 1+ Messungen`)
wird der Player-Default automatisch auf die Zielseite (= nicht die
Referenzseite des Frequenzabgleichs) gesetzt.

**Versionsbump:** `js/version.js` → `"3.1.177-beta"`.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.176-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.177-beta";
```

(Voraussetzung: BA 176 wurde bereits gebaut. Falls noch nicht,
ist die Vorgängernummer die jeweils aktuelle.)

---

# TEIL A — Frequenzabgleich: Toten Dialog entfernen

## Schritt 1 — `fmRCDlg`-Block entfernen

Datei `js/freqmatch.js`. Im DOMContentLoaded-Handler steht ein
Modal-Dialog, der nie angezeigt wird (es gibt keinen Code, der
`fmRCDlg.hidden = false` setzt). Die Sperre läuft jetzt schon
ausschließlich über `depLock`.

Block entfernen, Zeilen 1119–1136:

```js
  // Referenzwechsel-Dialog
  const fmRCDlg = _mkEl('div', 'modal-overlay');
  fmRCDlg.hidden = true;
  const fmRCCard = _mkEl('div', 'card');
  const fmRCMsg = _mkEl('p');
  fmRCMsg.dataset.t = 'fmRefChangeConfirm';
  if (typeof t === 'function') fmRCMsg.textContent = t('fmRefChangeConfirm') || fmRCMsg.textContent;
  const fmRCBtns = _mkEl('div', 'btn-group');
  const fmRCOkBtn = _mkEl('button', 'btn btn-danger');
  fmRCOkBtn.dataset.t = 'fmRefChangeConfirmOk';
  if (typeof t === 'function') fmRCOkBtn.textContent = t('fmRefChangeConfirmOk') || fmRCOkBtn.textContent;
  const fmRCCancelBtn = _mkEl('button', 'btn');
  fmRCCancelBtn.dataset.t = 'fmRefChangeConfirmCancel';
  if (typeof t === 'function') fmRCCancelBtn.textContent = t('fmRefChangeConfirmCancel') || fmRCCancelBtn.textContent;
  fmRCBtns.append(fmRCOkBtn, fmRCCancelBtn);
  fmRCCard.append(fmRCMsg, fmRCBtns);
  fmRCDlg.appendChild(fmRCCard);
  parentEl.appendChild(fmRCDlg);
```

ersatzlos löschen.

Der direkt darunter folgende change-Listener auf `refSelect`
(Zeilen 1138–1141) **bleibt** stehen — er ist legitim, weil bei
nicht-gesperrtem Dropdown (= keine Daten vorhanden) eine
Änderung des Referenzseiten-Werts noch funktional verarbeitet
werden muß. Bei gesperrtem Dropdown verhindert `depLock` den
Klick ohnehin.

## Schritt 2 — Veraltete Kommentare bereinigen

Datei `js/freqmatch.js`:

- **Zeile 291** (Kommentar): `// (BA 145 fmRCDlg).`
  → der `fmRCDlg` ist nun weg, der Verweis stimmt nicht mehr.
  Klammer-Verweis ersatzlos streichen, ggf. zu
  `// (Modus-Wechsel löscht die Daten ohnehin).` umformulieren.

- **Zeile 774** (Kommentar):
  `// ein manueller Wechsel löst dann den fmRCDlg-Bestätigungsdialog aus.`
  → durch eine korrekte Beschreibung ersetzen, z.B.:
  `// ein manueller Wechsel ist durch depLock gesperrt (Popup mit Begründung).`

## Schritt 3 — Tote i18n-Keys entfernen

Datei `i18n/de.js`, Zeilen 774–776:

```js
    fmRefChangeConfirm: "Beim Wechsel des Referenzohrs werden alle bisherigen Frequenzabgleich-Ergebnisse gelöscht. Fortfahren?",
    fmRefChangeConfirmOk: "Ja, wechseln",
    fmRefChangeConfirmCancel: "Abbrechen",
```

Diese drei Zeilen ersatzlos entfernen.

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **nicht** ändern — die
Übersetzungs-Sammel-BA räumt da später auf.

**Sonnet-Auftrag:** Per Grep absichern, daß `fmRefChangeConfirm`,
`fmRefChangeConfirmOk`, `fmRefChangeConfirmCancel` außerhalb der
zu löschenden Stellen nirgendwo mehr verwendet werden. Befund
mitteilen.

---

# TEIL B — Player: Warp-Dropdown auf Links/Rechts/Symmetrisch

## Schritt 4 — i18n-Keys umstellen

Datei `i18n/de.js`, Zeilen 702–705:

```js
    pwMode: "Korrektur-Modus",
    pwModeRef: "Nur Referenzseite anpassen",
    pwModeVar: "Nur variable Seite anpassen",
    pwModeSym: "Beide Seiten symmetrisch",
```

ersetzen durch:

```js
    pwMode: "Korrektur-Modus",
    pwModeLeft: "Linke Seite",
    pwModeRight: "Rechte Seite",
    pwModeSym: "Beide Seiten symmetrisch",
```

`pwModeRef` und `pwModeVar` sind damit weg. `pwModeSym` bleibt
unverändert; nur Wortlaut kann bleiben oder leicht angepaßt werden
(z.B. `"Beide Seiten symmetrisch"` ist OK).

`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` **nicht** ändern.

## Schritt 5 — HTML-Optionen umstellen

Datei `index.html`, Zeilen 1234–1238:

```html
                <select id="plWarpModeSelect" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="ref_side" data-t-opt="pwModeRef"></option>
                  <option value="var_side" data-t-opt="pwModeVar" selected></option>
                  <option value="symmetric" data-t-opt="pwModeSym"></option>
                </select>
```

ersetzen durch:

```html
                <select id="plWarpModeSelect" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="left" data-t-opt="pwModeLeft"></option>
                  <option value="right" data-t-opt="pwModeRight" selected></option>
                  <option value="symmetric" data-t-opt="pwModeSym"></option>
                </select>
```

## Schritt 6 — `pWarpMode`-Default in `freq-warp.js`

Datei `js/freq-warp.js`, Zeile 529:

```js
let pWarpMode = "var_side";     // "ref_side" | "var_side" | "symmetric" — Default synchron mit HTML
```

ersetzen durch:

```js
let pWarpMode = "right";        // "left" | "right" | "symmetric" — Default synchron mit HTML
```

## Schritt 7 — `buildWarpPoints` auf absolute Seiten umstellen

Datei `js/freq-warp.js`, Funktion `buildWarpPoints` (Zeilen 603–628).

Aktuelle Verzweigung (Zeilen 611–622):

```js
    if (warpMode === "ref_side") {
      if (r.refSide === "left")  csL = -cent;
      else                       csR = -cent;
    } else if (warpMode === "var_side") {
      if (r.varSide === "left")  csL = cent;
      else                       csR = cent;
    } else { // symmetric
      if (r.refSide === "left")  csL = -cent / 2;
      else                       csR = -cent / 2;
      if (r.varSide === "left")  csL += cent / 2;
      else                       csR += cent / 2;
    }
```

ersetzen durch (absolute Seiten — Verschiebung wirkt auf die in
`warpMode` ausgewählte Seite, egal ob sie Ref- oder Var-Seite war):

```js
    if (warpMode === "left") {
      if (r.varSide === "left")      csL = cent;
      else if (r.refSide === "left") csL = -cent;
    } else if (warpMode === "right") {
      if (r.varSide === "right")      csR = cent;
      else if (r.refSide === "right") csR = -cent;
    } else { // symmetric
      if (r.refSide === "left")  csL = -cent / 2;
      else                       csR = -cent / 2;
      if (r.varSide === "left")  csL += cent / 2;
      else                       csR += cent / 2;
    }
```

**Erklärung (nicht in Code mitschreiben):** `cent` ist die
Cent-Differenz, um `varFreq` auf `refFreq` zu heben. Wenn die
gewählte Warp-Seite die var-Seite war, ist das exakt diese
Verschiebung (+cent). Wenn sie die ref-Seite war, ist die
Verschiebung in die Gegenrichtung (-cent), damit die ref-Seite
auf die var-Seite kommt — semantisch dasselbe Ziel
("die nicht-gewählte Seite ist Referenz, die gewählte Seite
wird hin verschoben"). Symmetric-Fall bleibt unverändert.

**Edge-Case** (in der Anleitung benennen, nicht stillschweigend
übernehmen): bei `r.refSide === "symmetric"` (sym-Messung) kann
`r.refSide` weder `"left"` noch `"right"` sein. In dem Fall sollte
`warpMode === "left"` oder `"right"` auf eine Default-Aufteilung
fallen. Mein Vorschlag: bei `r.refSide === "symmetric"` jede
Halbierung wie im symmetric-Zweig: `csL = csR = cent/2` (varSide
würde dann egal sein, weil sym-Eintrag eine virtuelle gemeinsame
Quelle ist). **Sonnet-Auftrag:** im Code prüfen, ob sym-fRes-Einträge
heute schon mit nicht-`symmetric` `warpMode` zusammen vorkommen
können. Wenn ja: den Edge-Case ergänzen wie skizziert. Wenn die
Konstellation faktisch nie auftritt (z.B. weil sym-Modus eh nur
mit `warpMode === "symmetric"` verwendet wird): in der Anleitungs-
Ausgabe als „nicht ergänzt, weil unmöglich" begründen.

## Schritt 8 — Reset-Wert in `file.js` anpassen

Datei `js/file.js`, Zeile 107:

```js
    pWarpMode = "var_side";
```

ersetzen durch:

```js
    pWarpMode = "right";
```

Und im selben Block (Datei → Reset, ab Zeile 105) am Ende —
unmittelbar vor `if (typeof pWarpUpdUI === "function") pWarpUpdUI();`
(ca. Zeile 116) — den „Default schon angewendet"-Flag mit zurücksetzen:

```js
    if (typeof _pPlayerWarpDefaultApplied !== "undefined") {
      _pPlayerWarpDefaultApplied = false;
    }
```

Die Variable wird in Schritt 11 eingeführt; ihre Existenzprüfung
via `typeof` macht den Reset auch robust gegen ein noch nicht
geladenes `freq-warp.js`.

## Schritt 9 — Save-Default in `file.js` und `init.js`

Datei `js/file.js`, Zeile 250:

```js
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "ref_side",
```

ersetzen durch:

```js
    warpMode: (typeof pWarpMode !== "undefined") ? pWarpMode : "right",
```

Datei `js/init.js`, Zeile 866:

```js
          warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "var_side",
```

ersetzen durch:

```js
          warpMode:     (typeof pWarpMode     !== "undefined") ? pWarpMode     : "right",
```

## Schritt 10 — Load-Migration für Alt-Werte `ref_side` / `var_side`

Alte Save-Dateien können `warpMode: "ref_side"` oder
`warpMode: "var_side"` enthalten. Diese Werte müssen beim Laden
in die neuen absoluten Seiten übersetzt werden.

Datei `js/freq-warp.js`, an passender Stelle (z.B. direkt nach
der Funktion `buildWarpPoints` oder am Ende der Datei vor dem
letzten Block) eine neue Helper-Funktion einfügen:

```js
// ---- Migrations-Helfer für Alt-Werte ref_side/var_side ----
// Übersetzt Alt-Werte in absolute Seiten anhand der Referenzseite,
// die in den gespeicherten fRes-Einträgen steht. Wenn keine
// fRes-Daten vorhanden sind, fallback auf Default-Seite.
function _migrateLegacyWarpMode(savedMode, savedFRes) {
  if (savedMode !== "ref_side" && savedMode !== "var_side") {
    return savedMode;
  }
  let refSide = "left";
  if (Array.isArray(savedFRes) && savedFRes.length > 0) {
    const first = savedFRes[0];
    if (first && typeof first.refSide === "string") {
      refSide = first.refSide;
    }
  }
  if (refSide === "symmetric") return "symmetric";
  if (savedMode === "ref_side") {
    return refSide === "left" ? "left" : "right";
  }
  // var_side
  return refSide === "left" ? "right" : "left";
}
```

Diese Funktion an beiden Load-Stellen einbinden:

Datei `js/file.js`, Zeile 604:

```js
    if (d.warpMode !== undefined) pWarpMode = d.warpMode;
```

ersetzen durch:

```js
    if (d.warpMode !== undefined) {
      pWarpMode = (typeof _migrateLegacyWarpMode === "function")
        ? _migrateLegacyWarpMode(d.warpMode, d.fRes)
        : d.warpMode;
    }
```

Datei `js/init.js`, Zeilen 667–671:

```js
        if (typeof _wMode === "string") {
          pWarpMode = _wMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
```

ersetzen durch:

```js
        if (typeof _wMode === "string") {
          pWarpMode = (typeof _migrateLegacyWarpMode === "function")
            ? _migrateLegacyWarpMode(_wMode, d.fRes)
            : _wMode;
          const sel = document.getElementById("plWarpModeSelect");
          if (sel) sel.value = pWarpMode;
        }
```

## Schritt 11 — Default-Anwendung beim ersten Frequenzabgleich-Resultat

Datei `js/freq-warp.js`. Am Ende der Datei (oder in der Nähe
der `pWarpMode`-Deklaration) eine neue State-Variable und zwei
Funktionen einfügen:

```js
// ---- Default-Anwendung beim ersten Frequenzabgleich-Resultat ----
// Wird einmal pro Session beim Übergang "0 → 1+ Messungen"
// aufgerufen. Setzt pWarpMode auf die Zielseite (= nicht die
// Referenzseite). Wenn der Default in dieser Session bereits
// angewendet wurde, ist die Funktion idempotent (kein Override).
// Beim Laden eines Saves mit vorhandenen Messungen muß
// pMarkPlayerWarpDefaultAsApplied() einmal aufgerufen werden,
// damit der gespeicherte pWarpMode nicht beim nächsten Insert
// überschrieben wird.
let _pPlayerWarpDefaultApplied = false;

function pApplyWarpModeDefaultFromFm() {
  if (_pPlayerWarpDefaultApplied) return;
  _pPlayerWarpDefaultApplied = true;
  let mode = "right";
  if (typeof fmRefSide === "string") {
    if (fmRefSide === "left")            mode = "right";
    else if (fmRefSide === "right")      mode = "left";
    else if (fmRefSide === "symmetric")  mode = "symmetric";
  }
  pWarpMode = mode;
  const sel = document.getElementById("plWarpModeSelect");
  if (sel) sel.value = pWarpMode;
}

function pMarkPlayerWarpDefaultAsApplied() {
  _pPlayerWarpDefaultApplied = true;
}
```

## Schritt 12 — Default-Aufruf nach Mess-Inserts

Datei `js/freqmatch-adaptive.js`. An den zwei `fRes.push`-Stellen
(Zeilen 608–609 und 673–674) jeweils **direkt nach** dem Push
einen Aufruf hinzufügen:

```js
    if (existingIdx >= 0) fRes[existingIdx] = entry;
    else                  fRes.push(entry);
    if (typeof pApplyWarpModeDefaultFromFm === "function") {
      pApplyWarpModeDefaultFromFm();
    }
```

Die Funktion ist idempotent — sie wird in jedem Insert getriggert,
aber nur beim allerersten in der Session wirklich angewendet.

Datei `js/freqmatch-slider.js`. An den zwei Schreibstellen für
Slider-Estimates (Zeile 154, in `fmConfirm`, und Zeile 262 — bitte
per Grep verifizieren) jeweils **direkt nach** der Zuweisung
ergänzen:

```js
    store[String(fmCurrentEl)] = {
      cent:    Math.round(fmCentOffset),
      varSide: fmVarSide,
      refSide: fmSymmetric ? 'symmetric' : fmRefSide,
      varFreq: varHz,
      timestamp: Date.now(),
    };
    if (typeof pApplyWarpModeDefaultFromFm === "function") {
      pApplyWarpModeDefaultFromFm();
    }
```

## Schritt 13 — Flag beim Save-Load setzen

Damit ein gespeicherter `pWarpMode` beim ersten neuen Mess-Insert
nicht überschrieben wird, muß `_pPlayerWarpDefaultApplied` direkt
nach dem Save-Load auf `true` gesetzt werden, sofern Messungen
schon vorhanden sind.

Datei `js/file.js`. Nach dem fRes-Loading (Zeilen ~588–600) und
dem Warp-Loading (Zeilen ~601–619), also am Ende der
relevanten Lade-Sequenz, ergänzen:

```js
  // BA 177: wenn Save-Daten Frequenzabgleich-Messungen enthielten,
  // den Default-Anwendungs-Flag setzen, damit der nächste Insert
  // den gespeicherten pWarpMode nicht überschreibt.
  try {
    const _hasFm =
      (Array.isArray(fRes) && fRes.length > 0)
      || (typeof _fmHasSliderEstimates === "function" && _fmHasSliderEstimates())
      || (typeof _fmHasAdaptiveData === "function" && _fmHasAdaptiveData());
    if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
      pMarkPlayerWarpDefaultAsApplied();
    }
  } catch (e) { /* defensiv */ }
```

Konkrete Einfüge-Stelle: in der Funktion, in der `d.warpMode`
gelesen wird (in der Nähe von Zeile 619, **nach**
`if (typeof pWarpUpdUI === "function") pWarpUpdUI();`).

Datei `js/init.js`. Analog im Auto-Load-Pfad (am Ende des
DOMContentLoaded-Handlers, der die `sideData`-Restore vornimmt
und in Zeile 677 `pWarpUpdUI()` aufruft), denselben Block
einfügen:

```js
      try {
        const _hasFm =
          (Array.isArray(fRes) && fRes.length > 0)
          || (typeof _fmHasSliderEstimates === "function" && _fmHasSliderEstimates())
          || (typeof _fmHasAdaptiveData === "function" && _fmHasAdaptiveData());
        if (_hasFm && typeof pMarkPlayerWarpDefaultAsApplied === "function") {
          pMarkPlayerWarpDefaultAsApplied();
        }
      } catch (e) { /* defensiv */ }
```

---

## Schritt 14 — Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen, melden:
**erfüllt / nicht erfüllt / unklar**, mit konkretem Bezug.

1. `js/version.js` zeigt `"3.1.177-beta"`.
2. **Teil A:** Block `fmRCDlg` ist aus `js/freqmatch.js` entfernt
   (Zeilen 1119–1136). change-Listener auf `refSelect` bleibt
   stehen. Kommentare in Zeile 291 und 774 sind angepaßt.
3. **Teil A:** i18n-Keys `fmRefChangeConfirm`,
   `fmRefChangeConfirmOk`, `fmRefChangeConfirmCancel` sind aus
   `i18n/de.js` raus; per Grep keine restliche Verwendung in
   `js/`, `index.html`, `style.css`. Die drei anderen Sprachen
   unverändert.
4. **Teil B:** HTML-Optionen in `index.html` lauten exakt
   `value="left"`, `value="right"`, `value="symmetric"` mit
   `selected` auf `right`. `data-t-opt`-Werte `pwModeLeft`,
   `pwModeRight`, `pwModeSym`.
5. **Teil B:** i18n-Keys `pwModeRef` und `pwModeVar` sind aus
   `i18n/de.js` raus; `pwModeLeft` und `pwModeRight` neu drin.
   `pwModeSym` unverändert.
6. **Teil B:** `pWarpMode`-Initial in `freq-warp.js` ist `"right"`.
7. **Teil B:** `buildWarpPoints` (`freq-warp.js`) verzweigt auf
   `warpMode === "left" | "right" | "symmetric"`. Logik
   entspricht Schritt 7. Edge-Case `r.refSide === "symmetric"`
   ist entweder ergänzt oder als „faktisch unmöglich" begründet.
8. **Teil B:** Reset (`file.js`) setzt `pWarpMode = "right"` und
   `_pPlayerWarpDefaultApplied = false`.
9. **Teil B:** Save-Defaults in `file.js:250` und `init.js:866`
   sind `"right"`.
10. **Teil B:** Hilfsfunktion `_migrateLegacyWarpMode` existiert
    in `freq-warp.js` und wird in `file.js:604` sowie
    `init.js:667–671` am Lade-Pfad eingesetzt. Beim Laden eines
    Saves mit `warpMode: "ref_side"` oder `"var_side"` resultiert
    der richtige absolute Wert (`left`/`right`/`symmetric`).
11. **Teil B:** Funktionen `pApplyWarpModeDefaultFromFm` und
    `pMarkPlayerWarpDefaultAsApplied` existieren in `freq-warp.js`.
    Variable `_pPlayerWarpDefaultApplied` startet `false`.
12. **Teil B:** Aufrufe von `pApplyWarpModeDefaultFromFm()`
    direkt nach jedem Mess-Insert (zwei Stellen in
    `freqmatch-adaptive.js`, zwei in `freqmatch-slider.js` —
    Stellen per Grep verifizieren und in der Antwort melden).
13. **Teil B:** Save-Load-Hooks (`file.js` und `init.js`) rufen
    `pMarkPlayerWarpDefaultAsApplied()` auf, wenn beim Laden
    bereits Frequenzabgleich-Messungen vorhanden sind.
14. Klammer-Balance und Anführungszeichen-Hygiene aller
    geänderten Dateien geprüft.
15. Browser-Test: Tool lädt ohne `SyntaxError`-Konsolen-Fehler;
    Player-Tab läßt sich öffnen; Frequenzabgleich-Tab läßt sich
    öffnen.

Bei einem Punkt unklar: **stoppen, melden, Rückfrage**.

---

## Schritt 15 — Akzeptanz-Checkliste für den Nutzer

1. **Frischer Browser-Tab.** Tool lädt ohne Konsolen-Fehler.
   Versions-Label rechts oben zeigt `v3.1.177-beta`.
2. **Reset.** Datei → Reset. In den Reiter Player gehen,
   Frequenz-Warping aufklappen → Warp-Modus-Dropdown zeigt
   `Linke Seite / Rechte Seite / Beide Seiten symmetrisch`,
   ausgewählt ist `Rechte Seite`.
3. **Frequenzabgleich öffnen.** Hörsituation z.B. LINKS CI MED-EL,
   RECHTS Normalhörend. Referenzseite-Dropdown ist auf
   `Rechte Seite` (Normalhörend) gestellt — frei klickbar, kein
   Sperr-Popup.
4. **Erste Messung durchführen** (Schieber oder Adaptiv). Sobald
   das erste Resultat in der Ergebnis-Tabelle steht: Referenzseite-
   Dropdown ist nicht mehr anklickbar — Klick öffnet das
   depLock-Popup mit Erklärung. **Kein** anderer Bestätigungsdialog.
5. **Player-Default prüfen.** Reiter Player → Frequenz-Warping
   aufklappen → das Warp-Modus-Dropdown steht auf `Linke Seite`
   (Zielseite, weil die Referenzseite rechts war). Nicht
   `Rechte Seite`. Wenn der User nun manuell auf `Beide Seiten
   symmetrisch` umstellt, bleibt seine Wahl auch nach weiteren
   Messungen erhalten.
6. **Symmetrische Konstellation.** Reset, Hörsituation
   LINKS CI / RECHTS CI. Referenzseite-Dropdown im Frequenzabgleich
   wird automatisch auf `symmetrisch` gestellt. Erste Messung
   durchführen. Im Player steht das Warp-Modus-Dropdown auf
   `Beide Seiten symmetrisch`.
7. **Save / Reload.** Stand aus Schritt 5 oder 6 als Datei
   speichern, Browser neu laden, dieselbe Datei zurückladen.
   Frequenzabgleich-Referenzseite und Player-Warp-Modus sind
   wieder wie vor dem Save. **Eine weitere Messung danach
   überschreibt den Player-Modus nicht.**
8. **Alt-Save-Datei.** Falls vorhanden: eine ältere Save-Datei
   (vor BA 177) laden. Der Player-Warp-Modus sollte sinnvoll
   migriert werden:
   - Alter Wert `ref_side` + Referenzseite war links → neuer
     Wert `Linke Seite`.
   - Alter Wert `var_side` + Referenzseite war links → neuer
     Wert `Rechte Seite`.
   - Alter Wert `symmetric` → bleibt `Beide Seiten symmetrisch`.

---

## Schritt 16 — Folge-BA

Übersetzung der neuen Keys `pwModeLeft`, `pwModeRight` (und ggf.
angepaßter `pwModeSym`) in `en.js`, `fr.js`, `es.js` wird in der
Übersetzungs-Sammel-BA nachgezogen.

---

## Schlußbemerkung

Im Zweifel **stoppen und nachfragen**. Insbesondere bei
Schritt 7 (`buildWarpPoints`-Edge-Case `r.refSide === "symmetric"`)
und Schritt 12 (zweite Slider-Schreibstelle, Zeile 262 — die
Zeilennummer ist Stand zum Zeitpunkt der Anleitung; Verifikation
per Grep nötig) sollte Sonnet keine stillschweigende Annahme
treffen, sondern den realen Code-Stand melden.
