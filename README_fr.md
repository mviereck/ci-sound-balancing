# CI Sound Balancing Tool

Cet outil aide les porteurs d'implants cochléaires à mesurer leurs perceptions de volume sonore et de hauteur tonale.
- Sur la base des résultats de mesure, des fichiers audio peuvent être lus avec un réglage simulé.
- Lorsque le résultat vous convient, vous pouvez imprimer un récapitulatif des modifications souhaitées pour votre audiologiste.

Vous trouverez l'outil ici, il fonctionne en ligne dans le navigateur : [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

Vous pouvez aussi utiliser l'outil hors ligne. [Télécharger en tant que fichier ZIP](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). Après décompression, l'outil s'ouvre dans le navigateur en double-cliquant sur *index.html*.

L'outil prend en charge les appareils des trois grands fabricants : MED-EL, Cochlear et Advanced Bionics.

## Contexte

L'objectif est que toutes les électrodes soient perçues à un volume égal (« loudness balancing »), et que les hauteurs tonales à gauche et à droite soient ressenties comme également hautes ou basses.

Cet équilibrage du volume des électrodes (par IC) et des hauteurs tonales (gauche/droite) constitue la base d'une écoute agréable et aussi naturelle que possible.

Les audiologistes n'ont généralement pas assez de temps pour effectuer ces mesures avec la rigueur nécessaire. C'est là que cet outil intervient : vous pouvez réaliser les mesures seul à la maison, sans aucune pression de temps.

À partir des données que vous avez vous-même mesurées, le lecteur audio intégré peut diffuser un réglage simulé. Vous pouvez ainsi évaluer à l'avance ce qui vous convient le mieux.

Au-delà du simple équilibrage du volume et de la hauteur, vous pouvez effectuer des ajustements semi-automatiques destinés à améliorer la compréhension de la parole, ou par exemple accentuer les basses ou les aigus. Vous pouvez entendre l'effet de vos ajustements en direct en faisant jouer simultanément de la musique ou un livre audio dans le lecteur.

Lorsque vous avez finalement trouvé un réglage qui vous convient, vous pouvez imprimer les modifications nécessaires et les remettre à votre audiologiste.

## Limitation

L'outil fonctionne exclusivement avec des signaux acoustiques. Les signaux acoustiques peuvent également activer des électrodes voisines. Cela rend la mesure un peu imprécise. L'idéal serait une stimulation directe de chaque électrode, mais cette possibilité reste réservée à l'audiologiste.

## Recommandation importante : programme de test sans filtres

Pour pouvoir évaluer le plus fidèlement possible le volume de chaque électrode, tous les filtres automatiques de traitement du son du processeur IC devraient être désactivés. Demandez à votre audiologiste de vous configurer un programme de test supplémentaire à cet effet.

Vous pouvez utiliser la phrase suivante (les termes s'appliquent à MED-EL/MAESTRO ; chez Cochlear et Advanced Bionics, les filtres correspondants portent d'autres noms — l'audiologiste saura de quoi il s'agit) :

>« Veuillez me configurer sur une position de programme libre une MAP de test dans laquelle tous les filtres ASM sont désactivés :
>
>- Microphone Directionality : Omni
>- Adaptive Intelligence : Off
>- Wind Noise Reduction : Off
>- Ambient Noise Reduction : Off
>- Transient Noise Reduction : Off
>
>Compression Ratio et tous les autres paramètres de la map à laisser inchangés. Cette MAP me sert uniquement pour une mesure de volume à la maison. »

### En complément : demander les données de votre MAP à votre audiologiste

Dans l'onglet *Implant*, vous pouvez saisir de nombreuses valeurs techniques de votre IC. L'outil fonctionne aussi sans ces valeurs ; avec elles, les résultats et les recommandations pour l'audiologiste deviennent toutefois plus précis. Vous ne pouvez pas trouver ces valeurs vous-même : vous devez les demander à votre audiologiste.

La phrase suivante peut aider :

>« Veuillez m'imprimer un fitting report (tous les paramètres de la map) de ma MAP actuelle. J'en ai besoin pour une mesure de volume à la maison avec le CI Sound Balancing Tool. »

En cas de questions sur les valeurs concrètement concernées :

>- Modèle de l'implant et modèle du processeur audio
>- Stratégie de codage et taux de stimulation
>- FAT (Frequency Allocation Table) : fréquence centrale en Hz par électrode
>- THR (T-Level) par électrode
>- MCL par électrode
>- MED-EL : MCL en qu
>- Cochlear : C-Level en CL
>- Advanced Bionics : M-Level en CU
>- Statut de chaque électrode (active / désactivée)
>- MED-EL en plus : MAPLAW c-value
>- Cochlear en plus : IIDR (Instantaneous Input Dynamic Range, en dB)
>- Advanced Bionics en plus : IDR (Input Dynamic Range, en dB)


## Marche à suivre :
### Équilibrer le volume
#### Dans l'onglet *Implant* :
Informations techniques de base sur votre IC.

- Sélectionnez en haut le côté *GAUCHE/DROITE* sur lequel vous portez l'IC.
- Indiquez au moins le fabricant de votre IC ; si vous les connaissez, aussi le modèle, etc.
- Marquez les électrodes désactivées sous *STATUT* comme *DÉSACTIVÉE*.
- Testez le son de chaque électrode. Marquez les électrodes anormales, par ex. avec un fort bruit, sous *STATUT*.
- Idéalement, saisissez aussi toutes les autres valeurs que vous connaissez. Vous pouvez demander ces valeurs à votre audiologiste. Vous pouvez aussi utiliser l'outil sans ces valeurs.
- Renseignez également les informations pour l'autre oreille. Si vous ne portez pas d'IC de ce côté, indiquez selon le cas *audition normale*, *malentendant* ou *sourd*.

#### Dans l'onglet *Mesure*
Comparaison du volume des électrodes.
- Pour le(s) côté(s) avec un IC, commencez uniquement par la mesure *Volume des électrodes*.
- Dans cette mesure, toutes les électrodes sont comparées deux à deux, et vous ajustez le volume jusqu'à ce que les deux côtés soient perçus à un volume égal.
- Utilisez si possible le streaming Bluetooth.
- Réglez le volume sur environ 3/4 ressenti : ni trop bas, ni désagréablement fort.
- Commandes des tests :
  - Réglez le volume avec les *touches fléchées*.
  - Rejouez le son avec la *barre d'espace*.
  - Une fois les sons perçus à volume égal, validez avec *Entrée*.
  - Optionnel : choisir un autre son de test.
- Procédure recommandée :
  - D'abord le test *Complet*.
  - Puis le test *Convergence*, à répéter autant de fois que voulu.
  - Optionnel : activer *Ajustement fin* et relancer *Convergence*.
- Chaque test peut être interrompu à tout moment et repris plus tard au même endroit.
- Chaque test peut être répété autant de fois que nécessaire pour affiner les résultats.
- Les mesures *Balance stéréo* et *Accord en fréquence* sont à laisser de côté dans un premier temps.

#### Dans l'onglet *Résultats*
Affichage du réglage calculé d'après vos mesures.

- Dans le sous-onglet *Volume des électrodes*, vous voyez les modifications recommandées par électrode, présentées dans un graphique.
- Les couleurs des barres par électrode indiquent la fiabilité du résultat de mesure :
  - *rouge* : résultat incertain, écarts importants entre les mesures
  - *jaune* : résultat utilisable, correct, ok
  - *vert* : très bon résultat, fiable
- La valeur *Résiduel* indique la fiabilité de la mesure sous forme de valeur mathématique. Une valeur *Résiduel* < 1 est très bonne et apparaît en *vert*. Cela signifie que l'écart entre les mesures est inférieur à 1 décibel.

#### Dans l'onglet *Player*
Lancez un fichier audio pour simuler l'effet de vos mesures.
- L'égaliseur intégré modifie le son approximativement comme il sonnerait si l'audiologiste réajustait votre IC selon vos mesures.
- Avec l'équilibrage du volume de vos électrodes, vous avez déjà créé une base précieuse. Beaucoup de choses devraient déjà sonner plus clair qu'auparavant.
- Activez puis désactivez plusieurs fois le bouton *Mesure* pour entendre la différence.

#### Dans l'onglet *Courbes*

Dans l'onglet *Courbes*, vous pouvez modifier le volume de toutes les électrodes ensemble, en suivant une courbe. Plusieurs calculs de courbe sont à votre disposition.

Recommandations :
- Faites tourner un fichier audio dans le *Player*. Prenez un livre audio.
- Activez *Parole*. Modifiez le réglage avec les *touches fléchées haut/bas* et écoutez en direct comment la modification influence votre compréhension de la parole.
- Désactivez *Parole* et activez *Sinus*. Faites tourner de la musique dans le *Player*. Modifiez la valeur avec les *touches fléchées haut/bas* et écoutez en direct comment les aigus et les basses changent.
- Désactivez *Sinus* et essayez aussi d'autres courbes.
- Trouvez une courbe ou une combinaison de courbes qui vous convient.
- Allez dans l'onglet *Player*, lancez quelque chose, et activez puis désactivez plusieurs fois le bouton *Courbes* pour entendre la différence.

#### Dans l'onglet *Charger/Sauver*
- Sauvegardez vos données de mesure et vos réglages.

## Pour votre audiologiste
Impressions pour votre audiologiste avec les modifications souhaitées.

- Réglez tout dans le *Player* comme vous souhaitez entendre.
  - Veillez aussi au réglage *GAUCHE/DROITE* ainsi qu'à la case à cocher *Les deux côtés*.
- Allez dans l'onglet *Charger/Sauver* et cliquez sur *Imprimer*.
- Réglez le lecteur de sorte que seul l'équilibrage du volume soit appliqué (bouton *Mesuré*). Désactivez les boutons *Courbes* et *Curseurs*. Imprimez aussi cela comme demande de réglage pour votre futur programme de test.
- Prenez les impressions avec vous à votre prochain rendez-vous chez l'audiologiste.

### Recommandation pour un nouvel agencement des programmes
- Conservez sans changement le programme avec lequel vous êtes familier et que vous utilisez au quotidien.
- Attribuez un emplacement de programme comme programme de test avec des électrodes parfaitement égales en volume et sans filtre. Cela devient votre base pour de futures mesures et expérimentations.
- Attribuez un ou deux emplacements de programmes avec les réglages souhaités que vous avez déterminés avec l'outil.

### Limitation
Si vous avez saisi dans l'outil les valeurs *MCL* des électrodes, l'outil calcule — en plus de la différence en décibels (dB) — également une différence dans l'unité du programme de l'audiologiste. Cela est inclus dans l'impression. Ces valeurs calculées n'ont pas encore été vérifiées quant à leur fiabilité. De plus, l'oreille en tant qu'organe peut réagir aux réglages de manière un peu différente de ce qu'un calcul peut prédire.

## Autres possibilités

### *Mesure* → *Balance stéréo*
Permet l'équilibrage du volume entre gauche et droite.
- (Documentation complémentaire à venir.)

### *Mesure* → *Accord en fréquence*
Mesure des différences de hauteur tonale entre gauche et droite.
- (Documentation complémentaire à venir.)
- (Le *Player* peut diffuser une simulation de hauteurs modifiées, mais la qualité de la simulation reste modeste.)

### Onglet *Curseurs*
Permet une modification manuelle du volume de chaque électrode.
- (Documentation complémentaire à venir.)

## Matériel vocal et sources

Les phrases dans le lecteur (« Lire des phrases ») utilisent des
enregistrements vocaux et de la synthèse vocale issus des sources
ouvertes suivantes :

- **Thorsten-Voice** – voix allemande de Thorsten Müller,
  données d'entraînement CC0. https://www.thorsten-voice.de
- **Piper TTS** – synthèse vocale neuronale, licence MIT. Sera utilisé
  dans les étapes ultérieures pour d'autres langues et locuteurs.
  https://github.com/rhasspy/piper

Les phrases sélectionnées proviennent du corpus d'entraînement de
Thorsten-Voice et ne sont pas redistribuées en tant que texte — seuls
les 50 extraits audio explicitement choisis figurent dans le dépôt.
