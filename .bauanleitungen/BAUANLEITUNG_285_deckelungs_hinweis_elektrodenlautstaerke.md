# BA 285 — Deckelungs-Hinweis im Elektrodenlautstärke-Test

**Ziel-Version nach Build:** `0.4.285-beta`
**Baut auf BA 284 auf** (Funktion `pairGains` mit Feld `capped`).

## Kontext

Mit BA 284 gibt es die Zwei-Zonen-Pegellogik (`pairGains` in
`js/audio.js`). In **Zone 2** klebt ein Ton am Maximalpegel und nur der
andere wird durch den Slider angepasst. `pairGains` meldet das über das
Rückgabefeld `capped` (`null | 'a' | 'b'`).

Diese BA blendet in Zone 2 einen **dezenten Hinweis** ein, **unter** der
Zeile mit den Knöpfen „Zurück / Nochmal / Gleichzeitig" und über der
Zwischenstands-Tabelle:

> **„E9 hat die maximale Lautstärke erreicht — nur E6 wird noch angepasst."**

Dabei werden die Töne mit ihrer **Elektroden-Bezeichnung** benannt (wie
im Tonpaar-Anzeiger oben), `{capped}` = der gedeckelte Ton, `{other}` =
der noch angepasste. Bei Rückkehr in Zone 1 (Slider zurück, beide Töne
unter dem Maximum) verschwindet der Hinweis wieder.

Umgesetzt als **testUI-API-Erweiterung** (neues Element `clipHint` +
Methode `testUI.clipHint.set`), nicht als DOM-Patch im Modul — gemäß
Notausgang-Prinzip (`docs/spec/00-testui-architektur.md`).

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'` verwenden.**

---

## Schritt 1 — `js/test-ui.js`: clipHint-Element im Panel-Aufbau

Das Element gehört **zwischen** die `actions`-Sektion und die
`statusGrid`-Sektion. Aktuell endet `actions` bei Z. 865 mit
`refs.actions = actRefs; }` und `statusGrid` beginnt bei Z. 867.

**Vorher** (Z. 863–869):

```js
      vWrap.appendChild(actRow);
      refs.actions = actRefs;
    }

    // --- statusGrid ---
    if (body.statusGrid && (body.statusGrid === true || body.statusGrid.show !== false)) {
      var sgEl = _mkEl('div', 'fm-status-grid');
```

**Nachher** (neuen Block dazwischen):

```js
      vWrap.appendChild(actRow);
      refs.actions = actRefs;
    }

    // --- clipHint (BA 285): Deckelungs-Hinweis unter der Aktionszeile ---
    if (body.clipHint) {
      var clipEl = _mkEl('div', 'clip-hint');
      clipEl.style.display = 'none';
      vWrap.appendChild(clipEl);
      refs.clipHint = clipEl;
    }

    // --- statusGrid ---
    if (body.statusGrid && (body.statusGrid === true || body.statusGrid.show !== false)) {
      var sgEl = _mkEl('div', 'fm-status-grid');
```

---

## Schritt 2 — `js/test-ui.js`: Methode `testUI.clipHint.set`

Das `testUI`-Objekt beginnt bei Z. 1307 und enthält die Namespaces
`pairIndicator`, `progress`, `slider`. Einen neuen Namespace `clipHint`
ergänzen — z.B. direkt **nach** dem schließenden `}` des
`pairIndicator`-Namespaces (vor `// ---- progress ----`, Z. 1347):

```js
  // ---- clipHint (BA 285) ----
  clipHint: {
    /**
     * Deckelungs-Hinweis setzen oder ausblenden.
     * el:   refs.clipHint (aus Verfahren-Refs)
     * text: String zum Anzeigen, null/'' zum Ausblenden.
     */
    set: function(el, text) {
      if (!el) return;
      if (!text) { el.style.display = 'none'; el.textContent = ''; return; }
      el.textContent = text;
      el.style.display = '';
    }
  },
```

> Auf das Komma nach dem Block achten (es folgen weitere Namespaces).

---

## Schritt 3 — `js/test.js`: clipHint im Test-Body aktivieren

In `_testBody()` (Z. 1154–1177) das neue Element anfordern. Es liegt im
Aufbau ohnehin zwischen `actions` und `statusGrid`.

**Vorher** (Ende von `_testBody`, Z. 1169–1176):

```js
      actions:        [
        'undo',
        'replay',
        'simul',
        { kind: 'swap', labelKey: 'btnSwapAB' }
      ],
      statusGrid:     { show: true }
    };
```

**Nachher:**

```js
      actions:        [
        'undo',
        'replay',
        'simul',
        { kind: 'swap', labelKey: 'btnSwapAB' }
      ],
      clipHint:       true,
      statusGrid:     { show: true }
    };
```

---

## Schritt 4 — `js/test.js`: Hinweis-Aktualisierung + Slider-Hook

### 4a — Zwei Helfer einfügen

Neben die bestehende Funktion `_testUpdateRangeHint` (Definition bei
Z. 948) zwei neue Funktionen stellen:

```js
// BA 285: Deckelungs-Hinweis aktualisieren. off optional (sonst aktueller
// Slider-Wert). Nutzt pairGains.capped aus audio.js (BA 284).
function _testUpdateClipHint(off) {
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (!vref || !vref.clipHint) return;
  if (off == null) off = _testSliderVal();
  var g = pairGains(tGVol(), off);
  if (!g.capped) {
    testUI.clipHint.set(vref.clipHint, null);
    return;
  }
  var prefix = dENPrefix();
  var labelA = prefix + dEN(curA);
  var labelB = prefix + dEN(curB);
  var capLabel   = (g.capped === 'a') ? labelA : labelB;
  var otherLabel = (g.capped === 'a') ? labelB : labelA;
  var txt = t('clipHintCapped').replace('{capped}', capLabel).replace('{other}', otherLabel);
  testUI.clipHint.set(vref.clipHint, txt);
}

// BA 285: Slider-Bewegung. Da jetzt ein onSlide-Hook vorhanden ist,
// uebernimmt dieser auch die dB-Anzeige (das Auto-Update in test-ui.js
// laeuft nur OHNE onSlide-Hook).
function _testOnSlide(off) {
  var vref = testEls && testEls.verfahren && testEls.verfahren[_testActiveVerfahren];
  if (vref && vref.slider) {
    testUI.slider.setValueDisplay(vref.slider, off.toFixed(1) + " dB");
  }
  _testUpdateClipHint(off);
}
```

### 4b — `onSlide`-Hook in den gemeinsamen Hooks ergänzen

In `_testHooksCommon()` (Z. 1179–1188).

**Vorher:**

```js
  function _testHooksCommon() {
    return {
      onStop:    function() { endTest(); renderResults(); },
      onConfirm: function() { recBal(); },
      onReplay:  function() { playCur(); },
      onUndo:    function() { undoL(); },
      onSimul:   function() { _testPlaySimul(); },
      onSwap:    function() { _testSwap(); }
    };
  }
```

**Nachher:**

```js
  function _testHooksCommon() {
    return {
      onStop:    function() { endTest(); renderResults(); },
      onConfirm: function() { recBal(); },
      onReplay:  function() { playCur(); },
      onUndo:    function() { undoL(); },
      onSimul:   function() { _testPlaySimul(); },
      onSwap:    function() { _testSwap(); },
      onSlide:   function(off) { _testOnSlide(off); }
    };
  }
```

> **Wichtig:** Mit dem `onSlide`-Hook entfällt das automatische Aktualisieren
> der „X.X dB"-Anzeige in `js/test-ui.js` (Z. 743 — läuft nur, wenn KEIN
> `onSlide`-Hook gesetzt ist). Deshalb setzt `_testOnSlide` die Anzeige
> über `testUI.slider.setValueDisplay` selbst. Ohne diese Zeile bliebe die
> dB-Anzeige beim Schieben auf `0.0 dB` stehen.

### 4c — Hinweis bei Paarwechsel und Swap mit aktualisieren

`_testUpdateClipHint()` an **beiden** Stellen ergänzen, an denen bereits
`_testUpdateRangeHint()` aufgerufen wird (programmatisches Setzen des
Sliders feuert kein `input`-Event, daher hier explizit nötig).

**Stelle 1 — Swap** (Z. 734):

```js
  _testUpdateRangeHint();
```

→ wird zu:

```js
  _testUpdateRangeHint();
  _testUpdateClipHint();
```

**Stelle 2 — Paarwechsel** (Z. 910):

```js
  _testUpdateRangeHint();
```

→ wird zu:

```js
  _testUpdateRangeHint();
  _testUpdateClipHint();
```

> Per `grep -n "_testUpdateRangeHint()" js/test.js` prüfen, dass beide
> Aufrufstellen (nicht die Definition) erfasst sind. Falls weitere
> hinzugekommen sind, dort ebenfalls `_testUpdateClipHint()` daneben.

---

## Schritt 5 — `i18n/de.js`: Hinweistext

Einen neuen Key ergänzen (bei den übrigen Test-Texten). Platzhalter im
Projekt-Stil (`{name}`, per `.replace()` ersetzt — wie `freqmatch.js`):

```js
    clipHintCapped: "{capped} hat die maximale Lautstärke erreicht — nur {other} wird noch angepasst.",
```

> `en.js`/`fr.js`/`es.js` werden **nicht** angefasst; fehlende Keys fallen
> auf den deutschen Default zurück.

Optional eine dezente CSS-Klasse `clip-hint` in `style.css` (kleiner,
gedämpfter Text, etwas Abstand nach oben). Falls keine Regel angelegt
wird, erscheint der Hinweis als normaler Text — funktional ausreichend.
Empfehlung:

```css
.clip-hint {
  margin-top: 0.5rem;
  font-size: 0.85em;
  color: var(--muted, #888);
  text-align: center;
}
```

---

## Schritt 6 — Spec / Architektur-Doku

- `docs/spec/02-messung.md`: im Slider-Wirkung-Abschnitt (Test 1) den
  Deckelungs-Hinweis erwähnen (erscheint in Zone 2 unter der Aktionszeile,
  nennt den gedeckelten und den angepassten Ton).
- `docs/spec/00-testui-architektur.md`: den neuen API-Baustein
  `testUI.clipHint.set(refs.clipHint, text)` und das body-Flag
  `clipHint: true` aufnehmen.

---

## Schritt 7 — Version hochzählen

In **`js/version.js`**:

```js
const APP_VERSION = "0.4.285-beta";
```

---

## Akzeptanztest-Checkliste

Vorbereitung: Test „Elektrodenlautstärke" mit zwei testbaren Elektroden
starten (im Beispiel A = E9, B = E6).

1. **Slider in der Mitte / kleine Auslenkung** (bei Default-Lautstärke
   50 %).
   *Erwartet:* **Kein** Hinweis unter der Knopfzeile; beide Töne bewegen
   sich (Zone 1).

2. **dB-Anzeige beim Schieben** beobachten.
   *Erwartet:* Die große „X.X dB"-Anzeige zählt beim Schieben korrekt mit
   (nicht auf 0.0 stehengeblieben).

3. **Lautstärke in der Tonart-Modalbox auf 100 % stellen**, Slider etwas
   nach rechts.
   *Erwartet:* Unter der Zeile „Zurück / Nochmal / Gleichzeitig" erscheint
   dezent: **„E6 hat die maximale Lautstärke erreicht — nur E9 wird noch
   angepasst."** (B = E6 ist bei +Richtung der lautere → gedeckelt.)

4. **Slider nach links** (negativ) bei 100 %.
   *Erwartet:* Hinweis wechselt zu **„E9 hat die maximale Lautstärke
   erreicht — nur E6 wird noch angepasst."**

5. **Slider zurück Richtung Mitte**, bis beide Töne wieder Reserve haben.
   *Erwartet:* Hinweis **verschwindet** wieder.

6. **„Nochmal"** und **„Gleichzeitig"** im gedeckelten Zustand.
   *Erwartet:* Hinweis bleibt sichtbar und passend.

7. **Swap (A↔B)** im gedeckelten Zustand.
   *Erwartet:* Der Hinweis nennt nach dem Tausch die korrekten
   Bezeichnungen (Slider-Wert invertiert sich, gedeckelter Ton wechselt
   entsprechend).

8. **Nächstes Paar** (Bestätigen).
   *Erwartet:* Hinweis wird für das neue Paar korrekt neu bewertet
   (i.d.R. zunächst aus, da Slider neu startet).

9. **Browser-Konsole**: keine Fehler.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–9) einzeln durchgehen:
**erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe.
Zusätzlich bestätigen:

- `testUI.clipHint.set` existiert; `clipHint`-Element wird zwischen
  `action-row` und `statusGrid` eingehängt (`refs.clipHint`).
- `_testBody` enthält `clipHint: true`.
- `_testHooksCommon` enthält `onSlide`; `_testOnSlide` setzt die
  dB-Anzeige **und** ruft `_testUpdateClipHint`.
- `_testUpdateClipHint()` wird an **beiden** `_testUpdateRangeHint()`-
  Aufrufstellen (Swap, Paarwechsel) ergänzt.
- `clipHintCapped` ist in `i18n/de.js` vorhanden; `en/fr/es` unverändert.
- Die dB-Anzeige bleibt beim Schieben **nicht** auf `0.0 dB` stehen
  (Kriterium 2 — häufigste Falle durch den neuen `onSlide`-Hook).
- `js/version.js` steht auf `"0.4.285-beta"`.

Bei „unklar" nachfragen, nicht still annehmen.

---

*Hinweis:* Der einzige neue UI-Text ist `clipHintCapped` (Deutsch).
Übersetzungen folgen, wenn der Nutzer dazu auffordert; bis dahin greift
der deutsche Default.
