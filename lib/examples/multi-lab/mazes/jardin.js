// Weave around the islands. The islands are obstacles and the flowers are zones.
globalThis.MAZE_EXAMPLES.push({
  id: 'jardin', name: 'Jardin des galets',
  description: 'Faufile-toi entre les galets et visite les fleurs A et B avant de rejoindre le bassin. Aucun ordre obligatoire : invente ton chemin.',
  theme: { floor: '#f1f3e5', wall: '#53745c', obstacle: '#829487', zone: '#ecd9a6', finish: '#b5dce0', text: '#53745c', zoneText: '#67522c' },
  config: {
    ...structuredClone(globalThis.MAZE_CONFIG), grid: null, walls: [],
    obstacles: [
      { id: 'galet-1', shape: 'circle', center: { x: 15, y: 9 }, radius: 3.5 },
      { id: 'galet-2', shape: 'circle', center: { x: 8, y: 19 }, radius: 3 },
      { id: 'galet-3', shape: 'circle', center: { x: 22, y: 26 }, radius: 3.5 },
      { id: 'galet-4', shape: 'circle', center: { x: 11, y: 32 }, radius: 2.8 }
    ],
    zones: [
      { id: 'fleur-a', label: 'A', shape: 'circle', center: { x: 5, y: 10 }, radius: 1.8 },
      { id: 'fleur-b', label: 'B', shape: 'circle', center: { x: 15, y: 24 }, radius: 1.8 }
    ],
    finish: { id: 'bassin', label: 'Bassin', shape: 'circle', center: { x: 16, y: 38 }, radius: 2.5 }
  }
});
