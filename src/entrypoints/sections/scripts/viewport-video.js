class ViewportVideo {
  constructor(section) {
    this.section = section;
    this.videos = [...section.querySelectorAll(".viewport-video__video")];
    this.soundToggle = section.querySelector("[data-sound-toggle]");
    this.mutedIcon = section.querySelector("[data-sound-icon-muted]");
    this.unmutedIcon = section.querySelector("[data-sound-icon-unmuted]");
    this.handleIntersect = this.handleIntersect.bind(this);
    this.handleToggleSound = this.handleToggleSound.bind(this);
  }

  init() {
    if (this.videos.length === 0) return;

    this.observer = new IntersectionObserver(this.handleIntersect, {
      threshold: 0.5,
    });
    this.observer.observe(this.section);

    this.soundToggle?.addEventListener("click", this.handleToggleSound);
  }

  destroy() {
    this.observer?.disconnect();
    this.soundToggle?.removeEventListener("click", this.handleToggleSound);
  }

  handleIntersect(entries) {
    const entry = entries.find((item) => item.target === this.section);
    if (!entry) return;

    this.videos.forEach((video) => {
      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  handleToggleSound() {
    const unmute = this.videos.every((video) => video.muted);

    this.videos.forEach((video) => {
      video.muted = !unmute;
    });

    this.soundToggle.setAttribute("aria-pressed", String(unmute));
    this.soundToggle.setAttribute(
      "aria-label",
      unmute ? "Mute video" : "Unmute video",
    );
    this.mutedIcon?.toggleAttribute("hidden", unmute);
    this.unmutedIcon?.toggleAttribute("hidden", !unmute);
  }
}

const instances = new WeakMap();

const mount = (section) => {
  if (instances.has(section)) return;
  const instance = new ViewportVideo(section);
  instance.init();
  instances.set(section, instance);
};

const unmount = (section) => {
  const instance = instances.get(section);
  if (!instance) return;
  instance.destroy();
  instances.delete(section);
};

document.querySelectorAll("[data-viewport-video]").forEach(mount);

document.addEventListener("shopify:section:load", (event) => {
  event.target.querySelectorAll("[data-viewport-video]").forEach(mount);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-viewport-video]").forEach(unmount);
});
