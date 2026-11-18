# Suivi d’une souris dans un labyrinthe physique

Le projet mesure des déplacements relatifs de souris, les convertit en centimètres,
puis les interprète dans un labyrinthe. Il ne mesure pas une position absolue sur la table.

## Essayer l’exemple

Trois pages complètes, ouvrables directement sans installation :

| Page | Usage | Scripts externes nécessaires |
| --- | --- | --- |
| [Minimal : bord seul](examples/minimal-bord/index.html) | Calibration, contour A3 et position ; dessin élémentaire dans le HTML | `mouse-position-tracker.js` uniquement |
| [Minimal : maze simple](examples/minimal-maze/index.html) | Calibration, deux murs et arrivée ; dessin et collisions via les classes | Les trois classes de `src/` |
| [Multi-lab](examples/multi-lab/index.html) | Catalogue de sept labyrinthes, thèmes, grille, diagnostics et journal | Classes et fichiers d’application séparés |

Les deux exemples minimaux n’incluent ni fichier de configuration, ni CSS externe,
ni script d’application supplémentaire : tout leur code d’intégration est visible
dans leur page HTML. La seule dimension à régler est l’objet `size` (`widthCm`, `heightCm`).
Le départ au milieu du bord inférieur est fourni par défaut. Dans `minimal-maze`,
les deux murs et l’arrivée sont définis directement dans `new Maze(...)`.
Les commandes sont identiques : clic pour calibrer/reprendre, Espace pour les cinq
relevés, D pour recaler au départ, Échap pour mettre en pause.

### Multi-lab

Ouvrir **[examples/multi-lab/index.html](examples/multi-lab/index.html)** dans un navigateur de bureau
compatible avec Pointer Lock. Les scripts classiques permettent une ouverture directe
du fichier : aucun paquet à installer ni étape de compilation.

L’exemple reprend le rectangle A3 portrait de **29,7 × 42 cm**, le départ au milieu
du bord inférieur, la calibration avec diagnostics et le suivi libre hors des limites.
Il commence sans murs intérieurs, sans arrivée et sans grille. La case à cocher active
une grille facultative de 9,9 × 7 cm, soit 3 colonnes et 6 lignes.

Le sélecteur en haut de page propose sept exemples :

| Exemple | Contenu | Fichier à modifier |
| --- | --- | --- |
| Contour libre / personnalisé | Définition personnelle, vide par défaut | `examples/multi-lab/maze-config.js` |
| Parcours simple | Deux cloisons, passages alternés, arrivée | `examples/multi-lab/mazes/simple.js` |
| Zigzag | Quatre cloisons, zone intermédiaire, arrivée ; grille active par défaut | `examples/multi-lab/mazes/zigzag.js` |
| Obstacles et zones | Blocs rectangulaires et circulaire, deux zones et arrivée | `examples/multi-lab/mazes/obstacles.js` |
| Spirale des lucioles | Une cloison enroulée, trois repères lumineux, arrivée au cœur ; ambiance nocturne | `examples/multi-lab/mazes/spirale.js` |
| Jardin des galets | Slalom entre des îlots circulaires, fleurs à visiter et bassin d’arrivée | `examples/multi-lab/mazes/jardin.js` |
| Station orbitale | Chambre à deux sas ouverts, réacteur central, balises et capsule de secours | `examples/multi-lab/mazes/station.js` |

Tous utilisent le même rectangle A3. Changer d’exemple en pause conserve la calibration
et la position estimée, réinitialise le journal et ne simule aucun déplacement.
Le changement est désactivé pendant le suivi et pendant une calibration inachevée.
Le dessin sélectionné doit correspondre au montage physique ; placer la souris au départ
et utiliser D si elle a été déplacée sans suivi. Vérifier la largeur des passages par rapport
au boîtier réel : la spirale possède notamment des couloirs d’environ 3,5 cm et cible
un point suivi ou une petite sonde, plutôt qu’une souris large entre des cloisons.
Les zones sont des repères sans ordre obligatoire. Les trois parcours thématiques
ont leur propre palette et des repères nommés ; leurs sas sont des passages fixes.

1. Choisir un point de référence fixe sur la souris : capteur ou trait visible sur le boîtier.
2. Cliquer sur **Calibrer les coins + retour**.
3. Aligner le même point sur bas gauche → bas droit → haut droit → haut gauche → bas gauche.
   Valider chaque arrêt avec **Espace**, sans soulever ni tourner la souris.
4. Examiner les écarts et la dérive au retour. Les coordonnées sont provisoires après
   le troisième point ; la calibration n’est complète qu’après le cinquième.
5. Cliquer sur **Reprendre le suivi**, placer le point choisi au départ, appuyer sur **D**.
   L’affichage doit donner X = 14,85 cm, Y = 0 cm.
6. **Échap** libère le pointeur. Après tout déplacement non suivi, se recaler au départ.

Le bouton de recalage peut être activé au clavier (Tab puis Entrée), une fois la souris
physiquement placée au départ. Cliquer avec la souris risquerait de la déplacer.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `src/mouse-position-tracker.js` | Classe `MousePositionTracker` : Pointer Lock, calibration, conversion en cm |
| `src/maze.js` | Classe `Maze` : géométrie, collisions estimées, zones, grille optionnelle |
| `src/maze-renderer.js` | Classe `MazeRenderer` : affichage canvas, sans modifier les mesures |
| `examples/minimal-bord/index.html` | Exemple autonome : bord seul, un seul script inclus |
| `examples/minimal-maze/index.html` | Exemple autonome : labyrinthe simple, trois classes incluses |
| `examples/multi-lab/index.html` | Application complète avec sélecteur de labyrinthes |
| `examples/multi-lab/maze-config.js` | Description du labyrinthe : dimensions, départ, murs, obstacles, zones, arrivée et grille optionnelle |
| `examples/multi-lab/mazes/*.js` | Descriptions des six parcours prédéfinis |
| `examples/multi-lab/app.js` | Liaison entre classes, boutons, raccourcis et diagnostics |
| `examples/multi-lab/style.css` | Présentation de l’exemple |
| `tests/classes.test.cjs` | Tests automatiques, exécutables avec Node.js |

Les trois classes sont exposées sur `globalThis`. Les charger dans l’ordre de l’exemple
avec des balises `<script defer src="…"></script>`, puis charger le code d’intégration.
Depuis l’exemple, les chemins vers les classes commencent par `../../src/`.
Pour une autre application, reprendre `src/` et adapter ces chemins à sa propre page.

Pour modifier le labyrinthe de l’exemple, éditer **`examples/multi-lab/maze-config.js`**,
puis recharger la page. Ce fichier expose `globalThis.MAZE_CONFIG` et doit être chargé
avant `app.js`. La description reste ainsi séparée du code de l’interface et des classes.
`maze-config.js` initialise également `MAZE_EXAMPLES`. Les fichiers `mazes/*.js` y ajoutent
leurs définitions, puis `app.js` construit le sélecteur. Pour ajouter un exemple, reprendre
un de ces fichiers et charger son script après `maze-config.js`, avant `app.js` dans la page.
Les exemples doivent partager les dimensions de calibration. La description personnelle
sert de base commune aux exemples ; leurs murs, obstacles, zones et arrivée sont remplacés.
Elles ne demandent aucun framework. Les propriétés préfixées par `_` sont internes.
Les méthodes de lecture renvoient des copies ; modifier une copie ne modifie pas la classe.

## Conventions

- Toutes les coordonnées géométriques sont en **cm** : origine au coin bas gauche,
  X vers la droite, Y vers le haut. Les unités souris ne sont pas des cm.
- La position désigne le point de référence choisi, et non automatiquement le centre du boîtier.
- Les positions ne sont ni bloquées par les murs, ni arrondies sur une grille.
- Les objets doivent posséder un `id` unique. Le préfixe `boundary:` est réservé aux bords.
- Les dimensions du tracker et de `Maze` doivent être identiques dans une même intégration.

## Intégration minimale

```js
const config = {
  widthCm: 29.7,
  heightCm: 42,
  start: { x: 14.85, y: 0 }
};
const tracker = new MousePositionTracker({ element: document.body, ...config });
const maze = new Maze(config);
const renderer = new MazeRenderer(document.querySelector('canvas'), maze);

// Check collisions only after calibration is complete.
tracker.addEventListener('positionchange', ({ detail: s }) => {
  if (!s.calibrated || s.provisional) return;
  if (s.reason === 'recenter') maze.resetPosition(s.position);
  else maze.updatePosition(s.position);
});
tracker.addEventListener('calibrationchange', ({ detail: s }) => {
  maze.resetPosition(s.calibrated ? s.position : null);
});
tracker.addEventListener('error', ({ detail: s }) => {
  if (!s.calibrated) maze.resetPosition();
});
tracker.addEventListener('statechange', ({ detail: s }) => {
  renderer.render(s);
  console.log(s.position, s.calibration);
});

// Request Pointer Lock from a user click.
calibrateButton.onclick = () => tracker.startCalibration();
resumeButton.onclick = () => tracker.resume();
// Bind Space to captureCalibrationPoint() and D to recenter().
```

L’exemple complet regroupe les rafraîchissements visuels avec `requestAnimationFrame`.
Chaque mouvement reste traité par `Maze`, même si plusieurs arrivent entre deux images.

## MousePositionTracker

Options : `element` (par défaut `document.body`), `widthCm`, `heightCm`, `start`
(par défaut milieu du bord inférieur). Aucun mur, zone, grille ou dessin n’appartient au tracker.
Utiliser un seul tracker par élément de verrouillage.

| Méthode | Effet |
| --- | --- |
| `startCalibration()` | Demande le verrouillage, puis remet à zéro les relevés lorsqu’il est accordé |
| `captureCalibrationPoint()` | Enregistre le point courant ; nécessite une calibration verrouillée |
| `resume()` | Demande le verrouillage et conserve les mesures ; calibration commencée ou complète requise |
| `pause()` | Libère le pointeur sans effacer la calibration |
| `recenter(position?)` | Recale sur `start` ou une position en cm, sans changer l’échelle ; calibration complète requise |
| `getState()` | Renvoie un instantané de la mesure et de ses diagnostics |
| `destroy()` | Retire les écouteurs et libère son verrouillage ; appel répétable |

`startCalibration()` et `resume()` renvoient une promesse booléenne. `true` signifie que
la requête a été transmise sans rejet immédiat ; **l’événement et `state.locked` font foi**
pour l’acquisition réelle, notamment avec les anciennes API. Les erreurs navigateur sont
publiées via `error` et `state.error`. Les appels invalides (par exemple recaler sans
calibration) lèvent une exception. Après `destroy()`, les commandes sont interdites.

Événements `EventTarget` : `positionchange`, `calibrationchange`, `statechange`, `error`.
Leur `event.detail` contient l’état et un champ `reason` : `movement`, `recenter`,
`start`, `capture`, `complete`, `lock`, ou un code d’erreur. `statechange` permet
de rafraîchir toute l’interface. `positionchange` concerne les mouvements et le recalage.

Champs principaux de l’état :

- `position` : `{x, y}` ou `null`, `calibrated`, `calibrating`, `provisional`, `locked`, `supported`.
- `raw`, `rawOffset`, `delta` : signal cumulé, relatif au premier relevé, dernier mouvement.
- `inputMode` : `raw-requested`, `raw-unconfirmed` ou `standard`.
- `error` : `null` ou `{code, message}`.
- `calibration` : `step`, `total`, `target`, `marks`, `measurements`, `unitsPerCm`,
  `maxCornerErrorCm`, `closureCm`, `warning`.

Les quatre premiers points ajustent une transformation affine en moyennant les côtés
opposés. Les axes trop proches ou les coins trop incohérents sont refusés. Le cinquième
point ne modifie pas l’ajustement : `closureCm` mesure la dérive entre départ et retour.
`warning` devient vrai au-delà de 0,5 cm : c’est un seuil indicatif, pas une certification.

Le tracker demande `unadjustedMovement: true` pour éviter l’accélération système.
Si le navigateur renvoie `NotSupportedError`, il invalide la calibration et demande
un nouveau clic pour recommencer en mode standard. Il ne mélange pas les deux échelles.
Une ancienne API peut ignorer l’option : le mode brut n’est alors pas confirmé.

## Maze : description physique et événements

```js
const maze = new Maze({
  widthCm: 29.7, heightCm: 42,
  start: { x: 14.85, y: 0 },
  edgeToleranceCm: 0.25,
  mouseRadiusCm: 0,
  grid: null,
  walls: [
    { id: 'mur-1', from: { x: 9.9, y: 7 }, to: { x: 9.9, y: 28 }, thickness: 0.3 }
  ],
  obstacles: [
    { id: 'bloc-1', shape: 'rectangle', x: 20, y: 14, width: 4, height: 7 }
  ],
  zones: [
    { id: 'etape-1', shape: 'circle', center: { x: 14.85, y: 21 }, radius: 2 }
  ],
  finish: { id: 'arrivee', shape: 'rectangle', x: 9.9, y: 35, width: 9.9, height: 7 }
});
```

Les rectangles sont définis par leur coin inférieur gauche, largeur et hauteur.
Les cercles utilisent `center` et `radius`. Un mur est un segment central avec une épaisseur
totale en cm et des bouts arrondis (capsule). Les quatre bords extérieurs sont automatiques :
`boundary:left`, `boundary:right`, `boundary:bottom`, `boundary:top`, sans épaisseur.

`mouseRadiusCm: 0` suit un point. Une valeur positive utilise un disque centré sur ce point
pour les contacts avec murs et obstacles. C’est une approximation : aucun rectangle orienté
du boîtier ni décalage capteur/boîtier n’est modélisé. Les zones, l’arrivée et l’état
`outside` concernent toujours le point de référence ; ils ne sont pas dilatés par ce rayon.

| Méthode | Effet |
| --- | --- |
| `updatePosition({x, y})` | Analyse le point et le segment depuis la mesure précédente ; émet les événements |
| `resetPosition(position = null)` | Change la référence sans événement ni analyse du trajet ; à utiliser après recalage |
| `getState()` | Position, distances signées aux bords, `outside`, `nearBorder`, `cell`, contacts et zones |
| `getDefinition()` | Copie de la configuration géométrique |
| `setGrid(grid)` | Active ou désactive la grille logique ; émet uniquement `gridchange` |
| `getCell(position)` | `{column, row}` à partir de zéro, ou `null` hors rectangle / sans grille |

Événements (chacun contient `detail.state` et `detail.previous`) :

| Événement | Sens et champ supplémentaire |
| --- | --- |
| `wallenter`, `wallleave` | Début/fin de contact à une position mesurée ; `wallId` |
| `wallcross` | Le segment passe strictement d’un côté à l’autre du segment central du mur ; `wallId` |
| `walltouch` | Le segment touche le volume du mur entre deux points hors contact ; `wallId` |
| `obstacleenter`, `obstacleleave` | Entrée/sortie d’un obstacle ; `obstacleId` |
| `obstaclecross` | Contact avec un obstacle entre deux points extérieurs ; `obstacleId` |
| `zoneenter`, `zoneleave` | Entrée/sortie d’une zone à un point mesuré ; `zoneId` |
| `zonecross` | Passage dans une zone entre deux points extérieurs ; `zoneId` |
| `finish` | Entrée ou passage dans l’arrivée ; `zoneId` |
| `outofbounds`, `boundsenter` | Sortie / retour du point dans le rectangle |
| `cellchange` | Changement de case lorsque la grille est active ; `cell` |
| `positionchange` | Fin de l’analyse de chaque nouvelle position |
| `gridchange` | Grille modifiée ; `grid` (pas de `state`/`previous` pour cet événement) |

Les événements d’entrée/sortie se produisent lors des transitions, pas à chaque mouvement
dans un contact existant. Un contact découvert dès la première mesure produit un événement
d’entrée. `resetPosition()` initialise au contraire silencieusement cet état.
Un passage complet entre deux mesures produit `wallcross`/`zonecross` plutôt qu’une paire
artificielle d’événements d’entrée/sortie. Les changements de case concernent seulement
les cases des positions échantillonnées, pas toutes les cases traversées par le segment.
Une arrivée peut être déclenchée à nouveau si on en sort puis y revient.

Ces événements n’empêchent aucun mouvement et ne prouvent pas un contact physique.
Un franchissement estimé peut signaler une dérive ou un écart avec le montage réel.

## Grille facultative

```js
maze.setGrid({ cellWidthCm: 9.9, cellHeightCm: 7 });
renderer.setGridVisible(true);
console.log(maze.getCell({ x: 12.4, y: 8 })); // { column: 1, row: 1 }

renderer.setGridVisible(false); // Hide grid lines and keep cell tracking active.
maze.setGrid(null);             // Turn off cell tracking too.
```

La grille ne déplace rien, n’aligne aucun mur et ne change aucune collision.
Les dernières cases peuvent être partielles. Le bord droit/haut appartient à la dernière
case. À l’affichage, les grilles très fines sont espacées pour limiter le nombre de lignes.

## MazeRenderer

`new MazeRenderer(canvas, maze, {showGrid: false})` dessine le contour, les murs,
obstacles, zones, départ, repères de calibration et la position. Il adapte la résolution
du canvas à sa taille CSS et à la densité de pixels. La vue s’élargit pour montrer une
position extérieure, sans la bloquer.

L’option facultative `theme` personnalise `floor`, `wall`, `zone`, `finish`, `obstacle`,
`text` et `zoneText` (couleurs CSS). Dans le catalogue, elle appartient à l’exemple,
hors de `config`, et est transmise au renderer par l’application. Les formes peuvent
porter un champ `label` pour afficher un nom ou une lettre en leur centre.

- `render(tracker.getState())` : afficher les diagnostics visuels de calibration et la position.
- `render()` : redessiner le dernier état reçu ; sans état tracker, utiliser la position de `Maze`.
- `setGridVisible(boolean)` : montrer/masquer la grille configurée dans `Maze`.
- `destroy()` : retirer l’observation de taille et l’écoute de grille.

Le renderer ne s’abonne pas automatiquement aux mesures : l’application choisit sa cadence.
Donner une largeur et une hauteur CSS au canvas (comme dans l’exemple).

## Nettoyage et limites

Quand le composant est démonté, retirer ses propres écouteurs et appeler :

```js
tracker.destroy();
renderer.destroy();
// Maze has no global listeners or timers. Remove any listeners your app added,
// or pass { signal: abortController.signal } to addEventListener().
```

La souris doit rester orientée pareil et en contact avec la surface. Un soulèvement,
une rotation ou un déplacement en pause ne peut pas être reconstruit. Garder les mêmes DPI
et vérifier plusieurs distances/vitesses. Le mode brut vise l’accélération du système,
pas toutes les transformations possibles d’un firmware ou logiciel constructeur.
La surface doit permettre au capteur de fonctionner, y compris près des bords physiques.
Pointer Lock masque le curseur et exige une interaction utilisateur ; une intégration dans
une iframe peut nécessiter l’autorisation `allow-pointer-lock` de son conteneur sandboxé.

Références : [Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API),
[requestPointerLock et mouvements non ajustés](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock).

## Tests

Avec une version récente de Node.js disposant de `EventTarget`, `CustomEvent` et `structuredClone` :

```sh
node --test tests/classes.test.cjs
```

Les tests vérifient la calibration, le recalage, les événements, les franchissements entre
mesures, la grille, le repli d’entrée brute et le nettoyage avec un navigateur simulé.
Ils ne remplacent pas un essai Pointer Lock réel ni la validation physique sur la table.
