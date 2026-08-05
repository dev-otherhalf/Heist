import { lockPageScroll, unlockPageScroll } from "./page-scroll-lock";

const METADATA_POLL_INTERVAL = 20000;

class HeistFMPlayer {
  constructor(root) {
    if (!root || root.dataset.heistPlayerReady === "true") return;

    this.root = root;
    this.root.dataset.heistPlayerReady = "true";
    this.audio = root.querySelector("[data-heist-audio]");
    this.cover = root.querySelector("[data-heist-cover]");
    this.placeholder = root.querySelector("[data-heist-placeholder]");
    this.status = root.querySelector("[data-heist-status]");
    this.playIcon = root.querySelector("[data-heist-play-icon]");
    this.playButton = root.querySelector('[data-heist-action="toggle"]');
    this.streamUrl = root.dataset.streamUrl || "";
    this.metadataUrl = root.dataset.metadataUrl || "";
    this.fallbackCover = root.dataset.fallbackCover || "";
    this.isOnAir = false;
    this.isDestroyed = false;
    this.pollTimer = null;
    this.isVisible = true;
    this.isInView = true;
    this.metadataObserver = null;
    this.handleVisibilityChange = () => {
      this.isVisible = !document.hidden;
      this.syncPolling();
    };

    if (!this.audio || !this.streamUrl) {
      this.root.classList.add("is-empty");
      this.setStatus("Add a Live365 station ID in the header settings.");
      return;
    }

    this.bindEvents();
    this.setupMetadataPolling();
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-heist-action]");
      if (!button) return;

      if (button.dataset.heistAction === "toggle") this.toggle();
    });

    this.audio.addEventListener("playing", () => {
      this.isOnAir = true;
      this.setPlaying(true);
      this.setStatus("Live on Heist FM.");
      this.fetchMetadata();
    });

    this.audio.addEventListener("waiting", () => {
      if (this.isOnAir) this.setStatus("Connecting to the broadcast.");
    });

    this.audio.addEventListener("pause", () => this.handleOffAir("Off air."));

    this.audio.addEventListener("error", () => {
      if (!this.audio.getAttribute("src")) return;
      this.handleOffAir("The broadcast is unavailable right now.");
    });

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  toggle() {
    if (this.isOnAir) this.stop();
    else this.play();
  }

  play() {
    this.isOnAir = true;
    this.audio.src = `${this.streamUrl}${
      this.streamUrl.includes("?") ? "&" : "?"
    }t=${Date.now()}`;
    this.audio.load();
    this.setPlaying(true);
    this.setStatus("Connecting to the broadcast.");
    this.syncPolling();

    this.audio.play()?.catch(() => {
      this.handleOffAir("Playback was blocked. Tap play again.");
    });
  }

  stop() {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.handleOffAir("Off air.");
  }

  handleOffAir(message) {
    this.isOnAir = false;
    this.setPlaying(false);
    this.setStatus(message);
    this.syncPolling();
  }

  setupMetadataPolling() {
    if (!this.metadataUrl) return;

    if ("IntersectionObserver" in window) {
      this.isInView = false;
      this.metadataObserver = new IntersectionObserver((entries) => {
        this.isInView = entries.some((entry) => entry.isIntersecting);
        this.syncPolling();
      });
      this.metadataObserver.observe(this.root);
    }

    this.syncPolling();
  }

  syncPolling() {
    const shouldPoll =
      !this.isDestroyed &&
      Boolean(this.metadataUrl) &&
      this.isVisible &&
      (this.isInView || this.isOnAir);

    if (!shouldPoll) {
      this.stopPolling();
      return;
    }

    if (this.pollTimer) return;

    this.fetchMetadata();
    this.pollTimer = window.setInterval(
      () => this.fetchMetadata(),
      METADATA_POLL_INTERVAL,
    );
  }

  stopPolling() {
    if (!this.pollTimer) return;
    window.clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  async fetchMetadata() {
    if (!this.metadataUrl) return;

    try {
      const response = await fetch(this.metadataUrl);
      if (!response.ok) throw new Error(`Live365 error ${response.status}`);

      const data = await response.json();
      this.updateCover((data?.["current-track"]?.art || "").trim());
    } catch (error) {
      this.updateCover("");
    }
  }

  updateCover(url) {
    if (!this.cover) return;

    const source = url || this.fallbackCover;

    if (source) {
      if (this.cover.getAttribute("src") !== source) this.cover.src = source;
      this.cover.classList.add("is-visible");
      this.placeholder?.classList.add("is-hidden");
    } else {
      this.cover.removeAttribute("src");
      this.cover.classList.remove("is-visible");
      this.placeholder?.classList.remove("is-hidden");
    }
  }

  setPlaying(isPlaying) {
    this.root.classList.toggle("is-playing", isPlaying);
    const playIcon = `
  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
    <g clip-path="url(#clip0_5164_19488)">
      <path d="M16 0C12.8355 0 9.74207 0.938384 7.11088 2.69649C4.4797 4.45459 2.42894 6.95345 1.21793 9.87706C0.0069325 12.8007 -0.309921 16.0177 0.307443 19.1214C0.924806 22.2251 2.44866 25.0761 4.6863 27.3137C6.92394 29.5513 9.77487 31.0752 12.8786 31.6926C15.9823 32.3099 19.1993 31.9931 22.1229 30.7821C25.0466 29.5711 27.5454 27.5203 29.3035 24.8891C31.0616 22.2579 32 19.1645 32 16C31.9876 11.7603 30.2979 7.69789 27.3 4.69999C24.3021 1.70209 20.2397 0.0123994 16 0ZM22.6 16.8L14.6 22.8C14.4176 22.9109 14.2125 22.9793 14 23C13.8 23 13.7 23 13.6 22.9C13.4212 22.8275 13.2684 22.7029 13.1614 22.5424C13.0544 22.3819 12.9981 22.1929 13 22V10C12.9981 9.80709 13.0544 9.61808 13.1614 9.45757C13.2684 9.29705 13.4212 9.17246 13.6 9.1C13.7584 9.0179 13.9373 8.98363 14.1149 9.00139C14.2924 9.01915 14.461 9.08815 14.6 9.2L22.6 15.2C22.7242 15.2931 22.825 15.4139 22.8944 15.5528C22.9639 15.6916 23 15.8448 23 16C23 16.1552 22.9639 16.3084 22.8944 16.4472C22.825 16.5861 22.7242 16.7069 22.6 16.8Z" fill="#161414"/>
    </g>
    <defs>
      <clipPath id="clip0_5164_19488">
        <rect width="32" height="32" fill="white"/>
      </clipPath>
    </defs>
  </svg>
`;

    const pauseIcon = `
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.9999 0C20.2395 0.0123994 24.3018 1.7023 27.2997 4.7002C30.2976 7.69809 31.9875 11.7603 31.9999 16C31.9999 19.1643 31.0615 22.2576 29.3036 24.8887C27.5455 27.5198 25.0465 29.5712 22.1229 30.7822C19.1994 31.9932 15.9824 32.3097 12.8788 31.6924C9.77508 31.075 6.92403 29.5511 4.68639 27.3135C2.44875 25.0758 0.924848 22.2248 0.307485 19.1211C-0.309798 16.0175 0.00667835 12.8005 1.21764 9.87695C2.42865 6.95335 4.48002 4.45438 7.1112 2.69629C9.74229 0.93836 12.8355 1.50818e-06 15.9999 0ZM10.9999 9C10.4476 9 9.99987 9.44772 9.99987 10V22C9.99987 22.5523 10.4476 23 10.9999 23H12.9999C13.5522 23 13.9999 22.5523 13.9999 22V10C13.9999 9.44772 13.5522 9 12.9999 9H10.9999ZM18.9999 9C18.4476 9 17.9999 9.44772 17.9999 10V22C17.9999 22.5523 18.4476 23 18.9999 23H20.9999C21.5522 23 21.9999 22.5523 21.9999 22V10C21.9999 9.44772 21.5522 9 20.9999 9H18.9999Z" fill="#161414"/>
  </svg>
`;

    this.playIcon.innerHTML = isPlaying ? pauseIcon : playIcon;
    this.playButton?.setAttribute(
      "aria-label",
      isPlaying ? "Stop audio" : "Play audio",
    );
  }

  setStatus(message) {
    if (this.status) this.status.textContent = message;
  }
}

const header = document.querySelector("[data-heist-header]");
const stickyCta = document.querySelector("[data-heist-sticky-cta]");
const pageWrapper = document.querySelector(".page-wrapper");
const scrollCaptureSection = header?.classList.contains("heist-header--home")
  ? document.querySelector(".heist-scroll-capture-section")
  : null;
const scrollCaptureBrandLogo = scrollCaptureSection?.querySelector(
  ".heist-capture__brand-logo",
);
const scrollCaptureButton = scrollCaptureSection?.querySelector(
  ".heist-capture__button",
);

if (header) {
  let lastScrollTop = 0;
  let ticking = false;

  const mobileSocials = header.querySelector("[data-heist-mobile-socials]");
  const mobileSocialLinks = [
    ...header.querySelectorAll("[data-heist-mobile-social-link]"),
  ].slice(0, 3);

  if (mobileSocials && mobileSocialLinks.length) {
    mobileSocialLinks.forEach((link) => mobileSocials.append(link));
    mobileSocials.hidden = false;
  }

  const fmMount = header.querySelector("[data-heist-fm-mount]");
  const fmBlocks = [...header.querySelectorAll("[data-heist-fm-block]")].slice(
    0,
    1,
  );

  if (fmMount && fmBlocks.length) {
    fmBlocks.forEach((block) => {
      fmMount.append(block);
      new HeistFMPlayer(block.querySelector("[data-heist-player]"));
    });
    fmMount.hidden = false;
  }

  const getScrollTop = () =>
    window.matchMedia("(min-width: 990px)").matches
      ? pageWrapper?.scrollTop || 0
      : window.scrollY || document.documentElement.scrollTop;

  const updateHeader = () => {
    const scrollTop = getScrollTop();
    const delta = scrollTop - lastScrollTop;
    const beyondHeader = scrollTop > header.offsetHeight + 24;
    const isDesktop = window.matchMedia("(min-width: 990px)").matches;
    const isHomeHeader = header.classList.contains("heist-header--home");
    const headerTriggerOffset = header.offsetHeight;
    const hasReachedBrandLogo =
      isHomeHeader &&
      scrollCaptureBrandLogo &&
      scrollCaptureBrandLogo.getBoundingClientRect().top <= headerTriggerOffset;
    const hasReachedCaptureButton =
      isHomeHeader &&
      scrollCaptureButton &&
      scrollCaptureButton.getBoundingClientRect().top <= headerTriggerOffset;
    const hasClearedScrollCapture =
      !scrollCaptureSection ||
      scrollCaptureSection.getBoundingClientRect().bottom <= 0;
    const canShowStickyHeader = isHomeHeader
      ? hasReachedCaptureButton
      : beyondHeader && hasClearedScrollCapture;
    const canShowStickyCta = isHomeHeader
      ? hasReachedCaptureButton
      : beyondHeader && (!isDesktop || hasClearedScrollCapture);
    const atTop = scrollTop <= 1;
    const isSticky =
      header.classList.contains("is-pinned") ||
      header.classList.contains("is-hidden");

    if (atTop || (isHomeHeader && !hasReachedBrandLogo)) {
      header.classList.remove("is-pinned", "is-hidden");
    } else if (isHomeHeader && !canShowStickyHeader) {
      header.classList.remove("is-pinned");
      header.classList.add("is-hidden");
    } else if (!isHomeHeader && !hasClearedScrollCapture) {
      header.classList.remove("is-pinned", "is-hidden");
    } else if (delta > 3 && canShowStickyHeader) {
      header.classList.remove("is-pinned");
      header.classList.add("is-hidden");
    } else if (delta < -3 && (canShowStickyHeader || isSticky)) {
      header.classList.add("is-pinned");
      header.classList.remove("is-hidden");
    }

    if (!canShowStickyCta) {
      stickyCta?.classList.remove("is-visible");
      stickyCta?.setAttribute("aria-hidden", "true");
    } else if (delta > 3) {
      stickyCta?.classList.add("is-visible");
      stickyCta?.setAttribute("aria-hidden", "false");
    } else if (delta < -3) {
      stickyCta?.classList.remove("is-visible");
      stickyCta?.setAttribute("aria-hidden", "true");
    }

    lastScrollTop = Math.max(scrollTop, 0);
    ticking = false;
  };

  const footer = document.querySelector("footer");

  if (stickyCta && footer) {
    const footerObserver = new IntersectionObserver(
      ([entry]) => {
        stickyCta.classList.toggle("is-footer-visible", entry.isIntersecting);
      },
      {
        threshold: 0,
      },
    );

    footerObserver.observe(footer);
  }

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateHeader);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  pageWrapper?.addEventListener("scroll", onScroll, { passive: true });
  updateHeader();

  header.querySelectorAll("[data-heist-menu-close]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("details")?.removeAttribute("open");
    });
  });

  const mobileMenu = header.querySelector("details.heist-mobile-menu");

  if (mobileMenu) {
    mobileMenu.addEventListener("toggle", () => {
      if (mobileMenu.open) {
        if (window.lenis) window.lenis.stop();
        else lockPageScroll();
      } else {
        if (window.lenis) window.lenis.start();
        else unlockPageScroll();
      }
    });
  }

  document.addEventListener("shopify:cart:lines-update", (event) => {
    event.promise
      ?.then(({ cart, detail }) => {
        const count = cart?.totalQuantity ?? detail?.itemCount;
        if (typeof count !== "number") return;
        document.querySelectorAll("[data-heist-cart-count]").forEach((node) => {
          node.textContent = String(count);
        });
      })
      .catch(() => {});
  });
}
