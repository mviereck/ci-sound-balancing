# Bauanleitung 08: i18n-Lücken in EN/FR/ES schließen

Ein Audit hat ergeben, daß in `i18n.js` einige Keys nur im
deutschen Block (`L.de`) definiert sind, aber in mindestens einer
der anderen Sprachen (`L.en`, `L.fr`, `L.es`) fehlen. Diese
Bauanleitung schließt diese Lücken. **Nur** `i18n.js` wird
verändert — keine andere Datei.

## Übersicht der Lücken

| Key            | DE | EN | FR | ES |
|---------------|----|----|----|----|
| `plSideLabel` | ✔  | ✗  | ✗  | ✗  |
| `balTitle`    | ✔  | ✔  | ✗  | ✗  |
| `balDesc`     | ✔  | ✔  | ✗  | ✗  |
| `balLabel`    | ✔  | ✔  | ✗  | ✗  |
| `fResetAll`   | ✔  | ✔  | ✗  | ✗  |
| `lblSide`     | ✔  | ✔  | ✗  | ✗  |
| `resetConfirm`| ✔  | ✔  | ✗  | ✗  |
| `resetDone`   | ✔  | ✔  | ✗  | ✗  |

Insgesamt: 1 Einfügung in EN, je 8 Einfügungen in FR und ES.

## Verwendung der Keys (zur Kontext-Verifikation)

- `plSideLabel` — Label „Seite:" über dem Side-Auswahl-Element im
  Player-Tab.
- `balTitle` / `balDesc` / `balLabel` — Titel, Beschreibungstext und
  Slider-Label der Stereo-Balance-Sektion im Player-Tab
  („Einstellungen"-Karte).
- `fResetAll` — Beschriftung des roten „Alles zurücksetzen"-Buttons
  im Tab „Laden/Speichern".
- `resetConfirm` — Confirm-Dialog beim Klick auf „Alles
  zurücksetzen".
- `resetDone` — Alert-Meldung nach erfolgtem Reset.
- `lblSide` — Side-Label irgendwo in der Implantat-/Frequenz-
  Tabelle (analog zu `plSideLabel`, aber außerhalb des Players).

## Konkrete Änderungen

### EN-Block (Z. 506 ist die `lblSide`-Zeile)

**Direkt nach `lblSide: "Side:",` einfügen:**

```js
    plSideLabel: "Side:",
```

### FR-Block

Im französischen Block die folgenden 8 Einträge einfügen. Die Position
ist jeweils analog zur deutschen Reihenfolge — also nach demselben
Anker-Key, der im DE-Block direkt davor steht.

**Anker `delConfirmMeas: "Supprimer les mesures?",` (≈ Z. 1080):**
direkt danach einfügen:

```js
    resetConfirm:
      "Vraiment tout réinitialiser ? Tous les paramètres, mesures et notes seront supprimés.",
    resetDone: "Tout réinitialisé.",
```

**Anker `plMapExpl: "Simulation compression MED-EL.",` (≈ Z. 1103):**
direkt danach einfügen:

```js
    balTitle: "Stéréo-balance",
    balDesc:
      "Règle le volume relatif entre la correction gauche et droite. Fonctionne dans le lecteur avec de l'audio stéréo.",
    balLabel: "Balance :",
```

**Anker `fCopy: "Copier",` (≈ Z. 1109):** direkt danach einfügen:

```js
    fResetAll: "Tout réinitialiser",
```

**`lblSide` und `plSideLabel` im FR-Block**: Such die Stelle, die
strukturell der DE-Position entspricht (`lblSide` im DE-Block
auf Z. 33, ganz nahe dem Block-Anfang). Im FR-Block analog nahe dem
Block-Anfang einfügen. Falls kein klarer Anker da ist, gleich nach
dem ersten Key (`title:` oder `subtitle:`) einfügen:

```js
    lblSide: "Côté :",
    plSideLabel: "Côté :",
```

### ES-Block

Analog zum FR-Block, gleiche Anker, gleiche Reihenfolge.

**Anker `delConfirmMeas: "¿Eliminar mediciones?",` (≈ Z. 1525):**
direkt danach einfügen:

```js
    resetConfirm:
      "¿Restablecer todo? Se borrarán todos los ajustes, mediciones y notas.",
    resetDone: "Todo restablecido.",
```

**Anker `plMapExpl: "Simulación compresión MED-EL.",` (≈ Z. 1548):**
direkt danach einfügen:

```js
    balTitle: "Balance estéreo",
    balDesc:
      "Ajusta el volumen relativo entre la corrección izquierda y derecha. Funciona en el reproductor con audio estéreo.",
    balLabel: "Balance:",
```

**Anker `fCopy: "Copiar",` (≈ Z. 1554):** direkt danach einfügen:

```js
    fResetAll: "Restablecer todo",
```

**`lblSide` und `plSideLabel` im ES-Block**: nahe dem Block-Anfang
analog zum FR-Block:

```js
    lblSide: "Lado:",
    plSideLabel: "Lado:",
```

## Hinweis zu Bindestrich-Konventionen

In DE und EN ist im aktuellen Build `balTitle = "Stereo-Balance"`
(DE) bzw. `"Stereo balance"` (EN). Diese Schreibweisen bleiben
unverändert. Für FR wurde bewußt „Stéréo-balance" mit Bindestrich
gewählt (Wunsch des Nutzers, einheitlich mit `tabBalance: "Stereo-
Balance"`). Für ES wurde „Balance estéreo" als sprachübliche Form
gewählt; falls der Nutzer auch hier Bindestrich wünscht, ist das
eine triviale Korrektur.

## Nicht zu tun

- Keine anderen Keys anfassen, auch wenn sie inhaltlich verwandt
  aussehen.
- Keine Code-Datei außer `i18n.js` anfassen.
- Keine HTML-Datei anfassen.
- Keine README- oder Doku-Dateien anfassen.

## Akzeptanztest (vom Nutzer durchzugehen)

1. Tool im Browser laden, Sprache oben rechts auf **„English"**
   stellen.
   - Player-Tab öffnen. Erwartet: Über dem Side-Auswahl-Element
     (Beide Seiten / Mono-EQ) steht „Side:" — kein deutscher Text.

2. Sprache auf **„Français"** stellen.
   - Tab „Laden/Speichern" öffnen. Erwartet: roter Button heißt
     „Tout réinitialiser".
   - Auf den Button klicken. Erwartet: Confirm-Dialog in
     Französisch, mit dem Text „Vraiment tout réinitialiser ?
     Tous les paramètres, mesures et notes seront supprimés." Mit
     „Abbrechen" (oder dem französischen Equivalent des Browsers)
     wegklicken.
   - Player-Tab öffnen, in den „Einstellungen"-Karten suchen.
     Erwartet: eine Sektion mit Titel „Stéréo-balance",
     Beschreibungstext auf Französisch und Slider-Label
     „Balance :".
   - Nirgendwo deutscher Text in den geprüften Stellen.

3. Sprache auf **„Español"** stellen.
   - Tab „Laden/Speichern": Button heißt „Restablecer todo".
   - Klick darauf: Dialog auf Spanisch.
   - Player-Einstellungen: „Balance estéreo"-Sektion mit
     Slider-Label „Balance:".
   - Nirgendwo deutscher Text in den geprüften Stellen.

4. Zurück auf **„Deutsch"** stellen. Erwartet: alle Texte wieder
   deutsch, keine englischen Fragmente.

## Selbstprüfungs-Auftrag an Sonnet (vor Fertig-Meldung durchgehen)

Vor der Fertig-Meldung jeden der 17 eingefügten Keys mit einem
`grep -c "^    <key>:" i18n.js`-Äquivalent (oder durch Lesen) prüfen:
jeder dieser Keys soll nach den Änderungen **genau viermal** in
`i18n.js` vorkommen (je einmal in DE, EN, FR, ES). Wenn ein Key
nur drei- oder fünfmal vorkommt: prüfen welcher Block fehlt oder
welcher doppelt ist, und korrigieren.

Akzeptanz-Kriterien einzeln durchgehen:

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeilenangabe |
|------|-----------------------------------|---------------------|
| `plSideLabel` in EN vorhanden | | |
| `resetConfirm` in FR vorhanden | | |
| `resetDone` in FR vorhanden | | |
| `balTitle`/`balDesc`/`balLabel` in FR vorhanden | | |
| `fResetAll` in FR vorhanden | | |
| `lblSide`/`plSideLabel` in FR vorhanden | | |
| `resetConfirm` in ES vorhanden | | |
| `resetDone` in ES vorhanden | | |
| `balTitle`/`balDesc`/`balLabel` in ES vorhanden | | |
| `fResetAll` in ES vorhanden | | |
| `lblSide`/`plSideLabel` in ES vorhanden | | |
| Alle Werte als JS-String mit umschließenden Anführungszeichen und Komma am Ende | | |
| Keine Datei außer `i18n.js` angefaßt | | |

Bei Unklarheiten: vor dem Fertig-Melden fragen, nicht raten.
