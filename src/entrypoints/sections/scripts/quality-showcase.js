class QualityShowcase {
  constructor(section) {
    this.section = section;
    this.annotation = section.querySelector("[data-rolling-annotation]");
    this.digits = Array.from(section.querySelectorAll("[data-digit]"));
  }

  init() {
    if (!this.annotation) return;

    this.prepareDigits();

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

  prepareDigits() {
    this.digits.forEach((digit, index) => {
      const strip = digit.querySelector("[data-digit-strip]");
      const value = Number(digit.dataset.digit);

      if (!strip || Number.isNaN(value)) return;

      const extraCycles = 2 + (this.digits.length - index);
      const frameCount = extraCycles * 10 + value + 1;

      strip.innerHTML = Array.from(
        { length: frameCount },
        (_, frameIndex) => `<span>${frameIndex % 10}</span>`,
      ).join("");

      strip.style.transform = "translateY(0)";
      strip.dataset.targetOffset = String(frameCount - 1);
      strip.style.transitionDelay = `${index * 90}ms`;
      strip.style.transitionDuration = `${1200 + index * 120}ms`;
    });
  }

  rollDigitsIn() {
    requestAnimationFrame(() => {
      this.digits.forEach((digit) => {
        const strip = digit.querySelector("[data-digit-strip]");
        const targetOffset = Number(strip?.dataset.targetOffset);

        if (!strip || Number.isNaN(targetOffset)) return;

        strip.style.transform = `translateY(-${targetOffset}em)`;
      });
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
