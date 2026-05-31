// ============================================================
// COCHLEAR FAT — Standard-Frequency-Allocation-Tables
// ============================================================
// Datenquelle: CI Select App Manual (NYU Langone, Svirsky-Labor),
// S. 12/13 (Standard-FAT 22 Kanäle, LFE 188 Hz, HFE 7938 Hz).
// Recherche-Notiz: .manuals/Recherche_CI_Select_App.md.
//
// Indexierung im Array entspricht der Speicherung in
// MFR.cochlear.freqs (core.js): Position 0 = niedrigste Hz
// (apikalste Elektrode in der UI: E22), Position 21 = höchste
// Hz (basalste Elektrode: E1). Verwendet ausschließlich für die
// Plausibilitätsprüfung in implant-validate.js — Audio-Pfad
// und Berechnungen nutzen weiter MFR.cochlear.freqs.
//
// Seit BA 136: Werte stimmen mit MFR.cochlear.freqs (core.js)
// überein. Die Datei bleibt als eigenständige Quelle erhalten,
// weil sie in BA 137 ff. um weitere Tabellen (reduzierte
// Elektrodenzahlen, alternative LFE/HFE) erweitert wird, die
// in MFR nicht abgebildet sind.
//
// Erweiterungen (alternative LFE/HFE-Kombinationen, reduzierte
// Elektrodenzahlen für die Deaktivierungs-Sonderprüfung) folgen
// in BA 137 ff.
// ============================================================

const COCHLEAR_FATS = {
  // Standard, alle 22 Kanäle aktiv, LFE 188 Hz, HFE 7938 Hz.
  standard_22_lfe188_hfe7938: [
    250, 375, 500, 625, 750, 875, 1000, 1125, 1250,
    1438, 1688, 1938, 2188, 2500, 2875, 3313, 3813,
    4375, 5000, 5688, 6500, 7438
  ]
};
