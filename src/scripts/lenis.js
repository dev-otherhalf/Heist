import Lenis from "lenis";
import "lenis/dist/lenis.css";

let lenisInstance = null;
let breakpointListenerAdded = false;

const desktopMediaQuery = window.matchMedia("(min-width: 990px)");
const reducedMotionQuery = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
);

function createLenis() {
  const pageWrapper = document.querySelector(".page-wrapper");
  const isDesktop = desktopMediaQuery.matches;

  /*
   * Desktop:
   * The Shopify theme uses .page-wrapper as the scroll container.
   *
   * Mobile/tablet:
   * Use the browser window so responsive wrapper styles do not lock scrolling.
   */
  const usePageWrapper = isDesktop && pageWrapper;

  lenisInstance = new Lenis({
    wrapper: usePageWrapper ? pageWrapper : window,

    content: usePageWrapper
      ? pageWrapper.querySelector("[data-lenis-content]") || pageWrapper
      : document.documentElement,

    // Listen globally so mouse-wheel and trackpad events are captured.
    eventsTarget: window,

    autoRaf: true,
    autoResize: true,
    autoToggle: false,

    smoothWheel: true,

    // Lower value = smoother and slower.
    // Recommended range: 0.07–0.12.
    lerp: 0.065,

    wheelMultiplier: 1,
    touchMultiplier: 1,

    // Keep normal native touch scrolling.
    syncTouch: false,

    anchors: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,

    // Retain the dimension behaviour that worked on your desktop wrapper.
    naiveDimensions: Boolean(usePageWrapper),
  });

  window.lenis = lenisInstance;

  requestAnimationFrame(() => {
    lenisInstance?.resize();
  });
}

function reinitializeLenis() {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }

  window.lenis = null;

  if (reducedMotionQuery.matches) {
    return;
  }

  createLenis();
}

export function initLenis() {
  if (typeof window === "undefined") {
    return null;
  }

  reinitializeLenis();

  /*
   * Reinitialize only when crossing the 990px breakpoint.
   * This ensures the correct scroll container is used.
   */
  if (!breakpointListenerAdded) {
    desktopMediaQuery.addEventListener("change", reinitializeLenis);
    reducedMotionQuery.addEventListener("change", reinitializeLenis);

    breakpointListenerAdded = true;
  }

  return lenisInstance;
}

export function destroyLenis() {
  if (lenisInstance) {
    lenisInstance.destroy();
    lenisInstance = null;
  }

  window.lenis = null;
}
