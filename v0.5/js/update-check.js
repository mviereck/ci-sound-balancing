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
