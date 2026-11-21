#!/usr/bin/env python3
"""Stick-Zuruecksetzen-Kern (unprivilegiert, keine UI).

Setzt die Desktop-/Nutzerkonfiguration auf den Ursprungszustand zurueck:
leert /home/cimbel link-sicher -- AUSSER dem Schreibtisch -- und befuellt es
aus der Werks-Kopie /usr/local/share/cimbel-skel/. Der Schreibtisch bleibt
erhalten und wird nur aus der Werks-Kopie ueberschrieben (Stick-Starter
repariert, persoenliche Dateien des Nutzers dort bleiben). Persoenliche
Daten (Dokumente/Bilder/... auf der NTFS-Datenpartition) werden NICHT
angefasst -- sie liegen hinter Symlinks, die link-sicher nur als Link
ersetzt werden. Laeuft vollstaendig als User -- home gehoert ihm, die
Werks-Kopie wird nur gelesen (beim Image-Bau welt-lesbar angelegt).

Sub-Kommandos:
  reset          -- das eigentliche Zuruecksetzen
  trockenlauf    -- zaehlt/prueft, ohne zu aendern (Sicherheitsnachweis)
  skel-erzeugen  -- Werks-Kopie aus dem aktuellen home erzeugen (Wartung)

LINK-SICHERHEIT (siehe Konzept_Offline_Stick.md):
Im home liegen Symlinks auf die NTFS-Datenpartition, u.a.
  ~/Downloads  -> /mnt/daten/Downloads
  <Musik>/...  -> /mnt/daten/opus   (12 GB Audio)
sowie die Datenordner (Dokumente/Bilder/...). Ein rekursives Loeschen, das
Symlinks FOLGT, wuerde durch diese Links hindurch die persoenlichen Daten
auf /mnt/daten zerstoeren. Darum wird home nur link-sicher geleert (Links
als Dateien entfernen, nie ihr Ziel). Der Reset fasst /mnt/daten selbst
GAR NICHT an -- weder loeschend noch lesend.
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

HOME = "/home/cimbel"
SKEL = "/usr/local/share/cimbel-skel"


def _schreibtisch_name(home=HOME):
    """Name des Schreibtisch-Ordners, locale-korrekt ueber xdg-user-dir
    (deutsch 'Schreibtisch', englisch 'Desktop'). Der Reset nimmt diesen
    EINEN home-Ordner von der Leerung aus: er liegt auf ext4 (nicht auf
    NTFS gelinkt), traegt die Stick-Starter UND evtl. persoenliche Dateien
    des Nutzers -- deshalb nicht loeschen, nur aus der Werks-Kopie
    ueberschreiben. Faellt xdg-user-dir aus, Fallback auf den vorhandenen
    Ordner ('Schreibtisch' oder 'Desktop'), sonst 'Schreibtisch'."""
    try:
        name = subprocess.run(["xdg-user-dir", "DESKTOP"],
                              capture_output=True, text=True).stdout.strip()
    except OSError:
        name = ""
    # xdg-user-dir liefert absoluten Pfad -> nur den letzten Teil nehmen.
    name = os.path.basename(name) if name else ""
    if name:
        return name
    for kandidat in ("Schreibtisch", "Desktop"):
        if (Path(home) / kandidat).is_dir():
            return kandidat
    return "Schreibtisch"


class ResetFehler(Exception):
    """Abbruch des Zuruecksetzens (z.B. fehlende Werks-Kopie)."""
    pass


# ----------------------------------------------------------- Firefox-Check

def firefox_laeuft():
    """True, wenn ein Firefox-Prozess laeuft. Displayserver-unabhaengig per
    pgrep (NICHT ueber Fenster-/Wayland-/X11-APIs) -- noetig, weil offene
    SQLite-Handles im Profil das Loeschen/Befuellen zerstoeren wuerden.
    pgrep -x firefox trifft den Hauptprozess; -f faengt auch die
    firefox-esr-/-bin-Varianten ueber die ganze Kommandozeile."""
    try:
        rc = subprocess.run(["pgrep", "-f", "firefox"],
                            capture_output=True).returncode
    except OSError:
        # pgrep nicht da -> defensiv annehmen, dass Firefox laufen koennte,
        # waere falsch-positiv und blockierte dauerhaft. Besser: als "laeuft
        # nicht" behandeln, der Loeschvorgang ist auch ohne sauber (nur das
        # Profil koennte inkonsistent sein, wird aber ohnehin geloescht).
        return False
    return rc == 0


# ----------------------------------------------------------- home leeren

def _home_leeren(home, protokoll, ausser=()):
    """Leert /home/cimbel LINK-SICHER: entfernt jeden obersten Eintrag, ohne
    Symlinks zu folgen. Ein Symlink wird als Link entfernt (unlink), sein
    Ziel bleibt unangetastet -- so koennen die Datenordner auf /mnt/daten
    nicht durch die home-Links zerstoert werden. Ordner werden rekursiv
    entfernt, aber shutil.rmtree folgt per Default keinen Symlinks beim
    Absteigen (es entfernt einen Symlink-Eintrag als Link, nicht sein Ziel).
    Der home-Ordner selbst bleibt bestehen (nur sein Inhalt geht).

    ausser: Namen oberster home-Eintraege, die NICHT geleert werden (der
    Schreibtisch -- er bleibt erhalten und wird spaeter nur aus der
    Werks-Kopie ueberschrieben)."""
    home = Path(home)
    for eintrag in home.iterdir():
        if eintrag.name in ausser:
            protokoll("Behalten (wird nur ueberschrieben): " + eintrag.name)
            continue
        p = str(eintrag)
        # os.path.islink zuerst: ein Symlink auf einen Ordner darf NICHT als
        # Ordner behandelt (rmtree) werden -- sonst stieg man ins Ziel ab.
        if os.path.islink(p):
            os.unlink(p)
            protokoll("Link entfernt (Ziel unberuehrt): " + eintrag.name)
        elif eintrag.is_dir():
            shutil.rmtree(p)
            protokoll("Ordner entfernt: " + eintrag.name)
        else:
            os.unlink(p)
            protokoll("Datei entfernt: " + eintrag.name)


# ----------------------------------------------------------- home befuellen

def _home_befuellen(skel, home, protokoll):
    """Kopiert die Werks-Kopie skel -> home. Symlinks werden als Symlinks
    uebernommen (symlinks=True), damit ~/Downloads -> /mnt/daten/Downloads und
    der Musik-Link -> /mnt/daten/opus nach dem Zuruecksetzen wieder da sind
    (NICHT ihre Ziele kopieren). Versteckte Dateien (.mozilla, .config, ...)
    sind normale iterdir-Eintraege und werden mitkopiert. Idempotent:
    dirs_exist_ok=True erlaubt das Schreiben in den noch bestehenden home-
    Ordner und einen Wiederholungslauf nach Abbruch."""
    skel = Path(skel)
    if not skel.is_dir():
        raise ResetFehler("Werks-Kopie nicht gefunden: " + str(skel))
    n = 0
    for eintrag in skel.iterdir():
        quelle = str(eintrag)
        ziel = str(Path(home) / eintrag.name)
        if os.path.islink(quelle):
            # Symlink 1:1 nachbilden (Ziel-String uebernehmen), nie folgen.
            linkziel = os.readlink(quelle)
            if os.path.lexists(ziel):
                os.unlink(ziel)
            os.symlink(linkziel, ziel)
            protokoll("Link wiederhergestellt: " + eintrag.name + " -> " + linkziel)
        elif eintrag.is_dir():
            shutil.copytree(quelle, ziel, symlinks=True, dirs_exist_ok=True)
            protokoll("Ordner wiederhergestellt: " + eintrag.name)
        else:
            shutil.copy2(quelle, ziel)
            protokoll("Datei wiederhergestellt: " + eintrag.name)
        n += 1
    return n


# ----------------------------------------------------------- Reset (gesamt)

def reset(protokoll=None, pruefe_firefox=True):
    """Fuehrt das Zuruecksetzen aus: home link-sicher leeren (AUSSER dem
    Schreibtisch) -> aus skel befuellen (der Schreibtisch wird dabei nur
    ueberschrieben, nicht geleert -> Stick-Starter repariert, persoenliche
    Dateien dort bleiben). /mnt/daten wird NICHT angefasst. protokoll(text)
    ist ein optionaler Callback je Teilschritt (fuer die GUI/CLI-Ausgabe).
    Wirft ResetFehler bei fehlender Werks-Kopie.

    pruefe_firefox: wenn True und Firefox laeuft -> ResetFehler (die GUI
    prueft das schon vorher und sperrt den Knopf; hier als zweiter Riegel
    fuer den CLI-Weg -- das Firefox-Profil wird mit dem home ersetzt)."""
    if protokoll is None:
        protokoll = lambda _t: None

    if pruefe_firefox and firefox_laeuft():
        raise ResetFehler("Firefox laeuft noch -- bitte erst schliessen "
                          "(offene Profildateien wuerden das Zuruecksetzen stoeren).")

    schreibtisch = _schreibtisch_name(HOME)

    protokoll("Setze das Benutzerverzeichnis zurueck "
              "(Schreibtisch bleibt erhalten, Links bleiben als Links) ...")
    _home_leeren(HOME, protokoll, ausser=(schreibtisch,))

    protokoll("Stelle den Ursprungszustand aus der Werks-Kopie her ...")
    n = _home_befuellen(SKEL, HOME, protokoll)
    protokoll("Ursprungszustand hergestellt (" + str(n) + " Eintrag(e)).")


def cmd_reset(args):
    reset(protokoll=print, pruefe_firefox=not args.ohne_firefox_check)
    print("Zuruecksetzen abgeschlossen.")
    return 0


# ----------------------------------------------------------- Trockenlauf

def cmd_trockenlauf(args):
    """Sicherheitsnachweis ohne jede Aenderung: zeigt, was das Zuruecksetzen
    im home anfassen wuerde (Schreibtisch ausgenommen), und weist nach, dass
    /mnt/daten GAR NICHT beruehrt wird."""
    print("== Trockenlauf (es wird NICHTS geaendert) ==")
    print("Firefox laeuft: " + ("JA -> reset wuerde abbrechen" if firefox_laeuft()
                                 else "nein"))

    schreibtisch = _schreibtisch_name(HOME)
    print("Schreibtisch-Ordner (bleibt erhalten, wird nur ueberschrieben): "
          + schreibtisch)

    home = Path(HOME)
    if home.is_dir():
        eintraege = list(home.iterdir())
        print("\nhome (" + HOME + ") -- " + str(len(eintraege)) + " Eintrag(e):")
        for e in sorted(eintraege, key=lambda x: x.name):
            if e.name == schreibtisch:
                print("  KEEP  " + e.name + "  (bleibt, wird nur aus Werks-Kopie ueberschrieben)")
            elif os.path.islink(str(e)):
                print("  LINK  " + e.name + " -> " + os.readlink(str(e))
                      + "  (als Link entfernt, Ziel " + os.path.realpath(str(e)) + " bleibt)")
            elif e.is_dir():
                print("  DIR   " + e.name + "  (wird entfernt)")
            else:
                print("  FILE  " + e.name + "  (wird entfernt)")
    else:
        print("home (" + HOME + ") existiert nicht.")

    # Nachweis: /mnt/daten wird nie angefasst (weder loeschend noch lesend).
    print("\n/mnt/daten wird vom Reset GAR NICHT angefasst "
          "(Datenordner, opus, git bleiben unberuehrt).")

    print("\nWerks-Kopie (" + SKEL + "): "
          + ("vorhanden" if Path(SKEL).is_dir() else "FEHLT -- reset wuerde scheitern"))
    return 0


# ----------------------------------------------------------- skel erzeugen

def cmd_skel_erzeugen(args):
    """Erzeugt/aktualisiert die Werks-Kopie: kopiert den aktuellen home
    (/home/cimbel) nach /usr/local/share/cimbel-skel/ -- INKL. versteckter
    Dateien und Symlinks, ohne Symlinks zu folgen. Braucht Schreibrechte auf
    /usr/local/share (root) -> ueber sudo aufrufen. Wartungsschritt: jetzt
    zum Befuellen, vor Auslieferung erneut, um den skel auf Stand zu bringen.

    Verfahren: 'cp -a HOME/. SKEL/' -- -a impliziert -d (Symlinks als Links,
    nicht folgen) und -r (rekursiv); 'HOME/.' erfasst auch Dot-Dateien.
    Danach Rechte welt-lesbar setzen, damit der User sie spaeter ohne root
    nach home kopieren kann (chmod -R a+rX)."""
    home = args.home
    skel = args.skel
    if not Path(home).is_dir():
        print("FEHLER: home nicht gefunden: " + home, file=sys.stderr)
        return 1
    # Zielordner leeren und neu anlegen -> idempotenter, sauberer Stand.
    if Path(skel).exists():
        shutil.rmtree(skel)
    os.makedirs(skel, exist_ok=True)
    # cp -a kopiert symlink-sicher und mit versteckten Dateien.
    rc = subprocess.run(["cp", "-a", home.rstrip("/") + "/.", skel]).returncode
    if rc != 0:
        print("FEHLER: cp -a fehlgeschlagen (rc=" + str(rc) + ")", file=sys.stderr)
        return 1
    # Welt-lesbar machen (Ordner betretbar, Dateien lesbar) -- fuer das
    # spaetere Befuellen durch den User ohne root.
    subprocess.run(["chmod", "-R", "a+rX", skel])
    print("Werks-Kopie erzeugt: " + home + " -> " + skel + " (welt-lesbar).")
    return 0


# ---------------------------------------------------------------- CLI

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_r = sub.add_parser("reset", help="home auf Werkszustand zuruecksetzen")
    p_r.add_argument("--ohne-firefox-check", action="store_true",
                     help="den Firefox-Lauf-Check ueberspringen (nur fuer Tests)")
    p_r.set_defaults(func=cmd_reset)

    sub.add_parser("trockenlauf",
                   help="zeigen/pruefen ohne Aenderung (Sicherheitsnachweis)"
                   ).set_defaults(func=cmd_trockenlauf)

    p_s = sub.add_parser("skel-erzeugen",
                         help="Werks-Kopie aus dem aktuellen home erzeugen (root)")
    p_s.add_argument("--home", default=HOME, help="Quell-home (Default " + HOME + ")")
    p_s.add_argument("--skel", default=SKEL, help="Ziel-Werks-Kopie (Default " + SKEL + ")")
    p_s.set_defaults(func=cmd_skel_erzeugen)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
