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
  const muteButton = frame.querySelector("[data-film-mute]");
  const fullButton = frame.querySelector("[data-film-full]");
  const controls = frame.querySelector(".film-controls");
  const bar = frame.querySelector(".film-bar span");
  const ambient = frame.querySelector(".film-ambient");
  const paint = ambient.getContext("2d", { willReadFrequently: false });
  ambient.width = 48;
  ambient.height = 27;
  let unlocked = false;
  let missing = false;
  let inView = false;
  let userPaused = false;
  let userMuted = false;
  let priming = false;
  let glowFrame = 0;

  const id = youtubeId(config.youtube);
  if (id) {
    video.remove();
    toggle.remove();
    controls.remove();
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
    controls.hidden = true;
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
    video.muted = userMuted || !unlocked;
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
    frame.classList.remove("is-playing", "is-idle");
    onPause?.();
  });
  video.addEventListener("ended", () => {
    bar.style.transform = "scaleX(1)";
    userPaused = true;
  });
  function resume() {
    userPaused = false;
    if (video.ended) video.currentTime = 0;
    if (!userMuted) video.muted = false;
    sound.hidden = !video.muted;
    video.play();
  }

  // Controls fade out while the film plays and nobody touches it. On a touch
  // screen, the first tap on a faded film only brings them back.
  let idleTimer = 0;
  let lastPointer = "mouse";
  function wake() {
    frame.classList.remove("is-idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!video.paused) frame.classList.add("is-idle");
    }, 2600);
  }
  screen.addEventListener("pointermove", (event) => event.pointerType === "mouse" && wake());
  screen.addEventListener("pointerdown", (event) => (lastPointer = event.pointerType), true);

  toggle.addEventListener("click", () => {
    unlocked = true;
    if (lastPointer !== "mouse" && frame.classList.contains("is-idle")) return wake();
    wake();
    if (video.paused) resume();
    else {
      userPaused = true;
      video.pause();
    }
  });
  sound.addEventListener("click", () => {
    unlocked = true;
    userMuted = false;
    video.muted = false;
    sound.hidden = true;
  });
  muteButton.addEventListener("click", () => {
    unlocked = true;
    userMuted = !video.muted;
    video.muted = userMuted;
    sound.hidden = true;
    wake();
  });
  video.addEventListener("volumechange", () => {
    muteButton.setAttribute("aria-pressed", String(video.muted));
    muteButton.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
    if (!video.paused && !priming) onPlay?.(video.muted);
  });

  // Full screen. Phones that allow it are turned sideways for the landscape film;
  // an iPhone has no element full screen, so it gets Safari's own video player.
  const fullElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const inFull = () => Boolean(fullElement() || video.webkitDisplayingFullscreen);
  async function enterFull() {
    if (video.paused) resume();
    const request = screen.requestFullscreen || screen.webkitRequestFullscreen;
    if (!request) return video.webkitEnterFullscreen?.();
    try {
      await request.call(screen, { navigationUI: "hide" });
    } catch {
      return video.webkitEnterFullscreen?.();
    }
    if (video.videoWidth >= video.videoHeight) {
      try {
        await window.screen.orientation?.lock?.("landscape");
      } catch {}
    }
  }
  fullButton.addEventListener("click", () => {
    unlocked = true;
    wake();
    if (fullElement()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    else enterFull();
  });
  const onFullChange = () => {
    const full = Boolean(fullElement());
    frame.classList.toggle("is-full", full);
    fullButton.setAttribute("aria-label", full ? "Exit full screen" : "Full screen");
    if (!full) {
      try {
        window.screen.orientation?.unlock?.();
      } catch {}
    }
    wake();
  };
  document.addEventListener("fullscreenchange", onFullChange);
  document.addEventListener("webkitfullscreenchange", onFullChange);

  watchVisible(frame, (on) => {
    // Going full screen lifts the film out of the page, which looks like scrolling away.
    if (inFull()) return;
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
