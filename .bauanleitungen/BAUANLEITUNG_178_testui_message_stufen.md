# BAUANLEITUNG 178 — testUI: Nachrichten-Stufen (ok/info/warn/caution/error)

**Ziel:** Im testUI-Framework die existierende `explain.paragraphs`-
Konfiguration um fünf semantische Dringlichkeits-Stufen erweitern:
`ok | info | warn | caution | error`. Beim Render werden die
Paragraphen automatisch sortiert: oben die Stufen-Hinweise absteigend
`error → caution → warn → info → ok`, darunter die Plain-Texte in
Config-Reihenfolge. Konkret im Frequenzabgleich wird der
Referenzseiten-Hinweis (heute `kind: 'warn'`, gelb) auf
`kind: 'caution'` (orange) umgestellt, weil er kritischer ist als
die Lautstärke/Balance-Vorbedingungen.

Die API bleibt deklarativ: Module deklarieren in der `explain`-Config,
welche Paragraphen welche Stufe haben. Die Render-Funktion sortiert
zentral. Module ändern Texte und Sichtbarkeit weiterhin per direktem
DOM-Zugriff auf die per `id` adressierten Elemente (kein dynamischer
Stufen-Wechsel zur Laufzeit nötig).

Geltungsbereich: das gesamte testUI-Framework (alle Verfahren, nicht
nur Frequenzabgleich). Sonstige Testmodule (Elektrodenlautstärke,
Stereo-Balance, Latenz, Seitenhörtest) bleiben in ihrer Funktion
unverändert — sie übernehmen die neuen Stufen, sobald sie ihre
`explain`-Configs anpassen.

**Versionsbump:** `js/version.js` → `"3.1.178-beta"`.

---

## Schritt 0 — Versionsbump

Datei `js/version.js`:

```js
const APP_VERSION = "3.1.177-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.1.178-beta";
```

(Voraussetzung: BA 177 wurde bereits gebaut. Falls noch nicht,
ist die Vorgängernummer die jeweils aktuelle.)

---

## Schritt 1 — CSS für die fünf Stufen

Datei `style.css`. Direkt nach den existierenden Klassen
`.explain-warn` und `.explain-plain` (etwa Zeile 591) die fünf
neuen Stufen ergänzen:

```css
/* BA 178: Message-Stufen für testUI-Hinweise.
   Sortierung der Reihenfolge passiert in test-ui.js. */
.explain-error {
  border-left-color: var(--danger);
  background: #fdecea;
}
.explain-caution {
  border-left-color: var(--warning);
  background: #fdf3e5;
}
.explain-info {
  border-left-color: var(--accent);
  background: #e8f0fe;
}
.explain-ok {
  border-left-color: var(--success);
  background: #e6f4ea;
}
```

Die Basis-Eigenschaften (margin, padding, border-radius, border-left
3px, white-space) kommen aus der `.explain`-Regel (Zeilen 573–581).
Die neuen Klassen werden **zusätzlich** zu `.explain` gesetzt, das
heißt: nur `border-left-color` und `background` müssen pro Stufe
definiert werden.

`.explain-warn` (Zeile 582–584) bleibt bestehen und entspricht
optisch der gelben Warn-Stufe. Optional: für visuelle Konsistenz
mit den neuen Stufen auch ein leichter Hintergrund:

```css
.explain-warn {
  border-left-color: var(--warning);
  background: #fef7e0;
}
```

(Beachten: die alte Definition nutzte `var(--warning)` für
border-left-color — sie kann bleiben, der Background ist neu.)

**Sonnet-Auftrag:** Vor dem Edit prüfen, ob `.explain-warn` bereits
einen Hintergrund hat. Wenn ja: vorhandenen Wert beibehalten und
nicht überschreiben. In der Antwort beide Stände nennen.

## Schritt 2 — Sortier-Logik in `test-ui.js`

Datei `js/test-ui.js`. Es gibt **zwei** Render-Stellen für
`explain.paragraphs`, die parallel angepaßt werden müssen:

- alte `buildTestPanel`-Funktion: Zeilen 81–89
- neue `buildTestUI`-Funktion: Zeilen 691–699

Beide Stellen sehen heute strukturell so aus:

```js
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    if (p.key) el.dataset.t = p.key;
    if (p.id)  el.id = p.id;
    explainBox.appendChild(el);
  });
```

Bzw. mit `_tEl` statt `el.dataset.t` in der neuen Variante:

```js
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    explainBox.appendChild(el);
  });
```

Beide ersetzen durch ein Sortier-Pattern. Statt direkt anzuhängen,
zuerst zwei Buckets bauen, dann sortieren und anhängen.

**Neue Variante für `buildTestPanel` (Zeilen 81–89):**

```js
  // BA 178: Sortierung — oben Stufen-Block (error→caution→warn→info→ok),
  // unten Plain-Texte in Config-Reihenfolge.
  var _kindOrder = { error: 0, caution: 1, warn: 2, info: 3, ok: 4 };
  var _stagedHints = [];
  var _stagedPlain = [];
  (cfg.explain.paragraphs || []).forEach(function(p, configIdx) {
    var kind = p.kind || 'plain';
    var cls;
    if (kind === 'plain') {
      cls = 'explain-plain';
    } else if (kind === 'warn' || kind === 'caution' || kind === 'error'
               || kind === 'info' || kind === 'ok') {
      cls = 'explain explain-' + kind;
    } else {
      // unbekannter kind → wie plain behandeln, nicht crashen
      cls = 'explain-plain';
      kind = 'plain';
    }
    var el = _mkEl('p', cls);
    if (p.key) el.dataset.t = p.key;
    if (p.id)  el.id = p.id;
    if (kind === 'plain') {
      _stagedPlain.push({ el: el, configIdx: configIdx });
    } else {
      _stagedHints.push({ el: el, kind: kind, configIdx: configIdx });
    }
  });
  _stagedHints.sort(function(a, b) {
    var ka = _kindOrder[a.kind], kb = _kindOrder[b.kind];
    if (ka !== kb) return ka - kb;
    return a.configIdx - b.configIdx;
  });
  _stagedHints.forEach(function(h) { explainBox.appendChild(h.el); });
  _stagedPlain.forEach(function(p) { explainBox.appendChild(p.el); });
```

**Neue Variante für `buildTestUI` (Zeilen 691–699):**

Identisch wie oben, nur `el.dataset.t = p.key` ersetzen durch
`_tEl(el, p.key)`:

```js
  // BA 178: Sortierung — oben Stufen-Block (error→caution→warn→info→ok),
  // unten Plain-Texte in Config-Reihenfolge.
  var _kindOrder = { error: 0, caution: 1, warn: 2, info: 3, ok: 4 };
  var _stagedHints = [];
  var _stagedPlain = [];
  (cfg.explain.paragraphs || []).forEach(function(p, configIdx) {
    var kind = p.kind || 'plain';
    var cls;
    if (kind === 'plain') {
      cls = 'explain-plain';
    } else if (kind === 'warn' || kind === 'caution' || kind === 'error'
               || kind === 'info' || kind === 'ok') {
      cls = 'explain explain-' + kind;
    } else {
      cls = 'explain-plain';
      kind = 'plain';
    }
    var el = _mkEl('p', cls);
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    if (kind === 'plain') {
      _stagedPlain.push({ el: el, configIdx: configIdx });
    } else {
      _stagedHints.push({ el: el, kind: kind, configIdx: configIdx });
    }
  });
  _stagedHints.sort(function(a, b) {
    var ka = _kindOrder[a.kind], kb = _kindOrder[b.kind];
    if (ka !== kb) return ka - kb;
    return a.configIdx - b.configIdx;
  });
  _stagedHints.forEach(function(h) { explainBox.appendChild(h.el); });
  _stagedPlain.forEach(function(p) { explainBox.appendChild(p.el); });
```

**Hinweis zur Rückwärtskompatibilität:** Die alte `kind: 'warn'`-
Variante wird weiter als gelb-warnend gerendert (Klasse
`explain explain-warn`). Bestehende Verfahren-Configs müssen nicht
umgestellt werden, solange `warn` weiterhin die richtige Stufe für
sie ist. Wer auf `info` / `caution` / `error` / `ok` umstellen
möchte, kann das pro Paragraph in seiner Config tun.

## Schritt 3 — Frequenzabgleich: `fmHintWarn` auf `caution` umstellen

Datei `js/freqmatch.js`. In der `explain.paragraphs`-Config
(Zeilen 990–995):

```js
      paragraphs: [
        { key: 'fmHintMethod',   kind: 'plain', id: 'fmHintMethodPara'   },
        {                        kind: 'warn',  id: 'fmPrereqLvHintPara' },
        {                        kind: 'warn',  id: 'fmPrereqSbHintPara' },
        { key: 'fmHintWarn',    kind: 'warn',  id: 'fmHintWarnPara'     },
        { key: 'fmHintWorkflow', kind: 'plain' }
      ]
```

ersetzen durch (nur `fmHintWarn` wechselt auf `caution`):

```js
      paragraphs: [
        { key: 'fmHintMethod',    kind: 'plain',   id: 'fmHintMethodPara'   },
        {                         kind: 'warn',    id: 'fmPrereqLvHintPara' },
        {                         kind: 'warn',    id: 'fmPrereqSbHintPara' },
        { key: 'fmHintWarn',      kind: 'caution', id: 'fmHintWarnPara'     },
        { key: 'fmHintWorkflow',  kind: 'plain' }
      ]
```

Die Config-Reihenfolge ist nun egal — der Render in `test-ui.js`
sortiert nach Stufen. Aber die alte Reihenfolge zu erhalten erleichtert
das Diff-Review.

Erwartetes DOM-Ergebnis im Frequenzabgleich-Reiter (von oben nach unten):

1. `fmHintWarnPara` (caution / orange)
2. `fmPrereqLvHintPara` (warn / gelb)
3. `fmPrereqSbHintPara` (warn / gelb)
4. `fmHintMethodPara` (plain)
5. `fmHintWorkflow` (plain)

## Schritt 4 — Sichtbarkeits-Logik unverändert lassen

Die Funktionen `_fmRenderIntroText` und `_fmRenderPrereqHints` in
`js/freqmatch.js` (Zeilen 818–869) setzen weiterhin `textContent` /
`innerHTML` und `style.display = '' | 'none'` per `getElementById`.
**Diese Logik bleibt unverändert.** Die Sortierung hat den DOM-
Element-Reihenfolge fest gemacht; Display-Sichtbarkeit ist davon
unabhängig.

---

## Schritt 5 — Druck-Verhalten

Keine Änderung am Druck. Die `explain-box` ist Teil des Test-Panels
und wird vom Audiologen-Druck (`audiologPrint` in `js/print-md.js`)
nicht eingeschlossen — das Verhalten bleibt wie heute.

---

## Schritt 6 — i18n unverändert

Diese BA fügt keine neuen i18n-Keys ein. Die bestehenden Keys
`fmHintWarn`, `fmHintWarnBothCI`, `fmPrereqLvBoth`, `fmPrereqLvLeft`,
`fmPrereqLvRight`, `fmPrereqSb` etc. bleiben in Wortlaut und
Bedeutung gleich. Sie wechseln nur ihre visuelle Stufen-Zuordnung
durch die Config-Änderung.

`i18n/de.js`, `en.js`, `fr.js`, `es.js` werden in dieser BA **nicht**
angefaßt.

---

## Schritt 7 — Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen, melden:
**erfüllt / nicht erfüllt / unklar**, mit konkretem Bezug.

1. `js/version.js` zeigt `"3.1.178-beta"`.
2. `style.css` enthält die vier neuen Klassen `.explain-error`,
   `.explain-caution`, `.explain-info`, `.explain-ok` mit jeweils
   `border-left-color` und `background`. `.explain-warn` bleibt
   bestehen (mit oder ohne neuem Background — Befund melden).
3. `js/test-ui.js` enthält **an beiden** Render-Stellen
   (Zeilen ~81 und ~691) die neue Sortier-Logik. Variable
   `_kindOrder` ist `{error:0, caution:1, warn:2, info:3, ok:4}`.
4. Bei unbekanntem `kind` (Tippfehler in einer Config) fällt der
   Render nicht aus — Element wird als plain behandelt. Browser
   bleibt fehlerfrei.
5. `js/freqmatch.js` Config zeigt `fmHintWarn` mit `kind: 'caution'`.
   Andere Paragraphen unverändert.
6. `_fmRenderIntroText` und `_fmRenderPrereqHints` sind nicht
   angefaßt — sie greifen weiter per `getElementById` auf die
   Paragraphen zu.
7. Klammer-Balance und Anführungszeichen-Hygiene aller geänderten
   Dateien geprüft.
8. Browser-Test: Tool lädt ohne `SyntaxError`. Reiter Messungen
   → Sub-Reiter Frequenzabgleich öffnet ohne Konsolen-Fehler.
9. Andere Verfahren (Reiter Messungen → Elektrodenlautstärke,
   Stereo-Balance, Latenz) öffnen ohne Konsolen-Fehler — ihr
   `explain`-Block bleibt visuell unverändert, weil ihre Configs
   nicht geändert wurden.

Bei einem Punkt unklar: **stoppen, melden, Rückfrage**.

---

## Schritt 8 — Akzeptanz-Checkliste für den Nutzer

1. **Frischer Browser-Tab.** Tool lädt ohne Konsolen-Fehler.
   Versions-Label rechts oben zeigt `v3.1.178-beta`.
2. **Hörsituation setzen:** LINKS Normalhörend, RECHTS CI MED-EL
   (eine Konstellation, in der `fmHintWarn` aktiv ist).
3. **Reiter Messungen → Sub-Reiter Frequenzabgleich.** Erwartet
   in der Erklärungs-Box von oben nach unten:
   1. **Oranger Block** (caution): „Achten Sie darauf, die richtige
      Referenzseite auszuwählen: die mit natürlichem Gehör."
   2. **Gelber Block** (warn): „Führen Sie zuerst die Messung
      Elektrodenlautstärke ..." (falls fehlt).
   3. **Gelber Block** (warn): „Führen Sie zuerst die Messung
      Stereo-Balance aus." (falls fehlt).
   4. **Plain-Text** (klein, grau): Methode-Text
      (`fmHintMethodCiNatural`).
   5. **Plain-Text** (klein, grau): Workflow-Text (`fmHintWorkflow`).
4. **Vorbedingungen erfüllen.** Reiter Messungen →
   Elektrodenlautstärke beidseitig durchführen, Stereo-Balance
   durchführen. Zurück zum Frequenzabgleich. Die beiden gelben
   `warn`-Blöcke verschwinden. Der orange `caution`-Block bleibt
   stehen. Plain-Texte unverändert darunter.
5. **Symmetrische Konstellation.** Reset, Hörsituation LINKS CI /
   RECHTS CI. Reiter Frequenzabgleich öffnen. Der orange Block
   zeigt jetzt den anderen Wortlaut (`fmHintWarnBothCI`); Position
   bleibt oben (caution).
6. **Andere Verfahren prüfen.** Sub-Reiter Elektrodenlautstärke,
   Stereo-Balance, Latenz öffnen — der Erklärungs-Block sieht
   aus wie vorher, keine Layout-Brüche.

---

## Schritt 9 — Folge-Themen (nicht in dieser BA)

- **Dynamischer Stufen-Wechsel zur Laufzeit** (z.B. ein Hinweis
  wird grün, wenn die Vorbedingung erfüllt ist, statt zu
  verschwinden): aktuell nicht gebraucht. Wenn später nötig,
  in eigener BA über eine kleine `testUI.messages.setKind(el, kind)`-
  Hilfsfunktion ergänzen.
- **Andere Verfahren auf die neuen Stufen umstellen** (z.B.
  Stereo-Balance, Latenz): pro Verfahren in der jeweiligen
  Config — kann in einer Folge-BA gebündelt werden, wenn der
  Bedarf entsteht.

---

## Schlußbemerkung

Diese BA ist überschaubar in Größe und Risiko. Bestehende Configs
funktionieren weiter unverändert (`warn` und `plain` bleiben gültig).
Der einzige funktionale Wechsel passiert im Frequenzabgleich, wo
`fmHintWarn` von gelb auf orange wandert und durch die Sortierung
oberhalb der gelben Vorbedingungs-Hinweise landet.

Bei Unklarheiten — insbesondere zur bestehenden `.explain-warn`-
CSS-Regel und zu eventuell schon vorhandenem Background — Befund
melden und nicht stillschweigend ersetzen.
