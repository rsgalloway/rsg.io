/* Decode the current artwork, then warm the other active scenes. */
(() => {
  const root = document.documentElement;
  const reveal = () => root.removeAttribute("data-art-loading");
  const manifest = document.getElementById("scene-assets");
  let scenes;
  try {
    scenes = JSON.parse(manifest.textContent);
  } catch {
    reveal();
    return;
  }
  const images = new Map();
  const warm = (url, priority = "low") => {
    let item = images.get(url);
    if (!item) {
      const image = new Image();
      image.fetchPriority = priority;
      image.src = url;
      item = { image, ready: image.decode().catch(() => {}) };
      images.set(url, item);
    } else if (priority === "high") {
      item.image.fetchPriority = "high";
    }
    return item.ready;
  };
  const destination = (link) => {
    if (
      !link ||
      link.hasAttribute("download") ||
      (link.target && link.target !== "_self")
    )
      return;
    const url = new URL(link.href, location.href);
    if (
      url.origin !== location.origin ||
      (url.pathname === location.pathname &&
        (url.hash || url.search === location.search))
    )
      return;
    return scenes.find(
      (scene) =>
        scene.route === url.pathname ||
        (scene.prefix && url.pathname.startsWith(scene.route)),
    );
  };
  const prepare = (scene) =>
    Promise.all(scene.images.map((url) => warm(url, "high")));
  for (const name of ["pointerover", "focusin"]) {
    document.addEventListener(name, (event) => {
      const scene = destination(event.target.closest?.("a[href]"));
      if (scene) prepare(scene);
    });
  }
  let navigation = 0;
  let pendingLink;
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.target.closest?.("a[href]");
    const scene = destination(link);
    if (!scene) return;
    event.preventDefault();
    const ticket = ++navigation;
    pendingLink?.removeAttribute("aria-busy");
    pendingLink = link;
    link.setAttribute("aria-busy", "true");
    let timeout;
    Promise.race([
      prepare(scene),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, 3000);
      }),
    ]).then(() => {
      clearTimeout(timeout);
      link.removeAttribute("aria-busy");
      if (ticket === navigation) location.assign(link.href);
    });
  });
  // Prevent an old pending click from firing after a back/forward-cache restore.
  window.addEventListener("pagehide", () => {
    navigation++;
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      pendingLink?.removeAttribute("aria-busy");
      reveal();
    }
  });
  const visible = [
    ...document.querySelectorAll(
      ".room-backdrop, .scene-art, .scene-layer img:not(.lightning-state)",
    ),
  ];
  Promise.all(visible.map((image) => image.decode().catch(() => {}))).then(
    () => {
      reveal();
      // Do not make unused rooms compete with the initial scene download.
      setTimeout(async () => {
        const current = new Set(
          [...document.images].map((image) => image.getAttribute("src")),
        );
        for (const url of new Set(scenes.flatMap((scene) => scene.images))) {
          if (!current.has(url)) await warm(url);
        }
      }, 250);
    },
  );
})();
