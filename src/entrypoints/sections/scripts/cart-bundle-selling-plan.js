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

class CartBundleSellingPlan extends HTMLElement {
  // Bound to the element itself and delegated to whichever child matches,
  // rather than bound directly to the select/button found at connect time.
  // A plan change morphs this element's *content* (select <-> button) in
  // place without ever disconnecting/reconnecting it — Idiomorph reuses the
  // same <cart-bundle-selling-plan> node — so a listener attached to the old
  // child would silently stop firing once that child is replaced. Delegating
  // to the element, which persists across the morph, keeps working no matter
  // which control is currently inside it.
  connectedCallback() {
    this.addEventListener("change", this.#onChange);
    this.addEventListener("click", this.#onSubscribeClick);
  }

  disconnectedCallback() {
    this.removeEventListener("change", this.#onChange);
    this.removeEventListener("click", this.#onSubscribeClick);
  }

  /** @returns {Record<string, {line: number, key: string, quantity: number, plans: Record<string, number>}>} */
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

  /** @param {Event} event */
  #onChange = (event) => {
    const select = event.target;
    if (select instanceof HTMLSelectElement) {
      this.#applyPlanToGroup(select.value, select);
    }
  };

  /** @param {MouseEvent} event */
  #onSubscribeClick = (event) => {
    const cta =
      event.target instanceof Element
        ? event.target.closest("[data-bundle-selling-plan]")
        : null;
    const planName = cta?.dataset.bundleSellingPlan;
    if (cta && planName) this.#applyPlanToGroup(planName, cta);
  };

  /**
   * Moves every line in the group onto the plan matching `planName` — an
   * empty string clears every line back to one-time purchase instead (there
   * is no name to match then, so every line in the group is a target). A
   * non-empty plan must exist on every line in the bundle; otherwise the
   * update is rejected before any cart request is sent so the bundle cannot
   * become half subscription and half one-time.
   * @param {string} planName - Lowercased selling-plan name to match, or ''
   *   to clear the whole group to one-time.
   * @param {HTMLSelectElement | HTMLElement} control
   */
  #applyPlanToGroup = async (planName, control) => {
    const planMap = this.#planMap;
    const targets = Object.values(planMap);
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
      if (planName !== "") {
        const missingPlan = targets.find((entry) => !entry.plans?.[planName]);
        if (missingPlan) {
          throw new Error(
            "This delivery plan is not available for every bundle item",
          );
        }
      }

      let lastResponse = null;

      // Shopify can invalidate line item keys when a selling plan changes.
      // Use rendered line numbers instead, applied bottom-up so earlier line
      // positions stay valid throughout the batch.
      const orderedTargets = [...targets].sort((a, b) => b.line - a.line);
      for (const [index, target] of orderedTargets.entries()) {
        const sellingPlan = planName === "" ? "" : target.plans[planName];
        const body = {
          line: target.line,
          quantity: target.quantity,
          selling_plan: sellingPlan,
        };
        if (index === orderedTargets.length - 1) {
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
        lastResponse = await response.json();
        if (lastResponse.errors) throw new Error(lastResponse.errors);
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
      if (control instanceof HTMLSelectElement) {
        control.value = control.dataset.selected ?? "";
      }

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
