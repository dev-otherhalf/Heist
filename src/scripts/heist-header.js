class HeistFMPlayer {
  constructor(root) {
    if (!root || root.dataset.heistPlayerReady === "true") return;

    this.root = root;
    this.root.dataset.heistPlayerReady = "true";
    this.audio = root.querySelector("[data-heist-audio]");
    this.cover = root.querySelector("[data-heist-cover]");
    this.placeholder = root.querySelector("[data-heist-placeholder]");
    this.trackTitle = root.querySelector("[data-heist-track-title]");
    this.status = root.querySelector("[data-heist-status]");
    this.progress = root.querySelector("[data-heist-progress]");
    this.currentTime = root.querySelector("[data-heist-current-time]");
    this.duration = root.querySelector("[data-heist-duration]");
    this.playIcon = root.querySelector("[data-heist-play-icon]");
    this.playButton = root.querySelector('[data-heist-action="toggle"]');
    this.currentIndex = 0;
    this.isSeeking = false;
    this.isShuffle = false;
    this.isLoop = false;
    this.tracks = this.getTracks();

    if (!this.audio || !this.tracks.length) {
      this.root.classList.add("is-empty");
      this.setStatus(
        "Add an FM track and MP3 file name in the header settings.",
      );
      return;
    }

    this.bindEvents();
    this.loadTrack(0, false);
  }

  getTracks() {
    return [...this.root.querySelectorAll("[data-heist-fm-track]")]
      .map((script) => {
        try {
          return JSON.parse(script.textContent || "{}");
        } catch (error) {
          console.error("Heist FM: Invalid track JSON", error);
          return null;
        }
      })
      .filter((track) => track?.audio?.trim());
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-heist-action]");
      if (!button) return;

      const action = button.dataset.heistAction;

      if (action === "toggle") this.togglePlay();
      if (action === "next") this.nextTrack(true);
      if (action === "previous") this.previousTrack(true);

      if (action === "shuffle") {
        this.isShuffle = !this.isShuffle;
        button.classList.toggle("is-active", this.isShuffle);
      }

      if (action === "loop") {
        this.isLoop = !this.isLoop;
        this.audio.loop = this.isLoop;
        button.classList.toggle("is-active", this.isLoop);
      }
    });

    this.progress.addEventListener("pointerdown", (event) => {
      this.isSeeking = true;
      this.progress.setPointerCapture(event.pointerId);
      this.updateProgressFromPointer(event);
    });

    this.progress.addEventListener("pointermove", (event) => {
      if (this.isSeeking) this.updateProgressFromPointer(event);
    });

    this.progress.addEventListener("pointerup", (event) => {
      this.updateProgressFromPointer(event);
      this.commitProgress();
    });

    this.progress.addEventListener("pointercancel", () => {
      this.isSeeking = false;
    });

    this.progress.addEventListener("keydown", (event) => {
      const currentValue = this.getProgressValue();
      let nextValue = currentValue;

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextValue += 2;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextValue -= 2;
      } else if (event.key === "Home") {
        nextValue = 0;
      } else if (event.key === "End") {
        nextValue = 100;
      } else {
        return;
      }

      event.preventDefault();
      this.setProgressValue(nextValue);
      this.updateTimeFromProgress();
      this.commitProgress();
    });

    this.audio.addEventListener("loadedmetadata", () => {
      this.updateProgress();
      this.updateDuration();
    });
    this.audio.addEventListener("timeupdate", () => {
      if (!this.isSeeking) this.updateProgress();
    });
    this.audio.addEventListener("play", () => this.setPlaying(true));
    this.audio.addEventListener("pause", () => this.setPlaying(false));
    this.audio.addEventListener("ended", () => {
      if (!this.isLoop) this.nextTrack(true);
    });
    this.audio.addEventListener("error", () => {
      this.setPlaying(false);
      this.setStatus("Audio file could not load. Check the MP3 file name.");
    });
  }

  loadTrack(index, shouldPlay) {
    this.currentIndex = this.normalizeIndex(index);
    const track = this.tracks[this.currentIndex];

    this.audio.src = track.audio;
    this.audio.load();
    this.trackTitle.textContent = track.artist
      ? `${track.title || "Untitled track"} — ${track.artist}`
      : track.title || "Untitled track";

    if (track.cover) {
      this.cover.src = track.cover;
      this.cover.alt = track.title || "Track cover";
      this.cover.classList.add("is-visible");
      this.placeholder.classList.add("is-hidden");
    } else {
      this.cover.removeAttribute("src");
      this.cover.classList.remove("is-visible");
      this.placeholder.classList.remove("is-hidden");
    }

    this.resetProgress();
    if (shouldPlay) this.play();
  }

  togglePlay() {
    if (this.audio.paused) this.play();
    else this.audio.pause();
  }

  play() {
    this.audio.play()?.catch(() => {
      this.setStatus("Playback was blocked. Tap play again.");
    });
  }

  nextTrack(shouldPlay) {
    if (this.isShuffle && this.tracks.length > 1) {
      let nextIndex = this.currentIndex;
      while (nextIndex === this.currentIndex) {
        nextIndex = Math.floor(Math.random() * this.tracks.length);
      }
      this.loadTrack(nextIndex, shouldPlay);
      return;
    }
    this.loadTrack(this.currentIndex + 1, shouldPlay);
  }

  previousTrack(shouldPlay) {
    this.loadTrack(this.currentIndex - 1, shouldPlay);
  }

  normalizeIndex(index) {
    if (index < 0) return this.tracks.length - 1;
    if (index >= this.tracks.length) return 0;
    return index;
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
      isPlaying ? "Pause audio" : "Play audio",
    );
  }

  updateProgress() {
    if (!Number.isFinite(this.audio.duration)) return;
    this.setProgressValue((this.audio.currentTime / this.audio.duration) * 100);
    this.currentTime.textContent = this.formatTime(this.audio.currentTime);
  }

  updateDuration() {
    this.duration.textContent = this.formatTime(this.audio.duration);
  }

  updateTimeFromProgress() {
    if (!Number.isFinite(this.audio.duration)) return;
    const previewTime = (this.getProgressValue() / 100) * this.audio.duration;
    const formattedTime = this.formatTime(previewTime);
    this.currentTime.textContent = formattedTime;
    this.progress.setAttribute("aria-valuetext", formattedTime);
  }

  resetProgress() {
    this.setProgressValue(0);
    this.currentTime.textContent = "0:00";
    this.duration.textContent = "0:00";
  }

  updateProgressFromPointer(event) {
    const bounds = this.progress.getBoundingClientRect();
    if (!bounds.width) return;

    const value = ((event.clientX - bounds.left) / bounds.width) * 100;
    this.setProgressValue(value);
    this.updateTimeFromProgress();
  }

  commitProgress() {
    if (Number.isFinite(this.audio.duration)) {
      this.audio.currentTime =
        (this.getProgressValue() / 100) * this.audio.duration;
    }
    this.isSeeking = false;
  }

  setProgressValue(value) {
    const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
    this.progress.dataset.value = String(safeValue);
    this.progress.style.setProperty("--heist-fm-progress", `${safeValue}%`);
    this.progress.setAttribute("aria-valuenow", String(Math.round(safeValue)));
  }

  getProgressValue() {
    return Number(this.progress.dataset.value) || 0;
  }

  setStatus(message) {
    if (this.status) this.status.textContent = message;
  }

  formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = Math.floor(safeSeconds % 60);
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }
}

const header = document.querySelector("[data-heist-header]");
const stickyCta = document.querySelector("[data-heist-sticky-cta]");
const pageWrapper = document.querySelector(".page-wrapper");
const scrollCaptureSection = header?.classList.contains("heist-header--home")
  ? document.querySelector(".heist-scroll-capture-section")
  : null;

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
    const beyondScrollCapture =
      !window.matchMedia("(min-width: 990px)").matches ||
      !scrollCaptureSection ||
      scrollCaptureSection.getBoundingClientRect().bottom <= 0;

    if (!beyondHeader) {
      header.classList.remove("is-pinned", "is-hidden");
      stickyCta?.classList.remove("is-visible");
      stickyCta?.setAttribute("aria-hidden", "true");
    } else if (delta > 3) {
      header.classList.remove("is-pinned");
      header.classList.add("is-hidden");
      stickyCta?.classList.add("is-visible");
      stickyCta?.setAttribute("aria-hidden", "false");
    } else if (delta < -3) {
      header.classList.add("is-pinned");
      header.classList.remove("is-hidden");
      stickyCta?.classList.remove("is-visible");
      stickyCta?.setAttribute("aria-hidden", "true");
    }

    if (!beyondScrollCapture) {
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
