# vboxclient-Autostart auf VM beschränken (einmalig beim Image-Bau)

Diese Dateien sorgen dafür, dass der VirtualBox-Gast-Dienst `VBoxClient-all`
**nur in der VM** startet. Auf echter Hardware (ausgeliefertes Image) entfällt
damit die Login-Meldung „VirtualBox User Session Services kann nicht laufen".
In der Master-VM bleibt der Komfort (Auflösung/Clipboard) erhalten.

Einzurichten **einmal auf dem Master**, bevor das Auslieferungs-Image gebaut
wird.

## Problem

Die Guest Additions installieren `/etc/xdg/autostart/vboxclient.desktop` mit
`Exec=/usr/bin/VBoxClient-all`. XFCE arbeitet diese Datei bei jedem Login ab —
auch auf echter Hardware, wo kein VirtualBox-Host existiert. Die Datei gehört
dem Paket `virtualbox-guest-utils`; ein `apt upgrade` überschreibt eine von
Hand geänderte System-Variante wieder. Darum **nicht** das System-File
patchen, sondern per XDG-Regel ein gleichnamiges **User-Override** darüber
legen.

## Was wohin gehört

Die Dateinamen sind **Repo und Ziel identisch** — beim Kopieren wird nichts
umbenannt (das verhindert divergierende Namen).

| Datei (Repo, in `stick-files/vboxclient-vm-only/`) | Ziel auf dem Stick | Warum dorthin |
|---|---|---|
| `vboxclient-vm-guard` | `/usr/local/bin/vboxclient-vm-guard` | **ext4-Systempartition**, systemweit, root-eigen (apt-fest). Prüft per `systemd-detect-virt` und startet `VBoxClient-all` nur in der VM. |
| `vboxclient.desktop` | `~/.config/autostart/vboxclient.desktop` | **User-Autostart**; sticht per XDG-Regel das gleichnamige Paket-File unter `/etc/xdg/autostart/`. Liegt im home → wandert ins `skel` (Reset-fest) und wird von `apt` nicht angefasst. |

Die Repo-Kopien sind die **Pflege-Quelle** (versioniert). Sie laufen nicht von
dort — der Image-Bau kopiert sie namensgleich an die Zielorte oben.

## Einrichten (in der Master-VM)

```
sudo cp vboxclient-vm-guard /usr/local/bin/vboxclient-vm-guard
sudo chmod 755 /usr/local/bin/vboxclient-vm-guard
mkdir -p ~/.config/autostart
cp vboxclient.desktop ~/.config/autostart/vboxclient.desktop
```

## Prüfen

- **In der VM** (jetzt): `systemd-detect-virt` liefert `oracle`; nach Ab-/
  Anmelden startet `VBoxClient-all` normal (Auflösung passt sich an).
  Direkttest: `/usr/local/bin/vboxclient-vm-guard &` sollte den Dienst starten
  (`pgrep -f VBoxClient` zeigt Prozesse).
- **Trockentest des Gates ohne VM-Boot:** `systemd-detect-virt` zeigt in der VM
  `oracle` → der Wrapper geht in den `exec`-Zweig. Auf echter Hardware liefert
  es `none` → der Wrapper endet still mit Exit 0, kein VBoxClient-Start, keine
  Meldung.

## Werks-Kopie nachziehen

Das User-Override liegt im home → beim nächsten `skel-erzeugen`
(`reset_core.py skel-erzeugen`, vor Auslieferung) wandert es automatisch in
die Werks-Kopie `/usr/local/share/cimbel-skel/`. Der systemweite Wrapper unter
`/usr/local/bin/` ist nicht Teil des `skel` (das `skel` kopiert nur das home)
und muss beim Image-Bau direkt installiert bleiben — der Reset fasst ihn
ohnehin nicht an.
