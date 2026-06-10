# Bauanleitung 49 — i18n-Textänderungen: Intro, Vorbedingungs-Hinweise, Wortkorrektur

## Worum es geht

Drei Textänderungen in den i18n-Daten und an zwei UI-Stellen:

- **Punkt 7 — Intro:** Schritt „3. Messung" im Intro-Block bekommt einen
  Zusatz und eine Wichtig-Zeile.
- **Punkt 13 — Vorbedingungs-Hinweis:** Neue Hinweistexte
  (`latPrereqHint`, `fmPrereqHint`) für die Sub-Tabs Latenz und
  Frequenzabgleich, identisch im Wortlaut: „Führen Sie zuerst die
  Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten
  aus." Plus jeweilige UI-Einbindung.
- **Punkt 14 — Wortkorrektur:** Im bestehenden `lrPrereqHint` (Sub-Tab
  Stereo-Balance) „den Test" durch „die Messung" ersetzen; analog in
  EN/FR/ES, damit der Sprachgebrauch („Messung" / „measurement" /
  „mesure" / „medición") konsistent bleibt.

Alle vier i18n-Sprachdateien (`i18n/de.js`, `i18n/en.js`, `i18n/fr.js`,
`i18n/es.js`) müssen synchron angepaßt werden — sonst zeigen einige
Sprachen alten Text oder gar leeren Key.

## Stelle 1 — `i18n/de.js`: `introFlowDesc` komplett neu (Punkt 7)

Die Liste wird strukturell umgebaut: die bisher eigenständige
„Wichtig"-Zeile wird in Punkt 2 eingebettet, dafür kommt ein neuer
Punkt 3 zur Wiedergabe-Lautstärke hinzu, und Punkt 4 (Messung) bekommt
einen geänderten Wortlaut mit Pfad-Notation. Renumerierung lückenlos.

In `i18n/de.js` Z. 21–22 den **gesamten Wert** von `introFlowDesc`
ersetzen. Vorher:

```js
    introFlowDesc:
      "<b>1. Seite</b> - Wählen Sie oben rechts die Seite aus, auf der Sie das CI tragen. Wenn Sie 2 CI tragen, führen Sie die Messung (Punkt 3) für beide aus.<br><b>2. Implantat</b> – Wählen Sie Ihren Hersteller. Falls bekannt, korrigieren Sie die Frequenzeinträge pro Elektrode. Standardwerte sind voreingestellt.<br><b>Wichtig:</b> Deaktivierte Elektroden müssen unter „Status“ markiert werden.<br><b>3. Messung</b> – Starten Sie eine Testreihe. Das Tool spielt Tonpaare ab; Sie stellen ein, bis beide gleich laut klingen.<br><b>4. Player</b> – Laden Sie eine Musikdatei und hören Sie den Unterschied mit und ohne Korrektur.<br><b>5. Levels</b> – Optional: Gesamteinstellungen wie Sprachbetonung oder Baßverstärkung, live hörbar im Player.",
```

Nachher:

```js
    introFlowDesc:
      "<b>1. Seite</b> – Wählen Sie oben rechts die Seite aus, auf der Sie das CI tragen. Wenn Sie 2 CI tragen, führen Sie die Messung (Punkt 4) für beide aus.<br><b>2. Implantat</b> – Wählen Sie Ihren Hersteller. Falls bekannt, korrigieren Sie die Frequenzeinträge pro Elektrode. Standardwerte sind voreingestellt. <b>Wichtig:</b> Deaktivierte Elektroden müssen unter „Status“ markiert werden.<br><b>3. Lautstärke</b> – Stellen Sie die Lautstärke auf gefühlt 3/4 ein. Nicht leise, noch nicht unangenehm laut.<br><b>4. Messung</b> – Starten Sie eine Testreihe in „Messungen" → „Elektrodenlautstärke". Das Tool spielt Tonpaare ab; Sie stellen ein, bis beide gleich laut klingen.<br><b>5. Player</b> – Laden Sie eine Musikdatei und hören Sie den Unterschied mit und ohne Korrektur.<br><b>6. Levels</b> – Optional: Gesamteinstellungen wie Sprachbetonung oder Baßverstärkung, live hörbar im Player.",
```

Wichtige Detail-Punkte:

- Punkte 1, 2, 3, 4, 5, 6 lückenlos. Punkt 3 (Lautstärke) ist neu.
- Im Punkt 1 wurde der Verweis „(Punkt 3)" auf „(Punkt 4)" angepaßt,
  weil Messung jetzt Punkt 4 ist.
- Im Punkt 2 ist die bisher als separater `<br>`-Absatz stehende
  „Wichtig"-Zeile jetzt am Ende des Punkt-2-Satzes eingebettet
  (kein eigener `<br>`-Block davor; `<b>Wichtig:</b>` bleibt fett).
- In Punkt 4 wird der UI-Pfad mit typographischen Anführungszeichen
  „…" und Pfeil „→" notiert (genauer: U+201E doppeltes Anführungszeichen
  unten und U+201C oben — wie in der bestehenden Datei für „Status"
  verwendet).
- Die ersten Trenner zwischen den `<br>` sind erhalten geblieben; nur
  innerhalb der Punkte hat sich Text geändert.

## Stelle 2 — `i18n/en.js`: `introFlowDesc` komplett neu (Punkt 7)

In `i18n/en.js` Z. 21–22 den **gesamten Wert** von `introFlowDesc`
ersetzen. Vorher:

```js
    introFlowDesc:
      "<b>1. Side</b> – Select the side on which you wear your CI in the top right corner. If you wear two CIs, perform the measurement (Step 3) for both.<br><b>2. Implant</b> – Select your manufacturer. If known, adjust the frequency values listed for each electrode; standard values are pre-configured by default.<br><b>Important:</b> Deactivated electrodes must be marked under “Status”.<br><b>3. Measurement</b> – Start a test sequence. The tool plays pairs of tones; adjust the settings until both tones sound equally loud. Recommendation: Set the volume to a level that borders on being uncomfortable.<br><b>4. Player</b> – Load a music file and listen to the difference with and without the correction applied.<br><b>5. Levels</b> – Optional: Apply global settings (e.g., speech emphasis, bass boosting) and listen to the difference live in the player simultaneously.",
```

Nachher:

```js
    introFlowDesc:
      "<b>1. Side</b> – Select the side on which you wear your CI in the top right corner. If you wear two CIs, perform the measurement (Step 4) for both.<br><b>2. Implant</b> – Select your manufacturer. If known, adjust the frequency values listed for each electrode; standard values are pre-configured by default. <b>Important:</b> Deactivated electrodes must be marked under “Status”.<br><b>3. Volume</b> – Set the playback volume to roughly 3/4 of your comfortable range. Not quiet, but not yet uncomfortably loud.<br><b>4. Measurement</b> – Start a test sequence under “Measurements” → “Electrode loudness”. The tool plays pairs of tones; adjust the settings until both tones sound equally loud.<br><b>5. Player</b> – Load a music file and listen to the difference with and without the correction applied.<br><b>6. Levels</b> – Optional: Apply global settings (e.g., speech emphasis, bass boosting) and listen to the difference live in the player simultaneously.",
```

Die bisherige „Recommendation: Set the volume …"-Zeile fällt ersatzlos
weg — die Lautstärke-Empfehlung ist jetzt eigenständig in Punkt 3
abgebildet.

## Stelle 3 — `i18n/fr.js`: `introFlowDesc` komplett neu (Punkt 7)

In `i18n/fr.js` Z. 21–22 den **gesamten Wert** von `introFlowDesc`
ersetzen. Vorher:

```js
    introFlowDesc:
      "<b>1. Côté</b> – Sélectionnez, dans le coin supérieur droit, le côté sur lequel vous portez votre implant cochléaire. Si vous portez deux implants, effectuez la mesure (Étape 3) pour chacun d'eux.<br><b>2. Implant</b> – Sélectionnez le fabricant de votre implant cochléaire. Si vous les connaissez, ajustez les valeurs de fréquence indiquées pour chaque électrode ; des valeurs standard sont préconfigurées par défaut.<br><b>Important :</b> Les électrodes désactivées doivent être marquées sous «Statut».<br><b>3. Mesure</b> – Lancez une séquence de test. L'outil diffuse des paires de sons ; ajustez les réglages jusqu'à ce que les deux sons vous semblent avoir exactement le même volume. Recommandation : réglez le volume à un niveau frisant l'inconfort.<br><b>4. Lecteur</b> – Chargez un fichier musical et écoutez la différence, avec et sans l'application de la correction.<br><b>5. Niveaux</b> – Facultatif : Appliquez des réglages globaux (par ex. accentuation de la parole, renforcement des basses) et écoutez simultanément la différence en direct dans le lecteur.",
```

Nachher:

```js
    introFlowDesc:
      "<b>1. Côté</b> – Sélectionnez, dans le coin supérieur droit, le côté sur lequel vous portez votre implant cochléaire. Si vous portez deux implants, effectuez la mesure (Étape 4) pour chacun d'eux.<br><b>2. Implant</b> – Sélectionnez le fabricant de votre implant cochléaire. Si vous les connaissez, ajustez les valeurs de fréquence indiquées pour chaque électrode ; des valeurs standard sont préconfigurées par défaut. <b>Important :</b> Les électrodes désactivées doivent être marquées sous «Statut».<br><b>3. Volume</b> – Réglez le volume de lecture à environ 3/4 de votre plage confortable. Ni faible, ni encore inconfortablement fort.<br><b>4. Mesure</b> – Lancez une séquence de test dans «Mesures» → «Volume des électrodes». L'outil diffuse des paires de sons ; ajustez les réglages jusqu'à ce que les deux sons vous semblent avoir exactement le même volume.<br><b>5. Lecteur</b> – Chargez un fichier musical et écoutez la différence, avec et sans l'application de la correction.<br><b>6. Niveaux</b> – Facultatif : Appliquez des réglages globaux (par ex. accentuation de la parole, renforcement des basses) et écoutez simultanément la différence en direct dans le lecteur.",
```

## Stelle 4 — `i18n/es.js`: `introFlowDesc` komplett neu (Punkt 7)

In `i18n/es.js` Z. 21–22 den **gesamten Wert** von `introFlowDesc`
ersetzen. Vorher:

```js
    introFlowDesc:
      "<b>1. Lado</b> – Seleccione, en la esquina superior derecha, el lado en el que lleva su IC. Si utiliza dos IC, realice la medición (Paso 3) para ambos.<br><b>2. Implante</b> – Seleccione su fabricante. Si conoce los datos específicos, ajuste los valores de frecuencia listados para cada electrodo; los valores estándar vienen preconfigurados por defecto.<br><b>Importante:</b> Los electrodos desactivados deben marcarse en «Estado».<br><b>3. Medición</b> – Inicie una secuencia de prueba. La herramienta reproduce pares de tonos; ajuste la configuración hasta que ambos tonos suenen con la misma intensidad. Recomendación: Ajuste el volumen a un nivel que roce lo incómodo.<br><b>4. Reproductor</b> – Cargue un archivo de música y escuche la diferencia con y sin la corrección aplicada.<br><b>5. Niveles</b> – Opcional: Aplique ajustes globales (p. ej., énfasis en el habla, refuerzo de graves) y escuche la diferencia en directo en el reproductor de forma simultánea.",
```

Nachher:

```js
    introFlowDesc:
      "<b>1. Lado</b> – Seleccione, en la esquina superior derecha, el lado en el que lleva su IC. Si utiliza dos IC, realice la medición (Paso 4) para ambos.<br><b>2. Implante</b> – Seleccione su fabricante. Si conoce los datos específicos, ajuste los valores de frecuencia listados para cada electrodo; los valores estándar vienen preconfigurados por defecto. <b>Importante:</b> Los electrodos desactivados deben marcarse en «Estado».<br><b>3. Volumen</b> – Ajuste el volumen de reproducción aproximadamente a 3/4 de su rango cómodo. Ni bajo, ni todavía incómodamente alto.<br><b>4. Medición</b> – Inicie una secuencia de prueba en «Mediciones» → «Volumen de electrodos». La herramienta reproduce pares de tonos; ajuste la configuración hasta que ambos tonos suenen con la misma intensidad.<br><b>5. Reproductor</b> – Cargue un archivo de música y escuche la diferencia con y sin la corrección aplicada.<br><b>6. Niveles</b> – Opcional: Aplique ajustes globales (p. ej., énfasis en el habla, refuerzo de graves) y escuche la diferencia en directo en el reproductor de forma simultánea.",
```

## Stelle 5 — `i18n/de.js`: `lrPrereqHint` Wortkorrektur (Punkt 14)

In `i18n/de.js` Z. 642, aktuell:

```js
    lrPrereqHint: "Führen Sie zuerst den Test Elektrodenlautstärke für beide Seiten aus.",
```

Ersetzen durch:

```js
    lrPrereqHint: "Führen Sie zuerst die Messung Elektrodenlautstärke für beide Seiten aus.",
```

## Stelle 6 — `i18n/en.js`: `lrPrereqHint` an „measurement" angleichen

In `i18n/en.js` Z. 638, aktuell:

```js
    lrPrereqHint: "Please run the electrode loudness test for both sides first.",
```

Ersetzen durch:

```js
    lrPrereqHint: "Please run the electrode loudness measurement for both sides first.",
```

## Stelle 7 — `i18n/fr.js`: `lrPrereqHint` an „mesure" angleichen

In `i18n/fr.js` Z. 625, aktuell:

```js
    lrPrereqHint: "Veuillez d'abord effectuer le test d'équilibre du volume des électrodes pour les deux côtés.",
```

Ersetzen durch:

```js
    lrPrereqHint: "Veuillez d'abord effectuer la mesure du volume des électrodes pour les deux côtés.",
```

## Stelle 8 — `i18n/es.js`: `lrPrereqHint` an „medición" angleichen

In `i18n/es.js` Z. 625, aktuell:

```js
    lrPrereqHint: "Realice primero la prueba de volumen de electrodos para ambos lados.",
```

Ersetzen durch:

```js
    lrPrereqHint: "Realice primero la medición de volumen de electrodos para ambos lados.",
```

## Stelle 9 — Neue Keys `latPrereqHint` und `fmPrereqHint` (Punkt 13)

In allen vier i18n-Dateien je zwei neue Schlüssel ergänzen, direkt neben
dem bestehenden `lrPrereqHint`-Eintrag (gleicher Block, gleiche
Einrückung, Komma am Ende prüfen).

**`i18n/de.js`** (nach Z. 642, dem überarbeiteten `lrPrereqHint`):

```js
    latPrereqHint: "Führen Sie zuerst die Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten aus.",
    fmPrereqHint: "Führen Sie zuerst die Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten aus.",
```

**`i18n/en.js`** (nach Z. 638):

```js
    latPrereqHint: "Please run the electrode loudness and stereo balance measurements for both sides first.",
    fmPrereqHint: "Please run the electrode loudness and stereo balance measurements for both sides first.",
```

**`i18n/fr.js`** (nach Z. 625):

```js
    latPrereqHint: "Veuillez d'abord effectuer les mesures du volume des électrodes et de balance stéréo pour les deux côtés.",
    fmPrereqHint: "Veuillez d'abord effectuer les mesures du volume des électrodes et de balance stéréo pour les deux côtés.",
```

**`i18n/es.js`** (nach Z. 625):

```js
    latPrereqHint: "Realice primero las mediciones de volumen de electrodos y balance estéreo para ambos lados.",
    fmPrereqHint: "Realice primero las mediciones de volumen de electrodos y balance estéreo para ambos lados.",
```

(Der Wortlaut ist in beiden Keys gleich. Es sind zwei eigene Schlüssel
statt einem gemeinsamen, weil das dem Muster `lrPrereqHint` /
`latPrereqHint` / `fmPrereqHint` folgt und spätere Differenzierung
einzelner Hinweise ohne Refactoring erlaubt.)

## Stelle 10 — UI-Einbindung Latenz: `latPrereqHint` anzeigen

In `index.html` im Sub-Panel `subpanel-messungen-latenz` (aktuell ab
Z. 426). Nach dem Block `latBTWarning` (`<div class="info-box" …>…</div>`
endet bei Z. 436) und **vor** dem `<p … data-t="latMeasIntro">` (Z. 438)
einfügen:

```html
          <p class="explain" data-t="latPrereqHint">Führen Sie zuerst die Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten aus.</p>
```

(Der `data-t`-Mechanismus überschreibt den Initialtext beim Sprach-
wechsel; der Fallback-Text steht trotzdem im Markup, damit er beim
ersten Render vor `applyLang()` sichtbar ist.)

## Stelle 11 — UI-Einbindung Frequenzabgleich: `fmPrereqHint` anzeigen

In `freqmatch.js` im `buildTestPanel`-Config-Objekt (aktuell ab Z. 487
mit `explain: { titleKey: 'fmTitle', paragraphs: [ … ] }`), die
`paragraphs`-Liste um einen Eintrag erweitern. Bisher:

```js
    explain: {
      titleKey: 'fmTitle',
      paragraphs: [
        { key: 'fmHintMethod', kind: 'plain' },
        { key: 'fmHintWarn', kind: 'warn' }
      ]
    },
```

Ändern in:

```js
    explain: {
      titleKey: 'fmTitle',
      paragraphs: [
        { key: 'fmHintMethod', kind: 'plain' },
        { key: 'fmPrereqHint', kind: 'plain' },
        { key: 'fmHintWarn', kind: 'warn' }
      ]
    },
```

(Reihenfolge bewußt: erst die Methoden-Beschreibung, dann die
Vorbedingung, dann die Warnung — die Warnung bleibt am Schluß, damit
sie visuell hervorgehoben am Ende der Erklärung steht.)

## Stelle 12 — `SPEC.md` / `spec/`

Im Kapitel zu **Messungen** unter den jeweiligen Sub-Tabs (Latenz,
Frequenzabgleich, Stereo-Balance) den neuen bzw. überarbeiteten Hinweis
kurz erwähnen:

> Latenz und Frequenzabgleich zeigen einen Vorbedingungs-Hinweis, der
> empfiehlt, vorher die Messungen Elektrodenlautstärke und Stereo-Balance
> für beide Seiten durchzuführen. Der Stereo-Balance-Sub-Tab zeigt
> analog einen Hinweis, der nur die Elektrodenlautstärke-Messung als
> Vorbedingung nennt.

Im Intro-Kapitel den ergänzten Schritt 3 erwähnen (neuer Zusatz
„Elektrodenlautstärke" und die neue Wichtig-Zeile zum Programm ohne
Geräuschfilter).

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Intro-Änderung (Punkt 7)

1. Werkzeug laden. Tab „Einführung". In der Sektion „Wie ist der
   Ablauf?" alle Punkte lesen.
2. Erwartet (DE): sechs lückenlos nummerierte Punkte 1–6. Punkt 2
   endet mit „… <b>Wichtig:</b> Deaktivierte Elektroden müssen unter
   „Status" markiert werden." (kein eigenständiger „Wichtig"-Absatz
   mehr). Punkt 3 lautet „<b>3. Lautstärke</b> – Stellen Sie die
   Lautstärke auf gefühlt 3/4 ein. Nicht leise, noch nicht unangenehm
   laut." Punkt 4 nennt den Pfad „Messungen" → „Elektrodenlautstärke".
   In Punkt 1 steht „(Punkt 4)" als Verweis, nicht mehr „(Punkt 3)".
3. Sprache umschalten (EN/FR/ES). Erwartet: jeweils dieselbe
   Struktur mit sechs lückenlos nummerierten Punkten, ohne die alte
   „Recommendation:"-Zeile, dafür mit dem eigenständigen Lautstärke-
   Punkt. UI-Pfad-Notation in Punkt 4 entsprechend der jeweiligen
   Sprache („Measurements" → „Electrode loudness" / «Mesures» →
   «Volume des électrodes» / «Mediciones» → «Volumen de electrodos»).

### Test B — Wortkorrektur Stereo-Balance (Punkt 14)

1. Tab Messungen → Sub-Tab Stereo-Balance. Den Erklärungs-Text lesen.
2. Erwartet (DE): „Führen Sie zuerst die Messung Elektrodenlautstärke
   für beide Seiten aus." (Wort „Test" ist weg.)
3. Sprachwechsel: EN „measurement", FR „mesure", ES „medición".

### Test C — Vorbedingungs-Hinweis bei Latenz (Punkt 13)

1. Tab Messungen → Sub-Tab Latenz.
2. Erwartet: Zwischen dem BT-Warnungs-Kasten und dem
   Schieber-Hinweis-Absatz erscheint die Zeile „Führen Sie zuerst die
   Messungen Elektrodenlautstärke und Stereo-Balance für beide Seiten
   aus." (DE) bzw. die entsprechende Übersetzung.

### Test D — Vorbedingungs-Hinweis bei Frequenzabgleich (Punkt 13)

1. Tab Messungen → Sub-Tab Frequenzabgleich.
2. Erwartet: Im Erklärungs-Block (oberhalb der Voreinstellungen)
   erscheinen drei Absätze in der Reihenfolge:
   1. Methoden-Beschreibung (`fmHintMethod`)
   2. Vorbedingungs-Hinweis (`fmPrereqHint`) — neue Zeile
   3. Warn-Absatz (`fmHintWarn`)
3. Sprachen testen.

### Test E — Keine ungenutzten oder leeren Keys

1. Konsole: `t('latPrereqHint')`, `t('fmPrereqHint')` aufrufen.
2. Erwartet: liefert in jeder Sprache den passenden String, **nicht**
   den Key-Namen (das wäre das Zeichen für fehlende Übersetzung).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–E einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Sind die neuen Keys `latPrereqHint` und `fmPrereqHint` in **allen
  vier** Sprachdateien angelegt, mit korrekter Syntax (Komma am
  Zeilenende, kein Tippfehler im Schlüsselnamen)?
- Wurde im Intro-Wert das gesamte `<br>`-Konstrukt korrekt erhalten?
  Insbesondere darf nicht versehentlich der `<br>` vor „4. Player"
  verloren gehen.
- Funktioniert die neue UI-Einbindung in Latenz tatsächlich? `applyLang`
  setzt den Textinhalt aller `[data-t=…]`-Elemente — der neue `<p>`
  muß im DOM stehen, bevor `applyLang` läuft. Sind keine doppelten
  IDs entstanden?
- Bei `lrPrereqHint`-Wortkorrektur in EN/FR/ES: passen die geänderten
  Wörter zur Tool-internen Terminologie (z. B. wird sonst im Rest
  des UI auch „measurement" / „mesure" / „medición" verwendet)? Bei
  Zweifel: Rückfrage.
- Wurde im Frequenzabgleich-Explain-Block die Reihenfolge
  `fmHintMethod → fmPrereqHint → fmHintWarn` eingehalten?

Bei Unklarheit Rückfrage statt Annahme.
