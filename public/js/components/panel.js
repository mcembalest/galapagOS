// galapagOS Panel component: toggle open/close and resizable height via grabber

/**
 * Wire up a toggle button to open/close a panel element.
 * Calls onToggle(open:boolean) after each state change.
 */
export function attachPanelToggle({ panelEl, toggleBtnEl, onToggle }) {
  if (!panelEl || !toggleBtnEl) return;
  const setOpen = (open) => {
    panelEl.classList.toggle('open', !!open);
    if (typeof onToggle === 'function') onToggle(!!open);
  };
  toggleBtnEl.onclick = () => setOpen(!panelEl.classList.contains('open'));
}

/**
 * Add pointer/mouse/touch handlers for resizing a panel's height using a grabber.
 * Persists the height into the provided CSS variable and calls onResizeEnd(value:string).
 */
export function attachPanelResizer({ grabberEl, cssVar = '--panel-height', minVh = 18, maxVh = 60, onResizeEnd }) {
  if (!grabberEl) return;
  let startY = 0; let startHeight = 0; let active = false;

  const computeStartHeight = () => {
    const current = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    const vh = current.endsWith('vh') ? parseFloat(current) : 28;
    startHeight = (vh / 100) * window.innerHeight;
  };
  const applyY = (clientY) => {
    const dy = startY - clientY;
    const newVh = Math.max(minVh, Math.min(maxVh, ((startHeight + dy) / window.innerHeight) * 100));
    const value = newVh.toFixed(1) + 'vh';
    document.documentElement.style.setProperty(cssVar, value);
  };
  const persist = () => {
    const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
    if (value && typeof onResizeEnd === 'function') onResizeEnd(value);
  };

  const onPointerMove = (e) => { if (!active) return; e.preventDefault(); applyY(e.clientY); };
  const onPointerUp = () => { if (!active) return; active = false; window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); persist(); };
  const onPointerDown = (e) => { active = true; startY = e.clientY; computeStartHeight(); window.addEventListener('pointermove', onPointerMove, { passive: false }); window.addEventListener('pointerup', onPointerUp); };
  grabberEl.addEventListener('pointerdown', onPointerDown);

  // Legacy fallback
  const onMove = (e) => { if (!active) return; const y = e.touches ? e.touches[0].clientY : e.clientY; applyY(y); };
  const onEnd = () => { if (!active) return; active = false; document.removeEventListener('mousemove', onMove); document.removeEventListener('touchmove', onMove); document.removeEventListener('mouseup', onEnd); document.removeEventListener('touchend', onEnd); persist(); };
  const onStart = (e) => { active = true; startY = e.touches ? e.touches[0].clientY : e.clientY; computeStartHeight(); document.addEventListener('mousemove', onMove); document.addEventListener('touchmove', onMove, { passive: false }); document.addEventListener('mouseup', onEnd); document.addEventListener('touchend', onEnd); };
  grabberEl.addEventListener('mousedown', onStart);
  grabberEl.addEventListener('touchstart', onStart, { passive: true });
}

/**
 * Convenience: auto attach panel behaviors using data-attribute defaults.
 * Looks for [data-panel], [data-panel-toggle], [data-panel-grabber].
 */
export function autoAttachPanel({ onToggle, cssVar = '--panel-height', minVh = 18, maxVh = 60, onResizeEnd } = {}) {
  const panelEl = document.querySelector('[data-panel]');
  const toggleBtnEl = document.querySelector('[data-panel-toggle]');
  const grabberEl = document.querySelector('[data-panel-grabber]');
  if (panelEl && toggleBtnEl) attachPanelToggle({ panelEl, toggleBtnEl, onToggle });
  if (grabberEl) attachPanelResizer({ grabberEl, cssVar, minVh, maxVh, onResizeEnd });
}
