#!/usr/bin/env python3
"""Stick-Updater -- grafische Oberflaeche (Tkinter).

Ein Fenster mit vier Bereichen: CImbel / Audios / Pico-ASHA / System.
Orchestriert update_core.py (unprivilegiert per Import, privilegiert per
pkexec) und pico_core.py (Pico-Erkennung, Download, Flash-Orchestrierung).
Exit nur ueber den Exit-Button.
"""
import os
import sys
import json
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
        root.geometry("600x720")
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

        # --- Bereich Pico-ASHA ---
        self._bereich_pico = tk.LabelFrame(root, text="Pico-ASHA", padx=8, pady=6)
        self._bereich_pico.pack(fill="x", padx=10, pady=4)
        self.lbl_pico = tk.Label(self._bereich_pico, text="...")
        self.lbl_pico.pack(side="left")
        # Force-Flash ist IMMER anwaehlbar (unabhaengig vom Versionsvergleich):
        self.btn_pico_force = tk.Button(self._bereich_pico, text="Pico neu flashen",
                                        command=lambda: self._pico_flash_dialog(force=True))
        self.btn_pico_force.pack(side="right")
        # Update-Button erscheint nur, wenn eine neue Version vorliegt:
        self.btn_pico = tk.Button(self._bereich_pico, text="Pico-ASHA aktualisieren",
                                  command=lambda: self._pico_flash_dialog(force=False),
                                  state="disabled")
        self.btn_pico.pack(side="right", padx=(0, 6))

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

        self._fehler_aufgetreten = False
        self._im_hintergrund(self._initialer_status)

    # ------------------------------------------------- Nebenlaeufigkeit

    def _im_hintergrund(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def _ui(self, fn):
        """Im Tk-Thread ausfuehren."""
        self.root.after(0, fn)

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
        self._log("git pull ...")
        rc = subprocess.run(["git", "-C", REPO_ROOT, "pull"]).returncode
        if rc != 0:
            self._log("git pull fehlgeschlagen (rc=" + str(rc) + ")", fehler=True)
            return
        self._log("git pull OK")
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
            self._log("Wende Systemdateien an (Passwort nötig) ...")
            rc = subprocess.run(["pkexec", sys.executable, CORE_PY,
                            "--stick-root", STICK_ROOT, "--opus-root", OPUS_ROOT,
                            "--webspace", WEBSPACE, "manifest", "--bereich", "system-root"]).returncode
            if rc != 0:
                self._log("Systemdateien fehlgeschlagen (rc=" + str(rc) + ")", fehler=True)
        self._abschluss("CImbel aktualisiert.")
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))

    # ------------------------------------------------- Audios (zweistufig)

    def _audio_pruefen(self):
        # Stufe 1: pruefen (Soll laden + lokalen Bestand lesen/scannen). Langsam ->
        # im Hintergrund, Button sperren, Spinner zeigen.
        self.btn_audio.config(state="disabled")
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
            self._log("Audios sind aktuell.")
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
            self._log_fortschritt("Lade " + str(i) + " / " + str(n) + " ...")
        try:
            geladen, geloescht = update_core.audio_sync(OPUS_ROOT, WEBSPACE, fortschritt)
        except update_core.SyncAbbruch as e:
            self._fortschritt_ende()
            self._log("Abbruch (Sicherung): " + str(e), fehler=True)
            return
        except ValueError as e:
            self._fortschritt_ende()
            self._log("Fehler: " + str(e), fehler=True)
            return
        finally:
            self._ui(self.progress.pack_forget)
        self._fortschritt_ende()
        self._log("Audios aktualisiert: " + str(geladen) + " geladen, " +
                  str(geloescht) + " entfernt.")
        self._ui(lambda: self.lbl_audio.config(text="aktuell"))

    # ------------------------------------------------- System (zweistufig)

    def _system_pruefen(self):
        self.btn_system.config(state="disabled")
        self._log("apt update gestartet (laeuft im Terminal, Passwort nötig) ...")
        self._im_hintergrund(self._system_pruefen_bg)

    def _anzahl_upgradable(self):
        """Zahl aktualisierbarer Pakete -- unprivilegiert (kein root noetig).
        'apt list --upgradable' listet je ein Paket als 'name/suite ...';
        die Kopfzeile ('Listing...'/'Auflistung...') enthaelt kein '/'."""
        try:
            out = subprocess.run(["apt", "list", "--upgradable"],
                                  capture_output=True, text=True).stdout
        except OSError:
            return None
        return sum(1 for z in out.splitlines() if "/" in z)

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
            self._ui(lambda: self.btn_system.config(state="normal"))
            return
        # Erfolg: Paketzahl still ermitteln und anzeigen; Upgrade nur anbieten,
        # wenn es etwas zu aktualisieren gibt.
        n = self._anzahl_upgradable()
        if n is None:
            self._log("Paketzahl nicht ermittelbar (apt list fehlgeschlagen).", fehler=True)
            self._ui(lambda: self.btn_system.config(state="normal"))
            return
        if n > 0:
            self._log("apt update fertig: " + str(n) + " Paket-Updates verfügbar.")
            self._ui(lambda: self.lbl_system.config(
                text=str(n) + " Paket-Updates verfügbar"))
            self._ui(lambda: self.btn_system.config(
                text="System aktualisieren", command=self._system_upgrade, state="normal"))
        else:
            self._log("apt update fertig: System ist aktuell.")
            self._ui(lambda: self.lbl_system.config(text="System ist aktuell"))
            # kein Upgrade noetig -> Knopf bleibt deaktiviert

    def _system_upgrade(self):
        self.btn_system.config(state="disabled")
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
            self._ui(lambda: self.btn_system.config(state="normal"))
            return
        self._log("Systemupdate abgeschlossen. System ist aktuell.")
        self._ui(lambda: self.lbl_system.config(text="System ist aktuell"))

    # ------------------------------------------------- Pico-ASHA

    def _pico_status(self):
        self._im_hintergrund(self._pico_status_bg)

    def _pico_status_bg(self):
        if not pico_core.pico_betrieb_da():
            self._ui(lambda: self.lbl_pico.config(text="Kein Pico gefunden"))
            return
        fw = pico_core.lies_firmware_version()
        if fw is None:
            self._ui(lambda: self.lbl_pico.config(
                text="Pico gefunden, Firmware unbekannt"))
            return
        stick = pico_core.stick_satz()
        web = pico_core.webspace_satz()   # None, wenn offline
        if web is None:
            self._ui(lambda: self.lbl_pico.config(
                text="Pico gefunden (Version " + fw +
                     "); Abgleich nur mit Internet möglich"))
            return
        # Zwei Vergleiche (Architektur §4):
        update_da = (stick is None) or (web["satz_version"] != stick.get("satz_version"))
        pico_veraltet = (fw != web["firmware_upstream"])
        if update_da or pico_veraltet:
            self._ui(lambda: self.lbl_pico.config(
                text="Neue Version von Pico-ASHA verfügbar (" +
                     web["satz_version"] + ")"))
            self._ui(lambda: self.btn_pico.config(state="normal"))
        else:
            self._ui(lambda: self.lbl_pico.config(text="Pico-ASHA ist aktuell"))

    def _pico_flash_dialog(self, force):
        PicoFlashDialog(self.root, force, self._pico_status)


# ----------------------------------------------------------- Pico-Flash-Dialog

class PicoFlashDialog:
    """Gefuehrter Flash-Ablauf fuer den Pico-ASHA.

    Eigenes Toplevel-Fenster mit eigenem Log (Machart reset_gui.py).
    nach_flash_cb wird nach erfolgreichem Flash im Tk-Thread aufgerufen.
    """

    def __init__(self, parent, force, nach_flash_cb):
        self._force = force
        self._nach_flash_cb = nach_flash_cb
        self._abbrechen = False

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

        self._btn_abbrechen = tk.Button(
            self._win, text="Abbrechen", command=self._anfrage_abbrechen)
        self._btn_abbrechen.pack(side="bottom", pady=8)

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

    def _anfrage_abbrechen(self):
        self._abbrechen = True
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
            web = pico_core.webspace_satz()
            if not web:
                self._log("Fehler: Webspace nicht erreichbar. "
                          "Bitte Internetverbindung pruefen.", fehler=True)
                self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
                return
            stick = pico_core.stick_satz()
            if stick is None or web["satz_version"] != stick.get("satz_version"):
                self._log("Lade neuen Satz " + web["satz_version"] + " ...")
                try:
                    pico_core.satz_herunterladen(web)
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
            pico_core.flashe(board, mp)
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

        fw_neu = pico_core.lies_firmware_version()
        aktueller_satz = pico_core.stick_satz()
        erwartet = aktueller_satz.get("firmware_upstream") if aktueller_satz else None

        if erwartet and fw_neu != erwartet:
            self._log(
                "Warnung: Pico meldet Version " + str(fw_neu) +
                ", erwartet " + erwartet +
                ". Bedien-GUI wird NICHT uebernommen.", fehler=True)
            self._ui(lambda: self._btn_abbrechen.config(text="Schliessen"))
            return

        # Schritt 6: GUI uebernehmen (erst nach bestaetigtem Erfolg)
        try:
            pico_core.gui_uebernehmen()
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
    root = tk.Tk()
    UpdaterGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
