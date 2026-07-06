// =============================================================================
// Coffee Heist comparison section — tab switching + background crossfade,
// and the receipts Swiper carousel (with per-video sound toggle).
// Vanilla, data-attribute driven — mirrors footer.js. Swiper is bundled by
// Vite; its structural CSS lives in coffee-heist.scss (self-contained).
//
// Brewing-guide behavior was removed for now (see sections/coffee-heist.liquid);
// re-add here alongside its metaobject setting when that block comes back.
// =============================================================================

import Swiper from "swiper";
import { FreeMode, Mousewheel } from "swiper/modules";

function initTabs(root) {
  if (root.dataset.coffeeHeistTabsReady === "true") return;
  root.dataset.coffeeHeistTabsReady = "true";

  const tabButtons = [...root.querySelectorAll("[data-tab-button]")];
  const panels = [...root.querySelectorAll("[data-tab-panel]")];
  const backgrounds = [...root.querySelectorAll("[data-tab-bg]")];
  const subheadings = [...root.querySelectorAll("[data-tab-subheading]")];

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab-button]");
    if (!button) return;

    const index = tabButtons.indexOf(button);
    if (index === -1) return;

    tabButtons.forEach((tabButton, i) => {
      tabButton.setAttribute("aria-selected", String(i === index));
    });
    panels.forEach((panel, i) => panel.toggleAttribute("hidden", i !== index));
    backgrounds.forEach((bg, i) => bg.classList.toggle("is-active", i === index));
    subheadings.forEach((subheading) => {
      subheading.toggleAttribute("hidden", Number(subheading.dataset.tabIndex) !== index);
    });
  });
}

function initReceipts(root) {
  if (root.dataset.coffeeHeistReceiptsReady === "true") return;
  root.dataset.coffeeHeistReceiptsReady = "true";

  const swiperEl = root.querySelector("[data-receipts-swiper]");

  if (swiperEl) {
    new Swiper(swiperEl, {
      modules: [FreeMode, Mousewheel],
      slidesPerView: "auto",
      spaceBetween: 16,
      freeMode: true,
      grabCursor: true,
      mousewheel: { forceToAxis: true },
    });
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sound-toggle]");
    if (!button) return;

    const video = button.parentElement?.querySelector("video");
    if (!(video instanceof HTMLVideoElement)) return;

    video.muted = !video.muted;
    button.classList.toggle("is-unmuted", !video.muted);
    button.setAttribute("aria-pressed", String(!video.muted));
  });
}

function initCoffeeHeist(scope = document) {
  scope.querySelectorAll("[data-coffee-heist-tabs]").forEach(initTabs);
  scope.querySelectorAll("[data-coffee-heist-receipts]").forEach(initReceipts);
}

document.addEventListener("DOMContentLoaded", () => initCoffeeHeist());
document.addEventListener("shopify:section:load", (event) => initCoffeeHeist(event.target));
