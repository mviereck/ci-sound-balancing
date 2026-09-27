// ============================================================
// SPRACHTEST — Upload-Bündel (Architektur §3.3)
// Entpackt ein hochgeladenes OLSA-ZIP im Browser (fflate), erzeugt daraus
// ein Testbündel: Sätze als getrennte lokale Satz-Quelle (test_set="olsa",
// echter Satztext), Matrix aus dem Begleittext, Störgeräusch als Buffer.
// Sitzungsweise: nichts wird persistiert.
// ============================================================

// Registry aller verfügbaren Bündel. Das mitgelieferte ist immer dabei;
// ein Upload fügt sein Bündel hinzu. BA 612 liest diese Liste für die Auswahl.
let ST_bundles = [ ST_BUNDLE_BUILTIN ];   // ST_BUNDLE_BUILTIN aus sprachtest.js

// Feste Kennung des Upload-Bündels (nur eines gleichzeitig; erneuter Upload
// ersetzt es).
const ST_OLSA_BUNDLE_ID = "olsa";
const ST_OLSA_TEST_SET  = "olsa";

// --- ZIP entpacken (beide Zenodo-Formate, §3.3) ---
// Eingabe: File (das hochgeladene ZIP). Ausgabe: flache Map name->Uint8Array
// ALLER Satz-WAVs + Begleittext + Störgeräusch. Erkennt ein inneres Satz-ZIP
// und entpackt es zusätzlich.
async function _stu_unzipAll(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const top = fflate.unzipSync(buf);        // { name: Uint8Array }
  const out = {};
  Object.keys(top).forEach(function (name) { out[baseName(name)] = top[name]; });

  // Verschachteltes Format: inneres Satz-ZIP erkennen und mitentpacken.
  Object.keys(top).forEach(function (name) {
    const bn = baseName(name);
    if (/\.zip$/i.test(bn)) {
      const inner = fflate.unzipSync(top[name]);
      Object.keys(inner).forEach(function (iname) {
        out[baseName(iname)] = inner[iname];
      });
    }
  });
  return out;

  function baseName(p) {
    const i = p.replace(/\\/g, "/").lastIndexOf("/");
    return i >= 0 ? p.substring(i + 1) : p;
  }
}

// --- Begleittext parsen: Zeilen "<id>.wav : <Satz>." -> Map id.wav -> text ---
function _stu_parseSentenceText(bytes) {
  const txt = new TextDecoder("utf-8").decode(bytes);
  const map = {};
  txt.split(/\r?\n/).forEach(function (line) {
    const m = line.match(/^\s*([^:]+?\.wav)\s*:\s*(.+?)\s*$/i);
    if (m) map[m[1].trim()] = m[2].trim();
  });
  return map;
}

// --- Aus der entpackten Map das Upload-Bündel bauen ---
// Legt die getrennte Satz-Sammlung an (sLocalCollections), dekodiert das
// Störgeräusch, leitet die Matrix aus den Satztexten ab. Wirft bei fehlenden
// Bestandteilen (kein Begleittext / keine Sätze / kein Rauschen).
async function ST_buildOlsaBundleFromZip(file) {
  const files = await _stu_unzipAll(file);
  const names = Object.keys(files);

  // Begleittext (die .txt mit "id.wav : Satz").
  const txtName = names.find(function (n) { return /\.txt$/i.test(n); });
  if (!txtName) throw new Error(t("stUploadErrNoText"));
  const textMap = _stu_parseSentenceText(files[txtName]);

  // Satz-WAVs (alle *.wav außer dem Störgeräusch).
  const noiseName = names.find(function (n) { return /stereonoise|rauschen/i.test(n) && /\.wav$/i.test(n); });
  const wavNames = names.filter(function (n) {
    return /\.wav$/i.test(n) && n !== noiseName;
  });
  if (wavNames.length < 30) throw new Error(t("stUploadErrTooFewSentences"));
  if (!noiseName) throw new Error(t("stUploadErrNoNoise"));

  // Getrennte lokale Satz-Sammlung anlegen (Provider sentences-local baut
  // daraus Pool-Items mit _file). WICHTIG: eigener cid (nicht "upload"),
  // test_set="olsa", echter Satztext je Recording.
  const cid = "olsa-upload";
  const filesMap = new Map();     // relPath -> File
  const recordings = [];
  wavNames.forEach(function (wn, i) {
    // File-Objekt aus den Bytes bauen (der _file-Ladeweg in amGetItemBuffer
    // ruft .arrayBuffer() -> ein echtes File/Blob genuegt).
    const f = new File([files[wn]], wn, { type: "audio/wav" });
    filesMap.set(wn, f);
    recordings.push({
      id: "olsa-" + (i + 1),
      text: textMap[wn] || "",        // ECHTER Satztext (nicht Dateiname!)
      audio: "local:" + cid + ":" + wn
    });
  });

  sLocalCollections.set(cid, {
    id: cid,
    label: "OLSA female (Upload)",
    lang: "de",
    lang_any: "y",
    kind: "olsa-upload",
    folderName: "OLSA female (Upload)",
    files: filesMap,
    recordings: recordings,
    testSet: ST_OLSA_TEST_SET,
    license: "CC-BY-NC-SA-4.0"
  });
  if (typeof sUpdateUI === "function") sUpdateUI();

  // Störgeräusch dekodieren.
  const ctx = (typeof gPC === "function") ? gPC() : null;
  let noiseBuf = null;
  if (ctx) noiseBuf = await ctx.decodeAudioData(files[noiseName].buffer.slice(0));

  // Matrix aus den Satztexten ableiten (§3.2). st_extractMatrix erwartet
  // Items mit .text; wir bauen Pseudo-Items aus textMap.
  const matrixItems = wavNames.map(function (wn) { return { text: textMap[wn] || "" }; });
  const matrix = st_extractMatrix(matrixItems);

  // Bündel-Objekt (gleiche Form wie ST_BUNDLE_BUILTIN, §3).
  const bundle = {
    id: ST_OLSA_BUNDLE_ID,
    label: "OLSA female (Upload)",
    validated: true,
    testSet: ST_OLSA_TEST_SET,
    noiseUrl: null,          // kein fetch — Buffer direkt
    noiseBuf: noiseBuf,
    uploadMatrix: matrix     // BA 612: Auswahl aktiviert dieses Bündel
  };

  // In die Registry (nur ein Upload-Bündel; ersetzt ein frueheres).
  ST_bundles = ST_bundles.filter(function (b) { return b.id !== ST_OLSA_BUNDLE_ID; });
  ST_bundles.push(bundle);
  return bundle;
}
