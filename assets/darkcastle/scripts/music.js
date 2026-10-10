/* Carry explicit sound opt-in across internal links, never refreshes or visits. */
(() => {
  const audio = document.getElementById("background-music");
  const button = document.getElementById("music-toggle");
  const status = document.getElementById("music-status");
  if (!audio || !button || !status) return;
  const handoffKey = "castle-sound-handoff";
  const pageURL = (value) => {
    const url = new URL(value, location.href);
    url.hash = "";
    return url.href;
  };
  const consumeHandoff = () => {
    try {
      const saved = sessionStorage.getItem(handoffKey);
      sessionStorage.removeItem(handoffKey);
      const handoff = JSON.parse(saved);
      const navigation = performance.getEntriesByType("navigation")[0];
      const valid =
        handoff &&
        navigation?.type === "navigate" &&
        handoff.to === pageURL(location.href) &&
        handoff.from === pageURL(document.referrer || "/") &&
        document.referrer &&
        Date.now() >= handoff.created &&
        Date.now() - handoff.created < 30000;
      return valid ? handoff : null;
    } catch {
      return null;
    }
  };
  const incoming = consumeHandoff();
  let enabled = !!incoming;
  let resumeAt =
    audio.dataset.track === "interior" &&
    incoming?.source === audio.src &&
    Number.isFinite(incoming.position) &&
    incoming.position >= 0
      ? incoming.position
      : null;
  const restorePosition = () => {
    if (resumeAt === null || audio.readyState < 1) return;
    const position = resumeAt;
    resumeAt = null;
    if (Number.isFinite(audio.duration) && audio.duration > 0)
      audio.currentTime = position % audio.duration;
  };
  // Seek as soon as metadata is ready, before the new player becomes audible.
  audio.addEventListener("loadedmetadata", restorePosition);
  let destination;
  // Capture also sees links held by the artwork loader until decoding finishes.
  document.addEventListener(
    "click",
    (event) => {
      destination = undefined;
      const link = event.target.closest?.("a[href]");
      if (
        !link ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.hasAttribute("download") ||
        (link.target && link.target !== "_self")
      )
        return;
      const url = new URL(link.href, location.href);
      if (
        url.origin === location.origin &&
        pageURL(url) !== pageURL(location.href)
      )
        destination = pageURL(url);
    },
    true,
  );
  let pending = false;
  let attempt = 0;
  let leaving = false;
  const label = button.querySelector(".sound-label");
  const announceSound = (active) =>
    document.dispatchEvent(
      new CustomEvent("castle-sound-change", { detail: { enabled: active } }),
    );
  audio.volume = 0.35;
  const render = () => {
    button.setAttribute("aria-pressed", String(enabled));
    label.textContent = pending
      ? "Loading…"
      : enabled
        ? "Sound on"
        : "Sound off";
    button.title = enabled ? "Mute sound" : "Enable sound";
  };
  const suspend = () => {
    attempt++;
    pending = false;
    audio.pause();
    announceSound(false);
    render();
  };
  const start = (automatic = false) => {
    if (!enabled || document.hidden || leaving) return;
    pending = true;
    status.textContent = "";
    const ticket = ++attempt;
    // Synchronous in a click handler to unlock both audio APIs together.
    announceSound(true);
    render();
    if (audio.error) audio.load();
    restorePosition();
    audio
      .play()
      .then(() => {
        if (ticket !== attempt) return;
        pending = false;
        render();
      })
      .catch(() => {
        if (ticket !== attempt) return;
        enabled = false;
        suspend();
        status.textContent = automatic
          ? "Select Sound to resume music."
          : "Music could not play. Select Sound to try again.";
      });
  };
  button.hidden = false;
  render();
  // Let the deferred lightning controller subscribe before handing sound over.
  document.addEventListener("DOMContentLoaded", () => start(true), {
    once: true,
  });
  button.addEventListener("click", () => {
    enabled = !enabled;
    if (enabled) start();
    else {
      suspend();
      status.textContent = "";
    }
  });
  audio.addEventListener("error", () => {
    if (!enabled) return;
    enabled = false;
    suspend();
    status.textContent = "Music could not load. Select Sound to try again.";
  });
  document.addEventListener("castle-sound-error", () => {
    if (enabled)
      status.textContent = "Thunder could not load; music is still available.";
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) suspend();
    else start(true);
  });
  window.addEventListener("pagehide", () => {
    try {
      sessionStorage.removeItem(handoffKey);
      if (enabled && destination)
        sessionStorage.setItem(
          handoffKey,
          JSON.stringify({
            from: pageURL(location.href),
            to: destination,
            created: Date.now(),
            ...(audio.dataset.track === "interior" && {
              source: audio.src,
              position: resumeAt ?? audio.currentTime,
            }),
          }),
        );
    } catch {
      // Storage restrictions must not prevent navigation or manual playback.
    }
    destination = undefined;
    leaving = true;
    enabled = false;
    suspend();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    leaving = false;
    consumeHandoff();
    resumeAt = null;
    // Back/forward cache can restore the old audio element and playback time.
    if (audio.readyState >= 1) audio.currentTime = 0;
    enabled = false;
    status.textContent = "";
    suspend();
  });
})();
