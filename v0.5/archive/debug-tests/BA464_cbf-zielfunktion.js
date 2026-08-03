/* BA464: CBF-Zielfunktion v2 — Rechenkern-Diagnose. */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA464/cbf-zielfunktion", { tab: "frequenzabgleich", label: "CBF Zielfunktion v2" }, function () {
    var kette = [
      { elIdx: 0, hz: 104,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 1, hz: 296,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 2, hz: 673,  statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 3, hz: 1211, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 4, hz: 2302, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 5, hz: 4153, statusGewicht: 1, residuum: null, gemessen: true },
      { elIdx: 6, hz: 7410, statusGewicht: 0, residuum: null, gemessen: false }
    ];
    var wand = { loHz: 70, hiHz: 8500 };
    var out = [], fails = [];
    function lauf(name, opt) {
      var r = FRQ_cbfGrenzen(kette, wand, opt);
      var e = r.edges, mono = true, i;
      for (i = 1; i < e.length; i++) if (!(e[i] > e[i - 1])) mono = false;
      var waende = (e[0] >= 70 - 1e-3) && (e[e.length - 1] <= 8500 + 1e-3);
      if (!mono) fails.push(name + ": nicht monoton");
      if (!waende) fails.push(name + ": Wand verletzt");
      out.push(name + ": [" + e.map(function (x) { return Math.round(x); }).join(", ") + "]");
      return e;
    }
    var basis = { cbfGewicht: "ausgewogen", cbfRandverhalten: "mittel",
                  cbfRandspektrum: "frei", cbfSprache: "mittel" };
    var e0 = lauf("ausgewogen/frei", basis);
    lauf("treffer/frei", { cbfGewicht: "treffer", cbfRandverhalten: "mittel", cbfRandspektrum: "frei", cbfSprache: "mittel" });
    lauf("breite/frei", { cbfGewicht: "breite", cbfRandverhalten: "mittel", cbfRandspektrum: "frei", cbfSprache: "mittel" });
    var eV = lauf("ausgewogen/voll", { cbfGewicht: "ausgewogen", cbfRandverhalten: "mittel", cbfRandspektrum: "voll", cbfSprache: "mittel" });
    // E1-Treffer (verifiziert +22ct): Mitte Band 0 nahe 104 Hz.
    var c0 = Math.sqrt(e0[0] * e0[1]);
    var abw0 = Math.abs(1200 * Math.log2(c0 / 104));
    if (!(abw0 <= 60)) fails.push("E1-Abweichung " + abw0.toFixed(0) + "ct > 60ct");
    // Stummes Randband klein + Wand NICHT erreicht (frei; verifiziert 150ct / ~6045 Hz).
    var brS = 1200 * Math.log2(e0[7] / e0[6]);
    if (!(brS <= 160)) fails.push("stummes Band " + brS.toFixed(0) + "ct > 160ct");
    if (!(e0[7] < 7000)) fails.push("stumme Oberkante " + Math.round(e0[7]) + " erreicht die Wand");
    // Mindestbreite nicht-stummer Baender (verifiziert min 731ct).
    for (var b = 0; b < 6; b++) {
      var br = 1200 * Math.log2(e0[b + 1] / e0[b]);
      if (!(br >= 199)) fails.push("Band " + (b + 1) + " Breite " + br.toFixed(0) + "ct < 200ct");
    }
    // Achse "voll": letzte Kante auf der Wand.
    if (!(Math.abs(eV[7] - 8500) < 0.5)) fails.push("voll: Oberkante " + Math.round(eV[7]) + " != 8500");
    return { ok: fails.length === 0,
             msg: (fails.length ? "FEHLER:\n" + fails.join("\n") + "\n" : "") + out.join("\n") };
  });
})();
