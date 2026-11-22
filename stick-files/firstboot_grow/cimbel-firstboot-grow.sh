#!/bin/bash
# cimbel-firstboot-grow.sh -- vergroessert beim ersten Boot die NTFS-
# Datenpartition auf die volle Stickgroesse.
#
# Hintergrund (Konzept_Offline_Stick.md, "Herstellung / Skalierung"):
# Das Download-Image ist klein (~4 GB gzip); auf einen groesseren Stick
# geschrieben liegt hinter der Datenpartition Platz brach. Dieser Dienst
# zieht die Partition einmalig auf die reale Stickgroesse nach, damit der
# ueber den Teilmengen-Download nachgeladene Audio-Bestand hineinpasst.
# Laeuft automatisch (systemd-oneshot), der Nutzer merkt nichts.
#
# Reihenfolge (verifiziert, ntfsresize(8)/growpart): erst die Partition
# nachziehen (growpart), dann das NTFS ausdehnen (ntfsresize DEVICE ohne
# --size = fuellt die Partition). ntfsresize braucht die Partition
# UNMONTIERT -- deshalb unmountet das Skript /mnt/daten selbst, resized,
# mountet wieder. Beim allerersten Boot ist dort noch nichts in Benutzung.
#
# DIESES SKRIPT LIEGT ZUR LAUFZEIT AUF DER ext4-SYSTEMPARTITION
# (/usr/local/sbin/), NICHT auf /mnt/daten -- es unmountet /mnt/daten und
# wuerde sich sonst selbst den Boden entziehen. Die Repo-Kopie unter
# stick-files/firstboot_grow/ ist die PFLEGE-Quelle; der Image-Bau kopiert
# sie namensgleich nach /usr/local/sbin/ (s. INSTALL.md).
#
# Sicherheitsnetze (mehrfach, weil Partition-Resize der gefaehrlichste
# Schritt ist):
#   1. Marker-Datei: ist der Grow schon erfolgreich durch, sofort raus.
#   2. Ziel-Identifikation (dreifach): NUR die LETZTE Partition des
#      BOOT-Mediums, nur wenn NTFS, nur wenn Label "cimbeldaten". Das
#      Boot-Medium wird aus der Root-Partition abgeleitet (findmnt /), nicht
#      geraten -- kein Fehlgriff auf ein zweites eingestecktes Medium.
#   3. Freiraum-Pruefung: nur vergroessern, wenn hinter der Partition
#      wirklich nennenswerter freier Platz ist -- sonst No-Op (macht das
#      Skript idempotent, auch ohne Marker).
#   4. set -euo pipefail: bricht bei jedem Fehler ab, bevor etwas Halbes
#      passiert; der Marker wird erst NACH erfolgreichem ntfsresize gesetzt.
#
# Manuell testbar:  sudo bash cimbel-firstboot-grow.sh --trockenlauf
set -euo pipefail

MARKER="/var/lib/cimbel/firstboot-grow-done"
DATEN_MOUNT="/mnt/daten"
TROCKEN=0
[ "${1:-}" = "--trockenlauf" ] && TROCKEN=1

log() { echo "[firstboot-grow] $*"; }

# --- 0a. in einer VM? Dann NICHT scharf laufen ------------------------------
# Der Master wird in einer VM (VirtualBox: systemd-detect-virt -> "oracle")
# gepflegt; auf echter Hardware liefert es "none". Lief das Skript in der VM
# scharf durch, wuerde es dort den Marker setzen -- und das daraus gebaute
# Image kaeme beim Nutzer mit gesetztem Marker an (vergroessert dann nichts).
# Darum in jeder VM hart aussteigen, OHNE Marker zu setzen. So muss beim
# Image-Bau nicht daran gedacht werden, den Marker zu entfernen.
# Ausnahme: --trockenlauf laeuft auch in der VM durch (Test der Ziel-
# Identifikation), er veraendert ohnehin nichts und setzt keinen Marker.
VIRT="$(systemd-detect-virt 2>/dev/null || echo none)"
if [ "$VIRT" != "none" ] && [ "$TROCKEN" -eq 0 ]; then
    log "Virtualisierung erkannt ($VIRT) -- Master-/VM-Umgebung, KEIN Grow, KEIN Marker."
    exit 0
fi

# --- 0b. schon erledigt? ----------------------------------------------------
if [ -e "$MARKER" ]; then
    log "Marker vorhanden ($MARKER) -- bereits vergroessert, nichts zu tun."
    exit 0
fi

# --- 1. Boot-Medium und Ziel-Partition bestimmen ----------------------------
# Root-Quellgeraet (z.B. /dev/sda2) -> Disk (/dev/sda) -> letzte Partition.
ROOT_SRC="$(findmnt -n -o SOURCE / || true)"
if [ -z "$ROOT_SRC" ]; then
    log "FEHLER: Root-Geraet nicht ermittelbar (findmnt /)." >&2
    exit 1
fi
# Disk-Namen zur Root-Partition holen (pkname = parent kernel name).
DISK_NAME="$(lsblk -no PKNAME "$ROOT_SRC" | head -n1 || true)"
if [ -z "$DISK_NAME" ]; then
    log "FEHLER: Disk zu $ROOT_SRC nicht ermittelbar." >&2
    exit 1
fi
DISK="/dev/$DISK_NAME"

# Letzte Partition dieser Disk (hoechste Partitionsnummer).
LAST_PART="$(lsblk -lnpo NAME,TYPE "$DISK" | awk '$2=="part"{p=$1} END{print p}')"
if [ -z "$LAST_PART" ]; then
    log "FEHLER: keine Partition auf $DISK gefunden." >&2
    exit 1
fi

# Partitionsnummer aus dem Namen (z.B. /dev/sda3 -> 3; /dev/nvme0n1p3 -> 3).
# WICHTIG: lsblk -no PARTN gibt die Spalte rechtsbuendig MIT fuehrenden
# Leerzeichen aus (" 3"); growpart lehnt das ab ("must be a number"). Darum
# jeden Whitespace entfernen.
PART_NUM="$(lsblk -no PARTN "$LAST_PART" 2>/dev/null | tr -d '[:space:]' || true)"
if [ -z "$PART_NUM" ]; then
    # Fallback: Ziffern am Ende des Namens.
    PART_NUM="$(echo "$LAST_PART" | grep -oE '[0-9]+$' || true)"
fi
if [ -z "$PART_NUM" ]; then
    log "FEHLER: Partitionsnummer zu $LAST_PART nicht ermittelbar." >&2
    exit 1
fi

# --- 2. ist die letzte Partition wirklich unsere NTFS-Datenpartition? -------
# Dreifache Bedingung: letzte Partition (oben ermittelt) UND ntfs UND das
# Volume-Label "cimbeldaten". Das Label ist der dritte Riegel zusaetzlich zur
# Boot-Medium-Eingrenzung -- vergroessert nur die wirklich gemeinte Partition.
FSTYPE="$(lsblk -no FSTYPE "$LAST_PART" || true)"
if [ "$FSTYPE" != "ntfs" ]; then
    log "Letzte Partition $LAST_PART ist $FSTYPE, nicht ntfs -- NICHTS getan." >&2
    exit 1
fi
LABEL="$(lsblk -no LABEL "$LAST_PART" 2>/dev/null | sed 's/[[:space:]]*$//' || true)"
if [ "$LABEL" != "cimbeldaten" ]; then
    log "Letzte NTFS-Partition $LAST_PART hat Label '$LABEL', nicht 'cimbeldaten' -- NICHTS getan." >&2
    exit 1
fi
log "Ziel: $LAST_PART (Partition $PART_NUM auf $DISK), ntfs, Label cimbeldaten."

# --- 3. gibt es ueberhaupt freien Platz dahinter? ---------------------------
# growpart --dry-run meldet, ob/wie weit sich die Partition vergroessern
# liesse. Kein freier Platz -> Exit-Code != 0 bzw. "NOCHANGE".
GROW_DRY="$(growpart --dry-run "$DISK" "$PART_NUM" 2>&1 || true)"
log "growpart --dry-run: $GROW_DRY"
if echo "$GROW_DRY" | grep -qi "NOCHANGE"; then
    log "Kein nennenswerter freier Platz hinter der Partition -- No-Op."
    # Marker setzen: der Stick ist bereits in Zielgroesse, kein erneuter Lauf.
    [ "$TROCKEN" -eq 0 ] && { mkdir -p "$(dirname "$MARKER")"; : > "$MARKER"; }
    exit 0
fi

if [ "$TROCKEN" -eq 1 ]; then
    log "TROCKENLAUF: wuerde jetzt growpart + ntfsresize ausfuehren. Ende."
    exit 0
fi

# --- 4. Partition nachziehen (growpart) -------------------------------------
log "Vergroessere Partition $PART_NUM auf $DISK ..."
growpart "$DISK" "$PART_NUM"
# Kernel die neue Groesse einlesen lassen.
partprobe "$DISK" || udevadm settle || true

# --- 5. /mnt/daten unmounten (ntfsresize braucht unmontiert) ----------------
WAR_GEMOUNTET=0
if mountpoint -q "$DATEN_MOUNT"; then
    WAR_GEMOUNTET=1
    log "Unmounte $DATEN_MOUNT fuer den Resize ..."
    umount "$DATEN_MOUNT"
fi

# --- 6. NTFS ausdehnen -------------------------------------------------------
# Ohne --size: ntfsresize fuellt die (jetzt groessere) Partition ganz aus.
# ntfsresize markiert das FS fuer einen Konsistenz-Check; unter Linux (ntfs3)
# unkritisch, nur ein spaeterer Windows-Boot zeigt einmalig chkdsk.
log "Dehne NTFS auf $LAST_PART aus ..."
ntfsresize --force "$LAST_PART"

# --- 7. wieder mounten -------------------------------------------------------
if [ "$WAR_GEMOUNTET" -eq 1 ]; then
    log "Mounte $DATEN_MOUNT wieder ..."
    mount "$DATEN_MOUNT"
fi

# --- 8. Marker setzen + Dienst stilllegen -----------------------------------
mkdir -p "$(dirname "$MARKER")"
: > "$MARKER"
log "Fertig: Datenpartition auf volle Stickgroesse vergroessert."

# Dienst fuer kuenftige Boots abschalten (Marker greift ohnehin, dies haelt
# nur die Boot-Liste sauber). Scheitert das (z.B. Skript manuell gelaufen),
# ist das kein Fehler -- der Marker verhindert den erneuten Lauf.
systemctl disable cimbel-firstboot-grow.service 2>/dev/null || true
