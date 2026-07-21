// =============================================================================
// Trackpad guard for horizontal Swipers.
//
// Swiper's mousewheel module (forceToAxis) preventDefaults horizontal-dominant
// wheel events, but Lenis listens on `window` and ignores preventDefault — so a
// two-finger sideways swipe over a carousel scrolled the carousel AND crept the
// page down (trackpads always leak some deltaY into a horizontal gesture).
//
// Lenis skips any event flagged `lenisStopPropagation` (its own escape hatch),
// so we flag horizontal-dominant wheel events over a horizontal Swiper in the
// capture phase — before Lenis' window listener runs. Vertical scrolling over
// the carousel still reaches the page untouched.
// =============================================================================

const selectors = new Set();
let installed = false;

/**
 * Install the guard once. Safe to call from every carousel that needs it.
 *
 * @param {string} selector - CSS selector matching the Swiper root elements.
 */
export function guardSwiperWheel(selector) {
  selectors.add(selector);
  if (installed) return;
  installed = true;

  window.addEventListener(
    "wheel",
    (event) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      for (const sel of selectors) {
        if (target.closest(sel)) {
          event.lenisStopPropagation = true;
          return;
        }
      }
    },
    { capture: true, passive: true },
  );
}
