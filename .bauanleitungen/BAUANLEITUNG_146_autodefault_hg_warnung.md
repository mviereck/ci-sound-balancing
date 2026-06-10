# BAUANLEITUNG 146 — Auto-Default Referenzseite + Hörgeräte-Warnung + Test-Sperre

**Zieldateien:** `js/freqmatch.js`, `js/tabs-eq.js`, `i18n/de.js`, `js/version.js`
**Voraussetzung:** BA 145 abgeschlossen (`APP_VERSION = "3.0.145-beta"`, `_fmHasAdaptiveData()` existiert)
**Version:** 3.0.145-beta → **3.0.146-beta**

---

## Kontext

Drei Erweiterungen am Frequenzabgleich-Reiter:

1. **Auto-Default Referenzseite** anhand `sideData[*].config`:
   - links = `'ci'`, rechts akustisch (`normal`/`shoh`/`hg`) → `refSelect.value = 'right'`
   - rechts = `'ci'`, links akustisch → `refSelect.value = 'left'`
   - alles andere → kein Override

   Der Auto-Default greift **nur**, wenn (a) kein Test läuft (`!fmRunning`) UND
   (b) noch keine Testdaten vorliegen (`fRes.length === 0` UND
   `_fmHasAdaptiveData()` falsch). Sobald Daten vorhanden sind, bleibt das
   Dropdown unverändert; manueller Wechsel löst dann den BA-145-Schutzdialog
   `fmRCDlg` aus.

2. **Hörgeräte-Warnung** als gelbe Info-Box oben im Panel, wenn eine Seite
   als `'hg'` konfiguriert ist.

3. **Test-Sperre** bei beidseitig akustisch oder eine Seite `'deaf'`:
   Start-Knopf disabled, gelbe Info-Box erklärt warum. Sobald die Konfig
   wieder testbar wird (mind. eine CI-Seite, keine deaf-Seite), wird der
   Start-Knopf wieder freigegeben.

4. **Tab-Aktivierungs-Trigger**: Damit Auto-Default und die zwei Warn-Boxen
   bei jedem Aufruf des Reiters frisch gesetzt werden, ruft `switchSubtab()`
   in `tabs-eq.js` einen zentralen Refresh `_fmRefreshTabState()` auf.

---

## Schritt 1 — `_fmEvalTestEligibility()` einführen

Datei: `js/freqmatch.js`

Suche die Funktion `_fmHasAdaptiveData()` (eingeführt in BA 145, beginnt mit
`function _fmHasAdaptiveData()`). Füge **direkt davor** ein:

```js
function _fmEvalTestEligibility() {
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  if (leftCfg === 'deaf' || rightCfg === 'deaf') {
    return { blocked: true, reason: 'sideDeaf' };
  }
  function isAcoustic(c) { return c === 'normal' || c === 'shoh' || c === 'hg'; }
  if (isAcoustic(leftCfg) && isAcoustic(rightCfg)) {
    return { blocked: true, reason: 'bothAcoustic' };
  }
  return { blocked: false, reason: null };
}
```

---

## Schritt 2 — `_fmAutoSetRefMode()` einführen

Datei: `js/freqmatch.js`

Direkt **nach** `_fmEvalTestEligibility()` (und **vor** `_fmHasAdaptiveData()`)
einfügen:

```js
function _fmAutoSetRefMode() {
  if (!fmEls || !fmEls.header || !fmEls.header.refSelect) return;
  // Schutz: solange Daten vorliegen, refSelect nicht implizit umstellen —
  // ein manueller Wechsel löst dann den fmRCDlg-Bestätigungsdialog aus.
  if (fRes.length > 0) return;
  if (_fmHasAdaptiveData()) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const leftIsCI  = (leftCfg  === 'ci');
  const rightIsCI = (rightCfg === 'ci');
  if (leftIsCI && !rightIsCI) {
    fmEls.header.refSelect.value = 'right';
  } else if (rightIsCI && !leftIsCI) {
    fmEls.header.refSelect.value = 'left';
  }
  // beide CI oder beide akustisch: kein Override (Sperre wird durch
  // _fmRenderBlockedWarning separat behandelt).
}
```

---

## Schritt 3 — `_fmRenderHGWarning()` einführen

Datei: `js/freqmatch.js`

Direkt **nach** `_fmAutoSetRefMode()` einfügen:

```js
function _fmRenderHGWarning() {
  if (!_fmParentEl) return;
  const leftCfg  = (sideData.left  && sideData.left.config)  || 'ci';
  const rightCfg = (sideData.right && sideData.right.config) || 'ci';
  const hasHG = (leftCfg === 'hg') || (rightCfg === 'hg');
  let warn = document.getElementById('fmHGWarning');
  if (!hasHG) {
    if (warn) warn.remove();
    return;
  }
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'fmHGWarning';
    warn.className = 'info-box info-box-warn';
    warn.style.marginBottom = '14px';
    _fmParentEl.insertBefore(warn, _fmParentEl.firstChild);
  }
  warn.textContent = (typeof t === 'function') ? t('fmHGWarn') : 'Hörgerät konfiguriert.';
}
```

---

## Schritt 4 — `_fmRenderBlockedWarning()` einführen

Datei: `js/freqmatch.js`

Direkt **nach** `_fmRenderHGWarning()` einfügen:

```js
function _fmRenderBlockedWarning() {
  if (!_fmParentEl) return;
  const ev = _fmEvalTestEligibility();
  let warn = document.getElementById('fmBlockedWarning');
  const startBtn = (fmEls && fmEls.header) ? fmEls.header.startBtn : null;
  if (!ev.blocked) {
    if (warn) warn.remove();
    // Start-Knopf nur freigeben, wenn kein Test läuft. Während fmRunning
    // verwaltet _startTest/_stopTest startBtn.disabled selbst (BA 145).
    if (startBtn && !fmRunning) startBtn.disabled = false;
    return;
  }
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'fmBlockedWarning';
    warn.className = 'info-box info-box-warn';
    warn.style.marginBottom = '14px';
    _fmParentEl.insertBefore(warn, _fmParentEl.firstChild);
  }
  const key = 'fmBlocked_' + ev.reason; // 'fmBlocked_sideDeaf' | 'fmBlocked_bothAcoustic'
  warn.textContent = (typeof t === 'function') ? t(key) : 'Test gesperrt.';
  if (startBtn) startBtn.disabled = true;
}
```

---

## Schritt 5 — `_fmRefreshTabState()` einführen

Datei: `js/freqmatch.js`

Direkt **nach** `_fmRenderBlockedWarning()` einfügen. Das ist der zentrale
Entry-Point für die Tab-Aktivierung — er ruft Auto-Default + alle Renderer in
sicherer Reihenfolge.

```js
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
```

**Wichtig:** `fmLoadVerfahrenFromSide()` selbst wird **nicht** angefasst —
der Auto-Default geschieht außerhalb (in `_fmRefreshTabState` und initial im
DOMContentLoaded-Block, siehe Schritt 6). Damit gibt es keinen Doppelaufruf
von `_fmAutoSetRefMode` und kein Override beim refSelect-Change-Event.

---

## Schritt 6 — DOMContentLoaded ergänzen (`freqmatch.js`)

Datei: `js/freqmatch.js`

Der DOMContentLoaded-Block endet derzeit (nach BA 145) mit:

```js
  // Texte initial setzen
  fmApplyLang();

  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRenderCochlearFatHint();
});
```

Ersetze die vier Zeilen (`fmApplyLang()` bis `_fmRenderCochlearFatHint()`) durch:

```js
  // Texte initial setzen
  fmApplyLang();

  if (!fmRunning) _fmAutoSetRefMode();
  fmLoadVerfahrenFromSide();
  fmRefreshResumeHint();
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  _fmRenderCochlearFatHint();
});
```

---

## Schritt 7 — `fmApplyLang()` ergänzen (`freqmatch.js`)

Datei: `js/freqmatch.js`

Aktueller Funktionskörper (Z. ~660):

```js
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRenderCochlearFatHint();
}
```

Ersetze ihn durch:

```js
function fmApplyLang() {
  if (!fmEls) return;
  if (fmEls.header && fmEls.header.startBtn) {
    fmRefreshResumeHint();
  }
  _fmRenderHGWarning();
  _fmRenderBlockedWarning();
  _fmRenderCochlearFatHint();
}
```

Begründung: Sprachwechsel sollen alle drei Info-Boxen-Texte aktualisieren.

---

## Schritt 8 — Tab-Aktivierungs-Hook in `tabs-eq.js` ersetzen

Datei: `js/tabs-eq.js`

Suche in `switchSubtab()` den Block:

```js
  if (parent === "messungen" && subtab === "freqmatch") {
    if (typeof fmApplyLang === "function") fmApplyLang();
    if (typeof fmLoadModeFromSide === "function") fmLoadModeFromSide();
  }
```

Ersetze ihn durch:

```js
  if (parent === "messungen" && subtab === "freqmatch") {
    if (typeof fmApplyLang === "function") fmApplyLang();
    if (typeof _fmRefreshTabState === "function") _fmRefreshTabState();
  }
```

**Hinweis:** Die zweite Zeile (`fmLoadModeFromSide`) rief eine Funktion auf,
die im Code nicht existiert — toter Aufruf. Der neue Refresh-Entry-Point
übernimmt die Arbeit, die hier vorgesehen war.

---

## Schritt 9 — i18n-Strings in `i18n/de.js`

Datei: `i18n/de.js`

Suche den Key `fmCochlearFatCorrectionInfo`. Füge **direkt davor** ein
(achte auf typographische „…"-Anführungszeichen im String, nicht ASCII-`"`):

```js
    fmHGWarn:              "Eine Seite ist als Hörgerät konfiguriert. Die Tonhöhenwahrnehmung über ein Hörgerät kann durch Kompressor, Frequenzformung und Verstärkungseinstellung vom akustischen Original abweichen. Frequenzabgleich-Ergebnisse mit Hörgerät sind daher weniger verlässlich als mit normalem Restgehör. Alternativ testen Sie ohne Hörgerät, falls Ihr Resthörvermögen dafür ausreicht.",
    fmBlocked_sideDeaf:    "Eine Seite ist als gehörlos eingetragen. Der Frequenzabgleich vergleicht die Tonhöhenwahrnehmung beider Seiten; auf einer gehörlosen Seite ist keine Vergleichswahrnehmung möglich. Der Test ist deshalb gesperrt.",
    fmBlocked_bothAcoustic: "Beide Seiten sind akustisch versorgt (Normalhören, Schwerhörigkeit oder Hörgerät). Der Frequenzabgleich vergleicht eine CI-Frequenz gegen eine Referenz — bei beidseitig akustischer Versorgung gibt es nichts auszugleichen. Der Test ist deshalb gesperrt.",
```

---

## Schritt 10 — Version hochzählen

Datei: `js/version.js`

```js
const APP_VERSION = "3.0.146-beta";
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Position einzeln prüfen und melden
(erfüllt / nicht erfüllt / unklar, mit Datei+Zeile):

1. `_fmEvalTestEligibility()` existiert in `freqmatch.js`, gibt
   `{blocked, reason}` mit drei Pfaden zurück (sideDeaf / bothAcoustic / nicht blockiert).
2. `_fmAutoSetRefMode()` enthält **am Anfang** die zwei Early-Returns
   `if (fRes.length > 0) return;` und `if (_fmHasAdaptiveData()) return;`,
   und setzt sonst refSelect.value = 'right' (links=CI) oder = 'left' (rechts=CI).
3. `_fmRenderHGWarning()` erstellt/entfernt `<div id="fmHGWarning"
   class="info-box info-box-warn">` als erstes Kind von `_fmParentEl`.
4. `_fmRenderBlockedWarning()` macht analog `<div id="fmBlockedWarning">`,
   setzt im blockierten Fall `startBtn.disabled = true`, gibt im freien Fall
   nur dann `disabled = false` zurück, wenn `!fmRunning`.
5. `_fmRefreshTabState()` ruft in dieser Reihenfolge auf:
   `_fmAutoSetRefMode` + `fmLoadVerfahrenFromSide` (nur bei !fmRunning),
   `fmRefreshResumeHint`, `_fmRenderHGWarning`, `_fmRenderBlockedWarning`,
   `_fmRenderCochlearFatHint`.
6. **In `fmLoadVerfahrenFromSide()` wurde NICHTS geändert.** (Wichtig — kein
   Doppelaufruf von `_fmAutoSetRefMode`. Der Auto-Default läuft nur über
   `_fmRefreshTabState` und initial im DOMContentLoaded.)
7. DOMContentLoaded enthält vor `fmLoadVerfahrenFromSide()` den Aufruf
   `if (!fmRunning) _fmAutoSetRefMode();` und ergänzt nach
   `fmRefreshResumeHint()` die zwei neuen Renderer.
8. `fmApplyLang()` enthält am Ende `_fmRenderHGWarning(); _fmRenderBlockedWarning(); _fmRenderCochlearFatHint();`.
9. `tabs-eq.js`: der tote `fmLoadModeFromSide`-Aufruf ist durch
   `_fmRefreshTabState()` ersetzt.
10. `i18n/de.js`: die drei neuen Keys `fmHGWarn`, `fmBlocked_sideDeaf`,
    `fmBlocked_bothAcoustic` sind vorhanden, jeweils mit ausgeglichener
    `"`-Zählung (nur die zwei äußeren ASCII-`"`).
11. `APP_VERSION` in `js/version.js` ist `"3.0.146-beta"`.

---

## Akzeptanztest

1. App laden. Im **Implantat**-Tab links = CI, rechts = CI einstellen.
   Tab Messungen → Frequenzabgleich öffnen.
   - Keine HG- oder Sperr-Warnung, Start-Knopf aktiv. ✓
2. Implantat: links = CI, rechts = Hörgerät. Tab Frequenzabgleich:
   - Dropdown „Referenzseite" zeigt automatisch **Rechts** (HG-Seite). ✓
   - Gelbe HG-Warnung erscheint oben. ✓
   - Start-Knopf bedienbar. ✓
3. Implantat: beide Seiten = Normal. Tab Frequenzabgleich:
   - Gelbe Sperr-Box „Beide Seiten akustisch versorgt …". ✓
   - Start-Knopf disabled. ✓
4. Implantat: links = deaf, rechts = CI. Tab Frequenzabgleich:
   - Gelbe Sperr-Box „Eine Seite ist als gehörlos …". ✓
   - Start-Knopf disabled. ✓
5. Implantat zurück: links = CI, rechts = HG.
   - Sperr-Box verschwindet, HG-Warnung erscheint, Start-Knopf wieder aktiv. ✓
6. Mit gültiger Konfig Test starten, ein paar Trials laufen lassen, Stop.
   Implantat wechseln: rechts HG → rechts Normal. Tab Frequenzabgleich öffnen:
   - Dropdown bleibt unverändert auf 'right' (kein implizites Override, weil
     Daten vorliegen). ✓
   - HG-Warnung ist weg. ✓
   - Manueller Wechsel des Dropdowns löst den BA-145-Schutzdialog
     „alle bisherigen Ergebnisse löschen?" aus. ✓
7. Während eines laufenden Tests Implantat-Konfig ändern ist UI-seitig
   gesperrt (`switchTab`-Guard, `tabs-eq.js`). Akzeptiert.

---

*Hinweis: Übersetzungen (en, fr, es) der drei neuen i18n-Keys werden in einer
eigenen Mini-Anleitung nachgezogen, wenn die deutsche Vorlage durch ist.*
