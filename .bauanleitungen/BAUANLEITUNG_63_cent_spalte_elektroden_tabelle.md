# Bauanleitung 63 — Cent-Spalte in der Elektroden-Tabelle

## Ziel

In der Elektroden-Tabelle im Tab **Implantat** (gebaut durch
`buildFreqTable` in `freq-table.js`) eine neue Spalte **„Cent"**
einfügen, die für jede Elektrode den **Cent-Wert relativ zu 1000 Hz**
anzeigt. Die Berechnung nutzt `hzToCent(effFreq(i))` aus
`core.js` (eingeführt in Bauanleitung 62).

Zweck: Der Nutzer bekommt eine direkte Orientierung, wo die
Elektroden im Frequenzraum liegen, in derselben Einheit, in der
die Kurven-Funktionen seit Bauanleitung 62 rechnen.

**Spaltenposition:** zwischen „Hz eigene" und „Schwelle".
**Cent-Wert:** wird aus der **effektiven** Frequenz berechnet
(`effFreq(i)` = `elFreqOwn[i] ?? freqs[i]`) — d. h. wenn der Nutzer
eine eigene Frequenz gesetzt hat, zeigt die Cent-Spalte den
abweichenden Wert; sonst den Standard-Wert.

Wertbereich:
- Negative Werte für Elektroden unter 1000 Hz (z. B. MED-EL E1
  bei 120 Hz → ca. −3670 ¢).
- Positive Werte darüber (z. B. MED-EL E12 bei 7410 Hz → ca. +3470 ¢).
- 0 ¢ exakt bei 1000 Hz (sollte fast nie auf einer realen Elektrode
  landen, aber als Referenz im Tooltip erkennbar sein).

Sonst keine weiteren UI- oder Logik-Änderungen.

---

## 1. Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "3.0.63-beta";
```

---

## 2. Spalte einfügen in `js/freq-table.js`

### 2a. Header-Zeile (Z. 17–18)

**Vorher:**

```js
document.getElementById("freqTH").innerHTML =
  `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
```

**Nachher:**

```js
document.getElementById("freqTH").innerHTML =
  `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
```

### 2b. Zeilen-HTML (Z. 45–55) — Cent-Zelle ergänzen

Direkt **nach** der `<td>`-Zelle für `ownVal` (heute Z. 48) und
**vor** der `<td>`-Zelle für `thrVal` (heute Z. 49) eine neue
Zelle einfügen.

**Vorher (Auszug):**

```js
tr.innerHTML =
  `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
  `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
  `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
  `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
  ...
```

**Nachher (gleicher Block mit eingefügter Cent-Zelle):**

```js
const centVal = Math.round(hzToCent(effFreq(i)));
const centTxt = (centVal > 0 ? "+" : "") + centVal;
tr.innerHTML =
  `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
  `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
  `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
  `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px;text-align:right">${centTxt}</td>` +
  `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
  ...
```

Begründung Style:
- Gleicher graue-Mono-Stil wie die Std-Hz-Zelle (passive Anzeige,
  nicht editierbar).
- `text-align:right`, weil Cent-Werte mit Vorzeichen unterschiedlich
  lang werden (z. B. `−3670` vs. `+135`); rechtsbündig wirkt
  ruhiger als zentriert.
- Vorzeichen `+` für positive Werte explizit dranschreiben, damit
  Plus/Minus visuell symmetrisch lesbar sind.

### 2c. Re-Render nach Hz-eigen-Änderung

In Z. 60–73 hängt am `.fo`-Input-Change-Handler heute kein
`buildFreqTable()`-Aufruf. Das bedeutet: Wenn der Nutzer eine
eigene Frequenz eingibt, ändert sich der Cent-Wert in der
Anzeige **erst** beim nächsten Rebuild. Damit die Cent-Spalte
sofort konsistent bleibt, am Ende des `.fo`-Change-Handlers
`buildFreqTable()` aufrufen.

**Vorher (Z. 60–73):**

```js
tb.querySelectorAll(".fo").forEach((inp) =>
  inp.addEventListener("change", (e) => {
    const i = +e.target.dataset.i,
      v = parseFloat(e.target.value);
    if (e.target.value === "" || isNaN(v)) {
      elFreqOwn[i] = null;
      e.target.value = "";
    } else if (v >= 20 && v <= 20000) {
      elFreqOwn[i] = v;
    } else {
      e.target.value = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
    }
  }),
);
```

**Nachher:**

```js
tb.querySelectorAll(".fo").forEach((inp) =>
  inp.addEventListener("change", (e) => {
    const i = +e.target.dataset.i,
      v = parseFloat(e.target.value);
    if (e.target.value === "" || isNaN(v)) {
      elFreqOwn[i] = null;
      e.target.value = "";
    } else if (v >= 20 && v <= 20000) {
      elFreqOwn[i] = v;
    } else {
      e.target.value = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
      return; // ungültiger Wert: keine Re-Render
    }
    buildFreqTable();
  }),
);
```

Begründung: `buildFreqTable()` rendert die ganze Tabelle neu
und aktualisiert dabei die Cent-Spalte. Der Fokus geht zwar
verloren — das ist akzeptabel, weil der Nutzer nach „Enter" /
Tab-Wechsel eh weiterklickt.

(Alternativ: nur die Cent-Zelle gezielt updaten. Das ist
sparsamer, aber bei nur einer betroffenen Zelle pro Edit
unverhältnismäßig komplizierter. Bleib beim vollen Rebuild.)

---

## 3. i18n — neue deutsche Strings

In `i18n/de.js` im `Object.assign(L.de, { ... })`-Block ergänzen:

```js
thCent: "Cent",
thCentTip: "Cent relativ zu 1000 Hz (Audiologie-Standard). Negativ für Frequenzen unter 1 kHz, positiv darüber.",
```

`en.js`, `fr.js`, `es.js` **nicht** anfassen — fehlende Schlüssel
fallen auf Deutsch zurück. Die Übersetzungen kommen in der
Mini-Anleitung zusammen mit den anderen Cent-Strings aus
Bauanleitung 62.

---

## 4. Doku-Updates

### 4a. `docs/spec/03-implantat.md` (oder wo die Elektroden-
Tabelle beschrieben ist)

Den Spalten-Aufbau der Elektroden-Tabelle aktualisieren: zwischen
„Hz eigene" und „Schwelle" liegt jetzt die Spalte „Cent" mit
dem Wert `Math.round(hzToCent(effFreq(i)))` re 1000 Hz. Nicht
editierbar, rein informativ.

Falls die Spec-Datei noch nicht existiert oder den Tabellen-
Aufbau nicht beschreibt: keinen neuen Abschnitt anlegen — der
Code ist selbsterklärend genug. Falls doch beschrieben, ergänzen.

### 4b. `docs/CODESTRUKTUR.md`

Falls im Eintrag zu `freq-table.js` der Tabellen-Aufbau erwähnt
ist: Cent-Spalte ergänzen. Ansonsten unverändert.

### 4c. Bauanleitung-62-Selbstprüfung

Nicht relevant — Bauanleitung 63 ist eigenständig und setzt
auf 62 auf, ergänzt aber nichts an 62 selbst.

---

## 5. Akzeptanztest (Klick-für-Klick)

1. **Tab „Implantat"** öffnen. Elektroden-Tabelle anschauen.
   **Erwartet:** Zwischen den Spalten „Hz eigene" und „Schwelle"
   gibt es eine neue Spalte mit Header „Cent". Tooltip beim
   Hover über den Header zeigt: „Cent relativ zu 1000 Hz
   (Audiologie-Standard). Negativ für Frequenzen unter 1 kHz,
   positiv darüber."

2. **Hersteller MED-EL**, alle Default-Frequenzen.
   **Erwartet (Stichprobe):**
   - E1 (120 Hz) → ca. `−3670`
   - E5 (836 Hz) → ca. `−310`
   - E12 (7410 Hz) → ca. `+3471`
   - Vorzeichen sichtbar (positive Werte mit führendem `+`).

3. **Hersteller Cochlear**, alle Defaults.
   **Erwartet (Stichprobe):**
   - E1 (250 Hz) → ca. `−2400`
   - E7 (1000 Hz) → ca. `0`
   - E22 (8000 Hz) → ca. `+3600`

4. **Eigene Frequenz** eintragen: bei MED-EL in der Spalte
   „Hz eigene" für E5 z. B. `1000` eingeben, dann Tab oder Enter.
   **Erwartet:** Die Cent-Spalte für E5 zeigt jetzt `0` (statt
   ca. `−310`). Andere Zeilen unverändert.

5. **Wert wieder leeren** (Backspace in derselben Zelle, dann
   Enter).
   **Erwartet:** Cent-Wert für E5 ist wieder ca. `−310`.

6. **Ungültige Frequenz** (z. B. `999999`) eingeben.
   **Erwartet:** Eingabe wird verworfen, Cent-Spalte bleibt
   unverändert. Keine Re-Render-Sprünge.

7. **Mobile (≤ 768 px):** Tabelle bleibt scrollbar; Cent-Spalte
   ist sichtbar oder per horizontalem Scroll erreichbar.

8. **Tab wechseln** zu „Kurven", Pivot aktivieren, Mitte auf
   `500` Hz setzen. Zurück zum Implantat-Tab.
   **Erwartet:** Die Cent-Spalte zeigt dieselben Werte wie
   vorher (keine Interferenz mit Kurven-Tab).

---

## 6. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie aus §5 einzeln
durchgehen: **erfüllt / nicht erfüllt / unklar**, mit Datei- und
Zeilenangabe.

Zusätzlich technisch prüfen:

- `js/version.js`: `APP_VERSION` ist `"3.0.63-beta"`.
- `js/freq-table.js` Z. 18: Cent-Spalten-Header mit Tooltip.
- `js/freq-table.js` Zeilen-Render: `hzToCent(effFreq(i))` wird
  aufgerufen, Vorzeichen explizit gesetzt, neue Zelle ist
  vorhanden und nicht editierbar (kein `<input>`).
- `.fo`-Change-Handler ruft `buildFreqTable()` am Ende auf.
- `i18n/de.js`: `thCent` und `thCentTip` existieren.
- `en.js`, `fr.js`, `es.js` **nicht** angefasst.
- Nach Hersteller-Wechsel (MED-EL ↔ Cochlear ↔ AB) zeigt die
  Cent-Spalte sofort die neuen Werte (das geschieht automatisch,
  weil `switchMfr` → `buildFreqTable` ruft).

Wenn ein Punkt **unklar** bleibt: Rückfrage stellen, nicht
stillschweigend annehmen.

---

## 7. Folge-Anleitungen (nicht in diese Anleitung)

- **Migrations-Warnung präzisieren** (eigene Folge-Anleitung 64):
  Den Toast `loadMigratedCurves` (eingeführt in Bauanleitung 62)
  **nicht** anzeigen, wenn für **beide Seiten** gilt — alle vier
  migrationsrelevanten Kurven (tilt, scurve, pivot, gauss) haben
  `strength === 0`, **oder** nur `speech` (SII) hat eine von 0
  abweichende Stärke. Das `on`-Flag ist dabei egal: auch eine
  deaktivierte Kurve mit Wert ≠ 0 zählt als „betroffen".
  Begründung: SII bleibt unverändert frequenzbasiert, und Kurven
  mit Stärke 0 verändern den Klang nicht — eine Warnung wäre
  dort übergriffig.
- **Mini-Anleitung Übersetzungen**: `en.js`, `fr.js`, `es.js`
  für `lvPrUnitHz`, `lvPrUnitCent`, `loadMigratedCurves`,
  `thCent`, `thCentTip` ergänzen.

---
