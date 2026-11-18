(() => {
  const EPS = 1e-9;
  const finitePoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  function pointSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = dx * dx + dy * dy;
    const t = d ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / d)) : 0;
    return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
  }
  function intersects(a, b, c, d) {
    const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
    if (((abC > EPS && abD < -EPS) || (abC < -EPS && abD > EPS)) &&
        ((cdA > EPS && cdB < -EPS) || (cdA < -EPS && cdB > EPS))) return true;
    return pointSegment(c, a, b) <= EPS || pointSegment(d, a, b) <= EPS || pointSegment(a, c, d) <= EPS || pointSegment(b, c, d) <= EPS;
  }
  function segmentDistance(a, b, c, d) {
    return intersects(a, b, c, d) ? 0 : Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
  }
  function rectangleEdges(s) {
    const a = { x: s.x, y: s.y }, b = { x: s.x + s.width, y: s.y },
      c = { x: s.x + s.width, y: s.y + s.height }, d = { x: s.x, y: s.y + s.height };
    return [[a, b], [b, c], [c, d], [d, a]];
  }
  function pointInShape(p, s, radius = 0) {
    if (s.shape === 'circle') return distance(p, s.center) <= s.radius + radius + EPS;
    const dx = Math.max(s.x - p.x, 0, p.x - s.x - s.width);
    const dy = Math.max(s.y - p.y, 0, p.y - s.y - s.height);
    return Math.hypot(dx, dy) <= radius + EPS;
  }
  function segmentHitsShape(a, b, s, radius = 0) {
    if (pointInShape(a, s, radius) || pointInShape(b, s, radius)) return true;
    if (s.shape === 'circle') return pointSegment(s.center, a, b) <= s.radius + radius + EPS;
    return rectangleEdges(s).some(([c, d]) => segmentDistance(a, b, c, d) <= radius + EPS);
  }
  function validateShape(shape) {
    if (shape.shape === 'circle') {
      if (!finitePoint(shape.center) || !Number.isFinite(shape.radius) || shape.radius <= 0) throw new TypeError('Cercle invalide.');
    } else if (shape.shape === 'rectangle') {
      if (![shape.x, shape.y, shape.width, shape.height].every(Number.isFinite) || shape.width <= 0 || shape.height <= 0) throw new TypeError('Rectangle invalide.');
    } else throw new TypeError('Forme attendue : rectangle ou circle.');
  }

  /** Maze geometry uses centimeters. The grid gives each position a cell. */
  class Maze extends EventTarget {
    constructor({ widthCm, heightCm, start = { x: widthCm / 2, y: 0 }, finish = null,
      walls = [], obstacles = [], zones = [], grid = null, mouseRadiusCm = 0, edgeToleranceCm = 0.25 }) {
      super();
      if (![widthCm, heightCm].every(n => Number.isFinite(n) && n > 0) || !finitePoint(start) || start.x < 0 || start.x > widthCm || start.y < 0 || start.y > heightCm) throw new TypeError('Dimensions ou départ invalides.');
      if (![mouseRadiusCm, edgeToleranceCm].every(n => Number.isFinite(n) && n >= 0)) throw new TypeError('Rayon ou tolérance invalide.');
      const ids = new Set();
      for (const item of [...walls, ...obstacles, ...zones, ...(finish ? [finish] : [])]) {
        if (typeof item.id !== 'string' || !item.id || item.id.startsWith('boundary:') || ids.has(item.id)) throw new TypeError('Identifiants uniques requis (préfixe boundary: réservé).');
        ids.add(item.id);
      }
      for (const wall of walls) {
        if (!finitePoint(wall.from) || !finitePoint(wall.to) || distance(wall.from, wall.to) <= EPS || !Number.isFinite(wall.thickness) || wall.thickness < 0) throw new TypeError('Mur invalide.');
      }
      for (const shape of [...obstacles, ...zones, ...(finish ? [finish] : [])]) validateShape(shape);
      this._config = structuredClone({ widthCm, heightCm, start, finish, walls, obstacles, zones, grid: null, mouseRadiusCm, edgeToleranceCm });
      // Each wall extends half its thickness around a line segment, with rounded ends.
      this._walls = [...this._config.walls, ...[
        ['left', { x: 0, y: 0 }, { x: 0, y: heightCm }],
        ['right', { x: widthCm, y: 0 }, { x: widthCm, y: heightCm }],
        ['bottom', { x: 0, y: 0 }, { x: widthCm, y: 0 }],
        ['top', { x: 0, y: heightCm }, { x: widthCm, y: heightCm }]
      ].map(([id, from, to]) => ({ id: `boundary:${id}`, from, to, thickness: 0 }))];
      this._state = null;
      this.setGrid(grid);
    }
    getDefinition() { return structuredClone(this._config); }
    getState() { return structuredClone(this._state); }
    setGrid(grid) {
      if (grid !== null && (!grid || ![grid.cellWidthCm, grid.cellHeightCm].every(n => Number.isFinite(n) && n > 0))) throw new TypeError('Tailles de cases positives requises, ou null.');
      if (grid && ![this._config.widthCm / grid.cellWidthCm, this._config.heightCm / grid.cellHeightCm].every(Number.isFinite)) throw new TypeError('Grille trop fine.');
      this._config.grid = grid ? { cellWidthCm: grid.cellWidthCm, cellHeightCm: grid.cellHeightCm } : null;
      // A grid change keeps the position and skips collision checks.
      if (this._state) this._state = this._inspect(this._state.position);
      this.dispatchEvent(new CustomEvent('gridchange', { detail: { grid: structuredClone(this._config.grid) } }));
    }
    getCell(position) {
      const { grid, widthCm, heightCm } = this._config;
      if (!finitePoint(position) || !grid || position.x < 0 || position.y < 0 || position.x > widthCm || position.y > heightCm) return null;
      // The top and right edges belong to the last row or column, even if a cell is partial.
      return {
        column: Math.min(Math.floor(position.x / grid.cellWidthCm), Math.ceil(widthCm / grid.cellWidthCm) - 1),
        row: Math.min(Math.floor(position.y / grid.cellHeightCm), Math.ceil(heightCm / grid.cellHeightCm) - 1)
      };
    }
    _inspect(p) {
      const c = this._config, r = c.mouseRadiusCm;
      const distances = { left: p.x, right: c.widthCm - p.x, bottom: p.y, top: c.heightCm - p.y };
      const outside = Object.values(distances).some(d => d < -EPS);
      return {
        position: { ...p }, outside, nearBorder: !outside && Object.values(distances).some(d => d <= c.edgeToleranceCm + r), distances,
        cell: this.getCell(p),
        wallIds: this._walls.filter(w => pointSegment(p, w.from, w.to) <= w.thickness / 2 + r + EPS).map(w => w.id),
        obstacleIds: c.obstacles.filter(s => pointInShape(p, s, r)).map(s => s.id),
        zoneIds: c.zones.filter(s => pointInShape(p, s)).map(s => s.id),
        finished: !!c.finish && pointInShape(p, c.finish)
      };
    }
    /** Set a reference position without checking a path or emitting events. */
    resetPosition(position = null) {
      if (position !== null && !finitePoint(position)) throw new TypeError('Position invalide.');
      this._state = position === null ? null : this._inspect(position);
      return this.getState();
    }
    updatePosition(position) {
      if (!finitePoint(position)) throw new TypeError('Position finie requise.');
      const previous = this._state, next = this._inspect(position);
      this._state = next;
      const emit = (type, detail = {}) => this.dispatchEvent(new CustomEvent(type, { detail: { ...detail, previous: structuredClone(previous?.position ?? null), state: this.getState() } }));
      const transitions = (before, after, enter, leave, key) => {
        for (const id of after) if (!before.includes(id)) emit(enter, { [key]: id });
        for (const id of before) if (!after.includes(id)) emit(leave, { [key]: id });
      };
      transitions(previous?.wallIds || [], next.wallIds, 'wallenter', 'wallleave', 'wallId');
      transitions(previous?.obstacleIds || [], next.obstacleIds, 'obstacleenter', 'obstacleleave', 'obstacleId');
      transitions(previous?.zoneIds || [], next.zoneIds, 'zoneenter', 'zoneleave', 'zoneId');
      if (next.outside && !previous?.outside) emit('outofbounds');
      if (!next.outside && previous?.outside) emit('boundsenter');
      if (JSON.stringify(previous?.cell ?? null) !== JSON.stringify(next.cell)) emit('cellchange', { cell: next.cell });
      let passedFinish = false;
      if (previous) {
        const a = previous.position, b = next.position;
        for (const wall of this._walls) {
          // Two samples on opposite sides can detect a crossing
          // when their path intersects the wall's center line.
          const sideA = cross(wall.from, wall.to, a), sideB = cross(wall.from, wall.to, b);
          if (((sideA > EPS && sideB < -EPS) || (sideA < -EPS && sideB > EPS)) && intersects(a, b, wall.from, wall.to)) emit('wallcross', { wallId: wall.id });
          else if (!previous.wallIds.includes(wall.id) && !next.wallIds.includes(wall.id) && segmentDistance(a, b, wall.from, wall.to) <= wall.thickness / 2 + this._config.mouseRadiusCm + EPS) emit('walltouch', { wallId: wall.id });
        }
        for (const shape of this._config.obstacles) {
          if (!previous.obstacleIds.includes(shape.id) && !next.obstacleIds.includes(shape.id) && segmentHitsShape(a, b, shape, this._config.mouseRadiusCm)) emit('obstaclecross', { obstacleId: shape.id });
        }
        for (const shape of this._config.zones) {
          if (!previous.zoneIds.includes(shape.id) && !next.zoneIds.includes(shape.id) && segmentHitsShape(a, b, shape)) emit('zonecross', { zoneId: shape.id });
        }
        passedFinish = this._config.finish && !previous.finished && segmentHitsShape(a, b, this._config.finish);
      }
      if ((next.finished && !previous?.finished) || passedFinish) emit('finish', { zoneId: this._config.finish.id });
      emit('positionchange');
      return this.getState();
    }
  }
  globalThis.Maze = Maze;
})();
