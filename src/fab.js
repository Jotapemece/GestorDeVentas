/* ========== FAB DRAG ========== */
(function initFab() {
  var fab = qs(SEL.chatFab);
  if (!fab) return;
  fab.style.left = (window.innerWidth - 72) + 'px';
  fab.style.top = (window.innerHeight - 152) + 'px';

  var fabDragActive = false, fabTouchDrag = false;
  var fabStartX, fabStartY, fabOrigLeft, fabOrigTop, fabDragTimer;

  function fabStart(e, isTouch) {
    var t = isTouch ? e.touches[0] : e;
    fabDragActive = false;
    fabTouchDrag = false;
    fabStartX = t.clientX;
    fabStartY = t.clientY;
    fabOrigLeft = parseInt(fab.style.left) || 0;
    fabOrigTop = parseInt(fab.style.top) || 0;
    clearTimeout(fabDragTimer);
    fabDragTimer = setTimeout(function() {
      fabDragActive = true;
      fab.classList.add('dragging');
    }, TIMING.FAB_DRAG_START_MS);
  }

  function fabMove(e, isTouch) {
    if (fabStartX === undefined) return;
    var t = isTouch ? e.touches[0] : e;
    var dx = t.clientX - fabStartX;
    var dy = t.clientY - fabStartY;
    if (!fabDragActive && Math.abs(dx) < TIMING.FAB_DRAG_THRESHOLD && Math.abs(dy) < TIMING.FAB_DRAG_THRESHOLD) return;
    if (!fabDragActive) {
      fabDragActive = true;
      fab.classList.add('dragging');
      clearTimeout(fabDragTimer);
    }
    e.preventDefault();
    var bottomMargin = 100;
    fab.style.left = Math.max(4, Math.min(window.innerWidth - 56, fabOrigLeft + dx)) + 'px';
    fab.style.top = Math.max(4, Math.min(window.innerHeight - 52 - bottomMargin, fabOrigTop + dy)) + 'px';
  }

  function fabEnd(isTouch) {
    clearTimeout(fabDragTimer);
    fabDragTimer = null;
    if (fabDragActive) {
      fab.classList.remove('dragging');
      if (isTouch) {
        fabTouchDrag = true;
        setTimeout(function() { fabTouchDrag = false; }, TIMING.FAB_TOUCH_RESET_MS);
      }
    }
    fabStartX = fabStartY = undefined;
  }

  fab.addEventListener('mousedown', function(e) {
    if (fabTouchDrag) return;
    fabStart(e, false);
  });
  document.addEventListener('mousemove', function(e) { fabMove(e, false); });
  document.addEventListener('mouseup', function() { fabEnd(false); });
  fab.addEventListener('touchstart', function(e) { fabStart(e, true); }, { passive: true });
  document.addEventListener('touchmove', function(e) { fabMove(e, true); }, { passive: false });
  document.addEventListener('touchend', function() { fabEnd(true); });

  fab.addEventListener('click', function() {
    if (fabDragActive || fabTouchDrag) { fabDragActive = false; fabTouchDrag = false; return; }
    toggleChat();
  });
})();
