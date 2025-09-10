galápagOS Platform Modules

Overview

- Shared UI primitives and persistence used by Seafoam and future apps.
- No app-specific DOM ids; components accept elements/handles via options.

Quick Start

1) HTML structure (no fixed ids required):
   - Panel root with a grabber and optional view-toggle buttons
   - Containers for your sections (grid/list can share an element)

2) App code:

  const panelEl = document.querySelector('[data-panel]') || document.getElementById('library-panel');
  const toggleEl = document.getElementById('saved-view-toggle');

  const browser = createCollectionBrowser({
    panelEl,
    toggleEl,
    getMode: () => localStorage.getItem('myAppViewMode') || 'grid',
    setMode: (m) => localStorage.setItem('myAppViewMode', m),
    sections: [{
      key: 'images',
      gridContainerEl: document.getElementById('saved-images-grid'),
      listContainerEl: document.getElementById('saved-images-grid'), // can be same
      listHeaderHtml: `<div class="list-header">...</div>`,
      getItems: () => myState.images,
      renderGridItem: (img) => `<div class="saved-tile" data-id="${img.id}" data-section="images">...</div>`,
      renderListRow: (img) => `<div class="list-row" data-id="${img.id}" data-section="images">...</div>`,
      onItemClick: (img) => openEditor(img),
      onDelete: async (img) => { await api.delete(img.id); refresh(); }
    }, {
      key: 'texts',
      gridContainerEl: document.getElementById('saved-texts-list'),
      listContainerEl: document.getElementById('saved-texts-list'),
      listHeaderHtml: `<div class="list-header">...</div>`,
      getItems: () => myState.texts,
      renderGridItem: (t) => `<div class="saved-tile" data-id="${t.id}" data-section="texts">...</div>`,
      renderListRow: (t) => `<div class="list-row" data-id="${t.id}" data-section="texts">...</div>`,
      onItemClick: (t) => openTextEditor(t),
      onDelete: async (t) => { await api.deleteText(t.id); refresh(); }
    }],
    // Optional drag overrides; enabled by default
    // drag: {
    //   enable: true,
    //   itemSelector: '.saved-tile, .list-row',
    //   buildPayload: (el)=>({ id: el.dataset.id, type: el.dataset.type || el.dataset.section || 'item' })
    // }
  });
  browser.init();

Components

- Panel: toggle + resizer
  - attachPanelToggle({ panelEl, toggleBtnEl, onToggle })
  - attachPanelResizer({ grabberEl, cssVar = '--panel-height', minVh = 18, maxVh = 60, onResizeEnd })

- Card: drag + resize + commit
  - attachCardBehavior({ cardEl, dragHandleEl = cardEl, resizeHandleEl, onCommit })
  - Emits final rect via onCommit({ x, y, w, h }); uses inline styles for position/size.

- View Mode: grid/list
  - createViewModeController({ getMode, setMode, panelEl, toggleEl, onRender })
  - Applies 'list-view' class to panelEl and toggles active state on buttons with '.toggle-btn' and 'data-mode'.

- Collection Browser: generic library
  - createCollectionBrowser({ panelEl, toggleEl, getMode, setMode, sections: [{ key, gridContainerEl, listContainerEl, getItems, renderGridItem, renderListRow, onItemClick?, onDelete?, addBtnEl?, onAdd? }], drag? })
  - Manages view mode + delegated item click/delete. Also auto-wires delegated drag sources by default so tiles/rows are draggable.
  - Default drag payload: `{ id, type }` where `type` uses `data-type` if present, otherwise `data-section`, falling back to `'item'`.

Utilities

- files.js: readAsBase64(file)
- status.js: pingServer(), setServerStatus(pillEl, isOnline), startStatusPolling({ pillEl, onUpdate, intervalMs })
- utils/format.js: formatFileSize(bytes), formatDate(timestamp)
- api/keepalive.js: registerKeepalive({ endpoint, buildPayload })
- dnd.js: setDragPayload(e, payload), getDropPayload(e), enableDelegatedDrag({ containerEl, itemSelector, buildPayload }), enableDropTarget({ targetEl, onDrop, onEnter?, onLeave?, classOver? })

Persistence

- API: api/uiConfig.js
  - getUiConfig(): Promise<UiConfig>
  - putUiConfig(partial: Partial<UiConfig>): Promise<UiConfig>
  - Endpoint: /api/ui-config (server deep-merges layout.cards)

- State: state/uiState.js
  - getUiConfigState(), setUiConfigState(cfg)
  - subscribe('uiConfig:change', cb)

UiConfig Schema

{
  "panel": { "open": boolean, "height": "28vh" },
  "layout": {
    "cards": {
      "composition": { "x": number, "y": number, "w": number, "h": number },
      "output": { "x": number, "y": number, "w": number, "h": number }
    }
  },
  "view": {
    "imagesMode": "grid"|"list",
    "textsMode": "grid"|"list",
    "imagesSort": { "field": "createdAt"|"name", "dir": "asc"|"desc" },
    "textsSort": { "field": "createdAt"|"name", "dir": "asc"|"desc" }
  },
  "background": { "url": string },
  "version": 1
}

DOM + CSS Guidelines

- Do not hardcode app ids in platform modules; pass elements via options.
- Panels default to CSS var '--panel-height'; apps can override via cssVar.
- Cards use inline styles; apps may mirror to CSS vars for theming/initial render.

Data-Attribute Defaults

- Panel auto attach helper looks for:
  - [data-panel], [data-panel-toggle], [data-panel-grabber]
  - Use autoAttachPanel({ onToggle, cssVar, minVh, maxVh, onResizeEnd }) to wire without ids.


CSS Split

- Platform provides minimal, generic styles for grid/list scaffolding, view toggles, panel grabber, and a `.dragover` helper.
- Keep app-specific theming (e.g., glass backgrounds, brand colors) in your app stylesheet.
 - Tip: Prefer only tokens/structure in platform CSS and do visual theming in your app. If you override, keep selectors compatible (`.saved-grid`, `.saved-tile`, `.list-section`, `.list-row`).

DnD Usage

- Drag sources (auto):
  - The collection browser automatically enables delegated drag on `panelEl` for `.saved-tile, .list-row` and serializes `{ id, type }` using `data-id` and `data-type` when present, else `data-section`.
- Override/disable:
  createCollectionBrowser({
    panelEl, toggleEl, getMode, setMode, sections,
    drag: {
      enable: true,
      itemSelector: '.saved-tile, .list-row',
      buildPayload: (el) => ({ id: el.getAttribute('data-id') || '', type: el.getAttribute('data-section') === 'texts' ? 'text' : 'image' })
    }
  })
- Drop targets:
  enableDropTarget({ targetEl: document.querySelector('.image-slot'), onDrop: (p) => { if (p?.type==='audio') {/* ... */} }})

Local Storage Namespacing

- initPlatformLayout accepts an optional `appId` to namespace localStorage keys (`libraryOpen`, `libraryHeight`, `cardsLayout`) to avoid collisions if multiple apps share the same origin.
- Example:

  initPlatformLayout({ panelEl, toggleBtnEl, cards, appId: 'tunafork' });

Grabber Element

- initPlatformLayout accepts an optional `grabberEl` to target your panel's resize handle.
- If not provided, it looks for `[data-panel-grabber]`, then `#panel-grabber`.

Accessibility

- Collection browser makes items focusable and activatable via Enter/Space by default.
