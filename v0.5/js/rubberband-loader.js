// ============================================================
// RUBBERBAND-LOADER — Lazy-Loader fuer rubberband-wasm@3.3.0
// ============================================================
// Geladen nach vendors/rubberband-wasm/dist/index.umd.min.js, das ein
// globales `rubberband`-Objekt mit RubberBandInterface bereitstellt.
// Exportiert ins globale Scope:
//   rubberbandLoad()      → Promise<RubberBandInterface>
//   rubberbandIsLoaded()  → boolean
//   rubberbandLastError   → string|null (nach Fehler gesetzt)
//
// Der Loader fetcht beim ersten Aufruf
// vendors/rubberband-wasm/dist/rubberband.wasm, compiliert das Modul
// und liefert eine initialisierte RubberBandInterface-Instanz.
// Folge-Aufrufe geben dieselbe Instanz zurueck (Singleton).

let _rbInterface = null;
let _rbLoadPromise = null;
let rubberbandLastError = null;

function rubberbandIsLoaded() {
  return _rbInterface !== null;
}

function rubberbandLoad() {
  if (_rbInterface) return Promise.resolve(_rbInterface);
  if (_rbLoadPromise) return _rbLoadPromise;

  _rbLoadPromise = (async () => {
    if (typeof rubberband === "undefined" || !rubberband.RubberBandInterface) {
      const msg = "Rubberband-UMD nicht geladen (vendors/rubberband-wasm/dist/index.umd.min.js fehlt im Script-Array?)";
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let resp;
    try {
      resp = await fetch("vendors/rubberband-wasm/dist/rubberband.wasm");
    } catch (e) {
      // Typisch unter file:// in Chromium: TypeError "Failed to fetch"
      const msg = "WASM-Datei konnte nicht geladen werden. Das Tool laeuft moeglicherweise unter file:// in einem Browser, der lokales fetch() blockiert. Bitte ueber einen lokalen Server starten (z.B. `python3 -m http.server`).";
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    if (!resp.ok) {
      const msg = "WASM-Fetch fehlgeschlagen: HTTP " + resp.status;
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let bytes;
    try {
      bytes = await resp.arrayBuffer();
    } catch (e) {
      const msg = "WASM-Datei lesen fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    let module;
    try {
      module = await WebAssembly.compile(bytes);
    } catch (e) {
      const msg = "WASM-Compile fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    try {
      _rbInterface = await rubberband.RubberBandInterface.initialize(module);
    } catch (e) {
      const msg = "RubberBandInterface.initialize() fehlgeschlagen: " + (e && e.message ? e.message : e);
      rubberbandLastError = msg;
      throw new Error(msg);
    }

    rubberbandLastError = null;
    return _rbInterface;
  })();

  // Bei Fehler den Cache-Promise zuruecksetzen, damit ein erneuter
  // Aufruf einen neuen Versuch ausloest (z.B. nachdem der Nutzer das
  // Tool unter http:// statt file:// neu geoeffnet hat).
  _rbLoadPromise.catch(() => { _rbLoadPromise = null; });

  return _rbLoadPromise;
}
