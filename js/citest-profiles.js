// CI-Testton-Profile, ergaenzt RICHTONE_PROFILES (richtone-profiles.js).
// Zweck: bewusst fuer CI-Messungen designte Stimuli — konstante Klangfarbe
// ueber den ganzen Mess-Frequenzbereich, sanftes Anschwingen (kein
// Trommelschlag-Onset), subtile zeitliche Modulation gegen CI-AGC-
// Stationaritaetsartefakte.
//
// Anders als die 14 Instrumenten-Imitationen aus richtone-profiles.js
// (die echte Instrumenten-Spektren nachbauen) haben diese Profile feste,
// frequenz-unabhaengige Amplitudenverhaeltnisse zwischen den Partials.
// Engine ist dieselbe (playRichToneProfile in audio.js), daher Praefix
// "rich" im toneType-Schluessel.
//
// CiH = harmonisch (ganzzahlige Partials), CiB = leicht inharmonisch
// (Partial-Multiplikatoren minimal verstimmt, Glocken-aehnlich; gibt
// Streuung in der CI-Filterbank ohne Pitch-Verlust).
(function () {
  if (typeof RICHTONE_PROFILES === 'undefined') return;

  RICHTONE_PROFILES.CiH = {
    abbr: 'CiH',
    label: 'CI-Testton harmonisch',
    partials: [
      { mult: 1, amp: 1.0  },
      { mult: 2, amp: 0.5  },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 6.0,
    amHz:         3.5,
    amDepth:      0.08,
    attackMs:     250
  };

  // Diagnose-/Vergleichsvarianten zu CiH (3.2.238.2). Hintergrund: Nutzer
  // berichtet ueber periodische Lautstaerke-Welle ~2.7 Hz im CI bei 3-s-
  // Halttoenen. Unklar ob AGC-Eigenresonanz oder Wechselwirkung mit unserer
  // AM (3.5 Hz). Diese Varianten dienen dem Vergleich:
  // - CiHA: laengeres Anschwingen + staerkere AM
  // - CiHS: AM-Frequenz in der beobachteten Welle, hohe AM-Tiefe
  // - CiHF: keine AM ueberhaupt (Diagnose: Welle dann immer noch da -> AGC)
  RICHTONE_PROFILES.CiHA = {
    abbr: 'CiHA',
    label: 'CI-Test Attack-stark',
    partials: [
      { mult: 1, amp: 1.0  },
      { mult: 2, amp: 0.5  },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 6.0,
    amHz:         3.5,
    amDepth:      0.18,
    attackMs:     600
  };

  RICHTONE_PROFILES.CiHS = {
    abbr: 'CiHS',
    label: 'CI-Test AM-langsam',
    partials: [
      { mult: 1, amp: 1.0  },
      { mult: 2, amp: 0.5  },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 6.0,
    amHz:         2.7,
    amDepth:      0.25,
    attackMs:     500
  };

  RICHTONE_PROFILES.CiHF = {
    abbr: 'CiHF',
    label: 'CI-Test flach (Diagnose)',
    partials: [
      { mult: 1, amp: 1.0  },
      { mult: 2, amp: 0.5  },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 6.0,
    amHz:         0,
    amDepth:      0,
    attackMs:     500
  };

  RICHTONE_PROFILES.CiB = {
    abbr: 'CiB',
    label: 'CI-Testton inharmonisch',
    partials: [
      { mult: 1.000, amp: 1.0  },
      { mult: 2.005, amp: 0.5  },
      { mult: 3.011, amp: 0.33 },
      { mult: 4.019, amp: 0.25 },
      { mult: 5.028, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 5.0,
    amHz:         3.5,
    amDepth:      0.08,
    attackMs:     250
  };

  // Weitere Diagnose-Varianten (3.2.239.2). Nutzer-Test mit CiHF zeigte:
  // Unsere AM ist Welle-Treiber, AGC ist NICHT eigenresonant. AM weglassen
  // = ruhigster Klang. Offen: traegt Vibrato (Frequenzmodulation) auch zur
  // Welle bei? Und: ist die staerkere Welle bei CiB (vs. CiH) wirklich
  // durch Inharmonik bedingt, oder nur durch dieselbe AM auf rauherem
  // Spektrum?
  //
  // CiP: harmonisch + komplett still — kein AM, kein Vibrato. Pruefung
  //   ob Vibrato die Welle weiter reduziert.
  // CiBF: inharmonisch + AM=0 (Vibrato bleibt). Isoliert die Inharmonik
  //   gegen die AM-Wirkung.
  RICHTONE_PROFILES.CiP = {
    abbr: 'CiP',
    label: 'CI-Testton pur',
    partials: [
      { mult: 1, amp: 1.0  },
      { mult: 2, amp: 0.5  },
      { mult: 3, amp: 0.33 },
      { mult: 4, amp: 0.25 },
      { mult: 5, amp: 0.2  }
    ],
    vibratoHz:    0,
    vibratoCents: 0,
    amHz:         0,
    amDepth:      0,
    attackMs:     250
  };

  RICHTONE_PROFILES.CiBF = {
    abbr: 'CiBF',
    label: 'CI-Testton inharmonisch flach',
    partials: [
      { mult: 1.000, amp: 1.0  },
      { mult: 2.005, amp: 0.5  },
      { mult: 3.011, amp: 0.33 },
      { mult: 4.019, amp: 0.25 },
      { mult: 5.028, amp: 0.2  }
    ],
    vibratoHz:    5.0,
    vibratoCents: 5.0,
    amHz:         0,
    amDepth:      0,
    attackMs:     250
  };
})();
