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
  ],
  // BA197: Sätze-Sortier-Achsen
  saetze: [
    {
      key: "lang",
      labelKey: "amSortLang",
      labelDefault: "nach Sprache",
      getter: function (it) { return (it.tags && it.tags.lang) || "zzz-unbekannt"; }
    },
    {
      key: "speaker",
      labelKey: "amSortSpeaker",
      labelDefault: "nach Sprecher",
      getter: function (it) { return (it.tags && it.tags.speaker_id) || "zzz-unbekannt"; }
    },
    {
      key: "source",
      labelKey: "amSortSource",
      labelDefault: "nach Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; }
    },
    {
      key: "style",
      labelKey: "amSortStyle",
      labelDefault: "nach Stil",
      getter: function (it) { return (it.tags && it.tags.style) || "zzz-unbekannt"; }
    }
  ],
  // BA260: Musik-Sortier-Achsen
  musik: [
    {
      key: "title",
      labelKey: "amSortTitle",
      labelDefault: "nach Titel",
      getter: function (it) { return (it.title || "").toLowerCase(); }
    },
    {
      key: "artist",
      labelKey: "amSortArtist",
      labelDefault: "nach Artist",
      getter: function (it) { return ((it.tags && it.tags.artist) || "zzz-unbekannt").toLowerCase(); }
    },
    {
      key: "album",
      labelKey: "amSortAlbum",
      labelDefault: "nach Album",
      getter: function (it) { return ((it.tags && it.tags.album) || "zzz-unbekannt").toLowerCase(); }
    },
    {
      key: "genre",
      labelKey: "amSortGenre",
      labelDefault: "nach Genre",
      getter: function (it) {
        const g = it.tags && it.tags.genres;
        if (Array.isArray(g) && g.length) return g[0];
        return "zzz-unbekannt";
      }
    },
    {
      key: "year",
      labelKey: "amSortYear",
      labelDefault: "nach Jahr",
      getter: function (it) {
        const y = it.tags && it.tags.year;
        return (typeof y === "number") ? String(y) : "zzzz";
      }
    },
    {
      key: "source",
      labelKey: "amSortSource",
      labelDefault: "nach Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; }
    }
  ]
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

// BA260: Eindeutige Kategorien fuer eine Sortier-Achse.
// Beruecksichtigt Multi-Value-Tags (z.B. genres: ["pop","rock"] -> beide).
// Liefert sortierte Liste; "(alle)" wird nicht enthalten (UI fuegt es selbst hinzu).
function amBucketsForAxis(category, axisKey, items) {
  const axes = amSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; });
  if (!axis) return [];
  const set = new Set();
  // Spezialfall: Achsen, deren zugrundeliegendes Tag selbst ein Array
  // ist (heute genres). Hier explizit alle Array-Werte aufnehmen.
  const arrayTags = { genre: function (it) { return (it.tags && it.tags.genres) || []; } };
  for (const it of items) {
    const arr = arrayTags[axisKey] ? arrayTags[axisKey](it) : null;
    if (Array.isArray(arr) && arr.length) {
      for (const v of arr) set.add(String(v));
    } else {
      const v = axis.getter(it);
      if (v && v !== "zzz-unbekannt" && v !== "zzzz") set.add(String(v));
    }
  }
  return Array.from(set).sort(function (a, b) {
    return a.localeCompare(b);
  });
}

// BA260: Pruefen, ob ein Item zu einer Kategorie passt (Multi-Value-faehig).
function amItemMatchesCategory(category, axisKey, cat, item) {
  if (!cat || cat === "_all") return true;
  if (axisKey === "genre") {
    const g = (item.tags && item.tags.genres) || [];
    return Array.isArray(g) && g.indexOf(cat) >= 0;
  }
  const axes = amSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; });
  if (!axis) return true;
  return String(axis.getter(item)) === String(cat);
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

// ============================================================
// Collection-Ebene (BA195)
// ============================================================

const AM_COLLECTION_SORT_AXES = {
  hoerbuecher: [
    {
      key: "author",
      labelKey: "amBookSortAuthor",
      labelDefault: "nach Autor",
      getter: function (c) {
        return (c.tags && c.tags.work_author) || "zzz-unbekannt";
      }
    },
    {
      key: "genre",
      labelKey: "amBookSortGenre",
      labelDefault: "nach Genre",
      getter: function (c) {
        const g = c.tags && c.tags.genres;
        return Array.isArray(g) && g.length > 0 ? g[0] : "zzz-unbekannt";
      }
    },
    {
      key: "lang",
      labelKey: "amBookSortLang",
      labelDefault: "nach Sprache",
      getter: function (c) {
        return c.lang || "zzz-unbekannt";
      }
    },
    {
      key: "reader",
      labelKey: "amBookSortReader",
      labelDefault: "nach Sprecher",
      getter: function (c) {
        return (c.tags && c.tags.reader) || "zzz-unbekannt";
      }
    },
    {
      key: "title",
      labelKey: "amBookSortTitle",
      labelDefault: "nach Titel",
      getter: function (c) {
        return (c.title || "zzz-unbekannt").toLowerCase();
      }
    }
  ]
};

function amCollectionSortAxesFor(category) {
  return AM_COLLECTION_SORT_AXES[category] || [];
}

function amCollectCollections(category) {
  const out = [];
  for (const p of AM_PROVIDERS) {
    if (typeof p.listCollections !== "function") continue;
    try {
      const cols = p.listCollections(category);
      if (Array.isArray(cols)) {
        for (const c of cols) {
          if (!c) continue;
          c._providerId = p.id;
          out.push(c);
        }
      }
    } catch (e) {
      console.warn("[audio-source] provider " + p.id + " listCollections warf:", e);
    }
  }
  return out;
}

function amSortCollections(collections, category, axisKey) {
  const axes = amCollectionSortAxesFor(category);
  const axis = axes.find(function (a) { return a.key === axisKey; }) || axes[0];
  if (!axis) return collections.slice();
  const arr = collections.slice();
  arr.sort(function (a, b) {
    const va = axis.getter(a), vb = axis.getter(b);
    if (va < vb) return -1;
    if (va > vb) return 1;
    const ta = (a.title || "").toLowerCase();
    const tb = (b.title || "").toLowerCase();
    return ta < tb ? -1 : (ta > tb ? 1 : 0);
  });
  return arr;
}

// ============================================================
// Provider: lokale Hoerbuch-Uploads (BA195)
// ============================================================

const _amLocalBookCollections = [];

function amAddLocalBookCollection(col) {
  if (!col || col.category !== "hoerbuecher") return;
  _amLocalBookCollections.push(col);
}

function amRemoveLocalBookCollection(id) {
  const idx = _amLocalBookCollections.findIndex(function (c) { return c.id === id; });
  if (idx >= 0) {
    const removed = _amLocalBookCollections[idx];
    for (const it of (removed.items || [])) {
      if (it.audio && it.audio.indexOf("blob:") === 0) {
        try { URL.revokeObjectURL(it.audio); } catch (e) {}
      }
    }
    _amLocalBookCollections.splice(idx, 1);
  }
}

amRegisterProvider({
  id: "local-books",
  listItems: function (category) {
    return [];
  },
  listCollections: function (category) {
    if (category !== "hoerbuecher") return [];
    return _amLocalBookCollections.slice();
  }
});

// ============================================================
// Webspace-Manifest-Loader (BA196)
// ============================================================

// Manifeste leben im Repo (relativ zum Tool-HTML), nicht im Webspace.
// Audio-URLs werden weiterhin ueber amWebspaceRoot() aufgeloest.
function amManifestRoot() {
  return "audio.manifest/";
}

// Konfigurierbar ueber window.CI_SB_WEBSPACE_ROOT vor Lade-Beginn.
const AM_WEBSPACE_ROOT_DEFAULT = "http://ci-sound-balancing.honigburg.de/opus/";

function amWebspaceRoot() {
  const r = (typeof window !== "undefined" && window.CI_SB_WEBSPACE_ROOT)
    ? window.CI_SB_WEBSPACE_ROOT
    : AM_WEBSPACE_ROOT_DEFAULT;
  return r.endsWith("/") ? r : (r + "/");
}

const _amWebspace = {
  indexLoaded: false,
  failed: false,
  sources: [],                 // aus index.json
  loaded: new Map(),           // sourceKey -> { source, manifests: {cat: [collection,...]} }
  pendingRefresh: new Set()    // Kategorien, deren UI nach erfolgreichem Laden refreshet werden soll
};

async function amWebspaceLoadIndex() {
  if (_amWebspace.indexLoaded || _amWebspace.failed) return;
  const url = amManifestRoot() + "index.json";
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    _amWebspace.sources = Array.isArray(data.sources) ? data.sources : [];
    _amWebspace.indexLoaded = true;
    console.log("[audio-source/webspace] Index geladen: " + _amWebspace.sources.length + " Quellen.");
  } catch (e) {
    console.warn("[audio-source/webspace] Index nicht erreichbar (" + url + "):", e.message);
    _amWebspace.failed = true;
  }
}

async function amWebspaceLoadSource(srcKey) {
  if (_amWebspace.failed) return null;
  if (_amWebspace.loaded.has(srcKey)) return _amWebspace.loaded.get(srcKey);
  const meta = _amWebspace.sources.find(function (s) { return s.key === srcKey; });
  if (!meta) return null;

  const root = amWebspaceRoot();
  let source = null;
  try {
    const srcUrl = amManifestRoot() + meta.source;
    const r = await fetch(srcUrl, { mode: "cors" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    source = await r.json();
  } catch (e) {
    console.warn("[audio-source/webspace] source.json " + srcKey + " fehlgeschlagen:", e.message);
    return null;
  }

  const manifests = {};
  const cats = (source.manifests && typeof source.manifests === "object") ? source.manifests : {};
  for (const cat of Object.keys(cats)) {
    manifests[cat] = [];
    const list = Array.isArray(cats[cat]) ? cats[cat] : [];
    for (const mfPath of list) {
      const mfUrl = amManifestRoot() + srcKey + "/" + mfPath;
      try {
        const mr = await fetch(mfUrl, { mode: "cors" });
        if (!mr.ok) throw new Error("HTTP " + mr.status);
        const mf = await mr.json();
        // Indizes (Pointer) hier ignorieren — BA196 unterstuetzt nur collections direkt.
        if (mf.kind === "collection") manifests[cat].push(mf);
      } catch (e) {
        console.warn("[audio-source/webspace] Manifest " + mfPath + " fehlgeschlagen:", e.message);
      }
    }
  }

  const entry = { meta: meta, source: source, manifests: manifests };
  _amWebspace.loaded.set(srcKey, entry);
  return entry;
}

function _amResolveAudioUrl(rawAudio, sourceBase) {
  if (!rawAudio) return null;
  if (/^(data:|https?:|blob:)/i.test(rawAudio)) return rawAudio;
  const root = amWebspaceRoot();
  const base = sourceBase || "";
  return root + base + rawAudio;
}

// Collection-Top-Level-Felder, die als Tag-Defaults auf jedes Item
// vererbt werden. Aufloesungs-Reihenfolge: it.tags > col.tags >
// col-Top-Level > source-Top-Level.
const _AM_COLLECTION_TAG_DEFAULTS = ["lang", "license", "credit", "url"];
const _AM_SOURCE_TAG_DEFAULTS     = ["license", "credit"];

function _amBuildItemTags(item, col, source) {
  const tags = {};
  if (source) {
    for (const k of _AM_SOURCE_TAG_DEFAULTS) {
      if (source[k] != null) tags[k] = source[k];
    }
  }
  if (col) {
    for (const k of _AM_COLLECTION_TAG_DEFAULTS) {
      if (col[k] != null) tags[k] = col[k];
    }
  }
  if (col && col.tags) Object.assign(tags, col.tags);
  if (item && item.tags) Object.assign(tags, item.tags);
  return tags;
}

// --- Provider-Eintrag fuer Webspace ---

amRegisterProvider({
  id: "webspace",
  listItems: function (category) {
    const out = [];
    if (!_amWebspace.indexLoaded) return out;
    for (const [srcKey, entry] of _amWebspace.loaded) {
      const cols = entry.manifests[category] || [];
      for (const col of cols) {
        // Hoerbuecher gehen ueber listCollections, nicht ueber Items
        if (category === "hoerbuecher") continue;
        for (const it of (col.items || [])) {
          out.push({
            id: srcKey + ":" + (col.title || "") + "/" + (it.id || ""),
            title: it.title || it.id || "(unbenannt)",
            audio: _amResolveAudioUrl(it.audio, entry.source.base),
            duration: it.duration,
            sourceTitle: entry.meta.name || entry.source.name || srcKey,
            license: it.license || entry.source.license || entry.meta.license,
            credit:  it.credit  || entry.source.credit,
            tags: _amBuildItemTags(it, col, entry.source)
          });
        }
      }
    }
    return out;
  },
  listCollections: function (category) {
    if (category !== "hoerbuecher") return [];
    const out = [];
    if (!_amWebspace.indexLoaded) return out;
    for (const [srcKey, entry] of _amWebspace.loaded) {
      const cols = entry.manifests["hoerbuecher"] || [];
      for (const col of cols) {
        const id = "webspace-book:" + srcKey + ":" + (col.title || "");
        out.push({
          schema: col.schema,
          kind: "collection",
          category: "hoerbuecher",
          id: id,
          title: col.title || srcKey,
          lang: col.lang || null,
          tags: col.tags || {},
          license: entry.source.license || entry.meta.license,
          credit:  entry.source.credit,
          items: (col.items || []).map(function (it, i) {
            return {
              id: id + "#" + (it.id || ("ch" + (i+1))),
              title: it.title || ("Kapitel " + (i+1)),
              audio: _amResolveAudioUrl(it.audio, entry.source.base),
              duration: it.duration,
              tags: _amBuildItemTags(it, col, entry.source)
            };
          })
        });
      }
    }
    return out;
  }
});

// ============================================================
// BA260: lokaler Musik-File-Provider
// ============================================================
// Eine einzige hochgeladene Datei wird als Musik-Item gefuehrt.
// Beim naechsten Upload wird der Eintrag ersetzt. Audio-Dekodierung
// passiert weiterhin im plAudio-change-Handler des Players;
// dieser Provider liefert nur das Metadaten-Item.

let _amMusicLocalFile = null;     // { name, audio: "local-music-file:<name>" } | null

function amMusicLocalSetFile(file) {
  if (!file) { _amMusicLocalFile = null; return null; }
  const id = "local-music-file:" + file.name;
  _amMusicLocalFile = {
    id: id,
    title: file.name.replace(/\.[^.]+$/, ""),
    audio: id,           // markiert, dass der Player den File-Buffer direkt verwendet
    sourceTitle: "Eigener Upload",
    license: null,
    credit: null,
    tags: {
      artist: "",
      album: "",
      genres: [],
      year: null,
      source_local: "y"
    },
    _file: file          // privat: das File-Objekt zur Wiedergabe
  };
  return _amMusicLocalFile;
}

function amMusicLocalCurrent() {
  return _amMusicLocalFile;
}

amRegisterProvider({
  id: "music-local-file",
  listItems: function (category) {
    if (category !== "musik") return [];
    return _amMusicLocalFile ? [_amMusicLocalFile] : [];
  }
});

function amWebspaceBootstrap() {
  amWebspaceLoadIndex().then(function () {
    if (_amWebspace.failed) return;
    // Pro Source nachladen — parallel, aber pro Erfolg ein UI-Refresh.
    for (const meta of _amWebspace.sources) {
      amWebspaceLoadSource(meta.key).then(function (entry) {
        if (!entry) return;
        const cats = Array.isArray(meta.categories) ? meta.categories : [];
        for (const cat of cats) {
          if (cat === "geraeusche") {
            if (typeof plNoiseRefreshUI    === "function") plNoiseRefreshUI();
            if (typeof plSentBgRefreshUI   === "function") plSentBgRefreshUI();
          } else if (cat === "hoerbuecher") {
            if (typeof plBookRefreshUI     === "function") plBookRefreshUI();
          } else if (cat === "saetze") {
            // Wird in BA 197 relevant, sobald Saetze ueber amCollectItems gehen.
            if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
          } else if (cat === "musik") {
            // Keine UI-Sub-Block-Liste fuer Musik in dieser BA — kommt spaeter.
          }
        }
      });
    }
  });
}
