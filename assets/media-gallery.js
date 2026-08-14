import { Component } from "@theme/component";
import { ThemeEvents, ZoomMediaSelectedEvent } from "@theme/events";
import { StandardEvents, ProductSelectEvent } from "@shopify/events";

/**
 * A custom element that renders a media gallery.
 *
 * @typedef {object} Refs
 * @property {import('./zoom-dialog').ZoomDialog} [zoomDialogComponent] - The zoom dialog component.
 * @property {import('./slideshow').Slideshow} [slideshow] - The slideshow component.
 * @property {HTMLElement[]} [media] - The media elements.
 *
 * @extends Component<Refs>
 */
export class MediaGallery extends Component {
  connectedCallback() {
    super.connectedCallback();

    const { signal } = this.#controller;
    const target = this.closest(".shopify-section, dialog");

    target?.addEventListener(
      StandardEvents.productSelect,
      this.#handleProductSelect,
      { signal },
    );
    this.refs.zoomDialogComponent?.addEventListener(
      ThemeEvents.zoomMediaSelected,
      this.#handleZoomMediaSelected,
      {
        signal,
      },
    );
  }

  #controller = new AbortController();

  disconnectedCallback() {
    super.disconnectedCallback();

    this.#controller.abort();
  }

  /**
   * Handles a product select event by replacing the current media gallery with a new one.
   *
   * @param {ProductSelectEvent} event - The product select event.
   */
  #handleProductSelect = (event) => {
    if (
      !(event.target instanceof Element) ||
      event.target.closest("product-card")
    )
      return;

    event.promise
      .then(({ detail }) => {
        if (!detail?.html) return;

        const { html } = detail;
        const newMediaGallery = html.querySelector("media-gallery");
        if (!newMediaGallery) return;

        this.replaceWith(newMediaGallery);
      })
      .catch((error) => {
        if (error?.name !== "AbortError")
          console.warn("[media-gallery] Event promise rejected:", error);
      });
  };

  /**
   * Handles the 'zoom-media:selected' event.
   * @param {ZoomMediaSelectedEvent} event - The zoom-media:selected event.
   */
  #handleZoomMediaSelected = async (event) => {
    this.slideshow?.select(event.detail.index, undefined, { animate: false });
  };

  toggleSound(event) {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest("[data-sound-toggle]");
    if (!(button instanceof HTMLButtonElement) || !this.contains(button))
      return;

    const deferredMedia = button
      .closest(".product-media")
      ?.querySelector("deferred-media");
    if (!deferredMedia) return;

    event.preventDefault();
    event.stopPropagation();

    let video = deferredMedia.querySelector("video");
    if (!video) {
      deferredMedia.loadContent?.(false);
      video = deferredMedia.querySelector("video");
    }
    if (!video) return;

    video.muted = !video.muted;
    this.#updateSoundToggle(button, video.muted);
    if (video.paused) video.play().catch(() => {});
  }

  /**
   * Zooms the media gallery.
   *
   * @param {number} index - The index of the media to zoom.
   * @param {PointerEvent} event - The pointer event.
   */
  zoom(index, event) {
    this.refs.zoomDialogComponent?.open(index, event);
  }

  /**
   * Preloads an image.
   * @param {number} index - The index of the media to preload.
   */
  preloadImage(index) {
    const zoomDialogMedia = this.refs.zoomDialogComponent?.refs.media[index];
    if (!zoomDialogMedia) return;

    this.refs.zoomDialogComponent?.loadHighResolutionImage(zoomDialogMedia);
  }

  /**
   * Displays a media list supplied by a stitched-product variant while
   * preserving the server-rendered product gallery for future section updates.
   *
   * @param {Array<{type?: "image" | "video", src?: string, srcset?: string, alt?: string, poster?: string, sources?: Array<{url: string, mimeType?: string}>, width?: number, height?: number}>} media
   */
  showBundleMedia(media) {
    const validMedia = media.filter(
      (item) =>
        item?.src ||
        (item?.type === "video" && item.sources?.some((source) => source.url)),
    );
    if (validMedia.length === 0) return;

    const originalGallery =
      this._bundleOriginalGallery?.cloneNode(true) || this.cloneNode(true);
    const replacement = originalGallery.cloneNode(true);
    replacement._bundleOriginalGallery = originalGallery.cloneNode(true);

    this.#replaceGalleryMedia(replacement, validMedia);
    this.replaceWith(replacement);
  }

  restoreOriginalMedia() {
    if (!this._bundleOriginalGallery) return;
    this.replaceWith(this._bundleOriginalGallery.cloneNode(true));
  }

  #replaceGalleryMedia(gallery, media) {
    const slideshow = gallery.querySelector("slideshow-component");
    const scroller = slideshow?.querySelector("slideshow-slides");
    const slideTemplate = scroller?.querySelector("slideshow-slide");

    if (scroller && slideTemplate) {
      const slides = media.map((item, index) => {
        const slide = slideTemplate.cloneNode(true);
        slide.setAttribute("aria-hidden", String(index !== 0));
        slide.setAttribute("ref", "slides[]");
        slide.style.setProperty("--slideshow-timeline", `--slide-${index}`);
        slide.removeAttribute("hidden");
        slide.removeAttribute("reveal");
        this.#replaceMediaContainer(slide, item, index);
        return slide;
      });
      scroller.replaceChildren(...slides);

      const timeline = media.map((_, index) => `--slide-${index}`).join(", ");
      slideshow.style.setProperty("--slideshow-timeline", timeline);
      slideshow.classList.toggle(
        "product-media-gallery__slideshow--single-media",
        media.length === 1,
      );
      slideshow.classList.toggle("slideshow--single-media", media.length === 1);
    }

    const grid = gallery.querySelector(":scope > .media-gallery__grid");
    const gridItemTemplate = grid?.querySelector(":scope > li");
    if (grid && gridItemTemplate) {
      const gridItems = media.map((item, index) => {
        const gridItem = gridItemTemplate.cloneNode(true);
        gridItem.setAttribute("ref", "media[]");
        this.#replaceMediaContainer(gridItem, item, index);
        return gridItem;
      });
      grid.replaceChildren(...gridItems);
    }

    this.#replaceGalleryControls(gallery, media);
    gallery.querySelector("zoom-dialog")?.remove();
  }

  #replaceMediaContainer(container, item, index) {
    container.classList.remove(
      "product-media-container--image",
      "product-media-container--video",
      "product-media-container--external_video",
      "product-media-container--model",
      "product-media-container--zoomable",
      "product-media-container--tallest",
    );
    container.classList.add(`product-media-container--${item.type || "image"}`);
    container.removeAttribute("on:click");
    container.removeAttribute("data-focal-point");
    container.removeAttribute("data-view-transition-type");
    container
      .querySelectorAll(":scope > .product-media-container__zoom-button")
      .forEach((button) => button.remove());

    const productMedia = container.querySelector(".product-media");
    if (!productMedia) return;
    const soundToggle = productMedia
      .querySelector(":scope > [data-sound-toggle]")
      ?.cloneNode(true);

    const ratio = item.width && item.height ? item.width / item.height : 1;
    container.style.setProperty("--media-preview-ratio", String(ratio));
    productMedia.style.setProperty("--ratio", String(ratio));
    productMedia.removeAttribute("data-media-id");

    if (item.type === "video") {
      const children = [];
      if (item.poster) {
        children.push(this.#createGalleryImage(item, index, true));
      }
      const deferredVideo = this.#createDeferredVideo(item);
      children.push(deferredVideo);
      if (soundToggle instanceof HTMLButtonElement) {
        soundToggle.removeAttribute("hidden");
        this.#updateSoundToggle(soundToggle, true);
        children.push(soundToggle);
      }
      productMedia.classList.add("product-media--has-sound-toggle");
      productMedia.replaceChildren(...children);
      return;
    }

    productMedia.classList.remove("product-media--has-sound-toggle");
    productMedia.replaceChildren(this.#createGalleryImage(item, index));
  }

  #createGalleryImage(item, index, usePoster = false) {
    const image = document.createElement("img");
    image.className = "product-media__image";
    image.src = usePoster ? item.poster : item.src;
    if (!usePoster && item.srcset) image.srcset = item.srcset;
    image.sizes = "(min-width: 750px) 50vw, 100vw";
    image.alt = item.alt || "";
    image.loading = index === 0 ? "eager" : "lazy";
    if (item.width) image.width = item.width;
    if (item.height) image.height = item.height;
    return image;
  }

  #createDeferredVideo(item) {
    const deferredMedia = document.createElement("deferred-media");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "button deferred-media__poster-button button-unstyled";
    button.setAttribute("ref", "deferredMediaPlayButton");
    button.setAttribute("on:click", "/showDeferredMedia");
    button.setAttribute("aria-label", item.alt || "Play product video");

    const existingIcon = document.querySelector(
      ".deferred-media__poster-icon.icon-play",
    );
    const icon =
      existingIcon?.cloneNode(true) || document.createElement("span");
    icon.classList.add("deferred-media__poster-icon", "icon-play");
    if (!icon.querySelector("svg")) {
      const playSvg = document.querySelector(".icon-play svg")?.cloneNode(true);
      if (playSvg) icon.appendChild(playSvg);
    }
    button.appendChild(icon);

    const video = document.createElement("video");
    video.autoplay = true;
    video.defaultMuted = true;
    video.muted = true;
    video.setAttribute("muted", "");
    video.playsInline = true;
    video.preload = "metadata";
    if (item.poster) video.poster = item.poster;
    item.sources.forEach((sourceData) => {
      const source = document.createElement("source");
      source.src = sourceData.url;
      if (sourceData.mimeType) source.type = sourceData.mimeType;
      video.appendChild(source);
    });

    const template = document.createElement("template");
    template.content.appendChild(video);
    deferredMedia.append(button, template);
    return deferredMedia;
  }

  #updateSoundToggle(button, muted) {
    button.setAttribute("aria-pressed", String(!muted));
    button.setAttribute("aria-label", muted ? "Unmute video" : "Mute video");
    button
      .querySelector("[data-sound-icon-muted]")
      ?.toggleAttribute("hidden", !muted);
    button
      .querySelector("[data-sound-icon-unmuted]")
      ?.toggleAttribute("hidden", muted);
  }

  #replaceGalleryControls(gallery, media) {
    gallery.querySelectorAll("slideshow-controls").forEach((controls) => {
      const thumbnails = controls.querySelector(
        ".slideshow-controls__thumbnails",
      );
      const thumbnailTemplate = thumbnails?.querySelector("button");
      if (thumbnails && thumbnailTemplate) {
        const buttons = media.map((item, index) => {
          const button = thumbnailTemplate.cloneNode(true);
          button.setAttribute("on:click", `/select/${index}`);
          button.setAttribute("ref", "thumbnails[]");
          button.setAttribute(
            "aria-label",
            `Show media ${index + 1} of ${media.length}`,
          );
          const ratio =
            item.width && item.height ? item.width / item.height : 1;
          button.style.setProperty("--aspect-ratio", String(ratio));
          if (index === 0) button.setAttribute("aria-selected", "true");
          else button.removeAttribute("aria-selected");
          button.replaceChildren(this.#createThumbnail(item));
          if (item.type === "video") {
            const badge = document.createElement("span");
            badge.className = "slideshow-controls__thumbnail-badge icon-play";
            const playSvg = document
              .querySelector(".icon-play svg")
              ?.cloneNode(true);
            if (playSvg) badge.appendChild(playSvg);
            button.appendChild(badge);
          }
          return button;
        });
        thumbnails.replaceChildren(...buttons);
      }

      const dots = controls.querySelector(
        ".slideshow-controls__dots, [class*='slideshow-controls__dots']",
      );
      const dotTemplate = dots?.querySelector("li");
      if (dots && dotTemplate) {
        const dotItems = media.map((_, index) => {
          const item = dotTemplate.cloneNode(true);
          const button = item.querySelector("button");
          if (button) {
            button.setAttribute("on:click", `/select/${index}`);
            button.setAttribute("ref", "dots[]");
            button.setAttribute(
              "aria-label",
              `Show media ${index + 1} of ${media.length}`,
            );
            button.textContent = String(index + 1);
            if (index === 0) button.setAttribute("aria-selected", "true");
            else button.removeAttribute("aria-selected");
          }
          return item;
        });
        dots.replaceChildren(...dotItems);
      }

      const counter = controls.querySelector(".slideshow-controls__counter");
      if (counter) {
        const current = document.createElement("span");
        current.setAttribute("ref", "current");
        current.textContent = "1";
        const slash = document.createElement("span");
        slash.className = "slash";
        slash.textContent = "/";
        counter.replaceChildren(current, slash, String(media.length));
      }
    });
  }

  #createThumbnail(item) {
    const image = document.createElement("img");
    image.src = item.type === "video" ? item.poster || "" : item.src;
    image.alt = item.alt || "";
    image.loading = "lazy";
    return image;
  }

  get slideshow() {
    return this.refs.slideshow;
  }

  get media() {
    return this.refs.media;
  }

  get presentation() {
    return this.dataset.presentation;
  }
}

if (!customElements.get("media-gallery")) {
  customElements.define("media-gallery", MediaGallery);
}
