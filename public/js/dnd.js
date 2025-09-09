// galapagOS DnD helpers: reusable drag sources and drop targets

/**
 * Set a JSON payload on a drag event's dataTransfer.
 * @param {DragEvent} e
 * @param {any} payload
 */
export function setDragPayload(e, payload) {
  try { e.dataTransfer?.setData('text/plain', JSON.stringify(payload)); } catch (_) {}
}

/**
 * Read a JSON payload from a drop event's dataTransfer.
 * @param {DragEvent} e
 * @returns {any|null}
 */
export function getDropPayload(e) {
  try { return JSON.parse(e.dataTransfer?.getData('text/plain') || 'null'); } catch (_) { return null; }
}

/**
 * Enable delegated drag on a container.
 * @param {{containerEl:HTMLElement, itemSelector:string, buildPayload:(el:HTMLElement)=>any}} opts
 */
export function enableDelegatedDrag({ containerEl, itemSelector, buildPayload }) {
  if (!containerEl || !itemSelector || typeof buildPayload !== 'function') return;
  containerEl.addEventListener('dragstart', (e) => {
    const el = e.target?.closest(itemSelector);
    if (!el || !containerEl.contains(el)) return;
    try { if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
    const payload = buildPayload(el);
    setDragPayload(e, payload);
  });
}

/**
 * Enable a drop target.
 * @param {{ targetEl:HTMLElement, onDrop:(payload:any, e:DragEvent)=>void, onEnter?:(e:DragEvent)=>void, onLeave?:(e:DragEvent)=>void, classOver?:string }} opts
 */
export function enableDropTarget({ targetEl, onDrop, onEnter, onLeave, classOver = 'dragover' }) {
  if (!targetEl || typeof onDrop !== 'function') return;
  let overDepth = 0;
  const onOver = (e) => {
    e.preventDefault();
    try { if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; } catch (_) {}
    if (overDepth === 0 && classOver) targetEl.classList.add(classOver);
    overDepth++;
    if (onEnter) onEnter(e);
  };
  const onLeaveEv = (e) => {
    overDepth = Math.max(0, overDepth - 1);
    if (overDepth === 0 && classOver) targetEl.classList.remove(classOver);
    if (onLeave) onLeave(e);
  };
  const onDropEv = (e) => {
    e.preventDefault();
    overDepth = 0;
    if (classOver) targetEl.classList.remove(classOver);
    const payload = getDropPayload(e);
    onDrop(payload, e);
  };
  targetEl.addEventListener('dragover', onOver);
  targetEl.addEventListener('dragenter', onOver);
  targetEl.addEventListener('dragleave', onLeaveEv);
  targetEl.addEventListener('drop', onDropEv);
}
