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
  for (var i = 0; i < FINANZEN_POSTEN.length; i++) {
    var p = FINANZEN_POSTEN[i];
    var labelKey = "supportPosten_" + p.key;
    var fullCell    = p.full    > 0 ? finFmtEuro(p.full)    : "–";
    var currentCell = p.current > 0 ? finFmtEuro(p.current) : "–";
    html +=
      '<tr>' +
        '<td data-t="' + labelKey + '"></td>' +
        '<td class="num">' + fullCell    + '</td>' +
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
