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

DEF_STICK_ROOT = "/mnt/daten/git/ci-sound-balancing/stick-files"
DEF_OPUS_ROOT = "/mnt/daten/opus"
DEF_WEBSPACE = "https://www.ci-sound-balancing.org/opus/"

# Schrumpf-Schutz: loescht audio-sync mehr als diesen Anteil der lokal
# vorhandenen Opus-Dateien, bricht es ab (vermuteter Unfall). Gleiche Schwelle
# wie der Builder-Nachlauf verify_local_audio.
LOESCH_SCHWELLE = 0.5


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

def _audio_diff(opus_root, webspace):
    """Gibt (fehlend_oder_geaendert, verwaist) zurueck:
      fehlend_oder_geaendert: list[(pfad, soll_groesse)] -> muss geladen werden
      verwaist:               list[pfad] -> lokal da, aber nicht in Soll
    """
    soll = _lade_soll(webspace)
    ist = _ist_bestand(opus_root)
    laden = []
    for pfad, groesse in soll.items():
        if pfad not in ist or ist[pfad] != groesse:
            laden.append((pfad, groesse))
    verwaist = [p for p in ist if p not in soll]
    return laden, verwaist


def cmd_audio_status(args):
    laden, verwaist = _audio_diff(args.opus_root, args.webspace)
    print("Zu laden (fehlend/geaendert): " + str(len(laden)))
    print("Lokal vorhanden, nicht in Soll: " + str(len(verwaist)))
    return 0


class SyncAbbruch(Exception):
    """Wird geworfen, wenn der Schrumpf-Schutz greift (zu viel zu loeschen)."""
    pass


def audio_sync(opus_root, webspace, fortschritt=None):
    """Fuehrt den Audio-Abgleich aus: fehlende/geaenderte laden, Verwaistes
    loeschen (mit Schrumpf-Schutz), danach vorhanden.txt neu. Gibt
    (geladen, geloescht) zurueck. Wirft ValueError bei leerer/unerreichbarer
    Soll-Liste und SyncAbbruch bei ausgeloestem Schrumpf-Schutz.

    fortschritt(i, n, pfad): optionaler Callback, VOR dem Laden der i-ten von n
    zu ladenden Dateien aufgerufen (1-basiert). Fuer die GUI-Fortschrittsanzeige.
    """
    soll = _lade_soll(webspace)
    if not soll:
        raise ValueError("Soll-Liste leer oder nicht erreichbar")
    ist = _ist_bestand(opus_root)

    zu_laden = [(p, g) for p, g in soll.items() if p not in ist or ist[p] != g]
    geladen = 0
    for i, (pfad, groesse) in enumerate(zu_laden, start=1):
        if fortschritt is not None:
            fortschritt(i, len(zu_laden), pfad)
        if _opus_download_if_needed(pfad, groesse, opus_root, webspace, True):
            geladen += 1

    verwaist = [p for p in ist if p not in soll]
    if verwaist:
        anteil = len(verwaist) / max(1, len(ist))
        if anteil > LOESCH_SCHWELLE:
            raise SyncAbbruch(
                str(len(verwaist)) + " von " + str(len(ist)) +
                " Dateien waeren zu loeschen (> " + str(int(LOESCH_SCHWELLE * 100)) +
                " %). Vermuteter Unfall -> KEIN Loeschen.")
        for pfad in verwaist:
            (Path(opus_root) / pfad).unlink()

    _schreibe_vorhanden(opus_root)
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


# ---------------------------------------------------------------- vorhanden.txt

def _schreibe_vorhanden(opus_root):
    """Scannt den lokalen Opus-Ordner (rglob+stat) und schreibt
    opus/vorhanden.txt: je Zeile `relpfad<TAB>groesse`, alphabetisch nach Pfad.
    Dies ist der EINZIGE Ort mit dem teuren Datei-Scan; der Audioabgleich liest
    danach nur noch diese Liste. CImbels Bestandsfilter (ss9.9.2) nutzt den
    Pfad (erste Spalte vor dem letzten Tab) und ignoriert die Groesse."""
    opus_root = Path(opus_root)
    eintraege = []
    for p in opus_root.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(opus_root).as_posix()
        if rel in ("vorhanden.txt", "soll-items.txt"):
            continue   # die Steuerdateien selbst nicht listen
        eintraege.append((rel, p.stat().st_size))
    ziel = opus_root / "vorhanden.txt"
    with open(ziel, "w", encoding="utf-8") as f:
        for rel, groesse in sorted(eintraege):
            f.write(rel + "\t" + str(groesse) + "\n")


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
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_m = sub.add_parser("manifest")
    p_m.add_argument("--bereich", choices=["home", "system-root"], required=True)
    p_m.set_defaults(func=cmd_manifest)

    sub.add_parser("audio-status").set_defaults(func=cmd_audio_status)
    sub.add_parser("audio-sync").set_defaults(func=cmd_audio_sync)
    sub.add_parser("vorhanden").set_defaults(func=cmd_vorhanden)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
