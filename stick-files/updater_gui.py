#!/usr/bin/env python3
"""Stick-Updater -- grafische Oberflaeche (Tkinter).

Ein Fenster mit drei Bereichen: CImbel / Audios / System. Orchestriert den
Kern update_core.py: unprivilegierte Teile per Modul-Import, privilegierte
(system-root-Dateiliste, apt) per pkexec-Subprocess. Exit nur ueber den
Exit-Button.
"""
import os
import sys
import json
import threading
import subprocess
import urllib.request
import tkinter as tk
from tkinter import ttk
from pathlib import Path

import update_core

STICK_ROOT = update_core.DEF_STICK_ROOT
OPUS_ROOT = update_core.DEF_OPUS_ROOT
WEBSPACE = update_core.DEF_WEBSPACE
REPO_ROOT = "/mnt/daten/git/ci-sound-balancing"
LOKALE_VERSION = REPO_ROOT + "/js/version.js"
PROD_VERSION_URL = "https://www.ci-sound-balancing.org/js/version.js"
CORE_PY = str(Path(__file__).resolve().parent / "update_core.py")


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


def _hat_system_root_eintraege():
    try:
        with open(Path(STICK_ROOT) / "MANIFEST.json", encoding="utf-8") as f:
            eintraege = json.load(f)
        return any(e.get("bereich") == "system-root" for e in eintraege)
    except (OSError, json.JSONDecodeError):
        return False


# ----------------------------------------------------------- GUI

class UpdaterGUI:
    def __init__(self, root):
        self.root = root
        root.title("CImbel aktualisieren")
        root.geometry("560x420")
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

        # --- Bereich Audios ---
        self._bereich_audio = tk.LabelFrame(root, text="Audios", padx=8, pady=6)
        self._bereich_audio.pack(fill="x", padx=10, pady=4)
        self.lbl_audio = tk.Label(self._bereich_audio, text="...")
        self.lbl_audio.pack(side="left")
        self.btn_audio = tk.Button(self._bereich_audio, text="Audios aktualisieren",
                                   command=self._audio_update, state="disabled")
        self.btn_audio.pack(side="right")
        self.progress = ttk.Progressbar(root, length=520, mode="determinate")
        # wird nur beim Audio-Download eingeblendet

        # --- Bereich System ---
        self._bereich_system = tk.LabelFrame(root, text="System", padx=8, pady=6)
        self._bereich_system.pack(fill="x", padx=10, pady=4)
        self.lbl_system = tk.Label(self._bereich_system, text="apt-Updates (optional)")
        self.lbl_system.pack(side="left")
        self.btn_system = tk.Button(self._bereich_system, text="Auf Updates pruefen",
                                    command=self._system_pruefen, state="disabled")
        self.btn_system.pack(side="right")

        # --- Statuszeile + Exit ---
        self.lbl_status = tk.Label(root, text="", fg="#555")
        self.lbl_status.pack(pady=4)
        tk.Button(root, text="Beenden", command=root.destroy).pack(pady=8)

        self._im_hintergrund(self._initialer_status)

    # ------------------------------------------------- Nebenlaeufigkeit

    def _im_hintergrund(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def _ui(self, fn):
        """Im Tk-Thread ausfuehren."""
        self.root.after(0, fn)

    def _setze_status(self, text):
        self._ui(lambda: self.lbl_status.config(text=text))

    def _ignoriere_close(self):
        self._setze_status("Zum Beenden den Knopf 'Beenden' benutzen.")

    # ------------------------------------------------- Initialer Status

    def _initialer_status(self):
        self.online = _online()
        if not self.online:
            self._ui(lambda: self.lbl_online.config(
                text="Keine Internetverbindung -- bitte WLAN einrichten.", fg="#a00"))
            self._ui(lambda: self.lbl_cimbel.config(text="offline"))
            self._ui(lambda: self.lbl_audio.config(text="offline"))
            return
        self._ui(lambda: self.lbl_online.config(text="Internetverbindung vorhanden.", fg="#070"))

        # CImbel-Status
        lok, prod = _lokale_version(), _prod_version()
        if prod and lok and prod != lok:
            self._ui(lambda: self.lbl_cimbel.config(
                text="Neue Version verfuegbar (" + str(prod) + ")"))
            self._ui(lambda: self.btn_cimbel.config(state="normal"))
        else:
            self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))

        # Audio-Status
        try:
            laden, _verwaist = update_core._audio_diff(OPUS_ROOT, WEBSPACE)
            n = len(laden)
        except Exception as e:
            self._ui(lambda: self.lbl_audio.config(text="Status nicht ermittelbar"))
            n = 0
            laden = []
        if n > 0:
            self._ui(lambda: self.lbl_audio.config(
                text=str(n) + " neue/geaenderte Audios (Download kann lange dauern)"))
            self._ui(lambda: self.btn_audio.config(state="normal"))
        else:
            self._ui(lambda: self.lbl_audio.config(text="aktuell"))

        # System immer anwaehlbar (apt update braucht erst Knopfdruck)
        self._ui(lambda: self.btn_system.config(state="normal"))

    # ------------------------------------------------- CImbel

    def _cimbel_update(self):
        self.btn_cimbel.config(state="disabled")
        self._im_hintergrund(self._cimbel_update_bg)

    def _cimbel_update_bg(self):
        self._setze_status("git pull ...")
        rc = subprocess.run(["git", "-C", REPO_ROOT, "pull"]).returncode
        if rc != 0:
            self._setze_status("git pull fehlgeschlagen.")
            return
        self._setze_status("Dateiliste (home) anwenden ...")
        # unprivilegiert, direkt im Kern
        import argparse
        ns = argparse.Namespace(stick_root=STICK_ROOT, opus_root=OPUS_ROOT,
                                webspace=WEBSPACE, bereich="home")
        update_core.cmd_manifest(ns)
        # system-root gebuendelt via pkexec (nur falls es solche Eintraege gibt)
        if _hat_system_root_eintraege():
            self._setze_status("Systemdateien (Passwort noetig) ...")
            subprocess.run(["pkexec", sys.executable, CORE_PY,
                            "--stick-root", STICK_ROOT, "--opus-root", OPUS_ROOT,
                            "--webspace", WEBSPACE, "manifest", "--bereich", "system-root"])
        self._setze_status("CImbel aktualisiert.")
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))

    # ------------------------------------------------- Audios

    def _audio_update(self):
        self.btn_audio.config(state="disabled")
        self.progress.pack(pady=4)
        self._im_hintergrund(self._audio_update_bg)

    def _audio_update_bg(self):
        def fortschritt(i, n, pfad):
            self._ui(lambda: self.progress.config(maximum=n, value=i))
            self._setze_status("Lade " + str(i) + " / " + str(n) + " ...")
        try:
            geladen, geloescht = update_core.audio_sync(OPUS_ROOT, WEBSPACE, fortschritt)
        except update_core.SyncAbbruch as e:
            self._setze_status("Abbruch (Sicherung): " + str(e))
            return
        except ValueError as e:
            self._setze_status("Fehler: " + str(e))
            return
        finally:
            self._ui(self.progress.pack_forget)
        self._setze_status("Audios aktualisiert: " + str(geladen) + " geladen, " +
                           str(geloescht) + " entfernt.")
        self._ui(lambda: self.lbl_audio.config(text="aktuell"))

    # ------------------------------------------------- System (zweistufig)

    def _system_pruefen(self):
        self._setze_status("apt update (Passwort noetig) ...")
        self._im_hintergrund(self._system_pruefen_bg)

    def _system_pruefen_bg(self):
        # apt update braucht root -> pkexec. Ausgabe im Terminal sichtbar.
        subprocess.run(["pkexec", "apt", "update"])
        self._ui(lambda: self.btn_system.config(text="System aktualisieren",
                                                command=self._system_upgrade))
        self._setze_status("Pruefung fertig. 'System aktualisieren' startet apt upgrade.")

    def _system_upgrade(self):
        self._setze_status("apt upgrade laeuft im Terminal ...")
        # Sichtbar im Terminal, am Ende Hinweis. x-terminal-emulator = Debian-Alternative.
        subprocess.Popen(["x-terminal-emulator", "-e", "bash", "-c",
                          "pkexec apt -y upgrade; echo; echo 'Systemupdate fertig.'; "
                          "read -p 'Fenster schliessen mit Enter ...' _"])


def main():
    root = tk.Tk()
    UpdaterGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
