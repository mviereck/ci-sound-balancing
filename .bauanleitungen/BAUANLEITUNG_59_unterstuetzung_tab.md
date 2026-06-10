# Bauanleitung 59 — Neuer Tab „Unterstützung" mit Finanz-Offenlegung

## Worum es geht

Ein neuer Tab am Ende der Tab-Leiste, der das Projekt vorstellt und
um regelmäßige Spenden bittet. Drei Karten:

1. **Aufruf** — knappe Bitte, Buttons zu Bankverbindung und E-Mail.
2. **So spenden** — zwei Bot-geschützte Dialoge (IBAN+QR-Code,
   E-Mail), erst auf Klick aus Fragmenten zusammengebaut.
3. **Offenlegung der Finanzierung** — Vergleichstabelle Vollausbau
   vs. aktueller Stand mit automatisch berechneten Summen und
   Differenzen, plus Erklärtexte.

Die Geldzahlen liegen separat in `js/finanzen.js`, damit sie ohne
Tab-Datei-Edit anpaßbar sind. Der Tab-Renderer liegt in einer eigenen
Datei `js/unterstuetzung.js`.

**Voraussetzung:** Bauanleitung 58 ist erledigt (favicon-Umzug,
Impressum-Mail). Das Bild `assets/images/banking.png` muß existieren
(liegt bereits dort).

## Stelle 1 — Versionsnummer hochzählen

In `js/version.js`:

```js
const APP_VERSION = "2.59-beta";
```

## Stelle 2 — Neue Datei `js/finanzen.js`

Vollständig neu anlegen. Diese Datei enthält **nur** Daten und
Berechnungs-Helfer, keine DOM-Manipulation:

```js
// finanzen.js – Spendenaufruf-Zahlen und Berechnungen für den
// Unterstützung-Tab. Reine Datenhaltung + Rechnen, keine UI-Logik.

var FINANZEN = {
  // Einzelposten: full = Vollausbau-Bedarf, current = aktueller Stand.
  // Wert 0 bei current heißt „derzeit nicht im Setup enthalten".
  posten: [
    { key: "kiPro",  full: 107.20, current: 44.00 },
    { key: "vps",    full:   5.34, current:  0    },
    { key: "space",  full:   3.81, current:  5.00 },
    { key: "domain", full:   1.78, current:  0    }
  ],
  // Aktuell durch Spenden gedeckter Anteil pro Monat (Euro).
  donationsMonthly: 25.00
};

function finBerechne() {
  var sumFull = 0, sumCurrent = 0;
  for (var i = 0; i < FINANZEN.posten.length; i++) {
    sumFull    += FINANZEN.posten[i].full;
    sumCurrent += FINANZEN.posten[i].current;
  }
  var donations = FINANZEN.donationsMonthly;
  return {
    sumFull:    sumFull,                         // 118.13
    sumCurrent: sumCurrent,                      //  49.00
    donations:  donations,                       //  25.00
    selfShare:  Math.max(0, sumCurrent - donations), // 24.00
    gapToFull:  Math.max(0, sumFull - donations),    // 93.13
    fullVsCurrent: Math.max(0, sumFull - sumCurrent) // 69.13
  };
}

function finFmtEuro(n) {
  // 107.2 → "107,20 €"
  return n.toFixed(2).replace(".", ",") + " €";
}
```

**Wichtig:** Die Funktion `finBerechne()` rundet **nicht** vor der
Summenbildung — Rundung passiert erst beim Formatieren über
`finFmtEuro()`. So bleibt die Tabelle konsistent (sonst ergeben
gerundete Einzelposten in der Summe Cents-Abweichung).

## Stelle 3 — Neue Datei `js/unterstuetzung.js`

Vollständig neu anlegen. Diese Datei rendert die Finanz-Tabelle in
den Tab und verdrahtet die beiden Dialog-Buttons (IBAN, E-Mail).

```js
// unterstuetzung.js – Unterstützung-Tab: rendert die Finanz-
// Offenlegungstabelle und die beiden Bot-geschützten Dialoge
// (Bankverbindung, Kontakt-E-Mail). Keine globalen Zustände,
// nur DOM-Befüllung.

function _untRenderFinanzTable() {
  var tbody = document.getElementById("untFinanzBody");
  var foot  = document.getElementById("untFinanzFoot");
  if (!tbody || !foot) return;

  var r = finBerechne();

  // Zeilen für die vier Einzelposten.
  var html = "";
  for (var i = 0; i < FINANZEN.posten.length; i++) {
    var p = FINANZEN.posten[i];
    var labelKey = "supportPosten_" + p.key;
    var currentCell = p.current > 0 ? finFmtEuro(p.current) : "–";
    html +=
      '<tr>' +
        '<td data-t="' + labelKey + '"></td>' +
        '<td class="num">' + finFmtEuro(p.full) + '</td>' +
        '<td class="num">' + currentCell + '</td>' +
      '</tr>';
  }
  tbody.innerHTML = html;

  // Footer-Zeilen: Summen, Spenden, Eigenanteil.
  foot.innerHTML =
    '<tr class="sum">' +
      '<td data-t="supportSumLabel"></td>' +
      '<td class="num">' + finFmtEuro(r.sumFull)    + '</td>' +
      '<td class="num">' + finFmtEuro(r.sumCurrent) + '</td>' +
    '</tr>' +
    '<tr>' +
      '<td data-t="supportDonationsLabel"></td>' +
      '<td class="num">–</td>' +
      '<td class="num">' + finFmtEuro(r.donations) + '</td>' +
    '</tr>' +
    '<tr>' +
      '<td data-t="supportSelfLabel"></td>' +
      '<td class="num">–</td>' +
      '<td class="num">' + finFmtEuro(r.selfShare) + '</td>' +
    '</tr>';

  // i18n nachziehen, damit die data-t-Labels gefüllt werden.
  if (typeof applyLang === "function") applyLang();

  // Hervorgehobene Differenz-Zeilen unterhalb der Tabelle.
  var gap = document.getElementById("untGapHints");
  if (gap) {
    gap.innerHTML =
      '<div class="support-gap-row">' +
        '<span data-t="supportGapCurrent"></span> ' +
        '<strong>' + finFmtEuro(r.fullVsCurrent) + '</strong>' +
      '</div>' +
      '<div class="support-gap-row support-gap-emph">' +
        '<span data-t="supportGapToFull"></span> ' +
        '<strong>' + finFmtEuro(r.gapToFull) + '</strong>' +
      '</div>';
    if (typeof applyLang === "function") applyLang();
  }
}

function _untBuildIban() {
  // Bankverbindung wird erst auf Klick aus Fragmenten zusammengebaut,
  // damit sie im HTML-Quelltext nicht im Klartext steht.
  var body = document.getElementById("untIbanBody");
  if (!body) return;

  var name = ["Martin", "Viereck"].join(" ");
  var iban = ["DE69", "4306", "0967", "3177", "7576", "00"].join(" ");
  var bic  = ["GENO", "DEM1", "GLS"].join("");
  var bank = "GLS Bank Bochum";
  var betreff = "Zweckbindung: Kostendeckung CI-Tool-Entwicklung";

  body.innerHTML =
    '<dl class="support-iban-list">' +
      '<dt data-t="supportIbanName"></dt><dd>' + name + '</dd>' +
      '<dt>IBAN</dt><dd class="mono">' + iban + '</dd>' +
      '<dt>BIC</dt><dd class="mono">' + bic + '</dd>' +
      '<dt data-t="supportIbanBank"></dt><dd>' + bank + '</dd>' +
      '<dt data-t="supportIbanBetreff"></dt><dd>' + betreff + '</dd>' +
    '</dl>' +
    '<p class="support-iban-qr-label" data-t="supportQrLabel"></p>' +
    '<img class="support-iban-qr" src="assets/images/banking.png" alt="">';

  if (typeof applyLang === "function") applyLang();
}

function _untBuildMail() {
  // Kontakt-E-Mail erst auf Klick aus Fragmenten.
  var body = document.getElementById("untMailBody");
  if (!body) return;

  var user = "mviereck";
  var domain = "ci-sound-balancing.org";
  var addr = user + "@" + domain;

  body.innerHTML = "";
  var p = document.createElement("p");
  p.setAttribute("data-t", "supportMailIntro");
  body.appendChild(p);

  var a = document.createElement("a");
  a.href = "mailto:" + addr;
  a.textContent = addr;
  a.className = "support-mail-addr";
  body.appendChild(a);

  if (typeof applyLang === "function") applyLang();
}

function _untOpenDialog(id, builderFn) {
  var dlg = document.getElementById(id);
  if (!dlg) return;
  if (typeof builderFn === "function") builderFn();
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
}

document.addEventListener("DOMContentLoaded", function () {
  _untRenderFinanzTable();

  var ibanBtn = document.getElementById("untShowIbanBtn");
  if (ibanBtn) ibanBtn.addEventListener("click", function () {
    _untOpenDialog("untIbanDialog", _untBuildIban);
  });

  var mailBtn = document.getElementById("untShowMailBtn");
  if (mailBtn) mailBtn.addEventListener("click", function () {
    _untOpenDialog("untMailDialog", _untBuildMail);
  });

  // Close-Buttons (Wiederverwendung des legal.js-Patterns, das auf
  // .legal-close hört — neue Dialoge bekommen dieselbe Klasse).
  // Wenn der legal.js-Handler nicht greift, sind die `data-close`-
  // Buttons in den eigenen Dialogen weiterhin selbst-verdrahtet:
  document.querySelectorAll("[data-close-support]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-close-support");
      var dlg = document.getElementById(id);
      if (!dlg) return;
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    });
  });
});
```

**Hinweis zum `applyLang()`-Aufruf:** In dieser Codebase wird i18n
über `data-t`-Attribute geregelt; die Funktion, die die Attribute in
sichtbaren Text übersetzt, heißt **vermutlich** `applyLang()`. Falls
sie anders heißt (z. B. `applyI18n()` oder `_applyTranslations()`),
in `js/i18n.js` nachsehen und alle vier Vorkommen in
`unterstuetzung.js` anpassen. Bei Unklarheit Rückfrage.

## Stelle 4 — `index.html`: Tab-Button hinzufügen

In `index.html` Z. 74–81 steht die Tab-Button-Liste. Hinter dem
letzten Tab (`tabFile`) einen neuen Button einfügen:

Vorher (Z. 81):
```html
        <button class="tab" data-tab="file" id="tabFile"></button>
```

Nachher:
```html
        <button class="tab" data-tab="file" id="tabFile"></button>
        <button class="tab" data-tab="unterstuetzung" id="tabUnterstuetzung" data-t="tabSupport"></button>
```

## Stelle 5 — `index.html`: Panel hinzufügen

Direkt nach dem `#panel-file`-Block (in `index.html` ca. Z. 1400, das
schließende `</div>` des panel-file finden) und **vor** dem
`<footer class="app-footer">`-Block ein neues Panel einfügen:

```html
      <!-- ===== UNTERSTÜTZUNG ===== -->
      <div id="panel-unterstuetzung" class="panel">

        <div class="card support-card-call">
          <h2 data-t="supportTitle"></h2>
          <p data-t="supportIntro1"></p>
          <p data-t="supportIntro2"></p>
          <div class="support-cta-row">
            <button type="button" class="btn btn-primary" id="untShowIbanBtn" data-t="supportShowIban"></button>
            <button type="button" class="btn" id="untShowMailBtn" data-t="supportShowMail"></button>
          </div>
          <p class="support-zweck" data-t="supportZweckHint"></p>
        </div>

        <div class="card support-card-finance">
          <h2 data-t="supportFinanceTitle"></h2>
          <p data-t="supportFinanceIntro"></p>

          <table class="support-finance-table">
            <thead>
              <tr>
                <th data-t="supportTableHeadPosten"></th>
                <th class="num" data-t="supportTableHeadFull"></th>
                <th class="num" data-t="supportTableHeadCurrent"></th>
              </tr>
            </thead>
            <tbody id="untFinanzBody"><!-- befüllt durch unterstuetzung.js --></tbody>
            <tfoot id="untFinanzFoot"><!-- befüllt durch unterstuetzung.js --></tfoot>
          </table>

          <div id="untGapHints" class="support-gap-hints"><!-- befüllt durch unterstuetzung.js --></div>

          <p data-t="supportExplainKi"></p>

          <h3 data-t="supportFutureTitle"></h3>
          <p data-t="supportFutureIntro"></p>
          <ul>
            <li data-t="supportFuturePlan1"></li>
            <li data-t="supportFuturePlan2"></li>
            <li data-t="supportFuturePlan3"></li>
            <li data-t="supportFuturePlan4"></li>
          </ul>
          <p data-t="supportFutureConsider"></p>
          <ul>
            <li data-t="supportFutureConsider1"></li>
            <li data-t="supportFutureConsider2"></li>
          </ul>

          <p data-t="supportGithubHint"></p>
        </div>

        <div class="card support-card-slogan">
          <p class="support-slogan" data-t="supportSlogan"></p>
        </div>

      </div>
```

## Stelle 6 — `index.html`: Zwei neue Dialoge

Direkt nach dem `</dialog>` von `licenseDialog` (in `index.html`
ca. Z. 1585) einfügen, **vor** dem `</div>` des `.container` und
dem `</body>`:

```html
      <dialog id="untIbanDialog" class="legal-dialog">
        <div class="legal-dialog-inner">
          <div class="legal-dialog-head">
            <h2 data-t="supportIbanTitle"></h2>
            <button type="button" class="legal-close" data-close-support="untIbanDialog" data-t="legalClose"></button>
          </div>
          <div class="legal-dialog-body" id="untIbanBody">
            <!-- Wird in unterstuetzung.js befüllt -->
          </div>
        </div>
      </dialog>

      <dialog id="untMailDialog" class="legal-dialog">
        <div class="legal-dialog-inner">
          <div class="legal-dialog-head">
            <h2 data-t="supportMailTitle"></h2>
            <button type="button" class="legal-close" data-close-support="untMailDialog" data-t="legalClose"></button>
          </div>
          <div class="legal-dialog-body" id="untMailBody">
            <!-- Wird in unterstuetzung.js befüllt -->
          </div>
        </div>
      </dialog>
```

## Stelle 7 — `index.html`: scripts-Array erweitern

In `index.html` Z. 20–27 die `scripts`-Liste anpassen. `finanzen.js`
und `unterstuetzung.js` ans Ende anfügen, nach `legal.js`:

Vorher (Z. 26):
```js
        'js/levels-tab.js', 'js/player.js', 'js/freq-warp.js', 'js/maplaw.js', 'js/lr-balance.js', 'js/latency.js', 'js/sentences.js', 'js/init.js', 'js/legal.js'
```

Nachher:
```js
        'js/levels-tab.js', 'js/player.js', 'js/freq-warp.js', 'js/maplaw.js', 'js/lr-balance.js', 'js/latency.js', 'js/sentences.js', 'js/init.js', 'js/legal.js',
        'js/finanzen.js', 'js/unterstuetzung.js'
```

(Komma am Ende der vorletzten Zeile beachten.)

## Stelle 8 — i18n-Schlüssel in `i18n/de.js`

**Nur Deutsch in dieser Bauanleitung.** Die anderen drei Sprachen
(en/fr/es) werden **nicht** angefaßt — sie kommen in einer eigenen
Mini-Anleitung, sobald die deutschen GUI-Texte feststehen. Solange
ein Key in en/fr/es fehlt, fällt die Anzeige auf den deutschen Text
zurück (Verhalten in `js/i18n.js`).

Am Ende des `Object.assign(L.de, { ... })`-Blocks in `i18n/de.js`
folgende Schlüssel ergänzen:

```js
    tabSupport: "Unterstützung",

    supportTitle: "Unterstützer für die Weiterentwicklung gesucht",
    supportIntro1: "Dieses Tool hilft Cochlea-Implantat-Trägern, die wahrgenommene Lautstärke einzelner Elektrodenfrequenzen systematisch zu vergleichen und eine Korrekturkurve für das Gespräch mit dem Audiologen zu erstellen. Es ist kostenlos, werbefrei und als Open-Source-Projekt auf GitHub veröffentlicht.",
    supportIntro2: "Damit das so bleibt und das Tool weiterwachsen kann, braucht es regelmäßige Unterstützung. Schon 1 oder 2 Euro pro Monat helfen spürbar — wenn 50 Nutzer mitmachen, ist der monatliche Vollbedarf gedeckt. Auch einmalige Spenden sind willkommen.",
    supportShowIban: "Bankverbindung anzeigen",
    supportShowMail: "Kontakt-E-Mail anzeigen",
    supportZweckHint: "Im Verwendungszweck bitte angeben: „Zweckbindung: Kostendeckung CI-Tool-Entwicklung\" — das hilft bei der sauberen Abrechnung.",

    supportFinanceTitle: "Offenlegung der Finanzierung",
    supportFinanceIntro: "Das Projekt wird privat und nicht-kommerziell betrieben, ohne institutionelle Förderung.",

    supportTableHeadPosten: "Posten",
    supportTableHeadFull: "Vollausbau",
    supportTableHeadCurrent: "Aktueller Stand",
    supportPosten_kiPro: "KI Claude (Entwicklungs-Assistenz)",
    supportPosten_vps: "Virtueller Server",
    supportPosten_space: "Webspace",
    supportPosten_domain: "Domain",
    supportSumLabel: "Bedarf gesamt",
    supportDonationsLabel: "Durch Spenden gedeckt",
    supportSelfLabel: "Aus eigener Tasche",
    supportGapCurrent: "Differenz Stand → Vollausbau:",
    supportGapToFull: "Zusätzlich nötige Spenden für Vollausbau:",

    supportExplainKi: "<b>Warum die KI-Position so hoch ist:</b> Die Entwicklung läuft im Wechselspiel mit einem KI-Assistenten (Claude). Ohne diesen Workflow wäre das jetzige Tempo nicht haltbar — die Druckausgaben, die Auswertungs-Charts und die Internationalisierung in vier Sprachen wären in vertretbarer Zeit so nicht entstanden. Das größere Abo erlaubt längere Arbeitssitzungen ohne Unterbrechung mitten in komplexen Änderungen.",

    supportFutureTitle: "Was mit Vollfinanzierung möglich wird",
    supportFutureIntro: "Geplant, derzeit mangels Mitteln ausgebremst:",
    supportFuturePlan1: "bessere Simulation veränderter Frequenzanpassung",
    supportFuturePlan2: "Unterstützung weiterer Sprachen",
    supportFuturePlan3: "umfangreichere Audiobibliothek (mehr Sätze, Hörbücher, Musik)",
    supportFuturePlan4: "verbesserte Testverfahren",
    supportFutureConsider: "In Erwägung:",
    supportFutureConsider1: "Hör-Trainingsbereich",
    supportFutureConsider2: "Tinnitus-Analyse mit Maskierungs- und Notch-Tönen",

    supportGithubHint: "Wer mehr über den Stand erfahren oder Funktionen vorschlagen möchte, ist auf <a href=\"https://github.com/mviereck/ci-sound-balancing/issues\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub-Issues</a> willkommen.",

    supportSlogan: "Bitte nutzen Sie dieses Tool, um die Welt für alle Menschen besser zu machen.",

    supportIbanTitle: "Bankverbindung",
    supportIbanName: "Empfänger",
    supportIbanBank: "Bank",
    supportIbanBetreff: "Verwendungszweck",
    supportQrLabel: "Überweisungsvorlage als QR-Code für Banking-Apps:",

    supportMailTitle: "Kontakt-E-Mail",
    supportMailIntro: "Für Rückfragen, Hinweise oder Diskussion:",
```

### `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`

**Nicht anfassen.** Diese Bauanleitung legt **nur** die deutschen
Strings an. Die anderen drei Sprachen werden in einer eigenen Mini-
Anleitung nachgezogen, sobald die deutschen GUI-Texte feststehen
(siehe `docs/BAUANLEITUNGEN_LEITLINIEN.md`, Abschnitt „i18n /
Übersetzungen — nur Deutsch in Bauanleitungen").

Im Tool ist während dieser Phase Folgendes zu erwarten:

- Wenn die UI-Sprache auf EN/FR/ES steht, erscheinen die neuen Texte
  im Unterstützung-Tab auf **Deutsch** (Fallback aus `i18n/de.js`,
  Verhalten von `js/i18n.js`).
- Das ist gewollt; in der Akzeptanz-Checkliste unten ist nur der
  deutsche Tab zu prüfen (Test G entfällt für EN/FR/ES).

## Stelle 9 — CSS für die neuen Klassen

In `style.css` am Ende anhängen:

```css
/* ===== Unterstützung-Tab ===== */

.support-card-call h2 {
  margin-top: 0;
}

.support-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0 10px;
}

.support-zweck {
  font-size: 0.88em;
  color: var(--text-muted);
  margin-top: 8px;
}

.support-finance-table {
  width: 100%;
  border-collapse: collapse;
  margin: 14px 0 10px;
}
.support-finance-table th,
.support-finance-table td {
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
.support-finance-table th.num,
.support-finance-table td.num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.support-finance-table tfoot tr.sum td {
  font-weight: 700;
  border-top: 2px solid var(--text);
}
.support-finance-table tfoot td {
  background: var(--surface-alt, rgba(0,0,0,0.03));
}

.support-gap-hints {
  margin: 12px 0 18px;
  padding: 10px 14px;
  background: var(--surface-alt, rgba(0,0,0,0.04));
  border-left: 4px solid var(--accent, #d97700);
  border-radius: 0 4px 4px 0;
}
.support-gap-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  font-size: 0.95em;
}
.support-gap-emph {
  margin-top: 4px;
  font-size: 1.05em;
  font-weight: 700;
}
.support-gap-row strong {
  font-variant-numeric: tabular-nums;
}

.support-card-slogan {
  text-align: center;
}
.support-slogan {
  font-style: italic;
  font-size: 1.05em;
  color: var(--text-muted);
  margin: 0;
}

.support-iban-list {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  margin: 0 0 14px;
}
.support-iban-list dt {
  font-weight: 600;
}
.support-iban-list dd {
  margin: 0;
}
.support-iban-list .mono {
  font-family: var(--mono, monospace);
}
.support-iban-qr {
  display: block;
  max-width: 240px;
  width: 100%;
  height: auto;
  margin: 6px 0 0;
}
.support-iban-qr-label {
  font-size: 0.9em;
  color: var(--text-muted);
  margin: 8px 0 4px;
}

.support-mail-addr {
  display: inline-block;
  margin-top: 8px;
  font-family: var(--mono, monospace);
  font-size: 1.05em;
}
```

**Hinweis zu CSS-Variablen:** `--accent`, `--surface-alt`, `--text`,
`--text-muted`, `--border`, `--mono` werden in `style.css` weiter
oben definiert. Falls einzelne davon (etwa `--surface-alt`) fehlen,
greifen die Fallbacks. Falls die Akzentfarbe im Projekt anders heißt
(z. B. `--brand`): in `style.css` ganz oben nachsehen und das eine
`var(--accent, #d97700)` in `.support-gap-hints` entsprechend
anpassen. Im Zweifel: Fallback-Farbwert lassen.

## Stelle 10 — Tab-Sperre während Tests

Der neue Tab muß während laufender Tests gesperrt werden, wie alle
anderen Top-Level-Tabs. In `js/tabs-eq.js` die Funktion
`updateTabLockState` (oder das Modul `lockTestTabs` in `test-ui.js`)
prüfen — wenn die Sperre per Selektor `button.tab` greift, ist der
neue Button automatisch dabei und nichts zu tun. Falls die Sperre
eine **explizite Liste** von Tab-IDs führt, dort `tabUnterstuetzung`
ergänzen.

Quick-Check: nach Bauabschluß einen Test in „Messungen" starten und
prüfen, ob der Unterstützung-Tab-Button ausgegraut wird wie die
anderen.

## Akzeptanztest-Checkliste (manuell im Browser)

### Test A — Tab erscheint und öffnet sich

1. Hard-Reload (`Ctrl+Shift+R`).
2. Tab-Leiste oben: nach „Laden/Speichern" steht ein neuer Tab
   „Unterstützung" (DE) bzw. „Support" / „Soutien" / „Apoyo" je
   nach Sprache.
3. Auf den Tab klicken → Panel öffnet sich.

### Test B — Karte 1 (Aufruf) zeigt korrekten Text

1. Überschrift „Unterstützer für die Weiterentwicklung gesucht".
2. Zwei Absätze Intro-Text wie in `supportIntro1` / `supportIntro2`.
3. Zwei Buttons: „Bankverbindung anzeigen" und „Kontakt-E-Mail
   anzeigen".
4. Unter den Buttons der Hinweis zum Verwendungszweck.

### Test C — Dialog Bankverbindung

1. Auf „Bankverbindung anzeigen" klicken → Dialog öffnet sich.
2. Im Dialog sichtbar:
   - Empfänger: Martin Viereck
   - IBAN: DE69 4306 0967 3177 7576 00 (monospace)
   - BIC: GENODEM1GLS
   - Bank: GLS Bank Bochum
   - Verwendungszweck: „Zweckbindung: Kostendeckung CI-Tool-Entwicklung"
   - QR-Code-Bild (banking.png) sichtbar, max. ca. 240 px breit.
3. Schließen-Button schließt den Dialog.
4. Im **HTML-Quelltext der Seite** (Strg+U) **vor dem ersten Klick**
   auf den Bankverbindung-Button: weder „DE69" noch „GENODEM1GLS"
   noch „mviereck" steht im Klartext.

### Test D — Dialog Kontakt-E-Mail

1. Auf „Kontakt-E-Mail anzeigen" klicken → Dialog öffnet sich.
2. Adresse `mviereck@ci-sound-balancing.org` als `mailto:`-Link.
3. Schließen-Button schließt den Dialog.
4. Wie Test C: Adresse erscheint **nicht** im HTML-Quelltext, bevor
   der Dialog geöffnet wurde.

### Test E — Karte 3 (Offenlegung) zeigt korrekte Zahlen

1. Tabelle mit drei Spalten: Posten | Vollausbau | Aktueller Stand.
2. Einzelposten:
   - KI Claude: 107,20 € | 44,00 €
   - Virtueller Server: 5,34 € | –
   - Webspace: 3,81 € | 5,00 €
   - Domain: 1,78 € | –
3. Summen-Zeile (fett, mit Trennlinie darüber):
   - Bedarf gesamt: 118,13 € | 49,00 €
4. Weiter:
   - Durch Spenden gedeckt: – | 25,00 €
   - Aus eigener Tasche: – | 24,00 €
5. Unterhalb der Tabelle hervorgehoben:
   - Differenz Stand → Vollausbau: 69,13 €
   - Zusätzlich nötige Spenden für Vollausbau: **93,13 €** (fett)
6. Erklärtext zur KI-Position.
7. Liste „Geplant…" mit vier Punkten.
8. Liste „In Erwägung…" mit zwei Punkten (inkl. Tinnitus).
9. GitHub-Hinweis mit funktionierendem Link.

### Test F — Slogan in deutscher Sprache

1. Sprache auf DE: „Bitte nutzen Sie dieses Tool, um die Welt für
   alle Menschen besser zu machen."
2. (EN/FR/ES kommen mit der späteren Übersetzungs-Anleitung. In
   diesen Sprachen erscheint der Slogan als deutscher Fallback —
   das ist während dieser Phase gewollt.)

### Test G — Sprachwechsel-Fallback funktioniert

1. Sprache auf EN umschalten → Tab heißt weiterhin „Unterstützung"
   (deutscher Fallback), die anderen Texte ebenfalls auf Deutsch.
   **Kein** Fehler in der Konsole, **kein** leerer Text.
2. Zurück auf DE → bleibt deutsch.
3. Andere Tabs (z. B. Implantat, Player), die in EN bereits
   übersetzt sind, zeigen weiterhin korrekt englisch — nur die neu
   eingeführten `support*`-Keys fallen zurück.

### Test H — Tab-Sperre während Test

1. „Messungen" → einen Test starten.
2. Alle anderen Tab-Buttons inkl. „Unterstützung" sind ausgegraut
   und nicht klickbar.
3. Test abbrechen → Tabs wieder klickbar.

### Test I — Tool sonst unverändert

1. Alle anderen Tabs öffnen — keine Veränderung.
2. Browser-Konsole: keine `ReferenceError`, kein 404 auf
   `banking.png` oder die neuen JS-Dateien.
3. Eine Messung kurz starten, einen Tonpaar-Klick — Audio läuft.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung jede Akzeptanz-Kriterie A–I einzeln
durchgehen und für jede melden: **erfüllt / nicht erfüllt / unklar**,
mit Datei- und Zeilenangabe.

Insbesondere prüfen:

- Heißt die i18n-Apply-Funktion tatsächlich `applyLang()`? Falls
  nein: alle vier Vorkommen in `js/unterstuetzung.js` an den
  echten Namen anpassen. Suche: `grep -nE "function applyLang|function applyI18n|function _applyTrans" js/i18n.js`.
- Sind die Summen in der Tabelle **tatsächlich** über `finBerechne()`
  berechnet, oder steht irgendwo eine hartkodierte Zahl? Nur die
  Einzelposten in `FINANZEN.posten` und `donationsMonthly` dürfen
  hartkodiert sein.
- Werden IBAN, BIC und E-Mail wirklich erst beim Öffnen des Dialogs
  zusammengesetzt? Stichprobe: vor dem Klick `view-source:` im
  Browser oder `grep -E "DE69|GENODEM1GLS|mviereck" index.html` —
  darf keinen Treffer geben (außer einem Hinweis-Kommentar).
- **Wurden nur deutsche i18n-Strings angelegt?** Die Bauanleitungs-
  Leitlinien geben vor: EN/FR/ES kommen später in eigener Anleitung,
  nicht hier. Stichprobe:
  ```bash
  grep -c "support[A-Za-z_]*:" i18n/de.js
  grep -c "support[A-Za-z_]*:" i18n/en.js
  grep -c "support[A-Za-z_]*:" i18n/fr.js
  grep -c "support[A-Za-z_]*:" i18n/es.js
  ```
  In `de.js` muß der Wert > 0 sein (die neuen Keys). In `en.js`,
  `fr.js`, `es.js` müssen die `support`-Keys **0** ergeben — diese
  Dateien dürfen für diese Anleitung **nicht** verändert worden sein.
- Fällt die Anzeige in EN/FR/ES auf den deutschen Text zurück und
  nicht auf leere Strings oder `[support…]`-Platzhalter? Falls
  ja: i18n-Fallback-Verhalten in `js/i18n.js` prüfen, ggf.
  Rückfrage.
- Wird der Tab beim Klick auf „Unterstützung" tatsächlich aktiviert?
  Das Panel braucht `id="panel-unterstuetzung"` und die Tab-Logik
  in `tabs-eq.js` matched auf `data-tab="unterstuetzung"` → muß zur
  Panel-ID passen (Konvention im Projekt prüfen, falls Sub-Mismatch:
  Rückfrage).
- Funktioniert die Tab-Sperre? Wenn nicht, in `js/test-ui.js`
  `lockTestTabs` nachsehen, ob dort eine explizite Tab-Liste
  geführt wird, und ergänzen.
- Gibt es im neuen Code irgendwo einen `console.log` oder
  Debug-Rest? Vor Abgabe entfernen.

Bei Unklarheit Rückfrage statt Annahme.

## Nach Abschluß manuell prüfen

- Tab „Unterstützung" sichtbar und befüllt.
- Beide Dialoge öffnen sich, Inhalt korrekt, Schließen funktioniert.
- Tabelle zeigt die richtigen Zahlen, Summen passen.
- Sprachwechsel funktioniert für alle Texte im Tab.
- Tool startet ohne Konsolen-Fehler, andere Tabs unverändert.

**Hinweis:** Die Intro-Box mit Verweis auf diesen Tab und die
Doku-Updates kommen in **Bauanleitung 60**.

**Übersetzungen für en/fr/es** kommen in einer eigenen Mini-
Anleitung, sobald die deutschen Texte aus BA 59 und BA 60 im
Browser geprüft und ggf. nachgebessert sind. Solange erscheinen die
neuen Texte in den anderen Sprachen als deutscher Fallback.
