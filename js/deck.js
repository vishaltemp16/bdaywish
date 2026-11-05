import { clamp, easeInOut, fine, follow, random, smoothstep, still } from "./util.js";

const touchFirst = matchMedia("(hover: none) and (pointer: coarse)").matches;

// The photo deck. On phones the top card sticks to your finger and flies off in
// whatever direction you flick it, then slips back under the deck. With a mouse,
// the section is pinned and scrolling deals the cards off to alternating sides.
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

  const rnd = random(7);
  const cards = photos.map((photo, index) => {
    const el = document.createElement("figure");
    el.className = "card";
    el.innerHTML = `<div class="card-photo"><img alt="" decoding="async" draggable="false"></div><div class="card-foot"><span>${String(index + 1).padStart(2, "0")}</span><span>${"✦"}</span></div><div class="card-shine"></div><div class="card-shade"></div>`;
    const img = el.querySelector("img");
    img.src = photo.src;
    img.alt = photo.caption || `Photo ${index + 1}`;
    deck.append(el);
    return { el, img, w: 0, h: 0, shade: el.querySelector(".card-shade"), tilt: (rnd() - 0.5) * 8, shift: (rnd() - 0.5) * 14, side: index % 2 ? 1 : -1 };
  });

  // Every card takes the shape of its photo, so nothing is cropped: the photo is
  // fitted inside the stage, then the white border and the foot go around it.
  const PAD = 10;
  const FOOT = 46;
  function fit() {
    const boxW = Math.min(deck.clientWidth * 0.94, 620);
    // Leave room under the top card for the edges of the pile beneath it.
    const boxH = Math.max(200, deck.clientHeight - 40);
    cards.forEach((card) => {
      const { naturalWidth: nw, naturalHeight: nh } = card.img;
      const ratio = nw && nh ? nw / nh : 4 / 5;
      let pw = boxW - PAD * 2;
      let ph = pw / ratio;
      if (ph > boxH - PAD - FOOT) {
        ph = boxH - PAD - FOOT;
        pw = ph * ratio;
      }
      card.w = Math.round(pw + PAD * 2);
      card.h = Math.round(ph + PAD + FOOT);
      Object.assign(card.el.style, { width: `${card.w}px`, height: `${card.h}px`, marginLeft: `${-card.w / 2}px`, marginTop: `${-card.h / 2}px` });
    });
  }
  fit();
  cards.forEach((card) => card.img.complete || card.img.addEventListener("load", fit, { once: true }));
  new ResizeObserver(fit).observe(deck);
  // How far a card has to travel before it counts as thrown, and how fast the next one rises.
  const reach = () => Math.min(deck.clientWidth, 400);

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
  }

  function place(card, { x, y, z, rx = 0, ry = 0, rz = 0, scale = 1, opacity = 1, shade = 0, layer }) {
    card.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
    card.el.style.opacity = opacity.toFixed(3);
    card.el.style.zIndex = String(layer);
    card.el.style.visibility = opacity < 0.01 ? "hidden" : "visible";
    card.shade.style.opacity = shade.toFixed(3);
  }

  const onScreen = () => {
    const box = section.getBoundingClientRect();
    return box.bottom > -50 && box.top < innerHeight + 50;
  };

  return { update: touchFirst ? swipeDeck() : scrollDeck() };

  // ---------------------------------------------------------------- Phones: grab and flick
  function swipeDeck() {
    section.classList.add("is-swipe");
    cards.forEach((card) => card.el.setAttribute("data-lenis-prevent", ""));
    hint.textContent = "drag a card · flick it away";
    const order = cards.map((_, i) => i);
    cards.forEach((card, i) => Object.assign(card, { x: 0, y: 0, vx: 0, vy: 0, rot: 0, spin: 0, grab: 1, depth: i, fade: 1, mode: "stack", flownAt: 0 }));
    let drag = null;
    let thrown = 0;
    let touched = false;
    let last = 0;

    const velocityOf = (samples) => {
      const now = samples[samples.length - 1];
      const then = samples.find((s) => now[0] - s[0] < 110) || samples[0];
      const dt = Math.max(16, now[0] - then[0]) / 1000;
      return [(now[1] - then[1]) / dt, (now[2] - then[2]) / dt];
    };

    deck.addEventListener("pointerdown", (event) => {
      const card = cards[order[0]];
      if (drag || !card.el.contains(event.target) || card.mode === "fly") return;
      event.preventDefault();
      touched = true;
      try {
        card.el.setPointerCapture(event.pointerId);
      } catch {}
      const box = card.el.getBoundingClientRect();
      drag = { card, id: event.pointerId, ox: event.clientX - card.x, oy: event.clientY - card.y, samples: [[performance.now(), event.clientX, event.clientY]] };
      // Grabbed near the top, a card swings one way; near the bottom, the other.
      card.grab = event.clientY < box.top + box.height / 2 ? 1 : -1;
      card.mode = "drag";
    });

    deck.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { card } = drag;
      card.x = event.clientX - drag.ox;
      card.y = event.clientY - drag.oy;
      drag.samples.push([performance.now(), event.clientX, event.clientY]);
      if (drag.samples.length > 12) drag.samples.shift();
      [card.vx, card.vy] = velocityOf(drag.samples);
    });

    const release = (event) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { card } = drag;
      drag.samples.push([performance.now(), event.clientX, event.clientY]);
      const [vx, vy] = velocityOf(drag.samples);
      drag = null;
      const distance = Math.hypot(card.x, card.y);
      const speed = Math.hypot(vx, vy);
      const outward = vx * card.x + vy * card.y >= 0;
      if (event.type !== "pointercancel" && (distance > reach() * 0.3 || (speed > 520 && outward) || speed > 1100)) {
        // Off it goes, in the direction of the flick (or of the drag, if barely moving).
        const [dx, dy] = speed > 300 ? [vx / speed, vy / speed] : [card.x / (distance || 1), card.y / (distance || 1)];
        const launch = clamp(Math.max(speed, 1500), 1500, 4200);
        card.vx = dx * launch;
        card.vy = dy * launch;
        card.spin = clamp(card.vx * 0.05 * card.grab, -420, 420);
        card.mode = "fly";
        card.flownAt = performance.now();
        order.push(order.shift());
        thrown++;
        navigator.vibrate?.(8);
      } else {
        card.vx = vx * 0.25;
        card.vy = vy * 0.25;
        card.mode = "spring";
      }
    };
    deck.addEventListener("pointerup", release);
    deck.addEventListener("pointercancel", release);

    // A small nudge the first time the deck comes into view, so it's clear the cards move.
    new IntersectionObserver((entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.disconnect();
      setTimeout(() => {
        const card = cards[order[0]];
        if (touched || still.matches || card.mode !== "stack") return;
        card.grab = 1;
        card.vx = 620;
        card.vy = -60;
        card.mode = "spring";
      }, 700);
    }, { threshold: 0.6 }).observe(deck);

    return function update(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      if (!onScreen() && !cards.some((card) => card.mode === "fly")) return;
      const top = cards[order[0]];
      // While the top card is pulled away, the one beneath starts to rise.
      const pull = top.mode === "drag" || top.mode === "spring" ? clamp(Math.hypot(top.x, top.y) / (reach() * 0.55), 0, 1) : 0;

      order.forEach((index, rank) => {
        const card = cards[index];
        if (card.mode === "drag") {
          card.rot = card.x * 0.07 * card.grab;
          place(card, { x: card.x, y: card.y, z: 40, rx: clamp(-card.vy * 0.006, -14, 14), ry: clamp(card.vx * 0.006, -14, 14), rz: card.rot, scale: 1.04, layer: 1001 });
          return;
        }
        if (card.mode === "spring") {
          const stiff = 260;
          const damp = 20;
          for (let i = 0; i < 4; i++) {
            const h = dt / 4;
            card.vx += (-stiff * card.x - damp * card.vx) * h;
            card.vy += (-stiff * card.y - damp * card.vy) * h;
            card.x += card.vx * h;
            card.y += card.vy * h;
          }
          card.rot = card.x * 0.07 * card.grab;
          if (Math.hypot(card.x, card.y) < 0.3 && Math.hypot(card.vx, card.vy) < 4) {
            card.x = card.y = card.rot = card.vx = card.vy = 0;
            card.mode = "stack";
          }
          place(card, { x: card.x, y: card.y, z: 20, rx: clamp(-card.vy * 0.004, -10, 10), ry: clamp(card.vx * 0.004, -10, 10), rz: card.rot, scale: 1 + Math.min(1, Math.hypot(card.x, card.y) / 60) * 0.04, layer: 1001 });
          return;
        }
        if (card.mode === "fly") {
          const slow = Math.exp(-dt * 0.5);
          card.vx *= slow;
          card.vy *= slow;
          card.x += card.vx * dt;
          card.y += card.vy * dt;
          card.rot += card.spin * dt;
          const gone = Math.abs(card.x) > (innerWidth + card.w) / 2 + 40 || Math.abs(card.y) > (innerHeight + card.h) / 2 + 40 || now - card.flownAt > 1600;
          if (!gone) {
            place(card, { x: card.x, y: card.y, z: 60, rx: clamp(-card.vy * 0.005, -22, 22), ry: clamp(card.vx * 0.005, -22, 22), rz: card.rot, scale: 1.04, layer: 1000 });
            return;
          }
          // Out of sight: it slips back under the deck and fades in at the bottom.
          Object.assign(card, { x: 0, y: 0, vx: 0, vy: 0, rot: 0, mode: "stack", depth: rank, fade: 0 });
        }
        const lift = rank > 0 ? pull * 0.85 : 0;
        card.depth = still.matches ? rank : follow(card.depth, rank, dt, 0.18);
        card.fade = follow(card.fade, 1, dt, 0.3);
        const d = Math.max(0, card.depth - lift);
        const settled = clamp(d, 0, 1);
        place(card, {
          x: card.shift * settled,
          y: d * 19,
          z: -d * 60,
          rz: card.tilt * settled,
          opacity: clamp(5.2 - d, 0, 1) * card.fade,
          shade: clamp(d * 0.26, 0, 0.7),
          layer: 500 - rank,
        });
      });

      show(order[0]);
      if (thrown >= count) hint.textContent = "that's everyone · keep scrolling";
      hint.style.opacity = thrown && thrown < count ? "0" : "1";
    };
  }

  // ---------------------------------------------------------------- Mouse: scroll deals the cards
  function scrollDeck() {
    // One screen to settle in, then about 80% of a screen of scrolling per card.
    section.style.height = `calc(100svh + ${(count - 1) * 80 + 40}svh)`;
    let p = 0;
    let last = 0;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, mx: 50, my: 30 };

    section.addEventListener("pointermove", (event) => {
      if (!fine.matches) return;
      const box = cards[clamp(Math.round(p), 0, count - 1)].el.getBoundingClientRect();
      pointer.tx = clamp(((event.clientX - box.left) / box.width - 0.5) * 2, -1.4, 1.4);
      pointer.ty = clamp(((event.clientY - box.top) / box.height - 0.5) * 2, -1.4, 1.4);
      pointer.mx = ((event.clientX - box.left) / box.width) * 100;
      pointer.my = ((event.clientY - box.top) / box.height) * 100;
    });
    section.addEventListener("pointerleave", () => {
      pointer.tx = 0;
      pointer.ty = 0;
    });

    return function update(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      if (!onScreen()) return;
      const box = section.getBoundingClientRect();
      const travel = Math.max(1, box.height - innerHeight);
      const raw = clamp((-box.top - innerHeight * 0.12) / (travel - innerHeight * 0.28), 0, 1) * (count - 1);
      // Hold each card for a moment before the next one is dealt.
      const whole = Math.min(Math.floor(raw), count - 1);
      const target = whole + smoothstep(0.12, 0.88, raw - whole);
      p = still.matches ? target : follow(p, target, dt, 0.09);
      if (Math.abs(target - p) < 0.0005) p = target;
      pointer.x = follow(pointer.x, pointer.tx, dt, 0.25);
      pointer.y = follow(pointer.y, pointer.ty, dt, 0.25);

      cards.forEach((card, i) => {
        const t = p - i;
        const away = (innerWidth + card.w) / 2 + 60;
        if (t > 0) {
          const e = clamp(t, 0, 1);
          const k = easeInOut(e);
          const arc = Math.sin(e * Math.PI);
          place(card, {
            x: card.side * k * away,
            y: -arc * card.h * 0.16 - k * card.h * 0.06,
            z: arc * 240,
            rx: k * 10,
            ry: card.side * k * 58,
            rz: card.side * k * 24,
            opacity: 1 - smoothstep(0.72, 1, e),
            layer: 1000 + i,
          });
        } else {
          const d = -t;
          const settled = clamp(d, 0, 1);
          const top = d < 0.5;
          place(card, {
            x: card.shift * settled,
            y: d * 19,
            z: -d * 60,
            rx: top ? -pointer.y * 9 : 0,
            ry: top ? pointer.x * 12 : 0,
            rz: card.tilt * settled,
            opacity: clamp(5.2 - d, 0, 1),
            shade: clamp(d * 0.26, 0, 0.7),
            layer: 500 - i,
          });
        }
        if (Math.abs(t) < 0.5) {
          card.el.style.setProperty("--mx", `${pointer.mx}%`);
          card.el.style.setProperty("--my", `${pointer.my}%`);
          card.el.style.setProperty("--shine", String(Math.min(1, Math.hypot(pointer.x, pointer.y))));
        } else card.el.style.setProperty("--shine", "0");
      });
      const index = clamp(Math.round(p), 0, count - 1);
      show(index);
      hint.style.opacity = index === 0 ? "1" : "0";
    };
  }
}
