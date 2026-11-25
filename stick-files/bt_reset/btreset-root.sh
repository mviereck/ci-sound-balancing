#!/bin/bash
# btreset-root.sh — Root-Teil des Bluetooth-Reset (via pkexec gebuendelt
# aufgerufen aus btreset.sh). Setzt ALLE USB-Bluetooth-Controller des Systems
# hart zurueck und startet danach den System-Dienst bluetooth neu.
#
# Reset-Methode: Treiber-unbind + -bind am btusb-Treiber
# (/sys/bus/usb/drivers/btusb/{unbind,bind}). Das loest den Controller hart vom
# Treiber und bindet ihn neu, auch wenn BlueZ ihn gerade haelt -- zuverlaessiger
# als "usbreset", das bei aktivem Controller mit "No such device"/EBUSY scheitert.
# Es genuegt, das Interface zu behandeln, an dem der hci haengt (z.B. 2-2:1.0);
# btusb zieht die weiteren Interfaces desselben Geraets (2-2:1.1) automatisch mit.
#
# Nur USB-Controller (Treiber btusb): interne BT-Chips (PCI/UART/SDIO) haben
# einen anderen Treiber und werden gemeldet + uebersprungen (ihr Reset waere
# hardwareabhaengig und auf fremden Rechnern riskant).
#
# Controller werden NICHT ueber eine feste USB-ID gesucht, sondern ueber
# /sys/class/bluetooth/hci* -> findet jeden Controller, egal welches Fabrikat,
# auf jedem Rechner.
set -u

if [ "$(id -u)" -ne 0 ]; then
    echo "btreset-root.sh muss als root laufen (via pkexec)." >&2
    exit 1
fi

BTUSB_DRV="/sys/bus/usb/drivers/btusb"

# Fuer ein hciN: das btusb-Interface ausgeben, an dem es haengt (z.B. "2-2:1.0"),
# aber nur wenn es ein USB-Controller ist. Sonst nichts.
usb_interface_for_hci() {
    local hci="$1" devdir iface d
    devdir="$(readlink -f "/sys/class/bluetooth/$hci")" || return 1
    # hci0-Pfad endet auf .../2-2/2-2:1.0/bluetooth/hci0 ; das Interface ist der
    # Ordner zwei Ebenen ueber dem bluetooth/-Verzeichnis.
    iface="$(basename "$(dirname "$(dirname "$devdir")")")"
    # Nur akzeptieren, wenn dieses Interface wirklich an btusb haengt.
    [ -e "$BTUSB_DRV/$iface" ] && { echo "$iface"; return 0; }
    return 1
}

shopt -s nullglob
controllers=(/sys/class/bluetooth/hci*)
if [ "${#controllers[@]}" -eq 0 ]; then
    echo "Kein Bluetooth-Controller gefunden (/sys/class/bluetooth ist leer)."
fi

reset_count=0
for path in "${controllers[@]}"; do
    hci="$(basename "$path")"
    iface="$(usb_interface_for_hci "$hci")"
    if [ -z "$iface" ]; then
        echo "- $hci: kein USB-Controller (intern) -> uebersprungen."
        continue
    fi
    echo "- $hci: USB-Controller an Interface $iface -> unbind/bind an btusb"
    echo "$iface" > "$BTUSB_DRV/unbind" 2>/dev/null || echo "  WARNUNG: unbind $iface fehlgeschlagen." >&2
    sleep 1
    echo "$iface" > "$BTUSB_DRV/bind" 2>/dev/null || echo "  WARNUNG: bind $iface fehlgeschlagen." >&2
    # Erfolg am Wieder-Erscheinen des Controllers messen (bind-Rueckgabe ist
    # unzuverlaessig, wenn btusb das Geraet schon beim ersten Interface hochbringt).
    for _ in 1 2 3 4 5 6; do
        [ -e "/sys/class/bluetooth/$hci" ] && break
        sleep 0.5
    done
    if [ -e "/sys/class/bluetooth/$hci" ]; then
        echo "  $hci wieder da."
        reset_count=$((reset_count+1))
    else
        echo "  WARNUNG: $hci ist nach dem Reset nicht wieder aufgetaucht." >&2
    fi
done

sleep 1
echo
echo "USB-Controller zurueckgesetzt: $reset_count"
echo "Starte System-Dienst bluetooth neu ..."
if systemctl restart bluetooth; then
    echo "bluetooth neu gestartet."
else
    echo "WARNUNG: Neustart von bluetooth fehlgeschlagen." >&2
    exit 1
fi
exit 0
