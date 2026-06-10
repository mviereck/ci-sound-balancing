# BAUANLEITUNG 130 — Tonparameter neben Sweep/Stop

## Ziel

Die separate Tonparameter-Card im Implantat-Reiter entfällt. Ihre
drei Eingabefelder (Lautstärke, Tondauer, Pause) rücken in
dieselbe Zeile wie die Sweep/Stop-Buttons und das Korrektur-Toggle.
Reine Layout-Änderung — keine Logik wird angefasst, keine
Verhaltens-Änderung im Sweep- oder Audio-Pfad.

## Begründung

Schafft Platz und Ordnung unter der Frequenz-/Elektrodentabelle.
Direkt darunter wird in den folgenden Bauanleitungen (BA 131 ff.)
eine Warnbox für die Plausibilitätsprüfung der User-Eingaben
eingefügt — dafür darf nicht erst eine separate Card dazwischen
stehen.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.129-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.130-beta";
```

---

## HTML-Änderung in `index.html`

### Stelle 1 — Sweep/Stop-Zeile erweitern (Z. 458–483)

**Aktuell:**

```html
<div
  style="
    margin-top: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  "
>
  <button class="btn" id="sweepBtn"></button>
  <button class="btn" id="stopBtn"></button>
  <label
    style="
      margin-left: 12px;
      font-size: 0.85em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    "
  >
    <input type="checkbox" id="corrToggle" checked />
    <span id="lblCorr"></span>
  </label>
</div>
```

**Ersetzen durch:**

```html
<div
  style="
    margin-top: 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  "
>
  <button class="btn" id="sweepBtn"></button>
  <button class="btn" id="stopBtn"></button>
  <label
    style="
      margin-left: 12px;
      font-size: 0.85em;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    "
  >
    <input type="checkbox" id="corrToggle" checked />
    <span id="lblCorr"></span>
  </label>
  <label
    id="lblVol"
    style="margin-left: 12px; font-size: 0.85em; color: var(--text-muted);"
  ></label>
  <input
    type="number"
    class="vol-num"
    id="vol1"
    value="50"
    min="0"
    max="100"
    step="1"
    style="
      width: 55px;
      padding: 3px 5px;
      border: 1px solid var(--border);
      border-radius: 4px;
      text-align: center;
      font-family: var(--mono);
      font-size: 0.88em;
    "
  />
  <span style="font-size: 0.85em; color: var(--text-muted);">%</span>
  <label
    id="lblDur"
    style="margin-left: 12px; font-size: 0.85em; color: var(--text-muted);"
  ></label>
  <input
    type="number"
    id="dur1"
    value="1000"
    min="100"
    max="3000"
    step="50"
    style="
      width: 65px;
      padding: 3px 5px;
      border: 1px solid var(--border);
      border-radius: 4px;
      text-align: center;
      font-family: var(--mono);
      font-size: 0.88em;
    "
  />
  <span style="font-size: 0.85em; color: var(--text-muted);">ms</span>
  <label
    id="lblPau"
    style="margin-left: 12px; font-size: 0.85em; color: var(--text-muted);"
  ></label>
  <input
    type="number"
    id="pau1"
    value="500"
    min="100"
    max="1000"
    step="50"
    style="
      width: 65px;
      padding: 3px 5px;
      border: 1px solid var(--border);
      border-radius: 4px;
      text-align: center;
      font-family: var(--mono);
      font-size: 0.88em;
    "
  />
  <span style="font-size: 0.85em; color: var(--text-muted);">ms</span>
</div>
```

**Begründung der Tag-Wahl:** `<label>` (ohne `for`-Attribut) bleibt
für die drei Beschriftungen, weil das schon vorher so war und der
Sprach-Setter `s("lblVol", …)` in `js/i18n.js` ein Element mit
dieser ID erwartet. Die Inline-Styles spiegeln die bisherige Größe
der Eingabefelder.

### Stelle 2 — Tonparameter-Card komplett entfernen (Z. 486–535)

**Aktuell zwischen den schließenden `</div>` der Tabellen-Card und
dem schließenden `</div>` des Implantat-Panels:**

```html
<div class="card">
  <h2 id="toneTitle"></h2>
  <div class="controls-row">
    <div class="control-group">
      <label id="lblVol"></label
      ><input
        type="number"
        class="vol-num"
        id="vol1"
        value="50"
        min="0"
        max="100"
        step="1"
        style="
          width: 55px;
          padding: 3px 5px;
          border: 1px solid var(--border);
          border-radius: 4px;
          text-align: center;
          font-family: var(--mono);
          font-size: 0.88em;
        "
      />%
    </div>
    <div class="control-group">
      <label id="lblDur"></label
      ><input
        type="number"
        id="dur1"
        value="1000"
        min="100"
        max="3000"
        step="50"
      />
      ms
    </div>
    <div class="control-group">
      <label id="lblPau"></label
      ><input
        type="number"
        id="pau1"
        value="500"
        min="100"
        max="1000"
        step="50"
      />
      ms
    </div>
  </div>
</div>
```

Diesen kompletten Block ersatzlos entfernen. Achtung: nur diese
eine Card entfernen — die unmittelbar davor liegende Card (mit der
Frequenz-/Elektrodentabelle, Z. 444–484) und die unmittelbar
danach folgende Panel-Schluss-Struktur bleiben **unverändert**.

---

## JS-Änderung in `js/i18n.js`

In der `applyLang()`-Funktion gibt es eine Zeile:

```js
s("toneTitle", "toneTitle");
```

Diese Zeile **ersatzlos entfernen**. Das HTML-Element
`<h2 id="toneTitle">` existiert nicht mehr; ein `getElementById`
darauf würde im Sprachsetzer `null` liefern und `s()` würde still
nichts tun — aber die Zeile ist überflüssig und sollte verschwinden.

**Nicht** anfassen: Die unmittelbar darunter folgenden Zeilen für
`lblVol`, `lblDur`, `lblPau` und das ebenfalls in der Sweep/Stop-Zeile
verbleibende `lblCorr`. Die zugehörigen Elemente bleiben (haben nur
ihre Position im DOM gewechselt) und sollen weiter mehrsprachig
beschriftet werden.

---

## i18n-Strings — `i18n/de.js`

Der Key `toneTitle` darf in `i18n/de.js` erhalten bleiben (und
ebenso in `en.js`, `fr.js`, `es.js`). Er wird nirgends mehr
referenziert, schadet aber nicht. Aufräumen ist optional und nicht
Teil dieser Anleitung.

**Keine neuen i18n-Keys werden eingeführt.** Daher entfällt der
sonst übliche Hinweis auf eine eigene Übersetzungs-Anleitung für
en/fr/es.

---

## Spec- und CODESTRUKTUR-Pflege

- `docs/spec/03-implantat.md` beschreibt aktuell die Tabelle und
  die Implant-Card, jedoch nichts zur Sweep/Stop-Zeile oder zu den
  Tonparameter-Inputs. **Keine Spec-Änderung erforderlich.**
- `docs/CODESTRUKTUR.md` listet weder die Tonparameter-Card noch
  die Sweep/Stop-Zeile namentlich. Es kommen keine neuen Dateien
  oder Funktionen hinzu, keine zentrale Variable wandert.
  **Keine CODESTRUKTUR-Änderung erforderlich.**

---

## Akzeptanztest

Nach dem Build im Browser durchgehen — alle Schritte müssen
erfüllt sein:

1. **Implantat-Reiter aufrufen.**
2. **Visuell prüfen**: direkt unter der Frequenz-/Elektroden-
   tabelle sitzt **eine einzige** Zeile mit den Elementen (von
   links nach rechts):
   - „Sweep"-Button
   - „Stop"-Button
   - Korrektur-Checkbox mit Label „Korrektur anwenden"
   - „Lautstärke:" + Zahleneingabe + „%"
   - „Tondauer:" + Zahleneingabe + „ms"
   - „Pause:" + Zahleneingabe + „ms"
3. **Visuell prüfen**: es gibt **keinen** separaten Block
   „Tonparameter" mehr darunter.
4. **Funktional prüfen**: Sweep starten — der Sweep läuft mit den
   Tonparametern aus den Eingabefeldern, identisch zum Verhalten
   vorher.
5. **Eingabe-Änderung prüfen**: Lautstärke z. B. von 50 auf 70
   ändern, Sweep neu starten — die geänderte Lautstärke wirkt.
   Ebenso Tondauer und Pause einzeln ändern und prüfen.
6. **Sprachwechsel prüfen**: Sprache auf Englisch und zurück auf
   Deutsch — die Labels „Sweep", „Stop", „Korrektur anwenden",
   „Lautstärke:", „Tondauer:", „Pause:" werden korrekt
   aktualisiert. Keine Konsolen-Warnung bezüglich `toneTitle`.
7. **Mobile prüfen** (Browserfenster auf <500 px Breite ziehen):
   die Zeile bricht sauber um, kein Element schiebt sich aus dem
   sichtbaren Bereich.
8. **Konsole prüfen**: beim Laden keine neuen Fehler oder Warnungen.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der acht Akzeptanzpunkte
einzeln durchgehen und für jeden melden:

- erfüllt / nicht erfüllt / unklar
- mit Datei- und Zeilenangabe der relevanten Code-Stelle.

Bei „unklar" Rückfrage stellen, nicht still annehmen.

Zusätzliche konkrete Sub-Prüfungen, die per `grep` schnell
gemacht sind:

- `grep -n "toneTitle" index.html` → **keine Treffer**.
- `grep -n "toneTitle" js/i18n.js` → **keine Treffer**.
- `grep -n 'id="lblVol"' index.html` → **genau eine** Stelle
  (in der Sweep/Stop-Zeile), nicht zwei.
- Analog `grep -n 'id="lblDur"' index.html` und
  `grep -n 'id="lblPau"' index.html` → je **genau eine** Stelle.
- `grep -n 'id="vol1"' index.html` → **genau eine** Stelle.
- Analog `id="dur1"` und `id="pau1"` → je **genau eine** Stelle.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.130-beta"`.

---

## Hinweise

- Erste Bauanleitung einer Reihe (BA 130–136), die schrittweise
  eine Plausibilitätsprüfung für die User-Eingaben im
  Implantat-Reiter aufbaut. BA 131 baut das Validierungs-
  Grundgerüst und legt die Warnbox unter der Tabelle an — genau
  dort, wo durch das Wegfallen der Tonparameter-Card Platz
  entsteht. Daher zuerst diese Layout-Anleitung.
- Reine Layout-Änderung. Kein Bau-Diagnose-Test nötig, das Ergebnis
  ist visuell und funktional direkt prüfbar.
