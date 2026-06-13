# BA 283 — Auswahl „Slider-Wirkung" im Elektrodenlautstärke-Test entfernen

**Ziel-Version nach Build:** `0.4.283-beta`

## Kontext

Im Sub-Tab **Messungen → Elektrodenlautstärke** gibt es im Test-Kopf
ein Dropdown **„Slider-Wirkung"** mit den Optionen **A / B / Balance**
(Default `Balance`). Diese Auswahl hat **keinerlei Wirkung** auf die
Tonwiedergabe — der State-Wert `slTarget_test` wird gespeichert, geladen
und gedruckt, aber an keiner Stelle in der Lautstärke-Berechnung gelesen.

Gewünschtes Verhalten ist **immer**: Beim Bewegen des Sliders werden
**beide Töne symmetrisch** verändert (einer leiser, einer lauter). Genau
das macht `playSeq` in `js/audio.js` bereits (`-off/2` auf A, `+off/2`
auf B). Diese BA:

1. entfernt die Auswahl „Slider-Wirkung" aus dem Test-Kopf,
2. gleicht den **„Gleichzeitig"-Knopf** an dieselbe symmetrische Logik
   an (er verändert aktuell nur einen Ton **und** hat die umgekehrte
   Wirkungsrichtung gegenüber `playSeq`),
3. räumt die nicht mehr gebrauchte Einstellung aus State, Speichern/Laden
   und Druck sowie die nur hierfür benutzten Textbausteine.

**Wichtig — nicht anfassen:** Der **Stereo-Balance-Test** (`id === 'balance'`)
hat ein eigenes, davon unabhängiges Dropdown „Slider-Wirkung" mit den
Optionen **Links / Rechts / Beide** (`slTarget_balance`). Dieser Wert und
seine Textbausteine bleiben **vollständig unverändert**.

**Im Code ausschließlich ASCII-Anführungszeichen `"` und `'` verwenden.**

---

## Schritt 1 — `js/test.js`: Dropdown-Konfiguration entfernen

In der Header-Konfiguration des Tests (`cfg.header.common`) den
`sliderTarget`-Block **ersatzlos** entfernen.

**Vorher** (rund um Z. 1260–1266):

```js
        sequence:     { show: true, source: 'global' },
        sliderTarget: {
          options:  ['a','b','balance'],
          stateKey: 'slTarget_test',
          default:  'balance'
        },
        electrodeSelection: {
```

**Nachher:**

```js
        sequence:     { show: true, source: 'global' },
        electrodeSelection: {
```

> Hinweis: `js/test-ui.js` baut das Dropdown nur, wenn `hc.sliderTarget`
> truthy ist (`var showTarget = hc.sliderTarget && (hc.sliderTarget !== false);`).
> Ohne den Block wird die Auswahl im Kopf nicht mehr gerendert. Der
> Event-Listener (`if (targetSelect) { ... }`) läuft dann ebenfalls
> nicht — `targetSelect` bleibt `null`. **An `js/test-ui.js` ist nichts
> zu ändern.** Der generische `keyMap` dort bleibt unangetastet.

---

## Schritt 2 — `js/test.js`: „Gleichzeitig" auf symmetrische Logik

In `_testPlaySimul()` die Berechnung von `vA`/`vB` an `playSeq` angleichen.

**Vorher** (Z. 1368–1369):

```js
  var vA = Math.max(Math.min(vol * (tot < 0 ? dB2G(tot)  : 1), 1), 0);
  var vB = Math.max(Math.min(vol * (tot > 0 ? dB2G(-tot) : 1), 1), 0);
```

**Nachher:**

```js
  // BA 283: symmetrische Verschiebung wie in playSeq (audio.js):
  // -tot/2 zu A, +tot/2 zu B. Beide Toene werden bewegt, gleiche
  // Wirkungsrichtung wie beim Nacheinander-Abspielen.
  var halfOff = tot / 2;
  var vA = Math.max(Math.min(vol * dB2G(-halfOff), 1), 0);
  var vB = Math.max(Math.min(vol * dB2G(halfOff), 1), 0);
```

> Der Rest der Funktion (`stopAll()`, `playTone(...)`, `pairIndicator`,
> `Promise.all`) bleibt unverändert. `dB2G` ist global aus `js/audio.js`
> verfügbar und wurde hier vorher schon benutzt.

---

## Schritt 3 — `js/state-side.js`: State-Variable entfernen

**Vorher** (Z. 780–781):

```js
let slTarget_test = "balance";    // "a" | "b" | "balance"
let slTarget_balance = "both";    // "left" | "right" | "both"
```

**Nachher** (nur die `slTarget_test`-Zeile entfällt):

```js
let slTarget_balance = "both";    // "left" | "right" | "both"
```

---

## Schritt 4 — `js/file.js`: aus Reset / Speichern / Laden entfernen

**4a — Reset** (Z. 141–142):

```js
  slTarget_test = "balance";
  slTarget_balance = "both";
```

→ wird zu:

```js
  slTarget_balance = "both";
```

**4b — Speichern** (Z. 372–373):

```js
    slTarget_test: slTarget_test,
    slTarget_balance: slTarget_balance,
```

→ wird zu:

```js
    slTarget_balance: slTarget_balance,
```

**4c — Laden** (Z. 716–717):

```js
  if (d.slTarget_test) slTarget_test = d.slTarget_test;
  if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
```

→ wird zu:

```js
  if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
```

> Alte gespeicherte Stände, die noch `slTarget_test` enthalten, sind
> unkritisch: das Feld wird beim Laden einfach ignoriert.

---

## Schritt 5 — `js/init.js`: aus sessionStorage-Restore entfernen

**5a — Laden** (Z. 824–825):

```js
      if (d.slTarget_test) slTarget_test = d.slTarget_test;
      if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
```

→ wird zu:

```js
      if (d.slTarget_balance) slTarget_balance = d.slTarget_balance;
```

**5b — Speichern** (Z. 1023–1024):

```js
          slTarget_test: slTarget_test,
          slTarget_balance: slTarget_balance,
```

→ wird zu:

```js
          slTarget_balance: slTarget_balance,
```

---

## Schritt 6 — `js/print-md.js`: aus Druck-Sammlung entfernen

**Vorher** (Z. 142–143):

```js
    slTargetTest:    (typeof slTarget_test    !== "undefined") ? slTarget_test    : null,
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null
```

→ wird zu (nur `slTargetTest` entfällt, Komma am verbleibenden Eintrag
beachten):

```js
    slTargetBalance: (typeof slTarget_balance !== "undefined") ? slTarget_balance : null
```

> `slTargetTest` wird nirgends ausgelesen — es genügt, die Sammelzeile zu
> entfernen.

---

## Schritt 7 — Textbausteine entfernen (i18n)

Die drei Keys `targetA`, `targetB`, `targetBalance` werden **nur** von
der jetzt entfernten Test-1-Auswahl benutzt. In **`i18n/de.js`** entfernen:

```js
    targetA: "A",
    targetB: "B",
    targetBalance: "Balance",
```

Dieselben drei Keys (`targetA`, `targetB`, `targetBalance`) auch in
**`i18n/en.js`**, **`i18n/fr.js`**, **`i18n/es.js`** entfernen, **falls
dort vorhanden** (verwaiste Keys aufräumen, keine Neuübersetzung).

**Unbedingt stehen lassen** (werden vom Stereo-Balance-Test gebraucht):
`targetLbl`, `targetLeft`, `targetRight`, `targetBoth` — sowie ggf.
`targetRef` / `targetVar`, falls vorhanden.

---

## Schritt 8 — Spec aktualisieren: `docs/spec/02-messung.md`

Den Abschnitt **„Slider-Wirkung (pro Test eigener Wert)"** (rund um
Z. 205–213) anpassen, sodass Test 1 keine Auswahl mehr hat.

**Vorher:**

```
### Slider-Wirkung (pro Test eigener Wert)

- **Test 1** (`slTarget_test`): A / B / Balance. Default `Balance`.
  Bei Slider +6 dB im Modus Balance: A wird mit −3 dB, B mit +3 dB
  gespielt.
- **Test 2** (`slTarget_balance`): Links / Rechts / Beide. Default
  `Beide`, symmetrisch wie in Test 1.
- **Test 3**: kein Dropdown, intern fest auf der
  Nicht-Referenzohr-Seite (CI-Ohr).
```

**Nachher:**

```
### Slider-Wirkung (pro Test eigener Wert)

- **Test 1**: kein Dropdown mehr (BA 283 entfernt). Der Slider wirkt
  immer symmetrisch: bei Slider +6 dB wird A mit −3 dB, B mit +3 dB
  gespielt — sowohl beim Nacheinander-Abspielen (`playSeq`) als auch
  beim Knopf „Gleichzeitig" (`_testPlaySimul`).
- **Test 2** (`slTarget_balance`): Links / Rechts / Beide. Default
  `Beide`, symmetrisch wie in Test 1.
- **Test 3**: kein Dropdown, intern fest auf der
  Nicht-Referenzohr-Seite (CI-Ohr).
```

> Falls `slTarget_test` an weiteren Stellen in `docs/spec/` oder in
> `docs/CODESTRUKTUR.md` namentlich erwähnt wird: dort ebenfalls als
> entfernt vermerken. (Per `grep -rn "slTarget_test" docs/` prüfen.)

---

## Schritt 9 — Version hochzählen

In **`js/version.js`**:

```js
const APP_VERSION = "0.4.283-beta";
```

---

## Akzeptanztest-Checkliste

Vorbereitung: Implantat-Reiter so einstellen, dass mindestens zwei
Elektroden testbar sind.

1. **Tab Messungen → Sub-Tab „Elektrodenlautstärke"** öffnen.
   *Erwartet:* Im Test-Kopf gibt es **kein** Dropdown „Slider-Wirkung"
   mehr. (Das Dropdown „Tonfolge ABA/AB" und der Tonart-Knopf bleiben.)

2. **Test starten**, Seitenabfrage bestätigen.
   *Erwartet:* Ein Tonpaar wird abgespielt, der Slider erscheint.

3. **Slider nach rechts schieben (positiver Wert)**, dann „Wiederholen"
   antippen.
   *Erwartet:* Beide Töne sind hörbar verändert — der erste Ton (A)
   leiser, der zweite (B) lauter, gegenüber der Mittelstellung.

4. **Knopf „Gleichzeitig" (Taste B)** antippen.
   *Erwartet:* Beide Töne erklingen gemeinsam, **beide** gegenüber der
   Mittelstellung verändert (A leiser, B lauter) — **dieselbe**
   Wirkungsrichtung wie in Schritt 3, nicht umgekehrt, und kein Ton
   bleibt fest auf voller Lautstärke.

5. **Slider nach links schieben (negativer Wert)**, „Gleichzeitig"
   antippen.
   *Erwartet:* Jetzt umgekehrt — A lauter, B leiser. Beide bewegt.

6. **Sub-Tab „Stereo-Balance"** öffnen.
   *Erwartet:* Dessen Dropdown „Slider-Wirkung" (Links / Rechts / Beide)
   ist **unverändert** vorhanden und funktioniert wie zuvor.

7. **Stand speichern und wieder laden** (Datei-Funktion).
   *Erwartet:* Kein Konsolenfehler, Laden funktioniert. Elektrodenlaut-
   stärke-Test verhält sich wie oben.

8. **Browser-Konsole** während aller Schritte beobachten.
   *Erwartet:* Keine `ReferenceError: slTarget_test is not defined` und
   keine sonstigen Fehler.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–8) einzeln durchgehen
und melden: **erfüllt / nicht erfüllt / unklar**, mit Datei- und
Zeilenangabe der relevanten Stelle. Zusätzlich bestätigen:

- `grep -rn "slTarget_test" js/` liefert **keine** Treffer mehr.
- `grep -rn "targetA\|targetB\|targetBalance" js/ i18n/` zeigt: in den
  Sprachdateien entfernt; der `keyMap` in `js/test-ui.js` darf die
  Schlüssel weiterhin generisch listen (das ist kein Fehler).
- `slTarget_balance`, `targetLbl`, `targetLeft`, `targetRight`,
  `targetBoth` sind **unverändert** vorhanden.
- `js/version.js` steht auf `"0.4.283-beta"`.

Bei „unklar" nachfragen, nicht still annehmen.

---

*Hinweis:* Diese BA ist rein deutsch und entfernt nur Textbausteine,
sie produziert keine neuen UI-Texte — es ist kein Übersetzungsschritt
nötig. Die Sprachdateien werden nur um die drei verwaisten Keys
bereinigt.
