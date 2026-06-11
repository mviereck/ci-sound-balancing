# BA 269 — Plausibilitätsprüfung: Hz-Hinweise hochstufen, Hinweis für leeren c-Wert (MED-EL) und IDR (AB), IIDR (Cochlear) komplett ausbauen

**Ziel-Version nach Bau:** `0.4.269-beta`

## Übersicht

Drei Änderungen am Implantat-Reiter, die zusammen einen Bauschritt bilden:

1. **Hz-Info-Hinweise hochstufen.** Die beiden Info-Hinweise „Keine eigenen Frequenzwerte" und „Eigene Frequenzwerte nur teilweise eingetragen" gehen von **Level 4 (blau, Info)** auf **Level 3 (gelb, leichte Warnung)**. Der Text von „leer" wird verschärft, der Text von „teilweise" bleibt.

2. **Zwei neue Info-Hinweise** für die globalen Implantat-Parameter, die im Ausdruck für die dB→Hersteller-Einheit-Umrechnung gebraucht werden:
   - **MED-EL `cValue` leer**: Level 4 (blau, Info) — der MAPLAW-c-Wert wird für die MAPLAW-Simulation im Player gebraucht.
   - **AB `idr` leer**: Level 3 (gelb, leichte Warnung) — IDR geht direkt in `calcAB` ein; bei leerem Feld rechnet der Ausdruck mit Default 60 dB und markiert „(angenommen)".
   - **Cochlear**: kein Hinweis — IIDR geht in `calcCochlear` gar nicht ein (siehe `docs/Berechnungsgrundlagen dB zu CI.md`, Kap. 4.4: `ΔC = ΔdB / Step`, IIDR taucht nicht auf).

3. **Cochlear-IIDR komplett ausbauen.** Wenn der Wert nirgends in eine Berechnung eingeht, soll er auch nicht abgefragt werden. Ausgebaut werden: Eingabefeld in der UI, Range-Plausibilitätsprüfung, Zeile in der Druck-Implantat-Tabelle, Mangel-Eintrag in der Druck-Audiologen-Sektion, alle zugehörigen i18n-Keys. Alte gespeicherte `iidr`-Werte werden beim Laden stillschweigend ignoriert (kein Migrations-Schritt nötig — der Code liest das Feld dann einfach nicht mehr).

---

## Schritt 1 — Versionsbump

**Datei:** `js/version.js`

Vorher:
```js
const APP_VERSION = "0.4.268.1-beta";
```

Nachher:
```js
const APP_VERSION = "0.4.269-beta";
```

---

## Schritt 2 — UI-Block für IIDR aus dem HTML entfernen

**Datei:** `index.html`, Z. 389–407 (zwischen dem AB-IDR-Block und `</div><!-- /implMfrBlock -->`).

Den kompletten Block ersatzlos entfernen:

```html
            <!-- Cochlear: IIDR -->
            <div
              class="controls-row"
              id="implCochParams"
              style="display: none; margin-bottom: 6px"
            >
              <div class="control-group">
                <label id="lblImplIIDR"></label>
                <input
                  type="number"
                  id="implIIDR"
                  min="20"
                  max="80"
                  step="1"
                  style="width: 80px"
                />
                dB
              </div>
            </div>

```

Die leere Zeile darüber (vor dem Kommentar) ebenfalls mit raus, damit es im HTML nicht doppelt umbricht.

---

## Schritt 3 — UI-Modul aufräumen

**Datei:** `js/ui-implant.js`

### 3a) `iidr: null` aus Init-Default in `buildImplantCard` entfernen

Vorher (Z. 6–17):
```js
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      iidr: null,
      generation: null,
      mcl: new Array(s.nEl).fill(null),
      thr: new Array(s.nEl).fill(null),
      upperLevel: new Array(s.nEl).fill(null),
    };
```

Nachher:
```js
  if (!s.implant)
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      generation: null,
      mcl: new Array(s.nEl).fill(null),
      thr: new Array(s.nEl).fill(null),
      upperLevel: new Array(s.nEl).fill(null),
    };
```

### 3b) Label-Setzer für `lblImplIIDR` entfernen

Vorher (Z. 39):
```js
  document.getElementById("lblImplIIDR").textContent = t("lblImplIIDR");
```

Diese Zeile komplett raus. Sie würde sonst beim Laden eine Konsolen-Fehlermeldung erzeugen, weil das Element nicht mehr existiert.

### 3c) Sichtbarkeits-Branch `implCochParams` entfernen

Vorher (Z. 162–168 im aktuellen Stand):
```js
  document.getElementById("implMedelParams").style.display =
    m === "medel" ? "" : "none";
  document.getElementById("implAbParams").style.display =
    m === "ab" ? "" : "none";
  document.getElementById("implCochParams").style.display =
    m === "cochlear" ? "" : "none";
```

Nachher:
```js
  document.getElementById("implMedelParams").style.display =
    m === "medel" ? "" : "none";
  document.getElementById("implAbParams").style.display =
    m === "ab" ? "" : "none";
```

Achtung: Der Init-unknown-Branch weiter oben (Z. 143–147) faßt `implCochParams` ebenfalls in einer Liste an. Ist mit anzupassen:

Vorher:
```js
  if (isUnknownMfr) {
    ["implMedelParams","implAbParams","implCochParams"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
```

Nachher:
```js
  if (isUnknownMfr) {
    ["implMedelParams","implAbParams"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
```

### 3d) IIDR-State-Initialisierung im Cochlear-Branch entfernen

Vorher (Z. 222–226):
```js
  if (m === "cochlear") {
    const ii = document.getElementById("implIIDR");
    if (ii) ii.value = im.iidr !== null ? im.iidr : "";
    updCochlearGen();
  }
```

Nachher:
```js
  if (m === "cochlear") {
    updCochlearGen();
  }
```

### 3e) onchange-Handler für `implIIDR` entfernen

Vorher (Z. 252–258 im aktuellen Stand):
```js
  const iii = document.getElementById("implIIDR");
  if (iii)
    iii.onchange = function () {
      sideData[activeSide].implant.iidr =
        this.value !== "" ? parseFloat(this.value) : null;
      if (typeof validateImplantTable === 'function') validateImplantTable(activeSide);
    };
```

Diesen kompletten Block (inkl. der Leerzeile davor falls vorhanden) ersatzlos entfernen.

---

## Schritt 4 — State-Module: `iidr` aus den Implantat-Schemata entfernen

`iidr` wird an drei Stellen außerhalb von `ui-implant.js` initialisiert. Überall ersatzlos die Zeile/das Property entfernen.

### 4a) `js/state-side.js` — Reset im selben Side-Slot

Z. 116–126 (Funktion `resetSide`):

Vorher:
```js
  s.implant = {
    model: "",
    processor: "",
    cValue: null,
    idr: null,
    iidr: null,
    generation: null,
    mcl: new Array(s.nEl).fill(null),
    thr: new Array(s.nEl).fill(null),
    upperLevel: new Array(s.nEl).fill(null),
  };
```

Nachher (Zeile `iidr: null,` raus):
```js
  s.implant = {
    model: "",
    processor: "",
    cValue: null,
    idr: null,
    generation: null,
    mcl: new Array(s.nEl).fill(null),
    thr: new Array(s.nEl).fill(null),
    upperLevel: new Array(s.nEl).fill(null),
  };
```

### 4b) `js/state-side.js` — Lade-Routine (Z. 394–404)

Vorher:
```js
  s.implant = {
    model: di.model || "",
    processor: di.processor || "",
    cValue: di.cValue !== undefined && di.cValue !== null ? di.cValue : null,
    idr: di.idr !== undefined && di.idr !== null ? di.idr : null,
    iidr: di.iidr !== undefined && di.iidr !== null ? di.iidr : null,
    generation: di.generation || null,
    mcl: di.mcl || new Array(s.nEl).fill(null),
    thr: di.thr || new Array(s.nEl).fill(null),
    upperLevel: di.upperLevel || new Array(s.nEl).fill(null),
  };
```

Nachher (Zeile `iidr: di.iidr ...` raus):
```js
  s.implant = {
    model: di.model || "",
    processor: di.processor || "",
    cValue: di.cValue !== undefined && di.cValue !== null ? di.cValue : null,
    idr: di.idr !== undefined && di.idr !== null ? di.idr : null,
    generation: di.generation || null,
    mcl: di.mcl || new Array(s.nEl).fill(null),
    thr: di.thr || new Array(s.nEl).fill(null),
    upperLevel: di.upperLevel || new Array(s.nEl).fill(null),
  };
```

Damit werden alte gespeicherte `iidr`-Werte beim Laden stillschweigend ignoriert — sie landen weder im `s.implant`-Objekt noch in einem späteren Save.

### 4c) `js/state-side.js` — Bilateraler Sync-Block (Z. 604–611)

Vorher:
```js
          otherData.implant = {
            model: otherData.implant ? otherData.implant.model || "" : "",
            processor: otherData.implant ? otherData.implant.processor || "" : "",
            cValue: null, idr: null, iidr: null, generation: null,
            mcl: new Array(otherData.nEl).fill(null),
            thr: new Array(otherData.nEl).fill(null),
            upperLevel: new Array(otherData.nEl).fill(null),
          };
```

Nachher:
```js
          otherData.implant = {
            model: otherData.implant ? otherData.implant.model || "" : "",
            processor: otherData.implant ? otherData.implant.processor || "" : "",
            cValue: null, idr: null, generation: null,
            mcl: new Array(otherData.nEl).fill(null),
            thr: new Array(otherData.nEl).fill(null),
            upperLevel: new Array(otherData.nEl).fill(null),
          };
```

### 4d) `js/freq-table.js` — Z. 460–470

Vorher:
```js
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      iidr: null,
      generation: null,
      mcl: [],
      thr: [],
      upperLevel: [],
    };
```

Nachher (Zeile `iidr: null,` raus):
```js
    s.implant = {
      model: "",
      processor: "",
      cValue: null,
      idr: null,
      generation: null,
      mcl: [],
      thr: [],
      upperLevel: [],
    };
```

---

## Schritt 5 — Plausibilitätsprüfung umbauen

**Datei:** `js/implant-validate.js`

### 5a) Schema-Kommentar bereinigen (Z. 18)

Vorher:
```js
//     globalEl:    'c' | 'idr' | 'iidr' (optional, bei globalen Feldern),
```

Nachher:
```js
//     globalEl:    'c' | 'idr' (optional, bei globalen Feldern),
```

### 5b) `IMPL_VAL_GLOBAL_IIDR`-Konstante entfernen (Z. 103–109)

Den kompletten Block (inkl. Kommentar darüber zu IIDR) ersatzlos entfernen:

```js
const IMPL_VAL_GLOBAL_IIDR = {
  // IIDR hat keine öffentlich dokumentierte harte Software-Grenze.
  // Konservativ als Hardware-Range das volle plausible Spektrum,
  // typischer Bereich enger.
  hardware: { min: 10, max: 100 },   // Default 40
  typical:  { min: 30, max: 60  }
};
```

Den vorausgehenden Kommentarblock zu den Quellen Z. 89–94 anpassen, sodaß IIDR nicht mehr erwähnt wird:

Vorher:
```js
// Globale Implantat-Parameter — Plausibilitäts-Bereiche.
// Quellen: Berechnungsgrundlagen dB zu CI.md Kap. 3.2 (c-Wert),
// Kap. 5.2 (IDR), Kap. 4.3 (IIDR).
//   hardware: Software-Limits, außerhalb → Level 1 rot.
//   typical:  typischer Audiologen-Bereich, außerhalb → Level 3 gelb.
//   Default-Werte sind kommentiert, werden aber nicht direkt geprüft.
```

Nachher:
```js
// Globale Implantat-Parameter — Plausibilitäts-Bereiche.
// Quellen: Berechnungsgrundlagen dB zu CI.md Kap. 3.2 (c-Wert),
// Kap. 5.2 (IDR).
//   hardware: Software-Limits, außerhalb → Level 1 rot.
//   typical:  typischer Audiologen-Bereich, außerhalb → Level 3 gelb.
//   Default-Werte sind kommentiert, werden aber nicht direkt geprüft.
```

### 5c) `'iidr'`-Selector entfernen (Z. 199)

Vorher:
```js
function _implGlobalSelector(globalEl) {
  if (globalEl === 'c')    return '#implC';
  if (globalEl === 'idr')  return '#implIDR';
  if (globalEl === 'iidr') return '#implIIDR';
  return null;
}
```

Nachher:
```js
function _implGlobalSelector(globalEl) {
  if (globalEl === 'c')    return '#implC';
  if (globalEl === 'idr')  return '#implIDR';
  return null;
}
```

### 5d) `_implCheckGlobalIIDR`-Funktion komplett entfernen (Z. 839–864)

```js
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

Diesen Funktionsblock komplett ersatzlos löschen.

### 5e) Hz-Info-Hinweise von INFO auf YELLOW hochstufen

Vorher (`_implCheckInfoFreqOwn`, Z. 871–896):
```js
function _implCheckInfoFreqOwn(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;

  let totalActive = 0;
  let ownCount = 0;
  for (let i = 0; i < s.nEl; i++) {
    if (s.elActive && s.elActive[i] === false) continue;
    totalActive++;
    if (s.elFreqOwn && s.elFreqOwn[i] != null) ownCount++;
  }
  if (totalActive === 0) return warnings;

  if (ownCount === 0) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoFreqEmpty'
    });
  } else if (ownCount < totalActive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoFreqPartial'
    });
  }
  return warnings;
}
```

Nachher (zwei Stellen: `IMPL_VAL_LEVEL_INFO` → `IMPL_VAL_LEVEL_YELLOW`):
```js
function _implCheckInfoFreqOwn(s) {
  const warnings = [];
  if (!s || !s.nEl) return warnings;

  let totalActive = 0;
  let ownCount = 0;
  for (let i = 0; i < s.nEl; i++) {
    if (s.elActive && s.elActive[i] === false) continue;
    totalActive++;
    if (s.elFreqOwn && s.elFreqOwn[i] != null) ownCount++;
  }
  if (totalActive === 0) return warnings;

  if (ownCount === 0) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      messageKey: 'implValidateInfoFreqEmpty'
    });
  } else if (ownCount < totalActive) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      messageKey: 'implValidateInfoFreqPartial'
    });
  }
  return warnings;
}
```

**Hinweis:** Die Info-Hinweise tragen nach BA 267-Schema kein `globalEl` und kein `electrodeIdx`, deshalb markiert die gelbe Stufe weiterhin kein einzelnes Feld — sie erscheint nur als Box-Eintrag (jetzt mit gelbem Dot statt blauem). Das ist gewollt.

### 5f) Zwei neue Info-Hinweis-Prüfungen anlegen

Direkt nach `_implCheckInfoThr` (Z. 944–972) und vor `// --- Hauptfunktion ---` (Z. 974) einfügen:

```js
// MED-EL c-Wert (cValue) leer.
// Wird nicht direkt in calcMedel verwendet, aber für die MAPLAW-
// Simulation im Player gebraucht. Stufe: Info (blau).
function _implCheckInfoCValueMedel(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'medel' || !s.implant) return warnings;
  const v = s.implant.cValue;
  if (v == null || isNaN(v)) {
    warnings.push({
      level: IMPL_VAL_LEVEL_INFO,
      messageKey: 'implValidateInfoCValueEmpty'
    });
  }
  return warnings;
}

// AB IDR leer.
// Geht direkt in calcAB ein. Bei leerem Feld nimmt der Code 60 dB
// an und markiert "(angenommen)" im Ausdruck. Stufe: gelb.
function _implCheckInfoIdrAb(s) {
  const warnings = [];
  if (!s || s.manufacturer !== 'ab' || !s.implant) return warnings;
  const v = s.implant.idr;
  if (v == null || isNaN(v)) {
    warnings.push({
      level: IMPL_VAL_LEVEL_YELLOW,
      messageKey: 'implValidateInfoIDREmpty'
    });
  }
  return warnings;
}
```

### 5g) Aufrufliste in `validateImplantTable` anpassen

Vorher (Z. 981–999):
```js
  const warnings = [];
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));
  warnings.push.apply(warnings, _implCheckThrUpperRange(s));
  warnings.push.apply(warnings, _implCheckThrUpperConflict(s));
  warnings.push.apply(warnings, _implCheckThrUpperMagnitude(s));
  warnings.push.apply(warnings, _implCheckThrUpperMAD(s));
  warnings.push.apply(warnings, _implCheckFatOnDeactivation(s));
  warnings.push.apply(warnings, _implCheckGlobalCWert(s));
  warnings.push.apply(warnings, _implCheckGlobalIDR(s));
  warnings.push.apply(warnings, _implCheckGlobalIIDR(s));
  warnings.push.apply(warnings, _implCheckInfoFreqOwn(s));
  warnings.push.apply(warnings, _implCheckInfoAllActive(s));
  warnings.push.apply(warnings, _implCheckInfoUpperLevel(s));
  warnings.push.apply(warnings, _implCheckInfoThr(s));
```

Nachher (`_implCheckGlobalIIDR`-Zeile raus; zwei neue Aufrufe für die neuen Prüfungen ergänzen):
```js
  const warnings = [];
  warnings.push.apply(warnings, _implCheckHzMonotonie(s));
  warnings.push.apply(warnings, _implCheckHzRange(s));
  warnings.push.apply(warnings, _implCheckHzMagnitude(s));
  warnings.push.apply(warnings, _implCheckHzCochlearLookup(s));
  warnings.push.apply(warnings, _implCheckHzTrendMedelAb(s));
  warnings.push.apply(warnings, _implCheckHzJumpMedelAb(s));
  warnings.push.apply(warnings, _implCheckThrUpperRange(s));
  warnings.push.apply(warnings, _implCheckThrUpperConflict(s));
  warnings.push.apply(warnings, _implCheckThrUpperMagnitude(s));
  warnings.push.apply(warnings, _implCheckThrUpperMAD(s));
  warnings.push.apply(warnings, _implCheckFatOnDeactivation(s));
  warnings.push.apply(warnings, _implCheckGlobalCWert(s));
  warnings.push.apply(warnings, _implCheckGlobalIDR(s));
  warnings.push.apply(warnings, _implCheckInfoFreqOwn(s));
  warnings.push.apply(warnings, _implCheckInfoAllActive(s));
  warnings.push.apply(warnings, _implCheckInfoUpperLevel(s));
  warnings.push.apply(warnings, _implCheckInfoThr(s));
  warnings.push.apply(warnings, _implCheckInfoCValueMedel(s));
  warnings.push.apply(warnings, _implCheckInfoIdrAb(s));
```

---

## Schritt 6 — Druck anpassen

### 6a) `js/tab-print.js` — IIDR-Zeile aus Parameter-Tabelle entfernen

Vorher (Z. 61–62):
```js
    if (im.iidr != null && m === "cochlear")
      paramRows.push([t("lblImplIIDR"), im.iidr + " dB"]);
```

Diese zwei Zeilen ersatzlos entfernen.

### 6b) `js/print-md.js` — `iidr` aus dem Implantat-Dump entfernen (Z. 260–270)

Vorher:
```js
      implant: {
        model:     impl.model     || null,
        processor: impl.processor || null,
        cValue:    impl.cValue    || null,
        idr:       impl.idr       || null,
        iidr:      impl.iidr      || null,
        generation: impl.generation || null,
        strategy:  impl.strategy  || null,
        unit,
        electrodes,
      },
```

Nachher (Zeile `iidr: …` raus):
```js
      implant: {
        model:     impl.model     || null,
        processor: impl.processor || null,
        cValue:    impl.cValue    || null,
        idr:       impl.idr       || null,
        generation: impl.generation || null,
        strategy:  impl.strategy  || null,
        unit,
        electrodes,
      },
```

### 6c) `js/print-md.js` — `archivCfgIidr`-Zeile aus Archiv-Block (Z. 437)

Vorher:
```js
    if (im.iidr)       lines.push(`- ${t("archivCfgIidr")}: ${im.iidr}`);
```

Diese Zeile ersatzlos entfernen.

### 6d) `js/print-md.js` — Cochlear-Mangel-Eintrag entfernen (Z. 1061)

Vorher (im Block `_audiologMissingImplantData`):
```js
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "cochlear" && !impl.iidr) missing.push(t("audMissIidr"));
    if (sd && sd.manufacturer === "ab" && !impl.idr) missing.push(t("audMissIdr"));
```

Nachher (Cochlear-Zeile raus):
```js
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "ab" && !impl.idr) missing.push(t("audMissIdr"));
```

---

## Schritt 7 — i18n-Strings

Wichtig: **Im Code ausschließlich ASCII-Anführungszeichen** `"` und `'`. Innerhalb von Textwerten sind typografische Zeichen erlaubt. Bei diesem Bauschritt sind keine typografischen Quotes nötig.

In **allen vier** Sprachdateien (`de.js`, `en.js`, `fr.js`, `es.js`) folgendes ändern:

### 7a) Drei Keys ersatzlos entfernen

- `implValidateIIDRRangeHard`
- `implValidateIIDRRangeTypical`
- `lblImplIIDR`
- `audMissIidr`
- `archivCfgIidr`

(Das sind fünf Keys pro Sprachdatei.)

### 7b) Eintrag `implValidateInfoFreqEmpty` aktualisieren

Pro Sprachdatei den bestehenden Wert ersetzen.

**`i18n/de.js`** — Vorher:
```js
implValidateInfoFreqEmpty: "Keine eigenen Frequenzwerte eingetragen — Default-Werte der Hersteller-Range werden verwendet.",
```
Nachher:
```js
implValidateInfoFreqEmpty: "Keine eigenen Frequenzwerte (Hz) eingetragen. Default Werte der Hersteller werden verwendet, könnten aber für Sie falsch sein und zu verfälschten Meßergebnissen führen.",
```

**`i18n/en.js`** — Vorher:
```js
implValidateInfoFreqEmpty: "No custom frequency values entered — default values from the manufacturer range are used.",
```
Nachher:
```js
implValidateInfoFreqEmpty: "No custom frequency values (Hz) entered. Manufacturer default values are used but may be wrong for you and lead to distorted measurement results.",
```

**`i18n/fr.js`** — Vorher:
```js
implValidateInfoFreqEmpty: "Aucune fréquence personnalisée saisie — les valeurs par défaut de la plage du fabricant sont utilisées.",
```
Nachher:
```js
implValidateInfoFreqEmpty: "Aucune fréquence personnalisée (Hz) saisie. Les valeurs par défaut du fabricant sont utilisées, mais elles pourraient être incorrectes pour vous et fausser les résultats de mesure.",
```

**`i18n/es.js`** — Vorher:
```js
implValidateInfoFreqEmpty: "No se han introducido frecuencias propias — se utilizan los valores predeterminados del rango del fabricante.",
```
Nachher:
```js
implValidateInfoFreqEmpty: "No se han introducido frecuencias propias (Hz). Se utilizan los valores predeterminados del fabricante, pero podrían ser incorrectos para usted y producir resultados de medición falseados.",
```

### 7c) Zwei neue Keys ergänzen

Direkt unter `implValidateInfoThrPartial` einfügen.

**`i18n/de.js`**:
```js
implValidateInfoCValueEmpty: "MAPLAW c-Wert nicht eingetragen. Wird für Simulation anderer MAPLAW Einstellungen im Player benötigt.",
implValidateInfoIDREmpty: "IDR nicht eingetragen — wird für die CU-Berechnung im Ausdruck benötigt. Ohne Eintrag rechnet der Ausdruck mit dem Default 60 dB.",
```

**`i18n/en.js`**:
```js
implValidateInfoCValueEmpty: "MAPLAW c-value not entered. Required for simulating alternative MAPLAW settings in the player.",
implValidateInfoIDREmpty: "IDR not entered — required for the CU calculation in the printout. Without an entry the printout uses the default 60 dB.",
```

**`i18n/fr.js`**:
```js
implValidateInfoCValueEmpty: "Valeur c MAPLAW non saisie. Nécessaire pour simuler d'autres réglages MAPLAW dans le lecteur.",
implValidateInfoIDREmpty: "IDR non saisie — nécessaire pour le calcul CU dans l'impression. Sans saisie, l'impression utilise la valeur par défaut 60 dB.",
```

**`i18n/es.js`**:
```js
implValidateInfoCValueEmpty: "Valor c MAPLAW no introducido. Necesario para simular otros ajustes MAPLAW en el reproductor.",
implValidateInfoIDREmpty: "IDR no introducida — necesaria para el cálculo CU en la impresión. Sin valor, la impresión utiliza el valor predeterminado de 60 dB.",
```

---

## Schritt 8 — Spec und CODESTRUKTUR aktualisieren

### 8a) `docs/spec/03-implantat.md`

**Z. 77–79** — Globale-Parameter-Bullet kürzen:

Vorher:
```
- **Globale Implantat-Parameter**: c-Wert (MED-EL), IDR / IIDR
  (Cochlear: IIDR Default 40 dB; AB: IDR Default 60 dB). Werden für
  die Umrechnung dB → Hersteller-Einheit im Druck genutzt.
```

Nachher:
```
- **Globale Implantat-Parameter**: c-Wert (MED-EL, für MAPLAW-Simulation
  im Player) und IDR (AB, Default 60 dB; geht direkt in die CU-Berechnung
  im Druck ein). Für Cochlear gibt es kein zusätzliches globales Feld —
  die dB→CL-Umrechnung benötigt nur die Generation (A/B) und den
  C-Level pro Elektrode.
```

**Z. 278–298** — Block „Globale Implantat-Parameter (Stand BA 143)": IIDR konsequent rausziehen. Der ganze Block wird zu (ersetzt 278–298):

```
### Globale Implantat-Parameter (Stand BA 143, IIDR-Ausbau BA 269)

Prüfung der beiden globalen Parameter (`s.implant.cValue`,
`s.implant.idr`) gegen Hersteller-spezifische Bereiche. Nur
aktiv, wenn der Wert gesetzt ist (`!= null`). Zwei Stufen:

- **Hardware-Range** (Level 1 rot): außerhalb der dokumentierten
  Software-Grenze. c-Wert 0–8000 (MED-EL, MAESTRO Boyd 2006),
  IDR 20–80 dB (AB, Holden 2011).
- **Typischer Bereich** (Level 3 gelb): innerhalb der Software-
  Grenze, aber außerhalb des typischen Audiologen-Bereichs.
  c-Wert 100–2000, IDR 40–70 dB.

Pro Hersteller wird nur der jeweils relevante Parameter geprüft:
c-Wert nur MED-EL, IDR nur AB. Cochlear hat seit BA 269 kein
globales Eingabefeld mehr — IIDR ging in keine Berechnung ein
(siehe `docs/Berechnungsgrundlagen dB zu CI.md`, Kap. 4.4) und
wurde mitsamt UI-Feld, Range-Prüfung und Druck-Anzeige entfernt.

Markierung an den Eingabefeldern `#implC`, `#implIDR` über die
Schema-Erweiterung `globalEl` und den Helfer `_implGlobalSelector`.
```

**Z. 300–323** — Block „Info-Hinweise / Level 4 blau (BA 267)": Stufen und neue Hinweise anpassen. Der ganze Block wird ersetzt durch:

```
### Info-Hinweise / Stufen-Mix (BA 267, geändert BA 269)

Prüfungen, die nur aktive Elektroden betrachten. Kein Feld-
Outline — nur Listeneintrag in der Warnbox. Stufenmischung seit
BA 269:

- **FreqOwn leer** (A1, Level 3 gelb seit BA 269): alle aktiven
  Elektroden haben kein Hz-eigen-Override. Verschärfter Text:
  Default-Werte könnten für den Nutzer falsch sein und zu
  verfälschten Meßergebnissen führen.
- **FreqOwn unvollständig** (A2, Level 3 gelb seit BA 269): mind.
  eine aktive Elektrode hat Hz-eigen, mind. eine nicht.
- **Alle aktiv** (B1, Level 4 blau): keine Elektrode ist als
  inaktiv markiert.
- **Upper-Level leer** (C1, Level 4 blau): MCL/C-Level/M-Level
  bei allen aktiven Elektroden leer — Hersteller-Werte (qu/CL/CU)
  im Ausdruck nicht berechenbar.
- **Upper-Level unvollständig** (C2, Level 4 blau): Upper-Level
  nur teilweise eingetragen.
- **THR leer** (D1, nur AB, Level 4 blau): T-Level bei allen
  aktiven leer — CU nicht berechenbar.
- **THR unvollständig** (D2, nur AB, Level 4 blau): T-Level nur
  teilweise eingetragen.
- **c-Wert leer** (E1, neu BA 269, nur MED-EL, Level 4 blau):
  globaler MAPLAW-c-Wert nicht eingetragen — wird für die
  MAPLAW-Simulation im Player gebraucht.
- **IDR leer** (E2, neu BA 269, nur AB, Level 3 gelb): globaler
  IDR-Wert nicht eingetragen — geht direkt in `calcAB` ein; ohne
  Eintrag wird Default 60 dB angenommen und im Druck markiert.

Hersteller-Mapping für `{label}`/`{unit}` in den i18n-Strings:
`IMPL_VAL_UPPER_LABEL` und `IMPL_VAL_UNIT` (beide in
`implant-validate.js`).

**Überlappung mit `deactWarnBar`**: das bestehende Warnbanner
oberhalb der Tabelle (`#deactWarnBar` in `freq-table.js`) prüft
eine verwandte, aber nicht identische Bedingung: Auslöser ≥1
deaktivierte Elektrode; Bedingung: mindestens eine **aktive**
(nicht-deaktivierte) Elektrode hat noch keinen Hz-eigen-Override
(Bugfix BA 142 — vorher wurde fälschlich auf deaktivierte
Elektroden geprüft). Es bleibt parallel bestehen. Eine spätere
Konsolidierung kann den Banner durch diese Prüfung ersetzen.
```

### 8b) `docs/CODESTRUKTUR.md`

In der Zeile zu `implant-validate.js` am Ende des Beschreibungstexts ergänzen (nach dem BA-143-Abschnitt):

```
**BA 269:** IIDR komplett ausgebaut (`_implCheckGlobalIIDR`, `IMPL_VAL_GLOBAL_IIDR`, `'iidr'`-Selector raus; Schema-Kommentar bereinigt). Hz-Info-Hinweise (`_implCheckInfoFreqOwn`) von Level 4 auf Level 3 gelb hochgestuft, Text von „leer" verschärft. Zwei neue Info-Prüfungen: `_implCheckInfoCValueMedel` (Level 4 blau, MAPLAW-c-Wert leer) und `_implCheckInfoIdrAb` (Level 3 gelb, AB-IDR leer).
```

In der Zeile zu `ui-implant.js` ergänzen:
```
**BA 269:** Cochlear-IIDR-Feld komplett aus der Card entfernt — kein `lblImplIIDR`-Setzer, kein Cochlear-Branch für IIDR-State, kein onchange-Handler für `#implIIDR`.
```

---

## Akzeptanztest

Sonnet, gehe folgende Klick-Schritte durch und prüfe das erwartete Verhalten:

1. **Cache-Refresh**: Seite neu laden mit hartem Reload (`Ctrl+Shift+R`). Versions-Anzeige unten rechts zeigt `0.4.269-beta`.
2. **Cochlear-Implantat-Tab**:
   - Auf eine Seite (links oder rechts) wechseln, Hersteller auf **Cochlear** stellen.
   - **Erwartet**: Im Implantat-Reiter ist **kein** IIDR-Eingabefeld mehr sichtbar. Direkt nach dem Implantat-Modell-Dropdown folgt nur noch das Generation-Anzeigefeld und dann die Frequenz-Tabelle.
   - In der Plausibilitätsprüfungs-Box keine IIDR-bezogenen Einträge.
3. **MED-EL-c-Wert-Hinweis**:
   - Hersteller auf **MED-EL** stellen. Wenn `c-Wert`-Feld leer ist: Plausibilitätsprüfungs-Box zeigt **blauen Eintrag** „MAPLAW c-Wert nicht eingetragen. Wird für Simulation anderer MAPLAW Einstellungen im Player benötigt."
   - Einen Wert (z.B. 1000) eintragen → Hinweis verschwindet sofort.
   - Wert wieder leeren → Hinweis kommt zurück.
4. **AB-IDR-Hinweis**:
   - Hersteller auf **AB** stellen. Wenn `IDR`-Feld leer ist: Plausibilitätsprüfungs-Box zeigt **gelben Eintrag** „IDR nicht eingetragen — wird für die CU-Berechnung im Ausdruck benötigt. Ohne Eintrag rechnet der Ausdruck mit dem Default 60 dB."
   - 60 eintragen → Hinweis verschwindet.
5. **Hz-leer-Hinweis (Stufenwechsel)**:
   - Bei einem beliebigen Hersteller: keine eigenen Hz-Werte eintragen.
   - **Erwartet**: in der Box steht der Eintrag jetzt mit **gelbem Dot** (vorher blau) und neuem verschärftem Text („…könnten aber für Sie falsch sein und zu verfälschten Meßergebnissen führen.").
6. **Hz-teilweise-Hinweis**:
   - Bei einer aktiven Elektrode einen Hz-eigen-Wert eintragen, mind. eine weitere leer lassen.
   - **Erwartet**: gelber Eintrag mit altem Text („Eigene Frequenzwerte nur teilweise eingetragen — für die übrigen Elektroden werden Default-Werte verwendet.").
7. **Druck**:
   - Mit Cochlear-Daten in den Druck-Reiter wechseln. **Erwartet**: in der Implantat-Parameter-Tabelle keine IIDR-Zeile mehr; in der Audiologen-Sektion „Fehlende Implantat-Angaben" keine IIDR-Erwähnung. Druck-Markdown kopieren und ASCII-Quick-Scan auf das Wort `IIDR` machen — darf nicht mehr vorkommen (außer in alten Speicherständen).
8. **Speicherstände**:
   - Vor dem Build gespeicherte Konfiguration mit Cochlear-Daten und gesetztem IIDR laden. **Erwartet**: lädt ohne Konsolen-Fehler. Der `iidr`-Wert taucht weder in UI noch in der Plausibilitätsprüfung noch im Druck auf. Erneutes Speichern erzeugt kein `iidr`-Feld mehr.
9. **Sprachwechsel**:
   - Sprache auf EN / FR / ES umstellen (Sprach-Dropdown). Die Hinweis-Box im Implantat-Reiter zeigt jeweils die übersetzte Variante der drei aktualisierten/neuen Texte. Keine `[implValidateInfoFreqEmpty]`-Platzhalter, keine `undefined`-Strings.
10. **Konsole**: nach dem Reload keine `Uncaught TypeError` oder `null`-Zugriffsfehler aus `ui-implant.js`, `implant-validate.js`, `tab-print.js` oder `print-md.js`.

---

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden Akzeptanz-Punkt einzeln durchgehen und für jeden melden: **erfüllt / nicht erfüllt / unklar**, mit Datei- und Zeilenangabe der relevanten Stelle.

Wenn ein Punkt als „unklar" markiert wird, ist das das Signal zur Rückfrage beim Nutzer, **nicht** zur stillen Annahme. Lieber einmal nachfragen als einen halb erledigten Punkt durchwinken.

Zusätzlich vor der Fertig-Meldung im fertigen Code prüfen:

- Sucht `grep -n "iidr\|IIDR" js/ index.html` noch Treffer? **Erwartet**: keine Treffer mehr (außer ggf. in alten BA-Dateien unter `.bauanleitungen/archiv/`).
- Sucht `grep -n "implIIDR\|lblImplIIDR" .` noch Treffer? **Erwartet**: keine.
- Sucht `grep -n "implValidateIIDR\|audMissIidr\|archivCfgIidr" i18n/` noch Treffer? **Erwartet**: keine.
- Sind in allen vier `i18n/*.js`-Dateien die neuen Keys `implValidateInfoCValueEmpty` und `implValidateInfoIDREmpty` vorhanden?
- Ist `APP_VERSION` in `js/version.js` auf `"0.4.269-beta"` gesetzt?
- Sind die Änderungen an `docs/spec/03-implantat.md` und `docs/CODESTRUKTUR.md` enthalten? (CLAUDE.md verlangt strukturelle Doku im selben Bauschritt.)

---

**Hinweis i18n:** Die englischen, französischen und spanischen Texte in Schritt 7 sind als Übersetzungs-Vorschlag formuliert. Wenn beim Bauen ein Wortlaut sprachlich nicht überzeugend wirkt, dies bitte als „unklar" melden statt eigenmächtig umzuformulieren — der Nutzer entscheidet.
