// finanzen.js – Datenhaltung + Berechnungen für den Unterstützung-
// Tab. Pflege-Block oben (FINANZEN_BEGIN, _POSTEN, _DAUER, _EINMAL),
// Berechnungen unten. Keine DOM-Manipulation.

// ===========================================================
// === HIER PFLEGEN ==========================================
// ===========================================================

// Beginn der Erfassung. Linke Kante des Graphen.
var FINANZEN_BEGIN = "2026-05";

// (1) Geplante Fixkosten — der reguläre Monatsbedarf, konstant.
// Speist die Kostentabelle im Unterstützung-Tab. Weicht bewußt von
// den realen Monatskosten (FINANZEN_POSTEN) ab: hier steht der Plan,
// dort das tatsächliche Auf und Ab.
//   key:     Label-Schlüssel (i18n supportPosten_<key>)
//   monthly: Euro/Monat (geplant)
var FINANZEN_FIXKOSTEN = [
  { key: "kiPro",   monthly: 44.00 },  // zwei KI-Abos à 22 €
  { key: "hosting", monthly:  5.00 }
];

// (2) Reale Kosten — die tatsächlich anfallenden Monatskosten, ein
// Eintrag pro laufende Position. Speist den Graphen (monatliche
// Zeitreihe) und weicht in Einzelmonaten von den Fixkosten ab.
//   key:     Label-Schlüssel (i18n supportPosten_<key>)
//   monthly: Euro/Monat
//   start:   "YYYY-MM"  (erster Monat, in dem der Posten anfällt)
//   end:     "YYYY-MM" oder null (unbefristet)
// Ein aussetzendes/befristetes Abo wird als zwei Einträge über
// getrennte Zeiträume abgebildet (Lücke = ausgesetzte Monate).
var FINANZEN_POSTEN = [
  // Zwei KI-Abos à 22 €. Das zweite war Juli–August 2026 ausgesetzt,
  // daher als zwei Zeiträume (Mai–Juni, ab September).
  { key: "kiPro",   monthly: 22.00, start: "2026-05", end: null      },
  { key: "kiPro",   monthly: 22.00, start: "2026-05", end: "2026-06" },
  { key: "kiPro",   monthly: 22.00, start: "2026-09", end: null      },
  { key: "hosting", monthly:  5.00, start: "2026-05", end: null      }
];

// Dauerspenden — ein Eintrag pro Spender.
//   monthly: Euro/Monat
//   start:   "YYYY-MM"  (erster Monat, in dem die Spende läuft)
//   end:     "YYYY-MM" oder null (unbefristet)
var FINANZEN_DAUER = [
  { monthly: 10.00, start: "2026-05", end: null      },
  { monthly: 10.00, start: "2026-05", end: null      },
  { monthly:  5.00, start: "2026-06", end: null      },
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

// Summe der im gegebenen Monat aktiven monthly-Einträge einer
// Liste mit start/end-Feldern (Dauerspenden wie Kostenposten teilen
// dasselbe Zeitraum-Schema).
function finMonthlyAktivIn(liste, monat) {
  var s = 0;
  for (var i = 0; i < liste.length; i++) {
    var e = liste[i];
    if (finMonatCmp(e.start, monat) > 0) continue;
    if (e.end !== null && finMonatCmp(monat, e.end) > 0) continue;
    s += e.monthly;
  }
  return s;
}

// Summe der heute (oder zum gegebenen Monat) aktiven Dauerspenden.
function finDauerAktivIn(monat) {
  return finMonthlyAktivIn(FINANZEN_DAUER, monat);
}

// Summe der im gegebenen Monat aktiven Kostenposten.
function finPostenAktivIn(monat) {
  return finMonthlyAktivIn(FINANZEN_POSTEN, monat);
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

// Bilanz für die Kostentabelle: geplante Fixkosten (Kat. 1) gegen
// die aktuell laufenden Dauerspenden. Die Kostenseite ist konstant
// (Plan), die Spendenseite wird berechnet (schwankt).
function finBerechne() {
  var sumFix = 0;
  for (var i = 0; i < FINANZEN_FIXKOSTEN.length; i++) {
    sumFix += FINANZEN_FIXKOSTEN[i].monthly;
  }
  var donations = finDauerAktivIn(finMonatHeute());
  return {
    sumCurrent: sumFix,
    donations:  donations,
    selfShare:  Math.max(0, sumFix - donations)
  };
}

// Monatsweise Zeitreihe von monatVon bis einschließlich monatBis.
// Einmalspenden werden FIFO (nach Datum sortiert) in den Puffer
// gelegt; bei einer Restlücke im Monat wird daraus gedeckt.
// Liefert Array:
//   [{ monat, kostenCurrent, dauer,
//      pufferEingesetzt, luecke, pufferStand }, ...]
function finBerechneZeitreihe(monatVon, monatBis) {
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
    var kostenCurrent = finPostenAktivIn(m);
    var dauer = finDauerAktivIn(m);
    var rohluecke = Math.max(0, kostenCurrent - dauer);
    var pufferUse = Math.min(rohluecke, puffer);
    puffer -= pufferUse;
    out.push({
      monat:            m,
      kostenCurrent:    kostenCurrent,
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
  if (!Array.isArray(FINANZEN_FIXKOSTEN)) {
    errors.push("FINANZEN_FIXKOSTEN: Array erwartet.");
  } else {
    for (var f = 0; f < FINANZEN_FIXKOSTEN.length; f++) {
      var fk = FINANZEN_FIXKOSTEN[f];
      if (!fk || typeof fk.key !== "string"
          || typeof fk.monthly !== "number" || fk.monthly <= 0) {
        errors.push("FINANZEN_FIXKOSTEN[" + f + "]: key/monthly fehlt oder Typ falsch.");
      }
    }
  }
  if (!Array.isArray(FINANZEN_POSTEN)) {
    errors.push("FINANZEN_POSTEN: Array erwartet.");
  } else {
    for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
      var p = FINANZEN_POSTEN[i];
      if (!p || typeof p.key !== "string"
          || typeof p.monthly !== "number" || p.monthly <= 0) {
        errors.push("FINANZEN_POSTEN[" + i + "]: key/monthly fehlt oder Typ falsch.");
        continue;
      }
      if (typeof p.start !== "string" || !monatRe.test(p.start)) {
        errors.push("FINANZEN_POSTEN[" + i + "]: start \"YYYY-MM\" erwartet.");
      }
      if (p.end !== null && (typeof p.end !== "string" || !monatRe.test(p.end))) {
        errors.push("FINANZEN_POSTEN[" + i + "]: end null oder \"YYYY-MM\" erwartet.");
      }
      if (p.end !== null && typeof p.end === "string"
          && finMonatCmp(p.end, p.start) < 0) {
        errors.push("FINANZEN_POSTEN[" + i + "]: end vor start.");
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
