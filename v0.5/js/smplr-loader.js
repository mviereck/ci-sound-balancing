// ============================================================
// SMPLR-LOADER — Lazy-Loader fuer smplr (Mellotron)
// ============================================================
// vendors/smplr/dist/smplr.esm.js wird per dynamic import() bei
// Bedarf geladen. Liefert Mellotron-Sampler-Instanzen als Singletons
// (Cache pro Token).
//
// Exportiert ins globale Scope:
//   smplrLoad()                          -> Promise<smplrModule>
//   smplrIsLoaded()                      -> boolean
//   loadMellotron(ctx, variant)          -> Promise<Instrument>
//   loadSamplerByToken(ctx, token)       -> Promise<Instrument>
//   smplrSamplerIsReady(token)           -> boolean
//   smplrLastError                       -> string|null
//
// Token-Schema (wird in BA 225 in toneType_freqmatch verwendet):
//   "smplr:mellotron:<variantName>"   variantName aus getMellotronNames()
//
// Soundfont2 wurde in 3.2.226.5-beta entfernt (race-anfaellig,
// Klang stumm, Mellotron deckt die Klangpalette ausreichend ab).

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
      const mod = await import("../vendors/smplr/dist/smplr.esm.js");
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
  return Promise.reject(new Error("Unbekannte smplr-Kategorie: " + kind));
}
