(() => {
  const output = document.getElementById('console-output');
  const entries = [];
  let frame = null;

  function format(value) {
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.stack || value.message;
    try { return JSON.stringify(value) ?? String(value); }
    catch { return '[Valeur non sérialisable]'; }
  }

  function render() {
    frame = null;
    const atBottom = output.scrollHeight - output.clientHeight - output.scrollTop <= 16;
    output.textContent = entries.join('\n');
    if (atBottom) output.scrollTop = output.scrollHeight;
  }

  function record(level, args) {
    const time = new Date().toLocaleTimeString('fr-FR');
    const message = args.map(format).join(' ').slice(0, 2048);
    entries.push(`[${time}] ${level.toUpperCase()} ${message}`);
    if (entries.length > 200) entries.shift();
    if (frame === null) frame = requestAnimationFrame(render);
  }

  for (const level of ['debug', 'info', 'log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      record(level, args);
    };
  }
  window.addEventListener('error', event => {
    if (event.message) record('error', [event.error ?? event.message]);
  });
  window.addEventListener('unhandledrejection', event => record('error', [event.reason]));
})();
