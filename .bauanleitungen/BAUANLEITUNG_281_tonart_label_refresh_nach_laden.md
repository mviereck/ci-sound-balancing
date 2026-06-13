# BA 281 — Tonart-Anzeige im Test-Kopf nach dem Laden aktualisieren

Ziel-Version nach Build: **0.4.281-beta**

## Problem

In den Mess-Tests (Frequenzabgleich, Elektrodenlautstärke,
Stereo-Balance) sitzt im Kopfbereich ein Button, der die aktuell
gewählte Tonart anzeigt (z.B. „CI-Test flach" / „CI-Test Grundton").
Klickt man ihn an, öffnet sich die Tonauswahl-Modalbox.

**Bug:** Nach dem Laden eines gespeicherten Stands zeigt der
Kopf-Button eine andere Tonart als die Modalbox. Konkret beobachtet:
Kopf zeigt „CI-Test Grundton", Modalbox zeigt „CI-Test flach".

**Ursache:** Beide lesen dieselbe Quelle (`toneType_freqmatch` /
`toneType_test` / `toneType_balance`), aber zu unterschiedlichen
Zeitpunkten:

- Die Modalbox liest den Wert **live beim Öffnen** über `getToneType()`
  → zeigt immer den aktuellen Stand. (richtig)
- Das Kopf-Button-Label wird **nur einmal beim Seitenaufbau**
  geschrieben (im `DOMContentLoaded`-Handler, der `buildTestPanel`
  aufruft) und danach ausschließlich, wenn die Modalbox geschlossen
  wird. Nach dem Laden eines Stands wird es **nicht** aktualisiert.

Das Test-Panel exponiert dafür bereits eine Refresh-Funktion
(`testEls.header.tonePopupUpdate` in `js/test-ui.js`, Z. 382 — setzt
das Button-Label aus `getToneType()` neu). Sie wird bisher nirgends
von außen aufgerufen. Genau dieser Aufruf fehlt nach dem Laden.

**Vorbild im Code:** Für die Elektrodenauswahl-Zusammenfassung im
Kopf existiert bereits exakt dieses Muster — drei modullokale
Wrapper-Funktionen `…RefreshElectrodeSelectionSummary()`, die in den
beiden Lade-Pfaden (`file.js` = Datei laden, `init.js` =
sessionStorage-Wiederherstellung) aufgerufen werden. Wir bauen die
Tonart-Label-Variante exakt analog dazu.

**API-Verifikation (erledigt):** `js/test-ui.js` exponiert das
Header-Refs-Objekt als `header:` im Rückgabe-Objekt (Z. 1287). Die
Refresh-Funktion heißt dort `tonePopupUpdate` (Z. 382). Volle Kette
von außen: `<modul>Els.header.tonePopupUpdate`.

---

## Schritt 1 — `js/test.js`: Wrapper-Funktion ergänzen

Direkt **nach** der bestehenden Funktion
`testRefreshElectrodeSelectionSummary()` (aktuell Z. 1345–1349, endet
mit der schließenden `}`) eine analoge Funktion einfügen:

Bestehender Anker (unverändert lassen):

```js
function testRefreshElectrodeSelectionSummary() {
  if (testEls && testEls.header && typeof testEls.header.electrodeSelectionUpdate === 'function') {
    testEls.header.electrodeSelectionUpdate();
  }
}
```

Direkt darunter neu einfügen:

```js
// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function testRefreshToneTypeLabel() {
  if (testEls && testEls.header && typeof testEls.header.tonePopupUpdate === 'function') {
    testEls.header.tonePopupUpdate();
  }
}
```

## Schritt 2 — `js/freqmatch.js`: Wrapper-Funktion ergänzen

Direkt **nach** `fmRefreshElectrodeSelectionSummary()` (aktuell
Z. 1352–1356) einfügen:

```js
// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function fmRefreshToneTypeLabel() {
  if (fmEls && fmEls.header && typeof fmEls.header.tonePopupUpdate === 'function') {
    fmEls.header.tonePopupUpdate();
  }
}
```

## Schritt 3 — `js/lr-balance.js`: Wrapper-Funktion ergänzen

Direkt **nach** `lrRefreshElectrodeSelectionSummary()` (aktuell
Z. 995–999) einfügen:

```js
// BA 281: Tonart-Label im Kopf nach Laden eines Stands aktualisieren.
function lrRefreshToneTypeLabel() {
  if (lrEls && lrEls.header && typeof lrEls.header.tonePopupUpdate === 'function') {
    lrEls.header.tonePopupUpdate();
  }
}
```

## Schritt 4 — `js/file.js`: Aufrufe im Refresh-Block (Datei laden)

Im UI-Refresh-Block am Ende der Lade-Funktion stehen bereits drei
Zeilen mit den `…RefreshElectrodeSelectionSummary()`-Aufrufen
(aktuell Z. 992–994). Anker (unverändert lassen):

```js
  if (typeof lrRefreshElectrodeSelectionSummary === "function") lrRefreshElectrodeSelectionSummary();
  if (typeof fmRefreshElectrodeSelectionSummary === "function") fmRefreshElectrodeSelectionSummary();
  if (typeof testRefreshElectrodeSelectionSummary === "function") testRefreshElectrodeSelectionSummary();
```

Direkt **darunter** drei neue Zeilen einfügen:

```js
  if (typeof lrRefreshToneTypeLabel === "function") lrRefreshToneTypeLabel();
  if (typeof fmRefreshToneTypeLabel === "function") fmRefreshToneTypeLabel();
  if (typeof testRefreshToneTypeLabel === "function") testRefreshToneTypeLabel();
```

(Einrückung: 2 Leerzeichen, wie die Anker-Zeilen.)

## Schritt 5 — `js/init.js`: Aufrufe im Refresh-Block (sessionStorage-Restore)

Im sessionStorage-Wiederherstellungs-Block stehen dieselben drei
Anker-Zeilen (aktuell Z. 840–842), hier mit 6 Leerzeichen Einrückung.
Anker (unverändert lassen):

```js
      if (typeof lrRefreshElectrodeSelectionSummary === "function") lrRefreshElectrodeSelectionSummary();
      if (typeof fmRefreshElectrodeSelectionSummary === "function") fmRefreshElectrodeSelectionSummary();
      if (typeof testRefreshElectrodeSelectionSummary === "function") testRefreshElectrodeSelectionSummary();
```

Direkt **darunter** einfügen (ebenfalls 6 Leerzeichen Einrückung):

```js
      if (typeof lrRefreshToneTypeLabel === "function") lrRefreshToneTypeLabel();
      if (typeof fmRefreshToneTypeLabel === "function") fmRefreshToneTypeLabel();
      if (typeof testRefreshToneTypeLabel === "function") testRefreshToneTypeLabel();
```

> Hinweis: Im sessionStorage-Pfad wird die Tonart der
> Elektrodenlautstärke aktuell noch nicht zurückgelesen (separater
> Befund, BA 282). Der Refresh-Aufruf schadet dort trotzdem nicht
> — er setzt das Label auf den dann aktuellen Wert. Sobald der
> Restore-Pfad (BA 282) vervollständigt ist, profitiert er
> automatisch.

## Schritt 6 — `js/version.js`: Version hochzählen

`APP_VERSION` von `"0.4.280.2-beta"` auf `"0.4.281-beta"` setzen.

```js
const APP_VERSION = "0.4.281-beta";
```

---

## Was NICHT angefaßt wird

- Keine UI-Texte geändert → **keine** i18n-Arbeit (en/fr/es bleiben
  unberührt).
- Keine neuen globalen Variablen, keine neuen Module, keine neue
  zentrale Funktion → **keine** Änderung an `docs/CODESTRUKTUR.md`
  nötig (die drei neuen Funktionen sind modullokale Wrapper exakt
  analog zu den bestehenden `…RefreshElectrodeSelectionSummary`).
- Im Code **ausschließlich** ASCII-Anführungszeichen `"` und `'`
  verwenden (die typeof-Guards nutzen ASCII-Single-Quotes — so
  lassen).

---

## Akzeptanztest (vom Nutzer durchklickbar)

Vorbereitung: einen gespeicherten Stand bereithalten, in dem die
Tonart für die Elektrodenlautstärke **abweichend vom Default**
eingestellt war (Default ist „CI-Test Grundton"; im Stand also z.B.
„CI-Test flach").

1. Tool frisch laden (oder Browser-Cache leeren). Reiter **Messungen
   → Elektrodenlautstärke**. Verfahren **Round Robin**.
   → Kopf zeigt die Default-Tonart „CI-Test Grundton".
2. Gespeicherten Stand laden (Datei-Laden-Button).
   → **Erwartet:** Der Tonart-Button im Kopf zeigt jetzt „CI-Test
     flach" (den geladenen Wert) — **nicht** mehr „CI-Test Grundton".
3. Auf den Tonart-Button klicken.
   → **Erwartet:** Die Tonauswahl-Modalbox zeigt **dieselbe** Tonart
     wie der Kopf-Button („CI-Test flach"). Kopf und Modalbox stimmen
     überein.
4. Gegenprobe Frequenzabgleich: Reiter **Messungen →
   Frequenzabgleich**. Falls im Stand dort eine abweichende Tonart
   gespeichert war → Kopf-Button zeigt den geladenen Wert, stimmt mit
   der Modalbox überein.
5. Gegenprobe Stereo-Balance: analog zu Schritt 4 für **Messungen →
   Stereo-Balance**.
6. Regressionsprobe: ohne Laden eine Tonart über die Modalbox ändern
   und schließen → Kopf-Button übernimmt den neuen Wert wie bisher
   (unverändertes Verhalten).

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen und
mit Datei-/Zeilenangabe melden: erfüllt / nicht erfüllt / unklar.
Zusätzlich prüfen und melden:

- Sind die drei neuen Wrapper-Funktionen syntaktisch korrekt direkt
  hinter den jeweiligen `…RefreshElectrodeSelectionSummary`-Funktionen
  platziert (nicht versehentlich innerhalb)?
- Stehen die drei neuen Aufruf-Zeilen in **beiden** Refresh-Blöcken
  (`file.js` und `init.js`) mit korrekter Einrückung (2 bzw. 6
  Leerzeichen)?
- Ist `APP_VERSION` exakt `"0.4.281-beta"`?
- Wurde der Property-Name `tonePopupUpdate` (nicht erfunden) verwendet
  — gegenprüfbar per `grep -n "tonePopupUpdate" js/test-ui.js`?
