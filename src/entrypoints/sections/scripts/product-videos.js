
import Swiper from "swiper";
import "swiper/css";

function initProductVideos(root) {
  if (!root || root.dataset.productVideosSwiperReady === "true") return;

  const container = root.querySelector("[data-product-videos-swiper]");
  if (!container) return;

  root.dataset.productVideosSwiperReady = "true";

  root.productVideosSwiperInstance = new Swiper(container, {
    slidesPerView: 2.4964,
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
        slidesPerView: 3,
        spaceBetween: 12,
      },
      990: {
        slidesPerView: 4,
        spaceBetween: 12,
      },
    },
  });
}

function destroyProductVideos(root) {
  root.productVideosSwiperInstance?.destroy(true, true);
  delete root.productVideosSwiperInstance;
  root.dataset.productVideosSwiperReady = "false";
}

function initAll(scope = document) {
  scope.querySelectorAll("[data-product-videos]").forEach((root) => {
    initProductVideos(root);
  });
}

document.addEventListener("DOMContentLoaded", () => initAll());

document.addEventListener("shopify:section:load", (event) => {
  initAll(event.target);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-product-videos]").forEach((root) => {
    destroyProductVideos(root);
  });
});
