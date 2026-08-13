/**
 * <cart-upgrade-banner> — moves every eligible cart line onto its prepaid plan.
 *
 * Each request resolves its target against the latest cart response before
 * posting. Shopify can invalidate line item keys and shift line numbers when a
 * selling plan changes, especially inside bundles.
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
const CART_URL = () => {
  const cartUrl = window.Theme?.routes?.cart_url || "/cart";
  return cartUrl.endsWith(".js") ? cartUrl : `${cartUrl}.js`;
};

function isPrepaidName(name) {
  const normalized = String(name || "").toLowerCase();
  return normalized.includes("prepaid") || normalized.includes("prepay");
}

function lineSignature(line) {
  return `${line.variantId}::${line.bundleGroup || ""}`;
}

function cartItemSignature(item) {
  return `${item.variant_id}::${item.properties?._bundle_group || ""}`;
}

class CartUpgradeBanner extends HTMLElement {
  connectedCallback() {
    // Delegated from the host: a morph can swap the button node underneath us
    // without re-running this callback, which would strand a listener on a
    // detached element.
    this.addEventListener("click", this.#onClick);
    this.#button?.removeAttribute("disabled");
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
  }

  #onClick = (event) => {
    if (!event.target.closest("[data-upgrade-button]")) return;
    this.#onUpgrade();
  };

  get #button() {
    return this.querySelector("[data-upgrade-button]");
  }

  /** @returns {{key: string, variantId: number, bundleGroup: string | null, quantity: number, sellingPlan: number}[]} */
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

  #setCartBusy(isBusy) {
    document.querySelectorAll("theme-drawer#cart-drawer").forEach((drawer) => {
      drawer.toggleAttribute("data-cart-upgrading", isBusy);
    });

    document.querySelectorAll("cart-items-component").forEach((cart) => {
      cart.toggleAttribute("aria-busy", isBusy);
    });
  }

  /**
   * @param {Array<{key: string, variantId: number, bundleGroup: string | null, quantity: number, sellingPlan: number}>} pendingLines
   * @param {{items?: Array<Record<string, unknown>>} | null} cart
   */
  #nextLine(pendingLines, cart) {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    const pendingByKey = new Map(pendingLines.map((line) => [line.key, line]));
    const pendingBySignature = pendingLines.reduce((map, line) => {
      const signature = lineSignature(line);
      const bucket = map.get(signature) || [];
      bucket.push(line);
      map.set(signature, bucket);
      return map;
    }, new Map());

    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      const planName = item.selling_plan_allocation?.selling_plan?.name;
      if (isPrepaidName(planName)) continue;

      const signature = cartItemSignature(item);
      const keyedTarget = pendingByKey.get(item.key);
      const fallbackTargets = pendingBySignature.get(signature);
      const target =
        keyedTarget && lineSignature(keyedTarget) === signature
          ? keyedTarget
          : fallbackTargets?.[0];
      if (!target) continue;

      return {
        target,
        requestLine: {
          line: index + 1,
          quantity: Number(item.quantity) || target.quantity || 1,
          sellingPlan: target.sellingPlan,
        },
      };
    }

    return null;
  }

  async #cart() {
    const response = await fetch(CART_URL(), {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    });
    const cart = await response.json();
    if (cart.errors || cart.status) {
      throw new Error(cart.errors || cart.message || "Could not read cart");
    }
    return cart;
  }

  /**
   * @param {{line: number, quantity: number, sellingPlan: number}} line
   * @param {string} sectionIds
   * @param {boolean} withSections - Ask for section HTML (only worth it on the last change).
   */
  async #changeLine(line, sectionIds, withSections) {
    const body = {
      line: line.line,
      quantity: line.quantity,
      selling_plan: line.sellingPlan,
    };

    if (withSections) {
      body.sections = sectionIds;
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
    if (!response.ok || cart.errors || cart.status) {
      throw new Error(cart.errors || cart.message || "Cart update failed");
    }
    return cart;
  }

  #onUpgrade = async () => {
    if (this.hasAttribute("data-upgrading")) return;

    const lines = this.#lines();
    if (!lines.length) return;

    const button = this.#button;
    this.setAttribute("data-upgrading", "");
    this.#setCartBusy(true);
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
      const pendingLines = [...lines];
      const sectionIds = this.#sectionIds().join(",");
      let cart = await this.#cart();

      while (pendingLines.length > 0) {
        const next = this.#nextLine(pendingLines, cart);
        if (!next) throw new Error("Could not find the cart lines to upgrade");

        cart = await this.#changeLine(
          next.requestLine,
          sectionIds,
          pendingLines.length === 1,
        );

        pendingLines.splice(pendingLines.indexOf(next.target), 1);
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
      this.removeAttribute("data-upgrading");

      const CartErrorEvent = events?.CartErrorEvent;
      if (CartErrorEvent) {
        this.dispatchEvent(
          new CartErrorEvent({
            error: error?.message || "Failed to upgrade the cart",
            code: "INVALID",
          }),
        );
      }
    } finally {
      this.#setCartBusy(false);
    }
    // On success the morph removes this banner, so the button is never re-enabled.
  };
}

if (!customElements.get("cart-upgrade-banner")) {
  customElements.define("cart-upgrade-banner", CartUpgradeBanner);
}
