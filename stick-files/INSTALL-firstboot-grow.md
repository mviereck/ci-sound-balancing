# Erstboot-Vergrößerung einrichten (einmalig beim Image-Bau)

Diese Dateien sorgen dafür, dass sich die NTFS-Datenpartition beim **ersten
Boot** automatisch auf die volle Stickgröße vergrößert. Einzurichten **einmal
auf dem Master**, bevor das Auslieferungs-Image gebaut wird.

## Was wohin gehört

| Datei (Repo) | Ziel auf dem Stick | Warum dorthin |
|---|---|---|
| `stick-files/firstboot-grow.sh` | `/usr/local/sbin/cimbel-firstboot-grow.sh` | **ext4-Systempartition**, NICHT `/mnt/daten` — das Skript unmountet `/mnt/daten` und darf nicht auf der Partition liegen, die es aushängt. |
| `stick-files/cimbel-firstboot-grow.service` | `/etc/systemd/system/cimbel-firstboot-grow.service` | systemd-Unit-Verzeichnis. |

Die Kopien unter `stick-files/` sind die **Pflege-Quelle** (im Repo
versioniert). Sie laufen nicht von dort — der Image-Bau kopiert sie an die
Zielorte oben.

## Paket-Voraussetzung

`growpart` steckt im Paket **`cloud-guest-utils`**, `ntfsresize` in
**`ntfs-3g`**. Beide müssen im Image installiert sein:

```
sudo apt install cloud-guest-utils ntfs-3g
```

(`ntfs-3g` ist für die NTFS-Datenpartition ohnehin vorhanden; `growpart`
meist noch nicht — unbedingt mit aufnehmen.)

## Einrichtung (als root auf dem Master)

```
# 1. Skript auf die Systempartition kopieren und ausführbar machen
sudo cp /mnt/daten/cimbel-intern/git/ci-sound-balancing/stick-files/firstboot-grow.sh \
        /usr/local/sbin/cimbel-firstboot-grow.sh
sudo chmod 755 /usr/local/sbin/cimbel-firstboot-grow.sh

# 2. systemd-Unit kopieren
sudo cp /mnt/daten/cimbel-intern/git/ci-sound-balancing/stick-files/cimbel-firstboot-grow.service \
        /etc/systemd/system/cimbel-firstboot-grow.service

# 3. Dienst aktivieren (läuft beim nächsten Boot)
sudo systemctl daemon-reload
sudo systemctl enable cimbel-firstboot-grow.service
```

## WICHTIG vor dem Image-Bau: Marker entfernen

Der Grow setzt nach Erfolg den Marker `/var/lib/cimbel/firstboot-grow-done`.
Lief der Dienst auf dem **Master** schon einmal (z.B. beim Testen), muss der
Marker vor dem Image-Bau weg — sonst vergrößert sich beim Nutzer nichts:

```
sudo rm -f /var/lib/cimbel/firstboot-grow-done
sudo systemctl enable cimbel-firstboot-grow.service   # self-disable ggf. rückgängig
```

Prüfen, dass der Dienst aktiviert und der Marker weg ist:

```
systemctl is-enabled cimbel-firstboot-grow.service    # -> enabled
test -e /var/lib/cimbel/firstboot-grow-done && echo "MARKER DA (entfernen!)" || echo "kein Marker, gut"
```

## Vorab testen (ohne etwas zu verändern)

Trockenlauf — zeigt Zielpartition und ob/wie vergrößert würde, ändert nichts:

```
sudo bash /usr/local/sbin/cimbel-firstboot-grow.sh --trockenlauf
```

## Verhalten beim Nutzer

- Läuft **einmal**, unsichtbar, vor dem Desktop-Login.
- Vergrößert nur, wenn hinter der Datenpartition freier Platz ist (sonst
  No-Op → auf einem exakt passenden 32-GB-Stick passiert nichts).
- Danach: Marker gesetzt **und** Dienst self-disabled → kein erneuter Lauf.
- Fehlschlag blockiert den Boot nicht (Stick bleibt nutzbar, nur evtl. mit
  weniger Platz).

## Hinweis Windows

`ntfsresize` markiert das NTFS nach dem Vergrößern für einen Konsistenz-Check.
Unter Linux (ntfs3) unkritisch. Steckt der Nutzer den Stick **vor** dem ersten
Linux-Boot direkt in einen Windows-PC, könnte Windows einmalig `chkdsk` zeigen
— harmlos. Normalerweise bootet der Stick zuerst Linux, dann ist das erledigt.
