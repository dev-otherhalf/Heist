const SECTION_SELECTOR = ".page-wholesale";
const READY_ATTR = "data-page-wholesale-ready";

function campaignValue() {
  const params = new URLSearchParams(window.location.search);
  const parts = ["utm_source", "utm_medium", "utm_campaign"]
    .map((key) => params.get(key) || "")
    .filter(Boolean);

  return parts.length ? parts.join(" / ") : "none";
}

function mount(section) {
  if (section.getAttribute(READY_ATTR) === "true") return;
  section.setAttribute(READY_ATTR, "true");

  const referrer = section.querySelector('input[name="contact[Referrer]"]');
  const campaign = section.querySelector('input[name="contact[Campaign]"]');

  if (referrer) referrer.value = document.referrer || "direct";
  if (campaign) campaign.value = campaignValue();
}

function mountAll(root = document) {
  root.querySelectorAll(SECTION_SELECTOR).forEach(mount);
}

mountAll();

document.addEventListener("shopify:section:load", (event) => {
  mountAll(event.target);
});
