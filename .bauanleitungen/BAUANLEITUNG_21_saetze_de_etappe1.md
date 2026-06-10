# Bauanleitung 21: Sätze-Player, Etappe 1 (nur Deutsch-Mann)

Erste Etappe der Sätze-Wiedergabe im Player. **Diese Etappe baut nur den
deutschen männlichen Sprecher** — die echte Stimme von Thorsten Müller
(Thorsten-Voice, CC0). Andere Stimmen kommen in einer Folge-Bauanleitung.

## Was am Ende funktioniert

Im Player-Tab gibt es einen neuen Block **"Sätze abspielen"** unterhalb der
Audiodatei-Card. Bei eingestellter Sprache Deutsch und Sprecher "Mann":

- Start/Stop-Button für eine kleine Auswahl deutscher Sätze (50 Stück).
- Modus-Wahl: 1 Satz einmal · 1 Satz wiederholt · viele zufällig.
- Sprecher-Wahl: Mann / Frau / Zufällig (Frau in Etappe 1 deaktiviert).
- Toggle "Text anzeigen" — blendet den aktuellen Satz während des
  Abspielens ein. Lässt sich auch während der Wiedergabe an- und ausschalten.
- Sätze laufen durch denselben Audiograph wie Musikdateien (EQ, MAPLAW,
  Korrektur, Lautstärke wirken alle).
- Sätze und Musikdatei schließen sich gegenseitig aus: wer als letztes
  Start drückt, gewinnt.

In anderen Sprachen (en/fr/es) zeigt der Block einen Hinweis "Für diese
Sprache sind noch keine Sätze verfügbar" — Etappe 2 ergänzt das.

## Reihenfolge

1. `.gitignore` anlegen
2. Audio-Konvertierung (WAVs → MP3s)
3. Korpus-JSON anlegen
4. i18n-Strings (DE/EN/FR/ES)
5. HTML-Block im Player
6. JavaScript: `sentences.js` (neues Modul)
7. Loader-Eintrag in `index.html`
8. Anpassung `player.js` (onended-Hook, Mutual-Exclusion)
9. README ergänzen
10. SPEC.md, CODESTRUKTUR.md
11. Akzeptanztest
12. Selbstprüfung

---

## 1. `.gitignore` anlegen

Im Repo-Root existiert noch keine `.gitignore`. Lokal liegt der Ordner
`.sprachdatensätze/` mit **3,3 GB Trainingsdaten**, die niemals committed
werden dürfen.

Neue Datei `.gitignore` im Repo-Root:

```
# Lokale Sprach-Datensätze (Thorsten-Voice WAVs, Freiburger, Oldenburger).
# NIE committen — mehrere GB.
.sprachdatensätze/

# Backups und Lokales
.backup/
.docs/

# Editor / OS
*.swp
*.swo
*~
.DS_Store
Thumbs.db
```

`.bauanleitungen/` und `.claude/` bewusst NICHT ignorieren — sie sind
gewünscht.

Kontroll-Befehl nach Anlage:

```bash
git status --ignored | grep sprachdatensätze
# muss "ignored" anzeigen, nicht "untracked"
```

## 2. Audio-Konvertierung (WAVs → MP3s)

Die WAVs liegen in `.sprachdatensätze/thorsten-de_v03/wavs/HASH.wav`
(22050 Hz, mono, 16-bit PCM). Wir konvertieren 50 davon zu MP3
(64 kbit/s, mono, 22050 Hz) und legen sie in `assets/sentences/de-m/`
als `01.mp3` bis `50.mp3` ab.

### 2a. Zielordner anlegen

```bash
mkdir -p assets/sentences/de-m
```

### 2b. Konvertierungs-Skript

Neue Datei `assets/sentences/_build_de_m.sh`:

```bash
#!/usr/bin/env bash
# Konvertiert 50 Thorsten-WAVs zu MP3s für Etappe 1.
# Quelle: .sprachdatensätze/thorsten-de_v03/wavs/HASH.wav
# Ziel:   assets/sentences/de-m/NN.mp3
# Voraussetzung: ffmpeg im PATH.

set -euo pipefail
SRC="$(dirname "$0")/../../.sprachdatensätze/thorsten-de_v03/wavs"
DST="$(dirname "$0")/de-m"
mkdir -p "$DST"

# id|hash – Reihenfolge entspricht sentences.json
while IFS='|' read -r id hash; do
  [ -z "$id" ] && continue
  if [ ! -f "$SRC/$hash.wav" ]; then
    echo "FEHLT: $hash.wav (Satz $id)" >&2
    exit 1
  fi
  ffmpeg -loglevel error -y -i "$SRC/$hash.wav" \
    -ar 22050 -ac 1 -b:a 64k "$DST/$id.mp3"
  echo "$id OK"
done <<'EOF'
01|bbefed7d92c4c1c225005dab40ede48c
02|3f282d4a63ad6c72d6d7d362d32efa1f
03|d4c7c84686b98d5bbe4e3956dcaee42d
04|eec9fb56bcf2c0ac7e108af965af928e
05|94afdbbbeb6f7db5d3270b3054c44290
06|97438423cdc763ec5303acda20212e2a
07|1d795720bc1392877385ec5a366ea5bf
08|5da28c34f0b8a6825bfa450f35c78c3e
09|ac22703ce4bdbc41ddc8c7da8ede9292
10|22474d944d5e6b3b39aa9b54a1850c2f
11|c1f3bae6ce2d58d7ce45de80d30288dd
12|8fc00b064fbacc077a38f89768353320
13|4498d14147f10205923ffcdba1ca58e9
14|cc2674f8a3c867439e70bc1ad7cdd5e8
15|ef66ef6d51edc4eb5bcd37ffdabaca4b
16|a775f666ead6dc11f6000071d7da52d2
17|49702db6df4f553aa1c0f931eb0a0850
18|4ffafb65834d538d63f108a00e9fa105
19|7b59338e5d7c7eccb5e1cea99d72c475
20|d59ffce3e293156810740403b1006ecd
21|cb8d6dd4437e43fd4c8bdf4d9067e133
22|3803b5cfbe8ffc20f69f4c2a1e667aa3
23|3b20665aed9eba1dbac6781f5487bb45
24|2790ac1f4807953bcd436bc16c9c4b33
25|bdced79872af7efca74a524b8cdc7f71
26|d8f330ca904285ebdc91858b7cb05e2a
27|637ae972e1347dc2fd13175446808db5
28|b5ed3fc0a48ebc0c3a0a73364826f713
29|2a66db987127271c518f4dcdf3fb6093
30|06ae070f972e96ab3f5f55f69aec42ce
31|f8ee5bd9ea5f3d30834f829af0ccb355
32|f0bcec18c20a08ea277061495cbeb8c2
33|e8df5c7bd3372df61affdb58f92d6517
34|467f3a511219dea32f3f6f6770a6c258
35|cb3e0f7009ce734d4cfeba1192f6a784
36|26f4cfe5abf5a89d16e016f41312da80
37|01969ee5c5add43e90bea8e360610e13
38|7468f1bf7931a7ce57188edb11a0ae17
39|76393bdfde45560bd2470a8cf57b79e2
40|a4ecfb54693d9e92625213e66a55dba6
41|4a0d8ae86941822c9509616274d74210
42|870d43b4bbd16456b43c2eb67ffa7cd8
43|33f1038f537d19eda47a3b0e83f7a8e1
44|ef6a0627776a8c90e9dd21fb0d95b935
45|553458a3c4857c5918db965f743ef081
46|0d8b49efb24eef0f7404862bd96c1ca0
47|86d5c67f14fcf5c1774cca5a3adc9e84
48|fa282f0102fd389c4e81c24aecb5024b
49|409862c043296a5042cfb199cafc8f85
50|3c4e1eedcfdf23a0bfa6ac207763d8a4
EOF

echo "Fertig. 50 MP3s in $DST/"
```

Ausführen:

```bash
chmod +x assets/sentences/_build_de_m.sh
./assets/sentences/_build_de_m.sh
ls assets/sentences/de-m/ | wc -l   # muss 50 sein
du -sh assets/sentences/de-m/        # erwartet 2–4 MB
```

Wenn ffmpeg fehlt: `sudo apt install ffmpeg` (Debian/Ubuntu).

## 3. Korpus-JSON anlegen

Neue Datei `assets/sentences/sentences.json` mit folgendem Inhalt
(deutsche Texte, Slots für andere Sprachen leer für Etappe 2):

```json
{
  "speakers": {
    "de_m": {
      "lang": "de",
      "gender": "m",
      "source": "thorsten-real",
      "label": "Thorsten",
      "credit": "Thorsten Müller (Thorsten-Voice, https://www.thorsten-voice.de) – Trainingsdaten CC0"
    }
  },
  "sentences": [
    {"id":"01","de":"Die Lufthansa hat mehrere Dreamliner bei Boeing bestellt.","audio":{"de_m":"de-m/01.mp3"}},
    {"id":"02","de":"Spieleentwickler scheint für so manchen Jugendlichen ein Traumberuf zu sein.","audio":{"de_m":"de-m/02.mp3"}},
    {"id":"03","de":"Was wiederum als Verschleißteil zählt, ist Auslegungssache.","audio":{"de_m":"de-m/03.mp3"}},
    {"id":"04","de":"Was nun die Klägerin bestreitet, das habe er auch nie verbreitet.","audio":{"de_m":"de-m/04.mp3"}},
    {"id":"05","de":"Meine Krankenkasse bekommt echt die einfachsten Dinge nicht gebacken.","audio":{"de_m":"de-m/05.mp3"}},
    {"id":"06","de":"Er macht sich zum Handlanger von Inkasso-Unternehmen.","audio":{"de_m":"de-m/06.mp3"}},
    {"id":"07","de":"Der Hubraum wird für gewöhnlich in Kubikzentimetern oder Litern angegeben.","audio":{"de_m":"de-m/07.mp3"}},
    {"id":"08","de":"Stumpfe Messer können gefährlicher sein als scharfe, weil sie mehr Kraftaufwand erfordern.","audio":{"de_m":"de-m/08.mp3"}},
    {"id":"09","de":"Valentin kam mit dem exzentrischen Verkäufer nicht klar.","audio":{"de_m":"de-m/09.mp3"}},
    {"id":"10","de":"Weil das Gewinde kaputt ist, wird eine Kontermutter auf der Gegenseite benötigt.","audio":{"de_m":"de-m/10.mp3"}},
    {"id":"11","de":"In der totalen Finsternis wurde Jerry ganz mulmig.","audio":{"de_m":"de-m/11.mp3"}},
    {"id":"12","de":"Puh, das kann ich dir jetzt gar nicht sagen.","audio":{"de_m":"de-m/12.mp3"}},
    {"id":"13","de":"Sie warf sich schnell etwas über und ging zur Wohnungstür.","audio":{"de_m":"de-m/13.mp3"}},
    {"id":"14","de":"Schnell hatte Herr Jost gelernt, den Automaten zu überlisten.","audio":{"de_m":"de-m/14.mp3"}},
    {"id":"15","de":"Vor der Grabbelkiste entsteht ein Gerangel um die begehrten Schnäppchen.","audio":{"de_m":"de-m/15.mp3"}},
    {"id":"16","de":"Im Vorfeld hat er sich einiges überlegt, was er heute umsetzen will.","audio":{"de_m":"de-m/16.mp3"}},
    {"id":"17","de":"Ein Hörbuch hält sich exakt an den Text des Originals.","audio":{"de_m":"de-m/17.mp3"}},
    {"id":"18","de":"Flowcharts bilden sowohl virtuelle, als auch reelle Abläufe ab.","audio":{"de_m":"de-m/18.mp3"}},
    {"id":"19","de":"Das lässt sie in einem ganz anderem Licht erscheinen.","audio":{"de_m":"de-m/19.mp3"}},
    {"id":"20","de":"Steigert man den Strom weiter, wird es schmerzhaft.","audio":{"de_m":"de-m/20.mp3"}},
    {"id":"21","de":"Mit so einer Erwartungshaltung kann man nur enttäuscht werden.","audio":{"de_m":"de-m/21.mp3"}},
    {"id":"22","de":"Für die meisten Touristen ist der Besuch des Hamburger Hafens obligatorisch.","audio":{"de_m":"de-m/22.mp3"}},
    {"id":"23","de":"Und drittens darf es in dem Gespräch nicht um Männer gehen.","audio":{"de_m":"de-m/23.mp3"}},
    {"id":"24","de":"Wichtiger ist, ob man in dem Land gut leben kann.","audio":{"de_m":"de-m/24.mp3"}},
    {"id":"25","de":"An der Kasse bildete sich bereits eine lange Warteschlange.","audio":{"de_m":"de-m/25.mp3"}},
    {"id":"26","de":"Sollte sie auf den Kosten sitzen bleiben, wäre Marina praktisch sofort pleite.","audio":{"de_m":"de-m/26.mp3"}},
    {"id":"27","de":"Sogar der Werfende selbst weiß nicht, wohin der Ball gehen wird.","audio":{"de_m":"de-m/27.mp3"}},
    {"id":"28","de":"Über jene Nacht darf nicht gesprochen werden.","audio":{"de_m":"de-m/28.mp3"}},
    {"id":"29","de":"Ein solcher Automatismus wurde noch nicht nachgewiesen.","audio":{"de_m":"de-m/29.mp3"}},
    {"id":"30","de":"Auch im Privaten wird man immer wieder mit Neuem konfrontiert.","audio":{"de_m":"de-m/30.mp3"}},
    {"id":"31","de":"Auf die neue Version umzusatteln, bedarf einiger Vorbereitung.","audio":{"de_m":"de-m/31.mp3"}},
    {"id":"32","de":"Nein, der Beklagte muss mitnichten ein hohes Schmerzensgeld entrichten.","audio":{"de_m":"de-m/32.mp3"}},
    {"id":"33","de":"Manche Ameisen können verschiedene Polarisationen des Lichtes unterscheiden.","audio":{"de_m":"de-m/33.mp3"}},
    {"id":"34","de":"Lass uns lieber gleich einen dedizierten Server aufsetzen.","audio":{"de_m":"de-m/34.mp3"}},
    {"id":"35","de":"Unsicher stöckelte sie auf den hochhackigen Schuhen an die Theke.","audio":{"de_m":"de-m/35.mp3"}},
    {"id":"36","de":"Dadurch lässt sich ihre Bahn vorausberechnen und sie können abgefangen werden.","audio":{"de_m":"de-m/36.mp3"}},
    {"id":"37","de":"Die extreme Vernetzung wird uns noch teuer zu stehen kommen.","audio":{"de_m":"de-m/37.mp3"}},
    {"id":"38","de":"Jedoch entspricht es viel mehr dem Zeitgeist von damals.","audio":{"de_m":"de-m/38.mp3"}},
    {"id":"39","de":"Wir können die Nerven mit Elektroden stimulieren.","audio":{"de_m":"de-m/39.mp3"}},
    {"id":"40","de":"Längst nicht alles von dem, was hier steht, entspricht meiner Meinung.","audio":{"de_m":"de-m/40.mp3"}},
    {"id":"41","de":"Auf dem Rückweg durchfließt das Blut die Venen.","audio":{"de_m":"de-m/41.mp3"}},
    {"id":"42","de":"Die Flöte gilt als einfach zu erlernendes Instrument.","audio":{"de_m":"de-m/42.mp3"}},
    {"id":"43","de":"Ja, das klang nach einem endgültigen Nein.","audio":{"de_m":"de-m/43.mp3"}},
    {"id":"44","de":"Das wurde einfach über unsere Köpfe hinweg entschieden.","audio":{"de_m":"de-m/44.mp3"}},
    {"id":"45","de":"Dummerweise hatte man vergessen, die Polizei zu schmieren.","audio":{"de_m":"de-m/45.mp3"}},
    {"id":"46","de":"Der Autor charakterisiert den dunklen Lord als Inbegriff des Bösen.","audio":{"de_m":"de-m/46.mp3"}},
    {"id":"47","de":"Erst gestern brachte der Paketbote ein neues.","audio":{"de_m":"de-m/47.mp3"}},
    {"id":"48","de":"Folklore ist der sichtbare Ausdruck des immateriellen kulturellen Erbes.","audio":{"de_m":"de-m/48.mp3"}},
    {"id":"49","de":"Als Entschädigung packte mir die Bäckerin noch zwei Apfeltaschen gratis ein.","audio":{"de_m":"de-m/49.mp3"}},
    {"id":"50","de":"Wie Sie sehen, besteht das Getriebe aus drei konzentrischen Rädern.","audio":{"de_m":"de-m/50.mp3"}}
  ]
}
```

## 4. i18n-Strings ergänzen

In `i18n.js` in **allen vier Sprachen** (de/en/fr/es) folgende Keys
ergänzen. Empfehlung: an einer thematisch passenden Stelle in jedem
Sprachblock einfügen, z.B. direkt vor dem MAPLAW-Block oder am Ende der
Player-Strings. Wichtig ist nur, dass alle vier Sprachen alle Keys haben.

### 4a. Deutsch (im Block `de:`)

```js
    sentTitle: "Sätze abspielen",
    sentSubtitle: "Vorgesprochene Sätze; laufen durch dieselbe Verarbeitung wie Musikdateien.",
    sentSpeaker: "Sprecher:",
    sentSpkM: "Mann",
    sentSpkF: "Frau",
    sentSpkRand: "Zufällig",
    sentMode: "Modus:",
    sentModeOnce: "Ein Satz",
    sentModeLoop: "Ein Satz wiederholt",
    sentModeRandom: "Viele zufällig",
    sentStart: "▶ Sätze",
    sentStop: "■ Stopp",
    sentShowText: "Text anzeigen",
    sentNoMaterial: "Für diese Sprache sind noch keine Sätze verfügbar.",
    sentNotReady: "Sätze werden geladen …",
    sentCredits: "Stimme: Thorsten Müller (Thorsten-Voice), CC0.",
```

### 4b. Englisch (im Block `en:`)

```js
    sentTitle: "Play sentences",
    sentSubtitle: "Pre-recorded sentences; processed through the same pipeline as music files.",
    sentSpeaker: "Speaker:",
    sentSpkM: "Male",
    sentSpkF: "Female",
    sentSpkRand: "Random",
    sentMode: "Mode:",
    sentModeOnce: "One sentence",
    sentModeLoop: "One sentence, repeated",
    sentModeRandom: "Many random",
    sentStart: "▶ Sentences",
    sentStop: "■ Stop",
    sentShowText: "Show text",
    sentNoMaterial: "No sentences available for this language yet.",
    sentNotReady: "Loading sentences …",
    sentCredits: "Voice: Thorsten Müller (Thorsten-Voice), CC0.",
```

### 4c. Französisch (im Block `fr:`)

```js
    sentTitle: "Lire des phrases",
    sentSubtitle: "Phrases pré-enregistrées, traitées par la même chaîne audio que les fichiers musicaux.",
    sentSpeaker: "Locuteur :",
    sentSpkM: "Homme",
    sentSpkF: "Femme",
    sentSpkRand: "Aléatoire",
    sentMode: "Mode :",
    sentModeOnce: "Une phrase",
    sentModeLoop: "Une phrase, en boucle",
    sentModeRandom: "Plusieurs aléatoires",
    sentStart: "▶ Phrases",
    sentStop: "■ Arrêter",
    sentShowText: "Afficher le texte",
    sentNoMaterial: "Aucune phrase disponible dans cette langue pour le moment.",
    sentNotReady: "Chargement des phrases…",
    sentCredits: "Voix : Thorsten Müller (Thorsten-Voice), CC0.",
```

### 4d. Spanisch (im Block `es:`)

```js
    sentTitle: "Reproducir frases",
    sentSubtitle: "Frases pregrabadas; procesadas con la misma cadena de audio que los archivos de música.",
    sentSpeaker: "Locutor:",
    sentSpkM: "Hombre",
    sentSpkF: "Mujer",
    sentSpkRand: "Aleatorio",
    sentMode: "Modo:",
    sentModeOnce: "Una frase",
    sentModeLoop: "Una frase, en bucle",
    sentModeRandom: "Varias aleatorias",
    sentStart: "▶ Frases",
    sentStop: "■ Detener",
    sentShowText: "Mostrar texto",
    sentNoMaterial: "Aún no hay frases disponibles en este idioma.",
    sentNotReady: "Cargando frases…",
    sentCredits: "Voz: Thorsten Müller (Thorsten-Voice), CC0.",
```

## 5. HTML-Block im Player

In `index.html` nach Card "4. Audiodatei" (endet bei `</div>` in Zeile
~1157, direkt VOR dem Experimentell-Toggle-Card "Toggle: experimentelle
Optionen"), neue Card einfügen:

```html
        <!-- 4b. Sätze abspielen -->
        <div class="card" id="plSentencesCard">
          <h3 data-t="sentTitle" style="margin-bottom: 4px"></h3>
          <div class="explain" style="font-size:0.85em;color:var(--text-muted);margin-bottom:10px" data-t="sentSubtitle"></div>

          <div id="plSentNoMaterial" class="explain explain-warn" style="display:none;font-size:0.85em" data-t="sentNoMaterial"></div>
          <div id="plSentNotReady" class="explain" style="display:none;font-size:0.85em;color:var(--text-muted)" data-t="sentNotReady"></div>

          <div id="plSentControls" style="display:none">
            <div class="controls-row" style="margin-bottom:8px">
              <div class="control-group">
                <label data-t="sentSpeaker" style="margin-right:6px"></label>
                <select id="plSentSpeaker" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="m"   data-t-opt="sentSpkM"></option>
                  <option value="f"   data-t-opt="sentSpkF"></option>
                  <option value="any" data-t-opt="sentSpkRand"></option>
                </select>
              </div>
              <div class="control-group">
                <label data-t="sentMode" style="margin-right:6px"></label>
                <select id="plSentMode" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="once"   data-t-opt="sentModeOnce"></option>
                  <option value="loop"   data-t-opt="sentModeLoop"></option>
                  <option value="random" data-t-opt="sentModeRandom" selected></option>
                </select>
              </div>
            </div>

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

            <div id="plSentTextBox" style="display:none;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:0.95em;line-height:1.4;min-height:2.4em">
              <span id="plSentText"></span>
            </div>
          </div>

          <div class="explain" style="font-size:0.75em;color:var(--text-muted);margin-top:10px" data-t="sentCredits"></div>
        </div>
```

`data-t-opt` ist die existierende Konvention für Option-Labels in Selects
(siehe Warp-Methoden-Select). Falls die Konvention `data-t-opt` im
i18n-Loop noch nicht bekannt ist: prüfen, ob `applyLang()` in `i18n.js`
auch `[data-t-opt]` durchläuft. Falls nicht, in `applyLang()` ergänzen:

```js
  document.querySelectorAll("[data-t-opt]").forEach((el) => {
    el.textContent = t(el.dataset.tOpt);
  });
```

(Falls die Schleife schon existiert — dann unverändert lassen.)

## 6. Neues JavaScript-Modul `sentences.js`

Neue Datei `sentences.js` im Repo-Root:

```js
// ============================================================
// SENTENCES (Sätze-Wiedergabe im Player, Etappe 1: nur DE-Mann)
// ============================================================
//
// Lädt sentences.json beim ersten Anzeigen, hält State (Modus,
// Sprecher, aktueller Index). Wiedergabe nutzt denselben Audio-
// graph wie Musikdateien: lädt MP3 -> decodeAudioData -> setzt
// pSourceBuf -> startet via pPlay(). Nach onended (im
// sentence-Mode) wird der nächste Satz geladen.
//
// Mutual Exclusion zur Musikdatei:
//  - Sätze-Start setzt sSentenceMode=true und ruft pPause() falls
//    Musik läuft.
//  - Musik-Start (plPlay-Click) bricht Sätze-Mode ab.

let sCorpus = null;        // sentences.json geparst
let sLoaded = false;
let sLoading = false;
let sActive = false;       // läuft gerade ein Sätze-Modus?
let sCurIdx = -1;          // Index in sCorpus.sentences
let sCurSpkKey = null;     // "de_m", später "de_f" etc.
let sShownText = "";       // aktuell sichtbarer Text

// Wird von außen (init / applyLang) gerufen.
async function sLoadIfNeeded() {
  if (sLoaded || sLoading) return;
  sLoading = true;
  try {
    const res = await fetch("assets/sentences/sentences.json", { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    sCorpus = await res.json();
    sLoaded = true;
  } catch (err) {
    console.error("[sentences] konnte sentences.json nicht laden:", err);
    sCorpus = { speakers: {}, sentences: [] };
    sLoaded = true; // weiter, sUpdateUI zeigt dann "noch keine Sätze"
  } finally {
    sLoading = false;
    sUpdateUI();
  }
}

// Liste verfügbarer Sprecher-Keys für eine Sprache, z.B. lang="de"
// -> ["de_m"] (in Etappe 1).
function sSpeakersForLang(langCode) {
  if (!sCorpus || !sCorpus.speakers) return [];
  return Object.keys(sCorpus.speakers)
    .filter((k) => sCorpus.speakers[k].lang === langCode);
}

function sSentencesWithAudioFor(spkKey) {
  if (!sCorpus) return [];
  return sCorpus.sentences.filter((s) => s.audio && s.audio[spkKey]);
}

// Wählt Sprecher-Key gemäß UI-Auswahl. spkSel: "m" | "f" | "any".
function sPickSpeakerKey(spkSel) {
  if (typeof lang === "undefined") return null;
  const all = sSpeakersForLang(lang);
  if (all.length === 0) return null;
  if (spkSel === "any") {
    return all[Math.floor(Math.random() * all.length)];
  }
  const wanted = all.find((k) => sCorpus.speakers[k].gender === spkSel);
  return wanted || null;
}

function sPickNextIdx(mode, list, prevIdx) {
  if (list.length === 0) return -1;
  if (mode === "loop") return prevIdx >= 0 ? prevIdx : 0;
  if (mode === "random") {
    if (list.length === 1) return 0;
    let i;
    do {
      i = Math.floor(Math.random() * list.length);
    } while (i === prevIdx);
    return i;
  }
  // "once": nicht weiter
  return -1;
}

async function sPlayCurrent() {
  if (!sActive) return;
  if (sCurIdx < 0 || !sCurSpkKey) return;
  const list = sSentencesWithAudioFor(sCurSpkKey);
  const item = list[sCurIdx];
  if (!item) {
    sStop();
    return;
  }
  const url = "assets/sentences/" + item.audio[sCurSpkKey];
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arrayBuf = await res.arrayBuffer();
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return; // Stop während Decode
    pSourceBuf = decoded;
    pMonoBuf = null;
    pLeftOnlyBuf = null;
    pRightOnlyBuf = null;
    if (typeof pWarpedBuf !== "undefined") {
      pWarpedBuf = null;
      if (typeof pWarpUpdUI === "function") pWarpUpdUI();
    }
    pOff = 0;
    pBuf = getPlaybackBuffer();
    pBuildEQ();
    pDrawEQ();
    pBuildTbl();
    // Player-UI: Controls einblenden (so wie bei Datei-Upload),
    // Seekbar zurücksetzen.
    document.getElementById("plCtrl").style.display = "";
    document.getElementById("plEqViz").style.display = "";
    document.getElementById("plTL").value = 0;
    document.getElementById("plCur").textContent = "0:00";
    if (typeof pFmt === "function") {
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
    }
    sShownText = item[lang] || item.de || "";
    sUpdateTextBox();
    await pPlay();
  } catch (err) {
    console.error("[sentences] Wiedergabe-Fehler:", err);
    sStop();
  }
}

function sStart() {
  if (!sLoaded) return;
  const spkSel = document.getElementById("plSentSpeaker").value;
  const spk = sPickSpeakerKey(spkSel);
  if (!spk) {
    sUpdateUI();
    return;
  }
  // Falls Musik gerade läuft, pausieren (Mutual Exclusion).
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  sActive = true;
  sCurSpkKey = spk;
  const list = sSentencesWithAudioFor(spk);
  const mode = document.getElementById("plSentMode").value;
  sCurIdx = mode === "loop" || mode === "once"
    ? 0
    : Math.floor(Math.random() * Math.max(1, list.length));
  sUpdateButtons();
  sPlayCurrent();
}

function sStop() {
  sActive = false;
  sCurIdx = -1;
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
    pOff = 0;
    if (typeof pUpdTL === "function") pUpdTL();
  }
  sShownText = "";
  sUpdateTextBox();
  sUpdateButtons();
}

// Wird von player.js nach onended aufgerufen, falls sActive=true.
function sOnEnded() {
  if (!sActive) return;
  const mode = document.getElementById("plSentMode").value;
  const list = sSentencesWithAudioFor(sCurSpkKey);
  const next = sPickNextIdx(mode, list, sCurIdx);
  if (next < 0) {
    sStop();
    return;
  }
  // Bei "Random" auch Sprecher neu würfeln, falls "any".
  const spkSel = document.getElementById("plSentSpeaker").value;
  if (spkSel === "any" && mode === "random") {
    const spk = sPickSpeakerKey("any");
    if (spk) sCurSpkKey = spk;
  }
  sCurIdx = next;
  sPlayCurrent();
}

function sUpdateUI() {
  if (typeof lang === "undefined") return;
  const card = document.getElementById("plSentencesCard");
  if (!card) return;
  const ctrls = document.getElementById("plSentControls");
  const noMat = document.getElementById("plSentNoMaterial");
  const notReady = document.getElementById("plSentNotReady");
  if (!sLoaded) {
    if (notReady) notReady.style.display = "";
    if (noMat) noMat.style.display = "none";
    if (ctrls) ctrls.style.display = "none";
    return;
  }
  if (notReady) notReady.style.display = "none";
  const speakers = sSpeakersForLang(lang);
  if (speakers.length === 0) {
    if (noMat) noMat.style.display = "";
    if (ctrls) ctrls.style.display = "none";
    // Wenn aktuelle Wiedergabe lief und Sprache gewechselt wurde -> stoppen.
    if (sActive) sStop();
    return;
  }
  if (noMat) noMat.style.display = "none";
  if (ctrls) ctrls.style.display = "";
  // Geschlechter, die nicht verfügbar sind, ausgrauen.
  const sel = document.getElementById("plSentSpeaker");
  if (sel) {
    const hasM = speakers.some((k) => sCorpus.speakers[k].gender === "m");
    const hasF = speakers.some((k) => sCorpus.speakers[k].gender === "f");
    for (const o of sel.options) {
      if (o.value === "m") o.disabled = !hasM;
      if (o.value === "f") o.disabled = !hasF;
    }
    if (sel.value === "m" && !hasM) sel.value = hasF ? "f" : "any";
    if (sel.value === "f" && !hasF) sel.value = hasM ? "m" : "any";
  }
  sUpdateButtons();
  sUpdateTextBox();
}

function sUpdateButtons() {
  const start = document.getElementById("plSentStart");
  const stop  = document.getElementById("plSentStop");
  if (start) start.disabled = sActive;
  if (stop)  stop.disabled  = !sActive;
}

function sUpdateTextBox() {
  const show = document.getElementById("plSentShowText");
  const box  = document.getElementById("plSentTextBox");
  const txt  = document.getElementById("plSentText");
  if (!show || !box || !txt) return;
  if (show.checked && sShownText) {
    txt.textContent = sShownText;
    box.style.display = "";
  } else {
    box.style.display = "none";
  }
}

// ============================================================
// Verdrahtung
// ============================================================
document.addEventListener("DOMContentLoaded", function () {
  const start = document.getElementById("plSentStart");
  const stop  = document.getElementById("plSentStop");
  const show  = document.getElementById("plSentShowText");
  if (start) start.addEventListener("click", sStart);
  if (stop)  stop.addEventListener("click",  sStop);
  if (show)  show.addEventListener("change", sUpdateTextBox);
  sLoadIfNeeded();
});
```

## 7. Loader-Eintrag in `index.html`

In `index.html` Zeile 29 das Loader-Array um `sentences.js` ergänzen
(unmittelbar vor `'init.js'`):

**Vorher:**
```js
        'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'init.js'
```

**Nachher:**
```js
        'levels-tab.js', 'player.js', 'freq-warp.js', 'maplaw.js', 'lr-balance.js', 'sentences.js', 'init.js'
```

## 8. Anpassung `player.js`

### 8a. onended-Hook (sentence-Mode abfangen)

In `player.js` in der Funktion `pPlay()` den onended-Handler erweitern.
**Aktuelle Stelle** (etwa Z. 514–523):

```js
  if (leadSrc) {
    leadSrc.onended = function () {
      if (pPlaying) {
        pPlaying = false;
        pOff = 0;
        pUpdBtn();
        pUpdTL();
      }
    };
  }
```

**Ersetzen durch:**

```js
  if (leadSrc) {
    leadSrc.onended = function () {
      if (pPlaying) {
        pPlaying = false;
        pOff = 0;
        pUpdBtn();
        pUpdTL();
        if (typeof sActive !== "undefined" && sActive
            && typeof sOnEnded === "function") {
          sOnEnded();
        }
      }
    };
  }
```

### 8b. Musik-Start bricht Sätze-Mode ab

In `player.js` in `pToggle()` zu Beginn ergänzen (vor dem `if (pPlaying)`):

**Vorher (Z. 403–408):**
```js
function pToggle() {
  if (!pBuf) return;
  if (pCtx.state === "suspended") pCtx.resume();
  if (pPlaying) pPause();
  else pPlay();
}
```

**Nachher:**
```js
function pToggle() {
  if (!pBuf) return;
  if (pCtx.state === "suspended") pCtx.resume();
  // Wenn der User auf den Datei-Play-Button drückt, während Sätze
  // laufen, ist das ein Wechsel zur Musikdatei. Sätze-Mode beenden,
  // ohne pPause aufzurufen (das macht der normale Pfad).
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
    return; // sStop hat bereits pausiert; User klickt erneut für Datei.
  }
  if (pPlaying) pPause();
  else pPlay();
}
```

Der frühe `return` ist Absicht: erster Klick stoppt die Sätze, zweiter
Klick startet die Musikdatei. Vermeidet, dass die Sätze-Source und die
Musik-Source gleichzeitig kurz laufen.

### 8c. Side-Change und Datei-Upload sollen Sätze-Mode beenden

In `player.js` in `updatePlayerForSideChange()` (Z. 242) gleich zu
Beginn ergänzen:

```js
function updatePlayerForSideChange() {
  if (typeof sActive !== "undefined" && sActive
      && typeof sStop === "function") {
    sStop();
  }
  if (pSourceBuf) {
    ...
```

Und im `plAudio change`-Handler (Z. 207ff.) ebenfalls zu Beginn:

```js
  .addEventListener("change", async function (e) {
    const f = e.target.files[0];
    if (!f) return;
    if (typeof sActive !== "undefined" && sActive
        && typeof sStop === "function") {
      sStop();
    }
    try {
      ...
```

### 8d. Sprachwechsel signalisieren

In `i18n.js` in `applyLang()` am Ende (vor der schließenden `}` der
Funktion) ergänzen:

```js
  if (typeof sUpdateUI === "function") sUpdateUI();
```

## 9. README ergänzen

In allen vier README-Dateien (`README_de.md`, `README_en.md`,
`README_fr.md`, `README_es.md`) einen neuen Abschnitt **am Ende**
einfügen. Sonnet darf den Text sinngemäß übersetzen; Inhalt:

### Deutsch (`README_de.md`):

```markdown
## Sprachmaterial und Quellen

Die Sätze im Player ("Sätze abspielen") nutzen Sprachaufnahmen und
Sprachsynthese aus folgenden offenen Quellen:

- **Thorsten-Voice** – deutsche Stimme von Thorsten Müller,
  Trainingsdaten CC0. https://www.thorsten-voice.de
- **Piper TTS** – neuronale Sprachsynthese, MIT-Lizenz. Wird in
  späteren Etappen für weitere Sprachen und Sprecher genutzt.
  https://github.com/rhasspy/piper

Die ausgewählten Sätze stammen aus dem Trainings-Korpus von
Thorsten-Voice und werden inhaltlich nicht weiterverbreitet — nur die
hier explizit ausgewählten 50 Audio-Snippets liegen im Repo.
```

(Analog auf EN/FR/ES übersetzen — kurz und sinngemäß, keine
Buchstabentreue.)

## 10. SPEC.md und CODESTRUKTUR.md

### 10a. SPEC.md

Im Abschnitt zum Player (etwa nach dem MAPLAW-Eintrag) neuen Absatz:

```markdown
- Sätze-Wiedergabe im Player: Card "Sätze abspielen" unterhalb der
  Audiodatei. Wiedergabe vorgesprochener Sätze, läuft durch denselben
  Audiograph wie Musikdateien (EQ, MAPLAW, Korrektur, Lautstärke
  wirken). UI: Sprecher-Auswahl (Mann/Frau/Zufällig — Verfügbarkeit
  hängt von aktueller Tool-Sprache ab), Modus (1×/wiederholt/zufällig),
  Start/Stop, Toggle "Text anzeigen" (zeigt aktuellen Satz). Sätze und
  Musikdatei schließen sich gegenseitig aus. In Etappe 1 ist nur
  Deutsch-Mann (echte Aufnahmen von Thorsten Müller, 50 Sätze)
  verfügbar; andere Sprachen zeigen Hinweis "noch keine Sätze
  verfügbar". Quellen: Thorsten-Voice (CC0), siehe README.
```

### 10b. CODESTRUKTUR.md

Neues JS-Modul eintragen. Beispielhafter neuer Abschnitt
(an passender Stelle, analog zu `maplaw.js` u.ä.):

```markdown
### sentences.js

Sätze-Wiedergabe im Player. Lädt `assets/sentences/sentences.json`
(Korpus + Sprecher-Meta), hält State (sActive, sCurIdx, sCurSpkKey).
Wiedergabe nutzt denselben Audiograph wie Musikdateien: setzt
`pSourceBuf` per fetch+decodeAudioData, ruft `pPlay()` aus
`player.js`. `sOnEnded()` wird aus dem onended-Handler in `player.js`
gerufen, wenn `sActive`, und wählt den nächsten Satz nach Modus.

Mutual Exclusion zur Musikdatei: `sStart()` pausiert pPlaying;
`pToggle()` und Datei-Upload rufen `sStop()`, wenn `sActive`.
```

Außerdem in der Loader-Reihenfolge in CODESTRUKTUR.md `sentences.js`
ergänzen (zwischen `lr-balance.js` und `init.js`).

## 11. Akzeptanztest (klickweise)

Diese Schritte bitte ohne Code-Kenntnisse durchgehen, jeweils
**erwartetes Verhalten** prüfen. Wenn etwas abweicht, dokumentieren
und Sonnet melden.

**Tool laden.**
   → Erwartet: Der Player-Tab zeigt eine neue Card "Sätze abspielen"
   unterhalb der Audiodatei-Card. Drop-Downs Sprecher / Modus,
   Start/Stop-Buttons, Toggle "Text anzeigen", Quellenhinweis am
   Fuß der Card.

**Sprache auf Deutsch stellen.**
   → Erwartet: Sprecher-Dropdown zeigt Mann/Frau/Zufällig, "Frau" ist
   ausgegraut (in Etappe 1 nicht verfügbar). "Start"-Button aktiv.

**Sprache auf Englisch wechseln.**
   → Erwartet: Statt der Controls erscheint die Meldung "No sentences
   available for this language yet." Start-Button nicht sichtbar.
   Falls Sätze gerade liefen: sofort gestoppt.

**Sprache zurück auf Deutsch. Sprecher = Mann, Modus = Ein Satz.
   Start klicken.**
   → Erwartet: Ein deutscher Satz wird gesprochen (z.B. "Die Lufthansa
   …"), dann Stille. Stop-Button springt zurück auf inaktiv. Seekbar
   und Zeitanzeige des Hauptplayers verhalten sich wie bei einer
   normalen kurzen Audiodatei.

**Modus auf "Ein Satz wiederholt", Start klicken.**
   → Erwartet: Derselbe Satz wird in Endlosschleife wiederholt
   (mit kurzer Pause). Stop unterbricht.

**Modus auf "Viele zufällig", Start klicken.**
   → Erwartet: Verschiedene Sätze laufen hintereinander. Stop hält
   sofort an.

**"Text anzeigen" anklicken während Sätze laufen.**
   → Erwartet: Eine Textbox blendet sich ein und zeigt den gerade
   gesprochenen Satz. Bei Satzwechsel ändert sich der Text. Erneutes
   Klicken blendet die Box wieder aus, Audio läuft weiter.

**EQ-Schalter ein, "Korrektur anwenden" aktiv, Sätze laufen.**
   → Erwartet: Die Sätze klingen mit Korrekturkurve genauso, wie eine
   Musikdatei mit Korrekturkurve klingt — der Audiograph wirkt.

**MAPLAW-Simulation aktivieren (falls MED-EL), Sätze laufen.**
   → Erwartet: MAPLAW wirkt auch auf die Sätze hörbar.

**Eine Musikdatei laden während Sätze gerade laufen.**
    → Erwartet: Sätze stoppen, Stop-Button im Sätze-Block deaktiviert,
    die Musikdatei wird in den Player geladen wie gewohnt.

**Sätze laufen, dann großer Play-Button (Datei-Player) klicken.**
    → Erwartet: Sätze stoppen sofort. Ein zweiter Klick startet (falls
    Datei geladen ist) die Musikdatei.

**Seite (Side) im Header umschalten während Sätze laufen.**
    → Erwartet: Sätze stoppen.

## 12. Selbstprüfungs-Auftrag an Sonnet

**Bevor du "fertig" meldest**, gehe jede der 12 Akzeptanzkriterien aus
Abschnitt 11 einzeln durch. Für jede Kriterie melde:

- **erfüllt** — mit Datei/Zeilen-Verweis auf die Stelle, die das
  bewirkt;
- **nicht erfüllt** — mit Begründung, was fehlt;
- **unklar** — wenn du nicht entscheiden kannst, ob es funktioniert
  (z.B. weil es vom Browser-Verhalten abhängt). Markiere "unklar"
  ehrlich, nicht still als "erfüllt".

Außerdem berichte:

- Ist `.gitignore` greift? (`git status --ignored` zeigt
  `.sprachdatensätze/` als ignored.)
- Wie viele MP3-Dateien sind in `assets/sentences/de-m/`? (Soll: 50.)
- Lässt sich `sentences.json` als JSON parsen? (Schnellprüfung:
  `python3 -c "import json; json.load(open('assets/sentences/sentences.json'))"`.)
- Sind die i18n-Keys in allen 4 Sprachen vollständig? (Sentinel-Check:
  `grep -c 'sentTitle' i18n.js` muss 4 zurückgeben.)
- Wurden SPEC.md, CODESTRUKTUR.md, alle 4 README-Dateien aktualisiert?

Bei "unklar" oder "nicht erfüllt": melde es am Anfang deiner
Fertig-Meldung, damit der User entscheiden kann.
