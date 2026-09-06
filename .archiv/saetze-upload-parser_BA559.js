/* archiviert 2026-09-06 aus Bauanleitung BA559 -- hartcodierter
 * datensatz-spezifischer Saetze-Upload-Parser (Freiburger-/Oldenburger-
 * Formaterkennung). Abgeloest zugunsten des tag-armen generischen
 * Ordner-Uploads (parallel-axes-Engine, Architektur SS6.3). Aufheben fuer
 * ein spaeteres datengetriebenes Upload-Metadaten-Konzept.
 * Die Datei ist NICHT eingebunden (kein <script> in index.html) --
 * reines Referenzmaterial.
 */

function sDetectFreiburger(audioFiles) {
  let mono = [], poly = [];
  for (const f of audioFiles) {
    const parts = f.webkitRelativePath.split("/");
    if (parts.length < 4) continue;
    const sub = parts[1];
    const listDir = parts[2];
    const name = parts[parts.length - 1];
    if (!/^Testliste_\d+$/i.test(listDir)) continue;
    if (!/^L\d+_W\d+_/i.test(name)) continue;
    if (/Einsilbig/i.test(sub)) mono.push(f);
    else if (/Mehrsilbig/i.test(sub)) poly.push(f);
  }
  if (mono.length === 0 && poly.length === 0) return null;
  return { mono, poly };
}

function sDetectOldenburger(audioFiles) {
  const matched = [];
  let femaleCount = 0, maleCount = 0;
  for (const f of audioFiles) {
    const name = f.name;
    const m = /_OLSA(female|male)?_TTS\.wav$/i.exec(name);
    if (!m) continue;
    matched.push(f);
    if (m[1] && m[1].toLowerCase() === "female") femaleCount++;
    else if (m[1] && m[1].toLowerCase() === "male") maleCount++;
  }
  if (matched.length === 0) return null;
  let variant = "generic";
  if (femaleCount > 0 && maleCount === 0) variant = "female";
  else if (maleCount > 0 && femaleCount === 0) variant = "male";
  return { variant, files: matched };
}

async function sLoadOldenburgerManifest(allFiles) {
  for (const f of allFiles) {
    if (/sentences_OLSA.*\.txt$/i.test(f.name)) {
      const txt = await f.text();
      return sParseOldenburgerManifest(txt);
    }
  }
  return new Map();
}

function sParseOldenburgerManifest(text) {
  const map = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^﻿/, "");
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const filename = line.substring(0, idx).trim();
    const sentence = line.substring(idx + 1).trim();
    if (filename && sentence) map.set(filename, sentence);
  }
  return map;
}

function sBuildFreiburgerRecordings(files, cid) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, "");
    const parts = base.split("_");
    const text = parts.length >= 3 ? parts.slice(2).join(" ") : base;
    out.push({
      id: "fb-" + (++n),
      text: text,
      audio: "local:" + cid + ":" + f.webkitRelativePath,
    });
  }
  return out;
}

function sBuildOldenburgerRecordings(files, textMap, cid) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const text = textMap.get(f.name) || "";
    out.push({
      id: "olsa-" + (++n),
      text: text,
      audio: "local:" + cid + ":" + f.webkitRelativePath,
    });
  }
  return out;
}
