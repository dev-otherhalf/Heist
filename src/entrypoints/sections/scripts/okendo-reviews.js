class OkendoReviews {
  constructor(section) {
    this.section = section;
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
