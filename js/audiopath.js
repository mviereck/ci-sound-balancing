// ====================================================================
// audiopath.js — Mess-Kontext "Audioweg": Katalog + ID-Vergabe
// --------------------------------------------------------------------
// Architektur: .docs/spec/00-messkontext-audioweg-architektur.md
//
// Der Audioweg beschreibt je Seite die Uebertragungskette Signal->Ohr.
// Dieses Modul haelt NUR den seitenlos-gemeinsamen Katalog und die
// fortlaufende ID-Vergabe. Die aktive Auswahl je Seite liegt seitenweise
// (state-side.js / save-schema.js), das Einfrieren in Messungen kommt in
// einer spaeteren BA.
//
// Exportierte Globals:
//   AWG_catalog   Array<{ id, label, hidden }> — seitenlos, inkl. ID 0
//   AWG_nextId    number — naechste zu vergebende ID (fortlaufend, nie recycelt)
//
// Exportierte Funktionen:
//   AWG_init()                  — Katalog auf Startzustand (nur ID 0), idempotent
//   AWG_label(id)               — Beschreibungstext zu einer id (Fallback "(keine Angabe)")
//   AWG_visibleEntries()        — sichtbare Eintraege (hidden !== true), inkl. ID 0
//   AWG_add(label)              — neuen Eintrag anlegen, gibt dessen id zurueck
//   AWG_rename(id, label)       — Beschreibungstext aendern (ID 0 unveraenderlich)
//   AWG_hide(id)                — Eintrag ausblenden (ID 0 nicht ausblendbar)
//   AWG_distribution(ids)      — Liste von ids -> Verteilung [{id,count}] (absteigend), null bei leer
//   AWG_boxHtml(sides)         — HTML der "Audiowege"-Box, "" wenn alle Seiten leer
// ====================================================================

// Reservierte ID des Default-Eintrags "(keine Angabe)". label wird
// sprachabhaengig ueber t("AWG_none") aufgeloest, daher hier leer.
const AWG_NONE_ID = 0;

let AWG_catalog = [];
let AWG_nextId  = 1;

// Startzustand: nur der reservierte Default-Eintrag, Vergabe beginnt bei 1.
// Idempotent — ein bereits geladener Katalog (aus gespeicherten Daten)
// wird NICHT ueberschrieben; nur ein leerer Katalog bekommt die ID 0.
function AWG_init() {
  if (!Array.isArray(AWG_catalog) || AWG_catalog.length === 0) {
    AWG_catalog = [{ id: AWG_NONE_ID, label: "", hidden: false }];
    AWG_nextId  = 1;
  }
}

function AWG_label(id) {
  if (id === AWG_NONE_ID || id == null) {
    return (typeof t === "function") ? t("AWG_none") : "(keine Angabe)";
  }
  const e = AWG_catalog.find(function (x) { return x.id === id; });
  if (!e) {
    // Unbekannte id (sollte nicht vorkommen) -> wie Default behandeln.
    return (typeof t === "function") ? t("AWG_none") : "(keine Angabe)";
  }
  return e.label;
}

// Verdichtet eine Liste von Audioweg-ids (ein Eintrag je gewertetem
// Meszschritt, Reihenfolge egal, ID 0 und null zaehlen als "(keine
// Angabe)") zu einer Verteilung:
//   [ { id, count }, ... ], absteigend nach count.
// Leere Eingabe -> null (nichts gemessen). Das ersetzt die fruehere
// skalare Verdichtung (id | "gemischt" | null); "gemischt" ist jetzt
// einfach eine Liste mit mehr als einem Eintrag.
// Einzige Stelle, die diese Verdichtung kennt -- alle vier Tests rufen sie.
function AWG_distribution(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  var counts = {};
  for (var i = 0; i < ids.length; i++) {
    var id = (ids[i] != null) ? ids[i] : 0;   // null/undefined -> ID 0
    counts[id] = (counts[id] || 0) + 1;
  }
  var out = Object.keys(counts).map(function (k) {
    return { id: parseInt(k, 10), count: counts[k] };
  });
  // Absteigend nach count; bei Gleichstand aufsteigend nach id (stabil,
  // reproduzierbar).
  out.sort(function (a, b) {
    return (b.count - a.count) || (a.id - b.id);
  });
  return out;
}

// ====================================================================
// Audiowege-Anzeige auf den Auswertungsseiten (Architektur §3.5).
// EINE test-agnostische Box fuer alle vier Tests. Liest NICHT die
// Rohwerte, sondern die in der Auswertung eingefrorene Verteilung
// (audioPath = [{id,count}] je Seite, aus AWG_distribution).
// ====================================================================

// Eine Weg-Zeile aus einer Verteilung: alle Wege absteigend nach Anteil
// (die Liste ist bereits sortiert), Format "Label (X von N, p %)".
// Bei genau EINEM Weg nur das Label ohne Klammer. Prozent wird hier LIVE
// gerechnet (nicht gespeichert). dist = [{id,count}] | null.
function _awgDistText(dist) {
  if (!Array.isArray(dist) || dist.length === 0) return null;
  var n = 0;
  for (var i = 0; i < dist.length; i++) n += dist[i].count;
  if (n === 0) return null;
  if (dist.length === 1) return AWG_label(dist[0].id);   // ein Weg: ohne Klammer
  return dist.map(function (e) {
    var p = Math.round((e.count / n) * 100);
    return AWG_label(e.id) + " (" + e.count + " " + t("AWG_boxOf") + " " + n + ", " + p + " %)";
  }).join(" · ");
}

// Baut das HTML der "Audiowege"-Box. sides = Array von
//   { side: "left"|"right"|null, dist: [{id,count}]|null }
// side === null -> einseitige Anzeige ohne Seiten-Praefix (ELL; SNR
// einseitig). Zwei Eintraege -> je eine Unterzeile "Links:"/"Rechts:".
// Gibt "" zurueck, wenn KEINE Seite eine nicht-leere Verteilung hat
// (dann zeigt der Aufrufer die Box gar nicht).
function AWG_boxHtml(sides) {
  var rows = [];
  for (var i = 0; i < sides.length; i++) {
    var txt = _awgDistText(sides[i].dist);
    if (txt === null) continue;   // leere Seite ueberspringen
    var s = sides[i].side;
    if (s === "left" || s === "right") {
      var pre = (s === "left") ? t("AWG_boxLeft") : t("AWG_boxRight");
      rows.push("<div><strong>" + pre + "</strong> " + txt + "</div>");
    } else {
      rows.push("<div>" + txt + "</div>");
    }
  }
  if (rows.length === 0) return "";
  return "<div class=\"awg-box\">"
       + "<div class=\"awg-box-title\">" + t("AWG_boxTitle") + "</div>"
       + rows.join("")
       + "</div>";
}

function AWG_visibleEntries() {
  return AWG_catalog.filter(function (x) { return x.hidden !== true; });
}

// Neuer Eintrag. Leeres/whitespace-Label wird abgewiesen (gibt null).
// id wird fortlaufend aus AWG_nextId vergeben und NIE recycelt.
function AWG_add(label) {
  const txt = (label == null) ? "" : String(label).trim();
  if (!txt) return null;
  const id = AWG_nextId;
  AWG_nextId = AWG_nextId + 1;
  AWG_catalog.push({ id: id, label: txt, hidden: false });
  return id;
}

// Beschreibungstext aendern. ID 0 ist unveraenderlich. Die id bleibt
// unberuehrt — es wird NUR der Text ersetzt (pauschaler Warnhinweis liegt
// in der UI, Abschnitt 5).
function AWG_rename(id, label) {
  if (id === AWG_NONE_ID) return false;
  const txt = (label == null) ? "" : String(label).trim();
  if (!txt) return false;
  const e = AWG_catalog.find(function (x) { return x.id === id; });
  if (!e) return false;
  e.label = txt;
  return true;
}

// Die EINZIGE Funktion, die je ein Rohmeszschritt-Objekt durchsieht.
// Jeder Eintrag traegt das vereinheitlichte Feld audioweg:{left,right}.
// side = "left"|"right" -> nur diese Seite; weggelassen -> beide Seiten
// flach hintereinander. Reihenfolge = Listen-Reihenfolge des entries-Arrays
// (fuer die Vortest-Box: letzter in der Liste = zuletzt gemessen).
// Fehlendes audioweg oder fehlende Seite -> ID 0.
function AWG_usedIds(entries, side) {
  var out = [];
  var sides = side ? [side] : ["left", "right"];
  (entries || []).forEach(function (e) {
    if (!e || !e.audioweg) return;
    for (var i = 0; i < sides.length; i++) {
      var v = e.audioweg[sides[i]];
      out.push((v != null) ? v : 0);
    }
  });
  return out;
}

// Die EINZIGE Stelle, die weiss, WO die Rohwert-Listen aller Tests liegen.
// Liefert ein Array von Eintragslisten (je Test eine oder mehrere). Sieht
// selbst nichts durch -- das tut AWG_usedIds. Defensiv gegen undefined,
// da audiopath.js frueh laedt.
// SNAPSHOT-FAEHIG: sobald es Snapshots gibt, wird hier EINE weitere Quelle
// ergaenzt (ihre Rohwert-Listen); die fuenf Tests und AWG_usedIds bleiben
// unberuehrt, weil Snapshot-Eintraege dasselbe audioweg-Feld tragen.
function AWG_usedCollect() {
  var lists = [];
  // ELL: sideData[side].ELL_raw = { durchlauf, messpunkte }. audioweg liegt an
  // den Schritten in historie (eine Ebene tiefer). (Vereinheitlichung dieser
  // Sammelstelle folgt, sobald alle Container das Grundmuster tragen.)
  if (typeof sideData !== "undefined") {
    ["left", "right"].forEach(function (s) {
      var c = sideData[s] && sideData[s].ELL_raw;
      if (c && Array.isArray(c.messpunkte)) {
        var ellAll = [];
        c.messpunkte.forEach(function (p) {
          if (p && Array.isArray(p.historie)) {
            for (var i = 0; i < p.historie.length; i++) ellAll.push(p.historie[i]);
          }
        });
        lists.push(ellAll);
      }
    });
  }
  // STB: STB_raw = { durchlauf, messpunkte:[{bezug,historie}] }. audioweg liegt
  // an den Schritten in historie (eine Ebene tiefer). (Vereinheitlichung dieser
  // Sammelstelle folgt, sobald alle Container das Grundmuster tragen.)
  if (typeof STB_raw !== "undefined" && STB_raw && Array.isArray(STB_raw.messpunkte)) {
    var stbAll = [];
    STB_raw.messpunkte.forEach(function (p) {
      if (p && Array.isArray(p.historie)) {
        for (var i = 0; i < p.historie.length; i++) stbAll.push(p.historie[i]);
      }
    });
    lists.push(stbAll);
  }
  // Latenz: LTZ_raw = { durchlauf, messpunkte:[{bezug,historie}] }. Die
  // audioweg-tragenden Objekte sind die Schritte in historie, eine Ebene
  // tiefer als die Meszpunkte. (Vereinheitlichung dieser Sammelstelle folgt,
  // sobald alle Container das Grundmuster tragen.)
  if (typeof LTZ_raw !== "undefined" && LTZ_raw && Array.isArray(LTZ_raw.messpunkte)) {
    var ltzAll = [];
    LTZ_raw.messpunkte.forEach(function (p) {
      if (p && Array.isArray(p.historie)) {
        for (var i = 0; i < p.historie.length; i++) ltzAll.push(p.historie[i]);
      }
    });
    lists.push(ltzAll);
  }
  // FRQ: messpunkte[el].historie[] -> flach zu einer Liste (audioweg je Schritt).
  if (typeof FRQ_rawPiano !== "undefined" && FRQ_rawPiano && Array.isArray(FRQ_rawPiano.messpunkte)) {
    var frqAll = [];
    FRQ_rawPiano.messpunkte.forEach(function (p) {
      if (p && Array.isArray(p.historie)) {
        for (var i = 0; i < p.historie.length; i++) frqAll.push(p.historie[i]);
      }
    });
    lists.push(frqAll);
  }
  // SNR: binaural global + je Seite. audioweg liegt an den Schritten in
  // messpunkte[].historie (fuer alle Saetze eines Durchgangs derselbe Weg).
  function _snrSchritte(c) {
    var out = [];
    if (c && Array.isArray(c.messpunkte)) {
      c.messpunkte.forEach(function (p) {
        if (p && Array.isArray(p.historie)) {
          for (var i = 0; i < p.historie.length; i++) out.push(p.historie[i]);
        }
      });
    }
    return out;
  }
  if (typeof SNR_rawBoth !== "undefined" && SNR_rawBoth) lists.push(_snrSchritte(SNR_rawBoth));
  if (typeof sideData !== "undefined") {
    ["left", "right"].forEach(function (s) {
      if (sideData[s] && sideData[s].SNR_rawSide) lists.push(_snrSchritte(sideData[s].SNR_rawSide));
    });
  }
  return lists;
}

// Wird dieser Audioweg von irgendeiner Messung referenziert? Durchsucht die
// eingefrorenen audioweg-Felder aller Rohmessungen ueber die eine Durchsicht
// AWG_usedIds (voller Umfang via AWG_usedCollect). Die fluechtige aktive
// Auswahl (sideData[side].AWG_activeId) zaehlt bewusst NICHT (nur
// abgeschlossene Messungen). BEWUSSTE Rohwert-Ausnahme: AWG_isUsed fragt
// "existiert eine Rohwert-Referenz, die beim Entfernen braeche", nicht "was
// ist gewertet" -- darum ueber die Rohwerte, nicht die Auswertung.
// Spaeter kommen die Snapshot-Listen als weitere Quelle in AWG_usedCollect.
function AWG_isUsed(id) {
  if (id === AWG_NONE_ID) return false;
  return AWG_usedCollect().some(function (entries) {
    return AWG_usedIds(entries).indexOf(id) >= 0;
  });
}

// Ausblenden: Datensatz bleibt erhalten (benutzte Eintraege, deren alte
// Messungen Bezug + Bezeichnung brauchen), nur hidden=true. ID 0 nicht
// ausblendbar.
function AWG_hide(id) {
  if (id === AWG_NONE_ID) return false;
  const e = AWG_catalog.find(function (x) { return x.id === id; });
  if (!e) return false;
  e.hidden = true;
  return true;
}

// Echtes Entfernen aus dem Katalog — nur fuer UNbenutzte Eintraege. Die
// id bleibt dennoch fuer immer verbraucht (AWG_nextId zaehlt nur vorwaerts,
// wird hier nicht zurueckgesetzt). ID 0 nicht entfernbar.
function AWG_remove(id) {
  if (id === AWG_NONE_ID) return false;
  const i = AWG_catalog.findIndex(function (x) { return x.id === id; });
  if (i < 0) return false;
  AWG_catalog.splice(i, 1);
  return true;
}

// Sentinel-Wert der letzten Dropdown-Option ("Neuer Eintrag...").
const AWG_OPT_NEW = "__new__";

// Baut beide Audioweg-Dropdowns neu. Einzige Render-Stelle; von
// AWG_setActive, applyLang-Nachlauf und nach Katalog-Aenderungen gerufen.
function AWG_renderSelects() {
  ["left", "right"].forEach(function (side) {
    const sel = document.getElementById(
      side === "left" ? "awgSelectLeft" : "awgSelectRight");
    if (!sel) return;
    const activeId = (typeof sideData !== "undefined" && sideData[side] && sideData[side].AWG_activeId != null)
      ? sideData[side].AWG_activeId : 0;
    sel.innerHTML = "";
    AWG_visibleEntries().forEach(function (e) {
      const opt = document.createElement("option");
      opt.value = String(e.id);
      opt.textContent = (e.id === AWG_NONE_ID) ? AWG_label(AWG_NONE_ID) : e.label;
      if (e.id === activeId) opt.selected = true;
      sel.appendChild(opt);
    });
    const optNew = document.createElement("option");
    optNew.value = AWG_OPT_NEW;
    optNew.textContent = (typeof t === "function") ? t("AWG_optNew") : "Neuer Eintrag…";
    sel.appendChild(optNew);
  });
}

// Change-Handler eines Audioweg-Dropdowns. side = "left"|"right".
function AWG_onSelectChange(side, value) {
  if (value === AWG_OPT_NEW) {
    AWG_openAddModal(side);   // Abschnitt 5
    return;
  }
  const id = parseInt(value, 10);
  if (!isNaN(id) && typeof AWG_setActive === "function") AWG_setActive(side, id);
}

// Merkt sich, aus welchem Dropdown die Anlege-Box geoeffnet wurde, damit
// der neue Eintrag gleich als aktive Auswahl DIESER Seite gesetzt wird.
let _awgAddFromSide = null;

function _awgShow(dlg) {
  if (!dlg) return;
  if (typeof dlg.showModal === "function") dlg.showModal();
  else dlg.setAttribute("open", "open");
}
function _awgClose(dlg) {
  if (!dlg) return;
  if (typeof dlg.close === "function") dlg.close();
  else dlg.removeAttribute("open");
}

// Oeffnet die Anlege-Box. side = Dropdown, aus dem geoeffnet wurde.
// Das Dropdown wird sofort auf den aktiven Wert zurueckgestellt, damit es
// nicht auf "__new__" stehen bleibt, falls der Nutzer abbricht.
function AWG_openAddModal(side) {
  _awgAddFromSide = side;
  if (typeof AWG_renderSelects === "function") AWG_renderSelects();
  const input = document.getElementById("awgAddInput");
  if (input) input.value = "";
  // "Verwalten..." nur anbieten, wenn es verwaltbare Eintraege gibt —
  // sonst fuehrte der Knopf in eine leere (nicht geoeffnete) Box.
  const manageBtn = document.getElementById("awgManageOpen");
  if (manageBtn) manageBtn.style.display =
    (_awgManageableEntries().length > 0) ? "" : "none";
  _awgShow(document.getElementById("awgAddDialog"));
  if (input) input.focus();
}

function _awgAddConfirm() {
  const input = document.getElementById("awgAddInput");
  const id = (typeof AWG_add === "function") ? AWG_add(input ? input.value : "") : null;
  _awgClose(document.getElementById("awgAddDialog"));
  if (id != null && _awgAddFromSide && typeof AWG_setActive === "function") {
    AWG_setActive(_awgAddFromSide, id);   // rendert Selects + speichert
  } else if (typeof AWG_renderSelects === "function") {
    AWG_renderSelects();
  }
  _awgAddFromSide = null;
}

// Verwaltbar sind alle sichtbaren Eintraege ausser dem Default (ID 0).
function _awgManageableEntries() {
  return AWG_visibleEntries().filter(function (e) { return e.id !== AWG_NONE_ID; });
}

// Baut die Zeilen der Verwalten-Box: je Eintrag ein Textfeld (Umbenennen)
// und ein Loeschen-Knopf. Nur Fuellen der Liste, kein Oeffnen/Schliessen.
function _awgBuildManageList() {
  const list = document.getElementById("awgManageList");
  if (!list) return;
  list.innerHTML = "";
  _awgManageableEntries().forEach(function (e) {
    const row = document.createElement("div");
    row.className = "awg-manage-row";
    const txt = document.createElement("input");
    txt.type = "text";
    txt.value = e.label;
    txt.addEventListener("change", function () {
      if (typeof AWG_rename === "function") AWG_rename(e.id, this.value);
      if (typeof AWG_renderSelects === "function") AWG_renderSelects();
      if (typeof _autoSaveState === "function") _autoSaveState();
    });
    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = (typeof t === "function") ? t("AWG_deleteBtn") : "Löschen";
    del.addEventListener("click", function () {
      if (AWG_isUsed(e.id)) {
        // Benutzter Eintrag: nur ausblenden, nach Rueckfrage.
        const msg = (typeof t === "function") ? t("AWG_delUsedConfirm")
          : "Der Eintrag wird bereits genutzt. Löschen wird ihn nur in der Liste ausblenden. Fortfahren?";
        if (!window.confirm(msg)) return;
        AWG_hide(e.id);
      } else {
        // Unbenutzter Eintrag: echt entfernen. War er gerade als aktive
        // Auswahl einer Seite gesetzt, faellt diese auf "(keine Angabe)"
        // (ID 0) zurueck -- sonst zeigte das Dropdown einen entfernten Weg.
        if (typeof sideData !== "undefined" && typeof AWG_setActive === "function") {
          ["left", "right"].forEach(function (side) {
            if (sideData[side] && sideData[side].AWG_activeId === e.id) {
              AWG_setActive(side, AWG_NONE_ID);
            }
          });
        }
        AWG_remove(e.id);
      }
      if (typeof AWG_renderSelects === "function") AWG_renderSelects();
      if (typeof _autoSaveState === "function") _autoSaveState();
      // War das der letzte verwaltbare Eintrag, hat die Box nichts mehr zu
      // tun -> schliessen statt in leerer Box stranden. Sonst Liste neu
      // aufbauen, Box bleibt offen.
      if (_awgManageableEntries().length === 0) {
        _awgClose(document.getElementById("awgManageDialog"));
      } else {
        _awgBuildManageList();
      }
    });
    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  });
}

// Oeffnet die Verwalten-Box — nur, wenn es ueberhaupt verwaltbare
// Eintraege gibt (sonst gaebe es eine leere Box ohne Aktion).
function AWG_openManageModal() {
  if (_awgManageableEntries().length === 0) return;
  _awgBuildManageList();
  _awgShow(document.getElementById("awgManageDialog"));
}
