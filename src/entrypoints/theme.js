import { initLenis } from "../scripts/lenis";
import { initViewportVideoAutoplay } from "../scripts/viewport-video-autoplay";
import { initCartDrawerScrollLock } from "../scripts/cart-drawer-scroll-lock";
import { initSiteLock } from "../scripts/site-lock";

document.addEventListener("DOMContentLoaded", () => {
  initLenis();
  initViewportVideoAutoplay();
  initCartDrawerScrollLock();
  initSiteLock();
});

import "../scripts/heist-header";
