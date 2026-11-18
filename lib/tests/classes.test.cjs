const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Path2D {
  constructor(data) { this.data = data; }
}

// Load the library with simulated browser APIs.
function runtime() {
  const context = vm.createContext({ EventTarget, CustomEvent, structuredClone, Path2D, console });
  for (const name of ['mouse-position-tracker.js', 'maze.js', 'maze-renderer.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', name), 'utf8'), context);
  }
  return context;
}
function browser() {
  const doc = new EventTarget();
  doc.pointerLockElement = null;
  const element = { ownerDocument: doc };
  element.requestPointerLock = options => {
    element.lastOptions = options;
    doc.pointerLockElement = element;
    doc.dispatchEvent(new Event('pointerlockchange'));
    return Promise.resolve();
  };
  doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.dispatchEvent(new Event('pointerlockchange')); };
  const move = (x, y) => {
    const e = new Event('mousemove'); e.movementX = x; e.movementY = y; doc.dispatchEvent(e);
  };
  return { doc, element, move };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`);
const plain = value => JSON.parse(JSON.stringify(value));
function loadExamples(context) {
  for (const name of ['maze-config.js', 'mazes/simple.js', 'mazes/zigzag.js', 'mazes/obstacles.js', 'mazes/spirale.js', 'mazes/jardin.js', 'mazes/station.js', 'mazes/maze-2.js', 'mazes/maze-2-paths.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'examples', 'multi-lab', name), 'utf8'), context);
  }
}
async function calibrate(tracker, b, returnDrift = 0) {
  await tracker.startCalibration();
  tracker.captureCalibrationPoint();
  b.move(2970, 0); tracker.captureCalibrationPoint();
  b.move(0, -4200); tracker.captureCalibrationPoint();
  b.move(-2970, 0); tracker.captureCalibrationPoint();
  b.move(returnDrift, 4200); tracker.captureCalibrationPoint();
}
function observe(target, names) {
  const events = [];
  for (const type of names) target.addEventListener(type, e => events.push({ type, ...e.detail }));
  return events;
}

test('A3 : position provisoire, cinq relevés, dérive indépendante et recalage', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const tracker = new MousePositionTracker({ element: b.element, widthCm: 29.7, heightCm: 42 });
  const events = observe(tracker, ['calibrationchange', 'positionchange']);
  await tracker.startCalibration();
  assert.equal(b.element.lastOptions.unadjustedMovement, true);
  tracker.captureCalibrationPoint();
  b.move(2970, 0); tracker.captureCalibrationPoint();
  assert.equal(tracker.getState().position, null);
  b.move(0, -4200); tracker.captureCalibrationPoint();
  near(tracker.getState().position.y, 42);
  assert.equal(tracker.getState().provisional, true);
  b.move(-2970, 0); tracker.captureCalibrationPoint();
  assert.equal(tracker.getState().calibrated, false);
  assert.equal(tracker.getState().calibration.step, 5);
  b.move(10, 4200); tracker.captureCalibrationPoint();
  const s = tracker.getState();
  assert.equal(s.calibrated, true); assert.equal(s.locked, false);
  near(s.calibration.closureCm, 0.1);
  near(s.calibration.unitsPerCm.x, 100); near(s.calibration.unitsPerCm.y, 100);
  near(s.calibration.maxCornerErrorCm, 0);
  assert.equal(s.calibration.measurements.length, 5);
  tracker.recenter(); near(tracker.getState().position.x, 14.85); near(tracker.getState().position.y, 0);
  assert.equal(events.at(-1).reason, 'recenter');
  const snapshot = tracker.getState(); snapshot.config.start.x = 999;
  tracker.recenter(); near(tracker.getState().position.x, 14.85);
  tracker.destroy(); tracker.destroy();
  assert.throws(() => tracker.recenter(), /détruit/);
});

test('axes inclinés et erreurs de placement : les quatre coins contribuent au modèle', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const t = new MousePositionTracker({ element: b.element, widthCm: 29.7, heightCm: 42 });
  await t.startCalibration();
  t.captureCalibrationPoint(); b.move(2970, 100); t.captureCalibrationPoint();
  b.move(200, -4200); t.captureCalibrationPoint();
  b.move(-2970, -100); t.captureCalibrationPoint();
  b.move(-200, 4200); t.captureCalibrationPoint();
  await t.resume(); b.move(1585, -2050);
  near(t.getState().position.x, 14.85); near(t.getState().position.y, 21);
  t.destroy();

  const b2 = browser(), t2 = new MousePositionTracker({ element: b2.element, widthCm: 29.7, heightCm: 42 });
  await t2.startCalibration();
  t2.captureCalibrationPoint(); b2.move(2970, 0); t2.captureCalibrationPoint();
  b2.move(20, -4200); t2.captureCalibrationPoint();
  b2.move(-2990, 0); t2.captureCalibrationPoint(); b2.move(0, 4200); t2.captureCalibrationPoint();
  assert.ok(t2.getState().calibration.maxCornerErrorCm > 0);
  assert.ok(t2.getState().calibration.measurements.slice(0, 4).every(m => m.errorCm > 0));
  t2.destroy();
});

test('pause et reprise conservent les relevés ; coins dégénérés refusés', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const t = new MousePositionTracker({ element: b.element, widthCm: 29.7, heightCm: 42 });
  assert.throws(() => t.resume(), /calibration/);
  await t.startCalibration(); t.captureCalibrationPoint();
  t.pause(); b.move(500, 500);
  near(t.getState().raw.x, 0);
  await t.resume(); assert.equal(t.getState().calibration.step, 2);
  t.captureCalibrationPoint(); t.captureCalibrationPoint();
  assert.equal(t.captureCalibrationPoint(), false);
  assert.equal(t.getState().error.code, 'calibration');
  assert.equal(t.getState().locked, false);
  t.destroy();
});

test('entrée brute indisponible : échelle invalidée puis demande standard au clic suivant', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const t = new MousePositionTracker({ element: b.element, widthCm: 29.7, heightCm: 42 });
  await calibrate(t, b);
  const original = b.element.requestPointerLock;
  b.element.requestPointerLock = () => Promise.reject(Object.assign(new Error(), { name: 'NotSupportedError' }));
  assert.equal(await t.resume(), false);
  assert.equal(t.getState().calibrated, false); assert.equal(t.getState().position, null);
  assert.equal(t.getState().error.code, 'raw-unsupported');
  b.element.requestPointerLock = original;
  await t.startCalibration(); assert.equal(b.element.lastOptions.unadjustedMovement, false);
  assert.equal(t.getState().inputMode, 'standard');
  t.destroy();
});

test('profil JSON : mêmes axes et diagnostics, position inconnue jusqu’au recalage', async () => {
  const { MousePositionTracker } = runtime(), source = browser(), target = browser();
  const dimensions = { widthCm: 29.7, heightCm: 42 };
  const tracker = new MousePositionTracker({ ...dimensions, element: source.element });
  assert.throws(() => tracker.exportCalibration(), /complète/);
  await tracker.startCalibration();
  source.move(50, 80); tracker.captureCalibrationPoint();
  source.move(2970, 100); tracker.captureCalibrationPoint();
  source.move(200, -4200); tracker.captureCalibrationPoint();
  source.move(-2970, -100); tracker.captureCalibrationPoint();
  source.move(-190, 4200); tracker.captureCalibrationPoint();
  const profile = plain(tracker.exportCalibration());
  assert.equal(profile.version, 1);
  assert.equal(profile.inputMode, 'raw-requested');
  assert.deepEqual(profile.samples[0], { x: 0, y: 0 });
  tracker.recenter({ x: 5, y: 10 });
  assert.deepEqual(plain(tracker.exportCalibration()), profile);

  const restored = new MousePositionTracker({ ...dimensions, element: target.element });
  const events = observe(restored, ['calibrationchange', 'positionchange']);
  restored.importCalibration(profile);
  assert.equal(events[0].reason, 'import');
  assert.equal(restored.getState().position, null);
  assert.equal(restored.getState().needsRecenter, true);
  near(restored.getState().calibration.closureCm, tracker.getState().calibration.closureCm);
  assert.deepEqual(plain(restored.exportCalibration()), profile);
  assert.throws(() => restored.recenter(), /Reprends le suivi/);
  await restored.resume();
  target.move(300, 100);
  assert.equal(restored.getState().position, null);
  assert.equal(events.length, 1);
  restored.recenter();
  assert.equal(events[1].reason, 'recenter');
  assert.equal(restored.getState().needsRecenter, false);
  target.move(1585, -2050);
  near(restored.getState().position.x, 29.7);
  near(restored.getState().position.y, 21);
  tracker.destroy(); restored.destroy();
});

test('profil invalide préserve le tracker et un changement de mode bloque le suivi', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const tracker = new MousePositionTracker({ widthCm: 29.7, heightCm: 42, element: b.element });
  await calibrate(tracker, b);
  const profile = plain(tracker.exportCalibration());
  assert.throws(() => tracker.importCalibration({ ...profile, version: 2 }), /Version/);
  assert.throws(() => tracker.importCalibration({ ...profile, widthCm: 30 }), /dimensions/);
  assert.throws(() => tracker.importCalibration({ ...profile, samples: Array(5) }), /relevés invalides/);
  assert.throws(() => tracker.importCalibration({ ...profile, samples: Array(5).fill({ x: 0, y: 0 }) }), /axes incohérents/);
  assert.deepEqual(plain(tracker.exportCalibration()), profile);
  assert.equal(tracker.getState().needsRecenter, false);

  tracker.importCalibration({ ...profile, inputMode: 'standard' });
  await tracker.resume();
  assert.equal(b.element.lastOptions.unadjustedMovement, false);
  assert.throws(() => tracker.importCalibration(profile), /pause/);
  tracker.pause();

  tracker.importCalibration(profile);
  b.element.requestPointerLock = () => undefined;
  assert.equal(await tracker.resume(), false);
  assert.equal(tracker.getState().error.code, 'input-mode-changed');
  assert.equal(tracker.getState().calibrated, false);
  b.doc.pointerLockElement = b.element;
  b.doc.dispatchEvent(new Event('pointerlockchange'));
  assert.equal(b.doc.pointerLockElement, null);
  assert.equal(tracker.getState().position, null);
  tracker.destroy();
});

test('destruction : plus de mesures, verrou libéré même si acquisition tardive', async () => {
  const { MousePositionTracker } = runtime(), b = browser();
  const t = new MousePositionTracker({ element: b.element, widthCm: 29.7, heightCm: 42 });
  await calibrate(t, b); await t.resume(); t.destroy();
  assert.equal(b.doc.pointerLockElement, null);
  const before = t.getState().raw.x; b.move(100, 0); near(t.getState().raw.x, before);
  const b2 = browser(), t2 = new MousePositionTracker({ element: b2.element, widthCm: 29.7, heightCm: 42 });
  let resolve;
  b2.element.requestPointerLock = () => new Promise(r => { resolve = r; });
  const pending = t2.startCalibration(); t2.destroy();
  b2.doc.pointerLockElement = b2.element; b2.doc.dispatchEvent(new Event('pointerlockchange')); resolve();
  await pending; assert.equal(b2.doc.pointerLockElement, null);
});

test('grille optionnelle, cases partielles et derniers bords sans modifier les coordonnées', () => {
  const { Maze } = runtime(), m = new Maze({ widthCm: 29.7, heightCm: 42 });
  const events = observe(m, ['cellchange', 'wallcross']);
  m.resetPosition({ x: 12.4, y: 8 });
  assert.equal(m.getCell({ x: 12.4, y: 8 }), null);
  m.setGrid({ cellWidthCm: 3, cellHeightCm: 7 });
  assert.deepEqual(plain(m.getState().position), { x: 12.4, y: 8 });
  assert.deepEqual(plain(m.getCell({ x: 29.7, y: 42 })), { column: 9, row: 5 });
  assert.equal(m.getCell({ x: 30, y: 1 }), null);
  assert.equal(events.length, 0);
  m.updatePosition({ x: 15.1, y: 8 }); assert.equal(events[0].type, 'cellchange');
  m.setGrid(null); assert.equal(m.getState().cell, null);
  assert.throws(() => m.setGrid({ cellWidthCm: 0, cellHeightCm: 1 }));
  assert.throws(() => m.updatePosition({ x: NaN, y: 0 }));
});

test('mur fin : franchissement entre deux points extérieurs, contact et fin de contact', () => {
  const { Maze } = runtime(), m = new Maze({ widthCm: 30, heightCm: 42,
    walls: [{ id: 'thin', from: { x: 10, y: 5 }, to: { x: 10, y: 20 }, thickness: 0.1 }] });
  const events = observe(m, ['wallcross', 'wallenter', 'wallleave', 'walltouch']);
  m.resetPosition({ x: 9, y: 10 }); m.updatePosition({ x: 11, y: 10 });
  assert.deepEqual(events.map(e => e.type), ['wallcross']); assert.equal(events[0].wallId, 'thin');
  m.resetPosition({ x: 9, y: 10 }); events.length = 0;
  m.updatePosition({ x: 9.98, y: 10 }); m.updatePosition({ x: 9.99, y: 10 }); m.updatePosition({ x: 9, y: 10 });
  assert.deepEqual(events.map(e => e.type), ['wallenter', 'wallleave']);
  events.length = 0; m.resetPosition({ x: 11, y: 10 }); assert.equal(events.length, 0);
});

test('rayon de souris, bouts de murs arrondis et contact entre mesures', () => {
  const { Maze } = runtime(), m = new Maze({ widthCm: 30, heightCm: 42, mouseRadiusCm: 0.5,
    walls: [{ id: 'wall', from: { x: 10, y: 5 }, to: { x: 10, y: 20 }, thickness: 0.2 }] });
  m.resetPosition({ x: 9.5, y: 10 }); assert.ok(m.getState().wallIds.includes('wall'));
  const events = observe(m, ['walltouch', 'wallcross']);
  m.resetPosition({ x: 8, y: 4.5 }); m.updatePosition({ x: 12, y: 4.5 });
  assert.deepEqual(events.map(e => e.type), ['walltouch']);
});

test('obstacles, zones et arrivée détectés même si le trajet saute leur intérieur', () => {
  const { Maze } = runtime(), m = new Maze({ widthCm: 30, heightCm: 42,
    obstacles: [{ id: 'block', shape: 'rectangle', x: 5, y: 5, width: 1, height: 2 }],
    zones: [{ id: 'checkpoint', shape: 'circle', center: { x: 10, y: 6 }, radius: 1 }],
    finish: { id: 'end', shape: 'rectangle', x: 15, y: 5, width: 1, height: 2 } });
  const events = observe(m, ['obstaclecross', 'zonecross', 'finish', 'zoneenter', 'zoneleave']);
  m.resetPosition({ x: 2, y: 6 }); m.updatePosition({ x: 18, y: 6 });
  assert.deepEqual(events.map(e => e.type), ['obstaclecross', 'zonecross', 'finish']);
  events.length = 0; m.resetPosition({ x: 8, y: 6 });
  m.updatePosition({ x: 10, y: 6 }); m.updatePosition({ x: 10.1, y: 6 }); m.updatePosition({ x: 12, y: 6 });
  assert.deepEqual(events.map(e => e.type), ['zoneenter', 'zoneleave']);
});

test('bord extérieur : sortie, retour, aucune saturation et aucune fausse collision après recalage', () => {
  const { Maze } = runtime(), m = new Maze({ widthCm: 29.7, heightCm: 42 });
  const events = observe(m, ['outofbounds', 'boundsenter', 'wallcross']);
  m.resetPosition({ x: 14, y: 40 }); m.updatePosition({ x: 14, y: 45 });
  assert.equal(m.getState().position.y, 45); near(m.getState().distances.top, -3);
  assert.deepEqual(events.map(e => e.type), ['outofbounds', 'wallcross']);
  events.length = 0; m.updatePosition({ x: 14, y: 40 });
  assert.deepEqual(events.map(e => e.type), ['boundsenter', 'wallcross']);
  events.length = 0; m.resetPosition({ x: 14.85, y: 0 }); assert.equal(events.length, 0);
  const definition = m.getDefinition(); definition.widthCm = 1; assert.equal(m.getDefinition().widthCm, 29.7);
});

test('chemins : projection sur un segment, extrémités, jonctions et changements de branche', () => {
  const { Maze } = runtime();
  const config = {
    widthCm: 12, heightCm: 12,
    paths: [
      { id: 'bas', points: [{ x: 0, y: 2 }, { x: 10, y: 2 }, { x: 10, y: 4 }] },
      { id: 'haut', points: [{ x: 0, y: 8 }, { x: 10, y: 8 }] }
    ],
    zones: [{ id: 'etape', shape: 'circle', center: { x: 5, y: 2 }, radius: 0.5 }],
    finish: { id: 'arrivee', shape: 'circle', center: { x: 5, y: 5 }, radius: 0.5 }
  };
  const free = new Maze(config);
  const raw = { x: 5, y: 5 };
  const nearest = { position: { x: 5, y: 2 }, pathId: 'bas', segmentIndex: 0, distanceCm: 3 };
  assert.deepEqual(plain(free.projectToPath(raw)), nearest); // A tie keeps definition order.
  assert.deepEqual(plain(free.updatePosition(raw).position), raw);
  assert.deepEqual(plain(free.projectToPath({ x: -10, y: 1 }).position), { x: 0, y: 2 });
  const turn = free.projectToPath({ x: 11, y: 3 });
  assert.deepEqual(plain(turn.position), { x: 10, y: 3 });
  assert.equal(turn.segmentIndex, 1);
  assert.deepEqual(plain(free.projectToPath({ x: 10, y: 2 }).position), { x: 10, y: 2 });
  assert.equal(new Maze({ widthCm: 12, heightCm: 12 }).projectToPath(raw), null);
  assert.throws(() => new Maze({ widthCm: 12, heightCm: 12, snapToPath: true }), /au moins un chemin/);
  assert.throws(() => free.projectToPath({ x: Infinity, y: 0 }), /Position finie/);

  const maze = new Maze({ ...config, snapToPath: true });
  const state = maze.resetPosition(raw);
  assert.deepEqual(plain(state.rawPosition), raw);
  assert.deepEqual(plain(state.position), nearest.position);
  assert.deepEqual(plain(state.pathProjection), nearest);
  maze.setGrid({ cellWidthCm: 3, cellHeightCm: 3 });
  assert.deepEqual(plain(maze.getState().rawPosition), raw);
  assert.deepEqual(plain(maze.getState().cell), { column: 1, row: 0 });

  const events = observe(maze, ['zonecross', 'finish']);
  const switched = maze.updatePosition({ x: 5, y: 5.1 });
  assert.equal(switched.pathProjection.pathId, 'haut');
  assert.deepEqual(plain(switched.position), { x: 5, y: 8 });
  assert.equal(events.length, 0); // No finish crossing from a jump between branches.
  maze.resetPosition({ x: 4, y: 1 });
  maze.updatePosition({ x: 6, y: 1 });
  assert.deepEqual(events.map(event => event.type), ['zonecross']);
  assert.equal(maze.resetPosition(), null);
});

test('MAZE 2 : les deux modes suivent les axes des bandes remplies du PDF', () => {
  const r = runtime(); loadExamples(r);
  const config = id => r.MAZE_EXAMPLES.find(entry => entry.id === id).config;
  const walls = new r.Maze(config('maze-2'));
  const free = config('maze-2-paths'), tracked = config('maze-2-path-tracking');
  const { corridorArea } = r.MAZE_2_PATH_VIEW;
  assert.equal(corridorArea.match(/^M /gm).length, 1);
  assert.match(corridorArea, /^C /m);
  assert.ok(free.paths.length > 0);
  assert.deepEqual(free.paths, tracked.paths);
  assert.equal(free.walls, undefined);
  assert.equal(tracked.walls, undefined);
  for (const { id, points } of free.paths) {
    for (const point of points) {
      const band = walls.resetPosition(point);
      assert.equal(band.outside, false);
      assert.ok(band.wallIds.some(wallId => wallId.startsWith(id + '-')), id);
    }
  }
  const maze = new r.Maze(tracked);
  assert.equal(tracked.start.y, 0);
  assert.deepEqual(plain(maze.resetPosition(tracked.start).position), plain(tracked.start));
  const projected = maze.updatePosition({ x: tracked.start.x + 2, y: 1 });
  assert.equal(projected.pathProjection.pathId, 'branche-basse');
  near(projected.position.x, tracked.start.x);
  near(projected.position.y, 1);
});

test('renderer : canvas haute densité, grille visuelle et nettoyage', () => {
  const r = runtime(); let disconnected = false, drawCount = 0, strokes = 0;
  r.window = { devicePixelRatio: 2 };
  r.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  const arcs = [], fills = [];
  const ctx = new Proxy({}, { get: (_, key) => (...args) => {
    drawCount++;
    if (key === 'arc') arcs.push(args);
    if (key === 'fill') fills.push(args);
    if (key === 'stroke') strokes++;
  } });
  const canvas = { clientWidth: 540, clientHeight: 530, width: 0, height: 0, getContext: () => ctx };
  const maze = new r.Maze({ widthCm: 29.7, heightCm: 42 });
  const renderer = new r.MazeRenderer(canvas, maze);
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1060);
  maze.setGrid({ cellWidthCm: 9.9, cellHeightCm: 7 }); renderer.setGridVisible(true);
  renderer.render({ position: { x: 100, y: -50 }, provisional: false });
  renderer.destroy(); const before = drawCount; maze.setGrid(null); renderer.render();
  assert.equal(drawCount, before); assert.equal(disconnected, true);

  const tracked = new r.Maze({
    widthCm: 10, heightCm: 10, snapToPath: true,
    paths: [{ id: 'couloir', points: [{ x: 0, y: 2 }, { x: 10, y: 2 }] }]
  });
  const raw = { x: 5, y: 6 };
  tracked.updatePosition(raw);
  const outline = 'M 0 0 H 10 V 10 H 0 Z';
  const beforeBand = strokes;
  const projectedRenderer = new r.MazeRenderer(canvas, tracked, { corridorArea: outline });
  assert.equal(strokes - beforeBand, 2); // Only the cursor is stroked.
  assert.ok(fills.some(([shape, rule]) => shape?.data === outline && rule === 'evenodd'));
  projectedRenderer.render({ position: raw, calibrating: false });
  near(arcs.at(-1)[1], 394);
  projectedRenderer.render({ position: raw, calibrating: true, calibration: { marks: [], step: 3 } });
  near(arcs.at(-1)[1], 222);
  projectedRenderer.destroy();
});

test('exemple : ressources locales existantes et JavaScript syntaxiquement valide', () => {
  const root = path.join(__dirname, '..', 'examples', 'multi-lab'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
  new vm.Script(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
});

test('exemple complet : commandes, calibration, profils JSON, diagnostics et grille', async () => {
  const r = runtime(), b = browser(), nodes = new Map(), frames = new Map();
  class Node extends EventTarget {
    constructor() { super(); this.children = []; this.textContent = ''; this.checked = false; this.clientWidth = 540; this.clientHeight = 530; }
    append(n) { n.parent = this; this.children.push(n); }
    prepend(n) { n.parent = this; this.children.unshift(n); }
    replaceChildren() { this.children = []; }
    get lastElementChild() { return this.children.at(-1); }
    remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); }
    getContext() { return new Proxy({}, { get: () => () => {} }); }
  }
  b.doc.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  let downloaded, copied;
  b.doc.createElement = tag => {
    const node = new Node();
    if (tag === 'a') node.click = () => { downloaded = { filename: node.download, href: node.href }; };
    return node;
  };
  b.doc.body = b.element;
  const html = fs.readFileSync(path.join(__dirname, '..', 'examples', 'multi-lab', 'index.html'), 'utf8');
  for (const match of html.matchAll(/id="([^"]+)"/g)) b.doc.getElementById(match[1]);
  let counter = 0;
  r.document = b.doc; r.window = new EventTarget(); r.window.devicePixelRatio = 1;
  r.AbortController = AbortController;
  r.navigator = { clipboard: { writeText: async value => { copied = value; } } };
  r.ResizeObserver = class { observe() {} disconnect() {} };
  r.requestAnimationFrame = fn => { const id = ++counter; frames.set(id, fn); return id; };
  r.cancelAnimationFrame = id => frames.delete(id);
  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    for (const [id, fn] of frames) { frames.delete(id); fn(); }
  };
  const key = code => { const e = new Event('keydown', { cancelable: true }); e.code = code; e.repeat = false; b.doc.dispatchEvent(e); };
  loadExamples(r);
  const fallbackLayout = r.MAZE_EXAMPLES.find(example => example.id === 'simple').config;
  delete fallbackLayout.widthCm;
  delete fallbackLayout.heightCm;
  delete fallbackLayout.start;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'examples', 'multi-lab', 'app.js'), 'utf8'), r);
  assert.equal(nodes.get('resume').disabled, true);
  assert.equal(nodes.get('calibration-export').disabled, true);
  assert.equal(nodes.get('maze-select').children.length, 10);
  nodes.get('calibrate').dispatchEvent(new Event('click')); await flush();
  assert.match(nodes.get('status').textContent, /1\/5/);
  key('Space'); b.move(2970, 0); key('Space'); b.move(0, -4200); key('Space'); await flush();
  assert.match(nodes.get('coords').textContent, /Provisoire/);
  b.move(-2970, 0); key('Space'); b.move(0, 4200); key('Space'); await flush();
  assert.match(nodes.get('quality').textContent, /0.00 cm/);
  assert.equal(nodes.get('measurements').children.length, 5);
  assert.equal(nodes.get('resume').disabled, false);
  assert.equal(nodes.get('calibration-export').disabled, false);
  const code = nodes.get('calibration-code').value;
  const profileFromCode = plain(vm.runInNewContext(`${code}\ncalibration`));
  nodes.get('calibration-copy').dispatchEvent(new Event('click')); await flush();
  assert.equal(copied, code);
  nodes.get('calibration-export').dispatchEvent(new Event('click'));
  assert.equal(downloaded.filename, 'calibration.json');
  const json = decodeURIComponent(downloaded.href.split(',')[1]);
  assert.deepEqual(JSON.parse(json), profileFromCode);
  nodes.get('resume').dispatchEvent(new Event('click')); await flush();
  key('KeyD'); await flush();
  assert.match(nodes.get('coords').textContent, /14.85/);
  assert.equal(nodes.get('events').children.length, 0); // Recentering adds no events.
  nodes.get('grid').checked = true; nodes.get('grid').dispatchEvent(new Event('change')); await flush();
  assert.match(nodes.get('cell').textContent, /colonne 2, ligne 1/);
  b.move(0, -100); await flush(); assert.match(nodes.get('coords').textContent, /1.00 cm/);
  b.doc.exitPointerLock(); await flush(); assert.equal(nodes.get('resume').disabled, false);
  const beforeSwitch = nodes.get('coords').textContent;
  nodes.get('maze-select').value = 'zigzag'; nodes.get('maze-select').dispatchEvent(new Event('change')); await flush();
  assert.equal(nodes.get('coords').textContent, beforeSwitch);
  assert.equal(nodes.get('grid').checked, true);
  assert.equal(nodes.get('resume').disabled, false); // Switching layouts keeps the calibration.
  assert.equal(nodes.get('events').children.length, 1);
  assert.equal(nodes.get('events').children[0].textContent, 'Aucun événement.');
  assert.match(nodes.get('maze-description').textContent, /quatre murs/);
  nodes.get('maze-select').value = 'obstacles'; nodes.get('maze-select').dispatchEvent(new Event('change')); await flush();
  assert.equal(nodes.get('grid').checked, false);
  assert.equal(nodes.get('coords').textContent, beforeSwitch);
  for (const id of ['spirale', 'jardin', 'station']) {
    nodes.get('maze-select').value = id; nodes.get('maze-select').dispatchEvent(new Event('change')); await flush();
    assert.equal(nodes.get('coords').textContent, beforeSwitch);
    assert.equal(nodes.get('resume').disabled, false);
  }
  const fileInput = nodes.get('calibration-file');
  fileInput.files = [{ text: async () => '{invalide' }];
  fileInput.dispatchEvent(new Event('change')); await flush();
  assert.match(nodes.get('calibration-profile-status').textContent, /JSON valide/);
  assert.equal(nodes.get('calibration-code').value, code);
  fileInput.files = [{ text: async () => json }];
  fileInput.dispatchEvent(new Event('change')); await flush();
  assert.match(nodes.get('calibration-profile-status').textContent, /Calibration chargée/);
  assert.equal(nodes.get('calibration-code').value, code);
  assert.match(nodes.get('coords').textContent, /Recalage/);
  nodes.get('resume').dispatchEvent(new Event('click')); await flush();
  b.move(0, -100); await flush();
  assert.match(nodes.get('coords').textContent, /Recalage/);
  assert.equal(nodes.get('events').children[0].textContent, 'Aucun événement.');
  key('KeyD'); await flush();
  assert.match(nodes.get('coords').textContent, /X : 14.85 \| Y : 0.00/);
  b.doc.exitPointerLock();

  const select = nodes.get('maze-select');
  select.value = 'maze-2'; select.dispatchEvent(new Event('change')); await flush();
  assert.equal(select.value, 'maze-2');
  assert.equal(nodes.get('calibration-dimensions').textContent, '60 × 60 cm');
  assert.equal(nodes.get('start-coordinates').textContent, 'X = 30 cm et Y = 0 cm');
  assert.equal(nodes.get('resume').disabled, true);
  assert.equal(nodes.get('calibration-code').value, '');

  fileInput.files = [{ text: async () => json }];
  fileInput.dispatchEvent(new Event('change')); await flush();
  assert.match(nodes.get('calibration-profile-status').textContent, /dimensions/);
  nodes.get('calibrate').dispatchEvent(new Event('click')); await flush();
  key('Space'); await flush();
  assert.match(nodes.get('target').textContent, /X 60.00 \| Y 0.00 cm/);
  b.move(6000, 0); key('Space'); b.move(0, -6000); key('Space');
  b.move(-6000, 0); key('Space'); b.move(0, 6000); key('Space'); await flush();
  nodes.get('resume').dispatchEvent(new Event('click')); await flush();
  key('KeyD'); await flush();
  assert.match(nodes.get('coords').textContent, /X : 30.00 \| Y : 0.00/);
  b.doc.exitPointerLock();

  select.value = 'maze-2-paths'; select.dispatchEvent(new Event('change')); await flush();
  assert.equal(nodes.get('resume').disabled, false);
  assert.equal(nodes.get('path-projection').hidden, true);
  nodes.get('resume').dispatchEvent(new Event('click')); await flush();
  b.move(200, -100); await flush();
  assert.equal(nodes.get('coords').textContent, 'X : 32.00 | Y : 1.00 cm');
  b.doc.exitPointerLock();

  select.value = 'maze-2-path-tracking'; select.dispatchEvent(new Event('change')); await flush();
  const layout = r.MAZE_EXAMPLES.find(example => example.id === select.value).config;
  const maze = new r.Maze(layout);
  const expected = maze.projectToPath({ x: 32, y: 1 });
  assert.equal(nodes.get('resume').disabled, false);
  assert.equal(nodes.get('coords').textContent,
    `Sur le chemin · X : ${expected.position.x.toFixed(2)} | Y : ${expected.position.y.toFixed(2)} cm`);
  assert.equal(nodes.get('path-projection').hidden, false);
  assert.match(nodes.get('path-projection').textContent, /Mesure : X 32.00 \| Y 1.00 cm/);

  nodes.get('resume').dispatchEvent(new Event('click')); await flush();
  b.move(100, -300); await flush();
  const moved = maze.projectToPath({ x: 33, y: 4 });
  assert.equal(nodes.get('coords').textContent,
    `Sur le chemin · X : ${moved.position.x.toFixed(2)} | Y : ${moved.position.y.toFixed(2)} cm`);
  key('KeyD'); await flush();
  assert.equal(nodes.get('coords').textContent, 'Sur le chemin · X : 26.66 | Y : 0.00 cm');
  b.doc.exitPointerLock();

  select.value = 'simple'; select.dispatchEvent(new Event('change')); await flush();
  assert.equal(nodes.get('path-projection').hidden, true);
  assert.equal(nodes.get('calibration-dimensions').textContent, '29,7 × 42 cm');
  assert.equal(nodes.get('start-coordinates').textContent, 'X = 14,85 cm et Y = 0 cm');
  assert.equal(nodes.get('resume').disabled, true);
  assert.equal(nodes.get('calibration-code').value, '');
  r.window.dispatchEvent(new Event('pagehide')); await flush();
});

test('calibration autonome : guide, diagnostics et échange de profils avec le tracker', async () => {
  const b = browser(), nodes = new Map(), window = new EventTarget();
  class Node extends EventTarget {
    children = [];
    append(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
    focus() {}
    select() { this.selected = true; }
  }
  const root = path.join(__dirname, '..', 'examples', 'minimal-calibration');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, id] of html.matchAll(/id="([^"]+)"/g)) nodes.set(id, new Node());
  const $ = id => nodes.get(id);
  b.doc.body = b.element;
  b.doc.getElementById = $;
  let downloaded;
  b.doc.createElement = tag => {
    const node = new Node();
    if (tag === 'a') node.click = () => { downloaded = node; };
    return node;
  };
  let frame;
  const context = vm.createContext({ EventTarget, CustomEvent, structuredClone, document: b.doc, window,
    requestAnimationFrame: fn => { frame = fn; return 1; } });
  const scripts = [...html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)];
  assert.deepEqual(scripts.flatMap(([, src]) => src ? [src] : []), ['../../src/mouse-position-tracker.js']);
  for (const [, src, code] of scripts) vm.runInContext(src ? fs.readFileSync(path.join(root, src), 'utf8') : code, context);
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); const render = frame; frame = null; render?.(); };
  const click = id => $(id).dispatchEvent(new Event('click'));
  const key = code => { const e = new Event('keydown', { cancelable: true }); e.code = code; b.doc.dispatchEvent(e); };

  assert.equal($('calibration-export').disabled, true);
  click('calibrate'); await settle();
  assert.match($('status').textContent, /1\/5.*bas gauche/);
  key('Space'); b.move(2970, 0); key('Space'); b.move(0, -4200); key('Space'); await settle();
  assert.match($('coords').textContent, /Provisoire/);
  b.move(-2970, 0); key('Space'); b.move(100, 4200); key('Space'); await settle();
  assert.match($('closure').textContent, /1.00 cm.*écart important/);
  assert.equal($('scale').textContent, '100.00 / 100.00 unités/cm');
  assert.equal($('measurements').children[4].children[3].textContent, '1.00');
  assert.equal($('calibration-export').disabled, false);
  click('calibration-export');
  assert.equal(downloaded.download, 'calibration.json');
  const json = decodeURIComponent(downloaded.href.split(',')[1]);
  const code = $('calibration-code').value;
  assert.deepEqual(plain(vm.runInNewContext(`${code}\ncalibration`)), JSON.parse(json));
  click('calibration-copy'); await settle();
  assert.equal($('calibration-code').selected, true);

  const { MousePositionTracker } = runtime(), other = browser();
  const tracker = new MousePositionTracker({ element: other.element, widthCm: 29.7, heightCm: 42 });
  tracker.importCalibration(JSON.parse(json));
  near(tracker.getState().calibration.closureCm, 1);
  const file = $('calibration-file');
  file.files = [{ text: async () => '{invalide' }];
  file.dispatchEvent(new Event('change')); await settle();
  assert.match($('profile-status').textContent, /JSON valide/);
  assert.equal($('calibration-code').value, code);
  file.files = [{ text: async () => JSON.stringify(tracker.exportCalibration()) }];
  file.dispatchEvent(new Event('change')); await settle();
  assert.match($('status').textContent, /Profil chargé/);
  click('resume'); await settle();
  b.move(0, -100); await settle();
  assert.match($('coords').textContent, /Recalage/);
  key('KeyD'); b.move(0, -100); await settle();
  assert.equal($('coords').textContent, 'X 14.85 · Y 1.00 cm');
  window.dispatchEvent(new Event('pagehide')); await settle();
  tracker.destroy();
});

test('catalogue : six parcours A3 possèdent un trajet libre vers leur arrivée', () => {
  const r = runtime(); loadExamples(r);
  const paths = {
    simple: [[4, 5], [4, 19], [25, 19], [25, 34], [14.85, 38]],
    zigzag: [[4, 4], [4, 12], [25, 12], [25, 20], [4, 20], [4, 28], [25, 28], [25, 36], [14.85, 38]],
    obstacles: [[5, 4], [5, 11], [14.85, 18], [14.85, 27], [14.85, 38]],
    spirale: [[2, 3], [2, 10], [22, 10], [22, 32], [7, 32], [7, 17], [15, 17], [14.85, 25]],
    jardin: [[5, 5], [5, 12], [15, 17], [15, 27], [20, 33], [16, 38]],
    station: [[14.85, 11], [19.5, 17], [19.5, 29], [14.85, 34], [14.85, 38]]
  };
  for (const id of Object.keys(paths)) {
    const example = r.MAZE_EXAMPLES.find(entry => entry.id === id);
    assert.equal(example.config.widthCm, 29.7); assert.equal(example.config.heightCm, 42);
    const maze = new r.Maze(example.config);
    const events = observe(maze, ['wallcross', 'wallenter', 'walltouch', 'obstacleenter', 'obstaclecross', 'outofbounds', 'finish']);
    maze.resetPosition(example.config.start);
    for (const [x, y] of paths[example.id]) maze.updatePosition({ x, y });
    assert.deepEqual(events.map(e => e.type), ['finish'], example.id);
  }
});

for (const [folder, includeCount] of [['minimal-bord', 1], ['minimal-maze', 3]]) {
  test(`${folder} : HTML autonome, calibration, pause, recalage et déplacements`, async () => {
    const b = browser(), nodes = new Map();
    class Node extends EventTarget {
      constructor() { super(); this.textContent = ''; this.clientWidth = 400; this.clientHeight = 530; }
      getContext() { return new Proxy({}, { get: () => () => {} }); }
    }
    b.doc.body = b.element;
    b.doc.getElementById = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
    const root = path.join(__dirname, '..', 'examples', folder);
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    for (const match of html.matchAll(/id="([^"]+)"/g)) b.doc.getElementById(match[1]);
    const window = new EventTarget(); window.devicePixelRatio = 1;
    const r = vm.createContext({ EventTarget, CustomEvent, structuredClone, document: b.doc, window,
      ResizeObserver: class { observe() {} disconnect() {} } });
    let includes = 0;
    // Run only the scripts listed in the page, in the same order.
    for (const script of html.matchAll(/<script(?:\s+src="([^"]+)")?\s*>([\s\S]*?)<\/script>/g)) {
      if (script[1]) includes++;
      vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], r);
    }
    assert.equal(includes, includeCount);
    if (includeCount === 1) assert.equal(r.Maze, undefined);
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const key = code => { const e = new Event('keydown', { cancelable: true }); e.code = code; b.doc.dispatchEvent(e); };
    nodes.get('calibrate').dispatchEvent(new Event('click')); await settle();
    assert.match(nodes.get('status').textContent, /1\/5/);
    key('Space'); b.move(2970, 0); key('Space'); b.move(0, -4200); key('Space');
    assert.match(nodes.get('coords').textContent, /Provisoire/);
    b.move(-2970, 0); key('Space'); b.move(0, 4200); key('Space');
    assert.equal(nodes.get('resume').disabled, false);
    assert.match(nodes.get('status').textContent, /0.00 cm/);
    nodes.get('resume').dispatchEvent(new Event('click')); await settle();
    key('KeyD'); assert.match(nodes.get('coords').textContent, /14.85/);
    if (includeCount === 3) assert.equal(nodes.get('event').textContent, 'Aucun événement.');
    b.move(0, -100); assert.match(nodes.get('coords').textContent, /1.00 cm/);
    b.doc.exitPointerLock(); const before = nodes.get('coords').textContent;
    b.move(1000, 1000); assert.equal(nodes.get('coords').textContent, before);
    window.dispatchEvent(new Event('pagehide'));
  });
}

test('accueil MAZE 2 : calibration, export et chargement du profil local', async () => {
  const root = path.join(__dirname, '..', '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const profileFile = 'calibration-maze-2.js';
  const header = html.match(/<header class="page-header">([\s\S]*?)<\/header>/)?.[1];
  for (const id of ['resume', 'status', 'pause-hint']) assert.ok(header?.includes('id="' + id + '"'));
  assert.match(html, /<select id="baud-rate">\s*<option value="9600" selected>/);
  assert.ok(fs.readFileSync(path.join(root, '.gitignore'), 'utf8').split(/\r?\n/).includes('/' + profileFile));

  function open(profileContents) {
    const b = browser(), nodes = new Map(), frames = new Map(), window = new EventTarget();
    let download, profileSource, frameId = 0;
    class Node extends EventTarget {
      textContent = '';
      dataset = {};
      setAttribute(name, value) { this[name] = value; }
      clientWidth = 600;
      clientHeight = 600;
      getContext() { return new Proxy({}, { get: () => () => {} }); }
    }
    const $ = id => nodes.get(id);
    for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], new Node());
    b.doc.getElementById = $;
    b.doc.body = b.element;
    b.doc.createElement = tag => {
      const node = new Node();
      if (tag === 'a') node.click = () => { download = node; };
      return node;
    };
    const r = vm.createContext({ window, document: b.doc, EventTarget, CustomEvent, AbortController, structuredClone, Path2D,
      ResizeObserver: class { observe() {} disconnect() {} },
      requestAnimationFrame: fn => { frames.set(++frameId, fn); return frameId; },
      cancelAnimationFrame: id => frames.delete(id)
    });
    b.doc.head = { append(script) {
      profileSource = script.src;
      if (profileContents !== undefined) vm.runInContext(profileContents, r);
      script.dispatchEvent(new Event(profileContents === undefined ? 'error' : 'load'));
    } };
    for (const script of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)) {
      vm.runInContext(script[1] ? fs.readFileSync(path.join(root, script[1]), 'utf8') : script[2], r);
    }
    assert.equal(profileSource, profileFile);
    assert.equal(r.MAZE_EXAMPLES, undefined);
    const flush = async () => {
      await new Promise(resolve => setImmediate(resolve));
      for (const [id, callback] of frames) { frames.delete(id); callback(); }
    };
    const click = id => {
      assert.equal($(id).disabled, false, id);
      $(id).dispatchEvent(new Event('click'));
    };
    const key = (code, character) => {
      const event = new Event('keydown', { cancelable: true });
      event.code = code;
      event.key = character;
      b.doc.dispatchEvent(event);
    };
    return { b, $, r, window, flush, click, key, getDownload: () => download };
  }

  const first = open();
  await first.flush();
  assert.equal(first.$('test-sound').disabled, false);
  assert.match(first.$('sound-status').textContent, /4 MP3 depuis assets\/mp3/);
  assert.match(first.$('console-output').textContent, /INFO \[Audio\] 4 MP3/);
  vm.runInContext("console.warn('Test du journal')", first.r);
  await first.flush();
  assert.match(first.$('console-output').textContent, /WARN Test du journal/);
  assert.equal(first.$('resume').disabled, true);
  assert.equal(first.$('save-calibration').disabled, true);
  first.$('view-toggle').dispatchEvent(new Event('click')); await first.flush();
  assert.equal(first.$('app').dataset.view, 'demo');
  assert.equal(first.$('configuration-panel').hidden, true);
  assert.equal(first.$('console-panel').hidden, true);
  assert.equal(first.$('view-toggle').textContent, 'Configuration');
  first.$('maze').dispatchEvent(new Event('click')); await first.flush();
  assert.equal(first.b.doc.pointerLockElement, null);
  first.key('Semicolon', 'm'); await first.flush(); // M on an AZERTY keyboard.
  assert.equal(first.$('app').dataset.view, 'configuration');
  assert.equal(first.$('configuration-panel').hidden, false);
  assert.equal(first.$('console-panel').hidden, false);
  assert.equal(first.$('view-toggle')['aria-expanded'], 'true');
  first.click('calibrate'); await first.flush();
  assert.match(first.$('status').textContent, /1\/5/);
  first.key('Space'); first.b.move(6000, 0); first.key('Space');
  first.b.move(0, -6000); first.key('Space'); await first.flush();
  assert.equal(first.$('coords').textContent, 'Provisoire · X 60,00 · Y 60,00 cm');
  first.b.move(-6000, 0); first.key('Space');
  first.b.move(0, 6000); first.key('Space'); await first.flush();
  assert.match(first.$('calibration-quality').textContent, /0,00 cm/);
  first.click('save-calibration'); await first.flush();
  const download = first.getDownload();
  assert.equal(download.download, profileFile);
  const contents = decodeURIComponent(download.href.slice(download.href.indexOf(',') + 1));
  first.window.dispatchEvent(new Event('pagehide'));

  const restored = open(contents);
  assert.match(restored.$('profile-status').textContent, /Profil chargé/);
  assert.equal(restored.$('resume').disabled, false);
  restored.$('view-toggle').dispatchEvent(new Event('click')); await restored.flush();
  assert.equal(restored.$('app').dataset.view, 'demo');
  assert.equal(restored.$('resume').hidden, false);
  assert.equal(restored.$('pause-hint').hidden, true);
  restored.click('resume'); await restored.flush();
  assert.equal(restored.b.doc.pointerLockElement, restored.b.element);
  assert.equal(restored.$('resume').hidden, true);
  assert.equal(restored.$('pause-hint').hidden, false);
  assert.match(restored.$('status').textContent, /appuie sur D/);
  restored.b.doc.exitPointerLock(); await restored.flush();
  assert.equal(restored.$('app').dataset.view, 'demo');
  assert.equal(restored.$('resume').disabled, false);
  assert.equal(restored.$('resume').hidden, false);
  assert.equal(restored.$('pause-hint').hidden, true);
  restored.$('maze').dispatchEvent(new Event('click')); await restored.flush();
  assert.equal(restored.b.doc.pointerLockElement, restored.b.element);
  restored.key('Semicolon', 'm'); await restored.flush();
  assert.equal(restored.$('app').dataset.view, 'configuration');
  assert.equal(restored.b.doc.pointerLockElement, restored.b.element);
  restored.b.move(200, -100); await restored.flush();
  assert.equal(restored.$('coords').textContent, 'Position indisponible.');
  restored.key('KeyD'); await restored.flush();
  assert.equal(restored.$('coords').textContent, 'X 26,66 · Y 0,00 cm');
  restored.b.move(200, -100); await restored.flush();
  const config = restored.r.MAZE_2_PATH_CONFIG;
  const projected = new restored.r.Maze(config).projectToPath({ x: config.start.x + 2, y: 1 });
  assert.equal(projected.pathId, 'branche-basse');
  const format = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  assert.equal(restored.$('coords').textContent, 'X ' + format.format(projected.position.x) + ' · Y ' + format.format(projected.position.y) + ' cm');
  assert.equal(restored.$('offset').hidden, false);
  restored.b.doc.exitPointerLock(); await restored.flush();
  let written, closed = false;
  restored.window.showSaveFilePicker = async ({ suggestedName }) => {
    assert.equal(suggestedName, profileFile);
    return { name: suggestedName, async createWritable() {
      return { async write(value) { written = value; }, async close() { closed = true; } };
    } };
  };
  restored.click('save-calibration'); await restored.flush();
  assert.equal(written, contents);
  assert.equal(closed, true);
  restored.window.dispatchEvent(new Event('pagehide'));

  const invalid = open('globalThis.MAZE_2_CALIBRATION = { version: 0 };');
  assert.match(invalid.$('profile-status').textContent, /Profil illisible/);
  assert.equal(invalid.$('calibrate').disabled, false);
  assert.equal(invalid.$('resume').disabled, true);
  invalid.window.dispatchEvent(new Event('pagehide'));
});

test('accueil MAZE 2 : le port COM lit PRESS et déclenche les MP3 du dossier', async () => {
  const assets = path.join(__dirname, '..', '..', 'assets');
  const script = fs.readFileSync(path.join(assets, 'serial-audio.js'), 'utf8');
  const nodes = new Map(), window = new EventTarget(), timers = new Map();
  const urls = new Map(), played = [], rates = [], logged = [];
  let portSelections = 0, closes = 0, timerId = 0, nextUrl = 0, controller;
  const port = {
    async open({ baudRate }) {
      rates.push(baudRate);
      this.readable = new ReadableStream({ start(stream) { controller = stream; } });
    },
    async close() {
      assert.equal(this.readable.locked, false);
      closes++;
    }
  };
  const serial = { async requestPort() { portSelections++; return port; } };
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, new EventTarget());
    return nodes.get(id);
  };
  const audio = $('press-sound');
  audio.pause = audio.load = () => {};
  audio.removeAttribute = () => { audio.src = ''; };
  audio.play = async () => { played.push(urls.get(audio.src) ?? audio.src); };
  const random = [0, 0, 0.8, 0.3, 0.8];
  const math = Object.create(Math);
  math.random = () => random.shift();
  const r = vm.createContext({
    document: { getElementById: $ }, window, navigator: { serial }, TextDecoder, Math: math,
    console: { info() {}, warn() {}, log(...args) { logged.push(args); } },
    URL: {
      createObjectURL(file) { const url = 'blob:' + ++nextUrl; urls.set(url, file.name); return url; },
      revokeObjectURL(url) { urls.delete(url); }
    },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); }
  });
  vm.runInContext(fs.readFileSync(path.join(assets, 'mp3', 'playlist.js'), 'utf8'), r);
  for (const name of r.MAZE_2_MP3_FILES) assert.ok(fs.existsSync(path.join(assets, 'mp3', name)), name);
  vm.runInContext(script, r);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  const clickPort = () => $('serial-connect').dispatchEvent(new Event('click'));
  const audioEnded = () => audio.dispatchEvent(new Event('ended'));
  const send = line => controller.enqueue(new TextEncoder().encode(line));

  $('baud-rate').value = '0';
  clickPort(); await flush();
  assert.equal(portSelections, 0);
  $('baud-rate').value = '9600';
  clickPort(); await flush();
  assert.deepEqual(rates, [9600]);
  assert.match($('serial-status').textContent, /9600 bauds/);
  send('PRESS\r\n'); await flush();
  assert.deepEqual(played, ['assets/mp3/audio_down.mp3']);
  assert.deepEqual(logged.at(-1), ['[COM] RX', 'PRESS']);
  audioEnded();
  assert.equal(urls.size, 0);
  played.length = 0;
  $('mp3-folder').files = [];
  $('mp3-folder').dispatchEvent(new Event('change'));
  send('PRESS\r\n'); await flush();
  assert.match($('sound-status').textContent, /Sélectionne le dossier/);

  const folder = $('mp3-folder');
  folder.files = [{ name: 'un.mp3' }, { name: 'deux.MP3' }, { name: 'notes.txt' }];
  folder.dispatchEvent(new Event('change'));
  assert.equal($('sound-status').textContent, '2 MP3 depuis le dossier sélectionné.');
  $('test-sound').dispatchEvent(new Event('click')); await flush();
  assert.deepEqual(played, ['un.mp3']);
  audioEnded();
  assert.equal(urls.size, 0);

  send('PRESSED\r\nDEBUG PRESS\nPR'); await flush();
  assert.deepEqual(played, ['un.mp3']);
  send('ESS\r\n  PRESS \nPRESS' + ' '.repeat(80) + 'extra\n'); await flush();
  assert.deepEqual(played, ['un.mp3', 'deux.MP3']);
  audioEnded(); await flush();
  assert.deepEqual(played, ['un.mp3', 'deux.MP3', 'un.mp3']);
  audioEnded();

  send('PRE'); await flush();
  send('SS'); await flush();
  assert.equal(timers.size, 1);
  for (const [id, callback] of timers) { timers.delete(id); callback(); }
  await flush();
  assert.deepEqual(played, ['un.mp3', 'deux.MP3', 'un.mp3', 'deux.MP3']);
  audioEnded();
  assert.equal(urls.size, 0);

  clickPort(); await flush();
  assert.equal(closes, 1);
  assert.equal($('baud-rate').disabled, false);
  assert.match($('serial-status').textContent, /déconnecté/);
  clickPort(); await flush();
  assert.equal(portSelections, 2);
  controller.error(new Error('Périphérique retiré.'));
  await flush();
  assert.equal(closes, 2);
  assert.match($('serial-status').textContent, /Lecture série interrompue/);
  window.dispatchEvent(new Event('pagehide'));
});
