/* Ordinary anchors are the navigation layer. Motion only decorates a click. */
(() => {
  const scene = document.querySelector("[data-scene]");
  const source = document.getElementById("scene-manifest");
  if (!scene || !source) return;
  let manifest;
  try {
    manifest = JSON.parse(source.textContent);
  } catch {
    return;
  }
  const hero = scene.querySelector(".hero");
  const status = document.querySelector(".travel-status");
  const idleSprite = hero.src;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let pending = null;
  let timer;
  let animation;
  const reset = () => {
    clearTimeout(timer);
    animation?.cancel();
    pending = null;
    hero.src = idleSprite;
    scene.classList.remove("travelling", "interacting");
    scene
      .querySelectorAll(".active-hotspot")
      .forEach((el) => el.classList.remove("active-hotspot"));
    status.hidden = true;
  };
  const finish = () => {
    if (!pending) return;
    const href = pending;
    reset();
    window.location.assign(href);
  };
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-hotspot]");
    if (
      !link ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      link.target ||
      reduced.matches ||
      !hero.animate
    )
      return;
    const spot = manifest.hotspots.find(
      (item) => item.id === link.dataset.hotspot,
    );
    if (!spot || spot.immediate) return;
    event.preventDefault();
    reset();
    pending = link.href;
    status.querySelector("a").href = pending;
    status.hidden = false;
    scene.classList.add("travelling");
    const target = scene.querySelector(".hotspot-" + spot.id);
    target?.classList.add("active-hotspot");
    const points = [manifest.spawn, ...(spot.path || [spot.approach])];
    animation = hero.animate(
      points.map(([x, y]) => ({ left: x + "%", top: y + "%" })),
      { duration: 650, easing: "ease-in-out", fill: "forwards" },
    );
    animation.onfinish = () => {
      scene.classList.add("interacting");
      hero.src = hero.dataset.interactionSrc;
    };
    timer = window.setTimeout(finish, 950);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (pending) {
        event.preventDefault();
        finish();
      } else
        document
          .querySelectorAll(".castle-map[open]")
          .forEach((el) => (el.open = false));
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) finish();
  });
  reduced.addEventListener("change", () => {
    if (reduced.matches) finish();
  });
  window.addEventListener("pagehide", reset);
  window.addEventListener("pageshow", reset);
})();
