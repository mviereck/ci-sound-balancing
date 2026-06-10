# BA 231 — Mellotron-Bezeichnungen: i18n-Keys + Unterteilung nach Modell

Diese BA setzt auf BA 230 auf. Die einzelnen Mellotron-Bänke bekommen
deutsche/englische/französische/spanische Bezeichnungen statt der
heutigen Original-Token in Großbuchstaben. Die heutige Sammel-Gruppe
„Mellotron-Sampler" wird in fünf Untergruppen nach Mellotron-Modell
aufgeteilt:

1. **M300** (kleine Mellotron-Variante, hier nur Strings)
2. **Mark II** (zweimanualiges Modell)
3. **M400 / Tron** (klassisches Mellotron, in der Sample-Welt „Tron")
4. **Chamberlin** (Vorgänger des Mellotron, eigener Hersteller)
5. **Mischbänke** (Begleitbänke wie Dixie, Foxtrot, halbe Geschwindigkeit
   etc., kein eindeutiges Modell)

Innerhalb jeder Untergruppe alphabetisch nach deutscher Bezeichnung
sortiert. Die Sampler-Keys (`smplr:mellotron:<token>`) bleiben **exakt**
wie sie sind — der Sampler-Lookup hängt daran.

---

## 0. Versionsbump

`js/version.js`:

```js
const APP_VERSION = "3.2.231-beta";
```

---

## 1. tone-popup.js — GROUPS-Konstante umbauen

Datei: `js/tone-popup.js`, Block ab Z. 95 (`{ headKey: 'toneGroupMellotron', ... }`).

Den **gesamten** Mellotron-Gruppen-Block (Z. 95–133) durch fünf neue
Gruppen-Blöcke ersetzen. Die anderen vier Gruppen davor (Sine, Complex,
Rich, Noise) bleiben unangetastet.

```js
    {
      headKey: 'toneGroupSmplrM300',
      hintKey: 'toneGroupSmplrM300Hint',
      items: [
        ['smplr:mellotron:300 STRINGS VIOLA', 'toneSmplrM300Viola', null],
        ['smplr:mellotron:300 STRINGS CELLO', 'toneSmplrM300Cello', null]
      ]
    },
    {
      headKey: 'toneGroupSmplrMk2',
      hintKey: 'toneGroupSmplrMk2Hint',
      items: [
        ['smplr:mellotron:MKII BRASS',   'toneSmplrMk2Brass',   null],
        ['smplr:mellotron:MKII GUITAR',  'toneSmplrMk2Guitar',  null],
        ['smplr:mellotron:MKII ORGAN',   'toneSmplrMk2Organ',   null],
        ['smplr:mellotron:MKII SAX',     'toneSmplrMk2Sax',     null],
        ['smplr:mellotron:MKII VIBES',   'toneSmplrMk2Vibes',   null],
        ['smplr:mellotron:MKII VIOLINS', 'toneSmplrMk2Violins', null]
      ]
    },
    {
      headKey: 'toneGroupSmplrTron',
      hintKey: 'toneGroupSmplrTronHint',
      items: [
        ['smplr:mellotron:TRON 16VLNS', 'toneSmplrTron16Violins', null],
        ['smplr:mellotron:TRON VIOLA',  'toneSmplrTronViola',     null],
        ['smplr:mellotron:TRON CELLO',  'toneSmplrTronCello',     null],
        ['smplr:mellotron:TRON FLUTE',  'toneSmplrTronFlute',     null]
      ]
    },
    {
      headKey: 'toneGroupSmplrChamberlin',
      hintKey: 'toneGroupSmplrChamberlinHint',
      items: [
        ['smplr:mellotron:CHMB 3 VLNS',   'toneSmplrChmb3Violins',  null],
        ['smplr:mellotron:CHMB ALTOSAX',  'toneSmplrChmbAltoSax',   null],
        ['smplr:mellotron:CHMBLN CELLO',  'toneSmplrChmbCello',     null],
        ['smplr:mellotron:CHMBLN FLUTE',  'toneSmplrChmbFlute',     null],
        ['smplr:mellotron:CHMB FEMALE',   'toneSmplrChmbFemale',    null],
        ['smplr:mellotron:CHM CLARINET',  'toneSmplrChmbClarinet',  null],
        ['smplr:mellotron:CHMB MALE VC',  'toneSmplrChmbMale',      null],
        ['smplr:mellotron:CHMBLN OBOE',   'toneSmplrChmbOboe',      null],
        ['smplr:mellotron:CHMB TRMBONE',  'toneSmplrChmbTrombone',  null],
        ['smplr:mellotron:CHMB TNR SAX',  'toneSmplrChmbTenorSax',  null],
        ['smplr:mellotron:CHMB TRUMPET',  'toneSmplrChmbTrumpet',   null]
      ]
    },
    {
      headKey: 'toneGroupSmplrMixed',
      hintKey: 'toneGroupSmplrMixedHint',
      items: [
        ['smplr:mellotron:BASSA+STRNGS',  'toneSmplrMixBassStrings',       null],
        ['smplr:mellotron:MOVE BS+STGS',  'toneSmplrMixMoveBassStrings',   null],
        ['smplr:mellotron:HALFSP.BRASS',  'toneSmplrMixHalfSpeedBrass',    null],
        ['smplr:mellotron:CHA CHA FLT',   'toneSmplrMixChaChaFlute',       null],
        ['smplr:mellotron:8VOICE CHOIR',  'toneSmplrMix8VoiceChoir',       null],
        ['smplr:mellotron:DIXIE+TRMBN',   'toneSmplrMixDixieTrombone',     null],
        ['smplr:mellotron:FOXTROT+SAX',   'toneSmplrMixFoxtrotSax',        null],
        ['smplr:mellotron:BOYS CHOIR',    'toneSmplrMixBoysChoir',         null],
        ['smplr:mellotron:TROMB+TRMPT',   'toneSmplrMixTromboneTrumpet',   null],
        ['smplr:mellotron:STRGS+BRASS',   'toneSmplrMixStringsBrass',      null],
        ['smplr:mellotron:MIXED STRGS',   'toneSmplrMixMixedStrings',      null]
      ]
    }
```

Wichtig:
- **Sampler-Keys** (`smplr:mellotron:<token>`) sind **exakt** wie heute.
  Der `<token>` ist Großbuchstaben und mit Sonderzeichen — bitte zeichengenau
  übernehmen, sonst greift der Sampler-Lookup ins Leere.
- Reihenfolge innerhalb jeder Gruppe = alphabetisch nach deutscher
  Bezeichnung (siehe i18n unten). Das macht die Liste im Dialog
  konsistent lesbar.
- Die 34 heutigen Mellotron-Items werden vollständig auf die 5 Gruppen
  verteilt (Summe: 2 + 6 + 4 + 11 + 11 = 34).

---

## 2. test-ui.js — `_toneTypeKey`-Tabelle ergänzen

Datei: `js/test-ui.js`. Die Helfer-Funktion `_toneTypeKey(tt)` mappt
Tonart-Strings auf i18n-Keys, damit der Tonart-Button im Header
(Z. 1014–1031) den richtigen Text zeigt.

Suche im File nach `_toneTypeKey` (Definition steht laut CODESTRUKTUR
„vor `_maybeExtendSlider`"). Dort enthält die Mapping-Tabelle heute die
Sine/Complex/Rich/Noise-Einträge, aber **keine** Mellotron-Einträge —
deshalb fällt der Header-Button heute auf den Token-Fallback (siehe
test-ui.js Z. 1022–1029).

Mit BA 231 bekommen alle Mellotron-Items einen i18n-Key. Die einfachste
Lösung: den Header-Button-Fallback einfach lassen (Mellotron-Items
werden weiter als `TRON CELLO`-Token-Suffix im Header-Button gezeigt),
ODER eine vollständige Mapping-Tabelle pflegen.

**Empfohlene Lösung (klein):** Header-Button-Fallback so anpassen, daß
für `smplr:mellotron:<token>`-Keys der **i18n-Key aus GROUPS** gesucht
wird. Dafür eine kleine Lookup-Funktion: durchsucht die `GROUPS`-Struktur
nach dem Eintrag mit passendem Sampler-Key und gibt dessen i18n-Key
zurück.

Diese Lookup-Funktion gehört aber dann in `tone-popup.js`, weil dort
`GROUPS` liegt. Praktischer Weg:

### 2.1 In `tone-popup.js`: i18n-Lookup-Funktion exportieren

In `tone-popup.js`, unmittelbar **nach** dem `GROUPS`-Block (also vor
`var initial = cfg.getToneType();` in Z. 136), eine globale Lookup-
Funktion definieren. Die kann dort sitzen, weil sie nur GROUPS liest:

```js
// BA 231: i18n-Key fuer einen toneType-String aus den GROUPS holen.
// Wird von test-ui.js (_toneTypeKey) genutzt, um auch Mellotron-Tonarten
// im Header-Button korrekt zu uebersetzen.
window.toneTypeI18nKey = function(tt) {
  for (var g = 0; g < GROUPS.length; g++) {
    var items = GROUPS[g].items;
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === tt) return items[i][1] || null;
    }
  }
  return null;
};
```

Problem: `GROUPS` ist eine `var`-Konstante **innerhalb** der Funktion
`openToneSelectionDialog`. Sie ist außerhalb nicht sichtbar.

Lösung: `GROUPS` aus der Funktion **hochziehen**, vor die Funktions-
Deklaration. Dann gilt sie für `openToneSelectionDialog` und für
`toneTypeI18nKey`. Konkret:

Verschiebe den `var GROUPS = [...]`-Block (Z. 44–134) vor die Zeile
`function openToneSelectionDialog(cfg, onChange) {` (Z. 43). `var` im
Datei-Scope ist global ans `window` gebunden — kein Verbraucher heute
hat eine Variable namens `GROUPS`. Vor dem Verschieben grepen:

```bash
grep -n "GROUPS" js/*.js
```

Wenn nur Treffer in `tone-popup.js` und keine Kollisionen: Verschiebung
sicher. Danach den `toneTypeI18nKey`-Helper direkt nach der GROUPS-
Konstante definieren.

### 2.2 In `test-ui.js`: `_toneTypeKey` um Mellotron-Pfad erweitern

Datei: `js/test-ui.js`, Funktion `_toneTypeKey` (vor `_maybeExtendSlider`,
ca. Z. ?? — bitte per `grep -n "_toneTypeKey" js/test-ui.js` lokalisieren).

Die heutige Funktion mappt eine Tonart auf einen i18n-Key. Am Ende, vor
dem `return null;` (oder analog dem Default-Return), folgenden Fallback
einfügen:

```js
// BA 231: smplr-Tonarten ueber die GROUPS-Tabelle in tone-popup.js aufloesen.
if (typeof tt === 'string'
    && tt.indexOf('smplr:') === 0
    && typeof window.toneTypeI18nKey === 'function') {
  var k = window.toneTypeI18nKey(tt);
  if (k) return k;
}
```

Dadurch löst der Header-Button-Text auch für Mellotron-Tonarten auf den
richtigen i18n-Key auf und folgt dem Sprachwechsel.

`_tpUpdateLabel` in `test-ui.js` Z. 1014–1031 muß **nicht** geändert
werden — die Funktion ruft `_toneTypeKey(tt)`, das jetzt für Mellotron
einen Key liefert, und nimmt damit den i18n-Pfad statt des Token-
Fallbacks (Z. 1025–1029).

---

## 3. i18n — Mellotron-Gruppen und Items

Pro Sprachdatei (`i18n/de.js`, `en.js`, `fr.js`, `es.js`) folgenden
Block einfügen. Position: nahe den anderen `toneGroup*`-Strings (in
`de.js` ist das z. B. ab Z. 1086). Die heutigen Keys `toneGroupMellotron`
und `toneGroupMellotronHint` können **bleiben** (werden nicht mehr
gerendert, schaden aber nicht).

### 3.1 `i18n/de.js`

```js
    // BA 231: Mellotron-Untergruppen nach Modell
    toneGroupSmplrM300:           "Mellotron M300",
    toneGroupSmplrM300Hint:       "Strings-Bank aus dem Mellotron M300.",
    toneGroupSmplrMk2:            "Mellotron Mark II",
    toneGroupSmplrMk2Hint:        "Bänke aus dem zweimanualigen Mark-II-Mellotron.",
    toneGroupSmplrTron:           "Mellotron M400 (Tron)",
    toneGroupSmplrTronHint:       "Klassische M400-Bänke.",
    toneGroupSmplrChamberlin:     "Chamberlin",
    toneGroupSmplrChamberlinHint: "Bänke des Mellotron-Vorgängers Chamberlin.",
    toneGroupSmplrMixed:          "Mellotron-Mischbänke",
    toneGroupSmplrMixedHint:      "Begleit-Bänke und Sonderformen.",

    // BA 231: Mellotron-Item-Labels (Instrument in Landessprache + Modell-Tag)
    toneSmplrM300Cello:           "Cello (M300)",
    toneSmplrM300Viola:           "Bratsche (M300)",
    toneSmplrMk2Brass:            "Blechbläser (MK II)",
    toneSmplrMk2Guitar:           "Gitarre (MK II)",
    toneSmplrMk2Organ:            "Orgel (MK II)",
    toneSmplrMk2Sax:              "Saxophon (MK II)",
    toneSmplrMk2Vibes:            "Vibraphon (MK II)",
    toneSmplrMk2Violins:          "Violinen (MK II)",
    toneSmplrTron16Violins:       "16 Violinen (Tron)",
    toneSmplrTronViola:           "Bratsche (Tron)",
    toneSmplrTronCello:           "Cello (Tron)",
    toneSmplrTronFlute:           "Flöte (Tron)",
    toneSmplrChmb3Violins:        "3 Violinen (Chamberlin)",
    toneSmplrChmbAltoSax:         "Altsaxophon (Chamberlin)",
    toneSmplrChmbCello:           "Cello (Chamberlin)",
    toneSmplrChmbFlute:           "Flöte (Chamberlin)",
    toneSmplrChmbFemale:          "Frauenstimme (Chamberlin)",
    toneSmplrChmbClarinet:        "Klarinette (Chamberlin)",
    toneSmplrChmbMale:            "Männerstimme (Chamberlin)",
    toneSmplrChmbOboe:            "Oboe (Chamberlin)",
    toneSmplrChmbTrombone:        "Posaune (Chamberlin)",
    toneSmplrChmbTenorSax:        "Tenorsaxophon (Chamberlin)",
    toneSmplrChmbTrumpet:         "Trompete (Chamberlin)",
    toneSmplrMixBassStrings:      "Baß + Streicher",
    toneSmplrMixMoveBassStrings:  "Bewegter Baß + Streicher",
    toneSmplrMixHalfSpeedBrass:   "Blechbläser (halbe Geschwindigkeit)",
    toneSmplrMixChaChaFlute:      "Cha-Cha-Flöte",
    toneSmplrMix8VoiceChoir:      "Chor (8-stimmig)",
    toneSmplrMixDixieTrombone:    "Dixie + Posaune",
    toneSmplrMixFoxtrotSax:       "Foxtrott + Saxophon",
    toneSmplrMixBoysChoir:        "Knabenchor",
    toneSmplrMixTromboneTrumpet:  "Posaune + Trompete",
    toneSmplrMixStringsBrass:     "Streicher + Blechbläser",
    toneSmplrMixMixedStrings:     "Streicher gemischt",
```

### 3.2 `i18n/en.js`

```js
    // BA 231: Mellotron sub-groups by model
    toneGroupSmplrM300:           "Mellotron M300",
    toneGroupSmplrM300Hint:       "Strings bank from the Mellotron M300.",
    toneGroupSmplrMk2:            "Mellotron Mark II",
    toneGroupSmplrMk2Hint:        "Banks from the double-manual Mark II Mellotron.",
    toneGroupSmplrTron:           "Mellotron M400 (Tron)",
    toneGroupSmplrTronHint:       "Classic M400 banks.",
    toneGroupSmplrChamberlin:     "Chamberlin",
    toneGroupSmplrChamberlinHint: "Banks of the Mellotron's predecessor, the Chamberlin.",
    toneGroupSmplrMixed:          "Mellotron mixed banks",
    toneGroupSmplrMixedHint:      "Accompaniment banks and specials.",

    // BA 231: Mellotron item labels
    toneSmplrM300Cello:           "Cello (M300)",
    toneSmplrM300Viola:           "Viola (M300)",
    toneSmplrMk2Brass:            "Brass (MK II)",
    toneSmplrMk2Guitar:           "Guitar (MK II)",
    toneSmplrMk2Organ:            "Organ (MK II)",
    toneSmplrMk2Sax:              "Saxophone (MK II)",
    toneSmplrMk2Vibes:            "Vibraphone (MK II)",
    toneSmplrMk2Violins:          "Violins (MK II)",
    toneSmplrTron16Violins:       "16 violins (Tron)",
    toneSmplrTronViola:           "Viola (Tron)",
    toneSmplrTronCello:           "Cello (Tron)",
    toneSmplrTronFlute:           "Flute (Tron)",
    toneSmplrChmb3Violins:        "3 violins (Chamberlin)",
    toneSmplrChmbAltoSax:         "Alto sax (Chamberlin)",
    toneSmplrChmbCello:           "Cello (Chamberlin)",
    toneSmplrChmbFlute:           "Flute (Chamberlin)",
    toneSmplrChmbFemale:          "Female voice (Chamberlin)",
    toneSmplrChmbClarinet:        "Clarinet (Chamberlin)",
    toneSmplrChmbMale:            "Male voice (Chamberlin)",
    toneSmplrChmbOboe:            "Oboe (Chamberlin)",
    toneSmplrChmbTrombone:        "Trombone (Chamberlin)",
    toneSmplrChmbTenorSax:        "Tenor sax (Chamberlin)",
    toneSmplrChmbTrumpet:         "Trumpet (Chamberlin)",
    toneSmplrMixBassStrings:      "Bass + strings",
    toneSmplrMixMoveBassStrings:  "Moving bass + strings",
    toneSmplrMixHalfSpeedBrass:   "Brass (half speed)",
    toneSmplrMixChaChaFlute:      "Cha-cha flute",
    toneSmplrMix8VoiceChoir:      "Choir (8 voices)",
    toneSmplrMixDixieTrombone:    "Dixie + trombone",
    toneSmplrMixFoxtrotSax:       "Foxtrot + sax",
    toneSmplrMixBoysChoir:        "Boys choir",
    toneSmplrMixTromboneTrumpet:  "Trombone + trumpet",
    toneSmplrMixStringsBrass:     "Strings + brass",
    toneSmplrMixMixedStrings:     "Mixed strings",
```

### 3.3 `i18n/fr.js`

```js
    // BA 231: Sous-groupes Mellotron par modèle
    toneGroupSmplrM300:           "Mellotron M300",
    toneGroupSmplrM300Hint:       "Banque de cordes du Mellotron M300.",
    toneGroupSmplrMk2:            "Mellotron Mark II",
    toneGroupSmplrMk2Hint:        "Banques du Mellotron Mark II à deux manuels.",
    toneGroupSmplrTron:           "Mellotron M400 (Tron)",
    toneGroupSmplrTronHint:       "Banques M400 classiques.",
    toneGroupSmplrChamberlin:     "Chamberlin",
    toneGroupSmplrChamberlinHint: "Banques du prédécesseur du Mellotron, le Chamberlin.",
    toneGroupSmplrMixed:          "Banques mélangées du Mellotron",
    toneGroupSmplrMixedHint:      "Banques d'accompagnement et formes particulières.",

    // BA 231: Étiquettes des banques Mellotron
    toneSmplrM300Cello:           "Violoncelle (M300)",
    toneSmplrM300Viola:           "Alto (M300)",
    toneSmplrMk2Brass:            "Cuivres (MK II)",
    toneSmplrMk2Guitar:           "Guitare (MK II)",
    toneSmplrMk2Organ:            "Orgue (MK II)",
    toneSmplrMk2Sax:              "Saxophone (MK II)",
    toneSmplrMk2Vibes:            "Vibraphone (MK II)",
    toneSmplrMk2Violins:          "Violons (MK II)",
    toneSmplrTron16Violins:       "16 violons (Tron)",
    toneSmplrTronViola:           "Alto (Tron)",
    toneSmplrTronCello:           "Violoncelle (Tron)",
    toneSmplrTronFlute:           "Flûte (Tron)",
    toneSmplrChmb3Violins:        "3 violons (Chamberlin)",
    toneSmplrChmbAltoSax:         "Saxophone alto (Chamberlin)",
    toneSmplrChmbCello:           "Violoncelle (Chamberlin)",
    toneSmplrChmbFlute:           "Flûte (Chamberlin)",
    toneSmplrChmbFemale:          "Voix féminine (Chamberlin)",
    toneSmplrChmbClarinet:        "Clarinette (Chamberlin)",
    toneSmplrChmbMale:            "Voix masculine (Chamberlin)",
    toneSmplrChmbOboe:            "Hautbois (Chamberlin)",
    toneSmplrChmbTrombone:        "Trombone (Chamberlin)",
    toneSmplrChmbTenorSax:        "Saxophone ténor (Chamberlin)",
    toneSmplrChmbTrumpet:         "Trompette (Chamberlin)",
    toneSmplrMixBassStrings:      "Basse + cordes",
    toneSmplrMixMoveBassStrings:  "Basse mouvante + cordes",
    toneSmplrMixHalfSpeedBrass:   "Cuivres (demi-vitesse)",
    toneSmplrMixChaChaFlute:      "Flûte cha-cha",
    toneSmplrMix8VoiceChoir:      "Chœur (8 voix)",
    toneSmplrMixDixieTrombone:    "Dixie + trombone",
    toneSmplrMixFoxtrotSax:       "Foxtrot + saxophone",
    toneSmplrMixBoysChoir:        "Chœur de garçons",
    toneSmplrMixTromboneTrumpet:  "Trombone + trompette",
    toneSmplrMixStringsBrass:     "Cordes + cuivres",
    toneSmplrMixMixedStrings:     "Cordes mélangées",
```

### 3.4 `i18n/es.js`

```js
    // BA 231: Subgrupos Mellotron por modelo
    toneGroupSmplrM300:           "Mellotron M300",
    toneGroupSmplrM300Hint:       "Banco de cuerdas del Mellotron M300.",
    toneGroupSmplrMk2:            "Mellotron Mark II",
    toneGroupSmplrMk2Hint:        "Bancos del Mellotron Mark II de doble teclado.",
    toneGroupSmplrTron:           "Mellotron M400 (Tron)",
    toneGroupSmplrTronHint:       "Bancos M400 clásicos.",
    toneGroupSmplrChamberlin:     "Chamberlin",
    toneGroupSmplrChamberlinHint: "Bancos del predecesor del Mellotron, el Chamberlin.",
    toneGroupSmplrMixed:          "Bancos mezclados de Mellotron",
    toneGroupSmplrMixedHint:      "Bancos de acompañamiento y casos especiales.",

    // BA 231: Etiquetas de bancos Mellotron
    toneSmplrM300Cello:           "Violonchelo (M300)",
    toneSmplrM300Viola:           "Viola (M300)",
    toneSmplrMk2Brass:            "Metales (MK II)",
    toneSmplrMk2Guitar:           "Guitarra (MK II)",
    toneSmplrMk2Organ:            "Órgano (MK II)",
    toneSmplrMk2Sax:              "Saxofón (MK II)",
    toneSmplrMk2Vibes:            "Vibráfono (MK II)",
    toneSmplrMk2Violins:          "Violines (MK II)",
    toneSmplrTron16Violins:       "16 violines (Tron)",
    toneSmplrTronViola:           "Viola (Tron)",
    toneSmplrTronCello:           "Violonchelo (Tron)",
    toneSmplrTronFlute:           "Flauta (Tron)",
    toneSmplrChmb3Violins:        "3 violines (Chamberlin)",
    toneSmplrChmbAltoSax:         "Saxo alto (Chamberlin)",
    toneSmplrChmbCello:           "Violonchelo (Chamberlin)",
    toneSmplrChmbFlute:           "Flauta (Chamberlin)",
    toneSmplrChmbFemale:          "Voz femenina (Chamberlin)",
    toneSmplrChmbClarinet:        "Clarinete (Chamberlin)",
    toneSmplrChmbMale:            "Voz masculina (Chamberlin)",
    toneSmplrChmbOboe:            "Oboe (Chamberlin)",
    toneSmplrChmbTrombone:        "Trombón (Chamberlin)",
    toneSmplrChmbTenorSax:        "Saxo tenor (Chamberlin)",
    toneSmplrChmbTrumpet:         "Trompeta (Chamberlin)",
    toneSmplrMixBassStrings:      "Bajo + cuerdas",
    toneSmplrMixMoveBassStrings:  "Bajo en movimiento + cuerdas",
    toneSmplrMixHalfSpeedBrass:   "Metales (media velocidad)",
    toneSmplrMixChaChaFlute:      "Flauta cha-cha",
    toneSmplrMix8VoiceChoir:      "Coro (8 voces)",
    toneSmplrMixDixieTrombone:    "Dixie + trombón",
    toneSmplrMixFoxtrotSax:       "Foxtrot + saxofón",
    toneSmplrMixBoysChoir:        "Coro de niños",
    toneSmplrMixTromboneTrumpet:  "Trombón + trompeta",
    toneSmplrMixStringsBrass:     "Cuerdas + metales",
    toneSmplrMixMixedStrings:     "Cuerdas mezcladas",
```

Hinweis: Alle Strings nutzen doppelte ASCII-Quotes als Stringbegrenzer.
Innerhalb keiner Bezeichnung kommt ein ASCII-`"` vor — die Quote-Zählung
ist sauber. Diakritische Zeichen (ü, ö, ä, ß, ç, ñ, Œ, é, …) sind im
UTF-8-Dateiformat erlaubt und im Projekt etabliert (siehe vorhandene
Strings).

---

## 4. CODESTRUKTUR aktualisieren

Datei: `docs/CODESTRUKTUR.md`.

Im Eintrag zu `js/tone-popup.js` einen kurzen Absatz mit
„**Seit BA 231**: …" ergänzen: GROUPS um Mellotron erweitert auf fünf
Untergruppen (M300, MK II, Tron, Chamberlin, Mischbänke); globaler
Helfer `window.toneTypeI18nKey(tt)` für i18n-Lookup über die GROUPS-
Tabelle.

Im Eintrag zu `js/test-ui.js` einen Halbsatz nachziehen: `_toneTypeKey`
löst smplr-Tonarten zusätzlich über `window.toneTypeI18nKey` auf.

---

## 5. Akzeptanztest

1. Tab **Messungen** → Sub-Reiter **Frequenzabgleich** öffnen, Tonart-
   Button anklicken. → Modal öffnet sich.
2. Bis runterscrollen zur Mellotron-Sektion. Erwartet: fünf Untergruppen
   nacheinander, jede mit eigener Überschrift und Hint:
   - „Mellotron M300" (2 Buttons: „Bratsche (M300)", „Cello (M300)")
   - „Mellotron Mark II" (6 Buttons)
   - „Mellotron M400 (Tron)" (4 Buttons)
   - „Chamberlin" (11 Buttons)
   - „Mellotron-Mischbänke" (11 Buttons)
3. Innerhalb jeder Untergruppe Buttons alphabetisch (z. B. Chamberlin:
   „3 Violinen", „Altsaxophon", „Cello", „Flöte", „Frauenstimme",
   „Klarinette", „Männerstimme", „Oboe", „Posaune", „Tenorsaxophon",
   „Trompete").
4. Auf „Cello (Tron)" klicken. → Button wird hervorgehoben, Sanduhr
   erscheint (sofern noch nicht geladen), Sequenz spielt nach Laden.
   OK drücken. → Tonart-Button im Header zeigt jetzt „Cello (Tron)".
5. Sprache umschalten auf Englisch. → Tonart-Button im Header zeigt
   „Cello (Tron)" (unverändert in EN). Modal erneut öffnen: Mellotron-
   Sektionen mit englischen Überschriften und Bezeichnungen.
6. Sprache Französisch / Spanisch testen: Modal-Inhalt komplett in
   jeweiliger Sprache.
7. Frequenzabgleich starten, Klavier-Taste anschlagen. → Anschlag spielt
   mit der ausgewählten Mellotron-Bank (kein Stille-Bug, kein Sinus-Bug).

---

## 6. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen und
melden: erfüllt / nicht erfüllt / unklar (mit Datei- und Zeilenangabe).

Zusätzlich:
- Alle 34 `smplr:mellotron:<token>`-Keys sind in der neuen GROUPS-
  Struktur **vorhanden** (nicht versehentlich einer verlorengegangen).
- Die Original-Token-Strings sind zeichengenau wie heute (z. B.
  `300 STRINGS CELLO`, `CHMB 3 VLNS`, `MOVE BS+STGS`). Vergleich gegen
  Z. 98–131 der heutigen `tone-popup.js`.
- Pro Sprachdatei: alle 34 Item-Keys + 10 Gruppen-Keys vorhanden.
  Quick-Check pro Datei: `grep -c "toneSmplr" i18n/de.js` muß ≥ 34
  liefern (10 Gruppen-Keys + 34 Items = 44, je Datei).
- `GROUPS` wurde aus der Funktion herausgezogen — `grep -n "var GROUPS"
  js/tone-popup.js` liefert genau eine Zeile im Datei-Scope, nicht
  innerhalb von `openToneSelectionDialog`.
- `window.toneTypeI18nKey` ist im Browser-Konsolen-Quick-Check
  erreichbar: `typeof toneTypeI18nKey === 'function'` muß `true`
  ergeben.
- `_toneTypeKey` in `test-ui.js` enthält den neuen smplr-Pfad und ruft
  `window.toneTypeI18nKey(tt)`.

---

## 7. Was sich NICHT ändert

- Die Sampler-Keys (`smplr:mellotron:<token>`) bleiben zeichengenau —
  damit funktioniert `loadSamplerByToken`, `smplrSamplerIsReady` etc.
  weiter ohne Anpassung.
- Die alten Keys `toneGroupMellotron` / `toneGroupMellotronHint` in
  den i18n-Dateien bleiben stehen (toter Code im i18n-Inventar, aber
  schadlos). Wenn Sonnet sie entfernt, ist das ebenfalls okay —
  Entscheidung Sonnet überlassen.
- `freqmatch.js` bleibt unangetastet.
- `sampler-keyboard.js` bleibt unangetastet.
