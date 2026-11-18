// Rectangular and circular obstacles share the space with zones that trigger events.
globalThis.MAZE_EXAMPLES.push({
  id: 'obstacles', name: 'Obstacles et zones',
  description: 'Contourne les blocs gris et traverse les zones bleues avant de rejoindre le vert. Les zones sont informatives : aucun ordre n’est imposé.',
  config: {
    ...structuredClone(globalThis.MAZE_CONFIG), grid: null, walls: [],
    obstacles: [
      { id: 'bloc-bas', shape: 'rectangle', x: 10.85, y: 8, width: 8, height: 6 },
      { id: 'ilot-gauche', shape: 'circle', center: { x: 8, y: 23 }, radius: 3 },
      { id: 'bloc-droit', shape: 'rectangle', x: 19, y: 23, width: 5, height: 8 }
    ],
    zones: [
      { id: 'etape-gauche', shape: 'circle', center: { x: 5, y: 11 }, radius: 2 },
      { id: 'etape-centre', shape: 'circle', center: { x: 14.85, y: 27 }, radius: 2 }
    ],
    finish: { id: 'arrivee', shape: 'rectangle', x: 10.85, y: 36, width: 8, height: 5 }
  }
});
