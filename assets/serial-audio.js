(() => {
  const $ = id => document.getElementById(id);
  const serial = globalThis.navigator?.serial;
  const baudRateSelect = $('baud-rate');
  const connectButton = $('serial-connect');
  const serialStatus = $('serial-status');
  const folderInput = $('mp3-folder');
  const testButton = $('test-sound');
  const soundStatus = $('sound-status');
  const audio = $('press-sound');
  let tracks = [], activeSound = null, queuedSounds = 0;
  let session = null, opening = false, disposed = false;

  function report(element, source, message, level = 'info') {
    element.textContent = message;
    console[level](source, message);
  }

  function stopSound() {
    if (!activeSound) return;
    const sound = activeSound;
    activeSound = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (sound.track.file) URL.revokeObjectURL(sound.url);
  }

  function setPlaylist(nextTracks, source) {
    queuedSounds = 0;
    stopSound();
    tracks = nextTracks;
    testButton.disabled = tracks.length === 0;
    const message = tracks.length ? `${tracks.length} MP3 depuis ${source}.` : `Aucun MP3 dans ${source}.`;
    report(soundStatus, '[Audio]', message);
  }

  function requestSound() {
    if (disposed) return;
    if (!tracks.length) {
      soundStatus.textContent = 'Sélectionne le dossier assets/mp3 pour jouer un son.';
      return;
    }
    queuedSounds++;
    if (!activeSound) void playNextSound();
  }

  async function playNextSound() {
    if (!queuedSounds || disposed) return;
    queuedSounds--;
    const track = tracks[Math.floor(Math.random() * tracks.length)];
    const sound = { track, url: track.file ? URL.createObjectURL(track.file) : track.url };
    activeSound = sound;
    audio.src = sound.url;
    try {
      await audio.play();
      if (activeSound === sound) report(soundStatus, '[Audio]', `Lecture de ${track.name}`);
    } catch (error) {
      if (activeSound !== sound) return;
      stopSound();
      const message = error.name === 'NotAllowedError'
        ? 'Clique sur Tester un son pour autoriser la lecture.'
        : `Lecture impossible pour ${track.name}. ${error.message}`;
      report(soundStatus, '[Audio]', message, 'warn');
      if (error.name === 'NotAllowedError') queuedSounds = 0;
      else void playNextSound();
    }
  }

  folderInput.addEventListener('change', () => {
    const files = Array.from(folderInput.files).filter(file => /\.mp3$/i.test(file.name));
    setPlaylist(files.map(file => ({ name: file.name, file })), 'le dossier sélectionné');
  });
  testButton.addEventListener('click', requestSound);
  audio.addEventListener('ended', () => {
    stopSound();
    void playNextSound();
  });
  audio.addEventListener('error', () => {
    if (!activeSound || !audio.error) return;
    report(soundStatus, '[Audio]', `Lecture impossible pour ${activeSound.track.name}.`, 'warn');
    stopSound();
    void playNextSound();
  });

  function readMessages(onPress) {
    let pending = '', timer;
    const maxLength = 512;
    function finishMessage() {
      const truncated = pending.length > maxLength;
      const message = pending.trim();
      pending = '';
      if (message) console.log('[COM] RX', truncated ? `${message}…` : message);
      if (!truncated && message === 'PRESS') onPress();
    }
    return {
      push(text) {
        clearTimeout(timer);
        const lines = text.split(/[\r\n]/);
        for (let i = 0; i < lines.length; i++) {
          pending += lines[i].slice(0, maxLength + 1 - pending.length);
          if (i < lines.length - 1) finishMessage();
        }
        // Some devices send PRESS without a line ending.
        if (pending) timer = setTimeout(finishMessage, 75);
      },
      stop() { clearTimeout(timer); }
    };
  }

  function updateControls() {
    baudRateSelect.disabled = !serial || opening || session !== null;
    connectButton.disabled = !serial || opening || !!session?.closing;
    connectButton.textContent = session ? 'Déconnecter le port COM' : 'Choisir le port COM';
  }

  async function listen(connection) {
    const decoder = new TextDecoder();
    const messages = readMessages(requestSound);
    let status = 'Port COM déconnecté.', level = 'info';
    try {
      connection.reader = connection.port.readable.getReader();
      while (!connection.closing) {
        const { value, done } = await connection.reader.read();
        if (done || connection.closing) break;
        messages.push(decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (!connection.closing) {
        status = `Lecture série interrompue. ${error.message}`;
        level = 'warn';
      }
    } finally {
      messages.stop();
      connection.closing = true;
      updateControls();
      connection.reader?.releaseLock();
      try { await connection.port.close(); }
      catch (error) {
        if (connection.port.connected !== false) {
          status = `Fermeture du port impossible. ${error.message}`;
          level = 'warn';
        }
      }
      session = null;
      report(serialStatus, '[COM]', status, level);
      updateControls();
    }
  }

  async function disconnect() {
    if (!session || session.closing) return;
    session.closing = true;
    serialStatus.textContent = 'Déconnexion du port COM…';
    updateControls();
    try { await session.reader?.cancel(); }
    catch { /* A device can disappear while the reader is being cancelled. */ }
  }

  async function connect() {
    const baudRate = Number(baudRateSelect.value);
    if (!Number.isInteger(baudRate) || baudRate < 1 || baudRate > 0xffffffff) {
      serialStatus.textContent = 'Saisis un débit entier positif.';
      return;
    }
    opening = true;
    updateControls();
    serialStatus.textContent = 'Choisis le port COM dans la boîte de dialogue.';
    try {
      const port = await serial.requestPort();
      if (disposed) return;
      await port.open({ baudRate });
      if (disposed) { await port.close(); return; }
      session = { port, reader: null, closing: false };
      report(serialStatus, '[COM]', `Port COM connecté à ${baudRate} bauds. En attente de PRESS.`);
      void listen(session);
    } catch (error) {
      if (error.name === 'NotFoundError') serialStatus.textContent = 'Sélection du port COM annulée.';
      else report(serialStatus, '[COM]', `Connexion au port COM impossible. ${error.message}`, 'warn');
    } finally {
      opening = false;
      updateControls();
    }
  }

  connectButton.addEventListener('click', () => {
    if (!serial || opening || disposed) return;
    if (session) void disconnect();
    else void connect();
  });
  window.addEventListener('pagehide', event => {
    disposed = !event.persisted;
    queuedSounds = 0;
    stopSound();
    void disconnect();
  });
  serialStatus.textContent = serial ? 'Choisis un port COM.' : 'Ouvre la page dans Chrome ou Edge pour utiliser le port COM.';
  setPlaylist((globalThis.MAZE_2_MP3_FILES ?? []).map(name => ({
    name,
    url: `assets/mp3/${encodeURIComponent(name)}`
  })), 'assets/mp3');
  updateControls();
})();
