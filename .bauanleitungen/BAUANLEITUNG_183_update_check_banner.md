# Bauanleitung 183 — Update-Check-Banner

## Ziel

Wenn der Nutzer das Tool im Tab offen hat und der Entwickler eine neue
Version pusht, soll der Nutzer beim nächsten Tab-Fokus dezent informiert
werden und auf Knopfdruck eine zuverlässige Cache-Bust-Neuladung
auslösen können. Während laufender Tests darf das Banner nicht
erscheinen.

**Mechanik in einem Satz:** Bei jedem `visibilitychange → visible` per
`fetch()` die Server-Version aus `js/version.js` lesen, mit der
beim Laden eingefrorenen `APP_VERSION` vergleichen, bei Differenz und
keinem laufenden Test ein Info-Banner einblenden, dessen Update-Knopf
`location.replace(location.pathname + '?t=' + Date.now())` ausführt.

## Versionsbump (Pflicht — am Ende)

`js/version.js`:

```js
const APP_VERSION = "3.2.183-beta";
```

## Schritt 1: Neue Datei `js/update-check.js`

Datei komplett neu anlegen. Skeleton:

```js
// ============================================================
// update-check.js — Versions-Heartbeat mit Update-Banner (BA 183)
// ============================================================
// Prüft bei jedem Tab-Fokus, ob auf dem Server eine neuere
// APP_VERSION liegt, und blendet bei Bedarf ein Banner ein.
// Reload-Knopf erzwingt Cache-Bust per URL-Query.

(function () {
  'use strict';

  // Version, mit der diese Seite gestartet ist (eingefroren)
  var _startupVersion = (typeof APP_VERSION === 'string') ? APP_VERSION : null;
  if (!_startupVersion) return; // ohne Basis kein Vergleich

  var _checking = false;

  function _isTestRunning() {
    return document.body.classList.contains('test-running');
  }

  function _bannerExists() {
    return !!document.getElementById('updateBanner');
  }

  function _showBanner(newVer) {
    if (_bannerExists()) return;
    var banner = document.createElement('div');
    banner.id = 'updateBanner';

    var msgEl = document.createElement('span');
    msgEl.className = 'update-banner-msg';
    var baseMsg = (typeof t === 'function' && t('updateBannerMsg'))
      || 'Neue Version verfuegbar';
    msgEl.textContent = baseMsg + ' (' + newVer + ')';

    var btn = document.createElement('button');
    btn.className = 'update-banner-btn';
    btn.textContent = (typeof t === 'function' && t('updateBannerBtn'))
      || 'Jetzt aktualisieren';
    btn.addEventListener('click', function () {
      // Cache-Bust: URL aendert sich -> Browser holt HTML frisch.
      location.replace(location.pathname + '?t=' + Date.now());
    });

    var closeBtn = document.createElement('button');
    closeBtn.className = 'update-banner-close';
    closeBtn.textContent = 'x';
    closeBtn.title = (typeof t === 'function' && t('updateBannerClose'))
      || 'Banner schliessen';
    closeBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      banner.remove();
      // bewusst kein dauerhaftes Dismiss: beim naechsten Fokus-Check
      // kommt das Banner wieder, falls die Versionsdifferenz besteht.
    });

    banner.appendChild(msgEl);
    banner.appendChild(btn);
    banner.appendChild(closeBtn);

    var tabs = document.querySelector('.tabs');
    if (tabs && tabs.parentNode) {
      tabs.parentNode.insertBefore(banner, tabs);
    } else {
      document.body.appendChild(banner);
    }
  }

  async function _fetchServerVersion() {
    try {
      var r = await fetch('js/version.js?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      var txt = await r.text();
      var m = txt.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  async function _maybeShow() {
    if (_checking) return;
    if (_isTestRunning()) return;
    if (_bannerExists()) return;
    _checking = true;
    try {
      var srv = await _fetchServerVersion();
      if (srv && srv !== _startupVersion && !_isTestRunning() && !_bannerExists()) {
        _showBanner(srv);
      }
    } finally {
      _checking = false;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') _maybeShow();
  });

  // Erstmaliger Check ein paar Sekunden nach Tool-Start, damit der
  // Nutzer nach langem Reopen ohne Tabwechsel trotzdem benachrichtigt wird.
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(_maybeShow, 5000);
  });
})();
```

## Schritt 2: „Test läuft"-Flag auf `<body>` setzen

`js/test-ui.js`. Zwei Stellen anpassen — beide innerhalb von `_startTest`
(Z. ~1442) und `_stopTest` (Z. ~1474).

**In `_startTest` direkt nach `_testRunning = true;` einfügen:**

```js
    _testRunning = true;
    document.body.classList.add('test-running'); // BA 183
```

**In `_stopTest` direkt nach `_testRunning = false;` einfügen:**

```js
    _testRunning = false;
    document.body.classList.remove('test-running'); // BA 183
```

Hinweis zur Mehrfach-Instanz: Es können mehrere `testUI`-Instanzen
existieren, in der Praxis läuft aber zu jedem Zeitpunkt höchstens
ein Test (immer nur ein Sub-Tab aktiv). Ein simpler Class-Toggle
reicht; ein Counter wäre Overhead.

## Schritt 3: CSS in `style.css` ergänzen

Direkt **nach** dem `#dbgErrorBanner`-Block einfügen (ca. Z. 1615,
hinter der `@media print`-Regel für `#dbgErrorBanner`):

```css
/* ============================================================
   Update-Banner (BA 183)
   ============================================================ */
#updateBanner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  background: #1e40af;
  color: #fff;
  font-family: sans-serif;
  font-size: 13px;
  user-select: none;
}
#updateBanner .update-banner-msg {
  flex: 1;
}
#updateBanner .update-banner-btn {
  background: #fff;
  color: #1e40af;
  border: none;
  padding: 4px 10px;
  border-radius: 3px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
}
#updateBanner .update-banner-btn:hover {
  background: #e0e7ff;
}
#updateBanner .update-banner-close {
  background: none;
  border: 1px solid rgba(255,255,255,0.5);
  color: #fff;
  font-size: 14px;
  line-height: 1;
  padding: 0 6px;
  cursor: pointer;
  border-radius: 2px;
  flex-shrink: 0;
}
#updateBanner .update-banner-close:hover {
  background: rgba(255,255,255,0.15);
}
@media print {
  #updateBanner { display: none !important; }
}
```

## Schritt 4: Script in `index.html` einbinden

In der Script-Liste (Z. ~141-145) `'js/update-check.js'` als
letzten Eintrag der vorletzten Zeile (vor `debug-tests*`) ergänzen.
Konkret die Zeile

```js
        'js/finanzen.js', 'js/unterstuetzung.js',
```

ändern zu:

```js
        'js/finanzen.js', 'js/unterstuetzung.js', 'js/update-check.js',
```

## Schritt 5: i18n-Strings — **nur Deutsch**

In `i18n/de.js` vor der letzten schließenden `});`-Zeile einfügen:

```js
    // BA 183: Update-Check-Banner
    updateBannerMsg: "Neue Version verfuegbar",
    updateBannerBtn: "Jetzt aktualisieren",
    updateBannerClose: "Banner schliessen",
```

Hinweis: Die ASCII-Schreibweisen „verfuegbar" und „schliessen" sind
hier bewußt gewählt (keine Umlaute), um Encoding-Stolperer in dieser
neutralen Stelle zu vermeiden. Wenn der Nutzer Umlaute wünscht,
in eigener Iteration auf „verfügbar" / „schließen" ändern.

**en/fr/es bleiben unverändert.** Fehlende Keys fallen auf die
deutschen Defaults zurück (Verhalten in `js/i18n.js`).

## Akzeptanztest (Klick-für-Klick)

Voraussetzung: lokal ein Webserver, der die Dateien aus dem Repo
ausliefert (z.B. `python3 -m http.server` aus dem Repo-Verzeichnis).
Tool im Browser öffnen, Browser-Tab aktiv.

1. **Banner-Trigger einfach simulieren ohne erneuten Build:**
   Mit dem Tool offen die Datei `js/version.js` auf
   `"3.2.183-beta-test"` ändern, **speichern**, dann zu einem anderen
   Browser-Tab wechseln und wieder zurück.
   → erwartet: oben über den Tabs erscheint ein blaues Banner
   „Neue Version verfuegbar (3.2.183-beta-test)" mit Knopf
   „Jetzt aktualisieren" und × rechts.

2. **Knopf „Jetzt aktualisieren":** Klick.
   → erwartet: Seite lädt neu, URL trägt `?t=<zahl>` hinter dem
   Pfad. Banner ist weg. Falls man die Datei wieder zurückstellt:
   beim nächsten Fokus-Check kein Banner mehr.

3. **× wegklicken:** Banner-Trigger wie in 1 erzeugen. Statt Knopf
   das × drücken.
   → erwartet: Banner verschwindet. Tab-Wechsel weg und zurück
   → Banner erscheint wieder (Dismiss ist absichtlich nicht persistent).

4. **Während Test kein Banner:** `version.js` so verändern lassen,
   daß sich die Version unterscheidet. Im Tool einen Test starten
   (z.B. Frequenzabgleich → „Test starten"). Tab-Wechsel weg
   und zurück.
   → erwartet: kein Banner. Test stoppen → bei nächstem Tab-Fokus
   (oder spätestens nach 5 s, falls Erst-Check noch nicht gelaufen)
   erscheint das Banner.

5. **Kein Banner bei gleicher Version:** Version unverändert lassen.
   Tab-Wechsel weg und zurück, mehrmals.
   → erwartet: nie ein Banner.

6. **Offline-Robustheit:** DevTools → Network → Offline-Modus.
   Tab-Wechsel weg und zurück.
   → erwartet: kein Fehler in der Konsole, kein Banner. Wieder
   online → nächste Fokus-Runde liefert Banner falls Differenz besteht.

## Selbstprüfungs-Auftrag an Sonnet

**Vor der Fertig-Meldung** jeden der sechs Akzeptanztest-Punkte
einzeln durchgehen und melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe der relevanten Code-Stelle. Bei
„unklar" Rückfrage statt stiller Annahme.

Zusätzlich gegenchecken:
- `js/version.js` enthält `"3.2.183-beta"` (Bump erfolgt, korrekte
  dritte Stelle).
- `js/update-check.js` ist in der Script-Liste in `index.html`.
- `document.body.classList.add('test-running')` steht im
  `_startTest` direkt nach `_testRunning = true`.
- `document.body.classList.remove('test-running')` steht im
  `_stopTest` direkt nach `_testRunning = false`.
- Die drei neuen i18n-Keys sind in `i18n/de.js` ergänzt, en/fr/es
  unverändert.
- Im CSS-Block `#updateBanner` keine Tippfehler bei Klassenpräfix
  `.update-banner-…`.

## Folge-Anleitung (nicht jetzt, vom Nutzer angestoßen)

Sobald die deutsche GUI-Vorlage sitzt, sollte eine Mini-Anleitung
„Übersetzungen Update-Banner" die drei Keys
`updateBannerMsg`, `updateBannerBtn`, `updateBannerClose` in
`i18n/en.js`, `i18n/fr.js`, `i18n/es.js` nachziehen.

## Nach Abschluß manuell prüfen

- Normalbetrieb des Tools unverändert: Tabs schaltbar, Tests
  startbar, keine neuen Konsolen-Fehler.
- Hard-Reload zeigt nie ein Update-Banner.
- Die existierende `#dbgErrorBanner`-Funktion ist nicht beeinflußt
  (eigene ID, eigener CSS-Block).
