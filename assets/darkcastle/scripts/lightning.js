/* One synchronized exposure change across the mountains, castle, lake, and foreground. */
(() => {
  const scene = document.querySelector(".exterior [data-scene]");
  if (!scene) return;
  const states = [...scene.querySelectorAll(".lightning-state")];
  if (states.length !== 4) return;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const timers = new Set();
  let ready = false;
  let leaving = false;
  const mode = () => scene.dataset.lightningReview || "auto";
  const paused = () =>
    reduced.matches ||
    document.hidden ||
    leaving ||
    scene.hasAttribute("data-review-paused");
  const clear = () => {
    timers.forEach(clearTimeout);
    timers.clear();
  };
  const expose = (value) => {
    if (value) scene.dataset.lightning = value;
    else delete scene.dataset.lightning;
  };
  const later = (callback, delay) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
  };
  const schedule = () => {
    if (ready && !paused() && mode() === "auto")
      later(() => flash(), 14000 + Math.random() * 10000);
  };
  const flash = (manual = false) => {
    if (
      !ready ||
      reduced.matches ||
      document.hidden ||
      leaving ||
      (!manual && paused())
    )
      return;
    clear();
    expose("bright");
    later(() => expose("dim"), 180);
    later(() => {
      expose(mode() === "lit" ? "bright" : null);
      schedule();
    }, 380);
  };
  const sync = () => {
    clear();
    expose(null);
    if (!ready || document.hidden || leaving) return;
    // A held still in the local inspector is explicit comparison, not animation.
    if (mode() === "lit") {
      expose("bright");
      return;
    }
    if (mode() === "off" || paused()) return;
    later(() => flash(), 6000);
  };
  Promise.all(states.map((image) => image.decode()))
    .then(() => {
      ready = true;
      scene.dataset.lightningReady = "";
      sync();
    })
    .catch(() => {
      clear();
      expose(null);
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
    attributeFilter: ["data-review-paused", "data-lightning-review"],
  });
  scene.addEventListener("castle-lightning-preview", () => flash(true));
})();
