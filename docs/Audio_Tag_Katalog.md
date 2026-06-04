# Audio-Tag-Katalog

Dieses Dokument legt fest, welche Tag-Felder in den Audio-Manifesten
zulässig sind und welche Werte sie tragen dürfen. Es ergänzt
`docs/Konzept_Audio_Manifest.md`.

Tags leben in einem `tags`-Objekt — entweder auf Collection-Ebene
(gelten als Default für alle Items) oder pro Item (überschreibt
den Collection-Default).

## Konventionen

- Tag-Namen sind **lateinisch und kleingeschrieben**, Wörter mit
  Bindestrich getrennt (`reader_gender`, `loop_safe`,
  `dominant_freq_hz`).
- Werte sind **JSON-Primitive** oder Arrays davon.
- Sprach-Codes folgen **BCP 47** (`"de"`, `"en"`, `"de-hes"`,
  `"fr-CA"`).
- Boolean-artige Werte werden als `"y"`/`"n"`-Strings geschrieben,
  damit JSON-Diff lesbar bleibt. Ausnahme: `vocal`, `stationary`
  und `loop_safe` aus historischen Gründen identisch behandelt.
- Unbekannte Werte: `null` (nie raten).

## Tags für alle Kategorien

| Tag | Typ | Erläuterung |
|---|---|---|
| `lang` | BCP 47 / `null` | Sprache des Inhalts. `null` für sprachlose Geräusche und Instrumentalmusik. |
| `duration` | float | Sekunden. Auch ohne `tags`-Block oft direkt am Item. |
| `source_item_id` | string | Original-ID in der Quelle (Common-Voice-ID, MUSAN-ID, LibriVox-Buch-ID, …). Für Rückverfolgung. |
| `license` | SPDX-string | Nur falls von Collection-Default abweichend. |

## Kategorie: Sätze

| Tag | Werte | Erläuterung |
|---|---|---|
| `speaker_id` | string | Stabile Sprecher-Kennung. Bekannte Werte: `"thorsten"`, `"aru-id01"` … `"aru-id12"`, `"olsa-female"`, `"freiburger-mono"`, `"freiburger-poly"`, `"cv-anon"` (Common Voice, anonym). |
| `gender` | `"m"`, `"w"`, `"u"` | Sprecher-Geschlecht. `"u"` = unbekannt (z. B. Common Voice). |
| `accent` | string / `null` | Optional, freier Text. Bei Common Voice wird der Original-Eintrag übernommen (z. B. `"Deutschland Deutsch"`). |
| `book_id` | string | Nur bei Hörbuchsätzen (MLS). LibriVox-Buch-ID. |
| `book_title` | string | Nur bei Hörbuchsätzen. |
| `chapter` | string | Nur bei Hörbuchsätzen. Originale Kapitel-Bezeichnung aus `metainfo.txt`. |
| `style` | `"studio"`, `"crowdsourced"`, `"test"`, `"emotional"`, `"dialect"` | Aufnahme-Charakter. |
| `emotion` | string | Nur bei `style: "emotional"`. Werte z. B. `"neutral"`, `"happy"`, `"angry"`, `"sad"`, `"disgust"`, `"surprised"`, `"sleepy"`, `"drunk"`, `"whisper"`, `"amused"` (Thorsten-Emotional-Schema). |

## Kategorie: Hörbücher

| Tag | Werte | Erläuterung |
|---|---|---|
| `reader` | string | Anzeigename des Sprechers/der Sprecher. |
| `reader_gender` | `"m"`, `"w"`, `"mixed"` | „mixed" für Wechselsprecher (Group-Aufnahmen mit mehreren Stimmen). |
| `work_author` | string | Autor des Original-Werks. |
| `genres` | string-Array | Aus kontrolliertem Vokabular, siehe unten. Mehrfachnennung erlaubt. |
| `chapter_no` | int | Nur auf Item-Ebene. |
| `chapter_title` | string | Nur auf Item-Ebene. |
| `book_year_published` | int / `null` | Erstveröffentlichung des Originalwerks. |
| `recording_year` | int / `null` | Jahr der Aufnahme. |

### Hörbuch-Genres (kontrolliertes Vokabular)

`klassiker`, `kinder`, `lyrik`, `sachbuch`, `krimi`, `religios`,
`reise`, `humor`, `science-fiction`, `drama`, `philosophie`,
`geschichte`, `biografie`

Frei erweiterbar — neue Werte dürfen aufgenommen werden, sollen aber
in diesem Katalog eingetragen werden, sobald sie das erste Mal in
einem Manifest stehen.

## Kategorie: Musik

| Tag | Werte | Erläuterung |
|---|---|---|
| `genres` | string-Array | Kontrolliertes Vokabular, siehe unten. Mehrfachnennung erlaubt (`["pop", "rock"]`). |
| `artist` | string | Künstler/Band. |
| `album` | string | Album-Titel. |
| `track_no` | int / `null` | Track-Nummer im Album. |
| `vocal` | `"y"`, `"n"` | Enthält Gesang. |
| `instrumentation` | string-Array | Optional grob (z. B. `["piano"]`, `["orchestra"]`, `["acoustic-guitar"]`). |
| `country` | ISO 3166-1 alpha-2 / `null` | Optionaler Herkunftshinweis. |
| `year` | int / `null` | Erscheinungsjahr. |

### Musik-Genres (kontrolliertes Vokabular)

`blues`, `pop`, `rock`, `hiphop`, `electronica`, `jazz`,
`westernart`, `baroque`, `classical`, `romantic`, `modernist`,
`folk`, `world`, `religios`, `gospel`, `country`, `rap`,
`soundtrack`, `experimental`

Die Werte sind an die MUSAN-`ANNOTATIONS`-Spalten angelehnt
(`westernart`, `romantic` etc.) und werden bei Bedarf erweitert.

## Kategorie: Geräusche

| Tag | Werte | Erläuterung |
|---|---|---|
| `kind` | siehe unten | Geräuschart aus kontrolliertem Vokabular. |
| `stationary` | `"y"`, `"n"` | Zeitlich gleichmäßig (Rauschen, Cafe-Hintergrund) vs. transient (Glasbruch, Hupe). |
| `loop_safe` | `"y"`, `"n"` | Saubere Loop möglich, ohne Klick am Übergang. Wichtig für Dauerwiedergabe in Hörtests. |
| `dominant_freq_hz` | int / `null` | Bei tonalen Geräuschen (Hochsteton, 1 kHz-Pfeifen). Sonst `null`. |
| `spectrum` | `"broadband"`, `"lowpass"`, `"highpass"`, `"bandpass"`, `"tonal"` | Grobe spektrale Charakteristik. |
| `level_db` | int / `null` | Falls genormt (z. B. CCITT-Rauschen). |

### Geräusch-Arten (kontrolliertes Vokabular)

| Wert | Beispiele |
|---|---|
| `rauschen-weiss` | weißes Rauschen |
| `rauschen-rosa` | rosa Rauschen |
| `rauschen-ccitt` | CCITT-Sprachsimulationsrauschen (Freiburger CD) |
| `babble` | Stimmengewirr, mehrere Sprecher |
| `cafe` | Cafe-Hintergrund |
| `verkehr` | Auto-, Zug-, Flugzeug-Geräusch |
| `wetter` | Regen, Wind, Donner |
| `tier` | Hund, Vogel, Katze |
| `haushalt` | Geschirrklappern, Staubsauger, Türschlag |
| `industrie` | Maschinen, Werkzeug, Bauarbeiten |
| `crowd` | Menschenmenge, Stadion, Markt |
| `ambient` | unspezifischer Hintergrund |
| `test-ton` | Sinus-Ton, Tracking-Ton, technisches Prüfsignal |

## Indizes (Pointer-Manifeste)

Pointer-Manifeste tragen keine eigenen Inhalte, nur Verweise. Erlaubte
Felder:

| Feld | Erläuterung |
|---|---|
| `kind` | Pflicht: `"index"`. |
| `title` | Anzeige-Name. |
| `description` | Optional, kurzer Kontext. |
| `items[].ref` | Relativer Pfad zum Inhalts-Manifest. |
| `items[].title` | Optional, falls vom Inhalts-Manifest abweichend angezeigt werden soll (selten). |

## Quelle (`source.json`)

| Feld | Pflicht | Erläuterung |
|---|---|---|
| `schema` | ✓ | `"ci-sb-corpus/2"`. |
| `key` | ✓ | Stabile Quell-Kennung (`"thorsten-voice"`). |
| `name` | ✓ | Anzeige-Name. |
| `url` | ✓ | Kanonische Quellseite. |
| `license` | ✓ | SPDX-Identifier als Default für alle Inhalte. |
| `credit` | ✓ | Pflicht-Anzeigetext im Player. |
| `base` | ✓ | Pfad-Präfix, endet auf `/`. Lokal Ordnername, online leer. |
| `categories` | ✓ | Liste der Kategorien, die diese Quelle beisteuert. |
| `manifests` | ✓ | Map Kategorie → Liste relativer Manifest-Dateien. |
| `notes` | – | Freitext. |

## Wertekontrolle und Pflege

- Wer ein neues Genre oder eine neue `kind`-Klasse einführt: **diesen
  Katalog mit ergänzen**. Sonst entstehen Synonyme (`"rock"` vs.
  `"rocksong"`), die Filter zerschießen.
- Tag-Namen werden **nicht umbenannt**, sondern bei Bedarf in einer
  Migration ersetzt.
- Unbekannte Werte beim Laden sind nicht hart abzulehnen — die UI
  zeigt sie als ungeordnete „Sonstige" Sammelgruppe. So bricht das
  Tool nicht, wenn ein Manifest dem Katalog voraus ist.
