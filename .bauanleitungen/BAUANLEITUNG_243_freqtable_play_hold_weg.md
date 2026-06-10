# BA 243: freq-table Play/Hold-Spalten entfernen + Implantat-Hold reparieren

## Ziel

Vierter und letzter Schritt der Umstellung (BA 240–243).

1. **Play- und Hold-Spalten** in der `freq-table` (`js/freq-table.js`)
   werden in **beiden** Tabellen-Varianten (CI und akustisch) entfernt.
   Die Tabelle hat danach:
   - CI-Variante: 9 Spalten (vorher 11) — entfällt: Play, Hold.
   - Akustische Variante: 6 Spalten (vorher 8) — entfällt: Play, Hold.
2. **Audio-Aufräumung** in `js/audio.js`:
   - `playSingle` (Z. ~879), `playHold` (Z. ~713), `toggleHold` (Z. ~891),
     `corrG` (Z. ~873) — toter Code nach Wegfall der Aufrufer.
3. **Implantat-Modal: Hold-Modus dauerhaft reparieren**. In BA 242
   wurde der Klaviertasten-Druck im Implantat-Modal mit einem
   `playToneTyped(c, hz, vol, 5000, …)` realisiert — Ton endete
   nach 5 s. Mit BA 243 setzen wir die Dauer auf 60 s, damit
   praktisch jeder reale Klaviertasten-Hold abgedeckt ist; das
   Loslassen ruft `stopAll()` und beendet den Ton. Der Audio-Stack
   bricht den `playToneTyped`-Lauf sauber ab (jede Profil-Funktion
   setzt `curOsc`, `stopAll` ruft `curOsc.stop()`).
4. **i18n-Keys `thPlay` und `thHold`** in `i18n/de.js` werden
   entfernt (toter Eintrag).

i18n: keine neuen Strings. Übersetzungs-Folge-BA nicht nötig für
diese Änderung.

## Codestand (zur Orientierung)

- `js/freq-table.js`:
  - Z. 39–40: Header der akustischen Variante mit `thPlay` + `thHold`.
  - Z. 47: Header der CI-Variante als ein zusammengesetzter String,
    enthält `thPlay` und `thHold` mit fixer Reihenfolge.
  - Z. 90–91: Zellen Play/Hold in der akustischen Variante.
  - Z. 140–141: Zellen Play/Hold in der CI-Variante.
  - Z. 223–228: `addEventListener`-Schleifen für die Knöpfe.
- `js/audio.js`:
  - `playHold(hz, vol)` Z. 713–~870 (große Funktion).
  - `corrG(i)` Z. 873–878.
  - `playSingle(i)` Z. 879–890.
  - `toggleHold(i)` Z. 891–900.
- `js/ui-implant.js` (nach BA 242): `openImplantTonePopup` ruft
  `playToneTyped(c, hz, vol, 5000, activePan, tt)` im `onPress`-
  Handler. Wir erhöhen die Dauer auf 60000 ms.
- `i18n/de.js` Z. 71–72: `thPlay: "▶", thHold: "◼",`.

## Schritte

### 1. Version bumpen — `js/version.js`

```js
const APP_VERSION = "3.2.243-beta";
```

### 2. Akustische Tabellen-Variante: Play/Hold raus — `js/freq-table.js`

**2a) Header-Zeilen Z. 39–40 ersatzlos löschen:**

```js
      `<th>${t("thPlay")}</th>` +
      `<th>${t("thHold")}</th>` +
```

Danach hat der Header der akustischen Variante 6 Spalten:
Position, Hz (CI), Status, Ausschluß, Notiz. (Cent-Spalte gibt es
in dieser Variante laut Z. 36–43 ohnehin nicht — die Spec 03 nennt
zwar 8 Spalten inkl. Cent + Play + Hold; der Code rendert tatsächlich
nur die genannten 6 + Play/Hold = 8. Nach Wegfall von Play/Hold: 6.)

**2b) Zellen Play/Hold in der akustischen Zeile Z. 90–91 löschen:**

```js
        `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
        `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
```

ersatzlos entfernen.

### 3. CI-Tabellen-Variante: Play/Hold raus — `js/freq-table.js`

**3a) Header-String Z. 47 ändern.** Aktuell:

```js
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th style="white-space:nowrap">${t("thActive")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
```

ersetzen durch (ohne `thPlay`/`thHold`):

```js
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th style="white-space:nowrap">${t("thActive")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
```

**3b) Zellen Play/Hold in der CI-Zeile Z. 140–141 löschen:**

```js
      `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
      `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
```

ersatzlos entfernen.

### 4. Event-Listener-Schleifen entfernen — `js/freq-table.js`

Z. 223–228 (zwei `forEach`-Blöcke für `data-a="play"` und `data-a="hold"`)
ersatzlos löschen:

```js
  tb.querySelectorAll('.pbtn[data-a="play"]').forEach((b) =>
    b.addEventListener("click", () => playSingle(+b.dataset.i)),
  );
  tb.querySelectorAll('.pbtn[data-a="hold"]').forEach((b) =>
    b.addEventListener("click", () => toggleHold(+b.dataset.i)),
  );
```

### 5. audio.js — toter Code raus

**5a) `playHold(hz, vol)` komplett entfernen.** Von Z. 713 bis zur
schließenden `}` der Funktion (die `playHold` selbst enthält
mehrere `if`-Verzweigungen für Sinus / Komplex / pulsedComplex /
Rich-Profile etc.). Sonnet ermittelt das Funktions-Ende durch
korrekte Klammer-Zählung (öffnende `{` bei Z. 713, zugehörige
schließende `}` ist die Ende-Klammer der Funktion).

**5b) `corrG(i)` Z. 873–878 entfernen:**

```js
function corrG(i) {
  if (!document.getElementById("corrToggle").checked || bRes.length === 0)
    return 1;
  const { levels } = compWLS();
  return dB2G(-levels[i]);
}
```

**5c) `playSingle(i)` Z. 879–890 entfernen:**

```js
async function playSingle(i) {
  if (isPlay && holdIdx === -1) {
    stopAll();
    return;
  }
  stopAll();
  isPlay = true;
  updInd(i);
  await playTone(effFreq(i), gVol() * corrG(i), gDur());
  isPlay = false;
  updInd(-1);
}
```

**5d) `toggleHold(i)` Z. 891–900 entfernen:**

```js
function toggleHold(i) {
  if (holdIdx === i) {
    stopAll();
    return;
  }
  stopAll();
  holdIdx = i;
  updInd(i);
  playHold(effFreq(i), gVol() * corrG(i));
}
```

**5e) `holdIdx` aufräumen.** `holdIdx` ist eine globale Variable
(`state-side.js` Z. ~676). Wird in `stopAll` (`audio.js` Z. 61,
`holdIdx = -1`) und `updInd` benutzt. Sonnet prüft per grep, ob
nach Wegfall von `playHold`, `playSingle`, `toggleHold` noch
sinnvolle Aufrufer übrig sind. Wenn nicht:

- Die Initialisierung in `state-side.js` (`holdIdx = -1`) bleibt
  vorerst — sie ist mit `updInd(holdIdx)` etc. verwoben. **Im
  Zweifel `holdIdx` belassen** und nur die Funktionen entfernen.
  Wenn Sonnet einen klaren toten Pfad findet, kann es ihn
  rückbauen, aber ohne neue Implementierungen anzufassen.

### 6. Implantat-Modal Hold-Dauer auf 60 s — `js/ui-implant.js`

Im `openImplantTonePopup`, im `onPress`-Handler die Dauer von 5000
auf 60000 ändern. Konkret den Aufruf

```js
        playToneTyped(c, hz, vol, 5000, activePan, tt);
```

ersetzen durch:

```js
        playToneTyped(c, hz, vol, 60000, activePan, tt);
```

(Damit endet der Ton spätestens nach 60 s, falls die Klaviertaste
ungewöhnlich lange gehalten wird. `onRelease` ruft `stopAll()` und
beendet den Ton früher — siehe BA 241 / 242.)

### 7. i18n-Keys entfernen — `i18n/de.js`

Z. 71–72:

```js
    thPlay: "▶",
    thHold: "◼",
```

ersatzlos löschen. EN/FR/ES-Dateien werden in dieser BA **nicht**
angepaßt: die Keys werden dort nicht mehr gerendert, dauernd
referenziert nur in deutschen Defaults — die zusätzlichen
Sprach-Versionen sind unschädlich, werden bei Bedarf in einer
Mini-Aufräum-BA mit-entfernt.

## Akzeptanztest

Nach dem Build:

1. **Hard-Reload**, Version `3.2.243-beta`.
2. **Tab Implantat & Elektroden** öffnen, Konfiguration CI/MED-EL:
   - Tabelle hat **9 Spalten**: Position, Hz Std, Hz eigen, THR,
     Upper, Aktiv, Status, Ausschluß, Notiz. **Keine** Play- oder
     Hold-Knöpfe in den Zeilen.
3. **Konfiguration Hörgenosse (akustisch)** mit CI-Gegenseite:
   - Tabelle hat **6 Spalten**: Position, Hz (CI), Status, Ausschluß,
     Notiz, plus Position-Extra-Span. Keine Play/Hold mehr.
4. **„Elektroden über Töne anspielen"-Knopf** wie aus BA 242 öffnet
   die Modal. Klaviertaste drücken und **5+ Sekunden halten** →
   Ton spielt weiter. Loslassen → Ton stoppt.
5. **Sweep** funktioniert wie aus BA 242.
6. **Tab Messungen → Elektrodenlautstärke / Stereo-Balance /
   Frequenzabgleich** unverändert.
7. **Konsole prüfen**: kein `ReferenceError` zu `playSingle`,
   `playHold`, `toggleHold`, `corrG`. Insbesondere beim Tab-Wechsel
   und beim Rebuild der freq-table.
8. **Speichern und Laden** funktioniert wie aus BA 242.
9. **grep über den Source**: `thPlay` / `thHold` ergeben keinen
   Treffer mehr außer in `i18n/en.js / fr.js / es.js` (dort liegen
   sie noch als Karteileichen — keine harten Bezüge mehr).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung:

- Akzeptanzpunkte 1–9 einzeln durchgehen, je Punkt erfüllt /
  nicht erfüllt / unklar mit Datei/Zeilen-Verweis.
- Konsolen-Fehler-Check nach Hard-Reload und nach Tabellen-Rebuild
  (z. B. nach Wechsel Hersteller).
- Insbesondere prüfen:
  - `js/freq-table.js`: kein `data-a="play"` und kein `data-a="hold"`
    mehr in der Datei (grep).
  - `js/audio.js`: `playSingle`, `playHold`, `toggleHold`, `corrG`
    sind nicht mehr definiert; keine verbleibenden Aufrufer
    irgendwo im Source.
  - `js/ui-implant.js`: `onPress` ruft `playToneTyped` mit `60000`
    statt `5000`.
  - `i18n/de.js`: Zeilen `thPlay` / `thHold` weg.
  - Implantat-Modal: Klaviertaste 5 s halten — Ton bleibt erhalten.
- Bei `unklar`: Bau pausieren, Rückfrage.

## Hinweise

- Die i18n-Einträge `thPlay` und `thHold` in `i18n/en.js`,
  `i18n/fr.js`, `i18n/es.js` bleiben als Karteileichen liegen. Ihr
  Wegräumen ist kosmetisch und kann in einer reinen
  Übersetzungs-Aufräum-BA passieren, falls der Nutzer es will.
- Damit ist die vierteilige BA-Serie (BA 240–243) abgeschlossen.
  Die Tonauswahl-Modal ist die einzige Wiedergabe-Steuerung der
  Test-Verfahren (Freqmatch) und des Implantat-Tabs.
