export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const follow = (current, target, dt, seconds) => current + (target - current) * (1 - Math.exp(-dt / seconds));
export const still = matchMedia("(prefers-reduced-motion: reduce)");
export const fine = matchMedia("(pointer: fine)");

// Splits text into letter spans (.ch, with --i for staggering) and keeps it readable to screen readers.
export function splitLetters(element, text) {
  element.textContent = "";
  element.setAttribute("aria-label", text);
  [...text].forEach((char, index) => {
    const span = document.createElement("span");
    span.setAttribute("aria-hidden", "true");
    if (char === " ") {
      span.className = "sp";
      span.innerHTML = "&nbsp;";
    } else {
      span.className = "ch";
      span.textContent = char;
    }
    span.style.setProperty("--i", String(index));
    element.append(span);
  });
}

// Calls back once when the element first scrolls into view.
export function onceVisible(element, callback, threshold = 0.2) {
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      callback();
    }
  }, { threshold });
  observer.observe(element);
}

// Tracks whether an element is on screen.
export function watchVisible(element, callback, options = { rootMargin: "100px 0px" }) {
  new IntersectionObserver((entries) => callback(entries[entries.length - 1].isIntersecting), options).observe(element);
}

export function random(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
