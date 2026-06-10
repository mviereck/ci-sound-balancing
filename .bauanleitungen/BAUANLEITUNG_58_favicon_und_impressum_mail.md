# Bauanleitung 58 — Favicon-Umzug und Impressum-E-Mail aktualisieren

## Worum es geht

Zwei kleine, voneinander unabhängige Aufräumarbeiten:

1. `favicon.png` liegt im Wurzelverzeichnis, alle anderen Bilder
   liegen schon unter `assets/images/`. Das soll konsistent werden:
   `favicon.png` zieht nach `assets/images/`, die beiden Verweise in
   `index.html` werden angepaßt.
2. Die Kontakt-E-Mail im Impressum (`js/legal.js`) wird auf die neue
   Adresse `mviereck@ci-sound-balancing.org` umgestellt.

Beide Punkte sind Voraussetzung für die folgenden Bauanleitungen
(BA 59 und 60) zum Unterstützung-Tab — der neue Tab nutzt dieselbe
Adresse und dieselbe Bild-Ablage.

## Stelle 1 — Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "2.58-beta";
```

Vorher: `"2.57-beta"`.

## Stelle 2 — favicon.png nach assets/images/ verschieben

Mit `git mv`, damit die History erhalten bleibt:

```bash
git mv favicon.png assets/images/favicon.png
```

Anschließend prüfen:

```bash
ls favicon.png                  # → kein Treffer (nicht mehr im Root)
ls assets/images/favicon.png    # → vorhanden
```

## Stelle 3 — Verweise in index.html anpassen

In `index.html` gibt es zwei Stellen, die auf das Wurzel-`favicon.png`
zeigen — beide auf den neuen Pfad umstellen.

**Stelle 3a — Z. 7 (Favicon-Link im `<head>`):**

Vorher:
```html
    <link rel="icon" type="image/png" href="favicon.png">
```

Nachher:
```html
    <link rel="icon" type="image/png" href="assets/images/favicon.png">
```

**Stelle 3b — Z. 48 (Brand-Logo im `<body>`):**

Vorher:
```html
        <img class="brand-logo" src="favicon.png" width="150" height="150" alt="">
```

Nachher:
```html
        <img class="brand-logo" src="assets/images/favicon.png" width="150" height="150" alt="">
```

Suche nach weiteren Vorkommen — es dürfen keine übrigbleiben:

```bash
grep -rn 'favicon\.png' --include="*.html" --include="*.js" --include="*.css" .
```

Erwartet: nur die zwei angepaßten Stellen in `index.html`, beide mit
`assets/images/`-Prefix.

## Stelle 4 — Impressum-E-Mail in js/legal.js aktualisieren

In `js/legal.js` Z. 44–56 wird die E-Mail zur Laufzeit aus zwei
Fragmenten zusammengebaut (Bot-Schutz). Die beiden Konstanten
ersetzen:

Vorher (Z. 48–49):
```js
  var user = "bachbaum24";
  var domain = "gmx.de";
```

Nachher:
```js
  var user = "mviereck";
  var domain = "ci-sound-balancing.org";
```

Der Rest der Funktion `_legalAssembleEmail()` bleibt unverändert —
sie setzt automatisch `user + "@" + domain` zusammen.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Favicon lädt vom neuen Pfad

1. `index.html` im Browser öffnen (Hard-Reload mit Cache-Leerung,
   Ctrl+Shift+R, sonst hängt der alte Favicon-Cache).
2. Im Browser-Tab erscheint das CI-Sound-Balancing-Favicon.
3. Network-Tab: `favicon.png` wird von `assets/images/favicon.png`
   geladen (Status 200), nicht vom Root.
4. Auf der Seite oben links erscheint das große Logo (`brand-logo`)
   wie vorher, in 150×150 px.

### Test B — Impressum zeigt neue E-Mail

1. Im Footer auf „Impressum" klicken.
2. Im Dialog steht unter „Kontakt" die E-Mail-Adresse
   `mviereck@ci-sound-balancing.org` als klickbarer `mailto:`-Link.
3. Im HTML-Quelltext (Seitenquellcode ansehen, **vor** dem
   Dialog-Öffnen) darf die E-Mail **nicht** als Klartext stehen —
   sie wird erst beim Öffnen des Dialogs zusammengebaut.

### Test C — Keine 404 in der Konsole

Browser-Konsole öffnen, Seite neu laden — keine `404`-Meldung für
`favicon.png` oder andere Ressourcen.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–C einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe.

Insbesondere prüfen:

- Wurde `favicon.png` per `git mv` verschoben, nicht über reines
  `mv`? Prüfen mit `git log --follow assets/images/favicon.png |
  head -5` — sollte ältere Commits zeigen, in denen die Datei
  noch im Root lag.
- Gibt es im Projekt noch andere Verweise auf das Wurzel-
  `favicon.png` (z. B. in README-Dateien, CSS, oder Manifesten),
  die übersehen wurden? Suche siehe Stelle 3.
- Stehen in `js/legal.js` Z. 48–49 wirklich `mviereck` und
  `ci-sound-balancing.org`, ohne Tippfehler im Domain-Namen?
- Liegt sonst nichts an `js/legal.js` schief — die Imprint-Funktion
  (`_legalOpenImprint`, `_legalAssembleEmail`) muß strukturell
  unverändert sein.

Bei Unklarheit Rückfrage statt Annahme.

## Nach Abschluß manuell prüfen

- Favicon erscheint im Browser-Tab.
- Großes Logo erscheint auf der Seite.
- Impressum-Dialog zeigt die neue E-Mail.
- Tool startet sonst unverändert (alle Tabs, Sprachwechsel, etc.).
