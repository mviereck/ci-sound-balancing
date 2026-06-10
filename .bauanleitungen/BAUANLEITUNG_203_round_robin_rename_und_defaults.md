# BA 203 — Umbenennung „Vollständig" → „Round Robin" und drei Default-Änderungen

## Ziel

1. Den Verfahrens-Namen **„Vollständig"** im UI durchgängig durch **„Round Robin"** ersetzen (alle vier Sprachen: DE, EN, FR, ES).
2. Drei Default-Werte ändern:
   - Tondauer: 1000 ms → **400 ms**
   - Pause: 500 ms → **300 ms**
   - Tonfolge: ABA → **AB**

Die Umbenennung ist rein textuell — der technische i18n-Key `optFull` und der Verfahrens-Wert `'full'` bleiben unverändert. „Round Robin" wird in allen vier Sprachen identisch als Eigenname verwendet (kein Übersetzen).

Ausnahme von der Regel „nur deutsche Strings in Bauanleitungen": In dieser BA werden alle vier Sprachen direkt mitgepflegt, weil es sich um eine mechanische Begriffsersetzung handelt, nicht um neue Texte.

---

## Schritt 1 — Version bumpen

Datei `js/version.js`:

```js
const APP_VERSION = "3.2.203-beta";
```

(vorher: `"3.2.202-beta"`)

---

## Schritt 2 — i18n DE: `i18n/de.js`

### 2.1 Zeile 114 — `optFull`

Vorher:
```js
    optFull: "Vollständig (alle Paare)",
```
Nachher:
```js
    optFull: "Round Robin (alle Paare)",
```

### 2.2 Zeile 127 — `recommend`

In dem mehrzeiligen String alle drei Vorkommen von `„Vollständig"` durch `„Round Robin"` ersetzen. Die typographischen Anführungszeichen `„` und `"` bleiben unverändert. Es handelt sich um:

- `… Erst Testverfahren „Vollständig" durchführen …`
- `… „Vollständig" gliedert sich in Runden …`
- `… beim nächsten Start von „Vollständig" dort fortgesetzt …`

Jedes davon → `„Round Robin"`. Der Rest des Texts bleibt unverändert.

### 2.3 Zeile 203 — `resNotDoneDetail`

Vorher:
```js
    resNotDoneDetail: "Modus Vollständig: Runde {round} von {maxRounds}, {done} von {total} Paaren bestätigt.",
```
Nachher:
```js
    resNotDoneDetail: "Modus Round Robin: Runde {round} von {maxRounds}, {done} von {total} Paaren bestätigt.",
```

### 2.4 Zeile 372 — `archivMeasSweepNote`

Vorher:
```js
    archivMeasSweepNote: "Vollständig-Sweep angefangen: Runde {round}, bestätigte Paare {done} von {total}.",
```
Nachher:
```js
    archivMeasSweepNote: "Round-Robin-Sweep angefangen: Runde {round}, bestätigte Paare {done} von {total}.",
```

### 2.5 Zeile 871 — `testExplainRecommend`

Im String alle Vorkommen von `'Vollständig'` (mit einfachen ASCII-Quotes!) durch `'Round Robin'` ersetzen:

- `… Machen Sie erst einen Test 'Vollständig', dann …`

→ `… Machen Sie erst einen Test 'Round Robin', dann …`

### 2.6 Zeile 872 — `testExplainVarious`

Im String alle Vorkommen von `'Vollständig'` durch `'Round Robin'` ersetzen:

- `… Der Test 'Vollständig' läuft über einige Runden …`

→ `… Der Test 'Round Robin' läuft über einige Runden …`

---

## Schritt 3 — i18n EN: `i18n/en.js`

### 3.1 Zeile 114 — `optFull`

Vorher:
```js
    optFull: "Complete (all pairs)",
```
Nachher:
```js
    optFull: "Round Robin (all pairs)",
```

### 3.2 Zeile 127 — `recommend`

Alle drei Vorkommen von `„Complete"` durch `„Round Robin"` ersetzen. Die in der EN-Datei verwendeten typographischen Anführungszeichen (`„` und `"`) bleiben wie sie sind.

- `… First run the „Complete" test procedure …`
- `… „Complete" is divided into rounds …`
- `… the next start of „Complete" resumes …`

### 3.3 Zeile 203 — `resNotDoneDetail`

Vorher:
```js
    resNotDoneDetail: "Complete mode: round {round} of {maxRounds}, {done} of {total} pairs confirmed.",
```
Nachher:
```js
    resNotDoneDetail: "Round Robin mode: round {round} of {maxRounds}, {done} of {total} pairs confirmed.",
```

### 3.4 Zeile 325 — `archivMeasSweepNote`

Vorher:
```js
    archivMeasSweepNote: "Complete sweep started: round {round}, confirmed pairs {done} of {total}.",
```
Nachher:
```js
    archivMeasSweepNote: "Round Robin sweep started: round {round}, confirmed pairs {done} of {total}.",
```

### 3.5 Zeile 824 — `testExplainRecommend`

Im String das Vorkommen `'Complete'` → `'Round Robin'`:

- `… First run a 'Complete' test, then …` → `… First run a 'Round Robin' test, then …`

### 3.6 Zeile 825 — `testExplainVarious`

Im String das Vorkommen `'Complete'` → `'Round Robin'`:

- `… The 'Complete' test runs over several rounds …` → `… The 'Round Robin' test runs over several rounds …`

---

## Schritt 4 — i18n FR: `i18n/fr.js`

### 4.1 Zeile 114 — `optFull`

Vorher:
```js
    optFull: "Complet (toutes les paires)",
```
Nachher:
```js
    optFull: "Round Robin (toutes les paires)",
```

### 4.2 Zeile 127 — `recommend`

Alle drei Vorkommen von `« Complet »` durch `« Round Robin »` ersetzen. Französische Spitzwinkel-Anführungszeichen `«` und `»` bleiben.

### 4.3 Zeile 203 — `resNotDoneDetail`

Vorher:
```js
    resNotDoneDetail: "Mode Complet : tour {round} sur {maxRounds}, {done} sur {total} paires confirmées.",
```
Nachher:
```js
    resNotDoneDetail: "Mode Round Robin : tour {round} sur {maxRounds}, {done} sur {total} paires confirmées.",
```

### 4.4 `archivMeasSweepNote` (Zeile vermutlich um 325 — per Key suchen)

Per Key `archivMeasSweepNote` suchen. Falls vorhanden, das Wort `Complet` → `Round Robin` ersetzen (Format analog zu DE/EN). Falls der Eintrag in fr.js fehlt, kein Zwangs-Anlegen — Fallback auf DE greift.

### 4.5 Zeile 825 — `testExplainRecommend`

`« Complet »` → `« Round Robin »`

### 4.6 Zeile 826 — `testExplainVarious`

`« Complet »` → `« Round Robin »`

---

## Schritt 5 — i18n ES: `i18n/es.js`

### 5.1 Zeile 114 — `optFull`

Vorher:
```js
    optFull: "Completo (todos los pares)",
```
Nachher:
```js
    optFull: "Round Robin (todos los pares)",
```

### 5.2 Zeile 127 — `recommend`

Alle drei Vorkommen von `«Completo»` durch `«Round Robin»` ersetzen.

### 5.3 Zeile 203 — `resNotDoneDetail`

Vorher:
```js
    resNotDoneDetail: "Modo Completo: ronda {round} de {maxRounds}, {done} de {total} pares confirmados.",
```
Nachher:
```js
    resNotDoneDetail: "Modo Round Robin: ronda {round} de {maxRounds}, {done} de {total} pares confirmados.",
```

### 5.4 Zeile 326 — `archivMeasSweepNote`

Vorher:
```js
    archivMeasSweepNote: "Sweep Completo iniciado: ronda {round}, pares confirmados {done} de {total}.",
```
Nachher:
```js
    archivMeasSweepNote: "Sweep Round Robin iniciado: ronda {round}, pares confirmados {done} de {total}.",
```

### 5.5 Zeile 825 — `testExplainRecommend`

`«Completo»` → `«Round Robin»`

### 5.6 Zeile 826 — `testExplainVarious`

`«Completo»` → `«Round Robin»`

---

## Schritt 6 — Default-Werte ändern

### 6.1 Tonfolge-Default: `js/state-side.js` Zeile 684

Vorher:
```js
let globalSequence = "aba";       // "aba" | "ab"
```
Nachher:
```js
let globalSequence = "ab";        // "aba" | "ab"
```

### 6.2 Tondauer- und Pause-Default in `js/test-ui.js` (alte Test-UI, Zeilen ~208/212)

Vorher (Zeile 208):
```js
    durInput = makeNumInput('dur', 1000, 100, 3000, 50, 65);
```
Nachher:
```js
    durInput = makeNumInput('dur', 400, 100, 3000, 50, 65);
```

Vorher (Zeile 212):
```js
    pauseInput = makeNumInput('pau', 500, 50, 2000, 50, 65);
```
Nachher:
```js
    pauseInput = makeNumInput('pau', 300, 50, 2000, 50, 65);
```

### 6.3 Tondauer- und Pause-Default in `js/test-ui.js` (neue Test-UI v2, Zeilen ~847/856)

Vorher (Zeile ~847):
```js
      durInput = makeNumInput2('dur',
        dOpts.default || 1000, dOpts.min || 100, dOpts.max || 3000, dOpts.step || 50, 65);
```
Nachher:
```js
      durInput = makeNumInput2('dur',
        dOpts.default || 400, dOpts.min || 100, dOpts.max || 3000, dOpts.step || 50, 65);
```

Vorher (Zeile ~856):
```js
      pauseInput = makeNumInput2('pau',
        pOpts.default || 500, pOpts.min || 50, pOpts.max || 2000, pOpts.step || 50, 65);
```
Nachher:
```js
      pauseInput = makeNumInput2('pau',
        pOpts.default || 300, pOpts.min || 50, pOpts.max || 2000, pOpts.step || 50, 65);
```

---

## Schritt 7 — Spec-Update: `docs/spec/02-messung.md`

Im Kapitel sind aktuell mehrere Stellen mit „Vollständig" und „vollständig" (als Verfahrens-Bezeichner). Ändern, soweit es das **Verfahren** meint, nicht das Adjektiv im allgemeinen Sinn.

Konkret zu ändern (Zeilen circa, per Suche bestätigen):

- Zeile 75: `**Nur Test 1 im Modus „full" (Round-Robin)**` → bleibt (`„full"` ist technischer Wert)
- Zeile 91: `**Testverfahren**: vollständig (alle Paare) / Konvergenz schnell / manuell` → `**Testverfahren**: Round Robin (alle Paare) / Konvergenz / manuell`
- Zeile 117: `Wenn Modus „Vollständig" angefangen aber nicht abgeschlossen wurde,` → `Wenn Modus „Round Robin" angefangen aber nicht abgeschlossen wurde,`

Beim Suchen darauf achten: „Vollständigkeit", „vollständigem Durchlauf" etc. **NICHT** anfassen — das sind allgemeine Adjektive, kein Verfahrens-Name. Nur substantivischer Verfahrens-Name → Round Robin.

Ebenso „Konvergenz schnell" wurde inzwischen zu „Konvergenz" verkürzt (siehe i18n: `optCF: "Konvergenz"`). In Zeile 91 daher auch „schnell" streichen.

---

## Schritt 8 — Defaults-Hinweis in der Spec

In `docs/spec/02-messung.md`, Abschnitt **Globale Test-Einstellungen** (ab Zeile 11):

Zeile 22–23 enthält den Default-Hinweis zur Tonfolge:
> **Tonfolge** (`globalSequence`) — `'aba'` oder `'ab'`. Default `'aba'`. Vor dem Test wählbar, während des Tests fest.

Ändern in:
> **Tonfolge** (`globalSequence`) — `'aba'` oder `'ab'`. Default `'ab'`. Vor dem Test wählbar, während des Tests fest.

Falls in derselben Datei Defaults für **Tondauer** oder **Pause** ausdrücklich genannt sind: ebenfalls auf 400 ms / 300 ms aktualisieren. (Per Suche `1000` und `500` im Kapitel-Bereich „Voreinstellungen" prüfen — kann sein, daß sie nicht genannt sind. Wenn nicht genannt, kein Eintrag erzwingen.)

---

## Akzeptanztest (vom Nutzer per Maus durchzugehen)

1. Browser-Cache leeren / Hard-Reload, Tool öffnen.
2. Versions-Anzeige unten zeigt `v3.2.203-beta`.
3. Reiter **Messungen → Elektrodenlautstärke**:
   - Verfahren-Dropdown enthält jetzt **„Round Robin (alle Paare)"** statt „Vollständig (alle Paare)". Die anderen beiden Einträge unverändert („Konvergenz", „Manuell").
   - Tondauer-Feld zeigt initial **400** (statt 1000).
   - Pause-Feld zeigt initial **300** (statt 500).
   - Tonfolge-Dropdown steht initial auf **AB** (statt ABA).
4. Beschreibungs-/Empfehlungstexte (sowohl im Reiter selbst als auch im Sub-Tab) sprechen von „Round Robin", nicht mehr von „Vollständig".
5. Sprachen-Umschalter durchgehen: in EN, FR, ES erscheint im Dropdown ebenfalls **„Round Robin (…)"** mit der jeweils sprachspezifischen Klammer-Klammer-Übersetzung. Empfehlungs-Texte und Begleittexte ebenfalls „Round Robin".
6. Test starten im neuen Round-Robin-Modus — Verhalten unverändert (gleiche Paare, gleiche Reihenfolge-Mechanik, gleiches Resume).
7. Bestehende JSON-Datei mit Round-Robin-Sweep-Notiz laden: der „angefangen"-Hinweis (`archivMeasSweepNote`) erscheint mit „Round Robin" / „Round-Robin-Sweep" / „Sweep Round Robin" je nach Sprache.

---

## Selbstprüfung an Sonnet

Vor der Fertig-Meldung jeden der folgenden Punkte einzeln durchgehen und „erfüllt / nicht erfüllt / unklar" + Datei:Zeile melden:

- [ ] `version.js` zeigt `3.2.203-beta`.
- [ ] In `i18n/de.js` ist kein **Verfahrens-bezogenes** Vorkommen von „Vollständig" mehr (Vorkommen wie „Vollständigkeit", „vollständigem Durchlauf" dürfen bleiben — sind keine Verfahrens-Namen).
- [ ] In `i18n/en.js` ist kein **Verfahrens-bezogenes** Vorkommen von „Complete" mehr (Adjektiv-Verwendungen dürfen bleiben).
- [ ] In `i18n/fr.js` ist kein **Verfahrens-bezogenes** Vorkommen von „Complet" mehr.
- [ ] In `i18n/es.js` ist kein **Verfahrens-bezogenes** Vorkommen von „Completo" mehr.
- [ ] `globalSequence` in `js/state-side.js` ist `"ab"`.
- [ ] In `js/test-ui.js` sind beide `makeNumInput`-Aufrufe für `dur` auf 400 und für `pau` auf 300 gesetzt — sowohl im alten Builder (Z. ~208/212) als auch im neuen Builder v2 (Z. ~847/856).
- [ ] `docs/spec/02-messung.md` Abschnitt **Testverfahren** und Hinweise auf den Modus zeigen „Round Robin"; der Tonfolge-Default-Hinweis steht auf `'ab'`.
- [ ] In den i18n-Strings keine ASCII-Doppelquotes versehentlich verschoben (jedes `"` am String-Ende noch da, kein Parser-Fehler in der Browser-Konsole nach Reload).

---

## Folge-Anleitung

BA 204 baut darauf auf (neues Verfahren „Spezial: Round Robin mit Vorauswahl" + Umbenennung „Manuell" → „Spezial: Manuell"). BA 204 erst nach erfolgreichem Abschluß und Bump von BA 203 angehen.
