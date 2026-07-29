export const globalLogs = [];
const MAX_LOGS = 1000;
export const logListeners = new Set();

let initialized = false;

function formatArg(arg) {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
  }
  return String(arg);
}

export function initLogger() {
  if (initialized) return;
  initialized = true;

  const original = {};
  const methods = ['log', 'info', 'warn', 'error', 'debug'];

  const pushLog = (level, args) => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      level,
      message: args.map(formatArg).join(' '),
    };
    globalLogs.push(entry);
    if (globalLogs.length > MAX_LOGS) globalLogs.shift();
    logListeners.forEach(fn => fn(entry));
  };

  for (const m of methods) {
    original[m] = console[m];
    console[m] = (...args) => {
      original[m].apply(console, args);
      pushLog(m, args);
    };
  }

  window.addEventListener('error', (e) => pushLog('error', [`[Uncaught] ${e.message || e}`]));
  window.addEventListener('unhandledrejection', (e) => pushLog('error', [`[UnhandledRejection] ${e.reason?.message || e.reason || e}`]));
}
