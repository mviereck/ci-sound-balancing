# CI Sound Balancing Tool

Dieses Tool dient Trägern con Cochlea Implantaten zur Prüfung ihres Gerätes.
Es können Messungen zu Elektrodenlautstärke und Frequenzunterschieden gemacht werden.

Ziel ist es, daß alle Elektroden sich gleich laut anhören ("loudness balancing"), sowie daß die Tonhöhen links und rechts als gleich hoch bzw. tief empfunden werden.

Dieser Ausgleich von Elektrodenlautstärke (je CI) und Tonhöhen (links/rechts) ist die Basis für angenehmes und möglichst natürliches Hören.

Audiologen haben gewöhnlich nicht genug Zeit, um diese Messungen in der gebotenen Gründlichkeit durchzuführen. Da hilft dieses Tool: Sie können die Messungen allein zu Hause durchführen, ohne jeden Zeitdruck.

Auf Basis dieser selbst ermittelten Meßdaten kann im integrierten Audioplayer eine simulierte Anpassung abgespielt werden. So können Sie vorab einschätzen, was für Sie am Besten klingt.

Zusätzlich zum reinen Ausgleich von Lautstärke und Tonhöhe können Sie halbautomatische Anpassungen zur Verbesserung von Sprachverständnis machen, oder z.B. Bässe oder Höhen betonen. Sie können die Wirkung Ihrer Anpasungen live hören, wenn Sie gleichzeitig Musik oder ein Hörbuch im Audioplayer laufen lassen.

Wenn Sie schließlich eine Anpassung gefunden haben, die Ihnen gut erscheint, können Sie die dafür nötigen Änderungen ausdrucken lassen und Ihrem Audiologen geben.

## Vorgehensweise:
### Lautsärke ausgleichen
#### Im Reiter *Implantat*: 
Grundsätzliche technische Angaben zu Ihrem CI.

 - Wählen Sie oben die die Seite *LINKS/RECHTS* aus, auf der Sie das CI tragen.
 - Tragen Sie mindestens Ihren CI Hersteller ein, sofern bekannt, auch Modell usw.
 - Markieren Sie deaktivierte Elektroden unter *STATUS* als *DEAKTIVIERT*.
 - Testen Sie den Ton für jede Elektrode. Auffällige Elektroden, z. B. mit starkem Rauschen, in *STATUS* markieren.
 - Idealerweise tragen Sie alle weiteren Ihnen bekannten Angaben und Werte ein, sofern bekannt. Sie können die Werte bei Ihrem Audiologen erfragen. Sie können das Tool aber auch ohne diese Werte nutzen.
 - Machen Sie alle Angaben auch für das andere Ohr. Auch *normalhörend* oder *schwerhörig* oder *taub* gegebenenfalls eintragen, wenn sie dort kein CI tragen.

#### Im Reiter *Messungen*
Vergleich der Lautstärken der Elektroden.
- Für die Seite(n) mit CI machen Sie zunächst nur die Messung *Elektrodenlautstärke*.
- In dieser Messung werden alle Elektroden paarweise miteinander verglichen, und Sie justieren mit den Pfeiltasten die Lautstärke, bis sich beide Seiten gleich laut anhören.
- Nutzen Sie möglichst Bluetooth zum Streamen.
- Stellen Sie die Laustärke auf gefühlt 3/4 ein, nicht leise, aber auch noch nicht unangenehm laut.
- Steuerung der Tests:
  - Justieren Sie mit den *Pfeiltasten* die Lautstärke. 
  - Mit der *Leertaste* Ton erneut abspielen.
  - Mit *Enter* bestätigen.
  - Optional: Anderen Ton zum Testen auswählen.
- Empfohlenes Vorgehen: 
  - Erst Testverfahren *Vollständig*.
  - Dann Testverfahren _Konvergenz_, gerne mehrfach.
  - Optional _Feintuning_ auswählen und nochmal Konvergenz ausführen.
  - Jeder Test kann jederzeit unterbrochen und später an gleicher Stelle weitergeführt werden.
  - Jeder Test kann beliebig oft wiederholt werden, um die Ergebnisse zu verfeinern.
 - Die Messungen _Stereo-Balance_ und _Frequenzabgleich_ zunächst auslassen.
 
#### Im Reiter *Messergebnisse*
Anzeige der errechneten Anpassung gemäß Ihrer Messungen.

 - Im Subreiter *Elektrodenlautstärke* sehen Sie die empfohlenen Veränderungen pro Elektrode dargestellt in einer Grafik.
 - Die Farben der Balken pro Elektrode deuten an, wie sicher das meßergebnis zu beurteilen ist:
   - *rot*: Ergebnis unsicher
   - *gelb*: Ergebnis brauchbar bis gut
   - *grün*: Sehr gutes Ergebnis, zuverlässig
 - Der Wert *Residuum* zeigt die Verläßlichkeit der Messung als mathematischen Wert. Ein *Residuum* <1 ist sehr gut und wird *grün* angezeigt.Das heißt, die Abweichung der Messungen liegt bei unter 1 dezibel.
 
#### Im Reiter *Player*
Spielen Sie eine Audiodatei ab, um die Auswirkung Ihrer Messungen zu simulieren. 
 - Der eingebaute Equalizer verändert den Ton annähernd so, wie er sich anhören würde, wenn der Audiologe Ihr CI gemäß Ihren Messungen neu einstellt.
 - Mit dem Ausgleich der Elektrodenlautstärke Ihres CI haben Sie eine wertvolle Grundlage geschaffen. Damit sollte sich bereits vieles klarer anhören als vorher.
 
#### Im Reiter *Kurven*

Im Reiter *Kurven* können Sie die Lautstärke aller Elektroden gemeinsam verändern. Dafür stehen verschiedene Kurvenberechnungen zur Verfügung.

 - Empfehlungen:
   - Lassen Sie eine Audiodatei im Player laufen. Nehmen Sie ein Hörbuch.
   - Aktivieren Sie *Sprache*. Ändern Sie die Einstellung mit den *Pfeiltasten hoch/runter* und hören Sie live, wie sich die Veränderung auf das Sprachverstehen auswirkt.
   - Deaktivieren Sie *Sprache* und aktivieren Sie *Sinus*. Lassen Sie Musik um Player laufen. Verändern Sie mit den *Pfeiltasten hoch/runter* den Wert und hören Sie live, wie sich Högen und Bässe verändern.
   - Deaktivieren Sie *Sinus* und probieren Sie auch anderen Kurven aus.
   - Finden Sie eine Kurve oder eine Kombination von Kurven, die Ihnen zusagt.

#### Im Reiter Player
Ein- und Ausschalten von Anpassungen während des Abspielens
 - Spielen Sie Musik oder Hörspiel ab.
 - Schalten Sie den *Equalizer* mehrfach an und wieder aus, um den Unterschied zu hören.
 - Schalten Sie *Kurven* mehrfach an und aus, um den Unterschied zu hören.
