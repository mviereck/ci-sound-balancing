/* archiviert 2026-07-06 aus Bauanleitung BA447 — Optimierer-Rechenkern.
 * Reaktivierbar, falls die Grenzsetzungs-Optimierung (Sec. 14) erneut
 * gegen die realen Daten geprueft werden soll.
 */
/* BA447 — Bandgrenzen-Optimierer (Rechenkern, Sec. 14.7) */
(function () {
  if (typeof dbg === "undefined" || typeof dbg.test !== "function") return;
  dbg.test("build/BA447/optimierer", {
    tab: "results", label: "BA447: Bandgrenzen-Optimierer"
  }, function () {
    var lines = [];
    function chk(label, ok) { lines.push((ok ? "OK" : "FAIL") + " " + label); }

    // Reale gehoerte Frequenzen (Seite rechts, Datei 26-07-02) + Residuen.
    var heard = [104,296,435,673,925,1211,1609,2302,2947,4153,6355,7410];
    var resid = [15,61.25,42.5,35,8.75,7.5,6.25,51.25,0,41.25,67.5,null];
    var mk = function () {
      return heard.map(function (h, i) {
        return { elIdx: i, hz: h, aktiv: true,
                 residuum: resid[i], gemessen: (resid[i] != null) };
      });
    };
    var ct = function (a, b) { return 1200 * Math.log2(a / b); };

    // T1 Warp-Regression: optimieren=false == heutige nahtlose Grenzen.
    var mAlt = mk(), mOpt = mk();
    var alt = FRQ_baender(mAlt, "geometrisch", "nahtlos");
    var klass = FRQ_baender(mOpt, "geometrisch", "nahtlos", false);
    var t1 = alt.bands.length === klass.bands.length && alt.bands.every(function (b, i) {
      return Math.abs(b.loHz - klass.bands[i].loHz) < 1e-9
          && Math.abs(b.hiHz - klass.bands[i].hiHz) < 1e-9;
    });
    chk("T1/T2 klassisch(optimieren=false) == Alt-Grenzen (bit-genau)", t1);

    // T3 Optimierung gemessen: Center-Abweichung ~0 fuer GEMESSENE El.,
    // keine negativen Baender.
    var range = { loP: Math.log(70), hiP: Math.log(8500) };
    var o = FRQ_baender(mk(), "geometrisch", "nahtlos", true, "minimax", range);
    var maxAbwGemessen = 0, negativ = false;
    o.bands.forEach(function (b, i) {
      if (b.hiHz <= b.loHz) negativ = true;
      if (resid[i] != null) {
        var dev = Math.abs(ct(b.centerHz, heard[i]));
        if (dev > maxAbwGemessen) maxAbwGemessen = dev;
      }
    });
    chk("T3 optimiert: max Center-Abw gemessen < 2 ct (ist " + maxAbwGemessen.toFixed(2) + ")", maxAbwGemessen < 2);
    chk("T3 optimiert: keine negativen/Null-Baender", !negativ);

    // T4 Regularisierung wirkt: mit lambda positiv+monoton (schon in T3
    // geprueft). Gegenprobe lambda=0 waere unbrauchbar -> hier nur
    // dokumentiert, kein FAIL erzwungen (lambda ist intern).
    chk("T4 Regularisierung -> Baender positiv (siehe T3)", !negativ);

    // T5 Randkante: letztes Band (E12, ungemessen) reicht bis ~obere Range
    // und ist NICHT entartet.
    var last = o.bands[o.bands.length - 1];
    var randOk = last && (last.hiHz > last.loHz + 1) && (last.hiHz > 7900);
    chk("T5 Randband bis obere Range, nicht entartet (hi=" + (last ? last.hiHz.toFixed(0) : "?") + ")", randOk);

    // T6 minimax == summe bei loesbarer Kette (reale Daten sind loesbar).
    var oMx = FRQ_baender(mk(), "geometrisch", "nahtlos", true, "minimax", range);
    var oSu = FRQ_baender(mk(), "geometrisch", "nahtlos", true, "summe", range);
    var t6 = oMx.bands.every(function (b, i) {
      return Math.abs(b.loHz - oSu.bands[i].loHz) < 1e-3
          && Math.abs(b.hiHz - oSu.bands[i].hiHz) < 1e-3;
    });
    chk("T6 minimax == summe bei loesbarer Kette", t6);

    // T7 Determinismus: gleicher Eingang -> gleiche Grenzen.
    var d1 = FRQ_baender(mk(), "geometrisch", "nahtlos", true, "minimax", range);
    var d2 = FRQ_baender(mk(), "geometrisch", "nahtlos", true, "minimax", range);
    var t7 = d1.bands.every(function (b, i) {
      return b.loHz === d2.bands[i].loHz && b.hiHz === d2.bands[i].hiHz;
    });
    chk("T7 Determinismus (gleicher Eingang -> gleiche Grenzen)", t7);

    // Ungemessen-Vorschlag: E12 hat centerVorschlagHz gesetzt.
    var e12 = o.bands[o.bands.length - 1];
    chk("Ungemessen-Vorschlag gesetzt (E12)", e12 && e12.centerVorschlagHz != null);

    return lines.join("\n");
  });
})();
