/**
 * <cart-upgrade-banner> — moves every eligible cart line onto its prepaid plan.
 *
 * Lines are addressed by their line-item **key**, not their index. Two lines of
 * the same variant can merge once both are prepaid, which would shift every index
 * after them; keys are stable for the lines we haven't touched yet.
 *
 * The changes run one at a time — /cart/change.js has no bulk form that accepts a
 * selling plan — and only the last request asks for the section HTML, so the cart
 * re-renders once, at the end. The re-rendered cart has no eligible lines left, so
 * this banner removes itself.
 *
 * Mirrors buy-box.js: the Shopify standard-events module is an importmap alias
 * resolved only at runtime, so it can't be a static import in a Vite-bundled entry.
 */

// Same URL as the "@shopify/events" importmap entry (see snippets/scripts.liquid).
// Held in a variable + @vite-ignore so Vite leaves the dynamic import untouched.
const STANDARD_EVENTS_URL =
  "https://cdn.shopify.com/storefront/standard-events.js";

let eventsModulePromise;
function loadStandardEvents() {
  if (!eventsModulePromise) {
    eventsModulePromise = import(/* @vite-ignore */ STANDARD_EVENTS_URL).catch(
      (error) => {
        console.warn("[cart-upgrade] standard events unavailable:", error);
        return null;
      },
    );
  }
  return eventsModulePromise;
}

// Theme.routes.cart_change_url already carries the `.js` suffix (see scripts.liquid).
const CART_CHANGE_URL = () =>
  window.Theme?.routes?.cart_change_url || "/cart/change.js";

class CartUpgradeBanner extends HTMLElement {
  connectedCallback() {
    this.#button?.addEventListener("click", this.#onUpgrade);
  }

  disconnectedCallback() {
    this.#button?.removeEventListener("click", this.#onUpgrade);
  }

  get #button() {
    return this.querySelector("[data-upgrade-button]");
  }

  /** @returns {{key: string, quantity: number, sellingPlan: number}[]} */
  #lines() {
    const island = this.querySelector("[data-upgrade-lines]");
    if (!island?.textContent) return [];
    try {
      return JSON.parse(island.textContent);
    } catch (error) {
      console.warn("[cart-upgrade] failed to parse lines:", error);
      return [];
    }
  }

  /** Every mounted cart section needs the fresh HTML to morph into. */
  #sectionIds() {
    return Array.from(
      document.querySelectorAll("cart-items-component"),
      (element) => element.dataset.sectionId,
    ).filter(Boolean);
  }

  /**
   * @param {{key: string, quantity: number, sellingPlan: number}} line
   * @param {boolean} withSections - Ask for section HTML (only worth it on the last change).
   */
  async #changeLine(line, withSections) {
    const body = {
      id: line.key,
      quantity: line.quantity,
      selling_plan: line.sellingPlan,
    };

    if (withSections) {
      body.sections = this.#sectionIds().join(",");
      body.sections_url = window.location.pathname;
    }

    const response = await fetch(CART_CHANGE_URL(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });

    const cart = await response.json();
    if (cart.errors || cart.status) {
      throw new Error(cart.errors || cart.message || "Cart update failed");
    }
    return cart;
  }

  #onUpgrade = async () => {
    const lines = this.#lines();
    if (!lines.length) return;

    const button = this.#button;
    button?.setAttribute("disabled", "");

    const events = await loadStandardEvents();
    const CartLinesUpdateEvent = events?.CartLinesUpdateEvent;

    let deferred;
    if (CartLinesUpdateEvent) {
      deferred = CartLinesUpdateEvent.createPromise();
      this.dispatchEvent(
        new CartLinesUpdateEvent({
          action: "update",
          context: "cart",
          lines: lines.map(({ key, quantity }) => ({ id: key, quantity })),
          promise: deferred.promise,
        }),
      );
    }

    try {
      let cart;
      for (const [index, line] of lines.entries()) {
        cart = await this.#changeLine(line, index === lines.length - 1);
      }

      deferred?.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          sections: cart.sections,
          items: cart.items,
          itemCount: cart.item_count,
          source: "cart-upgrade-banner",
          didError: false,
        },
      });
    } catch (error) {
      console.error("[cart-upgrade] failed to upgrade cart:", error);
      deferred?.reject(error);
      button?.removeAttribute("disabled");

      const CartErrorEvent = events?.CartErrorEvent;
      if (CartErrorEvent) {
        this.dispatchEvent(
          new CartErrorEvent({
            error: error?.message || "Failed to upgrade the cart",
            code: "INVALID",
          }),
        );
      }
    }
    // On success the morph removes this banner, so the button is never re-enabled.
  };
}

if (!customElements.get("cart-upgrade-banner")) {
  customElements.define("cart-upgrade-banner", CartUpgradeBanner);
}
