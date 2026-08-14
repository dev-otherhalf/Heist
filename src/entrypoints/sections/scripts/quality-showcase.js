class QualityShowcase {
  constructor(section) {
    this.section = section;
    this.annotation = section.querySelector("[data-rolling-annotation]");
    this.digits = Array.from(section.querySelectorAll("[data-digit]"));
    this.mobileMediaQuery = window.matchMedia("(max-width: 989px)");
    this.resizeFrame = null;
    this.handleResize = () => this.schedulePointHeightSync();
  }

  init() {
    this.syncPointHeights();
    window.addEventListener("resize", this.handleResize);
    document.fonts?.ready.then(() => this.schedulePointHeightSync());

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
    window.removeEventListener("resize", this.handleResize);

    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);

    this.getPoints().forEach((point) => {
      point.style.minHeight = "";
    });
  }

  getPoints() {
    return Array.from(
      this.section.querySelectorAll(
        ".quality-showcase__column > .quality-showcase__point",
      ),
    );
  }

  schedulePointHeightSync() {
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);

    this.resizeFrame = requestAnimationFrame(() => {
      this.resizeFrame = null;
      this.syncPointHeights();
    });
  }

  syncPointHeights() {
    const columns = Array.from(
      this.section.querySelectorAll(".quality-showcase__column"),
    ).map((column) =>
      Array.from(column.querySelectorAll(":scope > .quality-showcase__point")),
    );
    const points = columns.flat();

    points.forEach((point) => {
      point.style.minHeight = "";
    });

    if (!this.mobileMediaQuery.matches || columns.length < 2) return;

    const rowCount = Math.max(...columns.map((column) => column.length));

    for (let index = 0; index < rowCount; index += 1) {
      const rowPoints = columns.map((column) => column[index]).filter(Boolean);
      const rowHeight = Math.max(
        ...rowPoints.map((point) => point.getBoundingClientRect().height),
      );

      rowPoints.forEach((point) => {
        point.style.minHeight = `${rowHeight}px`;
      });
    }
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
