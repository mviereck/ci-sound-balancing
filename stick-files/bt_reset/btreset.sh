#!/bin/bash
# btreset.sh — Bluetooth vollstaendig zuruecksetzen (Stick-Desktop-Icon).
#
# Haengt die ASHA-Verbindung (Controller wird kommandotaub: dmesg zeigt
# "command tx timeout", btmgmt findet 0 Controller), bringt dieser Reset den
# USB-Bluetooth-Controller sauber zurueck.
#
# Rechteteilung (wichtig):
#   - eira stop/start laeuft als USER (systemctl --user, in dieser Session).
#   - usbreset + Neustart von bluetooth.service brauchen ROOT -> als EIN
#     gebuendelter pkexec-Aufruf von btreset-root.sh (nur ein Passwort-Popup).
#
# WICHTIG: eira wird in Schritt 1 nur gestoppt, um dem Reset Platz zu machen.
# eira MUSS danach IMMER wieder gestartet werden -- auch wenn der Reset
# fehlschlaegt oder der Nutzer das pkexec-Passwort abbricht. Sonst bliebe eira
# gestoppt zurueck, obwohl gar nichts zurueckgesetzt wurde.
#
# Aufgerufen vom .desktop-Launcher in einem Terminalfenster, damit der Ablauf
# sichtbar ist. Machart wie die uebrigen Stick-Werkzeuge (pkexec, x-terminal).
set -u

HIER="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
ROOT_SKRIPT="$HIER/btreset-root.sh"

eira_start() {
    # Einzige Stelle, die eira startet -- im Erfolgs- WIE im Abbruchfall benutzt.
    if command -v eira >/dev/null 2>&1; then
        eira start || echo "  (eira start meldete einen Fehler -- bitte pruefen)"
    else
        echo "  eira-Befehl nicht gefunden -- ueberspringe eira start."
    fi
}

echo "=== Bluetooth zuruecksetzen ==="
echo

# 1) eira stoppen (User-Session). eira-Befehl ist optional vorhanden.
if command -v eira >/dev/null 2>&1; then
    echo "[1/3] eira-Dienste stoppen ..."
    eira stop || echo "  (eira stop meldete einen Fehler -- fahre fort)"
else
    echo "[1/3] eira-Befehl nicht gefunden -- ueberspringe eira stop."
fi
echo

# 2) Root-Block: USB-BT-Controller reset + bluetooth neu starten.
#    Bei Fehler/Abbruch: eira TROTZDEM wieder starten (Schritt 1 hat es gestoppt).
echo "[2/3] USB-Bluetooth-Controller zuruecksetzen (Passwort noetig) ..."
if ! pkexec bash "$ROOT_SKRIPT"; then
    echo
    echo "FEHLER: Der Reset-Schritt (pkexec) ist fehlgeschlagen oder wurde abgebrochen." >&2
    echo "Es wurde nichts zurueckgesetzt. Starte eira wieder (war nur fuer den Reset gestoppt) ..." >&2
    eira_start
    echo
    read -r -p "Fenster schliessen mit Enter ..." _
    exit 1
fi
echo

# 3) eira wieder starten (User-Session).
echo "[3/3] eira-Dienste starten ..."
eira_start
echo

echo "=== Fertig. Bluetooth wurde zurueckgesetzt. ==="
echo "Das Fenster schliesst sich in 5 Sekunden ..."
sleep 5
exit 0
