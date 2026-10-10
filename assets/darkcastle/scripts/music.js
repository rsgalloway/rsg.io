/* Opt-in sound shared across documents, with a separate position per track. */
(() => {
  const audio = document.getElementById("background-music");
  const button = document.getElementById("music-toggle");
  const status = document.getElementById("music-status");
  if (!audio || !button || !status) return;
  const preferenceKey = "castle-sound";
  const positionKey = `castle-music-position-${audio.dataset.track}`;
  const read = (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      sessionStorage.setItem(key, String(value));
    } catch {
      /* Optional storage. */
    }
  };
  let enabled = read(preferenceKey) === "on";
  let pending = false;
  let attempt = 0;
  let leaving = false;
  const label = button.querySelector(".sound-label");
  const announceSound = (active) =>
    document.dispatchEvent(
      new CustomEvent("castle-sound-change", { detail: { enabled: active } }),
    );
  const rememberPosition = () => {
    if (audio.readyState >= 1) write(positionKey, audio.currentTime);
  };
  audio.addEventListener("loadedmetadata", () => {
    const position = Number(read(positionKey));
    if (Number.isFinite(position) && position > 0 && position < audio.duration)
      audio.currentTime = position;
  });
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
    rememberPosition();
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
  button.addEventListener("click", () => {
    enabled = !enabled;
    write(preferenceKey, enabled ? "on" : "off");
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
    leaving = true;
    suspend();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    leaving = false;
    enabled = read(preferenceKey) === "on";
    start(true);
    render();
  });
  // Wait until all deferred scripts (including the thunder listener) are ready.
  document.addEventListener("DOMContentLoaded", () => start(true), {
    once: true,
  });
})();
