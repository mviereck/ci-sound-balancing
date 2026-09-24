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
// Sprechername-Cache je Item-Menge (WeakMap: Array-Referenz -> Map<value,name>).
// Fuellt die Sprecher-Achse labelFromItems in EINEM Durchlauf statt pro Wert die
// Items zu scannen. Neue Item-Menge -> neuer Eintrag (alte GC-bar).
const _amSpeakerNameCache = new WeakMap();

// Sprachsensitive Kategorien: ihre Manifeste tragen je Datei eine Sprache
// ({path, lang} in source.json), und es wird immer nur die aktuell gewaehlte
// Inhalts-Sprache geladen/aggregiert. Sprachlose Kategorien (musik/geraeusche)
// laden alles einmal und behalten es (ein Sprachwechsel fasst sie nicht an).
// Single Source of Truth hier, nicht in PL_FILTER_DECL (player.js laedt spaeter).
const _AM_LANG_CATEGORIES = { saetze: true, hoerbuecher: true };
function amIsLangCategory(category) { return _AM_LANG_CATEGORIES[category] === true; }

// Aktuelle Inhalts-Sprache (Basissprache). Nur fuer sprachsensitive
// Kategorien relevant; sprachlose ignorieren sie.
function amCurrentLang() {
  var lang = (typeof plGetContentLang === "function") ? plGetContentLang() : "de";
  return (typeof _amBaseLang === "function") ? _amBaseLang(lang) : String(lang || "").split("-")[0];
}

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

// Kategorie-lokaler Daten-Stempel: nur die Quellen, die DIESE Kategorie
// veraendern, plus (bei sprachsensitiven Kategorien) die aktuelle Sprache und
// deren geladener Webspace-/Embed-Stand. So verwirft ein Musik-Upload nur den
// Musik-Cache, ein Sprachwechsel nur die betroffene Sprach-Kategorie.
// amSourceMode betrifft alle. Sprachlose Kategorien behalten ihren Cache ueber
// einen Sprachwechsel hinweg.
function _amDataStamp(category) {
  const parts = [amSourceMode];
  if (amIsLangCategory(category)) {
    const lang = amCurrentLang();
    parts.push("lang=" + lang);
    parts.push("web=" + _amWebspaceLoadedCount(category, lang));
    if (category === "saetze") {
      parts.push("embed=" + (_amEmbedLoaded.has(lang) ? 1 : 0));
      parts.push("upl=" + ((typeof sLocalCollections !== "undefined" && sLocalCollections) ? _amLocalFileCount(sLocalCollections) : 0));
    } else if (category === "hoerbuecher") {
      parts.push("upl=" + _amLocalBookCollections.length);
    }
  } else {
    parts.push("web=" + _amWebspaceLoadedCount(category, null));
    if (category === "musik") {
      parts.push("upl=" + _amLocalFileCount(_amMusicLocalFolders));
    } else if (category === "geraeusche") {
      parts.push("upl=" + _amLocalFileCount(_amNoiseLocalFolders));
    }
  }
  return parts.join("|");
}

function _amCacheGet(category, key, build) {
  const stamp = _amDataStamp(category);
  const hit = _amCache.get(key);
  if (hit && hit.stamp === stamp) return hit.value;
  const value = build();
  _amCache.set(key, { stamp: stamp, value: value });
  return value;
}

function amCollectItems(category) {
  const _lk = amIsLangCategory(category) ? (":" + amCurrentLang()) : "";
  return _amCacheGet(category, "items:" + category + _lk, function () {
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

// Atomare Sprach-Ersatz-Tags: der "-" ist Teil des Sprachnamens, KEINE
// BCP-47-Regionalvariante. Sie stammen aus dem Lingua-Libre-Adapter
// (_lang_bcp47), wo codelose/kollidierende Sprachen als "ll-<qid>" und das
// gepfiffene Okzitanisch als "oci-whistled" getaggt werden. Fuer solche Tags
// ist die Basissprache der ganze Tag und die Variante leer -- sonst
// kollabieren alle "ll-*" auf die Scheinsprache "ll" (leere Sprachauswahl-
// Option) und "oci-whistled" wird als Variante "whistled" von "oci" gefuehrt.
function _amIsAtomicLangTag(code) {
  var s = String(code || "");
  return s.indexOf("ll-") === 0 || s === "oci-whistled";
}

// Basissprache eines BCP-47-artigen Codes: alles vor dem ersten "-".
// "de" -> "de", "zh-CN" -> "zh", "rm-sursilv" -> "rm". Leer -> "".
// Atomare Ersatz-Tags (ll-<qid>, oci-whistled) bleiben unveraendert.
function _amBaseLang(code) {
  if (!code) return "";
  if (_amIsAtomicLangTag(code)) return String(code);
  return String(code).split("-")[0];
}

// Sprachvariante (Subtag) eines BCP-47-artigen Codes: alles NACH dem
// ersten "-". "de" -> "", "zh-TW" -> "TW", "rm-sursilv" -> "sursilv".
// Atomare Ersatz-Tags (ll-<qid>, oci-whistled) haben keine Variante.
function _amLangVariant(code) {
  if (!code) return "";
  if (_amIsAtomicLangTag(code)) return "";
  var s = String(code);
  var i = s.indexOf("-");
  return i < 0 ? "" : s.substring(i + 1);
}

// Leitet aus einer Textquellen-URL (tags.url_text_source) den Domain-
// Bucket fuer die Filter-Achse "Textquelle" ab. Robust gegen uneinheitliche
// Formatierung: fehlendes/gross geschriebenes Schema, fehlendes "www.".
// Alle *.wikisource.org werden zu einem Bucket "wikisource.org"
// zusammengefasst; sonst gilt die nackte Domain. Kein Wert -> "".
function _amTextSourceHost(url) {
  if (!url) return "";
  var u = String(url).trim().toLowerCase();
  u = u.replace(/^https?:\/*/, "");   // Schema weg (auch "https:/..." / "Https://")
  u = u.replace(/^www\./, "");        // www. weg
  var host = u.split("/")[0];         // bis zum ersten "/"
  if (!host) return "";
  if (/\.wikisource\.org$/.test(host) || host === "wikisource.org") {
    return "wikisource.org";          // Sprach-Subdomains zusammenfassen
  }
  return host;
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
      bucketLabel: function (v) { return _amEnumLabel("plNoiseKind_", v); }
    },
    {
      key: "spectrum", labelKey: "plNoiseAxisSpectrum", labelDefault: "Spektrum",
      getter: function (it) { return (it.tags && it.tags.spectrum) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.spectrum) || ""; },
      bucketLabel: function (v) { return _amEnumLabel("plNoiseSpectrum_", v); }
    },
    {
      key: "stationary", labelKey: "plNoiseAxisStationary", labelDefault: "Zeitverlauf",
      getter: function (it) { return (it.tags && it.tags.stationary) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.stationary) || ""; },
      bucketLabel: function (v) { return _amEnumLabel("plNoiseStationary_", v); }
    },
    {
      key: "loop_safe", labelKey: "plNoiseAxisLoopSafe", labelDefault: "Loopbar",
      getter: function (it) { return (it.tags && it.tags.loop_safe) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.loop_safe) || ""; },
      bucketLabel: function (v) { return _amEnumLabel("plNoiseLoopSafe_", v); }
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
      key: "word_band", labelKey: "plAxisWordBand", labelDefault: "Satzlänge",
      order: ["wort", "wortpaar", "kurz", "lang", "sehrlang"],
      getter: function (it) { return (it.tags && it.tags.word_band) || "zzz-unbekannt"; },
      valueOf: function (it) { return (it.tags && it.tags.word_band) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plWordBand_" + v) : v; }
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
      // Anzeigename kommt aus dem Manifest-Attribut speaker_name (Daten,
      // nicht Code). value = speaker_id/book_title (die Gruppierung).
      // Statt pro Wert die ganze Item-Menge zu scannen (bei vielen Sprechern
      // ueber zehntausenden Items O(werte*n) = sehr teuer), wird EINMAL je
      // Item-Menge eine Map value->speaker_name gebaut und daraus gelesen. Der
      // Cache haengt an der Item-Array-Referenz (WeakMap) -> neue Menge => neu.
      labelFromItems: function (value, items) {
        var m = _amSpeakerNameCache.get(items);
        if (!m) {
          m = new Map();
          for (var i = 0; i < items.length; i++) {
            var t2 = items[i].tags;
            if (!t2 || !t2.speaker_name) continue;
            var v = (t2.speaker_id || t2.book_title) || "";
            if (v && !m.has(v)) m.set(v, t2.speaker_name);
          }
          _amSpeakerNameCache.set(items, m);
        }
        return m.get(value) || null;  // kein Name -> Fallback (Rohwert)
      }
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
      // Ordinale Achse: feste Reihenfolge nach Dauer (nicht alphabetisch nach
      // Label). amBucketsForAxisValues ordnet Werte mit axis.order nach diesem
      // Index; unbekannte Werte landen dahinter.
      order: ["very_short", "short", "medium", "long", "very_long"],
      getter: function (c) { return (c.tags && c.tags.length_band) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.length_band) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookLength_" + v) : v; }
    },
    {
      key: "text_source", labelKey: "plBookAxisText", labelDefault: "Textquelle",
      // Nur Buecher MIT Text haben eine Textquelle. Ein has_text=n-Buch
      // kann trotzdem eine url_text_source tragen (Herkunftslink ohne
      // Volltext) -> ohne die has_text-Bedingung liefert der getter dort
      // faelschlich einen Wert und die Achse zeigt nie "ohne Text".
      getter: function (c) { return (c.tags && c.tags.has_text) ? _amTextSourceHost(c.tags.url_text_source) : ""; },
      valueOf: function (c) { return (c.tags && c.tags.has_text) ? _amTextSourceHost(c.tags.url_text_source) : ""; }
      // Kein bucketLabel: amAxisBucketLabel faellt auf den Rohwert zurueck,
      // d.h. die nackte Domain (gutenberg.org, archive.org, ...) ist das Label.
    },
    {
      key: "gender", labelKey: "plBookAxisGender", labelDefault: "Geschlecht",
      getter: function (c) { return (c.tags && c.tags.gender) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.gender) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookGender_" + v) : v; }
    },
    {
      key: "dialekt", labelKey: "plBookAxisDialekt", labelDefault: "Dialekt",
      getter: function (c) { return (c.tags && c.tags.dialekt) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.dialekt) || ""; }
      // kein bucketLabel: der Rohwert ("Hochdeutsch", ...) ist bereits das Label.
    },
    {
      key: "synthetic", labelKey: "plBookAxisSynthetic", labelDefault: "Stimme",
      getter: function (c) { return (c.tags && c.tags.synthetic) || "zzz-unbekannt"; },
      valueOf: function (c) { return (c.tags && c.tags.synthetic) || ""; },
      bucketLabel: function (v) { return (typeof t === "function") ? t("plBookSynthetic_" + v) : v; }
    },
    {
      // Quelle der Collection (LibriVox / Wikimedia Commons / Upload). Analog
      // zur "source"-Achse der anderen Kategorien, aber auf Collection-Ebene:
      // der Quellenname kommt als c.sourceTitle (Webspace-Loader bzw.
      // local-books durchgereicht), Fallback Provider-Id.
      key: "source", labelKey: "plBookAxisSource", labelDefault: "Quelle",
      getter: function (c) { return c.sourceTitle || c._providerId || "zzz-unbekannt"; },
      valueOf: function (c) { return c.sourceTitle || ""; }
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

// i18n-Label eines Achsen-Rohwerts ueber ein Praefix. Der Rohwert wird vor
// dem Key-Bau normalisiert: Bindestrich -> Unterstrich, weil die i18n-Keys
// keine Bindestriche tragen koennen (JS-Property), die Manifest-Rohwerte aber
// schon (z.B. "rauschen-rosa", "test-ton"). Fehlt der Key, faellt t() auf den
// deutschen Default bzw. amAxisBucketLabel auf den Rohwert zurueck.
function _amEnumLabel(prefix, v) {
  if (typeof t !== "function") return v;
  return t(prefix + String(v).replace(/-/g, "_"));
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
  // Labels EINMAL je Wert vorberechnen (nicht pro Sortier-Vergleich): der
  // Comparator wird O(werte*log(werte)) mal aufgerufen, und amAxisBucketLabel
  // kann teuer sein (speaker.labelFromItems scannt die ganze Item-Menge, um
  // den Anzeigenamen zu finden). Ohne Vorberechnung ergibt das O(werte*log*n)
  // -- bei 86 Sprechern ueber 155k Items ~6 s. Mit Vorberechnung ein Scan je
  // Wert. Die Sortierung liest dann nur noch aus der Map.
  var labelOf = new Map();
  set.forEach(function (v) { labelOf.set(v, amAxisBucketLabel(axis, v, items)); });
  // Ordinale Achse (axis.order gesetzt): feste Reihenfolge nach dem
  // deklarierten Werte-Index (z.B. Laenge sehr kurz -> sehr lang), nicht
  // alphabetisch. Unbekannte/nicht gelistete Werte landen ans Ende.
  // Sonst nach ANGEZEIGTEM Label sortieren (nicht nach Rohwert), damit die
  // sichtbare Reihenfolge alphabetisch ist (z.B. "Klassik" bei K statt
  // "westernart" am Ende). Ohne bucketLabel faellt das Label auf den
  // Rohwert zurueck -> Verhalten unveraendert.
  var values;
  if (Array.isArray(axis.order)) {
    var ord = axis.order;
    var rank = function (v) { var i = ord.indexOf(v); return i < 0 ? ord.length : i; };
    values = Array.from(set).sort(function (a, b) {
      var d = rank(a) - rank(b);
      return d !== 0 ? d : labelOf.get(a).localeCompare(labelOf.get(b));
    });
  } else {
    values = Array.from(set).sort(function (a, b) {
      return labelOf.get(a).localeCompare(labelOf.get(b));
    });
  }
  return { values: values, hasNone: hasNone, hasSome: hasSome };
}

// Anzeigetext eines Achsenwerts. bucketLabel hat Vorrang (i18n-Lookup
// im Tool), sonst Rohwert. Fuer die Sonderwerte liefert der Aufrufer
// eigene Labels ("alle"/"ohne"), nicht diese Funktion.
function amAxisBucketLabel(axis, value, items) {
  if (typeof axis.labelFromItems === "function" && items) {
    var lf = axis.labelFromItems(value, items);
    if (lf) return lf;
  }
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

const _amItemBufCache = new Map(); // cacheKey -> AudioBuffer

// Eindeutiger Cache-Schlüssel je Audio-Quelle. item.id allein genügt NICHT:
// Hörbuch-Kapitel heißen pro Buch "ch001", "ch002" … und kollidieren über
// Bücher hinweg (falsches Audio aus dem Cache). Die Audio-URL ist global
// eindeutig; nur generierte (gen:) und lokale Uploads (kein .audio) fallen
// auf item.id zurück (dort ist die id eindeutig bzw. sitzungsweit stabil).
function _amBufKey(item) {
  return (item && item.audio) ? item.audio : (item && item.id) || "";
}

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
  const bufKey = _amBufKey(item);
  const cached = _amItemBufCache.get(bufKey);
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
    if (typeof pOnDownloadStart === "function") pOnDownloadStart();
    try {
      const r = await fetch(item.audio, { signal: _amLoadAbort.signal });
      const contentLength = parseInt(r.headers.get("content-length") || "0", 10);
      const reader = r.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (contentLength > 0 && typeof pOnDownloadProgress === "function")
          pOnDownloadProgress(received / contentLength);
      }
      const merged = new Uint8Array(received);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      abuf = await ctx.decodeAudioData(merged.buffer);
    } catch (e) {
      if (e && e.name === "AbortError") return null;   // Wechsel während Laden
      throw e;                                          // echter Netz-/Decode-Fehler
    } finally {
      _amLoadAbort = null;
      if (typeof pOnDownloadEnd === "function") pOnDownloadEnd();
    }
  }
  if (!abuf) return null;

  _amItemBufCache.set(bufKey, abuf);
  return abuf;
}

// RMS-Normalisierung fuer Satz-Vordergrund (BA327).
// Cached unter "sent-norm:<bufKey>" in _amItemBufCache.
// decodedBuffer ist der bereits dekodierte AudioBuffer (kein erneuter Fetch).
function amGetNormalizedSentenceBuffer(ctx, item, decodedBuffer) {
  if (!item || !item.id || !decodedBuffer) return decodedBuffer;
  const cacheKey = "sent-norm:" + _amBufKey(item);
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
  const _lk = amIsLangCategory(category) ? (":" + amCurrentLang()) : "";
  return _amCacheGet(category, "collections:" + category + _lk, function () {
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
    // Quelle-Achse: hochgeladene Hörbücher sind Quelle "Upload"
    // (i18n-Label plBookSource_upload; Rohwert als Fallback).
    return _amLocalBookCollections.map(function (c) {
      if (c && !c.sourceTitle) {
        c.sourceTitle = (typeof t === "function") ? t("plBookSource_upload") : "Upload";
      }
      return c;
    });
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
  loaded: new Map(),           // sourceKey -> { meta, source }   (nur source.json, billig)
  manifests: new Map(),        // "srcKey|cat|langKey" -> [collection,...]  (bedarfsgeladen)
  manifestsLoading: new Set(), // laufende Bedarfs-Ladevorgaenge (Doppel-Load-Sperre)
  pendingRefresh: new Set()    // Kategorien, deren UI nach erfolgreichem Laden refreshet werden soll
};

// Sprachschluessel eines Manifest-Ladeziels: bei sprachsensitiven Kategorien
// die aktuelle Basissprache, sonst "_all" (alle Manifeste der Kategorie).
function _amWsLangKey(category) {
  return amIsLangCategory(category) ? amCurrentLang() : "_all";
}
function _amWsManifKey(srcKey, category, langKey) {
  return srcKey + "|" + category + "|" + langKey;
}

// Zaehler der geladenen Manifest-Buendel einer Kategorie fuer die gegebene
// Sprache (langKey === null -> sprachlos, "_all"). Geht in den kategorie-
// lokalen Stempel: steigt er, baut amCollectItems/-Collections neu.
function _amWebspaceLoadedCount(category, lang) {
  const langKey = (lang == null) ? "_all" : lang;
  let n = 0;
  for (const key of _amWebspace.manifests.keys()) {
    if (key.endsWith("|" + category + "|" + langKey)) n++;
  }
  return n;
}

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

// source.json einer Quelle laden (nur Metadaten mit {path, lang}); die
// Manifest-INHALTE bleiben aussen vor (die holt amWebspaceEnsureCategory
// bedarfsgetrieben). Billig, wird beim Bootstrap fuer alle Quellen gemacht.
async function amWebspaceLoadSource(srcKey) {
  if (_amWebspace.failed) return null;
  if (_amWebspace.loaded.has(srcKey)) return _amWebspace.loaded.get(srcKey);
  const meta = _amWebspace.sources.find(function (s) { return s.key === srcKey; });
  if (!meta) return null;

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

  const entry = { meta: meta, source: source };
  _amWebspace.loaded.set(srcKey, entry);
  return entry;
}

// Ein einzelnes Kategorie-Manifest-Buendel einer Quelle laden und in
// _amWebspace.manifests ablegen. Sprachsensitiv: nur Manifeste, deren
// {path, lang} zur aktuellen Sprache passt (Basissprach-Vergleich); sprachlos:
// alle Manifest-Pfade der Kategorie. Gibt die aufgebaute Collection-Liste
// zurueck (auch bei Cache-Treffer). Idempotent ueber _amWebspace.manifests.
async function _amWebspaceLoadCategoryManifests(entry, category) {
  const srcKey = entry.meta.key;
  const langKey = _amWsLangKey(category);
  const mkey = _amWsManifKey(srcKey, category, langKey);
  if (_amWebspace.manifests.has(mkey)) return _amWebspace.manifests.get(mkey);

  const cats = (entry.source.manifests && typeof entry.source.manifests === "object")
    ? entry.source.manifests : {};
  const list = Array.isArray(cats[category]) ? cats[category] : [];
  const cols = [];
  const langSensitive = amIsLangCategory(category);
  const wantBase = langSensitive ? langKey : null;

  for (const e of list) {
    // manifests-Eintrag: {path, lang} (Sprach-Kategorien) oder reiner
    // Pfad-String (sprachlose Kategorien). Bei sprachsensitiven nur die
    // Datei(en) der aktuellen Sprache laden.
    const mfPath = (e && typeof e === "object") ? e.path : e;
    if (!mfPath) continue;
    if (langSensitive) {
      const eLang = (e && typeof e === "object") ? e.lang : null;
      const eBase = (typeof _amBaseLang === "function") ? _amBaseLang(eLang) : eLang;
      if (eBase !== wantBase) continue;   // andere Sprache -> nicht laden
    }
    const mfUrl = amManifestUrl(_amSourceDir(entry.meta.source) + mfPath);
    try {
      const mr = await fetch(mfUrl, { mode: "cors" });
      if (!mr.ok) throw new Error("HTTP " + mr.status);
      const mf = await mr.json();
      // Indizes (Pointer) hier ignorieren — nur collections direkt.
      // "collection-set" buendelt mehrere Buecher in EINER Datei; wird in
      // die einzelnen Collections aufgeloest, Top-Level-Defaults vererbt.
      if (mf.kind === "collection") {
        cols.push(mf);
      } else if (mf.kind === "collection-set" && Array.isArray(mf.collections)) {
        for (const col of mf.collections) {
          if (!col || typeof col !== "object") continue;
          if (col.lang == null && mf.lang != null) col.lang = mf.lang;
          if (col.license == null && mf.license != null) col.license = mf.license;
          if (col.credit == null && mf.credit != null) col.credit = mf.credit;
          cols.push(col);
        }
      }
    } catch (e2) {
      console.warn("[audio-source/webspace] Manifest " + mfPath + " fehlgeschlagen:", e2.message);
    }
  }

  _amWebspace.manifests.set(mkey, cols);
  return cols;
}

// Bedarfsgetriebenes Laden einer Kategorie in der aktuellen Sprache ueber ALLE
// Quellen, die diese Kategorie fuehren. Sprachsensitive Kategorien: laedt nur
// die aktuelle Sprache (frueher besuchte Sprachen bleiben im manifests-Cache
// liegen, verfaelschen aber nichts, da listItems/-Collections nur die aktuelle
// Sprache lesen). Refresht die Kategorie-UI, sobald neue Daten da sind.
async function amWebspaceEnsureCategory(category) {
  if (_amWebspace.failed) return;
  await amWebspaceLoadIndex();
  if (_amWebspace.failed) return;

  const langKey = _amWsLangKey(category);
  let changed = false;
  const jobs = [];
  for (const meta of _amWebspace.sources) {
    const catsOfSrc = Array.isArray(meta.categories) ? meta.categories : [];
    if (catsOfSrc.indexOf(category) < 0) continue;
    const mkey = _amWsManifKey(meta.key, category, langKey);
    if (_amWebspace.manifests.has(mkey) || _amWebspace.manifestsLoading.has(mkey)) continue;
    _amWebspace.manifestsLoading.add(mkey);
    jobs.push(
      amWebspaceLoadSource(meta.key).then(function (entry) {
        if (!entry) return;
        return _amWebspaceLoadCategoryManifests(entry, category).then(function () { changed = true; });
      }).finally(function () {
        _amWebspace.manifestsLoading.delete(mkey);
      })
    );
  }
  if (jobs.length === 0) return;
  await Promise.all(jobs);
  if (changed) _amWebspaceRefreshCategory(category);
}

// UI-Refresh der Kategorie nach erfolgreichem Bedarfs-Laden.
function _amWebspaceRefreshCategory(category) {
  if (category === "geraeusche") {
    if (typeof plNoiseRefreshUI === "function") plNoiseRefreshUI();
  } else if (category === "hoerbuecher") {
    if (typeof plBookRefreshUI === "function") plBookRefreshUI();
  } else if (category === "saetze") {
    if (typeof sUpdateUI === "function") sUpdateUI();
  } else if (category === "musik") {
    if (typeof plMusicRefreshUI === "function") plMusicRefreshUI();
  }
}

// Sprachcodes einer Kategorie aus den GELADENEN source.json-Manifesten.
// Die Sprache je Datei steht als {path, lang} in source.manifests[cat]
// (zentral vom Builder aus dem Manifest-Kopf abgeleitet). So kennt das Tool
// die verfügbaren Sprachen, OHNE die Items aller Manifeste aufzubauen —
// nur die Manifest-Metadaten der source.json, nicht ihr Inhalt.
// Rückgabe: Set von Basissprachen (via _amBaseLang normalisiert).
function amLangsForCategory(category) {
  var out = new Set();
  // Webspace: aus den geladenen source.json-Manifesten ({path, lang}).
  if (_amWebspace.indexLoaded) {
    for (const [srcKey, entry] of _amWebspace.loaded) {
      var cats = entry.source && entry.source.manifests;
      if (!cats || typeof cats !== "object") continue;
      var list = Array.isArray(cats[category]) ? cats[category] : [];
      for (const e of list) {
        var lang = (e && typeof e === "object") ? e.lang : null;
        if (lang) out.add(_amBaseLang(lang));
      }
    }
  }
  // Embed (Offline-Bundles): Sprache je Collection-Kopf (col.lang), ohne
  // die Items aufzubauen. Nur die geladenen Bundles sind sichtbar.
  var root = (typeof window !== "undefined") ? window.CI_SB_EMBED : null;
  if (root && root.sources) {
    for (const key in root.sources) {
      var col = root.sources[key];
      if (!col || col.category !== category) continue;
      if (col.lang) out.add(_amBaseLang(col.lang));
    }
  }
  return out;
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

// Geladene Collections einer Kategorie in der aktuellen Sprache, ueber ALLE
// Quellen. Liest den bedarfsgeladenen _amWebspace.manifests-Speicher (nur die
// aktuelle Sprache), nicht die source.json. Liefert {col, entry, srcKey}-Paare,
// damit die Provider je Collection weiter Quell-Defaults (base/license/credit)
// aufloesen koennen. Loest gleichzeitig das Bedarfs-Laden aus (fire-and-forget:
// erste Rueckgabe ggf. leer, der Refresh nach amWebspaceEnsureCategory zeigt sie).
function _amWebspaceCurrentCols(category) {
  const out = [];
  if (!_amWebspace.indexLoaded) { amWebspaceEnsureCategory(category); return out; }
  const langKey = _amWsLangKey(category);
  let anyMissing = false;
  for (const [srcKey, entry] of _amWebspace.loaded) {
    const cols = _amWebspace.manifests.get(_amWsManifKey(srcKey, category, langKey));
    if (!cols) continue;
    for (const col of cols) out.push({ col: col, entry: entry, srcKey: srcKey });
  }
  // Bedarfs-Laden anstossen (idempotent), falls Manifeste dieser Sprache fehlen.
  amWebspaceEnsureCategory(category);
  return out;
}

amRegisterProvider({
  id: "webspace",
  listItems: function (category) {
    const out = [];
    if (category === "hoerbuecher") return out; // Hoerbuecher ueber listCollections
    for (const pair of _amWebspaceCurrentCols(category)) {
      const col = pair.col, entry = pair.entry, srcKey = pair.srcKey;
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
    return out;
  },
  listCollections: function (category) {
    if (category !== "hoerbuecher") return [];
    const out = [];
    for (const pair of _amWebspaceCurrentCols(category)) {
      const col = pair.col, entry = pair.entry, srcKey = pair.srcKey;
      {
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
        // Sprach-Segment VOR die Roh-id: dieselbe col.id kommt in mehreren
        // sprachgetrennten Manifesten derselben Quelle vor (Commons "Blade Runner"
        // de+es, gleicher Artikelname -> gleiche col.id "commons:blade-runner";
        // auch LibriVox). Ohne Sprach-Qualifizierung kollidieren die Laufzeit-ids
        // und plBookCurrentCollection().find(id) liefert die zuerst geladene
        // (deutsche) Version. Das Segment steht VOR _rawId, damit der Startwunsch-
        // Suffix-Match (endsWith("librivox:3580")) intakt bleibt.
        const _langSeg = col.lang ? (String(col.lang) + ":") : "";
        const id = "webspace-book:" + _langSeg + _rawId;
        out.push({
          schema: col.schema,
          kind: "collection",
          category: "hoerbuecher",
          id: id,
          title: col.title || srcKey,
          displayName: col.displayName || null,
          // Quelle-Achse: echter Quellenname pro Collection (LibriVox /
          // Wikimedia Commons / …), aus der Quelle dieser Manifest-Datei.
          sourceTitle: entry.meta.name || entry.source.name || srcKey,
          lang: col.lang || null,
          tags: col.tags || {},
          license: entry.source.license || entry.meta.license,
          credit:  entry.source.credit,
          pdfUrl:  col.pdfUrl || null,
          textUrl: col.textUrl || null,
          textRange: col.textRange || null,
          textLive: col.textLive || null,   // Live-Textweg (Commons): Wikipedia-API-Beschaffung

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

// Beim Start NUR den Index und alle source.json laden (billige Metadaten mit
// {path, lang}) — daraus steht die Sprach-Auswahl (amLangsForCategory) sofort.
// Die Manifest-INHALTE einer Kategorie werden NICHT vorgeladen; das erledigt
// amWebspaceEnsureCategory bedarfsgetrieben beim ersten Kategorie-/Sprach-
// Zugriff (angestossen aus den Provider-Methoden). So wird beim Start nichts
// aufgebaut, was nicht gebraucht wird.
function amWebspaceBootstrap() {
  amWebspaceLoadIndex().then(function () {
    if (_amWebspace.failed) return;
    const jobs = _amWebspace.sources.map(function (meta) {
      return amWebspaceLoadSource(meta.key);
    });
    Promise.all(jobs).then(function () {
      // source.json aller Quellen da -> Sprach-Auswahl + UI der Kategorien
      // einmal auffrischen (die Manifeste holt der erste Zugriff nach).
      amAfterSourceChange();
      if (typeof sRefreshSpeakerDropdown === "function") sRefreshSpeakerDropdown();
    });
  });
}
