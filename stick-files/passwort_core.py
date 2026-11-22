#!/usr/bin/env python3
"""Paßwort-Kern des Offline-Sticks (keine UI, CLI-testbar).

Zwei Aufgaben rund um das Login-Paßwort des einen Stick-Users `cimbel`:

  pruefe <pw>   -- prueft, ob <pw> das aktuelle Paßwort von `cimbel` ist.
  aendere       -- setzt ein neues Paßwort (altes + neues via Pseudo-Terminal).

Hintergrund (siehe Konzept_Offline_Stick.md, Abschnitt „Root-Paßwort"):
Der Stick wird mit dem allgemeinen, unsicheren Paßwort `cimbel` ausgeliefert.
Das Pflegefenster bietet einen oma-tauglichen Knopf, der zur Aenderung
auffordert und sie durchfuehrt. Es geht um Bequemlichkeit/Hygiene, nicht um
harte Sicherheit (physischer Besitz legt die NTFS-Daten ohnehin offen); uebers
Netz ist das Paßwort nicht angreifbar (kein SSH/Login-Dienst).

SICHERHEIT (die Paßwoerter stehen nie in argv):
Weder Status-Pruefung noch Aenderung uebergeben ein Paßwort als Kommando-
Argument. Der Status-Test reicht es ueber stdin an `sudo -S`; die Aenderung
schreibt es in das Pseudo-Terminal von `passwd`. Es wird KEIN Paßwort in einer
Datei oder im Skript hinterlegt (das Konzept verbietet NOPASSWD/hinterlegte
Paßwoerter -- der Updater liegt user-beschreibbar und erneuert sich selbst).

MECHANIK der Aenderung (Pseudo-Terminal, KEIN sudo):
`cimbel` aendert sein EIGENES Paßwort -- dafuer genuegt `passwd` (setuid-root),
kein sudo. `passwd` liest das alte UND das neue Paßwort aber bewusst nur vom
Terminal (nicht von einer Pipe), damit kein Skript es nicht-interaktiv
unterschiebt. Darum wird `passwd` ueber ein Pseudo-Terminal (pty) getrieben:
die drei Prompts (altes / neues / Wiederholung) werden POSITIONELL beantwortet
-- auf jeden Prompt (Zeile, die mit ':' endet) die naechste Antwort schreiben,
unabhaengig vom Wortlaut (locale-fest). Scheitert `passwd` (altes Paßwort
falsch, Policy-Ablehnung), endet es mit nicht-null; seine Terminal-Ausgabe wird
fuer die Diagnose zurueckgegeben.

Warum NICHT `sudo passwd --stdin` (frueherer Versuch, verworfen):
`sudo -S` und `passwd --stdin` wollen beide von stdin lesen; ein geteilter
sudo-Timestamp zwischen zwei Prozessen traegt nicht (ein `sudo -k`-Prueflauf
invalidiert ihn, und sudoers cached je Terminal/PPID getrennt). Der pty-Weg
braucht weder sudo noch einen geteilten Cache.
"""
import argparse
import os
import pty
import select
import subprocess
import sys

USER = "cimbel"
DEFAULT_PW = "cimbel"
MINDESTLAENGE = 5


class PasswortFehler(Exception):
    """Fehlgeschlagene Paßwortaenderung (altes falsch, passwd-Fehler, zu kurz)."""
    pass


def ist_aktuelles_passwort(pw, user=USER):
    """True, wenn `pw` das aktuelle Login-Paßwort von `user` ist.

    Nicht-interaktiver Test ueber `sudo -S -k true`: `-k` verwirft einen evtl.
    gecachten sudo-Timestamp (sonst pruefte der Test den Cache, nicht das
    Paßwort), `-S` liest `pw` von stdin, `true` tut nichts. Returncode 0 = das
    Paßwort stimmt. Jeder Fehlschlag (falsches Paßwort, `user` nicht
    sudo-berechtigt, sudo fehlt) ergibt False -- der Test ist bewusst
    konservativ: im Zweifel 'nicht das Default-Paßwort', was im Pflegefenster
    nur den Statustext steuert (Aufforderung ja/nein), nie eine Aktion sperrt.

    Nur fuer den STATUS gedacht (gilt noch das Default-Paßwort?); die Aenderung
    selbst laeuft ueber `aendere()` (pty), nicht ueber diesen Test."""
    try:
        p = subprocess.run(["sudo", "-S", "-k", "true"],
                           input=pw + "\n", text=True,
                           capture_output=True)
    except OSError:
        return False
    return p.returncode == 0


def default_passwort_aktiv(user=USER):
    """True, wenn das ausgelieferte Default-Paßwort `cimbel` noch gilt --
    der Statustext im Pflegefenster leitet daraus die Aufforderung ab."""
    return ist_aktuelles_passwort(DEFAULT_PW, user=user)


def pruefe_neues(neu, wiederholung):
    """Prueft das neue Paßwort gegen die Dialog-Regeln (leer verboten,
    Mindestlaenge, Wiederholung gleich). Wirft PasswortFehler mit einer
    sprechenden, nutzerlesbaren Meldung; gibt bei Erfolg None zurueck.
    Reine Validierung, keine Systemaenderung -- so vor dem passwd-Lauf
    aufrufbar (und einzeln testbar)."""
    if not neu:
        raise PasswortFehler("Das neue Paßwort darf nicht leer sein.")
    if len(neu) < MINDESTLAENGE:
        raise PasswortFehler("Das neue Paßwort muss mindestens "
                             + str(MINDESTLAENGE) + " Zeichen lang sein.")
    if neu != wiederholung:
        raise PasswortFehler("Die beiden Eingaben des neuen Paßworts stimmen "
                             "nicht ueberein.")


def _passwd_via_pty(user, antworten, timeout_s=10.0):
    """Treibt `passwd <user>` ueber ein Pseudo-Terminal und beantwortet die
    Prompts POSITIONELL mit `antworten` (Liste: altes, neues, Wiederholung).
    Gibt (returncode, ausgabe) zurueck -- ausgabe ist die gesamte Terminal-
    Ausgabe (Prompts + Meldungen), aus der die Paßwoerter nie erscheinen
    (passwd echot sie nicht).

    Positionell statt wortbasiert: `passwd` fragt in fester Reihenfolge und
    zeigt vor jeder Eingabe einen Prompt, der mit ':' endet. Auf jeden solchen
    Prompt wird die naechste Antwort geschrieben -- locale-unabhaengig (kein
    'Current password'/'Aktuelles Kennwort'-Vergleich). Ueberzaehlige Prompts
    (passwd fragt bei Fehler erneut) erhalten keine Antwort mehr -> passwd
    laeuft in sein eigenes Limit und endet mit Fehler."""
    pid, fd = pty.fork()
    if pid == 0:
        # Kindprozess: wird zum passwd. LANG/LC neutralisieren waere moeglich,
        # ist aber unnoetig (positionelle Erkennung). exec ersetzt das Kind;
        # kehrt es zurueck, ist exec gescheitert -> hart beenden.
        try:
            os.execvp("passwd", ["passwd", user])
        except OSError:
            os._exit(127)

    # Elternprozess: Prompts lesen, Antworten schreiben.
    ausgabe = []
    rest = list(antworten)
    puffer = ""
    import time
    ende = time.time() + timeout_s
    while True:
        if time.time() > ende:
            break
        r, _, _ = select.select([fd], [], [], 0.2)
        if fd in r:
            try:
                daten = os.read(fd, 1024)
            except OSError:
                break                       # pty geschlossen (Kind fertig)
            if not daten:
                break
            text = daten.decode("utf-8", "replace")
            ausgabe.append(text)
            puffer += text
            # Prompt erkannt (endet mit ':' ggf. + Leerzeichen) und noch eine
            # Antwort offen -> schreiben. Danach den Puffer leeren, damit
            # derselbe Prompt nicht doppelt antwortet.
            if rest and puffer.rstrip().endswith(":"):
                antwort = rest.pop(0)
                try:
                    os.write(fd, (antwort + "\n").encode("utf-8"))
                except OSError:
                    break
                puffer = ""
    # Auf das Kind warten und Returncode holen.
    try:
        _, status = os.waitpid(pid, 0)
    except OSError:
        status = 1
    try:
        os.close(fd)
    except OSError:
        pass
    rc = os.waitstatus_to_exitcode(status) if hasattr(os, "waitstatus_to_exitcode") \
        else (status >> 8)
    return rc, "".join(ausgabe)


def aendere(alt, neu, wiederholung, user=USER):
    """Setzt ein neues Login-Paßwort fuer `user` (dessen eigenes Konto) ueber
    `passwd` in einem Pseudo-Terminal. Prueft zuerst die Dialog-Regeln
    (pruefe_neues), treibt dann `passwd` positionell mit (alt, neu, neu).

    Wirft PasswortFehler (sprechend, mit roher passwd-Ausgabe als Diagnose-
    Anhang) bei Regelverstoß, falschem alten Paßwort oder passwd-Fehler
    (Policy-Ablehnung). Gibt bei Erfolg None zurueck."""
    pruefe_neues(neu, wiederholung)

    try:
        rc, ausgabe = _passwd_via_pty(user, [alt, neu, wiederholung])
    except OSError as e:
        raise PasswortFehler("Paßwort-Werkzeug nicht ausfuehrbar (" + str(e) + ").")

    if rc != 0:
        roh = ausgabe.strip()
        # Sicherheitsnetz: das echte `passwd` schaltet das Terminal-Echo ab, die
        # eingegebenen Paßwoerter erscheinen also normalerweise NICHT in der
        # Ausgabe. Falls doch (abweichendes passwd, Fehler-Nachprompt), die
        # eingegebenen Werte aus dem Diagnose-Anhang entfernen -- der Anhang
        # landet im kopierbaren Log, darf also kein Paßwort tragen.
        for geheim in (alt, neu, wiederholung):
            if geheim:
                roh = roh.replace(geheim, "***")
        # passwd meldet bei falschem alten Paßwort typischerweise eine
        # Authentifizierungs-Zeile; bei Policy-Ablehnung einen BAD-PASSWORD-
        # Hinweis. Eine sprechende Standardmeldung mit der (gefilterten) rohen
        # Ausgabe als Anhang.
        raise PasswortFehler(
            "Paßwortaenderung fehlgeschlagen. Haeufigste Ursache: das aktuelle "
            "Paßwort war falsch, oder das neue genuegt den System-Regeln nicht."
            + (("\n\nMeldung: " + roh) if roh else ""))


# ---------------------------------------------------------------- CLI

def cmd_pruefe(args):
    # Paßwort aus stdin lesen (nie als Argument -- argv ist fuer andere Nutzer
    # sichtbar). Eine Zeile.
    pw = sys.stdin.readline().rstrip("\n")
    treffer = ist_aktuelles_passwort(pw, user=args.user)
    print("JA" if treffer else "NEIN")
    return 0 if treffer else 1


def cmd_aendere(args):
    # Drei Zeilen von stdin: altes, neues, Wiederholung (nie als Argument).
    alt = sys.stdin.readline().rstrip("\n")
    neu = sys.stdin.readline().rstrip("\n")
    wdh = sys.stdin.readline().rstrip("\n")
    try:
        aendere(alt, neu, wdh, user=args.user)
    except PasswortFehler as e:
        print(str(e), file=sys.stderr)
        return 1
    print("Paßwort geaendert.")
    return 0


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_p = sub.add_parser("pruefe",
                         help="prueft ein Paßwort (von stdin) gegen das aktuelle")
    p_p.add_argument("--user", default=USER, help="Default " + USER)
    p_p.set_defaults(func=cmd_pruefe)

    p_a = sub.add_parser("aendere",
                         help="setzt ein neues Paßwort (alt/neu/wdh von stdin)")
    p_a.add_argument("--user", default=USER, help="Default " + USER)
    p_a.set_defaults(func=cmd_aendere)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
