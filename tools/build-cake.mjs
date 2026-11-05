// Builds the "Make a wish" figure: an isometric birthday cake on a decorating
// turntable, drawn with the anatomy kit (tools/anatomy, MIT). Writes js/cake-art.js
// and css/iso.css. Run with `npm run build` after changing `candles` in config.js.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as k from "./anatomy/iso-kit.mjs";
import * as G from "./anatomy/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(join(ROOT, "config.js"), "utf8"), sandbox);
const COUNT = Math.min(24, Math.max(1, Math.round(sandbox.window.BIRTHDAY?.candles ?? 7)));

const WIDTH = 720;
const HEIGHT = 640;
const SVG_PATH = "assets/cake.svg";

// World units are about 1 px of the real thing: x and y on the board, z up.
const BOARD = { x: -175, y: -125, w: 350, d: 250, r: 18 };
const BOARD_H = 10;
const FOOT_H = 5;
const C = [-6, -14];
const PLATE_Z = 28;
const PLATE_TOP = 33;
const PLATE_R = 80;
const DRUM_R = 72;
const DRUM_TOP = 35;
const T1 = { r: 60, z: DRUM_TOP, top: 77 };
const T2 = { r: 40, z: T1.top, top: 109 };
const CANDLE = { r: 2, holder: 3.2, z: T2.top + 1.6, h: 24 };
const WICK_TOP = CANDLE.z + CANDLE.h + 3;
const TOPPER = { y: C[1] - 37, z: 130, h: 24, w: 70 };
const GIFT = { x: 96, y: -6, w: 42, d: 42, r: 1.5 };
const GIFT_H = 30;
const LID_TOP = 37;

const P = k.fitProjection(
  [
    ...k.boxCorners(BOARD, -BOARD_H - FOOT_H, 0),
    [C[0] - TOPPER.w / 2, TOPPER.y, TOPPER.z + TOPPER.h],
    [C[0] + TOPPER.w / 2, TOPPER.y, TOPPER.z + TOPPER.h],
    [C[0], C[1], WICK_TOP + 16],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 45, elevation: 34 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const depth = ([x, y, z = 0]) => k.depthOf([x, y, z], P);
const [VX, VY] = k.towardViewer(P);
const FACING = Math.atan2(VY, VX);
const UP = (o) => G.frameOf(o, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
const tenth = (value) => Math.round(value * 10) / 10;
const pathOf = (points, closed) => points.map(([x, y], i) => `${i ? "L" : "M"}${tenth(x)} ${tenth(y)}`).join("") + (closed ? "Z" : "");

function random(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Screen points along the visible front half of a horizontal circle.
function frontArc(cx, cy, r, z, steps = 48) {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = FACING - Math.PI / 2 + (i / steps) * Math.PI;
    return at([cx + r * Math.cos(a), cy + r * Math.sin(a), z]);
  });
}

function softHalo(cx, cy, r, z = 0, blur = 6) {
  return `<path class="iso-halo" d="${k.cylinder(cx, cy, r, z, 0.1, P, 40).fill}" style="filter:blur(${blur}px)"/>`;
}

function board() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOARD, -BOARD_H - FOOT_H, BOARD_H, P)}"/>`];
  const feet = k.corners(BOARD, 26).sort((a, b) => depth(a) - depth(b));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 9, -BOARD_H - FOOT_H, 1.6, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 7, -BOARD_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BOARD, -BOARD_H, BOARD_H, P, 10, 1.6), { tone: "mid", inner: L(k.sideSeam(BOARD, -BOARD_H / 2, P, 10), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BOARD, 7), 0, P, 10), { tone: "lo" }));
  const screws = k.corners(BOARD, 13);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.6, 0, P, 18)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  // A ruler strip along the front edge, the way a decorating board is marked.
  const strip = { x: -150, y: BOARD.y + BOARD.d - 17, w: 300, d: 7, r: 1 };
  out.push(S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 2, strip.y + 3.5, 0.6]), at([strip.x + strip.w - 2, strip.y + 3.5, 0.6])], { size: 0.5 }));
  // Confetti scattered on the board.
  const rnd = random(11);
  const bits = [];
  for (let i = 0; i < 46; i++) {
    const x = BOARD.x + 14 + rnd() * (BOARD.w - 28);
    const y = BOARD.y + 14 + rnd() * (BOARD.d - 40);
    if (Math.hypot(x - C[0], y - C[1]) < 52) continue;
    const a = rnd() * Math.PI;
    const s = 1.6 + rnd() * 1.4;
    const ring = [[-s, -s * 0.6], [s, -s * 0.6], [s, s * 0.6], [-s, s * 0.6]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)]);
    bits.push({ key: depth([x, y]), svg: S(k.extrude(ring, 0, 0.4, P), { tone: rnd() > 0.5 ? "mid" : "lo", crease: "none", flat: true }) });
  }
  out.push(...bits.sort((a, b) => a.key - b.key).map((b) => b.svg));
  return out.join("");
}

function plates() {
  const [x, y] = [-126, -78];
  const out = [softHalo(x, y, 30)];
  for (let i = 0; i < 3; i++) {
    const z = i * 2.6;
    out.push(S(k.cylinder(x, y, 28, z, 2.2, P, 64, 0.8), { tone: "mid" }));
  }
  out.push(L(k.ring(x, y, 19, 7.8, P, 56), { tone: "lo" }), L(k.ring(x, y, 24.5, 7.8, P, 56), { tone: "faint" }));
  // A fork on the top plate.
  const fork = [[-14, -2], [6, -1.4], [9, -3.2], [16, -3.2], [16, 3.2], [9, 3.2], [6, 1.4], [-14, 2]];
  const angle = -0.5;
  const ring = fork.map(([u, v]) => [x + u * Math.cos(angle) - v * Math.sin(angle), y + u * Math.sin(angle) + v * Math.cos(angle)]);
  out.push(S(k.extrude(ring, 7.8, 0.7, P, { convex: false }), { tone: "hi", crease: "none" }));
  const tine = (v) => [[9, v], [16, v]].map(([u, w]) => [x + u * Math.cos(angle) - w * Math.sin(angle), y + u * Math.sin(angle) + w * Math.cos(angle)]);
  out.push(L([-1.1, 1.1].map((v) => k.onTop(tine(v), 8.5, P)).join(""), { tone: "lo" }));
  return out.join("");
}

function partyHat() {
  const [x, y] = [116, -84];
  const F = UP([x, y, 0]);
  const out = [softHalo(x, y, 18)];
  out.push(S(G.disc(0, 2, 18, F, P), { tone: "mid" }));
  out.push(S(G.solidOf([[2, 16.6], [44, 1.2]], F, P), { tone: "hi" }));
  out.push(L(G.ribsOf(F, 2.4, 42, 16.4, 9, P, { twist: 1.6, r1: 1.4 }), { tone: "lo" }));
  out.push(S(G.sphereOf([x, y, 48], 5, P), { tone: "hi" }));
  return out.join("");
}

function matchbox() {
  const sleeve = { x: -160, y: 42, w: 40, d: 26, r: 1.2 };
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(sleeve, -2), 0, 0.1, P)}" style="filter:blur(5px)"/>`];
  out.push(S(k.slabOf(sleeve, 0, 12, P, 3, 0.5), { tone: "mid" }));
  // Striker strip on the long side facing the viewer.
  const yFace = sleeve.y + sleeve.d + 0.05;
  const strike = [[-157, 3], [-123, 3], [-123, 9], [-157, 9]].map(([x, z]) => at([x, yFace, z]));
  out.push(`<path class="cake-striker" d="${pathOf(strike, true)}"/>`);
  const grit = [];
  for (let x = -155.5; x < -124; x += 2.2) for (let z = 4.2; z < 8.5; z += 1.6) grit.push(at([x + ((z * 7) % 1.1), yFace, z]));
  out.push(D(grit, { size: 0.35, tone: "lo" }));
  // Label on the lid: a frame and three printed rules.
  const label = { x: -155, y: 46, w: 30, d: 18, r: 0.8 };
  out.push(L(k.planOutline(label, 12, P, 3), { tone: "lo" }));
  out.push(L([50, 54, 58].map((yy, i) => k.lineOnTop([-151, yy], [-151 + [22, 18, 12][i], yy], 12, P)).join(""), { tone: "faint", free: true }));
  // The drawer, pulled out toward the viewer, full of match heads.
  const drawer = { x: -121, y: 43, w: 17, d: 24, r: 0.8 };
  out.push(S(k.slabOf(drawer, 0.4, 11, P, 3, 0.4), { tone: "mid" }));
  const well = k.insetPlan(drawer, 1.4);
  out.push(`<path class="cake-well" d="${k.onTop(k.ringOf(well, 3), 11.4, P, true)}"/>`);
  const heads = [];
  for (let i = 0; i < 6; i++) heads.push([-108.5 + (i % 2) * 1.6, 45.6 + i * 3.6, 10.2]);
  heads.sort((a, b) => depth(a) - depth(b));
  for (const head of heads) out.push(S(G.sphereOf(head, 1.7, P), { tone: "lo" }));
  return out.join("");
}

function spentMatch() {
  const out = [];
  const stick = { x: -112, y: 84, w: 30, d: 2.2, r: 0.4 };
  out.push(S(k.slabOf(stick, 0, 2.2, P, 2), { tone: "mid", crease: "none" }));
  out.push(S(G.sphereOf([-112.6, 85.1, 1.6], 2, P), { tone: "lo" }));
  return out.join("");
}

function cakeServer() {
  const out = [];
  const blade = [[-74, 96], [-62, 88.5], [-30, 87], [-8, 92], [-8, 100], [-30, 105], [-62, 103.5]];
  out.push(`<path class="iso-halo" d="${k.extrude(blade, 0, 0.1, P).fill}" style="filter:blur(4px)"/>`);
  out.push(S(k.extrude(blade, 0, 0.9, P, { bevel: 0.6 }), { tone: "hi" }));
  out.push(L(k.onTop([[-60, 96], [-14, 96]], 0.9, P), { tone: "faint" }));
  out.push(S(k.slabOf({ x: -9, y: 94, w: 12, d: 4, r: 1 }, 0.4, 2, P, 2), { tone: "mid" }));
  const F = G.frameOf([3, 96, 4.4], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
  out.push(S(G.disc(0, 3, 3.4, F, P), { tone: "mid", inner: L(G.arcOf(F, 1.5, 3.4, P), { tone: "faint" }) }));
  out.push(S(G.solidOf([[3, 3.2], [8, 3.9, 1], [32, 4.4, 1], [44, 3.8, 1], [47, 2.6]], F, P), { tone: "mid" }));
  out.push(D([10, 22, 34].map((s) => at(G.pointOf(F, s, 4.3, 0.35))), { size: 0.9, tone: "hi" }));
  return out.join("");
}

function gift() {
  const out = [`<path class="iso-halo" d="${k.haloOf(k.insetPlan(GIFT, -3), 0, 0.1, P)}" style="filter:blur(6px)"/>`];
  const lid = k.insetPlan(GIFT, -2);
  const mid = [GIFT.x + GIFT.w / 2, GIFT.y + GIFT.d / 2];
  out.push(S(k.slabOf(GIFT, 0, GIFT_H, P, 3, 0.5), { tone: "mid" }));
  out.push(S(k.slabOf({ x: GIFT.x - 0.4, y: mid[1] - 3, w: GIFT.w + 0.8, d: 6, r: 0.3 }, 0, GIFT_H - 2, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: mid[0] - 3, y: GIFT.y - 0.4, w: 6, d: GIFT.d + 0.8, r: 0.3 }, 0, GIFT_H - 2, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf(lid, GIFT_H - 2, LID_TOP - GIFT_H + 2, P, 3, 0.6), { tone: "mid", inner: L(k.sideSeam(lid, GIFT_H + 1.5, P, 3), { tone: "faint" }) }));
  out.push(S(k.slabOf({ x: lid.x - 0.4, y: mid[1] - 3, w: lid.w + 0.8, d: 6, r: 0.3 }, GIFT_H - 2, LID_TOP - GIFT_H + 2.4, P, 2), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf({ x: mid[0] - 3, y: lid.y - 0.4, w: 6, d: lid.d + 0.8, r: 0.3 }, GIFT_H - 2, LID_TOP - GIFT_H + 2.4, P, 2), { tone: "hi", crease: "none" }));
  // The bow: two loops standing face-on, and a knot.
  const toward = [VX, VY, 0];
  const across = [VY, -VX, 0];
  const top = LID_TOP + 0.4;
  for (const side of [-1, 1]) {
    const centre = [mid[0] + across[0] * side * 6.5, mid[1] + across[1] * side * 6.5, top + 6.2];
    const F = G.frameAlong(centre, toward);
    out.push(S(G.ringBand(-1.6, 1.6, 3.2, 6.6, F, P, { hole: [1.6, 3.2] }), { tone: "hi" }));
  }
  out.push(S(G.sphereOf([mid[0], mid[1], top + 3.4], 3.4, P), { tone: "hi" }));
  // A gift tag on a string, lying on the lid.
  const tag = [[mid[0] + 8, mid[1] + 9], [mid[0] + 16, mid[1] + 9], [mid[0] + 18, mid[1] + 12], [mid[0] + 16, mid[1] + 15], [mid[0] + 8, mid[1] + 15]];
  out.push(S(k.extrude(tag, LID_TOP + 0.4, 0.5, P), { tone: "hi", crease: "none" }));
  out.push(k.wireSvg(at([mid[0] + 3, mid[1] + 3, LID_TOP + 0.4]), at([mid[0] + 15.6, mid[1] + 12, LID_TOP + 0.9]), { via: [at([mid[0] + 9, mid[1] + 6, LID_TOP + 0.6])], tone: "lo", size: 0.8 }));
  return out.join("");
}

function turntable() {
  const [x, y] = C;
  const out = [softHalo(x, y, 50, 0, 8)];
  out.push(S(k.cylinder(x, y, 46, 0, 3, P, 72, 0.6), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 34, 3, 7, P, 72, 1), { tone: "mid" }));
  // Lock screw on the base, pointing at the viewer.
  const la = FACING + 0.45;
  const F = G.frameAlong([x + 33.6 * Math.cos(la), y + 33.6 * Math.sin(la), 6.5], [Math.cos(la), Math.sin(la), 0]);
  out.push(S(G.disc(0, 5, 1.8, F, P), { tone: "mid" }));
  out.push(S(G.disc(5, 9.5, 3.6, F, P, { bevel: 0.4 }), { tone: "mid" }));
  out.push(L(G.ribsOf(F, 5.4, 9.1, 3.6, 22, P), { tone: "lo" }));
  out.push(S(k.cylinder(x, y, 8.5, 10, 14, P, 40), { tone: "mid", crease: "none", inner: L(k.sideArc(x, y, 8.5, 17, P, 20), { tone: "faint" }) }));
  out.push(S(k.cylinder(x, y, 16, 24, 4, P, 48, 0.5), { tone: "mid" }));
  out.push(S(k.cylinder(x, y, PLATE_R, PLATE_Z, PLATE_TOP - PLATE_Z, P, 120, 1.2), { tone: "mid" }));
  out.push(L(k.knurl(x, y, PLATE_R, PLATE_Z, PLATE_TOP, 150, P, 0.6), { tone: "faint" }));
  const ticks = k.radialTicks(x, y, PLATE_R - 1.6, 72, 6, PLATE_TOP, [2, 4.4], P);
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.2, PLATE_TOP, P, 12), { tone: "lo" }));
  return out.join("");
}

function beads(cx, cy, r, z, count, size) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    if (Math.cos(a - FACING) < -0.02) continue;
    points.push(at([cx + r * Math.cos(a), cy + r * Math.sin(a), z]));
  }
  return D(points, { size, tone: "hi" });
}

function drips(tier, count, seed, longest) {
  const rnd = random(seed);
  const [cx, cy] = C;
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.12;
    const len = 3.5 + rnd() * longest;
    const half = 1.6 + rnd() * 1.4;
    if (Math.cos(a - FACING) < 0.08) continue;
    const da = half / tier.r;
    const p = (angle, z, r = tier.r + 0.25) => at([cx + r * Math.cos(angle), cy + r * Math.sin(angle), z]);
    const pts = [];
    for (let s = 0; s <= 6; s++) pts.push(p(a - da * 1.9 + (s / 6) * da * 3.8, tier.top));
    pts.push(p(a + da, tier.top - 1.5));
    const bottom = tier.top - len + half;
    for (let s = 0; s <= 10; s++) {
      const phi = (s / 10) * Math.PI;
      pts.push(p(a + da * Math.cos(phi), bottom - half * Math.sin(phi)));
    }
    pts.push(p(a - da, tier.top - 1.5));
    out.push({ key: Math.cos(a - FACING), svg: `<path class="cake-drip" d="${pathOf(pts, true)}"/>` });
  }
  return out.sort((x, y) => x.key - y.key).map((d) => d.svg).join("");
}

function ribbon(tier, z0, z1) {
  const [cx, cy] = C;
  const r = tier.r + 0.3;
  const band = [...frontArc(cx, cy, r, z0), ...frontArc(cx, cy, r, z1).reverse()];
  return `<path class="cake-band" d="${pathOf(band, true)}"/>` + L(k.sideArc(cx, cy, r, z0, P, 60) + k.sideArc(cx, cy, r, z1, P, 60), { tone: "lo" });
}

function sprinkles(r0, r1, z, count, seed, avoid = []) {
  const rnd = random(seed);
  const [cx, cy] = C;
  const mid = [];
  const hi = [];
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = r0 + rnd() * (r1 - r0);
    const x = cx + r * Math.cos(a);
    const y = cy + r * Math.sin(a);
    if (avoid.some(([ax, ay]) => Math.hypot(ax - x, ay - y) < 5)) continue;
    const t = rnd() * Math.PI;
    const d = k.lineOnTop([x - 1.3 * Math.cos(t), y - 1.3 * Math.sin(t)], [x + 1.3 * Math.cos(t), y + 1.3 * Math.sin(t)], z, P);
    (i % 2 ? mid : hi).push(d);
  }
  return `<g class="cake-sprinkles">${L(mid.join(""), { tone: "mid" })}${L(hi.join(""), { tone: "hi" })}</g>`;
}

function candleSpots() {
  const [cx, cy] = C;
  if (COUNT === 1) return [[cx, cy]];
  const rings = COUNT <= 10 ? [[COUNT, 22]] : [[Math.ceil(COUNT * 0.62), 28], [COUNT - Math.ceil(COUNT * 0.62), 14]];
  const spots = [];
  for (const [n, r] of rings) {
    for (let i = 0; i < n; i++) {
      const a = FACING + Math.PI / n + (i / n) * Math.PI * 2;
      spots.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return spots;
}

function candle([x, y], index) {
  const F = UP([x, y, CANDLE.z]);
  const out = [];
  out.push(S(k.cylinder(x, y, CANDLE.holder, T2.top, CANDLE.z - T2.top + 0.4, P, 24, 0.3), { tone: "mid" }));
  out.push(D(Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return at([x + 2.6 * Math.cos(a), y + 2.6 * Math.sin(a), CANDLE.z + 0.4]);
  }), { size: 0.45, tone: "lo" }));
  out.push(S(k.cylinder(x, y, CANDLE.r, CANDLE.z, CANDLE.h, P, 24), { tone: "hi", lit: true, inner: L(G.ribsOf(F, 0.6, CANDLE.h - 0.6, CANDLE.r, 4, P, { twist: 2.2, phase: index }), { tone: "mid" }) }));
  out.push(L(k.ring(x, y, 1.1, CANDLE.z + CANDLE.h, P, 12), { tone: "faint" }));
  out.push(`<path class="iso-line cake-wick" data-tone="hi" d="${k.segment([x, y, CANDLE.z + CANDLE.h], [x + 0.4, y, WICK_TOP], P)}" style="stroke-width:1"/>`);
  return out.join("");
}

function topper() {
  const [cx] = C;
  const out = [];
  for (const dx of [-14, 14]) out.push(S(k.cylinder(cx + dx, TOPPER.y + 1, 0.9, T2.top - 2, TOPPER.z - T2.top + 8, P, 12), { tone: "mid", crease: "none" }));
  const card = { x: cx - TOPPER.w / 2, y: TOPPER.y, w: TOPPER.w, d: 2, r: 0.6 };
  out.push(S(k.slabOf(card, TOPPER.z, TOPPER.h, P, 2, 0.4), { tone: "hi", lit: true }));
  return out.join("");
}

// The topper's words go in the live overlay, so they use the page's fonts and the real name.
function topperText() {
  const face = TOPPER.y + 2.05;
  return (
    `<g class="cake-topper-text">` +
    k.faceTextSvg(k.sideMatrix([C[0], face], TOPPER.z + TOPPER.h - 8.6, P, "left"), "HAPPY BIRTHDAY", { size: 5.4, tone: "mid", anchor: "middle" }) +
    k.faceTextSvg(k.sideMatrix([C[0], face], TOPPER.z + 4.2, P, "left"), "you", { size: 8.4, tone: "hi", anchor: "middle" }).replace("<text ", '<text data-part="topper-name" ') +
    `</g>`
  );
}

function cake() {
  const [cx, cy] = C;
  const out = [];
  out.push(S(k.cylinder(cx, cy, DRUM_R, PLATE_TOP, DRUM_TOP - PLATE_TOP, P, 120, 0.6), { tone: "lo" }));
  out.push(`<path class="iso-halo" d="${k.cylinder(cx, cy, T1.r + 2, DRUM_TOP, 0.1, P, 60).fill}" style="filter:blur(3px);opacity:.6"/>`);
  out.push(S(k.cylinder(cx, cy, T1.r, T1.z, T1.top - T1.z, P, 120, 1), { tone: "hi" }));
  out.push(ribbon(T1, T1.z + 9, T1.z + 15));
  out.push(beads(cx, cy, T1.r + 1, T1.z + 1.6, 96, 1.7));
  out.push(drips(T1, 34, 3, 13));
  out.push(beads(cx, cy, T1.r - 3.6, T1.top + 0.6, 104, 1.1));
  out.push(sprinkles(T2.r + 3, T1.r - 7, T1.top, 70, 5));
  out.push(`<path class="iso-halo" d="${k.cylinder(cx, cy, T2.r + 1.5, T1.top, 0.1, P, 60).fill}" style="filter:blur(3px);opacity:.55"/>`);
  out.push(S(k.cylinder(cx, cy, T2.r, T2.z, T2.top - T2.z, P, 96, 1), { tone: "hi" }));
  out.push(beads(cx, cy, T2.r + 1, T2.z + 1.5, 72, 1.6));
  out.push(drips(T2, 26, 9, 9));
  const spots = candleSpots();
  out.push(sprinkles(5, T2.r - 9, T2.top, 46, 7, spots));
  // Everything standing on the top tier, painted back to front.
  const items = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const p = [cx + 35.5 * Math.cos(a), cy + 35.5 * Math.sin(a), T2.top + 1.6];
    items.push({ key: depth(p), svg: S(G.sphereOf(p, 2.3, P), { tone: "hi" }) });
  }
  items.push({ key: depth([cx, TOPPER.y + 1, 0]), svg: topper() });
  spots.forEach((spot, index) => items.push({ key: depth(spot), svg: candle(spot, index) }));
  out.push(...items.sort((a, b) => a.key - b.key).map((item) => item.svg));
  return { svg: out.join(""), spots };
}

const cakeArt = cake();
const scene = [
  { key: depth([-126, -78]), svg: plates() },
  { key: depth([116, -84]), svg: partyHat() },
  { key: depth([-140, 55]), svg: matchbox() },
  { key: depth(C), svg: turntable() + cakeArt.svg },
  { key: depth([117, 15]), svg: gift() },
  { key: depth([-100, 85]), svg: spentMatch() },
  { key: depth([-20, 96]), svg: cakeServer() },
].sort((a, b) => a.key - b.key);

const glowAt = at([C[0], C[1], T2.top + 10]);
const LABEL = `A two-tier birthday cake on a decorating turntable, with ${COUNT} lit candle${COUNT > 1 ? "s" : ""} and a Happy Birthday topper. Around it on the board: a stack of plates with a fork, a party hat, an open matchbox, a spent match, a cake server and a wrapped gift.`;

// The static drawing ships as its own SVG file, shown with <img>, so the browser
// rasterises it once. It carries its own styles: the kit's, the page's warm
// palette, and SVG blur filters (CSS blur() on SVG shapes is unreliable in Safari).
const WARM = `.iso{--anatomy-card:#120e0b;--anatomy-paper:#120e0b;--anatomy-face:#1d1712;--anatomy-top:#211a14;--anatomy-shade-0:#0e0b08;--anatomy-shade-1:#120e0b;--anatomy-shade-2:#16110d;--anatomy-shade-3:#1b1510;--anatomy-lit-top:#2e241b;--anatomy-lit-shade:#231b15;--anatomy-hi:#eadcc9;--anatomy-mid:#85735f;--anatomy-lo:#4a3d31;--anatomy-faint:#30261e;--anatomy-lit:#fff3df;--anatomy-halo:#030201;--anatomy-dot:#f4e6d2}
.iso-halo{filter:url(#b9)}
.cake-drip{fill:var(--anatomy-top);stroke:var(--anatomy-hi);stroke-width:.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.cake-band{fill:var(--anatomy-shade-0);opacity:.9}
.cake-striker{fill:#2a1a14;stroke:var(--anatomy-lo);stroke-width:.6;vector-effect:non-scaling-stroke}
.cake-well{fill:#0a0705;stroke:var(--anatomy-lo);stroke-width:.6;vector-effect:non-scaling-stroke}`;
const BLURS = [3, 4, 5, 6, 8, 9];
const filters = BLURS.map((n) => `<filter id="b${n}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${n / 2}"/></filter>`).join("");
const svg = k
  .figureSvg({
    width: WIDTH,
    height: HEIGHT,
    standalone: "dark",
    label: LABEL,
    body: [`<style>${WARM}</style><defs>${filters}</defs>`, board(), ...scene.map((item) => item.svg)],
  })
  .replace("<svg ", `<svg width="${WIDTH}" height="${HEIGHT}" `)
  .replace(/filter:blur\((\d+)px\)/g, (_, n) => `filter:url(#b${n})`);

// Everything that moves lives in its own overlay with the same viewBox, screened
// over the drawing, so the static cake is painted once and never again.
const wicks = cakeArt.spots.map(([x, y]) => at([x + 0.4, y, WICK_TOP]).map(tenth));
const overlay =
  `<svg class="cake-fx" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">` +
  `<defs><radialGradient id="cake-glow"><stop offset="0" stop-color="#ffb35c" stop-opacity=".55"/><stop offset=".35" stop-color="#ff8a3d" stop-opacity=".18"/><stop offset="1" stop-color="#ff7a2e" stop-opacity="0"/></radialGradient></defs>` +
  `<ellipse data-part="glow" cx="${tenth(glowAt[0])}" cy="${tenth(glowAt[1])}" rx="${tenth(WIDTH * 0.42)}" ry="${tenth(HEIGHT * 0.36)}" fill="url(#cake-glow)"/>` +
  `<g data-part="smoke"></g>` +
  topperText() +
  wicks.map(([x, y], index) => `<circle class="cake-ember" data-ember="${index}" cx="${x}" cy="${y}" r="1"/>`).join("") +
  `<g data-part="flames"></g></svg>`;
const unit = tenth(k.screenRise(1, P) * 100) / 100;

const html = k.plateHtml({
  fig: "Fig. 01",
  title: "Make a wish",
  hint: "Tap the cake to blow",
  readout: `${COUNT} candle${COUNT > 1 ? "s" : ""} lit`,
  keys: [
    { mark: "lit", label: "Candles and the topper: what your wish acts on" },
    { mark: "raised", label: "Two tiers on a decorating turntable" },
  ],
  caption: "Close your eyes, make a wish, then blow. Tap the cake, or use the microphone and blow for real.",
  body: `<div class="iso-stage cake-stage" tabindex="0" role="button" aria-label="Birthday cake. Press Enter or tap to blow out the candles."><img class="cake-svg" src="${SVG_PATH}" width="${WIDTH}" height="${HEIGHT}" alt="${LABEL}" draggable="false">${overlay}</div>`,
});

const out = `// Generated by tools/build-cake.mjs. Do not edit; run \`npm run build\`.
export const CAKE_HTML = ${JSON.stringify(html)};
export const CAKE = ${JSON.stringify({ count: COUNT, wicks, unit, width: WIDTH, height: HEIGHT, src: SVG_PATH })};
`;
writeFileSync(join(ROOT, SVG_PATH), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
writeFileSync(join(ROOT, "js", "cake-art.js"), out);
writeFileSync(join(ROOT, "css", "iso.css"), `/* Anatomy kit styles (MIT), written by tools/build-cake.mjs */\n${k.ISO_CSS.trim()}\n`);
console.log(`wrote ${SVG_PATH} (${(svg.length / 1024).toFixed(0)} KB, ${COUNT} candles), js/cake-art.js and css/iso.css`);
