# BAUANLEITUNG 169 — Hz-Eingabe: Tab-Fokus bewahren (kein voller Tabellen-Rebuild)

**Ziel:** Beim Eintragen eines Werts in die Spalte „Hz eigene" (Klasse `.fo`) löst der `change`-Handler heute einen kompletten `buildFreqTable()`-Aufruf aus. Dabei wird das gesamte Tabellen-DOM ersetzt — der vom Browser per Tab-Sprung anvisierte nächste Input ist danach ein „totes" DOM-Element, der Fokus landet ins Nichts, der Nutzer muß erneut klicken, bevor er weiter tippen kann.

Refactor: Eine kleine, fokussierte Funktion `updateFreqTableHints()` aktualisiert nur die Hz-abhängigen Hinweise und den Warnbalken, ohne die Tabelle neu zu rendern. Der `.fo`-Handler ruft nur noch diese Funktion. `.it` und `.iu` (THR/MCL) sind nicht betroffen — sie rufen heute schon kein `buildFreqTable()` auf, der Fokus läuft dort sauber durch.

**Versionsbump:** `js/version.js` → `"3.1.169-beta"`.

**i18n:** Diese BA ändert keinerlei Texte — kein Eingriff in `i18n/de.js` und den anderen Sprachdateien.

**Vorrang:** Wenn beim Bauen etwas nicht aufgeht wie beschrieben, **stoppen und melden** — nicht raten.

---

## Schritt 0 — Versionsbump

Datei `js/version.js` öffnen, eine Zeile, ersetzen:

```js
const APP_VERSION = "3.1.168-beta";
```

durch

```js
const APP_VERSION = "3.1.169-beta";
```

---

## Schritt 1 — Neue Funktion `updateFreqTableHints()` in `freq-table.js`

Datei `js/freq-table.js`. Direkt **nach** dem Funktionskörper von `buildFreqTable()` (also nach der schließenden `}` von `buildFreqTable`, vor `function updRef() { … }` Z. ~309) eine neue Funktion einfügen:

```js
// BA 169: Aktualisiert nur die Hz-abhängigen Hinweise und den Warnbalken,
// ohne die Tabelle neu zu rendern. Wird vom .fo-change-Handler aufgerufen,
// damit Tab-Fokus zwischen Eingabefeldern erhalten bleibt.
function updateFreqTableHints() {
  const cfg = sideData[activeSide].config || "ci";
  const isAcoustic = ["hg", "normal", "shoh"].includes(cfg);
  const isUnknownCfg = cfg === "unknown";
  const isUnknownMfr = !isAcoustic && cfg === "ci"
    && (sideData[activeSide].manufacturer === "unknown" || !sideData[activeSide].manufacturer);
  // Beide Seiten akustisch
  const leftCfg2  = sideData.left.config  || "unknown";
  const rightCfg2 = sideData.right.config || "unknown";
  const _isAc = function(c) { return c === "hg" || c === "normal" || c === "shoh"; };
  const bothAcoustic = _isAc(leftCfg2) && _isAc(rightCfg2);
  // Wenn die Tabelle gar nicht gerendert würde: Hinweise und Warnbalken aus.
  // (Sollte beim .fo-change normalerweise nicht eintreten — Sicherheitsnetz.)
  if (isUnknownCfg || isUnknownMfr || bothAcoustic) {
    ["freqDeactHintEl","freqAbfHintEl"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    const wbOff = document.getElementById("deactWarnBar");
    if (wbOff) wbOff.remove();
    return;
  }
  // „vollständig eigene Hz" = jede aktive Elektrode hat elFreqOwn[i] != null
  const ownHzComplete = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .every((i) => elFreqOwn[i] != null);
  const hintEl = document.getElementById("freqDeactHintEl");
  if (hintEl) {
    hintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  const abfHintEl = document.getElementById("freqAbfHintEl");
  if (abfHintEl) {
    abfHintEl.style.display = (isAcoustic || ownHzComplete) ? "none" : "";
  }
  // Warnbalken: nur wenn deaktivierte Elektroden noch Standard-Frequenzen haben
  const hasDeact = (elActive || []).some((a) => a === false);
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => elFreqOwn[i] == null);
  let wb = document.getElementById("deactWarnBar");
  if (hasDeact && activeHasDefault) {
    if (!wb) {
      wb = document.createElement("div");
      wb.id = "deactWarnBar";
      wb.className = "warning-bar";
      wb.style.cssText =
        "background:#fee2e2;color:#dc2626;border-left:3px solid #dc2626;padding:8px 14px;border-radius:6px;margin-bottom:10px;font-size:.88em;line-height:1.5";
      const freqCard = document.getElementById("freqTable").closest(".card");
      freqCard.insertBefore(
        wb,
        document.getElementById("freqTable").parentElement,
      );
    }
    wb.innerHTML = t("warnDeactivated");
  } else if (wb) {
    wb.remove();
  }
  // Sperren ggf. live nachziehen (z.B. dep-Lock-Felder neu bewerten)
  if (typeof depLockApply === 'function') depLockApply();
}
```

**Wichtig:** Diese Funktion ist **kein Ersatz** für `buildFreqTable()`, sondern ein **schmaler Ausschnitt** davon. Die Logik ist 1:1 aus den Z. ~256–307 von `buildFreqTable()` übernommen, nur ohne Re-Render der Zeilen-DOM.

---

## Schritt 2 — `.fo`-Handler umstellen

Datei `js/freq-table.js`, Funktion `buildFreqTable()`, der `.fo`-Eingabe-Handler (Z. ~150–167).

**Vor:**

```js
  // Hz own inputs
  tb.querySelectorAll(".fo").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const i = +e.target.dataset.i,
        v = parseFloat(e.target.value);
      if (e.target.value === "" || isNaN(v)) {
        elFreqOwn[i] = null;
        e.target.value = "";
      } else if (v >= 20 && v <= 20000) {
        elFreqOwn[i] = v;
      } else {
        e.target.value = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
        return; // ungültiger Wert: keine Re-Render
      }
      buildFreqTable();
      // BA 151
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
```

**Nach:**

```js
  // Hz own inputs — BA 169: kein buildFreqTable() mehr, damit Tab-Fokus erhalten bleibt
  tb.querySelectorAll(".fo").forEach((inp) =>
    inp.addEventListener("change", (e) => {
      const i = +e.target.dataset.i,
        v = parseFloat(e.target.value);
      if (e.target.value === "" || isNaN(v)) {
        elFreqOwn[i] = null;
        e.target.value = "";
      } else if (v >= 20 && v <= 20000) {
        elFreqOwn[i] = v;
      } else {
        e.target.value = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
        return; // ungültiger Wert: keine Updates
      }
      // BA 169: schmale Hinweise-Aktualisierung statt voller Rebuild.
      // depLockApply wird intern in updateFreqTableHints aufgerufen.
      updateFreqTableHints();
    }),
  );
```

**Anmerkung:** `depLockApply()` ist im neuen `updateFreqTableHints()` enthalten — der separate Aufruf vorher entfällt damit. Ein doppelter Aufruf wäre nicht schädlich, aber sauberer einer.

---

## Schritt 3 — `.it`- und `.iu`-Handler bleiben unverändert

Die THR-/MCL-Handler (Z. ~169–189) rufen heute schon **kein** `buildFreqTable()` auf — Tab-Fokus läuft dort sauber durch. Kein Eingriff nötig. Falls Du beim Lesen den Eindruck hast, dort sei doch etwas zu tun: **stopp**, melden und nachfragen.

Begründung: THR und MCL beeinflussen die `ownHzComplete`-Berechnung in der Hinweise-Logik nicht; ihre Änderung erfordert kein Hinweis-Update.

---

## Schritt 4 — Selbstprüfungs-Auftrag an Sonnet

Bevor Du fertig meldest, gehe jeden Punkt einzeln durch und melde pro Punkt: **erfüllt / nicht erfüllt / unklar**, mit Datei und Zeilenangabe.

1. `js/version.js` zeigt `"3.1.169-beta"`.
2. In `js/freq-table.js` existiert eine neue Funktion `updateFreqTableHints()`, definiert **außerhalb** von `buildFreqTable()`, vor `updRef()`.
3. `updateFreqTableHints()` enthält die Logik für `freqDeactHintEl`-Sichtbarkeit, `freqAbfHintEl`-Sichtbarkeit, `deactWarnBar` add/remove und `depLockApply()`. Sie setzt **keine** `innerHTML` für die Hinweis-Boxen (Texte werden weiter beim vollen Rebuild gesetzt — wir aktualisieren nur Sichtbarkeit nach Hz-Eingabe).
4. `updateFreqTableHints()` hat einen Sicherheitspfad: bei `isUnknownCfg`/`isUnknownMfr`/beide-akustisch werden die beiden Hinweise und der Warnbalken ausgeblendet.
5. Der `.fo`-`change`-Handler in `buildFreqTable()` ruft **nicht mehr** `buildFreqTable()` auf, sondern `updateFreqTableHints()`.
6. Der separate `depLockApply()`-Aufruf direkt nach dem alten `buildFreqTable()` im `.fo`-Handler ist entfernt (jetzt in `updateFreqTableHints()`).
7. `.it`- und `.iu`-Handler sind unverändert.
8. `buildFreqTable()` selbst ist im Hinweise-/Warnbalken-Block (Z. ~256–307) **unverändert** — die Logik ist dupliziert, nicht extrahiert. (Bewusste Doppelung: beim vollen Rebuild wird der `innerHTML` der Hinweise neu gesetzt, beim Hz-Eingabe-Update nur die Sichtbarkeit.)
9. Browser-Test mit Konsole geöffnet zeigt keinen JS-Fehler beim Hz-Eintippen + Tab.

Wenn ein Punkt unklar ist, **nicht raten** — melden und auf Rückfrage warten.

---

## Schritt 5 — Akzeptanz-Checkliste für den Nutzer

Nach erfolgreichem Bau bitte vom Nutzer durchgehen lassen.

1. **Frischer Browser-Tab.** Reiter Implantat öffnen, Hörsituation = Cochlea-Implantat, Hersteller = MED-EL.
2. **In die Hz-eigene-Spalte klicken** (z.B. Zeile E1). Wert eintippen (z.B. `120`).
3. **Tab-Taste drücken.** Erwartet: Cursor steht direkt im THR-Feld der gleichen Zeile (`.it`-Input von E1) und Tastatureingabe ist **sofort** möglich, ohne extra Klick.
4. **Weiter Tab-Tab-Tab** durch die Tabelle: jeder nächste Input nimmt Eingaben sofort entgegen.
5. **Sichtbarkeit der Hinweise:** Wenn nach dem Eintragen aller aktiven Elektroden-Hz die Hinweise „Wichtig — deaktivierte Elektroden" und „Wichtig — Anatomy Based Fitting" verschwinden, ist die schmale Update-Funktion korrekt. Wenn man dann eine Hz löscht (Feld leeren + Tab), erscheinen die Hinweise wieder.
6. **Warnbalken:** Eine Elektrode in „Aktiv" abhaken, Hz-Feld dieser Zeile leer lassen — der rote Warnbalken über der Tabelle erscheint. Hz dieser Zeile dann eintragen — Warnbalken verschwindet.
7. **Andere Eingabewege wie bisher:** Status-Dropdown wechseln, Aktiv-Checkbox setzen, Excl-Checkbox setzen — jede dieser Aktionen darf weiterhin die ganze Tabelle neu rendern (Fokus geht hier verloren, das ist erwartet — Klick-Interaktionen). Nur Hz-Eingabe + Tab muß sauber durchlaufen.
8. **Konsole offen, keine roten Fehler.**

---

## Schritt 6 — Folgende BAs (Reihenfolge)

Nach BA 169 stehen weiterhin an:
- **BA 170** (oder höher, je nach Bumps): Tab-Sperre L1 (war BA 166 geplant — Numerierung verschiebt sich nach Schreibzeitpunkt aus `version.js`).
- Anschließend Sub-Tab- und Player-Sperre L2/L3.
- Anschließend Übersetzungs-Mini-BA für i18n.

---

## Schlußbemerkung

Sehr kurze BA — eine neue Funktion, ein angepasster Handler. Wenn beim Bauen mehr getan werden „muß", ist das ein Signal zur Rückfrage, nicht zur Ausweitung.
