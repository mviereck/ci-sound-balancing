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
import shutil
import threading
import subprocess
import time
import tempfile
import urllib.request
import tkinter as tk
from tkinter import ttk
from tkinter import messagebox
from pathlib import Path

import update_core
import pico_core

STICK_ROOT = update_core.DEF_STICK_ROOT
OPUS_ROOT = update_core.DEF_OPUS_ROOT
WEBSPACE = update_core.DEF_WEBSPACE
# audio.bundle/ liegt ausserhalb des Repos und wird per Buendel-Sync gepflegt
# (im CImbel-Update automatisch mit; bei der Reparatur vollstaendig neu).
BUNDLE_ROOT = update_core.DEF_BUNDLE_ROOT
BUNDLE_WEBSPACE = update_core.DEF_BUNDLE_WEBSPACE
REPO_ROOT = "/mnt/daten/cimbel-intern/git/ci-sound-balancing"
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

# --- Klon-URLs (im eigenen Code aufbewahrt, ueberleben einen Clone-Schaden) ---
# CImbel hat genau eine Quelle; eira hat zwei moegliche (Original und Martins
# Fork), die beide als Konstante feststehen. EIRA_QUELLE waehlt die aktive --
# der Quellenwechsel erfolgt durch Aendern dieser EINEN Variable (kommt per
# CImbel-Update auf den Stick, der Selbst-Neustart greift). Aktive URL und
# aktiver Clone-Ordner werden daraus ABGELEITET (eine Wahrheitsquelle, kein
# Pflege-Doppel): je Quelle ein eigener Ordner, beide duerfen nebeneinander im
# git/-Verzeichnis liegen; aktiv ist nur der zur gewaehlten Quelle. Das inaktive
# Repo liegt (falls vorhanden) nur bereit; Status/Pull/Installer beziehen sich
# immer auf das aktive. Der Reparatur-Knopf (unten) klont die aktive Quelle neu.
REPO_URL = "https://github.com/mviereck/ci-sound-balancing.git"

GIT_ROOT = "/mnt/daten/cimbel-intern/git"
EIRA_URLS = {
    "original": "https://codeberg.org/eira/eira-RaspberryPi.git",
    "fork": "https://codeberg.org/mviereck/eira-RaspberryPi.git",
}
EIRA_ORDNER = {
    "original": GIT_ROOT + "/eira-RaspberryPi-original",
    "fork": GIT_ROOT + "/eira-RaspberryPi-fork",
}
# Werks-Default -- bewusst "original", damit der Reparatur-Knopf gleich etwas zu
# tun hat (der Original-Ordner fehlt auf dem Fork-Stick noch -> "fehlt ganz").
EIRA_QUELLE = "original"
EIRA_URL = EIRA_URLS[EIRA_QUELLE]
EIRA_CLONE = EIRA_ORDNER[EIRA_QUELLE]
EIRA_INSTALLER = EIRA_CLONE + "/installer_x86.sh"

# Harte Platz-Reserve: so viel freier Platz MUSS auf der Opus-Partition nach
# einem Audio-Download uebrig bleiben -- fuer CImbel-Updates (git pull) und
# gespeicherte CImbel-Nutzerdaten. Ein Download, der diese Reserve unterschreiten
# wuerde, wird gesperrt (Live-Warnung im Audio-Fenster).
AUDIO_PLATZ_RESERVE = 750 * 1024 * 1024        # 750 MiB

# --- Audio-Teilmengen (statische Landkarte des Opus-Bestands) ---
# Der Nutzer waehlt im Audio-Download-Fenster, welche Teilmengen er laden will.
# Jede Teilmenge ist ein Pfad-Praefix in der Soll-Liste (opus/soll-items.txt);
# update_core filtert Diff/Sync darauf. Statisch, weil nur so lesbare Namen,
# Reihenfolge und die M-AILABS-Aufschluesselung nach Sprechern moeglich sind --
# ein neuer Opus-Ordner braucht hier eine Pflege-Zeile. Format je Eintrag:
#   (praefix, label, beschreibung, kinder)
# kinder: Liste (praefix, label, beschreibung) der Unter-Teilmengen (M-AILABS
# nach Sprechern) -- oder None fuer eine einfache Teilmenge. Bei vorhandenen
# Kindern ist das Eltern-Praefix der Sammel-Praefix (Haken = alle Kinder).
AUDIO_TEILMENGEN = [
    ("ARU_Speech_Corpus_v1_0/", "ARU Speech Corpus", "Sätze (Englisch)", None),
    ("common-voice/", "Common Voice", "Sätze, viele Sprecher", None),
    ("musan/", "MUSAN", "Musik & Geräusche", None),
    ("test-noise/", "Test-Geräusche", "Geräusche", None),
    ("testsaetze-hagermann/", "Hagermann-Testsätze", "Matrix-Testsätze (Sprachtest)", None),
    ("mls_french_opus/", "MLS Französisch", "Hörbuch-Sätze (Französisch)", None),
    ("mls_polish_opus/", "MLS Polnisch", "Hörbuch-Sätze (Polnisch)", None),
    ("mls_spanish_opus/", "MLS Spanisch", "Hörbuch-Sätze (Spanisch)", None),
    ("Thorsten Voice/", "Thorsten Voice", "Sätze (Deutsch, eine Stimme)", None),
    ("Thorsten-Voice-Emotional/", "Thorsten Voice – Emotional", "Sätze in versch. Emotionen", None),
    ("Thorsten-Voice-Hessisch/", "Thorsten Voice – Hessisch", "Sätze (hessischer Dialekt)", None),
    ("M-AILABS/", "M-AILABS", "Sätze aus Hörbüchern (DE & EN)", [
        ("M-AILABS/de_DE/by_book/female/angela_merkel/", "DE · Angela Merkel", "", None),
        ("M-AILABS/de_DE/by_book/female/eva_k/", "DE · Eva K", "", None),
        ("M-AILABS/de_DE/by_book/female/ramona_deininger/", "DE · Ramona Deininger", "", None),
        ("M-AILABS/de_DE/by_book/female/rebecca_braunert_plunkett/", "DE · Rebecca Braunert-Plunkett", "", None),
        ("M-AILABS/de_DE/by_book/male/karlsson/", "DE · Karlsson", "", None),
        ("M-AILABS/de_DE/by_book/mix/auf_zwei_planeten/", "DE · Auf zwei Planeten (Buch)", "", None),
        ("M-AILABS/de_DE/by_book/mix/erzaehlungen_poe/", "DE · Erzählungen Poe (Buch)", "", None),
        ("M-AILABS/en_UK/by_book/female/elizabeth_klett/", "EN · Elizabeth Klett", "", None),
    ]),
]


def _menschlich_bytes(n):
    """Bytes als kurze, menschenlesbare Groesse (MB/GB, eine Nachkommastelle)."""
    if n >= 1024 ** 3:
        return "%.1f GB" % (n / 1024 ** 3)
    if n >= 1024 ** 2:
        return "%.0f MB" % (n / 1024 ** 2)
    if n >= 1024:
        return "%.0f kB" % (n / 1024)
    return str(n) + " B"


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


def _clone_vollstaendig(pfad):
    """Grobe Vollstaendigkeitspruefung eines git-Clone-Ordners: existiert der
    Ordner UND liefert 'git -C <pfad> rev-parse --git-dir' sauber (rc 0)? Das
    faellt bei fehlendem Ordner, fehlendem .git und bei einem zerstoerten
    .git-Verzeichnis durch (git meldet dann 'not a git repository'). Keine tiefe
    fsck-Pruefung -- sie beantwortet nur 'ist das ueberhaupt ein brauchbares
    Repo?', genug fuer die Reparatur-Entscheidung (die der Nutzer manuell
    ausloest; die Pruefung steuert nur den Rueckfragetext)."""
    if not os.path.isdir(pfad):
        return False
    p = subprocess.run(["git", "-C", pfad, "rev-parse", "--git-dir"],
                       capture_output=True, text=True)
    return p.returncode == 0


def _repo_neu_klonen(url, ziel, log, fortschritt=None):
    """Gemeinsame Neuklon-Maschine fuer CImbel und eira (ein Koerper, zwei
    Ausloeser). Klont 'url' zunaechst in einen TEMPORAEREN Ordner neben 'ziel';
    erst bei Erfolg wird ein evtl. vorhandenes altes 'ziel' entfernt und der
    frische Klon an seine Stelle gerueckt (Umbenennen, atomar auf demselben
    Dateisystem). Scheitert der Klon (z.B. Netzabbruch), bleibt 'ziel'
    UNBERUEHRT -- kein leerer Stick. Gibt True/False zurueck; alle Meldungen
    laufen ueber 'log(text, fehler=bool)'. 'fortschritt' (optional) erhaelt
    git-Fortschrittszeilen.

    Der Clone-Ordner traegt NUR den Clone (keine Nutzerdaten) -- das Entfernen
    des Alt-Ordners ist darum unkritisch (am Konzept geklaert)."""
    ziel = os.path.abspath(ziel)
    eltern = os.path.dirname(ziel)
    try:
        os.makedirs(eltern, exist_ok=True)
    except OSError as e:
        log("Zielverzeichnis nicht anlegbar (" + str(e) + ").", fehler=True)
        return False
    # Temp-Ordner NEBEN dem Ziel (gleiches Dateisystem -> os.replace ist atomar).
    tmp = tempfile.mkdtemp(prefix=".klon-", dir=eltern)
    # mkdtemp legt den Ordner an; git clone will ihn selbst erzeugen -> wieder weg.
    try:
        os.rmdir(tmp)
    except OSError:
        pass
    log("Klone " + url + " ...")
    p = subprocess.run(["git", "clone", "--depth", "1", "--progress", url, tmp],
                       capture_output=True, text=True)
    if p.returncode != 0:
        ausgabe = ((p.stdout or "") + (p.stderr or "")).strip()
        if ausgabe:
            log(ausgabe, fehler=True)
        log("Klonen fehlgeschlagen (rc=" + str(p.returncode) + ").", fehler=True)
        shutil.rmtree(tmp, ignore_errors=True)
        return False
    # Klon ok -> alten Ordner (falls da) weg, frischen an seine Stelle.
    try:
        if os.path.exists(ziel):
            shutil.rmtree(ziel)
        os.replace(tmp, ziel)
    except OSError as e:
        log("Ersetzen des alten Ordners fehlgeschlagen (" + str(e) + ").",
            fehler=True)
        shutil.rmtree(tmp, ignore_errors=True)
        return False
    log("Klonen erfolgreich.")
    return True


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
        root.title("CImbel-Systempflege")
        # Zwei-Spalten-Layout (Bereiche links, Log rechts) statt Log unter den
        # Bereichen -> das Fenster bleibt niedrig (passt auf 1366x768). Breite
        # auf 1024 ausgelegt, Mindestbreite 960 (Seiten-Panels fremder Desktops).
        root.geometry("1000x520")
        root.minsize(960, 440)
        # Fenster-X UND Beenden-Knopf gehen durch denselben Pfad
        # (_beenden_versuch): Schliessen nur, wenn gerade keine Aktion laeuft --
        # sonst wuerde eine laufende Aktion (git pull, MANIFEST, Download)
        # mitten im Schreiben hart abgebrochen.
        root.protocol("WM_DELETE_WINDOW", self._beenden_versuch)

        self.online = False

        # --- Online-Status oben (volle Breite) ---
        self.lbl_online = tk.Label(root, text="Pruefer Internetverbindung ...",
                                   font=("", 11, "bold"))
        self.lbl_online.pack(pady=8)

        # --- Beenden ZUERST unten packen (side="bottom" vor dem expandierenden
        #     Mittelteil), sonst draengt der mitwachsende mitte-Frame den Knopf
        #     unter den Fensterrand. Schliesst nur, wenn keine Aktion laeuft.
        tk.Button(root, text="Beenden", command=self._beenden_versuch).pack(
            side="bottom", pady=8)

        # --- Haupt-Raster: links Bereiche (feste Mindestbreite), rechts Log ---
        mitte = tk.Frame(root)
        mitte.pack(fill="both", expand=True, padx=10, pady=4)
        mitte.columnconfigure(0, weight=0, minsize=560)  # Bereiche
        mitte.columnconfigure(1, weight=1)               # Log nimmt den Rest
        mitte.rowconfigure(0, weight=1)

        links = tk.Frame(mitte)
        links.grid(row=0, column=0, sticky="nsew", padx=(0, 8))

        # --- Bereich CImbel ---
        self._bereich_cimbel = tk.LabelFrame(links, text="CImbel", padx=8, pady=6)
        self._bereich_cimbel.pack(fill="x", pady=3)
        self.lbl_cimbel = tk.Label(self._bereich_cimbel, text="...",
                                   justify="left", anchor="w", wraplength=300)
        self.lbl_cimbel.pack(side="left", fill="x")
        # Reparatur-Knopf zuerst packen -> landet GANZ rechts; der
        # Aktualisieren-Knopf kommt mit padx links daneben. Reparieren ist IMMER
        # anwaehlbar (Notfall-Werkzeug, unabhaengig vom Versionsstand).
        self.btn_cimbel_reparieren = tk.Button(self._bereich_cimbel, text="Reparieren",
                                               command=self._cimbel_reparieren)
        self.btn_cimbel_reparieren.pack(side="right")
        self.btn_cimbel = tk.Button(self._bereich_cimbel, text="Aktualisieren",
                                    command=self._cimbel_update, state="disabled")
        self.btn_cimbel.pack(side="right", padx=(0, 6))

        # --- Bereich eira ---
        self._bereich_eira = tk.LabelFrame(links, text="eira", padx=8, pady=6)
        self._bereich_eira.pack(fill="x", pady=3)
        self.lbl_eira = tk.Label(self._bereich_eira, text="...",
                                 justify="left", anchor="w", wraplength=300)
        self.lbl_eira.pack(side="left", fill="x")
        self.btn_eira_reparieren = tk.Button(self._bereich_eira, text="Reparieren",
                                             command=self._eira_reparieren)
        self.btn_eira_reparieren.pack(side="right")
        self.btn_eira = tk.Button(self._bereich_eira, text="Aktualisieren",
                                  command=self._eira_update, state="disabled")
        self.btn_eira.pack(side="right", padx=(0, 6))

        # --- Bereich Pico-ASHA ---
        self._bereich_pico = tk.LabelFrame(links, text="Pico-ASHA", padx=8, pady=6)
        self._bereich_pico.pack(fill="x", pady=3)
        self.lbl_pico = tk.Label(self._bereich_pico, text="...",
                                 justify="left", anchor="w", wraplength=300)
        self.lbl_pico.pack(side="left", fill="x")
        # Force-Flash ist IMMER anwaehlbar (unabhaengig vom Versionsvergleich):
        self.btn_pico_force = tk.Button(self._bereich_pico, text="Neu flashen",
                                        command=self._pico_force_flash)
        self.btn_pico_force.pack(side="right")
        # Update-Button erscheint nur, wenn eine neue Version vorliegt:
        self.btn_pico = tk.Button(self._bereich_pico, text="Aktualisieren",
                                  command=lambda: self._pico_flash_dialog(force=False),
                                  state="disabled")
        self.btn_pico.pack(side="right", padx=(0, 6))

        # --- Bereich Audios ---
        self._bereich_audio = tk.LabelFrame(links, text="Audios", padx=8, pady=6)
        self._bereich_audio.pack(fill="x", pady=3)
        self.lbl_audio = tk.Label(self._bereich_audio,
                                  text="Audios für Offline Betrieb herunterladen",
                                  justify="left", anchor="w", wraplength=300)
        self.lbl_audio.pack(side="left", fill="x")
        # Ein Knopf oeffnet das Audio-Download-Fenster: dort waehlt der Nutzer
        # per Checkbox, welche Teilmengen (Ordner, M-AILABS nach Sprechern) er
        # laden will, mit Groessen-/Rest-Anzeige. Oeffnen sperrt alle Knoepfe
        # (eigenes Toplevel wie der Pico-Dialog), Schliessen gibt sie frei.
        self.btn_audio = tk.Button(self._bereich_audio, text="Verwalten",
                                   command=self._audio_fenster_oeffnen, state="disabled")
        self.btn_audio.pack(side="right")

        # --- Bereich System ---
        # Zwei getrennte Knoepfe: "Auf Updates pruefen" (apt update) und
        # "System aktualisieren" (apt upgrade). Jeder nur waehlbar, wenn er eine
        # sinnvolle Aktion ausloest: pruefen nur, wenn das letzte apt update
        # laenger als SYSTEM_UPDATE_MAX_ALTER_S zurueckliegt; aktualisieren nur,
        # wenn apt list --upgradable Pakete meldet.
        self._bereich_system = tk.LabelFrame(links, text="System", padx=8, pady=6)
        self._bereich_system.pack(fill="x", pady=3)
        self.lbl_system = tk.Label(self._bereich_system, text="apt-Updates (optional)",
                                   justify="left", anchor="w", wraplength=300)
        self.lbl_system.pack(side="left", fill="x")
        self.btn_system_upgrade = tk.Button(self._bereich_system, text="System aktualisieren",
                                            command=self._system_upgrade, state="disabled")
        self.btn_system_upgrade.pack(side="right")
        self.btn_system = tk.Button(self._bereich_system, text="Auf Updates pruefen",
                                    command=self._system_pruefen, state="disabled")
        self.btn_system.pack(side="right", padx=(0, 6))

        # --- Rechte Spalte: Log (fuellt die Hoehe) + Kopieren-Knopf darunter.
        #     Keine eigene Statuszeile -- alle Meldungen gehen ins Log.
        rechts = tk.Frame(mitte)
        rechts.grid(row=0, column=1, sticky="nsew")
        rechts.rowconfigure(0, weight=1)
        rechts.columnconfigure(0, weight=1)

        self._log_frame = tk.LabelFrame(rechts, text="Meldungen", padx=4, pady=4)
        self._log_frame.grid(row=0, column=0, sticky="nsew")
        self.txt_log = tk.Text(self._log_frame, width=30, wrap="word")
        self.txt_log.pack(side="left", fill="both", expand=True)
        _sb = tk.Scrollbar(self._log_frame, command=self.txt_log.yview)
        _sb.pack(side="right", fill="y")
        self.txt_log.config(yscrollcommand=_sb.set)
        # Fehlerzeilen rot (tag), normale schwarz.
        self.txt_log.tag_config("fehler", foreground="#c00")
        tk.Button(rechts, text="Meldungen ins Clipboard kopieren",
                  command=self._log_kopieren).grid(row=1, column=0, sticky="e",
                                                   pady=(6, 0))

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
        durchlaeuft (kein zweiter Ort mit festen Knopf-IDs). Die Reparatur-
        Knoepfe gehoeren dazu: sie sind sonst IMMER anwaehlbar, muessen aber
        waehrend einer laufenden Aktion ebenfalls gesperrt sein (eine Aktion zur
        Zeit); _status_recheck gibt sie danach bedingungslos wieder frei."""
        return [self.btn_cimbel, self.btn_eira, self.btn_audio, self.btn_system,
                self.btn_system_upgrade, self.btn_pico, self.btn_pico_force,
                self.btn_cimbel_reparieren, self.btn_eira_reparieren]

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
        """Bringt JEDEN Bereichs-Knopf nach einer Aktion (und beim Start) wieder
        in seinen korrekten Zustand -- MUSS dieselbe Knopfmenge abdecken, die
        _aktion_beginnen pauschal sperrt, sonst bleibt ein Knopf faelschlich grau
        haengen (Bug: System-Upgrade liess Audios/Pico gesperrt). Pico laeuft
        netz-unabhaengig (USB-Pruefung); die netzabhaengigen Bereiche nur online.
        Audios: KEIN Scan hier (der teure ~180k-Scan laeuft nur im Audio-Fenster
        auf Knopfdruck) -- der Knopf ist online einfach waehlbar (oeffnet das
        Fenster), offline grau.
        Darf vom Hintergrund-Thread aufgerufen werden (die Teil-Checks arbeiten
        selbst mit self._ui/_im_hintergrund)."""
        # Reparatur-Knoepfe bedingungslos freigeben: Notfall-Werkzeug, unabhaengig
        # von Netz und Versionsstand immer anwaehlbar (nur die Aktionssperre
        # graut sie voruebergehend). VOR dem offline-return, damit sie auch ohne
        # Netz wieder frei werden.
        self._ui(lambda: self.btn_cimbel_reparieren.config(state="normal"))
        self._ui(lambda: self.btn_eira_reparieren.config(state="normal"))
        self._pico_status()          # netz-unabhaengig (USB)
        if not self.online:
            return
        self._cimbel_status()
        self._eira_status()
        self._ui(self._audio_knopf_setzen)
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

    def _beenden_versuch(self):
        """Gemeinsamer Austritts-Pfad fuer Beenden-Knopf und Fenster-X. Schliesst
        den Updater NUR, wenn gerade keine Aktion laeuft -- sonst wuerde ein
        git pull, ein MANIFEST-Kopiervorgang oder ein Download mitten im
        Schreiben hart abgebrochen (Daemon-Threads sterben mit dem Prozess).
        Laeuft eine Aktion, bleibt das Fenster offen mit Hinweis."""
        if self._aktion_laeuft:
            self._log("Es läuft gerade eine Aktion -- bitte warten, bis sie "
                      "fertig ist, dann erneut 'Beenden' drücken.")
            return
        self.root.destroy()

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

    def _audio_knopf_setzen(self):
        """Audio-Knopf freigeben: online einfach waehlbar (oeffnet das
        Audio-Download-Fenster), kein Scan noetig. Im Tk-Thread aufrufen; der
        Status-Recheck ruft diese Methode nur im Online-Zweig."""
        self.btn_audio.config(text="Audios für Offline-Betrieb herunterladen",
                              command=self._audio_fenster_oeffnen, state="normal")

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

        # Updater-Code unveraendert -> MANIFEST in dieser Instanz anwenden,
        # danach die Audio-Buendel abgleichen (nur Abweichende).
        self._manifest_anwenden_lokal()
        self._bundle_sync_lauf(voll=False)
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

    def _bundle_sync_lauf(self, voll):
        """Buendel-Sync (audio.bundle/): im CImbel-Update automatisch mit (nur
        Abweichende), bei der Reparatur voll=True (alles neu). Laeuft im schon
        aktiven Hintergrund-Thread; Fortschritt in die Log-Fortschrittszeile.
        Fehler werden rot gemeldet, brechen den uebrigen Ablauf aber nicht ab
        (CImbel-Code/MANIFEST sind dann schon aktuell)."""
        self._log("Audio-Bündel abgleichen ..." if not voll
                  else "Audio-Bündel vollständig neu laden ...")

        def _fortschritt(i, n, pfad):
            self._log_fortschritt("Bündel " + str(i) + "/" + str(n) + " ...")
        try:
            geladen, geloescht = update_core.bundle_sync(
                BUNDLE_ROOT, BUNDLE_WEBSPACE, fortschritt=_fortschritt, voll=voll)
            self._log("Bündel aktuell (" + str(geladen) + " geladen, " +
                      str(geloescht) + " entfernt).")
        except Exception as e:
            self._log("Bündel-Abgleich fehlgeschlagen: " + str(e), fehler=True)

    def _nach_selbstupdate_bg(self):
        # In den beschaeftigt-Zustand (im Tk-Thread setzen), MANIFEST anwenden,
        # danach freigeben. Kein Pull, keine Hash-Pruefung.
        self._ui(self._aktion_beginnen)
        self._log("Updater neu gestartet. Wende Aktualisierung an ...")
        self._manifest_anwenden_lokal()
        self._bundle_sync_lauf(voll=False)
        self._ui(lambda: self.lbl_cimbel.config(text="auf dem neuesten Stand"))
        self._aktion_beenden()

    # --- Reparatur (Notfall: Clone-Ordner neu klonen) ---
    # Manueller Notfall-Weg, falls git pull dauerhaft klemmt oder der Ordner
    # fehlt. Erst in einen Temp-Ordner klonen, bei Erfolg den alten ersetzen
    # (_repo_neu_klonen) -- so kann ein abgebrochener Klon den Stick nicht leer
    # zuruecklassen. Der CImbel-Clone traegt den LAUFENDEN Updater-Code selbst
    # (stick-files/ liegt in diesem Repo): nach erfolgreichem Neuklon MUSS der
    # Updater neu starten (os.execv wie beim Selbst-Update), sonst arbeitet er mit
    # Pfaden, die auf den gerade ersetzten Ordner zeigen.

    def _cimbel_reparieren(self):
        status = "fehlt oder ist beschädigt" if not _clone_vollstaendig(REPO_ROOT) \
            else "scheint vorhanden"
        if not messagebox.askyesno(
                "CImbel reparieren",
                "Der CImbel-Ordner " + status + ".\n\n"
                "CImbel wird jetzt frisch von GitHub geklont. Der vorhandene "
                "Ordner wird dabei ersetzt (er enthält nur das Programm, keine "
                "persönlichen Daten).\n\n"
                "Der Updater startet danach neu. Fortfahren?"):
            return
        self._aktion_beginnen()
        self._im_hintergrund(self._cimbel_reparieren_bg)

    def _cimbel_reparieren_bg(self):
        ok = _repo_neu_klonen(REPO_URL, REPO_ROOT, self._log)
        if not ok:
            self._log("CImbel-Reparatur fehlgeschlagen.", fehler=True)
            self._aktion_beenden()
            return
        # audio.bundle/ liegt ausserhalb des Repos -> der git-Neuklon holt es
        # nicht mit. Darum VOR dem Neustart die Buendel vollstaendig neu laden
        # (voll=True: lokale Ist-Liste ignorieren -> alles neu). So macht ein
        # einziger Reparieren-Klick den Stick wieder vollstaendig (Code + Buendel),
        # auch wenn audio.bundle/ ganz fehlt (erster Boot). Laeuft vor execv, sonst
        # ginge der Abgleich beim Neustart verloren.
        self._bundle_sync_lauf(voll=True)
        # Neuklon ok -> der laufende Code wurde ersetzt. Neu starten (wie beim
        # Selbst-Update). KEIN Selbstupdate-Flag: nach einer Reparatur ist der
        # MANIFEST-Lauf nicht zwingend, und der frische Clone ist ohnehin aktuell.
        self._log("CImbel neu geklont. Updater startet neu ...")
        time.sleep(2.0)
        try:
            os.execv(sys.executable,
                     [sys.executable, os.path.abspath(__file__)])
        except OSError as e:
            self._log("Automatischer Neustart fehlgeschlagen (" + str(e) +
                      "). Bitte den Updater von Hand schließen und neu starten.",
                      fehler=True)
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
        # Laesst sich kein belastbarer Vergleich bilden (kein/kaputter Clone,
        # kein Netz, kein Upstream), bleibt der Aktualisieren-Knopf grau -- F1:
        # ein Knopf ist nur waehlbar, wenn er eine sinnvolle Aktion ausloest.
        # Fuer einen fehlenden/beschaedigten Ordner ist der separate
        # Reparatur-Knopf zustaendig (immer anwaehlbar).
        self._ui(lambda: self.btn_eira.config(state="disabled"))
        if not _clone_vollstaendig(EIRA_CLONE):
            self._ui(lambda: self.lbl_eira.config(
                text="Ordner fehlt/beschädigt – bitte reparieren"))
            return
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
        # liegt). Laeuft SICHTBAR im Terminal, damit der Nutzer den Ablauf sieht;
        # die Ausgabe wird per 'tee' zusaetzlich in eine temp-Datei gespiegelt
        # und der Installer-Returncode in eine zweite temp-Datei geschrieben
        # (x-terminal-emulator gibt nur den Exit des Terminals zurueck, nicht den
        # des inneren Befehls). Bei Fehler zeigt der Updater die letzten Zeilen
        # der Ausgabe rot im Log -- so live-Terminal UND Log-Diagnose.
        self._log("eira: Installer laeuft im Terminal (Passwort nötig) ...")
        rc = self._pkexec_im_terminal(
            [EIRA_INSTALLER, "-y"], "eira-Installer")

        if rc == 0:
            self._log("eira aktualisiert.")
            self._aktion_beenden()
            return

        # pkexec meldet 126/127, wenn die Autorisierung abgebrochen/verweigert
        # wurde (Passwort-Dialog weggeklickt) -- das ist KEIN Fehler, sondern
        # eine legitime Nutzeraktion. Alles andere ist ein echter Installer-
        # Fehler. In beiden Faellen den Clone auf den alten Commit zuruecksetzen,
        # damit das Update erneut angeboten wird.
        if rc in (126, 127):
            self._log("Passwort nicht eingegeben, Update abgebrochen.")
        # (bei echtem Fehler hat _pkexec_im_terminal die letzten Ausgabe-Zeilen
        #  bereits rot ins Log geschrieben)
        self._git("reset", "--hard", alter_head)
        self._aktion_beenden()

    def _pkexec_im_terminal(self, befehl, bezeichnung, log_zeilen=20):
        """Fuehrt 'pkexec <befehl...>' SICHTBAR in einem Terminalfenster aus und
        liefert den Returncode des inneren Befehls. Die Ausgabe wird per 'tee'
        in eine temp-Datei gespiegelt; bei Returncode != 0 (ausser 126/127,
        Abbruch) werden die letzten log_zeilen Zeilen rot ins Updater-Log
        geschrieben. Das Terminal schliesst bei Erfolg automatisch und wartet
        nur bei Fehler auf Enter (Ausgabe bleibt lesbar)."""
        with tempfile.NamedTemporaryFile(
                mode="r", suffix=".log", delete=False) as f_out:
            out_pfad = f_out.name
        with tempfile.NamedTemporaryFile(
                mode="r", suffix=".rc", delete=False) as f_rc:
            rc_pfad = f_rc.name
        # Innere Kette: pkexec-Ausgabe durch tee in die Datei; den echten
        # Returncode (PIPESTATUS[0], nicht der von tee) in die rc-Datei; bei
        # Fehler auf Enter warten, sonst Terminal sofort schliessen.
        quoted = " ".join("'" + a.replace("'", "'\\''") + "'" for a in befehl)
        skript = (
            "pkexec " + quoted + " 2>&1 | tee " + out_pfad + "; "
            "rc=${PIPESTATUS[0]}; echo \"$rc\" > " + rc_pfad + "; "
            "[ \"$rc\" -eq 0 ] || { echo; "
            "read -p 'Fenster schliessen mit Enter ...' _; }")
        subprocess.run(["x-terminal-emulator", "-e", "bash", "-c", skript])
        # Returncode aus der rc-Datei lesen (das Terminal selbst meldet ihn nicht
        # verlaesslich).
        try:
            rc = int(Path(rc_pfad).read_text().strip())
        except (OSError, ValueError):
            rc = 1  # rc-Datei nicht lesbar -> als Fehler behandeln
        if rc not in (0, 126, 127):
            try:
                zeilen = Path(out_pfad).read_text(errors="replace").splitlines()
            except OSError:
                zeilen = []
            self._log(bezeichnung + " fehlgeschlagen (rc=" + str(rc) + ").",
                      fehler=True)
            schwanz = [z for z in zeilen[-log_zeilen:] if z.strip()]
            for z in schwanz:
                self._log(z, fehler=True)
        for p in (out_pfad, rc_pfad):
            try:
                os.unlink(p)
            except OSError:
                pass
        return rc

    def _eira_reparieren(self):
        # Klont die AKTIVE eira-Quelle (aus EIRA_QUELLE abgeleitet) neu nach
        # EIRA_CLONE. Kein Neustart noetig (fremder Clone, nicht der Updater-Code);
        # danach bewertet der Status-Recheck den eira-Knopf frisch.
        status = "fehlt oder ist beschädigt" if not _clone_vollstaendig(EIRA_CLONE) \
            else "scheint vorhanden"
        if not messagebox.askyesno(
                "eira reparieren",
                "Der eira-Ordner (" + EIRA_QUELLE + ") " + status + ".\n\n"
                "eira wird jetzt frisch von Codeberg geklont. Ein vorhandener "
                "Ordner wird dabei ersetzt (er enthält nur das Programm, keine "
                "persönlichen Daten).\n\nFortfahren?"):
            return
        self._aktion_beginnen()
        self._im_hintergrund(self._eira_reparieren_bg)

    def _eira_reparieren_bg(self):
        ok = _repo_neu_klonen(EIRA_URL, EIRA_CLONE, self._log)
        if ok:
            self._log("eira neu geklont. Mit „eira aktualisieren“ kann jetzt "
                      "der Installer ausgeführt werden.")
        else:
            self._log("eira-Reparatur fehlgeschlagen.", fehler=True)
        self._aktion_beenden()

    # ------------------------------------------------- Audios (eigenes Fenster)

    def _audio_fenster_oeffnen(self):
        """Oeffnet das Audio-Download-Fenster (eigenes Toplevel, Machart
        Pico-Dialog). Oeffnen sperrt alle Knoepfe, Schliessen gibt sie frei --
        dieselbe fenster-uebergreifende Aktionssperre wie beim Pico-Flash."""
        self._aktion_beginnen()
        AudioDownloadDialog(self.root, nach_schliessen_cb=self._aktion_beenden)

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
        # Nach erfolgreichem Upgrade 'apt clean' (Paketcache leeren, spart USB-
        # Platz) -- im selben pkexec-Lauf (eine Passwortabfrage), nur bei Erfolg
        # (&&); clean ist unkritisch, sein Returncode bleibt ausser Betracht.
        rc = subprocess.run(["x-terminal-emulator", "-e", "bash", "-c",
                        "pkexec sh -c 'apt -y upgrade && apt clean' || "
                        "{ echo; echo 'apt upgrade fehlgeschlagen.'; "
                        "read -p 'Fenster schliessen mit Enter ...' _; exit 1; }"]).returncode
        if rc != 0:
            self._log("apt upgrade fehlgeschlagen -- bitte Terminal-Ausgabe beachten.",
                      fehler=True)
        else:
            self._log("Systemupdate abgeschlossen, Paketcache geleert.")
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


# ------------------------------------------------- Audio-Download-Dialog

class AudioDownloadDialog:
    """Eigenes Toplevel-Fenster fuer den Teilmengen-Audio-Download.

    Der Nutzer waehlt per Checkbox, welche Teilmengen (AUDIO_TEILMENGEN; M-AILABS
    nach Sprechern aufgeschluesselt) er laden will; je Zeile die Gesamtgroesse
    und der 'Rest zu laden'. 'Ausgewählte laden' startet update_core.audio_sync
    mit den gewaehlten Praefixen -- additiv, Loeschen nur innerhalb der gewaehlten
    Teilmengen (Lizenz-Rueckruf). 'Lokalen Bestand neu prüfen' loest den teuren
    Voll-Scan aus (heilt Hand-Aenderungen am Bestand).

    nach_schliessen_cb wird beim Schliessen genau einmal gerufen (gibt die
    Hauptfenster-Knoepfe frei -- fenster-uebergreifende Aktionssperre)."""

    def __init__(self, parent, nach_schliessen_cb=None):
        self._nach_schliessen_cb = nach_schliessen_cb
        self._schliessen_gemeldet = False
        self._aktiv = False            # laeuft gerade ein Lauf im Fenster?

        self._win = tk.Toplevel(parent)
        self._win.title("Audios verwalten")
        self._win.geometry("700x620")
        self._win.protocol("WM_DELETE_WINDOW", self._schliessen)

        tk.Label(self._win, text="Audio-Teilmengen wählen",
                 font=("", 12, "bold")).pack(pady=(12, 2))
        tk.Label(self._win, justify="left", wraplength=600,
                 text="Angehakte Teilmengen werden geladen (nur was lokal fehlt).").pack(
                 padx=14, pady=(0, 6), anchor="w")

        # --- Auswahl-Liste (scrollbar) ---
        rahmen = tk.Frame(self._win)
        rahmen.pack(fill="both", expand=True, padx=12, pady=4)
        self._canvas = tk.Canvas(rahmen, highlightthickness=0)
        sb = tk.Scrollbar(rahmen, orient="vertical", command=self._canvas.yview)
        self._liste = tk.Frame(self._canvas)
        self._liste.bind("<Configure>", lambda e: self._canvas.configure(
            scrollregion=self._canvas.bbox("all")))
        self._canvas.create_window((0, 0), window=self._liste, anchor="nw")
        self._canvas.configure(yscrollcommand=sb.set)
        self._canvas.pack(side="left", fill="both", expand=True)
        sb.pack(side="right", fill="y")

        # Checkbox-Zustand + Label-Widgets je Praefix (fuer Groessen-Nachtrag).
        self._var = {}              # praefix -> tk.BooleanVar
        self._eltern = {}           # eltern-praefix -> [kind-praefix, ...]
        self._groessen_lbl = {}     # praefix -> (Groesse-Label, Status-Label)
        self._del_btn = {}          # praefix -> Muelleimer-Knopf
        self._label = {}            # praefix -> lesbares Label (fuer Dialoge)
        self._zeilen_bauen()

        # --- Summenzeile + Warnhinweis ---
        self._lbl_summe = tk.Label(self._win, text="Auswahl: 0 Teilmengen · 0 B zu laden",
                                   font=("", 10, "bold"), justify="left", wraplength=660)
        self._lbl_summe.pack(anchor="w", padx=14, pady=(4, 0))
        # Freier Platz immer sichtbar (nicht nur im Fehlerfall) -- auch bevor
        # etwas angehakt ist; wird in _summe_aktualisieren mitgepflegt und hier
        # schon initial gesetzt (braucht die Soll-Liste nicht).
        self._lbl_platz = tk.Label(self._win, text="", fg="#555")
        self._lbl_platz.pack(anchor="w", padx=14)
        self._platz_anzeigen()
        tk.Label(self._win, text="⚠ Der Download kann je nach Auswahl lange dauern.",
                 fg="#a60").pack(anchor="w", padx=14)

        self._progress = ttk.Progressbar(self._win, length=600, mode="determinate")
        # eingeblendet nur waehrend eines Laufs

        # --- Knopfleiste ---
        leiste = tk.Frame(self._win)
        leiste.pack(side="bottom", pady=8)
        self._btn_laden = tk.Button(leiste, text="Ausgewählte laden",
                                    command=self._laden, state="disabled")
        self._btn_laden.pack(side="left", padx=6)
        self._btn_rescan = tk.Button(leiste, text="Lokalen Bestand neu prüfen",
                                     command=self._rescan)
        self._btn_rescan.pack(side="left", padx=6)
        self._btn_schliessen = tk.Button(leiste, text="Schließen", command=self._schliessen)
        self._btn_schliessen.pack(side="left", padx=6)

        # --- Meldungen ---
        mf = tk.LabelFrame(self._win, text="Meldungen", padx=4, pady=4)
        mf.pack(side="bottom", fill="x", padx=10, pady=4)
        self._txt = tk.Text(mf, height=5, wrap="word")
        self._txt.pack(side="left", fill="both", expand=True)
        msb = tk.Scrollbar(mf, command=self._txt.yview)
        msb.pack(side="right", fill="y")
        self._txt.config(yscrollcommand=msb.set)
        self._txt.tag_config("fehler", foreground="#c00")

        # Groessen/Rest asynchron laden (Soll-Liste holen + vorhanden.txt lesen).
        self._log("Lade Größenübersicht ...")
        threading.Thread(target=self._groessen_laden_bg, daemon=True).start()

    # -------- Zeilenaufbau

    def _zeilen_bauen(self):
        """Baut die Checkbox-Zeilen aus AUDIO_TEILMENGEN -- flache Ordner + den
        aufgeklappten M-AILABS-Block mit Sprecher-Kindern."""
        for praefix, label, beschr, kinder in AUDIO_TEILMENGEN:
            self._zeile(self._liste, praefix, label, beschr, einzug=0,
                        ist_eltern=bool(kinder))
            if kinder:
                self._eltern[praefix] = [k[0] for k in kinder]
                for kpraefix, klabel, kbeschr, _ in kinder:
                    self._zeile(self._liste, kpraefix, klabel, kbeschr, einzug=28,
                                ist_eltern=False)

    def _zeile(self, parent, praefix, label, beschr, einzug, ist_eltern):
        var = tk.BooleanVar(value=False)
        self._var[praefix] = var
        self._label[praefix] = label
        zeile = tk.Frame(parent)
        zeile.pack(fill="x", anchor="w")
        cb = tk.Checkbutton(zeile, text=label, variable=var,
                            command=lambda p=praefix: self._auswahl_geaendert(p))
        cb.pack(side="left", padx=(einzug, 0))
        if beschr:
            tk.Label(zeile, text="– " + beschr, fg="#666").pack(side="left", padx=(2, 0))
        # Rechtsbuendig zwei Labels: Status (Haekchen bzw. "zu laden") und davor
        # die Groesse. Zwei Labels, weil 'vollstaendig' und 'zu laden' verschiedene
        # Farben tragen (Variante A: Vollstaendiges tritt grau zurueck, der zu
        # ladende Rest sticht blau-fett hervor). Text folgt nach _groessen_laden_bg.
        # Muelleimer-Knopf ganz rechts: loescht die lokal vorhandenen Dateien
        # dieser Teilmenge (Platz schaffen). Nur aktiv, wenn lokal etwas vorliegt
        # -- Zustand setzt _groessen_anzeigen (soll - rest > 0). Bei M-AILABS-
        # Eltern loescht er alle Sprecher-Kinder.
        btn_del = tk.Button(zeile, text="🗑", width=2,
                            command=lambda p=praefix: self._loeschen_anfrage(p),
                            state="disabled")
        btn_del.pack(side="right", padx=(6, 8))
        self._del_btn[praefix] = btn_del
        lbl_status = tk.Label(zeile, text="")
        lbl_status.pack(side="right", padx=(0, 8))
        lbl_groesse = tk.Label(zeile, text="…", fg="#333")
        lbl_groesse.pack(side="right", padx=(0, 6))
        self._groessen_lbl[praefix] = (lbl_groesse, lbl_status)

    # -------- Groessen/Rest

    def _alle_gruppen(self):
        """(schluessel, praefix)-Liste fuer audio_gruppen: jede Teilmenge und
        jedes M-AILABS-Kind. Die Kind-Praefixe stehen VOR dem groben 'M-AILABS/'
        -- so ordnet audio_gruppen jeden Pfad dem spezifischsten Kind zu, und
        das Eltern-'M-AILABS/' bekommt (korrekt) 0 direkte Treffer."""
        kinder = []
        eltern = []
        for praefix, _, _, ks in AUDIO_TEILMENGEN:
            if ks:
                for kp, _, _, _ in ks:
                    kinder.append((kp, kp))
                eltern.append((praefix, praefix))
            else:
                eltern.append((praefix, praefix))
        return kinder + eltern

    def _groessen_laden_bg(self):
        try:
            self._gruppen = update_core.audio_gruppen(
                OPUS_ROOT, WEBSPACE, self._alle_gruppen())
        except Exception as e:
            self._log("Größenübersicht nicht ladbar: " + str(e), fehler=True)
            return
        self._ui(self._groessen_anzeigen)

    def _eltern_summe(self, eltern_praefix):
        """Summiert (soll_b, soll_n, rest_b, rest_n) ueber die Kinder eines
        Eltern-Praefix -- das Eltern-'M-AILABS/' selbst hat keine direkten
        Treffer, seine Zahl ist die Summe der Sprecher."""
        sb = sn = rb = rn = 0
        for kp in self._eltern.get(eltern_praefix, []):
            g = self._gruppen.get(kp)
            if g:
                sb += g[0]; sn += g[1]; rb += g[2]; rn += g[3]
        return sb, sn, rb, rn

    def _zeile_fuellen(self, lbl_groesse, lbl_status, soll_b, rest_b):
        """Variante A: vollstaendig -> gruenes Haekchen + alles grau (tritt
        zurueck); unvollstaendig -> Groesse neutral, 'zu laden' blau-fett
        (sticht hervor, lenkt den Blick auf die offenen Zeilen)."""
        if rest_b <= 0:
            lbl_groesse.config(text=_menschlich_bytes(soll_b), fg="#999")
            lbl_status.config(text="✓ vollständig", fg="#2a8a2a",
                              font=("", 9))
        else:
            lbl_groesse.config(text=_menschlich_bytes(soll_b), fg="#333")
            lbl_status.config(text="· " + _menschlich_bytes(rest_b) + " zu laden",
                              fg="#1565c0", font=("", 9, "bold"))

    def _groessen_anzeigen(self):
        for praefix, (lbl_groesse, lbl_status) in self._groessen_lbl.items():
            if praefix in self._eltern:
                sb, _, rb, _ = self._eltern_summe(praefix)
            else:
                g = self._gruppen.get(praefix, (0, 0, 0, 0))
                sb, rb = g[0], g[2]
            self._zeile_fuellen(lbl_groesse, lbl_status, sb, rb)
            # Muelleimer nur aktiv, wenn lokal etwas vorliegt (soll - rest > 0),
            # kein Lauf aktiv, und die Teilmenge NICHT geschuetzt ist (Hagermann
            # darf nie geloescht werden -- fuer den CImbel-Sprachtest noetig).
            vorhanden_b = sb - rb
            darf = (vorhanden_b > 0 and not self._aktiv
                    and not update_core._ist_geschuetzt(praefix))
            self._del_btn[praefix].config(state="normal" if darf else "disabled")
        self._log("Größenübersicht geladen.")
        self._summe_aktualisieren()

    # -------- Auswahl-Logik

    def _auswahl_geaendert(self, praefix):
        # Eltern-Haken schaltet alle Kinder mit; Kind-Haken laesst Eltern in Ruhe
        # (Eltern-Checkbox ist nur Sammel-Schalter, kein eigener Download-Praefix).
        if praefix in self._eltern:
            wert = self._var[praefix].get()
            for kp in self._eltern[praefix]:
                self._var[kp].set(wert)
        self._summe_aktualisieren()

    def _gewaehlte_praefixe(self):
        """Download-Praefixe aus der Auswahl: jede angehakte EINFACHE Teilmenge
        und jedes angehakte M-AILABS-Kind. Der Eltern-'M-AILABS/'-Haken zaehlt
        NICHT direkt (er hat die Kinder schon mitgeschaltet) -- sonst wuerde der
        grobe Praefix zusaetzlich alles unter M-AILABS/ matchen."""
        praefixe = []
        for praefix in self._var:
            if praefix in self._eltern:
                continue                      # Sammel-Schalter, kein Praefix
            if self._var[praefix].get():
                praefixe.append(praefix)
        return praefixe

    def _freier_platz(self):
        """Freier Platz auf der Opus-Partition (Bytes). -1, wenn nicht
        ermittelbar (dann keine Platz-Sperre -- der Download laeuft ins
        Dateisystem-Limit, besser als faelschlich sperren)."""
        try:
            return shutil.disk_usage(OPUS_ROOT).free
        except OSError:
            return -1

    def _platz_anzeigen(self, frei=None):
        """Setzt die 'Freier Platz'-Zeile (immer sichtbar). frei=None ->
        selbst ermitteln (initial, vor dem Soll-Laden)."""
        if frei is None:
            frei = self._freier_platz()
        if frei < 0:
            self._lbl_platz.config(text="Freier Platz: nicht ermittelbar")
        else:
            self._lbl_platz.config(
                text="Freier Platz: " + _menschlich_bytes(frei) +
                     " (davon " + _menschlich_bytes(AUDIO_PLATZ_RESERVE) +
                     " Reserve)")

    def _summe_aktualisieren(self):
        if not hasattr(self, "_gruppen"):
            return
        praefixe = self._gewaehlte_praefixe()
        rest_b = 0
        for p in praefixe:
            g = self._gruppen.get(p)
            if g:
                rest_b += g[2]

        # Live-Platzpruefung: der zu ladende REST (Vorhandenes belegt den Platz
        # schon) plus die harte Reserve muss in den freien Platz passen. Passt es
        # nicht -> Summenzeile rot, Laden gesperrt (Warnung schon beim Anhaken).
        # Nur relevant, wenn ueberhaupt etwas zu laden ist (rest_b > 0) -- bei
        # Rest 0 wird nichts geschrieben, also keine Reserve-Sperre.
        frei = self._freier_platz()
        passt = (rest_b == 0) or frei < 0 or (rest_b + AUDIO_PLATZ_RESERVE) <= frei
        basis = ("Auswahl: " + str(len(praefixe)) + " Teilmengen · " +
                 _menschlich_bytes(rest_b) + " zu laden")
        if passt:
            self._lbl_summe.config(text=basis, fg="#000")
        else:
            self._lbl_summe.config(
                text=basis + "  — zu wenig Platz (inkl. " +
                     _menschlich_bytes(AUDIO_PLATZ_RESERVE) + " Reserve nötig: " +
                     _menschlich_bytes(rest_b + AUDIO_PLATZ_RESERVE) + ")",
                fg="#c00")

        # Freier Platz generell anzeigen (immer, unabhaengig von der Auswahl).
        self._platz_anzeigen(frei)

        # Laden-Knopf nur, wenn etwas gewaehlt ist, der Platz reicht und kein
        # Lauf aktiv ist.
        if praefixe and passt and not self._aktiv:
            self._btn_laden.config(state="normal")
        else:
            self._btn_laden.config(state="disabled")

    # -------- Nebenlaeufigkeit / Log (eigenes Fenster)

    def _ui(self, fn):
        self._win.after(0, fn)

    def _log(self, text, fehler=False):
        def _append():
            self._txt.insert("end", text + "\n", "fehler" if fehler else "")
            self._txt.see("end")
        self._ui(_append)

    def _lauf_beginnen(self):
        self._aktiv = True
        for b in (self._btn_laden, self._btn_rescan):
            b.config(state="disabled")
        for b in self._del_btn.values():
            b.config(state="disabled")

    def _lauf_beenden(self):
        self._aktiv = False
        self._btn_rescan.config(state="normal")
        self._summe_aktualisieren()       # setzt Laden-Knopf nach Auswahl
        # Die Muelleimer-Knoepfe setzt _groessen_anzeigen nach dem folgenden
        # _groessen_laden_bg neu (aus dem aktualisierten lokalen Bestand).

    # -------- Aktionen

    def _laden(self):
        praefixe = self._gewaehlte_praefixe()
        if not praefixe:
            return
        self._lauf_beginnen()
        self._progress.config(mode="determinate", value=0)
        self._progress.pack(pady=4)
        threading.Thread(target=self._laden_bg, args=(praefixe,), daemon=True).start()

    def _laden_bg(self, praefixe):
        def fortschritt(i, n, pfad):
            self._ui(lambda: self._progress.config(maximum=max(1, n), value=i))
        self._log("Lade ausgewählte Teilmengen ...")
        try:
            geladen, geloescht = update_core.audio_sync(
                OPUS_ROOT, WEBSPACE, fortschritt, praefixe)
        except update_core.SyncAbbruch as e:
            self._log("Abbruch (Sicherung): " + str(e), fehler=True)
            self._ui(self._progress.pack_forget)
            self._ui(self._lauf_beenden)
            return
        except ValueError as e:
            self._log("Fehler: " + str(e), fehler=True)
            self._ui(self._progress.pack_forget)
            self._ui(self._lauf_beenden)
            return
        self._ui(self._progress.pack_forget)
        self._log("Fertig: " + str(geladen) + " geladen, " +
                  str(geloescht) + " entfernt.")
        # Bestand hat sich geaendert -> Groessen/Rest neu (kein Scan: liest die
        # frisch fortgeschriebene vorhanden.txt).
        self._ui(self._lauf_beenden)
        threading.Thread(target=self._groessen_laden_bg, daemon=True).start()

    def _rescan(self):
        self._lauf_beginnen()
        self._log("Prüfe den lokalen Bestand (vollständiger Scan, kann auf dem "
                  "USB-Stick dauern) ...")
        threading.Thread(target=self._rescan_bg, daemon=True).start()

    def _rescan_bg(self):
        try:
            update_core._schreibe_vorhanden(OPUS_ROOT)
        except Exception as e:
            self._log("Scan fehlgeschlagen: " + str(e), fehler=True)
            self._ui(self._lauf_beenden)
            return
        self._log("Bestand neu erfasst.")
        self._ui(self._lauf_beenden)
        threading.Thread(target=self._groessen_laden_bg, daemon=True).start()

    def _loeschen_anfrage(self, praefix):
        """Muelleimer-Knopf: fragt nach und loescht dann die lokal vorhandenen
        Dateien der Teilmenge (Platz schaffen). praefix loescht alles darunter --
        bei M-AILABS-Eltern also alle Sprecher-Kinder."""
        n, b = update_core.teilmenge_umfang(OPUS_ROOT, praefix)
        if n == 0:
            return                                # nichts lokal (Knopf sollte eh grau sein)
        label = self._label.get(praefix, praefix)
        if not messagebox.askyesno(
                "Teilmenge löschen",
                "„" + label + "“ lokal löschen?\n\n" +
                str(n) + " Dateien werden entfernt, " + _menschlich_bytes(b) +
                " werden frei.\n\nDie Dateien können später wieder "
                "heruntergeladen werden.",
                icon="warning", parent=self._win):
            return
        self._lauf_beginnen()
        self._log("Lösche „" + label + "“ ...")
        threading.Thread(target=self._loeschen_bg, args=(praefix, label),
                         daemon=True).start()

    def _loeschen_bg(self, praefix, label):
        try:
            geloescht, frei = update_core.teilmenge_loeschen(OPUS_ROOT, praefix)
        except Exception as e:
            self._log("Löschen fehlgeschlagen: " + str(e), fehler=True)
            self._ui(self._lauf_beenden)
            return
        self._log("„" + label + "“ gelöscht: " + str(geloescht) +
                  " Dateien, " + _menschlich_bytes(frei) + " frei.")
        self._ui(self._lauf_beenden)
        # Groessen/Rest + Muelleimer-Zustaende + Platzzeile neu (liest die frisch
        # fortgeschriebene vorhanden.txt, kein Scan).
        threading.Thread(target=self._groessen_laden_bg, daemon=True).start()

    def _schliessen(self):
        # Waehrend eines laufenden Downloads/Scans nicht schliessen (wie das
        # Hauptfenster: keine Aktion mitten im Schreiben abbrechen).
        if self._aktiv:
            self._log("Bitte warten, bis der laufende Vorgang fertig ist.",
                      fehler=True)
            return
        if self._nach_schliessen_cb and not self._schliessen_gemeldet:
            self._schliessen_gemeldet = True
            self._nach_schliessen_cb()
        self._win.destroy()


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
