/**
 * <buy-box> — Heist stitched-product buy box (Variation 3).
 *
 * A single state machine drives the whole UI:
 *   state = {
 *     quantities: Map<variantId, qty>,   // per component variant
 *     tier: 'heist' | 'standard' | 'one_time',
 *     frequencyPlanName: string | null,  // selected frequency (V3), matched per variant
 *   }
 *
 * Every interaction mutates state and calls render(), which recomputes prices
 * and badges from the real Shopify selling-plan allocation data embedded in the
 * <script data-buy-box-data> island — no discount percentage is ever hardcoded.
 * render() only writes text/attributes; it never re-renders markup structure.
 *
 * Add-to-cart mirrors product-form.js#processBatchAddToCart: one JSON POST of an
 * items[] array to Theme.routes.cart_add_url (with selling_plan per line), plus a
 * CartLinesUpdateEvent so the cart drawer auto-opens and refreshes.
 *
 * The Shopify standard-events module (CartLinesUpdateEvent / CartErrorEvent) is
 * an importmap alias resolved only at runtime, so it can't be a static import in
 * a Vite-bundled entry. It's loaded lazily from the same CDN URL the importmap
 * uses; if that ever fails the add still succeeds, the drawer just won't
 * auto-refresh.
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
        console.warn("[buy-box] standard events unavailable:", error);
        return null;
      },
    );
  }
  return eventsModulePromise;
}

// Theme.routes.cart_add_url already carries the `.js` suffix (see scripts.liquid).
const CART_ADD_URL = () =>
  (window.Theme && window.Theme.routes && window.Theme.routes.cart_add_url) ||
  "/cart/add.js";
const CART_URL = () =>
  (window.Theme && window.Theme.routes && window.Theme.routes.cart_url) ||
  "/cart";

class BuyBox extends HTMLElement {
  connectedCallback() {
    const dataEl = this.querySelector("[data-buy-box-data]");
    if (!dataEl) return; // empty metafield / editor placeholder
    try {
      this.data = JSON.parse(dataEl.textContent);
    } catch (error) {
      console.warn("[buy-box] Failed to parse data island:", error);
      return;
    }

    this.moneyFormat = this.data.moneyFormat || "${{amount}}";
    this.variation = this.dataset.variation || "variation_3";
    this.priceMode = this.dataset.priceMode || "total"; // 'per_bag' | 'total'
    this.unit = this.priceMode === "per_bag" ? "/bag" : "/mo";
    // Prepaid plans bill one fixed total for N deliveries — divide to get per bag.
    this.prepaidDivisor = Number(this.dataset.prepaidDivisor) || 1;

    // Map every plan id → its name. Each component product can have its OWN
    // plan ids for the same plan (e.g. two different "3 month prepaid" ids), so
    // plans are resolved per variant by matching the name — never one global id.
    this.groups = this.data.sellingPlanGroups || [];
    this.planNameById = new Map();
    for (const group of this.groups) {
      for (const plan of group.sellingPlans || []) {
        this.planNameById.set(String(plan.id), (plan.name || "").toLowerCase());
      }
    }

    this.state = {
      quantities: new Map(),
      tier: this.dataset.defaultTier || "heist",
      // The selected frequency is tracked by plan NAME (V3) so it can be matched
      // against each variant's own allocation.
      frequencyPlanName: this.#initialFrequencyName(),
    };

    this.#seedQuantities();
    this.#applyUrlVariant();
    this.#bindEvents();
    this.#setupStickyBar();
    this.render();
  }

  // ------------------------------------------------------------------ setup

  /**
   * The frequency <select>'s selected plan NAME (V3 only). Null when there's no
   * select, so the standard tier resolves via the plan-name hint instead.
   */
  #initialFrequencyName() {
    const select = this.querySelector("[data-buy-box-frequency]");
    const opt = select?.selectedOptions?.[0];
    return opt ? opt.textContent.trim() : null;
  }

  /** Read the server-rendered stepper values into state. */
  #seedQuantities() {
    this.querySelectorAll("[data-buy-box-stepper]").forEach((stepper) => {
      const variantId = stepper.dataset.variantId;
      const value = Number(
        stepper.querySelector("[data-stepper-input]")?.value || 0,
      );
      this.state.quantities.set(variantId, value);
    });
  }

  #bindEvents() {
    // Quantity steppers
    this.querySelectorAll("[data-buy-box-stepper]").forEach((stepper) => {
      const variantId = stepper.dataset.variantId;
      stepper
        .querySelector("[data-stepper-decrease]")
        ?.addEventListener("click", () => this.#changeQty(variantId, -1));
      stepper
        .querySelector("[data-stepper-increase]")
        ?.addEventListener("click", () => this.#changeQty(variantId, 1));
    });

    // Tier radios (V2/V3)
    this.querySelectorAll('input[type="radio"][value]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          this.state.tier = radio.value;
          this.render();
        }
      });
    });

    // Clickable tier rows (V1)
    this.querySelectorAll("[data-select-tier]").forEach((row) => {
      row.addEventListener("click", () => {
        this.state.tier = row.dataset.selectTier;
        this.render();
      });
    });

    // Frequency select — remember the chosen plan NAME (matched per variant).
    this.querySelector("[data-buy-box-frequency]")?.addEventListener(
      "change",
      (event) => {
        this.state.frequencyPlanName =
          event.target.selectedOptions[0]?.textContent.trim() || null;
        this.render();
      },
    );

    // Submit (may open the upgrade popup instead of adding directly). There can
    // be more than one CTA (V1 has one per box) — bind them all.
    this.querySelectorAll("[data-buy-box-submit]").forEach((submit) => {
      submit.addEventListener("click", () => this.#onSubmit(submit));
    });

    // Upgrade popup (Variation 2)
    this.popup = this.querySelector("[data-buy-box-popup]");
    if (this.popup) {
      this.querySelector("[data-popup-join]")?.addEventListener("click", () => {
        this.#closePopup();
        this.#addToCart("heist");
      });
      this.querySelector("[data-popup-close]")?.addEventListener(
        "click",
        () => {
          // Explicit close = decline the upgrade, proceed with the standard sub.
          this.#closePopup();
          this.#addToCart("standard");
        },
      );
      // Esc / backdrop = back out entirely (no add).
      this.popup.addEventListener("cancel", () => this.#closePopup());
      this.popup.addEventListener("click", (event) => {
        if (event.target === this.popup) this.#closePopup();
      });
    }

    this.#bindTooltips();
  }

  #bindTooltips() {
    // Each tooltip is a <dialog> opened as a centered modal (top layer, native
    // backdrop, Esc-to-close). Backdrop click closes it too.
    this.querySelectorAll("[data-tooltip]").forEach((tip) => {
      const open = () => {
        if (typeof tip.showModal === "function") tip.showModal();
        else tip.setAttribute("open", "");
      };
      const close = () => {
        if (typeof tip.close === "function" && tip.open) tip.close();
        else tip.removeAttribute("open");
      };
      tip.parentElement
        ?.querySelector("[data-tooltip-trigger]")
        ?.addEventListener("click", open);
      tip
        .querySelector("[data-tooltip-close]")
        ?.addEventListener("click", close);
      tip.addEventListener("click", (event) => {
        if (event.target === tip) close(); // backdrop
      });
    });
  }

  #onSubmit(submit) {
    if (submit?.dataset.opensPopup === "true" && this.popup) {
      this.#openPopup();
      return;
    }
    this.#addToCart();
  }

  #openPopup() {
    if (!this.popup) return;
    // Seed the upgrade price with the Heist total for the current bag selection.
    const { total } = this.#totalsForTier("heist", true);
    const priceEl = this.popup.querySelector("[data-popup-price]");
    if (priceEl) {
      priceEl.textContent = ` — ${this.formatMoney(this.#displayValue(total, this.#displayBags()))}${this.unit}`;
      priceEl.hidden = false;
    }
    if (typeof this.popup.showModal === "function") this.popup.showModal();
    else this.popup.setAttribute("open", "");
  }

  #closePopup() {
    if (!this.popup) return;
    if (typeof this.popup.close === "function" && this.popup.open) {
      this.popup.close();
    } else {
      this.popup.removeAttribute("open");
    }
  }

  // --------------------------------------------------------------- mutation

  #changeQty(variantId, delta) {
    this.#setQty(
      variantId,
      (this.state.quantities.get(variantId) || 0) + delta,
    );
  }

  /** Set a variant's quantity (state + stepper DOM). */
  #setQty(variantId, qty, rerender = true) {
    const next = Math.max(0, qty);
    this.state.quantities.set(variantId, next);

    const stepper = this.querySelector(
      `[data-buy-box-stepper][data-variant-id="${variantId}"]`,
    );
    if (stepper) {
      stepper.querySelector("[data-stepper-value]").textContent = String(next);
      stepper.querySelector("[data-stepper-input]").value = String(next);
      const dec = stepper.querySelector("[data-stepper-decrease]");
      if (dec) dec.disabled = next === 0;
    }
    if (rerender) this.render();
  }

  /**
   * If the URL has ?variantId=<id> (or ?variant=<id>) matching a component
   * variant, select just that bag (qty 1, others 0). Otherwise leave defaults.
   */
  #applyUrlVariant() {
    const params = new URLSearchParams(window.location.search);
    const target = params.get("variantId") || params.get("variant");
    if (!target) return;

    let match = null;
    this.state.quantities.forEach((_, id) => {
      if (String(id) === String(target)) match = id;
    });
    if (match == null) return; // not one of our bags — leave everything as-is

    this.state.quantities.forEach((_, id) => {
      this.#setQty(id, id === match ? 1 : 0, false);
    });
  }

  // --------------------------------------------------------------- pricing

  /** Look up a variant record from the data island. */
  #variant(variantId) {
    for (const component of this.data.components) {
      const v = component.variants.find(
        (v) => String(v.id) === String(variantId),
      );
      if (v) return v;
    }
    return null;
  }

  /**
   * Resolve the plan id for a tier FROM THIS VARIANT'S own allocations, matched
   * by plan name. This is what makes each stitched product use its own plan.
   */
  #planIdForVariant(variant, tier) {
    if (tier === "one_time") return null;
    const allocs = variant.sellingPlanAllocations || [];
    if (allocs.length === 0) return null;

    // Each allocation carries its own plan name (falls back to the id→name map).
    const nameOf = (a) =>
      (
        a.name ||
        this.planNameById.get(String(a.sellingPlanId)) ||
        ""
      ).toLowerCase();
    const has = (a, ...tokens) =>
      tokens.some((t) => t && nameOf(a).includes(t));
    const heistHint = (this.dataset.heistHint || "").toLowerCase().trim();
    const stdHint = (this.dataset.standardHint || "").toLowerCase().trim();

    if (tier === "heist") {
      const alloc =
        allocs.find((a) => has(a, heistHint)) || // "prepaid"
        allocs.find((a) => has(a, "prepaid", "prepay")) ||
        allocs.find((a) => has(a, "month") && !has(a, stdHint)) || // monthly, not weekly
        allocs.find((a) => !has(a, stdHint)) || // any non-weekly plan
        allocs[0];
      return alloc ? String(alloc.sellingPlanId) : null;
    }

    // standard — prefer the chosen frequency's plan name (V3), matched per variant.
    const freq = (this.state.frequencyPlanName || "").toLowerCase().trim();
    if (freq) {
      const byFreq =
        allocs.find((a) => nameOf(a) === freq) ||
        allocs.find((a) => nameOf(a).includes(freq));
      if (byFreq) return String(byFreq.sellingPlanId);
    }
    // ...else the standard hint, never the prepaid plan.
    const alloc =
      (stdHint && allocs.find((a) => has(a, stdHint) && !has(a, "prepaid"))) ||
      allocs.find((a) => !has(a, "prepaid", heistHint)) ||
      allocs[0];
    return alloc ? String(alloc.sellingPlanId) : null;
  }

  /** Per-unit price (cents) for a variant under a plan (or one-time). */
  #unitPrice(variant, planId) {
    if (!planId) return variant.price;
    const alloc = (variant.sellingPlanAllocations || []).find(
      (a) => String(a.sellingPlanId) === String(planId),
    );
    if (!alloc) return variant.price;
    // Prepaid: the fixed term price → per bag = price / deliveries.
    if (this.prepaidDivisor > 1 && this.#isPrepaid(alloc)) {
      return Math.round(alloc.perDeliveryPrice / this.prepaidDivisor);
    }
    return alloc.perDeliveryPrice;
  }

  #isPrepaid(alloc) {
    const name = (
      alloc.name ||
      this.planNameById.get(String(alloc.sellingPlanId)) ||
      ""
    ).toLowerCase();
    const heistHint = (this.dataset.heistHint || "").toLowerCase().trim();
    return name.includes("prepaid") || (heistHint && name.includes(heistHint));
  }

  /**
   * Totals for a tier across all selected bags.
   * @returns {{ total: number, compare: number, lines: Array }}
   */
  /**
   * @param {string} tier
   * @param {boolean} [forDisplay] - when true and nothing is selected, price as
   *   if there were 1 of each bag so the UI shows an initial price, not $0.
   *   (Add-to-cart always passes false so it only adds what's actually chosen.)
   */
  #totalsForTier(tier, forDisplay = false) {
    const fallback = forDisplay && this.#bagCount() === 0;
    let total = 0;
    let compare = 0;
    const lines = [];
    for (const [variantId, storedQty] of this.state.quantities) {
      const qty = fallback ? 1 : storedQty;
      if (qty <= 0) continue;
      const variant = this.#variant(variantId);
      if (!variant) continue;
      // Resolve each variant's OWN plan id, and only attach it if the variant
      // actually has that allocation (else it adds one-time, never fails).
      const planId = this.#planIdForVariant(variant, tier);
      const linePlan = this.#variantHasPlan(variant, planId) ? planId : null;
      const unit = this.#unitPrice(variant, linePlan);
      // Subscription compares against the regular price; one-time against the
      // compare-at (MSRP) if there is one.
      const compareUnit = linePlan
        ? variant.price
        : variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : variant.price;
      total += unit * qty;
      compare += compareUnit * qty;
      if (!forDisplay) lines.push({ variantId, qty, sellingPlan: linePlan });
    }
    return { total, compare, lines };
  }

  /** Bag count to divide by for per-bag display (falls back to 1-of-each). */
  #displayBags() {
    return this.#bagCount() || this.state.quantities.size || 1;
  }

  #variantHasPlan(variant, planId) {
    if (!planId) return false;
    return (variant.sellingPlanAllocations || []).some(
      (a) => String(a.sellingPlanId) === String(planId),
    );
  }

  #discountPct(total, compare) {
    if (!compare || total >= compare) return 0;
    return Math.round((1 - total / compare) * 100);
  }

  #bagCount() {
    let n = 0;
    for (const qty of this.state.quantities.values()) n += qty;
    return n;
  }

  /** Convert a tier total (cents) to the displayed figure for this variation. */
  #displayValue(total, bags) {
    if (this.priceMode === "per_bag" && bags > 0) {
      return Math.round(total / bags);
    }
    return total;
  }

  // ---------------------------------------------------------------- render

  render() {
    const bags = this.#displayBags();
    const hasBags = this.#bagCount() > 0;

    // Tiles (all variations) — reflect the selected tier's per-bag price/badge.
    this.querySelectorAll("[data-buy-box-tile]").forEach((tile) => {
      const firstStepper = tile.querySelector("[data-buy-box-stepper]");
      const variant = firstStepper
        ? this.#variant(firstStepper.dataset.variantId)
        : null;
      if (!variant) return;
      const planId = this.#planIdForVariant(variant, this.state.tier);
      const unit = this.#unitPrice(variant, planId);
      const compare = planId
        ? variant.price
        : variant.compareAtPrice > variant.price
          ? variant.compareAtPrice
          : variant.price;
      const pct = this.#discountPct(unit, compare);

      this.#setText(tile, "[data-tile-price]", this.formatMoney(unit));

      const compareEl = tile.querySelector("[data-tile-compare]");
      if (compareEl) {
        compareEl.hidden = pct <= 0;
        const s = compareEl.querySelector("s");
        if (s) s.textContent = this.formatMoney(compare);
      }
      const badgeEl = tile.querySelector("[data-tile-badge]");
      if (badgeEl) {
        badgeEl.hidden = pct <= 0;
        if (pct > 0) badgeEl.textContent = `${pct}% off`;
      }
    });

    this.#renderSticky();

    if (this.variation === "variation_1") {
      this.#renderV1(bags, hasBags);
      return;
    }

    const selectedTotals = this.#totalsForTier(this.state.tier, true);

    // Each tier row shows its own price/compare/badge/save.
    this.querySelectorAll("[data-buy-box-tier]").forEach((tierEl) => {
      const tier = tierEl.dataset.tier;
      const totals = this.#totalsForTier(tier, true);
      this.#fillPriceGroup(tierEl, totals, bags);
      tierEl.dataset.selected = String(tier === this.state.tier);
    });

    // Price on the CTA that opts in (Variation 3).
    const priceEl = this.querySelector(
      '[data-buy-box-submit][data-show-price="true"] [data-submit-price]',
    );
    if (priceEl) {
      const disp = this.#displayValue(selectedTotals.total, bags);
      priceEl.textContent = ` — ${this.formatMoney(disp)}${this.unit}`;
    }
    this.#setDisabled(!hasBags);
  }

  #setDisabled(disabled) {
    this.querySelectorAll("[data-buy-box-submit]").forEach((b) => {
      b.disabled = disabled;
    });
  }

  /** Sticky bar: show a thumbnail per selected variant + the live saving. */
  #renderSticky() {
    if (!this.sticky) return;

    this.sticky.querySelectorAll("[data-sticky-thumb]").forEach((thumb) => {
      thumb.hidden =
        (this.state.quantities.get(thumb.dataset.variantId) || 0) <= 0;
    });

    const { total, compare } = this.#totalsForTier(this.state.tier);
    const saving = compare - total;
    const savingEl = this.sticky.querySelector("[data-sticky-saving]");
    if (savingEl) {
      if (saving > 0) {
        const label = this.sticky.dataset.savingLabel || "Your saving";
        savingEl.textContent = `${label} ${this.formatMoney(saving)}`;
        savingEl.hidden = false;
      } else {
        savingEl.hidden = true;
      }
    }
  }

  /** Reveal the sticky bar once the plans area scrolls above the viewport. */
  #setupStickyBar() {
    this.sticky = this.querySelector("[data-buy-box-sticky]");
    if (!this.sticky || !("IntersectionObserver" in window)) return;
    const target =
      this.querySelector("[data-buy-box-plans]") ||
      this.querySelector("[data-sub-box]") ||
      this;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        const stuck =
          !entry.isIntersecting && entry.boundingClientRect.bottom <= 0;
        this.sticky.dataset.stuck = String(stuck);
      },
      { threshold: 0 },
    );
    io.observe(target);
  }

  /** Variation 1: three-state layout with a dynamic summary + dual CTA. */
  #renderV1(bags, hasBags) {
    const tier = this.state.tier;
    const isSub = tier !== "one_time";
    const summaryTier = tier === "heist" ? "heist" : "standard";

    // Summary row reflects the active subscription plan (+ its manual badge).
    this.#fillPriceGroup(
      this.querySelector("[data-v1-summary]"),
      this.#totalsForTier(summaryTier, true),
      bags,
      null,
      summaryTier === "heist"
        ? this.dataset.heistBadge
        : this.dataset.standardBadge,
    );
    const subtitleEl = this.querySelector("[data-v1-subtitle]");
    if (subtitleEl) {
      subtitleEl.textContent =
        summaryTier === "heist"
          ? this.dataset.heistSubtitle || ""
          : this.dataset.standardSubtitle || "";
    }

    // Toggle indicators (JS-driven — the top toggle stays on for both subs).
    this.#setToggle("sub", isSub);
    this.#setToggle("heist", tier === "heist");
    this.#setToggle("one_time", tier === "one_time");
    const upgrade = this.querySelector("[data-upgrade-card]");
    if (upgrade) upgrade.dataset.selected = String(tier === "heist");

    // Upgrade card badge always advertises the Heist discount (manual or computed).
    const upBadge = this.querySelector("[data-upgrade-badge]");
    if (upBadge) {
      const heist = this.#totalsForTier("heist", true);
      this.#setBadge(
        upBadge,
        this.#discountPct(heist.total, heist.compare),
        this.dataset.heistBadge,
      );
    }

    // Collapse/expand each box.
    this.querySelectorAll("[data-sub-detail]").forEach((el) => {
      el.hidden = !isSub;
    });
    this.querySelectorAll("[data-onetime-detail]").forEach((el) => {
      el.hidden = tier !== "one_time";
    });

    // One-time pricing.
    this.#fillPriceGroup(
      this.querySelector("[data-onetime-box]"),
      this.#totalsForTier("one_time", true),
      bags,
      {
        price: "[data-onetime-price]",
        compare: "[data-onetime-compare]",
        save: "[data-onetime-save]",
      },
    );

    // Subscribe CTA label switches with the sub plan.
    const subCtaLabel =
      tier === "heist" ? this.dataset.ctaHeist : this.dataset.ctaStandard;
    const subLabelEl = this.querySelector(
      "[data-sub-detail][data-buy-box-submit] [data-cta-label]",
    );
    if (subLabelEl && subCtaLabel) subLabelEl.textContent = subCtaLabel;

    this.#setDisabled(!hasBags);
  }

  #setToggle(name, on) {
    const el = this.querySelector(`[data-v1-toggle="${name}"]`);
    if (el) el.dataset.checked = String(!!on);
  }

  /**
   * Fill a price/compare/badge/save group from a tier's totals.
   * @param {string} [badgeOverride] - manual badge text (e.g. "20% off") that
   *   wins over the computed discount. Falls back to the badge node's own
   *   data-badge attribute, then to the computed percentage.
   */
  #fillPriceGroup(root, totals, bags, sel, badgeOverride) {
    if (!root) return;
    const s = sel || {
      price: "[data-tier-price]",
      compare: "[data-tier-compare]",
      badge: "[data-tier-badge]",
      save: "[data-tier-save]",
    };
    const pct = this.#discountPct(totals.total, totals.compare);
    const priceDisp = this.#displayValue(totals.total, bags);
    const compareDisp = this.#displayValue(totals.compare, bags);

    const priceEl = root.querySelector(s.price);
    if (priceEl) priceEl.textContent = this.formatMoney(priceDisp);

    const compareEl = root.querySelector(s.compare);
    if (compareEl) {
      compareEl.hidden = pct <= 0;
      if (pct > 0) compareEl.textContent = this.formatMoney(compareDisp);
    }
    this.#setBadge(root.querySelector(s.badge), pct, badgeOverride);

    const saveEl = root.querySelector(s.save);
    if (saveEl) {
      if (pct > 0) {
        // Unit lives in its own span so it can be styled apart from the amount.
        saveEl.textContent = `Save ${this.formatMoney(compareDisp - priceDisp)}`;
        const unitEl = document.createElement("span");
        unitEl.className = "buy-box-tier__save-unit";
        unitEl.textContent = this.unit;
        saveEl.appendChild(unitEl);
        saveEl.hidden = false;
      } else {
        saveEl.hidden = true;
      }
    }
  }

  #setText(root, selector, text) {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
  }

  /** Badge: manual override → node's own data-badge → computed % → hidden. */
  #setBadge(el, pct, override) {
    if (!el) return;
    const manual = (override || el.dataset.badge || "").trim();
    if (manual) {
      el.textContent = manual;
      el.hidden = false;
    } else if (pct > 0) {
      el.textContent = `${pct}% off`;
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  // ------------------------------------------------------------ add to cart

  async #addToCart(tierOverride) {
    const tier = tierOverride || this.state.tier;
    const { lines } = this.#totalsForTier(tier);
    if (lines.length === 0) return;

    this.#setBusy(true);

    const items = lines.map((line) => {
      const item = { id: Number(line.variantId), quantity: line.qty };
      if (line.sellingPlan) item.selling_plan = Number(line.sellingPlan);
      return item;
    });

    // Section ids so the cart drawer re-renders with the new lines.
    const sectionIds = Array.from(
      document.querySelectorAll("cart-items-component"),
    )
      .map((el) => el.dataset.sectionId)
      .filter(Boolean);

    const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

    const events = await loadStandardEvents();
    const CartLinesUpdateEvent = events?.CartLinesUpdateEvent;

    // Fire the theme cart event first so the drawer opens, resolving its
    // promise once the server confirms (mirrors product-form.js).
    let deferred = null;
    if (CartLinesUpdateEvent) {
      try {
        deferred = CartLinesUpdateEvent.createPromise();
        this.dispatchEvent(
          new CartLinesUpdateEvent({
            action: "add",
            context: "product",
            lines: items.map((i) => ({
              merchandiseId: String(i.id),
              quantity: i.quantity,
            })),
            promise: deferred.promise,
          }),
        );
      } catch (error) {
        deferred = null;
      }
    }

    try {
      const response = await fetch(CART_ADD_URL(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ items, sections: sectionIds.join(",") }),
      }).then((r) => r.json());

      if (response.status) {
        // Shopify returns { status, message } on error
        this.#handleError(response.message, deferred, events);
        this.#setBusy(false);
        return;
      }

      const ajaxCart = await fetch(`${CART_URL()}.js`).then((r) => r.json());
      if (deferred && CartLinesUpdateEvent) {
        deferred.resolve({
          cart: CartLinesUpdateEvent.createCartFromAjaxResponse(ajaxCart),
          detail: {
            didError: false,
            items: ajaxCart.items,
            source: "buy-box",
            sourceId: this.dataset.blockId,
            itemCount: totalQuantity,
            productId: this.dataset.productId,
            sections: response.sections,
          },
        });
      } else {
        // No standard-events module — refresh the cart sections ourselves so the
        // drawer isn't stale when we open it below.
        this.#refreshCartSections(response.sections);
      }

      // Open the cart drawer explicitly. The event above also asks the drawer to
      // auto-open, but opening here guarantees it even if that module is absent.
      this.#openCartDrawer();
      // Keep the CTA disabled until the drawer has actually opened.
      this.#reenableWhenDrawerOpens();
    } catch (error) {
      this.#handleError(
        error?.message || "Add to cart failed",
        deferred,
        events,
      );
      this.#setBusy(false);
    }
  }

  /** Disable/enable every CTA (there can be more than one in V1). */
  #setBusy(busy) {
    this.querySelectorAll("[data-buy-box-submit]").forEach((b) => {
      b.disabled = busy;
      b.toggleAttribute("aria-busy", busy);
    });
  }

  /** Re-enable the CTAs once the cart drawer opens (with a safety timeout). */
  #reenableWhenDrawerOpens() {
    const finish = () => {
      clearTimeout(timer);
      document.removeEventListener("theme-drawer:open", finish);
      this.#setBusy(false);
    };
    document.addEventListener("theme-drawer:open", finish, { once: true });
    const timer = setTimeout(finish, 1500);
  }

  #handleError(message, deferred, events) {
    console.warn("[buy-box] add to cart error:", message);
    const CartErrorEvent = events?.CartErrorEvent;
    if (CartErrorEvent) {
      try {
        this.dispatchEvent(
          new CartErrorEvent({ error: message, code: "INVALID" }),
        );
      } catch (_) {
        /* standard events unavailable */
      }
    }
    deferred?.reject?.(new Error(message));
  }

  /** Open the theme cart drawer (public open() on <theme-drawer id="cart-drawer">). */
  #openCartDrawer() {
    const open = () => {
      const drawer = document.getElementById("cart-drawer");
      if (drawer && typeof drawer.open === "function") {
        drawer.open();
      } else {
        // Fallback: click the header trigger that controls the drawer.
        document.querySelector('[aria-controls="cart-drawer"]')?.click();
      }
    };
    if (window.customElements?.whenDefined) {
      customElements
        .whenDefined("theme-drawer")
        .then(() => requestAnimationFrame(open));
    } else {
      open();
    }
  }

  /** Fallback cart refresh via the Section Rendering API response. */
  #refreshCartSections(sections) {
    if (!sections) return;
    for (const [id, html] of Object.entries(sections)) {
      if (!html) continue;
      const el = document.getElementById(`shopify-section-${id}`);
      if (el) el.innerHTML = html;
    }
  }

  // ------------------------------------------------------------------ money

  /** Format cents using the shop money_format pattern. */
  formatMoney(cents) {
    const value = (cents || 0) / 100;
    const withCommas = (num, decimals) => {
      const parts = Number(num).toFixed(decimals).split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
    };
    return this.moneyFormat.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token) => {
      switch (token) {
        case "amount":
          return withCommas(value, 2);
        case "amount_no_decimals":
          return withCommas(value, 0);
        case "amount_with_comma_separator":
          return withCommas(value, 2)
            .replace(/,/g, "·")
            .replace(".", ",")
            .replace(/·/g, ".");
        case "amount_no_decimals_with_comma_separator":
          return withCommas(value, 0).replace(/,/g, ".");
        default:
          return withCommas(value, 2);
      }
    });
  }
}

if (!customElements.get("buy-box")) {
  customElements.define("buy-box", BuyBox);
}
