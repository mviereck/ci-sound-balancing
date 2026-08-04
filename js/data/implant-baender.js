// ============================================================
// IMPLANT-BAENDER — Default-Frequenzbaender (lo/hi) je Hersteller
// ============================================================
// Datenquelle: .docs/Herstellerdaten_MEDEL.md / _AB.md / _Cochlear.md
// (belegte Bandgrenzen). Reihenfolge = Speicherreihenfolge in
// MFR[...].FRQ_implantat: Position 0 = niedrigste Hz.
//   MED-EL: Pos 0 = E1 (apikal), 12 Kanaele.
//   AB:     Pos 0 = E1 (apikal), 16 Kanaele, Extended-Low-Default.
//   Cochlear: Pos 0 = E22 (apikal), 22 Kanaele, Standard-FAT 188/7938.
// Aus jedem {lo,hi} folgt die geometrische Mitte sqrt(lo*hi) fuer die
// Messung und die arithmetische (lo+hi)/2 fuer die Anzeige.
// ============================================================
const IMPLANT_BAENDER = {
  medel: [
    { lo: 70,   hi: 170 },
    { lo: 170,  hi: 300 },
    { lo: 300,  hi: 469 },
    { lo: 469,  hi: 690 },
    { lo: 690,  hi: 982 },
    { lo: 982,  hi: 1368 },
    { lo: 1368, hi: 1881 },
    { lo: 1881, hi: 2564 },
    { lo: 2564, hi: 3475 },
    { lo: 3475, hi: 4693 },
    { lo: 4693, hi: 6321 },
    { lo: 6321, hi: 8500 },
  ],
  ab: [
    { lo: 250,  hi: 416 },
    { lo: 416,  hi: 494 },
    { lo: 494,  hi: 587 },
    { lo: 587,  hi: 697 },
    { lo: 697,  hi: 828 },
    { lo: 828,  hi: 983 },
    { lo: 983,  hi: 1168 },
    { lo: 1168, hi: 1387 },
    { lo: 1387, hi: 1648 },
    { lo: 1648, hi: 1958 },
    { lo: 1958, hi: 2326 },
    { lo: 2326, hi: 2762 },
    { lo: 2762, hi: 3281 },
    { lo: 3281, hi: 3898 },
    { lo: 3898, hi: 4630 },
    { lo: 4630, hi: 8700 },
  ],
  // Cochlear Standard-FAT (LFE 188 / HFE 7938), Pos 0 = E22 apikal.
  cochlear: [
    { lo: 188,  hi: 312 },
    { lo: 312,  hi: 438 },
    { lo: 438,  hi: 562 },
    { lo: 562,  hi: 688 },
    { lo: 688,  hi: 812 },
    { lo: 812,  hi: 938 },
    { lo: 938,  hi: 1062 },
    { lo: 1062, hi: 1188 },
    { lo: 1188, hi: 1312 },
    { lo: 1312, hi: 1564 },
    { lo: 1564, hi: 1812 },
    { lo: 1812, hi: 2064 },
    { lo: 2064, hi: 2312 },
    { lo: 2312, hi: 2688 },
    { lo: 2688, hi: 3062 },
    { lo: 3062, hi: 3564 },
    { lo: 3564, hi: 4062 },
    { lo: 4062, hi: 4688 },
    { lo: 4688, hi: 5312 },
    { lo: 5312, hi: 6064 },
    { lo: 6064, hi: 6936 },
    { lo: 6936, hi: 7940 },
  ],
  unknown: [],
};
