class ProductVariantShowcase {
  constructor(section) {
    this.section = section;
    this.cards = [...section.querySelectorAll("[data-product-card]")];
    this.badgeMarquee = section.querySelector("[data-badge-marquee]");
    this.handleResize = this.handleResize.bind(this);
  }

  init() {
    this.cards.forEach((card) => this.initCard(card));
    this.initBadgeMarquee();
    window.addEventListener("resize", this.handleResize, { passive: true });
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);

    this.cards.forEach((card) => {
      card.querySelectorAll("[data-variant-trigger]").forEach((button) => {
        button.removeEventListener("click", button._comparisonClickHandler);
      });
      card.removeEventListener("pointerenter", card._comparisonPointerEnterHandler);
    });
  }

  handleResize() {
    this.cards.forEach((card) => this.updateIndicator(card));
    this.initBadgeMarquee();
  }

  initCard(card) {
    const initialVariantId =
      card.dataset.activeVariantId ||
      card.querySelector("[data-variant-trigger]")?.dataset.variantTrigger;

    card.querySelectorAll("[data-variant-trigger]").forEach((button) => {
      const onClick = () =>
        this.setActiveVariant(card, button.dataset.variantTrigger);
      button._comparisonClickHandler = onClick;
      button.addEventListener("click", onClick);
    });

    const onPointerEnter = () =>
      this.updateIndicator(card, { skipIndicatorAnimation: true });
    card._comparisonPointerEnterHandler = onPointerEnter;
    card.addEventListener("pointerenter", onPointerEnter);

    if (initialVariantId) {
      this.setActiveVariant(card, initialVariantId, {
        skipIndicatorAnimation: true,
      });
    }
  }

  setActiveVariant(card, variantId, options = {}) {
    card.dataset.activeVariantId = variantId;

    let activeButton = null;
    card.querySelectorAll("[data-variant-trigger]").forEach((button) => {
      const isActive = button.dataset.variantTrigger === variantId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");

      if (isActive) {
        activeButton = button;
      }
    });

    if (activeButton) {
      this.updateCardData(card, activeButton);
    }

    this.updateIndicator(card, options);
  }

  updateCardData(card, button) {
    const title = card.querySelector("[data-variant-title]");
    const label = card.querySelector("[data-variant-label]");
    const notes = card.querySelector("[data-variant-notes]");
    const mobileImage = card.querySelector("[data-variant-mobile-image]");
    const desktopImage = card.querySelector("[data-variant-desktop-image]");
    const detailDescription = card.querySelector(
      "[data-variant-detail-description]",
    );
    const detailMedia = card.querySelector("[data-variant-detail-media]");
    const ctas = card.querySelectorAll("[data-variant-cta]");
    const prices = card.querySelectorAll("[data-variant-price]");

    if (title) {
      title.textContent = button.dataset.variantTitleValue || "";
    }

    this.updateOptionalText(
      label,
      button.dataset.variantLabelValue || "",
    );
    this.updateOptionalText(
      notes,
      button.dataset.variantNotesValue || "",
    );

    if (mobileImage && button.dataset.variantMobileImageValue) {
      mobileImage.setAttribute("srcset", button.dataset.variantMobileImageValue);
    }

    if (desktopImage && button.dataset.variantDesktopImageValue) {
      desktopImage.setAttribute("src", button.dataset.variantDesktopImageValue);
      desktopImage.setAttribute("alt", button.dataset.variantTitleValue || "");
    }

    if (detailDescription) {
      this.updateOptionalHtml(
        detailDescription,
        button.dataset.variantDescriptionHtml || "",
      );
    }

    if (detailMedia) {
      this.updateOptionalHtml(
        detailMedia,
        button.dataset.variantDetailMediaHtml || "",
      );
    }

    ctas.forEach((cta) => {
      cta.setAttribute("href", button.dataset.variantUrl || "");
    });

    prices.forEach((price) => {
      price.textContent = button.dataset.variantPriceValue || "";
    });
  }

  updateOptionalHtml(element, value) {
    if (!element) return;

    element.innerHTML = value;
    element.classList.toggle("hidden", !value);

    if (!value) {
      element.replaceChildren();
    }
  }

  updateOptionalText(element, value) {
    if (!element) return;

    element.textContent = value;
    element.classList.toggle("hidden", !value);
  }

  updateIndicator(card, options = {}) {
    card.querySelectorAll("[data-variant-toggle]").forEach((toggle) => {
      const indicator = toggle.querySelector("[data-toggle-indicator]");
      const activeButton = toggle.querySelector("[data-variant-trigger].is-active");

      if (!indicator || !activeButton) return;

      const offset = activeButton.offsetLeft - toggle.offsetLeft;
      toggle.style.setProperty(
        "--toggle-indicator-width",
        `${activeButton.offsetWidth}px`,
      );
      toggle.style.setProperty("--toggle-indicator-offset", `${offset}px`);

      if (options.skipIndicatorAnimation) {
        indicator.style.transition = "none";
        requestAnimationFrame(() => {
          indicator.style.transition = "";
        });
      }
    });
  }

  initBadgeMarquee() {
    if (!this.badgeMarquee) return;
    if (window.matchMedia("(min-width: 61.875rem)").matches) {
      this.badgeMarquee.classList.remove("is-marquee-ready");
      this.badgeMarquee
        .querySelectorAll("[data-marquee-clone='true']")
        .forEach((node) => node.remove());
      return;
    }

    const track = this.badgeMarquee.querySelector("[data-badge-track]");
    if (!track) return;

    this.badgeMarquee
      .querySelectorAll("[data-marquee-clone='true']")
      .forEach((node) => node.remove());

    const items = [...track.children];
    if (items.length === 0) return;

    items.forEach((item) => {
      const clone = item.cloneNode(true);
      clone.setAttribute("data-marquee-clone", "true");
      track.appendChild(clone);
    });

    const distance = [...track.children]
      .slice(0, items.length)
      .reduce((width, item) => width + item.getBoundingClientRect().width, 0);

    this.badgeMarquee.style.setProperty(
      "--badge-marquee-distance",
      `${distance}px`,
    );
    this.badgeMarquee.style.setProperty(
      "--badge-marquee-duration",
      `${Math.max(12, Math.round(distance / 18))}s`,
    );
    this.badgeMarquee.classList.add("is-marquee-ready");
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;
  const instance = new ProductVariantShowcase(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;
  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-product-variant-showcase]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-product-variant-showcase]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target
    .querySelectorAll("[data-product-variant-showcase]")
    .forEach(unmount);
});
