// Four 8 cm gaps alternate sides. The grid can be toggled independently of the walls.
globalThis.MAZE_EXAMPLES.push({
  id: 'zigzag', name: 'Zigzag',
  description: 'Contourne quatre murs : gauche, droite, gauche, droite. La zone bleue est un repère intermédiaire ; le vert indique l’arrivée.',
  config: {
    ...structuredClone(globalThis.MAZE_CONFIG), grid: { cellWidthCm: 9.9, cellHeightCm: 7 },
    walls: [
      { id: 'zig-1', from: { x: 8, y: 8 }, to: { x: 29.7, y: 8 }, thickness: 0.3 },
      { id: 'zig-2', from: { x: 0, y: 16 }, to: { x: 21.7, y: 16 }, thickness: 0.3 },
      { id: 'zig-3', from: { x: 8, y: 24 }, to: { x: 29.7, y: 24 }, thickness: 0.3 },
      { id: 'zig-4', from: { x: 0, y: 32 }, to: { x: 21.7, y: 32 }, thickness: 0.3 }
    ],
    obstacles: [],
    zones: [{ id: 'mi-parcours', shape: 'circle', center: { x: 14.85, y: 20 }, radius: 2 }],
    finish: { id: 'arrivee', shape: 'rectangle', x: 10.85, y: 36, width: 8, height: 5 }
  }
});
