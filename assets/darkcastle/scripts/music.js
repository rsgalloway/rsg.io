/* Sound is opt-in for this document only; navigation always starts muted. */
(() => {
  const audio = document.getElementById("background-music");
  const button = document.getElementById("music-toggle");
  const status = document.getElementById("music-status");
  if (!audio || !button || !status) return;
  let enabled = false;
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
    enabled = false;
    suspend();
  });
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    leaving = false;
    // Back/forward cache can restore the old audio element and playback time.
    if (audio.readyState >= 1) audio.currentTime = 0;
    enabled = false;
    status.textContent = "";
    suspend();
  });
})();
