import { watchVisible } from "./util.js";

function youtubeId(link) {
  const match = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(link || "");
  return match ? match[1] : "";
}

// The film: plays by itself when it scrolls into view (with sound once the gift
// has been opened), pauses when it leaves, and lights the room with its colours.
export function createFilm(frame, config = {}, { onPlay, onPause } = {}) {
  const screen = frame.querySelector(".film-screen");
  const video = frame.querySelector("video");
  const empty = frame.querySelector(".film-empty");
  const toggle = frame.querySelector("[data-film-toggle]");
  const sound = frame.querySelector("[data-film-sound]");
  const bar = frame.querySelector(".film-bar span");
  const ambient = frame.querySelector(".film-ambient");
  const paint = ambient.getContext("2d", { willReadFrequently: false });
  ambient.width = 48;
  ambient.height = 27;
  let unlocked = false;
  let missing = false;
  let inView = false;
  let userPaused = false;
  let priming = false;
  let glowFrame = 0;

  const id = youtubeId(config.youtube);
  if (id) {
    video.remove();
    toggle.remove();
    frame.querySelector(".film-bar").remove();
    let started = false;
    watchVisible(frame, (on) => {
      if (!on || started) return;
      started = true;
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
      iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      iframe.allowFullscreen = true;
      iframe.title = "Birthday film";
      screen.prepend(iframe);
      frame.classList.add("is-playing");
      onPlay?.();
    }, { threshold: 0.5 });
    return { ready: Promise.resolve(), unlock() {} };
  }

  function showEmpty() {
    missing = true;
    empty.hidden = false;
    toggle.hidden = true;
    video.removeAttribute("src");
  }

  const ready = new Promise((resolve) => {
    if (!config.src) {
      showEmpty();
      resolve();
      return;
    }
    video.addEventListener("loadedmetadata", () => {
      if (video.videoHeight > video.videoWidth) screen.classList.add("is-portrait");
      resolve();
    }, { once: true });
    video.addEventListener("error", () => {
      showEmpty();
      resolve();
    }, { once: true });
    setTimeout(resolve, 7000);
    if (config.poster) video.poster = config.poster;
    video.src = config.src;
  });

  function glow() {
    if (video.paused || video.ended) {
      glowFrame = 0;
      return;
    }
    try {
      paint.drawImage(video, 0, 0, ambient.width, ambient.height);
    } catch {}
    bar.style.transform = `scaleX(${video.duration ? video.currentTime / video.duration : 0})`;
    glowFrame = requestAnimationFrame(glow);
  }

  async function play() {
    if (missing) return;
    video.muted = !unlocked;
    try {
      await video.play();
    } catch {
      video.muted = true;
      try {
        await video.play();
      } catch {
        return;
      }
    }
    sound.hidden = !video.muted;
  }

  video.addEventListener("play", () => {
    if (priming) return;
    frame.classList.add("is-playing");
    if (!glowFrame) glowFrame = requestAnimationFrame(glow);
    onPlay?.(video.muted);
  });
  video.addEventListener("pause", () => {
    if (priming) return;
    frame.classList.remove("is-playing");
    onPause?.();
  });
  video.addEventListener("ended", () => {
    bar.style.transform = "scaleX(1)";
    userPaused = true;
  });
  toggle.addEventListener("click", () => {
    unlocked = true;
    if (video.paused) {
      userPaused = false;
      if (video.ended) video.currentTime = 0;
      video.muted = false;
      sound.hidden = true;
      video.play();
    } else {
      userPaused = true;
      video.pause();
    }
  });
  sound.addEventListener("click", () => {
    unlocked = true;
    video.muted = false;
    sound.hidden = true;
    onPlay?.(false);
  });
  watchVisible(frame, (on) => {
    inView = on;
    if (on && !userPaused) play();
    else if (!on) video.pause();
  }, { threshold: 0.55 });

  return {
    ready,
    // Called from the "Open your gift" tap: a user gesture lets the film play with sound later.
    unlock() {
      if (missing || !config.src) return;
      if (inView) return;
      priming = true;
      video.muted = false;
      const attempt = video.play();
      if (!attempt) {
        priming = false;
        return;
      }
      attempt
        .then(() => {
          video.pause();
          video.currentTime = 0;
          unlocked = true;
        })
        .catch(() => {})
        .finally(() => setTimeout(() => (priming = false), 0));
    },
  };
}
