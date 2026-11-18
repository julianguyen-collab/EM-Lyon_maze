const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the library with simulated browser APIs.
function runtime() {
  const context = vm.createContext({ EventTarget, CustomEvent, structuredClone, console });
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
  for (const name of ['maze-config.js', 'mazes/simple.js', 'mazes/zigzag.js', 'mazes/obstacles.js', 'mazes/spirale.js', 'mazes/jardin.js', 'mazes/station.js']) {
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

test('renderer : canvas haute densité, grille visuelle et nettoyage', () => {
  const r = runtime(); let disconnected = false, drawCount = 0;
  r.window = { devicePixelRatio: 2 };
  r.ResizeObserver = class { observe() {} disconnect() { disconnected = true; } };
  const ctx = new Proxy({}, { get: () => () => { drawCount++; } });
  const canvas = { clientWidth: 540, clientHeight: 530, width: 0, height: 0, getContext: () => ctx };
  const maze = new r.Maze({ widthCm: 29.7, heightCm: 42 });
  const renderer = new r.MazeRenderer(canvas, maze);
  assert.equal(canvas.width, 1080); assert.equal(canvas.height, 1060);
  maze.setGrid({ cellWidthCm: 9.9, cellHeightCm: 7 }); renderer.setGridVisible(true);
  renderer.render({ position: { x: 100, y: -50 }, provisional: false });
  renderer.destroy(); const before = drawCount; maze.setGrid(null); renderer.render();
  assert.equal(drawCount, before); assert.equal(disconnected, true);
});

test('exemple : ressources locales existantes et JavaScript syntaxiquement valide', () => {
  const root = path.join(__dirname, '..', 'examples', 'multi-lab'), html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) assert.ok(fs.existsSync(path.join(root, match[1])), match[1]);
  new vm.Script(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
});

test('exemple complet : commandes, calibration, diagnostics, recalage et grille', async () => {
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
  b.doc.createElement = () => new Node(); b.doc.body = b.element;
  const html = fs.readFileSync(path.join(__dirname, '..', 'examples', 'multi-lab', 'index.html'), 'utf8');
  for (const match of html.matchAll(/id="([^"]+)"/g)) b.doc.getElementById(match[1]);
  let counter = 0;
  r.document = b.doc; r.window = new EventTarget(); r.window.devicePixelRatio = 1;
  r.AbortController = AbortController;
  r.ResizeObserver = class { observe() {} disconnect() {} };
  r.requestAnimationFrame = fn => { const id = ++counter; frames.set(id, fn); return id; };
  r.cancelAnimationFrame = id => frames.delete(id);
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); for (const [id, fn] of frames) { frames.delete(id); fn(); } };
  const key = code => { const e = new Event('keydown', { cancelable: true }); e.code = code; e.repeat = false; b.doc.dispatchEvent(e); };
  loadExamples(r);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'examples', 'multi-lab', 'app.js'), 'utf8'), r);
  assert.equal(nodes.get('resume').disabled, true);
  assert.equal(nodes.get('maze-select').children.length, 7);
  nodes.get('calibrate').dispatchEvent(new Event('click')); await flush();
  assert.match(nodes.get('status').textContent, /1\/5/);
  key('Space'); b.move(2970, 0); key('Space'); b.move(0, -4200); key('Space'); await flush();
  assert.match(nodes.get('coords').textContent, /Provisoire/);
  b.move(-2970, 0); key('Space'); b.move(0, 4200); key('Space'); await flush();
  assert.match(nodes.get('quality').textContent, /0.00 cm/);
  assert.equal(nodes.get('measurements').children.length, 5);
  assert.equal(nodes.get('resume').disabled, false);
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
  r.window.dispatchEvent(new Event('pagehide')); await flush();
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
  assert.equal(r.MAZE_EXAMPLES.length, 7);
  for (const example of r.MAZE_EXAMPLES.slice(1)) {
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
