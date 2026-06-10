# BAUANLEITUNG 153 — Akustische Frequenztabelle, Spiegel-Ausschluß, Auto-Ausschluß bei „stumm"

**Zieldateien:** `js/freq-table.js`, `i18n/de.js`, `js/version.js`

**Voraussetzung:** BA 152 abgeschlossen. Stand `js/version.js` = `3.0.152-beta`.

**Version:** 3.0.152-beta → **3.0.153-beta**

---

## Kontext

Bisher zeigt die Frequenztabelle im Reiter „Implantat" für akustische
Seiten (Hörgerät / schwerhörig / normal) dieselbe Spaltenstruktur wie
für CI: Hz-eigen-Eingabe, Hörschwelle, Komfortlautstärke. Das ergibt
für akustisches Restgehör keinen Sinn — diese Spalten werden nicht
gebraucht.

Diese Anleitung baut für akustische Seiten eine reduzierte
Tabellenvariante: weniger Spalten, gespiegelte Hz-Werte der CI-
Gegenseite (read-only, schon durch `syncFreqsToAcoustic` angelegt),
eigene Status-Liste mit akustischer Wortwahl, gespiegelter Ausschluß
der CI-Gegenseite.

**Konkrete Änderungen:**

1. Bei akustischer Konfig nur **8 Spalten** (statt 11): Position,
   Hz-Standard, Cent, Play, Hold, Status, Ausschluß, Notiz. Spalten
   Hz-eigen, Hörschwelle (THR), Komfortlautstärke (MCL/CL/CU) entfallen.
2. **Status-Dropdown** auf akustisch: sechs Stufen (ok, leicht
   beeinträchtigt, mittel beeinträchtigt, stark beeinträchtigt, fast
   stumm, stumm). Kein „im CI deaktiviert". Datenwerte
   (`noisyLess`/`noisyMore`/`noisyHeavy`/`almostMute`/`mute`) bleiben
   identisch zur CI-Seite — nur die Anzeigetexte ändern sich.
3. **Spiegel-Ausschluß:** Wenn eine Elektrode auf CI-Seite per Status
   „im CI deaktiviert" oder per manuellem Haken ausgeschlossen ist,
   ist die entsprechende Frequenz auf akustischer Seite ebenfalls
   automatisch und unveränderlich als ausgeschlossen markiert.
   Tooltip: „im CI deaktiviert oder ausgeschlossen". Umgekehrte
   Richtung: keine Wirkung auf CI.
4. **Auto-Ausschluß bei Status „stumm"** — gilt für **beide** Seiten
   (CI und akustisch): wenn der Nutzer „stumm" setzt, wird der
   Ausschluß-Haken automatisch gesetzt. Im Unterschied zur
   Deaktivierung ist der Haken weiter manuell lösbar.

**Status-Sperre aus BA 152** wirkt nur auf der CI-Seite, weil die
Option „im CI deaktiviert" auf akustisch nicht existiert. Die
akustische Status-Spalte ist deshalb ohne Info-Symbol.

**Nicht enthalten:** „beide Seiten akustisch = Tabelle ausblenden"
kommt in einer späteren Anleitung. Aktuelles Verhalten in diesem
Fall bleibt unverändert (Tabelle wird mit Default-Hersteller-Raster
gerendert).

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.0.153-beta";
```

---

## Schritt 2 — i18n-Strings ergänzen

In `i18n/de.js`, im Dependency-Lock/akustischen Block (nach
`depFieldStatus` aus BA 152), einfügen:

```js
  // Akustische Status-Labels (BA 153)
  acStOk: "ok",
  acStMildImpaired: "leicht beeinträchtigt",
  acStMediumImpaired: "mittel beeinträchtigt",
  acStStrongImpaired: "stark beeinträchtigt",
  acStAlmostMute: "fast stumm",
  acStMute: "stumm",
  // Spiegel-Ausschluß Tooltip (BA 153)
  exclCiMirrored: "im CI deaktiviert oder ausgeschlossen",
```

---

## Schritt 3 — Auto-Ausschluß bei Status „stumm" (CI- und akustisch)

Datei `js/freq-table.js`, im Status-Change-Handler (`.ss`-Schleife,
derzeit ab Z. 107).

**Vorher:**
```js
tb.querySelectorAll(".ss").forEach((s) =>
  s.addEventListener("change", (e) => {
    const idx = +e.target.dataset.i,
      val = e.target.value || null;
    elSt[idx] = val;
    if (val === "deactivated") {
      elExDur[idx] = elExDur[idx] || Date.now();
    }
    // If status changed away from deactivated, do NOT auto-clear elExDur
    buildFreqTable();
    updRef();
    if (typeof depLockApply === 'function') depLockApply();
  }),
);
```

**Nachher:**
```js
tb.querySelectorAll(".ss").forEach((s) =>
  s.addEventListener("change", (e) => {
    const idx = +e.target.dataset.i,
      val = e.target.value || null;
    elSt[idx] = val;
    // BA 153: Auto-Ausschluß bei „deactivated" UND „mute" (CI- und akustisch)
    if (val === "deactivated" || val === "mute") {
      elExDur[idx] = elExDur[idx] || Date.now();
    }
    // Status-Wechsel weg von „deactivated"/„mute" entfernt elExDur NICHT
    // (manuell wieder einschließen jederzeit möglich, außer Spiegel-Ausschluß).
    buildFreqTable();
    updRef();
    if (typeof depLockApply === 'function') depLockApply();
  }),
);
```

(Nur die eine Zeile in der `if`-Bedingung ändert sich.)

---

## Schritt 4 — Akustische Tabellen-Variante

Datei `js/freq-table.js`, Funktion `buildFreqTable()` ab Z. 4.

### 4a) Akustisch-Flag direkt nach `cfg`-Definition

**Vorher (Z. 6-8):**
```js
const cfg = sideData[activeSide].config || "ci";
const elPfx = cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
const elLbl = cfg === "ci" ? t("cfgLblElCI") : t("cfgLblElAcoustic");
```

**Nachher:**
```js
const cfg = sideData[activeSide].config || "ci";
const isAcoustic = ["hg", "normal", "shoh"].includes(cfg);  // BA 153
const elPfx = cfg === "ci" ? t("cfgLblEnCI") : t("cfgLblEnAcoustic");
const elLbl = cfg === "ci" ? t("cfgLblElCI") : t("cfgLblElAcoustic");
```

### 4b) Header bei akustisch reduziert

**Vorher (Z. 17-18):**
```js
document.getElementById("freqTH").innerHTML =
  `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
```

**Nachher:**
```js
if (isAcoustic) {
  // BA 153: 8 Spalten ohne Hz-eigen, THR, Upper
  document.getElementById("freqTH").innerHTML =
    `<th>${elLbl}</th>` +
    `<th>${t("thHzStd")}</th>` +
    `<th title="${t("thCentTip")}">${t("thCent")}</th>` +
    `<th>${t("thPlay")}</th>` +
    `<th>${t("thHold")}</th>` +
    `<th>${t("thSt")}</th>` +
    `<th style="white-space:nowrap">${t("thExclCb")}</th>` +
    `<th>${t("thNote")}</th>`;
} else {
  document.getElementById("freqTH").innerHTML =
    `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
}
```

### 4c) Akustischer Row-Render-Branch

In der `for (let i = 0; i < nEl; i++)`-Schleife, **direkt nach**
`const tr = document.createElement("tr");` und **vor** den bestehenden
Variablen-Berechnungen (`let ex = ""; ... isExcl, isDeact, stdHz, ownVal, ...`):

Den akustischen Branch einfügen, der bei Bedarf `tr.innerHTML` setzt
und mit `continue;` die CI-Logik überspringt.

**Einfügen direkt nach `const tr = document.createElement("tr");`:**

```js
    // BA 153: akustischer Branch
    if (isAcoustic) {
      let ex = "";
      if (i === 0) ex = ` <span class="el-extra">(${t("apikal")})</span>`;
      if (i === nEl - 1) ex = ` <span class="el-extra">(${t("basal")})</span>`;
      const stdHz = Math.round(freqs[i]);
      const centVal = Math.round(hzToCent(effFreq(i)));
      const centTxt = (centVal > 0 ? "+" : "") + centVal;
      // Spiegel-Ausschluß aus CI-Gegenseite
      const ciSide = activeSide === "left" ? "right" : "left";
      const ciIsActive = (sideData[ciSide].config || "ci") === "ci";
      const ciMirroredExcl = ciIsActive && (
        (sideData[ciSide].elSt && sideData[ciSide].elSt[i] === "deactivated") ||
        (sideData[ciSide].elExDur && sideData[ciSide].elExDur[i] != null)
      );
      const ownExcl = elExDur[i] != null;
      const effExcl = ownExcl || ciMirroredExcl;
      if (effExcl) tr.style.opacity = "0.55";
      // Status-Optionen ohne „im CI deaktiviert", mit akustischer Wortwahl
      const so_ac =
        `<option value="">${t("acStOk")}</option>` +
        `<option value="noisyLess">${t("acStMildImpaired")}</option>` +
        `<option value="noisyMore">${t("acStMediumImpaired")}</option>` +
        `<option value="noisyHeavy">${t("acStStrongImpaired")}</option>` +
        `<option value="almostMute">${t("acStAlmostMute")}</option>` +
        `<option value="mute">${t("acStMute")}</option>`;
      // Checkbox: bei Spiegel-Ausschluß fest, sonst frei
      const cbAttrs = ciMirroredExcl
        ? ' disabled title="' + t('exclCiMirrored') + '"'
        : '';
      tr.innerHTML =
        `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
        `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
        `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px;text-align:right">${centTxt}</td>` +
        `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
        `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
        `<td><select class="ss" data-i="${i}">${so_ac}</select></td>` +
        `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${effExcl ? " checked" : ""}${cbAttrs}></td>` +
        `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
      tb.appendChild(tr);
      tr.querySelector(".ss").value = elSt[i] || "";
      continue;
    }
    // === Ende akustischer Branch — ab hier CI-Logik (unverändert) ===
```

Hinweis: Die existierenden Variablen `let ex = ""; const isExcl = ...;
const isDeact = ...; const stdHz = ...; const ownVal = ...; const thrVal
= ...; const upperVal = ...; const centVal = ...; const centTxt = ...;`
und der CI-`tr.innerHTML`-Block bleiben **unverändert**. Der akustische
Branch hat eigene Lokal-Variablen (mit `let`/`const` im Block-Scope).

### 4d) Hz-, THR-, Upper-Change-Handler im akustischen Fall

Die existierenden Handler `tb.querySelectorAll(".fo")...`,
`tb.querySelectorAll(".it")...`, `tb.querySelectorAll(".iu")...`
laufen im akustischen Fall ins Leere, weil keine `.fo`/`.it`/`.iu`-Inputs
gerendert werden. Keine Anpassung nötig — `querySelectorAll` liefert
einfach eine leere Liste.

### 4e) Sicherstellen, daß `updRef()` und andere Refresh-Funktionen
nicht stolpern, wenn die Tabelle nur 8 Spalten hat

Per `grep -n "updRef\|querySelectorAll(.ss\|querySelectorAll(.ec\|querySelectorAll(.ni" js/`
prüfen, ob andere Module fest 11 Spalten erwarten oder spaltenagnostisch
arbeiten. Sonnet soll im Bericht angeben, falls eine Auswertung auf die
fehlenden Spalten (.fo/.it/.iu) zugreift und dabei in einen Null/Undefined-
Pfad läuft. Mögliche Verdachtsstellen:
- `js/implant-validate.js` (Plausibilitätsprüfung) — Spec sagt, sie wird nur
  bei CI gebraucht. Aktuelles Verhalten prüfen, ob sie bei akustischer
  Konfig sauber überspringt.
- `js/print.js`, `js/print-md.js`, `js/file.js` saveJson/loadJson —
  schreiben/lesen aus `elFreqOwn`, `implant.thr`, `implant.mcl`. Auf
  akustischer Seite sollten diese Werte einfach null bleiben.

---

## Akzeptanztest

1. **Tool frisch laden.** Version 3.0.153-beta.
2. Linke Seite: Hörtechnik „CI" mit Hersteller MED-EL (Default).
   Rechte Seite: Hörtechnik auf „Normal" stellen.
3. **Rechte Seite öffnen** (Knopf „rechts"). Die Frequenztabelle zeigt
   nur **8 Spalten**: Position, Hz, Cent, Play, Hold, Status,
   Ausschluß, Notiz. Spalten für Hz-eigen, Hörschwelle und
   Komfortlautstärke fehlen.
4. **Hz-Werte** auf der akustischen Seite entsprechen den 12
   MED-EL-Frequenzen der CI-Gegenseite.
5. **Status-Dropdown** auf einer Zeile öffnen. Sechs Einträge: ok,
   leicht beeinträchtigt, mittel beeinträchtigt, stark beeinträchtigt,
   fast stumm, stumm. **Kein** „im CI deaktiviert".
6. Auf rechts (akustisch) bei Elektrode 5 Status **„fast stumm"**
   wählen. Erwartet: Status gesetzt, **kein** automatischer Ausschluß-
   Haken.
7. Auf rechts bei Elektrode 6 Status **„stumm"** wählen. Erwartet:
   Status gesetzt UND Ausschluß-Haken automatisch gesetzt. Haken ist
   abhakbar (keine fest-Sperre).
8. Den eben gesetzten Haken bei Elektrode 6 **manuell entfernen**.
   Erwartet: funktioniert, Haken weg, Status bleibt auf „stumm".
9. **Auf linke Seite wechseln** (CI). Bei Elektrode 3 Status
   **„im CI deaktiviert"** setzen. Erwartet: Ausschluß-Haken
   automatisch gesetzt UND nicht mehr abhakbar (alt-bekanntes
   Verhalten).
10. **Auf linke Seite (CI) bei Elektrode 7 Status „stumm" setzen.**
    Erwartet: Ausschluß-Haken automatisch gesetzt — **abhakbar**
    (neu mit BA 153). Manuell entfernen funktioniert.
11. **Auf rechte Seite (akustisch) wechseln.** Bei Elektrode 3 ist
    der Ausschluß-Haken **gesetzt und nicht abhakbar** (gespiegelt
    von CI-Deaktivierung). Hover oder Tap mit gedrückter Maustaste
    zeigt Tooltip „im CI deaktiviert oder ausgeschlossen".
12. Versuchen, den gespiegelten Haken auf akustisch zu entfernen.
    Erwartet: nicht möglich (Checkbox disabled).
13. **Status auf akustischer Seite für Elektrode 3 wählen** (z.B.
    „leicht beeinträchtigt"). Erwartet: Status-Dropdown ist
    normal bedienbar — nur die Ausschluß-Spalte ist gesperrt.
14. **Auf linke Seite (CI) bei Elektrode 3 Status wieder auf „ok"
    setzen** und Ausschluß-Haken manuell entfernen. Auf rechte
    Seite wechseln: gespiegelter Ausschluß bei Elektrode 3 ist
    weg, Haken jetzt frei bedienbar.
15. **Linke Seite Hörtechnik von „CI" auf „Normal" stellen**
    (also auf beiden Seiten akustisch). Erwartet: Verhalten wie
    bisher — Tabelle wird mit Default-Hersteller-Raster gezeigt.
    (Konzept-Beschluß „Tabelle aus" in späterer Anleitung.)
16. **Smartphone-Touch-Test** (Devtools-Touch-Modus): Tap auf
    gespiegelten Haken — Tooltip-Text sollte sich melden. Tap
    auf Status-Dropdown öffnet die Liste normal.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 16 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit Datei
und Zeile.

Zusätzlich melden:
- Wird im akustischen Pfad `continue;` am Ende des Branches
  ausgeführt, sodaß die CI-Logik nicht zusätzlich läuft?
- Wurde der Status-Change-Handler so erweitert, daß „mute"
  ebenfalls automatischen Ausschluß setzt?
- Gibt es Stellen außerhalb von `freq-table.js`, die auf
  `.fo`/`.it`/`.iu`-Inputs zugreifen und dabei stolpern, wenn
  die akustische Tabelle ohne diese Spalten gerendert wird?
  (`grep -n "\\.fo\\|\\.it\\|\\.iu" js/`)
- Sind die sechs akustischen Status-Werte in allen sechs
  i18n-Keys gesetzt?
- Steht `js/version.js` auf `3.0.153-beta`?

Bei jedem Punkt mit „unklar" rückfragen, nicht stillschweigend
weitermachen.

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/freq-table.js` — `isAcoustic`-Flag, Header-Variante, akustischer
  Row-Branch, erweiterter Auto-Ausschluß im Status-Change-Handler
- `i18n/de.js` — sechs akustische Status-Labels, ein
  Spiegel-Ausschluß-Tooltip

---

## Nicht in dieser Bauanleitung enthalten

- **BA 154** — „Keine Angabe"-Default für Hörtechnik- und
  Hersteller-Auswahl, UI-Cascade beim Verstecken der gesamten
  Hörtechnik-Sektion, „beide akustisch = Tabelle aus".
- **BA 155** — Schnappschuß + Hinweis-Banner für Stereo-Balance und
  Latenz.
- **BA 156** — Differenzierte Lösch-Knöpfe im FreqMatch-Ergebnis.
- Übersetzungen en/fr/es — eigene Mini-Anleitung.
