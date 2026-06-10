# BA 204 — Neues Testverfahren „Spezial: Round Robin mit Vorauswahl" + Umbenennung „Manuell" → „Spezial: Manuell"

## Voraussetzung

BA 203 (Umbenennung „Vollständig" → „Round Robin" und Defaults) ist abgeschlossen und Version `3.2.203-beta` ist live. Diese BA baut auf den dortigen Strings auf.

## Ziel

1. **Neues Verfahren** im Reiter Messungen → Elektrodenlautstärke: **„Spezial: Round Robin mit Vorauswahl"**. Verhalten wie das bestehende Round-Robin-Verfahren, aber gefiltert auf eine vom Nutzer per Popup gewählte Untermenge von Elektroden. Nur Paare, in denen mindestens eine der gewählten Elektroden vorkommt, werden gemessen. Kein Resume (Session-only). Undo-Button bleibt.
2. **Umbenennung** „Manuell" → **„Spezial: Manuell"** (nur deutsche Sicht; die anderen Sprachen werden in dieser BA analog auch umbenannt, weil es eine triviale, mit BA 203 konsistente Begriffsumstellung ist).

Der neue Verfahrens-Wert heißt im Code `'selective'`. Der i18n-Key für den Verfahrens-Eintrag heißt `optSel`, der für den Erklärungstext `runExplSel`.

i18n-Pflege: Für `optMan` werden alle vier Sprachen gepflegt (analog BA 203). Für die neuen Keys `optSel` und `runExplSel` wird **nur Deutsch** in `i18n/de.js` angelegt — Fallback nach `js/i18n.js:9–11` liefert für EN/FR/ES den deutschen Text. Eine spätere Mini-Anleitung für die drei Übersetzungen ist am Ende erwähnt.

---

## Schritt 1 — Version bumpen

Datei `js/version.js`:

```js
const APP_VERSION = "3.2.204-beta";
```

(vorher: `"3.2.203-beta"`)

---

## Schritt 2 — i18n DE: `i18n/de.js`

### 2.1 `optMan` umbenennen

Zeile ~116, vorher:
```js
    optMan: "Manuell",
```
Nachher:
```js
    optMan: "Spezial: Manuell",
```

### 2.2 Neue Keys `optSel` und `runExplSel`

Direkt nach `optMan` einfügen (also nach Z. ~116):

```js
    optSel: "Spezial: Round Robin mit Vorauswahl",
    runExplSel: "Round Robin nur über die ausgewählten Elektroden. Es werden alle Paare gespielt, in denen mindestens eine der gewählten Elektroden vorkommt; alle anderen Paare bleiben außen vor. Nützlich zum gezielten Nachmessen einzelner Elektroden. Kein Fortsetzen über Stop hinaus.",
```

### 2.3 Neue Keys für Popup-Texte

In `i18n/de.js` am Ende (innerhalb des `Object.assign(L.de, { … })`) ergänzen — Position ist egal, solange im selben Objekt:

```js
    selDlgTitle: "Elektroden für Round Robin auswählen",
    selDlgHint: "Wählen Sie die Elektroden aus, die Sie gezielt prüfen wollen.",
    selDlgEmpty: "Bitte mindestens eine Elektrode auswählen.",
    selDlgConfirm: "Bestätigen",
    selDlgCancel: "Abbrechen",
    selSummaryEmpty: "Keine Auswahl getroffen.",
    selSummaryPrefix: "Auswahl:",
    selChange: "Auswahl ändern…",
    selectiveEnd: "Spezial-Round-Robin beendet: keine Paare mit den gewählten Elektroden mehr verfügbar.",
```

---

## Schritt 3 — i18n EN/FR/ES: `optMan` umbenennen

Triviale Konsistenz-Änderung (analog zur Vollständig-Umbenennung in BA 203).

`i18n/en.js` Zeile ~116:
```js
    optMan: "Special: Manual",
```

`i18n/fr.js` Zeile ~116:
```js
    optMan: "Spécial : Manuel",
```

`i18n/es.js` Zeile ~116:
```js
    optMan: "Especial: Manual",
```

(Die neuen Keys `optSel`, `runExplSel` und die Popup-Strings werden **nicht** in EN/FR/ES angelegt — Fallback auf DE genügt.)

---

## Schritt 4 — Verfahrens-Wert in test.js registrieren

Datei `js/test.js`, in der `testCfg.presets.rowMode.runOptions` (Zeile ~1201):

Vorher:
```js
        runOptions: [['full','optFull'],['conv_fast','optCF'],['manual','optMan']]
```
Nachher:
```js
        runOptions: [['full','optFull'],['conv_fast','optCF'],['selective','optSel'],['manual','optMan']]
```

(Reihenfolge bewußt: Round Robin → Konvergenz → Spezial-Round-Robin → Spezial-Manuell.)

---

## Schritt 5 — Auswahl-Status und Popup-Funktion

Datei `js/test.js`, oberhalb des DOMContentLoaded-Handlers (z. B. nach den Slider-Helfern, ca. Zeile ~700, in einem neuen Abschnittsblock):

```js
// ============================================================
// SELEKTIVES ROUND ROBIN — Elektroden-Vorauswahl
// (BA 204) — Session-only, kein Resume, kein Persistieren.
// ============================================================
let selectiveElectrodes = [];  // Set ausgewählter Elektroden-Indizes für den aktuellen Lauf

function _selectivePairsFromRR(roundPairs) {
  if (!selectiveElectrodes.length) return [];
  const sel = new Set(selectiveElectrodes);
  const actSet = new Set(actEl());
  return roundPairs.filter(([a, b]) =>
    actSet.has(a) && actSet.has(b) && (sel.has(a) || sel.has(b))
  );
}

function _selectiveUpdateSummary() {
  if (!testEls || !testEls.selSummary) return;
  if (!selectiveElectrodes.length) {
    testEls.selSummary.textContent = t('selSummaryEmpty');
  } else {
    const list = selectiveElectrodes
      .slice()
      .sort((x, y) => x - y)
      .map(i => dEN(i))
      .join(', ');
    testEls.selSummary.textContent = t('selSummaryPrefix') + ' ' + list;
  }
}

function _selectiveOpenDialog() {
  // Modal-Aufbau on the fly. Inhalt: Hinweis, Checkbox-Liste, Bestätigen/Abbrechen.
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  const dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:280px;max-width:90vw;max-height:85vh;overflow:auto;' +
    'box-shadow:0 10px 30px rgba(0,0,0,.3);';

  const title = document.createElement('h3');
  title.textContent = t('selDlgTitle');
  title.style.cssText = 'margin:0 0 10px 0;font-size:1.05em;';
  dlg.appendChild(title);

  const hint = document.createElement('p');
  hint.textContent = t('selDlgHint');
  hint.style.cssText = 'margin:0 0 12px 0;font-size:.92em;';
  dlg.appendChild(hint);

  const errBox = document.createElement('div');
  errBox.style.cssText = 'color:#c00;font-size:.88em;min-height:1.2em;margin-bottom:6px;';
  dlg.appendChild(errBox);

  const list = document.createElement('div');
  list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px 14px;margin-bottom:14px;';
  const actNow = new Set(actEl());
  const preSelected = new Set(selectiveElectrodes);
  const cbRefs = [];
  for (let i = 0; i < nEl; i++) {
    if (!actNow.has(i)) continue;
    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.92em;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(i);
    cb.checked = preSelected.has(i);
    cbRefs.push(cb);
    const sp = document.createElement('span');
    sp.textContent = dENPrefix() + dEN(i);
    lbl.append(cb, sp);
    list.appendChild(lbl);
  }
  dlg.appendChild(list);

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn';
  cancelBtn.textContent = t('selDlgCancel');
  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = t('selDlgConfirm');
  btnRow.append(cancelBtn, confirmBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  cancelBtn.addEventListener('click', close);
  confirmBtn.addEventListener('click', function () {
    const chosen = cbRefs.filter(c => c.checked).map(c => parseInt(c.value, 10));
    if (!chosen.length) {
      errBox.textContent = t('selDlgEmpty');
      return;
    }
    selectiveElectrodes = chosen;
    _selectiveUpdateSummary();
    close();
  });
}
```

---

## Schritt 6 — Auswahl-Anzeige in das Voreinstellungs-Panel einfügen

Datei `js/test.js`, im DOMContentLoaded-Handler nach `testEls = buildTestPanel(...)` (Zeile ~1237), neuen Block einfügen:

```js
  // Auswahl-Anzeige für Spezial-Round-Robin (BA 204)
  (function _selectiveInjectSummaryRow() {
    if (!testEls || !testEls.runSelect) return;
    const summaryRow = document.createElement('div');
    summaryRow.id = 'selSummaryRow';
    summaryRow.className = 'selective-summary-row';
    summaryRow.style.cssText =
      'margin-top:6px;display:none;align-items:center;gap:10px;font-size:.92em;';
    const summary = document.createElement('span');
    summary.id = 'selSummary';
    const changeBtn = document.createElement('button');
    changeBtn.type = 'button';
    changeBtn.className = 'btn btn-small';
    changeBtn.dataset.t = 'selChange';
    changeBtn.textContent = t('selChange');
    changeBtn.addEventListener('click', _selectiveOpenDialog);
    summaryRow.append(summary, changeBtn);
    // Direkt unter der Verfahren-Zeile einhängen
    const insertAfter = testEls.runSelect.closest('.controls-row') || testEls.runSelect.parentNode;
    if (insertAfter && insertAfter.parentNode) {
      insertAfter.parentNode.insertBefore(summaryRow, insertAfter.nextSibling);
    }
    testEls.selSummaryRow = summaryRow;
    testEls.selSummary = summary;
    testEls.selChangeBtn = changeBtn;
    _selectiveUpdateSummary();
  })();
```

---

## Schritt 7 — Sichtbarkeit der Auswahl-Zeile koppeln + Auto-Öffnen des Popups

Datei `js/test.js`, den bestehenden `runSelect`-Change-Handler (Zeile ~1276) ergänzen:

Vorher:
```js
  if (testEls.runSelect) {
    testEls.runSelect.addEventListener('change', function() {
      if (testEls.manualSel)
        testEls.manualSel.classList.toggle('hidden', this.value !== 'manual');
      updateRunExplain();
    });
  }
```
Nachher:
```js
  if (testEls.runSelect) {
    testEls.runSelect.addEventListener('change', function() {
      if (testEls.manualSel)
        testEls.manualSel.classList.toggle('hidden', this.value !== 'manual');
      // BA 204: Auswahl-Zeile sichtbar, wenn Spezial-Round-Robin
      if (testEls.selSummaryRow) {
        const sel = this.value === 'selective';
        testEls.selSummaryRow.style.display = sel ? 'flex' : 'none';
        // beim ersten Anwählen ohne bestehende Auswahl direkt Popup öffnen
        if (sel && !selectiveElectrodes.length) _selectiveOpenDialog();
      }
      updateRunExplain();
    });
  }
```

Außerdem in `updateRunExplain()` (Zeile ~1165) den neuen Verfahren-Eintrag berücksichtigen:

Vorher:
```js
  const explain = {
    full: t("runExplFull"),
    conv_fast: t("runExplCF"),
    manual: t("runExplMan"),
  };
```
Nachher:
```js
  const explain = {
    full: t("runExplFull"),
    conv_fast: t("runExplCF"),
    selective: t("runExplSel"),
    manual: t("runExplMan"),
  };
```

---

## Schritt 8 — Start-Logik in `startTest()` erweitern

Datei `js/test.js`, in `startTest()` (Zeile ~786). Innerhalb der Funktion, **nach** der bestehenden BA-155-Sperre und vor dem `pt === "full"`-Zweig, neuen Block einfügen:

```js
  // BA 204: Spezial-Round-Robin mit Vorauswahl
  if (pt === "selective") {
    if (!selectiveElectrodes.length) {
      alert(t('selDlgEmpty'));
      _selectiveOpenDialog();
      return;
    }
    // Auswahl auf aktive Elektroden eingrenzen (z.B. wenn zwischen Auswahl und Start eine ausgeschlossen wurde)
    const actSet0 = new Set(actEl());
    selectiveElectrodes = selectiveElectrodes.filter(i => actSet0.has(i));
    _selectiveUpdateSummary();
    if (!selectiveElectrodes.length) {
      alert(t('selDlgEmpty'));
      _selectiveOpenDialog();
      return;
    }
    const rrTable = ROUND_ROBIN[nEl];
    let pairs;
    if (!rrTable) {
      // Fallback: alle Paare aus allPairs() filtern
      const sel = new Set(selectiveElectrodes);
      pairs = allPairs().filter(([a, b]) => sel.has(a) || sel.has(b));
    } else {
      // Über alle Round-Robin-Runden hinweg sammeln, gefiltert auf Auswahl
      pairs = [];
      for (let r = 0; r < rrTable.length; r++) {
        const filtered = _selectivePairsFromRR(rrTable[r]);
        for (const p of filtered) pairs.push(p);
      }
    }
    if (!pairs.length) {
      alert(t('selectiveEnd'));
      return;
    }
    testPairs = randAB(shuffle(pairs));
    testIdx = 0;
    undoSt = [];
    testAct = true;
    curPlayed = false;
    compCnt = 0;
    convRnd = 0;
    tStart = Date.now();
    testEls.startBtn.disabled = true;
    testEls.stopBtn.disabled = false;
    testEls.testBox.hidden = false;
    if (testEls.subTitle) testEls.subTitle.textContent = t("testRunningTitle") || "";
    if (testEls.progressText) testEls.progressText.textContent = "";
    lockTestTabs(true, 'test');
    startTmr();
    showMode();
    showCurPair();
    return;
  }
```

---

## Schritt 9 — Reaktion auf Ausschluß während des Laufs

Im selektiven Modus soll der Test enden, wenn nach einem Ausschluß keine offenen Paare mehr übrig sind (Paare, in denen ≥1 ausgewählte Elektrode + beide aktiv).

In `_testRequestExcl` (oder der Stelle, an der nach Ausschluß die verbleibenden Paare neu bestimmt werden — per Suche `actSet`, `testPairs`, Filter in test.js prüfen): nach dem Filter zusätzlich für den selektiven Modus:

```js
  // BA 204: Im selektiven Modus auch auf selectiveElectrodes filtern
  const ptNow = testEls && testEls.runSelect ? testEls.runSelect.value : '';
  if (ptNow === 'selective') {
    const sel = new Set(selectiveElectrodes);
    const newPairs = testPairs
      .slice(testIdx)
      .filter(([a, b]) => sel.has(a) || sel.has(b));
    if (!newPairs.length) {
      alert(t('selectiveEnd'));
      endTest();
      renderResults();
      return;
    }
    testPairs = newPairs;
    testIdx = 0;
  }
```

**Hinweis an Sonnet**: Bestehende Filter-Logik nach Ausschluß ist im Code zu finden. Falls die Stelle nicht eindeutig ist, in einer Eingangsanalyse zuerst per `grep -n` nach allen Stellen in `test.js` suchen, die `testPairs` nach Ausschluß neu setzen, und den Patch dort einbauen, wo der Lauf-Modus geprüft wird. Akzeptanztest 6 weist nach, ob es funktioniert.

---

## Schritt 10 — Reset bei Test-Ende

Datei `js/test.js`, in `endTest()` (Zeile ~860). Ergänzen: Die selektive Auswahl **bleibt** über `endTest()` erhalten (sonst müßte der User sie für jeden Probedurchgang neu setzen). Sie wird nur explizit über das Popup geändert oder gelöscht. Falls in Zukunft ein „Reset"-Verhalten gewünscht ist, bitte separat anfragen.

**Hier in BA 204**: kein Reset nötig. Schritt 10 ist Doku-Klarstellung, kein Code-Schritt.

---

## Schritt 11 — Spec aktualisieren

Datei `docs/spec/02-messung.md`, im Abschnitt **Sub-Tab 1 — Elektrodenlautstärke ausgleichen**:

Die Zeile mit den Testverfahren (nach BA 203 sollte sie lauten: `**Testverfahren**: Round Robin (alle Paare) / Konvergenz / manuell`) ergänzen um den neuen Eintrag:

> **Testverfahren**: Round Robin (alle Paare) / Konvergenz / Spezial: Round Robin mit Vorauswahl / Spezial: Manuell

Direkt darunter einen kurzen neuen Abschnitt **„Spezial: Round Robin mit Vorauswahl"** einfügen mit ca. folgendem Inhalt:

> - Round-Robin-Lauf, gefiltert auf eine vom Nutzer per Popup gewählte Untermenge aktiver Elektroden.
> - Es werden alle Paare gespielt, in denen mindestens eine gewählte Elektrode vorkommt; alle anderen Paare bleiben außen vor.
> - Kein Resume — jeder Start beginnt frisch. Die Auswahl bleibt session-weit erhalten und kann über „Auswahl ändern…" jederzeit überarbeitet werden.
> - Bei Elektroden-Ausschluß während des Laufs wird die Auswahl entsprechend reduziert; bleibt kein passendes Paar mehr, endet der Test.

---

## Akzeptanztest (vom Nutzer per Maus durchzugehen)

1. Browser-Cache leeren, Tool öffnen. Versions-Anzeige `v3.2.204-beta`.
2. Reiter **Messungen → Elektrodenlautstärke**. Verfahren-Dropdown enthält in der Reihenfolge: „Round Robin (alle Paare)", „Konvergenz", **„Spezial: Round Robin mit Vorauswahl"**, **„Spezial: Manuell"**.
3. Auf **„Spezial: Round Robin mit Vorauswahl"** umschalten → Popup öffnet sich automatisch mit dem Titel „Elektroden für Round Robin auswählen", dem Hinweistext, einer Checkbox-Liste aller aktiven Elektroden (initial alle leer) und den Schaltflächen „Abbrechen" / „Bestätigen".
4. Auf „Bestätigen" ohne Auswahl klicken → rote Fehlermeldung „Bitte mindestens eine Elektrode auswählen.", Popup bleibt offen.
5. Eine Elektrode (z. B. E5) ankreuzen, „Bestätigen" → Popup schließt; unterhalb des Verfahren-Dropdowns erscheint die Zeile „Auswahl: E5" mit Button „Auswahl ändern…".
6. Test starten → es werden nur Paare mit E5 vorgelegt (insgesamt 11 Paare bei nEl=12); zwischen den Paaren wird zufällig randomisiert. Slider funktioniert wie üblich, Bestätigen-Button speichert. Nach dem letzten Paar endet der Test automatisch.
7. „Spezial: Round Robin mit Vorauswahl" erneut auswählen, jetzt zwei Elektroden ankreuzen (z. B. E5 und E8). Test starten → es kommen alle Paare mit E5 oder E8 (= 11 + 11 − 1 = 21 Paare). Paar (E5,E8) erscheint genau einmal.
8. Während eines laufenden Auswahl-Tests die einzige verbleibende Auswahl-Elektrode per „Elektrode ausschließen" entfernen → Test endet mit Meldung „Spezial-Round-Robin beendet: keine Paare mit den gewählten Elektroden mehr verfügbar."
9. „Spezial: Manuell" anwählen → manA/manB-Dropdowns werden sichtbar wie bisher; Verhalten unverändert.
10. Auf „Round Robin (alle Paare)" zurückwechseln → Auswahl-Zeile verschwindet wieder. „Round Robin"-Verhalten wie bisher; insbesondere bestehender Resume-Stand (Runde X von Y) ist intakt geblieben.
11. Sprache auf EN/FR/ES umschalten → „Spezial: Manuell" entsprechend übersetzt; „Spezial: Round Robin mit Vorauswahl" und die Popup-Texte erscheinen auf Deutsch (Fallback). Diagnose-Konsole wirft keine i18n-Fehler.

---

## Selbstprüfung an Sonnet

Vor der Fertig-Meldung jeden Punkt einzeln durchgehen und „erfüllt / nicht erfüllt / unklar" + Datei:Zeile melden:

- [ ] `version.js` zeigt `3.2.204-beta`.
- [ ] In `i18n/de.js` existiert `optMan: "Spezial: Manuell"` (überschrieben, nicht doppelt vorhanden).
- [ ] In `i18n/en.js`, `fr.js`, `es.js` ist `optMan` analog umbenannt.
- [ ] In `i18n/de.js` existieren genau einmal: `optSel`, `runExplSel`, `selDlgTitle`, `selDlgHint`, `selDlgEmpty`, `selDlgConfirm`, `selDlgCancel`, `selSummaryEmpty`, `selSummaryPrefix`, `selChange`, `selectiveEnd`.
- [ ] In `i18n/en.js`/`fr.js`/`es.js` sind die obigen neuen Keys **nicht** vorhanden (oder bewußt leer gelassen) — Fallback nach DE.
- [ ] `runOptions` in `test.js` enthält `'selective'` zwischen `'conv_fast'` und `'manual'`.
- [ ] In `test.js` existiert genau eine `selectiveElectrodes`-Variable (kein versehentlicher Doppel-Deklaration in beiden v1/v2-Pfaden).
- [ ] `updateRunExplain()` kennt den Key `selective`.
- [ ] Popup-Funktion `_selectiveOpenDialog` legt das Modal nur einmal pro Aufruf an, entfernt es sauber bei Close (kein DOM-Leck nach Mehrfach-Öffnen).
- [ ] In der Browser-Konsole nach Reload kein Uncaught-Fehler, kein „undefined function".
- [ ] `docs/spec/02-messung.md` enthält die ergänzten Sätze zu „Spezial: Round Robin mit Vorauswahl".

---

## Folge-Anleitung (optional)

Mini-Anleitung „Übersetzungen Spezial-Round-Robin (EN/FR/ES)" wenn der Nutzer die deutsche GUI-Vorlage durchgesehen und freigegeben hat. Schlüssel: `optSel`, `runExplSel`, `selDlgTitle`, `selDlgHint`, `selDlgEmpty`, `selDlgConfirm`, `selDlgCancel`, `selSummaryEmpty`, `selSummaryPrefix`, `selChange`, `selectiveEnd`. Nicht jetzt mitziehen.
