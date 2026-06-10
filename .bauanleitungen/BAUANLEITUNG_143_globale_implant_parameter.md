# BAUANLEITUNG 143 — Globale Implantat-Parameter

## Ziel

Plausibilitätsprüfung der drei globalen Implantat-Parameter pro
Hersteller:

- **c-Wert** (MED-EL): MAPLAW-Kompressionskoeffizient,
  Software-Range 0–8000, Default 500, typischer Audiologen-
  Wahlbereich ~100–2000.
- **IDR** (Advanced Bionics): Input Dynamic Range in dB,
  Software-Range 20–80 dB, Default 60 dB, typisch 40–70 dB.
- **IIDR** (Cochlear): Input Instantaneous Dynamic Range in dB,
  Default 40 dB, typisch 30–60 dB.

Zwei Auffälligkeitsstufen pro Parameter:

- **Hardware-Range** (Level 1 rot): außerhalb des
  Software-Bereichs.
- **Typischer Bereich** (Level 3 gelb): innerhalb Software-,
  aber außerhalb typischen Audiologen-Bereichs.

Eingaben werden **nur geprüft, wenn gesetzt** (`!= null`).
Leerfelder lösen keine Warnung aus.

Zusätzlich **Schema-Erweiterung in `_implApplyFieldLevel`**: die
seit BA 133 im Header dokumentierte `globalEl`-Variante wird
jetzt erstmals tatsächlich gerendert — neuer Helfer
`_implGlobalSelector` für `#implC`, `#implIDR`, `#implIIDR`.

Setzt auf BA 133–141 auf.

## Begründung

Globale Parameter beeinflussen die dB→Hersteller-Einheit-
Umrechnung im Druck (`calcMedel`, `calcCochlear`, `calcAB` in
`core.js`). Ein versehentlich falsch eingegebener c-Wert oder
IDR verfälscht alle abgeleiteten Audiologen-Empfehlungen, ohne
dass die Tabelle selbst auffällig wäre. Eine eigene Prüfung ist
deshalb sinnvoll.

Schwellwerte:

- c-Wert Software-Range aus `Berechnungsgrundlagen dB zu CI.md`
  Kap. 3.2 (Boyd 2006: c ∈ [0, 8000]). Typischer
  Audiologen-Bereich aus klinischer Praxis und MAESTRO-Defaults.
- IDR Software-Range aus
  `Berechnungsgrundlagen dB zu CI.md` Kap. 5.2 (Holden 2011:
  IDR einstellbar 20–80 dB, Default 60).
- IIDR-Default 40 dB ebenfalls aus Kap. 4.3. Software-Range
  öffentlich nicht hart dokumentiert; typischer Bereich
  konservativ 30–60.

---

## Pflichtschritt: Versions-Bump

In `js/version.js`:

```js
const APP_VERSION = "3.0.142-beta";
```

ersetzen durch:

```js
const APP_VERSION = "3.0.143-beta";
```

---

## Neue Konstanten in `js/implant-validate.js`

Direkt nach `IMPL_VAL_THR_UPPER_MIN_FOR_MAD` (letzte THR-Konstante
aus BA 138) folgenden Block einfügen:

```js
// Globale Implantat-Parameter — Plausibilitäts-Bereiche.
// Quellen: Berechnungsgrundlagen dB zu CI.md Kap. 3.2 (c-Wert),
// Kap. 5.2 (IDR), Kap. 4.3 (IIDR).
//   hardware: Software-Limits, außerhalb → Level 1 rot.
//   typical:  typischer Audiologen-Bereich, außerhalb → Level 3 gelb.
//   Default-Werte sind kommentiert, werden aber nicht direkt geprüft.
const IMPL_VAL_GLOBAL_C = {
  hardware: { min: 0,   max: 8000 }, // Default 500
  typical:  { min: 100, max: 2000 }
};
const IMPL_VAL_GLOBAL_IDR = {
  hardware: { min: 20, max: 80 },    // Default 60
  typical:  { min: 40, max: 70 }
};
const IMPL_VAL_GLOBAL_IIDR = {
  // IIDR hat keine öffentlich dokumentierte harte Software-Grenze.
  // Konservativ als Hardware-Range das volle plausible Spektrum,
  // typischer Bereich enger.
  hardware: { min: 10, max: 100 },   // Default 40
  typical:  { min: 30, max: 60  }
};
```

---

## Neuer Helfer in `js/implant-validate.js`

Nach `_implFieldSelector` (bestehender Helfer für Tabellenfelder)
folgenden zweiten Selector einfügen:

```js
function _implGlobalSelector(globalEl) {
  if (globalEl === 'c')    return '#implC';
  if (globalEl === 'idr')  return '#implIDR';
  if (globalEl === 'iidr') return '#implIIDR';
  return null;
}
```

---

## Schema-Erweiterung in `_implApplyFieldLevel`

Die bestehende Funktion (aktuell etwa Z. 164–188) **ergänzen**:
am Anfang einen `globalEl`-Pfad einbauen, bevor der vorhandene
`electrodeIdx`/`field`-Pfad startet.

**Aktuell:**

```js
function _implApplyFieldLevel(w) {
  if (w.electrodeIdx == null || !w.field) return;
  const fields = Array.isArray(w.field) ? w.field : [w.field];

  fields.forEach(function (field) {
    const sel = _implFieldSelector(w.electrodeIdx, field);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;

    // ... bestehende Mark-Logik ...
  });
}
```

**Ersetzen durch:**

```js
function _implApplyFieldLevel(w) {
  // Globale-Parameter-Pfad: markiert #implC / #implIDR / #implIIDR.
  if (w.globalEl) {
    const sel = _implGlobalSelector(w.globalEl);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    _implApplyLevelToElement(el, w);
    return;
  }

  // Tabellenfeld-Pfad: ein Warning kann mehrere Felder markieren.
  if (w.electrodeIdx == null || !w.field) return;
  const fields = Array.isArray(w.field) ? w.field : [w.field];
  fields.forEach(function (field) {
    const sel = _implFieldSelector(w.electrodeIdx, field);
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    _implApplyLevelToElement(el, w);
  });
}

// Setzt die strengste Stufe auf ein einzelnes Eingabefeld.
function _implApplyLevelToElement(el, w) {
  const currentLevel =
    el.classList.contains('impl-warn-red') ? 1 :
    el.classList.contains('impl-warn-orange') ? 2 :
    el.classList.contains('impl-warn-yellow') ? 3 : 99;
  if (w.level >= currentLevel) return;

  el.classList.remove('impl-warn-red', 'impl-warn-orange', 'impl-warn-yellow');
  const newClass =
    w.level === 1 ? 'impl-warn-red' :
    w.level === 2 ? 'impl-warn-orange' : 'impl-warn-yellow';
  el.classList.add(newClass);
  el.title = _implMsg(w);
}
```

Die innere Mark-Logik wandert in den neuen Helfer
`_implApplyLevelToElement`, weil sie sowohl für Tabellenfelder
als auch für globale Felder identisch ist.

---

## Neue Prüfungen in `js/implant-validate.js`

Nach `_implCheckFatOnDeactivation` (Ende der bestehenden Prüfungs-
Reihe) folgende drei Funktionen einfügen:

```js
function _implCheckGlobalCWert(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'medel' || !s.implant) return warnings;
  const v = s.implant.cValue;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_C.hardware;
  const tp = IMPL_VAL_GLOBAL_C.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'c',
      messageKey: 'implValidateCRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'c',
      messageKey: 'implValidateCRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}

function _implCheckGlobalIDR(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'ab' || !s.implant) return warnings;
  const v = s.implant.idr;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_IDR.hardware;
  const tp = IMPL_VAL_GLOBAL_IDR.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'idr',
      messageKey: 'implValidateIDRRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'idr',
      messageKey: 'implValidateIDRRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}

function _implCheckGlobalIIDR(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'cochlear' || !s.implant) return warnings;
  const v = s.implant.iidr;
  if (v == null || isNaN(v)) return warnings;

  const hw = IMPL_VAL_GLOBAL_IIDR.hardware;
  const tp = IMPL_VAL_GLOBAL_IIDR.typical;

  if (v < hw.min || v > hw.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_RED,
      globalEl: 'iidr',
      messageKey: 'implValidateIIDRRangeHard',
      messageParams: { val: v, min: hw.min, max: hw.max }
    });
  } else if (v < tp.min || v > tp.max) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      globalEl: 'iidr',
      messageKey: 'implValidateIIDRRangeTypical',
      messageParams: { val: v, min: tp.min, max: tp.max }
    });
  }
  return warnings;
}
```

---

## Aufrufe in `validateImplantTable`

Den bestehenden Aufruf-Block (zuletzt um die FAT-Sonderprüfung
ergänzt) um drei weitere Zeilen am Ende ergänzen:

```js
  warnings.push.apply(warnings, _implCheckFatOnDeactivation(s));
  warnings.push.apply(warnings, _implCheckGlobalCWert(s));
  warnings.push.apply(warnings, _implCheckGlobalIDR(s));
  warnings.push.apply(warnings, _implCheckGlobalIIDR(s));
```

---

## Re-Render auf Eingaben in die globalen Felder

Damit Warnungen direkt beim Ändern der globalen Felder
erscheinen (nicht erst beim nächsten Tabellen-Re-Render), in
`js/ui-implant.js` in den drei `onchange`-Handlern für `implC`,
`implIDR` und `implIIDR` jeweils am Ende einen Aufruf von
`validateImplantTable(activeSide)` ergänzen.

**Aktuell** (drei separate `onchange`-Setter etwa Z. 180–200):

```js
  const ci = document.getElementById("implC");
  if (ci)
    ci.onchange = function () {
      sideData[activeSide].implant.cValue =
        this.value !== "" ? parseFloat(this.value) : null;
      if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
      if (typeof pMaplawTrigger === "function" && pMaplawOn) pMaplawTrigger();
    };
  const ii = document.getElementById("implIDR");
  if (ii)
    ii.onchange = function () {
      sideData[activeSide].implant.idr =
        this.value !== "" ? parseFloat(this.value) : null;
    };
  const iii = document.getElementById("implIIDR");
  if (iii)
    iii.onchange = function () {
      sideData[activeSide].implant.iidr =
        this.value !== "" ? parseFloat(this.value) : null;
    };
```

**In allen drei Settern** jeweils **vor** dem schließenden `};`
folgende Zeile einfügen:

```js
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
```

---

## i18n-Keys in `i18n/de.js`

Nach `implValidateFatAb` (BA 141) folgende sechs Keys einfügen:

```js
    implValidateCRangeHard: "c-Wert ({val}) liegt außerhalb des Software-Bereichs ({min}–{max})",
    implValidateCRangeTypical: "c-Wert ({val}) liegt außerhalb des typischen Audiologen-Bereichs ({min}–{max}) — bitte prüfen",
    implValidateIDRRangeHard: "IDR ({val} dB) liegt außerhalb des Software-Bereichs ({min}–{max} dB)",
    implValidateIDRRangeTypical: "IDR ({val} dB) liegt außerhalb des typischen Bereichs ({min}–{max} dB) — Standard ist 60 dB",
    implValidateIIDRRangeHard: "IIDR ({val} dB) liegt außerhalb des plausiblen Bereichs ({min}–{max} dB)",
    implValidateIIDRRangeTypical: "IIDR ({val} dB) liegt außerhalb des typischen Bereichs ({min}–{max} dB) — Standard ist 40 dB",
```

**Nur Deutsch.** en/fr/es kommen in der finalen i18n-Anleitung.

---

## Spec-Pflege — `docs/spec/03-implantat.md`

Am Ende des Plausibilitäts-Abschnitts (nach „FAT-Sonderprüfung
bei Deaktivierung") folgenden Unter-Abschnitt anfügen:

```markdown
### Globale Implantat-Parameter (Stand BA 143)

Prüfung der drei globalen Parameter (`s.implant.cValue`,
`.idr`, `.iidr`) gegen Hersteller-spezifische Bereiche. Nur
aktiv, wenn der Wert gesetzt ist (`!= null`). Zwei Stufen:

- **Hardware-Range** (Level 1 rot): außerhalb der dokumentierten
  Software-Grenze. c-Wert 0–8000 (MED-EL, MAESTRO Boyd 2006),
  IDR 20–80 dB (AB, Holden 2011), IIDR 10–100 dB (Cochlear,
  konservativ).
- **Typischer Bereich** (Level 3 gelb): innerhalb der Software-
  Grenze, aber außerhalb des typischen Audiologen-Bereichs.
  c-Wert 100–2000, IDR 40–70 dB, IIDR 30–60 dB.

Pro Hersteller wird nur der jeweils relevante Parameter geprüft:
c-Wert nur MED-EL, IDR nur AB, IIDR nur Cochlear.

Markierung an den Eingabefeldern `#implC`, `#implIDR`, `#implIIDR`
über die Schema-Erweiterung `globalEl` (vorher nur im Header
dokumentiert, ab BA 143 tatsächlich implementiert) und den
neuen Helfer `_implGlobalSelector`.
```

Zusätzlich oben im Schema-Hinweis ergänzen:

```markdown
Ein Warning-Objekt darf in `field` einen String oder ein
String-Array enthalten — letzteres markiert mehrere Felder
derselben Elektrode gleichzeitig (verwendet beim THR/Upper-
Konflikt, BA 138). Alternativ kann `globalEl` (`'c'`, `'idr'`
oder `'iidr'`) gesetzt sein — markiert eines der globalen
Parameter-Felder `#implC`, `#implIDR` oder `#implIIDR` (BA 143).
```

---

## CODESTRUKTUR-Pflege — `docs/CODESTRUKTUR.md`

Im Eintrag zu `js/implant-validate.js` am Ende ergänzen:

```
BA 143 ergänzt: globale Implantat-Parameter — c-Wert
(`_implCheckGlobalCWert`, MED-EL), IDR (`_implCheckGlobalIDR`,
AB), IIDR (`_implCheckGlobalIIDR`, Cochlear). Konstanten
`IMPL_VAL_GLOBAL_C/IDR/IIDR` mit `{ hardware, typical }`-Range
(Level 1 rot bzw. Level 3 gelb). Schema-Erweiterung: `globalEl`
(`'c'`/`'idr'`/`'iidr'`) markiert die globalen Felder
`#implC`/`#implIDR`/`#implIIDR` via `_implGlobalSelector`.
`_implApplyFieldLevel` zweigt jetzt zwischen `globalEl`-Pfad und
`electrodeIdx`/`field`-Pfad; gemeinsamer innerer Helfer
`_implApplyLevelToElement` markiert ein einzelnes DOM-Element
mit der strengsten Stufe.
```

Außerdem im Eintrag zu `js/ui-implant.js` einen kurzen Hinweis
ergänzen:

```
BA 143: onchange-Handler der globalen Parameter (implC, implIDR,
implIIDR) rufen am Ende validateImplantTable(activeSide) auf,
damit die Plausibilitätsprüfung sofort auf Änderungen reagiert.
```

---

## Akzeptanztest

Im Browser, Implantat-Reiter, Hersteller jeweils passend
gewählt.

### c-Wert (MED-EL)

1. **Default-Zustand**: c-Wert-Feld leer. Erwartung: keine
   Warnung.
2. **Typischer Wert eingeben**: c-Wert auf 500 (= MAESTRO-Default).
   Erwartung: keine Warnung.
3. **Außerhalb typisch, innerhalb hardware**: c-Wert auf 3000.
   Erwartung: **gelber Rahmen** am `#implC`-Feld, Box-Eintrag
   „c-Wert (3000) liegt außerhalb des typischen Audiologen-
   Bereichs (100–2000) — bitte prüfen".
4. **Außerhalb hardware**: c-Wert auf 12000. Erwartung:
   **roter Rahmen** am `#implC`-Feld, Box-Eintrag „c-Wert (12000)
   liegt außerhalb des Software-Bereichs (0–8000)".
5. **Negativer Wert**: c-Wert auf -100. Erwartung: roter Rahmen.

### IDR (AB)

6. **Hersteller-Wechsel auf AB**, IDR auf 60 (Default).
   Erwartung: keine Warnung.
7. **IDR auf 30 setzen**: außerhalb 40–70, innerhalb 20–80.
   Erwartung: gelber Rahmen am `#implIDR`, Box-Eintrag
   „IDR (30 dB) liegt außerhalb des typischen Bereichs (40–70 dB)
   — Standard ist 60 dB".
8. **IDR auf 100 setzen**: außerhalb hardware.
   Erwartung: roter Rahmen, Hardware-Range-Warnung.

### IIDR (Cochlear)

9. **Hersteller-Wechsel auf Cochlear**, IIDR auf 40 (Default).
   Erwartung: keine Warnung.
10. **IIDR auf 70 setzen**: außerhalb 30–60, innerhalb 10–100.
    Erwartung: gelber Rahmen am `#implIIDR`, Box-Eintrag
    typischer Bereich.
11. **IIDR auf 200 setzen**: außerhalb hardware. Erwartung:
    roter Rahmen.

### Hersteller-Spezifik

12. **Hersteller-Wechsel**: MED-EL mit eingestelltem c-Wert =
    3000 (gelb). Hersteller auf Cochlear umstellen. Erwartung:
    c-Wert-Warnung **verschwindet** (Prüfung nur für MED-EL
    aktiv); ggf. neue IIDR-Warnung bei eingetragenem IIDR.

### Live-Reaktion

13. **Sofortige Re-Validierung**: bei MED-EL c-Wert direkt in
    einem Zug ändern (z. B. von 500 auf 12000). Erwartung:
    Rahmen wechselt sofort beim Wechsel des Werts, ohne dass
    die Tabelle neu gerendert werden muss.

### Sprachwechsel und Konsole

14. **Sprachwechsel** en → de: alle neuen Warnungen erscheinen
    in Deutsch.
15. **Konsole**: keine neuen Fehler.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden der fünfzehn Akzeptanzpunkte
einzeln durchgehen und für jeden melden: erfüllt / nicht
erfüllt / unklar, mit Datei- und Zeilenangabe. Bei „unklar"
Rückfrage.

Zusätzliche Sub-Prüfungen:

- `grep -n "_implCheckGlobalCWert\|_implCheckGlobalIDR\|_implCheckGlobalIIDR" js/implant-validate.js`
  → sechs Treffer (drei Definitionen + drei Aufrufe).
- `grep -n "_implGlobalSelector" js/implant-validate.js` → zwei
  Treffer (Definition + Nutzung in `_implApplyFieldLevel`).
- `grep -n "_implApplyLevelToElement" js/implant-validate.js` →
  drei Treffer (Definition + zwei Aufrufer im erweiterten
  `_implApplyFieldLevel`).
- `grep -n "IMPL_VAL_GLOBAL_" js/implant-validate.js` →
  mindestens sechs Treffer (drei Konstanten je Definition +
  Nutzung).
- `grep -n "validateImplantTable(activeSide)" js/ui-implant.js`
  → mindestens drei Treffer (in den onchange-Settern für
  `implC`, `implIDR`, `implIIDR`).
- `grep -n "implValidateCRangeHard\|implValidateIDRRangeHard\|implValidateIIDRRangeHard" i18n/de.js`
  → drei Treffer.
- `grep -n "APP_VERSION" js/version.js` → `"3.0.143-beta"`.

**Vier-Augen-Check für Schwellwerte und Hersteller-Filter**:

- c-Wert hardware 0–8000, typical 100–2000.
- IDR hardware 20–80, typical 40–70.
- IIDR hardware 10–100, typical 30–60.
- Jede Prüfung filtert exakt einen Hersteller — c-Wert
  `'medel'`, IDR `'ab'`, IIDR `'cochlear'`. Vertauschungen
  oder Großbuchstaben würden die Prüfung deaktivieren.
- Die `else if`-Reihenfolge in den Prüfungen ist wichtig: erst
  Hardware-Range (Level 1), dann typischer Bereich (Level 3).
  Wenn ein Wert beide Bedingungen erfüllt (z. B. weit außerhalb
  Hardware → auch außerhalb typisch), gewinnt die strengere
  Stufe — der `else if`-Zweig sorgt dafür, dass nur **eine**
  Warnung pro Parameter erzeugt wird.

---

## Hinweise

- Damit ist die Plausibilitäts-Reihe inhaltlich vollständig.
  Noch ausstehend: **BA 144 — i18n en/fr/es** (Übersetzungen
  aller in BA 133–143 angelegten Keys nachziehen). Reine
  Übersetzungs-Anleitung, klein.
- **Kein Bau-Diagnose-Test nötig** — Akzeptanz ist durch
  Werteingaben in die globalen Felder direkt prüfbar.
- Der gemeinsame Helfer `_implApplyLevelToElement` ist eine
  saubere Refactoring-Gelegenheit, die im selben Schritt
  mitgemacht wird, damit Tabellenfeld- und Global-Markierung
  derselben Stufe-Logik folgen.
- Die `else if`-Logik in den drei Prüf-Funktionen liefert pro
  Parameter höchstens eine Warnung. Die strengere Stufe gewinnt
  automatisch, ohne dass beide ausgegeben werden müssten.
