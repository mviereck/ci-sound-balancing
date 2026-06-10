# BAUANLEITUNG 156 — Stand-Schnappschuß und Hinweis-Banner für Stereo-Balance und Latenz

**Zieldateien:** `js/state-side.js`, `js/lr-balance.js`, `js/latency.js`, `js/test-ui.js`, `js/file.js`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 155 abgeschlossen. Stand `js/version.js` = `3.0.155-beta`.

**Version:** 3.0.155-beta → **3.0.156-beta**

---

## Kontext

Konzeptbeschluß aus der Sperrmatrix: Implantat-Änderungen, die für
**Stereo-Balance** und **Latenz** nur einen Hinweis (keine Sperre)
auslösen sollen, müssen erkennbar sein, sobald sich nach einer
Messung etwas Relevantes geändert hat. Dazu wird zur Meß-Zeit ein
Schnappschuß der wichtigsten Implantat-Felder mitgespeichert und
beim Anzeigen mit dem aktuellen Stand verglichen.

Implementiert wird ein allgemeiner Hinweistext („Implantat-
Einstellungen wurden seit der Messung verändert — eine neue Messung
ist möglicherweise sinnvoll."). Konkrete Differenzen werden nicht
einzeln aufgezählt (Konzept-Klärung). Bei alten Datensätzen ohne
Schnappschuß wird kein Hinweis gezeigt.

**Snapshot-Felder:**
- pro Seite: `config` (Hörtechnik), `manufacturer`, `nEl`, Liste der
  deaktivierten Elektroden-Indizes (`elSt[i] === "deactivated"`).
- Hz-Werte werden nicht aufgenommen — Latenz und Stereo-Balance
  hängen nicht von einzelnen Frequenz-Zuordnungen ab.

Bei Frequenzabgleich und Lautstärke-Test wird dieser Schnappschuß
**nicht** angelegt — diese Tests haben Sperren, keinen Hinweis.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.156-beta";
```

---

## Schritt 2 — Snapshot-Helper in `js/state-side.js`

Am Ende der Helfer-Funktionen (z.B. nach `isSideUsable` aus BA 155),
zwei neue Funktionen ergänzen:

```js
// BA 156: Snapshot der für Tests relevanten Implantat-Felder
function implantSnapshot() {
  function _sideSnap(side) {
    const s = sideData[side];
    if (!s) return null;
    const deact = [];
    const arr = s.elSt || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === "deactivated") deact.push(i);
    }
    return {
      config: s.config || "unknown",
      manufacturer: s.manufacturer || "unknown",
      nEl: s.nEl || 0,
      deactivatedIdx: deact,
    };
  }
  return {
    left:  _sideSnap("left"),
    right: _sideSnap("right"),
  };
}

function implantSnapshotsDiffer(a, b) {
  if (!a || !b) return false; // ein leerer Snapshot → kein Hinweis
  function _eqSide(x, y) {
    if (!x || !y) return false;
    if (x.config !== y.config) return false;
    if (x.manufacturer !== y.manufacturer) return false;
    if (x.nEl !== y.nEl) return false;
    const xD = x.deactivatedIdx || [], yD = y.deactivatedIdx || [];
    if (xD.length !== yD.length) return false;
    for (let i = 0; i < xD.length; i++) if (xD[i] !== yD[i]) return false;
    return true;
  }
  return !(_eqSide(a.left, b.left) && _eqSide(a.right, b.right));
}
```

---

## Schritt 3 — Snapshot bei Stereo-Balance-Messung speichern

Datei `js/lr-balance.js`. Globaler Snapshot-Speicher direkt nach der
`lrResults`-Deklaration (Z. 6) einfügen:

```js
// BA 156: Schnappschuß zum Zeitpunkt der ersten LR-Messung
let lrSnapshot = null;
```

An den Stellen, wo `lrResults[idx] = val` gesetzt wird (per `grep -n
"lrResults\[" js/lr-balance.js`), **zusätzlich** sicherstellen, daß
`lrSnapshot` beim **ersten** Eintrag gesetzt wird:

```js
// BA 156
if (lrSnapshot === null && typeof implantSnapshot === 'function') {
  lrSnapshot = implantSnapshot();
}
```

(Falls die Schreibstelle eine Funktion ist, in der Funktion einmal
am Anfang. Sonnet wählt die naheliegende Stelle.)

Beim Datenlöschen von LR (Z. 898 `if (!confirm(t("lrClearConfirm")) ...`-
Block, plus `resetAll` in file.js Z. 65-70): Snapshot ebenfalls
nullen:

```js
lrSnapshot = null;
```

---

## Schritt 4 — Snapshot bei Latenz-Messung speichern

Datei `js/latency.js`. Beim Schreiben von `latencyResult` (Z. 325):

**Vorher (etwa):**
```js
latencyResult = {
  valueMs: ...,
  clickType: ...,
  intervalMs: ...,
};
```

**Nachher:**
```js
latencyResult = {
  valueMs: ...,
  clickType: ...,
  intervalMs: ...,
  implantSnapshot: (typeof implantSnapshot === 'function') ? implantSnapshot() : null,
};
```

Beim Datenlöschen (Z. 409 `latencyResult = null;`) und in `resetAll`
ist nichts zusätzlich nötig — der Snapshot ist Teil von `latencyResult`
selbst.

---

## Schritt 5 — Hinweis-Banner-Render-Helpers

Datei `js/state-side.js` (am Ende der Helfer-Block):

```js
// BA 156: Hinweis-Banner-Helper. testKey ∈ {'lr', 'lat'}.
// containerEl: das DOM-Element oben im Test-Reiter, in das ggf.
// die Banner-Box hineinrendert wird. Bei fehlendem oder gleichem
// Snapshot wird der Container geleert.
function renderSnapshotHint(testKey, containerEl) {
  if (!containerEl) return;
  let oldSnap = null;
  if (testKey === 'lr') {
    oldSnap = (typeof lrSnapshot !== 'undefined') ? lrSnapshot : null;
  } else if (testKey === 'lat') {
    oldSnap = (typeof latencyResult !== 'undefined' && latencyResult)
            ? latencyResult.implantSnapshot : null;
  }
  if (!oldSnap) { containerEl.innerHTML = ''; return; }
  const curSnap = implantSnapshot();
  if (!implantSnapshotsDiffer(oldSnap, curSnap)) {
    containerEl.innerHTML = '';
    return;
  }
  containerEl.innerHTML =
    '<div class="snapshot-hint">' + t('snapshotHintChanged') + '</div>';
}
```

CSS für `.snapshot-hint` am Ende von `style.css` ergänzen:
```css
/* BA 156 */
.snapshot-hint {
  background: #fef3c7;
  border-left: 3px solid #d97706;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 10px;
  font-size: 0.88em;
  color: #92400e;
}
```

i18n in `i18n/de.js`:
```js
  snapshotHintChanged: "Hinweis: Implantat-Einstellungen wurden seit der Messung verändert. Eine neue Messung ist möglicherweise sinnvoll.",
```

---

## Schritt 6 — Banner im Test-UI-Builder vorsehen

Datei `js/test-ui.js`, in `_buildTestPanelOld` (Z. 72) und ggf. der
neueren Variante. Direkt nach dem Explain-Block (vor dem Presets-
Block) einen Container für den Banner einfügen:

```js
// BA 156: Snapshot-Hinweis-Banner
var snapHintBox = _mkEl('div');
snapHintBox.id = 'snapHint_' + id;
snapHintBox.className = 'snapshot-hint-box';
parentEl.appendChild(snapHintBox);
```

Im `headerRefs`-/`tEls`-Rückgabeobjekt:
```js
snapHintBox: snapHintBox,
```

Damit hat jedes gebaute Test-Panel einen Banner-Container. LR und
Latenz nutzen ihn, die anderen Tests lassen ihn leer (keine Aktion).

---

## Schritt 7 — Banner aktualisieren bei Reiter-Aktivierung

Datei `js/lr-balance.js`: Wo immer der LR-Reiter sichtbar gemacht
oder neu gerendert wird (per grep `lrApplyLang`, `lrRenderResults`,
`lrCheckData`), am Ende der Render-Funktion ergänzen:

```js
// BA 156
if (typeof renderSnapshotHint === 'function' && lrEls && lrEls.snapHintBox) {
  renderSnapshotHint('lr', lrEls.snapHintBox);
}
```

Datei `js/latency.js`: analog. Per grep `latRenderResults` finden,
Ende ergänzen:

```js
// BA 156
if (typeof renderSnapshotHint === 'function' && latEls && latEls.snapHintBox) {
  renderSnapshotHint('lat', latEls.snapHintBox);
}
```

Falls `lrEls`/`latEls` nicht die `snapHintBox` enthalten (weil die
Test-UI-Konstruktion das Feld nicht durchreicht), Sonnet ergänzt
den Pfad in test-ui.js und/oder verwendet `document.getElementById('snapHint_' + ...)` direkt.

Zusätzlicher Aufruf nach Save/Load: in `js/file.js`, am Ende von
`loadJson` (nach allen Result-Übernahmen, z.B. nach Z. 467
`latencyResult = ...`):

```js
// BA 156: Snapshot-Variable für LR aus geladener Datei nicht vorhanden,
// daher null lassen (führt zu „kein Hinweis" bei alten Dateien — Konzept).
if (typeof lrSnapshot !== 'undefined') lrSnapshot = null;
```

(Für Latenz reicht das `latencyResult.implantSnapshot`-Feld, das
in alten Dateien `undefined` ist und durch `renderSnapshotHint`
korrekt als „kein Hinweis" behandelt wird.)

---

## Schritt 8 — Optional: Snapshot in Speicherdatei

Bei `saveJson` in `js/file.js` (Z. 81 ff.) das `lrSnapshot` mit
abspeichern, damit zwischen Sessions die Vergleichsbasis erhalten
bleibt:

```js
const d = {
  ...
  lrSnapshot: (typeof lrSnapshot !== 'undefined') ? lrSnapshot : null,
  ...
};
```

Beim `loadJson` entsprechend zurücklesen:
```js
if (typeof lrSnapshot !== 'undefined' && d.lrSnapshot) {
  lrSnapshot = d.lrSnapshot;
}
```

Wenn `d.lrSnapshot` fehlt (alte Datei), bleibt `lrSnapshot = null` —
kein Hinweis, gewünschtes Verhalten.

---

## Akzeptanztest

1. **Frische Session.** Version 3.0.156-beta. Beide Seiten auf
   CI mit MED-EL gewählt.
2. **Stereo-Balance-Test** durchführen, mindestens eine Elektrode
   einstellen. Verlassen des Reiters.
3. **Reiter wieder öffnen.** Erwartet: kein Hinweis-Banner.
4. **Im Implantat-Reiter eine Elektrode auf „im CI deaktiviert"
   setzen.** Zurück zum Stereo-Balance-Reiter.
5. **Erwartet:** gelb-orangener Hinweis-Banner oben mit Text
   „Implantat-Einstellungen wurden seit der Messung verändert.
   Eine neue Messung ist möglicherweise sinnvoll."
6. **Elektrode wieder auf „ok" stellen.** Stereo-Balance-Reiter:
   Banner verschwindet.
7. **Hersteller wechseln (z.B. MED-EL → Cochlear).** Auf
   Stereo-Balance-Reiter: Banner erscheint.
8. **Stereo-Balance-Ergebnisse löschen.** Banner verschwindet
   beim nächsten Reiterwechsel (weil `lrSnapshot = null`).
9. **Latenz-Test** durchführen, Wert messen. Zurück zum Reiter.
10. **Erwartet:** kein Banner.
11. **Hörtechnik einer Seite auf „Normal" stellen.** Latenz-
    Reiter erneut öffnen.
12. **Erwartet:** Banner erscheint, gleicher Text.
13. **Latenz-Ergebnis löschen.** Banner verschwindet.
14. **Datei mit gespeichertem Snapshot laden** (aus einer
    zukünftigen BA-156-Session). Vergleichsbasis bleibt erhalten,
    Banner-Logik funktioniert.
15. **Datei mit alten Daten ohne Snapshot laden.** Kein Banner
    (mangels Vergleichsbasis), wie konzeptuell vereinbart.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 15 Schritte einzeln durchgehen
und melden: erfüllt / nicht erfüllt / unklar.

Zusätzlich:
- An welchen Stellen wird `lrSnapshot` gesetzt? Liste mit Datei/Zeile.
- An welchen Stellen wird `lrSnapshot` auf null gesetzt? Liste.
- Wird `latencyResult.implantSnapshot` beim Schreiben tatsächlich
  ergänzt? Datei/Zeile.
- Wird `renderSnapshotHint` aus den Render-Funktionen von LR und
  Latenz aufgerufen?
- Wo wurde der Banner-Container im Test-UI-Builder eingehängt?
- Funktioniert das Verhalten „alte Datei ohne Snapshot = kein
  Hinweis" durch `null`-Check?
- Steht `js/version.js` auf `3.0.156-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js`
- `js/state-side.js` — Snapshot-Helper + Render-Helper
- `js/lr-balance.js` — `lrSnapshot`-Variable, Setzen/Löschen,
  Renderer-Aufruf
- `js/latency.js` — `implantSnapshot`-Feld in `latencyResult`,
  Renderer-Aufruf
- `js/test-ui.js` — Banner-Container im Test-UI-Builder
- `js/file.js` — `lrSnapshot` in save/load, Null-Setzen in resetAll
- `style.css` — `.snapshot-hint`-Stil
- `i18n/de.js` — ein neuer Key

---

## Nicht in dieser Bauanleitung enthalten

- **BA 157** — differenzierte Lösch-Knöpfe im FreqMatch-Ergebnis.
- Übersetzungen en/fr/es — eigene Mini-Anleitung.
