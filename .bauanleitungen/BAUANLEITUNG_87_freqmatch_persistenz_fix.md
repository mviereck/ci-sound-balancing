# Bauanleitung 87 — Frequenzabgleich: Persistenz-Fix

Track-Daten des adaptiven Frequenzabgleichs gehen aktuell verloren,
sobald der Browser-Tab neu geladen wird, oder eine Datei
gespeichert/geladen wird. Ursache: drei Stellen schreiben
`freqmatchAdaptive` **nicht** in ihre Serialisierung. Außerdem
werden im Klassifikations-Code bei `not-perceivable` Werte aktiv
auf `null` gesetzt, obwohl sie erhalten bleiben sollten.

Dieser Fix behebt alle vier Punkte. Danach überleben Track-Daten
(Reversals, Match, Residuum, Catch-Statistik) Reload und
Datei-Roundtrip. Das ist Voraussetzung für den kommenden
Konvergenz-Modus (BA 88+).

## Version

Am Anfang oder Ende des Builds — **nicht in der Mitte** — in
`js/version.js` setzen:

```js
const APP_VERSION = "3.0.87-beta";
```

---

## Fix 1 — Auto-Save: `freqmatchAdaptive` ergänzen

**Datei:** `js/init.js`

Im `setInterval`-Block (alle 5 Sekunden Auto-Save nach localStorage)
fehlt `freqmatchAdaptive` auf beiden Seiten.

### Left-Seite

Suche den Block mit `implant: sideData.left.implant,` (ca. Z. 790)
innerhalb des `sides.left`-Objekts. Direkt **nach** dieser Zeile
einfügen:

```js
              freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
```

Das vollständige Ende des `left`-Blocks sieht danach so aus:

```js
              fullSweepDonePairs: sideData.left.fullSweepDonePairs,
              implant: sideData.left.implant,
              freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
            },
```

### Right-Seite

Suche entsprechend `implant: sideData.right.implant,` im
`sides.right`-Block. Direkt **nach** dieser Zeile einfügen:

```js
              freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
```

Das vollständige Ende des `right`-Blocks sieht danach so aus:

```js
              fullSweepDonePairs: sideData.right.fullSweepDonePairs,
              implant: sideData.right.implant,
              freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
            },
```

---

## Fix 2 — Datei-Save: `freqmatchAdaptive` ergänzen

**Datei:** `js/file.js`

Die Spar-Funktion (ab ca. Z. 95) baut das JSON-Objekt für den
Datei-Download. Auch hier fehlt `freqmatchAdaptive`.

### Left-Seite

Suche `implant: sideData.left.implant,` im `sides.left`-Block
(ca. Z. 114). Direkt **nach** dieser Zeile einfügen:

```js
        freqmatchAdaptive: sideData.left.freqmatchAdaptive || null,
```

### Right-Seite

Suche `implant: sideData.right.implant,` im `sides.right`-Block
(ca. Z. 134). Direkt **nach** dieser Zeile einfügen:

```js
        freqmatchAdaptive: sideData.right.freqmatchAdaptive || null,
```

**Hinweis:** Der Load-Pfad (`js/state-side.js:221`) liest bereits
`d.freqmatchAdaptive || null` — das bleibt unverändert.

---

## Fix 3 — Klassifikation: `not-perceivable` setzt match/residual nicht mehr auf null

**Datei:** `js/freqmatch-staircase.js`

In `_fmCheckAndUpdateStatus` (Z. ~209) gibt es diesen Block
(Z. ~213-222):

**Vorher:**
```js
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH
      && track.trialCount >= FM_NOT_PERC_MIN_TRIAL
      && track.reversals.length < FM_REVERSALS_REQ) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status   = 'not-perceivable';
      track.match    = null;
      track.residual = null;
      return track.status;
    }
  }
```

**Nachher:**
```js
  if (track.catchTotal >= FM_NOT_PERC_MIN_CATCH
      && track.trialCount >= FM_NOT_PERC_MIN_TRIAL
      && track.reversals.length < FM_REVERSALS_REQ) {
    const errRate = track.catchErrors / track.catchTotal;
    if (errRate >= FM_NOT_PERC_ERR_RATE) {
      track.status = 'not-perceivable';
      return track.status;
    }
  }
```

Die beiden Zeilen `track.match = null` und `track.residual = null`
werden **ersatzlos entfernt**. Bei frischen Tracks sind `match` und
`residual` von `fmCreateTrack` bereits `null` — nichts geht verloren.
Bei Tracks mit 2–5 Reversals bleibt `currentOffset` als Startwert für
einen späteren Konvergenz-Lauf erhalten, und `fmComputeProvisional`
kann die vorhandenen Reversals weiterhin für eine provisorische
Anzeige nutzen.

---

## Fix 4 — Löschen-Confirm-Text schärfen

**Datei:** `i18n/de.js`

Der Bestätigungstext für den Löschen-Knopf im Reiter Meßergebnisse
klingt zu neutral. Er soll deutlich machen, daß auch die Track-
Rohdaten unwiederbringlich gelöscht werden.

Suche (ca. Z. 654):
```js
    fmrClearConfirm: "Alle Frequenzabgleich-Ergebnisse löschen?",
```

Ersetzen durch:
```js
    fmrClearConfirm: "Alle Frequenzabgleich-Ergebnisse und Track-Rohdaten löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
```

---

## Akzeptanztest

### 1 — Auto-Save überlebt Reload

1. Browser öffnen, App laden.
2. Einen kurzen adaptiven Lauf starten und mindestens 5 Trials
   absolvieren (muss nicht fertig sein).
3. Konsole öffnen, eingeben:
   ```js
   ['left','right'].forEach(s=>{const fa=sideData[s]&&sideData[s].freqmatchAdaptive;console.log(s,fa?Object.keys(fa.tracks||{}).length+' tracks':'leer');});
   ```
   → erwartet: mind. eine Seite mit > 0 tracks.
4. Tab neu laden (F5).
5. Konsolen-Befehl erneut ausführen.
   → **erwartet: dieselbe Seite zeigt wieder > 0 tracks** (nicht „leer").

### 2 — Datei-Roundtrip überlebt Save/Load

1. Adaptiven Lauf abschließen oder zumindest 5+ Trials absolvieren.
2. Datei speichern (Download-Button).
3. Seite neu laden, Datei wieder laden.
4. Konsole prüfen wie in Test 1.
   → **erwartet: tracks sind nach dem Laden wieder vorhanden**.

### 3 — `not-perceivable` löscht keine Daten mehr

Dieser Test setzt voraus, daß eine Elektrode als `not-perceivable`
klassifiziert wird. Falls das im aktuellen Lauf nicht vorkommt,
Diagnose-Einzeiler aus der Konsole:

```js
Object.entries(sideData.right.freqmatchAdaptive.tracks)
  .forEach(([i,t])=>console.log('E'+i,t.status,
    'match:',t.match,'resid:',t.residual,'revs:',t.reversals.length));
```

Für jeden Track mit `status: 'not-perceivable'`:
- `match` und `residual` dürfen **null** sein (weil < 6 Reversals),
  aber sie dürfen **nicht** fälschlich einen Wert haben, der durch
  die Lösch-Zeile überschrieben worden wäre.
- `reversals` und `currentOffset` müssen einen sinnvollen Wert haben
  (nicht 0 oder `[]` ohne Grund).

### 4 — Löschen-Confirm-Text

1. Reiter Meßergebnisse öffnen.
2. Auf „Frequenzabgleich-Ergebnisse löschen" klicken.
3. **Erwartet:** Bestätigungsdialog zeigt den neuen Text mit dem
   Hinweis auf Track-Rohdaten und Unwiderruflichkeit.
4. Abbrechen — keine Daten löschen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanzpunkt einzeln durchgehen.
Pro Punkt melden: **erfüllt / nicht erfüllt / unklar** mit Datei-
und Zeilenangabe der geänderten Stelle.

Zusätzlich prüfen:

- **Beide Seiten in beiden Save-Pfaden**: `init.js` und `file.js`
  müssen je zweimal geändert worden sein (left + right). Gegenchecken
  mit `grep -n "freqmatchAdaptive" js/init.js js/file.js` — erwartet
  4 neue Treffer (je 2 pro Datei), plus die unveränderten Treffer
  aus `state-side.js` und `freqmatch.js`.
- **Load-Pfad unverändert**: `js/state-side.js:221` bleibt
  `d.freqmatchAdaptive || null` — nicht anfassen.
- **Fix 3 korrekt minimal**: In `_fmCheckAndUpdateStatus` dürfen
  nur die zwei `null`-Zeilen entfernt worden sein, sonst nichts.
  Den `return track.status;` und den `status`-Setter stehen lassen.
- **Kein unbeabsichtigter Daten-Overhead beim Auto-Save**: Das
  `freqmatchAdaptive`-Objekt enthält `tracks` mit `trialHistory`
  (kann groß werden). Falls localStorage-Quota-Fehler auftreten
  (`QuotaExceededError` in der Konsole), Hinweis an den Nutzer;
  in diesem Build aber keine Workaround-Logik einbauen.
- **Versions-Bump auf 3.0.87-beta erfolgt.**

Hinweis für künftige Mini-Anleitung: EN/FR/ES-Übersetzung für den
neuen `fmrClearConfirm`-Text steht aus.
