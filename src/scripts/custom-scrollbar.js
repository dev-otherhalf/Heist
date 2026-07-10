// =============================================================================
// Custom scrollbar.
// Drives an overlay track + thumb for a scroll container whose native scrollbar
// is hidden in CSS. The track is toggled with `is-active` only while there is
// something to scroll, so it never shows on short content. Extracted from the
// brewing guide so the cart drawer can reuse the same behaviour and styling.
//
// The caller owns the markup and the class names; this only wires behaviour.
// =============================================================================

/**
 * @param {object} options
 * @param {HTMLElement} options.scroller - The element with `overflow-y: auto`.
 * @param {HTMLElement} options.track - Overlay track, positioned over the scroller.
 * @param {HTMLElement} options.thumb - Draggable thumb inside the track.
 * @param {number} [options.minThumbSize] - Floor for the thumb height, in px.
 * @returns {() => void} Teardown — removes every listener and observer.
 */
export function initCustomScrollbar({
  scroller,
  track,
  thumb,
  minThumbSize = 24,
}) {
  function update() {
    const { scrollHeight, clientHeight, scrollTop } = scroller;
    const scrollable = scrollHeight - clientHeight;

    // Sub-pixel rounding leaves a scrollable of ~1px on content that fits.
    if (scrollable <= 1) {
      track.classList.remove("is-active");
      return;
    }

    track.classList.add("is-active");
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.max(
      (clientHeight / scrollHeight) * trackHeight,
      minThumbSize,
    );
    const maxThumbTop = trackHeight - thumbHeight;
    const top = maxThumbTop > 0 ? (scrollTop / scrollable) * maxThumbTop : 0;

    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${top}px)`;
  }

  scroller.addEventListener("scroll", update, { passive: true });

  const resizeObserver =
    typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
  resizeObserver?.observe(scroller);

  let dragStartY = 0;
  let dragStartScroll = 0;

  function onPointerMove(event) {
    const scrollable = scroller.scrollHeight - scroller.clientHeight;
    const maxThumbTop = track.clientHeight - thumb.offsetHeight;
    if (maxThumbTop <= 0) return;

    const delta = ((event.clientY - dragStartY) / maxThumbTop) * scrollable;
    scroller.scrollTop = dragStartScroll + delta;
  }

  function onPointerUp() {
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    thumb.classList.remove("is-dragging");
  }

  function onThumbPointerDown(event) {
    event.preventDefault();
    dragStartY = event.clientY;
    dragStartScroll = scroller.scrollTop;
    thumb.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  // Clicking the track jumps the thumb to that position, centred on the cursor.
  function onTrackPointerDown(event) {
    if (event.target === thumb) return;

    const scrollable = scroller.scrollHeight - scroller.clientHeight;
    const maxThumbTop = track.clientHeight - thumb.offsetHeight;
    if (maxThumbTop <= 0) return;

    const clickY = event.clientY - track.getBoundingClientRect().top;
    const targetTop = Math.max(
      0,
      Math.min(clickY - thumb.offsetHeight / 2, maxThumbTop),
    );
    scroller.scrollTop = (targetTop / maxThumbTop) * scrollable;
  }

  thumb.addEventListener("pointerdown", onThumbPointerDown);
  track.addEventListener("pointerdown", onTrackPointerDown);

  update();

  return () => {
    scroller.removeEventListener("scroll", update);
    resizeObserver?.disconnect();
    thumb.removeEventListener("pointerdown", onThumbPointerDown);
    track.removeEventListener("pointerdown", onTrackPointerDown);
    onPointerUp();
  };
}
