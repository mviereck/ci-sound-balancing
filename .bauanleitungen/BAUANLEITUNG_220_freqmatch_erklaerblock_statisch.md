# BAUANLEITUNG 220 — freqmatch: Erklärblock statisch, Warnungen über testUI

## Voraussetzung

- **BA 219 ist gebaut** (`testUI.explain.setVisible`, `cfg.prerequisites`,
  Slider-Helfer existieren). Erkennbar an `js/version.js`:
  `"3.2.219-beta"` oder höher.
- Wenn `version.js` noch auf einer 218er-Variante steht: **diese Anleitung
  nicht ausführen**, sondern nachfragen.

## Ziel

Im Frequenzabgleich werden heute drei dynamische Render-Funktionen
benutzt, die Erklär-Absätze je nach Konfiguration ein-/ausblenden
oder ihre Texte austauschen:
- `_fmRenderIntroText` (tauscht Methoden- und Warn-Text zwischen
  „beide CI" und „CI + akustisch").
- `_fmRenderHGWarning` (baut/entfernt eine eigene `info-box.info-box-warn`).
- `_fmRenderCochlearFatHint` (baut/entfernt eine eigene
  `info-box.info-box-warn`).

Diese drei Funktionen werden **entfernt**. Stattdessen:

1. Beide Erklär-Gruppen („beidseitiges CI" / „CI mit akustisch hörender
   Gegenseite") erscheinen **immer**, jeweils mit eigener Überschrift.
2. HG-Warnung und Cochlear-FAT-Hinweis sind reguläre `kind:'warn'`-
   Absätze im Erklärblock; ihre Sichtbarkeit wird per
   `testUI.explain.setVisible` umgeschaltet.
3. Voraussetzungs-Hinweise (`fmPrereqLvLeft/Right/Sb`) bleiben **bedingt**
   (nur sichtbar, wenn die jeweilige Voraussetzung fehlt).

Damit Gruppen-Überschriften und Warn-Texte in der **Config-Reihenfolge**
stehen bleiben (statt durch die Schwere-Sortierung neu gemischt zu
werden), ergänzen wir in `test-ui.js` zwei kleine Optionen:
`cfg.explain.preserveOrder` und `kind: 'heading'`.

---

## Schritt 1 — `js/test-ui.js`: `kind:'heading'` und `preserveOrder`

**Hintergrund:** Heute sortiert `_buildTestPanelNew` alle Absätze mit
`kind ≠ 'plain'` an den Anfang nach Schwere (BA 178). Das zerreißt
unsere Gruppen. Mit `preserveOrder: true` überspringt TestUI die
Sortierung; mit `kind: 'heading'` gibt es einen sichtbaren Gruppen-
Titel innerhalb des Erklärblocks.

**Datei:** `js/test-ui.js`

**Vorher** (`js/test-ui.js`, Zeilen ca. 738–776):

```js
  // ===== BLOCK 1: Erklärungen =====
  var explainBox = _mkEl('div', 'card explain-box');
  var h2 = _mkEl('h2');
  _tEl(h2, cfg.explain.titleKey);
  explainBox.appendChild(h2);
  // BA 178: Sortierung — oben Stufen-Block (error->caution->warn->info->ok),
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

**Nachher** (gesamten Block ersetzen):

```js
  // ===== BLOCK 1: Erklärungen =====
  var explainBox = _mkEl('div', 'card explain-box');
  var h2 = _mkEl('h2');
  _tEl(h2, cfg.explain.titleKey);
  explainBox.appendChild(h2);

  // BA 178: Default-Sortierung — oben Stufen-Block (error->caution->warn->info->ok),
  // unten Plain-Texte in Config-Reihenfolge.
  // BA 220: cfg.explain.preserveOrder = true => keine Sortierung, alles in
  // Config-Reihenfolge. Notwendig, wenn Gruppen-Headings und Warn-Texte
  // zusammengehoeren sollen.
  // BA 220: Neuer kind 'heading' => <h4 class="explain-heading">.
  var _preserveOrder = !!(cfg.explain && cfg.explain.preserveOrder);
  var _kindOrder = { error: 0, caution: 1, warn: 2, info: 3, ok: 4 };
  var _stagedHints = [];
  var _stagedPlain = [];
  var _stagedAll   = [];
  (cfg.explain.paragraphs || []).forEach(function(p, configIdx) {
    var kind = p.kind || 'plain';
    var el;
    if (kind === 'heading') {
      el = _mkEl('h4', 'explain-heading');
    } else {
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
      el = _mkEl('p', cls);
    }
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    if (_preserveOrder) {
      _stagedAll.push(el);
    } else if (kind === 'plain' || kind === 'heading') {
      _stagedPlain.push({ el: el, configIdx: configIdx });
    } else {
      _stagedHints.push({ el: el, kind: kind, configIdx: configIdx });
    }
  });
  if (_preserveOrder) {
    _stagedAll.forEach(function(el) { explainBox.appendChild(el); });
  } else {
    _stagedHints.sort(function(a, b) {
      var ka = _kindOrder[a.kind], kb = _kindOrder[b.kind];
      if (ka !== kb) return ka - kb;
      return a.configIdx - b.configIdx;
    });
    _stagedHints.forEach(function(h) { explainBox.appendChild(h.el); });
    _stagedPlain.forEach(function(p) { explainBox.appendChild(p.el); });
  }
```

---

## Schritt 2 — Render-Funktionen in `freqmatch.js` entfernen / umbauen

**Datei:** `js/freqmatch.js`

### 2a) `_fmRenderIntroText` ersatzlos löschen

**Vorher** (`js/freqmatch.js`, Zeilen 924–943):

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
```

**Nachher:** Funktion **ersatzlos entfernen** (die zwei Gruppen werden
ab jetzt statisch aus dem cfg gerendert; siehe Schritt 4).

### 2b) `_fmRenderHGWarning` durch sichtbarkeits-orientierte Variante ersetzen

**Vorher** (`js/freqmatch.js`, Zeilen 898–922):

```js
function _fmRenderHGWarning() {
  if (!_fmParentEl) return;
  const explainBox = _fmParentEl.querySelector('.explain-box');
  if (!explainBox) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen wenn Test nicht ohnehin geblockt ist
  const blocked = _fmEvalTestEligibility().blocked;
  let warn = document.getElementById('fmHGWarning');
  if (!hasHG || blocked) {
    if (warn) warn.remove();
    return;
  }
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'fmHGWarning';
    warn.className = 'info-box info-box-warn';
    warn.style.marginBottom = '14px';
    const h2 = explainBox.querySelector('h2');
    if (h2) explainBox.insertBefore(warn, h2.nextSibling);
    else    explainBox.insertBefore(warn, explainBox.firstChild);
  }
  warn.textContent = (typeof t === 'function') ? t('fmHGWarn') : 'Hörgerät konfiguriert.';
}
```

**Nachher** (Funktion vollständig durch diesen Block ersetzen):

```js
function _fmRefreshHGWarningVisibility() {
  if (!fmEls) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  // HG-Warnung nur zeigen, wenn Test nicht ohnehin geblockt ist.
  const blocked = _fmEvalTestEligibility().blocked;
  const visible = hasHG && !blocked;
  testUI.explain.setVisible(fmEls, 'fmHGWarnPara', visible);
}
```

### 2c) `_fmRenderCochlearFatHint` analog umbauen

**Vorher** (`js/freqmatch.js`, Zeilen 169–199):

```js
function _fmRenderCochlearFatHint() {
  if (!_fmParentEl) return;
  const explainBox = _fmParentEl.querySelector('.explain-box');
  if (!explainBox) return;
  const show = _fmShouldShowCochlearFatHint();
  let hint = document.getElementById('fmCochlearFatHint');

  if (!show) {
    if (hint) hint.remove();
    return;
  }

  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'fmCochlearFatHint';
    hint.className = 'info-box info-box-warn';
    hint.style.marginBottom = '14px';
    const hgWarn = document.getElementById('fmHGWarning');
    const h2 = explainBox.querySelector('h2');
    const anchor = hgWarn ? hgWarn.nextSibling : (h2 ? h2.nextSibling : explainBox.firstChild);
    explainBox.insertBefore(hint, anchor);
  }
  const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
  // YYYY-MM-DD, UTC.
  const dateStr = d.getUTCFullYear() + '-'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
    + String(d.getUTCDate()).padStart(2, '0');
  const txt = (typeof t === 'function') ? t('fmCochlearFatCorrectionInfo')
    : 'Cochlear-FAT wurde korrigiert.';
  hint.textContent = txt.replace('{date}', dateStr);
}
```

**Nachher** (Funktion vollständig durch diesen Block ersetzen):

```js
function _fmRefreshCochlearFatHintVisibility() {
  if (!fmEls) return;
  const visible = _fmShouldShowCochlearFatHint();
  testUI.explain.setVisible(fmEls, 'fmCochlearFatHintPara', visible);
  // Datum in den Text einsetzen (jedes Mal frisch, falls Sprache wechselt).
  if (visible) {
    const el = fmEls.explainBox && fmEls.explainBox.querySelector('#fmCochlearFatHintPara');
    if (el) {
      const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
      const dateStr = d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
      const txt = (typeof t === 'function') ? t('fmCochlearFatCorrectionInfo')
        : 'Cochlear-FAT wurde korrigiert.';
      el.textContent = txt.replace('{date}', dateStr);
    }
  }
}
```

---

## Schritt 3 — Aufrufer in `freqmatch.js` aktualisieren

**Datei:** `js/freqmatch.js`

### 3a) `fmApplyLang`

**Vorher** (Zeilen 843–852):

```js
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRenderHGWarning();
  _fmRenderCochlearFatHint();
  _fmRenderIntroText();
  _fmRenderPrereqHints();
}
```

**Nachher:**

```js
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}
```

### 3b) `_fmRefreshTabState`

**Vorher** (Zeilen 965–976):

```js
function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRenderHGWarning();
  if (typeof _fmRenderCochlearFatHint === 'function') _fmRenderCochlearFatHint();
  _fmRenderIntroText();
  _fmRenderPrereqHints();
}
```

**Nachher:**

```js
function _fmRefreshTabState() {
  if (!fmEls) return;
  if (!fmRunning) {
    _fmAutoSetRefMode();
    fmLoadVerfahrenFromSide();
  }
  if (typeof fmRefreshResumeHint === 'function') fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
  _fmRenderPrereqHints();
}
```

### 3c) DOMContentLoaded-Block am Ende

**Vorher** (Zeilen 1278–1285):

```js
  fmApplyLang();

  if (!fmRunning) _fmAutoSetRefMode();
  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRenderHGWarning();
  _fmRenderCochlearFatHint();
});
```

**Nachher:**

```js
  fmApplyLang();

  if (!fmRunning) _fmAutoSetRefMode();
  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRefreshHGWarningVisibility();
  _fmRefreshCochlearFatHintVisibility();
});
```

---

## Schritt 4 — `cfg.explain.paragraphs` umstrukturieren

**Datei:** `js/freqmatch.js`

**Vorher** (Zeilen 1076–1089):

```js
  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'fmTitle',
      paragraphs: [
        { key: 'fmMaturityHint',  kind: 'caution' },
        { key: 'fmHintMethod',    kind: 'plain',   id: 'fmHintMethodPara'      },
        { key: 'fmPrereqLvLeft',  kind: 'warn',    id: 'fmPrereqLvLeftPara'    },
        { key: 'fmPrereqLvRight', kind: 'warn',    id: 'fmPrereqLvRightPara'   },
        { key: 'fmPrereqSb',      kind: 'warn',    id: 'fmPrereqSbHintPara'    },
        { key: 'fmHintWarn',      kind: 'caution', id: 'fmHintWarnPara'        },
        { key: 'fmHintWorkflow',  kind: 'plain' }
      ]
    },
```

**Nachher:**

```js
  const fmCfg = {
    id: 'freqmatch',
    explain: {
      titleKey: 'fmTitle',
      // BA 220: preserveOrder, damit Gruppen-Headings, Methodentext und
      // zugehoerige Warnung visuell zusammenstehen statt durch die
      // Schwere-Sortierung gemischt zu werden.
      preserveOrder: true,
      paragraphs: [
        { key: 'fmMaturityHint',         kind: 'caution' },

        // Warn-Absaetze, deren Sichtbarkeit dynamisch umgeschaltet wird
        // (Initial hidden=true; testUI.explain.setVisible blendet bei Bedarf ein).
        { key: 'fmHGWarn',               kind: 'warn',    id: 'fmHGWarnPara',
                                         hidden: true },
        { key: 'fmCochlearFatCorrectionInfo', kind: 'warn', id: 'fmCochlearFatHintPara',
                                         hidden: true },

        // Voraussetzungen — bleiben bedingt sichtbar (durch _fmRenderPrereqHints).
        { key: 'fmPrereqLvLeft',         kind: 'warn',    id: 'fmPrereqLvLeftPara'    },
        { key: 'fmPrereqLvRight',        kind: 'warn',    id: 'fmPrereqLvRightPara'   },
        { key: 'fmPrereqSb',             kind: 'warn',    id: 'fmPrereqSbHintPara'    },

        // Gruppe 1: beidseitiges CI.
        { key: 'fmGroupBothCi',          kind: 'heading' },
        { key: 'fmHintMethodBothCI',     kind: 'plain' },
        { key: 'fmHintWarnBothCI',       kind: 'caution' },

        // Gruppe 2: CI + akustische Gegenseite.
        { key: 'fmGroupCiAcoustic',      kind: 'heading' },
        { key: 'fmHintMethodCiNatural',  kind: 'plain' },
        { key: 'fmHintWarn',             kind: 'caution' },

        { key: 'fmHintWorkflow',         kind: 'plain' }
      ]
    },
```

**Wichtig:** `hidden: true` muss in `_buildTestPanelNew` ausgewertet werden,
sonst sind die Warnungen initial sichtbar. Siehe Schritt 5.

---

## Schritt 5 — `js/test-ui.js`: `paragraph.hidden` respektieren

**Datei:** `js/test-ui.js`

**Hintergrund:** Die paragraphs-Schleife setzt heute weder
`el.hidden` noch sonst etwas, das aus dem cfg-Eintrag käme. Wir
ergänzen ein optionales `p.hidden`-Feld, damit dynamische Warnungen
initial unsichtbar starten und erst von `testUI.explain.setVisible`
eingeblendet werden.

**Position:** Innerhalb des in Schritt 1 geänderten Blocks, direkt
nach der `if (p.id) el.id = p.id;`-Zeile.

**Vorher** (Auszug aus dem in Schritt 1 ersetzten Block):

```js
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    if (_preserveOrder) {
```

**Nachher** (gleiche Stelle, eine Zeile dazwischen):

```js
    if (p.key) _tEl(el, p.key);
    if (p.id)  el.id = p.id;
    if (p.hidden) el.hidden = true; // BA 220
    if (_preserveOrder) {
```

---

## Schritt 6 — i18n: zwei neue Überschriften in allen vier Sprachen

### 6a) `i18n/de.js`

**Position:** im selben Block wie die anderen `fm*`-Keys, am sinnvollsten
**direkt vor** `fmHintMethod:` (Zeile 608) — also Block:

```js
    fmGroupBothCi:     "Bei beidseitigem CI",
    fmGroupCiAcoustic: "Bei CI mit akustisch hörender Gegenseite",
```

### 6b) `i18n/en.js`

**Position:** analog vor dem englischen `fmHintMethod:`-Eintrag.

```js
    fmGroupBothCi:     "Bilateral CI",
    fmGroupCiAcoustic: "CI paired with acoustic hearing",
```

### 6c) `i18n/fr.js`

```js
    fmGroupBothCi:     "IC bilatéral",
    fmGroupCiAcoustic: "IC avec audition acoustique controlatérale",
```

### 6d) `i18n/es.js`

```js
    fmGroupBothCi:     "IC bilateral",
    fmGroupCiAcoustic: "IC con audición acústica contralateral",
```

**Hinweis:** Diese Strings enthalten keine ASCII-`"`-Zeichen im Inneren
und keine HTML-Tags — Mischformen vermeiden, vor Versand auf
`"`-Zähl-Konsistenz prüfen (siehe Leitlinien).

---

## Schritt 7 — Mini-CSS für `.explain-heading`

**Datei:** `style.css` (oder die zentrale Stylesheet-Datei — vor dem
Einfügen prüfen, wo die anderen `.explain-*`-Klassen definiert sind;
neuen Eintrag thematisch dazustellen).

```css
/* BA 220: Gruppen-Heading innerhalb des Erklaerblocks. */
.explain-heading {
  margin: 14px 0 4px 0;
  font-size: 1.0em;
  font-weight: 600;
  color: var(--text);
}
.explain-heading:first-of-type {
  margin-top: 6px;
}
```

Falls die CSS-Datei nicht `style.css` heißt: vor dem Edit per
`grep -n "\.explain-plain" style.css` bzw. in `/css/`-Verzeichnis
suchen, wo die `.explain-*`-Klassen liegen.

---

## Schritt 8 — `js/version.js` Versionsbump

**Vorher:**

```js
const APP_VERSION = "3.2.219-beta";
```

(oder `3.2.219.x-beta`, falls zwischendurch Fixes gemacht wurden)

**Nachher:**

```js
const APP_VERSION = "3.2.220-beta";
```

---

## Akzeptanztest (manuell)

Voraussetzung: `version.js` zeigt `3.2.220-beta`, Browser-Cache leer.

**Konfiguration: beide Seiten CI**
1. Tab „Implantat" → beide Seiten als CI konfigurieren, Hersteller
   beliebig (nicht Cochlear oder ohne alte Frequenztests).
2. Tab „Messungen" → Sub-Tab „Frequenzabgleich".
   **Erwartet:**
   - Reifegrad-Hinweis (`fmMaturityHint`, gelb) oben.
   - Voraussetzungs-Hinweise (Lautstärke links/rechts, Stereo-Balance,
     soweit nicht erledigt) als rote Warn-Boxen.
   - Überschrift **„Bei beidseitigem CI"** mit dem zugehörigen
     Methoden-Text und der zugehörigen Caution-Box (`fmHintWarnBothCI`).
   - Überschrift **„Bei CI mit akustisch hörender Gegenseite"** mit
     `fmHintMethodCiNatural` und `fmHintWarn`.
   - Workflow-Hinweis (`fmHintWorkflow`) am Ende.
   - **Keine** HG-Warnung, **keine** Cochlear-FAT-Warnung.

**Konfiguration: eine Seite HG**
3. Tab „Implantat" → eine Seite auf HG umstellen, die andere CI.
4. Zurück zu Frequenzabgleich.
   **Erwartet:** HG-Warnung (`fmHGWarn`) wird sichtbar; beide Gruppen-
   Texte erscheinen weiterhin. Andere Hinweise unverändert.

**Konfiguration: Cochlear mit alten Daten**
5. Eine gespeicherte Konfiguration mit Hersteller=Cochlear und
   Frequenzabgleich-Ergebnis vor `COCHLEAR_FAT_CORRECTION_DATE` laden
   (oder per `js/data` / Bestand prüfen).
   **Erwartet:** Cochlear-FAT-Hinweis wird sichtbar, mit korrektem
   Datum im Text.

**Sprache wechseln**
6. Sprache auf EN umstellen → alle Überschriften, Hinweise und Warn-
   Texte erscheinen englisch. FR und ES analog testen.

**Regression**
7. Stereo-Balance, Test, Implantat-Tab: keine visuellen oder
   funktionalen Änderungen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Kriterie einzeln durchgehen
(erfüllt / nicht erfüllt / unklar, mit Datei + Zeile):

1. `js/test-ui.js`: `cfg.explain.preserveOrder`-Pfad implementiert,
   `kind: 'heading'` rendert `<h4 class="explain-heading">`, `p.hidden`
   wird respektiert.
2. `js/freqmatch.js`: `_fmRenderIntroText` ist gelöscht.
3. `js/freqmatch.js`: `_fmRenderHGWarning` ist durch
   `_fmRefreshHGWarningVisibility` ersetzt; baut **kein** DOM mehr,
   ruft nur `testUI.explain.setVisible(fmEls, 'fmHGWarnPara', visible)`.
4. `js/freqmatch.js`: `_fmRenderCochlearFatHint` ist durch
   `_fmRefreshCochlearFatHintVisibility` ersetzt; baut **kein** DOM,
   schaltet Sichtbarkeit, schreibt nur den Datumstext in den bestehenden
   Absatz.
5. Aufrufer in `fmApplyLang`, `_fmRefreshTabState` und im
   `DOMContentLoaded`-Block sind aktualisiert (keine Aufrufe der
   gelöschten Render-Funktionen mehr).
6. `cfg.explain.paragraphs` enthält die in Schritt 4 angegebene
   Reihenfolge inkl. `preserveOrder: true`, `fmHGWarnPara` und
   `fmCochlearFatHintPara` mit `hidden: true`.
7. Alle vier i18n-Dateien (de/en/fr/es) enthalten die zwei neuen
   Keys `fmGroupBothCi` und `fmGroupCiAcoustic`.
8. CSS-Klasse `.explain-heading` ist im Stylesheet definiert.
9. `js/version.js` zeigt `"3.2.220-beta"`.
10. `grep -n "fmHGWarning\b" js/freqmatch.js` liefert **keine** Treffer
    mehr (der alte DOM-ID-Name ist überall entfernt; die neue ID heißt
    `fmHGWarnPara`).
11. `grep -n "fmCochlearFatHint\b" js/freqmatch.js` liefert keine
    Treffer mehr (außer evtl. Funktionsname-Reste; sollten ebenfalls
    weg sein).
12. `grep -n "fmHintMethodPara\|fmHintWarnPara" js/freqmatch.js` liefert
    keine Treffer mehr.

Bei „unklar": nachfragen, **nicht** still annehmen.

---

## Hinweise zur fortgeschrittenen Bereinigung (optional, nicht zwingend)

Die Funktion `_fmShouldShowCochlearFatHint` (Zeile 155) bleibt erhalten,
sie wird von `_fmRefreshCochlearFatHintVisibility` weiter aufgerufen.

`COCHLEAR_FAT_CORRECTION_DATE` und die Datums-Logik bleiben unverändert.

Die i18n-Keys `fmHintMethod` und `fmHintMethodPara` werden ab BA 220
nicht mehr verwendet. Wenn `grep -rn "fmHintMethod\b"` ausschließlich
Treffer in den i18n-Dateien liefert (also keine JS-Referenzen mehr):
können entfernt werden — **nur** mit grep-Bestätigung, sonst stehen
lassen.

---

## Folge-BAs

- BA 221: freqmatch Slider-Display + Range-Marker auf
  `testUI.slider.setValueDisplay` / `setRangeHint` umstellen, Range-
  Marker-Bug reparieren.
- BA 222: freqmatch Vortest-Empfehlung auf `cfg.prerequisites` umstellen,
  `fmSEDlg` entfernen.
