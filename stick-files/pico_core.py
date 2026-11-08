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
# die Version als eine Zeile "x.y.z+cimbel.N" auf stdout aus (Upstream-Version
# plus CImbel-Patch-Nummer; N=0 bei unveraenderter Original-FW).


def lies_firmware_version_roh(port: str = "/dev/ttyACM0"):
    """Wie lies_firmware_version, aber gibt die Rohdaten des pa_cli-Aufrufs
    mit zurueck: (version_oder_None, returncode_oder_None, stderr_text).
    Dient der Diagnose (unterscheidet 'kein Pico' / 'Port nicht oeffenbar' /
    'locking' / Timeout, die alle in version=None muenden). returncode ist
    None, wenn pa_cli fehlt oder der Aufruf eine Exception warf; stderr
    enthaelt dann eine erklaerende Zeile."""
    if not os.access(PA_CLI, os.X_OK):
        return None, None, "pa_cli fehlt oder ist nicht ausfuehrbar"
    try:
        res = subprocess.run([PA_CLI, "--port", port, "version"],
                             capture_output=True, text=True, timeout=10)
    except Exception as e:
        return None, None, f"pa_cli-Aufruf fehlgeschlagen: {e}"
    ver = res.stdout.strip()
    # Plausibilitaet: "x.y.z+cimbel.N" -- pa_cli liefert seit dem CImbel-Patch
    # immer die volle Satz-Kennung (Upstream-Version plus Patch-Nummer; N=0 bei
    # unveraenderter Original-FW). Das Format ist direkt mit satz_version aus
    # picoasha-version.json vergleichbar (ein Versionspfad).
    if res.returncode == 0 and _ist_satz_version(ver):
        return ver, res.returncode, (res.stderr or "")
    return None, res.returncode, (res.stderr or "")


def lies_firmware_version(port: str = "/dev/ttyACM0"):
    """Liest die Firmware-Version ueber das Qt-Tool pa_cli. Gibt die volle
    Satz-Kennung 'x.y.z+cimbel.N' zurueck (N=0 bei unveraenderter Original-FW)
    oder None (kein/kein antwortender Pico, oder pa_cli fehlt). Ohne Netz
    nutzbar. Duenner Wrapper um lies_firmware_version_roh (nur die Version)."""
    ver, _rc, _err = lies_firmware_version_roh(port)
    return ver


def pico_port_gesperrt(port: str = "/dev/ttyACM0") -> bool:
    """True, wenn der serielle Pico-Port durch einen anderen Prozess
    (typisch die laufende PicoASHAGui) gesperrt ist. QtSerialPort meldet dann
    beim Oeffnen einen 'locking'-Fehler. Dient der GUI dazu, den Nutzer zum
    Beenden der PicoASHAGui aufzufordern, statt faelschlich 'Firmware
    unbekannt' anzuzeigen. Setzt einen Pico im Betrieb voraus; ohne pa_cli
    oder ohne Geraet: False (dann greifen die anderen Statuszweige)."""
    if not pico_betrieb_da() or not os.access(PA_CLI, os.X_OK):
        return False
    try:
        res = subprocess.run([PA_CLI, "--port", port, "version"],
                             capture_output=True, text=True, timeout=10)
    except Exception:
        return False
    # QSerialPort-errorString() bei belegtem Port enthaelt "locking".
    return "locking" in (res.stderr or "").lower()

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
    """Lokal zuletzt heruntergeladene Satz-DATEI (ganzes dict im saetze[]-Format)
    oder None. Enthaelt saetze[] (Original + Patch), default, original,
    firmware_upstream -- die einzelne Variante liefert waehle_satz()."""
    return _lies_json_datei(os.path.join(LOKAL, VERSIONSDATEI))


# ---------------------------------------------------------------------------
# Satz-Variante aus der Datei ziehen (saetze[]-Format)
# ---------------------------------------------------------------------------
#
# Die picoasha-version.json fuehrt ZWEI Saetze auf: Original (+cimbel.0) und
# Patch (+cimbel.N). Welcher gilt, steht in den Feldern "default" (= Patch, der
# mess-optimierte Standard) und "original". waehle_satz() zieht den passenden
# Eintrag als flaches Satz-dict (satz_version, uf2_pico_w, uf2_pico2_w, gui,
# ist_patch) heraus -- die eine Stelle, die die saetze[]-Struktur kennt; alle
# Konsumenten (Vergleich, Download, Flash, GUI-Uebernahme) gehen darueber.

def waehle_satz(datei, variante="default"):
    """Liefert aus der Satz-Datei (ganzes dict) den Satz der gewuenschten
    Variante als flaches dict, oder None.
    variante: "default" (Patch, Standard) oder "original" (unveraenderte FW).
    Der Zielsatz ist der saetze[]-Eintrag, dessen satz_version mit dem Wert im
    gleichnamigen Top-Level-Feld uebereinstimmt. Fehlt die Struktur (altes
    flaches Format, leeres dict), gibt es None -- die Konsumenten behandeln das
    wie 'kein Satz'."""
    if not datei:
        return None
    saetze = datei.get("saetze")
    ziel_version = datei.get(variante)
    if not isinstance(saetze, list) or not ziel_version:
        return None
    for s in saetze:
        if s.get("satz_version") == ziel_version:
            return s
    return None

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


def satz_herunterladen(datei):
    """Laedt die Artefakte ALLER Saetze (Original + Patch) der uebergebenen
    Satz-Datei (ganzes dict aus webspace_satz()) nach LOKAL, dazu die
    Satz-Datei selbst. Beide Saetze, weil die Flash-Auswahl zwischen Original
    und Patch waehlen koennen muss, ohne nachzuladen (Konzept Offline-Stick:
    'der Stick holt beide'). Pauschal beide Boards je Satz (klein). Mehrfach
    vorkommende Dateinamen werden nur einmal geladen."""
    saetze = (datei or {}).get("saetze") or []
    schon = set()
    for s in saetze:
        for feld in ("uf2_pico_w", "uf2_pico2_w", "gui"):
            name = s.get(feld)
            if name and name not in schon:
                schon.add(name)
                _download(WEBSPACE + name, os.path.join(LOKAL, name))
    # Satz-Datei zuletzt schreiben -> erst nach vollstaendigem Download gilt
    # der Stick als auf diesem Satz(-Stand).
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


def flashe(board, mountpunkt, variante="default"):
    """Kopiert die zum Board passende .uf2 des gewaehlten Satzes (variante:
    'default' = Patch, 'original' = unveraenderte FW) aus LOKAL auf das
    gemountete Flash-Laufwerk. Wirft bei fehlender Datei oder fehlendem Satz.
    Nach vollstaendigem Kopieren rebootet der Pico selbst (Laufwerk
    verschwindet)."""
    satz = waehle_satz(stick_satz(), variante)
    if not satz:
        raise RuntimeError(f"Kein Satz '{variante}' in der lokalen Satz-Datei.")
    name = satz["uf2_pico_w" if board == "pico_w" else "uf2_pico2_w"]
    quelle = os.path.join(LOKAL, name)
    shutil.copy(quelle, os.path.join(mountpunkt, "pico_asha.uf2"))
    # Daten rausschreiben, damit der Pico das vollstaendige Image sieht.
    subprocess.run(["sync"])


def gui_uebernehmen(variante="default"):
    """Kopiert die GUI des gewaehlten Stick-Satzes (variante: 'default'=Patch,
    'original') auf den festen Startpfad LOKAL/PicoASHAGui-aktuell (Kopie, KEIN
    Symlink -- exFAT). Das Desktop-Icon zeigt auf diesen festen Pfad. NUR nach
    bestaetigtem Flash-Erfolg aufrufen; muss zur geflashten Variante passen."""
    satz = waehle_satz(stick_satz(), variante)
    if not satz:
        raise RuntimeError(f"Kein Satz '{variante}' in der lokalen Satz-Datei.")
    quelle = os.path.join(LOKAL, satz["gui"])
    ziel = os.path.join(LOKAL, GUI_AKTIV)
    shutil.copy(quelle, ziel)
    os.chmod(ziel, 0o755)

# ---------------------------------------------------------------------------
# Hilfsfunktionen für CLI
# ---------------------------------------------------------------------------

def _ist_satz_version(s: str) -> bool:
    """True, wenn s die Form 'x.y.z+cimbel.N' hat (numerische x,y,z,N). Das ist
    das Format, das pa_cli seit dem CImbel-Patch liefert und das auch in
    satz_version (picoasha-version.json) steht."""
    if not s or "+cimbel." not in s:
        return False
    kern, _, patch = s.partition("+cimbel.")
    teile = kern.split(".")
    return (len(teile) == 3 and all(t.isdigit() for t in teile)
            and patch.isdigit())


def _pico_port():
    """Gibt den ersten /dev/ttyACM*-Port zurueck, falls ein Pico im Betrieb
    steckt, sonst None."""
    if not pico_betrieb_da():
        return None
    for p in sorted(pathlib.Path("/dev").glob("ttyACM*")):
        return str(p)
    return None


def warte_firmware_version(timeout_s: float = 15.0, intervall_s: float = 0.5):
    """Pollt nach einem Flash/Reboot die Firmware-Version, bis sie lesbar ist
    oder timeout_s abgelaufen ist. Deckt das Timing-Race zwischen USB-Re-
    Enumeration (pico_betrieb_da schon True) und CDC-tty-Bereitschaft ab: der
    tty und die Antwortbereitschaft der FW brauchen nach dem Reboot laenger
    als die USB-Anmeldung. Nutzt in jeder Runde _pico_port() (richtiger
    ttyACM*-Port nach Re-Enumeration, nicht fester Default).

    Gibt (version_oder_None, letzter_returncode, letzter_stderr) zurueck --
    bei Erfolg die Version, bei Timeout die letzte Roh-Fehlerinfo fuer die
    Diagnose."""
    import time
    ende = time.monotonic() + timeout_s
    letzter_rc, letzter_err = None, "kein ttyACM-Port erschienen"
    while True:
        port = _pico_port()
        if port:
            ver, rc, err = lies_firmware_version_roh(port)
            if ver:
                return ver, rc, err
            letzter_rc, letzter_err = rc, err
        if time.monotonic() >= ende:
            return None, letzter_rc, letzter_err
        time.sleep(intervall_s)

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

    # Vergleich/Anzeige beziehen sich auf den default-Satz (Patch, der
    # mess-optimierte Standard); die Flash-Auswahl kann spaeter die
    # Original-Variante explizit waehlen.
    s_datei = stick_satz(); w_datei = webspace_satz()
    s_satz = waehle_satz(s_datei, "default")
    w_satz = waehle_satz(w_datei, "default")
    if s_satz:
        print(f"Stick-Satz: {s_satz.get('satz_version', '?')}")
    else:
        print("Stick-Satz: (kein Satz heruntergeladen)")

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
        # Voller Vergleich inkl. Patch-Nummer: fw_version ist 'x.y.z+cimbel.N'
        # (pa_cli), satz_version ebenso. So schlaegt auch ein noch nicht
        # geflashter Patch (Pico cimbel.0, default-Satz cimbel.1) als 'veraltet' an.
        satz_ver = s_satz.get("satz_version", "")
        if satz_ver and fw_version != satz_ver:
            print(f"Pico veraltet: ja (Firmware {fw_version}, Satz {satz_ver})")
        elif satz_ver:
            print("Pico veraltet: nein")
        else:
            print("Pico veraltet: (kein Vergleich möglich)")

    return 0


def cmd_download():
    """Satz-Datei + Artefakte (beide Saetze) vom Webspace nach LOKAL laden."""
    w_datei = webspace_satz()
    if not w_datei:
        print("Fehler: Webspace nicht erreichbar.")
        return 1
    print(f"Lade Satz-Stand {w_datei.get('default', '?')} (inkl. Original) herunter ...")
    try:
        satz_herunterladen(w_datei)
    except Exception as e:
        print(f"Fehler beim Download: {e}")
        return 1
    print("Download abgeschlossen.")
    return 0


def cmd_flash(force=False, variante="default"):
    """Pico im BOOTSEL-Modus flashen (variante: 'default'=Patch, 'original')."""
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

    print(f"Schreibe Firmware ({variante}) ...")
    try:
        flashe(board, mp, variante)
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
    p_f = sub.add_parser("flash",       help="Pico im BOOTSEL-Modus flashen")
    p_ff = sub.add_parser("force-flash", help="Pico flashen ohne Versionsvergleich")
    for p in (p_f, p_ff):
        p.add_argument("--variante", choices=("default", "original"),
                       default="default",
                       help="default=Patch (Standard), original=unveraenderte FW")
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
        return cmd_flash(force=False, variante=args.variante)
    elif args.cmd == "force-flash":
        return cmd_flash(force=True, variante=args.variante)
    return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
