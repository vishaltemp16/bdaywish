import { clamp, still, watchVisible } from "./util.js";

const WARM = ["255,179,92", "255,138,61", "255,214,170", "255,154,168", "255,236,200"];

// Floating candle-light bokeh behind the hero name.
export function createSky(canvas) {
  const ctx = canvas.getContext("2d");
  const motes = [];
  let width = 0;
  let height = 0;
  let ratio = 1;
  let frame = 0;
  let visible = false;
  let last = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function size() {
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const want = Math.round(clamp((width * height) / 16000, 28, 90));
    while (motes.length < want) motes.push(mote(true));
    motes.length = want;
  }

  function mote(anywhere) {
    const depth = Math.random();
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.1,
      r: 2 + depth * depth * 34,
      depth,
      rise: 0.006 + Math.random() * 0.02,
      sway: Math.random() * Math.PI * 2,
      alpha: 0.05 + Math.random() * 0.22 * (1 - depth * 0.5),
      color: WARM[(Math.random() * WARM.length) | 0],
      twinkle: 0.6 + Math.random() * 1.8,
    };
  }

  function draw(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    pointer.x += (pointer.tx - pointer.x) * (1 - Math.exp(-dt / 0.6));
    pointer.y += (pointer.ty - pointer.y) * (1 - Math.exp(-dt / 0.6));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";
    const t = now / 1000;
    for (const m of motes) {
      if (!still.matches) {
        m.y -= m.rise * dt * (0.4 + m.depth);
        m.sway += dt * 0.4;
      }
      if (m.y < -0.15) Object.assign(m, mote(false));
      const px = m.x * width + Math.sin(m.sway) * 18 + pointer.x * 30 * (m.depth + 0.2);
      const py = m.y * height + pointer.y * 22 * (m.depth + 0.2);
      const a = m.alpha * (0.75 + 0.25 * Math.sin(t * m.twinkle + m.sway));
      const g = ctx.createRadialGradient(px, py, 0, px, py, m.r);
      g.addColorStop(0, `rgba(${m.color},${a})`);
      g.addColorStop(0.55, `rgba(${m.color},${a * 0.35})`);
      g.addColorStop(1, `rgba(${m.color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    frame = visible && !still.matches ? requestAnimationFrame(draw) : 0;
  }

  const run = () => {
    if (!frame && visible) {
      last = 0;
      frame = requestAnimationFrame(draw);
    }
  };
  size();
  addEventListener("resize", size);
  addEventListener("pointermove", (event) => {
    pointer.tx = event.clientX / innerWidth - 0.5;
    pointer.ty = event.clientY / innerHeight - 0.5;
  });
  watchVisible(canvas, (on) => {
    visible = on;
    run();
  });
  return { draw: () => requestAnimationFrame(draw) };
}

// Paper confetti on a fixed full-screen canvas.
export function createConfetti(canvas) {
  const ctx = canvas.getContext("2d");
  const colors = ["#ffb35c", "#ff8a3d", "#ff9aa8", "#f4ead9", "#ffd36e", "#f6c1ff", "#9ad6c8"];
  let bits = [];
  let frame = 0;
  let last = 0;
  let ratio = 1;

  function size() {
    ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * ratio);
    canvas.height = Math.round(innerHeight * ratio);
  }

  function burst({ x = 0.5, y = 0.5, count = 140, angle = -90, spread = 70, speed = 900, gravity = 1500 } = {}) {
    if (still.matches) count = Math.round(count / 4);
    for (let i = 0; i < count; i++) {
      const a = ((angle + (Math.random() - 0.5) * spread) * Math.PI) / 180;
      const v = speed * (0.45 + Math.random() * 0.75);
      bits.push({
        x: x * innerWidth,
        y: y * innerHeight,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        g: gravity * (0.8 + Math.random() * 0.4),
        w: 6 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        spin: (Math.random() - 0.5) * 14,
        rot: Math.random() * Math.PI,
        flip: Math.random() * Math.PI * 2,
        flipRate: 6 + Math.random() * 10,
        color: colors[(Math.random() * colors.length) | 0],
        round: Math.random() < 0.25,
        life: 0,
        max: 3.2 + Math.random() * 1.6,
      });
    }
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    const elapsed = last ? (now - last) / 1000 : 1 / 60;
    const dt = Math.min(elapsed, 1 / 30);
    last = now;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) {
      b.life += elapsed;
      b.vx *= Math.exp(-dt * 1.6);
      b.vy = b.vy * Math.exp(-dt * 1.6) + b.g * dt * 0.55;
      b.x += b.vx * dt + Math.sin(b.flip) * 18 * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      b.flip += b.flipRate * dt;
      const fade = clamp((b.max - b.life) / 0.6, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(1, Math.cos(b.flip));
      ctx.fillStyle = b.color;
      if (b.round) {
        ctx.beginPath();
        ctx.arc(0, 0, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    bits = bits.filter((b) => b.life < b.max && b.y < innerHeight + 40);
    frame = bits.length ? requestAnimationFrame(tick) : 0;
    if (!frame) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  size();
  addEventListener("resize", size);
  return {
    burst,
    cannons() {
      burst({ x: 0, y: 1, angle: -60, spread: 40, count: 120, speed: 1400 });
      burst({ x: 1, y: 1, angle: -120, spread: 40, count: 120, speed: 1400 });
    },
    from(element) {
      const box = element.getBoundingClientRect();
      burst({ x: (box.left + box.width / 2) / innerWidth, y: (box.top + box.height * 0.35) / innerHeight, count: 160, spread: 100, speed: 1000 });
    },
  };
}
