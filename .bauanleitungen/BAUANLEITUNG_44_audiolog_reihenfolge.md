# Bauanleitung 44 — Audiologen-Korrektur-Bericht: Reihenfolge umsortieren

Setzt **BA 42** und **BA 42c** voraus (durchgelaufen).

Im aktuellen Stand sind Sektionen schlecht geordnet: pro Seite wird
Lautstärken, MAPLAW und Frequenz ausgegeben, **danach** erst kommen
die bilateralen Sachen (Stereo-Balance, Latenz, Hinweise, Fehlende
Angaben). Das soll umgedreht werden — die bilateralen Sachen gehören
**vor** die Pro-Seite-Blöcke. Innerhalb eines Pro-Seite-Blocks sollen
MAPLAW und Frequenz nicht mehr als eigene H2 erscheinen, sondern als
H3 unterhalb der Seiten-H2.

Außerdem braucht die Sektion „Fehlende Implantat-Angaben" einen
einleitenden italic-Satz mit der Bitte an den Audiologen, dem
Klienten die fehlenden Daten mitzuteilen.

**Berührt:** `print-md.js`, `i18n.js`, `CODESTRUKTUR.md`, `SPEC.md`.

## Soll-Reihenfolge im Bericht

```
# CI Sound Balancing — Audiologen-Auftrag
Header-Zeilen (Datum, Side-Auswahl, Tool-Version)
[Testprogramm-Hinweis, falls erkannt]
[EQ-aus-Hinweis, falls EQ aus]

## Stereo-Balance              ← bilateral, vor den Seiten-Blöcken
## Latenz                      ← bilateral
## Hinweise an den Audiologen  ← bilateral
## Fehlende Implantat-Angaben  ← bilateral, mit italic-Einleitungssatz
   _Bitte an den Audiologen: …_
   - **LINKS**: …
   - **RECHTS**: …

## LINKS — <Konfig>            ← Pro-Seite-Block, alles über LINKS
   _Meta-Zeile_
   ### Lautstärken-Korrektur
   ### MAPLAW-Änderung            (nur wenn relevant für LINKS)
   ### Änderung der Mittenfrequenzen (nur wenn relevant für LINKS)

## RECHTS — <Konfig>           ← Pro-Seite-Block, alles über RECHTS
   ...

(Ende — nichts mehr danach.)
```

---

## Schritt 1 — `buildAudiologMarkdown` umsortieren

In `print-md.js`, Funktion `buildAudiologMarkdown()` (heute Z. 1045–1139)
**vollständig ersetzen** durch:

```js
function buildAudiologMarkdown() {
  const now = new Date();
  const dateStr = now.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
  const mainSides = _audiologMainSides();
  const sideLabel = _mdBilateralLabel();
  const parts = [];

  // ---- Kopf ----
  parts.push(`# CI Sound Balancing — ${t("audiologTitle")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  parts.push(`**${t("audiologHeaderSide")}**: ${sideLabel}`);
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`_${t("audiologToolVersionLine").replace("{VERSION}", APP_VERSION)}_`);
  }
  parts.push("");

  // ---- Testprogramm-Hinweis FRÜH ----
  const tp = _audiologTestProgramHint(mainSides);
  if (tp) parts.push(tp);

  // ---- EQ aus ----
  if (typeof plEqOn !== "undefined" && !plEqOn) {
    parts.push(`> ${t("audiologEqOff")}\n`);
  }

  // ===========================================================
  // BILATERAL-BLOCK — vor den Seiten-Blöcken.
  // Reihenfolge: Balance → Latenz → Hinweise → Fehlende Angaben.
  // ===========================================================
  const bal = _audiologBalanceBlock(mainSides);
  if (bal) parts.push(bal);
  const lat = _audiologLatencyBlock(mainSides);
  if (lat) parts.push(lat);
  parts.push(_audiologAdvice());
  const miss = _audiologMissingImplantData(mainSides);
  if (miss) parts.push(miss);

  // ===========================================================
  // PRO-SEITE-BLÖCKE — LINKS komplett, dann RECHTS komplett.
  // Innerhalb einer Seite: alle Sub-Sektionen als H3.
  // ===========================================================
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd) continue;
    const impl = sd.implant || {};
    const sideLbl = _audiologSideLabel(side);
    const mfrLbl  = (MFR[sd.manufacturer] && MFR[sd.manufacturer].name) || sd.manufacturer;
    const cfgLbl  = _audiologConfigLabel(side);
    parts.push(`## ${sideLbl} — ${cfgLbl}`);
    parts.push("");
    const meta = [];
    meta.push(`${t("audiologMfr")}: ${mfrLbl}`);
    if (impl.processor) meta.push(`${t("audiologProcessor")}: ${impl.processor}`);
    if (impl.model)     meta.push(`${t("audiologImplant")}: ${impl.model}`);
    const lastM = _audiologLastMeas(side);
    if (lastM) meta.push(`${t("audiologLastMeas")}: ${_audiologDateStr(lastM)}`);
    parts.push(`_${meta.join(" · ")}_`);
    parts.push("");

    // H3 Lautstärken-Korrektur
    parts.push(`### ${t("audiologSecLoudness")}`);
    parts.push("");
    parts.push(_audiologLoudnessTable(side));
    parts.push("");
    parts.push(`_${t("audiologLoudnessLegend")}_`);
    parts.push("");

    // H3 MAPLAW-Änderung — falls relevant für diese Seite
    const mlSide = _audiologMaplawSection([side], "###");
    if (mlSide) parts.push(mlSide);

    // H3 Änderung der Mittenfrequenzen — falls relevant für diese Seite
    if (typeof pWarpOn !== "undefined" && pWarpOn
        && typeof plEqOn !== "undefined" && plEqOn
        && typeof fRes !== "undefined" && fRes.length > 0) {
      const ft = _audiologFreqTable(side, [side]);
      if (ft) {
        parts.push(`### ${t("audiologSecFreq")}`);
        parts.push("");
        if (typeof pWarpMode !== "undefined" && pWarpMode === "sym") {
          parts.push(`_${t("audiologFreqSymHint")}_`);
          parts.push("");
        }
        parts.push(ft);
      }
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
```

**Wichtig:**
- Nach dem Pro-Seite-Loop folgt **nichts mehr**. Keine weiteren
  `parts.push(...)`-Aufrufe nach dem `for (const side of mainSides)`-Loop.
- Die Aufrufreihenfolge innerhalb des Bilateral-Blocks ist
  exakt: `_audiologBalanceBlock` → `_audiologLatencyBlock` →
  `_audiologAdvice` → `_audiologMissingImplantData`.
- Die einzelnen Helfer-Funktionen (`_audiologBalanceBlock`,
  `_audiologLatencyBlock`, `_audiologAdvice`) bleiben **unverändert** —
  sie produzieren weiterhin ihre eigenen `## …`-Überschriften.

---

## Schritt 2 — `_audiologMaplawSection`: optionaler `headerLevel`-Parameter

Damit MAPLAW als H3 innerhalb des Pro-Seite-Blocks erscheint, aber
bei einem direkten Aufruf weiterhin als H2 funktionieren könnte,
bekommt die Funktion einen zweiten Parameter `headerLevel` mit
Default `"##"`.

In `print-md.js`, Funktion `_audiologMaplawSection(mainSides)`
(heute Z. 880–897) **ersetzen** durch:

```js
function _audiologMaplawSection(mainSides, headerLevel) {
  if (typeof pMaplawOn === "undefined" || !pMaplawOn) return "";
  if (typeof plEqOn !== "undefined" && !plEqOn) return "";
  const sollC = (typeof pMaplawSollC !== "undefined") ? pMaplawSollC : null;
  if (sollC == null) return "";
  const rows = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    if (!sd || sd.manufacturer !== "medel") continue;
    const istC = (sd.implant && sd.implant.cValue) ? sd.implant.cValue : null;
    if (istC == null || istC === sollC) continue;
    const sideName = _audiologSideLabel(side);
    rows.push(`MAPLAW ${sideName} ändern von c=${istC} auf c=**${sollC}**.`);
  }
  if (rows.length === 0) return "";
  const lvl = headerLevel || "##";
  const lines = [`${lvl} ${t("audiologSecMaplaw")}`, "", ...rows, ""];
  return lines.join("\n");
}
```

Der Aufruf in `buildAudiologMarkdown` aus Schritt 1 übergibt `"###"`.
Dadurch landet MAPLAW als H3 unter dem Seiten-H2.

---

## Schritt 3 — `_audiologMissingImplantData`: italic-Einleitungssatz

In `print-md.js`, Funktion `_audiologMissingImplantData(mainSides)`
(heute Z. 961–986) **ersetzen** durch:

```js
function _audiologMissingImplantData(mainSides) {
  const out = [];
  for (const side of mainSides) {
    const sd = sideData[side];
    const impl = (sd && sd.implant) || {};
    const sideLbl = _audiologSideLabel(side);
    const missing = [];
    if (!impl.model)     missing.push(t("audMissImplantModel"));
    if (!impl.processor) missing.push(t("audMissProcessor"));
    const mclSet = (impl.mcl || []).some((v) => v != null && isFinite(v));
    if (!mclSet) missing.push(t("audMissMcl"));
    const thrSet = (impl.thr || []).some((v) => v != null && isFinite(v));
    if (!thrSet) missing.push(t("audMissThr"));
    const freqOwnSet = (sd && sd.elFreqOwn || []).some((v) => v != null && isFinite(v));
    if (!freqOwnSet) missing.push(t("audMissFreqOwn"));
    if (sd && sd.manufacturer === "medel" && !impl.cValue) missing.push(t("audMissCValue"));
    if (sd && sd.manufacturer === "cochlear" && !impl.iidr) missing.push(t("audMissIidr"));
    if (sd && sd.manufacturer === "ab" && !impl.idr) missing.push(t("audMissIdr"));
    if (missing.length > 0) {
      out.push(`- **${sideLbl}**: ${missing.join(", ")}`);
    }
  }
  if (out.length === 0) return "";
  const lines = [
    `## ${t("audiologSecMissing")}`,
    "",
    `_${t("audiologMissingIntro")}_`,
    "",
    ...out,
    "",
  ];
  return lines.join("\n");
}
```

Die einzige Änderung gegenüber dem heutigen Stand ist der
italic-Einleitungssatz zwischen der H2-Überschrift und den Bullets.
Wenn `out.length === 0`, gibt die Funktion weiterhin `""` zurück
(Sektion erscheint dann gar nicht).

---

## Schritt 4 — i18n-Key `audiologMissingIntro` in allen vier Sprachen

In `i18n.js`, in jedem der vier Sprach-Blöcke (de, en, fr, es) den
neuen Schlüssel **direkt nach `audMissFreqOwn`** einfügen.
Zeilennummern sind heute:

- DE-Block: nach Z. 398 (`audMissFreqOwn`)
- EN-Block: nach Z. 1093
- FR-Block: nach Z. 1769
- ES-Block: nach Z. 2450

Falls die Zeilen leicht verrutscht sind, immer am Bezugsschlüssel
`audMissFreqOwn` orientieren — nicht an der Zeilennummer.

**DE:**
```js
    audiologMissingIntro: "Bitte an den Audiologen: Bitte teilen Sie Ihrem Klienten diese Daten mit, um die Meßergebnisse verbessern zu können. Idealerweise geben Sie ihm ein vollständig ausgedrucktes Anpassungsprotokoll aller MAPS.",
```

**EN:**
```js
    audiologMissingIntro: "Note to audiologist: please share these data with your client so the measurement results can be improved. Ideally, give them a complete printout of the fitting protocol for all MAPs.",
```

**FR:**
```js
    audiologMissingIntro: "Note à l'audiologiste : veuillez communiquer ces données à votre client afin que les résultats de mesure puissent être améliorés. Idéalement, remettez-lui une impression complète du protocole d'ajustement de toutes les MAP.",
```

**ES:**
```js
    audiologMissingIntro: "Nota para el audioprotesista: comparta por favor estos datos con su cliente para que los resultados de medición puedan mejorar. Lo ideal sería entregarle una impresión completa del protocolo de ajuste de todos los MAP.",
```

---

## Schritt 5 — CODESTRUKTUR.md aktualisieren

In `CODESTRUKTUR.md`, im Datenfluss-Block den Absatz „Audiologen-Auftrag
(Modus B)" (heute Z. 416–431) **ersetzen** durch:

```
**Audiologen-Auftrag (Modus B):** `buildAudiologMarkdown` in
print-md.js erzeugt einen strukturierten Korrektur-Bericht.
Reihenfolge: Kopf (Datum, Side, Tool-Version), Testprogramm-Hinweis
(falls erkannt), EQ-aus-Hinweis (falls EQ aus). Dann der bilaterale
Block — Sektionen, die beide Seiten gleichermaßen betreffen, in fester
Reihenfolge: Stereo-Balance, Latenz, Hinweise an den Audiologen,
Fehlende Implantat-Angaben (mit italic Einleitungssatz aus i18n-Key
`audiologMissingIntro`). Anschließend die Pro-Seite-Blöcke — erst
LINKS komplett, dann RECHTS komplett, kein Vermischen: Seiten-H2 mit
Meta-Zeile, dann H3 Lautstärken-Korrektur, H3 MAPLAW-Änderung (wenn
applikabel), H3 Änderung der Mittenfrequenzen (wenn applikabel).
`_audiologMaplawSection(mainSides, headerLevel)` unterstützt einen
optionalen Header-Level-Parameter (Default "##"); aus dem Pro-Seite-
Loop wird sie mit "###" aufgerufen, damit MAPLAW als H3 unter der
Seiten-H2 erscheint. Druck-Pfad (`audiologPrint`): Chart-Injektion vor
`<h3>audiologSecLoudness</h3>` per laufendem `searchFrom`-Offset
(bilateral-korrekt; Reihenfolge der Seiten-Blöcke entspricht
`mainSides`). Druck nutzt `openPrintWindow` aus print.js.
```

In derselben Datei, in der print-md.js-Modulzeile (heute Z. 114), den
Hinweis auf neue i18n-Keys ergänzen: `audiologMissingIntro` zur Liste
der neuen Schlüssel hinzufügen.

---

## Schritt 6 — SPEC.md aktualisieren

In `SPEC.md`, im Abschnitt zur Audiologen-Box im Tab „Laden/Speichern",
die Bericht-Gliederung auf die neue Reihenfolge anpassen:

1. Die Sektionen Stereo-Balance, Latenz, Hinweise an den Audiologen,
   Fehlende Implantat-Angaben **vor** die Pro-Seite-Blöcke setzen.
2. Bei „Fehlende Implantat-Angaben" ergänzen, daß ein italic-
   Einleitungssatz (Schlüssel `audiologMissingIntro`) der Bullet-Liste
   vorangeht.
3. Bei den Pro-Seite-Blöcken erwähnen, daß MAPLAW und Frequenz als H3
   unter der Seiten-H2 erscheinen, nicht mehr als eigene H2.
4. Klarstellen: nach dem letzten Pro-Seite-Block (RECHTS, im
   bilateralen Fall) folgt im Bericht nichts mehr.

Falls der Abschnitt in SPEC.md durch BA 42/42c-Edits abweichend
strukturiert ist, sinngemäß umsetzen.

---

## Akzeptanztest

Alle Schritte im Browser durchklicken, mit gefüllten Messdaten
(Balance gemessen, Latenz gemessen, beidseitig konfiguriert), MAPLAW
und Warp jeweils einmal an und einmal aus probieren.

1. **Bilateral-Block VOR den Seiten-Blöcken.**
   Reiter „Laden/Speichern" → Karte „Audiologen-Bericht" → Knopf
   „Drucken (mit Grafik)".
   *Erwartet:* Nach dem Header (Titel, Datum, Side-Auswahl, Tool-
   Version) und ggf. Testprogramm-/EQ-aus-Hinweis erscheint zuerst
   die H2-Sektion „Stereo-Balance" — **vor** allen Seiten-Block-
   Überschriften „LINKS …" / „RECHTS …".

2. **Reihenfolge der vier bilateralen Sektionen.**
   *Erwartet:* Genau diese Folge: Stereo-Balance → Latenz → Hinweise
   an den Audiologen → Fehlende Implantat-Angaben. Alle vier als H2.

3. **Italic-Einleitungssatz in „Fehlende Implantat-Angaben".**
   Im Reiter Implantat absichtlich ein paar Felder leer lassen (z.B.
   THR und MCL), Bericht drucken.
   *Erwartet:* Direkt unter der H2 „Fehlende Implantat-Angaben" steht
   ein italic-Absatz (im HTML als `<i>…</i>` gerendert) mit dem Text
   „Bitte an den Audiologen: Bitte teilen Sie Ihrem Klienten diese
   Daten mit, um die Meßergebnisse verbessern zu können. Idealerweise
   geben Sie ihm ein vollständig ausgedrucktes Anpassungsprotokoll
   aller MAPS." Danach die Pro-Seite-Bullets („**LINKS**: …",
   „**RECHTS**: …").

4. **Sektion fehlt komplett, wenn nichts fehlt.**
   Alle Implantat-Felder füllen (Modell, Prozessor, MCL, THR,
   elFreqOwn, c-Wert). Drucken.
   *Erwartet:* „Fehlende Implantat-Angaben" erscheint nicht im
   Bericht — auch der Einleitungssatz nicht.

5. **Erster Pro-Seite-Block kommt nach dem Bilateral-Block.**
   *Erwartet:* Nach „Fehlende Implantat-Angaben" (oder, wenn die
   fehlt, nach „Hinweise an den Audiologen") folgt die H2-
   Überschrift der ersten Seite, z.B. „LINKS — CI", mit Meta-Zeile
   darunter.

6. **Sub-Sektionen innerhalb des Pro-Seite-Blocks sind H3.**
   *Erwartet im HTML:* Lautstärken-Korrektur, MAPLAW-Änderung (wenn
   relevant), Änderung der Mittenfrequenzen (wenn relevant) erscheinen
   als `<h3>`-Tags, **nicht** als `<h2>`. Im Markdown-Export: `### …`,
   nicht `## …`.

7. **MAPLAW erscheint nur, wenn relevant.**
   MAPLAW im Player aktivieren, abweichenden Soll-c-Wert eintragen
   (z.B. 800), MED-EL-Seite mit Ist-c=1000 konfigurieren.
   *Erwartet:* Innerhalb des Seiten-Blocks der betroffenen Seite
   erscheint H3 „MAPLAW-Änderung" mit „MAPLAW Links ändern von
   c=1000 auf c=**800**.". Bei nicht-MED-EL oder gleichem Ist/Soll-c
   ist die H3-Sektion nicht da.

8. **Frequenz-Sektion erscheint nur, wenn relevant.**
   Warp einschalten, Frequenzabgleich-Messung vorhanden, EQ an,
   drucken.
   *Erwartet:* Innerhalb des Seiten-Blocks der jeweiligen Seite
   erscheint H3 „Änderung der Mittenfrequenzen" mit der Tabelle
   (Hz Default, Hz manuell, Δ cent, Gewünschte Mittenfrequenz). Ohne
   Warp / ohne fRes / EQ aus: H3-Sektion nicht da.

9. **Reihenfolge der Pro-Seite-Blöcke.**
   Beidseitig konfiguriert, beidseitig drucken.
   *Erwartet:* Erst LINKS-Block komplett (Lautstärken + MAPLAW + Freq
   für LINKS), dann RECHTS-Block komplett. Keine Mischung.

10. **Schluß nach letztem Pro-Seite-Block.**
    *Erwartet:* Nach dem RECHTS-Block (oder bei einseitig nach dem
    LINKS-Block) folgt nichts mehr — kein Footer, keine Notiz, keine
    „Allgemeine Bitten", keine weitere Sektion.

11. **Markdown-Export prüft gleiche Reihenfolge.**
    Knopf „Markdown Text exportieren".
    *Erwartet:* Datei enthält dieselbe Sektion-Reihenfolge wie der
    Druck (ohne PNG-Charts). Bilaterale Sektionen vor den Pro-Seite-
    Blöcken, MAPLAW und Frequenz als `### …` (drei Hashes) innerhalb
    der Seiten-Blöcke.

12. **Chart-Injektion bleibt funktional.**
    *Erwartet:* Pro Seite ein Bar-Chart-PNG erscheint direkt VOR der
    `<h3>Lautstärken-Korrektur</h3>` der jeweiligen Seite, nicht
    irgendwo dazwischen.

---

## Selbstprüfungs-Auftrag an Sonnet

Bevor du dem Nutzer „fertig" meldest, jede Akzeptanz-Kriterie einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**,
jeweils mit konkreter Datei- und Zeilenangabe der Stelle, die das
Verhalten erzeugt.

Prüfe insbesondere:

- Steht der Aufruf `_audiologBalanceBlock(mainSides)` in
  `buildAudiologMarkdown` **vor** dem `for (const side of mainSides)`-
  Loop, nicht dahinter? Konkrete Zeilennummer melden.
- Werden im Bilateral-Block alle vier Aufrufe in dieser Reihenfolge
  ausgeführt: `_audiologBalanceBlock`, `_audiologLatencyBlock`,
  `_audiologAdvice`, `_audiologMissingImplantData`?
- Folgen nach dem Pro-Seite-Loop **keine** weiteren `parts.push`-
  Aufrufe (außer dem `return …`)?
- Wird `_audiologMaplawSection` aus dem Pro-Seite-Loop mit dem
  zweiten Argument `"###"` aufgerufen?
- Erscheint im Markdown-Export der MAPLAW-Header als `### …` (drei
  Hashes), nicht mehr als `## …`?
- Erscheint im Markdown-Export der Frequenz-Header als `### …`?
- Ist der neue i18n-Key `audiologMissingIntro` in **allen vier**
  Sprach-Blöcken (de, en, fr, es) angelegt? `grep -n
  "audiologMissingIntro" i18n.js` muß genau vier Treffer liefern.
- Erscheint `audiologMissingIntro` im finalen HTML als `<i>…</i>`-Tag
  (nicht roh mit Unterstrichen)?
- Bleibt die Chart-Injektion (`_audiologChartImg` vor
  `<h3>audiologSecLoudness</h3>`) weiterhin bilateral korrekt — also
  pro Seite ein eigenes PNG vor der jeweiligen H3-Lautstärken-
  Überschrift?

Wenn etwas unklar ist, Rückfrage stellen, nicht stillschweigend
annehmen.
