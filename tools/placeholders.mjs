// Writes placeholder photos (assets/photos/placeholder-NN.svg) so the deck has
// something to show before the real photos arrive.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "photos");
const PALETTES = [
  ["#3a1f14", "#c2683a", "#ffcf8a"],
  ["#1b2233", "#5a6fa8", "#f2b8a0"],
  ["#2b1630", "#a0527a", "#ffc6a8"],
  ["#14281f", "#4f8a6a", "#f6dca0"],
  ["#2e1d0f", "#b5822f", "#fff0c2"],
  ["#251421", "#c25a5a", "#ffd2b0"],
  ["#13202a", "#3f7d8f", "#ffe1b8"],
];

PALETTES.forEach(([deep, mid, light], index) => {
  const n = String(index + 1).padStart(2, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
<radialGradient id="s" cx=".3" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<filter id="n"><feTurbulence baseFrequency=".9" numOctaves="2" seed="${index + 3}"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .18 0"/></filter>
</defs>
<rect width="800" height="1000" fill="url(#g)"/>
<circle cx="${220 + index * 60}" cy="${300 + (index % 3) * 90}" r="${180 + (index % 2) * 60}" fill="url(#s)"/>
<rect width="800" height="1000" filter="url(#n)"/>
<text x="64" y="900" font-family="Georgia,serif" font-style="italic" font-size="120" fill="#fff" fill-opacity=".9">${n}</text>
<text x="70" y="944" font-family="monospace" font-size="24" letter-spacing="4" fill="#fff" fill-opacity=".7">REPLACE WITH A PHOTO</text>
</svg>`;
  writeFileSync(join(OUT, `placeholder-${n}.svg`), svg);
});
console.log(`wrote ${PALETTES.length} placeholders to assets/photos`);
