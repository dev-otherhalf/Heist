const SECTION_SELECTOR = ".page-faq";
const READY_ATTR = "data-page-faq-ready";

function revealFromHash(section, hash, shouldScroll) {
  if (!hash || hash.length < 2) return;

  let target;
  try {
    target = section.querySelector(hash);
  } catch (error) {
    return;
  }
  if (!target) return;

  const details =
    target.tagName === "DETAILS" ? target : target.closest("details");
  if (details) details.open = true;

  if (shouldScroll) {
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
}

function mount(section) {
  if (section.getAttribute(READY_ATTR) === "true") return;
  section.setAttribute(READY_ATTR, "true");

  revealFromHash(section, window.location.hash, true);

  section.querySelectorAll(".faq-item").forEach((details) => {
    details.addEventListener("toggle", () => {
      if (!details.open || !details.id) return;
      if (window.history?.replaceState) {
        window.history.replaceState(null, "", `#${details.id}`);
      }
    });
  });
}

function mountAll(root = document) {
  root.querySelectorAll(SECTION_SELECTOR).forEach(mount);
}

mountAll();

window.addEventListener("hashchange", () => {
  document.querySelectorAll(SECTION_SELECTOR).forEach((section) => {
    revealFromHash(section, window.location.hash, true);
  });
});

document.addEventListener("shopify:section:load", (event) => {
  mountAll(event.target);
});
