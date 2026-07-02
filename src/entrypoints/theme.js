import { initLenis } from "../scripts/lenis";

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initLenis, { once: true });
} else {
  initLenis();
}
import "../scripts/heist-header";