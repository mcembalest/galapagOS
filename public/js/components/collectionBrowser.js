// galapagOS Collection Browser: generic library panel for items

import { createViewModeController } from '../viewMode.js';
import { enableDelegatedDrag } from '../dnd.js';

/**
 * Create a generic collection browser for multiple item sections (e.g., images, texts).
 * The app supplies item providers and renderers; the component manages view mode and wiring.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.panelEl - Root panel element (applies 'list-view' class)
 * @param {HTMLElement} opts.toggleEl - View mode buttons container ('.toggle-btn' with data-mode)
 * @param {Function} opts.getMode - returns 'grid' | 'list'
 * @param {Function} opts.setMode - persists mode
 * @param {Array} opts.sections - array of section configs:
 *    { key, gridContainerEl, listContainerEl, getItems:()=>Promise<Array>|Array,
 *      renderGridItem:(item)=>string, renderListRow:(item)=>string,
 *      onItemClick?:(item, el)=>void, onDelete?:(item)=>Promise|void, addBtnEl?, onAdd? }.
 * @param {Object} [opts.drag]
 * @param {boolean} [opts.drag.enable=true] - auto-enable delegated DnD on panel
 * @param {string} [opts.drag.itemSelector='.saved-tile, .list-row'] - elements considered draggable
 * @param {(el:HTMLElement)=>any} [opts.drag.buildPayload] - builds drag payload; defaults to {id, type} using data attributes
 * @returns {{ init:Function, render:Function }}
 */
export function createCollectionBrowser({ panelEl, toggleEl, getMode, setMode, sections, drag }) {
  if (!panelEl) throw new Error('panelEl is required');
  if (!Array.isArray(sections)) throw new Error('sections must be an array');

  const render = async (mode) => {
    const currentMode = mode || getMode();
    for (const s of sections) {
      const items = await (typeof s.getItems === 'function' ? s.getItems() : []);
      const sameEl = s.gridContainerEl && s.listContainerEl && s.gridContainerEl === s.listContainerEl;
      if (currentMode === 'grid') {
        if (s.gridContainerEl) {
          // Ensure grid container uses platform grid layout
          s.gridContainerEl.classList.add('saved-grid');
          const grid = items.map(it => s.renderGridItem(it)).join('');
          const extras = typeof s.renderGridExtras === 'function' ? s.renderGridExtras() : '';
          s.gridContainerEl.innerHTML = grid + (extras || '');
        }
        // If grid and list share the same element, don't strip the grid class
        if (s.listContainerEl && !sameEl) {
          // Clear list container when switching to grid and ensure it isn't styled as grid
          s.listContainerEl.innerHTML = '';
          s.listContainerEl.classList.remove('saved-grid');
        }
      } else { // list
        if (s.listContainerEl) {
          // Ensure list container is not a grid; rows should span full width
          s.listContainerEl.classList.remove('saved-grid');
          const header = s.listHeaderHtml || '';
          const rows = items.map(it => s.renderListRow(it)).join('');
          s.listContainerEl.innerHTML = `
            <div class="list-section">
              ${header}
              <div class="list-rows">
                ${rows}
              </div>
            </div>`;
        }
        if (s.gridContainerEl) {
          if (!sameEl) s.gridContainerEl.innerHTML = '';
          s.gridContainerEl.classList.remove('saved-grid');
        }
      }
      // Wire item click handlers (delegated)
      const root = currentMode === 'grid' ? s.gridContainerEl : s.listContainerEl;
      if (root && typeof s.onItemClick === 'function') {
        // Clear old listener
        if (root.__onClick) root.removeEventListener('click', root.__onClick);
        const handler = (e) => {
          const el = e.target.closest('[data-id]');
          if (!el || !root.contains(el)) return;
          if (e.target.closest('.icon-btn') || e.target.closest('.delete-btn')) return;
          const id = el.getAttribute('data-id');
          const sectionKey = el.getAttribute('data-section') || s.key;
          const item = items.find(x => (x.id === id));
          if (item) s.onItemClick(item, el, sectionKey);
        };
        root.addEventListener('click', handler);
        root.__onClick = handler;
        // Accessibility: make rows/tiles focusable and activatable by keyboard
        root.querySelectorAll('[data-id]').forEach(el => { try { el.setAttribute('tabindex', '0'); } catch(_) {} });
        if (root.__onKey) root.removeEventListener('keydown', root.__onKey);
        const onKey = (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          const el = e.target.closest('[data-id]');
          if (!el || !root.contains(el)) return;
          if (e.target.closest('.icon-btn') || e.target.closest('.delete-btn')) return;
          const id = el.getAttribute('data-id');
          const sectionKey = el.getAttribute('data-section') || s.key;
          const item = items.find(x => (x.id === id));
          if (item) { e.preventDefault(); s.onItemClick(item, el, sectionKey); }
        };
        root.addEventListener('keydown', onKey);
        root.__onKey = onKey;
      }
      // Wire grid extras (add tiles) to onAdd
      if (root && typeof s.onAdd === 'function') {
        if (root.__onAdd) root.removeEventListener('click', root.__onAdd);
        const onAdd = (e) => {
          const addEl = e.target.closest('[data-action]');
          if (!addEl || !root.contains(addEl)) return;
          const action = addEl.getAttribute('data-action');
          if (!action) return;
          // Prevent item click handler
          e.stopPropagation();
          s.onAdd();
        };
        root.addEventListener('click', onAdd);
        root.__onAdd = onAdd;
      }
      // Wire delegated delete
      if ((s.gridContainerEl || s.listContainerEl) && typeof s.onDelete === 'function') {
        const rootDel = s.gridContainerEl || s.listContainerEl;
        if (rootDel.__onDel) rootDel.removeEventListener('click', rootDel.__onDel);
        const onDel = async (e) => {
          const btn = e.target.closest('.delete-btn');
          if (!btn || !rootDel.contains(btn)) return;
          const id = btn.getAttribute('data-id');
          const item = items.find(x => x.id === id);
          if (!item) return;
          const name = item.name || 'this item';
          const ok = confirm(`Delete "${name}"? This cannot be undone.`);
          if (!ok) return;
          await s.onDelete(item);
          await render(currentMode);
        };
        rootDel.addEventListener('click', onDel);
        rootDel.__onDel = onDel;
      }
      // Wire add button
      if (s.addBtnEl && typeof s.onAdd === 'function') {
        s.addBtnEl.onclick = s.onAdd;
      }
    }
  };

  const controller = createViewModeController({
    getMode,
    setMode: (m) => { setMode(m); },
    panelEl,
    toggleEl,
    onRender: (m) => render(m)
  });

  const init = () => {
    // Auto-wire delegated DnD for items using data attributes
    const dragCfg = {
      enable: true,
      itemSelector: '.saved-tile, .list-row',
      buildPayload: (el) => {
        // Prefer explicit data-type, then fall back to data-section, else generic
        const explicitType = el.getAttribute('data-type');
        const section = el.getAttribute('data-section');
        const type = (explicitType && explicitType.trim()) || (section && section.trim()) || 'item';
        return { id: el.getAttribute('data-id') || '', type };
      },
      ...(drag || {})
    };
    if (dragCfg.enable && panelEl) {
      enableDelegatedDrag({ containerEl: panelEl, itemSelector: dragCfg.itemSelector, buildPayload: dragCfg.buildPayload });
    }
    controller.init();
  };
  return { init, render };
}
