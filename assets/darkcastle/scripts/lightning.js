/* Shared layer exposure, optionally driven by the decoded thunder audio clock. */
(() => {
  const scene = document.querySelector(".exterior [data-scene]");
  if (!scene) return;
  const states = [...scene.querySelectorAll(".lightning-state")];
  if (states.length !== 4) return;
  const thunderURL = document.currentScript.dataset.thunderSrc;
  const attack = Number(document.currentScript.dataset.thunderAttack);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const timers = new Set();
  let ready = false;
  let leaving = false;
  let sound = false;
  let context;
  let buffer;
  let loading;
  let source;
  let frame;
  const mode = () => scene.dataset.lightningReview || "auto";
  const paused = () =>
    reduced.matches ||
    document.hidden ||
    leaving ||
    scene.hasAttribute("data-review-paused");
  const expose = (value) => {
    if (value) scene.dataset.lightning = value;
    else delete scene.dataset.lightning;
  };
  const clear = () => {
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(frame);
    if (source) {
      source.stop();
      source = undefined;
    }
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
  const finish = () => {
    expose(mode() === "lit" ? "bright" : null);
    schedule();
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
    if (sound && buffer && context?.state === "running") {
      const strike = context.createBufferSource();
      const gain = context.createGain();
      gain.gain.value = 0.5;
      strike.buffer = buffer;
      strike.connect(gain).connect(context.destination);
      source = strike;
      strike.onended = () => {
        strike.disconnect();
        gain.disconnect();
        if (source === strike) source = undefined;
      };
      const start = context.currentTime + 0.04;
      // First sharp attack is 1.08 s into the supplied recording. Light leads
      // it by 60 ms; use the audio clock so buffering cannot shift the flash.
      const flashAt = start + attack - 0.06;
      strike.start(start);
      const followAudio = () => {
        const elapsed = context.currentTime - flashAt;
        if (elapsed >= 0.38) {
          finish();
          return;
        }
        if (elapsed >= 0) expose(elapsed < 0.18 ? "bright" : "dim");
        frame = requestAnimationFrame(followAudio);
      };
      frame = requestAnimationFrame(followAudio);
    } else {
      // Muted, unsupported, or still downloading: retain the visual strike.
      expose("bright");
      later(() => expose("dim"), 180);
      later(finish, 380);
    }
  };
  const sync = () => {
    clear();
    expose(null);
    if (!ready || document.hidden || leaving) return;
    if (mode() === "lit") {
      expose("bright");
      return;
    }
    if (mode() === "off" || paused()) return;
    later(() => flash(), 6000);
  };
  document.addEventListener("castle-sound-change", (event) => {
    sound = event.detail.enabled;
    if (!sound) {
      sync();
      context?.suspend().catch(() => {});
      return;
    }
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      context ||= new Audio();
      // This event is dispatched synchronously by the user's Sound click.
      context.resume().catch(() => {});
      if (!buffer && !loading) {
        loading = fetch(thunderURL)
          .then((response) => {
            if (!response.ok) throw new Error("Thunder download failed");
            return response.arrayBuffer();
          })
          .then((bytes) => context.decodeAudioData(bytes))
          .then((decoded) => {
            buffer = decoded;
            scene.dataset.thunderReady = "";
          })
          .catch(() => document.dispatchEvent(new Event("castle-sound-error")))
          .finally(() => {
            loading = undefined;
          });
      }
    } catch {
      document.dispatchEvent(new Event("castle-sound-error"));
    }
  });
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
