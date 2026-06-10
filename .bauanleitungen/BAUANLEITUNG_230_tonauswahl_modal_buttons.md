# BA 230 — Tonauswahl-Modal: Buttons statt Radiobuttons, Klavier-Bug, Sanduhr

Ziel: Den Modal-Dialog „Tonart wählen" (Reiter Messungen → Frequenzabgleich
→ Tonart-Button) aufräumen. Heute liegen pro Eintrag Radiobutton, Label,
Beschreibungstext, Sanduhr und Vorspiel-Button in einem 4-Spalten-Grid.
Das ist bei 33+ Mellotron-Einträgen unübersichtlich geworden. Nach der
Umstellung ist jeder Eintrag ein eigener Button, die Gruppen-Buttons
liegen in einer Wrap-Zeile, Beschreibungen werden zu Tooltips, die
Vorspiel-Buttons verschwinden — angeklickter Tonbutton spielt selbst
vor.

Außerdem wird der Bug behoben, daß das Klavier in der Modalbox stets
mit der initialen Tonart spielt statt mit der aktuell angeklickten:
das Klavier liest seinen Ton bisher aus `cfg.getToneType()`, das aber
erst beim OK-Klick aktualisiert wird.

Mellotron-Bezeichnungen werden in dieser BA **nicht** angefaßt — die
übernimmt BA 231. Hier bleiben die heutigen Token-Strings (`TRON CELLO`
etc.) im Fallback-Label sichtbar.

---

## 0. Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.230-beta";
```

---

## 1. tone-popup.js — Item-Render von Grid auf Button-Zeile umstellen

Datei: `js/tone-popup.js`

### 1.1 GROUPS-Konstante bleibt unverändert

Die `GROUPS`-Konstante (Z. 44–134) bleibt 1:1 wie sie ist — Triples
`[key, i18nKey, descKey]`. Mellotron-Einträge bleiben mit `null, null`.

### 1.2 Render-Schleife komplett ersetzen

Die heutige Render-Schleife (Z. 187–293, `GROUPS.forEach(...)`) wird
durch folgende Variante ersetzt. Die Render-Schleife endet vor dem
Block `// BA 226: Sanduhr ein-/ausblenden ...` (Z. 295) — alle Helfer
darunter (`_setHourglassFor`, `_playPreview`, `_setPlayButtonsDisabled`)
bleiben erhalten, werden aber unten in Schritt 2 angepaßt.

Vorher (vereinfacht):

```js
GROUPS.forEach(function(grp) {
  var section = document.createElement('section');
  // ... h4, subhint ...
  var list = document.createElement('div');
  list.style.cssText =
    'display:grid;grid-template-columns:auto 1fr auto auto;' +
    'gap:4px 10px;align-items:center;';

  grp.items.forEach(function(triple) {
    var key = triple[0], i18nKey = triple[1], descKey = triple[2];
    var rb = document.createElement('input');
    rb.type = 'radio';
    // ... rb-config ...
    var lblBlock = document.createElement('label');
    // ... lblBlock mit nameLine + descSpan ...
    var play = document.createElement('button');
    // ... play-config + click-handler ...
    var hgSpan = document.createElement('span');
    // ... sanduhr ...
    rb.addEventListener('change', function() { ... });
    play.addEventListener('click', function() { ... });
    list.append(rb, lblBlock, hgSpan, play);
  });

  section.appendChild(list);
  dlg.appendChild(section);
});
```

Nachher:

```js
GROUPS.forEach(function(grp) {
  var section = document.createElement('section');
  section.style.cssText = 'margin-bottom:14px;';

  var h4 = document.createElement('h4');
  h4.dataset.t = grp.headKey;
  h4.style.cssText =
    'margin:0 0 2px 0;font-size:.98em;font-weight:600;' +
    'color:var(--fg,#000);';
  section.appendChild(h4);

  var subhint = document.createElement('div');
  subhint.dataset.t = grp.hintKey;
  subhint.style.cssText =
    'margin:0 0 8px 0;font-size:.85em;color:#666;font-style:italic;';
  section.appendChild(subhint);

  // BA 230: Buttons-Reihe mit dynamischem Zeilenumbruch.
  var list = document.createElement('div');
  list.className = 'tone-btn-row';

  grp.items.forEach(function(triple) {
    var key = triple[0], i18nKey = triple[1], descKey = triple[2];

    // Wrapper, damit Sanduhr direkt neben dem Button steht und mitwandert.
    var itemWrap = document.createElement('span');
    itemWrap.className = 'tone-item';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tone-btn' + (key === initial ? ' tone-btn--active' : '');
    btn.dataset.toneKey = key;
    if (i18nKey) {
      btn.dataset.t = i18nKey;
    } else {
      // Fallback fuer Eintraege ohne i18n-Key (z. B. Mellotron-Varianten):
      // letzten Token-Teil als Label anzeigen.
      var lastColon = key.lastIndexOf(':');
      btn.textContent = lastColon >= 0 ? key.substring(lastColon + 1) : key;
    }
    if (descKey) {
      // Beschreibung als Tooltip. data-t-title triggert applyLang
      // (siehe Schritt 3); Sprachwechsel im offenen Modal wird so
      // mitgenommen.
      btn.dataset.tTitle = descKey;
    }

    // Sanduhr-Span: weiterhin per data-tone-key adressierbar
    // (_setHourglassFor selektiert darueber).
    var hgSpan = document.createElement('span');
    hgSpan.className = 'btn-hourglass';
    hgSpan.dataset.toneKey = key;
    hgSpan.style.cssText =
      'visibility:hidden;font-size:1.4em;line-height:1;'
      + 'color:#d8a200;margin-left:2px;display:inline-block;'
      + 'width:1.1em;text-align:center;vertical-align:middle;';
    hgSpan.textContent = '⧖';   // Sanduhr-Symbol, ASCII-sicher

    btn.addEventListener('click', function() {
      if (playing) return;
      // Hervorhebung umsetzen
      var prev = dlg.querySelectorAll('.tone-btn--active');
      prev.forEach(function(b) { b.classList.remove('tone-btn--active'); });
      btn.classList.add('tone-btn--active');
      selected = key;
      // Klavier-Highlight: aktueller toneType ist jetzt 'selected'.
      // (Das Klavier liest dies live ueber getCurrentToneType, siehe
      // Schritt 4.)
      // Auto-Vorspiel der Burst-Sequenz (analog frueherem play-Button).
      _playPreview(key);
    });

    itemWrap.append(btn, hgSpan);
    list.appendChild(itemWrap);
  });

  section.appendChild(list);
  dlg.appendChild(section);
});
```

Wichtig:
- Sanduhr-Span behält Klasse `btn-hourglass` und `data-tone-key`, damit
  `_setHourglassFor` weiter funktioniert.
- Initial-Auswahl erhält `tone-btn--active` direkt beim Render.
- Sanduhr-Symbol als Unicode-Escape `⧖` schreiben, damit das
  Snippet ASCII-sauber bleibt (die heutige Quelle nutzt das Glyph
  direkt — geht beides, aber das Escape ist robuster bei Copy-Paste).

---

## 2. tone-popup.js — Helfer anpassen

### 2.1 `_playPreview` — kleine Anpassung

Die Funktion `_playPreview` bleibt strukturell unverändert. Zwei Punkte:

- Der disabled-Helfer schaltet jetzt die Auswahl-Buttons aus statt der
  Vorspiel-Buttons (siehe 2.2).
- Das initial-Sanduhr-Handling am Anfang von `_playPreview` (smplr nicht
  ready) bleibt wie es ist — es nutzt schon `_setHourglassFor(toneType, true)`
  und ruft sich nach Laden rekursiv erneut. Funktioniert weiter, weil die
  Sanduhr-Spans im DOM noch existieren (jetzt im itemWrap).

### 2.2 `_setPlayButtonsDisabled` umbenennen und umbauen

Heute selektiert die Funktion `button[data-tone-key]` — das sind heute
die play-Knöpfe. Nach Schritt 1 haben die Tonbuttons `data-tone-key`,
und die play-Knöpfe gibt es nicht mehr. Der Selektor passt also weiter,
aber der Name ist irreführend. Umbenennen:

Vorher (Z. 374–377):

```js
function _setPlayButtonsDisabled(flag) {
  var btns = dlg.querySelectorAll('button[data-tone-key]');
  btns.forEach(function(b) { b.disabled = flag; });
}
```

Nachher:

```js
function _setToneButtonsDisabled(flag) {
  var btns = dlg.querySelectorAll('button.tone-btn');
  btns.forEach(function(b) { b.disabled = flag; });
}
```

Alle Aufrufer in `_playPreview` (vier Stellen: Z. 325, 329, 339, 347,
353) entsprechend von `_setPlayButtonsDisabled` auf `_setToneButtonsDisabled`
umstellen.

### 2.3 `_setHourglassFor` — unverändert

Bleibt wie es ist (Z. 298–307). Selektiert weiter `span.btn-hourglass[data-tone-key=...]`.
Die Spans liegen jetzt im itemWrap statt im Grid, das ist für den
Selektor irrelevant.

### 2.4 Alten Radio-`change`-Handler ersatzlos entfernen

Die `rb.addEventListener('change', ...)`-Logik (Z. 264–282), die heute
beim Auswahlwechsel den smplr-Hintergrund-Lade-Trigger startet, ist
nicht mehr nötig: Auto-Vorspiel ruft jetzt `_playPreview(key)` direkt
auf, und `_playPreview` triggert die Lade-Logik selbst (Z. 318–344 im
heutigen Code).

---

## 3. i18n.js — `data-t-title` unterstützen

Datei: `js/i18n.js`, Funktion `applyLang` (Z. 33–46).

Nach dem `data-t-placeholder`-Block einen Block für `data-t-title`
ergänzen:

```js
document.querySelectorAll('[data-t-title]').forEach((el) => {
  const k = el.getAttribute('data-t-title');
  if (k && t(k)) el.setAttribute('title', t(k));
});
```

So bekommen Buttons im Modal beim Sprachwechsel ihren Tooltip live
nachgezogen. Der Aufruf `applyLang()` am Ende der Modal-Erzeugung
(Z. 394 im heutigen Code) reicht dann auch, um Tooltips initial zu
setzen.

---

## 4. tone-popup.js — Klavier-Bug fixen

Datei: `js/tone-popup.js`, Block `renderSamplerKeyboard`-Aufruf
(Z. 170–185).

Heute:

```js
if (cfg.keyboardMode
    && typeof renderSamplerKeyboard === 'function'
    && typeof cfg.getElectrodeFreqs === 'function') {
  var kbWrap = document.createElement('div');
  dlg.appendChild(kbWrap);
  try {
    renderSamplerKeyboard(kbWrap, {
      getElectrodeFreqs:   cfg.getElectrodeFreqs,
      getElectrodeLabels:  cfg.getElectrodeLabels,
      getCurrentToneType:  cfg.getToneType,   // <-- Bug-Quelle
      onPress:             cfg.onPress,
      onRelease:           cfg.onRelease,
      getHighlightMs:      cfg.getHighlightMs
    });
  } catch (e) { /* swallow */ }
}
```

Neu:

```js
if (cfg.keyboardMode
    && typeof renderSamplerKeyboard === 'function'
    && typeof cfg.getElectrodeFreqs === 'function') {
  var kbWrap = document.createElement('div');
  dlg.appendChild(kbWrap);
  try {
    renderSamplerKeyboard(kbWrap, {
      getElectrodeFreqs:   cfg.getElectrodeFreqs,
      getElectrodeLabels:  cfg.getElectrodeLabels,
      // BA 230: Klavier liest die aktuell im Modal angeklickte Tonart
      // (lokales 'selected'), nicht den noch-nicht-uebernommenen Wert
      // aus cfg.getToneType. Damit spielt das Klavier beim Tippen
      // gleich mit der neu gewaehlten Tonart, nicht erst nach OK.
      getCurrentToneType:  function() { return selected; },
      onPress:             cfg.onPress,
      onRelease:           cfg.onRelease,
      getHighlightMs:      cfg.getHighlightMs
    });
  } catch (e) { /* swallow */ }
}
```

`selected` ist eine Closure-Variable, die direkt darunter in Z. 137
deklariert wird (`var selected = initial;`) und im Tonbutton-Click-Handler
(siehe Schritt 1) auf den neu gewählten Wert gesetzt wird. Bei Cancel
wird `cfg.setToneType` nicht gerufen, das Modal schließt sich, der
globale Zustand bleibt unverändert. `selected` lebt nur in der Closure
und ist nach `close()` weg — also gibt es kein State-Leak.

Beim Cancel-Klick bleibt aber der vom Klavier zwischendurch hörbar
gemachte Lade-Trigger für smplr-Tonarten in Kraft — Sampler werden ggf.
geladen und verbleiben im Speicher. Das ist hinnehmbar und entspricht
dem heutigen Verhalten beim Vorspiel-Klick.

---

## 5. style.css — Button-Styling

Datei: `style.css`. Block am Dateiende einfügen:

```css
/* BA 230: Tonauswahl-Modal — Button-Variante statt Radiobuttons */
.tone-btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
}
.tone-item {
  display: inline-flex;
  align-items: center;
}
.tone-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  font-family: var(--font);
  font-size: 0.9em;
  line-height: 1.25;
  min-height: 30px;
  transition: all 0.15s;
}
.tone-btn:hover {
  background: var(--accent-light);
  border-color: var(--accent);
}
.tone-btn--active {
  background: var(--accent-light);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.tone-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
```

Hintergrund ist der `.pbtn.active`-Stil aus dem Player-Reiter
(style.css:198–201): `--accent-light` als Füllung, `--accent` als Rand.
Im aktiven Zustand zusätzlich blaue Textfarbe + Fettung, damit auch in
hellen/dunklen Themes der angewählte Eintrag klar lesbar ist.

---

## 6. CODESTRUKTUR aktualisieren

Datei: `docs/CODESTRUKTUR.md`.

Im Eintrag zu `js/tone-popup.js` einen kurzen Absatz mit
„**Seit BA 230**: …" ergänzen, der die Umstellung beschreibt:
Auswahl-Buttons statt Radiobuttons, Tooltip-Beschreibung statt
Inline-Text, Vorspiel-Buttons ersatzlos entfernt (Auswahl-Klick spielt
selbst vor), Klavier liest den im Modal aktuell ausgewählten Ton
(`selected`-Closure) statt der noch nicht übernommenen `cfg.getToneType`.

Im Eintrag zu `js/i18n.js` einen Halbsatz nachziehen: `applyLang`
unterstützt zusätzlich `data-t-title` (setzt `title`-Attribut).

---

## 7. Was sich NICHT ändert

- `i18n/de.js`, `en.js`, `fr.js`, `es.js` werden in BA 230 nicht
  angefaßt. Die heutigen Keys `tonePopupTitle`, `tonePopupHint`,
  `tonePopupOk`, `tonePopupCancel`, `toneGroup*`, `toneSine*` etc.
  bleiben unverändert. `tonePopupPlay` wird jetzt nicht mehr gerendert
  — der Key bleibt in den i18n-Dateien stehen, das stört nicht.
- `sampler-keyboard.js` bleibt unverändert.
- `freqmatch.js` bleibt unverändert. `tonePopupButton.getToneType`
  liefert weiter `toneType_freqmatch`, das nur beim OK aktualisiert
  wird — das ist gewollt.

---

## 8. Akzeptanztest (Klick-für-Klick)

Vor der Fertig-Meldung im Browser durchgehen.

1. Tab **Messungen** → Sub-Reiter **Frequenzabgleich** öffnen.
2. Auf den Tonart-Button im Header (zeigt aktuelle Tonart) klicken.
   → Modal „Tonart wählen" öffnet sich. Erwartet: Klavier oben (wie in
   BA 228), darunter pro Gruppe eine Überschrift und eine Reihe von
   Buttons in einer Wrap-Zeile. Keine Radiobuttons, keine Vorspiel-
   Buttons, keine Beschreibungstexte unter den Item-Namen.
3. Aktuell ausgewählte Tonart ist farblich hervorgehoben (hellblauer
   Hintergrund, blauer Rand, blaue+fette Beschriftung).
4. Mauszeiger länger als ~1 s über einen Tonbutton schweben (Desktop).
   → Tooltip mit deutscher Beschreibung erscheint (z. B. bei „Sinus"
   → „Reine, einzelne Frequenz."). Bei Mellotron-Buttons ist kein
   Tooltip vorhanden — das ist OK in BA 230 (BA 231 ergänzt Beschreibungen
   bei Bedarf).
5. Auf einen anderen Tonbutton klicken, z. B. „Komplexton" im Block
   Komplextöne.
   → Der neue Button wird hervorgehoben, der vorherige verliert die
   Hervorhebung. Die Burst-Sequenz wird hörbar abgespielt (links — Pause —
   rechts oder analog). Während der Sequenz sind alle Tonbuttons
   disabled.
6. Nach Sequenz-Ende erneut auf einen Mellotron-Button klicken, der
   noch nicht geladen ist (z. B. `TRON CELLO`).
   → Sanduhr-Symbol wird rechts neben dem angeklickten Button sichtbar.
   Klavier zeigt „Lädt …" als Hinweistext. Nach Abschluß: Sanduhr
   verschwindet, Sequenz spielt automatisch.
7. **Klavier-Bug-Test:** Im Modal bei laufender Frequenzabgleich-Session
   (vorher Start im Frequenzabgleich gedrückt) eine **andere** Tonart
   anklicken, z. B. von „Sinus" auf einen Mellotron-Eintrag (geladen).
   Dann **eine Klaviertaste** über dem Klavier-Widget anschlagen.
   → Erwartet: Anschlag spielt mit der neu angeklickten Tonart (vorher
   hat das Klavier weiterhin Sinus gespielt — das ist der Bug-Fix).
8. OK drücken. → Modal schließt, Tonart wird übernommen, der Tonart-
   Button im Header zeigt das neue Label.
9. Modal erneut öffnen, einen anderen Tonbutton anklicken, dann
   **Abbrechen** drücken. → Modal schließt, Tonart-Button-Label im
   Header bleibt auf dem zuvor übernommenen Wert (kein Live-Übernehmen).
10. Sprachwechsel-Test: Bei offenem Modal die Sprache umstellen.
    → Hover-Tooltips zeigen Beschreibungen in der neuen Sprache.

---

## 9. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen und
für jeden Punkt melden: **erfüllt / nicht erfüllt / unklar**, jeweils
mit Datei- und Zeilenangabe der relevanten Stelle.

Besonders prüfen:
- `tone-popup.js`: Selektor `button.tone-btn` in `_setToneButtonsDisabled`
  trifft tatsächlich genau die Auswahl-Buttons. (Wenn ein anderer Knopf
  im Modal die Klasse trägt, ergänzen.)
- `tone-popup.js`: `selected` ist im Klavier-Callback erreichbar
  (Closure-Position relativ zur `var selected`-Deklaration).
- `i18n.js`: Der neue `data-t-title`-Block setzt `title` über
  `el.setAttribute('title', t(k))` (nicht `dataset.title`).
- `style.css`: Die Variablen `--accent-light`, `--accent`, `--border`,
  `--surface`, `--font` existieren im :root-Block (style.css Z. 1ff
  zeigt `--accent`, `--accent-light`).

---

## 10. Hinweis auf Folge-BA

BA 231 wird die Mellotron-Bezeichnungen umstellen (deutsche/englische/
französische/spanische Instrumentnamen + Modell-Tag in Klammern, 5
Untergruppen nach Mellotron-Modell). Diese BA hier läßt die Mellotron-
Liste bewußt unangetastet, damit die UI-Umstellung mit dem heutigen
Inhalt erst verifizierbar ist.
