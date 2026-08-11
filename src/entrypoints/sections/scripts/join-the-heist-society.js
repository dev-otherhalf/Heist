const CART_ADD_URL = () => window.Theme?.routes?.cart_add_url || "/cart/add.js";

class JoinHeistCta extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector("[data-join-heist-button]");
    this.button?.addEventListener("click", this.#onClick);
  }

  disconnectedCallback() {
    this.button?.removeEventListener("click", this.#onClick);
  }

  #lines() {
    const island = this.querySelector("[data-join-heist-lines]");
    if (!island?.textContent) return [];
    try {
      const items = JSON.parse(island.textContent);
      return Array.isArray(items) ? items : [];
    } catch (error) {
      return [];
    }
  }

  #sectionIds() {
    return Array.from(
      document.querySelectorAll("cart-items-component"),
      (element) => element.dataset.sectionId,
    ).filter(Boolean);
  }

  #openCartDrawer() {
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const pinScroll = () => window.scrollTo(scrollX, scrollY);

    const open = () => {
      const drawer = document.getElementById("cart-drawer");
      if (drawer && typeof drawer.open === "function") {
        drawer.open();
      } else {
        document.querySelector('[aria-controls="cart-drawer"]')?.click();
      }
      pinScroll();
      requestAnimationFrame(pinScroll);
    };
    if (window.customElements?.whenDefined) {
      customElements
        .whenDefined("theme-drawer")
        .then(() => requestAnimationFrame(open));
    } else {
      open();
    }
  }

  #refreshCartSections(sections) {
    if (!sections) return;
    for (const [id, html] of Object.entries(sections)) {
      if (!html) continue;
      const el = document.getElementById(`shopify-section-${id}`);
      if (el) el.innerHTML = html;
    }
  }

  #reenable() {
    this.button?.removeAttribute("disabled");
    this.button?.removeAttribute("aria-busy");
  }

  #onClick = async () => {
    const items = this.#lines();
    if (items.length === 0) return;

    this.button?.setAttribute("disabled", "");
    this.button?.toggleAttribute("aria-busy", true);

    try {
      const response = await fetch(CART_ADD_URL(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items, sections: this.#sectionIds().join(",") }),
      }).then((r) => r.json());

      if (response.status) {
        this.#reenable();
        return;
      }

      this.#refreshCartSections(response.sections);
      this.#openCartDrawer();

      document.addEventListener("theme-drawer:open", () => this.#reenable(), {
        once: true,
      });
      setTimeout(() => this.#reenable(), 1500);
    } catch (error) {
      this.#reenable();
    }
  };
}

if (!customElements.get("join-heist-cta")) {
  customElements.define("join-heist-cta", JoinHeistCta);
}
