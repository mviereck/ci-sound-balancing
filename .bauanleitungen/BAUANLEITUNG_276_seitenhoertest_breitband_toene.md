# BA 276 — Seitenhörtest: Breitband-Bursts mit Tonhöhenwahl

**Ziel-Version nach Build:** `0.4.276-beta` (in `js/version.js`)

## Worum es geht

Der Seitenhörtest ist das Modal, das vor jedem Mess-Verfahren erscheint
und fragt „Auf welcher Seite hören Sie den Ton?". Heute spielt er einen
festen 1000-Hz-Komplexton. Problem: ein schmalbandiger Ton fällt auf
eine einzelne Elektrode — ist die leise oder stumm, hört der Nutzer
nichts und meldet fälschlich „Nichts".

Lösung: Statt des festen Tons werden die **drei Breitband-Tonbursts aus
dem Latenztest** wiederverwendet (500 / 1500 / 4000 Hz). Sie sind sehr
kurz und dadurch spektral breit — die Energie verteilt sich über mehrere
Elektroden, also ist mindestens eine zuverlässig hörbar. Der Nutzer kann
zwischen drei Tonhöhen wählen (Tief / Mittel / Hoch), Default „Tief". Die
Wahl wird über Sitzungen hinweg gemerkt. Eine Lautstärke-Korrektur ist
**nicht** Teil dieser BA.

Damit ein einzelner Burst (unter Millisekunden lang) sicher hör- und
ortbar ist, wird er als **kurze Tonfolge** abgespielt (5 Bursts im
200-ms-Takt, also rund 1 Sekunde), hart auf die Prüfseite gepannt.

Alles spielt sich in `js/test-ui.js` (IIFE des Seitenhörtests) plus
vier neue i18n-Keys in `i18n/de.js` ab. Keine neue Datei, keine neue
globale Variable (alles modul-lokal innerhalb der IIFE).

---

## Schritt 0 — Versionsbump (Pflicht)

`js/version.js`:

```js
const APP_VERSION = "0.4.276-beta";
```

---

## Schritt 1 — Band-State + Persistenz (js/test-ui.js)

Die `_sht*`-Variablen stehen ab Z. 1727. Direkt **nach** der Zeile

```js
  var _shtAskSide = null;
```

folgenden Block einfügen:

```js
  // BA 276: Drei Breitband-Burst-Stufen, wiederverwendet aus dem
  // Latenztest (latBuildBurstBuffer). hz/durMs exakt wie die dortigen
  // Klangtypen burst500 / burst1500 / burst4000 (js/latency.js Z. 91-93).
  var _SHT_BANDS = {
    low:  { hz: 500,  durMs: 6 },
    mid:  { hz: 1500, durMs: 4 },
    high: { hz: 4000, durMs: 3 }
  };
  // Tonfolge: 5 Bursts im 200-ms-Takt (rund 1 s), damit der kurze Burst
  // sicher hör- und ortbar ist.
  var _SHT_TRAIN_COUNT = 5;
  var _SHT_TRAIN_INTERVAL_S = 0.20;
  // Gain gegen Clipping: ein StereoPanner summiert bei hartem Pan (pan=-1
  // bzw. +1) BEIDE Buffer-Kanäle auf eine Seite. Der Burst-Buffer hat L=R
  // mit Amplitude 0.9 -> ohne Dämpfung läge die Spitze bei 1.8 und würde
  // clippen. 0.4 hält die Summe sicher unter 1.0.
  var _SHT_GAIN = 0.4;

  // BA 276: gewählte Stufe, persistent in localStorage ("ci-lb-shtBand").
  // Default "low" (Tief).
  var _shtBand = 'low';
  function _shtLoadBand() {
    try {
      var v = localStorage.getItem('ci-lb-shtBand');
      if (v === 'low' || v === 'mid' || v === 'high') _shtBand = v;
    } catch (e) { /* localStorage kann fehlen — Default behalten */ }
  }
  function _shtSetBand(band) {
    if (band !== 'low' && band !== 'mid' && band !== 'high') return;
    _shtBand = band;
    try {
      localStorage.setItem('ci-lb-shtBand', band);
    } catch (e) { /* ignorieren */ }
  }
  _shtLoadBand();
```

---

## Schritt 2 — Prüfton als Burst-Folge abspielen (js/test-ui.js)

Die bestehende Funktion `_shtPlayTone` (Z. 1800-1802) lautet:

```js
  function _shtPlayTone(side) {
    playToneTyped(gAC(), 1000, 0.25, 1000, side === 'left' ? -1 : 1, 'complex');
  }
```

**Vollständig ersetzen** durch:

```js
  function _shtPlayTone(side) {
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;
    if (typeof latBuildBurstBuffer !== 'function') return;
    var band = _SHT_BANDS[_shtBand] || _SHT_BANDS.low;
    var buf = latBuildBurstBuffer(c, band.hz, band.durMs);
    var pan = (side === 'left') ? -1 : 1;
    var t0 = c.currentTime + 0.02;
    for (var i = 0; i < _SHT_TRAIN_COUNT; i++) {
      var src = c.createBufferSource();
      src.buffer = buf;
      var g = c.createGain();
      g.gain.value = _SHT_GAIN;
      var p = c.createStereoPanner();
      p.pan.value = pan;
      src.connect(g);
      g.connect(p);
      p.connect(c.destination);
      try { src.start(t0 + i * _SHT_TRAIN_INTERVAL_S); } catch (e) { /* swallow */ }
    }
  }
```

Hinweis: `latBuildBurstBuffer` ist eine globale Funktion aus
`js/latency.js` und zur Laufzeit (Nutzer klickt „Test starten")
längst geladen. Der `typeof`-Guard schützt nur gegen Aufruf vor
vollständigem Script-Load.

Der Burst-Buffer ist bereits Hann-gefenstert (kein Knacken); die globale
Ton-Hüllkurve (`gToneEnv*`) gilt hier bewußt **nicht** — sie betrifft nur
oszillatorbasierte Töne.

---

## Schritt 3 — Tonhöhen-Knöpfe im Dialog (js/test-ui.js)

In `_shtInitDom` (ab Z. 1744). Die `replayRow` wird heute so gebaut:

```js
    var replayRow = _mkEl('div', 'btn-group');
    var replayBtn = _mkEl('button', 'btn');
    replayBtn.dataset.t   = 'shtBtnReplay';
    replayBtn.textContent = _shtT('shtBtnReplay');
    replayRow.appendChild(replayBtn);
```

**Direkt davor** eine Band-Wahl-Zeile einfügen, und die Refresh-Funktion
für die aktiven Stile bereitstellen. Neuer Block (vor `var replayRow`):

```js
    // BA 276: Tonhöhen-Wahl (Tief / Mittel / Hoch). Aktiver Knopf
    // bekommt zusätzlich die Klasse 'btn-primary'.
    var bandRow = _mkEl('div', 'btn-group sht-band-row');
    var bandLbl = _mkEl('span');
    bandLbl.dataset.t   = 'shtBandLabel';
    bandLbl.textContent = _shtT('shtBandLabel');
    bandLbl.style.marginRight = '0.5em';
    var bandBtnLow  = _mkEl('button', 'btn'); bandBtnLow.dataset.t  = 'shtBandLow';  bandBtnLow.textContent  = _shtT('shtBandLow');
    var bandBtnMid  = _mkEl('button', 'btn'); bandBtnMid.dataset.t  = 'shtBandMid';  bandBtnMid.textContent  = _shtT('shtBandMid');
    var bandBtnHigh = _mkEl('button', 'btn'); bandBtnHigh.dataset.t = 'shtBandHigh'; bandBtnHigh.textContent = _shtT('shtBandHigh');
    bandRow.append(bandLbl, bandBtnLow, bandBtnMid, bandBtnHigh);

    function _shtRefreshBandBtns() {
      bandBtnLow.className  = 'btn' + (_shtBand === 'low'  ? ' btn-primary' : '');
      bandBtnMid.className  = 'btn' + (_shtBand === 'mid'  ? ' btn-primary' : '');
      bandBtnHigh.className = 'btn' + (_shtBand === 'high' ? ' btn-primary' : '');
    }
    _shtRefreshBandBtns();

    function _shtPickBand(band) {
      _shtSetBand(band);
      _shtRefreshBandBtns();
      // Sofort zur Probe abspielen, mit der gerade geprüften Seite.
      _shtPlayTone(_shtAskSide);
    }
    bandBtnLow.onclick  = function() { _shtPickBand('low');  };
    bandBtnMid.onclick  = function() { _shtPickBand('mid');  };
    bandBtnHigh.onclick = function() { _shtPickBand('high'); };
```

Dann die `phaseBtns`-Zusammensetzung (heute Z. 1766-1768):

```js
    var phaseBtns = _mkEl('div', 'sht-phase-btns');
    phaseBtns.style.marginTop = '0.8em';
    phaseBtns.append(replayRow, ansRow);
```

ändern zu — `bandRow` als erste Zeile mit aufnehmen:

```js
    var phaseBtns = _mkEl('div', 'sht-phase-btns');
    phaseBtns.style.marginTop = '0.8em';
    phaseBtns.append(bandRow, replayRow, ansRow);
```

`bandRow` liegt damit in `phaseBtns` und ist automatisch nur in der
Frage-Phase sichtbar (in der Fehler-Phase wird `phaseBtns.hidden = true`
gesetzt).

---

## Schritt 4 — i18n-Keys (i18n/de.js)

Nach Z. 920 (`shtSymRightWrong: ...`) die vier neuen Keys einfügen:

```js
    shtBandLabel:    "Tonhöhe:",
    shtBandLow:      "Tief",
    shtBandMid:      "Mittel",
    shtBandHigh:     "Hoch",
```

(Nur Deutsch — siehe Hinweis am Ende. Ausschließlich ASCII-`"` als
String-Begrenzer.)

---

## Schritt 5 — Spec mitpflegen (docs/spec/02-messung.md)

Im Abschnitt „Seitenhörtest vor Test-Start" (ab Z. 522) die Button-Liste
und eine Tonbeschreibung aktualisieren. Den Satz mit der Button-Liste
(Z. 527-528) so erweitern, daß die neue Tonhöhen-Wahl genannt ist, z. B.:

> Tonhöhen-Wahl [Tief] [Mittel] [Hoch] (Default Tief, gemerkt), darunter
> Buttons: [Ton wiederholen] [Links] [Rechts] [Beide] [Nichts]
> [Abbrechen].

Und einen Satz ergänzen, daß der Prüfton seit BA 276 ein Breitband-Burst
aus dem Latenztest ist (500 / 1500 / 4000 Hz), als kurze Tonfolge
abgespielt, ohne Lautstärke-Korrektur. Knapp halten, im Stil des
umgebenden Texts.

---

## Akzeptanztest (vom Nutzer durchklickbar)

1. Browser neu laden, Version unten muß `0.4.276-beta` zeigen.
2. Reiter „Messungen" → „Elektrodenlautstärke" → „Test starten".
   - Erwartet: Modal „Seitenhörtest". Oben eine Zeile „Tonhöhe:" mit
     drei Knöpfen Tief / Mittel / Hoch, **Tief** hervorgehoben.
   - Erwartet: ein kurzes Ticken (mehrere Bursts hintereinander, knapp
     1 s) auf einer Seite — bei „beide Seiten"-Tests zuerst links.
3. Auf „Mittel" klicken: Knopf wird hervorgehoben, sofort ertönt die
   Tonfolge erneut, hörbar höher. „Hoch" klicken: noch höher.
4. „Ton wiederholen" spielt die zuletzt gewählte Tonhöhe erneut.
5. Test korrekt beantworten, durchführen. Erneut „Test starten":
   - Erwartet: die zuletzt gewählte Tonhöhe ist noch aktiv.
6. Seite komplett neu laden, Test erneut starten:
   - Erwartet: die gemerkte Tonhöhe ist weiterhin aktiv (Persistenz).
7. Gegenprobe „unverändert": Stereo-Balance, Latenz und Frequenzabgleich
   zeigen denselben Seitenhörtest mit denselben drei Tonhöhen-Knöpfen;
   die Routing-Erkennung (Links/Rechts/Beide/Nichts → richtig/falsch)
   funktioniert wie zuvor.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–7) einzeln durchgehen
und mit Datei + Zeile als erfüllt / nicht erfüllt / unklar melden.
Besonders prüfen:

- `_SHT_BANDS` hz/durMs stimmen mit `js/latency.js` Z. 91-93 überein.
- Kein Clipping-Risiko: `_SHT_GAIN` ist im Signalpfad
  (BufferSource → Gain → StereoPanner → destination).
- `bandRow` liegt in `phaseBtns` (verschwindet in der Fehler-Phase).
- Persistenz-Key `ci-lb-shtBand`, Default `low` bei fehlendem/defektem
  Wert.
- Nur die vier neuen de.js-Keys hinzugefügt, keine anderen Sprachdateien
  angefaßt.

---

## Hinweis i18n

Diese BA fügt nur deutsche Texte hinzu (`shtBandLabel`, `shtBandLow`,
`shtBandMid`, `shtBandHigh`). Die anderen Sprachen (en/fr/es) sind nicht
angefaßt; fehlende Keys fallen automatisch auf den deutschen Default
zurück. Übersetzungen folgen, wenn der Nutzer dazu auffordert.
