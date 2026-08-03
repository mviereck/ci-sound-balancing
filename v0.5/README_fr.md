# CImbel - CI Sound Balancing Tool

<img src="assets/images/CImbel_logo.png" alt="CImbel — CI sound balancing" width="200">

Cet outil sert aux porteurs d'implants cochléaires pour mesurer leurs intensités sonores et hauteurs tonales perçues.
- Sur la base des résultats de mesure, des fichiers audio peuvent être lus avec un ajustement simulé.
- Dès que cela vous semble bien sonner, vous pouvez imprimer pour votre audiologiste un aperçu des modifications souhaitées.

Vous trouverez l'outil ici, il fonctionne en ligne dans le navigateur : [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

Vous pouvez aussi utiliser l'outil hors ligne. [Télécharger comme fichier ZIP](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). Après décompression, l'outil s'ouvre dans le navigateur par un double-clic sur *index.html*.

L'outil prend en charge les appareils des trois grands fabricants : MED-EL, Cochlear et Advanced Bionics.

## Contexte

L'objectif est que toutes les électrodes paraissent aussi fortes (« loudness balancing »), ainsi que les hauteurs tonales gauche et droite soient perçues comme aussi hautes ou basses.

Cet équilibrage de l'intensité des électrodes (par IC) et des hauteurs tonales (gauche/droite) est la base d'une audition agréable et aussi naturelle que possible.

Les audiologistes n'ont en général pas assez de temps pour effectuer ces mesures avec la minutie requise. C'est là que cet outil aide : vous pouvez effectuer les mesures seul à la maison, sans aucune pression temporelle.

Sur la base de ces données de mesure auto-déterminées, un ajustement simulé peut être lu dans le lecteur audio intégré. Vous pouvez ainsi évaluer à l'avance ce qui sonne le mieux pour vous.

En complément du simple équilibrage d'intensité et de hauteur, vous pouvez faire des ajustements semi-automatiques pour améliorer la compréhension de la parole, ou par exemple accentuer les basses ou les aigus. Vous pouvez entendre l'effet de vos ajustements en direct, si vous laissez en même temps tourner de la musique ou un livre audio dans le lecteur audio.

Lorsque vous avez finalement trouvé un ajustement qui vous semble bon, vous pouvez faire imprimer les modifications nécessaires pour cela et les remettre à votre audiologiste.

## Limitation

L'outil travaille exclusivement avec des signaux acoustiques. Les signaux acoustiques peuvent aussi activer les électrodes voisines. Cela rend la mesure quelque peu imprécise. L'idéal serait une stimulation directe des électrodes individuelles, mais cette possibilité reste réservée à l'audiologiste.

## Recommandation importante : programme de test sans filtre

Afin que vous puissiez juger l'intensité de chaque électrode de manière aussi peu déformée que possible, tous les filtres de traitement sonore automatiques dans le processeur d'IC devraient être désactivés. Demandez à votre audiologiste de vous installer un programme de test supplémentaire à cet effet.

Vous pouvez utiliser la phrase suivante (les termes valent pour MED-EL/MAESTRO ; chez Cochlear et Advanced Bionics il existe des filtres correspondants sous d'autres noms, l'audiologiste sait ce qui est désigné) :

>« Veuillez me créer sur une position de programme libre une MAP de test dans laquelle tous les filtres ASM sont désactivés :
>
>- Microphone Directionality: Omni
>- Adaptive Intelligence: Off
>- Wind Noise Reduction: Off
>- Ambient Noise Reduction: Off
>- Transient Noise Reduction: Off
>
>Compression Ratio et autres paramètres de MAP veuillez les laisser inchangés. J'ai besoin de cette MAP uniquement pour une mesure d'intensité sonore à la maison. »

### En complément : demander à l'audiologiste les données de votre MAP

Dans l'onglet Implant, vous pouvez saisir de nombreuses valeurs techniques concernant votre IC. L'outil fonctionne aussi sans ces valeurs ; avec elles, les résultats et recommandations pour l'audiologiste deviennent toutefois plus précis. Vous ne trouvez pas ces valeurs vous-même, vous devez les demander à l'audiologiste.

La phrase suivante aide :

>« Veuillez m'imprimer un fitting-report (tous les paramètres de MAP) de ma MAP actuelle. J'ai besoin des valeurs pour une mesure d'intensité sonore à la maison avec le CI Sound Balancing Tool. »

En cas de questions sur les valeurs concrètement visées :

>- Modèle d'implant et modèle de processeur audio
>- Stratégie de codage et taux de stimulation
>- FAT (Frequency Allocation Table) : fréquence centrale par électrode en Hz
>- THR (T-Level) par électrode
>- MCL par électrode
>- MED-EL : MCL en qu
>- Cochlear : C-Level en CL
>- Advanced Bionics : M-Level en CU
>- Statut de chaque électrode (active / désactivée)
>- MED-EL en plus : valeur c MAPLAW
>- Cochlear en plus : IIDR (Instantaneous Input Dynamic Range, en dB)
>- Advanced Bionics en plus : IDR (Input Dynamic Range, en dB)


## Procédure :
### Équilibrer l'intensité
#### Dans l'onglet *Implant* :
Indications techniques générales sur votre IC.

- Sélectionnez en haut le côté *GAUCHE/DROITE* sur lequel vous portez l'IC.
- Saisissez au moins votre fabricant d'IC, et si connu, également le modèle, etc.
- Marquez les électrodes désactivées sous *ACTIF* comme *DÉSACTIVÉES* (retirer la coche).
- Testez le son pour chaque électrode. Marquez les électrodes anormales, par exemple avec un bruit fort, dans *STATUT*.
- Idéalement, saisissez toutes les autres indications et valeurs connues, si possible. Vous pouvez demander les valeurs à votre audiologiste. Vous pouvez toutefois aussi utiliser l'outil sans ces valeurs.
- Faites toutes les indications aussi pour l'autre oreille. Inscrivez également *normo-entendant* ou *malentendant* ou *sourd* le cas échéant, si vous n'y portez pas d'IC.

#### Dans l'onglet *Mesures* -> *Intensité d'électrode*
Comparaison de l'intensité des électrodes.
- Pour le(s) côté(s) avec IC, faites d'abord uniquement la mesure *Intensité d'électrode*.
- Dans cette mesure, toutes les électrodes sont comparées par paires entre elles, et vous ajustez l'intensité jusqu'à ce que les deux électrodes paraissent aussi fortes.
- Utilisez si possible le Bluetooth pour le streaming.
- Réglez le volume de votre ordinateur (ou smartphone) à environ 3/4 ressenti, ni trop bas, mais pas encore désagréablement fort.
- Commande des tests :
  - Ajustez l'intensité avec les *touches fléchées*.
  - Avec la *barre d'espace*, rejouer le son.
  - Dès que les sons sont aussi forts, confirmer avec *Entrée*.
  - Optionnel : choisir un autre son à tester.
    - Remarque : plusieurs sons sont disponibles.
      - Sinus est le standard, Complexe est aussi très bon.
      - Le bruit à bande étroite peut conduire à des écarts étonnamment grands dans la mesure.
        Utilisez ce son d'abord seulement à titre expérimental, ou comme série de tests entièrement propre, indépendante d'une mesure par son sinusoïdal.
- Procédure recommandée :
  - D'abord la procédure de test *Complet*.
  - Ensuite la procédure de test *Convergence*, volontiers plusieurs fois.
  - Sous le curseur s'affiche une marque avec une valeur estimée calculée et une zone d'imprécision. On ne peut pas s'y fier, mais cela peut offrir un point de repère.
- Chaque test peut être interrompu à tout moment et poursuivi plus tard au même endroit.
- Chaque test peut être répété autant de fois que souhaité, pour affiner les résultats.
- Laissez d'abord de côté les mesures *Balance stéréo* et *Appariement fréquentiel*.

#### Dans l'onglet *Résultats de mesure* -> *Intensité d'électrode*
Affichage de l'ajustement calculé selon vos mesures.

- Dans le sous-onglet *Intensité d'électrode*, vous voyez les modifications recommandées par électrode représentées dans un graphique.
- Les couleurs des barres par électrode indiquent à quel point le résultat de mesure peut être jugé fiable :
  - *rouge* : résultat incertain, grands écarts dans les mesures
  - *jaune* : résultat utilisable, bon, ok
  - *vert* : très bon résultat, fiable
- La valeur *Résidu* montre la fiabilité de la mesure sous forme de valeur mathématique. Un *Résidu* <1 est très bon et s'affiche en *vert*. Cela signifie que l'écart des mesures est inférieur à 1 décibel.

#### Dans l'onglet *Player*
Lisez un fichier audio pour simuler l'effet de vos mesures.
- L'égaliseur intégré modifie le son à peu près comme il sonnerait si l'audiologiste réajustait votre IC selon vos mesures.
- Avec l'équilibrage de l'intensité des électrodes de votre IC, vous avez créé une base précieuse. Avec cela, beaucoup devrait déjà sonner plus clairement qu'avant.
- Activez et désactivez plusieurs fois le bouton *Mesures*, pour entendre la différence.

#### Dans l'onglet *Courbes*

Dans l'onglet *Courbes*, vous pouvez modifier l'intensité de toutes les électrodes ensemble en suivant une courbe. Différents calculs de courbe sont disponibles à cet effet.

Recommandations :
- Laissez tourner un fichier audio dans le *Player*. Prenez un livre audio.
- Activez *Parole*. Modifiez le réglage avec les *touches fléchées haut/bas* et écoutez en direct comment la modification se répercute sur votre compréhension de la parole.
- Désactivez *Parole* et activez *Sinus*. Laissez tourner de la musique dans le *Player*. Modifiez la valeur avec les *touches fléchées haut/bas* et écoutez en direct comment changent les aigus et les basses.
- Désactivez *Sinus* et essayez aussi d'autres courbes.
- Trouvez une courbe ou une combinaison de courbes qui vous convient.
- Allez dans l'onglet *Player*, lancez quelque chose, et activez et désactivez plusieurs fois le bouton *Courbes*, pour entendre la différence.

#### Dans l'onglet *Charger/Enregistrer*
- Sauvegardez vos données de mesure et vos réglages.

## Pour votre audiologiste
Impressions pour votre audiologiste avec les modifications souhaitées.

- Réglez tout dans le *Player* comme vous souhaitez entendre.
  - Tenez compte également du réglage *GAUCHE/DROITE* ainsi que de la case à cocher *Les deux côtés*.
- Allez dans l'onglet *Charger/Enregistrer* et cliquez sur *Imprimer*.
- Réglez le Player de sorte que seul l'équilibrage d'intensité (bouton *Mesuré*) ait lieu. Désactivez les boutons *Courbes* et *Curseurs*. Imprimez aussi cela comme souhait de réglage pour votre futur programme de test.
- Apportez les impressions à votre prochain rendez-vous chez l'audiologiste.

### Recommandation pour une nouvelle programmation
- Conservez sans changement le programme que vous connaissez bien jusqu'ici et que vous utilisez au quotidien.
- Attribuez une place de programme comme programme de test avec des électrodes d'intensité exactement égale, sans filtres. Ce sera votre base pour les futures mesures et expérimentations.
  - Ce programme de test pourrait aussi devenir un programme favori pour la musique ou les sons naturels.
- Attribuez une ou deux places de programme avec les réglages souhaités que vous avez déterminés à l'aide de l'outil.

### Limitation
Si vous avez saisi les valeurs *MCL* des électrodes dans l'outil, l'outil calcule en plus de la différence en décibels (dB) également une différence dans l'unité du programme d'audiologiste. Cela est également imprimé. Ces valeurs calculées n'ont pas encore été vérifiées quant à leur fiabilité. À cela s'ajoute que l'oreille en tant qu'organe pourrait réagir aux réglages quelque peu différemment de ce qu'un calcul peut prédire.

## Autres mesures

### Onglet *Mesures* -> *Balance stéréo*
Comparaison d'intensité gauche et droite.
- Avant cette mesure, la mesure *Intensité d'électrode* devrait déjà avoir été effectuée.
- À partir de la mesure, une moyenne est calculée, qui est recommandée comme augmentation ou réduction d'intensité pour un côté.
- L'équilibrage peut être activé dans le Player par bouton.

### Onglet *Mesures* -> *Latence*
Mesurer le décalage temporel entre gauche et droite.
- En cas d'appareillage différent à gauche et à droite, les sons peuvent arriver décalés dans le temps.
- Avec ce test, vous pouvez mesurer cette latence. Selon l'appareil, une correction peut être effectuée par l'audiologiste ou l'audioprothésiste.
- Si l'intensité gauche et droite est très bien équilibrée, vous pouvez aussi, comme point de repère, faire attention à « où » vous entendez le son. Plutôt à gauche, à droite, ou au milieu de la tête.
- Une compensation peut être activée dans le Player.

Cette procédure de mesure est encore quelque peu rudimentaire et doit être affinée dans les futures versions.

### Onglet *Mesures* -> *Appariement fréquentiel*
Mesure des différences de hauteur tonale gauche et droite.
- Il est avantageux d'avoir déjà effectué *Intensité d'électrode* et *Balance stéréo* avant cette mesure.

La procédure est divisée en 2 tests. Le premier test avec curseur sert uniquement à obtenir de bonnes valeurs de départ pour le second test, qui est chronophage.
#### Test 1 : Pré-estimation (Slider)
- Par électrode, le même son est joué à gauche et à droite. Corrigez avec le curseur / avec les touches fléchées, jusqu'à ce que les sons à gauche et à droite paraissent aussi hauts ou bas.
#### Test 2 : Adaptatif
- Des séquences de sons sont jouées, et vous indiquez pour chaque séquence si le deuxième son était plus haut ou plus bas que le premier.
- Vous arriverez à un moment à un point où vous ne pouvez presque ou plus du tout faire la distinction. Répondez alors intuitivement, même si l'esprit ne reconnaît plus de différence.
#### Player
- Dans le *Player*, sous *Expérimental*, une simulation de hauteurs tonales modifiées peut être lue, la qualité de la simulation est toutefois encore modeste. Cela peut toutefois donner une idée de l'effet que pourrait avoir la modification.
#### Remarque concernant les appareils auditifs :
- Si vous entendez naturellement de l'autre oreille mais êtes malentendant, il peut être utile de faire régler l'appareil auditif pour le test de sorte qu'il n'effectue pas de décalage de fréquence, mais améliore seulement l'intensité.
- Si vous portez à l'autre oreille un appareil auditif qui fait du décalage de fréquence, par exemple en restituant des sons aigus comme des sons plus bas, il n'est pas approprié pour le test. Vous testeriez avec les fréquences décalées.

### Onglet *Curseurs*
Permet une modification manuelle d'intensité d'électrodes individuelles.
- En général, vous n'aurez pas besoin de cette fonction. Elle vous donne la liberté pour des expérimentations.
- Il y a un mode *relatif* et un mode *absolu*. Le mode *absolu* n'est utilisable que si les valeurs MCL ont été saisies dans l'onglet *Implant*.
- Vous pouvez faire afficher la modification par *Intensité d'électrode* et *Courbes*.
- Vous pouvez entendre les modifications en direct dans le Player.

