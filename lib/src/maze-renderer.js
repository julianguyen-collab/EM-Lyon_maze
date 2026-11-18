(() => {
  /** Draws the maze and the measured position. */
  class MazeRenderer {
    constructor(canvas, maze, { showGrid = false, theme = {}, corridorArea = null } = {}) {
      this.canvas = canvas;
      this.maze = maze;
      this.showGrid = showGrid;
      // These colors control how the maze is drawn.
      this._theme = { floor: '#f8fafc', wall: '#263b57', corridor: '#dcefe9', path: '#16837a', zone: '#dce9ff', finish: '#b6e4ca', obstacle: '#8b98ac', text: '#516178', zoneText: '#263b57', ...theme };
      this._ctx = canvas.getContext('2d');
      if (!this._ctx) throw new Error('Canvas 2D indisponible.');
      this._corridorArea = corridorArea ? new Path2D(corridorArea) : null;
      this._snapshot = null;
      this._destroyed = false;
      this._onGrid = () => this.render();
      maze.addEventListener('gridchange', this._onGrid);
      this._observer = new ResizeObserver(() => this.render());
      this._observer.observe(canvas);
      this.render();
    }
    setGridVisible(visible) { this.showGrid = !!visible; this.render(); }
    render(snapshot = this._snapshot) {
      if (this._destroyed) return;
      this._snapshot = snapshot;
      const c = this.maze.getDefinition(), state = this.maze.getState();
      const position = snapshot && (!c.snapToPath || snapshot.calibrating) ? snapshot.position : state?.position;
      const canvas = this.canvas, ctx = this._ctx;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (w < 110 || h < 110) return;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // Expand the view to keep positions outside the maze visible.
      const minX = Math.min(0, position?.x ?? 0), maxX = Math.max(c.widthCm, position?.x ?? 0);
      const minY = Math.min(0, position?.y ?? 0), maxY = Math.max(c.heightCm, position?.y ?? 0);
      const scale = Math.min((w - 96) / (maxX - minX), (h - 100) / (maxY - minY));
      const left = (w - (maxX - minX) * scale) / 2 - minX * scale;
      const bottom = (h + (maxY - minY) * scale) / 2 + minY * scale;
      const point = p => ({ x: left + p.x * scale, y: bottom - p.y * scale });
      const top = bottom - c.heightCm * scale;
      const palette = this._theme;
      const width = c.widthCm * scale, height = c.heightCm * scale;
      ctx.fillStyle = palette.floor; ctx.fillRect(left, top, width, height);
      if (this._corridorArea) {
        // The area uses board coordinates in cm. Clip outlines at the physical edges.
        ctx.save();
        ctx.beginPath(); ctx.rect(left, top, width, height); ctx.clip();
        ctx.translate(left, bottom); ctx.scale(scale, -scale);
        ctx.fillStyle = palette.corridor;
        ctx.fill(this._corridorArea, 'evenodd');
        ctx.restore();
      }
      if (this.showGrid && c.grid) {
        ctx.strokeStyle = '#d6e0ec'; ctx.lineWidth = 1;
        const lines = (size, step, vertical) => {
          const count = Math.ceil(size / step);
          // Draw fewer grid lines when the cells are very small.
          const stride = Math.max(1, Math.ceil(count / 200));
          for (let i = 1; i < count; i += stride) {
            const value = i * step;
            const a = point(vertical ? { x: value, y: 0 } : { x: 0, y: value });
            const b = point(vertical ? { x: value, y: c.heightCm } : { x: c.widthCm, y: value });
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        };
        lines(c.widthCm, c.grid.cellWidthCm, true); lines(c.heightCm, c.grid.cellHeightCm, false);
      }
      const shape = (s, color, textColor = palette.zoneText) => {
        ctx.fillStyle = color;
        if (s.shape === 'circle') {
          const p = point(s.center); ctx.beginPath(); ctx.arc(p.x, p.y, s.radius * scale, 0, Math.PI * 2); ctx.fill();
        } else {
          const p = point({ x: s.x, y: s.y + s.height }); ctx.fillRect(p.x, p.y, s.width * scale, s.height * scale);
        }
        if (s.label) {
          const center = s.shape === 'circle' ? s.center : { x: s.x + s.width / 2, y: s.y + s.height / 2 };
          const p = point(center), width = s.shape === 'circle' ? s.radius * 2 : s.width;
          ctx.save(); ctx.fillStyle = textColor; ctx.font = '11px system-ui'; ctx.textAlign = 'center';
          ctx.fillText(s.label, p.x, p.y + 4, Math.max(12, width * scale - 6)); ctx.restore();
        }
      };
      c.zones.forEach(s => shape(s, palette.zone));
      if (c.finish) shape(c.finish, palette.finish, '#263b57');
      c.obstacles.forEach(s => shape(s, palette.obstacle, '#ffffff'));
      if (!this._corridorArea) {
        ctx.strokeStyle = palette.path;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const { points } of c.paths) {
          const first = point(points[0]);
          ctx.beginPath();
          ctx.moveTo(first.x, first.y);
          for (let i = 1; i < points.length; i++) {
            const next = point(points[i]);
            ctx.lineTo(next.x, next.y);
          }
          ctx.stroke();
        }
      }
      ctx.strokeStyle = palette.wall; ctx.lineCap = 'round';
      for (const wall of c.walls) {
        const a = point(wall.from), b = point(wall.to);
        ctx.lineWidth = Math.max(1, wall.thickness * scale);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.lineWidth = 3; ctx.strokeRect(left, top, width, height);
      ctx.font = '12px system-ui'; ctx.fillStyle = palette.text; ctx.textAlign = 'center';
      ctx.fillText(`${c.widthCm} cm`, left + c.widthCm * scale / 2, top - 18);
      ctx.save(); ctx.translate(left - 24, top + c.heightCm * scale / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${c.heightCm} cm`, 0, 0); ctx.restore();
      const start = point(c.start);
      ctx.beginPath(); ctx.arc(start.x, start.y, 8, 0, Math.PI * 2); ctx.fillStyle = '#168352'; ctx.fill();
      ctx.fillStyle = '#168352'; ctx.fillText('Départ', start.x, start.y + 25);
      if (snapshot?.calibrating) {
        snapshot.calibration.marks.slice(0, 4).forEach((mark, i) => {
          const p = point(mark), step = snapshot.calibration.step;
          ctx.fillStyle = step === i + 1 || (step === 5 && i === 0) ? '#e58c13' : i < step - 1 ? '#168352' : '#a8b6c8';
          ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'white'; ctx.fillText(String(i + 1), p.x, p.y + 4);
        });
      }
      if (position) {
        const outside = position.x < 0 || position.y < 0 || position.x > c.widthCm || position.y > c.heightCm;
        const near = Math.min(position.x, position.y, c.widthCm - position.x, c.heightCm - position.y) <= c.edgeToleranceCm + c.mouseRadiusCm;
        const collision = !snapshot?.provisional && (state?.wallIds.length || state?.obstacleIds.length);
        const p = point(position);
        ctx.strokeStyle = outside ? '#cb3030' : near || collision ? '#bd6900' : '#185bd7';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(7, c.mouseRadiusCm * scale), 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - 12, p.y); ctx.lineTo(p.x + 12, p.y); ctx.moveTo(p.x, p.y - 12); ctx.lineTo(p.x, p.y + 12); ctx.stroke();
      }
    }
    destroy() {
      this._destroyed = true;
      this._observer.disconnect();
      this.maze.removeEventListener('gridchange', this._onGrid);
    }
  }
  globalThis.MazeRenderer = MazeRenderer;
})();
