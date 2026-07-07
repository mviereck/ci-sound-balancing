/* BA454 CBF-Rechenkern — Diagnose (abgenommen, aus debug-tests-current.js entfernt)
 * Ergebnis: monoton=true waende_ok=true fuer alle drei Gewichtungen.
 */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA454/cbf-kern", { tab: "frequenzabgleich", label: "CBF Rechenkern" }, function () {
    var kette = [
      { elIdx: 0, hz: 104,  statusGewicht: 1 },
      { elIdx: 1, hz: 296,  statusGewicht: 1 },
      { elIdx: 2, hz: 673,  statusGewicht: 1 },
      { elIdx: 3, hz: 1211, statusGewicht: 1 },
      { elIdx: 4, hz: 2302, statusGewicht: 1 },
      { elIdx: 5, hz: 4153, statusGewicht: 1 },
      { elIdx: 6, hz: 7410, statusGewicht: 0 }  // letzte stumm -> passiv
    ];
    var wand = { loHz: 70, hiHz: 8500 };
    var out = [];
    ["ausgewogen", "treffer", "breite"].forEach(function (g) {
      var r = FRQ_cbfGrenzen(kette, wand, { cbfGewicht: g,
        cbfRandverhalten: "mittel", cbfRandspektrum: "frei" });
      var e = r.edges;
      var mono = true;
      for (var i = 1; i < e.length; i++) if (!(e[i] > e[i - 1])) mono = false;
      var innerhalb = (e[0] >= 70 - 1e-3) && (e[e.length - 1] <= 8500 + 1e-3);
      out.push(g + ": edges = [" +
        e.map(function (x) { return Math.round(x); }).join(", ") + "] Hz  " +
        "monoton=" + mono + " waende_ok=" + innerhalb);
    });
    var allOk = out.every(function (l) { return l.indexOf("monoton=true") >= 0 && l.indexOf("waende_ok=true") >= 0; });
    return { ok: allOk, msg: out.join("\n") };
  });
})();
