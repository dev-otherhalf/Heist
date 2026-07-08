// =============================================================================
// Site-wide viewport video autoplay + lazy loading.
// Any <video class="js-autoplay-video"> is deferred (preload="none") on initial
// load, starts fetching shortly before it scrolls into view, then plays while
// on screen and pauses when it scrolls out — all via two shared
// IntersectionObservers. This stops the browser from downloading every video on
// the page up front. Videos must be muted (browser autoplay policy) — we
// enforce `muted` + `playsinline` on register so playback isn't blocked.
// Handles Shopify section reloads and nodes added later (theme editor, lazy
// content).
// =============================================================================

const SELECTOR = "video.js-autoplay-video";

const registered = new WeakSet();
const loaded = new WeakSet();

/**
 * Begin downloading a video (once). Videos ship with preload="none" so nothing
 * is fetched until this runs.
 *
 * @param {HTMLVideoElement} video
 */
function loadVideo(video) {
  if (loaded.has(video)) return;
  loaded.add(video);

  video.preload = "auto";
  video.load();
}

// Starts fetching a video ~300px before it enters the viewport, so playback is
// smooth without downloading everything on initial page load.
const loadObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      loadVideo(/** @type {HTMLVideoElement} */ (entry.target));
      loadObserver.unobserve(entry.target);
    }
  },
  { rootMargin: "300px 0px" },
);

// Plays a video while it is on screen, pauses it when it scrolls out.
const playObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = /** @type {HTMLVideoElement} */ (entry.target);

      if (entry.isIntersecting) {
        loadVideo(video);
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  },
  { threshold: 0.25 },
);

/**
 * Observe every not-yet-tracked autoplay video within `root`.
 *
 * @param {ParentNode} [root]
 */
function register(root = document) {
  for (const video of root.querySelectorAll(SELECTOR)) {
    if (registered.has(video)) continue;
    registered.add(video);

    // Required for unattended autoplay across browsers.
    video.muted = true;
    video.setAttribute("playsinline", "");
    video.removeAttribute("autoplay");
    // Defer the download until the video nears the viewport (loadObserver).
    video.preload = "none";

    loadObserver.observe(video);
    playObserver.observe(video);
  }
}

export function initViewportVideoAutoplay() {
  register();

  document.addEventListener("shopify:section:load", (event) => {
    register(event.target);
  });

  document.addEventListener("shopify:section:unload", (event) => {
    for (const video of event.target.querySelectorAll(SELECTOR)) {
      loadObserver.unobserve(video);
      playObserver.unobserve(video);
      registered.delete(video);
      loaded.delete(video);
    }
  });
}
