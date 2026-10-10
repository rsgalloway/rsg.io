/* A one-time landing after 60 seconds of visible, unpaused time at the gate. */
(() => {
  const scene = document.querySelector(".exterior [data-scene]");
  const layer = scene?.querySelector(".layer-dragon");
  const canvas = layer?.querySelector("canvas");
  const context = canvas?.getContext("2d");
  if (!context) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const delay = 60000;
  const duration = 6200;
  let elapsed = 0;
  let startedAt = null;
  let timeout;
  let animation;
  let images;
  let frames;
  try {
    frames = JSON.parse(layer.querySelector(".dragon-frame-data").textContent);
  } catch {
    return;
  }
  if (!Array.isArray(frames) || frames.length !== 4) return;
  let ready = false;
  let failed = false;
  let leaving = false;
  let preview = false;
  const paused = () =>
    document.hidden ||
    leaving ||
    reduced.matches ||
    document.documentElement.hasAttribute("data-art-loading") ||
    (!preview &&
      (scene.hasAttribute("data-review-paused") ||
        scene.hasAttribute("data-motion-paused")));
  const clock = () =>
    elapsed + (startedAt === null ? 0 : performance.now() - startedAt);
  const stop = () => {
    elapsed = clock();
    startedAt = null;
    clearTimeout(timeout);
    cancelAnimationFrame(animation);
  };
  const paint = (time) => {
    // Separate transparent images prevent neighboring sprite cells bleeding in.
    let frame;
    let x;
    let y;
    if (time < 4200) {
      const t = Math.max(0, time / 4200);
      const ease = 1 - (1 - t) ** 2;
      x = 1120;
      y = -160 + 152 * ease;
      frame = time < 3000 ? Math.floor(time / 360) % 2 : 1;
    } else {
      x = 1120;
      y = -8;
      frame = time < 4750 ? 1 : time < 5400 ? 2 : 3;
    }
    context.clearRect(0, 0, 512, 512);
    context.drawImage(images[frame], 0, frames[frame].offsetY, 512, 512);
    canvas.style.left = `${(x / 1536) * 100}%`;
    canvas.style.top = `${(y / 1024) * 100}%`;
    canvas.hidden = false;
    layer.dataset.dragonFrame = String(frame);
    layer.dataset.dragonState = time >= duration ? "perched" : "landing";
  };
  const tick = () => {
    if (paused()) {
      sync();
      return;
    }
    const time = Math.max(0, clock() - delay);
    paint(time);
    if (time >= duration) {
      stop();
      elapsed = delay + duration;
      preview = false;
      return;
    }
    animation = requestAnimationFrame(tick);
  };
  const load = () => {
    if (images || failed) return;
    images = frames.map((frame) => {
      const image = new Image();
      image.fetchPriority = "low";
      image.src = frame.src;
      return image;
    });
    Promise.all(images.map((image) => image.decode()))
      .then(() => {
        if (images.some((image) => image.naturalWidth !== image.naturalHeight))
          throw new Error("Unexpected dragon frame dimensions");
        ready = true;
        layer.dataset.dragonReady = "";
        sync();
      })
      .catch(() => {
        failed = true;
        stop();
        canvas.hidden = true;
      });
  };
  const sync = () => {
    stop();
    if (reduced.matches) canvas.hidden = true;
    if (paused() || failed) return;
    load();
    if (elapsed >= delay && !ready) {
      elapsed = delay; // Never skip the approach while the optional art loads.
      return;
    }
    startedAt = performance.now();
    if (elapsed < delay) timeout = setTimeout(sync, delay - elapsed);
    else tick();
  };
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
    attributeFilter: ["data-review-paused", "data-motion-paused"],
  });
  new MutationObserver(sync).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-art-loading"],
  });
  scene.addEventListener("castle-dragon-preview", () => {
    if (reduced.matches || document.hidden || leaving) return;
    stop();
    elapsed = delay;
    preview = true;
    sync();
  });
  sync();
})();
