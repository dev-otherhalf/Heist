// =============================================================================
// Design-tokens preview — click-to-copy chip
// A guarded custom element: copies its data-copy value to the clipboard and
// shows transient feedback. Works in the theme editor (no global state, safe
// re-registration, cleans nothing up because it holds no external listeners).
// =============================================================================

class DtCopy extends HTMLElement {
  connectedCallback() {
    // Elements may be re-rendered by the theme editor — guard against double init.
    if (this._bound) return;
    this._bound = true;
    this.addEventListener("click", this.#onClick);
    this.setAttribute("role", "button");
    this.setAttribute("tabindex", "0");
    this.addEventListener("keydown", this.#onKey);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKey);
    this._bound = false;
  }

  #onKey = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.#onClick();
    }
  };

  #onClick = async () => {
    const value = this.dataset.copy;
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        this.#fallbackCopy(value);
      }
      this.#flash();
    } catch {
      this.#fallbackCopy(value);
      this.#flash();
    }
  };

  #fallbackCopy(value) {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
      /* no-op: clipboard unavailable */
    }
    document.body.removeChild(ta);
  }

  #flash() {
    this.classList.add("is-copied");
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.classList.remove("is-copied"), 1200);
  }
}

if (!customElements.get("dt-copy")) {
  customElements.define("dt-copy", DtCopy);
}
