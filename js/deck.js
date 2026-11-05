import { clamp, easeInOut, fine, follow, random, smoothstep, still } from "./util.js";

// A pinned section where scrolling deals photo cards off the top of a deck.
// Each card lifts, turns in 3D and flies off to alternating sides, revealing the next.
export function createDeck(section, photos) {
  const deck = section.querySelector("[data-deck]");
  const backdrop = section.querySelector(".memories-backdrop");
  const caption = section.querySelector("[data-deck-caption]");
  const indexOut = section.querySelector("[data-deck-index]");
  const hint = section.querySelector(".deck-hint");
  const count = photos.length;
  if (!count) {
    section.hidden = true;
    return { update() {} };
  }
  section.querySelector("[data-deck-total]").textContent = String(count).padStart(2, "0");
  // One screen to settle in, then about 80% of a screen of scrolling per card.
  section.style.height = `calc(100svh + ${(count - 1) * 80 + 40}svh)`;

  const rnd = random(7);
  const cards = photos.map((photo, index) => {
    const el = document.createElement("figure");
    el.className = "card";
    el.innerHTML = `<div class="card-photo"><img alt="" decoding="async" draggable="false"></div><div class="card-foot"><span>${String(index + 1).padStart(2, "0")}</span><span>${"✦"}</span></div><div class="card-shine"></div><div class="card-shade"></div>`;
    const img = el.querySelector("img");
    img.src = photo.src;
    img.alt = photo.caption || `Photo ${index + 1}`;
    deck.append(el);
    return { el, img, shade: el.querySelector(".card-shade"), tilt: (rnd() - 0.5) * 8, shift: (rnd() - 0.5) * 14, side: index % 2 ? 1 : -1 };
  });

  // The ambient backdrop: the current photo drawn into a tiny canvas and stretched
  // over the screen, which blurs it for free. Two canvases crossfade.
  const glows = [0, 1].map(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 20;
    canvas.height = 25;
    backdrop.append(canvas);
    return canvas;
  });
  let front = 0;
  function paintBackdrop(index) {
    const { img } = cards[index];
    const paint = () => {
      front = 1 - front;
      const canvas = glows[front];
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      try {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch {}
      glows[front].classList.add("on");
      glows[1 - front].classList.remove("on");
    };
    if (img.complete && img.naturalWidth) paint();
    else img.addEventListener("load", paint, { once: true });
  }

  let shown = -1;
  let p = 0;
  let last = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0, mx: 50, my: 30 };

  section.addEventListener("pointermove", (event) => {
    if (!fine.matches) return;
    const box = deck.getBoundingClientRect();
    pointer.tx = clamp(((event.clientX - box.left) / box.width - 0.5) * 2, -1.4, 1.4);
    pointer.ty = clamp(((event.clientY - box.top) / box.height - 0.5) * 2, -1.4, 1.4);
    pointer.mx = ((event.clientX - box.left) / box.width) * 100;
    pointer.my = ((event.clientY - box.top) / box.height) * 100;
  });
  section.addEventListener("pointerleave", () => {
    pointer.tx = 0;
    pointer.ty = 0;
  });

  function show(index) {
    if (index === shown) return;
    const first = shown < 0;
    shown = index;
    indexOut.textContent = String(index + 1).padStart(2, "0");
    paintBackdrop(index);
    const text = photos[index].caption || "";
    if (first) caption.textContent = text;
    else {
      caption.classList.add("swap");
      clearTimeout(show.timer);
      show.timer = setTimeout(() => {
        caption.textContent = text;
        caption.classList.remove("swap");
      }, 260);
    }
    hint.style.opacity = index === 0 ? "1" : "0";
  }

  function update(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const box = section.getBoundingClientRect();
    if (box.bottom < -50 || box.top > innerHeight + 50) return;
    const travel = Math.max(1, box.height - innerHeight);
    const raw = clamp((-box.top - innerHeight * 0.12) / (travel - innerHeight * 0.28), 0, 1) * (count - 1);
    // Hold each card for a moment before the next one is dealt.
    const whole = Math.min(Math.floor(raw), count - 1);
    const target = whole + smoothstep(0.12, 0.88, raw - whole);
    p = still.matches ? target : follow(p, target, dt, 0.09);
    if (Math.abs(target - p) < 0.0005) p = target;
    pointer.x = follow(pointer.x, pointer.tx, dt, 0.25);
    pointer.y = follow(pointer.y, pointer.ty, dt, 0.25);

    const width = deck.offsetWidth;
    const height = deck.offsetHeight;
    const away = innerWidth / 2 + width * 0.9;
    cards.forEach((card, i) => {
      const t = p - i;
      let x;
      let y;
      let z;
      let rx = 0;
      let ry = 0;
      let rz;
      let opacity = 1;
      let shade = 0;
      let layer;
      if (t > 0) {
        const e = clamp(t, 0, 1);
        const k = easeInOut(e);
        const arc = Math.sin(e * Math.PI);
        x = card.side * k * away;
        y = -arc * height * 0.16 - k * height * 0.06;
        z = arc * 240;
        rx = k * 10;
        ry = card.side * k * 58;
        rz = card.side * k * 24;
        opacity = 1 - smoothstep(0.72, 1, e);
        layer = 1000 + i;
      } else {
        const d = -t;
        const settled = clamp(d, 0, 1);
        x = card.shift * settled;
        y = d * 19;
        z = -d * 60;
        rz = card.tilt * settled;
        opacity = clamp(5.2 - d, 0, 1);
        shade = clamp(d * 0.17, 0, 0.62);
        layer = 500 - i;
      }
      const top = Math.abs(t) < 0.5;
      if (top) {
        rx += -pointer.y * 9;
        ry += pointer.x * 12;
        card.el.style.setProperty("--mx", `${pointer.mx}%`);
        card.el.style.setProperty("--my", `${pointer.my}%`);
        card.el.style.setProperty("--shine", String(Math.min(1, Math.hypot(pointer.x, pointer.y))));
      } else card.el.style.setProperty("--shine", "0");
      card.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      card.el.style.opacity = opacity.toFixed(3);
      card.el.style.zIndex = String(layer);
      card.el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
      card.shade.style.opacity = shade.toFixed(3);
    });
    show(clamp(Math.round(p), 0, count - 1));
  }

  return { update };
}
