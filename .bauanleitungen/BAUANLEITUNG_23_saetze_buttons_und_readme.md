# Bauanleitung 23: Sätze-Buttons (Modus-Dropdown weg) + README konsolidieren

Kleinere Korrekturen nach Etappe 2. Ändert die Bedienung des Sätze-
Blocks im Player und räumt die Quellen-Doku auf.

## Was sich ändert

**UI im Player (Sätze-Block):**

Statt eines Modus-Dropdowns mit drei Optionen gibt es jetzt drei
explizite Buttons:

- **Spielen** — spielt den aktuellen Satz einmal. Beim ersten Klick
  wird ein zufälliger Satz aus dem Pool gewählt; spätere Klicks
  wiederholen denselben Satz.
- **Nächster Satz** — wählt zufällig einen anderen Satz aus dem
  Pool und spielt ihn einmal (Autoplay).
- **Endlosfolge** — startet zufällige Folge von Sätzen, wechselt nach
  jedem Ende automatisch zum nächsten (Autoplay, fortlaufend).

Der bisherige Stop-Button bleibt unverändert.

**README:**

Der Sprachmaterial-Abschnitt steht aktuell viermal (in jedem
`README_<lang>.md`). Wird konsolidiert: nur noch einmal, auf Englisch
in der Repo-Root `README.md`.

## Reihenfolge

1. HTML: Modus-Dropdown raus, zwei neue Buttons rein
2. `sentences.js`: Mode-Konzept durch `sEndless`-Flag ersetzen; drei
   Button-Handler implementieren
3. i18n: alte Modus-Keys raus, drei neue Button-Keys rein
4. README-Konsolidierung
5. SPEC.md anpassen
6. Akzeptanztest
7. Selbstprüfung

---

## 1. HTML: Modus-Dropdown raus, zwei neue Buttons rein

In `index.html`, im Block des Sätze-Cards. Aktuell sieht der Bereich
um Zeilen 1170–1210 etwa so aus:

**Vorher** (Sprecher-Dropdown + Modus-Dropdown + Start/Stop):

```html
            <div class="controls-row" style="margin-bottom:8px">
              <div class="control-group">
                <label data-t="sentSpeaker" style="margin-right:6px"></label>
                <select id="plSentSpeaker" ...></select>
              </div>
              <div class="control-group">
                <label data-t="sentMode" style="margin-right:6px"></label>
                <select id="plSentMode" ...>
                  <option value="once"   data-t-opt="sentModeOnce"></option>
                  <option value="loop"   data-t-opt="sentModeLoop"></option>
                  <option value="random" data-t-opt="sentModeRandom" selected></option>
                </select>
              </div>
            </div>

            ... (Pausen-Buttons-Block bleibt unverändert)

            <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
              <button class="btn" id="plSentStart" type="button">
                <span data-t="sentStart"></span>
              </button>
              <button class="btn" id="plSentStop" type="button" disabled>
                <span data-t="sentStop"></span>
              </button>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto">
                <input type="checkbox" id="plSentShowText" />
                <span data-t="sentShowText"></span>
              </label>
            </div>
```

**Nachher** — Modus-Block ersatzlos streichen, Button-Reihe um zwei
Buttons erweitern und Button-IDs/Texte anpassen:

```html
            <div class="controls-row" style="margin-bottom:8px">
              <div class="control-group">
                <label data-t="sentSpeaker" style="margin-right:6px"></label>
                <select id="plSentSpeaker" ...></select>
              </div>
            </div>

            ... (Pausen-Buttons-Block bleibt unverändert)

            <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
              <button class="btn" id="plSentPlay" type="button">
                <span data-t="sentBtnPlay"></span>
              </button>
              <button class="btn" id="plSentNext" type="button">
                <span data-t="sentBtnNext"></span>
              </button>
              <button class="btn" id="plSentEndless" type="button">
                <span data-t="sentBtnEndless"></span>
              </button>
              <button class="btn" id="plSentStop" type="button" disabled>
                <span data-t="sentStop"></span>
              </button>
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-left:auto">
                <input type="checkbox" id="plSentShowText" />
                <span data-t="sentShowText"></span>
              </label>
            </div>
```

Wichtige IDs:
- **alter Button `plSentStart` → entfällt** (wird zu `plSentPlay`).
- `plSentMode` (Select) → entfällt.
- Sprecher-Dropdown (`plSentSpeaker`) bleibt, das `<select>` wird zur
  Laufzeit von `sentences.js` befüllt (unverändert aus Bauanleitung 22).
- Die zugehörigen Listener auf `plSentStart` müssen in `sentences.js`
  ebenfalls ersetzt werden — siehe nächster Abschnitt.

## 2. `sentences.js`: Mode-Konzept ersetzen

Drei Änderungen:

### 2a. State-Variable

Im State-Block oben (etwa Z. 17–22) eine neue Variable `sEndless`
ergänzen:

```js
let sActive = false;
let sEndless = false;   // NEU: true = Endlosfolge-Modus
let sCurRec = null;
```

### 2b. Funktionen `sStart`, `sOnEnded` und Verdrahtung ersetzen

Die bisherige Funktion `sStart` und `sOnEnded` greifen auf
`document.getElementById("plSentMode").value` zu — das Element gibt es
nicht mehr. Stattdessen drei Button-Handler.

**Ersetze die komplette Funktion `sStart`** (etwa Z. 138–155) durch
diese drei neuen Funktionen:

```js
// Hilfsfunktion: aus dem aktuellen Pool eine zufällige Recording
// ziehen, die wenn möglich nicht die aktuelle ist.
function sPickRandom(pool, exclude) {
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (
    exclude
    && pick.speakerKey === exclude.speakerKey
    && pick.recIdx === exclude.recIdx
  );
  return pick;
}

// Button "Spielen": aktueller Satz, einmalig.
function sPlay() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  if (!sCurRec) {
    // erstmaliger Klick: zufälligen Satz aus Pool wählen
    sCurRec = sPickRandom(pool, null);
  }
  sActive = true;
  sEndless = false;
  sUpdateButtons();
  sPlayCurrent();
}

// Button "Nächster Satz": anderer zufälliger Satz, einmalig.
function sNext() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  sCurRec = sPickRandom(pool, sCurRec);
  sActive = true;
  sEndless = false;
  sUpdateButtons();
  sPlayCurrent();
}

// Button "Endlosfolge": zufällige Folge, fortlaufend.
function sEndlessStart() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sUpdateUI(); return; }
  if (typeof pPlaying !== "undefined" && pPlaying) pPause();
  sCurRec = sPickRandom(pool, sCurRec);
  sActive = true;
  sEndless = true;
  sUpdateButtons();
  sPlayCurrent();
}
```

**Ersetze die komplette Funktion `sOnEnded`** durch:

```js
function sOnEnded() {
  if (!sActive) return;
  if (!sEndless) {
    // Einzelmodus: stoppen.
    sStop();
    return;
  }
  // Endlosmodus: nächste Recording wählen.
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) { sStop(); return; }
  sCurRec = sPickRandom(pool, sCurRec);
  const ms = sPauseMs();
  if (ms > 0) {
    sPauseTimer = setTimeout(function () {
      sPauseTimer = null;
      if (sActive) sPlayCurrent();
    }, ms);
  } else {
    sPlayCurrent();
  }
}
```

### 2c. `sStop` minimal anpassen

In `sStop()` (etwa Z. 157) `sEndless = false;` ergänzen, damit nach
Stopp ein nachfolgender "Spielen"-Klick im Einzelmodus startet, nicht
versehentlich endlos weiterläuft:

**Vorher:**

```js
function sStop() {
  sActive = false;
  sCurRec = null;
  ...
```

**Nachher:**

```js
function sStop() {
  sActive = false;
  sEndless = false;
  // sCurRec NICHT zurücksetzen — User soll mit "Spielen" denselben Satz
  // erneut hören können, wenn er nur kurz gestoppt hat.
  ...
```

Hinweis: Das Zurücksetzen von `sCurRec = null;` bitte **entfernen** —
damit "Spielen" nach Stop denselben Satz weiterspielen kann. Wenn der
User einen anderen will, drückt er "Nächster Satz".

### 2d. `sUpdateButtons` erweitern

Die bisherige `sUpdateButtons`-Funktion steuert nur Start/Stop.
Anpassen, sodass alle drei neuen Buttons während Wiedergabe disabled
und Stop nur während Wiedergabe enabled sind:

**Ersetze die komplette `sUpdateButtons`-Funktion** durch:

```js
function sUpdateButtons() {
  const play    = document.getElementById("plSentPlay");
  const next    = document.getElementById("plSentNext");
  const endless = document.getElementById("plSentEndless");
  const stop    = document.getElementById("plSentStop");
  const busy    = sActive;
  if (play)    play.disabled    = busy;
  if (next)    next.disabled    = busy;
  if (endless) endless.disabled = busy;
  if (stop)    stop.disabled    = !busy;
}
```

### 2e. Event-Listener-Verdrahtung

Im `DOMContentLoaded`-Handler am Ende der Datei den bestehenden
`plSentStart`-Listener durch drei neue ersetzen:

**Vorher:**

```js
document.addEventListener("DOMContentLoaded", function () {
  const start = document.getElementById("plSentStart");
  const stop  = document.getElementById("plSentStop");
  const show  = document.getElementById("plSentShowText");
  if (start) start.addEventListener("click", sStart);
  if (stop)  stop.addEventListener("click",  sStop);
  ...
```

**Nachher:**

```js
document.addEventListener("DOMContentLoaded", function () {
  const play    = document.getElementById("plSentPlay");
  const next    = document.getElementById("plSentNext");
  const endless = document.getElementById("plSentEndless");
  const stop    = document.getElementById("plSentStop");
  const show    = document.getElementById("plSentShowText");
  if (play)    play.addEventListener("click",    sPlay);
  if (next)    next.addEventListener("click",    sNext);
  if (endless) endless.addEventListener("click", sEndlessStart);
  if (stop)    stop.addEventListener("click",    sStop);
  ...
```

Die Pausen-Buttons-Verdrahtung am Ende des Handlers bleibt unverändert.

## 3. i18n: alte Keys raus, neue Keys rein

In `i18n.js` in **allen vier Sprachblöcken** (`de:`, `en:`, `fr:`, `es:`):

**Entfernen** (nicht mehr referenziert):

- `sentMode`
- `sentModeOnce`
- `sentModeLoop`
- `sentModeRandom`
- `sentStart` *(wird durch `sentBtnPlay` ersetzt)*

**Ergänzen** — drei neue Keys pro Sprache:

### Deutsch (`de:`):

```js
    sentBtnPlay: "▶ Spielen",
    sentBtnNext: "⏭ Nächster Satz",
    sentBtnEndless: "♾ Endlosfolge",
```

### Englisch (`en:`):

```js
    sentBtnPlay: "▶ Play",
    sentBtnNext: "⏭ Next sentence",
    sentBtnEndless: "♾ Endless",
```

### Französisch (`fr:`):

```js
    sentBtnPlay: "▶ Lire",
    sentBtnNext: "⏭ Phrase suivante",
    sentBtnEndless: "♾ En continu",
```

### Spanisch (`es:`):

```js
    sentBtnPlay: "▶ Reproducir",
    sentBtnNext: "⏭ Siguiente frase",
    sentBtnEndless: "♾ Continuo",
```

Der bestehende Key `sentStop` (z.B. "■ Stopp") bleibt unverändert und
wird vom Stop-Button weiterverwendet.

## 4. README-Konsolidierung

### 4a. Aus den vier `README_<lang>.md` den Sprachmaterial-Abschnitt entfernen

Pro Datei jeweils **alles ab der jeweiligen Überschrift bis zum
Datei-Ende** entfernen:

| Datei | Überschrift (alles ab dort weg) |
|---|---|
| `README_de.md` | `## Sprachmaterial und Quellen` |
| `README_en.md` | `## Speech Material and Sources` |
| `README_fr.md` | `## Matériel vocal et sources` |
| `README_es.md` | `## Material de voz y fuentes` |

Hinter dem entfernten Block stehen aktuell keine weiteren Inhalte —
der Abschnitt steht jeweils am Datei-Ende. Sicherheitscheck mit
`tail -5 README_<lang>.md` nach dem Entfernen: die letzten Zeilen
sollten nicht mehr von "Common Voice" / "Thorsten" sprechen.

### 4b. In `README.md` (Repo-Root, englisch) neuen Abschnitt einfügen

In `README.md` direkt **vor dem letzten Block "Feedback is appreciated."**
folgenden Abschnitt einfügen:

```markdown
## Speech material and sources

The "Play sentences" feature in the Player tab uses voice recordings
from the following open sources:

- **Thorsten-Voice** — German studio voice by Thorsten Müller,
  training data CC0. <https://www.thorsten-voice.de>
- **Mozilla Common Voice 17.0** — multilingual crowd-sourced speech
  datasets (CC0-1.0). Retrieved through the unofficial Hugging Face
  mirror `fsicoli/common_voice_17_0`. About 100 different speaker
  recordings per language are bundled with the tool.
  <https://commonvoice.mozilla.org>

Selected audio snippets are included in this repository.
```

## 5. SPEC.md anpassen

Den bestehenden Sätze-Wiedergabe-Eintrag (von Bauanleitung 22) soweit
ändern, dass die Bedienlogik dem neuen Button-Schema entspricht.
Konkret den Satz über die "Modus-Auswahl" ersetzen:

**Vorher** (sinngemäß):

> Modus-Auswahl: Ein Satz / Wiederholt / Viele zufällig. ...

**Nachher** (sinngemäß):

> Bedienung über drei Buttons: **Spielen** (aktueller Satz einmal,
> beim ersten Klick zufällig gewählt) — **Nächster Satz** (anderer
> zufälliger Satz, einmal) — **Endlosfolge** (zufällige Folge,
> fortlaufend). Stop hält alles an. Sprecher-Auswahl folgt globaler
> Tool-Sprache.

Der Rest des Eintrags (Common Voice, Thorsten, Schema, Mutual
Exclusion zur Musikdatei) bleibt.

## 6. Akzeptanztest

**Tool im Browser laden, Player-Tab, Sprache Deutsch.**

1. Sätze-Card zeigt **vier Buttons** in einer Reihe: Spielen / Nächster
   Satz / Endlosfolge / Stop. Modus-Dropdown ist verschwunden.

2. **Spielen** klicken (erstmals).
   → Ein zufälliger deutscher Satz wird gespielt, danach Stille. Alle
   Buttons (außer Stop) ausgegraut während Wiedergabe; nach Ende wieder
   aktiv. Stop war nur während Wiedergabe aktiv.

3. Direkt nochmal **Spielen** klicken.
   → **Derselbe** Satz wird erneut gespielt.

4. **Nächster Satz** klicken.
   → Ein **anderer** Satz wird gespielt, einmal, dann Stille.

5. **Nächster Satz** mehrfach nacheinander klicken (nach jeweiligem
   Ende).
   → Jedes Mal anderer Satz.

6. **Endlosfolge** klicken.
   → Sätze laufen fortlaufend, mit der eingestellten Pause zwischen
   den Sätzen. Stop hält an.

7. Während Endlosfolge läuft: **Stop**.
   → Wiedergabe hält an.

8. Direkt nach Stop: **Spielen**.
   → Der zuletzt gespielte Satz wird erneut gespielt (sCurRec wurde
   nicht gelöscht).

9. Sprecher auf "Thorsten" wechseln, dann **Nächster Satz** mehrfach.
   → Nur Thorsten-Stimme; Sätze wechseln innerhalb der 50 Thorsten-Sätze.

10. Sprache auf Englisch wechseln, **Endlosfolge**.
    → Englische Common-Voice-Sätze laufen durch, wechselnde Sprecher.

11. **README-Prüfung**: `tail -3 README_de.md`, dito für en/fr/es.
    → Keine Quellen-Abschnitte mehr am Ende. `head -30 README.md`
    → der neue englische "Speech material and sources"-Block ist da.

## 7. Selbstprüfung an Sonnet

**Vor der Fertig-Meldung** jede der 11 Akzeptanzkriterien einzeln
durchgehen und für jede markieren: **erfüllt** (mit Datei+Zeile) /
**nicht erfüllt** / **unklar**.

Außerdem prüfen:

- `grep -c 'plSentMode' index.html sentences.js i18n.js` muss 0 sein
  (keine Reste).
- `grep -c 'sentBtnPlay\|sentBtnNext\|sentBtnEndless' i18n.js` muss
  jeweils 4 sein (pro Sprache 1×).
- `grep -c '## Sprachmaterial\|## Speech Material\|## Matériel vocal\|## Material de voz' README_*.md` muss 0 sein (alte Abschnitte entfernt).
- `grep -c 'Speech material and sources' README.md` muss 1 sein
  (neuer zentraler Abschnitt vorhanden).
- SPEC.md aktualisiert.

Bei "unklar" oder "nicht erfüllt": an den Anfang der Fertig-Meldung,
damit der User es nicht übersehen kann.
