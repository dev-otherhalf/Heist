document.querySelectorAll("[data-example-section]").forEach((section) => {
  const status = section.querySelector("[data-example-status]");

  if (status) {
    status.textContent = "JavaScript loaded successfully.";
  }

  section.setAttribute("data-example-ready", "true");
});
