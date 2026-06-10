# Bauanleitung 19: MAPLAW Audio-Graph-Integration im Player

Zweite von drei Bauanleitungen (18/19/20) zur MAPLAW-Simulation
Phase 3. Setzt Bauanleitung 18 voraus (`maplaw.js` mit Worklet
liegt vor). Diese Anleitung hängt den MAPLAW-Worklet in den
Player-Audio-Graph ein — **ohne** UI (kommt in 20).

Nach dieser Anleitung ist die MAPLAW-Simulation funktional
aktivierbar, aber nur per Browser-Konsole (manuelles Setzen von
`pMaplawOn = true; pMaplawSollC = 500; pMaplawTrigger();`).

## Architektur-Erinnerung

Audio-Pfad-Position nach Konzept-Papier:

```
Source
  → [Frequenz-Warping, falls aktiv]
  → Tool-EQ (Mono pEqF oder Stereo pEqFLeft/pEqFRight + Splitter/Merger)
  → [MAPLAW-Worklet, falls aktiv und MED-EL]   ← NEU
  → pGain
  → Destination
```

**Vereinfachung für diese Bauanleitung**: ein einziger MAPLAW-Node
hinter dem letzten EQ-Knoten (auch bei Stereo nach dem
`pChannelMerger`). Damit verwenden wir **einen gemeinsamen
Ist-c-Wert** — den der aktiven Seite. Bei bilateralen MED-EL-
Setups mit zwei unterschiedlichen `cValue` ist das eine
Vereinfachung; bilaterale Trennung mit zwei MAPLAW-Nodes ist als
spätere Erweiterung vorgesehen, nicht Teil dieser Anleitung. Der
unilaterale Standardfall (Martin & Co) ist davon nicht
betroffen.

## 1. Neue State-Variablen in `player.js`

Im State-Block am Anfang von `player.js` (Z. 4–24, dort wo
`pMapNode`, `pGain` etc. deklariert sind) folgende Variablen
ergänzen — direkt nach `pMapNode = null,`:

```js
  pMaplawOn = false,
  pMaplawSollC = 1000,
  pMaplawNode = null,
```

Diese Variablen sind global, analog zu den anderen Player-State-
Variablen.

## 2. Helper-Funktionen in `player.js`

Folgende Helper-Funktionen ans Ende von `player.js` anhängen
(nach `pUpdBtn`, vor `pFmt` falls vorhanden — Sonnet: finde
einen passenden Platz im Stil der existierenden Helper):

```js
// Liefert den Ist-c für die MAPLAW-Vorverzerrung. Quelle:
// implant.cValue der aktiven Seite. Falls nicht gesetzt: 1000
// als Fallback (Standard-c-Wert in MAESTRO).
function pMaplawGetIstC() {
  const s = sideData[activeSide];
  if (s && s.implant && typeof s.implant.cValue === "number" && s.implant.cValue > 0) {
    return s.implant.cValue;
  }
  return 1000;
}

// Prüft, ob die MAPLAW-Simulation für die aktuelle Konfiguration
// anwendbar ist. Heute: nur wenn die aktive Seite MED-EL ist.
// Bei Stereo-Wiedergabe „both": ausreichend, wenn mindestens
// eine Seite MED-EL ist (die andere Seite läuft durch den
// gleichen Worklet, aber sollten beide MED-EL sein, hört Martin
// auf beiden Seiten den Effekt; ist nur eine MED-EL, ist die
// andere Cochlear/AB und die Modifikation passt zwar nicht
// theoretisch, ist aber harmlos und nur ein Demo-Effekt).
function pMaplawIsApplicable() {
  if (mfr === "medel") return true;
  // Stereo-Wiedergabe: andere Seite prüfen
  const mode = (typeof getPlayerSide === "function") ? getPlayerSide() : null;
  if (mode === "both" || mode === "mono") {
    const other = activeSide === "left" ? "right" : "left";
    if (sideData[other] && sideData[other].manufacturer === "medel") return true;
  }
  return false;
}
```

## 3. Audio-Graph-Verdrahtung in `pPlay`

In `player.js`, in der `pPlay`-Funktion (beginnt bei ca. Z. 433),
**unmittelbar nach** der bestehenden Zeile
`if (lastEq) lastEq.connect(pGain);` folgenden Block einfügen:

**Hinweis**: die bestehende Zeile sieht aktuell etwa so aus:

```js
  if (lastEq) lastEq.connect(pGain);
```

Sie wird durch folgenden Block ersetzt:

```js
  // MAPLAW: zwischen letztem EQ-Knoten und pGain einhängen, falls
  // aktiv und MED-EL erkannt. EQ-Toggle wirkt als Master-Bypass
  // (wenn EQ aus, ist MAPLAW auch aus — analog Frequenz-Warping).
  const mapApplies = pMaplawOn && plEqOn && pMaplawIsApplicable();
  if (mapApplies) {
    await pInitMaplawWorklet(c);
    pMaplawNode = pBuildMaplawNode(c, {
      istC: pMaplawGetIstC(),
      sollC: pMaplawSollC,
      active: true,
    });
    if (lastEq) {
      lastEq.connect(pMaplawNode);
    }
    pMaplawNode.connect(pGain);
  } else {
    if (lastEq) lastEq.connect(pGain);
    pMaplawNode = null;
  }
```

**Wichtig**: weil dieser Block `await pInitMaplawWorklet(c)`
enthält, kann während des Awaits Pause/Stop gedrückt werden. Die
bestehende Generation-Check-Logik (`if (gen !== pPlayGen) { ...
return; }`) muß nach dem Worklet-Await greifen. Sonnet: prüfe
nach dem await `pInitMaplawWorklet`, ob `gen !== pPlayGen` —
falls ja, abbrechen wie beim Vocoder-Path.

Vorschlag konkret:

```js
  const mapApplies = pMaplawOn && plEqOn && pMaplawIsApplicable();
  if (mapApplies) {
    await pInitMaplawWorklet(c);
    if (gen !== pPlayGen) {
      // Pause/Stop während Worklet-Init gedrückt
      return;
    }
    pMaplawNode = pBuildMaplawNode(c, {
      istC: pMaplawGetIstC(),
      sollC: pMaplawSollC,
      active: true,
    });
    if (lastEq) lastEq.connect(pMaplawNode);
    pMaplawNode.connect(pGain);
  } else {
    if (lastEq) lastEq.connect(pGain);
    pMaplawNode = null;
  }
```

## 4. Cleanup in `pPause`

In `pPause` (ca. Z. 533), nach dem `pCurrentPlayback`-Cleanup-
Block (ca. Z. 540–551), folgenden Block ergänzen:

```js
  if (pMaplawNode) {
    try { pMaplawNode.disconnect(); } catch (e) {}
    pMaplawNode = null;
  }
```

## 5. Live-Update für Soll-c und Toggle während Wiedergabe

Folgende globale Funktion ans Ende von `player.js` anhängen:

```js
// Wird aufgerufen, wenn der User die MAPLAW-UI bedient (Toggle
// an/aus oder Soll-c geändert). Während Wiedergabe: zwei Fälle.
//   1) MAPLAW war aus, soll an → Pfadwechsel via pause/resume.
//   2) MAPLAW war an, Soll-c oder Toggle ändert sich → bei
//      bestehendem Node: postMessage an Worklet. Bei Wechsel
//      "an↔aus": Pfadwechsel via pause/resume.
function pMaplawTrigger() {
  // Während keine Wiedergabe läuft: nichts tun, der nächste
  // pPlay-Aufruf greift die neuen State-Werte automatisch auf.
  if (!pPlaying) return;

  const shouldBeOn = pMaplawOn && plEqOn && pMaplawIsApplicable();
  const isOn = !!pMaplawNode;

  if (shouldBeOn && isOn) {
    // Reine Parameter-Aktualisierung — keine Graph-Umverdrahtung.
    pMaplawApplyParams(pMaplawNode, {
      istC: pMaplawGetIstC(),
      sollC: pMaplawSollC,
      active: true,
    });
    return;
  }

  if (shouldBeOn !== isOn) {
    // Topologie-Wechsel: pPause + pPlay (kurze Pause).
    const offSec = pCtx ? Math.max(0, pCtx.currentTime - pT0) : 0;
    pPause();
    pOff = offSec;
    pPlay();
  }
}
```

## 6. EQ-Toggle: Master-Bypass auch für MAPLAW

In `init.js`, im EQ-Toggle-Handler (`plEqToggle`-Click,
ca. Z. 669 ff.), analog zur bestehenden Logik für Frequenz-
Warping einen Trigger für MAPLAW ergänzen. **Suche** nach der
Stelle, wo `pWarpTrigger()` oder analoge Warping-Logik nach
dem EQ-Toggle aufgerufen wird, und ergänze direkt danach:

```js
      if (typeof pMaplawTrigger === "function") pMaplawTrigger();
```

Sonnet: wenn unklar wo, frage nach. Wichtig ist nur, daß der
MAPLAW-Pfad bei EQ-Toggle aus/an entsprechend umverdrahtet wird.

## 7. CODESTRUKTUR.md ergänzen

In CODESTRUKTUR.md, im player.js-Eintrag (Modul-Tabelle), die
State-Variablen-Liste um `pMaplawOn`, `pMaplawSollC`,
`pMaplawNode` ergänzen. Außerdem im Datenfluß-Abschnitt einen
neuen Block einfügen:

```
**MAPLAW-Simulation (Phase 3, MED-EL):** Bandweise Hüllkurven-
Vorverzerrung Ist⁻¹∘Soll im AudioWorklet aus `maplaw.js`. Wird in
`pPlay` zwischen letztem EQ-Knoten und `pGain` eingehängt, wenn
`pMaplawOn` und `plEqOn` (EQ-Toggle als Master-Bypass) und
`pMaplawIsApplicable()` (mindestens eine Seite MED-EL). Live-
Updates von `pMaplawSollC` während Wiedergabe via `pMaplawTrigger`
(postMessage an Worklet). Ist-c kommt aus
`sideData[activeSide].implant.cValue`. Bilaterale Trennung mit
zwei Worklets ist nicht implementiert — der unilaterale
Standardfall ist abgedeckt.
```

## Nicht zu tun

- **Keine** UI in `index.html` einbauen oder die existierende
  versteckte UI einblenden.
- **Keinen** existierenden WaveShaper-Code (`pBuildMapNode`)
  anfassen. Bleibt als toter Code; Entfernung in Bauanleitung 20.
- `freq-warp.js` und `maplaw.js` (Bauanleitung 18) unverändert
  lassen.
- Keine Persistenz von `pMaplawOn`/`pMaplawSollC` in JSON oder
  localStorage einbauen — kommt in Bauanleitung 20.
- Bilaterale Stereo-Trennung mit zwei MAPLAW-Nodes nicht
  implementieren — bewußte Vereinfachung, später als
  Folgeauftrag.

## Akzeptanztest (vom Nutzer durchzugehen)

**Vorbereitung**: Tool laden, im Implantat-Tab für die aktive
Seite `cValue = 1000` setzen (oder dein realer Wert). Eine kurze
Audio-Datei (~30 Sek Sprache) laden und kurz abspielen
(Regression-Check, kein MAPLAW aktiv → Tool funktioniert wie
zuvor).

1. **Konsolen-Aktivierung** (ohne UI): in der Browser-Konsole:
   ```js
   pMaplawOn = true;
   pMaplawSollC = 500;
   ```
   Audio abspielen. Erwartet: hörbarer Klangunterschied gegenüber
   Wiedergabe ohne MAPLAW. Effekt: leise Anteile tendenziell
   leiser, der CI macht das anschließend mit c=1000 wieder „groß"
   — Klangcharakter sollte „in Richtung c=500" gehen.

2. **Live-Update Soll-c während Wiedergabe**: Audio läuft mit
   Soll-c=500. In der Konsole:
   ```js
   pMaplawSollC = 2000;
   pMaplawTrigger();
   ```
   Erwartet: klanglicher Wechsel innerhalb von Millisekunden,
   keine Pause-Lücke. Audio läuft weiter.

3. **Live-Update Toggle aus**: in der Konsole:
   ```js
   pMaplawOn = false;
   pMaplawTrigger();
   ```
   Erwartet: kurze Audio-Pause (Pfadwechsel via pPause+pPlay),
   dann Wiedergabe ohne MAPLAW-Effekt — Original-Klang.

4. **EQ-Toggle als Master-Bypass**: `pMaplawOn = true;` setzen,
   dann den UI-Schalter „Equalizer an/aus" klicken. Erwartet:
   wenn EQ aus, ist MAPLAW automatisch auch aus. Wenn EQ wieder
   an, ist MAPLAW wieder an.

5. **Hersteller-Gate**: aktive Seite auf Cochlear stellen
   (Implantat-Tab → Hersteller). In der Konsole `pMaplawOn = true;
   pMaplawTrigger();`. Erwartet: keine MAPLAW-Anwendung
   (`pMaplawIsApplicable()` liefert false), Wiedergabe ist
   Original-Klang.

6. **Regression**: ohne MAPLAW (Toggle aus) — Wiedergabe,
   Frequenz-Warping, Side-Wechsel, EQ-Stärke, Stereo-Modi alle
   wie zuvor.

7. **Identity bei istC == sollC**: `pMaplawOn = true; pMaplawSollC
   = 1000;` (gleich Ist-c). Klanglich sollte Wiedergabe nicht von
   Original unterscheidbar sein (oder höchstens minimaler
   Filterbank-Artefakt durch die 12 Bandpässe; bei guter
   Q-Wahl praktisch nicht hörbar). Wenn deutlich hörbar:
   Filterbank-Implementierung in Bauanleitung 18 prüfen.

## Selbstprüfungs-Auftrag an Sonnet

| Punkt | Erfüllt / Nicht erfüllt / Unklar | Datei + Zeile |
|------|-----------------------------------|---------------|
| State-Variablen `pMaplawOn`, `pMaplawSollC`, `pMaplawNode` im player.js-State-Block | | |
| `pMaplawGetIstC()` und `pMaplawIsApplicable()` als globale Funktionen | | |
| `pPlay`: MAPLAW-Block zwischen lastEq und pGain eingehängt, mit `await pInitMaplawWorklet(c)` und Generation-Check | | |
| `pPause`: pMaplawNode disconnected und auf null gesetzt | | |
| `pMaplawTrigger()` global verfügbar, behandelt Param-Update (postMessage) vs. Topologie-Wechsel (pPause+pPlay) | | |
| EQ-Toggle-Handler ruft `pMaplawTrigger()` als Master-Bypass | | |
| CODESTRUKTUR.md aktualisiert (State-Liste in player.js-Zeile + neuer Datenfluß-Block) | | |
| Bauanleitung 18 (maplaw.js) unverändert | | |
| pBuildMapNode (alter WaveShaper) unverändert | | |
| Konsolen-Test 1 (Soll-c=500 hörbar anderer Klang) bestanden | | |
| Konsolen-Test 4 (EQ-Toggle als Master-Bypass) bestanden | | |
| Konsolen-Test 7 (Identity bei sollC=istC) klingt wie Original | | |

Bei Unklarheiten oder ungewollten Klang-Artefakten (Aliasing,
Pumpen, Knack): vor Fertig-Meldung fragen. Im Zweifel: lieber
mehr Detail-Bericht als Verschleierung.
