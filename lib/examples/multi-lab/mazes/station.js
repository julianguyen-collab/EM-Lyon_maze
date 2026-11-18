// The central room has two open airlocks and a reactor to go around.
globalThis.MAZE_EXAMPLES.push({
  id: 'station', name: 'Station orbitale',
  description: 'Franchis le sas, contourne le réacteur et rejoins la capsule de secours. Les balises latérales sont des détours facultatifs. Les murs ne s’ouvrent pas automatiquement.',
  theme: { floor: '#191c32', wall: '#a7a6ed', obstacle: '#aa607c', zone: '#304969', finish: '#b7e8d1', text: '#a7a6c7', zoneText: '#ddeaff' },
  config: {
    ...structuredClone(globalThis.MAZE_CONFIG), grid: null,
    walls: [
      { id: 'chambre-gauche', from: { x: 7, y: 15 }, to: { x: 7, y: 31 }, thickness: 0.4 },
      { id: 'chambre-droite', from: { x: 22.7, y: 15 }, to: { x: 22.7, y: 31 }, thickness: 0.4 },
      { id: 'sas-bas-gauche', from: { x: 7, y: 15 }, to: { x: 11, y: 15 }, thickness: 0.4 },
      { id: 'sas-bas-droit', from: { x: 18.7, y: 15 }, to: { x: 22.7, y: 15 }, thickness: 0.4 },
      { id: 'sas-haut-gauche', from: { x: 7, y: 31 }, to: { x: 11, y: 31 }, thickness: 0.4 },
      { id: 'sas-haut-droit', from: { x: 18.7, y: 31 }, to: { x: 22.7, y: 31 }, thickness: 0.4 }
    ],
    obstacles: [{ id: 'reacteur', label: 'Réacteur', shape: 'circle', center: { x: 14.85, y: 23 }, radius: 3 }],
    zones: [
      { id: 'balise-a', label: 'A', shape: 'circle', center: { x: 3.5, y: 23 }, radius: 2 },
      { id: 'balise-b', label: 'B', shape: 'circle', center: { x: 26.2, y: 23 }, radius: 2 },
      { id: 'sas', label: 'Sas', shape: 'rectangle', x: 11.5, y: 10, width: 6.7, height: 3 }
    ],
    finish: { id: 'capsule', label: 'Secours', shape: 'rectangle', x: 10.85, y: 35.5, width: 8, height: 5 }
  }
});
