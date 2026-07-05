/* warp-verify.js — Warp-Verifikationstest (BA438)
 * Privates Debug-Werkzeug. Kein i18n, nur deutscher Text.
 * Erzeugt pro gemessener Elektrode einen Sinuston bei der gehoerten
 * Frequenz, warpt ihn einzeln durch die echte Player-Pipeline
 * (pComputeRubberbandWarpedBuffer) und misst die Grundfrequenz des
 * Ergebnisses. Vergleich mit der nominellen (Ziel-)Frequenz.
 */

// --- Sinuston in einen Stereo-AudioBuffer schreiben --------------------
// hz: Frequenz, sec: Laenge, sr: Sample-Rate. Amplitude 0.5, 30 ms Fade
// ein/aus (Cosinus-Rampe). Beide Kanaele identisch.
function _wv_makeToneBuffer(ctx, hz, sec, sr) {
  const n = Math.round(sec * sr);
  const buf = ctx.createBuffer(2, n, sr);
  const fade = Math.round(0.030 * sr);
  const data = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let a = 0.5 * Math.sin(2 * Math.PI * hz * i / sr);
    if (i < fade)
      a *= Math.sin((i / fade) * 0.5 * Math.PI);
    else if (i >= n - fade)
      a *= Math.sin(((n - i) / fade) * 0.5 * Math.PI);
    data[i] = a;
  }
  buf.getChannelData(0).set(data);
  buf.getChannelData(1).set(data);
  return buf;
}

// --- Grundfrequenz per Autokorrelation -------------------------------
// signal: Float32Array (Mono, bereits auf das Messfenster beschnitten).
// sr: Sample-Rate. fMin/fMax: erwarteter Frequenzbereich.
// Rueckgabe: geschaetzte Frequenz in Hz.
function _wv_detectFreq(signal, sr, fMin, fMax) {
  const lagMin = Math.floor(sr / fMax);
  const lagMax = Math.ceil(sr / fMin);
  const len = signal.length;

  let bestLag = lagMin;
  let bestVal = -Infinity;

  for (let lag = lagMin; lag <= lagMax; lag++) {
    let sum = 0;
    const count = len - lag;
    if (count <= 0) break;
    for (let i = 0; i < count; i++) {
      sum += signal[i] * signal[i + lag];
    }
    if (sum > bestVal) {
      bestVal = sum;
      bestLag = lag;
    }
  }

  // Parabolische Interpolation um das Maximum fuer Sub-Sample-Genauigkeit.
  const prev = bestLag > lagMin ? bestLag - 1 : bestLag;
  const next = bestLag < lagMax ? bestLag + 1 : bestLag;

  let rPrev = 0, rCur = bestVal, rNext = 0;
  if (prev !== bestLag) {
    const cp = len - prev;
    for (let i = 0; i < cp; i++) rPrev += signal[i] * signal[i + prev];
  }
  if (next !== bestLag) {
    const cn = len - next;
    for (let i = 0; i < cn; i++) rNext += signal[i] * signal[i + next];
  }

  let refinedLag = bestLag;
  const denom = rPrev - 2 * rCur + rNext;
  if (denom !== 0) {
    refinedLag = bestLag - 0.5 * (rNext - rPrev) / denom;
  }

  return sr / refinedLag;
}

// --- Ein Messfenster (mittleres Drittel) aus dem gewarpten Buffer holen
function _wv_middleThird(buf) {
  const ch = buf.getChannelData(0);
  const n = ch.length;
  const a = Math.floor(n / 3);
  const b = Math.floor(2 * n / 3);
  return ch.subarray(a, b);
}

// --- Haupttest: alle Elektroden durchmessen -------------------------
async function wv_runWarpVerify() {
  const ctx = gPC();
  const sr = ctx.sampleRate;
  const modus = (typeof pWarpMode !== "undefined") ? pWarpMode : "right";
  const nhSim = !!(document.getElementById("plNHSim")?.checked);
  const werte = FRQ_werte("gehoert", modus, nhSim);

  // Status je elIdx aus FRQ_activeResults() vorindizieren (fmStatus).
  const statusByIdx = {};
  if (typeof FRQ_activeResults === "function") {
    for (const r of FRQ_activeResults()) {
      if (r && r.elIdx != null) statusByIdx[r.elIdx] = r.fmStatus || "";
    }
  }

  // Seite = aktive globale Seite (Umschalter), NICHT aus modus abgeleitet.
  const seite = (typeof activeSide === "string") ? activeSide : "right";

  const rows = [];
  for (const w of werte) {
    const s = w[seite];
    if (!s || s.gehoertHz == null || !s.aktiv) continue;
    const gehoert  = s.gehoertHz;
    const nominell = s.nominellHz;

    const src = _wv_makeToneBuffer(ctx, gehoert, 3, sr);
    const out = await pComputeRubberbandWarpedBuffer(src, modus);

    const sig = _wv_middleThird(out);
    const fMin = Math.min(gehoert, nominell) * 0.6;
    const fMax = Math.max(gehoert, nominell) * 1.7;
    const gemessen = _wv_detectFreq(sig, sr, fMin, fMax);

    const dCent = 1200 * Math.log2(gemessen / nominell);
    const ok = Math.abs(dCent) <= 20;

    rows.push({
      el: w.elIdx + 1,
      gehoert, nominell, gemessen, dCent, ok,
      status: statusByIdx[w.elIdx] || ""
    });
  }

  _wv_renderTable(rows, modus, nhSim);
}

// --- Tabelle rendern (deutscher Text, kein i18n) ---------------------
function _wv_renderTable(rows, modus, nhSim) {
  const body = document.getElementById("wvResultBody");
  const head = document.getElementById("wvResultHead");
  if (!body) return;
  const seiteLabel = (typeof activeSide === "string" && activeSide === "left") ? "LINKS" : "RECHTS";
  head.textContent =
    "Aktive Seite: " + seiteLabel +
    " · Warp-Modus: " + modus +
    " · NH-Sim: " + (nhSim ? "an" : "aus");
  body.innerHTML = rows.map(function (r) {
    return "<tr>" +
      "<td>E" + r.el + "</td>" +
      "<td>" + r.gehoert.toFixed(1) + "</td>" +
      "<td>" + r.nominell.toFixed(1) + "</td>" +
      "<td>" + r.gemessen.toFixed(1) + "</td>" +
      "<td style='color:" + (r.ok ? "#16a34a" : "#dc2626") + "'>" +
        (r.dCent >= 0 ? "+" : "") + r.dCent.toFixed(1) + "</td>" +
      "<td style='text-align:center'>" + (r.ok ? "✓" : "✗") + "</td>" +
      "<td style='font-size:.82em'>" + (r.status || "—") + "</td>" +
      "</tr>";
  }).join("");
}

// --- Button verdrahten -----------------------------------------------
document.addEventListener("DOMContentLoaded", function () {
  const btn = document.getElementById("wvRunBtn");
  if (btn) btn.addEventListener("click", function () {
    btn.disabled = true;
    wv_runWarpVerify().catch(function (e) {
      const body = document.getElementById("wvResultBody");
      if (body) body.innerHTML =
        "<tr><td colspan='7' style='color:#dc2626'>Fehler: " +
        (e && e.message ? e.message : e) + "</td></tr>";
    }).finally(function () { btn.disabled = false; });
  });
});
