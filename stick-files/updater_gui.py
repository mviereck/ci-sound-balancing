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
        root.geometry("600x640")
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
        self._bereich_system = tk.LabelFrame(root, text="System", padx=8, pady=6)
        self._bereich_system.pack(fill="x", padx=10, pady=4)
        self.lbl_system = tk.Label(self._bereich_system, text="apt-Updates (optional)")
        self.lbl_system.pack(side="left")
        self.btn_system = tk.Button(self._bereich_system, text="Auf Updates pruefen",
                                    command=self._system_pruefen, state="disabled")
        self.btn_system.pack(side="right")

        # --- Untere Leiste ZUERST (side="bottom"), damit sie immer sichtbar
        #     bleibt und nicht vom expandierenden Log unter den Rand gedraengt
        #     wird. Reihenfolge von unten nach oben: Beenden, Kopieren, Status.
        tk.Button(root, text="Beenden", command=root.destroy).pack(side="bottom", pady=8)
        self.lbl_status = tk.Label(root, text="", fg="#000")
        self.lbl_status.pack(side="bottom", pady=4)
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

        self._fehler_aufgetreten = False
        self._im_hintergrund(self._initialer_status)

    # ------------------------------------------------- Nebenlaeufigkeit

    def _im_hintergrund(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def _ui(self, fn):
        """Im Tk-Thread ausfuehren."""
        self.root.after(0, fn)

    def _setze_status(self, text):
        self._ui(lambda: self.lbl_status.config(text=text))

    def _log(self, text, fehler=False):
        """Eine Zeile ins Meldungsfeld. fehler=True -> rot + merkt sich, dass
        ein Fehler auftrat (fuer die Abschlussmeldung)."""
        if fehler:
            self._fehler_aufgetreten = True
        def _append():
            if fehler:
                self.txt_log.insert("end", text + "\n", "fehler")
            else:
                self.txt_log.insert("end", text + "\n")
            self.txt_log.see("end")
        self._ui(_append)

    def _abschluss(self, erfolgstext):
        """Nach einer Aktion: Erfolgs- oder Sammel-Fehlermeldung ins Log."""
        if self._fehler_aufgetreten:
            self._log("Es sind Fehler aufgetreten (siehe oben). "
                      "Mit 'Meldungen ins Clipboard kopieren' den Bericht sichern.",
                      fehler=True)
        else:
            self._log(erfolgstext)

    def _log_kopieren(self):
        inhalt = self.txt_log.get("1.0", "end").strip()
        self.root.clipboard_clear()
        self.root.clipboard_append(inhalt)
        # Tk leert das Clipboard beim Beenden -- update() erzwingt die Uebergabe
        # an den X-Server, damit der Inhalt auch nach Programmende verfuegbar ist.
        self.root.update()
        self._setze_status("Meldungen ins Clipboard kopiert.")

    def _ignoriere_close(self):
        self._log("Zum Beenden bitte den Knopf 'Beenden' benutzen "
                  "(das Schließkreuz ist absichtlich wirkungslos, damit keine "
                  "laufende Aktion unterbrochen wird).")

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

        # Audio-Status NICHT automatisch ermitteln: _audio_diff laedt die grosse
        # Soll-Liste und scannt ~180k Dateien (USB langsam). Zweistufig -- der
        # Nutzer startet die Pruefung per Knopf.
        self._ui(lambda: self.btn_audio.config(state="normal"))

        # System immer anwaehlbar (apt update braucht erst Knopfdruck).
        self._ui(lambda: self.btn_system.config(state="normal"))

    # ------------------------------------------------- CImbel

    def _cimbel_update(self):
        self.btn_cimbel.config(state="disabled")
        self._im_hintergrund(self._cimbel_update_bg)

    def _cimbel_update_bg(self):
        self._setze_status("git pull ...")
        rc = subprocess.run(["git", "-C", REPO_ROOT, "pull"]).returncode
        if rc != 0:
            msg = "git pull fehlgeschlagen (rc=" + str(rc) + ")"
            self._setze_status(msg)
            self._log(msg)
            return
        self._log("git pull OK")
        self._setze_status("Dateiliste (home) anwenden ...")
        self._log("Wende Werks-Dateien an (Dateiliste MANIFEST, home) ...")
        # unprivilegiert: direkt im Kern, Meldungen je Eintrag ins Log
        manifest = update_core._lade_manifest(STICK_ROOT)
        for e in manifest:
            if e.get("bereich", "home") != "home":
                continue
            msg = update_core._manifest_eintrag_anwenden(
                e, STICK_ROOT, OPUS_ROOT, WEBSPACE)
            self._log(msg, fehler=msg.startswith("FEHLER"))
        # system-root gebuendelt via pkexec (nur falls es solche Eintraege gibt)
        if _hat_system_root_eintraege():
            self._setze_status("Systemdateien (Passwort noetig) ...")
            self._log("Wende Systemdateien an (Passwort nötig) ...")
            rc = subprocess.run(["pkexec", sys.executable, CORE_PY,
                            "--stick-root", STICK_ROOT, "--opus-root", OPUS_ROOT,
                            "--webspace", WEBSPACE, "manifest", "--bereich", "system-root"]).returncode
            if rc != 0:
                self._log("Systemdateien fehlgeschlagen (rc=" + str(rc) + ")", fehler=True)
        self._setze_status("CImbel aktualisiert.")
        self._abschluss("CImbel aktualisiert.")
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))

    # ------------------------------------------------- Audios (zweistufig)

    def _audio_pruefen(self):
        # Stufe 1: pruefen (Soll laden + lokalen Bestand lesen/scannen). Langsam ->
        # im Hintergrund, Button sperren, Spinner zeigen.
        self.btn_audio.config(state="disabled")
        self._setze_status("Prüfe Audios (lade Liste) ...")
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
            msg = "Audio-Prüfung fehlgeschlagen: " + str(e)
            self._ui(lambda: self.lbl_audio.config(text="Status nicht ermittelbar"))
            self._setze_status(msg)
            self._log(msg)
            self._ui(lambda: self.btn_audio.config(state="normal"))
            return
        finally:
            self._ui(self.progress.stop)
            self._ui(self.progress.pack_forget)
        self._log("Audio-Prüfung: " + str(n) + " zu laden, " +
                  str(len(verwaist)) + " verwaist.")
        if n > 0:
            self._ui(lambda: self.lbl_audio.config(
                text=str(n) + " neue/geänderte Audios (Download kann lange dauern)"))
            # Stufe 2: Button wird zum Aktualisieren-Knopf.
            self._ui(lambda: self.btn_audio.config(
                text="Audios aktualisieren", command=self._audio_update, state="normal"))
        else:
            self._ui(lambda: self.lbl_audio.config(text="aktuell"))
            self._setze_status("Audios sind aktuell.")
            # kein Aktualisieren noetig -> Knopf bleibt deaktiviert
        return

    def _audio_update(self):
        self.btn_audio.config(state="disabled")
        self.progress.config(mode="determinate")
        self.progress.pack(pady=4)
        self._im_hintergrund(self._audio_update_bg)

    def _audio_update_bg(self):
        def fortschritt(i, n, pfad):
            self._ui(lambda: self.progress.config(maximum=n, value=i))
            self._setze_status("Lade " + str(i) + " / " + str(n) + " ...")
        try:
            geladen, geloescht = update_core.audio_sync(OPUS_ROOT, WEBSPACE, fortschritt)
        except update_core.SyncAbbruch as e:
            msg = "Abbruch (Sicherung): " + str(e)
            self._setze_status(msg)
            self._log(msg)
            return
        except ValueError as e:
            msg = "Fehler: " + str(e)
            self._setze_status(msg)
            self._log(msg)
            return
        finally:
            self._ui(self.progress.pack_forget)
        ergebnis = ("Audios aktualisiert: " + str(geladen) + " geladen, " +
                    str(geloescht) + " entfernt.")
        self._setze_status(ergebnis)
        self._log(ergebnis)
        self._ui(lambda: self.lbl_audio.config(text="aktuell"))

    # ------------------------------------------------- System (zweistufig)

    def _system_pruefen(self):
        self._setze_status("apt update (Passwort noetig) ...")
        self._log("apt update gestartet (laeuft im Terminal) ...")
        self._im_hintergrund(self._system_pruefen_bg)

    def _system_pruefen_bg(self):
        # apt update braucht root -> pkexec, sichtbar im Terminal (wie upgrade).
        # subprocess.run wartet, bis das Terminal geschlossen ist, erst dann
        # schaltet der Button auf "System aktualisieren" um.
        subprocess.run(["x-terminal-emulator", "-e", "bash", "-c",
                        "pkexec apt update; echo; echo 'Prüfung fertig.'; "
                        "read -p 'Fenster schliessen mit Enter ...' _"])
        self._ui(lambda: self.btn_system.config(text="System aktualisieren",
                                                command=self._system_upgrade))
        msg = "apt update fertig. 'System aktualisieren' startet apt upgrade."
        self._setze_status(msg)
        self._log(msg)

    def _system_upgrade(self):
        self._setze_status("apt upgrade läuft im Terminal ...")
        self._log("apt upgrade gestartet (laeuft im Terminal) ...")
        self._im_hintergrund(self._system_upgrade_bg)

    def _system_upgrade_bg(self):
        # Sichtbar im Terminal; blockierend im Hintergrund-Thread (run, nicht
        # Popen), damit nach Terminal-Ende der Status aktualisiert wird -- sonst
        # bliebe "laeuft im Terminal" stehen, auch wenn das Terminal zu ist.
        subprocess.run(["x-terminal-emulator", "-e", "bash", "-c",
                        "pkexec apt -y upgrade; echo; echo 'Systemupdate fertig.'; "
                        "read -p 'Fenster schliessen mit Enter ...' _"])
        msg = "Systemupdate abgeschlossen."
        self._setze_status(msg)
        self._log(msg)


def main():
    root = tk.Tk()
    UpdaterGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
