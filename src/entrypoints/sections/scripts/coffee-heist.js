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
import { guardSwiperWheel } from "../../../scripts/swiper-wheel-guard";

function initTabs(root) {
  if (root.dataset.coffeeHeistTabsReady === "true") return;
  root.dataset.coffeeHeistTabsReady = "true";

  const tabButtons = [...root.querySelectorAll("[data-tab-button]")];
  const panels = [...root.querySelectorAll("[data-tab-panel]")];
  const backgrounds = [...root.querySelectorAll("[data-tab-bg]")];
  const subheadings = [...root.querySelectorAll("[data-tab-subheading]")];

  root.dataset.activeTab = "0";

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab-button]");
    if (!button) return;

    const index = tabButtons.indexOf(button);
    if (index === -1) return;

    tabButtons.forEach((tabButton, i) => {
      tabButton.setAttribute("aria-selected", String(i === index));
    });
    root.dataset.activeTab = String(index);
    panels.forEach((panel, i) => panel.toggleAttribute("hidden", i !== index));
    backgrounds.forEach((bg, i) =>
      bg.classList.toggle("is-active", i === index),
    );
    subheadings.forEach((subheading) => {
      subheading.toggleAttribute(
        "hidden",
        Number(subheading.dataset.tabIndex) !== index,
      );
    });
  });
}

function initReceipts(root) {
  if (root.dataset.coffeeHeistReceiptsReady === "true") return;
  root.dataset.coffeeHeistReceiptsReady = "true";

  const swiperEl = root.querySelector("[data-receipts-swiper]");

  if (swiperEl) {
    // Keep a sideways trackpad swipe from also creeping the page down.
    guardSwiperWheel("[data-receipts-swiper]");

    new Swiper(swiperEl, {
      modules: [FreeMode, Mousewheel],
      slidesPerView: "auto",
      spaceBetween: 16,
      freeMode: false,
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
document.addEventListener("shopify:section:load", (event) =>
  initCoffeeHeist(event.target),
);

class CoffeeHeistAnimation {
  constructor() {
    this.sections = document.querySelectorAll(".coffee-heist");

    if (!this.sections.length) return;

    this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
      threshold: 0.3,
    });

    this.sections.forEach((section) => {
      this.prepare(section);
      this.observer.observe(section);
    });
  }

  prepare(section) {
    const fills = section.querySelectorAll(".coffee-heist__bar-fill");
    const scores = section.querySelectorAll(".coffee-heist__bar-score");

    fills.forEach((fill) => {
      const targetWidth =
        fill.style.width || window.getComputedStyle(fill).width;

      fill.dataset.targetWidth = targetWidth;
      fill.style.width = "0%";
    });

    scores.forEach((score) => {
      const targetLeft =
        score.style.left || window.getComputedStyle(score).left;
      const targetValue = parseFloat(score.textContent) || 0;

      score.dataset.targetLeft = targetLeft;
      score.dataset.targetValue = targetValue;

      score.style.left = "0%";
      score.textContent = "0";
    });
  }

  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const section = entry.target;

      this.animate(section);

      this.observer.unobserve(section);
    });
  }

  animate(section) {
    const fills = section.querySelectorAll(".coffee-heist__bar-fill");
    const scores = section.querySelectorAll(".coffee-heist__bar-score");

    fills.forEach((fill) => {
      fill.animate([{ width: "0%" }, { width: fill.dataset.targetWidth }], {
        duration: 1600,
        easing: "ease-out",
        fill: "forwards",
      });
    });

    scores.forEach((score) => {
      const target = parseFloat(score.dataset.targetValue);

      score.animate([{ left: "0%" }, { left: score.dataset.targetLeft }], {
        duration: 1600,
        easing: "ease-out",
        fill: "forwards",
      });

      const start = performance.now();
      const duration = 1600;

      const update = (time) => {
        const progress = Math.min((time - start) / duration, 1);
        const value = Math.round(target * progress);

        score.textContent = value;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          score.textContent = target;
        }
      };

      requestAnimationFrame(update);
    });
  }
}

new CoffeeHeistAnimation();
