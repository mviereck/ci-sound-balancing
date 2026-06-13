# BA 284 — Zwei-Zonen-Pegellogik + Lautstärke-Default 50 % (Elektrodenlautstärke)

**Ziel-Version nach Build:** `0.4.284-beta`

## Kontext

Im Elektrodenlautstärke-Test verschiebt der Slider die Lautstärke der
beiden Töne A und B gegeneinander. Nach BA 283 rechnen beide Abspielwege
(nacheinander = `playSeq` in `js/audio.js`; gleichzeitig =
`_testPlaySimul` in `js/test.js`) symmetrisch: `-off/2` auf A, `+off/2`
auf B, danach hartes Deckeln bei Maximalpegel (`Math.min(..., 1)`).

**Zwei Probleme dieser Fassung:**

1. **Messfehler im Deckelungsfall.** Erreicht ein Ton den Maximalpegel,
   wird er gedeckelt, der andere aber nur um `off/2` abgesenkt. Der
   tatsächliche Lautstärkeunterschied ist dann nur **halb** so groß wie
   der Slider anzeigt (Beispiel: Tool-Lautstärke 100 %, Slider +6 dB →
   echter Unterschied nur 3 dB). Gespeichert wird aber der Slider-Wert →
   die Messung ist um Faktor 2 verfälscht.
2. **Nur ein Ton bewegt sich.** Bei zu wenig Reserve nach oben klebt ein
   Ton am Maximum; gewünscht ist, dass sich **beide** Töne bewegen.

**Lösung dieser BA (zwei Teile):**

- **Zwei-Zonen-Pegellogik** in einer gemeinsamen Funktion `pairGains`,
  die `playSeq` und `_testPlaySimul` beide nutzen (beseitigt zugleich die
  bisher duplizierte Pegelformel):
  - *Zone 1* (genug Reserve): symmetrisch `±off/2` → beide Töne bewegen
    sich, Unterschied = Slider-Wert.
  - *Zone 2* (ein Ton an der Decke): der lautere Ton bleibt exakt am
    Maximum, der andere wird um den **vollen** `off` abgesenkt → der
    Lautstärkeunterschied entspricht **immer** dem Slider-Wert.
- **Default-Tool-Lautstärke von 75 % auf 50 %.** Das ergibt ca. 12 dB
  Reserve nach oben und deckt den gesamten Standard-Slider (±20 dB) ab —
  im Normalbetrieb tritt Zone 2 damit gar nicht erst auf.

Die Rückgabe von `pairGains` enthält bereits ein Feld `capped` (welcher
Ton an der Decke klebt). Es wird in dieser BA noch nicht ausgewertet,
ist aber die Schnittstelle für **BA 285** (Deckelungs-Hinweis). Bitte
exakt wie angegeben zurückgeben.

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'` verwenden.**

---

## Schritt 1 — `js/audio.js`: gemeinsame Funktion `pairGains`

`dB2G` ist global in `js/audio.js` definiert und wird von `js/test.js`
bereits genutzt (Ladereihenfolge: `audio.js` vor `test.js`). Die neue
Funktion gehört daneben, **direkt vor** `async function playSeq`
(aktuell Z. 1037).

Neue Funktion einfügen:

```js
// BA 284: Zentrale Pegel-Aufteilung fuer ein Tonpaar (Elektrodenlautstaerke).
//   vol = Grundpegel-Amplitude (0..1), off = Slider-Offset in dB.
// Zone 1 (genug Headroom): symmetrisch -off/2 auf A, +off/2 auf B.
// Zone 2 (ein Ton an der Decke): der lautere Ton bleibt bei 1.0, der
//   andere wird um den VOLLEN off abgesenkt -> der Lautstaerkeunterschied
//   entspricht immer exakt dem Slider-Wert.
// Rueckgabe: { vA, vB, capped } mit capped = null | 'a' | 'b'
//   (welcher Ton an der Decke klebt; von BA 285 fuer den Hinweis genutzt).
function pairGains(vol, off) {
  var halfOff = off / 2;
  var aIdeal = vol * dB2G(-halfOff);
  var bIdeal = vol * dB2G(halfOff);
  if (aIdeal <= 1 && bIdeal <= 1) {
    return { vA: aIdeal, vB: bIdeal, capped: null };
  }
  if (bIdeal > 1) {
    // off > 0: B ist der lautere -> Decke; A voll abgesenkt.
    return { vA: dB2G(-off), vB: 1, capped: 'b' };
  }
  // off < 0: A ist der lautere -> Decke; B voll abgesenkt.
  return { vA: 1, vB: dB2G(off), capped: 'a' };
}
```

---

## Schritt 2 — `js/audio.js`: `playSeq` nutzt `pairGains`

**Vorher** (Z. 1041–1045):

```js
  const v = gVol(), d = gDur(), p = gPau();
  // Symmetrische Verschiebung: off/2 zu B, -off/2 zu A
  const halfOff = off / 2;
  const vA = Math.max(Math.min(v * dB2G(-halfOff), 1), 0);
  const vB = Math.max(Math.min(v * dB2G(halfOff), 1), 0);
```

**Nachher:**

```js
  const v = gVol(), d = gDur(), p = gPau();
  // BA 284: Zwei-Zonen-Pegellogik (symmetrisch; bei Deckelung voller
  // Offset auf den nicht-gedeckelten Ton). Siehe pairGains.
  const g = pairGains(v, off);
  const vA = g.vA, vB = g.vB;
```

> Der Rest von `playSeq` (Indikatoren, `playTone`, Pausen, ABA) bleibt
> unverändert.

---

## Schritt 3 — `js/test.js`: `_testPlaySimul` nutzt `pairGains`

**Vorher** (Z. 1361–1368, nach BA 283):

```js
  var vol = tGVol();
  var dur = tGDur();
  // BA 283: symmetrische Verschiebung wie in playSeq (audio.js):
  // -tot/2 zu A, +tot/2 zu B. Beide Toene werden bewegt, gleiche
  // Wirkungsrichtung wie beim Nacheinander-Abspielen.
  var halfOff = tot / 2;
  var vA = Math.max(Math.min(vol * dB2G(-halfOff), 1), 0);
  var vB = Math.max(Math.min(vol * dB2G(halfOff), 1), 0);
```

**Nachher:**

```js
  var vol = tGVol();
  var dur = tGDur();
  // BA 284: gemeinsame Zwei-Zonen-Pegellogik wie playSeq (audio.js).
  var g = pairGains(vol, tot);
  var vA = g.vA, vB = g.vB;
```

> Der Rest von `_testPlaySimul` (`playTone` für p1/p2, `pairIndicator`,
> `Promise.all`) bleibt unverändert.

---

## Schritt 4 — `js/state-side.js`: Default-Lautstärke 50 %

**Vorher** (Z. 733):

```js
  test:      { toneType: "richCiG", volume: 75, duration: 750, pause: 300, sequence: "ab" },
```

**Nachher** (nur `volume`):

```js
  test:      { toneType: "richCiG", volume: 50, duration: 750, pause: 300, sequence: "ab" },
```

> **Nur `test`** ändern. `freqmatch`, `balance`, `implant` bleiben bei
> 75 % — die Zwei-Zonen-Logik betrifft ausschließlich den
> Elektrodenlautstärke-Test (nur `playSeq` und `_testPlaySimul` nutzen
> `pairGains`).

---

## Schritt 5 — Spec aktualisieren: `docs/spec/02-messung.md`

Im Abschnitt **„Slider-Wirkung"** (Test 1) ergänzen, dass der Slider den
Lautstärkeunterschied in zwei Zonen umsetzt:

- *Zone 1* (genug Reserve nach oben): beide Töne symmetrisch, `±off/2`.
- *Zone 2* (ein Ton am Maximalpegel): der lautere Ton bleibt am Maximum,
  der andere wird um den vollen `off` abgesenkt, damit der gemessene
  Unterschied immer dem Slider-Wert entspricht.

Außerdem vermerken: Default-Tool-Lautstärke für Test 1 ist **50 %**
(ca. 12 dB Reserve, deckt den Standard-Slider ±20 dB ab; Zone 2 nur bei
erweitertem Bereich / fast stummen Elektroden).

Die zentrale Funktion heißt `pairGains` (in `js/audio.js`). Falls
`docs/CODESTRUKTUR.md` bei `audio.js` Schlüsselfunktionen listet, dort
`pairGains` mit aufnehmen.

---

## Schritt 6 — Version hochzählen

In **`js/version.js`**:

```js
const APP_VERSION = "0.4.284-beta";
```

---

## Akzeptanztest-Checkliste

Vorbereitung: Implantat-Reiter so, dass zwei testbare Elektroden
existieren. Test „Elektrodenlautstärke" starten.

1. **Tonart-Modalbox öffnen** (Knopf mit dem Tonart-Namen im Test-Kopf).
   *Erwartet:* Die Lautstärke steht voreingestellt auf **50 %** (bei
   frischem Zustand / Reset).

2. **Slider in die Mitte (0 dB)**, „Wiederholen" antippen.
   *Erwartet:* Beide Töne gleich laut.

3. **Slider nach rechts auf z.B. +6 dB**, „Wiederholen".
   *Erwartet:* Der erste Ton (A) wird **leiser**, der zweite (B) wird
   **lauter** — **beide** hörbar verändert.

4. **Slider nach links auf z.B. −6 dB**, „Wiederholen".
   *Erwartet:* Umgekehrt — A lauter, B leiser, beide bewegt.

5. **Knopf „Gleichzeitig"** bei +6 dB und bei −6 dB.
   *Erwartet:* Gleiches Bild wie beim Nacheinander-Abspielen; beide Töne
   bewegt, gleiche Richtung wie in Schritt 3/4.

6. **Lautstärke testweise in der Modalbox auf 100 % stellen**, Slider auf
   +6 dB, „Wiederholen".
   *Erwartet:* Jetzt klebt B am Maximum, nur A wird leiser — **aber** der
   Lautstärkeunterschied A↔B entspricht weiterhin den +6 dB (A ist um die
   vollen 6 dB leiser als B, nicht nur 3 dB). (Dieser Fall ist der
   Zone-2-Sicherheitsfall; mit dem 50-%-Default tritt er normal nicht
   auf.)

7. **Browser-Konsole** beobachten: keine Fehler.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–7) einzeln durchgehen:
**erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe.
Zusätzlich bestätigen:

- `pairGains` existiert in `js/audio.js` direkt vor `playSeq` und gibt
  `{ vA, vB, capped }` mit `capped` ∈ `null | 'a' | 'b'` zurück.
- Sowohl `playSeq` (audio.js) als auch `_testPlaySimul` (test.js)
  berechnen `vA`/`vB` ausschließlich über `pairGains` — keine eigene
  `dB2G(±halfOff)`-Formel mehr in diesen beiden Funktionen.
- `TEST_DEFAULTS.test.volume` ist `50`; `freqmatch`/`balance`/`implant`
  unverändert `75`.
- `js/version.js` steht auf `"0.4.284-beta"`.

Bei „unklar" nachfragen, nicht still annehmen.

---

*Hinweis:* Rein deutsch, keine neuen UI-Texte — kein Übersetzungsschritt.
Der Deckelungs-Hinweis (Einblendung „… hat die maximale Lautstärke
erreicht") folgt in **BA 285** und nutzt das `capped`-Feld dieser BA.
