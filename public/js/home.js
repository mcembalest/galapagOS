import { setServerStatus } from './status.js';
import { attachCardBehavior } from './components/card.js';
import { attachPanelToggle, attachPanelResizer } from './components/panel.js';

// App launcher functionality
const appTiles = document.querySelectorAll('.app-tile[data-url]');
appTiles.forEach(tile => {
  tile.addEventListener('click', () => {
    const url = tile.getAttribute('data-url');
    if (url) window.location.href = url;
  });
});

// Health checking for all apps
const appConfigs = [
  { app: 'woodboard', url: 'http://localhost:3001', statusId: 'woodboard-status' },
  { app: 'seafoam', url: 'http://localhost:3000', statusId: 'seafoam-status' },
  { app: 'tunafork', url: 'http://localhost:3002', statusId: 'tunafork-status' },
  { app: 'campfire', url: 'http://localhost:3003', statusId: 'campfire-status' },
  { app: 'slidedeck', url: 'http://localhost:3004', statusId: 'slidedeck-status' },
  { app: 'logstore', url: 'http://localhost:3005', statusId: 'logstore-status' },
  { app: 'bytestorm', url: 'http://localhost:3006', statusId: 'bytestorm-status' },
  { app: 'cerebella', url: 'http://localhost:3007', statusId: 'cerebella-status' }
];

async function ping(url) {
  try {
    const base = (url || '').replace(/\/$/, '');
    const res = await fetch(base + '/health', { method: 'GET' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

function startAppPolling() {
  appConfigs.forEach(config => {
    const pill = document.getElementById(config.statusId);
    if (pill) {
      const update = async () => {
        const online = await ping(config.url);
        setServerStatus(pill, online);
      };
      update();
      setInterval(update, 10000);
    }
  });
}

// UI Showroom functionality
function initShowroom() {
  // Panel demo
  const panelToggle = document.getElementById('panel-toggle');
  const demoPanel = document.getElementById('demo-panel');
  const panelGrabber = demoPanel.querySelector('.panel-grabber');

  if (panelToggle && demoPanel) {
    attachPanelToggle({
      toggleBtnEl: panelToggle,
      panelEl: demoPanel
    });
  }

  if (panelGrabber && demoPanel) {
    attachPanelResizer({
      grabberEl: panelGrabber,
      cssVar: '--panel-height',
      minVh: 18,
      maxVh: 60
    });
  }

  // Card demo
  const demoCard = document.querySelector('.demo-card');
  if (demoCard) {
    const dragHandle = demoCard.querySelector('.card-drag-handle');
    const resizeHandle = demoCard.querySelector('.card-resize-handle');

    attachCardBehavior({
      cardEl: demoCard,
      dragHandleEl: dragHandle,
      resizeHandleEl: resizeHandle,
      onCommit: (rect) => {
        console.log('Card moved/resized:', rect);
      }
    });
  }

  // Collection browser demo
  const viewToggleBtns = document.querySelectorAll('.view-toggle .toggle-btn');
  const demoCollection = document.querySelector('.demo-collection');

  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');

      // Update active state
      viewToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Update collection view
      if (mode === 'list') {
        demoCollection.classList.add('list-view');
      } else {
        demoCollection.classList.remove('list-view');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  startAppPolling();
  initShowroom();
});
