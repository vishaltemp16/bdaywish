// Everything personal lives here. Edit this file, refresh the page, done.
// After changing `candles`, run `npm run build` so the cake gets the right number.
window.BIRTHDAY = {
  // The birthday person's name, as it should appear on the loader, hero, cake topper and finale.
  name: "Friend",

  // Shown under the name in the hero. Leave "" to hide.
  date: "",

  // Who it is from (finale signature).
  from: "your friends",

  // Candles on the cake (1 to 24). Rebuild after changing: npm run build
  candles: 7,

  // Photos for the card deck, in order. Put the files in assets/photos/.
  // `caption` is optional. Portrait photos look best (about 4:5).
  photos: [
    { src: "assets/photos/placeholder-01.svg", caption: "The one where it all started" },
    { src: "assets/photos/placeholder-02.svg", caption: "That trip we still talk about" },
    { src: "assets/photos/placeholder-03.svg", caption: "3 a.m. conversations" },
    { src: "assets/photos/placeholder-04.svg", caption: "Proof we can be photogenic" },
    { src: "assets/photos/placeholder-05.svg", caption: "Too much food, zero regrets" },
    { src: "assets/photos/placeholder-06.svg", caption: "The best kind of chaos" },
    { src: "assets/photos/placeholder-07.svg", caption: "Here's to many more" },
  ],

  // The video that plays in the "For you" section.
  // Option A: a file in assets/video/ (mp4, keep it under ~25 MB).
  // Option B: an unlisted YouTube link in `youtube` (then `src` is ignored).
  video: {
    src: "assets/video/wish.mp4",
    poster: "",
    youtube: "",
  },

  // Optional background music (mp3 in assets/), starts when the gift is opened. "" for none.
  music: "",

  // The letter shown before the notes. Use \n\n for a new paragraph.
  letter:
    "Another year of you, and somehow you keep getting better at it.\n\nWe put this together because a text felt too small. Scroll slowly, make a wish, and know that you are loved a ridiculous amount.",

  // Notes from friends. Add as many as you like.
  messages: [
    { from: "Friend 1", text: "Happy birthday! Thank you for being the person who always shows up." },
    { from: "Friend 2", text: "May this year be as fun as our worst ideas and as calm as our best naps." },
    { from: "Friend 3", text: "Here's to more late nights, more road trips and more stories we can't tell anyone." },
    { from: "Friend 4", text: "You make every room warmer. Have the best day." },
  ],
};
