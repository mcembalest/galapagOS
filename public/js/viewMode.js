// galapagOS view mode helper: grid/list toggle with persistence via callbacks

/**
 * Manages grid/list view state and wiring for a panel.
 * - getMode(): returns 'grid' | 'list'
 * - setMode(mode): persists and emits
 */
export function createViewModeController({ getMode, setMode, panelEl, toggleEl, onRender }) {
  const apply = (mode) => {
    panelEl?.classList.toggle('list-view', mode === 'list');
    if (toggleEl) toggleEl.querySelectorAll('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.mode === mode));
    if (typeof onRender === 'function') onRender(mode);
  };

  const init = () => {
    wire();
    const mode = getMode();
    apply(mode);
  };

  const wire = () => {
    if (!toggleEl) return;
    toggleEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.toggle-btn');
      if (!btn) return;
      const mode = btn.dataset.mode === 'list' ? 'list' : 'grid';
      setMode(mode);
      apply(mode);
    });
  };

  return { init, apply, wire };
}

