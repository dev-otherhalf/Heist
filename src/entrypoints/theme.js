import { initLenis } from "../scripts/lenis";
import { initViewportVideoAutoplay } from "../scripts/viewport-video-autoplay";

document.addEventListener("DOMContentLoaded", () => {
  initLenis();
  initViewportVideoAutoplay();
});

import "../scripts/heist-header";
