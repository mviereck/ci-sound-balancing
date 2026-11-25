# NTFS crash-sicher mounten: ntfs-3g statt ntfs3 (einmalig auf dem Master)

Der Kernel-Treiber **`ntfs3`** (Kernel 6.12) hat in diesem Projekt **ohne
erkennbaren Anlass** Datenkorruption verursacht — auch im normalen VM-Betrieb,
nicht nur beim harten Abziehen. Das deckt sich mit vielfach dokumentierten
`ntfs3`-Fehlerberichten (spontaner Datenverlust). **Gegenmaßnahme: Umstieg auf
`ntfs-3g`** (Tuxera, FUSE-Userspace-Treiber) — langsamer, aber über ~15 Jahre
als stabil beleumundet. Kein Formatwechsel: derselbe NTFS-Datenbestand, nur ein
anderer Treiber.

Der Treiber wird an **zwei** Stellen gewählt — beide müssen umgestellt werden:

1. **`/etc/fstab`** — für die fest gemountete Datenpartition `/mnt/daten`.
2. **`/etc/udisks2/mount_options.conf`** — für alle vom Desktop-Automounter
   (udisks2) gemounteten NTFS-Volumes, insbesondere **interne Windows-Platten**,
   die der Nutzer im gebooteten Stick-Linux im Dateimanager öffnet. Die fstab
   greift dort **nicht**.

## 1. Datenpartition /mnt/daten (fstab)

Die NTFS-Datenpartition (Label `cimbeldaten`, UUID `4227A80E05C9078A`) wird über
`/etc/fstab` gemountet — jetzt mit dem Treiber `ntfs-3g` statt `ntfs3`. **Der
Treiberwechsel selbst ist die Maßnahme** gegen die beobachtete Korruption, denn
die trat im normalen Betrieb ohne harten Abschaltvorgang auf und ist auf `ntfs3`
zurückzuführen.

### fstab-Zeile

```
UUID=4227A80E05C9078A  /mnt/daten  ntfs-3g  defaults,uid=1000,gid=1000,umask=000,nofail,noatime  0  0
```

- **`noatime`** — bloßes Lesen erzeugt keine atime-Schreibvorgänge.
- **`nofail`** — ein nicht mountbares Volume blockiert den Boot nicht.

**Bewusst ohne `sync`.** `sync` (synchrones Durchschreiben, kein verzögerter
Cache) schützt nur gegen den **harten Abzug / Stromverlust** — ein hier als
unwahrscheinlich eingeschätztes Szenario — und kostet spürbar Schreibtempo
(git-pull, Opus-Download). Der eigentliche Schaden kam vom Treiber, nicht vom
Cache; darum wird auf `sync` verzichtet. Wer das Abzug-Risiko dennoch absichern
will: `sync` (maximal, langsam) oder `cache=strict` (nur Metadaten synchron,
performance-schonender) an die Optionsliste anhängen. Das Kernel-`ntfs3`-only
`commit=5` gilt für `ntfs-3g` **nicht**.

## 2. Interne Windows-Platten (udisks2)

Öffnet der Nutzer im gebooteten Stick-Linux eine interne NTFS-Platte des
Rechners, mountet **udisks2** sie per Default mit `ntfs3`. Datei
`/etc/udisks2/mount_options.conf` zwingt udisks2 systemweit auf `ntfs-3g`:

```
[defaults]
ntfs_drivers=ntfs
```

`ntfs_drivers` (Plural — `ntfs_driver` ohne `s` wirkt **nicht**) ist die
Treiber-Präferenzliste; Default `ntfs3,ntfs`. Der Wert `ntfs` (ohne `3`) ist
udisks' interner Name für `ntfs-3g`. Nur `ntfs` setzen → alle NTFS-Automounts
laufen über `ntfs-3g`. Reversibel durch Löschen der Datei. Pflege-Quelle im
Repo: `stick-files/firstboot_grow/mount_options.conf` (namensgleich).

## Grenzen (ehrlich)

- Der Treiberwechsel adressiert die beobachtete Korruption (ein `ntfs3`-Bug),
  **nicht** das Abzug-/Stromverlust-Risiko. Gegen den harten Abzug hilft nur
  `sync`/`cache=strict` (s. o.), hier bewusst nicht gesetzt. Kein Journaling:
  auch `ntfs-3g` bedient das NTFS-Journal nur eingeschränkt — 100 %
  Crash-Sicherheit gibt es bei NTFS unter Linux nicht.
- **Preis von `ntfs-3g`:** FUSE-Userspace ist generell langsamer als der
  Kernel-Treiber. Bei normaler Stick-Nutzung (gelegentlich Dokumente/Messdaten,
  Audio lesen) kaum merkbar; spürbar nur bei vielen kleinen Dateien (git-pull in
  `cimbel-intern/git`, großer Opus-Download). Die Stabilität ist das wert.

## Einrichtung (als root auf dem Master)

```
# --- A. Datenpartition /mnt/daten: Treiber ntfs3 -> ntfs-3g ----------------

# 1. fstab sichern
sudo cp /etc/fstab /etc/fstab.bak-vor-ntfs3g

# 2. /mnt/daten-Zeile: Treiber-Feld von ntfs3 auf ntfs-3g. Von Hand prüfen ist
#    hier sicherer als ein sed:
sudoedit /etc/fstab
# Zielzeile:
# UUID=4227A80E05C9078A  /mnt/daten  ntfs-3g  defaults,uid=1000,gid=1000,umask=000,nofail,noatime  0  0

# 3. prüfen
grep daten /etc/fstab      # -> ...ntfs-3g...,nofail,noatime  0  0

# 4. ohne Reboot neu mounten und verifizieren
sudo systemctl daemon-reload
sudo umount /mnt/daten && sudo mount /mnt/daten
mount | grep daten        # -> "fuseblk" bestätigt, dass ntfs-3g (FUSE) greift

# --- B. udisks2: interne Windows-Platten ebenfalls über ntfs-3g -------------

# Repo-Muster namensgleich an den Zielort kopieren:
SRC=/mnt/daten/cimbel-intern/git/ci-sound-balancing/stick-files/firstboot_grow
sudo cp "$SRC/mount_options.conf" /etc/udisks2/mount_options.conf

# wirkt ohne Neustart von udisks2:
sudo systemctl restart udisks2
```

Scheitert `umount` mit „target is busy", stattdessen beim nächsten Neustart
greifen lassen (fstab-Änderung wirkt ab dem nächsten Boot).

## Datenrettung, falls es doch einmal passiert

Ist die Partition nach einem Absturz „leer" (`$MFTMirr does not match $MFT`) und
es existiert ein sauberes Image/Backup der Partition: Partition-Offsets in Image
und Ziel vergleichen (müssen bit-identisch liegen), aktuellen Zustand sichern,
dann `ntfsclone --overwrite <ZIEL> <QUELLE>` — kopiert dateisystembewusst nur die
belegten Blöcke und baut ein konsistentes NTFS.
