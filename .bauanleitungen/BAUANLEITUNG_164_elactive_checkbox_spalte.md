# BAUANLEITUNG 164 — Checkbox-Spalte „Aktiv" und neues Bool-Array `elActive[]`

**Zieldateien:** `js/version.js`, `js/state-side.js`, `js/file.js`,
`js/init.js`, `js/freq-table.js`, `js/freqmatch.js`,
`js/levels-tab.js`, `js/implant-validate.js`, `js/tab-print.js`,
`js/print-md.js`, `js/dependency-lock.js`, `style.css`,
`i18n/de.js`

**Voraussetzung:** BA 161-163 abgeschlossen. Stand `js/version.js`
= `3.1.163-beta`.

**Version:** 3.1.163-beta → **3.1.164-beta**

---

## Kontext

Bisher kodiert die Tabelle in der Status-Spalte den Sonderwert
`deactivated` („im CI deaktiviert"), gepaart mit BA-152-Sperrlogik,
die nur diese eine `<option>` sperrt. Konzeptbeschluß: Aus dem
Status-Dropdown wird die Deaktivierung **herausgezogen** und in eine
eigene Spalte mit Checkbox überführt.

Wesentliche Designentscheidungen (alle vom Nutzer abgesegnet):

1. **Datenmodell**: neues Bool-Array `sideData[side].elActive[]`
   (Default: alle `true`). Wahrheitslogik: **gehakt = aktiv**. Wird
   als globale Variable `elActive` in `bindActiveSide()` mitgebunden,
   analog zu `elSt`/`elExDur` — damit funktioniert die Direkt-Schreib-
   weise `elActive[i]` auch innerhalb von `withSide(otherSide, ...)`
   in `freqmatch.js` und `levels-tab.js`.
2. **Spaltenposition**: neue Spalte direkt **vor** der Status-Spalte.
3. **Spaltenüberschrift**: „Aktiv" (i18n-Key `thActive`).
4. **Status-Dropdown**: verliert die `deactivated`-Option (sechs
   statt sieben Optionen).
5. **Sperre über `DEP_LOCK_RULES`**: bei vorhandenen Meßdaten wird
   die Aktiv-Checkbox via `depLockApply()` als `.dep-locked`
   markiert. **Kein `disabled`-Attribut**, kein TD-Attribut-Trick.
   Klick öffnet das Popup sofort über den vorhandenen
   `mousedown`-Handler in `dependency-lock.js`. Aktualisierung
   geschieht live, weil `depLockApply()` in allen Test-Result-
   Handlern bereits gerufen wird — keine `buildFreqTable()`-
   Neubauten als Voraussetzung.
6. **Auto-Verknüpfung zur Ausschluss-Checkbox: KEIN automatisches
   Setzen/Löschen.** Beim Aushaken der Aktiv-Checkbox bleibt
   `elExDur[i]` unverändert; beim Wieder-Einhaken ebenfalls.
   Aktiv-Status und Test-Ausschluss sind **vollständig unabhängige
   Konzepte**. Eine inaktive Elektrode wird in Skip-Logiken
   trotzdem übersprungen (sie kann physisch nicht angesteuert
   werden); aber die Ausschluss-Checkbox selbst zeigt nur den
   manuellen Ausschluss.
7. **Halbtransparente Zeile** bei `elActive[i] === false`
   **oder** `elExDur[i] !== null` (wie bisher, nur Quelle wechselt).
8. **Akustische Tabelle** (BA 153) bekommt **keine** Aktiv-Spalte.
9. **JSON-Migration**: Beim Laden alter Stände wird
   `electrodeStatus[i] === "deactivated"` in `elActive[i] = false`
   überführt; gleichzeitig wird `electrodeStatus[i]` auf `null`
   gesetzt und — **für Migration, einmalig** — auch `elExDur[i]`
   gesetzt, falls leer. Damit bleiben alte Stände konsistent mit
   ihrem damaligen Skip-Verhalten. Bei neuen Toggle-Aktionen im
   laufenden Tool wird `elExDur` NICHT mehr automatisch berührt
   (siehe Punkt 6).
10. **Audiologen-Bericht**: Bei inaktiver Elektrode steht im Status-
    Feld die vertraute Bezeichnung „Im CI deaktiviert"
    (i18n-Key `stDeactivated`) — gewählt, weil Audiologen den
    Begriff erwarten.

Diese BA berührt rund 40 Stellen in 12 Dateien.

---

## Schritt 1 — Version bumpen

`js/version.js`:
```js
const APP_VERSION = "3.1.164-beta";
```

---

## Schritt 2 — `js/state-side.js`: Datenmodell + globale Variable

### 2a) Globale Variable `elActive` deklarieren

In der globalen Variablen-Liste am Anfang von `state-side.js`
(in der Nähe von `let fullSweepRound = null;` Z. 59), ergänzen:

```js
let elActive = [];  // BA 164: Aktivitäts-Flag pro Elektrode der aktiven Seite
```

### 2b) `bindActiveSide()` (Z. 72-91) ergänzen

Nach `bRes = s.bRes;` einfügen:

```js
  elActive = s.elActive || (s.elActive = new Array(s.nEl).fill(true));
```

Der Fallback `s.elActive = new Array(...)` deckt den Fall ab, daß
eine sehr alte Sitzung im Browser nach BA 161/162/163-Upgrade
weiterläuft, ohne `elActive` initialisiert zu haben.

### 2c) `initSideData()` (Z. 92-128) ergänzen

Direkt nach `s.bRes = [];` einfügen:

```js
    // BA 164: Aktivitäts-Flag pro Elektrode (true = arbeitet im CI)
    s.elActive = new Array(s.nEl).fill(true);
```

### 2d) `loadSideData()` (Z. 309-386): Migration und Lesen

Den bestehenden `Deactivated: ensure elExDur is set`-Block (Z. 331-335)
ersetzen durch die neue Lese+Migrations-Logik.

**Vorher (`js/state-side.js` Z. 323-335):**
```js
  // Migrate old 'excluded' from elSt to elExDur
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "excluded") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
      s.elSt[_i] = null;
    }
  }
  // Deactivated: ensure elExDur is set
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
```

**Nachher:**
```js
  // Migrate old 'excluded' from elSt to elExDur
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "excluded") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
      s.elSt[_i] = null;
    }
  }
  // BA 164: elActive aus Datei lesen oder Default true.
  s.elActive = Array.isArray(d.electrodeActive)
    ? d.electrodeActive.map((v) => v !== false)
    : new Array(s.nEl).fill(true);
  while (s.elActive.length < s.nEl) s.elActive.push(true);
  s.elActive = s.elActive.slice(0, s.nEl);
  // BA 164 Migration: alter elSt-Wert "deactivated" -> elActive=false + elSt=null.
  // elExDur wird zusätzlich gesetzt, damit alte Stände auch die alte
  // Skip-Wirkung behalten (Aktiv und Ausschluss sind ab BA 164 entkoppelt,
  // aber alte Daten brauchen den Spiegel-Effekt fürs nahtlose Weiterarbeiten).
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elActive[_i] = false;
      s.elSt[_i] = null;
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
```

### 2e) `implantSnapshot()` (Z. 494-514) anpassen

**Vorher:**
```js
function implantSnapshot() {
  function _sideSnap(side) {
    const s = sideData[side];
    if (!s) return null;
    const deact = [];
    const arr = s.elSt || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === "deactivated") deact.push(i);
    }
    return {
      config: s.config || "unknown",
      manufacturer: s.manufacturer || "unknown",
      nEl: s.nEl || 0,
      deactivatedIdx: deact,
    };
  }
  return {
    left:  _sideSnap("left"),
    right: _sideSnap("right"),
  };
}
```

**Nachher:**
```js
function implantSnapshot() {
  function _sideSnap(side) {
    const s = sideData[side];
    if (!s) return null;
    // BA 164: Quelle ist jetzt elActive[]
    const deact = [];
    const arr = s.elActive || [];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === false) deact.push(i);
    }
    return {
      config: s.config || "unknown",
      manufacturer: s.manufacturer || "unknown",
      nEl: s.nEl || 0,
      deactivatedIdx: deact,
    };
  }
  return {
    left:  _sideSnap("left"),
    right: _sideSnap("right"),
  };
}
```

---

## Schritt 3 — `js/file.js`: Save + Load alter Stände

### 3a) `saveJson()` (Z. 84-189): pro Seite `electrodeActive` ergänzen

Im `sides.left`-Block (Z. 99-119) nach `electrodeStatus: sideData.left.elSt,`
ergänzen:

```js
        electrodeActive: sideData.left.elActive,
```

Analog im `sides.right`-Block.

### 3b) `loadOldFormat()` (Z. 229-323): Migration

Vor dem `Deactivated: ensure elExDur is set`-Block (Z. 311-316)
ersetzen / ergänzen:

**Vorher (`js/file.js` Z. 311-316):**
```js
  // Deactivated: ensure elExDur is set
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
}
```

**Nachher:**
```js
  // BA 164: elActive aus Datei lesen oder Default true.
  s.elActive = Array.isArray(d.electrodeActive)
    ? d.electrodeActive.map((v) => v !== false)
    : new Array(s.nEl).fill(true);
  while (s.elActive.length < s.nEl) s.elActive.push(true);
  s.elActive = s.elActive.slice(0, s.nEl);
  // BA 164 Migration: alter elSt-Wert "deactivated" -> elActive=false + elSt=null.
  // elExDur wird zusätzlich gesetzt, damit alte Stände auch die alte
  // Skip-Wirkung behalten.
  for (let _i = 0; _i < s.elSt.length; _i++) {
    if (s.elSt[_i] === "deactivated") {
      s.elActive[_i] = false;
      s.elSt[_i] = null;
      s.elExDur[_i] = s.elExDur[_i] || Date.now();
    }
  }
}
```

### 3c) `resetAll()` (BA 161): keine Änderung

`initSideData()` setzt `s.elActive` mit. Kein zusätzlicher Code in
`resetAll()` nötig.

---

## Schritt 4 — `js/init.js`: Auto-Save

### 4a) `_autoSaveState()` (aus BA 161): pro Seite ergänzen

Im `sides.left`-Block nach `electrodeStatus: sideData.left.elSt,`
ergänzen:

```js
              // BA 164
              electrodeActive: sideData.left.elActive,
```

Analog im `sides.right`-Block.

### 4b) Initial-Load aus sessionStorage (Z. 608-734)

Bereits durch `loadSideData()` abgedeckt. Keine zusätzliche Änderung.

---

## Schritt 5 — `js/freq-table.js`: Spalte „Aktiv" hinzufügen

### 5a) CI-Tabellenkopf (Z. 48-49) erweitern

**Vorher:**
```js
  } else {
    document.getElementById("freqTH").innerHTML =
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
  }
```

**Nachher:**
```js
  } else {
    // BA 164: neue Spalte „Aktiv" vor Status
    document.getElementById("freqTH").innerHTML =
      `<th>${elLbl}</th><th>${t("thHzStd")}</th><th>${t("thHzOwn")}</th><th title="${t("thCentTip")}">${t("thCent")}</th><th>${t("implThHdr")}</th><th>${upperHdr}</th><th>${t("thPlay")}</th><th>${t("thHold")}</th><th style="white-space:nowrap">${t("thActive")}</th><th>${t("thSt")}</th><th style="white-space:nowrap">${t("thExclCb")}</th><th>${t("thNote")}</th>`;
  }
```

### 5b) Akustische Tabelle (Z. 38-46): keine Änderung — keine
Aktiv-Spalte.

### 5c) Akustischer Branch (Z. 84-129): Spiegel-Ausschluß-Logik

In Z. 89-94 die alte `elSt === "deactivated"`-Prüfung umstellen.

**Vorher:**
```js
      const ciSide = activeSide === "left" ? "right" : "left";
      const ciIsActive = (sideData[ciSide].config || "ci") === "ci";
      const ciMirroredExcl = ciIsActive && (
        (sideData[ciSide].elSt && sideData[ciSide].elSt[i] === "deactivated") ||
        (sideData[ciSide].elExDur && sideData[ciSide].elExDur[i] != null)
      );
```

**Nachher:**
```js
      const ciSide = activeSide === "left" ? "right" : "left";
      const ciIsActive = (sideData[ciSide].config || "ci") === "ci";
      // BA 164: Quelle für „CI-Spiegel-Ausschluß" ist jetzt elActive
      const ciMirroredExcl = ciIsActive && (
        (sideData[ciSide].elActive && sideData[ciSide].elActive[i] === false) ||
        (sideData[ciSide].elExDur && sideData[ciSide].elExDur[i] != null)
      );
```

### 5d) `_depHasData`/`_depStatusReasons` entfernen

Die in BA 152 angelegten Helfer (Z. 53-78) werden nicht mehr
gebraucht. Die Sperr-Logik für die Aktiv-Checkbox läuft jetzt
zentral über `DEP_LOCK_RULES` (Schritt 11). Kompletter Block
entfernen:

**Vorher (`js/freq-table.js` Z. 53-78):**
```js
  // BA 152: Prüfung, ob Meßdaten den Status „im CI deaktiviert"-Wechsel sperren
  const _depHasData = (function() {
    const s = sideData[activeSide];
    const ownHasLoud = (s.bRes && s.bRes.length > 0) || (s.jRes && s.jRes.length > 0);
    const fHas = (typeof fRes !== 'undefined' && Array.isArray(fRes) && fRes.length > 0);
    return ownHasLoud || fHas;
  })();
  function _depStatusReasons() {
    ...
    return reasons;
  }
```

**Nachher:** Beide Blöcke (`_depHasData`-IIFE und
`_depStatusReasons`-Funktion) ersatzlos streichen.

### 5e) CI-Branch (ab Z. 130): Spalte „Aktiv" + Status-Dropdown ohne `deactivated`

Ersetze den gesamten Block ab Z. 130 (`// === Ende akustischer Branch
— ab hier CI-Logik`) bis zum schließenden `}` der Schleife durch:

```js
    // === Ende akustischer Branch — ab hier CI-Logik ===
    let ex = "";
    if (i === 0) ex = ` <span class="el-extra">(${t("apikal")})</span>`;
    if (i === nEl - 1) ex = ` <span class="el-extra">(${t("basal")})</span>`;
    const isExcl  = elExDur[i] !== null;
    // BA 164: Aktivitäts-Status aus globaler elActive
    const isDeact = (elActive && elActive[i] === false);
    const stdHz   = Math.round(freqs[i]);
    const ownVal  = elFreqOwn[i] != null ? Math.round(elFreqOwn[i]) : "";
    const thrVal  =
      im.thr && im.thr[i] !== null && im.thr[i] !== undefined ? im.thr[i] : "";
    const upperVal = isMedel
      ? im.mcl && im.mcl[i] !== null && im.mcl[i] !== undefined
        ? im.mcl[i] : ""
      : im.upperLevel &&
          im.upperLevel[i] !== null &&
          im.upperLevel[i] !== undefined
        ? im.upperLevel[i] : "";
    const centVal = Math.round(hzToCent(effFreq(i)));
    const centTxt = (centVal > 0 ? "+" : "") + centVal;
    if (isDeact || isExcl) tr.style.opacity = "0.55";

    // BA 164: Status-Dropdown ohne „deactivated"-Option (6 statt 7)
    const so_i =
      `<option value="">ok</option>` +
      `<option value="noisyLess">${t("stNoisyLess")}</option>` +
      `<option value="noisyMore">${t("stNoisyMore")}</option>` +
      `<option value="noisyHeavy">${t("stNoisyHeavy")}</option>` +
      `<option value="almostMute">${t("stAlmMute")}</option>` +
      `<option value="mute">${t("stMute")}</option>`;

    // BA 164: Aktiv-Checkbox „nackt" — depLockApply() klebt
    // .dep-locked automatisch drauf, wenn Meßdaten vorliegen.
    // Kein disabled-Attribut, keine TD-Datenattribute.
    const _activeChecked = isDeact ? "" : " checked";
    const _activeCbHtml =
      `<input type="checkbox" class="ec-active" data-i="${i}"${_activeChecked}>`;

    tr.innerHTML =
      `<td style="font-weight:600">${elPfx}${dEN(i)}${ex}</td>` +
      `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px">${stdHz}</td>` +
      `<td><input type="number" class="fo" data-i="${i}" value="${ownVal}" min="20" max="20000" style="width:70px;padding:2px 4px;border:1px solid var(--border);border-radius:4px;text-align:center;font-family:var(--mono);font-size:.88em"></td>` +
      `<td style="color:#999;font-family:var(--mono);font-size:.86em;padding:4px 6px;text-align:right">${centTxt}</td>` +
      `<td><input type="number" class="it" data-i="${i}" value="${thrVal}" min="0" max="500" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><input type="number" class="iu" data-i="${i}" value="${upperVal}" min="0" max="1000" step="1" style="${inpStyle}" placeholder="—"></td>` +
      `<td><button class="pbtn" data-a="play" data-i="${i}">&#9654;</button></td>` +
      `<td><button class="pbtn" data-a="hold" data-i="${i}">&#9724;</button></td>` +
      `<td style="text-align:center">${_activeCbHtml}</td>` +
      `<td><select class="ss" data-i="${i}">${so_i}</select></td>` +
      `<td style="text-align:center"><input type="checkbox" class="ec" data-i="${i}"${isExcl ? " checked" : ""}></td>` +
      `<td><input type="text" class="ni" data-i="${i}" value="${elNt[i] || ""}" placeholder="${t("thNote")}"></td>`;
    tb.appendChild(tr);
    tr.querySelector(".ss").value = elSt[i] || "";
  }
```

Wichtig: Die Ausschluss-Checkbox am Zeilenende ist **nicht** mehr
durch `isDeact` disabled oder vorgemerkt. Nur `isExcl` bestimmt
ihren Zustand. Aktiv und Ausschluss sind ab BA 164 entkoppelt.

### 5f) Event-Handler für `.ec-active` ergänzen

Direkt nach dem bestehenden `tb.querySelectorAll(".ec")`-Handler
(Z. 258-265) einfügen:

```js
  // BA 164: Aktiv-Checkbox
  tb.querySelectorAll(".ec-active").forEach((cb) =>
    cb.addEventListener("change", (e) => {
      // BA 164: Sicherheitsnetz — falls preventDefault aus dem globalen
      // mousedown-Handler in dependency-lock.js auf einer Plattform
      // durchrutscht, Toggle rückgängig machen.
      if (e.target.classList.contains('dep-locked')) {
        e.target.checked = !e.target.checked;
        return;
      }
      const idx  = +e.target.dataset.i;
      const want = e.target.checked;
      const arr  = sideData[activeSide].elActive;
      if (!arr) return;
      arr[idx] = want;
      // elActive global neu binden, damit nachfolgende Render-
      // Funktionen den neuen Stand sehen.
      elActive = arr;
      // BA 164: KEINE Auto-Verknüpfung zur Ausschluss-Checkbox.
      // elExDur wird beim Aktiv-Toggle nicht angefaßt.
      buildFreqTable();
      updRef();
      if (typeof depLockApply === 'function') depLockApply();
    }),
  );
```

### 5g) `.ss`-Change-Handler (Z. 242-257): `deactivated`-Zweig entfernen

**Vorher:**
```js
      // BA 153: Auto-Ausschluß bei „deactivated" UND „mute" (CI- und akustisch)
      if (val === "deactivated" || val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
```

**Nachher:**
```js
      // BA 164: „deactivated" als Status-Option entfernt — nur noch „mute"
      if (val === "mute") {
        elExDur[idx] = elExDur[idx] || Date.now();
      }
```

### 5h) Hinweis-/Warnbalken (Z. 279-311)

**Vorher:**
```js
  // Hinweistext für deaktivierte Elektroden (immer sichtbar sobald mind. eine deakt.)
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = elSt.some((s) => s === "deactivated");
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
  }
  ...
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elSt[i] !== "deactivated")
    .some((i) => elFreqOwn[i] == null);
  if (hasDeact && activeHasDefault) {
```

**Nachher:**
```js
  // BA 164: Hinweis & Warnung jetzt aus elActive[]
  const hintEl = document.getElementById("freqDeactHintEl");
  const hasDeact = (elActive || []).some((a) => a === false);
  if (hintEl) {
    hintEl.innerHTML = t("freqDeactHint");
  }
  ...
  let wb = document.getElementById("deactWarnBar");
  const activeHasDefault = [...Array(nEl).keys()]
    .filter((i) => elActive[i] !== false)
    .some((i) => elFreqOwn[i] == null);
  if (hasDeact && activeHasDefault) {
```

### 5i) `depLockApply()` am Ende von `buildFreqTable()`

Direkt vor dem schließenden `}` von `buildFreqTable()` (nach
`validateImplantTable`-Aufruf, ca. Z. 333) sicherstellen, daß
`depLockApply()` gerufen wird. Falls schon vorhanden, nicht
duplizieren — andernfalls anhängen:

```js
  // BA 164: Aktiv-Checkbox-Sperren live anwenden
  if (typeof depLockApply === 'function') depLockApply();
}
```

---

## Schritt 6 — `js/dependency-lock.js`: neue Regel für `.ec-active`

Am Ende des `DEP_LOCK_RULES`-Arrays (nach der `#refEl_freqmatch`-Regel,
also nach Z. 165 `}` vor `];`) neue Regel anhängen.

**Vorher (`js/dependency-lock.js` Z. 137-166, gekürzt):**
```js
  {
    selector: '#refEl_freqmatch',
    fieldLabelKey: 'depFieldRefSide',
    getReasonKeys: function() {
      ...
      return reasons;
    }
  }
];
```

**Nachher:**
```js
  {
    selector: '#refEl_freqmatch',
    fieldLabelKey: 'depFieldRefSide',
    getReasonKeys: function() {
      ...
      return reasons;
    }
  },

  // BA 164: Aktiv-Häkchen pro Elektrode — kann nicht umgeschaltet
  // werden, wenn Meßergebnisse der aktiven Seite vorliegen.
  // Reasons-Logik wie .fo (Hz-eigen).
  {
    selectorAll: '.ec-active',
    fieldLabelKey: 'depFieldActive',
    getReasonKeys: function() {
      const reasons = [];
      const s = sideData[activeSide];
      const ownHasLoud =
        (s.bRes && s.bRes.length > 0) ||
        (s.jRes && s.jRes.length > 0);
      if (ownHasLoud) reasons.push('depReasonLoudness');
      try {
        if (typeof fRes !== 'undefined' && Array.isArray(fRes) && fRes.length > 0)
          reasons.push('depReasonFreqMatchAdaptive');
      } catch(ex) { /* fRes noch in TDZ */ }
      try {
        if (typeof _fmHasAdaptiveData === 'function' && _fmHasAdaptiveData())
          if (reasons.indexOf('depReasonFreqMatchAdaptive') === -1)
            reasons.push('depReasonFreqMatchAdaptive');
      } catch(ex) {}
      try {
        var hasSlider = false;
        ['left', 'right'].forEach(function(side) {
          var fa = sideData[side] && sideData[side].freqmatchAdaptive;
          if (fa && fa.sliderEstimates && Object.keys(fa.sliderEstimates).length > 0)
            hasSlider = true;
        });
        if (hasSlider) reasons.push('depReasonFreqMatchSlider');
      } catch(ex) {}
      return reasons;
    }
  }
];
```

Wichtig: das Komma nach der `#refEl_freqmatch`-Regel-`}` nicht
vergessen — vorher war es das letzte Element ohne Komma.

---

## Schritt 7 — `style.css`: Sperr-Optik der Aktiv-Checkbox

Am Ende von `style.css` (nach den anderen `.dep-locked`-Stilen)
anhängen:

```css
/* ============================================================
   BA 164 — Aktiv-Checkbox bei vorhandenen Meßdaten gesperrt.
   Nicht disabled, damit Mouse-Events durchkommen und der globale
   mousedown-Handler aus dependency-lock.js das Sperr-Popup öffnet.
   ============================================================ */
input.ec-active.dep-locked {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: auto;
}
```

---

## Schritt 8 — `js/freqmatch.js`: Inaktive Elektroden überspringen

Beide Treffer (Z. 244 und Z. 262) ersetzen. Beide Stellen liegen
innerhalb von `withSide(...)`-Blöcken; die globale Variable
`elActive` wird durch `bindActiveSide()` in withSide automatisch
auf die richtige Seite umgesetzt.

**Vorher (jeweils):**
```js
      if (elSt[i] === "deactivated") continue;
```

**Nachher (jeweils):**
```js
      // BA 164
      if (elActive[i] === false) continue;
```

Beide Stellen erhalten die identische Ersetzung.

---

## Schritt 9 — `js/levels-tab.js`: Drei Treffer

Z. 92, 164, 631. Alle drei sind im Kontext der aktiven Seite, die
globalen `elActive`/`elSt`/`elExDur` zeigen also korrekt.

**Vorher (jeweils):**
```js
    elSt[i] === "deactivated" || elSt[i] === "mute" || elExDur[i] !== null;
```

**Nachher (jeweils):**
```js
    // BA 164
    elActive[i] === false || elSt[i] === "mute" || elExDur[i] !== null;
```

Bei Z. 631: dort steht ein `if (...) return;`. Den Ausdruck 1:1
ersetzen, das `if (...) return;`-Konstrukt bleibt.

---

## Schritt 10 — `js/implant-validate.js`: 15+ Treffer

Per `grep -n "elSt\[.*\] === 'deactivated'" js/implant-validate.js`
prüfen. Die meisten Treffer haben die Form
`if (s.elSt && s.elSt[i] === 'deactivated') continue;`
oder Varianten (`[i+1]`, `[n]`). Ersetze diese durch:

```js
// BA 164
if (s.elActive && s.elActive[i] === false) continue;
```

(Bei `[i+1]` analog: `s.elActive[i+1] === false`. Bei `[n]`:
`s.elActive[n] === false`.)

Drei Stellen mit Sonderform:

**Z. 393 (`if (s.elSt[i] !== 'deactivated') nActive++;`):**

```js
// BA 164
if (s.elActive && s.elActive[i] !== false) nActive++;
```

**Z. 705 (`if (s.elSt[i] === 'deactivated') deactIdxs.push(i);`):**

```js
// BA 164
if (s.elActive && s.elActive[i] === false) deactIdxs.push(i);
```

**Z. 732 (`if (s.elSt[n] === 'deactivated') return false;`):**

```js
// BA 164
if (s.elActive && s.elActive[n] === false) return false;
```

Vor Versand der Anleitung kreuzweise prüfen: nach Abschluss soll
`grep -n "elSt\[.*\] === 'deactivated'" js/implant-validate.js`
**null** Treffer ergeben.

---

## Schritt 11 — `js/tab-print.js`: Status-Mapping + Aktiv-Spalte

### 11a) `_stI18nKey()` (Z. 28-39) — `deactivated`-Eintrag entfernen

**Vorher:**
```js
function _stI18nKey(stKey) {
  return (
    {
      noisyHeavy: "stNoisyHeavy",
      noisyMore:  "stNoisyMore",
      noisyLess:  "stNoisyLess",
      almostMute: "stAlmMute",
      mute:       "stMute",
      deactivated:"stDeactivated",
    }[stKey] || stKey
  );
}
```

**Nachher:**
```js
function _stI18nKey(stKey) {
  // BA 164: „deactivated" nicht mehr als Status — jetzt eigene Spalte
  return (
    {
      noisyHeavy: "stNoisyHeavy",
      noisyMore:  "stNoisyMore",
      noisyLess:  "stNoisyLess",
      almostMute: "stAlmMute",
      mute:       "stMute",
    }[stKey] || stKey
  );
}
```

### 11b) `printImplantTab()` — Aktiv-Spalte ergänzen

In den `headers`-Array (Z. 81-89) eine Spalte vor „Status" einfügen:

**Vorher:**
```js
  const headers = [
    "Nr.",
    "Hz",
    "Hz*",
    t("implThHdr"),
    _upperHdr(m),
    "Status",
    "Notiz",
  ];
```

**Nachher:**
```js
  const headers = [
    "Nr.",
    "Hz",
    "Hz*",
    t("implThHdr"),
    _upperHdr(m),
    t("thActive"), // BA 164
    "Status",
    "Notiz",
  ];
```

In der `rows.push(...)`-Stelle (Z. 106-116) eine `<td>` einfügen,
nach Upper, vor Status:

**Vorher:**
```js
    rows.push(
      `<tr>
        <td style="border:1px solid #ccc;padding:3px 6px;">E${elNum}${_tpEsc(apexBasal)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzStd)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzOwn)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(thr)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(upper)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(stText)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(note)}</td>
      </tr>`,
    );
```

**Nachher:**
```js
    // BA 164: Aktiv-Zelle
    const isActive = (s.elActive && s.elActive[i] !== false);
    const activeStr = isActive ? "✓" : "—";
    rows.push(
      `<tr>
        <td style="border:1px solid #ccc;padding:3px 6px;">E${elNum}${_tpEsc(apexBasal)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzStd)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(hzOwn)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(thr)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:right;">${_tpEsc(upper)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;text-align:center;">${activeStr}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(stText)}</td>
        <td style="border:1px solid #ccc;padding:3px 6px;">${_tpEsc(note)}</td>
      </tr>`,
    );
```

---

## Schritt 12 — `js/print-md.js`: Status-Maps + Audiologen-Status

### 12a) `_ST_KEY` (Z. 447) und `_ST_KEY2` (Z. 510): `deactivated` raus

Beide Maps haben die Form:
```js
const _ST_KEY = { noisyLess: "...", noisyMore: "...", noisyHeavy: "...", almostMute: "...", mute: "...", deactivated: "stDeactivated" };
```

Den `deactivated: "stDeactivated"`-Eintrag aus beiden entfernen.
Kein anderer Quell-Code liefert mehr `deactivated` als
`elSt`-Wert; der Eintrag ist tot.

### 12b) `_audStatusText()` (Z. 752-766): Aktiv-Quelle integrieren

Die Funktion liefert den Status-Text für den Audiologen-Bericht.
Konzeptbeschluß: bei inaktiver Elektrode soll im Status-Feld
weiterhin „Im CI deaktiviert" stehen.

**Vorher:**
```js
function _audStatusText(side, i) {
  return withSide(side, () => {
    if (elSt[i] === "mute") return t("audStatMute");
    if (elSt[i]) {
      const lb = {
        noisyHeavy: t("stNoisyHeavy"),
        noisyMore:  t("stNoisyMore"),
        noisyLess:  t("stNoisyLess"),
        almostMute: t("stAlmMute"),
      };
      return lb[elSt[i]] || "";
    }
    return "";
  });
}
```

**Nachher:**
```js
function _audStatusText(side, i) {
  return withSide(side, () => {
    // BA 164: inaktive Elektrode → vertraute Bezeichnung „Im CI deaktiviert"
    if (elActive && elActive[i] === false) return t("stDeactivated");
    if (elSt[i] === "mute") return t("audStatMute");
    if (elSt[i]) {
      const lb = {
        noisyHeavy: t("stNoisyHeavy"),
        noisyMore:  t("stNoisyMore"),
        noisyLess:  t("stNoisyLess"),
        almostMute: t("stAlmMute"),
      };
      return lb[elSt[i]] || "";
    }
    return "";
  });
}
```

---

## Schritt 13 — `i18n/de.js`: neue Keys

Im Frequenztabellen-Block (in der Nähe von `thSt`, `thExclCb`):

```js
    thActive:         "Aktiv",
```

Im Dependency-Lock-Block (in der Nähe von `depFieldStatus`):

```js
    depFieldActive:   "Aktivitäts-Häkchen einer Elektrode",
```

Achtung Stringliteral: ASCII-`"` außen, keine `"`-Zeichen innen.

---

## Akzeptanztest

1. **Tool frisch laden.** Version oben rechts: `3.1.164-beta`.
2. **Reiter Implantat → Hersteller links MED-EL setzen.** Erwartet:
   In der Frequenztabelle erscheint **vor** der Status-Spalte eine
   neue Spalte „Aktiv". Alle 12 Checkboxen sind gehakt.
3. **Status-Dropdown öffnen.** Erwartet: sechs Optionen
   (ok, leicht verrauscht, mittel verrauscht, stark verrauscht,
   fast stumm, stumm). Die Option „im CI deaktiviert" fehlt
   vollständig.
4. **Aktiv-Checkbox der Elektrode E5 ausschalten.** Erwartet:
   Zeile wird halbtransparent (Opacity 0.55). Die Ausschluß-Checkbox
   am Zeilenende **bleibt unverändert** (kein automatisches
   Häkchen, bedienbar wie zuvor).
5. **Aktiv-Checkbox E5 wieder einschalten.** Zeile wird wieder
   opak. Ausschluß-Checkbox unverändert.
6. **Manueller Ausschluss-Test:** Bei der unverändert aktiven E6
   die Ausschluß-Checkbox manuell haken. Erwartet: E6-Zeile wird
   halbtransparent. Aktiv-Checkbox bleibt unverändert (gehakt).
   Die zwei Konzepte sind also wirklich unabhängig.
7. **Reiter Messungen → Lautstärketest mit zwei Eingaben durchlaufen.**
   Ergebnis erscheint im Reiter Meßergebnisse.
8. **Zurück zum Reiter Implantat. KEIN F5.** Erwartet:
   - Alle 12 Aktiv-Häkchen erscheinen **gedämpft** (Opacity ~0.45),
     Mauszeiger bei Hover wird zu `not-allowed`.
   - Die Hz-eigen-Felder (`.fo`) sind ebenfalls gesperrt — wie schon
     in den vorherigen BAs.
9. **Mit der Maus auf ein gesperrtes Aktiv-Häkchen klicken.**
   Erwartet:
   - Das Sperr-Popup öffnet **sofort** (kein Hover-Warten), zeigt
     Feldname „Aktivitäts-Häkchen einer Elektrode" + Reason
     „Lautstärke-Test".
   - Der Häkchen-Zustand ändert sich **nicht**.
10. **Smartphone-/Touch-Test** (Devtools-Touch-Modus): Tap auf das
    gesperrte Häkchen öffnet das Popup wie auf Desktop, kein Toggle.
11. **Lautstärke-Daten löschen.** Zurück zum Implantat-Reiter,
    **kein F5**. Erwartet: alle Aktiv-Häkchen wieder frei klickbar,
    kein gedämpfter Stil.
12. **F5-Vergleich:** Schritte 7-9 erneut, dazwischen F5 drücken.
    Erwartet: gleiches Verhalten vor und nach F5 — keine
    Inkonsistenz.
13. **Alte JSON-Datei laden** (eine mit `electrodeStatus[i] =
    "deactivated"` aus einer Vorgänger-Version). Erwartet: Die
    betreffende Elektrode hat im neuen Tool die Aktiv-Checkbox
    **nicht** gehakt, ihre Status-Spalte zeigt „ok" (leer), die
    Zeile ist halbtransparent. Die Ausschluß-Checkbox am Zeilenende
    ist gehakt (aber **nicht** disabled) — durch die einmalige
    Migrations-Setzung von `elExDur`.
14. **Tool speichern (`saveJson`).** Die neue JSON-Datei in einem
    Texteditor öffnen. Erwartet: Eintrag `electrodeActive: [true,
    true, false, true, …]` vorhanden. Eintrag `electrodeStatus`
    enthält für die deaktivierten Elektroden `null`.
15. **Reiter Implantat → Konfiguration auf „Hörgerät" umstellen.**
    Erwartet: Frequenztabelle zeigt akustische Variante; **keine**
    Aktiv-Spalte.
16. **Druck Implantat-Tab** (Knopf „🖨 Drucken" oben in der
    Implantat-Karte). Erwartet: in der gedruckten Tabelle erscheint
    eine zusätzliche Spalte „Aktiv" mit `✓` oder `—`.
17. **Audiologen-Bericht** im Reiter Laden/Speichern erzeugen.
    Erwartet: Im Status-Feld einer inaktiven Elektrode steht
    „Im CI deaktiviert".
18. **Reiter Frequenzabgleich-Test starten.** Erwartet: Inaktive
    Elektroden werden im Test übersprungen.
19. **Reiter Kurven (Schieber-Tab)** öffnen. Erwartet: Inaktive
    Elektroden werden nicht fokussierbar / übersprungen.
20. **Browser-DevTools (F12) → Application → Session Storage →
    ci-lb-v4** öffnen. Erwartet: In `sides.left.electrodeActive`
    erscheint ein Array `[true, true, false, …]`.

---

## Selbstprüfungs-Auftrag an Sonnet

Vor der Fertigmeldung jeden der 20 Akzeptanz-Schritte einzeln
durchgehen und melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

Zusätzlich melden:
- Wurde `let elActive = [];` als globale Variable in
  `js/state-side.js` ergänzt?
- Wird `elActive = s.elActive` in `bindActiveSide()` gebunden, mit
  Fallback auf `new Array(s.nEl).fill(true)`?
- Wurde `s.elActive = new Array(s.nEl).fill(true)` in
  `initSideData()` ergänzt?
- Wurde die Migration in `loadSideData` UND `loadOldFormat` ergänzt
  — inklusive einmaligem `elExDur`-Setzen für alte
  `"deactivated"`-Einträge?
- Wird `electrodeActive` in `saveJson()` und `_autoSaveState()` für
  **beide** Seiten geschrieben?
- Wurde die Spalte „Aktiv" in der CI-Tabelle hinzugefügt? Datei/Zeile.
- Wurde die `deactivated`-Option aus dem Status-Dropdown entfernt?
- Wurde die `disabled`-Logik der Ausschluss-Checkbox entfernt
  (kein `isDeact`-Bezug mehr in `<td><input class="ec" ...>`)?
- Wurde der Event-Handler für `.ec-active` mit Sicherheitsnetz
  und **ohne** `elExDur`-Manipulation ergänzt?
- Wurden `_depHasData` und `_depStatusReasons` aus
  `js/freq-table.js` **entfernt**?
- Wurde die neue Regel `selectorAll: '.ec-active'` in
  `DEP_LOCK_RULES` ergänzt? Wurde das Komma nach der vorigen Regel
  korrekt gesetzt?
- Wurde der Stil `input.ec-active.dep-locked` in `style.css`
  ergänzt?
- Liefert `_audStatusText` für eine inaktive Elektrode
  `t("stDeactivated")` zurück?
- Wurde im `printImplantTab()` die Aktiv-Spalte ergänzt?
- **Vollständigkeits-Check**: Liefert
  `grep -rn "elSt\[.*\] === ['\"]deactivated['\"]" js/`
  jetzt **null** Treffer? Liste sonst alle übrig gebliebenen
  Stellen mit Begründung.
- Steht `js/version.js` auf `3.1.164-beta`?

---

## Übersicht der geänderten Dateien

- `js/version.js` — Versions-Bump
- `js/state-side.js` — `elActive` global, `initSideData`,
  `loadSideData`, `implantSnapshot`, `bindActiveSide`
- `js/file.js` — `saveJson`, `loadOldFormat`
- `js/init.js` — `_autoSaveState` ergänzt
- `js/freq-table.js` — Aktiv-Spalte, Status-Optionen, Event-Handler,
  Hinweis-/Warnbalken, `_depHasData`/`_depStatusReasons` entfernt
- `js/freqmatch.js` — zwei Skip-Bedingungen
- `js/levels-tab.js` — drei Inaktiv-Bedingungen
- `js/implant-validate.js` — 15+ Treffer
- `js/tab-print.js` — Status-Map, Aktiv-Spalte im Implantat-Druck
- `js/print-md.js` — zwei Status-Maps, `_audStatusText`
- `js/dependency-lock.js` — neue Regel `selectorAll: '.ec-active'`
- `style.css` — `input.ec-active.dep-locked`
- `i18n/de.js` — `thActive`, `depFieldActive`

---

## Nicht in dieser Bauanleitung enthalten

- Übersetzungen en/fr/es für `thActive`, `depFieldActive` —
  eigene Mini-Anleitung, wenn deutsche Vorlage steht.
- Anpassung der Hinweis-/Warntexte `freqDeactHint` und
  `warnDeactivated` an die neue UI-Sprache („Aktiv-Häkchen" statt
  „Status deaktiviert"). Inhaltlich bleibt der Hinweis gleich;
  Textüberarbeitung in einer Folge-BA, wenn der Aktiv-Mechanismus
  steht.
- **BA 165** — L↔R-Knöpfe im Reiter Kurven.
