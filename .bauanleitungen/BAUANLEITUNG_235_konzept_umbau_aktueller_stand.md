# Bauanleitung 235 — Konzept-Umbau: aktueller Stand als Primärziel

## Hintergrund

Bisheriges Konzept: das Tool wird auf einen größeren „Vollausbau"
(KI Pro+ 107 €/Monat + VPS + Webspace + Domain, gesamt ~118 €/Monat)
hin entwickelt. Neues Konzept: die jetzige Lösung (Claude Pro 44 € +
Hostingpaket 5 € = 49 €/Monat) ist dauerhaft ausreichend. Die VPS-
Variante bleibt eine optionale „sinnvolle Erweiterung" (54,93 €/Monat),
das größere KI-Abo entfällt komplett aus der Planung.

Diese BA setzt den neuen Konzeptstand um.

## Scope

Geändert: `js/finanzen.js` (eine Zahl), `js/version.js`, `index.html`
(zwei Karten umstrukturiert, eine neue Karte), `style.css` (zwei
kleine Regeln), `i18n/de.js` (mehrere Texte ändern, neue Keys,
mehrere alte Keys entfernen).

**Nicht** geändert in dieser BA: `i18n/en.js`, `i18n/fr.js`,
`i18n/es.js`. Übersetzungen folgen, wenn der Nutzer dazu auffordert.

## Schritt 1 — Version bumpen

`js/version.js`:

```js
const APP_VERSION = "3.2.235-beta";
```

## Schritt 2 — `js/finanzen.js`: eine Zahl ändern

Im Pflege-Block oben, in `FINANZEN_POSTEN`, beim Eintrag `kiPro` den
Wert `full` von `107.20` auf `44.00` setzen. Alle anderen Posten
bleiben unverändert.

**Vorher:**

```js
  { key: "kiPro",   full: 107.20, current: 44.00 },
```

**Nachher:**

```js
  { key: "kiPro",   full:  44.00, current: 44.00 },
```

(Begründung im Kommentar nicht nötig — die Texte im Tab erklären
es. Folge: `kostenFull` ergibt jetzt 54,93 statt 118,13.)

## Schritt 3 — `index.html`: Card 1 erweitern

In `index.html` zwischen Z. 1803 (`<p data-t="supportIntro2"></p>`)
und Z. 1804 (`<div class="support-cta-row">`) zwei neue Absätze
einfügen.

**Vorher:**

```html
          <p data-t="supportIntro2"></p>
          <div class="support-cta-row">
```

**Nachher:**

```html
          <p data-t="supportIntro2"></p>
          <p data-t="supportIntro3"></p>
          <p data-t="supportIntro4"></p>
          <div class="support-cta-row">
```

## Schritt 4 — `index.html`: Card 2 umbauen

In `index.html` der Block von Z. 1844 bis Z. 1862 (von
`<p data-t="supportFinanceGoal"></p>` bis
`<p data-t="supportGithubHint"></p>`) wird **komplett ersetzt**.

Genauer: alles ab `<p data-t="supportFinanceGoal"></p>` (Z. 1844)
bis einschließlich `<p data-t="supportGithubHint"></p>` (Z. 1862),
inklusive der `<br>`-Zeile (Z. 1861), wird ersetzt durch:

```html
          <p data-t="supportExplainKi"></p>
          <p class="support-ki-history" data-t="supportKiAbHinweis"></p>
        </div>

        <div class="card support-card-future">
          <h2 data-t="supportFutureTitle"></h2>
          <ul>
            <li data-t="supportFuturePlan1"></li>
            <li data-t="supportFuturePlan2"></li>
          </ul>
          <h3 class="support-section-title" data-t="supportPlannedTitle"></h3>
          <ul>
            <li data-t="supportPlannedItem1"></li>
            <li data-t="supportPlannedItem2"></li>
            <li data-t="supportPlannedItem3"></li>
            <li data-t="supportPlannedItem4"></li>
            <li data-t="supportPlannedItem5"></li>
          </ul>
          <br>
          <p data-t="supportGithubHint"></p>
        </div>
```

**Wichtig:** Die schließende `</div>` der bestehenden
`support-card-finance` ist Teil des Ersatzes (sie kommt nach dem
neuen `supportKiAbHinweis`-Absatz). Direkt danach beginnt die neue
`support-card-future`. Die finale schließende `</div>` der neuen
Card ersetzt die ursprüngliche Schließung der `support-card-finance`.

**Nach dem Ersatz sieht das Ende des Panels so aus:**

```html
          <div id="untGapHints" class="support-gap-hints"><!-- befüllt durch unterstuetzung.js --></div>

          <div class="support-card-graph">
            ... (Graph-Subblock unverändert)
          </div>

          <p data-t="supportExplainKi"></p>
          <p class="support-ki-history" data-t="supportKiAbHinweis"></p>
        </div>

        <div class="card support-card-future">
          <h2 data-t="supportFutureTitle"></h2>
          <ul>
            <li data-t="supportFuturePlan1"></li>
            <li data-t="supportFuturePlan2"></li>
          </ul>
          <h3 class="support-section-title" data-t="supportPlannedTitle"></h3>
          <ul>
            <li data-t="supportPlannedItem1"></li>
            <li data-t="supportPlannedItem2"></li>
            <li data-t="supportPlannedItem3"></li>
            <li data-t="supportPlannedItem4"></li>
            <li data-t="supportPlannedItem5"></li>
          </ul>
          <br>
          <p data-t="supportGithubHint"></p>
        </div>

      </div>
```

## Schritt 5 — `style.css` ergänzen

Direkt nach dem Block `.support-graph-hinweis { ... }` (eingeführt
mit BA 234) folgende zwei Regeln einfügen:

```css
.support-card-graph {
  margin-bottom: 24px;
}
.support-ki-history {
  font-style: italic;
  color: #777;
  font-size: 0.9em;
  margin-top: -4px;
}
```

## Schritt 6 — `i18n/de.js` anpassen

Mehrere Edits in der deutschen Sprachdatei. Reihenfolge der Edits
entlang der jetzigen Zeilennummern (vor Edit per Read prüfen, ob die
Zeilen noch stimmen).

### 6a — `supportIntro2` ersetzen (Z. 951)

**Vorher:**

```js
    supportIntro2: "Damit das so bleibt und das Tool weiter wachsen kann, braucht es regelmäßige Unterstützung. Schon 1 oder 2 Euro pro Monat helfen spürbar. Wenn 50 Nutzer mitmachen, ist der monatliche Vollbedarf gedeckt. Auch einmalige Spenden sind willkommen.",
```

**Nachher:**

```js
    supportIntro2: "Damit das so bleibt und das Tool weiter wachsen kann, braucht es regelmäßige Unterstützung. Schon 1 oder 2 Euro pro Monat helfen spürbar. Wenn 30 bis 50 Nutzer mitmachen, ist der monatliche Bedarf gedeckt. Auch einmalige Spenden sind willkommen.",
```

### 6b — `supportIntro3` und `supportIntro4` neu einfügen

Direkt nach der neuen `supportIntro2`-Zeile zwei neue Keys einfügen:

```js
    supportIntro3: "Angestrebt werden viele kleine monatliche Spenden im Dauerauftrag, so daß kein Einzelspender viel tragen muß. Sinnbildlich eine Tasse Kaffee pro Monat und Spender wäre gut, es würde tragen, und niemand würde belastet.",
    supportIntro4: "Wenn mehr Spenden zusammenkommen, als monatlich benötigt werden, biete ich den Spendern mit hohem monatlichen Beitrag an, ihren Beitrag zu reduzieren.",
```

### 6c — `supportTableHeadFull` ändern

**Vorher:**

```js
    supportTableHeadFull: "Vollausbau",
```

**Nachher:**

```js
    supportTableHeadFull: "Sinnvolle Erweiterung",
```

### 6d — `supportGapCurrent` und `supportGapToFull` ändern

**Vorher:**

```js
    supportGapCurrent: "Differenz Stand → Vollausbau:",
    supportGapToFull: "Zusätzlich nötige monatliche Spenden für Vollausbau:",
```

**Nachher:**

```js
    supportGapCurrent: "Differenz Stand → sinnvolle Erweiterung:",
    supportGapToFull: "Zusätzlich nötige monatliche Spenden für sinnvolle Erweiterung:",
```

### 6e — `supportFinanceGoal` ersatzlos entfernen

Die komplette Zeile mit `supportFinanceGoal: "..."` löschen.

### 6f — `supportExplainKi` letzten Satz entfernen

Den Satz „Das größere Abo ermöglicht es mir, arbeitsintensive
Features schneller zu entwickeln und nicht durch wöchentliche
Nutzungslimits mitten in der Arbeit gestoppt zu werden." aus dem
String entfernen.

**Vorher:**

```js
    supportExplainKi: "<b>Warum die KI-Position so hoch ist:</b> Die Entwicklung läuft im Wechselspiel mit einem KI-Assistenten (Claude). Ohne diesen Workflow wäre das jetzige Tempo nicht haltbar; die Vielseitigkeit wäre in vertretbarer Zeit so nicht entstanden. Das größere Abo ermöglicht es mir, arbeitsintensive Features schneller zu entwickeln und nicht durch wöchentliche Nutzungslimits mitten in der Arbeit gestoppt zu werden.",
```

**Nachher:**

```js
    supportExplainKi: "<b>Warum die KI-Position so hoch ist:</b> Die Entwicklung läuft im Wechselspiel mit einem KI-Assistenten (Claude). Ohne diesen Workflow wäre das jetzige Tempo nicht haltbar; die Vielseitigkeit wäre in vertretbarer Zeit so nicht entstanden.",
```

### 6g — `supportKiAbHinweis` neu einfügen

Direkt nach dem geänderten `supportExplainKi` neuen Key einfügen:

```js
    supportKiAbHinweis: "Zuvor war in diesem Aufruf ein noch höherer Betrag für ein größeres KI Abo mit 107,- pro Monat vorgesehen. Es zeigt sich aber, daß die jetzige Lösung mit 44,- pro Monat ausreichend ist.",
```

### 6h — `supportFutureTitle` ändern

**Vorher:**

```js
    supportFutureTitle: "Was mit Vollfinanzierung möglich wird:",
```

**Nachher:**

```js
    supportFutureTitle: "Was durch die Spenden möglich wird:",
```

### 6i — `supportFutureIntro` ersatzlos entfernen

Die komplette Zeile mit `supportFutureIntro: "..."` löschen.

### 6j — `supportFuturePlan1-4` durch zwei neue Punkte ersetzen

Die vier Zeilen `supportFuturePlan1` bis `supportFuturePlan4`
komplett ersetzen durch:

```js
    supportFuturePlan1: "Weiterentwicklung und Bereitstellung des Tools.",
    supportFuturePlan2: "Support durch mich bei Problemen.",
```

(`supportFuturePlan3` und `supportFuturePlan4` als Keys
ersatzlos entfernen.)

### 6k — `supportPlannedTitle` und `supportPlannedItem1-5` neu einfügen

Direkt nach den geänderten `supportFuturePlan1/2` sechs neue Keys
einfügen:

```js
    supportPlannedTitle: "Geplante Weiterentwicklung, Beispiele:",
    supportPlannedItem1: "Optimierung der Testverfahren",
    supportPlannedItem2: "Bessere Audio-Simulation von Frequenzanpassung",
    supportPlannedItem3: "Ausbau der Audiosammlung, Sätze, Musik, Hörbücher",
    supportPlannedItem4: "Eventuell ein Bereich für Hörtraining",
    supportPlannedItem5: "Eventuell ein Bereich für Tinnitus-Analyse und Erzeugung von individuellen ‚Antigeräuschen‘.",
```

(Die `‚` und `‘` sind die deutschen einfachen Anführungszeichen
‚…' — als Unicode-Escape geschrieben, damit nichts den String-Parser
verwirren kann. Alternativ direkt typografisch einsetzen; aber **nicht**
ASCII-Apostroph `'` verwenden, weil der String selbst mit `"` begrenzt
ist — beides wäre korrekt, der Apostroph ist nur stilistisch
schöner.)

### 6l — `supportFutureConsider`, `supportFutureConsider1`, `supportFutureConsider2` entfernen

Alle drei Zeilen ersatzlos löschen (die Hör-Training- und Tinnitus-
Inhalte sind jetzt in `supportPlannedItem4/5` integriert).

### 6m — `supportGithubHint` bleibt unverändert

Keine Änderung. Wird nur an einer anderen Stelle (Card 4 im HTML)
gerendert.

## Schritt 7 — `i18n/en.js`, `fr.js`, `es.js`: NICHT anfassen

In dieser BA werden die anderen Sprachdateien nicht geändert. Die
neuen Keys (`supportIntro3`, `supportIntro4`, `supportKiAbHinweis`,
`supportPlannedTitle`, `supportPlannedItem1-5`) fehlen dort
zunächst — die i18n-Schicht fällt für fehlende Keys auf den
deutschen Default zurück (`js/i18n.js`-Verhalten). Die geänderten
Keys (`supportIntro2`, `supportTableHeadFull`, `supportGap*`,
`supportExplainKi`, `supportFutureTitle`, `supportFuturePlan1/2`)
bleiben dort vorerst auf dem alten Inhalt — d. h. in EN/FR/ES
erscheint übergangsweise noch „Vollausbau" bzw. der alte Plan-
Text.

Übersetzungen werden erst nachgezogen, wenn der Nutzer ausdrücklich
dazu auffordert. Im Fertig-Bericht den Nutzer neutral darauf
hinweisen, daß die anderen Sprachen nicht angefaßt wurden — **nicht**
nach einer Übersetzungs-BA fragen, nicht eine vorbereiten.

**Keine Edits in en.js / fr.js / es.js.** Auch die ersatzlos
entfernten Keys (`supportFinanceGoal`, `supportFutureIntro`,
`supportFutureConsider`, `supportFutureConsider1`,
`supportFutureConsider2`, `supportFuturePlan3`, `supportFuturePlan4`)
bleiben dort vorerst stehen, damit die Übersetzungs-Aufgabe später
in einem Rutsch erledigt werden kann.

## Akzeptanztest (manuell, im Browser)

1. **Cache-Reload**, Tab **Unterstützung** öffnen, Sprache **Deutsch**.
2. **Card 1 „Unterstützer für die Weiterentwicklung gesucht":** Zwei
   neue Absätze („Angestrebt werden viele kleine…" und „Wenn mehr
   Spenden zusammenkommen…") erscheinen zwischen dem letzten
   bestehenden Absatz und den beiden Buttons.
3. **Card 2 „Offenlegung der Finanzierung":**
   - Tabellen-Header lautet jetzt **„Sinnvolle Erweiterung"** statt
     „Vollausbau".
   - Zeile `KI Claude`: linke Spalte zeigt jetzt **44,00 €** (statt
     107,20 €). Summenzeile links: **54,93 €** (statt 118,13 €).
     Andere Posten unverändert.
   - Differenz-Hinweise nutzen jetzt „sinnvolle Erweiterung" statt
     „Vollausbau". Werte: **5,93 €** und **19,93 €**.
   - Graph-Subblock (mit Diagramm, Legende, Hinweis) unverändert.
     Die zwei Bezugslinien liegen jetzt nah beieinander (49 und
     54,93 statt 49 und 118).
   - Unterhalb des Graphen (mit erkennbarem Abstand) erscheint der
     Absatz **„Warum die KI-Position so hoch ist:"** in geänderter,
     gekürzter Fassung. Direkt darunter ein **kursiver grauer
     Hinweis**: „Zuvor war in diesem Aufruf ein noch höherer
     Betrag…"
   - **Karte endet danach.** Kein `supportFinanceGoal`-Absatz mehr,
     keine Future-Liste mehr in dieser Karte.
4. **Neue Card 3 darunter „Was durch die Spenden möglich wird:":**
   - Zwei Bullets: „Weiterentwicklung und Bereitstellung des Tools.",
     „Support durch mich bei Problemen."
   - Untertitel „Geplante Weiterentwicklung, Beispiele:" als h3.
   - Fünf Bullets von „Optimierung der Testverfahren" bis
     „Eventuell ein Bereich für Tinnitus-Analyse…".
   - GitHub-Hinweis am Ende.
5. **Sprache auf EN/FR/ES schalten:** Card 1 zeigt für `supportIntro3`,
   `supportIntro4` deutschen Text (Fallback), ebenso `supportKiAbHinweis`,
   `supportPlannedTitle`, `supportPlannedItem1-5`. Andere bestehende
   Texte (Tabellen-Header, Future-Texte) zeigen vorerst noch die
   alten EN/FR/ES-Inhalte mit dem Wort „Vollausbau"/„full build"/
   „déploiement complet"/„versión completa". **Das ist gewollt** und
   wird in BA 236 nachgezogen.
6. **Konsole nach Reload:** keine neuen Errors. (Eine Validator-Warnung
   aus `finanzen.js` darf nicht auftauchen — `finValidate()` prüft nur
   Datenmodell, nicht i18n-Vollständigkeit.)

## Selbstprüfung (Sonnet, vor Fertigmeldung)

Für jeden Punkt einzeln melden: erfüllt / nicht erfüllt / unklar, mit
Datei- und Zeilenangabe.

- [ ] `js/version.js` auf `"3.2.235-beta"`.
- [ ] `js/finanzen.js` Eintrag `kiPro`: `full` auf 44.00.
- [ ] `index.html` Card 1: zwei neue Absätze `supportIntro3` und
  `supportIntro4` zwischen `supportIntro2` und `.support-cta-row`.
- [ ] `index.html` Card 2: vom `supportFinanceGoal`-Absatz bis
  einschließlich `supportGithubHint`-Absatz alles entfernt; statt-
  dessen neu: `supportExplainKi` + `supportKiAbHinweis` am Ende der
  Card; danach **neue Card** `support-card-future` mit dem
  angegebenen Inhalt.
- [ ] `style.css`: `.support-card-graph` mit margin-bottom und
  `.support-ki-history` mit kursiv-grau eingefügt.
- [ ] `i18n/de.js`: 13 Edits laut Schritt 6 (a–l). Geänderte Keys:
  `supportIntro2`, `supportTableHeadFull`, `supportGapCurrent`,
  `supportGapToFull`, `supportExplainKi`, `supportFutureTitle`,
  `supportFuturePlan1`, `supportFuturePlan2`. Neue Keys:
  `supportIntro3`, `supportIntro4`, `supportKiAbHinweis`,
  `supportPlannedTitle`, `supportPlannedItem1`–`5`. Entfernte Keys:
  `supportFinanceGoal`, `supportFutureIntro`, `supportFuturePlan3`,
  `supportFuturePlan4`, `supportFutureConsider`,
  `supportFutureConsider1`, `supportFutureConsider2`.
- [ ] `i18n/en.js`, `fr.js`, `es.js`: **nicht angefaßt** (oder
  optional nur die ersatzlos entfernten Keys mit-gelöscht — siehe
  Schritt 7).
- [ ] Tabellen-Summe links jetzt 54,93 €; Graph zeigt Vollausbau-Linie
  bei 54,93 €.

Wenn alle Punkte erfüllt: Fertig-Bericht mit dem neutralen Hinweis,
daß EN/FR/ES nicht angefaßt wurden — der Nutzer entscheidet selbst,
wann übersetzt wird.
