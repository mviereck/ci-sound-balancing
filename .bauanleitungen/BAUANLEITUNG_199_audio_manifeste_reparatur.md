# Bauanleitung 199 — Loader-Patch: Tag-Vererbung für Webspace-Items

**Versionsbump:** `js/version.js` von `"3.2.197-beta"` (oder aktuellem
197/198-Fix-Stand) auf `"3.2.199-beta"`.

**Voraussetzung:** keine. Diese BA ist die erste von vier zur
Manifest-Reparatur (BA 199 = Loader, BA 200 = Build-Pipeline,
BA 201 = ARU-Rename, BA 202 = MUSAN-Klassifikation). Sie ist
unabhängig und sofort testbar.

---

## Ziel

Der Webspace-Loader (`js/audio-source.js`) merged heute beim Aufbau
der Item-Tags nur das innere `col.tags`-Objekt der Collection auf
das Item. Die Collection-Top-Level-Felder `lang`, `license`,
`credit`, `url` werden **nicht** als Tag-Defaults vererbt. Folge:
jedes Webspace-Item hat `tags.lang === undefined`, der Sprachen-
Sortierer fällt auf `"zzz-unbekannt"` zurück, und Sätze vom Webspace
erscheinen in der UI gar nicht nach Sprache sortiert. Auch
`tags.license` und `tags.credit` fehlen den Items.

Diese BA führt eine Vererbungs-Reihenfolge ein und hält sie
gleichzeitig in `docs/Konzept_Audio_Manifest.md` und
`docs/Audio_Tag_Katalog.md` als Spec-Aussage fest.

## Vererbungs-Reihenfolge (Soll-Zustand)

Pro Item:

1. **Source-Top-Level** (`license`, `credit`) — Default ganz unten.
2. **Collection-Top-Level** (`lang`, `license`, `credit`, `url`) —
   überschreibt Source-Default.
3. **Collection-`tags`** (z.B. `speaker_id`, `gender`, `style`).
4. **Item-`tags`** (gewinnt immer, falls gesetzt).

`lang` lebt also weiterhin als Top-Level-Feld der Collection (kein
Umzug in `tags`), wird aber vom Loader zur Laufzeit als Tag-Default
auf jedes Item gestempelt.

---

## Schritt 1 — Hilfsfunktion und Provider-Patch

In `js/audio-source.js`, direkt **nach** der bestehenden Funktion
`_amResolveAudioUrl(...)` (etwa Z. 589) und **vor**
`amRegisterProvider({ id: "webspace", ... })` (etwa Z. 593) folgenden
Block einfügen:

```js
// Collection-Top-Level-Felder, die als Tag-Defaults auf jedes Item
// vererbt werden. Aufloesungs-Reihenfolge: it.tags > col.tags >
// col-Top-Level > source-Top-Level.
const _AM_COLLECTION_TAG_DEFAULTS = ["lang", "license", "credit", "url"];
const _AM_SOURCE_TAG_DEFAULTS     = ["license", "credit"];

function _amBuildItemTags(item, col, source) {
  const tags = {};
  if (source) {
    for (const k of _AM_SOURCE_TAG_DEFAULTS) {
      if (source[k] != null) tags[k] = source[k];
    }
  }
  if (col) {
    for (const k of _AM_COLLECTION_TAG_DEFAULTS) {
      if (col[k] != null) tags[k] = col[k];
    }
  }
  if (col && col.tags) Object.assign(tags, col.tags);
  if (item && item.tags) Object.assign(tags, item.tags);
  return tags;
}
```

Im **webspace-Provider** (`amRegisterProvider({ id: "webspace", ... })`,
listItems-Schleife, ca. Z. 603-614) die Zeile

```js
const colTags = col.tags || {};
```

entfernen, und die Zeile

```js
tags: Object.assign({}, colTags, it.tags || {})
```

ersetzen durch

```js
tags: _amBuildItemTags(it, col, entry.source)
```

Im **listCollections-Block** desselben Providers (Hörbücher, ca.
Z. 620-650), beim Mappen der Kapitel-Items, die Zeile

```js
tags: it.tags || {}
```

ersetzen durch

```js
tags: _amBuildItemTags(it, col, entry.source)
```

Damit erben Kapitel-Items die `lang`/`license`/`credit`/`url`
ihres Buchs.

---

## Schritt 2 — Konzept-Doku angleichen

In `docs/Konzept_Audio_Manifest.md` im Abschnitt "Vorsortierung und
Tags — beide Ebenen", **direkt nach** dem Satz

> "Zusätzlich trägt **jedes Item einen Tag-Beutel**, der mehrachsige
> Filterung ohne Datenumzug erlaubt."

folgenden neuen Absatz einfügen:

```markdown
**Vererbung**: Der Loader stellt jedem Item ein zusammengefügtes
`tags`-Objekt zur Verfügung. Reihenfolge der Auflösung (von unten
nach oben, oben gewinnt):

1. Source-Top-Level (`license`, `credit`).
2. Collection-Top-Level (`lang`, `license`, `credit`, `url`).
3. Collection-`tags` (z.B. `speaker_id`, `gender`).
4. Item-`tags` (überschreibt alles, falls gesetzt).

`lang`, `license`, `credit`, `url` werden also explizit als
Top-Level-Felder der Collection geschrieben — sie tauchen nicht
in `tags`. Der Loader vererbt sie automatisch als Tag-Defaults
auf jedes Item. Andere Tags (`speaker_id`, `genres`, `kind`, …)
stehen in `tags` auf Collection- oder Item-Ebene.
```

In `docs/Audio_Tag_Katalog.md`, **direkt unter** der Tabelle
"## Tags für alle Kategorien", folgenden Hinweis-Absatz ergänzen:

```markdown
> Hinweis: `lang` wird als Top-Level-Feld der Collection geführt,
> nicht innerhalb des `tags`-Objekts. Der Loader vererbt es trotzdem
> auf jedes Item als Tag-Default (siehe Vererbungs-Reihenfolge in
> `docs/Konzept_Audio_Manifest.md`). Dasselbe gilt für `license`,
> `credit` und `url`.
```

---

## Schritt 3 — Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.2.199-beta";
```

---

## Akzeptanztest

1. Tool laden, F12 / Konsole offen.
2. In der Konsole nach 2 s sollte stehen:
   `[audio-source/webspace] Index geladen: N Quellen.` (N ≥ 8).
3. In der Konsole eingeben:
   ```js
   amCollectItems("saetze").slice(0, 5).map(it => ({
     id: it.id,
     lang: it.tags && it.tags.lang,
     license: it.tags && it.tags.license,
     credit: it.tags && it.tags.credit
   }))
   ```
   Erwartet: alle 5 Items haben **definierte** Werte für `lang`,
   `license`, `credit`. Kein `undefined`.
4. Im Player-Tab "Sätze" die Sortier-Achse "nach Sprache" wählen.
   Erwartet: Sätze gruppieren nach Sprache (de/en/fr/…). Keine
   Gruppe heißt mehr "zzz-unbekannt" (falls doch: dann liegt es an
   einer Quelle, deren Collection-Manifest `lang` selbst nicht
   gesetzt hat — bitte den Manifest-Pfad nennen, das wird in BA 200
   adressiert).
5. Im Sub-Tab "Geräusche" Sortier-Achse "nach Quelle". Erwartet:
   Quellen-Namen erscheinen statt "zzz-unbekannt" (`credit` wird
   nun vererbt).

## Selbstprüfungs-Auftrag an Sonnet

Bevor du "fertig" meldest, für jeden Akzeptanzpunkt 1-5 melden:
erfüllt / nicht erfüllt / unklar, mit Datei- und Zeilenangabe der
relevanten Änderung. Punkte 4 und 5 lassen sich nur am laufenden
Browser endgültig prüfen — dann reicht "Code-Seite erfüllt, Browser-
Test offen, Hinweis an Nutzer".

## Hinweise

- ASCII-Quotes in allen Snippets.
- Keine i18n-Strings in dieser BA.
- Diese BA berührt keine Python-Skripte und keine Manifest-Dateien.
- Nachfolge-BAs: BA 200 (build_manifests.py grundsanieren), BA 201
  (ARU-Rename), BA 202 (MUSAN-Auto-Klassifikation).
