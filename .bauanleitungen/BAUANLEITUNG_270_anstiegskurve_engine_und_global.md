# Bauanleitung 270 — Globale Anstiegs-/Ausklangkurve: Engine, State, Persistenz, Profil-Bereinigung

**Zielversion:** `0.4.270-beta`
**Reihenfolge:** zuerst diese BA bauen, danach BA 271 (Modal-Bedien-UI). Diese BA
legt globale Variablen und Funktionen an, die BA 271 nur noch bedient.

> **Wichtig zu Anführungszeichen:** In allen `.js`-Snippets ausschließlich
> ASCII-Anführungszeichen `"` (U+0022) und `'` (U+0027) verwenden. Niemals
> typografische `„ " ' '` als String-Begrenzer — der Browser bricht sonst
> beim Parsen ab. Innerhalb deutscher Text-Strings sind typografische
> Zeichen erlaubt (kommen in dieser BA aber nicht in Konflikt mit den
> Begrenzern).

---

## Hintergrund (Konzept)

Bisher trug jedes CI-Test-Profil seine eigene Anschwingzeit (`attackMs`:
CiHF 500, CiP 250, CiHA 600 …), und alle anderen Töne benutzten den
Default-Parameter `ramp = 50`. Die Hüllkurve war fest Hann-/Cos²-Form und
symmetrisch (gleiche Rampe am Tonanfang und Tonende).

Neu: eine **toolweit globale, persistente** Hüllkurven-Einstellung, die für
**alle** Töne im Tonauswahl-Modal gilt (Sinus, Rauschen, Instrumenten-
Imitationen, CI-Test-Profile). Sie hat vier Parameter:

1. **Anstiegsform** — `hard` (harter Einstieg), `linear`, `cos2` (heutiger
   Standard), `dblin` (dB-lineare Rampe = gleichmäßig wachsende Lautheit).
2. **Anstiegszeit** in ms (bei `hard` gegenstandslos).
3. **dB-Startpegel** — nur für `dblin`: der Pegel, bei dem die Rampe
   beginnt (echtes dB-linear begänne bei −∞). Default −50 dB.
4. **Ausklang** — `short` (fester kurzer sanfter Ausklang ~30 ms),
   `sym` (gleiche Form und Zeit wie der Anstieg), `hard` (abruptes Ende).

Folge: die profileigenen `attackMs`-Werte werden **bedeutungslos** und
werden in dieser BA aus den Profilen entfernt. Das Profil **CiHA** verliert
damit seinen Daseinszweck „Attack-stark"; es bleibt aber als eigene
Modulations-Zwischenstufe (AM 18 %) erhalten und wird in **„CI-Test
Modulation mittel"** umbenannt.

Diese BA baut nur das **Datenmodell + die Wiedergabe-Engine + die
Bereinigung**. Die Bedien-Oberfläche kommt in BA 271. Nach dieser BA
verhält sich das Tool mit den Default-Werten (cos², 500 ms, Ausklang kurz)
wie bisher CI-Test flach — nur dass es jetzt global gilt.

---

## Schritt 1 — Globale Hüllkurven-Variablen und Persistenz (js/audio.js)

In `js/audio.js` **direkt nach** der Funktion `gAC()` (die endet bei der
schließenden `}` der Funktion, vor `function _activeTestInput`) folgenden
Block einfügen:

```js
// ============================================================
// BA 270: Globale Ton-Huellkurve (Anstieg + Ausklang)
// ============================================================
// Toolweit global, persistent in localStorage ("ci-lb-toneEnv").
// Gilt fuer ALLE Toene (Sinus, Rauschen, Instrumente, CI-Test-Profile).
// Ersetzt die frueheren profil-eigenen attackMs-Werte und den 50ms-Default.
// Bedient wird das in BA 271 (Tonauswahl-Modal). Hier nur State + Engine.
let gToneEnvAttackForm = "cos2";  // "hard" | "linear" | "cos2" | "dblin"
let gToneEnvAttackMs   = 500;     // Anschwingzeit in ms (bei "hard" ignoriert)
let gToneEnvDbFloor    = -50;     // Startpegel in dB, nur fuer "dblin"
let gToneEnvRelease    = "short"; // "short" | "sym" | "hard"
const TONE_ENV_SHORT_MS = 30;     // feste Dauer des kurzen Ausklangs ("short")

// Zentraler Setter. Nimmt ein Patch-Objekt (nur gesetzte Felder wirken),
// schreibt die globalen Variablen und persistiert nach localStorage.
function setToneEnvelope(patch) {
  if (!patch) return;
  if (patch.attackForm !== undefined) gToneEnvAttackForm = patch.attackForm;
  if (patch.attackMs   !== undefined) gToneEnvAttackMs   = patch.attackMs;
  if (patch.dbFloor    !== undefined) gToneEnvDbFloor    = patch.dbFloor;
  if (patch.release    !== undefined) gToneEnvRelease    = patch.release;
  try {
    localStorage.setItem("ci-lb-toneEnv", JSON.stringify({
      attackForm: gToneEnvAttackForm,
      attackMs:   gToneEnvAttackMs,
      dbFloor:    gToneEnvDbFloor,
      release:    gToneEnvRelease
    }));
  } catch (e) { /* localStorage kann fehlen/voll sein — ignorieren */ }
}

// Liest persistierte Werte beim Laden zurueck. Wird einmal als
// Top-Level-Aufruf am Ende dieses Blocks ausgefuehrt (localStorage ist
// beim Script-Load synchron verfuegbar, kein DOM noetig).
function loadToneEnvelope() {
  try {
    var raw = localStorage.getItem("ci-lb-toneEnv");
    if (!raw) return;
    var o = JSON.parse(raw);
    if (!o || typeof o !== "object") return;
    if (o.attackForm === "hard" || o.attackForm === "linear"
        || o.attackForm === "cos2" || o.attackForm === "dblin") {
      gToneEnvAttackForm = o.attackForm;
    }
    if (typeof o.attackMs === "number" && isFinite(o.attackMs) && o.attackMs >= 0) {
      gToneEnvAttackMs = o.attackMs;
    }
    if (typeof o.dbFloor === "number" && isFinite(o.dbFloor)) {
      gToneEnvDbFloor = o.dbFloor;
    }
    if (o.release === "short" || o.release === "sym" || o.release === "hard") {
      gToneEnvRelease = o.release;
    }
  } catch (e) { /* defekter Stand — Defaults behalten */ }
}
loadToneEnvelope();
```

---

## Schritt 2 — Engine: applyCosRamp neu schreiben (js/audio.js)

Die bestehende Funktion `applyCosRamp` (aktuell Zeilen 102–122) **vollständig
ersetzen**. Sie behält Namen und Signatur `(gainNode, vol, c, ms, ramp)`,
damit die elf bestehenden Aufrufstellen unverändert bleiben — der Parameter
`ramp` wird aber **nicht mehr** verwendet (die globale Einstellung gewinnt).

**Vorher (Zeilen 102–122):**

```js
// Cosinus-Quadrat-Hüllkurve (Hann-Form: sin² beim Anstieg, cos² beim Abfall).
// Reduziert spektrale Onset-Energie gegenüber linearer Rampe; bei CI weniger
// breitbandiger "Klick" beim Tonanfang, sauberer Pitch-Eindruck.
function applyCosRamp(gainNode, vol, c, ms, ramp) {
  const v       = Math.max(0, vol);
  const t0      = c.currentTime;
  const effRamp = Math.min(ramp, Math.max(1, ms / 2));
  const rampSec = effRamp / 1000;
  const N       = 64;
  const up      = new Float32Array(N);
  const dn      = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);                       // 0..1
    const w = 0.5 - 0.5 * Math.cos(Math.PI * x); // sin²(πx/2), 0..1
    up[i] = v * w;
    dn[i] = v * (1 - w);
  }
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.setValueCurveAtTime(up, t0, rampSec);
  gainNode.gain.setValueCurveAtTime(dn, t0 + (ms - effRamp) / 1000, rampSec);
}
```

**Nachher:**

```js
// BA 270: Globale Ton-Huellkurve.
// Liest gToneEnvAttackForm / gToneEnvAttackMs / gToneEnvDbFloor /
// gToneEnvRelease. Der Parameter `ramp` bleibt nur fuer Signatur-
// Kompatibilitaet erhalten und wird nicht mehr genutzt.
//
// Anstiegsformen:
//   hard   — sofort voller Pegel (kein Anstieg)
//   linear — konstante Amplituden-Steigung
//   cos2   — Hann/Cos2 (tangential an beiden Enden), spektral glatteste Form
//   dblin  — dB-lineare Rampe: gleichmaessig wachsende Lautheit; startet
//            beim Startpegel gToneEnvDbFloor (z.B. -50 dB)
// Ausklang:
//   short  — fester kurzer Cos2-Ausklang (TONE_ENV_SHORT_MS)
//   sym    — gleiche Form und Zeit wie der Anstieg
//   hard   — abruptes Ende (kein Ausklang)
function applyCosRamp(gainNode, vol, c, ms, ramp) {
  const v        = Math.max(0, vol);
  const t0       = c.currentTime;
  const totalSec = Math.max(0.001, ms / 1000);
  const form     = gToneEnvAttackForm;

  // Anstiegsdauer (bei "hard" = 0).
  let atkSec = (form === "hard") ? 0 : Math.max(0, gToneEnvAttackMs) / 1000;

  // Ausklangsdauer je nach Modus.
  let relSec;
  if (gToneEnvRelease === "hard") {
    relSec = 0;
  } else if (gToneEnvRelease === "sym") {
    relSec = (form === "hard") ? 0 : Math.max(0, gToneEnvAttackMs) / 1000;
  } else { // "short"
    relSec = TONE_ENV_SHORT_MS / 1000;
  }

  // In die Tondauer einpassen: Ausklang max. halbe Dauer, Anstieg in den Rest.
  relSec = Math.min(relSec, totalSec / 2);
  atkSec = Math.min(atkSec, totalSec - relSec);

  // --- Anstieg ---
  if (atkSec < 0.001) {
    // harter Einstieg (oder zu kurz fuer eine sinnvolle Rampe)
    gainNode.gain.setValueAtTime(v, t0);
  } else {
    const up = _envCurve(form, v, gToneEnvDbFloor, true);
    gainNode.gain.setValueCurveAtTime(up, t0, atkSec);
  }

  // --- Ausklang ---
  if (relSec >= 0.001) {
    // Bei "sym" die Anstiegsform spiegeln, sonst sanftes Cos2.
    const relForm = (gToneEnvRelease === "sym") ? form : "cos2";
    const dn = _envCurve(relForm, v, gToneEnvDbFloor, false);
    gainNode.gain.setValueCurveAtTime(dn, t0 + (totalSec - relSec), relSec);
  }
}

// BA 270: Erzeugt ein 64-Punkt-Huellkurvenarray fuer eine gegebene Form.
//   rising=true  -> 0..voll (Anstieg)
//   rising=false -> voll..0 (Ausklang)
// floorDb wird nur bei "dblin" gebraucht (negativer Startpegel in dB).
function _envCurve(form, v, floorDb, rising) {
  const N = 64;
  const arr = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);            // 0..1 ueber die Rampendauer
    const p = rising ? x : (1 - x);   // Lautstaerke-Fortschritt 0..1
    let g;
    if (form === "linear") {
      g = p;
    } else if (form === "dblin") {
      // dB-linear: bei p=1 voll (0 dB), bei p=0 Startpegel floorDb.
      g = Math.pow(10, (floorDb * (1 - p)) / 20);
    } else { // "cos2" (auch Fallback)
      g = 0.5 - 0.5 * Math.cos(Math.PI * p);
    }
    arr[i] = v * g;
  }
  return arr;
}
```

**Hinweis zu `dblin`:** Bei `p=0` ist `g = 10^(floorDb/20)` (z.B. −50 dB →
0,00316), nicht 0. Der Ton springt also aus der Stille auf diesen sehr
leisen Startpegel — das ist der gewollte, minimale Einsprung. Beim Ausklang
`sym`+`dblin` läuft es spiegelbildlich auf den Startpegel zurück und endet
dort.

---

## Schritt 3 — playRichToneProfile: attackMs-Logik entfernen (js/audio.js)

In `playRichToneProfile` (aktuell ab Zeile 334) die profil-Attack-Berechnung
entfernen.

**Vorher (Zeile 337–339, Kommentar):**

```js
  // Felder: partials, vibratoHz, vibratoCents, amHz, amDepth, attackMs.
  // Profil-Attack erweitert die Cos2-Rampe ueber den Default hinaus
  // (begrenzt durch applyCosRamp auf max ms/2).
```

**Nachher:**

```js
  // Felder: partials, vibratoHz, vibratoCents, amHz, amDepth.
  // BA 270: Anschwingen/Ausklang kommen jetzt aus der globalen
  // Huellkurve (applyCosRamp liest gToneEnv*). Kein profil-eigener Attack.
```

**Vorher (Zeile 348):**

```js
    const effRamp     = Math.max(ramp, profile.attackMs || ramp);
```

Diese Zeile **ersatzlos löschen**.

**Vorher (Zeile 412):**

```js
    applyCosRamp(g, vol, c, ms, effRamp);
```

**Nachher:**

```js
    applyCosRamp(g, vol, c, ms, ramp);
```

(Die übrigen zehn `applyCosRamp(...)`-Aufrufe bleiben unverändert — sie
übergeben `ramp`, der ohnehin ignoriert wird.)

---

## Schritt 4 — attackMs aus den Profilen entfernen (js/citest-profiles.js)

In **jedem** der neun Profile in `js/citest-profiles.js` die Zeile
`attackMs: …` entfernen. Achtung: Die Zeile davor (`amDepth: …,`) endet dann
ohne abschließendes Komma sein zu müssen — JS erlaubt das letzte Property
ohne Komma, aber **sicherer**: das Komma hinter `amDepth`-Zeile belassen ist
ungültig, wenn danach nichts mehr kommt. Also: beim Löschen von `attackMs`
darauf achten, dass die nun letzte Property (`amDepth`) **kein**
nachfolgendes Komma mehr trägt.

Konkret pro Profil (CiH, CiHA, CiHS, CiHF, CiB, CiP, CiBF, CiG, CiS) das
Muster:

```js
    amDepth:      0.08,
    attackMs:     250
```

ersetzen durch:

```js
    amDepth:      0.08
```

(Den jeweiligen `amDepth`-Zahlenwert des Profils beibehalten — nur das
Komma entfernen und die `attackMs`-Zeile streichen.)

**Zusätzlich CiHA umbenennen** — das `label`-Feld (Zeile 45):

**Vorher:**

```js
    abbr: 'CiHA',
    label: 'CI-Test Attack-stark',
```

**Nachher:**

```js
    abbr: 'CiHA',
    label: 'CI-Test Modulation mittel',
```

(Der interne Schlüssel `CiHA` / `richCiHA` bleibt unverändert — nur das
angezeigte Label ändert sich.)

**Kommentare anpassen:** Die Block-Kommentare in `citest-profiles.js`, die
sich auf die Attack-Diagnose beziehen (insbesondere der Block ab Zeile 36
„Diagnose-/Vergleichsvarianten zu CiH" mit „CiHA: laengeres Anschwingen …"),
sind nach dem Wegfall der profil-eigenen Anschwingzeit teils überholt. Den
Kommentar bei CiHA so anpassen, dass er die neue Rolle beschreibt:

```js
  // BA 270: CiHA war urspruenglich "Attack-stark" (langes Anschwingen +
  // starke AM). Das Anschwingen ist jetzt global einstellbar; uebrig
  // bleibt die mittlere AM-Tiefe (0.18) als Zwischenstufe zwischen
  // CiH (0.08) und CiHS (0.25). Daher umbenannt in "Modulation mittel".
```

Den älteren Sammelkommentar (Zeile 36–42) sinngemäß entschärfen: den
Spiegelstrich „CiHA: laengeres Anschwingen + staerkere AM" durch
„CiHA: mittlere AM-Tiefe (Anschwingen jetzt global)" ersetzen. Die übrigen
Diagnose-Hinweise (CiHS, CiHF) bleiben inhaltlich gültig.

---

## Schritt 5 — Profil-Beschreibungen in i18n bereinigen (i18n/de.js)

Alle CI-Test-Profil-Beschreibungen nennen aktuell eine feste Anschwingzeit
(„Anschwingen 250 ms" etc.). Diese Angaben sind jetzt irreführend (die Zeit
ist global). **Anschwing-Angaben aus allen Desc-Strings entfernen** und das
CiHA-Label/-Desc neu setzen. Die exakten Ersetzungen (Zeilen 1147–1164):

```js
    toneRichCiH:             "CI-Test harmonisch",
    toneRichCiHDesc:         "Grundton + 4 harmonische Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 6,0 cent, AM 3,5 Hz / 8,0 %.",
    toneRichCiB:             "CI-Test inharmonisch",
    toneRichCiBDesc:         "Grundton + 4 leicht verstimmte Obertöne (Faktoren 1, 2.005, 3.011, 4.019, 5.028 — Glocken-Anmutung; Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 5,0 cent, AM 3,5 Hz / 8,0 %.",
    toneRichCiHA:            "CI-Test Modulation mittel",
    toneRichCiHADesc:        "Grundton + 4 harmonische Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 6,0 cent, AM 3,5 Hz / 18,0 % — mittlere Modulationstiefe zwischen CI-Test harmonisch (8 %) und AM-langsam (25 %).",
    toneRichCiHS:            "CI-Test AM-langsam",
    toneRichCiHSDesc:        "Grundton + 4 harmonische Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 6,0 cent, AM 2,7 Hz / 25,0 %.",
    toneRichCiHF:            "CI-Test flach",
    toneRichCiHFDesc:        "Grundton + 4 harmonische Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 6,0 cent, kein AM.",
    toneRichCiG:             "CI-Test Grundton",
    toneRichCiGDesc:         "Nur der Grundton, ohne Obertöne. Wie CiHF (Vibrato 5 Hz / 6 cent, kein AM), aber nur ein Partial. Diagnose für die Akkord-Wahrnehmung bei mittleren Elektroden: ohne Obertöne kann das CI keine zusätzlichen Elektroden stimulieren.",
    toneRichCiS:             "CI-Test Sinus",
    toneRichCiSDesc:         "Reiner Sinus, nur der Grundton, ohne Vibrato. Wie CiG, aber zusätzlich ohne Vibrato. Vergleich zu CiG: zeigt, ob das Vibrato (Frequenzmodulation) bei nur einem Partial als eigener Klang hörbar wird.",
    toneRichCiP:             "CI-Test pur",
    toneRichCiPDesc:         "Grundton + 4 harmonische Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Kein Vibrato, kein AM.",
    toneRichCiBF:            "CI-Test inharmonisch flach",
    toneRichCiBFDesc:        "Grundton + 4 leicht verstimmte Obertöne (Amplituden 1, 1/2, 1/3, 1/4, 1/5). Vibrato 5,0 Hz / 5,0 cent, kein AM.",
```

> Andere Sprachen (`en.js`, `fr.js`, `es.js`) werden hier **nicht** angefaßt;
> fehlende/abweichende Keys fallen automatisch auf den deutschen Text zurück.
> Die Profil-Descs dort sind ohnehin teils veraltet — Übersetzungen folgen,
> wenn der Nutzer dazu auffordert.

---

## Schritt 6 — Versionsnummer (js/version.js)

```js
const APP_VERSION = "0.4.270-beta";
```

---

## Schritt 7 — Referenzdateien aktualisieren

**docs/CODESTRUKTUR.md:** Im `audio.js`-Eintrag der Modul-Tabelle ergänzen,
dass es jetzt die globale Ton-Hüllkurve hält. Vorschlag für den Zusatz:

> Seit BA 270: globale Ton-Hüllkurve (Anstieg + Ausklang) als globale
> Variablen `gToneEnvAttackForm` / `gToneEnvAttackMs` / `gToneEnvDbFloor` /
> `gToneEnvRelease`, Setter `setToneEnvelope(patch)`, Loader
> `loadToneEnvelope()` (Top-Level-Aufruf, liest `localStorage`-Key
> `ci-lb-toneEnv`). `applyCosRamp` liest diese Variablen und gilt für alle
> Töne; der frühere profil-eigene `attackMs`-Wert ist entfallen. Bedient
> wird die Einstellung im Tonauswahl-Modal (BA 271).

**docs/Konzept_CI_Testtoene.md:** Im Abschnitt „Wie die Profile aufgebaut
sind" den Punkt **Attack** anpassen — die Anschwingzeit ist nicht mehr
profil-eigen, sondern global. Und im Abschnitt „Aktuelle Profile und ihre
Rollen" CiHA von „Attack-stark" auf „Modulation mittel" umstellen (mittlere
AM-Tiefe als Zwischenstufe; die Attack-Begründung ist mit der globalen
Anschwingsteuerung hinfällig). Einen kurzen neuen Absatz ergänzen, der die
globale Hüllkurve (vier Anstiegsformen inkl. dB-linear, Ausklang-Modi,
Persistenz) festhält und auf BA 270/271 verweist.

---

## Akzeptanztest (vom Nutzer durchzuklicken)

Voraussetzung: Seite neu laden (Cachebuster zieht über die neue Version).

1. **Default-Verhalten unverändert hörbar.** Tab Implantat → eine Elektrode
   anschlagen, oder Messungen → einen Vorhör-Ton auslösen. Erwartet: Töne
   schwingen sanft an wie bisher (Default cos², 500 ms, kurzer Ausklang).
   Kein harter Klick am Anfang.
2. **Persistenz-Mechanik vorhanden.** Browser-Konsole öffnen und eingeben:
   `setToneEnvelope({attackForm:"hard"})` — dann einen Ton auslösen.
   Erwartet: deutlich härterer, „trommelschlag"-artiger Einsatz. Danach
   `localStorage.getItem("ci-lb-toneEnv")` zeigt `{"attackForm":"hard",…}`.
3. **Neuladen behält die Einstellung.** Seite neu laden, erneut einen Ton
   auslösen. Erwartet: weiterhin harter Einsatz (aus localStorage geladen).
   Danach in der Konsole `setToneEnvelope({attackForm:"cos2"})` zum
   Zurückstellen.
4. **dB-linear klingt sanft, leiser Start.** Konsole:
   `setToneEnvelope({attackForm:"dblin", attackMs:800})` → langer Ton.
   Erwartet: sehr gleichmäßiges, weiches Hochkommen aus der Stille.
5. **Tonart-Liste:** Tonauswahl-Modal öffnen. Erwartet: in der CI-Test-
   Gruppe heißt der frühere Eintrag „CI-Test Attack-stark" jetzt
   **„CI-Test Modulation mittel"**. Die Beschreibungs-Tooltips der CI-Test-
   Töne nennen **keine** „Anschwingen X ms"-Angabe mehr.
6. **Keine Konsolenfehler** (kein roter Fehler-Banner oben).

> Vor diesem Test in der Konsole sicherstellen, dass am Ende wieder
> `setToneEnvelope({attackForm:"cos2", attackMs:500, dbFloor:-50, release:"short"})`
> gesetzt ist (Default-Zustand), damit BA 271 von sauberen Defaults startet.

---

## Selbstprüfungs-Auftrag an dich (vor der Fertig-Meldung)

Gehe jeden Akzeptanzpunkt einzeln durch und melde **erfüllt / nicht erfüllt
/ unklar** mit Datei- und Zeilenangabe. Zusätzlich bestätige:

- `applyCosRamp` referenziert die vier `gToneEnv*`-Variablen und nutzt
  `ramp` nicht mehr (Datei:Zeile).
- In `citest-profiles.js` enthält **kein** Profil mehr ein `attackMs`-Feld,
  und alle Objekt-Literale sind syntaktisch gültig (kein hängendes Komma).
- `loadToneEnvelope()` wird als Top-Level-Aufruf genau einmal ausgeführt.
- Versionsnummer steht auf `0.4.270-beta`.

Falls ein Punkt unklar ist: nicht still annehmen, sondern zurückfragen.

---

## Hinweis Übersetzungen

Diese BA fasst nur die deutschen Texte an. Die anderen Sprachen
(`en.js`/`fr.js`/`es.js`) bleiben unverändert und fallen auf Deutsch zurück.
Übersetzungen folgen, wenn der Nutzer dazu auffordert.
