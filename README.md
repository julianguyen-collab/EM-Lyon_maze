# EM-Lyon_maze

Library and examples for tracking a mouse through a physical maze, built for the EM Lyon workshop.

## Application MAZE 2

Ouvre [index.html](index.html) dans un navigateur de bureau. Le marqueur suit le point du réseau le plus proche de la mesure.

Après les cinq relevés, utilise **Enregistrer la calibration** et place `calibration-maze-2.js` à côté de `index.html`. Le profil est chargé au prochain démarrage et reste ignoré par Git. Clique sur **Reprendre le suivi**, place la souris au départ, puis appuie sur **D**.

**Mode démo** agrandit le plan et masque le panneau latéral et le journal. La barre au-dessus du plan affiche **Reprendre le suivi** en pause et rappelle **Échap** pendant le suivi. Utilise **M** pour basculer entre les deux modes.

### Son déclenché par le port COM

1. Dans Chrome ou Edge, ouvre `index.html`. Les quatre MP3 de `assets/mp3/playlist.js` sont disponibles au démarrage. **Tester un son** vérifie la lecture et **Autre dossier MP3** permet de remplacer la sélection pour la session.
2. Sélectionne le débit de ton appareil dans la liste (9 600 par défaut), puis clique sur **Choisir le port COM** et sélectionne-le dans la boîte de dialogue du navigateur.
3. Envoie `PRESS` sur le port série. Chaque message lance un MP3 au hasard. Termine les messages par un retour à la ligne pour les déclencher immédiatement, ou sépare les messages sans retour à la ligne par une courte pause.

Le **Journal de console** affiche les messages reçus du port COM et les diagnostics. Pour inclure de nouveaux sons au démarrage, ajoute leurs noms à `assets/mp3/playlist.js`.

- [English documentation](lib/README_EN.md)
- [Documentation française](lib/README_FR.md)
