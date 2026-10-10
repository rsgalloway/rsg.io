/* Optional browser checks for the delayed, decorative dragon visitor. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdir } = require("node:fs/promises");
const base = process.env.CASTLE_PREVIEW_URL || "http://127.0.0.1:4000";
const output = process.env.CASTLE_SCREENSHOT_DIR || "/tmp/castle-dragon-review";
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
    await mkdir(output, { recursive: true });
    const page = await browser.newPage({
      viewport: { width: 1536, height: 1024 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install();
    await page.goto(base + "/");
    await ready(page);
    await page.waitForSelector("[data-dragon-ready]");
    await page.locator(".scene").evaluate((scene) => {
      scene.dataset.lightningReview = "off";
    });
    const dragon = page.locator(".dragon");
    assert.equal(await dragon.isVisible(), false, "No visitor on arrival");
    await page.clock.fastForward(54000);
    assert.equal(await dragon.isVisible(), false, "No visitor before a minute");
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(120000);
    assert.equal(
      await dragon.isVisible(),
      false,
      "Hidden time does not count toward the surprise",
    );
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.clock.fastForward(7100);
    assert.equal(await dragon.isVisible(), true);
    assert.equal(
      await page.locator(".layer-dragon").getAttribute("data-dragon-state"),
      "landing",
    );
    const approach = await dragon.boundingBox();
    await page.locator(".scene").evaluate((scene) => {
      scene.dataset.reviewPaused = "";
    });
    const pausedPosition = await dragon.boundingBox();
    await page.clock.fastForward(10000);
    assert.deepEqual(
      await dragon.boundingBox(),
      pausedPosition,
      "Inspector pause freezes descent",
    );
    await page.locator(".scene").evaluate((scene) => {
      delete scene.dataset.reviewPaused;
    });
    await page.clock.fastForward(1500);
    const braking = await dragon.boundingBox();
    assert.ok(braking.y > approach.y, "Dragon descends from screen top");
    assert.equal(
      braking.x,
      approach.x,
      "Frontal approach stays aligned with the tower",
    );
    await page.screenshot({ path: output + "/dragon-approach.png" });
    await page.clock.fastForward(7000);
    assert.equal(
      await page.locator(".layer-dragon").getAttribute("data-dragon-state"),
      "perched",
    );
    const perched = await dragon.boundingBox();
    await page.screenshot({ path: output + "/dragon-perched.png" });
    await page.clock.fastForward(120000);
    assert.deepEqual(
      await dragon.boundingBox(),
      perched,
      "Visitor stays perched without repeating",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => document.querySelector(".dragon").hidden);
    assert.equal(await dragon.isVisible(), false);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => !document.querySelector(".dragon").hidden);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: output + "/dragon-mobile.png" });
    // The decorative layer must never intercept the entrance link.
    const mobileDragon = await dragon.boundingBox();
    await page.mouse.click(
      mobileDragon.x + mobileDragon.width / 2,
      Math.max(10, mobileDragon.y + mobileDragon.height / 2),
    );
    await page.waitForURL("**/castle/hall/");
    assert.deepEqual(errors, []);
    await page.close();

    const reduced = await browser.newPage({ reducedMotion: "reduce" });
    const requests = [];
    reduced.on("request", (request) => requests.push(request.url()));
    await reduced.clock.install();
    await reduced.goto(base + "/");
    await ready(reduced);
    await reduced.clock.fastForward(180000);
    assert.equal(await reduced.locator(".dragon").isVisible(), false);
    assert.equal(
      requests.some((url) => /\/creatures\/dragon-[^/]+\.png$/.test(url)),
      false,
      "Reduced motion does not download the optional frames",
    );
    await reduced.close();

    const failed = await browser.newPage();
    await failed.clock.install();
    await failed.route("**/creatures/dragon-*.png", (route) => route.abort());
    await failed.goto(base + "/");
    await ready(failed);
    await failed.clock.fastForward(90000);
    assert.equal(await failed.locator(".dragon").isVisible(), false);
    assert.equal(
      await failed.locator(".scene-enter").isVisible(),
      true,
      "Optional artwork failure never blocks navigation",
    );
    await failed.close();
    console.log(
      "PASS: delayed visible-time arrival, descent, tower alignment, pause/resume, one-time perch, reduced motion, mobile navigation, and missing artwork fallback.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
