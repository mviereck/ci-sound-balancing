#!/usr/bin/env python3
"""Stick-Updater -- grafische Oberflaeche (Tkinter).

Ein Fenster mit fuenf Bereichen: CImbel / eira / Pico-ASHA / Audios / System.
Orchestriert update_core.py (unprivilegiert per Import, privilegiert per
pkexec), pico_core.py (Pico-Erkennung, Download, Flash-Orchestrierung) und den
eira-x86-Installer (git pull im lokalen Clone + Installer via pkexec).
Exit nur ueber den Exit-Button.
"""
import os
import sys
import json
import fcntl
import hashlib
import threading
import subprocess
import time
import urllib.request
import tkinter as tk
from tkinter import ttk
from pathlib import Path

import update_core
import pico_core

STICK_ROOT = update_core.DEF_STICK_ROOT
OPUS_ROOT = update_core.DEF_OPUS_ROOT
WEBSPACE = update_core.DEF_WEBSPACE
REPO_ROOT = "/mnt/daten/git/ci-sound-balancing"
LOKALE_VERSION = REPO_ROOT + "/js/version.js"
PROD_VERSION_URL = "https://www.ci-sound-balancing.org/js/version.js"
CORE_PY = str(Path(__file__).resolve().parent / "update_core.py")
NACH_SELBSTUPDATE_FLAG = "--nach-selbstupdate-manifest"

# "Auf Updates pruefen" (apt update) ist nur sinnvoll, wenn der letzte
# Listen-Abgleich eine Weile her ist -- sonst laedt es dieselben Listen neu.
SYSTEM_UPDATE_MAX_ALTER_S = 12 * 3600
# mtime dieses Verzeichnisses = Zeitpunkt des letzten erfolgreichen apt update
# (wird bei jedem Listen-Download neu geschrieben; robuster als der optionale
# update-success-stamp, den nur der APT::Periodic-Cron anlegt).
APT_LISTS_DIR = "/var/lib/apt/lists"

# --- eira (x86-Installer im lokalen git-Clone) ---
# Zwei Clones liegen nebeneinander, je eine git-Quelle. EIRA_CLONE legt fest,
# welcher der aktive ist; der Quellenwechsel (Fork <-> Original) erfolgt durch
# Aendern dieser Konstante -- die kommt per CImbel-Update auf den Stick, der
# Updater-Code aendert sich, der Selbst-Neustart greift, danach weicht der
# eira-Hash ab und ein eira-Update wird angeboten. Die Quelle wird mit dem
# Stick ausgeliefert und ist immer vorhanden; es gibt keinen Neuklon-/Reparatur-
# Weg (der Updater aktualisiert, er repariert nicht).
EIRA_CLONE = "/mnt/daten/git/eira-RaspberryPi-fork"
EIRA_INSTALLER = EIRA_CLONE + "/installer_x86.sh"


# ----------------------------------------------------------- Hilfen (Logik)

def _version_aus_text(txt):
    import re
    m = re.search(r'APP_VERSION\s*=\s*["\']([^"\']+)["\']', txt)
    return m.group(1) if m else None


def _lokale_version():
    try:
        return _version_aus_text(Path(LOKALE_VERSION).read_text(encoding="utf-8"))
    except OSError:
        return None


def _prod_version():
    try:
        with urllib.request.urlopen(PROD_VERSION_URL + "?t=" + str(os.getpid())) as r:
            return _version_aus_text(r.read().decode("utf-8"))
    except Exception:
        return None


def _online():
    """Grober Online-Test: erreicht der Ping-Server?"""
    try:
        urllib.request.urlopen("https://www.ci-sound-balancing.org/ping/ping.txt", timeout=5)
        return True
    except Exception:
        return False


def _apt_update_faellig():
    """True, wenn das letzte apt update laenger als SYSTEM_UPDATE_MAX_ALTER_S
    her ist (oder der Zeitpunkt nicht ermittelbar). mtime von APT_LISTS_DIR."""
    try:
        alter = time.time() - os.path.getmtime(APT_LISTS_DIR)
    except OSError:
        return True
    return alter > SYSTEM_UPDATE_MAX_ALTER_S


def _updater_code_hash():
    """Kombinierter Inhalts-Hash der beiden Updater-Code-Dateien
    (updater_gui.py + update_core.py). Aendert sich der Hash ueber einen
    git pull hinweg, hat sich der Updater-Code selbst erneuert und die
    laufende Instanz ist veraltet -> Neustart noetig. Nur DIESE zwei
    Dateien zaehlen; ein reiner Doku-/Audio-/js-Pull aendert den Hash nicht."""
    h = hashlib.sha256()
    for pfad in (os.path.abspath(__file__), CORE_PY):
        try:
            with open(pfad, "rb") as f:
                h.update(f.read())
        except OSError:
            # Fehlt eine Datei (sollte nicht vorkommen) -> markanter Wert,
            # damit ein echter Unterschied nicht faelschlich als "gleich" gilt.
            h.update(b"<fehlt:" + pfad.encode("utf-8", "replace") + b">")
    return h.hexdigest()


# Haelt den Dateideskriptor der Einzelinstanz-Sperre fuer die GANZE Programm-
# laufzeit offen (Modul-global, nicht lokal -- sonst schloesse der Garbage
# Collector das fd und gaebe die flock-Sperre sofort wieder frei).
_instanz_lock_fd = None


def _einzelinstanz_sichern():
    """Stellt sicher, dass nur EINE Updater-Instanz laeuft. Gibt True zurueck,
    wenn wir die einzige sind (Start erlaubt), sonst False (eine andere Instanz
    haelt die Sperre -> der Aufrufer soll kommentarlos enden).

    flock, NICHT Datei-Existenz: Gesperrt ist 'ein lebender Prozess haelt die
    Sperre', nicht 'die Datei liegt da'. Darum blockiert eine liegengebliebene
    Lock-Datei NIE einen spaeteren Start -- der Kernel gibt die Sperre bei
    Prozessende (auch Absturz/Kill) automatisch frei. Die Datei liegt in
    /run/user/<uid> (Session-tmpfs), das ohnehin beim Abmelden verschwindet.

    Vertraeglich mit dem os.execv-Selbst-Neustart (_cimbel_update_bg): execv
    erhaelt den Prozess und seine offenen fds (kein O_CLOEXEC), die neue Instanz
    laeuft also mit DERSELBEN gehaltenen Sperre weiter -- kein Fehlalarm gegen
    sich selbst. Liegt /run/user/<uid> nicht vor (kein systemd-Login), faellt
    der Ort auf /tmp zurueck; die Sperre wirkt dort ebenso."""
    global _instanz_lock_fd
    laufzeit = os.environ.get("XDG_RUNTIME_DIR") or ("/run/user/%d" % os.getuid())
    if not os.path.isdir(laufzeit):
        laufzeit = "/tmp"
    lockpfad = os.path.join(laufzeit, "cimbel-updater.lock")
    try:
        _instanz_lock_fd = os.open(lockpfad, os.O_RDWR | os.O_CREAT, 0o600)
        fcntl.flock(_instanz_lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        # Eine andere Instanz haelt die Sperre.
        return False
    except OSError:
        # Lock-Datei nicht anlegbar (sollte nicht vorkommen): im Zweifel starten
        # lassen, statt den Updater ganz zu blockieren.
        return True
    return True


# ----------------------------------------------------------- GUI

class UpdaterGUI:
    def __init__(self, root, nach_selbstupdate=False):
        self.root = root
        root.title("CImbel aktualisieren")
        root.geometry("760x720")
        # Fenster-X abfangen: Schliessen nur ueber den Exit-Button.
        root.protocol("WM_DELETE_WINDOW", self._ignoriere_close)

        self.online = False

        # --- Online-Status oben ---
        self.lbl_online = tk.Label(root, text="Pruefer Internetverbindung ...",
                                   font=("", 11, "bold"))
        self.lbl_online.pack(pady=8)

        # --- Bereich CImbel ---
        self._bereich_cimbel = tk.LabelFrame(root, text="CImbel", padx=8, pady=6)
        self._bereich_cimbel.pack(fill="x", padx=10, pady=4)
        self.lbl_cimbel = tk.Label(self._bereich_cimbel, text="...")
        self.lbl_cimbel.pack(side="left")
        self.btn_cimbel = tk.Button(self._bereich_cimbel, text="CImbel aktualisieren",
                                    command=self._cimbel_update, state="disabled")
        self.btn_cimbel.pack(side="right")

        # --- Bereich eira ---
        self._bereich_eira = tk.LabelFrame(root, text="eira", padx=8, pady=6)
        self._bereich_eira.pack(fill="x", padx=10, pady=4)
        self.lbl_eira = tk.Label(self._bereich_eira, text="...")
        self.lbl_eira.pack(side="left")
        self.btn_eira = tk.Button(self._bereich_eira, text="eira aktualisieren",
                                  command=self._eira_update, state="disabled")
        self.btn_eira.pack(side="right")

        # --- Bereich Pico-ASHA ---
        self._bereich_pico = tk.LabelFrame(root, text="Pico-ASHA", padx=8, pady=6)
        self._bereich_pico.pack(fill="x", padx=10, pady=4)
        self.lbl_pico = tk.Label(self._bereich_pico, text="...")
        self.lbl_pico.pack(side="left")
        # Force-Flash ist IMMER anwaehlbar (unabhaengig vom Versionsvergleich):
        self.btn_pico_force = tk.Button(self._bereich_pico, text="Pico neu flashen",
                                        command=self._pico_force_flash)
        self.btn_pico_force.pack(side="right")
        # Update-Button erscheint nur, wenn eine neue Version vorliegt:
        self.btn_pico = tk.Button(self._bereich_pico, text="Pico-ASHA aktualisieren",
                                  command=lambda: self._pico_flash_dialog(force=False),
                                  state="disabled")
        self.btn_pico.pack(side="right", padx=(0, 6))

        # --- Bereich Audios ---
        self._bereich_audio = tk.LabelFrame(root, text="Audios", padx=8, pady=6)
        self._bereich_audio.pack(fill="x", padx=10, pady=4)
        self.lbl_audio = tk.Label(self._bereich_audio, text="noch nicht geprüft")
        self.lbl_audio.pack(side="left")
        # Zweistufig: erst pruefen (laedt die grosse Soll-Liste + scannt den
        # lokalen Bestand -- auf USB langsam, darum nicht automatisch beim
        # Start), dann aktualisieren.
        self.btn_audio = tk.Button(self._bereich_audio, text="Auf neue Audios prüfen",
                                   command=self._audio_pruefen, state="disabled")
        self.btn_audio.pack(side="right")
        self.progress = ttk.Progressbar(root, length=520, mode="determinate")
        # wird nur beim Audio-Pruefen (indeterminate) und -Download (determinate) eingeblendet

        # --- Bereich System ---
        # Zwei getrennte Knoepfe: "Auf Updates pruefen" (apt update) und
        # "System aktualisieren" (apt upgrade). Jeder nur waehlbar, wenn er eine
        # sinnvolle Aktion ausloest: pruefen nur, wenn das letzte apt update
        # laenger als SYSTEM_UPDATE_MAX_ALTER_S zurueckliegt; aktualisieren nur,
        # wenn apt list --upgradable Pakete meldet.
        self._bereich_system = tk.LabelFrame(root, text="System", padx=8, pady=6)
        self._bereich_system.pack(fill="x", padx=10, pady=4)
        self.lbl_system = tk.Label(self._bereich_system, text="apt-Updates (optional)")
        self.lbl_system.pack(side="left")
        self.btn_system_upgrade = tk.Button(self._bereich_system, text="System aktualisieren",
                                            command=self._system_upgrade, state="disabled")
        self.btn_system_upgrade.pack(side="right")
        self.btn_system = tk.Button(self._bereich_system, text="Auf Updates pruefen",
                                    command=self._system_pruefen, state="disabled")
        self.btn_system.pack(side="right", padx=(0, 6))

        # --- Untere Leiste ZUERST (side="bottom"), damit sie immer sichtbar
        #     bleibt und nicht vom expandierenden Log unter den Rand gedraengt
        #     wird. Reihenfolge von unten nach oben: Beenden, Kopieren.
        #     Keine eigene Statuszeile mehr -- alle Meldungen gehen ins Log.
        tk.Button(root, text="Beenden", command=root.destroy).pack(side="bottom", pady=8)
        tk.Button(root, text="Meldungen ins Clipboard kopieren",
                  command=self._log_kopieren).pack(side="bottom", pady=2)

        # --- Log (selektierbar, scrollbar) fuellt den Rest ---
        self._log_frame = tk.LabelFrame(root, text="Meldungen", padx=4, pady=4)
        self._log_frame.pack(fill="both", expand=True, padx=10, pady=4)
        self.txt_log = tk.Text(self._log_frame, height=14, wrap="word")
        self.txt_log.pack(side="left", fill="both", expand=True)
        _sb = tk.Scrollbar(self._log_frame, command=self.txt_log.yview)
        _sb.pack(side="right", fill="y")
        self.txt_log.config(yscrollcommand=_sb.set)
        # Fehlerzeilen rot (tag), normale schwarz.
        self.txt_log.tag_config("fehler", foreground="#c00")

        self._aktion_laeuft = False
        self._im_hintergrund(self._initialer_status)

        # Nach einem Selbst-Update gestartet: die frische Instanz holt das
        # MANIFEST-Anwenden nach, das die alte Instanz bewusst NICHT mehr
        # gemacht hat. Im "beschaeftigt"-Zustand bis der Lauf fertig ist.
        if nach_selbstupdate:
            self._im_hintergrund(self._nach_selbstupdate_bg)

    # ------------------------------------------------- Nebenlaeufigkeit

    def _im_hintergrund(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def _ui(self, fn):
        """Im Tk-Thread ausfuehren."""
        self.root.after(0, fn)

    # ------------------------------------------------- Aktionssperre
    # Es laeuft immer nur EINE Aktion zur Zeit. Jede knopfausgeloeste Aktion
    # klammert ihren Ablauf in _aktion_beginnen()/_aktion_beenden(): die erste
    # sperrt ALLE Aktions-Knoepfe (grau), die zweite leitet jeden Knopf-Zustand
    # frisch aus dem aktuellen Status ab (Status-Recheck pro Bereich). So gibt es
    # fuer die Knopf-Freigabe genau EINE Quelle -- den echten Status --, keinen
    # gemerkten Vorzustand: ein Knopf, der nach seiner Aktion nichts mehr zu tun
    # hat, sperrt sich dadurch von selbst.

    def _aktions_knoepfe(self):
        """Alle Bereichs-Knoepfe -- die eine Liste, die der Sperr-Schritt
        durchlaeuft (kein zweiter Ort mit festen Knopf-IDs)."""
        return [self.btn_cimbel, self.btn_eira, self.btn_audio, self.btn_system,
                self.btn_system_upgrade, self.btn_pico, self.btn_pico_force]

    def _aktion_beginnen(self):
        """Sperrt alle Aktions-Knoepfe. MUSS im Tk-Thread laufen (von dort
        werden die Aktionen gestartet)."""
        self._aktion_laeuft = True
        for b in self._aktions_knoepfe():
            b.config(state="disabled")

    def _aktion_beenden(self):
        """Hebt die Sperre auf und bewertet alle Bereiche neu (Status-Recheck).
        Aus dem Hintergrund-Thread ueber self._ui(...) aufrufen."""
        self._aktion_laeuft = False
        self._status_recheck()

    def _status_recheck(self):
        """Leitet die Knopf-Freigabe der Bereiche mit BILLIGER Statuspruefung
        frisch ab -- nach jeder Aktion und einmal beim Start: CImbel (ein curl),
        eira (git fetch), System (apt list + mtime). Audios bleiben AUSSEN VOR:
        ihr Status braucht den teuren ~180k-Scan (zweistufig), darum fuehrt der
        Audio-Bereich seinen Knopf selbst (pruefen -> aktualisieren -> zurueck),
        nicht dieser Recheck. Darf vom Hintergrund-Thread aufgerufen werden (die
        Teil-Checks arbeiten selbst mit self._ui/_im_hintergrund)."""
        if not self.online:
            return
        self._cimbel_status()
        self._eira_status()
        self._im_hintergrund(self._system_knoepfe_setzen)

    def _log(self, text, fehler=False):
        """Eine Zeile ins Meldungsfeld. fehler=True -> rot. Jede Aktion meldet
        ihren Fehler an Ort und Stelle (sprechend); es gibt keine nachlaufende
        Sammelmeldung mehr."""
        def _append():
            if fehler:
                self.txt_log.insert("end", text + "\n", "fehler")
            else:
                self.txt_log.insert("end", text + "\n")
            self.txt_log.see("end")
        self._ui(_append)

    def _log_fortschritt(self, text):
        """Eine Fortschritts-Zeile, die sich an Ort und Stelle aktualisiert
        (statt bei jedem Schritt eine neue Zeile anzuhaengen). Ersetzt die
        letzte Log-Zeile, wenn sie zuvor ebenfalls per _log_fortschritt
        geschrieben wurde; sonst haengt sie eine neue an. Fuer den
        Audio-Download-Zaehler (viele tausend Schritte)."""
        def _ersetze():
            if getattr(self, "_fortschritt_aktiv", False):
                # letzte Zeile (vor dem abschliessenden \n) ueberschreiben
                self.txt_log.delete("end-2l", "end-1l")
            self.txt_log.insert("end", text + "\n")
            self.txt_log.see("end")
            self._fortschritt_aktiv = True
        self._ui(_ersetze)

    def _fortschritt_ende(self):
        """Fortschritts-Zeile abschliessen: die naechste normale Log-Zeile
        soll wieder angehaengt, nicht ueberschrieben werden."""
        self._fortschritt_aktiv = False

    def _log_kopieren(self):
        inhalt = self.txt_log.get("1.0", "end").strip()
        self.root.clipboard_clear()
        self.root.clipboard_append(inhalt)
        # Tk leert das Clipboard beim Beenden -- update() erzwingt die Uebergabe
        # an den X-Server, damit der Inhalt auch nach Programmende verfuegbar ist.
        self.root.update()
        self._log("Meldungen ins Clipboard kopiert.")

    def _ignoriere_close(self):
        self._log("Zum Beenden bitte den Knopf 'Beenden' benutzen "
                  "(das Schließkreuz ist absichtlich wirkungslos, damit keine "
                  "laufende Aktion unterbrochen wird).")

    # ------------------------------------------------- Initialer Status

    def _initialer_status(self):
        self._pico_status()          # laeuft unabhaengig vom Netz
        self.online = _online()
        if not self.online:
            self._ui(lambda: self.lbl_online.config(
                text="Keine Internetverbindung -- bitte WLAN einrichten.", fg="#a00"))
            self._ui(lambda: self.lbl_cimbel.config(text="offline"))
            self._ui(lambda: self.lbl_eira.config(
                text="Abgleich nur mit Internet möglich"))
            self._ui(lambda: self.lbl_audio.config(text="offline"))
            return
        self._ui(lambda: self.lbl_online.config(text="Internetverbindung vorhanden.", fg="#070"))
        # Bereiche mit billiger Statuspruefung ableiten (CImbel/eira/System) --
        # dieselbe Logik wie nach jeder Aktion (Status-Recheck), kein zweiter Weg.
        self._status_recheck()
        # Audios: Grundzustand 'pruefen' einmal freigeben (der Bereich fuehrt
        # seinen Knopf selbst, s. _status_recheck).
        self._ui(self._audio_grundzustand)

    def _cimbel_status(self):
        """CImbel-Freigabe aus dem Status: lokale vs. Produktions-Version
        (Ungleich-Vergleich). Knopf nur bei Abweichung."""
        def _bg():
            lok, prod = _lokale_version(), _prod_version()
            if prod and lok and prod != lok:
                self._ui(lambda: self.lbl_cimbel.config(
                    text="Neue Version verfuegbar (" + str(prod) + ")"))
                self._ui(lambda: self.btn_cimbel.config(state="normal"))
            else:
                self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))
                self._ui(lambda: self.btn_cimbel.config(state="disabled"))
        self._im_hintergrund(_bg)

    def _audio_grundzustand(self):
        """Audio-Knopf in den Grundzustand 'pruefen' (zweistufig: der teure
        ~180k-Scan laeuft NIE automatisch). Im Tk-Thread aufrufen."""
        self.btn_audio.config(text="Auf neue Audios prüfen",
                              command=self._audio_pruefen, state="normal")

    # ------------------------------------------------- CImbel

    def _cimbel_update(self):
        self._aktion_beginnen()  # sperrt alle Knoepfe
        self._im_hintergrund(self._cimbel_update_bg)

    def _cimbel_update_bg(self):
        self._log("git pull --ff-only ...")
        hash_vorher = _updater_code_hash()
        # --ff-only wie bei eira: reiner Konsum-Clone, nie ein Merge-Commit.
        # Ausgabe (stdout+stderr) einfangen, damit ein git-Fehler sichtbar wird.
        p = subprocess.run(["git", "-C", REPO_ROOT, "pull", "--ff-only"],
                           capture_output=True, text=True)
        if p.returncode != 0:
            self._log("git pull fehlgeschlagen (rc=" + str(p.returncode) + ")",
                      fehler=True)
            ausgabe = ((p.stdout or "") + (p.stderr or "")).strip()
            if ausgabe:
                self._log(ausgabe, fehler=True)
            self._aktion_beenden()
            return
        self._log("git pull OK")
        hash_nachher = _updater_code_hash()

        if hash_nachher != hash_vorher:
            # Der Updater hat sich selbst erneuert -> frische Instanz starten,
            # DIESE wendet dann das MANIFEST an (nicht der alte Code hier).
            self._log("Der Updater wurde aktualisiert und startet neu ...")
            self._ui(lambda: self.lbl_cimbel.config(text="Updater startet neu ..."))
            time.sleep(2.0)  # Meldung kurz sichtbar lassen (Oma-Test)
            try:
                os.execv(sys.executable,
                         [sys.executable, os.path.abspath(__file__),
                          NACH_SELBSTUPDATE_FLAG])
            except OSError as e:
                # Pull ok, aber Neustart gescheitert: Fenster bleibt bedienbar,
                # KEIN MANIFEST aus der alten Instanz (Alt-Code-Risiko).
                self._log("Automatischer Neustart fehlgeschlagen (" + str(e) +
                          "). Bitte den Updater von Hand schließen und neu "
                          "starten.", fehler=True)
                self._aktion_beenden()
                return
            # execv kehrt bei Erfolg nie zurueck; ab hier kein Code.

        # Updater-Code unveraendert -> MANIFEST in dieser Instanz anwenden.
        self._manifest_anwenden_lokal()
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))
        self._aktion_beenden()

    def _manifest_anwenden_lokal(self):
        """Wendet das MANIFEST an (Bereich home direkt, system-root gebuendelt
        via pkexec). Gemeinsamer Koerper fuer den normalen CImbel-Update und
        den Flag-Pfad nach dem Selbst-Neustart -- KEIN git pull hier."""
        self._log("Wende Werks-Dateien an (Dateiliste MANIFEST, home) ...")
        manifest = update_core._lade_manifest(STICK_ROOT)
        for e in manifest:
            if e.get("bereich", "home") != "home":
                continue
            msg = update_core._manifest_eintrag_anwenden(
                e, STICK_ROOT, OPUS_ROOT, WEBSPACE)
            self._log(msg, fehler=msg.startswith("FEHLER"))
        # system-root-Eintraege gebuendelt via pkexec -- aus der schon geladenen
        # Liste abgeleitet (kein zweites Oeffnen des MANIFEST).
        if any(e.get("bereich") == "system-root" for e in manifest):
            self._log("Wende Systemdateien an (Passwort nötig) ...")
            rc = subprocess.run(["pkexec", sys.executable, CORE_PY,
                            "--stick-root", STICK_ROOT, "--opus-root", OPUS_ROOT,
                            "--webspace", WEBSPACE, "manifest", "--bereich", "system-root"]).returncode
            if rc != 0:
                self._log("Systemdateien fehlgeschlagen (rc=" + str(rc) + ")", fehler=True)
        self._log("CImbel aktualisiert.")

    def _nach_selbstupdate_bg(self):
        # In den beschaeftigt-Zustand (im Tk-Thread setzen), MANIFEST anwenden,
        # danach freigeben. Kein Pull, keine Hash-Pruefung.
        self._ui(self._aktion_beginnen)
        self._log("Updater neu gestartet. Wende Aktualisierung an ...")
        self._manifest_anwenden_lokal()
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))
        self._aktion_beenden()

    # ------------------------------------------------- eira (x86-Installer)
    # eira liegt als git-Clone unter EIRA_CLONE. Status = Commit-Vergleich
    # (lokaler HEAD vs. origin nach fetch). Update = git pull --ff-only + der
    # x86-Installer mit -y ueber pkexec (der Stick ist das CImbel-Messgeraet,
    # also immer CImbels Default-Zustand; wer abweichen will, startet den
    # Installer selbst). Eigener Mechanismus, NICHT das MANIFEST.

    def _git(self, *args):
        """git im eira-Clone. Immer (returncode, ausgabe) -- ausgabe ist stdout
        UND stderr zusammen, damit eine git-Fehlermeldung (die git nach stderr
        schreibt) nicht verlorengeht. Gestrippt."""
        p = subprocess.run(["git", "-C", EIRA_CLONE, *args],
                           capture_output=True, text=True)
        return p.returncode, ((p.stdout or "") + (p.stderr or "")).strip()

    def _eira_status(self):
        self._im_hintergrund(self._eira_status_bg)

    def _eira_status_bg(self):
        # Die Quelle wird mit dem Stick ausgeliefert und ist immer da; es gibt
        # keinen Reparatur-/Neuklon-Weg (der Updater aktualisiert, er repariert
        # nicht). Laesst sich kein belastbarer Vergleich bilden (kein Clone, kein
        # Netz, kein Upstream), bleibt der Knopf grau -- F1: ein Knopf ist nur
        # waehlbar, wenn er eine sinnvolle Aktion ausloest.
        self._ui(lambda: self.btn_eira.config(state="disabled"))
        rc, _ = self._git("fetch", "--quiet")
        if rc != 0:
            self._ui(lambda: self.lbl_eira.config(text="auf dem neuesten Stand"))
            return
        rc1, lokal = self._git("rev-parse", "HEAD")
        rc2, remote = self._git("rev-parse", "@{u}")
        if rc1 != 0 or rc2 != 0 or not lokal or not remote:
            self._ui(lambda: self.lbl_eira.config(text="auf dem neuesten Stand"))
            return
        if lokal != remote:
            self._ui(lambda: self.lbl_eira.config(
                text="Neue Version verfügbar (" + remote[:7] + ")"))
            self._ui(lambda: self.btn_eira.config(state="normal"))
        else:
            self._ui(lambda: self.lbl_eira.config(text="auf dem neuesten Stand"))

    def _eira_update(self):
        self._aktion_beginnen()
        self._im_hintergrund(self._eira_update_bg)

    def _eira_update_bg(self):
        # HEAD vor dem pull merken: Laeuft der Installer danach nicht sauber
        # durch (Passwort-Abbruch ODER Fehler), setzen wir den Clone auf den
        # alten Commit zurueck. Sonst waere git "aktuell" (neuer Commit gezogen),
        # das laufende System aber noch alt -> der Status wuerde den Knopf
        # faelschlich sperren. So bleibt git-Stand == installierter Stand.
        rc, alter_head = self._git("rev-parse", "HEAD")
        if rc != 0 or not alter_head:
            self._log("eira: HEAD nicht lesbar (" + alter_head + ").", fehler=True)
            self._aktion_beenden()
            return
        self._log("eira: git pull --ff-only ...")
        # --ff-only: nie ein Merge/Konflikt (der Clone bleibt bei EINER Quelle
        # homogen -> normal immer Fast-Forward). Scheitert es doch (divergiert),
        # bricht git sauber ab statt zu haengen.
        rc, aus = self._git("pull", "--ff-only")
        if aus:
            self._log(aus)
        if rc != 0:
            self._log("eira: git pull --ff-only fehlgeschlagen (rc=" + str(rc) + ").",
                      fehler=True)
            self._aktion_beenden()
            return

        # Installer mit -y ueber pkexec (installiert aus dem Clone, in dem er
        # liegt). Ausgabe einfangen, damit eine echte Fehlermeldung sichtbar ist.
        self._log("eira: Installer laeuft (Passwort nötig) ...")
        p = subprocess.run(["pkexec", EIRA_INSTALLER, "-y"],
                           capture_output=True, text=True)
        if p.returncode == 0:
            self._log("eira aktualisiert.")
            self._aktion_beenden()
            return

        # pkexec meldet 126/127, wenn die Autorisierung abgebrochen/verweigert
        # wurde (Passwort-Dialog weggeklickt) -- das ist KEIN Fehler, sondern
        # eine legitime Nutzeraktion. Alles andere ist ein echter Installer-
        # Fehler (dann die eingefangene Ausgabe zeigen). In beiden Faellen den
        # Clone auf den alten Commit zuruecksetzen, damit das Update erneut
        # angeboten wird.
        if p.returncode in (126, 127):
            self._log("Passwort nicht eingegeben, Update abgebrochen.")
        else:
            self._log("eira-Installation fehlgeschlagen (rc=" + str(p.returncode) + ").",
                      fehler=True)
            ausgabe = ((p.stdout or "") + (p.stderr or "")).strip()
            if ausgabe:
                self._log(ausgabe, fehler=True)
        self._git("reset", "--hard", alter_head)
        self._aktion_beenden()

    # ------------------------------------------------- Audios (zweistufig)

    def _audio_pruefen(self):
        self._aktion_beginnen()  # sperrt alle Knoepfe
        # Stufe 1: pruefen (Soll laden + lokalen Bestand lesen/scannen). Langsam ->
        # im Hintergrund, Spinner zeigen.
        self._log("Prüfe Audios: lade die Soll-Liste vom Server und vergleiche "
                  "mit dem lokalen Bestand. Das kann einen Moment dauern ...")
        self.progress.config(mode="indeterminate")
        self.progress.pack(pady=4)
        self.progress.start(12)
        self._im_hintergrund(self._audio_pruefen_bg)

    def _audio_pruefen_bg(self):
        try:
            laden, verwaist = update_core._audio_diff(OPUS_ROOT, WEBSPACE)
            n = len(laden)
        except Exception as e:
            self._ui(lambda: self.lbl_audio.config(text="Status nicht ermittelbar"))
            self._log("Audio-Prüfung fehlgeschlagen: " + str(e), fehler=True)
            self._ui(self._audio_grundzustand)  # zurueck auf 'pruefen'
            self._aktion_beenden()
            return
        finally:
            self._ui(self.progress.stop)
            self._ui(self.progress.pack_forget)
        self._log("Audio-Prüfung: " + str(n) + " zu laden, " +
                  str(len(verwaist)) + " verwaist.")
        if n > 0:
            self._ui(lambda: self.lbl_audio.config(
                text=str(n) + " neue/geänderte Audios (Download kann lange dauern)"))
            # Stufe 2: Button wird zum Aktualisieren-Knopf. Den fuehrt der
            # Audio-Bereich selbst -- der Status-Recheck in _aktion_beenden
            # fasst Audios bewusst nicht an.
            self._ui(lambda: self.btn_audio.config(
                text="Audios aktualisieren", command=self._audio_update, state="normal"))
        else:
            self._ui(lambda: self.lbl_audio.config(text="aktuell"))
            self._log("Audios sind aktuell.")
            self._ui(self._audio_grundzustand)  # nichts zu laden -> 'pruefen' bleibt
        self._aktion_beenden()
        return

    def _audio_update(self):
        self._aktion_beginnen()  # sperrt alle Knoepfe
        self.progress.config(mode="determinate")
        self.progress.pack(pady=4)
        self._im_hintergrund(self._audio_update_bg)

    def _audio_update_bg(self):
        def fortschritt(i, n, pfad):
            self._ui(lambda: self.progress.config(maximum=n, value=i))
            self._log_fortschritt("Lade " + str(i) + " / " + str(n) + " ...")
        try:
            geladen, geloescht = update_core.audio_sync(OPUS_ROOT, WEBSPACE, fortschritt)
        except update_core.SyncAbbruch as e:
            self._fortschritt_ende()
            self._log("Abbruch (Sicherung): " + str(e), fehler=True)
            self._ui(self._audio_grundzustand)  # erneut pruefbar
            self._aktion_beenden()
            return
        except ValueError as e:
            self._fortschritt_ende()
            self._log("Fehler: " + str(e), fehler=True)
            self._ui(self._audio_grundzustand)  # erneut pruefbar
            self._aktion_beenden()
            return
        finally:
            self._ui(self.progress.pack_forget)
        self._fortschritt_ende()
        self._log("Audios aktualisiert: " + str(geladen) + " geladen, " +
                  str(geloescht) + " entfernt.")
        self._ui(lambda: self.lbl_audio.config(text="aktuell"))
        # Download holt genau die fehlenden/geaenderten Dateien -> danach ist
        # nichts mehr zu laden. Knopf zurueck in den Grundzustand 'pruefen'
        # (kein automatischer ~180k-Scan).
        self._ui(self._audio_grundzustand)
        self._aktion_beenden()

    # ------------------------------------------------- System (zwei Knoepfe)
    # "Auf Updates pruefen" (apt update) und "System aktualisieren" (apt
    # upgrade) sind getrennte Knoepfe. Beide leiten ihre Freigabe aus dem Status
    # ab (_system_knoepfe_setzen) -- die EINE Stelle, die beide Knopf-Zustaende
    # setzt. Jede Aktion ruft sie am Ende erneut auf (Status-Recheck pro
    # Bereich, keine gemerkten Vorzustaende).

    def _anzahl_upgradable(self):
        """Zahl aktualisierbarer Pakete -- unprivilegiert (kein root noetig).
        'apt list --upgradable' listet je ein Paket als 'name/suite ...';
        die Kopfzeile ('Listing...'/'Auflistung...') enthaelt kein '/'.
        None bei Fehler."""
        try:
            out = subprocess.run(["apt", "list", "--upgradable"],
                                  capture_output=True, text=True).stdout
        except OSError:
            return None
        return sum(1 for z in out.splitlines() if "/" in z)

    def _system_knoepfe_setzen(self):
        """Leitet beide System-Knoepfe + Label aus dem Status ab (beides billig
        und unprivilegiert). 'pruefen' waehlbar, wenn apt update faellig ist;
        'aktualisieren' waehlbar, wenn Pakete aktualisierbar sind. Setzt das
        Label passend. Aus dem Hintergrund-Thread ueber self._ui aufrufen."""
        faellig = _apt_update_faellig()
        n = self._anzahl_upgradable()
        def _setzen():
            self.btn_system.config(state="normal" if faellig else "disabled")
            self.btn_system_upgrade.config(
                state="normal" if (n or 0) > 0 else "disabled")
            if n:
                self.lbl_system.config(text=str(n) + " Paket-Updates verfügbar")
            elif n == 0:
                self.lbl_system.config(text="System ist aktuell")
            else:
                self.lbl_system.config(text="apt-Updates (optional)")
        self._ui(_setzen)

    def _system_pruefen(self):
        self._aktion_beginnen()
        self._log("apt update gestartet (laeuft im Terminal, Passwort nötig) ...")
        self._im_hintergrund(self._system_pruefen_bg)

    def _system_pruefen_bg(self):
        # apt update braucht root -> pkexec, sichtbar im Terminal. Schliesst bei
        # Erfolg automatisch, wartet nur bei Fehler auf Enter (|| read), damit
        # der Nutzer eine Fehlermeldung (z.B. Repo unerreichbar) noch sieht.
        rc = subprocess.run(["x-terminal-emulator", "-e", "bash", "-c",
                        "pkexec apt update || { echo; echo 'apt update fehlgeschlagen.'; "
                        "read -p 'Fenster schliessen mit Enter ...' _; exit 1; }"]).returncode
        if rc != 0:
            self._log("apt update fehlgeschlagen -- bitte Terminal-Ausgabe beachten.",
                      fehler=True)
        else:
            self._log("apt update fertig.")
        # Knopf-Freigabe macht der Status-Recheck in _aktion_beenden (ruft
        # _system_knoepfe_setzen) -- kein zweiter Aufruf noetig.
        self._aktion_beenden()

    def _system_upgrade(self):
        self._aktion_beginnen()
        self._log("apt upgrade gestartet (laeuft im Terminal) ...")
        self._im_hintergrund(self._system_upgrade_bg)

    def _system_upgrade_bg(self):
        # Sichtbar im Terminal; blockierend im Hintergrund-Thread (run, nicht
        # Popen), damit nach Terminal-Ende der Status aktualisiert wird -- sonst
        # bliebe "laeuft im Terminal" stehen, auch wenn das Terminal zu ist.
        # Schliesst bei Erfolg automatisch, wartet nur bei Fehler auf Enter.
        rc = subprocess.run(["x-terminal-emulator", "-e", "bash", "-c",
                        "pkexec apt -y upgrade || { echo; echo 'apt upgrade fehlgeschlagen.'; "
                        "read -p 'Fenster schliessen mit Enter ...' _; exit 1; }"]).returncode
        if rc != 0:
            self._log("apt upgrade fehlgeschlagen -- bitte Terminal-Ausgabe beachten.",
                      fehler=True)
        else:
            self._log("Systemupdate abgeschlossen.")
        # Knopf-Freigabe macht der Status-Recheck in _aktion_beenden; nach dem
        # Upgrade sollte n==0 sein -> "aktualisieren" wird grau.
        self._aktion_beenden()

    # ------------------------------------------------- Pico-ASHA

    def _pico_status(self):
        self._im_hintergrund(self._pico_status_bg)

    def _pico_status_bg(self):
        betrieb = pico_core.pico_betrieb_da()
        bootsel = pico_core.pico_flashmodus() is not None
        # Force-Flash braucht einen Pico in IRGENDEINER Form (Betrieb oder
        # BOOTSEL); sonst deaktivieren. Der normale Aktualisieren-Knopf wird
        # erst in den passenden Zweigen unten freigegeben.
        force_an = betrieb or bootsel
        self._ui(lambda: self.btn_pico_force.config(
            state="normal" if force_an else "disabled"))
        self._ui(lambda: self.btn_pico.config(state="disabled"))

        if not betrieb:
            self._ui(lambda: self.lbl_pico.config(text="Kein Pico gefunden"))
            return
        # Richtigen ttyACM*-Port ermitteln (nach Re-Enumeration nicht
        # zwingend /dev/ttyACM0). Faellt _pico_port auf None, greifen die
        # Funktionen auf ihren Default-Port zurueck.
        port = pico_core._pico_port() or "/dev/ttyACM0"
        # Port durch die laufende PicoASHAGui gesperrt? Dann die Version nicht
        # lesbar -- in die Meldungen-Box schreiben, nicht in die Statuszeile.
        if pico_core.pico_port_gesperrt(port):
            self._ui(lambda: self._log(
                "PicoASHAGui läuft und belegt den Pico-Anschluss. Bitte "
                "PicoASHAGui beenden, dann erneut prüfen.", fehler=True))
            self._ui(lambda: self.lbl_pico.config(
                text="Pico gefunden (Anschluss belegt)"))
            return
        fw = pico_core.lies_firmware_version(port)
        if fw is None:
            self._ui(lambda: self.lbl_pico.config(
                text="Pico gefunden, Firmware unbekannt"))
            return
        # Satz-Dateien im saetze[]-Format; fuer Vergleich/Anzeige der default-
        # Satz (Patch, mess-optimierter Standard). waehle_satz() gibt None, wenn
        # kein Satz da ist -- dann wie bisher "kein Vergleich".
        stick_datei = pico_core.stick_satz()
        web_datei = pico_core.webspace_satz()   # None, wenn offline
        web = pico_core.waehle_satz(web_datei, "default")
        stick = pico_core.waehle_satz(stick_datei, "default")
        if web is None:
            self._ui(lambda: self.lbl_pico.config(
                text="Pico gefunden (Version " + fw +
                     "); Abgleich nur mit Internet möglich"))
            return
        web_ver = web["satz_version"]
        # Zwei Vergleiche (Architektur §4):
        update_da = (stick is None) or (web_ver != stick.get("satz_version"))
        # fw ist seit dem CImbel-Patch die volle Kennung 'x.y.z+cimbel.N' (pa_cli),
        # direkt mit satz_version vergleichbar. Der Pico ist "veraltet", wenn er
        # nicht dem default-Satz (Patch) entspricht -- deckt sowohl Upstream- als
        # auch Patch-Unterschiede ab. Ist noch kein Satz auf dem Stick, als
        # Referenz der Webspace-default-Satz.
        ziel_satz = (stick or web).get("satz_version")
        pico_veraltet = (ziel_satz is not None and fw != ziel_satz)
        if update_da or pico_veraltet:
            self._ui(lambda: self.lbl_pico.config(
                text="Neue Version von Pico-ASHA verfügbar (" + web_ver + ")"))
            self._ui(lambda: self.btn_pico.config(state="normal"))
        else:
            self._ui(lambda: self.lbl_pico.config(text="Pico-ASHA ist aktuell"))

    def _pico_force_flash(self):
        """Force-Flash ('Pico neu flashen'): erst die Satz-Variante abfragen
        (optimiert/Original), dann den Flash-Dialog mit der Wahl starten. Bricht
        der Nutzer die Abfrage ab, passiert nichts."""
        variante = self._frage_variante()
        if variante is None:
            return
        self._pico_flash_dialog(force=True, variante=variante)

    def _frage_variante(self):
        """Modale Abfrage, welche Pico-ASHA-Variante geflasht werden soll.
        Gibt "default" (fuer CImbel optimiert, empfohlen), "original" oder None
        (abgebrochen) zurueck."""
        dlg = tk.Toplevel(self.root)
        dlg.title("Pico-ASHA Version waehlen")
        dlg.geometry("560x210")
        dlg.transient(self.root)
        wahl = {"v": None}

        tk.Label(dlg, text="Es gibt zwei Versionen von Pico-ASHA.\n"
                           "Welche soll installiert werden?",
                 justify="left", wraplength=520,
                 font=("", 11)).pack(padx=16, pady=(16, 12), anchor="w")

        def _waehle(v):
            wahl["v"] = v
            dlg.destroy()

        knoepfe = tk.Frame(dlg)
        knoepfe.pack(padx=16, pady=8, fill="x")
        btn_default = tk.Button(knoepfe,
                  text="Für CImbel-Messungen optimiert (empfohlen)",
                  command=lambda: _waehle("default"))
        btn_default.pack(fill="x", pady=4)
        tk.Button(knoepfe,
                  text="Original (angenehmerer Klang bei hohen Tönen)",
                  command=lambda: _waehle("original")).pack(fill="x", pady=4)
        tk.Button(dlg, text="Abbrechen",
                  command=dlg.destroy).pack(pady=(4, 8))

        dlg.protocol("WM_DELETE_WINDOW", dlg.destroy)
        # Enter bestaetigt den empfohlenen Default, Esc bricht ab. Der Default-
        # Knopf bekommt den Fokus (sichtbar hervorgehoben).
        dlg.bind("<Return>", lambda e: _waehle("default"))
        dlg.bind("<Escape>", lambda e: dlg.destroy())
        btn_default.focus_set()
        dlg.grab_set()
        self.root.wait_window(dlg)
        return wahl["v"]

    def _pico_flash_dialog(self, force, variante="default"):
        self._aktion_beginnen()
        PicoFlashDialog(self.root, force, self._pico_status,
                        nach_schliessen_cb=self._aktion_beenden,
                        variante=variante)


# ----------------------------------------------------------- Pico-Flash-Dialog

class PicoFlashDialog:
    """Gefuehrter Flash-Ablauf fuer den Pico-ASHA.

    Eigenes Toplevel-Fenster mit eigenem Log (Machart reset_gui.py).
    nach_flash_cb wird nach erfolgreichem Flash im Tk-Thread aufgerufen.
    nach_schliessen_cb wird beim Schliessen des Dialogs genau einmal gerufen.
    """

    def __init__(self, parent, force, nach_flash_cb, nach_schliessen_cb=None,
                 variante="default"):
        self._force = force
        # Welche Satz-Variante geflasht wird: "default" (Patch, mess-optimiert)
        # oder "original" (unveraenderte FW). Steuert Flash, Erwartungs-Vergleich
        # und GUI-Uebernahme, damit alles zur selben Variante gehoert.
        self._variante = variante
        self._nach_flash_cb = nach_flash_cb
        self._nach_schliessen_cb = nach_schliessen_cb
        self._abbrechen = False
        self._schliessen_gemeldet = False

        self._win = tk.Toplevel(parent)
        self._win.title("Pico-ASHA flashen")
        self._win.geometry("520x380")
        self._win.protocol("WM_DELETE_WINDOW", self._anfrage_abbrechen)

        tk.Label(self._win,
                 text="Pico-ASHA Firmware-Update",
                 font=("", 12, "bold")).pack(pady=(12, 4))

        self._lbl_anleitung = tk.Label(
            self._win, text="", justify="left", wraplength=490, anchor="w")
        self._lbl_anleitung.pack(fill="x", padx=12, pady=4)

        knopfleiste = tk.Frame(self._win)
        knopfleiste.pack(side="bottom", pady=8)
        self._btn_kopieren = tk.Button(
            knopfleiste, text="Meldungen kopieren", command=self._meldungen_kopieren)
        self._btn_kopieren.pack(side="left", padx=6)
        self._btn_abbrechen = tk.Button(
            knopfleiste, text="Abbrechen", command=self._anfrage_abbrechen)
        self._btn_abbrechen.pack(side="left", padx=6)

        frame = tk.LabelFrame(self._win, text="Meldungen", padx=4, pady=4)
        frame.pack(fill="both", expand=True, padx=10, pady=4)
        self._txt = tk.Text(frame, height=8, wrap="word")
        self._txt.pack(side="left", fill="both", expand=True)
        sb = tk.Scrollbar(frame, command=self._txt.yview)
        sb.pack(side="right", fill="y")
        self._txt.config(yscrollcommand=sb.set)
        self._txt.tag_config("fehler", foreground="#c00")
        self._txt.tag_config("ok", foreground="#070")

        threading.Thread(target=self._ablauf, daemon=True).start()

    def _ui(self, fn):
        self._win.after(0, fn)

    def _log(self, text, fehler=False, ok=False):
        def _append():
            tag = "fehler" if fehler else ("ok" if ok else "")
            self._txt.insert("end", text + "\n", tag)
            self._txt.see("end")
        self._ui(_append)

    def _anleitung(self, text):
        self._ui(lambda: self._lbl_anleitung.config(text=text))

    def _meldungen_kopieren(self):
        """Legt den gesamten Inhalt der Meldungen-Box ins System-Clipboard
        (fuer Fehlerberichte). Kurze Bestaetigung am Knopf."""
        inhalt = self._txt.get("1.0", "end-1c")
        self._win.clipboard_clear()
        self._win.clipboard_append(inhalt)
        self._btn_kopieren.config(text="Kopiert ✓")
        self._win.after(1500, lambda: self._btn_kopieren.config(
            text="Meldungen kopieren"))

    def _anfrage_abbrechen(self):
        self._abbrechen = True
        if self._nach_schliessen_cb and not self._schliessen_gemeldet:
            self._schliessen_gemeldet = True
            self._nach_schliessen_cb()
        self._win.destroy()

    def _ablauf(self):
        # Schritt 1: Satz sicherstellen
        if self._force:
            # Force: lokal vorhandene .uf2 nutzen; kein erzwungener Download
            stick = pico_core.stick_satz()
            if not stick:
                self._log("Fehler: Kein lokaler Satz vorhanden. "
                          "Bitte zuerst einen Online-Update durchfuehren "
                          "(Pico-ASHA aktualisieren).", fehler=True)
                self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
                return
        else:
            web_datei = pico_core.webspace_satz()
            if not web_datei:
                self._log("Fehler: Webspace nicht erreichbar. "
                          "Bitte Internetverbindung pruefen.", fehler=True)
                self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
                return
            # Vergleich der Satz-Staende ueber den default-Satz (Patch); der
            # Download holt ohnehin beide Varianten.
            web = pico_core.waehle_satz(web_datei, "default")
            stick = pico_core.waehle_satz(pico_core.stick_satz(), "default")
            web_ver = web["satz_version"] if web else "?"
            if stick is None or (web and web_ver != stick.get("satz_version")):
                self._log("Lade neuen Satz " + web_ver + " ...")
                try:
                    pico_core.satz_herunterladen(web_datei)
                except Exception as e:
                    self._log("Download fehlgeschlagen: " + str(e), fehler=True)
                    self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
                    return
                self._log("Download abgeschlossen.")

        # Schritt 2: BOOTSEL-Aufforderung
        self._anleitung(
            "Ziehen Sie den Pico ab und stecken Sie ihn mit "
            "gedrücktem BOOTSEL-Knopf wieder ein.")
        self._log("Warte auf BOOTSEL-Laufwerk ...")

        # Schritt 3: Auf Flash-Laufwerk warten (Polling, kein Timeout)
        mp = board = None
        while not self._abbrechen:
            mp, board = pico_core.flash_laufwerk()
            if mp and board:
                break
            time.sleep(0.5)
        if self._abbrechen:
            return

        # Schritt 4: Modell anzeigen + flashen
        board_name = "Pico 2 W" if board == "pico2_w" else "Pico W"
        self._log(board_name + " erkannt, Laufwerk: " + mp)
        self._anleitung("Firmware wird geschrieben ...")
        try:
            pico_core.flashe(board, mp, self._variante)
        except Exception as e:
            self._log("Fehler beim Flashen: " + str(e), fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        # Schritt 5a: Warten, bis Laufwerk verschwindet (Pico rebootet)
        self._log("Firmware geschrieben, Pico startet neu ...")
        for _ in range(60):  # max. 30 s
            if self._abbrechen:
                return
            if pico_core.pico_flashmodus() is None:
                break
            time.sleep(0.5)
        else:
            self._log(
                "Laufwerk ist nicht verschwunden. Moeglicherweise falsches "
                "Modell (Family-ID-Abweisung) -- bitte Pico-Modell pruefen.",
                fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        # Schritt 5b: Warten, bis Pico wieder im Betrieb meldet + Version lesen
        self._anleitung("Pico bootet neu, bitte warten ...")
        for _ in range(40):  # max. 20 s
            if self._abbrechen:
                return
            if pico_core.pico_betrieb_da():
                break
            time.sleep(0.5)
        else:
            self._log(
                "Pico meldet sich nicht zurueck. Firmware moeglicherweise "
                "nicht gestartet -- bitte manuell pruefen.", fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        # Versions-Recheck: nach dem Reboot ist die USB-Anmeldung
        # (pico_betrieb_da) frueher da als der CDC-tty + die Antwort-
        # bereitschaft der FW. Darum nicht genau einmal lesen, sondern einige
        # Sekunden pollen (richtiger ttyACM*-Port je Runde).
        self._anleitung("Lese neue Firmware-Version ...")
        fw_neu, rc, err = pico_core.warte_firmware_version(timeout_s=15.0)
        # Nach dem Flashen muss der Pico die volle Satz-Kennung der GEFLASHTEN
        # Variante melden ('x.y.z+cimbel.N'); fw_neu (pa_cli) hat dasselbe
        # Format. So wird bestaetigt, dass die richtige Variante geflasht wurde.
        aktueller_satz = pico_core.waehle_satz(pico_core.stick_satz(), self._variante)
        erwartet = aktueller_satz.get("satz_version") if aktueller_satz else None

        if erwartet and fw_neu != erwartet:
            self._log(
                "Warnung: Pico meldet Version " + str(fw_neu) +
                ", erwartet " + erwartet +
                ". Bedien-GUI wird NICHT uebernommen.", fehler=True)
            if fw_neu is None:
                # Rohe pa_cli-Diagnose, statt nur "None" zu zeigen.
                diag = (err or "").strip() or "keine Fehlerausgabe"
                self._log("Diagnose (pa_cli): returncode=" + str(rc) +
                          ", meldung: " + diag, fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        # Schritt 6: GUI uebernehmen (erst nach bestaetigtem Erfolg) -- GUI der
        # geflashten Variante, passend zur Firmware.
        try:
            pico_core.gui_uebernehmen(self._variante)
        except Exception as e:
            self._log("GUI-Uebernahme fehlgeschlagen: " + str(e), fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        self._log("Pico-ASHA aktualisiert. Die Bedien-GUI ist auf dem "
                  "neuen Stand.", ok=True)
        self._anleitung("Fertig!")
        self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
        # Hauptfenster-Zeile aktualisieren
        self._ui(self._nach_flash_cb)


def main():
    # Einzelinstanz: laeuft schon ein Updater, kommentarlos enden (vor tk.Tk(),
    # damit kein zweites Fenster aufblitzt). Der os.execv-Selbst-Neustart ist
    # davon nicht betroffen -- er erbt die gehaltene Sperre (s. _einzelinstanz_sichern).
    if not _einzelinstanz_sichern():
        sys.exit(0)
    nach_update = NACH_SELBSTUPDATE_FLAG in sys.argv
    root = tk.Tk()
    UpdaterGUI(root, nach_selbstupdate=nach_update)
    root.mainloop()


if __name__ == "__main__":
    main()
