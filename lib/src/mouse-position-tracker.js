/* This classic script also works when you open the HTML file directly. */
(() => {
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const norm = p => Math.hypot(p.x, p.y);
  const copy = value => structuredClone(value);
  const PROFILE_VERSION = 1;
  const INPUT_MODES = ['raw-requested', 'raw-unconfirmed', 'standard'];

  /** Measures relative mouse movement. Other classes handle maze geometry and drawing. */
  class MousePositionTracker extends EventTarget {
    constructor({ element = document.body, widthCm, heightCm, start = { x: widthCm / 2, y: 0 } }) {
      super();
      if (![widthCm, heightCm].every(n => Number.isFinite(n) && n > 0)) throw new TypeError('Dimensions positives requises.');
      if (![start.x, start.y].every(Number.isFinite) || start.x < 0 || start.x > widthCm || start.y < 0 || start.y > heightCm) throw new TypeError('Départ hors du rectangle.');
      this._element = element;
      this._document = element.ownerDocument;
      this._config = { widthCm, heightCm, start: { ...start } };
      this._marks = [
        { name: 'bas gauche', x: 0, y: 0 }, { name: 'bas droit', x: widthCm, y: 0 },
        { name: 'haut droit', x: widthCm, y: heightCm }, { name: 'haut gauche', x: 0, y: heightCm },
        { name: 'retour bas gauche', x: 0, y: 0 }
      ];
      this._raw = { x: 0, y: 0 };
      this._delta = { x: 0, y: 0 };
      this._clearCalibration();
      this._rawRequested = true;
      this._inputMode = 'raw-requested';
      this._error = null;
      this._pending = null;
      this._requesting = false;
      this._destroyed = false;
      this._listeners = {
        mousemove: e => {
          if (!this._locked() || this._needsRecenter) return;
          this._delta = { x: e.movementX, y: e.movementY };
          this._raw.x += e.movementX;
          this._raw.y += e.movementY;
          this._notify('positionchange', 'movement');
        },
        pointerlockchange: () => {
          if (this._destroyed) return;
          const action = this._pending;
          this._pending = null;
          if (this._locked() && action === 'release') { this.pause(); return; }
          if (this._locked() && action === 'calibrate') this._beginCalibration();
          this._notify('statechange', 'lock');
        },
        pointerlockerror: () => {
          this._pending = null;
          this._fail('lock', 'Le navigateur a refusé le suivi. Réessaie depuis un clic.');
        }
      };
      for (const [name, listener] of Object.entries(this._listeners)) this._document.addEventListener(name, listener);
    }

    _locked() { return !this._destroyed && this._document.pointerLockElement === this._element; }
    _assertAlive() { if (this._destroyed) throw new Error('Tracker détruit.'); }
    _fail(code, message) {
      this._error = { code, message };
      this._notify('error', code);
    }
    _notify(type, reason) {
      if (this._destroyed) return;
      // Each event gets its own copy of the tracker state.
      this.dispatchEvent(new CustomEvent(type, { detail: { ...this.getState(), reason } }));
      if (type !== 'statechange') this.dispatchEvent(new CustomEvent('statechange', { detail: { ...this.getState(), reason } }));
    }

    /** Call this from a user click handler. */
    async _activate(action) {
      this._assertAlive();
      if (this._pending || this._requesting) throw new Error('Une activation est déjà en cours.');
      if (this._document.pointerLockElement && this._document.pointerLockElement !== this._element) {
        this._fail('lock-owned', 'Un autre élément possède déjà le pointeur. Libère-le avant de reprendre.');
        return false;
      }
      if (!this._element.requestPointerLock) {
        this._fail('unsupported', 'Ce navigateur ne prend pas en charge Pointer Lock.');
        return false;
      }
      this._error = null;
      if (this._locked()) {
        if (action === 'calibrate') this._beginCalibration();
        this._notify('statechange', action);
        return true;
      }
      this._pending = action;
      this._requesting = true;
      try {
        const result = this._element.requestPointerLock({ unadjustedMovement: this._rawRequested });
        this._inputMode = this._rawRequested ? (result?.then ? 'raw-requested' : 'raw-unconfirmed') : 'standard';
        if (action === 'resume' && this._calibrated && this._calibrationInputMode !== this._inputMode) {
          // Release a lock granted under a different input mode, even if it arrives later.
          this._pending = this._locked() ? null : 'release';
          this._clearCalibration();
          this._fail('input-mode-changed', 'Le mode d’entrée a changé. Refais la calibration.');
          this.pause();
          await result;
          return false;
        }
        this._notify('statechange', 'request');
        await result;
        return !this._destroyed;
      } catch (error) {
        this._pending = null;
        if (this._destroyed) { this._releaseLateLock?.(); return false; }
        if (error.name === 'NotSupportedError' && this._rawRequested) {
          // The next click uses standard input and needs a new calibration.
          this._rawRequested = false;
          this._inputMode = 'standard';
          this._clearCalibration();
          this._fail('raw-unsupported', 'Entrée brute indisponible. Relance la calibration en mode standard.');
        } else this._fail('lock', 'Activation refusée. Réessaie depuis un clic utilisateur.');
        return false;
      } finally { this._requesting = false; }
    }

    _clearCalibration() {
      this._samples = [];
      this._model = null;
      this._calibrated = false;
      this._calibrating = false;
      this._needsRecenter = false;
      this._calibrationInputMode = null;
    }
    _beginCalibration() {
      this._clearCalibration();
      this._raw = { x: 0, y: 0 };
      this._delta = { x: 0, y: 0 };
      this._calibrating = true;
      this._notify('calibrationchange', 'start');
    }
    startCalibration() { return this._activate('calibrate'); }
    resume() {
      this._assertAlive();
      if (!this._calibrated && !this._calibrating) throw new Error('Une calibration est nécessaire.');
      return this._activate('resume');
    }
    pause() {
      this._assertAlive();
      if (this._locked()) this._document.exitPointerLock();
    }

    /** Use four corners to set the scale. The fifth point measures drift. */
    captureCalibrationPoint() {
      this._assertAlive();
      if (!this._calibrating || !this._locked()) throw new Error('Calibration active requise.');
      this._samples.push({ ...this._raw });
      if (this._samples.length === 4) {
        try { this._model = this._fit(this._samples); }
        catch (error) {
          this._calibrating = false;
          this._fail('calibration', error.message);
          this.pause();
          return false;
        }
      }
      if (this._samples.length === 5) {
        this._calibrated = true;
        this._calibrating = false;
        this._calibrationInputMode = this._inputMode;
        this._notify('calibrationchange', 'complete');
        this.pause();
      } else this._notify('calibrationchange', 'capture');
      return true;
    }

    exportCalibration() {
      this._assertAlive();
      if (!this._calibrated) throw new Error('Calibration complète requise.');
      const { widthCm, heightCm } = this._config;
      return {
        version: PROFILE_VERSION, widthCm, heightCm, inputMode: this._calibrationInputMode,
        samples: this._samples.map(point => sub(point, this._samples[0]))
      };
    }

    importCalibration(profile) {
      this._assertAlive();
      if (this._locked() || this._pending || this._requesting) throw new Error('Mets le suivi en pause avant de charger une calibration.');
      if (profile?.version !== PROFILE_VERSION || !INPUT_MODES.includes(profile.inputMode)) {
        throw new TypeError('Version ou mode d’entrée du profil de calibration invalide.');
      }
      const { widthCm, heightCm } = this._config;
      if (profile.widthCm !== widthCm || profile.heightCm !== heightCm) throw new TypeError('Les dimensions du profil ne correspondent pas au labyrinthe.');
      if (!Array.isArray(profile.samples) || profile.samples.length !== this._marks.length) throw new TypeError('Le profil doit contenir cinq relevés.');
      const points = [...profile.samples];
      if (!points.every(point => point && [point.x, point.y].every(Number.isFinite))) throw new TypeError('Le profil contient des relevés invalides.');
      const samples = points.map(point => sub(point, points[0]));
      const model = this._fit(samples);
      if (!samples.every(point => {
        const { x, y } = this._map(point, model);
        return Number.isFinite(x) && Number.isFinite(y);
      })) throw new TypeError('Les relevés du profil ne peuvent pas être convertis en centimètres.');

      this._samples = samples;
      this._model = model;
      this._raw = { x: 0, y: 0 };
      this._delta = { x: 0, y: 0 };
      this._calibrating = false;
      this._calibrated = true;
      this._needsRecenter = true;
      this._calibrationInputMode = profile.inputMode;
      this._inputMode = profile.inputMode;
      this._rawRequested = profile.inputMode !== 'standard';
      this._error = null;
      this._notify('calibrationchange', 'import');
    }

    _fit([bl, br, tr, tl]) {
      const h = { x: (br.x - bl.x + tr.x - tl.x) / 2, y: (br.y - bl.y + tr.y - tl.y) / 2 };
      const v = { x: (tl.x - bl.x + tr.x - br.x) / 2, y: (tl.y - bl.y + tr.y - br.y) / 2 };
      const det = h.x * v.y - h.y * v.x;
      if (!Number.isFinite(det) || norm(h) < 10 || norm(v) < 10 || Math.abs(det) < 0.2 * norm(h) * norm(v)) throw new Error('Coins trop proches ou axes incohérents. Recommence.');
      const residual = norm({ x: tr.x - br.x - tl.x + bl.x, y: tr.y - br.y - tl.y + bl.y });
      if (residual > 0.15 * Math.min(norm(h), norm(v))) throw new Error('Coins incohérents. Vérifie l’orientation et recommence.');
      return {
        origin: { x: (bl.x + br.x + tr.x + tl.x) / 4 - (h.x + v.x) / 2, y: (bl.y + br.y + tr.y + tl.y) / 4 - (h.y + v.y) / 2 }, h, v, det
      };
    }
    _provisionalModel() {
      if (this._model) return this._model;
      if (this._samples.length < 3) return null;
      const [bl, br, tr] = this._samples;
      try { return this._fit([bl, br, tr, { x: bl.x + tr.x - br.x, y: bl.y + tr.y - br.y }]); }
      catch { return null; }
    }
    _map(value, model) {
      if (!model) return null;
      const { origin, h, v, det } = model, p = sub(value, origin);
      return { x: (p.x * v.y - p.y * v.x) / det * this._config.widthCm, y: (h.x * p.y - h.y * p.x) / det * this._config.heightCm };
    }

    /** Reset the position while keeping the scale. This records no new movement. */
    recenter(position = this._config.start) {
      this._assertAlive();
      if (!this._calibrated) throw new Error('Calibration complète requise.');
      if (this._needsRecenter && !this._locked()) throw new Error('Reprends le suivi avant de recaler la calibration chargée.');
      if (![position.x, position.y].every(Number.isFinite)) throw new TypeError('Position invalide.');
      const { origin, h, v } = this._model, { widthCm, heightCm } = this._config;
      this._raw = { x: origin.x + h.x * position.x / widthCm + v.x * position.y / heightCm, y: origin.y + h.y * position.x / widthCm + v.y * position.y / heightCm };
      this._delta = { x: 0, y: 0 };
      this._needsRecenter = false;
      this._notify('positionchange', 'recenter');
    }

    getState() {
      const model = this._calibrating ? this._provisionalModel() : this._model;
      const measurements = this._samples.map((sample, i) => {
        const position = this._map(sample, model), target = this._marks[i];
        return { name: target.name, target, position, errorCm: position ? norm(sub(position, target)) : null };
      });
      const closureCm = this._samples.length === 5 && model ? norm(sub(this._map(this._samples[4], model), this._map(this._samples[0], model))) : null;
      return copy({
        supported: !!this._element.requestPointerLock, destroyed: this._destroyed,
        locked: this._locked(), calibrated: this._calibrated, calibrating: this._calibrating,
        provisional: this._calibrating, needsRecenter: this._needsRecenter, config: this._config,
        position: this._needsRecenter ? null : this._map(this._raw, model),
        raw: this._raw, rawOffset: sub(this._raw, this._samples[0] || { x: 0, y: 0 }), delta: this._delta,
        inputMode: this._inputMode, error: this._error,
        calibration: {
          step: this._calibrating ? this._samples.length + 1 : null, total: 5,
          target: this._calibrating ? this._marks[this._samples.length] : null, marks: this._marks,
          measurements, closureCm, warning: closureCm !== null && closureCm > 0.5,
          maxCornerErrorCm: model && measurements.length ? Math.max(...measurements.slice(0, 4).map(m => m.errorCm)) : null,
          unitsPerCm: model ? { x: norm(model.h) / this._config.widthCm, y: norm(model.v) / this._config.heightCm } : null
        }
      });
    }

    destroy() {
      if (this._destroyed) return;
      // The browser may still grant a lock after the tracker is destroyed.
      // Release any late lock without restarting the tracker.
      if (this._pending || this._requesting) {
        const releaseLateLock = () => {
          this._document.removeEventListener('pointerlockchange', releaseLateLock);
          this._document.removeEventListener('pointerlockerror', releaseLateLock);
          this._releaseLateLock = null;
          if (this._document.pointerLockElement === this._element) this._document.exitPointerLock();
        };
        this._releaseLateLock = releaseLateLock;
        this._document.addEventListener('pointerlockchange', releaseLateLock);
        this._document.addEventListener('pointerlockerror', releaseLateLock);
      }
      for (const [name, listener] of Object.entries(this._listeners)) this._document.removeEventListener(name, listener);
      const ownsLock = this._locked();
      this._destroyed = true;
      if (ownsLock) this._document.exitPointerLock();
    }
  }
  globalThis.MousePositionTracker = MousePositionTracker;
})();
