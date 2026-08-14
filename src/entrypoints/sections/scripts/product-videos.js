import Swiper from "swiper";
import "swiper/css";
import {
  lockPageScroll,
  unlockPageScroll,
} from "../../../scripts/page-scroll-lock";

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

  const dialog = root.querySelector("[data-product-video-lightbox]");
  const lightboxVideo = dialog?.querySelector(
    "[data-product-video-lightbox-media]",
  );
  if (!dialog || !lightboxVideo) return;

  const controller = new AbortController();
  const { signal } = controller;
  root.productVideosAbortController = controller;

  const clearLightbox = () => {
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("poster");
    lightboxVideo.replaceChildren();
    lightboxVideo.load();
    unlockPageScroll();
  };

  const closeLightbox = () => {
    if (dialog.open) dialog.close();
  };

  root.querySelectorAll("[data-product-video-open]").forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const preview = button.querySelector("video");
        if (!preview) return;

        preview.pause();
        lightboxVideo.replaceChildren(
          ...[...preview.querySelectorAll("source")].map((source) =>
            source.cloneNode(true),
          ),
        );
        if (preview.poster) lightboxVideo.poster = preview.poster;
        lightboxVideo.currentTime = 0;
        lightboxVideo.defaultMuted = false;
        lightboxVideo.muted = false;
        lightboxVideo.volume = 1;
        lightboxVideo.load();

        dialog.showModal();
        lockPageScroll();
        lightboxVideo.play().catch(() => {});
      },
      { signal },
    );
  });

  dialog
    .querySelector("[data-product-video-close]")
    ?.addEventListener("click", closeLightbox, { signal });
  dialog.addEventListener(
    "click",
    (event) => {
      if (event.target === dialog) closeLightbox();
    },
    { signal },
  );
  dialog.addEventListener("close", clearLightbox, { signal });
}

function destroyProductVideos(root) {
  root.productVideosAbortController?.abort();
  delete root.productVideosAbortController;
  const dialog = root.querySelector("[data-product-video-lightbox]");
  const lightboxVideo = dialog?.querySelector(
    "[data-product-video-lightbox-media]",
  );
  lightboxVideo?.pause();
  if (dialog?.open) dialog.close();
  unlockPageScroll();
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
