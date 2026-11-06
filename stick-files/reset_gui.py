#!/usr/bin/env python3
"""Persoenliche Daten loeschen -- grafische Oberflaeche (Tkinter).

Setzt das Benutzerverzeichnis auf den Werkszustand zurueck: leert
/home/cimbel link-sicher, befuellt es aus der Werks-Kopie und leert den
Download-Ordner. Laeuft vollstaendig als User (kein root/pkexec). Machart
wie der Stick-Updater (updater_gui.py): Log statt Statuszeile, rote Fehler,
Schliessen nur ueber den Beenden-Knopf, Arbeit im Hintergrund-Thread.

Die eigentliche Logik steckt im Kern reset_core.py (auch per CLI testbar,
inkl. 'trockenlauf' als Sicherheitsnachweis).
"""
import threading
import tkinter as tk
from tkinter import messagebox

import reset_core


# Erklaerungstext (bewusst in der GUI, nicht im Kern -- Nutzer-Text).
ERKLAERUNG = (
    "Dieser Knopf setzt den Stick auf den Auslieferungszustand zurueck "
    "(„Werkszustand“).\n\n"
    "GELOESCHT wird:\n"
    "• alle persoenlichen Daten im Benutzerverzeichnis, inkl. aller "
    "Browserdaten (Verlauf, Lesezeichen, gespeicherte Seiten),\n"
    "• der gesamte Inhalt des Download-Ordners.\n\n"
    "ERHALTEN bleibt:\n"
    "• CImbel selbst und alle Programm-Updates,\n"
    "• die heruntergeladenen Audios (Opus-Bestand),\n"
    "• alle System-Aenderungen.\n\n"
    "Wichtiger Hinweis zum Datenschutz: Dies ist ein EINFACHES Loeschen, "
    "NICHT forensisch sicher. Mit Spezialwerkzeugen koennten geloeschte "
    "Daten teilweise wiederhergestellt werden. Fuer absoluten "
    "Privatsphaere-Schutz genuegt dieses Loeschen nicht."
)

WARNUNG = (
    "Letzte Warnung:\n\n"
    "Alle persoenlichen Daten und der gesamte Download-Ordner werden jetzt "
    "geloescht. Messergebnisse, die nur im Download-Ordner liegen, gehen "
    "dabei UNWIEDERBRINGLICH verloren.\n\n"
    "Bitte wichtige Messergebnisse VORHER sichern (z.B. auf einen anderen "
    "USB-Stick oder per E-Mail).\n\n"
    "Jetzt wirklich auf Werkszustand zuruecksetzen?"
)


class ResetGUI:
    def __init__(self, root):
        self.root = root
        root.title("Persoenliche Daten loeschen")
        root.geometry("640x620")
        # Fenster-X abfangen: Schliessen nur ueber den Beenden-Knopf (wie
        # der Updater), damit kein Abbruch mitten im Loeschen einen halben
        # Zustand hinterlaesst.
        root.protocol("WM_DELETE_WINDOW", self._ignoriere_close)

        # --- Erklaerung oben ---
        lbl = tk.Label(root, text=ERKLAERUNG, justify="left", wraplength=600,
                       anchor="w")
        lbl.pack(fill="x", padx=12, pady=10)

        # --- Firefox-Hinweis (wird bei laufendem Firefox rot) ---
        self.lbl_firefox = tk.Label(root, text="", justify="left", wraplength=600,
                                     anchor="w", fg="#c00")
        self.lbl_firefox.pack(fill="x", padx=12)

        # --- Untere Leiste ZUERST (side="bottom"), damit die Knoepfe immer
        #     sichtbar bleiben und nicht vom wachsenden Log verdraengt werden.
        #     Von unten nach oben: Beenden, Kopieren, Zuruecksetzen.
        tk.Button(root, text="Beenden", command=root.destroy).pack(side="bottom", pady=8)
        tk.Button(root, text="Meldungen ins Clipboard kopieren",
                  command=self._log_kopieren).pack(side="bottom", pady=2)
        self.btn_reset = tk.Button(root, text="Auf Werkszustand zuruecksetzen",
                                   command=self._reset, state="disabled")
        self.btn_reset.pack(side="bottom", pady=6)

        # --- Log (selektierbar, scrollbar) fuellt den Rest ---
        self._log_frame = tk.LabelFrame(root, text="Meldungen", padx=4, pady=4)
        self._log_frame.pack(fill="both", expand=True, padx=12, pady=8)
        self.txt_log = tk.Text(self._log_frame, height=10, wrap="word")
        self.txt_log.pack(side="left", fill="both", expand=True)
        _sb = tk.Scrollbar(self._log_frame, command=self.txt_log.yview)
        _sb.pack(side="right", fill="y")
        self.txt_log.config(yscrollcommand=_sb.set)
        self.txt_log.tag_config("fehler", foreground="#c00")

        self._fehler_aufgetreten = False
        self._pruefe_firefox()

    # ------------------------------------------------- Nebenlaeufigkeit

    def _im_hintergrund(self, fn):
        threading.Thread(target=fn, daemon=True).start()

    def _ui(self, fn):
        """Im Tk-Thread ausfuehren."""
        self.root.after(0, fn)

    def _log(self, text, fehler=False):
        if fehler:
            self._fehler_aufgetreten = True
        def _append():
            if fehler:
                self.txt_log.insert("end", text + "\n", "fehler")
            else:
                self.txt_log.insert("end", text + "\n")
            self.txt_log.see("end")
        self._ui(_append)

    def _log_kopieren(self):
        inhalt = self.txt_log.get("1.0", "end").strip()
        self.root.clipboard_clear()
        self.root.clipboard_append(inhalt)
        # Tk leert das Clipboard beim Beenden -- update() erzwingt die
        # Uebergabe an den X-Server, damit der Inhalt Programmende ueberlebt.
        self.root.update()
        self._log("Meldungen ins Clipboard kopiert.")

    def _ignoriere_close(self):
        self._log("Zum Beenden bitte den Knopf 'Beenden' benutzen "
                  "(das Schliesskreuz ist absichtlich wirkungslos, damit kein "
                  "laufendes Zuruecksetzen unterbrochen wird).")

    # ------------------------------------------------- Firefox-Status

    def _pruefe_firefox(self):
        """Prueft (im Hintergrund, pgrep kann minimal haengen), ob Firefox
        laeuft. Laeuft er: Knopf gesperrt, roter Hinweis, erneute Pruefung
        angeboten. Laeuft er nicht: Knopf frei."""
        self._im_hintergrund(self._pruefe_firefox_bg)

    def _pruefe_firefox_bg(self):
        if reset_core.firefox_laeuft():
            self._ui(lambda: self.lbl_firefox.config(
                text="Firefox laeuft noch. Bitte schliessen Sie Firefox "
                     "vollstaendig und klicken Sie dann auf „Erneut pruefen“."))
            self._ui(lambda: self.btn_reset.config(
                text="Erneut pruefen", command=self._pruefe_firefox, state="normal"))
        else:
            self._ui(lambda: self.lbl_firefox.config(text=""))
            self._ui(lambda: self.btn_reset.config(
                text="Auf Werkszustand zuruecksetzen", command=self._reset,
                state="normal"))

    # ------------------------------------------------- Reset

    def _reset(self):
        # Bestaetigungs-Dialog mit Verlust-Warnung.
        if not messagebox.askyesno("Wirklich zuruecksetzen?", WARNUNG,
                                    icon="warning", default="no"):
            self._log("Abgebrochen -- es wurde nichts geloescht.")
            return
        self.btn_reset.config(state="disabled")
        self._im_hintergrund(self._reset_bg)

    def _reset_bg(self):
        try:
            reset_core.reset(protokoll=lambda t: self._log(t))
        except reset_core.ResetFehler as e:
            self._log(str(e), fehler=True)
            self._abschluss_fehler()
            # Nach einem Firefox-Abbruch wieder die Pruefung anbieten.
            self._ui(lambda: self.btn_reset.config(
                text="Erneut pruefen", command=self._pruefe_firefox, state="normal"))
            return
        except Exception as e:
            self._log("Unerwarteter Fehler: " + str(e), fehler=True)
            self._abschluss_fehler()
            self._ui(lambda: self.btn_reset.config(state="normal"))
            return
        if self._fehler_aufgetreten:
            self._abschluss_fehler()
        else:
            self._log("")
            self._log("Fertig: Der Stick ist auf den Werkszustand "
                      "zurueckgesetzt. Sie koennen das Fenster jetzt mit "
                      "„Beenden“ schliessen.")

    def _abschluss_fehler(self):
        self._log("Es sind Fehler aufgetreten (siehe oben). Mit "
                  "'Meldungen ins Clipboard kopieren' den Bericht sichern.",
                  fehler=True)


def main():
    root = tk.Tk()
    ResetGUI(root)
    root.mainloop()


if __name__ == "__main__":
    main()
