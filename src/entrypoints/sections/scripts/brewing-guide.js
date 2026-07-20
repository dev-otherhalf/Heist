// =============================================================================
// Brewing guide — self-contained card carousel (Swiper) + recipe drawer.
// Portable: depends only on its own markup (snippets/brewing-guide.liquid) and
// styles (brewing-guide.scss). Uses the native <dialog> element — no theme
// dialog.js / component.js. Swiper is bundled by Vite. Drop the snippet into
// any section and it works.
//
// Markup contract:
//   [data-brewing-swiper]     the card carousel (.swiper)
//   [data-brewing-open="ID"]   card trigger; opens the modal with matching ID
//   [data-brewing-drawer="ID"] the modal overlay (rendered outside the swiper)
//   [data-brewing-close]       close button / overlay inside the modal
//   [data-brewing-stepper]     serving-size button group
//   [data-serving]             a serving button (its value = multiplier)
//   [data-brewing-qty]         an ingredient quantity (scaled unless -static)
// =============================================================================

import Swiper from "swiper";
import { FreeMode, Mousewheel } from "swiper/modules";
import { initCustomScrollbar } from "../../../scripts/custom-scrollbar";

// The drawer is a class-toggled overlay (not a native <dialog>/showModal) —
// showModal auto-focuses inside the drawer, which makes the browser scroll the
// Lenis wrapper to reveal that deep DOM node, jumping the page to the top.

// Background scroll lock. lenis.stop() applies `.lenis-stopped { overflow:
// hidden }`, which resets the scroll container to the top (the visible jump).
// lenis' `isLocked` instead freezes it in place — it preventDefaults wheel/touch
// where it is, with no overflow change and no jump, and only adds a harmless
// `lenis-locked` class. Nested scroll (the drawer's own scroll area) still works
// because lenis runs with `allowNestedScroll: true`.
function lockPageScroll() {
  if (window.lenis) window.lenis.isLocked = true;
}

function unlockPageScroll() {
  if (window.lenis) window.lenis.isLocked = false;
}

function openDrawer(modal) {
  if (!(modal instanceof HTMLElement) || modal.classList.contains("is-open")) {
    return;
  }
  // Relocate to <body> so the fixed overlay escapes the section's stacking
  // context (a sticky header / later section could otherwise cover it).
  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  modal.hidden = false;
  void modal.offsetWidth; // force reflow so the open transition runs
  modal.classList.add("is-open");

  lockPageScroll();
}

function closeDrawer(modal) {
  if (!(modal instanceof HTMLElement) || !modal.classList.contains("is-open")) {
    return;
  }
  modal.classList.remove("is-open");

  // Release the scroll clamp and resume scrolling from the same position.
  unlockPageScroll();

  const panel = modal.querySelector(".brewing-guide__drawer");
  const duration = panel ? getComputedStyle(panel).transitionDuration : "0s";

  if (panel && duration && duration !== "0s") {
    panel.addEventListener("transitionend", () => (modal.hidden = true), {
      once: true,
    });
  } else {
    modal.hidden = true;
  }
}

/**
 * Split a quantity string into its leading number and trailing unit,
 * e.g. "2 OZ" -> { base: 2, suffix: "OZ" }, "3" -> { base: 3, suffix: "" }.
 * Returns null when there's no leading number (non-scalable text).
 *
 * @param {string} text
 */
function parseQuantity(text) {
  const match = text.trim().match(/^([\d.]+)\s*(.*)$/);
  if (!match) return null;
  return { base: parseFloat(match[1]), suffix: match[2] };
}

/**
 * @param {number} value
 */
function formatQuantity(value) {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * Recompute every scalable ingredient quantity in a drawer for `servings`.
 *
 * @param {ParentNode} drawer
 * @param {number} servings
 */
function scaleServings(drawer, servings) {
  for (const qty of drawer.querySelectorAll(
    "[data-brewing-qty]:not([data-brewing-qty-static])",
  )) {
    if (qty.dataset.qtyBase === undefined) continue;
    const suffix = qty.dataset.qtySuffix || "";
    const value = parseFloat(qty.dataset.qtyBase) * servings;
    qty.textContent = suffix
      ? `${formatQuantity(value)} ${suffix}`
      : formatQuantity(value);
  }
}

let delegated = false;

function ensureDelegation() {
  if (delegated) return;
  delegated = true;

  document.addEventListener("click", (event) => {
    const openBtn = event.target.closest("[data-brewing-open]");
    if (openBtn) {
      const id = openBtn.getAttribute("data-brewing-open");
      openDrawer(
        document.querySelector(`[data-brewing-drawer="${CSS.escape(id)}"]`),
      );
      return;
    }

    const closeBtn = event.target.closest("[data-brewing-close]");
    if (closeBtn) {
      closeDrawer(closeBtn.closest("[data-brewing-drawer]"));
      return;
    }

    const servingBtn = event.target.closest("[data-serving]");
    if (servingBtn) {
      const stepper = servingBtn.closest("[data-brewing-stepper]");
      const drawer = servingBtn.closest("[data-brewing-drawer]");
      const servings = Number(servingBtn.dataset.serving);

      for (const btn of stepper.querySelectorAll("[data-serving]")) {
        const active = btn === servingBtn;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-pressed", String(active));
      }

      if (drawer) scaleServings(drawer, servings);
    }
  });

  // Escape closes the open drawer.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = document.querySelector("[data-brewing-drawer].is-open");
    if (open) closeDrawer(open);
  });
}

function initDrawerScrollbar(drawer) {
  const inner = drawer.querySelector(".brewing-guide__drawer-inner");
  if (!inner || inner.dataset.scrollbarReady === "true") return;
  inner.dataset.scrollbarReady = "true";

  const track = document.createElement("div");
  track.className = "brewing-guide__scrollbar";
  const thumb = document.createElement("div");
  thumb.className = "brewing-guide__scrollbar-thumb";
  track.appendChild(thumb);
  drawer.appendChild(track);

  initCustomScrollbar({ scroller: inner, track, thumb });
}

function registerDrawer(modal) {
  if (modal.dataset.brewingReady === "true") return;
  modal.dataset.brewingReady = "true";

  const drawer = modal.querySelector(".brewing-guide__drawer");
  if (drawer) initDrawerScrollbar(drawer);

  // Snapshot the ×1 (base) quantity for each scalable ingredient. Anything
  // without a leading number (e.g. "GENEROUS") is flagged static and skipped.
  for (const qty of modal.querySelectorAll(
    "[data-brewing-qty]:not([data-brewing-qty-static])",
  )) {
    const parsed = parseQuantity(qty.textContent);
    if (parsed) {
      qty.dataset.qtyBase = String(parsed.base);
      qty.dataset.qtySuffix = parsed.suffix;
    } else {
      qty.setAttribute("data-brewing-qty-static", "");
    }
  }
}

function initSwiper(el) {
  if (el.dataset.brewingSwiperReady === "true") return;
  el.dataset.brewingSwiperReady = "true";

  new Swiper(el, {
    modules: [FreeMode, Mousewheel],
    slidesPerView: "auto",
    spaceBetween: 16,
    slidesOffsetBefore: 20,
    slidesOffsetAfter: 20,
    freeMode: false,
    grabCursor: true,
    mousewheel: { forceToAxis: true },
    breakpoints: {
      1439: {
        slidesOffsetBefore: 56,
        slidesOffsetAfter: 56,
      },
    },
  });
}

function initBrewingGuide(scope = document) {
  ensureDelegation();
  scope.querySelectorAll("[data-brewing-swiper]").forEach(initSwiper);
  scope.querySelectorAll("[data-brewing-drawer]").forEach(registerDrawer);
}

document.addEventListener("DOMContentLoaded", () => initBrewingGuide());
document.addEventListener("shopify:section:load", (event) =>
  initBrewingGuide(event.target),
);
