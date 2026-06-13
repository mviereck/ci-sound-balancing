# BA 297 — Elektrodenlautstärke-Korrektur: eine zentrale Funktion, Vorzeichen-Fixes

## Worum es geht

Die Mess-Werte des Elektrodenlautstärke-Tests (`compWLS().levels`)
werden an vielen Stellen gebraucht — teils um Töne zu korrigieren,
teils um Werte anzuzeigen. Bisher rechnet **jede Stelle das Vorzeichen
selbst**. Dabei sind über die Zeit drei verschiedene (teils falsche)
Varianten entstanden. Diese BA führt **eine zentrale Funktion**
`elTestData(opts)` ein, die alles liefert, was der Test gibt, dreht
das Vorzeichen **nur an dieser einen Stelle**, und stellt alle
Verbraucher darauf um.

**Konventionen (wichtig, nicht durcheinanderbringen):**

- `compWLS().levels[i]`: Mess-**Ist-Zustand**. Negativ = Elektrode
  wurde **zu leise** gehört. (Anzeige-Konvention.)
- **Korrektur** = das, was beim Abspielen anzuwenden ist: eine zu
  leise Elektrode muß **angehoben** werden → Korrektur = `-levels`
  (zu leise ⇒ positiv).
- `manualLevels` (Schieber) und `presetCurve` (Kurven) haben die
  **umgekehrte** Konvention: positiv = lauter. Die werden hier
  **nicht** angefaßt.

**Gefundene Fehler (alle = falsches Vorzeichen des Mess-Anteils):**

1. Stereo-Balance (`lrCorrGain`): wendet `+levels` an → zu leise wird
   leiser. Falsch.
2. Tonwahl-Modalbox / Implantat-Vorschau (`_tpMeasDbForStep`): `+levels`.
   Falsch.
3. Player (`computeGains`): effektiv `+levels` am Filter. Falsch.
4. Kurven-Tab (`drawLvChart`): Mess-Linie roh (Ist) statt Korrektur,
   in der Summe mit Schieber/Kurven (Wunsch) gemischt. Falsch.
5. Schieber-Tab (`lvTabDrawRelative`, `lvTabDrawAbsolute`): dasselbe.

`fmCorrGain` (Frequenzabgleich) war als einziges **schon richtig** —
es wird nur auf die zentrale Funktion umgestellt (verhaltensgleich).

**Keine neuen UI-Texte. Keine i18n-Änderung.**

---

## Schritt 0 — Version

In `js/version.js`:

```js
const APP_VERSION = "0.4.297-beta";
```

---

## Schritt 1 — Zentrale Funktion `elTestData` (js/test.js)

`compWLS()` steht in `js/test.js` und endet bei Zeile 616 mit `}`.
**Direkt danach** diese Funktion einfügen:

```js
// ============================================================
// elTestData — EINZIGE Schnittstelle zu den Ergebnissen des
// Elektrodenlautstaerke-Tests (compWLS). Alle Stellen, die diese
// Werte brauchen (Korrektur wie Anzeige), rufen NUR diese Funktion
// auf und drehen das Vorzeichen NICHT mehr selbst.
//
// Ruft compWLS() genau EINMAL pro Aufruf und liefert ein Objekt:
//   raw[i]            rohe Mess-dB direkt aus compWLS (ungegatet).
//                     Ist-Zustand: zu leise => negativ. Fuer Anzeige
//                     und Statistik, die ihren eigenen Filter haben.
//   measured[i]       Ist-Zustand, GEGATET: Elektrode ohne gueltige
//                     Messdaten / ausgeschlossen / stumm => 0.
//   correction[i]     KORREKTUR-dB, gegatet: zu leise => POSITIV
//                     (= beim Abspielen anheben). = -measured.
//   correctionGain[i] correction als linearer Faktor dB2G(correction);
//                     ungemessen => 1 (neutral).
//   residual[i]       Streuung/Residuum pro Elektrode (elRes).
//   weight[i]         Gewicht pro Elektrode (elWt).
//
// opts.side: optionale Seite ("left"/"right"); sonst aktive Seite.
//
// Das Gate (gueltige Messdaten?) ist hier dieselbe Bedingung wie der
// frueher in player.js/tone-popup.js duplizierte hd-Check.
function elTestData(opts) {
  opts = opts || {};
  const run = function () {
    const n = nEl;
    const { levels, elRes, elWt } = compWLS();
    const measured = new Array(n);
    const correction = new Array(n);
    const correctionGain = new Array(n);
    for (let i = 0; i < n; i++) {
      const hd = bRes.some(function (r) {
        return (r.a === i || r.b === i)
          && elExDur[r.a] === null && elSt[r.a] !== "mute"
          && elExDur[r.b] === null && elSt[r.b] !== "mute";
      });
      const m = (hd && isFinite(levels[i])) ? levels[i] : 0;
      measured[i] = m;
      correction[i] = -m;
      correctionGain[i] = dB2G(-m);
    }
    return {
      raw: levels,
      measured: measured,
      correction: correction,
      correctionGain: correctionGain,
      residual: elRes,
      weight: elWt,
    };
  };
  return opts.side ? withSide(opts.side, run) : run();
}
```

Hinweise: `dB2G` ist global (audio.js), `withSide`/`bRes`/`nEl`/
`elExDur`/`elSt` ebenfalls. Keine Lade-Reihenfolge-Probleme, weil alle
Verbraucher `elTestData` erst zur Laufzeit aufrufen (wie `compWLS`
heute schon).

---

## Schritt 2 — LS-Schätzung (js/test.js, `getLsEstimate`)

Reine Konsolidierung, **kein** Vorzeichen-Fix (die Schätzung lebt in
der rohen Test-Slider-Konvention).

In `getLsEstimate` (um Zeile 649):

**vorher**
```js
  const { levels, elRes } = compWLS();
```
**nachher**
```js
  const { raw: levels, residual: elRes } = elTestData();
```

Der Rest der Funktion (`levels[a] - levels[b]`, `elRes[a]`, …) bleibt
unverändert.

---

## Schritt 3 — Player (js/player.js, `computeGains`)

**Vorzeichen-Fix.** Der Player legt drei dB-Anteile in `g` und
negiert am Filter (`-g*str`). Schieber/Kurven gehen darum als
`-manualLevels` / `-presetCurve` ein (Korrektur negiert). Der
Mess-Anteil muß genauso die **negierte Korrektur** sein: `-correction`.
Bisher steht dort `-levels` (das ist `+correction` → falsch).

`computeGains` (Zeilen 216–235) ersetzen durch:

```js
function computeGains() {
  const corr = elTestData().correction;
  const presetCurve = getTotalPresetCurve();
  const g = new Array(nEl).fill(0);
  for (let i = 0; i < nEl; i++) {
    // corr[i] ist bereits gegatet (ungemessen/ausgeschlossen/stumm => 0),
    // daher kein eigener hd-Check mehr noetig.
    const addMeas = plSrcMeas ? -corr[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
    g[i] = addMeas + addLvls + addCurves;
  }
  return g;
}
```

`computeGains` läuft bei `getPlayerGains` immer im `withSide`-Kontext —
`elTestData()` ohne `side` nutzt korrekt die gerade gebundene Seite.
**Filter-Anwendung, `nhSim` und `pDrawEQ` nicht anfassen** — sie
ziehen `gains` aus `computeGains` und werden durch den Quell-Fix
automatisch korrekt (zu leise Elektrode: EQ-Balken dann grün/nach oben).

---

## Schritt 4 — Stereo-Balance (js/lr-balance.js, `lrCorrGain`)

**Vorzeichen-Fix.** `lrCorrGain` (Zeilen 101–107) ersetzen durch:

```js
function lrCorrGain(side, elIdx) {
  return elTestData({ side }).correctionGain[elIdx];
}
```

`correctionGain` = `dB2G(-levels)` (zu leise ⇒ Faktor > 1 = lauter)
und ist gegatet (ungemessen ⇒ 1). Der frühere `bRes.length === 0`-Guard
entfällt (ungemessen liefert ohnehin Faktor 1). Die vier Aufrufer
(`lrSequence`, `lrUpdateClipHint`, Modalbox-Klavier press/release)
bleiben unverändert.

---

## Schritt 5 — Frequenzabgleich (js/freqmatch.js, `fmCorrGain`)

Refactor, **verhaltensgleich** (war schon korrekt). In `fmCorrGain`
(Zeilen 218 ff.) den Block, der `_rawLv` holt und selbst flippt,
ersetzen.

**vorher** (Zeilen 224–232, der Kommentar dazwischen mit)
```js
    const { levels: _rawLv } = compWLS();
    if (!_rawLv || !_rawLv.length) return 1;
    // Vorzeichen-Korrektur der Loudness-Messung:
    // levels[i] < 0 = Elektrode wird ZU LEISE gehört → beim Abspielen
    // LAUTER machen (dB2G(-levels) > 1); levels[i] > 0 = zu laut → leiser.
    // Die Anzeige (results.js) zeigt levels direkt; die Anwendung muss
    // umkehren. Nicht-endliche Werte bleiben unverändert (isFinite-Gates
    // weiter unten verlassen sich darauf).
    const levels = _rawLv.map(function (v) { return isFinite(v) ? -v : v; });
```
**nachher**
```js
    // Korrektur-dB pro Elektrode (zu leise => positiv = anheben).
    // Vorzeichen + Gating zentral in elTestData.
    const levels = elTestData().correction;
    if (!levels || !levels.length) return 1;
```

Der `withSide(side, …)`-Rahmen und die gesamte Interpolation darunter
(die auf `levels` zwischen den Elektroden interpoliert) bleiben
**unverändert**. `elTestData()` ohne `side` nutzt die durch `withSide`
gebundene Seite.

---

## Schritt 6 — Tonwahl-Modalbox (js/tone-popup.js)

**6a — Vorzeichen-Fix** in `_tpMeasDbForStep`. Nur die Werte-Quelle
(um Zeile 865) ändern:

**vorher**
```js
        var lv = compWLS().levels;
        var v = lv[best];
        return (typeof v === 'number' && isFinite(v)) ? v : 0;
```
**nachher**
```js
        var lv = elTestData().correction;
        var v = lv[best];
        return (typeof v === 'number' && isFinite(v)) ? v : 0;
```

`correction` ist die anzuwendende Korrektur (zu leise ⇒ positiv); der
Aufrufer macht daraus `ev *= dB2G(v)`. Der vorgelagerte hd-Check und
die „nächste Elektrode"-Suche bleiben. Wirkt im Implantat-Tab
(Vorschau, Klavier, Sweep) — den einzigen real genutzten Stellen.

**6b — irreführenden Kommentar berichtigen.** Der Kommentar bei
Zeilen 492–498 behauptet, die Korrekturen wirkten auch in den
Test-Modalboxen weiter. Das stimmt nicht (die Tests rufen die
Korrektor-`fn` nicht auf). Ersetzen durch:

```js
  // Die Korrektur-Toggles (und die ueber onTogglesReady ausgegebene
  // Korrektor-fn) werden NUR im Reiter Implantat genutzt; dort steuern
  // sie Vorschau, Klavier und Sweep. Die Test-Aufrufer setzen
  // showToggles:false und wenden ihre Elektrodenlautstaerke-Korrektur
  // selbst an (lrCorrGain / fmCorrGain) — die fn liegt dort brach.
```

---

## Schritt 7 — Kurven-Tab (js/levels.js, `drawLvChart`)

**Vorzeichen-Fix (Drehung).** Die blaue Mess-Linie soll künftig die
Korrektur zeigen (zu leise ⇒ nach oben), gleichsinnig mit Schieber/
Kurven; die schwarze Summe wird damit die effektive Gesamtkorrektur.

**vorher** (Zeilen 340–345)
```js
  const { levels } = compWLS();
  const pc = getTotalPresetCurve();
  const measV = act.map((i) => {
    const hd = bRes.some((r) => r.a === i || r.b === i);
    return hd ? levels[i] : 0;
  });
```
**nachher**
```js
  const corr = elTestData().correction;
  const pc = getTotalPresetCurve();
  const measV = act.map((i) => corr[i]);
```

`correction` ist bereits gegatet (ungemessen ⇒ 0), daher entfällt der
eigene `hd`-Check. `manV`/`preV`/`sumV` und die Zeichenlogik darunter
bleiben unverändert.

---

## Schritt 8 — Schieber-Tab (js/levels-tab.js)

**Vorzeichen-Fix (Drehung), zwei Funktionen.** Das Vorzeichen muß auf
dem **dB-Wert** sitzen — im Absolutmodus also **vor** der
`toAbs`-Umrechnung. Das ist automatisch der Fall, weil wir die Quelle
auf `correction` umstellen.

**8a — `lvTabDrawRelative`** (um Zeilen 95–104):

**vorher**
```js
  const { levels: measArr } = compWLS();
  const preArr = getTotalPresetCurve();
  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const sch = manualLevels[i] || 0;
    const mes = lvTabShowMeas
      ? (bRes.some((r) => r.a === i || r.b === i) ? measArr[i] : 0)
      : 0;
    const cur = lvTabShowCurves ? preArr[i] : 0;
    return { i, excluded: false, sch, mes, cur, sum: sch + mes + cur };
  });
```
**nachher**
```js
  const measArr = elTestData().correction;
  const preArr = getTotalPresetCurve();
  const cols = all.map((i) => {
    if (isExcluded(i)) return { i, excluded: true };
    const sch = manualLevels[i] || 0;
    const mes = lvTabShowMeas ? measArr[i] : 0;
    const cur = lvTabShowCurves ? preArr[i] : 0;
    return { i, excluded: false, sch, mes, cur, sum: sch + mes + cur };
  });
```

**8b — `lvTabDrawAbsolute`** (um Zeilen 175, 191–196):

Die Werte-Quelle (Zeile 175):
**vorher**
```js
  const { levels: measArr } = compWLS();
```
**nachher**
```js
  const measArr = elTestData().correction;
```

Und der Mess-Anteil (um Zeilen 192–194):
**vorher**
```js
    const mesDb = lvTabShowMeas
      ? (bRes.some((r) => r.a === i || r.b === i) ? measArr[i] : 0)
      : 0;
```
**nachher**
```js
    const mesDb = lvTabShowMeas ? measArr[i] : 0;
```

`sumDb`, `toAbs(...)` und die Zeichenlogik bleiben unverändert — sie
bekommen jetzt den korrekt gedrehten `mesDb`.

---

## Schritt 9 — Ergebnis-Anzeige (js/results.js)

Reine Konsolidierung, **kein** Vorzeichen-Fix (Ergebnis-Tabelle zeigt
den Ist-Zustand). In `renderResults` (Zeile 71):

**vorher**
```js
    const { levels, elRes, elWt } = compWLS();
```
**nachher**
```js
    const { raw: levels, residual: elRes, weight: elWt } = elTestData();
```

`raw` ist identisch zu `compWLS().levels` (Ist-Zustand). Alles darunter
(Statistik, Tabelle) bleibt unverändert.

---

## Schritt 10 — Druck/Archiv (js/print-md.js)

Reine Konsolidierung, **kein** Vorzeichen-Fix (Druck zeigt den
Ist-Zustand als `offsetDb`). Um Zeile 176:

**vorher**
```js
      const { levels, elRes } = compWLS();
```
**nachher**
```js
      const { raw: levels, residual: elRes } = elTestData();
```

Der eigene `inMeas`-Check (`bRes.some(...)`) und `offsetDb: inMeas ?
levels[i] : null` bleiben unverändert.

---

## Schritt 11 — docs/CODESTRUKTUR.md

In der Modul-Tabelle, Zeile zu `8 | test.js`, den Inhalt um die neue
Funktion ergänzen (am Ende des bestehenden Textes):

> … Nutzt testUI-API (`buildTestPanel`). **`elTestData(opts)` ist die
> zentrale Schnittstelle zu den Mess-Ergebnissen (eine `compWLS`-Hülle,
> liefert `raw`/`measured`/`correction`/`correctionGain`/`residual`/
> `weight`); alle Stellen, die Elektrodenlautstärke-Korrekturen
> anwenden oder anzeigen, ziehen die Werte hier und drehen das
> Vorzeichen nicht mehr selbst.** (Namen per `grep`.)

---

## Akzeptanztest (Klick für Klick)

Voraussetzung: eine Seite mit Messdaten laden, bei der **mindestens
eine Elektrode deutlich zu leise** gemessen wurde (in der Ergebnis-
Tabelle als **negativer** Wert / Balken nach unten sichtbar).

1. **Ergebnis-Tabelle unverändert.** Tab „Meßergebnisse" →
   „Elektrodenlautstärke-Balance": die zu leise Elektrode steht
   weiterhin **negativ** (Ist-Zustand). *Erwartet: unverändert zu vorher.*
2. **Kurven-Tab gedreht.** Tab „Kurven", Häkchen „Messung" an: die
   blaue Mess-Linie der zu leisen Elektrode zeigt jetzt **nach oben**
   (vorher unten). *Erwartet: Anhebung statt Absenkung.*
3. **Schieber-Tab gedreht.** Tab „Schieber", Messung einblenden, in
   Relativ- **und** Absolutansicht: der Mess-Anteil der zu leisen
   Elektrode geht in **Anhebungs-Richtung**. *Erwartet: konsistent mit
   Kurven-Tab.*
4. **Player hebt an.** Tab „Player", Quelle „Messung" an, EQ an: in der
   EQ-Kurve im Player ist die zu leise Elektrode jetzt **grün / nach
   oben** (Anhebung), nicht rot/unten. Abspielen: diese Frequenz klingt
   lauter, nicht leiser. *Erwartet: zu leise wird angehoben.*
5. **Stereo-Balance-Test.** Tab „Messungen" → „Stereo-Balance",
   Test starten: die Töne der zu leise gemessenen Elektroden werden
   **lauter** vorgespielt (nicht leiser). *Erwartet: hörbar angehoben.*
6. **Frequenzabgleich unverändert.** Tab „Messungen" →
   „Frequenzabgleich": Klang wie vor der BA (war schon korrekt).
   *Erwartet: keine hörbare Änderung.*
7. **Implantat-Vorschau.** Tab „Implantat", Tonart-Auswahl öffnen,
   „Elektrodenlautstärke anwenden" an, Sweep/Klavier: zu leise
   Elektroden klingen **lauter**. *Erwartet: angehoben.*
8. **Druck unverändert.** Archiv-Druck: die Loudness-Tabelle zeigt
   weiterhin den Ist-Zustand (zu leise = negativ). *Erwartet:
   unverändert.*

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung **jede** der folgenden Kriterien einzeln
durchgehen und als erfüllt / nicht erfüllt / unklar melden, mit Datei +
Zeile:

- `elTestData` existiert in `js/test.js` direkt nach `compWLS`, ruft
  `compWLS()` genau einmal, liefert alle sechs Felder. Vorzeichen:
  `correction[i] === -measured[i]`, `correctionGain[i] ===
  dB2G(-measured[i])`.
- Kein Verbraucher dreht das Vorzeichen mehr selbst: in `player.js`,
  `lr-balance.js`, `freqmatch.js`, `tone-popup.js`, `levels.js`,
  `levels-tab.js` taucht **kein** `compWLS().levels` mit eigenem
  `-`-Flip oder `dB2G(levels…)` mehr auf (per `grep` prüfen).
- `compWLS(` wird nur noch von `elTestData` selbst und (unverändert)
  von den `residuals`-Nutzern in `test.js` aufgerufen — per
  `grep -rn "compWLS(" js/` gegenchecken; `levels`-Verbraucher gehen
  alle über `elTestData`.
- Player Schritt 3: `addMeas = plSrcMeas ? -corr[i] : 0`; Filterzeilen
  (`-gains*str` / `nhSim`) **unverändert**.
- Kurven-/Schieber-Tab: Mess-Anteil = `correction` (gedreht); Schieber-
  und Kurven-Anteil unverändert.
- `js/version.js` = `"0.4.297-beta"`.
- Browser-Konsole nach Laden fehlerfrei (kein roter Fehler-Banner).

Wenn etwas als „unklar" markiert wird: Rückfrage an den Nutzer, nicht
still annehmen.

---

## Hinweis zu den anderen Sprachen

Diese BA ändert keine UI-Texte; `en.js`/`fr.js`/`es.js` sind nicht
betroffen. Kein Übersetzungsschritt.
