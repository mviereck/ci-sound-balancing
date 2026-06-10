# Bauanleitung 197 — Sätze auf Manifest-System umstellen + Titel-Fix

**Versionsbump:** `js/version.js` von `"3.2.196-beta"` (oder aktuellem
196-Fix-Stand) auf `"3.2.197-beta"`.

**Voraussetzung:** BA 196 muss durchgebaut sein.

## Ziel

Die Sätze-Quelle nutzt heute das alte `sCorpus`-Schema, das beim Laden
von `assets/sentences/sentences.json` (oder den Embed-Modulen)
befüllt wird. Webspace-Sätze (aus BA 196) erscheinen damit **nicht**
in der UI.

Diese BA bringt drei Dinge:

1. **Zwei neue Provider** in `js/audio-source.js`:
   `sentences-legacy` (exponiert das vorhandene `sCorpus`) und
   `sentences-local` (exponiert die lokalen User-Sammlungen aus
   BA 192). Damit landen alle Sätze-Quellen unter
   `amCollectItems("saetze")` — und Webspace-Sätze sind ebenfalls
   verfügbar.

2. **`sRefreshSpeakerDropdown`, `sBuildRecordingPool`, `sPlayCurrent`
   umstellen**, sodaß sie mit Items aus dem neuen Schema arbeiten
   (`item.audio`, `item.text`, `item.tags.speaker_id`, …). Die Sprecher-
   Aggregation findet zur Laufzeit aus den Items statt.

3. **Sätze-Titel-Fix** im Anzeige-Block: statt des Satz-Texts steht
   jetzt „Sammlung — Sprecher" als Titel (z. B. „Thorsten-Voice —
   Thorsten"). Der Satz-Text bleibt ausschließlich in der „Text
   anzeigen"-Box.

**Bewusst nicht in dieser BA:**
- Build-Skript-Änderungen (`scripts/build_embed.py`): die heutigen
  Embed-Module bleiben im alten Format und werden weiterhin durch
  `sLoadIfNeeded` in `sCorpus` geladen. Migration des Build-Skripts
  ist eine eigene Aufgabe außerhalb des Tool-Quelltexts.
- Sortier-Dropdown für Sätze in der UI: nur die Achsen-Definition wird
  in `audio-source.js` eingetragen, die UI-Aufnahme kommt mit einer
  späteren BA.
- Sprach-Filter im Sub-Block: das Sprecher-Dropdown filtert wie heute
  nach Tool-Sprache; eine zusätzliche Sprachwahl im Sub-Block kommt
  später (siehe IDEEN.md).

## Schritt 1: Sortier-Achsen für Sätze deklarieren

In `js/audio-source.js`, in `AM_SORT_AXES` (BA 193) den Sätze-Eintrag
ergänzen:

```js
AM_SORT_AXES.saetze = [
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
];
```

i18n-Strings dafür in `i18n/de.js`:

```js
amSortLang: "nach Sprache",
amSortSpeaker: "nach Sprecher",
amSortStyle: "nach Stil",
```

## Schritt 2: `sentences-legacy`-Provider in `js/sentences.js`

Am Ende von `sentences.js` ergänzen:

```js
// ============================================================
// BA197: sCorpus als amProvider exponieren
// ============================================================

if (typeof amRegisterProvider === "function") {
  amRegisterProvider({
    id: "sentences-legacy",
    listItems: function (category) {
      if (category !== "saetze") return [];
      if (!sLoaded || !sCorpus || !sCorpus.speakers) return [];
      const out = [];
      const speakers = sCorpus.speakers;
      for (const spkKey in speakers) {
        const spk = speakers[spkKey];
        if (!spk || !Array.isArray(spk.recordings)) continue;
        const speakerLabel  = spk.label || spkKey;
        const lang          = spk.lang || null;
        const sourceTitle   = spk.source || spk.label || "Eingebaut";
        const license       = spk.license || null;
        const credit        = spk.credit  || null;
        for (let i = 0; i < spk.recordings.length; i++) {
          const r = spk.recordings[i];
          if (!r || !r.audio) continue;
          out.push({
            id: "sentences-legacy:" + spkKey + ":" + (r.id || String(i)),
            title: speakerLabel,
            text: r.text || "",
            audio: r.audio,
            duration: r.duration,
            sourceTitle: sourceTitle,
            license: license,
            credit:  credit,
            tags: {
              lang: lang,
              speaker_id: spkKey,
              gender: spk.gender || "u",
              style: spk.style || null
            }
          });
        }
      }
      return out;
    }
  });
}
```

## Schritt 3: `sentences-local`-Provider in `js/sentences.js`

Ebenfalls am Ende, nach Schritt 2:

```js
if (typeof amRegisterProvider === "function") {
  amRegisterProvider({
    id: "sentences-local",
    listItems: function (category) {
      if (category !== "saetze") return [];
      if (!sLocalCollections || sLocalCollections.size === 0) return [];
      const out = [];
      for (const [cid, coll] of sLocalCollections) {
        // sLocalCollections-Struktur aus BA192: { label, lang, files: Map<relPath, File>,
        // recordings: [{id, text, audio, ...}] }
        // Falls die exakte Struktur abweicht, hier anpassen.
        const recs = Array.isArray(coll.recordings) ? coll.recordings : [];
        for (const r of recs) {
          if (!r || !r.audio) continue;
          out.push({
            id: "sentences-local:" + cid + ":" + (r.id || ""),
            title: coll.label || cid,
            text: r.text || "",
            audio: r.audio, // typischerweise "local:<cid>:<relPath>"
            sourceTitle: coll.label || cid,
            license: coll.license || null,
            credit:  coll.credit  || null,
            tags: {
              lang: coll.lang || null,
              speaker_id: cid,
              gender: r.gender || coll.gender || "u",
              style: coll.style || null
            }
          });
        }
      }
      return out;
    }
  });
}
```

**Hinweis für Sonnet:** die genaue Struktur von `sLocalCollections`-
Einträgen aus BA 192 muss beim Bauen verifiziert werden. Falls
Felder anders heißen (z. B. `coll.audioFiles` statt `coll.recordings`),
hier entsprechend anpassen. Bei Abweichung Rückfrage.

## Schritt 4: `sRefreshSpeakerDropdown` umstellen

In `js/sentences.js`, Funktion `sRefreshSpeakerDropdown` (Z. ~291):
die alte Logik holt Sprecher aus `sCorpus.speakers`. Neu: aus allen
Sätze-Items aggregieren.

```js
function sRefreshSpeakerDropdown() {
  const sel = document.getElementById("plSentSpeaker");
  if (!sel) return;
  const prev = sel.value;

  // Items aus allen Providern, gefiltert nach Tool-Sprache
  const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
  const curLang = (typeof lang !== "undefined") ? lang : "de";
  const itemsInLang = all.filter(function (it) {
    return it.tags && it.tags.lang === curLang;
  });

  // Sprecher-Map aufbauen (Reihenfolge stabil: nach erstem Auftreten)
  const speakerMap = new Map(); // speaker_id -> { label, sourceTitle }
  for (const it of itemsInLang) {
    const sid = it.tags.speaker_id || "unbekannt";
    if (!speakerMap.has(sid)) {
      speakerMap.set(sid, {
        label: it.title || sid,
        sourceTitle: it.sourceTitle || ""
      });
    }
  }

  while (sel.firstChild) sel.removeChild(sel.firstChild);

  const optAll = document.createElement("option");
  optAll.value = "any";
  optAll.textContent = (typeof t === "function") ? t("sentSpkAll") : "Alle";
  sel.appendChild(optAll);

  for (const [sid, meta] of speakerMap) {
    const opt = document.createElement("option");
    opt.value = sid;
    // Anzeige: "Label (Sammlung)" wenn Sammlung != Label
    opt.textContent = meta.sourceTitle && meta.sourceTitle !== meta.label
      ? (meta.label + " — " + meta.sourceTitle)
      : meta.label;
    sel.appendChild(opt);
  }

  if (Array.from(speakerMap.keys()).includes(prev) || prev === "any") {
    sel.value = prev;
  } else {
    sel.value = "any";
  }
}
```

## Schritt 5: `sBuildRecordingPool` umstellen

```js
function sBuildRecordingPool(spkSel) {
  const all = (typeof amCollectItems === "function") ? amCollectItems("saetze") : [];
  const curLang = (typeof lang !== "undefined") ? lang : "de";
  return all.filter(function (it) {
    if (!it.tags || it.tags.lang !== curLang) return false;
    if (spkSel === "any") return true;
    return it.tags.speaker_id === spkSel;
  });
}
```

## Schritt 6: `sPickRandom` und `sCurRec`-Schema

`sPickRandom` (Z. ~140) arbeitet heute mit Items vom Typ
`{rec: {...}, speakerKey: ...}`. Künftig sind Items direkt im neuen
Schema. Funktion vereinfachen:

```js
function sPickRandom(pool, exclude) {
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  let pick;
  do {
    pick = pool[Math.floor(Math.random() * pool.length)];
  } while (exclude && pick.id === exclude.id && pool.length > 1);
  return pick;
}
```

## Schritt 7: `sPlayCurrent` umstellen

In `sentences.js`, `sPlayCurrent` (Z. ~163) — vollständig ersetzen
durch:

```js
async function sPlayCurrent() {
  if (!sActive || !sCurRec) return;
  const audioRef = sCurRec.audio;
  if (!audioRef) { sStop(); return; }
  try {
    let arrayBuf;
    if (audioRef.indexOf("data:") === 0) {
      arrayBuf = sDataUrlToArrayBuffer(audioRef);
    } else if (audioRef.indexOf("local:") === 0) {
      // Form: "local:<cid>:<relPath>"
      const second = audioRef.indexOf(":", 6);
      const cid = audioRef.substring(6, second);
      const rel = audioRef.substring(second + 1);
      const coll = sLocalCollections.get(cid);
      if (!coll) throw new Error("Lokale Sammlung " + cid + " nicht (mehr) verfügbar");
      const file = coll.files.get(rel);
      if (!file) throw new Error("Datei " + rel + " nicht in Sammlung " + cid);
      arrayBuf = await file.arrayBuffer();
    } else if (/^(https?:|blob:)/i.test(audioRef)) {
      const res = await fetch(audioRef, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      arrayBuf = await res.arrayBuffer();
    } else {
      // Relativ — Alt-Verhalten: unter assets/sentences/ suchen.
      const res = await fetch("assets/sentences/" + audioRef);
      if (!res.ok) throw new Error("HTTP " + res.status);
      arrayBuf = await res.arrayBuffer();
    }
    const c = gPC();
    const decoded = await c.decodeAudioData(arrayBuf);
    if (!sActive) return;

    // BA194: Hintergrund-Geraeusch ggf. einmischen (Code aus BA 194 bleibt erhalten).
    let finalBuf = decoded;
    if (typeof plSentBgEnabled !== "undefined" && plSentBgEnabled
        && typeof plSentBgItemId !== "undefined" && plSentBgItemId
        && typeof amCollectItems === "function") {
      try {
        const allBg = amCollectItems("geraeusche");
        const bgItem = allBg.find(function (it) { return it.id === plSentBgItemId; });
        if (bgItem) {
          const bgBuf = await amGetNormalizedNoiseBuffer(c, bgItem);
          if (bgBuf) {
            const fgKey = audioRef;
            finalBuf = amMixForeground(c, fgKey, decoded, bgItem, bgBuf, plSentBgSnrDb);
          }
        }
      } catch (mixErr) {
        console.warn("[sentences] Hintergrund-Mix fehlgeschlagen:", mixErr);
        finalBuf = decoded;
      }
      if (!sActive) return;
    }

    sSentenceBuf = finalBuf;
    pSetPlaybackMode("sentence");
    pOff = 0;
    pDrawEQ();
    pBuildTbl();
    document.getElementById("plEqViz").style.display = "";
    sShownText = sCurRec.text || "";
    sUpdateTextBox();
    if (typeof plUpdDisplay === "function") plUpdDisplay();
    await pPlay();
  } catch (err) {
    console.error("[sentences] Wiedergabe-Fehler:", err);
    sStop();
  }
}
```

## Schritt 8: Sätze-Titel-Fix in `plUpdDisplay`

In `js/player.js`, im Sätze-Zweig von `plUpdDisplay` (aus BA 192/194)
die Zeile

```js
titleText = sCurRec.text || (typeof t === "function" ? t("plDispEmpty") : "—");
```

ersetzen durch:

```js
const speakerLabel = sCurRec.title || (sCurRec.tags && sCurRec.tags.speaker_id) || "";
const sourceLabel  = sCurRec.sourceTitle || "";
if (sourceLabel && speakerLabel && sourceLabel !== speakerLabel) {
  titleText = sourceLabel + " — " + speakerLabel;
} else if (speakerLabel) {
  titleText = speakerLabel;
} else if (sourceLabel) {
  titleText = sourceLabel;
} else {
  titleText = (typeof t === "function") ? t("plDispEmpty") : "Nichts geladen";
}
```

Außerdem die nachfolgende `metaParts`-Befüllung anpassen — heute werden
Sprecher, Quelle und Lizenz aus `sCorpus.speakers[spkKey]` gelesen.
Jetzt direkt aus `sCurRec.sourceTitle` und `sCurRec.license`:

```js
if (sCurRec.tags && sCurRec.tags.lang)   metaParts.push(sCurRec.tags.lang);
if (sCurRec.license)                      metaParts.push(sCurRec.license);
if (sCurRec.credit)                       metaParts.push(sCurRec.credit);
```

Die Satz-Text-Box (BA 192) bleibt unverändert; sie zieht den Text aus
`sCurRec.text` (statt früher `sCurRec.rec.text`). Sicherstellen, daß
die Stelle in `plUpdDisplay` entsprechend mit dem neuen Schema arbeitet:

```js
if (tx && plActiveSource === "sentences") {
  tx.textContent = (sCurRec && sCurRec.text) ? sCurRec.text : "";
}
```

## Schritt 9: weitere `sCurRec.rec.*`-Referenzen aufräumen

`sUpdateTextBox` und andere Stellen in `sentences.js` lesen heute
`sCurRec.rec.text` / `sCurRec.rec.audio`. Alle Zugriffe der Form
`sCurRec.rec.*` durch direkte Felder ersetzen:

- `sCurRec.rec.text` → `sCurRec.text`
- `sCurRec.rec.audio` → `sCurRec.audio`
- `sCurRec.speakerKey` → `sCurRec.tags.speaker_id`

Sonnet soll im Build `grep`en und alle Treffer migrieren, dann das
Verhalten testen.

## Schritt 10: Doku

### 10a. `docs/CODESTRUKTUR.md`

`js/sentences.js`: ergänzen, daß zwei amProvider registriert werden
(`sentences-legacy`, `sentences-local`). Sätze-Items werden über
`amCollectItems("saetze")` aus allen Quellen aggregiert (legacy, local,
embed, webspace).

`js/audio-source.js`: `AM_SORT_AXES.saetze` neu mit vier Achsen
(`lang`, `speaker`, `source`, `style`).

### 10b. `docs/spec/06-player.md`

Im Sätze-Abschnitt ergänzen:

```
- **Quellen-Aggregation (BA 197):** Sätze werden über das amProvider-
  System eingesammelt — `sentences-legacy` (heutige sCorpus-Quelle aus
  assets/sentences/sentences.json bzw. Embed), `sentences-local`
  (User-Uploads, BA 192), `embed` (BA 193), `webspace` (BA 196). Das
  Sprecher-Dropdown und der Wiedergabe-Pfad arbeiten ausschließlich
  mit Items aus `amCollectItems("saetze")`.
- **Titel-Anzeige:** im Anzeige-Block steht „Sammlung — Sprecher" als
  Titel (z. B. „Thorsten-Voice — Thorsten"). Der Satz-Text bleibt
  nur in der „Text anzeigen"-Box.
```

## Schritt 11: Versionsbump

```js
const APP_VERSION = "3.2.197-beta";
```

## Akzeptanztest

1. Tool laden. Version `3.2.197-beta`. **Erwartet:** ✓
2. Quelle „Sätze". Sprecher-Dropdown zeigt die heutigen Sprecher
   (Thorsten, Common Voice, …) plus alle Webspace-Sprecher der
   aktuellen Tool-Sprache. „Alle" als Default-Option oben. **Erwartet:** ✓
3. Play: ein zufälliger Satz spielt. Anzeige-Block zeigt als Titel
   „<Sammlung> — <Sprecher>" (nicht mehr den Satz-Text). **Erwartet:** ✓
4. „Text anzeigen" anhaken: Satz-Text erscheint in der eigenen Box —
   nicht doppelt im Titel. **Erwartet:** ✓
5. Sprecher im Dropdown auf einen Webspace-Sprecher umstellen, Play:
   Audio wird vom Webspace geladen und abgespielt. **Erwartet:** ✓
6. Tool-Sprache (z. B. Footer) umstellen — Sprecher-Dropdown
   aktualisiert sich auf die Sprecher der neuen Sprache. **Erwartet:** ✓
7. Lokale Sammlung über „+ Lokalen Ordner laden" aus BA 192 laden:
   Sprecher erscheint im Dropdown. Play funktioniert. **Erwartet:** ✓
8. Hintergrund-Geräusch aus BA 194 ist weiterhin nutzbar. SNR-Mischen
   arbeitet mit beliebiger Sätze-Quelle. **Erwartet:** ✓
9. Save (JSON) → neues Tab → Restore: zuletzt gewählter Sprecher
   stimmt; Auto-Advance / Loop / Pausen verhalten sich wie zuvor.
   **Erwartet:** ✓

## Selbstprüfungsauftrag

Jeden der 9 Punkte einzeln durchgehen. Zusätzlich:

- `js/sentences.js`: keine `sCurRec.rec.*`-Zugriffe mehr; alle Stellen
  arbeiten mit dem flachen Item-Schema.
- `js/audio-source.js`: `AM_SORT_AXES.saetze` mit vier Achsen.
- `sentences-legacy`- und `sentences-local`-Provider werden registriert
  und liefern bei Lade-Stand des Tools die richtigen Items (Zahl der
  Items pro Provider stimmt mit `sCorpus`-Inhalt bzw.
  `sLocalCollections`-Größe überein).
- `js/version.js` enthält `"3.2.197-beta"`.

## Folge-Bauanleitungen

- **BA 198:** i18n en/fr/es für alle Keys aus BA 192–197.
- **Spätere BAs:**
  - Sortier-Dropdown für Sätze in der UI (Achsen sind in 197 schon
    deklariert).
  - Sprach-Filter im Sätze-Sub-Block (unabhängig von Tool-Sprache).
  - Build-Skript-Umstellung der Embed-Module auf das neue Manifest-Schema
    — dann kann der `sentences-legacy`-Provider stillgelegt werden.
