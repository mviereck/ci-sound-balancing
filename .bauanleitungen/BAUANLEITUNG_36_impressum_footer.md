# Bauanleitung 36: Footer, Impressum und Lizenz

Footer am Seitenende mit drei Links: **Impressum**, **MIT-Lizenz**,
**GitHub**. Beide Modals öffnen sich als HTML5 `<dialog>`. Impressum-
Inhalt ist statisch (deutsch). Lizenz-Modal lädt den Lizenztext per
`fetch` aus dem Repo nach (Fallback-Link bei Offline-Modus).

## Inhalt des Impressums (final, in Bauanleitung verankert)

Diese Angaben werden im Modal angezeigt:

- **Anbieter (privates, nichtkommerzielles Open-Source-Projekt)**
  Martin Viereck
  Schützeberger Hof 2
  34466 Wolfhagen

- **Kontakt**
  E-Mail: bachbaum24@gmx.de (im DOM nicht im Klartext — siehe
  Schritt 3, JS-Aufbau)
  Fehlermeldungen und Diskussion: https://github.com/mviereck/ci-sound-balancing/issues

- **Haftungsausschluß**
  Dieses Tool ist kein Medizinprodukt und ersetzt keine
  audiologische Beratung. Empfehlungen sind als Diskussionsgrundlage
  für das Gespräch mit dem Audiologen gedacht. Für Schäden, die aus
  der Anwendung der Korrekturen entstehen, wird keine Haftung
  übernommen.

- **Datenschutz**
  Das Tool verarbeitet keine personenbezogenen Daten auf einem
  Server. Alle Eingaben verbleiben lokal im Browser
  (`localStorage` / `sessionStorage`) bzw. werden ausschließlich
  vom Nutzer selbst per Datei-Download gesichert. Das Tool wird über
  GitHub Pages bereitgestellt; dort fallen serverseitige Zugriffs-
  Logs (u.a. IP-Adresse) beim Hoster GitHub Inc. an. Details siehe
  GitHub-Datenschutzerklärung.

- **Lizenz und Quellcode**
  Veröffentlicht unter der MIT-Lizenz. Quellcode:
  https://github.com/mviereck/ci-sound-balancing

## Schritt 1 — Footer-HTML in `index.html`

Direkt **vor** dem schließenden `</div>` des `.container`
(typischerweise ganz am Ende des Body-Inhalts, nach allen Panels),
folgenden Block einfügen:

```html
      <footer class="app-footer">
        <span class="footer-version" id="footerVersion"></span>
        <span class="footer-sep">·</span>
        <a href="#" id="footerImprintLink" data-t="footerImprint"></a>
        <span class="footer-sep">·</span>
        <a href="#" id="footerLicenseLink" data-t="footerLicense"></a>
        <span class="footer-sep">·</span>
        <a href="https://github.com/mviereck/ci-sound-balancing"
           target="_blank" rel="noopener noreferrer">GitHub</a>
      </footer>

      <dialog id="imprintDialog" class="legal-dialog">
        <div class="legal-dialog-inner">
          <div class="legal-dialog-head">
            <h2 data-t="footerImprint"></h2>
            <button type="button" class="legal-close" data-close="imprintDialog" data-t="legalClose"></button>
          </div>
          <div class="legal-dialog-body" id="imprintBody">
            <!-- Wird in legal.js befüllt -->
          </div>
        </div>
      </dialog>

      <dialog id="licenseDialog" class="legal-dialog">
        <div class="legal-dialog-inner">
          <div class="legal-dialog-head">
            <h2 data-t="footerLicense"></h2>
            <button type="button" class="legal-close" data-close="licenseDialog" data-t="legalClose"></button>
          </div>
          <div class="legal-dialog-body" id="licenseBody">
            <p data-t="legalLoading"></p>
          </div>
        </div>
      </dialog>
```

Hinweise:
- Footer steht **außerhalb** der `.panel`-Container, damit er auf
  jedem Tab sichtbar bleibt.
- Die beiden `<dialog>`-Elemente werden modal aufgerufen
  (`showModal()`); HTML5-Dialog regelt Backdrop, ESC-Close und
  Fokus-Trap automatisch.
- Versionslabel: nutzt eine eigene Span (`#footerVersion`), wird in
  Schritt 4 vom DOMContentLoaded-Handler aus `APP_VERSION` befüllt.

## Schritt 2 — Neues Modul `legal.js`

Neue Datei `legal.js` im Repo-Root:

```javascript
// legal.js – Footer-Modals (Impressum, Lizenz) und E-Mail-Aufbau.

var _LICENSE_RAW_URL =
  "https://raw.githubusercontent.com/mviereck/ci-sound-balancing/main/LICENSE";
var _LICENSE_HTML_URL =
  "https://github.com/mviereck/ci-sound-balancing/blob/main/LICENSE";

function _legalBuildImprintBody() {
  // Statischer deutscher Inhalt, gemäß Bauanleitung 36.
  var html =
    '<p><strong>Anbieter (privates, nichtkommerzielles Open-Source-Projekt)</strong><br>' +
    'Martin Viereck<br>' +
    'Schützeberger Hof 2<br>' +
    '34466 Wolfhagen</p>' +

    '<p><strong>Kontakt</strong><br>' +
    'E-Mail: <span id="imprintEmail">(JavaScript erforderlich)</span><br>' +
    'Fehlermeldungen und Diskussion: ' +
    '<a href="https://github.com/mviereck/ci-sound-balancing/issues" target="_blank" rel="noopener noreferrer">' +
    'GitHub-Issues</a></p>' +

    '<p><strong>Haftungsausschluß</strong><br>' +
    'Dieses Tool ist kein Medizinprodukt und ersetzt keine audiologische ' +
    'Beratung. Empfehlungen sind als Diskussionsgrundlage für das Gespräch ' +
    'mit dem Audiologen gedacht. Für Schäden, die aus der Anwendung der ' +
    'Korrekturen entstehen, wird keine Haftung übernommen.</p>' +

    '<p><strong>Datenschutz</strong><br>' +
    'Das Tool verarbeitet keine personenbezogenen Daten auf einem Server. ' +
    'Alle Eingaben verbleiben lokal im Browser (localStorage / sessionStorage) ' +
    'bzw. werden ausschließlich vom Nutzer selbst per Datei-Download ' +
    'gesichert. Das Tool wird über GitHub Pages bereitgestellt; dort fallen ' +
    'serverseitige Zugriffs-Logs (u.a. IP-Adresse) beim Hoster GitHub Inc. ' +
    'an. Details siehe ' +
    '<a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">' +
    'GitHub-Datenschutzerklärung</a>.</p>' +

    '<p><strong>Lizenz und Quellcode</strong><br>' +
    'Veröffentlicht unter der MIT-Lizenz. Quellcode: ' +
    '<a href="https://github.com/mviereck/ci-sound-balancing" target="_blank" rel="noopener noreferrer">' +
    'github.com/mviereck/ci-sound-balancing</a></p>';
  return html;
}

function _legalAssembleEmail() {
  // E-Mail wird im DOM nicht im Klartext gehalten, sondern beim
  // Öffnen des Modals zusammengebaut.
  var el = document.getElementById("imprintEmail");
  if (!el) return;
  var user = "bachbaum24";
  var domain = "gmx.de";
  var addr = user + "@" + domain;
  el.innerHTML = "";
  var a = document.createElement("a");
  a.href = "mailto:" + addr;
  a.textContent = addr;
  el.appendChild(a);
}

function _legalOpenImprint() {
  var dlg = document.getElementById("imprintDialog");
  var body = document.getElementById("imprintBody");
  if (!dlg || !body) return;
  body.innerHTML = _legalBuildImprintBody();
  _legalAssembleEmail();
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
}

function _legalRenderLicense(text) {
  var body = document.getElementById("licenseBody");
  if (!body) return;
  body.innerHTML = "";
  var pre = document.createElement("pre");
  pre.className = "legal-license-text";
  pre.textContent = text;
  body.appendChild(pre);
}

function _legalRenderLicenseError() {
  var body = document.getElementById("licenseBody");
  if (!body) return;
  body.innerHTML = "";
  var p = document.createElement("p");
  p.textContent = (typeof t === "function" ? t("legalLicenseError")
    : "Lizenztext konnte nicht geladen werden.") + " ";
  var a = document.createElement("a");
  a.href = _LICENSE_HTML_URL;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = (typeof t === "function" ? t("legalLicenseFallbackLink")
    : "Lizenztext im Repository öffnen");
  p.appendChild(a);
  body.appendChild(p);
}

function _legalOpenLicense() {
  var dlg = document.getElementById("licenseDialog");
  var body = document.getElementById("licenseBody");
  if (!dlg || !body) return;
  // Loading-Hinweis
  body.innerHTML = "";
  var loading = document.createElement("p");
  loading.textContent = (typeof t === "function" ? t("legalLoading")
    : "Lade Lizenztext …");
  body.appendChild(loading);

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");

  // fetch versuchen; bei Fehler Fallback-Link.
  try {
    fetch(_LICENSE_RAW_URL, { cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (txt) { _legalRenderLicense(txt); })
      .catch(function () { _legalRenderLicenseError(); });
  } catch (e) {
    _legalRenderLicenseError();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Footer-Version befüllen.
  var ver = document.getElementById("footerVersion");
  if (ver && typeof APP_VERSION === "string") {
    ver.textContent = "Version " + APP_VERSION;
  }
  // Footer-Links.
  var imL = document.getElementById("footerImprintLink");
  if (imL) imL.addEventListener("click", function (e) {
    e.preventDefault();
    _legalOpenImprint();
  });
  var liL = document.getElementById("footerLicenseLink");
  if (liL) liL.addEventListener("click", function (e) {
    e.preventDefault();
    _legalOpenLicense();
  });
  // Close-Buttons.
  document.querySelectorAll(".legal-close").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var id = btn.getAttribute("data-close");
      var dlg = document.getElementById(id);
      if (!dlg) return;
      if (typeof dlg.close === "function") dlg.close();
      else dlg.removeAttribute("open");
    });
  });
});
```

Im Loader-Array von `index.html` Z. 26 ff. `'legal.js'` am Ende
ergänzen (nach `'init.js'`):

**Vorher**:
```javascript
var scripts = [
  ...
  'lr-balance.js', 'latency.js', 'sentences.js', 'init.js'
];
```

**Nachher**:
```javascript
var scripts = [
  ...
  'lr-balance.js', 'latency.js', 'sentences.js', 'init.js', 'legal.js'
];
```

Reihenfolge `nach init.js` ist sinnvoll: legal.js hat seinen eigenen
`DOMContentLoaded`-Handler und braucht `APP_VERSION` (verfügbar) sowie
optional `t()` (verfügbar). Keine Module hängen umgekehrt von legal.js
ab.

## Schritt 3 — i18n-Schlüssel in `i18n.js`

Pro Sprache (DE/EN/FR/ES) folgende Keys ergänzen. Stelle: im L-Objekt
neben den anderen Strings, gerne am Ende des jeweiligen Sprach-Blocks.

**DE**:
```javascript
footerImprint: "Impressum",
footerLicense: "MIT-Lizenz",
legalClose: "Schließen",
legalLoading: "Lade Lizenztext …",
legalLicenseError: "Lizenztext konnte nicht geladen werden.",
legalLicenseFallbackLink: "Lizenztext im Repository öffnen",
```

**EN**:
```javascript
footerImprint: "Imprint",
footerLicense: "MIT License",
legalClose: "Close",
legalLoading: "Loading license text …",
legalLicenseError: "License text could not be loaded.",
legalLicenseFallbackLink: "Open license text in repository",
```

**FR**:
```javascript
footerImprint: "Mentions légales",
footerLicense: "Licence MIT",
legalClose: "Fermer",
legalLoading: "Chargement du texte de licence …",
legalLicenseError: "Le texte de la licence n'a pas pu être chargé.",
legalLicenseFallbackLink: "Ouvrir le texte de la licence dans le dépôt",
```

**ES**:
```javascript
footerImprint: "Aviso legal",
footerLicense: "Licencia MIT",
legalClose: "Cerrar",
legalLoading: "Cargando texto de licencia …",
legalLicenseError: "No se ha podido cargar el texto de la licencia.",
legalLicenseFallbackLink: "Abrir texto de licencia en el repositorio",
```

**Hinweis Modal-Inhalt**: Der Impressums-Text selbst bleibt fest auf
Deutsch (rechtliche Pflicht aus deutschem Recht; nicht übersetzt).
Der Modal-Titel wird über `data-t="footerImprint"` von `applyLang()`
in der UI-Sprache gesetzt — leichte Inkonsistenz (englischer Titel
"Imprint" über deutschem Inhalt) ist akzeptiert.

## Schritt 4 — CSS in `style.css`

Am Ende von `style.css` (oder vor der Mobile-Media-Query, beides
geht) folgenden Block einfügen:

```css
.app-footer {
  margin-top: 32px;
  padding: 16px 0 24px;
  text-align: center;
  font-size: 0.82em;
  color: var(--text-muted);
  border-top: 1px solid var(--border);
}
.app-footer a {
  color: var(--text-muted);
  text-decoration: none;
}
.app-footer a:hover {
  color: var(--accent);
  text-decoration: underline;
}
.footer-sep {
  margin: 0 8px;
  color: var(--border);
}
.footer-version {
  font-family: var(--mono);
  font-size: 0.92em;
}

.legal-dialog {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0;
  max-width: 600px;
  width: calc(100% - 32px);
  background: var(--surface);
  color: var(--text);
}
.legal-dialog::backdrop {
  background: rgba(0, 0, 0, 0.35);
}
.legal-dialog-inner {
  padding: 20px;
}
.legal-dialog-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 10px;
}
.legal-dialog-head h2 {
  margin: 0;
  font-size: 1.05em;
  font-weight: 600;
}
.legal-close {
  min-height: 36px;
  padding: 4px 14px;
  font-size: 0.95em;
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-family: var(--font);
}
.legal-close:hover {
  background: var(--accent-light);
}
.legal-dialog-body {
  font-size: 0.92em;
  line-height: 1.5;
}
.legal-dialog-body p {
  margin-bottom: 12px;
}
.legal-license-text {
  font-family: var(--mono);
  font-size: 0.82em;
  white-space: pre-wrap;
  background: var(--bg);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  max-height: 50vh;
  overflow-y: auto;
}
@media (max-width: 768px) {
  .app-footer {
    font-size: 0.78em;
  }
  .footer-sep {
    margin: 0 5px;
  }
  .app-footer .footer-version {
    display: block;
    margin-bottom: 4px;
  }
  .app-footer .footer-version + .footer-sep {
    display: none;
  }
}
```

Auf Mobile rutscht die Versions-Anzeige in eine eigene Zeile (der
erste `·`-Separator wird unterdrückt), und die übrigen drei Links
bleiben in einer Reihe. Bei sehr schmalen Viewports umbricht der
Browser ohnehin von selbst.

## Schritt 5 — `CODESTRUKTUR.md` aktualisieren

Neue Modul-Tabellen-Zeile am Ende der Tabelle (Position 19 oder
analog nach init.js):

```
| 19 | legal.js | Footer-Modals: `_legalOpenImprint`, `_legalOpenLicense`. Impressum-Inhalt statisch in `_legalBuildImprintBody` (deutsch, gemäß § 5 DDG). E-Mail wird via `_legalAssembleEmail` erst beim Öffnen aus zwei Bestandteilen zusammengesetzt (Spam-Schutz). MIT-Lizenz lädt per `fetch` von raw.githubusercontent.com mit Fallback-Link bei Netzwerk- oder CORS-Fehler. Eigener DOMContentLoaded-Handler verdrahtet die drei Footer-Links und Close-Buttons. Konstanten `_LICENSE_RAW_URL`, `_LICENSE_HTML_URL`. |
```

Im Datenfluss-Block einen neuen Absatz:

```
**Footer und Impressum:** Footer am Ende des `.container` (außerhalb
aller `.panel`-Container), enthält Versions-Anzeige, Impressum-Link,
MIT-Lizenz-Link und GitHub-Link. Zwei `<dialog>`-Elemente
(`#imprintDialog`, `#licenseDialog`) werden über `legal.js`
verwaltet. Impressum-Inhalt deutsch und statisch; MIT-Lizenz wird
beim Öffnen aus dem Repo nachgeladen.
```

## Schritt 6 — `SPEC.md` aktualisieren

Im Abschnitt „Tab-Übersicht" ergänzen, **nach** der letzten
Tab-Beschreibung:

```
- **Footer** — am Seitenende, immer sichtbar. Enthält Versions-Tag,
  Impressum, MIT-Lizenz, GitHub-Link. Impressum-Inhalt fix deutsch
  (rechtliche Pflicht); Footer-Labels in allen vier UI-Sprachen.
```

## Schritt 7 — `.gitignore` und Datenschutz-Check

Vor dem ersten Commit nochmal sicherstellen:

- Repo enthält bereits eine `LICENSE`-Datei mit MIT-Text (anderenfalls
  würde der fetch ins Leere laufen). Falls nicht vorhanden, MIT-Text
  von https://opensource.org/license/mit als `LICENSE` ablegen.
- Branch-Name `main` ist im Repo aktiv (sonst `_LICENSE_RAW_URL`
  anpassen).
- Keine privaten Daten anderer Art (E-Mail-Adressen Dritter, Audio-
  Aufnahmen mit Personenbezug) sind im Repo.

## Akzeptanztest-Checkliste

1. **Footer sichtbar**
   - App laden. Am Ende der Seite erscheint ein Footer mit
     `Version X.Y · Impressum · MIT-Lizenz · GitHub`.
   - Footer ist auf jedem Tab (Einführung, Implantat, Messungen,
     Player, …) sichtbar.

2. **Impressum öffnet**
   - Klick auf „Impressum" → Modal öffnet sich (Backdrop dunkel).
   - Inhalt: Name, Anschrift, E-Mail (als anklickbarer mailto-Link),
     GitHub-Issues-Link, Haftungsausschluß, Datenschutz, Lizenz-
     Verweis. Alles auf Deutsch.
   - E-Mail-Link funktioniert (`mailto:bachbaum24@gmx.de` öffnet
     Mail-Client).
   - Schließen-Button schließt das Modal. ESC schließt ebenfalls.

3. **E-Mail crawler-sicher**
   - Im Quelltext-Viewer (Strg+U) ist die Adresse `bachbaum24@gmx.de`
     **nicht** im Klartext zu finden — sie wird erst beim Öffnen
     des Modals zusammengesetzt.
   - Bei deaktiviertem JavaScript sieht der Nutzer nur den Text
     „(JavaScript erforderlich)".

4. **Lizenz öffnet und lädt**
   - Online: Klick auf „MIT-Lizenz" → Modal zeigt zunächst
     „Lade Lizenztext …", dann den MIT-Lizenztext in einem
     Monospace-Block.
   - Offline (file://): Modal zeigt Fehler + Link „Lizenztext im
     Repository öffnen". Link führt zum LICENSE-File auf GitHub.

5. **Mehrsprachigkeit**
   - UI-Sprache auf Englisch: Footer-Links heißen „Imprint",
     „MIT License", „GitHub". Modal-Inhalte bleiben **deutsch**, nur
     Titel und Schließen-Button sind in der UI-Sprache.
   - Analog für FR und ES.

6. **Mobile (iPhone 12 Pro Emulation)**
   - Footer rendert lesbar; Versions-Anzeige in eigener Zeile, drei
     Links darunter.
   - Modals füllen den Bildschirm sinnvoll aus (max. 600 px breit,
     `calc(100% - 32px)` bei schmalem Viewport).

7. **Tastatur-Navigation**
   - Tab-Taste fokussiert die Footer-Links in der Reihenfolge.
   - Enter/Leertaste auf einem Link öffnet das jeweilige Modal.
   - `<dialog>`-Element bringt Fokus-Trap automatisch; Tab innerhalb
     des Modals bewegt sich zwischen Schließen-Button und Links.

8. **Regression**
   - Andere Funktionen (Side-Wechsel, Sprachumschaltung, Tests,
     Player) unberührt.

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertig-Meldung: jede Akzeptanz-Kriterie einzeln durchgehen
und **erfüllt / nicht erfüllt / unklar** mit Datei- und Zeilenangabe
melden. Bei „unklar" stoppen und nachfragen.

Zusätzlich kritisch prüfen:

- **`<dialog>`-Polyfill?** Aktuelle Chrome/Firefox/Safari (ab 15.4)
  unterstützen `<dialog>` nativ. Falls Zielgruppe auch ältere
  Browser nutzt: Hinweis im Selbstcheck, aber kein Polyfill einbauen
  ohne Rücksprache.
- **E-Mail-Schutz**: Im finalen DOM (nach Modal-Open) steht die
  Adresse vollständig im DOM-Baum. Crawler, die JavaScript ausführen
  und den Klick auf Footer-Links simulieren, kommen dran. Der
  Schutzgrad ist „mittel" — gegen primitive Adress-Sammler wirksam,
  gegen Headless-Browser nicht. Akzeptiert.
- **Branch-Name `main`**: bestätigen, daß im Repo tatsächlich `main`
  der Default-Branch ist. Falls `master`: `_LICENSE_RAW_URL` und
  `_LICENSE_HTML_URL` entsprechend anpassen.
- **LICENSE-Datei existiert** im Repo-Root mit gültigem MIT-Text.
  Wenn nicht: vor dem Commit anlegen.
- **i18n-Keys** in allen vier Sprachen ergänzt (DE/EN/FR/ES); kein
  Schlüssel vergessen.
- **CODESTRUKTUR.md** + **SPEC.md** im selben Arbeitsschritt
  aktualisiert.
- **Hot reload**: Wenn der User über die `<select id="langSelect">`-
  Sprache wechselt, werden die Footer-Labels automatisch von
  `applyLang()` aktualisiert (alle `[data-t]`-Elemente). Modal-Titel
  ebenso, da `[data-t="footerImprint"]`. Kein zusätzlicher Refresh
  nötig.
