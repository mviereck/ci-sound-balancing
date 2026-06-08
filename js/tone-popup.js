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
//
// Modal-Aufbau: GROUPS-Konstante mit allen Tonart-Gruppen (Sinus,
// Komplex, Rich-Profile, Noise, Mellotron). Pro Item ein Radio-
// Button, Label und ein Vorspiel-Knopf rechts mit Sanduhr-Span
// (BA 226: Sanduhr ist 4. Grid-Spalte, eigenstaendig, sichtbar
// per visibility:visible/hidden ohne Layout-Shift).
//
// Interne Helfer (vor `openToneSelectionDialog` definiert,
// als function declarations damit sie ueberall im Modul greifen):
//   _setHourglassFor(toneType, show)   — Sanduhr ein/aus pro Token
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
    headKey: 'toneGroupCiTest',
    hintKey: 'toneGroupCiTestHint',
    items: [
      ['richCiH',  'toneRichCiH',  'toneRichCiHDesc'],
      ['richCiB',  'toneRichCiB',  'toneRichCiBDesc'],
      ['richCiHA', 'toneRichCiHA', 'toneRichCiHADesc'],
      ['richCiHS', 'toneRichCiHS', 'toneRichCiHSDesc'],
      ['richCiHF', 'toneRichCiHF', 'toneRichCiHFDesc']
    ]
  },
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
      ['richAcc',   'toneRichAcc',   null],
      ['richASax',  'toneRichASax',  null],
      ['richBTb',   'toneRichBTb',   null],
      ['richVa',    'toneRichVa',    null],
      ['richBn',    'toneRichBn',    null],
      ['richClBb',  'toneRichClBb',  null],
      ['richCb',    'toneRichCb',    null],
      ['richOb',    'toneRichOb',    null],
      ['richTbn',   'toneRichTbn',   null],
      ['richFl',    'toneRichFl',    null],
      ['richTpC',   'toneRichTpC',   null],
      ['richVn',    'toneRichVn',    null],
      ['richVc',    'toneRichVc',    null],
      ['richHn',    'toneRichHn',    null]
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
  return null;
};

function openToneSelectionDialog(cfg, onChange) {
  var initial = cfg.getToneType();
  var selected = initial;
  var playing = false;
  // BA 239: Korrektur-Toggles, Default an, lokal in der Modal-Instanz.
  var applyMeasLevels = true;
  var applyBalance    = true;

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
  title.dataset.t = 'tonePopupTitle';
  title.style.cssText = 'margin:0 0 8px 0;font-size:1.05em;';
  dlg.appendChild(title);

  var hint = document.createElement('p');
  hint.dataset.t = 'tonePopupHint';
  hint.style.cssText =
    'margin:0 0 14px 0;font-size:.92em;line-height:1.35;' +
    'background:#fff4d6;border-left:3px solid #d8a200;' +
    'padding:8px 10px;border-radius:4px;';
  dlg.appendChild(hint);

  // BA 239: Korrektur-Toggles. Stil analog Player-Toggles
  // (siehe js/tabs-eq.js updPlSrcButtons / updBalApplyBtn):
  // grün = aktiv, grau = inaktiv. Beide Default an, lokal.
  var togRow = document.createElement('div');
  togRow.style.cssText =
    'display:flex;gap:8px;margin:0 0 14px 0;flex-wrap:wrap;';

  function _tpUpdToggleStyle(btn, active) {
    if (active) {
      btn.style.background  = 'var(--success)';
      btn.style.color       = '#fff';
      btn.style.borderColor = 'var(--success)';
    } else {
      btn.style.background  = '#e5e7eb';
      btn.style.color       = 'var(--text)';
      btn.style.borderColor = 'var(--border)';
    }
  }

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
      renderSamplerKeyboard(kbWrap, {
        getElectrodeFreqs:   cfg.getElectrodeFreqs,
        getElectrodeLabels:  cfg.getElectrodeLabels,
        // BA 230: Klavier liest 'selected' (im Modal angeklickt),
        // nicht cfg.getToneType (erst nach OK aktualisiert).
        getCurrentToneType:  function() { return selected; },
        onPress:             cfg.onPress,
        onRelease:           cfg.onRelease,
        getHighlightMs:      cfg.getHighlightMs
      });
    } catch (e) { /* swallow — Klavier-Render-Fehler darf das Modal nicht killen */ }
  }

  // BA 230: Buttons-Reihe statt Radio-Grid.
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
      'margin:0 0 8px 0;font-size:.85em;color:#666;font-style:italic;';
    section.appendChild(subhint);

    var list = document.createElement('div');
    list.className = 'tone-btn-row';

    grp.items.forEach(function(triple) {
      var key = triple[0], i18nKey = triple[1], descKey = triple[2];

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

      // Sanduhr-Span: per data-tone-key adressierbar (_setHourglassFor).
      var hgSpan = document.createElement('span');
      hgSpan.className = 'btn-hourglass';
      hgSpan.dataset.toneKey = key;
      hgSpan.style.cssText =
        'visibility:hidden;font-size:1.4em;line-height:1;'
        + 'color:#d8a200;margin-left:2px;display:inline-block;'
        + 'width:1.1em;text-align:center;vertical-align:middle;';
      hgSpan.textContent = '⧖';

      btn.addEventListener('click', function() {
        if (playing) return;
        var prev = dlg.querySelectorAll('.tone-btn--active');
        prev.forEach(function(b) { b.classList.remove('tone-btn--active'); });
        btn.classList.add('tone-btn--active');
        selected = key;
        if (typeof cfg.onToneSelected === 'function') cfg.onToneSelected(key);
        _playPreview(key);
      });

      itemWrap.append(btn, hgSpan);
      list.appendChild(itemWrap);
    });

    section.appendChild(list);
    dlg.appendChild(section);
  });

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
        var lv = compWLS().levels;
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

  function _setHourglassFor(toneType, show) {
    // BA 226 Fix .4: visibility statt display, damit der Grid-Track
    // konstante Breite behaelt (display:none entfernt das Element
    // komplett aus dem Layout -> Track-Sizing rechnet neu -> Chaos).
    var spans = dlg.querySelectorAll('span.btn-hourglass[data-tone-key]');
    spans.forEach(function (s) {
      if (s.dataset.toneKey !== toneType) return;
      s.style.visibility = show ? 'visible' : 'hidden';
    });
  }

  function _playPreview(toneType) {
    var seq = cfg.getPreviewSequence();
    if (!Array.isArray(seq) || seq.length === 0) return;
    var c = (typeof gAC === 'function') ? gAC() : null;
    if (!c) return;

    // BA 226: Bei smplr-Tonart, die noch nicht geladen ist, erst Sampler
    // laden (mit Sanduhr-Visualisierung), dann _playPreview rekursiv
    // erneut aufrufen. Buttons bleiben waehrend des Ladens disabled,
    // playing-Flag bleibt true, damit kein paralleler Klick durchkommt.
    if (typeof toneType === 'string'
        && toneType.indexOf('smplr:') === 0
        && typeof window.smplrSamplerIsReady === 'function'
        && !window.smplrSamplerIsReady(toneType)) {
      if (typeof window.loadSamplerByToken !== 'function') return;
      playing = true;
      _setToneButtonsDisabled(true);
      _setHourglassFor(toneType, true);
      window.loadSamplerByToken(c, toneType).then(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setToneButtonsDisabled(false);
        // Sampler geladen -> Vorspielen jetzt regulaer.
        // Nur wenn der Sampler nach dem Load tatsaechlich ready ist
        // (sonst war es ein stiller Lade-Fehler -> keine Endlos-Schleife).
        if (window.smplrSamplerIsReady(toneType)) {
          _playPreview(toneType);
        }
      }).catch(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setToneButtonsDisabled(false);
        // Lade-Fehler: keine Wiederholung, keine Tonwiedergabe.
      });
      return;
    }

    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setToneButtonsDisabled(true);

    var idx = 0;
    function nextStep() {
      if (idx >= seq.length) {
        playing = false;
        _setToneButtonsDisabled(false);
        return;
      }
      var step = seq[idx++];
      if (step && typeof step.pauseMs === 'number') {
        setTimeout(nextStep, step.pauseMs);
        return;
      }
      if (!step || typeof step.hz !== 'number' || typeof step.durationMs !== 'number') {
        nextStep();
        return;
      }
      var pan = (typeof step.pan === 'number') ? step.pan : 0;
      // BA 239: Korrektur-Toggles wirken auf vol pro Step.
      var effVol = vol;
      if (applyMeasLevels) {
        var measDb = _tpMeasDbForStep(step.hz, pan);
        if (measDb !== 0) effVol *= Math.pow(10, measDb / 20);
      }
      if (applyBalance) {
        var bal = _tpBalanceDbSym();
        var bDb = (pan < -0.01) ? bal.left
                : (pan >  0.01) ? bal.right
                : 0;
        if (bDb !== 0) effVol *= Math.pow(10, bDb / 20);
      }
      try {
        playToneTyped(c, step.hz, effVol, step.durationMs, pan, toneType);
      } catch (e) { /* swallow */ }
      setTimeout(nextStep, step.durationMs);
    }
    nextStep();
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
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (typeof cfg.onModalClose === 'function') cfg.onModalClose();
  }
  cancelBtn.addEventListener('click', function() {
    close();
  });
  okBtn.addEventListener('click', function() {
    if (selected !== initial) {
      cfg.setToneType(selected);
      if (typeof onChange === 'function') onChange();
    }
    close();
  });
}
