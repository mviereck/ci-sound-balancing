#!/usr/bin/env python3
"""Stick-Zuruecksetzen-Kern (unprivilegiert, keine UI).

Setzt das Nutzer-home auf den Werkszustand zurueck: /home/cimbel leeren
(link-sicher), aus der Werks-Kopie /usr/local/share/cimbel-skel/ neu
befuellen, den Inhalt von /mnt/daten/Downloads leeren. Laeuft vollstaendig
als User -- home gehoert ihm, die Werks-Kopie wird nur gelesen (beim
Image-Bau welt-lesbar angelegt).

Sub-Kommandos:
  reset          -- das eigentliche Zuruecksetzen
  trockenlauf    -- zaehlt/prueft, ohne zu loeschen (Sicherheitsnachweis)
  skel-erzeugen  -- Werks-Kopie aus dem aktuellen home erzeugen (Wartung)

DER GEFAEHRLICHSTE PUNKT (siehe Konzept_Offline_Stick.md, Icon-Abschnitt):
Im home liegen Symlinks auf die exFAT-Datenpartition
  ~/Downloads  -> /mnt/daten/Downloads
  <Musik>/...  -> /mnt/daten/opus   (12 GB Audio)
Ein rekursives Loeschen, das Symlinks FOLGT, wuerde durch diese Links
hindurch den Opus-Bestand und den Downloads-Zielordner zerstoeren. Darum:
home nur link-sicher leeren (Links als Dateien entfernen, nie ihr Ziel),
und in /mnt/daten ausschliesslich den INHALT von /Downloads anfassen --
nichts anderes (opus, git, ... bleiben unberuehrt). Diese Invariante ist
der Kern des Selbstschutzes (_pruefe_home_sicher).
"""
import argparse
import glob
import os
import shutil
import subprocess
import sys
from pathlib import Path

HOME = "/home/cimbel"
SKEL = "/usr/local/share/cimbel-skel"
DATEN = "/mnt/daten"
DOWNLOADS = "/mnt/daten/Downloads"
# Papierkoerbe auf der exFAT-Datenpartition: nemo/Cinnamon legen pro
# Dateisystem einen eigenen Papierkorb im Wurzelverzeichnis an
# (freedesktop-Spec), typisch .Trash-<UID>. Eine von /mnt/daten geloeschte
# Datei landet HIER, nicht im Home-Papierkorb -> der Reset muss ihn mit
# leeren, sonst bleiben persoenliche Daten zurueck. Glob erfasst alle
# Varianten (.Trash-1000, .Trash-0, generisches .Trash), bleibt aber streng
# auf .Trash*-Ordner beschraenkt.
TRASH_GLOB = "/mnt/daten/.Trash*"


def _erlaubte_daten_pfade():
    """Die einzigen Orte unter /mnt/daten, deren Inhalt der Reset loeschen
    darf: der Downloads-Ordner und die .Trash*-Papierkoerbe. Alles andere
    (opus, git, ...) ist tabu. EINE Quelle fuer Selbstschutz UND die
    Lösch-Schritte, damit beide nicht auseinanderdriften."""
    return [DOWNLOADS] + sorted(glob.glob(TRASH_GLOB))


class ResetFehler(Exception):
    """Abbruch des Zuruecksetzens (z.B. ausgeloester Selbstschutz)."""
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


# ----------------------------------------------------------- Selbstschutz

def _zeigt_nach_daten_verboten(pfad):
    """Prueft EINEN Pfad (Datei/Ordner/Symlink direkt unter home): Wenn es ein
    Symlink ist, dessen reales Ziel unter /mnt/daten liegt und NICHT einer der
    erlaubten Orte (Downloads, .Trash*) ist -> True (verboten). Loeschen
    wuerde den Link zwar nur als Link entfernen; die Pruefung ist der doppelte
    Boden gegen einen kuenftigen Fehler im Loeschverfahren (z.B.
    versehentliches Folgen). realpath loest die Symlink-Kette auf; opus/git &
    Co. fliegen damit auf."""
    try:
        real = os.path.realpath(pfad)
    except OSError:
        return False
    # innerhalb von /mnt/daten?
    if real == DATEN or real.startswith(DATEN + os.sep):
        # erlaubt sind nur die gezielt geleerten Orte (Downloads-Inhalt,
        # .Trash*-Inhalt) -- alles andere unter /mnt/daten ist tabu.
        for erlaubt in _erlaubte_daten_pfade():
            if real == erlaubt or real.startswith(erlaubt + os.sep):
                return False
        return True
    return False


def _pruefe_home_sicher(home):
    """Durchlaeuft die obersten home-Eintraege und sammelt alle, die (ueber
    einen Symlink) real nach /mnt/daten zeigen -- ausser dem erlaubten
    Downloads-Ziel. Gibt die Liste der riskanten (pfad, realziel) zurueck.
    Leere Liste = sicher. Nicht-leer = Abbruch vor jedem echten Loeschen."""
    risiken = []
    home = Path(home)
    if not home.is_dir():
        return risiken
    for eintrag in home.iterdir():
        if _zeigt_nach_daten_verboten(str(eintrag)):
            risiken.append((str(eintrag), os.path.realpath(str(eintrag))))
    return risiken


# ----------------------------------------------------------- home leeren

def _home_leeren(home, protokoll):
    """Leert /home/cimbel LINK-SICHER: entfernt jeden obersten Eintrag, ohne
    Symlinks zu folgen. Ein Symlink wird als Link entfernt (unlink), sein
    Ziel bleibt unangetastet -- so koennen opus/Downloads nicht durch die
    home-Links zerstoert werden. Ordner werden rekursiv entfernt, aber
    shutil.rmtree folgt per Default keinen Symlinks beim Absteigen (es
    entfernt einen Symlink-Eintrag als Link, nicht sein Ziel). Der home-
    Ordner selbst bleibt bestehen (nur sein Inhalt geht)."""
    home = Path(home)
    for eintrag in home.iterdir():
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


# ------------------------------------------------- Inhalt eines Ordners leeren

def _inhalt_leeren(ordner):
    """Leert den INHALT eines Ordners (der Ordner selbst bleibt). Symlinks
    werden als Links entfernt (nie ihr Ziel), Unterordner rekursiv. Gibt die
    Zahl entfernter Eintraege zurueck. Fehlt der Ordner, 0 (kein Fehler).
    Gemeinsamer Loesch-Koerper fuer Downloads UND die .Trash*-Papierkoerbe."""
    o = Path(ordner)
    if not o.is_dir():
        return 0
    n = 0
    for eintrag in o.iterdir():
        p = str(eintrag)
        if os.path.islink(p):
            os.unlink(p)
        elif eintrag.is_dir():
            shutil.rmtree(p)
        else:
            os.unlink(p)
        n += 1
    return n


def _downloads_leeren(protokoll):
    """Leert den INHALT von /mnt/daten/Downloads -- der Ordner selbst bleibt
    (und damit der ~/Downloads-Symlink gueltig). opus & alles andere unter
    /mnt/daten bleiben unberuehrt."""
    if not Path(DOWNLOADS).is_dir():
        protokoll("Downloads-Ordner nicht vorhanden -- nichts zu leeren.")
        return
    n = _inhalt_leeren(DOWNLOADS)
    protokoll("Downloads geleert: " + str(n) + " Eintrag(e) entfernt "
              "(Ordner bleibt bestehen).")


def _trash_leeren(protokoll):
    """Leert den INHALT aller Papierkoerbe auf der Datenpartition
    (/mnt/daten/.Trash*). Eine von /mnt/daten geloeschte Datei landet hier
    statt im Home-Papierkorb -- ohne diesen Schritt blieben persoenliche
    Daten zurueck. Die .Trash*-Ordner selbst bleiben (leer); opus/git & alles
    andere unter /mnt/daten werden NICHT angefasst."""
    trashes = sorted(glob.glob(TRASH_GLOB))
    if not trashes:
        protokoll("Kein Papierkorb auf der Datenpartition -- nichts zu leeren.")
        return
    gesamt = 0
    for t in trashes:
        gesamt += _inhalt_leeren(t)
    protokoll("Papierkorb der Datenpartition geleert: " + str(gesamt) +
              " Eintrag(e) entfernt.")


# ----------------------------------------------------------- Reset (gesamt)

def reset(protokoll=None, pruefe_firefox=True):
    """Fuehrt das Zuruecksetzen aus: Selbstschutz pruefen -> home leeren ->
    aus skel befuellen -> Downloads-Inhalt leeren -> Papierkoerbe der
    Datenpartition leeren. protokoll(text) ist ein optionaler Callback je
    Teilschritt (fuer die GUI/CLI-Ausgabe). Wirft ResetFehler bei
    ausgeloestem Selbstschutz oder fehlender Werks-Kopie.

    pruefe_firefox: wenn True und Firefox laeuft -> ResetFehler (die GUI
    prueft das schon vorher und sperrt den Knopf; hier als zweiter Riegel
    fuer den CLI-Weg)."""
    if protokoll is None:
        protokoll = lambda _t: None

    if pruefe_firefox and firefox_laeuft():
        raise ResetFehler("Firefox laeuft noch -- bitte erst schliessen "
                          "(offene Profildateien wuerden das Zuruecksetzen stoeren).")

    risiken = _pruefe_home_sicher(HOME)
    if risiken:
        zeilen = ["  " + p + " -> " + z for p, z in risiken]
        raise ResetFehler(
            "SICHERHEITS-ABBRUCH: im home zeigen Links unerwartet nach "
            + DATEN + " (erlaubt nur: " + ", ".join(_erlaubte_daten_pfade())
            + "):\n"
            + "\n".join(zeilen)
            + "\nEs wurde NICHTS geloescht.")

    protokoll("Leere das Benutzerverzeichnis (Links bleiben als Links) ...")
    _home_leeren(HOME, protokoll)

    protokoll("Stelle den Werkszustand aus der Werks-Kopie her ...")
    n = _home_befuellen(SKEL, HOME, protokoll)
    protokoll("Werkszustand hergestellt (" + str(n) + " Eintrag(e)).")

    protokoll("Leere den Download-Ordner ...")
    _downloads_leeren(protokoll)

    protokoll("Leere den Papierkorb der Datenpartition ...")
    _trash_leeren(protokoll)


def cmd_reset(args):
    reset(protokoll=print, pruefe_firefox=not args.ohne_firefox_check)
    print("Zuruecksetzen abgeschlossen.")
    return 0


# ----------------------------------------------------------- Trockenlauf

def cmd_trockenlauf(args):
    """Sicherheitsnachweis ohne jede Aenderung: zeigt, was das echte Leeren
    anfassen wuerde, und prueft die Invariante (nichts unter /mnt/daten
    ausser Downloads-Inhalt und .Trash*-Inhalt)."""
    print("== Trockenlauf (es wird NICHTS geaendert) ==")
    print("Firefox laeuft: " + ("JA -> reset wuerde abbrechen" if firefox_laeuft()
                                 else "nein"))

    home = Path(HOME)
    if home.is_dir():
        eintraege = list(home.iterdir())
        print("\nhome (" + HOME + ") -- " + str(len(eintraege)) + " Eintrag(e), wuerden entfernt:")
        for e in sorted(eintraege, key=lambda x: x.name):
            if os.path.islink(str(e)):
                print("  LINK  " + e.name + " -> " + os.readlink(str(e))
                      + "  (als Link entfernt, Ziel " + os.path.realpath(str(e)) + " bleibt)")
            elif e.is_dir():
                print("  DIR   " + e.name)
            else:
                print("  FILE  " + e.name)
    else:
        print("home (" + HOME + ") existiert nicht.")

    risiken = _pruefe_home_sicher(HOME)
    print("\nSelbstschutz: " + ("OK -- kein home-Link zeigt verbotenerweise nach " + DATEN
                                 if not risiken else "RISIKO!"))
    for p, z in risiken:
        print("  RISIKO " + p + " -> " + z)

    dl = Path(DOWNLOADS)
    if dl.is_dir():
        n = sum(1 for _ in dl.iterdir())
        print("\nDownloads (" + DOWNLOADS + "): " + str(n)
              + " Eintrag(e) wuerden geleert (Ordner bleibt).")
    else:
        print("\nDownloads (" + DOWNLOADS + ") existiert nicht.")

    trashes = sorted(glob.glob(TRASH_GLOB))
    if trashes:
        for t in trashes:
            n = sum(1 for _ in Path(t).iterdir()) if Path(t).is_dir() else 0
            print("Papierkorb (" + t + "): " + str(n)
                  + " Eintrag(e) wuerden geleert (Ordner bleibt).")
    else:
        print("Papierkorb (" + TRASH_GLOB + "): keiner vorhanden.")

    # Nachweis: opus/git unangetastet
    for schutz in ("/mnt/daten/opus", "/mnt/daten/git"):
        print("Unberuehrt (nie angefasst): " + schutz
              + (" [vorhanden]" if Path(schutz).exists() else " [nicht vorhanden]"))

    print("\nWerks-Kopie (" + SKEL + "): "
          + ("vorhanden" if Path(SKEL).is_dir() else "FEHLT -- reset wuerde scheitern"))
    return 0 if not risiken else 1


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
