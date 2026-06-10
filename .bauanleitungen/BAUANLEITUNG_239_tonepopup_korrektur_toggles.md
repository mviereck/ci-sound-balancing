# BA 239: Korrektur-Toggles im Tonart-Auswahl-Modal

## Ziel

Im modalen Tonart-Auswahl-Dialog (`js/tone-popup.js`,
`openToneSelectionDialog`) erhalten die Vorspiel-Töne zwei neue
Toggle-Schalter, mit denen der Nutzer die gemessenen Korrekturen
auf das Probehören aufprägen kann:

1. **Elektrodenlautstärke anwenden** — wendet pro Vorspiel-Step die
   Korrektur aus der Messung Elektrodenlautstärke-Balance an
   (analog zum Player-Toggle „Elektrodenlautstärke" /
   `plSrcMeas` / `levels[]`).
2. **Stereo-Balance anwenden** — wendet pro Vorspiel-Step den
   L↔R-Mittelwert-Versatz aus der Stereo-Balance-Messung an
   (analog zum Player-Toggle `plApplyBalance`).

Beide Toggles sind **Default an**, **grün/grau** wie die Player-
Toggles, **lokal** in der Modalbox (keine Bindung an die Player-
Variablen `plSrcMeas` / `plApplyBalance` / `plBalanceMode`), und
**immer aktivierbar** (auch bei einseitiger Vorspiel-Sequenz —
kein Ausgrauen).

Latenz-Toggle wird **nicht** umgesetzt: die Vorspielsequenzen sind
heute sequentiell (z. B. `freqmatch.js:1111`: hzLeft → pause →
hzRight), Inter-Ohr-Latenz hätte keine hörbare Wirkung.

Stereo-Balance wird **fest symmetrisch** angewandt (kein Lesen von
`plBalanceMode`).

i18n: nur Deutsch in dieser BA. EN/FR/ES als Folge-Mini-BA, wenn
der Nutzer es anordnet.

## Codestand (zur Orientierung, nicht ändern)

- `js/tone-popup.js`: `openToneSelectionDialog(cfg, onChange)`,
  innere Funktion `_playPreview(toneType)` ruft pro Step
  `playToneTyped(c, step.hz, vol, step.durationMs, pan, toneType)`
  (Z. 380–384).
- `js/player.js:216–234` (`computeGains`): Mess-Korrektur =
  `levels[i]` aus `compWLS()` (in `js/test.js:559`), nur wirksam
  wo `bRes` für die Elektrode `i` einen passenden Eintrag hat.
- `js/state-side.js:21` (`effFreq`) liefert die effektive Frequenz
  pro Elektrode der aktuellen Seite.
- `js/state-side.js:468` (`withSide`) rebindet `bRes`, `manualLevels`,
  `elSt`, `elExDur` etc. auf die andere Seite.
- `js/lr-balance.js:6`: `lrResults = {elIdx: offset_dB}` global
  (nicht side-bound; positive = rechts lauter).
- `js/audio.js:40`: `dB2G(d) = Math.pow(10, d/20)`.

## Schritte

### 1. i18n-Keys ergänzen — `i18n/de.js`

Nach dem bestehenden Block der `tonePopup*`-Keys (Z. ~1099,
direkt nach `tonePopupCancel`) zwei neue Keys einfügen:

```js
    tonePopupApplyMeas:    "Elektrodenlautstärke anwenden",
    tonePopupApplyBalance: "Stereo-Balance anwenden",
```

**Wichtig:** Keine typografischen Anführungszeichen in den
Werten, ASCII `"` als String-Begrenzer. (Anführungszeichen kommen
in beiden Werten nicht vor — keine Escape-Falle.)

EN/FR/ES bleiben unverändert; fehlende Keys fallen über `js/i18n.js`
auf die deutschen Defaults zurück.

### 2. Modal-State + Toggle-UI — `js/tone-popup.js`

Im Innern von `openToneSelectionDialog` (Z. 185 ff.) nach den
beiden Closure-Deklarationen `var selected = initial;` /
`var playing = false;` (Z. 188–189) zwei neue Closure-Flags
ergänzen:

```js
  // BA 239: Korrektur-Toggles, Default an, lokal in der Modal-Instanz.
  var applyMeasLevels = true;
  var applyBalance    = true;
```

Den UI-Block für die beiden Toggle-Buttons einfügen **nach dem
Hinweis-Banner** (`dlg.appendChild(hint);`, derzeit Z. 211) und
**vor dem optionalen Klavier-Block** (`if (cfg.keyboardMode …)`,
derzeit Z. 217):

```js
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
```

### 3. Korrektur-Helfer + Anwendung im Vorspiel — `js/tone-popup.js`

Direkt **vor** der inneren Funktion `_playPreview` (derzeit Z. 323)
zwei Helfer ergänzen, die Closure-Zugriff auf die globalen
State-Variablen (`withSide`, `compWLS`, `effFreq`, `elActive`,
`elSt`, `elExDur`, `bRes`, `lrResults`) nutzen:

```js
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
```

Dann den `playToneTyped`-Aufruf in `_playPreview` (derzeit Z. 380–384)
**ersetzen**. Vorher:

```js
      var pan = (typeof step.pan === 'number') ? step.pan : 0;
      try {
        playToneTyped(c, step.hz, vol, step.durationMs, pan, toneType);
      } catch (e) { /* swallow */ }
      setTimeout(nextStep, step.durationMs);
```

Nachher:

```js
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
```

### 4. Spec ergänzen — `docs/spec/02-messung.md`

In `docs/spec/02-messung.md` direkt **vor** dem Eintrag
„`- **Tonfolge** (`globalSequence`) — …`" (derzeit Z. 110)
einen neuen Absatz einfügen:

```markdown
  Korrektur-Toggles im Modal (seit BA 239): Oberhalb der Tonart-
  Gruppen (und ggf. oberhalb des Klavier-Widgets) zwei Toggle-
  Buttons (grün/grau analog Player). Default beide an, lokal in
  der Modal-Instanz (keine Kopplung an Player-Variablen):
  - **Elektrodenlautstärke anwenden** — pro Vorspiel-Step wird
    aus `step.hz` die nächste aktive Elektrode der Step-Seite
    (Pan→`withSide`) bestimmt und der dB-Wert aus `levels[]`
    (`compWLS()`, Ergebnis der Messung Elektrodenlautstärke-
    Balance) als vol-Faktor angewandt. Wirksamkeitsbedingung
    wie im Player: nur dort, wo `bRes` für die Elektrode einen
    Eintrag mit gültigen Endpunkten hat (sonst 0 dB).
  - **Stereo-Balance anwenden** — pro Step bekommt das vol je
    nach `step.pan` einen dB-Versatz aus dem Mittelwert von
    `lrResults`. Fest symmetrisch (`left = +b, right = -b` mit
    `b = -mean`), unabhängig vom Player-eigenen `plBalanceMode`.
    Immer aktivierbar (kein Ausgrauen bei einseitiger Sequenz —
    die Wirkung bleibt halt einseitig).
  Latenz-Anwendung im Modal entfällt: die Vorspielsequenzen sind
  heute sequentiell (siehe `freqmatch.js`), Inter-Ohr-Latenz
  hätte keine hörbare Wirkung.
```

### 5. CODESTRUKTUR ergänzen — `docs/CODESTRUKTUR.md`

Im Eintrag zu **`tone-popup.js`** (Zeile 148, beginnt mit
„`| 7a | tone-popup.js | …`") am Ende des Eintrags vor dem
abschließenden ` |` folgenden Satz anhängen:

```
 **Seit BA 239**: Zwei Closure-State-Flags `applyMeasLevels` und `applyBalance` (Default true) plus Toggle-Buttons (grün/grau analog Player, i18n `tonePopupApplyMeas`/`tonePopupApplyBalance`) zwischen Hinweis-Banner und Klavier-Block. Helfer `_tpMeasDbForStep(stepHz, stepPan)` (nutzt `withSide`/`compWLS`/`effFreq`/`elActive`/`elSt`/`elExDur`/`bRes`, Lookup auf nächste aktive Elektrode) und `_tpBalanceDbSym()` (Mittelwert von `lrResults`, fest symmetrisch). `_playPreview` multipliziert pro Step `effVol` mit den dB-Faktoren bevor `playToneTyped` aufgerufen wird; Latenz wird nicht angewandt (sequentielle Vorspielsequenzen).
```

### 6. Versionsbump — `js/version.js`

```js
const APP_VERSION = "3.2.239-beta";
```

(Aktueller Wert: `"3.2.238.2-beta"`.)

## Akzeptanztest (Nutzer durchklickbar)

Voraussetzung: Eine geladene oder frisch erfaßte Konfiguration
mit Mess-Daten aus „Elektrodenlautstärke-Balance" und
„Stereo-Balance". Optional ein Testlauf von Hand vor dem Test
(„Messungen → Elektrodenlautstärke" und „Messungen →
Stereo-Balance").

1. Tab **Messungen → Frequenzabgleich** öffnen, einen Verfahrens-
   und Tonart-Workflow starten, bis der Header-Button **Tonart
   wählen** sichtbar ist; auf den Button klicken.
   - Erwartet: Modal „Tonart wählen" öffnet sich.

2. Unter dem orangefarbenen Hinweis-Banner steht eine neue Zeile
   mit zwei grünen Buttons: **„Elektrodenlautstärke anwenden"**
   und **„Stereo-Balance anwenden"**. Beide sind grün hinterlegt
   (Default an).
   - Erwartet: beide Buttons sind grün, klickbar.

3. Auf eine Tonart klicken (z. B. „CI-Test harmonisch"). Die
   Vorspiel-Sequenz läuft mit beiden aktiven Toggles. Auf das Ohr
   achten: die Lautstärke pro Burst hängt von Elektrode + Seite
   ab (gemessene Korrektur), und der Stereo-Versatz ist hörbar
   (wenn `lrResults` einen Mittelwert ≠ 0 liefert).

4. **Elektrodenlautstärke anwenden** anklicken → Button wird grau,
   Beschriftung bleibt.
   - Erwartet: Beim nächsten Vorspiel-Klick einer Tonart sind alle
     Bursts nominell laut (keine Per-Elektroden-Korrektur).

5. **Stereo-Balance anwenden** anklicken → Button wird grau.
   - Erwartet: Beim nächsten Vorspiel-Klick einer Tonart spielen
     L und R nominell gleich (kein L↔R-Mittelwert-Versatz).

6. Modal schließen (Abbrechen oder OK), Modal erneut öffnen.
   - Erwartet: Beide Toggles sind wieder **grün** (Default an,
     lokal — keine Persistenz, keine Bindung an den Player-Tab).

7. **Negativ-Test 1 (keine Mess-Daten):** Auf eine Konfiguration
   wechseln, in der noch keine Elektrodenlautstärke-Messung
   stattgefunden hat (`bRes` leer). Modal öffnen, Tonart
   anhören mit beiden Toggles grün. Es darf **kein Fehler in der
   Konsole** stehen, der Vorspiel-Ton kommt nominell laut.

8. **Negativ-Test 2 (keine Stereo-Balance):** `lrResults` leer.
   Modal öffnen, Tonart anhören. Stereo-Balance-Toggle hat keine
   Wirkung (kein Fehler, kein Versatz).

9. Im Player-Tab den dortigen „Elektrodenlautstärke"-Quellen-
   Toggle (`plSrcMeas`) ausschalten, dann wieder ins Modal
   gehen. Der Modal-Toggle ist **trotzdem grün** und wirkt
   unabhängig (keine Kopplung an den Player).

## Selbstprüfung durch Sonnet (vor der Fertig-Meldung)

Vor der Fertig-Meldung Punkt für Punkt durchgehen und für jedes
„erfüllt / nicht erfüllt / unklar" mit Datei + Zeile melden:

- [ ] `js/version.js` zeigt `"3.2.239-beta"`.
- [ ] `i18n/de.js` enthält `tonePopupApplyMeas` und
      `tonePopupApplyBalance` mit den richtigen deutschen Werten.
- [ ] In `js/tone-popup.js` sind zwischen Hinweis-Banner und
      Klavier-Block-Bedingung die beiden Toggle-Buttons mit
      `dataset.t`, dem `_tpUpdToggleStyle`-Helper und Click-
      Handlern eingefügt.
- [ ] Die beiden Closure-Flags `applyMeasLevels` und
      `applyBalance` stehen oben in `openToneSelectionDialog`,
      Default `true`.
- [ ] Die Helfer `_tpMeasDbForStep` und `_tpBalanceDbSym` stehen
      **vor** der Definition von `_playPreview` und nutzen
      `withSide` / `compWLS` / `effFreq` / `lrResults` korrekt
      (jeweils mit `typeof`-Guards).
- [ ] `_playPreview` ruft `playToneTyped` mit `effVol` statt `vol`,
      nachdem beide Toggles berücksichtigt wurden. Die `pauseMs`-
      und `nextStep`-Pfade sind unverändert.
- [ ] `docs/spec/02-messung.md` enthält den neuen Absatz zu den
      Korrektur-Toggles direkt vor dem `**Tonfolge**`-Eintrag.
- [ ] `docs/CODESTRUKTUR.md` enthält den `**Seit BA 239**`-Satz
      im Eintrag zu `tone-popup.js`.
- [ ] Browser-Konsole bleibt nach dem ersten Öffnen des Modals
      und einem Vorspiel-Klick fehlerfrei.

## Hinweis: Übersetzungen

Die beiden neuen i18n-Keys (`tonePopupApplyMeas`,
`tonePopupApplyBalance`) sind nur in `i18n/de.js` ergänzt. EN/FR/ES
fallen über den i18n-Fallback auf die deutschen Werte zurück.
Wenn die deutsche Formulierung steht, kann eine Mini-Folge-BA
„Übersetzungen für BA 239" die drei anderen Sprachen nachziehen.
