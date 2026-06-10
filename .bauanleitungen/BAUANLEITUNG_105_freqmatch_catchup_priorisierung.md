# BAUANLEITUNG 105 — Catch-up-Priorisierung (α)

**Voraussetzung:** BA 102–104 sind abgenommen. Slider-Vor-Schätzung und
adaptive Startwerte funktionieren wie spezifiziert.

**Ziel:** Tracks, die im laufenden Test deutlich hinter den übrigen
zurückbleiben (noch keine oder erst eine einzige Umkehrung), bekommen
**pro Runde ein zusätzliches „Bonus-Trial" ganz am Anfang der Runde**.
Damit holen langsame Tracks auf, ohne daß die reguläre Round-Robin-
Fairness gebrochen wird — jeder Track bekommt weiterhin sein reguläres
Pro-Runde-Trial, der Bonus liegt obendrauf.

**Reihenfolge in der Serie:** 102 → 103 → 104 → **105 (dies, letzte
der Serie).**

**Volumen:** ein Sonnet-Chat. Diese Anleitung ist kurz und lokal —
nur eine Code-Stelle in `freqmatch-staircase.js`, dazu Spec und
CODESTRUKTUR.

---

## 1. Versionsbump

In `js/version.js`:

```js
const APP_VERSION = "3.0.105-beta";
```

---

## 2. Neue Konstante

In `js/freqmatch-staircase.js`, im Konstanten-Block (ca. Z. 14–36),
ergänzen:

```js
// Catch-up-Priorisierung (BA 105): Tracks mit weniger als
// FM_CATCHUP_REVERSALS_THRESHOLD Umkehrungen werden pro Runde mit einem
// zusätzlichen Bonus-Trial bedacht (falls es andere Tracks gibt, die
// bereits weiter sind). Schwelle 2 entspricht der `in-progress`-Grenze:
// wer noch <2 Umkehrungen hat, liefert noch kein Zwischenergebnis.
const FM_CATCHUP_REVERSALS_THRESHOLD = 2;
```

---

## 3. `fmPickNextTrack` erweitern

In `js/freqmatch-staircase.js`, Funktion `fmPickNextTrack` (Z. 75–116).

Wir ergänzen die Logik **nur im Neue-Runde-Pfad** (also dort, wo nach
dem Konsumieren der alten Round-Queue eine neue Runde aufgebaut wird).
Der Anker-Randomisierungs-Pfad bei kleinem Pool (`activeIds.length <
FM_ANCHOR_SMALL_POOL`, Z. 88–97) bleibt **unverändert**.

**Vorher (Z. 99–116):**
```js
  // --- Normaler Modus: geshuffelter Round-Robin ---
  while (state.roundQueue && state.roundQueue.length > 0) {
    const cand = state.roundQueue.shift();
    if (tracks[cand] && tracks[cand].status === 'active') {
      return cand;
    }
  }

  // Neue Runde: aktive IDs in zufälliger Reihenfolge in die Queue
  // schreiben. Fisher-Yates-Shuffle.
  const shuffled = activeIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  state.roundQueue = shuffled;
  return state.roundQueue.shift();
}
```

**Nachher:**
```js
  // --- Normaler Modus: geshuffelter Round-Robin ---
  while (state.roundQueue && state.roundQueue.length > 0) {
    const cand = state.roundQueue.shift();
    if (tracks[cand] && tracks[cand].status === 'active') {
      return cand;
    }
  }

  // Neue Runde: aktive IDs in zufälliger Reihenfolge in die Queue
  // schreiben. Fisher-Yates-Shuffle.
  const shuffled = activeIds.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
  }
  state.roundQueue = shuffled;

  // --- Catch-up-Priorisierung (BA 105) ---
  // Tracks mit <FM_CATCHUP_REVERSALS_THRESHOLD Umkehrungen sind „lagging"
  // (liefern noch kein Zwischenergebnis). Wenn es solche gibt UND
  // mindestens ein anderer Track schon weiter ist, wird einer der
  // lagging Tracks per Bonus-Trial der Runde vorangestellt.
  //
  // Anti-Wiederholungs-Sperre: der Bonus-Track darf nicht unmittelbar
  // vor seinem regulären Runden-Eintrag liegen. Wenn er nach dem
  // Shuffle zufällig schon an Position 0 steht, tausche ihn mit
  // Position 1, bevor der Bonus vorangestellt wird.
  const lagging = activeIds.filter(function(k) {
    const tr = tracks[k];
    return tr && (tr.reversals.length || 0) < FM_CATCHUP_REVERSALS_THRESHOLD;
  });
  const hasAdvanced = activeIds.some(function(k) {
    const tr = tracks[k];
    return tr && (tr.reversals.length || 0) >= FM_CATCHUP_REVERSALS_THRESHOLD;
  });
  if (lagging.length > 0 && hasAdvanced) {
    const bonusKey = lagging[Math.floor(r() * lagging.length)];
    // Wenn Bonus-Track aktuell an Index 0 der Runde steht: mit Index 1
    // tauschen, damit nach dem Bonus ein anderer Track kommt.
    if (state.roundQueue.length >= 2 && state.roundQueue[0] === bonusKey) {
      const tmp = state.roundQueue[0];
      state.roundQueue[0] = state.roundQueue[1];
      state.roundQueue[1] = tmp;
    }
    // Bonus voranstellen.
    state.roundQueue.unshift(bonusKey);
  }

  return state.roundQueue.shift();
}
```

**Wichtig — keine Reassignment-Falle:** `state.roundQueue` wird in-place
mutiert (`.unshift`, indexierte Zuweisung) — der Aufrufer in
`freqmatch.js` sieht die Änderungen über den `state`-Referenzdurchgriff.
Die existierende Funktion macht es schon so, BA 105 bleibt konsistent.

---

## 4. Konsistenz mit Anker-Randomisierung (kleiner Pool)

Wenn `activeIds.length < FM_ANCHOR_SMALL_POOL` (also < 4) ist, greift
der Anker-Randomisierungs-Pfad (Z. 88–97). Catch-up wird in diesem
Pfad **nicht** angewandt. Begründung: bei nur 1–3 aktiven Tracks ist
die Anti-Wiederholungs-Sperre kaum machbar (zu wenig „andere" Tracks),
und in der Endphase eines Tests dominiert ohnehin die Konvergenz-
Feinarbeit der wenigen verbliebenen Tracks. Sonnet, bitte nicht
versuchen, Catch-up auch im kleinen Pool zu aktivieren.

---

## 5. SPEC-Update

In `docs/spec/02b-freqmatch-adaptiv.md`:

### 5.1 Abschnitt „Verfahren im Überblick" erweitern

Im Aufzählungspunkt zur Tracks-Reihenfolge (heute: „Tracks laufen
verschränkt als geshuffelter Round-Robin … Tracks, die innerhalb der
Runde konvergieren, fallen aus dem Rest der Runde raus.") am Ende
einfügen:

> **Catch-up-Priorisierung (ab BA 105):** Zu Beginn jeder neuen Runde
> wird geprüft, ob es Tracks mit weniger als 2 Umkehrungen gibt
> (Konstante `FM_CATCHUP_REVERSALS_THRESHOLD = 2`, entspricht der
> `in-progress`-Schwelle). Wenn solche „lagging" Tracks existieren UND
> mindestens ein anderer Track bereits ≥ 2 Umkehrungen hat, wird einer
> der lagging Tracks zufällig ausgewählt und als zusätzliches
> Bonus-Trial der Runde vorangestellt. Anti-Wiederholungs-Sperre: der
> Bonus-Track darf nicht direkt vor seinem regulären Runden-Eintrag
> liegen; falls er nach dem Shuffle ohnehin an erster Stelle stünde,
> wird er vor dem Voranstellen mit Position 1 getauscht. Der reguläre
> Round-Robin (jeder aktive Track 1× pro Runde) bleibt unverändert —
> der Bonus liegt obendrauf.
>
> **Wirkung:** Tracks mit ungünstigem Startoffset (großer Mismatch,
> oder erste Umkehrung erfordert mehrere 50-cent-Schritte) holen schneller
> in den Bereich auf, in dem sie ein Zwischenergebnis liefern können.
> Tracks, die `not-perceivable` werden, werden über die normale
> Catch-Statistik abgefangen, **nicht** durch Catch-up-Bonuse
> disproportional gefördert — die Catch-Schwelle bleibt 8 Trials zwischen
> Catches, der Bonus erzeugt keine zusätzlichen Catches.

### 5.2 Abschnitt „Fortschritt" prüfen

Die Fortschritts-Formel (`min(reversals / 8, 0,95)` pro aktivem Track)
bleibt unverändert — Catch-up gibt nur mehr Trials, die zählen automatisch
über die normale Umkehrungs-Statistik.

---

## 6. CODESTRUKTUR-Update

In `docs/CODESTRUKTUR.md`, `freqmatch-staircase.js`-Eintrag (Zeile 144):

- Neue Konstante `FM_CATCHUP_REVERSALS_THRESHOLD = 2` in der Konstanten-
  Auflistung ergänzen.
- Ergänzen: „Seit BA 105: `fmPickNextTrack` ergänzt im Neuaufbau einer
  Round-Queue einen optionalen Bonus-Trial für einen zufällig gewählten
  Track mit `<FM_CATCHUP_REVERSALS_THRESHOLD` Umkehrungen, sofern
  mindestens ein anderer Track die Schwelle bereits überschritten hat.
  Anti-Wiederholungs-Sperre über Positionstausch im bereits geshuffelten
  Queue. Greift nur im normalen Round-Robin-Pfad, nicht im kleinen Pool
  (`<FM_ANCHOR_SMALL_POOL`)."

---

## 7. Akzeptanztest-Checkliste

### 7.1 Unit-artiger Konsolen-Test (Sonnet ausführen lassen, Markdown-Output)

Sonnet, bitte am Ende der Bauanleitung einen **Bau-Diagnose-Test**
nach BA 83-Konvention in `js/debug-tests-current.js` ablegen:

```js
// BA 105 — Catch-up-Priorisierung
dbg.test('build/BA105/catchup-priorisierung', {
  tab: 'freqmatch',
  label: 'Catch-up bevorzugt lagging Tracks',
  run: function() {
    const result = { ok: true, details: [] };
    // Mock-Tracks: 6 Tracks, 5 davon mit 3 Umkehrungen, 1 ("E5") ohne.
    const tracks = {};
    ['0','1','2','3','4','5'].forEach(function(k) {
      tracks[k] = {
        electrodeIdx: parseInt(k, 10),
        status: 'active',
        reversals: (k === '5') ? [] : [10, -10, 5]
      };
    });
    const state = { tracks: tracks, roundQueue: [] };
    const seed = (function() { var s = 12345;
      return function() { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    })();
    // Erster Pick triggert Neue-Runden-Bau und sollte mit hoher
    // Wahrscheinlichkeit (für unsere Seed konkret) den lagging Track
    // priorisieren.
    const firstPick = fmPickNextTrack(state, seed, null);
    if (firstPick !== '5') {
      result.ok = false;
      result.details.push('Erster Pick ist nicht der lagging Track (E5): got=' + firstPick);
    }
    // Zweiter Pick darf nicht wieder E5 sein (Anti-Wiederholungs-Sperre).
    const secondPick = fmPickNextTrack(state, seed, firstPick);
    if (secondPick === '5') {
      result.ok = false;
      result.details.push('Zweiter Pick ist erneut E5 (Anti-Wiederhol fehlgeschlagen)');
    }
    // E5 muß im Verlauf der Runde noch ein reguläres Mal kommen
    // (also insgesamt 2x, einmal Bonus + einmal regulär).
    const restPicks = [];
    let p;
    while ((p = fmPickNextTrack(state, seed, restPicks[restPicks.length-1])) != null) {
      // Markiere als „konvergiert" um die while-Schleife zu beenden, sobald
      // alles einmal durch ist
      tracks[p].status = 'converged';
      restPicks.push(p);
    }
    const totalE5 = (firstPick === '5' ? 1 : 0)
                  + (secondPick === '5' ? 1 : 0)
                  + restPicks.filter(function(x) { return x === '5'; }).length;
    if (totalE5 < 2) {
      result.ok = false;
      result.details.push('E5 nur ' + totalE5 + '× in der Runde, erwartet ≥2 (Bonus + regulär)');
    }
    return result;
  }
});
```

Sonnet, bitte den Test wirklich ablegen und den Nutzer bitten, das
Debug-Panel zu öffnen, den Test auszuführen und die Markdown-Ausgabe
zurückzuschicken. Wenn die Ausgabe „ok=true" zeigt, ist die Mechanik
verifiziert.

Anschließend (nach Abnahme durch den Nutzer): den Test ersatzlos aus
`js/debug-tests-current.js` entfernen ODER ins Archiv
`archive/debug-tests/BA105_catchup_priorisierung.js` verschieben — den
Nutzer aktiv fragen, welches.

### 7.2 Manuelle Akzeptanztests

1. **Klassischer Lauf, kein Catch-up notwendig.** Slider-Estimates oder
   typische Mismatches < 100 cent, alle Tracks erreichen schnell
   ihre 2. Umkehrung. **Erwartet:** Catch-up greift selten (bzw. nur
   in den ersten 1-2 Runden), Test verläuft im Wesentlichen wie
   bisher.
2. **Lauf ohne Schätzung, mit großem Mismatch (z. B. 250 cent) auf
   einer Elektrode.** Diese Elektrode landet nach Runde 1 mit 0
   Umkehrungen (echter PSE noch nicht überquert), während andere
   Elektroden teilweise schon Umkehrungen haben. **Erwartet:** Beim
   Aufbau von Runde 2 wird die langsame Elektrode mit Bonus
   priorisiert (Konsole `_fmDbg`-Spur oder Inspektion von
   `fmRoundQueue` zeigt sie vorangestellt). Die langsame Elektrode
   reicht ihre 2. Umkehrung früher ein, als sie es ohne Catch-up
   getan hätte.
3. **Mehrere lagging Tracks gleichzeitig.** Z. B. 3 von 12 Elektroden
   haben weiterhin 0 Umkehrungen. **Erwartet:** Pro Runde wird **einer
   davon zufällig** mit Bonus belegt — nicht alle gleichzeitig.
4. **Alle aktiven Tracks sind lagging** (kurz nach Test-Start, alle
   noch <2 Umkehrungen). **Erwartet:** Catch-up greift NICHT, weil
   `hasAdvanced === false`. Regulärer Round-Robin läuft unverändert.
5. **Pause/Resume während Catch-up-Lauf.** Test abbrechen, Restart.
   **Erwartet:** `_fmTryRestore` rekonstruiert den Pausen-State,
   `fmRoundQueue` wird mitgeladen. Catch-up entscheidet beim nächsten
   Neuaufbau einer Runde frisch — keine spezielle Persistenz
   notwendig.
6. **Edge-Case kleiner Pool** (`<4` aktive Tracks): Anker-
   Randomisierungs-Pfad greift, Catch-up greift nicht. Verhalten wie
   bisher.

---

## 8. Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung pro Akzeptanz-Kriterium **erfüllt / nicht erfüllt
/ unklar** mit Datei+Zeile melden.

Zusätzlich prüfen:
- **State-Mutation:** `state.roundQueue` wird konsequent in-place
  mutiert. Nie reassigned (`state.roundQueue = ...`) **außerhalb** der
  existierenden Stelle `state.roundQueue = shuffled` (Neuaufbau).
- **Edge-Case `state.roundQueue.length === 1` nach Shuffle**: wenn nur
  ein einziger aktiver Track existiert (kann der normale Pfad das?
  Eher selten, weil `<FM_ANCHOR_SMALL_POOL = 4` schon vorher abzweigt
  — aber wenn der Pfad doch eintritt) und der bonusKey identisch ist,
  greift die `length >= 2`-Bedingung beim Tausch nicht, der Bonus
  wird ohne Tausch vorangestellt. Bonus = einziger Eintrag = direkter
  Selbst-Wiederhol. In der Praxis kann das nicht vorkommen
  (`<FM_ANCHOR_SMALL_POOL`-Branch fängt das). Sonnet bitte
  verifizieren, daß es wirklich nicht eintritt — sonst eine
  Schutz-Bedingung `if (state.roundQueue.length >= 2)` um den Bonus-
  Block ziehen.
- **Zwei Schwellen-Falle:** Diese Anleitung führt **eine** Konstante
  (`FM_CATCHUP_REVERSALS_THRESHOLD = 2`) ein. Sie wird an **zwei**
  Code-Stellen referenziert (lagging-Filter und hasAdvanced-Check).
  Beide müssen dieselbe Konstante nutzen, keine Magic-Number `2`.
- **`reversals.length` vs. `catchTotal`:** der Filter zählt nur
  `reversals`, nicht Catch-Trials. Das ist korrekt: Catch-Trials
  zählen laut Spec nicht als Umkehrungen, ein lagging Track soll
  echte Antworten bekommen, keine Catches.
- **Kein neuer i18n-Bedarf:** Diese Anleitung bringt keine UI-Texte.
  Wenn `_fmDbg`-Logs für Catch-up-Bonuse eingestreut werden, sollten
  sie englisch in `console.log` bleiben (z. B. `_fmDbg('catchup bonus: ' + bonusKey)`).

---

## 9. Hinweis: Übersetzungen

BA 105 erzeugt keine i18n-Strings. Die Mini-Übersetzungsanleitung
nach Ende der Serie 102–105 deckt die Strings aus 102+103 ab.

---

## 10. Abschluß der Serie 102–105

Mit BA 105 ist die Frequenzabgleich-Beschleunigungs-Serie vollständig:

| BA | Wirkung |
|----|---------|
| 102 | Slider-Vor-Schätzung als Workflow vor adaptivem Test (Storage, Dialog, Mode-Switch). |
| 103 | Slider-Schätzungen werden in Tabelle, Chart, Druck und Player-Warp als dritte Datenquelle sichtbar. |
| 104 | Adaptiver Track startet aus Slider-Schätzung oder Vorlauf-Match statt aus ±100 cent. |
| 105 | Tracks, die im laufenden Test hinten dran sind, bekommen pro Runde ein Bonus-Trial. |

**Erwartete Gesamt-Wirkung:** Test-Dauer im typischen Fall (Mismatch-
Spanne 50-300 cent) um spürbaren Faktor verkürzt; alle Elektroden
liefern früher Zwischenergebnisse; gleichmäßigere Verbesserung über
den Test-Verlauf.

Nach Abnahme von BA 105: ggf. eine zukünftige Mini-Anleitung für die
Übersetzungen (en/fr/es) der in 102+103 eingeführten Strings.
