// ============================================================
// TONE-POPUP — Modaler Dialog "Tonart waehlen"
// ============================================================
// Aus js/test-ui.js (BA 209/217/225/226) ausgelagert in BA 227,
// damit die Tonauswahl auch ausserhalb der testUI nutzbar ist
// (geplante Verwendung: Implantat-Tab, spaetere Mess-Verfahren).
//
// Exportiert ins globale Scope:
//   openToneSelectionDialog(cfg, onChange)
//
// cfg-Felder:
//   getToneType()         -> aktueller toneType-String
//   setToneType(tt)       -> uebernimmt neuen toneType
//   getVolume()           -> Vorspiel-Lautstaerke (0..1)
//   getPreviewSequence()  -> Array von {hz,pan,durationMs} oder
//                            {pauseMs}-Steps fuer den Vorspiel-Klick
//   titleKey              -> i18n-Key fuer den Modal-Titel, optional;
//                            Default 'tonePopupTitle' ("Einstellungen
//                            Testton")
//   hintKey               -> i18n-Key fuer allgemeinen Intro-Text
//                            (gelbe Box ganz oben), optional
//   extraHintKey          -> i18n-Key fuer reiterspezifische
//                            Zusatz-Hinweis-Box direkt unter der
//                            ersten (gleiches Styling), optional
//   persistentHintKey     -> i18n-Key fuer einen DAUERHAFT sichtbaren
//                            (auch ohne Debug) reiterspezifischen
//                            Hinweis, optional. Steht direkt unter dem
//                            universellen Lautstaerke-Hinweis. (BA 298)
//
// Modal-Aufbau: GROUPS-Konstante mit allen Tonart-Gruppen (Sinus,
// Komplex, Rich-Profile, Noise, Mellotron). Pro Item ein Radio-
// Button, Label und ein Vorspiel-Knopf rechts mit Sanduhr-Span
// (BA 226: Sanduhr ist 4. Grid-Spalte, eigenstaendig, sichtbar
// per visibility:visible/hidden ohne Layout-Shift).
//
// Interne Helfer (vor `openToneSelectionDialog` definiert,
// als function declarations damit sie ueberall im Modul greifen):
//   _playPreview(toneType)             — Vorspiel-Sequenz starten
//   _setToneButtonsDisabled(flag)      — alle Vorspiel-Knoepfe sperren
//
// Die Helfer haengen aktuell als innere Funktionen in
// _openToneTypeDialog (Closure ueber `dlg`, `playing`, `cfg`).
// Beim Verschieben in tone-popup.js bleiben sie innere Funktionen
// von openToneSelectionDialog — die Closure-Logik bleibt erhalten,
// damit `dlg` und `playing` weiterhin pro Modal-Instanz frisch
// sind.

// BA 209 + 217: Modal-Dialog 'Tonart waehlen'.
// BA 217: Gruppen-Struktur mit kurzen Beschreibungen pro Tonart.
//         Eigene Vibrato-Staerke-Reihe (0/25/50/75/100 %) ueber der
//         Instrumenten-Gruppe; wirkt auf alle richXX-Profile, nicht
//         auf richTone-Basis. Instrumente mit Profil-Vibrato bekommen
//         hinter dem Namen kursiv "(Vibrato)".
// BA 231: GROUPS in Datei-Scope gezogen, damit window.toneTypeI18nKey
// darauf zugreifen kann.
var GROUPS = [
  {
    headKey: 'toneGroupSine',
    hintKey: 'toneGroupSineHint',
    items: [
      ['sine',          'toneSine',          'toneSineDesc'],
      ['amSine',        'toneAmSine',        'toneAmSineDesc'],
      ['burstSine',     'toneBurstSine',     'toneBurstSineDesc'],
      ['warbleSine',    'toneWarbleSine',    'toneWarbleSineDesc'],
      ['wobbleSweep',   'toneWobbleSweep',   'toneWobbleSweepDesc']
    ]
  },
  {
    headKey: 'toneGroupCiTest',
    hintKey: 'toneGroupCiTestHint',
    items: [
      ['richCiHF', 'toneRichCiHF', 'toneRichCiHFDesc'],
      ['richCiG',  'toneRichCiG',  'toneRichCiGDesc'],
      ['richCiS',  'toneRichCiS',  'toneRichCiSDesc'],
      ['richCiH',  'toneRichCiH',  'toneRichCiHDesc'],
      ['richCiP',  'toneRichCiP',  'toneRichCiPDesc'],
      ['richCiB',  'toneRichCiB',  'toneRichCiBDesc'],
      ['richCiBF', 'toneRichCiBF', 'toneRichCiBFDesc'],
      ['richCiHA', 'toneRichCiHA', 'toneRichCiHADesc'],
      ['richCiHS', 'toneRichCiHS', 'toneRichCiHSDesc']
    ]
  },
  {
    headKey: 'toneGroupComplex',
    hintKey: 'toneGroupComplexHint',
    items: [
      ['complex',       'toneComplex',       'toneComplexDesc'],
      ['pulsedComplex', 'tonePulsedComplex', 'tonePulsedComplexDesc'],
      ['richTone',      'toneRichTone',      'toneRichToneDesc']
    ]
  },
  {
    headKey: 'toneGroupRich',
    hintKey: 'toneGroupRichHint',
    items: [
      ['richAcc',   'toneRichAcc',   'toneRichAccDesc'],
      ['richASax',  'toneRichASax',  'toneRichASaxDesc'],
      ['richBTb',   'toneRichBTb',   'toneRichBTbDesc'],
      ['richVa',    'toneRichVa',    'toneRichVaDesc'],
      ['richBn',    'toneRichBn',    'toneRichBnDesc'],
      ['richClBb',  'toneRichClBb',  'toneRichClBbDesc'],
      ['richCb',    'toneRichCb',    'toneRichCbDesc'],
      ['richOb',    'toneRichOb',    'toneRichObDesc'],
      ['richTbn',   'toneRichTbn',   'toneRichTbnDesc'],
      ['richFl',    'toneRichFl',    'toneRichFlDesc'],
      ['richTpC',   'toneRichTpC',   'toneRichTpCDesc'],
      ['richVn',    'toneRichVn',    'toneRichVnDesc'],
      ['richVc',    'toneRichVc',    'toneRichVcDesc'],
      ['richHn',    'toneRichHn',    'toneRichHnDesc']
    ]
  },
  {
    headKey: 'toneGroupNoise',
    hintKey: 'toneGroupNoiseHint',
    items: [
      ['noise',         'toneNoise',         'toneNoiseDesc'],
      ['noiseAdaptive', 'toneNoiseAdaptive', 'toneNoiseAdaptiveDesc'],
      ['irn',           'toneIRN',           'toneIRNDesc']
    ]
  },
  {
    headKey: 'toneGroupExperimental',
    hintKey: 'toneGroupExperimentalHint',
    items: [
      ['richCiGVL', 'toneRichCiGVL', 'toneRichCiGVLDesc'],
      ['richCiGVN', 'toneRichCiGVN', 'toneRichCiGVNDesc'],
      ['richCiGVS', 'toneRichCiGVS', 'toneRichCiGVSDesc'],
      ['richCiGA1', 'toneRichCiGA1', 'toneRichCiGA1Desc'],
      ['richCiGA2', 'toneRichCiGA2', 'toneRichCiGA2Desc'],
      ['richCiGB',  'toneRichCiGB',  'toneRichCiGBDesc'],
      ['richCiGD1', 'toneRichCiGD1', 'toneRichCiGD1Desc'],
      ['richCiGD2', 'toneRichCiGD2', 'toneRichCiGD2Desc'],
      ['richCiGT50', 'toneRichCiGT50', 'toneRichCiGT50Desc'],
      ['richCiGT10', 'toneRichCiGT10', 'toneRichCiGT10Desc'],
      ['richCiGV20', 'toneRichCiGV20', 'toneRichCiGV20Desc'],
      ['richCiGVT4', 'toneRichCiGVT4', 'toneRichCiGVT4Desc'],
      ['richCiGVT5', 'toneRichCiGVT5', 'toneRichCiGVT5Desc'],
      ['neighborSine',  'toneNeighborSine',  'toneNeighborSineDesc'],
      ['sineNoiseHalf', 'toneSineNoiseHalf', 'toneSineNoiseHalfDesc'],
      ['sineNoiseFull', 'toneSineNoiseFull', 'toneSineNoiseFullDesc'],
      ['clusterHz2x3',    'toneClusterHz2x3',    'toneClusterHz2x3Desc'],
      ['clusterHz4x3',    'toneClusterHz4x3',    'toneClusterHz4x3Desc'],
      ['clusterHz2x8',    'toneClusterHz2x8',    'toneClusterHz2x8Desc'],
      ['clusterHz4x8',    'toneClusterHz4x8',    'toneClusterHz4x8Desc'],
      ['clusterCent2x10', 'toneClusterCent2x10', 'toneClusterCent2x10Desc'],
      ['clusterCent4x10', 'toneClusterCent4x10', 'toneClusterCent4x10Desc'],
      ['clusterCent2x30', 'toneClusterCent2x30', 'toneClusterCent2x30Desc'],
      ['clusterCent4x30', 'toneClusterCent4x30', 'toneClusterCent4x30Desc']
    ]
  }
];

// BA 299: Reduzierte Tonart-Auswahl fuer den Normalbetrieb (ohne Debug).
// Fuenf Toene als eine Button-Reihe statt der vollen GROUPS-Sammlung.
// Reihenfolge wie hier. Drittes Feld = Tooltip-Key (unveraendert).
// Das Rauschen nutzt hier den Kurznamen toneNoiseAdaptiveShort
// ("Schmalbandrauschen"); in der Debug-Sammlung bleibt es bei
// "Schmalbandrauschen adaptiv".
var NORMAL_TONE_ITEMS = [
  ['sine',          'toneSine',               'toneSineDesc'],
  ['noiseAdaptive', 'toneNoiseAdaptiveShort', 'toneNoiseAdaptiveDesc'],
  ['richCiG',       'toneRichCiG',            'toneRichCiGDesc'],
  ['warbleSine',    'toneWarbleSine',         'toneWarbleSineDesc'],
  ['amSine',        'toneAmSine',             'toneAmSineDesc']
];

// 3.2.239.2: smplr-Tonarten aus der Tonart-Auswahl entfernt — Mellotron
// soll laut Nutzer-Wunsch spaeter im Player-Tab erscheinen, nicht in der
// Mess-Tonartwahl. Code (smplr-loader.js, _playSmplrTone in audio.js)
// bleibt vollstaendig erhalten; nur die UI-Auswahl ist deaktiviert.
// Gruppendefinitionen hier geparkt, damit sie fuer den Player-Einsatz
// schnell wieder eingehaengt werden koennen.
var _SMPLR_GROUPS_PARKED = [
  {
    headKey: 'toneGroupSmplrM300',
    hintKey: 'toneGroupSmplrM300Hint',
    items: [
      ['smplr:mellotron:300 STRINGS VIOLA', 'toneSmplrM300Viola', null],
      ['smplr:mellotron:300 STRINGS CELLO', 'toneSmplrM300Cello', null]
    ]
  },
  {
    headKey: 'toneGroupSmplrMk2',
    hintKey: 'toneGroupSmplrMk2Hint',
    items: [
      ['smplr:mellotron:MKII BRASS',   'toneSmplrMk2Brass',   null],
      ['smplr:mellotron:MKII GUITAR',  'toneSmplrMk2Guitar',  null],
      ['smplr:mellotron:MKII ORGAN',   'toneSmplrMk2Organ',   null],
      ['smplr:mellotron:MKII SAX',     'toneSmplrMk2Sax',     null],
      ['smplr:mellotron:MKII VIBES',   'toneSmplrMk2Vibes',   null],
      ['smplr:mellotron:MKII VIOLINS', 'toneSmplrMk2Violins', null]
    ]
  },
  {
    headKey: 'toneGroupSmplrTron',
    hintKey: 'toneGroupSmplrTronHint',
    items: [
      ['smplr:mellotron:TRON 16VLNS', 'toneSmplrTron16Violins', null],
      ['smplr:mellotron:TRON VIOLA',  'toneSmplrTronViola',     null],
      ['smplr:mellotron:TRON CELLO',  'toneSmplrTronCello',     null],
      ['smplr:mellotron:TRON FLUTE',  'toneSmplrTronFlute',     null]
    ]
  },
  {
    headKey: 'toneGroupSmplrChamberlin',
    hintKey: 'toneGroupSmplrChamberlinHint',
    items: [
      ['smplr:mellotron:CHMB 3 VLNS',   'toneSmplrChmb3Violins',  null],
      ['smplr:mellotron:CHMB ALTOSAX',  'toneSmplrChmbAltoSax',   null],
      ['smplr:mellotron:CHMBLN CELLO',  'toneSmplrChmbCello',     null],
      ['smplr:mellotron:CHMBLN FLUTE',  'toneSmplrChmbFlute',     null],
      ['smplr:mellotron:CHMB FEMALE',   'toneSmplrChmbFemale',    null],
      ['smplr:mellotron:CHM CLARINET',  'toneSmplrChmbClarinet',  null],
      ['smplr:mellotron:CHMB MALE VC',  'toneSmplrChmbMale',      null],
      ['smplr:mellotron:CHMBLN OBOE',   'toneSmplrChmbOboe',      null],
      ['smplr:mellotron:CHMB TRMBONE',  'toneSmplrChmbTrombone',  null],
      ['smplr:mellotron:CHMB TNR SAX',  'toneSmplrChmbTenorSax',  null],
      ['smplr:mellotron:CHMB TRUMPET',  'toneSmplrChmbTrumpet',   null]
    ]
  },
  {
    headKey: 'toneGroupSmplrMixed',
    hintKey: 'toneGroupSmplrMixedHint',
    items: [
      ['smplr:mellotron:BASSA+STRNGS',  'toneSmplrMixBassStrings',     null],
      ['smplr:mellotron:MOVE BS+STGS',  'toneSmplrMixMoveBassStrings', null],
      ['smplr:mellotron:HALFSP.BRASS',  'toneSmplrMixHalfSpeedBrass',  null],
      ['smplr:mellotron:CHA CHA FLT',   'toneSmplrMixChaChaFlute',     null],
      ['smplr:mellotron:8VOICE CHOIR',  'toneSmplrMix8VoiceChoir',     null],
      ['smplr:mellotron:DIXIE+TRMBN',   'toneSmplrMixDixieTrombone',   null],
      ['smplr:mellotron:FOXTROT+SAX',   'toneSmplrMixFoxtrotSax',      null],
      ['smplr:mellotron:BOYS CHOIR',    'toneSmplrMixBoysChoir',       null],
      ['smplr:mellotron:TROMB+TRMPT',   'toneSmplrMixTromboneTrumpet', null],
      ['smplr:mellotron:STRGS+BRASS',   'toneSmplrMixStringsBrass',    null],
      ['smplr:mellotron:MIXED STRGS',   'toneSmplrMixMixedStrings',    null]
    ]
  }
];

// BA 231: i18n-Key fuer einen toneType-String aus den GROUPS holen.
// Wird von test-ui.js (_toneTypeKey) genutzt, um auch Mellotron-Tonarten
// im Header-Button korrekt zu uebersetzen.
window.toneTypeI18nKey = function(tt) {
  for (var g = 0; g < GROUPS.length; g++) {
    var items = GROUPS[g].items;
    for (var i = 0; i < items.length; i++) {
      if (items[i][0] === tt) return items[i][1] || null;
    }
  }
  // 3.2.239.2: smplr-Tonarten sind aus der UI raus, koennten aber noch
  // in gespeicherten States stehen oder durch andere Module gespielt
  // werden. i18n-Lookup auch in den geparkten Gruppen versuchen.
  for (var gg = 0; gg < _SMPLR_GROUPS_PARKED.length; gg++) {
    var sItems = _SMPLR_GROUPS_PARKED[gg].items;
    for (var j = 0; j < sItems.length; j++) {
      if (sItems[j][0] === tt) return sItems[j][1] || null;
    }
  }
  return null;
};

function openToneSelectionDialog(cfg, onChange) {
  // BA 296: Debug-Schalter. Im Normalbetrieb ist die Box reduziert;
  // der volle Funktionsumfang (Hinweise, Anstieg/Ausklang, Tonart-
  // Sammlung) erscheint nur bei aktivem Debug-Modus.
  var dbgOn = !!(window.dbg && typeof window.dbg.isActive === 'function'
                 && window.dbg.isActive());

  var initial = cfg.getToneType();
  // BA 299: Im Normalbetrieb (kein Debug) stehen mehrere Toene zur Wahl.
  // Erlaubt sind die fuenf NORMAL_TONE_ITEMS; ein im Debug oder per Datei
  // gesetzter anderer Ton faellt beim Oeffnen ohne Debug auf Sinus zurueck.
  var _normalKeys = NORMAL_TONE_ITEMS.map(function (it) { return it[0]; });
  if (!dbgOn && _normalKeys.indexOf(initial) < 0) {
    cfg.setToneType('sine');
    if (typeof onChange === 'function') onChange();
    initial = 'sine';
  }
  var selected = initial;
  var playing = false;
  // BA 239: Korrektur-Toggles, Default an, lokal in der Modal-Instanz.
  var applyMeasLevels = true;
  var applyBalance    = true;
  // BA 241: Sweep-State, nur aktiv wenn cfg.sweepMode === true.
  var sweepRunning = false;
  var sweepAbort   = false;
  var sweepKbHandle = null;
  var _tpLastKbHz = 1000;   // BA 292: zuletzt am Klavier angetippte Frequenz (Default 1000)

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.45);' +
    'display:flex;align-items:center;justify-content:center;z-index:9999;';

  var dlg = document.createElement('div');
  dlg.className = 'modal-dlg';
  dlg.style.cssText =
    'background:var(--bg,#fff);color:var(--fg,#000);padding:18px 22px;' +
    'border-radius:8px;min-width:420px;max-width:90vw;max-height:85vh;' +
    'overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.3);';

  var title = document.createElement('h3');
  // Titel per cfg.titleKey ueberschreibbar; Default "Einstellungen Testton".
  title.dataset.t = (typeof cfg.titleKey === 'string' && cfg.titleKey)
    ? cfg.titleKey : 'tonePopupTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  // BA 298: Dauerhaft sichtbare Hinweise, unabhaengig vom Debug-Modus.
  // (1) Universeller Lautstaerke-Hinweis, fest verdrahtet in jedem
  //     Aufruf. (2) Optionaler reiterspezifischer Dauer-Hinweis ueber
  //     cfg.persistentHintKey (aktuell: Rausch-Hinweis im Implantat-
  //     Reiter). Gleiche gelbe Box-Optik wie die Debug-Hinweise.
  var _tpDbgHintFollows = dbgOn && (cfg.hintKey || cfg.extraHintKey);
  var _tpPersistStyle = function (bottomPx) {
    return 'margin:0 0 ' + bottomPx + 'px 0;font-size:.92em;' +
           'line-height:1.35;background:#fff4d6;' +
           'border-left:3px solid #d8a200;padding:8px 10px;' +
           'border-radius:4px;';
  };
  // Letzter sichtbarer Dauer-Hinweis braucht 14px Abstand nach unten,
  // ausser es folgt noch ein Debug-Hinweis (dann 8px, zusammenruecken).
  var _tpPersistLastMargin = _tpDbgHintFollows ? '8' : '14';

  var stabHint = document.createElement('p');
  stabHint.dataset.t = 'tonePopupHintStabilize';
  // BA 299: stabHint wird jetzt immer vom Tonauswahl-Hinweis gefolgt -> 8px.
  stabHint.style.cssText = _tpPersistStyle('8');
  dlg.appendChild(stabHint);

  // BA 299: Dauerhafter Hinweis zur Tonauswahl, direkt unter dem
  // Stabilisierungs-Hinweis. Gleiche gelbe Box-Optik. Letzter sichtbarer
  // Dauer-Hinweis, sofern kein persistentHintKey folgt.
  var toneChoiceHint = document.createElement('p');
  toneChoiceHint.dataset.t = 'tonePopupHintToneChoice';
  toneChoiceHint.style.cssText = _tpPersistStyle(
    cfg.persistentHintKey ? '8' : _tpPersistLastMargin);
  dlg.appendChild(toneChoiceHint);

  if (cfg.persistentHintKey) {
    var persHint = document.createElement('p');
    persHint.dataset.t = cfg.persistentHintKey;
    persHint.style.cssText = _tpPersistStyle(_tpPersistLastMargin);
    dlg.appendChild(persHint);
  }

  // BA 240: Hint-Box optional und reiterspezifisch.
  // BA 265: Zweite Hint-Box (cfg.extraHintKey) fuer reiterspezifische
  // Ergaenzungen, die UNTER dem allgemeinen Intro-Text stehen.
  // Beide Boxen optional. Wenn beide gesetzt sind, hat die erste
  // einen knapperen Bottom-Margin, damit sie zusammenruecken.
  var _tpHasExtraHint = !!cfg.extraHintKey;
  if (dbgOn && cfg.hintKey) {
    var hint = document.createElement('p');
    hint.dataset.t = cfg.hintKey;
    hint.style.cssText =
      'margin:0 0 ' + (_tpHasExtraHint ? '8' : '14') + 'px 0;' +
      'font-size:.92em;line-height:1.35;' +
      'background:#fff4d6;border-left:3px solid #d8a200;' +
      'padding:8px 10px;border-radius:4px;';
    dlg.appendChild(hint);
  }
  if (dbgOn && cfg.extraHintKey) {
    var extraHint = document.createElement('p');
    extraHint.dataset.t = cfg.extraHintKey;
    extraHint.style.cssText =
      'margin:0 0 14px 0;font-size:.92em;line-height:1.35;' +
      'background:#fff4d6;border-left:3px solid #d8a200;' +
      'padding:8px 10px;border-radius:4px;';
    dlg.appendChild(extraHint);
  }

  // BA 271: Globale Anstiegs-/Ausklang-Einstellung. Steht immer sichtbar
  // (unabhaengig von showToggles), weil sie toolweit fuer ALLE Toene gilt.
  // Liest die globalen gToneEnv*-Variablen (BA 270) und schreibt via
  // setToneEnvelope (sofort persistent + sofort wirksam).
  if (dbgOn) (function buildToneEnvSection() {
    var sec = document.createElement("div");
    sec.style.cssText =
      "margin:0 0 14px 0;padding:8px 10px;border:1px solid var(--border);" +
      "border-radius:6px;";

    var head = document.createElement("div");
    head.dataset.t = "toneEnvSection";
    head.style.cssText = "font-weight:600;font-size:.95em;margin-bottom:6px;";
    sec.appendChild(head);

    // Gemeinsamer Aktiv/Inaktiv-Stil fuer die Auswahl-Buttons.
    function _envBtnStyle(btn, active) {
      if (active) {
        btn.style.background  = "var(--success)";
        btn.style.color       = "#fff";
        btn.style.borderColor = "var(--success)";
      } else {
        btn.style.background  = "#e5e7eb";
        btn.style.color       = "var(--text)";
        btn.style.borderColor = "var(--border)";
      }
    }

    // --- Anstiegsform ---
    var formRow = document.createElement("div");
    formRow.style.cssText =
      "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px;";
    var formLbl = document.createElement("span");
    formLbl.dataset.t = "toneEnvFormLabel";
    formLbl.style.cssText = "font-size:.9em;margin-right:4px;";
    formRow.appendChild(formLbl);

    var FORMS = [
      ["hard",   "toneEnvFormHard"],
      ["linear", "toneEnvFormLinear"],
      ["cos2",   "toneEnvFormCos2"],
      ["dblin",  "toneEnvFormDblin"]
    ];
    var formBtns = {};
    FORMS.forEach(function(f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-sm";
      b.dataset.t = f[1];
      b.style.cssText = "border-radius:6px;font-weight:600;";
      b.addEventListener("click", function() {
        setToneEnvelope({ attackForm: f[0] });
        refreshEnvUI();
      });
      formBtns[f[0]] = b;
      formRow.appendChild(b);
    });
    sec.appendChild(formRow);

    // --- Anschwingzeit + Startpegel ---
    var numRow = document.createElement("div");
    numRow.style.cssText =
      "display:flex;gap:14px;flex-wrap:wrap;align-items:center;margin-bottom:8px;";
    var uid = "env" + Date.now();

    // Anschwingzeit (editierbares Feld mit Vorschlagsliste)
    var atkWrap = document.createElement("label");
    atkWrap.style.cssText = "display:flex;align-items:center;gap:6px;font-size:.9em;";
    var atkLbl = document.createElement("span");
    atkLbl.dataset.t = "toneEnvAttackMs";
    var atkList = document.createElement("datalist");
    atkList.id = uid + "atk";
    [0, 50, 100, 250, 500, 1000].forEach(function(v) {
      var o = document.createElement("option");
      o.value = String(v);
      atkList.appendChild(o);
    });
    var atkInp = document.createElement("input");
    atkInp.type = "number";
    atkInp.min = "0"; atkInp.max = "3000"; atkInp.step = "10";
    atkInp.setAttribute("list", atkList.id);
    atkInp.style.cssText =
      "width:72px;padding:3px 5px;border:1px solid var(--border);" +
      "border-radius:4px;text-align:center;font-family:var(--mono);font-size:.9em;";
    atkInp.addEventListener("change", function() {
      var v = parseInt(atkInp.value, 10);
      if (!isFinite(v) || v < 0) v = 0;
      if (v > 3000) v = 3000;
      atkInp.value = String(v);
      setToneEnvelope({ attackMs: v });
    });
    var atkUnit = document.createElement("span");
    atkUnit.textContent = "ms";
    atkUnit.style.color = "var(--text-muted)";
    atkWrap.append(atkLbl, atkInp, atkList, atkUnit);
    numRow.appendChild(atkWrap);

    // Startpegel (nur bei dB-linear sichtbar)
    var flWrap = document.createElement("label");
    flWrap.style.cssText = "display:flex;align-items:center;gap:6px;font-size:.9em;";
    var flLbl = document.createElement("span");
    flLbl.dataset.t = "toneEnvDbFloor";
    var flList = document.createElement("datalist");
    flList.id = uid + "fl";
    [-40, -50, -60].forEach(function(v) {
      var o = document.createElement("option");
      o.value = String(v);
      flList.appendChild(o);
    });
    var flInp = document.createElement("input");
    flInp.type = "number";
    flInp.min = "-80"; flInp.max = "-10"; flInp.step = "5";
    flInp.setAttribute("list", flList.id);
    flInp.style.cssText =
      "width:72px;padding:3px 5px;border:1px solid var(--border);" +
      "border-radius:4px;text-align:center;font-family:var(--mono);font-size:.9em;";
    flInp.addEventListener("change", function() {
      var v = parseInt(flInp.value, 10);
      if (!isFinite(v)) v = -50;
      if (v > -10) v = -10;
      if (v < -80) v = -80;
      flInp.value = String(v);
      setToneEnvelope({ dbFloor: v });
    });
    var flUnit = document.createElement("span");
    flUnit.textContent = "dB";
    flUnit.style.color = "var(--text-muted)";
    flWrap.append(flLbl, flInp, flList, flUnit);
    numRow.appendChild(flWrap);
    sec.appendChild(numRow);

    // --- Ausklang ---
    var relRow = document.createElement("div");
    relRow.style.cssText =
      "display:flex;gap:6px;flex-wrap:wrap;align-items:center;";
    var relLbl = document.createElement("span");
    relLbl.dataset.t = "toneEnvReleaseLabel";
    relLbl.style.cssText = "font-size:.9em;margin-right:4px;";
    relRow.appendChild(relLbl);

    var RELS = [
      ["short", "toneEnvRelShort"],
      ["sym",   "toneEnvRelSym"],
      ["hard",  "toneEnvRelHard"]
    ];
    var relBtns = {};
    RELS.forEach(function(rr) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-sm";
      b.dataset.t = rr[1];
      b.style.cssText = "border-radius:6px;font-weight:600;";
      b.addEventListener("click", function() {
        setToneEnvelope({ release: rr[0] });
        refreshEnvUI();
      });
      relBtns[rr[0]] = b;
      relRow.appendChild(b);
    });
    sec.appendChild(relRow);

    // --- Refresh: liest globale Variablen, setzt Styles/Werte/Sichtbarkeit ---
    function refreshEnvUI() {
      Object.keys(formBtns).forEach(function(k) {
        _envBtnStyle(formBtns[k], k === gToneEnvAttackForm);
      });
      Object.keys(relBtns).forEach(function(k) {
        _envBtnStyle(relBtns[k], k === gToneEnvRelease);
      });
      atkInp.value = String(gToneEnvAttackMs);
      flInp.value  = String(gToneEnvDbFloor);
      var hard = (gToneEnvAttackForm === "hard");
      atkInp.disabled = hard;
      atkWrap.style.opacity = hard ? "0.45" : "1";
      flWrap.style.display = (gToneEnvAttackForm === "dblin") ? "flex" : "none";
    }
    refreshEnvUI();

    dlg.appendChild(sec);
  })();

  // BA 239: Korrektur-Toggles. Stil analog Player-Toggles
  // (siehe js/tabs-eq.js updPlSrcButtons / updBalApplyBtn):
  // grün = aktiv, grau = inaktiv. Beide Default an, lokal.
  //
  // Die Korrektur-Toggles (und die ueber onTogglesReady ausgegebene
  // Korrektor-fn) werden NUR im Reiter Implantat genutzt; dort steuern
  // sie Vorschau, Klavier und Sweep. Die Test-Aufrufer setzen
  // showToggles:false und wenden ihre Elektrodenlautstaerke-Korrektur
  // selbst an (lrCorrGain / fmCorrGain) — die fn liegt dort brach.
  if (cfg.showToggles !== false) {
    var togRow = document.createElement('div');
    togRow.style.cssText =
      'display:flex;gap:8px;margin:0 0 14px 0;flex-wrap:wrap;';

    var _tpUpdToggleStyle = function(btn, active) {
      if (active) {
        btn.style.background  = 'var(--success)';
        btn.style.color       = '#fff';
        btn.style.borderColor = 'var(--success)';
      } else {
        btn.style.background  = '#e5e7eb';
        btn.style.color       = 'var(--text)';
        btn.style.borderColor = 'var(--border)';
      }
    };

    var togMeas = document.createElement('button');
    togMeas.type = 'button';
    togMeas.className = 'btn btn-sm';
    togMeas.dataset.t = 'tonePopupApplyMeas';
    togMeas.style.cssText = 'font-weight:600;border-radius:6px;';
    togMeas.addEventListener('click', function() {
      applyMeasLevels = !applyMeasLevels;
      _tpUpdToggleStyle(togMeas, applyMeasLevels);
    });
    _tpUpdToggleStyle(togMeas, applyMeasLevels);

    var togBal = document.createElement('button');
    togBal.type = 'button';
    togBal.className = 'btn btn-sm';
    togBal.dataset.t = 'tonePopupApplyBalance';
    togBal.style.cssText = 'font-weight:600;border-radius:6px;';
    togBal.addEventListener('click', function() {
      applyBalance = !applyBalance;
      _tpUpdToggleStyle(togBal, applyBalance);
    });
    _tpUpdToggleStyle(togBal, applyBalance);

    togRow.append(togMeas, togBal);
    dlg.appendChild(togRow);
  }

  // BA 240: Vol/Dur/Pau-Eingabefelder. Pro Feld via cfg.showXxx aktivierbar.
  // Werte werden live ueber cfg-Setter zurueckgeschrieben (kein OK-Bestaetigen).
  var anyVdpField = cfg.showVolume || cfg.showDuration || cfg.showPause;
  if (anyVdpField) {
    var vdpRow = document.createElement('div');
    vdpRow.style.cssText =
      'display:flex;gap:14px;margin:0 0 14px 0;flex-wrap:wrap;align-items:center;';

    function _mkVdpField(labelKey, getter, setter, min, max, step, suffix) {
      var wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:.92em;';
      var lbl = document.createElement('span');
      lbl.dataset.t = labelKey;
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min  = String(min);
      inp.max  = String(max);
      inp.step = String(step);
      inp.value = String(getter());
      inp.style.cssText =
        'width:64px;padding:3px 5px;border:1px solid var(--border);'
        + 'border-radius:4px;text-align:center;font-family:var(--mono);font-size:.9em;';
      inp.addEventListener('change', function() {
        var v = parseInt(inp.value, 10);
        if (!isFinite(v)) v = getter();
        if (v < min) v = min;
        if (v > max) v = max;
        inp.value = String(v);
        setter(v);
      });
      var unit = document.createElement('span');
      unit.textContent = suffix;
      unit.style.color = 'var(--text-muted)';
      wrap.append(lbl, inp, unit);
      return wrap;
    }

    if (cfg.showVolume && typeof cfg.getVolumePercent === 'function'
        && typeof cfg.setVolumePercent === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupVolume', cfg.getVolumePercent, cfg.setVolumePercent,
        0, 100, 1, '%'
      ));
    }
    if (cfg.showDuration && typeof cfg.getDurationMs === 'function'
        && typeof cfg.setDurationMs === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupDuration', cfg.getDurationMs, cfg.setDurationMs,
        100, 3000, 50, 'ms'
      ));
    }
    if (cfg.showPause && typeof cfg.getPauseMs === 'function'
        && typeof cfg.setPauseMs === 'function') {
      vdpRow.appendChild(_mkVdpField(
        'tonePopupPause', cfg.getPauseMs, cfg.setPauseMs,
        50, 2000, 50, 'ms'
      ));
    }

    if (vdpRow.children.length) dlg.appendChild(vdpRow);
  }

  // BA 239: Korrektorfunktion für Klavier-onPress bereitstellen.
  if (typeof cfg.onTogglesReady === 'function') {
    cfg.onTogglesReady(function(vol, hz, pan) {
      var ev = vol;
      if (applyMeasLevels) {
        var md = _tpMeasDbForStep(hz, pan);
        if (md !== 0) ev *= Math.pow(10, md / 20);
      }
      if (applyBalance) {
        var bl = _tpBalanceDbSym();
        var bd = (pan < -0.01) ? bl.left : (pan > 0.01) ? bl.right : 0;
        if (bd !== 0) ev *= Math.pow(10, bd / 20);
      }
      return ev;
    });
  }

  // BA 228: Optionales Klavier-Widget oberhalb der Tonart-Liste.
  // Wird nur gerendert, wenn cfg.keyboardMode aktiv und alle
  // benoetigten Helfer existieren. Aufrufer (z. B. freqmatch.js) liefert
  // Elektroden-Frequenzen, -Labels und Anschlag-Logik selbst.
  if (cfg.keyboardMode
      && typeof renderSamplerKeyboard === 'function'
      && typeof cfg.getElectrodeFreqs === 'function') {
    var kbWrap = document.createElement('div');
    dlg.appendChild(kbWrap);
    try {
      sweepKbHandle = renderSamplerKeyboard(kbWrap, {
        getElectrodeFreqs:   cfg.getElectrodeFreqs,
        getElectrodeLabels:  cfg.getElectrodeLabels,
        // BA 230: Klavier liest 'selected' (im Modal angeklickt),
        // nicht cfg.getToneType (erst nach OK aktualisiert).
        getCurrentToneType:  function() { return selected; },
        onPress: function (electrodeIdx, hz) {
          if (typeof hz === 'number' && isFinite(hz) && hz > 0) _tpLastKbHz = hz;
          if (typeof cfg.onPress === 'function') cfg.onPress(electrodeIdx, hz);
        },
        onRelease:           cfg.onRelease,
        getHighlightMs:      cfg.getHighlightMs,
        // BA 241: Disabled-Anzeige
        getDisabledElectrodes: cfg.getDisabledElectrodes
      });
    } catch (e) { /* swallow — Klavier-Render-Fehler darf das Modal nicht killen */ }
  }

  // BA 241: Optionaler Sweep-Knopf. Aktiv nur wenn cfg.sweepMode === true.
  var sweepBtn = null;
  if (cfg.sweepMode === true) {
    var sweepRow = document.createElement('div');
    sweepRow.style.cssText = 'margin:0 0 14px 0;display:flex;justify-content:flex-start;';
    sweepBtn = document.createElement('button');
    sweepBtn.type = 'button';
    sweepBtn.className = 'btn';
    sweepBtn.dataset.t = 'tonePopupSweepStart';
    sweepBtn.style.cssText = 'padding:6px 14px;font-weight:600;border-radius:6px;';

    function _swpUpdStyle(active) {
      if (active) {
        sweepBtn.style.background  = '#2563eb';
        sweepBtn.style.color       = '#fff';
        sweepBtn.style.borderColor = '#2563eb';
      } else {
        sweepBtn.style.background  = '';
        sweepBtn.style.color       = '';
        sweepBtn.style.borderColor = '';
      }
    }
    _swpUpdStyle(false);

    sweepBtn.addEventListener('click', function() {
      if (sweepRunning) {
        sweepAbort = true;
        return;
      }
      _runSweep();
    });

    sweepRow.appendChild(sweepBtn);
    dlg.appendChild(sweepRow);
  }

  // BA 241: Sweep-Schleife.
  function _runSweep() {
    if (typeof cfg.getElectrodeFreqs !== 'function') return;
    var freqs = cfg.getElectrodeFreqs() || [];
    if (!freqs.length) return;
    var disabled = (typeof cfg.getDisabledElectrodes === 'function')
      ? new Set(cfg.getDisabledElectrodes() || [])
      : new Set();
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;

    var pan = (typeof cfg.getSweepPan === 'function') ? cfg.getSweepPan() : 0;
    var pauMs = (typeof cfg.getPauseMs    === 'function') ? cfg.getPauseMs()    : 300;
    var dur   = (typeof cfg.getDurationMs === 'function') ? cfg.getDurationMs() : 750;

    sweepRunning = true;
    sweepAbort   = false;
    if (sweepBtn) _swpUpdStyle(true);

    var idx = 0;
    function step() {
      if (sweepAbort || idx >= freqs.length) {
        sweepRunning = false;
        sweepAbort   = false;
        if (sweepBtn) _swpUpdStyle(false);
        return;
      }
      if (disabled.has(idx)) { idx++; step(); return; }

      var hz   = freqs[idx];
      var tone = selected;
      var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
      if (applyMeasLevels) {
        var md = _tpMeasDbForStep(hz, pan);
        if (md !== 0) vol *= Math.pow(10, md / 20);
      }
      if (applyBalance) {
        var bl = _tpBalanceDbSym();
        var bd = (pan < -0.01) ? bl.left : (pan > 0.01) ? bl.right : 0;
        if (bd !== 0) vol *= Math.pow(10, bd / 20);
      }

      if (sweepKbHandle && typeof sweepKbHandle.highlightElectrode === 'function') {
        sweepKbHandle.highlightElectrode(idx, true);
      }
      try {
        playToneTyped(c, hz, vol, dur, pan, tone);
      } catch (e) { /* swallow */ }

      var curIdx = idx;
      idx++;
      setTimeout(function() {
        if (sweepKbHandle && typeof sweepKbHandle.highlightElectrode === 'function') {
          sweepKbHandle.highlightElectrode(curIdx, false);
        }
        if (sweepAbort) {
          sweepRunning = false;
          sweepAbort   = false;
          if (sweepBtn) _swpUpdStyle(false);
          return;
        }
        if (idx >= freqs.length) {
          step();
        } else {
          setTimeout(step, pauMs);
        }
      }, dur);
    }
    step();
  }

  // BA 241: Tonart-Wechsel stoppt laufenden Sweep.
  function _abortSweepOnToneChange() {
    if (sweepRunning) sweepAbort = true;
  }

  // BA 230: Buttons-Reihe statt Radio-Grid.
  // BA 299: Item-Erzeugung in _makeToneItem ausgelagert, damit Debug-
  // Sammlung und reduzierte Normalbetrieb-Reihe identisches Button-
  // Verhalten teilen (Auswahl, Vorspiel, Active-Markierung).
  function _makeToneItem(key, i18nKey, descKey) {
    // Wrapper, damit Sanduhr direkt neben dem Button steht und mitwandert.
    var itemWrap = document.createElement('span');
    itemWrap.className = 'tone-item';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tone-btn' + (key === initial ? ' tone-btn--active' : '');
    btn.dataset.toneKey = key;
    if (i18nKey) {
      btn.dataset.t = i18nKey;
    } else {
      // Fallback fuer Eintraege ohne i18n-Key (z. B. Mellotron-Varianten):
      // letzten Token-Teil als Label anzeigen.
      var lastColon = key.lastIndexOf(':');
      btn.textContent = lastColon >= 0 ? key.substring(lastColon + 1) : key;
    }
    if (descKey) {
      // Beschreibung als Tooltip; data-t-title wird von applyLang gesetzt.
      btn.dataset.tTitle = descKey;
    }

    btn.addEventListener('click', function() {
      if (playing) return;
      _abortSweepOnToneChange();
      var prev = dlg.querySelectorAll('.tone-btn--active');
      prev.forEach(function(b) { b.classList.remove('tone-btn--active'); });
      btn.classList.add('tone-btn--active');
      selected = key;
      if (typeof cfg.onToneSelected === 'function') cfg.onToneSelected(key);
      _playPreview(key);
    });

    itemWrap.append(btn);
    return itemWrap;
  }

  // BA 296: Tonart-Sammlung nur im Debug-Modus.
  if (dbgOn) {
    GROUPS.forEach(function(grp) {
      var section = document.createElement('section');
      section.style.cssText = 'margin-bottom:14px;';

      var h4 = document.createElement('h4');
      h4.dataset.t = grp.headKey;
      h4.style.cssText =
        'margin:0 0 2px 0;font-size:.98em;font-weight:600;' +
        'color:var(--fg,#000);';
      section.appendChild(h4);

      var subhint = document.createElement('div');
      subhint.dataset.t = grp.hintKey;
      subhint.style.cssText =
        'margin:0 0 8px 0;font-size:.85em;color:#1a1a1a;font-style:italic;';
      section.appendChild(subhint);

      var list = document.createElement('div');
      list.className = 'tone-btn-row';
      grp.items.forEach(function(triple) {
        list.appendChild(_makeToneItem(triple[0], triple[1], triple[2]));
      });

      section.appendChild(list);
      dlg.appendChild(section);
    });
  } else {
    // BA 299: Normalbetrieb -- reduzierte Auswahl als eine Button-Reihe,
    // ohne Gruppen-Header. Gleiche tone-btn-row/tone-item-Optik.
    var nSection = document.createElement('section');
    nSection.style.cssText = 'margin-bottom:14px;';
    var nList = document.createElement('div');
    nList.className = 'tone-btn-row';
    NORMAL_TONE_ITEMS.forEach(function(triple) {
      nList.appendChild(_makeToneItem(triple[0], triple[1], triple[2]));
    });
    nSection.appendChild(nList);
    dlg.appendChild(nSection);
  }

  // BA 226: Sanduhr ein-/ausblenden fuer den Button eines konkreten
  // toneType (Strings koennen Doppelpunkte und Leerzeichen enthalten,
  // deshalb ueber alle Buttons iterieren statt CSS-Selector).
  // BA 239: Korrektur-Helfer für die Modal-Toggles.

  // Mess-Lautstärke-Korrektur pro Step.
  // hz -> nächste aktive Elektrode der step-Seite -> levels[i].
  // Bedingung wie player.js:221-228 (hd-Check über bRes).
  // Liefert dB-Offset (0 wenn keine Voraussetzung erfüllt).
  function _tpMeasDbForStep(stepHz, stepPan) {
    if (typeof withSide !== 'function'
        || typeof compWLS !== 'function'
        || typeof effFreq !== 'function') return 0;
    var side = (stepPan < -0.01) ? 'left'
             : (stepPan >  0.01) ? 'right'
             : (typeof activeSide === 'string' ? activeSide : 'left');
    var dB = 0;
    try {
      dB = withSide(side, function() {
        if (typeof elActive === 'undefined'
            || !Array.isArray(elActive)
            || elActive.length === 0) return 0;
        // Nächste aktive, nicht-stumme Elektrode finden.
        var best = -1, bestDist = Infinity;
        for (var i = 0; i < elActive.length; i++) {
          if (elActive[i] === false) continue;
          if (typeof elSt !== 'undefined' && elSt[i] === 'mute') continue;
          var d = Math.abs(effFreq(i) - stepHz);
          if (d < bestDist) { bestDist = d; best = i; }
        }
        if (best < 0) return 0;
        // hd-Check analog player.js:221-228.
        if (typeof bRes === 'undefined'
            || !Array.isArray(bRes)
            || !bRes.some(function(r) {
              return (r.a === best || r.b === best)
                  && elExDur[r.a] === null && elSt[r.a] !== 'mute'
                  && elExDur[r.b] === null && elSt[r.b] !== 'mute';
            })) return 0;
        var lv = elTestData().correction;
        var v = lv[best];
        return (typeof v === 'number' && isFinite(v)) ? v : 0;
      });
    } catch (e) { /* swallow */ }
    return (typeof dB === 'number' && isFinite(dB)) ? dB : 0;
  }

  // Stereo-Balance fest symmetrisch.
  // Liefert {left, right} dB aus dem Mittelwert von lrResults.
  // (lrResults ist global, nicht side-bound — siehe lr-balance.js:6.)
  function _tpBalanceDbSym() {
    if (typeof lrResults === 'undefined' || !lrResults) {
      return { left: 0, right: 0 };
    }
    var vals = Object.values(lrResults).filter(function(v) {
      return typeof v === 'number' && isFinite(v);
    });
    if (!vals.length) return { left: 0, right: 0 };
    var mean = vals.reduce(function(a, b) { return a + b; }, 0) / vals.length;
    // Player-Konvention: positive mean = rechts lauter -> -mean
    // als symmetrischer Versatz: left=+b, right=-b
    // (siehe state-side.js:425-430 getPlayerBalance + Z. 448).
    var b = -mean;
    if (!isFinite(b)) return { left: 0, right: 0 };
    b = Math.max(-60, Math.min(60, b));
    return { left: b, right: -b };
  }

  function _playPreview(toneType) {
    var seq = (typeof cfg.getPreviewSequence === 'function')
      ? cfg.getPreviewSequence(_tpLastKbHz)
      : null;
    if (!Array.isArray(seq) || seq.length === 0) return;
    // getPreviewSequence liefert fertige Token (vol enthalten) -> nur abspielen.
    playing = true;
    _setToneButtonsDisabled(true);
    testUI.tonePlayer.playSequential(seq, {
      toneType: toneType,
      onDone: function () {
        playing = false;
        _setToneButtonsDisabled(false);
      }
    });
  }
  function _setToneButtonsDisabled(flag) {
    var btns = dlg.querySelectorAll('button.tone-btn');
    btns.forEach(function(b) { b.disabled = flag; });
  }

  var btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
  var cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn';
  cancelBtn.dataset.t = 'tonePopupCancel';
  var okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'btn btn-primary';
  okBtn.dataset.t = 'tonePopupOk';
  btnRow.append(cancelBtn, okBtn);
  dlg.appendChild(btnRow);

  overlay.appendChild(dlg);
  document.body.appendChild(overlay);
  if (typeof applyLang === 'function') applyLang();

  function close() {
    // BA 241: Laufenden Sweep abbrechen.
    if (sweepRunning) sweepAbort = true;
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (typeof cfg.onModalClose === 'function') cfg.onModalClose();
  }
  cancelBtn.addEventListener('click', function() {
    close();
  });
  okBtn.addEventListener('click', function() {
    if (sweepRunning) sweepAbort = true;
    if (selected !== initial) {
      cfg.setToneType(selected);
      if (typeof onChange === 'function') onChange();
    }
    close();
  });
}
