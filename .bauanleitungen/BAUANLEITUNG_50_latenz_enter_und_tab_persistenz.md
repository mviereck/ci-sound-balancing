# Bauanleitung 50 — Latenz mit ENTER beenden + Tab/Subtab nach Reload wiederherstellen

## Worum es geht

Zwei kleine UI-Patches, die sich gut zusammen erledigen lassen:

- **Punkt 4 — ENTER stoppt den Latenztest.** Bisher gibt es nur den
  Stop-Button. Während ein Latenz-Test läuft, soll die ENTER-Taste
  äquivalent zum Klick auf den Stop-Button wirken — schnell und ohne
  Mausgriff.
- **Punkt 10 — Tab/Subtab überleben den Reload.** Bisher landet der
  User nach jedem Page-Reload wieder auf dem Default-Tab („Einführung").
  Stattdessen soll der zuletzt aktive Tab und — falls relevant —
  Sub-Tab wiederhergestellt werden. Persistenz über `localStorage`,
  unabhängig vom JSON-Save.

## Stelle 1 — `latency.js`: ENTER-Listener im DOMContentLoaded

Im DOMContentLoaded-Handler von `latency.js` (aktuell ab Z. 335). Direkt
**vor** der „Initial-Update"-Sektion (aktuell Z. 381–384, der Block
`latSliderInput(0); latUpdateButtonStates(); latUpdateIntervalHint();`)
folgenden Listener einfügen:

```js
  // ENTER beendet den laufenden Latenztest (Äquivalent zum Stop-Button).
  // Nur greifen, wenn der Test wirklich aktiv ist und der Fokus nicht
  // in einem Eingabe-Element liegt (sonst würde ENTER in normalen
  // Formularen abgefangen).
  document.addEventListener("keydown", function (ev) {
    if (!latActive) return;
    if (ev.key !== "Enter") return;
    const tgt = ev.target;
    if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.tagName === "SELECT")) {
      // Ausnahme: der Latenz-Slider ist zwar ein input[type=range], aber
      // ENTER soll dort dennoch stoppen — Range-Inputs erzeugen mit ENTER
      // ohnehin keine sinnvolle Default-Aktion.
      const isLatSlider = (latEls && latEls.slider && tgt === latEls.slider);
      if (!isLatSlider) return;
    }
    ev.preventDefault();
    latStopTestUI();
  });
```

Hintergrund:

- Der Listener läuft global auf `document`, ist aber durch die
  `latActive`-Prüfung praktisch nur scharfgeschaltet, wenn der Latenz-
  Test gerade läuft. In allen anderen Zuständen ist es ein No-Op und
  stört keine andere ENTER-Bindung im Tool.
- Inputs/Textareas/Selects werden ausgespart, damit z. B. der Suffix-
  Eingabe im Laden/Speichern-Tab (siehe Anleitung 52) ENTER weiterhin
  selbst verarbeiten könnte. Der Latenz-Slider selbst (range-Input)
  ist explizit ausgenommen, weil er die häufigste Tastatur-Fokus-
  Position während des Tests ist.

## Stelle 2 — `tabs-eq.js`: `switchTab` schreibt Top-Level-Tab

In `tabs-eq.js`. Am **Ende** von `switchTab(n)` (aktuell Z. 87, direkt
vor der schließenden Klammer der Funktion) hinzufügen:

```js
  try { localStorage.setItem("ci-lb-activeTab", n); } catch (e) {}
```

Wichtig: das `try/catch` ist nötig, weil `localStorage.setItem` in
manchen Browser-Modi (Inkognito mit voller Quota, einigen `file://`-
Setups) werfen kann. Im Fehlerfall fällt die Funktion still durch —
Tab-Wechsel selbst läuft trotzdem.

Die Persistenz greift **nur, wenn der Tab-Wechsel tatsächlich durchgeht**.
Der Guard ganz am Anfang von `switchTab` blockiert den Wechsel bei
laufendem Test mit `return;`, in diesem Fall wird nichts geschrieben —
das ist richtig.

## Stelle 3 — `tabs-eq.js`: `switchSubtab` schreibt Subtab pro Parent

Am **Ende** von `switchSubtab(parent, subtab)` (aktuell Z. 41, direkt
vor der schließenden Klammer der Funktion) hinzufügen:

```js
  try { localStorage.setItem("ci-lb-subtab-" + parent, subtab); } catch (e) {}
```

Pro Parent ein eigener Schlüssel, damit Messungen und Meßergebnisse
unabhängig voneinander persistiert werden.

## Stelle 4 — `init.js`: Tab/Subtab nach allen Inits wiederherstellen

In `init.js` im DOMContentLoaded-Handler. Position: ganz am **Ende** des
Handlers, **nach** dem Autosave-`setInterval`-Block (der aktuell ab Z. 695
beginnt und nach unten weitergeht). Direkt vor der schließenden
geschweiften Klammer + Klammer von `document.addEventListener(...)`.

Vor dem Einfügen prüfen: das Ende des DOMContentLoaded-Handlers
identifizieren — dort schließen sich `})` (Pfeil-Funktions-Ende + 
addEventListener-Ende). Direkt davor:

```js
  // Tab/Subtab nach Reload wiederherstellen (Persistenz aus tabs-eq.js).
  // Erst Top-Level-Tab, dann ggf. Sub-Tab für den jeweiligen Parent.
  try {
    const savedTab = localStorage.getItem("ci-lb-activeTab");
    if (savedTab) {
      const tabBtn = document.querySelector('.tab[data-tab="' + savedTab + '"]');
      if (tabBtn && typeof switchTab === "function") {
        switchTab(savedTab);
      }
    }
    // Subtab pro Parent
    const subtabParents = ["messungen", "ergebnisse"];
    for (const parent of subtabParents) {
      const savedSub = localStorage.getItem("ci-lb-subtab-" + parent);
      if (!savedSub) continue;
      const subBtn = document.querySelector('.subtab[data-parent="' + parent + '"][data-subtab="' + savedSub + '"]');
      if (subBtn && typeof switchSubtab === "function") {
        switchSubtab(parent, savedSub);
      }
    }
  } catch (e) {
    // localStorage nicht verfügbar oder gespeicherter Tab existiert nicht
    // mehr — still durchfallen, Default-Tab bleibt aktiv.
  }
```

Hintergrund:

- `switchTab` und `switchSubtab` werden über `data-tab=…` /
  `data-subtab=…`-Attribute aufgerufen. Vor dem Aufruf wird per
  `querySelector` geprüft, ob das Element überhaupt existiert. Wenn
  ein früher gespeicherter Tab später entfernt wurde, scheitert der
  Selector und der Default-Tab bleibt aktiv.
- Der Block läuft am Ende, weil `switchTab("ergebnisse")` z. B.
  `renderResults()` aufruft, das wiederum auf bereits initialisierten
  State angewiesen ist (Side-Daten, Mess-State, …). Würde der Restore
  vor dem Side-Daten-Restore laufen, käme es zu Render-Fehlern.
- Subtab nur für `messungen` und `ergebnisse` — das sind aktuell die
  einzigen Tabs mit Sub-Tabs (vgl. `CODESTRUKTUR.md`, Tab-Tabelle).
  Wenn später ein dritter Sub-Tab-Bereich dazukäme, die Liste hier
  ergänzen.

## Stelle 5 — `SPEC.md` / `spec/`

Im Kapitel zu **Latenz** (`spec/`-Datei für die Messungen) ergänzen:

> Bedienung: der laufende Test kann sowohl über den Stop-Button als
> auch über die ENTER-Taste beendet werden. Die ENTER-Bindung greift
> global auf `document`-Ebene, aber nur, wenn `latActive === true`.
> Inputs/Textareas/Selects sind ausgespart; der Latenz-Slider selbst
> ist als bewußte Ausnahme eingeschlossen, weil er die häufigste
> Fokus-Position während des Tests ist.

Im allgemeinen Kapitel (oder einem Persistenz-Abschnitt, falls
vorhanden) ergänzen:

> Persistenz des UI-Zustands: der zuletzt aktive Top-Level-Tab und
> die zuletzt aktiven Sub-Tabs in „Messungen" und „Meßergebnisse"
> überleben einen Browser-Reload. Sie werden in `localStorage` unter
> `ci-lb-activeTab` und `ci-lb-subtab-<parent>` gespeichert (separat
> vom JSON-Save). Nicht mehr existierende Tabs werden beim Restore
> ignoriert, Default-Tab bleibt dann aktiv.

## Stelle 6 — `CODESTRUKTUR.md`

Im Datenfluss-Block, am besten direkt nach dem Abschnitt **„Tab-Sperre
während Test"**, einen neuen Absatz ergänzen:

> **Tab/Subtab-Persistenz:** `switchTab` (tabs-eq.js) schreibt den
> aktiven Top-Level-Tab in `localStorage` unter `ci-lb-activeTab`.
> `switchSubtab` schreibt analog pro Parent unter
> `ci-lb-subtab-<parent>` (nur für `messungen` und `ergebnisse`
> relevant). Restore am Ende des DOMContentLoaded-Handlers in
> `init.js`, nach allen anderen Init-Schritten, damit die durch
> `switchTab`/`switchSubtab` ausgelösten Render-Callbacks
> (`renderResults`, `lrDrawChart`, `lvTabRebuild`, …) auf
> initialisiertem State arbeiten.

Im Abschnitt zur `latency.js`-Modulbeschreibung (Modul-Tabelle Z. 127):
die ENTER-Bindung in einem Halbsatz erwähnen.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — ENTER stoppt Latenztest (Punkt 4)

1. Tab Messungen → Sub-Tab Latenz. Test starten (Klick auf „Test
   starten" oder Tastatur).
2. ENTER drücken (Tastatur-Fokus beliebig im Latenz-Sub-Tab oder
   auch auf dem Schieber).
3. Erwartet: Test stoppt sofort, identisch zu einem Klick auf den
   Stop-Button. Stop-Button wieder deaktiviert, Start-Button wieder
   aktiv, `latActive === false`, Schieber wieder gesperrt.

### Test B — ENTER greift nicht außerhalb des Latenz-Tests

1. Latenz-Tab, kein Test gestartet. ENTER drücken.
2. Erwartet: nichts passiert (kein Stop-Aufruf, keine Exception).
3. Auf anderen Tabs (Implantat, Player, Laden/Speichern) ENTER in
   normalen Eingabefeldern drücken.
4. Erwartet: ENTER wird vom Tool nicht abgefangen, normales Browser-
   Verhalten (Submit/Newline) greift dort, wo es vorgesehen ist.

### Test C — Tab-Persistenz Top-Level

1. Tab „Player" aktivieren. Browser-Reload (Strg-R).
2. Erwartet: nach dem Reload ist „Player" der aktive Tab.
3. Tab „Implantat" aktivieren. Reload. Erwartet: „Implantat" aktiv.
4. Verschiedene Tabs der Reihe nach durchklicken und jeweils
   reloaden. Erwartet: der zuletzt aktivierte Tab bleibt.

### Test D — Subtab-Persistenz Messungen

1. Tab Messungen → Sub-Tab Frequenzabgleich. Reload.
2. Erwartet: nach Reload ist Messungen aktiv und der Sub-Tab
   Frequenzabgleich aktiv.
3. Sub-Tab Latenz, Reload → Latenz-Sub-Tab aktiv.
4. Sub-Tab Stereo-Balance, Reload → Stereo-Balance-Sub-Tab aktiv.

### Test E — Subtab-Persistenz Meßergebnisse

1. Tab Meßergebnisse → Sub-Tab Stereo-Balance. Reload.
2. Erwartet: Meßergebnisse aktiv, Sub-Tab Stereo-Balance aktiv,
   `lrDrawChart` wurde aufgerufen (Chart sichtbar, sofern Daten da).

### Test F — Subtab unabhängig pro Parent

1. Messungen → Sub-Tab Frequenzabgleich aktivieren.
2. Direkt danach Tab wechseln zu Meßergebnisse → Sub-Tab Latenz
   aktivieren.
3. Reload. Erwartet: Top-Level-Tab ist Meßergebnisse (zuletzt
   gewählt), Sub-Tab in Meßergebnisse ist Latenz, Sub-Tab in
   Messungen ist Frequenzabgleich (bleibt gespeichert, auch wenn
   Messungen gerade nicht der aktive Top-Level-Tab ist).
4. Wechsel auf Messungen → Frequenzabgleich-Sub-Tab ist wieder
   sichtbar.

### Test G — Robustheit bei nicht existierendem Tab

1. Konsole: `localStorage.setItem("ci-lb-activeTab", "doesnotexist")`.
2. Reload. Erwartet: keine Exception, der Default-Tab bleibt aktiv
   (Einführung oder was im HTML als `.active` markiert ist).

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–G einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Ist der ENTER-Listener so platziert, daß er nicht doppelt registriert
  wird (z. B. bei mehrfachem DOMContentLoaded oder bei einem späteren
  Re-Init)? Der Listener landet im einmaligen DOMContentLoaded-Handler
  von `latency.js`, sollte also nur einmal binden.
- Schlägt der Listener wirklich auch zu, wenn der Tastatur-Fokus
  irgendwo im Latenz-Sub-Tab (z. B. auf einem Interval-Button) liegt?
  Buttons sind keine `INPUT`-Elemente und werden vom Guard nicht
  ausgespart.
- Greift der Tab/Subtab-Restore tatsächlich erst nach den restlichen
  Inits? Insbesondere: wenn `switchTab("ergebnisse")` aufgerufen wird,
  läuft `renderResults` — das setzt `bRes`, `lrResults` etc. voraus.
  Wenn diese vorher per `loadSideData` und Co. nicht initialisiert
  waren, müßte die Reihenfolge im DOMContentLoaded-Handler stimmen.
- Liefert die Block-Platzierung „direkt vor der schließenden Klammer
  des DOMContentLoaded-Handlers" tatsächlich die spätestmögliche
  Position? Wenn nach dem `setInterval`-Autosave-Block weiterer Code
  steht (z. B. weitere kleinere Init-Aufrufe), den Block dahinter
  einfügen.
- Ist `data-tab=…` / `data-subtab=…` der korrekte Selector? Stichprobe
  im HTML auf bestehende Tab-Buttons machen.

Bei Unklarheit Rückfrage statt Annahme.
