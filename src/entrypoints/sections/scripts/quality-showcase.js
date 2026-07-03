class QualityShowcase {
  constructor(section) {
    this.section = section;
    this.annotation = section.querySelector("[data-rolling-annotation]");
  }

  init() {
    if (!this.annotation) return;

    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersect(entries),
      { threshold: 0.1 },
    );
    this.observer.observe(this.section);
  }

  destroy() {
    this.observer?.disconnect();
  }

  handleIntersect(entries) {
    const entry = entries.find((item) => item.target === this.section);
    if (!entry || !entry.isIntersecting) return;

    this.rollDigitsIn();
    this.observer.unobserve(this.section);
  }

  rollDigitsIn() {
    this.annotation.querySelectorAll("[data-digit]").forEach((digit) => {
      const strip = digit.querySelector("[data-digit-strip]");
      const value = Number(digit.dataset.digit);

      if (!strip || Number.isNaN(value)) return;

      strip.style.transform = `translateY(-${value}em)`;
    });
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;
  const instance = new QualityShowcase(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;
  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-quality-showcase]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-quality-showcase]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-quality-showcase]").forEach(unmount);
});
