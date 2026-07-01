import Lenis from "lenis";
import "lenis/dist/lenis.css";

export function initLenis() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const wrapper = document.querySelector(".page-wrapper");
  const lenis = new Lenis({
    wrapper: wrapper ?? window,
    content: wrapper ?? document.documentElement,
    autoRaf: true,
    autoToggle: true,
    allowNestedScroll: true,
    anchors: true,
    duration: 1.1,
    naiveDimensions: true,
    smoothWheel: true,
    stopInertiaOnNavigate: true,
    smoothTouch: false,
  });

  window.lenis = lenis;
}
