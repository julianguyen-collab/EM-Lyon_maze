// Go left around the first wall and right around the second.
globalThis.MAZE_EXAMPLES.push({
  id: 'simple', name: 'Parcours simple',
  description: 'Monte par la gauche du premier mur, puis par la droite du second pour atteindre la zone verte en haut.',
  config: {
    ...structuredClone(globalThis.MAZE_CONFIG), grid: null,
    walls: [
      { id: 'mur-bas', from: { x: 8, y: 12 }, to: { x: 29.7, y: 12 }, thickness: 0.3 },
      { id: 'mur-haut', from: { x: 0, y: 27 }, to: { x: 21.7, y: 27 }, thickness: 0.3 }
    ],
    obstacles: [], zones: [],
    finish: { id: 'arrivee', shape: 'rectangle', x: 10.85, y: 36, width: 8, height: 5 }
  }
});
