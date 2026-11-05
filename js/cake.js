import { CAKE, CAKE_HTML } from "./cake-art.js";
import { clamp, follow, still, watchVisible } from "./util.js";

const NS = "http://www.w3.org/2000/svg";
const make = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};

// The live part of the "Make a wish" figure: flickering flames, blowing them out
// (tap, keyboard or a real breath into the microphone), smoke, embers, relighting.
export function createCake(slot, { name, onWish, onRelight }) {
  slot.innerHTML = CAKE_HTML;
  const stage = slot.querySelector(".cake-stage");
  const fx = stage.querySelector(".cake-fx");
  const readout = slot.querySelector("[data-readout]");
  const flameLayer = fx.querySelector('[data-part="flames"]');
  const smokeLayer = fx.querySelector('[data-part="smoke"]');
  const glow = fx.querySelector('[data-part="glow"]');
  const embers = [...fx.querySelectorAll(".cake-ember")];
  const section = slot.closest("section");

  const topperName = fx.querySelector('[data-part="topper-name"]');
  topperName.textContent = name;
  const fitName = () => {
    topperName.removeAttribute("textLength");
    if (topperName.getComputedTextLength() > 60) {
      topperName.setAttribute("textLength", "60");
      topperName.setAttribute("lengthAdjust", "spacingAndGlyphs");
    }
  };
  document.fonts?.ready.then(fitName);
  fitName();

  const defs = fx.querySelector("defs");
  defs.insertAdjacentHTML(
    "beforeend",
    `<radialGradient id="flame-outer" cx=".5" cy=".9" r=".9" fx=".5" fy=".95"><stop offset="0" stop-color="#fff6d8"/><stop offset=".35" stop-color="#ffd27a"/><stop offset=".7" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff5a14" stop-opacity=".2"/></radialGradient>
     <radialGradient id="flame-core" cx=".5" cy=".85" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#fff3c8"/><stop offset="1" stop-color="#ffe39a" stop-opacity="0"/></radialGradient>
     <radialGradient id="flame-halo"><stop offset="0" stop-color="#ffc067" stop-opacity=".55"/><stop offset=".4" stop-color="#ff9a45" stop-opacity=".16"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
     <linearGradient id="flame-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb6ff" stop-opacity="0"/><stop offset="1" stop-color="#5a8dff" stop-opacity=".75"/></linearGradient>`,
  );

  const u = CAKE.unit;
  const h = 10 * u;
  const w = 2.9 * u;
  const tear = (height, width) =>
    `M0 ${-height}C${width * 0.45} ${-height * 0.62} ${width} ${-height * 0.32} ${width * 0.72} ${-height * 0.08}Q0 ${height * 0.16} ${-width * 0.72} ${-height * 0.08}C${-width} ${-height * 0.32} ${-width * 0.45} ${-height * 0.62} 0 ${-height}Z`;

  const flames = CAKE.wicks.map(([x, y], index) => {
    const group = make("g", { transform: `translate(${x} ${y})` });
    const halo = make("circle", { cy: -h * 0.45, r: h * 2.1, fill: "url(#flame-halo)" });
    const body = make("g");
    body.append(
      make("path", { d: tear(h, w), fill: "url(#flame-outer)" }),
      make("ellipse", { cx: 0, cy: -h * 0.12, rx: w * 0.42, ry: h * 0.16, fill: "url(#flame-blue)" }),
      make("path", { d: tear(h * 0.5, w * 0.48), transform: `translate(0 ${-h * 0.04})`, fill: "url(#flame-core)" }),
    );
    group.append(halo, body);
    flameLayer.append(group);
    return { group, halo, body, x, y, level: 1, target: 1, outAt: 0, seed: index * 1.7 + Math.random() * 3, gust: 0.8 + Math.random() * 0.5 };
  });

  let wind = 0;
  let windTarget = 0;
  let clock = 0;
  let frame = 0;
  let last = 0;
  let visible = false;
  let wished = false;
  let wisps = [];
  let mic = null;

  const litCount = () => flames.filter((f) => f.target > 0).length;
  function say() {
    const lit = litCount();
    const text = lit ? `${lit} candle${lit > 1 ? "s" : ""} lit` : "wish made";
    if (readout.textContent !== text) readout.textContent = text;
  }

  function puff({ x, y }) {
    for (let i = 0; i < 2; i++) {
      const path = make("path", { "stroke-width": (0.8 + i * 0.5).toFixed(1) });
      smokeLayer.append(path);
      wisps.push({ path, x, y, age: -i * 0.25, life: 3 + Math.random(), seed: Math.random() * 10, drift: (Math.random() - 0.3) * 6 });
    }
  }

  // Strength 1 puts every candle out; less leaves a few for a second try.
  function blow(strength = 1) {
    if (!litCount()) return;
    windTarget = Math.max(windTarget, 0.5 + strength * 0.5);
    const order = flames.filter((f) => f.target > 0).sort(() => Math.random() - 0.5);
    order.forEach((flame, i) => {
      if (strength < 1 && Math.random() > strength * 1.15) return;
      flame.outAt = clock + 0.18 + i * (0.5 / order.length) + Math.random() * 0.18;
    });
    run();
  }

  function relight() {
    wished = false;
    flames.forEach((flame, i) => {
      flame.outAt = 0;
      flame.target = 1;
      flame.level = 0;
      flame.lightAt = clock + 0.15 + i * 0.14;
    });
    say();
    onRelight?.();
    run();
  }

  function tick(now) {
    const elapsed = last ? Math.min((now - last) / 1000, 0.5) : 1 / 60;
    const dt = Math.min(elapsed, 1 / 30);
    last = now;
    clock += elapsed;
    if (mic) windTarget = Math.max(windTarget, mic.level());
    wind = follow(wind, windTarget, dt, windTarget > wind ? 0.08 : 0.5);
    windTarget = Math.max(0, windTarget - dt * 1.4);

    let total = 0;
    let busy = wind > 0.01 || wisps.length > 0;
    flames.forEach((flame, i) => {
      if (flame.outAt && clock >= flame.outAt) {
        flame.outAt = 0;
        flame.target = 0;
        embers[i].style.opacity = "1";
        embers[i].dataset.at = String(clock);
        puff(flame);
        say();
      }
      if (flame.lightAt && clock >= flame.lightAt) {
        flame.lightAt = 0;
        embers[i].style.opacity = "0";
      }
      const want = flame.lightAt ? 0 : flame.target;
      flame.level = still.matches ? want : follow(flame.level, want, dt, want > flame.level ? 0.18 : 0.07);
      if (Math.abs(flame.level - want) > 0.002 || flame.lightAt || flame.outAt) busy = true;
      const s = flame.seed;
      const flick = still.matches ? 0 : Math.sin(clock * 11 + s) * 0.5 + Math.sin(clock * 17.3 + s * 2.1) * 0.3 + Math.sin(clock * 5.1 + s * 0.7) * 0.2;
      const gust = wind * flame.gust;
      const lean = -(gust * 32 + flick * 3.5);
      const sy = flame.level * (1 + flick * 0.07 - gust * 0.32);
      const sx = flame.level * (1 - flick * 0.035 + gust * 0.1);
      flame.body.setAttribute("transform", `skewX(${lean.toFixed(2)}) scale(${Math.max(0, sx).toFixed(3)} ${Math.max(0, sy).toFixed(3)})`);
      flame.halo.setAttribute("opacity", (flame.level * (0.85 + flick * 0.12)).toFixed(3));
      total += flame.level * (1 + flick * 0.06);
      const ember = embers[i];
      if (ember.dataset.at) {
        const age = clock - Number(ember.dataset.at);
        ember.style.opacity = String(clamp(1 - age / 2.4, 0, 1) * (0.7 + 0.3 * Math.sin(age * 20)));
        if (age > 2.4) delete ember.dataset.at;
        else busy = true;
      }
    });
    const share = total / flames.length;
    glow.setAttribute("opacity", (0.1 + share * 0.9).toFixed(3));
    section?.style.setProperty("--wish-glow", (0.04 + share * 0.12).toFixed(3));

    wisps = wisps.filter((wisp) => {
      wisp.age += elapsed;
      if (wisp.age >= wisp.life) {
        wisp.path.remove();
        return false;
      }
      if (wisp.age < 0) return true;
      const a = wisp.age;
      const length = Math.min(a * 1.6, 1) * 42 * u;
      const lift = Math.max(0, a - 0.9) * 16 * u;
      const points = [];
      for (let j = 0; j <= 18; j++) {
        const v = j / 18;
        const px = wisp.x + Math.sin(v * 5 + a * 2.2 + wisp.seed) * v * 5 * u + v * a * wisp.drift * u * 0.4;
        const py = wisp.y - lift - v * length;
        points.push(`${j ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`);
      }
      wisp.path.setAttribute("d", points.join(""));
      wisp.path.setAttribute("opacity", (0.45 * (1 - a / wisp.life) * Math.min(1, a * 4)).toFixed(3));
      return true;
    });

    if (!wished && flames.every((f) => f.target === 0 && f.level < 0.02)) {
      wished = true;
      mic?.stop();
      onWish?.();
    }
    const flickering = flames.some((f) => f.level > 0.01) && !still.matches;
    frame = visible && (busy || flickering) ? requestAnimationFrame(tick) : 0;
  }

  function run() {
    if (!frame) {
      last = 0;
      frame = requestAnimationFrame(tick);
    }
  }

  async function listen() {
    if (mic) {
      mic.stop();
      return false;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);
    let loud = 0;
    let previous = performance.now();
    mic = {
      level() {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const value of buffer) sum += value * value;
        const rms = Math.sqrt(sum / buffer.length);
        const now = performance.now();
        const dt = (now - previous) / 1000;
        previous = now;
        loud = rms > 0.09 ? loud + dt : Math.max(0, loud - dt * 2);
        if (loud > 0.16) {
          loud = 0;
          blow(clamp((rms - 0.06) * 5, 0.45, 1));
        }
        return clamp((rms - 0.02) * 6, 0, 1);
      },
      stop() {
        stream.getTracks().forEach((track) => track.stop());
        context.close();
        mic = null;
        slot.dispatchEvent(new CustomEvent("mic", { detail: false }));
      },
    };
    run();
    return true;
  }

  stage.addEventListener("click", () => blow(1));
  stage.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      blow(1);
    }
  });
  watchVisible(stage, (on) => {
    visible = on;
    if (on) run();
  });
  say();
  return { blow, relight, listen, stage };
}
