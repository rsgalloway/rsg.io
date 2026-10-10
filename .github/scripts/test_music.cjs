/* Optional Playwright checks for shared opt-in music and synchronized thunder. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = process.env.CASTLE_PREVIEW_URL || "http://127.0.0.1:4000";
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CASTLE_BROWSER,
    args: ["--no-sandbox"],
  });
  const ready = (page) =>
    page.waitForFunction(
      () => !document.documentElement.hasAttribute("data-art-loading"),
    );
  try {
    const page = await browser.newPage();
    // SimpleHTTPServer lacks byte-range support. Model static hosting for seek
    // assertions while keeping the actual supplied MP3 bytes and real playback.
    await page.route("**/audio/*-music.mp3", async (route) => {
      const filename = new URL(route.request().url()).pathname.split("/").pop();
      const bytes = fs.readFileSync(
        path.join(__dirname, "../../assets/darkcastle/audio", filename),
      );
      const range = route
        .request()
        .headers()
        .range?.match(/bytes=(\d+)-(\d*)/);
      const headers = {
        "content-type": "audio/mpeg",
        "accept-ranges": "bytes",
      };
      if (range) {
        const start = Number(range[1]),
          end = range[2] ? Number(range[2]) : bytes.length - 1;
        headers["content-range"] = `bytes ${start}-${end}/${bytes.length}`;
        await route.fulfill({
          status: 206,
          headers,
          body: bytes.subarray(start, end + 1),
        });
      } else await route.fulfill({ status: 200, headers, body: bytes });
    });
    await page.addInitScript(() => {
      // Simulate visitors upgrading from the old remembered-on behavior.
      localStorage.setItem("castle-sound", "on");
      sessionStorage.setItem("castle-sound", "on");
      sessionStorage.setItem("castle-music-position-interior", "23");
      sessionStorage.setItem("castle-music-position-landing", "12");
      window.soundStorageAccesses = [];
      for (const method of ["getItem", "setItem"]) {
        const original = Storage.prototype[method];
        Storage.prototype[method] = function (key, ...args) {
          if (key.startsWith("castle-") && key !== "castle-sound-handoff")
            window.soundStorageAccesses.push({ method, key });
          return original.call(this, key, ...args);
        };
      }
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const requests = [];
    page.on("request", (request) => {
      if (request.url().endsWith(".mp3")) requests.push(request.url());
    });
    await page.goto(base + "/");
    await ready(page);
    const toggle = page.getByRole("button", { name: "Sound", exact: true });
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    assert.equal(
      await page
        .locator("#background-music")
        .evaluate(
          (audio) => audio.paused && audio.preload === "none" && audio.loop,
        ),
      true,
    );
    assert.equal(requests.length, 0, "No audio transfer before opting in");
    await toggle.focus();
    await page.keyboard.press("Space");
    await page.waitForFunction(() => {
      const audio = document.getElementById("background-music");
      return !audio.paused && audio.currentTime > 0.1;
    });
    assert.equal(await toggle.innerText(), "Sound on");
    assert.ok(
      await page
        .locator("#background-music")
        .evaluate((audio) => Math.abs(audio.volume - 0.35) < 0.001),
    );
    assert.ok(page.url().endsWith("/"), "Music control doesn't enter the Hall");
    await page.locator("#background-music").evaluate((audio) => {
      audio.currentTime = audio.duration - 0.15;
    });
    await page.waitForFunction(() => {
      const audio = document.getElementById("background-music");
      return !audio.paused && audio.currentTime < 1;
    });
    await toggle.click();
    assert.equal(
      await page.locator("#background-music").evaluate((audio) => audio.paused),
      true,
    );
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
    await toggle.click();
    await page.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(
      await page.locator("#background-music").evaluate((audio) => audio.paused),
      true,
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    await page.locator("#background-music").evaluate((audio) => {
      audio.currentTime = 12;
    });
    const assertMuted = async () => {
      assert.equal(await toggle.getAttribute("aria-pressed"), "false");
      assert.ok(
        await page
          .locator("#background-music")
          .evaluate((audio) => audio.paused && audio.currentTime === 0),
      );
      assert.deepEqual(
        await page.evaluate(() => window.soundStorageAccesses),
        [],
        "Sound never reads or writes persistent preferences/positions",
      );
    };
    const enableSound = async () => {
      await toggle.click();
      await page.waitForFunction(
        () => !document.getElementById("background-music").paused,
      );
      assert.deepEqual(
        await page.evaluate(() => window.soundStorageAccesses),
        [],
      );
    };
    const assertPlaying = async () => {
      await page.waitForFunction(
        () => !document.getElementById("background-music").paused,
      );
      assert.equal(await toggle.getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.evaluate(() =>
          sessionStorage.getItem("castle-sound-handoff"),
        ),
        null,
        "The navigation handoff is consumed immediately",
      );
      assert.deepEqual(
        await page.evaluate(() => window.soundStorageAccesses),
        [],
      );
    };
    await page.locator(".scene-enter").click({ position: { x: 600, y: 500 } });
    await page.waitForURL("**/castle/hall/");
    await ready(page);
    await assertPlaying();
    assert.ok(
      (await page.locator("#background-music").getAttribute("src")).endsWith(
        "interior-music.mp3",
      ),
    );
    await page.locator("#background-music").evaluate((audio) => {
      audio.currentTime = 23;
    });
    await page.waitForFunction(
      () => document.getElementById("background-music").currentTime >= 23,
    );
    await page.reload();
    await ready(page);
    await assertMuted();
    await enableSound();
    assert.ok(
      await page
        .locator("#background-music")
        .evaluate((audio) => audio.currentTime < 5),
      "Explicit playback after refresh starts at zero",
    );
    for (const route of [
      "/blog/",
      "/projects/",
      "/about/",
      "/captainslog/",
      "/",
    ]) {
      await page.locator(".castle-map summary").click();
      await page.locator(`.castle-map a[href="${route}"]`).click();
      await page.waitForURL(base + route);
      await ready(page);
      await assertPlaying();
      if (route === "/") await page.waitForSelector("[data-thunder-ready]");
    }
    await page.locator("#background-music").evaluate((audio) => {
      audio.currentTime = 12;
    });
    await page.waitForFunction(
      () => document.getElementById("background-music").currentTime >= 12,
    );
    await page.evaluate(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true }),
      );
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );
    });
    await assertMuted();
    // Muted navigation must neither start nor download audio.
    const beforeMutedNavigation = requests.length;
    await page.locator(".scene-enter").click({ position: { x: 600, y: 500 } });
    await page.waitForURL("**/castle/hall/");
    await ready(page);
    await assertMuted();
    assert.equal(requests.length, beforeMutedNavigation);
    // Explicitly muting clears consent for the next internal page, too.
    await enableSound();
    await toggle.click();
    await page.locator(".castle-map summary").click();
    await page.locator('.castle-map a[href="/blog/"]').click();
    await page.waitForURL("**/blog/");
    await ready(page);
    await assertMuted();
    // Returning directly is a fresh visit, even after playing on another page.
    await enableSound();
    await page.goto(base + "/");
    await ready(page);
    await assertMuted();
    assert.deepEqual(errors, []);
    await page.close();

    const storm = await browser.newPage();
    await storm.addInitScript(() => {
      window.strikes = [];
      const create = AudioContext.prototype.createBufferSource;
      AudioContext.prototype.createBufferSource = function () {
        const node = create.call(this);
        const record = { context: this, stopped: false };
        const start = node.start.bind(node),
          stop = node.stop.bind(node);
        node.start = (...args) => {
          record.start = args[0];
          record.duration = node.buffer.duration;
          window.strikes.push(record);
          return start(...args);
        };
        node.stop = (...args) => {
          record.stopped = true;
          return stop(...args);
        };
        return node;
      };
    });
    await storm.goto(base + "/");
    await ready(storm);
    await storm.waitForSelector("[data-lightning-ready]");
    await storm.locator("[data-scene]").evaluate((scene) => {
      scene.dataset.lightningReview = "off";
    });
    await storm.locator("#music-toggle").click();
    await storm.waitForSelector("[data-thunder-ready]");
    await storm.evaluate(() => {
      window.exposures = [];
      const scene = document.querySelector("[data-scene]");
      new MutationObserver(() => {
        const strike = window.strikes.at(-1);
        if (strike && scene.dataset.lightning)
          window.exposures.push({
            state: scene.dataset.lightning,
            time: strike.context.currentTime - strike.start,
            layers: [...scene.querySelectorAll(".lightning-state")].map(
              (image) => getComputedStyle(image).opacity,
            ),
          });
      }).observe(scene, {
        attributes: true,
        attributeFilter: ["data-lightning"],
      });
      scene.dispatchEvent(new Event("castle-lightning-preview"));
    });
    await storm.waitForFunction(() =>
      window.exposures.some((e) => e.state === "dim"),
    );
    const exposure = await storm.evaluate(() => ({
      exposures: window.exposures,
      duration: window.strikes[0].duration,
      stopped: window.strikes[0].stopped,
    }));
    const bright = exposure.exposures.find((e) => e.state === "bright");
    assert.ok(
      bright.time >= 1.02 && bright.time < 1.14,
      JSON.stringify(exposure),
    );
    assert.deepEqual(bright.layers, ["1", "1", "1", "1"]);
    assert.ok(exposure.duration > 10 && exposure.duration < 11);
    assert.equal(
      exposure.stopped,
      false,
      "Rumble continues after the bright flash",
    );
    await storm.locator("#music-toggle").click();
    assert.equal(await storm.evaluate(() => window.strikes[0].stopped), true);
    await storm.emulateMedia({ reducedMotion: "reduce" });
    await storm.locator("#music-toggle").click();
    await storm
      .locator("[data-scene]")
      .evaluate((scene) =>
        scene.dispatchEvent(new Event("castle-lightning-preview")),
      );
    assert.equal(
      await storm.evaluate(() => window.strikes.length),
      1,
      "Reduced motion suppresses thunder strikes",
    );
    await storm.close();

    const missingThunder = await browser.newPage();
    await missingThunder.route("**/audio/lightning.mp3", (route) =>
      route.abort(),
    );
    await missingThunder.goto(base + "/");
    await ready(missingThunder);
    await missingThunder.waitForSelector("[data-lightning-ready]");
    await missingThunder.locator("[data-scene]").evaluate((scene) => {
      scene.dataset.lightningReview = "off";
    });
    await missingThunder.locator("#music-toggle").click();
    await missingThunder.waitForFunction(() =>
      document
        .getElementById("music-status")
        .textContent.includes("Thunder could not load"),
    );
    assert.equal(
      await missingThunder
        .locator("#background-music")
        .evaluate((audio) => audio.paused),
      false,
    );
    assert.equal(
      await missingThunder.locator("[data-scene]").evaluate((scene) => {
        scene.dispatchEvent(new Event("castle-lightning-preview"));
        return scene.dataset.lightning;
      }),
      "bright",
    );
    await missingThunder.close();

    const restricted = await browser.newPage();
    await restricted.addInitScript(() => {
      for (const name of ["localStorage", "sessionStorage"])
        Object.defineProperty(window, name, {
          get() {
            throw new DOMException("Storage denied", "SecurityError");
          },
        });
    });
    await restricted.goto(base + "/castle/hall/");
    await ready(restricted);
    await restricted.locator("#music-toggle").click();
    await restricted.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    await restricted.reload();
    await ready(restricted);
    assert.equal(
      await restricted.locator("#music-toggle").getAttribute("aria-pressed"),
      "false",
    );
    assert.equal(
      await restricted
        .locator("#background-music")
        .evaluate((audio) => audio.paused),
      true,
    );
    await restricted.close();

    const failed = await browser.newPage();
    await failed.route("**/audio/landing-music.mp3", (route) => route.abort());
    await failed.goto(base + "/");
    await ready(failed);
    await failed.locator("#music-toggle").click();
    await failed.waitForFunction(() =>
      document.getElementById("music-status").textContent.includes("could not"),
    );
    assert.equal(
      await failed.locator("#music-toggle").getAttribute("aria-pressed"),
      "false",
    );
    await failed.close();

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await mobile.goto(base + "/");
    await ready(mobile);
    const musicBox = await mobile.locator("#music-toggle").boundingBox();
    const mapBox = await mobile.locator(".scene-menu").boundingBox();
    assert.ok(
      musicBox.x + musicBox.width < mapBox.x,
      "Music and map controls don't overlap on phones",
    );
    await mobile.locator("#music-toggle").tap();
    await mobile.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    await mobile.locator("#music-toggle").tap();
    assert.equal(
      await mobile
        .locator("#background-music")
        .evaluate((audio) => audio.paused),
      true,
    );
    await mobile.close();

    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base + "/");
    assert.equal(await nojs.locator(".music-fallback").isVisible(), true);
    assert.equal(await nojs.locator("#music-toggle").isVisible(), false);
    assert.equal(
      await nojs
        .locator(".music-fallback")
        .evaluate((audio) => audio.controls && audio.paused && !audio.autoplay),
      true,
    );
    await nojs.close();
    console.log(
      "PASS: opt-in music, looping, sound retained across internal links, muted refresh/revisit and muted navigation, no persistent preference storage, keyboard/touch controls, background pause, synchronized thunder, reduced motion, failed media, and no-JavaScript controls.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
