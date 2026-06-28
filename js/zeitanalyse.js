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

  // ---- Schärfe-Konstanten + Zustand (BA 408) ----
  var ZA_EPS      = 0.01;
  var ZA_SHARPNESS = { mild: 1.0, mittel: 1.5, scharf: 2.0 };
  var zaSharpKey  = "mittel";

  function zaWeight(session) {
    var res = (typeof session.meanResidual === "number" && session.meanResidual >= 0)
              ? session.meanResidual : null;
    if (res === null) return 0;
    var p = ZA_SHARPNESS[zaSharpKey] || 1.5;
    return 1 / (Math.pow(res, p) + ZA_EPS);
  }

  // Konsens-Paarliste der Sitzungen einer Seite. side = 'left'|'right'.
  // Ergebnis: [{a, b, offset, timestamp}] — EIN Eintrag pro Paar
  // (Format = ELL_results; spaeter auch fuer den Uebertrag §7).
  function zaConsensusPairs(side) {
    var acc = {};
    zaSessions.forEach(function (s) {
      if (s.side !== side) return;
      var q = zaWeight(s);
      if (!(q > 0)) return;
      (s.raw || []).forEach(function (r) {
        if (typeof r.a !== "number" || typeof r.b !== "number") return;
        var a = r.a, b = r.b, off = r.offset;
        if (a > b) { a = r.b; b = r.a; off = -off; }
        var k = a + "-" + b;
        if (!acc[k]) acc[k] = { a: a, b: b, sw: 0, wt: 0, ts: 0 };
        acc[k].sw += off * q;
        acc[k].wt += q;
        if (typeof r.timestamp === "number" && r.timestamp > acc[k].ts) acc[k].ts = r.timestamp;
      });
    });
    var out = [];
    Object.keys(acc).forEach(function (k) {
      var e = acc[k];
      if (e.wt > 0) out.push({ a: e.a, b: e.b, offset: e.sw / e.wt, timestamp: e.ts });
    });
    return out;
  }

  function zaConsolidatedCtx(side) {
    var base = ELL_ctx(side === "left" || side === "right" ? side : "global");
    var pairs = zaConsensusPairs(side);
    return Object.assign({}, base, { ELL_results: pairs });
  }

  function zaMakeColorFn(resArr, measuredSet) {
    return function (i) {
      if (!measuredSet.has(i)) return "grey";
      var r = resArr[i] || 0.001;
      if (r <= 1.0) return "green";
      if (r < 3.0)  return "yellow";
      return "red";
    };
  }

  // ---- Heatmap (BA 409) ----

  var ZA_HM_RANGE = 10;   // dB; Werte darueber/darunter werden gekappt
  var ZA_HM_MIN_COL_W = 14;   // px Mindestbreite je Spalte

  // Liefert die Heatmap-Daten der aktuellen Seite:
  //   { sessions: [{ ts, corr:[..], active:[..] }], elCount, tMin, tMax }
  // corr[i]   = Korrektur-dB der Elektrode i in dieser Sitzung (-levels[i])
  // active[i] = war Elektrode i in DIESER Sitzung aktiv (historischer Status)?
  // ts        = juengster Mess-Stempel der Sitzung (Kalenderzeit)
  function zaHeatmapData(side) {
    var out = [];
    var elCount = 0;
    zaSessions.forEach(function (s) {
      if (s.side !== side) return;
      var ts = zaYoungestTs(s);
      if (ts === null) return;                 // ohne Stempel keine Zeitposition
      var ctx = zaToCtx(s);                    // historischer Status der DATEI (§6f)
      var r = ELL_compWLS(ctx);                // {levels, ...}
      elCount = Math.max(elCount, s.nEl);
      var corr = [], active = [];
      for (var i = 0; i < s.nEl; i++) {
        // aktiv = nicht ausgeschlossen, nicht stumm, nicht abgewaehlt (§6d-Definition)
        var act = (s.elExDur[i] == null) && (s.elSt[i] !== "mute")
                  && (s.elActive[i] !== false);
        active[i] = act;
        corr[i] = act ? -r.levels[i] : null;   // inaktiv -> null (graue Zelle)
      }
      out.push({ ts: ts, corr: corr, active: active });
    });
    out.sort(function (a, b) { return a.ts - b.ts; });   // chronologisch
    var tMin = out.length ? out[0].ts : 0;
    var tMax = out.length ? out[out.length - 1].ts : 0;
    return { sessions: out, elCount: elCount, tMin: tMin, tMax: tMax };
  }

  function zaHeatColor(dB) {
    if (dB === null || typeof dB !== "number" || !isFinite(dB)) return "#e5e5e5"; // grau = inaktiv/kein Wert
    var t = Math.max(-1, Math.min(1, dB / ZA_HM_RANGE));   // -1..+1 (gekappt)
    // -1 blau (59,130,246) ... 0 weiss (255,255,255) ... +1 rot (220,38,38)
    var r, g, b;
    if (t < 0) {            // blau-Seite
      var u = t + 1;        // 0..1 (0=blau, 1=weiss)
      r = Math.round(59  + (255 - 59)  * u);
      g = Math.round(130 + (255 - 130) * u);
      b = Math.round(246 + (255 - 246) * u);
    } else {                // rot-Seite
      var v = 1 - t;        // 0..1 (1=weiss, 0=rot)
      r = Math.round(220 + (255 - 220) * v);
      g = Math.round(38  + (255 - 38)  * v);
      b = Math.round(38  + (255 - 38)  * v);
    }
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  // Gekappte Werte markieren (kleiner Punkt), damit ±>10 erkennbar bleibt:
  function zaHeatClipped(dB) {
    return (typeof dB === "number" && isFinite(dB) && Math.abs(dB) > ZA_HM_RANGE);
  }

  function zaDrawHeatmap() {
    var cv = document.getElementById("zaHeatmap");
    if (!cv) return;
    var side = activeSide;
    var data = zaHeatmapData(side);
    var hint = document.getElementById("zaHeatmapHint");
    if (!data.sessions.length || !data.elCount) {
      if (hint) hint.textContent = "Keine auswertbaren Sitzungen fuer diese Seite.";
      var c0 = cv.getContext("2d"); c0.clearRect(0, 0, cv.width, cv.height);
      return;
    }
    if (hint) hint.textContent = "";

    var dpr = window.devicePixelRatio || 1;
    var w = cv.parentElement.clientWidth - 32;
    var padL = 46, padR = 12, padT = 12, padB = 40;
    var plotW = w - padL - padR;
    var rowH = 18;
    var h = padT + padB + data.elCount * rowH;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + "px"; cv.style.height = h + "px";
    var g = cv.getContext("2d"); g.scale(dpr, dpr);
    g.clearRect(0, 0, w, h);

    // X-Position einer Sitzung: echte Zeit, aber Spaltenbreite >= Mindestbreite.
    var n = data.sessions.length;
    function tX(ts) {
      if (data.tMax === data.tMin) return padL + plotW / 2;
      return padL + (ts - data.tMin) / (data.tMax - data.tMin) * plotW;
    }
    // Spaltenbreiten vorab bestimmen (Mindestbreite, sonst halbe Nachbar-Distanz)
    var cols = data.sessions.map(function (s, i) {
      var x = tX(s.ts);
      var left  = (i > 0)     ? (x + tX(data.sessions[i-1].ts)) / 2 : x - ZA_HM_MIN_COL_W;
      var right = (i < n - 1) ? (x + tX(data.sessions[i+1].ts)) / 2 : x + ZA_HM_MIN_COL_W;
      var cw = Math.max(ZA_HM_MIN_COL_W, right - left);
      return { x: x, cw: cw, s: s };
    });

    // Zellen zeichnen
    cols.forEach(function (col) {
      var cx = col.x - col.cw / 2;
      for (var i = 0; i < data.elCount; i++) {
        var dB = (i < col.s.corr.length) ? col.s.corr[i] : null;
        var y = padT + i * rowH;
        g.fillStyle = zaHeatColor(dB);
        g.fillRect(cx, y, col.cw - 1, rowH - 1);
        if (zaHeatClipped(dB)) {   // gekappt-Markierung
          g.fillStyle = "#000";
          g.beginPath(); g.arc(cx + col.cw / 2, y + rowH / 2, 1.6, 0, Math.PI * 2); g.fill();
        }
      }
    });

    // Y-Achse: Elektroden-Labels (dEN der aktuellen Seite via ELL_ctx)
    var ctxLbl = ELL_ctx(side === "left" || side === "right" ? side : "global");
    var dENfn  = ctxLbl.dEN || dEN;
    var pfxFn  = ctxLbl.dENPrefix || dENPrefix;
    g.fillStyle = "#555"; g.font = "10px Segoe UI,sans-serif"; g.textAlign = "right";
    for (var i = 0; i < data.elCount; i++) {
      g.fillText(pfxFn() + dENfn(i), padL - 6, padT + i * rowH + rowH / 2 + 3);
    }

    // X-Achse: ein paar Datums-Labels (erste, letzte, ggf. mittlere)
    g.textAlign = "center"; g.fillStyle = "#888"; g.font = "9px Segoe UI,sans-serif";
    function dateLbl(ts) {
      var d = new Date(ts);
      return d.getDate() + "." + (d.getMonth() + 1) + ".";
    }
    cols.forEach(function (col, i) {
      // nur jede Spalte beschriften, wenn Platz; sonst erste/letzte
      if (n <= 8 || i === 0 || i === n - 1) {
        g.fillText(dateLbl(col.s.ts), col.x, h - padB + 14);
      }
    });

    // Legende (kurz, unter der X-Achse)
    g.textAlign = "left"; g.fillStyle = "#888";
    g.fillText("blau = leiser noetig   rot = lauter noetig   grau = inaktiv", padL, h - 6);
  }

  function zaDrawCurve() {
    var cv = document.getElementById("zaCurveChart");
    if (!cv) return;
    var side = activeSide;
    var ctx  = zaConsolidatedCtx(side);
    if (!ctx.ELL_results || !ctx.ELL_results.length) {
      var hint = document.getElementById("zaCurveHint");
      if (hint) hint.textContent = "Keine auswertbaren Sitzungen fuer diese Seite.";
      return;
    }
    var r = ELL_compWLS(ctx);
    var measured = new Set();
    ctx.ELL_results.forEach(function (p) { measured.add(p.a); measured.add(p.b); });
    var colorFn = zaMakeColorFn(r.ELL_res, measured);
    ELL_drawChart(cv, r.levels, r.ELL_res, true, colorFn, ctx);
  }

  function zaOnSharpness(key) {
    if (!ZA_SHARPNESS[key]) return;
    zaSharpKey = key;
    ["mild", "mittel", "scharf"].forEach(function (k) {
      var b = document.getElementById("zaSharp_" + k);
      if (b) b.style.fontWeight = (k === key) ? "700" : "400";
    });
    zaDrawCurve();
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
    zaDrawCurve();
    zaDrawHeatmap();
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
    ["mild", "mittel", "scharf"].forEach(function (k) {
      var b = document.getElementById("zaSharp_" + k);
      if (b) b.addEventListener("click", function () { zaOnSharpness(k); });
    });
    zaUpdateTabVisibility();
  }

  // Export für debug.js-Hook
  window.zaUpdateTabVisibility = zaUpdateTabVisibility;
  // Debug-Hook fuer Diagnose-Tests (zaToCtx/zaMeanResidual BA406; Dedup/isComplete BA407; BA408)
  window.zaDebug = {
    toCtx:          zaToCtx,
    meanResidual:   zaMeanResidual,
    sameSession:    zaSameSession,
    dedup:          zaDedup,
    isComplete:     zaIsComplete,
    consensusPairs: zaConsensusPairs,
    weight:         zaWeight,
    consolidatedCtx: zaConsolidatedCtx,
    heatmapData:    zaHeatmapData,
    heatColor:      zaHeatColor,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", zaInit);
  } else {
    zaInit();
  }
})();
