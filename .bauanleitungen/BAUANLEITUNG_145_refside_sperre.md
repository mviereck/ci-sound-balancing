# BAUANLEITUNG 145 — refSelect-Sperre + fmRCDlg-Guard für Adaptivdaten

**Zieldatei:** `js/test-ui.js`, `js/freqmatch.js`, `js/version.js`  
**Voraussetzung:** keine Vorgänger-Bauanleitung  
**Version:** 3.0.144-beta → **3.0.145-beta**

---

## Kontext

Zwei verwandte Bugs:

1. **test-ui.js:** Das `refSelect`-Dropdown (Referenzseite) wird beim Teststart
   nicht gesperrt, obwohl `verfahrenSelect` gesperrt wird. Nutzer können die
   Referenzseite mitten im laufenden Test wechseln → Inkonsistenz zwischen
   laufendem Test und angezeigten Messdaten.

2. **freqmatch.js, fmRCDlg:** Der Dialog „Referenzseite wechseln — alle bisherigen
   Ergebnisse löschen?" erscheint nur wenn `fRes.length > 0` (klassische
   fRes-Ergebnisse). Adaptiv-Laufdaten in `sideData[*].freqmatchAdaptive.runs`
   bleiben ungeschützt — ein Seitenwechsel löscht sie kommentarlos.

---

## Schritt 1 — refSelect in `_startTest` sperren (test-ui.js)

Datei: `js/test-ui.js`

Suche in der Funktion `_startTest` die Zeile:
```js
    if (verfahrenSelect) verfahrenSelect.disabled = true;
```

Füge direkt **danach** ein:
```js
    if (refSelect) refSelect.disabled = true;
```

---

## Schritt 2 — refSelect in `_stopTest` entsperren (test-ui.js)

Datei: `js/test-ui.js`

Suche in der Funktion `_stopTest` die Zeile:
```js
    if (verfahrenSelect) verfahrenSelect.disabled = false;
```

Füge direkt **danach** ein:
```js
    if (refSelect) refSelect.disabled = false;
```

---

## Schritt 3 — `_fmHasAdaptiveData()` einführen (freqmatch.js)

Datei: `js/freqmatch.js`

Suche die Funktion `fmUpdateSliderModeAvail()`. Füge **direkt davor** ein:

```js
function _fmHasAdaptiveData() {
  return ['left', 'right'].some(function(side) {
    const fa = sideData[side] && sideData[side].freqmatchAdaptive;
    return !!(fa && Array.isArray(fa.runs) && fa.runs.some(function(r) {
      return r.tracks && Object.keys(r.tracks).some(function(k) {
        return r.tracks[k] && (r.tracks[k].trialCount || 0) > 0;
      });
    }));
  });
}
```

---

## Schritt 4 — fmRCDlg-Guard erweitern (freqmatch.js)

Datei: `js/freqmatch.js`, im `DOMContentLoaded`-Block

Suche den zweiten `refSelect.addEventListener('change', ...)` — erkennbar an dem
Zweig `if (fRes.length > 0)`. Ersetze die Bedingung:

**Vorher:**
```js
    if (fRes.length > 0) {
```

**Nachher:**
```js
    if (fRes.length > 0 || _fmHasAdaptiveData()) {
```

Die innere `fmRCOkBtn.onclick`-Aktion (`fRes.splice(...)` + `_fmClearPersist('left')` +
`_fmClearPersist('right')`) bleibt **unverändert** — `_fmClearPersist` setzt bereits
`sideData[side].freqmatchAdaptive = null`, also werden die Adaptivdaten korrekt
mitgelöscht.

---

## Schritt 5 — Version hochzählen

Datei: `js/version.js`

```js
const APP_VERSION = "3.0.145-beta";
```

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Zeile einzeln prüfen und melden
(erfüllt / nicht erfüllt / unklar, mit Datei+Zeile):

1. In `_startTest`: Ist `if (refSelect) refSelect.disabled = true;` nach der
   `verfahrenSelect`-Zeile eingefügt?
2. In `_stopTest`: Ist `if (refSelect) refSelect.disabled = false;` nach der
   `verfahrenSelect`-Zeile eingefügt?
3. Existiert `_fmHasAdaptiveData()` in `freqmatch.js` (prüft beide Seiten)?
4. Verwendet der fmRCDlg-Guard jetzt `|| _fmHasAdaptiveData()`?
5. Ist `APP_VERSION` auf `"3.0.145-beta"` gesetzt?

---

## Akzeptanztest

1. App laden, Tab **Messungen → Frequenzabgleich** öffnen.
2. Adaptive Test starten (▶ Start). Während der Test läuft:
   - Das Dropdown **Referenzseite** ist ausgegraut (nicht bedienbar). ✓
3. Test beenden (◼ Stop). Dropdown ist wieder bedienbar. ✓
4. Einen Debug-Sim-Lauf ausführen: Browser-Konsole:
   ```js
   fmRunDebugSim()
   ```
   Danach im Dropdown **Referenzseite** wechseln (links ↔ rechts).
   - Es erscheint ein Bestätigungs-Dialog „alle bisherigen Ergebnisse löschen?". ✓
5. Dialog mit **Abbrechen** schließen → kein Datenverlust. ✓
6. Dialog mit **Ja** bestätigen → Wechsel vollzogen, keine Konsolenfehler. ✓
