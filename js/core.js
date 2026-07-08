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
// Arithmetische (lineare) Mitte zweier Frequenzen (BA440, §11.3).
// Kern des cochlear-Bandverfahrens: Cochlear bildet Baender im linearen
// d0-Vielfachen-Raster, mittelt also arithmetisch statt geometrisch
// (belegt in .docs/Konzept_MAESTRO_Uebertragung.md §5.14).
function arithMitte(a, b) {
  return (a + b) / 2;
}
// Greenwood-Funktion (Cochlea-Position <-> Frequenz), klassische Parameter.
// x in [0,1] = relative Cochlea-Position (0 = apikal/tief, 1 = basal/hoch).
// Grundlage des greenwood-Bandverfahrens (Architektur 00-freqmatch-
// wertquelle-architektur.md Sec. 11, Memo_Bandempfehlung_Greenwood.md).
function greenwoodHz(x) {
  return 165.4 * (Math.pow(10, 2.1 * x) - 0.88);
}
function greenwoodX(hz) {
  return (1 / 2.1) * Math.log10(hz / 165.4 + 0.88);
}
// Bandberechnungs-Verfahren = REINE RECHENRAUM-TRANSFORMATION (BA442,
// §13.2/§13.3). Jeder Eintrag deklariert nur toP (Hz -> Position) und
// fromP (Position -> Hz). Die Grenzsetzung (nahtlos) rechnet der
// gemeinsame Rahmen FRQ_baender EINMAL in Positions-Koordinaten (§13.4);
// dass geometrisch die geom. Mitte und cochlear die arithm. Mitte ergibt,
// faellt automatisch aus toP/fromP. Ein neues Verfahren ist EIN
// Registry-Eintrag (zwei Funktionen), kein if-Zweig (Strukturprinzip 3).
//
// toP MUSS streng monoton steigend sein (Positionsordnung = Frequenz-
// ordnung); das gilt fuer alle drei Raeume (log/greenwood/linear).
var FRQ_bandVerfahren = {
  // Log-Raum: geometrische Mitte = exp(mittel der ln) (§13.4, war §9.2).
  geometrisch: { toP: Math.log,   fromP: Math.exp },
  // Cochlea-Positionsraum (Greenwood): alle Mittelungen linear in x.
  greenwood:   { toP: greenwoodX, fromP: greenwoodHz },
  // Linearer Raum: arithmetische Mitte (Cochlear-d0-Raster, war §11.3).
  cochlear:    { toP: identityHz, fromP: identityHz }
};
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
function _frqDefaultMinBreiteP(toP) {
  var refHz = 1000;
  return Math.abs(toP(refHz * Math.pow(2, FRQ_BAND_MINBREITE_CT / 1200)) - toP(refHz));
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
function FRQ_optimiereGrenzen(P, R, range, ziel, minBreite, lambda) {
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
        dn.push(Math.abs(cen - P[k2]) / R[k2]);
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
//   verfahren = "geometrisch" | "greenwood" | "cochlear"
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

// BA454 (CBF, Architektur 00-cbf-verfahren-architektur.md §5). Startwerte
// fuer den Erstbau, EXPERIMENTELL (spaeter Slider). Benannte Konstanten,
// kein UI ausser den 3 Achsen-Stufen (Folge-BA).
var CBF_LAMBDA = { treffer: 0.2, ausgewogen: 1, breite: 5 };  // Gewichtung-Achse
var CBF_RANDAUSLAUF = { eng: 1, mittel: 2, weich: 3 };        // Randverhalten-Achse (Anzahl El.)
var CBF_RAND_STAERKE = 0.1;   // Treffer-Gewicht der AEUSSERSTEN El. (steigt ueber
                              // die Auslauf-Reichweite auf 1)
var CBF_ITER = 200;           // Loeser-Iterationen (konvex, konvergiert schnell)

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

// BA454 (Architektur §4.2): CBF-Grenzsetzung. EINZIGER Aufrufer ist
// FRQ_baender (verfahren==="cbf"-Weiche). Reine Funktion, kein globaler
// Zustand, kein DOM. Gewichtete Optimierung ueber die Bandkanten in
// log-Frequenz (§3.2): Treffer (Mitte nah an gehoerter Freq) vs. gleiche
// Bandbreite, unter festen Wand-Schranken + Monotonie. Konvex ->
// eindeutiges Minimum (§3.3).
//   kette  Array aktiver El. in Reihenfolge, je { elIdx, hz, statusGewicht }
//          (hz aufsteigend, vom Rahmen geprueft; statusGewicht aus BA453)
//   wand   { loHz, hiHz } feste Herstellerwaende (§4.5)
//   opt    { cbfGewicht, cbfRandverhalten, cbfRandspektrum } (Achsen, Folge-BA;
//          hier mit Defaults abgesichert)
// Rueckgabe: { edges: [k0..kN] } N+1 Bandkanten (Hz) in El.-Reihenfolge.
function FRQ_cbfGrenzen(kette, wand, opt) {
  opt = opt || {};
  var N = kette.length;
  var ln = Math.log, ex = Math.exp;

  // 1. Log-Raum: Ziele t[i], Wand-Schranken.
  var t = kette.map(function (m) { return ln(m.hz); });
  var wLo = ln(wand.loHz), wHi = ln(wand.hiHz);

  // 2. Achsen-Parameter (Defaults, falls opt-Felder fehlen).
  var lam = CBF_LAMBDA[opt.cbfGewicht] != null ? CBF_LAMBDA[opt.cbfGewicht]
          : CBF_LAMBDA.ausgewogen;
  var reach = CBF_RANDAUSLAUF[opt.cbfRandverhalten] != null
          ? CBF_RANDAUSLAUF[opt.cbfRandverhalten] : CBF_RANDAUSLAUF.mittel;
  var vollSpektrum = (opt.cbfRandspektrum === "voll");

  // 3. Gewichte je Elektrode.
  //    g_status = statusGewicht (BA453; stumm=0, verrauscht gestuft, 1).
  //    g_rand   = Randauslauf: aeusserste CBF_RAND_STAERKE, steigt linear
  //               ueber 'reach' El. auf 1 (beide Seiten).
  //    w = g_status * g_rand   (g_sprache=1 im Erstbau)
  //    v = Breiten-Gewicht: 1, aber ~0 fuer stumme (nur erlauben, §2).
  function randFaktor(idx) {
    var dEdge = Math.min(idx, N - 1 - idx);   // Abstand zum naechsten Rand
    if (dEdge >= reach) return 1;
    // linear von CBF_RAND_STAERKE (dEdge=0) auf 1 (dEdge=reach).
    return CBF_RAND_STAERKE + (1 - CBF_RAND_STAERKE) * (dEdge / reach);
  }
  var w = [], v = [];
  for (var i = 0; i < N; i++) {
    var gStat = (kette[i].statusGewicht != null) ? kette[i].statusGewicht : 1;
    w[i] = gStat * randFaktor(i);
    v[i] = (gStat <= 0) ? 0 : 1;   // stumm: nur erlauben, kein Breiten-Zug
  }

  // 4. Fester Breiten-Zielwert bbar = genutzte log-Spanne / N (§3.3,
  //    Nutzer-Wahl). Genutzte Spanne = hoechstes - tiefstes Ziel.
  var bbar = (t[N - 1] - t[0]) / N;
  if (!(bbar > 0)) bbar = (wHi - wLo) / N;   // Absicherung (alle gleich)

  // 5. Startkanten: log-gleichverteilt zwischen den Wand-naechsten
  //    sinnvollen Grenzen. Aeussere je nach Randspektrum fest/frei.
  var x = [];
  for (var k = 0; k <= N; k++) x[k] = wLo + (wHi - wLo) * k / N;
  // Innere naeher an die Ziele ruecken (bessere Startlage):
  for (var s = 1; s < N; s++) x[s] = (t[s - 1] + t[s]) / 2;
  x[0] = wLo; x[N] = wHi;

  // 6. Iterativer koordinatenweiser Loeser mit Projektion (konvex).
  //    Jede innere Kante x[j] (1..N-1) beeinflusst nur Band j-1 und Band j:
  //      Term Treffer:  w[j-1]*(m[j-1]-t[j-1])^2 + w[j]*(m[j]-t[j])^2
  //                     m[j-1]=(x[j-1]+x[j])/2, m[j]=(x[j]+x[j+1])/2
  //      Term Breite:   lam*( v[j-1]*(b[j-1]-bbar)^2 + v[j]*(b[j]-bbar)^2 )
  //                     b[j-1]=x[j]-x[j-1], b[j]=x[j+1]-x[j]
  //    dK/dx[j] = 0 nach x[j] aufgeloest (geschlossen), dann auf
  //    (x[j-1], x[j+1]) projizieren (Monotonie). Aeussere Kanten:
  //    frei mit Wand-Schranke, oder fest bei vollSpektrum.
  function solveInner(j) {
    // Koeffizienten aus dK/dx[j]=0 (quadratisch in x[j], linear in Ableitung).
    // Treffer: d/dx[j][ w[j-1]*((x[j-1]+x[j])/2 - t[j-1])^2 ] = w[j-1]*( (x[j-1]+x[j])/2 - t[j-1] )
    //          d/dx[j][ w[j]  *((x[j]+x[j+1])/2 - t[j])^2 ]   = w[j]*( (x[j]+x[j+1])/2 - t[j] )
    // Breite:  d/dx[j][ lam*v[j-1]*((x[j]-x[j-1]) - bbar)^2 ] = 2*lam*v[j-1]*((x[j]-x[j-1])-bbar)
    //          d/dx[j][ lam*v[j]  *((x[j+1]-x[j]) - bbar)^2 ] = -2*lam*v[j]*((x[j+1]-x[j])-bbar)
    // Summe=0 -> A*x[j] = B. Faktor 1/2 bei Treffer weggekuerzt (beidseitig *2).
    var A = 0.5 * w[j - 1] + 0.5 * w[j] + 2 * lam * v[j - 1] + 2 * lam * v[j];
    var B = 0.5 * w[j - 1] * (2 * t[j - 1] - x[j - 1])
          + 0.5 * w[j]     * (2 * t[j]     - x[j + 1])
          + 2 * lam * v[j - 1] * (x[j - 1] + bbar)
          + 2 * lam * v[j]     * (x[j + 1] - bbar);
    if (A <= 0) return x[j];   // keine Kraft -> unveraendert
    var xj = B / A;
    // Projektion Monotonie (kleiner Sicherheitsabstand eps).
    var eps = 1e-6;
    if (xj < x[j - 1] + eps) xj = x[j - 1] + eps;
    if (xj > x[j + 1] - eps) xj = x[j + 1] - eps;
    return xj;
  }
  for (var it = 0; it < CBF_ITER; it++) {
    for (var j = 1; j < N; j++) x[j] = solveInner(j);
    if (!vollSpektrum) {
      // Aeussere frei, aber Wand als Schranke NICHT ueberschreiten (§3.4).
      // x[0] minimiert Treffer(Band0)+Breite(Band0); einfache Projektion:
      // ziehe x[0] Richtung optimaler Band-0-Lage, deckle an wLo..x[1].
      var eps2 = 1e-6;
      // Band 0: Mitte->t[0], Breite->bbar. Aus dK/dx[0]=0 analog:
      var A0 = 0.5 * w[0] + 2 * lam * v[0];
      var B0 = 0.5 * w[0] * (2 * t[0] - x[1]) - 2 * lam * v[0] * (bbar - x[1]);
      var x0 = (A0 > 0) ? B0 / A0 : x[0];
      if (x0 < wLo) x0 = wLo;                 // Wand nicht ueberschreiten
      if (x0 > x[1] - eps2) x0 = x[1] - eps2; // Monotonie
      x[0] = x0;
      var An = 0.5 * w[N - 1] + 2 * lam * v[N - 1];
      var Bn = 0.5 * w[N - 1] * (2 * t[N - 1] - x[N - 1])
             + 2 * lam * v[N - 1] * (x[N - 1] + bbar);
      var xn = (An > 0) ? Bn / An : x[N];
      if (xn > wHi) xn = wHi;
      if (xn < x[N - 1] + eps2) xn = x[N - 1] + eps2;
      x[N] = xn;
    } else {
      x[0] = wLo; x[N] = wHi;   // volles Spektrum: aeussere fest an die Waende
    }
  }

  // 7. Zurueck in Hz.
  var edges = x.map(function (xi) { return ex(xi); });
  return { edges: edges };
}

// Bewertungsstufe einer Frequenz-Abweichung (cent) gegen ihr Residuum.
// Zentrale Quelle fuer Graph-Farbe UND Tabellen-Farbe -- vorher 3x
// dupliziert (Bandgraph-Row, Bandtabelle, chart.js farbeFuer).
// ueber = wieviel die Abweichung das Residuum ueberschreitet.
//   ueber <= 0            -> "gruen" (im Rauschen)
//   ueber <= Schwelle     -> "amber" (leicht)
//   sonst                 -> "rot"   (deutlich)
function FRQ_bewertungsStufe(devCent, resid) {
  var r = (resid != null && resid > 0) ? resid : 0;
  var ueber = Math.abs(devCent) - r;
  if (ueber <= 0) return "gruen";
  if (typeof FRQ_bandEmpfSchwelleCent === "number"
      && ueber <= FRQ_bandEmpfSchwelleCent) return "amber";
  return "rot";
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
  var vf = _keinRegistry ? null : FRQ_bandVerfahren[verfahren || "geometrisch"];
  if (!_keinRegistry && (!vf || typeof vf.toP !== "function" || typeof vf.fromP !== "function"))
    return { error: "unknownVerfahren", verfahren: verfahren };
  var topo = _keinRegistry ? null : FRQ_bandTopologie[topologie || "nahtlos"];
  if (!_keinRegistry && typeof topo !== "function")
    return { error: "unknownTopologie", topologie: topologie };

  // Nur aktive Elektroden bilden die Kette (nicht aktive: Nachbarn
  // ruecken zusammen).
  var kette = [];
  for (var i = 0; i < mitten.length; i++) {
    if (mitten[i] && mitten[i].aktiv && mitten[i].hz != null) {
      kette.push(mitten[i]);
    }
  }
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
    var RES_BODEN_CT = 5;        // Boden gegen 0 (E9 hat Residuum 0)
    var RES_UNGEMESSEN_CT = 1200;  // weiches Ziel
    var Ropt = [];
    for (var ri = 0; ri < kette.length; ri++) {
      var mObj = kette[ri];
      var resCt = mObj.gemessen
        ? Math.max(RES_BODEN_CT, (mObj.residuum != null ? mObj.residuum : RES_BODEN_CT))
        : RES_UNGEMESSEN_CT;
      var hzUp = kette[ri].hz * Math.pow(2, resCt / 1200);
      var rp = Math.abs(toP(hzUp) - toP(kette[ri].hz));
      if (!(rp > 0)) rp = 1e-6;
      Ropt.push(rp);
    }
    var _minBreite = (opt && opt.minBreite != null) ? opt.minBreite
      : _frqDefaultMinBreiteP(toP);
    var _lambda = (opt && opt.lambda != null) ? opt.lambda : FRQ_BAND_LAMBDA;
    // BA449: KEINE Hersteller-Range mehr (ueberbestimmte das System,
    // Sec. 14.5-Korrektur). Raender werden gespiegelt (range=null).
    var sOpt = FRQ_optimiereGrenzen(P, Ropt, null,
      (ziel === "summe" ? "summe" : "minimax"), _minBreite, _lambda);
    var edgesOpt = _frqEdges(P, sOpt, null);
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

  var bands = [];
  for (var e = 0; e < kette.length; e++) {
    var loP = pairs[e].loP, hiP = pairs[e].hiP;
    var lo = fromP(loP), hi = fromP(hiP);
    var centerHz = fromP((loP + hiP) / 2);
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
  // Default/'right'
  return { csL: 0, csR: c };
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

  // BA445: Default-Achsen = global gewaehlte Zustaende (Architektur Sec.
  // 11.5 / 13.6 Fortschreibung). Explizites Argument gewinnt (Override).
  // typeof-Guards, falls die Zustaende (freq-warp.js) zur Aufrufzeit noch
  // nicht existieren -> die alten festen Defaults als sicherer Fallback.
  var _verfahren = verfahren
    || ((typeof FRQ_bandVerfahrenWahl === "string") ? FRQ_bandVerfahrenWahl : "geometrisch");
  var _topologie = topologie
    || ((typeof FRQ_bandTopologieWahl === "string") ? FRQ_bandTopologieWahl : "nahtlos");
  // BA447 (Sec. 14.6): Optimierung als eigene Achse. Explizites Argument
  // gewinnt; Default hier FALSE (die globale Wahl + UI kommt in BA448).
  // ziel Default "minimax".
  var _optimieren = (optimieren === true);
  var _ziel = (ziel === "summe") ? "summe" : "minimax";

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

  // DEBUG-Testoption (Martin): "Standardwerte als Messergebnis". Bei aktivem
  // Flag jede Elektrode als GEMESSEN mit cent=0 behandeln -> voller Messpfad,
  // gehoertHz = nominellHz * 2^0 = nominelle Implantat-Frequenz. Ueberschreibt
  // echte Messwerte fuer die Dauer des Aufrufs. EINE Quell-Stelle -> wirkt auf
  // alle Konsumenten (Graph, Tabelle, Warp, ...).
  if ((typeof FRQ_testDefaultFrequenzen !== "undefined") && FRQ_testDefaultFrequenzen === true) {
    measured = {};
    for (var di = 0; di < n; di++) {
      measured[di] = { elIdx: di, cent: 0, frqRefMode: "symmetric",
                       fmResiduum: null, fmStatus: "piano" };
    }
  }

  var out = [];
  for (var i = 0; i < n; i++) {
    var r = measured[i];
    var gemessen = !!(r && r.cent != null);
    var deaktiviert = (FRQ_electrodeStatusBoth(i) !== "testable");
    // BA432 (§9.5): "aktiv" JE SEITE. Nur elActive===false (komplett
    // abgeschaltet) macht die Elektrode auf DIESER Seite nicht existent
    // (Nachbarn ruecken zusammen). Stumm/ausgeschlossen bleiben aktiv ->
    // behalten Band. Seiten getrennt (Nutzer-Beschluss): eine links
    // abgeschaltete Elektrode faellt nur aus der linken Kette.
    var aktivL = withSide("left",  function () { return elActive[i] !== false; });
    var aktivR = withSide("right", function () { return elActive[i] !== false; });
    // Residuum (Mess-Unsicherheit in cent) aus dem fRes-Eintrag; null, wenn
    // kein Eintrag. Formabhaengig ausgegeben: roh seitenlos (entry.residuum),
    // warp/gehoert pro Seite verteilt wie die Verschiebung (s.u.).
    var residuum = r ? (r.fmResiduum != null ? r.fmResiduum
                       : (r.fmResidual != null ? r.fmResidual : null)) : null;

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
      entry.residuum   = residuum;

    } else if (form === "warp" || form === "gehoert") {
      if (gemessen) {
        var base = FRQ_seitenWerte(r.cent, modus);   // Warp-Richtung { csL, csR }
        // nhSim -> form-eigene Richtung (die EINE Vorzeichen-Wahrheit):
        //   gehoert: nhSim aus = gehoerte/Korrektur-Richtung (sgn -1);
        //            nhSim an  = um die nominelle Frequenz gespiegelt (sgn +1).
        //   warp:    nhSim aus = Vorhalt/Korrektur (sgn +1);
        //            nhSim an  = Verzerrungs-Simulation (sgn -1).
        var sgn = (form === "warp")
          ? (_nhSim ? -1 : 1)
          : (_nhSim ? 1 : -1);
        var shL = sgn * base.csL;
        var shR = sgn * base.csR;
        // Residuum folgt DERSELBEN Seitenverteilung wie die Verschiebung:
        // unverschobene Seite 0, volle Seite voll, symmetrisch je zur Haelfte.
        // Verteilungsfaktor je Seite = |Seitenanteil| (aus FRQ_seitenWerte).
        var fac = FRQ_seitenWerte(1, modus);
        left.residuum  = (residuum != null) ? Math.abs(fac.csL) * residuum : null;
        right.residuum = (residuum != null) ? Math.abs(fac.csR) * residuum : null;
        if (form === "warp") {
          left.cs  = shL;
          right.cs = shR;
          // BA427: Bandmitte = Quell-Frequenz des Warps (Abgreifpunkt im
          // Original-Audio). NH-Sim aus -> gehoerte Frequenz
          // (nominell * 2^(-cs/1200)); NH-Sim an -> nominelle Frequenz selbst.
          left.bandHz  = _nhSim ? nomL : nomL * Math.pow(2, -shL / 1200);
          right.bandHz = _nhSim ? nomR : nomR * Math.pow(2, -shR / 1200);
        } else {
          left.shiftCent  = shL;
          right.shiftCent = shR;
          left.gehoertHz  = nomL * Math.pow(2, shL / 1200);
          right.gehoertHz = nomR * Math.pow(2, shR / 1200);
          left.shiftHz    = left.gehoertHz  - nomL;
          right.shiftHz   = right.gehoertHz - nomR;
        }
      } else {
        // Ungemessen -> Null fuer Mess-abgeleitete Groessen (nominell bleibt).
        left.residuum = null; right.residuum = null;
        if (form === "warp") {
          left.cs = null; right.cs = null;
          left.bandHz = null; right.bandHz = null;
        } else {
          left.shiftCent = null;  right.shiftCent = null;
          left.gehoertHz = null;  right.gehoertHz = null;
          left.shiftHz   = null;  right.shiftHz   = null;
        }
      }
    }
    // Unbekannte form: nur die gemeinsame Basis (elIdx, Flags, nominell).

    out.push(entry);
  }

  // BA432 (§9.4): Bandberechnung als Nachlauf fuer 'gehoert' und 'warp'.
  // Mitte = Form-abhaengige Hz (gehoert: gehoertHz; warp: bandHz), sonst nominell.
  // Je Seite getrennt. Ergebnis in entry[seite].bandLoHz/bandHiHz;
  // bei Ueberlauf entry[seite].bandOverlap = true (keine Grenzen).
  if (form === "gehoert" || form === "warp") {
    ["left", "right"].forEach(function (seite) {
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
          hz = (s && s.gehoertHz != null) ? s.gehoertHz : (s ? s.nominellHz : null);
        }
        // Aktivitaet JE SEITE (Nutzer-Beschluss): das seitenweise Flag.
        return { elIdx: entry.elIdx, hz: hz, aktiv: !!(s && s.aktiv),
                 residuum: (s ? s.residuum : null),
                 gemessen: !!entry.gemessen,
                 statusGewicht: (_statusGewichte[entry.elIdx] != null)
                   ? _statusGewichte[entry.elIdx] : 1 };
      });
      // Sec. 14.6: Optimierung NIE fuer Warp (er summiert Bandpaesse,
      // braucht mittelpunkt-nahtlose Baender, Sec. 13.6a). Nur 'gehoert'.
      var _optHier = (form === "gehoert") && _optimieren;
      // BA462: Bandgrenzen-Wand aus der GEWÄHLTEN, seitengebundenen Wand
      // (sideData[seite].bandWandLo/Hi). Ersetzt die feste defaultRange-Quelle
      // (BA450). Fehlt eine Wahl (unknown / Alt-Zustand) -> Fallback auf
      // defaultRange, damit ABF/CBF nicht schlechter werden. mfr/sideData
      // sind seitengebunden -> SEITENRICHTIG lesen (kein withSide nötig, da
      // wir direkt sideData[seite] adressieren).
      var _bandWand = null;
      var _sSeite = (typeof sideData !== "undefined") ? sideData[seite] : null;
      if (_sSeite && typeof _sSeite.bandWandLo === "number"
          && typeof _sSeite.bandWandHi === "number") {
        _bandWand = { loHz: _sSeite.bandWandLo, hiHz: _sSeite.bandWandHi };
      } else {
        var _dr = (_sSeite && MFR[_sSeite.manufacturer])
          ? MFR[_sSeite.manufacturer].defaultRange : null;
        _bandWand = (_dr && _dr.length === 2) ? { loHz: _dr[0], hiHz: _dr[1] } : null;
      }
      // BA449: KEINE Range mehr (Sec. 14.5-Korrektur) -- Raender gespiegelt.
      var res = FRQ_baender(mitten, _verfahren, _topologie,
        _optHier, _ziel, null, _bandWand, {
          mitAusgleich: (mitAusgleich !== false),
          // BA454: CBF-Achsen (UI folgt). Guards, falls Zustaende fehlen ->
          // Defaults greifen in FRQ_cbfGrenzen.
          cbfGewicht: (typeof FRQ_bandCbfGewichtWahl === "string") ? FRQ_bandCbfGewichtWahl : "ausgewogen",
          cbfRandverhalten: (typeof FRQ_bandCbfRandverhaltenWahl === "string") ? FRQ_bandCbfRandverhaltenWahl : "mittel",
          cbfRandspektrum: (typeof FRQ_bandCbfRandspektrumWahl === "string") ? FRQ_bandCbfRandspektrumWahl : "frei"
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

