# bdaywish

A one-page birthday gift. Print a QR code that points at the site; whoever scans it gets:

1. **Loader**: "Happy Birthday, *name*" while photos and video preload, then an *Open your gift* button (that tap also unlocks sound for the video).
2. **Hero**: the name in huge type over floating candle-light.
3. **Letter**: a short note that lights up word by word as you scroll.
4. **Memories**: a deck of photo cards; scrolling deals them off the top in 3D.
5. **Make a wish**: an isometric cake drawn with the anatomy kit. Tap it (or blow into the mic) to blow the candles out.
6. **The film**: your video, playing by itself when it scrolls into view.
7. **Notes** from friends, then a **finale** with confetti.

Plain HTML, CSS and JS. No framework and nothing to install.

## Make it yours

Everything personal is in [`config.js`](config.js): name, date, photos and captions, video, letter, notes, music.

- **Photos**: put them in `assets/photos/` and list them in `config.js`. Portrait (about 4:5) looks best. Resize to about 1200 px on the long side so they load fast on phones.
- **Video**: save it as `assets/video/wish.mp4` (H.264 MP4, ideally under 25 MB), or paste an unlisted YouTube link into `video.youtube`.
- **Candles**: set `candles`, then rebuild the cake:

```bash
npm run build
```

## Preview locally

```bash
npm run dev
```

Then open http://localhost:5173.

## Deploy (free) and make the QR code

**Cloudflare Pages** (redeploys by itself on every push):

1. Cloudflare dashboard → **Compute → Workers & Pages** → **Create application** → **Pages** tab → **Connect to Git**.
2. Pick **GitHub**, authorise Cloudflare, choose this repository, then **Begin setup**.
3. Production branch `main`, Framework preset **None**, Build command **empty**, Build output directory `/`. Then **Save and Deploy**.
4. The site goes live at `https://<project-name>.pages.dev`. Make a QR code for that URL and print it.

Any single file must be **25 MiB or smaller** on Cloudflare Pages, so compress the video below that, or use an unlisted YouTube link.

GitHub Pages also works: repository **Settings → Pages**, deploy from branch `main`, folder `/ (root)`.

## Credits

- Cake figure: built with the [anatomy](tools/anatomy/LICENSE) isometric kit (MIT).
- Smooth scrolling: [Lenis](vendor/LICENSE-lenis) (MIT).
- Fonts: Fraunces, Inter and JetBrains Mono from Google Fonts.
