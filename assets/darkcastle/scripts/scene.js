/* Layered pointer parallax; navigation remains ordinary HTML links. */
(() => {
  const scene = document.querySelector("[data-scene]");
  if (!scene) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");
  const layers = [...scene.querySelectorAll("[data-parallax-depth]")];
  let frame;
  let current = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };

  const render = () => {
    current.x += (target.x - current.x) * 0.055;
    current.y += (target.y - current.y) * 0.055;
    layers.forEach((layer) => {
      const depth = Number(layer.dataset.parallaxDepth);
      layer.style.setProperty(
        "--parallax-x",
        `${(current.x * depth).toFixed(2)}px`,
      );
      layer.style.setProperty(
        "--parallax-y",
        `${(current.y * depth).toFixed(2)}px`,
      );
    });
    const moving =
      Math.abs(target.x - current.x) > 0.02 ||
      Math.abs(target.y - current.y) > 0.02;
    frame = moving ? requestAnimationFrame(render) : undefined;
  };

  const setTarget = (x, y) => {
    target = { x, y };
    if (!frame) frame = requestAnimationFrame(render);
  };

  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = undefined;
    current = { x: 0, y: 0 };
    target = { x: 0, y: 0 };
    layers.forEach((layer) => {
      layer.style.removeProperty("--parallax-x");
      layer.style.removeProperty("--parallax-y");
    });
  };

  scene.addEventListener("pointermove", (event) => {
    if (reduced.matches || !finePointer.matches) return;
    const bounds = scene.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 16;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 10;
    setTarget(x, y);
  });
  scene.addEventListener("pointerleave", () => setTarget(0, 0));
  reduced.addEventListener("change", () => {
    if (reduced.matches) reset();
  });
  window.addEventListener("pagehide", reset);
})();
