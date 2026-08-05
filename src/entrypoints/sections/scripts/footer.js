const METADATA_POLL_INTERVAL = 20000;

const PLAY_ICON = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_4676_9925)">
<path d="M24 0C19.2533 0 14.6131 1.40758 10.6663 4.04473C6.71955 6.68188 3.6434 10.4302 1.8269 14.8156C0.0103987 19.201 -0.464881 24.0266 0.461164 28.6822C1.38721 33.3377 3.67299 37.6141 7.02945 40.9706C10.3859 44.327 14.6623 46.6128 19.3178 47.5388C23.9734 48.4649 28.799 47.9896 33.1844 46.1731C37.5698 44.3566 41.3181 41.2805 43.9553 37.3337C46.5924 33.3869 48 28.7468 48 24C47.9814 17.6405 45.4469 11.5468 40.95 7.04998C36.4532 2.55314 30.3595 0.0185991 24 0ZM33.9 25.2L21.9 34.2C21.6264 34.3663 21.3187 34.4689 21 34.5C20.7 34.5 20.55 34.5 20.4 34.35C20.1318 34.2413 19.9026 34.0544 19.742 33.8136C19.5815 33.5729 19.4972 33.2894 19.5 33V15C19.4972 14.7106 19.5815 14.4271 19.742 14.1864C19.9026 13.9456 20.1318 13.7587 20.4 13.65C20.6377 13.5268 20.906 13.4755 21.1723 13.5021C21.4386 13.5287 21.6915 13.6322 21.9 13.8L33.9 22.8C34.0863 22.9397 34.2375 23.1209 34.3417 23.3292C34.4458 23.5375 34.5 23.7671 34.5 24C34.5 24.2329 34.4458 24.4625 34.3417 24.6708C34.2375 24.8791 34.0863 25.0603 33.9 25.2Z" fill="#161414"/>
</g>
<defs>
<clipPath id="clip0_4676_9925">
<rect width="48" height="48" fill="white"/>
</clipPath>
</defs>
</svg>`;

const STOP_ICON = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15.9999 0C20.2395 0.0123994 24.3018 1.7023 27.2997 4.7002C30.2976 7.69809 31.9875 11.7603 31.9999 16C31.9999 19.1643 31.0615 22.2576 29.3036 24.8887C27.5455 27.5198 25.0465 29.5712 22.1229 30.7822C19.1994 31.9932 15.9824 32.3097 12.8788 31.6924C9.77508 31.075 6.92403 29.5511 4.68639 27.3135C2.44875 25.0758 0.924848 22.2248 0.307485 19.1211C-0.309798 16.0175 0.00667835 12.8005 1.21764 9.87695C2.42865 6.95335 4.48002 4.45438 7.1112 2.69629C9.74229 0.93836 12.8355 1.50818e-06 15.9999 0ZM10.9999 9C10.4476 9 9.99987 9.44772 9.99987 10V22C9.99987 22.5523 10.4476 23 10.9999 23H12.9999C13.5522 23 13.9999 22.5523 13.9999 22V10C13.9999 9.44772 13.5522 9 12.9999 9H10.9999ZM18.9999 9C18.4476 9 17.9999 9.44772 17.9999 10V22C17.9999 22.5523 18.4476 23 18.9999 23H20.9999C21.5522 23 21.9999 22.5523 21.9999 22V10C21.9999 9.44772 21.5522 9 20.9999 9H18.9999Z" fill="#161414"/>
</svg>`;

class AudioPlayer {
  constructor(root) {
    if (!root || root.dataset.audioPlayerReady === "true") return;

    this.root = root;
    this.root.dataset.audioPlayerReady = "true";
    this.audio = root.querySelector("[data-audio-element]");
    this.art = root.querySelector("[data-audio-art]");
    this.fallbackCover = root.querySelector(".footer__audio-player-cover");
    this.placeholder = root.querySelector("[data-audio-placeholder]");
    this.playIcon = root.querySelector("[data-audio-play-icon]");
    this.streamUrl = root.dataset.streamUrl || "";
    this.metadataUrl = root.dataset.metadataUrl || "";
    this.isOnAir = false;
    this.isDestroyed = false;
    this.pollTimer = null;
    this.isVisible = true;
    this.isInView = true;
    this.footerRoot = root.closest("[data-footer-root]");
    this.audioBlock = root.closest(".footer__audio");
    this.resizeObserver = null;
    this.metadataObserver = null;
    this.handleViewportResize = () => this.updateFooterAudioOffset();
    this.handleVisibilityChange = () => {
      this.isVisible = !document.hidden;
      this.syncPolling();
    };

    this.setupStickyAudio();

    if (!this.audio || !this.streamUrl) {
      this.root.classList.add("footer__audio-player-card--empty");
      return;
    }

    this.bindEvents();
    this.setupMetadataPolling();
  }

  setupStickyAudio() {
    if (!this.footerRoot || !this.audioBlock) return;

    this.updateFooterAudioOffset();

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateFooterAudioOffset();
      });
      this.resizeObserver.observe(this.audioBlock);
    } else {
      window.addEventListener("resize", this.handleViewportResize);
      window.addEventListener("load", this.handleViewportResize, {
        once: true,
      });
    }
  }

  updateFooterAudioOffset() {
    if (!this.footerRoot || !this.audioBlock) return;

    const audioHeight = Math.ceil(
      this.audioBlock.getBoundingClientRect().height,
    );

    this.footerRoot.style.setProperty(
      "--footer-audio-height",
      `${audioHeight}px`,
    );
  }

  destroy() {
    this.isDestroyed = true;
    this.resizeObserver?.disconnect();
    this.metadataObserver?.disconnect();
    this.stopPolling();
    window.removeEventListener("resize", this.handleViewportResize);
    window.removeEventListener("load", this.handleViewportResize);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.footerRoot?.style.removeProperty("--footer-audio-height");

    this.stop();

    this.root.dataset.audioPlayerReady = "false";
    delete this.root.audioPlayerInstance;
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-audio-action]");
      if (!button) return;

      if (button.dataset.audioAction === "toggle") this.toggle();
    });

    this.audio.addEventListener("playing", () => {
      this.isOnAir = true;
      this.root.classList.add("footer__audio-player-card--playing");
      this.root.classList.remove("footer__audio-player-card--buffering");
      this.setPlayIcon(STOP_ICON, "Stop audio");
      this.fetchMetadata();
    });

    this.audio.addEventListener("waiting", () => {
      if (!this.isOnAir) return;
      this.root.classList.add("footer__audio-player-card--buffering");
    });

    this.audio.addEventListener("pause", () => this.handleOffAir());

    this.audio.addEventListener("error", () => {
      if (!this.audio.getAttribute("src")) return;
      this.handleOffAir();
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
    this.root.classList.add("footer__audio-player-card--buffering");
    this.setPlayIcon(STOP_ICON, "Stop audio");
    this.syncPolling();

    const playPromise = this.audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.handleOffAir();
      });
    }
  }

  stop() {
    if (!this.audio) return;

    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.handleOffAir();
  }

  handleOffAir() {
    this.isOnAir = false;
    this.root.classList.remove("footer__audio-player-card--playing");
    this.root.classList.remove("footer__audio-player-card--buffering");
    this.setPlayIcon(PLAY_ICON, "Play audio");
    this.syncPolling();
  }

  setPlayIcon(markup, label) {
    if (!this.playIcon) return;
    this.playIcon.innerHTML = markup;
    this.playIcon.closest("button")?.setAttribute("aria-label", label);
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
      this.updateNowPlaying(data);
    } catch (error) {
      this.resetNowPlaying();
    }
  }

  updateNowPlaying(data) {
    const track = data?.["current-track"] || {};

    this.updateArt((track.art || "").trim());
  }

  resetNowPlaying() {
    this.updateArt("");
  }

  updateArt(url) {
    if (!this.art) return;

    const hasArt = url !== "";

    if (hasArt && this.art.getAttribute("src") !== url) this.art.src = url;
    if (!hasArt) this.art.removeAttribute("src");

    this.art.hidden = !hasArt;
    this.fallbackCover?.classList.toggle(
      "footer__audio-player-cover--hidden",
      hasArt,
    );
    this.placeholder?.classList.toggle(
      "footer__audio-player-cover-placeholder--hidden",
      hasArt || Boolean(this.fallbackCover),
    );
  }
}

function initAudioPlayers(scope = document) {
  scope.querySelectorAll("[data-audio-player]").forEach((player) => {
    if (player.dataset.audioPlayerReady !== "true") {
      player.audioPlayerInstance = new AudioPlayer(player);
    }
  });
}

function initNewsletterForms(scope = document) {
  scope.querySelectorAll("[data-klaviyo-form]").forEach((form) => {
    if (form.dataset.klaviyoFormReady === "true") return;
    form.dataset.klaviyoFormReady = "true";

    const input = form.querySelector("[data-klaviyo-input]");
    const submit = form.querySelector("[data-klaviyo-submit]");
    const message = form
      .closest("[data-klaviyo-newsletter]")
      ?.querySelector("[data-klaviyo-message]");
    const publicKey = form.dataset.publicKey;
    const listId = form.dataset.listId;

    const setMessage = (text, isError) => {
      if (!message) return;
      message.textContent = text;
      message.hidden = !text;
      message.classList.toggle("footer__newsletter-message--error", !!isError);
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const email = input?.value.trim();

      if (!email || !input.checkValidity()) {
        setMessage("Please enter a valid email address.", true);
        return;
      }

      if (!publicKey || !listId) return;

      if (submit) submit.disabled = true;
      setMessage("", false);

      try {
        const response = await fetch(
          `https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(
            publicKey,
          )}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              revision: "2024-10-15",
            },
            body: JSON.stringify({
              data: {
                type: "subscription",
                attributes: {
                  profile: {
                    data: {
                      type: "profile",
                      attributes: { email },
                    },
                  },
                },
                relationships: {
                  list: { data: { type: "list", id: listId } },
                },
              },
            }),
          },
        );

        if (!response.ok) throw new Error(`Klaviyo error ${response.status}`);

        form.reset();
        setMessage(form.dataset.successMessage, false);
      } catch (error) {
        setMessage(form.dataset.errorMessage, true);
      } finally {
        if (submit) submit.disabled = false;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initAudioPlayers();
  initNewsletterForms();
});

document.addEventListener("shopify:section:load", (event) => {
  initAudioPlayers(event.target);
  initNewsletterForms(event.target);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-audio-player]").forEach((player) => {
    player.audioPlayerInstance?.destroy();
  });
});
