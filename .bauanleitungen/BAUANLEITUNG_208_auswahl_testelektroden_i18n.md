# Bauanleitung 208 — Auswahl Testelektroden: Übersetzungen (en/fr/es)

**Version**: nach Bau `3.2.208-beta`
**Vorgänger-Version**: `3.2.207-beta` (BA 207 muß zuerst gebaut sein)

## Ziel

Die in BA 207 angelegten i18n-Keys für den Dialog „Testelektroden
auswählen" werden in den Sprachen Englisch, Französisch und Spanisch
nachgezogen. Diese BA berührt **nur** die drei Sprachdateien und
`js/version.js`. Keine Codeänderung, keine Spec-Änderung.

## Reihenfolge der Schritte

1. Versionsnummer bumpen (`js/version.js`).
2. Englische Strings in `i18n/en.js`.
3. Französische Strings in `i18n/fr.js`.
4. Spanische Strings in `i18n/es.js`.
5. Selbstprüfung gegen die Akzeptanztest-Checkliste.

## Schritt 1 — Versionsnummer bumpen

`js/version.js` komplett ersetzen durch:

```js
const APP_VERSION = "3.2.208-beta";
```

## Schritt 2 — Englische Strings

In `i18n/en.js` am Ende des `Object.assign(L.en, { ... })`-Blocks (vor
dem schließenden `});`) folgenden Block einfügen:

```js
// BA 208: Testelektroden-Auswahl
electrodeSelectionTitle: "Select test electrodes",
electrodeSelectionHint: "Only selected electrodes take part in the test procedure.",
electrodeSelectionSelectAll: "Select all",
electrodeSelectionDeselectAll: "Deselect all",
electrodeSelectionCancel: "Cancel",
electrodeSelectionConfirm: "Apply",
electrodeSelectionMinError: "Select at least {n} electrode(s).",
electrodeSelectionMutedSuffix: "muted",
electrodeSelectionExcludedSuffix: "excluded",
electrodeSelectionHeaderBtn: "Select test electrodes",
electrodeSelectionHeaderSummary: "{m} of {n} electrodes selected",
electrodeSelectionEmptyEnd: "Test ended: no selected electrode remaining.",
```

## Schritt 3 — Französische Strings

In `i18n/fr.js` am Ende des `Object.assign(L.fr, { ... })`-Blocks
einfügen:

```js
// BA 208: Sélection des électrodes de test
electrodeSelectionTitle: "Sélection des électrodes de test",
electrodeSelectionHint: "Seules les électrodes sélectionnées participent à la procédure de test.",
electrodeSelectionSelectAll: "Tout sélectionner",
electrodeSelectionDeselectAll: "Tout désélectionner",
electrodeSelectionCancel: "Annuler",
electrodeSelectionConfirm: "Appliquer",
electrodeSelectionMinError: "Sélectionnez au moins {n} électrode(s).",
electrodeSelectionMutedSuffix: "muette",
electrodeSelectionExcludedSuffix: "exclue",
electrodeSelectionHeaderBtn: "Sélection des électrodes de test",
electrodeSelectionHeaderSummary: "{m} électrodes sélectionnées sur {n}",
electrodeSelectionEmptyEnd: "Test terminé : plus aucune électrode sélectionnée disponible.",
```

## Schritt 4 — Spanische Strings

In `i18n/es.js` am Ende des `Object.assign(L.es, { ... })`-Blocks
einfügen:

```js
// BA 208: Selección de electrodos de prueba
electrodeSelectionTitle: "Seleccionar electrodos de prueba",
electrodeSelectionHint: "Solo los electrodos seleccionados participan en el procedimiento de prueba.",
electrodeSelectionSelectAll: "Seleccionar todos",
electrodeSelectionDeselectAll: "Deseleccionar todos",
electrodeSelectionCancel: "Cancelar",
electrodeSelectionConfirm: "Aplicar",
electrodeSelectionMinError: "Seleccione al menos {n} electrodo(s).",
electrodeSelectionMutedSuffix: "silenciado",
electrodeSelectionExcludedSuffix: "excluido",
electrodeSelectionHeaderBtn: "Seleccionar electrodos de prueba",
electrodeSelectionHeaderSummary: "{m} de {n} electrodos seleccionados",
electrodeSelectionEmptyEnd: "Prueba finalizada: no quedan electrodos seleccionados.",
```

## Akzeptanztest

1. Tool laden, Reiter Messungen → Frequenzabgleich.
2. Sprache oben rechts auf English umschalten.
   - [ ] Header-Button: „Select test electrodes".
   - [ ] Summary: „N of N electrodes selected".
   - [ ] Dialog öffnen: Titel „Select test electrodes", Hint „Only
         selected electrodes…", Buttons „Select all" / „Deselect all" /
         „Cancel" / „Apply".
   - [ ] Eine stummgeschaltete Elektrode trägt Suffix „(muted)", eine
         ausgeschlossene „(excluded)".
   - [ ] „Deselect all" → „Apply" → Fehler „Select at least 1
         electrode(s).".
3. Sprache auf Français umschalten.
   - [ ] Button: „Sélection des électrodes de test".
   - [ ] Dialog-Titel, Hint, Buttons in französischer Übersetzung.
4. Sprache auf Español umschalten.
   - [ ] Button: „Seleccionar electrodos de prueba".
   - [ ] Dialog-Titel, Hint, Buttons in spanischer Übersetzung.
5. Konsole offen halten: keine Konsolen-Warnungen über fehlende i18n-
   Keys für die in BA 207 angelegten Schlüssel.

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar, mit Datei und Zeilenangabe.

Zusätzliche Selbstprüf-Punkte:

1. `version.js` zeigt `3.2.208-beta`.
2. In den drei Sprachdateien sind exakt **dieselben 12 Schlüssel**
   gesetzt wie in `i18n/de.js` (BA 207, Schritt 11). Keine
   Tippfehler in den Schlüsselnamen — i18n fällt sonst stillschweigend
   auf Deutsch zurück.
3. Anführungszeichen: jede Wert-Zeile ist mit ASCII-`"` begrenzt; im
   Inneren werden keine ASCII-`"` verwendet (sonst Parse-Fehler). Wenn
   typografische Anführungszeichen im Inneren vorkommen sollen, sind
   sie sprachüblich (z.B. französisch « », englisch ""), nicht aus dem
   Deutschen kopiert. — In den vorgegebenen Snippets oben sind keine
   inneren Anführungszeichen, also auf Klammerzählung achten.
