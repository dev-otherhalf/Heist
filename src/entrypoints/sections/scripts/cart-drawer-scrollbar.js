/**
 * <cart-drawer-scrollbar> — the overlay scrollbar for the cart drawer's scroll
 * container, matching the brewing guide's drawer.
 *
 * It's a custom element rather than a JS-injected node because the drawer's
 * contents are replaced wholesale by the Section Rendering API morph. An
 * injected node would be morphed away (it isn't in the server HTML); an element
 * rendered by Liquid survives, and `connectedCallback` re-runs if it doesn't.
 *
 * Markup contract: the element sits inside `.cart-drawer__scroll-area` next to
 * `.cart-drawer__content`, and wraps a single `.cart-drawer__scrollbar-thumb`.
 * The scroll area is what bounds the track — the summary is a footer outside it,
 * so the track stops at the summary's top edge rather than running behind it.
 */

import { initCustomScrollbar } from "../../../scripts/custom-scrollbar";

class CartDrawerScrollbar extends HTMLElement {
  /** @type {(() => void) | undefined} */
  #teardown;

  connectedCallback() {
    const scroller = this.parentElement?.querySelector(".cart-drawer__content");
    const thumb = this.querySelector(".cart-drawer__scrollbar-thumb");

    if (!(scroller instanceof HTMLElement) || !(thumb instanceof HTMLElement)) {
      return;
    }

    this.#teardown = initCustomScrollbar({ scroller, track: this, thumb });
  }

  disconnectedCallback() {
    this.#teardown?.();
    this.#teardown = undefined;
  }
}

if (!customElements.get("cart-drawer-scrollbar")) {
  customElements.define("cart-drawer-scrollbar", CartDrawerScrollbar);
}
