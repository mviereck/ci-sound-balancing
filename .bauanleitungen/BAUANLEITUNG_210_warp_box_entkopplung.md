# BAUANLEITUNG 210 — Warp-Box-Entkopplung

Ziel: Das Dreieck-Symbol neben dem Warp-Toggle klappt die Settings-Box
unabhängig vom Toggle-Zustand auf/zu. Die Box ist beim Seitenstart
zugeklappt. Die Einstellungen darin bleiben immer bedienbar, auch wenn
Warping ausgeschaltet ist.

Reihenfolge: Diese Anleitung zuerst ausführen, danach BA 211, danach BA 212.

---

## Schritt 1 — Versionsnummer setzen

`js/version.js`:
```
const APP_VERSION = "3.2.210-beta";
```

---

## Schritt 2 — State-Variable in `freq-warp.js`

In `js/freq-warp.js`, nach Zeile 14 (`let pWarpOn = false;`), einfügen:

```js
let pWarpSettingsOpen = false;
```

---

## Schritt 3 — `pWarpUpdUI()` entkoppeln (`freq-warp.js`)

In `pWarpUpdUI()` die zwei Zeilen, die `settingsBox` steuern (aktuell
ca. Z. 652–653):

```js
// VORHER:
  const settingsBox = document.getElementById("plWarpSettingsBox");
  if (settingsBox) settingsBox.style.display = pWarpOn ? "" : "none";
```

ersetzen durch:

```js
// NACHHER:
  const settingsBox = document.getElementById("plWarpSettingsBox");
  if (settingsBox) settingsBox.style.display = pWarpSettingsOpen ? "" : "none";
  const warpChevron = document.getElementById("plWarpSettingsToggle");
  if (warpChevron) warpChevron.textContent = pWarpSettingsOpen ? "▼" : "▶";
```

`▼` = ▼ (auf), `▶` = ▶ (zu).

---

## Schritt 4 — Dreieck-Button in `index.html`

Den Block (ca. Z. 1213–1221) der Warp-Zeile:

```html
            <div class="control-group" style="gap: 8px">
              <button
                class="btn btn-sm"
                id="plWarpOn"
                style="font-weight: 600; min-width: 180px; border-radius: 6px"
              ></button>
              <span data-t="plWarpExpNote" style="font-size:0.82em;color:var(--text-muted)"></span>
              <span id="plLockHintWarp" style="display:none;font-size:0.82em;color:var(--warning);margin-left:8px"></span>
            </div>
```

ersetzen durch:

```html
            <div class="control-group" style="gap: 8px">
              <button
                class="btn btn-sm"
                id="plWarpOn"
                style="font-weight: 600; min-width: 180px; border-radius: 6px"
              ></button>
              <button
                id="plWarpSettingsToggle"
                type="button"
                style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:2px 4px;color:var(--text-muted);line-height:1;vertical-align:middle"
              >&#9654;</button>
              <span data-t="plWarpExpNote" style="font-size:0.82em;color:var(--text-muted)"></span>
              <span id="plLockHintWarp" style="display:none;font-size:0.82em;color:var(--warning);margin-left:8px"></span>
            </div>
```

`&#9654;` = ▶ (Startzustand: zugeklappt).

---

## Schritt 5 — Event-Handler in `init.js`

In `js/init.js`, direkt nach dem Block des `plWarpOn`-Handlers
(nach dem `addEventListener("click", ...)` für `plWarpOn`, ca. Z. 390–410),
folgenden Block einfügen:

```js
  // Dreieck-Button: Warp-Einstellungen auf-/zuklappen
  document.getElementById("plWarpSettingsToggle").addEventListener("click", function () {
    pWarpSettingsOpen = !pWarpSettingsOpen;
    pWarpUpdUI();
  });
```

---

## Schritt 6 — Keine i18n-Änderung nötig

Der Button zeigt nur Unicode-Symbole (▶/▼), kein übersetzter Text.
Kein Eintrag in `i18n/de.js` erforderlich.

---

## Selbstprüfungs-Auftrag

Vor der Fertig-Meldung jede Zeile einzeln abhaken:

1. `pWarpSettingsOpen` in `freq-warp.js` deklariert und mit `false` initialisiert?
2. `pWarpUpdUI()` setzt `settingsBox.style.display` ausschließlich nach `pWarpSettingsOpen`, nicht mehr nach `pWarpOn`?
3. `pWarpUpdUI()` aktualisiert `plWarpSettingsToggle.textContent` auf ▼ bzw. ▶?
4. `plWarpSettingsToggle`-Button in `index.html` vorhanden, startet mit `&#9654;`?
5. Event-Handler in `init.js` registriert, klappt Box und ruft `pWarpUpdUI()` auf?
6. Versionsnummer in `version.js` auf `3.2.210-beta` gesetzt?

---

## Akzeptanztest-Checkliste

1. Seite neu laden. Warp-Toggle zeigt „Frequenz-Warping AUS". Das Dreieck
   zeigt ▶. Die Einstellungsbox ist unsichtbar.
2. Klick auf ▶: Box erscheint, Dreieck wechselt zu ▼. Warp-Toggle
   bleibt unverändert auf „AUS".
3. Die Einstellungen in der Box (Engine, Material, Stärke …) sind
   bedienbar, obwohl Warping aus ist.
4. Klick auf ▼: Box verschwindet, Dreieck zurück auf ▶.
5. Klick auf den Warp-Toggle → „Frequenz-Warping AN". Die Box bleibt
   weiterhin zugeklappt (▶), öffnet sich NICHT automatisch.
6. Klick auf ▶ bei aktivem Warping: Box erscheint. Einstellungen
   bedienbar.
7. Warp-Toggle wieder auf „AUS": Box bleibt in ihrem aktuellen
   Zustand (auf oder zu), schließt sich NICHT automatisch.

---

*Hinweis für später:* Übersetzungen (en/fr/es) für diese BA sind
nicht nötig, da kein neuer i18n-Text eingeführt wurde.
