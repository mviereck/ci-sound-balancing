#!/usr/bin/env python3
"""Paßwort-Kern des Offline-Sticks (keine UI, CLI-testbar).

Zwei Aufgaben rund um das Login-Paßwort des einen Stick-Users `cimbel`:

  pruefe <pw>   -- prueft, ob <pw> das aktuelle Paßwort von `cimbel` ist.
  aendere       -- setzt ein neues Paßwort (altes + neues ueber stdin).

Hintergrund (siehe Konzept_Offline_Stick.md, Abschnitt „Root-Paßwort"):
Der Stick wird mit dem allgemeinen, unsicheren Paßwort `cimbel` ausgeliefert.
Das Pflegefenster bietet einen oma-tauglichen Knopf, der zur Aenderung
auffordert und sie durchfuehrt. Es geht um Bequemlichkeit/Hygiene, nicht um
harte Sicherheit (physischer Besitz legt die NTFS-Daten ohnehin offen); uebers
Netz ist das Paßwort nicht angreifbar (kein SSH/Login-Dienst).

SICHERHEIT (warum die Paßwoerter ueber stdin laufen, nie als Argument):
Jedes Paßwort wird ueber stdin gereicht, steht damit NUR im Pipe-Inhalt, nie in
der Prozeßliste (argv) oder in einem Shell-Verlauf. Es wird KEIN Paßwort in
einer Datei oder im Skript hinterlegt (das Konzept verbietet NOPASSWD/
hinterlegte Paßwoerter -- der Updater liegt user-beschreibbar und erneuert sich
selbst).

MECHANIK der Aenderung (warum zwei sudo-Laeufe):
`cimbel` koennte sein eigenes Paßwort mit `passwd` auch ohne sudo aendern --
aber `passwd` liest das ALTE Paßwort bei der Eigenaenderung bewusst nur vom
Terminal, nicht von einer Pipe; eine rein nicht-interaktive Fuetterung ist so
nicht moeglich. Darum ueber `sudo passwd --stdin`.

Die Herausforderung: `sudo -S` UND `passwd --stdin` wollen beide von stdin lesen
(sudo das alte Paßwort, passwd das neue). Ein einziger stdin-Strom mit zwei
Zeilen traegt NICHT -- bei falschem altem Paßwort verbraucht sudo die zweite
Zeile als weiteren Fehlversuch, und die Durchreichung ans Kind ist nicht
garantiert (sudo schliesst Zusatz-Deskriptoren, closefrom).

Loesung (zwei Laeufe, je EIN stdin-Strom):
  1. `sudo -S -k true` mit dem ALTEN Paßwort auf stdin. `-k` verwirft einen
     evtl. gecachten Timestamp -> der Lauf prueft wirklich das alte Paßwort.
     Erfolg bestaetigt das alte Paßwort UND setzt frisch den sudo-Timestamp.
  2. unmittelbar danach `sudo -S passwd --stdin cimbel` mit dem NEUEN Paßwort
     auf stdin -- OHNE `-k` (sonst wuerde es den eben gesetzten Cache wieder
     verwerfen). sudo ist jetzt gecacht, verlangt also kein Paßwort mehr; der
     stdin-Strom traegt NUR das neue Paßwort, das direkt bei `passwd --stdin`
     ankommt. Keine Kollision.
Beide Paßwoerter stehen nur im jeweiligen Pipe-Inhalt, nie in argv.
"""
import argparse
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

    Nebenwirkung: ein fehlgeschlagener Versuch landet als sudo-Fehlversuch im
    lokalen /var/log/auth.log -- harmlos (kein Netz), aber bei jedem
    Fensteroeffnen nach erfolgter Aenderung eine Logzeile."""
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
    Reine Validierung, keine Systemaenderung -- so vor dem sudo-Lauf
    aufrufbar (und einzeln testbar)."""
    if not neu:
        raise PasswortFehler("Das neue Paßwort darf nicht leer sein.")
    if len(neu) < MINDESTLAENGE:
        raise PasswortFehler("Das neue Paßwort muss mindestens "
                             + str(MINDESTLAENGE) + " Zeichen lang sein.")
    if neu != wiederholung:
        raise PasswortFehler("Die beiden Eingaben des neuen Paßworts stimmen "
                             "nicht ueberein.")


def aendere(alt, neu, wiederholung, user=USER):
    """Setzt ein neues Login-Paßwort fuer `user`.

    Ablauf: (0) Dialog-Regeln pruefen (pruefe_neues). (1) altes Paßwort per
    `sudo -S -k true` verifizieren -- schlaegt es fehl, war das alte Paßwort
    falsch (oder `user` nicht sudo-berechtigt). (2) neues Paßwort per
    `sudo -S passwd --stdin user` (ohne -k, nutzt den eben gesetzten Cache)
    setzen. Siehe Modul-Docstring (MECHANIK) fuer das Warum der zwei Laeufe.

    Wirft PasswortFehler (sprechend) bei Regelverstoß, falschem alten Paßwort
    oder passwd-Fehler. Gibt bei Erfolg None zurueck."""
    pruefe_neues(neu, wiederholung)

    # Schritt 1: altes Paßwort verifizieren (und sudo-Timestamp frisch setzen).
    if not ist_aktuelles_passwort(alt, user=user):
        raise PasswortFehler(
            "Das aktuelle Paßwort ist falsch (oder der Benutzer darf das "
            "Paßwort nicht aendern).")

    # Schritt 2: neues Paßwort setzen. sudo ist jetzt gecacht (Schritt 1 war
    # erfolgreich), darum OHNE -k -- so verlangt sudo kein Paßwort und der
    # stdin-Strom traegt NUR das neue Paßwort fuer `passwd --stdin`.
    try:
        p = subprocess.run(
            ["sudo", "-S", "passwd", "--stdin", user],
            input=neu + "\n", text=True, capture_output=True)
    except OSError as e:
        raise PasswortFehler("Paßwort-Werkzeug nicht ausfuehrbar (" + str(e) + ").")

    if p.returncode != 0:
        # passwd/sudo geben das Paßwort nie aus; die rohe Ausgabe ist technisch,
        # darum eine sprechende Standardmeldung mit der rohen Ausgabe als Anhang.
        roh = ((p.stderr or "") + (p.stdout or "")).strip()
        raise PasswortFehler(
            "Paßwortaenderung fehlgeschlagen."
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
