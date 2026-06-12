# Bauanleitung 275 — Vorzeichen der Elektrodenlautstärke-Korrektur reparieren

## Zielversion

Nach dem Build: `APP_VERSION = "0.4.275-beta"` in `js/version.js`.

## Worum geht es

Die gemessene Elektrodenlautstärke (Ergebnis der „Elektrodenlautstärke"-Messung,
intern `compWLS().levels`) wird beim **Anwenden auf Audio spiegelverkehrt**
eingerechnet. Eine leise Elektrode (positives `levels[i]`) wird **abgesenkt**
statt **angehoben**.

Empirisch bestätigt: Für eine leise Elektrode mit `levels[i] = +3,7 dB` wendet
der Player und die Test-Töne `−3,7 dB` an (Dämpfung), obwohl `+3,7 dB`
(Anhebung) richtig wäre. Die Tonauswahl-Modalbox-Vorschau wendet bereits
korrekt `+3,7 dB` an — daran erkennt man die richtige Richtung.

**Konvention (verbindlich):** Positives `levels[i]` = Elektrode ist leise und
muß **angehoben** werden. Korrekte Audio-Anwendung auf einen Ton:
`ton * dB2G(+levels[i])`. Im Player-EQ folgt die Messung **derselben**
Vorzeichen-Behandlung wie die Kurven.

Betroffen sind genau **drei** Anwende-Stellen. Anzeige, Druck, Ergebnisse,
Mess-Hinweis und die Modalbox-Vorschau sind **bereits richtig** und werden
**nicht** angefaßt. Schieber und Kurven sind ebenfalls richtig und bleiben
unverändert.

---

## Fix 1 — Player (`js/player.js`)

In `computeGains()` fließt die Messung mit dem **falschen** Vorzeichen ein.
Die Kurven daneben (`addCurves`) sind richtig: negiert. Die Messung muß
**genauso** negiert werden wie die Kurven.

`js/player.js`, Funktion `computeGains` (um Z. 229):

**Vorher:**

```js
    const addMeas = plSrcMeas && hd ? levels[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
```

**Nachher:**

```js
    const addMeas = plSrcMeas && hd ? -levels[i] : 0;
    const addLvls = plSrcLevels ? -manualLevels[i] : 0;
    const addCurves = plSrcCurves ? -presetCurve[i] : 0;
```

Nur das `levels[i]` in der `addMeas`-Zeile bekommt ein Minus. `addLvls` und
`addCurves` bleiben **unverändert**. Dadurch verhält sich die Messung im Audio,
in der EQ-Grafik und in der EQ-Tabelle (Zeilen „Pegel" / „Gain") exakt wie die
bereits korrekten Kurven.

---

## Fix 2 — Stereo-Balance-Test (`js/lr-balance.js`)

`js/lr-balance.js`, Funktion `lrCorrGain` (Z. 109–115):

**Vorher:**

```js
function lrCorrGain(side, elIdx) {
  return withSide(side, () => {
    if (sideData[side].bRes.length === 0) return 1;
    const { levels } = compWLS();
    return dB2G(-levels[elIdx]);
  });
}
```

**Nachher:**

```js
function lrCorrGain(side, elIdx) {
  return withSide(side, () => {
    if (sideData[side].bRes.length === 0) return 1;
    const { levels } = compWLS();
    return dB2G(levels[elIdx]);
  });
}
```

Nur das Minus vor `levels[elIdx]` entfällt.

---

## Fix 3 — Frequenzabgleich-Test (`js/freqmatch.js`)

`js/freqmatch.js`, Funktion `fmCorrGain` (Z. 217–271). Diese Funktion
interpoliert die Messung über die Frequenz und gibt an **acht** Stellen
`dB2G(-…)` zurück. **Alle acht** Minuszeichen müssen entfallen.

**Vorher (ganze Funktion):**

```js
function fmCorrGain(side, hz) {
  return withSide(side, () => {
    if (typeof bRes === "undefined" || !bRes || bRes.length === 0) return 1;
    if (typeof compWLS !== "function") return 1;
    const f = (typeof freqs !== "undefined" && freqs) ? freqs : null;
    if (!f || f.length === 0) return 1;
    const { levels } = compWLS();
    if (!levels || !levels.length) return 1;

    const n = f.length;
    const lg = Math.log(hz);

    if (n === 1) {
      return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
    }
    const lgFirst = Math.log(f[0]);
    const lgLast  = Math.log(f[n - 1]);
    const ascending = lgLast > lgFirst;
    if (ascending) {
      if (lg <= lgFirst) {
        return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
      }
      if (lg >= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(-levels[n - 1]) : 1;
      }
    } else {
      if (lg >= lgFirst) {
        return isFinite(levels[0]) ? dB2G(-levels[0]) : 1;
      }
      if (lg <= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(-levels[n - 1]) : 1;
      }
    }

    for (let i = 0; i < n - 1; i++) {
      const lgA = Math.log(f[i]);
      const lgB = Math.log(f[i + 1]);
      const lo = Math.min(lgA, lgB);
      const hi = Math.max(lgA, lgB);
      if (lg >= lo && lg <= hi) {
        const lvA = levels[i];
        const lvB = levels[i + 1];
        if (!isFinite(lvA) && !isFinite(lvB)) return 1;
        if (!isFinite(lvA)) return dB2G(-lvB);
        if (!isFinite(lvB)) return dB2G(-lvA);
        const tNum = lg - lgA;
        const tDen = lgB - lgA;
        const tt = (tDen === 0) ? 0 : (tNum / tDen);
        const lv = lvA + (lvB - lvA) * tt;
        return dB2G(-lv);
      }
    }
    return 1;
  });
}
```

**Nachher (ganze Funktion):**

```js
function fmCorrGain(side, hz) {
  return withSide(side, () => {
    if (typeof bRes === "undefined" || !bRes || bRes.length === 0) return 1;
    if (typeof compWLS !== "function") return 1;
    const f = (typeof freqs !== "undefined" && freqs) ? freqs : null;
    if (!f || f.length === 0) return 1;
    const { levels } = compWLS();
    if (!levels || !levels.length) return 1;

    const n = f.length;
    const lg = Math.log(hz);

    if (n === 1) {
      return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
    }
    const lgFirst = Math.log(f[0]);
    const lgLast  = Math.log(f[n - 1]);
    const ascending = lgLast > lgFirst;
    if (ascending) {
      if (lg <= lgFirst) {
        return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      }
      if (lg >= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
      }
    } else {
      if (lg >= lgFirst) {
        return isFinite(levels[0]) ? dB2G(levels[0]) : 1;
      }
      if (lg <= lgLast) {
        return isFinite(levels[n - 1]) ? dB2G(levels[n - 1]) : 1;
      }
    }

    for (let i = 0; i < n - 1; i++) {
      const lgA = Math.log(f[i]);
      const lgB = Math.log(f[i + 1]);
      const lo = Math.min(lgA, lgB);
      const hi = Math.max(lgA, lgB);
      if (lg >= lo && lg <= hi) {
        const lvA = levels[i];
        const lvB = levels[i + 1];
        if (!isFinite(lvA) && !isFinite(lvB)) return 1;
        if (!isFinite(lvA)) return dB2G(lvB);
        if (!isFinite(lvB)) return dB2G(lvA);
        const tNum = lg - lgA;
        const tDen = lgB - lgA;
        const tt = (tDen === 0) ? 0 : (tNum / tDen);
        const lv = lvA + (lvB - lvA) * tt;
        return dB2G(lv);
      }
    }
    return 1;
  });
}
```

`fmCorrGain` wird auch vom adaptiven Frequenzabgleich genutzt
(`js/freqmatch-adaptive.js` Z. 338 `fmCorrGain(side, hz)`) — dieser Pfad ist
damit automatisch mitkorrigiert, **keine** zusätzliche Änderung dort nötig.

---

## Nicht anfassen (zur Kontrolle)

Diese Stellen verwenden `compWLS().levels` **richtig** und dürfen **nicht**
geändert werden:

- `js/tone-popup.js` (`_tpMeasDbForStep`, angewandt als `dB2G(+md)`) — Modalbox-Vorschau.
- `js/levels-tab.js`, `js/levels.js` — Anzeige (Balken/Kurven).
- `js/results.js`, `js/print-md.js` — Ergebnisse und Druck.
- `js/test.js` `getLsEstimate` — Mess-Schieber-Hinweis (interne Offset-Konvention).
- Schieber (`-manualLevels`) und Kurven (`-presetCurve`) in `computeGains` —
  bleiben unverändert.

---

## Spec mitziehen

In `docs/spec/06-player.md` beim Abschnitt zum Pegel-Equalizer (um Z. 160–166,
„NH-Sim aus (Korrektur-Modus, Default)") **einen** klarstellenden Satz ergänzen:

> Die Messungs-Korrektur folgt derselben Vorzeichen-Behandlung wie die Kurven:
> positives `levels[i]` (leise Elektrode) wird angehoben. In `computeGains`
> fließt sie negiert ein (`addMeas = -levels[i]`), analog `addCurves`.

Keine weiteren Spec-Änderungen nötig.

---

## Versionsbump

`js/version.js`:

**Vorher:**

```js
const APP_VERSION = "0.4.274-beta";
```

**Nachher:**

```js
const APP_VERSION = "0.4.275-beta";
```

---

## Akzeptanztest (Klick für Klick)

**A. Konsolen-Gegenprobe (objektiv, ohne Hören).**
Browser neu laden (Cache!). In der Browser-Konsole einfügen:

```js
(function(){var d=withSide("left",function(){var lv=compWLS().levels,out=[];for(var i=0;i<nEl;i++){out.push({i:i,E:"E"+dEN(i),Hz:Math.round(effFreq(i)),levels_dB:Math.round(lv[i]*10)/10});}return out;});d.forEach(function(r){var g=lrCorrGain("left",r.i);r.test_gain=Math.round(g*1000)/1000;r.test_dB=Math.round(20*Math.log10(g)*10)/10;r.modalbox_dB=r.levels_dB;});console.table(d);})();
```

- Erwartet: `test_dB` ist jetzt **gleich** `modalbox_dB` (= `levels_dB`), also
  **positiv** wo `levels_dB` positiv ist. Für eine Elektrode mit `levels_dB = +3,7`
  muß `test_gain` jetzt **> 1** sein (vorher 0,652).

**B. Player.**
1. Tab „Player" → eine Audiodatei laden (oder den E6-Testton, falls vorhanden).
2. Korrektur (EQ) **einschalten**.
3. Erwartet: In der EQ-**Grafik** zeigen leise Elektroden (positives `levels_dB`)
   jetzt **grüne Balken nach oben** (Anhebung). Vorher zeigten sie rote Balken
   nach unten.
4. In der EQ-**Tabelle** zeigt die Zeile „Gain" für diese Elektroden jetzt
   **positive** Werte (vorher negativ).
5. Hörprobe: Eine von Natur aus leise Elektrode klingt mit Korrektur **lauter**,
   nicht leiser.

**C. Stereo-Balance-Test.**
1. Tab „Messungen" → Sub-Tab „Stereo-Balance" → Test starten (Seitenabfrage
   bestätigen).
2. Erwartet: Der Test-Ton einer leisen Elektrode klingt jetzt **angehoben** —
   genauso laut wie die Vorschau in der Tonauswahl-Modalbox derselben Elektrode.
   (Vorher: Test-Ton leise, Modalbox-Vorschau laut — der gemeldete Bug.)

**D. Frequenzabgleich-Test.**
1. Tab „Messungen" → Sub-Tab „Frequenzabgleich" → Test starten.
2. Erwartet: Die Test-Töne sind in der Lautstärke gemäß Messung korrigiert,
   in **derselben** Richtung wie im Player und in der Modalbox-Vorschau
   (leise Elektroden angehoben).

**E. Regression.**
- Schieber- und Kurven-Reiter: Anzeige und Klang unverändert.
- Druck/Ausdruck: die Korrekturwerte pro Elektrode unverändert (Anzeige war
  schon richtig).

---

## Selbstprüfungs-Auftrag an dich (Sonnet)

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (A–E) einzeln durchgehen und je
melden: **erfüllt / nicht erfüllt / unklar**, mit Datei + Zeilenangabe der
relevanten Stelle. Zusätzlich bestätigen:

- In `computeGains` wurde **nur** `addMeas` geändert, `addLvls` und `addCurves`
  sind unverändert.
- In `fmCorrGain` sind **alle acht** `dB2G(-…)` zu `dB2G(…)` geworden — per
  `grep -n "dB2G(-" js/freqmatch.js` gegenprüfen (Erwartung: keine Treffer mehr
  in `fmCorrGain`).
- `grep -n "dB2G(-levels" js/lr-balance.js` → keine Treffer mehr.
- Keine der unter „Nicht anfassen" gelisteten Stellen wurde verändert.
- `APP_VERSION` steht auf `"0.4.275-beta"`.

Falls eine Kriterie unklar ist: **nachfragen**, nicht still annehmen.

## Hinweise

- Im Code ausschließlich ASCII-Anführungszeichen `"` und `'`.
- Reiner Logik-/Vorzeichen-Fix, keine UI-Texte — die Sprachdateien
  (`en.js`/`fr.js`/`es.js`) sind **nicht** betroffen, Übersetzungen entfallen.
