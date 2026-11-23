# NTFS-Datenpartition crash-sicher mounten (einmalig auf dem Master)

Die NTFS-Datenpartition (`/mnt/daten`, Label `cimbeldaten`, UUID
`4227A80E05C9078A`) wird über `/etc/fstab` mit dem Kernel-Treiber `ntfs3`
gemountet. Beim Standard-Mount (`defaults`, also mit verzögertem Schreib-Cache)
kann ein **harter Abschaltvorgang** (Stromausfall, VM-Absturz, Stick-Ziehen) die
Master File Table zerschießen — die Partition erscheint danach leer, obwohl die
Daten noch da sind (`$MFTMirr does not match $MFT` beim Mount-Versuch).

**Gegenmaßnahme: synchrones Mounten** (`sync`). Jeder Schreibvorgang geht sofort
auf die Platte statt in einen RAM-Puffer, der beim Absturz verlorengeht.

## fstab-Zeile

```
UUID=4227A80E05C9078A  /mnt/daten  ntfs3  defaults,uid=1000,gid=1000,umask=000,nofail,noatime,sync  0  0
```

Gegenüber dem ungehärteten Mount kommen zwei Optionen hinzu:

- **`sync`** — der eigentliche Schutz: synchrones Schreiben, kein verzögerter
  Cache. Schließt die Lücke, die zum MFT-Schaden führt.
- **`noatime`** — ersetzt das default-`relatime`: bloßes Lesen erzeugt keine
  atime-Schreibvorgänge mehr. Ohne das würde `sync` jeden atime-Write sofort
  durchreichen (unnötige Last).

## Grenzen (ehrlich)

- `sync` verhindert **verzögerte** Writes — genau den häufigsten Absturz-Schaden.
  Es ist **kein** Journaling; `ntfs3` bedient das NTFS-Journal nur eingeschränkt.
  100 % Crash-Sicherheit gibt es bei NTFS unter Linux nicht, aber `sync` schließt
  die mit Abstand größte Lücke.
- **Preis:** langsameres Schreiben, spürbar vor allem bei vielen kleinen Dateien
  (git-Clone/-pull in `cimbel-intern/git`, großer Opus-Download). Bei normaler
  Stick-Nutzung (gelegentlich Dokumente/Messdaten speichern) kaum merkbar.
- Kompromiss-Alternative, falls `sync` beim Download/git zu lahm ist: statt
  `sync` die Option `commit=5` — Cache wird spätestens alle 5 s auf Platte
  geschrieben, Schadensfenster dann max. 5 s statt voller Sicherheit.

## Einrichtung (als root auf dem Master)

```
# 1. fstab sichern
sudo cp /etc/fstab /etc/fstab.bak-vor-sync

# 2. /mnt/daten-Zeile um noatime,sync ergänzen (trifft genau die Datenpartition)
sudo sed -i 's#\(UUID=4227A80E05C9078A  */mnt/daten  *ntfs3  *\)defaults,uid=1000,gid=1000,umask=000,nofail#\1defaults,uid=1000,gid=1000,umask=000,nofail,noatime,sync#' /etc/fstab

# 3. prüfen
grep daten /etc/fstab      # -> ...,nofail,noatime,sync  0  0

# 4. ohne Reboot neu mounten und verifizieren
sudo systemctl daemon-reload
sudo umount /mnt/daten && sudo mount /mnt/daten
mount | grep daten        # -> in der Ausgabe muss "sync" auftauchen
```

Scheitert `umount` mit „target is busy", stattdessen beim nächsten Neustart
greifen lassen (fstab-Änderung wirkt ab dem nächsten Boot).

## Datenrettung, falls es doch einmal passiert

Ist die Partition nach einem Absturz „leer" (`$MFTMirr does not match $MFT`) und
es existiert ein sauberes Image/Backup der Partition: Partition-Offsets in Image
und Ziel vergleichen (müssen bit-identisch liegen), aktuellen Zustand sichern,
dann `ntfsclone --overwrite <ZIEL> <QUELLE>` — kopiert dateisystembewusst nur die
belegten Blöcke und baut ein konsistentes NTFS.
