/**
 * Locks background scrolling while the cart drawer is open.
 *
 * Uses lenis' `isLocked` rather than `stop()`: `stop()` applies
 * `.lenis-stopped { overflow: hidden }` to the scroll container, which resets it
 * to the top (the visible jump). `isLocked` instead preventDefaults wheel/touch
 * in place — no overflow change, no jump — and only adds a harmless
 * `lenis-locked` class. Nested scroll (the drawer's own scroll area) still works
 * because lenis runs with `allowNestedScroll: true`.
 *
 * Scoped to the cart drawer only: `theme-drawer:open` / `theme-drawer:close`
 * bubble from each drawer's <theme-drawer>, so we match on the target id.
 */

const CART_DRAWER_ID = "cart-drawer";
const OPEN_ON_LOAD_FLAG = "heist:open-cart-drawer";

/** @param {Event} event */
function isCartDrawerEvent(event) {
  return event.target instanceof Element && event.target.id === CART_DRAWER_ID;
}

/**
 * The /cart page redirects home with a sessionStorage flag (see the redirect in
 * layout/theme.liquid). If that flag is set, open the cart drawer on this load.
 * Returns true when it handled the open so the caller can skip the close.
 */
function openCartDrawerAfterRedirect() {
  let flagged = false;
  try {
    flagged = sessionStorage.getItem(OPEN_ON_LOAD_FLAG) === "1";
    if (flagged) sessionStorage.removeItem(OPEN_ON_LOAD_FLAG);
  } catch {
    return false;
  }
  if (!flagged) return false;

  const open = () => {
    const drawer = document.getElementById(CART_DRAWER_ID);
    if (drawer && typeof drawer.open === "function") {
      drawer.open();
    } else {
      // Fallback: trigger the header cart button.
      document.querySelector('[aria-controls="cart-drawer"]')?.click();
    }
  };

  // <theme-drawer> may not be upgraded yet on load; wait for its definition.
  if (window.customElements?.whenDefined) {
    customElements
      .whenDefined("theme-drawer")
      .then(() => requestAnimationFrame(open));
  } else {
    open();
  }

  return true;
}

/**
 * The theme-drawer session restore re-opens the cart drawer on load. Force it
 * closed so a fresh page always starts with the drawer shut.
 */
function closeCartDrawerOnLoad() {
  const drawer = document.getElementById(CART_DRAWER_ID);
  if (!drawer || !drawer.hasAttribute("open")) {
    return;
  }

  const close = () => {
    if (typeof drawer.close === "function") {
      drawer.close();
    } else {
      drawer.removeAttribute("open");
    }
  };

  // <theme-drawer> may not be upgraded yet on load, so wait for its definition.
  if (window.customElements?.whenDefined) {
    customElements.whenDefined("theme-drawer").then(close);
  } else {
    close();
  }
}

export function initCartDrawerScrollLock() {
  if (typeof window === "undefined") {
    return;
  }

  // Open the drawer if we just landed here from a /cart redirect; otherwise
  // make sure a restored-open drawer starts closed.
  if (!openCartDrawerAfterRedirect()) {
    closeCartDrawerOnLoad();
  }

  document.addEventListener("theme-drawer:open", (event) => {
    if (isCartDrawerEvent(event) && window.lenis) {
      window.lenis.reset();
      window.lenis.isLocked = true;
    }
  });

  document.addEventListener("theme-drawer:close", (event) => {
    if (isCartDrawerEvent(event) && window.lenis) {
      window.lenis.isLocked = false;
    }
  });
}
