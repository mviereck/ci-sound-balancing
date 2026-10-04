// legal.js – Footer-Modals (Impressum, Lizenz) und E-Mail-Aufbau.

var _LICENSE_RAW_URL =
  "https://raw.githubusercontent.com/mviereck/ci-sound-balancing/main/LICENSE";
var _LICENSE_HTML_URL =
  "https://github.com/mviereck/ci-sound-balancing/blob/main/LICENSE";

function _legalBuildImprintBody() {
  var html =
    '<p><strong>Anbieter (privates Open-Source-Projekt)</strong><br>' +
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
    'Das Tool selbst verarbeitet keine personenbezogenen Daten auf einem ' +
    'eigenen Anwendungs-Server. Alle Eingaben verbleiben lokal im Browser ' +
    '(localStorage / sessionStorage) bzw. werden ausschließlich vom Nutzer ' +
    'selbst per Datei-Download gesichert.</p>' +

    '<p><strong>Hosting und Zugriffs-Logs</strong><br>' +
    'Die Anwendung wird über ' +
    'GitHub Pages (GitHub Inc., USA) bereitgestellt; die Audio-Dateien liegen ' +
    'überwiegend auf einem eigenen Webspace bei der Strato AG (Deutschland). ' +
    'Beim Abruf fallen dort serverseitige Zugriffs-Logs (u.a. IP-Adresse) an. ' +
    'Details zu GitHub siehe ' +
    '<a href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement" target="_blank" rel="noopener noreferrer">' +
    'GitHub-Datenschutzerklärung</a>, zu Strato siehe ' +
    '<a href="https://www.strato.de/datenschutz/" target="_blank" rel="noopener noreferrer">' +
    'Strato-Datenschutz</a>.</p>' +

    '<p><strong>Einbindung externer Inhalte</strong><br>' +
    'Zum Abspielen von ' +
    'Audioinhalten und zum Anzeigen von Begleittexten lädt der Browser auf ' +
    'aktive Nutzeraktion hin Inhalte direkt von den jeweiligen Quell-Servern. ' +
    'Dabei wird die IP-Adresse des Nutzers an den jeweiligen Anbieter ' +
    'übertragen. Je nach gewähltem Inhalt sind das insbesondere: Wikimedia ' +
    '(upload.wikimedia.org sowie die Wikipedia-APIs *.wikipedia.org für ' +
    'gesprochene Wikipedia-Texte), das Internet Archive (archive.org, auch ' +
    'für LibriVox), GitHub (raw.githubusercontent.com) und Freesound ' +
    '(cdn.freesound.org, Server in der EU). Die Server von Wikimedia, ' +
    'Internet Archive und ' +
    'GitHub stehen in den USA (Drittland); die Übertragung erfolgt, weil sie ' +
    'für die vom Nutzer angeforderte Wiedergabe des jeweiligen Inhalts ' +
    'erforderlich ist. Es findet kein automatisches Laden externer Inhalte ' +
    'allein durch den Seitenaufruf statt.</p>' +

    '<p><strong>Lizenz und Quellcode</strong><br>' +
    'Der Quellcode ist veröffentlicht unter der ' +
    '<a href="https://www.gnu.org/licenses/old-licenses/gpl-2.0.html" target="_blank" rel="noopener noreferrer">' +
    'GNU General Public License v2 oder neuer (GPL-2.0-or-later)</a>. ' +
    'Quellcode: ' +
    '<a href="https://github.com/mviereck/ci-sound-balancing" target="_blank" rel="noopener noreferrer">' +
    'github.com/mviereck/ci-sound-balancing</a>.<br>' +
    'Die abspielbaren Audioinhalte unterliegen jeweils eigenen Lizenzen der ' +
    'jeweiligen Urheber, die bei Abruf des Inhalts angezeigt werden.</p>' +

    '<p><strong>Lizenz in Kurzform</strong> (unverbindliche Orientierung; ' +
    'maßgeblich ist der Lizenztext)<br>' +
    'Die Software darf von jedem, auch beruflich und kommerziell, frei ' +
    'genutzt, weitergegeben und verändert werden. Für die bloße Nutzung ' +
    '(z. B. Einsatz in der Praxis, Vorführen für Patienten) entstehen ' +
    'keinerlei Pflichten.<br>' +
    'Wer die Software weitergibt oder in veränderter Form veröffentlicht, ' +
    'muss dabei die Bedingungen der GPL-2.0-or-later einhalten: den Quelltext ' +
    'zugänglich machen, die Lizenz beilegen, Urhebervermerke erhalten und ' +
    'keine zusätzlichen Nutzungsbeschränkungen hinzufügen.<br>' +
    'Hinweis: Diese Freigabe betrifft nur die Software (den Programmcode). ' +
    'Die abspielbaren Audio- und Textinhalte stammen von Dritten und stehen ' +
    'unter eigenen Lizenzen (siehe Anzeige beim jeweiligen Inhalt); deren ' +
    'Bedingungen können abweichen, etwa Bearbeitungen untersagen. Bei der ' +
    'Auswahl wurde darauf geachtet, Inhalte zu verwenden, deren Lizenzen die ' +
    'Wiedergabe in CImbel erlauben.</p>';
  return html;
}

function _legalAssembleEmail() {
  // E-Mail wird nicht im HTML-Klartext gehalten, sondern erst beim Öffnen zusammengebaut.
  var el = document.getElementById("imprintEmail");
  if (!el) return;
  var user = "mviereck";
  var domain = "ci-sound-balancing.org";
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
  body.innerHTML = "";
  var loading = document.createElement("p");
  loading.textContent = (typeof t === "function" ? t("legalLoading")
    : "Lade Lizenztext …");
  body.appendChild(loading);

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");

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
  var ver = document.getElementById("footerVersion");
  if (ver && typeof APP_VERSION === "string") {
    ver.textContent = "Version " + APP_VERSION;
  }
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
