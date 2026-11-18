/**
 * Defines the maze layout used by the app.
 * All dimensions are in cm. From the bottom-left corner, X goes right and Y goes up.
 * Give each wall, obstacle, zone, and finish area a unique ID.
 */
globalThis.MAZE_CONFIG = {
  widthCm: 29.7,
  heightCm: 42,
  start: { x: 14.85, y: 0 },
  edgeToleranceCm: 0.25,
  // Optional grid for looking up a cell from a measured position.
  grid: null, // Example: { cellWidthCm: 9.9, cellHeightCm: 7 }.
  mouseRadiusCm: 0, // Zero tracks a point. A positive radius models the mouse body as a circle.

  // Define each wall by its center line and total thickness. Maze adds the outer edges.
  walls: [
    // { id: 'wall-1', from: { x: 9.9, y: 7 }, to: { x: 9.9, y: 28 }, thickness: 0.3 }
  ],
  // For rectangles, x and y mark the bottom-left corner.
  obstacles: [
    // { id: 'block-1', shape: 'rectangle', x: 20, y: 14, width: 4, height: 7 }
  ],
  // Zones trigger events and let the mouse pass through.
  zones: [
    // { id: 'checkpoint-1', shape: 'circle', center: { x: 14.85, y: 21 }, radius: 2 }
  ],
  finish: null // Example: { id: 'finish', shape: 'rectangle', x: 9.9, y: 35, width: 9.9, height: 7 }.
};

// The scripts in mazes/ add presets. Customize the first layout here.
globalThis.MAZE_EXAMPLES = [{
  id: 'personnalise', name: 'Contour libre / personnalisé',
  description: 'Contour seul par défaut. Modifie maze-config.js pour décrire ton propre montage.',
  config: structuredClone(globalThis.MAZE_CONFIG)
}];
