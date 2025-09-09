// galapagOS platform UI state with scoped pub/sub for UI config

const listeners = new Map();

export const uiState = {
  uiConfig: null,
};

function emit(event, payload) {
  const set = listeners.get(event);
  if (set) set.forEach((cb) => cb(payload));
}

/**
 * [galapagOS] Subscribe to UI events (currently 'uiConfig:change').
 * @param {string} event
 * @param {(payload:any)=>void} cb
 * @returns {()=>void}
 */
export function subscribe(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

/**
 * [galapagOS] Read the current UI config object.
 */
export function getUiConfigState() {
  return uiState.uiConfig;
}

/**
 * [galapagOS] Replace UI config and notify listeners.
 * @param {object} cfg
 */
export function setUiConfigState(cfg) {
  uiState.uiConfig = cfg;
  emit('uiConfig:change', cfg);
}

