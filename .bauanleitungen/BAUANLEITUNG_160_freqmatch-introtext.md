# BAUANLEITUNG 160 — Frequenzabgleich: Dynamischer Intro-Text

Ziel: Den Intro-Text des Frequenzabgleich-Messtabs durch zwei
kontextabhängige Textvarianten ersetzen (CI+Naturgehör vs. beide CI)
und zwei dynamische Voraussetzungs-Hinweise (Elektrodenlautstärke
seitenspezifisch, Stereo-Balance als ja/nein) einbauen.

---

## Schritt 1 — Version hochzählen

`js/version.js`, Zeile 1:

```js
// ALT:
const APP_VERSION = "3.0.159-beta";

// NEU:
const APP_VERSION = "3.0.160-beta";
```

---

## Schritt 2 — test-ui.js: ID-Unterstützung für Paragraph-Config

In `js/test-ui.js` gibt es zwei nahezu identische Blöcke, die
`cfg.explain.paragraphs` durchlaufen. Beide müssen angepasst werden.

### Erster Block (~Zeile 81–88, innerhalb der ersten `buildTestPanel`-Funktion):

```js
// ALT:
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    el.dataset.t = p.key;
    explainBox.appendChild(el);
  });

// NEU:
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

### Zweiter Block (~Zeile 690–697, innerhalb der zweiten `buildTestPanel`-Variante):

```js
// ALT:
  (cfg.explain.paragraphs || []).forEach(function(p) {
    var cls;
    if (p.kind === 'plain') cls = 'explain-plain';
    else cls = 'explain' + (p.kind === 'warn' ? ' explain-warn' : '');
    var el = _mkEl('p', cls);
    _tEl(el, p.key);
    explainBox.appendChild(el);
  });

// NEU:
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

Begründung: Paragraphen ohne `key` sollen kein `data-t`-Attribut erhalten,
damit `applyLang()` sie nicht überschreibt. Paragraphen mit `id` erhalten
eine ID, über die `_fmRenderIntroText`/`_fmRenderPrereqHints` sie finden.

---

## Schritt 3 — freqmatch.js: Paragraph-Config erweitern

In `js/freqmatch.js`, DOMContentLoaded-Block (~Zeile 952–961),
`explain.paragraphs`-Array ersetzen:

```js
// ALT:
      paragraphs: [
        { key: 'fmHintMethod',   kind: 'plain' },
        { key: 'fmPrereqHint',  kind: 'warn'  },
        { key: 'fmHintWarn',    kind: 'warn'  },
        { key: 'fmHintWorkflow', kind: 'plain' }
      ]

// NEU:
      paragraphs: [
        { key: 'fmHintMethod',   kind: 'plain', id: 'fmHintMethodPara'   },
        {                        kind: 'warn',  id: 'fmPrereqLvHintPara' },
        {                        kind: 'warn',  id: 'fmPrereqSbHintPara' },
        { key: 'fmHintWarn',    kind: 'warn',  id: 'fmHintWarnPara'     },
        { key: 'fmHintWorkflow', kind: 'plain' }
      ]
```

Erläuterung:
- `fmHintMethodPara`: Haupttext, wird durch `_fmRenderIntroText` auf den
  richtigen Schlüssel (`fmHintMethodCiNatural` oder `fmHintMethodBothCI`)
  umgestellt.
- `fmPrereqLvHintPara`: Dynamischer Hinweis für fehlende
  Elektrodenlautstärke-Messung (seitenspezifisch), kein `key` →
  kein `data-t`, vollständig von `_fmRenderPrereqHints` verwaltet.
- `fmPrereqSbHintPara`: Dynamischer Hinweis für fehlende
  Stereo-Balance-Messung, kein `key`, vollständig dynamisch.
- `fmHintWarnPara`: Referenzseiten-Hinweis, ebenfalls durch
  `_fmRenderIntroText` auf den richtigen Schlüssel umgestellt.
- `fmHintWorkflow`: unverändert, kein `id` nötig.

---

## Schritt 4 — freqmatch.js: Zwei neue Render-Funktionen

Direkt nach der Funktion `_fmRenderBlockedWarning` (endet ~Zeile 837)
und vor `_fmRefreshTabState` (~Zeile 839) einfügen:

```js
function _fmRenderIntroText() {
  const methodEl = document.getElementById('fmHintMethodPara');
  const warnEl   = document.getElementById('fmHintWarnPara');
  if (!methodEl && !warnEl) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const bothCI = (leftCfg === 'ci') && (rightCfg === 'ci');
  if (methodEl) {
    const key = bothCI ? 'fmHintMethodBothCI' : 'fmHintMethodCiNatural';
    methodEl.dataset.t = key;
    const v = (typeof t === 'function') ? t(key) : '';
    if (v.includes('<')) methodEl.innerHTML = v; else methodEl.textContent = v;
  }
  if (warnEl) {
    const key = bothCI ? 'fmHintWarnBothCI' : 'fmHintWarn';
    warnEl.dataset.t = key;
    const v = (typeof t === 'function') ? t(key) : '';
    if (v.includes('<')) warnEl.innerHTML = v; else warnEl.textContent = v;
  }
}

function _fmRenderPrereqHints() {
  const lvEl = document.getElementById('fmPrereqLvHintPara');
  const sbEl = document.getElementById('fmPrereqSbHintPara');
  if (!lvEl && !sbEl) return;
  if (lvEl) {
    const leftHasLv  = (sideData.left.bRes  && sideData.left.bRes.length  > 0)
                    || (sideData.left.jRes  && sideData.left.jRes.length  > 0);
    const rightHasLv = (sideData.right.bRes && sideData.right.bRes.length > 0)
                    || (sideData.right.jRes && sideData.right.jRes.length > 0);
    if (!leftHasLv || !rightHasLv) {
      let key;
      if (!leftHasLv && !rightHasLv) key = 'fmPrereqLvBoth';
      else if (!leftHasLv)           key = 'fmPrereqLvLeft';
      else                           key = 'fmPrereqLvRight';
      lvEl.textContent = (typeof t === 'function') ? t(key) : key;
      lvEl.style.display = '';
    } else {
      lvEl.style.display = 'none';
    }
  }
  if (sbEl) {
    const hasSb = typeof lrResults !== 'undefined'
               && lrResults
               && Object.keys(lrResults).length > 0;
    if (!hasSb) {
      sbEl.textContent = (typeof t === 'function') ? t('fmPrereqSb') : 'fmPrereqSb';
      sbEl.style.display = '';
    } else {
      sbEl.style.display = 'none';
    }
  }
}
```

---

## Schritt 5 — freqmatch.js: fmApplyLang und _fmRefreshTabState erweitern

### fmApplyLang (~Zeile 739–747):

```js
// ALT:
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  _fmRenderCochlearFatHint();
}

// NEU:
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  _fmRenderCochlearFatHint();
  _fmRenderIntroText();
  _fmRenderPrereqHints();
}
```

### _fmRefreshTabState (~Zeile 839–849):

```js
// ALT:
function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  if (typeof _fmRenderCochlearFatHint === 'function') _fmRenderCochlearFatHint();
}

// NEU:
function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  if (typeof _fmRenderCochlearFatHint === 'function') _fmRenderCochlearFatHint();
  _fmRenderIntroText();
  _fmRenderPrereqHints();
}
```

---

## Schritt 6 — i18n/de.js: Neue Strings einfügen

In `i18n/de.js` die bestehende Zeile:

```js
    fmHintWarn:
      "Achten Sie darauf, die richtige Referenzseite auszuwählen: die mit natürlichem Gehör.",
    fmHintMethod:
      "Dieser Test vergleicht die Tonhöhen links und rechts.<br>" + ...
```

ersetzen durch (die alte `fmHintWarn`-Zeile bleibt für den CI+Naturgehör-Fall
erhalten; `fmHintMethod` wird beibehalten als Fallback, falls die
Element-IDs fehlen):

**Einfügen direkt vor `fmLblRef` (~Zeile 625), nach dem bestehenden
`fmHintMethod`-Block:**

```js
    fmHintMethodCiNatural:
      "Dieser Test vergleicht die Tonhöhen links und rechts.<br>" +
      "• Ziel des Testes ist es, die tatsächlich stimulierte Frequenz der CI-Elektroden festzustellen.<br>" +
      "• Stellen Sie das Ohr, auf dem Sie natürlich hören, als Referenzohr ein. Das gilt für schwerhörig ebenso wie für normalhörend.<br>" +
      "• Auf Basis des Testergebnisses können die Mittenfrequenzen der Elektroden im CI neu eingestellt werden, so daß die Tonhöhen natürlichem Hören entsprechen.",
    fmHintMethodBothCI:
      "Dieser Test vergleicht die Tonhöhen links und rechts.<br>" +
      "• Ziel des Testes ist es, die Tonhöhen beider CI einander anzugleichen, so daß sie auf beiden Seiten die gleiche Frequenz auch gleich hören.<br>" +
      "• Auf Basis des Testergebnisses können die Mittenfrequenzen der Elektroden im CI neu eingestellt werden.<br>" +
      "• Einschränkung des Testverfahrens: Je weiter die Testtöne von den eingestellten Mittenfrequenzen der CI entfernt sind, um so stärker werden Nachbarelektroden mit angesprochen, die das Meßergebnis verfälschen. Konsequenz: Bei großen Abweichungen kann es sein, daß Sie nach der Anpassung an die Meßergebnisse durch den Audiologen den Test erneut durchführen müssen, um sich den korrekten Werten weiter anzunähern.",
    fmHintWarnBothCI:
      "Achten Sie darauf, als Referenzseite 'symmetrisch' auszuwählen. Dabei werden die Frequenzen in beiden CI beim Test gleichermaßen verändert, um das ungewollte Ansprechen von Nachbarelektroden zu minimieren.",
```

**Einfügen direkt vor oder nach `fmPrereqHint` (~Zeile 823):**

```js
    fmPrereqLvLeft:  "Führen Sie zuerst die Messung Elektrodenlautstärke für die linke Seite aus.",
    fmPrereqLvRight: "Führen Sie zuerst die Messung Elektrodenlautstärke für die rechte Seite aus.",
    fmPrereqLvBoth:  "Führen Sie zuerst die Messung Elektrodenlautstärke für beide Seiten aus.",
    fmPrereqSb:      "Führen Sie zuerst die Messung Stereo-Balance aus.",
```

Der bestehende `fmPrereqHint`-Eintrag (~Zeile 823) kann stehen bleiben
(wird von keinem Element mehr referenziert, schadet aber nicht).

---

## Akzeptanztest-Checkliste

**Voraussetzung:** App im Browser geöffnet, Konsole offen.

### A — Beide Seiten CI, keine Messungen

1. Tab „Messungen" → Sub-Tab „Frequenzabgleich" öffnen.
2. Im Implantat-Setup: linke Seite = CI, rechte Seite = CI.
3. **Erwartet:** Haupt-Introtext beginnt mit „Ziel des Testes ist es,
   die Tonhöhen beider CI einander anzugleichen".
4. **Erwartet:** Referenzseiten-Hinweis enthält 'symmetrisch'.
5. **Erwartet:** Warn-Hinweis „Führen Sie zuerst die Messung
   Elektrodenlautstärke für beide Seiten aus." sichtbar.
6. **Erwartet:** Warn-Hinweis „Führen Sie zuerst die Messung
   Stereo-Balance aus." sichtbar.

### B — Linke Seite CI, rechte Seite Normalhören, keine Messungen

1. Im Implantat-Setup: linke Seite = CI, rechte Seite = „Normalhören".
2. **Erwartet:** Haupt-Introtext beginnt mit „Ziel des Testes ist es,
   die tatsächlich stimulierte Frequenz der CI-Elektroden festzustellen".
3. **Erwartet:** Referenzseiten-Hinweis enthält „die mit natürlichem Gehör".
4. **Erwartet:** Elektrodenlautstärke-Hinweis: „...für beide Seiten aus."
5. **Erwartet:** Stereo-Balance-Hinweis sichtbar.

### C — Elektrodenlautstärke-Hinweis seitenspezifisch

1. Konsole: `sideData.left.jRes.push({a:0,b:1,winner:'a'})` ausführen
   (simuliert einen Linkstest).
2. Seite neu laden NICHT nötig — stattdessen kurz zu einem anderen
   Sub-Tab wechseln und zurück (löst `_fmRefreshTabState` aus).
3. **Erwartet:** Elektrodenlautstärke-Hinweis zeigt jetzt „...für die
   rechte Seite aus." (nur rechts fehlt noch).
4. Konsole: `sideData.right.jRes.push({a:0,b:1,winner:'a'})`.
5. Erneut Tab-Wechsel und zurück.
6. **Erwartet:** Elektrodenlautstärke-Hinweis ausgeblendet.

### D — Stereo-Balance-Hinweis verschwindet

1. Konsole: `lrResults[0] = 1.5` (simuliert ein Stereo-Balance-Ergebnis).
2. Tab-Wechsel und zurück.
3. **Erwartet:** Stereo-Balance-Hinweis ausgeblendet.

### E — Keine Regression bei anderen Tests

1. Tab „Messungen" → Sub-Tab „Elektrodenlautstärke" öffnen.
2. **Erwartet:** Intro-Text dort unverändert.
3. Sub-Tab „Stereo-Balance" öffnen.
4. **Erwartet:** Intro-Text dort unverändert.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterium durchgehen und melden:
**erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe.

Konkret zu prüfen:
1. Beide `forEach`-Blöcke in `test-ui.js` geändert (nicht nur einer)?
2. `fmPrereqLvHintPara` und `fmPrereqSbHintPara`: kein `key` im Config
   → kein `data-t`-Attribut im DOM (prüfen per `el.hasAttribute('data-t')`)?
3. `_fmRenderIntroText` aufgerufen aus `fmApplyLang` UND `_fmRefreshTabState`?
4. `_fmRenderPrereqHints` aufgerufen aus `fmApplyLang` UND `_fmRefreshTabState`?
5. Alle vier neuen Prereq-Strings in `i18n/de.js` vorhanden?
6. `fmHintMethodCiNatural` und `fmHintMethodBothCI` in `i18n/de.js` vorhanden?
7. `fmHintWarnBothCI` in `i18n/de.js` vorhanden?
8. Version auf `3.0.160-beta` gesetzt?
9. Keine doppelten `"` in i18n-Strings, die den JS-Parser brechen könnten?

---

## Hinweis: Künftige Übersetzungen

Die neuen Strings (`fmHintMethodCiNatural`, `fmHintMethodBothCI`,
`fmHintWarnBothCI`, `fmPrereqLv*`, `fmPrereqSb`) sind bisher nur in
`i18n/de.js`. Englisch, Französisch und Spanisch werden in einer
separaten Mini-Anleitung nachgezogen, sobald die deutschen Texte
durch sind.
