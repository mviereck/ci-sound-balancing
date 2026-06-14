# BAUANLEITUNG 298 — Tonwahl-Modalbox: dauerhaft sichtbare Hinweise

## Ziel

Die Tonwahl-Modalbox (`openToneSelectionDialog`) zeigt bisher ihre
gelben Hinweis-Boxen (`hintKey`, `extraHintKey`) **nur im Debug-Modus**
(BA 296). Im Normalbetrieb sieht der Nutzer gar keinen Hinweis.

Diese Anleitung fügt **zwei dauerhaft sichtbare Hinweise** hinzu, die
unabhängig vom Debug-Modus erscheinen:

1. **Lautstärke-Hinweis (universell):** fest verdrahtet, erscheint in
   **jedem** Aufruf der Modalbox (Messungen, Stereo-Balance, Freqmatch,
   Implantat). Erklärt den Einschwing-Effekt am Tonanfang.

2. **Rausch-Hinweis (nur Implantat-Reiter):** über ein **neues
   cfg-Feld** `persistentHintKey` gesetzt. Nur der Implantat-Aufruf
   nutzt es.

Die bestehenden Debug-Hinweise (`hintKey`, `extraHintKey`, inkl. des
alten Sinus-Satzes `tonePopupHintImplant`) bleiben **unverändert** nur
im Debug-Modus sichtbar.

Im Code **ausschließlich ASCII-Anführungszeichen** `"` und `'`
verwenden. (Die neuen Strings enthalten ohnehin keine Quotes, nur den
Geviertstrich `—` und Umlaute — beides unproblematisch innerhalb von
`"…"`.)

---

## Schritt 1 — `js/version.js`

Inhalt ersetzen durch:

```js
const APP_VERSION = "0.4.298-beta";
```

---

## Schritt 2 — `js/tone-popup.js`: cfg-Doku ergänzen

Im Datei-Kopf bei den cfg-Feldern (aktuell Z. 22–24). **Vorher:**

```js
//   extraHintKey          -> i18n-Key fuer reiterspezifische
//                            Zusatz-Hinweis-Box direkt unter der
//                            ersten (gleiches Styling), optional
```

**Nachher:**

```js
//   extraHintKey          -> i18n-Key fuer reiterspezifische
//                            Zusatz-Hinweis-Box direkt unter der
//                            ersten (gleiches Styling), optional
//   persistentHintKey     -> i18n-Key fuer einen DAUERHAFT sichtbaren
//                            (auch ohne Debug) reiterspezifischen
//                            Hinweis, optional. Steht direkt unter dem
//                            universellen Lautstaerke-Hinweis. (BA 298)
```

---

## Schritt 3 — `js/tone-popup.js`: dauerhafte Hinweise rendern

Suche den Block, der den Titel anhängt, gefolgt vom ersten (Debug-)
Hinweis. Aktuell Z. 284–301:

```js
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  // BA 240: Hint-Box optional und reiterspezifisch.
  // BA 265: Zweite Hint-Box (cfg.extraHintKey) fuer reiterspezifische
  // Ergaenzungen, die UNTER dem allgemeinen Intro-Text stehen.
  // Beide Boxen optional. Wenn beide gesetzt sind, hat die erste
  // einen knapperen Bottom-Margin, damit sie zusammenruecken.
  var _tpHasExtraHint = !!cfg.extraHintKey;
  if (dbgOn && cfg.hintKey) {
```

**Direkt nach `dlg.appendChild(title);`** (also VOR dem Kommentar
`// BA 240: Hint-Box optional ...`) diesen Block einfügen:

```js
  // BA 298: Dauerhaft sichtbare Hinweise, unabhaengig vom Debug-Modus.
  // (1) Universeller Lautstaerke-Hinweis, fest verdrahtet in jedem
  //     Aufruf. (2) Optionaler reiterspezifischer Dauer-Hinweis ueber
  //     cfg.persistentHintKey (aktuell: Rausch-Hinweis im Implantat-
  //     Reiter). Gleiche gelbe Box-Optik wie die Debug-Hinweise.
  var _tpDbgHintFollows = dbgOn && (cfg.hintKey || cfg.extraHintKey);
  var _tpPersistStyle = function (bottomPx) {
    return 'margin:0 0 ' + bottomPx + 'px 0;font-size:.92em;' +
           'line-height:1.35;background:#fff4d6;' +
           'border-left:3px solid #d8a200;padding:8px 10px;' +
           'border-radius:4px;';
  };
  // Letzter sichtbarer Dauer-Hinweis braucht 14px Abstand nach unten,
  // ausser es folgt noch ein Debug-Hinweis (dann 8px, zusammenruecken).
  var _tpPersistLastMargin = _tpDbgHintFollows ? '8' : '14';

  var stabHint = document.createElement('p');
  stabHint.dataset.t = 'tonePopupHintStabilize';
  stabHint.style.cssText = _tpPersistStyle(
    cfg.persistentHintKey ? '8' : _tpPersistLastMargin);
  dlg.appendChild(stabHint);

  if (cfg.persistentHintKey) {
    var persHint = document.createElement('p');
    persHint.dataset.t = cfg.persistentHintKey;
    persHint.style.cssText = _tpPersistStyle(_tpPersistLastMargin);
    dlg.appendChild(persHint);
  }

```

Der nachfolgende `// BA 240`-Block und die `dbgOn`-Hinweise bleiben
**unverändert** stehen.

---

## Schritt 4 — `js/ui-implant.js`: Rausch-Hinweis setzen

Im `openToneSelectionDialog({ ... })`-Aufruf bei den Hint-Keys
(aktuell Z. 313–315). **Vorher:**

```js
    titleKey:     "tonePopupTitleImplant",
    hintKey:      "tonePopupHint",
    extraHintKey: "tonePopupHintImplant",
```

**Nachher:**

```js
    titleKey:     "tonePopupTitleImplant",
    hintKey:      "tonePopupHint",
    extraHintKey: "tonePopupHintImplant",
    persistentHintKey: "tonePopupHintImplantNoise",   // BA 298: Rausch-Hinweis, dauerhaft sichtbar
```

---

## Schritt 5 — `i18n/de.js`: neue Keys

Nach `tonePopupHintImplant:` (aktuell Z. 1170) zwei neue Keys einfügen:

```js
    tonePopupHintStabilize:
      "Zu Beginn eines Tons im CI kann sich die Lautstärke kurz verändern — er wirkt erst etwas lauter und pendelt sich dann ein. Bewerten Sie den Ton erst, wenn die Lautstärke sich stabilisiert hat.",
    tonePopupHintImplantNoise:
      "Rauschen kann auf eine schlechtere Verbindung zwischen Elektrode und Hörnerv hindeuten — etwa durch Narbengewebe oder zurückgebildete Hörnervfasern.",
```

---

## Schritt 6 — `i18n/en.js`: neue Keys

Nach `tonePopupHintImplant:` (aktuell Z. 1105) einfügen:

```js
    tonePopupHintStabilize:
      "When a tone starts on the CI, the loudness may change briefly — it sounds a little louder at first and then settles. Only judge the tone once the loudness has stabilised.",
    tonePopupHintImplantNoise:
      "Noise may indicate a poorer connection between the electrode and the auditory nerve — for example due to scar tissue or degenerated auditory nerve fibres.",
```

---

## Schritt 7 — `i18n/fr.js`: neue Keys

Nach `tonePopupHintImplant:` (aktuell Z. 1105) einfügen:

```js
    tonePopupHintStabilize:
      "Au début d'un son dans l'implant cochléaire, le volume peut varier brièvement — il paraît d'abord un peu plus fort, puis se stabilise. N'évaluez le son qu'une fois le volume stabilisé.",
    tonePopupHintImplantNoise:
      "Un bruit peut indiquer une moins bonne connexion entre l'électrode et le nerf auditif — par exemple en raison de tissu cicatriciel ou de fibres du nerf auditif dégénérées.",
```

---

## Schritt 8 — `i18n/es.js`: neue Keys

Nach `tonePopupHintImplant:` (aktuell Z. 1105) einfügen:

```js
    tonePopupHintStabilize:
      "Al comenzar un tono en el implante coclear, el volumen puede variar brevemente: primero suena algo más fuerte y luego se estabiliza. Evalúe el tono solo cuando el volumen se haya estabilizado.",
    tonePopupHintImplantNoise:
      "El ruido puede indicar una peor conexión entre el electrodo y el nervio auditivo, por ejemplo debido a tejido cicatricial o a fibras del nervio auditivo degeneradas.",
```

---

## Akzeptanztest (Klick-für-Klick)

Debug-Modus **aus** (Normalbetrieb):

1. Reiter **Messungen** → einen Sub-Reiter öffnen → die Tonwahl-
   Modalbox aufrufen (über den Knopf, der die Ton-Einstellungen
   öffnet).
   → **Erwartet:** ganz oben unter dem Titel ein **gelber Kasten**
   mit dem Lautstärke-Hinweis („Zu Beginn eines Tons im CI …").
   Kein Rausch-Hinweis. Keine weiteren Hinweis-Kästen.

2. Reiter **Implantat** → „Elektroden über Töne anspielen" öffnen.
   → **Erwartet:** **zwei** gelbe Kästen oben — zuerst der
   Lautstärke-Hinweis, darunter der Rausch-Hinweis („Rauschen kann
   auf eine schlechtere Verbindung …").

3. Sprache auf **English** umstellen, Modalbox in beiden Reitern
   erneut öffnen.
   → **Erwartet:** beide Hinweise erscheinen auf Englisch. Analog
   für Français / Español prüfbar.

Debug-Modus **an**:

4. Implantat-Modalbox erneut öffnen.
   → **Erwartet:** oben weiterhin Lautstärke- und Rausch-Hinweis
   (dauerhaft), **darunter** zusätzlich die bekannten Debug-Hinweise
   (allgemeiner Intro-Text + alter Sinus-Satz) — alle als gelbe
   Kästen, ohne übergroße Lücke dazwischen.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie (1–4) einzeln
durchgehen und je melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe der relevanten Stelle. Zusätzlich bestätigen:

- `js/version.js` steht auf `0.4.298-beta`.
- In `i18n/de.js`, `en.js`, `fr.js`, `es.js` sind jeweils **beide**
  neuen Keys vorhanden und mit ASCII-`"` begrenzt (kein U+201C/U+201D/
  U+2018/U+2019 als String-Begrenzer).
- Der universelle Lautstärke-Hinweis ist **nicht** an `dbgOn`
  gekoppelt (erscheint also auch ohne Debug).
- Die bestehenden `dbgOn`-Hinweise sind unverändert.

Wenn etwas als unklar markiert wird: Rückfrage statt stiller Annahme.
