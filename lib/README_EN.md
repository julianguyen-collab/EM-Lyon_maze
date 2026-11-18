# Tracking a mouse through a physical maze

This library measures relative mouse movement, converts it to centimeters, and interprets it against a maze layout. The position on the table is estimated from calibration and subsequent movement.

## Try the examples

Open the HTML files in a desktop browser with Pointer Lock support. The examples use classic scripts and run directly from disk without a server, dependencies, or a build step. The example interfaces are in French.

| Page | What it shows | Scripts used |
| --- | --- | --- |
| [Minimal border](examples/minimal-bord/index.html) | Calibration, an A3 outline, and mouse position. The page draws the outline itself. | `mouse-position-tracker.js` only |
| [Minimal maze](examples/minimal-maze/index.html) | Calibration, two walls, and a finish area. The library handles drawing and collision detection. | All three classes in `src/` |
| [Minimal calibration](examples/minimal-calibration/index.html) | Five readings, tracking diagnostics, JSON profiles, and a copyable JavaScript variable | `mouse-position-tracker.js` only |
| [Multi-lab](examples/multi-lab/index.html) | Ten layouts, themes, an optional grid, calibration diagnostics, and an event log | Library scripts and separate application files |

The minimal examples keep the integration code, configuration, and CSS in the HTML page. Set `widthCm` and `heightCm` in `size` to match your setup. The default start is at the center of the bottom edge. In `minimal-maze`, the two walls and the finish area are defined in `new Maze(...)`.

Click to calibrate or resume. Press **Space** to record each of the five calibration points, **D** to recenter at the start, and **Esc** to pause.

### Multi-lab

The [Multi-lab example](examples/multi-lab/index.html) starts with an **A3 portrait layout (29.7 × 42 cm)**. The start is at the center of the bottom edge, and tracking continues outside the outline. The default layout has an empty interior. The checkbox enables a 9.9 × 7 cm grid with three columns and six rows.

| Layout | What it contains | File to edit |
| --- | --- | --- |
| Custom outline | An empty layout you can configure | `examples/multi-lab/maze-config.js` |
| Simple course | Two walls with alternating openings and a finish area | `examples/multi-lab/mazes/simple.js` |
| Zigzag | Four walls, an intermediate zone, a finish area, and a grid enabled by default | `examples/multi-lab/mazes/zigzag.js` |
| Obstacles and zones | Rectangular and circular obstacles, two zones, and a finish area | `examples/multi-lab/mazes/obstacles.js` |
| Firefly spiral | A spiral wall, three glowing markers, and a finish area at the center | `examples/multi-lab/mazes/spirale.js` |
| Pebble garden | A course around circular islands, with flower zones and a pond as the finish area | `examples/multi-lab/mazes/jardin.js` |
| Orbital station | A room with two open airlocks, a central reactor, beacons, and an escape pod | `examples/multi-lab/mazes/station.js` |
| MAZE 2 | 60 × 60 cm square layout from the PDF | `examples/multi-lab/mazes/maze-2.js` |
| MAZE 2 · Chemins | Bands from the PDF with free tracking | `examples/multi-lab/mazes/maze-2-paths.js` |
| MAZE 2 · Suivi sur chemins | Same network with tracking projected onto the nearest path | `examples/multi-lab/mazes/maze-2-paths.js` |

Layouts can define their own dimensions. Missing dimensions use the defaults from `maze-config.js`. Switching layouts while paused clears the event log and retains the calibration and estimated position when the dimensions match. A change in dimensions requires a new calibration. The selector is disabled while tracking or while calibration is incomplete.

Choose a layout that matches the physical maze. If the mouse moved while tracking was off, put it back at the start and press **D**. Check that the mouse fits through the openings. The spiral corridors are about 3.5 cm wide and suit a tracked point or a small probe. You can visit zones in any order. The three themed layouts have their own colors and named markers, and the station’s airlocks are fixed openings.

1. Pick a fixed reference point on the mouse, such as the sensor or a mark on the case.
2. Click **Calibrer les coins + retour** (Calibrate corners and return).
3. Line up the same reference point with the bottom-left, bottom-right, top-right, and top-left corners, then return to the bottom-left corner. Press **Space** at each stop. Keep the mouse flat and facing the same direction.
4. Check the corner errors and how far the estimated position drifted on the return. Provisional coordinates appear after the third point. Calibration completes after the fifth.
5. Click **Reprendre le suivi** (Resume tracking), place the reference point at the start, and press **D**. Check the starting coordinates shown in the calibration guide.
6. Press **Esc** to release the pointer. If the mouse moves while tracking is off, recenter it at the start.

To use the recenter button without moving the mouse, put the mouse at the start, focus the button with **Tab**, and press **Enter**.

## Project layout

| File | Purpose |
| --- | --- |
| `src/mouse-position-tracker.js` | `MousePositionTracker` handles Pointer Lock, calibration, and conversion to centimeters. |
| `src/maze.js` | `Maze` handles geometry, estimated collisions, zones, and the optional grid. |
| `src/maze-renderer.js` | `MazeRenderer` draws the maze and position on a canvas. |
| `examples/minimal-bord/index.html` | Minimal example using the tracker alone. |
| `examples/minimal-maze/index.html` | Minimal maze example using all three classes. |
| `examples/minimal-calibration/index.html` | Standalone calibration example with diagnostics and shareable profiles. |
| `examples/multi-lab/index.html` | Full example with a maze selector. |
| `examples/multi-lab/maze-config.js` | Maze dimensions, start, walls, obstacles, zones, finish area, and optional grid. |
| `examples/multi-lab/mazes/*.js` | Definitions for the six preset courses. |
| `examples/multi-lab/app.js` | Connects the classes to the controls, shortcuts, and diagnostics. |
| `examples/multi-lab/style.css` | Styles for the full example. |
| `tests/classes.test.cjs` | Automated tests that run in Node.js. |

The three classes are available on `globalThis`. Copy `src/` into your application and adjust the script paths to match. Load the class scripts before your integration code. You can put classic script tags before an inline script at the end of the page, as in the minimal maze example, or load all the scripts in order with `defer`, including your external integration script. The examples use paths starting with `../../src/`.

To edit the custom layout, change `examples/multi-lab/maze-config.js` and reload the page. This file exposes `globalThis.MAZE_CONFIG` and creates `MAZE_EXAMPLES`. The scripts in `mazes/` add their layouts, and `app.js` builds the selector. To add a preset, copy one of those scripts and load it after `maze-config.js` and before `app.js`. Presets share the calibration dimensions from the custom layout and replace its walls, obstacles, zones, and finish area.

Properties starting with `_` are internal. Methods that read state or configuration return copies you can modify independently.

## Coordinate conventions

- Geometry uses **centimeters**. The origin is the bottom-left corner, with X increasing to the right and Y increasing upward. Raw mouse units need calibration before they can be converted to centimeters.
- The position is the reference point chosen on the mouse.
- By default, tracking reports the measured position, including across walls and between grid lines.
- Each wall, path, obstacle, zone, and finish area needs a unique `id`. The `boundary:` prefix is reserved for the outer edges.
- Use the same dimensions for `MousePositionTracker` and `Maze`.

## Minimal integration

This snippet shows how to connect the classes. See the [complete minimal page](examples/minimal-maze/index.html) for the canvas, buttons, and keyboard handlers.

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

The full example groups redraws with `requestAnimationFrame`. `Maze` still processes each movement, even when several movements arrive between frames.

## MousePositionTracker

Pass `widthCm` and `heightCm`. The optional `element` defaults to `document.body`, and `start` defaults to the center of the bottom edge. Use one tracker per Pointer Lock element. Maze geometry and drawing are handled by the other classes.

| Method | What it does |
| --- | --- |
| `startCalibration()` | Requests Pointer Lock and clears previous samples once the lock is granted. |
| `captureCalibrationPoint()` | Records the current point during an active calibration with Pointer Lock. |
| `resume()` | Requests Pointer Lock and keeps the samples. Start or complete calibration first. |
| `pause()` | Releases Pointer Lock and keeps the calibration. |
| `recenter(position?)` | Sets the known position to `start` or a point in cm and keeps the scale. Requires completed calibration. |
| `exportCalibration()` | Returns a completed calibration profile that can be serialized to JSON. |
| `importCalibration(profile)` | Loads a profile while paused and waits for recentering before reporting the position. |
| `getState()` | Returns a snapshot of the measurements and diagnostics. |
| `destroy()` | Removes listeners and releases the pointer lock. It is safe to call more than once. |

`startCalibration()` and `resume()` return a promise that resolves to a boolean. `true` means the request was sent without an immediate rejection. Use `statechange` and `state.locked` to confirm that the browser granted the lock, especially with older APIs. Browser errors are reported through the `error` event and `state.error`. Invalid calls, such as recentering before calibration, throw an error. `destroy()` ends the tracker’s lifecycle. Create a new tracker to start again.

The tracker uses `EventTarget` events `positionchange`, `calibrationchange`, `statechange`, and `error`. `event.detail` contains a state snapshot and a `reason` such as `movement`, `recenter`, `start`, `capture`, `complete`, `import`, `lock`, or an error code. Use `statechange` to refresh the interface and `positionchange` to handle movements and recentering.

Main state fields

- `position` is `{x, y}` or `null`. Status flags include `calibrated`, `calibrating`, `provisional`, `locked`, and `supported`.
- `needsRecenter` means a loaded profile is waiting for recentering. `position` is `null` until then.
- `raw`, `rawOffset`, and `delta` are the accumulated mouse signal, the signal relative to the first sample, and the last movement.
- `inputMode` is `raw-requested`, `raw-unconfirmed`, or `standard`.
- `error` is `null` or `{code, message}`.
- `calibration` contains `step`, `total`, `target`, `marks`, `measurements`, `unitsPerCm`, `maxCornerErrorCm`, `closureCm`, and `warning`.

The first four points fit an affine transform by averaging opposite sides. Calibration rejects axes that are too close to parallel or corner measurements that differ too much from the expected layout. The fifth point is reserved for measuring drift. `closureCm` is the distance between the first and final readings. `warning` becomes `true` when drift exceeds 0.5 cm. This threshold is a guide.

The tracker requests `unadjustedMovement: true` to bypass system mouse acceleration. If the browser returns `NotSupportedError`, the tracker clears the calibration and the next user click can start a new calibration in standard mode. Older APIs may ignore the option and report `raw-unconfirmed`.

### Save and reuse a calibration

Finish the five measurements in the [standalone calibration example](examples/minimal-calibration/index.html) or in Multi-lab. In **Profil de calibration**, use **Enregistrer le JSON** (Save JSON) or **Copier la variable** (Copy variable). Both examples accept the same profiles. To reuse a file in another session, select it with **Charger un fichier JSON** (Load a JSON file). Resume tracking, place the mouse at the start, and press **D**. In your own page, pass the copied variable to `tracker.importCalibration(calibration)` or pass the result of `JSON.parse()` to load a file.

The JSON contains a version, dimensions, the input mode, and five calibration readings relative to the first corner. The tracker rebuilds the axes and diagnostics when you load it. The previous session’s position is discarded. The dimensions must match the maze. Recalibrate if the input mode changes.

Reuse the profile with the same mouse, DPI, surface, and orientation. Check a known distance along each axis after recentering.

## Maze layout and events

```js
const maze = new Maze({
  widthCm: 29.7, heightCm: 42,
  start: { x: 14.85, y: 0 },
  edgeToleranceCm: 0.25,
  mouseRadiusCm: 0,
  grid: null,
  walls: [
    { id: 'wall-1', from: { x: 9.9, y: 7 }, to: { x: 9.9, y: 28 }, thickness: 0.3 }
  ],
  obstacles: [
    { id: 'block-1', shape: 'rectangle', x: 20, y: 14, width: 4, height: 7 }
  ],
  zones: [
    { id: 'checkpoint-1', shape: 'circle', center: { x: 14.85, y: 21 }, radius: 2 }
  ],
  finish: { id: 'finish', shape: 'rectangle', x: 9.9, y: 35, width: 9.9, height: 7 }
});
```

### Define a path network

Each path is a polyline in centimeters. Each pair of consecutive points defines a segment.

```js
const maze = new Maze({
  widthCm: 60,
  heightCm: 60,
  start: { x: 30, y: 0 },
  paths: [
    { id: 'corridor', points: [{ x: 30, y: 0 }, { x: 30, y: 15 }, { x: 42, y: 15 }] }
  ],
  snapToPath: true
});
```

With `snapToPath: true`, `updatePosition` and `resetPosition` find the closest point across all path segments. Read `maze.getState().position` for the projected point, `rawPosition` for the measured point in centimeters, and `pathProjection` for projection details. The tracker supplies the measurement, and the renderer displays the projection after calibration. Equal distances use the first declared segment. A change of segment checks events at the projected point and skips the straight sweep between samples.

### Walls, obstacles, and zones

Rectangles use their bottom-left corner, width, and height. Circles use `center` and `radius`. A wall follows a line segment with a total thickness in cm and rounded ends. `Maze` creates four zero-thickness boundaries named `boundary:left`, `boundary:right`, `boundary:bottom`, and `boundary:top`.

With `mouseRadiusCm: 0`, wall and obstacle checks use the reference point. A positive radius approximates the mouse body as a circle centered on that point. Choose the radius with the location of the reference point in mind. Zones, the finish area, and `outside` always use the reference point itself.

| Method | What it does |
| --- | --- |
| `updatePosition({x, y})` | Checks the point and the segment from the previous measurement, then emits events. |
| `resetPosition(position = null)` | Sets or clears the reference position without checking a path or emitting events. Use after recentering. |
| `getState()` | Returns the position, signed distances to the edges, `outside`, `nearBorder`, `cell`, contacts, and zones. |
| `getDefinition()` | Returns a copy of the maze configuration. |
| `projectToPath({x, y})` | Returns `{position, pathId, segmentIndex, distanceCm}` or `null` when there are no paths. |
| `setGrid(grid)` | Changes the grid and emits `gridchange`. Pass `null` to disable it. |
| `getCell(position)` | Returns zero-based `{column, row}`, or `null` if the grid is disabled or the point is outside the maze. |

Events include `detail.state` and `detail.previous` except for `gridchange`, which reports `detail.grid`.

| Event | When it occurs | Extra detail field |
| --- | --- | --- |
| `wallenter`, `wallleave` | A measured position starts or ends contact with a wall. | `wallId` |
| `wallcross` | The path segment crosses the wall’s center line and its endpoints are on opposite sides. | `wallId` |
| `walltouch` | The path segment touches the wall between two points that are clear of it. | `wallId` |
| `obstacleenter`, `obstacleleave` | A measured position starts or ends contact with an obstacle. | `obstacleId` |
| `obstaclecross` | The path segment touches an obstacle between two points that are clear of it. | `obstacleId` |
| `zoneenter`, `zoneleave` | A measured position enters or leaves a zone. | `zoneId` |
| `zonecross` | The path segment passes through a zone between two points outside it. | `zoneId` |
| `finish` | The position enters the finish area or the path segment passes through it. | `zoneId` |
| `outofbounds`, `boundsenter` | The point leaves or returns to the maze rectangle. | |
| `cellchange` | The measured position moves to another cell or between a cell and the area outside the grid. | `cell` |
| `positionchange` | The check of a new position finishes. | |
| `gridchange` | The grid changes. | `grid` |

Entry and exit events are emitted when a contact or zone changes. A first measurement inside a wall, obstacle, or zone can emit an entry event. Use `resetPosition()` to set the initial state silently. If a complete pass happens between samples, the maze reports a crossing event such as `wallcross` or `zonecross`. Cell changes use the sampled positions. You can trigger `finish` again by leaving the finish area and coming back.

Movement continues after a collision event. These events estimate contact from the measured positions. An unexpected crossing can signal drift or a mismatch with the physical layout.

## Optional grid

```js
maze.setGrid({ cellWidthCm: 9.9, cellHeightCm: 7 });
renderer.setGridVisible(true);
console.log(maze.getCell({ x: 12.4, y: 8 })); // { column: 1, row: 1 }

renderer.setGridVisible(false); // Hide grid lines and keep cell tracking active.
maze.setGrid(null);             // Turn off cell tracking too.
```

The grid adds cell coordinates to measured positions. Position and collision checks still use the original geometry. The last row and column may contain partial cells, and the top and right edges belong to those last cells. The renderer draws fewer lines when the grid is very fine.

## MazeRenderer

`new MazeRenderer(canvas, maze, { showGrid: false })` draws the outline, walls, obstacles, zones, start, calibration markers, and position. It sizes the canvas buffer to match its CSS dimensions and the device’s pixel density. The view expands to keep a position outside the maze visible.

Use the optional `theme` to set the CSS colors `floor`, `wall`, `zone`, `finish`, `obstacle`, `text`, and `zoneText`. In Multi-lab, the theme is stored alongside `config` and passed to the renderer. Shapes can have a `label` drawn in the center.

- `render(tracker.getState())` draws the position and any calibration markers.
- `render()` redraws the last tracker snapshot. Before receiving one, it uses the position from `Maze`.
- `setGridVisible(boolean)` shows or hides the grid configured in `Maze`.
- `destroy()` stops watching for canvas resizes and grid changes.

Choose when to call `render()` from your application. Set the canvas width and height in CSS as shown in the example.

## Cleanup and physical limitations

When you remove the component, remove your application’s listeners and call:

```js
tracker.destroy();
renderer.destroy();
// Maze has no global listeners or timers. Remove any listeners your app added,
// or pass { signal: abortController.signal } to addEventListener().
```

Keep the mouse flat and facing the same direction throughout tracking. Recenter if the mouse is lifted, turned, or moved while paused. Keep the DPI setting fixed and test at several distances and speeds. Raw input aims to bypass system acceleration. Mouse firmware or vendor software may still affect the signal. Use a surface the sensor can track on, including near the physical edges.

Pointer Lock hides the cursor and requires user interaction. If the example runs inside a sandboxed iframe, the iframe may need `allow-pointer-lock`. [Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API) · [requestPointerLock and unadjusted movement](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)

## Tests

Use a recent Node.js version with `EventTarget`, `CustomEvent`, and `structuredClone`. Run this command from `lib/`:

```sh
node --test tests/classes.test.cjs
```

The tests simulate browser APIs and cover calibration, recentering, events, crossings between measurements, the grid, fallback from raw input, and cleanup. Test Pointer Lock in a real browser and check tracking with your physical setup as well.
