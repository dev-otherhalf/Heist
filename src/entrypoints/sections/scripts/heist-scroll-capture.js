class HeistScrollCapture extends HTMLElement {
  connectedCallback() {
    if (this.dataset.ready === "true") return;

    this.dataset.ready = "true";
    this.glass = this.querySelector(".heist-capture__glass-motion");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.pageScroller = this.closest(".page-wrapper");
    this.ticking = false;
    this.releaseMeasure = document.createElement("span");
    this.releaseMeasure.setAttribute("aria-hidden", "true");
    Object.assign(this.releaseMeasure.style, {
      display: "block",
      position: "absolute",
      width: "0",
      height: "var(--heist-release-distance)",
      visibility: "hidden",
      pointerEvents: "none",
    });
    this.append(this.releaseMeasure);

    this.requestUpdate = () => {
      if (this.ticking) return;
      this.ticking = true;

      requestAnimationFrame(() => {
        this.update();
        this.ticking = false;
      });
    };

    window.addEventListener("scroll", this.requestUpdate, { passive: true });
    window.addEventListener("resize", this.requestUpdate, { passive: true });
    this.pageScroller?.addEventListener("scroll", this.requestUpdate, {
      passive: true,
    });

    this.resizeObserver = new ResizeObserver(this.requestUpdate);
    this.resizeObserver.observe(this);
    this.update();
  }

  disconnectedCallback() {
    window.removeEventListener("scroll", this.requestUpdate);
    window.removeEventListener("resize", this.requestUpdate);
    this.pageScroller?.removeEventListener("scroll", this.requestUpdate);
    this.resizeObserver?.disconnect();
    this.releaseMeasure?.remove();
    this.dataset.ready = "false";
  }

  update() {
    const rect = this.getBoundingClientRect();
    const scrolled = Math.max(-rect.top, 0);

    const releaseDistance = Math.max(
      this.releaseMeasure?.getBoundingClientRect().height ||
        window.innerHeight * 1.2,
      1,
    );

    const glassDistance = this.reducedMotion.matches
      ? releaseDistance
      : Math.min(scrolled, releaseDistance);

    const progress = Math.min(scrolled / releaseDistance, 1);

    this.style.setProperty("--heist-glass-y", `${glassDistance.toFixed(2)}px`);
    this.style.setProperty("--heist-progress", progress.toFixed(4));

    const isReleased = progress >= 1;

    this.toggleAttribute("data-released", isReleased);
    this.classList.toggle("is-released", isReleased);
  }
}

if (!customElements.get("heist-scroll-capture")) {
  customElements.define("heist-scroll-capture", HeistScrollCapture);
}
