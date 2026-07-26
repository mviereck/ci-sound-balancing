// ============================================================
// IMPLANT & PROCESSOR LISTS
// ============================================================
const IMPLANTS = {
  medel: [
    { model: "SYNCHRONY 2", tech: "Mi1200", year: 2020 },
    { model: "SYNCHRONY", tech: "Mi1200", year: 2013 },
    { model: "CONCERTO", tech: "Mi1000", year: 2009 },
    { model: "SONATA", tech: "Mi1000", year: 2006 },
    { model: "PULSAR", tech: "Mi1000", year: 2004 },
    { model: "COMBI 40+", tech: "C40+", year: 1999 },
    { model: "COMBI 40", tech: "C40", year: 1997 },
  ],
  cochlear: [
    {
      model: "CI632 (Profile Plus, Slim Modiolar)",
      gen: "B",
      year: 2020,
    },
    { model: "CI624 (Profile Plus)", gen: "B", year: 2020 },
    {
      model: "CI622 (Profile Plus, Slim Straight)",
      gen: "B",
      year: 2020,
    },
    {
      model: "CI612 (Profile Plus, Contour Advance)",
      gen: "B",
      year: 2020,
    },
    { model: "CI532 (Profile, Slim Modiolar)", gen: "B", year: 2014 },
    { model: "CI522 (Profile, Slim Straight)", gen: "B", year: 2014 },
    { model: "CI512 (Profile, Contour Advance)", gen: "B", year: 2014 },
    { model: "CI24RE (Freedom)", gen: "B", year: 2005 },
    { model: "CI24R", gen: "A", year: 2002 },
    { model: "CI24M", gen: "A", year: 1998 },
    { model: "CI22M (Nucleus 22)", gen: "A", year: 1985 },
  ],
  ab: [
    { model: "HiRes Ultra 3D", tech: "CI-1601", year: 2017 },
    { model: "HiRes Ultra", tech: "CI-1600", year: 2013 },
    { model: "HiRes 90K Advantage", tech: "CI-1500", year: 2013 },
    { model: "HiRes 90K", tech: "CI-1400", year: 2003 },
    { model: "Clarion CII", tech: "AB-5100H", year: 2001 },
    { model: "Clarion 1.2", tech: "AB-5100", year: 1999 },
    { model: "Clarion 1.0", tech: "MMT-5100", year: 1996 },
  ],
};
const PROCESSORS = {
  medel: [
    { model: "SONNET 3", form: "BTE", year: 2023 },
    { model: "RONDO 3", form: "OTE", year: 2020 },
    { model: "SONNET 2", form: "BTE", year: 2018 },
    { model: "RONDO 2", form: "OTE", year: 2016 },
    { model: "SONNET", form: "BTE", year: 2014 },
    { model: "RONDO", form: "OTE", year: 2011 },
    { model: "OPUS 2", form: "BTE", year: 2007 },
    { model: "TEMPO+", form: "BTE", year: 2003 },
  ],
  cochlear: [
    { model: "Kanso 3 Nexa (CP1175)", form: "OTE", year: 2024 },
    { model: "Kanso 3 (CP1170)", form: "OTE", year: 2023 },
    { model: "Nucleus 8", form: "BTE", year: 2022 },
    { model: "Kanso 2", form: "OTE", year: 2020 },
    { model: "Nucleus 7", form: "BTE", year: 2017 },
    { model: "Kanso (CP950)", form: "OTE", year: 2016 },
    { model: "Nucleus 6 (CP910/CP920)", form: "BTE", year: 2013 },
    { model: "Nucleus 5 (CP810)", form: "BTE", year: 2010 },
    { model: "Freedom", form: "BTE", year: 2005 },
    { model: "ESPrit 3G", form: "BTE", year: 2002 },
  ],
  ab: [
    { model: "Naída CI M / Sky CI M", form: "BTE", year: 2020 },
    { model: "Naída CI Q90", form: "BTE", year: 2016 },
    { model: "Naída CI Q70", form: "BTE", year: 2012 },
    { model: "Neptune", form: "Body", year: 2011 },
    { model: "Harmony", form: "BTE", year: 2007 },
    { model: "Auria", form: "BTE", year: 2004 },
    { model: "Platinum Series", form: "Body", year: 2000 },
  ],
};

// ============================================================
// CALCULATION FUNCTIONS (dB → manufacturer unit)
// ============================================================
function detectCochlearGen(modelStr) {
  const entry = IMPLANTS.cochlear.find((x) => x.model === modelStr);
  return entry ? entry.gen : null;
}
// MED-EL: ΔMCL [qu] = MCL_alt · (10^(ΔdB/20) − 1)
function calcMedel(dB, mclOld) {
  if (mclOld === null || mclOld === undefined || isNaN(mclOld))
    return { delta: null, absolute: null };
  const newMcl = mclOld * Math.pow(10, dB / 20);
  return { delta: newMcl - mclOld, absolute: newMcl };
}
// Cochlear: ΔC [CL] = ΔdB / step
function calcCochlear(dB, cOld, generation) {
  const step = generation === "A" ? 0.176 : generation === "B" ? 0.157 : null;
  if (step === null) return { delta: null, absolute: null };
  const delta = dB / step;
  return {
    delta,
    absolute:
      cOld !== null && cOld !== undefined && !isNaN(cOld) ? cOld + delta : null,
  };
}
// AB: ΔM [CU] = ((M−T)/IDR) · ΔdB
function calcAB(dB, mOld, tOld, idr) {
  const idrUse = idr !== null && idr !== undefined && !isNaN(idr) ? idr : 60;
  const assumedIDR = idr === null || idr === undefined || isNaN(idr);
  if (
    mOld === null ||
    mOld === undefined ||
    isNaN(mOld) ||
    tOld === null ||
    tOld === undefined ||
    isNaN(tOld)
  )
    return {
      delta: null,
      absolute: null,
      idrUsed: idrUse,
      assumedDefaults: true,
      assumedIDR,
    };
  const delta = ((mOld - tOld) / idrUse) * dB;
  return {
    delta,
    absolute: mOld + delta,
    idrUsed: idrUse,
    assumedDefaults: false,
    assumedIDR,
  };
}

// Y-Achsen-Maxima für Absolutmodus-Skala im Levels-Tab.
const ELEKTRODENLAUTSTAERKE_AXIS_MAX = {
  medel: 300,
  cochlear: 255,
  ab: 600,
};
function ELL_axisMaxFor(mfrId) {
  return ELEKTRODENLAUTSTAERKE_AXIS_MAX[mfrId] || 300;
}
function ELL_unitLabelFor(mfrId) {
  if (mfrId === "medel") return "qu";
  if (mfrId === "cochlear") return "CL";
  if (mfrId === "ab") return "CU";
  return "";
}
// Inverse Umrechnungen (Hersteller-Einheit → dB), Gegenstück zu calcMedel/calcCochlear/calcAB.
function dbFromMedel(mclNew, mclOld) {
  if (mclOld == null || mclNew == null || mclOld <= 0 || mclNew <= 0) return null;
  return 20 * Math.log10(mclNew / mclOld);
}
function dbFromCochlear(cNew, cOld, generation) {
  const step = generation === "A" ? 0.176 : generation === "B" ? 0.157 : null;
  if (step === null || cOld == null || cNew == null) return null;
  return step * (cNew - cOld);
}
function dbFromAB(mNew, mOld, tOld, idr) {
  const idrUse = idr != null && !isNaN(idr) ? idr : 60;
  if (mOld == null || tOld == null || mNew == null) return null;
  const span = mOld - tOld;
  if (span === 0) return null;
  return (mNew - mOld) * idrUse / span;
}

// ============================================================
// MANUFACTURERS
// ============================================================
const MFR = {
  unknown: {
    name: "—",
    n: 0,
    apFirst: true,
    defaultRange: null,
    bandGrenzen: null,
    FRQ_implantat: [],
  },
  medel: {
    name: "MED-EL",
    n: 12,
    apFirst: true,
    defaultRange: [70, 8500],   // BA433: echte From/To (MAESTRO-Default)
    // Mögliche Gesamt-Bandgrenzen (untere/obere Wand). Quelle:
    // MED-EL-User-Manual-MAESTRO-11-EN §24.6, Tabelle „Parameters
    // with defaults for the frequency band distribution and
    // frequency range". From/To ist Input-Typ integer [Hz; Hz] und
    // FREI editierbar (Doppelklick/Feld) — die lo-Werte sind
    // strategieabhängige Defaults bzw. Bereichsränder, keine harte
    // Auswahlliste: 70 (other strategies, Default), 250 (HDCIS-
    // Default), 300 (CIS+-Default), 200 (CIS+-Range-Untergrenze).
    // Obergrenze in allen Strategien 8500.
    bandGrenzen: { lo: [70, 200, 250, 300], hi: [8500], default: [70, 8500] },
    FRQ_implantat: [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410],
  },
  ab: {
    name: "Advanced Bionics",
    n: 16,
    apFirst: true,
    defaultRange: [250, 8700],  // SoundWave 2.2 FAT, HiRes/HiRes120 Extended Low (Default): E1-Low 250 Hz, E16-High 8700 Hz
    // Mögliche Gesamt-Bandgrenzen. Quelle: SoundWave 2.2 Quick
    // Reference, Frequency Allocation Table (S. 38). Feste Filter-
    // Varianten (kein freies Editieren belegt): E1-Low 250 (Extended
    // Low, AB-Default) bzw. 350 (Standard Filter); E16-High in beiden
    // 8700. Details .docs/Konzept_ABF_Frequenzabbildung.md §8.
    bandGrenzen: { lo: [250, 350], hi: [8700], default: [250, 8700] },
    FRQ_implantat: [
      333, 455, 540, 642, 762, 906, 1076, 1278, 1518, 1803, 2142, 2544, 3022,
      3590, 4264, 6665,
    ],
  },
  cochlear: {
    name: "Cochlear",
    n: 22,
    apFirst: false,
    defaultRange: [188, 7938],  // Standard-FAT 188–7938 Hz
    // Mögliche Gesamt-Bandgrenzen (LFE/HFE, frei kreuzkombinierbar).
    // Quelle: CI-Select-App-Manual, Appendix S. 22–46 (NYU Langone,
    // Svirsky-Labor). ACHTUNG: das ist die Endnutzer-App, NICHT
    // Cochlears Fitting-Software Custom Sound — Übertragbarkeit auf
    // Custom Sound ungesichert (siehe .docs/Konzept_MAESTRO_
    // Uebertragung.md §5.14). LFE (13 Optionen) 63…1813, HFE (5
    // Optionen) 7938…18938; die oberste HFE 18938 ist nicht
    // hardware-belegt. pre-NEXA erlaubt in Custom Sound sogar freie
    // LF-Eingabe, NEXA (ab 07/2025) nur 27 feste FATs.
    bandGrenzen: {
      lo: [63, 188, 313, 438, 563, 688, 813, 938, 1063, 1188, 1313, 1563, 1813],
      hi: [7938, 9804, 12100, 14924, 18938],
      default: [188, 7938],
    },
    // Standard-FAT bei LFE 188 Hz, HFE 7938 Hz, 22 aktiven
    // Kanälen. Quelle: CI Select App Manual S. 12/13 (NYU
    // Langone, Svirsky-Labor) und PMC11493529. Korrigiert in
    // BA 136 — vorher waren die Werte ab Position 9 aus
    // unbekannter Quelle und wichen bis zu ~125 Cent an E1
    // (basal) ab. Siehe .manuals/Recherche_CI_Select_App.md
    // und .manuals/Recherche_Cochlear_FAT_Deaktivierung.md.
    FRQ_implantat: [
      250, 375, 500, 625, 750, 875, 1000, 1125, 1250, 1438, 1688, 1938, 2188,
      2500, 2875, 3313, 3813, 4375, 5000, 5688, 6500, 7438,
    ],
  },
};
// ============================================================
// BA417: Feste, sprachunabhaengige Kurzkennung einer Seite ('L' | 'R').
function sideLetter(side) { return (side === "left") ? "L" : "R"; }

// FREQUENCY HELPERS (Cent, log-Interpolation)
// ============================================================
// Cent re 1000 Hz: 1000 Hz = 0 ¢, eine Oktave = 1200 ¢.
const CENT_REF_HZ = 1000;
function hzToCent(hz) {
  if (!hz || hz <= 0) return 0;
  return 1200 * Math.log2(hz / CENT_REF_HZ);
}
function centToHz(c) {
  return CENT_REF_HZ * Math.pow(2, c / 1200);
}
// ============================================================
// ZENTRALER ZAHLEN-AUSGABE-HELFER (BA432, §10)
// EINE Stelle, ueber die alle Zahlenausgaben des Tools formatiert
// werden. Kategoriengetrieben: benannte Formate, kein Sonderfall-Wust.
// Start: die zwei Frequenz-Formate. Weitere (dB, %, qu/CL/CU, Zeit)
// docken spaeter als Eintrag in FMT_SPECS an. Dezimaltrennzeichen
// durchgehend Punkt (JS-toFixed liefert das ohnehin).
// Intern wird NIE gerundet (in cent gerechnet); Rundung nur hier, am
// Darstellungsrand.
const FMT_SPECS = {
  hz:   { nk: 2 },   // Frequenz in Hz, 2 Nachkommastellen
  cent: { nk: 1 },   // Cent, 1 Nachkommastelle
};
// fmtNum(wert, format) -> String. Bei null/undefined/NaN -> "".
// Der Aufrufer haengt Einheit/Vorzeichen selbst an (der Helfer
// formatiert nur die Zahl).
function fmtNum(wert, format) {
  if (wert == null || (typeof wert === "number" && !isFinite(wert))) return "";
  var spec = FMT_SPECS[format];
  if (!spec) {
    console.warn("fmtNum: unbekanntes Format", format);
    return String(wert);
  }
  return Number(wert).toFixed(spec.nk);
}
// Identitaets-Transformation (BA442, §13.3): fuer Verfahren im linearen
// Rechenraum (cochlear), damit jeder Registry-Eintrag dieselbe toP/fromP-
// Form hat (kein null-Sonderfall).
function identityHz(x) { return x; }
// Geometrische (logarithmische) Mitte zweier Frequenzen (BA432, §9.3).
// Gemeinsamer Kern der Bandgrenzen fuer Empfehlung UND Warp.
function geomMitte(a, b) {
  return Math.sqrt(a * b);
}
// Greenwood-Funktion (Cochlea-Position <-> Frequenz), klassische Parameter.
// x in [0,1] = relative Cochlea-Position (0 = apikal/tief, 1 = basal/hoch).
// Grundlage des greenwood-Bandverfahrens (Architektur 00-freqmatch-
// wertquelle-architektur.md Sec. 11, Memo_Bandempfehlung_Greenwood.md).
function greenwoodHz(x, kk) {
  var k = (typeof kk === "number") ? kk : 0.88;
  return 165.4 * (Math.pow(10, 2.1 * x) - k);
}
function greenwoodX(hz, kk) {
  var k = (typeof kk === "number") ? kk : 0.88;
  return (1 / 2.1) * Math.log10(hz / 165.4 + k);
}
// BA490 (Architektur §6a): Stakhovskaya-2007-Tonotopie fuer das Verfahren
// "stakhovskaya". y(winkel) = A*e^(-B*winkel) + C, y = Prozent (0..100) der
// Distanz vom ovalen Fenster. SG = Spiral Ganglion (was die Elektrode reizt),
// OC = Organ of Corti. Parameter aus ABF-Patent (Konzept_ABF_Frequenzabbildung
// §2.1). Rein winkelbasiert -- KEIN Greenwood, KEIN k. Nur von der Glaettungs-
// Familie genutzt (NICHT im FRQ_bandVerfahren-Registry).
var STAKH_SG = { A: -99.3, B: 0.004, C: 105 };
var STAKH_OC = { A: -110,  B: 0.002, C: 115 };
function _stakhY(winkel, p) { return p.A * Math.exp(-p.B * winkel) + p.C; }   // Winkel -> Prozent
function _stakhYinv(y, p)   { return -Math.log((y - p.C) / p.A) / p.B; }      // Prozent -> Winkel

// BA499: Elektrodenlage-Position: gewichtete Mischung Organ-of-Corti (Aussenwand)
// und Spiral-Ganglion (Innenwand). w=0 reine OC (= Greenwood, linear ->
// ortsaffin-identisch), w=1 reine SG, w=0.5 ABF-Mittel. Architektur 00-glaettung
// §6b. Beide Enden nutzen dasselbe k (greenwoodX/Hz), damit hin=zurueck exakt.
function _lageToP(hz, kk, w) {
  var x    = greenwoodX(hz, kk);              // Hz -> Greenwood/OC-x
  var yoc  = 100 * (1 - x);                   // OC-Prozent
  var ang  = _stakhYinv(yoc, STAKH_OC);       // OC-Prozent -> Winkel
  var ysg  = _stakhY(ang, STAKH_SG);          // Winkel -> SG-Prozent
  return (1 - w) * yoc + w * ysg;             // Lage-Mischung
}
function _lageFromP(P, kk, w) {
  if (w <= 0) {                               // reine OC: P = 100*(1-x)
    return greenwoodHz(1 - P / 100, kk);
  }
  if (w >= 1) {                               // reine SG
    var angS = _stakhYinv(P, STAKH_SG);
    var yocS = _stakhY(angS, STAKH_OC);
    return greenwoodHz(1 - yocS / 100, kk);
  }
  // 0<w<1: P ist streng monoton in yoc -> Bisektion (Richtung robust bestimmt).
  function mixP(yoc) {
    var ang = _stakhYinv(yoc, STAKH_OC);
    var ysg = _stakhY(ang, STAKH_SG);
    return (1 - w) * yoc + w * ysg;
  }
  var lo = 0.001, hi = 99.999;
  var pLo = mixP(lo), pHi = mixP(hi);
  for (var it = 0; it < 80; it++) {
    var mid = 0.5 * (lo + hi);
    var pMid = mixP(mid);
    if ((pLo <= pHi) ? (pMid < P) : (pMid > P)) { lo = mid; pLo = pMid; }
    else { hi = mid; pHi = pMid; }
  }
  var yoc = 0.5 * (lo + hi);
  return greenwoodHz(1 - yoc / 100, kk);
}
// BA524: Lage-Stufe -> Rechenraum-Paar {toP, fromP}. EINE Quelle fuer
// alle Bandverfahren (Architektur 00-bandverfahren Paragraph 3/5).
// "geometrisch" -> log; aussen/mitte/innen -> Greenwood-Ortsraum mit w.
// k kommt aus der k-Achse (BA525); bis dahin Default-k (0.88).
function _frqBandRaum(lage, k) {
  var kk = (typeof k === "number") ? k : 0.88;
  if (lage === "aussen" || lage === "mitte" || lage === "innen") {
    var w = FRQ_BAND_LAGE_W[lage];
    // _lageToP liefert die Distanz vom ovalen Fenster (basal klein, apikal
    // gross) -> FALLEND in der Frequenz. Der Grenzsetzer verlangt aber einen
    // STRENG STEIGENDEN Positionsraum (Positionsordnung = Frequenzordnung,
    // Registry-Vertrag unten). Darum negieren: -_lageToP ist streng steigend;
    // fromP(-P) macht die Negation vor der (unveraenderten) Umkehrung rueckgaengig
    // (Roundtrip fromP(toP(hz)) === hz).
    return {
      toP:   function (hz) { return -_lageToP(hz, kk, w); },
      fromP: function (P)  { return _lageFromP(-P, kk, w); }
    };
  }
  // Default "geometrisch": reiner log-Raum.
  return { toP: Math.log, fromP: Math.exp };
}
// Frueher Registry der Bandraum-Transformationen (toP/fromP je Verfahren,
// BA442). Seit Entfernung von geometrisch/greenwood (BA524) und arithmetisch
// (BA529) leer: geometrisch kommt aus _frqBandRaum (Lage-Achse), CBF/sABF
// sind keine Registry-Verfahren.
var FRQ_bandVerfahren = {};
// Band-Topologie = GRENZSETZUNG in Positions-Koordinaten (BA443, §13.3/
// §13.4). Registry: Topologie-Name -> Funktion(P) -> [{loP,hiP}, ...]
// (ein Paar je Band, Laenge P.length). Rechnet NUR mit Positionen; der
// Rechenraum steckt bereits in P (via vf.toP im Rahmen). Jede Topologie
// funktioniert dadurch fuer JEDEN Rechenraum. nahtlos ist ein expliziter
// Eintrag, KEIN if-Sonderpfad (Strukturprinzip 3).
//
// P ist streng steigend und hat mindestens 2 Elemente (Einzel-Elektrode
// faengt der Rahmen vorher ab).
var FRQ_bandTopologie = {
  // Nahtlos (bisheriges Verhalten, §13.4): Grenze = Mittelpunkt der
  // Positions-Nachbarn; Raender = inneren Abstand spiegeln. Band um die
  // gehoerte Position ASYMMETRISCH -> Ergebnis-Center weicht i.A. ab.
  nahtlos: function (P) {
    var n = P.length;
    var innerP = [];
    for (var j = 0; j < n - 1; j++) innerP.push((P[j] + P[j + 1]) / 2);
    var lowP  = 2 * P[0]     - innerP[0];
    var highP = 2 * P[n - 1] - innerP[n - 2];
    var edges = [lowP].concat(innerP, [highP]);   // Laenge n+1, geteilt
    var out = [];
    for (var e = 0; e < n; e++) out.push({ loP: edges[e], hiP: edges[e + 1] });
    return out;
  },
  // Lueckig (§13.4): symmetrisch um P[k], halbe Breite = halber KLEINERER
  // Nachbarabstand -> nie Ueberlappung, minimale Luecke. Center = P[k].
  lueckig: function (P) {
    return _bandSymmetrisch(P, Math.min);
  },
  // Ueberlappend (§13.4): symmetrisch, halbe Breite = halber GROESSERER
  // Nachbarabstand -> nie Luecke, minimale Ueberlappung. Center = P[k].
  ueberlappend: function (P) {
    return _bandSymmetrisch(P, Math.max);
  }
};

// BA447 (Sec. 14.3): Regularisierungsgewicht des Optimierers. Unkritisch
// (0.0001..0.1 liefern praktisch identische Ergebnisse); benannt +
// kalibrierbar, kein UI. Ohne diesen Term ist "Center treffen"
// unterbestimmt -> alternierende/negative Baender.
var FRQ_BAND_LAMBDA = 0.001;
// BA447 (Sec. 14.3b): Mindest-Bandbreite 30 ct, in p-Einheiten des
// aktuellen Rechenraums (raumabhaengig -> aus toP an einer Referenz
// gemessen). Kalibrierbar (Startwert 30 ct).
var FRQ_BAND_MINBREITE_CT = 30;
// BA463: Die pro Seite gehaltenen Band-Wahlen (ALLE ausser Y-Skala). EINE
// Quelle fuer: sideData-Feldname, Default-value, .cimbel-Schluessel.
// key      = Feld in sideData[side] (sideData[side][key])
// def      = Default-value (String)
// fileKey  = Schluessel im seitenweisen .cimbel-Speicher (file.js sides.*)
// 0.5.474.1: aus freq-warp.js nach core.js verschoben. Grund: initSideData
// (state-side.js, Modul 2, Top-Level-Init) liest FRQ_BAND_WAHLEN -- lag die
// Konstante in freq-warp.js (viel spaeter geladen), war sie beim Init noch
// undefined, der typeof-Guard uebersprang still, und die seitenweisen Band-
// Wahlen (bandVerfahren usw.) blieben im frischen Zustand ungesetzt.
var FRQ_BAND_WAHLEN = [
  { key: "bandVerfahren",       def: "cbf",        fileKey: "bandVerfahren",       group: "FRQ_bandVerfahren" },
  { key: "bandTopologie",       def: "nahtlos",    fileKey: "bandTopologie",       group: "FRQ_bandTopologie" },
  { key: "bandOptimieren",      def: "optimiert",  fileKey: "bandOptimieren",      group: "FRQ_bandOptimieren" },
  { key: "bandZiel",            def: "minimax",    fileKey: "bandZiel",            group: "FRQ_bandZiel" },
  { key: "bandRandausgleich",   def: "mit",        fileKey: "bandRandausgleich",   group: "FRQ_bandRandausgleich" },
  { key: "bandCbfGewicht",      def: "ausgewogen", fileKey: "bandCbfGewicht",      group: "FRQ_bandCbfGewicht" },
  { key: "bandCbfApikalFrei",   def: "1",          fileKey: "bandCbfApikalFrei",   group: "FRQ_bandCbfApikalFrei" },
  { key: "bandCbfBasalFrei",    def: "1",          fileKey: "bandCbfBasalFrei",    group: "FRQ_bandCbfBasalFrei" },
  { key: "bandCbfSprache",      def: "mittel",     fileKey: "bandCbfSprache",      group: "FRQ_bandCbfSprache" },
  // BA524: gemeinsame Rechenraum-Achse (ersetzt Verfahren "greenwood" und
  // die CBF-Achse bandCbfBandraum).
  { key: "bandLage",  def: "geometrisch", fileKey: "bandLage",  group: "FRQ_bandLage" },
  // BA525: gemeinsame Greenwood-k-Achse (wirkt nur im Ortsraum).
  { key: "bandK",  def: "0.88", fileKey: "bandK",  group: "FRQ_bandK" },
  // BA526: gemeinsame Randverhalten-Achse (ersetzt bandGrenzeinhaltung + cbfRandspektrum).
  { key: "bandRandverhalten", def: "abschneiden", fileKey: "bandRandverhalten", group: "FRQ_bandRandverhalten" },
  // BA527: gemeinsame Mindestbreiten-Achse (cent). Ersetzt FRQ_BAND_MINBREITE_CT
  // (geom) und CBF_MIN_BREITE_CT (CBF). Default 100 ct (Mittelweg, Nutzer-
  // Beschluss 2026-07-20): fuer geom Anhebung von 30 -> Notbremse greift
  // etwas frueher; fuer CBF Absenkung von 200 -> Baender duerfen enger werden.
  { key: "bandMinBreite", def: "100", fileKey: "bandMinBreite", group: "FRQ_bandMinBreite" },
  { key: "bandGlaettVerfahren", def: "aus",         fileKey: "bandGlaettVerfahren", group: "FRQ_glaettVerfahren" },
  { key: "bandGlaettFitX",      def: "position",    fileKey: "bandGlaettFitX",      group: "FRQ_glaettFitX" },
  { key: "bandGlaettGrad",      def: "1",           fileKey: "bandGlaettGrad",      group: "FRQ_glaettGrad" },
  { key: "bandGlaettAchse",     def: "ortsraum",    fileKey: "bandGlaettAchse",     group: "FRQ_glaettAchse" },
  { key: "bandGlaettSteife",    def: "3",          fileKey: "bandGlaettSteife",    group: "FRQ_glaettSteife" },
  { key: "bandGlaettRandfrei",  def: "0",          fileKey: "bandGlaettRandfrei",  group: "FRQ_glaettRandfrei" },
  { key: "bandGlaettK",         def: "0.88",        fileKey: "bandGlaettK",         group: "FRQ_glaettK" },
  { key: "bandGlaettLage",      def: "mitte",      fileKey: "bandGlaettLage",      group: "FRQ_glaettLage" },
  { key: "bandGlaettGrundlage", def: "residuum",   fileKey: "bandGlaettGrundlage", group: "FRQ_glaettGrundlage" },
  { key: "bandGlaettFormel",    def: "quadrat",    fileKey: "bandGlaettFormel",    group: "FRQ_glaettFormel" },
  { key: "bandGlaettBoden",     def: "5",          fileKey: "bandGlaettBoden",     group: "FRQ_glaettBoden" },
  { key: "bandGlaettAnker",     def: "gekoppelt",  fileKey: "bandGlaettAnker",     group: "FRQ_glaettAnker" },
];
// Cent-Distanz an der Frequenz hz in eine Distanz im Positionsraum toP
// umrechnen. Im log-Raum ist das ein konstanter Faktor; im Greenwood-Raum
// frequenzabhaengig -> darum lokal an hz gemessen (BA473). Verallgemeinerung
// von _frqDefaultMinBreiteP (feste 1000-Hz-Referenz).
function _frqCentZuRaum(toP, hz, cent) {
  return Math.abs(toP(hz * Math.pow(2, cent / 1200)) - toP(hz));
}
function _frqDefaultMinBreiteP(toP) {
  return _frqCentZuRaum(toP, 1000, FRQ_BAND_MINBREITE_CT);
}

// Gemeinsamer Kern von lueckig/ueberlappend (§13.4): symmetrische Baender
// um jede Position, halbe Breite aus min bzw. max der Nachbarabstaende.
// Randband: nur ein Nachbar -> min=max=D -> h=D/2 (kein Sonderfall).
function _bandSymmetrisch(P, pick) {
  var n = P.length;
  var out = [];
  for (var k = 0; k < n; k++) {
    var dL = (k > 0)     ? (P[k] - P[k - 1]) : null;
    var dR = (k < n - 1) ? (P[k + 1] - P[k]) : null;
    var d;
    if (dL != null && dR != null) d = pick(dL, dR);
    else                          d = (dL != null) ? dL : dR;   // Rand
    var h = d / 2;
    out.push({ loP: P[k] - h, hiP: P[k] + h });
  }
  return out;
}
// BA447: symmetrische Baender um P aus optimierten Kanten (lueckig/
// ueberlappend im Optimier-Fall, Sec. 14.5). Halbe Breite = halber
// kleinerer (lueckig) bzw. groesserer (ueberlappend) OPTIMIERTER
// Nachbarabstand. Randband: nur ein Nachbarabstand.
function _frqPairsAusEdgesSymmetrisch(P, edges, topologie) {
  var n = P.length, out = [];
  var pick = (topologie === "ueberlappend") ? Math.max : Math.min;
  for (var k = 0; k < n; k++) {
    var dL = (k > 0)     ? (P[k] - P[k - 1]) : null;
    var dR = (k < n - 1) ? (P[k + 1] - P[k]) : null;
    var d;
    if (dL != null && dR != null) d = pick(dL, dR);
    else                          d = (dL != null) ? dL : dR;
    var h = d / 2;
    out.push({ loP: P[k] - h, hiP: P[k] + h });
  }
  return out;
}

// ============================================================
// BA447 (Architektur Sec. 14): Bandgrenzen-OPTIMIERER.
// Reine Funktion in Positions-Koordinaten p (Rechenraum steckt in P,
// wie die Topologie-Registry Sec. 13.3). Sie sucht die N-1 inneren
// Grenzen s[], so dass der Ergebnis-Center jedes Bandes (Mittelpunkt
// seiner beiden Grenzen) moeglichst auf P[k] liegt -- RESIDUUMS-
// GEWICHTET (Sec. 14.3): Abweichung / R[k]. Plus ein PFLICHT-
// Regularisierungsterm lambda (Sec. 14.3): ohne ihn ist "Center
// treffen" unterbestimmt -> alternierende/negative Baender.
//
//   Kosten = Sum_k w_k (center_k - P[k])^2  +  lambda Sum_j (s_j - mid_j)^2
//   w_k = 1/R[k]^2 ,  mid_j = (P[j]+P[j+1])/2 ,  center_k=(edge_k+edge_{k+1})/2
//   edges: edge_0 = 2 P[0] - s_0 (Rand gespiegelt) ; edge_k = s_{k-1} ;
//          edge_N = 2 P[N-1] - s_{N-2} (Rand gespiegelt)  -- SOFERN keine
//          Range gesetzt ist; mit Range ersetzen die Range-Kanten die
//          gespiegelten Randkanten (Sec. 14.5, s.u.).
//
// ziel:
//   "summe":   ein Loesungsdurchlauf des gewichteten linearen Systems
//              (Normalgleichungen, exakt via Gauss). Sec. 14.3a.
//   "minimax": IRLS um DENSELBEN Loeser (feste Iterationszahl fuer
//              Determinismus, Sec. 14.3a) -- Gewichte der schlimmsten
//              Baender werden hochgezogen.
//
// Nebenbedingung Mindestbreite (Sec. 14.3b): nach dem Loesen werden
// Grenzen, die ein Band unter minBreite druecken oder die Monotonie
// verletzen, per Projektion auseinandergezogen (deterministisch).
//
// Eingang:
//   P        [p_0<...<p_{N-1}]  Positionen der gehoerten Frequenzen (N>=2)
//   R        [r_0..r_{N-1}]     Residuum je El. in p-Einheiten (>0)
//   range    { loP, hiP } | null   feste Aussenkanten der Randbaender
//                                   (Sec. 14.5). null -> Rand spiegeln.
//   ziel     "summe" | "minimax"
//   minBreite  Zahl (p-Einheiten) Mindest-Bandbreite
//   lambda   Zahl                 Regularisierungsgewicht
// Rueckgabe: s[]  (Laenge N-1, die inneren Grenzen, streng steigend).
// BA449: range ist ab jetzt IMMER null (Sec. 14.5-Korrektur -- eine feste
// Hersteller-Range ueberbestimmte das System). Der range-Zweig bleibt
// vorerst als toter Code stehen (Aufraeum-Kandidat, nicht in diesem Fix).
function FRQ_optimiereGrenzen(P, R, range, ziel, minBreite, lambda, Rup, Rdown) {
  var N = P.length;
  var w = R.map(function (r) { return 1 / (r * r); });

  // center_k als Linearkombination der inneren Grenzen s[0..N-2]:
  //   center_k = a_k . s + b_k
  // Rand: edge_0 = range ? range.loP : 2 P[0] - s_0
  //       edge_N = range ? range.hiP : 2 P[N-1] - s_{N-2}
  // Wir bauen fuer jedes k Koeffizientenvektor a_k (Laenge N-1) + Skalar b_k.
  function centerCoeff(k) {
    var a = new Array(N - 1).fill(0), b = 0;
    // Beitrag einer Kante mit Faktor f (hier immer 0.5) zu (a,b):
    function addEdge(idx, f) {
      if (idx === 0) {
        if (range) { b += f * range.loP; }
        else { a[0] += -f; b += f * 2 * P[0]; }
      } else if (idx === N) {
        if (range) { b += f * range.hiP; }
        else { a[N - 2] += -f; b += f * 2 * P[N - 1]; }
      } else {
        a[idx - 1] += f;   // innere Kante = s_{idx-1}
      }
    }
    addEdge(k, 0.5); addEdge(k + 1, 0.5);
    return { a: a, b: b };
  }

  // Loest EIN gewichtetes System (Gewichte wv) -> s[].
  function solveWeighted(wv) {
    var n = N - 1;
    var M = [], rhs = [];
    for (var i = 0; i < n; i++) { M.push(new Array(n).fill(0)); rhs.push(0); }
    // Datenterm: Sum_k wv_k (a_k.s + b_k - P[k])^2
    for (var k = 0; k < N; k++) {
      var cc = centerCoeff(k), d0 = cc.b - P[k];
      for (var i2 = 0; i2 < n; i2++) {
        rhs[i2] += -2 * wv[k] * cc.a[i2] * d0;
        for (var j2 = 0; j2 < n; j2++) M[i2][j2] += 2 * wv[k] * cc.a[i2] * cc.a[j2];
      }
    }
    // Regularisierung: lambda Sum_j (s_j - mid_j)^2
    for (var kk = 0; kk < n; kk++) {
      var mid = (P[kk] + P[kk + 1]) / 2;
      M[kk][kk] += 2 * lambda;
      rhs[kk] += 2 * lambda * mid;
    }
    return _frqGauss(M, rhs);
  }

  // BA516: Zielfunktionswert eines Kandidaten s (fuer "bester Stand" im
  // gerichteten summe-Solver). w_k = gewaehltes Gewicht je Elektrode.
  function _kosten(s, wUse) {
    var e = _frqEdges(P, s, range);
    var c = 0;
    for (var k = 0; k < N; k++) {
      var cen = (e[k] + e[k + 1]) / 2;
      c += wUse[k] * (cen - P[k]) * (cen - P[k]);
    }
    for (var j = 0; j < N - 1; j++) {
      var mid = (P[j] + P[j + 1]) / 2;
      c += lambda * (s[j] - mid) * (s[j] - mid);
    }
    return c;
  }

  var wv = w.slice();
  var s = solveWeighted(wv);

  if (ziel === "minimax") {
    // IRLS: feste Iterationszahl (Determinismus, Sec. 14.3a). Gewichte der
    // schlimmsten (residuumsnormiert) Baender hochziehen.
    var ITER = 40;
    for (var pass = 0; pass < ITER; pass++) {
      var e = _frqEdges(P, s, range);
      var dn = [];
      for (var k2 = 0; k2 < N; k2++) {
        var cen = (e[k2] + e[k2 + 1]) / 2;
        var diff = cen - P[k2];
        // BA515: richtungsabhaengig -> obere Kante bei Abweichung nach oben,
        // untere nach unten. Ohne Rup/Rdown (symmetrisch) wie bisher R[k2].
        var rk = (Rup && Rdown) ? (diff >= 0 ? Rup[k2] : Rdown[k2]) : R[k2];
        dn.push(Math.abs(diff) / rk);
      }
      var mx = Math.max.apply(null, dn) || 1;
      for (var k3 = 0; k3 < N; k3++) {
        wv[k3] *= Math.pow(dn[k3] / mx + 1e-6, 2);
      }
      // normieren (Zahlenstabilitaet)
      var mean = wv.reduce(function (x, y) { return x + y; }, 0) / N;
      for (var k4 = 0; k4 < N; k4++) wv[k4] /= mean;
      s = solveWeighted(wv);
    }
  } else if (Rup && Rdown) {
    // BA516: summe + gerichtet. Iterativer Vorzeichen-Solver: Gewicht je
    // Elektrode aus der Kante in Richtung der aktuellen Center-Abweichung.
    // Feste Iterationszahl (Determinismus); "bester Stand" gegen den selten
    // moeglichen Pendelfall (eine Grenze exakt auf P[k]).
    var ITERB = 20;
    // Gewicht aus Vorzeichen der Center-Abweichung von s.
    function _wGerichtet(sCur) {
      var e = _frqEdges(P, sCur, range);
      var wg = [];
      for (var k = 0; k < N; k++) {
        var cen = (e[k] + e[k + 1]) / 2;
        var rk = (cen - P[k] >= 0) ? Rup[k] : Rdown[k];
        wg.push(1 / (rk * rk));
      }
      return wg;
    }
    var bestS = s.slice();
    var bestW = _wGerichtet(s);
    var bestC = _kosten(bestS, bestW);
    for (var passB = 0; passB < ITERB; passB++) {
      var wg = _wGerichtet(s);
      s = solveWeighted(wg);
      var cC = _kosten(s, wg);
      // "bester Stand": kleinster Zielfunktionswert (mit dem je konsistenten
      // Gewicht bewertet). Verhindert, dass ein Pendel-Endstand gewinnt.
      if (cC < bestC) { bestC = cC; bestS = s.slice(); }
    }
    s = bestS;
  }

  // Nebenbedingung Mindestbreite + strikte Monotonie (Sec. 14.3b),
  // deterministisch: einmal vorwaerts, einmal rueckwaerts projizieren.
  s = _frqProjMinBreite(P, s, range, minBreite);
  return s;
}

// Kanten aus inneren Grenzen (mit optionaler Range fuer die Raender).
function _frqEdges(P, s, range) {
  var N = P.length;
  var e0 = range ? range.loP : (2 * P[0] - s[0]);
  var eN = range ? range.hiP : (2 * P[N - 1] - s[N - 2]);
  return [e0].concat(s, [eN]);
}

// Projektion auf Mindestbreite + Monotonie. Zwei Durchlaeufe
// (vorwaerts schiebt untere Grenzen hoch, rueckwaerts obere runter),
// deterministisch. minBreite in p-Einheiten.
function _frqProjMinBreite(P, s, range, minBreite) {
  var N = P.length;
  var e = _frqEdges(P, s, range);           // Laenge N+1
  // Vorwaerts: jede Kante mind. minBreite ueber der vorigen.
  for (var k = 1; k < e.length; k++) {
    if (e[k] < e[k - 1] + minBreite) e[k] = e[k - 1] + minBreite;
  }
  // Rueckwaerts: falls das die letzte Randkante verschoben hat und eine
  // Range fest ist, nicht ueber die Range-Oberkante hinaus -- ziehe von
  // oben nach: jede Kante mind. minBreite unter der naechsten, aber die
  // Range-Randkanten bleiben fix.
  var loFix = !!range, hiFix = !!range;
  if (hiFix) e[e.length - 1] = range.hiP;
  for (var m = e.length - 2; m >= 0; m--) {
    if (e[m] > e[m + 1] - minBreite) e[m] = e[m + 1] - minBreite;
  }
  if (loFix) e[0] = range.loP;
  // innere Grenzen zurueckgeben
  return e.slice(1, N);
}

// Kleiner Gauss-Loeser (Teilpivotisierung). M: n x n, rhs: n. -> x[n].
// Projektweiter Klein-Helfer -> core.js (laedt frueh). Kein Duplikat
// vorhanden (grep "function _frqGauss" bleibt leer vor dieser BA).
function _frqGauss(M, rhs) {
  var n = rhs.length;
  var A = M.map(function (row, i) { return row.concat([rhs[i]]); });
  for (var c = 0; c < n; c++) {
    var piv = c;
    for (var r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    var tmp = A[c]; A[c] = A[piv]; A[piv] = tmp;
    for (var r2 = 0; r2 < n; r2++) {
      if (r2 !== c) {
        var f = A[r2][c] / A[c][c];
        for (var cc = c; cc <= n; cc++) A[r2][cc] -= f * A[c][cc];
      }
    }
  }
  return A.map(function (row, i) { return row[n] / row[i]; });
}

// Frequenzband-Berechnung (Architektur Sec. 9 + Sec. 11). Gemeinsamer
// Rahmen: bildet die aktive Kette, prueft strenge Monotonie, behandelt
// den Einzel-Elektrode-Fall -- DANN ruft er das gewaehlte Verfahren
// (FRQ_bandVerfahren[verfahren]) fuer Grenzen + Center und die gewaehlte
// Topologie (FRQ_bandTopologie[topologie]) fuer die Grenzsetzung.
// EINZIGER Aufrufer ist FRQ_werte (Sec. 9.4); kein Konsument ruft dies
// direkt.
//
// Eingang: mitten = Array je Elektrode in Elektroden-Reihenfolge,
//   { elIdx, hz, aktiv }. hz = Bandmitte (gehoert|nominell, vom Aufrufer
//   bestimmt). aktiv=false NUR bei elActive===false.
//   verfahren = "geometrisch" | "cbf" | "abf"
//     (Default "geometrisch").
//   topologie = "nahtlos" | "lueckig" | "ueberlappend"
//     (Default "nahtlos").
// Rueckgabe:
//   { bands: [ { elIdx, loHz, hiHz, centerHz }, ... ] }  (nur aktive)
//   | { error: "overlap", elektroden: [...] }  bei Ueberholung.
//   | { error: "unknownVerfahren" | "unknownTopologie", ... }  bei Fehler.

// BA450 (Architektur 00-abf-verfahren-architektur.md §3): ABF-Verfahren,
// MED-EL Anatomy-Based Fitting nachgebildet. Zonen-Schwellen auf die
// GEHOERTE Frequenz (nicht Place-Frequenz), Patent §0061 Beispielwerte.
// Kalibrierbar (benannte Konstanten, kein UI).
var ABF_SCHWELLE_LO = 950;    // unter -> apikale Zone
var ABF_SCHWELLE_HI = 3000;   // ueber -> basale Zone
// Apikaler Start-Bezugswert (Patent §0074 "fixed value at 250 Hz"). Fest,
// NICHT aus den Messdaten abgeleitet. Von hier aus werden die apikalen
// Baender log-verteilt und per Fehler-Ausgleich zur unteren Wand gezogen.
var ABF_APIKAL_START_HZ = 250;

// BA464 (CBF-Zielfunktion v2, Besprechung 2026-07-08). Startwerte
// EXPERIMENTELL (spaeter Slider). Benannte Konstanten, kein UI ausser
// den Achsen-Stufen (Sprachbereich-Achse: BA465).
var CBF_LAMBDA = { treffer: 0.03, ausgewogen: 0.1, breite: 0.5 };  // Gewichtung-Achse:
                              // Gewicht der Breiten-GLATTHEIT (Nachbar-Spruenge).
                              // BA466: klein -- Treffer ist Ziel 1, Glattheit
                              // wirkt v.a. im Gratis-Spielraum der Toleranzen.
// BA472: apikale/basale "Freie Baender"-Achsen ersetzen die symmetrische
// Randverhalten-Rampe. CBF_RANDAUSLAUF entfaellt. CBF_RAND_STAERKE bleibt
// als gemeinsamer, fester Treffer-Faktor der freien El. (>0, klein).
var CBF_RAND_STAERKE = 0.1;   // Treffer-Gewicht der FREIEN El. (apikal+basal),
                              // flache Stufe statt Rampe (BA472).
var CBF_FREI_MAX = 4;         // Obergrenze der Achsen "Freie Baender" (0..4).
var CBF_SPRACHE_FAKTOR = { ohne: 1, mittel: 2, stark: 4 };  // Sprachbereich-Achse
                              // (UI: BA465): Treffer-Faktor im tonotopen Bereich
var CBF_RESID_BODEN_CT = 20;       // Mindest-Toleranz jeder Messung (cent)
var CBF_RESID_UNGEMESSEN_CT = 1200; // weiches Ziel ungemessener El. (cent)
var CBF_FEHLER_SKALA_CT = 100; // BA466: EINHEITLICHE Fehler-Einheit fuer
                               // Toleranz-Ueberschreitungen (cent) -- gleich
                               // teuer fuer alle El., das Residuum wirkt nur
                               // noch als Toleranz (Deadband), nicht als Skala
// CBF_MIN_BREITE_CT entfernt (BA527): Wert kommt jetzt aus der gemeinsamen Mindestbreiten-Achse.
var CBF_ZENTRIERUNG = 0.02;    // schwacher Zug zur exakten Mitte INNERHALB der
                               // Toleranz (haelt Ergebnis bei freiem Spielraum
                               // an der gehoerten Frequenz; Skala: FEHLER_SKALA)
var CBF_SWEEPS = 120;          // max. Loeser-Durchlaeufe (Abbruch bei Konvergenz)
var CBF_TERN = 48;             // ternaere Suchschritte je Kante

// BA450: n+1 logarithmisch gleichverteilte Kanten zwischen a und b
// (n Segmente). a,b > 0. Kern der ABF-Randzonen (Patent §0071/§0076).
function _logspaceEdges(a, b, n) {
  var out = [], la = Math.log(a), lb = Math.log(b);
  for (var k = 0; k <= n; k++) out.push(Math.exp(la + (lb - la) * k / n));
  return out;
}

// BA450 (Architektur §3.2 / §4.2): TONOTOPE Zone. Innere Grenzen =
// geometrische Mitte benachbarter gehoerter Frequenzen (Patent §0063,
// 1st rule). freqs aufsteigend, laenge M>=1. Rueckgabe: nur innere
// Grenzen (laenge M-1); End-Kanten setzt der Zusammensetzer.
function _abfTonotop(freqs) {
  var inner = [];
  for (var i = 0; i < freqs.length - 1; i++) inner.push(geomMitte(freqs[i], freqs[i + 1]));
  return inner;
}

// BA450 (Architektur §3.4 apikal): APIKALE Zone. Log-Verteilung zwischen
// ABF_APIKAL_START_HZ und der tonotopen Unterkante, optional per linearem
// Fehler-Ausgleich zur festen unteren Wand gezogen (Patent §0074-0076).
//   freqs         gehoerte Frequenzen der apikalen El. (aufsteigend), M>=1
//   wandLo        feste untere Wand (z.B. 70)
//   tonoUnterkante untere Grenze der ersten tonotopen El. (geteilte Kante)
//   mitAusgleich  true = Fehler-Ausgleich (§0076); false = reine Logspace
// Rueckgabe: M+1 Kanten [aeussersteKante ... tonoUnterkante].
function _abfApikal(freqs, wandLo, tonoUnterkante, mitAusgleich) {
  var M = freqs.length;
  if (!mitAusgleich) {
    return _logspaceEdges(wandLo, tonoUnterkante, M);
  }
  var edges = _logspaceEdges(ABF_APIKAL_START_HZ, tonoUnterkante, M);
  var E = ABF_APIKAL_START_HZ - wandLo;
  var out = [];
  for (var k = 0; k <= M; k++) {
    out.push(edges[k] - E * (M - k) / M);
  }
  return out;
}

// BA450 (Architektur §3.4 basal): BASALE Zone. Reine Log-Verteilung
// zwischen der tonotopen Oberkante und der festen oberen Wand (Patent
// §0071, 3rd rule). Kein Fehler-Ausgleich (tonotope Oberkante IST der
// Logspace-Start).
//   freqs         gehoerte Frequenzen der basalen El. (aufsteigend), M>=1
//   wandHi        feste obere Wand (z.B. 8500)
//   tonoOberkante obere Grenze der letzten tonotopen El. (geteilte Kante)
// Rueckgabe: M+1 Kanten [tonoOberkante ... wandHi].
function _abfBasal(freqs, wandHi, tonoOberkante) {
  return _logspaceEdges(tonoOberkante, wandHi, freqs.length);
}

// BA450 (Architektur §4.2): ABF-Grenzsetzung. EINZIGER Aufrufer ist
// FRQ_baender (ueber die verfahren==="abf"-Weiche). Reine Funktion, kein
// globaler Zustand, kein DOM.
//   kette         Array aktiver El. in Elektroden-Reihenfolge, je { elIdx, hz }
//                 (hz = gehoerte Mitte; aufsteigend, vom Rahmen geprueft)
//   wand          { loHz, hiHz } feste Herstellerwaende (Architektur §4.5)
//   mitAusgleich  bool (Randausgleich-Achse, BA451; hier durchgereicht)
// Rueckgabe:
//   { edges: [k0..kN] }   N+1 Bandkanten in Elektroden-Reihenfolge
//   | { error: "abfTonoZuKlein" }   tonotope Zone < 2 (Architektur §3.6)
function FRQ_abfGrenzen(kette, wand, mitAusgleich) {
  var N = kette.length;
  var freqs = kette.map(function (m) { return m.hz; });

  // Zonen-Einteilung (§3.1): aeusserste IMMER Rand, dann Schwelle.
  var apEnd = 0;
  for (var i = 1; i < N - 1; i++) {
    if (freqs[i] < ABF_SCHWELLE_LO) apEnd = i; else break;
  }
  var baStart = N - 1;
  for (var j = N - 2; j > apEnd; j--) {
    if (freqs[j] > ABF_SCHWELLE_HI) baStart = j; else break;
  }
  var apFreqs = freqs.slice(0, apEnd + 1);
  var toFreqs = freqs.slice(apEnd + 1, baStart);
  var baFreqs = freqs.slice(baStart);

  // Verwendbarkeit (§3.6): tonotope Zone braucht >= 2.
  if (toFreqs.length < 2) return { error: "abfTonoZuKlein" };

  // Geteilte Uebergangs-Kanten (nahtlos, geom. Mitte ueber Zonengrenze).
  var tonoUnterkante = geomMitte(apFreqs[apFreqs.length - 1], toFreqs[0]);
  var tonoOberkante  = geomMitte(toFreqs[toFreqs.length - 1], baFreqs[0]);

  var apEdges = _abfApikal(apFreqs, wand.loHz, tonoUnterkante, mitAusgleich);
  var toInner = _abfTonotop(toFreqs);
  var baEdges = _abfBasal(baFreqs, wand.hiHz, tonoOberkante);

  // Zusammensetzen zu N+1 Kanten in Elektroden-Reihenfolge.
  // apEdges (inkl. tonoUnterkante) + toInner + tonoOberkante + baEdges ohne erste.
  var edges = apEdges.concat(toInner, [tonoOberkante], baEdges.slice(1));
  return { edges: edges };
}

// BA464 (ersetzt BA454): CBF-Grenzsetzung v2. EINZIGER Aufrufer ist
// FRQ_baender (verfahren==="cbf"-Weiche). Reine Funktion, kein globaler
// Zustand, kein DOM. Gewichtete Optimierung ueber die Bandkanten in
// log-Frequenz:
//   Treffer:  ZIEL 1 (BA466). Abweichung der Bandmitte vom Ziel ist
//             INNERHALB der Mess-Toleranz (Residuum, Boden
//             CBF_RESID_BODEN_CT) frei; darueber quadratische Kosten in
//             EINHEITLICHER cent-Skala (CBF_FEHLER_SKALA_CT -- gleich
//             teuer fuer alle El.). Dazu ein schwacher Zentrier-Zug
//             (CBF_ZENTRIERUNG) zur exakten Mitte.
//   Breite:   ZIEL 2 -- nur Extreme vermeiden: harte Mindestbreite als
//             Schranke + SCHWACHE Glattheit (Spruenge zwischen Nachbar-
//             Breiten, Gefaelle erlaubt); stumme El. mit eigenem
//             kleinen Breiten-Ziel, von Treffer/Glattheit ausgenommen.
//   Frei:     BA472. Die untersten kApikal und obersten kBasal El.
//             bekommen ein festes kleines Treffer-Gewicht
//             (CBF_RAND_STAERKE) -- flache Stufe. Apikal: FS-Rate traegt
//             die Tonhoehe, nicht der Ort (Konzept_CBF §7). Basal: Rand
//             faengt den Wandstoss ab.
//   Sprache:  Treffer-Faktor im tonotopen Bereich (ABF_SCHWELLE_LO/HI).
// Konvex (Summe konvexer Terme, lineare Schranken) -> eindeutiges
// Minimum; Loeser: koordinatenweise ternaere Suche (Architektur §3.5:
// Loeser frei).
//   kette  Array aktiver El. in Reihenfolge, je { elIdx, hz,
//          statusGewicht, residuum, gemessen } (hz aufsteigend, vom
//          Rahmen geprueft; Felder aus FRQ_werte, BA453)
//   wand   { loHz, hiHz } gewaehlte Wand (BA462, seitengebunden)
//   opt    { cbfGewicht, cbfApikalFrei, cbfBasalFrei, randverhalten,
//            cbfSprache } (Achsen; mit Defaults abgesichert.
//            cbfApikalFrei/cbfBasalFrei 0..4, Default 1; UI: BA472)
// Rueckgabe: { edges: [k0..kN] } N+1 Bandkanten (Hz) in El.-Reihenfolge.
function FRQ_cbfGrenzen(kette, wand, opt) {
  opt = opt || {};
  var N = kette.length;
  // BA524: Raum aus der gemeinsamen Lage-Achse (opt.lage/opt.k), NICHT mehr
  // aus cbfBandraum. "geometrisch" -> log; aussen/mitte/innen -> Greenwood-
  // Ortsraum mit w. Ein Raum-Mechanismus fuer alle Verfahren (_frqBandRaum).
  var _raum  = _frqBandRaum(
    (typeof opt.lage === "string") ? opt.lage : "geometrisch",
    (typeof opt.k === "number") ? opt.k : 0.88);
  var toP    = _raum.toP;
  var fromP  = _raum.fromP;
  var ln = toP, ex = fromP;   // ln/ex bleiben als lokale Kurznamen (s.u.)
  var CT = Math.LN2 / 1200;   // 1 cent in LOG-Einheiten -- nach BA473 nur
                              // noch fuer SKA (globaler Kosten-Massstab an
                              // fester 1000-Hz-Ref, raumunabhaengig gewollt).

  // 1. Log-Raum: Ziele t[i], Wand-Schranken.
  var t = kette.map(function (m) { return ln(m.hz); });
  var wLo = ln(wand.loHz), wHi = ln(wand.hiHz);

  // 2. Achsen-Parameter (Defaults, falls opt-Felder fehlen).
  var lam = CBF_LAMBDA[opt.cbfGewicht] != null ? CBF_LAMBDA[opt.cbfGewicht]
          : CBF_LAMBDA.ausgewogen;
  // BA472: Anzahl freier El. je Seite (0..CBF_FREI_MAX). Robust gegen
  // Strings ("2") und fehlende Felder; Default 1 je Seite.
  function _freiN(v) {
    var n = parseInt(v, 10);
    if (!(n >= 0)) n = 1;
    if (n > CBF_FREI_MAX) n = CBF_FREI_MAX;
    return n;
  }
  var kApikal = _freiN(opt.cbfApikalFrei != null ? opt.cbfApikalFrei : 1);
  var kBasal  = _freiN(opt.cbfBasalFrei  != null ? opt.cbfBasalFrei  : 1);
  // BA526: gemeinsame Randverhalten-Achse.
  //   treffen     -> aeussere Kanten fest auf die Wand.
  //   luecke      -> aeussere Kanten frei, Wand als Schranke.
  //   abschneiden -> aeussere Kanten frei OHNE Wandschranke, danach klemmen.
  var _rand = (typeof opt.randverhalten === "string") ? opt.randverhalten : "treffen";
  var sprF = CBF_SPRACHE_FAKTOR[opt.cbfSprache] != null
          ? CBF_SPRACHE_FAKTOR[opt.cbfSprache] : CBF_SPRACHE_FAKTOR.mittel;

  // 3. Referenz-Breite (Normierung der Breiten-Terme): Zielspanne / N.
  var bref = (t[N - 1] - t[0]) / N;
  if (!(bref > 0)) bref = (wHi - wLo) / N;   // Absicherung (alle gleich)

  // 4. Freie Baender (BA472): die untersten kApikal und obersten kBasal El.
  //    bekommen ein festes, kleines Treffer-Gewicht (CBF_RAND_STAERKE) --
  //    FLACHE Stufe (alle k gleich frei), dahinter volles Gewicht 1.
  //    Zwei EINSEITIGE Achsen (kein symmetrisches Math.min mehr).
  //    Apikal = tiefe El. (kleiner Index), basal = hohe El. (grosser Index).
  //    Ueberlappung bei kurzer Kette: min() nimmt das kleinere Gewicht.
  function randFaktor(i) {
    var f = 1;
    if (i < kApikal)         f = Math.min(f, CBF_RAND_STAERKE);   // apikaler Rand
    if (i >= N - kBasal)     f = Math.min(f, CBF_RAND_STAERKE);   // basaler Rand
    return f;
  }

  // 5. Gewichte + Toleranzen je Elektrode.
  //    w = statusGewicht * randFaktor * sprachFaktor (Treffer-Gewicht).
  //    dead = Toleranz UND Fehler-Einheit (log): gemessen ->
  //    max(residuum, Boden); ungemessen -> sehr weich.
  var w = [], stumm = [], deadUp = [], deadDn = [];
  for (var i = 0; i < N; i++) {
    var gStat = (kette[i].statusGewicht != null) ? kette[i].statusGewicht : 1;
    stumm[i] = (gStat <= 0);
    // Richtungsabhaengige Toleranz -- IMMER getrennte cent-Werte fuer oben/
    // unten aus residUp/residDown (die Messunsicherheit ist real richtungs-
    // abhaengig; ein symmetrisches Zusammenfassen waere ein Fehler, keine
    // Option). Fallback nur bei fehlenden Einzelkanten: halbe Residuum-Summe.
    var rUpCt, rDnCt;
    if (kette[i].gemessen) {
      if (kette[i].residUp != null && kette[i].residDown != null) {
        rUpCt = Math.max(kette[i].residUp,   CBF_RESID_BODEN_CT);
        rDnCt = Math.max(kette[i].residDown, CBF_RESID_BODEN_CT);
      } else {
        var _r = Math.max((kette[i].residuum != null ? kette[i].residuum / 2 : 0), CBF_RESID_BODEN_CT);
        rUpCt = _r; rDnCt = _r;
      }
    } else {
      rUpCt = CBF_RESID_UNGEMESSEN_CT; rDnCt = CBF_RESID_UNGEMESSEN_CT;
    }
    // Zwei Toleranz-Huellen (in den Raum, cent-treu an der El.-Frequenz).
    deadUp[i] = _frqCentZuRaum(toP, kette[i].hz, rUpCt);
    deadDn[i] = _frqCentZuRaum(toP, kette[i].hz, rDnCt);
    var spr = (kette[i].hz >= ABF_SCHWELLE_LO && kette[i].hz <= ABF_SCHWELLE_HI)
      ? sprF : 1;
    w[i] = gStat * randFaktor(i) * spr;
  }

  // 6. Mindestbreiten (Schranken): aus der gemeinsamen cent-Achse (opt.minBreiteCt),
  //    lokal an der El.-Frequenz in den Raum. Fallback 100 (Achsen-Default).
  //    BA528: stumme El. folgen der Mindestbreite wie normale (kein Sonderwert 0).
  var _minBreiteCt = (opt.minBreiteCt != null) ? opt.minBreiteCt : 100;
  var bMin = [], sumMin = 0;
  for (i = 0; i < N; i++) {
    bMin[i] = _frqCentZuRaum(toP, kette[i].hz, _minBreiteCt);
    sumMin += bMin[i];
  }
  if (sumMin > (wHi - wLo) * 0.9) {
    var f2 = (wHi - wLo) * 0.9 / sumMin;
    for (i = 0; i < N; i++) bMin[i] *= f2;
  }
  // 7. Zielfunktion (konvex).
  function kosten(x) {
    var s = 0, j;
    // Treffer: Toleranz-Huelle + Zentrier-Zug, beides in der EINHEIT-
    // LICHEN Fehler-Skala (BA466) -- das Residuum ist nur noch Toleranz.
    // BA473: SKA ist der EINHEITLICHE Kosten-Massstab (BA466: gleich teuer
    // fuer alle El.). Darum NICHT lokal, sondern an fester 1000-Hz-Ref in
    // den Raum -- so bleibt er zwischen log/anatom vergleichbar und fuer
    // alle El. identisch.
    var SKA = _frqCentZuRaum(toP, 1000, CBF_FEHLER_SKALA_CT);
    for (j = 0; j < N; j++) {
      var m = (x[j] + x[j + 1]) / 2;
      var diff = m - t[j];
      // BA528: Huelle richtungsabhaengig -- Center ueber Ziel -> deadUp,
      // darunter -> deadDn.
      var dead_j = (diff >= 0) ? deadUp[j] : deadDn[j];
      var d = Math.abs(diff) - dead_j;
      if (d > 0) { d /= SKA; s += w[j] * d * d; }
      var z = diff / SKA;
      s += CBF_ZENTRIERUNG * w[j] * z * z;
    }
    // BA528: stumme El. in die Breiten-Glattheit EINBEZIEHEN (kein continue
    // mehr) -- ihre Breite koppelt so an die Nachbarn und bleibt bestimmt,
    // ohne eigenes Breiten-Ziel.
    for (j = 0; j < N - 1; j++) {
      var g = ((x[j + 1] - x[j]) - (x[j + 2] - x[j + 1])) / bref;
      s += lam * g * g;
    }
    return s;
  }

  // 8. Startlage: aeussere an die Waende, innere auf die Ziel-Mitten;
  //    dann Feasibility-Paesse (Monotonie + Mindestbreite).
  var eps = 1e-6;
  var x = [];
  x[0] = wLo; x[N] = wHi;
  for (var s0 = 1; s0 < N; s0++) x[s0] = (t[s0 - 1] + t[s0]) / 2;
  for (var f1 = 1; f1 <= N; f1++) {
    var lo1 = x[f1 - 1] + Math.max(bMin[f1 - 1], eps);
    if (x[f1] < lo1) x[f1] = lo1;
  }
  for (var f3 = N - 1; f3 >= 0; f3--) {
    var hi1 = x[f3 + 1] - Math.max(bMin[f3], eps);
    if (x[f3] > hi1) x[f3] = hi1;
  }
  if (x[0] < wLo) x[0] = wLo;

  // 9. Koordinatenweiser Loeser: ternaere Suche je Kante im zulaessigen
  //    Intervall (Monotonie + Mindestbreite als Intervallgrenzen).
  function tern(j, lo, hi) {
    if (!(hi > lo)) { x[j] = (lo + hi) / 2; return; }
    var a = lo, b = hi;
    for (var s2 = 0; s2 < CBF_TERN; s2++) {
      var m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
      x[j] = m1; var k1 = kosten(x);
      x[j] = m2; var k2 = kosten(x);
      if (k1 < k2) b = m2; else a = m1;
    }
    x[j] = (a + b) / 2;
  }
  for (var it = 0; it < CBF_SWEEPS; it++) {
    var maxDelta = 0, alt;
    for (var j = 1; j < N; j++) {
      alt = x[j];
      tern(j, x[j - 1] + Math.max(bMin[j - 1], eps),
              x[j + 1] - Math.max(bMin[j], eps));
      maxDelta = Math.max(maxDelta, Math.abs(x[j] - alt));
    }
    if (_rand === "treffen") {
      x[0] = wLo; x[N] = wHi;   // aeussere fest an die Waende (= altes "voll")
    } else {
      // luecke:      Wand als Schranke (nicht ueberschreiten).
      // abschneiden: aeussere Kante frei OHNE Wandschranke -> darf hinaus,
      //              wird danach (Schritt 10) auf die Wand geklemmt.
      var _weitLo = wLo - Math.abs(wHi - wLo);   // eine Bandbreite unter der Wand
      var _weitHi = wHi + Math.abs(wHi - wLo);
      // "frei" nutzt denselben weiten Suchraum wie "abschneiden"
      // (keine Wandschranke); Schritt 10 klemmt bei "frei" NICHT.
      var _freiOderAbschn = (_rand === "abschneiden" || _rand === "frei");
      var _loBound = _freiOderAbschn ? _weitLo : wLo;
      var _hiBound = _freiOderAbschn ? _weitHi : wHi;
      alt = x[0];
      tern(0, _loBound, x[1] - Math.max(bMin[0], eps));
      maxDelta = Math.max(maxDelta, Math.abs(x[0] - alt));
      alt = x[N];
      tern(N, x[N - 1] + Math.max(bMin[N - 1], eps), _hiBound);
      maxDelta = Math.max(maxDelta, Math.abs(x[N] - alt));
    }
    if (maxDelta < 1e-7) break;
  }

  // 10. Zurueck in Hz. Bei "abschneiden": aeusserste Kanten auf die Wand
  // klemmen (Variante 1 -- Band ueber die Wand hinaus wird gekappt).
  var edges = x.map(function (xi) { return ex(xi); });
  if (_rand === "abschneiden") {
    if (edges[0] < wand.loHz) edges[0] = wand.loHz;
    if (edges[edges.length - 1] > wand.hiHz) edges[edges.length - 1] = wand.hiHz;
  }
  return { edges: edges };
}

// Bewertungsstufe einer Frequenz-Abweichung (cent) gegen ihr Residuum.
// Zentrale Quelle fuer Graph-Farbe UND Tabellen-Farbe -- vorher 3x
// dupliziert (Bandgraph-Row, Bandtabelle, chart.js farbeFuer).
// ueber = wieviel die Abweichung das Residuum ueberschreitet.
//   ueber <= 0            -> "gruen" (im Rauschen)
//   ueber <= Schwelle     -> "amber" (leicht)
//   sonst                 -> "rot"   (deutlich)
// BA510: richtungsabhaengiges Residuum-Band. devCent > 0 (Abweichung nach
// oben) -> obere Kante residUp; devCent < 0 -> untere Kante residDown.
// Aufrufer uebergeben beide Kanten; Rueckwaertskompatibel: wird nur ein
// Wert uebergeben (residDown === residUp), verhaelt es sich wie zuvor.
function FRQ_bewertungsStufe(devCent, residDown, residUp) {
  var kante = (devCent >= 0) ? residUp : residDown;
  var r = (kante != null && kante > 0) ? kante : 0;
  var ueber = Math.abs(devCent) - r;
  if (ueber <= 0) return "gruen";
  if (typeof FRQ_bandEmpfSchwelleCent === "number"
      && ueber <= FRQ_bandEmpfSchwelleCent) return "amber";
  return "rot";
}

// BA485: Gemeinsame Y-Skala aller Frequenzgraphen. Basis = groesster
// BETRAG der gemessenen gehoerten Verschiebung (shiftCent, "roh") ueber
// BEIDE Seiten, mal 1.5. Symmetrisch um 0, auf 50er gerundet, Boden 50.
// Argumentlos: holt die Werte selbst aus FRQ_werte("gehoert"). Ergebnis
// wird von allen vier Graphen-Aufrufern als cfg.yMaxFest uebergeben, so
// dass Kurven- und Seitenwechsel die Skala nicht mehr springen lassen.
function FRQ_yMaxCent() {
  // BA491: Achse 2. Speist Glaettungs-/Band-/Ausdruck-Graphen (folgen
  // FRQ_distribution); der reine Ergebnisgraph zieht seine Hoehe nicht mehr hier (Schritt 6).
  var modus = (typeof FRQ_distribution === "string") ? FRQ_distribution : "right";
  var werte = (typeof FRQ_werte === "function")
    ? FRQ_werte("gehoert", modus, false) : [];
  var maxAbs = 0;
  for (var i = 0; i < werte.length; i++) {
    var wr = werte[i];
    if (!wr || !wr.gemessen) continue;   // nur gemessene Rohdaten
    var seiten = [wr.left, wr.right];     // Maximum ueber beide Seiten
    for (var s = 0; s < seiten.length; s++) {
      var seite = seiten[s];
      if (!seite || seite.shiftCent == null) continue;
      var a = Math.abs(seite.shiftCent);
      if (a > maxAbs) maxAbs = a;
    }
  }
  // x1.5, auf 50er aufrunden, Untergrenze 400 (feste Orientierungs-Skala;
  // Default-/Bandgraph zeigen sonst nur die 0-Linie, da Ticks erst bei 100
  // beginnen -- chart.js:523).
  return Math.max(Math.ceil((maxAbs * 1.5) / 50) * 50, 400);
}

// Kette der aktiven, frequenz-tragenden Elektroden in Reihenfolge.
// EINE Filter-Wahrheit fuer FRQ_baender UND den Wahrnehmungskurven-Aufruf
// (Architektur §4.2.1). Verhaltensneutral aus FRQ_baender extrahiert.
function _frqKette(mitten) {
  var kette = [];
  for (var i = 0; i < mitten.length; i++) {
    if (mitten[i] && mitten[i].aktiv && mitten[i].hz != null) {
      kette.push(mitten[i]);
    }
  }
  return kette;
}

function FRQ_baender(mitten, verfahren, topologie, optimieren, ziel, range, wand, opt) {
  // BA450: ABF ist KEIN Registry-Verfahren (feste Hz-Waende sind keine
  // toP/fromP-Transformation, Architektur §2.2). Eigener Grenzsetzungs-
  // Zweig; verdraengt Topologie/optimieren/ziel (Architektur §4.1).
  // Die gemeinsame Invariante (Kette, Ueberlauf, Einzel-El.) laeuft
  // trotzdem -> ABF wird ERST NACH diesen Pruefungen gerufen (s.u.).
  var _istAbf = (verfahren === "abf");
  // BA454-Fix (0.5.455.1): CBF ist wie ABF KEIN Registry-Verfahren (eigener
  // Grenzsetzungs-Zweig, Architektur §2.2/§4.1). Ohne diese Ausnahme fiel
  // CBF in die unknownVerfahren-Sperre und erreichte seine Weiche nie.
  var _istCbf = (verfahren === "cbf");
  var _keinRegistry = _istAbf || _istCbf;
  // BA524: Der Rechenraum fuer geometrisch kommt aus der Lage-Achse
  // (opt.lage), NICHT mehr aus einem festen Registry-Eintrag.
  var _lage = (opt && typeof opt.lage === "string") ? opt.lage : "geometrisch";
  var _k    = (opt && typeof opt.k === "number") ? opt.k : 0.88;
  var vf;
  if (_keinRegistry) {
    vf = null;
  } else {
    // geometrisch -> Lage-Raum (aus der Lage-Achse, BA524).
    vf = _frqBandRaum(_lage, _k);
  }
  if (!_keinRegistry && (!vf || typeof vf.toP !== "function" || typeof vf.fromP !== "function"))
    return { error: "unknownVerfahren", verfahren: verfahren };
  var topo = _keinRegistry ? null : FRQ_bandTopologie[topologie || "nahtlos"];
  if (!_keinRegistry && typeof topo !== "function")
    return { error: "unknownTopologie", topologie: topologie };

  // Nur aktive Elektroden bilden die Kette (nicht aktive: Nachbarn
  // ruecken zusammen).
  var kette = _frqKette(mitten);
  if (kette.length === 0) return { bands: [] };

  // Ueberlauf-Pruefung: streng monoton steigende Mitten. Sammelt die
  // elIdx-Paare, die die Reihenfolge kippen (fuer die Anzeige).
  var overlapEls = [];
  for (var k = 1; k < kette.length; k++) {
    if (kette[k].hz <= kette[k - 1].hz) {
      overlapEls.push(kette[k - 1].elIdx, kette[k].elIdx);
    }
  }
  if (overlapEls.length > 0) {
    var uniq = overlapEls.filter(function (v, idx) { return overlapEls.indexOf(v) === idx; });
    uniq.sort(function (a, b) { return a - b; });
    return { error: "overlap", elektroden: uniq };
  }

  // Einzelne Elektrode: kein Nachbar zum Spiegeln -> kein Band definierbar.
  if (kette.length === 1) return { bands: [] };

  // --- Grenzsetzung: CBF (Architektur §4.1, verdraengt Topologie) ---
  if (verfahren === "cbf") {
    if (!wand) return { error: "cbfKeineWand" };   // nur MED-EL (feste Wand)
    var cbfRes = FRQ_cbfGrenzen(kette, wand, opt || {});
    if (cbfRes.error) return cbfRes;
    var _ce = cbfRes.edges;
    var cbands = [];
    for (var ce = 0; ce < kette.length; ce++) {
      var _clo = _ce[ce], _chi = _ce[ce + 1];
      cbands.push({ elIdx: kette[ce].elIdx, loHz: _clo, hiHz: _chi,
                    centerHz: geomMitte(_clo, _chi) });
    }
    return { bands: cbands };
  }

  // --- Grenzsetzung: ABF (Architektur §4.1, verdraengt Topologie) ODER
  //     Verfahren-Registry x Topologie x optimieren (bestehend). ---
  if (_istAbf) {
    var _mitAusgleich = !(opt && opt.mitAusgleich === false);
    var abfRes = FRQ_abfGrenzen(kette, wand, _mitAusgleich);
    if (abfRes.error) return abfRes;
    var _e = abfRes.edges;
    var bands = [];
    for (var ae = 0; ae < kette.length; ae++) {
      var _lo = _e[ae], _hi = _e[ae + 1];
      bands.push({ elIdx: kette[ae].elIdx, loHz: _lo, hiHz: _hi,
                   centerHz: geomMitte(_lo, _hi) });
    }
    return { bands: bands };
  }

  // --- Grenzsetzung ueber die Topologie-Registry (§13.3/§13.4).
  // Der Raum steckt in vf.toP/vf.fromP, die Topologie in topo. Beide
  // Achsen frei kombinierbar (3x3).
  var toP = vf.toP, fromP = vf.fromP;

  // Positionen der gehoerten Mitten im Rechenraum.
  var P = [];
  for (var p = 0; p < kette.length; p++) P.push(toP(kette[p].hz));

  // --- Grenzsetzung: klassisch (Topologie-Registry) ODER optimiert. ---
  // optimieren=true (nur Empfehlung, Sec. 14.6) rechnet die INNEREN
  // Grenzen ueber den Optimierer; die Topologie formt daraus dann die
  // Baender (nahtlos = Grenzen direkt; lueckig/ueberlappend =
  // symmetrisch um P, wie bisher). optimieren=false -> bit-genau wie
  // vor BA447.
  var pairs;
  if (optimieren && kette.length >= 2) {
    // Residuen in p-Einheiten. Ungemessene bekommen ein GROSSES Residuum
    // (weiches Ziel, Sec. 14.5); gemessene den Wert mit kleinem Boden.
    // mitten-Eintrag traegt residuum (cent) + gemessen (bool), s. Sec. 14.4.

    var _boden = (opt && opt.boden != null) ? opt.boden : RES_BODEN_CT;
    var Ropt = [];
    for (var ri = 0; ri < kette.length; ri++) {
      var mObj = kette[ri];
      var resCt = mObj.gemessen
        ? Math.max(_boden, (mObj.residuum != null ? mObj.residuum : _boden))
        : RES_UNGEMESSEN_CT;
      var hzUp = kette[ri].hz * Math.pow(2, resCt / 1200);
      var rp = Math.abs(toP(hzUp) - toP(kette[ri].hz));
      if (!(rp > 0)) rp = 1e-6;
      Ropt.push(rp);
    }
    // BA527: Mindestbreite aus der gemeinsamen cent-Achse, hier in den
    // aktuellen Raum umgerechnet (feste 1000-Hz-Referenz wie bisher
    // _frqDefaultMinBreiteP). opt.minBreite (p-Einheit) bleibt als expliziter
    // Override moeglich; sonst opt.minBreiteCt (cent) -> Raum; sonst Default.
    var _minBreite;
    if (opt && opt.minBreite != null) {
      _minBreite = opt.minBreite;
    } else if (opt && opt.minBreiteCt != null) {
      _minBreite = _frqCentZuRaum(toP, 1000, opt.minBreiteCt);
    } else {
      _minBreite = _frqDefaultMinBreiteP(toP);
    }
    var _lambda = (opt && opt.lambda != null) ? opt.lambda : FRQ_BAND_LAMBDA;
    // BA526: Randverhalten steuert die Aussenkanten.
    //   treffen     -> Wand als feste Range (Optimierer trifft sie exakt).
    //   abschneiden -> keine Range; Raender gespiegelt, danach im Rahmen
    //                  auf die Wand geklemmt (Variante 1).
    //   luecke      -> keine Range; Raender gespiegelt, danach NICHT ueber
    //                  die Wand hinaus (Variante 3, s. Klemm-Block unten).
    var _rand = (opt && typeof opt.randverhalten === "string") ? opt.randverhalten : "treffen";
    var _rangeOpt = null;
    if (_rand === "treffen"
        && wand && typeof wand.loHz === "number" && typeof wand.hiHz === "number") {
      _rangeOpt = { loP: toP(wand.loHz), hiP: toP(wand.hiHz) };
    }
    // Richtungsabhaengige R-Vektoren -- IMMER (die Messunsicherheit ist real
    // richtungsabhaengig; ein symmetrisches Zusammenfassen waere ein Fehler,
    // keine Option). Analog Ropt, aber je Kante. Ungemessene: Ungemessen-Wert.
    var RoptUp = [], RoptDown = [];
    for (var rj = 0; rj < kette.length; rj++) {
      var mo = kette[rj];
      var rUpCt = mo.gemessen
        ? Math.max(_boden, (mo.residUp   != null ? mo.residUp   : _boden))
        : RES_UNGEMESSEN_CT;
      var rDnCt = mo.gemessen
        ? Math.max(_boden, (mo.residDown != null ? mo.residDown : _boden))
        : RES_UNGEMESSEN_CT;
      RoptUp.push(Math.abs(toP(kette[rj].hz * Math.pow(2, rUpCt / 1200)) - toP(kette[rj].hz)) || 1e-6);
      RoptDown.push(Math.abs(toP(kette[rj].hz * Math.pow(2, rDnCt / 1200)) - toP(kette[rj].hz)) || 1e-6);
    }
    var sOpt = FRQ_optimiereGrenzen(P, Ropt, _rangeOpt,
      (ziel === "summe" ? "summe" : "minimax"), _minBreite, _lambda, RoptUp, RoptDown);
    var edgesOpt = _frqEdges(P, sOpt, _rangeOpt);
    if (topologie === "lueckig" || topologie === "ueberlappend") {
      // Center bleibt P; nur die inneren Grenzen sind jetzt optimiert.
      // Symmetrische Baender um P mit halber Breite aus den optimierten
      // Nachbarabstaenden (gleiche min/max-Regel wie Sec. 13.4, aber auf
      // den optimierten Grenzen).
      pairs = _frqPairsAusEdgesSymmetrisch(P, edgesOpt, topologie);
    } else {
      // nahtlos: Grenzen direkt.
      pairs = [];
      for (var pe = 0; pe < kette.length; pe++)
        pairs.push({ loP: edgesOpt[pe], hiP: edgesOpt[pe + 1] });
    }
  } else {
    // Klassisch (bit-genau wie vor BA447).
    pairs = topo(P);
  }

  // BA526: Bei "treffen" liegen die Kanten schon per Range auf der Wand
  // -> nicht klemmen. Bei "abschneiden" UND "luecke" gespiegelte Kanten,
  // danach klemmen: abschneiden kappt den Ueberstand auf die Wand, luecke
  // laesst innenliegende Kanten stehen (dieselbe if(lo<wand)-Logik deckt
  // beide ab). Ohne Wand: nichts tun.
  var _klemmen = wand && typeof wand.loHz === "number"
    && typeof wand.hiHz === "number"
    && !(_rand === "treffen")
    && !(_rand === "frei");
  var bands = [];
  for (var e = 0; e < kette.length; e++) {
    var loP = pairs[e].loP, hiP = pairs[e].hiP;
    var lo = fromP(loP), hi = fromP(hiP);
    if (_klemmen) {
      if (e === 0 && lo < wand.loHz) lo = wand.loHz;                 // Unterrand
      if (e === kette.length - 1 && hi > wand.hiHz) hi = wand.hiHz;  // Oberrand
    }
    // Bandmitte aus den (evtl. geklemmten) FINALEN Grenzen rechnen,
    // nicht aus den ungeklemmten loP/hiP. Sonst zeigt der Randband-Mitte
    // in Tabelle/Graph die Position VOR dem Abschneiden. Im Positions-Raum
    // des Verfahrens gemittelt (geometrisch/greenwood/cochlear), damit die
    // verfahrensgerechte Mitten-Definition erhalten bleibt.
    var centerHz = fromP((toP(lo) + toP(hi)) / 2);
    var band = { elIdx: kette[e].elIdx, loHz: lo, hiHz: hi,
                 centerHz: centerHz };
    // Verschiebungs-Vorschlag NUR fuer ungemessene El. (Sec. 14.5):
    // wo laege ihr Center (= Bandmitte des zugefallenen Slots).
    if (optimieren && kette[e].gemessen === false) {
      band.centerVorschlagHz = centerHz;
    }
    bands.push(band);
  }
  return { bands: bands };
}
// Log-Interpolation zwischen zwei Frequenzen, t in [0,1].
function logInterpHz(f1, f2, t) {
  if (!f1 || !f2 || f1 <= 0 || f2 <= 0) return f1 || f2 || CENT_REF_HZ;
  return Math.exp(Math.log(f1) + t * (Math.log(f2) - Math.log(f1)));
}
// Mittlere Cent-Distanz pro Elektroden-Schritt einer Frequenzliste.
// Für Migration alter Breite-Werte (Kanal-Anzahl → Cent) gebraucht.
function meanCentStepOfFreqs(freqArr) {
  if (!freqArr || freqArr.length < 2) return 600;
  let sum = 0, n = 0;
  for (let i = 0; i < freqArr.length - 1; i++) {
    if (freqArr[i] > 0 && freqArr[i + 1] > 0) {
      sum += Math.abs(1200 * Math.log2(freqArr[i + 1] / freqArr[i]));
      n++;
    }
  }
  return n > 0 ? sum / n : 600;
}
// ============================================================
// FREQUENZABGLEICH -- kanonisches cent + Seitenverteilung
// (Architektur: 00-freqmatch-ergebnisformat-architektur.md, 4.2)
// cent-Konvention (Wahrnehmung, eindeutig): +cent = rechtes Ohr nimmt tiefer
// wahr als linkes. VORSICHT: die Korrektur-Richtung folgt daraus nicht
// pauschal -- der Player-Warp HEBT das rechte Audio an (s. FRQ_seitenWerte),
// die CI-Umprogrammierung SENKT umgekehrt die rechte Mittenfrequenz.
// ============================================================

// Wandelt einen Roh-Offset in der ALTEN var/ref-Mess-Konvention
// ("refHz = varHz * 2^(rawOffset/1200)") in den kanonischen cent.
// NUR fuer die Lade-Migration alter .cimbel-Dateien (var/ref-Felder).
// Der Live-Test schreibt cent direkt aus referenzmodus (freqmatch.js).
//   frqRefMode 'right' (var=rechts, ref=links): pse>0 => links hoeher => -pse
//   sonst ('left'/'symmetric'):                                        => +pse
function FRQ_varRefOffsetToCanonical(frqRefMode, rawOffset) {
  var c = (typeof rawOffset === "number" && isFinite(rawOffset)) ? rawOffset : 0;
  return (frqRefMode === "right") ? -c : c;
}

// Verteilt den KANONISCHEN cent nach der Player-Einstellung warpMode
// auf die beiden Seiten. Rueckgabe { csL, csR } = Cent-Shift links/rechts.
// Braucht KEINEN testmode (Mess-Herkunft ist im kanonischen cent
// bereits aufgeloest). cent>0 => rechte Seite wird angehoben (Warp-Richtung;
// die Wahrnehmung ist umgekehrt: bei +cent klingt rechts tiefer).
//   warpMode 'right':     volle Differenz aufs rechte Ohr   -> csR = cent
//   warpMode 'left':      volle Differenz aufs linke Ohr    -> csL = -cent
//   warpMode 'symmetric': haelftig gegenlaeufig             -> csR=cent/2, csL=-cent/2
function FRQ_seitenWerte(cent, warpMode) {
  var c = (typeof cent === "number" && isFinite(cent)) ? cent : 0;
  if (warpMode === "left")      return { csL: -c, csR: 0 };
  if (warpMode === "symmetric") return { csL: -c / 2, csR: c / 2 };
  if (warpMode === "right")     return { csL: 0, csR: c };
  // BA491: kein stiller right-Fallback mehr. Ungueltiger Modus faellt LAUT auf.
  console.error("FRQ_seitenWerte: ungueltiger Modus '" + warpMode + "'");
  return { csL: 0, csR: 0 };
}

// Bezugsfrequenz (Hz) einer Elektrode fuer die Ergebnis-Graph-X-Achse:
// die eingetragene Implantat-Frequenz auf der global AKTIVEN Seite
// (Konzept: "Graph relativ zur aktiven Seite"). Braucht withSide +
// FRQ_implantatEffektiv (global verfuegbar) + activeSide.
function FRQ_refHzForMode(elIdx) {
  var side = (typeof activeSide === "string") ? activeSide : "right";
  return withSide(side, function () { return FRQ_implantatEffektiv(elIdx); });
}

// BA419: Uebersetzt den Referenzmodus (im Test bewegte Seite) in den
// "korrigierte Seite"-Modus, den FRQ_werte/FRQ_seitenWerte erwarten. EINE
// geteilte Stelle fuer alle Referenzmodus-Konsumenten (Ergebnis-Graph,
// spaeter Ergebnis-Tabelle, Player-Warp-Default). Mapping nach
// Nutzer-Beschluss BA417: left<->right getauscht, symmetric bleibt.
function FRQ_modusVonReferenzmodus(rm) {
  if (rm === "left")      return "right";
  if (rm === "right")     return "left";
  if (rm === "symmetric") return "symmetric";
  return "left";
}

// BA418: Zentrale Frequenzabgleich-Wertquelle. EINE Stelle, aus der alle
// Konsumenten ihre Frequenzwerte beziehen. Siehe
// .docs/spec/00-freqmatch-wertquelle-architektur.md
//
// Argumente:
//   form         'roh' | 'warp' | 'gehoert'  (konsumenten-benannt, traegt Richtung)
//   modus        'left' | 'right' | 'symmetric'  = die KORRIGIERTE/verschobene
//                Seite. Die Funktion kennt den Begriff "Referenzseite" NICHT;
//                Referenzmodus-Konsumenten uebersetzen ihn selbst (spaeter).
//   nhSim        bool (Default false) -- Player-Einstellung
//                "Normalhoerenden-Simulation". Wird HIER pro Form in die
//                noetige Spiegelung uebersetzt; der Konsument denkt nicht
//                ueber Vorzeichen nach.
//   verfahren    'geometrisch' | 'greenwood'  (Default 'geometrisch',
//                Sec. 11). Bandberechnungs-Verfahren, an FRQ_baender
//                durchgereicht. KEIN Konsument denkt ueber Baender-Mathe
//                nach -- er waehlt nur den Namen (heute alle: Default).
//
// Rueckgabe: sortiertes Array (aufsteigend nach elIdx), EIN Eintrag je
// Elektrode der beidseitigen Menge (min(nL, nR)). IMMER beide Seiten
// (entry.left / entry.right); der Konsument pickt entry[seite]. Ungemessene
// und deaktivierte Elektroden bekommen Null-Werte fuer die MESS-abgeleiteten
// Groessen -- die nominellen Frequenzen (keine Messgroesse) bleiben erhalten.
//
// BA453: aus test.js hierher verschoben (war test.js:550). core.js laedt
// vor test.js (index.html:140-141), die Aufrufer in test.js (ELL_compWLS,
// ELL_res-Serie) sehen die Funktion weiterhin. Status -> Gewicht:
// stumm/ausgeschlossen=0, almostMute=0.05, noisyHeavy=0.15, noisyMore=0.4,
// noisyLess=0.8, normal=1. Startquelle fuer CBF-Statusgewicht (Architektur
// 00-cbf-verfahren-architektur.md §4.3).
function ell_gWt(i, elSt_, elExDur_) {
  var _elSt    = elSt_    || elSt;
  var _elExDur = elExDur_ || elExDur;
  const s = _elSt[i];
  if (_elExDur[i] !== null || s === "mute") return 0;
  if (s === "almostMute") return 0.05;
  if (s === "noisyHeavy") return 0.15;
  if (s === "noisyMore")  return 0.4;
  if (s === "noisyLess")  return 0.8;
  return 1;
}

// ============================================================
// EXPERIMENTELL (2026-07-09, Direkt-Bau, kein UI ausser Debug-Auswahl):
// Vor-Glaettung der gemessenen cent-Reihe VOR den Bandverfahren. Konzept:
// IDEEN.md "Frequenzabgleich -- optionale Vor-Glaettung der Messwerte".
// Rechnet auf dem kanonischen cent (referenzseiten-frei, core.js:1358) ueber
// elIdx AUFSTEIGEND (= Frequenz aufsteigend bei jedem Hersteller,
// core.js:197/241 -- apikal/basal-Ordnung irrelevant). Gewicht je Elektrode:
// Status (ell_gWt) x 1/max(Residuum,BODEN)^2. Startwerte experimentell.
// Geteilte Residuum-Kalibrierung (BA517): EIN Boden + EIN Ungemessen-Wert
// fuer Glaettungs-Gewicht (_frqGlaettGewicht) UND Bandgrenzen-Optimierer
// (FRQ_baender) -- damit die beiden Verfahren nicht divergieren.
var RES_BODEN_CT = 5;          // Mindest-Toleranz jeder Messung (cent)
// BA518: seitengelesener Boden (Achse bandGlaettBoden). Fallback = Konstante.
// EINE Quelle fuer Glaettungs-Gewicht UND Optimierer (geteilt, s. Architektur).
var FRQ_GLAETT_BODEN_WERTE = { "2": 2, "5": 5, "10": 10, "20": 20 };
function _resBodenCt(seite) {
  var s = (typeof sideData !== "undefined" && seite) ? sideData[seite] : null;
  var v = (s && s.bandGlaettBoden) ? String(s.bandGlaettBoden) : null;
  return (v && FRQ_GLAETT_BODEN_WERTE[v] != null) ? FRQ_GLAETT_BODEN_WERTE[v]
                                                  : RES_BODEN_CT;
}
var RES_UNGEMESSEN_CT = 1200;  // virtuelles Residuum ungemessener aktiver El. (cent)
// BA477: Ersatzwerte fuer AKTIVE, aber NICHT gemessene Elektroden (stumm,
// ausgeschlossen oder noch nicht gemessen). Sie nehmen mit cent=0
// (gehoert=nominell) als Stuetzstelle an der Glaettung teil, mit sehr
// geringem Einfluss: kleines Status-Gewicht + hohes virtuelles Residuum.
// Gehen durch DIESELBE Formel _frqGlaettGewicht (g/r^2), kein Sonderweg.
// ell_gWt bleibt unangetastet (ELL/CBF nutzen dort weiter stumm->0).
var FRQ_GLAETT_UNGEMESSEN_GEWICHT = 0.05;   // Status-Gewicht g (wie almostMute)
// BA487: Greenwood-Offset k je Stufe der bandGlaettK-Achse (Ortsverfahren).
// Werte aus der MED-EL-Default-Rekonstruktion (Konzept_Greenwood_Glaettungs_
// Prior.md §3): klassisch 0.88 traf am schlechtesten, weggelassen.
var FRQ_GLAETT_K_WERTE = { "0.88": 0.88, "1.0": 1.0, "1.36": 1.36, "1.53": 1.53 };
var FRQ_GLAETT_K_DEFAULT = 0.88;
// BA499: Elektrodenlage-Gewicht w je Stufe der bandGlaettLage-Achse.
// aussen=OC(Greenwood), mitte=ABF-Mittel, innen=SG. Architektur 00-glaettung §6b.
var FRQ_GLAETT_LAGE_WERTE = { "aussen": 0, "mitte": 0.5, "innen": 1 };
var FRQ_GLAETT_LAGE_DEFAULT = 0.5; // mitte (ABF-Mittel) = Default der Lage-Achse
                                   // (deckungsgleich mit FRQ_BAND_WAHLEN bandGlaettLage "mitte")
// BA524: Elektrodenlage-Achse der BANDBERECHNUNG (gemeinsame Rechenraum-Achse,
// Architektur 00-bandverfahren Paragraph 5). "geometrisch" = log-Raum (kein w);
// aussen/mitte/innen = Greenwood-Ortsraum mit w 0/0,5/1 via _lageToP/_lageFromP.
// Unterscheidet sich von FRQ_GLAETT_LAGE_WERTE durch die Extra-Stufe "geometrisch".
var FRQ_BAND_LAGE_W = { "aussen": 0, "mitte": 0.5, "innen": 1 };
// "geometrisch" ist KEINE w-Stufe -> Sonderbehandlung (log-Raum), siehe
// _frqBandRaum unten.
// BA501: gewaehlter Ausgangspunkt des Frequenzbaender-Graphen (reine
// Anzeige-Wahl, global fuer beide Seiten, keine Persistenz). Werte:
// "gemessen" | "geglaettet" | "nominell". Default geglaettet.
var FRQ_bandAusgang = "geglaettet";
// Kurven-Farbschluessel -> Hex. EINE Wahrheit fuer Zeichencode (chart.js),
// Legende (FRQ_legendeHtml) und Ausgangspunkt-Auswahl (init.js). "schwarz"
// ist bewusst ein Mittelgrau (nominell-Kurve).
var KURVENFARBE = { blau: "#3b82f6", gruen: "#16a34a", schwarz: "#6b7280" };
// Ausgangspunkt des Bandgraphen -> Kurven-Farbschluessel. Verankert die
// Zuordnung geglaettet/gemessen/nominell an genau einer Stelle (Kurvenfarbe
// in results.js, Symbol vor dem Auswahl-Radio in init.js).
var FRQ_AUSGANG_FARBE = { geglaettet: "gruen", gemessen: "blau", nominell: "schwarz" };
function _frqGlaettLage() {
  var s = (typeof sideData !== "undefined" && typeof activeSide === "string")
    ? sideData[activeSide] : null;
  var v = (s && s.bandGlaettLage) ? String(s.bandGlaettLage) : null;
  return (v && FRQ_GLAETT_LAGE_WERTE[v] != null) ? FRQ_GLAETT_LAGE_WERTE[v]
                                                 : FRQ_GLAETT_LAGE_DEFAULT;
}
function _frqGlaettK() {
  var s = (typeof sideData !== "undefined" && typeof activeSide === "string")
    ? sideData[activeSide] : null;
  var v = (s && s.bandGlaettK) ? String(s.bandGlaettK) : null;
  return (v && FRQ_GLAETT_K_WERTE[v] != null) ? FRQ_GLAETT_K_WERTE[v]
                                              : FRQ_GLAETT_K_DEFAULT;
}

// BA477 / §9.5.1: elIdx-Liste der auf `side` AKTIVEN Elektroden (elActive[i] !== false),
// aufsteigend. Nur elActive===false faellt aus der Glaettung; stumm/ausgeschlossen/
// ungemessen bleiben drin. Seitenrichtig ueber withSide (elActive ist seitengebunden,
// gleiches Muster wie FRQ_werte core.js:1706-1707).
function _frqAktiveElIdx(side) {
  var s = (typeof sideData !== "undefined") ? sideData[side] : null;
  var n = (s && s.nEl) ? s.nEl : 0;
  var act = (s && s.elActive) ? s.elActive : null;
  var chain = (s && s.elFreqChain) ? s.elFreqChain : null;
  var out = [];
  for (var i = 0; i < n; i++) {
    // §4.1: in der Kette, wenn AKTIV (elActive!==false) UND gewaehlt
    // (elFreqChain!==false). Fehlende Arrays -> Default drin.
    var aktiv = !act || act[i] !== false;
    var gewaehlt = !chain || chain[i] !== false;
    if (aktiv && gewaehlt) out.push(i);
  }
  return out;
}

// Vertrauens-Gewicht einer Elektrode (0 = ignorieren). res = Residuum-Bandbreite|null.
function _frqGlaettGewicht(i, res) {
  var g = (typeof ell_gWt === "function") ? ell_gWt(i) : 1;
  if (!(g > 0)) return 0;
  var _s = (typeof sideData !== "undefined" && typeof activeSide === "string")
    ? sideData[activeSide] : null;
  var _formel = (_s && _s.bandGlaettFormel) ? _s.bandGlaettFormel : "quadrat";
  if (_formel === "gleich") return g;             // res ignoriert; ell_gWt bleibt
  var r = (typeof res === "number" && isFinite(res)) ? res : 0;
  r = Math.max(r, _resBodenCt(activeSide));
  var exp = (_formel === "linear") ? 1 : (_formel === "quartisch") ? 4 : 2;
  return g / Math.pow(r, exp);
}

// BA502: Vereinte Polynom-Engine (ersetzt _frqGlaettKurve + _frqGlaettOrtskurve,
// Architektur 00-glaettung-verfahren-architektur.md §6d). Gewichtetes Ridge-
// Polynom, gesteuert durch zwei orthogonale Achsen:
//   Fit-x (bandGlaettFitX):  "position" -> x = raum(nom); "index" -> x = Index 0..n-1
//   Rechenraum (bandGlaettAchse): "log" -> raum(hz)=log2(hz), w wirkungslos;
//                                 "ortsraum" -> raum(hz)=_lageToP(hz,k,w) (Lage-Ortsraum,
//                                 w=0 = reiner Greenwood).
// y = die zu glaettende Groesse der GEHOERTEN Frequenz IM Rechenraum; Rueckweg
// raumabhaengig, dann kanonisch cent' = -1200*log2(gehoertGlatt/nom).
// Signatur wie die abgeloesten Engines (noms, cents, weights) -> cents'.
function _frqGlaettPolynom(noms, cents, weights) {
  var n = noms.length;
  var _s = (typeof sideData !== "undefined" && typeof activeSide === "string")
    ? sideData[activeSide] : null;
  var _fitW  = (_s && _s.bandGlaettFitX) ? _s.bandGlaettFitX : "position";
  var _raumW = (_s && _s.bandGlaettAchse) ? _s.bandGlaettAchse : "log";
  var _gradW = (_s && _s.bandGlaettGrad && _s.bandGlaettGrad !== "aus")
    ? parseInt(_s.bandGlaettGrad, 10) : 2;

  // Rechenraum-Paar (Hz <-> Raum). "log": log2/pow2, w-frei. "ortsraum":
  // Lage-Ortsraum ueber _lageToP/_lageFromP mit EINMAL gelesenem k und w
  // (Muster ortsaffin core.js: _frqGlaettK()/_frqGlaettLage() -> an toP UND
  // fromP -> hin=zurueck garantiert).
  var _ort = (_raumW === "ortsraum");
  var kk = _ort ? _frqGlaettK()   : 0;
  var ww = _ort ? _frqGlaettLage() : 0;
  function raumToP(hz)  { return _ort ? _lageToP(hz, kk, ww) : Math.log2(hz); }
  function raumFromP(P) { return _ort ? _lageFromP(P, kk, ww) : Math.pow(2, P); }

  // Steife (Ridge): geometrisch gestaffeltes lambda, ab p>=2. Stufe 0..6,
  // Alt-Strings weich/mittel/steif -> 0/2/6 (Load-Kompat). IDENTISCH zu den
  // abgeloesten Engines.
  var FRQ_GLAETT_STEIFE_LAMBDA = [0, 0.02, 0.05, 0.12, 0.25, 0.35, 0.5];
  var _steifeRaw = (_s && _s.bandGlaettSteife != null) ? String(_s.bandGlaettSteife) : "2";
  var _steifeIdx = (_steifeRaw === "weich") ? 0
                 : (_steifeRaw === "mittel") ? 2
                 : (_steifeRaw === "steif") ? 6
                 : parseInt(_steifeRaw, 10);
  if (!(_steifeIdx >= 0 && _steifeIdx <= 6)) _steifeIdx = 2;
  var _lambda = FRQ_GLAETT_STEIFE_LAMBDA[_steifeIdx];

  var deg = _gradW; if (deg >= n) deg = n - 1;   // nicht ueberbestimmen

  // --- Fit-x-Achse ---
  // "position": x = raum(nom) (nominelle Frequenz im Rechenraum, wie altes Polynom).
  // "index":    x = Elektroden-Index 0..n-1 (wie alte Ortskurve).
  var _xr;
  if (_fitW === "index") {
    _xr = []; for (var q = 0; q < n; q++) _xr.push(q);
  } else {
    _xr = noms.map(function (nm) { return raumToP(nm); });
  }
  // x zentrieren + skalieren (Konditionierung; Auswertung auf denselben x').
  var _xm = 0; for (var k1 = 0; k1 < n; k1++) _xm += _xr[k1]; _xm /= n;
  var _xv = 0; for (var k2 = 0; k2 < n; k2++) { var _d = _xr[k2] - _xm; _xv += _d * _d; }
  var _xs = Math.sqrt(_xv / n) || 1;
  var x = _xr.map(function (xv) { return (xv - _xm) / _xs; });

  // --- y = gehoerte Frequenz IM Rechenraum ---
  // gehoert = nom * 2^(-cent/1200) (Konvention core.js).
  var yr = noms.map(function (nm, i) {
    var gehoert = nm * Math.pow(2, -cents[i] / 1200);
    return raumToP(gehoert);
  });
  // 0.5.503.4: y ZENTRIEREN + auf Standardabweichung skalieren -- wie x oben.
  // Der Ridge-Strafterm bestraft die absoluten coef[p>=2]; ohne y-Normierung
  // haengt seine Wirkung von der y-SKALA des Rechenraums ab (Ortsraum-P ~0..100
  // vs. greenwoodX ~0..1 -> Faktor ~100 -> lambda wirkt ~10000-fach zu stark).
  // Damit war "polynom+index+ortsraum,aussen" NICHT identisch zum alten
  // "ortslage"-Verfahren (das im greenwoodX-Raum glaettete). Mit Normierung ist
  // der Strafterm skaleninvariant -> Aequivalenz wiederhergestellt; bei lambda=0
  // ohnehin folgenlos (affine y-Transformation, Fit invariant).
  var _ym = 0; for (var y0 = 0; y0 < n; y0++) _ym += yr[y0]; _ym /= n;
  var _yv = 0; for (var y1 = 0; y1 < n; y1++) { var _yd = yr[y1] - _ym; _yv += _yd * _yd; }
  var _ys = Math.sqrt(_yv / n) || 1;
  var y = yr.map(function (yv) { return (yv - _ym) / _ys; });

  // --- Gewichtete Ridge-Regression (Normalgleichungen, _frqGauss) ---
  var m = deg + 1;
  var M = [], rhs = [];
  for (var a = 0; a < m; a++) { M.push(new Array(m).fill(0)); rhs.push(0); }
  for (var i = 0; i < n; i++) {
    var w = weights[i]; if (!(w > 0)) continue;
    var xp = new Array(m); xp[0] = 1;
    for (var p = 1; p < m; p++) xp[p] = xp[p - 1] * x[i];
    for (var r = 0; r < m; r++) {
      rhs[r] += w * xp[r] * y[i];
      for (var c = 0; c < m; c++) M[r][c] += w * xp[r] * xp[c];
    }
  }
  if (_lambda > 0) {
    // BA518: Ridge-Anker waehlbar (bandGlaettAnker). "entkoppelt" = mittleres
    // Gewicht (Σw/n) statt Summe → Steife bodenunabhaengig. n = Σ w>0 (Punkte
    // mit Gewicht), nicht Array-Laenge, da Gewicht-0-Punkte nicht beitragen.
    var _ankerRaw = M[0][0] || 1;   // = Σw
    var _ankerMode = (_s && _s.bandGlaettAnker) ? _s.bandGlaettAnker : "gekoppelt";
    var _nw = 0; for (var _aw = 0; _aw < n; _aw++) { if (weights[_aw] > 0) _nw++; }
    var _anker = (_ankerMode === "entkoppelt" && _nw > 0) ? (_ankerRaw / _nw) : _ankerRaw;
    for (var rr = 2; rr < m; rr++) M[rr][rr] += _lambda * _anker;
  }
  var coef = _frqGauss(M, rhs);
  if (!coef) return cents.slice();               // singulaer -> unveraendert

  // --- Auswertung: geglaetteter y-Wert -> Hz -> kanonisches cent ---
  // yf ist in normierten y-Einheiten -> zurueck: yf * _ys + _ym, dann raumFromP.
  var out = new Array(n);
  for (var i2 = 0; i2 < n; i2++) {
    var yf = 0, xk = 1;
    for (var p2 = 0; p2 < m; p2++) { yf += coef[p2] * xk; xk *= x[i2]; }
    var gehoertGlatt = raumFromP(yf * _ys + _ym);
    out[i2] = -1200 * Math.log2(gehoertGlatt / noms[i2]);
  }
  return out;
}

// BA489 (Architektur: 4. Verfahren, Konzept §6d): Ortsaffin. Rekonstruiert die
// Elektroden-Positionen aus dem Default-Positionsmuster per gewichtetem affinen
// Fit an die zuverlaessigen Messpunkte. xdef = greenwoodX(nominal, k) (festes
// Muster), xmess = greenwoodX(gehoert, k). Gewichteter Fit xmess ~ a*xdef + b
// (a = Streckung ~ Cochlea-Laenge, b = Verschiebung ~ Insertionstiefe). Dann
// x_rekon = a*xdef + b fuer ALLE Stuetzstellen, zurueck via greenwoodHz. Alles
// im normierten Ortsraum (keine mm-Annahme). Signatur wie _frqGlaettKurve.
// BA489/BA490/BA499 (Architektur §6/§6a/§6b): Ortsaffin-Kern. k (_frqGlaettK)
// und Lage-Gewicht w (_frqGlaettLage) werden EINMAL gelesen; toP/fromP daraus
// lokal erzeugt -> hin=zurueck garantiert.
// defNoms (2026-07-14): reine Hersteller-Default-Frequenzen je Stuetzstelle
// als Ortsmuster fuer xdef. Nur die VORLAGE -- xmess (gehoert) und die cent-
// Rueckrechnung laufen weiter ueber noms (effektiv, = gemessene Elektrode).
// Fehlt defNoms[i] (null/undefined), faellt diese Stelle auf noms[i] zurueck.
function _frqGlaettOrtsaffin(noms, cents, weights, defNoms) {
  var n = noms.length;
  if (n < 2) return cents.slice();
  var kk = _frqGlaettK();
  var ww = _frqGlaettLage();
  function toP(hz)  { return _lageToP(hz, kk, ww); }
  function fromP(P) { return _lageFromP(P, kk, ww); }

  var xdef = [], xmess = [];
  for (var i = 0; i < n; i++) {
    var gehoert = noms[i] * Math.pow(2, -cents[i] / 1200);
    // Vorlage = Default (defNoms), Fallback noms. gehoert bleibt auf noms.
    var _vorlageHz = (defNoms && defNoms[i] != null) ? defNoms[i] : noms[i];
    xdef.push(toP(_vorlageHz));
    xmess.push(toP(gehoert));
  }

  // Gewichteter affiner Fit xmess = a*xdef + b (Gewichte tragen sicher/unsicher).
  var sw = 0, mx = 0, my = 0;
  for (var j = 0; j < n; j++) {
    var w = (weights[j] > 0) ? weights[j] : 0;
    sw += w; mx += w * xdef[j]; my += w * xmess[j];
  }
  if (!(sw > 0)) return cents.slice();
  mx /= sw; my /= sw;
  var sxx = 0, sxy = 0;
  for (var j2 = 0; j2 < n; j2++) {
    var w2 = (weights[j2] > 0) ? weights[j2] : 0;
    var dx = xdef[j2] - mx;
    sxx += w2 * dx * dx;
    sxy += w2 * dx * (xmess[j2] - my);
  }
  if (!(sxx > 0)) return cents.slice();     // alle xdef gleich -> nicht loesbar
  var a = sxy / sxx;
  var b = my - a * mx;

  // Rekonstruierte Position fuer ALLE Stuetzstellen -> Hz -> kanonisches cent.
  var out = new Array(n);
  for (var i2 = 0; i2 < n; i2++) {
    var xr = a * xdef[i2] + b;
    var gehoertGlatt = fromP(xr);
    out[i2] = -1200 * Math.log2(gehoertGlatt / noms[i2]);
  }
  return out;
}

// BA476: Setzt den apikalen Randausschluss der Glaettung (bandGlaettRandfrei)
// einer Seite auf die Anzahl der FSP-markierten Elektroden. FSP existiert nur
// bei MED-EL; ohne FSP-Moeglichkeit -> "0". Danach Radio spiegeln + Glaettungs-
// Graph neu zeichnen (Wert wird im Reiter Implantat geaendert, Radio steht im
// Reiter Frequenzbaender). Aufgerufen an JEDER FSP-Schreibstelle. Kein "vom
// Nutzer beruehrt"-Flag: der Randausschluss wird nur hier (bei FSP-Aenderung)
// automatisch gesetzt; eine spaetere manuelle Radio-Aenderung bleibt bestehen,
// bis die FSP-Markierung erneut geaendert wird.
// 0.5.476.6: koppelt zusaetzlich das CBF-Feld "Freie Baender (apikal)"
// (bandCbfApikalFrei) an dieselbe FSP-Anzahl, aber mit Untergrenze 1 --
// bei jeder Implantat-Aenderung mind. 1 freies Band, auch bei 0 FSP-
// Elektroden und bei Nicht-MED-EL. Die Glaettung bleibt bei der reinen
// Anzahl (darf 0). Selbe Aufrufstellen, selbes Spiegeln (_frqBandSpiegle
// deckt beide Radios ueber FRQ_BAND_WAHLEN ab).
function FRQ_randausschlussAusFsp(side) {
  if (typeof sideData === "undefined" || !sideData[side]) return;
  var s = sideData[side];
  var anzahl = 0;
  if (s.manufacturer === "medel" && s.implant && Array.isArray(s.implant.fspEl)) {
    s.implant.fspEl.forEach(function (v) { if (v === true) anzahl++; });
  }
  if (anzahl > 4) anzahl = 4;   // Radio reicht bis 4 (fs4/fs4p: max 4 FSP-El.)
  s.bandGlaettRandfrei = String(anzahl);
  s.bandCbfApikalFrei  = String(Math.max(anzahl, 1));   // CBF: mind. 1 freies Band
  // Nur wenn die geaenderte Seite auch die aktive ist, DOM spiegeln/neu zeichnen
  // (die Radio-DOM traegt immer den aktiven Seiten-Zustand).
  if (typeof activeSide === "string" && side === activeSide) {
    if (typeof window !== "undefined" && typeof window._frqBandSpiegle === "function")
      window._frqBandSpiegle();
    if (typeof window !== "undefined" && typeof window._frqGlaettUpdate === "function")
      window._frqGlaettUpdate();
  }
}

// Aus der Glaettung auszuschliessende elIdx (BA476). Eine Quelle:
//   Apikaler Randausschluss (s.bandGlaettRandfrei = "0".."4"): die N
//   apikalsten gemessenen Elektroden. Apikal hersteller-abhaengig: apFirst
//   (MED-EL/AB) = kleinster elIdx, Cochlear = groesster. Seit BA476 wird
//   bandGlaettRandfrei aus der FSP-Markierung vorbelegt (nur MED-EL, ueber
//   FRQ_randausschlussAusFsp) und ist danach frei am Radio aenderbar; der
//   fruehere direkte FSP-Ausschluss entfaellt.
// keys = zu glaettende elIdx aufsteigend. Rueckgabe: Set (Objekt) der
// auszuschliessenden elIdx.
function _frqGlaettAusschluss(keys) {
  var out = {};
  if (!keys.length) return out;
  var s = (typeof sideData !== "undefined" && typeof activeSide === "string")
    ? sideData[activeSide] : null;
  if (!s) return out;
  // Apikaler Randausschluss: die N apikalsten gemessenen Elektroden aus der
  // Glaettung ausschliessen. N aus bandGlaettRandfrei (0..4), seit BA476 aus
  // der FSP-Markierung vorbelegt (FRQ_randausschlussAusFsp). Apikal hersteller-
  // abhaengig: apFirst (MED-EL/AB) = kleinste elIdx, Cochlear = groesste.
  // keys ist aufsteigend sortiert.
  var mfrId = s.manufacturer;
  var apFirst = (typeof MFR !== "undefined" && MFR[mfrId]) ? MFR[mfrId].apFirst !== false : true;

  // AB-Sonderregel (2026-07-11): Bei Advanced Bionics folgen nur die MITTLEREN
  // Elektroden dem Greenwood-Ortsmuster; die beiden Randelektroden (apikalste
  // + basalste) sitzen ausserhalb (belegt: Konzept_Greenwood_Glaettungs_Prior.md
  // §6f -- E2..E15 Abstands-Variation 1,0%, E1/E16 springen). Der Grund gilt fuer
  // Verfahren, die im GREENWOOD-/ORTSraum rechnen. Harter Ausschluss (Rand bleibt
  // Rohwert): beim Polynom, WENN es im Ortsraum rechnet (bandGlaettAchse ===
  // "ortsraum") -- deckt den aus "ortskurve" migrierten Fall (polynom+index+
  // ortsraum) UND jedes andere polynom im Ortsraum ab (0.5.502.1, Martin
  // 2026-07-14: nur im Ortsraum, nicht im log-Raum -- dort kein Ortsmuster-Bezug).
  // Bei ortsaffin NICHT hier: dort bleiben die Raender in keys und werden nur aus
  // dem Fit genommen (Gewicht 0 in _frqGlaetteMeasured), aber vom affinen Modell
  // (a*xdef+b) rekonstruiert.
  var _verf = s.bandGlaettVerfahren;
  var _istPolynomOrtsraum = (_verf === "polynom" && s.bandGlaettAchse === "ortsraum");
  if (mfrId === "ab" && _istPolynomOrtsraum && keys.length >= 2) {
    out[keys[0]] = true;                    // apikalste (AB apFirst -> kleinster elIdx)
    out[keys[keys.length - 1]] = true;      // basalste
  }

  // Apikaler Randausschluss (Achse): die N apikalsten Elektroden. N aus
  // bandGlaettRandfrei (0..4), aus der FSP-Markierung vorbelegt. NUR bei MED-EL
  // (rate-pitch/FSP-Grund); die Achse ist auch nur dort sichtbar (init.js). Bei
  // AB gilt allein die feste Rand-Sonderregel oben, ein evtl. stehengebliebener
  // Achsenwert wird ignoriert; bei Cochlear sind die Ortsverfahren nicht tauglich.
  if (mfrId === "medel") {
    var n = parseInt(s.bandGlaettRandfrei, 10);
    if (n > 0) {
      if (n > keys.length) n = keys.length;
      for (var i = 0; i < n; i++) {
        var apikal = apFirst ? keys[i] : keys[keys.length - 1 - i];
        out[apikal] = true;
      }
    }
  }
  return out;
}

// Wendet ein Glaettungs-Verfahren ('isoton'|'lokal') auf das measured-Objekt
// an: sammelt gemessene Eintraege elIdx-aufsteigend, glaettet cent, schreibt
// zurueck. Ungemessene UND ausgeschlossene (apikal/basal frei) bleiben
// unberuehrt. Mutiert measured NICHT -- gibt eine flache Kopie mit neuen
// cent zurueck.
function _frqGlaetteMeasured(measured, verfahren) {
  var side = (typeof activeSide === "string") ? activeSide : "right";
  // BA477 / §9.5.1: Stuetzstellen = ALLE aktiven Elektroden der Seite,
  // nicht nur gemessene. Gemessene tragen ihr cent + Residuum + Status-
  // Gewicht; nicht-gemessene aktive (stumm/ausgeschlossen/ungemessen)
  // tragen cent=0, Gewicht FRQ_GLAETT_UNGEMESSEN_GEWICHT, Residuum
  // RES_UNGEMESSEN_CT -- durch dieselbe Formel _frqGlaettGewicht.
  var allKeys = _frqAktiveElIdx(side);          // aufsteigend, seitenrichtig
  var ausschluss = _frqGlaettAusschluss(allKeys);
  var keys = allKeys.filter(function (k) { return !ausschluss[k]; });
  if (keys.length < 2) return measured;

  function _istGemessen(k) {
    return !!(measured[k] && measured[k].cent != null);
  }
  var cents = keys.map(function (k) {
    return _istGemessen(k) ? measured[k].cent : 0;   // ungemessen: cent 0
  });
  var weights = keys.map(function (k) {
    if (_istGemessen(k)) {
      // BA517: Gewichts-Grundlage waehlbar (bandGlaettGrundlage):
      // "residuum" = Residuum-Bandbreite (residDown+residUp),
      // "restspanne" = Restspanne. Beide aus _frq_pianoResiduumBand.
      var _bw = (typeof _frq_pianoResiduumBand === "function")
        ? _frq_pianoResiduumBand(k) : null;
      var _grund = (side && sideData[side] && sideData[side].bandGlaettGrundlage)
        ? sideData[side].bandGlaettGrundlage : "residuum";
      var _res = null;
      if (_bw) {
        _res = (_grund === "restspanne")
          ? _bw.restspanne
          : (_bw.residDown + _bw.residUp);
      }
      return _frqGlaettGewicht(k, _res);
    }
    // Nicht-gemessene aktive: fester g / festes r, gleiche Formel g/r^2.
    return FRQ_GLAETT_UNGEMESSEN_GEWICHT
      / (RES_UNGEMESSEN_CT * RES_UNGEMESSEN_CT);
  });
  // x-Achse: nominelle Hz je Stuetzstelle, seitenrichtig. noms = EFFEKTIVE
  // Frequenz (own ?? default) -- das ist der Bezug der Messung + cent-Rueck-
  // rechnung (der Nutzer hat SEINE Elektrode gemessen).
  var noms = keys.map(function (k) {
    return withSide(side, function () { return FRQ_implantatEffektiv(k); });
  });
  var _sd = (typeof sideData !== "undefined") ? sideData[side] : null;
  // Ortsaffin-Vorlage (2026-07-14): das xdef-Ortsmuster MUSS die reinen
  // Hersteller-Defaultfrequenzen sein (greenwood-verteilt, §6f) -- NICHT die
  // nutzer-editierten (FRQ_implantatOwn zerstoert die Musterstruktur). Nur die
  // VORLAGE auf Default, xmess/Rueckrechnung bleiben auf noms (effektiv).
  var defNoms = keys.map(function (k) {
    var d = (_sd && _sd.FRQ_implantat) ? _sd.FRQ_implantat[k] : null;
    return (d != null) ? d : null;   // null -> Ortsaffin faellt je Stelle auf noms zurueck
  });
  // AB + ortsaffin (2026-07-11, Konzept §7): die beiden Randelektroden bleiben
  // in keys (anders als ortskurve), werden aber aus dem affinen
  // FIT genommen -> Gewicht 0. _frqGlaettOrtsaffin fittet a,b dann nur ueber die
  // inneren, rekonstruiert aber ALLE (auch die Raender) via a*xdef+b -> die
  // Raender bekommen ihre modellierte Frequenz (grosser Default-Rand-Abstand in
  // xdef, mit a skaliert). Nur ortsaffin (nur dort existiert ein globales a,b).
  if (_sd && _sd.manufacturer === "ab"
      && _sd.bandGlaettVerfahren === "ortsaffin"
      && keys.length >= 2) {
    weights[0] = 0;
    weights[keys.length - 1] = 0;
  }
  // Verfahren-Weiche (Architektur §6). BA502: ortskurve in polynom aufgegangen.
  var glatt;
  if (verfahren === "ortsaffin") {
    glatt = _frqGlaettOrtsaffin(noms, cents, weights, defNoms);   // defNoms = Default-Vorlage (xdef)
  } else {
    glatt = _frqGlaettPolynom(noms, cents, weights);   // polynom (vereint polynom+ortskurve, BA502)
  }

  // Ergebnis: measured flach kopieren, dann fuer JEDE Stuetzstelle das
  // geglaettete cent schreiben -- auch fuer vorher nicht existente
  // (ungemessene) Eintraege, damit sie als aktive Elektrode ein cent haben.
  var out = {};
  Object.keys(measured).forEach(function (k) { out[k] = measured[k]; });
  keys.forEach(function (k, idx) {
    var src = out[k] || {};
    var e = {};
    Object.keys(src).forEach(function (f) { e[f] = src[f]; });
    e.cent = Math.round(glatt[idx]);
    out[k] = e;
  });
  return out;
}

// Vorzeichen-Wahrheit (eingefroren, kanonisch +cent = rechtes Ohr nimmt
// tiefer wahr): base = FRQ_seitenWerte(cent, modus) ist die WARP-Richtung.
//   warp    :  nhSim aus -> Vorhalt/Korrektur; nhSim an -> Verzerrung.
//   gehoert :  nhSim aus -> gehoerte/Korrektur-Richtung; nhSim an -> gespiegelt.
//   roh     :  cent unveraendert, plus Referenzseite (nhSim ohne Wirkung).
function FRQ_werte(form, modus, nhSim, verfahren, topologie, optimieren, ziel, mitAusgleich) {
  // nhSim: bool -- die Player-Einstellung "Normalhoerenden-Simulation".
  // Die gesamte Vorzeichen-/Spiegelungslogik lebt HIER, nicht im Konsumenten
  // (Nutzer-Vorgabe BA421: kein Konsument denkt ueber Vorzeichen nach).
  // Intern wird nhSim pro Form in die noetige Spiegelung uebersetzt (2b).
  var _nhSim = !!nhSim;

  // BA491: modus-Default aus dem globalen FRQ_distribution (Achse 2).
  // Explizites Argument (Achse-1-Konsumenten: Referenzmodus) gewinnt weiter.
  if (typeof modus !== "string") {
    modus = (typeof FRQ_distribution === "string") ? FRQ_distribution : "right";
  }

  // BA463: Verfahren/Topologie/Optimieren/Ziel sind jetzt PRO SEITE
  // (sideData[seite]). Explizites Argument (Override) gewinnt weiterhin;
  // fehlt es, wird die Wahl SEITENRICHTIG in der Schleife unten gelesen.
  // Hier nur die expliziten Argument-Werte durchreichen (koennen undefined
  // sein -> Default dann pro Seite).
  var _verfahrenArg = verfahren;      // String | undefined
  var _topologieArg = topologie;      // String | undefined
  var _optimierenArg = optimieren;    // true | undefined/false
  var _zielArg = ziel;                // "summe" | "minimax" | undefined

  // Gemessene Eintraege des aktiven Verfahrens, indexiert nach elIdx.
  var measured = {};
  var active = (typeof FRQ_activeResults === "function") ? FRQ_activeResults() : [];
  for (var k = 0; k < active.length; k++) {
    if (active[k] && active[k].elIdx != null) measured[active[k].elIdx] = active[k];
  }

  // Beidseitige Elektroden-Menge (was der Frequenztest ueberhaupt vergleicht).
  var nL = (typeof sideData !== "undefined" && sideData.left)  ? sideData.left.nEl  : 0;
  var nR = (typeof sideData !== "undefined" && sideData.right) ? sideData.right.nEl : 0;
  var n  = Math.min(nL, nR);

  // Vor-Glaettung der Messwerte (BA475/BA486): seitenweise gesteuert ueber
  // sideData[seite].bandGlaettVerfahren ("aus"|"polynom"|"ortsaffin"). BA502: ortskurve entfernt.
  // Eine Quell-Stelle -> wirkt auf alle Konsumenten (Graph, Tabelle, Warp).
  var _glSeite = (typeof activeSide === "string") ? activeSide : "right";
  var _glVerf = (sideData[_glSeite] && sideData[_glSeite].bandGlaettVerfahren)
    ? sideData[_glSeite].bandGlaettVerfahren : "aus";
  // BA482 (§15.2): measured (roh) bleibt erhalten; die Glaettung liefert eine
  // ZWEITE Reihe measuredGlatt daneben. Verfahren "aus" -> measuredGlatt ==
  // measured (roh). Die konkrete Rechen-Engine waehlt _frqGlaetteMeasured
  // anhand des Verfahrens (BA502: nur noch "ortsaffin" hat eine eigene Engine;
  // "polynom" ist die vereinte Engine, auf die unbekannte Verfahren zurueckfallen).
  var measuredGlatt = (_glVerf !== "aus")
    ? _frqGlaetteMeasured(measured, _glVerf)
    : measured;

  // BA477: "echte Messung" glaettungs-unabhaengig bestimmen. Nach der
  // Vor-Glaettung (§9.5.1) kann measured[i].cent auch fuer eine
  // ungemessene aktive Elektrode gesetzt sein (cent=0 -> geglaettet).
  // Solche Eintraege duerfen NICHT als "gemessen" gelten. Quelle der
  // Wahrheit: die rohen Ergebnisse aus FRQ_activeResults.
  var _echtGemessen = {};
  for (var em = 0; em < active.length; em++) {
    if (active[em] && active[em].elIdx != null && active[em].cent != null) {
      _echtGemessen[active[em].elIdx] = true;
    }
  }

  // BA482 (§15.3/§15.6): eine cent-Reihe -> Seiten-Frequenzen der Form
  // 'gehoert'. EINE Vorzeichen-Wahrheit (FRQ_seitenWerte), fuer roh UND
  // glatt identisch aufgerufen. cent: kanonischer Offset dieser Reihe;
  // resid: seitenloses Residuum (cent) oder null. nomL/nomR: nominelle
  // Frequenz je Seite. Gibt je Seite { hz, shiftCent, shiftHz, resid }.
  // Nur fuer form === "gehoert" verwendet (warp hat eigene bandHz-Logik).
  function _gehoertAusCent(cent, rDown, rUp, rSpan, nomL, nomR) {
    var base = FRQ_seitenWerte(cent, modus);
    var sgn  = _nhSim ? 1 : -1;
    var shL  = sgn * base.csL;
    var shR  = sgn * base.csR;
    var fac  = FRQ_seitenWerte(1, modus);
    function dist(v, f) { return (v != null) ? Math.abs(f) * v : null; }
    return {
      left: {
        hz: nomL * Math.pow(2, shL / 1200),
        shiftCent: shL,
        shiftHz: nomL * Math.pow(2, shL / 1200) - nomL,
        residDown:  dist(rDown, fac.csL),
        residUp:    dist(rUp,   fac.csL),
        restspanne: dist(rSpan, fac.csL)
      },
      right: {
        hz: nomR * Math.pow(2, shR / 1200),
        shiftCent: shR,
        shiftHz: nomR * Math.pow(2, shR / 1200) - nomR,
        residDown:  dist(rDown, fac.csR),
        residUp:    dist(rUp,   fac.csR),
        restspanne: dist(rSpan, fac.csR)
      }
    };
  }

  var out = [];
  for (var i = 0; i < n; i++) {
    var r = measured[i];
    var gemessen = !!_echtGemessen[i];
    var deaktiviert = (FRQ_electrodeStatusBoth(i) !== "testable");
    // BA432 (§9.5): "aktiv" JE SEITE. Nur elActive===false (komplett
    // abgeschaltet) macht die Elektrode auf DIESER Seite nicht existent
    // (Nachbarn ruecken zusammen). Stumm/ausgeschlossen bleiben aktiv ->
    // behalten Band. Seiten getrennt (Nutzer-Beschluss): eine links
    // abgeschaltete Elektrode faellt nur aus der linken Kette.
    // §4.1: aktiv JE SEITE = elActive!==false UND in Frequenzauswahl
    // (elFreqChain!==false). Beide seitengebunden aus sideData.
    var _fcL = sideData.left  ? sideData.left.elFreqChain  : null;
    var _fcR = sideData.right ? sideData.right.elFreqChain : null;
    var aktivL = withSide("left",  function () { return elActive[i] !== false; })
                 && (!_fcL || _fcL[i] !== false);
    var aktivR = withSide("right", function () { return elActive[i] !== false; })
                 && (!_fcR || _fcR[i] !== false);
    // BA509: Residuum-Band + Restspanne live aus dem Rundenverlauf (kein
    // gespeichertes fmResiduum mehr). Gemessen -> echtes Band, sonst null.
    var _rb = (gemessen && typeof _frq_pianoResiduumBand === "function")
      ? _frq_pianoResiduumBand(i) : null;
    var residDown  = _rb ? _rb.residDown  : null;
    var residUp    = _rb ? _rb.residUp    : null;
    var restspanne = _rb ? _rb.restspanne : null;

    // Nominelle (eingetragene) Frequenz je Seite -- keine Messgroesse,
    // existiert immer.
    var nomL = withSide("left",  function () { return FRQ_implantatEffektiv(i); });
    var nomR = withSide("right", function () { return FRQ_implantatEffektiv(i); });

    var left  = { nominellHz: nomL, aktiv: aktivL };
    var right = { nominellHz: nomR, aktiv: aktivR };
    var entry = {
      elIdx: i,
      gemessen: gemessen,
      deaktiviert: deaktiviert,
      left: left,
      right: right
    };

    if (form === "roh") {
      // Dokumentations-Form: kanonischer Offset + Referenzseite (Herkunft) +
      // seitenlose interaurale Unsicherheit.
      entry.cent       = gemessen ? r.cent : null;
      entry.frqRefMode = gemessen ? r.frqRefMode : null;
      entry.residDown  = residDown;
      entry.residUp    = residUp;
      entry.restspanne = restspanne;

    } else if (form === "warp") {
      // WARP-Zweig unveraendert (eigene bandHz-/NH-Sim-Logik, §7.5).
      if (gemessen) {
        var base = FRQ_seitenWerte(r.cent, modus);   // Warp-Richtung { csL, csR }
        var sgnW = _nhSim ? -1 : 1;
        var shLW = sgnW * base.csL;
        var shRW = sgnW * base.csR;
        var facW = FRQ_seitenWerte(1, modus);
        left.residDown  = (residDown  != null) ? Math.abs(facW.csL) * residDown  : null;
        left.residUp    = (residUp    != null) ? Math.abs(facW.csL) * residUp    : null;
        left.restspanne = (restspanne != null) ? Math.abs(facW.csL) * restspanne : null;
        right.residDown  = (residDown  != null) ? Math.abs(facW.csR) * residDown  : null;
        right.residUp    = (residUp    != null) ? Math.abs(facW.csR) * residUp    : null;
        right.restspanne = (restspanne != null) ? Math.abs(facW.csR) * restspanne : null;
        left.cs  = shLW;  right.cs = shRW;
        left.bandHz  = _nhSim ? nomL : nomL * Math.pow(2, -shLW / 1200);
        right.bandHz = _nhSim ? nomR : nomR * Math.pow(2, -shRW / 1200);
      } else {
        left.residDown = null;  left.residUp = null;  left.restspanne = null;
        right.residDown = null; right.residUp = null; right.restspanne = null;
        left.cs = null; right.cs = null;
        left.bandHz = null; right.bandHz = null;
      }

    } else if (form === "gehoert" || form === "klavierGlatt" || form === "klavierBand") {
      // BA482 (§15.3): ZWEI Reihen. gehoertHz (roh) aus dem gemessenen cent,
      // sonst cent 0 (= nominell). gehoertHzGlatt aus der geglaetteten Reihe,
      // auch fuer ungemessene aktive Elektroden. Residuum: gemessen -> echt;
      // ungemessen aktiv -> virtuelles RES_UNGEMESSEN_CT (§15.3).
      var _cin = (gemessen && r && r.cent != null) ? r.cent : 0;   // roh
      var _mg  = measuredGlatt[i];
      var _cgl = (_mg && _mg.cent != null) ? _mg.cent : _cin;      // glatt
      var _rD = gemessen ? residDown  : RES_UNGEMESSEN_CT;
      var _rU = gemessen ? residUp    : RES_UNGEMESSEN_CT;
      var _rS = gemessen ? restspanne : 0;
      var _roh   = _gehoertAusCent(_cin, _rD, _rU, _rS, nomL, nomR);
      var _glatt = _gehoertAusCent(_cgl, _rD, _rU, _rS, nomL, nomR);

      // gehoertHz (roh = Messergebnis) + Verschiebung/Residuum je Seite.
      left.gehoertHz   = _roh.left.hz;
      right.gehoertHz  = _roh.right.hz;
      left.shiftCent   = _roh.left.shiftCent;
      right.shiftCent  = _roh.right.shiftCent;
      left.shiftHz     = _roh.left.shiftHz;
      right.shiftHz    = _roh.right.shiftHz;
      left.residDown    = _roh.left.residDown;
      left.residUp      = _roh.left.residUp;
      left.restspanne   = _roh.left.restspanne;
      right.residDown   = _roh.right.residDown;
      right.residUp     = _roh.right.residUp;
      right.restspanne  = _roh.right.restspanne;

      // gehoertHzGlatt (geglaettet = Bandberechnung/Wiedergabe), §15.4.
      left.gehoertHzGlatt  = _glatt.left.hz;
      right.gehoertHzGlatt = _glatt.right.hz;
      // BA483 (§15.6): geglaettete Verschiebung (cent) je Seite -- Punkt-Hoehe
      // im Glaettungsgraph, damit FRQ_glaettRows nicht selbst rechnen muss.
      left.shiftCentGlatt  = _glatt.left.shiftCent;
      right.shiftCentGlatt = _glatt.right.shiftCent;
    }
    // Unbekannte form: nur die gemeinsame Basis (elIdx, Flags, nominell).

    out.push(entry);
  }

  // BA432 (§9.4): Bandberechnung als Nachlauf fuer 'gehoert' und 'warp'.
  // Mitte = Form-abhaengige Hz (gehoert: gehoertHz; warp: bandHz), sonst nominell.
  // Je Seite getrennt. Ergebnis in entry[seite].bandLoHz/bandHiHz;
  // bei Ueberlauf entry[seite].bandOverlap = true (keine Grenzen).
  if (form === "gehoert" || form === "warp"
      || form === "klavierGlatt" || form === "klavierBand") {
    ["left", "right"].forEach(function (seite) {
      // BA463: seitenweise Band-Wahl (Default aus sideData[seite]).
      var _sW = (typeof sideData !== "undefined") ? sideData[seite] : null;
      var _verfahren = _verfahrenArg
        || (_sW && typeof _sW.bandVerfahren === "string" ? _sW.bandVerfahren : "geometrisch");
      var _topologie = _topologieArg
        || (_sW && typeof _sW.bandTopologie === "string" ? _sW.bandTopologie : "nahtlos");
      // Randverhalten "frei" erzwingt den optimierten Modus (freie
      // Randbestimmung gibt es nur im Optimierer). Der Feldwert
      // bandOptimieren bleibt unberuehrt -- die UI zeigt den Zwang matt.
      var _randVerh = (_sW && typeof _sW.bandRandverhalten === "string")
        ? _sW.bandRandverhalten : "abschneiden";
      var _optimieren = (_optimierenArg === true)
        || (_optimierenArg === undefined && _sW && _sW.bandOptimieren === "optimiert")
        || (_randVerh === "frei");
      var _ziel = (_zielArg === "summe") ? "summe"
        : (_zielArg === "minimax") ? "minimax"
        : (_sW && _sW.bandZiel === "summe" ? "summe" : "minimax");
      // BA453: Statusgewicht je Elektrode SEITENRICHTIG vorab holen (elSt/
      // elExDur sind seitengebunden -> withSide, gleiches Muster wie die
      // feste Wand unten). ell_gWt liegt seit BA453 in core.js. Additiv:
      // nur der kuenftige CBF-Kern liest statusGewicht; die anderen
      // Verfahren ignorieren das Feld (Architektur §4.3).
      var _statusGewichte = withSide(seite, function () {
        var arr = [];
        for (var gi = 0; gi < out.length; gi++) {
          arr[out[gi].elIdx] = ell_gWt(out[gi].elIdx);
        }
        return arr;
      });
      var mitten = out.map(function (entry) {
        var s = entry[seite];
        var hz;
        if (form === "warp") {
          hz = (s && s.bandHz != null) ? s.bandHz : (s ? s.nominellHz : null);
        } else {
          // BA482 (§15.4): Bandmitte folgt der GEGLAETTETEN Frequenz.
          hz = (s && s.gehoertHzGlatt != null) ? s.gehoertHzGlatt
             : (s ? s.nominellHz : null);
        }
        // Aktivitaet JE SEITE (Nutzer-Beschluss): das seitenweise Flag.
        return { elIdx: entry.elIdx, hz: hz, aktiv: !!(s && s.aktiv),
                 // BA513: Bandberechnung nutzt das Residuum als symmetrische
                 // Toleranz -> Bandbreite (residDown+residUp), das gemessene
                 // Streumass ueber den Verlauf. Ungemessene: null -> die
                 // Bandverfahren setzen ihr Ungemessen-Residuum selbst.
                 residuum: (s && s.residDown != null && s.residUp != null)
                   ? (s.residDown + s.residUp) : null,
                 // BA515: Einzel-Kanten fuer die richtungsabhaengige Optimierung.
                 residDown: (s && s.residDown != null) ? s.residDown : null,
                 residUp:   (s && s.residUp   != null) ? s.residUp   : null,
                 gemessen: !!entry.gemessen,
                 statusGewicht: (_statusGewichte[entry.elIdx] != null)
                   ? _statusGewichte[entry.elIdx] : 1 };
      });
      // Sec. 14.6: Optimierung NIE fuer Warp (er summiert Bandpaesse,
      // braucht mittelpunkt-nahtlose Baender, Sec. 13.6a). Nur 'gehoert'.
      var _optHier = (form === "gehoert") && _optimieren;
      // BA462: Bandgrenzen-Wand aus der GEWÄHLTEN, seitengebundenen Wand
      // (sideData[seite].bandWandLo/Hi). BA463: _sW bereits oben gesetzt.
      var _bandWand = null;
      if (_randVerh === "frei") {
        // Randverhalten "frei": KEINE feste Wand. Als Suchraum fuer den
        // Optimierer die aeusserste GEHOERTE Frequenz +-1200 cent (eine
        // Oktave Puffer). Weiter Suchraum engt nie ein (Architektur §5);
        // der Klemm-/Schranken-Schritt wird bei "frei" uebersprungen
        // (Schritt 6/7), daher wirkt die Suchraum-Wand nicht als Grenze.
        var _aktHz = [];
        for (var _mi = 0; _mi < mitten.length; _mi++) {
          if (mitten[_mi] && mitten[_mi].aktiv && mitten[_mi].hz > 0)
            _aktHz.push(mitten[_mi].hz);
        }
        if (_aktHz.length >= 1) {
          var _minHz = Math.min.apply(null, _aktHz);
          var _maxHz = Math.max.apply(null, _aktHz);
          _bandWand = {
            loHz: _minHz * Math.pow(2, -1200 / 1200),   // eine Oktave tiefer
            hiHz: _maxHz * Math.pow(2,  1200 / 1200)     // eine Oktave hoeher
          };
        }
      } else if (_sW && typeof _sW.bandWandLo === "number"
          && typeof _sW.bandWandHi === "number") {
        _bandWand = { loHz: _sW.bandWandLo, hiHz: _sW.bandWandHi };
      } else {
        var _dr = (_sW && MFR[_sW.manufacturer])
          ? MFR[_sW.manufacturer].defaultRange : null;
        _bandWand = (_dr && _dr.length === 2) ? { loHz: _dr[0], hiHz: _dr[1] } : null;
      }
      // BA449: KEINE Range mehr (Sec. 14.5-Korrektur) -- Raender gespiegelt.
      var res = FRQ_baender(mitten, _verfahren, _topologie,
        _optHier, _ziel, null, _bandWand, {
          // BA463: Randausgleich pro Seite aus sideData[seite].
          mitAusgleich: (mitAusgleich !== undefined) ? (mitAusgleich !== false)
            : !(_sW && _sW.bandRandausgleich === "ohne"),
          // BA463: CBF-Achsen pro Seite aus sideData[seite].
          cbfGewicht: (_sW && typeof _sW.bandCbfGewicht === "string") ? _sW.bandCbfGewicht : "ausgewogen",
          // BA472: apikale/basale "Freie Baender"-Achsen (ersetzen Randverhalten).
          cbfApikalFrei: (_sW && _sW.bandCbfApikalFrei != null) ? _sW.bandCbfApikalFrei : 1,
          cbfBasalFrei:  (_sW && _sW.bandCbfBasalFrei  != null) ? _sW.bandCbfBasalFrei  : 1,
          // BA464/465: Sprachbereich-Achse (Feld kommt mit BA465).
          cbfSprache: (_sW && typeof _sW.bandCbfSprache === "string") ? _sW.bandCbfSprache : "mittel",
          // BA524: gemeinsame Rechenraum-Achse (Lage) pro Seite.
          lage: (_sW && typeof _sW.bandLage === "string") ? _sW.bandLage : "geometrisch",
          // BA525: Greenwood-k pro Seite. Als Zahl (Wertetabelle-Lookup).
          k: (function () {
            var v = (_sW && _sW.bandK) ? String(_sW.bandK) : null;
            return (v && FRQ_GLAETT_K_WERTE[v] != null) ? FRQ_GLAETT_K_WERTE[v]
                                                        : FRQ_GLAETT_K_DEFAULT;
          })(),
          // BA526: gemeinsame Randverhalten-Achse pro Seite.
          randverhalten: (_sW && typeof _sW.bandRandverhalten === "string")
            ? _sW.bandRandverhalten : "abschneiden",
          // BA527: gemeinsame Mindestbreite (cent) pro Seite. Als Zahl.
          minBreiteCt: (function () {
            var n = parseInt((_sW && _sW.bandMinBreite) ? _sW.bandMinBreite : "100", 10);
            return (n >= 0) ? n : 100;
          })(),
          // BA518: geteilter Boden (Achse bandGlaettBoden), seitenrichtig.
          boden: _resBodenCt(seite),
        });
      if (res.error) {   // "overlap" ODER "abfTonoZuKlein" (BA450)
        out.forEach(function (entry) {
          if (entry[seite]) {
            entry[seite].bandOverlap = true;
            entry[seite].bandError = res.error;   // BA451: Fehlerart fuer die Meldung
            entry[seite].bandOverlapEls = res.elektroden || [];
            entry[seite].bandLoHz = null;
            entry[seite].bandHiHz = null;
            entry[seite].bandCenterHz = null;   // Sec. 11.4
            entry[seite].bandCenterVorschlagHz = null;   // BA447
          }
        });
      } else {
        var byIdx = {};
        res.bands.forEach(function (b) { byIdx[b.elIdx] = b; });
        out.forEach(function (entry) {
          if (!entry[seite]) return;
          var b = byIdx[entry.elIdx];
          entry[seite].bandOverlap = false;
          entry[seite].bandError = null;   // BA451
          entry[seite].bandOverlapEls = [];
          entry[seite].bandLoHz = b ? b.loHz : null;
          entry[seite].bandHiHz = b ? b.hiHz : null;
          entry[seite].bandCenterHz = b ? b.centerHz : null;   // Sec. 11.4
          entry[seite].bandCenterVorschlagHz =
            (b && b.centerVorschlagHz != null) ? b.centerVorschlagHz : null;  // BA447 Sec.14.5
        });
      }
    });
  }

  // BA507 (§16): Klavier-Formen -- je Elektrode left.hz/right.hz FERTIG.
  // EIN Koerper, quelle = "glatt" (gehoertHzGlatt) | "band" (bandCenterHz).
  // Fallwahl ueber die CI-Zahl (FRQ_implantatGetSource), nicht ueber modus.
  if (form === "klavierGlatt" || form === "klavierBand") {
    var _quelleFeld = (form === "klavierGlatt") ? "gehoertHzGlatt" : "bandCenterHz";
    var _ciSide = (typeof FRQ_implantatGetSource === "function")
      ? FRQ_implantatGetSource() : null;   // "left"|"right"=1 CI, sonst null

    out.forEach(function (entry) {
      var L = entry.left, R = entry.right;
      // Verarbeitete Frequenz je Seite (glatt-gehoert oder Bandmitte).
      var procL = L ? L[_quelleFeld] : null;
      var procR = R ? R[_quelleFeld] : null;
      // Nominelle Frequenz je Seite (immer vorhanden).
      var nomL = L ? L.nominellHz : null;
      var nomR = R ? R.nominellHz : null;

      var hzL = null, hzR = null;

      if (_ciSide === "left" || _ciSide === "right") {
        // EIN CI: verarbeitete CI-Frequenz aufs GESUNDE Ohr (Vertauschung),
        // CI-Seite bekommt Nominal.
        if (_ciSide === "right") {
          hzR = nomR;      // CI-Seite: Nominal
          hzL = procR;     // gesundes Ohr: verarbeitete CI-Frequenz
        } else {           // _ciSide === "left"
          hzL = nomL;
          hzR = procL;
        }
      } else {
        // ZWEI CI: korrigierte Eingangsfrequenz, von Nominal, modus verteilt.
        // centQuelle = cent-Differenz der verarbeiteten Frequenz vs. nominell,
        // je Seite; +cs-Richtung (anheben bei zu tief gehoert).
        // Wir bilden die kanonische cent-Differenz aus der verarbeiteten
        // Frequenz einer Seite und verteilen sie ueber FRQ_seitenWerte.
        // Kanonisch (+cent = rechts tiefer): aus der rechten Seite ablesbar,
        // sonst aus der linken gespiegelt.
        var centKan = null;
        if (procR != null && nomR != null && nomR > 0 && procR > 0) {
          // rechts hoert procR statt nomR -> +cent, wenn procR < nomR (tiefer).
          centKan = 1200 * Math.log(nomR / procR) / Math.log(2);
        } else if (procL != null && nomL != null && nomL > 0 && procL > 0) {
          // links: gespiegelt (+cent = rechts tiefer = links hoeher).
          centKan = 1200 * Math.log(procL / nomL) / Math.log(2);
        }
        if (centKan != null) {
          var cs = FRQ_seitenWerte(centKan, modus);   // { csL, csR } Warp-Richtung
          // +cs: anheben. nom * 2^(+cs/1200).
          hzL = (nomL != null) ? nomL * Math.pow(2, cs.csL / 1200) : null;
          hzR = (nomR != null) ? nomR * Math.pow(2, cs.csR / 1200) : null;
        } else {
          // keine verarbeitete Frequenz -> Nominal (keine Verschiebung).
          hzL = nomL; hzR = nomR;
        }
      }

      if (L) L.hz = (hzL != null && hzL > 0) ? hzL : null;
      if (R) R.hz = (hzR != null && hzR > 0) ? hzR : null;
    });
  }

  return out;
}

const SIDES = ["left", "right"];
const KURVEN_ELL_TYPES = [
  "speech",
  "iso226",
  "volume",
  "tilt",
  "scurve",
  "pivot",
  "gauss",
  "bassboost",
  "highboost",
];
const KURVEN_ELL_NAMES = {
  speech: "kurvenELLSpeech",
  volume: "kurvenELLVolume",
  tilt: "kurvenELLTilt",
  scurve: "kurvenELLScurve",
  pivot: "kurvenELLPivot",
  gauss: "kurvenELLGauss",
  bassboost: "kurvenELLBass",
  highboost: "kurvenELLHigh",
  iso226: "kurvenELLIso226",
};
const KURVEN_ELL_EXPL = {
  speech: "kurvenELLExplSpeech",
  volume: "kurvenELLExplVolume",
  tilt: "kurvenELLExplTilt",
  scurve: "kurvenELLExplScurve",
  pivot: "kurvenELLExplPivot",
  gauss: "kurvenELLExplGauss",
  bassboost: "kurvenELLExplBass",
  highboost: "kurvenELLExplHigh",
  iso226: "kurvenELLExplIso226",
};
const KURVEN_ELL_HAS_CENTER = {
  tilt: true,
  scurve: true,
  pivot: true,
  gauss: true,
  bassboost: false,
  highboost: false,
  speech: false,
  volume: false,
  iso226: false,
};
const KURVEN_ELL_HAS_WIDTH = { gauss: true };
const KURVEN_ELL_HAS_CUTOFF = { bassboost: true, highboost: true };


// SII Band Importance Function (ANSI S3.5-1997)
const SII_THIRD_OCT = {
  freq: [
    160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150,
    4000, 5000, 6300, 8000,
  ],
  wt: [
    0.0083, 0.0095, 0.015, 0.0289, 0.044, 0.0578, 0.0653, 0.0711, 0.0818,
    0.0844, 0.0882, 0.0898, 0.0868, 0.0844, 0.0771, 0.0527, 0.0364, 0.0185,
  ],
};
function siiWeightsForFreqs(fArr) {
  const sf = SII_THIRD_OCT.freq,
    sw = SII_THIRD_OCT.wt,
    n = fArr.length,
    w = [];
  for (let i = 0; i < n; i++) {
    const f = fArr[i];
    if (f <= sf[0]) w.push(sw[0]);
    else if (f >= sf[sf.length - 1]) w.push(sw[sw.length - 1]);
    else {
      let j = 0;
      while (j < sf.length - 1 && sf[j + 1] < f) j++;
      const r =
        (Math.log(f) - Math.log(sf[j])) /
        (Math.log(sf[j + 1]) - Math.log(sf[j]));
      w.push(sw[j] + r * (sw[j + 1] - sw[j]));
    }
  }
  const mx = Math.max(...w);
  return w.map((v) => v / mx);
}

// ISO 226:2003 — Kurven gleicher Lautheit (equal-loudness contours).
// Parameter aus PyDSM (Sergio Callegari), Norm-Daten + publizierte
// Suzuki-Takeshima-Formel (J. Acoust. Soc. Am. 116, 2004).
// Verifiziert: Lp(1000 Hz, L_N phon) == L_N (1-kHz-Definition).
const ISO226_F = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
  630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000,
  10000, 12500,
];
const ISO226_AF = [
  0.532, 0.506, 0.48, 0.455, 0.432, 0.409, 0.387, 0.367, 0.349, 0.33,
  0.315, 0.301, 0.288, 0.276, 0.267, 0.259, 0.253, 0.25, 0.246, 0.244,
  0.243, 0.243, 0.243, 0.242, 0.242, 0.245, 0.254, 0.271, 0.301,
];
const ISO226_LU = [
  -31.6, -27.2, -23.0, -19.1, -15.9, -13.0, -10.3, -8.1, -6.2, -4.5,
  -3.1, -2.0, -1.1, -0.4, 0.0, 0.3, 0.5, 0.0, -2.7, -4.1, -1.0, 1.7,
  2.5, 1.2, -2.1, -7.1, -11.2, -10.7, -3.1,
];
const ISO226_TF = [
  78.5, 68.7, 59.5, 51.1, 44.0, 37.5, 31.5, 26.5, 22.1, 17.9, 14.4,
  11.4, 8.6, 6.2, 4.4, 3.0, 2.2, 2.4, 3.5, 1.7, -1.3, -4.2, -6.0, -5.4,
  -1.5, 6.0, 12.6, 13.9, 12.3,
];

// Schalldruckpegel L_p (dB SPL) an Tabellen-Index j fuer Lautstaerke
// L_N (phon). ISO 226:2003 Abschnitt 4.1.
function _iso226LpAt(j, LN) {
  const af = ISO226_AF[j],
    Tf = ISO226_TF[j],
    Lu = ISO226_LU[j];
  const Af =
    4.47e-3 * (Math.pow(10, 0.025 * LN) - 1.15) +
    Math.pow(0.4 * Math.pow(10, (Tf + Lu) / 10 - 9), af);
  return (10 / af) * Math.log10(Af) - Lu + 94;
}

// Equal-loudness-Gewichte fuer beliebige Frequenzen, RELATIV zu 1000 Hz
// (1 kHz = 0 dB), bei Lautstaerke LN (phon). Log-lineare Interpolation
// zwischen den Tabellen-Stuetzpunkten (wie siiWeightsForFreqs). Rueckgabe
// in echten dB-Differenzen re 1 kHz; KEINE /max-Normierung.
function iso226WeightsForFreqs(fArr, LN) {
  const sf = ISO226_F,
    n = fArr.length,
    out = [];
  // Lp je Stuetzpunkt einmal vorberechnen.
  const lp = sf.map((_, j) => _iso226LpAt(j, LN));
  // Lp bei 1000 Hz (Stuetzpunkt-Index 17) als Referenz.
  const ref = lp[17];
  for (let i = 0; i < n; i++) {
    const f = fArr[i];
    let val;
    if (f <= sf[0]) val = lp[0];
    else if (f >= sf[sf.length - 1]) val = lp[sf.length - 1];
    else {
      let k = 0;
      while (k < sf.length - 1 && sf[k + 1] < f) k++;
      const r =
        (Math.log(f) - Math.log(sf[k])) /
        (Math.log(sf[k + 1]) - Math.log(sf[k]));
      val = lp[k] + r * (lp[k + 1] - lp[k]);
    }
    out.push(val - ref);
  }
  return out;
}

// Versions-Vergleich fuer Save-Format-Migrationen. Vergleicht
// Versionsstrings der Form "<maj>.<min>.<ba>[.<fix>]-beta" numerisch
// (Stelle fuer Stelle), Suffixe wie "-beta" werden ignoriert.
// Rueckgabe: negativ wenn a < b, 0 wenn gleich, positiv wenn a > b.
// Fehlt/unparsebar eine Seite, wird sie als 0.0.0 behandelt.
function _verCmp(a, b) {
  function parse(v) {
    if (typeof v !== "string") return [0, 0, 0, 0];
    const core = v.split("-")[0];            // "0.4.369.1-beta" -> "0.4.369.1"
    const parts = core.split(".").map(function (n) {
      const x = parseInt(n, 10);
      return isNaN(x) ? 0 : x;
    });
    while (parts.length < 4) parts.push(0);
    return parts.slice(0, 4);
  }
  const pa = parse(a), pb = parse(b);
  for (let i = 0; i < 4; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

