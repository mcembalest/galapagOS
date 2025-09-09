// galapagOS keepalive helper: send final payload on page unload

/**
 * Register a beforeunload keepalive PUT request.
 * @param {{ endpoint: string, buildPayload: ()=>object }} opts
 */
export function registerKeepalive({ endpoint, buildPayload }) {
  if (!endpoint || typeof buildPayload !== 'function') return;
  try {
    window.addEventListener('beforeunload', () => {
      try {
        const payload = buildPayload();
        if (!payload) return;
        fetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          keepalive: true
        });
      } catch (_) {}
    });
  } catch (_) {}
}

