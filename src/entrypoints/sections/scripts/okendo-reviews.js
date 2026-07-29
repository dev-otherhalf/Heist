const BARCODE_CLASS = "okendo-reviews-section__review-barcode";

// Matches `respond-down(md)` in okendo-reviews.scss, so the artwork and its
// height switch at the same width.
const BARCODE_MOBILE_MEDIA = "(max-width: 46.865rem)";

class OkendoReviews {
  constructor(section) {
    this.section = section;
    this.barcodeSrc = section.dataset.reviewBarcode || "";
    this.barcodeSrcMobile = section.dataset.reviewBarcodeMobile || "";
    this.moveWidgetElements = this.moveWidgetElements.bind(this);
  }

  init() {
    this.observer = new MutationObserver(this.moveWidgetElements);
    this.observer.observe(this.section, {
      childList: true,
      subtree: true,
    });
    this.moveWidgetElements();
  }

  destroy() {
    this.observer?.disconnect();
  }

  moveWidgetElements() {
    const writeReview = this.section.querySelector(
      ".oke-w-reviews-writeReview",
    );
    const leftBlock = this.section.querySelector(
      ".oke-w-header-content-block--left",
    );
    const ratingCount = this.section.querySelector(
      ".oke-w-ratingAverageModule-count",
    );
    const ratingStars = this.section.querySelector(
      ".oke-w-ratingAverageModule-rating-stars",
    );

    if (writeReview && leftBlock && !leftBlock.contains(writeReview)) {
      leftBlock.appendChild(writeReview);
    }

    if (ratingCount && ratingStars && !ratingStars.contains(ratingCount)) {
      ratingStars.appendChild(ratingCount);
    }

    this.insertBarcodes();
  }

  // Okendo re-renders the review list on sort, filter and pagination, so this
  // runs on every mutation and adds the barcode to any card missing one.
  insertBarcodes() {
    // Either picker alone is enough; each falls back to the other.
    const desktopSrc = this.barcodeSrc || this.barcodeSrcMobile;
    if (!desktopSrc) return;

    const identities = this.section.querySelectorAll(
      ".oke-w-reviewer-identity",
    );

    identities.forEach((identity) => {
      if (identity.nextElementSibling?.classList.contains(BARCODE_CLASS)) {
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = BARCODE_CLASS;
      wrapper.setAttribute("aria-hidden", "true");

      const picture = document.createElement("picture");

      if (this.barcodeSrcMobile) {
        const source = document.createElement("source");
        source.media = BARCODE_MOBILE_MEDIA;
        source.srcset = this.barcodeSrcMobile;
        picture.appendChild(source);
      }

      const image = document.createElement("img");
      image.src = desktopSrc;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      picture.appendChild(image);

      wrapper.appendChild(picture);
      identity.insertAdjacentElement("afterend", wrapper);
    });
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;

  const instance = new OkendoReviews(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;

  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-okendo-reviews]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-okendo-reviews]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-okendo-reviews]").forEach(unmount);
});
