# BAUANLEITUNG 136 — Cochlear-Default-FAT-Korrektur

## Ziel

Die Cochlear-Default-Frequenzen in `MFR.cochlear.freqs` (core.js)
auf die offiziellen Cochlear-Standard-FAT-Werte korrigieren
(Quelle: CI Select App Manual S. 12/13 und PMC11493529). Die
bisherigen Code-Werte aus einer unklaren Quelle weichen ab
Position 9 systematisch nach oben ab (bis zu ~125 Cent an E1
basal).

Zusätzlich eine sanfte Info-Box im Frequenzabgleich-Reiter
einblenden, die Cochlear-User mit vorhandenen Tests von **vor**
der Korrektur darauf hinweist, dass ihre alten Ergebnisse sich
auf abweichende Default-Annahmen beziehen.

`fRes`-Einträge werden **nicht** migriert — die gespeicherten
`varFreq`/`refFreq` waren die tatsächlich gespielten Frequenzen
beim Test und dürfen nicht zu erfundenen Werten geändert werden.

## Begründung

Konzeptphase (Recherche `.manuals/Recherche_CI_Select_App.md`,
`.manuals/Recherche_Cochlear_FAT_Deaktivierung.md`): zwei
unabhängige Quellen belegen die offizielle Cochlear-Standard-FAT
bei LFE 188 Hz, HFE 7938 Hz, 22 Kanälen. Die im Code stehenden
Werte (HFE 8000 Hz) lassen sich aus den dokumentierten LFE/HFE-
Optionen nicht rückleiten und entstammen vermutlich einer
älteren oder vereinfachten Quelle.

Konsequenz für `fRes`: die Cent-Differenz `fmCents(varFreq,
refFreq)` aus einem alten Eintrag bezieht sich auf den damaligen
Default. Bei korrigiertem Default ist diese Cent-Aussage gegen
die jetzt angenommene FAT verschoben. Da der korrekte Cent-
Versatz unter zentraler FAT-Adaption als physiologische Größe
gilt, wäre ein Re-Test nach Korrektur die ehrliche Antwort —
nicht eine Datenmanipulation.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.135-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.136-beta";
```

---

## Korrektur in `js/core.js`

### Stelle 1 — MFR.cochlear.freqs

In der Konstante `MFR` (ab Zeile 173) den `cochlear`-Block.
**Aktuell** (Zeilen 189–197):

```js
  cochlear: {
    name: "Cochlear",
    n: 22,
    apFirst: false,
    freqs: [
      250, 375, 500, 625, 750, 875, 1000, 1125, 1250, 1500, 1750, 2000, 2250,
      2625, 3000, 3500, 4000, 4625, 5250, 6000, 6875, 8000,
    ],
  },
```

**Ersetzen durch** (Werte aus CI Select App Manual S. 12/13;
Position 0–8 unverändert, Position 9–21 korrigiert):

```js
  cochlear: {
    name: "Cochlear",
    n: 22,
    apFirst: false,
    // Standard-FAT bei LFE 188 Hz, HFE 7938 Hz, 22 aktiven
    // Kanälen. Quelle: CI Select App Manual S. 12/13 (NYU
    // Langone, Svirsky-Labor) und PMC11493529. Korrigiert in
    // BA 136 — vorher waren die Werte ab Position 9 aus
    // unbekannter Quelle und wichen bis zu ~125 Cent an E1
    // (basal) ab. Siehe .manuals/Recherche_CI_Select_App.md
    // und .manuals/Recherche_Cochlear_FAT_Deaktivierung.md.
    freqs: [
      250, 375, 500, 625, 750, 875, 1000, 1125, 1250, 1438, 1688, 1938, 2188,
      2500, 2875, 3313, 3813, 4375, 5000, 5688, 6500, 7438,
    ],
  },
```

### Stelle 2 — Korrekturdatums-Konstante

Direkt **nach** dem `MFR`-Block (also nach der schließenden
Klammer von `MFR`) folgende globale Konstante einfügen:

```js
// Datum der Cochlear-FAT-Default-Korrektur (BA 136).
// Vergleichsmaßstab für fRes-Einträge: Einträge mit
// timestamp < diesem Wert wurden vor der Korrektur gemessen
// und beziehen sich auf eine abweichende Default-Annahme
// (HFE 8000 statt 7938 Hz). Wird in freqmatch.js für die
// Info-Box-Anzeige gelesen.
const COCHLEAR_FAT_CORRECTION_DATE = Date.UTC(2026, 4, 31); // 2026-05-31 UTC
```

---

## Info-Box im Frequenzabgleich-Reiter

### Neue Funktionen in `js/freqmatch.js`

Im Modul-Header-Bereich (nahe den anderen Hilfsfunktionen wie
`fmCents`, also nach Zeile 105) folgende beiden Funktionen
einfügen:

```js
function _fmShouldShowCochlearFatHint() {
  if (typeof fRes === 'undefined' || !Array.isArray(fRes)) return false;
  if (typeof sideData === 'undefined') return false;
  if (typeof COCHLEAR_FAT_CORRECTION_DATE !== 'number') return false;
  for (let i = 0; i < fRes.length; i++) {
    const e = fRes[i];
    if (!e || typeof e.timestamp !== 'number') continue;
    if (e.timestamp >= COCHLEAR_FAT_CORRECTION_DATE) continue;
    const sd = sideData[e.varSide];
    if (sd && sd.manufacturer === 'cochlear') return true;
  }
  return false;
}

function _fmRenderCochlearFatHint() {
  if (!_fmParentEl) return;
  const show = _fmShouldShowCochlearFatHint();
  let hint = document.getElementById('fmCochlearFatHint');

  if (!show) {
    if (hint) hint.remove();
    return;
  }

  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'fmCochlearFatHint';
    hint.className = 'info-box info-box-warn';
    hint.style.marginBottom = '14px';
    _fmParentEl.insertBefore(hint, _fmParentEl.firstChild);
  }
  const d = new Date(COCHLEAR_FAT_CORRECTION_DATE);
  // YYYY-MM-DD, UTC.
  const dateStr = d.getUTCFullYear() + '-'
    + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
    + String(d.getUTCDate()).padStart(2, '0');
  const txt = (typeof t === 'function') ? t('fmCochlearFatCorrectionInfo')
    : 'Cochlear-FAT wurde korrigiert.';
  hint.textContent = txt.replace('{date}', dateStr);
}
```

### Aufrufe einfügen

**Stelle A**: in der `DOMContentLoaded`-Handler-Funktion von
`freqmatch.js` (die mit `_fmParentEl = parentEl;` beginnt),
**nach** dem Aufruf, der den testUI-Aufbau abschließt (also
vor dem schließenden `});` des DOMContentLoaded-Blocks),
folgende Zeile einfügen:

```js
  _fmRenderCochlearFatHint();
```

**Stelle B**: in der `fmApplyLang`-Funktion am Ende, vor dem
schließenden `}`:

```js
  _fmRenderCochlearFatHint();
```

So wird die Box bei jedem Sprachwechsel und beim Tab-Aufbau
neu evaluiert. Side- oder Hersteller-Wechsel während des
laufenden Tabs sind ein seltener Edge-Case; die nächste
`fmApplyLang`-Auslösung holt das nach.

---

## i18n-Key in `i18n/de.js`

In der freqmatch-Key-Gruppe (in der Nähe von `fmTitle`,
`fmHintMethod` etc.) folgenden Key einfügen:

```js
    fmCochlearFatCorrectionInfo: "Die Cochlear-Default-FAT wurde am {date} auf die offiziellen Werte (CI Select / Custom Sound Pro Standard, HFE 7938 Hz) korrigiert. Cochlear-Frequenztests von vor diesem Datum beziehen sich auf eine abweichende Default-Annahme — für eine aktuelle Korrekturkurve bitte den Test wiederholen.",
```

**Nur Deutsch.** en/fr/es kommen in der späteren Sammel-
Übersetzungs-Anleitung.

---

## CSS — keine Änderung

Die Klassen `info-box` und `info-box-warn` existieren bereits
in `style.css` (z. B. für die Latenz-Warnung). Keine neue
Regel nötig.

---

## Cochlear-Lookup-Datendatei — Hinweis-Update

In `js/data/cochlear-fats.js` (BA 135) den Quellenkommentar
ergänzen — die Werte stimmen jetzt **identisch** mit
`MFR.cochlear.freqs` überein. Im Header-Kommentar folgenden
Zusatz ergänzen:

```js
// Seit BA 136: Werte stimmen mit MFR.cochlear.freqs (core.js)
// überein. Die Datei bleibt als eigenständige Quelle erhalten,
// weil sie in BA 137 ff. um weitere Tabellen (reduzierte
// Elektrodenzahlen, alternative LFE/HFE) erweitert wird, die
// in MFR nicht abgebildet sind.
```

**Keine Änderung der Werte** in `cochlear-fats.js` — sie waren
bereits korrekt aus CI Select übernommen. Nur der
Quellenkommentar wird ergänzt.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Im Abschnitt zur Plausibilitätsprüfung am Ende den Hinweis
ergänzen:

```markdown
### Cochlear-Default-Korrektur (BA 136)

`MFR.cochlear.freqs` in `js/core.js` wurde am 2026-05-31 auf
die offiziellen Werte aus dem CI Select App Manual (LFE 188 Hz,
HFE 7938 Hz, 22 Kanäle) korrigiert. Positionen 0–8 unverändert,
9–21 verschoben um bis zu ~125 Cent (max bei E1 basal).

Gespeicherte `fRes`-Einträge mit `timestamp` vor der
Korrektur-Konstante `COCHLEAR_FAT_CORRECTION_DATE` beziehen
sich auf die alten Defaults. Im Frequenzabgleich-Reiter wird
für Cochlear-User mit solchen Einträgen eine sanfte Info-Box
oben angezeigt, die zum Re-Test rät.
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `core.js` ergänzen: neue Konstante
`COCHLEAR_FAT_CORRECTION_DATE` (Date.UTC-Timestamp);
`MFR.cochlear.freqs` Position 9–21 in BA 136 korrigiert auf
offizielle Cochlear-Standard-FAT-Werte (CI Select Manual).

Im Eintrag zu `freqmatch.js` ergänzen: neue interne Funktionen
`_fmShouldShowCochlearFatHint` und `_fmRenderCochlearFatHint`;
DOM-Element `#fmCochlearFatHint` (info-box-warn) wird per JS
oben in `_fmParentEl` eingefügt, nur sichtbar bei Cochlear-
`fRes`-Einträgen mit timestamp < `COCHLEAR_FAT_CORRECTION_DATE`.
Aufrufer in `DOMContentLoaded` und `fmApplyLang`.

---

## Akzeptanztest

Im Browser durchgehen — alle Schritte müssen erfüllt sein:

1. **Konsolen-Test der neuen Defaults**: in der Browser-Konsole
   `MFR.cochlear.freqs` eingeben — Ausgabe muss die korrigierten
   Werte enthalten, insbesondere `7438` als letzten Wert
   (nicht mehr `8000`).
2. **Hz-Standard-Spalte (Cochlear)**: Hersteller auf Cochlear
   stellen. In der Frequenz-/Elektrodentabelle sollte z. B. bei
   E13 in der Spalte „Hz Standard" jetzt `1438` stehen (vorher
   `1500`), bei E1 `7438` (vorher `8000`). Positionen E22–E14
   unverändert (250, 375, …, 1250).
3. **Audio-Test**: Cochlear, Play-Button bei E1 → spielt 7438 Hz
   statt 8000 Hz. Akustisch kaum wahrnehmbarer Unterschied
   (~125 Cent ≈ 1 Halbton), aber Konsolen-Log (sofern aktiv)
   bestätigt die neue Frequenz.
4. **Cochlear-Lookup-Konsistenz (BA 135)**: alle Hz-eigen
   leeren, nur Defaults wirken. Erwartung: keine Lookup-Warnung,
   weil Default = Tabellenwert. (Vor der Korrektur hätte BA 135
   bei E13–E22 keine Warnung gezeigt, weil die Prüfung nur
   User-Override betrifft — Default-Korrektur ändert daran
   nichts, aber die Konsistenz Tabelle↔Default ist jetzt
   sichtbar.)
5. **MED-EL und AB unverändert**: Hersteller umstellen, Hz-
   Standard-Spalte enthält die unveränderten MED-EL-/AB-Werte.
6. **Info-Box ohne alte fRes-Einträge**: solange keine fRes-
   Einträge existieren oder alle existierenden ein `timestamp`
   ≥ `COCHLEAR_FAT_CORRECTION_DATE` haben, ist die Info-Box im
   Frequenzabgleich-Reiter **nicht** sichtbar.
7. **Info-Box mit altem Eintrag** (synthetischer Test, weil
   ohne echten alten Test schwer zu erzeugen): in der
   Browser-Konsole

   ```js
   fRes.push({ varSide: 'right', refSide: 'left', elIdx: 10,
     varFreq: 2000, refFreq: 2200, timestamp: Date.UTC(2026, 0, 1) });
   ```

   eingeben, dann Hersteller auf Cochlear setzen und in den
   Frequenzabgleich-Reiter wechseln (oder Sprache wechseln,
   um Re-Render auszulösen). Erwartung: oben im Reiter eine
   gelbe Info-Box mit dem Korrektur-Hinweis und dem Datum
   2026-05-31.
8. **Info-Box bei Hersteller-Wechsel auf MED-EL**: nach
   Schritt 7 das aktive `varSide` auf eine MED-EL-Seite
   stellen, dann Frequenzabgleich-Reiter neu öffnen oder
   Sprache wechseln. Erwartung: Info-Box **verschwindet**
   (kein Cochlear mehr).
9. **Sprachwechsel**: Englisch → Deutsch (mit dem synthetischen
   Eintrag aus Schritt 7). Info-Box-Text bleibt in Deutsch
   (en zeigt den deutschen Default-Text, wie in den
   vorherigen BAs).
10. **Aufräumen** nach Test: `fRes.length = 0;` in der Konsole,
    oder über die normale Daten-Reset-Funktion. Info-Box muss
    nach erneutem Aufruf von `_fmRenderCochlearFatHint()`
    verschwinden.
11. **Konsole**: keine neuen Fehler oder Warnungen beim Laden
    oder während der Tests.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der elf Akzeptanzpunkte einzeln
durchgehen und für jeden melden: erfüllt / nicht erfüllt /
unklar, mit Datei- und Zeilenangabe. Bei „unklar" Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "8000" js/core.js` → der Wert `8000` darf in
  `MFR.cochlear.freqs` **nicht** mehr vorkommen.
- `grep -n "7438" js/core.js` → mindestens ein Treffer am
  Ende des Cochlear-`freqs`-Arrays.
- `grep -n "COCHLEAR_FAT_CORRECTION_DATE" js/core.js` → genau
  ein Treffer (Definition).
- `grep -n "COCHLEAR_FAT_CORRECTION_DATE" js/freqmatch.js` →
  mindestens ein Treffer (Nutzung in `_fmShouldShowCochlearFatHint`).
- `grep -n "_fmRenderCochlearFatHint" js/freqmatch.js` →
  drei Treffer (Definition + zwei Aufrufer).
- `grep -n "fmCochlearFatCorrectionInfo" i18n/de.js` → ein
  Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.136-beta"`.

**Vier-Augen-Check für Tabellenwerte** (Lessons learned):

- Die korrigierten 22 Werte (250, 375, 500, 625, 750, 875,
  1000, 1125, 1250, **1438, 1688, 1938, 2188, 2500, 2875,
  3313, 3813, 4375, 5000, 5688, 6500, 7438**) in genau dieser
  Reihenfolge in `MFR.cochlear.freqs`.
- Die Werte stimmen identisch mit
  `COCHLEAR_FATS.standard_22_lfe188_hfe7938` aus
  `js/data/cochlear-fats.js` überein (Vergleich beider Arrays).
- `COCHLEAR_FAT_CORRECTION_DATE` ist `Date.UTC(2026, 4, 31)` —
  also der 31. Mai 2026 UTC. Monatsindex ist nullbasiert (4 = Mai).

---

## Hinweise

- Diese Anleitung ist eine **Korrektur eines bestehenden
  Standard-Datensatzes**, kein Feature-Bau. Mit Bedacht prüfen,
  ob nach dem Build die Werte überall in der UI korrekt
  ankommen — die Hz-Standard-Spalte ist der direkteste
  Indikator.
- **Risiko: User mit existierenden Cochlear-fRes-Einträgen.**
  Die Info-Box adressiert diesen Fall. Eine automatische
  Migration der fRes-Einträge wurde bewusst abgelehnt, weil
  weder `refFreq` (= tatsächlich damals gespielte Frequenz)
  noch `varFreq` (= tatsächlich damals gefundener Match)
  zu erfundenen Werten geändert werden dürfen.
- **Kein Bau-Diagnose-Test nötig** — Akzeptanz ist über die
  Hz-Standard-Spalte direkt visuell prüfbar; der synthetische
  fRes-Test in Schritt 7 fängt die Info-Box-Logik.
- Nach dieser Anleitung geht es mit BA 137 weiter (MED-EL/AB
  Trend + lokale Sprünge, ursprünglich als BA 136 geplant).
- **Hinweis auf spätere Übersetzungs-Anleitung**: der neue
  i18n-Key `fmCochlearFatCorrectionInfo` wird am Ende der
  BA-Reihe zusammen mit den anderen neuen Keys in en/fr/es
  nachgezogen.
