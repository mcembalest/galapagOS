// galapagOS layout initializer: panel toggle/resizer + cards drag/resize + keepalive

import { putUiConfig } from '../api/uiConfig.js';
import { registerKeepalive } from '../api/keepalive.js';
import { setUiConfigState, getUiConfigState } from '../state/uiState.js';
import { attachPanelToggle, attachPanelResizer } from '../components/panel.js';
import { attachCardBehavior } from '../components/card.js';

/**
 * Initialize platform layout behaviors for an app panel and cards.
 * @param {Object} opts
 * @param {HTMLElement} opts.panelEl
 * @param {HTMLElement} [opts.toggleBtnEl]
 * @param {(open:boolean)=>void} [opts.onToggleLabel] - optional label updater when panel opens/closes
 * @param {string} [opts.cssVarPanel='--library-height'] - CSS var to persist panel height
 * @param {Array<{key:string, el:HTMLElement, dragHandleEl?:HTMLElement, resizeHandleEl?:HTMLElement, varPrefix?:string}>} opts.cards
 */
export function initPlatformLayout({ panelEl, toggleBtnEl, onToggleLabel, cssVarPanel = '--library-height', cards = [], grabberEl, appId } = {}) {
  if (!panelEl) return;

  // Optional key prefix to avoid collisions across apps on same origin
  const prefix = appId ? `gOS:${appId}:` : '';
  const lsGet = (key) => {
    try { return localStorage.getItem(prefix + key) ?? (prefix ? localStorage.getItem(key) : null); } catch (_) { return null; }
  };
  const lsSet = (key, value) => {
    try { localStorage.setItem(prefix + key, value); } catch (_) {}
  };

  // Panel open/close wiring with persistence
  if (toggleBtnEl) {
    attachPanelToggle({
      panelEl,
      toggleBtnEl,
      onToggle: (open) => {
        // Persist open state (optionally namespaced)
        lsSet('libraryOpen', open ? 'true' : 'false');
        if (typeof onToggleLabel === 'function') onToggleLabel(open);
        const next = {
          ...(getUiConfigState() || {}),
          panel: {
            ...((getUiConfigState() && getUiConfigState().panel) ? getUiConfigState().panel : {}),
            open
          }
        };
        setUiConfigState(next);
        try { putUiConfig(next); } catch (_) {}
      }
    });
  }

  // Panel resizer with persistence
  const resolvedGrabber = grabberEl || document.querySelector('[data-panel-grabber]') || document.getElementById('panel-grabber');
  if (resolvedGrabber) {
    attachPanelResizer({
      grabberEl: resolvedGrabber,
      cssVar: cssVarPanel,
      minVh: 18,
      maxVh: 60,
      onResizeEnd: (value) => {
        if (!value) return;
        // Persist height (optionally namespaced)
        lsSet('libraryHeight', value);
        const next = {
          ...(getUiConfigState() || {}),
          panel: {
            ...((getUiConfigState() && getUiConfigState().panel) ? getUiConfigState().panel : {}),
            height: value
          }
        };
        setUiConfigState(next);
        try { putUiConfig(next); } catch (_) {}
      }
    });
  }

  // Apply initial layout to cards and attach behaviors
  const applyLayout = (key, el, varPrefix) => {
    if (!el) return;
    const cfg = getUiConfigState();
    const rect = cfg?.layout?.cards?.[key] || {};
    const css = (name) => parseInt(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
    const x = parseInt(rect.x || (varPrefix ? css(`${varPrefix}-x`) : 0)) || 0;
    const y = parseInt(rect.y || (varPrefix ? css(`${varPrefix}-y`) : 0)) || 0;
    const w = parseInt(rect.w || (varPrefix ? css(`${varPrefix}-w`) : el.offsetWidth)) || el.offsetWidth;
    const h = parseInt(rect.h || (varPrefix ? css(`${varPrefix}-h`) : el.offsetHeight)) || el.offsetHeight;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    if (varPrefix) {
      const r = document.documentElement.style;
      r.setProperty(`${varPrefix}-x`, x + 'px');
      r.setProperty(`${varPrefix}-y`, y + 'px');
      r.setProperty(`${varPrefix}-w`, w + 'px');
      r.setProperty(`${varPrefix}-h`, h + 'px');
    }
  };

  const toRect = (el) => ({
    x: parseInt(el?.style.left || '0'),
    y: parseInt(el?.style.top || '0'),
    w: parseInt(el?.style.width || el?.offsetWidth || '0'),
    h: parseInt(el?.style.height || el?.offsetHeight || '0')
  });

  const saveLayout = async () => {
    const curr = getUiConfigState();
    const cardsRect = {};
    for (const c of cards) { if (c?.el) cardsRect[c.key] = toRect(c.el); }
    const payload = {
      ...(curr || {}),
      layout: {
        ...(curr && curr.layout ? curr.layout : {}),
        cards: { ...(curr?.layout?.cards || {}), ...cardsRect }
      }
    };
    try {
      const cached = Object.fromEntries(Object.entries(cardsRect));
      lsSet('cardsLayout', JSON.stringify(cached));
    } catch (_) {}
    try { await putUiConfig(payload); } catch (_) {}
  };

  for (const c of cards) {
    if (!c?.el) continue;
    applyLayout(c.key, c.el, c.varPrefix);
    attachCardBehavior({
      cardEl: c.el,
      dragHandleEl: c.dragHandleEl || c.el,
      resizeHandleEl: c.resizeHandleEl,
      onCommit: saveLayout
    });
  }

  // Best-effort keepalive on unload
  registerKeepalive({
    endpoint: '/api/ui-config',
    buildPayload: () => {
      const currentCfg = getUiConfigState();
      const cardsRect = {};
      for (const c of cards) { if (c?.el) cardsRect[c.key] = toRect(c.el); }
      return {
        ...(currentCfg || {}),
        panel: {
          ...(currentCfg?.panel || {}),
          open: !!panelEl?.classList.contains('open'),
          height: getComputedStyle(document.documentElement).getPropertyValue(cssVarPanel).trim() || (currentCfg?.panel?.height || '28vh')
        },
        layout: {
          ...(currentCfg?.layout || {}),
          cards: { ...(currentCfg?.layout?.cards || {}), ...cardsRect }
        }
      };
    }
  });
}

/**
 * Attach a background image picker that persists to UI config and applies CSS var.
 * @param {{ inputEl: HTMLInputElement }} opts
 */
export function attachBackgroundPicker({ inputEl }) {
  if (!inputEl) return;
  inputEl.onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target.result;
      const cfg = getUiConfigState();
      const payload = { ...(cfg || {}), background: { url: dataUrl } };
      document.documentElement.style.setProperty('--app-bg-url', `url('${dataUrl}')`);
      try { await putUiConfig(payload); } catch (_) {}
    };
    reader.readAsDataURL(file);
  };
}
