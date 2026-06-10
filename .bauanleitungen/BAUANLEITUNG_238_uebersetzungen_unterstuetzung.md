# Bauanleitung 238 — Übersetzungen EN/FR/ES für Unterstützung-Tab

## Hintergrund

Die deutschen Texte des Unterstützung-Tabs sind nach den BAs 235–237
stabil. Diese BA zieht die Übersetzungen in `i18n/en.js`, `i18n/fr.js`
und `i18n/es.js` nach. Inhalt = aktuelle DE-Stände aus `i18n/de.js`.

## Scope

Geändert: `js/version.js`, `i18n/en.js`, `i18n/fr.js`, `i18n/es.js`.
Sonst nichts.

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.238-beta";
```

## Schritt 2 — `i18n/en.js`

### Geänderte Keys

**`supportIntro2`** (Z. 901):

```js
    supportIntro2: "So that it stays that way and the tool can continue to grow, it needs regular support. Even 1 or 2 euros per month help noticeably. If 30 to 50 users participate, the monthly requirement is covered. One-time donations are also welcome.",
```

**`supportTableHeadFull`** (Z. 910):

```js
    supportTableHeadFull: "Sensible extension",
```

**`supportGapCurrent`** (Z. 920):

```js
    supportGapCurrent: "Difference current → sensible extension:",
```

**`supportGapToFull`** (Z. 921):

```js
    supportGapToFull: "Additional monthly donations required for sensible extension:",
```

**`supportExplainKi`** (Z. 927) — letzten Satz entfernen:

```js
    supportExplainKi: "<b>Why the AI item is so high:</b> Development runs in interplay with an AI assistant (Claude). Without this workflow, the current pace would not be sustainable; the versatility could not have arisen in reasonable time.",
```

**`supportFutureTitle`** (Z. 929):

```js
    supportFutureTitle: "What your donations make possible:",
```

**`supportFuturePlan1`** (Z. 931):

```js
    supportFuturePlan1: "Further development and provision of the tool.",
```

**`supportFuturePlan2`** (Z. 932):

```js
    supportFuturePlan2: "Support from me when problems arise.",
```

**`supportGraphCostFull`** (Z. 946):

```js
    supportGraphCostFull: "Extension",
```

### Neue Keys

Direkt nach `supportIntro2`:

```js
    supportIntro3: "The aim is many small monthly donations via standing order, so that no single donor has to carry much. Symbolically, a cup of coffee per month and donor would be ideal — it would carry the project, and no one would be burdened.",
    supportIntro4: "If more donations come in than are needed monthly, I offer donors with higher monthly contributions to reduce their amount.",
```

Direkt nach dem geänderten `supportExplainKi`:

```js
    supportKiAbHinweis: "Previously, this appeal mentioned an even higher amount for a larger AI subscription at 107.- per month. It turns out, however, that the current solution at 44.- per month is sufficient.",
```

Direkt nach `supportFuturePlan2`:

```js
    supportPlannedTitle: "Planned developments, examples:",
    supportPlannedItem1: "Optimization of the test procedures",
    supportPlannedItem2: "Better audio simulation of frequency fitting",
    supportPlannedItem3: "Expansion of the audio collection: sentences, music, audiobooks",
    supportPlannedItem4: "Possibly an area for hearing training",
    supportPlannedItem5: "Possibly an area for tinnitus analysis and generation of individual 'anti-noise' sounds.",
```

Direkt nach `supportGraphLegendLuecke`:

```js
    supportGraphLegendErweiterung: "Difference to extension",
```

### Entfernte Keys

Folgende Zeilen ersatzlos löschen:

- `supportFinanceGoal` (Z. 926)
- `supportFutureIntro` (Z. 930)
- `supportFuturePlan3` (Z. 933)
- `supportFuturePlan4` (Z. 934)
- `supportFutureConsider` (Z. 935)
- `supportFutureConsider1` (Z. 936)
- `supportFutureConsider2` (Z. 937)

## Schritt 3 — `i18n/fr.js`

### Geänderte Keys

**`supportIntro2`** (Z. 902):

```js
    supportIntro2: "Pour que cela reste ainsi et que l'outil puisse continuer à se développer, il a besoin d'un soutien régulier. Même 1 ou 2 euros par mois aident sensiblement. Si 30 à 50 utilisateurs participent, le besoin mensuel est couvert. Les dons uniques sont également les bienvenus.",
```

**`supportTableHeadFull`** (Z. 911):

```js
    supportTableHeadFull: "Extension souhaitable",
```

**`supportGapCurrent`** (Z. 921):

```js
    supportGapCurrent: "Différence état → extension souhaitable :",
```

**`supportGapToFull`** (Z. 922):

```js
    supportGapToFull: "Dons mensuels supplémentaires nécessaires pour l'extension souhaitable :",
```

**`supportExplainKi`** (Z. 928) — letzten Satz entfernen:

```js
    supportExplainKi: "<b>Pourquoi le poste IA est si élevé :</b> le développement se déroule en interaction avec un assistant IA (Claude). Sans ce workflow, le rythme actuel ne serait pas tenable ; la polyvalence n'aurait pas pu naître dans un temps raisonnable.",
```

**`supportFutureTitle`** (Z. 930):

```js
    supportFutureTitle: "Ce que vos dons rendent possible :",
```

**`supportFuturePlan1`** (Z. 932):

```js
    supportFuturePlan1: "Développement et mise à disposition continue de l'outil.",
```

**`supportFuturePlan2`** (Z. 933):

```js
    supportFuturePlan2: "Support de ma part en cas de problèmes.",
```

**`supportGraphCostFull`** (Z. 947):

```js
    supportGraphCostFull: "Extension",
```

### Neue Keys

Direkt nach `supportIntro2`:

```js
    supportIntro3: "L'objectif est d'obtenir beaucoup de petits dons mensuels en prélèvement automatique, afin qu'aucun donateur n'ait à porter une charge importante. Symboliquement, une tasse de café par mois et par donateur serait idéal : cela suffirait à porter le projet, sans peser sur personne.",
    supportIntro4: "Si davantage de dons rentrent que ce qui est nécessaire mensuellement, je propose aux donateurs avec une contribution mensuelle élevée de réduire leur montant.",
```

Direkt nach dem geänderten `supportExplainKi`:

```js
    supportKiAbHinweis: "Auparavant, cet appel mentionnait un montant encore plus élevé pour un abonnement IA plus important à 107,- par mois. Il s'avère cependant que la solution actuelle à 44,- par mois est suffisante.",
```

Direkt nach `supportFuturePlan2`:

```js
    supportPlannedTitle: "Développements prévus, exemples :",
    supportPlannedItem1: "Optimisation des procédures de test",
    supportPlannedItem2: "Meilleure simulation audio de l'ajustement fréquentiel",
    supportPlannedItem3: "Extension de la collection audio : phrases, musique, livres audio",
    supportPlannedItem4: "Éventuellement un espace pour l'entraînement auditif",
    supportPlannedItem5: "Éventuellement un espace pour l'analyse d'acouphènes et la génération de sons « anti-bruit » personnalisés.",
```

Direkt nach `supportGraphLegendLuecke`:

```js
    supportGraphLegendErweiterung: "Différence par rapport à l'extension",
```

### Entfernte Keys

Folgende Zeilen ersatzlos löschen:

- `supportFinanceGoal` (Z. 927)
- `supportFutureIntro` (Z. 931)
- `supportFuturePlan3` (Z. 934)
- `supportFuturePlan4` (Z. 935)
- `supportFutureConsider` (Z. 936)
- `supportFutureConsider1` (Z. 937)
- `supportFutureConsider2` (Z. 938)

## Schritt 4 — `i18n/es.js`

### Geänderte Keys

**`supportIntro2`** (Z. 902):

```js
    supportIntro2: "Para que siga así y la herramienta pueda seguir creciendo, necesita apoyo regular. Ya 1 o 2 euros al mes ayudan de forma notable. Si participan de 30 a 50 usuarios, se cubre la necesidad mensual. También son bienvenidas las donaciones puntuales.",
```

**`supportTableHeadFull`** (Z. 911):

```js
    supportTableHeadFull: "Ampliación recomendable",
```

**`supportGapCurrent`** (Z. 921):

```js
    supportGapCurrent: "Diferencia estado → ampliación recomendable:",
```

**`supportGapToFull`** (Z. 922):

```js
    supportGapToFull: "Donaciones mensuales adicionales necesarias para la ampliación recomendable:",
```

**`supportExplainKi`** (Z. 928) — letzten Satz entfernen:

```js
    supportExplainKi: "<b>Por qué la partida de IA es tan alta:</b> el desarrollo se realiza en interacción con un asistente de IA (Claude). Sin este flujo de trabajo no podría mantenerse el ritmo actual; la versatilidad no habría surgido en un tiempo razonable.",
```

**`supportFutureTitle`** (Z. 930):

```js
    supportFutureTitle: "Lo que sus donaciones hacen posible:",
```

**`supportFuturePlan1`** (Z. 932):

```js
    supportFuturePlan1: "Desarrollo y mantenimiento continuo de la herramienta.",
```

**`supportFuturePlan2`** (Z. 933):

```js
    supportFuturePlan2: "Soporte por mi parte ante problemas.",
```

**`supportGraphCostFull`** (Z. 947):

```js
    supportGraphCostFull: "Ampliación",
```

### Neue Keys

Direkt nach `supportIntro2`:

```js
    supportIntro3: "Lo que se busca son muchas donaciones mensuales pequeñas mediante domiciliación, para que ningún donante tenga que cargar con mucho. Simbólicamente, una taza de café al mes por donante sería ideal: sostendría el proyecto sin sobrecargar a nadie.",
    supportIntro4: "Si llegan más donaciones de las necesarias mensualmente, ofrezco a los donantes con contribución mensual elevada reducir su aportación.",
```

Direkt nach dem geänderten `supportExplainKi`:

```js
    supportKiAbHinweis: "Anteriormente, este llamamiento contemplaba una cantidad aún mayor para una suscripción de IA más grande, de 107,- al mes. Sin embargo, se ha comprobado que la solución actual de 44,- al mes es suficiente.",
```

Direkt nach `supportFuturePlan2`:

```js
    supportPlannedTitle: "Desarrollos previstos, ejemplos:",
    supportPlannedItem1: "Optimización de los procedimientos de prueba",
    supportPlannedItem2: "Mejor simulación de audio de la adaptación frecuencial",
    supportPlannedItem3: "Ampliación de la colección de audio: frases, música, audiolibros",
    supportPlannedItem4: "Posiblemente un área para entrenamiento auditivo",
    supportPlannedItem5: "Posiblemente un área para análisis de acúfenos y generación de sonidos 'antirruido' individuales.",
```

Direkt nach `supportGraphLegendLuecke`:

```js
    supportGraphLegendErweiterung: "Diferencia con la ampliación",
```

### Entfernte Keys

Folgende Zeilen ersatzlos löschen:

- `supportFinanceGoal` (Z. 927)
- `supportFutureIntro` (Z. 931)
- `supportFuturePlan3` (Z. 934)
- `supportFuturePlan4` (Z. 935)
- `supportFutureConsider` (Z. 936)
- `supportFutureConsider1` (Z. 937)
- `supportFutureConsider2` (Z. 938)

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload**, Tab **Unterstützung**.
2. **Sprache Deutsch:** unverändert seit BA 237.
3. **Sprache Englisch:** Card 1 hat vier Absätze (Intro1 + Intro2 +
   Tasse-Kaffee + Reduktionsangebot). Tabelle: „Sensible extension"
   als Spaltenkopf. Differenz-Hinweise: „… sensible extension".
   Unterhalb des Graphen die gekürzte AI-Erklärung + kursiv-grauer
   Hinweis. Card 3 mit „What your donations make possible:" + zwei
   Bullets + Untertitel „Planned developments, examples:" + fünf
   Bullets + GitHub-Hinweis. Graph: obere Bezugslinie beschriftet
   „Extension", Legende mit „Difference to extension".
4. **Sprache Französisch:** Card 1 vier Absätze. Tabelle „Extension
   souhaitable". Differenz „extension souhaitable". Card 3 „Ce que
   vos dons rendent possible :" usw. Graph-Label „Extension",
   Legende „Différence par rapport à l'extension".
5. **Sprache Spanisch:** Card 1 vier Absätze. Tabelle „Ampliación
   recomendable". Differenz „ampliación recomendable". Card 3 „Lo
   que sus donaciones hacen posible:" usw. Graph-Label „Ampliación",
   Legende „Diferencia con la ampliación".
6. **Konsole nach Reload:** keine Errors.
7. **Layout-Stichprobe:** beim Sprachwechsel zwischen DE/EN/FR/ES
   bleiben die Layouts identisch, keine leeren Bullets oder Absätze.
   (Leere Bullets würden fehlende Keys signalisieren.)

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden: erfüllt / nicht erfüllt / unklar,
mit Datei- und Zeilenangabe.

- [ ] `js/version.js` auf `"3.2.238-beta"`.
- [ ] In `i18n/en.js`, `i18n/fr.js`, `i18n/es.js` jeweils:
  - neun Keys geändert (`supportIntro2`, `supportTableHeadFull`,
    `supportGapCurrent`, `supportGapToFull`, `supportExplainKi`,
    `supportFutureTitle`, `supportFuturePlan1`, `supportFuturePlan2`,
    `supportGraphCostFull`),
  - zehn Keys neu eingefügt (`supportIntro3`, `supportIntro4`,
    `supportKiAbHinweis`, `supportPlannedTitle`,
    `supportPlannedItem1`–`5`, `supportGraphLegendErweiterung`),
  - sieben Keys ersatzlos entfernt (`supportFinanceGoal`,
    `supportFutureIntro`, `supportFuturePlan3`, `supportFuturePlan4`,
    `supportFutureConsider`, `supportFutureConsider1`,
    `supportFutureConsider2`).
- [ ] Pro Datei summiert: jeder Übertrag stimmt exakt mit dem in
  dieser BA angegebenen String überein — keine Tippfehler bei
  Akzenten, keine ASCII/Unicode-Verwechslungen bei Apostrophen oder
  typografischen Anführungszeichen, keine vergessenen Kommas am
  Zeilenende.
- [ ] Beim Schalten zwischen den vier Sprachen im Browser sieht der
  Unterstützung-Tab strukturell gleich aus, nur die Texte ändern
  sich. Insbesondere: kein leerer Bullet, kein leerer Absatz.
- [ ] Konsole: keine neuen Errors.

Wenn alle Punkte erfüllt: Bauanleitung als abgenommen melden.
