#!/usr/bin/env python3
"""Stick-Updater-Kern (unprivilegiert, keine UI).

Sub-Kommandos: manifest / audio-status / audio-sync / vorhanden.
Von der grafischen Updater-Oberflaeche (eigenes Skript) aufgerufen; fuer
bereich=system-root ruft die UI dieses Skript gebuendelt via pkexec.
"""
import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

DEF_STICK_ROOT = "/mnt/daten/cimbel-intern/git/ci-sound-balancing/stick-files"
DEF_OPUS_ROOT = "/mnt/daten/cimbel-intern/opus"
DEF_WEBSPACE = "https://www.ci-sound-balancing.org/opus/"
# audio.bundle/ liegt ausserhalb des git-Repos (wie opus/) und wird per
# Buendel-Sync gepflegt. Lokaler Ort am Stick + Webspace-Quelle (Wurzel, neben
# index.html -- NICHT unter /opus/).
DEF_BUNDLE_ROOT = "/mnt/daten/cimbel-intern/audio.bundle"
DEF_BUNDLE_WEBSPACE = "https://www.ci-sound-balancing.org/audio.bundle/"

# Schrumpf-Schutz: loescht audio-sync mehr als diesen Anteil der lokal
# vorhandenen Opus-Dateien, bricht es ab (vermuteter Unfall). Gleiche Schwelle
# wie der Builder-Nachlauf verify_local_audio.
LOESCH_SCHWELLE = 0.5

# Harter Loesch-Schutz: Dateien unter diesen Praefixen werden NIE geloescht --
# weder per Muelleimer (teilmenge_loeschen) noch als Nebeneffekt des Abgleichs
# (audio_sync verwaist-Loeschen). Laden/Aktualisieren bleibt erlaubt. Grund:
# die Hagermann-Testsaetze werden fuer den CImbel-Sprachtest gebraucht; ein
# versehentliches Loeschen wuerde den Test unbrauchbar machen. Der Schutz sitzt
# im Kern (eine Stelle), nicht nur in der GUI -- jeder Loeschweg respektiert ihn.
GESCHUETZTE_PRAEFIXE = ("testsaetze-hagermann/",)


def _ist_geschuetzt(pfad):
    return any(pfad.startswith(p) for p in GESCHUETZTE_PRAEFIXE)


def _expand(ziel):
    """~ expandieren (home-Bereich)."""
    return os.path.expanduser(ziel)


# Deutsche MANIFEST-Platzhalter -> xdg-user-dir-Schluessel. Locale-korrekt:
# @SCHREIBTISCH@ loest auf einem englischen System zu ~/Desktop auf, auf einem
# deutschen zu ~/Schreibtisch. So bleibt das MANIFEST sprachunabhaengig.
_XDG_PLATZHALTER = {
    "@SCHREIBTISCH@": "DESKTOP",
    "@MUSIK@": "MUSIC",
    "@DOWNLOADS@": "DOWNLOAD",
    "@DOKUMENTE@": "DOCUMENTS",
    "@BILDER@": "PICTURES",
    "@VIDEOS@": "VIDEOS",
}


class ZielFehler(Exception):
    """Zielpfad nicht aufloesbar (unbekannter/nicht ermittelbarer Platzhalter)."""
    pass


def _loese_ziel(ziel):
    """Loest ein MANIFEST-ziel auf: fuehrt ggf. einen @NAME@-Platzhalter (XDG-
    Ordner) ueber xdg-user-dir auf, danach ~ expandieren. Beginnt ziel mit
    '@', MUSS der Platzhalter bekannt und aufloesbar sein -- sonst ZielFehler
    (statt still ins falsche Verzeichnis zu schreiben). Ohne Platzhalter:
    nur ~ expandieren (wie bisher)."""
    if ziel.startswith("@"):
        ende = ziel.find("@", 1)
        if ende < 0:
            raise ZielFehler("ungueltiger Platzhalter in: " + ziel)
        name = ziel[:ende + 1]                    # inkl. schliessendem @
        rest = ziel[ende + 1:].lstrip("/")
        schluessel = _XDG_PLATZHALTER.get(name)
        if not schluessel:
            raise ZielFehler("unbekannter Platzhalter: " + name)
        try:
            basis = subprocess.run(["xdg-user-dir", schluessel],
                                    capture_output=True, text=True).stdout.strip()
        except OSError:
            basis = ""
        if not basis:
            raise ZielFehler("Zielordner " + name + " nicht auffindbar (xdg-user-dir)")
        return os.path.join(basis, rest) if rest else basis
    return os.path.expanduser(ziel)


# ---------------------------------------------------------------- Download

def _download(url, ziel_path):
    """Laedt url nach ziel_path. Idempotent/abbruchrobust: erst in .part,
    dann umbenennen (ein abgebrochener Download hinterlaesst keine halbe
    gueltige Datei). Zielverzeichnis wird angelegt. Wirft bei Fehler."""
    ziel_path = Path(ziel_path)
    ziel_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = ziel_path.with_suffix(ziel_path.suffix + ".part")
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(65536)
            if not chunk:
                break
            f.write(chunk)
    os.replace(tmp, ziel_path)


def _opus_download_if_needed(rel_pfad, soll_groesse, opus_root, webspace, force):
    """Laedt eine Opus-Datei (rel_pfad relativ unter opus/) vom Webspace, wenn
    noetig: bei force, wenn Ziel fehlt ODER Groesse != soll_groesse; bei
    nicht-force (nur-wenn-fehlt) nur, wenn Ziel fehlt. Gibt True zurueck, wenn
    geladen wurde."""
    ziel = Path(opus_root) / rel_pfad
    if ziel.exists():
        if not force:
            return False                      # nur-wenn-fehlt: schon da
        if soll_groesse is not None and ziel.stat().st_size == soll_groesse:
            return False                      # force, aber Groesse stimmt -> nichts zu tun
    url = webspace.rstrip("/") + "/" + rel_pfad
    _download(url, ziel)
    return True


# ---------------------------------------------------------------- Soll-Liste

def _lade_soll(webspace):
    """Soll-Liste vom Webspace holen. Rueckgabe: dict pfad -> groesse(int).
    Jede Zeile: pfad<TAB>groesse. Wirft bei Nichterreichbarkeit."""
    url = webspace.rstrip("/") + "/soll-items.txt"
    with urllib.request.urlopen(url) as r:
        txt = r.read().decode("utf-8")
    soll = {}
    for zeile in txt.splitlines():
        zeile = zeile.strip()
        if not zeile:
            continue
        if "\t" not in zeile:
            continue
        pfad, groesse = zeile.rsplit("\t", 1)   # am LETZTEN Tab: Pfad darf Leerzeichen/Tabs enthalten
        try:
            soll[pfad] = int(groesse)
        except ValueError:
            continue
    return soll


def _lies_vorhanden(opus_root):
    """Liest opus/vorhanden.txt -> dict relpfad -> groesse. Zeile
    `relpfad<TAB>groesse`, am LETZTEN Tab getrennt (Pfade duerfen Leerzeichen
    enthalten). Fehlt die Datei oder eine Zeile ohne Tab -> uebersprungen."""
    pfad = Path(opus_root) / "vorhanden.txt"
    ist = {}
    try:
        txt = pfad.read_text(encoding="utf-8")
    except OSError:
        return ist
    for zeile in txt.splitlines():
        zeile = zeile.rstrip("\n")
        if not zeile:
            continue
        if "\t" not in zeile:
            continue
        rel, groesse = zeile.rsplit("\t", 1)
        try:
            ist[rel] = int(groesse)
        except ValueError:
            continue
    return ist


def _ist_bestand(opus_root):
    """Lokaler Opus-Bestand: dict relpfad -> groesse. Liest vorhanden.txt
    (schnell); fehlt sie, wird sie einmal per Scan erzeugt (teuer, nur beim
    Erststart). Nach einem audio-sync schreibt der Sync die Liste neu."""
    opus_root = Path(opus_root)
    if not (opus_root / "vorhanden.txt").is_file():
        _schreibe_vorhanden(opus_root)
    return _lies_vorhanden(opus_root)


# ---------------------------------------------------------------- MANIFEST

def _lade_manifest(stick_root):
    pfad = Path(stick_root) / "MANIFEST.json"
    with open(pfad, encoding="utf-8") as f:
        return json.load(f)


def _manifest_eintrag_anwenden(e, stick_root, opus_root, webspace):
    """Wendet EINEN MANIFEST-Eintrag an. Gibt eine kurze Meldung zurueck."""
    herkunft = e.get("herkunft")
    typ = e.get("typ", "datei")
    quelle = e.get("quelle", "")
    ziel = e.get("ziel", "")
    modus = e.get("modus", "force")

    # loeschen: gezielt, unabhaengig von herkunft/typ.
    if modus == "loeschen":
        try:
            zp = Path(_loese_ziel(ziel))
        except ZielFehler as e:
            return "FEHLER: " + str(e)
        if zp.exists():
            zp.unlink()
            return "geloescht: " + ziel
        return "schon weg: " + ziel

    if herkunft == "repo":
        try:
            ziel_aufgeloest = _loese_ziel(ziel)
        except ZielFehler as e:
            return "FEHLER: " + str(e)
        src_basis = Path(stick_root) / quelle
        if typ == "ordner":
            n = 0
            for src in src_basis.rglob("*"):
                if not src.is_file():
                    continue
                rel = src.relative_to(src_basis).as_posix()
                zp = Path(ziel_aufgeloest) / rel
                if modus == "nur-wenn-fehlt" and zp.exists():
                    continue
                zp.parent.mkdir(parents=True, exist_ok=True)
                zp.write_bytes(src.read_bytes())       # force=immer kopieren
                n += 1
            return "repo-ordner " + quelle + ": " + str(n) + " Datei(en)"
        else:
            zp = Path(ziel_aufgeloest)
            if modus == "nur-wenn-fehlt" and zp.exists():
                return "vorhanden, uebersprungen: " + ziel
            zp.parent.mkdir(parents=True, exist_ok=True)
            zp.write_bytes(src_basis.read_bytes())
            return "repo-datei kopiert: " + ziel

    if herkunft == "opus":
        force = (modus == "force")
        soll = _lade_soll(webspace)
        if typ == "ordner":
            praefix = quelle
            n = 0
            for pfad, groesse in soll.items():
                if not pfad.startswith(praefix):
                    continue
                if _opus_download_if_needed(pfad, groesse, opus_root, webspace, force):
                    n += 1
            return "opus-ordner " + quelle + ": " + str(n) + " geladen"
        else:
            groesse = soll.get(quelle)
            geladen = _opus_download_if_needed(quelle, groesse, opus_root, webspace, force)
            return "opus-datei " + quelle + (": geladen" if geladen else ": aktuell")

    return "UNBEKANNTE herkunft: " + str(herkunft)


def cmd_manifest(args):
    eintraege = _lade_manifest(args.stick_root)
    gewuenscht = args.bereich
    for e in eintraege:
        if e.get("bereich", "home") != gewuenscht:
            continue
        msg = _manifest_eintrag_anwenden(e, args.stick_root, args.opus_root, args.webspace)
        print(msg)
    return 0


# ---------------------------------------------------------------- Audio

def _unter_praefix(pfad, praefixe):
    """True, wenn pfad unter einem der Praefixe liegt. praefixe=None bedeutet
    'kein Filter' (ganzer Bestand) -> immer True."""
    if praefixe is None:
        return True
    return any(pfad.startswith(p) for p in praefixe)


def _audio_diff(opus_root, webspace, praefixe=None):
    """Gibt (fehlend_oder_geaendert, verwaist) zurueck:
      fehlend_oder_geaendert: list[(pfad, soll_groesse)] -> muss geladen werden
      verwaist:               list[pfad] -> lokal da, aber nicht in Soll

    praefixe (optional): Liste erlaubter Pfad-Praefixe (Teilmengen-Auswahl).
    None = ganzer Bestand (heutiges Verhalten). Mit Filter zaehlen nur Soll-
    und Ist-Pfade unter einem der Praefixe -- so wird 'verwaist' auf die
    gewaehlten Teilmengen beschraenkt (nie ausserhalb geloescht)."""
    soll = _lade_soll(webspace)
    ist = _ist_bestand(opus_root)
    laden = []
    for pfad, groesse in soll.items():
        if not _unter_praefix(pfad, praefixe):
            continue
        if pfad not in ist or ist[pfad] != groesse:
            laden.append((pfad, groesse))
    verwaist = [p for p in ist
                if p not in soll and _unter_praefix(p, praefixe)]
    return laden, verwaist


def audio_gruppen(opus_root, webspace, gruppen):
    """Fuer die Fensteranzeige: pro Teilmengen-Praefix Gesamtgroesse (laut
    Soll) und 'Rest zu laden' (Soll minus lokal Vorhandenes). Kein Scan, liest
    nur Soll-Liste + vorhanden.txt.

    gruppen: list[(schluessel, praefix)]. Rueckgabe: dict schluessel ->
    (soll_bytes, soll_dateien, rest_bytes, rest_dateien). Ein Pfad zaehlt zur
    ersten Gruppe, deren Praefix er traegt (Reihenfolge der Liste zaehlt; so
    schlagen die M-AILABS-Sprecher-Praefixe nicht zusaetzlich beim groben
    'M-AILABS/'-Praefix an, falls beide in der Liste stuenden)."""
    soll = _lade_soll(webspace)
    ist = _ist_bestand(opus_root)
    erg = {schluessel: [0, 0, 0, 0] for schluessel, _ in gruppen}
    for pfad, groesse in soll.items():
        for schluessel, praefix in gruppen:
            if pfad.startswith(praefix):
                e = erg[schluessel]
                e[0] += groesse
                e[1] += 1
                if pfad not in ist or ist[pfad] != groesse:
                    e[2] += groesse
                    e[3] += 1
                break
    return {k: tuple(v) for k, v in erg.items()}


def cmd_audio_status(args):
    laden, verwaist = _audio_diff(args.opus_root, args.webspace)
    print("Zu laden (fehlend/geaendert): " + str(len(laden)))
    print("Lokal vorhanden, nicht in Soll: " + str(len(verwaist)))
    return 0


class SyncAbbruch(Exception):
    """Wird geworfen, wenn der Schrumpf-Schutz greift (zu viel zu loeschen)."""
    pass


def audio_sync(opus_root, webspace, fortschritt=None, praefixe=None):
    """Fuehrt den Audio-Abgleich aus: fehlende/geaenderte laden, Verwaistes
    loeschen (mit Schrumpf-Schutz), danach vorhanden.txt fortschreiben. Gibt
    (geladen, geloescht) zurueck. Wirft ValueError bei leerer/unerreichbarer
    Soll-Liste und SyncAbbruch bei ausgeloestem Schrumpf-Schutz.

    fortschritt(i, n, pfad): optionaler Callback, VOR dem Laden der i-ten von n
    zu ladenden Dateien aufgerufen (1-basiert). Fuer die GUI-Fortschrittsanzeige.

    praefixe (optional): Liste erlaubter Pfad-Praefixe (Teilmengen-Auswahl).
    None = ganzer Bestand (heutiges Verhalten). Mit Filter werden nur Dateien
    unter den gewaehlten Praefixen geladen UND nur dort Verwaistes geloescht --
    nie ausserhalb der Auswahl (Rueckruf bleibt teilmengen-gebunden). Der
    Schrumpf-Schutz bezieht sich auf den Ist-Bestand UNTER den Praefixen."""
    # Opus-Ordner + Marker-Datei zuerst sicherstellen: fehlt der Ordner ganz
    # (vom Nutzer geloescht), wuerde _ist_bestand -> _schreibe_vorhanden auf einem
    # nicht existenten Ordner scheitern. _ensure_opus_ping legt opus_root (und
    # opus.ping) an -> ein geloeschter Opus-Ordner wird vom Sync selbst
    # wiederhergestellt und die Audios frisch geladen.
    _ensure_opus_ping(opus_root)
    soll = _lade_soll(webspace)
    if not soll:
        raise ValueError("Soll-Liste leer oder nicht erreichbar")
    ist = _ist_bestand(opus_root)

    zu_laden = [(p, g) for p, g in soll.items()
                if _unter_praefix(p, praefixe) and (p not in ist or ist[p] != g)]
    geladen = 0
    geladen_pfade = {}                        # pfad -> soll_groesse (fuer vorhanden.txt)
    for i, (pfad, groesse) in enumerate(zu_laden, start=1):
        if fortschritt is not None:
            fortschritt(i, len(zu_laden), pfad)
        if _opus_download_if_needed(pfad, groesse, opus_root, webspace, True):
            geladen += 1
        geladen_pfade[pfad] = groesse

    # Verwaist = lokal da, nicht in Soll -- im Filterfall nur unter den Praefixen.
    # Geschuetzte Praefixe (Hagermann) nie als verwaist loeschen.
    verwaist = [p for p in ist
                if p not in soll and _unter_praefix(p, praefixe)
                and not _ist_geschuetzt(p)]
    if verwaist:
        # Schrumpf-Schutz relativ zum betrachteten Bestand: ohne Filter der
        # ganze Ist-Bestand, mit Filter nur der Teil unter den Praefixen.
        bezug = [p for p in ist if _unter_praefix(p, praefixe)]
        anteil = len(verwaist) / max(1, len(bezug))
        if anteil > LOESCH_SCHWELLE:
            raise SyncAbbruch(
                str(len(verwaist)) + " von " + str(len(bezug)) +
                " Dateien waeren zu loeschen (> " + str(int(LOESCH_SCHWELLE * 100)) +
                " %). Vermuteter Unfall -> KEIN Loeschen.")
        for pfad in verwaist:
            (Path(opus_root) / pfad).unlink()

    # vorhanden.txt inkrementell fortschreiben statt teurem Voll-Scan: die
    # gelesene Ist-Liste um die geladenen Pfade ergaenzen, die geloeschten
    # entfernen, neu sortiert schreiben. Ergebnis identisch zum Scan, aber
    # ohne ~180k stat auf dem USB. Der Voll-Scan laeuft nur noch auf den
    # expliziten 'vorhanden'-Knopf (Hand-Aenderungen am Bestand heilen).
    neu = dict(ist)
    neu.update(geladen_pfade)
    for pfad in verwaist:
        neu.pop(pfad, None)
    _schreibe_vorhanden_aus_dict(opus_root, neu)
    # opus.ping ist bereits am Anfang sichergestellt (bleibt bestehen).
    return geladen, len(verwaist)


def cmd_audio_sync(args):
    try:
        geladen, geloescht = audio_sync(args.opus_root, args.webspace)
    except ValueError as e:
        print("FEHLER: " + str(e) + " -> kein Sync.", file=sys.stderr)
        return 1
    except SyncAbbruch as e:
        print("FEHLER: " + str(e), file=sys.stderr)
        return 1
    print("Audio-Sync fertig: " + str(geladen) + " geladen, " +
          str(geloescht) + " geloescht.")
    return 0


def teilmenge_umfang(opus_root, praefix):
    """Lokaler Umfang einer Teilmenge: (anzahl, bytes) der Dateien unter praefix
    laut vorhanden.txt. Fuer die Loeschen-Bestaetigung (was wird frei?). Liest
    nur die Liste, kein Scan."""
    ist = _lies_vorhanden(opus_root)
    n = b = 0
    for pfad, groesse in ist.items():
        if pfad.startswith(praefix):
            n += 1
            b += groesse
    return n, b


def teilmenge_loeschen(opus_root, praefix):
    """Loescht ALLE lokal vorhandenen Dateien unter praefix (aus vorhanden.txt),
    schreibt vorhanden.txt inkrementell fort. Gibt (geloescht, bytes_frei)
    zurueck. Rein lokal, kein Netz. Ein nicht loeschbarer Pfad (schon weg o.ae.)
    wird uebersprungen, bleibt aber aus der Liste entfernt (er ist ja nicht
    mehr da). Platzschaffen auf Nutzerwunsch -- KEIN Schrumpf-Schutz (anders als
    audio_sync, wo Loeschen ein Nebeneffekt des Abgleichs ist).

    Geschuetzte Praefixe (Hagermann) werden NIE geloescht: ist praefix selbst
    geschuetzt -> ValueError (der Aufrufer darf ihn gar nicht schicken); umfasst
    ein grober praefix geschuetzte Pfade mit, bleiben diese verschont."""
    if _ist_geschuetzt(praefix):
        raise ValueError("geschuetzte Teilmenge, loeschen nicht erlaubt: " + praefix)
    opus_root = Path(opus_root)
    ist = _lies_vorhanden(opus_root)
    zu_loeschen = [p for p in ist
                   if p.startswith(praefix) and not _ist_geschuetzt(p)]
    bytes_frei = 0
    for pfad in zu_loeschen:
        bytes_frei += ist[pfad]
        try:
            (opus_root / pfad).unlink()
        except OSError:
            pass                                  # schon weg -> trotzdem aus Liste
    _leere_ordner_aufraeumen(opus_root, praefix)
    # Nur die tatsaechlich geloeschten Pfade aus der Liste nehmen -- geschuetzte
    # Pfade unter einem groben praefix bleiben erhalten (rmdir laesst ihren
    # nicht-leeren Ordner ohnehin stehen).
    entfernt = set(zu_loeschen)
    neu = {p: g for p, g in ist.items() if p not in entfernt}
    _schreibe_vorhanden_aus_dict(opus_root, neu)
    return len(zu_loeschen), bytes_frei


def _leere_ordner_aufraeumen(opus_root, praefix):
    """Entfernt leere Verzeichnisse unter opus_root/praefix nach dem Loeschen
    (von innen nach aussen), damit keine leeren Ordner-Gerippe zurueckbleiben.
    opus_root selbst bleibt immer stehen. Nicht-leere Ordner und Fehler werden
    uebersprungen."""
    opus_root = Path(opus_root)
    basis = opus_root / praefix.rstrip("/")
    if not basis.is_dir():
        return
    # Tiefste zuerst (reverse sort nach Pfadtiefe), damit Eltern danach leer sind.
    for d in sorted(basis.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if d.is_dir():
            try:
                d.rmdir()                         # rmdir entfernt NUR leere Ordner
            except OSError:
                pass
    try:
        basis.rmdir()
    except OSError:
        pass


# ---------------------------------------------------------------- Bündel-Sync
# audio.bundle/ liegt (wie opus/) ausserhalb des git-Repos und wird per HTTP auf
# den Stick geladen -- dieselbe Soll/Ist-Idee wie der Opus-Audio-Sync, aber mit
# md5 statt Dateigroesse als Vergleichswert (ein inhaltlich geaendertes Buendel
# bei gleicher Groesse bliebe sonst unerkannt). Der md5 wird BEIM DOWNLOAD in die
# Ist-Liste geschrieben (aus der Soll-Zeile uebernommen), nicht bei jedem Abgleich
# neu berechnet. Steuerdateien: Soll = <webspace>/audio.bundle/bundle-soll.txt
# (vom Builder), Ist = <bundle_root>/bundle-vorhanden.txt. Kein Praefix-Filter,
# kein Schrumpf-Schutz -- die Buendel sind pflichtig und werden als Ganzes
# gepflegt (verwaiste lokale Buendel werden entfernt, damit aussortierte Sprachen
# verschwinden).

def _lade_paar_liste(text):
    """Parst `pfad<TAB>wert`-Zeilen zu dict pfad->wert (wert als String). Am
    LETZTEN Tab getrennt (Pfade duerfen Tabs/Leerzeichen enthalten)."""
    d = {}
    for zeile in text.splitlines():
        zeile = zeile.rstrip("\n")
        if not zeile or "\t" not in zeile:
            continue
        pfad, wert = zeile.rsplit("\t", 1)
        d[pfad] = wert
    return d


def _bundle_soll(webspace):
    """Hash-Soll-Liste vom Webspace: dict pfad->md5. Wirft bei Nichterreichbarkeit."""
    url = webspace.rstrip("/") + "/bundle-soll.txt"
    with urllib.request.urlopen(url) as r:
        return _lade_paar_liste(r.read().decode("utf-8"))


def _bundle_ist(bundle_root):
    """Lokale Ist-Liste bundle-vorhanden.txt: dict pfad->md5. Fehlt sie, leeres
    dict (dann gilt alles als abweichend -> Voll-Download, z.B. erster Stick)."""
    pfad = Path(bundle_root) / "bundle-vorhanden.txt"
    try:
        return _lade_paar_liste(pfad.read_text(encoding="utf-8"))
    except OSError:
        return {}


def _schreibe_bundle_ist(bundle_root, bestand):
    """Schreibt bundle-vorhanden.txt aus dict pfad->md5 (alphabetisch)."""
    ziel = Path(bundle_root) / "bundle-vorhanden.txt"
    with open(ziel, "w", encoding="utf-8") as f:
        for pfad, h in sorted(bestand.items()):
            f.write(pfad + "\t" + h + "\n")


def bundle_sync(bundle_root, webspace, fortschritt=None, voll=False):
    """Gleicht audio.bundle/ gegen die Hash-Soll-Liste ab: fehlende/geaenderte
    (md5 weicht ab) laden, verwaiste (lokal da, nicht in Soll) loeschen, danach
    bundle-vorhanden.txt fortschreiben. Gibt (geladen, geloescht) zurueck.

    voll=True (Reparatur): die lokale Ist-Liste wird ignoriert -> ALLES gilt als
    abweichend und wird neu geladen (analog zum git-Neuklon). Sonst nur die
    Abweichenden (Normalfall im CImbel-Update).

    fortschritt(i, n, pfad): optionaler Callback VOR dem Laden der i-ten Datei."""
    webspace = webspace.rstrip("/")
    soll = _bundle_soll(webspace)
    if not soll:
        raise ValueError("Bündel-Soll-Liste leer oder nicht erreichbar")
    ist = {} if voll else _bundle_ist(bundle_root)

    zu_laden = [(p, h) for p, h in soll.items() if ist.get(p) != h]
    geladen = 0
    for i, (pfad, h) in enumerate(zu_laden, start=1):
        if fortschritt is not None:
            fortschritt(i, len(zu_laden), pfad)
        _download(webspace + "/" + pfad, Path(bundle_root) / pfad)
        geladen += 1

    # Verwaist: lokal in der Ist-Liste, aber nicht mehr im Soll (aussortierte
    # Sprache). Bei voll=True ist ist leer -> nichts verwaist; stattdessen die
    # LOKAL vorhandenen, nicht mehr im Soll stehenden Dateien separat aufraeumen.
    bezug = _bundle_ist(bundle_root) if voll else ist
    verwaist = [p for p in bezug if p not in soll]
    for pfad in verwaist:
        try:
            (Path(bundle_root) / pfad).unlink()
        except OSError:
            pass

    # Ist-Liste = die Soll-Hashes der jetzt lokal liegenden Dateien. Nach einem
    # vollstaendigen Abgleich entspricht der lokale Stand genau dem Soll.
    neu = {p: h for p, h in soll.items()}
    _schreibe_bundle_ist(bundle_root, neu)
    return geladen, len(verwaist)


def cmd_bundle_sync(args):
    try:
        geladen, geloescht = bundle_sync(args.bundle_root, args.bundle_webspace,
                                         voll=args.voll)
    except ValueError as e:
        print("FEHLER: " + str(e) + " -> kein Sync.", file=sys.stderr)
        return 1
    print("Bündel-Sync fertig: " + str(geladen) + " geladen, " +
          str(geloescht) + " geloescht.")
    return 0


# ---------------------------------------------------------------- vorhanden.txt

def _ensure_opus_ping(opus_root):
    """Legt die leere Marker-Datei opus/opus.ping an, falls sie fehlt. CImbel
    erkennt am (relativen) HEAD-Abruf dieser Datei, dass ein LOKALER Opus-Bestand
    neben dem Tool liegt, und laedt die Audios dann relativ (lokaler Caddy) statt
    absolut vom Webspace (js/audio-source.js, _amLocalOpusProbe). Die Datei muss
    in JEDER Opus-Kopie liegen; sie wird von keinem anderen Schritt erzeugt, darum
    hier -- jeder, der den lokalen Opus-Ordner pflegt (Sync, Voll-Scan), stellt
    sie sicher. Idempotent."""
    try:
        p = Path(opus_root) / "opus.ping"
        if not p.exists():
            p.parent.mkdir(parents=True, exist_ok=True)
            p.touch()
    except OSError:
        pass   # darf den Sync nicht scheitern lassen


def _schreibe_vorhanden_aus_dict(opus_root, bestand):
    """Schreibt opus/vorhanden.txt aus einem fertigen dict relpfad->groesse:
    je Zeile `relpfad<TAB>groesse`, alphabetisch nach Pfad. Gemeinsamer
    Schreibkoerper fuer den Voll-Scan (_schreibe_vorhanden) und die
    inkrementelle Fortschreibung (audio_sync)."""
    ziel = Path(opus_root) / "vorhanden.txt"
    with open(ziel, "w", encoding="utf-8") as f:
        for rel, groesse in sorted(bestand.items()):
            f.write(rel + "\t" + str(groesse) + "\n")


def _schreibe_vorhanden(opus_root):
    """Scannt den lokalen Opus-Ordner (rglob+stat) und schreibt
    opus/vorhanden.txt (je Zeile `relpfad<TAB>groesse`, alphabetisch). Dies ist
    der EINZIGE Ort mit dem teuren Datei-Scan; der Audioabgleich liest danach
    nur noch diese Liste und schreibt sie inkrementell fort. CImbels
    Bestandsfilter (ss9.9.2) nutzt den Pfad (erste Spalte vor dem letzten Tab)
    und ignoriert die Groesse."""
    opus_root = Path(opus_root)
    bestand = {}
    for p in opus_root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(opus_root).as_posix()
        if rel in ("vorhanden.txt", "soll-items.txt", "opus.ping"):
            continue   # die Steuer-/Marker-Dateien selbst nicht listen
        bestand[rel] = p.stat().st_size
    _schreibe_vorhanden_aus_dict(opus_root, bestand)
    _ensure_opus_ping(opus_root)


def cmd_vorhanden(args):
    _schreibe_vorhanden(args.opus_root)
    print("vorhanden.txt geschrieben.")
    return 0


# ---------------------------------------------------------------- CLI

def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--stick-root", default=DEF_STICK_ROOT)
    ap.add_argument("--opus-root", default=DEF_OPUS_ROOT)
    ap.add_argument("--webspace", default=DEF_WEBSPACE)
    ap.add_argument("--bundle-root", default=DEF_BUNDLE_ROOT)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_m = sub.add_parser("manifest")
    p_m.add_argument("--bereich", choices=["home", "system-root"], required=True)
    p_m.set_defaults(func=cmd_manifest)

    sub.add_parser("audio-status").set_defaults(func=cmd_audio_status)
    sub.add_parser("audio-sync").set_defaults(func=cmd_audio_sync)
    sub.add_parser("vorhanden").set_defaults(func=cmd_vorhanden)
    # Buendel-Sync: --voll fuer die Reparatur (alles neu), sonst nur Abweichende.
    # Eigene Webspace-Wurzel (nicht /opus/) -> eigener --bundle-webspace.
    p_b = sub.add_parser("bundle-sync")
    p_b.add_argument("--voll", action="store_true")
    p_b.add_argument("--bundle-webspace", default=DEF_BUNDLE_WEBSPACE)
    p_b.set_defaults(func=cmd_bundle_sync)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
