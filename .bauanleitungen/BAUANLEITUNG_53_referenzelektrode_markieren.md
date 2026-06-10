# Bauanleitung 53 — Referenzelektrode in Graphen und Tabellen markieren

## Worum es geht

Die Referenzelektrode (`refEl` aus `state-side.js`) hat in mehreren
Darstellungen einen sichtbaren Effekt (sie ist der WLS-Anker, sie
beeinflußt Player-EQ-Korrektur und Druck-Ausgaben), bisher aber nur
ein leichtes, kaum sichtbares Marker-Detail. Sie soll deutlich
hervorgehoben werden — überall, wo sie eine Wirkung hat.

Markierungs-Konzept:

- **In Graphen**: dünner senkrechter Strich an der x-Position der
  Referenzelektrode, gezeichnet vom oberen bis zum unteren Rand des
  Diagrammbereichs, dezentes Grau (`#6b7280`, Strichstärke 1 px,
  durchgezogen). Direkt am oberen Rand darüber ein kleines Label
  `Ref` in derselben Farbe.
- **In Tabellen**: neue Spalte ganz rechts mit der Überschrift
  `Ref.El.` (sprachabhängig). In der Zeile der Referenzelektrode steht
  ein großes `X`; alle anderen Zeilen sind leer.

Konkret betroffene Orte:

| # | Datei                  | Funktion / Stelle              | Art    |
|---|------------------------|--------------------------------|--------|
| A | `chart.js`             | `drawChart`                    | Graph  |
| B | `player.js`            | `pDrawEQ`                      | Graph  |
| C | `print-md.js`          | `_archivChartLoudness`         | Graph  |
| D | `print-md.js`          | `_audiologChartImg`            | Graph  |
| E | `results.js`           | `renderResults` (hB-Zweig)     | Tabelle (HTML) |
| F | `print-md.js`          | `_archivMdMeas`                | Tabelle (Markdown) |
| G | `print-md.js`          | `_audiologLoudnessTable`       | Tabelle (Markdown) |

Anmerkungen:

- In `drawChart` und `_archivChartLoudness` existiert bereits eine
  *subtile* Markierung (fettes blaues Label bzw. violetter Balken). Die
  bleibt erhalten — der neue Strich + Label kommt **zusätzlich** dazu.
- Im **Frequenzabgleich**-Graph wird *keine* Markierung gezeichnet
  (der hat keine Bezug zu `refEl` im Sinne der Lautstärken-Messung).
- Im **Stereo-Balance**-Graph (`lrDrawChart`) und im **Schieber**-
  Graph wird ebenfalls keine Markierung gesetzt — auch dort hat
  `refEl` keinen sichtbaren Einfluß im Sinne der Lautstärken-Anzeige
  (Stereo-Balance ist Inter-Ohr-Vergleich; Schieber zeigt manuelle
  Werte).
- `lr-balance.js`-Tabellen und `pBuildTbl` (Player-Tabelle): keine
  Ref.El.-Spalte (laut Vorgabe nur Loudness-Tabellen).

## Stelle A — `chart.js`: `drawChart` Strich + „Ref"-Label

In `chart.js` Z. 21 ff. Direkt **vor** der Schleife `for (let j = 0; j < allE.length; j++)`
(beginnt aktuell bei Z. 90) folgenden Block einfügen — er muß **nach**
dem Y-Achsen-Grid und vor den Balken stehen, damit die Balken den
Strich überlagern dürfen und er trotzdem oben/unten sichtbar bleibt:

```js
  // Referenzelektrode: senkrechter Strich + "Ref"-Label oben.
  if (typeof refEl !== "undefined" && refEl !== null) {
    const jRef = allE.indexOf(refEl);
    if (jRef >= 0) {
      const xRef = tX(jRef);
      ctx.save();
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRef, pad.top);
      ctx.lineTo(xRef, pad.top + pH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.font = "9px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ref", xRef, pad.top - 4);
      ctx.restore();
    }
  }
```

Die bestehende Hervorhebung in Z. 133–134 (`ctx.fillStyle = i === refEl ? "#2563eb" : "#555"`,
fettes Label) bleibt **unverändert**. So gibt es ein Strich + „Ref"-
Label oben *und* ein blau-fettes Achsen-Label unten — beides
zusammen ist eindeutig, auch wenn der Strich z. B. durch einen
hohen Balken teilweise verdeckt wird.

## Stelle B — `player.js`: `pDrawEQ` Strich + „Ref"-Label

In `player.js` ab Z. 707 (`function pDrawEQ()`). Direkt **vor** der
Schleife `for (let j = 0; j < allE.length; j++)` (beginnt aktuell
bei Z. 772) einfügen:

```js
  // Referenzelektrode: senkrechter Strich + "Ref"-Label oben.
  if (typeof refEl !== "undefined" && refEl !== null) {
    const jRef = allE.indexOf(refEl);
    if (jRef >= 0) {
      const xRef = pad.left + jRef * gW + gW / 2;
      ctx.save();
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRef, pad.top);
      ctx.lineTo(xRef, pad.top + pH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.font = "8px Segoe UI,sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ref", xRef, pad.top - 3);
      ctx.restore();
    }
  }
```

Hinweis: `pad.top` ist hier 14 (siehe Z. 734), also wenig Platz für
das Label darüber. Bei sehr kleinen Canvas-Höhen wird das Label am
oberen Rand abgeschnitten — das ist akzeptabel, weil der Strich
selbst die primäre Markierung ist. Falls der Container es zuläßt,
könnte `pad.top` auf 20 erhöht werden, ist aber nicht erforderlich.

## Stelle C — `print-md.js`: `_archivChartLoudness` Strich + Label

In `print-md.js` ab Z. 1360. Direkt **vor** der Schleife
`for (let j = 0; j < rows.length; j++)` (Z. 1373) einfügen:

```js
  // Referenzelektrode: senkrechter Strich + "Ref"-Label oben.
  const refIdx = sideBlock.meas.refEl;
  if (refIdx != null) {
    let jRef = -1;
    for (let k = 0; k < rows.length; k++) {
      if (rows[k].idx === refIdx) { jRef = k; break; }
    }
    if (jRef >= 0) {
      const xRef = pad.l + jRef * gW + gW / 2;
      ctx.save();
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRef, pad.t);
      ctx.lineTo(xRef, pad.t + pH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.font = "9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ref", xRef, pad.t - 4);
      ctx.restore();
    }
  }
```

Der bestehende violette Balken (`#a855f7` für `r.idx === sideBlock.meas.refEl`,
Z. 1382) bleibt erhalten — Strich + Label kommen zusätzlich.

## Stelle D — `print-md.js`: `_audiologChartImg` Strich + Label

In `print-md.js` ab Z. 1213. Direkt **vor** der Schleife
`for (let i = 0; i < nEl; i++)` (Z. 1247) einfügen:

```js
    // Referenzelektrode: senkrechter Strich + "Ref"-Label oben.
    if (typeof refEl !== "undefined" && refEl !== null && refEl >= 0 && refEl < nEl) {
      const xRef = pad.l + refEl * gW + gW / 2;
      ctx.save();
      ctx.strokeStyle = "#6b7280";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xRef, pad.t);
      ctx.lineTo(xRef, pad.t + pH);
      ctx.stroke();
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Ref", xRef, pad.t - 4);
      ctx.restore();
    }
```

Wichtig: Hier wird über alle `nEl` iteriert, nicht über `allE()` —
also ist `refEl` direkt der x-Index. Die `withSide(side, …)`-Wrap-
Funktion sorgt schon dafür, daß `refEl`, `nEl` etc. die Werte der
gerade gerenderten Seite tragen.

## Stelle E — `results.js`: `renderResults` Tabelle Ref.El.-Spalte

In `results.js` ab Z. 161 (`th.innerHTML = …` und folgende `for`-Schleife
für die Zeilen).

**Header** Z. 161:

```js
    th.innerHTML = `<th>${t("thEl")}</th><th>${t("thHz")}</th><th>${t("thOff")}</th><th>${t("thMes")}</th><th title="${t("thResTip")}">${t("thRes")}</th><th>${t("thWgt")}</th><th>${t("thStR")}</th>`;
```

Ersetzen durch:

```js
    th.innerHTML = `<th>${t("thEl")}</th><th>${t("thHz")}</th><th>${t("thOff")}</th><th>${t("thMes")}</th><th title="${t("thResTip")}">${t("thRes")}</th><th>${t("thWgt")}</th><th>${t("thStR")}</th><th>${t("thRefEl")}</th>`;
```

**Zeilen** Z. 182. Die `tr.innerHTML = ...`-Zeile endet aktuell mit
`<td style="font-size:.78em">${st}</td>`. Direkt vor dem schließenden
Backtick — also nach dem letzten `</td>` — eine weitere `<td>` anhängen:

```js
      tr.innerHTML = `<td style="font-weight:600">${dENPrefix()}${dEN(i)}</td><td>${Math.round(effFreq(i))}</td><td style="color:${ex ? "#999" : v > 0.05 ? "#2563eb" : v < -0.05 ? "#dc2626" : "#666"}">${ex ? "—" : (v >= 0 ? "+" : "") + v.toFixed(1)}</td><td>${pc[i] || "—"}</td><td style="color:${ex ? "#999" : elColor(i) === "green" ? "#16a34a" : elColor(i) === "yellow" ? "#d97706" : elColor(i) === "red" ? "#dc2626" : "#999"}">${elRes[i] > 0 ? elRes[i].toFixed(1) : "—"}</td><td>${ex ? "—" : elWt[i].toFixed(1)}</td><td style="font-size:.78em">${st}</td><td style="text-align:center;font-weight:700">${i === refEl ? "X" : ""}</td>`;
```

(Nur das letzte `<td …>X / leer</td>` ist neu am Ende der Zeile.)

**Im Judgment-Zweig (`hJ`, Z. 208–214)** wird ebenfalls eine
Tabelle aufgebaut — der bekommt **keine** Ref.El.-Spalte, weil
`refEl` im reinen Judgment-Modus keine WLS-Anker-Funktion hat
(es gibt keinen `compWLS`-Anker, weil keine Balance-Messungen
vorliegen). Wenn das doch konsistent gewünscht ist: Rückfrage.

## Stelle F — `print-md.js`: `_archivMdMeas` Markdown-Tabelle Spalte

In `print-md.js` ab Z. 502.

**Header** Z. 502–503:

```js
  out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("thOff")} | ${t("thRes")} | ${t("thStR")} |`);
  out.push("|---|---|---|---|---|");
```

Ersetzen durch:

```js
  out.push(`| ${t("thEl")} | ${t("thHz")} | ${t("thOff")} | ${t("thRes")} | ${t("thStR")} | ${t("thRefEl")} |`);
  out.push("|---|---|---|---|---|---|");
```

**Zeilen** Z. 510:

```js
    out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} |`);
```

Ersetzen durch:

```js
    const refMark = (sd.meas.refEl != null && r.idx === sd.meas.refEl) ? "**X**" : "";
    out.push(`| ${r.label} | ${_mdFmtHz(r.hz)} | ${offTxt} | ${resTxt} | ${stTxt}${noteTxt} | ${refMark} |`);
```

Hinweis: `r.idx` ist das Feld im Row-Objekt — das ergibt sich aus
`collectArchivData` / `_collectSideData`. Falls der Feldname
abweicht (z. B. `electrodeIndex`), entsprechend anpassen. Stichprobe
im sammelnden Code machen.

## Stelle G — `print-md.js`: `_audiologLoudnessTable` Markdown-Tabelle Spalte

In `print-md.js` ab Z. 790.

**Header** Z. 796–797:

```js
    lines.push(`| ${t("thEl")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("archivImplExcl")} | ${t("audColNote")} |`);
    lines.push("|---|---|---|---|---|---|---|---|---|");
```

Ersetzen durch:

```js
    lines.push(`| ${t("thEl")} | ${t("audColDb")} | ${t("audColRes")} | ${t("audColMcl")} (${unit}) | ${t("audColMclDelta")} (${unit}) | ${t("audColMclNew")} (${unit}) | ${t("audColStatus")} | ${t("archivImplExcl")} | ${t("audColNote")} | ${t("thRefEl")} |`);
    lines.push("|---|---|---|---|---|---|---|---|---|---|");
```

**Zeilen** Z. 805–807. Aktuell:

```js
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | **${_audDb(dB)}** | ${r > 0 ? r.toFixed(1) + " dB" : ""} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status} | ${excl} | ${note} |`
      );
```

Ersetzen durch:

```js
      const refMark = (typeof refEl !== "undefined" && refEl != null && i === refEl) ? "**X**" : "";
      lines.push(
        `| ${dENPrefix()}${dEN(i)} | **${_audDb(dB)}** | ${r > 0 ? r.toFixed(1) + " dB" : ""} | ${_audUnitAbs(abs.mcl, abs.unit)} | ${_audUnit(abs.delta, abs.unit)} | ${_audUnitAbs(abs.newVal, abs.unit)} | ${status} | ${excl} | ${note} | ${refMark} |`
      );
```

(Innerhalb `withSide(side, …)` ist `refEl` automatisch die der gerade
gerenderten Seite — kein zusätzlicher Switch nötig.)

## Stelle H — `i18n/*.js`: neuer Key `thRefEl`

In allen vier Sprachdateien einen neuen Schlüssel ergänzen, am besten
neben den anderen `th*`-Tabellenüberschriften (z. B. nach `thStR`).

**`i18n/de.js`**:
```js
    thRefEl: "Ref.El.",
```

**`i18n/en.js`**:
```js
    thRefEl: "Ref. el.",
```

**`i18n/fr.js`**:
```js
    thRefEl: "Réf. él.",
```

**`i18n/es.js`**:
```js
    thRefEl: "El. ref.",
```

## Stelle I — `SPEC.md` / `spec/`

Im Kapitel zu **Messergebnisse** (`spec/`-Datei für den Ergebnis-Reiter)
unter „Loudness-Anzeige" ergänzen:

> Die Referenzelektrode ist im Graph durch einen dünnen senkrechten
> Strich (Farbe `#6b7280`) und ein „Ref"-Label am oberen Rand markiert,
> zusätzlich zur bisherigen Hervorhebung als fettes Achsen-Label. In
> der zugehörigen Tabelle gibt es eine neue Spalte „Ref.El." am Ende;
> die Zeile der Referenzelektrode trägt ein großes `X`.

Im Kapitel zu **Player** im Abschnitt „EQ-Graph":

> Die Referenzelektrode wird im Player-EQ-Graph genauso markiert
> (senkrechter Strich + „Ref"-Label am oberen Rand).

Im Kapitel zu **Drucken** (`spec/`-Datei) ergänzen:

> Die Markierung der Referenzelektrode (Strich + „Ref"-Label im Graph,
> `X`-Spalte „Ref.El." in der Tabelle) erscheint sowohl im Archiv-Druck
> als auch im Audiologen-Druck, jeweils im Lautstärken-Block.

## Stelle J — `CODESTRUKTUR.md`

Im Abschnitt **„refEl-Wirkung"** (Datenfluss-Block) den bestehenden
Satz ergänzen oder direkt darunter einen Absatz anhängen:

> Die Markierung der Referenzelektrode in den Loudness-Darstellungen
> wird in `drawChart` (chart.js), `pDrawEQ` (player.js),
> `_archivChartLoudness` und `_audiologChartImg` (beide in print-md.js)
> als Strich + Label gezeichnet; in den Loudness-Tabellen
> (`renderResults`, `_archivMdMeas`, `_audiologLoudnessTable`) als
> neue Endspalte mit `X` in der Referenzzeile. In Stereo-Balance-,
> Schieber- und Frequenzabgleich-Darstellungen wird **nicht** markiert
> (kein direkter `refEl`-Effekt im jeweiligen Inhalt).

## Akzeptanztest-Checkliste (manuell im Browser)

### Vorbereitung

1. Vollständige Elektrodenlautstärke-Messung durchführen, so daß die
   Loudness-Anzeige im Tab Meßergebnisse Daten zeigt.
2. Im Meßergebnisse-Tab eine Referenzelektrode wählen, die deutlich
   in der Mitte liegt (nicht 1, nicht die letzte — z. B. die 5. von
   12).

### Test A — Graph Meßergebnisse Loudness

1. Tab Meßergebnisse → Sub-Tab Elektrodenlautstärke-Balance.
2. Erwartet: am Diagramm zur Position der Referenzelektrode steht
   ein dünner grauer senkrechter Strich, oben darüber ein kleines
   graues „Ref"-Label.
3. Ref-Wechsel im Dropdown → Strich und Label springen sofort zur
   neuen Position.

### Test B — Tabelle Meßergebnisse Loudness

1. Im gleichen Sub-Tab in die Tabelle scrollen.
2. Erwartet: neue letzte Spalte mit Überschrift „Ref.El." (sprach-
   abhängig). In der Zeile der gewählten Referenzelektrode steht
   ein großes, fettes, zentriertes `X`. Alle anderen Zeilen sind
   in dieser Spalte leer.
3. Sprachwechsel (EN/FR/ES) testen → Überschrift entsprechend
   übersetzt.

### Test C — Player-EQ-Graph

1. Tab Player. Eine Audiodatei laden (Wiedergabe optional).
2. Erwartet: im Player-EQ-Graph an der Position der Referenzelektrode
   senkrechter grauer Strich und „Ref"-Label oben.
3. Side-Wechsel (links/rechts/beide) → Markierung der jeweils
   aktiven Seite sichtbar.

### Test D — Archiv-Druck

1. Tab Laden/Speichern → in der Archiv-Box „Bericht drucken" (oder
   den entsprechend benannten Knopf) klicken.
2. Im Druckvorschau-Fenster die Lautstärken-Sektion ansehen.
3. Erwartet: im Loudness-Graph derselbe Strich + „Ref"-Label, in der
   Loudness-Tabelle die neue „Ref.El."-Spalte am Ende mit einem
   **X** in der Referenzzeile.

### Test E — Audiologen-Druck

1. Audiologen-Box → drucken.
2. Erwartet: pro Seite enthält die Loudness-Grafik die Strich+Label-
   Markierung; die zugehörige Tabelle enthält eine „Ref.El."-Spalte
   am Ende mit `**X**` in der Referenzzeile.

### Test F — keine Markierung wo nicht gewünscht

1. Frequenzabgleich-Graph (Sub-Tab Meßergebnisse → Frequenzabgleich):
   keine Strich-Markierung.
2. Stereo-Balance-Graph (Sub-Tab Stereo-Balance): keine Strich-
   Markierung.
3. Schieber-Tab (`lvTabDraw`): keine Strich-Markierung.

### Test G — Robustheit ohne Referenzelektrode

1. Konsole: `refEl = null; renderResults();`
2. Erwartet: kein Strich, kein Label, keine Exception. Tabelle hat
   die „Ref.El."-Spalte trotzdem, aber alle Zellen sind leer.
3. Wieder `refEl` setzen, Tab neu rendern — Markierung kommt zurück.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–G einzeln durchgehen
und für jede melden: **erfüllt / nicht erfüllt / unklar**, mit Datei-
und Zeilenangabe der relevanten Stelle.

Insbesondere prüfen:

- Wird in **allen vier** Graph-Stellen (A–D) der Strich mit `pad.top`
  / `pad.t` als Start-Y und `pad.top + pH` / `pad.t + pH` als End-Y
  gezeichnet? Die Variablen heißen je nach Funktion unterschiedlich
  (`pad.top` vs `pad.t`, `pH` immer).
- Steht der neue Strich-Block in jeder Funktion *vor* der Bar-Schleife,
  damit hohe Balken den Strich-Mittelteil überlagern dürfen (oben +
  unten bleibt der Strich sichtbar)?
- Sind die `i === refEl`-Checks immer mit `refEl != null` /
  `typeof refEl !== "undefined"` geschützt? Sonst würde im Initial-
  zustand (kein refEl gesetzt) eine falsche Markierung gezeichnet.
- Existiert das Feld `r.idx` in den Archiv-Sammler-Daten tatsächlich?
  Falls nicht: Feldname im `collectArchivData`/`_collectSideData` prüfen
  und ersetzen, oder den Match per `r.label` machen.
- Sind in **allen vier** Sprachdateien der neue Key `thRefEl` ergänzt?
- Bricht keine der bestehenden Akzeptanz-Tests früherer Bauanleitungen?
  Insbesondere: zeigt die Loudness-Tabelle weiterhin alle bisherigen
  Spalten, jetzt plus eine neue am Ende?

Bei Unklarheit Rückfrage statt Annahme.
