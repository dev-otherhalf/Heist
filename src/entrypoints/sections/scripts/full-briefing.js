const DURATION = 300;
const EASING = "ease";

const running = new WeakMap();

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Current rendered height, mid-animation or not. */
function currentHeight(panel) {
  return panel.getBoundingClientRect().height;
}

function slide(faq, panel, from, to, onFinish) {
  panel.style.overflow = "hidden";

  const animation = panel.animate(
    { height: [`${from}px`, `${to}px`] },
    { duration: DURATION, easing: EASING },
  );
  running.set(faq, animation);

  const cleanup = () => panel.style.removeProperty("overflow");

  animation.oncancel = cleanup;
  animation.onfinish = () => {
    cleanup();
    running.delete(faq);
    onFinish?.();
  };
}

function openFaq(faq, panel) {
  faq.classList.add("is-open");

  const from = faq.open ? currentHeight(panel) : 0;
  running.get(faq)?.cancel();

  faq.open = true;
  if (prefersReducedMotion()) return;

  slide(faq, panel, from, currentHeight(panel));
}

function closeFaq(faq, panel) {
  if (!faq.open) return;
  faq.classList.remove("is-open");

  const from = currentHeight(panel);
  running.get(faq)?.cancel();

  if (prefersReducedMotion()) {
    faq.open = false;
    return;
  }

  slide(faq, panel, from, 0, () => (faq.open = false));
}

function registerFaqs(group) {
  if (group.dataset.fullBriefingReady === "true") return;
  group.dataset.fullBriefingReady = "true";

  const faqs = [...group.querySelectorAll(".full-briefing__faq")];

  for (const faq of faqs) {
    const summary = faq.querySelector(".full-briefing__q");
    const panel = faq.querySelector(".full-briefing__a");
    if (!summary || !panel) continue;

    faq.removeAttribute("name");

    if (faq.open) faq.classList.add("is-open");

    summary.addEventListener("click", (event) => {
      event.preventDefault();

      if (faq.open && faq.classList.contains("is-open")) {
        closeFaq(faq, panel);
        return;
      }

      for (const other of faqs) {
        if (other === faq) continue;
        closeFaq(other, other.querySelector(".full-briefing__a"));
      }

      openFaq(faq, panel);
    });
  }
}

function registerShowMore(button) {
  if (button.dataset.fullBriefingReady === "true") return;
  button.dataset.fullBriefingReady = "true";

  button.addEventListener("click", (event) => {
    const group = button
      .closest(".full-briefing__content")
      ?.querySelector(".full-briefing__faqs");
    const extraFaqs =
      group?.querySelectorAll("[data-full-briefing-faq-extra]") ?? [];

    if (extraFaqs.length === 0) return;

    event.preventDefault();
    extraFaqs.forEach((faq) => {
      faq.removeAttribute("hidden");
      faq.removeAttribute("data-full-briefing-faq-extra");
    });
  });
}

function initFullBriefing(scope = document) {
  scope.querySelectorAll(".full-briefing__faqs").forEach(registerFaqs);
  scope
    .querySelectorAll("[data-full-briefing-faqs-more]")
    .forEach(registerShowMore);
}

document.addEventListener("DOMContentLoaded", () => initFullBriefing());
document.addEventListener("shopify:section:load", (event) =>
  initFullBriefing(event.target),
);
