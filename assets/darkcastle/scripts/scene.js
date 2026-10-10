/* Independent lake ripple states; navigation remains ordinary HTML links. */
(() => {
  const scene = document.querySelector(".exterior [data-scene]");
  if (!scene) return;
  const image = scene.querySelector(".lake-surface img");
  const canvas = scene.querySelector(".lake-ripples");
  const context = canvas?.getContext("2d");
  if (!image || !context) return;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const frames = [];
  let current = 0;
  let timer;
  let leaving = false;
  const paint = () => {
    context.drawImage(frames[current], 0, 0);
    canvas.dataset.frame = String(current);
  };
  const paused = () =>
    reduced.matches ||
    document.hidden ||
    leaving ||
    scene.hasAttribute("data-review-paused");
  const tick = () => {
    if (paused()) return;
    current = (current + 1) % frames.length;
    paint();
    timer = setTimeout(tick, 2000);
  };
  const sync = () => {
    clearTimeout(timer);
    scene.toggleAttribute("data-motion-paused", paused());
    canvas.hidden = reduced.matches || frames.length === 0;
    if (frames.length && !paused()) {
      paint();
      timer = setTimeout(tick, 2000);
    }
  };

  // Cache three water-only states. Keep the distant shoreline fixed; individual
  // scanlines shift by at most two pixels, with wrapped edges and no land mask.
  image
    .decode()
    .then(() => {
      const width = canvas.width;
      const height = canvas.height;
      const base = document.createElement("canvas");
      base.width = width;
      base.height = height;
      const baseContext = base.getContext("2d");
      if (!baseContext) return;
      baseContext.fillStyle = "#000";
      baseContext.fillRect(0, 0, width, height);
      baseContext.drawImage(image, 0, 0, width, height);
      for (let frame = 0; frame < 3; frame++) {
        const state = document.createElement("canvas");
        state.width = width;
        state.height = height;
        const drawing = state.getContext("2d");
        if (!drawing) return;
        for (let y = 0; y < height; y += 2) {
          const amplitude = Math.min(1, Math.max(0, (y - 12) / 100)) * 2;
          const shift = Math.round(
            Math.sin(y * 0.17 + (frame * Math.PI * 2) / 3) * amplitude,
          );
          const band = Math.min(2, height - y);
          drawing.drawImage(base, 0, y, width, band, shift, y, width, band);
          if (shift > 0)
            drawing.drawImage(
              base,
              width - shift,
              y,
              shift,
              band,
              0,
              y,
              shift,
              band,
            );
          if (shift < 0)
            drawing.drawImage(
              base,
              0,
              y,
              -shift,
              band,
              width + shift,
              y,
              -shift,
              band,
            );
        }
        frames.push(state);
      }
      sync();
    })
    .catch(() => {
      /* The static image remains visible if decoding fails. */
    });
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  window.addEventListener("pagehide", () => {
    leaving = true;
    sync();
  });
  window.addEventListener("pageshow", () => {
    leaving = false;
    sync();
  });
  new MutationObserver(sync).observe(scene, {
    attributes: true,
    attributeFilter: ["data-review-paused"],
  });
  sync();
})();
