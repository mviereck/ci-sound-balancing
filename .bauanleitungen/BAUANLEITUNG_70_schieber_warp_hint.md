# Bauanleitung 70 — Schieber-Tab: dezenter Hinweistext bei aktivem Warping

## Ziel

Im **Schieber-Tab** (sichtbarer Tab „Schieber", DOM `panel-schieber`)
soll ein **dezenter Hinweistext** unter dem Canvas erscheinen,
wenn **beide** Bedingungen zutreffen:

- `pWarpOn === true` (Frequenz-Warping im Player aktiv)
- `lvTabShowCurves === true` (Kurven werden im Schieber-Diagramm
  mit angezeigt)

Wortlaut:

> Frequenz-Warping aktiv — die eingeblendeten Kurven verschieben sich
> pro Elektrode geringfügig.

**Hintergrund:** Seit Bauanleitung 66 ist die x-Achse des
Schieber-Tabs elektrodennummern-basiert und folgt **nicht** dem
Warp. Aber die im Stack-Modus eingeblendeten Kurven-Anteile (orange)
nutzen seit Bauanleitung 68 `effFreqDisplay` und verschieben sich
deshalb numerisch bei aktivem Warp. Der Hinweistext klärt diese
kleine, sonst unerklärliche Veränderung auf.

Wenn keine Kurven eingeblendet sind, entsteht keine Veränderung →
Hinweistext bleibt unsichtbar.

**Voraussetzungen:** Bauanleitung 66 und Bauanleitung 68 sind
umgesetzt.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.70-beta";
```

---

## 2. HTML-Eintrag in index.html

In `index.html` im Block `<div id="panel-schieber" class="panel">`
(Z. 764 ff.). Direkt **nach** dem Canvas-Container
`<div style="position:relative;…"><canvas id="lvTabCv"…></canvas></div>`
(Z. 823–825) und **vor** der bestehenden Tastatur-Hinweis-Zeile
`<p … data-t="lvTabKeyHint">` (Z. 826), eine neue Hinweis-Zeile
einfügen.

**Vorher (Z. 823–826):**

```html
          <div style="position:relative;width:100%;height:620px;background:var(--bg);border-radius:8px;overflow:hidden">
            <canvas id="lvTabCv" tabindex="0" style="width:100%;height:100%;display:block;outline:none"></canvas>
          </div>
          <p style="font-size:.78em;color:var(--text-muted);margin-top:8px" data-t="lvTabKeyHint"></p>
```

**Nachher:**

```html
          <div style="position:relative;width:100%;height:620px;background:var(--bg);border-radius:8px;overflow:hidden">
            <canvas id="lvTabCv" tabindex="0" style="width:100%;height:100%;display:block;outline:none"></canvas>
          </div>
          <div
            id="lvTabWarpHint"
            data-t="lvTabWarpHint"
            style="margin-top:6px;font-size:0.78em;color:#888;display:none;"
          ></div>
          <p style="font-size:.78em;color:var(--text-muted);margin-top:8px" data-t="lvTabKeyHint"></p>
```

(Default `display:none` — Sichtbarkeit wird per JS gesteuert,
abhängig von Warp- und Checkbox-Zustand.)

---

## 3. i18n-Eintrag in i18n/de.js

In `i18n/de.js` im `Object.assign(L.de, { ... })`-Block einen neuen
Schlüssel ergänzen (sinnvoll in der Nähe anderer `lvTab*`-Schlüssel):

```js
lvTabWarpHint:
  "Frequenz-Warping aktiv — die eingeblendeten Kurven verschieben " +
  "sich pro Elektrode geringfügig.",
```

`en.js`, `fr.js`, `es.js` **nicht** anfassen — fehlende Schlüssel
fallen auf Deutsch zurück. Mini-Anleitung Übersetzungen kommt
später.

---

## 4. Sichtbarkeits-Logik in levels-tab.js

In `js/levels-tab.js` eine neue lokale Hilfsfunktion einfügen,
die den Hinweis anhand des aktuellen Zustands anzeigt oder
ausblendet. Position: über `lvTabRebuild` (Z. 33), damit sie
beim Bind verfügbar ist.

```js
// Steuert die Sichtbarkeit des dezenten Warp-Hinweises unter dem
// Schieber-Canvas. Sichtbar nur, wenn Frequenz-Warping aktiv ist
// UND Kurven mit eingeblendet sind (lvTabShowCurves). Sonst
// versteckt — die x-Achse des Schiebers ist elektrodennummern-
// basiert (Bauanleitung 66) und verschiebt sich nicht durch Warp;
// der Hinweis betrifft ausschließlich die numerischen Werte der
// Kurven-Anteile im Stack.
function lvTabUpdateWarpHint() {
  const el = document.getElementById("lvTabWarpHint");
  if (!el) return;
  const warpActive = (typeof pWarpOn !== "undefined") && pWarpOn === true;
  const curvesShown = (typeof lvTabShowCurves !== "undefined")
    && lvTabShowCurves === true;
  el.style.display = (warpActive && curvesShown) ? "" : "none";
}
```

Aufruf dieser Hilfsfunktion an den passenden Stellen einfügen:

### 4a. In `lvTabRebuild` (Z. 33–42)

Am Ende der Funktion, **nach** `lvTabDraw();` (Z. 41):

**Vorher:**

```js
function lvTabRebuild() {
  lvTabUpdateModeAvailability();
  const meas = document.getElementById("lvTabChkMeas");
  const cur = document.getElementById("lvTabChkCurves");
  if (meas) meas.checked = lvTabShowMeas;
  if (cur) cur.checked = lvTabShowCurves;
  const nav = lvTabNavigableEl();
  if (nav.length && !nav.includes(lvTabFocus)) lvTabFocus = nav[0];
  lvTabDraw();
}
```

**Nachher:**

```js
function lvTabRebuild() {
  lvTabUpdateModeAvailability();
  const meas = document.getElementById("lvTabChkMeas");
  const cur = document.getElementById("lvTabChkCurves");
  if (meas) meas.checked = lvTabShowMeas;
  if (cur) cur.checked = lvTabShowCurves;
  const nav = lvTabNavigableEl();
  if (nav.length && !nav.includes(lvTabFocus)) lvTabFocus = nav[0];
  lvTabDraw();
  lvTabUpdateWarpHint();
}
```

### 4b. Im Listener für `#lvTabChkCurves`

Die Curves-Checkbox-Logik liegt heute vermutlich entweder im
DOMContentLoaded-Handler von `levels-tab.js` oder zentral in
`init.js`. Mit `grep -n "lvTabChkCurves" js/*.js` die Stelle finden
und am Ende des Change-Listeners **nach** dem `lvTabShowCurves = ...`-Setzen
und einem etwaigen `lvTabDraw()`-Aufruf folgenden Aufruf ergänzen:

```js
    lvTabUpdateWarpHint();
```

### 4c. An den Warp-Listenern in init.js

In `js/init.js` an den Stellen, die in BA 68/69 schon
`drawLvChart()` und `pDrawEQ()` aufrufen (Warp-Toggle Z. ~418,
Warp-Strength Z. ~447 und ~464, ggf. Warp-Mode, sowie JSON-Load
Z. ~636):

```js
    if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
```

**Wenn die genauen Stellen schwer zu finden sind: Rückfrage
stellen.**

---

## 5. Initial-Aufruf nach Page-Load

Damit der Hinweis nach einem Browser-Reload (mit aktivem Warp +
sichtbaren Kurven aus localStorage / JSON-Datei) korrekt sichtbar
ist, muß `lvTabUpdateWarpHint()` einmalig nach dem vollständigen
Init laufen.

In `js/init.js` am **Ende** des großen DOMContentLoaded-Handlers
(nach dem Restore-Block für aktiven Tab/Subtab) ergänzen:

```js
  if (typeof lvTabUpdateWarpHint === "function") lvTabUpdateWarpHint();
```

(Falls `lvTabRebuild()` ohnehin am Ende läuft, ist das schon
abgedeckt — dann kann der Init-Aufruf entfallen. Prüfen, ob nach
dem Restore ein `lvTabRebuild()`-Aufruf erfolgt; wenn ja, paßt
es bereits.)

---

## 6. Doku-Updates

### 6a. `docs/CODESTRUKTUR.md`

Im Eintrag zu **`levels-tab.js`** (Z. 142) ergänzen, daß
`lvTabUpdateWarpHint` existiert und den dezenten Warp-Hinweis unter
dem Canvas steuert (sichtbar nur bei `pWarpOn && lvTabShowCurves`).

### 6b. `docs/spec/04-schieber.md`

Am Ende der Schieber-Tab-Beschreibung einen kurzen Absatz ergänzen,
sinngemäß:

> **Hinweis bei Frequenz-Warping:** Wenn im Player das Frequenz-
> Warping aktiv ist und die Kurven-Anzeige (`lvTabShowCurves`)
> eingeschaltet ist, erscheint unter dem Canvas der dezente
> graue Hinweis: „Frequenz-Warping aktiv — die eingeblendeten
> Kurven verschieben sich pro Elektrode geringfügig." Die x-Achse
> des Schieber-Tabs ist seit Bauanleitung 66 elektrodennummern-
> basiert und folgt dem Warp nicht — der Hinweis bezieht sich
> ausschließlich auf die numerische Verschiebung der orangefarbenen
> Kurven-Anteile im Stack.

---

## 7. Akzeptanztest (Klick-für-Klick)

**Voraussetzung:** Frequenzabgleich-Daten (`fRes`) liegen vor. Eine
Kurve im Kurven-Tab ist aktiviert mit Stärke ≠ 0 (z. B. Gauß +5).

1. **App neu laden** (Cache-Bust). Tab „Schieber" öffnen.
   **Warp aus**, **Kurven-Checkbox aus**.
   **Erwartet:** Kein Hinweistext sichtbar.

2. **Kurven-Checkbox einschalten** (`lvTabChkCurves`).
   **Erwartet:** Stack-Diagramm zeigt orange Kurven-Anteile.
   **Hinweistext weiterhin nicht sichtbar** (Warp ist aus).

3. **Tab „Player" → Frequenz-Warping einschalten**.

4. **Zurück zu Tab „Schieber".**
   **Erwartet:** Unter dem Canvas erscheint der dezente graue Text:
   „Frequenz-Warping aktiv — die eingeblendeten Kurven verschieben
   sich pro Elektrode geringfügig."

5. **Kurven-Checkbox ausschalten.**
   **Erwartet:** Hinweistext verschwindet unmittelbar.

6. **Kurven-Checkbox wieder einschalten.**
   **Erwartet:** Hinweistext erscheint wieder.

7. **Warp im Player ausschalten** und zurück zum Schieber-Tab.
   **Erwartet:** Hinweistext verschwindet.

8. **JSON speichern** mit Warp an + Kurven an, anschließend
   **neu laden**.
   **Erwartet:** Nach Laden ist der Hinweistext im Schieber-Tab
   wieder sichtbar.

9. **Sprachwechsel** (z. B. auf Englisch).
   **Erwartet:** Hinweistext bleibt sichtbar (Fallback auf
   deutschen Default).

10. **Modus-Wechsel** rel ↔ abs im Schieber-Tab.
    **Erwartet:** Hinweistext-Sichtbarkeit unverändert (hängt nur
    an Warp + Curves-Checkbox, nicht am Modus).

---

## 8. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §7 einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Zusätzlich folgende technische Punkte einzeln prüfen und melden:

- `js/version.js`: `APP_VERSION` ist `"3.0.70-beta"`.
- `index.html`: `<div id="lvTabWarpHint" data-t="lvTabWarpHint"
  style="…display:none;">` existiert direkt unter dem
  `<div>`-Container von `#lvTabCv`.
- `i18n/de.js`: Schlüssel `lvTabWarpHint` ist gesetzt.
- `js/levels-tab.js`: Funktion `lvTabUpdateWarpHint` existiert und
  steuert `el.style.display` anhand von `pWarpOn` und
  `lvTabShowCurves`.
- `js/levels-tab.js`: `lvTabRebuild` ruft am Ende
  `lvTabUpdateWarpHint()` auf.
- `lvTabChkCurves`-Change-Listener (in `levels-tab.js` oder
  `init.js`) ruft am Ende `lvTabUpdateWarpHint()` auf.
- `js/init.js`: An den Warp-Listenern (Toggle, Strength, Mode,
  JSON-Load) wird `lvTabUpdateWarpHint()` mit aufgerufen, **zusätzlich**
  zu den bestehenden Aufrufen von `drawLvChart`, `pBuildEQ`, `pDrawEQ`
  aus BA 68/69.
- Initial-Sichtbarkeit nach DOMContentLoaded ist korrekt (entweder
  über `lvTabRebuild` am Ende des Restore-Blocks oder direkter
  Aufruf).

Wenn ein Punkt **unklar** bleibt, **Rückfrage stellen**, nicht
stillschweigend etwas annehmen.

---

## 9. Hinweis für Folge-Anleitungen

- **Bauanleitung 71**: Archiv-Druck-Renderer in `print-md.js` auf
  `effFreqDisplay` umstellen.
- **Mini-Anleitung Übersetzungen**: `en.js`, `fr.js`, `es.js` für
  `lvChartWarpHint` (aus BA 68) und `lvTabWarpHint` (aus BA 70)
  ergänzen, sobald die deutschen Vorlagen durch sind.
