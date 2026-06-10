# BA 263 — Webspace-text durchreichen + URL-Encoding der Audio-Pfade

> Diese BA ersetzt das zurückgezogene „MLS-Hörbuch-Mapping" (siehe
> `.bauanleitungen/archiv/BAUANLEITUNG_263_mls_hoerbuch_mapping_ZURUECKGEZOGEN.md`).
> MLS-Material besteht nur aus Snippets und ergibt kein durchgängiges
> Hörbuch. Webspace-Hörbücher folgen später über eigene Manifeste
> (LibriVox/archive.org).

## Hintergrund

Zwei kleine, voneinander unabhängige Befunde aus der Sätze-Sichtung:

**1. Text-Anzeige bleibt leer** (alle Webspace-Sprecher).
`sCurRec` aus der Browser-Konsole zeigt, daß das `text`-Feld in den
Webspace-Items **gar nicht existiert** — der Webspace-Provider
(`js/audio-source.js:626–637`) mappt es schlicht nicht. Das
zugrundeliegende Manifest **hat** den Text, z. B. Thorsten-Voice:

```
"items": [
  { "id": "a939f2ca", "text": "runter",
    "audio": "wavs/a939f2ca060905f79b40a8328d119b40.opus", "duration": 0.55 },
  ...
]
```

Common Voice zeigt Text nur deshalb, weil ein kleiner Embed-Pool in
`assets/sentences/sentences.json` über den Legacy-Provider
(sentences.js:1004) läuft — dort wird `text` korrekt durchgereicht.

**2. Pfad mit Leerzeichen scheitert.**
Beispiel-URL aus der Konsole:
`http://ci-sound-balancing.honigburg.de/opus/Thorsten Voice/wavs/dbd…opus`

Direkter Curl-Test:
- Mit unencodiertem Leerzeichen → HTTP 000 (connect-fail).
- URL-encoded (`%20`) → HTTP 200 (Datei ist da).
- Ohne Leerzeichen → 404 (Verzeichnis heißt wirklich „Thorsten Voice").

`_amResolveAudioUrl` (audio-source.js:583–589) klebt heute Root, Base
und Audio-Pfad einfach zusammen. Browser können Leerzeichen implizit
encoden, machen es aber nicht immer zuverlässig — abhängig von
fetch-Mode, Cache-Pfad und Server-Toleranz.

Beide Fixes wirken sofort auf alle Quellen mit Webspace-Material
(Sätze, Geräusche, später Musik, später Hörbücher).

Reine Deutsch-BA — keine i18n-Texte.

## Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.263-beta";
```

## Schritt 1 — `text`-Property im Webspace-Provider durchreichen (`js/audio-source.js`)

Im `webspace`-Provider, listItems-Funktion (Z. 626–637), das
push-Objekt um eine Zeile erweitern.

**Vorher:**

```js
for (const it of (col.items || [])) {
  out.push({
    id: srcKey + ":" + (col.title || "") + "/" + (it.id || ""),
    title: it.title || it.id || "(unbenannt)",
    audio: _amResolveAudioUrl(it.audio, entry.source.base),
    duration: it.duration,
    sourceTitle: entry.meta.name || entry.source.name || srcKey,
    license: it.license || entry.source.license || entry.meta.license,
    credit:  it.credit  || entry.source.credit,
    tags: _amBuildItemTags(it, col, entry.source)
  });
}
```

**Nachher:**

```js
for (const it of (col.items || [])) {
  out.push({
    id: srcKey + ":" + (col.title || "") + "/" + (it.id || ""),
    title: it.title || it.id || "(unbenannt)",
    text: it.text || "",       // BA263: Saetze-Text durchreichen
    audio: _amResolveAudioUrl(it.audio, entry.source.base),
    duration: it.duration,
    sourceTitle: entry.meta.name || entry.source.name || srcKey,
    license: it.license || entry.source.license || entry.meta.license,
    credit:  it.credit  || entry.source.credit,
    tags: _amBuildItemTags(it, col, entry.source)
  });
}
```

## Schritt 2 — URL-Encoding in `_amResolveAudioUrl` (`js/audio-source.js`)

Funktion `_amResolveAudioUrl` (Z. 583–589) anpassen.

**Vorher:**

```js
function _amResolveAudioUrl(rawAudio, sourceBase) {
  if (!rawAudio) return null;
  if (/^(data:|https?:|blob:)/i.test(rawAudio)) return rawAudio;
  const root = amWebspaceRoot();
  const base = sourceBase || "";
  return root + base + rawAudio;
}
```

**Nachher:**

```js
function _amResolveAudioUrl(rawAudio, sourceBase) {
  if (!rawAudio) return null;
  if (/^(data:|https?:|blob:)/i.test(rawAudio)) return rawAudio;
  const root = amWebspaceRoot();
  const base = sourceBase || "";
  // BA263: URL-Komponenten encoden, damit Pfade mit Leerzeichen
  // ("Thorsten Voice/wavs/...") und sonstigen Sonderzeichen vom Browser
  // sicher angesprochen werden. encodeURI bewahrt Strukturzeichen
  // (`:`, `/`, `?`, `#`) und encodet nur unsichere Zeichen wie ` `.
  return encodeURI(root + base + rawAudio);
}
```

## Schritt 3 — Spec-Update (`docs/spec/06-player.md`)

Im Webspace-Manifest-Loader-Block (etwa Z. 65–78) zwei Sätze
ergänzen — als Hinweis, daß künftige Manifest-Pflege Leerzeichen
nicht meiden muß:

```
- Audio-URLs werden in `_amResolveAudioUrl` per `encodeURI` URL-sicher
  zusammengebaut. Pfade mit Leerzeichen oder Sonderzeichen funktionieren
  damit zuverlässig, auch wenn das Manifest sie nicht selbst encoded.
- Webspace-Items reichen die `text`-Property aus dem Manifest direkt an
  den Player durch — sichtbar in der Sätze-„Text anzeigen"-Box.
```

## Akzeptanztest

1. Hard-Reload, Reiter „Player", Quelle „Sätze".
2. Sprecher „Thorsten" (oder ein anderer Webspace-Sprecher) wählen.
3. „Text anzeigen"-Checkbox aktivieren, Play drücken. → Erwartet:
   **Satz-Text erscheint** in der Text-Box (z. B. „runter", „Hallo",
   „Wir sind jetzt bei fünfunddreißig").
4. Sprecher „Common Voice" wählen, einen Satz spielen. → Erwartet:
   Text erscheint **auch bei den vielen Webspace-CV-Items** (nicht
   mehr nur bei den paar Embed-Einträgen).
5. Browser-Konsole: `console.log(sCurRec.text)` ausführen → Wert ist
   ein nicht-leerer String, kein `undefined`.
6. Browser-Konsole: `console.log(sCurRec.audio)` → URL enthält
   `%20` (oder einen passenden Encode) statt eines rohen Leerzeichens,
   z. B. `.../Thorsten%20Voice/wavs/...`.
7. Im Network-Tab beim Play: die `.opus`-Anfrage liefert HTTP **200**
   (nicht 404 oder net::ERR_*).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung prüfen:

- Punkt 3 (Text bei Webspace-Sprechern) → `js/audio-source.js` Z. der
  neuen `text:`-Zeile zitieren.
- Punkt 6 (URL-Encoding) → `js/audio-source.js` Z. des
  `encodeURI(...)`-Aufrufs zitieren.
- Bestätigen, daß die Änderung **keine** bereits encoded URLs doppelt
  encoded: für vollständige URLs (`https?:|data:|blob:`) greift der
  Early-Return weiter oben, dort passiert kein Encoding. Nur die
  zusammengeklebte Form (`root + base + rawAudio`) läuft durch
  `encodeURI`, und diese Form ist per Konstruktion **noch nicht**
  encoded, weil sie aus relativen Manifest-Pfaden besteht.

Bei Auffälligkeiten lieber rückfragen statt raten.
