/* ============================================================
 * audio-source.js — generischer Audio-Quellen-Layer
 *
 * Aufgaben:
 *  - Embed-Module einlesen (window.CI_SB_EMBED.sources)
 *  - generierte Standardrauscher als virtuelle Items bereitstellen
 *  - einheitliche Item-Liste pro Kategorie ausliefern
 *  - Sortier-Achsen deklarativ verwalten
 *
 * Erweiterbar: weitere Provider (Webspace-Manifest, User-Upload) haengen
 * sich als Eintrag in AM_PROVIDERS ein. Eine neue Sortier-Achse =
 * ein Eintrag mehr in AM_SORT_AXES[category]. Kein Refactor der
 * bestehenden Aufrufer noetig.
 * ============================================================ */

// Provider-Liste — Reihenfolge entspricht Anzeige-Reihenfolge der Items
const AM_PROVIDERS = [];

function amRegisterProvider(p) {
  // p = { id: "string", listItems: function(category) -> [item, ...] }
  AM_PROVIDERS.push(p);
}

function amCollectItems(category) {
  const out = [];
  for (const p of AM_PROVIDERS) {
    try {
      const items = p.listItems(category);
      if (Array.isArray(items)) {
        for (const it of items) {
          if (!it) continue;
          // Stempel "providerId" auf jedes Item, damit der Player weiss,
          // wo die Audio-Quelle herzuholen ist.
          it._providerId = p.id;
          out.push(it);
        }
      }
    } catch (e) {
      console.warn("[audio-source] provider " + p.id + " warf:", e);
    }
  }
  return out;
}

// --- Sortier-Achsen ---
// Pro Kategorie eine Liste. Ein Eintrag = eine Achse.
const AM_SORT_AXES = {
  geraeusche: [
    {
      key: "kind",
      labelKey: "amSortKind",
      labelDefault: "nach Art",
      getter: function (it) { return (it.tags && it.tags.kind) || "zzz-unbekannt"; }
    },
    {
      key: "spectrum",
      labelKey: "amSortSpectrum",
      labelDefault: "nach Spektrum",
      getter: function (it) { return (it.tags && it.tags.spectrum) || "zzz-unbekannt"; }
    },
    {
      key: "source",
      labelKey: "amSortSource",
      labelDefault: "nach Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; }
    }
  ]
  // weitere Kategorien (saetze, musik, hoerbuecher) folgen in spaeteren BAs.
};

function amSortAxesFor(category) {
  return AM_SORT_AXES[category] || [];
}

function amSortItems(items, category, axisKey) {
  const axes = amSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; }) || axes[0];
  if (!axis) return items.slice();
  const arr = items.slice();
  arr.sort(function (a, b) {
    const va = axis.getter(a), vb = axis.getter(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    // Sekundaer-Sortierung: nach Item-Titel, damit die Reihenfolge stabil ist
    const ta = (a.title || a.id || "").toLowerCase();
    const tb = (b.title || b.id || "").toLowerCase();
    return ta < tb ? -1 : (ta > tb ? 1 : 0);
  });
  return arr;
}

// --- Provider 1: generierte Standardrauscher ---
// Items haben kein `audio`-Feld, sondern werden vom Player anhand der
// `id` mit dem Prefix "gen:" erkannt und ueber amGenerateNoiseBuffer
// als AudioBuffer erzeugt.

const AM_GEN_NOISES = [
  {
    id: "gen:white",
    title: "Weisses Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-weiss", spectrum: "broadband", stationary: "y", loop_safe: "y" }
  },
  {
    id: "gen:pink",
    title: "Rosa Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-rosa", spectrum: "broadband", stationary: "y", loop_safe: "y" }
  },
  {
    id: "gen:brown",
    title: "Braunes Rauschen",
    sourceTitle: "generiert",
    license: null,
    credit: null,
    tags: { kind: "rauschen-rosa", spectrum: "lowpass", stationary: "y", loop_safe: "y" }
    // braunes Rauschen hat keinen eigenen Manifest-Wert, daher "rauschen-rosa"
    // als naechstliegende Klasse. Spektrum lowpass kennzeichnet den tieflastigen Anteil.
  }
];

amRegisterProvider({
  id: "generated",
  listItems: function (category) {
    if (category !== "geraeusche") return [];
    return AM_GEN_NOISES.slice();
  }
});

// Generierungs-Funktion: liefert AudioBuffer mit ~5 s Rauschen, sample-genau
// loop-tauglich.
function amGenerateNoiseBuffer(ctx, kind) {
  const dur = 5.0;
  const sr  = ctx.sampleRate;
  const len = Math.floor(dur * sr);
  const buf = ctx.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);

  if (kind === "gen:white") {
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
    return buf;
  }
  if (kind === "gen:pink") {
    // Voss-McCartney pink-noise Algorithmus (kuerzer Variante).
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
      data[i] = out * 0.11;
    }
    return buf;
  }
  if (kind === "gen:brown") {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = (Math.random() * 2 - 1) * 0.02;
      last = Math.max(-1, Math.min(1, last + w));
      data[i] = last * 3.5;
    }
    return buf;
  }
  return null;
}

// --- Provider 2: Embed-Modul (window.CI_SB_EMBED) ---
// Liest Collections aus dem Embed-Bundle und liefert Items.
// Items behalten ihre originale `audio`-Field (data-URL).

amRegisterProvider({
  id: "embed",
  listItems: function (category) {
    const out = [];
    const root = (typeof window !== "undefined") ? window.CI_SB_EMBED : null;
    if (!root || !root.sources) return out;
    for (const key in root.sources) {
      const col = root.sources[key];
      if (!col || col.category !== category) continue;
      const colTags = col.tags || {};
      const colTitle = col.title || key;
      const colLicense = col.license || null;
      const colCredit  = col.credit  || null;
      const items = Array.isArray(col.items) ? col.items : [];
      for (const it of items) {
        const merged = {
          id: key + ":" + (it.id || ""),
          title: it.title || it.id || "(unbenannt)",
          audio: it.audio,
          duration: it.duration,
          sourceTitle: colTitle,
          license: it.license || colLicense,
          credit:  it.credit  || colCredit,
          tags: Object.assign({}, colTags, it.tags || {})
        };
        out.push(merged);
      }
    }
    return out;
  }
});

// ============================================================
// Item-Buffer-Cache + RMS-Normalisierung (BA194)
// ============================================================

const _amItemBufCache = new Map(); // itemId -> AudioBuffer

const AM_REF_RMS = 0.1;

function _amRms(buf) {
  let sumSq = 0;
  let nSamples = 0;
  const nCh = buf.numberOfChannels;
  for (let ch = 0; ch < nCh; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) sumSq += d[i] * d[i];
    nSamples += d.length;
  }
  if (nSamples === 0) return 0;
  return Math.sqrt(sumSq / nSamples);
}

function _amNormalizeBufferRms(buf, refRms) {
  const rms = _amRms(buf);
  if (rms <= 1e-9) return buf;
  const factor = refRms / rms;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= factor;
  }
  return buf;
}

async function amGetItemBuffer(ctx, item) {
  if (!item || !item.id) return null;
  const cached = _amItemBufCache.get(item.id);
  if (cached) return cached;

  let abuf = null;
  if (item.id.indexOf("gen:") === 0) {
    abuf = amGenerateNoiseBuffer(ctx, item.id);
  } else if (item.audio) {
    const r = await fetch(item.audio);
    const ab = await r.arrayBuffer();
    abuf = await ctx.decodeAudioData(ab);
  }
  if (!abuf) return null;

  _amItemBufCache.set(item.id, abuf);
  return abuf;
}

async function amGetNormalizedNoiseBuffer(ctx, item) {
  if (!item || !item.id) return null;
  const normKey = "norm:" + item.id;
  const cached = _amItemBufCache.get(normKey);
  if (cached) return cached;

  const orig = await amGetItemBuffer(ctx, item);
  if (!orig) return null;

  const copy = ctx.createBuffer(orig.numberOfChannels, orig.length, orig.sampleRate);
  for (let ch = 0; ch < orig.numberOfChannels; ch++) {
    copy.copyToChannel(orig.getChannelData(ch), ch);
  }
  _amNormalizeBufferRms(copy, AM_REF_RMS);
  _amItemBufCache.set(normKey, copy);
  return copy;
}

// ============================================================
// Pre-Mix mit Hintergrund-Geraeusch (BA194)
// ============================================================

const _amMixCache = new Map(); // key -> { buffer, lastUsed }
const AM_MIX_CACHE_MAX = 8;

function _amMixCacheKey(fgKey, bgId, snrDb) {
  return fgKey + "|" + bgId + "|" + snrDb;
}

function _amMixCacheTouch(key) {
  const hit = _amMixCache.get(key);
  if (hit) hit.lastUsed = Date.now();
  return hit ? hit.buffer : null;
}

function _amMixCachePut(key, buffer) {
  _amMixCache.set(key, { buffer: buffer, lastUsed: Date.now() });
  while (_amMixCache.size > AM_MIX_CACHE_MAX) {
    let oldestKey = null, oldestTime = Infinity;
    for (const [k, v] of _amMixCache) {
      if (v.lastUsed < oldestTime) { oldestTime = v.lastUsed; oldestKey = k; }
    }
    if (oldestKey) _amMixCache.delete(oldestKey);
    else break;
  }
}

function amMixForeground(ctx, fgKey, fgBuf, bgItem, bgBuf, snrDb) {
  if (!fgBuf) return null;
  if (!bgBuf || !bgItem) return fgBuf;
  const key = _amMixCacheKey(fgKey, bgItem.id, snrDb);
  const cached = _amMixCacheTouch(key);
  if (cached) return cached;

  const sr = fgBuf.sampleRate;
  const len = fgBuf.length;
  const nCh = Math.max(1, fgBuf.numberOfChannels);
  const out = ctx.createBuffer(nCh, len, sr);

  const bgFactor = Math.pow(10, -snrDb / 20);
  const bgLen = bgBuf.length;
  const bgNCh = bgBuf.numberOfChannels;

  for (let ch = 0; ch < nCh; ch++) {
    const fgD = fgBuf.getChannelData(ch);
    const bgD = bgBuf.getChannelData(ch < bgNCh ? ch : 0);
    const outD = out.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      let s = fgD[i] + bgD[i % bgLen] * bgFactor;
      if (s >  1.0) s =  1.0;
      else if (s < -1.0) s = -1.0;
      outD[i] = s;
    }
  }
  _amMixCachePut(key, out);
  return out;
}

function amMixCacheClear() {
  _amMixCache.clear();
}
