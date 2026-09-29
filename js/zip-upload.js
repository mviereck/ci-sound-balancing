// ============================================================
// ZENTRALER ZIP-UPLOAD (Architektur 00-filterkette Paragraph 6.4)
// Ein Entpack-/Erkenn-/Einsortier-Weg fuer alle Upload-Stellen
// (Player-Upload-Stage aller Kategorien + Sprachtest-Button, BA 623).
//
// Kaskade:
//   1. Matrix-Material erkannt -> Matrix-Sammlung (Saetze + Rauschen
//      ueber test_set verklammert).
//   2. sonst Audios -> gewoehnlicher Upload der Kategorie.
//   3. kein Audio -> Fehler.
//
// fflate ist global (index.html laedt vendors/fflate/fflate.min.js).
// ============================================================

// --- ZIP (auch inneres Satz-ZIP) flach entpacken -> Map<basename, Uint8Array>
function zu_unzipAll(bytes) {
  var top = fflate.unzipSync(bytes);
  var out = {};
  Object.keys(top).forEach(function (name) { out[zu_baseName(name)] = top[name]; });
  // Verschachteltes Format: inneres .zip erkennen und mitentpacken.
  Object.keys(top).forEach(function (name) {
    if (/\.zip$/i.test(zu_baseName(name))) {
      var inner = fflate.unzipSync(top[name]);
      Object.keys(inner).forEach(function (iname) { out[zu_baseName(iname)] = inner[iname]; });
    }
  });
  return out;
}

function zu_baseName(p) {
  var s = p.replace(/\\/g, "/");
  var i = s.lastIndexOf("/");
  return i >= 0 ? s.substring(i + 1) : s;
}

// --- Begleittext "<id>.wav : <Satz>" -> Map<dateiname, text>
function zu_parseSentenceText(bytes) {
  var txt = new TextDecoder("utf-8").decode(bytes);
  var map = {};
  txt.split(/\r?\n/).forEach(function (line) {
    var m = line.match(/^\s*([^:]+?\.wav)\s*:\s*(.+?)\s*$/i);
    if (m) map[m[1].trim()] = m[2].trim();
  });
  return map;
}

// --- Matrix-Erkennung. Rueckgabe: null (keine Matrix) oder
//     { test_set, test_type, speaker_id, speaker_name, gender,
//       license, credit, textName, noiseName }
// Zwei Wege:
//   (a) OLSA-female hart: sentences_OLSAfemale*TTS.txt + stereonoise_OLSAfemale_TTS.wav
//   (b) tags.json mit Pflichtfeldern test_type/test_set/license
function zu_detectMatrix(files) {
  var names = Object.keys(files);
  var noiseName = names.find(function (n) {
    return /\.wav$/i.test(n) && /stereonoise|rauschen/i.test(n);
  });
  var txtName = names.find(function (n) { return /\.txt$/i.test(n) && /^sentences_/i.test(n); })
             || names.find(function (n) { return /\.txt$/i.test(n); });

  // (a) OLSA-female: feste Signatur (unveraenderliches Fremdmaterial)
  var isOlsa = names.some(function (n) { return /^sentences_OLSAfemale.*TTS\.txt$/i.test(n); })
            && names.some(function (n) { return /^stereonoise_OLSAfemale_TTS\.wav$/i.test(n); });
  if (isOlsa) {
    return {
      test_type: "matrix",
      test_set: "olsa-weiblich",          // technischer Slug, kein Anzeigename
      speaker_id: "olsa-female",
      speaker_name: "OLSA-weiblich",
      gender: "w",
      synthetic: "y",
      sentence_form: "whole",
      license: "CC-BY-NC-SA-4.0",
      credit: "Oldenburger Satztest (OLSA), VirtualSpeaker (Acapela), Zenodo",
      textName: txtName,
      noiseName: noiseName
    };
  }

  // (b) tags.json mit Pflichtfeldern
  var tagsName = names.find(function (n) { return /^tags\.json$/i.test(n); });
  if (tagsName) {
    var meta = null;
    try { meta = JSON.parse(new TextDecoder("utf-8").decode(files[tagsName])); }
    catch (e) { meta = null; }
    if (meta && meta.test_type === "matrix" && meta.license && meta.sentence_form) {
      var spName = meta.speaker_name || meta.name || "Unbekannt";
      var tsSlug = meta.test_set ? zu_slug(String(meta.test_set)) : zu_slug(spName);
      return {
        test_type: "matrix",
        test_set: tsSlug,
        speaker_id: meta.speaker_id || null,
        speaker_name: spName,
        gender: meta.gender || null,
        synthetic: meta.synthetic || null,
        sentence_form: String(meta.sentence_form),
        license: String(meta.license),
        credit: meta.credit || spName,
        textName: txtName,
        noiseName: noiseName
      };
    }
  }
  return null;
}

// --- Eine erkannte Matrix in den Pool einsortieren (Saetze + Rauschen).
//     Nutzt die vorhandenen Provider-Datencontainer:
//       Saetze:    sLocalCollections (Provider sentences-local)
//       Geraeusche: amNoiseRegisterMatrixNoise (schmaler Eingang, 1.2)
//     Rueckgabe: { test_set } bei Erfolg, sonst wirft es (Aufrufer faengt).
function zu_ingestMatrix(files, det) {
  if (!det.textName || !files[det.textName]) throw new Error(zu_t("zuErrNoText"));
  if (!det.noiseName || !files[det.noiseName]) throw new Error(zu_t("zuErrNoNoise"));
  var textMap = zu_parseSentenceText(files[det.textName]);

  var names = Object.keys(files);
  var wavNames = names.filter(function (n) {
    return /\.wav$/i.test(n) && n !== det.noiseName;
  });
  if (wavNames.length < 30) throw new Error(zu_t("zuErrTooFewSentences"));

  // Saetze als getrennte lokale Sammlung (eigener cid je Upload).
  var cid = "matrix-" + zu_slug(det.test_set);
  var filesMap = new Map();
  var recordings = [];
  wavNames.forEach(function (wn, i) {
    var f = new File([files[wn]], wn, { type: "audio/wav" });
    filesMap.set(wn, f);
    recordings.push({
      id: "m-" + (i + 1),
      text: textMap[wn] || "",
      audio: "local:" + cid + ":" + wn
    });
  });
  sLocalCollections.set(cid, {
    id: cid,
    label: det.test_set,
    lang: "de",
    lang_any: "y",
    kind: "matrix-upload",
    folderName: det.test_set,
    files: filesMap,
    recordings: recordings,
    // Diese Felder liest der Provider sentences-local (BA 623 Punkt 2):
    testSet: det.test_set,
    testType: det.test_type,
    speakerId: det.speaker_id,
    speakerName: det.speaker_name,
    gender: det.gender,
    synthetic: det.synthetic || null,
    sentenceForm: det.sentence_form || null,
    style: "test",
    license: det.license,
    credit: det.credit
  });

  // Rauschen als Geraeusche-Upload-Item mit test_set-Verklammerung.
  var noiseFile = new File([files[det.noiseName]], det.noiseName, { type: "audio/wav" });
  amNoiseRegisterMatrixNoise(noiseFile, det);

  if (typeof sUpdateUI === "function") sUpdateUI();
  if (typeof amAfterSourceChange === "function") amAfterSourceChange();
  return { test_set: det.test_set };
}

function zu_slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function zu_t(key) { return (typeof t === "function") ? t(key) : key; }

// --- Zentraler Einstieg fuer einen ZIP-Upload.
//     category: "saetze" | "musik" | "geraeusche" | "hoerbuecher"
//     opts.matrixOnly: true -> nur Matrix akzeptieren, sonst Fehler
//       (Sprachtest, BA 623). Default false (Player: normaler Fallback).
//     opts.onNormalAudio(fileObjs, category): Rueckfall fuer Nicht-Matrix-Audios
//       (der Aufrufer reicht den kategorie-eigenen Upload-Weg herein).
//     Rueckgabe: Promise< {kind:"matrix", test_set} | {kind:"audio", count} >
//     Wirft bei Fehler (Aufrufer zeigt Meldung).
async function zuHandleZipUpload(file, category, opts) {
  opts = opts || {};
  var bytes = new Uint8Array(await file.arrayBuffer());
  var files;
  try { files = zu_unzipAll(bytes); }
  catch (e) { throw new Error(zu_t("zuErrUnzip")); }

  var det = zu_detectMatrix(files);
  if (det) {
    var res = zu_ingestMatrix(files, det);
    return { kind: "matrix", test_set: res.test_set };
  }

  if (opts.matrixOnly) throw new Error(zu_t("zuErrNotMatrix"));

  // Nicht-Matrix: Audiodateien an den kategorie-eigenen Upload reichen.
  var audioBytes = Object.keys(files).filter(function (n) {
    return /\.(wav|mp3|ogg|flac|m4a|mp4)$/i.test(n);
  });
  if (audioBytes.length === 0) throw new Error(zu_t("zuErrNoAudio"));
  var fileObjs = audioBytes.map(function (n) {
    return new File([files[n]], n, { type: "application/octet-stream" });
  });
  if (typeof opts.onNormalAudio === "function") {
    await opts.onNormalAudio(fileObjs, category);
  }
  return { kind: "audio", count: fileObjs.length };
}
