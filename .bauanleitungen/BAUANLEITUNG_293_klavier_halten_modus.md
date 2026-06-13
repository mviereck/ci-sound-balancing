# BAUANLEITUNG 293 — Klavier auf Halten-Modus, zweiseitige Tests mit „andere Seite nach Loslassen"

**Ziel-Version nach Build:** `0.4.293-beta`
**Berührte Dateien:** `js/test.js`, `js/lr-balance.js`, `js/freqmatch.js`,
`js/version.js`
**Sprache:** nur Deutsch (kein neuer UI-Text).

---

## Zweck

Die Klaviere in den drei Mess-Test-Tonauswahlboxen laufen heute im
**Burst-Modus** (fester Anschlag). Sie werden auf **Halten-Modus**
umgestellt (Ton klingt, solange die Taste gedrückt ist) — wie im Reiter
Implantat. Der Halten-Modus aktiviert sich im Klavier-Widget automatisch,
sobald die Konfiguration ein **`onRelease`** liefert
(`js/sampler-keyboard.js`: `isHold = typeof opts.onRelease === 'function'`).

Verhalten pro Test:

- **Elektrodenlautstärke** (einseitig): Halten → Ton auf der
  eingestellten Seite, **ohne** Mess-Korrektur (der Test misst sie erst).
  Loslassen → Stopp.
- **Stereo-Balance** und **Frequenzabgleich** (zweiseitig): Halten → eine
  Seite. Loslassen → die **andere Seite**, mit der **Elektroden-Frequenz
  und Korrektur der jeweiligen Seite** (kann sich je Seite unterscheiden),
  und mit **derselben Dauer**, die der gehaltene Ton hatte (Haltedauer,
  stumpf übernommen, ohne Grenzen).

**Korrektur** = dieselbe wie im echten Test (konsistent mit den
`…Sequence()`-Funktionen): Stereo-Balance nutzt `lrCorrGain(side, elIdx)`
(Elektrodenkorrektur je Seite, **keine** Stereo-Balance — die misst man
ja); Frequenzabgleich nutzt `fmCorrGain(side, hz) * dB2G(balDb)`
(Elektrodenkorrektur + Stereo-Balance je Seite).

**Hartes Stoppen beim Loslassen** (über `stopAll`) wie heute beim
Implantat — der sanfte Ausklang folgt in BA 294.

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'`.**

---

## Schritt 1 — `js/test.js`: Elektrodenlautstärke-Klavier (Halten, ohne Korrektur)

Den `onPress`-Handler (ca. Z. 1287–1300) ersetzen und ein `onRelease`
ergänzen. **Vorher** spielte er einen Burst mit `tGDur()` und
`_testTpCorrectVol`. **Nachher:**

```js
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            var pan = (activeSide === 'left') ? -1 : 1;
            var tt  = (_testTpModalTone !== null) ? _testTpModalTone : toneType_test;
            // Elektrodenlautstaerke: keine Mess-Korrektur (wird hier erst gemessen).
            var vol = tGVol();
            try {
              playToneTyped(c, hz, vol, 60000, pan, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function () {
            if (typeof stopAll === 'function') stopAll();
          }
```

> `getHighlightMs` (Burst-Aufleuchten) wird im Halten-Modus nicht mehr
> verwendet; die Zeile darf stehenbleiben (harmlos).

---

## Schritt 2 — `js/lr-balance.js`: Stereo-Balance-Klavier (Halten + andere Seite)

**2a.** Modul-Variable für den Anschlag-Zeitpunkt (bei den anderen
`let`-Deklarationen oben, z.B. nahe `let lrPlayTO = null;`, Z. 15):

```js
let _lrKbT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
```

**2b.** Den gesamten `onPress`-Handler (ca. Z. 877–891) ersetzen und ein
`onRelease` ergänzen. Die Pegel-/Frequenz-Logik je Seite steht inline in
beiden Handlern (Elektrodenkorrektur je Seite, **keine** Stereo-Balance;
Zier-Taste `electrodeIdx < 0` → `hz` roh, ohne Korrektur):

```js
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _lrKbT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt   = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_balance;
            var vol  = lrGVol();
            var panA = (activeSide === 'left') ? -1 : 1;
            var hzA, volA;
            if (electrodeIdx >= 0) {
              hzA  = lrEffFreq(activeSide, electrodeIdx);
              volA = vol * lrCorrGain(activeSide, electrodeIdx);
            } else {
              hzA = hz; volA = vol;
            }
            try {
              playToneTyped(c, hzA, volA, 60000, panA, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (typeof stopAll === 'function') stopAll();
            if (!c) return;
            var t1   = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var held = Math.max(0, t1 - _lrKbT0);
            if (held <= 0) return;
            var tt    = (_lrTpModalTone !== null) ? _lrTpModalTone : toneType_balance;
            var vol   = lrGVol();
            var other = (activeSide === 'left') ? 'right' : 'left';
            var panB  = (activeSide === 'left') ? 1 : -1;
            var hzB, volB;
            if (electrodeIdx >= 0) {
              var rN = sideData[other] ? sideData[other].nEl : 0;
              var oIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzB  = lrEffFreq(other, oIdx);
              volB = vol * lrCorrGain(other, oIdx);
            } else {
              hzB = hz; volB = vol;
            }
            try {
              playToneTyped(c, hzB, volB, held, panB, tt);
            } catch (e) { /* swallow */ }
          }
```

> Achtung: `stopAll()` in `onRelease` stoppt den gehaltenen Ton; **direkt
> danach** wird der Ton der anderen Seite gestartet. Das ist gewollt.

---

## Schritt 3 — `js/freqmatch.js`: Frequenzabgleich-Klavier (Halten + andere Seite)

**3a.** Modul-Variable (bei den `let`-Deklarationen oben, z.B. nahe
`let fmKbdCorrectVol = null;`, Z. 15):

```js
let _fmKbT0 = 0;   // BA 293: Zeitpunkt des Klavier-Anschlags (Haltedauer)
```

**3b.** Den gesamten `onPress`-Handler (ca. Z. 1137–1161) ersetzen und
`onRelease` ergänzen:

```js
          onPress: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (!c) return;
            _fmKbT0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var tt      = (fmModalTone !== null) ? fmModalTone : toneType_freqmatch;
            var vol     = fmGVol();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide) ? fmVarSide : activeSide;
            var varPan  = (varSide === 'left') ? -1 : 1;
            var balG    = (typeof getRawBalanceGains === 'function') ? getRawBalanceGains() : { left: 0, right: 0 };
            var balDb   = (varSide === 'left') ? balG.left : balG.right;
            var volVar  = isDeaf(varSide) ? 0 : vol * fmCorrGain(varSide, hz) * dB2G(balDb);
            try {
              playToneTyped(c, hz, volVar, 60000, varPan, tt);
            } catch (e) { /* swallow */ }
          },
          onRelease: function (electrodeIdx, hz) {
            var c = (typeof gAC === 'function') ? gAC() : null;
            if (typeof stopAll === 'function') stopAll();
            if (!c) return;
            var t1   = (typeof performance !== 'undefined') ? performance.now() : Date.now();
            var held = Math.max(0, t1 - _fmKbT0);
            if (held <= 0) return;
            var tt      = (fmModalTone !== null) ? fmModalTone : toneType_freqmatch;
            var vol     = fmGVol();
            var varSide = (typeof fmVarSide === 'string' && fmVarSide) ? fmVarSide : activeSide;
            var refSide = (varSide === 'left') ? 'right' : 'left';
            var refPan  = (varSide === 'left') ? 1 : -1;
            // Eingestellte Frequenz der Elektrode auf der Ref-Seite (kann
            // sich von der Var-Seite unterscheiden).
            var hzRef;
            if (electrodeIdx >= 0) {
              var rN = sideData[refSide] ? sideData[refSide].nEl : 0;
              var rIdx = electrodeIdx < rN ? electrodeIdx : rN - 1;
              hzRef = withSide(refSide, function () { return effFreq(rIdx); });
            } else {
              hzRef = hz;
            }
            var balG  = (typeof getRawBalanceGains === 'function') ? getRawBalanceGains() : { left: 0, right: 0 };
            var balDb = (refSide === 'left') ? balG.left : balG.right;
            var volRef = isDeaf(refSide) ? 0 : vol * fmCorrGain(refSide, hzRef) * dB2G(balDb);
            try {
              playToneTyped(c, hzRef, volRef, held, refPan, tt);
            } catch (e) { /* swallow */ }
          }
```

---

## Schritt 4 — Version bumpen

In `js/version.js`:
```js
const APP_VERSION = "0.4.293-beta";
```

---

## Akzeptanztest (vom Nutzer durchklickbar)

1. **Elektrodenlautstärke (Halten):** Tonauswahl-Box öffnen, Klaviertaste
   **gedrückt halten** → Ton klingt, solange gedrückt; **loslassen** →
   Ton stoppt. Kein zweiter Ton.
2. **Stereo-Balance (andere Seite):** Klaviertaste halten → eine Seite
   klingt (mit deren Korrektur). **Loslassen** → die **andere Seite**
   klingt, in der Frequenz **ihrer** Elektrode, **genauso lange**, wie du
   gehalten hast (kurz gehalten → kurz; lang gehalten → lang).
3. **Frequenzabgleich (andere Seite):** wie 2 — halten = Vergleichs-Seite,
   loslassen = Referenz-Seite, jeweilige Elektroden-Frequenz/Korrektur,
   Dauer = Haltedauer.
4. **Tonart wirkt:** im Klavier eine andere Tonart auswählen → Halten/
   Loslassen klingt in der neuen Tonart.
5. **Taube Seite:** ist eine Seite taub, bleibt sie stumm (Frequenzabgleich).
6. Konsole (F12): **keine** Fehlermeldung.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie einzeln durchgehen
(erfüllt / nicht erfüllt / unklar, mit Datei-/Zeilenangabe).
Zusätzlich:

- Bestätigen, daß alle drei Tests jetzt ein `onRelease` haben (damit der
  Halten-Modus im Klavier-Widget aktiv wird).
- Bestätigen, daß Stereo-Balance die Korrektur über `lrCorrGain` je Seite
  bildet (Elektrodenkorrektur, **keine** Stereo-Balance) und
  Frequenzabgleich über `fmCorrGain(side,hz) * dB2G(balDb)`.
- Bestätigen, daß der gehaltene Ton mit `60000` ms gestartet und beim
  Loslassen über `stopAll` beendet wird; die andere Seite läuft mit der
  gemessenen Haltedauer (`held`).
- Bestätigen, daß Elektrodenlautstärke **keine** Korrektur mehr anwendet
  (kein `_testTpCorrectVol` im neuen `onPress`).
- In Code-Snippets ausschließlich ASCII-Anführungszeichen `"` und `'`.

---

## i18n

Keine neuen Texte. Die Sprachdateien sind nicht angefaßt.
