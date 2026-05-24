// finanzen.js – Spendenaufruf-Zahlen und Berechnungen für den
// Unterstützung-Tab. Reine Datenhaltung + Rechnen, keine UI-Logik.

var FINANZEN = {
  // Einzelposten: full = Vollausbau-Bedarf, current = aktueller Stand.
  // Wert 0 bei current heißt „derzeit nicht im Setup enthalten".
  posten: [
    { key: "kiPro",  full: 107.20, current: 44.00 },
    { key: "vps",    full:   5.34, current:  0    },
    { key: "space",  full:   3.81, current:  5.00 },
    { key: "domain", full:   1.78, current:  0    }
  ],
  // Aktuell durch Spenden gedeckter Anteil pro Monat (Euro).
  donationsMonthly: 25.00
};

function finBerechne() {
  var sumFull = 0, sumCurrent = 0;
  for (var i = 0; i < FINANZEN.posten.length; i++) {
    sumFull    += FINANZEN.posten[i].full;
    sumCurrent += FINANZEN.posten[i].current;
  }
  var donations = FINANZEN.donationsMonthly;
  return {
    sumFull:    sumFull,                         // 118.13
    sumCurrent: sumCurrent,                      //  49.00
    donations:  donations,                       //  25.00
    selfShare:  Math.max(0, sumCurrent - donations), // 24.00
    gapToFull:  Math.max(0, sumFull - donations),    // 93.13
    fullVsCurrent: Math.max(0, sumFull - sumCurrent) // 69.13
  };
}

function finFmtEuro(n) {
  // 107.2 → "107,20 €"
  return n.toFixed(2).replace(".", ",") + " €";
}
