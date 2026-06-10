# Bauanleitung 37: Player — Balance/Latenz-Fix und Balance-Anwendungs-Modus

Vorbereitung für die geplanten neuen Boxen „Archiv" und „Audiologen-
Auftrag" im Tab Laden/Speichern (Bauanleitungen 38 und 39). Diese
Bauanleitung räumt drei Player-Inkonsistenzen auf:

1. **Latenz-Checkbox `plApplyLatency`**: ausgrauen, wenn der Player
   im einseitigen Side-Modus läuft (`left` oder `right`). Die
   Inter-Ohr-Verzögerung ist dort akustisch wirkungslos, weil nur
   ein Kanal ausgegeben wird.
2. **Balance-Checkbox `plApplyBalance`**: ausgrauen, wenn der Player
   **nicht** im echten Stereo-Modus läuft (`mode !== "both"`).
   Hintergrund: Balance wird in `player.js` Z. 365–369 nur im
   `both`-Zweig angewandt; in `left`/`right`/`mono` ist sie
   wirkungslos.
3. **Balance-Anwendungs-Modus** als neuer Dropdown: nur sichtbar
   und bedienbar, wenn `mode === "both"` UND Balance aktiv ist.
   Optionen: „symmetrisch" (Default), „nur links", „nur rechts".
   Persistiert in JSON und localStorage.

Diese Anleitung berührt: `index.html`, `state-side.js`, `tabs-eq.js`,
`player.js`, `init.js`, `file.js`, `i18n.js`. Außerdem
`CODESTRUKTUR.md` und `SPEC.md`.

---

## Schritt 1 — Neuer State `plBalanceMode` in `state-side.js`

In `state-side.js`, in der Player-State-Region (etwa Z. 401–406, dort
wo `plEqOn` und `plApplyBalance` deklariert sind), eine neue Zeile
**direkt nach** `let plApplyBalance = true;` einfügen:

```js
let plBalanceMode = "sym"; // "sym" | "left" | "right" — wie Stereo-Balance angewandt wird
```

---

## Schritt 2 — Neuer Helfer `getPlayerBalanceGains()` in `state-side.js`

Im selben File, **direkt nach** der bestehenden Funktion
`getPlayerBalance` (endet etwa Z. 239), folgenden Block einfügen:

```js
function getPlayerBalanceGains() {
  // Liefert {left, right} dB-Werte für die beiden Channel-Gains
  // im "both"-Modus. Berücksichtigt plBalanceMode.
  // "sym" (Default): symmetrisch ±balance, wie bisher.
  // "left":  Korrektur ausschließlich auf der linken Seite.
  // "right": Korrektur ausschließlich auf der rechten Seite.
  // Bei "left"/"right" wird der doppelte Wert auf eine Seite gelegt,
  // damit der akustische L↔R-Unterschied derselbe ist wie symmetrisch.
  const b = getPlayerBalance();
  const mode = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
  const clamp = (v) => Math.max(-60, Math.min(60, v));
  if (mode === "left") {
    return { left: clamp(2 * b), right: 0 };
  }
  if (mode === "right") {
    return { left: 0, right: clamp(-2 * b) };
  }
  return { left: b, right: -b };
}
```

`getPlayerBalance()` selbst bleibt unverändert.

---

## Schritt 3 — UI-Element im HTML (Dropdown für Balance-Modus)

In `index.html`, im Player-Panel, im Block der Player-Optionen
(Z. 1071–1085 — dort sitzen `plBalApplyBtn` und `plLatApplyBtn`),
**nach** der `<div class="control-group">` mit `plBalApplyBtn`
(Z. 1071–1078) und **vor** der `<div class="control-group">` mit
`plLatApplyBtn` (Z. 1079) folgenden Block einfügen:

```html
            <div class="control-group" id="plBalModeRow">
              <label
                for="plBalModeSelect"
                style="font-size: 0.9em; color: var(--text-muted)"
                data-t="plBalModeLabel"
              ></label>
              <select
                id="plBalModeSelect"
                class="btn btn-sm"
                style="min-width: 130px"
              >
                <option value="sym" data-t-opt="plBalModeSym"></option>
                <option value="left" data-t-opt="plBalModeLeft"></option>
                <option value="right" data-t-opt="plBalModeRight"></option>
              </select>
            </div>
```

Die `data-t-opt`-Attribute werden durch `applyLang()` aufgelöst
(siehe CODESTRUKTUR „applyLang"); die i18n-Strings folgen in
Schritt 7.

---

## Schritt 4 — Player-Code: Balance-Anwendung umstellen

### 4a. In `pBuildEQ` — Stereo-Initialisierung

In `player.js`, Z. 365–369 (innerhalb `pBuildEQ`, im `both`-Zweig
direkt nach Erzeugung von `pChannelLeftGain` / `pChannelRightGain`):

Vorher:
```js
    pChannelLeftGain = c.createGain();
    pChannelRightGain = c.createGain();
    const balance = getPlayerBalance();
    pChannelLeftGain.gain.value = dB2G(balance);
    pChannelRightGain.gain.value = dB2G(-balance);
```

Nachher:
```js
    pChannelLeftGain = c.createGain();
    pChannelRightGain = c.createGain();
    const balG = getPlayerBalanceGains();
    pChannelLeftGain.gain.value = dB2G(balG.left);
    pChannelRightGain.gain.value = dB2G(balG.right);
```

### 4b. In `pUpdEQ` — Live-Aktualisierung

In `player.js`, Z. 416–419 (innerhalb `pUpdEQ`, am Ende des
`gains.left`-Zweigs):

Vorher:
```js
    if (pChannelLeftGain)
      pChannelLeftGain.gain.value = dB2G(getPlayerBalance());
    if (pChannelRightGain)
      pChannelRightGain.gain.value = dB2G(-getPlayerBalance());
```

Nachher:
```js
    if (pChannelLeftGain || pChannelRightGain) {
      const balG = getPlayerBalanceGains();
      if (pChannelLeftGain) pChannelLeftGain.gain.value = dB2G(balG.left);
      if (pChannelRightGain) pChannelRightGain.gain.value = dB2G(balG.right);
    }
```

---

## Schritt 5 — UI-Sync-Funktion in `tabs-eq.js` erweitern

In `tabs-eq.js`, die Funktion `updBalApplyBtn` (Z. 164–178) wie folgt
**komplett ersetzen**:

Vorher:
```js
function updBalApplyBtn() {
  const btn = document.getElementById("plBalApplyBtn");
  if (!btn) return;
  if (plApplyBalance) {
    btn.textContent = t("plBalApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plBalApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}
```

Nachher:
```js
function updBalApplyBtn() {
  const btn = document.getElementById("plBalApplyBtn");
  if (!btn) return;
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const stereoActive = (mode === "both");
  // Disabled, wenn nicht im echten Stereo-Modus
  btn.disabled = !stereoActive;
  btn.style.opacity = stereoActive ? "" : "0.4";
  btn.style.cursor = stereoActive ? "" : "not-allowed";
  if (plApplyBalance && stereoActive) {
    btn.textContent = t("plBalApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plBalApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
  // Dropdown-Sichtbarkeit synchronisieren
  const row = document.getElementById("plBalModeRow");
  if (row) {
    row.style.display = (stereoActive && plApplyBalance) ? "" : "none";
  }
  const sel = document.getElementById("plBalModeSelect");
  if (sel) sel.value = (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym";
}
```

Und direkt darunter die Funktion `updLatApplyBtn` (Z. 180–194)
**komplett ersetzen**:

Vorher:
```js
function updLatApplyBtn() {
  const btn = document.getElementById("plLatApplyBtn");
  if (!btn) return;
  if (plApplyLatency) {
    btn.textContent = t("plLatApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plLatApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}
```

Nachher:
```js
function updLatApplyBtn() {
  const btn = document.getElementById("plLatApplyBtn");
  if (!btn) return;
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  const twoEarsActive = (mode === "both" || mode === "mono");
  // Disabled, wenn nur eine Seite hörbar
  btn.disabled = !twoEarsActive;
  btn.style.opacity = twoEarsActive ? "" : "0.4";
  btn.style.cursor = twoEarsActive ? "" : "not-allowed";
  if (plApplyLatency && twoEarsActive) {
    btn.textContent = t("plLatApplyOn");
    btn.style.background = "var(--success)";
    btn.style.color = "#fff";
    btn.style.borderColor = "var(--success)";
  } else {
    btn.textContent = t("plLatApplyOff");
    btn.style.background = "#e5e7eb";
    btn.style.color = "var(--text)";
    btn.style.borderColor = "var(--border)";
  }
}
```

---

## Schritt 6 — Event-Listener in `init.js`

### 6a. Listener für den Balance-Modus-Dropdown

In `init.js`, **direkt nach** dem bestehenden `plBalApplyBtn`-Click-
Listener (Z. 723–729 — endet mit `pUpdEQ();` und schließender
Klammer), folgenden Block einfügen:

```js
  document
    .getElementById("plBalModeSelect")
    .addEventListener("change", function () {
      plBalanceMode = this.value;
      pUpdEQ();
    });
```

### 6b. UI-Sync beim Toggle der Balance-Checkbox

Im bestehenden `plBalApplyBtn`-Click-Listener (Z. 723–729) den
`updBalApplyBtn()`-Aufruf so erweitern, daß auch der Dropdown sichtbar
wird, sobald Balance an ist. Das passiert in `updBalApplyBtn` bereits
durch den `plBalModeRow`-Block. **Keine** Änderung notwendig.

### 6c. UI-Sync beim Wechsel des Side-Modus

In `init.js`, im `plBothSides`-Change-Listener (Z. 127–137) und
`plMonoEQ`-Change-Listener (Z. 138–140), jeweils **nach** dem Aufruf
von `updatePlayerForSideChange()` zwei zusätzliche Zeilen einfügen:

Vorher (im `plBothSides`-Listener):
```js
      updatePlayerForSideChange();
    });
```

Nachher:
```js
      updatePlayerForSideChange();
      updBalApplyBtn();
      updLatApplyBtn();
    });
```

Vorher (im `plMonoEQ`-Listener):
```js
  document.getElementById("plMonoEQ").addEventListener("change", function () {
    updatePlayerForSideChange();
  });
```

Nachher:
```js
  document.getElementById("plMonoEQ").addEventListener("change", function () {
    updatePlayerForSideChange();
    updBalApplyBtn();
    updLatApplyBtn();
  });
```

---

## Schritt 7 — i18n-Strings (alle vier Sprachen)

In `i18n.js`, im **deutschen** Block (etwa Z. 212–215, dort wo
`plBalApply` / `plBalApplyOn` / `plBalApplyOff` stehen), direkt nach
`plBalApplyOff` drei neue Zeilen einfügen:

```js
    plBalModeLabel: "Anwendung:",
    plBalModeSym: "symmetrisch",
    plBalModeLeft: "nur links",
    plBalModeRight: "nur rechts",
```

Im **englischen** Block (etwa Z. 772–775) analog:
```js
    plBalModeLabel: "Apply to:",
    plBalModeSym: "symmetric",
    plBalModeLeft: "left only",
    plBalModeRight: "right only",
```

Im **französischen** Block (etwa Z. 1310–1313):
```js
    plBalModeLabel: "Application:",
    plBalModeSym: "symétrique",
    plBalModeLeft: "à gauche seulement",
    plBalModeRight: "à droite seulement",
```

Im **spanischen** Block (etwa Z. 1852–1855):
```js
    plBalModeLabel: "Aplicar a:",
    plBalModeSym: "simétrico",
    plBalModeLeft: "solo izquierda",
    plBalModeRight: "solo derecha",
```

---

## Schritt 8 — Persistenz: JSON-Save/Load und localStorage

### 8a. In `file.js` — `saveJson` erweitern

In `file.js`, im Save-Daten-Objekt (`saveJson`, etwa Z. 143–233), in
der Nähe der bestehenden `plApplyLatency:`-Zeile (gibt es noch
nicht im sichtbaren Save-Block — er liegt unten im File). **Such
mit grep**:

```bash
grep -n "plApplyLatency" file.js
```

Findest du in `saveJson` keine `plApplyLatency:`-Zeile, ist das ein
Hinweis darauf, daß die Persistenz dieses Feldes noch nicht
existiert. Trage **beide** Persistenzen ein. Such die Zeile mit
`playerSourceMeas: plSrcMeas,` (Z. 204) als Anker. **Direkt darüber**
diese drei Zeilen einfügen (sofern noch nicht vorhanden):

```js
    plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
    plApplyLatency: (typeof plApplyLatency !== "undefined") ? plApplyLatency : true,
    plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
```

(Wenn `plApplyLatency` bereits an anderer Stelle eingefügt ist —
etwa Z. 195 — entsprechend nicht doppelt eintragen. Sonnet:
prüfe vor dem Einfügen, ob der Key bereits da ist.)

### 8b. In `file.js` — `applyLoadedData` erweitern

In `file.js`, in `applyLoadedData` (ab Z. 404), in der Nähe des
bestehenden `plApplyLatency`-Restore-Blocks (Z. 462–465). **Direkt
nach** diesem Block folgendes einfügen:

```js
  if (typeof plApplyBalance !== "undefined") {
    plApplyBalance = (d && typeof d.plApplyBalance === "boolean")
      ? d.plApplyBalance : true;
  }
  if (typeof plBalanceMode !== "undefined") {
    plBalanceMode = (d && typeof d.plBalanceMode === "string"
                     && ["sym", "left", "right"].includes(d.plBalanceMode))
      ? d.plBalanceMode : "sym";
  }
  if (typeof updBalApplyBtn === "function") updBalApplyBtn();
```

`updBalApplyBtn()` syncht den Dropdown-Wert und die Sichtbarkeit
in einem Aufruf.

### 8c. In `init.js` — localStorage-Autosave erweitern

In `init.js`, im Autosave-Block (Z. 1169–1224 — `setInterval`-
`localStorage.setItem("ci-lb-v4", ...)`), bei der Stelle, wo
`plApplyLatency:` steht (Z. 1214), zwei zusätzliche Zeilen
**direkt darunter** einfügen:

```js
          plApplyBalance: (typeof plApplyBalance !== "undefined") ? plApplyBalance : true,
          plBalanceMode: (typeof plBalanceMode !== "undefined") ? plBalanceMode : "sym",
```

### 8d. In `init.js` — localStorage-Restore erweitern

In `init.js`, im Restore-Block direkt nach Page-Load (etwa
Z. 1108–1113, dort wo `plApplyLatency` zurückgelesen wird), nach
dem `plApplyLatency`-if-Block analoge Blöcke einfügen:

```js
      if (typeof plApplyBalance !== "undefined") {
        plApplyBalance = (d && typeof d.plApplyBalance === "boolean")
          ? d.plApplyBalance : true;
      }
      if (typeof plBalanceMode !== "undefined") {
        plBalanceMode = (d && typeof d.plBalanceMode === "string"
                         && ["sym", "left", "right"].includes(d.plBalanceMode))
          ? d.plBalanceMode : "sym";
      }
```

`updBalApplyBtn()` / `updLatApplyBtn()` werden erst in Schritt 9
beim initialen Aufruf gerufen — sie syncen dann die UI.

---

## Schritt 9 — Initial-Sync nach DOMContentLoaded

In `init.js`, etwa Z. 737–739, wo `updBalApplyBtn()` und
`updLatApplyBtn()` bereits aufgerufen werden, **nichts ändern**.
Diese Aufrufe übernehmen den initialen Sync, sobald der Player-State
aus localStorage geladen ist.

---

## Schritt 10 — `CODESTRUKTUR.md` aktualisieren

In `CODESTRUKTUR.md`, in der Zeile für `state-side.js` (Modul 3),
in der Aufzählung der globalen State-Variablen, in der Klammer mit
`(`sideData`, …, `plShowExperimental`)`, **zusätzlich** den neuen
Eintrag `plBalanceMode` einfügen.

Außerdem **im selben Block**, am Ende der Funktionsliste, ergänze
`getPlayerBalanceGains` neben `getPlayerBalance`.

Im Datenfluss-Abschnitt **„Player Side-Modi"** (etwa Z. 203–213)
einen kurzen zusätzlichen Absatz anhängen:

```
**Balance-Anwendungs-Modus** (`plBalanceMode`, state-side.js):
"sym" (Default), "left" oder "right". Steuert, wie der Balance-Wert
auf die beiden Channel-Gains verteilt wird (siehe
`getPlayerBalanceGains`). UI sichtbar nur bei `getPlayerSide() ===
"both"` und aktivierter Balance. Persistiert in JSON und
localStorage.
```

---

## Schritt 11 — `SPEC.md` aktualisieren

In `SPEC.md`, im Player-Abschnitt, einen kurzen Eintrag zur neuen
Balance-Anwendungs-Logik einfügen:

```
- Stereo-Balance: nur im echten Stereo-Modus (`getPlayerSide() ===
  "both"`) bedienbar. In `left`/`right`/`mono` ist die Balance-
  Schaltfläche ausgegraut, weil die Korrektur dort akustisch
  wirkungslos wäre.
- Bei aktiver Balance erscheint ein Dropdown „Anwendung":
  symmetrisch (Default), nur links, nur rechts. Bei einseitiger
  Anwendung wird der doppelte Wert auf eine Seite gelegt, damit
  der akustische L↔R-Unterschied derselbe ist wie symmetrisch.
- Latenzausgleich: nur in `both` und `mono` bedienbar. In
  `left`/`right` ist die Schaltfläche ausgegraut, weil
  Inter-Ohr-Verzögerung in einseitiger Wiedergabe akustisch
  wirkungslos ist.
```

---

## Nicht zu tun

- `getPlayerBalance()` NICHT verändern. Nur darüber hinaus den
  neuen Helfer `getPlayerBalanceGains()` ergänzen.
- Den `lr-balance.js`-Code NICHT anfassen (keine Auswirkung).
- Den `latency.js`-Code NICHT anfassen (UI-Disabled-Logik liegt
  in `tabs-eq.js`).
- KEINE Audio-Graph-Architektur-Änderung. Nur die Gain-Werte
  werden anders verteilt.
- Bestehende JSON-Saves müssen weiterhin geladen werden können —
  fehlende Keys liefern Defaults aus den `if (typeof … !==
  "undefined")`-Blöcken.

---

## Akzeptanztest

Vorbereitung: Daten mit gemessenen Stereo-Balance-Werten (z.B.
`lrResults` mit nicht-null Werten) und einer gemessenen Latenz
(`latencyResult` mit `valueMs` > 0). Player mit geladener Stereo-
Audiodatei.

1. **Side-Modus „beide Seiten" (Stereo)** aktivieren (Checkbox
   `plBothSides` an, `plMonoEQ` aus).
   - Erwartet: Balance-Button bedienbar, Latenz-Button bedienbar.
   - Erwartet: Wenn Balance an, erscheint Dropdown „Anwendung:
     symmetrisch | nur links | nur rechts".

2. **Dropdown auf „nur links" stellen**, Audio laufen lassen.
   - Erwartet: Linker Kanal lauter, rechter Kanal unverändert
     (kein dB-Offset rechts). Wenn vorher „symmetrisch" gewählt
     war, klingt der L↔R-Unterschied ähnlich, aber rechts wirkt
     nicht mehr abgesenkt.

3. **Dropdown auf „nur rechts" stellen**.
   - Erwartet: Rechter Kanal leiser, linker Kanal unverändert.

4. **Side-Modus „nur links"** aktivieren (`plBothSides` aus,
   Side-Button links).
   - Erwartet: Balance-Button **ausgegraut** (Cursor „not-allowed").
   - Erwartet: Latenz-Button **ausgegraut**.
   - Erwartet: Dropdown „Anwendung" verschwindet.

5. **Side-Modus „mono"** aktivieren (`plBothSides` an, `plMonoEQ`
   an).
   - Erwartet: Balance-Button **ausgegraut**.
   - Erwartet: Latenz-Button **bedienbar** (Inter-Ohr-Versatz wirkt
     auch im Mono-Output, weil beide Kanäle Audio enthalten).

6. **Speichern + neu laden** (JSON-Speichern, danach JSON-Laden
   derselben Datei).
   - Erwartet: Gewählter Anwendungs-Modus bleibt erhalten.

7. **Browser-Reload** mit Daten aus localStorage.
   - Erwartet: Gewählter Anwendungs-Modus bleibt erhalten.

8. **Reset („Alles zurücksetzen")**.
   - Erwartet: Anwendungs-Modus zurück auf „symmetrisch".

9. **Bestehende Funktionalität**:
   - Symmetrischer Modus klingt **identisch** zur Version vor
     dem Build (verifizierbar durch Wechsel zwischen den
     Dropdown-Optionen — „symmetrisch" muß sich gleich anhören
     wie vor dem Build).
   - EQ-Anwendung, NH-Sim, Quellen-Toggles, MAPLAW, Warping
     bleiben unverändert.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jeden Akzeptanz-Punkt einzeln durchgehen
und in dieser Tabelle eintragen:

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| `plBalanceMode` deklariert in state-side.js | | |
| `getPlayerBalanceGains` neu in state-side.js | | |
| `pBuildEQ` nutzt `getPlayerBalanceGains` | | |
| `pUpdEQ` nutzt `getPlayerBalanceGains` | | |
| `updBalApplyBtn` blendet Dropdown + disabled je Side-Modus | | |
| `updLatApplyBtn` disabled in `left`/`right` | | |
| Dropdown `plBalModeSelect` im HTML neben Balance-Button | | |
| Listener für `plBalModeSelect` in init.js | | |
| `plBothSides`-/`plMonoEQ`-Listener rufen `updBalApplyBtn`/`updLatApplyBtn` | | |
| i18n-Strings für `plBalModeLabel`/`Sym`/`Left`/`Right` in DE, EN, FR, ES | | |
| Persistenz in file.js (Save + Load) inkl. Default-Migration | | |
| Persistenz in init.js localStorage (Save + Restore) | | |
| `getPlayerBalance` unverändert | | |
| Kein Audio-Graph-Architektur-Eingriff (nur Gain-Werte) | | |
| CODESTRUKTUR.md aktualisiert | | |
| SPEC.md aktualisiert | | |

Wenn ein Punkt als „Unklar" markiert ist, dem User vor dem Bauen
nachfragen — nicht stillschweigend annehmen.
