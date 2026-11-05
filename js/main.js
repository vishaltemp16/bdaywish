import { CAKE } from "./cake-art.js";
import { createCake } from "./cake.js";
import { createDeck } from "./deck.js";
import { createFilm } from "./film.js";
import { createConfetti, createSky } from "./fx.js";
import { clamp, fine, follow, onceVisible, splitLetters, still } from "./util.js";

const CFG = window.BIRTHDAY || {};
const NAME = (CFG.name || "you").trim();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

document.title = `Happy Birthday, ${NAME}`;

// ------------------------------------------------------------------ Content
$$("[data-name-slot]").forEach((el) => (el.hasAttribute("data-split-letters") ? splitLetters(el, NAME) : (el.textContent = NAME)));
$$("[data-name-text]").forEach((el) => (el.textContent = NAME));
$$("[data-split]").forEach((el) => splitLetters(el, el.textContent));
$("[data-date]").textContent = CFG.date || "";
$("[data-from]").textContent = CFG.from || "your friends";

const letter = $("[data-letter]");
const words = [];
const paragraphs = Array.isArray(CFG.letter) ? CFG.letter : (CFG.letter || "").split(/\n\s*\n/);
paragraphs.filter((paragraph) => paragraph.trim()).forEach((paragraph) => {
  const p = document.createElement("p");
  paragraph.trim().split(/\s+/).forEach((word, index) => {
    const span = document.createElement("span");
    span.className = "w";
    span.textContent = word;
    if (index) p.append(" ");
    p.append(span);
    words.push(span);
  });
  letter.append(p);
});
const signature = $("[data-letter-from]");
signature.textContent = CFG.letterFrom || "";
signature.hidden = !CFG.letterFrom;

const notes = $("[data-notes]");
(CFG.messages || []).forEach((message, index) => {
  const note = document.createElement("article");
  note.className = "note";
  note.dataset.reveal = "";
  note.style.setProperty("--r", `${(((index * 37) % 7) - 3) * 0.45}deg`);
  note.style.transitionDelay = `${(index % 3) * 0.08}s`;
  const text = document.createElement("p");
  text.textContent = message.text;
  const from = document.createElement("footer");
  from.textContent = message.from;
  note.append(text, from);
  notes.append(note);
});
if (!notes.children.length) $("#notes").hidden = true;
$$(".section-head, .letter-dear, .cake-slot, .film-frame, .finale-inner").forEach((el) => (el.dataset.reveal = ""));

// ------------------------------------------------------------------ Pieces
const confetti = createConfetti($(".confetti"));
const sky = createSky($(".hero-canvas"));
const deck = createDeck($("#memories"), CFG.photos || []);

let music = null;
const soundButton = $("[data-sound]");
if (CFG.music) {
  music = new Audio(CFG.music);
  music.loop = true;
  music.volume = 0;
  soundButton.hidden = false;
  soundButton.setAttribute("aria-pressed", "false");
}
let musicOn = false;
let musicDucked = false;
function fadeMusic() {
  if (!music) return;
  const target = musicOn && !musicDucked ? 0.55 : 0;
  cancelAnimationFrame(fadeMusic.frame);
  const step = () => {
    music.volume = clamp(music.volume + Math.sign(target - music.volume) * 0.02, 0, 1);
    if (Math.abs(music.volume - target) > 0.02) fadeMusic.frame = requestAnimationFrame(step);
    else {
      music.volume = target;
      if (!target) music.pause();
    }
  };
  if (target) music.play().catch(() => {});
  step();
}
soundButton.addEventListener("click", () => {
  musicOn = !musicOn;
  soundButton.setAttribute("aria-pressed", String(musicOn));
  fadeMusic();
});

const film = createFilm($("[data-film]"), CFG.video || {}, {
  onPlay(muted) {
    musicDucked = !muted;
    fadeMusic();
  },
  onPause() {
    musicDucked = false;
    fadeMusic();
  },
});

const wishDone = $("[data-wish-done]");
const relightButton = $("[data-relight]");
const blowButton = $("[data-blow]");
const micButton = $("[data-mic]");
const cake = createCake($("[data-cake-slot]"), {
  name: NAME,
  onWish() {
    wishDone.textContent = "Wish sent. It's already on its way.";
    relightButton.hidden = false;
    blowButton.hidden = true;
    micButton.setAttribute("aria-pressed", "false");
    confetti.from(cake.stage);
  },
  onRelight() {
    wishDone.textContent = "";
    relightButton.hidden = true;
    blowButton.hidden = false;
  },
});
blowButton.addEventListener("click", () => cake.blow(1));
relightButton.addEventListener("click", () => cake.relight());
if (!navigator.mediaDevices?.getUserMedia) micButton.hidden = true;
micButton.addEventListener("click", async () => {
  try {
    const on = await cake.listen();
    micButton.setAttribute("aria-pressed", String(on));
    if (on) wishDone.textContent = "Listening… blow!";
    else if (wishDone.textContent.startsWith("Listening")) wishDone.textContent = "";
  } catch {
    wishDone.textContent = "No microphone? Just tap the cake.";
  }
});
$("[data-cake-slot]").addEventListener("mic", () => micButton.setAttribute("aria-pressed", "false"));

// ------------------------------------------------------------------ Smooth scroll
let lenis = null;
if (window.Lenis) {
  lenis = new Lenis({ autoRaf: true, anchors: true, allowNestedScroll: true, stopInertiaOnNavigate: true });
  lenis.stop();
}
history.scrollRestoration = "manual";
scrollTo(0, 0);

// ------------------------------------------------------------------ Loader
const loader = $("#loader");
const pctOut = $("[data-loader-pct]");
const labelOut = $("[data-loader-label]");
const barOut = $(".loader-bar span");
const openButton = $("[data-open]");

const LABELS = ["wrapping your gift", "lighting the candles", "developing the photos", "rolling the film", "almost there"];
const photoSources = [...(CFG.photos || []).map((photo) => photo.src), CAKE.src];
const tasks = [
  document.fonts ? document.fonts.ready : Promise.resolve(),
  ...photoSources.map((src) => new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = src;
  })),
  film.ready,
  new Promise((resolve) => setTimeout(resolve, still.matches ? 400 : 2900)),
];
let done = 0;
let shownPct = 0;
const started = performance.now();
tasks.forEach((task) => task.then(() => done++));
(function count() {
  const want = (done / tasks.length) * 100;
  const timeShare = Math.min(1, (performance.now() - started) / 2900) * 100;
  shownPct = follow(shownPct, Math.min(want, timeShare + 8), 1 / 60, 0.25);
  const pct = Math.min(100, Math.round(done === tasks.length ? Math.max(shownPct, 99.6) : shownPct));
  pctOut.textContent = String(pct);
  barOut.style.transform = `scaleX(${pct / 100})`;
  labelOut.textContent = LABELS[Math.min(LABELS.length - 1, Math.floor((pct / 100) * LABELS.length))];
  if (pct < 100) requestAnimationFrame(count);
})();
Promise.race([Promise.all(tasks), new Promise((resolve) => setTimeout(resolve, 9000))]).then(() => {
  setTimeout(() => {
    pctOut.textContent = "100";
    barOut.style.transform = "scaleX(1)";
    loader.classList.add("is-ready");
    openButton.hidden = false;
    openButton.focus({ preventScroll: true });
  }, 350);
});

openButton.addEventListener("click", () => {
  film.unlock();
  if (music) {
    musicOn = true;
    soundButton.setAttribute("aria-pressed", "true");
    fadeMusic();
  }
  loader.classList.add("is-opening");
  document.body.classList.remove("is-loading");
  document.body.classList.add("is-open");
  lenis?.start();
  sky.draw();
  setTimeout(() => confetti.burst({ x: 0.5, y: 0.62, count: 90, spread: 120, speed: 900 }), 900);
  setTimeout(() => {
    loader.classList.add("is-gone");
    loader.setAttribute("aria-hidden", "true");
  }, 1700);
});

// ------------------------------------------------------------------ Reveal on scroll
const revealer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add("is-in");
      revealer.unobserve(entry.target);
    }
  }
}, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
$$("[data-reveal]").forEach((el) => revealer.observe(el));

onceVisible($("#finale"), () => confetti.cannons(), 0.55);
$("[data-again]").addEventListener("click", () => confetti.cannons());
$("[data-replay]").addEventListener("click", () => {
  if (lenis) lenis.scrollTo(0, { duration: 3 });
  else scrollTo({ top: 0, behavior: "smooth" });
});

// ------------------------------------------------------------------ Frame loop
const progressBar = $(".progress span");
const heroInner = $("[data-tilt]");
const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener("pointermove", (event) => {
  if (!fine.matches) return;
  tilt.tx = event.clientX / innerWidth - 0.5;
  tilt.ty = event.clientY / innerHeight - 0.5;
});
let last = 0;
let lit = -1;
function frame(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
  last = now;
  const max = document.documentElement.scrollHeight - innerHeight;
  progressBar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;

  tilt.x = follow(tilt.x, still.matches ? 0 : tilt.tx, dt, 0.4);
  tilt.y = follow(tilt.y, still.matches ? 0 : tilt.ty, dt, 0.4);
  if (scrollY < innerHeight) {
    const fade = clamp(scrollY / (innerHeight * 0.8), 0, 1);
    heroInner.style.transform = `translateY(${scrollY * 0.25}px) rotateX(${(-tilt.y * 10).toFixed(2)}deg) rotateY(${(tilt.x * 14).toFixed(2)}deg)`;
    heroInner.style.opacity = String(1 - fade);
  }

  const box = letter.getBoundingClientRect();
  if (box.top < innerHeight && box.bottom > 0) {
    const share = clamp((innerHeight * 0.82 - box.top) / (box.height + innerHeight * 0.2), 0, 1);
    const count = Math.round(share * words.length * 1.08);
    if (count !== lit) {
      lit = count;
      words.forEach((word, index) => word.classList.toggle("on", index < count));
    }
  }

  deck.update(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
