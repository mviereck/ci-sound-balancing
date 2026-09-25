/* debug-tests-current.js — Bauanleitung 83
 *
 * Aktive Bau-Diagnose-Tests aus laufenden Bauanleitungen.
 * Konvention:
 *   - Tests heißen `build/BAxx/<topic>` und tragen `opts.tab` der
 *     zugehörigen Bauanleitung (z.B. "messungen", "player",
 *     "global").
 *   - Pro temporärem Test ein eigener IIFE-Block, klar mit
 *     Bauanleitungs-Nummer kommentiert.
 *   - Nach Bau-Abnahme wird der Test wieder entfernt (die
 *     Git-Historie hält ihn fest).
 *
 * Diese Datei beim Start leer (bis auf Header). Sie wird von
 * Bauanleitungen befüllt und wieder geleert — und ist deshalb
 * der einzige Ort im aktiven Code, an dem Tests kommen und gehen.
 */
(function () {
  'use strict';
  if (typeof dbg === 'undefined' || typeof dbg.test !== 'function') return;

  // BA522: Verletzungs-Kanten + gewichtete Mitte
  dbg.test('build/BA522/streuband-kanten', { tab: 'messungen', label: 'BA522: Verletzungs-Kanten + gewichtete Mitte' }, function () {
    var backup = (typeof FRQ_pianoSession !== 'undefined') ? FRQ_pianoSession : null;
    function err(msg) { return { ok: false, msg: msg }; }
    try {
      // Fall A: sauberer Konvergierer (Elektrode 0, Sitzung 1)
      // Band = letzte Runde (+-30), grobe Vorrunden zaehlen nicht mehr
      FRQ_pianoSession = {
        frqRefMode: null, run: null,
        perElectrode: {
          0: { verlauf: [
            { step: 240, lower: -240, upper: 240, durchgang: 1 },
            { step: 120, lower: -120, upper: 120, durchgang: 1 },
            { step:  60, lower:  -60, upper:  60, durchgang: 1 },
            { step:  30, lower:  -30, upper:  30, durchgang: 1 }
          ]}
        }
      };
      var bandA = _frq_pianoResiduumBand(0);
      if (!bandA) return err('Fall A: kein Band');
      if (Math.abs(bandA.mitte - 0) > 0.001)      return err('Fall A: mitte erwartet 0, got ' + bandA.mitte);
      if (Math.abs(bandA.residDown - 30) > 0.001)  return err('Fall A: residDown erwartet 30, got ' + bandA.residDown);
      if (Math.abs(bandA.residUp   - 30) > 0.001)  return err('Fall A: residUp erwartet 30, got ' + bandA.residUp);
      if (Math.abs(bandA.restspanne - 30) > 0.001) return err('Fall A: restspanne erwartet 30, got ' + bandA.restspanne);
      var stepA = _frq_pianoNaechsterSchritt(0, 1);
      if (Math.abs(stepA - 15) > 0.001) return err('Fall A: step erwartet 15, got ' + stepA);
      if (_frq_pianoAusgereizt(0, 1) !== false) return err('Fall A: ausgereizt soll false sein');

      // Fall B: stabiler Pendler (Elektrode 1, Sitzung 1)
      FRQ_pianoSession.perElectrode[1] = { verlauf: [
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 },
        { step: 60, lower: -30, upper:  90, durchgang: 1 },
        { step: 60, lower: -60, upper:  60, durchgang: 1 }
      ]};
      if (_frq_pianoAusgereizt(1, 1) !== true) return err('Fall B: ausgereizt soll true sein');
      if (_frq_pianoNaechsterSchritt(1, 1) !== null) return err('Fall B: naechsterSchritt soll null sein');
      var bandB = _frq_pianoResiduumBand(1);
      if (!bandB) return err('Fall B: kein Band');
      // Fenster = Runden 3-5 (gleiche step=60): gewichtet = ungewichtet -> mitte=10
      if (Math.abs(bandB.mitte - 10) > 0.001)      return err('Fall B: mitte erwartet 10, got ' + bandB.mitte);
      if (Math.abs(bandB.residDown - 70) > 0.001)  return err('Fall B: residDown erwartet 70, got ' + bandB.residDown);
      if (Math.abs(bandB.residUp   - 80) > 0.001)  return err('Fall B: residUp erwartet 80, got ' + bandB.residUp);
      if (Math.abs(bandB.restspanne - 60) > 0.001) return err('Fall B: restspanne erwartet 60, got ' + bandB.restspanne);

      // Fall C: Sitzungsstart Elektrode 1 fuer Sitzung 2
      var startC = _frq_pianoSitzungsStart(1, 2);
      if (Math.abs(startC.step - 30) > 0.001)   return err('Fall C: step erwartet 30, got ' + startC.step);
      if (Math.abs(startC.center - 15) > 0.001) return err('Fall C: center erwartet 15, got ' + startC.center);

      // Fall D: asymmetrische Konvergenz, gewichtete Mitte (Elektrode 2, Sitzung 1)
      // Runde 1: step=60, lower=-30, upper=90 -> mitte=30; w=1/3600
      // Runde 2: step=30, lower=-30, upper=30 -> mitte=0;  w=1/900=4/3600
      // mitte = (30*1 + 0*4)/5 = 6
      // Band: Ausgangspunkt (letzte Runde) [-30,+30]; Verletzungs-Logik:
      //   e1 lower=-30 (sLo=null->-30), upper=90 (sHi=null->90)
      //   e2 lower=-30 (nicht < sLo=-30), upper=30 (nicht > sHi_davor=90) -> keine Ausweitung
      // bandLo=-30, bandHi=30; mitte=6 liegt darin
      FRQ_pianoSession.perElectrode[2] = { verlauf: [
        { step: 60, lower: -30, upper: 90, durchgang: 1 },
        { step: 30, lower: -30, upper: 30, durchgang: 1 }
      ]};
      var bandD = _frq_pianoResiduumBand(2);
      if (!bandD) return err('Fall D: kein Band');
      if (Math.abs(bandD.mitte - 6) > 0.001)       return err('Fall D: mitte erwartet 6, got ' + bandD.mitte);
      if (Math.abs(bandD.residDown - 36) > 0.001)   return err('Fall D: residDown erwartet 36, got ' + bandD.residDown);
      if (Math.abs(bandD.residUp - 24) > 0.001)     return err('Fall D: residUp erwartet 24, got ' + bandD.residUp);
      if (Math.abs(bandD.restspanne - 30) > 0.001)  return err('Fall D: restspanne erwartet 30, got ' + bandD.restspanne);

      return { ok: true, msg: 'A/B/C/D bestanden' };
    } finally {
      FRQ_pianoSession = backup;
    }
  });
})();

/* BA552 — FRQ_werte-Cache: Treffer bei gleichen Eingaben, Miss nach
 * Aenderung. Prueft die Zuverlaessigkeits-Invariante an einer im Schluessel
 * erfassten Quelle (activeSide). */
(function () {
  if (typeof dbg === "undefined" || !dbg.test) return;
  dbg.test("build/BA552/frqwerte-cache", { label: "FRQ_werte-Cache" }, function () {
    if (typeof FRQ_werte !== "function") return { ok: false, msg: "FRQ_werte fehlt" };
    var dist = (typeof FRQ_distribution !== "undefined") ? FRQ_distribution : "right";

    // 1) Zwei Aufrufe mit identischen Eingaben -> identische Array-Referenz
    //    (Cache-Treffer gibt dieselbe Referenz zurueck).
    var a = FRQ_werte("gehoert", dist, false);
    var b = FRQ_werte("gehoert", dist, false);
    if (a !== b) return { ok: false, msg: "Zweiter gleicher Aufruf war KEIN Cache-Treffer (verschiedene Referenz)" };

    // 2) Anderes Argument (form) -> Miss -> andere Referenz.
    var c = FRQ_werte("warp", dist, false);
    if (c === a) return { ok: false, msg: "Anderes Argument haette Neuberechnung ausloesen muessen" };

    // 3) Nach Aenderung einer erfassten Eingabe (activeSide) -> Miss.
    //    activeSide sicher zuruecksetzen im finally.
    var savedSide = activeSide;
    var missNachSideWechsel = false;
    try {
      var vorher = FRQ_werte("gehoert", "right", false);
      activeSide = (activeSide === "left") ? "right" : "left";
      var nachher = FRQ_werte("gehoert", "right", false);
      missNachSideWechsel = (vorher !== nachher);
    } finally {
      activeSide = savedSide;
      if (typeof bindActiveSide === "function") bindActiveSide();
    }
    if (!missNachSideWechsel) {
      return { ok: false, msg: "activeSide-Wechsel loeste keinen Cache-Miss aus (Schluessel unvollstaendig!)" };
    }

    return { ok: true, msg: "Treffer bei gleichen Eingaben, Miss bei Argument- und activeSide-Aenderung" };
  });
})();

/* BA557 -- parallel-axes Engine-Kern: prueft die reine Filterlogik
 * (amItemMatchesAxes, amBucketsForAxisValues) an synthetischen Items,
 * ohne DOM. */
(function () {
  if (typeof dbg === "undefined" || !dbg.test) return;
  dbg.test("build/BA557/parallel-axes-logik", { tab: "player", label: "BA557 Parallel-Achsen-Logik" }, function () {
    if (typeof amItemMatchesAxes !== "function" || typeof amBucketsForAxisValues !== "function") {
      return { ok: false, msg: "Engine-Funktionen fehlen" };
    }
    // Synthetische Achsen (getter liest tags.X).
    var axSource = { key: "source", getter: function (it) { return (it.tags && it.tags.source) || ""; } };
    var axGender = { key: "gender", getter: function (it) { return (it.tags && it.tags.gender) || ""; } };
    var axes = [axSource, axGender];
    var items = [
      { tags: { source: "A", gender: "m" } },
      { tags: { source: "A", gender: "w" } },
      { tags: { source: "B", gender: "m" } },
      { tags: { source: "B" } }                 // gender tag-frei
    ];
    // 1) "_all" ueberall -> alle 4 passen.
    var c1 = items.filter(function (it) { return amItemMatchesAxes(axes, {}, it); }).length;
    // 2) source=A -> 2 passen.
    var c2 = items.filter(function (it) { return amItemMatchesAxes(axes, { source: "A" }, it); }).length;
    // 3) source=B, gender=_none -> 1 passt (das tag-freie).
    var c3 = items.filter(function (it) { return amItemMatchesAxes(axes, { source: "B", gender: "_none" }, it); }).length;
    // 4) Bucket-Werte fuer gender ueber alle: values [m,w], hasNone true.
    var b = amBucketsForAxisValues(axGender, items);
    var okB = (b.values.length === 2 && b.values[0] === "m" && b.values[1] === "w" && b.hasNone === true && b.hasSome === true);
    var ok = (c1 === 4 && c2 === 2 && c3 === 1 && okB);
    return { ok: ok, msg: "all=" + c1 + " srcA=" + c2 + " Bnone=" + c3 + " genderBuckets=[" + b.values.join(",") + "] hasNone=" + b.hasNone };
  });
})();

/* BA560 — multi-Achsen in der Filterkette-Engine.
 * Prueft amAxisValues / amItemMatchesAxes / amBucketsForAxisValues
 * an einer synthetischen multi-Achse + einer einwertigen Achse.
 */
(function () {
  if (typeof dbg === "undefined" || !dbg.test) return;
  dbg.test("build/BA560/multi-achsen", { label: "BA560 multi-Achsen" }, function () {
    var genreAxis  = { key: "g", multi: true,  getter: function (it) { return (it.tags && it.tags.genres) || []; } };
    var vocalAxis  = { key: "v", getter: function (it) { return (it.tags && it.tags.vocal) || "zzz-unbekannt"; } };
    var items = [
      { id: "a", tags: { genres: ["pop", "rock"], vocal: "y" } },
      { id: "b", tags: { genres: ["pop"],         vocal: "n" } },
      { id: "c", tags: { genres: [],              vocal: "n" } }
    ];

    // amAxisValues: multi liefert Liste, leeres Array = tag-frei.
    var va = amAxisValues(genreAxis, items[0]);
    if (!(va.length === 2 && va.indexOf("pop") >= 0 && va.indexOf("rock") >= 0))
      return { ok: false, msg: "amAxisValues multi falsch: " + JSON.stringify(va) };
    if (amAxisValues(genreAxis, items[2]).length !== 0)
      return { ok: false, msg: "leeres genres-Array muss tag-frei sein" };
    // einwertig ueber Liste
    var vv = amAxisValues(vocalAxis, items[0]);
    if (!(vv.length === 1 && vv[0] === "y"))
      return { ok: false, msg: "amAxisValues einwertig falsch: " + JSON.stringify(vv) };

    // Match: Auswahl genre=pop trifft a UND b (beide enthalten pop), nicht c.
    var axes = [genreAxis, vocalAxis];
    var mPop = items.filter(function (it) { return amItemMatchesAxes(axes, { g: "pop" }, it); });
    if (!(mPop.length === 2 && mPop[0].id === "a" && mPop[1].id === "b"))
      return { ok: false, msg: "Match genre=pop falsch: " + mPop.map(function (x){return x.id;}).join(",") };
    // Match: genre=rock trifft nur a.
    var mRock = items.filter(function (it) { return amItemMatchesAxes(axes, { g: "rock" }, it); });
    if (!(mRock.length === 1 && mRock[0].id === "a"))
      return { ok: false, msg: "Match genre=rock falsch" };
    // Match: genre=_none trifft nur c.
    var mNone = items.filter(function (it) { return amItemMatchesAxes(axes, { g: "_none" }, it); });
    if (!(mNone.length === 1 && mNone[0].id === "c"))
      return { ok: false, msg: "Match genre=_none falsch" };

    // Buckets: Vereinigung pop,rock; hasNone (c) UND hasSome.
    var b = amBucketsForAxisValues(genreAxis, items);
    if (!(b.values.length === 2 && b.values[0] === "pop" && b.values[1] === "rock"))
      return { ok: false, msg: "Buckets values falsch: " + JSON.stringify(b.values) };
    if (!(b.hasNone === true && b.hasSome === true))
      return { ok: false, msg: "Buckets hasNone/hasSome falsch" };

    return { ok: true, msg: "multi-Achsen ok (Werte/Match/Buckets)" };
  });
})();

// BA602 — Detail-Anreicherung
(function () {
  /* BA602 — Detail-Anreicherung: ein schlankes Saetze-Item anreichern und pruefen,
   * dass audio+text danach am Item stehen. */
  dbg.test("build/BA602/detail-anreicherung", { tab: "player", label: "Detail-Anreicherung (Saetze)" }, async function () {
    if (typeof amCollectItems !== "function") return { ok: false, msg: "amCollectItems fehlt" };
    const items = amCollectItems("saetze");
    const slim = items.find(function (it) { return it && it.detail && !it.audio; });
    if (!slim) return { ok: false, msg: "kein schlankes Saetze-Item gefunden (Buendel evtl. nicht schlank?)" };
    const c = (typeof gPC === "function") ? gPC() : null;
    const before = { audio: slim.audio, text: slim.text };
    await amGetItemBuffer(c, slim);   // loest die Anreicherung aus (Buffer egal)
    const okAudio = typeof slim.audio === "string" && slim.audio.length > 0;
    const okText  = typeof slim.text  === "string";
    return {
      ok: okAudio && okText,
      msg: "vorher audio=" + JSON.stringify(before.audio) + " -> nachher audio=" + JSON.stringify(slim.audio) + ", text-len=" + (slim.text ? slim.text.length : 0)
    };
  });
})();

// BA603 — detail nur Laenge: Offset-Rekonstruktion
(function () {
  /* BA603 — detail nur Laenge: ein WEIT HINTEN liegendes schlankes Saetze-Item
   * anreichern und pruefen, dass Offset-Summierung stimmt (audio+text kommen an). */
  dbg.test("build/BA603/detail-offset", { tab: "player", label: "Detail-Offset (spaetes Item)" }, async function () {
    if (typeof amCollectItems !== "function") return { ok: false, msg: "amCollectItems fehlt" };
    const items = amCollectItems("saetze");
    const slim = items.filter(function (it) { return it && typeof it.detail === "number" && !it.audio; });
    if (!slim.length) return { ok: false, msg: "kein schlankes Saetze-Item (Buendel evtl. altes Format?)" };
    const it = slim[Math.min(slim.length - 1, 5000)];   // ein Item weit hinten (grosser Offset)
    const c = (typeof gPC === "function") ? gPC() : null;
    await amGetItemBuffer(c, it);
    const okAudio = typeof it.audio === "string" && it.audio.length > 0;
    const okText  = typeof it.text === "string";
    return {
      ok: okAudio && okText,
      msg: "detailStart=" + it.detailStart + " len=" + it.detail + " -> audio=" + JSON.stringify(it.audio) + " text-len=" + (it.text ? it.text.length : 0)
    };
  });
})();
