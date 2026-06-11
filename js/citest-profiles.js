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
    amDepth:      0.08
  };

  // Diagnose-/Vergleichsvarianten zu CiH (3.2.238.2). Hintergrund: Nutzer
  // berichtet ueber periodische Lautstaerke-Welle ~2.7 Hz im CI bei 3-s-
  // Halttoenen. Unklar ob AGC-Eigenresonanz oder Wechselwirkung mit unserer
  // AM (3.5 Hz). Diese Varianten dienen dem Vergleich:
  // - CiHA: mittlere AM-Tiefe (Anschwingen jetzt global)
  // - CiHS: AM-Frequenz in der beobachteten Welle, hohe AM-Tiefe
  // - CiHF: keine AM ueberhaupt (Diagnose: Welle dann immer noch da -> AGC)
  // BA 270: CiHA war urspruenglich "Attack-stark" (langes Anschwingen +
  // starke AM). Das Anschwingen ist jetzt global einstellbar; uebrig
  // bleibt die mittlere AM-Tiefe (0.18) als Zwischenstufe zwischen
  // CiH (0.08) und CiHS (0.25). Daher umbenannt in "Modulation mittel".
  RICHTONE_PROFILES.CiHA = {
    abbr: 'CiHA',
    label: 'CI-Test Modulation mittel',
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
    amDepth:      0.18
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
    amDepth:      0.25
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
    amDepth:      0
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
    amDepth:      0.08
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
    amDepth:      0
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
    amDepth:      0
  };

  // Diagnose-Variante zur Akkord-Hypothese (0.4.269.1). Hintergrund:
  // Nutzer berichtet, dass bei E5-E9 die CI-Test-Toene akkordartig oder
  // kratzend klingen, waehrend E10 sauber klingt. Hypothese: die
  // Obertoene treffen weitere Elektroden gleichzeitig (Akkord); bei E10
  // liegen alle Obertoene ausserhalb der CI-Filterbank, daher Sinus-
  // aehnliche Wahrnehmung. CiG isoliert das, indem es nur den Grundton
  // synthetisiert — keine Obertoene, die andere Elektroden anregen
  // koennten. Erwartung: E5-E9 klingen dann ebenfalls sauber.
  // Parameter ansonsten wie CiHF (Vibrato, kein AM, Attack 500), damit
  // der Vergleich nur den Partial-Unterschied isoliert.
  RICHTONE_PROFILES.CiG = {
    abbr: 'CiG',
    label: 'CI-Test Grundton',
    partials: [
      { mult: 1, amp: 1.0 }
    ],
    vibratoHz:    5.0,
    vibratoCents: 6.0,
    amHz:         0,
    amDepth:      0
  };

  // Vergleichston zu CiG ohne Vibrato (0.4.269.2). Hintergrund:
  // CiG zeigt bei der defekten E11 einen warble-sinus-aehnlichen
  // Zusatzton, der bei anderen Profilen nicht auftritt. Hypothese A
  // aus Anhang B der Konzept-Doku: das Vibrato wird ohne Obertoene
  // hoerbar (weil keine Partials den Modulationseffekt akustisch
  // verwischen). CiS isoliert das: Grundton ohne Vibrato. Wenn der
  // warble-Effekt verschwindet, ist Vibrato die Ursache.
  // Parameter ansonsten wie CiG (Attack 500 ms, kein AM).
  RICHTONE_PROFILES.CiS = {
    abbr: 'CiS',
    label: 'CI-Test Sinus',
    partials: [
      { mult: 1, amp: 1.0 }
    ],
    vibratoHz:    0,
    vibratoCents: 0,
    amHz:         0,
    amDepth:      0
  };
})();
