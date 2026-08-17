const ROOT_SELECTOR = "[data-heist-sub-min]";
const WALLET_SELECTOR =
  ".additional-checkout-buttons, #dynamic-checkout-cart, .wallet-button-wrapper";

const CART_ROOT =
  window.Shopify?.routes?.root || window.Theme?.routes?.root_url || "/";

let busy = false;
let pending = null;

function root() {
  return document.querySelector(ROOT_SELECTOR);
}

function getCart() {
  return fetch(`${CART_ROOT}cart.js`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }).then((response) => response.json());
}

function subscriptionLines(cart) {
  return (cart.items || []).filter((item) => !!item.selling_plan_allocation);
}

function setCheckoutBlocked(blocked) {
  document
    .querySelectorAll('#checkout, [name="checkout"]')
    .forEach((button) => {
      button.disabled = blocked;
      button.setAttribute("aria-disabled", String(blocked));
      button.classList.toggle("heist-sub-min-blocked", blocked);
    });

  document.querySelectorAll(WALLET_SELECTOR).forEach((wrapper) => {
    wrapper.classList.toggle("heist-sub-min-blocked-wallets", blocked);
    wrapper.setAttribute("aria-hidden", String(blocked));

    wrapper.querySelectorAll("button, a, input").forEach((element) => {
      if (blocked) element.setAttribute("tabindex", "-1");
      else element.removeAttribute("tabindex");

      if ("disabled" in element) element.disabled = blocked;
    });
  });
}

function apply(cart) {
  const element = root();
  if (!element) {
    setCheckoutBlocked(false);
    return;
  }

  const min = Number(element.dataset.minBags) || 3;
  const lines = subscriptionLines(cart);
  const bags = lines.reduce((sum, item) => sum + item.quantity, 0);
  const short = bags > 0 && bags < min;

  element.hidden = !short;
  setCheckoutBlocked(short);
  if (!short) return;

  const needed = min - bags;
  const text = element.querySelector("[data-sub-min-text]");
  const add = element.querySelector("[data-sub-min-add]");

  if (text) {
    text.textContent = `Subscriptions start at ${min} bags. You have ${bags}.`;
  }

  if (add) {
    add.textContent = `Add ${needed}${needed === 1 ? " bag" : " bags"}`;
  }

  element.dataset.topUpKey = lines[0].key;
  element.dataset.topUpQty = String(lines[0].quantity + needed);
}

function refresh() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    getCart()
      .then(apply)
      .catch(() => {});
  }, 60);
}

function change(body) {
  if (busy) return;
  busy = true;

  fetch(`${CART_ROOT}cart/change.js`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
    .then(() => {
      window.location.href = `${CART_ROOT}cart`;
    })
    .catch(() => {
      busy = false;
    });
}

function switchSubscriptionLinesToOneTime() {
  if (busy) return;
  busy = true;

  getCart()
    .then((cart) =>
      subscriptionLines(cart).reduce(
        (chain) =>
          chain
            .then(() => getCart())
            .then((fresh) => {
              const next = subscriptionLines(fresh)[0];
              if (!next) return null;

              return fetch(`${CART_ROOT}cart/change.js`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  id: next.key,
                  quantity: next.quantity,
                  selling_plan: null,
                }),
              });
            }),
        Promise.resolve(),
      ),
    )
    .then(() => {
      window.location.href = `${CART_ROOT}cart`;
    })
    .catch(() => {
      busy = false;
    });
}

document.addEventListener("click", (event) => {
  const element = root();
  if (!element || element.hidden) return;

  if (event.target.closest("[data-sub-min-add]")) {
    event.preventDefault();
    change({
      id: element.dataset.topUpKey,
      quantity: Number(element.dataset.topUpQty),
    });
    return;
  }

  if (event.target.closest("[data-sub-min-onetime]")) {
    event.preventDefault();
    switchSubscriptionLinesToOneTime();
  }
});

refresh();
document.addEventListener("shopify:cart:lines-update", refresh);
document.addEventListener("cart-updated", refresh);
window.addEventListener("pageshow", refresh);

const observer = new MutationObserver(refresh);
observer.observe(document.body, { childList: true, subtree: true });
