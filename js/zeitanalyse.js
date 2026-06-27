// js/zeitanalyse.js  (NEU)
// Zeitübergreifende Mess-Analyse — debug-only. Architektur:
// .docs/spec/00-zeitanalyse-architektur.md
// BA 405: Reiter-Gerüst, Einlesen, Aussortieren, Bilanz. Noch keine Rechnung.
(function () {
  "use strict";

  // Modul-Zustand (überlebt Reiterwechsel, NICHT Neuladen — Architektur §8)
  var zaSessions = [];   // [{file, side, manufacturer, nEl, count, raw}]
  var zaBilanz   = { eingelesen: 0, fremd: 0, herstellerKonflikt: 0,
                     ohneSeite: 0, sitzungen: 0 };

  function zaUpdateTabVisibility() {
    var on = !!(window.dbg && typeof window.dbg.isActive === "function"
                && window.dbg.isActive());
    var b = document.getElementById("tabVerlaufsanalyse");
    if (b) b.style.display = on ? "" : "none";
    // Wenn Debug ausgeschaltet wird, während der Reiter aktiv ist:
    // auf einen sicheren Reiter zurückschalten.
    if (!on) {
      var active = document.querySelector(".tab.active");
      if (active && active.dataset.tab === "verlaufsanalyse"
          && typeof switchTab === "function") {
        switchTab("setup");
      }
    }
  }

  // ---- Datei-Auswahl ----
  function zaOnPick(ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    if (!files.length) return;
    zaReadFiles(files);
    ev.target.value = "";  // erneutes Wählen derselben Datei erlauben
  }

  function zaReadFiles(files) {
    // Maßstab für Hersteller-/Elektrodenzahl-Prüfung = AKTUELL eingestellte
    // Seite (Architektur §6e). Pro Seite getrennt geprüft.
    var pending = files.length;
    var parsed = [];   // {name, obj} oder {name, fremd:true}
    files.forEach(function (f) {
      var r = new FileReader();
      r.onload = function (e) {
        try {
          var d = JSON.parse(e.target.result);
          parsed.push({ name: f.name, obj: d });
        } catch (_) {
          parsed.push({ name: f.name, fremd: true });
        }
        if (--pending === 0) zaProcess(parsed);
      };
      r.onerror = function () {
        parsed.push({ name: f.name, fremd: true });
        if (--pending === 0) zaProcess(parsed);
      };
      r.readAsText(f);
    });
  }

  // ---- Verarbeitung: aussortieren, Konflikt prüfen, Sitzungen sammeln ----
  function zaProcess(parsed) {
    zaSessions = [];
    zaBilanz = { eingelesen: parsed.length, fremd: 0, herstellerKonflikt: 0,
                 ohneSeite: 0, sitzungen: 0 };

    // 1) Fremdinhalt raus (vorhandene Helfer aus file.js)
    var cimbel = [];
    parsed.forEach(function (p) {
      if (p.fremd || !_isCimbelSave(p.obj)) { zaBilanz.fremd++; return; }
      cimbel.push(p);
    });

    // 2) Pro Datei je Seite die ELL-Daten ziehen (nur Seiten MIT
    //    balanceResults). Hersteller/nEl gegen aktuelle Seite prüfen.
    var conflicts = [];          // {name, side, hat, erwartet}
    var candidates = [];         // {file, side, manufacturer, nEl, count, raw}
    cimbel.forEach(function (p) {
      var sides = (p.obj && p.obj.sides) || {};
      ["left", "right"].forEach(function (sd) {
        var s = sides[sd];
        if (!s) return;
        var br = s.balanceResults;
        if (!Array.isArray(br) || !br.length) return;     // keine ELL-Daten
        var nEl = Array.isArray(s.frequencies) ? s.frequencies.length : null;
        var mfr = s.manufacturer || null;
        var exp = zaExpectedFor(sd);                       // {mfr, nEl} | null
        if (exp && (mfr !== exp.mfr || nEl !== exp.nEl)) {
          conflicts.push({ name: p.name, side: sd,
                           hat: mfr + " " + nEl, erwartet: exp.mfr + " " + exp.nEl });
          return;
        }
        candidates.push({ file: p.name, side: sd, manufacturer: mfr,
                          nEl: nEl, count: br.length, raw: br });
      });
    });

    // 3) Konflikt-Dialog (einziger interaktiver Filter, Architektur §6e)
    if (conflicts.length) {
      var liste = conflicts.map(function (c) {
        return "* " + c.name + " (" + (c.side === "left" ? "links" : "rechts")
             + "): " + c.hat + ", erwartet " + c.erwartet;
      }).join("\n");
      var ignore = confirm(
        "Folgende Dateien passen nicht zum aktuell eingestellten Implantat "
        + "und sind nicht auswertbar:\n\n" + liste
        + "\n\nOK = diese Dateien ignorieren und den Rest auswerten."
        + "\nAbbrechen = Auswertung abbrechen.");
      if (!ignore) {            // Abbruch
        zaRenderBilanz("abgebrochen");
        return;
      }
      zaBilanz.herstellerKonflikt = conflicts.length;
    }

    zaSessions = candidates;
    zaBilanz.sitzungen = candidates.length;
    zaRenderBilanz();
    zaRenderSessionList();
  }

  // Erwarteter Hersteller/nEl der Seite aus dem aktuellen Tool-Zustand.
  // sideData/MFR sind global (state-side.js). Gibt null, wenn Seite
  // nicht sinnvoll konfiguriert.
  function zaExpectedFor(side) {
    try {
      if (typeof sideData === "undefined" || !sideData[side]) return null;
      var s = sideData[side];
      if (!s.manufacturer || !s.nEl) return null;
      return { mfr: s.manufacturer, nEl: s.nEl };
    } catch (_) { return null; }
  }

  // ---- Anzeige ----
  function zaRenderBilanz(state) {
    var el = document.getElementById("zaBilanz");
    if (!el) return;
    var b = zaBilanz;
    if (state === "abgebrochen") {
      el.innerHTML = '<div style="color:#b45309">Auswertung abgebrochen. '
        + 'Bitte Auswahl bereinigen und erneut wählen.</div>';
      return;
    }
    var parts = [];
    parts.push("<b>" + b.sitzungen + "</b> Mess-Seite(n) eingelesen");
    var raus = [];
    if (b.fremd) raus.push(b.fremd + "× Fremdinhalt");
    if (b.herstellerKonflikt) raus.push(b.herstellerKonflikt + "× Hersteller-Konflikt");
    var aus = raus.length ? " — ausgelassen: " + raus.join(", ") : "";
    el.innerHTML = '<div style="background:#f3f4f6;border-radius:6px;padding:10px">'
      + parts.join("") + aus
      + '<div style="color:#888;font-size:.85em;margin-top:4px">'
      + 'Hinweis: Mehrfach gespeicherte Fassungen derselben Messung werden in '
      + 'dieser Stufe noch als eigene Zeilen gezählt; das Zusammenfassen folgt.'
      + '</div></div>';
  }

  function zaRenderSessionList() {
    var el = document.getElementById("zaSessionList");
    if (!el) return;
    if (!zaSessions.length) { el.innerHTML = ""; return; }
    var rows = zaSessions.map(function (s) {
      return "<tr><td style='padding:2px 10px'>" + s.file
        + "</td><td style='padding:2px 10px'>" + (s.side === "left" ? "links" : "rechts")
        + "</td><td style='padding:2px 10px'>" + (s.manufacturer || "?")
        + "</td><td style='padding:2px 10px'>" + (s.nEl || "?")
        + "</td><td style='padding:2px 10px;text-align:right'>" + s.count + "</td></tr>";
    }).join("");
    el.innerHTML = "<table style='border-collapse:collapse;font-size:.9em'>"
      + "<tr style='font-weight:600;border-bottom:1px solid #ccc'>"
      + "<td style='padding:2px 10px'>Datei</td><td style='padding:2px 10px'>Seite</td>"
      + "<td style='padding:2px 10px'>Hersteller</td><td style='padding:2px 10px'>Elektroden</td>"
      + "<td style='padding:2px 10px'>Vergleiche</td></tr>" + rows + "</table>";
  }

  // ---- Init ----
  function zaInit() {
    var btn = document.getElementById("zaPickBtn");
    var inp = document.getElementById("zaFileInput");
    if (btn && inp) {
      btn.addEventListener("click", function () { inp.click(); });
      inp.addEventListener("change", zaOnPick);
    }
    zaUpdateTabVisibility();
  }

  // Export für debug.js-Hook
  window.zaUpdateTabVisibility = zaUpdateTabVisibility;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", zaInit);
  } else {
    zaInit();
  }
})();
