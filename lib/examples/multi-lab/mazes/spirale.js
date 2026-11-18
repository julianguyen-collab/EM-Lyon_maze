// A single spiral wall leads to the finish at the center.
(() => {
  const vertices = [[4,7],[25.7,7],[25.7,36],[4,36],[4,14],[18.7,14],[18.7,29],[11,29],[11,21]];
  globalThis.MAZE_EXAMPLES.push({
    id: 'spirale', name: 'Spirale des lucioles',
    description: 'Entre par la gauche, puis enroule ton parcours jusqu’au cœur doré. Les trois lucioles bleues jalonnent la spirale. Couloirs étroits : parcours de précision.',
    theme: { floor: '#101f2c', wall: '#77d9c9', zone: '#245368', finish: '#f3ce77', obstacle: '#53677b', text: '#9ab7c7', zoneText: '#d4f7ff' },
    config: {
      ...structuredClone(globalThis.MAZE_CONFIG), grid: null, obstacles: [],
      walls: vertices.slice(1).map(([x,y], i) => ({ id: `spirale-${i+1}`, from: { x: vertices[i][0], y: vertices[i][1] }, to: {x,y}, thickness: 0.3 })),
      zones: [
        { id: 'luciole-1', label: '1', shape: 'circle', center: { x: 14.85, y: 10.5 }, radius: 1.3 },
        { id: 'luciole-2', label: '2', shape: 'circle', center: { x: 7.5, y: 32.5 }, radius: 1.3 },
        { id: 'luciole-3', label: '3', shape: 'circle', center: { x: 7.5, y: 18 }, radius: 1.3 }
      ],
      finish: { id: 'coeur', label: 'Cœur', shape: 'circle', center: { x: 14.85, y: 25 }, radius: 2 }
    }
  });
})();
