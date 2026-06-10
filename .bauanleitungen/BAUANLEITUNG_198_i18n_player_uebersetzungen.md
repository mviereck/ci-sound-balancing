# Bauanleitung 198 — Übersetzungen en/fr/es für BA 192–197

**Versionsbump:** `js/version.js` von `"3.2.197-beta"` (oder aktuellem
197-Fix-Stand) auf `"3.2.198-beta"`.

**Voraussetzung:** BA 192–197 sind durchgebaut.

## Ziel

Alle in BA 192–197 neu eingeführten i18n-Keys werden in den Dateien
`i18n/en.js`, `i18n/fr.js` und `i18n/es.js` ergänzt. Fehlende Keys
fallen heute auf Deutsch zurück; nach dieser BA stehen native
Übersetzungen zur Verfügung.

**Wichtig:** Die deutschen Strings (`i18n/de.js`) sind bereits in den
BAs 192–197 angelegt und werden in dieser BA **nicht angefasst**.

## Sprach-Tabelle (Referenz)

| Schlüssel | de (Vorlage) | en | fr | es |
|---|---|---|---|---|
| `plPlayTitle` | Wiedergabe | Playback | Lecture | Reproducción |
| `plSourceLabel` | Quelle: | Source: | Source : | Fuente: |
| `plSrcMusic` | ♪ Musik | ♪ Music | ♪ Musique | ♪ Música |
| `plSrcSentences` | 💬 Sätze | 💬 Sentences | 💬 Phrases | 💬 Frases |
| `plSrcNoise` | 🔊 Geräusche | 🔊 Noises | 🔊 Bruits | 🔊 Ruidos |
| `plSrcAudiobook` | 📖 Hörbücher | 📖 Audiobooks | 📖 Livres audio | 📖 Audiolibros |
| `plNoiseComingSoon` | Geräusche folgen in einer späteren Bauanleitung. | Noises will follow in a later build. | Les bruits arrivent dans une prochaine version. | Los ruidos llegarán en una versión posterior. |
| `plAudiobookComingSoon` | Hörbücher folgen in einer späteren Bauanleitung. | Audiobooks will follow in a later build. | Les livres audio arrivent dans une prochaine version. | Los audiolibros llegarán en una versión posterior. |
| `plTipPrev` | Vorheriges Stück | Previous track | Piste précédente | Pista anterior |
| `plTipPlay` | Abspielen / Pause | Play / Pause | Lire / Pause | Reproducir / Pausa |
| `plTipStop` | Stoppen | Stop | Arrêter | Detener |
| `plTipNext` | Nächstes Stück | Next track | Piste suivante | Pista siguiente |
| `plTipLoop` | Aktuelles Stück endlos wiederholen | Repeat current track endlessly | Répéter en boucle la piste actuelle | Repetir la pista actual en bucle |
| `plTipAutoAdv` | Nach Ende automatisch das nächste Stück abspielen (stoppt nach 30 min ohne Bedienung) | Automatically play the next track after end (stops after 30 min without interaction) | Lire automatiquement la piste suivante (s'arrête après 30 min sans interaction) | Reproducir automáticamente la siguiente pista (se detiene tras 30 min sin interacción) |
| `plAutoAdvLabel` | ↪ Auto-Weiter | ↪ Auto-Advance | ↪ Avancer auto | ↪ Auto-Avance |
| `plPauseLabel` | Pause zwischen Stücken: | Pause between tracks: | Pause entre les pistes : | Pausa entre pistas: |
| `plDispEmpty` | Nichts geladen | Nothing loaded | Rien chargé | Nada cargado |
| `plDispNoMeta` | — | — | — | — |
| `plNoiseSortLabel` | Sortierung: | Sort by: | Tri : | Ordenar: |
| `plNoiseItemLabel` | Geräusch: | Noise: | Bruit : | Ruido: |
| `plNoiseEmpty` | Keine Geräusche verfügbar. | No noises available. | Aucun bruit disponible. | Sin ruidos disponibles. |
| `amSortKind` | nach Art | by kind | par type | por tipo |
| `amSortSpectrum` | nach Spektrum | by spectrum | par spectre | por espectro |
| `amSortSource` | nach Quelle | by source | par source | por fuente |
| `plSentBgTitle` | Hintergrund-Geräusch | Background noise | Bruit de fond | Ruido de fondo |
| `plSentBgOff` | Aus | Off | Inactif | Apagado |
| `plSentBgOn` | An | On | Actif | Encendido |
| `plSentBgSelLabel` | Geräusch: | Noise: | Bruit : | Ruido: |
| `plSentBgSnrLabel` | Sprach-Pegel über Geräusch (SNR): | Speech level over noise (SNR): | Niveau de parole sur le bruit (SNR) : | Nivel de voz sobre el ruido (SNR): |
| `plBookUpload` | + Hörbuch-Ordner laden | + Load audiobook folder | + Charger un dossier de livre audio | + Cargar carpeta de audiolibro |
| `plBookUploadHint` | Ordner mit nummerierten Kapitel-Dateien wählen (z. B. 01_*.mp3). | Choose a folder with numbered chapter files (e.g. 01_*.mp3). | Choisir un dossier avec des fichiers de chapitres numérotés (p. ex. 01_*.mp3). | Elige una carpeta con archivos de capítulos numerados (p. ej. 01_*.mp3). |
| `plBookSortLabel` | Sortierung: | Sort by: | Tri : | Ordenar: |
| `plBookSelLabel` | Hörbuch: | Audiobook: | Livre audio : | Audiolibro: |
| `plBookChapterLabel` | Kapitel: | Chapter: | Chapitre : | Capítulo: |
| `plBookRemove` | × | × | × | × |
| `plBookEmpty` | Noch kein Hörbuch geladen. Klicke „+ Hörbuch-Ordner laden", um eines zu öffnen. | No audiobook loaded yet. Click "+ Load audiobook folder" to open one. | Aucun livre audio chargé. Cliquez sur « + Charger un dossier de livre audio » pour en ouvrir un. | Aún no hay audiolibro cargado. Haz clic en "+ Cargar carpeta de audiolibro" para abrir uno. |
| `plBookUploadNoAudio` | Keine Audiodateien im Ordner gefunden. | No audio files found in the folder. | Aucun fichier audio trouvé dans le dossier. | No se encontraron archivos de audio en la carpeta. |
| `plBookRemoveConfirm` | Diese Hörbuch-Auswahl entfernen? Die Originaldateien auf der Festplatte bleiben unberührt. | Remove this audiobook entry? Original files on disk remain untouched. | Supprimer cette sélection de livre audio ? Les fichiers d'origine sur le disque restent intacts. | ¿Eliminar esta selección de audiolibro? Los archivos originales en el disco permanecen intactos. |
| `amBookSortAuthor` | nach Autor | by author | par auteur | por autor |
| `amBookSortGenre` | nach Genre | by genre | par genre | por género |
| `amBookSortLang` | nach Sprache | by language | par langue | por idioma |
| `amBookSortReader` | nach Sprecher | by reader | par lecteur | por locutor |
| `amBookSortTitle` | nach Titel | by title | par titre | por título |
| `amSortLang` | nach Sprache | by language | par langue | por idioma |
| `amSortSpeaker` | nach Sprecher | by speaker | par locuteur | por locutor |
| `amSortStyle` | nach Stil | by style | par style | por estilo |

## Schritt 1: `i18n/en.js` ergänzen

Im englischen Block (gleiche Struktur wie `de.js`) folgenden Block
einfügen — passende Stelle: nach den bestehenden Player-Keys, vor
dem Block-Ende:

```js
plPlayTitle: "Playback",
plSourceLabel: "Source:",
plSrcMusic: "♪ Music",
plSrcSentences: "💬 Sentences",
plSrcNoise: "🔊 Noises",
plSrcAudiobook: "📖 Audiobooks",
plNoiseComingSoon: "Noises will follow in a later build.",
plAudiobookComingSoon: "Audiobooks will follow in a later build.",
plTipPrev: "Previous track",
plTipPlay: "Play / Pause",
plTipStop: "Stop",
plTipNext: "Next track",
plTipLoop: "Repeat current track endlessly",
plTipAutoAdv: "Automatically play the next track after end (stops after 30 min without interaction)",
plAutoAdvLabel: "↪ Auto-Advance",
plPauseLabel: "Pause between tracks:",
plDispEmpty: "Nothing loaded",
plDispNoMeta: "—",
plNoiseSortLabel: "Sort by:",
plNoiseItemLabel: "Noise:",
plNoiseEmpty: "No noises available.",
amSortKind: "by kind",
amSortSpectrum: "by spectrum",
amSortSource: "by source",
plSentBgTitle: "Background noise",
plSentBgOff: "Off",
plSentBgOn: "On",
plSentBgSelLabel: "Noise:",
plSentBgSnrLabel: "Speech level over noise (SNR):",
plBookUpload: "+ Load audiobook folder",
plBookUploadHint: "Choose a folder with numbered chapter files (e.g. 01_*.mp3).",
plBookSortLabel: "Sort by:",
plBookSelLabel: "Audiobook:",
plBookChapterLabel: "Chapter:",
plBookRemove: "×",
plBookEmpty: "No audiobook loaded yet. Click \"+ Load audiobook folder\" to open one.",
plBookUploadNoAudio: "No audio files found in the folder.",
plBookRemoveConfirm: "Remove this audiobook entry? Original files on disk remain untouched.",
amBookSortAuthor: "by author",
amBookSortGenre: "by genre",
amBookSortLang: "by language",
amBookSortReader: "by reader",
amBookSortTitle: "by title",
amSortLang: "by language",
amSortSpeaker: "by speaker",
amSortStyle: "by style",
```

**Hinweis zu Emojis und Sonderzeichen:** die Emojis und Sonderzeichen
(`♪`, `💬`, `🔊`, `📖`, `↪`, `×`, `—`) sind oben absichtlich als
`\u`-Escape-Sequenzen geschrieben. Das ist robust gegen Encoding-
Stolperer in manchen Editoren. Wenn die `de.js`-Datei die Zeichen
direkt in UTF-8 enthält (was bei diesem Projekt üblich ist), darf
auch in `en.js`/`fr.js`/`es.js` direkt UTF-8 verwendet werden. Die
einheitliche Wahl bleibt Sonnet überlassen — wichtig ist nur, daß die
Strings parsbar bleiben (keine ASCII-`"` innerhalb von ASCII-`"`-
Stringbegrenzern; siehe Leitlinien zu Anführungszeichen).

## Schritt 2: `i18n/fr.js` ergänzen

```js
plPlayTitle: "Lecture",
plSourceLabel: "Source :",
plSrcMusic: "♪ Musique",
plSrcSentences: "💬 Phrases",
plSrcNoise: "🔊 Bruits",
plSrcAudiobook: "📖 Livres audio",
plNoiseComingSoon: "Les bruits arrivent dans une prochaine version.",
plAudiobookComingSoon: "Les livres audio arrivent dans une prochaine version.",
plTipPrev: "Piste précédente",
plTipPlay: "Lire / Pause",
plTipStop: "Arrêter",
plTipNext: "Piste suivante",
plTipLoop: "Répéter en boucle la piste actuelle",
plTipAutoAdv: "Lire automatiquement la piste suivante (s'arrête après 30 min sans interaction)",
plAutoAdvLabel: "↪ Avancer auto",
plPauseLabel: "Pause entre les pistes :",
plDispEmpty: "Rien chargé",
plDispNoMeta: "—",
plNoiseSortLabel: "Tri :",
plNoiseItemLabel: "Bruit :",
plNoiseEmpty: "Aucun bruit disponible.",
amSortKind: "par type",
amSortSpectrum: "par spectre",
amSortSource: "par source",
plSentBgTitle: "Bruit de fond",
plSentBgOff: "Inactif",
plSentBgOn: "Actif",
plSentBgSelLabel: "Bruit :",
plSentBgSnrLabel: "Niveau de parole sur le bruit (SNR) :",
plBookUpload: "+ Charger un dossier de livre audio",
plBookUploadHint: "Choisir un dossier avec des fichiers de chapitres numérotés (p. ex. 01_*.mp3).",
plBookSortLabel: "Tri :",
plBookSelLabel: "Livre audio :",
plBookChapterLabel: "Chapitre :",
plBookRemove: "×",
plBookEmpty: "Aucun livre audio chargé. Cliquez sur « + Charger un dossier de livre audio » pour en ouvrir un.",
plBookUploadNoAudio: "Aucun fichier audio trouvé dans le dossier.",
plBookRemoveConfirm: "Supprimer cette sélection de livre audio ? Les fichiers d'origine sur le disque restent intacts.",
amBookSortAuthor: "par auteur",
amBookSortGenre: "par genre",
amBookSortLang: "par langue",
amBookSortReader: "par lecteur",
amBookSortTitle: "par titre",
amSortLang: "par langue",
amSortSpeaker: "par locuteur",
amSortStyle: "par style",
```

## Schritt 3: `i18n/es.js` ergänzen

```js
plPlayTitle: "Reproducción",
plSourceLabel: "Fuente:",
plSrcMusic: "♪ Música",
plSrcSentences: "💬 Frases",
plSrcNoise: "🔊 Ruidos",
plSrcAudiobook: "📖 Audiolibros",
plNoiseComingSoon: "Los ruidos llegarán en una versión posterior.",
plAudiobookComingSoon: "Los audiolibros llegarán en una versión posterior.",
plTipPrev: "Pista anterior",
plTipPlay: "Reproducir / Pausa",
plTipStop: "Detener",
plTipNext: "Pista siguiente",
plTipLoop: "Repetir la pista actual en bucle",
plTipAutoAdv: "Reproducir automáticamente la siguiente pista (se detiene tras 30 min sin interacción)",
plAutoAdvLabel: "↪ Auto-Avance",
plPauseLabel: "Pausa entre pistas:",
plDispEmpty: "Nada cargado",
plDispNoMeta: "—",
plNoiseSortLabel: "Ordenar:",
plNoiseItemLabel: "Ruido:",
plNoiseEmpty: "Sin ruidos disponibles.",
amSortKind: "por tipo",
amSortSpectrum: "por espectro",
amSortSource: "por fuente",
plSentBgTitle: "Ruido de fondo",
plSentBgOff: "Apagado",
plSentBgOn: "Encendido",
plSentBgSelLabel: "Ruido:",
plSentBgSnrLabel: "Nivel de voz sobre el ruido (SNR):",
plBookUpload: "+ Cargar carpeta de audiolibro",
plBookUploadHint: "Elige una carpeta con archivos de capítulos numerados (p. ej. 01_*.mp3).",
plBookSortLabel: "Ordenar:",
plBookSelLabel: "Audiolibro:",
plBookChapterLabel: "Capítulo:",
plBookRemove: "×",
plBookEmpty: "Aún no hay audiolibro cargado. Haz clic en \"+ Cargar carpeta de audiolibro\" para abrir uno.",
plBookUploadNoAudio: "No se encontraron archivos de audio en la carpeta.",
plBookRemoveConfirm: "¿Eliminar esta selección de audiolibro? Los archivos originales en el disco permanecen intactos.",
amBookSortAuthor: "por autor",
amBookSortGenre: "por género",
amBookSortLang: "por idioma",
amBookSortReader: "por locutor",
amBookSortTitle: "por título",
amSortLang: "por idioma",
amSortSpeaker: "por locutor",
amSortStyle: "por estilo",
```

## Schritt 4: Versionsbump

```js
const APP_VERSION = "3.2.198-beta";
```

## Akzeptanztest

1. Tool laden. Version `3.2.198-beta`. **Erwartet:** ✓
2. Sprache im Footer auf **Englisch** umstellen.
   - Player-Tab: Quellen-Buttons heißen „Music / Sentences / Noises /
     Audiobooks". Tooltips der Transport-Knöpfe sind englisch.
     Sortier-Dropdowns („Sort by:"), Pause-Label
     („Pause between tracks:"), SNR-Label
     („Speech level over noise (SNR):") sind englisch. **Erwartet:** ✓
3. Sprache auf **Französisch**: dieselben Stellen erscheinen französisch
   („Musique / Phrases / Bruits / Livres audio", „Tri :", „Pause entre
   les pistes :", „Niveau de parole sur le bruit (SNR) :"). Akzente
   und Sonderzeichen werden korrekt dargestellt. **Erwartet:** ✓
4. Sprache auf **Spanisch**: dieselben Stellen erscheinen spanisch
   („Música / Frases / Ruidos / Audiolibros", „Ordenar:", „Pausa entre
   pistas:", „Nivel de voz sobre el ruido (SNR):"). Spanische Akzente
   und das umgekehrte Fragezeichen (¿) korrekt. **Erwartet:** ✓
5. Sprache zurück auf **Deutsch**: alle Texte wie vor BA 198 (deutsche
   Vorlage). **Erwartet:** ✓
6. Konsole zeigt keine i18n-Warnungen mehr für Player-Keys
   (z. B. „missing translation for plPlayTitle"). **Erwartet:** ✓

## Selbstprüfungsauftrag

Jeden der 6 Akzeptanzpunkte einzeln durchgehen. Zusätzlich:

- In jeder der drei Sprachdateien sind **alle** Keys aus der Tabelle
  oben vorhanden. Stichprobe per `grep -c "plPlayTitle\|plSrcMusic\|
  plBookUpload\|plSentBgTitle" i18n/en.js` etc. — jede Sprache muss
  mindestens 4 Treffer liefern.
- Keine doppelten Keys innerhalb einer Sprachdatei (Sonnet prüft per
  Auge oder durch JS-Parse-Test).
- Anführungszeichen-Konsistenz: in englischen/französischen/spanischen
  Strings, die ein ASCII-`"` enthalten, ist es entweder escaped
  (`\"`) oder durch typografische Anführungszeichen
  (`« »` im Französischen, `“ ”` o.ä.) ersetzt — kein
  unkomponiertes ASCII-`"` innerhalb eines ASCII-`"`-Stringbegrenzers.
- `js/version.js` enthält `"3.2.198-beta"`.

## Folge-Bauanleitungen

Mit dieser BA ist die Player-Umstrukturierung aus BA 192–197 inklusive
Übersetzungen abgeschlossen. Anstehende Themen aus IDEEN.md und
früheren Folge-Hinweisen (ohne festen BA-Slot):

- Pointer-Manifeste (`kind: "index"`) für Webspace-Bibliotheks-Browsing.
- Streaming-Wiedergabe für lange Hörbuch-Kapitel statt Voll-Buffer.
- m4b-Chapter-Tag-Parsing (mp4box.js o.ä.).
- Sortier-Dropdown für Sätze + Sprach-Filter im Sätze-Sub-Block.
- Dynamic-Cocktail-Generator (siehe `docs/IDEEN.md`).
- Build-Skript `scripts/build_embed.py`: Umstellung der Embed-Module
  auf das neue Manifest-Schema, danach `sentences-legacy`-Provider
  obsolet.
