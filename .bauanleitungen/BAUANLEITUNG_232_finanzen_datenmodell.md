# Bauanleitung 232 — Finanzen-Datenmodell mit Zeitreihen

## Ziel

`js/finanzen.js` so umbauen, daß Dauerspenden und Einmalspenden
mit Datum/Zeitraum gepflegt werden können und eine monatliche
Zeitreihe (mit FIFO-Verbrauch der Einmalspenden-Puffer) berechnet
wird. Die Tabelle im Unterstützung-Tab muß **unverändert** weiter
funktionieren — `finBerechne()` bleibt API-kompatibel.

Diese BA ist die erste von drei zusammenhängenden Bauanleitungen:

- **BA 232 (diese)** — Datenmodell + Berechnung. Sichtbar: nichts ändert
  sich, aber neue Konsolen-Funktionen sind verfügbar.
- **BA 233** — Einmalspenden-Block unter der Tabelle.
- **BA 234** — Spenden-Graph (Canvas).

BA 233 und 234 setzen auf den Helpers aus BA 232 auf.

## Scope

Geändert: `js/finanzen.js` (komplett ersetzt), `js/version.js`,
`docs/CODESTRUKTUR.md` (Eintrag 20 aktualisiert).

**Nicht** geändert: `index.html`, `js/unterstuetzung.js`, CSS, i18n.

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.232-beta";
```

## Schritt 2 — `js/finanzen.js` komplett ersetzen

Die Datei wird vollständig durch folgenden Inhalt ersetzt:

```js
// finanzen.js – Datenhaltung + Berechnungen für den Unterstützung-
// Tab. Pflege-Block oben (FINANZEN_BEGIN, _POSTEN, _DAUER, _EINMAL),
// Berechnungen unten. Keine DOM-Manipulation.

// ===========================================================
// === HIER PFLEGEN ==========================================
// ===========================================================

// Beginn der Erfassung. Linke Kante des Graphen.
var FINANZEN_BEGIN = "2026-05";

// Monatliche Posten. full = Vollausbau-Bedarf, current = aktueller
// Stand. Wert 0 bei current heißt „derzeit nicht im Setup enthalten".
var FINANZEN_POSTEN = [
  { key: "kiPro",   full: 107.20, current: 44.00 },
  { key: "hosting", full:   0,    current:  5.00 },
  { key: "vps",     full:   5.34, current:  0    },
  { key: "space",   full:   3.81, current:  0    },
  { key: "domain",  full:   1.78, current:  0    }
];

// Dauerspenden — ein Eintrag pro Spender.
//   monthly: Euro/Monat
//   start:   "YYYY-MM"  (erster Monat, in dem die Spende läuft)
//   end:     "YYYY-MM" oder null (unbefristet)
var FINANZEN_DAUER = [
  { monthly: 10.00, start: "2026-05", end: null      },
  { monthly: 10.00, start: "2026-05", end: null      },
  { monthly:  5.00, start: "2026-05", end: null      },
  { monthly: 10.00, start: "2026-05", end: "2027-04" }
];

// Einmalspenden — ein Eintrag pro Spende.
//   date:   "YYYY-MM"
//   amount: Euro
var FINANZEN_EINMAL = [
  { date: "2026-05", amount: 100.00 },
  { date: "2026-06", amount:  50.00 }
];

// ===========================================================
// === ab hier nur Berechnung, normalerweise nichts ändern ===
// ===========================================================

function finFmtEuro(n) {
  // 107.2 → "107,20 €"
  return n.toFixed(2).replace(".", ",") + " €";
}

function finMonatHeute() {
  var d = new Date();
  var m = d.getMonth() + 1;
  return d.getFullYear() + "-" + (m < 10 ? "0" + m : "" + m);
}

function finMonatNext(m) {
  // "2026-05" → "2026-06", "2026-12" → "2027-01"
  var p = m.split("-");
  var y = parseInt(p[0], 10), mo = parseInt(p[1], 10);
  mo++;
  if (mo > 12) { y++; mo = 1; }
  return y + "-" + (mo < 10 ? "0" + mo : "" + mo);
}

function finMonatCmp(a, b) {
  // YYYY-MM ist lexikographisch sortierbar
  return a < b ? -1 : (a > b ? 1 : 0);
}

// Summe der heute (oder zum gegebenen Monat) aktiven Dauerspenden.
function finDauerAktivIn(monat) {
  var s = 0;
  for (var i = 0; i < FINANZEN_DAUER.length; i++) {
    var d = FINANZEN_DAUER[i];
    if (finMonatCmp(d.start, monat) > 0) continue;
    if (d.end !== null && finMonatCmp(monat, d.end) > 0) continue;
    s += d.monthly;
  }
  return s;
}

// Summe aller Einmalspenden bis einschließlich Monat M.
function finEinmalSummeBis(monat) {
  var s = 0;
  for (var i = 0; i < FINANZEN_EINMAL.length; i++) {
    if (finMonatCmp(FINANZEN_EINMAL[i].date, monat) <= 0) {
      s += FINANZEN_EINMAL[i].amount;
    }
  }
  return s;
}

// Aktuelle Bilanz für die Tabelle. API wie bisher.
function finBerechne() {
  var sumFull = 0, sumCurrent = 0;
  for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
    sumFull    += FINANZEN_POSTEN[i].full;
    sumCurrent += FINANZEN_POSTEN[i].current;
  }
  var donations = finDauerAktivIn(finMonatHeute());
  return {
    sumFull:       sumFull,
    sumCurrent:    sumCurrent,
    donations:     donations,
    selfShare:     Math.max(0, sumCurrent - donations),
    gapToFull:     Math.max(0, sumFull    - donations),
    fullVsCurrent: Math.max(0, sumFull    - sumCurrent)
  };
}

// Monatsweise Zeitreihe von monatVon bis einschließlich monatBis.
// Einmalspenden werden FIFO (nach Datum sortiert) in den Puffer
// gelegt; bei einer Restlücke im Monat wird daraus gedeckt.
// Liefert Array:
//   [{ monat, kostenCurrent, kostenFull, dauer,
//      pufferEingesetzt, luecke, pufferStand }, ...]
function finBerechneZeitreihe(monatVon, monatBis) {
  var kostenCurrent = 0, kostenFull = 0;
  for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
    kostenCurrent += FINANZEN_POSTEN[i].current;
    kostenFull    += FINANZEN_POSTEN[i].full;
  }

  // FIFO-Queue der Einmalspenden, nach Datum sortiert.
  var queue = FINANZEN_EINMAL.slice().sort(function (a, b) {
    return finMonatCmp(a.date, b.date);
  });
  var qi = 0;
  var puffer = 0;
  var out = [];

  var m = monatVon;
  // Sicherheitsbremse: nie mehr als 10 Jahre Iteration.
  for (var safe = 0; safe < 120 && finMonatCmp(m, monatBis) <= 0; safe++) {
    // alle bis einschließlich M eingegangenen Einmalspenden einbuchen
    while (qi < queue.length && finMonatCmp(queue[qi].date, m) <= 0) {
      puffer += queue[qi].amount;
      qi++;
    }
    var dauer = finDauerAktivIn(m);
    var rohluecke = Math.max(0, kostenCurrent - dauer);
    var pufferUse = Math.min(rohluecke, puffer);
    puffer -= pufferUse;
    out.push({
      monat:            m,
      kostenCurrent:    kostenCurrent,
      kostenFull:       kostenFull,
      dauer:            dauer,
      pufferEingesetzt: pufferUse,
      luecke:           rohluecke - pufferUse,
      pufferStand:      puffer
    });
    m = finMonatNext(m);
  }
  return out;
}

// Validator. Läuft beim Laden, gibt Warnungen in die Konsole.
// Rückgabe: { ok: bool, errors: [string] }.
function finValidate() {
  var errors = [];
  var monatRe = /^[0-9]{4}-(0[1-9]|1[0-2])$/;

  if (typeof FINANZEN_BEGIN !== "string" || !monatRe.test(FINANZEN_BEGIN)) {
    errors.push("FINANZEN_BEGIN: Format \"YYYY-MM\" erwartet.");
  }
  if (!Array.isArray(FINANZEN_POSTEN)) {
    errors.push("FINANZEN_POSTEN: Array erwartet.");
  } else {
    for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
      var p = FINANZEN_POSTEN[i];
      if (!p || typeof p.key !== "string"
          || typeof p.full !== "number" || typeof p.current !== "number") {
        errors.push("FINANZEN_POSTEN[" + i + "]: key/full/current fehlt oder Typ falsch.");
      }
    }
  }
  if (!Array.isArray(FINANZEN_DAUER)) {
    errors.push("FINANZEN_DAUER: Array erwartet.");
  } else {
    for (var j = 0; j < FINANZEN_DAUER.length; j++) {
      var d = FINANZEN_DAUER[j];
      if (!d || typeof d.monthly !== "number" || d.monthly <= 0) {
        errors.push("FINANZEN_DAUER[" + j + "]: monthly fehlt oder <= 0.");
        continue;
      }
      if (typeof d.start !== "string" || !monatRe.test(d.start)) {
        errors.push("FINANZEN_DAUER[" + j + "]: start \"YYYY-MM\" erwartet.");
      }
      if (d.end !== null && (typeof d.end !== "string" || !monatRe.test(d.end))) {
        errors.push("FINANZEN_DAUER[" + j + "]: end null oder \"YYYY-MM\" erwartet.");
      }
      if (d.end !== null && typeof d.end === "string"
          && finMonatCmp(d.end, d.start) < 0) {
        errors.push("FINANZEN_DAUER[" + j + "]: end vor start.");
      }
    }
  }
  if (!Array.isArray(FINANZEN_EINMAL)) {
    errors.push("FINANZEN_EINMAL: Array erwartet.");
  } else {
    for (var k = 0; k < FINANZEN_EINMAL.length; k++) {
      var e = FINANZEN_EINMAL[k];
      if (!e || typeof e.amount !== "number" || e.amount <= 0) {
        errors.push("FINANZEN_EINMAL[" + k + "]: amount fehlt oder <= 0.");
        continue;
      }
      if (typeof e.date !== "string" || !monatRe.test(e.date)) {
        errors.push("FINANZEN_EINMAL[" + k + "]: date \"YYYY-MM\" erwartet.");
      }
    }
  }

  if (errors.length > 0) {
    console.warn("[finanzen.js] Validierung fehlgeschlagen:");
    for (var x = 0; x < errors.length; x++) console.warn("  • " + errors[x]);
  }
  return { ok: errors.length === 0, errors: errors };
}

// Validator beim Laden ausführen.
finValidate();
```

### Hinweise zur Implementierung

- `FINANZEN` als Objekt-Wrapper entfällt. Falls Code irgendwo
  `FINANZEN.posten` oder `FINANZEN.donationsMonthly` lesen sollte:
  per `grep -rn "FINANZEN\\." js/` prüfen. Aktuell (Stand BA 231)
  greift nur `js/finanzen.js` selbst auf diese Properties zu, kein
  externer Konsument; `js/unterstuetzung.js` arbeitet ausschließlich
  über `finBerechne()` und `FINANZEN.posten[i]`. **Achtung:** der
  Loop in `_untRenderFinanzTable()` liest `FINANZEN.posten[i].key /
  .full / .current` direkt. **Diesen Loop in `js/unterstuetzung.js`
  Z. 15–26 anpassen**, sodaß er auf `FINANZEN_POSTEN[i]` zugreift —
  Body unverändert, nur die Variable umbenennen.

- Die Zeitreihen-Funktion verwendet eine harte Iterations-Bremse von
  120 Monaten (10 Jahre) gegen versehentliche Endlos-Schleifen bei
  fehlerhaften Eingaben.

## Schritt 3 — `js/unterstuetzung.js` Z. 15–26 anpassen

Vor dem Edit per Read den aktuellen Inhalt von Z. 15–26 holen. Die
einzige Änderung ist `FINANZEN.posten` → `FINANZEN_POSTEN`:

**Vorher:**

```js
  for (var i = 0; i < FINANZEN.posten.length; i++) {
    var p = FINANZEN.posten[i];
```

**Nachher:**

```js
  for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
    var p = FINANZEN_POSTEN[i];
```

(zwei Stellen, sonst nichts.)

## Schritt 4 — `docs/CODESTRUKTUR.md` Eintrag 20 aktualisieren

In `docs/CODESTRUKTUR.md` den Eintrag für `finanzen.js` (Zeile mit
`| 20 | finanzen.js | ...`) komplett ersetzen durch:

```
| 20 | finanzen.js | Datenhaltung + Berechnungen für den Unterstützung-Tab. Pflege-Block oben (alles, was Martin editieren muß): `FINANZEN_BEGIN` (YYYY-MM, linke Kante des Graphen), `FINANZEN_POSTEN` (full/current pro Monatsposten), `FINANZEN_DAUER` (ein Eintrag pro Dauerspende, mit `start`/`end`), `FINANZEN_EINMAL` (ein Eintrag pro Einmalspende, mit `date`). Berechnungen: `finBerechne()` (Ist-Werte für die Tabelle, API-kompatibel zur alten Fassung), `finBerechneZeitreihe(von, bis)` (monatsweise Reihe mit FIFO-Puffer aus Einmalspenden für den Graphen), Helper `finDauerAktivIn(monat)`, `finEinmalSummeBis(monat)`, `finFmtEuro(n)`, `finMonatHeute()`, `finMonatNext(m)`, `finMonatCmp(a,b)`. `finValidate()` läuft beim Laden und schreibt Warnungen für Format-/Typfehler in die Konsole. Keine DOM-Manipulation. Muß vor `unterstuetzung.js` geladen werden. |
```

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload** (Strg+Shift+R). Konsole öffnen.
2. **Tab Unterstützung öffnen.** Die Finanztabelle muß **exakt
   gleich** aussehen wie vorher: KI-Pro, Hostingpaket, VPS, Webspace,
   Domain als Zeilen; Summenzeile `118,13 € / 49,00 €`; Spenden-Zeile
   `– / 35,00 €`; Eigenanteil `– / 14,00 €`. Differenz-Hinweise
   darunter: `69,13 €` und `83,13 €`.
3. **Konsole:** kein `[finanzen.js] Validierung fehlgeschlagen`.
4. **Konsole:** `finBerechne()` eingeben, Enter. Rückgabe muß die
   Felder `sumFull` (118.13), `sumCurrent` (49), `donations` (35),
   `selfShare` (14), `gapToFull` (83.13), `fullVsCurrent` (69.13)
   enthalten.
5. **Konsole:** `finBerechneZeitreihe("2026-05", "2026-08")` eingeben.
   Rückgabe muß ein Array mit 4 Einträgen sein. Monat `2026-05`:
   `dauer: 35`, `kostenCurrent: 49`, `luecke: 0` (weil Einmalspende
   100 € reinkommt und die 14 € Lücke deckt), `pufferStand: 86`.
   Monat `2026-06`: `pufferEingesetzt: 14`, `luecke: 0`, `pufferStand`
   wächst um 50 (neue Einmalspende) und sinkt um 14 → 122. Monat
   `2027-04` und `2027-05` lassen sich analog testen: ab `2027-05`
   fällt die 10-€-Befristung weg, `dauer` sinkt auf 25.

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jede Akzeptanz-Position einzeln melden: erfüllt / nicht erfüllt /
unklar, mit Datei- und Zeilenangabe.

- [ ] Punkt 1 (Cache-Reload, Konsole): ist trivial, hier nur Hinweis,
  daß keine Konsolen-Errors aus dem Bau selbst zu erwarten sind.
- [ ] Punkt 2 (Tabelle unverändert): `finBerechne()` liefert mit den
  obigen Daten genau `donations: 35` (10+10+5+10 in Mai 2026, das ist
  heute oder vorher) → Zeile bleibt `35,00 €`. **Wichtig:** Wenn
  `finMonatHeute()` > `"2027-04"` zurückgibt, fällt die 10-€-Spende
  raus und `donations` wird 25. Bei Test heute (Juni 2026) ist das
  egal, aber den Fall im Bericht erwähnen.
- [ ] Punkt 3 (kein Validator-Fehler).
- [ ] Punkt 4 (`finBerechne()` API).
- [ ] Punkt 5 (Zeitreihen-Plausibilität): die genannten Werte für Mai
  und Juni 2026 nachrechnen und bestätigen, daß die Implementierung
  sie liefert.
- [ ] Version `js/version.js` auf `"3.2.232-beta"`.
- [ ] `js/unterstuetzung.js` Z. 15–26: nur die Variable umbenannt,
  Body unverändert.
- [ ] `docs/CODESTRUKTUR.md` Eintrag 20: ersetzt.

Wenn alle Punkte erfüllt sind und Validator-Aufruf in der Konsole
keine Warnung gibt: Bauanleitung als abgenommen melden.

Folge-Bauanleitungen (BA 233, BA 234) bauen auf dieser auf — vor
deren Bau muß BA 232 grün sein.
