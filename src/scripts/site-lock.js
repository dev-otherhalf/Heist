const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPointerPosition(event, element) {
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const clientX = event.clientX ?? touch?.clientX;
  const clientY = event.clientY ?? touch?.clientY;
  const bounds = element.getBoundingClientRect();

  return {
    x:
      clientX === undefined
        ? bounds.width / 2
        : Math.max(0, Math.min(clientX - bounds.left, bounds.width)),
    y:
      clientY === undefined
        ? bounds.height / 2
        : Math.max(0, Math.min(clientY - bounds.top, bounds.height)),
  };
}

function bindSpotlight(overlay, backdrop) {
  const panel = overlay.querySelector(".site-lock__panel");
  let overPanel = false;
  let rafId = null;
  let pendingX = window.innerWidth / 2;
  let pendingY = window.innerHeight / 2;

  const getMobileBreakpoint = () => window.matchMedia("(max-width: 46.865rem)");

  const getRadius = () => (getMobileBreakpoint().matches ? 122 : 214);

  backdrop.style.setProperty("--spotlight-r", `${getRadius()}px`);

  getMobileBreakpoint().addEventListener("change", () => {
    backdrop.style.setProperty("--spotlight-r", `${getRadius()}px`);
  });

  const supportsHover = window.matchMedia(
    "(hover: hover) and (pointer: fine)",
  ).matches;

  if (panel && supportsHover) {
    panel.addEventListener(
      "mouseenter",
      () => {
        overPanel = true;
      },
      { passive: true },
    );
    panel.addEventListener(
      "mouseleave",
      () => {
        overPanel = false;
      },
      { passive: true },
    );
  }

  const applyPosition = () => {
    backdrop.style.setProperty("--mouseX", `${pendingX}px`);
    backdrop.style.setProperty("--mouseY", `${pendingY}px`);
    rafId = null;
  };

  const updateMouse = (event) => {
    if (overPanel) return;

    const { x, y } = getPointerPosition(event, backdrop);
    pendingX = x;
    pendingY = y;

    if (!rafId) {
      rafId = requestAnimationFrame(applyPosition);
    }
  };

  window.addEventListener("mousemove", updateMouse, { passive: true });
  overlay.addEventListener(
    "touchmove",
    (event) => {
      if (event.target.closest(".site-lock__field")) return;

      event.preventDefault();
      updateMouse(event);
    },
    { passive: false },
  );
  applyPosition();
}

function bindSiteLockForm(form, overlay) {
  if (form.dataset.siteLockBound === "true") {
    return;
  }

  form.dataset.siteLockBound = "true";

  const input = form.querySelector(".site-lock__input");
  const button = form.querySelector(".site-lock__submit");

  overlay.addEventListener(
    "touchstart",
    (event) => {
      if (event.target.closest(".site-lock__field")) return;

      event.preventDefault();

      if (input === document.activeElement) {
        input.blur();
      }
    },
    { capture: true, passive: false },
  );

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
        const field = form.querySelector("[data-site-lock-field]");
        const successMsg = form.querySelector("[data-site-lock-success]");

        if (input) {
          input.blur();
          input.value = "";
        }
        if (field) {
          field.hidden = true;
        }
        if (successMsg) {
          successMsg.hidden = false;
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
    const isTouchDevice =
      window.matchMedia("(pointer: coarse)").matches ||
      navigator.maxTouchPoints > 0;

    if (!isTouchDevice) {
      focusable?.focus();
    }

    const form = overlay.querySelector("[data-site-lock-form]");
    if (form instanceof HTMLFormElement) {
      bindSiteLockForm(form, overlay);
    }

    const backdrop = overlay.querySelector(".site-lock__backdrop");
    if (backdrop) {
      bindSpotlight(overlay, backdrop);
    }
  } catch {}
}
