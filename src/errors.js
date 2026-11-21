// Report designer errors to the server so a broken deploy shows up in
// the admin page without a visitor having to tell anyone.

const sent = new Set();
let count = 0;

export function reportError(message, where = '') {
  try {
    const msg = String(message || 'Unknown error').slice(0, 500);
    const key = `${msg}|${where}`;
    if (sent.has(key) || count >= 10) return;
    sent.add(key);
    count++;
    fetch('/api/client-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, where: String(where).slice(0, 200), page: location.pathname }),
      keepalive: true
    }).catch(() => {});
  } catch {}
}

export function initErrorReporting() {
  window.addEventListener('error', (e) => {
    // Ignore errors from browser extensions and other scripts.
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    reportError(e.message, e.filename ? `${e.filename.replace(location.origin, '')}:${e.lineno}` : 'window');
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError(r && r.message ? r.message : String(r), 'promise');
  });
}
