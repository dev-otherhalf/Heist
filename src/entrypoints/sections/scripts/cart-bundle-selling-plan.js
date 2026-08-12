const STANDARD_EVENTS_URL =
  "https://cdn.shopify.com/storefront/standard-events.js";

let eventsModulePromise;
function loadStandardEvents() {
  if (!eventsModulePromise) {
    eventsModulePromise = import(/* @vite-ignore */ STANDARD_EVENTS_URL).catch(
      (error) => {
        console.warn("[cart-bundle-plan] standard events unavailable:", error);
        return null;
      },
    );
  }
  return eventsModulePromise;
}

const CART_CHANGE_URL = () =>
  window.Theme?.routes?.cart_change_url || "/cart/change.js";
const CART_URL = () => window.Theme?.routes?.cart_url || "/cart";

class CartBundleSellingPlan extends HTMLElement {
  connectedCallback() {
    this.#select?.addEventListener("change", this.#onChange);
  }

  disconnectedCallback() {
    this.#select?.removeEventListener("change", this.#onChange);
  }

  /** @returns {HTMLSelectElement | null} */
  get #select() {
    return this.querySelector("select");
  }

  /** @returns {Record<string, {key: string, quantity: number, plans: Record<string, number>}>} */
  get #planMap() {
    const script = this.querySelector("[data-bundle-plan-map]");
    if (!script) return {};
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.warn("[cart-bundle-plan] failed to parse plan map:", error);
      return {};
    }
  }

  #sectionIds() {
    return Array.from(
      document.querySelectorAll("cart-items-component"),
      (element) => element.dataset.sectionId,
    ).filter(Boolean);
  }

  #onChange = () => {
    const select = this.#select;
    if (select) this.#applyPlanToGroup(select.value, select);
  };

  /**
   * Finds a line's current 1-based position by its stable key. Needed
   * because a prior /cart/change.js call in this same batch can shift every
   * line after it.
   * @param {Array<{key: string}>} items - The cart's current `items` array.
   * @param {string} key
   * @returns {number | null}
   */
  #resolveLine(items, key) {
    const index = items.findIndex((item) => item.key === key);
    return index === -1 ? null : index + 1;
  }

  /**
   * Moves every line in the group onto the plan matching `planName`. A line
   * whose product has no allocation under that name is left as-is rather
   * than dropped to one-time purchase — the shared dropdown only lists names
   * every component actually offers, so this should not normally happen.
   * @param {string} planName - Lowercased selling-plan name to match.
   * @param {HTMLSelectElement} control
   */
  #applyPlanToGroup = async (planName, control) => {
    const planMap = this.#planMap;
    const targets = Object.values(planMap).filter(
      (entry) => entry.plans?.[planName],
    );
    if (targets.length === 0) return;

    control.setAttribute("disabled", "");

    const events = await loadStandardEvents();
    const CartLinesUpdateEvent = events?.CartLinesUpdateEvent;
    const CartErrorEvent = events?.CartErrorEvent;

    let deferred;
    if (CartLinesUpdateEvent) {
      deferred = CartLinesUpdateEvent.createPromise();
      this.dispatchEvent(
        new CartLinesUpdateEvent({
          action: "update",
          context: "cart",
          lines: targets.map((t) => ({ id: t.key, quantity: t.quantity })),
          promise: deferred.promise,
        }),
      );
    }

    try {
      let cart = await fetch(`${CART_URL()}.js`).then((r) => r.json());
      let lastResponse = null;

      for (const target of targets) {
        const line = this.#resolveLine(cart.items, target.key);
        if (!line) continue;

        const sellingPlan = target.plans[planName];
        const response = await fetch(CART_CHANGE_URL(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            line,
            quantity: target.quantity,
            selling_plan: sellingPlan,
            sections: this.#sectionIds().join(","),
            sections_url: window.location.pathname,
          }),
        });
        lastResponse = await response.json();
        if (lastResponse.errors) throw new Error(lastResponse.errors);
        cart = lastResponse;
      }

      if (!lastResponse) return;

      deferred?.resolve({
        cart: CartLinesUpdateEvent.createCartFromAjaxResponse(lastResponse),
        detail: {
          sections: lastResponse.sections,
          items: lastResponse.items,
          itemCount: lastResponse.item_count,
          source: "cart-bundle-selling-plan",
          didError: false,
        },
      });
    } catch (error) {
      console.error("[cart-bundle-plan] failed to change plan:", error);
      deferred?.reject(error);
      control.value = control.dataset.selected ?? "";

      if (CartErrorEvent) {
        this.dispatchEvent(
          new CartErrorEvent({
            error: error?.message || "Failed to update the delivery plan",
            code: "INVALID",
          }),
        );
      }
    } finally {
      control.removeAttribute("disabled");
    }
  };
}

if (!customElements.get("cart-bundle-selling-plan")) {
  customElements.define("cart-bundle-selling-plan", CartBundleSellingPlan);
}
