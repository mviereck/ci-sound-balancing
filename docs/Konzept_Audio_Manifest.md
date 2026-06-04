# Konzept: Audio-Manifest und Webspace-Struktur

Dieses Dokument beschreibt, wie das CI Sound Balancing Tool seine
Audio-Bibliotheken organisiert: lokale Sammlungen, Webspace-Quellen
und Online-Dienste. Ziel ist eine Struktur, die

- die entpackten Originalordner unangetastet läßt,
- nach klaren Kategorien sortiert ist,
- der UI viele Filterachsen erlaubt (Sprache, Sprecher, Genre, Land,
  Thema, Geräuschart),
- ohne Datendopplung wächst und schrumpft,
- gleichermaßen lokal (`voice/`) und im Webspace
  (`https://ci-sound-balancing.honigburg.de/opus`) funktioniert.

Das zugehörige Tag-Vokabular steht in `docs/Audio_Tag_Katalog.md`.

## Vier Kategorien

Alle Audio-Inhalte verteilen sich auf vier Player-Kategorien:

1. **Musik**
2. **Sätze**
3. **Hörbücher**
4. **Geräusche**

Eine Quelle kann zu mehreren Kategorien beitragen (z. B. MUSAN
liefert Musik **und** Geräusche). Daher ist die Kategorie eine
zweite Ordnungsebene unterhalb der Quelle, nicht umgekehrt.

## Drei Quellentypen

| Typ | Wo | Manifest-Lage |
|---|---|---|
| Lokal/Webspace | `voice/` lokal, `audio.ci-sound-balancing.org/` online | Spiegel unter `audio.manifest/` |
| Online-Dienste | Internet Archive, LibriVox, Tatoeba, Freesound | `audio.manifest/online/<dienst>/...` |
| Embed (JS) | im Tool-Bundle eingebacken | `assets/sentences/embed/...` (Format folgt derselben Logik) |

Die drei Typen nutzen **dasselbe Manifest-Schema**. Der Player muß
zwischen den Typen nur entscheiden, wie er Audio-URLs auflöst.

## Verzeichnis-Struktur

```
voice/                                    # lokale Quelldaten, unangetastet
  <quelle-1>/...                          # z. B. Thorsten Voice/, ARU_Speech_Corpus_v1_0/
  <quelle-2>/...
  ...

audio.manifest/                           # Manifest-Spiegel (separat)
  index.json                              # Top-Level: alle Quellen
  <quelle>/
    source.json                           # Quell-Metadaten + base-Pfad
    <kategorie>/                          # saetze | musik | hoerbuecher | geraeusche
      <gruppe-1>.json                     # Vorsortierungs-Manifest
      <gruppe-2>.json
      ...
  online/
    <dienst>/
      source.json
      <kategorie>/
        buecher/<id>.json                 # Single Source of Truth pro Werk/Album/Paket
        alben/<id>.json
        pakete/<id>.json
        indizes/                          # reine Pointer-Listen, keine Inhalts-Duplikate
          nach-sprache/<lang>.json
          nach-genre/<genre>.json
          nach-sprache-und-genre/<lang>-<genre>.json
```

Online-Inhalte werden nicht im Webspace gespiegelt; ihre Audio-URLs
zeigen direkt auf den Dienst (archive.org, freesound.org, …). Nur
die Manifeste liegen lokal/im Webspace.

## Pfad-Auflösung

Manifeste enthalten **relative Audio-Pfade**. Die volle URL baut der
Player aus drei Teilen zusammen:

```
<webspace-root> + <source.base> + <item.audio>
```

- `<webspace-root>`: lokal `voice/`, online `https://audio.ci-sound-balancing.org/`.
- `<source.base>`: pro Quelle in `source.json` festgelegt, z. B.
  `"base": "Thorsten Voice/"`. Endet auf `/`.
- `<item.audio>`: relativ zu `source.base`, z. B. `"wavs/abcd.opus"`.

Online-Quellen setzen `"base": ""` und tragen die volle URL pro Item.

## Vorsortierung und Tags — beide Ebenen

Die Datei-Aufteilung der Manifeste ist die **Vorsortierung**. Sie
folgt der intuitivsten Achse pro Kategorie und hält Lade-Einheiten
klein:

| Kategorie | typische Vorsortierung |
|---|---|
| Sätze | ein Manifest pro Sprecher; bei Hörbuchsätzen ein Manifest pro Buch; bei Common Voice ein Manifest pro Sprache |
| Musik | ein Manifest pro Sub-Quelle oder Hauptgenre, online auch pro Album |
| Hörbücher | ein Manifest pro Buch |
| Geräusche | ein Manifest pro Quelle oder Klasse |

Zusätzlich trägt **jedes Item einen Tag-Beutel**, der mehrachsige
Filterung ohne Datenumzug erlaubt. Eine neue UI-Achse wird durch
einen neuen Tag eingeführt, ohne Manifeste neu zu schneiden.

Beispiel-Item:

```json
{
  "id": "music-fma-0026",
  "audio": "music/fma/music-fma-0026.opus",
  "duration": 32.1,
  "tags": {
    "lang": null,
    "genres": ["blues"],
    "artist": "Cullah",
    "vocal": "y"
  }
}
```

Welche Tags pro Kategorie zulässig sind, beschreibt
`docs/Audio_Tag_Katalog.md`.

## Indizes (Pointer-Manifeste)

Bei Online-Diensten wäre die thematische Sortierung sonst eine
endlose Duplikation. Deshalb gibt es **Indizes**: reine Pointer-
Listen, die auf existierende Inhalts-Manifeste verweisen.

Beispiel — `online/librivox/hoerbuecher/indizes/nach-genre/klassiker.json`:

```json
{
  "kind": "index",
  "title": "Klassiker (alle Sprachen)",
  "items": [
    { "ref": "../../buecher/de-grimms-maerchen-7891.json" },
    { "ref": "../../buecher/en-moby-dick-1234.json" }
  ]
}
```

Ein Buch lebt nur einmal in `buecher/`, kann aber in beliebig vielen
Indizes auftauchen. Erweitern = eine neue Buch-Datei + Pointer in den
passenden Indizes. Entfernen = Datei löschen + Pointer raus.

## Beispiel: Quell-Manifest (`source.json`)

```json
{
  "schema": "ci-sb-corpus/2",
  "key": "thorsten-voice",
  "name": "Thorsten-Voice",
  "url": "https://www.thorsten-voice.de",
  "license": "CC0-1.0",
  "credit": "Thorsten Müller – Trainingsdaten CC0",
  "base": "Thorsten Voice/",
  "categories": ["saetze"],
  "manifests": {
    "saetze": ["saetze/thorsten.json"]
  }
}
```

## Beispiel: Kategorie-Manifest (Sätze)

`audio.manifest/thorsten-voice/saetze/thorsten.json`:

```json
{
  "schema": "ci-sb-corpus/2",
  "kind": "collection",
  "category": "saetze",
  "title": "Thorsten",
  "lang": "de",
  "contributor": "Thorsten Müller",
  "tags": {
    "speaker_id": "thorsten",
    "gender": "m"
  },
  "items": [
    {
      "id": "01",
      "text": "Die Lufthansa hat mehrere Dreamliner bei Boeing bestellt.",
      "audio": "wavs/abcd1234.opus",
      "duration": 3.4
    }
  ]
}
```

`tags` auf Collection-Ebene gelten als Default für alle Items;
ein Item kann sie überschreiben (selten nötig).

## Beispiel: Hörbuch-Manifest (online)

`audio.manifest/online/librivox/hoerbuecher/buecher/de-grimms-maerchen-7891.json`:

```json
{
  "schema": "ci-sb-corpus/2",
  "kind": "collection",
  "category": "hoerbuecher",
  "title": "Grimms Märchen",
  "lang": "de",
  "tags": {
    "reader": "Jane Doe",
    "reader_gender": "w",
    "work_author": "Brüder Grimm",
    "genres": ["kinder", "klassiker"]
  },
  "items": [
    {
      "id": "ch01",
      "title": "Hänsel und Gretel",
      "audio": "https://archive.org/.../ch01_64kb.mp3",
      "duration": 1184.7,
      "tags": { "chapter_no": 1 }
    }
  ]
}
```

## Embed (Offline-Fallback)

Embed-Module spiegeln dieselbe Struktur, nur daß Audio inline als
data-URL liegt. Ein Embed-Modul pro Sprache:

```js
// assets/sentences/embed/de.js
window.CI_SB_EMBED = window.CI_SB_EMBED || { sources: {} };
window.CI_SB_EMBED.sources["thorsten-voice-de-embed"] = {
  schema: "ci-sb-corpus/2",
  kind: "collection",
  category: "saetze",
  title: "Thorsten (Embed)",
  lang: "de",
  tags: { speaker_id: "thorsten", gender: "m" },
  items: [
    { id: "01", text: "...", audio: "data:audio/opus;base64,...", duration: 3.4 }
  ]
};
```

Hörbücher sind im Embed nicht vorgesehen (Größenordnung). Musik
nur als Mini-Demo, falls überhaupt. Geräusche sind klein genug für
Embed, falls gewünscht (drei test-noise-Dateien, ein paar MUSAN-Proben).

## Lade-Strategie

1. **Start**: `audio.manifest/index.json` laden — kennt alle Quellen,
   mit Sprachen-/Kategorien-Tags pro Quelle.
2. **Bibliothek anzeigen**: pro Quelle/Kategorie das `source.json` und
   die passenden Vorsortierungs-Manifeste lazy laden.
3. **Index-Klick**: ein Pointer-Manifest laden; daraus die referenzierten
   Inhalts-Manifeste nachholen.
4. **Wiedergabe**: Audio-URL aus `webspace-root + base + audio` bauen
   (oder direkt, wenn online).

Es muß nie das gesamte Korpus auf einmal geladen werden.

## Erweitern und Entfernen

- **Neue Quelle**: Ordner in `voice/<neue-quelle>/` ablegen. Eintrag in
  `audio.manifest/index.json`, `source.json` für die Quelle anlegen,
  ein Manifest pro Kategorie schreiben. Fertig.
- **Quelle entfernen**: aus `index.json` streichen und
  `audio.manifest/<quelle>/` löschen. Die Audio-Dateien selbst sind
  davon getrennt — Reihenfolge ist egal.
- **Online-Buch hinzufügen**: Buch-Manifest unter `buecher/` ablegen,
  Pointer in den passenden Indizes ergänzen.
- **Online-Buch entfernen**: Datei löschen, Pointer entfernen.

## Build-Pipeline

Build-Skripte unter `scripts/`. Reihenfolge eines Voll-Laufs:

1. **`voice_to_opus.py`** — erzeugt `voice/opus/` als Mirror des
   `voice/`-Ordners. WAVs aus konvertier-tauglichen Quellen werden zu
   Opus, Test-Standards und Geräusche bleiben unverändert, MLS `train`
   wird ausgeschlossen. Der Mirror ist der spätere Webspace-Inhalt.
2. **`build_manifests.py`** — generiert `audio.manifest/` für alle
   lokalen Quellen (Thorsten, ARU, MUSAN, MLS, Common Voice,
   Freiburger, OLSA, test-noise). Liest Sidecar-Daten
   (`metadata.csv`, `transcripts.txt`+`segments.txt`+`metainfo.txt`,
   `ANNOTATIONS`, Sub-`LICENSE`-Dateien, `manifest.json` u. a.),
   parst pro Item Lizenz und Original-URL, schreibt pro Quelle
   `source.json` plus Kategorie-Manifeste, am Ende einen
   Top-Level-`index.json`. Idempotent, beliebig wiederholbar.
3. **`online_adapters/librivox.py`**, **`internet_archive.py`**,
   **`freesound.py`** — generieren `audio.manifest/online/` mit
   Hörbüchern, Musik und Geräuschen aus den jeweiligen
   Online-Diensten. Pro Adapter eine Curation-JSON. Freesound
   braucht `FREESOUND_API_KEY` als ENV-Variable oder in `.env`
   (in `.gitignore`).
4. **`online_adapters/librivox_enrich.py`** — Stage-2-Anreicherung:
   ergänzt LibriVox-Buch-Manifeste um manuell gepflegte Tags
   (`genres`, `reader_gender`), die die LibriVox-API nicht liefert.
   Liest `librivox_enrichment.json` (Vorlage:
   `librivox_enrichment.example.json`). Muß nach jedem
   `librivox.py`-Lauf erneut laufen.
5. **`musan_noise_enrich.py`** — Stage-2-Anreicherung: ergänzt
   MUSAN-Geräusch-Items um `kind`/`stationary`/`loop_safe`/
   `spectrum`-Tags, weil MUSAN selbst keine Klassen-Tags liefert.
   Vorlage: `musan_noise_enrichment.example.json`.
6. **`build_embed.py`** — schreibt `assets/sentences/embed/<lang>.js`
   für Offline-Fallback. Wählt pro Sprache prioritätsgestützt
   (`studio` > `crowdsourced` > `test` > `dialect` > `emotional`
   > MLS-Hörbuchsätze), kodiert Audio als data-URL, lädt das
   Embed-Modul `window.CI_SB_EMBED.sources`. Konfigurierbar über
   `--max-sources-per-lang` und `--items-per-collection`.

Die Stage-2-Anreicherungs-Daten (`*_enrichment.json`) sind das einzige
manuell gepflegte Stück der Pipeline — alles andere fließt aus
Sidecar-Daten oder API-Antworten.

## Verhältnis zum bestehenden Code

Das bisherige Schema in `assets/sentences/sentences.json` ist
sprecher-zentriert (`speakers.<key>.recordings[]`). Es wird in das
neue Schema überführt. Der Loader bekommt einen Übergangspfad:
Alt-Manifeste werden im Speicher in `collections.<key>` mit
`category: "saetze"` übersetzt. Bestand bleibt lauffähig, bis die
Webspace-Generierung umgestellt ist.

## Konsistenz-Regeln

- `schema`-Feld auf `"ci-sb-corpus/2"` in jeder Manifest-Datei. Loader
  kann auf das Feld prüfen.
- `id` pro Item innerhalb seiner Collection eindeutig.
- Collection-Key (Dateiname ohne `.json`) eindeutig innerhalb der
  Kategorie einer Quelle.
- Pfade in `audio` lateinisch und ASCII-sicher (URL-tauglich).
- Lizenz-Werte sind SPDX-Identifier
  (`CC0-1.0`, `CC-BY-4.0`, `PD`, …).
- Sprache ist BCP 47 (`"de"`, `"en"`, `"de-hes"`, `null` für
  sprachlose Inhalte).
