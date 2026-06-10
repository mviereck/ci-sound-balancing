# Bauanleitung 48 — Messungen-Audio: Elektrodenlautstärke und Stereo-Balance ergänzen

## Worum es geht

In den drei Messungen unter „Messungen" werden die Korrekturen aus
früheren Messungen (Elektrodenlautstärke-Ausgleich, Stereo-Balance)
bisher uneinheitlich angewendet. Befund:

- **Stereo-Balance-Test (`lr-balance.js`)**: Elektrodenlautstärke wird
  bereits korrekt pro Seite angewendet (`lrCorrGain` ruft `compWLS`
  unter `withSide`). Stereo-Balance wird hier bewußt nicht angewendet
  — sie ist gerade Gegenstand der Messung. **Keine Änderung nötig.**
- **Frequenzabgleich (`freqmatch.js`)**: Weder Elektrodenlautstärke
  noch Stereo-Balance werden angewendet. `playToneTyped` läuft direkt
  an `c.destination`. **Beides muß ergänzt werden.**
- **Latenz (`latency.js`)**: Klick-Buffer geht durch `pGain → pLatSplitter
  → pLatDelayL/R → pLatMerger → destination`. `pGain` ist ein Mono-
  Gain-Knoten — die im Player vorhandene L/R-Balance-Gain-Aufteilung
  (`pChannelLeftGain`/`pChannelRightGain`) liegt im EQ-Pfad und wird
  vom Latenz-Test umgangen. Elektrodenlautstärke wird beim Latenz-
  Test bewußt **nicht** angewendet (Klicks sind breitband, kein
  Elektroden-Bezug). **Stereo-Balance muß ergänzt werden.**

Ziel: Bei Frequenzabgleich werden Tonpaare unter Berücksichtigung der
pro-Seite-Elektrodenlautstärke und der Stereo-Balance gespielt. Bei
Latenz werden Klicks unter Berücksichtigung der Stereo-Balance gespielt.

Sowohl `getPlayerBalance()` als auch `getPlayerBalanceGains()` aus
`state-side.js` respektieren bereits `plApplyBalance`: ist die Checkbox
„Stereo-Balance anwenden" aus, liefern beide `0` bzw. `{left:0, right:0}`.
Wir müssen den Toggle also nicht separat abfragen.

### Zuordnung von Korrektur-Gains zu den Tönen

Im Frequenzabgleich wird auf der **variablen Seite** die CI-Frequenz
der gerade gewählten Elektrode (`fmCurrentEl`) gespielt. Auf der
**Referenzseite** wird eine vom User um Cents verschobene Frequenz
gespielt, die keiner festen Elektrode entspricht.

Vorgehen:

- **Var-Seite**: Korrektur-Gain für die explizit gewählte Elektrode
  `fmCurrentEl` (via `compWLS` unter `withSide(fmVarSide, …)`).
- **Ref-Seite**: Die verschobene Frequenz liegt in der Regel zwischen
  zwei Elektroden. Der Korrektur-Gain wird **anteilig zwischen den
  beiden umgebenden Elektroden interpoliert** — in **dB linear auf
  log-Hz-Achse** (Elektrodenfrequenzen sind typischerweise
  logarithmisch verteilt; die wahrgenommene Lautheit folgt der dB-
  Skala). Liegt die Frequenz unter der niedrigsten oder über der
  höchsten Elektrode, wird der Randwert genommen (keine
  Extrapolation).

Das gilt sowohl für CI- als auch für akustische Seiten — auch bei
Schwerhörigkeit liefert die Elektrodenlautstärke-Messung pro Pseudo-
Elektrode Korrektur-Levels, die auf den Frequenzabgleich angewendet
werden sollen. Sind tatsächlich keine Meßdaten vorhanden (`bRes` leer
oder `compWLS` liefert nichts), bleibt der Gain 1.

## Stelle 1 — `freqmatch.js`: Helper für Korrektur-Gain pro Seite

In `freqmatch.js` direkt nach dem Block der `fmG*`-Hilfsfunktionen
(aktuell endet bei Z. 39 mit `fmGAba`), **vor** `fmVarHz(elIdx)` (Z. 42),
folgenden Helper einfügen:

```js
// Korrektur-Gain (Elektrodenlautstärke) für eine Seite bei gegebener
// Frequenz. Liefert den dB-Korrekturwert anteilig zwischen den beiden
// umgebenden Elektroden interpoliert (dB linear auf log-Hz-Achse).
// Unterhalb der niedrigsten / oberhalb der höchsten Elektrode wird
// der Randwert verwendet (keine Extrapolation). Liefert 1, wenn die
// Seite keine Meßdaten hat oder die Korrektur-Funktion fehlt.
function fmCorrGain(side, hz) {
  return withSide(side, () => {
    if (typeof bRes === "undefined" || !bRes || bRes.length === 0) return 1;
    if (typeof compWLS !== "function") return 1;
    const f = (typeof freqs !== "undefined" && freqs) ? freqs : null;
    if (!f || f.length === 0) return 1;
    const { levels } = compWLS();
    if (!levels || !levels.length) return 1;

    // Frequenzen aufsteigend annehmen (Standard). Falls absteigend
    // verpackt, hier ohne Sortierung fortfahren — die Suche unten
    // findet trotzdem das passende Intervall, solange die Reihenfolge
    // monoton ist.
    const n = f.length;
    const lg = Math.log(hz);

    // Randfälle: vor dem ersten oder nach dem letzten Eintrag
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

    // Suche das umgebende Intervall [i, i+1]
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
        // lineare Interpolation in dB auf log-Hz-Achse
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

## Stelle 2 — `freqmatch.js`: `fmPlayCurrent` — Korrektur und Balance anwenden

Aktuell ab Z. 135 im Block `fmPlayCurrent`:

```js
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const pau = fmGPau();
  const aba = fmGAba();

  const c = gAC();
  function playOne(side, hz) {
    const pan = side === "left" ? -1 : 1;
    const effectiveVol = isDeaf(side) ? 0 : vol;
    return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType);
  }
```

Ersetzen durch:

```js
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const pau = fmGPau();
  const aba = fmGAba();

  // Stereo-Balance (dB pro Seite; berücksichtigt plApplyBalance intern)
  const balG = (typeof getPlayerBalanceGains === "function")
    ? getPlayerBalanceGains() : { left: 0, right: 0 };

  const c = gAC();
  function playOne(side, hz) {
    const pan = side === "left" ? -1 : 1;
    const corr = fmCorrGain(side, hz);
    const balDb = side === "left" ? balG.left : balG.right;
    const effectiveVol = isDeaf(side) ? 0 : vol * corr * dB2G(balDb);
    return playToneTyped(c, hz, effectiveVol, ms, pan, globalToneType);
  }
```

(Nur die letzten drei Zeilen im `playOne`-Body sind geändert; die
beiden neuen Zeilen davor (`corr`, `balDb`) sind hinzugekommen. Der
Rest der Funktion bleibt unverändert.)

## Stelle 3 — `freqmatch.js`: `fmPlaySimul` — Korrektur und Balance anwenden

Aktuell ab Z. 210 in `fmPlaySimul`:

```js
  const c = gAC();
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const refPan = fmRefSide === "left" ? -1 : 1;
  const varPan = fmVarSide === "left" ? -1 : 1;
  isPlay = true;
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.add('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
  await Promise.all([
    playToneTyped(c, refHz, isDeaf(fmRefSide) ? 0 : vol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, isDeaf(fmVarSide) ? 0 : vol, ms, varPan, globalToneType)
  ]);
```

Ersetzen durch:

```js
  const c = gAC();
  const varHz = fmVarHz(fmCurrentEl);
  const refHz = fmFreqFromCents(varHz, fmCentOffset);
  const vol = fmGVol();
  const ms = fmGDur();
  const refPan = fmRefSide === "left" ? -1 : 1;
  const varPan = fmVarSide === "left" ? -1 : 1;

  const balG = (typeof getPlayerBalanceGains === "function")
    ? getPlayerBalanceGains() : { left: 0, right: 0 };
  const refCorr = fmCorrGain(fmRefSide, refHz);
  const varCorr = fmCorrGain(fmVarSide, varHz);
  const refBalDb = fmRefSide === "left" ? balG.left : balG.right;
  const varBalDb = fmVarSide === "left" ? balG.left : balG.right;
  const refVol = isDeaf(fmRefSide) ? 0 : vol * refCorr * dB2G(refBalDb);
  const varVol = isDeaf(fmVarSide) ? 0 : vol * varCorr * dB2G(varBalDb);

  isPlay = true;
  if (fmEls && fmEls.pairLeft) fmEls.pairLeft.classList.add('playing');
  if (fmEls && fmEls.pairRight) fmEls.pairRight.classList.add('playing');
  await Promise.all([
    playToneTyped(c, refHz, refVol, ms, refPan, globalToneType),
    playToneTyped(c, varHz, varVol, ms, varPan, globalToneType)
  ]);
```

## Stelle 4 — `latency.js`: Stereo-Balance-Gains in den Klick-Pfad

Aktuell in `latStartTest` (ab Z. 133), Audio-Quelle wird so verbunden:

```js
  latTestBuf = latBuildLoopedTestBuffer(ctx, latClickType, latIntervalMs);
  latTestSource = ctx.createBufferSource();
  latTestSource.buffer = latTestBuf;
  latTestSource.loop = true;
  // Direkt an pGain — geht durch Lautstärke-Regler und durch die
  // Latenz-Delays. Falls pGain noch nicht existiert, an die
  // Latenz-Kette direkt anschließen (Fallback).
  if (typeof pGain !== "undefined" && pGain) {
    latTestSource.connect(pGain);
  } else if (pLatSplitter) {
    latTestSource.connect(pLatSplitter);
  } else {
    latTestSource.connect(ctx.destination);
  }
  latTestSource.start();
  latActive = true;
```

Ersetzen durch:

```js
  latTestBuf = latBuildLoopedTestBuffer(ctx, latClickType, latIntervalMs);
  latTestSource = ctx.createBufferSource();
  latTestSource.buffer = latTestBuf;
  latTestSource.loop = true;

  // Stereo-Balance-Gains (vor pGain). Splitter + L/R-Gains + Merger
  // entstehen pro Test und werden beim Stop wieder verworfen.
  const balG = (typeof getPlayerBalanceGains === "function")
    ? getPlayerBalanceGains() : { left: 0, right: 0 };
  latBalSplitter = ctx.createChannelSplitter(2);
  latBalMerger   = ctx.createChannelMerger(2);
  latBalGainL    = ctx.createGain();
  latBalGainR    = ctx.createGain();
  latBalGainL.gain.value = dB2G(balG.left);
  latBalGainR.gain.value = dB2G(balG.right);
  latTestSource.connect(latBalSplitter);
  latBalSplitter.connect(latBalGainL, 0);
  latBalSplitter.connect(latBalGainR, 1);
  latBalGainL.connect(latBalMerger, 0, 0);
  latBalGainR.connect(latBalMerger, 0, 1);

  if (typeof pGain !== "undefined" && pGain) {
    latBalMerger.connect(pGain);
  } else if (pLatSplitter) {
    latBalMerger.connect(pLatSplitter);
  } else {
    latBalMerger.connect(ctx.destination);
  }
  latTestSource.start();
  latActive = true;
```

Anschließend im `latStopTest` (aktuell ab Z. 163) das Disconnect der
Balance-Knoten ergänzen. Bisheriger Block:

```js
function latStopTest() {
  if (latTestSource) {
    try { latTestSource.stop(); } catch (e) {}
    try { latTestSource.disconnect(); } catch (e) {}
    latTestSource = null;
  }
  latTestBuf = null;
  latActive = false;
}
```

Ersetzen durch:

```js
function latStopTest() {
  if (latTestSource) {
    try { latTestSource.stop(); } catch (e) {}
    try { latTestSource.disconnect(); } catch (e) {}
    latTestSource = null;
  }
  if (latBalSplitter) { try { latBalSplitter.disconnect(); } catch (e) {} latBalSplitter = null; }
  if (latBalGainL)    { try { latBalGainL.disconnect();    } catch (e) {} latBalGainL = null; }
  if (latBalGainR)    { try { latBalGainR.disconnect();    } catch (e) {} latBalGainR = null; }
  if (latBalMerger)   { try { latBalMerger.disconnect();   } catch (e) {} latBalMerger = null; }
  latTestBuf = null;
  latActive = false;
}
```

Zusätzlich die vier neuen State-Variablen am Anfang von `latency.js`
deklarieren. Suche nach der bestehenden State-Deklaration für
`latTestSource` (vermutlich im oberen State-Block der Datei). Direkt
darunter ergänzen:

```js
let latBalSplitter = null;
let latBalGainL    = null;
let latBalGainR    = null;
let latBalMerger   = null;
```

Falls die State-Variablen mit `var` deklariert sind, ebenfalls `var`
nutzen — Stil der Datei beibehalten.

## Stelle 5 — `SPEC.md` / `spec/`

Im Kapitel zu **Messungen** (Datei unter `spec/`, das die drei Sub-Tabs
beschreibt) für **Frequenzabgleich** ergänzen:

> Audio-Pfad: jeder Ton wird vor `playToneTyped` mit der Korrektur-
> Lautstärke der Seite und der Stereo-Balance-Korrektur
> (`getPlayerBalanceGains`) multipliziert. Die Korrektur-Lautstärke
> kommt aus `compWLS` der jeweiligen Seite: bei der variablen Seite
> für die explizit gewählte Elektrode, bei der Referenzseite anteilig
> zwischen den beiden umgebenden Elektroden interpoliert (dB linear
> auf log-Hz-Achse). Beide Korrekturen werden nur angewendet, wenn die
> jeweilige Quelle Daten hat (Elektrodenlautstärke nur, wenn `bRes`
> der Seite gefüllt ist; Balance nur, wenn `plApplyBalance` an und
> `lrResults` gefüllt ist). Kurven und Schieber bleiben
> unberücksichtigt — bewußt, weil die Messung nur die Roh-Korrektur
> abbilden soll. Bei akustischen Seiten wirkt die Korrektur genauso
> wie bei CI-Seiten, weil die Messung dort Pseudo-Elektroden
> verwendet.

Für **Latenz** ergänzen:

> Audio-Pfad: Klick-Buffer → ChannelSplitter → L/R-Gain (aus
> `getPlayerBalanceGains`) → ChannelMerger → `pGain` →
> `pLatSplitter` → `pLatDelayL`/`pLatDelayR` → `pLatMerger` →
> `destination`. Die Stereo-Balance-Gains werden beim Test-Start
> aus dem aktuellen Stand übernommen und beim Test-Ende wieder
> verworfen. Elektrodenlautstärke wird nicht angewendet, weil die
> Klicks breitband sind und keiner Elektrode zugeordnet werden.

## Stelle 6 — `CODESTRUKTUR.md`

Im Abschnitt **„Latenz-Kompensation (Inter-Ohr-Zeitversatz)"** im
Datenfluss-Block ergänzen:

> Während eines laufenden Latenz-Tests sitzt zusätzlich eine
> Balance-Stage zwischen `latTestSource` und `pGain` (Splitter +
> `latBalGainL`/`latBalGainR` + Merger). Die Gain-Werte kommen aus
> `getPlayerBalanceGains()` und werden beim Test-Start gesetzt und
> beim Stop verworfen.

Im Abschnitt zur `freqmatch.js`-Modulbeschreibung in der Modul-Tabelle
(aktuell Zeile 113 in CODESTRUKTUR.md, `| 9  | freqmatch.js | …`) den
Helper-Namen `fmCorrGain` nachtragen.

## Akzeptanztest-Checkliste (manuell im Browser)

### Vorbereitung

1. Werkzeug laden. Eine vollständige Elektrodenlautstärke-Messung auf
   beiden Seiten durchführen (`bRes` muß gefüllt sein), so daß
   `compWLS` deutliche Korrekturen liefert (z. B. Schieber-Werte
   stark abweichend zwischen tiefen und hohen Elektroden).
2. Stereo-Balance-Messung durchführen mit eindeutigem Offset (z. B.
   linke Seite klar lauter eingestellt).
3. Checkbox „Stereo-Balance anwenden" (Player oder zentral) an.

### Test A — Frequenzabgleich nutzt Elektrodenlautstärke

1. Tab Messungen → Sub-Tab Frequenzabgleich. Test starten.
2. Bei einer tiefen und bei einer hohen Elektrode jeweils Tonpaare
   hören. Erwartet: die wahrgenommene Lautheit pro Seite folgt
   der Korrektur (laut/leise je nach Elektrode), nicht dem rohen
   `vol`-Wert. Schiebt man die Schieber-Werte zwischen Tests
   spürbar um, ändert sich der wahrgenommene Pegel im Frequenz-
   abgleich-Test sofort beim nächsten Tonpaar.
3. Konsole: während `fmPlayCurrent` läuft, `fmCorrGain("left", 1000)`
   und `fmCorrGain("right", 1000)` aufrufen — Werte sollten dB-
   sinnvoll sein, nicht stets 1.

### Test B — Frequenzabgleich nutzt Stereo-Balance

1. Stereo-Balance-Checkbox aus. Frequenzabgleich-Test starten,
   Tonpaar hören und L/R-Verhältnis subjektiv merken.
2. Test stoppen, Stereo-Balance-Checkbox an. Test wieder starten.
3. Erwartet: das L/R-Verhältnis hat sich gemäß
   `getPlayerBalanceGains()` verschoben.

### Test C — Latenz nutzt Stereo-Balance

1. Sub-Tab Latenz. Stereo-Balance-Checkbox aus. Test starten,
   Klicks hören (Lautstärke L vs. R merken).
2. Test stoppen, Checkbox an. Test wieder starten.
3. Erwartet: das L/R-Verhältnis der Klicks hat sich gemäß
   `getPlayerBalanceGains()` verschoben.
4. Konsole während laufendem Latenz-Test:
   `latBalGainL.gain.value`, `latBalGainR.gain.value` ausgeben —
   sollten zu `dB2G(getPlayerBalanceGains().left/right)` passen.

### Test D — Sauberkeit nach Stop

1. Latenz-Test starten und sofort wieder stoppen.
2. Konsole: `latBalSplitter`, `latBalGainL`, `latBalGainR`,
   `latBalMerger` sollten alle `null` sein.

### Test E — Keine Regression bei Stereo-Balance-Test

1. Sub-Tab Stereo-Balance. Test starten.
2. Erwartet: die bisherige `lrCorrGain`-Logik funktioniert
   unverändert (Elektrodenlautstärke wird angewendet), und die
   Stereo-Balance selbst ist weiterhin Gegenstand der Messung
   (kein Balance-Offset im Test).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–E einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Wird `fmCorrGain` in **beiden** `playOne`-Stellen (in `fmPlayCurrent`
  und `fmPlaySimul`) genutzt? `fmPlaySimul` hat zwei `playToneTyped`-
  Aufrufe in einem `Promise.all`; beide müssen korrekt skaliert sein.
- Funktioniert die Interpolation für alle Fälle: exakt auf einer
  Elektrode liegende Frequenz, Frequenz zwischen zwei Elektroden,
  Frequenz unterhalb der niedrigsten / oberhalb der höchsten
  Elektrode (Rand-Werte), Seite ohne Meßdaten (`bRes` leer →
  Gain = 1)? Keine Exception in allen Fällen.
- Sind in `latStopTest` alle vier Balance-Knoten zuverlässig
  disconnected, auch wenn der Test ohne `latTestSource` gestoppt wird
  (z. B. weil `latStartTest` einen Fehler hatte)?
- Werden bei einem `latRestartIfActive`-Zyklus (Stop+Start in Folge)
  die Balance-Knoten korrekt neu aufgebaut und alte Knoten verworfen,
  also kein Memory-Leak und kein Doppelpfad?
- Ist `getPlayerBalanceGains` zum Zeitpunkt der `playOne`/`latStartTest`-
  Aufrufe garantiert verfügbar? `state-side.js` lädt vor `audio.js`,
  und beide Test-Module laden später — also ja. Trotzdem schadet der
  `typeof === "function"`-Guard nicht.

Bei Unklarheit Rückfrage statt Annahme.
