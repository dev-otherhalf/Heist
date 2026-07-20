import { initLenis } from "../scripts/lenis";
import { initViewportVideoAutoplay } from "../scripts/viewport-video-autoplay";
import { initCartDrawerScrollLock } from "../scripts/cart-drawer-scroll-lock";

document.addEventListener("DOMContentLoaded", () => {
  initLenis();
  initViewportVideoAutoplay();
  initCartDrawerScrollLock();
});

import "../scripts/heist-header";
