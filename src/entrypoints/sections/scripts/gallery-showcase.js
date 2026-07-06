import Swiper from "swiper";
import "swiper/css";

function initGalleryShowcase(root) {
  if (!root || root.dataset.gallerySwiperReady === "true") return;

  const container = root.querySelector("[data-gallery-swiper]");
  if (!container) return;

  root.dataset.gallerySwiperReady = "true";

  root.gallerySwiperInstance = new Swiper(container, {
    slidesPerView: 1.46999,
    spaceBetween: 12,
    grabCursor: true,
    watchOverflow: true,
    mousewheel: {
      enabled: true,
      forceToAxis: true,
      sensitivity: 1,
      releaseOnEdges: true,
    },
    breakpoints: {
      750: {
        slidesPerView: 3.46999,
        spaceBetween: 12,
      },
      990: {
        slidesPerView: 4.16667,
        spaceBetween: 16,
      },
    },
  });
}

function destroyGalleryShowcase(root) {
  root.gallerySwiperInstance?.destroy(true, true);
  delete root.gallerySwiperInstance;
  root.dataset.gallerySwiperReady = "false";
}

function initAll(scope = document) {
  scope.querySelectorAll("[data-gallery-showcase]").forEach((root) => {
    initGalleryShowcase(root);
  });
}

document.addEventListener("DOMContentLoaded", () => initAll());

document.addEventListener("shopify:section:load", (event) => {
  initAll(event.target);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-gallery-showcase]").forEach((root) => {
    destroyGalleryShowcase(root);
  });
});
