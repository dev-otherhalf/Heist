import Swiper from "swiper";
import { A11y, EffectFade } from "swiper/modules";
import "swiper/css/effect-fade";

class PressSection {
  constructor(section) {
    this.section = section;
    this.slider = section.querySelector("[data-press-section-slider]");
    this.paginationEls = Array.from(
      section.querySelectorAll("[data-press-section-pagination]"),
    );
    this.nextButtons = Array.from(
      section.querySelectorAll("[data-press-section-next]"),
    );
    this.prevButtons = Array.from(
      section.querySelectorAll("[data-press-section-prev]"),
    );
    this.handleNextClick = () => this.swiper?.slideNext();
    this.handlePrevClick = () => this.swiper?.slidePrev();
    this.handleSlideChange = () => this.updateControls();
  }

  init() {
    if (!this.slider) return;

    const slideCount = this.slider.querySelectorAll(".swiper-slide").length;

    this.swiper = new Swiper(this.slider, {
      modules: [A11y, EffectFade],
      slidesPerView: 1,
      spaceBetween: 24,
      speed: 700,
      effect: "fade",
      fadeEffect: { crossFade: true },
      allowTouchMove: slideCount > 1,
      a11y: {
        enabled: true,
      },
    });

    this.slideCount = slideCount;
    this.bindControls();
    this.renderPagination();
    this.updateControls();
    this.swiper.on("slideChange", this.handleSlideChange);

    if (slideCount <= 1) {
      this.nextButtons.forEach((button) =>
        button.setAttribute("disabled", "disabled"),
      );
      this.prevButtons.forEach((button) =>
        button.setAttribute("disabled", "disabled"),
      );
    }
  }

  bindControls() {
    this.nextButtons.forEach((button) => {
      button.addEventListener("click", this.handleNextClick);
    });

    this.prevButtons.forEach((button) => {
      button.addEventListener("click", this.handlePrevClick);
    });
  }

  renderPagination() {
    const markup = Array.from({ length: this.slideCount }, (_, index) => {
      const isActive = index === this.swiper.activeIndex;

      return `
        <button
          class="press-section__pagination-bullet${
            isActive ? " is-active" : ""
          }"
          type="button"
          aria-label="Go to press entry ${index + 1}"
          aria-current="${isActive ? "true" : "false"}"
          data-press-section-bullet="${index}"
        ></button>
      `;
    }).join("");

    this.paginationEls.forEach((paginationEl) => {
      paginationEl.innerHTML = markup;

      paginationEl
        .querySelectorAll("[data-press-section-bullet]")
        .forEach((bullet) => {
          bullet.addEventListener("click", () => {
            const index = Number(bullet.dataset.pressSectionBullet);
            this.swiper?.slideTo(index);
          });
        });
    });
  }

  updateControls() {
    const isBeginning = this.swiper?.isBeginning ?? true;
    const isEnd = this.swiper?.isEnd ?? true;

    this.prevButtons.forEach((button) => {
      button.toggleAttribute("disabled", isBeginning && this.slideCount > 1);
    });

    this.nextButtons.forEach((button) => {
      button.toggleAttribute("disabled", isEnd && this.slideCount > 1);
    });

    this.paginationEls.forEach((paginationEl) => {
      paginationEl
        .querySelectorAll("[data-press-section-bullet]")
        .forEach((bullet) => {
          const isActive =
            Number(bullet.dataset.pressSectionBullet) ===
            this.swiper.activeIndex;

          bullet.classList.toggle("is-active", isActive);
          bullet.setAttribute("aria-current", isActive ? "true" : "false");
        });
    });
  }

  destroy() {
    this.swiper?.off("slideChange", this.handleSlideChange);
    this.nextButtons.forEach((button) => {
      button.removeEventListener("click", this.handleNextClick);
    });
    this.prevButtons.forEach((button) => {
      button.removeEventListener("click", this.handlePrevClick);
    });
    this.swiper?.destroy(true, true);
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;

  const instance = new PressSection(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;

  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-press-section]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-press-section]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-press-section]").forEach(unmount);
});
