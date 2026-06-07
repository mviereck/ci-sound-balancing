// ============================================================
// SMPLR-LOADER — Lazy-Loader fuer smplr (Mellotron + Soundfont2)
// ============================================================
// vendors/smplr/dist/smplr.esm.js wird per dynamic import() bei
// Bedarf geladen. Liefert Mellotron- und Soundfont2-Sampler-
// Instanzen als Singletons (Cache pro Token).
//
// Erwartet, dass vendors/soundfont2/lib/SoundFont2.js per <script>
// in index.html vorher geladen wurde -> globales window.SoundFont2.
//
// Exportiert ins globale Scope:
//   SMPLR_SF2_KEYS                       readonly object key -> URL
//   smplrLoad()                          -> Promise<smplrModule>
//   smplrIsLoaded()                      -> boolean
//   loadMellotron(ctx, variant)          -> Promise<Instrument>
//   loadSoundfont2(ctx, key)             -> Promise<Sampler>
//   loadSamplerByToken(ctx, token)       -> Promise<Instrument|Sampler>
//   smplrSamplerIsReady(token)           -> boolean
//   smplrLastError                       -> string|null
//
// Token-Schema (wird in BA 225 in toneType_freqmatch verwendet):
//   "smplr:mellotron:<variantName>"   variantName aus getMellotronNames()
//   "smplr:sf2:<key>"                 key aus SMPLR_SF2_KEYS

const SMPLR_SF2_KEYS = Object.freeze({
  galaxy:   "https://smpldsnds.github.io/soundfonts/soundfonts/galaxy-electric-pianos.sf2",
  gigaMidi: "https://smpldsnds.github.io/soundfonts/soundfonts/giga-hq-fm-gm.sf2",
  supersaw: "https://smpldsnds.github.io/soundfonts/soundfonts/supersaw-collection.sf2"
});

let _smplrModule = null;
let _smplrLoadPromise = null;
let smplrLastError = null;

// token -> ready instance (nur Eintrag, wenn .load aufgeloest ist)
const _samplerCache = new Map();
// token -> Promise<instance> (waehrend des Ladens)
const _samplerLoading = new Map();

function smplrIsLoaded() {
  return _smplrModule !== null;
}

function smplrLoad() {
  if (_smplrModule) return Promise.resolve(_smplrModule);
  if (_smplrLoadPromise) return _smplrLoadPromise;

  _smplrLoadPromise = (async () => {
    try {
      const mod = await import("./vendors/smplr/dist/smplr.esm.js");
      _smplrModule = mod;
      smplrLastError = null;
      return mod;
    } catch (e) {
      const msg = "smplr ESM-Bundle konnte nicht geladen werden: "
        + (e && e.message ? e.message : String(e))
        + ". Laeuft das Tool ueber file://? Bitte lokalen Server "
        + "verwenden (python3 -m http.server).";
      smplrLastError = msg;
      throw new Error(msg);
    }
  })();

  _smplrLoadPromise.catch(() => { _smplrLoadPromise = null; });
  return _smplrLoadPromise;
}

function smplrSamplerIsReady(token) {
  return _samplerCache.has(token);
}

function loadMellotron(ctx, variant) {
  const token = "smplr:mellotron:" + variant;
  if (_samplerCache.has(token)) return Promise.resolve(_samplerCache.get(token));
  if (_samplerLoading.has(token)) return _samplerLoading.get(token);

  const p = (async () => {
    const mod = await smplrLoad();
    if (typeof mod.Mellotron !== "function") {
      throw new Error("smplr.Mellotron nicht im ESM-Bundle gefunden");
    }
    const instance = mod.Mellotron(ctx, { instrument: variant });
    await instance.load;
    _samplerCache.set(token, instance);
    return instance;
  })();

  _samplerLoading.set(token, p);
  p.catch(e => {
    smplrLastError = "Mellotron '" + variant + "' Laden fehlgeschlagen: "
      + (e && e.message ? e.message : String(e));
  }).finally(() => {
    _samplerLoading.delete(token);
  });
  return p;
}

function loadSoundfont2(ctx, key) {
  const url = SMPLR_SF2_KEYS[key];
  if (!url) return Promise.reject(new Error("Unbekannter SF2-Key: " + key));

  const token = "smplr:sf2:" + key;
  if (_samplerCache.has(token)) return Promise.resolve(_samplerCache.get(token));
  if (_samplerLoading.has(token)) return _samplerLoading.get(token);

  const p = (async () => {
    if (typeof window === "undefined" || typeof window.SoundFont2 !== "function") {
      throw new Error("window.SoundFont2 fehlt — "
        + "vendors/soundfont2/lib/SoundFont2.js nicht geladen?");
    }
    const mod = await smplrLoad();
    if (typeof mod.Soundfont2 !== "function") {
      throw new Error("smplr.Soundfont2 nicht im ESM-Bundle gefunden");
    }
    const sampler = mod.Soundfont2(ctx, {
      url,
      createSoundfont: (data) => new window.SoundFont2(data)
    });
    await sampler.load;
    // Default-Instrument (Index 0) laden — Modalbox-Eintrag spielt nur
    // dieses, Sub-Instrumente werden in BA 225/226 nicht angeboten.
    if (Array.isArray(sampler.instrumentNames) && sampler.instrumentNames.length > 0) {
      sampler.loadInstrument(sampler.instrumentNames[0]);
    }
    _samplerCache.set(token, sampler);
    return sampler;
  })();

  _samplerLoading.set(token, p);
  p.catch(e => {
    smplrLastError = "Soundfont2 '" + key + "' Laden fehlgeschlagen: "
      + (e && e.message ? e.message : String(e));
  }).finally(() => {
    _samplerLoading.delete(token);
  });
  return p;
}

function loadSamplerByToken(ctx, token) {
  if (typeof token !== "string" || !token.startsWith("smplr:")) {
    return Promise.reject(new Error("Kein smplr-Token: " + token));
  }
  const parts = token.split(":");
  if (parts.length < 3) {
    return Promise.reject(new Error("Token-Format ungueltig: " + token));
  }
  const kind = parts[1];
  const rest = parts.slice(2).join(":");
  if (kind === "mellotron") return loadMellotron(ctx, rest);
  if (kind === "sf2")       return loadSoundfont2(ctx, rest);
  return Promise.reject(new Error("Unbekannte smplr-Kategorie: " + kind));
}
