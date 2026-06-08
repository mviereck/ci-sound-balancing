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
