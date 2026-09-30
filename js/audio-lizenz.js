// audio-lizenz.js -- Lizenz-Volltext-Dialog fuer Player-Items.
// Katalog + Texte lokal aus assets/lizenztexte/ (kein externer Fetch).

var _alKatalog = null;      // SPDX -> {frei, auflagen, texte, name}
var _alKatalogTried = false;

function _alLoadKatalog(cb) {
  if (_alKatalog || _alKatalogTried) { cb(_alKatalog); return; }
  _alKatalogTried = true;
  fetch("assets/lizenztexte/katalog.json", { cache: "no-cache" })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { _alKatalog = j; cb(j); })
    .catch(function () { cb(null); });
}

// Anzeige-Name fuer eine SPDX-Lizenz (Katalog-name, sonst der SPDX-Wert).
function alLicenseName(spdx) {
  if (!spdx) return "";
  if (_alKatalog && _alKatalog[spdx] && _alKatalog[spdx].name) {
    return _alKatalog[spdx].name;
  }
  return spdx;
}

// Gibt es zu dieser Lizenz ueberhaupt einen Katalog-Eintrag (=klickbar)?
function alHasEntry(spdx) {
  return !!(_alKatalog && _alKatalog[spdx]);
}

// aktuelle UI-Sprache (2-Buchstaben). Aus dem DOM gelesen -- genau die
// Quelle, die i18n.js:34 selbst nutzt (langSelect-Wert). Robust
// gegenueber dem Scope der globalen let-Variable 'lang'. Fallback "de".
function _alUiLang() {
  var sel = document.getElementById("langSelect");
  return (sel && sel.value) ? sel.value : "de";
}

// Holt eine Textdatei; erst UI-Sprache, dann Englisch als Fallback.
function _alFetchText(spdx, art, langs, cb) {
  var tries = [];
  var ui = _alUiLang();
  if (langs.indexOf(ui) >= 0) tries.push(ui);
  if (ui !== "en" && langs.indexOf("en") >= 0) tries.push("en");
  if (!tries.length && langs.length) tries.push(langs[0]);
  var i = 0;
  function next() {
    if (i >= tries.length) { cb(null); return; }
    var lang = tries[i++];
    fetch("assets/lizenztexte/" + spdx + "/" + art + "." + lang + ".txt",
          { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.text() : null; })
      .then(function (txt) { if (txt) cb(txt); else next(); })
      .catch(next);
  }
  next();
}

// Oeffnet den Dialog fuer eine SPDX-Lizenz.
function alOpenDialog(spdx) {
  var dlg = document.getElementById("audioLicenseDialog");
  var body = document.getElementById("audioLicenseBody");
  var titleEl = document.getElementById("audioLicenseTitle");
  if (!dlg || !body) return;
  var entry = (_alKatalog && _alKatalog[spdx]) || {};
  var texte = entry.texte || {};
  if (titleEl) titleEl.textContent = alLicenseName(spdx);
  body.innerHTML = "";

  // Reihenfolge: deed -> legalcode -> hinweis (nur was existiert).
  // Alle Texte kommen in EINEN scrollbaren Container (kein zweigeteilter
  // Bereich); jeder Absatz wird ein <p> (Fliesstext, weicher Umbruch).
  var arten = ["deed", "legalcode", "hinweis"].filter(function (art) {
    return texte[art] && texte[art].length;
  });
  var container = document.createElement("div");
  container.className = "audio-license-text";
  body.appendChild(container);

  function renderText(txt) {
    txt.split(/\n\s*\n/).forEach(function (para) {
      var p = para.replace(/\s+/g, " ").trim();
      if (!p) return;
      var el = document.createElement("p");
      el.textContent = p;
      container.appendChild(el);
    });
  }

  // Sequentiell laden, damit die Reihenfolge (deed vor legalcode) stimmt.
  var i = 0, any = false;
  function loadNext() {
    if (i >= arten.length) {
      if (!any) {
        container.textContent = (typeof t === "function")
          ? t("alNoText") : "Kein Lizenztext hinterlegt.";
      }
      return;
    }
    var art = arten[i++];
    _alFetchText(spdx, art, texte[art], function (txt) {
      if (txt) { any = true; renderText(txt); }
      loadNext();
    });
  }
  loadNext();

  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
}

// Katalog beim Laden der Seite vorbereiten (nicht blockierend).
document.addEventListener("DOMContentLoaded", function () {
  _alLoadKatalog(function () {});
});
