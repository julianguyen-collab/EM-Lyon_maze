/* Connects the library classes to the page controls. */
(() => {
  const $ = id => document.getElementById(id);
  // Use a local copy so the page can change it independently of the original.
  const examples = globalThis.MAZE_EXAMPLES;
  let selected = examples[0];
  let config = readConfig(selected);
  let tracker = new MousePositionTracker({ element: document.body, ...config });
  let maze = new Maze(config);
  let renderer = new MazeRenderer($('maze'), maze, { showGrid: !!config.grid, theme: selected.theme });
  let mazeControls = new AbortController();
  $('grid').checked = !!config.grid;
  const controls = new AbortController();
  const profileFile = $('calibration-file');
  const profileCode = $('calibration-code');
  const profileStatus = $('calibration-profile-status');
  let calibrationJson = '', readingProfile = false;
  let frame = null, lastError = '', lastTable = '', eventCount = 0;
  const fmt = n => n == null ? '—' : n.toFixed(2);

  function readConfig({ config: layout }) {
    const defaults = globalThis.MAZE_CONFIG;
    const widthCm = layout.widthCm ?? defaults.widthCm;
    const heightCm = layout.heightCm ?? defaults.heightCm;
    return structuredClone({
      ...layout,
      widthCm,
      heightCm,
      start: layout.start ?? { x: widthCm / 2, y: 0 },
      edgeToleranceCm: layout.edgeToleranceCm ?? defaults.edgeToleranceCm
    });
  }

  // Process each measurement right away and redraw on the next frame.
  const schedule = () => { if (frame === null) frame = requestAnimationFrame(() => { frame = null; updateUI(); }); };

  function bindTrackerEvents() {
    // Set a fresh reference position after recentering or calibration.
    tracker.addEventListener('positionchange', ({ detail }) => {
      if (!detail.calibrated || detail.provisional) return;
      if (detail.reason === 'recenter') maze.resetPosition(detail.position);
      else maze.updatePosition(detail.position);
    });
    tracker.addEventListener('calibrationchange', ({ detail }) => {
      maze.resetPosition(detail.calibrated ? detail.position : null);
      showCalibrationProfile(detail.calibrated);
    });
    tracker.addEventListener('error', ({ detail }) => {
      if (!detail.calibrated) {
        maze.resetPosition();
        showCalibrationProfile(false);
      }
    });
    tracker.addEventListener('statechange', schedule);
  }

  function showCalibrationProfile(calibrated) {
    calibrationJson = calibrated ? JSON.stringify(tracker.exportCalibration(), null, 2) : '';
    profileCode.value = calibrationJson ? `const calibration = ${calibrationJson};` : '';
    profileStatus.textContent = '';
  }

  function trackingStatus(s) {
    if (s.needsRecenter) {
      return s.locked ? 'Place la souris au départ et appuie sur D pour commencer.' : 'Calibration chargée. Reprends le suivi, place la souris au départ et appuie sur D.';
    }
    if (s.calibrating) return `${s.locked ? '' : 'En pause. Reprends le suivi. '}Repère ${s.calibration.step}/5 : ${s.calibration.target.name}. Valide avec Espace.`;
    if (s.locked) return 'Suivi actif. Échap pour mettre en pause.';
    return s.calibrated ? 'En pause. Reprends, place la souris au départ et appuie sur D.' : 'Prêt pour la calibration.';
  }

  function updateUI() {
    const s = tracker.getState(), m = maze.getState(), p = s.position, cal = s.calibration;
    renderer.render(s);
    const recenterPrompt = 'Recalage au départ requis.';
    $('coords').textContent = p ? `${s.provisional ? 'Provisoire · ' : ''}X : ${fmt(p.x)} | Y : ${fmt(p.y)} cm` : s.needsRecenter ? recenterPrompt : 'Position non calibrée';
    const outside = p && (p.x < 0 || p.y < 0 || p.x > config.widthCm || p.y > config.heightCm);
    const near = p && Math.min(p.x, p.y, config.widthCm - p.x, config.heightCm - p.y) <= config.edgeToleranceCm;
    $('boundary').textContent = !p ? (s.needsRecenter ? recenterPrompt : 'Calibration nécessaire.') : outside ? 'Hors des limites — rouge.' : near || m?.wallIds.length || m?.obstacleIds.length ? 'Contact estimé / bord — orange.' : 'Dans le labyrinthe — bleu.';
    $('status').textContent = lastError || s.error?.message || trackingStatus(s);
    $('calibrate').disabled = !s.supported || s.locked || readingProfile;
    $('resume').disabled = !s.supported || s.locked || readingProfile || (!s.calibrated && !s.calibrating);
    $('home').disabled = !s.calibrated || s.locked || s.needsRecenter || readingProfile;
    $('maze-select').disabled = s.locked || s.calibrating || readingProfile;
    profileFile.disabled = s.locked || readingProfile;
    $('calibration-export').disabled = !calibrationJson || s.locked || readingProfile;
    $('calibration-copy').disabled = !calibrationJson || s.locked || readingProfile;
    $('input-mode').textContent = {
      'raw-requested': 'Entrée brute demandée : sans accélération système si prise en charge.',
      'raw-unconfirmed': 'Ancienne API : entrée brute demandée, prise en charge non confirmée.',
      standard: 'Entrée standard : accélération possible.'
    }[s.inputMode];
    $('raw-position').textContent = `Signal depuis le premier coin : X ${s.rawOffset.x.toFixed(0)} | Y ${s.rawOffset.y.toFixed(0)} unités souris (pas des cm).`;
    $('movement').textContent = `Dernier mouvement : ΔX ${s.delta.x} | ΔY ${s.delta.y}.`;
    $('target').textContent = cal.target ? `Cible : X ${fmt(cal.target.x)} | Y ${fmt(cal.target.y)} cm.` : '';
    $('edge-distances').textContent = p ? `Distances signées : gauche ${fmt(p.x)}, droite ${fmt(config.widthCm - p.x)}, bas ${fmt(p.y)}, haut ${fmt(config.heightCm - p.y)} cm.` : s.needsRecenter ? '' : 'Position en cm disponible après le troisième coin.';
    $('quality').textContent = (cal.unitsPerCm ? `Échelle ${cal.unitsPerCm.x.toFixed(1)} / ${cal.unitsPerCm.y.toFixed(1)} unités par cm (X/Y). Écart max des coins : ${fmt(cal.maxCornerErrorCm)} cm. ` : '') +
      (cal.closureCm !== null ? `Dérive au retour : ${fmt(cal.closureCm)} cm. ${cal.warning ? 'Écart important : vérifie placement, orientation et vitesse.' : 'Vérifie aussi le centre à plusieurs vitesses.'}` : 'Estimation provisoire ; la précision physique reste à vérifier.');
    const table = JSON.stringify(cal.measurements);
    if (table !== lastTable) {
      lastTable = table; $('measurements').replaceChildren();
      for (const entry of cal.measurements) {
        const row = document.createElement('tr');
        for (const value of [entry.name, fmt(entry.position?.x), fmt(entry.position?.y), fmt(entry.errorCm)]) {
          const td = document.createElement('td'); td.textContent = value; row.append(td);
        }
        $('measurements').append(row);
      }
    }
    const grid = maze.getDefinition().grid;
    const cell = p ? maze.getCell(p) : null;
    $('cell').textContent = !grid ? 'Grille désactivée.' : cell ? `Case : colonne ${cell.column + 1}, ligne ${cell.row + 1} (comptées depuis le bas gauche).` : 'Grille active ; aucune case à cette position.';
  }

  async function command(fn) {
    lastError = '';
    try { await fn(); } catch (error) { lastError = error.message; }
    schedule();
  }
  $('calibrate').addEventListener('click', () => command(() => tracker.startCalibration()), { signal: controls.signal });
  $('resume').addEventListener('click', () => command(() => tracker.resume()), { signal: controls.signal });
  $('home').addEventListener('click', () => command(() => tracker.recenter(config.start)), { signal: controls.signal });
  $('calibration-export').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'calibration.json';
    link.href = `data:application/json;charset=utf-8,${encodeURIComponent(calibrationJson)}`;
    link.click();
  }, { signal: controls.signal });
  profileFile.addEventListener('change', async () => {
    const file = profileFile.files[0];
    profileFile.value = '';
    if (!file || readingProfile) return;
    readingProfile = true;
    profileStatus.textContent = '';
    updateUI();
    try {
      const contents = await file.text();
      if (controls.signal.aborted) return;
      let profile;
      try { profile = JSON.parse(contents); }
      catch { throw new Error('Le fichier ne contient pas un JSON valide.'); }
      tracker.importCalibration(profile);
      lastError = '';
      profileStatus.textContent = 'Calibration chargée.';
    } catch (error) {
      profileStatus.textContent = `Chargement impossible. ${error.message}`;
    } finally {
      readingProfile = false;
      if (!controls.signal.aborted) schedule();
    }
  }, { signal: controls.signal });
  $('calibration-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(profileCode.value);
      profileStatus.textContent = 'Variable copiée.';
    } catch {
      profileCode.focus();
      profileCode.select();
      profileStatus.textContent = 'Variable sélectionnée. Appuie sur Ctrl+C ou Cmd+C.';
    }
  }, { signal: controls.signal });
  $('grid').addEventListener('change', e => {
    const enabled = e.target.checked;
    maze.setGrid(enabled ? (config.grid || { cellWidthCm: 9.9, cellHeightCm: 7 }) : null);
    renderer.setGridVisible(enabled);
  }, { signal: controls.signal });
  document.addEventListener('keydown', e => {
    const state = tracker.getState();
    if (!state.locked || e.repeat) return;
    if (e.code === 'Space' && state.calibrating) { e.preventDefault(); command(() => tracker.captureCalibrationPoint()); }
    if (e.code === 'KeyD' && state.calibrated) command(() => tracker.recenter(config.start));
  }, { signal: controls.signal });
  const names = {
    wallenter: 'Contact mur', wallleave: 'Fin du contact mur', wallcross: 'Franchissement estimé de mur', walltouch: 'Contact entre deux mesures',
    obstacleenter: 'Entrée dans un obstacle', obstacleleave: 'Sortie d’un obstacle', obstaclecross: 'Passage dans un obstacle',
    zoneenter: 'Entrée dans une zone', zoneleave: 'Sortie d’une zone', zonecross: 'Passage dans une zone',
    outofbounds: 'Sortie du labyrinthe', boundsenter: 'Retour dans le labyrinthe', cellchange: 'Changement de case', finish: 'Arrivée'
  };
  function bindMazeEvents() {
    maze.addEventListener('gridchange', schedule, { signal: mazeControls.signal });
    for (const [type, label] of Object.entries(names)) maze.addEventListener(type, ({ detail }) => {
    if (!eventCount++) $('events').replaceChildren();
    const li = document.createElement('li'), p = detail.state.position;
    li.textContent = `${label}${detail.wallId || detail.obstacleId || detail.zoneId ? ` : ${detail.wallId || detail.obstacleId || detail.zoneId}` : ''} — X ${fmt(p.x)}, Y ${fmt(p.y)} cm`;
    $('events').prepend(li);
    while ($('events').children.length > 20) $('events').lastElementChild.remove();
    }, { signal: mazeControls.signal });
  }
  function describeExample() {
    const cm = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
    const size = `${cm.format(config.widthCm)} × ${cm.format(config.heightCm)} cm`;
    $('dimensions').textContent = `${size} · Vue à échelle réduite`;
    $('calibration-dimensions').textContent = size;
    $('start-coordinates').textContent = `X = ${cm.format(config.start.x)} cm et Y = ${cm.format(config.start.y)} cm`;
    $('maze-description').textContent = selected.description;
    $('maze-select').value = selected.id;
  }
  for (const entry of examples) {
    const option = document.createElement('option'); option.value = entry.id; option.textContent = entry.name;
    $('maze-select').append(option);
  }
  $('maze-select').addEventListener('change', e => command(() => {
    const state = tracker.getState();
    const entry = examples.find(example => example.id === e.target.value);
    if (!entry || state.locked || state.calibrating || readingProfile) { describeExample(); return; }
    const nextConfig = readConfig(entry);
    const nextMaze = new Maze(nextConfig);
    const dimensionsChanged = nextConfig.widthCm !== config.widthCm || nextConfig.heightCm !== config.heightCm;
    mazeControls.abort(); mazeControls = new AbortController(); renderer.destroy();
    selected = entry; config = nextConfig; maze = nextMaze;
    if (dimensionsChanged) {
      tracker.destroy();
      tracker = new MousePositionTracker({ element: document.body, ...config });
      bindTrackerEvents();
      showCalibrationProfile(false);
    } else {
      maze.resetPosition(state.calibrated ? state.position : null);
    }
    renderer = new MazeRenderer($('maze'), maze, { showGrid: !!config.grid, theme: selected.theme });
    $('grid').checked = !!config.grid;
    eventCount = 0; $('events').replaceChildren();
    const li = document.createElement('li'); li.textContent = 'Aucun événement.'; $('events').append(li);
    bindMazeEvents(); describeExample();
  }), { signal: controls.signal });
  bindTrackerEvents();
  bindMazeEvents(); describeExample();
  if (!tracker.getState().supported) lastError = 'Ce navigateur ne prend pas en charge Pointer Lock.';
  updateUI();

  // Clean up listeners and resources when leaving the page.
  window.addEventListener('pagehide', e => {
    tracker.pause();
    if (e.persisted) return; // The browser may restore this page from its navigation cache.
    controls.abort(); mazeControls.abort(); tracker.destroy(); renderer.destroy();
    if (frame !== null) cancelAnimationFrame(frame);
  });
})();
