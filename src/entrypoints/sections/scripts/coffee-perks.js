import Swiper from "swiper";
import { FreeMode, Mousewheel, A11y } from "swiper/modules";

class CoffeePerks {
  constructor(section) {
    this.section = section;
    this.heading = section.querySelector("[data-coffee-perks-heading]");
    this.toggle = section.querySelector("[data-coffee-perks-toggle]");
    this.toggleLabel = section.querySelector(
      "[data-coffee-perks-toggle-label]",
    );
    this.views = Array.from(
      section.querySelectorAll("[data-coffee-perks-view]"),
    );
    this.swipers = [];
    this.activeIndex = 0;
    this.handleToggle = () => this.next();
  }

  init() {
    if (!this.views.length) return;

    this.views.forEach((view) => {
      const el = view.querySelector("[data-coffee-perks-swiper]");
      if (!el) {
        this.swipers.push(null);
        return;
      }

      this.swipers.push(
        new Swiper(el, {
          modules: [FreeMode, Mousewheel, A11y],
          slidesPerView: 3,
          spaceBetween: 16,
          freeMode: false,
          grabCursor: true,
          centerInsufficientSlides: true,
          mousewheel: { forceToAxis: true },
          a11y: { enabled: true },
          breakpoints: {
            0: {
              slidesPerView: "auto",
            },
            768: {
              slidesPerView: 3,
            },
            1199: {
              slidesPerView: 4,
            },
          },
        }),
      );
    });

    if (this.toggle && this.views.length > 1) {
      this.toggle.addEventListener("click", this.handleToggle);
    }

    this.activate(0);
  }

  next() {
    const nextIndex = (this.activeIndex + 1) % this.views.length;
    this.activate(nextIndex);
  }

  activate(index) {
    this.views.forEach((view, i) => {
      const isActive = i === index;
      view.classList.toggle("is-active", isActive);
      view.toggleAttribute("hidden", !isActive);
    });

    this.activeIndex = index;
    const activeView = this.views[index];

    if (this.heading && activeView.dataset.heading != null) {
      this.heading.textContent = activeView.dataset.heading;
    }

    if (this.toggleLabel && activeView.dataset.toggleLabel != null) {
      this.toggleLabel.textContent = activeView.dataset.toggleLabel;
    }

    // Swiper mis-measures while its view is hidden — re-measure on reveal.
    const swiper = this.swipers[index];
    if (swiper) {
      swiper.update();
      swiper.slideTo(0, 0);
    }
  }

  destroy() {
    if (this.toggle) {
      this.toggle.removeEventListener("click", this.handleToggle);
    }
    this.swipers.forEach((swiper) => swiper?.destroy(true, true));
    this.swipers = [];
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;
  const instance = new CoffeePerks(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;
  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-coffee-perks]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-coffee-perks]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-coffee-perks]").forEach(unmount);
});
