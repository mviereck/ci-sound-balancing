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

  // Stick-Kennung: true, sobald der lokale Caddy-Server den Response-Header
  // X-CImbel-Stick gesendet hat (im Web fehlt er). Steuert den absoluten
  // Versionscheck (nur am Stick sinnvoll). Name muss mit der Caddyfile
  // uebereinstimmen (siehe Caddyfile unten / Offline-Stick-Updater-BA).
  var _isStick = false;

  function _isTestRunning() {
    return document.body.classList.contains('test-running');
  }

  function _bannerExists() {
    return !!document.getElementById('updateBanner');
  }

  // opts.variant:
  //   "reload" (Default) -> Reload-Banner: der offene Tab ist aelter als der
  //     lokale Stand; Button macht Cache-Bust-Reload.
  //   "stick"            -> Stick-veraltet-Banner: der Stick ist aelter als
  //     die Produktion; KEIN Button (Reload hilft nicht), nur Hinweis +
  //     Schliessen-Kreuz. Der Nutzer fuehrt das Update-Icon aus.
  function _showBanner(newVer, opts) {
    if (_bannerExists()) return;
    var variant = (opts && opts.variant) || 'reload';
    var banner = document.createElement('div');
    banner.id = 'updateBanner';

    var msgEl = document.createElement('span');
    msgEl.className = 'update-banner-msg';
    if (variant === 'stick') {
      var stickMsg = (typeof t === 'function' && t('updateStickMsg'))
        || 'Neue Version verfuegbar - bitte das Update-Icon auf dem Desktop ausfuehren.';
      msgEl.textContent = stickMsg + ' (' + newVer + ')';
    } else {
      var baseMsg = (typeof t === 'function' && t('updateBannerMsg'))
        || 'Neue Version verfuegbar';
      msgEl.textContent = baseMsg + ' (' + newVer + ')';
    }
    banner.appendChild(msgEl);

    // Reload-Button NUR in der "reload"-Variante.
    if (variant === 'reload') {
      var btn = document.createElement('button');
      btn.className = 'update-banner-btn';
      btn.textContent = (typeof t === 'function' && t('updateBannerBtn'))
        || 'Jetzt aktualisieren';
      btn.addEventListener('click', function () {
        // Cache-Bust: URL aendert sich -> Browser holt HTML frisch.
        location.replace(location.pathname + '?t=' + Date.now());
      });
      banner.appendChild(btn);
    }

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
    banner.appendChild(closeBtn);

    var tabs = document.querySelector('.tabs');
    if (tabs && tabs.parentNode) {
      tabs.parentNode.insertBefore(banner, tabs);
    } else {
      document.body.appendChild(banner);
    }
  }

  // Holt eine version.js von der gegebenen URL und liefert APP_VERSION (oder
  // null bei Fehler/Netzproblem/CORS -> still). EINE Fetch-Stelle fuer beide
  // Checks: der relative (url="js/version.js") und der absolute Produktions-
  // Check (url=_PROD_VERSION_URL) teilen sie. opts.readStickHeader=true liest
  // zusaetzlich den X-CImbel-Stick-Header (nur beim relativen Fetch sinnvoll).
  async function _fetchVersionFrom(url, opts) {
    try {
      var r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!r.ok) return null;
      if (opts && opts.readStickHeader && r.headers.get('X-CImbel-Stick')) {
        _isStick = true;   // einmaliges Setzen reicht (Header pro Umgebung konstant)
      }
      var txt = await r.text();
      var m = txt.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
      return m ? m[1] : null;
    } catch (e) {
      return null;
    }
  }

  // Absolute Produktions-Quelle fuer den Stick-Check. CORS ist dort fuer
  // version.js freigegeben (.htaccess, siehe Abschnitt "Server-Vorbereitung").
  var _PROD_VERSION_URL = 'https://www.ci-sound-balancing.org/js/version.js';

  async function _maybeShow() {
    if (_checking) return;
    if (_isTestRunning()) return;
    if (_bannerExists()) return;
    _checking = true;
    try {
      var srv = await _fetchVersionFrom('js/version.js', { readStickHeader: true });
      if (srv && srv !== _startupVersion && !_isTestRunning() && !_bannerExists()) {
        _showBanner(srv);
      }
    } finally {
      _checking = false;
    }
  }

  // Stick-Check: nur wenn der Stick-Header gesehen wurde. Zeigt das
  // "stick"-Banner, wenn die Produktion neuer ist als der lokale Stand UND
  // gerade kein (lokales) Reload-Banner steht ("lokal gewinnt" ueber die
  // vorhandene _bannerExists-Sperre). Nutzt dieselbe _fetchVersionFrom wie der
  // relative Check, nur mit der absoluten Produktions-URL.
  async function _maybeShowStick() {
    if (!_isStick) return;            // nur am Stick
    if (_checking) return;
    if (_isTestRunning()) return;
    if (_bannerExists()) return;      // Vorrang lokal: Reload-Banner nicht verdraengen
    var prod = await _fetchVersionFrom(_PROD_VERSION_URL);
    if (prod && prod !== _startupVersion && !_isTestRunning() && !_bannerExists()) {
      _showBanner(prod, { variant: 'stick' });
    }
  }

  // Beide Checks: erst relativ (setzt _isStick + zeigt ggf. Reload-Banner),
  // dann absolut (Stick-veraltet). await, damit _isStick gesetzt ist und die
  // _bannerExists-Sperre "lokal gewinnt" greift.
  async function _maybeShowAll() {
    await _maybeShow();
    await _maybeShowStick();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') _maybeShowAll();
  });

  // Erstmaliger Check ein paar Sekunden nach Tool-Start, damit der
  // Nutzer nach langem Reopen ohne Tabwechsel trotzdem benachrichtigt wird.
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(_maybeShowAll, 5000);
  });
})();
