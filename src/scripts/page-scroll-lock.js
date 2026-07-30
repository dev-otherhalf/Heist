const LOCK_CLASS = "page-scroll-locked";

let savedScrollY = null;

export function lockPageScroll() {
  if (window.lenis) {
    window.lenis.reset();
    window.lenis.isLocked = true;
    return;
  }

  if (savedScrollY !== null) {
    return;
  }

  savedScrollY = window.scrollY;
  document.documentElement.classList.add(LOCK_CLASS);
}

export function unlockPageScroll() {
  if (window.lenis) {
    window.lenis.isLocked = false;
    return;
  }

  if (savedScrollY === null) {
    return;
  }

  document.documentElement.classList.remove(LOCK_CLASS);

  if (window.scrollY !== savedScrollY) {
    window.scrollTo(0, savedScrollY);
  }

  savedScrollY = null;
}
