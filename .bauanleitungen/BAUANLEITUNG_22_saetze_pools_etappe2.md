# Bauanleitung 22: Sätze-Pools — Common Voice für 4 Sprachen, Thorsten als benannter Sprecher

Zweite Etappe der Sätze-Wiedergabe. Setzt Bauanleitung 21 voraus
(Etappe 1, `de-m`-Ordner und altes sentences.json-Schema sind da).

Diese Bauanleitung baut um auf das **finale Schema**: Sprecher-zentriert
mit `recordings`-Listen. Damit lässt sich der einzelne Studio-Sprecher
(Thorsten) und der bunt-gemischte Sprecher-Pool (Common Voice) in
derselben Struktur halten und einheitlich abspielen.

## Was am Ende funktioniert

Im Player-Tab im Sätze-Block:

- Sprecher-Dropdown zeigt für aktuelle Tool-Sprache **alle verfügbaren
  Sprecher** plus eine Option **"Alle (zufällig durchmischt)"** als
  Default.
- Beispiel DE: "Alle (zufällig)" / "Thorsten" / "Common Voice"
- Beispiel EN/FR/ES: "Alle (zufällig)" / "Common Voice"
- Bei "Alle" werden alle recordings aller verfügbaren Sprecher flach
  gemischt — Pool-Sprecher dominieren naturgemäß (Thorsten 50,
  CV 100 Recordings), das ist gewollt für maximale Stimmen-Vielfalt.
- Modus-Auswahl (Ein Satz / Wiederholt / Viele zufällig) und alle
  anderen Bedien-Elemente aus Etappe 1 funktionieren unverändert weiter.

## Reihenfolge

1. Ordner `de-m` → `thorsten` umbenennen
2. `sentences.json` per Skript migrieren (neues Schema, Common Voice integrieren)
3. `sentences.js` neu schreiben (Pool-Logik, dynamische Sprecher-Liste)
4. HTML-Block im Player: Sprecher-Dropdown leeren (wird zur Laufzeit befüllt)
5. i18n-Strings: zwei neue Keys
6. README in allen 4 Sprachen ergänzen
7. SPEC.md, CODESTRUKTUR.md
8. Akzeptanztest
9. Selbstprüfung

---

## 1. Ordner umbenennen

```bash
git mv assets/sentences/de-m assets/sentences/thorsten
```

(Wenn das Skript `_build_de_m.sh` mit umbenannt werden soll: `git mv
assets/sentences/_build_de_m.sh assets/sentences/_build_thorsten.sh`
und im Skript intern `de-m` → `thorsten` ersetzen. Reine
Kosmetik, kann auch bleiben.)

## 2. `sentences.json` per Skript migrieren

Das aktuelle Schema ist *sentence-zentriert* (eine Liste von Sätzen, je
mit Audio-Map pro Sprecher). Das neue Schema ist *sprecher-zentriert*:
pro Sprecher eine eigene `recordings`-Liste. Das passt deutlich
besser zu Pools, in denen jeder Sprecher nur eine Aufnahme hat.

Im Repo-Root ausführen:

```bash
python3 << 'PYEOF'
import json

with open("assets/sentences/sentences.json", encoding="utf-8") as f:
    old = json.load(f)

new = {"speakers": {}}

# Thorsten — aus alter sentence-zentrierter Liste rekonstruieren
new["speakers"]["thorsten"] = {
    "lang": "de",
    "label": "Thorsten",
    "kind": "single",
    "source": "Thorsten-Voice",
    "license": "CC0-1.0",
    "credit": "Thorsten Müller (Thorsten-Voice, https://www.thorsten-voice.de) – Trainingsdaten CC0",
    "recordings": [
        {
            "id": s["id"],
            "text": s["de"],
            "audio": "thorsten/" + s["id"] + ".mp3",
        }
        for s in old.get("sentences", [])
    ],
}

# Common Voice Pools aus den 4 manifest.json einlesen
for lang in ("de", "en", "fr", "es"):
    manifest_path = f"assets/sentences/cv-{lang}/manifest.json"
    with open(manifest_path, encoding="utf-8") as f:
        mf = json.load(f)
    new["speakers"][f"cv-{lang}"] = {
        "lang": lang,
        "label": "Common Voice",
        "kind": "pool",
        "source": mf.get("source", "fsicoli/common_voice_17_0"),
        "license": mf.get("license", "CC0-1.0"),
        "credit": "Mozilla Common Voice 17.0 via fsicoli/common_voice_17_0 (CC0-1.0)",
        "recordings": [
            {
                "id": item["id"],
                "text": item["text"],
                "audio": f"cv-{lang}/{item['audio']}",
                "client_hash": item.get("client_hash"),
                "gender": item.get("gender"),
            }
            for item in mf["items"]
        ],
    }

with open("assets/sentences/sentences.json", "w", encoding="utf-8") as f:
    json.dump(new, f, ensure_ascii=False, indent=2)

print("Migration done. Speakers:", list(new["speakers"].keys()))
print("Recordings per speaker:")
for k, v in new["speakers"].items():
    print(f"  {k}: {len(v['recordings'])}")
PYEOF
```

**Erwartete Ausgabe:**

```
Migration done. Speakers: ['thorsten', 'cv-de', 'cv-en', 'cv-fr', 'cv-es']
Recordings per speaker:
  thorsten: 50
  cv-de: 100
  cv-en: 100
  cv-fr: 100
  cv-es: 100
```

Wenn eine Sprache fehlt: prüfen, ob `assets/sentences/cv-XX/manifest.json` existiert.

## 3. `sentences.js` komplett ersetzen

Den **gesamten** Inhalt von `sentences.js` (Z. 1 bis Ende) durch
folgenden Code ersetzen. Begründung: das Pool-Konzept und das neue
Schema ändern fast jede Funktion — ein gezielter Edit wäre umfangreicher
als ein kompletter Tausch.

```js
// ============================================================
// SENTENCES (Sätze-Wiedergabe im Player, Etappe 2: Pools)
// ============================================================
//
// Lädt sentences.json mit sprecher-zentriertem Schema:
//   speakers.<key>.recordings = [{id, text, audio, ...}, ...]
//
// Wiedergabe nutzt denselben Audiograph wie Musikdateien.
// Bei Sprecher-Wahl "any" werden recordings aller verfügbaren
// Sprecher flach gemischt und gleichverteilt zufällig gezogen.

let sCorpus = null;
let sLoaded = false;
let sLoading = false;
let sActive = false;
let sCurRec = null;     // aktuell laufende Recording {speakerKey, idx}
let sShownText = "";
let sPauseTimer = null;
let sPauseMsVal = 2000;

function sPauseMs() { return sPauseMsVal; }

function sPauseSetActive(ms) {
  sPauseMsVal = ms;
  const container = document.getElementById("plSentPauseBtns");
  if (!container) return;
  for (const btn of container.querySelectorAll("button")) {
    const active = parseInt(btn.dataset.ms, 10) === ms;
    btn.style.opacity = active ? "1" : "0.4";
    btn.style.fontWeight = active ? "600" : "";
  }
}

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
    sCorpus = { speakers: {} };
    sLoaded = true;
  } finally {
    sLoading = false;
    sUpdateUI();
  }
}

// Alle Sprecher-Keys für eine Sprache (z.B. "de" -> ["thorsten", "cv-de"]).
function sSpeakersForLang(langCode) {
  if (!sCorpus || !sCorpus.speakers) return [];
  return Object.keys(sCorpus.speakers)
    .filter((k) => sCorpus.speakers[k].lang === langCode);
}

// Liefert ein Array von {speakerKey, recIdx, rec}-Einträgen,
// das die Auswahl-Vorgabe widerspiegelt.
//   spkSel === "any"  -> alle Sprecher der Sprache, flach
//   spkSel === "<key>" -> nur dieser Sprecher
function sBuildRecordingPool(spkSel) {
  if (typeof lang === "undefined") return [];
  const speakers = sSpeakersForLang(lang);
  const keys = spkSel === "any"
    ? speakers
    : speakers.includes(spkSel) ? [spkSel] : [];
  const out = [];
  for (const k of keys) {
    const recs = sCorpus.speakers[k].recordings || [];
    for (let i = 0; i < recs.length; i++) {
      out.push({ speakerKey: k, recIdx: i, rec: recs[i] });
    }
  }
  return out;
}

function sPickNext(mode, pool, prev) {
  if (pool.length === 0) return null;
  if (mode === "loop") return prev || pool[0];
  if (mode === "random") {
    if (pool.length === 1) return pool[0];
    let pick;
    do {
      pick = pool[Math.floor(Math.random() * pool.length)];
    } while (prev && pick.speakerKey === prev.speakerKey
                  && pick.recIdx === prev.recIdx);
    return pick;
  }
  // "once": nicht weiter
  return null;
}

async function sPlayCurrent() {
  if (!sActive || !sCurRec) return;
  const url = "assets/sentences/" + sCurRec.rec.audio;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const arrayBuf = await res.arrayBuffer();
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return;
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
    document.getElementById("plCtrl").style.display = "";
    document.getElementById("plEqViz").style.display = "";
    document.getElementById("plTL").value = 0;
    document.getElementById("plCur").textContent = "0:00";
    if (typeof pFmt === "function") {
      document.getElementById("plTot").textContent = pFmt(pBuf.duration);
    }
    sShownText = sCurRec.rec.text || "";
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
  const pool = sBuildRecordingPool(spkSel);
  if (pool.length === 0) {
    sUpdateUI();
    return;
  }
  if (typeof pPlaying !== "undefined" && pPlaying) {
    pPause();
  }
  sActive = true;
  const mode = document.getElementById("plSentMode").value;
  sCurRec = (mode === "once" || mode === "loop")
    ? pool[0]
    : pool[Math.floor(Math.random() * pool.length)];
  sUpdateButtons();
  sPlayCurrent();
}

function sStop() {
  sActive = false;
  sCurRec = null;
  if (sPauseTimer) { clearTimeout(sPauseTimer); sPauseTimer = null; }
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
  const spkSel = document.getElementById("plSentSpeaker").value;
  const pool = sBuildRecordingPool(spkSel);
  const next = sPickNext(mode, pool, sCurRec);
  if (!next) {
    sStop();
    return;
  }
  sCurRec = next;
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

// Befüllt das Sprecher-Dropdown dynamisch je nach aktueller Tool-Sprache.
function sRefreshSpeakerDropdown() {
  const sel = document.getElementById("plSentSpeaker");
  if (!sel) return;
  const prev = sel.value;
  const speakers = (typeof lang !== "undefined") ? sSpeakersForLang(lang) : [];
  // Leeren
  while (sel.firstChild) sel.removeChild(sel.firstChild);
  // "Alle" als Default-Option
  const optAll = document.createElement("option");
  optAll.value = "any";
  optAll.textContent = (typeof t === "function") ? t("sentSpkAll") : "Alle";
  sel.appendChild(optAll);
  // pro Sprecher eine Option mit dem speakers.<key>.label
  for (const k of speakers) {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = sCorpus.speakers[k].label || k;
    sel.appendChild(opt);
  }
  // Auswahl wiederherstellen, falls noch verfügbar
  if (speakers.includes(prev) || prev === "any") {
    sel.value = prev;
  } else {
    sel.value = "any";
  }
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
    if (sActive) sStop();
    return;
  }
  if (noMat) noMat.style.display = "none";
  if (ctrls) ctrls.style.display = "";
  sRefreshSpeakerDropdown();
  // Falls Sätze laufen und der gewählte Sprecher in dieser Sprache nicht
  // existiert: stoppen (Dropdown ist eh schon umgesprungen auf "any").
  if (sActive && sCurRec) {
    if (!speakers.includes(sCurRec.speakerKey)) sStop();
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

  // Pausen-Buttons (falls von Etappe 1 vorhanden) — Logik unverändert.
  const pauseBtns = document.getElementById("plSentPauseBtns");
  if (pauseBtns) {
    for (const btn of pauseBtns.querySelectorAll("button")) {
      btn.addEventListener("click", function () {
        sPauseSetActive(parseInt(this.dataset.ms, 10));
      });
    }
    sPauseSetActive(sPauseMsVal);
  }

  sLoadIfNeeded();
});
```

## 4. HTML-Anpassung im Player

Im `index.html` das Sprecher-Dropdown leeren — die Optionen werden zur
Laufzeit von `sRefreshSpeakerDropdown()` befüllt. Aktuelle Stelle in
etwa Z. 1170:

**Vorher:**

```html
                <select id="plSentSpeaker" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <option value="m"   data-t-opt="sentSpkM"></option>
                  <option value="f"   data-t-opt="sentSpkF"></option>
                  <option value="any" data-t-opt="sentSpkRand"></option>
                </select>
```

**Nachher:**

```html
                <select id="plSentSpeaker" style="padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:0.88em">
                  <!-- Optionen werden zur Laufzeit von sentences.js befüllt -->
                </select>
```

Die alten i18n-Keys `sentSpkM`, `sentSpkF`, `sentSpkRand` können
bleiben (werden eh nicht mehr referenziert) oder entfernt werden. Wenn
du sie entfernst: in **allen vier Sprach-Blöcken** in `i18n.js` löschen.

## 5. i18n-Strings ergänzen

In `i18n.js` in **allen vier Sprachblöcken** (`de:`, `en:`, `fr:`, `es:`)
einen neuen Key `sentSpkAll` für das "Alle"-Label im Sprecher-Dropdown
ergänzen:

| Sprache | Eintrag |
|---|---|
| de | `sentSpkAll: "Alle (zufällig)",` |
| en | `sentSpkAll: "All (random)",` |
| fr | `sentSpkAll: "Tous (aléatoire)",` |
| es | `sentSpkAll: "Todos (aleatorio)",` |

Die Sprecher-Labels selbst ("Thorsten", "Common Voice") kommen aus
`sentences.json` (`speakers.<key>.label`) — diese sind im Tool **nicht
übersetzt** und das ist gewollt: "Thorsten" bleibt "Thorsten",
"Common Voice" ist ein Eigenname.

## 6. README in 4 Sprachen ergänzen

In allen vier `README_*.md` den bestehenden Quellen-Abschnitt erweitern
um Common Voice. Sonnet darf den Text sinngemäß übersetzen.

### Deutsch (`README_de.md`)

Im Abschnitt "Sprachmaterial und Quellen" (oder wie er heißt) ergänzen:

```markdown
- **Mozilla Common Voice 17.0** – mehrsprachige Sprachdatensätze
  (Deutsch, Englisch, Französisch, Spanisch), CC0-1.0. Bezogen über
  den inoffiziellen Hugging-Face-Mirror
  `fsicoli/common_voice_17_0`. Pro Sprache 100 unterschiedliche
  Sprecher-Aufnahmen im Tool.
  https://commonvoice.mozilla.org
```

In den anderen drei README-Dateien analog auf der jeweiligen Sprache.

## 7. SPEC.md und CODESTRUKTUR.md

### 7a. SPEC.md

Im Abschnitt zur Sätze-Wiedergabe den bestehenden Eintrag erweitern (oder
durch diesen ersetzen):

```markdown
- Sätze-Wiedergabe im Player: Card "Sätze abspielen" unterhalb der
  Audiodatei. Wiedergabe vorgesprochener Sätze durch denselben
  Audiograph wie Musikdateien. Sprecher-Auswahl folgt der globalen
  Tool-Sprache und bietet immer Option "Alle (zufällig)" plus
  einzelne Sprecher der jeweiligen Sprache:
  - **Thorsten** (Deutsch, Studioqualität, 50 kuratierte Sätze;
    Quelle: Thorsten-Voice, CC0)
  - **Common Voice** (Pool aus 100 verschiedenen Sprechern pro
    Sprache; Quelle: Mozilla Common Voice 17.0, CC0)
  Modus-Auswahl: Ein Satz / Wiederholt / Viele zufällig. Optionaler
  Text-Einblender. Bei Modus "Viele zufällig" mit Sprecher-Wahl "Alle"
  wechseln Stimme und Inhalt bei jedem Satz. Sätze und Musikdatei
  schließen sich gegenseitig aus. Schema:
  `assets/sentences/sentences.json` ist sprecher-zentriert,
  `speakers.<key>.recordings[]` mit Text + Audio-Pfad.
```

Den alten Etappe-1-Eintrag ("Nur Thorsten Deutsch") entfernen oder
durch den neuen ersetzen.

### 7b. CODESTRUKTUR.md

Der bestehende `sentences.js`-Eintrag ist überholt (er beschreibt
sentence-zentriertes Schema und gender-Filter). Ersetzen durch:

```markdown
### sentences.js

Sätze-Wiedergabe im Player. Lädt `assets/sentences/sentences.json` im
sprecher-zentrierten Schema:
`speakers.<key> = {lang, label, kind, source, license, credit,
recordings:[{id,text,audio,...}]}`. State: `sActive`, `sCurRec`
({speakerKey, recIdx, rec}), `sShownText`. `sBuildRecordingPool(spkSel)`
liefert das Pool-Array gemäß UI-Auswahl ("any" = alle Sprecher der
aktuellen Sprache flach gemischt). Wiedergabe setzt `pSourceBuf` via
fetch+decodeAudioData und ruft `pPlay()`. `sOnEnded()` wird aus dem
onended-Handler in `player.js` getriggert und wählt nächste Recording
nach Modus. Mutual Exclusion zur Musikdatei unverändert aus
Bauanleitung 21. Sprecher-Dropdown wird dynamisch von
`sRefreshSpeakerDropdown()` befüllt.

Datenstruktur unter `assets/sentences/`:
- `thorsten/01.mp3 … 50.mp3` (Studio-Aufnahmen, Thorsten-Voice)
- `cv-de/`, `cv-en/`, `cv-fr/`, `cv-es/` je 100 MP3s + manifest.json
  (Common Voice, kuratiert über `scripts/fetch_common_voice.py`)
```

Im Abschnitt zu `scripts/` (falls noch nicht vorhanden, neuer Abschnitt):

```markdown
### scripts/fetch_common_voice.py

Pre-Fetch-Werkzeug für Common Voice 17.0 via
`fsicoli/common_voice_17_0` auf Hugging Face. Streamt den `train`-
Split, filtert auf Sprecher-Diversität und Wortlänge, schreibt
kuratierte MP3-Auswahl nach `assets/sentences/cv-<lang>/`. Wird
lokal/im Codespace mit `python scripts/fetch_common_voice.py
--lang <iso> --count <n>` aufgerufen. Lizenz der erzeugten Daten:
CC0-1.0.
```

## 8. Akzeptanztest

**Tool im Browser laden, Sprache = Deutsch, Player-Tab.**

1. Sätze-Card zeigt Sprecher-Dropdown mit drei Optionen:
   **Alle (zufällig)** / **Thorsten** / **Common Voice**.
   → Default-Auswahl: "Alle (zufällig)".

2. Sprache auf Englisch wechseln.
   → Sprecher-Dropdown hat zwei Optionen: **All (random)** /
   **Common Voice**.

3. Sprache zurück auf Deutsch. Sprecher = **Thorsten**, Modus = "Viele
   zufällig", Start.
   → Verschiedene Thorsten-Sätze werden abgespielt. Stimme bleibt immer
   Thorsten (Studio-Klang). Text-Einblender zeigt korrekten deutschen Satz.

4. Stop, Sprecher = **Common Voice**, Modus = "Viele zufällig", Start.
   → Verschiedene Sätze, jeweils anderer Sprecher (Männer, Frauen,
   verschiedene Aufnahmequalitäten — das ist der Pool-Klang).

5. Stop, Sprecher = **Alle (zufällig)**, Modus = "Viele zufällig", Start.
   → Mischung aus Thorsten und Pool-Stimmen, häufiger Pool (mehr
   Aufnahmen), aber Thorsten kommt zwischendurch vor.

6. Modus = "Ein Satz", Sprecher = "Thorsten", Start.
   → Ein einzelner Satz, dann Stille. Stop-Button springt zurück.

7. Modus = "Wiederholt", Sprecher = "Common Voice", Start.
   → Derselbe Satz vom selben Pool-Sprecher in Endlos-Schleife.

8. Sprache auf Französisch wechseln, "Alle (zufällig)", Start.
   → französische Sätze, Pool-Stimmen.

9. Sprache auf Spanisch.
   → spanische Sätze, Pool-Stimmen.

10. EQ-Toggle + Korrektur aktiv, beliebige Sätze laufen.
    → Sätze klingen mit Korrektur (genauso wie Musikdateien).

11. Während Sätze laufen, eine Musikdatei laden.
    → Sätze stoppen, Musik bereit zum Abspielen (großer Play-Button).

## 9. Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jede der 11 Akzeptanzkriterien einzeln
durchgehen. Pro Kriterie melden:

- **erfüllt** mit Datei/Zeilen-Verweis
- **nicht erfüllt** mit Begründung
- **unklar** (z.B. weil vom Browser-Verhalten abhängig) — ehrlich
  markieren, nicht still als "erfüllt".

Außerdem berichten:

- `assets/sentences/de-m/` existiert nicht mehr; `assets/sentences/thorsten/`
  existiert mit 50 MP3s.
- `python3 -c "import json; d=json.load(open('assets/sentences/sentences.json')); print(list(d['speakers'].keys()), [len(v['recordings']) for v in d['speakers'].values()])"`
  zeigt `['thorsten','cv-de','cv-en','cv-fr','cv-es']` und `[50,100,100,100,100]`.
- `grep -c 'sentSpkAll' i18n.js` gibt 4 zurück (in jeder Sprache 1×).
- SPEC.md und CODESTRUKTUR.md aktualisiert.
- README in allen vier Sprachen aktualisiert.

Bei "unklar" oder "nicht erfüllt": am Anfang der Fertig-Meldung
hervorheben, damit der User entscheiden kann.
