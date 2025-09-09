// galapagOS UI Config API: stable platform endpoints for UI persistence

/**
 * [galapagOS] Fetch UI configuration (panels, cards, background, view).
 * @returns {Promise<object>}
 */
export async function getUiConfig() {
  const res = await fetch('/api/ui-config');
  if (!res.ok) throw new Error('getUiConfig failed');
  return res.json();
}

/**
 * [galapagOS] Persist UI configuration (deep-merges on server).
 * @param {object} cfg
 * @returns {Promise<object>}
 */
export async function putUiConfig(cfg) {
  const res = await fetch('/api/ui-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cfg)
  });
  if (!res.ok) throw new Error('putUiConfig failed');
  return res.json();
}

