// =============================================================================
// Site-wide viewport video autoplay.
// Any <video class="js-autoplay-video"> plays while it is on screen and pauses
// when it scrolls out, via a single shared IntersectionObserver. Videos must be
// muted (browser autoplay policy) — we enforce `muted` + `playsinline` on
// register so playback isn't blocked. Handles Shopify section reloads and
// nodes added later (theme editor, lazy content).
// =============================================================================

const SELECTOR = "video.js-autoplay-video";

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      const video = /** @type {HTMLVideoElement} */ (entry.target);

      if (entry.isIntersecting) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  },
  { threshold: 0.25 },
);

const registered = new WeakSet();

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

    observer.observe(video);
  }
}

export function initViewportVideoAutoplay() {
  register();

  document.addEventListener("shopify:section:load", (event) => {
    register(event.target);
  });

  document.addEventListener("shopify:section:unload", (event) => {
    for (const video of event.target.querySelectorAll(SELECTOR)) {
      observer.unobserve(video);
      registered.delete(video);
    }
  });
}
