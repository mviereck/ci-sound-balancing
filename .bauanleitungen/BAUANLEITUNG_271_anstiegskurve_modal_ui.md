# Bauanleitung 271 — Bedien-UI für die globale Anstiegs-/Ausklangkurve im Tonauswahl-Modal

**Zielversion:** `0.4.271-beta`
**Voraussetzung:** BA 270 ist gebaut. Diese BA bedient die dort angelegten
globalen Variablen (`gToneEnvAttackForm`, `gToneEnvAttackMs`,
`gToneEnvDbFloor`, `gToneEnvRelease`) und den Setter `setToneEnvelope(patch)`.

> **Wichtig zu Anführungszeichen:** In allen `.js`-Snippets ausschließlich
> ASCII `"` (U+0022) und `'` (U+0027). Keine typografischen Quotes als
> String-Begrenzer.

**Vor Baubeginn verifizieren** (BA 270 wirklich vorhanden):
`grep -n "function setToneEnvelope\|gToneEnvAttackForm" js/audio.js` muss die
Definitionen zeigen. Falls nicht → anhalten und melden, BA 270 fehlt.

---

## Ziel

Im Tonauswahl-Modal (`openToneSelectionDialog` in `js/tone-popup.js`) eine
neue Sektion **„Anstieg & Ausklang"** einbauen. Sie ist **immer** sichtbar
(unabhängig von `cfg.showToggles`), weil die Einstellung toolweit für alle
Töne gilt. Vier Bedienelemente:

- **Anstiegsform** (Buttonreihe): hart / linear / weich (cos²) / dB-linear
- **Anschwingzeit** (editierbares Zahlenfeld mit Vorschlägen 0/50/100/250/
  500/1000 ms; bei „hart" ausgegraut)
- **Startpegel** (editierbares Zahlenfeld mit Vorschlägen −40/−50/−60 dB;
  nur sichtbar, wenn Form = dB-linear)
- **Ausklang** (Buttonreihe): kurz / symmetrisch / hart

Jede Änderung ruft sofort `setToneEnvelope({...})` (schreibt globale
Variable + persistiert in localStorage) und wirkt unmittelbar auf die
nächsten Vorhör-Klicks. Kein OK-Bestätigen nötig (wie die bestehenden
Vol/Dur/Pau-Felder).

---

## Schritt 1 — Sektion einfügen (js/tone-popup.js)

Die Sektion wird **nach den beiden Hint-Boxen** und **vor dem Korrektur-
Toggle-Block** eingesetzt. Aktuell endet der zweite Hint-Block (`if
(cfg.extraHintKey) {…}`) bei Zeile 265; danach folgt bei Zeile 267 der
Kommentar `// BA 239: Korrektur-Toggles`.

**Direkt vor** der Zeile

```js
  // BA 239: Korrektur-Toggles. Stil analog Player-Toggles
```

folgenden Block einfügen:

```js
  // BA 271: Globale Anstiegs-/Ausklang-Einstellung. Steht immer sichtbar
  // (unabhaengig von showToggles), weil sie toolweit fuer ALLE Toene gilt.
  // Liest die globalen gToneEnv*-Variablen (BA 270) und schreibt via
  // setToneEnvelope (sofort persistent + sofort wirksam).
  (function buildToneEnvSection() {
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

```

Die IIFE läuft im Funktionskörper von `openToneSelectionDialog` und sieht
`dlg`, `setToneEnvelope` und die `gToneEnv*`-Variablen aus dem umgebenden
Scope. Die `data-t`-Attribute werden vom bereits vorhandenen
`applyLang()`-Aufruf am Ende von `openToneSelectionDialog` (Zeile 736)
übersetzt — die Sektion wird vorher in `dlg` gehängt, also passt die
Reihenfolge.

---

## Schritt 2 — i18n-Keys (i18n/de.js)

Bei den anderen `tonePopup`-Keys (um Zeile 1110–1141) folgende Keys
ergänzen:

```js
    toneEnvSection:      "Anstieg & Ausklang (global, gilt für alle Töne)",
    toneEnvFormLabel:    "Anstieg:",
    toneEnvFormHard:     "hart",
    toneEnvFormLinear:   "linear",
    toneEnvFormCos2:     "weich (cos²)",
    toneEnvFormDblin:    "dB-linear",
    toneEnvAttackMs:     "Anschwingzeit",
    toneEnvDbFloor:      "Startpegel",
    toneEnvReleaseLabel: "Ausklang:",
    toneEnvRelShort:     "kurz",
    toneEnvRelSym:       "symmetrisch",
    toneEnvRelHard:      "hart",
```

> `en.js`/`fr.js`/`es.js` werden nicht angefaßt; fehlende Keys fallen auf
> den deutschen Text zurück. Übersetzungen folgen, wenn der Nutzer dazu
> auffordert.

---

## Schritt 3 — Versionsnummer (js/version.js)

```js
const APP_VERSION = "0.4.271-beta";
```

---

## Akzeptanztest (vom Nutzer durchzuklicken)

Seite neu laden.

1. **Sektion sichtbar.** Tab Messungen → Sub-Tab Elektrodenlautstärke →
   Tonart-Knopf öffnen (oder Tab Implantat → Tonart wählen). Erwartet: oben
   im Modal, unter den gelben Hinweis-Boxen, die Sektion „Anstieg &
   Ausklang" mit vier Anstiegs-Knöpfen, einem Anschwingzeit-Feld und drei
   Ausklang-Knöpfen.
2. **Default markiert.** Erwartet: „weich (cos²)" grün hervorgehoben,
   Anschwingzeit 500, Ausklang „kurz" grün, Startpegel-Feld **nicht**
   sichtbar.
3. **dB-linear blendet Startpegel ein.** „dB-linear" anklicken. Erwartet:
   Knopf wird grün, ein „Startpegel"-Feld (−50 dB) erscheint rechts der
   Anschwingzeit.
4. **Hart graut Zeit aus.** „hart" anklicken. Erwartet: Anschwingzeit-Feld
   wird blass/ausgegraut. Ein Vorhör-Ton (Knopf an einer Tonart) setzt
   jetzt hart ein.
5. **Editierbare Zeit.** „weich (cos²)" zurückwählen, ins Anschwingzeit-Feld
   tippen (z.B. 1000), Feld verlassen. Vorhör-Ton anhören. Erwartet:
   deutlich längeres Anschwingen. Das Feld bietet beim Anklicken die
   Vorschläge 0/50/100/250/500/1000.
6. **Ausklang-Modi.** „symmetrisch" und „hart" durchklicken, je einen
   Vorhör-Ton anhören. Erwartet bei „hart": hörbar abruptes Tonende.
7. **Persistenz.** Modal schließen, Seite neu laden, Modal erneut öffnen.
   Erwartet: die zuletzt gewählten Werte sind noch gesetzt (grün markiert,
   Zahlen erhalten).
8. **Gilt überall.** Das Modal aus einem anderen Aufrufer öffnen (Implantat
   vs. Messungen). Erwartet: dieselbe Einstellung, dieselben Markierungen.
9. **Keine Konsolenfehler** (kein roter Banner).

---

## Selbstprüfungs-Auftrag an dich (vor der Fertig-Meldung)

Jeden Akzeptanzpunkt einzeln als erfüllt / nicht erfüllt / unklar melden,
mit Datei- und Zeilenangabe. Zusätzlich bestätigen:

- Die Sektion sitzt zwischen den Hint-Boxen und dem Toggle-Block und wird
  **unabhängig** von `cfg.showToggles` gerendert (Datei:Zeile).
- Jeder der vier Bedien-Pfade ruft `setToneEnvelope({...})` mit dem
  korrekten Feld (`attackForm` / `attackMs` / `dbFloor` / `release`).
- `refreshEnvUI()` blendet das Startpegel-Feld nur bei `dblin` ein und
  graut die Anschwingzeit nur bei `hard` aus.
- Versionsnummer steht auf `0.4.271-beta`.

Bei „unklar": zurückfragen, nicht still annehmen.

---

## Hinweis Übersetzungen

Nur Deutsch angefaßt. Eine spätere Mini-Anleitung „Übersetzungen für die
Anstieg-/Ausklang-Sektion" kann die zwölf neuen Keys plus die in BA 270
geänderten Profil-Beschreibungen für en/fr/es nachziehen — wenn der Nutzer
dazu auffordert.
