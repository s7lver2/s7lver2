export function track(type: string, extra?: Record<string, unknown>) {
  try {
    fetch('/api/event', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...extra }), keepalive: true });
  } catch {}
}
