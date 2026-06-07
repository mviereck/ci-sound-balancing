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
//   _setPlayButtonsDisabled(flag)      — alle Vorspiel-Knoepfe sperren
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
function openToneSelectionDialog(cfg, onChange) {
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
      headKey: 'toneGroupMellotron',
      hintKey: 'toneGroupMellotronHint',
      items: [
        ['smplr:mellotron:300 STRINGS CELLO', null, null],
        ['smplr:mellotron:300 STRINGS VIOLA', null, null],
        ['smplr:mellotron:8VOICE CHOIR',      null, null],
        ['smplr:mellotron:BASSA+STRNGS',      null, null],
        ['smplr:mellotron:BOYS CHOIR',        null, null],
        ['smplr:mellotron:CHA CHA FLT',       null, null],
        ['smplr:mellotron:CHM CLARINET',      null, null],
        ['smplr:mellotron:CHMB 3 VLNS',       null, null],
        ['smplr:mellotron:CHMB ALTOSAX',      null, null],
        ['smplr:mellotron:CHMB FEMALE',       null, null],
        ['smplr:mellotron:CHMB MALE VC',      null, null],
        ['smplr:mellotron:CHMB TNR SAX',      null, null],
        ['smplr:mellotron:CHMB TRMBONE',      null, null],
        ['smplr:mellotron:CHMB TRUMPET',      null, null],
        ['smplr:mellotron:CHMBLN CELLO',      null, null],
        ['smplr:mellotron:CHMBLN FLUTE',      null, null],
        ['smplr:mellotron:CHMBLN OBOE',       null, null],
        ['smplr:mellotron:DIXIE+TRMBN',       null, null],
        ['smplr:mellotron:FOXTROT+SAX',       null, null],
        ['smplr:mellotron:HALFSP.BRASS',      null, null],
        ['smplr:mellotron:MIXED STRGS',       null, null],
        ['smplr:mellotron:MKII BRASS',        null, null],
        ['smplr:mellotron:MKII GUITAR',       null, null],
        ['smplr:mellotron:MKII ORGAN',        null, null],
        ['smplr:mellotron:MKII SAX',          null, null],
        ['smplr:mellotron:MKII VIBES',        null, null],
        ['smplr:mellotron:MKII VIOLINS',      null, null],
        ['smplr:mellotron:MOVE BS+STGS',      null, null],
        ['smplr:mellotron:STRGS+BRASS',       null, null],
        ['smplr:mellotron:TROMB+TRMPT',       null, null],
        ['smplr:mellotron:TRON 16VLNS',       null, null],
        ['smplr:mellotron:TRON CELLO',        null, null],
        ['smplr:mellotron:TRON FLUTE',        null, null],
        ['smplr:mellotron:TRON VIOLA',        null, null]
      ]
    }
  ];

  var initial = cfg.getToneType();
  var selected = initial;
  var playing = false;

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
        getCurrentToneType:  cfg.getToneType,
        onKeyPress:          cfg.onKeyPress,
        getDuration:         cfg.getDuration
      });
    } catch (e) { /* swallow — Klavier-Render-Fehler darf das Modal nicht killen */ }
  }

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
    list.style.cssText =
      'display:grid;grid-template-columns:auto 1fr auto auto;' +
      'gap:4px 10px;align-items:center;';

    grp.items.forEach(function(triple) {
      var key = triple[0], i18nKey = triple[1], descKey = triple[2];

      var rb = document.createElement('input');
      rb.type = 'radio';
      rb.name = 'tonePopupChoice';
      rb.value = key;
      rb.checked = (key === initial);
      rb.id = 'tonePopupRb_' + key;

      var lblBlock = document.createElement('label');
      lblBlock.htmlFor = rb.id;
      lblBlock.style.cssText =
        'cursor:pointer;display:flex;flex-direction:column;gap:1px;';

      var nameLine = document.createElement('span');
      var nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'font-size:.94em;';
      if (i18nKey) {
        nameSpan.dataset.t = i18nKey;
      } else {
        // BA 225: Fallback fuer Eintraege ohne i18n-Key (z. B. Mellotron-Varianten):
        // letzten Token-Teil als Label anzeigen.
        var lastColon = key.lastIndexOf(':');
        nameSpan.textContent = lastColon >= 0 ? key.substring(lastColon + 1) : key;
      }
      nameLine.appendChild(nameSpan);

      lblBlock.appendChild(nameLine);

      if (descKey) {
        var descSpan = document.createElement('span');
        descSpan.dataset.t = descKey;
        descSpan.style.cssText =
          'font-size:.82em;color:#666;line-height:1.3;';
        lblBlock.appendChild(descSpan);
      }

      var play = document.createElement('button');
      play.type = 'button';
      play.className = 'btn btn-small';
      play.dataset.t = 'tonePopupPlay';
      play.dataset.toneKey = key;
      play.style.cssText = 'min-width:90px;';
      // BA 226 Fix .3: Sanduhr ist eigenstaendiger Span vor dem Button
      // (4. Grid-Spalte). visibility:hidden statt display:none, damit der
      // Grid-Track immer reservierte Breite hat und das Layout sich beim
      // Ein-/Ausblenden nicht verschiebt (Layout-Chaos in Fix .2).
      var hgSpan = document.createElement('span');
      hgSpan.className = 'btn-hourglass';
      hgSpan.dataset.toneKey = key;
      hgSpan.style.cssText = 'visibility:hidden;font-size:1.6em;line-height:1;'
        + 'color:#d8a200;text-align:center;width:1.2em;display:inline-block;';
      hgSpan.textContent = '⧖';

      rb.addEventListener('change', function() {
        if (!rb.checked) return;
        selected = key;
        // BA 226: Bei smplr-Tonart Lade-Trigger im Hintergrund anstossen,
        // damit ein spaeterer Vorspiel-Klick weniger oder kein Warten erzeugt.
        // Vorspiel-Button bleibt klickbar (kein _setPlayButtonsDisabled),
        // aber die Sanduhr zeigt den Lade-Vorgang an.
        if (typeof key !== 'string' || key.indexOf('smplr:') !== 0) return;
        if (typeof window.smplrSamplerIsReady !== 'function' || window.smplrSamplerIsReady(key)) return;
        if (typeof window.loadSamplerByToken !== 'function') return;
        var c = (typeof gAC === 'function') ? gAC() : null;
        if (!c) return;
        _setHourglassFor(key, true);
        window.loadSamplerByToken(c, key).then(function () {
          _setHourglassFor(key, false);
        }).catch(function () {
          _setHourglassFor(key, false);
        });
      });
      play.addEventListener('click', function() {
        if (playing) return;
        _playPreview(key);
      });

      list.append(rb, lblBlock, hgSpan, play);
    });

    section.appendChild(list);
    dlg.appendChild(section);
  });

  // BA 226: Sanduhr ein-/ausblenden fuer den Button eines konkreten
  // toneType (Strings koennen Doppelpunkte und Leerzeichen enthalten,
  // deshalb ueber alle Buttons iterieren statt CSS-Selector).
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
      _setPlayButtonsDisabled(true);
      _setHourglassFor(toneType, true);
      window.loadSamplerByToken(c, toneType).then(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setPlayButtonsDisabled(false);
        // Sampler geladen -> Vorspielen jetzt regulaer.
        // Nur wenn der Sampler nach dem Load tatsaechlich ready ist
        // (sonst war es ein stiller Lade-Fehler -> keine Endlos-Schleife).
        if (window.smplrSamplerIsReady(toneType)) {
          _playPreview(toneType);
        }
      }).catch(function () {
        _setHourglassFor(toneType, false);
        playing = false;
        _setPlayButtonsDisabled(false);
        // Lade-Fehler: keine Wiederholung, keine Tonwiedergabe.
      });
      return;
    }

    var vol = (typeof cfg.getVolume === 'function') ? cfg.getVolume() : 0.25;
    playing = true;
    _setPlayButtonsDisabled(true);

    var idx = 0;
    function nextStep() {
      if (idx >= seq.length) {
        playing = false;
        _setPlayButtonsDisabled(false);
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
      try {
        playToneTyped(c, step.hz, vol, step.durationMs, pan, toneType);
      } catch (e) { /* swallow */ }
      setTimeout(nextStep, step.durationMs);
    }
    nextStep();
  }
  function _setPlayButtonsDisabled(flag) {
    var btns = dlg.querySelectorAll('button[data-tone-key]');
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
