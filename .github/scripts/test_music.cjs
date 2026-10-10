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
    await page.locator(".scene-enter").click({ position: { x: 600, y: 500 } });
    await page.waitForURL("**/castle/hall/");
    await ready(page);
    await page.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
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
    // Old session positions must not restore after upgrading this behavior.
    await page.evaluate(() => {
      sessionStorage.setItem("castle-music-position-interior", "23");
      sessionStorage.setItem("castle-music-position-landing", "12");
    });
    await page.reload();
    await ready(page);
    await page.waitForFunction(
      () =>
        !document.getElementById("background-music").paused ||
        document
          .getElementById("music-status")
          .textContent.includes("resume music"),
    );
    if (
      await page.locator("#background-music").evaluate((audio) => audio.paused)
    )
      await toggle.click();
    await page.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    assert.ok(
      await page
        .locator("#background-music")
        .evaluate((audio) => audio.currentTime < 5),
      "Refresh starts the track from the beginning",
    );
    for (const route of ["/blog/", "/projects/", "/about/", "/captainslog/"]) {
      await page.locator(".castle-map summary").click();
      await page.locator(`.castle-map a[href="${route}"]`).click();
      await page.waitForURL(base + route);
      await ready(page);
      await page.waitForFunction(() => {
        const audio = document.getElementById("background-music");
        return !audio.paused && audio.currentTime < 5;
      });
      assert.ok(
        (await page.locator("#background-music").getAttribute("src")).endsWith(
          "interior-music.mp3",
        ),
      );
    }
    await page.locator(".castle-map summary").click();
    await page.locator('.castle-map a[href="/"]').click();
    await page.waitForURL(base + "/");
    await ready(page);
    await page.waitForFunction(() => {
      const audio = document.getElementById("background-music");
      return !audio.paused && audio.currentTime < 5;
    });
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
    await page.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    assert.ok(
      await page
        .locator("#background-music")
        .evaluate((audio) => audio.currentTime < 5),
      "Back/forward-cache restoration resets playback",
    );
    await toggle.click();
    await page.goto(base + "/castle/hall/");
    await ready(page);
    assert.equal(
      await page.locator("#background-music").evaluate((audio) => audio.paused),
      true,
    );
    assert.equal(await toggle.getAttribute("aria-pressed"), "false");
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

    // Storage state carries localStorage, but no sessionStorage, into a fresh
    // browser session. A blocked autoplay attempt must not erase the opt-in.
    const firstVisit = await browser.newContext();
    const firstPage = await firstVisit.newPage();
    await firstPage.goto(base + "/castle/hall/");
    await ready(firstPage);
    await firstPage.locator("#music-toggle").click();
    await firstPage.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    assert.equal(
      await firstPage.evaluate(() => localStorage.getItem("castle-sound")),
      "on",
    );
    const optedIn = await firstVisit.storageState();
    await firstVisit.close();

    const returnVisit = await browser.newContext({ storageState: optedIn });
    await returnVisit.addInitScript(() => {
      const play = HTMLMediaElement.prototype.play;
      let first = true;
      HTMLMediaElement.prototype.play = function (...args) {
        if (first) {
          first = false;
          return Promise.reject(
            new DOMException("Playback needs a gesture", "NotAllowedError"),
          );
        }
        return play.apply(this, args);
      };
    });
    const returnPage = await returnVisit.newPage();
    await returnPage.goto(base + "/castle/hall/");
    await ready(returnPage);
    await returnPage.waitForFunction(() =>
      document
        .getElementById("music-status")
        .textContent.includes("resume music"),
    );
    assert.equal(
      await returnPage.evaluate(() => localStorage.getItem("castle-sound")),
      "on",
    );
    await returnPage.locator("#music-toggle").click();
    await returnPage.waitForFunction(
      () => !document.getElementById("background-music").paused,
    );
    await returnPage.locator("#music-toggle").click();
    const optedOut = await returnVisit.storageState();
    await returnVisit.close();

    const mutedVisit = await browser.newContext({ storageState: optedOut });
    const mutedPage = await mutedVisit.newPage();
    const mutedRequests = [];
    mutedPage.on("request", (request) => {
      if (request.url().endsWith(".mp3")) mutedRequests.push(request.url());
    });
    await mutedPage.goto(base + "/");
    await ready(mutedPage);
    assert.equal(
      await mutedPage.evaluate(() => localStorage.getItem("castle-sound")),
      "off",
    );
    assert.equal(
      await mutedPage.locator("#music-toggle").getAttribute("aria-pressed"),
      "false",
    );
    assert.deepEqual(
      mutedRequests,
      [],
      "Remembered mute never starts an audio download",
    );
    await mutedVisit.close();

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
      "PASS: opt-in music, looping, persistent preference, blocked-autoplay recovery, fresh playback on refresh/revisit, keyboard/touch controls, background pause, synchronized thunder, reduced motion, failed media, and no-JavaScript controls.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
