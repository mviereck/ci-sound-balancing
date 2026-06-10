# Bauanleitung 43: Audiologen-Brief — separater Sub-Block + zweite Druckaktion

Setzt **Bauanleitung 42** voraus (Notiz-Eingabefeld `audiologUserNote`,
top-level JSON-Persistenz, ersetzter Modus-B-Block in `print-md.js`).

Diese Anleitung baut **in derselben Karte „Einstellungswünsche an den
Audiologen"** einen zweiten Sub-Block „Brief an den Audiologen" mit
eigener Druck- und Markdown-Export-Aktion. Drei Checkbox-wählbare
Abschnitte (Notiz, Bitten, MAP-Belegungs-Wunsch).

Berührt: `index.html`, `i18n.js`, `init.js`, `print-md.js`, `file.js`,
`state-side.js`, `CODESTRUKTUR.md`, `SPEC.md`.

**Wichtig:** Der **Korrektur-Bericht** aus BA 42 enthält die Bitten
weiterhin als festen, nicht-editierbaren Standardtext. Der **Brief**
aus dieser Anleitung ist eine **zweite, separate Druckausgabe** mit
editierbaren Texten — gedacht für administrative Termine, in denen
der Patient gezielt nur den Brief mitbringen will. Duplikation der
Bitten in beiden Ausgaben ist beabsichtigt.

---

## Schritt 1 — neue globale Variablen

In `state-side.js`, **direkt nach** `let audiologUserNote = "";`
(aus BA 42) ergänzen:

```js
// NEU: Audiologen-Brief (Modus B2)
let audiologBriefRequests = null;   // String oder null → Default aus i18n
let audiologBriefMapPlan  = null;   // String oder null → Default aus i18n
let audiologBriefShowNote     = true;
let audiologBriefShowRequests = true;
let audiologBriefShowMapPlan  = true;
```

`null` signalisiert „noch nie editiert → Default-Text aus i18n
zeigen". Sobald der Patient editiert, wird der String fixiert und
mit-gespeichert.

---

## Schritt 2 — HTML-Sub-Block in der Karte „Einstellungswünsche"

In `index.html`, **innerhalb** `<div class="card" id="cardAudiolog">`,
**direkt vor** dem schließenden `</div>` der Karte (also nach dem
heutigen `btn-group`-Block mit `fAudiologPrintBtn` und
`fAudiologMdBtn`), folgenden Block einfügen:

```html
<hr style="border:none;border-top:1px solid var(--border);
           margin:20px 0;">

<h3 style="margin-top:0;font-size:1.05em;" data-t="briefTitle"></h3>
<p style="font-size:0.84em;color:var(--text-muted);margin-bottom:10px;"
   data-t="briefDesc"></p>

<div style="display:flex;flex-direction:column;gap:14px;">

  <!-- Notiz (referenziert das Textfeld aus BA 42) -->
  <label style="display:flex;align-items:center;gap:8px;font-size:0.9em;">
    <input type="checkbox" id="briefChkNote" checked>
    <span data-t="briefChkNote"></span>
  </label>

  <!-- Bitten -->
  <div>
    <label style="display:flex;align-items:center;gap:8px;font-size:0.9em;margin-bottom:4px;">
      <input type="checkbox" id="briefChkRequests" checked>
      <span data-t="briefChkRequests"></span>
    </label>
    <textarea id="briefRequestsInput" rows="14"
              style="width:100%;box-sizing:border-box;font-size:0.85em;
                     padding:6px;border:1px solid var(--border);
                     border-radius:4px;background:var(--surface);
                     color:var(--text);resize:vertical;
                     font-family:Consolas,monospace;"></textarea>
    <button class="btn" id="briefResetRequestsBtn"
            style="margin-top:4px;font-size:0.8em;padding:4px 8px;"
            data-t="briefResetDefault"></button>
  </div>

  <!-- MAP-Belegungs-Wunsch -->
  <div>
    <label style="display:flex;align-items:center;gap:8px;font-size:0.9em;margin-bottom:4px;">
      <input type="checkbox" id="briefChkMapPlan" checked>
      <span data-t="briefChkMapPlan"></span>
    </label>
    <textarea id="briefMapPlanInput" rows="6"
              style="width:100%;box-sizing:border-box;font-size:0.85em;
                     padding:6px;border:1px solid var(--border);
                     border-radius:4px;background:var(--surface);
                     color:var(--text);resize:vertical;
                     font-family:Consolas,monospace;"></textarea>
    <button class="btn" id="briefResetMapPlanBtn"
            style="margin-top:4px;font-size:0.8em;padding:4px 8px;"
            data-t="briefResetDefault"></button>
  </div>

</div>

<div class="btn-group" style="margin-top:14px;">
  <button class="btn" id="briefPrintBtn">
    &#128424; <span data-t="briefPrint"></span>
  </button>
  <button class="btn" id="briefMdBtn">
    &#11015; <span data-t="briefDownloadMd"></span>
  </button>
</div>
```

---

## Schritt 3 — i18n-Strings (DE-Block)

In `i18n.js`, im DE-Block (zwischen die schon vorhandenen
`audiolog*`-Keys und die neuen `audColEl/…/audiologRequestsBody`
aus BA 42, oder einfach hinter `audiologRequestsBody`), folgende
neuen Keys ergänzen:

```js
    briefTitle: "Brief an den Audiologen",
    briefDesc: "Separates Druckdokument für administrative Anliegen. Die Abschnitte sind editierbar und werden per Häkchen ein- oder ausgeblendet. Inhalt wird mit den Daten gemeinsam gespeichert.",
    briefChkNote: "Persönliche Notiz mit aufnehmen (siehe oben)",
    briefChkRequests: "Bitten an den Audiologen",
    briefChkMapPlan: "Gewünschte Programm-Belegung",
    briefResetDefault: "Auf Standard zurücksetzen",
    briefPrint: "Brief drucken",
    briefDownloadMd: "Brief als Markdown",
    briefHeading: "Brief an den Audiologen",
    briefNoteHeading: "Persönliche Notiz",
    briefRequestsHeading: "Meine Bitten",
    briefMapPlanHeading: "Gewünschte Programm-Belegung",
    briefDefaultRequests: "Das folgende brauche ich für Lautstärken-Messung zu Hause mit dem CI Sound Balancing Tool:\n\n**1. Bitte drucken Sie mir einen vollständigen Fitting-Report (alle Map-Parameter) aller meiner aktuellen MAPs aus.**\n\n- Implantat-Modell und Audioprozessor-Modell\n- Kodierungsstrategie und Stimulationsrate\n- FAT (Frequency Allocation Table): Mittenfrequenz pro Elektrode in Hz\n- THR (T-Level) pro Elektrode\n- MCL pro Elektrode\n- MED-EL: MCL in qu\n- Cochlear: C-Level in CL\n- Advanced Bionics: M-Level in CU\n- Status jeder Elektrode (aktiv / deaktiviert)\n- MED-EL zusätzlich: MAPLAW c-Wert\n- Cochlear zusätzlich: IIDR (Instantaneous Input Dynamic Range, in dB)\n- Advanced Bionics zusätzlich: IDR (Input Dynamic Range, in dB)\n\n**2. Bitte legen Sie mir auf einer freien Programm-Position eine Test-MAP an, in der alle ASM-Filter deaktiviert sind:**\n\n- Microphone Directionality: Omni\n- Adaptive Intelligence: Off\n- Wind Noise Reduction: Off\n- Ambient Noise Reduction: Off\n- Transient Noise Reduction: Off\n\nCompression Ratio und sonstige Map-Parameter bitte unverändert lassen. Diese MAP brauche ich für Lautheits-Messung zu Hause.",
    briefDefaultMapPlan: "Ich bitte um diese Programmbelegung:\n\nMAP 1: Mein bisheriges Hauptprogramm, mit dem ich am Besten vertraut bin.\nMAP [  ]: Dieses Programm. Gewünschte Filter: [?]\nMAP [  ]:\nMAP 4: Testprogramm OHNE Filter mit durchgehend gleich lauten Elektroden gemäß Messung.",
```

Wie in BA 42: für die anderen Sprach-Blöcke (en/fr/es) die DE-Strings
1:1 als Fallback einsetzen.

---

## Schritt 4 — Render-Helfer und Listener in `init.js`

In `init.js`, **direkt nach** dem in BA 42 hinzugefügten
`audiologNoteEl`-Listener, folgenden Block einfügen:

```js
// ===== Audiologen-Brief (Sub-Block) =====

function _briefDefaultRequests() { return t("briefDefaultRequests"); }
function _briefDefaultMapPlan()  { return t("briefDefaultMapPlan"); }

function _briefSyncUI() {
  const reqEl = document.getElementById("briefRequestsInput");
  const mapEl = document.getElementById("briefMapPlanInput");
  if (reqEl) reqEl.value = (audiologBriefRequests != null)
    ? audiologBriefRequests : _briefDefaultRequests();
  if (mapEl) mapEl.value = (audiologBriefMapPlan != null)
    ? audiologBriefMapPlan : _briefDefaultMapPlan();
  const cN = document.getElementById("briefChkNote");
  const cR = document.getElementById("briefChkRequests");
  const cM = document.getElementById("briefChkMapPlan");
  if (cN) cN.checked = !!audiologBriefShowNote;
  if (cR) cR.checked = !!audiologBriefShowRequests;
  if (cM) cM.checked = !!audiologBriefShowMapPlan;
}

const briefReqEl = document.getElementById("briefRequestsInput");
if (briefReqEl) {
  briefReqEl.addEventListener("input", function () {
    audiologBriefRequests = this.value;
  });
}
const briefMapEl = document.getElementById("briefMapPlanInput");
if (briefMapEl) {
  briefMapEl.addEventListener("input", function () {
    audiologBriefMapPlan = this.value;
  });
}
const briefChkN = document.getElementById("briefChkNote");
if (briefChkN) {
  briefChkN.addEventListener("change", function () {
    audiologBriefShowNote = this.checked;
  });
}
const briefChkR = document.getElementById("briefChkRequests");
if (briefChkR) {
  briefChkR.addEventListener("change", function () {
    audiologBriefShowRequests = this.checked;
  });
}
const briefChkM = document.getElementById("briefChkMapPlan");
if (briefChkM) {
  briefChkM.addEventListener("change", function () {
    audiologBriefShowMapPlan = this.checked;
  });
}
const briefResetR = document.getElementById("briefResetRequestsBtn");
if (briefResetR) {
  briefResetR.addEventListener("click", function () {
    audiologBriefRequests = null;
    _briefSyncUI();
  });
}
const briefResetM = document.getElementById("briefResetMapPlanBtn");
if (briefResetM) {
  briefResetM.addEventListener("click", function () {
    audiologBriefMapPlan = null;
    _briefSyncUI();
  });
}

const briefPrintBtnEl = document.getElementById("briefPrintBtn");
if (briefPrintBtnEl) briefPrintBtnEl.addEventListener("click", audiologBriefPrint);
const briefMdBtnEl = document.getElementById("briefMdBtn");
if (briefMdBtnEl) {
  briefMdBtnEl.addEventListener("click", () => {
    mdDownload(buildAudiologBriefMarkdown(), mdAudiologBriefFilename());
  });
}

// Initial Defaults befüllen (Sprache muß zu diesem Zeitpunkt schon
// stehen, daher in applyLang() unten erneut)
_briefSyncUI();
```

Zusätzlich muss `_briefSyncUI()` nach jedem Sprachwechsel **erneut**
aufgerufen werden, damit die Default-Texte in der aktuellen Sprache
erscheinen, wenn der Patient nichts editiert hat.

In `i18n.js`, in der Funktion `applyLang()` (die nach Sprachwechsel
alle `data-t`-Elemente neu setzt — Position dort suchen, wo aktuelle
Element-Aktualisierung passiert), ganz am Ende ergänzen:

```js
  if (typeof _briefSyncUI === "function") _briefSyncUI();
```

---

## Schritt 5 — Generator und Druck in `print-md.js`

In `print-md.js`, **am Ende der Datei** (nach dem in BA 42 ersetzten
Modus-B-Block), folgenden neuen Block anhängen:

```js
// ============================================================
// MODUS B2 — AUDIOLOGEN-BRIEF
// ============================================================
// Separates, kürzeres Dokument für administrative Anliegen.
// Drei Sektionen, alle Checkbox-wählbar:
//   1) Persönliche Notiz (aus audiologUserNote)
//   2) Bitten an den Audiologen (audiologBriefRequests)
//   3) Gewünschte Programm-Belegung (audiologBriefMapPlan)

function mdAudiologBriefFilename() {
  return `ci-sound-balancing-brief-${mdDateStampFile()}.md`;
}

function _briefRequestsActive() {
  return (audiologBriefRequests != null) ? audiologBriefRequests : t("briefDefaultRequests");
}
function _briefMapPlanActive() {
  return (audiologBriefMapPlan != null) ? audiologBriefMapPlan : t("briefDefaultMapPlan");
}

function buildAudiologBriefMarkdown() {
  const now = new Date();
  const dateStr = now.toLocaleString(
    lang === "de" ? "de-DE"
    : lang === "fr" ? "fr-FR"
    : lang === "es" ? "es-ES" : "en-US"
  );
  const parts = [];
  parts.push(`# CI Sound Balancing — ${t("briefHeading")}\n`);
  parts.push(`**${t("archivHeaderDate")}**: ${dateStr}`);
  if (typeof APP_VERSION !== "undefined") {
    parts.push(`**${t("audiologToolVersion")}**: ${APP_VERSION}`);
  }
  parts.push("");

  // 1) Notiz
  const note = (typeof audiologUserNote === "string") ? audiologUserNote.trim() : "";
  if (audiologBriefShowNote && note.length > 0) {
    parts.push(`## ${t("briefNoteHeading")}`);
    parts.push("");
    parts.push(note);
    parts.push("");
  }

  // 2) Bitten
  if (audiologBriefShowRequests) {
    parts.push(`## ${t("briefRequestsHeading")}`);
    parts.push("");
    parts.push(_briefRequestsActive());
    parts.push("");
  }

  // 3) MAP-Belegungs-Wunsch
  if (audiologBriefShowMapPlan) {
    parts.push(`## ${t("briefMapPlanHeading")}`);
    parts.push("");
    parts.push(_briefMapPlanActive());
    parts.push("");
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function audiologBriefPrint() {
  const md = buildAudiologBriefMarkdown();
  const html = _mdToHtmlBasic(md);
  const footer = `<hr><div style="font-size:0.75em;color:#444;text-align:center;margin-top:12px;">CI Sound Balancing Tool` +
                 (typeof APP_VERSION !== "undefined" ? ` v${APP_VERSION}` : "") +
                 ` · ${new Date().toLocaleString(lang === "de" ? "de-DE" : "en-US")}</div>`;
  const body = html + footer;
  if (typeof openPrintWindow !== "function") {
    alert("openPrintWindow not available — print.js missing?");
    return;
  }
  openPrintWindow(t("briefHeading"), body);
}
```

---

## Schritt 6 — JSON-Persistenz

In `file.js`, `saveJson()` (heute Z. 50ff), **direkt neben**
`audiologUserNote: …` (aus BA 42) ergänzen:

```js
    audiologBriefRequests: (typeof audiologBriefRequests !== "undefined") ? audiologBriefRequests : null,
    audiologBriefMapPlan:  (typeof audiologBriefMapPlan  !== "undefined") ? audiologBriefMapPlan  : null,
    audiologBriefShowNote:     (typeof audiologBriefShowNote     !== "undefined") ? audiologBriefShowNote     : true,
    audiologBriefShowRequests: (typeof audiologBriefShowRequests !== "undefined") ? audiologBriefShowRequests : true,
    audiologBriefShowMapPlan:  (typeof audiologBriefShowMapPlan  !== "undefined") ? audiologBriefShowMapPlan  : true,
```

In `file.js`, `applyLoadedData(d)`, **direkt neben** dem aus BA 42
geladenen `audiologUserNote` ergänzen:

```js
  // Audiologen-Brief laden
  if (typeof audiologBriefRequests !== "undefined") {
    audiologBriefRequests = (typeof d.audiologBriefRequests === "string" || d.audiologBriefRequests === null)
      ? d.audiologBriefRequests : null;
  }
  if (typeof audiologBriefMapPlan !== "undefined") {
    audiologBriefMapPlan = (typeof d.audiologBriefMapPlan === "string" || d.audiologBriefMapPlan === null)
      ? d.audiologBriefMapPlan : null;
  }
  if (typeof audiologBriefShowNote !== "undefined") {
    audiologBriefShowNote = (typeof d.audiologBriefShowNote === "boolean") ? d.audiologBriefShowNote : true;
  }
  if (typeof audiologBriefShowRequests !== "undefined") {
    audiologBriefShowRequests = (typeof d.audiologBriefShowRequests === "boolean") ? d.audiologBriefShowRequests : true;
  }
  if (typeof audiologBriefShowMapPlan !== "undefined") {
    audiologBriefShowMapPlan = (typeof d.audiologBriefShowMapPlan === "boolean") ? d.audiologBriefShowMapPlan : true;
  }
  if (typeof _briefSyncUI === "function") _briefSyncUI();
```

In `file.js`, `resetAll()`, **direkt neben** dem aus BA 42
zurückgesetzten `audiologUserNote` ergänzen:

```js
  if (typeof audiologBriefRequests !== "undefined") {
    audiologBriefRequests = null;
    audiologBriefMapPlan  = null;
    audiologBriefShowNote     = true;
    audiologBriefShowRequests = true;
    audiologBriefShowMapPlan  = true;
    if (typeof _briefSyncUI === "function") _briefSyncUI();
  }
```

---

## Schritt 7 — CODESTRUKTUR.md aktualisieren

In `CODESTRUKTUR.md`, im Abschnitt `print-md.js` (heute Z. 114),
**am Ende der Modus-B-Beschreibung** anhängen:

> Modus B2 (Audiologen-Brief): `buildAudiologBriefMarkdown`,
> `audiologBriefPrint`, `mdAudiologBriefFilename`. Helper
> `_briefRequestsActive`, `_briefMapPlanActive`. Brief-State liegt
> in den top-level Variablen `audiologBriefRequests`,
> `audiologBriefMapPlan`, `audiologBriefShowNote`,
> `audiologBriefShowRequests`, `audiologBriefShowMapPlan`. UI-Sync
> `_briefSyncUI` in `init.js`, wird auch nach Sprachwechsel in
> `applyLang` aufgerufen.

Im Abschnitt über `state-side.js`/Globals die Variablen mit
aufnehmen.

---

## Schritt 8 — SPEC.md aktualisieren

In `SPEC.md`, im Abschnitt „Audiologen-Box im Tab Laden/Speichern"
(nach BA 42 schon angepaßt), **am Ende** ergänzen:

```
### Audiologen-Brief (separates Dokument)

Innerhalb derselben Karte „Einstellungswünsche an den Audiologen"
liegt unter einem Trennstrich ein zweiter Sub-Block „Brief an den
Audiologen". Dieser erzeugt ein **separates** Druck- und Markdown-
Dokument für administrative Anliegen, getrennt vom Korrektur-Bericht.

Inhalt, Checkbox-wählbar (alle default an):

1. Persönliche Notiz (übernimmt das Notiz-Feld aus dem Korrektur-
   Bericht, falls ausgefüllt).
2. Bitten an den Audiologen (Fitting-Report + Test-MAP ohne ASM):
   editierbares Textfeld mit Default-Text aus `briefDefaultRequests`.
3. Gewünschte Programm-Belegung: editierbares Textfeld mit Default-
   Template aus `briefDefaultMapPlan`.

Editierte Texte werden top-level im JSON persistiert
(`audiologBriefRequests`, `audiologBriefMapPlan`); `null` =
„unverändert, Default aus i18n". Checkbox-Zustände ebenfalls
top-level (`audiologBriefShow{Note,Requests,MapPlan}`).

Dateiname: `ci-sound-balancing-brief-<datum>-<zeit>.md`.

Duplikation der Bitten zwischen Korrektur-Bericht und Brief ist
beabsichtigt: der Brief soll auch eigenständig drucken können,
ohne daß der Korrektur-Bericht mit ausgeht.
```

---

## Akzeptanztest

1. **Sub-Block sichtbar.** Tab Laden/Speichern öffnen.
   *Erwartet:* Karte „Einstellungswünsche an den Audiologen" zeigt
   unter dem oberen Button-Paar einen Trennstrich, darunter
   „Brief an den Audiologen" mit Beschreibungs-Text, drei
   Checkboxen (alle an), zwei Textareas (vorausgefüllt mit
   Default-Texten), zwei „Auf Standard zurücksetzen"-Buttons,
   und zwei Aktions-Buttons „Brief drucken" + „Brief als Markdown".

2. **Default-Texte korrekt.** *Erwartet:* Bitten-Textarea zeigt
   den Text beginnend mit „Das folgende brauche ich für
   Lautstärken-Messung zu Hause …". MAP-Belegungs-Textarea zeigt
   den Text beginnend mit „Ich bitte um diese Programmbelegung:
   MAP 1: …".

3. **Bearbeiten und Speichern.** Im Bitten-Textarea einen Satz
   am Ende anhängen („Bitte zusätzlich X."). Tool speichern als
   JSON. JSON öffnen.
   *Erwartet:* Feld `"audiologBriefRequests": "<editierter Text>"`
   enthält den editierten String.

4. **Laden bringt Edits zurück.** Tool neu laden (F5), JSON
   wieder laden.
   *Erwartet:* Bitten-Textarea zeigt den editierten Text, nicht
   den Default.

5. **„Auf Standard zurücksetzen".** Klick auf den entsprechenden
   Knopf unter dem Bitten-Textfeld.
   *Erwartet:* Textarea zeigt wieder den Default-Text. Beim
   nächsten Speichern wird `"audiologBriefRequests": null` ins
   JSON geschrieben.

6. **Notiz mit Brief drucken.** Notiz-Feld (oben in der Karte)
   mit „Testnotiz" befüllen. Brief drucken, alle drei Checkboxen
   an.
   *Erwartet:* gedrucktes Brief-Dokument enthält drei Sektionen:
   „Persönliche Notiz" mit „Testnotiz", „Meine Bitten" mit
   Bitten-Text, „Gewünschte Programm-Belegung" mit MAP-Plan.

7. **Notiz weg-gehakt.** Häkchen vor „Persönliche Notiz mit
   aufnehmen" abwählen. Brief drucken.
   *Erwartet:* Sektion „Persönliche Notiz" fehlt im Brief.

8. **Alle drei Checkboxen aus.** Brief drucken.
   *Erwartet:* nur Kopf + Footer, kein Sektions-Inhalt.

9. **Markdown-Export.** Brief als Markdown-Knopf.
   *Erwartet:* Datei `ci-sound-balancing-brief-<datum>-<zeit>.md`
   wird heruntergeladen. Inhalt identisch zum Druck (ohne Footer).

10. **Brief unabhängig vom Korrektur-Bericht.** Auch wenn alle
    Mess-Ergebnisse leer sind (frisch zurückgesetzt): „Brief
    drucken" funktioniert und zeigt die Default-Texte. Der
    Korrektur-Bericht-Knopf darüber wirft keine Fehler.

11. **Reset-All.** „Reset"-Knopf im Tab Laden/Speichern.
    *Erwartet:* nach Bestätigung sind Brief-Textareas wieder auf
    Default-Text, alle drei Checkboxen wieder an, Notiz-Feld
    leer.

12. **Sprachwechsel.** UI-Sprache von DE auf EN umschalten (sofern
    Sprachwahl-UI vorhanden).
    *Erwartet:* Default-Texte erscheinen in der DE-Fallback-Version
    (weil EN-Übersetzung gemäß BA 42/43-Hinweis 1:1 die DE-Strings
    bekommt). Sobald Übersetzungen ergänzt werden, ändert sich der
    Default mit. Editierte Texte bleiben unverändert beim Sprach-
    wechsel.

13. **Checkbox-Zustände persistiert.** Eine Checkbox ausschalten,
    Tool speichern, JSON öffnen.
    *Erwartet:* das zugehörige Boolean-Feld
    (`audiologBriefShowNote/Requests/MapPlan`) im JSON ist `false`.
    Nach Reload des JSONs ist das Häkchen wieder aus.

14. **Korrektur-Bericht weiterhin intakt.** „Drucken (mit Grafik)"
    aus dem oberen Button-Paar.
    *Erwartet:* Korrektur-Bericht aus BA 42 erscheint unverändert.
    Der Brief-Sub-Block beeinflußt ihn nicht.

---

## Selbstprüfungs-Auftrag an Sonnet

Bevor du dem Nutzer „fertig" meldest, jede Akzeptanz-Kriterie
einzeln durchgehen und für jede melden: **erfüllt / nicht erfüllt /
unklar**, jeweils mit konkreter Datei- und Zeilenangabe der Stelle,
die das Verhalten erzeugt.

Wenn du etwas als unklar markierst, ist das ein Signal zur
Rückfrage, nicht zur stillschweigenden Annahme.

Prüfe insbesondere:
- Sind die fünf Brief-State-Variablen in `state-side.js` deklariert,
  und werden sie in `saveJson`, `applyLoadedData` und `resetAll`
  korrekt persistiert?
- Wird `_briefSyncUI()` sowohl nach `applyLoadedData` als auch
  nach `applyLang` aufgerufen?
- Funktioniert „Auf Standard zurücksetzen" so, daß das interne
  State-Feld auf `null` gesetzt wird und das Textarea wieder den
  i18n-Default zeigt?
- Sind die i18n-Keys `briefDefaultRequests` und `briefDefaultMapPlan`
  in **allen** Sprach-Blöcken vorhanden (mit DE-Fallback), damit
  `_briefSyncUI` nicht „undefined" in die Textareas schreibt?
- Bleibt der Korrektur-Bericht aus BA 42 unverändert
  (Akzeptanztest 14)?
