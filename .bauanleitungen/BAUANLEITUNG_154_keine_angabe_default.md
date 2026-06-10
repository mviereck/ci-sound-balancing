# BAUANLEITUNG 154 — „Keine Angabe"-Default für Hörtechnik und Hersteller

**Zieldateien:** `index.html`, `js/core.js`, `js/state-side.js`, `js/file.js`, `js/ui-implant.js`, `js/freq-table.js`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 153 abgeschlossen. Stand `js/version.js` = `3.0.153-beta`.

**Version:** 3.0.153-beta → **3.0.154-beta**

---

## Kontext

Konzeptbeschluß: Beim Erststart des Tools sollen Hörtechnik- und
Hersteller-Auswahl **nicht** auf einen Default gesprungen sein
(heute: Hörtechnik=„CI", Hersteller=„MED-EL"), sondern auf
„Keine Angabe". Der Nutzer wird damit ausdrücklich gezwungen, die
beiden Werte zu setzen, bevor die Implantat-Karte und die Tests
sinnvoll bedient werden können.

UI-Cascade:
- **Hörtechnik = Keine Angabe**: gesamter Implantat-Block ausgeblendet
  (Hersteller-Dropdown, Modell, c-Wert/IDR/IIDR, Frequenztabelle).
  Stattdessen Hinweistext „Bitte zuerst Hörtechnik wählen, damit das
  Tool die passenden Eingabefelder anzeigen kann."
- **Hörtechnik = CI, Hersteller = Keine Angabe**: Hersteller-Dropdown
  sichtbar, alles weitere ausgeblendet, Hinweistext „Bitte Hersteller
  wählen."
- **Hörtechnik = CI, Hersteller gewählt**: bisheriges Verhalten.
- **Hörtechnik = Hörgerät / schwerhörig / normal**: akustische Tabelle
  (aus BA 153), Hersteller irrelevant.
- **Hörtechnik = Taub**: heutiges Verhalten (Hinweis, keine Tabelle).

Wechsel **von** „Keine Angabe" weg ist frei (keine Sperre), Wechsel
**zurück** zu „Keine Angabe" greift die existierende Konfig-/Hersteller-
Sperre aus BA 149/151 — wenn Meßdaten vorliegen, ist der Wechsel
durch das Sperr-Modul ohnehin blockiert.

**Nicht in dieser Bauanleitung enthalten:** Tests sollen nicht
startbar sein, wenn eine benötigte Seite auf „Keine Angabe" steht.
Diese Voraussetzungs-Sperre kommt in BA 155 (zusammen mit
„beide Seiten akustisch = Tabelle aus").

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.154-beta";
```

---

## Schritt 2 — MFR-Tabelle um Platzhalter-Eintrag „unknown" ergänzen

Datei `js/core.js`, in der `MFR`-Konstante (ab Z. 173) **direkt nach**
`const MFR = {` einen neuen Eintrag einfügen:

```js
  unknown: {
    name: "—",
    n: 0,
    apFirst: true,
    freqs: [],
  },
```

So bleibt `MFR[m].n` und `MFR[m].freqs` definiert, falls der Code
irgendwo darauf zugreift, ohne das Manufacturer-Set explizit zu
filtern. `nEl = 0` bewirkt, daß keine Tabellenzeilen gerendert werden.

---

## Schritt 3 — HTML: neue Option in beiden Auswahlfeldern

### 3a) Hörtechnik-Dropdown

Datei `index.html` Z. 293-299. **Vor** der `<option value="ci">`-Zeile
einfügen:

```html
                <option value="unknown" id="cfgOptUnknown"></option>
```

Block sieht danach so aus:
```html
              <select id="cfgSelect">
                <option value="unknown" id="cfgOptUnknown"></option>
                <option value="ci" id="cfgOptCI"></option>
                <option value="hg" id="cfgOptHG"></option>
                <option value="normal" id="cfgOptNormal"></option>
                <option value="shoh" id="cfgOptSchwerh"></option>
                <option value="deaf" id="cfgOptTaub"></option>
              </select>
```

### 3b) Hersteller-Dropdown

Datei `index.html` Z. 324-329. **Vor** `<option value="medel">`:

```html
                <option value="unknown" id="mfrOptUnknown">—</option>
```

Block sieht danach so aus:
```html
              <select id="mfrSelect">
                <option value="unknown" id="mfrOptUnknown">—</option>
                <option value="medel">MED-EL (12)</option>
                <option value="ab">Advanced Bionics (16)</option>
                <option value="cochlear">Cochlear (22)</option>
              </select>
```

(Der Text „—" bleibt sprach-neutral und wird ggf. später per i18n
umgesetzt.)

### 3c) Zwei neue Hinweis-Boxen direkt vor dem `implMfrBlock`

Datei `index.html` Z. 316/317. **Direkt vor** `<!-- CI-spezifischer
Block: Hersteller + Modell + Params -->` einfügen:

```html
          <!-- Hinweis: Hörtechnik = Keine Angabe -->
          <div
            id="cfgHintUnknownEl"
            class="explain"
            style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"
          ></div>

          <!-- Hinweis: Hersteller = Keine Angabe -->
          <div
            id="mfrHintUnknownEl"
            class="explain"
            style="display:none;margin-bottom:8px;background:var(--info-bg,#eff6ff);border-left:3px solid var(--accent,#2563eb);padding:7px 12px;border-radius:6px;font-size:.86em"
          ></div>
```

---

## Schritt 4 — i18n-Strings

Datei `i18n/de.js`, am Ende des bisherigen Konfig-Blocks (per grep
`cfgCI` Stelle finden), einfügen:

```js
  // BA 154: „Keine Angabe"-Default
  cfgUnknown: "Keine Angabe",
  mfrUnknown: "Keine Angabe",
  cfgHintUnknown: "Bitte zuerst Hörtechnik wählen, damit das Tool die passenden Eingabefelder anzeigen kann.",
  mfrHintUnknown: "Bitte Hersteller wählen.",
```

---

## Schritt 5 — Defaults beim Init umstellen

### 5a) `js/state-side.js` — `initSideData`

Funktion ab Z. 92. Vorher:
```js
function initSideData(side, m) {
  const s = sideData[side];
  s.config = s.config || "ci"; // bewahren wenn schon gesetzt, sonst Default
  s.manufacturer = m || "medel";
```

Nachher:
```js
function initSideData(side, m) {
  const s = sideData[side];
  // BA 154: Default jetzt „Keine Angabe" statt „ci"/„medel"
  s.config = s.config || "unknown";
  s.manufacturer = m || "unknown";
```

Plus: die fest verdrahteten Init-Calls am Ende der Datei (Z. 569-570)
ändern.

Vorher:
```js
initSideData("left", "medel");
initSideData("right", "medel");
```

Nachher:
```js
initSideData("left", "unknown");
initSideData("right", "unknown");
```

Auch `defaultMfr` (Z. 54) anpassen:
```js
let defaultMfr = "unknown"; // BA 154: Erststart-Default
```

### 5b) `js/file.js` — `resetAll`

Funktion ab Z. 20. Per grep nach `"medel"` finden und an folgenden
Stellen umstellen:

- Z. 25-26: `sideData[s].config = "ci"` → `sideData[s].config = "unknown"`,
  `sideData[s].manufacturer = "medel"` → `"unknown"`
- Z. 27: `sideData[s].nEl = MFR["medel"].n` → `MFR["unknown"].n` (= 0)
- Z. 28: `sideData[s].freqs = [...MFR["medel"].freqs]` → `[...MFR["unknown"].freqs]` (= [])
- Z. 38: `initSideData(s, "medel")` → `initSideData(s, "unknown")`
- Z. 40: `defaultMfr = "medel"` → `defaultMfr = "unknown"`
- Z. 49: `document.getElementById("mfrSelect").value = "medel"` → `"unknown"`
- Z. 51: `cfgSelR.value = "ci"` → `cfgSelR.value = "unknown"`
- Z. 53: `dfSelR.value = "medel"` → `dfSelR.value = "unknown"`

(Sonnet bitte per grep alle `"medel"`/`"ci"` in `resetAll` finden und
zusammenfaßt umstellen — die obigen Zeilennummern sind Stand vor dem
Edit.)

---

## Schritt 6 — `setSideConfig` an „unknown"-Wechsel anpassen

Datei `js/state-side.js`, Funktion `setSideConfig` ab Z. 551.

**Vorher:**
```js
function setSideConfig(side, cfg) {
  sideData[side].config = cfg;
  if (cfg !== "ci") {
    // Wenn akustisch/taub: Daten dieser Seite bleiben, Frequenzen werden synchronisiert
    syncFreqsToAcoustic();
  } else {
    // Wenn zurück zu CI: unabhängig werden – Frequenzen auf Default zurücksetzen
    const s = sideData[side];
    s.manufacturer = s.manufacturer || "medel";
    s.nEl = MFR[s.manufacturer].n;
    s.freqs = [...MFR[s.manufacturer].freqs];
    // Andere nicht-CI-Seite ebenfalls sync
    syncFreqsToAcoustic();
  }
  bindActiveSide();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
```

**Nachher:**
```js
function setSideConfig(side, cfg) {
  sideData[side].config = cfg;
  if (cfg === "ci") {
    // Wenn zurück zu CI: unabhängig werden — Frequenzen auf Default,
    // Hersteller-Fallback weiterhin „unknown" (BA 154).
    const s = sideData[side];
    s.manufacturer = s.manufacturer || "unknown";
    s.nEl = (MFR[s.manufacturer] && MFR[s.manufacturer].n) || 0;
    s.freqs = (MFR[s.manufacturer] && [...MFR[s.manufacturer].freqs]) || [];
    syncFreqsToAcoustic();
  } else {
    // unknown / hg / normal / shoh / deaf: keine eigenen Frequenzen,
    // ggf. Spiegel von der anderen CI-Seite.
    syncFreqsToAcoustic();
  }
  bindActiveSide();
  // BA 149
  if (typeof depLockApply === 'function') depLockApply();
}
```

---

## Schritt 7 — `syncFreqsToAcoustic` strenger filtern

Datei `js/state-side.js`, Funktion ab Z. 484. Die bestehende Bedingung
(Z. 492):
```js
if ((sideData[other].config || "ci") !== "ci") {
```

**ändern in:**
```js
// BA 154: nur akustische Konfigurationen spiegeln, nicht „unknown" oder „deaf"
const otherCfg = sideData[other].config || "unknown";
if (["hg", "normal", "shoh"].includes(otherCfg)) {
```

Damit wird bei „unknown" oder „deaf" auf der Gegenseite kein Mirror
ausgelöst — was Sinn ergibt, weil dort keine sinnvolle Tabelle
existiert.

Im else-Zweig (beide nicht-CI, Default-Raster) bleibt der bisherige
Block unverändert, **außer** daß der Code dort `MFR[defaultMfr]`
liest. Falls `defaultMfr === "unknown"`, bricht das, weil
`MFR.unknown.n === 0`. Sonnet soll prüfen, ob der else-Pfad bei
beide-nicht-CI mit `defaultMfr === "unknown"` korrekt durchläuft
(d.h. einfach nEl=0 setzt) oder ob hier ein zusätzlicher
Frühausstieg nötig ist (wenn beide Seiten „unknown" oder „deaf"
sind, gibt es nichts zu spiegeln — Tabelle bleibt leer).

---

## Schritt 8 — `buildImplantCard` Cascade

Datei `js/ui-implant.js`, Funktion `buildImplantCard()` ab Z. 4.
Die i18n-Beschriftung der drei neuen IDs muß ergänzt werden, und
die Sichtbarkeit der vier Bereiche (Implantat-Block, Hörtechnik-
Hinweis, Hersteller-Hinweis, Standard-Hinweise akustisch/taub)
abhängig vom Zustand gesetzt werden.

**Schritt 8a)** In den `opts`-Block (Z. 44-48) den Unknown-Eintrag
ergänzen:

**Vorher:**
```js
const opts = {
  cfgOptCI: "cfgCI", cfgOptHG: "cfgHG",
  cfgOptNormal: "cfgNormal", cfgOptSchwerh: "cfgSchwerh",
  cfgOptTaub: "cfgTaub",
};
```

**Nachher:**
```js
const opts = {
  cfgOptUnknown: "cfgUnknown", cfgOptCI: "cfgCI", cfgOptHG: "cfgHG",
  cfgOptNormal: "cfgNormal", cfgOptSchwerh: "cfgSchwerh",
  cfgOptTaub: "cfgTaub",
};
```

**Schritt 8b)** Hersteller-Option-Text setzen. Nach dem `opts.forEach`-
Block (also nach dem Block der bei Z. 49-52 endet), neuen Block
einfügen:

```js
// BA 154: Hersteller-Option „Keine Angabe"
const mfrOptUnknown = document.getElementById("mfrOptUnknown");
if (mfrOptUnknown) mfrOptUnknown.textContent = t("mfrUnknown");
```

**Schritt 8c)** Vor `implMfrBlock ein-/ausblenden` (Z. 55-57) die
neue Cascade-Logik einsetzen:

**Vorher:**
```js
// implMfrBlock ein-/ausblenden
const mfrBlock = document.getElementById("implMfrBlock");
if (mfrBlock) mfrBlock.style.display = isCiCfg ? "" : "none";
```

**Nachher:**
```js
// BA 154: Cascade
const isUnknownCfg = cfg === "unknown";
const isUnknownMfr = isCiCfg && (s.manufacturer === "unknown" || !s.manufacturer);

// implMfrBlock nur bei CI mit gewähltem Hersteller
const mfrBlock = document.getElementById("implMfrBlock");
if (mfrBlock) mfrBlock.style.display = (isCiCfg && !isUnknownMfr) ? "" : "none";

// Hersteller-Dropdown selbst trotzdem zeigen (auch wenn Mfr=unknown)
// — es liegt aber innerhalb von implMfrBlock; lösen durch Verschachtelung
//   wäre HTML-Umbau. Pragmatisch: bei CI+unknown Mfr trotzdem
//   implMfrBlock anzeigen, aber dessen Modell/Param-Sub-Blöcke
//   verstecken. Siehe Schritt 8d).
if (isCiCfg && isUnknownMfr && mfrBlock) {
  mfrBlock.style.display = "";
}

// Hörtechnik-Hinweis
const hintCfgUn = document.getElementById("cfgHintUnknownEl");
if (hintCfgUn) {
  hintCfgUn.style.display = isUnknownCfg ? "" : "none";
  if (isUnknownCfg) hintCfgUn.textContent = t("cfgHintUnknown");
}
// Hersteller-Hinweis
const hintMfrUn = document.getElementById("mfrHintUnknownEl");
if (hintMfrUn) {
  hintMfrUn.style.display = (isCiCfg && isUnknownMfr) ? "" : "none";
  if (isCiCfg && isUnknownMfr) hintMfrUn.textContent = t("mfrHintUnknown");
}
```

**Schritt 8d)** Bei `isUnknownMfr` die Sub-Blöcke ausblenden:

Per grep `implMedelParams`, `implAbParams`, `implCochParams`,
`implModelSelect`, `implProcSelect`, `implGenGroup` in
`js/ui-implant.js` die Stellen finden, an denen sie sichtbar
geschaltet werden. Für jede dieser Visibility-Setzungen die
Bedingung um `!isUnknownMfr` ergänzen — z.B.:

```js
document.getElementById("implMedelParams").style.display =
  (!isUnknownMfr && m === "medel") ? "" : "none";
```

Plus: bei `isUnknownMfr` die Frühaussteig-Logik nach Hörtechnik
nicht greifen lassen — der Code endet aktuell mit
`if (!isCiCfg) return;` (Z. 101-104). Diese Zeile bleibt. Damit
landet die Logik bei `isCiCfg && isUnknownMfr` in den späteren
Visibility-Setzungen, die jetzt das Verstecken übernehmen.

---

## Schritt 9 — `buildFreqTable` Cascade

Datei `js/freq-table.js`, Funktion `buildFreqTable()` ab Z. 4.

Am **Anfang** der Funktion, nach den Variablen-Definitionen
`cfg`, `isAcoustic` (aus BA 153), `elPfx`, `elLbl`:

```js
// BA 154: bei „Keine Angabe" Tabelle leeren und früh aussteigen
const isUnknownCfg = cfg === "unknown";
const isUnknownMfr = !isAcoustic && cfg === "ci"
  && (sideData[activeSide].manufacturer === "unknown" || !sideData[activeSide].manufacturer);
if (isUnknownCfg || isUnknownMfr) {
  document.getElementById("freqTH").innerHTML = "";
  document.getElementById("freqTB").innerHTML = "";
  return;
}
```

So wird die Tabelle bei fehlender Hörtechnik oder fehlendem Hersteller
einfach geleert und nicht gerendert. Die UI-Cascade in `buildImplantCard`
zeigt stattdessen den jeweiligen Hinweistext.

---

## Schritt 10 — Hinweis auf künftige Übersetzungen

Nur deutsche Strings angelegt. Englisch/Französisch/Spanisch in
einer eigenen Mini-Anleitung, sobald die deutsche GUI durch ist.

---

## Akzeptanztest

1. **Tool im Browser frisch laden** (Strg+F5, Cache leeren).
   Version 3.0.154-beta.
2. **Erststart-Anzeige:** Hörtechnik-Dropdown steht auf „Keine
   Angabe". Hersteller-Dropdown nicht sichtbar. Hinweistext
   „Bitte zuerst Hörtechnik wählen…" erscheint unter dem
   Hörtechnik-Dropdown. Frequenztabelle leer.
3. **Hörtechnik auf „CI" stellen.** Hinweis verschwindet,
   Hersteller-Dropdown sichtbar mit Default „Keine Angabe".
   Hinweistext „Bitte Hersteller wählen." erscheint. Modell,
   c-Wert, Tabelle bleiben ausgeblendet.
4. **Hersteller auf „MED-EL" stellen.** Hersteller-Hinweis weg,
   Modell-Dropdown sichtbar, c-Wert sichtbar, Frequenztabelle
   gefüllt mit den 12 MED-EL-Frequenzen.
5. **Hörtechnik zurück auf „Keine Angabe" stellen.** Versuch
   sollte möglich sein (keine Daten vorhanden). Implantat-Karte
   ist wieder im „Hörtechnik wählen"-Modus.
6. **Hörtechnik auf „Hörgerät" stellen.** Akustische Variante
   aus BA 153 wird gerendert (oder bei beide-akustisch:
   heutiges Verhalten — fällt aber in BA 155).
7. **Hörtechnik auf „Taub" stellen.** Heutiges Verhalten
   (Hinweistext „taub", keine Tabelle).
8. **Tool-Reset** über den globalen Knopf. Beide Seiten
   springen auf „Keine Angabe", Frequenztabelle leer,
   Hinweis erscheint.
9. **Datei laden** mit einem alten Datensatz, der `config: "ci"`
   und `manufacturer: "medel"` enthält. Diese Werte werden
   übernommen, kein Reset auf „unknown". Tabelle wird mit den
   geladenen Werten gefüllt.
10. **Seite wechseln** zwischen links und rechts. Cascade
    funktioniert für beide Seiten unabhängig — eine Seite kann
    z.B. „CI/MED-EL" sein, die andere „Keine Angabe".
11. **Hörtechnik-Dropdown bei vorhandenen Lautstärke-Daten**:
    Sperre aus BA 151 wirkt unverändert — Wechsel weg von
    „CI" sperrt sich, Begründungs-Popup erscheint, Wechsel
    zurück zu „Keine Angabe" auch gesperrt.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 11 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit Datei
und Zeile.

Zusätzlich melden:
- Wird beim Erststart (Cache löschen) tatsächlich „Keine Angabe"
  angezeigt?
- Bei Tool-Reset (`resetAll`): springen Hörtechnik und Hersteller
  beide auf „unknown"?
- Wenn `MFR.unknown.n === 0`: bricht irgendwo der Code, wenn
  versucht wird, eine Schleife `for (let i = 0; i < nEl; i++)`
  durchzulaufen? (Eine leere Schleife ist OK, ein
  null/undefined-Zugriff nicht.)
- Wurde der `mfrSelect.value`-Fallback an allen Stellen
  konsistent umgestellt?
- Beim Laden einer alten Speicher-Datei mit `manufacturer: "medel"`
  bleibt der Wert erhalten (keine Migration nötig)?
- Steht `js/version.js` auf `3.0.154-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js`
- `js/core.js` — `MFR.unknown` Platzhalter
- `index.html` — zwei neue Options, zwei neue Hinweis-Boxen
- `js/state-side.js` — `initSideData`-Default, fest-verdrahtete
  Init-Calls, `setSideConfig`, `syncFreqsToAcoustic`-Filter
- `js/file.js` — `resetAll`-Defaults
- `js/ui-implant.js` — Cascade-Logik, Option-Texte
- `js/freq-table.js` — Früh-Aussteig bei „unknown"
- `i18n/de.js` — vier neue Keys
