const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPointerPosition(event) {
  return {
    x:
      event.clientX ||
      (event.touches && event.touches[0] && event.touches[0].clientX) ||
      window.innerWidth / 2,
    y:
      event.clientY ||
      (event.touches && event.touches[0] && event.touches[0].clientY) ||
      window.innerHeight / 2,
  };
}

function bindSpotlight(overlay, backdrop) {
  const panel = overlay.querySelector(".site-lock__panel");
  let overPanel = false;
  let rafId = null;
  let pendingX = window.innerWidth / 2;
  let pendingY = window.innerHeight / 2;

  const getMobileBreakpoint = () => window.matchMedia("(max-width: 46.865rem)");

  const getRadius = () => getMobileBreakpoint().matches ? 122 : 214;

  backdrop.style.setProperty("--spotlight-r", `${getRadius()}px`);

  getMobileBreakpoint().addEventListener("change", () => {
    backdrop.style.setProperty("--spotlight-r", `${getRadius()}px`);
  });

  if (panel) {
    panel.addEventListener("mouseenter", () => { overPanel = true; }, { passive: true });
    panel.addEventListener("mouseleave", () => { overPanel = false; }, { passive: true });
  }

  const applyPosition = () => {
    backdrop.style.setProperty("--mouseX", `${pendingX}px`);
    backdrop.style.setProperty("--mouseY", `${pendingY}px`);
    rafId = null;
  };

  const updateMouse = (event) => {
    if (overPanel) return;

    const { x, y } = getPointerPosition(event);
    pendingX = x;
    pendingY = y;

    if (!rafId) {
      rafId = requestAnimationFrame(applyPosition);
    }
  };

  window.addEventListener("mousemove", updateMouse, { passive: true });
  window.addEventListener("touchmove", updateMouse, { passive: true });
  applyPosition();
}

function bindSiteLockForm(form) {
  if (form.dataset.siteLockBound === "true") {
    return;
  }

  form.dataset.siteLockBound = "true";

  const input = form.querySelector(".site-lock__input");
  const button = form.querySelector(".site-lock__submit");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (form.dataset.siteLockSubmitting === "true") {
      return;
    }

    const email = (input?.value || "").trim();
    if (!email || !EMAIL_PATTERN.test(email)) {
      input?.focus();
      return;
    }

    const publicApiKey = form.getAttribute("data-klaviyo-public-api-key") || "";
    const listId = form.getAttribute("data-klaviyo-list-id") || "";
    if (!publicApiKey) {
      return;
    }

    form.dataset.siteLockSubmitting = "true";
    if (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      button.setAttribute("aria-label", "Submitting");
    }

    fetch(
      `https://a.klaviyo.com/client/subscriptions/?company_id=${encodeURIComponent(publicApiKey)}`,
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
    )
      .then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(text || "Unable to subscribe");
          });
        }
        return response;
      })
      .then(() => {
        if (input) {
          input.value = "";
        }
        if (button) {
          button.disabled = true;
          button.removeAttribute("aria-busy");
          button.setAttribute("aria-label", "Subscribed");
        }
        form.classList.add("is-subscribed");
      })
      .catch(() => {
        form.removeAttribute("data-site-lock-submitting");
        if (button) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
          button.setAttribute("aria-label", "Try again");
        }
      });
  });
}

export function initSiteLock() {
  const overlay = document.getElementById("site-lock-overlay");
  if (!overlay) {
    return;
  }

  try {
    document.body.classList.add("has-site-lock");

    const main = document.getElementById("MainContent");
    if (main) {
      main.setAttribute("aria-hidden", "true");
    }

    const panel = overlay.querySelector(".site-lock__panel");
    const focusable = panel?.querySelector("input,button,a,select,textarea");
    focusable?.focus();

    const form = overlay.querySelector("[data-site-lock-form]");
    if (form instanceof HTMLFormElement) {
      bindSiteLockForm(form);
    }

    const backdrop = overlay.querySelector(".site-lock__backdrop");
    if (backdrop) {
      bindSpotlight(overlay, backdrop);
    }
  } catch {
  }
}
