// legal.js – Footer-Modals (Impressum, Lizenz) und E-Mail-Aufbau.

var _LICENSE_RAW_URL =
  "https://raw.githubusercontent.com/mviereck/ci-sound-balancing/main/LICENSE";
var _LICENSE_HTML_URL =
  "https://github.com/mviereck/ci-sound-balancing/blob/main/LICENSE";

function _legalBuildImprintBody() {
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
    'Veröffentlicht unter der GNU General Public License v2 oder neuer (GPL-2.0-or-later). Quellcode: ' +
    '<a href="https://github.com/mviereck/ci-sound-balancing" target="_blank" rel="noopener noreferrer">' +
    'github.com/mviereck/ci-sound-balancing</a></p>';
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
