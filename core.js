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
const LV_AXIS_MAX = {
  medel: 300,
  cochlear: 255,
  ab: 600,
};
function lvAxisMaxFor(mfrId) {
  return LV_AXIS_MAX[mfrId] || 300;
}
function lvUnitLabelFor(mfrId) {
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
  medel: {
    name: "MED-EL",
    n: 12,
    apFirst: true,
    freqs: [120, 235, 384, 579, 836, 1175, 1624, 2222, 3019, 4084, 5507, 7410],
  },
  ab: {
    name: "Advanced Bionics",
    n: 16,
    apFirst: true,
    freqs: [
      333, 455, 540, 642, 762, 906, 1076, 1278, 1518, 1803, 2142, 2544, 3022,
      3590, 4264, 6665,
    ],
  },
  cochlear: {
    name: "Cochlear",
    n: 22,
    apFirst: false,
    freqs: [
      250, 375, 500, 625, 750, 875, 1000, 1125, 1250, 1500, 1750, 2000, 2250,
      2625, 3000, 3500, 4000, 4625, 5250, 6000, 6875, 8000,
    ],
  },
};
const SIDES = ["left", "right"];
const PR_TYPES = [
  "speech",
  "volume",
  "tilt",
  "scurve",
  "pivot",
  "gauss",
  "bassboost",
  "highboost",
];
const PR_NAMES = {
  speech: "lvPrSpeech",
  volume: "lvPrVolume",
  tilt: "lvPrTilt",
  scurve: "lvPrScurve",
  pivot: "lvPrPivot",
  gauss: "lvPrGauss",
  bassboost: "lvPrBass",
  highboost: "lvPrHigh",
};
const PR_EXPL = {
  speech: "lvPrExplSpeech",
  volume: "lvPrExplVolume",
  tilt: "lvPrExplTilt",
  scurve: "lvPrExplScurve",
  pivot: "lvPrExplPivot",
  gauss: "lvPrExplGauss",
  bassboost: "lvPrExplBass",
  highboost: "lvPrExplHigh",
};
const PR_HAS_CENTER = {
  tilt: true,
  scurve: true,
  pivot: true,
  gauss: true,
  bassboost: false,
  highboost: false,
  speech: false,
  volume: false,
};
const PR_HAS_WIDTH = { gauss: true };
const PR_HAS_CUTOFF = { bassboost: true, highboost: true };


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

