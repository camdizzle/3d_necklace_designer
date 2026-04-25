const NON_UNDOABLE = new Set([
  'backgroundColor', 'showDimensions', 'autoRotate', 'hideChain', 'exportFormat'
]);

const MAX_HISTORY = 50;

export function createUndoRedo() {
  const history = [];
  let pointer = -1;
  let onChange = null;

  function snapshot(state) {
    const copy = {};
    for (const [k, v] of Object.entries(state)) {
      if (v === null || typeof v !== 'object') {
        copy[k] = v;
      }
    }
    return copy;
  }

  function pushState(state, changedKey) {
    if (changedKey && NON_UNDOABLE.has(changedKey)) return;

    const snap = snapshot(state);

    if (pointer >= 0) {
      const prev = history[pointer];
      if (JSON.stringify(prev) === JSON.stringify(snap)) return;
    }

    history.splice(pointer + 1);
    history.push(snap);
    if (history.length > MAX_HISTORY) history.shift();
    pointer = history.length - 1;
    updateButtons();
  }

  function undo(currentState) {
    if (pointer <= 0) return null;
    pointer--;
    const snap = history[pointer];
    updateButtons();
    return snap;
  }

  function redo(currentState) {
    if (pointer >= history.length - 1) return null;
    pointer++;
    const snap = history[pointer];
    updateButtons();
    return snap;
  }

  function canUndo() { return pointer > 0; }
  function canRedo() { return pointer < history.length - 1; }

  function updateButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = !canUndo();
    if (redoBtn) redoBtn.disabled = !canRedo();
  }

  return { pushState, undo, redo, canUndo, canRedo, updateButtons };
}
