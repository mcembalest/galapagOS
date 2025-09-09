// galapagOS Card component: draggable + resizable card with commit callback

/**
 * Attach drag/resize behavior to a card element.
 * Calls onCommit(rect) at the end of drag or resize with {x,y,w,h}.
 */
export function attachCardBehavior({ cardEl, dragHandleEl, resizeHandleEl, onCommit }) {
  if (!cardEl) return;
  const handle = dragHandleEl || cardEl;

  // Dragging
  let dragging = false; let startX = 0; let startY = 0; let baseLeft = 0; let baseTop = 0;
  const onMove = (e) => {
    if (!dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = x - startX; const dy = y - startY;
    const newLeft = baseLeft + dx; const newTop = baseTop + dy;
    cardEl.style.left = newLeft + 'px';
    cardEl.style.top = newTop + 'px';
  };
  const onEnd = () => {
    if (!dragging) return; dragging = false;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onEnd);
    document.removeEventListener('touchend', onEnd);
    if (typeof onCommit === 'function') onCommit(toRect(cardEl));
  };
  const onStart = (e) => {
    if ((e.button && e.button !== 0)) return;
    if (resizeHandleEl && (e.target === resizeHandleEl || resizeHandleEl.contains(e.target))) return;
    dragging = true;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    const computed = getComputedStyle(cardEl);
    baseLeft = parseInt(computed.left || '0');
    baseTop = parseInt(computed.top || '0');
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
  };
  handle.addEventListener('mousedown', onStart);
  handle.addEventListener('touchstart', onStart, { passive: true });

  // Resizing
  if (resizeHandleEl) {
    let resizing = false; let startRX = 0; let startRY = 0; let baseW = 0; let baseH = 0;
    const onRMove = (e) => {
      if (!resizing) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      const y = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = x - startRX; const dy = y - startRY;
      const newWidth = Math.max(320, baseW + dx);
      const newHeight = Math.max(240, baseH + dy);
      cardEl.style.width = newWidth + 'px';
      cardEl.style.height = newHeight + 'px';
    };
    const onREnd = () => {
      if (!resizing) return; resizing = false;
      document.removeEventListener('mousemove', onRMove);
      document.removeEventListener('touchmove', onRMove);
      document.removeEventListener('mouseup', onREnd);
      document.removeEventListener('touchend', onREnd);
      if (typeof onCommit === 'function') onCommit(toRect(cardEl));
    };
    const onRStart = (e) => {
      e.stopPropagation();
      resizing = true;
      startRX = e.touches ? e.touches[0].clientX : e.clientX;
      startRY = e.touches ? e.touches[0].clientY : e.clientY;
      baseW = parseInt(cardEl.style.width || cardEl.offsetWidth);
      baseH = parseInt(cardEl.style.height || cardEl.offsetHeight);
      document.addEventListener('mousemove', onRMove);
      document.addEventListener('touchmove', onRMove, { passive: false });
      document.addEventListener('mouseup', onREnd);
      document.addEventListener('touchend', onREnd);
    };
    resizeHandleEl.addEventListener('mousedown', onRStart);
    resizeHandleEl.addEventListener('touchstart', onRStart, { passive: true });
  }
}

export function toRect(el) {
  return {
    x: parseInt(el.style.left || '0'),
    y: parseInt(el.style.top || '0'),
    w: parseInt(el.style.width || el.offsetWidth),
    h: parseInt(el.style.height || el.offsetHeight)
  };
}

