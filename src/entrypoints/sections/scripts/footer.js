class AudioPlayer {
  constructor(root) {
    if (!root || root.dataset.audioPlayerReady === "true") return;

    this.root = root;
    this.root.dataset.audioPlayerReady = "true";
    this.audio = root.querySelector("[data-audio-element]");
    this.tracksScript = root.querySelector("[data-audio-tracks]");
    this.covers = [...root.querySelectorAll("[data-audio-cover]")];
    this.placeholder = root.querySelector("[data-audio-placeholder]");
    this.title = root.querySelector("[data-audio-title]");
    this.detail = root.querySelector("[data-audio-detail]");
    this.appleLink = root.querySelector("[data-audio-apple-link]");
    this.spotifyLink = root.querySelector("[data-audio-spotify-link]");
    this.status = root.querySelector("[data-audio-status]");
    this.progress = root.querySelector("[data-audio-progress]");
    this.currentTime = root.querySelector("[data-audio-current-time]");
    this.duration = root.querySelector("[data-audio-duration]");
    this.playIcon = root.querySelector("[data-audio-play-icon]");
    this.currentIndex = 0;
    this.isSeeking = false;
    this.isShuffle = false;
    this.isLoop = false;
    this.footerRoot = root.closest("[data-footer-root]");
    this.audioBlock = root.closest(".footer__audio");
    this.resizeObserver = null;
    this.handleViewportResize = () => this.updateFooterAudioOffset();
    this.tracks = this.getTracks();

    this.setupStickyAudio();

    if (!this.audio || !this.tracks.length) {
      this.root.classList.add("footer__audio-player-card--empty");
      this.setStatus("Add an MP3 file name or URL to an audio block.");
      return;
    }

    this.bindEvents();
    this.loadTrack(0, false);
  }

  getTracks() {
    if (!this.tracksScript) return [];

    try {
      return JSON.parse(this.tracksScript.textContent || "[]").filter(
        (track) => track?.audio?.trim() !== "",
      );
    } catch (error) {
      console.error("Audio player: Invalid track JSON", error);
      return [];
    }
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
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleViewportResize);
    window.removeEventListener("load", this.handleViewportResize);
    this.footerRoot?.style.removeProperty("--footer-audio-height");

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }

    this.root.dataset.audioPlayerReady = "false";
    delete this.root.audioPlayerInstance;
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-audio-action]");
      if (!button) return;

      const action = button.dataset.audioAction;

      if (action === "toggle") this.togglePlay();
      if (action === "next") this.nextTrack(true);
      if (action === "previous") this.previousTrack(true);

      if (action === "shuffle") {
        this.isShuffle = !this.isShuffle;
        button.classList.toggle(
          "footer__audio-player-control--active",
          this.isShuffle,
        );
        button.setAttribute("aria-pressed", String(this.isShuffle));
        this.setStatus(this.isShuffle ? "Shuffle on." : "Shuffle off.");
      }

      if (action === "loop") {
        this.isLoop = !this.isLoop;
        this.audio.loop = this.isLoop;
        button.classList.toggle(
          "footer__audio-player-control--active",
          this.isLoop,
        );
        button.setAttribute("aria-pressed", String(this.isLoop));
        this.setStatus(this.isLoop ? "Loop on." : "Loop off.");
      }
    });

    this.progress.addEventListener("input", () => {
      this.isSeeking = true;
      this.updateProgressFill();
      this.updateTimeFromProgress();
    });

    this.progress.addEventListener("change", () => {
      if (Number.isFinite(this.audio.duration)) {
        this.audio.currentTime =
          (Number(this.progress.value) / 100) * this.audio.duration;
      }
      this.isSeeking = false;
    });

    this.audio.addEventListener("loadedmetadata", () => {
      this.updateProgress();
      this.updateDuration();
    });

    this.audio.addEventListener("timeupdate", () => {
      if (!this.isSeeking) this.updateProgress();
    });

    this.audio.addEventListener("play", () => {
      this.root.classList.add("footer__audio-player-card--playing");
      this.playIcon.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15.9999 0C20.2395 0.0123994 24.3018 1.7023 27.2997 4.7002C30.2976 7.69809 31.9875 11.7603 31.9999 16C31.9999 19.1643 31.0615 22.2576 29.3036 24.8887C27.5455 27.5198 25.0465 29.5712 22.1229 30.7822C19.1994 31.9932 15.9824 32.3097 12.8788 31.6924C9.77508 31.075 6.92403 29.5511 4.68639 27.3135C2.44875 25.0758 0.924848 22.2248 0.307485 19.1211C-0.309798 16.0175 0.00667835 12.8005 1.21764 9.87695C2.42865 6.95335 4.48002 4.45438 7.1112 2.69629C9.74229 0.93836 12.8355 1.50818e-06 15.9999 0ZM10.9999 9C10.4476 9 9.99987 9.44772 9.99987 10V22C9.99987 22.5523 10.4476 23 10.9999 23H12.9999C13.5522 23 13.9999 22.5523 13.9999 22V10C13.9999 9.44772 13.5522 9 12.9999 9H10.9999ZM18.9999 9C18.4476 9 17.9999 9.44772 17.9999 10V22C17.9999 22.5523 18.4476 23 18.9999 23H20.9999C21.5522 23 21.9999 22.5523 21.9999 22V10C21.9999 9.44772 21.5522 9 20.9999 9H18.9999Z" fill="#161414"/>
</svg>`;
      this.playIcon
        .closest("button")
        ?.setAttribute("aria-label", "Pause audio");
    });

    this.audio.addEventListener("pause", () => {
      this.root.classList.remove("footer__audio-player-card--playing");
      this.playIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_4676_9925)">
<path d="M24 0C19.2533 0 14.6131 1.40758 10.6663 4.04473C6.71955 6.68188 3.6434 10.4302 1.8269 14.8156C0.0103987 19.201 -0.464881 24.0266 0.461164 28.6822C1.38721 33.3377 3.67299 37.6141 7.02945 40.9706C10.3859 44.327 14.6623 46.6128 19.3178 47.5388C23.9734 48.4649 28.799 47.9896 33.1844 46.1731C37.5698 44.3566 41.3181 41.2805 43.9553 37.3337C46.5924 33.3869 48 28.7468 48 24C47.9814 17.6405 45.4469 11.5468 40.95 7.04998C36.4532 2.55314 30.3595 0.0185991 24 0ZM33.9 25.2L21.9 34.2C21.6264 34.3663 21.3187 34.4689 21 34.5C20.7 34.5 20.55 34.5 20.4 34.35C20.1318 34.2413 19.9026 34.0544 19.742 33.8136C19.5815 33.5729 19.4972 33.2894 19.5 33V15C19.4972 14.7106 19.5815 14.4271 19.742 14.1864C19.9026 13.9456 20.1318 13.7587 20.4 13.65C20.6377 13.5268 20.906 13.4755 21.1723 13.5021C21.4386 13.5287 21.6915 13.6322 21.9 13.8L33.9 22.8C34.0863 22.9397 34.2375 23.1209 34.3417 23.3292C34.4458 23.5375 34.5 23.7671 34.5 24C34.5 24.2329 34.4458 24.4625 34.3417 24.6708C34.2375 24.8791 34.0863 25.0603 33.9 25.2Z" fill="#161414"/>
</g>
<defs>
<clipPath id="clip0_4676_9925">
<rect width="48" height="48" fill="white"/>
</clipPath>
</defs>
</svg>
`;
      this.playIcon.closest("button")?.setAttribute("aria-label", "Play audio");
    });

    this.audio.addEventListener("ended", () => {
      if (!this.isLoop) this.nextTrack(true);
    });

    this.audio.addEventListener("error", () => {
      this.setStatus("Audio could not load. Check the MP3 file name or URL.");
      this.root.classList.remove("footer__audio-player-card--playing");
      this.playIcon.innerHTML = `<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
<g clip-path="url(#clip0_4676_9925)">
<path d="M24 0C19.2533 0 14.6131 1.40758 10.6663 4.04473C6.71955 6.68188 3.6434 10.4302 1.8269 14.8156C0.0103987 19.201 -0.464881 24.0266 0.461164 28.6822C1.38721 33.3377 3.67299 37.6141 7.02945 40.9706C10.3859 44.327 14.6623 46.6128 19.3178 47.5388C23.9734 48.4649 28.799 47.9896 33.1844 46.1731C37.5698 44.3566 41.3181 41.2805 43.9553 37.3337C46.5924 33.3869 48 28.7468 48 24C47.9814 17.6405 45.4469 11.5468 40.95 7.04998C36.4532 2.55314 30.3595 0.0185991 24 0ZM33.9 25.2L21.9 34.2C21.6264 34.3663 21.3187 34.4689 21 34.5C20.7 34.5 20.55 34.5 20.4 34.35C20.1318 34.2413 19.9026 34.0544 19.742 33.8136C19.5815 33.5729 19.4972 33.2894 19.5 33V15C19.4972 14.7106 19.5815 14.4271 19.742 14.1864C19.9026 13.9456 20.1318 13.7587 20.4 13.65C20.6377 13.5268 20.906 13.4755 21.1723 13.5021C21.4386 13.5287 21.6915 13.6322 21.9 13.8L33.9 22.8C34.0863 22.9397 34.2375 23.1209 34.3417 23.3292C34.4458 23.5375 34.5 23.7671 34.5 24C34.5 24.2329 34.4458 24.4625 34.3417 24.6708C34.2375 24.8791 34.0863 25.0603 33.9 25.2Z" fill="#161414"/>
</g>
<defs>
<clipPath id="clip0_4676_9925">
<rect width="48" height="48" fill="white"/>
</clipPath>
</defs>
</svg>
`;
    });
  }

  loadTrack(index, shouldPlay) {
    if (!this.tracks.length) return;

    this.currentIndex = this.normalizeIndex(index);
    const track = this.tracks[this.currentIndex];

    this.audio.src = track.audio;
    this.audio.load();
    this.updateTrackUI(track);
    this.resetProgress();

    if (shouldPlay) this.play();
  }

  updateTrackUI(track) {
    const title = track.title || "Untitled track";
    const detail = track.detail || "";

    this.title.textContent = title;
    this.detail.textContent = detail;
    this.detail.hidden = detail === "";
    this.updateMusicLink(this.appleLink, track.appleMusicUrl);
    this.updateMusicLink(this.spotifyLink, track.spotifyUrl);

    const activeCover = this.covers.find(
      (cover) => Number(cover.dataset.audioCoverIndex) === track.blockIndex,
    );

    this.covers.forEach((cover) => {
      cover.classList.toggle(
        "footer__audio-player-cover--visible",
        cover === activeCover,
      );
    });

    this.placeholder.classList.toggle(
      "footer__audio-player-cover-placeholder--hidden",
      Boolean(activeCover),
    );

    this.setStatus(`Now loaded: ${title}`);
  }

  updateMusicLink(link, url) {
    if (!link) return;

    const hasUrl = typeof url === "string" && url.trim() !== "";
    link.hidden = !hasUrl;

    if (hasUrl) link.href = url;
    else link.removeAttribute("href");
  }

  togglePlay() {
    if (this.audio.paused) this.play();
    else this.audio.pause();
  }

  play() {
    const playPromise = this.audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.setStatus("Click play again if the browser blocked audio.");
      });
    }
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

  updateProgress() {
    if (!Number.isFinite(this.audio.duration)) return;
    this.progress.value = (this.audio.currentTime / this.audio.duration) * 100;
    this.updateProgressFill();
    if (this.currentTime) {
      this.currentTime.textContent = this.formatTime(this.audio.currentTime);
    }
  }

  updateDuration() {
    if (this.duration) {
      this.duration.textContent = this.formatTime(this.audio.duration);
    }
  }

  updateTimeFromProgress() {
    if (!Number.isFinite(this.audio.duration)) return;
    const previewTime =
      (Number(this.progress.value) / 100) * this.audio.duration;
    if (this.currentTime) {
      this.currentTime.textContent = this.formatTime(previewTime);
    }
  }

  updateProgressFill() {
    const progressValue = Math.min(
      100,
      Math.max(0, Number(this.progress.value) || 0),
    );
    this.progress.style.setProperty("--audio-progress", `${progressValue}%`);
  }

  resetProgress() {
    this.progress.value = 0;
    this.updateProgressFill();
    if (this.currentTime) this.currentTime.textContent = "0:00";
    if (this.duration) this.duration.textContent = "0:00";
  }

  setStatus(message) {
    if (this.status) this.status.textContent = message;
  }

  formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}

function initAudioPlayers(scope = document) {
  scope.querySelectorAll("[data-audio-player]").forEach((player) => {
    if (player.dataset.audioPlayerReady !== "true") {
      player.audioPlayerInstance = new AudioPlayer(player);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => initAudioPlayers());

document.addEventListener("shopify:section:load", (event) => {
  initAudioPlayers(event.target);
});

document.addEventListener("shopify:section:unload", (event) => {
  event.target.querySelectorAll("[data-audio-player]").forEach((player) => {
    player.audioPlayerInstance?.destroy();
  });
});
