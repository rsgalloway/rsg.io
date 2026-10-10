/* Optional browser checks. Requires Playwright; no JavaScript runtime is needed by the site build. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdir, writeFile } = require("node:fs/promises");
const base = process.env.CASTLE_PREVIEW_URL || "http://127.0.0.1:4000";
const output = process.env.CASTLE_SCREENSHOT_DIR;

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CASTLE_BROWSER || undefined,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().startsWith(base) && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    if (output) await mkdir(output, { recursive: true });
    const screenshot = async (target, name) => {
      if (output)
        await target.screenshot({
          path: `${output}/${name}.png`,
          fullPage: true,
        });
    };
    await page.goto(base + "/");
    // Keep unrelated flashes out of the exact-pixel cloud-loop comparison.
    await page
      .locator(".scene")
      .evaluate((el) => (el.dataset.lightningReview = "off"));
    await page.waitForSelector("[data-lightning-ready]");
    await page.evaluate(() => document.fonts.ready);
    assert.equal(
      await page
        .locator(".scene-header, .scene-caption, .plain-navigation")
        .count(),
      0,
    );
    assert.equal(
      await page.getByText("The personal realm of Ryan Galloway").count(),
      0,
    );
    assert.equal(await page.getByText("Engineering. Open source.").count(), 0);
    const viewport = page.viewportSize();
    const mainBox = await page.locator(".castle-main").boundingBox();
    assert.equal(Math.round(mainBox.width), viewport.width);
    assert.equal(Math.round(mainBox.height), viewport.height);
    assert.equal(await page.locator(".ambient-cloud, .title-block").count(), 0);
    assert.deepEqual(
      await page
        .locator("[data-layer]")
        .evaluateAll((elements) => elements.map((el) => el.dataset.layer)),
      ["1", "2", "3", "4", "5", "6", "7", "8"],
    );
    assert.equal(
      await page
        .locator(
          ".moon-glow, .lightning-bolt, .lightning-flash, .lightning-frame, .water-frame, .hero",
        )
        .count(),
      0,
    );
    assert.equal(
      await page
        .locator(".layer-moon img")
        .evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    for (const selector of [
      ".layer-mountains",
      ".layer-castle",
      ".layer-foreground",
    ]) {
      assert.equal(
        await page
          .locator(selector)
          .evaluate((el) => getComputedStyle(el).transform),
        "none",
      );
    }
    await page.locator(".cloud-bank").evaluate((el) => el.decode());
    assert.equal(
      await page
        .locator(
          ".cloud-rises, .cloud-track, .cloud-source, .layer-clouds canvas",
        )
        .count(),
      0,
    );
    assert.equal(await page.locator(".cloud-bank").count(), 1);
    const mist = await page.locator(".cloud-bank").evaluate((el) => {
      const css = getComputedStyle(el);
      const canvas = document.createElement("canvas");
      canvas.width = el.naturalWidth;
      canvas.height = el.naturalHeight;
      const context = canvas.getContext("2d");
      context.drawImage(el, 0, 0);
      const width = canvas.width / 2;
      const a = context.getImageData(0, 0, width, canvas.height).data;
      const b = context.getImageData(width, 0, width, canvas.height).data;
      // Read the actual visible contour from alpha, including the middle join.
      const edges = [];
      for (let x = 0; x < width; x += 16) {
        let edge = -1;
        for (let y = 0; y < 700; y += 4) {
          let alpha = 0;
          for (let dx = 0; dx < 16; dx++)
            for (let dy = 0; dy < 8; dy++)
              alpha += a[((y + dy) * width + x + dx) * 4 + 3];
          if (alpha / (16 * 8 * 255) > 0.2) {
            edge = y;
            break;
          }
        }
        edges.push(edge);
      }
      return {
        duration: parseFloat(css.animationDuration),
        durationMs: el.getAnimations()[0].effect.getTiming().duration,
        iterations: css.animationIterationCount,
        repeats: a.every((value, i) => value === b[i]),
        edges,
      };
    });
    assert.ok(
      mist.duration >= 2400 && mist.duration <= 3600,
      "Cloud drift is slow but perceptible",
    );
    assert.equal(mist.iterations, "infinite");
    assert.ok(
      mist.repeats,
      "The bank repeats pixel-for-pixel at the loop boundary",
    );
    assert.ok(
      mist.edges.every((y) => y >= 0),
      "Clouds form one uninterrupted bank",
    );
    assert.ok(
      mist.edges.slice(1).every((y, i) => Math.abs(y - mist.edges[i]) <= 24),
      "No abrupt height discontinuities across the bank",
    );
    assert.ok(
      mist.edges[48] - mist.edges[0] > 100,
      "The center stays lower than the sides",
    );
    await page
      .locator(".scene")
      .evaluate((el) => el.setAttribute("data-review-paused", ""));
    const cloudCycle = mist.durationMs;
    for (const phase of [0, 0.25, 0.5, 0.75, 0.999999]) {
      const covered = await page.locator(".cloud-bank").evaluate((el, time) => {
        el.getAnimations()[0].currentTime = time;
        const canvas = el.getBoundingClientRect();
        const scene = el.parentElement.getBoundingClientRect();
        return canvas.left <= scene.left && canvas.right >= scene.right;
      }, cloudCycle * phase);
      assert.ok(covered, "The cloud canvas covers the scene at phase " + phase);
    }
    await page
      .locator(".cloud-bank")
      .evaluate((el) => (el.getAnimations()[0].currentTime = 0));
    const loopStart = await page.screenshot();
    await page
      .locator(".cloud-bank")
      .evaluate(
        (el, time) => (el.getAnimations()[0].currentTime = time),
        cloudCycle,
      );
    const loopEnd = await page.screenshot();
    if (output && !loopStart.equals(loopEnd)) {
      await writeFile(`${output}/loop-start.png`, loopStart);
      await writeFile(`${output}/loop-end.png`, loopEnd);
    }
    assert.ok(loopStart.equals(loopEnd), "Cloud loop has no visual reset");
    await page
      .locator(".scene")
      .evaluate((el) => el.removeAttribute("data-review-paused"));
    const readCloudX = () =>
      page
        .locator(".cloud-bank")
        .evaluate(
          (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41,
        );
    const startX = await readCloudX();
    await page.waitForTimeout(2500);
    const movement = (await readCloudX()) - startX;
    assert.ok(
      movement > 0.7 && movement < 3,
      "Clouds actually drift right at a restrained speed",
    );
    await page.waitForFunction(
      () => document.querySelector(".lake-ripples").dataset.frame !== undefined,
    );
    const waterFrames = new Set();
    for (let i = 0; i < 3; i++) {
      const frame = await page
        .locator(".lake-ripples")
        .evaluate((el) => ({ id: el.dataset.frame, pixels: el.toDataURL() }));
      waterFrames.add(frame.pixels);
      if (i < 2)
        await page.waitForFunction(
          (id) => document.querySelector(".lake-ripples").dataset.frame !== id,
          frame.id,
        );
    }
    assert.equal(waterFrames.size, 3, "All three water states must differ");
    await page
      .locator(".scene")
      .evaluate((el) => el.setAttribute("data-review-paused", ""));
    const pausedFrame = await page
      .locator(".lake-ripples")
      .getAttribute("data-frame");
    await page.waitForTimeout(2200);
    assert.equal(
      await page.locator(".lake-ripples").getAttribute("data-frame"),
      pausedFrame,
    );
    await page
      .locator(".scene")
      .evaluate((el) => el.removeAttribute("data-review-paused"));
    assert.equal(await page.locator(".scene-enter").count(), 1);
    assert.equal(await page.locator(".hero, .welcome-copy").count(), 0);
    assert.equal(
      (await page.locator(".enter-prompt").innerText())
        .replace(/\s+/g, " ")
        .trim(),
      "✦ Click to enter ✦",
    );
    const sceneBox = await page.locator(".scene").boundingBox();
    assert.ok(sceneBox.x <= 0 && Math.round(sceneBox.y) === 0);
    assert.ok(sceneBox.x + sceneBox.width >= viewport.width);
    assert.ok(sceneBox.height >= viewport.height);
    const promptBox = await page.locator(".enter-prompt").boundingBox();
    assert.ok(promptBox.y >= 0);
    assert.ok(promptBox.y + promptBox.height <= viewport.height);
    await page.waitForSelector("[data-lightning-ready]");
    assert.deepEqual(
      await page
        .locator(".lightning-state")
        .evaluateAll((images) =>
          images.map((img) => img.closest("[data-layer]").dataset.layer),
        ),
      ["4", "5", "6", "7"],
    );
    await page.locator(".scene").evaluate((el) => {
      el.setAttribute("data-review-paused", "");
      el.dataset.lightningReview = "off";
    });
    const lightLevels = () =>
      page
        .locator(".lightning-state")
        .evaluateAll((images) =>
          images.map((img) => Number(getComputedStyle(img).opacity)),
        );
    assert.deepEqual(await lightLevels(), [0, 0, 0, 0]);
    await screenshot(page, "exterior");
    await page
      .locator(".scene")
      .evaluate((el) => (el.dataset.lightningReview = "lit"));
    await page.waitForSelector('[data-lightning="bright"]');
    assert.deepEqual(
      await lightLevels(),
      [1, 1, 1, 1],
      "All four layers change exposure together",
    );
    for (const selector of [
      ".layer-mountains",
      ".layer-castle",
      ".layer-foreground",
    ]) {
      const aligned = await page.locator(selector).evaluate((layer) => {
        const [base, lit] = [...layer.querySelectorAll("img")];
        const a = base.getBoundingClientRect();
        const b = lit.getBoundingClientRect();
        return (
          a.x === b.x &&
          a.y === b.y &&
          a.width === b.width &&
          a.height === b.height &&
          getComputedStyle(lit).maskImage !== "none"
        );
      });
      assert.ok(
        aligned,
        "Lighting retains the base registration and alpha silhouette",
      );
    }
    await screenshot(page, "lightning-left");
    await page
      .locator(".scene")
      .evaluate((el) => (el.dataset.lightningReview = "off"));
    await page.waitForFunction(
      () => !document.querySelector(".scene").hasAttribute("data-lightning"),
    );
    await page
      .locator(".scene")
      .evaluate((el) =>
        el.dispatchEvent(new Event("castle-lightning-preview")),
      );
    await page.waitForSelector('[data-lightning="bright"]');
    assert.deepEqual(await lightLevels(), [1, 1, 1, 1]);
    await page.waitForFunction(
      () => !document.querySelector(".scene").hasAttribute("data-lightning"),
    );
    assert.deepEqual(
      await lightLevels(),
      [0, 0, 0, 0],
      "Exposure returns completely to night",
    );
    await page
      .locator(".scene")
      .evaluate((el) => el.removeAttribute("data-review-paused"));

    await page.locator(".scene-enter").click({ position: { x: 720, y: 700 } });
    await page.waitForURL("**/castle/hall/");
    await screenshot(page, "hall");
    await page.locator('[data-hotspot="journal"]').click();
    await page.waitForURL("**/captainslog/");
    assert.equal(await page.locator("h3").count(), 5);
    await screenshot(page, "log");
    await page.getByRole("link", { name: "Older entries →" }).click();
    await page.waitForURL("**/page/2/");
    assert.equal(await page.locator("h3").count(), 5);
    await page.getByRole("link", { name: "Older entries →" }).click();
    await page.waitForURL("**/page/3/");
    assert.equal(await page.locator("h3").count(), 1);
    await page.goBack();
    await page.reload();
    assert.equal(await page.locator("h3").count(), 5);
    await page.goto(base + "/castle/hall/");
    await page.locator('[data-hotspot="library"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/blog/");
    await page.goBack();
    await page.locator('[data-hotspot="journal"]').click();
    await page.keyboard.press("Escape");
    await page.waitForURL("**/captainslog/");
    await page.locator(".castle-map summary").click();
    await page
      .getByRole("navigation", { name: "Castle map" })
      .getByRole("link", { name: "Workshop Projects" })
      .click();
    await page.waitForURL("**/projects/");

    const library = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    await library.goto(base + "/blog/");
    await library.locator(".room-backdrop").evaluate((img) => img.decode());
    assert.equal(
      await library.locator(".window-title").innerText(),
      "The Library",
    );
    assert.equal(
      await library.locator(".finder-window h1").innerText(),
      "Library",
    );
    assert.equal(await library.locator(".reading-header").count(), 0);
    const windowBox = await library.locator(".finder-window").boundingBox();
    assert.ok(Math.abs(windowBox.x + windowBox.width / 2 - 720) < 2);
    assert.ok(
      windowBox.width <= 780 && windowBox.x > 200,
      "Artwork remains visible beside the window",
    );
    await screenshot(library, "library");
    await library.locator(".window-close").focus();
    await library.keyboard.press("Enter");
    await library.waitForURL("**/castle/hall/");
    await library.goto(base + "/blog/");
    await library.locator(".prose li a").first().click();
    await library.waitForURL("**/blog/i-started-with-forkable-websites/");
    assert.equal(
      await library.locator(".window-title").innerText(),
      "The Library",
    );
    await screenshot(library, "library-article");
    const backgroundBefore = await library
      .locator(".room-backdrop")
      .boundingBox();
    await library.evaluate(() => scrollTo(0, 800));
    assert.ok(
      await library.evaluate(() => scrollY > 500),
      "Long articles use normal document scrolling",
    );
    assert.deepEqual(
      await library.locator(".room-backdrop").boundingBox(),
      backgroundBefore,
    );
    await library.getByRole("link", { name: "← Library", exact: true }).click();
    await library.waitForURL("**/blog/");
    await library.goto(base + "/castle/hall/");
    await library.locator('[data-hotspot="observatory"]').focus();
    await library.keyboard.press("Enter");
    await library.waitForURL("**/about/");
    await library.locator(".room-backdrop").evaluate((img) => img.decode());
    assert.equal(
      await library.locator(".window-title").innerText(),
      "The Observatory",
    );
    assert.equal(
      await library.locator(".finder-window h1").innerText(),
      "About",
    );
    assert.ok(
      (await library.locator(".room-backdrop").getAttribute("src")).endsWith(
        "/scenes/observatory.png",
      ),
    );
    assert.equal(
      await library
        .getByRole("link", { name: "LinkedIn", exact: true })
        .getAttribute("href"),
      "https://linkedin.com/in/rsgalloway",
    );
    assert.equal(
      await library.evaluate(() => document.documentElement.scrollHeight),
      1000,
      "Short rooms do not create an extra blank page margin",
    );
    await screenshot(library, "observatory");
    await library.locator(".window-close").focus();
    await library.keyboard.press("Enter");
    await library.waitForURL("**/castle/hall/");
    await library.close();

    const wide = await browser.newPage({
      viewport: { width: 1920, height: 960 },
    });
    await wide.goto(base + "/");
    const wideScene = await wide.locator(".scene").boundingBox();
    assert.equal(Math.round(wideScene.height), 1280);
    assert.equal(Math.round(wideScene.width), 1920);
    assert.equal(Math.round(wideScene.x), 0);
    assert.equal(Math.round(wideScene.y), 0);
    const widePrompt = await wide.locator(".enter-prompt").boundingBox();
    assert.ok(widePrompt.y >= 0);
    assert.ok(widePrompt.y + widePrompt.height <= 960);
    await screenshot(wide, "wide-exterior");

    const reduced = await browser.newPage({ reducedMotion: "reduce" });
    await reduced.goto(base + "/");
    await reduced.waitForSelector("[data-lightning-ready]");
    await reduced
      .locator(".scene")
      .evaluate((el) =>
        el.dispatchEvent(new Event("castle-lightning-preview")),
      );
    assert.equal(
      await reduced.locator(".scene").getAttribute("data-lightning"),
      null,
      "Reduced motion suppresses animated flashes",
    );
    assert.equal(await reduced.locator(".lake-ripples").isVisible(), false);
    assert.deepEqual(
      await reduced
        .locator(".cloud-bank, .stars")
        .evaluateAll((elements) =>
          elements.map((el) => getComputedStyle(el).animationName),
        ),
      ["none", "none", "none", "none"],
    );
    await reduced.emulateMedia({ reducedMotion: "no-preference" });
    await reduced.waitForFunction(
      () => !document.querySelector(".lake-ripples").hidden,
    );
    await reduced.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await reduced.locator(".lake-ripples").isVisible(), false);
    await reduced
      .locator(".scene-enter")
      .click({ position: { x: 720, y: 700 } });
    await reduced.waitForURL("**/castle/hall/");

    const nojs = await browser.newPage({ javaScriptEnabled: false });
    await nojs.goto(base + "/");
    assert.deepEqual(
      await nojs
        .locator(".lightning-state")
        .evaluateAll((images) =>
          images.map((img) => getComputedStyle(img).opacity),
        ),
      ["0", "0", "0", "0"],
    );
    assert.equal(await nojs.locator(".cloud-bank").isVisible(), true);
    assert.equal(
      await nojs.locator(".layer-clouds canvas, .cloud-source").count(),
      0,
    );
    assert.equal(await nojs.locator(".lake-ripples").isVisible(), false);
    assert.equal(
      await nojs.locator(".lake-surface img:not(.lightning-state)").isVisible(),
      true,
    );
    await nojs.locator(".scene-enter").click({ position: { x: 720, y: 700 } });
    await nojs.waitForURL("**/castle/hall/");
    await nojs.locator('[data-hotspot="journal"]').click();
    await nojs.waitForURL("**/captainslog/");
    await nojs.getByRole("link", { name: "Older entries →" }).click();
    await nojs.waitForURL("**/page/2/");

    await nojs.goto(base + "/blog/");
    await nojs.locator(".prose li a").first().click();
    await nojs.waitForURL("**/blog/i-started-with-forkable-websites/");
    await nojs.getByRole("link", { name: "← Library", exact: true }).click();
    await nojs.waitForURL("**/blog/");
    await nojs.locator(".window-close").click();
    await nojs.waitForURL("**/castle/hall/");

    await nojs.goto(base + "/about/");
    assert.equal(
      await nojs.locator(".window-title").innerText(),
      "The Observatory",
    );
    await nojs.locator(".window-close").click();
    await nojs.waitForURL("**/castle/hall/");

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    for (const [route, name] of [
      ["/", "mobile"],
      ["/castle/hall/", "mobile-hall"],
      ["/captainslog/", "mobile-log"],
      ["/blog/", "mobile-library"],
      ["/blog/i-started-with-forkable-websites/", "mobile-library-article"],
      ["/about/", "mobile-observatory"],
      ["/castle/directory/", "mobile-directory"],
    ]) {
      await mobile.goto(base + route);
      if (route === "/") {
        const prompt = await mobile.locator(".enter-prompt").boundingBox();
        assert.ok(Math.abs(prompt.x + prompt.width / 2 - 195) < 2);
        const scene = await mobile.locator(".scene").boundingBox();
        assert.equal(
          Math.round(scene.x + scene.width),
          390,
          "Portrait crop stays anchored to the castle side",
        );
      }

      await screenshot(mobile, name);
      assert.equal(
        await mobile.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        "Horizontal overflow on " + route,
      );
    }
    await mobile.getByRole("link", { name: "← Great Hall" }).tap();
    await mobile.waitForURL("**/castle/hall/");
    await mobile.locator('[data-hotspot="journal"]').tap();
    await mobile.waitForURL("**/captainslog/");
    // Hold the cloud download: the initial DOM must already reference the final
    // artwork, with no fallback image or canvas to swap in after decoding.
    const startup = await browser.newPage();
    let releaseCloud;
    await startup.route(
      "**/clouds-continuous.png",
      (route) =>
        new Promise((resolve) => {
          releaseCloud = () => route.continue().then(resolve);
        }),
    );
    await startup.goto(base + "/", { waitUntil: "domcontentloaded" });
    assert.equal(await startup.locator(".layer-clouds > *").count(), 1);
    const initialSource = await startup
      .locator(".cloud-bank")
      .getAttribute("src");
    assert.ok(initialSource.endsWith("/clouds-continuous.png"));
    assert.equal(
      await startup.locator(".cloud-bank").evaluate((el) => el.complete),
      false,
    );
    await releaseCloud();
    await startup.locator(".cloud-bank").evaluate((el) => el.decode());
    assert.equal(await startup.locator(".layer-clouds > *").count(), 1);
    assert.equal(
      await startup.locator(".cloud-bank").getAttribute("src"),
      initialSource,
    );
    await startup.close();
    // Hold one lighting download: incomplete light states must never flash.
    const pending = await browser.newPage();
    let releaseLighting;
    await pending.route(
      "**/lightning/foreground-left.png",
      (route) =>
        new Promise((resolve) => {
          releaseLighting = () => route.continue().then(resolve);
        }),
    );
    await pending.goto(base + "/", { waitUntil: "domcontentloaded" });
    await pending
      .locator(".scene")
      .evaluate((el) =>
        el.dispatchEvent(new Event("castle-lightning-preview")),
      );
    assert.equal(
      await pending.locator(".scene").getAttribute("data-lightning"),
      null,
    );
    await releaseLighting();
    await pending.waitForSelector("[data-lightning-ready]");
    await pending.waitForFunction(
      () => document.querySelector(".scene").dataset.lightning === "bright",
      null,
      { timeout: 10000 },
    );
    assert.deepEqual(
      await pending
        .locator(".lightning-state")
        .evaluateAll((images) =>
          images.map((img) => getComputedStyle(img).opacity),
        ),
      ["1", "1", "1", "1"],
      "Automatic flash waits for every lighting asset",
    );
    await pending.waitForFunction(
      () => !document.querySelector(".scene").hasAttribute("data-lightning"),
    );
    await pending.close();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: Library and Observatory reading windows, article navigation and document scrolling, synchronized directional lightning, eight layers, distinct water frames, pause/resume, navigation, pagination, keyboard, skip, map, back/reload, reduced motion, no-JS, mobile and touch.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
