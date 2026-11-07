#!/usr/bin/env python3
"""pico_core.py — Kern der Pico-ASHA-Verwaltung auf dem Stick.

Unprivilegiert, CLI-testbar (wie update_core.py und reset_core.py).
Wird von stick-files/updater_gui.py als Modul importiert (BA 721).
Benötigt: pa_cli (Qt-Konsolentool, liegt neben den Satz-Dateien in LOKAL)
für die Firmware-Versionsabfrage.
"""

import json
import os
import pathlib
import shutil
import subprocess
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Konstanten
# ---------------------------------------------------------------------------

WEBSPACE = "https://www.ci-sound-balancing.org/pico-asha/"
LOKAL = "/mnt/daten/pico-asha"            # Satz-Dateien + behaltene Artefakte
VERSIONSDATEI = "picoasha-version.json"   # liegt im Webspace UND in LOKAL
GUI_AKTIV = "PicoASHAGui-aktuell"         # fester Startpfad (Kopie, kein Symlink)
PA_CLI = str(Path(__file__).resolve().parent / "pa_cli")  # Qt-Konsolentool (neben diesem Skript in stick-files/)

# USB-IDs (verifiziert am realen Gerät)
USB_BETRIEB = (0xcafe, 0x4011)            # Pico-ASHA laeuft, meldet sich als Serial
BOOTSEL = {                               # Flash-Modus: USB-PID -> Board
    (0x2e8a, 0x0003): "pico_w",           # RP2040
    (0x2e8a, 0x000f): "pico2_w",          # RP2350
}
# Flash-Laufwerk-Label -> Board (zweite, redundante Modell-Quelle)
BOOTSEL_LABEL = {"RPI-RP2": "pico_w", "RP2350": "pico2_w"}

# ---------------------------------------------------------------------------
# Serial-Kommunikation ueber pa_cli (Qt-Konsolentool)
# ---------------------------------------------------------------------------
#
# Die Versionsabfrage laeuft NICHT ueber pyserial, sondern ueber das
# mitgelieferte Qt-Tool `pa_cli` (Pico-ASHA-Repo, gui/pa_cli.cpp). Grund: am
# Geraet per usbmon verifiziert, dass der Pico ausschliesslich dem
# QSerialPort-Lesepfad antwortet; pyserial und ein roher os/termios-Weg
# erzeugen byte-identische USB-Transfers (DTR, SET_LINE_CODING, Kommando-
# Bulk-OUT), erhalten aber keine Bulk-IN-Antwortdaten. `pa_cli version` gibt
# die Version als eine Zeile "major.minor.patch" auf stdout aus.


def lies_firmware_version(port: str = "/dev/ttyACM0"):
    """Liest die pa_version (x.y.z) ueber das Qt-Tool pa_cli. Gibt
    'major.minor.patch' zurueck oder None (kein/kein antwortender Pico, oder
    pa_cli fehlt). Ohne Netz nutzbar."""
    if not os.access(PA_CLI, os.X_OK):
        return None
    try:
        res = subprocess.run([PA_CLI, "--port", port, "version"],
                             capture_output=True, text=True, timeout=10)
    except Exception:
        return None
    if res.returncode != 0:
        return None
    ver = res.stdout.strip()
    # Plausibilitaet: "x.y.z" mit numerischen Teilen.
    teile = ver.split(".")
    if len(teile) == 3 and all(t.isdigit() for t in teile):
        return ver
    return None

# ---------------------------------------------------------------------------
# Pico-Erkennung
# ---------------------------------------------------------------------------

def _usb_geraete():
    """Liste (vid, pid) aller angeschlossenen USB-Geraete, aus sysfs
    (displayserver-unabhaengig, kein lsusb noetig)."""
    res = []
    for d in pathlib.Path("/sys/bus/usb/devices").glob("*"):
        try:
            vid = int((d / "idVendor").read_text().strip(), 16)
            pid = int((d / "idProduct").read_text().strip(), 16)
            res.append((vid, pid))
        except (OSError, ValueError):
            continue
    return res


def pico_betrieb_da() -> bool:
    """True, wenn ein Pico-ASHA im Normalbetrieb steckt (USB cafe:4011)."""
    return USB_BETRIEB in _usb_geraete()


def pico_flashmodus():
    """Gibt das Board ('pico_w'/'pico2_w') zurueck, wenn ein Pico im
    BOOTSEL-Modus steckt, sonst None. Modell primaer ueber USB-PID; wenn
    kein Treffer, None (die GUI kann zusaetzlich das Laufwerk-Label pruefen,
    s. flash_laufwerk)."""
    for vp in _usb_geraete():
        if vp in BOOTSEL:
            return BOOTSEL[vp]
    return None

# ---------------------------------------------------------------------------
# Satz-Versionsabgleich
# ---------------------------------------------------------------------------

def _lies_json_url(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


def _lies_json_datei(pfad):
    try:
        return json.loads(Path(pfad).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def webspace_satz():
    """Satz-Datei vom Webspace (dict) oder None (offline/Fehler)."""
    try:
        return _lies_json_url(WEBSPACE + VERSIONSDATEI)
    except Exception:
        return None


def stick_satz():
    """Lokal zuletzt heruntergeladener Satz (dict) oder None."""
    return _lies_json_datei(os.path.join(LOKAL, VERSIONSDATEI))

# ---------------------------------------------------------------------------
# Download (beide .uf2 + GUI, abbruchrobust)
# ---------------------------------------------------------------------------

def _download(url, ziel):
    """Erst .part, dann os.replace (ein Abbruch hinterlaesst keine halbe
    gueltige Datei)."""
    ziel = Path(ziel); ziel.parent.mkdir(parents=True, exist_ok=True)
    tmp = ziel.with_suffix(ziel.suffix + ".part")
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        while True:
            chunk = r.read(65536)
            if not chunk: break
            f.write(chunk)
    os.replace(tmp, ziel)


def satz_herunterladen(satz):
    """Laedt beide .uf2, die GUI und die Satz-Datei des uebergebenen Satzes
    (dict aus webspace_satz()) nach LOKAL. Pauschal beide Boards (klein)."""
    for feld in ("uf2_pico_w", "uf2_pico2_w", "gui"):
        name = satz[feld]
        _download(WEBSPACE + name, os.path.join(LOKAL, name))
    # Satz-Datei zuletzt schreiben -> erst nach vollstaendigem Download gilt
    # der Stick als auf diesem Satz.
    _download(WEBSPACE + VERSIONSDATEI, os.path.join(LOKAL, VERSIONSDATEI))

# ---------------------------------------------------------------------------
# Flashen + GUI-Übernahme
# ---------------------------------------------------------------------------

def _lsblk_laufwerk():
    """Findet das BOOTSEL-Blockgeraet an seinem Label. Gibt (dev, board,
    mountpunkt) zurueck; mountpunkt ist leer, wenn (noch) nicht gemountet.
    Liest NAME/LABEL/MOUNTPOINT aus lsblk -- MOUNTPOINT ist die verlaessliche
    Quelle fuer 'schon gemountet?' (Desktops automounten oft sofort)."""
    out = subprocess.run(["lsblk", "-o", "NAME,LABEL,MOUNTPOINT", "-nr"],
                         capture_output=True, text=True).stdout
    for zeile in out.splitlines():
        teile = zeile.split(maxsplit=2)
        if len(teile) >= 2 and teile[1] in BOOTSEL_LABEL:
            dev = "/dev/" + teile[0]
            board = BOOTSEL_LABEL[teile[1]]
            mp = teile[2] if len(teile) == 3 else ""
            return dev, board, mp
    return None, None, ""


def flash_laufwerk():
    """Mountet das BOOTSEL-Laufwerk (ohne root via udisksctl) und gibt
    (mountpunkt, board) zurueck oder (None, None). Board aus Label
    (Gegenpruefung zu pico_flashmodus()). Idempotent: ist das Laufwerk vom
    Desktop bereits automatisch gemountet, wird dessen Mountpunkt genutzt --
    udisksctl wird nur gerufen, wenn noch nicht gemountet, und der Mountpunkt
    danach aus lsblk gelesen (nicht aus der udisksctl-Ausgabe, die bei
    'AlreadyMounted' leer bleibt)."""
    dev, board, mp = _lsblk_laufwerk()
    if not dev:
        return None, None
    if mp:
        return mp, board                       # schon gemountet (Automount)
    subprocess.run(["udisksctl", "mount", "-b", dev],
                   capture_output=True, text=True)
    # tatsaechlichen Mountpunkt verlaesslich aus lsblk lesen
    _, _, mp = _lsblk_laufwerk()
    return (mp or None), board


def flashe(board, mountpunkt):
    """Kopiert die zum Board passende .uf2 aus LOKAL auf das gemountete
    Flash-Laufwerk. Wirft bei fehlender Datei. Nach vollstaendigem Kopieren
    rebootet der Pico selbst (Laufwerk verschwindet)."""
    satz = stick_satz()
    name = satz["uf2_pico_w" if board == "pico_w" else "uf2_pico2_w"]
    quelle = os.path.join(LOKAL, name)
    shutil.copy(quelle, os.path.join(mountpunkt, "pico_asha.uf2"))
    # Daten rausschreiben, damit der Pico das vollstaendige Image sieht.
    subprocess.run(["sync"])


def gui_uebernehmen():
    """Kopiert die GUI des aktuellen Stick-Satzes auf den festen Startpfad
    LOKAL/PicoASHAGui-aktuell (Kopie, KEIN Symlink -- exFAT). Das Desktop-Icon
    zeigt auf diesen festen Pfad. NUR nach bestaetigtem Flash-Erfolg aufrufen."""
    satz = stick_satz()
    quelle = os.path.join(LOKAL, satz["gui"])
    ziel = os.path.join(LOKAL, GUI_AKTIV)
    shutil.copy(quelle, ziel)
    os.chmod(ziel, 0o755)

# ---------------------------------------------------------------------------
# Hilfsfunktionen für CLI
# ---------------------------------------------------------------------------

def _upstream_version(satz_version: str) -> str:
    """Extrahiert den Upstream-Teil aus 'x.y.z+cimbel.n' -> 'x.y.z'."""
    return satz_version.split("+")[0] if satz_version else ""


def _pico_port():
    """Gibt den ersten /dev/ttyACM*-Port zurueck, falls ein Pico im Betrieb
    steckt, sonst None."""
    if not pico_betrieb_da():
        return None
    for p in sorted(pathlib.Path("/dev").glob("ttyACM*")):
        return str(p)
    return None

# ---------------------------------------------------------------------------
# CLI-Subkommandos
# ---------------------------------------------------------------------------

def cmd_status():
    """Statusabfrage: Pico, Firmware-Version, Satz-Vergleich."""
    betrieb = pico_betrieb_da()
    print(f"Pico im Betrieb: {'ja' if betrieb else 'nein'}")

    fw_version = None
    if betrieb:
        port = _pico_port()
        if port:
            fw_version = lies_firmware_version(port)
        print(f"Firmware-Version: {fw_version if fw_version else 'unbekannt'}")
    else:
        print("Firmware-Version: —")

    s_satz = stick_satz()
    if s_satz:
        print(f"Stick-Satz: {s_satz.get('satz_version', '?')}")
    else:
        print("Stick-Satz: (kein Satz heruntergeladen)")

    w_satz = webspace_satz()
    if w_satz:
        print(f"Webspace-Satz: {w_satz.get('satz_version', '?')}")
    else:
        print("Webspace-Satz: (nicht erreichbar)")

    # Urteile
    if s_satz and w_satz:
        if s_satz.get("satz_version") != w_satz.get("satz_version"):
            print("Update verfügbar: ja")
        else:
            print("Update verfügbar: nein")
    else:
        print("Update verfügbar: (kein Vergleich möglich)")

    if betrieb and fw_version and s_satz:
        upstream = _upstream_version(s_satz.get("satz_version", ""))
        if upstream and fw_version != upstream:
            print(f"Pico veraltet: ja (Firmware {fw_version}, Satz {upstream})")
        elif upstream:
            print("Pico veraltet: nein")
        else:
            print("Pico veraltet: (kein Vergleich möglich)")

    return 0


def cmd_download():
    """Aktuellen Webspace-Satz nach LOKAL herunterladen."""
    w_satz = webspace_satz()
    if not w_satz:
        print("Fehler: Webspace nicht erreichbar.")
        return 1
    print(f"Lade Satz {w_satz.get('version', '?')} herunter ...")
    try:
        satz_herunterladen(w_satz)
    except Exception as e:
        print(f"Fehler beim Download: {e}")
        return 1
    print("Download abgeschlossen.")
    return 0


def cmd_flash(force=False):
    """Pico im BOOTSEL-Modus flashen."""
    board_usb = pico_flashmodus()
    mp, board_lw = flash_laufwerk()

    board = board_usb or board_lw
    if not board or not mp:
        print("Fehler: Kein Pico im BOOTSEL-Modus gefunden (Laufwerk nicht gemountet).")
        return 1

    s_satz = stick_satz()
    if not s_satz:
        print("Fehler: Kein lokaler Satz vorhanden. Zuerst 'download' ausführen.")
        return 1

    board_name = "Pico 2 W" if board == "pico2_w" else "Pico W"
    print(f"{board_name} erkannt, Mountpunkt: {mp}")

    if not force:
        fw_version = None
        port = _pico_port()
        # Im BOOTSEL-Modus läuft keine Firmware — Versionsabfrage nur zur Info,
        # wenn zufällig vorher ein Serial-Port noch offen ist; sonst überspringen.

    print("Schreibe Firmware ...")
    try:
        flashe(board, mp)
    except Exception as e:
        print(f"Fehler beim Flashen: {e}")
        return 1
    print("Geschrieben. Der Pico bootet neu.")
    return 0


# ---------------------------------------------------------------------------
# Einstiegspunkt
# ---------------------------------------------------------------------------

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Pico-ASHA-Verwaltung auf dem Stick (CLI-Kern).")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status",      help="Pico-, Satz- und Versionsstatus anzeigen")
    sub.add_parser("download",    help="Aktuellen Webspace-Satz herunterladen")
    sub.add_parser("flash",       help="Pico im BOOTSEL-Modus flashen")
    sub.add_parser("force-flash", help="Pico flashen ohne Versionsvergleich")
    args = parser.parse_args()

    # pa_cli ist das Qt-Tool fuer die Versionsabfrage. Fehlt es, bleibt die
    # Versionsanzeige leer (lies_firmware_version gibt None) -- kein harter
    # Abbruch, damit download/flash auch ohne es laufen.
    if not os.access(PA_CLI, os.X_OK):
        print(f"Hinweis: {PA_CLI} fehlt oder ist nicht ausfuehrbar -- "
              "Firmware-Version kann nicht gelesen werden.")

    if args.cmd == "status":
        return cmd_status()
    elif args.cmd == "download":
        return cmd_download()
    elif args.cmd == "flash":
        return cmd_flash(force=False)
    elif args.cmd == "force-flash":
        return cmd_flash(force=True)
    return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
