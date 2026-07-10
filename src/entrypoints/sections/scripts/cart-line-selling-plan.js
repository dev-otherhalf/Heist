/**
 * <cart-line-selling-plan> — switch a cart line between a one-time purchase and
 * any of its product's non-prepaid selling plans, without leaving the cart.
 *
 * Wraps either a "Subscribe & save" button (one-time line, applies the plan id in
 * `data-selling-plan`) or a plan dropdown (subscription line). Both go through
 * the same request; the response morph swaps one control for the other.
 *
 * The re-render is delegated rather than done here: resolving the
 * CartLinesUpdateEvent promise with the section HTML lets every
 * <cart-items-component> on the page morph itself, exactly as it does for a
 * quantity change. Both the drawer and the cart page can be mounted at once
 * (squeeze mode), so every cart section is requested and handed back.
 *
 * Mirrors buy-box.js: the Shopify standard-events module is an importmap alias
 * resolved only at runtime, so it can't be a static import in a Vite-bundled
 * entry. It's loaded lazily from the same CDN URL the importmap uses; if that
 * ever fails the plan change still applies, the cart just won't re-render.
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
        console.warn("[cart-line-plan] standard events unavailable:", error);
        return null;
      },
    );
  }
  return eventsModulePromise;
}

// Theme.routes.cart_change_url already carries the `.js` suffix (see scripts.liquid).
const CART_CHANGE_URL = () =>
  window.Theme?.routes?.cart_change_url || "/cart/change.js";

class CartLineSellingPlan extends HTMLElement {
  connectedCallback() {
    this.#select?.addEventListener("change", this.#onChange);
    this.#cta?.addEventListener("click", this.#onSubscribeClick);
  }

  disconnectedCallback() {
    this.#select?.removeEventListener("change", this.#onChange);
    this.#cta?.removeEventListener("click", this.#onSubscribeClick);
  }

  /** @returns {HTMLSelectElement | null} */
  get #select() {
    return this.querySelector("select");
  }

  /** The "Subscribe & save" button rendered while the line is a one-time purchase. */
  get #cta() {
    return this.querySelector("[data-selling-plan]");
  }

  /** Every mounted cart section needs the fresh HTML to morph into. */
  #sectionIds() {
    return Array.from(
      document.querySelectorAll("cart-items-component"),
      (element) => element.dataset.sectionId,
    ).filter(Boolean);
  }

  #onChange = () => {
    const select = this.#select;
    if (select) this.#applyPlan(select.value, select);
  };

  #onSubscribeClick = () => {
    const cta = this.#cta;
    const sellingPlan = cta?.dataset.sellingPlan;
    if (cta && sellingPlan) this.#applyPlan(sellingPlan, cta);
  };

  /**
   * Moves this line onto `sellingPlan` — an empty string clears the plan,
   * turning the line back into a one-time purchase.
   *
   * @param {string} sellingPlan - The selling plan id to apply.
   * @param {HTMLSelectElement | HTMLElement} control - The control to disable while in flight.
   */
  #applyPlan = async (sellingPlan, control) => {
    const quantity = Number(this.dataset.quantity) || 1;
    control.setAttribute("disabled", "");

    const events = await loadStandardEvents();
    const CartLinesUpdateEvent = events?.CartLinesUpdateEvent;

    let deferred;
    if (CartLinesUpdateEvent) {
      deferred = CartLinesUpdateEvent.createPromise();
      this.dispatchEvent(
        new CartLinesUpdateEvent({
          action: "update",
          context: "cart",
          lines: [{ id: this.dataset.key ?? "", quantity }],
          promise: deferred.promise,
        }),
      );
    }

    try {
      const response = await fetch(CART_CHANGE_URL(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          line: Number(this.dataset.line),
          quantity,
          selling_plan: sellingPlan,
          sections: this.#sectionIds().join(","),
          sections_url: window.location.pathname,
        }),
      });

      const cart = await response.json();
      if (cart.errors) throw new Error(cart.errors);

      deferred?.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
        detail: {
          sections: cart.sections,
          items: cart.items,
          itemCount: cart.item_count,
          source: "cart-line-selling-plan",
          didError: false,
        },
      });
    } catch (error) {
      console.error("[cart-line-plan] failed to change plan:", error);
      deferred?.reject(error);
      if (control instanceof HTMLSelectElement) {
        control.value = control.dataset.selected ?? "";
      }

      const CartErrorEvent = events?.CartErrorEvent;
      if (CartErrorEvent) {
        this.dispatchEvent(
          new CartErrorEvent({
            error: error?.message || "Failed to update the delivery plan",
            code: "INVALID",
          }),
        );
      }
    } finally {
      // A successful morph replaces this element; re-enabling only matters when
      // the request failed and the original control is still mounted.
      control.removeAttribute("disabled");
    }
  };
}

if (!customElements.get("cart-line-selling-plan")) {
  customElements.define("cart-line-selling-plan", CartLineSellingPlan);
}
