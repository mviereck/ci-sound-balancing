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

// BA348: Stempel-Cache fuer die Listen-Aggregation (ersetzt den Tick-Cache
// aus BA347). amCollectItems/amCollectCollections und die Saetze-Pools
// werden pro Bedien-Klick 7-37x aufgerufen; der teure Aufbau (Objektbau,
// encodeURI, Tag-Vererbung, Sortierung von >25000 Saetze-Items) lief bisher
// 1x PRO KLICK neu. Jetzt haelt der Cache das Ergebnis SITZUNGSWEIT und baut
// nur neu, wenn sich die Datenlage aendert.
//
// Die Datenaenderung wird ueber einen billigen Fingerabdruck (_amDataStamp)
// aller VERAENDERLICHEN Quellen erkannt. Aendert sich der Stempel (Bibliothek
// nachgeladen, Datei/Ordner/Sammlung hochgeladen, Saetze-Korpus fertig
// geladen), wird neu gebaut -- ohne dass eine Schreibstelle den Cache
// explizit invalidieren muss.
//
// Stempel-Korrektheit (WICHTIG, nicht aendern ohne diese Punkte zu pruefen):
//  - Ordner/Sammlungen (Maps/Arrays) sind rein ADDITIV (BA323 entfernte alle
//    Remove-Knoepfe) -> size/length als Stempel-Teil genuegt.
//  - Lokale Einzeldateien (Musik/Geraeusche) sind seit BA349/350 SAMMELND:
//    sie wandern in eine feste Ordner-Sammlung cid "upload" und wachsen Stueck
//    fuer Stueck. Deren Map-`.size` aendert sich dabei nicht -> der Stempel
//    nutzt _amLocalFileCount (Summe der Dateien ueber alle Sammlungen) statt
//    `.size`, sonst bliebe die zweite hochgeladene Datei unsichtbar.
//  - sLocalCollections lebt in sentences.js (laedt nach audio-source.js)
//    -> typeof-Guard, da _amDataStamp evtl. vor sentences.js aufgerufen wird.
//  - embed (CI_SB_EMBED) und generated (AM_GEN_NOISES) sind statisch beim
//    Seitenladen -> bewusst NICHT im Stempel.
let _amCache = new Map();   // key -> { stamp, value }

// BA349: Gesamtzahl der Dateien ueber alle lokalen Sammlungen (fuer den
// Cache-Stempel: die "upload"-Sammlung waechst, ihre .size aendert sich nicht).
function _amLocalFileCount(map) {
  var n = 0;
  if (map && map.forEach) map.forEach(function (coll) {
    if (coll && coll.files && typeof coll.files.size === "number") n += coll.files.size;
  });
  return n;
}

// Materialquelle: "online" (Webspace) | "offline" (eingebetteter Bestand).
// Default online; NICHT persistiert (Reload -> online).
var amSourceMode = "online";

function amGetSourceMode() { return amSourceMode; }

// Nachgeladene Embed-Bundles (Lazy). Der Zaehler geht in _amDataStamp,
// damit amCollectItems nach einem Nachladen neu baut.
var _amEmbedLoaded = new Set();   // Basissprachen, deren Bundle geladen ist
var _amEmbedLoading = new Set();  // gerade ladend (verhindert Doppel-Load)

function amEnsureEmbedBundle(lang) {
  var base = (typeof _amBaseLang === "function") ? _amBaseLang(lang) : String(lang || "").split("-")[0];
  if (!base) return;
  if (_amEmbedLoaded.has(base) || _amEmbedLoading.has(base)) return;
  _amEmbedLoading.add(base);
  var s = document.createElement("script");
  s.src = "assets/audio-embed/" + base + ".js";
  s.onload = function () {
    _amEmbedLoading.delete(base);
    _amEmbedLoaded.add(base);
    amAfterSourceChange();   // Stempel hat sich geaendert -> Listen neu
  };
  s.onerror = function () {
    _amEmbedLoading.delete(base);
    // Kein Bundle fuer diese Sprache: kein Fehler, offline bleibt leer.
    console.warn("[audio-source] kein Embed-Bundle fuer", base);
  };
  document.head.appendChild(s);
}

// UI/Cache nach einer Quellen-/Bundle-Aenderung auffrischen.
function amAfterSourceChange() {
  if (typeof sUpdateUI === "function") sUpdateUI();
  if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
  if (typeof plNoiseRefreshUI === "function") plNoiseRefreshUI();
  if (typeof plBookRefreshUI === "function") plBookRefreshUI();
}

// Zentraler Setter. Aendert den Modus, laedt im Offline-Modus das Bundle
// der aktuellen Inhalts-Sprache lazy nach (§3), und loest den
// UI-Refresh der Kategorien aus. Kein anderer Ort schreibt amSourceMode.
function amSetSourceMode(mode) {
  if (mode !== "online" && mode !== "offline") return;
  if (mode === amSourceMode) return;
  amSourceMode = mode;
  if (mode === "offline") {
    var lang = (typeof plGetContentLang === "function") ? plGetContentLang() : "de";
    amEnsureEmbedBundle(lang);   // async; refresht selbst nach dem Laden
  }
  amAfterSourceChange();
}

function _amDataStamp() {
  return [
    amSourceMode,
    _amEmbedLoaded.size,
    _amWebspace.loaded.size,
    _amLocalFileCount(_amMusicLocalFolders),
    _amLocalFileCount(_amNoiseLocalFolders),
    _amLocalBookCollections.length,
    (typeof sLocalCollections !== "undefined" && sLocalCollections) ? _amLocalFileCount(sLocalCollections) : 0
  ].join("|");
}

function _amCacheGet(key, build) {
  const stamp = _amDataStamp();
  const hit = _amCache.get(key);
  if (hit && hit.stamp === stamp) return hit.value;
  const value = build();
  _amCache.set(key, { stamp: stamp, value: value });
  return value;
}

function amCollectItems(category) {
  return _amCacheGet("items:" + category, function () {
  const out = [];
  const mode = amSourceMode;   // "online" | "offline"
  for (const p of AM_PROVIDERS) {
    // Quellen-Modus: online blendet embed aus, offline blendet webspace aus.
    // Uploads/generierte Provider sind in beiden Modi sichtbar.
    if (mode === "online"  && p.id === "embed")    continue;
    if (mode === "offline" && p.id === "webspace") continue;
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
  });
}

// Anzeige-Label eines Sprecher-Rohwerts (speaker_id) ueber Muster statt
// Einzel-Keys. Praefix -> uebersetzbarer Wortbaustein (t()) + Roh-ID-Zahl.
// Unbekannt -> Rohwert (Fallback). Architektur §10.
function _amSpeakerLabel(v) {
  if (!v) return v;
  var tr = function (k, d) { return (typeof t === "function") ? t(k) || d : d; };
  // Feste Einzelwerte zuerst.
  if (v === "thorsten")        return tr("plSpeaker_thorsten", "Thorsten");
  if (v === "crowdsourced")    return tr("plSpeaker_crowdsourced", "Crowdsourced");
  if (v === "freiburger-mono") return tr("plSpeaker_freiburgerMono", "Freiburger einsilbig");
  if (v === "freiburger-poly") return tr("plSpeaker_freiburgerPoly", "Freiburger mehrsilbig");
  if (v === "olsa-female")     return tr("plSpeaker_olsaFemale", "OLSA (weiblich)");
  // Muster mit Nummer aus der Roh-ID.
  var m;
  m = v.match(/^aru-id0*(\d+)$/);
  if (m) return tr("plSpeaker_aru", "ARU-Sprecher") + " " + m[1];
  m = v.match(/^mls-fr-(\d+)$/);
  if (m) return tr("plSpeaker_mlsFr", "Frz. Vorleser") + " " + m[1];
  m = v.match(/^mls-es-(\d+)$/);
  if (m) return tr("plSpeaker_mlsEs", "Span. Vorleser") + " " + m[1];
  m = v.match(/^mls-pl-(\d+)$/);
  if (m) return tr("plSpeaker_mlsPl", "Poln. Vorleser") + " " + m[1];
  return v;   // Fallback: Rohwert
}

// Anzeige-Titel eines Geraeusch-Items in der aktuellen UI-Sprache.
// Format B: it.title ist das Original (meist EN); Uebersetzungen liegen
// in it.tags.title_<lang> (de/fr/es). Fehlt die Uebersetzung (oder ist
// die UI-Sprache EN), faellt die Anzeige auf das Original zurueck, dann
// auf die Id. it.title selbst bleibt unangetastet (Suche/Sortierung
// nutzen weiter das Original bzw. beides).
function _amNoiseTitleLabel(it) {
  if (!it) return "";
  var uiLang = (typeof lang !== "undefined") ? lang : "de";
  var tr = it.tags && it.tags["title_" + uiLang];
  return tr || it.title || it.id || "";
}

// Basissprache eines BCP-47-artigen Codes: alles vor dem ersten "-".
// "de" -> "de", "zh-CN" -> "zh", "rm-sursilv" -> "rm". Leer -> "".
function _amBaseLang(code) {
  if (!code) return "";
  return String(code).split("-")[0];
}

// Sprachvariante (Subtag) eines BCP-47-artigen Codes: alles NACH dem
// ersten "-". "de" -> "", "zh-TW" -> "TW", "rm-sursilv" -> "sursilv".
function _amLangVariant(code) {
  if (!code) return "";
  var s = String(code);
  var i = s.indexOf("-");
  return i < 0 ? "" : s.substring(i + 1);
}

// --- Sortier-Achsen ---
// Pro Kategorie eine Liste. Ein Eintrag = eine Achse.
const AM_SORT_AXES = {
  // Geraeusche-Filterachsen (parallele Kette). valueOf = Filterwert;
  // Reihenfolge = Box-Reihenfolge (parallelAxes in PL_FILTER_DECL.geraeusche).
  geraeusche: [
    {
      key: "source", labelKey: "plNoiseAxisSource", labelDefault: "Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; },
      valueOf: function (it) { return it.sourceTitle || ""; }
    },
    {
      key: "kind", labelKey: "plNoiseAxisKind", labelDefault: "Art",
      getter: function (it) { return (it.tags && it.tags.kind) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.kind) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plNoiseKind_" + v) : v; }
    },
    {
      key: "spectrum", labelKey: "plNoiseAxisSpectrum", labelDefault: "Spektrum",
      getter: function (it) { return (it.tags && it.tags.spectrum) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.spectrum) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plNoiseSpectrum_" + v) : v; }
    },
    {
      key: "stationary", labelKey: "plNoiseAxisStationary", labelDefault: "Zeitverlauf",
      getter: function (it) { return (it.tags && it.tags.stationary) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.stationary) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plNoiseStationary_" + v) : v; }
    },
    {
      key: "loop_safe", labelKey: "plNoiseAxisLoopSafe", labelDefault: "Loopbar",
      getter: function (it) { return (it.tags && it.tags.loop_safe) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.loop_safe) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plNoiseLoopSafe_" + v) : v; }
    }
  ],
  // BA558: Saetze-Achsen (vollstaendig, Konzept-Reihenfolge).
  // valueOf = Filterwert (kann von Sortier-getter abweichen).
  // bucketLabel = i18n-Anzeige eines Werts (Default Rohwert).
  saetze: [
    {
      key: "lang", labelKey: "plAxisLang", labelDefault: "Sprache",
      getter: function (it) { return (it.tags && it.tags.lang) || "zzz-unbekannt"; }
    },
    {
      key: "variant", labelKey: "plAxisVariant", labelDefault: "Sprachvariante",
      getter: function (it) { return _amLangVariant((it.tags && it.tags.lang) || "") || "zzz-unbekannt"; },
      valueOf: function (it) { return _amLangVariant((it.tags && it.tags.lang) || ""); },
      bucketLabel: function (v) { return (typeof t === "function") ? (t("plVariant_" + v) || v) : v; }
    },
    {
      key: "source", labelKey: "plAxisSource", labelDefault: "Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; },
      valueOf: function (it) { return it.sourceTitle || ""; }
    },
    {
      key: "gender", labelKey: "plAxisGender", labelDefault: "Geschlecht",
      getter: function (it) { return (it.tags && it.tags.gender) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.gender) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plAxisGender_" + v) : v; }
    },
    {
      key: "speaker", labelKey: "plAxisSpeaker", labelDefault: "Sprecher",
      getter: function (it) { return (it.tags && it.tags.speaker_id) || "zzz-unbekannt"; },
      // Sprecher-Fallback: speaker_id ODER book_title (MLS-Vorlesungen).
      valueOf: function (it) {
        return (it.tags && (it.tags.speaker_id || it.tags.book_title)) || "";
      },
      bucketLabel: function (v) { return _amSpeakerLabel(v); }
    },
    {
      key: "style", labelKey: "plAxisStyle", labelDefault: "Aufnahme-Art",
      getter: function (it) { return (it.tags && it.tags.style) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.style) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plAxisStyle_" + v) : v; }
    },
    {
      key: "test_set", labelKey: "plAxisTestSet", labelDefault: "Testsatz-Sammlung",
      getter: function (it) { return (it.tags && it.tags.test_set) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.test_set) || ""; }
    },
    {
      key: "accent", labelKey: "plAxisAccent", labelDefault: "Akzent",
      getter: function (it) { return (it.tags && it.tags.accent) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.accent) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plAxisAccent_" + v) : v; }
    },
    {
      key: "emotion", labelKey: "plAxisEmotion", labelDefault: "Emotion",
      getter: function (it) { return (it.tags && it.tags.emotion) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.emotion) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plAxisEmotion_" + v) : v; }
    }
  ],
  // Musik-Filterachsen (parallele Kette, Architektur §9.1).
  // valueOf = Filterwert; getter bleibt fuer stabile Sekundaer-Sortierung.
  // Reihenfolge = Box-Reihenfolge (parallelAxes in PL_FILTER_DECL.musik).
  musik: [
    {
      key: "source", labelKey: "plMusicAxisSource", labelDefault: "Quelle",
      getter: function (it) { return it.sourceTitle || it._providerId || "zzz-unbekannt"; },
      valueOf: function (it) { return it.sourceTitle || ""; },
      // "(lokal)"-Markierung fuer hochgeladene Quellen (source_local="y").
      // Einzeldatei-Sammlung -> eigener Text; Ordner -> "<Name> (lokal)".
      bucketLabel: function (v) { return _plMusicSourceLabel(v); }
    },
    {
      key: "genre", labelKey: "plMusicAxisGenre", labelDefault: "Genre",
      multi: true,
      getter: function (it) {
        var g = it.tags && it.tags.genres;
        if (Array.isArray(g) && g.length) return g[0];
        return "zzz-unbekannt";
      },
      valueOf: function (it) { return (it.tags && it.tags.genres) || []; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plMusicGenre_" + v) : v; }
    },
    {
      key: "vocal", labelKey: "plMusicAxisVocal", labelDefault: "Gesang",
      getter: function (it) { return (it.tags && it.tags.vocal) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.vocal) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plMusicVocal_" + v) : v; }
    },
    {
      key: "artist", labelKey: "plMusicAxisArtist", labelDefault: "Kuenstler",
      getter: function (it) { return ((it.tags && it.tags.artist) || "zzz-unbekannt").toLowerCase(); },
      valueOf: function (it) { return (it.tags && it.tags.artist) || ""; }
    },
    {
      key: "composer", labelKey: "plMusicAxisComposer", labelDefault: "Komponist",
      getter: function (it) { return ((it.tags && it.tags.composer) || "zzz-unbekannt").toLowerCase(); },
      valueOf: function (it) { return (it.tags && it.tags.composer) || ""; }
    },
    {
      key: "album", labelKey: "plMusicAxisAlbum", labelDefault: "Album",
      getter: function (it) { return ((it.tags && it.tags.album) || "zzz-unbekannt").toLowerCase(); },
      valueOf: function (it) { return (it.tags && it.tags.album) || ""; }
    }
  ],
  // Hoerbuch-Filterachsen (parallele Kette auf COLLECTIONS, nicht Items;
  // die parallel-axes-Stage laeuft mit basis:"collections"). Die Werte
  // stehen als vorberechnete Tags im Manifest (length_band/epoch vom
  // Builder), damit der Code nichts rechnen muss.
  hoerbuecher: [
    {
      key: "genre", labelKey: "plBookAxisGenre", labelDefault: "Genre",
      multi: true,
      getter: function (c) {
        var g = c.tags && c.tags.genres;
        if (Array.isArray(g) && g.length) return g[0];
        return "zzz-unbekannt";
      },
      valueOf: function (c) { return (c.tags && c.tags.genres) || []; },
      // Genre-Rohwerte (englische LibriVox-Namen, Freitext mit Leerzeichen/&)
      // via i18n uebersetzen. Der Key wird aus dem Rohwert geslugt
      // (_amGenreKey), damit er ein gueltiger JS-Property-Name ist. Fehlender
      // Key -> englischer Rohwert (t() faellt auf den Default zurueck).
      bucketLabel: function (v) {
        if (typeof t !== "function") return v;
        var tr = t("plBookGenre_" + _amGenreKey(v));
        return (tr && tr.indexOf("plBookGenre_") !== 0) ? tr : v;
      }
    },
    {
      key: "fiction", labelKey: "plBookAxisFiction", labelDefault: "Art",
      getter: function (c) { return (c.tags && c.tags.fiction) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.fiction) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookFiction_" + v) : v; }
    },
    {
      key: "author", labelKey: "plBookAxisAuthor", labelDefault: "Autor",
      getter: function (c) { return (c.tags && c.tags.work_author) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.work_author) || ""; }
    },
    {
      key: "reader", labelKey: "plBookAxisReader", labelDefault: "Sprecher",
      getter: function (c) { return (c.tags && c.tags.reader) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.reader) || ""; }
    },
    {
      key: "epoch", labelKey: "plBookAxisEpoch", labelDefault: "Epoche",
      getter: function (c) { return (c.tags && c.tags.epoch) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.epoch) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookEpoch_" + v) : v; }
    },
    {
      key: "length", labelKey: "plBookAxisLength", labelDefault: "Länge",
      getter: function (c) { return (c.tags && c.tags.length_band) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.length_band) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookLength_" + v) : v; }
    },
    {
      key: "has_text", labelKey: "plBookAxisText", labelDefault: "Text",
      getter: function (c) { return (c.tags && c.tags.has_text) ? "y" : "n"; },
      valueOf: function (c) { return (c.tags && c.tags.has_text) ? "y" : "n"; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookText_" + v) : v; }
    }
  ]
};

// Slug eines Genre-Rohwerts fuer den i18n-Key: lowercase, jede Folge von
// Nicht-Alphanumerik -> "_". "Action & Adventure Fiction" ->
// "action_adventure_fiction". Muss mit der Key-Erzeugung in i18n/*.js
// uebereinstimmen (build der plBookGenre_-Keys).
function _amGenreKey(raw) {
  return String(raw || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function amSortAxesFor(category) {
  return AM_SORT_AXES[category] || [];
}

// Filter-/Gruppierungswert einer Achse fuer ein Item (EINZELWERT-Zugang).
// valueOf hat Vorrang; sonst getter. Leerwert -> "" (tag-frei).
// Fuer multi-Achsen den Listen-Zugang amAxisValues nutzen, nicht diese.
function amAxisValueOf(axis, item) {
  var raw;
  if (Object.prototype.hasOwnProperty.call(axis, "valueOf") && typeof axis.valueOf === "function") raw = axis.valueOf(item);
  else raw = axis.getter(item);
  return _amNormAxisValue(raw);
}

// Werteliste einer Achse fuer ein Item -> IMMER ein Array von
// Nicht-Leerwerten (Strings). Einwertige Achse: 0 oder 1 Element.
// multi-Achse (axis.multi === true): 0..n Elemente (Vereinigung aller
// Array-Eintraege). Leeres Array = tag-frei ("ohne"). Dies ist der
// einzige Ort, der einwertig/multi unterscheidet; Match, Box-Befuellung
// und Sichtbarkeit gehen ueber diese Liste (Architektur §3.4).
function amAxisValues(axis, item) {
  var raw;
  if (Object.prototype.hasOwnProperty.call(axis, "valueOf") && typeof axis.valueOf === "function") raw = axis.valueOf(item);
  else raw = axis.getter(item);

  if (axis.multi === true) {
    // multi: raw soll ein Array sein; jeder Eintrag wird normalisiert,
    // Leerwerte/Platzhalter fallen raus.
    if (!Array.isArray(raw)) raw = (raw === null || raw === undefined || raw === "") ? [] : [raw];
    var out = [];
    for (var i = 0; i < raw.length; i++) {
      var s = _amNormAxisValue(raw[i]);
      if (s !== "") out.push(s);
    }
    return out;
  }

  // einwertig: ein normalisierter Wert oder leer.
  var v = _amNormAxisValue(raw);
  return v === "" ? [] : [v];
}

// Normalisiert einen Rohwert auf String; Leerwerte und die einachsigen
// Sortier-Platzhalter ("zzz-unbekannt"/"zzzz") gelten als tag-frei ("").
function _amNormAxisValue(raw) {
  if (raw === null || raw === undefined) return "";
  var s = String(raw);
  if (s === "zzz-unbekannt" || s === "zzzz") return "";
  return s;
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

// Sonderwerte der Auswahl-Tabelle.
var AM_SEL_ALL = "_all";
var AM_SEL_ANY = "_any";     // nur Items MIT einem Wert dieser Achse
var AM_SEL_NONE = "_none";

// Mehrachsen-Match: Item passt, wenn es fuer JEDE Achse in axes zur
// Auswahl in selTable passt. selTable: { axisKey: gewaehlterWert }.
// Fehlt ein Key in selTable, gilt "_all" (kein Filter).
// Optionaler Parameter exceptKey: diese eine Achse beim Test auslassen
// (fuer die Box-Befuellung: "alle anderen Achsen ausser mir").
function amItemMatchesAxes(axes, selTable, item, exceptKey) {
  for (var i = 0; i < axes.length; i++) {
    var axis = axes[i];
    if (exceptKey && axis.key === exceptKey) continue;
    var sel = selTable[axis.key];
    if (sel === undefined || sel === AM_SEL_ALL) continue;   // kein Filter
    var vals = amAxisValues(axis, item);                     // Liste (einwertig 0/1, multi 0..n)
    if (sel === AM_SEL_ANY) {
      if (vals.length === 0) return false;                   // nur Items MIT Wert
    } else if (sel === AM_SEL_NONE) {
      if (vals.length !== 0) return false;                   // nur tag-frei
    } else {
      if (vals.indexOf(sel) < 0) return false;               // Wert muss enthalten sein
    }
  }
  return true;
}

// Werteliste einer Achse aus einer bereits (durch die anderen Achsen)
// gefilterten Item-Menge. Liefert { values: [...sortiert], hasNone: bool,
// hasSome: bool }. hasSome = es gibt Items MIT Wert; hasNone = es gibt
// Items OHNE Wert (tag-frei). "_none" wird nur angeboten, wenn beides.
function amBucketsForAxisValues(axis, items) {
  var set = new Set();
  var hasNone = false;
  var hasSome = false;
  for (var i = 0; i < items.length; i++) {
    var vals = amAxisValues(axis, items[i]);   // Liste (einwertig 0/1, multi 0..n)
    if (vals.length === 0) { hasNone = true; }
    else {
      hasSome = true;
      for (var j = 0; j < vals.length; j++) set.add(vals[j]);
    }
  }
  // Nach ANGEZEIGTEM Label sortieren (nicht nach Rohwert), damit die
  // sichtbare Reihenfolge alphabetisch ist (z.B. "Klassik" bei K statt
  // "westernart" am Ende). Ohne bucketLabel faellt das Label auf den
  // Rohwert zurueck -> Verhalten unveraendert.
  var values = Array.from(set).sort(function (a, b) {
    return amAxisBucketLabel(axis, a).localeCompare(amAxisBucketLabel(axis, b));
  });
  return { values: values, hasNone: hasNone, hasSome: hasSome };
}

// Anzeigetext eines Achsenwerts. bucketLabel hat Vorrang (i18n-Lookup
// im Tool), sonst Rohwert. Fuer die Sonderwerte liefert der Aufrufer
// eigene Labels ("alle"/"ohne"), nicht diese Funktion.
function amAxisBucketLabel(axis, value) {
  if (typeof axis.bucketLabel === "function") {
    var l = axis.bucketLabel(value);
    if (l) return l;
  }
  return value;
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
      const colTitle = col.title || key;
      const items = Array.isArray(col.items) ? col.items : [];
      for (const it of items) {
        out.push({
          id: key + ":" + (it.id || ""),
          title: it.title || it.id || "(unbenannt)",
          text: it.text || "",
          audio: it.audio,
          duration: it.duration,
          sourceTitle: colTitle,
          license: it.license || col.license || null,
          credit:  it.credit  || col.credit  || null,
          tags: _amBuildItemTags(it, col, null)
        });
      }
    }
    return out;
  }
});

// ============================================================
// Item-Buffer-Cache + RMS-Normalisierung (BA194)
// ============================================================

// Grundsatz: es gibt immer nur EIN Audio. Wird gewechselt, wird das alte
// vollständig verworfen — kein Aussortieren mehrerer paralleler Aufträge, kein
// Generationszähler. amCancelLoad bricht den laufenden Download ab; der
// abgebrochene fetch wirft AbortError und seine Promise-Kette stirbt von selbst,
// bevor sie pSetPlaybackMode erreicht. Nur EIN Ladevorgang läuft je Zeit.
// _amLoadAbort: AbortController des aktuell laufenden fetch (oder null).
let _amLoadAbort = null;

// Von einem Wechsel (neues Stück / Kategorie / Stopp) gerufen: verwirft den
// laufenden Ladevorgang — bricht den Download ab und stößt den Abbruch einer
// laufenden Warp-Berechnung an.
function amCancelLoad() {
  if (_amLoadAbort) {
    try { _amLoadAbort.abort(); } catch (e) {}
    _amLoadAbort = null;
  }
  if (typeof pWarpCancelCompute === "function") pWarpCancelCompute();
}

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
  } else if (item._file instanceof File) {
    // Generischer lokaler Ladeweg: das Item traegt sein File-Objekt direkt.
    // Gilt fuer jeden Upload jeder Kategorie -- kein kategorie-spezifisches
    // Praefix, kein blob:-Umweg. Die kategorie-eigenen Sammlungen bleiben
    // Besitzer der Files; die Ladestelle kennt sie nicht.
    const ab = await item._file.arrayBuffer();
    abuf = await ctx.decodeAudioData(ab);
  } else if (item.audio) {
    // Abbrechbarer Download. Ein Wechsel ruft amCancelLoad() -> abort(). Der
    // abgebrochene fetch wirft AbortError; wir fangen ihn hier und geben null
    // zurück ("abgebrochen = kein Buffer" = wie "nichts geladen"). So braucht
    // KEIN Aufrufer AbortError-Wissen — alle prüfen schon auf leeren Buffer.
    // Kein Generationszähler nötig: es läuft nur EIN Load.
    _amLoadAbort = new AbortController();
    try {
      const r = await fetch(item.audio, { signal: _amLoadAbort.signal });
      const ab = await r.arrayBuffer();
      abuf = await ctx.decodeAudioData(ab);
    } catch (e) {
      if (e && e.name === "AbortError") return null;   // Wechsel während Laden
      throw e;                                          // echter Netz-/Decode-Fehler
    } finally {
      _amLoadAbort = null;
    }
  }
  if (!abuf) return null;

  _amItemBufCache.set(item.id, abuf);
  return abuf;
}

// RMS-Normalisierung fuer Satz-Vordergrund (BA327).
// Cached unter "sent-norm:<item.id>" in _amItemBufCache.
// decodedBuffer ist der bereits dekodierte AudioBuffer (kein erneuter Fetch).
function amGetNormalizedSentenceBuffer(ctx, item, decodedBuffer) {
  if (!item || !item.id || !decodedBuffer) return decodedBuffer;
  const cacheKey = "sent-norm:" + item.id;
  const cached = _amItemBufCache.get(cacheKey);
  if (cached) return cached;

  const orig = decodedBuffer;
  const copy = ctx.createBuffer(orig.numberOfChannels, orig.length, orig.sampleRate);
  for (let ch = 0; ch < orig.numberOfChannels; ch++) {
    copy.copyToChannel(orig.getChannelData(ch), ch);
  }
  _amNormalizeBufferRms(copy, AM_REF_RMS);
  _amItemBufCache.set(cacheKey, copy);
  return copy;
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
  return _amCacheGet("collections:" + category, function () {
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
  });
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

// BA323: amRemoveLocalBookCollection entfernt — Entfernen-Knopf entfällt.

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

// Manifest-URL mit Cache-Buster. Die JSON-Manifeste haengen sonst am
// Browser-Cache und veralten nach einem Daten-Update, bis der Nutzer hart
// neu laedt (bei aenderungslosem HTTP-Cache klassisch). Der APP_VERSION-
// Anhang zwingt bei jedem Versionsbump frische Manifeste -- ein Ort fuer
// alle drei Manifest-Fetches (index/source/collection). NICHT fuer Audio-
// Dateien (item.audio) -- die aendern sich nicht bei Manifest-Updates.
function amManifestUrl(path) {
  var v = (typeof APP_VERSION !== "undefined") ? APP_VERSION : "0";
  return amManifestRoot() + path + (path.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(v);
}

// Verzeichnis eines source.json-Pfads aus index.json, mit abschliessendem
// "/". "online/freesound/source.json" -> "online/freesound/";
// "musan/source.json" -> "musan/". Basis fuer die Collection-Manifest-URLs
// derselben Quelle (Manifeste liegen relativ zur source.json).
function _amSourceDir(sourcePath) {
  if (!sourcePath) return "";
  var i = sourcePath.lastIndexOf("/");
  return i < 0 ? "" : sourcePath.substring(0, i + 1);
}

// Konfigurierbar ueber window.CI_SB_WEBSPACE_ROOT vor Lade-Beginn.
const AM_WEBSPACE_ROOT_DEFAULT = "https://honigburg.de/opus/";

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
  const url = amManifestUrl("index.json");
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
    const srcUrl = amManifestUrl(meta.source);
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
      const mfUrl = amManifestUrl(_amSourceDir(meta.source) + mfPath);
      try {
        const mr = await fetch(mfUrl, { mode: "cors" });
        if (!mr.ok) throw new Error("HTTP " + mr.status);
        const mf = await mr.json();
        // Indizes (Pointer) hier ignorieren — BA196 unterstuetzt nur collections direkt.
        // Ein "collection-set" buendelt mehrere Buecher in EINER Datei (LibriVox:
        // ein Manifest pro Sprache, haelt den Ladeweg klein). Wird in seine
        // einzelnen Collections aufgeloest; Datei-Top-Level lang/license/credit
        // vererbt sich als Default auf jede Collection, die es nicht selbst setzt.
        if (mf.kind === "collection") {
          manifests[cat].push(mf);
        } else if (mf.kind === "collection-set" && Array.isArray(mf.collections)) {
          for (const col of mf.collections) {
            if (!col || typeof col !== "object") continue;
            if (col.lang == null && mf.lang != null) col.lang = mf.lang;
            if (col.license == null && mf.license != null) col.license = mf.license;
            if (col.credit == null && mf.credit != null) col.credit = mf.credit;
            manifests[cat].push(col);
          }
        }
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
  // BA263: URL-Komponenten encoden, damit Pfade mit Leerzeichen
  // ("Thorsten Voice/wavs/...") und sonstigen Sonderzeichen vom Browser
  // sicher angesprochen werden. encodeURI bewahrt Strukturzeichen
  // (`:`, `/`, `?`, `#`) und encodet nur unsichere Zeichen wie ` `.
  return encodeURI(root + base + rawAudio);
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
            text: it.text || "",       // BA263: Saetze-Text durchreichen
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
        // Eindeutige id bevorzugen (Manifest liefert z.B. "librivox:148").
        // Traegt col.id bereits den srcKey als Praefix (LibriVox:
        // "librivox:148"), NICHT doppeln. Fallback auf titelbasiert nur, wenn
        // die Collection keine id traegt (aeltere/lokale Manifeste);
        // titelbasiert kann bei Gleichnamigkeit kollidieren, daher kein Default.
        var _rawId = col.id
          || ((col.title || "") /* Fallback */);
        if (col.id && col.id.indexOf(srcKey + ":") === 0) {
          _rawId = col.id;   // schon quellen-praefixiert
        } else {
          _rawId = srcKey + ":" + _rawId;
        }
        const id = "webspace-book:" + _rawId;
        out.push({
          schema: col.schema,
          kind: "collection",
          category: "hoerbuecher",
          id: id,
          title: col.title || srcKey,
          displayName: col.displayName || null,
          lang: col.lang || null,
          tags: col.tags || {},
          license: entry.source.license || entry.meta.license,
          credit:  entry.source.credit,
          pdfUrl:  col.pdfUrl || null,
          textUrl: col.textUrl || null,
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
// BA349: lokale Musik-Einzeldateien (sammelnd, Sammlung "upload")
// ============================================================
// Jede hochgeladene Einzeldatei bleibt erhalten und erscheint als Stueck.
// Technisch eine feste Ordner-Sammlung mit cid "upload" -> selber
// Resolver/Provider wie echte Ordner. sourceTitle = "Dateiupload".

function amMusicAddLocalFile(file) {
  if (!file) return null;
  var cid = "upload";
  var coll = _amMusicLocalFolders.get(cid);
  if (!coll) {
    coll = {
      id: cid,
      label: (typeof t === "function") ? t("plUploadSourceFile") : "Dateiupload",
      files: new Map(),
      items: []
    };
    _amMusicLocalFolders.set(cid, coll);
  }
  var rel = file.name;
  var existing = coll.items.find(function (x) {
    return x.audio === "local-music-folder:" + cid + ":" + rel;
  });
  if (existing) { coll.files.set(rel, file); return existing; }
  coll.files.set(rel, file);
  var baseName = file.name.replace(/\.[^.]+$/, "");
  var item = {
    id: "music-folder:" + cid + ":file-" + (coll.items.length + 1),
    title: baseName,
    audio: "local-music-folder:" + cid + ":" + rel,
    _file: file,
    sourceTitle: coll.label,
    license: null,
    credit: null,
    tags: { artist: "", album: coll.label, genres: [], year: null, source_local: "y" }
  };
  coll.items.push(item);
  return item;
}

// ============================================================
// BA261: lokaler Musik-Ordner-Provider
// ============================================================
// Mehrere Ordner gleichzeitig moeglich, jeder erscheint als eigene
// Sammlung. Audio wird lazy via File-Objekt geladen (Items tragen
// einen "local-music-folder:<cid>:<relPath>"-Audio-Ref, den der
// Player als Schluessel in die files-Map nutzt).

let _amMusicLocalFolders = new Map(); // cid -> { id, label, files: Map<relPath,File>, items: [...] }
let _amMusicLocalNextId = 1;

function _amMusicNewCid() {
  return "music-folder-" + (_amMusicLocalNextId++);
}

function _amMusicBuildFolderItems(files, cid, folderName) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const baseName = f.name.replace(/\.[^.]+$/, "");
    out.push({
      id: "music-folder:" + cid + ":" + (++n),
      title: baseName,
      audio: "local-music-folder:" + cid + ":" + f.webkitRelativePath,
      _file: f,
      sourceTitle: folderName,
      license: null,
      credit: null,
      tags: {
        artist: "",
        album: folderName,
        genres: [],
        year: null,
        source_local: "y"
      }
    });
  }
  return out;
}

async function amMusicIngestLocalFolder(fileList) {
  const all = Array.from(fileList || []);
  if (all.length === 0) return null;
  const firstRel = all[0].webkitRelativePath || all[0].name;
  const folderName = firstRel.split("/")[0] || "Ordner";
  const audioFiles = all.filter(function (f) {
    return /\.(wav|mp3|ogg|flac|m4a|mp4)$/i.test(f.name);
  });
  if (audioFiles.length === 0) {
    if (typeof alert === "function") {
      alert((typeof t === "function") ? t("plMusicLocalNoAudio") : "Keine Audiodateien.");
    }
    return null;
  }
  const cid = _amMusicNewCid();
  const filesMap = new Map();
  for (const f of audioFiles) filesMap.set(f.webkitRelativePath, f);
  const items = _amMusicBuildFolderItems(audioFiles, cid, folderName);
  _amMusicLocalFolders.set(cid, {
    id: cid,
    label: folderName,
    files: filesMap,
    items: items
  });
  return { cid: cid, count: audioFiles.length };
}

function amMusicListLocalFolders() {
  return Array.from(_amMusicLocalFolders.values());
}

// BA323: amMusicRemoveLocalFolder entfernt — Entfernen-Knopf entfällt (Box zustandslos).

amRegisterProvider({
  id: "music-local-folder",
  listItems: function (category) {
    if (category !== "musik") return [];
    const out = [];
    for (const coll of _amMusicLocalFolders.values()) {
      for (const it of coll.items) out.push(it);
    }
    return out;
  }
});

// ============================================================
// BA350: lokale Geraeusche-Einzeldateien (sammelnd, Sammlung "upload")
// ============================================================
// Analog Musik (BA349): feste Ordner-Sammlung cid "upload" -> selber
// Resolver/Provider wie echte Ordner. sourceTitle = "Dateiupload".

function amNoiseAddLocalFile(file) {
  if (!file) return null;
  var cid = "upload";
  var coll = _amNoiseLocalFolders.get(cid);
  if (!coll) {
    coll = {
      id: cid,
      label: (typeof t === "function") ? t("plUploadSourceFile") : "Dateiupload",
      files: new Map(),
      items: []
    };
    _amNoiseLocalFolders.set(cid, coll);
  }
  var rel = file.name;
  var existing = coll.items.find(function (x) {
    return x.audio === "local-noise-folder:" + cid + ":" + rel;
  });
  if (existing) { coll.files.set(rel, file); return existing; }
  coll.files.set(rel, file);
  var baseName = file.name.replace(/\.[^.]+$/, "");
  var item = {
    id: "noise-folder:" + cid + ":file-" + (coll.items.length + 1),
    title: baseName,
    audio: "local-noise-folder:" + cid + ":" + rel,
    _file: file,
    sourceTitle: coll.label,
    license: null,
    credit: null,
    tags: { kind: "", spectrum: "", source_local: "y" }
  };
  coll.items.push(item);
  return item;
}

// ============================================================
// BA334: lokaler Geraeusche-Ordner-Provider
// ============================================================

let _amNoiseLocalFolders = new Map(); // cid -> { id, label, files: Map<relPath,File>, items: [...] }
let _amNoiseLocalNextId = 1;

function _amNoiseNewCid() {
  return "noise-folder-" + (_amNoiseLocalNextId++);
}

function _amNoiseBuildFolderItems(files, cid, folderName) {
  const out = [];
  let n = 0;
  for (const f of files) {
    const baseName = f.name.replace(/\.[^.]+$/, "");
    out.push({
      id: "noise-folder:" + cid + ":" + (++n),
      title: baseName,
      audio: "local-noise-folder:" + cid + ":" + f.webkitRelativePath,
      _file: f,
      sourceTitle: folderName,
      license: null,
      credit: null,
      tags: { kind: "", spectrum: "", source_local: "y" }
    });
  }
  return out;
}

async function amNoiseIngestLocalFolder(fileList) {
  const all = Array.from(fileList || []);
  if (all.length === 0) return null;
  const firstRel = all[0].webkitRelativePath || all[0].name;
  const folderName = firstRel.split("/")[0] || "Ordner";
  const audioFiles = all.filter(function (f) {
    return /\.(wav|mp3|ogg|flac|m4a|mp4)$/i.test(f.name);
  });
  if (audioFiles.length === 0) {
    if (typeof alert === "function") {
      alert((typeof t === "function") ? t("plNoiseLocalNoAudio") : "Keine Audiodateien.");
    }
    return null;
  }
  const cid = _amNoiseNewCid();
  const filesMap = new Map();
  for (const f of audioFiles) filesMap.set(f.webkitRelativePath, f);
  const items = _amNoiseBuildFolderItems(audioFiles, cid, folderName);
  _amNoiseLocalFolders.set(cid, {
    id: cid,
    label: folderName,
    files: filesMap,
    items: items
  });
  return { cid: cid, count: audioFiles.length };
}

function amNoiseListLocalFolders() {
  return Array.from(_amNoiseLocalFolders.values());
}

amRegisterProvider({
  id: "noise-local-folder",
  listItems: function (category) {
    if (category !== "geraeusche") return [];
    const out = [];
    for (const coll of _amNoiseLocalFolders.values()) {
      for (const it of coll.items) out.push(it);
    }
    return out;
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
          } else if (cat === "hoerbuecher") {
            if (typeof plBookRefreshUI     === "function") plBookRefreshUI();
          } else if (cat === "saetze") {
            // Wird in BA 197 relevant, sobald Saetze ueber amCollectItems gehen.
            if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
          } else if (cat === "musik") {
            // BA261: Webspace-Musik-Sammlungen erscheinen jetzt im Musik-UI.
            if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
          }
        }
      });
    }
  });
}
