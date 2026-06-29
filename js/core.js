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
    FRQ_implantat: [],
  },
  medel: {
    name: "MED-EL",
    n: 12,
    apFirst: true,
    FRQ_implantat: [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410],
  },
  ab: {
    name: "Advanced Bionics",
    n: 16,
    apFirst: true,
    FRQ_implantat: [
      333, 455, 540, 642, 762, 906, 1076, 1278, 1518, 1803, 2142, 2544, 3022,
      3590, 4264, 6665,
    ],
  },
  cochlear: {
    name: "Cochlear",
    n: 22,
    apFirst: false,
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
// Datum der Cochlear-FAT-Default-Korrektur (BA 136).
// Vergleichsmaßstab für FRQ_resultsArray-Einträge: Einträge mit
// timestamp < diesem Wert wurden vor der Korrektur gemessen
// und beziehen sich auf eine abweichende Default-Annahme
// (HFE 8000 statt 7938 Hz). Wird in freqmatch.js für die
// Info-Box-Anzeige gelesen.
const COCHLEAR_FAT_CORRECTION_DATE = Date.UTC(2026, 4, 31); // 2026-05-31 UTC
// ============================================================
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
// cent-Konvention: +cent = rechtes Ohr hoeher (= linkes Ohr tiefer).
// ============================================================

// Wandelt den gemessenen Roh-Offset (pse, in der Mess-Konvention
// "refHz = varHz * 2^(pse/1200)") in den kanonischen cent.
// Herleitung (am Mess-Code belegt, BA 414):
//   frqRefMode 'left'      (var=links,  ref=rechts): pse>0 => rechts hoeher => +pse
//   frqRefMode 'right'     (var=rechts, ref=links):  pse>0 => links  hoeher => -pse
//   frqRefMode 'symmetric' (rechts +offset/2, links -offset/2): pse>0 => rechts hoeher => +pse
function FRQ_canonicalCent(frqRefMode, rawOffset) {
  var c = (typeof rawOffset === "number" && isFinite(rawOffset)) ? rawOffset : 0;
  return (frqRefMode === "right") ? -c : c;
}

// Verteilt den KANONISCHEN cent nach der Player-Einstellung warpMode
// auf die beiden Seiten. Rueckgabe { csL, csR } = Cent-Shift links/rechts.
// Braucht KEINEN testmode (Mess-Herkunft ist im kanonischen cent
// bereits aufgeloest). cent>0 = rechts hoeher.
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

