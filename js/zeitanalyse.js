// js/zeitanalyse.js  (NEU)
// Zeitübergreifende Mess-Analyse — debug-only. Architektur:
// .docs/spec/00-zeitanalyse-architektur.md
// BA 405: Reiter-Gerüst, Einlesen, Aussortieren, Bilanz. Noch keine Rechnung.
(function () {
  "use strict";

  // Normalisiert ein Status-Array auf Laenge n; fehlende Eintraege erhalten fill.
  // Verhindert, dass leere Arrays in ELL_compWLS-Filtern als "undefined" gelten
  // und Paare faelschlich ausschliessen (BA 406).
  function normStatus(arr, n, fill) {
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = (Array.isArray(arr) && arr[i] != null) ? arr[i] : fill;
    return out;
  }

  // true = aktiv; nur explizites false macht inaktiv (BA 407).
  function normActive(arr, n) {
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = !(Array.isArray(arr) && arr[i] === false);
    return out;
  }

  // ---- Dedup-Konstanten (BA 407) ----
  var ZA_DEDUP_MAX_H      = 24;    // Stunden: max. Abstand der juengsten Mess-Stempel
  var ZA_DEDUP_MIN_SIM    = 0.90;  // Anteil identischer Paare
  var ZA_DEDUP_OFFSET_EPS = 0.1;   // dB: Offset-Differenz, ab der ein Paar als verschieden gilt

  // Juengster Mess-Stempel einer Sitzung (interner Stempel in raw[].timestamp).
  function zaYoungestTs(session) {
    var ts = null;
    (session.raw || []).forEach(function (r) {
      if (typeof r.timestamp === "number" && (ts === null || r.timestamp > ts)) ts = r.timestamp;
    });
    return ts;   // ms oder null (alte Datei ohne Stempel)
  }

  // Paar-Map einer Sitzung (Schluessel = sortiertes Paar, Wert = offset).
  function zaPairMap(session) {
    var m = {};
    (session.raw || []).forEach(function (r) {
      if (typeof r.a !== "number" || typeof r.b !== "number") return;
      var k = Math.min(r.a, r.b) + "-" + Math.max(r.a, r.b);
      m[k] = r.offset;
    });
    return m;
  }

  // true, wenn zwei Sitzungen zeitnah und inhaltlich aehnlich genug sind.
  function zaSameSession(a, b) {
    var ta = zaYoungestTs(a), tb = zaYoungestTs(b);
    if (ta === null || tb === null) return false;
    if (Math.abs(ta - tb) >= ZA_DEDUP_MAX_H * 3600 * 1000) return false;
    var pa = zaPairMap(a), pb = zaPairMap(b);
    var keysA = Object.keys(pa), keysB = Object.keys(pb);
    var common = keysA.filter(function (k) { return k in pb; });
    if (!common.length) return false;
    var same = common.filter(function (k) { return Math.abs(pa[k] - pb[k]) < ZA_DEDUP_OFFSET_EPS; }).length;
    var sim = same / Math.max(keysA.length, keysB.length);
    return sim >= ZA_DEDUP_MIN_SIM;
  }

  // Gruppiert Sitzungen; behaelt je Gruppe den juengsten Repraesentanten.
  // Vergleicht nur Sitzungen gleicher Seite.
  function zaDedup(sessions) {
    var used = new Array(sessions.length).fill(false);
    var kept = [];
    var merged = 0;
    for (var i = 0; i < sessions.length; i++) {
      if (used[i]) continue;
      var group = [i];
      used[i] = true;
      for (var j = i + 1; j < sessions.length; j++) {
        if (used[j]) continue;
        if (sessions[i].side !== sessions[j].side) continue;
        var match = group.some(function (k) { return zaSameSession(sessions[k], sessions[j]); });
        if (match) { group.push(j); used[j] = true; }
      }
      var rep = group.reduce(function (best, k) {
        var tb = zaYoungestTs(sessions[best]) || 0, tk = zaYoungestTs(sessions[k]) || 0;
        return tk > tb ? k : best;
      }, group[0]);
      kept.push(sessions[rep]);
      merged += (group.length - 1);
    }
    return { kept: kept, mergedCount: merged };
  }

  // ---- Vollstaendigkeitsfilter (BA 407) ----

  // aktiv = nicht ausgeschlossen UND nicht stumm UND nicht abgewaehlt
  function zaIsActive(session, i) {
    return (session.elExDur[i] == null)
        && (session.elSt[i] !== "mute")
        && (session.elActive[i] !== false);
  }

  function zaIsComplete(session) {
    var measured = {};
    (session.raw || []).forEach(function (r) {
      if (typeof r.a === "number") measured[r.a] = true;
      if (typeof r.b === "number") measured[r.b] = true;
    });
    for (var i = 0; i < session.nEl; i++) {
      if (zaIsActive(session, i) && !measured[i]) return false;
    }
    return true;
  }

  // Modul-Zustand (überlebt Reiterwechsel, NICHT Neuladen — Architektur §8)
  var zaSessions = [];   // [{file, side, manufacturer, nEl, count, raw, elSt, elExDur, refEl, meanResidual}]
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
                 ohneSeite: 0, zusammengefasst: 0, unvollstaendig: 0, sitzungen: 0 };

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
                          nEl: nEl, count: br.length, raw: br,
                          // NEU (fuer die Pro-Datei-Rechnung, BA 406):
                          elSt:    normStatus(s.electrodeStatus,         nEl, null),
                          elExDur: normStatus(s.electrodeExcludedDuring, nEl, null),
                          refEl:   (typeof s.referenceElectrode === "number") ? s.referenceElectrode : 0,
                          elActive: normActive(s.electrodeActive, nEl) });
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

    // 1) Dedup (Architektur §6c)
    var dd = zaDedup(candidates);
    var deduped = dd.kept;
    zaBilanz.zusammengefasst = dd.mergedCount;

    // 2) Vollstaendigkeit (Architektur §6d) — auf den deduplizierten Repraesentanten
    var vollstaendig = [];
    var unvollstaendig = 0;
    deduped.forEach(function (s) {
      if (zaIsComplete(s)) vollstaendig.push(s);
      else unvollstaendig++;
    });
    zaBilanz.unvollstaendig = unvollstaendig;

    // 3) Pro-Datei-Rechnung (BA 406) nur auf vollstaendigen Sitzungen
    zaSessions = vollstaendig;
    zaSessions.forEach(function (s) { s.meanResidual = zaMeanResidual(s); });
    zaBilanz.sitzungen = zaSessions.length;

    zaRenderBilanz();
    zaRenderSessionList();
  }

  // Baut das ELL_compWLS-ctx aus einer eingelesenen Sitzung (tool-fremde Datei).
  // Architektur-Kapitel 00-zeitanalyse §3 (Datensatz-Vertrag, ELL-Variante).
  function zaToCtx(session) {
    return {
      nEl:         session.nEl,
      ELL_results: session.raw,
      elSt:        session.elSt,
      elExDur:     session.elExDur,
      ELL_refEl:   session.refEl,
    };
  }

  // Mittleres Residuum (dB) einer Sitzung: ELL_compWLS ueber ihr ctx,
  // dann Mittel von ELL_res ueber die aktiven Elektroden der Sitzung.
  function zaMeanResidual(session) {
    if (typeof ELL_compWLS !== "function") return null;
    var ctx = zaToCtx(session);
    var r = ELL_compWLS(ctx);
    if (!r || !r.ELL_res) return null;
    var sum = 0, cnt = 0;
    for (var i = 0; i < session.nEl; i++) {
      var aktiv = (ctx.elExDur[i] == null) && (ctx.elSt[i] !== "mute");
      if (!aktiv) continue;
      sum += r.ELL_res[i];
      cnt++;
    }
    return cnt ? (sum / cnt) : null;
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
    var hauptzeile = "<b>" + b.sitzungen + "</b> Sitzung(en) ausgewertet";
    if (b.zusammengefasst > 0) {
      hauptzeile += " (aus " + (b.sitzungen + b.zusammengefasst) + " Dateien zusammengefasst)";
    }
    var raus = [];
    if (b.fremd) raus.push(b.fremd + "× Fremdinhalt");
    if (b.herstellerKonflikt) raus.push(b.herstellerKonflikt + "× Hersteller-Konflikt");
    if (b.unvollstaendig) raus.push(b.unvollstaendig + "× unvollständig");
    var aus = raus.length ? " — ausgelassen: " + raus.join(", ") : "";
    el.innerHTML = '<div style="background:#f3f4f6;border-radius:6px;padding:10px">'
      + hauptzeile + aus
      + '</div>';
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
        + "</td><td style='padding:2px 10px;text-align:right'>" + s.count
        + "</td><td style='padding:2px 10px;text-align:right'>"
        + (typeof s.meanResidual === "number" ? s.meanResidual.toFixed(2) + " dB" : "—")
        + "</td></tr>";
    }).join("");
    el.innerHTML = "<table style='border-collapse:collapse;font-size:.9em'>"
      + "<tr style='font-weight:600;border-bottom:1px solid #ccc'>"
      + "<td style='padding:2px 10px'>Datei</td><td style='padding:2px 10px'>Seite</td>"
      + "<td style='padding:2px 10px'>Hersteller</td><td style='padding:2px 10px'>Elektroden</td>"
      + "<td style='padding:2px 10px'>Vergleiche</td>"
      + "<td style='padding:2px 10px'>mittl. Residuum</td></tr>" + rows + "</table>";
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
  // Debug-Hook fuer Diagnose-Tests (zaToCtx/zaMeanResidual BA406; Dedup/isComplete BA407)
  window.zaDebug = {
    toCtx:       zaToCtx,
    meanResidual: zaMeanResidual,
    sameSession:  zaSameSession,
    dedup:        zaDedup,
    isComplete:   zaIsComplete,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", zaInit);
  } else {
    zaInit();
  }
})();
