# Bauanleitung 51 — Player: gesetzten MAPLAW-Wert deutlich anzeigen

## Worum es geht

Im Player gibt es schon eine Zeile, die den **Ist-c-Wert** aus dem
Implantat-Tab anzeigt (z. B. „Ihr aktueller c-Wert (aus Implantat-Tab):
1000"). Der **gesetzte Soll-Wert** (für die MAPLAW-Simulation) ist nur
implizit über das Input-Feld sichtbar — daneben.

Wunsch: Die bestehende Ist-c-Zeile wird verlängert, so daß der gesetzte
Soll-Wert direkt neben dem Ist-Wert fett angezeigt wird. Keine neue
Zeile — die vorhandene wird ergänzt.

Gewünschtes Anzeige-Ergebnis (Beispiel DE):

> Ihr aktueller c-Wert (aus Implantat-Tab): **1000** — Gesetzter Wert: **2000**

Die Werte aktualisieren sich live, wenn der User den Soll-Wert per Quick-
Button oder Zahleneingabe ändert.

## Stelle 1 — `index.html`: Ist-Wert-Zeile verlängern

In `index.html` aktuell Z. 1094–1098, der Block:

```html
          <div id="plMaplawSettingsBox" style="display:none;margin-top:4px;margin-left:15px;padding:10px 12px;background:var(--bg);border:1px solid var(--border);border-radius:6px">
            <div style="margin-bottom:6px;font-size:.9em;color:var(--text-muted)">
              <span data-t="plMaplawIstLabel"></span>:
              <strong id="plMaplawIstVal" style="font-family:var(--mono);color:var(--text)">—</strong>
            </div>
```

Den inneren `<div>` (ab „<div style=\"margin-bottom:6px;…\">" bis
inklusive `</div>`) ersetzen durch:

```html
            <div style="margin-bottom:6px;font-size:.9em;color:var(--text-muted)">
              <span data-t="plMaplawIstLabel"></span>:
              <strong id="plMaplawIstVal" style="font-family:var(--mono);color:var(--text)">—</strong>
              &nbsp;—&nbsp;
              <span data-t="plMaplawSollDisplayLabel"></span>:
              <strong id="plMaplawSollDisplayVal" style="font-family:var(--mono);color:var(--text)">—</strong>
            </div>
```

(Der trennende Gedankenstrich „— " mit `&nbsp;` davor und dahinter
sorgt für sichtbaren Abstand und verhindert harten Zeilenumbruch genau
auf dem Bindestrich.)

## Stelle 2 — `i18n/*.js`: neuer Key `plMaplawSollDisplayLabel`

In allen vier Sprachdateien einen neuen Schlüssel ergänzen, direkt
neben den bestehenden `plMaplawIstLabel` / `plMaplawSollLabel`-Einträgen
(gleicher Block, gleiche Einrückung, Komma am Ende prüfen).

**`i18n/de.js`** nach Z. 232 (`plMaplawSollLabel`):

```js
    plMaplawSollDisplayLabel: "Gesetzter Wert",
```

**`i18n/en.js`** nach Z. 229:

```js
    plMaplawSollDisplayLabel: "Set value",
```

**`i18n/fr.js`** nach Z. 211 (passende Stelle bei den anderen
`plMaplaw*`-Keys):

```js
    plMaplawSollDisplayLabel: "Valeur définie",
```

**`i18n/es.js`** nach Z. 211:

```js
    plMaplawSollDisplayLabel: "Valor establecido",
```

Wortlaut bewußt kurz gehalten, weil die Zeile schon zwei Werte enthält
und nicht zu lang werden soll. „Gesetzter Wert" / „Set value" /
„Valeur définie" / „Valor establecido" beschreibt den Wert, den der
User aktuell zum Simulieren eingestellt hat — anders als der „Zu
simulierender c-Wert"-Label (`plMaplawSollLabel`), der als Beschriftung
über dem Input-Feld weiter bestehen bleibt.

## Stelle 3 — `player.js`: `pMaplawUpdUI` schreibt auch den Display-Wert

In `player.js` in der Funktion `pMaplawUpdUI` (aktuell ab Z. 865). Den
Block ab Z. 891:

```js
  if (istEl) {
    const ist = (typeof pMaplawGetIstC === "function") ? pMaplawGetIstC() : null;
    istEl.textContent = ist != null ? String(ist) : "—";
  }

  if (sollIn) sollIn.value = String(pMaplawSollC);
}
```

Ersetzen durch:

```js
  if (istEl) {
    const ist = (typeof pMaplawGetIstC === "function") ? pMaplawGetIstC() : null;
    istEl.textContent = ist != null ? String(ist) : "—";
  }

  const sollDisplay = document.getElementById("plMaplawSollDisplayVal");
  if (sollDisplay) {
    sollDisplay.textContent = (typeof pMaplawSollC === "number") ? String(pMaplawSollC) : "—";
  }

  if (sollIn) sollIn.value = String(pMaplawSollC);
}
```

## Stelle 4 — `init.js`: live aktualisieren bei Soll-Wert-Änderung

Aktuell ruft das Setzen des Soll-Werts (per Quick-Button oder per
Zahleneingabe) zwar `pMaplawTrigger()` auf, aber nicht
`pMaplawUpdUI()`. Damit der neue Display-Wert sich live mitbewegt,
beide Stellen ergänzen.

**Quick-Buttons** (init.js aktuell Z. 335–344). Aktuell:

```js
  document.querySelectorAll('[data-maplaw-quick]').forEach((btn) => {
    btn.addEventListener("click", function () {
      const v = parseInt(this.getAttribute("data-maplaw-quick"));
      if (isFinite(v) && v >= 0) {
        pMaplawSollC = v;
        if (plMaplawSollEl) plMaplawSollEl.value = String(v);
        pMaplawTrigger();
      }
    });
  });
```

Ersetzen durch:

```js
  document.querySelectorAll('[data-maplaw-quick]').forEach((btn) => {
    btn.addEventListener("click", function () {
      const v = parseInt(this.getAttribute("data-maplaw-quick"));
      if (isFinite(v) && v >= 0) {
        pMaplawSollC = v;
        if (plMaplawSollEl) plMaplawSollEl.value = String(v);
        if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
        pMaplawTrigger();
      }
    });
  });
```

**Zahleneingabe-Change** (init.js aktuell Z. 346–356). Aktuell:

```js
  if (plMaplawSollEl) {
    plMaplawSollEl.addEventListener("change", function () {
      const v = parseInt(this.value);
      if (isFinite(v) && v >= 0 && v <= 8000) {
        pMaplawSollC = v;
        pMaplawTrigger();
      } else {
        this.value = String(pMaplawSollC);
      }
    });
  }
```

Ersetzen durch:

```js
  if (plMaplawSollEl) {
    plMaplawSollEl.addEventListener("change", function () {
      const v = parseInt(this.value);
      if (isFinite(v) && v >= 0 && v <= 8000) {
        pMaplawSollC = v;
        if (typeof pMaplawUpdUI === "function") pMaplawUpdUI();
        pMaplawTrigger();
      } else {
        this.value = String(pMaplawSollC);
      }
    });
  }
```

## Stelle 5 — `SPEC.md` / `spec/`

Im Kapitel zu **Player** (spec/-Datei für den Player-Tab) im Abschnitt
zur MAPLAW-Simulation ergänzen:

> Die Ist-c-Anzeige im Einstellungs-Block wird um den gesetzten
> Soll-c-Wert verlängert. Beide Werte stehen fett auf derselben
> Zeile, getrennt durch einen Gedankenstrich. Der Soll-Wert
> aktualisiert sich live, wenn der User ihn per Quick-Button oder
> Zahleneingabe ändert (die jeweiligen Listener rufen
> `pMaplawUpdUI` zusätzlich zu `pMaplawTrigger`).

## Stelle 6 — `CODESTRUKTUR.md`

Im Abschnitt zur `player.js`-Modulbeschreibung (Z. 123) ist
`pMaplawUpdUI` schon erwähnt („UI-Sync: Ist-c-Anzeige, Toggle-Zustand,
Soll-c-Eingabe, Nicht-MED-EL-Hinweis"). Den Eintrag erweitern um die
neue Anzeige:

> `pMaplawUpdUI` (UI-Sync: Ist-c-Anzeige, Soll-c-Display neben dem Ist-
> Wert, Toggle-Zustand, Soll-c-Eingabe, Nicht-MED-EL-Hinweis)

Im Abschnitt zur MAPLAW-Simulation im Datenfluss-Block (Zeile mit
„MAPLAW-Simulation (Phase 3, MED-EL)") einen Halbsatz ergänzen:

> Die Soll-c-Anzeige im Settings-Box wird neben dem Ist-Wert live
> aktualisiert; die zugehörigen Listener in init.js für Quick-Buttons
> und Zahleneingabe rufen `pMaplawUpdUI` zusätzlich zu
> `pMaplawTrigger` auf.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Anzeige bei sichtbarer MAPLAW-Card

1. Tool laden. Player-Tab. Eine MED-EL-Seite aktivieren (MAPLAW ist
   nur für MED-EL sichtbar). Im Implantat-Tab den c-Wert auf z. B.
   1000 setzen, falls noch nicht.
2. Player-Tab. „Experimentelle Optionen" sichtbar machen, MAPLAW-Card
   sichtbar.
3. MAPLAW-Toggle auf „an" stellen. Settings-Box wird sichtbar.
4. Erwartet (DE): Zeile lautet
   „Ihr aktueller c-Wert (aus Implantat-Tab): **1000** — Gesetzter
   Wert: **1000**" (Anfangswert von `pMaplawSollC`).
5. Sprachwechsel testen: EN „Set value", FR „Valeur définie",
   ES „Valor establecido".

### Test B — Live-Update bei Quick-Button

1. Wie Test A, MAPLAW an, Settings sichtbar.
2. Auf den Quick-Button „2000" klicken.
3. Erwartet: Soll-Wert in der oberen Zeile zeigt sofort **2000** (im
   `<strong>`), gleichzeitig steht im Input-Feld unten ebenfalls
   2000.
4. Weitere Buttons der Reihe nach: 500, 4000, 100 — jedes Mal
   aktualisiert sich der angezeigte Soll-Wert sofort.

### Test C — Live-Update bei Zahleneingabe

1. Wie Test A.
2. Im Input-Feld 3500 eingeben und ENTER drücken (oder Fokus
   verlassen — `change`-Event).
3. Erwartet: Soll-Wert in der oberen Zeile zeigt sofort **3500**.
4. Eine ungültige Eingabe (z. B. -1 oder 9999): Eingabe wird
   abgewiesen, Anzeige bleibt auf dem alten Wert.

### Test D — Ist-Wert bleibt korrekt

1. Wie Test A.
2. Im Implantat-Tab den c-Wert auf 1500 ändern, dann zurück zum
   Player-Tab.
3. Erwartet: Ist-Wert in der Anzeige zeigt 1500. Soll-Wert
   unverändert vom vorherigen Stand.

### Test E — Persistenz nach Reload

1. Soll-Wert auf 2500 setzen (Quick-Button oder Eingabe).
2. Mindestens 6 Sekunden warten (Autosave-Intervall in init.js).
3. Browser-Reload.
4. Erwartet: Player-Tab, MAPLAW noch sichtbar (sofern an), Anzeige
   zeigt weiterhin „… Gesetzter Wert: **2500**".

### Test F — Nicht-MED-EL-Seite

1. Auf eine Nicht-MED-EL-Seite wechseln (Hersteller-Wechsel im
   Implantat-Tab).
2. Erwartet: MAPLAW-Card und Settings-Box werden ausgeblendet
   (`pMaplawIsApplicable()` ist false). Die neue
   Display-Zeile ist damit ebenfalls nicht sichtbar — keine
   Auswirkung auf andere Tabs.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–F einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Ist der neue Key `plMaplawSollDisplayLabel` in **allen vier**
  Sprachdateien vorhanden, korrekt geschrieben (kein Tippfehler im
  Schlüsselnamen), und mit Komma am Zeilenende?
- Wird `pMaplawUpdUI` tatsächlich an beiden geänderten Stellen in
  init.js aufgerufen — sowohl im Quick-Button-Handler als auch im
  Change-Handler des Input-Felds?
- Beim Initial-Render (Page-Load) wird `pMaplawUpdUI` aus dem
  bestehenden Code-Pfad heraus aufgerufen (z. B. nach JSON-Restore in
  init.js, im DOMContentLoaded-Handler). Stimmt das, oder muß für
  den ersten Render ebenfalls ein expliziter Aufruf ergänzt werden?
  Falls notwendig, in der Init-Sektion ergänzen (vor allen anderen
  pMaplaw-Bindings).
- Wird das neue `<strong id="plMaplawSollDisplayVal">`-Element auch
  visuell korrekt fett dargestellt? `<strong>` ist semantisch fett —
  CSS könnte das überschreiben (z. B. wenn `.text-muted` einen
  font-weight setzt). Stichprobe im Browser machen.
- Ist die Zeile auf schmalen Bildschirmen (Mobile) noch lesbar? Sie
  enthält jetzt zwei Werte plus einen Trenner — auf 320 px Breite
  könnte sie umbrechen. Das ist akzeptabel; der `&nbsp;`-Abstand
  verhindert nur, daß genau auf dem Trenner umgebrochen wird.

Bei Unklarheit Rückfrage statt Annahme.
