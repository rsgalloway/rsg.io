/* Optional browser checks. Requires Playwright; no JavaScript runtime is needed by the site build. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
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
    const mist = await page.locator(".cloud-one").evaluate((el) => {
      const css = getComputedStyle(el);
      return {
        duration: parseFloat(css.animationDuration),
        top: parseFloat(css.top) / el.parentElement.clientHeight,
      };
    });
    assert.ok(mist.duration >= 240);
    assert.ok(mist.top >= 0.15, "Mist is low behind the mountain ridges");
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
    await screenshot(page, "exterior");
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
    assert.equal(await reduced.locator(".lake-ripples").isVisible(), false);
    assert.deepEqual(
      await reduced
        .locator(".cloud, .stars")
        .evaluateAll((elements) =>
          elements.map((el) => getComputedStyle(el).animationName),
        ),
      ["none", "none", "none", "none", "none"],
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
    assert.equal(await nojs.locator(".lake-ripples").isVisible(), false);
    assert.equal(await nojs.locator(".lake-surface img").isVisible(), true);
    await nojs.locator(".scene-enter").click({ position: { x: 720, y: 700 } });
    await nojs.waitForURL("**/castle/hall/");
    await nojs.locator('[data-hotspot="journal"]').click();
    await nojs.waitForURL("**/captainslog/");
    await nojs.getByRole("link", { name: "Older entries →" }).click();
    await nojs.waitForURL("**/page/2/");

    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    for (const [route, name] of [
      ["/", "mobile"],
      ["/castle/hall/", "mobile-hall"],
      ["/captainslog/", "mobile-log"],
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
    assert.deepEqual(errors, []);
    console.log(
      "PASS: eight layers, distinct water frames, pause/resume, navigation, pagination, keyboard, skip, map, back/reload, reduced motion, no-JS, mobile and touch.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
